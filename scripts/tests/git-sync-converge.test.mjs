// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):git-sync-converge 的"闸门尺子装载"与"子进程四态分流"。
// 立项实据(2026-09-29 08:27 / 10:16 两次实测,均 #EVIDENCE-RC=1)：
//   `node scripts/git-sync-converge.mjs` 死在 `SyntaxError: The requested module
//   './lib/plan-task-index.mjs' does not provide an export named 'f9GroupLine'` —— 那是
//   **他人未提交**的那半边 lib 少一个导出，而本器用静态 import 把 union-converge 整条依赖图
//   拉进了自己的装载面，于是一条与台账闸门无关的快路径也陪着死，账面只剩一截 Node 堆栈。
// 判据的对象是"崩了要说成崩了"，不是"崩溃必须存在" ⇒ 所有用例走构造面/临时仓，不依赖世界此刻坏着。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { __test__ as G, classifyUnionAttempt, unionOutcomeMessage, STATE_GATE_UNDETERMINED } from '../git-sync-converge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const SRC = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')
// 真实崩溃文本(逐字取自 .ihui-agent/tmp/g755/ev-conv-c1.json 里当轮量到的那段,不得自造形状)
const REAL_CRASH_TEXT = [
  "import { auditPlan, malformedLine, f9GroupLine, DUP_POINTER_RE, MERGE_NOTE_RE } from './lib/plan-task-index.mjs'",
  '                                   ^^^^^^^^^^^',
  "SyntaxError: The requested module './lib/plan-task-index.mjs' does not provide an export named 'f9GroupLine'",
  '    at #asyncInstantiate (node:internal/modules/esm/module_job:327:21)',
].join('\n')

test('T1 分流四态:真崩溃文本必须是 crashed,不得被读成 need-human(票面要修的就是这一格)', () => {
  assert.equal(classifyUnionAttempt(REAL_CRASH_TEXT), 'crashed')
  assert.equal(classifyUnionAttempt(''), 'crashed', '空输出同样一处都没判,不得当成"判了需人工"')
  assert.equal(classifyUnionAttempt('   \n\n'), 'crashed')
  assert.equal(classifyUnionAttempt('…\n✅ 合并落地 7 条路径\n'), 'landed')
  assert.equal(classifyUnionAttempt('UNDETERMINED: 远端对象不在本机'), 'undetermined')
  assert.equal(classifyUnionAttempt('未判定: 计划文档在该面上取不到'), 'undetermined')
  assert.equal(
    classifyUnionAttempt('❌ 台账两侧的行确实都得保住,机器归并没有出口 ⇒ 交人工解冲突'),
    'need-human',
    '真内容裁决不得被误升级成"通道断了"(那会让人不去解冲突)',
  )
})

test('T2 措辞分流:除 need-human 外三支都不得说"需人工",且每支必须给出路', () => {
  for (const k of ['landed', 'undetermined', 'crashed']) {
    const msg = unionOutcomeMessage(k)
    assert.ok(!msg.includes('需人工'), `${k} 那一支说了"需人工" ⇒ 崩溃/没取回会被读成内容裁决`)
    assert.ok(/再重跑|转下一轮|重跑本器/.test(msg), `${k} 那一支没有可执行的下一步:${msg}`)
  }
  assert.ok(unionOutcomeMessage('crashed').includes('import'), '崩溃支必须点名它断在装载/依赖上')
  assert.equal(unionOutcomeMessage('need-human').includes('需人工'), true)
})

test('T3 形状锁:union-converge 不得再被静态 import,且必须经 ensureUnionModule 装载', () => {
  assert.ok(
    !/^import\s*\{[^}]*planStateRegressions[^}]*\}\s*from\s*'\.\/union-converge\.mjs'/m.test(SRC),
    '回到静态顶层 import ⇒ 一条依赖崩了就整条通道死(本票要修的那一格)',
  )
  assert.match(SRC, /await import\('\.\/union-converge\.mjs'\)/, '没有异步装载出口')
  assert.match(SRC, /ensureUnionModule\(\)\s*\n?\s*\.then\(\(\) => main\(\)\)/, 'CLI 入口没把装载排在 main 之前')
})

