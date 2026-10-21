#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回收站存续策略器 —— 把「删除不再落回收站」从无人维护的机器态,变成有出处、可复验、能自愈的资产。
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)

const PURGE = await import(pathToFileURL(join(ROOT, 'scripts', 'recycle-junk-purge.mjs')).href)
const SCRATCH = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'scratch-dir.mjs')).href)

const BITBUCKET = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\BitBucket\\Volume'
const NUKE = 1

// 卷 GUID 只认 mountvol 的装入点回显。Win32_Volume 的枚举顺序与键名顺序不同形
// (2026-10-21 实测:CIM 表把 C/D 读反了两卷),按它写判据就会把策略贴到错的卷上。
export function parseMountvol(text) {
  const out = []
  const lines = String(text).split(/\r?\n/)
  let cur = null
  for (const raw of lines) {
    const line = raw.replace(/^﻿/, '')
    const guid = /^(\s*)\\\\\?\\Volume\{([0-9a-fA-F-]+)\}\\(.*)$/.exec(line)
    if (guid) {
      cur = { guid: guid[2].toLowerCase(), mounts: [] }
      out.push(cur)
      continue
    }
    if (cur && /^\s+\S/.test(line)) {
      for (const m of line.trim().split(/\s+/)) cur.mounts.push(m.trim())
    }
  }
  return out
}

export function driveOf(mounts) {
  const hit = (mounts || []).find((m) => /^[A-Za-z]:\\$/.test(m))
  return hit ? hit[0].toUpperCase() + ':' : null
}

export function parseRegValues(text) {
  const vals = {}
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s+(\S+)\s+REG_(\w+)\s+(.+?)\s*$/.exec(line)
    if (m) vals[m[1]] = { type: m[2], raw: m[3] }
  }
  return vals
}

function reg(args) {
  try {
    return { ok: true, text: execFileSync('reg.exe', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }) }
  } catch (e) {
    const err = String(e.stderr || e.message || '')
    const missing = e.status === 1 || /REGDB|unable to find|找不到/i.test(err)
    return { ok: false, missing, error: err.trim().split(/\r?\n/).pop() || 'reg.exe failed' }
  }
}

export function readVolumePolicy(guid) {
  const r = reg(['query', `${BITBUCKET}\\{${guid}}`])
  if (!r.ok) return { guid, present: false, missingKey: !!r.missing, error: r.ok ? null : r.error }
  const vals = parseRegValues(r.text)
  const nuke = vals.NukeOnDelete ? Number.parseInt(String(vals.NukeOnDelete.raw), 16) : null
  return {
    guid,
    present: true,
    nukeOnDelete: nuke === null ? null : nuke,
    maxCapacity: vals.MaxCapacity ? vals.MaxCapacity.raw : null,
    keys: Object.keys(vals),
  }
}

export function writeVolumePolicy(guid, value) {
  const r = reg(['add', `${BITBUCKET}\\{${guid}}`, '/v', 'NukeOnDelete', '/t', 'REG_DWORD', '/d', String(value), '/f'])
  return { ok: r.ok, error: r.ok ? null : r.error }
}

function fixedVolumes() {
  let text
  try {
    text = execFileSync('mountvol.exe', [], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })
  } catch (e) {
    return { error: 'mountvol failed: ' + String(e.message || e) }
  }
  const vols = parseMountvol(text)
    .map((v) => ({ ...v, drive: driveOf(v.mounts) }))
    .filter((v) => v.drive)
  return { vols }
}

const GENIE_CANDIDATES = [
  process.env.IHUI_GENIE_TRASH,
  'D:/software/WorkBuddy/resources/vendor/genie-trash/win32-x64.exe',
  'C:/Program Files/WorkBuddy/resources/vendor/genie-trash/win32-x64.exe',
].filter(Boolean)

export function findGenieTrash() {
  for (const p of GENIE_CANDIDATES) {
    if (existsSync(p)) return { path: p, via: p === process.env.IHUI_GENIE_TRASH ? 'env:IHUI_GENIE_TRASH' : 'candidate' }
  }
  return null
}

function listBin() {
  const sid = PURGE.readMySid()
  if (!sid) return { error: 'UNDETERMINED: 读不到当前进程 SID' }
  const { dirs } = PURGE.listBinDirs(['C:', 'D:'], sid)
  if (dirs.length === 0) return { error: 'UNDETERMINED: 本 SID 名下没有回收站目录' }
  return { sid, dirs }
}

