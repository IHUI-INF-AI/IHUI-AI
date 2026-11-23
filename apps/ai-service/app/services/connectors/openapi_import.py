# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OpenAPI 文档导入(2026-11-23 立)。

把一份 OpenAPI 3.x(或 Swagger 2.0)描述文件转成连接器的声明式操作清单:

- ``servers[0].url``(或 swagger 的 ``host``+``basePath``)作为 base_url
- 每个 path × method 生成一条操作
- 路径参数/查询参数保留 ``{name}`` 占位符,有默认值的查询参数直接落默认值
- 请求体按 schema 的 example/默认值生成模板
- 能力位推断:GET 无路径参数 → list,有路径参数 → fetch,
  带 q/search/keyword 查询参数 → search;写方法 → action

解析纯本地、不触网;是否真的能调通由用户在页面上「测试调用」验证。
"""

from __future__ import annotations

import json
import re
from typing import Any

from .base import MAX_OPERATIONS, ConnectorOperationError, normalize_operations

_WRITE_METHODS = {"post", "put", "patch", "delete"}
_SEARCH_HINTS = {"q", "query", "search", "keyword", "kw", "filter"}


def parse_spec_text(raw: str) -> dict[str, Any]:
    """把上传的 JSON/YAML 文本解析成 dict。YAML 依赖缺失时只支持 JSON。"""
    text = (raw or "").strip()
    if not text:
        raise ConnectorOperationError("OpenAPI 文档为空")
    if text.startswith("{"):
        try:
            data = json.loads(text)
        except ValueError as exc:
            raise ConnectorOperationError(f"JSON 解析失败: {exc}") from exc
        if not isinstance(data, dict):
            raise ConnectorOperationError("OpenAPI 文档必须是对象")
        return data
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError as exc:
        raise ConnectorOperationError(
            "当前环境不支持 YAML,请上传 .json 格式的 OpenAPI 文档"
        ) from exc
    try:
        data = yaml.safe_load(text)
    except Exception as exc:  # noqa: BLE001 - YAML 库抛的异常类型不统一
        raise ConnectorOperationError(f"YAML 解析失败: {exc}") from exc
    if not isinstance(data, dict):
        raise ConnectorOperationError("OpenAPI 文档必须是对象")
    return data


def _base_url_of(spec: dict[str, Any], override: str | None) -> str:
    if override:
        url = override.strip()
        if not url.startswith(("http://", "https://")):
            raise ConnectorOperationError("base_url 必须是 http(s):// 开头")
        return url.rstrip("/")
    servers = spec.get("servers")
    if isinstance(servers, list) and servers and isinstance(servers[0], dict):
        url = str(servers[0].get("url") or "").strip()
        if url:
            if url.startswith("/"):
                raise ConnectorOperationError(
                    "OpenAPI servers[0].url 是相对路径,请在导入时填写完整 base_url"
                )
            return url.rstrip("/")
    # Swagger 2.0
    host = str(spec.get("host") or "").strip()
    if host:
        scheme = (spec.get("schemes") or ["https"])[0]
        base_path = str(spec.get("basePath") or "").rstrip("/")
        return f"{scheme}://{host}{base_path}"
    raise ConnectorOperationError("文档里没有 servers[0].url,请填写 base_url")


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "op"


def _example_from_schema(schema: Any, depth: int = 0) -> Any:
    """按 schema 的 example/default/枚举生成请求体模板(最多 4 层)。"""
    if not isinstance(schema, dict) or depth > 4:
        return {}
    if "example" in schema:
        return schema["example"]
    if "default" in schema:
        return schema["default"]
    enum = schema.get("enum")
    if isinstance(enum, list) and enum:
        return enum[0]
    if schema.get("type") == "array":
        item = _example_from_schema(schema.get("items"), depth + 1)
        return [item] if item != {} else []
    props = schema.get("properties")
    if isinstance(props, dict) and props:
        return {name: _example_from_schema(prop, depth + 1) for name, prop in props.items()}
    return {}


def _query_defaults(parameters: Any) -> dict[str, Any]:
    """从 parameters 抽查询参数:有默认值落值,必填无默认值留占位符。"""
    query: dict[str, Any] = {}
    if not isinstance(parameters, list):
        return query
    for param in parameters:
        if not isinstance(param, dict) or str(param.get("in") or "") != "query":
            continue
        name = str(param.get("name") or "").strip()
        if not name:
            continue
        schema = param.get("schema") if isinstance(param.get("schema"), dict) else {}
        default = schema.get("default") if isinstance(schema, dict) else None
        example = schema.get("example") if isinstance(schema, dict) else None
        if default is not None:
            query[name] = default
        elif example is not None:
            query[name] = example
        elif param.get("required") is True:
            query[name] = "{" + name + "}"
    return query


def _body_template(operation: dict[str, Any]) -> dict[str, Any] | None:
    body = operation.get("requestBody")
    if isinstance(body, dict):
        content = body.get("content")
        if isinstance(content, dict):
            for mime in ("application/json", "application/*+json"):
                media = content.get(mime)
                if isinstance(media, dict):
                    if "example" in media:
                        example = media["example"]
                        return example if isinstance(example, dict) else {"body": example}
                    return _example_from_schema(media.get("schema")) or {}
    # Swagger 2.0
    params = operation.get("parameters")
    if isinstance(params, list):
        for param in params:
            if isinstance(param, dict) and str(param.get("in") or "") == "body":
                schema = param.get("schema")
                return _example_from_schema(schema) or {}
    return None


def _capability_of(method: str, path: str, query: dict[str, Any]) -> str:
    if method.lower() in _WRITE_METHODS:
        return "action"
    if re.search(r"\{[A-Za-z0-9_]+\}", path) and path.count("{") == 1:
        # 只有一个路径参数且没有明显列表语义 → 取单条
        if not query:
            return "fetch"
    if any(str(k).lower() in _SEARCH_HINTS for k in query):
        return "search"
    return "list"


def parse_openapi(
    spec: dict[str, Any], *, base_url: str | None = None
) -> dict[str, Any]:
    """OpenAPI/Swagger dict → {base_url, title, version, operations}。"""
    if not isinstance(spec, dict):
        raise ConnectorOperationError("OpenAPI 文档必须是对象")
    if not isinstance(spec.get("paths"), dict):
        raise ConnectorOperationError("文档缺少 paths,不像是 OpenAPI/Swagger")

    resolved_base = _base_url_of(spec, base_url)
    info = spec.get("info") if isinstance(spec.get("info"), dict) else {}
    title = str(info.get("title") or "")
    version = str(info.get("version") or "")

    operations: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    for path, path_item in spec["paths"].items():
        if not isinstance(path_item, dict) or not str(path).startswith("/"):
            continue
        for method, operation in path_item.items():
            if str(method).lower() not in {"get", "post", "put", "patch", "delete"}:
                continue
            if not isinstance(operation, dict):
                continue
            op_id = str(operation.get("operationId") or "").strip()
            if op_id and re.match(r"^[A-Za-z0-9_.-]{1,64}$", op_id):
                base_id = op_id
            elif op_id:
                base_id = _slug(op_id)[:56]
            else:
                base_id = f"{str(method).lower()}-{_slug(str(path))}"[:56]
            unique = base_id
            index = 2
            while unique in used_ids:
                unique = f"{base_id}-{index}"
                index += 1
            used_ids.add(unique)

            # 合并 path-level 与 operation-level 参数
            params: list[Any] = []
            for source in (path_item.get("parameters"), operation.get("parameters")):
                if isinstance(source, list):
                    params.extend(source)
            query = _query_defaults(params)
            body = _body_template(operation)
            capability = _capability_of(str(method), str(path), query)

            operations.append(
                {
                    "id": unique,
                    "name": str(operation.get("summary") or op_id)[:80],
                    "capability": capability,
                    "method": str(method).upper(),
                    "path": str(path),
                    "query": query,
                    "body": body,
                    "response_path": "",
                    "confirm": capability == "action",
                    "description": str(operation.get("description") or "")[:300],
                }
            )
            if len(operations) >= MAX_OPERATIONS:
                break
        if len(operations) >= MAX_OPERATIONS:
            break

    if not operations:
        raise ConnectorOperationError("文档里没有可导入的 GET/POST/PUT/PATCH/DELETE 操作")

    # 复用统一校验,保证落盘形态与手填一致
    normalized = normalize_operations(operations)
    return {
        "base_url": resolved_base,
        "title": title,
        "version": version,
        "operation_count": len(normalized),
        "operations": normalized,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
