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

/** 未勾登记行的**唯一判据**(本层与写盘闸/声明校验共用;不得各写一份,§0.6)。 */
export function isOpenRow(line) {
  return OPEN_RE.test(String(line ?? ''))
}

/** 侧车命中 ⇒ 用判据层的**单源映射**(顺序必须与散文同序,否则迁移即改判);没命中 ⇒ 回落散文。 */
export function bucketOf(line, rec) {
  return rec ? bucketFromFields(rec) : dispositionOf(line)
}

/** 两行逐字节对照的**首个分歧处**(只产证据,不做判定;判定永远只看等不等)。 */
function firstDiffProbe(a, b) {
  const limit = Math.min(a.length, b.length)
  let i = 0
  while (i < limit && a[i] === b[i]) i++
  const cut = (s) => (s.length <= i ? '(一边到此已结束)' : JSON.stringify(s.slice(i, i + 12)))
  return { at: i + 1, a: cut(a), b: cut(b) }
}

/**
 * 放行档的条件③:剥掉 after 里**那一枚**新增标记(位置一律取自 `claimMarkOf`,本层不另写
 * "牌在哪"第二把尺子,§0.6)之后,必须与 before **逐字节相等**。
 * 也就是"唯一差异 = 插入这枚牌":正文、勾选态、其余注记、空格一个字符都没动。
 * 牌两侧多打/少打的空格同样算"顺带改了别的东西"⇒ 拒(实测台账正形是牌紧贴 `- [ ]`,
 * 形如 `- [ ]（进行中@2026-10-23/甲） G-123 标题`,那是从旧行逐字节插出来的,天然过这一条)。
 * 位置量不出来 ⇒ `{ok:false}` 点名"未判定":取不到输入绝不冒绿(§0.3)。
 * @returns {{ok:true}|{ok:false,why:string}}
 */
export function addedMarkIsIsolated(oldLine, newLine, mark) {
  const o = String(oldLine ?? '')
  const n = String(newLine ?? '')
  const at = Number.isInteger(mark?.at) ? mark.at : null
  const text = typeof mark?.mark === 'string' ? mark.mark : null
  if (at === null || text === null)
    return { ok: false, why: '未判定:claimMarkOf 没交出牌的位置(at/mark)⇒ 无从证明"只多一枚牌"' }
  const stripped = n.slice(0, at) + n.slice(at + text.length)
  if (stripped === o) return { ok: true }
  const d = firstDiffProbe(stripped, o)
  return {
    ok: false,
    why: `剥掉那枚牌后与旧行第 ${d.at} 个字起不再逐字节相等(旧行"${d.b}" ↔ 剥牌后"${d.a}")`,
  }
}

/** 今日历日(本机时区)的 `YYYY-MM-DD` 形态 —— 条件②「日期不晚于今天」的**唯一**取值出口,
 * 调用方与测试一律 import 本件,不得自己再拼一份(§0.6;ISO 定宽形态可直接逐字比大小)。 */
