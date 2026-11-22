// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通义灵码(lingma,阿里)本机会话提取器(2026-10-27 装车,补 FROM_PROVIDERS.lingma=null 的缺口)。
 *
 * 取证链(2026-10-27 本机实读,§0.9 判据现读,不猜):
 *   - 本机未装灵码:%USERPROFILE%\.lingma 与
 *     %APPDATA%\Code\User\globalStorage\alibaba.lingma 均不存在 ⇒
 *     两路探测都按「缺失即报错」设计,绝不冒绿。
 *   - 公开取证(阿里公开文档/社区共识,**字段级形状未在本机实证**,不猜字段):
 *     VS Code/JetBrains 插件登录态在 %APPDATA%\Code\User\globalStorage\alibaba.lingma
 *     (JetBrains 版在对应 JetBrains 配置目录,键名未取证 ⇒ 本版不解析、只在报错里点名);
 *     凭证文件 C:\Users\{用户名}\.lingma\credentials(macOS/Linux 为 ~/.lingma/credentials)。
 *   - globalStorage 的 state.vscdb 若存在,按 secret 行只读解密(抄
 *     codearts-auth-extract.mjs 的 node:sqlite + createRequire + DPAPI 套路);
 *     扩展 id 精确串未实证 ⇒ 用 'secret://' + '%lingma%' 双 LIKE 宽探,不猜精确键形。
 *
 * 地域预留:国内 aliyun.com / 国际 alibabacloud.com 两套域名常量都给
 * (LINGMA_REGION_HOSTS,适配器按 secrets.region 选端点);提取器零映射,不读地域。
 *
 * 分工:node:sqlite(22.x 内置)只读 state.vscdb / node:crypto 做 AES-256-GCM /
 * powershell.exe(Win10+ 自带)只做 DPAPI 一步。
 *
 * 安全:令牌零回显——meta 摘要只有键名/类型/串长 + token 族字段的 sha256 前 12 位指纹。
 * 单一真相源(§0.6):credentials 文件与解密出的会话 JSON **逐字**直通,
 * 归一与凭证拆分全交服务端单一映射,本模块零映射。
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

/** 地域域名常量预留(国内 aliyun.com / 国际 alibabacloud.com;适配器消费,提取器零映射) */
export const LINGMA_REGION_HOSTS = Object.freeze({
  cn: 'dashscope.aliyuncs.com',
  intl: 'dashscope-intl.aliyuncs.com',
})

/** VS Code 扩展 globalStorage 目录名候选(精确扩展 id 未实证,两个公开名都探) */
const VSC_STORAGE_EXTS = ['alibaba.lingma', 'alibabacloud.lingma']
const VSCDB_REL = path.join('Code', 'User', 'globalStorage')
const LOCAL_STATE = 'Local State'
/** 凭证文件相对路径:Windows 是 %USERPROFILE%\.lingma\credentials,macOS/Linux 同形 */
const CRED_REL = path.join('.lingma', 'credentials')

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
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
        `DPAPI 解密失败(${why}):须以登录灵码的同一 Windows 用户运行` +
          '(服务/沙箱会话跑在别的用户下时无法解 CurrentUser 密钥)',
      ),
      { code: 'LINGMA_DPAPI_FAILED' },
    )
  }
  const out = (r.stdout ?? '').trim()
  if (!out) throw Object.assign(new Error('DPAPI 解密输出为空(未判定)'), { code: 'LINGMA_DPAPI_FAILED' })
  return out
}

/** os_crypt.encrypted_key → AES-256 密钥 Buffer(剥 5B 'DPAPI' 前缀后 DPAPI 解)。 */
export function readAesKeyFromLocalState(localStatePath, opts = {}) {
  const ls = JSON.parse(fs.readFileSync(localStatePath, 'utf8'))
  const enc = ls?.os_crypt?.encrypted_key
  if (typeof enc !== 'string' || enc === '') {
    throw Object.assign(new Error('Local State 缺 os_crypt.encrypted_key(未判定)'), {
      code: 'LINGMA_BAD_LOCAL_STATE',
    })
  }
  const raw = Buffer.from(enc, 'base64')
  if (raw.subarray(0, 5).toString('ascii') !== 'DPAPI') {
    throw Object.assign(new Error('encrypted_key 缺 DPAPI 前缀(未判定)'), {
      code: 'LINGMA_BAD_LOCAL_STATE',
    })
  }
  return Buffer.from(dpapiUnprotectBase64(raw.subarray(5).toString('base64'), opts), 'base64')
}

