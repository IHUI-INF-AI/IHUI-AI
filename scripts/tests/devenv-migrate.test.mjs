// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * devenv-migrate 回归测试(G-50):静默窗口三态判据 + 票面六步盘点 + --apply 前置闸
 * 的构造面正反例(§22c:import 生产判据 __test__,本文件零复制判据;用例数据与
 * devenv-migrate.mjs --self-test 的那组刻意不同形,同判据两棵数据树,漂移即暴露),
 * 外加「默认档零写盘」行为锁与三道形状锁。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  SEAL_SCRIPT,
  SESSION_IDLE_MINUTES,
  SESSION_TMP,
  TMP_PROBE,
  QUIET_MINUTES,
} from '../devenv-migrate.mjs'

const { latestWrite, guardianTickAlive, probeQuietWindow, assessSteps, planSteps, applyMigration } = __test__

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const SRC_PATH = resolve(HERE, '..', 'devenv-migrate.mjs')
const SRC = readFileSync(SRC_PATH, 'utf8')

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
