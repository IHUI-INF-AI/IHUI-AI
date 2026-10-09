#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 残留指纹审计器 —— 回答一个问题:「TRAE 到底重置彻底了吗?」
 *
 * 方法(不靠感觉,靠比对):
 *   1. 从历史备份集(G:/trae-real-test-backup)+ 身份历史账本
 *      (~/.trae-proxy/identity-history.json)提取全部"身份类旧值"
 *      (machineid / MachineGuid / storage.json 的 telemetry.* 与 aha.device.* /
 *       state.vscdb 键里的 32hex 与 uuid / DIPS 等),构成**黑名单**
 *   2. 扫描当前本机全部 TRAE 现场 + 注册表 + 系统痕迹目录,
 *      凡出现黑名单中的旧值 ⇒ 计为一条**残留命中**
 *   3. 同时清点改不了的硬件标识(主板 UUID / BIOS 序列号 / 系统盘卷号 /
 *      Windows ProductId),如实标注为「本地不可变」边界
 *
 * 用法: node scripts/audit-trae-residual.mjs [--backup <dir>] [--json] [--strict]
 *   --json    机器可读输出(纯 JSON 到 stdout,无任何装饰文字)
 *   --strict  门禁模式:硬命中 > 0 ⇒ 退出码 1
 * 环境变量:
 *   AUDIT_SKIP_REGISTRY=1     跳过注册表定点枚举(CI / 快跑)
 *   AUDIT_IDENTITY_HISTORY    覆盖身份历史账本路径(默认 %USERPROFILE%\.trae-proxy\identity-history.json)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ARGV = process.argv.slice(2)
const JSON_MODE = ARGV.includes('--json')
const STRICT = ARGV.includes('--strict')
const BACKUP = ARGV.includes('--backup') ? ARGV[ARGV.indexOf('--backup') + 1] : 'G:/trae-real-test-backup'
const HOME = process.env.USERPROFILE || process.env.HOME
const APPDATA = process.env.APPDATA || join(HOME, 'AppData/Roaming')
const LOCALAPPDATA = process.env.LOCALAPPDATA || join(HOME, 'AppData/Local')
const SITES = ['TRAE SOLO CN', 'TRAE', 'Trae CN'].map((n) => join(APPDATA, n))

/** 从文本里抽取"像身份"的记号:32 位 hex、UUID、MachineGuid 形态 */
function extractIds(text) {
  const out = new Set()
  for (const m of text.matchAll(/\b[A-Za-z0-9]{32}\b/g)) out.add(m[0].toLowerCase())
  for (const m of text.matchAll(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g))
    out.add(m[0].toLowerCase())
  for (const m of text.matchAll(/MachineGuid[=:]\s*([0-9a-fA-F-]{36})/g)) out.add(m[1].toLowerCase())
  return out
}

function walk(dir, cb, depth = 0) {
  if (depth > 8) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    try {
      if (e.isDirectory()) walk(p, cb, depth + 1)
      else cb(p)
    } catch {
      /* 权限/占用跳过 */
    }
  }
}

// ── 1. 提取黑名单(历史旧身份值) ──────────────────────────────
// 分两级:确定性身份(machineid 文件 / MachineGuid / storage.json 的 telemetry.*
// 与 aha.device.* 键值 / 含 device|machine|sqm|guid 关键词键的值)= 硬黑名单;
// 其余文件里捞到的 32hex/uuid 只进**疑似**库(可能是键名或函数名,如
// environmentvariablecollectionsv2),命中时分级报告,不吓人。
const blacklist = new Set()
const blacklistOrigin = new Map()
const suspects = new Set()
/** id -> Set<context>:JSON 走键值时记键名,裸扫记来源路径 */
const suspectCtx = new Map()
/** id -> Set<file>:该 id 出现过的全部文件,用于"通用噪声"判定 */
const suspectFiles = new Map()

