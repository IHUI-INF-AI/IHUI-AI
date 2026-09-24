// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// seal-c-root-stray 的镜像测试(§22c):直接 import 源脚本,不复制判据实现。
// 本文件的重心不是"封口逻辑对不对"(那由源脚本 --self-test 的 11 例端到端钉),
// 而是**三件只有跨文件才看得见的事**:
//   ① 封口器是否真的被每日维护脚本调用(造好没装车 = 没有,本仓同类事故已第 N 次);
//   ② 守门是否 import 这份清单,而不是自己抄一份名字(两份真相必然漂移);
//   ③ 改道目标是否仍落在 §15b 批准的落点内(清单被人挪去 C 盘就彻底背离初衷)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__, ORPHAN_FILES, SEALED_DIRS, run } from '../seal-c-root-stray.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')

test('装车证明①:每日维护脚本必须真的调用封口器(--check 与 --apply 两条都在)', () => {
  const ps1 = readFileSync(join(SCRIPTS, 'c-drive-auto-maintain.ps1'), 'utf8')
  assert.ok(
    ps1.includes('seal-c-root-stray.mjs'),
    '维护脚本没引用封口器 ⇒ 门面上写了根治,实际每天无人复检,回潮不可见',
  )
  assert.match(ps1, /--check/, '缺少零副作用的体检调用')
  assert.match(ps1, /--apply/, '缺少自动重封调用(只报不修等于要人天天手动跑)')
})

test('装车证明②:守门必须 import 本清单,不得自己抄一份名字', () => {
  const gate = readFileSync(join(SCRIPTS, 'check-c-drive-pollution.mjs'), 'utf8')
  assert.match(
    gate,
    /import\s*\{[^}]*SEALED_DIRS[^}]*\}\s*from\s*'\.\/seal-c-root-stray\.mjs'/,
    '守门未从封口器 import SEALED_DIRS',
  )
  // 真正该禁的是"import 进来却不用"(= 空门:清单漂了门照样绿),而不是"代码里出现这个名字" ——
  // FOREIGN_ROOT 里本来就该挂着 tmp/tools(含义是"别当成我们的"),按字面量禁会误伤。
  // 第一版就是拿字面量当判据,结果被自己写的自检夹具判红,那是判据问错了问题。
  const selfTestAt = gate.indexOf('function selfTest(')
  assert.ok(selfTestAt > 0, '找不到 selfTest 边界 ⇒ 本断言会退化成空判')
  const judgeCode = gate.slice(0, selfTestAt)
  const body = judgeCode.replace(/import[^\n]*\n/g, '')
  assert.ok(
    /classifySeal|SEALED_DIRS/.test(body),
    'SEALED_DIRS 只在 import 里出现,判决代码没用它 ⇒ 封口判据是空门',
  )
  assert.doesNotMatch(
    body,
    /const\s+SEALED_\w+\s*=\s*\[/,
    '守门自己又定义了一份封口清单 ⇒ 两份真相,清单一改就漂移',
  )
})

test('清单卫生:名字必须是单段、非空、不重复', () => {
  assert.ok(SEALED_DIRS.length >= 3, '封口清单被清空 ⇒ BROKEN 判据永不触发')
  const names = SEALED_DIRS.map((e) => e.name.toLowerCase())
  assert.equal(new Set(names).size, names.length, '清单有重名')
  for (const e of SEALED_DIRS) {
    assert.doesNotMatch(e.name, /[\\/:*?"<>|]/, `name 必须是单段目录名:${e.name}`)
    assert.ok(e.owner && e.evidence, `${e.name} 缺 owner/evidence —— 无取证的条目不该进清单`)
  }
  assert.ok(ORPHAN_FILES.length >= 1 && ORPHAN_FILES.every((o) => o.reason), '孤儿清单须带定性依据')
})

test('改道目标必须落在 §15b 批准的外置根下,且不得回到 C 盘', () => {
  const allowed = ['cache/', 'Temp/', 'tools/']
  for (const e of SEALED_DIRS) {
    assert.ok(
      allowed.some((p) => e.target.startsWith(p)),
      `${e.name} 的目标 ${e.target} 不在批准的三类落点内`,
    )
    assert.doesNotMatch(e.target, /^[cC]:/, `${e.name} 的目标写死在 C 盘,改道失去意义`)
    assert.doesNotMatch(e.target, /\.\./, `${e.name} 的目标含上跳`)
  }
})

test('端到端:真目录改道后,同一路径仍可读且源变成链接', () => {
  const base = mkScratch('seal-mirror-')
  try {
    const root = join(base, 'root')
    const dev = join(base, 'devenv')
    const entry = SEALED_DIRS[0]
    const stray = join(root, entry.name)
    mkdirSync(stray, { recursive: true })
    writeFileSync(join(stray, 'payload.txt'), 'abc')

    assert.equal(run({ root, dev, mode: 'apply' }).sealed[0].ok, true, 'apply 失败')
    assert.equal(existsSync(join(stray, 'payload.txt')), true, '改道后经原路径读不到内容')
    // 第二次必须全 skip —— 不幂等的封口器会在每日任务里反复搬同一批文件
    const again = run({ root, dev, mode: 'apply' })
    assert.deepEqual(
      again.sealed.map((s) => s.action),
      SEALED_DIRS.map(() => 'skip'),
      '二次运行仍在动东西 ⇒ 不幂等',
    )
    // 已封口时 check 必须给绿,否则每日巡检天天红,结论会被习惯性地忽略
    assert.equal(run({ root, dev, mode: 'check' }).needsAction, false, '已封口却报待处置')
  } finally {
    rmScratch(base)
  }
})

test('反向对照:把链接换成真目录,check 必须立刻判待处置', () => {
  const base = mkScratch('seal-mirror-neg-')
  try {
    const root = join(base, 'root')
    const dev = join(base, 'devenv')
    mkdirSync(join(root, SEALED_DIRS[0].name, 'sub'), { recursive: true })
    const r = run({ root, dev, mode: 'check' })
    assert.equal(r.sealed[0].state, 'REAL-DIR', '真目录没被判回潮')
    assert.equal(r.needsAction, true, '回潮却报无需处理 ⇒ 判据给了假绿灯')
    assert.equal(existsSync(join(dev)), false, 'check 模式不该创建外置目标')
  } finally {
    rmScratch(base)
  }
})

test('__test__ 出口齐备(§22c:缺出口即红,防"测试悄悄测镜像实现")', () => {
  for (const fn of ['classifyEntry', 'fingerprint', 'sameFingerprint', 'pathsFor', 'devEnvRoot']) {
    assert.equal(typeof __test__[fn], 'function', `__test__.${fn} 缺失`)
  }
  assert.ok(Array.isArray(__test__.SEALED_DIRS) && Array.isArray(__test__.ORPHAN_FILES))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