function nonce() {
  return 'rbpol' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// 观测面有没有牙,不能靠"扫到 0 就是干净"。臂 B 用显式可撤销删除请求造一条真条目,
// 它落地即证明 A 臂的 0 是策略挡住的、不是尺子瞎的;它不落地则是更强的结论(连显式请求也被核掉)。
function pollBin(dirs, tag, seconds) {
  const deadline = Date.now() + seconds * 1000
  let seen = []
  let total = 0
  while (Date.now() < deadline) {
    const s = PURGE.scanBinDirs(dirs)
    total = s.items.length
    const hits = s.items.filter((i) => String(i.originalPath).includes(tag))
    if (hits.length > 0) seen = hits
    if (seen.length > 0) break
  }
  return { total, hits: seen.map((h) => ({ p: h.originalPath, rule: h.rule || 'KEEP' })) }
}

function armGenie(dirs, tag, secs) {
  const g = findGenieTrash()
  if (!g) return { arm: 'A-genie-trash', state: 'undetermined', why: '找不到 genie-trash 可执行件,无从证明攻击路径已被挡住(不冒绿)' }
  const scratch = SCRATCH.mkScratch('rbpol-verify')
  const file = join(scratch, tag + '.txt')
  try {
    writeFileSync(file, 'probe')
    let spawnErr = null
    try {
      execFileSync(g.path, [file], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 })
    } catch (e) {
      spawnErr = String(e.stderr || e.message).trim().split(/\r?\n/)[0]
    }
    const gone = !existsSync(file)
    const poll = pollBin(dirs, tag, secs)
    if (spawnErr && gone) spawnErr = null
    if (spawnErr) return { arm: 'A-genie-trash', state: 'undetermined', why: '调用失败且文件仍在:' + spawnErr, exe: g.path, via: g.via }
    return {
      arm: 'A-genie-trash',
      state: poll.hits.length === 0 && gone ? 'pass' : 'fail',
      gone,
      landed: poll.hits,
      binTotal: poll.total,
      exe: g.path,
      via: g.via,
    }
  } finally {
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 3 })
    } catch {}
  }
}

function armExplicitUndo(dirs, tag, secs) {
  const scratch = SCRATCH.mkScratch('rbpol-ctrl')
  const file = join(scratch, tag + '.txt')
  try {
    writeFileSync(file, 'probe')
    const ps =
      "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:RBPROBE_FILE,'OnlyErrorDialogs','SendToRecycleBin'); if (Test-Path -LiteralPath $env:RBPROBE_FILE) { exit 9 }"
    let err = null
    try {
      execFileSync('pwsh.exe', ['-NoProfile', '-Command', ps], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 90000,
        env: { ...process.env, RBPROBE_FILE: file },
      })
    } catch (e) {
      err = String(e.stderr || e.message).trim().split(/\r?\n/)[0]
    }
    const gone = !existsSync(file)
    const poll = pollBin(dirs, tag, secs)
    return {
      arm: 'B-explicit-undo',
      state: err && !gone ? 'undetermined' : poll.hits.length > 0 ? 'landed' : 'nuked',
      gone,
      landed: poll.hits,
      binTotal: poll.total,
      error: err,
    }
  } finally {
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 3 })
    } catch {}
  }
}

/**
 * 状态判定抽成纯函数,一是给自检当夹具面,二是因为"枚举到 0 个卷"绝不能读成"都设好了"。
 * §0.3:取不到输入 ⇒ 显式未判定;这里连"量到 0 个候选"也一并归未判定 —— mountvol 权限受限、
 * 输出形态变化、或本进程看不到装载卷时,rows 会空;空集上 missing=0 ∧ off=0,按上一版会判
 * ok(2 卷全部在位)那种绿,是自我宣称的健康。
 */
export function judgeVolumes(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: 'undetermined', code: 2, missing: [], off: [], readFailed: [], why: '枚举到 0 个有盘符的卷 ⇒ 无从判定,不记绿也不冒红' }
  }
  const readFailed = rows.filter((r) => !r.present && !r.missingKey)
  if (readFailed.length > 0) {
    return {
      status: 'undetermined',
      code: 2,
      missing: rows.filter((r) => !r.present && r.missingKey),
      off: [],
      readFailed,
      why: readFailed.map((r) => `${r.drive}:读取策略键失败(${r.error || '未知'})`).join(' / '),
    }
  }
  const missing = rows.filter((r) => !r.present)
  const off = rows.filter((r) => r.present && r.nukeOnDelete !== NUKE)
  const breach = missing.length > 0 || off.length > 0
  return { status: breach ? 'breach' : 'ok', code: breach ? 1 : 0, missing, off, readFailed: [] }
}

