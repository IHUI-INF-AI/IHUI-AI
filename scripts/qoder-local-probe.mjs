// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机 Qoder 凭证发现 + 设备授权端点取证助手(2026-11-18 立)。
 *
 * 治两个真实缺口:
 *   ① **发现不采用** —— 本机存在 Qoder 登录态、而号池里没有这个账号时,应当**只提示**
 *      让人决定,而不是静默把它拉进池。对照程序明确写「启动日志只提示发现 N 条、永不静默采用」,
 *      本仓此前的回灌腿只更新**已有行**(不新增),所以"发现"这一步根本没有出口 —— 本器物补它。
 *   ② **端点取证** —— `relay-auth-capabilities` 里 qoder/device_flow 是 `verified:false`
 *      (本机零取证)。本器物按 AGENTS §0.12 的本机取证路径,从**已安装客户端**里把
 *      设备授权相关的候选常量捞出来,交人验证;它**不联网、不拨端点、不写能力表**。
 *
 * 纪律(写死):
 *   · 只读:不修改任何文件,不发起任何网络请求,不落 capability 表。
 *   · 不打印凭据:命中片段里的长 token / 长 hex / base64 一律替换成 `<redacted>`。
 *   · 找到候选 ≠ 已实证:`verified:true` 只能由人在真实请求上验证后手工改。
 *   · 判不了就 `unjudged`(本机没装客户端 / 目录读不到),绝不冒"没有端点"的结论。
 *
 * 用法:
 *   node scripts/qoder-local-probe.mjs                 # 人读输出
 *   node scripts/qoder-local-probe.mjs --json          # 机读
 *   node scripts/qoder-local-probe.mjs --root <dir>    # 指定安装/数据根
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** 数据目录候选(登录态四件套在这) */
const DATA_DIR_CANDIDATES = [
  () => path.join(process.env.APPDATA ?? '', 'com.qodercn.app.stable'),
  () => path.join(os.homedir(), 'AppData', 'Roaming', 'com.qodercn.app.stable'),
]

/** 程序目录候选(Electron 资源在这) */
const APP_DIR_CANDIDATES = [
  () => path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Qoder'),
  () => path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'qoder'),
  () => path.join(process.env.PROGRAMFILES ?? '', 'Qoder'),
  () => path.join(process.env.APPDATA ?? '', 'com.qodercn.app.stable'),
]

/** 登录态四件套(与 relay-switch/profiles 的 qoder 条目同源) */
export const CREDENTIAL_FILES = ['auth.v1.dat', 'auth.machine-id', path.join('.auth', 'machine_id'), 'auth-profile-overlays.v1.dat']

/** 端点取证关键字(按"设备授权 → 双区 → 签名版本"分组) */
export const ENDPOINT_KEYWORDS = [
  'device_authorization',
  'device_code',
  'device_code_url',
  'oauth/device',
  'client_id',
  'redirect_uri',
  'cosy-version',
  'api1.qoder.sh',
  'api2.qoder.sh',
  'api3.qoder.sh',
  'gateway.qoder.com.cn',
  'qoder.com.cn',
  'sash/api',
  'machine_id',
]

/** 单文件上限:app.asar 可能几百 MB,超过就只看头部(关键字都在头部) */
const MAX_SCAN_BYTES = 64 * 1024 * 1024
/** 命中片段上下文长度 */
const SNIPPET_PAD = 60

const REDACT_PATTERNS = [
  /\b[0-9a-f]{32,}\b/gi, // 长 hex(token/机器码)
  /\b[A-Za-z0-9+/_-]{40,}={0,2}\b/g, // 长 base64url
  /\b\d{20,}\b/g, // 超长数字
]

/**
 * 脱敏一段上下文:把疑似凭据串替换成 `<redacted>`。纯函数,可测。
 */
export function redactSnippet(raw) {
  let s = String(raw ?? '')
  for (const p of REDACT_PATTERNS) s = s.replace(p, '<redacted>')
  // 控制字符换成空格,避免把二进制脏字节打到终端
  s = s.replace(/[^\x20-\x7E\u4e00-\u9fff]/g, ' ')
  return s.replace(/\s+/g, ' ').trim().slice(0, 200)
}

