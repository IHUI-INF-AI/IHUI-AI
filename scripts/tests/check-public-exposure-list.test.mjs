// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-public-exposure-list.mjs(§22c)
//
// 为什么要有这份文件而不是只看门自己的 `--self-test`:自检跑的是**构造面**,它证明
// "函数会给答案",不证明"有人问它",也不证明真仓里那两份 nginx 配置真被读成了开放项
// (AGENTS「装车判据必须数生产面 importer」与守门 117「改被审写法必须同批改审它的正则」
//  两型同根)。这里补三条自检给不出的东西:
//   T4 输入**逐字取自真实配置文本**(§22c 红线:判据对象是真实文件的形态时不得全用自造夹具);
//   T5 真仓端到面(工作树)必须现读出那条开放项 ⇒ "看不见自己的配置"不算通过;
//   T6 定级锁:本脚本判的是跨面一致性,一旦被误接进提交链就是恒红门(§12e),
//      所以"未注册"这件事必须由测试看守 —— 将来真要接线,必须**同时**改这条测试并补
//      skipEnv/blocking 声明,不允许悄悄挂上去。
// 另有三条形状锁:T1 取材面纪律(必须走 face-reader,不得自派生 git 或按磁盘判 HEAD 档)、
// T2 三态不得并桶(0/1/2 各命中一次)、T3 CLI 开关不得静默掉进默认档(仓里记过的那型)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  __test__ as gate,
  decide,
  exitCodeFor,
  gather,
  parseAnnotations,
  withFixture,
} from '../check-public-exposure-list.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT = join(ROOT, 'scripts', 'check-public-exposure-list.mjs')
const RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')
const FRAGMENT_REL = 'deploy/nginx/conf.d/public-ai-service.locations.fragment'

// ── T1 取材面纪律(形状锁):内容只能经 face-reader 的读取入口进来 ──────────
test('T1 取材面:必须 import face-reader 并真用 catBatch 读内容,不得自派生 git / 不得按 cwd 定根', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '未引 face-reader ⇒ 门 118 会判成 loose')
  assert.match(src, /catBatch\(root, revs\)/, '没有 catBatch 调用 ⇒ 引了层却没用它读内容 = 半接线')
  assert.doesNotMatch(
    src,
    /readFileSync\(/,
    '被审内容不得按磁盘取(git show / readFileSync 自派生都是散写)',
  )
  assert.doesNotMatch(src, /gitRaw\(\s*\[\s*'(show|cat-file|grep)'/, '自派生 git 读内容 = 半接线')
  assert.doesNotMatch(
    src,
    /process\.cwd\(\)/,
    'ROOT 不得由 cwd 推(守门 70 的镜像测试 13/14 恒红那一型)',
  )
  assert.match(src, /import\.meta\.url/, 'ROOT 须由脚本自身位置推导')
})

// ── T2 三态不并桶 ─────────────────────────────────────────────────────────
test('T2 三态各自可达:一致=0 / 不一致=1 / 未判定=2,绝不把"没判"写成"判过了"', () => {
  assert.equal(exitCodeFor(decide(withFixture())), 0, '正例必须记绿')
  const broken = withFixture({
    siteShell: gate.FIXTURE_SITE_SHELL.replace(/proxy_set_header X-Api-Key "";\n/, ''),
  })
  const bad = decide(broken)
  assert.equal(bad.state, 'inconsistent')
  assert.equal(exitCodeFor(bad), 1, '不一致必须给 1')
  const gone = decide({ ...withFixture(), docker: null })
  assert.equal(gone.state, 'undetermined', '必需输入取不到不得记绿也不得记红')
  assert.equal(exitCodeFor(gone), 2)
  assert.equal(
    exitCodeFor(decide({ ...withFixture(), catalog: JSON.stringify({ capabilities: [] }) })),
    2,
    '目录枚举到 0 条 ai-service = 尺子失效,不是"没有敞口"',
  )
})

// ── T3 CLI 开关不得静默掉进默认档 ───────────────────────────────────────────
test('T3 面旗必须真改结论:两面旗同给判死、--root 只在工作树档有效', () => {
  const both = gate.main(['--staged', '--worktree'])
  assert.equal(both, 2, '两面旗同给必须判死(取哪一面都会让另一面成为假绿)')
  assert.equal(
    gate.main(['--root', ROOT]),
    2,
    '不带 --worktree 却换根 ⇒ 双根分裂,必须拒跑(RC 2)而不是悄悄按 HEAD 判',
  )
})

// ── T4 真实配置文本:格式示例行不得被读成申报 ──────────────────────────────
test('T4 逐字取真实片段文本:恰好一条申报,且头注里的格式示例行不计为申报', () => {
  const text = readFileSync(join(ROOT, FRAGMENT_REL), 'utf8')
  const all = parseAnnotations(text)
  assert.equal(all.length, 1, `真实片段应恰好一条申报,现读 ${all.length}`)
  assert.deepEqual(all[0], {
    capability: 'mcp:connect',
    method: 'POST',
    path: '/api/mcp',
    upstream: '/api/mcp',
  })
  assert.ok(
    text.includes('capability=<目录 scope>'),
    '头注里的格式说明行必须仍在 —— 它是 T4 后半截夹具的来源(删了就等于把这条锁拆了)',
  )
})

// ── T5 真仓端到面(工作树)───────────────────────────────────────────────────
test('T5 真仓现读:工作树面必须报出那一条开放项,且零违规', () => {
  const conclusion = decide(gather(ROOT, 'worktree'))
  assert.deepEqual(
    conclusion.opened,
    ['mcp:connect|POST|/api/mcp'],
    `开放集不对(状态 ${conclusion.state},违规 ${conclusion.violations.join(' / ')})`,
  )
  assert.equal(conclusion.state, 'consistent', conclusion.violations.join('\n'))
  assert.equal(conclusion.catalogAiService.length, 6, '目录里 host:ai-service 现读应为 6 条')
  // docker 侧那条整棵子树必须被**点名**而不被"顺手放过" —— 只报数也要报得出名字
  assert.ok(
    conclusion.notices.some((n) => n.includes('/ai-service/')),
    `既有宽面没被点名:${conclusion.notices.join(' / ')}`,
  )
})

// ── T6 定级锁 ─────────────────────────────────────────────────────────────
test('T6 本脚本是手动档:不得被注册进 guardian-runner(接线=恒红门,§12e)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  assert.ok(
    !runner.includes('check-public-exposure-list'),
    '被接进提交链了:它判的是跨面一致性,一次只改一份配置的提交结构上满足不了 ⇒ 必须先补 skipEnv + 定级讨论并同步改这条测试',
  )
})

// ── T7 (B) 边表面只报数,不判红 ──────────────────────────────────────────────
test('T7 X6 只报数:(B) 与 nginx 面的分歧不得变成 violation', () => {
  const c = decide(withFixture())
  assert.equal(c.violations.length, 0)
  assert.ok(
    c.notices.some((n) => n.includes('connectors:read')),
    `(B) 独有的那条必须被点名:${c.notices.join(' / ')}`,
  )
  const noEdge = decide({ ...withFixture(), edgeTable: '' })
  assert.ok(noEdge.undetermined.length > 0, '空内容文件必须喊未判定,不得静默算"无差异"')
  assert.equal(noEdge.state, 'consistent', 'X6 那一格未判定不得连带把 X1–X5 判成未判定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
