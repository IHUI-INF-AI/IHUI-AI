// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Cursor 本机会话提取器(2026-11-14 装车,对机主账号全链路实测)。
 *
 * 取证链:
 *   - 桌面端数据目录 %APPDATA%\Cursor,会话在 User/globalStorage/state.vscdb(ItemTable);
 *   - 键: cursorAuth/accessToken、cursorAuth/refreshToken(实测存在);
 *   - 值: `cursor-safe-storage:v1:` + base64(Chromium OSCrypt v10 blob:
 *     'v10' + nonce12 + ciphertext + tag16,AES-256-GCM);
 *   - AES 密钥 = 同目录 Local State 的 os_crypt.encrypted_key(DPAPI CurrentUser)——
 *     复用 codearts-auth-extract 的 readAesKeyFromLocalState(§0.6 不抄第二份);
 *   - 明文解封复用 grokbot-auth-extract 的 decryptOscryptV10Blob(v10/v11 同构)。
 *   - machineId = sha256(小写 MachineGuid):上游 x-cursor-checksum 的必需材料,
 *     与 token 同批交给号池(适配器从行内 machineId 列读取)。
 *
 * 安全:token/refreshToken 只进 accounts 载荷,**meta 与错误信息零明文**,
 * 只给 sha256 前 12 位指纹、长度与布尔完备性;不打印、不落盘。
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

// DPAPI + v10 解密单一源:复用已实证实现,不抄第二份
import { readAesKeyFromLocalState } from './codearts-auth-extract.mjs'
import { decryptOscryptV10Blob } from './grokbot-auth-extract.mjs'

/** Cursor safeStorage 值前缀(v1;实测逐字) */
const TOKEN_PREFIX = 'cursor-safe-storage:v1:'
const ACCESS_KEY = 'cursorAuth/accessToken'
const REFRESH_KEY = 'cursorAuth/refreshToken'
const VSCDB_REL = path.join('User', 'globalStorage', 'state.vscdb')
const LOCAL_STATE = 'Local State'

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function fingerprintOf(v) {
  return crypto.createHash('sha256').update(String(v), 'utf8').digest('hex').slice(0, 12)
}

/** base64url JWT 载荷解码(**不验签**,只取声明);非三段式/非 JSON → null */
export function decodeJwtClaims(token) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * machineId = sha256(小写 MachineGuid)。上游 checksum 只认本机这把值;
 * 取不到即 throw(未判定),绝不编造。
 */
