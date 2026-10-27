// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 豆包(字节豆包桌面客户端,Electron,字节账号登录)本机会话提取器(2026-10-27 装车)。
 *
 * 本机取证(2026-10-27,全程只读,§0.9 判据现读,不猜):
 *   - 安装痕迹:%LOCALAPPDATA%\Doubao\{Application,User Data}、%APPDATA%\Doubao(仅
 *     public_config.json)、开始菜单「豆 包\豆包.lnk」;Uninstall 注册表无 DisplayName 匹配
 *     (以目录与快捷方式为准);
 *   - Chromium 布局:%LOCALAPPDATA%\Doubao\User Data\{Default,Local State,…};
 *   - Default\Network\Cookies 实证在盘(123 行),其中 .doubao.com 域的**字节 passport
 *     会话族** cookie:host_key=.doubao.com,键名实证——
 *     sessionid / sessionid_ss / sid_tt / sid_guard / sid_ucp_v1 / ssid_ucp_v1 /
 *     uid_tt / uid_tt_ss / user_token / ttwid / odin_tt / passport_csrf_token /
 *     d_ticket / has_biz_token;另 .bytedance.com 域的 msToken(同族风控票);
 *   - cookie 值 = Chromium os_crypt encrypted_value(v10/v11 前缀 + nonce12 + ct + tag16,
 *     AES-256-GCM,key = User Data\Local State 的 os_crypt.encrypted_key 剥 'DPAPI' 前缀
 *     后 DPAPI CurrentUser 解)—— 与 codearts-auth-extract.mjs 的 v10 解密同构,直接复用
 *     其 DPAPI/密钥实现(§0.6,不抄第二份);须以登录豆包的同一 Windows 用户运行;
 *   - value 列非空的 cookie 是 Chromium 合法明文形态,零解密直接取;
 *   - v20(app-bound)等未知前缀 ⇒ 如实 skipped 点名「未判定」,不猜。
 *
 * 国际版预留:豆包海外版 = Cici(常量 GLOBAL_HOST_SUFFIXES,无本机取证,仅探测量留位)。
 *
 * 分工(§0.6 单一真相源,本模块零映射):命中会话族键名的 {host,name,value}
 * **逐字直通**(不猜字段、不改名、不拼装),归一与凭证拆分全交服务端单一映射。
 *
 * 安全:令牌零回显 —— meta 摘要只打 sha256 前 12 位指纹/长度;错误信息不含凭据明文。
 *
 * 退出语义(§0.3):目录缺失 / 0 命中 / 解密失败一律 throw 带 code(DOUBAO_NO_SESSION 等),
 * 由编排器落 exit 2「未判定」并点名原因;绝不静默返回空数组冒绿。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// node:sqlite(22.x experimental)经 createRequire 取用;与 codearts-auth-extract.mjs 同法
const require = createRequire(import.meta.url)

/** DPAPI/Local State AES 密钥单一源:复用 codearts 提取器已实证的实现(§0.6) */
import { readAesKeyFromLocalState } from './codearts-auth-extract.mjs'

/**
 * 会话族 cookie 键名探测清单(2026-10-27 本机实证的字节 passport 族在前,
 * Electron 通用候选在后;只筛「取哪把钥匙」,不做字段映射,§0.6)。
 */
const SESSION_COOKIE_NAMES = [
  'sessionid',
  'sessionid_ss',
  'sid_tt',
  'sid_guard',
  'sid_ucp_v1',
  'ssid_ucp_v1',
  'uid_tt',
  'uid_tt_ss',
  'user_token',
  'msToken',
  'ttwid',
  'odin_tt',
  'session_token',
  'session',
  'sid',
]

/** 国内域(实证:.doubao.com 会话族 + .bytedance.com msToken) */
const HOST_SUFFIXES = ['.doubao.com', '.bytedance.com']
/** 海外版 Cici 预留(无本机取证,待装后再实证;现在只作探测量留位) */
const GLOBAL_HOST_SUFFIXES = ['.cici.com']

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Chromium os_crypt cookie 密文(v10/v11 + nonce12 + ct + tag16,AES-256-GCM)→ 明文字符串。
 * cookie 值非 JSON ⇒ 不做 JSON.parse;前缀非 v10/v11(v20 app-bound 等)⇒ throw 未判定。
 */
