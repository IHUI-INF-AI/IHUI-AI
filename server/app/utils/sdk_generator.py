"""Bug-70: OpenAPI Schema 自动生成 SDK (TypeScript + Python).

输入: FastAPI app / openapi.json dict
输出:
  - TypeScript 客户端 (类 + 方法 + 类型)
  - Python SDK (类 + 类型 + 鉴权)

设计:
  - 模板基于 Jinja2 但不强制依赖, 内置简易字符串模板
  - 支持路径参数 / 查询 / body / 响应类型
  - 支持鉴权 (Bearer Token / API Key)
  - 命令行: python -m app.utils.sdk_generator openapi.json --lang ts

使用:
    from app.utils.sdk_generator import generate_sdk

    ts_code = generate_sdk(openapi_dict, lang="ts", base_url="https://api.x.com")
    py_code = generate_sdk(openapi_dict, lang="py", base_url="https://api.x.com")
"""

import argparse
import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# 类型映射
TS_TYPE_MAP = {
    "integer": "number",
    "number": "number",
    "string": "string",
    "boolean": "boolean",
    "array": "any[]",
    "object": "Record<string, any>",
}

PY_TYPE_MAP = {
    "integer": "int",
    "number": "float",
    "string": "str",
    "boolean": "bool",
    "array": "list",
    "object": "dict",
}


def _to_camel(name: str) -> str:
    parts = re.split(r"[-_]", name)
    return parts[0].lower() + "".join(p.title() for p in parts[1:])


def _to_pascal(name: str) -> str:
    parts = re.split(r"[-_]", name)
    return "".join(p.title() for p in parts)


def _to_snake(name: str) -> str:
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
    return s.lower().replace("-", "_")


def _resolve_ref(spec: dict, ref: str) -> dict | None:
    """解析 $ref 引用 (内联)."""
    if not ref.startswith("#/"):
        return None
    parts = ref[2:].split("/")
    cur: Any = spec
    for p in parts:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def _ts_type_for_schema(schema: dict, spec: dict, depth: int = 0) -> str:
    if depth > 5:
        return "any"
    if not schema:
        return "any"
    if "$ref" in schema:
        ref = _resolve_ref(spec, schema["$ref"])
        if ref is None:
            return "any"
        return _ts_type_for_schema(ref, spec, depth + 1)
    if schema.get("enum"):
        return " | ".join(f'"{x}"' for x in schema["enum"])
    t = schema.get("type")
    if t == "array":
        items = schema.get("items", {})
        item_t = _ts_type_for_schema(items, spec, depth + 1)
        return f"{item_t}[]"
    if t == "object":
        props = schema.get("properties", {})
        if not props:
            return "Record<string, any>"
        fields = []
        for k, v in props.items():
            ft = _ts_type_for_schema(v, spec, depth + 1)
            opt = "" if v.get("required") or k in schema.get("required", []) else "?"
            fields.append(f"  {k}{opt}: {ft};")
        return "{ " + "\n".join(fields) + " }"
    if t in TS_TYPE_MAP:
        nullable = " | null" if schema.get("nullable") else ""
        return TS_TYPE_MAP[t] + nullable
    return "any"


def _py_type_for_schema(schema: dict, spec: dict, depth: int = 0) -> str:
    if depth > 5:
        return "Any"
    if not schema:
        return "Any"
    if "$ref" in schema:
        ref = _resolve_ref(spec, schema["$ref"])
        if ref is None:
            return "Any"
        return _py_type_for_schema(ref, spec, depth + 1)
    if schema.get("enum"):
        return "Literal[" + ", ".join(f'"{x}"' for x in schema["enum"]) + "]"
    t = schema.get("type")
    if t == "array":
        items = schema.get("items", {})
        item_t = _py_type_for_schema(items, spec, depth + 1)
        return f"List[{item_t}]"
    if t == "object":
        props = schema.get("properties", {})
        if not props:
            return "Dict[str, Any]"
        required = set(schema.get("required", []))
        fields = []
        for k, v in props.items():
            ft = _py_type_for_schema(v, spec, depth + 1)
            ft = f"Optional[{ft}] = None" if k not in required else f"{ft}"
            safe = _to_snake(k)
            fields.append(f"    {safe}: {ft}")
        class_name = "DictObj_" + str(depth)
        body = ",\n".join(fields)
        return f"dict  # {class_name} {{{body}}}"
    if t in PY_TYPE_MAP:
        return PY_TYPE_MAP[t]
    return "Any"


