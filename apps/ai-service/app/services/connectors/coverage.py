# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目录台账 → 可执行 operations → 能力探测 的覆盖引擎(2026-11-24 立)。

三份平台台账(feishu / dingtalk / wecom)由并行抓取任务落盘到数据目录;
本模块只做**本地读取与派生**,不触网、不抓文档。

职责拆分:
- 台账加载与容错:文件缺失 / 解析失败 / 空清单 ⇒ ``state="unjudged"`` 并附原因,
  **绝不**回落成空目录或假数据(前端必须能区分"还没判定"与"判定为零")。
- 域分组:按台账里的 ``domain`` 字段归组,保持首次出现顺序。
- operations 生成:台账 API 条目 → 声明式操作定义(路径占位保留,query/body 最小模板;
  读操作 ``confirm=False``,写操作 ``confirm=True`` 且默认 ``disabled``)。
- 分片规划:全量目录按业务域切片,每片 ≤ ``SHARD_SIZE``(= ``MAX_OPERATIONS``),
  同一域优先不跨片;片 key 形如 ``feishu-im-1``。
- 覆盖视图:把持久化的探测结果按 api_id 合并进台账条目,产出前端契约形态的字典。

探测真实发请求与结果持久化在 ``coverage_probe.py``;本模块不依赖它,避免环依赖。
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .base import HTTP_METHODS, SHARD_SIZE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 平台与状态枚举(前端契约字段名,不得改)
# ---------------------------------------------------------------------------

PLATFORMS: tuple[str, ...] = ("feishu", "dingtalk", "wecom")

PLATFORM_LABELS: dict[str, str] = {
    "feishu": "飞书",
    "dingtalk": "钉钉",
    "wecom": "企业微信",
}

# 探测状态枚举(唯一一份;路由、归类、视图都引这里的字面量)
STATUS_UNPROBED = "unprobed"
STATUS_AVAILABLE = "available"
STATUS_PERMISSION_DENIED = "permission_denied"
STATUS_NEED_USER_TOKEN = "need_user_token"
STATUS_NEED_ADMIN = "need_admin"
STATUS_UNSUPPORTED = "unsupported"
STATUS_ERROR = "error"
STATUS_UNJUDGED = "unjudged"

ALL_STATUSES: tuple[str, ...] = (
    STATUS_UNPROBED,
    STATUS_AVAILABLE,
    STATUS_PERMISSION_DENIED,
    STATUS_NEED_USER_TOKEN,
    STATUS_NEED_ADMIN,
    STATUS_UNSUPPORTED,
    STATUS_ERROR,
    STATUS_UNJUDGED,
)

# 计入「已探测」的状态(其余仍是未判定/未探)
_PROBED_STATUSES: frozenset[str] = frozenset(
    {
        STATUS_AVAILABLE,
        STATUS_PERMISSION_DENIED,
        STATUS_NEED_USER_TOKEN,
        STATUS_NEED_ADMIN,
        STATUS_UNSUPPORTED,
        STATUS_ERROR,
    }
)

# 域展示名(内置常见业务域;台账自带中文标签时以台账为准,未知域回退 key 本身)
_DOMAIN_LABELS: dict[str, str] = {
    "im": "消息与群组",
    "contact": "通讯录",
    "docs": "云文档",
    "drive": "云盘",
    "calendar": "日历",
    "bitable": "多维表格",
    "approval": "审批",
    "attendance": "考勤",
    "checkin": "打卡",
    "message": "工作消息",
    "wedrive": "微盘",
    "minutes": "会议",
    "bot": "机器人",
    "other": "其他",
}

# 台账文件候选子目录(相对 ai-service/app);env 可整体覆盖目录
_DATA_SUBDIRS: tuple[str, ...] = (
    "services/connectors/catalog_data",
    "data/catalog_data",
    "data/connectors",
    "services/connectors/catalogs",
)

_OP_ID_RE = re.compile(r"[^A-Za-z0-9_.-]+")
_KEY_RE = re.compile(r"[^a-z0-9]+")
_SEARCH_HINTS = {"q", "query", "search", "keyword", "kw", "filter", "name"}


