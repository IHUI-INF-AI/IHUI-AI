# deduct_user_token 调用点与倍数计算检查报告

## 结论概览

| 位置 | 调用对象 | 传入 token 含义 | 是否做了倍数计算 | 状态 |
|------|----------|-----------------|------------------|------|
| token_utils.py:451 | 本文件 `deduct_user_token` | base×yuan×TOKEN_BASE_MULTIPLIER | ✓ 已用 settings | 正确 |
| dashscope_image_to_image.py:267 | token_utils.`deduct_user_token` | 10000×TOKEN_BASE_MULTIPLIER×张数 | ✓ 已用 settings | 正确 |
| websocket_qwen_stream.py:479 | **本文件局部** `deduct_user_token` | total_tokens×**4**（硬编码） | ⚠️ 硬编码 4 | 需改为 settings |
| websocket_qwen_stream_omni.py:335 | **本文件局部** `deduct_user_token` | total_tokens（API 原始值） | ❌ 未乘倍数 | 需乘 settings |
| openrouter_proxy.py:128 | token_utils.`deduct_user_tokens` | total_tokens（API usage） | ❌ 未乘倍数 | 需乘 settings |
| websocket_doubao_proxy.py:279 | token_utils.`deduct_user_tokens` | total_tokens（API usage） | ❌ 未乘倍数 | 需乘 settings |
| agents.py:5450 | **agents 本文件** `deduct_user_tokens` | total_tokens，内部再×4 | ⚠️ 内部硬编码 4 | 需改为 settings |
| websocket_doubao_stream_simplified.py | 仅 import | - | - | 未实际调用 |

## 说明

- **约定**：传入 `deduct_user_token` / `deduct_user_tokens` 的应为「实际算力」（即已按 `settings.TOKEN_BASE_MULTIPLIER` 换算后的扣减值），函数内部只做扣减，不再乘倍数。
- **已修复**：`token_utils.deduct_user_token` 已改为按传入的 `tokens_to_deduct` 直接扣减；上述所有调用点已统一为「先乘 `settings.TOKEN_BASE_MULTIPLIER` 再传入」或使用 `token_utils.deduct_user_token` 并传入已乘倍数的值。
