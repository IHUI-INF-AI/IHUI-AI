/**
 * 上下文管理 — token 估算与历史压缩。
 *
 * 灵感来源:cli 的 `cli-shell` crate 的上下文管理机制。
 * 策略:
 *   - token 估算:gpt-tokenizer(BPE 真实分词,精确匹配 GPT-4/Cl100k 编码)
 *   - 压缩策略:保留首条 system + 尾部最近 N 条,中段用摘要替代
 *   - 阈值触发:超过 maxTokens 时自动压缩
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
  };
}