function noteSuspect(id, ctx, file) {
  suspects.add(id)
  if (ctx) {
    if (!suspectCtx.has(id)) suspectCtx.set(id, new Set())
    suspectCtx.get(id).add(ctx)
  }
  if (file) {
    if (!suspectFiles.has(id)) suspectFiles.set(id, new Set())
    suspectFiles.get(id).add(file)
  }
}

const ID_KEY_RE = /(device|machine|sqm|guid|telemetry|clientid|install)/i
function collectFromJson(text, origin) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    return
  }
  const walkObj = (node) => {
    if (Array.isArray(node)) return node.forEach(walkObj)
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string') {
          for (const id of extractIds(v)) {
            if (ID_KEY_RE.test(k)) {
              blacklist.add(id)
              blacklistOrigin.set(id, `${origin}#${k}`)
            } else {
              noteSuspect(id, k, origin)
            }
          }
        } else walkObj(v)
      }
    }
  }
  walkObj(obj)
}

if (existsSync(BACKUP)) {
  walk(BACKUP, (p) => {
    let size = 0
    try {
      size = statSync(p).size
    } catch {
      return
    }
    if (size > 12 * 1024 * 1024) return
    let buf
    try {
      buf = readFileSync(p)
    } catch {
      return
    }
    const text = buf.toString('utf8') + ' ' + buf.toString('latin1')
    const origin = p.replace(BACKUP, '<backup>')
    if (p.endsWith('.json') || p.endsWith('storage.json')) {
      collectFromJson(buf.toString('utf8'), origin)
      return
    }
    for (const id of extractIds(text)) noteSuspect(id, origin, origin)
  })
}
// 显式加入三个 machineid 与 MachineGuid(必检)
for (const site of ['TRAE SOLO CN', 'TRAE', 'Trae CN']) {
  const f = join(BACKUP, site, 'machineid')
  if (existsSync(f)) {
    const v = readFileSync(f, 'utf8').replace(/^\uFEFF/, '').trim().toLowerCase()
    if (v) {
      blacklist.add(v)
      blacklistOrigin.set(v, `<backup>/${site}/machineid`)
    }
  }
}
const mgFile = join(BACKUP, 'MachineGuid-backup.txt')
if (existsSync(mgFile)) {
  // 修(2026-10-10):旧写法只 blacklistOrigin.set 不 blacklist.add ⇒ 旧 MachineGuid
  // 从来没真正进过硬黑名单,"改了 MachineGuid 却查不到残留"是假阴性。
  for (const v of extractIds(readFileSync(mgFile, 'utf8'))) {
    blacklist.add(v)
    if (!blacklistOrigin.has(v)) blacklistOrigin.set(v, '<backup>/MachineGuid-backup.txt')
  }
}

// 身份历史账本:Rust 侧每次重置前追加写入的旧身份值 ⇒ 一律并入硬黑名单
const HISTORY_FILE = process.env.AUDIT_IDENTITY_HISTORY || join(HOME, '.trae-proxy/identity-history.json')
let historyEntries = 0
/** 注册表指纹记号(`regfp|…`),由注册表段单独比对,不进文件黑名单 */
const regFingerprints = []
if (existsSync(HISTORY_FILE)) {
  try {
    const ledger = JSON.parse(readFileSync(HISTORY_FILE, 'utf8'))
    const entries = Array.isArray(ledger && ledger.entries) ? ledger.entries : []
    entries.forEach((e, i) => {
      const values = Array.isArray(e && e.values) ? e.values : []
      for (const raw of values) {
        const id = String(raw).trim().toLowerCase()
        if (!id) continue
        // Rust 侧的注册表指纹记号(`regfp|<键>|<值>`)不参与文件扫描 —— 它由注册表段
        // 单独比对;混进文件黑名单只会虚增规模且永不命中。
        if (id.startsWith('regfp|')) {
          regFingerprints.push(id)
          continue
        }
        blacklist.add(id)
        if (!blacklistOrigin.has(id)) blacklistOrigin.set(id, `<history>#${i}`)
      }
      historyEntries++
    })
  } catch {
    /* 账本损坏/不可读 ⇒ 静默跳过,不中断审计 */
  }
}

