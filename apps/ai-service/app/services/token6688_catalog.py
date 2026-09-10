# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""token6688 模型目录消费层(2026-09-08 立)—— 同步入库富元数据的统一读取与校验。

数据流
------
ModelSyncService 每 6 小时把上游 /v1/logical-models 富元数据(param_schema/
capabilities/linkages/input_hint_zh/max_prompt_chars/special_tier_notice 等)
同步进 ai_model_config_models.metadata(jsonb)。本模块提供:

1. get_model_metadata(model_id)     —— 单模型元数据(带 120s TTL 缓存,免重复查库)
2. list_models(modality=None)       —— 目录清单(按 modality 过滤,含官方价描述)
3. validate_generation_params(...)  —— 生成工具提交前 fail-fast 参数校验:
   - enum 参数:值必须 ∈ param_schema[p].enum(否则上游会静默落默认档,白花钱)
   - int 参数:min/max 范围
   - prompt 长度:max_prompt_chars 上限(超长上游直接报错)
   - linkages 参数联动:mode=first-frame 需传 images / 纯文生传 images 会被拒
4. summarize_params_for_agent(...)  —— param_schema → MCP 工具可读摘要
   (label/default/allowed_values/required/available_when,agent 构造参数直读)

设计原则
--------
- 校验失败返回结构化 issues(可读中文),调用方(MCP 工具)直接当 ok=false 返回,
  agent 拿 allowed_values 自我修正重试 —— 省掉一次注定失败的上游计费请求。
- 全部纯函数 + 一个异步 DB 读取函数;元数据缺失(未同步/列不存在)时校验自动
  跳过(返回空 issues),不阻塞正常调用路径。
"""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# 元数据 TTL 缓存(秒):同步 6 小时一次,120s 足够新且省查询
_METADATA_CACHE_TTL_S = 120.0

# linkages action 常量(上游 /v1/logical-models.linkages,如 veo-3.1)
_ACTION_REQUIRE = "require"
_ACTION_HIDE = "hide"

# modality 中文名(清单展示用)
_MODALITY_ZH = {"chat": "对话", "video": "视频", "image": "图片", "audio": "音频"}

__all__ = [
    "get_model_metadata",
    "list_models",
    "invalidate_metadata_cache",
    "validate_generation_params",
    "summarize_params_for_agent",
    "MODALITY_ZH",
]

MODALITY_ZH = _MODALITY_ZH


# ---------------------------------------------------------------------------
# 元数据读取(带 TTL 缓存)
# ---------------------------------------------------------------------------

_metadata_cache: dict[str, tuple[float, dict[str, Any] | None]] = {}


async def get_model_metadata(model_id: str) -> dict[str, Any] | None:
    """读单模型 metadata jsonb(ai_model_config_models ⋈ ai_model_config)。

    命中 TTL 缓存不查库;查不到(未同步/不存在/列缺失)返回 None,调用方自行
    降级(跳过校验或走实时上游拉取)。
    """
    mid = str(model_id or "").strip()
    if not mid:
        return None
    now = time.monotonic()
    hit = _metadata_cache.get(mid)
    if hit is not None and now - hit[0] < _METADATA_CACHE_TTL_S:
        return hit[1]
    try:
        from ..core.db_pool import get_shared_pool

        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT m.metadata FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE c.provider_code = 'token6688'
                     AND c.enabled = true
                     AND (m.model_id = $1 OR m.model_id = $2)
                     AND m.enabled = true
                   LIMIT 1""",
                mid,
                mid.removeprefix("t6688/"),
            )
    except Exception as e:  # noqa: BLE001 — 查库失败降级 None,不阻塞调用方
        logger.warning("[token6688_catalog] 元数据查询失败(降级跳过校验): %s", e)
        row = None
    meta: dict[str, Any] | None = None
    raw = row["metadata"] if row else None
    if isinstance(raw, dict) and raw:
        meta = raw
    elif isinstance(raw, str) and raw.strip():
        # 防御:异常路径下可能是字符串
        import json as _json

        try:
            parsed = _json.loads(raw)
            meta = parsed if isinstance(parsed, dict) and parsed else None
        except ValueError:
            meta = None
    _metadata_cache[mid] = (now, meta)
    return meta


def invalidate_metadata_cache() -> None:
    """清空 TTL 缓存(同步完成后/测试用)。"""
    _metadata_cache.clear()


