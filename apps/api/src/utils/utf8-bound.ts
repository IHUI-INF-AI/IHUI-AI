// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * JS 侧 UTF-8 保形有界化截断(b75-3#2,2026-09-30,上游出处 zcode
 * dynamic-workflow-run-workspace.ts:161-219、script-workflow-process.ts:7,185-188)。
 *
 * 机制(降维适配本仓,不照抄上游代码):
 * - truncateUtf8Head:按字节预算切头,预算落在多字节序列中间时回退到完整字符边界
 *   (少一个字符好过解码出 U+FFFD);
 * - truncateUtf8Tail:按字节预算保**尾部** —— 上游子进程 stderr 保留尾部 64KiB 而非头部
 *   (错误根因几乎总在输出末尾),本仓以 STDERR_TAIL_LIMIT_BYTES 承接同语义;
 * - boundUtf8:按正文形状有界化 —— 字符串切头;数组逐项累加,放不下的连同其后全部去尾;
 *   `{exitCode,stdout,stderr}` 形状 exitCode 恒保留、两路输出各分一半预算、
 *   一路用不完的余额让给另一路;其它值序列化后超限退化为切头 JSON 文本(形状已不可保)。
 *
 * 与上游审计面同理:截断并**说明**截断(truncated + totalBytes),不做"溢出即拒绝"——
 * 那是取数面的政策;这里服务的是日志/审计/落库前有界化。
 */

/** 上游子进程 stderr 保尾上限同款:64KiB。 */
export const STDERR_TAIL_LIMIT_BYTES = 64 * 1024

export function utf8ByteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}

/** 把字符串切到 ≤ maxBytes 个 UTF-8 字节,不切在多字节序列中间(宁可少一个字符)。 */
export function truncateUtf8Head(text: string, maxBytes: number): string {
  if (utf8ByteLength(text) <= maxBytes) return text
  const bytes = Buffer.from(text, 'utf8').subarray(0, Math.max(0, maxBytes))
  // 去掉尾部不完整的多字节序列:续字节(10xxxxxx)与悬空首字节(11xxxxxx)一并回退,
  // decode 会把不完整序列换成 U+FFFD,我们宁可少一个字符。
  let end = bytes.length
  while (end > 0 && (bytes[end - 1]! & 0b1100_0000) === 0b1000_0000) end -= 1
  if (end > 0 && (bytes[end - 1]! & 0b1100_0000) === 0b1100_0000) end -= 1
  return bytes.subarray(0, end).toString('utf8')
}

/** 保**尾部**的字节预算截断:从头侧丢弃超出预算的字节,起点落在被切断的多字节序列上时整段丢弃。 */
export function truncateUtf8Tail(text: string, maxBytes: number): string {
  if (utf8ByteLength(text) <= maxBytes) return text
  const bytes = Buffer.from(text, 'utf8')
  let start = Math.max(0, bytes.length - Math.max(0, maxBytes))
  // 起点是续字节(10xxxxxx)= 所属序列的头被切掉了,跳到下一个首字节。
  while (start < bytes.length && (bytes[start]! & 0b1100_0000) === 0b1000_0000) start += 1
  return bytes.subarray(start).toString('utf8')
}

export interface Utf8BoundResult {
  result: unknown
  truncated: boolean
  /** 截断前原值的序列化字节数(截断说明/审计用)。 */
  totalBytes: number
}

function isRunOutput(
  value: unknown,
): value is { exitCode: number; stdout: string; stderr: string } & Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const fields = value as Record<string, unknown>
  return (
    typeof fields.exitCode === 'number' &&
    typeof fields.stdout === 'string' &&
    typeof fields.stderr === 'string'
  )
}

/**
 * 按正文形状有界化(上游 boundWorkspaceResult 同型):
 * - 字符串:切头;
 * - 数组:逐项累加(JSON 字节数 + 逗号),放不下的连同其后全部去尾;
 * - `{exitCode,stdout,stderr}`:exitCode 恒保留,两路输出各分一半预算,余额互让;
 * - 其它:不超限原样,超限退化成切头的 JSON 文本(形状已不可保)。
 */
export function boundUtf8(result: unknown, maxBytes: number): Utf8BoundResult {
  const serialized = JSON.stringify(result) ?? 'null'
  const totalBytes = utf8ByteLength(serialized)
  if (totalBytes <= maxBytes) return { result, truncated: false, totalBytes }

  if (typeof result === 'string') {
    return { result: truncateUtf8Head(result, maxBytes), truncated: true, totalBytes }
  }
  if (Array.isArray(result)) {
    const kept: unknown[] = []
    let used = 2 // 方括号
    for (const item of result) {
      const itemBytes = utf8ByteLength(JSON.stringify(item) ?? 'null') + 1
      if (used + itemBytes > maxBytes) break
      kept.push(item)
      used += itemBytes
    }
    return { result: kept, truncated: true, totalBytes }
  }
  if (isRunOutput(result)) {
    const overhead = utf8ByteLength(JSON.stringify({ ...result, stdout: '', stderr: '' }))
    const budget = Math.max(0, maxBytes - overhead)
    const stderrWant = utf8ByteLength(result.stderr)
    const stdoutWant = utf8ByteLength(result.stdout)
    // 各分一半;一路用不完的余额让给另一路。
    const stderrBudget = Math.min(stderrWant, Math.max(budget >> 1, budget - stdoutWant))
    const stdoutBudget = Math.max(0, budget - stderrBudget)
    return {
      result: {
        ...result,
        stdout: truncateUtf8Head(result.stdout, stdoutBudget),
        stderr: truncateUtf8Head(result.stderr, stderrBudget),
      },
      truncated: true,
      totalBytes,
    }
  }
  return { result: truncateUtf8Head(serialized, maxBytes), truncated: true, totalBytes }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
