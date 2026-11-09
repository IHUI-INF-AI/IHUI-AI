# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""成长任务「纯凭据直连平台 HTTP 接口」通用动作执行器(零 GUI/CDP/9229)。

设计要点(机主裁决 + 项目纪律):
- **可插拔动作表**:任务码 → ``list[ActionStep]``。加一个任务只改数据(``register_actions``
  / ``register_action_table(load_action_table(path))``),不改本执行器。契约未定案处留数据接口,
  不在代码里写死某一版报文。
- **受理回执不算成功**:``execute_task_code`` 的 ``ok=True`` 只来自「执行后回读成长任务列表,
  ``progress.current`` 增大或 ``accept_status``/``status`` 真前进」。HTTP 200/code:0 一律不认。
- **凭据不落日志/异常/结果**:只保留长度与 sha256 前 8 位;所有响应片段、URL、异常消息均经
  ``redact`` 打码。执行路径不写 logger(仅启动加载动作表失败时记一条无凭据告警)。
- **异常收敛**:任何异常都变成结构化 ``DirectApiResult``,不抛到调度器(fail-closed)。
- **不 import workbuddy_tasks**(防环);凭据由调用方经 ``ctx`` / ``build_context`` 注入,不写死
  本机绝对路径。
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
import time
import uuid
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final, TypedDict

import httpx

__all__ = [
    "ACTION_TABLE",
    "BILLING_BASE_CN",
    "CHAT_ACTION",
    "CHAT_BASE_CN",
    "DEFAULT_ACTION_TABLE",
    "DESKTOP_UA",
    "FALLBACK_KEY",
    "FALLBACK_NOTE",
    "REASON_EXCEPTION",
    "REASON_MARKET_EXPERT_NOT_FOUND",
    "REASON_MISSING_CREDENTIAL",
    "REASON_MISSING_TASK_CODE",
    "REASON_NO_ACTION_STEPS",
    "REASON_NO_PROGRESS_ADVANCE",
    "REASON_OK",
    "REASON_READ_TASKS_FAILED",
    "REASON_STEP_FAILED",
    "REASON_UNREGISTERED",
    "REASON_UNSUPPORTED_KIND",
    "REASON_UNVERIFIED_BLOCKED",
    "WEB_BASE_CN",
    "ActionStep",
    "DesktopChainError",
    "DesktopReportResult",
    "DirectApiContext",
    "DirectApiOptions",
    "DirectApiResult",
    "ReadTasks",
    "RenderedStep",
    "StepExpect",
    "StepTrace",
    "action_step_from_dict",
    "build_context",
    "build_desktop_fingerprint",
    "build_expert_actual_use_event",
    "build_summon_events",
    "credential_fingerprint",
    "execute_task_code",
    "extract_sse_request_id",
    "fetch_market_experts",
    "load_action_table",
    "parse_action_table",
    "parse_task_snapshot",
    "real_chat_with_expert",
    "redact",
    "register_action_table",
    "register_actions",
    "report_desktop",
    "reset_action_table",
    "resolve_steps",
    "run_desktop_expert_task",
]

# ---------------------------------------------------------------------------
# 常量 / 结果 reason 枚举(供钩子判断回落、供单测断言)
# ---------------------------------------------------------------------------

FALLBACK_KEY: Final = "__fallback__"
DEFAULT_HOST: Final = "https://www.workbuddy.cn"
DEFAULT_DOMAIN: Final = "www.workbuddy.cn"

# WorkBuddy 三个 base 的分工(CN realm,二进制常量已核实;2026-11-09 实测):
#   chatBase    copilot.tencent.com  ← desktop 口径 /v2/report、/v2/chat/completions、
#                                      市场专家列表、mp(小程序)领奖
#   billingBase codebuddy.cn         ← CLI 活跃上报(ReportChatActivity)
#   webBase     workbuddy.cn         ← 任务列表 / web 领奖
CHAT_BASE_CN: Final = "https://copilot.tencent.com"
BILLING_BASE_CN: Final = "https://www.codebuddy.cn"
WEB_BASE_CN: Final = "https://www.workbuddy.cn"

DESKTOP_UA: Final = "WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1"
DESKTOP_IDE_VERSION: Final = "5.5.6"
DESKTOP_PAGE_URL: Final = (
    "/C:/Program%20Files/WorkBuddy/resources/app.asar/renderer/index.html"
)
DESKTOP_REPORT_PATH: Final = "/v2/report"
DESKTOP_CHAT_PATH: Final = "/v2/chat/completions"
MARKET_EXPERT_LIST_PATH: Final = "/portal/operation-platform/market/expert/list"
_MAX_SSE_CHARS: Final = 1 << 20

REASON_OK: Final = "ok"
REASON_UNREGISTERED: Final = "unregistered_task_code"
REASON_MISSING_CREDENTIAL: Final = "missing_credential"
REASON_READ_TASKS_FAILED: Final = "read_tasks_failed"
REASON_STEP_FAILED: Final = "step_failed"
REASON_NO_ACTION_STEPS: Final = "no_action_steps"
REASON_NO_PROGRESS_ADVANCE: Final = "no_progress_advance"
REASON_EXCEPTION: Final = "exception"
REASON_UNVERIFIED_BLOCKED: Final = "unverified_action_blocked"
# desktop_expert 链专用 reason(动作表 kind != http 时,通用执行器零出站拒跑)
REASON_UNSUPPORTED_KIND: Final = "action_kind_requires_desktop_runner"
REASON_MISSING_TASK_CODE: Final = "missing_task_code"
REASON_MARKET_EXPERT_NOT_FOUND: Final = "market_expert_not_found"

FALLBACK_NOTE: Final = (
    "未登记任务码回落到 __fallback__;空表⇒无动作⇒返回 unregistered_task_code,由调用方"
    "决定是否回落原行为。新增任务只需 register_actions(code, steps) 或"
    " register_action_table(load_action_table(path)),不改执行器。"
)

_DONE_STATUSES: Final = frozenset(
    {"claimed", "done", "finished", "completed", "accepted", "rewarded"}
)
_PLACEHOLDER_RE: Final = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")
_RE_BEARER: Final = re.compile(r"Bearer\s+\S+", re.IGNORECASE)
_RE_JWT: Final = re.compile(r"eyJ[A-Za-z0-9_\-\.]{20,}")
_RE_HEX32: Final = re.compile(r"\b[A-Fa-f0-9]{32}\b")
# SSE 服务端 requestId 提取（响应头样式行 / data: 帧 / SSE id: 行）
_RE_SSE_HEADER_RID: Final = re.compile(r"(?im)^\s*x-request-id\s*:\s*(\S+)\s*$")
_RE_SSE_DATA: Final = re.compile(r"(?m)^\s*data\s*:\s*(.+)$")
_RE_SSE_ID: Final = re.compile(r"(?m)^\s*id\s*:\s*(\S+)\s*$")

