# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""
模型名官方归一化(2026-09-13 立)。
背景:上游各来源(token6688 / swiftapi / openrouter / seed 脚本)对同一模型
使用不同大小写写法(如 minimax-m3 与 MiniMax-M3 并存),导致:
  1. 公开目录(/v1/models、/api/relay/models/public)同一模型出现两条;
  2. 计费按 model_id 精确 eq 匹配,大小写不符时静默查不到 → 成本算 0(计费漏损)。
规则:
  - 已知厂商家族 → 归一为官方 API 文档书写形式(官方要求的名);
  - 其余 → 统一归一小写(与 ai_pricing / openrouter / 主流生态一致);
  - 带 vendor 前缀(openrouter 风格 a/b)时:前缀保持原样,仅归一后段。
同源实现:packages/shared/src/constants/model-names.ts(修改时两端同步)。
"""


# 官方名映射表:键为小写形式,值为官方要求的标准写法
OFFICIAL_MODEL_NAMES: dict[str, str] = {
    # swiftapi 上游官方路由模型(官方 API 文档书写形式)
    "auto-model": "Auto-Model",
    # MiniMax 官方驼峰家族(官方 API 文档书写形式)
    "minimax-m1": "MiniMax-M1",
    "minimax-m2": "MiniMax-M2",
    "minimax-m2-highspeed": "MiniMax-M2-highspeed",
    "minimax-m2.5": "MiniMax-M2.5",
    "minimax-m2.5-highspeed": "MiniMax-M2.5-highspeed",
    "minimax-m2.7": "MiniMax-M2.7",
    "minimax-m2.7-highspeed": "MiniMax-M2.7-highspeed",
    "minimax-m3": "MiniMax-M3",
    "minimax-m3-highspeed": "MiniMax-M3-highspeed",
    "minimax-text-01": "MiniMax-Text-01",
    "minimax-vl-01": "MiniMax-VL-01",
}


def normalize_model_id(raw: str) -> str:
    """将任意写法的模型 id 归一为官方标准写法(或统一小写)。"""
    trimmed = (raw or "").strip()
    if not trimmed:
        return trimmed
    slash_idx = trimmed.find("/")
    if slash_idx > 0:
        # openrouter 风格带厂商前缀:前缀保留,后段归一
        return trimmed[: slash_idx + 1] + normalize_model_id(trimmed[slash_idx + 1 :])
    lower = trimmed.lower()
    return OFFICIAL_MODEL_NAMES.get(lower, lower)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
