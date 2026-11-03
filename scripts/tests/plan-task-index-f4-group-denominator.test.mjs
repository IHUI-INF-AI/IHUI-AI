// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F4 组数口径(`counts.dupOpenGroups`)的镜像锁 —— 最小豁免 + 反向例。
 *
 * 病(2026-11-03 现读):官方归并器给副本行落 `DUP_POINTER_RE` 指针注记后,
 * `findDupOpenCopies` 第一道过滤就把该行剔掉 ⇒ `dupOpenCopies = 0`;而 `findForks` 的
 * `dupOpen` 分组阶段**刻意**不过滤注记行(否则报数面从 213 腰斩到 1,见其头注),同一组仍被
 * `dupOpenGroups` 计 1 组 ⇒ 账面留下「副本 0、组数 1」的结构性残差。
 *
 * 判据(`countDupOpenGroups`):组内存在至少一条非指针同主键登记时,指针行从组数分母剔除;
 * 无注记组、全指针组(注记孤立)一律**逐字沿用原判据**。
 *
 * 三条不许漂的写法:
 *   ① **只收窄组数一处**:`findForks().dupOpen` 必须仍含该组(分组面不动,归并器/清偿器读数不变);
 *   ② **报数档不得被关掉**:无注记真实重复、指针孤立两类必须仍计组(反向例,不是注释承诺);
 *   ③ **合取不越界**:2 活行 + 1 指针行仍计 1 组 + 1 副本(豁免只剔指针行,不吞整组)。
 *
 * 夹具形态要点:`compositeKeyOf` 的题面只取 24 字,故同一主键的几行必须在**第 24 字之前**
 * 逐字相同(下面共用 `TITLE_PAD`),差异只许出现在截断线之后 —— 否则夹具自己就不成组,
 * 断言会在"空面"上绿得毫无意义(变异验证第一版踩过)。
 *
 * 变异自证:把分母无条件改成 `live` ⇒ 反向例「指针孤立」读 0 必红;把豁免改成整组剔除 ⇒
 * 「2 活 + 1 指针」读 0 必红;在 `findForks` 分组阶段过滤 ⇒ 结构断言「dupOpen 仍含该组」必红。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { auditPlan, findForks, DUP_POINTER_RE } from '../lib/plan-task-index.mjs'

/** 同一主键的公共题面前缀:长过 24 字截断线,保证差异只落在截断线之后。 */
const TITLE_PAD = '**D93 重复待办:同一件事的标题前缀足够长以越过截断线** '
/** 官方归并模板的指针注记(与 `DUP_POINTER_RE` 同一字面)。 */
const NOTE =
  ' 〔【归并】重复登记副本(2026-11-03):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'

const LIVE_1 = `- [ ] ${TITLE_PAD}第一条登记(裸行,不带注记)。`
const LIVE_2 = `- [ ] ${TITLE_PAD}第二条登记,正文更长一些,没有注记。`
const PTR_1 = `- [ ] ${TITLE_PAD}第三条登记,正文更长一些,行尾挂归并器指针。${NOTE}`
const PTR_2 = `- [ ] ${TITLE_PAD}第四条登记,正文更长,同样挂归并器指针。${NOTE}`
/** 另一个主键的真实重复对(用于混合面)。 */
const LIVE_3 = '- [ ] **D94 另一件独立事务:标题也足够长以越过二十四字截断线** 甲'
const LIVE_4 = '- [ ] **D94 另一件独立事务:标题也足够长以越过二十四字截断线** 乙'

const audit = (...lines) => auditPlan(lines.join('\n'))

test('夹具自检:四行同主键,两行带指针注记', () => {
  const f = findForks([LIVE_1, LIVE_2, PTR_1, PTR_2].join('\n'))
  assert.equal(f.dupOpen.length, 1, '夹具必须恰好成一族')
  assert.equal(f.dupOpen[0].open.length, 4)
  assert.match(PTR_1, DUP_POINTER_RE)
  assert.match(PTR_2, DUP_POINTER_RE)
  assert.doesNotMatch(LIVE_1, DUP_POINTER_RE)
  assert.doesNotMatch(LIVE_2, DUP_POINTER_RE)
})

test('指针行 + 活行同组:组数归 0,分组面仍保留该组', () => {
  const a = audit(LIVE_1, PTR_1)
  assert.equal(a.counts.dupOpenGroups, 0, '副本已归零的组不该继续留在组数里')
  assert.equal(a.counts.dupOpenCopies, 0, '只剩一条活行 ⇒ 0 份副本')
  // ① 只收窄组数一处:分组产物仍含该组,归并器/清偿器读到的 dupOpen 一字未变
  const f = findForks([LIVE_1, PTR_1].join('\n'))
  assert.equal(f.dupOpen.length, 1, 'findForks 的 dupOpen 不得被豁免逻辑过滤')
  assert.equal(f.dupOpen[0].open.length, 2, '组内两行必须原样保留')
})

test('反向例 A:无注记的真实重复仍计 1 组 1 副本', () => {
  const a = audit(LIVE_1, LIVE_2)
  assert.equal(a.counts.dupOpenGroups, 1, '真实重复不得被豁免吞掉')
  assert.equal(a.counts.dupOpenCopies, 1)
  assert.equal(a.dupOpen.length, 1)
})

test('反向例 B:组内全是指针行(注记孤立)仍按原判据计组', () => {
  const a = audit(PTR_1, PTR_2)
  assert.equal(a.counts.dupOpenGroups, 1, '没有非指针同主键登记 ⇒ 豁免不成立,组数照旧')
  assert.equal(a.counts.dupOpenCopies, 0, '副本判据与组数判据分列')
})

test('反向例 C:2 活行 + 1 指针行仍计 1 组 1 副本(豁免只剔指针行)', () => {
  const a = audit(LIVE_1, LIVE_2, PTR_1)
  assert.equal(a.counts.dupOpenGroups, 1)
  assert.equal(a.counts.dupOpenCopies, 1)
})

test('混合面:真实重复组照旧计,已归并组退出组数', () => {
  const a = audit(LIVE_1, PTR_1, LIVE_3, LIVE_4)
  assert.equal(a.counts.dupOpenGroups, 1)
  assert.equal(a.counts.dupOpenCopies, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
