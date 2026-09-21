# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 生态质量分与安全评分(H8 看板指标 / P1 1-4,2026-09-12 立)。

三部分:
1. 运行时指标采集:入站(mcp_stdio_bridge 转发)与出站(mcp_client.
   call_external_tool)的每次 MCP 工具调用 —— 延迟 / 成功失败 / schema 兼容;
   Prometheus 指标自动暴露在 /metrics(与 agent_metrics.py 同模式)。
2. 质量分聚合(0-100 加权,详见 _WEIGHT_* 注释):成功率 + 延迟分 +
   schema 兼容率 + 冲突率,聚合为 per-server 质量分 + A/B/C/D 等级。
3. 权限风险静态评分(安全分 0-100,越高越安全):按 server 声明的权限/
   能力(文件写 / 命令执行 / 浏览器控制 / 数据库 / 凭据 / 网络等高危维度)
   扣分,产出风险等级(low/medium/high/critical)与安装建议。
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

from prometheus_client import Counter, Histogram

# ---------------------------------------------------------------------------
# Prometheus 指标(全局注册表,main.py Instrumentator 暴露在 /metrics)
# ---------------------------------------------------------------------------

# MCP 工具调用次数(按 server 与 status=success/failure)
mcp_tool_calls_total = Counter(
    "ihui_mcp_tool_calls_total",
    "Total MCP tool calls (inbound stdio + outbound external)",
    ["server", "status"],
)

