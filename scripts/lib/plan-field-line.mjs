// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账行内标头 = 侧车的**投影**(2026-10-22 立,规格 §3)。
 *
 * 渲染与解析必须是同一份实现:两处各写一遍字符串拼接,迟早漂成"一边写得出、另一边读不回",
 * 而那时红的是门、错的是格式。标头形态(前缀 `归:`、分隔符 `｜`、顺序 归→等)是**契约**不是风格。
 *
 * 权威在侧车,标头只负责"人一眼看得懂"。因此:
 *  - 超预算只截断显示中的 owner,等段一定保住(丢了"在等什么"就等于把这行退回不可判);
 *  - parse 遇到截断省略号一律报 `malformed` 而**不猜**被截掉的字符(§0.3:"没判"不许写成"判过");
 *  - 只有 `归:` 开头且位于登记行复选框之后的那一段才算标头,反引号内的举例不算(复用单源码段尺子)。
 */
import { codeSpanRangesOf, insideCodeSpan } from './plan-task-index.mjs'

export const MAX = 48
const OPEN = '〔'
const CLOSE = '〕'
const SEP = '｜'
const OWNER_PREFIX = '归:'
const WAIT_PREFIX = '等:'
const NO_OWNER = '—'

/** 侧车记录 → 标头(不含标头时为 '')。owner 超长时截 owner,不牺牲等段。 */
export function renderHeader(rec) {
  if (!rec) return ''
  const owner = String(rec.owner ?? '').trim() || NO_OWNER
  const blocking = String(rec.blocking ?? '').trim()
  const waitSeg = rec.waiting && rec.waiting !== 'none' && blocking ? WAIT_PREFIX + blocking : ''
  const fixed = OWNER_PREFIX.length + owner.length + (waitSeg ? SEP.length + waitSeg.length : 0)
  let shownOwner = owner
  if (fixed > MAX) {
    const room = Math.max(1, MAX - (fixed - owner.length) - 1)
    shownOwner = owner.slice(0, room) + '…'
  }
  const parts = [OWNER_PREFIX + shownOwner]
  if (waitSeg) parts.push(waitSeg)
  return OPEN + parts.join(SEP) + CLOSE
}

/** 行 → 标头语义。`malformed` = 看见了但读不回(要人看),`rec=null ∧ malformed=false` = 没有标头。 */
export function parseHeader(line) {
  const text = String(line ?? '')
  const head = /^\s*-\s*\[[ xX]\]\s*/.exec(text)
  if (!head) return { rec: null, malformed: false }
  const m = /〔([^〕]*)〕/.exec(text)
  if (!m) return { rec: null, malformed: false }
  const { spans, undetermined } = codeSpanRangesOf(text)
  if (!undetermined && insideCodeSpan(spans, m.index, m[0].length))
    return { rec: null, malformed: false }
  const body = m[1]
  if (!body.startsWith(OWNER_PREFIX)) return { rec: null, malformed: false }
  if (body.includes('…')) return { rec: null, malformed: true }
  const fields = { key: null, owner: '', waiting: 'none', blocking: '' }
  for (const seg of body.split(SEP)) {
    const i = seg.indexOf(':')
    if (i < 0) return { rec: null, malformed: true }
    const k = seg.slice(0, i).trim()
    const v = seg.slice(i + 1).trim()
    if (k === '归') fields.owner = v === NO_OWNER ? '' : v
    else if (k === '等') {
      fields.waiting = 'env'
      fields.blocking = v
    } else return { rec: null, malformed: true }
  }
  return { rec: fields, malformed: false }
}

/** 剥掉本层生成的那一段;其它括号(注记、正文)一字不动。 */
export function stripHeader(line) {
  const m = /^(\s*-\s*\[[ xX]\]\s*)〔归[:：][^〕]*〕[ \t]*(.*)$/s.exec(String(line ?? ''))
  if (!m) return String(line ?? '')
  return m[1] + m[2]
}

/** 投影自检:无标头 = true(不是失败);有标头但读不回 = false。 */
export function roundTripOk(line) {
  const p = parseHeader(line)
  if (p.malformed) return false
  if (!p.rec) return true
  const again = renderHeader(p.rec)
  return again === '' || String(line).includes(again)
}

export const __test__ = { renderHeader, parseHeader, stripHeader, roundTripOk, MAX }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
