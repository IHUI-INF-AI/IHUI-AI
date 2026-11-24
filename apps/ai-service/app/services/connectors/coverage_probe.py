# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""能力探测执行层 + 探测结果持久化(2026-11-24 立)。

与 ``coverage.py`` 的分工:coverage 负责台账加载/分组/分片/视图形态;
本模块负责**真调**与落库:

- 用租户已保存的托管凭据(经 ``managed.hydrate`` 注水后的执行副本)对每条只读
  operation 发真实请求;禁止一律标记 available。
- 平台原始错误码(飞书 ``code``、钉钉/企微 ``errcode``)原样保留,归类走显式
  映射表;未命中映射的未知码 ⇒ ``error``,不得当成 available。
- 结果只落 PostgreSQL(``connector_probe_results`` 轻量表),不使用 sqlite /
  本地状态文件;DSN 不可用时读面返回空、写面显式抛错(fail-closed)。

探测不做周期调度:不挂计划任务,由前端按需触发。
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Callable, Coroutine

from app.core.config import settings
from app.core.pg_sync import SyncPgSession

from . import coverage
from .base import DEFAULT_PROBE_LIMIT, MAX_PROBE_LIMIT, path_param_names
from . import custom_http

logger = logging.getLogger(__name__)

_TABLE = "connector_probe_results"

_SCHEMA_STATEMENTS: tuple[str, ...] = (
    f"""
    CREATE TABLE IF NOT EXISTS "{_TABLE}" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "owner_user_id" text DEFAULT '' NOT NULL,
      "connector_key" text DEFAULT '' NOT NULL,
      "platform" text NOT NULL,
      "api_id" text NOT NULL,
      "state" text NOT NULL,
      "http_code" integer,
      "platform_code" text DEFAULT '' NOT NULL,
      "reason" text DEFAULT '' NOT NULL,
      "missing_scope" text DEFAULT '' NOT NULL,
      "probed_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("tenant_id", "platform", "api_id")
    )
    """,
    f"""
    CREATE INDEX IF NOT EXISTS "{_TABLE}_tenant_platform_idx"
      ON "{_TABLE}" ("tenant_id", "platform")
    """,
)

_UPSERT_SQL = f"""
INSERT INTO "{_TABLE}" (
  tenant_id, owner_user_id, connector_key, platform, api_id,
  state, http_code, platform_code, reason, missing_scope, probed_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
ON CONFLICT (tenant_id, platform, api_id) DO UPDATE SET
  owner_user_id = EXCLUDED.owner_user_id,
  connector_key = EXCLUDED.connector_key,
  state = EXCLUDED.state,
  http_code = EXCLUDED.http_code,
  platform_code = EXCLUDED.platform_code,
  reason = EXCLUDED.reason,
  missing_scope = EXCLUDED.missing_scope,
  probed_at = now()
"""

_LOAD_SQL = f"""
SELECT api_id, state, http_code, platform_code, reason, missing_scope, probed_at
FROM "{_TABLE}"
WHERE tenant_id = $1 AND platform = $2
"""

_pg: SyncPgSession | None = None
_pg_lock = threading.Lock()


class ProbeStoreUnavailable(RuntimeError):
    """探测结果持久化不可用(DSN 缺失 / 连接失败)—— 写面 fail-closed,不回落文件。"""


# ---------------------------------------------------------------------------
# 归类映射表(平台码 → 状态;显式可审,不得在别处再写一套)
# ---------------------------------------------------------------------------

# 飞书 body.code;钉钉/企微 body.errcode。键统一字符串化后比对。
_CODE_MAPS: dict[str, dict[str, str]] = {
    "feishu": {
        "99991663": coverage.STATUS_NEED_USER_TOKEN,  # 租户令牌无效/缺失,需用户态或重取令牌
        "99991661": coverage.STATUS_NEED_ADMIN,  # 身份/管理员上下文不足
        "99991672": coverage.STATUS_PERMISSION_DENIED,  # 缺接口权限(scope)
        "99991671": coverage.STATUS_PERMISSION_DENIED,  # 无访问权限
    },
    "dingtalk": {
        "40001": coverage.STATUS_NEED_USER_TOKEN,  # 访问令牌无效/过期
        "40002": coverage.STATUS_NEED_USER_TOKEN,
        "88": coverage.STATUS_NEED_ADMIN,  # 需企业管理员授权
        "33012": coverage.STATUS_PERMISSION_DENIED,  # 缺接口权限
    },
    "wecom": {
        "40014": coverage.STATUS_NEED_USER_TOKEN,  # access_token 无效
        "40001": coverage.STATUS_NEED_USER_TOKEN,  # 凭证无效
        "48001": coverage.STATUS_PERMISSION_DENIED,  # 接口未授权
        "60011": coverage.STATUS_PERMISSION_DENIED,  # 无通讯录/成员权限
    },
}

