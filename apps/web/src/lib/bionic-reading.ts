// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 仿生阅读(bionic reading)文本切分。
 *
 * 立因(2026-11-15):`components/ai/markdown-stream.tsx` 早在「外观 v2」那批就
 * import 了本模块的 `bionicizeText`,但本文件当时没随提交入库 ⇒ web 的 typecheck
 * 结构性失败(TS2307),并连带把 `segments.map((segment, i) => ...)` 的入参类型
 * 退化成一串 noImplicitAny。本次补实现。
 *
 * 单一职责:把一段**纯文本**切成 `{ text, bold }` 片段,只加粗每个拉丁词的词首
 * 一小截,中文/日文/韩文等无词界的文字原样透传(按字形强行切分反而更难读)。
 *
 * 两条硬约束:
 *   ① **拼接恒等**:所有片段 `text` 顺次相连必须逐字等于入参 —— 否则复制、
 *      搜索("Ctrl+F 找不到屏幕上明明有的字")、正则断言全线失真;
 *   ② **无变化返回 null**:调用方靠这个信号保留原 children 的节点身份,
 *      不做无意义的子树重建(英文也没有的纯中文消息不该被包一层 Fragment)。
 */

/** 一段切分结果。`bold` 为 true 的片段是词首加粗段。 */
export interface BionicSegment {
  text: string
  bold: boolean
}

/** 词首加粗比例。0.45 是仿生阅读的通行经验值:再高会把词读成两截。 */
const BOLD_RATIO = 0.45

/**
 * 只匹配「拉丁字母 + 数字」构成的词。
 * `\p{Script=Latin}` 而不是 `a-zA-Z`:法语/德语/越南语的变音字母也要加粗。
 * 中日韩文字不在此集合内 ⇒ 天然不被切分。
 */
const TOKEN_RE = /[\p{Script=Latin}\p{Nd}]+/gu

/**
 * 把文本切成加粗/不加粗片段。
 *
 * @returns 片段数组;整段没有可加粗的词(纯 CJK、纯标点、空串)时返回 `null`
 */
export function bionicizeText(text: string): BionicSegment[] | null {
  if (!text) return null
  const segments: BionicSegment[] = []
  let cursor = 0
  let changed = false

  for (const match of text.matchAll(TOKEN_RE)) {
    const token = match[0]
    const start = match.index
    // 单字符词(冠词 a、数字 1)不加粗:整段都是粗体和整段都不粗一样没用
    if (token.length < 2) continue
    // 至少加粗 1 个字符,且必须给后半截留下字符(全粗 = 没有强调)
    const cut = Math.min(token.length - 1, Math.max(1, Math.round(token.length * BOLD_RATIO)))
    if (start > cursor) segments.push({ text: text.slice(cursor, start), bold: false })
    segments.push({ text: token.slice(0, cut), bold: true })
    segments.push({ text: token.slice(cut), bold: false })
    cursor = start + token.length
    changed = true
  }

  if (!changed) return null
  if (cursor < text.length) segments.push({ text: text.slice(cursor), bold: false })
  return segments
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