test('T4 两个调用点都必须先分流再谈"亦判需人工"(与守门 89/g473 同一条顺序判据)', () => {
  const sites = [...SRC.matchAll(/attemptUnionConverge\(freshRemote, repoRoot\)/g)]
  assert.equal(sites.length, 3, '调用点应为"1 处定义 + 2 处分支调用",现在 ' + sites.length + ' 处 ⇒ 本锁对着空气判绿')
  for (const m of sites.slice(1)) {
    const win = SRC.slice(m.index, m.index + 1800)
    const iClass = win.indexOf('classifyUnionAttempt(')
    const iHuman = win.indexOf('亦判需人工')
    assert.ok(iClass > 0, '该分支没走分流判据 ⇒ 崩溃会被打印成需人工')
    assert.ok(iHuman < 0 || iHuman > iClass, '分流必须排在"需人工"那句之前')
  }
})

test('T5 子进程 stderr 必须回吐(只回 stdout+message 会把 import 期崩溃读成"它判了点什么")', () => {
  // 判**函数体**而不是"函数名后 N 字符窗口":窗口会因头注变长而够不着,那种锁的失效形态是恒红,
  // 而恒红在本案中又被上游装载崩溃挡住 ⇒ 没人发现它已经不再判任何东西(同轮修掉的那条)。
  const start = SRC.indexOf('function attemptUnionConverge(')
  assert.ok(start > 0, '找不到出口定义 ⇒ 本锁对着空气判绿')
  const rest = SRC.slice(start)
  const body = rest.slice(0, rest.indexOf('\n}\n') + 3)
  assert.match(
    body,
    /catch \(ue\) \{\s*return String\(ue\.stdout \|\| ue\.message/,
    'catch 必须仍然优先回吐 stdout(接住非零退出是 G-473 的锁,不得改)',
  )
  assert.ok(body.includes('stderrTail(ue)'), '没有把 stderr 拼上 ⇒ 崩溃只剩 "Command failed" 一行')
})

test('T6 闸门尺子没装载 ⇒ 必须落"未判定"点名行,绝不返回 [](那是把没跑写成没有放大)', () => {
  const dir = mkScratch('gsc-gate-')
  try {
    const g = (...a) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...a], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      }).trim()
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# 台账\n- [ ] G-1 一件事\n', 'utf8')
    writeFileSync(join(dir, 'scripts', 'plan-task-state-baseline.json'), '{"F6":0}\n', 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'base')
    const sha = g('rev-parse', 'HEAD')

    const gate = G.unionGate
    const saved = { mod: gate.mod, error: gate.error }
    try {
      gate.mod = null
      gate.error = "does not provide an export named 'f9GroupLine'"
      const r = G.mergedPlanStateRegressions(sha, sha, sha, dir)
      assert.equal(r.length, 1, '装载失败必须产出一条点名行(0 = 记绿)')
      assert.ok(r[0].startsWith(STATE_GATE_UNDETERMINED), '未判定行必须带受控前缀,调用方按它分流')
      assert.ok(r[0].includes('f9GroupLine'), '点名行必须带上真正的原因文本,否则报告答不出为什么没跑')

      // 反向对照:装载成功 ⇒ 走的是尺子本身,而不是那条未判定行(证明上面那支不是恒真式)
      gate.mod = { planStateRegressions: () => ['来自尺子的真实结论'] }
      gate.error = ''
      const r2 = G.mergedPlanStateRegressions(sha, sha, sha, dir)
      assert.deepEqual(r2, ['来自尺子的真实结论', '基线 JSON 解析失败 ⇒ 第②把尺子未判定(不记为通过)'].slice(0, r2.length))
      assert.ok(r2[0] === '来自尺子的真实结论', '闸门没跑成时不得借用尺子的出口')
    } finally {
      gate.mod = saved.mod
      gate.error = saved.error
    }
  } finally {
    rmScratch(dir)
  }
})

test('T7 台账闸门未判定那一支必须先于"放大"文案与归并尝试(fail-closed 且不误导处置动作)', () => {
  const iGate = SRC.indexOf('startsWith(STATE_GATE_UNDETERMINED)')
  const iAmp = SRC.indexOf('无冲突合并放大了活文档任务状态')
  assert.ok(iGate > 0, '调用方没有识别未判定前缀的分支 ⇒ 闸门断开会打印成"放大"')
  assert.ok(iGate < iAmp, '未判定分流必须排在放大文案之前')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