# ---------------------------------------------------------------------------
# 上下文(至少含 uid/domain/access_token/request_id/conversation_id/task_code/expert_id/host)
# ---------------------------------------------------------------------------


class DirectApiContext(TypedDict, total=False):
    """``ActionStep.render`` / ``execute_task_code`` 的上下文键契约。

    total=False:允许调用方只带部分键,执行器会补默认值;缺失的动态占位符由
    ``_RenderValues`` 生成(``{uuid}``/``{message_id}`` 等),未知键渲染为空串。
    """

    uid: str
    domain: str
    access_token: str
    request_id: str
    conversation_id: str
    task_code: str
    expert_id: str
    host: str
    message_id: str


class _RenderValues(dict[str, str]):
    """占位符取值表:动态键按需生成 uuid,未知键返回空串(不抛 KeyError)。"""

    def __missing__(self, key: str) -> str:
        if key in {"uuid", "message_id", "request_id", "conversation_id", "nonce"}:
            value = str(uuid.uuid4())
            self[key] = value
            return value
        return ""


ReadTasks = Callable[[], Awaitable[Any]]
"""回读成长任务列表的回调:返回原始 envelope(dict)或任务行数组,由 ``parse_task_snapshot`` 解析。"""


# ---------------------------------------------------------------------------
# 动作表数据结构
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class StepExpect:
    """单步预期:HTTP 状态集、是否按 SSE 流消费、流终止标记。"""

    ok_status: tuple[int, ...] = (200,)
    sse: bool = False
    done_marker: str = "[DONE]"


@dataclass(frozen=True, slots=True)
class RenderedStep:
    """``ActionStep.render`` 产物:可直接交给 httpx 的一步。"""

    method: str
    url: str
    headers: dict[str, str]
    body: Any
    expect: StepExpect


@dataclass(frozen=True, slots=True)
class ActionStep:
    """通用动作步骤。模板里的 ``{key}`` 占位符按 ``ctx`` 递归渲染。

    - ``url_template`` 以 ``/`` 开头时自动前置 ``{host}``;也可写完整 ``https://`` URL。
    - ``headers_extra`` / ``body_template`` 中的字符串值支持占位符;非字符串(布尔/数字)原样保留。
    - 其余未登记任务码留空表,由后续数据填充,无需改本执行器。
    """

    method: str = "GET"
    url_template: str = ""
    headers_extra: dict[str, str] = field(default_factory=dict)
    body_template: Any = None
    expect: StepExpect = field(default_factory=StepExpect)
    verified: bool = False
    # kind="http":通用执行器可直接跑;其余(desktop_expert / claim)只是能力登记,
    # 由专用 runner 消费,``execute_task_code`` 见到即零出站拒跑(不猜报文)。
    kind: str = "http"
    spec: dict[str, Any] = field(default_factory=dict)

    def render(self, ctx: Mapping[str, Any]) -> RenderedStep:
        values = _RenderValues(
            {str(k): ("" if v is None else str(v)) for k, v in ctx.items()}
        )
        url_tpl = self.url_template
        if url_tpl.startswith("/"):
            url_tpl = "{host}" + url_tpl
        headers = {
            str(k): str(_render_value(v, values))
            for k, v in self.headers_extra.items()
        }
        return RenderedStep(
            method=str(_render_value(self.method, values)).upper(),
            url=str(_render_value(url_tpl, values)),
            headers=headers,
            body=_render_value(self.body_template, values),
            expect=self.expect,
        )


def _render_value(value: Any, values: _RenderValues) -> Any:
    """递归渲染模板:仅替换 ``{identifier}`` 形态占位符,不误伤普通花括号。"""
    if isinstance(value, str):
        return _PLACEHOLDER_RE.sub(lambda match: values[match.group(1)], value)
    if isinstance(value, Mapping):
        return {str(k): _render_value(v, values) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_render_value(v, values) for v in value]
    return value


_STEP_CORE_KEYS: Final = frozenset(
    {
        "method",
        "url_template",
        "headers_extra",
        "body_template",
        "expect",
        "verified",
        "kind",
        "spec",
    }
)


def action_step_from_dict(raw: Mapping[str, Any]) -> ActionStep:
    """把 JSON/字典形态的一步转成 ``ActionStep``(供 ``load_action_table`` 使用)。

    非 ``http`` 步骤的其余字段原样进 ``spec``(例如 ``desktop_expert`` 的专家绑定、
    ``claim`` 的 ``auto_claim``),保证动作表自描述、不丢数据。
    """
    expect_raw = raw.get("expect") or {}
    if not isinstance(expect_raw, Mapping):
        expect_raw = {}
    status_raw = expect_raw.get("ok_status", [200])
    statuses = tuple(int(s) for s in status_raw) if isinstance(status_raw, (list, tuple)) else (200,)
    expect = StepExpect(
        ok_status=statuses,
        sse=bool(expect_raw.get("sse", False)),
        done_marker=str(expect_raw.get("done_marker", "[DONE]")),
    )
    headers_raw = raw.get("headers_extra") or {}
    headers = (
        {str(k): str(v) for k, v in headers_raw.items()}
        if isinstance(headers_raw, Mapping)
        else {}
    )
    spec_raw = raw.get("spec")
    spec: dict[str, Any] = (
        {str(k): v for k, v in spec_raw.items()} if isinstance(spec_raw, Mapping) else {}
    )
    if not spec:
        spec = {str(k): v for k, v in raw.items() if str(k) not in _STEP_CORE_KEYS}
    return ActionStep(
        method=str(raw.get("method", "GET")),
        url_template=str(raw.get("url_template", "")),
        headers_extra=headers,
        body_template=raw.get("body_template"),
        expect=expect,
        verified=bool(raw.get("verified", False)),
        kind=str(raw.get("kind", "http")),
        spec=spec,
    )


# ---------------------------------------------------------------------------
# 动作表:内置已确证的 chat 基线 + __fallback__;其余任务码往表里加数据即可
# ---------------------------------------------------------------------------

CHAT_ACTION: Final = ActionStep(
    method="POST",
    url_template="{host}/v2/chat/completions",
    headers_extra={
        "Authorization": "Bearer {access_token}",
        "Content-Type": "application/json",
        "X-User-Id": "{uid}",
        "x-user-id": "{uid}",
        "X-Domain": "{domain}",
        "X-Conversation-Request-ID": "{request_id}",
        "X-Conversation-Message-ID": "{message_id}",
        "User-Agent": "WorkBuddy/5.5.6",
        "Accept": "application/json, text/event-stream",
    },
    body_template={
        "model": "hy3-x",
        "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己。"}],
        "stream": True,
        "max_tokens": 16,
    },
    expect=StepExpect(ok_status=(200,), sse=True, done_marker="[DONE]"),
    verified=True,
)

