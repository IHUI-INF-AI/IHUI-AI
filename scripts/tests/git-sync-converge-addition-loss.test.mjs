// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-939 的镜像测试(2026-10-21 立):旁路合并推进前的"某侧独有新增不得被吞"复量。
// 判据一律 import 自 `../git-sync-converge.mjs` 的 `__test__` 出口(§22c),本文件不重写任何判定;
// 复量本身又 import 守门 100 的 A1 实现 —— 于是"两处分叉"被同时钉住:
//   T5 钉 converge 不复算第二份集合运算,T3/T4 用真 git 夹具证明判据有牙(掏空即绿不了)。
// 立因现读:枚 12898ccd9bcb2b8e094e0057d94e0fab0380293a(11 枚文件的功能提交)在 git-sync-converge
// 造出的合并之后对 HEAD 与 origin 双非祖先 —— 守门 100 自写口径只覆盖"提交链上、未进 origin 的合并",
// 而这条路不跑钩子。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as CV } from '../git-sync-converge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = readFileSync(fileURLToPath(new URL('../git-sync-converge.mjs', import.meta.url)), 'utf8')

function gitAt(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 24,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/**
 * 造一个真 git 夹具(工作区外,mkScratch 退出即回收 —— 严禁在仓库树内 init,守门 208):
 *   base ┬ main: 加 mine.txt ⇒ P1
 *        └ side: 加 theirs.txt ⇒ P2
 * @returns {{dir:string, p1:string, p2:string, base:string}}
 */
function fixture() {
  const dir = mkScratch('g939-')
  const cfg = ['-c', 'user.email=t@example.com', '-c', 'user.name=T']
  gitAt(dir, ['init', '-q', '.'])
  gitAt(dir, [...cfg, 'commit', '-q', '--allow-empty', '-m', 'base'])
  const base = gitAt(dir, ['rev-parse', 'HEAD'])
  const mainBranch = gitAt(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
  gitAt(dir, ['checkout', '-q', '-b', 'side'])
  gitAt(dir, [...cfg, 'commit', '-q', '--allow-empty', '-m', 'theirs'])
  gitAt(dir, ['checkout', '-q', mainBranch])
  gitAt(dir, [...cfg, 'commit', '-q', '--allow-empty', '-m', 'mine'])
  const p1 = gitAt(dir, ['rev-parse', 'HEAD'])
  // 两侧各加一个新文件(独有新增 = A1 要保住的东西)
  writeFileSync(path.join(dir, 'theirs.txt'), 'side 独有的新增\n')
  gitAt(dir, [...cfg, 'add', '-f', 'theirs.txt'])
  gitAt(dir, [...cfg, 'commit', '-q', '-m', 'theirs-file'])
  const p2f = gitAt(dir, ['rev-parse', 'HEAD'])
  gitAt(dir, ['checkout', '-q', p1])
  writeFileSync(path.join(dir, 'mine.txt'), '本地独有的新增\n')
  gitAt(dir, [...cfg, 'add', '-f', 'mine.txt'])
  gitAt(dir, [...cfg, 'commit', '-q', '-m', 'mine-file'])
  const p1f = gitAt(dir, ['rev-parse', 'HEAD'])
  return { dir, base, p1: p1f, p2: p2f }
}

/** 用 tree 直接造一枚双父合并提交(tree 决定"结果里有没有那些新增")。 */
function makeMerge(dir, tree, p1, p2) {
  return gitAt(dir, [
    '-c',
    'user.email=t@example.com',
    '-c',
    'user.name=T',
    'commit-tree',
    tree,
    '-p',
    p1,
    '-p',
    p2,
    '-m',
    'fixture merge',
  ])
}

test('T1 复量与裁定都在 __test__ 出口上(缺出口 = 装车没装完)', () => {
  assert.equal(typeof CV.preAdvanceAdditionLoss, 'function')
  assert.equal(typeof CV.additionLossVerdict, 'function')
})

test('T2 派发点恰一处实调用且不在注释里(挂点在 main 的推进路径上)', () => {
  const calls = SRC.split('\n').filter((l) => l.trim().startsWith('const loss = preAdvanceAdditionLoss('))
  assert.equal(calls.length, 1, `派发点必须恰一处,实得 ${calls.length}(只在注释里写 = 造好没装车)`)
  const verdict = SRC.split('\n').filter((l) => l.trim().startsWith('const lossVerdict = additionLossVerdict('))
  assert.equal(verdict.length, 1, `裁定调用必须恰一处,实得 ${verdict.length}`)
  assert.match(SRC, /if \(lossVerdict\.block\) \{[\s\S]{0,2400}process\.exit\(1\)/, '拦下必须真的退出')
  // 顺序锁:复量必须排在 update-ref **之前**(推进之后再判,吞并已经发生,判了也退不回来)
  const iBlock = SRC.indexOf('if (lossVerdict.block) {')
  const iExit = SRC.indexOf('process.exit(1)', iBlock)
  const iCas = SRC.indexOf("['update-ref'", iBlock)
  assert.ok(iBlock > 0 && iExit > 0 && iCas > 0, '派发/拦下/推进三段都要在源码里可寻')
  assert.ok(iExit < iCas, `复量必须排在 update-ref 之前(exit@${iExit} vs cas@${iCas})`)
  assert.match(SRC, /backupOrphanMerge\(mergeSha, 'addition-loss'\)/, '拒绝推进前必须先把悬空合并备份成 tag(否则把 30a 转嫁给下一位)')
})

test('T3 阳性对照:结果树缺一侧独有新增 ⇒ 复量必须判吞并(掏空判据这一格立刻翻绿)', () => {
  const f = fixture()
  try {
    const onlyMineTree = gitAt(f.dir, ['rev-parse', `${f.p1}^{tree}`])
    const bad = makeMerge(f.dir, onlyMineTree, f.p1, f.p2)
    const loss = CV.preAdvanceAdditionLoss({ mergeSha: bad, cwd: f.dir })
    assert.equal(loss.ok, false, '吞掉 theirs.txt 的合并必须判不过')
    assert.ok(
      loss.lost.some((l) => l.path === 'theirs.txt'),
      `被吞路径必须点名,实得 ${JSON.stringify(loss.lost.map((l) => l.path))}`,
    )
    assert.equal(loss.repaired.length, 0, 'atRef 取合并树自身 ⇒ 不得把吞并写成"后手已补回"')
  } finally {
    rmScratch(f.dir)
  }
})

test('T4 反向对照:正常 merge-tree 的结果判过(不给无关提交造恒红)', () => {
  const f = fixture()
  try {
    const goodTree = gitAt(f.dir, ['merge-tree', '--write-tree', f.p1, f.p2]).split('\n')[0]
    const good = makeMerge(f.dir, goodTree, f.p1, f.p2)
    const loss = CV.preAdvanceAdditionLoss({ mergeSha: good, cwd: f.dir })
    assert.equal(loss.ok, true, `正常合并被误拦 = 恒红门(§12e),lost=${JSON.stringify(loss.lost)}`)
  } finally {
    rmScratch(f.dir)
  }
})

test('T5 判据零复算:A1 只住守门 100,converge 只 import 不另写一份', () => {
  assert.match(SRC, /import \{ auditOne as auditMergeAdditionLoss \} from '\.\/check-merge-addition-loss\.mjs'/)
  const body = SRC.slice(
    SRC.indexOf('export function preAdvanceAdditionLoss'),
    SRC.indexOf('export function preAdvanceAdditionLoss') + 1200,
  )
  assert.ok(
    !/treePaths\(|basesOf\(|parentsOf\(/.test(body),
    '复量函数不得自己调集合运算(那才是第二份真相)',
  )
})

test('T6 应急出口三态:无吞并⇒过 / 裸跳旗⇒仍拦 / 跳旗+原因⇒放行且留痕', () => {
  const lost = [{ path: 'theirs.txt', addedBy: 'x' }]
  assert.deepEqual(CV.additionLossVerdict({ lost: [], skip: false, reason: '' }), {
    proceed: true,
    block: false,
    skipUsed: false,
    bareSkip: false,
    lost: 0,
  })
  const bare = CV.additionLossVerdict({ lost, skip: true, reason: '' })
  assert.equal(bare.block, true, '裸跳门不放行(失效方向只能是多要一次说明)')
  assert.equal(bare.bareSkip, true)
  const okSkip = CV.additionLossVerdict({ lost, skip: true, reason: '确属误判:A1 不适用本型,证据见交付报告' })
  assert.equal(okSkip.proceed, true)
  assert.equal(okSkip.skipUsed, true, '放行必须留痕,不得静默')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