// ── 2. 扫描当前现场 ──────────────────────────────────────────
const hits = []
const scanned = { files: 0, bytes: 0, skipUnreadable: 0 }

function scanFile(p, zone) {
  let size
  try {
    size = statSync(p).size
  } catch {
    return
  }
  if (size > 12 * 1024 * 1024) return
  let buf
  try {
    buf = readFileSync(p)
  } catch {
    scanned.skipUnreadable++
    return
  }
  scanned.files++
  scanned.bytes += size
  const text = buf.toString('utf8') + ' ' + buf.toString('latin1')
  for (const id of extractIds(text)) {
    if (blacklist.has(id)) {
      hits.push({ zone, file: p.replace(APPDATA, '%APPDATA%'), id, origin: blacklistOrigin.get(id) })
    }
  }
}

for (const site of SITES) {
  if (!existsSync(site)) continue
  walk(site, (p) => scanFile(p, site.replace(APPDATA, '%APPDATA%')))
}
// 系统级痕迹区
for (const extra of [
  join(LOCALAPPDATA, 'Trae'),
  join(LOCALAPPDATA, 'com.traework.assistant'),
  join(LOCALAPPDATA, 'Programs/Trae CN'),
  join(process.env.ProgramData || 'C:/ProgramData', 'Trae'),
]) {
  if (existsSync(extra)) walk(extra, (p) => scanFile(p, extra))
}

// 注册表:**定点**枚举(非递归 + 命中再下一层),避免整 hive 递归导致超时
const regOut = []
{
  if (process.env.AUDIT_SKIP_REGISTRY === '1') {
    regOut.push('[注册表] 已按 AUDIT_SKIP_REGISTRY=1 跳过定点枚举')
  } else {
    const ps = `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$ErrorActionPreference='SilentlyContinue'
$re = 'trae|bytedance|icube|ahawork|traework'
$roots = @('HKCU:\\Software','HKLM:\\SOFTWARE','HKLM:\\SOFTWARE\\WOW6432Node')
foreach ($p in $roots) {
  $kids = @(Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match $re })
  if ($kids.Count -eq 0) { Write-Output ("[REG] " + $p + " => (无匹配)"); continue }
  foreach ($k in ($kids | Select-Object -First 20)) {
    Write-Output ("[REG] " + $p + " => " + $k.PSChildName)
    $sub = @(Get-ChildItem -Path $k.PSPath -ErrorAction SilentlyContinue | Select-Object -First 12 -ExpandProperty PSChildName)
    if ($sub.Count -gt 0) { Write-Output ("[REG]   + " + ($sub -join ' | ')) }
  }
}
$cls = @(Get-ChildItem -Path 'HKCU:\\Software\\Classes' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match $re })
Write-Output ("[REG] HKCU:\\Software\\Classes => " + $cls.Count + " 项: " + (($cls | Select-Object -First 12 -ExpandProperty PSChildName) -join ' | '))
$g = (Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -ErrorAction SilentlyContinue).MachineGuid
Write-Output ("[REG] MachineGuid-new=" + $g)
# 设备指纹槽位:厂商容器下的 Info 值(2026-10-10 取证发现的隐藏凭据)
foreach ($slot in @('Software\\Bytedance\\Trae CN\\Common','Software\\TRAE\\Common','Software\\TRAE SOLO CN\\Common','Software\\Trae CN\\Common')) {
  $v = (Get-ItemProperty -Path ('HKCU:\\' + $slot) -ErrorAction SilentlyContinue).Info
  if ($v) { Write-Output ("[REG-FP] " + $slot + " = " + [string]$v) }
}`
    try {
      const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 45000,
      })
      out.split(/\r?\n/)
        .filter((l) => l.trim())
        .forEach((l) => regOut.push(l.trim()))
    } catch (e) {
      // 降级而非中断:注册表只是审计的一个维度,拿不到就如实说明
      regOut.push(`[注册表] 定点枚举不可用(已降级,不影响其余审计): ${String((e && e.message) || e).slice(0, 80)}`)
    }
  }
}