# HTTP 状态码兜底映射(平台码未命中时使用)。
# 404/405 **不**映射到 unsupported:裸 HTTP 404 只能说明"这次请求打到的 URL/方法
# 不存在",在路径参数未填样本值时尤其如此,不能据此断言平台不支持该接口。
# 真正的"不支持"必须由平台业务码或文档态判定;这里一律落 error 并附原因。
_HTTP_MAP: dict[int, str] = {
    401: coverage.STATUS_NEED_USER_TOKEN,
    403: coverage.STATUS_PERMISSION_DENIED,
    404: coverage.STATUS_ERROR,
    405: coverage.STATUS_ERROR,
}
_HTTP_REASON_HINT: dict[int, str] = {
    404: "HTTP 404 不能判定接口不支持(可能是路径参数无有效样本、URL 变更),需结合文档确认",
    405: "HTTP 405 不能判定接口不支持(可能是方法模板与文档不一致),需结合文档确认",
}

_SUCCESS_CODES = {0, "0", None}
_SCOPE_KEYS = ("missing_scopes", "scopes", "required_scopes", "missing_scope")


def _extract_code(platform: str, body: Any) -> tuple[Any, str]:
    """从响应体取平台错误码;返回 (原始码, 字符串码)。"""
    if not isinstance(body, dict):
        return None, ""
    raw: Any
    if platform == "feishu":
        raw = body.get("code", body.get("errcode"))
    else:
        raw = body.get("errcode", body.get("code"))
    if raw is None:
        return None, ""
    return raw, str(raw)


def _extract_scope(body: Any) -> str:
    """抽取缺失的 scope 标识(列表或字符串),逗号拼接。"""
    if not isinstance(body, dict):
        return ""
    found: list[str] = []
    for key in _SCOPE_KEYS:
        value = body.get(key)
        if isinstance(value, list):
            found.extend(str(v) for v in value if str(v).strip())
        elif isinstance(value, str) and value.strip():
            found.append(value.strip())
    data = body.get("data")
    if isinstance(data, dict):
        for key in _SCOPE_KEYS:
            value = data.get(key)
            if isinstance(value, list):
                found.extend(str(v) for v in value if str(v).strip())
    # 去重保序
    return ",".join(dict.fromkeys(found))


def _platform_message(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    for key in ("msg", "errmsg", "message", "error"):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:300]
    return ""


def classify_outcome(
    platform: str,
    http_code: int | None,
    body: Any,
    reason: str = "",
) -> dict[str, Any]:
    """把一次响应归类成契约状态。

    优先级:成功(2xx 且平台码 0/空) → 平台码映射表 → HTTP 兜底映射 →
    ``error``(未知码原样记录,绝不冒 available)。
    """
    raw_code, code_str = _extract_code(platform, body)
    message = _platform_message(body) or reason
    missing_scope = _extract_scope(body)

    if http_code is not None and http_code < 400 and raw_code in _SUCCESS_CODES:
        state = coverage.STATUS_AVAILABLE
    elif code_str and code_str in _CODE_MAPS.get(platform, {}):
        state = _CODE_MAPS[platform][code_str]
    elif http_code is not None and http_code in _HTTP_MAP:
        state = _HTTP_MAP[http_code]
        # 404/405 原因提示必须进结果库,不能在真实链路上丢失:执行器捕获
        # _PartialFailure 时必传 reason=str(exc)(至少 "上游返回 404"),此前
        # `and not message` 在该链路恒假 ⇒ 提示永远不落库。改为该档必带、去重追加。
        if http_code in _HTTP_REASON_HINT and _HTTP_REASON_HINT[http_code] not in message:
            hint = _HTTP_REASON_HINT[http_code]
            message = f"{message} | {hint}" if message else hint
    else:
        state = coverage.STATUS_ERROR

    if state != coverage.STATUS_PERMISSION_DENIED:
        missing_scope = ""

    return {
        "state": state,
        "http_code": http_code,
        "platform_code": code_str,
        "reason": message,
        "missing_scope": missing_scope,
    }


# 台账 auth 字段标识"需要用户态令牌"的形态。只有明确命中才预判定拦截;
# 判不准(空/未知)一律返回 False,照旧真调 —— 失效方向是"多探一次",不是"多拦一次"。
_USER_AUTH_SUFFIXES = ("_user", "_user_access_token", "_user_token")