# MCP 工具调用延迟分布(秒,按 server)
mcp_tool_latency_seconds = Histogram(
    "ihui_mcp_tool_latency_seconds",
    "MCP tool call latency in seconds",
    ["server"],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

# MCP 工具调用入参 schema 不兼容次数(按 server)
mcp_schema_mismatch_total = Counter(
    "ihui_mcp_schema_mismatch_total",
    "Total MCP tool calls with schema-incompatible arguments",
    ["server"],
)

# ---------------------------------------------------------------------------
# 进程内统计(看板查询用;Prometheus Counter 不便于按 server 聚合出"率")
# ---------------------------------------------------------------------------


@dataclass
class ServerStats:
    """单个 MCP Server 的累计调用统计(进程内,重启清零)。"""

    calls: int = 0
    successes: int = 0
    failures: int = 0
    latency_total: float = 0.0
    schema_mismatches: int = 0


# server 名 -> 累计统计
_STATS: dict[str, ServerStats] = {}
# server 名 -> 注入的工具名集合(跨 server 工具名冲突检测)
_SERVER_TOOLS: dict[str, set[str]] = {}
_LOCK = threading.Lock()


def record_tool_call(
    server_name: str,
    tool_name: str,
    duration_s: float,
    success: bool,
    schema_valid: bool = True,
) -> None:
    """记录一次 MCP 工具调用(延迟 / 成败 / schema 兼容)。

    由 mcp_stdio_bridge(入站)与 mcp_client(出站)在每次调用后上报;
    采集失败静默降级(指标采集绝不能影响工具调用本身)。

    Args:
        server_name: 来源 server 标识(商店 key 或外部注册名)
        tool_name: 工具名
        duration_s: 调用耗时(秒,perf_counter 差值)
        success: 调用是否成功(结果 ok 字段)
        schema_valid: 入参是否符合工具 input_schema(无 schema 时为 True)
    """
    try:
        status = "success" if success else "failure"
        mcp_tool_calls_total.labels(server=server_name, status=status).inc()
        mcp_tool_latency_seconds.labels(server=server_name).observe(max(0.0, duration_s))
        if not schema_valid:
            mcp_schema_mismatch_total.labels(server=server_name).inc()
        with _LOCK:
            st = _STATS.setdefault(server_name, ServerStats())
            st.calls += 1
            if success:
                st.successes += 1
            else:
                st.failures += 1
            st.latency_total += max(0.0, duration_s)
            if not schema_valid:
                st.schema_mismatches += 1
    except Exception:  # noqa: BLE001 - 指标采集失败不影响调用链
        pass


def note_server_tools(server_name: str, tool_names: list[str]) -> None:
    """登记/更新某 server 注入的工具名集合(供跨 server 冲突检测)。

    stdio bridge 热挂载后调用(全量替换);卸载时传空列表。
    """
    with _LOCK:
        if tool_names:
            _SERVER_TOOLS[server_name] = set(tool_names)
        else:
            _SERVER_TOOLS.pop(server_name, None)


def _collision_tools(server_name: str) -> tuple[int, int]:
    """返回 (该 server 与其他 server 重名的工具数, 该 server 工具总数)。"""
    with _LOCK:
        own = _SERVER_TOOLS.get(server_name)
        if not own:
            return 0, 0
        others: set[str] = set()
        for name, tools in _SERVER_TOOLS.items():
            if name != server_name:
                others |= tools
        return len(own & others), len(own)


def get_server_metrics(server_name: str) -> dict[str, Any]:
    """返回单 server 的派生指标(率与均值,看板明细用)。"""
    with _LOCK:
        st = _STATS.get(server_name)
        if st is None:
            stats = ServerStats()
        else:
            stats = st
    collided, total_tools = _collision_tools(server_name)
    calls = stats.calls
    return {
        "calls": calls,
        "successes": stats.successes,
        "failures": stats.failures,
        "success_rate": round(stats.successes / calls, 4) if calls else None,
        "avg_latency_s": round(stats.latency_total / calls, 4) if calls else None,
        "schema_mismatches": stats.schema_mismatches,
        "schema_compatibility": (
            round((calls - stats.schema_mismatches) / calls, 4) if calls else None
        ),
        "tools": total_tools,
        "collision_tools": collided,
    }


def servers_with_stats() -> list[str]:
    """有调用统计的 server 名列表(含目录外的外部注册 server)。"""
    with _LOCK:
        return sorted(_STATS.keys())


def reset_metrics_for_tests() -> None:
    """清空进程内统计(仅测试用)。"""
    with _LOCK:
        _STATS.clear()
        _SERVER_TOOLS.clear()


# ---------------------------------------------------------------------------
# Schema 兼容校验(轻量,不引入 jsonschema 依赖)
# ---------------------------------------------------------------------------

# JSON Schema type -> Python 类型
_TYPE_MAP: dict[str, tuple[type[Any], ...]] = {
    "string": (str,),
    "number": (int, float),
    "integer": (int,),
    "boolean": (bool,),
    "array": (list,),
    "object": (dict,),
}


def validate_arguments(schema: dict[str, Any] | None, arguments: dict[str, Any]) -> bool:
    """轻量校验入参是否符合工具 input_schema(仅 required 存在性 + 基础类型)。

    完整 JSON Schema 校验(枚举/pattern/嵌套等)不在此处;此处只回答
    "模型产出的参数能不能被 server 接受"的兼容性问题。
    无 schema / 非对象 schema 视为兼容(True)。
    """
    if not isinstance(schema, dict) or schema.get("type") not in (None, "object"):
        return True
    props = schema.get("properties") or {}
    required = schema.get("required") or []
    for key in required:
        if key not in arguments:
            return False
    for key, value in arguments.items():
        pdef = props.get(key)
        if not isinstance(pdef, dict):
            continue
        ptype = pdef.get("type")
        if isinstance(ptype, str) and ptype in _TYPE_MAP:
            # bool 是 int 的子类,显式排除避免 integer 误判
            expected = _TYPE_MAP[ptype]
            if ptype == "integer" and isinstance(value, bool):
                return False
            if ptype == "number" and isinstance(value, bool):
                return False
            if not isinstance(value, expected):
                return False
    return True


# ---------------------------------------------------------------------------
# 质量分(0-100 加权)
# ---------------------------------------------------------------------------

# 加权方案(H8 指标聚合,权重依据:
# - 成功率 40%:工具"能不能用"是最核心的可用性,权重最高;
# - 延迟分 30%:响应速度直接影响 Agent 循环节奏,次之;
# - schema 兼容 20%:入参兼容率影响模型调用成功率;
# - 冲突 10%:工具名冲突只影响寻址体验(prefix 策略可缓解),权重最低。)
WEIGHT_SUCCESS = 0.40
WEIGHT_LATENCY = 0.30
WEIGHT_SCHEMA = 0.20
WEIGHT_COLLISION = 0.10

# 延迟分分段:平均延迟 ≤0.5s 满分,≥10s 零分,之间线性插值
_LATENCY_FAST_S = 0.5
_LATENCY_SLOW_S = 10.0
# 无观测数据时的中性维度分(未安装 / 刚安装未调用的 server)
_NEUTRAL_SCORE = 75.0


def _latency_score(avg_s: float) -> float:
    """平均延迟 → 0-100 分(≤0.5s 满分,≥10s 零分,线性)。"""
    if avg_s <= _LATENCY_FAST_S:
        return 100.0
    if avg_s >= _LATENCY_SLOW_S:
        return 0.0
    return 100.0 * (_LATENCY_SLOW_S - avg_s) / (_LATENCY_SLOW_S - _LATENCY_FAST_S)


def grade_for(score: float) -> str:
    """质量分 → 等级(A/B/C/D)。"""
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    return "D"


def quality_assessment(server_name: str) -> dict[str, Any]:
    """聚合单 server 的质量分(含四维度明细,可解释)。

    Returns:
        {score, grade, dimensions: [{name, score, weight, detail}]}
    """
    metrics = get_server_metrics(server_name)
    calls = metrics["calls"]
    tools = metrics["tools"]

    if calls:
        success_score = float(metrics["success_rate"]) * 100.0
        success_detail = f"成功率 {metrics['success_rate']:.1%}({calls} 次调用)"
        latency_score = _latency_score(float(metrics["avg_latency_s"]))
        latency_detail = f"平均延迟 {metrics['avg_latency_s']}s"
        schema_score = float(metrics["schema_compatibility"]) * 100.0
        schema_detail = (
            f"schema 兼容率 {metrics['schema_compatibility']:.1%}"
            f"(不兼容 {metrics['schema_mismatches']} 次)"
        )
    else:
        success_score = _NEUTRAL_SCORE
        success_detail = "暂无调用数据(中性基准分)"
        latency_score = _NEUTRAL_SCORE
        latency_detail = "暂无调用数据(中性基准分)"
        schema_score = _NEUTRAL_SCORE
        schema_detail = "暂无调用数据(中性基准分)"

    if tools:
        collision_rate = metrics["collision_tools"] / tools
        collision_score = 100.0 * (1.0 - collision_rate)
        collision_detail = (
            f"工具冲突 {metrics['collision_tools']}/{tools}"
            f"(冲突率 {collision_rate:.1%})"
        )
    else:
        collision_score = _NEUTRAL_SCORE
        collision_detail = "暂无注入工具(中性基准分)"

    dimensions = [
        {
            "name": "成功率",
            "score": round(success_score, 1),
            "weight": WEIGHT_SUCCESS,
            "detail": success_detail,
        },
        {
            "name": "延迟",
            "score": round(latency_score, 1),
            "weight": WEIGHT_LATENCY,
            "detail": latency_detail,
        },
        {
            "name": "schema 兼容",
            "score": round(schema_score, 1),
            "weight": WEIGHT_SCHEMA,
            "detail": schema_detail,
        },
        {
            "name": "冲突",
            "score": round(collision_score, 1),
            "weight": WEIGHT_COLLISION,
            "detail": collision_detail,
        },
    ]
    score = (
        success_score * WEIGHT_SUCCESS
        + latency_score * WEIGHT_LATENCY
        + schema_score * WEIGHT_SCHEMA
        + collision_score * WEIGHT_COLLISION
    )
    return {
        "score": round(score, 1),
        "grade": grade_for(score),
        "dimensions": dimensions,
        "metrics": metrics,
    }


# ---------------------------------------------------------------------------
# 权限风险评分(静态,安全分 0-100,越高越安全)
# ---------------------------------------------------------------------------

# 高危能力维度 → (扣分, 风险说明)。高危能力越多,安全分越低。
_RISK_DIMENSIONS: dict[str, tuple[int, str]] = {
    "command_exec": (30, "可执行系统命令(任意代码执行风险)"),
    "ui_control": (30, "浏览器/桌面控制能力(可替代用户操作)"),
    "file_write": (25, "本地文件写入权限(数据篡改/泄露风险)"),
    "database": (25, "数据库访问(敏感数据风险)"),
    "credentials": (20, "需持有令牌/凭据(凭据泄露风险)"),
    "network": (15, "外部网络访问(数据外传通道)"),
    "repo_write": (15, "代码仓库写操作"),
}

# 内置目录 key → 高危能力维度(静态声明;内置目录均已人工预审)
_DIRECTORY_RISK: dict[str, frozenset[str]] = {
    "filesystem": frozenset({"file_write"}),
    "git": frozenset({"command_exec", "repo_write"}),
    "fetch": frozenset({"network"}),
    "memory": frozenset(),
    "sequential-thinking": frozenset(),
    "time": frozenset(),
    "postgres": frozenset({"database", "credentials"}),
    "github": frozenset({"credentials", "network", "repo_write"}),
}

# 未知 server(外部注册,非内置目录)按名称关键字启发式推断高危维度
_NAME_RISK_RULES: list[tuple[tuple[str, ...], str]] = [
    (("shell", "exec", "terminal", "bash", "command"), "command_exec"),
    (("browser", "computer", "playwright", "selenium"), "ui_control"),
    (("fs", "file", "filesystem", "filesystem"), "file_write"),
    (("db", "sql", "postgres", "mysql", "sqlite", "database"), "database"),
    (("fetch", "http", "web", "crawl", "scraper"), "network"),
    (("token", "credential", "oauth", "secret"), "credentials"),
    (("git", "repo"), "repo_write"),
]

# 未识别外部 server 的基准分(来源不可验证,从 medium 起评)
_UNKNOWN_BASE_SCORE = 70

# 安全分 → 风险等级阈值(越高越安全)
_SECURITY_LEVELS: list[tuple[float, str]] = [
    (80.0, "low"),
    (60.0, "medium"),
    (40.0, "high"),
    (0.0, "critical"),
]

_RECOMMENDATIONS: dict[str, str] = {
    "low": "风险较低,可直接安装使用",
    "medium": "存在一定权限风险,建议确认来源可信后再安装",
    "high": "高风险:建议仅在隔离/沙箱环境使用,并限制可访问范围",
    "critical": "极高风险:不建议安装;如必须使用,请在沙箱环境运行并全程审计",
}


def _security_level(score: float) -> str:
    """安全分 → 风险等级(low/medium/high/critical)。"""
    for threshold, level in _SECURITY_LEVELS:
        if score >= threshold:
            return level
    return "critical"


def _infer_risk_dimensions(key: str, name: str) -> frozenset[str]:
    """未知 server 按名称关键字推断高危维度。"""
    text = f"{key} {name}".lower()
    dims: set[str] = set()
    for keywords, dim in _NAME_RISK_RULES:
        if any(k in text for k in keywords):
            dims.add(dim)
    return frozenset(dims)


def security_assessment(key: str, name: str = "") -> dict[str, Any]:
    """单 server 权限风险静态评分(按声明的高危能力扣分)。

    Returns:
        {score, level, confirm_required, risk_factors, dimensions, recommendation}
    """
    dims = _DIRECTORY_RISK.get(key)
    if dims is None:
        dims = _infer_risk_dimensions(key, name)
        score = float(_UNKNOWN_BASE_SCORE)
    else:
        score = 100.0

    risk_factors: list[str] = []
    dimensions: list[dict[str, Any]] = []
    for dim in sorted(dims):
        penalty, factor = _RISK_DIMENSIONS[dim]
        score -= penalty
        risk_factors.append(factor)
        dimensions.append(
            {
                "name": dim,
                "score": round(100.0 - penalty, 1),
                "weight": penalty / 100.0,
                "detail": factor,
            }
        )
    score = max(0.0, min(100.0, score))
    level = _security_level(score)
    if not risk_factors:
        risk_factors = ["未声明高危能力(只读/纯计算类工具)"]
    return {
        "score": round(score, 1),
        "level": level,
        "confirm_required": level in ("high", "critical"),
        "risk_factors": risk_factors,
        "dimensions": dimensions,
        "recommendation": _RECOMMENDATIONS[level],
    }


# ---------------------------------------------------------------------------
# 入口级 API(评分摘要 / 完整明细 / 看板)
# ---------------------------------------------------------------------------


def scoring_summary(key: str, name: str = "") -> dict[str, Any]:
    """商店列表内联评分摘要(契约对齐 api-client McpScoringSummary)。"""
    quality = quality_assessment(key)
    security = security_assessment(key, name)
    return {
        "score": quality["score"],
        "grade": quality["grade"],
        "security_score": security["score"],
        "security_level": security["level"],
        "confirm_required": security["confirm_required"],
    }


def score_detail(key: str, name: str = "") -> dict[str, Any]:
    """商店条目评分完整明细(契约对齐 api-client McpScoreDetail)。"""
    quality = quality_assessment(key)
    security = security_assessment(key, name)
    return {
        "key": key,
        "name": name or key,
        "quality": {"score": quality["score"], "grade": quality["grade"]},
        "security": {"score": security["score"], "level": security["level"]},
        "confirm_required": security["confirm_required"],
        "risk_factors": security["risk_factors"],
        "dimensions": {
            "quality": quality["dimensions"],
            "security": security["dimensions"],
        },
        "recommendation": security["recommendation"],
    }


def quality_dashboard() -> list[dict[str, Any]]:
    """质量看板(H8):各 server 质量分 + 安全分 + 运行时指标明细。

    覆盖内置目录条目 + 有调用统计的外部注册 server(合并去重)。
    """
    from .mcp_directory import get_directory

    servers: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in get_directory():
        key = entry["key"]
        seen.add(key)
        servers.append(_dashboard_entry(key, entry["name"]))
    for server_name in servers_with_stats():
        if server_name not in seen:
            servers.append(_dashboard_entry(server_name, server_name))
    return servers


def _dashboard_entry(key: str, name: str) -> dict[str, Any]:
    """单个 server 的看板条目(指标 + 质量分 + 安全分)。"""
    quality = quality_assessment(key)
    security = security_assessment(key, name)
    return {
        "key": key,
        "name": name,
        "metrics": quality["metrics"],
        "quality": {
            "score": quality["score"],
            "grade": quality["grade"],
            "dimensions": quality["dimensions"],
        },
        "security": {
            "score": security["score"],
            "level": security["level"],
            "risk_factors": security["risk_factors"],
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
