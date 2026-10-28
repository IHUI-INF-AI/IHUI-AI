// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:`scripts/record-closure-drops.mjs` 结清留痕兜底腿(2026-10-28 立)。
// 判据一律从源脚本的 `__test__` 取(§22c:禁止在测试里复制第二份判据)。钉死票面六条 + 接线一条:
//  ① 删未勾登记行 ⇒ 逐字补入账(阳性对照 = 当年真实欠账那一枚必须量出候选);
//  ② 同枚重跑 ⇒ 零写入(幂等,不得把同一凭据追加成两份);
//  ③ 已勾行删除**不在射程**(那是 strip-stale-closed-rows 的活,双写必打架);
//  ④ 非登记行删除 ⇒ 零候选;
//  ⑤ 被审面取不到 ⇒ 大声未判定 + 零入账(§0.3,不得折叠成"没人删过");
//  ⑥ 多重集差:父版两份本版一份 ⇒ 只补一份(少记=门 71 照旧回捞那几份);
//  ⑦ 接线锁:post-commit 必须真调用本器,且**排在门 71 --heal 之前**(顺序即这条腿的全部意义)。
// git 写操作只发生在 scratch 临时仓内(§15c:工作树内禁止嵌套 git);真仓台账只读计数。

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as src } from '../record-closure-drops.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { DROP_LEDGER_REL } from '../lib/plan-drop-record.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { droppedOpenRowsOf, catchUpForCommit } = src

const OPEN_A = '- [ ] G-901 兜底腿夹具甲'
const OPEN_B = '- [ ] G-902 兜底腿夹具乙'
const CLOSED = '- [x] G-903 已勾行'
const PROSE = '段落:这里出现 - [ ] 但不顶格,不是登记行'

function runGit(cwd, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** 造一枚"删掉了未勾登记行、且当时没有任何留痕"的提交 —— 即 O67 事故的最小复现。 */
function makeRepo(t, planTextAfter) {
  const dir = mkScratch('closedrop-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  runGit(dir, ['config', 'user.email', 'fixture@example.invalid'])
  runGit(dir, ['config', 'user.name', 'fixture'])
  const before = [OPEN_A, OPEN_B, CLOSED, PROSE, ''].join('\n')
  const file = join(dir, 'PROJECT_PLAN.md')
  writeFileSync(file, before, 'utf8')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  writeFileSync(file, planTextAfter, 'utf8')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'chore(plan): 手工删行,零留痕通道'])
  return dir
}

function ledgerOf(dir) {
  const p = join(dir, DROP_LEDGER_REL)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

test('① 删未勾登记行 ⇒ 逐字补入账,且记的是父版原文', (t) => {
  const dir = makeRepo(t, [OPEN_B, CLOSED, PROSE, ''].join('\n'))
  const r = catchUpForCommit({ sha: 'HEAD', root: dir })
  assert.equal(r.rc, 0, r.why)
  assert.equal(r.verdict, 'recorded', r.why)
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0], OPEN_A, '入账必须是父版逐字原文,门 71 的 declaredExempt 只认逐字')
  const text = ledgerOf(dir)
  assert.ok(text.includes(OPEN_A), '台账里必须能逐字搜到该行原文')
  assert.equal(r.res.written, 1)
})

test('② 同枚重跑 ⇒ 零写入(幂等,同一凭据不得追加两份)', (t) => {
  const dir = makeRepo(t, [OPEN_B, CLOSED, PROSE, ''].join('\n'))
  const first = catchUpForCommit({ sha: 'HEAD', root: dir })
  assert.equal(first.verdict, 'recorded')
  const second = catchUpForCommit({ sha: 'HEAD', root: dir })
  assert.equal(second.rc, 0, second.why)
  assert.equal(second.verdict, 'already-declared', second.why)
  assert.equal(second.res.written, 0, '重跑必须零写入')
  assert.equal(second.res.skipped.length, 1)
})

test('③ 已勾行删除不在射程(归清扫器,双写必打架)', (t) => {
  const dir = makeRepo(t, [OPEN_A, OPEN_B, PROSE, ''].join('\n'))
  const r = catchUpForCommit({ sha: 'HEAD', root: dir })
  assert.equal(r.rc, 0, r.why)
  assert.equal(r.verdict, 'none', '只删已勾行 ⇒ 本器一条不碰')
  assert.equal(r.rows.length, 0)
  assert.equal(ledgerOf(dir), '', '零候选不得建账、不得写字节')
})

test('④ 非登记行删除 ⇒ 零候选', (t) => {
  const dir = makeRepo(t, [OPEN_A, OPEN_B, CLOSED, ''].join('\n'))
  const r = catchUpForCommit({ sha: 'HEAD', root: dir })
  assert.equal(r.verdict, 'none')
  assert.equal(ledgerOf(dir), '')
})

test('⑤ 被审面取不到 ⇒ 未判定 + 零入账(不折叠成"没人删过")', (t) => {
  const dir = makeRepo(t, [OPEN_B, CLOSED, PROSE, ''].join('\n'))
  const r = catchUpForCommit({ sha: 'HEAD', doc: 'NO_SUCH_DOC.md', root: dir })
  assert.equal(r.rc, 2, '取不到面必须显式未判定')
  assert.equal(r.verdict, 'undetermined')
  assert.equal(ledgerOf(dir), '', '未判定一律零入账')
})

test('⑥ 多重集差:父版两份本版一份 ⇒ 连那份消失的也要记(少记=门 71 照旧回捞)', () => {
  const twin = '- [ ] G-904 逐字相同的孪生'
  const r = droppedOpenRowsOf({ parentText: [twin, twin, OPEN_A].join('\n'), headText: twin })
  assert.deepEqual(r, [twin, OPEN_A], '按父版顺序:孪生少了一份 + 夹具甲整行消失 ⇒ 两条都要入账')
})

test('⑦ 接线锁:post-commit 真调用本器,且排在门 71 --heal 之前', () => {
  const hook = readFileSync(join(ROOT, 'scripts', 'lib', 'post-commit-hook.js'), 'utf8')
  const here = hook.indexOf('record-closure-drops.mjs')
  const heal = hook.indexOf('check-plan-line-loss.mjs --heal')
  assert.ok(here > 0, '本器必须被 post-commit 真调用(造好没装车 = 没有,§0.9)')
  assert.ok(heal > 0, '门 71 回捞腿仍在位')
  assert.ok(here < heal, '留痕兜底必须排在回捞之前,否则本轮删的行仍会被捞回')
})

test('⑧ 真仓台账只被本器写过一次,且未判定不写', () => {
  const real = join(ROOT, DROP_LEDGER_REL)
  const before = readFileSync(real, 'utf8')
  assert.match(before, /O67 \[deploy-feedback\]/, 'O67 两形态留痕应在真账里(事故凭据)')
  const bad = catchUpForCommit({ sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', root: ROOT })
  assert.equal(bad.rc, 2, '不存在的提交 ⇒ 未判定')
  assert.equal(readFileSync(real, 'utf8'), before, '未判定不得动真账')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
