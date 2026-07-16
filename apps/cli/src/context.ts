/**
 * 上下文管理 — token 估算与历史压缩。
 *
 * 灵感来源:cli 的 `cli-shell` crate 的上下文管理机制。
 * 策略:
 *   - token 估算:gpt-tokenizer(BPE 真实分词,精确匹配 GPT-4/Cl100k 编码)
 *   - 压缩策略:保留首条 system + 尾部最近 N 条,中段用摘要替代
 *   - 阈值触发:支持绝对值(maxTokens)和百分比(triggerRatio of contextLimit)两种模式
 *   - 百分比模式:达 triggerRatio(如 0.85)触发压缩,压缩到 targetRatio(如 0.6)留出空间
 */

import { encode } from 'gpt-tokenizer';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

export interface CompressionResult {
  messages: ChatMessage[];
  compressed: boolean;
  originalTokens: number;
  compressedTokens: number;
  removedCount: number;
  /** 触发原因(百分比模式才有值) */
  trigger?: 'ratio' | 'absolute' | 'none';
  /** 当前 token 占用率(percentage of contextLimit,百分比模式才有值) */
  usageRatio?: number;
}

export interface CompressionOptions {
  maxTokens?: number;
  keepRecent?: number;
}

const DEFAULT_MAX_TOKENS = 24_000;
const DEFAULT_KEEP_RECENT = 6;

export function compressContext(
  messages: ChatMessage[],
  opts: CompressionOptions = {},
): CompressionResult {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT;
  const originalTokens = estimateMessagesTokens(messages);

  if (originalTokens <= maxTokens || messages.length <= keepRecent + 1) {
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
    };
  }

  const systemMsgs = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');
  const keepCount = Math.min(keepRecent, nonSystem.length);
  const toCompress = nonSystem.slice(0, nonSystem.length - keepCount);
  const toKeep = nonSystem.slice(nonSystem.length - keepCount);

  const summaryParts: string[] = [];
  for (const msg of toCompress) {
    const preview = msg.content.slice(0, 200).replace(/\n/g, ' ');
    summaryParts.push(`[${msg.role}] ${preview}...`);
  }

  const summaryMsg: ChatMessage = {
    role: 'user',
    content: `[上下文摘要 — 之前 ${toCompress.length} 条消息已压缩]\n${summaryParts.join('\n')}`,
  };

  const result = [...systemMsgs, summaryMsg, ...toKeep];
  const compressedTokens = estimateMessagesTokens(result);

  return {
    messages: result,
    compressed: true,
    originalTokens,
    compressedTokens,
    removedCount: toCompress.length,
    trigger: 'absolute',
  };
}

// ==================== 百分比阈值自动压缩 ====================

export interface RatioCompressionOptions {
  /** 模型上下文窗口大小(tokens,如 8000 / 32000 / 128000) */
  contextLimit: number;
  /** 触发压缩的占用率(0-1,默认 0.85 = 85%) */
  triggerRatio?: number;
  /** 压缩后的目标占用率(0-1,默认 0.6 = 60%,留出空间继续对话) */
  targetRatio?: number;
  /** 保留最近 N 条消息(默认 6) */
  keepRecent?: number;
  /** 最少消息数(消息数不足时不压缩,默认 keepRecent + 1) */
  minMessages?: number;
}

const DEFAULT_TRIGGER_RATIO = 0.85;
const DEFAULT_TARGET_RATIO = 0.6;

/**
 * 百分比阈值自动压缩 — 当 token 占用率达到 triggerRatio 时自动压缩到 targetRatio。
 *
 * 与 compressContext 的区别:
 *   - compressContext 用绝对 maxTokens 阈值(固定 24000)
 *   - compressContextIfNeeded 用百分比阈值(动态适配不同模型的 contextLimit)
 *
 * 行为:
 *   - tokens / contextLimit < triggerRatio → 不压缩,返回原 messages
 *   - tokens / contextLimit >= triggerRatio → 压缩,目标压缩到 targetRatio * contextLimit 以下
 *   - 通过逐步增加 keepRecent 的压缩量,找到第一个使 compressedTokens < targetRatio * contextLimit 的方案
 *
 * @returns CompressionResult(含 trigger: 'ratio'|'none' 和 usageRatio)
 */
export function compressContextIfNeeded(
  messages: ChatMessage[],
  opts: RatioCompressionOptions,
): CompressionResult {
  const contextLimit = opts.contextLimit;
  const triggerRatio = opts.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
  const targetRatio = opts.targetRatio ?? DEFAULT_TARGET_RATIO;
  const keepRecent = opts.keepRecent ?? DEFAULT_KEEP_RECENT;
  const minMessages = opts.minMessages ?? keepRecent + 1;
  const triggerThreshold = Math.floor(contextLimit * triggerRatio);
  const targetThreshold = Math.floor(contextLimit * targetRatio);

  const originalTokens = estimateMessagesTokens(messages);
  const usageRatio = originalTokens / contextLimit;

  // 未达触发阈值,不压缩
  if (originalTokens < triggerThreshold || messages.length <= minMessages) {
    return {
      messages,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
      removedCount: 0,
      trigger: 'none',
      usageRatio,
    };
  }

  const systemMsgs = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  // 逐步减少 keepRecent,直到 compressedTokens < targetThreshold 或 keepRecent=1
  let bestResult: CompressionResult | null = null;
  for (let kr = Math.min(keepRecent, nonSystem.length - 1); kr >= 1; kr--) {
    if (nonSystem.length <= kr) continue;
    const toCompress = nonSystem.slice(0, nonSystem.length - kr);
    const toKeep = nonSystem.slice(nonSystem.length - kr);

    const summaryParts: string[] = [];
    for (const msg of toCompress) {
      const preview = msg.content.slice(0, 200).replace(/\n/g, ' ');
      summaryParts.push(`[${msg.role}] ${preview}...`);
    }
    const summaryMsg: ChatMessage = {
      role: 'user',
      content: `[上下文摘要 — 之前 ${toCompress.length} 条消息已压缩]\n${summaryParts.join('\n')}`,
    };
    const candidate = [...systemMsgs, summaryMsg, ...toKeep];
    const candidateTokens = estimateMessagesTokens(candidate);

    if (candidateTokens <= targetThreshold) {
      bestResult = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        trigger: 'ratio',
        usageRatio,
      };
      break;
    }
    // 记录最后一个候选(即使超过 target,也比不压缩好)
    if (!bestResult) {
      bestResult = {
        messages: candidate,
        compressed: true,
        originalTokens,
        compressedTokens: candidateTokens,
        removedCount: toCompress.length,
        trigger: 'ratio',
        usageRatio,
      };
    }
  }

  // bestResult 一定不为 null(因为 nonSystem.length > minMessages >= 2,至少有 1 条可压缩)
  return bestResult ?? {
    messages,
    compressed: false,
    originalTokens,
    compressedTokens: originalTokens,
    removedCount: 0,
    trigger: 'none',
    usageRatio,
  };
}