/**
 * 从一段 Buffer 里提取关键字命中。纯函数,可测。
 * @returns {{keyword:string, offset:number, snippet:string}[]}
 */
export function extractCandidates(buf, keywords = ENDPOINT_KEYWORDS) {
  if (!buf || buf.length === 0) return []
  const hay = buf.toString('latin1') // 1:1 字节映射,避免 UTF-8 解码错位导致 offset 漂移
  const out = []
  for (const kw of keywords) {
    let from = 0
    let guard = 0
    while (guard < 50) {
      const at = hay.indexOf(kw, from)
      if (at < 0) break
      const start = Math.max(0, at - SNIPPET_PAD)
      const end = Math.min(hay.length, at + kw.length + SNIPPET_PAD)
      out.push({ keyword: kw, offset: at, snippet: redactSnippet(hay.slice(start, end)) })
      from = at + kw.length
      guard++
    }
  }
  return out
}

function existsFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function listFilesRecursive(dir, depth, out) {
  if (depth > 6) return out
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      // 只下探 resources / app* / dist,别把整个安装目录走一遍
      if (/^(resources|app\w*|dist|resources\\app)/i.test(e.name) || depth < 2) {
        listFilesRecursive(full, depth + 1, out)
      }
      continue
    }
    if (!/\.(asar|js|mjs|cjs|json|txt|yml|yaml|pem)$/i.test(e.name)) continue
    out.push(full)
  }
  return out
}

function findDataDirs() {
  const hits = []
  for (const make of DATA_DIR_CANDIDATES) {
    const dir = make()
    if (!dir) continue
    try {
      if (fs.statSync(dir).isDirectory()) hits.push(dir)
    } catch {
      /* 不存在即跳过 */
    }
  }
  return [...new Set(hits)]
}

function findAppDirs() {
  const hits = []
  for (const make of APP_DIR_CANDIDATES) {
    const dir = make()
    if (!dir) continue
    try {
      if (fs.statSync(dir).isDirectory()) hits.push(dir)
    } catch {
      /* 不存在即跳过 */
    }
  }
  return [...new Set(hits)]
}

function discoverCredentials(dataDirs) {
  const found = []
  for (const dir of dataDirs) {
    for (const rel of CREDENTIAL_FILES) {
      const full = path.join(dir, rel)
      if (!existsFile(full)) continue
      let size = 0
      let mtime = ''
      try {
        const st = fs.statSync(full)
        size = st.size
        mtime = st.mtime.toISOString()
      } catch {
        /* 读不到就不给值 */
      }
      found.push({ path: full, size, mtime })
    }
  }
  return found
}

function probeEndpoints(appDirs) {
  const candidates = []
  const scanned = []
  for (const dir of appDirs) {
    const files = listFilesRecursive(dir, 0, [])
    for (const f of files) {
      let size = 0
      try {
        size = fs.statSync(f).size
      } catch {
        continue
      }
      if (size === 0) continue
      const readLen = Math.min(size, MAX_SCAN_BYTES)
      let buf
      try {
        const fd = fs.openSync(f, 'r')
        buf = Buffer.alloc(readLen)
        fs.readSync(fd, buf, 0, readLen, 0)
        fs.closeSync(fd)
      } catch {
        continue
      }
      scanned.push(f)
      const hits = extractCandidates(buf)
      for (const h of hits) candidates.push({ ...h, file: f })
    }
  }
  return { candidates, scanned }
}

