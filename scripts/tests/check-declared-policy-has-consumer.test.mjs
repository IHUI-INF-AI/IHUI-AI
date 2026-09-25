// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:check-declared-policy-has-consumer(策略/契约声明必须有非测试消费者)
//
// 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
// 不复制判据实现 —— 两份真相是登记在案的漂移源。
// 装车前置(刻意不硬写编号):接线归主会话(AGENTS §25 三件同批事实),本测试判"注册表
// 若出现本门,必须同时 blocking + skipEnv + 编号唯一";未注册时绿,并如实说明是"未装车"
// 而不是"已防护"。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as gate } from '../check-declared-policy-has-consumer.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-declared-policy-has-consumer.mjs')

test('T1 §22c 锚点:__test__ 必须导出核心判据且 skipEnv 命名在位', () => {
  for (const k of ['inScanRoot', 'candidateKinds', 'maskCommentsKeepStrings', 'blankStringContents', 'parseFile', 'specCompat', 'judge', 'decide', 'analyze', 'SELF_SKIP', 'FIXTURES']) {
    assert.ok(k in gate, `__test__ 缺导出:${k}`)
  }
  assert.equal(gate.SELF_SKIP, 'HUSKY_SKIP_DECLARED_POLICY_CONSUMER')
})

test('T2 正向证明(镜像自带构造):未接线必红、已接线必绿', () => {
  const { SS_UNWIRED, SS_WIRED, REPL_CONSUMER } = gate.FIXTURES
  const off = gate.judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED]]))
  assert.deepEqual(off.unwired.map((u) => u.name).sort(), ['DEFAULT_MAX_AGE_MS', 'pruneOldSessions'])
  const on = gate.judge(new Map([
    ['apps/cli/src/sessions/state-store.ts', SS_WIRED],
    ['apps/cli/src/commands/repl.ts', REPL_CONSUMER],
  ]))
  assert.equal(on.unwired.length, 0)
})

test('T3 变异对照:两条判据分支各自禁用一次,已接线夹具必须退回未接线(证明判据有牙)', () => {
  const { SS_WIRED, REPL_CONSUMER } = gate.FIXTURES
  const files = new Map([
    ['apps/cli/src/sessions/state-store.ts', SS_WIRED],
    ['apps/cli/src/commands/repl.ts', REPL_CONSUMER],
  ])
  assert.equal(gate.judge(files, { mutate: 'no-closure' }).unwired.length, 2, '闭包分支被禁用后仍绿 ⇒ 闭包是摆设')
  assert.equal(gate.judge(files, { mutate: 'no-external-refs' }).unwired.length, 2, '外部消费分支被禁用后仍绿 ⇒ 种子是摆设')
})

test('T4 消费者排除面:注释提及 / 只 import 不取用 / 纯 re-export / 测试面 四种"看起来有"都不算', () => {
  const { SS_UNWIRED, REPL_CONSUMER } = gate.FIXTURES
  const decl = ['apps/cli/src/sessions/state-store.ts', SS_UNWIRED]
  const cases = {
    commentOnly: REPL_CONSUMER.replace('persist("x")', '// persist("x")'),
    importNoUse: REPL_CONSUMER.replace('persist("x")', '1'),
    reexportOnly: "export { saveSession } from './state-store.js';\n",
    testFace: REPL_CONSUMER,
  }
  const maps = new Map()
  maps.set('commentOnly', new Map([decl, ['apps/cli/src/commands/repl.ts', cases.commentOnly]]))
  maps.set('importNoUse', new Map([decl, ['apps/cli/src/commands/repl.ts', cases.importNoUse]]))
  maps.set('reexportOnly', new Map([decl, ['apps/cli/src/sessions/index.ts', cases.reexportOnly]]))
  maps.set('testFace', new Map([decl, ['apps/cli/tests/s.test.ts', cases.testFace]]))
  for (const [name, files] of maps) {
    assert.equal(gate.judge(files).unwired.length, 2, `${name} 应当不算消费者,却判了 0 红`)
  }
})

test('T5 契约面形态:经 Mount 类型闭包接线的契约算已接线,零消费者谓词单点红', () => {
  const { TC_SRC, TOOL_CONSUMER } = gate.FIXTURES
  const r = gate.judge(new Map([
    ['packages/types/src/tool-contract.ts', TC_SRC],
    ['apps/cli/src/tools/index.ts', TOOL_CONSUMER],
  ]))
  assert.deepEqual(r.unwired.map((u) => u.name), ['mayTouchThing'])
})

test('T6 棘轮四向 + 空扫判死(staged vs HEAD 锚点;与改动无关的红不得诞生)', () => {
  assert.equal(gate.decide({ stagedCounts: { 'f.ts': 2 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit, 1)
  assert.equal(gate.decide({ stagedCounts: { 'f.ts': 1 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit, 0)
  assert.equal(gate.decide({ stagedCounts: {}, headCounts: { 'f.ts': 3 }, mode: 'staged' }).exit, 0)
  assert.equal(gate.decide({ stagedCounts: { 'g.ts': 1 }, headCounts: {}, mode: 'staged' }).exit, 1)
  const empty = gate.judge(new Map([['README.md', 'x']]))
  assert.equal(gate.decide({ stagedCounts: empty.perFile, mode: 'full', undetermined: empty.undetermined }).exit, 2)
})

test('T7 runner 装车前置:未注册 ⇒ 绿并如实报"未装车";一旦注册必须 blocking + skipEnv + 编号唯一', () => {
  const runner = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const src = readFileSync(SCRIPT, 'utf8')
  const idx = runner.indexOf('check-declared-policy-has-consumer.mjs')
  if (idx < 0) {
    // 接线是主会话的活(本票禁改 runner)。此刻唯一正确结论是"门在、尚未装车"。
    console.log('ℹ️  T7:本门尚未接入 guardian-runner(预期状态,接线由主会话统一完成)')
    // 反向锁:源脚本不得在头注里声称"已接 pre-commit/必跑"(守门 89 R1 的判据形态)
    assert.ok(!/已接\s*pre-commit|pre-commit\s*必跑/.test(src), '源脚本声称已接线但 runner 里没有 ⇒ 89 R1 型谎报')
    return
  }
  const block = runner.slice(Math.max(0, idx - 500), idx + 500)
  assert.match(block, /blocking:\s*true/, '本门被注册却不是 blocking ⇒ 等于没装(恒红防护由棘轮做,不由降级做)')
  assert.ok(block.includes(gate.SELF_SKIP), '注册条目缺紧急跳过通道 HUSKY_SKIP_DECLARED_POLICY_CONSUMER')
  const ids = [...runner.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual(dup, [], `runner 出现重复编号(${dup.join(', ')})—— 同日多会话撞号在 origin/main 上会互相覆盖注册块`)
})

test('T8 --self-test 真跑且**连跑两次**皆 rc=0(只能跑一次的取证等于没取证,守门 shadow-copy 同训)', () => {
  for (const round of [1, 2]) {
    const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 })
    assert.equal(r.status, 0, `第 ${round} 轮 --self-test rc=${r.status}\n${r.stdout?.slice(-600)}\n${r.stderr?.slice(-400)}`)
    assert.match(String(r.stdout), /全部 \d+ 例通过/, `第 ${round} 轮未见通过汇总行`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
