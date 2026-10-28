// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-50「DevEnv 搬入仓内 .DevEnv」巡检派发臂的镜像测试(§22c:import 源模块的 __test__,零复制判据)。
 *
 * 立因(2026-10-28):器物本体 scripts/devenv-migrate.mjs + 295 行镜像测试都在,而
 * `git grep -n 'devenv|migrate' scripts/git-guardian.mjs` 只命中一条不相干注释 ⇒ 按 §0.9
 * 「造好没装车 = 没有」,票面「探测器找静默窗口自动执行」不成立。本文件钉的是**装车**这件事:
 *  (a) 装车锁:main() 单轮路径与 daemon tick 各一处派发(双执行体并存是本机实况);
 *  (b) 默认关:入库开关面必须 enabled=false;probe-only 档零搬迁动作、零写盘调用;
 *  (c) 窗口未到(pending)/未判定(undetermined)⇒ 一律不搬(§0.3:不把"没判"写成"判过");
 *  (d) 开关开 + window ⇒ 恰好一次 apply,且入参就是同一份 probe 结果(判据单源);
 *  (e) 归属锁:窗口/待做/执行判据只住 devenv-migrate.mjs 那一份实现,guardian 与臂内
 *      都不得长出第二份(§0.6);
 *  (f) 节流:未到窗口 ⇒ 零 probe 零日志(取不到戳 ⇒ 该跑)。
 * 全部构造输入 + 假 io/假 apply ⇒ 零真搬迁、零真 spawn、零生产开关面副作用。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  ARM_CONFIG,
  ARM_TICK,
  GITIGNORE,
  GUARDIAN_LOG,
  LEGACY_ROOT,
  PATROL_INTERVAL_MS,
  SEAL_SCRIPT,
  SESSION_TMP,
  TMP_PROBE,
  __test__ as M,
} from '../devenv-migrate.mjs'

const { devenvArmDue, loadDevenvMigrateArm, devenvMigratePatrol } = M

const HERE = dirname(fileURLToPath(import.meta.url))
const GSRC = readFileSync(join(HERE, '..', 'git-guardian.mjs'), 'utf8')
const MSRC = readFileSync(join(HERE, '..', 'devenv-migrate.mjs'), 'utf8')

const NOW = 1_700_000_000_000
const MIN = 60_000
const DAY = 24 * 3_600_000
const ago = (minutes) => ({ file: { mtimeMs: NOW - minutes * MIN } })

/** 构造面(与 devenv-migrate.test.mjs 同职责、异实现):tree = { [绝对路径]: {dir?,file?,link?,text?,err?} }。 */
function fakeIO(tree) {
  const norm = (p) => String(p).replace(/[\\/]+/g, '\\').replace(/\\+$/, '')
  const T = new Map(Object.entries(tree).map(([k, v]) => [norm(k), v]))
  const get = (p) => T.get(norm(p))
  const fail = (code) => {
    const err = new Error(code)
    err.code = code
    throw err
  }
  const io = {
    writes: [],
    lstatSync(p) {
      const e = get(p)
      if (!e || e.gone) return fail('ENOENT')
      if (e.err) return fail(e.err)
      return {
        isSymbolicLink: () => e.link !== undefined,
        isDirectory: () => e.dir !== undefined,
        mtimeMs: e.file !== undefined ? e.file.mtimeMs : 0,
      }
    },
    readdirSync(p) {
      const e = get(p)
      if (!e || e.dir === undefined) return fail('ENOENT')
      return e.dir
    },
    readFileSync(p) {
      const e = get(p)
      if (e && e.text !== undefined) return e.text
      return fail('ENOENT')
    },
    readlinkSync(p) {
      const e = get(p)
      if (e && e.link !== undefined) return e.link
      return fail('EINVAL')
    },
    writeFileSync(p) {
      io.writes.push(`write:${p}`)
    },
    mkdirSync() {
      io.writes.push('mkdir')
    },
    renameSync() {
      io.writes.push('rename')
    },
    rmSync(p) {
      io.writes.push(`rm:${p}`)
    },
    spawnSync() {
      io.writes.push('spawn')
      return { status: 0, stderr: '' }
    },
  }
  return io
}

