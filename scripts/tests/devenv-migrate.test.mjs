// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * devenv-migrate 回归测试(G-50):静默窗口三态判据 + 票面六步盘点 + --apply 前置闸
 * 的构造面正反例(§22c:import 生产判据 __test__,本文件零复制判据;用例数据与
 * devenv-migrate.mjs --self-test 的那组刻意不同形,同判据两棵数据树,漂移即暴露),
 * 外加「默认档零写盘」行为锁与三道形状锁。
 * 2026-10-28 追加:巡检派发臂(devenvArmDue / loadDevenvMigrateArm / devenvMigratePatrol)
 * 六面全注入的正反例 + guardian 派发点装车锁 + 三处实现位的变异自证。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

import {
  __test__,
  APPLY_REPLACEMENTS,
  ENUM_BUDGET,
  GITIGNORE,
  GUARDIAN_FRESH_MINUTES,
  GUARDIAN_LOG,
  HARD_CODED_FILES,
  LEGACY_ROOT,
  NEW_ROOT,
  PATROL_INTERVAL_MS,
  SEAL_SCRIPT,
  SESSION_IDLE_MINUTES,
  SESSION_TMP,
  TMP_PROBE,
  QUIET_MINUTES,
} from '../devenv-migrate.mjs'

const { latestWrite, guardianTickAlive, probeQuietWindow, assessSteps, planSteps, applyMigration } = __test__
// 巡检派发臂三函数:判据住本体,本文件只 import(§22c 零复制)。
const { devenvArmDue, loadDevenvMigrateArm, devenvMigratePatrol } = __test__

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const SRC_PATH = resolve(HERE, '..', 'devenv-migrate.mjs')
const SRC = readFileSync(SRC_PATH, 'utf8')
const GUARDIAN_SRC = readFileSync(resolve(REPO_ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')

const MIN = 60000
const NOW = 1_700_000_000_000
const ago = (minutes) => ({ file: { mtimeMs: NOW - minutes * MIN } })

/** 构造面:tree = { [绝对路径]: {dir?:string[], file?:{mtimeMs}, link?:string, text?:string, err?:string} }。
 *  与主脚本 selfTest 的 fakeIO 同职责、异实现(键归一含分隔符),漂移即暴露。 */
function fakeIO(tree) {
  const norm = (p) => String(p).split(/[\\/]+/).join('\\').replace(/\\$/, '')
  const get = (p) => tree[norm(p)]
  const fail = (code) => {
    const err = new Error(code)
    err.code = code
    throw err
  }
  const io = {
    writes: [],
    lstatSync(p) {
      const e = get(p)
      if (!e) return fail('ENOENT')
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

/** 真实常量路径的探测树(键与探测器所问逐字同形)。 */
function probeTree({ legacyMin = 200, tmpMin = 90, probeMin = 200, guardianAgeMin = 2, legacyLink = false } = {}) {
  const iso = new Date(NOW - guardianAgeMin * MIN).toISOString()
  return {
    [LEGACY_ROOT]: legacyLink ? { link: join(NEW_ROOT) } : { dir: ['a'] },
    [`${LEGACY_ROOT}\\a`]: legacyLink ? undefined : ago(legacyMin),
    [SESSION_TMP]: { dir: ['t'] },
    [`${SESSION_TMP}\\t`]: ago(tmpMin),
    [TMP_PROBE]: { dir: ['p'] },
    [`${TMP_PROBE}\\p`]: ago(probeMin),
    [GUARDIAN_LOG]: { text: `[${iso}] tick\n` },
  }
}

const fakeWith = (over) =>
  fakeIO({ [GITIGNORE]: { text: 'node_modules/\n.DevEnv/\n' }, [SEAL_SCRIPT]: { text: 'return [inRepo]' }, ...over })

test('latestWrite:判①阈值两侧各一正例一反例(60 分钟边界)', () => {
  const quiet = latestWrite(fakeIO({ [LEGACY_ROOT]: { dir: ['a'] }, [`${LEGACY_ROOT}\\a`]: ago(QUIET_MINUTES + 1) }), LEGACY_ROOT, NOW)
  assert.equal(quiet.kind, 'ok')
  assert.ok(quiet.quietMinutes >= QUIET_MINUTES)
  const fresh = latestWrite(fakeIO({ [LEGACY_ROOT]: { dir: ['a'] }, [`${LEGACY_ROOT}\\a`]: ago(QUIET_MINUTES - 1) }), LEGACY_ROOT, NOW)
  assert.equal(fresh.kind, 'ok')
  assert.ok(fresh.quietMinutes < QUIET_MINUTES)
})

test('latestWrite:目录不存在 ⇒ absent;junction 本体 ⇒ absent 带 why(不跟随,§26)', () => {
  const absent = latestWrite(fakeIO({}), join(LEGACY_ROOT, 'nope'), NOW)
  assert.equal(absent.kind, 'absent')
  assert.equal(absent.quietMinutes, null)
  const link = latestWrite(fakeIO({ [LEGACY_ROOT]: { link: NEW_ROOT } }), LEGACY_ROOT, NOW)
  assert.equal(link.kind, 'absent')
  assert.equal(link.junctions, 1)
  assert.match(link.why, /重解析点/)
})

test('latestWrite:枚举截断与单条 lstat 失败都 ⇒ undetermined(§0.3,不假静默)', () => {
  const truncIO = fakeIO({ [LEGACY_ROOT]: { dir: ['a'] } })
  truncIO.readdirSync = () => Array.from({ length: ENUM_BUDGET + 1 }, (_, i) => `x${i}`)
  const t = latestWrite(truncIO, LEGACY_ROOT, NOW)
  assert.equal(t.kind, 'undetermined')
  assert.equal(t.truncated, true)
  const u = latestWrite(
    fakeIO({ [LEGACY_ROOT]: { dir: ['good', 'bad'] }, [`${LEGACY_ROOT}\\good`]: ago(999), [`${LEGACY_ROOT}\\bad`]: { err: 'EACCES' } }),
    LEGACY_ROOT,
    NOW,
  )
  assert.equal(u.kind, 'undetermined')
  assert.match(u.why, /EACCES/)
})

test('guardianTickAlive:新鲜 ⇒ alive;超 GUARDIAN_FRESH_MINUTES ⇒ undetermined;读不到/无戳 ⇒ undetermined', () => {
  const freshIso = new Date(NOW - 2 * MIN).toISOString()
  const alive = guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: `前导噪声\n[${freshIso}] 行\n` } }), NOW)
  assert.equal(alive.state, 'alive')
  assert.equal(alive.lastIso, freshIso)
  const stale = guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: `[${new Date(NOW - (GUARDIAN_FRESH_MINUTES + 5) * MIN).toISOString()}] 行\n` } }), NOW)
  assert.equal(stale.state, 'undetermined')
  assert.match(stale.why, /未 tick/)
  assert.equal(guardianTickAlive(fakeIO({}), NOW).state, 'undetermined')
  assert.equal(guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: '散文行没有戳' } }), NOW).state, 'undetermined')
})

