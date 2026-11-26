// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:lib/autonomy-quality.mjs 的编排层形状锁。
// 纪律:判据一律 import 源文件的 __test__ 出口,本文件零复制判据(§22c / 守门 191)。
// 全程注入 fake spawn —— 不起真进程、不连外网、不碰生产库(§5 测试隔离)。
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { __test__ as Q } from '../lib/autonomy-quality.mjs'

test('缺省档 = off(题库没建时绝不每轮灌 undetermined 噪声)', () => {
  assert.equal(Q.resolveQualityConfig({}).mode, 'off')
  assert.equal(Q.resolveQualityConfig({ ruler: {} }).mode, 'off')
  assert.equal(Q.DEFAULT_QUALITY_MODE, 'off')
})

test('档位与牌寿命形状校验:越界即抛,不静默回落', () => {
  assert.throws(() => Q.resolveQualityConfig({ ruler: { mode: 'always' } }), /ruler\.mode 只能是 off\|observe\|enforce/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { holdHours: 0 } }), /ruler\.holdHours/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { holdHours: 999 } }), /ruler\.holdHours/)
  assert.deepEqual(Q.resolveQualityConfig({ ruler: { mode: 'enforce', holdHours: 6 } }), {
    mode: 'enforce',
    holdHours: 6,
    tune: {},
    datasetDir: null,
    stamp: null,
  })
})

// ---- 调参透传:配置只校验取值,flag 名由 lib 单点映射(§0.6) ---- #
test('调参校验:坏值当场抛,不设的值一律不拼 flag(让 Python 默认值继续做主)', () => {
  assert.throws(() => Q.resolveQualityConfig({ ruler: { minJudged: 0 } }), /minJudged 必须是正整数/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { window: 2.5 } }), /window 必须是正整数/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { minDelta: 0 } }), /minDelta/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { minDelta: 1.5 } }), /minDelta/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { datasetDir: '   ' } }), /datasetDir/)
  const tuned = Q.resolveQualityConfig({ ruler: { mode: 'observe', minJudged: 5, window: 2, minDelta: 0.2, datasetDir: 'D:/x/eval' } })
  assert.deepEqual(tuned.tune, { minJudged: 5, window: 2, minDelta: 0.2 })
  assert.equal(tuned.datasetDir, 'D:/x/eval')
})

test('argv 组装:未配置的参数不得出现在命令行里(否则两处默认会漂移)', () => {
  assert.deepEqual(Q.buildRulerArgv('S.py', 'v1').slice(1), ['--version', 'v1'])
  assert.deepEqual(Q.buildRulerArgv('S.py', 'v1', {}).slice(1), ['--version', 'v1'])
  assert.deepEqual(Q.buildRulerArgv('S.py', 'v1', { minJudged: 5 }).slice(1), ['--version', 'v1', '--min-judged', '5'])
  const full = Q.buildRulerArgv('S.py', 'v2', { minJudged: 5, window: 3, minDelta: 0.25 })
  assert.deepEqual(full, ['S.py', '--version', 'v2', '--min-judged', '5', '--window', '3', '--min-delta', '0.25'])
  assert.deepEqual(Q.buildRulerArgv('S.py', null).slice(1), ['--version', 'unknown'], '缺版本号必须落 unknown 占位而非空串参数')
})