/** window 树:判① 旧根 90 分钟静默、判② 两探针静默、守护 2 分钟前 tick。 */
function windowTree({ legacyMin = 90, guardianAgeMin = 2 } = {}) {
  const iso = new Date(NOW - guardianAgeMin * MIN).toISOString()
  return {
    [LEGACY_ROOT]: { dir: ['a'] },
    [`${LEGACY_ROOT}\\a`]: ago(legacyMin),
    [SESSION_TMP]: { dir: ['t'] },
    [`${SESSION_TMP}\\t`]: ago(120),
    [TMP_PROBE]: { dir: ['p'] },
    [`${TMP_PROBE}\\p`]: ago(200),
    [GUARDIAN_LOG]: { text: `[${iso}] tick\n` },
  }
}

/** 每个用例一套 scratch:开关/节流戳都落工作区外(§15b),用完即回收。 */
function fixture({ enabled = false, tickAt = null, configShape = 'json' } = {}) {
  const dir = mkScratch('devenv-migrate-patrol-')
  const configPath = join(dir, 'arm.json')
  const tickFile = join(dir, 'tick.iso')
  if (configShape === 'json') writeFileSync(configPath, JSON.stringify({ enabled }), 'utf8')
  else if (configShape === 'broken') writeFileSync(configPath, '{ 不是 JSON', 'utf8')
  // configShape === 'missing' ⇒ 不写
  if (tickAt !== null) writeFileSync(tickFile, new Date(tickAt).toISOString(), 'utf8')
  const logs = []
  const applies = []
  const run = (over = {}) =>
    devenvMigratePatrol({
      now: NOW,
      intervalMs: DAY,
      tickFile,
      configPath,
      logger: (m) => logs.push(String(m)),
      applyFn: (ioArg, probeArg) => {
        applies.push({ ioArg, probeArg })
        return { refused: false, rows: [{ step: 1, ok: true, note: '构造面' }], verified: true }
      },
      ...over,
    })
  return { dir, configPath, tickFile, logs, applies, run }
}

test('T1 装车锁:main() 单轮路径必须带 !CHECK_ONLY 旗派发本臂(挂进 --check 等于永不执行)', () => {
  assert.match(
    GSRC,
    /import \{ devenvMigratePatrol \} from '\.\/devenv-migrate\.mjs'/,
    'guardian 必须从器物本体 import —— 自建第二份实现即是漂移源头',
  )
  const mainBlock = GSRC.slice(0, GSRC.indexOf('function startDaemon'))
  assert.match(mainBlock, /if \(!CHECK_ONLY\) devenvMigratePatrol\(\{ logger: log \}\)/, 'main() 健康轮次分支里找不到派发点')
  assert.equal(/if \(CHECK_ONLY\) devenvMigratePatrol/.test(GSRC), false, '不得挂进 --check 路径(那是零副作用档)')
})

test('T2 装车锁:daemon tick 也必须有一处(双执行体并存是本机实况),共用同一节流戳', () => {
  const daemonBlock = GSRC.slice(GSRC.indexOf('function startDaemon'))
  assert.match(daemonBlock, /devenvMigratePatrol\(\{ logger: log \}\)/, 'daemon 分支缺派发点 = 另一半执行体永不巡检')
  assert.equal(
    GSRC.split('if (!CHECK_ONLY) devenvMigratePatrol({ logger: log })').length - 1,
    1,
    'main() 侧应恰好一处(多挂会重复留痕)',
  )
  assert.match(ARM_TICK, /[\\/]\.ihui-agent[\\/]state[\\/]devenv-migrate-arm-tick\.iso$/, '节流戳必须落在 state 下唯一一枚')
})

