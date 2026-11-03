# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""离线复现 /llm/models 过滤逻辑:在 prod 环境 + 真实 ping 下,精确列出"可见 / 被隐藏"
及每个被隐藏模型的归属 provider、has_key 判定、健康检查状态。只读分析,不改任何东西。
"""
import asyncio
import json
import os
import sys

PROD_ENV = r"D:\DevEnv\ihui-prod\apps\ai-service\.env"
DEV_ENV = r"D:\IHUI-AI\apps\ai-service\.env"


def load_env(path, target):
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                target[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass


_env = {}
load_env(DEV_ENV, _env)
load_env(PROD_ENV, _env)
for k, v in _env.items():
    os.environ.setdefault(k, v)  # os.environ 优先,但保留已有(如代理)

# 让 settings 读到 prod 配置
os.environ["DATABASE_URL"] = _env["DATABASE_URL"]
os.environ["CREDENTIALS_ENCRYPTION_KEY"] = _env.get("CREDENTIALS_ENCRYPTION_KEY", "")

import asyncpg  # noqa: E402
from app.services.model_availability import model_availability  # noqa: E402
from app.services.free_provider_registry import free_provider_registry, ProviderStatus, ProviderCategory  # noqa: E402
from app.core.config import settings  # noqa: E402


def load_default_models():
    p = r"D:\IHUI-AI\apps\ai-service\app\data\default_models.json"
    with open(p, encoding="utf-8") as f:
        return json.load(f)


async def load_db_public_models():
    pool = await asyncpg.create_pool(dsn=settings.database_url, min_size=1, max_size=2, command_timeout=10)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT m.model_id, m.display_name, m.context_length, c.provider_code,
                      m.release_date, m.tags
               FROM ai_model_config_models m
               JOIN ai_model_config c ON m.config_id = c.id
               WHERE m.enabled = true AND c.enabled = true AND m.is_relay_public = true"""
        )
    await pool.close()
    out = []
    seen = set()
    for r in rows:
        mid = r["model_id"]
        pc = r["provider_code"]
        if pc == "gemini":
            mid = mid.split("models/", 1)[-1]
            if not mid.startswith("gemini/"):
                mid = f"gemini/{mid}"
        elif pc == "agnes" and not mid.startswith("agnes/"):
            mid = f"agnes/{mid}"
        elif pc in ("nvidia", "nvidia_nim") and not mid.startswith("nvidia/"):
            mid = f"nvidia/{mid}"
        elif pc == "openrouter" and not mid.startswith("openrouter/"):
            mid = f"openrouter/{mid}"
        elif pc == "stepfun" and not mid.startswith("stepfun/"):
            mid = f"stepfun/{mid}"
        elif pc == "token6688":
            tags = {str(t).lower() for t in (r["tags"] or [])}
            if "chat" not in tags and not mid.startswith("t6688/"):
                continue
            if not mid.startswith("t6688/"):
                mid = f"t6688/{mid}"
        if mid not in seen:
            out.append({"id": mid, "name": r["display_name"] or mid, "provider": pc})
            seen.add(mid)
    return out


async def main():
    from app.services.model_availability import _infer_provider_code, _ZERO_COST_CODES, _to_llm_providers_name
    from app.core.config import settings as S

    # 真实刷新一次(含 LOCAL 探针 + key provider ping)
    await model_availability.initialize()
    await model_availability._refresh_all_providers()

    # 打印健康摘要
    summ = model_availability.get_health_summary()
    print("=== provider 健康摘要 ===")
    for p in summ["providers"]:
        print(f"  {p['provider_code']:24} {p['status']:14} err={p['error_type']} {p['error'][:50]}")
    print("  summary:", summ["summary"])

    default_models = load_default_models()
    db_models = await load_db_public_models()
    # 合并(简化:去重 by id)
    seen = {m["id"] for m in default_models}
    merged = list(default_models)
    for m in db_models:
        if m["id"] not in seen:
            merged.append(m)
            seen.add(m["id"])

    print(f"\n=== 合并清单 {len(merged)} 个,逐个判定 ===")
    visible = []
    hidden = []
    for m in merged:
        mid = m.get("id", "")
        if model_availability.is_model_available(mid):
            visible.append(mid)
        else:
            code = _infer_provider_code(mid)
            prov = free_provider_registry.get_by_code(code)
            is_zc = code in _ZERO_COST_CODES
            cfg_name = _to_llm_providers_name(code)
            cfg = S.get_provider_config(cfg_name)
            has_key = bool(cfg.api_key) or free_provider_registry.is_key_configured(code) == ProviderStatus.CONFIGURED
            h = model_availability.get_provider_health(code)
            hidden.append((mid, code, "ZC" if is_zc else ("LK" if has_key else "NOKEY"), h.status.value, h.error_type.value))

    print(f"\n可见 {len(visible)} 个:")
    from collections import Counter
    vc = Counter(_infer_provider_code(x) for x in visible)
    for code, n in sorted(vc.items(), key=lambda x: -x[1]):
        print(f"  {code or '(unknown)':20} {n}")
    print("\n可见样例:", visible[:30])

    print(f"\n被隐藏 {len(hidden)} 个(按原因分组):")
    hc = Counter((r[2], r[3], r[4]) for r in hidden)
    for k, n in sorted(hc.items(), key=lambda x: -x[1]):
        print(f"  reason={k}  count={n}")
    print("\n被隐藏样例(前 40):")
    for r in hidden[:40]:
        print(f"  {r[0]:45} code={r[1]:16} {r[2]:6} {r[3]:10} {r[4]}")


if __name__ == "__main__":
    asyncio.run(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