export function todayIso() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 租约形态迁移分档(2026-10-23 立,承「台账挂牌没有合法通道」票;同日晚补齐条件③;
 * 2026-10-26 本席补齐条件②的「日期不晚于今天」边界,承同一票 L28073 的放行面收窄条款)。
 * 放行档 = 「无牌 → 完整租约」,四个条件**同时**成立才算 `add-complete`;任一不成立就落到
 * 自己的拒落档,由 `assertRowRewriteConservation` 点名是哪一条(§0.10:失效方向恒为"多要一次
 * 定向说明",绝不是"多放一次跳门"):
 *  ① `claimMarkOf(before)` 为空 —— 旧行本来没牌。摘约/换约都不在这一档,这正是"提交链上的门
 *     绝不代摘任何人的认领"要刻意保住的那一格(摘超龄牌另有兜底器物 `strip-stale-claim-marks`);
 *  ② `claimMarkOf(after)` 是**完整租约**(`form==='lease'` ∧ `date` ∧ `holder`,判据现读自
 *     `claimMarkOf`/`parseLeaseForm`)—— 裸 `（进行中）`、缺日期、缺持有者一律不算,所以守门 109
 *     的 CL4「裸牌新增即拦」不可能被本器旁路;**且日期不得晚于今天**(`todayIso()`,2026-10-26 补):
 *     明天以后的日期不改变挂牌动作本身,却把守门 109 CL1 的 72h 超龄兜底永远推到够不着——
 *     等于给认领牌发免死牌,这一型落在 `add-future` 档,拒并点名;
 *  ③ 把 after 里那一枚新增标记剥掉后与 before **逐字节相等**(见 `addedMarkIsIsolated`);
 *  ④ 主键维与归属桶维照常判,本档一条也不替它们放行(见 `assertRowRewriteConservation` 首尾)。
 *
 * 为什么必须有这一档:AGENTS §1「认领即租约」要求在共享工作树里给待办加牌,而旧断言把"加牌"与
 * "摘牌"同判 ⇒ 这条路结构上走不通(2026-10-23 12:00 实测:四行加租约整批拒落,全仓没有合法的
 * 挂牌通道,并发会话因此领同一张票重复做)。
 */
export function leaseTransitionOf(oldLine, newLine) {
  const o = String(oldLine ?? '')
  const n = String(newLine ?? '')
  const m0 = claimMarkOf(o)
  const m1 = claimMarkOf(n)
  const f0 = m0 ? m0.mark : null
  const f1 = m1 ? m1.mark : null
  if (f0 === f1) return 'same'
  if (!f0 && f1) {
    if (!(m1.form === 'lease' && m1.date && m1.holder)) return 'add-incomplete'
    // ISO `YYYY-MM-DD` 定宽形态,逐字比大小即日历比大小;晚于今天的牌进 add-future 档。
    if (m1.date > todayIso()) return 'add-future'
    return addedMarkIsIsolated(o, n, m1).ok ? 'add-complete' : 'add-attached'
  }
  if (f0 && !f1) return 'removed'
  return 'changed'
}

/**
 * @returns {string[]} 违规列表;空 = 放行。
 * 三件分别钉:主键漂(门 71 会按缺失回捞,等于把行判死)、租约形态变化(=本器代摘)、归属桶变化(=账面虚增)。
 * 唯一放行的形态变化 = 「旧行本来没牌 → 新行多一枚完整租约(日期不晚于今天),且除此之外逐字节不动」四条件全中
 * (AGENTS §1 要求的认领动作,不是代摘);摘牌、换持有者、改日期、裸牌/半牌、未来日期牌、加牌顺带改正文
 * 仍一律拒,且**逐条点名是哪一条件不满足**(§0.10)。分档判据见 `leaseTransitionOf`。
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
    v.push(
      `租约被切掉(原牌 ${f0})⇒ 等于本器代摘他人认领:放行档要求**旧行本来没牌**(条件①),摘约请走兜底器物 strip-stale-claim-marks`,
    )
  } else if (lease === 'changed') {
    const f0 = claimMarkOf(o)?.mark ?? '(无)'
    const f1 = claimMarkOf(n)?.mark ?? '(无)'
    v.push(
      `租约形态变化:${f0} → ${f1}(改持有者/改日期都是换约,本器既不代摘也不代改:**旧行本来没牌**这一条不满足,条件①)`,
    )
  } else if (lease === 'add-incomplete') {
    const f1 = claimMarkOf(n)?.mark ?? '(无)'
    v.push(
      `加的不是完整租约:${f1}(条件②:必须 @日期/持有者 三要素齐备;裸（进行中）与半牌由守门 109 CL4「新增即拦」,本器不给它开后门)`,
    )
  } else if (lease === 'add-future') {
    const m1 = claimMarkOf(n)
    v.push(
      `挂牌日期在未来:${m1?.date} > 今天(${todayIso()})(条件②:租约日期必须不晚于今天——写明天以后的日期,守门 109 CL1 的 72h 超龄兜底永远够不着这张牌,等于给认领牌发免死牌;出路=按今天真实日期重挂)`,
    )
  } else if (lease === 'add-attached') {
    const d = addedMarkIsIsolated(o, n, claimMarkOf(n))
    v.push(
      `加牌这一步顺带改了别的东西(条件③:${d.ok ? '(判定与分档不一致,请上报)' : d.why}):唯一差异必须只是插入这枚牌。出路=分两次定向改写:先只加牌(正文一个字都别动),再单独改正文/注记`,
    )
  }
  // 'add-complete'(四条件全中)与 'same'(没牌/同一张牌)放行;其余五档逐条点名。

  const b0 = bucketOf(o, oldRec)
  const b1 = bucketOf(n, newRec)
  if (b0 !== b1) v.push(`归属判定会漂:${b0} → ${b1}`)
  return v
}

/**
 * **完整租约**的判据(三要素齐备)= `claimMarkOf` 交出 `form==='lease'` ∧ 有日期 ∧ 有持有者。
 * 只问 `claimMarkOf` 那一把尺子,不另拼正则(§0.6);裸 `（进行中）`、缺日期、缺持有者一律不算,
 * 所以守门 109 CL4「新增即拦」不可能被本层旁路。
 */
export function completeLeaseOf(line) {
  const m = claimMarkOf(line)
  if (!m) return null
  return m.form === 'lease' && m.date && m.holder ? m : null
}

/**
 * 族内租约合并(2026-10-25 立,承「折叠把认领弄丢 / A4 族级认领守恒整批按住」票)。
 *
 * 立因(实测,不是推断):折叠一族 N→1 时,被折掉的那几行上的租约随行消失。若整族只有副本带牌、
 * 保留行不带,折叠之后这一族的认领就**真的没了** —— 认领守恒断言(A4 族级)当场整批拒落,
 * 于是"漂开副本折叠"这条通道一步也走不通;而若为了过断言把旧牌硬搬回去,又会把已裁决释放的票
 * 重新算成在飞(比"少一张牌"更坏)。
 *
 * 本层给的是**合并**而不是搬运:保留行没有牌时,把族内**唯一**一张完整租约原样插到它复选框之后
 * (三要素 `（进行中@YYYY-MM-DD/持有者）` 只留一个);下面三种情形一律**不合并、交人裁**
 * (§0.10 失效方向恒为"多要一次定向说明"):
 *  ① 族内 ≥2 张**互不相同**的完整租约 —— 多人在飞,机器摘掉任何一张都是代摘他人认领;
 *  ② 保留行自己有牌,而副本的牌与它不同 —— 那是"换约",不是合并;
 *  ③ 副本只有裸牌/半牌 —— 插进去等于新增一枚守门 109 CL4 要拦的裸牌(不拿它充数)。
 *
 * @param {string} keeperLine 保留行原文
 * @param {string[]} donorLines 将被折掉的其余行原文
 * @returns {{ok:true, claim:string|null, marks:string[], undetermined:string[]}
 *          |{ok:false, conflict:string[], why:string}}
 */
export function leaseCarryOf(keeperLine, donorLines) {
  const keeper = completeLeaseOf(keeperLine)
  const marks = []
  const undetermined = []
  for (const l of Array.isArray(donorLines) ? donorLines : []) {
    const m = completeLeaseOf(l)
    if (m) {
      if (!marks.includes(m.mark)) marks.push(m.mark)
      continue
    }
    // 有"进行中"字样却过不了三要素 ⇒ 裸牌/半牌:不参与合并,但必须点名(不冒绿)。
    if (claimMarkOf(l)) undetermined.push(String(l).slice(0, 80))
  }
  if (keeper) {
    const others = marks.filter((x) => x !== keeper.mark)
    if (others.length)
      return {
        ok: false,
        conflict: [keeper.mark, ...others],
        why: `保留行自带租约 ${keeper.mark},与被折行上的 ${others.join(' / ')} 不同 ⇒ 那是换约不是合并,交人裁`,
      }
    return { ok: true, claim: null, marks, undetermined }
  }
  if (marks.length > 1)
    return {
      ok: false,
      conflict: marks,
      why: `族内 ${marks.length} 张互不相同的完整租约(多人在飞)⇒ 机器不代摘任何一张,交人裁`,
    }
  return { ok: true, claim: marks[0] ?? null, marks, undetermined }
}

/**
 * 把一枚合并来的租约插进保留行(**只此一种改写形态**:复选框与正文之间原样插入,别处一字不动)。
 * 返回的文本必须再过 `assertRowRewriteConservation`(调用方判),本函数不自证 —— 它只产候选。
 * 给不出复选框前缀(残行/已勾行)⇒ 原样返回,由调用方按"未合并"处理并点名。
 */
export function applyLeaseCarry(keeperLine, claim) {
  const s = String(keeperLine ?? '')
  if (!claim) return s
  const m = /^(\s*(?:[-*]\s*)?\[[ ]\])([\s\S]*)$/.exec(s)
  if (!m) return s
  return `${m[1]}${claim}${m[2]}`
}

export const __test__ = {
  assertRowRewriteConservation,
  addedMarkIsIsolated,
  bucketOf,
  leaseTransitionOf,
  completeLeaseOf,
  leaseCarryOf,
  applyLeaseCarry,
  todayIso,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