DEFAULT_ACTION_TABLE: Final[dict[str, list[ActionStep]]] = {
    # 已实证可达(200 SSE),但单独打 chat 不触发成长计分 —— 作为连通性基线保留,
    # 结果仍以回读判定为准(no_progress_advance)。
    "chat": [CHAT_ACTION],
    # 说明见 FALLBACK_NOTE:空表 = 未登记,交给调用方回落原行为。
    FALLBACK_KEY: [],
}

ACTION_TABLE: dict[str, list[ActionStep]] = {
    code: list(steps) for code, steps in DEFAULT_ACTION_TABLE.items()
}


def register_actions(task_code: str, steps: Iterable[ActionStep]) -> None:
    """登记/覆盖某任务码的动作链(加一个任务只加数据)。"""
    ACTION_TABLE[task_code] = list(steps)


def register_action_table(table: Mapping[str, Iterable[ActionStep]]) -> None:
    """整体替换运行时动作表(配合 ``load_action_table`` 做 JSON 覆盖)。"""
    ACTION_TABLE.clear()
    ACTION_TABLE.update({str(code): list(steps) for code, steps in table.items()})


def reset_action_table() -> None:
    """恢复为内置默认动作表(单测/灰度收口用)。"""
    ACTION_TABLE.clear()
    ACTION_TABLE.update({code: list(steps) for code, steps in DEFAULT_ACTION_TABLE.items()})


def resolve_steps(task_code: str) -> list[ActionStep] | None:
    """查动作表;``None`` = 未登记(调用方据此回落原行为)。"""
    if task_code in ACTION_TABLE and task_code != FALLBACK_KEY:
        return list(ACTION_TABLE[task_code])
    fallback = ACTION_TABLE.get(FALLBACK_KEY) or []
    if fallback:
        return list(fallback)
    return None


def parse_action_table(raw: Any) -> dict[str, list[ActionStep]]:
    """把 JSON 对象 ``{task_code: [step, ...]}`` 解析成动作表(不改执行器)。"""
    if not isinstance(raw, Mapping):
        raise ValueError("ACTION_TABLE JSON 顶层须为对象 {task_code: [step, ...]}")
    table: dict[str, list[ActionStep]] = {}
    for code, steps in raw.items():
        if not isinstance(steps, (list, tuple)):
            raise ValueError(f"任务码 {code!r} 的动作须为数组")
        parsed: list[ActionStep] = []
        for step in steps:
            if not isinstance(step, Mapping):
                raise ValueError(f"任务码 {code!r} 含非对象 step")
            parsed.append(action_step_from_dict(step))
        table[str(code)] = parsed
    return table


def load_action_table(path: str | os.PathLike[str]) -> dict[str, list[ActionStep]]:
    """从 JSON 文件读入动作表(路径由调用方给,本模块不写死本机绝对路径)。"""
    with open(path, encoding="utf-8") as handle:
        raw: Any = json.load(handle)
    return parse_action_table(raw)


# ---------------------------------------------------------------------------
# SSE 服务端 requestId 提取（供 chat→report 两步链回填 ctx，纯函数）
# ---------------------------------------------------------------------------


def extract_sse_request_id(chunks: Iterable[str] | str) -> str:
    """从 SSE 文本提取服务端签发的 requestId（纯函数、不抛异常、无副作用）。

    依次尝试：``X-Request-Id`` 响应头样式行、``data:`` 帧 JSON 里的
    ``requestId`` / ``request_id`` / ``id``、SSE ``id:`` 行。取不到返回空串。

    与 ``ctx["request_id"]``（客户端自生成 UUID）不同：此值来自平台在真实
    ``/v2/chat/completions`` SSE 流里下发，必须原样带入事件上报的 requestId。
    """
    parts = [chunks] if isinstance(chunks, str) else list(chunks)
    text = "\n".join(parts)
    # 优先 SSE data: 帧（服务端签发的真 requestId）；响应头 X-Request-Id 仅兜底。
    for payload in _RE_SSE_DATA.findall(text):
        raw = str(payload).strip()
        if not raw or raw == "[DONE]":
            continue
        try:
            obj: Any = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if isinstance(obj, Mapping):
            for key in ("requestId", "request_id", "id"):
                value = obj.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
    match = _RE_SSE_ID.search(text)
    if match:
        rid = str(match.group(1))
        if rid:
            return rid
    match = _RE_SSE_HEADER_RID.search(text)
    if match:
        rid = str(match.group(1))
        if rid and rid != "[DONE]":
            return rid
    return ""


# ---------------------------------------------------------------------------
# 脱敏 / 凭据指纹 / 上下文构造
# ---------------------------------------------------------------------------


def redact(value: Any, secrets: Iterable[str] = ()) -> str:
    """输出脱敏:先抹掉明文密钥,再打码 Bearer/JWT/32 位 hex。"""
    text = "" if value is None else str(value)
    for secret in sorted((s for s in secrets if s), key=len, reverse=True):
        text = text.replace(secret, "<REDACTED>")
    text = _RE_BEARER.sub("Bearer <REDACTED>", text)
    text = _RE_JWT.sub("<JWT>", text)
    text = _RE_HEX32.sub("<HEX32>", text)
    return text


def credential_fingerprint(access_token: str) -> dict[str, Any]:
    """凭据唯一允许的落盘形态:长度 + sha256 前 8 位(不含明文)。"""
    token = access_token or ""
    return {
        "token_len": len(token),
        "token_sha256_8": hashlib.sha256(token.encode("utf-8")).hexdigest()[:8],
    }


def _collect_secrets(ctx: Mapping[str, Any]) -> tuple[str, ...]:
    out: list[str] = []
    for key, value in ctx.items():
        if any(w in key.lower() for w in ("token", "secret", "cookie", "authorization", "password")):
            if isinstance(value, str) and value:
                out.append(value)
    return tuple(out)


def _jwt_payload(access_token: str) -> dict[str, Any]:
    """解 JWT payload 取 uid/domain(不校验签名,取不到返回空)。"""
    parts = (access_token or "").strip().split(".")
    if len(parts) < 2:
        return {}
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        decoded: Any = json.loads(base64.urlsafe_b64decode(padded))
    except Exception:  # noqa: BLE001 — 非 JWT/畸形串 ⇒ 未判定,返回空
        return {}
    return dict(decoded) if isinstance(decoded, Mapping) else {}


def build_context(
    access_token: str,
    device_map: Mapping[str, Any] | None = None,
    task_code: str = "",
    *,
    host: str = DEFAULT_HOST,
    domain: str | None = None,
    expert_id: str = "",
) -> dict[str, Any]:
    """由凭据 + device_map 构造 ctx(uid 优先 device_map,回退 JWT sub;domain 取 claims.domain)。"""
    dm = device_map or {}
    claims = _jwt_payload(access_token)
    uid = ""
    for key in ("uid", "user_id", "userId"):
        value = dm.get(key)
        if isinstance(value, (str, int)) and str(value).strip():
            uid = str(value).strip()
            break
    if not uid:
        for key in ("sub", "uid", "user_id", "userId", "id"):
            value = claims.get(key)
            if isinstance(value, (str, int)) and str(value).strip():
                uid = str(value).strip()
                break
    resolved_domain = domain or str(claims.get("domain") or "") or DEFAULT_DOMAIN
    return {
        "uid": uid,
        "domain": resolved_domain,
        "access_token": access_token,
        "request_id": str(uuid.uuid4()),
        "conversation_id": str(uuid.uuid4()),
        "message_id": str(uuid.uuid4()),
        "task_code": task_code,
        "expert_id": expert_id,
        "host": host.rstrip("/"),
    }