test('调参端到端:配置值 ⇒ 子进程 argv 真带上 flag 与 PRIVATE_EVAL_DIR', () => {
  const seen = {}
  const root = process.cwd().replace(/\\/g, '/')
  const cfg = Q.resolveQualityConfig({ ruler: { mode: 'observe', minJudged: 4, window: 2, minDelta: 0.3, datasetDir: 'D:/DevEnv/Temp/probe' } })
  const r = Q.runRuler({
    mode: cfg.mode,
    root,
    version: 'a'.repeat(40),
    tune: cfg.tune,
    datasetDir: cfg.datasetDir,
    env: {},
    platform: 'win32',
    spawnFn: (file, args, opts) => {
      seen.args = args
      seen.env = opts.env
      return { status: 1, stdout: '哨兵: regression\n', stderr: '' }
    },
  })
  if (r.verdict === 'undetermined' && r.why.includes('不在位')) {
    assert.ok(true, '精简检出处:尺子不在位即未判定,也是正解')
    return
  }
  assert.equal(r.verdict, 'regression')
  assert.ok(seen.args.includes('--min-judged') && seen.args[seen.args.indexOf('--min-judged') + 1] === '4', JSON.stringify(seen.args))
  assert.ok(seen.args.includes('--window') && seen.args[seen.args.indexOf('--window') + 1] === '2')
  assert.ok(seen.args.includes('--min-delta') && seen.args[seen.args.indexOf('--min-delta') + 1] === '0.3')
  assert.equal(seen.env.PRIVATE_EVAL_DIR, 'D:/DevEnv/Temp/probe')
})

test('逐版戳印配置:generate=true 才带模型与预算;坏值当场抛', () => {
  assert.equal(Q.resolveQualityConfig({ ruler: { mode: 'observe' } }).stamp, null, '没配 generate 不得偷偷启用')
  assert.throws(() => Q.resolveQualityConfig({ ruler: { generate: 'yes' } }), /ruler\.generate/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { generate: true, stampLimit: -1 } }), /stampLimit/)
  assert.throws(() => Q.resolveQualityConfig({ ruler: { generate: true, stampTimeoutMs: 1000 } }), /stampTimeoutMs/)
  const stamp = Q.resolveQualityConfig({
    ruler: { mode: 'observe', generate: true, candidateModel: 'agnes-3.0-flash', baselineModel: 'agnes-2.5-flash', stampLimit: 12 },
  }).stamp
  assert.deepEqual(stamp, {
    generate: true,
    candidateModel: 'agnes-3.0-flash',
    baselineModel: 'agnes-2.5-flash',
    prompts: '',
    limit: 12,
    timeoutMs: 240000,
  })
  assert.deepEqual(Q.buildStampArgv('S.py', 'v1', stamp).slice(1), [
    '--version',
    'v1',
    '--candidate-model',
    'agnes-3.0-flash',
    '--baseline-model',
    'agnes-2.5-flash',
    '--limit',
    '12',
  ])
})

test('戳印失败 ⇒ undetermined 且不再起判分(不拿旧题库冒充本轮测过)', () => {
  const root = process.cwd().replace(/\\/g, '/')
  let calls = 0
  const r = Q.runRuler({
    mode: 'observe',
    root,
    version: 'b'.repeat(40),
    stamp: { generate: true, candidateModel: 'auto', baselineModel: '', prompts: '', limit: 0, timeoutMs: 240000 },
    env: {},
    platform: 'win32',
    spawnFn: () => {
      calls++
      return { status: 2, stdout: '[未判定] 题库没建\n', stderr: '' }
    },
  })
  if (r.verdict === 'undetermined' && r.why.includes('不在位')) {
    assert.ok(true, '精简检出处:戳印器不在位即未判定,也是正解')
    return
  }
  assert.equal(r.verdict, 'undetermined')
  assert.equal(calls, 1, '戳印失败后不得再起判分进程')
  assert.match(r.why, /题库戳印失败/)
})

test('戳印成功才轮到判分:两次 spawn 的 argv 各走各的契约', () => {
  const root = process.cwd().replace(/\\/g, '/')
  const calls = []
  const r = Q.runRuler({
    mode: 'observe',
    root,
    version: 'c'.repeat(40),
    stamp: { generate: true, candidateModel: 'agens', baselineModel: 'base', prompts: '', limit: 12, timeoutMs: 240000 },
    env: {},
    platform: 'win32',
    spawnFn: (file, args) => {
      calls.push(args)
      return { status: 0, stdout: calls.length === 2 ? '哨兵: ok\n' : '[已落盘] 12 行\n', stderr: '' }
    },
  })
  if (r.verdict === 'undetermined' && r.why.includes('不在位')) {
    assert.ok(true, '精简检出处:尺子不在位即未判定,也是正解')
    return
  }
  assert.equal(r.verdict, 'ok')
  assert.equal(calls.length, 2)
  assert.ok(calls[0][0].endsWith('private_eval_stamp.py'), JSON.stringify(calls[0]))
  assert.ok(calls[1][0].endsWith('private_eval_run.py'), JSON.stringify(calls[1]))
})


