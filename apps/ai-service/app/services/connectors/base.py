# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器能力位与操作定义(2026-11-23 立)。

把连接器从「平台专属的文档读取器」升级为统一的四能力位模型:

- ``list``   列出数据条目(消息列表 / 通讯录 / 表格记录 / 文件列表)
- ``search`` 按关键词或条件检索
- ``fetch``  拉取单条正文或详情
- ``action`` 执行写操作(发送消息 / 建文档 / 写表 / 提交审批)

一份连接器记录 = 配置(record) + 一组声明式操作定义(operations)。
预置平台模板见 ``catalog.py``;用户自定义接入走 ``custom_http.py``,
OpenAPI 文档导入走 ``openapi_import.py``。

本模块只做数据形状与校验,不触网、不落盘 —— 执行层在 custom_http。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# 能力位(前端与路由都引这一份,不得在别处再写字符串字面量)
CAPABILITIES: tuple[str, ...] = ("list", "search", "fetch", "action")

# 允许的 HTTP 方法
HTTP_METHODS: tuple[str, ...] = ("GET", "POST", "PUT", "PATCH", "DELETE")

# 单连接器操作数上限(防用户导入超大 OpenAPI 撑爆存储与界面)。
# 这是**自定义 / OpenAPI 导入连接器**的硬上限,保存校验与导入截断都只认这一份。
MAX_OPERATIONS = 200

# 全量目录(台账)覆盖走「分域分片」:同一业务域优先不跨片,每片操作数 ≤ SHARD_SIZE。
# 分片尺寸直接复用 MAX_OPERATIONS —— 片落成连接器后仍落在既有单连接器上限内,
# 不另立第二档阈值(避免两个上限漂移)。
SHARD_SIZE = MAX_OPERATIONS

# 单次探测的操作数上限(与单连接器上限同档);默认每批探测条数。
MAX_PROBE_LIMIT = MAX_OPERATIONS
DEFAULT_PROBE_LIMIT = 50

# 操作 id 允许字符(字母数字下划线连字符点)
_OP_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")

# 路径模板占位符 {name}
_PATH_PARAM_RE = re.compile(r"\{([A-Za-z0-9_]+)\}")

# 鉴权方式:平台 token 类由执行层用 app_id/app_secret 换取
AUTH_KINDS: tuple[str, ...] = (
    "none",
    "bearer",
    "header",
    "basic",
    "query",
    "feishu_tenant",
    "feishu_user",  # 飞书用户 OAuth user_access_token(connector_oauth 授权后注入)
    "dingtalk_user",  # 钉钉用户 OAuth userAccessToken(connector_oauth 授权后注入)
    "wecom_corp",
    "dingtalk",
    "wechat_mp",
)

# 连接器模式:预置平台 / 自定义 HTTP
CONNECTOR_MODES: tuple[str, ...] = ("preset", "custom")


class ConnectorOperationError(ValueError):
    """操作定义非法(路由层转 400,不落盘)。"""


@dataclass
class ConnectorOperation:
    """一条声明式操作定义。

    字段语义:
        id            操作标识(连接器内唯一,前端按它发起调用)
        name          展示名
        capability    能力位(见 CAPABILITIES)
        method        HTTP 方法
        path          相对 base_url 的路径,可含 ``{param}`` 占位符
        query         默认查询参数;值可含 ``{param}`` 占位符
        body          请求体模板;字符串值可含 ``{param}`` 占位符
        response_path 从响应 JSON 取值的点路径(如 ``data.items``),空=整个响应
        confirm       写操作是否需要前端二次确认(action 恒为 True)
        disabled      是否默认停用(台账生成的写操作默认 True,需显式 opt-in)
        base_url      该操作独立基址(台账 base_url_override);空串用连接器 spec 基址
        description   说明文案
    """

    id: str
    name: str = ""
    capability: str = "list"
    method: str = "GET"
    path: str = ""
    base_url: str = ""
    query: dict[str, Any] = field(default_factory=dict)
    body: dict[str, Any] | None = None
    response_path: str = ""
    confirm: bool = False
    disabled: bool = False
    description: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name or self.id,
            "capability": self.capability,
            "method": self.method,
            "path": self.path,
            "base_url": self.base_url,
            "query": dict(self.query),
            "body": self.body,
            "response_path": self.response_path,
            "confirm": bool(self.confirm or self.capability == "action"),
            "disabled": bool(self.disabled),
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, raw: Any) -> ConnectorOperation:
        if not isinstance(raw, dict):
            raise ConnectorOperationError("操作定义必须是对象")
        op = cls(
            id=str(raw.get("id") or "").strip(),
            name=str(raw.get("name") or "").strip(),
            capability=str(raw.get("capability") or "list").strip(),
            method=str(raw.get("method") or "GET").strip().upper(),
            path=str(raw.get("path") or "").strip(),
            base_url=str(raw.get("base_url") or "").strip(),
            query=dict(raw.get("query") or {}) if isinstance(raw.get("query"), dict) else {},
            body=raw.get("body") if isinstance(raw.get("body"), dict) else None,
            response_path=str(raw.get("response_path") or "").strip(),
            confirm=bool(raw.get("confirm")),
            disabled=bool(raw.get("disabled")),
            description=str(raw.get("description") or "").strip(),
        )
        op.validate()
        return op

    def validate(self) -> None:
        """就地校验;非法抛 ConnectorOperationError。"""
        if not _OP_ID_RE.match(self.id):
            raise ConnectorOperationError(f"操作 id 非法: {self.id!r}(仅字母数字 _ . -)")
        if self.capability not in CAPABILITIES:
            raise ConnectorOperationError(f"能力位非法: {self.capability}")
        if self.method not in HTTP_METHODS:
            raise ConnectorOperationError(f"HTTP 方法非法: {self.method}")
        if not self.path.startswith("/"):
            raise ConnectorOperationError("操作 path 必须以 / 开头(相对 base_url)")
        if "://" in self.path:
            raise ConnectorOperationError("操作 path 不得是绝对 URL")
        if self.capability == "action" and self.method == "GET":
            raise ConnectorOperationError("写操作(action)不得用 GET")
        if self.response_path and not re.match(r"^[A-Za-z0-9_.\[\]-]+$", self.response_path):
            raise ConnectorOperationError(f"response_path 非法: {self.response_path}")