# ---------------------------------------------------------------------------
# 结果结构
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class StepTrace:
    """单步留痕(全部脱敏,不含请求头/凭据)。"""

    index: int
    method: str
    url: str
    http_status: int | None
    response_excerpt: str
    ok: bool
    error: str = ""


@dataclass(frozen=True, slots=True)
class DirectApiResult:
    """结构化结果:``ok`` 只由回读前进判定,凭据仅以 fingerprint 形态出现。

    ``outbound``:脱敏后的出站摘要(host+path+事件码+条数),用于事后审计;永不含 token。
    """

    ok: bool
    reason: str
    task_code: str
    steps: tuple[StepTrace, ...] = ()
    credential_fingerprint: dict[str, Any] = field(default_factory=dict)
    before: dict[str, dict[str, Any]] | None = None
    after: dict[str, dict[str, Any]] | None = None
    error: str = ""
    outbound: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class DirectApiOptions:
    """执行选项:超时 / 重试上限 / 回读轮询(全部保守默认,写侧默认关由上层开关把守)。"""

    timeout: float = 30.0
    max_retries: int = 1
    max_response_chars: int = 2048
    verify_attempts: int = 1
    verify_interval: float = 0.0
    allow_unverified: bool = False


# ---------------------------------------------------------------------------
# 回读解析 + 前进判定(受理回执绝不参与)
# ---------------------------------------------------------------------------


def _task_rows(raw: Any) -> list[Any]:
    """从多种 envelope 形态里取出任务行数组(data / data.tasks / tasks / list ...)。"""
    if isinstance(raw, (list, tuple)):
        return [row for row in raw if isinstance(row, Mapping)]
    if not isinstance(raw, Mapping):
        return []
    candidates: list[Any] = [raw.get("data"), raw]
    for candidate in candidates:
        if isinstance(candidate, (list, tuple)):
            return [row for row in candidate if isinstance(row, Mapping)]
        if not isinstance(candidate, Mapping):
            continue
        for key in ("tasks", "list", "items", "rows"):
            value = candidate.get(key)
            if isinstance(value, (list, tuple)):
                return [row for row in value if isinstance(row, Mapping)]
    return []


def _progress_current(task: Mapping[str, Any]) -> float | None:
    progress = task.get("progress")
    value = progress.get("current") if isinstance(progress, Mapping) else progress
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip().isdigit():
        return float(value.strip())
    return None


def parse_task_snapshot(raw: Any) -> dict[str, dict[str, Any]] | None:
    """把任务列表归一化成 ``{task_code: {progress_current, accept_status, status}}``。

    取不到任何任务行 ⇒ None(未判定,不拿空对象冒充「没进度」)。
    """
    rows = _task_rows(raw)
    snapshot: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        code = row.get("task_code") or row.get("code")
        if not isinstance(code, str) or not code:
            continue
        snapshot[code] = {
            "progress_current": _progress_current(row),
            "accept_status": row.get("accept_status"),
            "status": row.get("status"),
        }
    return snapshot or None


def _status_of(snapshot: dict[str, Any]) -> str:
    for key in ("accept_status", "status"):
        value = snapshot.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    return ""


def _progress_advanced(
    before: dict[str, dict[str, Any]] | None,
    after: dict[str, dict[str, Any]] | None,
    task_code: str,
) -> bool:
    """真前进判据:progress.current 增大,或业务态进入完成态/发生非空变化。"""
    if not before or not after:
        return False
    b = before.get(task_code)
    a = after.get(task_code)
    if b is None or a is None:
        return False
    bp, ap = b.get("progress_current"), a.get("progress_current")
    if isinstance(bp, (int, float)) and isinstance(ap, (int, float)) and ap > bp:
        return True
    bs, as_ = _status_of(b), _status_of(a)
    if as_ in _DONE_STATUSES and as_ != bs:
        return True
    return bool(as_ and bs and as_ != bs)


# ---------------------------------------------------------------------------
# 单步执行(SSE 流消费 / 幂等键 / 重试上限 / 异常收敛)
# ---------------------------------------------------------------------------


def _idempotency_key(ctx: Mapping[str, Any], task_code: str, index: int) -> str:
    seed = f"{ctx.get('request_id', '')}|{task_code}|{index}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:24]


async def _perform_step(
    client: httpx.AsyncClient,
    step: RenderedStep,
    headers: dict[str, str],
    opt: DirectApiOptions,
    secrets: tuple[str, ...],
    ctx: dict[str, Any] | None = None,
) -> tuple[int | None, str]:
    kwargs: dict[str, Any] = {"headers": headers, "timeout": opt.timeout}
    if step.body is not None:
        kwargs["json"] = step.body
    if not step.expect.sse:
        response = await client.request(step.method, step.url, **kwargs)
        return response.status_code, redact(response.text[: opt.max_response_chars], secrets)

    chunks: list[str] = []
    status: list[int] = []
    header_rid: list[str] = []

    async def _consume() -> None:
        async with client.stream(step.method, step.url, **kwargs) as stream:
            status.append(stream.status_code)
            hdr = stream.headers.get("X-Request-Id") or stream.headers.get("x-request-id")
            if hdr:
                header_rid.append(str(hdr))
            total = 0
            async for chunk in stream.aiter_text():
                cleaned = "".join(
                    line for line in chunk.splitlines(keepends=True)
                    if not line.lstrip().startswith(":")
                )
                chunks.append(cleaned)
                total += len(cleaned)
                if step.expect.done_marker in cleaned or total >= opt.max_response_chars:
                    break

    await asyncio.wait_for(_consume(), timeout=opt.timeout)
    scan = list(chunks)
    if header_rid:
        scan.append(f"X-Request-Id: {header_rid[0]}")
    rid = extract_sse_request_id(scan)
    if rid and ctx is not None:
        ctx["sse_request_id"] = rid
    body = "".join(chunks)[: opt.max_response_chars]
    return (status[0] if status else None), redact(body, secrets)