# ---------------------------------------------------------------------------
# 台账加载
# ---------------------------------------------------------------------------


class CatalogUnavailable(Exception):
    """台账未判定 / 未匹配到条目:调用方必须显式报错,不许静默存空壳连接器。"""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass
class CatalogBundle:
    """一份平台台账的读取结果(含未判定形态)。"""

    platform: str
    label: str
    state: str  # "ok" | "unjudged"
    reason: str
    source: dict[str, Any]
    apis: list[dict[str, Any]]
    base_url: str = ""
    auth_kind: str = ""
    events: list[dict[str, Any]] = field(default_factory=list)
    unenumerated_domains: list[dict[str, Any]] = field(default_factory=list)
    domain_meta: dict[str, dict[str, Any]] = field(default_factory=dict)


def _app_dir() -> Path:
    # app/services/connectors/coverage.py → parents[2] = app/
    return Path(__file__).resolve().parents[2]


def _catalog_dirs(explicit: str | Path | None) -> list[Path]:
    # 显式参数 / env 覆盖一旦给出,即为唯一查找源(测试隔离与定向部署);
    # 都未给出时才走内置候选目录链回落。
    if explicit:
        return [Path(explicit)]
    env_dir = str(os.environ.get("IHUI_CONNECTOR_CATALOG_DIR") or "").strip()
    if env_dir:
        return [Path(env_dir)]
    app_dir = _app_dir()
    return [app_dir / sub for sub in _DATA_SUBDIRS]


def _catalog_path(platform: str, catalog_dir: str | Path | None) -> Path | None:
    # 文件名两种形态:`{platform}.json` 与抓取任务落盘的 `{platform}_api_ledger.json`
    names = (f"{platform}.json", f"{platform}_api_ledger.json")
    for directory in _catalog_dirs(catalog_dir):
        for name in names:
            candidate = directory / name
            if candidate.is_file():
                return candidate
    return None


def _zero_totals() -> dict[str, int]:
    return {
        "apis": 0,
        "domains": 0,
        "available": 0,
        "permission_denied": 0,
        "need_user_token": 0,
        "need_admin": 0,
        "unsupported": 0,
        "error": 0,
        "unprobed": 0,
    }


def _default_status() -> dict[str, Any]:
    return {
        "state": STATUS_UNPROBED,
        "http_code": None,
        "platform_code": "",
        "reason": "",
        "missing_scope": "",
        "probed_at": None,
    }


def _as_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _normalize_api(
    raw: Any, platform: str, index: int, *, force_event: bool = False
) -> dict[str, Any] | None:
    """把台账条目规范成内部 API 形状;非法条目返回 None(跳过,不崩整份台账)。

    容忍台账追加字段:``base_url_override``(该接口独立基址)、``verified``、
    ``notes``(自由文本,忽略不存);``force_event`` 用于 events 数组:
    事件/回调一律 read=False、event=True,不生成可执行 operation。
    """
    if not isinstance(raw, dict):
        return None
    raw_method = str(raw.get("method") or raw.get("http_method") or "").strip().upper()
    method = raw_method or ("POST" if force_event else "GET")
    path = str(raw.get("path") or raw.get("url") or raw.get("endpoint") or "").strip()
    if not force_event and (method not in HTTP_METHODS or not path.startswith("/")):
        return None

    raw_id = str(raw.get("id") or raw.get("api_id") or raw.get("operationId") or "").strip()
    if not raw_id:
        raw_id = f"{method.lower()}-{_KEY_RE.sub('-', path.lower()).strip('-')}"
    api_id = _OP_ID_RE.sub("-", raw_id).strip("-")[:64] or f"api-{index + 1}"

    name = str(raw.get("name") or raw.get("title") or raw.get("summary") or "").strip() or api_id
    domain = str(raw.get("domain") or raw.get("group") or raw.get("category") or "other").strip() or "other"
    auth = str(raw.get("auth") or raw.get("auth_kind") or raw.get("kind") or "").strip()
    scope = str(raw.get("scope") or raw.get("permission") or raw.get("perm") or "").strip()
    doc_url = str(raw.get("doc_url") or raw.get("doc") or raw.get("documentation_url") or "").strip()
    base_url_override = str(raw.get("base_url_override") or "").strip()

    read_raw = raw.get("read", raw.get("read_only"))
    if force_event:
        read, event = False, True
    elif read_raw is None:
        read, event = method == "GET", bool(raw.get("event") or raw.get("is_event"))
    else:
        read, event = bool(read_raw), bool(raw.get("event") or raw.get("is_event"))

    return {
        "id": api_id,
        "domain": domain,
        "name": name,
        "method": method,
        "path": path,
        "auth": auth,
        "scope": scope,
        "read": read,
        "event": event,
        "doc_url": doc_url,
        "event_type": str(raw.get("event_type") or ""),
        "base_url_override": base_url_override,
        "verified": bool(raw.get("verified")),
        # 台账可选携带最小 query/body 模板;缺省留空由调用方传参
        "query": dict(raw["query"]) if isinstance(raw.get("query"), dict) else {},
        "body": dict(raw["body"]) if isinstance(raw.get("body"), dict) else None,
    }