// 注册表指纹维度:账本里记过的旧 `Info` 值若**仍在**注册表里 ⇒ 计为硬命中。
// 这一支专盯厂商容器(Bytedance)下的设备指纹 —— "应用层全翻新却仍被认出"的隐藏凭据。
for (const line of regOut) {
  const m = line.match(/^\[REG-FP\]\s+(.+?)\s+=\s+(.+)$/)
  if (!m) continue
  const token = `regfp|${m[1]}|${m[2].trim()}`.toLowerCase()
  if (regFingerprints.includes(token)) {
    hits.push({
      zone: 'registry',
      file: `HKCU\\${m[1]}\\Info`,
      id: token,
      origin: '<history>#regfp',
    })
  }
}

// ── 3. 硬件标识清点(本地不可变的边界,如实披露) ───────────────
const hw = []
try {
  const ps = `Get-CimInstance -ClassName Win32_ComputerSystemProduct | ForEach-Object { "MB-UUID=" + $_.UUID }
Get-CimInstance -ClassName Win32_BIOS | ForEach-Object { "BIOS-SN=" + $_.SerialNumber }
Get-CimInstance -ClassName Win32_OperatingSystem | ForEach-Object { "OS-SN=" + $_.SerialNumber; "ProductId=" + $_.SerialNumber }
Get-Volume -DriveLetter C | ForEach-Object { "VolC-SN=" + ($_ | Select-Object -ExpandProperty ObjectId) }`
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  for (const line of out.split(/\r?\n/)) if (line.trim()) hw.push(line.trim())
} catch {
  hw.push('(硬件标识查询不可用)')
}

// ── 4. 疑似命中 + 降噪 ───────────────────────────────────────
// 疑似库里混有非身份类长串(工作区目录名 hash、键名、路径片段等)。
// 降噪规则:① context(键名/来源路径)命中明显非身份关键词;② 同一 id 出现在
// ≥3 个互不相关的文件 ⇒ 通用噪声。降噪项在报告里显式汇总,不静默消失。
const NOISE_CTX_RE = /(environmentvariable|collection|hash|path|folder|workspace|folderuri|relativepath|name|id_|checksum|etag)/i
const NOISE_FILE_THRESHOLD = 3

const rawSusHits = []
for (const site of SITES.concat([join(LOCALAPPDATA, 'com.traework.assistant')])) {
  if (!existsSync(site)) continue
  walk(site, (p) => {
    let buf
    try {
      const st = statSync(p)
      if (st.size > 12 * 1024 * 1024) return
      buf = readFileSync(p)
    } catch {
      return
    }
    const text = buf.toString('utf8') + ' ' + buf.toString('latin1')
    for (const id of extractIds(text)) {
      if (suspects.has(id) && !blacklist.has(id)) {
        rawSusHits.push({ file: p.replace(APPDATA, '%APPDATA%'), id })
        if (!suspectFiles.has(id)) suspectFiles.set(id, new Set())
        suspectFiles.get(id).add(p)
      }
    }
  })
}

const denoisedIds = new Map() // id -> { reason, contexts, files }
const susHits = []
for (const h of rawSusHits) {
  if (denoisedIds.has(h.id)) continue
  const ctxs = [...(suspectCtx.get(h.id) || [])]
  const files = suspectFiles.get(h.id) || new Set()
  let reason = null
  if (ctxs.length > 0 && ctxs.every((c) => NOISE_CTX_RE.test(c))) reason = '非身份类 context'
  else if (files.size >= NOISE_FILE_THRESHOLD) reason = `通用噪声(出现于 ${files.size} 个文件)`
  if (reason) denoisedIds.set(h.id, { id: h.id, reason, contexts: ctxs.slice(0, 3), fileCount: files.size })
  else susHits.push(h)
}

