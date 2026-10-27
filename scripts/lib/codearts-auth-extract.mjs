// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CodeArts(华为云码道)本机会话提取器(2026-10-27 装车,补 FROM_PROVIDERS.codearts=null 的缺口)。
 *
 * 取证链(2026-10-27 本机实证,§0.9 判据现读,不猜):
 *   - 桌面端 = CodeArts Agent(VS Code 系,数据目录 %APPDATA%\codearts-agent);
 *   - 登录会话存在 User/globalStorage/state.vscdb(ItemTable)的
 *     secret://{"extensionId":"huaweicloud.authentication","key":"HuaweiCloudSession"} 行,
 *     值 = {"type":"Buffer","data":[…]}(Electron safeStorage 密文字节数组);
 *   - 密文 = Chromium os_crypt 同构:'v10'(3B) + nonce(12B) + ct + tag(16B),AES-256-GCM;
 *   - AES 密钥 = Local State 的 os_crypt.encrypted_key(base64,剥 5B 'DPAPI' 前缀后
 *     DPAPI CurrentUser 解密)—— 须以登录 CodeArts 的同一 Windows 用户运行。
 * 解出的会话 JSON **逐字**是 relay-account-pool-service.ts mapCodeartsImport 认的
 * 「桌面端导出格式」(accessKey/secretKey/securitytoken/refresh_token/expires_at/
 * domainId/account:{id,label}/loginContext:{pkcePair,dpopKeyPair})⇒ raw 直通,
 * 归一与凭证拆分全交服务端单一映射(§0.6,本模块零映射)。
 *
 * 分工:node:sqlite(22.x 内置)只读 state.vscdb / node:crypto 做 AES-256-GCM /
 * powershell.exe(Win10+ 自带,不要求 pwsh 7)只做 DPAPI 一步。
 *
 * 安全:令牌/密钥不打印、不落盘;meta 摘要只有 uid/名称/到期/指纹/布尔完备性;
 * 错误信息不含凭据明文;DPAPI 子进程只收密文、只回密钥(管道内,不进日志)。
 *
 * 退出语义(§0.3):取不到输入 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// node:sqlite(22.x experimental)经 createRequire 取用;sqlite 是 CJS 名空间,ESM 无裸 require
const require = createRequire(import.meta.url)

/** 秘密行键前缀(huaweicloud.authentication 扩展的会话;逐字含引号,LIKE 前缀) */
const SECRET_KEY_PREFIX = 'secret://{"extensionId":"huaweicloud.authentication"'
const VSCDB_REL = path.join('User', 'globalStorage', 'state.vscdb')
const LOCAL_STATE = 'Local State'

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * DPAPI CurrentUser 解密(base64 进 base64 出)。
 * 用 Windows 自带 powershell 5.1 的 ProtectedData;失败 throw 带 code(不吞错)。
 */
export function dpapiUnprotectBase64(b64, opts = {}) {
  const script =
    "Add-Type -AssemblyName System.Security; [Console]::OutputEncoding=[Text.Encoding]::UTF8; " +
    "[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect(" +
    `[Convert]::FromBase64String('${b64}'), $null, 'CurrentUser'))`
  const r = spawnSync(
    opts.shellBin ?? 'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  if (r.error || r.status !== 0) {
    const why = r.error?.message ?? `exit ${r.status}`
    throw Object.assign(
      new Error(
        `DPAPI 解密失败(${why}):须以登录 CodeArts 的同一 Windows 用户运行` +
          '(服务/沙箱会话跑在别的用户下时无法解 CurrentUser 密钥)',
      ),
      { code: 'CODEARTS_DPAPI_FAILED' },
    )
  }
  const out = (r.stdout ?? '').trim()
  if (!out) throw Object.assign(new Error('DPAPI 解密输出为空(未判定)'), { code: 'CODEARTS_DPAPI_FAILED' })
  return out
}