def load_catalog(platform: str, catalog_dir: str | Path | None = None) -> CatalogBundle:
    """读取并规范一份平台台账。

    文件缺失 / JSON 解析失败 / 无有效条目 ⇒ ``state="unjudged"``,reason 说明原因;
    调用方不得把这种结果当成"目录为空、接口都不可用"。
    """
    label = PLATFORM_LABELS.get(platform, platform)
    empty_source: dict[str, Any] = {
        "index_url": "",
        "fetched_at": "",
        "declared_total": 0,
        "enumeration_method": "",
    }
    if platform not in PLATFORMS:
        return CatalogBundle(
            platform=platform,
            label=label,
            state=STATUS_UNJUDGED,
            reason=f"未知平台: {platform}(仅支持 feishu/dingtalk/wecom)",
            source=empty_source,
            apis=[],
        )

    path = _catalog_path(platform, catalog_dir)
    if path is None:
        return CatalogBundle(
            platform=platform,
            label=label,
            state=STATUS_UNJUDGED,
            reason="台账文件尚未落盘(并行抓取未完成或目录未配置),暂未判定;不提供空目录或假数据",
            source=empty_source,
            apis=[],
        )

    try:
        text = path.read_text(encoding="utf-8")
        data = json.loads(text)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return CatalogBundle(
            platform=platform,
            label=label,
            state=STATUS_UNJUDGED,
            reason=f"台账读取/解析失败: {type(exc).__name__}: {exc}",
            source=empty_source,
            apis=[],
        )

    if not isinstance(data, dict):
        return CatalogBundle(
            platform=platform,
            label=label,
            state=STATUS_UNJUDGED,
            reason="台账根节点不是对象,格式不符合冻结 schema",
            source=empty_source,
            apis=[],
        )

    raw_apis = data.get("apis")
    if raw_apis is None:
        raw_apis = data.get("endpoints") or data.get("items") or []
    if not isinstance(raw_apis, list):
        raw_apis = []

    apis: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(raw_apis):
        api = _normalize_api(raw, platform, index)
        if api is None or api["id"] in seen_ids:
            continue
        seen_ids.add(api["id"])
        apis.append(api)

    if not apis:
        return CatalogBundle(
            platform=platform,
            label=label,
            state=STATUS_UNJUDGED,
            reason="台账解析后没有可识别的 API 条目,暂未判定",
            source=empty_source,
            apis=[],
        )

    # events:事件/回调条目,不计入可执行 operation,也不计入 totals.apis
    raw_events = data.get("events")
    events: list[dict[str, Any]] = []
    if isinstance(raw_events, list):
        for index, raw in enumerate(raw_events):
            event = _normalize_api(raw, platform, index, force_event=True)
            if event is not None and event["id"] not in seen_ids:
                seen_ids.add(event["id"])
                events.append(event)

    # 未展开域提示(前端展示用,不参与分片)
    raw_unenumerated = data.get("unenumerated_domains")
    unenumerated_domains: list[dict[str, Any]] = []
    if isinstance(raw_unenumerated, list):
        for raw in raw_unenumerated:
            if isinstance(raw, dict):
                unenumerated_domains.append(
                    {
                        "key": str(raw.get("key") or ""),
                        "label": str(raw.get("label") or ""),
                        "reason": str(raw.get("reason") or ""),
                    }
                )

    # 域元数据(台账自带 complete/reason/label 时优先采用)
    domain_meta: dict[str, dict[str, Any]] = {}
    raw_domains = data.get("domains")
    if isinstance(raw_domains, list):
        for raw in raw_domains:
            if isinstance(raw, dict) and raw.get("key"):
                domain_meta[str(raw["key"])] = {
                    "label": str(raw.get("label") or ""),
                    "complete": raw.get("complete"),
                    "reason": str(raw.get("reason") or ""),
                }

    source_raw = data.get("source")
    raw_source: dict[str, Any] = source_raw if isinstance(source_raw, dict) else {}
    # declared_total 可能为 null(官方未公布总量):归一为 0,totals 仍按台账实算,
    # 不因此把 catalog_state 判成 unjudged。
    declared_total = raw_source.get("declared_total")
    if declared_total is None:
        declared_total = data.get("declared_total")
    source: dict[str, Any] = {
        "index_url": str(raw_source.get("index_url") or data.get("index_url") or ""),
        "fetched_at": str(raw_source.get("fetched_at") or data.get("fetched_at") or ""),
        "declared_total": _as_int(declared_total) if declared_total is not None else 0,
        "enumeration_method": str(
            raw_source.get("enumeration_method") or data.get("enumeration_method") or ""
        ),
    }
    return CatalogBundle(
        platform=platform,
        label=str(data.get("label") or label),
        state="ok",
        reason="",
        source=source,
        apis=apis,
        base_url=str(data.get("base_url") or "").strip(),
        auth_kind=str(data.get("auth_kind") or "").strip(),
        events=events,
        unenumerated_domains=unenumerated_domains,
        domain_meta=domain_meta,
    )