// ── 5. 报告 ──────────────────────────────────────────────────
const hardByFile = new Map()
for (const h of hits) {
  if (!hardByFile.has(h.file)) hardByFile.set(h.file, new Set())
  hardByFile.get(h.file).add(h.id)
}
const hardHitFiles = [...hardByFile.entries()].map(([file, ids]) => ({
  file,
  count: ids.size,
  sample: [...ids][0],
}))
const report = {
  blacklistSize: blacklist.size,
  historyEntries,
  scanned: { files: scanned.files, bytes: scanned.bytes, skipUnreadable: scanned.skipUnreadable },
  sitesPresent: SITES.filter(existsSync).length,
  hardHits: hits.length,
  hardHitFiles,
  suspectHits: susHits.length,
  suspectHitFiles: (() => {
    const m = new Map()
    for (const h of susHits) {
      if (!m.has(h.file)) m.set(h.file, new Set())
      m.get(h.file).add(h.id)
    }
    return [...m.entries()].map(([file, ids]) => ({ file, count: ids.size, sample: [...ids][0] }))
  })(),
  denoised: denoisedIds.size,
  denoisedItems: [...denoisedIds.values()].slice(0, 20),
  registry: regOut,
  hardware: hw,
  ok: hits.length === 0,
}

if (JSON_MODE) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} else {
  console.log(`黑名单(历史旧身份值)规模: ${blacklist.size} 个${historyEntries ? ` (含身份历史账本 ${historyEntries} 条)` : ''}`)

  console.log('\n===== 扫描覆盖面 =====')
  console.log(`文件 ${scanned.files} 个 / ${(scanned.bytes / 1048576).toFixed(1)} MB / 不可读跳过 ${scanned.skipUnreadable}`)
  console.log(`现场目录: ${report.sitesPresent}/3 存在`)

  console.log('\n===== 残留命中(旧身份值仍在本机)=====')
  if (hits.length === 0) {
    console.log('✅ 0 项 —— 当前全现场未发现任何历史旧身份值(应用层身份已彻底翻新)')
  } else {
    console.log(`❌ ${hits.length} 处命中(硬黑名单=确定身份值),分布于 ${hardHitFiles.length} 个文件:`)
    for (const f of hardHitFiles.slice(0, 40)) {
      console.log(`  - ${f.file}  (${f.count} 个旧值,例: ${f.sample})`)
    }
  }

  console.log(`\n===== 疑似命中(非身份类长串,仅供研判)= ${susHits.length} 处 =====`)
  for (const f of report.suspectHitFiles.slice(0, 12)) {
    console.log(`  ~ ${f.file} (${f.count} 个,例: ${f.sample})`)
  }
  if (denoisedIds.size > 0) {
    console.log(`  (已降噪 ${denoisedIds.size} 项 —— 疑为非身份类长串/通用噪声,不计入命中:)`)
    for (const d of report.denoisedItems.slice(0, 8)) {
      console.log(`    · ${d.id} ⇒ ${d.reason}${d.contexts.length ? ` | ctx: ${d.contexts.join(' , ')}` : ''}`)
    }
  }

  console.log('\n===== 注册表 =====')
  regOut.forEach((l) => console.log(l))

  console.log('\n===== 硬件标识(本地不可变,披露边界)=====')
  hw.forEach((l) => console.log('  ' + l))

  console.log('\n===== 结论口径 =====')
  console.log('应用层(机器码/MachineGuid/存储/密钥库/MAC)+ 注册表 全部清零 ⇒ 本地已达"等效重装";')
  console.log('硬件标识(主板 UUID/BIOS 序列号等)与 服务端账号标记、IP 归属 属本地改不了的维度。')
}

// ── 6. 门禁退出码(仅 --strict 生效,默认保持向后兼容) ────────
// 用 exitCode 而非 process.exit(),避免管道场景下 stdout 被截断
process.exitCode = STRICT && hits.length > 0 ? 1 : 0
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