async function cmdCheck(json) {
  const fv = fixedVolumes()
  if (fv.error) {
    if (json) process.stdout.write(JSON.stringify({ status: 'undetermined', error: fv.error }) + '\n')
    else process.stderr.write('x ' + fv.error + '\n')
    return 2
  }
  const rows = fv.vols.map((v) => ({ drive: v.drive, ...readVolumePolicy(v.guid) }))
  const j = judgeVolumes(rows)
  if (json) {
    process.stdout.write(JSON.stringify({ status: j.status, code: j.code, rows, why: j.why ?? null }) + '\n')
  } else {
    for (const r of rows) process.stdout.write(`  ${r.drive}  guid=${r.guid}  present=${r.present}  NukeOnDelete=${r.nukeOnDelete}  MaxCapacity=${r.maxCapacity ?? '-'}${r.error ? '  error=' + r.error : ''}\n`)
    if (j.status === 'ok') process.stdout.write(`CHECK ok (${rows.length} 卷全部在位)\n`)
    else if (j.status === 'undetermined') process.stdout.write(`CHECK undetermined — ${j.why}\n`)
    else process.stdout.write(`CHECK breach 缺键 ${j.missing.length} / 未开 ${j.off.length} ⇒ 修法:node scripts/recycle-bin-policy.mjs --apply\n`)
  }
  return j.code
}

async function cmdApply(json) {
  const fv = fixedVolumes()
  if (fv.error) {
    process.stderr.write('x ' + fv.error + '\n')
    return 2
  }
  // 与 cmdCheck 同一条纪律:枚举到 0 卷时若照跑写循环,会输出"writes=[] ⇒ APPLY OK",
  // 一把永远成功、永远什么都没做的自愈(§0.3 的空枚举,§12f 的跑不通的出路)。
  if (fv.vols.length === 0) {
    const msg = 'UNDETERMINED: 枚举到 0 个有盘符的卷,拒绝在未知射程上执行写策略'
    if (json) process.stdout.write(JSON.stringify({ status: 'undetermined', error: msg, writes: [] }) + '\n')
    else process.stderr.write('x ' + msg + '\n')
    return 2
  }
  const writes = []
  for (const v of fv.vols) {
    const before = readVolumePolicy(v.guid)
    if (before.present && before.nukeOnDelete === NUKE) {
      writes.push({ drive: v.drive, action: 'already-on' })
      continue
    }
    const w = writeVolumePolicy(v.guid, NUKE)
    const after = readVolumePolicy(v.guid)
    writes.push({ drive: v.drive, action: w.ok ? 'write' : 'write-failed', ok: w.ok && after.nukeOnDelete === NUKE, before: before.nukeOnDelete, after: after.nukeOnDelete, error: w.error })
  }
  const bad = writes.filter((w) => w.action === 'write-failed' || w.ok === false)
  if (json) process.stdout.write(JSON.stringify({ writes, status: bad.length ? 'fail' : 'ok' }) + '\n')
  else for (const w of writes) process.stdout.write(`  ${w.drive}  ${w.action}  before=${w.before ?? '-'} after=${w.after ?? '-'}${w.error ? ' err=' + w.error : ''}\n`)
  process.stdout.write('APPLY ' + (bad.length ? 'FAIL ' + bad.length : 'OK') + '\n')
  return bad.length ? 1 : 0
}

// 观测面的有牙性不能靠"删除没产生条目"来反证 —— 那可以是策略挡住了,也可以是扫描面恒空。
// 所以单独开一臂:把成对的 $I/$R 写进一个夹具目录,交给与真盘完全同一个 scanBinDirs 读回来。
// 这一臂与卷策略无关,因此它不随策略强弱而变,才能当对照用。
function armRuler(tag) {
  const dir = SCRATCH.mkScratch('rbpol-ruler')
  try {
    writeFileSync(join(dir, '$I' + tag), PURGE.buildIMeta({ originalPath: join(dir, tag + '.orig'), sizeBytes: 5, deletedMs: Date.now() }))
    writeFileSync(join(dir, '$R' + tag), 'probe')
    const s = PURGE.scanBinDirs([dir])
    const hit = s.items.find((i) => String(i.iName).includes(tag))
    return { arm: 'C-ruler', state: hit ? 'teeth' : 'blind', items: s.items.length, undetermined: s.undetermined.length }
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
    } catch {}
  }
}