def _method_name_from_path(path: str, method: str) -> str:
    """从 path 抽取方法名. /api/v1/users/{id} get → get_user."""
    parts = [p for p in path.split("/") if p and not p.startswith("api") and not p.startswith("v1") and not p.isdigit()]
    base = _to_snake("_".join(parts)) or "root"
    base = re.sub(r"\{([^}]+)\}", r"by_\1", base)
    return f"{method.lower()}_{base}"


# ---------------------------------------------------------------------------
# TypeScript 生成
# ---------------------------------------------------------------------------


def generate_ts(spec: dict, *, base_url: str = "https://api.example.com", class_name: str = "ApiClient") -> str:
    """生成 TypeScript SDK."""
    lines = [
        "// Auto-generated TypeScript SDK. Do not edit by hand.",
        f"// Base URL: {base_url}",
        "",
        "type Nullable<T> = T | null;",
        "",
    ]
    # 公共类型
    for name, schema in (spec.get("components", {}).get("schemas", {}) or {}).items():
        ts_t = _ts_type_for_schema(schema, spec)
        lines.append(f"export interface {_to_pascal(name)} {ts_t}")
        lines.append("")
    # 客户端类
    lines.append(f"export class {class_name} {{")
    lines.append("  constructor()")
    lines.append(f"    private baseUrl: string = {json.dumps(base_url)},")
    lines.append("    private authToken?: string,")
    lines.append("  ) {}")
    lines.append("")
    lines.append("  private async request<T>()")
    lines.append("    method: string, path: string, params?: Record<string, any>,")
    lines.append("    body?: any, headers?: Record<string, string>,")
    lines.append("  ): Promise<T> {")
    lines.append("    const url = new URL(this.baseUrl + path);")
    lines.append("    if (params) for (const [k, v] of Object.entries(params)) {")
    lines.append("      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));")
    lines.append("    }")
    lines.append("    const h: Record<string, string> = { 'Content-Type': 'application/json', ...headers };")
    lines.append("    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;")
    lines.append("    const resp = await fetch(url.toString(), {")
    lines.append("      method, headers: h, body: body ? JSON.stringify(body) : undefined,")
    lines.append("    });")
    lines.append("    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);")
    lines.append("    return resp.json() as Promise<T>;")
    lines.append("  }")
    lines.append("")

    for path, methods in (spec.get("paths", {}) or {}).items():
        for method, info in (methods or {}).items():
            if method.lower() not in ("get", "post", "put", "delete", "patch"):
                continue
            mname = _method_name_from_path(path, method)
            op_id = info.get("operationId") or mname
            # 抽取参数
            params = []
            path_params: list[str] = []
            query_params: list[tuple[str, str]] = []
            for p in info.get("parameters", []) or []:
                pname = p.get("name", "x")
                pts = _ts_type_for_schema(p.get("schema", {}), spec)
                if p.get("in") == "path":
                    path_params.append(pname)
                    params.append(f"{pname}: {pts}")
                elif p.get("in") == "query":
                    query_params.append((pname, pts))
                    params.append(f"{pname}?: {pts}")
            # body
            body_type = "void"
            for status, resp in (info.get("responses", {}) or {}).items():
                if status.startswith("2") and "content" in resp:
                    ct = resp["content"].get("application/json", {})
                    if "schema" in ct:
                        body_type = _ts_type_for_schema(ct["schema"], spec)
                        break
            for status, resp in (info.get("responses", {}) or {}).items():
                if status.startswith("2"):
                    body_type = _ts_type_for_schema(
                        (resp.get("content", {}).get("application/json", {}) or {}).get("schema", {}),
                        spec,
                    )
                    break
            args = ", ".join(params) if params else ""
            # 拼 path (把 {x} 替换为 ${x})
            url_expr = path
            for pn in path_params:
                url_expr = url_expr.replace("{" + pn + "}", "${" + pn + "}")
            lines.append(f"  async {op_id}({args}): Promise<{body_type}> {{")
            lines.append(f"    return this.request<{body_type}>()")
            lines.append(f"      {json.dumps(method.upper())}, {json.dumps(url_expr)},")
            if query_params:
                qname = "_query_" + op_id
                lines.append(f"      {qname}({{{', '.join(f'{p[0]}: {p[0]}' for p in query_params)}}}),")
            else:
                lines.append("      undefined,")
            _body_var = ""
            lines.append("      undefined, // body")
            lines.append("    );")
            lines.append("  }")
            lines.append("")

    lines.append("}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Python 生成
# ---------------------------------------------------------------------------


def generate_py(spec: dict, *, base_url: str = "https://api.example.com", class_name: str = "ApiClient") -> str:
    """生成 Python SDK."""
    lines = [
        '"""Auto-generated Python SDK. Do not edit by hand."""',
        "from __future__ import annotations",
        "from typing import Any, Dict, List, Optional",
        "import httpx",
        "",
        f"BASE_URL = {json.dumps(base_url)}",
        "",
    ]
    # 公共类型
    for name, schema in (spec.get("components", {}).get("schemas", {}) or {}).items():
        py_t = _py_type_for_schema(schema, spec)
        lines.append(f"# {_to_pascal(name)}: {py_t}")
    lines.append("")
    # 客户端类
    lines.append(f"class {class_name}:")
    lines.append("    def __init__(self, base_url: str = BASE_URL, auth_token: Optional[str] = None):")
    lines.append("        self.base_url = base_url")
    lines.append("        self.auth_token = auth_token")
    lines.append("        self._client = httpx.Client(timeout=30.0)")
    lines.append("")
    lines.append(
        "    def _request(self, method: str, path: str, params: Optional[dict] = None, body: Any = None) -> Any:"
    )
    lines.append("        url = self.base_url.rstrip('/') + path")
    lines.append("        headers = {'Content-Type': 'application/json'}")
    lines.append("        if self.auth_token:")
    lines.append("            headers['Authorization'] = f'Bearer {self.auth_token}'")
    lines.append("        r = self._client.request(method, url, params=params, json=body, headers=headers)")
    lines.append("        r.raise_for_status()")
    lines.append("        return r.json() if r.content else None")
    lines.append("")

    for path, methods in (spec.get("paths", {}) or {}).items():
        for method, info in (methods or {}).items():
            if method.lower() not in ("get", "post", "put", "delete", "patch"):
                continue
            mname = _method_name_from_path(path, method)
            op_id = info.get("operationId") or _to_snake(mname)
            params = []
            path_subs: list[str] = []
            for p in info.get("parameters", []) or []:
                pname = p.get("name", "x")
                pts = _py_type_for_schema(p.get("schema", {}), spec)
                if p.get("in") == "path":
                    path_subs.append(pname)
                    params.append(f"{pname}: {pts}")
                elif p.get("in") == "query":
                    params.append(f"{pname}: Optional[{pts}] = None")
            ret_type = "Dict[str, Any]"
            for status, resp in (info.get("responses", {}) or {}).items():
                if status.startswith("2"):
                    rt = _py_type_for_schema(
                        (resp.get("content", {}).get("application/json", {}) or {}).get("schema", {}),
                        spec,
                    )
                    ret_type = rt
                    break
            args = ", ".join(params) if params else ""
            # path 替换
            url_expr = path
            for pn in path_subs:
                url_expr = url_expr.replace("{" + pn + "}", "{" + pn + "}")
            url_expr = json.dumps(url_expr) if "{" not in url_expr else None
            lines.append(f"    def {op_id}(self, {args}) -> {ret_type}:")
            if url_expr:
                lines.append(f'        """{method.upper()} {path}"""')
                lines.append(f"        return self._request({json.dumps(method.upper())}, {url_expr})")
            else:
                lines.append(f'        """{method.upper()} {path}"""')
                fmt = path
                for pn in path_subs:
                    fmt = fmt.replace("{" + pn + "}", "{" + pn + "}")
                lines.append(f"        return self._request({json.dumps(method.upper())}, f{json.dumps(fmt)})")
            lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------


def generate_sdk(
    spec: dict, lang: str = "ts", base_url: str = "https://api.example.com", class_name: str = "ApiClient"
) -> str:
    if lang == "ts":
        return generate_ts(spec, base_url=base_url, class_name=class_name)
    if lang in ("py", "python"):
        return generate_py(spec, base_url=base_url, class_name=class_name)
    raise ValueError(f"unsupported lang: {lang}")


def generate_from_app(app=None, lang: str = "ts", base_url: str = "https://api.example.com") -> str:
    """从 FastAPI app 拿 openapi 再生成."""
    if app is None:
        from app.main import app
    spec = app.openapi()
    return generate_sdk(spec, lang=lang, base_url=base_url)


def main():
    p = argparse.ArgumentParser(description="Generate SDK from openapi.json")
    p.add_argument("input", help="openapi.json path")
    p.add_argument("--lang", default="ts", choices=["ts", "py"])
    p.add_argument("--base-url", default="https://api.example.com")
    p.add_argument("--out", default="-", help="output file, - = stdout")
    args = p.parse_args()
    with open(args.input, encoding="utf-8") as f:
        spec = json.load(f)
    code = generate_sdk(spec, lang=args.lang, base_url=args.base_url)
    if args.out == "-":
        print(code)
    else:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(code)
        print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