/** Electron safeStorage 密文(v10 + nonce12 + ct + tag16)→ 会话 JSON 对象。 */
export function decryptSafeStorageBlob(blob, aesKey) {
  if (!Buffer.isBuffer(blob) || blob.length < 3 + 12 + 16 || blob.subarray(0, 3).toString('ascii') !== 'v10') {
    throw Object.assign(new Error('会话密文非 v10 形(未判定)'), { code: 'LINGMA_BAD_BLOB' })
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
 * 只读打开 state.vscdb 并抽 lingma 秘密行 → 解密后的会话 JSON 数组。
 * 无秘密行返回 [](调用方继续下一候选);库打不开 throw(未判定)。
 */
export function readSecretRecordsFromVscdb(globalStorageDir, opts = {}) {
  const vscdb = path.join(globalStorageDir, 'state.vscdb')
  if (!fs.existsSync(vscdb)) return []
  const { DatabaseSync } = require('node:sqlite')
  let db
  try {
    db = new DatabaseSync(vscdb, { readOnly: true })
  } catch (e) {
    throw Object.assign(
      new Error(
        `state.vscdb 只读打开失败(${e instanceof Error ? e.message : String(e)});` +
          '若 VS Code 正在运行请先关闭再试(库被独占时只读也进不去)',
      ),
      { code: 'LINGMA_VSCDB_UNREADABLE' },
    )
  }
  try {
    // 扩展 id 精确串未实证 ⇒ 'secret://' + '%lingma%' 双 LIKE 宽探(LIKE 对 ASCII 不区分大小写)
    const rows = db
      .prepare("SELECT key, value FROM ItemTable WHERE key LIKE 'secret://%' AND key LIKE '%lingma%'")
      .all()
    const blobs = []
    for (const row of rows) {
      // 值形态两种实测(codearts 同构):文本 {"type":"Buffer","data":[…]} 或直接 BLOB
      let bytes = null
      const v = row.value
      if (Buffer.isBuffer(v)) bytes = v
      else if (typeof v === 'string' && v.trim().startsWith('{')) {
        const parsed = JSON.parse(v)
        if (parsed?.type === 'Buffer' && Array.isArray(parsed.data)) bytes = Buffer.from(parsed.data)
      } else if (v && typeof v === 'object' && Array.isArray(v.data)) bytes = Buffer.from(v.data)
      if (bytes) blobs.push(bytes)
    }
    if (blobs.length === 0) return []
    // Local State 在 VS Code user-data 根(globalStorage 上两级:%APPDATA%\Code)
    const userDataDir = path.dirname(path.dirname(globalStorageDir))
    const aesKey = readAesKeyFromLocalState(path.join(userDataDir, LOCAL_STATE), opts)
    return blobs.map((b) => decryptSafeStorageBlob(b, aesKey))
  } finally {
    db.close()
  }
}

/** 读 credentials 文件:缺失 ⇒ NO_SESSION;权限不足/被占用 ⇒ UNREADABLE;非 JSON 对象 ⇒ BAD。 */
function readCredentialsFile(credPath) {
  let text
  try {
    text = fs.readFileSync(credPath, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT') {
      throw Object.assign(new Error(`${credPath} 不存在(未登录灵码或未装插件)`), {
        code: 'LINGMA_NO_SESSION',
      })
    }
    throw Object.assign(
      new Error(
        `${credPath} 读取失败(${e instanceof Error ? e.message : String(e)};权限不足或被占用)`,
      ),
      { code: 'LINGMA_CRED_UNREADABLE' },
    )
  }
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('非 JSON 对象')
    return parsed
  } catch {
    throw Object.assign(new Error(`${credPath} 内容不是 JSON 对象(格式已变更?)`), {
      code: 'LINGMA_BAD_CREDENTIALS',
    })
  }
}

/** 候选用户根:优先 USERPROFILE/HOME,兜底扫本机各用户 profile(IHUI_LINGMA_SCAN_USERS=0 可关)。 */
export function candidateHomeDirs(env) {
  const e = env ?? process.env
  const homes = []
  if (e.USERPROFILE) homes.push(e.USERPROFILE)
  if (e.HOME && e.HOME !== e.USERPROFILE) homes.push(e.HOME)
  if (e.IHUI_LINGMA_SCAN_USERS !== '0') {
    const usersRoot = path.join(e.SystemDrive ? `${e.SystemDrive}\\` : 'C:\\', 'Users')
    try {
      for (const u of fs.readdirSync(usersRoot)) {
        const p = path.join(usersRoot, u)
        if (fs.existsSync(p)) homes.push(p)
      }
    } catch {
      /* 用户根不可读就只认 USERPROFILE/HOME */
    }
  }
  return [...new Set(homes)].filter((h) => fs.existsSync(h))
}

/** 候选 APPDATA 根:优先 %APPDATA%,兜底扫本机各用户 profile(IHUI_LINGMA_SCAN_USERS=0 可关)。 */
export function candidateAppDataDirs(env) {
  const e = env ?? process.env
  const bases = []
  if (e.APPDATA) bases.push(e.APPDATA)
  if (e.IHUI_LINGMA_SCAN_USERS !== '0') {
    const usersRoot = path.join(e.SystemDrive ? `${e.SystemDrive}\\` : 'C:\\', 'Users')
    try {
      for (const u of fs.readdirSync(usersRoot)) {
        const p = path.join(usersRoot, u, 'AppData', 'Roaming')
        if (fs.existsSync(p)) bases.push(p)
      }
    } catch {
      /* 同上 */
    }
  }
  return [...new Set(bases)].filter((b) => fs.existsSync(b))
}

/** 单记录摘要(零回显):只报键名/类型/串长 + token 族字段的 sha256 前 12 位指纹。 */
export function summarizeRecord(rec) {
  const TOKEN_KEY_RE = /token|key|secret|credential|authorization/i
  const keys = []
  const fields = []
  const tokenFingerprints = {}
  for (const [k, v] of Object.entries(rec ?? {})) {
    keys.push(k)
    const field = { key: k, type: Array.isArray(v) ? 'array' : typeof v }
    if (typeof v === 'string') field.stringLength = v.length
    fields.push(field)
    if (typeof v === 'string' && v !== '' && TOKEN_KEY_RE.test(k)) {
      tokenFingerprints[k] = fingerprintOf(v)
    }
  }
  return { keys, fields, tokenFingerprints }
}

/** 可导入判据(零映射):非空 JSON 对象即通过;字段挑选全交服务端单一映射(§0.6)。 */
export function pickImportableRecords(records) {
  const valid = []
  let skipped = 0
  for (const r of Array.isArray(records) ? records : []) {
    if (r && typeof r === 'object' && !Array.isArray(r) && Object.keys(r).length > 0) valid.push(r)
    else skipped++
  }
  return { valid, skipped }
}

/**
 * 提取本机灵码会话 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * 路线 1:~/.lingma/credentials 凭证文件(Windows/macOS/Linux 同形);
 * 路线 2:VS Code globalStorage state.vscdb 秘密行(只读解密)。
 * @param {{homeDir?: string, appDataDir?: string, shellBin?: string}} [opts] 仅供测试注入
 */
export async function extractLingmaAccounts(opts = {}) {
  const homes = opts.homeDir ? [opts.homeDir] : candidateHomeDirs()
  const appDatas = opts.appDataDir ? [opts.appDataDir] : candidateAppDataDirs()
  const probed = []

  // 路线 1:凭证文件
  for (const home of homes) {
    const credPath = path.join(home, CRED_REL)
    probed.push(credPath)
    if (!fs.existsSync(credPath)) continue
    const rec = readCredentialsFile(credPath)
    const { valid, skipped } = pickImportableRecords([rec])
    if (valid.length === 0) {
      throw Object.assign(new Error(`${credPath} 解析成功但为空对象(无任何字段) ⇒ 未判定`), {
        code: 'LINGMA_NO_SESSION',
      })
    }
    return {
      providerCode: 'lingma',
      accounts: valid,
      meta: {
        sourcePath: credPath,
        route: 'credentials-file',
        count: valid.length,
        skipped,
        sessions: valid.map(summarizeRecord),
      },
    }
  }

  // 路线 2:VS Code globalStorage 秘密行
  const lastErrs = []
  for (const appData of appDatas) {
    for (const ext of VSC_STORAGE_EXTS) {
      const gsDir = path.join(appData, VSCDB_REL, ext)
      probed.push(gsDir)
      if (!fs.existsSync(gsDir)) continue
      try {
        const records = readSecretRecordsFromVscdb(gsDir, { shellBin: opts.shellBin })
        const { valid, skipped } = pickImportableRecords(records)
        if (valid.length === 0) {
          throw Object.assign(
            new Error(`${gsDir}\\state.vscdb 里没有 lingma 秘密行(未登录或版本变更) ⇒ 未判定`),
            { code: 'LINGMA_NO_SESSION' },
          )
        }
        return {
          providerCode: 'lingma',
          accounts: valid,
          meta: {
            sourcePath: gsDir,
            route: 'vscdb',
            count: valid.length,
            skipped,
            sessions: valid.map(summarizeRecord),
          },
        }
      } catch (e) {
        lastErrs.push(e)
      }
    }
  }
  if (lastErrs.length > 0) throw lastErrs[lastErrs.length - 1]
  throw Object.assign(
    new Error(
      `未找到灵码登录态(已探测:${probed.length > 0 ? probed.join(' ; ') : '(无候选用户目录)'});` +
        '请先在本机登录通义灵码(VS Code/JetBrains 插件);' +
        'JetBrains 版目录键名未取证,本版不解析 ⇒ 未判定',
    ),
    { code: 'LINGMA_NO_SESSION' },
  )
}

export const __test__ = {
  decryptSafeStorageBlob,
  readAesKeyFromLocalState,
  readSecretRecordsFromVscdb,
  candidateHomeDirs,
  candidateAppDataDirs,
  summarizeRecord,
  pickImportableRecords,
  VSC_STORAGE_EXTS,
  CRED_REL,
}