function judge(arms) {
  const a = arms.find((x) => x.arm === 'A-genie-trash')
  const b = arms.find((x) => x.arm === 'B-explicit-undo')
  const c = arms.find((x) => x.arm === 'C-ruler')
  if (a.state === 'undetermined' || c.state === 'blind') return { status: 'undetermined', code: 2 }
  if (a.state === 'fail') return { status: 'breach', code: 1 }
  if (b.state === 'landed') return { status: 'ok-explicit-undo-still-lands', code: 0 }
  if (b.state === 'undetermined') return { status: 'ok-ruler-note', code: 0 }
  return { status: 'ok-global', code: 0 }
}

async function cmdVerify(json, secs) {
  const bin = listBin()
  if (bin.error) {
    if (json) process.stdout.write(JSON.stringify({ status: 'undetermined', error: bin.error }) + '\n')
    else process.stderr.write('x ' + bin.error + '\n')
    return 2
  }
  const c = armRuler(nonce())
  const a = armGenie(bin.dirs, nonce(), secs)
  const b = armExplicitUndo(bin.dirs, nonce(), secs)
  const arms = [a, b, c]
  const { status, code } = judge(arms)
  const rec = { at: new Date().toISOString(), status, binDirs: bin.dirs, arms }
  if (json) process.stdout.write(JSON.stringify(rec) + '\n')
  else {
    for (const arm of arms) {
      process.stdout.write(`  ${arm.arm}: state=${arm.state} gone=${arm.gone ?? '-'} bin_total=${arm.binTotal ?? '-'} landed=${arm.landed ? arm.landed.length : '-'}${arm.items !== undefined ? ' items=' + arm.items : ''}\n`)
      if (arm.why) process.stdout.write('     why: ' + arm.why + '\n')
      if (arm.error) process.stdout.write('     err: ' + arm.error + '\n')
      for (const l of (arm.landed || []).slice(0, 3)) process.stdout.write('     landed: ' + l.p + ' rule=' + l.rule + '\n')
    }
    const note = {
      'ok-global': 'A 臂不落地 ∧ B 臂(显式可撤销请求)也被核掉 ⇒ 本卷删除为全局硬删',
      'ok-explicit-undo-still-lands': 'A 臂被挡住,但显式可撤销请求仍会进回收站 ⇒ 兜底清理腿必须继续留着',
      'ok-ruler-note': 'B 臂未能判定(调用失败),策略强度这一格按未判定看待',
      breach: 'genie-trash 仍在往回收站灌条目',
      undetermined: '取不到判据输入,不记绿也不冒红',
    }
    process.stdout.write('VERIFY ' + status + ' — ' + note[status] + '\n')
  }
  return code
}