async def _run_step(
    step: ActionStep,
    ctx: dict[str, Any],
    client: httpx.AsyncClient,
    index: int,
    opt: DirectApiOptions,
    secrets: tuple[str, ...],
) -> StepTrace:
    rendered = step.render(ctx)
    headers = dict(rendered.headers)
    headers.setdefault(
        "X-Idempotency-Key",
        _idempotency_key(ctx, str(ctx.get("task_code") or ""), index),
    )
    last_error = ""
    for attempt in range(opt.max_retries + 1):
        try:
            status, excerpt = await _perform_step(
                client, rendered, headers, opt, secrets, ctx
            )
            ok = status in rendered.expect.ok_status if status is not None else False
            return StepTrace(
                index=index,
                method=rendered.method,
                url=redact(rendered.url, secrets),
                http_status=status,
                response_excerpt=excerpt,
                ok=ok,
            )
        except Exception as exc:  # noqa: BLE001 — 网络/超时/协议异常收敛为结构化失败
            last_error = redact(exc, secrets)
            if attempt >= opt.max_retries:
                break
    return StepTrace(
        index=index,
        method=rendered.method,
        url=redact(rendered.url, secrets),
        http_status=None,
        response_excerpt="",
        ok=False,
        error=last_error,
    )


async def _safe_read(read_tasks: ReadTasks) -> Any:
    try:
        return await read_tasks()
    except Exception:  # noqa: BLE001 — 回读失败按未判定收敛,不抛到调度器
        return None


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------


async def execute_task_code(
    task_code: str,
    ctx: Mapping[str, Any],
    http_client: httpx.AsyncClient,
    read_tasks: ReadTasks,
    *,
    options: DirectApiOptions | None = None,
    allow_unverified: bool | None = None,
) -> DirectApiResult:
    """按 ``ACTION_TABLE[task_code]`` 顺序执行,回读确认业务态真前进才 ``ok=True``。

    任何异常 / 缺凭据 / 未登记 / 步骤失败 / 回读失败 / 无前进都收敛为结构化结果,
    不抛到调度器;受理回执(200/code:0)绝不单独构成成功。默认 ``allow_unverified=False``
    时,动作链只要含未实证 step 就整体 fail-closed(零出站),不把推断报文打到平台。
    """
    opt = options or DirectApiOptions()
    allow = opt.allow_unverified if allow_unverified is None else allow_unverified
    secrets = _collect_secrets(ctx)
    token = str(ctx.get("access_token") or "")
    uid = str(ctx.get("uid") or "")
    fingerprint = credential_fingerprint(token)
    merged: dict[str, Any] = dict(ctx)
    merged.setdefault("task_code", task_code)
    merged.setdefault("host", DEFAULT_HOST)
    merged.setdefault("domain", DEFAULT_DOMAIN)
    merged.setdefault("request_id", str(uuid.uuid4()))
    merged.setdefault("conversation_id", str(uuid.uuid4()))
    merged.setdefault("message_id", str(uuid.uuid4()))
    merged.setdefault("expert_id", "")

    def _result(
        reason: str,
        *,
        ok: bool = False,
        steps: tuple[StepTrace, ...] = (),
        before: dict[str, dict[str, Any]] | None = None,
        after: dict[str, dict[str, Any]] | None = None,
        error: str = "",
    ) -> DirectApiResult:
        return DirectApiResult(
            ok=ok,
            reason=reason,
            task_code=task_code,
            steps=steps,
            credential_fingerprint=fingerprint,
            before=before,
            after=after,
            error=error,
        )

    try:
        if not token or not uid:
            return _result(REASON_MISSING_CREDENTIAL)
        steps = resolve_steps(task_code)
        if steps is None:
            return _result(REASON_UNREGISTERED)
        if not allow and any(not step.verified for step in steps):
            return _result(REASON_UNVERIFIED_BLOCKED)
        foreign = next((step for step in steps if step.kind != "http"), None)
        if foreign is not None:
            # desktop_expert / claim 等专链动作:通用执行器不猜报文,零出站拒跑。
            return _result(
                REASON_UNSUPPORTED_KIND,
                error=f"kind={foreign.kind} 需对应专用 runner(run_desktop_expert_task)",
            )
        before = parse_task_snapshot(await _safe_read(read_tasks))
        if before is None:
            return _result(REASON_READ_TASKS_FAILED)

        traces: list[StepTrace] = []
        for index, step in enumerate(steps):
            trace = await _run_step(step, merged, http_client, index, opt, secrets)
            traces.append(trace)
            if not trace.ok:
                return _result(REASON_STEP_FAILED, steps=tuple(traces), before=before)
        if not steps:
            return _result(REASON_NO_ACTION_STEPS, before=before)

        after: dict[str, dict[str, Any]] | None = None
        for attempt in range(max(1, opt.verify_attempts)):
            if attempt and opt.verify_interval > 0:
                await asyncio.sleep(opt.verify_interval)
            snapshot = parse_task_snapshot(await _safe_read(read_tasks))
            if snapshot is None:
                continue
            after = snapshot
            if _progress_advanced(before, after, task_code):
                break
        if after is None:
            return _result(REASON_READ_TASKS_FAILED, steps=tuple(traces), before=before)
        if _progress_advanced(before, after, task_code):
            return _result(REASON_OK, ok=True, steps=tuple(traces), before=before, after=after)
        return _result(
            REASON_NO_PROGRESS_ADVANCE, steps=tuple(traces), before=before, after=after
        )
    except Exception as exc:  # noqa: BLE001 — 兜底:任何异常都不抛到调度器
        return _result(REASON_EXCEPTION, error=redact(exc, secrets))


# ---------------------------------------------------------------------------
# WorkBuddy desktop 口径事件链(2026-11-09 实测点亮召唤专家类任务)
#   链:市场取真实 version → 真实 chat 拿服务端 requestId → summon×3 + actual_use
#       同一数组 POST {chatBase}/v2/report → 回读 progress 真前进才算完成。
# ---------------------------------------------------------------------------

class DesktopChainError(RuntimeError):
    """desktop 链的可预期失败(HTTP 非 200 / SSE 无服务端 requestId 等)。"""


@dataclass(frozen=True, slots=True)
class DesktopReportResult:
    """``/v2/report`` 的受理回执(仅记录,不构成成功判据)。

    ``outbound``:脱敏出站摘要(host+path+事件码列表+条数);``msg`` 已打码,永不含 token。
    """

    status: int | None
    code: Any
    msg: str
    request_id: str
    event_codes: tuple[str, ...] = ()
    event_count: int = 0
    outbound: str = ""
    error: str = ""


def _now_ms() -> int:
    return int(time.time() * 1000)


def _sha256_36(*parts: str) -> str:
    """sha256(parts 以 ``:`` 连接) 前 36 位 hex:机器/会话标识稳定派生(非随机)。"""
    return hashlib.sha256(":".join(parts).encode("utf-8")).hexdigest()[:36]


