// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 计划条目编号的"登记行重号"判据(票 G-927,2026-10-21 立)。
//
// 只管一件事:**登记行(`- [ ]` / `- [x]`)的编号声明位有没有同号多行**。
// 为什么要把这一档单拆出来 —— `scripts/next-plan-id.mjs` 的 `--check` 此前按**小节标题**分组计数,
// 于是把两种东西混判成一件事:
//   ① 登记行的编号声明位同号多行:这才是 §1「一个编号只能有一行当前状态」要说的那一型;
//   ② 历史叙述区里同 id 的小节标题(`## O82续三 …` ×3、`### O62 附⑪ …` 这一族):同一票下的**系列小节**,
//      不是重复登记。
// 现读实测(HEAD 面):① 那一档 O 族只有 2 条登记行声明、同号多行 **0**;② 那一档 7 组。
// ⇒ 旧口径把 ② 读成红,`--check` 恒 exit 1、独立取号入口整体不可用(登记只能改走 live-doc-edit 的带族令牌),
//    而真正该拦的 ① 一条都没拦到 —— 这不是"严",是**打偏**。
//
// 刻意**不做**的事:标题行的口径与号段 max 算术仍归 `next-plan-id.mjs` 自己那一份 HEADING 正则
// (它带 `附①/续三/补` 这些后缀子模式,号段算术吃它,任何改写都会漂发号结果)。本 lib 不复制它,
// 免得"同一把尺两份实现" (§0.6) 反过来长出来。
//
// 单一真相源:什么算一条登记行、编号声明位在哪,一律走 `./plan-task-index.mjs` 的 parseTaskRows/keyOfRow。
// 〔增档@2026-10-22/G-955〕判红维吃的是**声明位**读数 `declaredKeyOf`(同一份 lib,同一份窗口扫描,
// 只多一档收窄:落在"未被吃掉"的行首装饰括注里的号是**被引号**,不是本行声明 —— 现读实证:
// `- [ ] （待派/QODER-O81） **顺带登记一条归属纪律**…` 一行指针曾被读成 O81 同号多行,
// 把独立取号入口顶死;而 `keyOfRow` 那一档的"括注里的号照旧顶位"是 M25③ 钉死的**占用维**语义,
// 一字不动)。占用维与判红维自此各取所需,仍是同一把尺的两个读数。
import { parseTaskRows, declaredKeyOf } from './plan-task-index.mjs'

/**
 * @param {string} ledgerText 台账正文(被审面;取哪一面由调用方负责,本器不读盘不读 git)
 * @param {string} family     编号族前缀(缺省 'O')
 * @returns {{ ok:boolean, reason?:string, rowDups:Array<[string, number]>, rowDecls:number,
 *   rowCounts:Array<[string, number]> }}
 * `rowDups` = 同号 ≥2 条登记行的组(按 id 字典序)。
 * `rowCounts` = **每个**被声明过的号及其行数(含只 1 行的) —— 差值棘轮要拿基线面"该号几行"
 * 做锚点,只给 `rowDups` 会把"基线 1 行"读成"基线 0 行"(两档结论相同但报数会撒谎)。
 * 输入取不到(空文本 / 非字符串)⇒ `ok:false` + reason —— **未判定不得被读成"无重号"**(§0.3)。
 */
