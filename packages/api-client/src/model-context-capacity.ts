/**
 * 模型上下文容量映射(跨端共享)
 *
 * 根据模型 id 推断该模型支持的最大上下文 token 数。
 * 数据基于 2025-2026 各厂商官方文档,部分估算值取保守下限。
 *
 * 跨端使用:web / desktop / extension / mobile-rn / miniapp-taro
 * 都通过 `@ihui/api-client` 导入 getModelContextCapacity,避免重复实现。
 */

/** 默认兜底上下文长度(未知模型保守值) */
export const DEFAULT_CONTEXT_CAPACITY = 32_000

/** 精确模型 id → 上下文 token 数 */
const EXACT_CAPACITY: Record<string, number> = {
  // === OpenAI ===
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4.1': 1_047_576,
  'gpt-4.1-mini': 1_047_576,
  'gpt-4.1-nano': 1_047_576,
  o3: 200_000,
  'o3-mini': 200_000,
  'o4-mini': 200_000,
  // === Anthropic ===
  'claude-3-5-sonnet': 200_000,
  'claude-3-5-haiku': 200_000,
  'claude-3-7-sonnet': 200_000,
  'claude-opus-4': 200_000,
  'claude-sonnet-4': 200_000,
  // === Google Gemini ===
  'gemini-2.0-flash': 1_048_576,
  'gemini-2.5-pro': 2_097_152,
  'gemini-2.5-flash': 1_048_576,
  // === Google Gemma 开源 ===
  'gemma-2-27b-it': 8_192,
  'gemma-2-9b-it': 8_192,
  // === DeepSeek ===
  'deepseek-chat': 64_000,
  'deepseek-reasoner': 64_000,
  'deepseek-v3': 64_000,
  // === Meta Llama ===
  'llama-3.3-70b-versatile': 128_000,
  'llama-3.1-405b-instruct': 128_000,
  // === Mistral ===
  'mistral-large-latest': 128_000,
  'codestral-latest': 256_000,
  'pixtral-large-latest': 128_000,
  // === xAI Grok ===
  'grok-2': 128_000,
  'grok-3': 1_000_000,
  // === Cohere ===
  'command-r-plus': 128_000,
  'command-a': 256_000,
  // === Qwen 通义千问 ===
  'qwen-plus': 131_072,
  'qwen-max': 32_768,
  'qwen-turbo': 1_000_000,
  'qwen2.5-72b-instruct': 131_072,
  // === Zhipu 智谱 ===
  'glm-4-plus': 128_000,
  'glm-4.5': 128_000,
  'glm-4-air': 128_000,
  // === Moonshot 月之暗面 ===
  'moonshot-v1-8k': 8_000,
  'moonshot-v1-32k': 32_000,
  'kimi-k2': 200_000,
  // === Doubao 豆包 ===
  'doubao-1-6-pro': 32_000,
  'doubao-pro-32k': 32_000,
  // === StepFun 阶跃星辰 ===
  'stepfun/step-3.7-flash': 8_000,
  'stepfun/step-3.5-flash': 8_000,
  'stepfun/step-router-v1': 8_000,
  // === Tencent Hunyuan 腾讯混元 ===
  'hunyuan-pro': 32_000,
  'hunyuan-turbo': 32_000,
  // === Baidu Wenxin 百度文心 ===
  'ernie-4.0-turbo-8k': 8_000,
  'ernie-speed-128k': 128_000,
  // === MiniMax ===
  'abab6.5s-chat': 245_760,
  'minimax-text-01': 1_000_000,
  // === Baichuan 百川 ===
  'baichuan-4-turbo': 32_000,
  // === iFlyTek Spark 讯飞星火 ===
  'spark-v4': 8_000,
  // === 零一万物 ===
  'yi-large': 32_000,
  // === 商汤 SenseNova ===
  'sensenova-5': 32_000,
  // === 天工 Skywork ===
  'skywork-4': 32_000,
  // === InternLM 书生 ===
  'internlm2.5-20b': 32_000,
}

/**
 * 按关键词模糊匹配的规则(当精确匹配失败时按顺序匹配)。
 */
const PATTERN_CAPACITY: Array<{ pattern: RegExp; capacity: number }> = [
  // 长上下文关键词优先
  { pattern: /1m|1[_-]?m(illion)?|1_000_000|1048576/i, capacity: 1_048_576 },
  { pattern: /2m|2[_-]?m(illion)?|2097152/i, capacity: 2_097_152 },
  { pattern: /128k|131072/i, capacity: 131_072 },
  { pattern: /200k|200000/i, capacity: 200_000 },
  { pattern: /256k|256000/i, capacity: 256_000 },
  { pattern: /64k|64000/i, capacity: 64_000 },
  { pattern: /32k|32000/i, capacity: 32_000 },
  { pattern: /8k|8000/i, capacity: 8_000 },
  // 厂商默认值
  { pattern: /^gpt-?4/, capacity: 128_000 },
  { pattern: /^gpt-?5/, capacity: 256_000 },
  { pattern: /claude/i, capacity: 200_000 },
  { pattern: /gemini/i, capacity: 1_048_576 },
  { pattern: /deepseek/i, capacity: 64_000 },
  { pattern: /llama/i, capacity: 128_000 },
  { pattern: /mistral|codestral|pixtral/i, capacity: 128_000 },
  { pattern: /grok/i, capacity: 128_000 },
  { pattern: /command-(r|a)/i, capacity: 128_000 },
  { pattern: /qwen/i, capacity: 131_072 },
  { pattern: /glm/i, capacity: 128_000 },
  { pattern: /moonshot|kimi/i, capacity: 200_000 },
  { pattern: /doubao/i, capacity: 32_000 },
  { pattern: /stepfun|step-/i, capacity: 8_000 },
  { pattern: /hunyuan/i, capacity: 32_000 },
  { pattern: /ernie|wenxin/i, capacity: 8_000 },
  { pattern: /minimax|abab/i, capacity: 245_760 },
  { pattern: /baichuan/i, capacity: 32_000 },
  { pattern: /spark/i, capacity: 8_000 },
  { pattern: /yi-large/i, capacity: 32_000 },
  { pattern: /sensenova/i, capacity: 32_000 },
  { pattern: /skywork/i, capacity: 32_000 },
  { pattern: /internlm/i, capacity: 32_000 },
]

/**
 * 获取模型的最大上下文 token 数。
 * 命中顺序:精确 id → 模糊关键词 → 兜底 32K。
 */
export function getModelContextCapacity(modelId: string): number {
  if (!modelId) return DEFAULT_CONTEXT_CAPACITY
  const exact = EXACT_CAPACITY[modelId]
  if (exact) return exact
  for (const { pattern, capacity } of PATTERN_CAPACITY) {
    if (pattern.test(modelId)) return capacity
  }
  return DEFAULT_CONTEXT_CAPACITY
}

/** 格式化 token 数为人类可读字符串(如 32K / 128K / 1M / 2M) */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000
    return `${Number.isInteger(k) ? k : k.toFixed(0)}K`
  }
  return String(tokens)
}