def build_desktop_fingerprint(
    uid: str, nickname: str = "", *, now_ms: int | None = None
) -> dict[str, Any]:
    """desktop 公共指纹(对齐客户端 ``desktopFingerprint``);同一 uid 幂等。"""
    now = _now_ms() if now_ms is None else int(now_ms)
    user = str(uid or "")
    nick = str(nickname or "")
    return {
        "timezone": "Asia/Shanghai",
        "reportDelay": 2000,
        "userId": user,
        "username": nick,
        "userNickname": nick,
        "product": "SaaS",
        "releaseDate": 1789036585355,
        "commit": "5f9692923c93033111c51ad7b003eb80204a9b75",
        "ideName": "WorkBuddy",
        "ideType": "WorkBuddy",
        "ideVersion": DESKTOP_IDE_VERSION,
        "machineId": _sha256_36("machine", user),
        "sessionId": _sha256_36("session", user),
        "extName": "workbuddy-desktop",
        "extVersion": DESKTOP_IDE_VERSION,
        "os": "win32",
        "arch": "x64",
        "osVersion": "10.0.26220",
        "cpuCores": 20,
        "memorySize": 24,
        "timestamp": now,
        "presentAt": now,
    }


def _desktop_request_id(uid: str, now_ms: int) -> str:
    """``X-Request-ID``:sha256("req:"+uid)[:36] + 6 位毫秒余数(定长 42)。"""
    return _sha256_36("req", str(uid or "")) + f"{int(now_ms) % 1_000_000:06d}"