test('退码三态映射:未知退码/信号/异常一律 undetermined,绝不默认 ok', () => {
  assert.equal(Q.mapRulerExit({ status: 0 }), 'ok')
  assert.equal(Q.mapRulerExit({ status: 1 }), 'regression')
  assert.equal(Q.mapRulerExit({ status: 2 }), 'undetermined')
  for (const weird of [3, 7, -1, null, undefined]) {
    assert.equal(Q.mapRulerExit({ status: weird }), 'undetermined', `status=${String(weird)} 不得被读成 ok`)
  }
  assert.equal(Q.mapRulerExit({ status: 0, signal: 'SIGKILL' }), 'undetermined', '被杀但带 0 也应未判定')
  assert.equal(Q.mapRulerExit({ error: new Error('ENOENT') }), 'undetermined')
})

test('停派只在 enforce × regression;undetermined 永不锁死整环(§12e)', () => {
  assert.equal(Q.shouldHold({ mode: 'enforce', verdict: 'regression' }), true)
  assert.equal(Q.shouldHold({ mode: 'enforce', verdict: 'undetermined' }), false)
  assert.equal(Q.shouldHold({ mode: 'enforce', verdict: 'ok' }), false)
  assert.equal(Q.shouldHold({ mode: 'observe', verdict: 'regression' }), false)
  assert.equal(Q.shouldHold({ mode: 'off', verdict: 'regression' }), false)
})

test('off 档不起进程(spawn 被调即失败)', () => {
  let called = 0
  const r = Q.runRuler({ mode: 'off', root: 'X', spawnFn: () => { called++; return { status: 0 } } })
  assert.equal(r.verdict, 'skipped')
  assert.equal(called, 0, 'off 档必须连进程都不起')
})