test('probeQuietWindow:window 三态正向(旧根已是链接也认静默)', () => {
  const r = probeQuietWindow(fakeIO(probeTree()), NOW)
  assert.equal(r.state, 'window')
  assert.ok(r.reasons.some((s) => s.includes('守护存活')))
  const asLink = probeQuietWindow(fakeIO(probeTree({ legacyLink: true })), NOW)
  assert.equal(asLink.state, 'window')
})

test('probeQuietWindow:pending 反例(判①/判②各自点名)', () => {
  const r1 = probeQuietWindow(fakeIO(probeTree({ legacyMin: QUIET_MINUTES - 5 })), NOW)
  assert.equal(r1.state, 'pending')
  assert.ok(r1.reasons.some((s) => s.includes('判①')), r1.reasons.join(';'))
  const r2 = probeQuietWindow(fakeIO(probeTree({ tmpMin: SESSION_IDLE_MINUTES - 5 })), NOW)
  assert.equal(r2.state, 'pending')
  assert.ok(r2.reasons.some((s) => s.includes('判②')), r2.reasons.join(';'))
})

test('probeQuietWindow:守护留痕过期 ⇒ undetermined(优先于 window/pending,§0.3)', () => {
  const r = probeQuietWindow(fakeIO(probeTree({ guardianAgeMin: GUARDIAN_FRESH_MINUTES + 25 })), NOW)
  assert.equal(r.state, 'undetermined')
})

