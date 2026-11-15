// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 仿生阅读(Bionic Reading)分词(2026-11-15 v2 立)。
 *
 * 只加粗「拉丁词」的前 40%(最多 5 个字符):
 *   - 中文没有空格分词,若按字符加粗会把整段变成粗体噪点,因此含 CJK 的 token 整体跳过;
 *   - 纯数字、过短词(少于 3 个字母)跳过,避免 "a" / "2026" 也被加粗;
 *   - 纯函数,渲染层只负责把 bold 段包成 <b data-bionic>,样式在 globals.css 一处。
 */

export interface BionicSegment {
  text: string
  bold: boolean
}

export interface BionicSplit {
  lead: string
  rest: string
}

/** 单个 token 是否可做仿生加粗;不可加粗返回 null */
export function splitBionicWord(word: string): BionicSplit | null {
  // 与中文混排、带其它标点的 token 一律跳过(首段加粗会落在标点上,观感更差)
  if (!/^[A-Za-z0-9][A-Za-z0-9'’.-]*$/.test(word)) return null
  const latinCount = (word.match(/[A-Za-z]/g) ?? []).length
  if (latinCount < 3) return null
  const leadLength = Math.min(5, Math.max(1, Math.ceil(latinCount * 0.4)))
  return { lead: word.slice(0, leadLength), rest: word.slice(leadLength) }
}

/**
 * 把一段纯文本切成「加粗/普通」片段。
 * 返回 null 表示无需改写(没有可加粗的 token),调用方可直接复用原节点。
 */
export function bionicizeText(text: string): BionicSegment[] | null {
  if (!text) return null
  // 保留空白段(空格/换行必须原样留下,否则 markdown 排版会粘连)
  const parts = text.split(/(\s+)/)
  const segments: BionicSegment[] = []
  let changed = false
  for (const part of parts) {
    if (!part) continue
    if (/^\s+$/.test(part)) {
      segments.push({ text: part, bold: false })
      continue
    }
    const split = splitBionicWord(part)
    if (!split) {
      segments.push({ text: part, bold: false })
      continue
    }
    changed = true
    if (split.lead) segments.push({ text: split.lead, bold: true })
    if (split.rest) segments.push({ text: split.rest, bold: false })
  }
  return changed ? segments : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