# 执行副本里代表"只有应用/租户级令牌"的 auth_kind;与 user 型台账 auth 冲突。
_TENANT_ONLY_AUTH_KINDS = frozenset(
    {"feishu_tenant", "dingtalk", "wecom_corp", "wechat_mp"}
)


def needs_user_token(api_auth: str, exec_auth_kind: str) -> bool:
    """台账要求的令牌类型与执行副本可用凭据是否冲突(需 user token 但只有租户令牌)。

    - ``api_auth`` 以 ``_user`` / ``_user_access_token`` / ``_user_token`` 结尾 ⇒ 需用户态;
    - ``exec_auth_kind`` 落在已知租户级集合 ⇒ 执行副本无用户态通道;
    - 两者同时成立才返回 True;任一取不到/判不准返回 False(照旧真探,不冒红也不误拦)。

    这条判据存在的意义:飞书台账 164 条 ``feishu_user`` 接口用 ``feishu_tenant``
    凭据去调必然失败,若发请求会被 HTTP 兜底误判成 ``unsupported``;预判定直接落
    ``need_user_token`` 既避免假 404,又让"缺什么权限"这一档首次有真实来源。
    """
    api_auth = str(api_auth or "").strip().lower()
    exec_auth_kind = str(exec_auth_kind or "").strip().lower()
    if not any(api_auth.endswith(suffix) for suffix in _USER_AUTH_SUFFIXES):
        return False
    return exec_auth_kind in _TENANT_ONLY_AUTH_KINDS


def _user_token_outcome(api: dict[str, Any]) -> dict[str, Any]:
    """预判定结果:不发起请求,状态 need_user_token,原因点明台账与凭据不匹配。"""
    return {
        "state": coverage.STATUS_NEED_USER_TOKEN,
        "http_code": None,
        "platform_code": "",
        "reason": (
            f"台账要求 {api.get('auth') or '用户态令牌'},当前托管连接器仅应用/租户级凭据; "
            "需接入用户态授权后方可调用,未发起请求"
        )[:300],
        "missing_scope": "",
    }


# 执行层异常里,只有"明确指向用户态令牌缺失/失效"才算 need_user_token。
# 宽泛 token 关键词命中会把配置缺失(未配置 app_id/app_secret/bearer token)
# 和租户凭据获取失败(平台代码错或故障)误判成 need_user_token —— 这些真实
# 原因都不是"用户态授权",落 error 才诚实,也不会被平台码映射掩盖。
_USER_TOKEN_ERROR_MARKERS = (
    "用户令牌刷新失败",
    "请重新扫码授权",
    "需要用户授权",
    "user token",
    "user_access_token",
    "useraccess",
)


def classify_execution_error(exc: Exception) -> dict[str, Any]:
    """执行层异常归类:仅明确的用户态令牌失效 → need_user_token;其余 → error。

    配置缺失、租户凭据错误/平台故障此前会被宽泛 "token/secret/app_id" 关键词
    误判成 need_user_token;现改为结构化标记,宁可落 error(如实)也不冒用户态。
    """
    text = str(exc)
    lowered = text.lower()
    state = (
        coverage.STATUS_NEED_USER_TOKEN
        if any(marker in lowered for marker in _USER_TOKEN_ERROR_MARKERS)
        else coverage.STATUS_ERROR
    )
    return {
        "state": state,
        "http_code": None,
        "platform_code": "",
        "reason": text[:300],
        "missing_scope": "",
    }


# ---------------------------------------------------------------------------
# 持久化(PostgreSQL;session 可注入便于单测)
# ---------------------------------------------------------------------------


def _pg_session() -> SyncPgSession | None:
    global _pg
    if _pg is not None:
        return _pg
    with _pg_lock:
        if _pg is not None:
            return _pg
        dsn = str(getattr(settings, "database_url", "") or "").strip()
        if not dsn:
            logger.warning("[coverage_probe] DATABASE_URL 未配置:探测结果持久化未启用")
            return None
        try:
            _pg = SyncPgSession(dsn, schema=_SCHEMA_STATEMENTS, timeout=10.0)
        except Exception as exc:  # noqa: BLE001 - 连接不可用按未启用降级
            logger.warning("[coverage_probe] PG 连接不可用: %s: %s", type(exc).__name__, exc)
            _pg = None
        return _pg


def close_session() -> None:
    global _pg
    with _pg_lock:
        session, _pg = _pg, None
    if session is not None:
        session.close()