test('assessSteps:S3 活代码命中 ⇒ todo,纯注释命中 ⇒ done(证据保留口径)', () => {
  const codeHit = assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: "x = ['G:\\\\DevEnv\\\\secrets']\n" } })).find((s) => s.id === 3)
  assert.equal(codeHit.state, 'todo')
  assert.match(codeHit.evidence, /活代码 1/)
  const commentHit = assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: '/* G:/DevEnv 旧叙述 */\n' } })).find((s) => s.id === 3)
  assert.equal(commentHit.state, 'done')
  assert.match(commentHit.evidence, /注释 1/)
})

test('assessSteps:S4 命中带行号 / S6 双根在役 ⇒ todo、摘除 ⇒ done / 六步齐且 S5 恒 apply-gate', () => {
  const s4 = assessSteps(fakeWith({ [GITIGNORE]: { text: 'a\nb\n.DevEnv/\n' } })).find((s) => s.id === 4)
  assert.equal(s4.state, 'done')
  assert.match(s4.evidence, /:3 = \.DevEnv\//)
  const s6todo = assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: '? [inRepo] : [inRepo, legacy]' } })).find((s) => s.id === 6)
  assert.equal(s6todo.state, 'todo')
  const all = assessSteps(fakeWith())
  assert.equal(all.map((s) => s.id).join(','), '1,2,3,4,5,6')
  assert.equal(all.find((s) => s.id === 5).state, 'apply-gate')
})

test('HARD_CODED_FILES = 8(5 脚本 + 3 复核位)且逐个真实存在;APPLY_REPLACEMENTS 只涉活代码面', () => {
  assert.equal(HARD_CODED_FILES.length, 8)
  for (const rel of HARD_CODED_FILES) assert.ok(existsSync(join(REPO_ROOT, rel)), `清单文件不存在:${rel}`)
  assert.ok(APPLY_REPLACEMENTS.every((s) => HARD_CODED_FILES.includes(s.file)))
  // 替换靶必须逐字在位(否则 apply 步骤 3 恒失败):计数现读
  for (const spec of APPLY_REPLACEMENTS) {
    const text = readFileSync(join(REPO_ROOT, spec.file), 'utf8')
    for (const ed of spec.edits) assert.equal(text.split(ed.from).length - 1, ed.expect, `${spec.file} 替换靶漂移`)
  }
})

test('默认档(probe+assess+plan)零写盘:行为锁 —— 记录型 io 上 write 族调用为零', () => {
  const io = fakeIO(probeTree())
  const probe = probeQuietWindow(io, NOW)
  const assessed = assessSteps(io)
  const lines = planSteps(assessed, probe)
  assert.equal(io.writes.length, 0, `出现写调用:${io.writes.join(',')}`)
  assert.ok(lines.length > 0)
})

test('apply 前置闸:pending / undetermined 一律 refused 且零写调用(本轮绝不真搬迁的机器保证)', () => {
  const io = fakeIO(probeTree({ legacyMin: 1 }))
  for (const state of ['pending', 'undetermined']) {
    const r = applyMigration(io, { state, reasons: ['构造面注入'] })
    assert.equal(r.refused, true)
    assert.match(r.reason, /拒绝执行/)
  }
  assert.equal(io.writes.length, 0)
})

