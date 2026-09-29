// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * read_file 输出的 token 预算层(吸收 G-937972)。
 *
 * 病灶:read_file 的闸是字节(MAX_READ_BYTES)与行数(MAX_READ_LINES),都不是模型
 * 真正付钱的量纲 —— 一个 400 行、每行 400 字符的文件两道闸都过,却是一大块 token。
 * 上游 read-text.ts 的做法:超过 READ_MAX_OUTPUT_TOKENS 的整读降级成**部分视图**:
 * 在 0.85 预算内二分出最大的行前缀(极端情形:第一行就爆预算时退到字符前缀),
 * 并附 partialViewNotice 点名下一窗的 offset,让模型能续读而不是瞎猜。
 *
 * 两档处置(与上游一致):
 *   - **初始整读**(无 offset/limit)超限 ⇒ 降级部分视图,不报错 —— 模型没做错任何事;
 *   - **带 offset/limit 的 range 读**超限 ⇒ 硬错(errorType `read_output_too_many_tokens`)
 *     —— 点名窗口就是模型明确要的范围,替它再砍等于静默改答,必须让它自己改参数。
 *
 * 0.85 系数的出处:整读超限时给 notice 与续读往返留余量,别把预算顶满。
 * 预算值与上游 contracts 的 READ_MAX_OUTPUT_TOKENS 同值(25_000)。
 */

import { estimateTokens } from '@ihui/context-compaction';

/** read_file 单次回灌的 token 上限(与上游 contracts/src/tools/read.ts 同值) */
export const READ_MAX_OUTPUT_TOKENS = 25_000;

/**
 * read_file 用的 token 估算出口(@ihui/context-compaction 的 estimateTokens,BPE 计数)。
 * 收一层薄壳:预算层的所有计数都从这一个名字过,换估算器只改这里。
 */
export function estimateReadTokens(text: string): number {
  return estimateTokens(text);
}

/** 部分视图的实际目标预算:0.85 × 上限 */
export const READ_TOKEN_BUDGET_PARTIAL_TARGET = Math.floor(READ_MAX_OUTPUT_TOKENS * 0.85);

/** 空文件警示(而非报错/空输出:沉默会被读成"读到了但没内容") */
export const EMPTY_FILE_REMINDER =
  '<system-reminder>Warning: the file exists but the contents are empty.</system-reminder>';

/** offset 越过文件末尾的警示(而非报错:文件真实行数就是模型的续读坐标) */
export function buildOffsetBeyondEofReminder(offset: number, totalLines: number): string {
  return (
    `<system-reminder>Warning: the file exists but is shorter than the provided offset (${offset}). ` +
    `The file has ${totalLines} lines.</system-reminder>`
  );
}

/** range 读超预算的硬错文案(带两个 token 数,模型能算出该改多小的窗口) */
export function buildReadOutputTooManyTokensMessage(tokenCount: number, filePath: string): string {
  return (
    `File content (${tokenCount} tokens) exceeds maximum allowed tokens (${READ_MAX_OUTPUT_TOKENS}). ` +
    `Use offset and limit parameters to read specific portions of ${filePath}, ` +
    'or search for specific content instead of reading the whole file.'
  );
}

export interface TokenCapPartialView {
  /** 预算内的正文前缀(行或字符) */
  content: string;
  /** 本次视图覆盖的行数(字符前缀档恒为 1) */
  numLines: number;
  /** 视图起始行(1-based) */
  startLine: number;
  /** 视图结束行 */
  endLine: number;
  /** 下一窗的 offset(续读坐标;字符前缀档无意义,取 endLine+1) */
  nextOffset: number;
  truncatedByTokenCap: true;
  partialViewNotice: string;
}

/** 在 ≤ target 预算内二分出最大的行前缀行数(与上游 findLargestPrefixWithinTokenBudget 同形) */
export function findLargestPrefixWithinTokenBudget(lines: readonly string[]): number {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateReadTokens(lines.slice(0, mid).join('\n')) <= READ_TOKEN_BUDGET_PARTIAL_TARGET) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/** 行前缀完全装不下时,退到字符前缀(单行巨文件:minified JS / CSV 一行流) */
export function findLargestPrefixCharsWithinTokenBudget(content: string): number {
  let low = 0;
  let high = content.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateReadTokens(content.slice(0, mid)) <= READ_TOKEN_BUDGET_PARTIAL_TARGET) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/**
 * 由超限文本构造部分视图。行前缀装得下用行;装不下(≥1 行就爆)用字符前缀;
 * 连 1 个字符都装不下(理论边界)返回 undefined,调用方按硬错处置。
 */
export function createTokenCapPartialView(input: {
  content: string;
  startLine: number;
  totalLines: number;
  tokenCount: number;
}): TokenCapPartialView | undefined {
  const { content, startLine, totalLines, tokenCount } = input;
  const lines = content.split('\n');
  if (lines.length === 0) return undefined;

  const lineCount = findLargestPrefixWithinTokenBudget(lines);
  if (lineCount > 0) {
    const shown = lines.slice(0, lineCount).join('\n');
    const endLine = startLine + lineCount - 1;
    const nextOffset = endLine + 1;
    // 建议的续读 limit 取"本窗行数"而不是固定值:同质行分布下下一窗也装得下,
    // 且 range 超限是硬错 —— 给一个大概率一次就对的参数比给一个大参数可靠。
    return {
      content: shown,
      numLines: lineCount,
      startLine,
      endLine,
      nextOffset,
      truncatedByTokenCap: true,
      partialViewNotice:
        `The file is too large to display in full (${tokenCount} estimated tokens, limit ${READ_MAX_OUTPUT_TOKENS}). ` +
        `Showing a partial view of lines ${startLine}-${endLine} of ${totalLines}. ` +
        `Use read_file with offset ${nextOffset} and limit ${lineCount} to continue, ` +
        'or use a search tool to find a specific section.',
    };
  }

  const charCount = findLargestPrefixCharsWithinTokenBudget(content);
  if (charCount <= 0) return undefined;
  return {
    content: content.slice(0, charCount),
    numLines: 1,
    startLine,
    endLine: startLine,
    nextOffset: startLine + 1,
    truncatedByTokenCap: true,
    partialViewNotice:
      `The file is too large to display in full (${tokenCount} estimated tokens, limit ${READ_MAX_OUTPUT_TOKENS}). ` +
      'Showing a partial view of the first line because the first line alone exceeds the token budget. ' +
      'Use read_file with a smaller range or use a search tool to find a specific section.',
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
