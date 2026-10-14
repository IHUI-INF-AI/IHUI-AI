// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-920 载荷归因出口的镜像测试(§22c:判据只引实现那一份,本文件不得再算一遍)。
 *
 * 钉住的四型必须**互相可分辨**(少一型就可能把"我们那枚被灌了内容"和"我们的东西被他人那枚带走"
 * 读成同一句话),而且建议要与形态绑死 —— 2026-10-14 晚的真实事故里,旧实现把①型报成"未能定位本次
 * 提交"并建议 `git reset HEAD~1`,而当时 HEAD~1 已是他人的提交(照做就退掉别人的活)。
 *
 * 另有一条**接线锁**:判据住在 lib,只有当 `safe-commit.mjs` 真引它、真按形态分支走,才算装上
 * (§0.9"造好没装车"是本仓最高频失效型)。这条用源码文本判,不 import safe-commit —— 它是直线执行
 * 脚本、没有 §22d 守卫,import 一次就等于真跑一遍提交流程。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { classifyConcurrentCommits, adviceFor } from '../lib/commit-payload-attribution.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const files = (map) => (sha) => map[sha] ?? []

test('A1 clean:载荷恰好等于声明集 ⇒ 判 clean 且不改退出码', () => {
  const map = { s1: ['a.ts', 'b.ts'] }
  const r = classifyConcurrentCommits({
    newShas: ['s1'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
  })
  assert.equal(r.kind, 'clean')
  assert.equal(adviceFor(r.kind).exit, 0)
  assert.deepEqual(adviceFor(r.kind).lines, [])
})

test('A2 ①型:标题是本次的那枚、载荷却含他人 staged 路径 ⇒ polluted-ours,建议里禁止 reset HEAD~1', () => {
  const map = { s1: ['a.ts', 'b.ts', 'their-wip.ts'], s2: ['unrelated.ts'] }
  const subj = { s1: 'chore(ours): 本票', s2: 'fix(theirs): 别家' }
  const r = classifyConcurrentCommits({
    newShas: ['s2', 's1'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
    subjectOf: (sha) => subj[sha] ?? '',
    ourSubject: 'chore(ours): 本票',
  })
  assert.equal(r.kind, 'polluted-ours')
  assert.equal(r.sha, 's1', '必须点名我们那一枚,而不是"未能定位"')
  assert.deepEqual(r.extraFiles, ['their-wip.ts'])
  const adv = adviceFor(r.kind)
  assert.equal(adv.exit, 1)
  assert.match(adv.lines.join('\n'), /不要.*git reset HEAD~1/, '这一型的建议必须明确禁止照旧 reset')
})

test('A2b 保守臂:拿不到标题时,"含声明集+外来件"仍判 polluted-ours(宁可多喊一次,不静默)', () => {
  const map = { s1: ['a.ts', 'b.ts', 'their-wip.ts'] }
  const r = classifyConcurrentCommits({
    newShas: ['s1'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
  })
  assert.equal(r.kind, 'polluted-ours')
  assert.deepEqual(r.extraFiles, ['their-wip.ts'])
})

test('A3 ②型:含我们路径的那枚**不是**本次标题 ⇒ carried-by-other 并点名 carrier 与它带走的路径', () => {
  const map = { s1: ['x.ts'], s2: ['a.ts', 'b.ts', 'theirs.ts'] }
  const subj = { s1: 'docs: 无关', s2: 'fix(autostart): …' }
  const r = classifyConcurrentCommits({
    newShas: ['s1', 's2'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
    subjectOf: (sha) => subj[sha] ?? '',
    ourSubject: 'chore(plan): 本会话的收尾件',
  })
  assert.equal(r.kind, 'carried-by-other')
  assert.equal(r.carriers.length, 1)
  assert.equal(r.carriers[0].sha, 's2')
  assert.deepEqual(r.carriers[0].carried, ['a.ts', 'b.ts'])
  assert.match(r.carriers[0].subject, /fix\(autostart\)/)
  assert.equal(adviceFor(r.kind).exit, 1, '"落地在他人标题下"不是成功,必须喊')
})

test('A4 unlocated 与 A5 空区间:两者都不冒充①/②', () => {
  const r = classifyConcurrentCommits({
    newShas: ['s1'],
    filesOf: files({ s1: ['other.ts'] }),
    expected: ['a.ts'],
  })
  assert.equal(r.kind, 'unlocated')
  const empty = classifyConcurrentCommits({ newShas: [], filesOf: files({}), expected: ['a.ts'] })
  assert.equal(empty.kind, 'unlocated')
  assert.match(empty.reason, /零枚新提交/)
})

test('A6 反证:把 lib 从 safe-commit 里摘掉 ⇒ 接线锁必须红(判据不能只是躺在 lib 里没人调)', () => {
  const src = readFileSync(join(here, '..', 'safe-commit.mjs'), 'utf8')
  assert.match(src, /from '\.\/lib\/commit-payload-attribution\.mjs'/, 'safe-commit 必须引这份唯一出口')
  assert.match(src, /classifyConcurrentCommits\(/, '必须真调分类器')
  assert.match(src, /adviceFor\(/, '处置建议必须与形态同处产出,不得另抄一份措辞')
  // 形态分支齐备(缺一型就会把两种相反的错位读成同一句话)
  for (const k of ['polluted-ours', 'carried-by-other', 'unlocated'])
    assert.ok(src.includes(`'${k}'`), `缺形态分支 ${k}`)
  // 旧的那句危险建议不得再以"唯一出路"出现
  assert.doesNotMatch(src, /建议立即: git reset HEAD~1/, '污染型的旧建议语必须已被形态化建议取代')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