# ---------------------------------------------------------------------------
# 域分组与操作生成
# ---------------------------------------------------------------------------


def group_by_domain(apis: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """按 domain 归组;保持条目首次出现顺序。"""
    groups: dict[str, list[dict[str, Any]]] = {}
    for api in apis:
        groups.setdefault(api["domain"], []).append(api)
    return groups


def domain_label(platform: str, domain: str) -> str:
    """域展示名:优先内置表,回退 domain key 本身。"""
    return _DOMAIN_LABELS.get(domain, domain)


def _read_capability(method: str, path: str, api: dict[str, Any]) -> str:
    if re.search(r"\{[A-Za-z0-9_]+\}", path):
        return "fetch"
    query = api.get("query") or {}
    if any(str(k).lower() in _SEARCH_HINTS for k in query) or re.search(
        r"search|query|keyword", str(api.get("name") or ""), re.IGNORECASE
    ):
        return "search"
    return "list"


def api_to_operation(api: dict[str, Any], default_base_url: str = "") -> dict[str, Any]:
    """台账 API 条目 → 声明式操作定义(与 base.ConnectorOperation 字段对齐)。

    操作基址:条目 ``base_url_override`` 优先;缺省回落台账顶层 ``base_url``;
    再缺省由连接器 spec 基址兜底。
    """
    read = bool(api.get("read"))
    method = str(api["method"])
    if read:
        capability = _read_capability(method, api["path"], api)
        confirm = False
        disabled = False
    else:
        capability = "action"
        confirm = True
        disabled = True
    description = str(api.get("scope") or "").strip()
    if api.get("doc_url"):
        description = f"{description} {api['doc_url']}".strip()
    return {
        "id": api["id"],
        "name": api["name"],
        "capability": capability,
        "method": method,
        "path": api["path"],
        "base_url": api.get("base_url_override") or default_base_url,
        "query": dict(api.get("query") or {}),
        "body": api.get("body"),
        "response_path": "",
        "confirm": confirm,
        "disabled": disabled,
        "description": description[:300],
    }


# ---------------------------------------------------------------------------
# 分片规划
# ---------------------------------------------------------------------------


def _shard_key(platform: str, domain: str, index: int) -> str:
    safe_domain = _KEY_RE.sub("-", domain.lower()).strip("-") or "other"
    return f"{platform}-{safe_domain}-{index}"


def plan_shards(
    platform: str,
    apis: list[dict[str, Any]],
    *,
    domains: list[str] | None = None,
    api_ids: list[str] | None = None,
    shard_size: int = SHARD_SIZE,
    default_base_url: str = "",
) -> dict[str, Any]:
    """按业务域把选中的 API 切成 ≤ ``shard_size`` 的片。

    守恒断言(单测钉住):
    - 每片 ``api_ids`` 数量 ≤ ``shard_size``;
    - 所有片的 api_ids 并集 == 选中全集(不丢条目);
    - 同一域的条目落在同一片或同域连续编号的多片内,不与别的域混片;
    - ``dropped`` = 请求里指定但台账匹配不上的 domain/api_id 数量。
    """
    wanted_domains = {d for d in (domains or []) if d}
    wanted_ids = {i for i in (api_ids or []) if i}

    selected: list[dict[str, Any]] = []
    matched_ids: set[str] = set()
    for api in apis:
        if wanted_ids and api["id"] not in wanted_ids:
            continue
        if wanted_domains and api["domain"] not in wanted_domains:
            continue
        selected.append(api)
        matched_ids.add(api["id"])

    dropped = len(wanted_ids - matched_ids)
    if wanted_domains:
        known_domains = {api["domain"] for api in apis}
        dropped += len(wanted_domains - known_domains)

    groups = group_by_domain(selected)
    connectors: list[dict[str, Any]] = []
    for domain, items in groups.items():
        chunks = [items[i : i + shard_size] for i in range(0, len(items), shard_size)]
        total = len(chunks)
        for chunk_index, chunk in enumerate(chunks, start=1):
            connectors.append(
                {
                    "key": _shard_key(platform, domain, chunk_index),
                    "label": (
                        f"{PLATFORM_LABELS.get(platform, platform)} · "
                        f"{domain_label(platform, domain)} ({chunk_index}/{total})"
                    ),
                    "domain": domain,
                    "api_ids": [item["id"] for item in chunk],
                    "operations": len(chunk),
                    # 可直接落库的完整操作定义;长度与 operations 计数一致
                    "operation_defs": [
                        api_to_operation(item, default_base_url) for item in chunk
                    ],
                }
            )

    return {
        "platform": platform,
        "selected": len(selected),
        "connectors": connectors,
        "dropped": dropped,
    }


def resolve_expansion(
    platform: str,
    *,
    api_ids: list[str] | None = None,
    domains: list[str] | None = None,
    catalog_dir: str | Path | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], CatalogBundle]:
    """按平台 + api_ids/domains 从台账展开操作定义(配置保存的唯一展开口径)。

    台账未判定或一条都没匹配上 ⇒ 抛 ``CatalogUnavailable``,调用方必须显式
    报错,不得静默落一个空壳连接器。返回 (选中 API 条目, 操作定义, 台账包)。
    """
    bundle = load_catalog(platform, catalog_dir=catalog_dir)
    if bundle.state != "ok":
        raise CatalogUnavailable(bundle.reason)

    wanted_ids = {item for item in (api_ids or []) if item}
    wanted_domains = {item for item in (domains or []) if item}
    selected = [
        api
        for api in bundle.apis
        if (not wanted_ids or api["id"] in wanted_ids)
        and (not wanted_domains or api["domain"] in wanted_domains)
    ]
    if not selected:
        raise CatalogUnavailable("按指定 api_ids/domains 未匹配到台账接口,拒绝保存空壳连接器")

    operations = [api_to_operation(api, bundle.base_url) for api in selected]
    return selected, operations, bundle


