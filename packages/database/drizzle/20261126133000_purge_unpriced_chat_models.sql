-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 全收费清理:删除剩余 32 个缺成本聊天候选行。
--
-- 背景:这些模型是账号池同步腿按 chat 标签自动登记进来的,公开面已取消,
-- 但 enabled=true 仍占着缺价清单;机主确认「这种就不应该留着」。
-- 本迁移直接删除名单内所有行(不再按 cost 是否为 null 过滤:
-- 这 32 个是机主点名要清掉的缺价/低质聊天候选;其中有 4 个在清理前
-- 被后台巡检临时回填了成本/售价,也一并删除,避免残留零价公开行)。
-- 删除是幂等的:重复执行不会再命中。
--
-- 不删 llm_call_logs(历史调用留痕);同步删除这些模型的 ai_pricing 行,
-- 防止后续同步按「已有 ai_pricing 行」误判为已定价。

DELETE FROM ai_model_config_models m
WHERE lower(m.model_id) IN (
  '@cf/cloudflare/clairic',
  '@cf/cloudflare/clef',
  '@cf/cloudflare/clef-flash',
  '@cf/cloudflare/clef-omni',
  '@cf/mistral/mistral-7b-instruct-v0.2-lora',
  'agnes-2.5-pro-theta',
  'agnes-3.0-pro',
  'agnes-sys1-1.0',
  'allam-2-7b',
  'big-pickle',
  'composer-2.5',
  'cyankiwi/qwen3.5-9b-awq-4bit',
  'deepseek-v3-2-volc',
  'deepseek-v41-flash-1017',
  'glm-5.2-sft-harmony',
  'gpt-6-astra-pro',
  'hunyuan-2.0-thinking',
  'hunyuan-chat',
  'hy4-preview-x',
  'kev-4b',
  'liquidai/lfm3-1.7b',
  'minimax-m2.1-highspeed',
  'nvidia/cosmos-reason2-8b',
  'nvidia/ising-calibration-1.5-31b',
  'nvidia/nemotron-3.5-bolt-e4b',
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'openpangu-2.1-pro',
  'phi-3.5-mini-instruct',
  'poolside/laguna-xs-2.1',
  'seed-lite-7b',
  'semif',
  'spark-x2.6'
);

DELETE FROM ai_pricing p
WHERE lower(p.model_id) IN (
  '@cf/cloudflare/clairic',
  '@cf/cloudflare/clef',
  '@cf/cloudflare/clef-flash',
  '@cf/cloudflare/clef-omni',
  '@cf/mistral/mistral-7b-instruct-v0.2-lora',
  'agnes-2.5-pro-theta',
  'agnes-3.0-pro',
  'agnes-sys1-1.0',
  'allam-2-7b',
  'big-pickle',
  'composer-2.5',
  'cyankiwi/qwen3.5-9b-awq-4bit',
  'deepseek-v3-2-volc',
  'deepseek-v41-flash-1017',
  'glm-5.2-sft-harmony',
  'gpt-6-astra-pro',
  'hunyuan-2.0-thinking',
  'hunyuan-chat',
  'hy4-preview-x',
  'kev-4b',
  'liquidai/lfm3-1.7b',
  'minimax-m2.1-highspeed',
  'nvidia/cosmos-reason2-8b',
  'nvidia/ising-calibration-1.5-31b',
  'nvidia/nemotron-3.5-bolt-e4b',
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'openpangu-2.1-pro',
  'phi-3.5-mini-instruct',
  'poolside/laguna-xs-2.1',
  'seed-lite-7b',
  'semif',
  'spark-x2.6'
);
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