/** os_crypt.encrypted_key → AES-256 密钥 Buffer(剥 5B 'DPAPI' 前缀后 DPAPI 解)。 */
export function readAesKeyFromLocalState(localStatePath, opts = {}) {
  const ls = JSON.parse(fs.readFileSync(localStatePath, 'utf8'))
  const enc = ls?.os_crypt?.encrypted_key
  if (typeof enc !== 'string' || enc === '') {
    throw Object.assign(new Error('Local State 缺 os_crypt.encrypted_key(未判定)'), {
      code: 'CODEARTS_BAD_LOCAL_STATE',
    })
  }
  const raw = Buffer.from(enc, 'base64')
  if (raw.subarray(0, 5).toString('ascii') !== 'DPAPI') {
    throw Object.assign(new Error('encrypted_key 缺 DPAPI 前缀(未判定)'), {
      code: 'CODEARTS_BAD_LOCAL_STATE',
    })
  }
  return Buffer.from(dpapiUnprotectBase64(raw.subarray(5).toString('base64'), opts), 'base64')
}

/** Electron safeStorage 密文(v10 + nonce12 + ct + tag16)→ 会话 JSON 对象。 */
export function decryptSafeStorageBlob(blob, aesKey) {
  if (!Buffer.isBuffer(blob) || blob.length < 3 + 12 + 16 || blob.subarray(0, 3).toString('ascii') !== 'v10') {
    throw Object.assign(new Error('会话密文非 v10 形(未判定)'), { code: 'CODEARTS_BAD_BLOB' })
  }
  const nonce = blob.subarray(3, 15)
  const tag = blob.subarray(blob.length - 16)
  const ct = blob.subarray(15, blob.length - 16)
  const d = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce)
  d.setAuthTag(tag)
  const plain = Buffer.concat([d.update(ct), d.final()])
  return JSON.parse(plain.toString('utf8'))
}

/**
 * 只读打开 state.vscdb 并抽 huaweicloud.authentication 的秘密行 → 密文字节数组。
 * 主库打不开(桌面持锁等)退 .backup 兜底;都取不到 ⇒ throw 未判定。
 */
