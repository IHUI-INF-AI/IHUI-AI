// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F1 `findForks` 的 G-1058623 修正:「两态并存」的 open 侧必须先剔掉归并副本行。
 *
 * 修的是什么(现读实测,非推理):F1 此前只做 `compositeKeyOf` 分组,进了 `open` 桶的行使
 * **无条件**参与混态判定 ⇒ 同一个 `【归并】重复登记副本` 注记在 F4 里是"已归并、别再派单",
 * 在 F1 里等于不存在。真语料现读 2 组里,未勾选行 13 条带该注记、只有 1 条不带。
 *
 * ⚠ 为什么这条不是纯洁癖 —— 它**会写坏台账**:`plan-tasks-merge.mjs:544` 是 F1 的自愈写
 * 路径,`:605` 随后对每一条 F1 命中的 open 行**真把复选框翻成 `[x]`**。于是改前
 * `--heal --commit` 会把 `O19b#剩余4列故意不并` 的**持有行 L10710 翻成已完成**,
 * 而它的未勾选是真状态(同主键 done 行自述"列+GIN 下线立迁移票 G-1058625")。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findForks, DUP_POINTER_RE } from '../lib/plan-task-index.mjs'

/** 归并器写的副本注记(逐字取自 `DUP_POINTER_RE` 认的那一句)。 */
const DUP = '〔【归并】重复登记副本(2026-09-27):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
/** 一行够长的登记正文,保证主键前缀(24 字)稳定。 */
const TITLE = '**G-900001 某条待办的标题占位,长度足够让主键前缀稳定下来**'
const holder = (tail = '') => `- [ ] ${TITLE} —— 持有行,它是归并的目标行。${tail}`
const dupRow = (tail = '') => `- [ ] ${TITLE} —— 副本行。${DUP} ${tail}`
const doneRow = () => `- [x] ${TITLE} —— 同主键的已完成行。`

test('T1 副本行不再单独构成 F1 的 open 侧(改前它会让 13 条副本行全部进组)', () => {
  // 夹具:持有行 1 + 副本行 1 + 同主键 done 1。改前 F1 报这组且 open.length = 2。
  const r = findForks([holder(), dupRow(), doneRow()].join('\n'))
  // 剔副本后判定用的存活 open 只剩 1 条持有行 ⇒ 仍混态 ⇒ 报 1 组
  assert.equal(r.forks.length, 1, '剔副本后剩持有行仍混态,应报 1 组')
  // 而"报出来的那一组"里,副本行不再被算作 F1 的分叉行
  const liveOpen = r.forks[0].open.filter((x) => !DUP_POINTER_RE.test(x.raw))
  assert.equal(liveOpen.length, 1, '存活 open 侧必须只剩持有行 —— 副本行被剔掉了')
})

test('T1b 正向:持有行仍在 ⇒ F1 必须仍报出该组(不得"剔副本"剔成零组)', () => {
  // 这一条与 T1 咬合:只测"不该报的没报"的判据,在整体失灵(恒不报)时会**假绿**。
  const forks = findForks([holder(), dupRow(), doneRow()].join('\n')).forks
  assert.equal(forks.length, 1, '持有行的未勾选是真状态,必须仍被报出来')
  assert.equal(forks[0].open.length, 2, 'forks 组内仍带全部 open 行(只做判定,不删数据)')
})

test('T2 open 侧全带注记 ⇒ 剔完不剩 open ⇒ 退出 F1', () => {
  const forks = findForks([dupRow(), dupRow(' 之二'), doneRow()].join('\n')).forks
  assert.equal(forks.length, 0, 'open 全是副本 ⇒ 没有真持有行 ⇒ 不该报')
})

test('T3 反向防线:某主键唯一的 open 行带注记,且同主键无 done ⇒ 本就不该进 F1', () => {
  // 不得因"带注记"三个字把真问题静默放过:这里靠的是"没有 done"而不是"有注记"。
  const r = findForks([dupRow(), holder()].join('\n'))
  assert.equal(r.forks.length, 0, '没有 done 行 ⇒ 两态不并存 ⇒ 与注记无关')
})

test('T4 反向防线:唯一 open 行带注记 + 同主键有 done ⇒ 剔完不剩 open ⇒ 不报', () => {
  // 这条是"注记不得当万能豁免"的对证:若将来有人把判据写成"带注记一律不报",
  // 本用例仍绿,但 T5 会翻红。
  const forks = findForks([dupRow(), doneRow()].join('\n')).forks
  assert.equal(forks.length, 0)
})

test('T5 纯两态(无任何注记)必须仍被报出 —— 钉住"仍看得见"这一半', () => {
  // 任何把判据改成恒不报出的改法(例如 liveOpenOf 恒返[])都会让本条翻红。
  const forks = findForks([holder(), doneRow()].join('\n')).forks
  assert.equal(forks.length, 1, '无注记的纯两态必须照报')
  assert.equal(forks[0].open.length, 1)
})

test('T6 地雷防线:剔副本不得连带腰斩 dupOpen(F4 的报数档)', () => {
  // `forks`/`dupOpen`/`dupDone` 由**同一个 all** 派生。若有人把剔副本写进**分组阶段**
  // (`continue` 掉带注记行),dupOpen 会被连带腰斩 ⇒ 悄悄把 F4 报数档关了。
  const r = findForks([holder(), dupRow(), doneRow()].join('\n'))
  assert.equal(r.dupOpen.length, 1, 'dupOpen 组数必须只看"open≥2",不因注记而变')
  assert.ok(r.groups.length >= 1, 'groups 必须原样保留')
  assert.equal(
    r.groups.flatMap((g) => g.open).filter((x) => DUP_POINTER_RE.test(x.raw)).length,
    1,
    '副本行仍留在 groups/dupOpen 的原始数据里(本判据只改 forks 判定,不改数据)',
  )
})

test('T7 判不出 ≠ 零组:非字符串输入不得读成"干净"', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    const groups = new Map()
    // findForks 内部靠 parseTaskRows 遍历;对非字符串不能抛未捕获异常
    let out = null
    try {
      out = findForks(bad)
    } catch {
      continue // 抛错也是一种"不把它读成零组"的诚实表现
    }
    assert.ok(Array.isArray(out.forks), `输入 ${String(bad)} 必须给出数组形态的 forks`)
    assert.equal(groups.size, 0)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
