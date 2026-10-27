// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Loomy(科大讯飞 Loomy 桌面 Agent,Electron,loomy.xunfei.cn)本机会话提取器(2026-10-27 装车)。
 *
 * 本机取证(2026-10-27,全程只读,§0.9 判据现读,不猜):
 *   - 数据目录 %APPDATA%\Loomy\(Electron 标准 userData 布局:Local Storage/leveldb、
 *     IndexedDB、Session Storage、Network/Cookies、Partitions、Preferences);
 *   - Local Storage leveldb 的 origin 是 `_file://`(桌面壳直载 file:// 页面),实证键名:
 *     loomy-current-task / loomy-points-summary / loomy-task-souls /
 *     loomy:local-draft:ses_* / loomy:selected-model:ses_* /
 *     loomy-input-todo-panel-state-by-session-v1 / workspace-directory 等,
 *     另有 `login-phone` 呈**独立键形态**(000005.ldb,经前缀压缩字节判定;值未读不回显);
 *   - `loomy-points-summary` 的**值内**含 "tokens":{…} 字段 —— 那是 LLM token 用量,
 *     不是登录凭证,不得当会话票;
 *   - Cookies:主库(%APPDATA%\Loomy\Network\Cookies)0 行;分区库
 *     Partitions\loomy-browser-default 下无 Cookies 文件;Session Storage 无 file:// 键;
 *   - **2026-10-27 源码级实证升级**(G:\Loomy\resources\app.asar 字符串取证):
 *     ① 登录会话持久化键 = localStorage **`loomy-auth-session`**,写入结构
 *     `JSON.stringify({phone, maskedPhone, session, userid, loggedInAt})`(session 字段
 *     即会话票;asar @51319631 setItem(jo,…) 一手证据);配套键 `loomy-last-login-phone`
 *     (Xb,明文手机号)与 `loomy-user-identity`(Oh);手机号正则 /^1[3-9]\d{9}$/;
 *     ② 设备凭证走 DeviceCredentialVault(app.asar.unpacked\electron\cross-end-sync\
 *     device-credential-vault.js):Electron safeStorage(v10 DPAPI 同构)加密后存
 *     `<userData>\shared-session-sync\[environments\<scopeKey>\]device-credential.json`,
 *     字段 {version, scope_key, encrypted(base64), device_id, app_id, status} ——
 *     本机 2026-10-27 现读:该目录不存在 + localStorage 无 loomy-auth-session 键
 *     ⇒ **未登录态**,两路径探测照常走,登录后即可提取;
 *   - 结论:提取器按「源码实证键 + Electron 通用候选键」双路径探测
 *     (Local Storage leveldb + Cookies + device-credential.json 探测注记),
 *     取不到 ⇒ LOOMY_NO_SESSION(未判定,不冒绿)。
 *
 * 分工(§0.6 单一真相源,本模块零映射):leveldb/cookie 取证只读;命中候选键的值
 * **逐字直通**(不猜字段、不改名、不拼装),归一与凭证拆分全交服务端单一映射。
 * 值抽取是字节级扫描(leveldb log/sstable 直读):值截断/跨块/压缩 ⇒ 解析不出完整值
 * 就如实丢给 skipped 并点名,绝不补猜。
 *
 * 安全:令牌零回显 —— meta 摘要只打 sha256 前 12 位指纹/长度;错误信息不含凭据明文;
 * DPAPI 子进程只收密文、只回密钥(管道内,不进日志)。
 *
 * 退出语义(§0.3):取不到输入 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// node:sqlite(22.x experimental)经 createRequire 取用;与 codearts-auth-extract.mjs 同法
const require = createRequire(import.meta.url)

/** DPAPI/v10 解密单一源:直接复用 codearts 提取器已实证的实现(§0.6,不抄第二份解密器) */
import { readAesKeyFromLocalState } from './codearts-auth-extract.mjs'

/**
 * Local Storage 候选键名探测清单(只筛「取哪把钥匙」,不做字段映射,§0.6):
 * ① 源码实证键在前(loomy-auth-session = 登录会话主键,asar setItem 一手证据);
 * ② 配套键(loomy-last-login-phone/loomy-user-identity,asar 常量 Xb/Oh);
 * ③ 早前本机取证键(login-phone);④ Electron 通用会话键候选在后。
 */
const LOCAL_STORAGE_KEY_CANDIDATES = [
  'loomy-auth-session',
  'loomy-last-login-phone',
  'loomy-user-identity',
  'login-phone',
  'loomy-login-phone',
  'loomy-session',
  'loomy-token',
  'loomy-user',
  'session',
  'session_token',
  'accessToken',
  'access_token',
  'refresh_token',
  'auth',
]

/** Cookies 候选键名(同口径:探测清单非映射) */
const COOKIE_NAME_CANDIDATES = ['session', 'sessionid', 'sid', 'token', 'sso', 'sso_token']

/** Cookie 域过滤:讯飞系(实证域 loomy.xunfei.cn;海外如有待装后再补) */
const COOKIE_HOST_SUFFIXES = ['.xunfei.cn']

/** 值扫描上限(防大值拖爆内存;超限值本来也属截断 ⇒ 未判定) */
const VALUE_SCAN_MAX = 64 * 1024

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Chromium os_crypt cookie 密文(v10/v11 前缀 + nonce12 + ct + tag16,AES-256-GCM)→ 明文字符串。
 * 与 codearts 的 safeStorage 解密同构,但 cookie 值不是 JSON ⇒ 不做 JSON.parse。
 * 前缀非 v10/v11(v20 app-bound 等)⇒ throw 未判定,由调用方记 skipped 点名。
 */
export function decryptOsCryptString(blob, aesKey) {
  if (!Buffer.isBuffer(blob) || blob.length < 3 + 12 + 16) {
    throw Object.assign(new Error('cookie 密文长度不足 v10 形(未判定)'), { code: 'LOOMY_BAD_BLOB' })
  }
  const prefix = blob.subarray(0, 3).toString('ascii')
  if (prefix !== 'v10' && prefix !== 'v11') {
    throw Object.assign(
      new Error(`cookie 密文前缀 ${prefix} 非 v10/v11(app-bound 等形态未判定)`),
      { code: 'LOOMY_BAD_BLOB' },
    )
  }
  const nonce = blob.subarray(3, 15)
  const tag = blob.subarray(blob.length - 16)
  const ct = blob.subarray(15, blob.length - 16)
  const d = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
}

/** 从键尾抽取值段:到首个控制字节(<0x20)为止(leveldb 记录框头/下一记录以二进制开头) */
function extractValueAfter(buf, keyStart, keyLen) {
  const end = Math.min(buf.length, keyStart + keyLen + VALUE_SCAN_MAX)
  let v = keyStart + keyLen
  while (v < end && buf[v] >= 0x20) v++
  return v > keyStart + keyLen ? buf.subarray(keyStart + keyLen, v).toString('utf8') : ''
}

/** 值段收形:优先整段 JSON;截断则配平花括号重试;仍不行按可打印串原样(直通,不补猜) */
export function finalizeValue(rawStr) {
  const t = String(rawStr ?? '').trim()
  if (!t) return null
  try {
    JSON.parse(t)
    return t
  } catch {
    /* fallthrough */
  }
  const cut = cutBalancedJson(t)
  if (cut) {
    try {
      JSON.parse(cut)
      return cut
    } catch {
      /* fallthrough */
    }
  }
  return t
}

/** 从字符串里截出第一段配平的 {…}(串内引号感知);截不出完整 JSON ⇒ null */
export function cutBalancedJson(s) {
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

/** 只读探测 DeviceCredentialVault 落点(存在与否如实进 notes;密文不解不导,仅指路) */
export function probeDeviceCredentialVault(dir) {
  const root = path.join(dir, 'shared-session-sync')
  if (!fs.existsSync(root)) return []
  const hits = []
  const direct = path.join(root, 'device-credential.json')
  if (fs.existsSync(direct)) hits.push(path.relative(dir, direct))
  const envRoot = path.join(root, 'environments')
  try {
    if (fs.existsSync(envRoot)) {
      for (const scope of fs.readdirSync(envRoot)) {
        const p = path.join(envRoot, scope, 'device-credential.json')
        if (fs.existsSync(p)) hits.push(path.relative(dir, p))
      }
    }
  } catch {
    /* environments 不可读就只认直连路径 */
  }
  return hits
}

/**
 * 只读扫描 Local Storage leveldb(log + sst)里命中候选键的记录。
 * 键匹配后必须紧跟非键字符(防 `session` 吃进 `session_token` 前缀)。
 * 压缩块/跨块值取不出完整 JSON ⇒ 按 finalizeValue 兜底,取不到就丢(不猜)。
 */
export function scanLocalStorageEntries(dir) {
  const ldbDir = path.join(dir, 'Local Storage', 'leveldb')
  if (!fs.existsSync(ldbDir)) return { entries: [], skips: ['Local Storage\\leveldb 不存在'] }
  const anchor = Buffer.from('_file://\x00\x01', 'latin1')
  const byKey = new Map()
  // 键前缀守卫:短键命中的位置若实为更长候选键(如 session → session_token)则跳过。
  // 注意不能按字符类判定 —— 凭证值(手机号/token)常以字母数字开头,值/键边界只认候选键全集。
  const longerCandidates = LOCAL_STORAGE_KEY_CANDIDATES.map((key) => ({
    key,
    bytes: Buffer.concat([anchor, Buffer.from(key, 'latin1')]),
  }))
  const files = fs
    .readdirSync(ldbDir)
    .filter((f) => f.endsWith('.log') || f.endsWith('.ldb'))
    .sort()
  for (const f of files) {
    const buf = fs.readFileSync(path.join(ldbDir, f))
    for (const key of LOCAL_STORAGE_KEY_CANDIDATES) {
      const pat = Buffer.concat([anchor, Buffer.from(key, 'latin1')])
      let i = 0
      for (;;) {
        i = buf.indexOf(pat, i)
        if (i === -1) break
        const coveredByLonger = longerCandidates.some(
          (c) => c.key.length > key.length && buf.subarray(i, i + c.bytes.length).equals(c.bytes),
        )
        if (!coveredByLonger) {
          const value = finalizeValue(extractValueAfter(buf, i, pat.length))
          if (value) byKey.set(key, { source: 'local-storage', key, value, file: f })
        }
        i += pat.length
      }
    }
  }
  const entries = [...byKey.values()]
  return {
    entries,
    skips: entries.length === 0 ? ['Local Storage 命中 0 条候选键(实证:全为 loomy-* 应用状态键)'] : [],
  }
}

/**
 * 只读 Cookies 取证:主库 + loomy-browser-default 分区库;域/键名双过滤。
 * value 列非空 = Chromium 合法明文,直接取;否则 encrypted_value 走 v10/v11 解密
 * (AES key 来自 Local State,DPAPI 一步,须同一 Windows 用户);其余形态记 skipped 点名。
 */
export function readCookieEntries(dir, opts = {}) {
  const { DatabaseSync } = require('node:sqlite')
  const dbPaths = [
    path.join(dir, 'Network', 'Cookies'),
    path.join(dir, 'Partitions', 'loomy-browser-default', 'Network', 'Cookies'),
  ]
  const entries = []
  const skips = []
  let aesKey = null
  for (const dbPath of dbPaths) {
    if (!fs.existsSync(dbPath)) {
      skips.push(`Cookies 库不存在: ${path.relative(dir, dbPath)}`)
      continue
    }
    let db
    try {
      db = new DatabaseSync(dbPath, { readOnly: true })
    } catch (e) {
      skips.push(`Cookies 库只读打开失败(${e instanceof Error ? e.message : String(e)})`)
      continue
    }
    try {
      const rows = db.prepare('SELECT host_key, name, value, encrypted_value FROM cookies').all()
      for (const row of rows) {
        const host = cstr(row.host_key)
        const name = cstr(row.name)
        if (!COOKIE_HOST_SUFFIXES.some((s) => host.endsWith(s))) continue
        if (!COOKIE_NAME_CANDIDATES.includes(name)) continue
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
            aesKey = readAesKeyFromLocalState(path.join(dir, 'Local State'), {
              shellBin: opts.shellBin,
            })
          } catch (e) {
            throw Object.assign(
              new Error(`Local State AES 密钥取失败: ${e instanceof Error ? e.message : String(e)}`),
              { code: 'LOOMY_BAD_LOCAL_STATE' },
            )
          }
        }
        try {
          entries.push({ source: 'cookies', key: name, host, value: decryptOsCryptString(blob, aesKey) })
        } catch (e) {
          skips.push(`cookie ${host}/${name} 解密未判定: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    } finally {
      db.close()
    }
  }
  return { entries, skips }
}

/** 候选数据目录:$APPDATA\Loomy + 本机各用户 profile 扫描(IHUI_LOOMY_SCAN_USERS=0 可关) */
export function candidateRoamingDirs(env) {
  const e = env ?? process.env
  const bases = []
  if (e.APPDATA) bases.push(e.APPDATA)
  if (e.IHUI_LOOMY_SCAN_USERS !== '0') {
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
    const d = path.join(b, 'Loomy')
    if (fs.existsSync(d)) dirs.push(d)
  }
  return [...new Set(dirs)]
}

/** 单条目的 stderr 摘要(零凭据明文;只打指纹/长度/来源) */
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
 * 提取本机 Loomy 会话 → 编排器 payload。目录缺失 / 0 命中 / 解密失败一律 throw 带 code,
 * 绝不静默返回空数组冒绿(§0.3)。
 * @param {{roamingDir?: string, shellBin?: string}} [opts] 仅供测试注入
 */
export async function extractLoomyAccounts(opts = {}) {
  const dirs = opts.roamingDir ? [opts.roamingDir] : candidateRoamingDirs()
  const existing = dirs.filter((d) => fs.existsSync(d))
  if (existing.length === 0) {
    throw Object.assign(
      new Error(
        '未找到 Loomy 数据目录(%APPDATA%\\Loomy 及本机各用户 profile 均无);' +
          '请先在本机安装并登录 Loomy 客户端 ⇒ 未判定',
      ),
      { code: 'LOOMY_NO_SESSION' },
    )
  }
  let lastErr = null
  for (const dir of existing) {
    try {
      const ls = scanLocalStorageEntries(dir)
      const ck = readCookieEntries(dir, { shellBin: opts.shellBin })
      const vaultHits = probeDeviceCredentialVault(dir)
      const vaultNotes = vaultHits.length
        ? [
            `DeviceCredentialVault 落点在盘(未解未导,登录后可作为设备票源): ${vaultHits.join('; ')}`,
          ]
        : []
      const all = [...ls.entries, ...ck.entries]
      const notes = [...ls.skips, ...ck.skips, ...vaultNotes]
      const { valid, skipped } = pickImportableEntries(all)
      if (valid.length === 0) {
        throw Object.assign(
          new Error(
            `目录在盘但 0 条会话候选命中(源码实证主键 loomy-auth-session 未出现 ⇒ ` +
              `本机 Loomy 处于未登录态;登录后重跑即可)。取证注记: ${notes.join('; ') || '(无)'}`,
          ),
          { code: 'LOOMY_NO_SESSION' },
        )
      }
      return {
        providerCode: 'loomy',
        accounts: valid,
        meta: {
          sourceDir: dir,
          count: valid.length,
          skipped,
          notes,
          keysProbed: LOCAL_STORAGE_KEY_CANDIDATES,
          sessions: valid.map(summarizeEntry),
        },
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? Object.assign(new Error('未判定'), { code: 'LOOMY_UNKNOWN' })
}

export const __test__ = {
  decryptOsCryptString,
  finalizeValue,
  cutBalancedJson,
  scanLocalStorageEntries,
  readCookieEntries,
  candidateRoamingDirs,
  probeDeviceCredentialVault,
  summarizeEntry,
  pickImportableEntries,
  LOCAL_STORAGE_KEY_CANDIDATES,
  COOKIE_NAME_CANDIDATES,
  COOKIE_HOST_SUFFIXES,
}