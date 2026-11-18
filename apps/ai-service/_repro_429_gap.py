# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""复现：_classify_error 文本启发式对 429/rate_limit 的漏分类（不依赖 agent_engine 在飞件）。

对照 Codex：rate_limit(429) ∈ Retryable，且带 retry_after 头。
本仓 agent 层 _classify_error 用文本启发式把 429 归 http_4xx → 词汇表判 terminal。
"""
from app.providers.base_provider import ProviderError
from app.core.agent_failure_vocabulary import agent_failure_outcome_of

# 逐字对照 agent_loop_v2.py:5075-5088 的文本启发式（宿主盖章/取消分支与本复现无关，略）
def classify_like_agent_loop(e: BaseException) -> str:
    name = type(e).__name__
    if "Timeout" in name:
        return "timeout"
    if "ConnectionError" in name or "ConnectError" in name or "NetworkError" in name:
        return "connection"
    text = str(e)
    lowered = text.lower()
    if ("http" in lowered or "status" in lowered or "server error" in lowered) and (
        "5" in text[:12] or "5xx" in lowered
    ):
        return "http_5xx"
    if ("http" in lowered or "status" in lowered) and "4" in text[:12]:
        return "http_4xx"
    return "unknown"


cases = [
    ("限频", 429),                 # 纯中文限频，无 http/status 前缀
    ("http 429 too many requests", 429),
    ("status 429 rate limited", 429),
    ("server error", 503),         # 对照：5xx 应 retryable
]
print("== _classify_error 文本启发式 × 429/rate_limit ==")
for msg, code in cases:
    e = ProviderError(msg, code)
    fam = classify_like_agent_loop(e)
    outcome = agent_failure_outcome_of(fam)
    # Codex 语义：429 = Retryable（应 retryable）
    expect = "retryable" if code == 429 or code >= 500 else "terminal"
    flag = "OK" if outcome == expect else "GAP"
    print(f"[{flag}] ProviderError({msg!r}, status={code})")
    print(f"        _classify_error → {fam!r}  词汇表 → {outcome!r}   (Codex 期望 {expect})")

print("\n关键事实：ProviderError 自带结构化 status_code=429，但 _classify_error 只看 str(e) 文本，")
print("既不读 e.status_code 也不认 rate_limit → 429 落 http_4xx → terminal（工具层漏重试）。")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
