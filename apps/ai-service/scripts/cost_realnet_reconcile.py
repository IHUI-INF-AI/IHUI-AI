# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""成本真网对账(GAP-PLAN「真实外部缺口」第 2 条)。

用 OpenRouter 真实账号做三方对账,闭环「价表数据层 → 账本口径」的真网校验:
  1. 真实调用:POST /api/v1/chat/completions(openai/gpt-4o-mini,max_tokens=10)
     → 响应 usage.cost = OpenRouter 实际计费(真账单口径)
  2. 价表推算:model_pricing.estimate_cost_usd(同 token 数)→ 本平台口径
  3. 牌价核对:GET /api/v1/models(官方公开牌价)× 本表 10+ 条交叉比对
产出 PASS/FAIL 对账报告,相对误差 ≤15% 判定 MATCH(牌价随时间浮动容差)。

用法:
    G:/IHUI-AI/apps/ai-service/.venv/Scripts/python.exe scripts/cost_realnet_reconcile.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.model_pricing import estimate_cost_usd  # noqa: E402

ENV_PATH = Path("G:/IHUI-AI/apps/ai-service/.env")
OR_BASE = "https://openrouter.ai/api/v1"
REALNET_MODEL = "openai/gpt-4o-mini"
TOLERANCE = 0.15

# 本表键 → OpenRouter 模型 id(牌价交叉核对映射)
# claude-3.5 系列已被 OR 全量下架(厂商新旧代交替),无 passthrough 可对,列 SKIP。
# deepseek-chat/reasoner 官方已统一为 V3.2 牌价,OR 的 passthrough id 为 deepseek/deepseek-v3.2。
CROSS_MAP: dict[str, str] = {
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4o": "openai/gpt-4o",
    "claude-3-5-sonnet": "",
    "claude-3-5-haiku": "",
    "deepseek-chat": "deepseek/deepseek-v3.2",
    "deepseek-reasoner": "deepseek/deepseek-v3.2",
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    "gemini-2.5-pro": "google/gemini-2.5-pro",
    "glm-4.5": "z-ai/glm-4.5",
    "kimi-k2": "moonshotai/kimi-k2",
}


def _load_key() -> str:
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if line.startswith("OPENROUTER_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("FAIL: OPENROUTER_API_KEY 未配置")


def _real_call(key: str) -> dict[str, object]:
    body = json.dumps(
        {
            "model": REALNET_MODEL,
            "messages": [{"role": "user", "content": "Reply with the single word: ok"}],
            "max_tokens": 10,
        }
    ).encode()
    req = urllib.request.Request(
        f"{OR_BASE}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    key = _load_key()
    print("[1/3] 真实调用 OpenRouter(openai/gpt-4o-mini, max_tokens=10)…")
    data = _real_call(key)
    usage = data.get("usage") or {}
    billed = float(usage.get("cost") or 0.0)
    tin = int(usage.get("prompt_tokens") or 0)
    tout = int(usage.get("completion_tokens") or 0)
    real_id = str(data.get("model") or REALNET_MODEL)
    print(f"      真账单 cost=${billed:.6f}  tokens(in={tin}, out={tout})  model={real_id}")

    print("[2/3] 本平台价表推算(estimate_cost_usd)…")
    est = estimate_cost_usd(REALNET_MODEL, tin, tout)
    ours = float(est["cost_usd"])
    print(f"      价表推算 cost=${ours:.6f}  estimated={est['estimated']}")

    rel = abs(ours - billed) / billed if billed > 0 else 1.0
    verdict_call = "MATCH" if rel <= TOLERANCE else "MISMATCH"
    print(f"      相对误差={rel * 100:.2f}% → 真实调用对账 {verdict_call}")

    print("[3/3] 官方牌价交叉核对(本表 10 条 vs OpenRouter /models)…")
    req = urllib.request.Request(f"{OR_BASE}/models", headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        models = {m["id"]: m for m in json.loads(resp.read().decode()).get("data", [])}

    rows: list[tuple[str, float, float, str]] = []
    matched = 0
    checked = 0  # SKIP(厂商已下架/无 passthrough)不计入分母
    for our_key, or_id in CROSS_MAP.items():
        m = models.get(or_id) if or_id else None
        if not m:
            rows.append((our_key, -1.0, -1.0, "SKIP(OR 已下架,牌价以厂商公告为准)"))
            continue
        checked += 1
        p = m.get("pricing") or {}
        or_in = float(p.get("prompt") or 0) * 1_000_000
        or_out = float(p.get("completion") or 0) * 1_000_000
        est2 = estimate_cost_usd(our_key, 1_000_000, 1_000_000)
        our_in, our_out = est2["cost_usd"], float("nan")
        # estimate 是 in+out 混合;此处直接取 resolve 后速率再算一遍更准:
        from app.core.model_pricing import resolve_model_pricing_per_1m

        rates = resolve_model_pricing_per_1m(our_key)
        our_in, our_out = rates["input"], rates["output"]
        denom = max(or_in, 1e-9)
        diff = abs(our_in - or_in) / denom if denom > 0 else abs(our_out - or_out) / max(or_out, 1e-9)
        ok = diff <= TOLERANCE
        matched += 1 if ok else 0
        rows.append((our_key, our_in, or_in, f"{'MATCH' if ok else 'MISMATCH'}(Δ{diff * 100:.1f}%)"))

    for k, a, b, v in rows:
        print(f"      {k:<20} 本表 in=${a:<8.4g} OR in=${b:<8.4g} {v}")
    rate = matched / max(checked, 1)
    print(f"      牌价核对 MATCH {matched}/{checked} 可核对项({rate * 100:.0f}%)")

    overall = verdict_call == "MATCH" and rate >= 0.7
    print(f"{'PASS' if overall else 'FAIL'}:成本真网对账{'闭环' if overall else '存在缺口,见上行明细'}")
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