test('T3 默认档锁:入库开关面必须 enabled=false(开臂是机主的决定,不是接线的默认)', () => {
  const raw = JSON.parse(readFileSync(ARM_CONFIG, 'utf8'))
  assert.equal(raw.enabled, false, '默认档必须关;机主核过盘点后自行改 true(改档请连同本钉一起过目)')
  assert.deepEqual(Object.keys(raw), ['enabled'])
})

test('T4 probe-only:开关关 + window ⇒ 只探测不搬,且记录型 io 上零写盘调用', () => {
  const f = fixture({ enabled: false })
  try {
    const io = fakeIO(windowTree())
    const r = f.run({ io })
    assert.equal(r.ran, true)
    assert.equal(r.state, 'window')
    assert.equal(f.applies.length, 0, '合臂却派生了 apply')
    assert.equal(io.writes.length, 0, `probe-only 档出现写调用:${io.writes.join(',')}`)
    assert.equal(f.logs.length, 1, '窗口已到应恰好留一行(不搬的理由要人看得见)')
    assert.match(f.logs[0], /⏸/)
    assert.match(f.logs[0], /enabled=false/)
    assert.match(f.logs[0], /只探测不搬/)
  } finally {
    rmScratch(f.dir)
  }
})

test('T5 窗口未到(pending)⇒ 不搬且静默(常态不刷渠道);判据理由仍如实带在证据里', () => {
  const f = fixture({ enabled: true })
  try {
    const io = fakeIO(windowTree({ legacyMin: 5 }))
    const r = f.run({ io })
    assert.equal(r.state, 'pending')
    assert.equal(f.applies.length, 0, 'pending 却派生了 apply')
    assert.equal(f.logs.length, 0, 'pending 是常态:不得每窗口刷一行')
    assert.equal(io.writes.length, 0)
  } finally {
    rmScratch(f.dir)
  }
})

test('T6 未判定 ⇒ 不搬且显式点名(§0.3:不记绿也不冒红,绝不猜)', () => {
  const f = fixture({ enabled: true })
  try {
    const io = fakeIO(windowTree({ guardianAgeMin: 40 }))
    const r = f.run({ io })
    assert.equal(r.state, 'undetermined')
    assert.equal(r.ok, false)
    assert.equal(f.applies.length, 0, '未判定却派生了 apply')
    assert.equal(f.logs.length, 1)
    assert.match(f.logs[0], /⚠️/)
    assert.match(f.logs[0], /未判定/)
  } finally {
    rmScratch(f.dir)
  }
})

test('T7 开关读不到/坏形 ⇒ 未判定,只探测不搬(不得把"没读到"写成"已关"或"已过")', () => {
  for (const shape of ['missing', 'broken']) {
    const f = fixture({ configShape: shape })
    try {
      const r = f.run({ io: fakeIO(windowTree()) })
      assert.equal(r.state, 'window')
      assert.equal(r.ok, false, `${shape} 形态不得记绿`)
      assert.equal(f.applies.length, 0, `${shape} 形态却派生了 apply`)
      assert.match(f.logs[0], /⚠️ .*开关配置未判定/)
      assert.match(f.logs[0], /只探测不搬/)
    } finally {
      rmScratch(f.dir)
    }
  }
})

test('T8 开关开 + window ⇒ 恰好一次 apply,入参就是同一份 probe 结果(判据单源)', () => {
  const f = fixture({ enabled: true })
  try {
    const r = f.run({ io: fakeIO(windowTree()) })
    assert.equal(f.applies.length, 1, '开臂却零派生或多派生')
    assert.equal(f.applies[0].probeArg.state, 'window', 'apply 必须吃同一份 probe 结果,不得自己重判')
    assert.equal(r.ok, true)
    assert.ok(f.logs.some((l) => l.includes('✅')), '执行完成必须留一行结论')
  } finally {
    rmScratch(f.dir)
  }
})