def upsert_result(
    tenant_id: str,
    scope: str,
    connector_key: str,
    platform: str,
    api_id: str,
    outcome: dict[str, Any],
) -> None:
    """幂等写入一条探测结果;持久化不可用抛 ProbeStoreUnavailable(fail-closed)。"""
    session = _pg_session()
    if session is None:
        raise ProbeStoreUnavailable("PostgreSQL 不可用,探测结果未持久化(拒绝回落本地文件)")
    # 写库原生异常(断连/约束冲突/表结构变更)此前直接冒泡出 probe_apis,路由返 500、
    # 整批内存结果连同已成功条目一起丢。读面 load_results 是 catch-all 降级;写面
    # 对齐:任何 execute 失败统一转 ProbeStoreUnavailable,由 probe_apis 逐条捕获、
    # 在 reason 标注"结果未持久化"后保留该条,不毁掉整批。
    try:
        session.execute(
            _UPSERT_SQL,
            (
                tenant_id,
                scope,
                connector_key,
                platform,
                api_id,
                str(outcome.get("state") or coverage.STATUS_UNPROBED),
                outcome.get("http_code"),
                str(outcome.get("platform_code") or ""),
                str(outcome.get("reason") or "")[:300],
                str(outcome.get("missing_scope") or ""),
            ),
        )
    except ProbeStoreUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 - 写失败降级为逐条标注,不丢整批
        raise ProbeStoreUnavailable(f"探测结果写入失败: {type(exc).__name__}: {exc}") from exc


def load_results(tenant_id: str, platform: str) -> dict[str, dict[str, Any]]:
    """读回某租户某平台的最新探测结果;无连接返回空字典(读面降级,不抛)。"""
    session = _pg_session()
    if session is None:
        return {}
    try:
        rows = session.fetchall(_LOAD_SQL, (tenant_id, platform))
    except Exception as exc:  # noqa: BLE001 - 读失败不崩覆盖视图
        logger.warning("[coverage_probe] 探测结果读取失败: %s", exc)
        return {}
    results: dict[str, dict[str, Any]] = {}
    for row in rows:
        probed_at = row["probed_at"]
        if hasattr(probed_at, "isoformat"):
            probed_at = probed_at.isoformat()
        results[str(row["api_id"])] = {
            "state": str(row["state"] or coverage.STATUS_UNPROBED),
            "http_code": row["http_code"],
            "platform_code": str(row["platform_code"] or ""),
            "reason": str(row["reason"] or ""),
            "missing_scope": str(row["missing_scope"] or ""),
            "probed_at": probed_at,
        }
    return results


# ---------------------------------------------------------------------------
# 探测执行
# ---------------------------------------------------------------------------

# 汇总计数里固定带出的状态键(即使为 0 也回传,前端计数表稳定)
_PROBED_BUDGET_KEYS = (
    coverage.STATUS_AVAILABLE,
    coverage.STATUS_PERMISSION_DENIED,
    coverage.STATUS_NEED_USER_TOKEN,
    coverage.STATUS_NEED_ADMIN,
    coverage.STATUS_UNSUPPORTED,
    coverage.STATUS_ERROR,
    coverage.STATUS_UNPROBED,
)

# 执行器签名:(执行副本记录, 操作定义) → 归类结果字典
Executor = Callable[
    [dict[str, Any], dict[str, Any]],
    Coroutine[Any, Any, dict[str, Any]],
]


# 探测用的路径参数样本值:明显非真实 ID,只为让请求打到合法 URL 形态。
# 绝不用于写操作(action 一律不注入,缺参时 fail-closed,不产生副作用)。
_PROBE_SAMPLE_VALUE = "ihui-probe-sample"


def _default_executor(record: dict[str, Any], op: dict[str, Any]) -> Coroutine[Any, Any, dict[str, Any]]:
    """默认执行器:走 custom_http 声明式执行层发真实请求。"""

    async def _run() -> dict[str, Any]:
        exec_record = dict(record)
        exec_record["operations"] = [op]
        connector = custom_http.CustomHttpConnector(exec_record)
        try:
            # 只读接口带路径占位符时注入样本值:否则空参数会被执行层判定缺参、
            # 或打到字面量 :id 造成假 404。写操作保持空参数,fail-closed 不探。
            params: dict[str, Any] = {}
            if str(op.get("capability") or "") != "action":
                params = {
                    name: _PROBE_SAMPLE_VALUE
                    for name in path_param_names(str(op.get("path") or ""))
                }
            result = await connector.invoke(op["id"], params)
            return {
                "state": coverage.STATUS_AVAILABLE,
                "http_code": int(result.get("status") or 200),
                "platform_code": "",
                "reason": str(result.get("message") or "ok"),
                "missing_scope": "",
            }
        except custom_http._PartialFailure as exc:  # noqa: SLF001 - 上游业务失败带状态码/体
            return classify_outcome(
                str(record.get("type") or ""),
                exc.status,
                exc.data,
                reason=str(exc),
            )
        except (custom_http.ConnectorExecutionError, custom_http.ConnectorSecurityError) as exc:
            return classify_execution_error(exc)

    return _run()