test('解释器可显式指路(换机 venv 不在原位),且取不到时点名用的是哪条路', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate328-env-'))
  try {
    const real = join(dir, 'python.exe')
    writeFileSync(real, '', 'utf8')
    const root = process.cwd().replace(/\\/g, '/')
    const hit = Q.resolveRulerPlan(root, { IHUI_AI_SERVICE_PYTHON: real.replace(/\\/g, '/') }, 'win32')
    assert.equal(hit.fromOverride, true)
    assert.equal(hit.interpreter, real.replace(/\\/g, '/'))
    assert.equal(hit.missing.length, 0, `指路后不该再报缺失:${String(hit.missing)}`)
    const miss = Q.resolveRulerPlan(root, { IHUI_AI_SERVICE_PYTHON: join(dir, 'nope.exe').replace(/\\/g, '/') }, 'win32')
    assert.equal(miss.ok, false)
    assert.ok(miss.missing[0].includes('IHUI_AI_SERVICE_PYTHON'), `坏指路必须点名是 env 那条路:${String(miss.missing)}`)
    const def = Q.resolveRulerPlan(root, {}, 'win32')
    assert.equal(def.fromOverride, false)
    assert.ok(def.interpreter.endsWith('/apps/ai-service/.venv/Scripts/python.exe'), def.interpreter)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('尺子不在位 ⇒ 未判定并点名缺哪件(不冒 ok)', () => {
  let called = 0
  const r = Q.runRuler({ mode: 'observe', root: join(tmpdir(), 'no-such-repo-root'), spawnFn: () => { called++; return { status: 0 } } })
  assert.equal(r.verdict, 'undetermined')
  assert.equal(called, 0, '解释器/脚本不在位时不该起进程')
  assert.ok(r.why.includes('不在位'), r.why)
})

test('真跑形状:argv 带版本号,stdio 显式接管且 windowsHide(§12g/§5b)', () => {
  const seen = {}
  const fake = (file, args, opts) => {
    seen.file = file
    seen.args = args
    seen.opts = opts
    return { status: 1, stdout: '  哨兵: regression  baseline=0.75 dropped=0.75\n', stderr: '' }
  }
  // 拿真仓根让 resolveRulerPlan 通过存在性闸(尺子入口脚本已在册),但 spawn 仍是假的。
  const root = process.cwd().replace(/\\/g, '/')
  const r = Q.runRuler({ mode: 'enforce', root, version: 'a'.repeat(40), env: {}, platform: 'win32', spawnFn: fake })
  if (r.verdict === 'undetermined' && r.why.includes('不在位')) {
    // 允许:在精简检出上跑本测试(尺子脚本尚未入库的极端情形)——此时断言"未判定"本身就是正解
    assert.ok(true)
    return
  }
  assert.ok(String(seen.file).endsWith('python.exe') || String(seen.file).endsWith('python3'), seen.file)
  assert.equal(seen.args.length, 3, `argv 形状必须固定为 [脚本, --version, 版本],实得:${JSON.stringify(seen.args)}`)
  assert.ok(String(seen.args[0]).endsWith('private_eval_run.py'), JSON.stringify(seen.args))
  assert.equal(seen.args[1], '--version')
  assert.equal(seen.args[2], 'a'.repeat(40), '版本号必须原样透传给尺子(曲线点靠它对账 §1)')
  assert.deepEqual(seen.opts.stdio, ['ignore', 'pipe', 'pipe'], '不显式接管 stdio 在本机稳定 EBUSY(§12g)')
  assert.equal(seen.opts.windowsHide, true, '派生进程必须 windowsHide(§5b 机器级默认)')
  assert.equal(r.verdict, 'regression')
  assert.ok(r.tail.includes('regression'), r.tail)
})

test('datasetDir 必须透传成子进程 PRIVATE_EVAL_DIR(不污染常驻批准根才能试跑)', () => {
  const seenEnv = {}
  const root = process.cwd().replace(/\\/g, '/')
  const fake = (file, args, opts) => {
    Object.assign(seenEnv, opts.env || {})
    return { status: 2, stdout: '哨兵: unjudged 基线样本不足\n', stderr: '' }
  }
  const r = Q.runRuler({ mode: 'observe', root, version: 'e'.repeat(40), datasetDir: 'D:/DevEnv/Temp/ihui-ruler-proof', env: {}, platform: 'win32', spawnFn: fake })
  assert.equal(r.verdict, 'undetermined', '退 2 必须读成未判定')
  assert.equal(seenEnv.PRIVATE_EVAL_DIR, 'D:/DevEnv/Temp/ihui-ruler-proof')
  const noDir = Q.runRuler({ mode: 'observe', root, version: 'f'.repeat(40), env: {}, platform: 'win32', spawnFn: () => ({ status: 0, stdout: '', stderr: '' }) })
  assert.equal(noDir.verdict, 'ok')
})

test('台账行形状:动作名一一对应、无题面字段、why 限长且不换行', () => {
  assert.equal(Q.buildQualityLedgerRow({ verdict: 'ok', rc: 0 }).action, 'quality-ok')
  assert.equal(Q.buildQualityLedgerRow({ verdict: 'regression', rc: 1 }).action, 'quality-regression')
  assert.equal(Q.buildQualityLedgerRow({ verdict: 'undetermined', rc: 2 }).action, 'quality-undetermined')
  assert.equal(Q.buildQualityLedgerRow({ verdict: 'skipped' }), null, 'skipped 不进台账')
  assert.throws(() => Q.buildQualityLedgerRow({ verdict: 'garbage' }), /未知裁决/)
  const long = Q.buildQualityLedgerRow({ verdict: 'regression', rc: 1, tail: `x\ny${'z'.repeat(400)}`, version: 'b'.repeat(40) })
  assert.ok(long.why.length <= 300, `why 必须限长(防把整段输出塞进台账):${long.why.length}`)
  assert.ok(!long.why.includes('\n'), '台账行必须单行')
  assert.equal(long.rulerVersion.length, 40, '证据指针必须是全量 sha 形态,不得截成短 sha(§1)')
  assert.deepEqual(
    Object.keys(long).sort(),
    ['action', 'mode', 'rc', 'rulerVersion', 'verdict', 'why'],
    `无牌时台账字段集必须固定(多一个字段就可能带进题面):${Object.keys(long).join(',')}`,
  )
  const withHold = Q.buildQualityLedgerRow({ verdict: 'regression', rc: 1, holdUntil: '2026-11-27T00:00:00.000Z' })
  assert.deepEqual(
    Object.keys(withHold).sort(),
    ['action', 'holdUntil', 'mode', 'rc', 'rulerVersion', 'verdict', 'why'],
    '带牌时必须多出且只多出 holdUntil 一枚',
  )
  for (const k of Object.keys(long)) assert.ok(!/candidate|instruction|reference|item_id/.test(k), `台账不得带题面字段:${k}`)
})

test('停派牌三态:未挂 / 在效 / 坏形状与到期都不得当成"停派"', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate328-hold-'))
  try {
    const f = join(dir, 'hold.json')
    assert.equal(Q.readQualityHold(f).held, false)
    assert.equal(Q.readQualityHold(f).undetermined, undefined, '没有牌 ≠ 未判定(那是干净态)')

    const until = Q.writeQualityHold(f, { hours: 5, version: 'c'.repeat(40), verdict: 'regression', tail: 't' })
    const held = Q.readQualityHold(f, Date.parse(until) - 60_000)
    assert.equal(held.held, true)
    assert.match(held.until, /Z/)
    assert.equal(held.version, 'c'.repeat(40))
    assert.deepEqual(JSON.parse(readFileSync(f, 'utf8')).verdict, 'regression')

    const expired = Q.readQualityHold(f, Date.parse(until) + 60_000)
    assert.equal(expired.held, false)
    assert.equal(expired.expired, true, '到期必须自动失效,不靠人记得删')

    writeFileSync(f, '{oops', 'utf8')
    const broken = Q.readQualityHold(f)
    assert.equal(broken.held, false, '牌坏 ⇒ 不停派(否则坏文件锁死整环)')
    assert.equal(broken.undetermined, true, '但必须标未判定,不许读成干净')

    writeFileSync(f, JSON.stringify({ version: 'x' }), 'utf8')
    assert.equal(Q.readQualityHold(f).undetermined, true, '缺 until ⇒ 未判定')
  } finally {
    rmSync(dir, { recursive: true, force: true })
    assert.equal(existsSync(dir), false)
  }
})

test('写牌必须是先 .tmp 再 rename:落盘后目录里不得残留 .tmp,且内容自证', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate328-tmp-'))
  try {
    const f = join(dir, 'hold.json')
    const before = readdirSync(dir)
    assert.equal(before.length, 0, `夹具起始应为空目录,实得:${String(before)}`)
    const until = Q.writeQualityHold(f, { hours: 1, version: 'd'.repeat(40), verdict: 'regression' })
    const after = readdirSync(dir)
    const staleTmp = after.filter((n) => n.endsWith('.tmp'))
    assert.deepEqual(after, ['hold.json'], `目录里只该留下最终牌文件,实得:${String(after)}`)
    assert.equal(staleTmp.length, 0, `不该残留 .tmp:${String(staleTmp)}`)
    const doc = JSON.parse(readFileSync(f, 'utf8'))
    assert.equal(doc.verdict, 'regression')
    assert.equal(doc.version, 'd'.repeat(40))
    assert.equal(doc.hours, 1)
    assert.equal(doc.until, until)
    assert.ok(Date.parse(doc.setAt) <= Date.parse(until), 'setAt 必须早于 until')
  } finally {
    rmSync(dir, { recursive: true, force: true })
    assert.equal(existsSync(dir), false, '夹具必须自清,不在批准 TEMP 落月度死目录山')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