function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const rootIdx = argv.indexOf('--root')
  const overrideRoot = rootIdx >= 0 ? argv[rootIdx + 1] : ''

  const dataDirs = overrideRoot ? [overrideRoot] : findDataDirs()
  const appDirs = overrideRoot ? [overrideRoot] : findAppDirs()

  if (dataDirs.length === 0 && appDirs.length === 0) {
    const payload = {
      state: 'unjudged',
      reason: '本机既没找到 Qoder 数据目录也没找到程序目录(或路径候选都不存在);不代表"没有端点",只是本器物无从取证',
      data_dirs: [],
      app_dirs: [],
      credentials: [],
      candidates: [],
      next: '若客户端装在非默认位置,用 --root <dir> 指过去再跑一次',
      discipline: 'unverified ≠ verified:任何候选都要由人在真实请求上验证后才可把 relay-auth-capabilities 改成 verified:true',
    }
    console.log(asJson ? JSON.stringify(payload, null, 2) : formatHuman(payload))
    process.exitCode = 2
    return
  }

  const credentials = discoverCredentials(dataDirs)
  const { candidates, scanned } = probeEndpoints(appDirs)

  const state = candidates.length > 0 ? 'found' : credentials.length > 0 ? 'partial' : 'not-found'
  const payload = {
    state,
    data_dirs: dataDirs,
    app_dirs: appDirs,
    credentials,
    scanned_files: scanned.length,
    candidates,
    /** 按关键字聚合,方便人一眼看"双区端点/签名版本/client_id 有没有" */
    by_keyword: candidates.reduce((acc, c) => {
      acc[c.keyword] = (acc[c.keyword] ?? 0) + 1
      return acc
    }, {}),
    next:
      candidates.length > 0
        ? '候选已列出:请在真实设备授权请求上逐条验证(观察上游是否接受),验过再把 relay-auth-capabilities 的 qoder/device_flow 改成 verified:true'
        : '未捞到端点候选:可能是客户端用了压缩/加密的资源包;可先 --json 看 scanned_files,再考虑 --root 指到 resources 目录',
    discipline:
      '本器物不联网、不写能力表、不打印凭据;发现登录态只提示不采用 —— 要入池请走「添加账号」或 PAT 通道,由人确认',
  }

  console.log(asJson ? JSON.stringify(payload, null, 2) : formatHuman(payload))
  process.exitCode = 0
}

function formatHuman(p) {
  const lines = []
  lines.push(`PROBE-RESULT state=${p.state}`)
  lines.push(`  数据目录: ${p.data_dirs.length ? p.data_dirs.join(' | ') : '(无)'}`)
  lines.push(`  程序目录: ${p.app_dirs.length ? p.app_dirs.join(' | ') : '(无)'}`)
  if (p.credentials) {
    lines.push(`  登录态文件: 发现 ${p.credentials.length} 个`)
    for (const c of p.credentials) lines.push(`    - ${c.path} (${c.size} B, ${c.mtime})`)
    if (p.credentials.length > 0) {
      lines.push('  ⚠️ 发现 ≠ 采用:这些文件只被 stat 过,内容没读、没进池;要入池请走「添加账号」/PAT 通道')
    }
  }
  if (p.scanned_files !== undefined) lines.push(`  扫描文件数: ${p.scanned_files}`)
  if (p.by_keyword && Object.keys(p.by_keyword).length) {
    lines.push('  关键字命中:')
    for (const [k, n] of Object.entries(p.by_keyword)) lines.push(`    - ${k}: ${n}`)
  }
  if (p.candidates && p.candidates.length) {
    lines.push(`  候选明细(前 20 条,已脱敏):`)
    for (const c of p.candidates.slice(0, 20)) {
      lines.push(`    - [${c.keyword}] ${path.basename(c.file)}@${c.offset} :: ${c.snippet}`)
    }
  }
  if (p.reason) lines.push(`  原因: ${p.reason}`)
  if (p.next) lines.push(`  下一步: ${p.next}`)
  if (p.discipline) lines.push(`  纪律: ${p.discipline}`)
  return lines.join('\n')
}

export const __test__ = {
  redactSnippet,
  extractCandidates,
  listFilesRecursive,
  ENDPOINT_KEYWORDS,
  CREDENTIAL_FILES,
}

// 仅直接执行时跑主流程;import 取用纯函数时不产生副作用(测试要用 extractCandidates)
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
