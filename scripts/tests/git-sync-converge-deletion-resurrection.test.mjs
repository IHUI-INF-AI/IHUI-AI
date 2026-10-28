// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-939 的镜像测试(2026-10-21 立,续 addition-loss):旁路合并推进前的"本侧显式删除不得被合并带回结果树"复量。
// 判据一律 import 自 `../git-sync-converge.mjs` 的 `__test__` 出口(§22c),本文件不重写任何判定;
// 复量本身又 import 守门 168 的实现(auditMerge + classifyCandidate + readAllowlist)—— 于是"两处分叉"被同时钉住:
//   T5 钉 converge 不复算第二份判据,T3/T4 用真 git 夹具证明判据有牙(掏空即绿不了)。
// 立因现读:枚 12898ccd9bcb2b8e094e0057d94e0fab0380293a(11 枚文件的功能提交)在 git-sync-converge
// 造出的"不跑钩子"合并之后对 HEAD 与 origin 双非祖先 —— 守门 168 自写口径只覆盖"提交链上、未进 origin 的合并",
// 而这条路不跑钩子。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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
 *   base: 加 victim.txt(将被本侧删除);`withAllowlist` 时还落台账豁免条目
 *   ours (本侧/第一父): 删除 victim.txt
 *   theirs (对侧/第二父): 保留 victim.txt
 * @returns {{dir:string, base:string, ours:string, theirs:string}}
 */
function fixture({ withAllowlist = false } = {}) {
  const dir = mkScratch('g939d-')
  const cfg = ['-c', 'user.email=t@example.com', '-c', 'user.name=T']
  gitAt(dir, ['init', '-q', '.'])
  writeFileSync(path.join(dir, 'victim.txt'), '将被本侧删除\n')
  if (withAllowlist) {
    mkdirSync(path.join(dir, 'scripts', 'data'), { recursive: true })
    writeFileSync(
      path.join(dir, 'scripts', 'data', 'deletion-survival-allowlist.json'),
      JSON.stringify({
        entries: [
          {
            path: 'victim.txt',
            reason: '误删已裁决恢复——经评审确认该路径确应随合并带回',
            reviewBy: '2099-12-31',
          },
        ],
      }),
    )
    gitAt(dir, [...cfg, 'add', '-f', 'scripts/data/deletion-survival-allowlist.json'])
  }
  gitAt(dir, [...cfg, 'add', '-f', 'victim.txt'])
  gitAt(dir, [...cfg, 'commit', '-q', '-m', 'base'])
  const base = gitAt(dir, ['rev-parse', 'HEAD'])
  const mainBranch = gitAt(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
  // theirs: 从 base 分叉,保留 victim.txt
  gitAt(dir, ['checkout', '-q', '-b', 'theirs', base])
  gitAt(dir, [...cfg, 'commit', '-q', '--allow-empty', '-m', 'theirs-keep'])
  const theirs = gitAt(dir, ['rev-parse', 'HEAD'])
  // ours: 回到 base,删除 victim.txt(本侧显式删除)
  gitAt(dir, ['checkout', '-q', mainBranch])
  gitAt(dir, [...cfg, 'rm', '-f', 'victim.txt'])
  gitAt(dir, [...cfg, 'commit', '-q', '-m', 'ours-delete'])
  const ours = gitAt(dir, ['rev-parse', 'HEAD'])
  return { dir, base, ours, theirs }
}

/** 用 tree 直接造一枚双父合并提交(tree 决定"结果里有没有 victim.txt")。 */
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
  assert.equal(typeof CV.preAdvanceDeletionResurrection, 'function')
  assert.equal(typeof CV.deletionResurrectionVerdict, 'function')
})