export function decryptOsCryptString(blob, aesKey) {
  if (!Buffer.isBuffer(blob) || blob.length < 3 + 12 + 16) {
    throw Object.assign(new Error('cookie 密文长度不足 v10 形(未判定)'), { code: 'DOUBAO_BAD_BLOB' })
  }
  const prefix = blob.subarray(0, 3).toString('ascii')
  if (prefix !== 'v10' && prefix !== 'v11') {
    throw Object.assign(
      new Error(`cookie 密文前缀 ${prefix} 非 v10/v11(app-bound 等形态未判定)`),
      { code: 'DOUBAO_BAD_BLOB' },
    )
  }
  const nonce = blob.subarray(3, 15)
  const tag = blob.subarray(blob.length - 16)
  const ct = blob.subarray(15, blob.length - 16)
  const d = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
}

/**
 * 只读读取指定 profile 的 Cookies 库,按 域×键名 双过滤抽会话族。
 * 明文 value 直接取;encrypted_value 走 v10/v11 解密;其余形态 skipped 点名。
 */
export function readCookieSessionRows(userDataDir, profile, opts = {}) {
  const { DatabaseSync } = require('node:sqlite')
  const dbPath = path.join(userDataDir, profile, 'Network', 'Cookies')
  if (!fs.existsSync(dbPath)) {
    return {
      entries: [],
      skips: [`Cookies 库不存在: ${path.join(profile, 'Network', 'Cookies')}`],
      dbPath,
    }
  }
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
  } catch (e) {
    throw Object.assign(
      new Error(
        `Cookies 库只读打开失败(${e instanceof Error ? e.message : String(e)})。` +
          '若豆包客户端正在运行,请先关闭它再重试(库被独占时只读也进不去)',
      ),
      { code: 'DOUBAO_COOKIES_UNREADABLE' },
    )
  }
  const entries = []
  const skips = []
  let aesKey = null
  try {
    const rows = db.prepare('SELECT host_key, name, value, encrypted_value FROM cookies').all()
    for (const row of rows) {
      const host = cstr(row.host_key)
      const name = cstr(row.name)
      const allSuffixes = [...HOST_SUFFIXES, ...GLOBAL_HOST_SUFFIXES]
      if (!allSuffixes.some((s) => host.endsWith(s))) continue
      if (!SESSION_COOKIE_NAMES.includes(name)) continue
      if (cstr(row.value) !== '') {
        entries.push({ source: 'cookies', key: name, host, value: row.value })
        continue
      }
      const blob = Buffer.isBuffer(row.encrypted_value)
        ? row.encrypted_value
        : row.encrypted_value && row.encrypted_value.data
          ? Buffer.from(row.encrypted_value.data)
          : null
      if (!blob || blob.length === 0) {
        skips.push(`cookie ${host}/${name} 无 value 也无 encrypted_value(未判定)`)
        continue
      }
      // 密文形态预检(先于 DPAPI 取钥):非 v10/v11 形不劳师动众,直接 skipped 点名
      const prefix = blob.length >= 3 ? blob.subarray(0, 3).toString('ascii') : ''
      if (blob.length < 31 || (prefix !== 'v10' && prefix !== 'v11')) {
        skips.push(
          `cookie ${host}/${name} 密文非 v10/v11 形(${prefix || '空前缀'},app-bound 等形态未判定)`,
        )
        continue
      }
      if (!aesKey) {
        try {
          aesKey = readAesKeyFromLocalState(path.join(userDataDir, 'Local State'), {
            shellBin: opts.shellBin,
          })
        } catch (e) {
          throw Object.assign(
            new Error(`Local State AES 密钥取失败: ${e instanceof Error ? e.message : String(e)}`),
            { code: 'DOUBAO_BAD_LOCAL_STATE' },
          )
        }
      }
      try {
        entries.push({
          source: 'cookies',
          key: name,
          host,
          value: decryptOsCryptString(blob, aesKey),
        })
      } catch (e) {
        skips.push(`cookie ${host}/${name} 解密未判定: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } finally {
    db.close()
  }
  return { entries, skips, dbPath }
}

/**
 * 候选数据目录:%LOCALAPPDATA%\Doubao\User Data(实证布局)+
 * %APPDATA%\Doubao(仅 public_config,无会话,不采纳)+ 本机各用户 profile 扫描
 * (IHUI_DOUBAO_SCAN_USERS=0 可关)。
 */
export function candidateUserDataDirs(env) {
  const e = env ?? process.env
  const bases = []
  if (e.LOCALAPPDATA) bases.push(path.join(e.LOCALAPPDATA, 'Doubao', 'User Data'))
  if (e.IHUI_DOUBAO_SCAN_USERS !== '0') {
    const usersRoot = path.join(e.SystemDrive ? `${e.SystemDrive}\\` : 'C:\\', 'Users')
    try {
      for (const u of fs.readdirSync(usersRoot)) {
        const p = path.join(usersRoot, u, 'AppData', 'Local', 'Doubao', 'User Data')
        if (fs.existsSync(p)) bases.push(p)
      }
    } catch {
      /* 用户根不可读就只认 LOCALAPPDATA */
    }
  }
  return [...new Set(bases)].filter((d) => fs.existsSync(d))
}

/** 单条 stderr 摘要(零凭据明文;只打指纹/长度/来源) */
export function summarizeEntry(e) {
  const rec = e ?? {}
  return {
    source: cstr(rec.source) || '(未知源)',
    key: cstr(rec.key) || '(未知键)',
    host: cstr(rec.host) || '-',
    valueLength: cstr(rec.value).length,
    valueFingerprint: rec.value ? fingerprintOf(rec.value) : '-',
  }
}

/** 可导入判据:值非空即算(值 = raw 直通;形状判读全交服务端,本模块零映射) */
export function pickImportableEntries(entries) {
  const valid = []
  let skipped = 0
  for (const e of Array.isArray(entries) ? entries : []) {
    const rec = e ?? {}
    if (cstr(rec.value) === '') {
      skipped++
      continue
    }
    valid.push(rec)
  }
  return { valid, skipped }
}

/**
 * 提取本机豆包会话 → 编排器 payload。目录缺失(COOKIE 库也不在)⇒ DOUBAO_NO_SESSION;
 * 0 命中 ⇒ DOUBAO_NO_SESSION;库打不开 ⇒ DOUBAO_COOKIES_UNREADABLE。绝不静默返回空。
 * @param {{userDataDir?: string, profile?: string, shellBin?: string}} [opts] 仅供测试注入
 */
export async function extractDoubaoAccounts(opts = {}) {
  const dirs = opts.userDataDir ? [opts.userDataDir] : candidateUserDataDirs()
  const existing = dirs.filter((d) => fs.existsSync(d))
  if (existing.length === 0) {
    throw Object.assign(
      new Error(
        '未找到豆包数据目录(%LOCALAPPDATA%\\Doubao\\User Data 及本机各用户 profile 均无;' +
          '可能未安装或装在非默认盘)⇒ 未判定',
      ),
      { code: 'DOUBAO_NO_SESSION' },
    )
  }
  let lastErr = null
  for (const dir of existing) {
    try {
      const { entries, skips, dbPath } = readCookieSessionRows(
        dir,
        opts.profile ?? 'Default',
        { shellBin: opts.shellBin },
      )
      const { valid, skipped } = pickImportableEntries(entries)
      if (valid.length === 0) {
        throw Object.assign(
          new Error(
            `Cookies 库在盘但 0 条会话族命中(未登录或键名/域清单过期 ⇒ 未判定)。` +
              `取证注记: ${skips.join('; ') || '(无)'}`,
          ),
          { code: 'DOUBAO_NO_SESSION' },
        )
      }
      return {
        providerCode: 'doubao',
        accounts: valid,
        meta: {
          sourceDir: dir,
          dbPath,
          count: valid.length,
          skipped,
          notes: skips,
          cookieNamesProbed: SESSION_COOKIE_NAMES,
          sessions: valid.map(summarizeEntry),
        },
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? Object.assign(new Error('未判定'), { code: 'DOUBAO_UNKNOWN' })
}

export const __test__ = {
  decryptOsCryptString,
  readCookieSessionRows,
  candidateUserDataDirs,
  summarizeEntry,
  pickImportableEntries,
  SESSION_COOKIE_NAMES,
  HOST_SUFFIXES,
  GLOBAL_HOST_SUFFIXES,
}