async def probe_apis(
    *,
    record: dict[str, Any],
    platform: str,
    apis: list[dict[str, Any]],
    read_only: bool = True,
    limit: int = DEFAULT_PROBE_LIMIT,
    offset: int = 0,
    executor: Executor | None = None,
    persist: Callable[[str, str, str, str, str, dict[str, Any]], None] | None = None,
    default_base_url: str = "",
) -> dict[str, Any]:
    """对选中的 API 逐条探测,落库并汇总。

    - ``read_only=True``(默认)只探只读接口;写操作(action)跳过,不发起请求。
    - ``limit`` 单批上限 ``MAX_PROBE_LIMIT``;超出部分计入 skipped。
    - ``offset`` 批内游标(默认 0,行为与此前完全一致):配合返回的 ``nextOffset``
      让"探测全量"能分批翻页。此前无游标,前端只能探前 limit 条,第 limit+1 条
      之后永远 unprobed。offset 缺省/非法(<0)一律按 0,向后兼容。
    - ``executor`` / ``persist`` 可注入,便于单测隔离真网与 PG。
    """
    executor_fn = executor or _default_executor
    persist_fn = persist or upsert_result

    operations = [coverage.api_to_operation(api, default_base_url) for api in apis]
    eligible: list[tuple[dict[str, Any], dict[str, Any]]] = []
    skipped = 0
    for api, op in zip(apis, operations):
        if read_only and op["capability"] == "action":
            skipped += 1
            continue
        eligible.append((api, op))

    take = max(0, min(limit, MAX_PROBE_LIMIT))
    cursor = max(0, offset)  # 非法/缺省 offset 按 0,向后兼容
    capped = eligible[cursor : cursor + take]
    skipped += len(eligible) - len(capped)
    # 下一批游标:仅当本批之后仍有 eligible 时给出,否则 null(前端据此停止翻页)。
    next_offset = cursor + take if cursor + take < len(eligible) else None

    summary: dict[str, int] = {status: 0 for status in coverage.ALL_STATUSES}
    results: list[dict[str, Any]] = []
    tenant_id = str(record.get("tenant_id") or "")
    scope = str(record.get("scope") or "")
    connector_key = str(record.get("key") or "")
    spec = record.get("spec")
    exec_auth_kind = str(spec.get("auth_kind") or "") if isinstance(spec, dict) else ""

    for api, op in capped:
        # 鉴权类型不匹配(台账需 user token,执行副本只有租户令牌)⇒ 预判定,不发请求。
        # 放在 read_only 过滤之后、executor 之前:既不污染 skipped 语义,也不产生假 404。
        if needs_user_token(api.get("auth", ""), exec_auth_kind):
            outcome = _user_token_outcome(api)
        else:
            outcome = await executor_fn(record, op)
        state = str(outcome.get("state") or coverage.STATUS_ERROR)
        if state not in coverage.ALL_STATUSES:
            state = coverage.STATUS_ERROR
            outcome["state"] = state
        summary[state] += 1
        try:
            persist_fn(tenant_id, scope, connector_key, platform, api["id"], outcome)
        except ProbeStoreUnavailable as exc:
            # 落库失败不丢弃本次内存结果,但在原因里如实标注
            outcome["reason"] = f"{outcome.get('reason') or ''} [结果未持久化: {exc}]".strip()
            logger.warning("[coverage_probe] 探测结果落库失败(%s/%s): %s", connector_key, api["id"], exc)
        results.append(
            {
                "api_id": api["id"],
                "state": state,
                "http_code": outcome.get("http_code"),
                "platform_code": str(outcome.get("platform_code") or ""),
                "reason": str(outcome.get("reason") or ""),
                "missing_scope": str(outcome.get("missing_scope") or ""),
            }
        )

    return {
        "probed": len(results),
        "skipped": skipped,
        "nextOffset": next_offset,
        "summary": {k: v for k, v in summary.items() if v or k in _PROBED_BUDGET_KEYS},
        "results": results,
    }


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