# ---------------------------------------------------------------------------
# 覆盖视图
# ---------------------------------------------------------------------------


def _count_statuses(items: list[dict[str, Any]]) -> dict[str, int]:
    counts = _zero_totals()
    for item in items:
        state = str(item.get("status", {}).get("state") or STATUS_UNPROBED)
        if state in counts:
            counts[state] += 1
    counts["apis"] = len(items)
    return counts


def build_coverage(
    platform: str,
    probe_results: dict[str, dict[str, Any]] | None = None,
    catalog_dir: str | Path | None = None,
) -> dict[str, Any]:
    """产出前端契约形态的覆盖视图。

    ``probe_results``: ``{api_id: {state, http_code, platform_code, reason,
    missing_scope, probed_at}}``,由 ``coverage_probe`` 持久化层读回;缺省全未探。
    """
    bundle = load_catalog(platform, catalog_dir=catalog_dir)
    results = probe_results or {}

    if bundle.state != "ok":
        return {
            "platform": platform,
            "label": bundle.label,
            "catalog_state": STATUS_UNJUDGED,
            "source": bundle.source,
            "totals": _zero_totals(),
            "domains": [],
            "apis": [],
            "events": {"count": 0, "items": []},
            "unenumerated_domains": [],
            "unjudged_reason": bundle.reason,
        }

    def _api_view(api: dict[str, Any]) -> dict[str, Any]:
        stored = results.get(api["id"])
        status = _default_status()
        if isinstance(stored, dict):
            for key in status:
                if key in stored:
                    status[key] = stored[key]
            if status["state"] not in ALL_STATUSES:
                status["state"] = STATUS_UNPROBED
        return {
            "id": api["id"],
            "domain": api["domain"],
            "name": api["name"],
            "method": api["method"],
            "path": api["path"],
            "auth": api["auth"],
            "scope": api["scope"],
            "read": api["read"],
            "event": api["event"],
            "doc_url": api["doc_url"],
            "base_url_override": api.get("base_url_override") or "",
            "verified": bool(api.get("verified")),
            "status": status,
        }

    apis_view = [_api_view(api) for api in bundle.apis]
    events_view = [_api_view(event) for event in bundle.events]

    domain_groups = group_by_domain(apis_view)
    domains_view: list[dict[str, Any]] = []
    for domain, items in domain_groups.items():
        counts = _count_statuses(items)
        probed = sum(counts[s] for s in _PROBED_STATUSES)
        meta = bundle.domain_meta.get(domain, {})
        meta_complete = meta.get("complete")
        complete = (
            bool(meta_complete)
            if isinstance(meta_complete, bool)
            else len(items) > 0 and probed == len(items)
        )
        domains_view.append(
            {
                "key": domain,
                "label": meta.get("label") or domain_label(platform, domain),
                "count": len(items),
                "complete": complete,
                "reason": str(meta.get("reason") or ""),
                "available": counts[STATUS_AVAILABLE],
                "permission_denied": counts[STATUS_PERMISSION_DENIED],
                "need_user_token": counts[STATUS_NEED_USER_TOKEN],
                "need_admin": counts[STATUS_NEED_ADMIN],
                "unsupported": counts[STATUS_UNSUPPORTED],
                "error": counts[STATUS_ERROR],
                "unprobed": counts[STATUS_UNPROBED],
            }
        )

    totals = _zero_totals()
    for domain_view in domains_view:
        for key in (
            STATUS_AVAILABLE,
            STATUS_PERMISSION_DENIED,
            STATUS_NEED_USER_TOKEN,
            STATUS_NEED_ADMIN,
            STATUS_UNSUPPORTED,
            STATUS_ERROR,
            STATUS_UNPROBED,
        ):
            totals[key] += domain_view[key]
    totals["apis"] = len(apis_view)
    totals["domains"] = len(domains_view)

    return {
        "platform": platform,
        "label": bundle.label,
        "catalog_state": "ok",
        "source": bundle.source,
        "totals": totals,
        "domains": domains_view,
        "apis": apis_view,
        "events": {"count": len(events_view), "items": events_view},
        "unenumerated_domains": bundle.unenumerated_domains,
        "unjudged_reason": "",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
