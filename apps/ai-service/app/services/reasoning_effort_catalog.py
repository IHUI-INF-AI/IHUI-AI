# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""推理强度档位的**上游真实枚举**采集(2026-11-21 D137 立)。

为什么需要
----------
D130 的 `reasoning_effort` 值域(七档)是本仓契约全集,不等于"某个模型上游真能切
哪几档"。OpenAI 官方口径是 **model-dependent**(gpt-5-pro 只收 high,gpt-5.1 收
none/low/medium/high,`xhigh` 自 gpt-5.1-codex-max 之后才有),所以前端画七档
让用户"点了多半不生效"是错的。

真值从哪来
----------
**OpenRouter `/api/v1/models`** 每条记录自带 `reasoning.supported_efforts`
(逐模型枚举,如 `["max","xhigh","high","medium","low","none"]`)与
`supported_parameters`(含 `reasoning_effort` 才认这个字段)。本机聊天选择器里
415 条 openrouter 模型正是由它同步而来,所以这份枚举就是**该模型这一路真能切的
档位**,不是推测。

归一规则(与契约层单一真相源对齐,不在本文件写第二份值域)
----------------------------------------------------------
- 上游 `none`(不推理)⇒ 契约最低档 `minimal`,其余逐名保留;
- 只保留 `ReasoningEffortPin.known_efforts` 里的名字(未知词、数字一律丢弃);
- 去重;顺序保留上游给的顺序(排序职责在前端契约层 `REASONING_EFFORT_ORDER`)。
三种结论必须分清(§0.3"没判不写成判过"):
- 有 `supported_efforts` ⇒ 写该子集;
- 无该字段但 `supported_parameters` 明确不含 `reasoning_effort` ⇒ 写空数组
  (上游**明确不支持**,前端关轴并给原因);
- 有 `reasoning_effort` 参数但没枚举 ⇒ 不写(未声明),前端回落通用四档。