export function readSecretBlobsFromVscdb(roamingDir) {
  const { DatabaseSync } = require('node:sqlite')
  const candidates = [path.join(roamingDir, VSCDB_REL), path.join(roamingDir, VSCDB_REL) + '.backup']
  let lastErr = null
  for (const dbPath of candidates) {
    if (!fs.existsSync(dbPath)) continue
    try {
      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const rows = db
          .prepare("SELECT key, value FROM ItemTable WHERE key LIKE ? || '%'")
          .all(SECRET_KEY_PREFIX)
        const blobs = []
        for (const row of rows) {
          // 值形态两种实测:文本 {"type":"Buffer","data":[…]} 或直接 BLOB
          let bytes = null
          const v = row.value
          if (Buffer.isBuffer(v)) bytes = v
          else if (typeof v === 'string' && v.trim().startsWith('{')) {
            const parsed = JSON.parse(v)
            if (parsed?.type === 'Buffer' && Array.isArray(parsed.data)) bytes = Buffer.from(parsed.data)
          } else if (v && typeof v === 'object' && Array.isArray(v.data)) bytes = Buffer.from(v.data)
          if (bytes) blobs.push({ key: String(row.key), blob: bytes })
        }
        if (blobs.length > 0) return blobs
        lastErr = new Error(`vscdb 里没有 ${SECRET_KEY_PREFIX}… 秘密行(未登录或版本变更)`)
      } finally {
        db.close()
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw Object.assign(
    new Error(
      `state.vscdb 读取失败(${lastErr instanceof Error ? lastErr.message : String(lastErr)})。` +
        '若 CodeArts 桌面正在运行,请先关闭它再重试(库被独占时只读也进不去)',
    ),
    { code: 'CODEARTS_VSCDB_UNREADABLE' },
  )
}

/** 候选数据目录:优先 $env:APPDATA\codearts-agent,兜底扫本机各用户 profile(IHUI_CODEARTS_SCAN_USERS=0 可关)。 */
export function candidateRoamingDirs(env) {
  const e = env ?? process.env
  const bases = []
  if (e.APPDATA) bases.push(e.APPDATA)
  if (e.IHUI_CODEARTS_SCAN_USERS !== '0') {
    const usersRoot = path.join(e.SystemDrive ? `${e.SystemDrive}\\` : 'C:\\', 'Users')
    try {
      for (const u of fs.readdirSync(usersRoot)) {
        const p = path.join(usersRoot, u, 'AppData', 'Roaming')
        if (fs.existsSync(p)) bases.push(p)
      }
    } catch {
      /* 用户根不可读就只认 APPDATA */
    }
  }
  const dirs = []
  for (const b of [...new Set(bases)]) {
    const d = path.join(b, 'codearts-agent')
    if (fs.existsSync(d)) dirs.push(d)
  }
  return [...new Set(dirs)]
}

/** 单会话 stderr 摘要(零凭据明文;AK/SK/DPoP 只报有无布尔)。 */
export function summarizeSession(s) {
  const rec = s ?? {}
  const account = rec.account && typeof rec.account === 'object' ? rec.account : {}
  const login = rec.loginContext && typeof rec.loginContext === 'object' ? rec.loginContext : {}
  const dpop = login.dpopKeyPair && typeof login.dpopKeyPair === 'object' ? login.dpopKeyPair : {}
  return {
    uid: cstr(account.id) || '(缺)',
    name: cstr(account.label) || '(未知号)',
    expiresAt: cstr(rec.expires_at) || '-',
    hasRefresh: cstr(rec.refresh_token) !== '',
    hasAkSk: cstr(rec.accessKey) !== '' && cstr(rec.secretKey) !== '',
    hasDpopJwk: dpop.privateKeyJwk !== null && dpop.privateKeyJwk !== undefined,
    hasCodeVerifier: cstr(login.pkcePair?.codeVerifier) !== '',
    tokenFingerprint: rec.securitytoken ? fingerprintOf(rec.securitytoken) : '-',
    tokenLength: cstr(rec.securitytoken).length,
  }
}

/** 可导入判据:mapCodeartsImport 的硬前提(token+AK+SK)三全才算。 */
export function pickImportableSessions(sessions) {
  const valid = []
  let skipped = 0
  for (const s of Array.isArray(sessions) ? sessions : []) {
    const rec = s ?? {}
    if (cstr(rec.securitytoken) === '' || cstr(rec.accessKey) === '' || cstr(rec.secretKey) === '') {
      skipped++
      continue
    }
    valid.push(rec)
  }
  return { valid, skipped }
}

/**
 * 提取本机 CodeArts 会话 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * @param {{roamingDir?: string, shellBin?: string}} [opts] 仅供测试注入
 */
export async function extractCodeartsAccounts(opts = {}) {
  const dirs = opts.roamingDir ? [opts.roamingDir] : candidateRoamingDirs()
  if (dirs.length === 0) {
    throw Object.assign(
      new Error(
        '未找到 CodeArts 桌面数据目录(%APPDATA%\\codearts-agent 及本机各用户 profile 均无);' +
          '请先在本机登录 CodeArts Agent 客户端',
      ),
      { code: 'CODEARTS_DIR_MISSING' },
    )
  }
  let lastErr = null
  for (const dir of dirs) {
    try {
      const blobs = readSecretBlobsFromVscdb(dir)
      const aesKey = readAesKeyFromLocalState(path.join(dir, LOCAL_STATE), { shellBin: opts.shellBin })
      const sessions = blobs.map((b) => decryptSafeStorageBlob(b.blob, aesKey))
      const { valid, skipped } = pickImportableSessions(sessions)
      if (valid.length === 0) {
        throw Object.assign(
          new Error(`解出 ${sessions.length} 条会话但 0 条三全(token/AK/SK) ⇒ 未判定`),
          { code: 'CODEARTS_NO_SESSIONS' },
        )
      }
      return {
        providerCode: 'codearts',
        accounts: valid,
        meta: { sourceDir: dir, count: valid.length, skipped, sessions: valid.map(summarizeSession) },
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? Object.assign(new Error('未判定'), { code: 'CODEARTS_UNKNOWN' })
}

export const __test__ = {
  decryptSafeStorageBlob,
  readAesKeyFromLocalState,
  candidateRoamingDirs,
  summarizeSession,
  pickImportableSessions,
  SECRET_KEY_PREFIX,
}
