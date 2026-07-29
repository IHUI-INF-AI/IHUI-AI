/**
 * 批量添加所有主流模型厂商 provider 配置 + 最新模型
 * (P0-5k,2026-07-30)
 *
 * 用户要求"所有模型厂商都要有"。本脚本添加 20+ 主流厂商的 provider 配置
 * (占位符 key,enabled=false) + 各厂商最新模型(is_relay_public=false)。
 *
 * 用户后续提供真实 key 后:
 *   1. admin 页面更新 provider 的 api_key + enabled=true
 *   2. 跑 node scripts/scan-upstream-models.mjs --provider <code> 自动拉取最新模型
 *   3. admin 审批模型上架(is_relay_public=true)
 *
 * 用法:
 *   node scripts/seed-all-providers.mjs            # 执行
 *   node scripts/seed-all-providers.mjs --dry-run  # 预览
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const postgres = require('postgres')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const sql = postgres(process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ihui', { max: 4, prepare: false })

// ============================================================================
// 所有主流模型厂商 + 最新模型清单(2025-2026)
// base_url 优先用 OpenAI 兼容 endpoint(LiteLLM 原生支持)
// ============================================================================

const PROVIDERS = [
  // ===== 国际大厂(2026 最新版本)=====
  {
    providerCode: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    sortOrder: 10,
    models: [
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol (2026 旗舰)', context: 1048576 },
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', context: 1048576 },
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', context: 1048576 },
      { id: 'gpt-5.5', name: 'GPT-5.5', context: 1048576 },
      { id: 'gpt-5.2', name: 'GPT-5.2', context: 1048576 },
      { id: 'gpt-5', name: 'GPT-5', context: 1048576 },
      { id: 'gpt-oss-120b', name: 'GPT-oSS 120B (开源)', context: 131072 },
      { id: 'gpt-4o', name: 'GPT-4o', context: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', context: 128000 },
      { id: 'gpt-4.1', name: 'GPT-4.1', context: 1047576 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', context: 1047576 },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano', context: 1047576 },
      { id: 'o3', name: 'OpenAI o3', context: 200000 },
      { id: 'o3-mini', name: 'OpenAI o3 mini', context: 200000 },
      { id: 'o4-mini', name: 'OpenAI o4 mini', context: 200000 },
      { id: 'gpt-4o-realtime', name: 'GPT-4o realtime', context: 128000 },
      { id: 'gpt-4o-audio-preview', name: 'GPT-4o audio', context: 128000 },
    ],
  },
  {
    providerCode: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    sortOrder: 11,
    models: [
      { id: 'claude-fable-5', name: 'Claude Fable 5 (2026 旗舰)', context: 200000 },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', context: 200000 },
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', context: 200000 },
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', context: 200000 },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', context: 200000 },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', context: 200000 },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', context: 200000 },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', context: 200000 },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', context: 200000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2', context: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', context: 200000 },
    ],
  },
  {
    providerCode: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    sortOrder: 12,
    models: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (2026 旗舰)', context: 2097152 },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', context: 2097152 },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', context: 2097152 },
      { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash', context: 2097152 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', context: 1048576 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', context: 1048576 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', context: 1048576 },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', context: 1048576 },
      { id: 'gemma-3-27b-it', name: 'Gemma 3 27B (开源)', context: 131072 },
    ],
  },
  {
    providerCode: 'xai',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    sortOrder: 13,
    models: [
      { id: 'grok-4.5', name: 'Grok 4.5 (2026 旗舰)', context: 256000 },
      { id: 'grok-4.3', name: 'Grok 4.3', context: 256000 },
      { id: 'grok-4', name: 'Grok 4', context: 256000 },
      { id: 'grok-3', name: 'Grok 3', context: 131072 },
      { id: 'grok-3-mini', name: 'Grok 3 mini', context: 131072 },
      { id: 'grok-2', name: 'Grok 2', context: 131072 },
      { id: 'grok-2-mini', name: 'Grok 2 mini', context: 131072 },
      { id: 'grok-beta', name: 'Grok Beta', context: 131072 },
      { id: 'grok-vision-beta', name: 'Grok Vision', context: 8192 },
    ],
  },
  {
    providerCode: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    sortOrder: 14,
    models: [
      { id: 'mistral-large-2512', name: 'Mistral Large 2 (2025.12)', context: 256000 },
      { id: 'mistral-large-latest', name: 'Mistral Large Latest', context: 128000 },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', context: 32000 },
      { id: 'mistral-small-latest', name: 'Mistral Small', context: 32000 },
      { id: 'codestral-latest', name: 'Codestral', context: 256000 },
      { id: 'codestral-mamba-latest', name: 'Codestral Mamba', context: 256000 },
      { id: 'open-mixtral-8x22b', name: 'Mixtral 8x22B', context: 64000 },
      { id: 'open-mixtral-8x7b', name: 'Mixtral 8x7B', context: 32000 },
      { id: 'pixtral-large-latest', name: 'Pixtral Large', context: 128000 },
      { id: 'pixtral-12b-2409', name: 'Pixtral 12B', context: 128000 },
      { id: 'mistral-nemo-12b', name: 'Mistral Nemo 12B', context: 128000 },
      { id: 'mistral-embed', name: 'Mistral Embed', context: 8000 },
    ],
  },
  {
    providerCode: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    sortOrder: 15,
    models: [
      { id: 'command-r-plus', name: 'Command R+', context: 128000 },
      { id: 'command-r', name: 'Command R', context: 128000 },
      { id: 'command', name: 'Command', context: 4000 },
      { id: 'command-light', name: 'Command Light', context: 4000 },
      { id: 'command-r7b-12-2024', name: 'Command R7B', context: 128000 },
    ],
  },
  {
    providerCode: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    sortOrder: 16,
    models: [
      { id: 'sonar-pro', name: 'Sonar Pro', context: 200000 },
      { id: 'sonar', name: 'Sonar', context: 127072 },
      { id: 'sonar-reasoning', name: 'Sonar Reasoning', context: 127000 },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', context: 127000 },
      { id: 'sonar-deep-research', name: 'Sonar Deep Research', context: 127000 },
    ],
  },

  // ===== 国内大厂 =====
  {
    providerCode: 'deepseek',
    name: 'DeepSeek 深度求索',
    baseUrl: 'https://api.deepseek.com/v1',
    sortOrder: 20,
    models: [
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (2026 旗舰)', context: 131072 },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', context: 131072 },
      { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', context: 65536 },
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', context: 65536 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', context: 65536 },
      { id: 'deepseek-coder-v3', name: 'DeepSeek Coder V3', context: 65536 },
      { id: 'deepseek-coder', name: 'DeepSeek Coder (旧版)', context: 65536 },
    ],
  },
  {
    providerCode: 'qwen',
    name: '阿里通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    sortOrder: 21,
    models: [
      { id: 'qwen3-max', name: 'Qwen3 Max (2026 旗舰)', context: 2097152 },
      { id: 'qwen3-235b-a22b', name: 'Qwen3 235B A22B (开源旗舰)', context: 131072 },
      { id: 'qwen3-32b', name: 'Qwen3 32B', context: 131072 },
      { id: 'qwen3-8b', name: 'Qwen3 8B', context: 32768 },
      { id: 'qwen3-0.6b', name: 'Qwen3 0.6B (边缘计算)', context: 32768 },
      { id: 'qwen3.5', name: 'Qwen3.5 (201 语言)', context: 131072 },
      { id: 'qwen-max', name: 'Qwen Max', context: 32768 },
      { id: 'qwen-plus', name: 'Qwen Plus', context: 131072 },
      { id: 'qwen-turbo', name: 'Qwen Turbo', context: 1000000 },
      { id: 'qwen2.5-72b-instruct', name: 'Qwen2.5 72B', context: 131072 },
      { id: 'qwen2.5-7b-instruct', name: 'Qwen2.5 7B', context: 32768 },
      { id: 'qwen2.5-coder-32b-instruct', name: 'Qwen2.5 Coder 32B', context: 131072 },
      { id: 'qwen-vl-max', name: 'Qwen VL Max', context: 32768 },
      { id: 'qwen-vl-plus', name: 'Qwen VL Plus', context: 32768 },
      { id: 'qwen-long', name: 'Qwen Long', context: 10000000 },
    ],
  },
  {
    providerCode: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    sortOrder: 22,
    models: [
      { id: 'glm-5.2', name: 'GLM-5.2 (2026 旗舰)', context: 131072 },
      { id: 'glm-5.1', name: 'GLM-5.1', context: 131072 },
      { id: 'glm-4.6', name: 'GLM-4.6', context: 131072 },
      { id: 'glm-4.7-thinking', name: 'GLM-4.7 Thinking (代码推理)', context: 131072 },
      { id: 'glm-z1-9b-0414', name: 'GLM-Z1 9B (开源推理)', context: 131072 },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', context: 128000 },
      { id: 'glm-4', name: 'GLM-4', context: 128000 },
      { id: 'glm-4-air', name: 'GLM-4 Air', context: 128000 },
      { id: 'glm-4-flash', name: 'GLM-4 Flash (免费)', context: 128000 },
      { id: 'glm-4-flashx', name: 'GLM-4 FlashX', context: 128000 },
      { id: 'glm-4-long', name: 'GLM-4 Long', context: 1000000 },
      { id: 'glm-4v', name: 'GLM-4V (视觉)', context: 8192 },
      { id: 'glm-zero-preview', name: 'GLM Zero Preview', context: 128000 },
    ],
  },
  {
    providerCode: 'moonshot',
    name: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    sortOrder: 23,
    models: [
      { id: 'kimi-k3', name: 'Kimi K3 (2026 旗舰)', context: 1048576 },
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', context: 1048576 },
      { id: 'kimi-k2.6', name: 'Kimi K2.6', context: 1048576 },
      { id: 'kimi-latest', name: 'Kimi Latest', context: 1048576 },
      { id: 'moonshot-v1-auto', name: 'Moonshot v1 Auto', context: 128000 },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', context: 8192 },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', context: 32768 },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', context: 128000 },
    ],
  },
  {
    providerCode: 'ernie',
    name: '百度文心一言',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    sortOrder: 24,
    models: [
      { id: 'ernie-5.0', name: 'ERNIE 5.0 (2026 旗舰)', context: 32768 },
      { id: 'ernie-4.0-turbo-8k', name: 'ERNIE 4.0 Turbo', context: 8192 },
      { id: 'ernie-4.0-8k-latest', name: 'ERNIE 4.0', context: 8192 },
      { id: 'ernie-3.5-8k', name: 'ERNIE 3.5', context: 8192 },
      { id: 'ernie-speed-128k', name: 'ERNIE Speed 128K', context: 128000 },
      { id: 'ernie-speed-8k', name: 'ERNIE Speed 8K', context: 8192 },
      { id: 'ernie-lite-8k', name: 'ERNIE Lite (免费)', context: 8192 },
      { id: 'ernie-tiny-8k', name: 'ERNIE Tiny (免费)', context: 8192 },
      { id: 'ernie-character-8k', name: 'ERNIE Character', context: 8192 },
    ],
  },
  {
    providerCode: 'spark',
    name: '讯飞星火',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    sortOrder: 25,
    models: [
      { id: 'spark-v5', name: 'Spark v5 (2026 旗舰)', context: 32768 },
      { id: 'spark-v4', name: 'Spark v4', context: 8192 },
      { id: 'spark-v3.5', name: 'Spark v3.5', context: 8192 },
      { id: 'spark-max', name: 'Spark Max', context: 8192 },
      { id: 'spark-pro', name: 'Spark Pro', context: 8192 },
      { id: 'spark-lite', name: 'Spark Lite (免费)', context: 8192 },
    ],
  },
  {
    providerCode: 'doubao',
    name: '字节豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    sortOrder: 26,
    models: [
      { id: 'doubao-2.0-pro', name: 'Doubao 2.0 Pro (2026 旗舰)', context: 131072 },
      { id: 'doubao-1.5-pro', name: 'Doubao 1.5 Pro', context: 32768 },
      { id: 'doubao-1.5-lite', name: 'Doubao 1.5 Lite', context: 32768 },
      { id: 'doubao-pro-4k', name: 'Doubao Pro 4K', context: 4096 },
      { id: 'doubao-pro-32k', name: 'Doubao Pro 32K', context: 32000 },
      { id: 'doubao-lite-4k', name: 'Doubao Lite 4K', context: 4096 },
      { id: 'doubao-lite-32k', name: 'Doubao Lite 32K', context: 32000 },
    ],
  },
  {
    providerCode: 'hunyuan',
    name: '腾讯混元',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    sortOrder: 27,
    models: [
      { id: 'hunyuan-2.0-pro', name: 'Hunyuan 2.0 Pro (2026 旗舰)', context: 32768 },
      { id: 'hunyuan-pro', name: 'Hunyuan Pro', context: 32768 },
      { id: 'hunyuan-standard', name: 'Hunyuan Standard', context: 32768 },
      { id: 'hunyuan-lite', name: 'Hunyuan Lite (免费)', context: 32768 },
      { id: 'hunyuan-turbo', name: 'Hunyuan Turbo', context: 32768 },
      { id: 'hunyuan-vision', name: 'Hunyuan Vision', context: 8192 },
    ],
  },
  {
    providerCode: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    sortOrder: 28,
    models: [
      { id: 'minimax-m3', name: 'MiniMax M3 (2026 旗舰)', context: 1048576 },
      { id: 'abab6.5s', name: 'ABAB 6.5s', context: 245760 },
      { id: 'abab6.5', name: 'ABAB 6.5', context: 8192 },
      { id: 'abab6', name: 'ABAB 6', context: 245760 },
      { id: 'minimax-text-01', name: 'MiniMax Text 01', context: 1048576 },
    ],
  },
  {
    providerCode: 'yi',
    name: '零一万物',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    sortOrder: 29,
    models: [
      { id: 'yi-large', name: 'Yi Large', context: 32768 },
      { id: 'yi-large-turbo', name: 'Yi Large Turbo', context: 32768 },
      { id: 'yi-medium', name: 'Yi Medium', context: 16384 },
      { id: 'yi-small', name: 'Yi Small', context: 16384 },
      { id: 'yi-lightning', name: 'Yi Lightning', context: 16384 },
      { id: 'yi-vision', name: 'Yi Vision', context: 16384 },
    ],
  },
  {
    providerCode: 'baichuan',
    name: '百川智能',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    sortOrder: 30,
    models: [
      { id: 'baichuan4-turbo', name: 'Baichuan 4 Turbo', context: 32768 },
      { id: 'baichuan4', name: 'Baichuan 4', context: 32768 },
      { id: 'baichuan3-turbo', name: 'Baichuan 3 Turbo', context: 32768 },
    ],
  },
  {
    providerCode: 'sensetime',
    name: '商汤日日新',
    baseUrl: 'https://api.sensenova.cn/compatible-mode/v1',
    sortOrder: 31,
    models: [
      { id: 'SenseChat-5', name: 'SenseChat 5', context: 32768 },
      { id: 'SenseChat-Turbo', name: 'SenseChat Turbo', context: 32768 },
    ],
  },

  // ===== 开源模型托管平台(聚合) =====
  {
    providerCode: 'siliconflow',
    name: '硅基流动 SiliconFlow (免费额度)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    sortOrder: 40,
    models: [
      { id: 'Qwen/Qwen3-235B-A22B', name: 'Qwen3 235B A22B (开源旗舰,免费)', context: 131072 },
      { id: 'Qwen/Qwen3-32B', name: 'Qwen3 32B (免费)', context: 131072 },
      { id: 'Qwen/Qwen3-8B', name: 'Qwen3 8B (免费)', context: 32768 },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5 72B (免费)', context: 32768 },
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5 7B (免费)', context: 32768 },
      { id: 'deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek V3.2 (免费)', context: 65536 },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1 (免费)', context: 65536 },
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3 (免费)', context: 65536 },
      { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct', name: 'Llama 4 Maverick (免费)', context: 1048576 },
      { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', name: 'Llama 4 Scout (免费)', context: 131072 },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B (免费)', context: 32768 },
      { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B (免费)', context: 131072 },
      { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4 9B (免费)', context: 8192 },
      { id: '01-ai/Yi-1.5-34B-Chat', name: 'Yi 1.5 34B', context: 16384 },
    ],
  },
  {
    providerCode: 'groq',
    name: 'Groq (免费额度,极速)',
    baseUrl: 'https://api.groq.com/openai/v1',
    sortOrder: 41,
    models: [
      { id: 'llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick (免费)', context: 1048576 },
      { id: 'llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout (免费)', context: 131072 },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (免费)', context: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (免费)', context: 128000 },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (免费)', context: 131072 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (免费)', context: 32768 },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B (免费)', context: 8192 },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (免费)', context: 131072 },
      { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B (免费)', context: 128000 },
      { id: 'qwen3-235b-a22b', name: 'Qwen3 235B (免费)', context: 131072 },
    ],
  },
  {
    providerCode: 'together',
    name: 'Together AI (聚合)',
    baseUrl: 'https://api.together.xyz/v1',
    sortOrder: 42,
    models: [
      { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo', name: 'Llama 4 Maverick Turbo', context: 1048576 },
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', context: 131072 },
      { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B Turbo', context: 32768 },
      { id: 'Qwen/Qwen3-235B-A22B-Instruct-Turbo', name: 'Qwen3 235B Turbo', context: 131072 },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen2.5 72B Turbo', context: 32768 },
      { id: 'deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek V3.2', context: 65536 },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', context: 65536 },
      { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B', context: 65536 },
    ],
  },
  {
    providerCode: 'fireworks',
    name: 'Fireworks AI (聚合)',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    sortOrder: 43,
    models: [
      { id: 'accounts/fireworks/models/llama4-maverick-instruct-basic', name: 'Llama 4 Maverick', context: 1048576 },
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B', context: 131072 },
      { id: 'accounts/fireworks/models/llama-v3p1-405b-instruct', name: 'Llama 3.1 405B', context: 32768 },
      { id: 'accounts/fireworks/models/deepseek-v3.2', name: 'DeepSeek V3.2', context: 65536 },
      { id: 'accounts/fireworks/models/deepseek-r1', name: 'DeepSeek R1', context: 65536 },
      { id: 'accounts/fireworks/models/qwen3-235b-a22b', name: 'Qwen3 235B', context: 131072 },
      { id: 'accounts/fireworks/models/qwen2p5-72b-instruct', name: 'Qwen2.5 72B', context: 32768 },
    ],
  },
  {
    providerCode: 'openrouter',
    name: 'OpenRouter (聚合 300+ 模型)',
    baseUrl: 'https://openrouter.ai/api/v1',
    sortOrder: 44,
    models: [
      { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol (via OpenRouter)', context: 1048576 },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)', context: 128000 },
      { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5 (via OpenRouter)', context: 200000 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (via OpenRouter)', context: 200000 },
      { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash (via OpenRouter)', context: 2097152 },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (via OpenRouter)', context: 1048576 },
      { id: 'x-ai/grok-4.5', name: 'Grok 4.5 (via OpenRouter)', context: 256000 },
      { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro (via OpenRouter)', context: 131072 },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (via OpenRouter)', context: 65536 },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (via OpenRouter)', context: 65536 },
      { id: 'qwen/qwen3-max', name: 'Qwen3 Max (via OpenRouter)', context: 2097152 },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (via OpenRouter)', context: 32768 },
      { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick (via OpenRouter)', context: 1048576 },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (via OpenRouter)', context: 131072 },
      { id: 'mistralai/mistral-large-2512', name: 'Mistral Large 2 (via OpenRouter)', context: 256000 },
    ],
  },
  {
    providerCode: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    sortOrder: 45,
    models: [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B (2026)', context: 131072 },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', context: 131072 },
      { id: 'meta/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick', context: 1048576 },
      { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', context: 128000 },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', context: 131072 },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', context: 65536 },
      { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', context: 131072 },
    ],
  },
  {
    providerCode: 'microsoft',
    name: 'Microsoft Phi',
    baseUrl: 'https://api.microsoft.com/v1',
    sortOrder: 46,
    models: [
      { id: 'phi-4-multimodal', name: 'Phi-4 Multimodal (2026)', context: 131072 },
      { id: 'phi-4-mini-instruct', name: 'Phi-4 Mini', context: 131072 },
      { id: 'phi-4', name: 'Phi-4', context: 16384 },
      { id: 'phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', context: 131072 },
      { id: 'phi-3-medium-4k-instruct', name: 'Phi-3 Medium 4K', context: 4096 },
    ],
  },
]

// ============================================================================
// 执行
// ============================================================================

async function main() {
  console.log(`\n========== 批量添加所有主流模型厂商 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  console.log(`待添加 ${PROVIDERS.length} 个厂商,共 ${PROVIDERS.reduce((s, p) => s + p.models.length, 0)} 个模型\n`)

  let addedProviders = 0
  let addedModels = 0
  let skippedProviders = 0
  let skippedModels = 0

  for (const p of PROVIDERS) {
    // 检查 provider 是否已存在
    const existing = await sql`
      SELECT id FROM ai_model_config WHERE provider_code = ${p.providerCode}
    `
    let configId = existing[0]?.id

    if (configId) {
      console.log(`[跳过] provider ${p.providerCode} 已存在 (configId=${configId})`)
      skippedProviders++
    } else {
      console.log(`[新增] provider ${p.name} (${p.providerCode}) → ${p.baseUrl}`)
      if (!dryRun) {
        const inserted = await sql`
          INSERT INTO ai_model_config
            (provider_code, name, base_url, api_key_enc, enabled, sort_order, created_at, updated_at)
          VALUES
            (${p.providerCode}, ${p.name}, ${p.baseUrl}, ${'sk-placeholder-need-real-key'}, false, ${p.sortOrder}, now(), now())
          RETURNING id
        `
        configId = inserted[0].id
      } else {
        configId = -1 // dry-run 占位
      }
      addedProviders++
    }

    // 添加模型(dry-run 时跳过 DB 查询)
    for (const m of p.models) {
      if (!dryRun && configId > 0) {
        const existingModel = await sql`
          SELECT id FROM ai_model_config_models WHERE config_id = ${configId} AND model_id = ${m.id}
        `
        if (existingModel.length > 0) {
          skippedModels++
          continue
        }
      }

      if (!dryRun && configId > 0) {
        await sql`
          INSERT INTO ai_model_config_models
            (config_id, model_id, display_name, context_length, input_price_per_1k, output_price_per_1k, enabled, is_relay_public, relay_price_multiplier, created_at, updated_at)
          VALUES
            (${configId}, ${m.id}, ${m.name}, ${m.context}, 0, 0, true, false, '1.0000', now(), now())
          ON CONFLICT (config_id, model_id) DO NOTHING
        `
      }
      addedModels++
    }
    console.log(`  → ${p.models.length} 个模型(${p.models.map((m) => m.id).slice(0, 3).join(', ')}${p.models.length > 3 ? ` ... +${p.models.length - 3}` : ''})`)
  }

  console.log(`\n========== 完成 ==========`)
  console.log(`新增 provider: ${addedProviders} (跳过 ${skippedProviders})`)
  console.log(`新增模型: ${addedModels} (跳过 ${skippedModels})`)
  console.log(`\n注意:所有新 provider 都是 enabled=false + is_relay_public=false`)
  console.log(`激活流程:`)
  console.log(`  1. admin 页面 → AI 中转 → provider 管理 → 填入真实 api_key + enabled=true`)
  console.log(`  2. 跑 node scripts/scan-upstream-models.mjs --provider <code> 自动拉取最新模型`)
  console.log(`  3. admin 页面 → 模型审批 → 批量上架`)
  console.log(`\n有免费额度的厂商:SiliconFlow / Groq / 智谱 GLM (glm-4-flash) / ERNIE Lite / Spark Lite / Hunyuan Lite`)

  await sql.end()
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e?.message || e)
    process.exit(2)
  })