def _desktop_headers(token: str, uid: str, now_ms: int) -> dict[str, str]:
    """desktop 口径上报/市场请求头(token 只在内存里,不落任何结果结构)。"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "User-Agent": DESKTOP_UA,
        "X-Domain": CHAT_BASE_CN,
        "X-Product": "SaaS",
        "X-Request-ID": _desktop_request_id(uid, now_ms),
    }
    if uid:
        headers["X-User-Id"] = str(uid)
    return headers


def _expert_field(expert: Mapping[str, Any], *names: str) -> str:
    for name in names:
        value = expert.get(name)
        if isinstance(value, (str, int, float)) and str(value).strip():
            return str(value).strip()
    return ""


def _expert_category(expert: Mapping[str, Any]) -> str:
    """取专家首个 category(字符串或对象形态);缺省 ``expert-all``。"""
    categories = expert.get("categories")
    if isinstance(categories, (list, tuple)):
        for item in categories:
            if isinstance(item, str) and item.strip():
                return item.strip()
            if isinstance(item, Mapping):
                for key in ("id", "code", "name"):
                    value = item.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
    return "expert-all"


def _expert_version(*sources: Mapping[str, Any] | str) -> str:
    """按优先级取真实 version:市场 > 绑定表 > 默认 1.0.0。

    实测教训:默认 ``1.0.0`` 上报零前进,必须用市场返回值(如 ``1.6.2``)。
    """
    for source in sources:
        if isinstance(source, str):
            if source.strip():
                return source.strip()
            continue
        value = source.get("version")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "1.0.0"


def build_summon_events(
    expert: Mapping[str, Any], version: str = ""
) -> list[dict[str, Any]]:
    """召唤链 3 条事件(web_element_click → expert_summon_click → expert_summoned)。"""
    eid = _expert_field(expert, "expert_id", "id")
    name = _expert_field(expert, "display_name_zh", "name")
    title = _expert_field(expert, "profession_zh", "expertTitle")
    etype = _expert_field(expert, "expert_type") or "agent"
    category = _expert_category(expert)
    ver = _expert_version(version, expert)
    return [
        {
            "eventCode": "web_element_click",
            "source": eid,
            "type": category,
            "version": ver,
            "elementId": "expert_summon_click",
            "elementName": "立即召唤",
            "pageURL": DESKTOP_PAGE_URL,
        },
        {
            "eventCode": "expert_summon_click",
            "id": eid,
            "name": name,
            "expertTitle": title,
            "type": "expert-all",
            "position": 0,
            "expertType": etype,
            "version": ver,
            "mode": "LOCAL",
        },
        {
            "eventCode": "expert_summoned",
            "id": eid,
            "name": name,
            "expertTitle": title,
            "type": "expert-all",
        },
    ]


def build_expert_actual_use_event(
    expert: Mapping[str, Any],
    conversation_id: str,
    request_id: str,
    version: str = "",
    mode: str = "craft",
) -> dict[str, Any]:
    """``expert_actual_use`` 事件:``request_id`` 必须是服务端 SSE 下发的真 id。"""
    eid = _expert_field(expert, "expert_id", "id")
    rid = str(request_id or "")
    return {
        "eventCode": "expert_actual_use",
        "id": eid,
        "name": _expert_field(expert, "display_name_zh", "name"),
        "expertTitle": _expert_field(expert, "profession_zh", "expertTitle"),
        "type": _expert_category(expert),
        "expertType": _expert_field(expert, "expert_type") or "agent",
        "source": "builtin",
        "version": _expert_version(version, expert),
        "cost": 9000,
        "characterCount": 14,
        "conversationId": str(conversation_id or ""),
        "requestId": rid,
        "messageId": "msg-" + (rid[-8:] if len(rid) >= 8 else rid),
        "requestModelId": "fast-model",
        "requestModelName": "fast-model",
        "mode": str(mode or "craft"),
    }


async def report_desktop(
    client: httpx.AsyncClient,
    token: str,
    uid: str,
    nickname: str,
    events: Iterable[Mapping[str, Any]],
    *,
    now_ms: int | None = None,
    timeout: float = 30.0,
) -> DesktopReportResult:
    """把指纹合并进每个事件后,以**数组** body POST ``{chatBase}/v2/report``。

    返回受理回执(status/code/msg/request_id)+ 脱敏出站摘要;异常收敛为空 status。
    """
    now = _now_ms() if now_ms is None else int(now_ms)
    items = [dict(event) for event in events if isinstance(event, Mapping)]
    codes = tuple(str(item.get("eventCode") or "") for item in items)
    request_id = _desktop_request_id(uid, now)
    outbound = (
        f"POST {CHAT_BASE_CN.removeprefix('https://')}{DESKTOP_REPORT_PATH} "
        f"codes={list(codes)} count={len(items)}"
    )
    if not items:
        return DesktopReportResult(
            status=None,
            code=None,
            msg="",
            request_id=request_id,
            event_codes=codes,
            event_count=0,
            outbound=outbound,
            error="no_events",
        )
    fingerprint = build_desktop_fingerprint(uid, nickname, now_ms=now)
    payload = [{**fingerprint, **item} for item in items]
    secrets = (token,) if token else ()
    try:
        response = await client.post(
            CHAT_BASE_CN + DESKTOP_REPORT_PATH,
            headers=_desktop_headers(token, uid, now),
            json=payload,
            timeout=timeout,
        )
    except Exception as exc:  # noqa: BLE001 — 网络/超时收敛为结构化失败
        return DesktopReportResult(
            status=None,
            code=None,
            msg="",
            request_id=request_id,
            event_codes=codes,
            event_count=len(payload),
            outbound=outbound,
            error=redact(exc, secrets),
        )
    body: Any = None
    try:
        body = response.json()
    except (ValueError, TypeError):
        body = None
    code = body.get("code") if isinstance(body, Mapping) else None
    msg = ""
    if isinstance(body, Mapping):
        for key in ("msg", "message", "errmsg"):
            value = body.get(key)
            if isinstance(value, str) and value:
                msg = value
                break
    return DesktopReportResult(
        status=response.status_code,
        code=code,
        msg=redact(msg, secrets),
        request_id=request_id,
        event_codes=codes,
        event_count=len(payload),
        outbound=outbound,
    )


def _market_expert_rows(payload: Any) -> list[dict[str, Any]]:
    """解析市场列表:实证结构是 ``data.experts[]``(不是顶层 experts)。

    只认 ``data.experts`` / ``data`` 为数组两种形态;顶层 ``experts`` 是旧口径,
    解析为空(fail-closed),避免悄无声息地按错结构继续跑。
    """
    rows: Any = None
    if isinstance(payload, Mapping):
        inner = payload.get("data")
        if isinstance(inner, Mapping):
            rows = inner.get("experts")
        elif isinstance(inner, (list, tuple)):
            rows = inner
    elif isinstance(payload, (list, tuple)):
        rows = payload
    if not isinstance(rows, (list, tuple)):
        return []
    return [dict(row) for row in rows if isinstance(row, Mapping)]


async def fetch_market_experts(
    client: httpx.AsyncClient,
    token: str,
    uid: str,
    *,
    expert_type: str = "agent",
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
    timeout: float = 30.0,
) -> list[dict[str, Any]]:
    """拉市场真实专家列表(解析 ``data.experts``);非 200 抛 ``DesktopChainError``。"""
    body: dict[str, Any] = {
        "page": int(page),
        "page_size": int(page_size),
        "sort_by": "reco_rank",
        "sort_order": "desc",
    }
    if expert_type:
        body["expert_type"] = str(expert_type)
    if keyword:
        body["keyword"] = str(keyword)
    response = await client.post(
        CHAT_BASE_CN + MARKET_EXPERT_LIST_PATH,
        headers=_desktop_headers(token, uid, _now_ms()),
        json=body,
        timeout=timeout,
    )
    if response.status_code != 200:
        raise DesktopChainError(f"expert market http {response.status_code}")
    try:
        payload: Any = response.json()
    except (ValueError, TypeError) as exc:
        raise DesktopChainError("expert market 响应非 JSON") from exc
    return _market_expert_rows(payload)


def _parse_sse_data_line(line: str) -> tuple[str, bool]:
    """解析单行 SSE:返回 ``(requestId, 是否 [DONE])``。

    注释行(``:`` 开头)、空行、心跳、非 JSON 行一律跳过;不抛异常。
    """
    text = line.strip()
    if not text or text.startswith(":"):
        return "", False
    if not text.startswith("data:"):
        return "", False
    payload = text[len("data:") :].strip()
    if not payload:
        return "", False
    if payload == "[DONE]":
        return "", True
    try:
        obj: Any = json.loads(payload)
    except (ValueError, TypeError):
        return "", False
    if not isinstance(obj, Mapping):
        return "", False
    for key in ("id", "requestId", "request_id"):
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip(), False
    return "", False


async def real_chat_with_expert(
    client: httpx.AsyncClient,
    token: str,
    uid: str,
    expert_id: str,
    *,
    model: str = "fast-model",
    timeout: float = 60.0,
) -> tuple[str, str]:
    """发一条真实 desktop 口径 chat,返回 ``(conversation_id, 服务端 requestId)``。

    服务端 requestId 取 SSE **首个 data 帧的 id**;自造 UUID 不计数,取不到即抛
    ``DesktopChainError``(宁可失败也不伪造上报)。
    """
    if not token or not uid:
        raise DesktopChainError("missing credential")
    conversation_id = f"wb2api-conv-{time.time_ns()}"
    body: dict[str, Any] = {
        "model": str(model),
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant. 当前处于中文环境，使用简体中文回答。",
            },
            {"role": "user", "content": "1+1等于几？直接回答。"},
        ],
        "agent": "cli",
        "temperature": 1,
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "User-Agent": DESKTOP_UA,
        "X-Domain": CHAT_BASE_CN,
        "X-Product": "SaaS",
        "X-User-Id": str(uid),
        "X-Conversation-ID": conversation_id,
        "X-Request-ID": str(time.time_ns()),
        "X-Agent-Intent": "craft",
        "X-Agent-Type": "main",
        "X-IDE-Name": "WorkBuddy",
        "X-IDE-Type": "WorkBuddy",
        "X-IDE-Version": DESKTOP_IDE_VERSION,
        "x-codebuddy-request": "1",
    }
    if expert_id:
        headers["X-Expert-Id"] = str(expert_id)
    request_id = ""
    consumed = 0
    stop = False
    async with client.stream(
        "POST",
        CHAT_BASE_CN + DESKTOP_CHAT_PATH,
        headers=headers,
        json=body,
        timeout=timeout,
    ) as response:
        if response.status_code != 200:
            raise DesktopChainError(f"chat http {response.status_code}")
        buffer = ""
        async for chunk in response.aiter_text():
            buffer += chunk
            consumed += len(chunk)
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                rid, done = _parse_sse_data_line(line)
                if rid:
                    request_id = rid
                if done or request_id:
                    stop = True
                    break
            if stop or consumed > _MAX_SSE_CHARS:
                break
        if not request_id and buffer:
            rid, _done = _parse_sse_data_line(buffer)
            request_id = rid or request_id
    if not request_id:
        raise DesktopChainError("SSE 未返回服务端 requestId")
    return conversation_id, request_id


async def _lookup_market_expert(
    client: httpx.AsyncClient,
    token: str,
    uid: str,
    expert: Mapping[str, Any],
    *,
    timeout: float = 30.0,
) -> tuple[dict[str, Any] | None, str]:
    """在真实市场里定位该专家(优先 keyword 命中,回退整页扫描)。

    返回 ``(市场行, 错误串)``:错误串非空 = 请求失败;空 = 请求成功但未命中。
    """
    expert_id = _expert_field(expert, "expert_id", "id")
    if not expert_id:
        return None, "expert_id 缺失,无法在市场定位"
    keyword = str(
        expert.get("market_keyword")
        or expert.get("display_name_zh")
        or expert.get("name")
        or ""
    ).strip()
    expert_type = _expert_field(expert, "expert_type") or "agent"
    attempts: list[str | None] = [keyword or None]
    if keyword:
        attempts.append(None)
    for kw in attempts:
        try:
            rows = await fetch_market_experts(
                client,
                token,
                uid,
                expert_type=expert_type,
                keyword=kw,
                timeout=timeout,
            )
        except Exception as exc:  # noqa: BLE001 — 网络/协议异常收敛
            return None, redact(exc, (token,))
        for row in rows:
            if _expert_field(row, "expert_id", "id") == expert_id:
                return row, ""
    return None, ""


async def run_desktop_expert_task(
    client: httpx.AsyncClient,
    token: str,
    uid: str,
    nickname: str,
    expert: Mapping[str, Any],
    *,
    mode: str = "craft",
    read_tasks: ReadTasks | None = None,
    options: DirectApiOptions | None = None,
    task_code: str = "",
) -> DirectApiResult:
    """跑完整 desktop 专家链:市场(动态 version)→ 真实 chat → summon+actual_use → 回读。

    判据与 ``execute_task_code`` 一致:``ok=True`` 只来自回读 ``progress`` 真前进
    (复用 ``_progress_advanced``);``/v2/report`` 的 200/受理回执一律不算完成。

    ``read_tasks`` 缺省 ⇒ ``read_tasks_failed``(fail-closed,不拿回执冒充成功)。
    """
    opt = options or DirectApiOptions()
    code = str(task_code or _expert_field(expert, "task_code") or "")
    fingerprint = credential_fingerprint(token)

    def _result(
        reason: str,
        *,
        ok: bool = False,
        steps: list[StepTrace] | None = None,
        before: dict[str, dict[str, Any]] | None = None,
        after: dict[str, dict[str, Any]] | None = None,
        error: str = "",
        outbound: list[str] | None = None,
    ) -> DirectApiResult:
        return DirectApiResult(
            ok=ok,
            reason=reason,
            task_code=code,
            steps=tuple(steps or ()),
            credential_fingerprint=fingerprint,
            before=before,
            after=after,
            error=error,
            outbound=tuple(outbound or ()),
        )

    secrets = (token,) if token else ()
    try:
        if not token or not uid:
            return _result(REASON_MISSING_CREDENTIAL)
        if not code:
            return _result(REASON_MISSING_TASK_CODE)
        if read_tasks is None:
            return _result(REASON_READ_TASKS_FAILED, error="read_tasks 未注入")
        before = parse_task_snapshot(await _safe_read(read_tasks))
        if before is None:
            return _result(REASON_READ_TASKS_FAILED)

        traces: list[StepTrace] = []
        outbound: list[str] = []
        market_url = CHAT_BASE_CN + MARKET_EXPERT_LIST_PATH
        market, market_error = await _lookup_market_expert(
            client, token, uid, expert, timeout=opt.timeout
        )
        traces.append(
            StepTrace(
                index=len(traces),
                method="POST",
                url=redact(market_url, secrets),
                http_status=None if market_error else 200,
                response_excerpt=(
                    f"expert={_expert_field(expert, 'expert_id', 'id')} "
                    f"version={_expert_field(market or {}, 'version') or '-'}"
                ),
                ok=bool(market),
                error=market_error,
            )
        )
        if market is None:
            return _result(
                REASON_STEP_FAILED if market_error else REASON_MARKET_EXPERT_NOT_FOUND,
                steps=traces,
                before=before,
                error=market_error or "市场未命中该专家(拒绝用未核实 version 上报)",
            )

        resolved: dict[str, Any] = {**dict(expert), **market}
        version = _expert_version(market, expert)

        chat_url = CHAT_BASE_CN + DESKTOP_CHAT_PATH
        try:
            conversation_id, server_request_id = await real_chat_with_expert(
                client,
                token,
                uid,
                _expert_field(resolved, "expert_id", "id"),
                model="fast-model",
                timeout=max(opt.timeout, 60.0),
            )
        except Exception as exc:  # noqa: BLE001 — 收敛为结构化失败
            detail = redact(exc, secrets)
            traces.append(
                StepTrace(
                    index=len(traces),
                    method="POST",
                    url=redact(chat_url, secrets),
                    http_status=None,
                    response_excerpt="",
                    ok=False,
                    error=detail,
                )
            )
            return _result(REASON_STEP_FAILED, steps=traces, before=before, error=detail)
        traces.append(
            StepTrace(
                index=len(traces),
                method="POST",
                url=redact(chat_url, secrets),
                http_status=200,
                response_excerpt=f"conv={conversation_id} rid_len={len(server_request_id)}",
                ok=True,
            )
        )
        outbound.append(
            f"POST {CHAT_BASE_CN.removeprefix('https://')}{DESKTOP_CHAT_PATH} "
            f"expert={_expert_field(resolved, 'expert_id', 'id')}"
        )

        events = [
            *build_summon_events(resolved, version),
            build_expert_actual_use_event(
                resolved, conversation_id, server_request_id, version, mode=mode
            ),
        ]
        report = await report_desktop(
            client,
            token,
            uid,
            nickname,
            events,
            timeout=opt.timeout,
        )
        outbound.append(report.outbound)
        traces.append(
            StepTrace(
                index=len(traces),
                method="POST",
                url=redact(CHAT_BASE_CN + DESKTOP_REPORT_PATH, secrets),
                http_status=report.status,
                response_excerpt=f"code={report.code} msg={report.msg}".strip(),
                ok=report.status == 200,
                error=report.error,
            )
        )
        if report.status != 200:
            return _result(
                REASON_STEP_FAILED,
                steps=traces,
                before=before,
                error=report.error or report.msg or "report 未受理",
                outbound=outbound,
            )

        after: dict[str, dict[str, Any]] | None = None
        for attempt in range(max(1, opt.verify_attempts)):
            if attempt and opt.verify_interval > 0:
                await asyncio.sleep(opt.verify_interval)
            snapshot = parse_task_snapshot(await _safe_read(read_tasks))
            if snapshot is None:
                continue
            after = snapshot
            if _progress_advanced(before, after, code):
                break
        if after is None:
            return _result(
                REASON_READ_TASKS_FAILED, steps=traces, before=before, outbound=outbound
            )
        if _progress_advanced(before, after, code):
            return _result(
                REASON_OK,
                ok=True,
                steps=traces,
                before=before,
                after=after,
                outbound=outbound,
            )
        return _result(
            REASON_NO_PROGRESS_ADVANCE,
            steps=traces,
            before=before,
            after=after,
            outbound=outbound,
        )
    except Exception as exc:  # noqa: BLE001 — 兜底:不抛到调度器
        return _result(REASON_EXCEPTION, error=redact(exc, secrets))


# ---------------------------------------------------------------------------
# 模块初始化:从同目录 JSON 覆盖动作表（数据驱动,不改上方执行器逻辑）
# ---------------------------------------------------------------------------

_log = logging.getLogger(__name__)


def _bootstrap_action_table() -> None:
    """启动即加载同目录动作表;失败 fail-closed(记日志、不抛栈、保持内置默认表)。"""
    path = Path(__file__).with_name("workbuddy_direct_actions.json")
    if not path.is_file():
        return
    try:
        table = load_action_table(path)
        if table:
            register_action_table(table)
        else:
            _log.warning("workbuddy_direct_actions.json 为空,保持内置默认动作表")
    except Exception:  # noqa: BLE001 — 数据加载失败一律不阻断服务启动
        _log.warning("workbuddy_direct_actions.json 加载失败,保持内置默认动作表")


_bootstrap_action_table()
