// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 改写登记行时的三维守恒断言(2026-10-22 立)。把 AGENTS §1 那条"只是话"的规矩做成器物。
 * 规格:`docs/superpowers/specs/2026-10-22-plan-ledger-schema-design.md` §2。
 *
 * 立因是同日实测:把 161 枚超长行压到 ≤400 字,切掉了行内"归属:…"句子,派单口径当场 48→100
 * (52 枚他人持有的票变成可领),而门 71/109/130/203/229/234 全绿 —— 因为**判定吃的是行文本**,
 * 删文本就是改判据输入。⇒ 任何改写整行的器物都必须先过这道断言,违规列表非空即拒写/拒落。
 *
 * 侧车桶的优先级必须与散文 `DISPOSITION_RULES` **同序**(先 归属 再 等待):
 * 否则"把信息从散文搬进侧车"这一步自己就会改判,那正是本断言要拦的事。
 * 调用方一律 import 本件,不得各写一份(§0.6;同类漂移本仓已记过多次)。
 */
import { bucketFromFields, claimMarkOf, dispositionOf, keyOfRow } from './plan-task-index.mjs'

const OPEN_RE = /^\s*- \[ \]/
const DONE_RE = /^\s*- \[[xX]\]/

/** 侧车命中 ⇒ 用判据层的**单源映射**(顺序必须与散文同序,否则迁移即改判);没命中 ⇒ 回落散文。 */
export function bucketOf(line, rec) {
  return rec ? bucketFromFields(rec) : dispositionOf(line)
}

/**
 * 租约形态迁移分档(2026-10-23 立,承「台账挂牌没有合法通道」票):
 * `same` = 没牌/同一张牌;`add-complete` = 无牌 → 完整租约(日期+持有者);
 * `removed` = 牌被切掉;`changed` = 换牌/半牌/裸牌等其余形态变化。
 *
 * 只放行 `add-complete` 这一档:AGENTS §1「认领即租约」要求在共享工作树里给待办加牌,
 * 而旧断言把"加牌"与"摘牌"同判 ⇒ 这条路结构上走不通(2026-10-23 实测四行加租约整批拒落)。
 * 摘牌、换持有者/日期、裸 `（进行中）` 仍一律拒:它们会改派单面的归属。
 */
export function leaseTransitionOf(oldLine, newLine) {
  const m0 = claimMarkOf(oldLine)
  const m1 = claimMarkOf(newLine)
  const f0 = m0 ? m0.mark : null
  const f1 = m1 ? m1.mark : null
  if (f0 === f1) return 'same'
  if (!f0 && m1 && m1.form === 'lease' && m1.date && m1.holder) return 'add-complete'
  if (f0 && !f1) return 'removed'
  return 'changed'
}

/**
 * @returns {string[]} 违规列表;空 = 放行。
 * 三件分别钉:主键漂(门 71 会按缺失回捞,等于把行判死)、租约形态变化(=本器代摘)、归属桶变化(=账面虚增)。
 * 唯一放行的形态变化 = 无牌 → 完整租约(日期+持有者):那是 AGENTS §1 要求的认领动作,不是代摘;
 * 摘牌、换牌、裸牌仍拒(见 `leaseTransitionOf`)。
 */
export function assertRowRewriteConservation({ oldLine, newLine, oldRec = null, newRec = null }) {
  const o = String(oldLine ?? '')
  const n = String(newLine ?? '')
  if (!OPEN_RE.test(o))
    return [
      '旧行不是未勾登记行 ⇒ 无从守恒,判未判定并拒写(拿"没什么可守恒"蒙过正是本仓记过最多次的那一型)',
    ]
  if (!OPEN_RE.test(n))
    return DONE_RE.test(n)
      ? ['新行已翻勾 ⇒ 这属于翻勾/删行动作,请走对应器物,不走本断言']
      : ['新行不是未勾登记行 ⇒ 这属于删行动作,请走对应器物,不走本断言']

  const v = []
  const k0 = keyOfRow(o)
  const k1 = keyOfRow(n)
  if (k0 !== k1) v.push(`主键漂了:${k0 ?? '(无)'} → ${k1 ?? '(无)'}`)

  const lease = leaseTransitionOf(o, n)
  if (lease === 'removed') {
    const f0 = claimMarkOf(o)?.mark ?? '(无)'
    v.push(`租约被切掉(原牌 ${f0})⇒ 等于本器代摘他人认领`)
  } else if (lease === 'changed') {
    const f0 = claimMarkOf(o)?.mark ?? '(无)'
    const f1 = claimMarkOf(n)?.mark ?? '(无)'
    v.push(`租约形态变化:${f0} → ${f1}`)
  }
  // lease === 'add-complete' 放行:AGENTS §1 要求给待办加牌,这是正当动作;
  // 'same' 放行。摘牌/换牌/半牌仍由上面两档拒。

  const b0 = bucketOf(o, oldRec)
  const b1 = bucketOf(n, newRec)
  if (b0 !== b1) v.push(`归属判定会漂:${b0} → ${b1}`)
  return v
}

export const __test__ = { assertRowRewriteConservation, bucketOf, leaseTransitionOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