export function readCursorMachineId(opts = {}) {
  if (process.platform !== 'win32') {
    throw Object.assign(
      new Error(`当前平台 ${process.platform} 未取证 MachineGuid 读取方式 ⇒ 未判定`),
      { code: 'CURSOR_MACHINE_ID_UNSUPPORTED' },
    )
  }
  const r = spawnSync(
    opts.regBin ?? 'reg',
    ['QUERY', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  if (r.error || r.status !== 0) {
    throw Object.assign(
      new Error(
        `读取 MachineGuid 失败(${r.error?.message ?? `exit ${r.status}`}) ⇒ 未判定`,
      ),
      { code: 'CURSOR_MACHINE_ID_FAILED' },
    )
  }
  const m = String(r.stdout ?? '').match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/)
  if (!m) {
    throw Object.assign(new Error('MachineGuid 输出形状不符 ⇒ 未判定'), {
      code: 'CURSOR_MACHINE_ID_FAILED',
    })
  }
  return crypto.createHash('sha256').update(m[1].toLowerCase()).digest('hex')
}

/**
 * 只读打开 state.vscdb,取 cursorAuth/accessToken 与 refreshToken 的原始值。
 * 主库打不开(桌面持锁等)退 .backup 兜底;都取不到 ⇒ throw 未判定。
 */
export function readCursorAuthValues(roamingDir) {
  const { DatabaseSync } = require('node:sqlite')
  const candidates = [path.join(roamingDir, VSCDB_REL), path.join(roamingDir, VSCDB_REL) + '.backup']
  let lastErr = null
  for (const dbPath of candidates) {
    if (!fs.existsSync(dbPath)) continue
    try {
      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const rows = db
          .prepare('SELECT key, value FROM ItemTable WHERE key IN (?, ?)')
          .all(ACCESS_KEY, REFRESH_KEY)
        const values = new Map()
        for (const row of rows) {
          // 值形态两种实测:文本 / Buffer;统一转字符串
          const v = row.value
          const text = Buffer.isBuffer(v) ? v.toString('utf8') : typeof v === 'string' ? v : ''
          if (text) values.set(String(row.key), text)
        }
        if (values.has(ACCESS_KEY)) return { dbPath, values }
        lastErr = new Error(`${dbPath} 里没有 ${ACCESS_KEY}(未登录或版本变更)`)
      } finally {
        db.close()
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw Object.assign(
    new Error(
      `Cursor state.vscdb 读取失败(${lastErr instanceof Error ? lastErr.message : String(lastErr)})。` +
        '若 Cursor 桌面正在运行,请先关闭它再重试(库被独占时只读也可能进不去)',
    ),
    { code: 'CURSOR_VSCDB_UNREADABLE' },
  )
}

/** 单值解封:`cursor-safe-storage:v1:` + base64(v10 blob) → 明文;无前缀视为旧版明文 */
export function decryptCursorValue(rawValue, aesKey) {
  const raw = cstr(rawValue)
  if (!raw) throw Object.assign(new Error('Cursor 会话值为空(未判定)'), { code: 'CURSOR_EMPTY_VALUE' })
  if (!raw.startsWith(TOKEN_PREFIX)) return { value: raw, encrypted: false }
  return {
    value: decryptOscryptV10Blob(raw.slice(TOKEN_PREFIX.length), aesKey),
    encrypted: true,
  }
}

/** 候选数据目录:优先 $env:APPDATA\Cursor,兜底扫本机各用户 profile(IHUI_CURSOR_SCAN_USERS=0 可关) */
export function candidateCursorDirs(env) {
  const e = env ?? process.env
  const bases = []
  if (e.APPDATA) bases.push(e.APPDATA)
  if (e.IHUI_CURSOR_SCAN_USERS !== '0') {
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
    const d = path.join(b, 'Cursor')
    if (fs.existsSync(d)) dirs.push(d)
  }
  return [...new Set(dirs)]
}

/** 单账号摘要(零凭据回显):uid/邮箱/到期/指纹/长度/refresh 有无/machineId 指纹 */
export function summarizeCursorAccount(account) {
  const claims = decodeJwtClaims(account.token) ?? {}
  const sub = cstr(claims.sub)
  const exp = typeof claims.exp === 'number' ? new Date(claims.exp * 1000) : null
  return {
    uid: sub || '(缺)',
    name:
      cstr(claims.name) ||
      cstr(claims.email) ||
      cstr(account.email) ||
      (sub ? `cursor:${sub.slice(-8)}` : '(未知号)'),
    expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp.toISOString() : '-',
    hasRefresh: cstr(account.refreshToken) !== '',
    tokenFingerprint: fingerprintOf(account.token),
    tokenLength: cstr(account.token).length,
    machineIdFingerprint: fingerprintOf(account.machineId),
  }
}

/**
 * 提取本机 Cursor 会话 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * @param {{roamingDir?: string, regBin?: string, shellBin?: string}} [opts] 仅供测试注入
 */
export async function extractCursorAccounts(opts = {}) {
  const dirs = opts.roamingDir ? [opts.roamingDir] : candidateCursorDirs()
  if (dirs.length === 0) {
    throw Object.assign(
      new Error(
        '未找到 Cursor 桌面数据目录(%APPDATA%\\Cursor 及本机各用户 profile 均无);' +
          '请先在本机登录 Cursor 客户端',
      ),
      { code: 'CURSOR_DIR_MISSING' },
    )
  }
  const machineId = readCursorMachineId(opts)
  let lastErr = null
  for (const dir of dirs) {
    try {
      const { dbPath, values } = readCursorAuthValues(dir)
      const aesKey = readAesKeyFromLocalState(path.join(dir, LOCAL_STATE), {
        shellBin: opts.shellBin,
      })
      const access = decryptCursorValue(values.get(ACCESS_KEY), aesKey).value
      const refreshRaw = values.get(REFRESH_KEY)
      const refreshToken = refreshRaw
        ? decryptCursorValue(refreshRaw, aesKey).value
        : ''
      if (!cstr(access)) {
        throw Object.assign(new Error('accessToken 解出为空(未判定)'), {
          code: 'CURSOR_NO_SESSIONS',
        })
      }
      const claims = decodeJwtClaims(access) ?? {}
      const email = cstr(claims.email)
      const sub = cstr(claims.sub)
      // 名称优先级与号池统一名判据一致:email > name;两者都没有时用 `cursor:<sub 尾8>` 兜底,
      // 让面板里至少能区分是哪个号(不冒充姓名)。
      const name = cstr(claims.name) || email || (sub ? `cursor:${sub.slice(-8)}` : '')
      const account = {
        token: access,
        refreshToken: refreshToken || null,
        machineId,
        ...(email ? { email } : {}),
        ...(name ? { name } : {}),
      }
      return {
        providerCode: 'cursor',
        accounts: [account],
        meta: {
          sourceFile: dbPath,
          count: 1,
          skipped: 0,
          sessions: [summarizeCursorAccount(account)],
        },
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? Object.assign(new Error('未判定'), { code: 'CURSOR_UNKNOWN' })
}

export const __test__ = {
  decodeJwtClaims,
  readCursorMachineId,
  readCursorAuthValues,
  decryptCursorValue,
  candidateCursorDirs,
  summarizeCursorAccount,
  TOKEN_PREFIX,
  ACCESS_KEY,
  REFRESH_KEY,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