test('T9 window 但票面六步已无待做 ⇒ 零动作零日志(已搬完是常态结论,不是待办)', () => {
  const f = fixture({ enabled: true })
  try {
    const io = fakeIO({
      [GITIGNORE]: { text: 'node_modules/\n.DevEnv/\n' },
      [SEAL_SCRIPT]: { text: 'return [inRepo]' },
      [SESSION_TMP]: { dir: ['t'] },
      [`${SESSION_TMP}\\t`]: ago(120),
      [TMP_PROBE]: { dir: ['p'] },
      [`${TMP_PROBE}\\p`]: ago(200),
      [GUARDIAN_LOG]: { text: `[${new Date(NOW - 2 * MIN).toISOString()}] tick\n` },
    })
    const r = f.run({ io })
    assert.equal(r.state, 'window')
    assert.equal(r.done, true)
    assert.equal(r.actions, 0)
    assert.equal(f.applies.length, 0)
    assert.equal(f.logs.length, 0)
  } finally {
    rmScratch(f.dir)
  }
})

test('T10 节流:未到窗口 ⇒ 零 probe 零日志零派生;取不到戳一律视为该跑', () => {
  assert.equal(devenvArmDue(NOW, NaN, DAY), true, '没跑过 ⇒ 该跑')
  assert.equal(devenvArmDue(NOW, NOW - 1000, DAY), false)
  assert.equal(devenvArmDue(NOW, NOW - DAY, DAY), true)
  assert.equal(PATROL_INTERVAL_MS, 30 * 60 * 1000, '节流窗口 30 分钟(判据要求旧根静默 ≥60 分钟)')
  const f = fixture({ enabled: true, tickAt: NOW - 1000 })
  try {
    let probed = 0
    const r = f.run({
      probeFn: () => {
        probed++
        return { state: 'window', reasons: [] }
      },
      applyFn: () => {
        throw new Error('节流窗口内不得派生')
      },
    })
    assert.equal(r.ran, false)
    assert.equal(probed, 0, '未到窗口却探了')
    assert.equal(f.logs.length, 0)
  } finally {
    rmScratch(f.dir)
  }
})

test('T11 归属锁:窗口/待做/执行判据只住器物本体 —— guardian 与臂内都不得长出第二份', () => {
  assert.equal(/export function devenvMigratePatrol/.test(GSRC), false, 'guardian 里出现第二份实现')
  assert.equal(/QUIET_MINUTES/.test(GSRC), false, 'guardian 不得自己判静默分钟')
  const body = MSRC.slice(MSRC.indexOf('export function devenvMigratePatrol'), MSRC.indexOf('function selfTest'))
  assert.ok(body.length > 800, '切不到臂函数体(锚点漂了 ⇒ 本条恒真)')
  for (const forbidden of ['QUIET_MINUTES', 'SESSION_IDLE_MINUTES', 'GUARDIAN_FRESH_MINUTES', 'latestWrite(', 'guardianTickAlive(']) {
    assert.equal(body.includes(forbidden), false, `臂内出现判据实现「${forbidden}」:两处各写一份必漂移`)
  }
  assert.match(body, /probeFn\(io, now\)/, '窗口三态只许问 probeQuietWindow')
  assert.match(body, /assessSteps\(io\)/, '待做盘点只许问 assessSteps')
  assert.match(body, /applyFn\(io, probe\)/, '执行只许走 applyMigration')
})

test('T12 开关读取三态(纯注入面):布尔 ⇒ ok;读不到/坏形 ⇒ 未判定', () => {
  assert.deepEqual(loadDevenvMigrateArm({ configPath: 'X:/nope.json', exists: () => false }), {
    ok: false,
    why: '开关配置不在位:X:/nope.json',
  })
  assert.equal(loadDevenvMigrateArm({ configPath: 'X:/c.json', readFile: () => '{"enabled":true}' }).enabled, true)
  assert.equal(loadDevenvMigrateArm({ configPath: 'X:/c.json', readFile: () => '{"enabled":"yes"}' }).ok, false)
  assert.equal(loadDevenvMigrateArm({ configPath: 'X:/c.json', readFile: () => '{ 坏 JSON' }).ok, false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