export function judgeRowIdDuplicates({ ledgerText, family = 'O' }) {
  if (typeof ledgerText !== 'string' || ledgerText.trim() === '') {
    return {
      ok: false,
      reason: '台账正文取不到(空 / 非字符串)⇒ 重号无从判起',
      rowDups: [],
      rowDecls: 0,
      rowCounts: [],
    }
  }
  // 族名精确匹配:family='O' 时 `G-1` 不该记进 O 族 ⇒ 首字母与形状两条都要认。
  const rowKeyRe = new RegExp(`^${family}-?\\d+$`)
  const counts = new Map()
  let decls = 0
  for (const row of parseTaskRows(ledgerText)) {
    // G-955:声明位读数(括注内被引号不算本行声明);占用维仍是 keyOfRow 那一档,互不搬动。
    const key = declaredKeyOf(row.raw)
    if (typeof key !== 'string' || !key.startsWith(family) || !rowKeyRe.test(key)) continue
    decls += 1
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const rowCounts = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const rowDups = rowCounts.filter(([, n]) => n > 1)
  return { ok: true, rowDups, rowDecls: decls, rowCounts }
}

/**
 * 差值棘轮(2026-10-25 立,承票 G-955 收口):把"登记行声明位同号多行"拆成**存量 / 新增**两档。
 *
 * 为什么不能只判绝对值:同一个判据在两处被读成两种东西 ——
 *  ① 提交链/取号入口需要拦的是"**本次**把重号带进来"(并发批次带着旧底稿并入、手填号撞车);
 *  ② 台账里早就存在的历史重号,与"现在能不能登记新活"无关。
 * 绝对值判红把这两件事并成一格 ⇒ 存量一回来入口就恒红(§12e),而把判据整条删掉换成恒 0 又是削判据(§12f)。
 * 正解是 §0.5 的棘轮口径:**锚点 = 基线面(被审面的父提交)该号自身的行数**,只拦"本次改动把违规加回来"。
 *
 * 三档定义(逐号比,不按键集合差 —— 同一号可以被多行抢,集合差会把"同键再抄两条"整个漏掉):
 *  · fresh  = 被审面 ≥2 行 ∧ 被审面行数 > 基线行数  ⇒ **新增**,调用方判红;
 *  · legacy = 被审面 ≥2 行 ∧ 被审面行数 ≤ 基线行数  ⇒ 存量(含"没再增长"),只报数;
 *  · cleared= 基线 ≥2 行 ∧ 被审面 <2 行            ⇒ 已清偿,只报数(供台账对账读)。
 *
 * 两档输入任一取不到 ⇒ `ok:false` + reason:**分不开存量与新增**就是不判定,
 * 不得把"没基线"读成"全是新增"(会造恒红),更不得读成"全是存量"(那就是放行)。
 *
 * @param {{currentText?:string, baselineText?:string, family?:string}} p
 * @returns {{ ok:boolean, reason?:string,
 *   fresh:Array<[string, number, number]>, legacy:Array<[string, number, number]>,
 *   cleared:Array<[string, number]>, rowDecls:number, baselineRowDecls:number|null }}
 *  `fresh`/`legacy` 每项 = `[编号, 被审面行数, 基线行数]`;`cleared` 每项 = `[编号, 基线行数]`。
 */
export function judgeRowIdDuplicatesDelta({ currentText, baselineText, family = 'O' } = {}) {
  const cur = judgeRowIdDuplicates({ ledgerText: currentText, family })
  if (!cur.ok)
    return {
      ok: false,
      reason: `被审面:${cur.reason}`,
      fresh: [],
      legacy: [],
      cleared: [],
      rowDecls: 0,
      baselineRowDecls: null,
    }
  const base = judgeRowIdDuplicates({ ledgerText: baselineText, family })
  if (!base.ok)
    return {
      ok: false,
      reason: `基线面:${base.reason} ⇒ 分不开存量与新增(取到父提交面再重跑)`,
      fresh: [],
      legacy: [],
      cleared: [],
      rowDecls: cur.rowDecls,
      baselineRowDecls: null,
    }
  const baseCounts = new Map(base.rowCounts)
  const curCounts = new Map(cur.rowCounts)
  const fresh = []
  const legacy = []
  for (const [id, n] of cur.rowDups) {
    const b = baseCounts.get(id) ?? 0
    if (n > b) fresh.push([id, n, b])
    else legacy.push([id, n, b])
  }
  const cleared = base.rowDups.filter(([id]) => (curCounts.get(id) ?? 0) < 2)
  return {
    ok: true,
    fresh: fresh.sort((a, b) => a[0].localeCompare(b[0])),
    legacy: legacy.sort((a, b) => a[0].localeCompare(b[0])),
    cleared: cleared.sort((a, b) => a[0].localeCompare(b[0])),
    rowDecls: cur.rowDecls,
    baselineRowDecls: base.rowDecls,
  }
}

/** §22c:测试直接吃生产判据,不在测试里复制"什么算存量 / 什么算新增"。 */
export const __test__ = { judgeRowIdDuplicates, judgeRowIdDuplicatesDelta }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