test('T2 派发点恰一处实调用且不在注释里(挂点在 main 的推进路径上)', () => {
  const calls = SRC.split('\n').filter((l) => l.trim().startsWith('const resurrect = preAdvanceDeletionResurrection('))
  assert.equal(calls.length, 1, `派发点必须恰一处,实得 ${calls.length}(只在注释里写 = 造好没装车)`)
  const verdict = SRC.split('\n').filter((l) => l.trim().startsWith('const resurrectVerdict = deletionResurrectionVerdict('))
  assert.equal(verdict.length, 1, `裁定调用必须恰一处,实得 ${verdict.length}`)
  assert.match(SRC, /if \(resurrectVerdict\.block\) \{[\s\S]{0,2600}process\.exit\(1\)/, '拦下必须真的退出')
  // 顺序锁:复量必须排在 update-ref **之前**(推进之后再判,删除复活已经发生,判了也退不回来)
  const iBlock = SRC.indexOf('if (resurrectVerdict.block) {')
  const iExit = SRC.indexOf('process.exit(1)', iBlock)
  const iCas = SRC.indexOf("['update-ref'", iBlock)
  assert.ok(iBlock > 0 && iExit > 0 && iCas > 0, '派发/拦下/推进三段都要在源码里可寻')
  assert.ok(iExit < iCas, `复量必须排在 update-ref 之前(exit@${iExit} vs cas@${iCas})`)
  assert.match(SRC, /backupOrphanMerge\(mergeSha, 'deletion-resurrection'\)/, '拒绝推进前必须先把悬空合并备份成 tag(否则把 30a 转嫁给下一位)')
})

test('T3 阳性对照:结果树带回本侧已删文件 ⇒ 复量必须判复活(掏空判据这一格立刻翻绿)', () => {
  const f = fixture()
  try {
    // 用 theirs 树作结果树 ⇒ victim.txt 被带回(复活)
    const resurrectedTree = gitAt(f.dir, ['rev-parse', `${f.theirs}^{tree}`])
    const bad = makeMerge(f.dir, resurrectedTree, f.ours, f.theirs)
    const r = CV.preAdvanceDeletionResurrection({ mergeSha: bad, parents: [f.ours, f.theirs], cwd: f.dir })
    assert.equal(r.ok, false, '把本侧已删文件带回复活必须判不过')
    assert.ok(
      r.reds.some((x) => x.path === 'victim.txt'),
      `被复活的路径必须点名,实得 ${JSON.stringify(r.reds.map((x) => x.path))}`,
    )
    assert.equal(r.waived.length, 0, '无台账豁免时不得出现豁免')
  } finally {
    rmScratch(f.dir)
  }
})

test('T4 反向对照:结果树不含被删文件 ⇒ 复量必须放过(不给无关合并造恒红)', () => {
  const f = fixture()
  try {
    // 用 ours 树作结果树 ⇒ victim.txt 已删,无复活
    const cleanTree = gitAt(f.dir, ['rev-parse', `${f.ours}^{tree}`])
    const good = makeMerge(f.dir, cleanTree, f.ours, f.theirs)
    const r = CV.preAdvanceDeletionResurrection({ mergeSha: good, parents: [f.ours, f.theirs], cwd: f.dir })
    assert.equal(r.ok, true, `正常合并被误拦 = 恒红门(§12e),reds=${JSON.stringify(r.reds)}`)
  } finally {
    rmScratch(f.dir)
  }
})

test('T5 判据零复算:守门 168 的实现只住 check-merge-deletion-resurrection.mjs,converge 只 import 不另写一份', () => {
  assert.match(
    SRC,
    /import \{ auditMerge, classifyCandidate, readAllowlist \} from '\.\/check-merge-deletion-resurrection\.mjs'/,
  )
  const body = SRC.slice(
    SRC.indexOf('export function preAdvanceDeletionResurrection'),
    SRC.indexOf('export function preAdvanceDeletionResurrection') + 1600,
  )
  assert.ok(
    !/function\s+classifyCandidate\b/.test(body),
    '复量函数不得自己定义 classifyCandidate(那才是第二份真相)',
  )
  assert.ok(!/function\s+auditMerge\b/.test(body), '复量函数不得自己定义 auditMerge')
  assert.ok(!/function\s+readAllowlist\b/.test(body), '复量函数不得自己定义 readAllowlist')
})

test('T6 应急出口三态:无复活⇒过 / 裸跳旗⇒仍拦 / 跳旗+原因⇒放行且留痕', () => {
  const reds = [{ path: 'victim.txt', ours: 'o'.repeat(40) }]
  assert.deepEqual(CV.deletionResurrectionVerdict({ reds: [], undetermined: [] }), {
    proceed: true,
    block: false,
    skipUsed: false,
    bareSkip: false,
    reds: 0,
    undetermined: 0,
  })
  const bare = CV.deletionResurrectionVerdict({ reds, undetermined: [], skip: true, reason: '' })
  assert.equal(bare.block, true, '裸跳门不放行(失效方向只能是多要一次说明)')
  assert.equal(bare.bareSkip, true)
  const okSkip = CV.deletionResurrectionVerdict({
    reds,
    undetermined: [],
    skip: true,
    reason: '确属误判:DR1 不适用本型,证据见交付报告',
  })
  assert.equal(okSkip.proceed, true)
  assert.equal(okSkip.skipUsed, true, '放行必须留痕,不得静默')
})

test('T7 未判定一律 fail-closed:undetermined 出现 ⇒ 拦(不冒成"没复活")', () => {
  const v = CV.deletionResurrectionVerdict({ reds: [], undetermined: ['merge-base 解析不出 ⇒ 未判定'] })
  assert.equal(v.block, true, '未判定不得被放行(那是假绿)')
})

test('T8 台账路径豁免:登记且未过期的条目把候选判为豁免,不进红', () => {
  const f = fixture({ withAllowlist: true })
  try {
    const resurrectedTree = gitAt(f.dir, ['rev-parse', `${f.theirs}^{tree}`])
    const merge = makeMerge(f.dir, resurrectedTree, f.ours, f.theirs)
    const r = CV.preAdvanceDeletionResurrection({ mergeSha: merge, parents: [f.ours, f.theirs], cwd: f.dir })
    assert.equal(r.reds.length, 0, '被台账豁免的复活路径不得判红')
    assert.ok(
      r.waived.some((x) => x.path === 'victim.txt'),
      `豁免的条目必须如实报出,实得 ${JSON.stringify(r.waived.map((x) => x.path))}`,
    )
    assert.equal(r.ok, true, '豁免后无红、无未判定 ⇒ 应放行')
    assert.equal(r.allowBroken, false, '台账可正常判读')
  } finally {
    rmScratch(f.dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