test('形状锁(默认档零写盘的静态半边):io 写族调用只许在 applyMigration 起至 selfTest 前的区间', () => {
  const applyStart = SRC.indexOf('export function applyMigration')
  const selfStart = SRC.indexOf('function selfTest')
  assert.ok(applyStart > 0 && selfStart > applyStart, '函数锚点丢失')
  const writeCall = /io\.(writeFileSync|mkdirSync|renameSync|rmSync)\(/
  assert.doesNotMatch(SRC.slice(0, applyStart), writeCall, 'apply 区间之前出现 io 写调用')
  assert.doesNotMatch(SRC.slice(selfStart), writeCall, 'selfTest 起的区间出现 io 写调用')
  assert.match(SRC.slice(applyStart, selfStart), writeCall, 'apply 区间内应确有写面(锁的是位置,不是存在性)')
})

test('形状锁:isDirectRun 双形态在位(§22d 模板逐字)', () => {
  assert.match(SRC, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(SRC, /if \(isDirectRun\) \{\s*main\(\)\.catch/)
})

test('形状锁:--apply 六步顺序 1→6 编码且递增(顺序不可换的静态半边)', () => {
  const body = SRC.slice(SRC.indexOf('export function applyMigration'), SRC.indexOf('function safeReaddir'))
  const at = [1, 2, 3, 4, 5, 6].map((n) => body.indexOf(`step: ${n},`))
  assert.ok(at.every((v) => v > 0), `步骤标记缺失:${at.join(',')}`)
  for (let i = 1; i < at.length; i++) assert.ok(at[i] > at[i - 1], '步骤顺序错乱')
})

test('形状锁:受控编辑必经水印三段(clean → 写回 → inject,§5c)且派生显式 stdio + windowsHide(§12g)', () => {
  const body = SRC.slice(SRC.indexOf('function controlledEdit'), SRC.indexOf('function ensureGitignoreEntry'))
  const atClean = body.indexOf("wm('clean')")
  const atWrite = body.indexOf('io.writeFileSync(filePath, next')
  const atInj = body.indexOf("wm('inject')")
  assert.ok(atClean > 0 && atWrite > atClean && atInj > atWrite, '水印三段顺序缺失')
  // windowsHide:逐个 spawnSync( 调用点就近检查。不得用 /spawnSync\([^)]*\)/ 判 ——
  // 实参里嵌套调用(join(ROOT, …))会让第一个 ) 提前闭合,正则看不全选项对象(实测误报)。
  // fakeIO 等构造面的空参 stub(spawnSync() {)不是真派生,排除。
  let idx = 0
  let calls = 0
  let allHide = true
  while ((idx = SRC.indexOf('spawnSync(', idx)) !== -1) {
    const afterOpen = SRC.slice(idx + 'spawnSync('.length, idx + 'spawnSync('.length + 1)
    if (afterOpen === ')') {
      idx += 10
      continue
    }
    calls++
    if (!SRC.slice(idx, idx + 400).includes('windowsHide: true')) allHide = false
    idx += 10
  }
  assert.ok(calls >= 3, `spawnSync 真调用点数异常:${calls}`)
  assert.ok(allHide, '存在未带 windowsHide: true 的 spawnSync 调用点')
  assert.doesNotMatch(SRC, /stdio:\s*['"]ignore['"]\s*[,}]/, 'spawnSync stdio 不得省略 stdout/stderr 管道')
})

test('真实机器端到端(只读自证):默认档在真 fs 上六步齐、证据非空、三态合法', () => {
  const probe = probeQuietWindow(__test__.defaultIO())
  assert.ok(['window', 'pending', 'undetermined'].includes(probe.state), `非法三态:${probe.state}`)
  assert.ok(probe.reasons.length > 0, '三态必须点名理由(§0.3)')
  const assessed = assessSteps(__test__.defaultIO())
  assert.equal(assessed.length, 6)
  for (const s of assessed) assert.ok(s.evidence.length > 0, `步骤${s.id} 证据为空`)
})

/**
 * ══ 巡检派发臂(git-guardian 挂点,2026-10-28 接线)══
 * 与 scripts/tests/devenv-migrate-patrol.test.mjs 的分工:那份用真 fs(scratch 落开关与节流戳)
 * + 真 probeQuietWindow 取证「装车 + 三态分流」;本区**七面全注入**(io / probeFn / applyFn /
 * readFile / exists / mkdir / writeTick)。同一判据两棵数据树(本文件头注的 §22c 惯例):注入面
 * 哪天被改成偷偷读真 fs,那份仍绿、本区即红。断言体抽成 assert*(mod) 后,生产模块与变异副本
 * 跑的是同一份断言 ⇒ 变异自证不靠口头保证。
 */
const DAY_MS = 24 * 3600_000
/** 假路径落两层以下(不写盘根一级形态,免被门 213 的「盘根写」静态判据误读)。 */
const ARM_TICK_FAKE = join('X:', 'ihui-mirror-fixture', 'devenv-migrate-arm-tick.iso')
const ARM_CONFIG_FAKE = join('X:', 'ihui-mirror-fixture', 'devenv-migrate-arm.json')
const REAL_ARM = { patrol: devenvMigratePatrol, applyMigration }

function enoent() {
  const err = new Error('ENOENT')
  err.code = 'ENOENT'
  throw err
}

/** 派发臂注入台:run() 返回臂的结论,seen 里是六个观察口;零真 fs、零真搬迁。 */
function armHarness(mod, opts = {}) {
  const {
    config = '{"enabled": false}',
    tick,
    exists = true,
    probeState = 'window',
    ...injected // applyFn / probeFn / logger 等逐例覆盖项,原样透给臂
  } = opts
  const io = fakeIO({})
  const seen = { logs: [], applies: [], probes: [], ticks: [], dirs: [] }
  const run = (over = {}) =>
    mod.patrol({
      now: NOW,
      intervalMs: DAY_MS,
      tickFile: ARM_TICK_FAKE,
      configPath: ARM_CONFIG_FAKE,
      io,
      logger: (m) => seen.logs.push(String(m)),
      probeFn: () => {
        seen.probes.push(1)
        return { state: probeState, reasons: ['构造面注入'] }
      },
      applyFn: (ioArg, probeArg) => {
        seen.applies.push(probeArg.state)
        return { refused: false, rows: [{ step: 1, ok: true, note: '构造面' }], verified: true }
      },
      readFile: (p) =>
        String(p) === ARM_TICK_FAKE ? (tick === undefined ? enoent() : tick) : config,
      exists: () => exists,
      mkdir: (p) => seen.dirs.push(p),
      writeTick: (p, c) => seen.ticks.push([p, c]),
      ...injected,
      ...over,
    })
  return { io, seen, run }
}

/** 断言体①:arm 关 ⇒ 绝不搬(探还是要探,执行体一次都不派生,且零写调用)。 */
function assertArmOffNeverMoves(mod) {
  const h = armHarness(mod, { config: '{"enabled": false}' })
  const r = h.run()
  assert.equal(r.ran, true)
  assert.equal(r.state, 'window')
  assert.equal(h.seen.probes.length, 1, '只探测档也必须真探一次(探测不是搬迁动作)')
  assert.equal(h.seen.applies.length, 0, 'arm 关却派生了执行体')
  assert.equal(h.io.writes.length, 0, `只探测档出现写调用:${h.io.writes.join(',')}`)
  assert.equal(h.seen.logs.length, 1, '不搬的理由必须看得见(静默吞掉=没人知道自己被跳过)')
  assert.match(h.seen.logs[0], /⏸/)
  assert.match(h.seen.logs[0], /enabled=false/)
  assert.match(h.seen.logs[0], /只探测不搬/)
}

/** 断言体②:未到节流窗口 ⇒ 连 probe 都不做,更不写戳。 */
function assertThrottleBlocksProbe(mod) {
  const h = armHarness(mod, {
    config: '{"enabled": true}',
    tick: new Date(NOW - 1000).toISOString(),
  })
  const r = h.run()
  assert.equal(r.ran, false, '未到窗口却跑了')
  assert.equal(h.seen.probes.length, 0, '未到节流窗口却探了(节流的意义就是别再读盘)')
  assert.equal(h.seen.applies.length, 0)
  assert.equal(h.seen.logs.length, 0, '未到窗口不得留痕(每 2 分钟一轮会刷爆通道)')
  assert.equal(h.seen.ticks.length, 0, '未到窗口却重写了节流戳 ⇒ 节流被永久顶后,等于停摆')
}

/** 断言体③:开关取不到/坏形 ⇒ 未判定,不搬且不记成功(不把"没判"写成"已关"或"已过")。 */
function assertUnjudgedArmNeverGreen(mod) {
  const cases = [
    ['不在位', { config: '{"enabled": true}', exists: false }],
    ['坏 JSON', { config: '{ 不是 JSON' }],
    ['空文件', { config: '' }],
    ['缺 enabled 键', { config: '{}' }],
    ['enabled 非布尔', { config: '{"enabled":"yes"}' }],
    ['根不是对象', { config: 'true' }],
  ]
  for (const [label, opts] of cases) {
    const h = armHarness(mod, opts)
    const r = h.run()
    assert.notEqual(r.ok, true, `${label}:未判定不得记绿(§0.3)`)
    assert.equal(h.seen.applies.length, 0, `${label}:未判定却派生了执行体`)
    assert.equal(h.io.writes.length, 0, `${label}:未判定档出现写调用`)
    assert.equal(h.seen.logs.length, 1, `${label}:未判定必须点名(安静失效是本仓最高频型)`)
    assert.match(h.seen.logs[0], /⚠️/)
    assert.match(h.seen.logs[0], /只探测不搬/)
  }
}

test('派发臂 arm 关 ⇒ 绝不搬:执行体零派生 + 记录型 io 零写调用 + 恰好一行 ⏸ 留痕', () => {
  assertArmOffNeverMoves(REAL_ARM)
})

test('派发臂 节流未到 ⇒ 零 probe 零 apply 零留痕零写戳', () => {
  assertThrottleBlocksProbe(REAL_ARM)
})

test('派发臂 开关取不到/坏形 ⇒ 不搬且不记成功(未判定既不是"已关"也不是"已过")', () => {
  assertUnjudgedArmNeverGreen(REAL_ARM)
})

test('派发臂 arm 开但静默窗口未到:pending ⇒ 不搬且静默;undetermined ⇒ 不搬且点名', () => {
  const p = armHarness(REAL_ARM, { config: '{"enabled": true}', probeState: 'pending' })
  const rp = p.run()
  assert.equal(rp.state, 'pending')
  assert.equal(rp.actions, 0)
  assert.equal(p.seen.applies.length, 0, 'pending 却派生了执行体')
  assert.equal(p.seen.logs.length, 0, 'pending 是常态,不得每轮刷留痕')
  assert.equal(p.io.writes.length, 0)
  const u = armHarness(REAL_ARM, { config: '{"enabled": true}', probeState: 'undetermined' })
  const ru = u.run()
  assert.equal(ru.state, 'undetermined')
  assert.equal(ru.ok, false, '未判定不得记绿')
  assert.equal(u.seen.applies.length, 0, '未判定却派生了执行体')
  assert.equal(u.seen.logs.length, 1)
  assert.match(u.seen.logs[0], /未判定/)
  assert.match(u.seen.logs[0], /构造面注入/, '未判定的理由必须原样带出')
})

test('devenvArmDue 节流口径:间隔内 false / 恰等与过间隔 true(实现用 >=),缺省间隔取 PATROL_INTERVAL_MS', () => {
  assert.equal(devenvArmDue(NOW, NOW - 1000, DAY_MS), false, '间隔内必须不跑')
  assert.equal(devenvArmDue(NOW, NOW - DAY_MS + 1, DAY_MS), false, '差 1ms 仍算间隔内')
  assert.equal(devenvArmDue(NOW, NOW - DAY_MS, DAY_MS), true, '恰等间隔即该跑(>= 而非 >)')
  assert.equal(devenvArmDue(NOW, NOW - DAY_MS - 1, DAY_MS), true, '过间隔必须该跑')
  assert.equal(
    devenvArmDue(NOW + PATROL_INTERVAL_MS, NOW),
    true,
    '第三参缺省必须落在 PATROL_INTERVAL_MS(摘掉默认值 ⇒ NaN 比较恒 false,本条翻红)',
  )
})

test('devenvArmDue 输入形态:戳取不到/形态坏 ⇒ 一律判"该跑";未来戳按实现口径为 false', () => {
  for (const bad of [NaN, undefined, null, Infinity, -Infinity, '1700000000000', {}, []]) {
    assert.equal(
      devenvArmDue(NOW, bad, DAY_MS),
      true,
      `形态「${String(bad)}」必须判该跑(失效方向=多探一次,绝不让本臂失明)`,
    )
  }
  assert.equal(
    devenvArmDue(NOW, NOW + DAY_MS, DAY_MS),
    false,
    '时钟回拨/未来戳 ⇒ 实现如实读作"不跑",等到墙钟追上为止(本条钉的是口径,不是偏好)',
  )
})

test('loadDevenvMigrateArm:只有明写 enabled 布尔才算判过,其余形态一律未判定', () => {
  const rd = (text, exists = true) =>
    loadDevenvMigrateArm({
      configPath: ARM_CONFIG_FAKE,
      readFile: () => text,
      exists: () => exists,
    })
  assert.deepEqual(rd('{"enabled":true}'), { ok: true, enabled: true })
  assert.deepEqual(rd('{"enabled":false}'), { ok: true, enabled: false })
  for (const text of [
    '{}',
    '{"enabled":"true"}',
    '{"enabled":1}',
    'null',
    'true',
    '[]',
    '',
    '{ 坏',
  ]) {
    assert.equal(rd(text).ok, false, `坏形「${text}」不得判过`)
  }
  const absent = loadDevenvMigrateArm({ configPath: ARM_CONFIG_FAKE, exists: () => false })
  assert.equal(absent.ok, false)
  assert.match(absent.why, /不在位/)
  const boom = loadDevenvMigrateArm({
    configPath: ARM_CONFIG_FAKE,
    exists: () => true,
    readFile: () => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
    },
  })
  assert.equal(boom.ok, false, 'readFile 抛错不得被当成"已关"')
  assert.match(boom.why, /不可解析/)
})

test('派发臂 本轮该跑 ⇒ 先落节流戳再探;戳形态坏也照样重落(下轮即回到节流)', () => {
  const h = armHarness(REAL_ARM, { config: '{"enabled": false}', tick: '散文不是时刻' })
  const r = h.run()
  assert.equal(r.ran, true, '戳不可解析 ⇒ 判该跑(不失明)')
  assert.equal(h.seen.probes.length, 1)
  assert.deepEqual(
    h.seen.ticks,
    [[ARM_TICK_FAKE, new Date(NOW).toISOString()]],
    '戳必须重写成本轮时刻',
  )
  assert.deepEqual(h.seen.dirs, [dirname(ARM_TICK_FAKE)], '写戳前先建目录')
  const noTick = armHarness(REAL_ARM, { config: '{"enabled": false}' })
  assert.equal(noTick.run().ran, true, '没跑过(戳读不到)⇒ 该跑,与 archiveGcArmDue 同一条失效方向')
  assert.equal(noTick.seen.ticks.length, 1)
})

test('派发臂 probe 三态之外的构造态 ⇒ 生产执行体前置闸先拒,臂把拒绝如实报成不 OK', () => {
  const io = fakeIO({})
  const gate = applyMigration(io, { state: 'windowish', reasons: ['构造面注入'] })
  assert.equal(gate.refused, true, '执行体自己的前置闸必须拦住非 window 态')
  assert.equal(io.writes.length, 0, '拒绝档零写调用')
  const h = armHarness(REAL_ARM, {
    config: '{"enabled": true}',
    probeState: 'windowish',
    applyFn: (ioArg, probeArg) => ({
      refused: true,
      reason: `静默窗口判 ${probeArg.state},拒绝执行(构造面)`,
      rows: [],
      verified: false,
    }),
  })
  const r = h.run()
  assert.equal(r.ok, false, 'apply 被拒却记绿 = 假账')
  assert.equal(r.actions, 0)
  assert.equal(h.seen.logs.length, 1)
  assert.match(h.seen.logs[0], /apply 前置闸拒绝/)
})

test('装车锁:guardian 面上 main 单轮与 daemon tick 各有一处真调用(摘掉即翻红)', () => {
  assert.match(GUARDIAN_SRC, /import \{ devenvMigratePatrol \} from '\.\/devenv-migrate\.mjs'/)
  const calls = (text) => (text.match(/devenvMigratePatrol\(\{ logger: log \}\)/g) || []).length
  const total = calls(GUARDIAN_SRC)
  const daemonAt = GUARDIAN_SRC.indexOf('function startDaemon')
  assert.ok(daemonAt > 0, 'daemon 锚点丢失 ⇒ 下面两块切分恒真')
  assert.ok(calls(GUARDIAN_SRC.slice(0, daemonAt)) >= 1, 'main() 单轮路径缺派发点')
  assert.ok(calls(GUARDIAN_SRC.slice(daemonAt)) >= 1, 'daemon tick 缺派发点 = 另一半执行体永不巡检')
  assert.equal(
    /if \(CHECK_ONLY\) devenvMigratePatrol/.test(GUARDIAN_SRC),
    false,
    '不得挂进 --check 零副作用档',
  )
  // 阳性对照:内存里逐处摘掉,同一把尺子必须读出更少(否则这条锁恒真 = 没牙)
  const woMain = GUARDIAN_SRC.replace('if (!CHECK_ONLY) devenvMigratePatrol({ logger: log })', '')
  assert.equal(calls(woMain), total - 1, '摘掉一处而读数不掉 ⇒ 本锁对缺失不敏感')
  assert.equal(calls(GUARDIAN_SRC.replace(/devenvMigratePatrol\(\{ logger: log \}\)/g, '')), 0)
})

test('形状锁:三处派发臂函数都在 __test__ 出口(镜像测试 import 生产判据,§22c)', () => {
  for (const key of ['devenvArmDue', 'loadDevenvMigrateArm', 'devenvMigratePatrol']) {
    assert.equal(
      typeof __test__[key],
      'function',
      `__test__ 缺出口 ${key} ⇒ 镜像测试打不到生产判据`,
    )
  }
  assert.equal(
    /export function devenvMigratePatrol/.test(GUARDIAN_SRC),
    false,
    'guardian 里长出第二份实现',
  )
})

/** 变异副本的依赖 stub:本体只 import 这三枚,而派发臂一条都不触达(触达即说明注入面漏了)。 */
const MUTANT_STUBS = [
  [
    join('scripts', 'lib', 'scratch-dir.mjs'),
    'export const mkScratch = () => {\n  throw new Error("变异副本不建真 scratch")\n}\nexport const rmScratch = () => {}\n',
  ],
  [
    join('scripts', 're-home-junctions.mjs'),
    'export const plan = () => {\n  throw new Error("变异副本不盘根")\n}\nexport const repairOne = () => {\n  throw new Error("变异副本不搬迁")\n}\n',
  ],
  [
    join('scripts', 'lib', 'selftest-registrant.mjs'),
    'export function makeRegistrar() {\n  return { t: () => {}, report: () => ({ pass: 0, fail: 0 }) }\n}\n',
  ],
]

const MUTATIONS = [
  {
    name: '把 enabled=false 早退摘掉(arm 缺省当 true 处理)',
    anchor: '  if (!arm.enabled) {',
    to: '  if (false && !arm.enabled) {',
    flips: assertArmOffNeverMoves,
  },
  {
    name: '摘掉节流早退',
    anchor:
      "  if (!devenvArmDue(now, lastTick, intervalMs)) return { ran: false, actions: 0, why: '未到节流窗口' }",
    to: '',
    flips: assertThrottleBlocksProbe,
  },
  {
    name: '开关坏形当"已关"记绿',
    anchor: `    return { ok: false, why: '开关配置形状不对(需 {"enabled": true|false})' }`,
    to: '    return { ok: true, enabled: false }',
    flips: assertUnjudgedArmNeverGreen,
  },
]

/** 把本体拷进工作区外 scratch 并改坏一处,返回**变异模块**的臂出口(生产文件零改动)。 */
async function loadMutantArm(mutation) {
  const dir = mkScratch('devenv-migrate-arm-mutant-')
  try {
    const text = readFileSync(SRC_PATH, 'utf8')
    assert.equal(text.split(mutation.anchor).length - 1, 1, `变异锚点非唯一:${mutation.name}`)
    const out = text.replace(mutation.anchor, mutation.to)
    assert.notEqual(out, text, `变异没落到实处:${mutation.name} = 等于没测`)
    for (const [rel, body] of MUTANT_STUBS) {
      const p = join(dir, rel)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, body, 'utf8')
    }
    const target = join(dir, 'scripts', 'devenv-migrate.mjs')
    writeFileSync(target, out, 'utf8')
    const mod = await import(pathToFileURL(target).href)
    return { patrol: mod.__test__.devenvMigratePatrol, applyMigration: mod.__test__.applyMigration }
  } finally {
    rmScratch(dir)
  }
}

test('变异自证:三处实现位各摘一次,对应断言体必须翻红(scratch 变异副本,不碰生产文件)', async () => {
  for (const mutation of MUTATIONS) {
    const arm = await loadMutantArm(mutation)
    assert.throws(
      () => mutation.flips(arm),
      undefined,
      `变异「${mutation.name}」没让断言翻红 ⇒ 那条断言恒真(等于没测)`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