async function selfTest(json) {
  const fails = []
  // mountvol 解析夹具:两枚有盘符卷 + 一枚无装入点的卷(后者必须仍被枚举到,只是 drive=null 被滤掉)
  const sample = [
    '',
    '\\\\?\\Volume{0BCD46E9-cfa3-4f35-b310-b4ec0985846d}\\',
    '        C:\\',
    '',
    '\\\\?\\Volume{86961f69-b446-4ece-ba06-c454aacd68ec}\\',
    '',
    '\\\\?\\Volume{15ba644e-fe35-487f-9820-c215157ab9cd}\\',
    '        D:\\',
  ].join('\r\n')
  const vols = parseMountvol(sample)
  if (vols.length !== 3) fails.push('POSITIVE CONTROL BROKEN: 夹具应解析出 3 卷,实得 ' + vols.length)
  const drives = vols.map((v) => driveOf(v.mounts))
  if (drives[0] !== 'C:' || drives[1] !== null || drives[2] !== 'D:') fails.push('卷归属判定错:' + JSON.stringify(drives))
  if (vols[0].guid !== '0bcd46e9-cfa3-4f35-b310-b4ec0985846d') fails.push('GUID 未归一小写:' + vols[0].guid)
  if (driveOf(['\\\\?\\Volume{deadbeef-0000-0000-0000-000000000000}\\']) !== null) fails.push('REVERSE CONTROL BROKEN: 卷设备路径自身被当成了盘符')
  if (driveOf(['D:\\']) !== 'D:') fails.push('mountvol 装入点形态 "D:\\" 未被认成盘符')

  const reg = parseRegValues(['HKCU\\...\\{x}', '    MaxCapacity    REG_DWORD    0x3000', '    NukeOnDelete    REG_DWORD    0x1', ''].join('\r\n'))
  if (!reg.NukeOnDelete || reg.NukeOnDelete.type !== 'DWORD') fails.push('reg 值解析丢键:' + JSON.stringify(reg))
  if (Number.parseInt(reg.NukeOnDelete.raw, 16) !== 1) fails.push('NukeOnDelete 取值错:' + reg.NukeOnDelete.raw)

  // 状态判定的四态 —— 空枚举这一例钉的是上一版真存在过的假绿:0 卷时 missing/off 皆空 ⇒ 曾判 ok
  const j0 = judgeVolumes([])
  if (j0.status !== 'undetermined' || j0.code !== 2) fails.push('REVERSE CONTROL BROKEN: 枚举 0 卷被判成 ' + j0.status + '(code ' + j0.code + ') —— 空集不是健康')
  const jOk = judgeVolumes([{ drive: 'C:', present: true, missingKey: false, nukeOnDelete: 1 }, { drive: 'D:', present: true, missingKey: false, nukeOnDelete: 1 }])
  if (jOk.status !== 'ok' || jOk.code !== 0) fails.push('POSITIVE CONTROL BROKEN: 两卷全开被判成 ' + jOk.status)
  const jOff = judgeVolumes([{ drive: 'C:', present: true, missingKey: false, nukeOnDelete: 0 }])
  if (jOff.status !== 'breach' || jOff.code !== 1) fails.push('未开策略应 breach:' + jOff.status)
  const jMiss = judgeVolumes([{ drive: 'D:', present: false, missingKey: true, nukeOnDelete: null }])
  if (jMiss.status !== 'breach') fails.push('缺键应 breach(可由 apply 补):' + jMiss.status)
  const jFail = judgeVolumes([{ drive: 'C:', present: false, missingKey: false, error: '拒绝访问' }])
  if (jFail.status !== 'undetermined') fails.push('读取失败不得算 breach(不得替机器猜"没设"):' + jFail.status)

  if (json) process.stdout.write(JSON.stringify({ ok: fails.length === 0, fails }) + '\n')
  else process.stdout.write((fails.length === 0 ? 'SELF-TEST PASS\n' : 'SELF-TEST FAIL\n') + fails.map((f) => '  - ' + f).join('\n') + (fails.length ? '\n' : '\n'))
  return fails.length === 0 ? 0 : 1
}

function parseArgs(argv) {
  const o = { mode: 'check', json: false, secs: 10 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check') o.mode = 'check'
    else if (a === '--apply') o.mode = 'apply'
    else if (a === '--verify') o.mode = 'verify'
    else if (a === '--self-test') o.mode = 'selftest'
    else if (a === '--json') o.json = true
    else if (a === '--seconds') o.secs = Math.max(3, Number(argv[++i] || 10))
    else if (a === '--help' || a === '-h') o.help = true
    else throw new Error('unknown argument: ' + a)
  }
  return o
}

const HELP = `usage: node scripts/recycle-bin-policy.mjs [--check|--apply|--verify|--self-test] [--json] [--seconds N]

check      只读:逐卷报 NukeOnDelete 是否在位(卷身份取自 mountvol 装入点;0 卷 ⇒ 未判定不记绿)
apply      为每个有盘符的卷写上 NukeOnDelete=1,幂等,已开的不重写;0 卷 ⇒ 拒绝空转
verify     真删臂:造夹具交 genie-trash 删 + 显式可撤销删除臂 + 扫描面有牙臂,三臂合判
self-test  纯函数对照:mountvol 解析 / reg 值解析 / 四态判定,含"枚举 0 卷不得判绿"反证`

async function main() {
  const o = parseArgs(process.argv.slice(2))
  if (o.help) {
    process.stdout.write(HELP + '\n')
    return 0
  }
  if (o.mode === 'selftest') return selfTest(o.json)
  if (o.mode === 'apply') return cmdApply(o.json)
  if (o.mode === 'verify') return cmdVerify(o.json, o.secs)
  return cmdCheck(o.json)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().then((c) => process.exit(c)).catch((e) => {
    console.error('x ' + (e && e.message ? e.message : e) + '\n' + (e && e.stack ? e.stack : ''))
    process.exit(2)
  })
}

export const __test__ = { parseMountvol, driveOf, parseRegValues, readVolumePolicy, writeVolumePolicy, findGenieTrash, judgeVolumes, selfTest, GENIE_CANDIDATES, BITBUCKET, NUKE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
