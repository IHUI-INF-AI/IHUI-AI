# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE-NEW]: new file. MCP 生态质量分与安全评分引擎(P1 1-4,2026-09-08 立)。

"""MCP 生态质量分与安全评分(P1 1-4)。

对标 Claude Code/Codex 的 MCP 接入治理:每个 MCP Server(商店目录条目/外部注册)
在安装前给出**确定性**的两组评分,供前端展示与安装确认门使用:

- **质量分(quality,0-100,越高越好)**:来源(official 加分)、描述完整度、
  transport 现代性、env_default 文档化、tags、运行态工具数。
- **安全分(security,0-100,越高越安全)** + 风险等级(LOW/MEDIUM/HIGH/CRITICAL):
  凭据类 env(TOKEN/SECRET/KEY/PASSWORD/DATABASE_URL)暴露、npx 运行时拉包
  供应链风险、能力语义(文件写/数据库/网络出站/代码托管写)。

设计约束(与 mcp_directory/mcp_marketplace 一致):
- 纯服务层、确定性、零网络、零副作用:同一输入永远同一评分,单元测试密闭。
- 输入用 duck-typing dict 或 DirectoryEntry 兼容视图,不反向依赖路由层。
- 评分明细返回 `dimensions` 列表({name, score, weight, detail}),可解释。
"""

from __future__ import annotations

from typing import Any

# =============================================================================
# 常量:风险等级 / 评分权重
# =============================================================================

RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"
RISK_CRITICAL = "critical"

# 风险等级阈值(安全分越低风险越高)
_RISK_THRESHOLDS: list[tuple[int, str]] = [
    (40, RISK_CRITICAL),
    (60, RISK_HIGH),
    (80, RISK_MEDIUM),
]
# 默认(≥80)LOW

# 需要人工确认的等级(安装 confirm_risk 门)
RISK_CONFIRM_REQUIRED: frozenset[str] = frozenset({RISK_HIGH, RISK_CRITICAL})

# 质量等级阈值(质量分越高越好)
_GRADE_THRESHOLDS: list[tuple[int, str]] = [
    (90, "A"),
    (75, "B"),
    (60, "C"),
]
# 默认(≥60)D → 等级列表里 60 以下是 "D"

# 凭据类环境变量关键词(命中任一 → 凭据暴露风险)
_CREDENTIAL_ENV_KEYWORDS: tuple[str, ...] = (
    "TOKEN",
    "SECRET",
    "KEY",
    "PASSWORD",
    "PASSWD",
    "CREDENTIAL",
    "DATABASE_URL",
    "DSN",
)

# 供应链可信命令白名单(npx/node/python 等常见运行时;白名单外扣分更多)
_KNOWN_RUNTIMES: frozenset[str] = frozenset(
    {"npx", "node", "python", "python3", "uv", "uvx", "pipx"}
)

# 能力语义风险(按目录 key / 包名关键词匹配)
_CAPABILITY_RISKS: tuple[tuple[tuple[str, ...], int, str], ...] = (
    # (关键词组, 扣分, 说明) —— 扣分叠加,封顶见 _score_security
    (("postgres", "sqlite", "mysql", "database", "db"), 15, "数据库访问(数据外泄面)"),
    (("filesystem", "fs", "file"), 12, "本地文件读写(任意路径需确认)"),
    (("fetch", "http", "web", "search", "brave", "puppeteer", "browser"), 10, "网络出站访问"),
    (("github", "gitlab", "gitee", "bitbucket"), 12, "代码托管读写(推送/删除面)"),
    (("shell", "terminal", "exec", "command"), 20, "命令执行(最高危)"),
)


def _clamp(value: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, value))


# =============================================================================
# 统一输入视图(dict duck-typing,兼容 DirectoryEntry.to_dict / store 记录)
# =============================================================================