async def list_models(modality: str | None = None) -> list[dict[str, Any]]:
    """目录清单(上游可用模型,含富元数据摘要)。

    Args:
        modality: chat/video/image/audio 过滤;None=全部。

    Returns:
        [{model_id, display_name, modality, description, capabilities,
          health_score, sort_weight, vendor, billing_mode, input_hint_zh}, ...]
        按 sort_weight 升序;元数据缺失的行退化为基础字段。
    """
    try:
        from ..core.db_pool import get_shared_pool

        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT m.model_id, m.display_name, m.description, m.tags,
                          m.metadata
                   FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE c.provider_code = 'token6688'
                     AND c.enabled = true AND m.enabled = true
                     AND m.is_relay_public = true
                   ORDER BY m.model_id"""
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("[token6688_catalog] 目录清单查询失败: %s", e)
        return []
    out: list[dict[str, Any]] = []
    for r in rows:
        meta = r["metadata"] if isinstance(r["metadata"], dict) else {}
        tags = {str(t).lower() for t in (r["tags"] or [])}
        mod = str(meta.get("logical_type") or meta.get("modality") or "")
        if not mod:
            mod = next((t for t in ("chat", "video", "image", "audio") if t in tags), "")
        if modality and mod != str(modality).lower():
            continue
        out.append({
            "model_id": r["model_id"],
            "display_name": r["display_name"] or r["model_id"],
            "modality": mod,
            "modality_zh": _MODALITY_ZH.get(mod, mod or "未知"),
            "description": (r["description"] or "")[:200],
            "capabilities": meta.get("capabilities") or [],
            "health_score": meta.get("health_score"),
            "sort_weight": meta.get("sort_weight"),
            "vendor": meta.get("vendor") or meta.get("provider_code"),
            "billing_mode": meta.get("billing_mode"),
            "input_hint_zh": meta.get("input_hint_zh"),
        })
    out.sort(key=lambda x: (
        x["sort_weight"] if isinstance(x["sort_weight"], (int, float)) else 10**9,
        x["model_id"],
    ))
    return out


# ---------------------------------------------------------------------------
# 提交前 fail-fast 参数校验(纯函数,可单测)
# ---------------------------------------------------------------------------


def _param_schema_get(param_schema: Any, name: str) -> dict[str, Any] | None:
    if not isinstance(param_schema, dict):
        return None
    p = param_schema.get(name)
    return p if isinstance(p, dict) else None


def _allowed_values(schema_p: dict[str, Any]) -> list[str]:
    """参数合法值:enum 优先,options[].value 兜底(官方"发 value 不发显示名")。"""
    enum = schema_p.get("enum")
    if isinstance(enum, list) and enum:
        return [str(v) for v in enum]
    opts = schema_p.get("options")
    if isinstance(opts, list) and opts:
        return [
            str(o.get("value")) for o in opts
            if isinstance(o, dict) and o.get("value") is not None
        ]
    return []


def validate_generation_params(
    param_schema: Any,
    params: dict[str, Any],
    *,
    prompt: str = "",
    linkages: Any = None,
) -> list[str]:
    """生成提交前参数校验,返回 issues 列表(空=通过)。

    校验维度(全部来自上游 param_schema 机读数据):
    1. 未知参数:参数名不在 param_schema → 提示(可能拼错,枚举错值上游静默落默认)
    2. enum 参数:值 ∈ enum/options[].value
    3. int 参数:min/max
    4. prompt 长度:param_schema["_max_prompt_chars"](由调用方从 metadata 合入)
    5. linkages:require(缺参数)/hide(多传参数)

    注意:param_schema 为空/非 dict 时返回 [](未同步或非受管模型,不阻塞)。
    """
    issues: list[str] = []
    if not isinstance(param_schema, dict) or not param_schema:
        return issues
    if not isinstance(params, dict):
        params = {}
    linkages = linkages if isinstance(linkages, list) else []

    # linkages 声明的受控参数(如 images/audios):官方素材参数,可能不在
    # param_schema 里单独定义(由联动规则声明),豁免"未知参数"检查
    linked_params = {
        str(lk.get("affected_param"))
        for lk in linkages
        if isinstance(lk, dict) and lk.get("affected_param")
    }

    # 1. prompt 长度(约定键 _max_prompt_chars;媒体模型上限可达 30000)
    max_chars = param_schema.get("_max_prompt_chars")
    if isinstance(max_chars, int) and max_chars > 0 and prompt and len(prompt) > max_chars:
        issues.append(
            f"prompt 长度 {len(prompt)} 超过该模型上限 {max_chars} 字符,请精简后重试"
        )

    # 2. 未知参数提示(排除内部约定键与 linkages 受控素材参数)
    for k in params:
        if k.startswith("_") or k in linked_params:
            continue
        if _param_schema_get(param_schema, k) is None:
            known = sorted(
                pk for pk in param_schema if not str(pk).startswith("_")
            )
            issues.append(
                f"参数 {k!r} 不是该模型的官方参数;该模型可用参数: {known}"
            )

    # 3. enum / int 校验
    for k, v in params.items():
        if k.startswith("_") or v is None:
            continue
        p = _param_schema_get(param_schema, k)
        if p is None:
            continue
        allowed = _allowed_values(p)
        if allowed and str(v) not in allowed:
            issues.append(
                f"参数 {k}={v!r} 不在合法值内,允许值: {allowed}"
                "(必须发 value,不是界面显示名,否则上游静默落默认档)"
            )
            continue
        if str(p.get("type") or "").lower() == "int":
            mn, mx = p.get("min"), p.get("max")
            if isinstance(v, bool):  # bool 是 int 子类,排除
                continue
            if not isinstance(v, int):
                try:
                    v = int(str(v).strip())
                except ValueError:
                    issues.append(f"参数 {k} 需要整数,收到 {v!r}")
                    continue
            if isinstance(mn, (int, float)) and v < mn:
                issues.append(f"参数 {k}={v} 低于下限 {int(mn)}")
            if isinstance(mx, (int, float)) and v > mx:
                issues.append(f"参数 {k}={v} 超过上限 {int(mx)}")

    # 4. linkages 参数联动(mode 决定 images 是否必传/禁传)
    if isinstance(linkages, list):
        for lk in linkages:
            if not isinstance(lk, dict):
                continue
            action = str(lk.get("action") or "")
            affected = str(lk.get("affected_param") or "")
            control = str(lk.get("control_param") or "")
            control_value = lk.get("control_value")
            if not affected or not control:
                continue
            active = params.get(control) == control_value
            if action == _ACTION_REQUIRE and active:
                if params.get(affected) in (None, "", []) and control in params:
                    issues.append(
                        f"当前 {control}={control_value!r} 时必须提供参数 "
                        f"{affected!r}(原因: {lk.get('reason') or '官方参数联动规则'})"
                    )
            elif action == _ACTION_HIDE and active:
                if params.get(affected) not in (None, "", []):
                    issues.append(
                        f"当前 {control}={control_value!r} 时不应传参数 "
                        f"{affected!r}(原因: {lk.get('reason') or '官方参数联动规则'})"
                    )
    return issues


def summarize_params_for_agent(
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """param_schema(linked-models dict 形态)→ agent 可读参数摘要。

    输出:每个参数 {name, label, type, required, default, allowed_values,
    min/max( int 时), description(截断), available_when};附模型级
    capabilities/input_hint_zh/max_prompt_chars/linkages(联动规则对 agent
    构造 images/audios 等素材参数直接有用)。
    """
    out: dict[str, Any] = {"params": []}
    if not isinstance(metadata, dict):
        return out
    ps = metadata.get("param_schema")
    summary: list[dict[str, Any]] = []
    if isinstance(ps, dict) and ps:
        for name, p in ps.items():
            if str(name).startswith("_") or not isinstance(p, dict):
                continue
            item: dict[str, Any] = {
                "name": name,
                "type": p.get("type"),
                "required": bool(p.get("required")),
                "allowed_values": _allowed_values(p),
            }
            label = p.get("label")
            if isinstance(label, dict):
                item["label"] = label.get("zh") or label.get("en") or name
            default = p.get("default")
            if default is not None:
                item["default"] = default
            if p.get("type") == "int":
                if isinstance(p.get("min"), (int, float)):
                    item["min"] = int(p["min"])
                if isinstance(p.get("max"), (int, float)):
                    item["max"] = int(p["max"])
            if p.get("description"):
                item["description"] = str(p["description"])[:200]
            if isinstance(p.get("available_when"), dict):
                item["available_when"] = p["available_when"]
            if isinstance(p.get("max_items"), int):
                item["max_items"] = p["max_items"]
            if isinstance(p.get("max_bytes"), int):
                item["max_bytes"] = p["max_bytes"]
            summary.append(item)
    out["params"] = summary
    for k in ("capabilities", "input_hint_zh", "max_prompt_chars", "linkages"):
        if metadata.get(k):
            out[k] = metadata[k]
    return out
