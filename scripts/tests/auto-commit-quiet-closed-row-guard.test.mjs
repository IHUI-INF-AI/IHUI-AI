// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收编器「已结清行不回退闸」镜像测试(§22c:判据 import 生产出口,零复制)。
 *
 * 立因(已取证):2026-10-25 16:25 的 `chore(auto)` 把一份滞后工作树副本收编进历史,让 16:0x
 * 已入库的 H04/O02/G-03 四条 `- [x] ✅(2026-10-25/主会话结算)` 回退成 `- [ ]`。原有四道护栏
 * (滞后副本/归并/声明式摘除/归档单调性)对"已勾行原地翻回未勾"这一型零覆盖。
 *
 * 本测试锁三件事:①判据正反例(拦回退、放行正常结清);②取不到输入一律 fail-closed(未判定);
 * ③闸真的接在归并之后、safe-commit 之前(造好没装车 = 没有,§1 第 9 条)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closedRowRegressions } from '../lib/ledger-closed-rows.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const NOTE = '✅(2026-10-25/主会话结算)'
const DONE_1 = `- [x] ${NOTE} G-1 P1 测试票:要做一件事`
const OPEN_1 = '- [ ] G-1 P1 测试票:要做一件事'
const OPEN_2 = '- [ ] G-2 另一件事:读 §3 并复测'

const doc = (...lines) => lines.join('\n')

test('(a) HEAD 已勾选 → 候选未勾(同主键)= 拦,并点名该键', () => {
  const g = closedRowRegressions(doc(DONE_1, OPEN_2), doc(OPEN_1, OPEN_2))
  assert.equal(g.undetermined, false)
  assert.equal(g.ok, false)
  assert.equal(g.regressions.length, 1)
  assert.equal(g.regressions[0].key, 'G-1#P1测试票')
  assert.equal(g.regressions[0].line, 1)
})

test('(b) HEAD 已勾选行整行消失(候选里同主键一个残留都没有)= 拦', () => {
  const g = closedRowRegressions(doc(DONE_1, OPEN_2), doc(OPEN_2))
  assert.equal(g.ok, false)
  assert.deepEqual(
    g.regressions.map((r) => r.key),
    ['G-1#P1测试票'],
  )
})

test('(c) 候选新增一条已勾选(正常结清)= 放行', () => {
  const head = doc(DONE_1, OPEN_2)
  const cand = doc(DONE_1, `- [x] ${NOTE} G-2 另一件事:读 §3 并复测`)
  const g = closedRowRegressions(head, cand)
  assert.equal(g.ok, true)
  assert.equal(g.undetermined, false)
  assert.equal(g.headClosed, 1)
  assert.equal(g.candidateClosed, 2)
})

test('(d) 候选新增未勾行 = 放行(未勾行不在本闸射程)', () => {
  const g = closedRowRegressions(doc(DONE_1), doc(DONE_1, '- [ ] G-3 新登记:待派单'))
  assert.equal(g.ok, true)
  assert.equal(g.candidateClosed, 1)
})

test('(e) 未勾 → 未勾(追加注记)= 放行(两面对这一主键都没结清)', () => {
  const g = closedRowRegressions(
    doc(OPEN_2),
    doc('- [ ] G-2 另一件事:读 §3 并复测〔进度:已读到 §3.2,未复测〕'),
  )
  assert.equal(g.ok, true)
  assert.equal(g.headClosed, 0)
})

test('(f) HEAD 已勾选在候选仍是已勾选但追加注记 = 放行(键不因注记漂移)', () => {
  const g = closedRowRegressions(doc(DONE_1), doc(`${DONE_1}〔补记:已复核,读数见 L120〕`))
  assert.equal(g.ok, true)
  assert.equal(g.regressions.length, 0)
})

test('(g) fail-closed:HEAD/候选任一取不到或为空 ⇒ 未判定(不得读成"没有已勾行")', () => {
  for (const [head, cand] of [
    [null, doc(DONE_1)],
    [doc(DONE_1), null],
    ['', doc(DONE_1)],
    [doc(DONE_1), '   \n'],
  ]) {
    const g = closedRowRegressions(head, cand)
    assert.equal(g.undetermined, true, `HEAD=${JSON.stringify(head)} 候选=${JSON.stringify(cand)}`)
    assert.equal(g.ok, false)
  }
})

test('(h) 装车锁:闸必须接在 mergeLiveDoc 之后、safe-commit 之前,且跳过时逐键点名', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
  assert.match(src, /from '\.\/lib\/ledger-closed-rows\.mjs'/, '判据必须 import 单一真相源')
  const atMerge = src.indexOf('const r = mergeLiveDoc(f)')
  const atGate = src.indexOf('closedRowRegressions(head, candidate)')
  const atCommit = src.indexOf("'safe-commit.mjs'")
  assert.ok(atMerge > 0 && atGate > atMerge, '闸必须在归并之后(归并能补回的行不得被本闸误判)')
  assert.ok(atCommit > atGate, '闸必须在 safe-commit 之前(红即退出候选,不得入库)')
  assert.match(src, /活文档已结清行回退/, '跳过必须留痕点名')
  assert.match(src, /rollbackLedger\(f, snap, `候选把/, '判定红必须回滚工作树副本')
})

test('(i) 整份文件 == 上一枚 HEAD 的旧 blob(整份旧副本覆盖)= 拦', () => {
  // 2026-10-25 17:0x 实测第二型回退源:工作树的 PROJECT_PLAN.md 被整份写回某个祖先版本 ——
  // H04 已勾选翻回未勾、17:0x 新增的 perf/SDK 进展注记整段消失。dropStaleCopies 的逐字节
  // 相等判据能拦这一型,但它只审未暂存文件、只回溯最近 6 枚动过该路径的提交;本闸按盘上
  // 文本 vs HEAD blob 判勾选态,故旧副本只要带回一条已结清行的回退就必拦(两闸互补,见
  // scripts/lib/ledger-closed-rows.mjs 头注)。
  const head = doc(
    `- [x] ${NOTE} H04 另三道禁令门仍取磁盘面`,
    OPEN_2,
    '- [ ] perf/SDK 进展:基线读数已入库',
  )
  const oldBlob = doc('- [ ] H04 另三道禁令门仍取磁盘面', OPEN_2)
  const g = closedRowRegressions(head, oldBlob)
  assert.equal(g.undetermined, false)
  assert.equal(g.ok, false)
  assert.equal(g.regressions.length, 1)
  assert.ok(g.regressions[0].key.startsWith('H04#'), `应点名 H04 主键,实得 ${g.regressions[0].key}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