def _as_view(entry: Any) -> dict[str, Any]:
    """把 DirectoryEntry / dict / store 记录归一为评分输入视图。

    接受字段:key, name, description, source, transport, command, args,
    env_required, env_default, installed, enabled, tool_count, verified, tags。
    """
    if isinstance(entry, dict):
        d = entry
    else:
        d = {
            "key": getattr(entry, "key", ""),
            "name": getattr(entry, "name", ""),
            "description": getattr(entry, "description", "") or "",
            "source": getattr(entry, "source", ""),
            "transport": getattr(entry, "transport", ""),
            "command": getattr(entry, "command", "") or "",
            "args": list(getattr(entry, "args", []) or []),
            "env_required": list(getattr(entry, "env_required", []) or []),
            "env_default": dict(getattr(entry, "env_default", {}) or {}),
        }
    return {
        "key": str(d.get("key") or d.get("name") or ""),
        "name": str(d.get("name") or d.get("key") or ""),
        "description": str(d.get("description") or ""),
        "source": str(d.get("source") or ""),
        "transport": str(d.get("transport") or ""),
        "command": str(d.get("command") or ""),
        "args": [str(a) for a in (d.get("args") or [])],
        "env_required": [str(e) for e in (d.get("env_required") or [])],
        "env_default": {
            str(k): str(v) for k, v in (d.get("env_default") or {}).items()
        },
        "installed": bool(d.get("installed")),
        "enabled": bool(d.get("enabled")),
        "tool_count": int(d.get("tool_count") or 0),
        "verified": bool(d.get("verified")),
        "tags": [str(t) for t in (d.get("tags") or [])],
        "package": str(d.get("package") or ""),
    }


# =============================================================================
# 质量分
# =============================================================================


def _score_quality(v: dict[str, Any]) -> tuple[int, list[dict[str, Any]]]:
    """质量分(0-100)+ 维度明细。"""
    dims: list[dict[str, Any]] = []

    # 1) 来源(25):official 25 / community 12 / 未知 0
    src_score = 25 if v["source"] == "official" else (12 if v["source"] else 0)
    dims.append(
        {
            "name": "source",
            "score": src_score,
            "weight": 25,
            "detail": "官方维护" if src_score == 25 else (
                "社区维护" if src_score else "来源未知"
            ),
        }
    )

    # 2) 描述完整度(25):≥ 30 字 25 / ≥ 12 字 15 / 非空 8 / 空 0
    desc_len = len(v["description"])
    if desc_len >= 30:
        desc_score, desc_detail = 25, f"描述完整({desc_len} 字)"
    elif desc_len >= 12:
        desc_score, desc_detail = 15, f"描述偏短({desc_len} 字)"
    elif desc_len > 0:
        desc_score, desc_detail = 8, f"描述过短({desc_len} 字)"
    else:
        desc_score, desc_detail = 0, "无描述"
    dims.append(
        {"name": "description", "score": desc_score, "weight": 25, "detail": desc_detail}
    )

    # 3) transport 现代性(15):http/streamable 15 / sse 12 / stdio 10 / 其他 0
    t = v["transport"].lower()
    if t in ("http", "streamable_http", "streamable-http"):
        tp_score, tp_detail = 15, "现代 HTTP 传输"
    elif t == "sse":
        tp_score, tp_detail = 12, "SSE 传输"
    elif t == "stdio":
        tp_score, tp_detail = 10, "stdio 传输"
    else:
        tp_score, tp_detail = 0, f"未知传输({t!r})"
    dims.append(
        {"name": "transport", "score": tp_score, "weight": 15, "detail": tp_detail}
    )

    # 4) 环境变量文档化(15):全部必需 env 有非空默认值 15 / 部分 8 / 无必需 env 15
    env_req = v["env_required"]
    if not env_req:
        env_score, env_detail = 15, "无需凭据配置"
    else:
        provided = sum(
            1 for k in env_req if str(v["env_default"].get(k, "")).strip()
        )
        if provided == len(env_req):
            env_score, env_detail = 15, f"必需 env 均有默认值({provided}/{len(env_req)})"
        elif provided > 0:
            env_score, env_detail = 8, f"部分 env 有默认值({provided}/{len(env_req)})"
        else:
            env_score, env_detail = 5, f"必需 env 无默认值({len(env_req)} 项)"
    dims.append(
        {"name": "env_docs", "score": env_score, "weight": 15, "detail": env_detail}
    )

    # 5) 标签丰富度(10):≥ 3 个 10 / ≥ 1 个 6 / 0 个 0
    tag_n = len(v["tags"])
    tag_score = 10 if tag_n >= 3 else (6 if tag_n >= 1 else 0)
    dims.append(
        {
            "name": "tags",
            "score": tag_score,
            "weight": 10,
            "detail": f"{tag_n} 个标签",
        }
    )

    # 6) 运行态验证(10):verified 10 / 已安装且启用且 tool_count>0 7 / 已安装 4 / 未装 3
    if v["verified"]:
        rt_score, rt_detail = 10, "已通过静态验证"
    elif v["installed"] and v["enabled"] and v["tool_count"] > 0:
        rt_score, rt_detail = 7, f"运行中({v['tool_count']} 工具)"
    elif v["installed"]:
        rt_score, rt_detail = 4, "已安装(停用)"
    else:
        rt_score, rt_detail = 3, "未安装(仅目录)"
    dims.append(
        {"name": "runtime", "score": rt_score, "weight": 10, "detail": rt_detail}
    )

    total = _clamp(sum(d["score"] for d in dims))
    return total, dims