落点
----
写 `ai_model_config_models.metadata` 的 `reasoning_efforts` /
`reasoning_efforts_source` / `reasoning_efforts_synced_at` 三键;
`/llm/models` 由 `app.routers.llm.build_model_catalog` 透出,前端
`ReasoningEffortAxis` 消费。CLI: `python -m app.services.reasoning_effort_catalog`。
"""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import httpx

from app.core.reasoning_effort_pin import ReasoningEffortPin

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
SOURCE_TAG = "openrouter:/api/v1/models"
# 落盘镜像:供应商池同步会整体重写 metadata(D137 实测 436 条被清成 0),
# 所以真值必须另存一份文件,目录构建时优先读 metadata、缺失回落本文件。
_CACHE_REL = Path(".ihui-agent") / "state" / "openrouter-reasoning-efforts.json"
_cache_state: dict[str, Any] = {"mtime": None, "index": {}}
# `none` 是上游"关掉推理"的档位,契约层没有同名项,落到最低档 minimal(极简)。
_UPSTREAM_ALIASES: Mapping[str, str] = {"none": "minimal"}


def normalize_efforts(raw: Iterable[Any]) -> list[str]:
    """上游枚举 → 契约值域内的档位清单(去重保序,未知词丢弃)。"""
    known = ReasoningEffortPin.known_efforts
    out: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        name = _UPSTREAM_ALIASES.get(item.strip().lower(), item.strip().lower())
        if name in known and name not in out:
            out.append(name)
    return out


def _full_key(model_id: str) -> str:
    """全名键:`openai/gpt-5.6-luna`(本地 openrouter 行多数带厂商前缀,全名最精确)。"""
    return model_id.strip().lower()


def _variant_key(model_id: str) -> str:
    """口径尾键:兼容本地只存 `gpt-5.6-luna:batch` 这类裸名的行。"""
    return model_id.strip().split("/")[-1].lower()


def build_openrouter_index(payload: Any) -> dict[str, list[str]]:
    """`/api/v1/models` 响应 → {匹配键: 档位清单};空清单 = 明确不支持。"""
    data = payload.get("data") if isinstance(payload, Mapping) else None
    if not isinstance(data, list):
        return {}
    index: dict[str, list[str]] = {}
    for item in data:
        if not isinstance(item, Mapping):
            continue
        model_id = item.get("id")
        if not isinstance(model_id, str) or not model_id:
            continue
        reasoning = item.get("reasoning")
        params = item.get("supported_parameters")
        supports_effort = isinstance(params, list) and "reasoning_effort" in params
        supported = None
        if isinstance(reasoning, Mapping):
            supported = reasoning.get("supported_efforts")
        if isinstance(supported, list) and supported:
            efforts = normalize_efforts(supported)
            if efforts:
                index[_full_key(model_id)] = efforts
                tail = _variant_key(model_id)
                index.setdefault(tail, efforts)
                continue
        if not supports_effort:
            index[_full_key(model_id)] = []
            index.setdefault(_variant_key(model_id), [])
    return index


def resolve_efforts(index: Mapping[str, list[str]], model_id: str) -> list[str] | None:
    """本地模型 id → 档位清单;`None` = 上游没声明(不猜,交由前端回落)。"""
    exact = index.get(_full_key(model_id))
    if exact is not None:
        return exact
    return index.get(_variant_key(model_id))


def cache_path() -> Path:
    """镜像文件位置(仓库根下,与本模块相对位置推导;不写死盘符)。"""
    return Path(__file__).resolve().parents[4] / _CACHE_REL


def write_cache(index: Mapping[str, list[str]]) -> None:
    target = cache_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": SOURCE_TAG,
        "synced_at": datetime.now(UTC).isoformat(),
        "models": dict(index.items()),
    }
    target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    _cache_state["mtime"] = None


def load_cache_index() -> dict[str, list[str]]:
    """读镜像(按 mtime 记忆化);文件缺失/损坏 ⇒ 空索引(未声明,不猜)。"""
    try:
        target = cache_path()
        mtime = target.stat().st_mtime
    except OSError:
        return {}
    if _cache_state["mtime"] == mtime:
        # `_cache_state` 是 dict[str, Any] 的进程内小缓存;写入口只有下面那次 `index` 赋值,
        # 读回时按写入口类型收窄(mypy 2.3.1 判 no-any-return,2026-11-21)。
        return cast("dict[str, list[str]]", _cache_state["index"])
    try:
        raw = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    models = raw.get("models") if isinstance(raw, Mapping) else None
    index: dict[str, list[str]] = {}
    if isinstance(models, Mapping):
        for key, efforts in models.items():
            if isinstance(key, str) and isinstance(efforts, list):
                index[key] = [e for e in efforts if isinstance(e, str)]
    _cache_state["index"] = index
    _cache_state["mtime"] = mtime
    return index


async def fetch_openrouter_payload(client: httpx.AsyncClient | None = None) -> Any:
    proxy = os.getenv("OPENROUTER_PROXY_URL") or None
    headers = {"User-Agent": "IHUI-AI/1.0"}
    if client is not None:
        res = await client.get(OPENROUTER_MODELS_URL, headers=headers, timeout=60)
        res.raise_for_status()
        return res.json()
    async with httpx.AsyncClient(proxy=proxy, timeout=60) as own:
        res = await own.get(OPENROUTER_MODELS_URL, headers=headers)
        res.raise_for_status()
        return res.json()


async def sync_openrouter_reasoning_efforts(conn: Any) -> dict[str, int]:
    """把 OpenRouter 的真实档位枚举写进 openrouter 模型的 metadata。

    `conn` 是 asyncpg 连接。只动 `provider_code='openrouter'` 的启用行;
    未声明的一律不写(失效方向 = 前端多画通用四档,不漏画)。
    """
    index = build_openrouter_index(await fetch_openrouter_payload())
    # 先落镜像再写库:池同步会整体重写 metadata,镜像才是跨轮存续的那份。
    write_cache(index)
    rows = await conn.fetch(
        """SELECT m.id, m.model_id, m.metadata
           FROM ai_model_config_models m
           JOIN ai_model_config c ON m.config_id = c.id
           WHERE c.provider_code = 'openrouter' AND m.enabled = true"""
    )
    stamp = datetime.now(UTC).isoformat()
    stats = {"rows": len(rows), "declared": 0, "unsupported": 0, "undeclared": 0, "unchanged": 0}
    updates: list[tuple[Any, str]] = []
    for row in rows:
        efforts = resolve_efforts(index, row["model_id"])
        if efforts is None:
            stats["undeclared"] += 1
            continue
        existing = row["metadata"] if isinstance(row["metadata"], Mapping) else {}
        if existing.get("reasoning_efforts") == efforts:
            stats["unchanged"] += 1
            continue
        patch = {
            "reasoning_efforts": efforts,
            "reasoning_efforts_source": SOURCE_TAG,
            "reasoning_efforts_synced_at": stamp,
        }
        updates.append((row["id"], json.dumps(patch)))
        stats["declared" if efforts else "unsupported"] += 1
    # 变量名分开写:上面同一函数体的 `patch` 是 dict[str, Any](补丁体),
    # 这里若是同名会被 mypy 判成「str 赋给 dict[str, Sequence[str]]」(2026-11-21 修)。
    for row_id, patch_json in updates:
        await conn.execute(
            """UPDATE ai_model_config_models
               SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
               WHERE id = $1""",
            row_id,
            patch_json,
        )
    stats["written"] = len(updates)
    return stats


async def _main() -> int:
    from app.core.db_pool import get_shared_pool

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        stats = await sync_openrouter_reasoning_efforts(conn)
    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    import asyncio

    sys.exit(asyncio.run(_main()))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
