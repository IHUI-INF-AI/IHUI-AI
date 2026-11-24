// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 输出预算（2026-11-20）：把"头 + 尾 + 截断标记"做成全仓唯一实现。
 *
 * 背景：只留头会丢掉命令/测试输出的最终结论（最后几行往往是 PASS/FAIL、错误摘要），
 * 只留尾会丢掉命令与前半段关键信息。工具结果裁剪器（ai-service）早已采用头+尾，
 * 这里给 API 侧的执行结果一处同语义的预算器，避免第 N 份"截断"实现漂移。
 */
export interface BudgetedText {
  text: string
  truncated: boolean
  originalChars: number
  headChars: number
  tailChars: number
  /** 被省略的 UTF-16 码元数（headChars + tailChars + omittedChars === originalChars） */
  omittedChars: number
}

export const OUTPUT_TRUNCATE_MARKER = '\n… [输出截断：共 %N% 字符，保留头 %H% / 尾 %T%] …\n'

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

/**
 * 按 UTF-16 码元预算截前缀，切口落在代理对内部时丢弃半个码元（DSH
 * `truncateWithoutSplittingSurrogatePair` 同语义）。否则 `slice` 会返回孤立高位代理项，
 * 前端渲染成 �，把"截断"伪装成"文件损坏"。
 */
export function truncateWithoutSplittingSurrogatePair(text: string, maxUnits: number): string {
  if (maxUnits <= 0) return ''
  if (text.length <= maxUnits) return text
  let end = maxUnits
  if (isHighSurrogate(text.charCodeAt(end - 1)) && isLowSurrogate(text.charCodeAt(end))) end--
  return text.slice(0, end)
}

export function truncateBothEnds(raw: string, maxChars: number): BudgetedText {
  const total = raw.length
  if (!Number.isFinite(maxChars) || maxChars <= 0 || total <= maxChars) {
    return {
      text: raw,
      truncated: false,
      originalChars: total,
      headChars: total,
      tailChars: 0,
      omittedChars: 0,
    }
  }
  const budget = Math.floor(maxChars)
  const rawHead = Math.max(0, Math.floor(budget * 0.6))
  const rawTail = Math.max(0, budget - rawHead)
  const head = truncateWithoutSplittingSurrogatePair(raw, rawHead)
  let tailStart = total - rawTail
  if (
    tailStart > 0 &&
    isLowSurrogate(raw.charCodeAt(tailStart)) &&
    isHighSurrogate(raw.charCodeAt(tailStart - 1))
  ) {
    tailStart++
  }
  const tail = raw.slice(tailStart)
  const headChars = head.length
  const tailChars = tail.length
  const omittedChars = Math.max(0, total - headChars - tailChars)
  const marker = OUTPUT_TRUNCATE_MARKER.replace('%N%', String(total))
    .replace('%H%', String(headChars))
    .replace('%T%', String(tailChars))
  return {
    text: head + marker + tail,
    truncated: true,
    originalChars: total,
    headChars,
    tailChars,
    omittedChars,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