def _grade_of(score: int) -> str:
    for threshold, grade in _GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "D"


# =============================================================================
# 安全分 / 风险等级
# =============================================================================


def _score_security(v: dict[str, Any]) -> tuple[int, list[dict[str, Any]], list[str]]:
    """安全分(0-100,越高越安全)+ 维度明细 + 风险因素列表(人话)。"""
    dims: list[dict[str, Any]] = []
    factors: list[str] = []

    # 1) 凭据暴露(权重 35):必需 env 含 TOKEN/SECRET/KEY/... → 扣分
    cred_envs = [
        e
        for e in v["env_required"]
        if any(kw in e.upper() for kw in _CREDENTIAL_ENV_KEYWORDS)
    ]
    if not cred_envs:
        cred_score, cred_detail = 35, "无需凭据"
    else:
        cred_score = _clamp(35 - 18 * len(cred_envs), 0, 35)
        cred_detail = f"需注入凭据: {', '.join(cred_envs)}"
        factors.append(f"需向该 Server 注入凭据({', '.join(cred_envs)}),存在凭据外泄面")
    dims.append(
        {"name": "credentials", "score": cred_score, "weight": 35, "detail": cred_detail}
    )

    # 2) 供应链(权重 30):npx 运行时拉远端包(中扣)/ 未知命令(大扣)/ 白名单非 npx 小扣
    cmd = v["command"].strip().lower()
    # 兼容:包名可能只出现在 args(如 npx -y @modelcontextprotocol/server-*)
    args_blob = " ".join(v["args"]).lower()
    pkg = v["package"].lower()
    blob = f"{v['key']} {v['name']} {args_blob} {pkg}".lower()
    if not cmd:
        sup_score, sup_detail = 0, "未声明 command(无法审计执行体)"
        factors.append("未声明启动命令,无法审计将执行的代码")
    elif cmd == "npx":
        # npx 每次启动解析远端 npm 包(tag 未固定时 = 供应链漂移)
        pinned = any(a.startswith("@") and a.count("@") >= 2 for a in v["args"])
        if pinned:
            sup_score, sup_detail = 22, "npx 且包名已固定版本(供应链风险低)"
        else:
            sup_score, sup_detail = 18, "npx 运行时拉取远端 npm 包(供应链漂移)"
            factors.append("npx 运行时拉取远端 npm 包,包版本未锁定(供应链风险)")
    elif cmd in _KNOWN_RUNTIMES:
        sup_score, sup_detail = 24, f"本地运行时启动({cmd})"
    else:
        sup_score, sup_detail = 10, f"非白名单命令({cmd})"
        factors.append(f"启动命令 {cmd!r} 不在已知运行时白名单,建议人工审计")
    dims.append(
        {"name": "supply_chain", "score": sup_score, "weight": 30, "detail": sup_detail}
    )

    # 3) 能力语义(权重 35):数据库/文件写/网络出站/代码托管/命令执行叠加扣分
    cap_penalty = 0
    cap_details: list[str] = []
    for keywords, penalty, label in _CAPABILITY_RISKS:
        if any(kw in blob for kw in keywords):
            cap_penalty += penalty
            cap_details.append(label)
            factors.append(label)
    cap_penalty = min(cap_penalty, 35)
    cap_score = _clamp(35 - cap_penalty, 0, 35)
    cap_detail = "; ".join(cap_details) if cap_details else "只读/无敏感能力"
    if not cap_details:
        factors_clear_note = "未识别敏感能力语义"
    else:
        factors_clear_note = cap_detail
    dims.append(
        {
            "name": "capability",
            "score": cap_score,
            "weight": 35,
            "detail": factors_clear_note,
        }
    )

    total = _clamp(sum(d["score"] for d in dims))
    return total, dims, factors


