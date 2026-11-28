// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 结果回灌的统一记账 —— 无论是否信封化,“这个工具读过这个路径”都要留在跟踪器里,
 * 否则压缩后重建提醒时会漏掉只以正文形态存在过的那些文件。
 */

import { parseEnvelope } from './envelope.js';
import type { ReadStateTracker } from './read-state.js';

export interface EnvelopeReadRecordInput {
  call: { name: string; arguments?: Record<string, unknown> };
  tracker?: ReadStateTracker;
  turn?: number;
}

export function recordEnvelopeRead(
  opts: EnvelopeReadRecordInput,
  text: string,
  meta: { enveloped: boolean; originalChars: number },
): void {
  if (!opts.tracker) return;
  const envelope = meta.enveloped ? parseEnvelope(text) : null;
  if (envelope) {
    // 已封装过的结果(重放 / 恢复):按信封里的结构化字段记账,不再重新生成信封
    opts.tracker.recordFromEnvelope(envelope, opts.turn ?? 0);
    return;
  }
  opts.tracker.recordToolCall({
    toolName: opts.call.name,
    args: opts.call.arguments,
    output: text.slice(0, 400),
    turn: opts.turn ?? 0,
    enveloped: false,
    originalChars: meta.originalChars,
    originalLines: text.split('\n').length,
  });
}