@dataclass
class ConnectorSpec:
    """自定义 / 平台连接器的传输配置。

    凭据不在这里:``app_id`` / ``app_secret`` / ``extra.token`` 仍走
    connector_store 的加密落盘;本结构只描述「怎么发请求」。
    """

    base_url: str = ""
    auth_kind: str = "none"
    auth_name: str = "Authorization"
    auth_scheme: str = "Bearer"
    headers: dict[str, str] = field(default_factory=dict)
    timeout_s: float = 15.0
    max_response_bytes: int = 5_000_000
    allow_write: bool = False
    allow_private_hosts: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "base_url": self.base_url,
            "auth_kind": self.auth_kind,
            "auth_name": self.auth_name,
            "auth_scheme": self.auth_scheme,
            "headers": dict(self.headers),
            "timeout_s": self.timeout_s,
            "max_response_bytes": self.max_response_bytes,
            "allow_write": self.allow_write,
            "allow_private_hosts": self.allow_private_hosts,
        }

    @classmethod
    def from_dict(cls, raw: Any) -> ConnectorSpec:
        if raw is None:
            return cls()
        if not isinstance(raw, dict):
            raise ConnectorOperationError("spec 必须是对象")
        spec = cls(
            base_url=str(raw.get("base_url") or "").strip(),
            auth_kind=str(raw.get("auth_kind") or "none").strip(),
            auth_name=str(raw.get("auth_name") or "Authorization").strip() or "Authorization",
            auth_scheme=str(raw.get("auth_scheme") or "Bearer").strip(),
            headers={
                str(k): str(v)
                for k, v in (raw.get("headers") or {}).items()
                if str(k).strip()
            }
            if isinstance(raw.get("headers"), dict)
            else {},
            timeout_s=_clamp_float(raw.get("timeout_s"), 1.0, 60.0, 15.0),
            max_response_bytes=_clamp_int(
                raw.get("max_response_bytes"), 1024, 20_000_000, 5_000_000
            ),
            allow_write=bool(raw.get("allow_write")),
            allow_private_hosts=bool(raw.get("allow_private_hosts")),
        )
        spec.validate()
        return spec

    def validate(self) -> None:
        if self.base_url and not self.base_url.startswith(("http://", "https://")):
            raise ConnectorOperationError("base_url 必须是 http(s):// 开头")
        if self.auth_kind not in AUTH_KINDS:
            raise ConnectorOperationError(f"鉴权方式非法: {self.auth_kind}")
        forbidden = {"host", "content-length", "content-type", "connection", "transfer-encoding"}
        bad = {k for k in self.headers if k.lower() in forbidden}
        if bad:
            raise ConnectorOperationError(f"禁止自定义请求头: {sorted(bad)}")
        if self.auth_name.lower() in forbidden:
            raise ConnectorOperationError(f"禁止把鉴权放在请求头 {self.auth_name}")


def normalize_operations(raw_ops: Any) -> list[dict[str, Any]]:
    """把请求里的操作清单规范成落盘形态(id 去重、上限、逐条校验)。"""
    if raw_ops is None:
        return []
    if not isinstance(raw_ops, list):
        raise ConnectorOperationError("operations 必须是数组")
    if len(raw_ops) > MAX_OPERATIONS:
        raise ConnectorOperationError(f"操作数超过上限 {MAX_OPERATIONS}")
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for raw in raw_ops:
        op = ConnectorOperation.from_dict(raw)
        if op.id in seen:
            raise ConnectorOperationError(f"操作 id 重复: {op.id}")
        seen.add(op.id)
        result.append(op.to_dict())
    return result


def capability_summary(operations: list[dict[str, Any]]) -> dict[str, bool]:
    """由操作清单推导能力位布尔表(前端徽章用)。"""
    present = {str(o.get("capability") or "") for o in operations if isinstance(o, dict)}
    return {cap: cap in present for cap in CAPABILITIES}


def path_param_names(path: str) -> list[str]:
    """抽出路径模板里的占位符名(按出现顺序去重)。"""
    return list(dict.fromkeys(_PATH_PARAM_RE.findall(path or "")))


def _clamp_int(value: Any, low: int, high: int, default: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, n))


def _clamp_float(value: Any, low: float, high: float, default: float) -> float:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, f))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