def _risk_level_of(security_score: int) -> str:
    for threshold, level in _RISK_THRESHOLDS:
        if security_score < threshold:
            return level
    return RISK_LOW


# =============================================================================
# 公开 API
# =============================================================================


def score_entry(entry: Any) -> dict[str, Any]:
    """对单个 MCP Server(目录条目/安装记录/外部注册)打分。

    返回:
    {
      "key": str,
      "name": str,
      "quality": {"score": int, "grade": "A"|"B"|"C"|"D"},
      "security": {"score": int, "level": "low"|"medium"|"high"|"critical"},
      "confirm_required": bool,          # high/critical → True
      "risk_factors": [str, ...],        # 人话风险因素(空列表=无)
      "dimensions": {"quality": [...], "security": [...]},
      "recommendation": str,             # 安装建议一句话
    }
    """
    v = _as_view(entry)
    q_score, q_dims = _score_quality(v)
    s_score, s_dims, factors = _score_security(v)
    level = _risk_level_of(s_score)
    confirm = level in RISK_CONFIRM_REQUIRED

    if level == RISK_CRITICAL:
        rec = "高风险:建议仅在你完全信任该 Server 来源时安装"
    elif level == RISK_HIGH:
        rec = "中高风险:安装前请确认风险因素"
    elif level == RISK_MEDIUM:
        rec = "中低风险:可安装,注意凭据与出站行为"
    else:
        rec = "低风险:可放心安装"

    return {
        "key": v["key"],
        "name": v["name"],
        "quality": {"score": q_score, "grade": _grade_of(q_score)},
        "security": {"score": s_score, "level": level},
        "confirm_required": confirm,
        "risk_factors": factors,
        "dimensions": {"quality": q_dims, "security": s_dims},
        "recommendation": rec,
    }


def score_store_list(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """批量打分(商店合并列表场景),返回 {key: 内联摘要(不含 dimensions)}。

    内联摘要供 /mcp/store 列表项直接携带,体积小;明细走 score_entry / GET /score。
    """
    out: dict[str, dict[str, Any]] = {}
    for e in entries:
        full = score_entry(e)
        out[full["key"]] = {
            "score": full["quality"]["score"],
            "grade": full["quality"]["grade"],
            "security_score": full["security"]["score"],
            "security_level": full["security"]["level"],
            "confirm_required": full["confirm_required"],
        }
    return out


def inline_summary(entry: Any) -> dict[str, Any]:
    """单条目内联摘要(轻量,供列表项/市场视图携带)。"""
    full = score_entry(entry)
    return {
        "score": full["quality"]["score"],
        "grade": full["quality"]["grade"],
        "security_score": full["security"]["score"],
        "security_level": full["security"]["level"],
        "confirm_required": full["confirm_required"],
    }


__all__ = [
    "RISK_LOW",
    "RISK_MEDIUM",
    "RISK_HIGH",
    "RISK_CRITICAL",
    "RISK_CONFIRM_REQUIRED",
    "score_entry",
    "score_store_list",
    "inline_summary",
]
