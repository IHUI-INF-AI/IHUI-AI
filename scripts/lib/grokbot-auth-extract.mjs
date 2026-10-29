// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Grok Bot(SpaceXAI/xAI 常驻 Agent,Meta Muse 的对标)本机凭证提取器(2026-10-27 装车)。
 * 与 Grok Build CLI 是两条产品线,本提取器只认常驻 Agent 的 ~/.grokbot。
 *
 * 取证链(2026-10-27 本机实读,§0.9 判据现读,不猜):
 *   - %USERPROFILE%\.grokbot\ 实存(2026-09-27 写入),实证键名形状(只读键名,值零回显):
 *     · local-exec-daemon-credential.json = {sandSealedFile:number, data:string}
 *     · local-exec-daemon-connection.json = {sandSealedFile:number, data:string}
 *     · settings.json = {accountScopes:object, activeAccountScope:string(64), version:number,
 *       hasSeenOnboarding:boolean, localToolPermission:string, mcpBoxServers:array, …布尔/数组面}
 *     · .grokbot-data-root-v1 = {"version":1} —— 是**版本标记 JSON,不是数据根路径**
 *       (跟进去无路径可跳,如实纠正任务假设;数据根寻址未在本目录取证到)。
 *     · local-exec-daemon.json {pid,startedAt,servingAt,inflightCount,filesKeyId,generation}
 *       与 local-exec-supervisor.json {pid,at} 属运行态,不属凭证,不采。
 *   - credential/connection 的 data 为 sandSealedFile 密封串(daemon 本地执行通道的密封,
 *     不是登录会话票),提取器不解密封包,逐字直通。
 *   - **2026-10-27 源码级取证升级**(docs.rs/ai-usagebar grokbot::creds + codeburn
 *     providers/grokbot.md 双源交叉,与 9 月本机残留互相印证):
 *     登录会话真身 = **%APPDATA%\Grok Bot\sand-secrets.json**(目录名带空格),
 *     结构 `{"cursor-accounts": "<JSON 串>", …}`(Windows 上 cursor-accounts 是 JSON 字符串),
 *     内层 `{"active":"", "accounts":{"<id>":{"cursor-access-token":"djE…(v10 blob)",
 *     "cursor-refresh-token":"djE…(v10 blob)"}}}`;
 *     blob = Chromium Windows OSCrypt v10(base64;v10 前缀 + nonce12 + ct + tag16,
 *     AES-256-GCM),密钥 = 旁侧 Local State `os_crypt.encrypted_key`(DPAPI 保护)——
 *     与 codearts/loomy 的 safeStorage 解密完全同构,解封方案定案可解。
 *   - 本机 2026-10-27 现读:%APPDATA%\Grok Bot\ 只有 sand-client-persistence(明文任务
 *     blob,非凭证),sand-secrets.json 不存在 ⇒ 桌面端已卸载/未登录,sand-secrets 路径
 *     取不到时回落 daemon 密封串路径(行为不变)。
 *   - grokbot 走 SuperGrok/Cursor 套餐,国际产品,无国内分线。
 *
 * 安全:令牌零回显——meta 摘要只有 sha256 前 12 位指纹 / 长度 / sandSealedFile 版本号 /
 * settings 布尔面;data 密文与解出的 token 绝不进日志与 meta。
 *
 * 退出语义(§0.3):取不到输入 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// DPAPI + v10 解密单一源:复用 codearts 提取器已实证的实现(§0.6,不抄第二份解密器)
import { readAesKeyFromLocalState } from './codearts-auth-extract.mjs'

/** 数据目录名(Windows %USERPROFILE%\.grokbot;macOS/Linux ~/.grokbot 同形) */
const DIR_NAME = '.grokbot'
const CREDENTIAL_FILE = 'local-exec-daemon-credential.json'
const CONNECTION_FILE = 'local-exec-daemon-connection.json'
const SETTINGS_FILE = 'settings.json'

/** 桌面端应用目录名(带空格,Windows %APPDATA%\Grok Bot;source: grokbot::creds APP_CONFIG_DIR) */
const APP_CONFIG_DIR_NAME = 'Grok Bot'
const SAND_SECRETS_FILE = 'sand-secrets.json'
const LOCAL_STATE_FILE = 'Local State'

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/** Chromium Windows OSCrypt v10 blob(base64)→ 明文(v10 前缀 + nonce12 + AES-256-GCM + tag16) */
export function decryptOscryptV10Blob(blobB64, aesKey) {
  const blob = Buffer.from(String(blobB64 ?? ''), 'base64')
  if (blob.length < 3 + 12 + 16) {
    throw Object.assign(new Error('sand-secrets blob 长度不足 v10 形(未判定)'), {
      code: 'GROKBOT_BAD_BLOB',
    })
  }
  const prefix = blob.subarray(0, 3).toString('ascii')
  if (prefix !== 'v10' && prefix !== 'v11') {
    throw Object.assign(new Error(`sand-secrets blob 前缀 ${prefix} 非 v10/v11(未判定)`), {
      code: 'GROKBOT_BAD_BLOB',
    })
  }
  const nonce = blob.subarray(3, 15)
  const tag = blob.subarray(blob.length - 16)
  const ct = blob.subarray(15, blob.length - 16)
  const d = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
}

/**
 * 读桌面端 sand-secrets.json(源码级实证主路径):
 * @returns {{accounts: Array<{source,accountId,key,value}>, notes: string[]}}
 * 取不到(文件不存在/结构不符/解密失败)一律 throw 带 code,由主流程回落 daemon 路径。
 * @param {{shellBin?: string}} [inject] 仅供测试注入(DPAPI 子进程替身)
 */
export function readSandSecretsAccounts(appConfigDir, inject = {}) {
  const secretsPath = path.join(appConfigDir, SAND_SECRETS_FILE)
  let text
  try {
    text = fs.readFileSync(secretsPath, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT') {
      throw Object.assign(
        new Error(`${SAND_SECRETS_FILE} 不存在(Grok Bot 桌面端未登录/已卸载): ${secretsPath}`),
        { code: 'GROKBOT_NO_SESSION' },
      )
    }
    throw Object.assign(
      new Error(`${SAND_SECRETS_FILE} 读取失败: ${e instanceof Error ? e.message : String(e)}`),
      { code: 'GROKBOT_SECRETS_UNREADABLE' },
    )
  }
  let outer
  try {
    outer = JSON.parse(text)
  } catch {
    throw Object.assign(new Error(`${SAND_SECRETS_FILE} 不是合法 JSON`), {
      code: 'GROKBOT_BAD_SECRETS',
    })
  }
  // Windows 上 cursor-accounts 是 JSON 字符串;Linux 写的是对象。两层都收(§0.9 双形)。
  let inner = outer?.['cursor-accounts']
  if (typeof inner === 'string') {
    try {
      inner = JSON.parse(inner)
    } catch {
      throw Object.assign(new Error('cursor-accounts JSON 串解析失败(格式已变更?)'), {
        code: 'GROKBOT_BAD_SECRETS',
      })
    }
  }
  const accountsMap = inner && typeof inner === 'object' ? inner?.['accounts'] : null
  if (!accountsMap || typeof accountsMap !== 'object') {
    throw Object.assign(new Error('sand-secrets 缺 cursor-accounts.accounts(格式已变更?)'), {
      code: 'GROKBOT_BAD_SECRETS',
    })
  }
  const aesKey = readAesKeyFromLocalState(path.join(appConfigDir, LOCAL_STATE_FILE), {
    shellBin: inject.shellBin,
  })
  const accounts = []
  const notes = []
  for (const [accountId, rec] of Object.entries(accountsMap)) {
    for (const key of ['cursor-access-token', 'cursor-refresh-token']) {
      const blobB64 = rec?.[key]
      if (typeof blobB64 !== 'string' || blobB64 === '') {
        notes.push(`account ${accountId} 缺 ${key}(未判定)`)
        continue
      }
      try {
        accounts.push({
          source: 'sand-secrets',
          accountId,
          key,
          value: decryptOscryptV10Blob(blobB64, aesKey),
        })
      } catch (e) {
        notes.push(`account ${accountId} ${key} 解密未判定: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  if (accounts.length === 0) {
    throw Object.assign(
      new Error(`sand-secrets 在盘但 0 条 token 解出(注记: ${notes.join('; ') || '无'})`),
      { code: 'GROKBOT_NO_SESSION' },
    )
  }
  return { accounts, notes }
}

/** 候选数据目录:优先 USERPROFILE/HOME,兜底扫本机各用户 profile(IHUI_GROKBOT_SCAN_USERS=0 可关)。 */
export function candidateGrokbotDirs(env) {
  const e = env ?? process.env
  const bases = []
  if (e.USERPROFILE) bases.push(e.USERPROFILE)
  if (e.HOME && e.HOME !== e.USERPROFILE) bases.push(e.HOME)
  if (e.IHUI_GROKBOT_SCAN_USERS !== '0') {
    const usersRoot = path.join(e.SystemDrive ? `${e.SystemDrive}\\` : 'C:\\', 'Users')
    try {
      for (const u of fs.readdirSync(usersRoot)) {
        const p = path.join(usersRoot, u)
        if (fs.existsSync(p)) bases.push(p)
      }
    } catch {
      /* 用户根不可读就只认 USERPROFILE/HOME */
    }
  }
  return [...new Set(bases)].map((b) => path.join(b, DIR_NAME)).filter((d) => fs.existsSync(d))
}

/**
 * 读密封 JSON(credential/connection):缺失 ⇒ NO_SESSION(未登录态);
 * 权限不足/被占用 ⇒ *_UNREADABLE;非 JSON 对象 ⇒ *_BAD。不吞错,点名文件。
 */
function readSealedJson(fp, kind) {
  let text
  try {
    text = fs.readFileSync(fp, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT') {
      throw Object.assign(
        new Error(`${kind} 文件不存在(未登录 Grok Bot 或数据被清理): ${fp} ⇒ 未判定`),
        { code: 'GROKBOT_NO_SESSION' },
      )
    }
    throw Object.assign(
      new Error(`${kind} 文件读取失败(${e instanceof Error ? e.message : String(e)};权限不足或被占用): ${fp}`),
      { code: kind === 'credential' ? 'GROKBOT_CRED_UNREADABLE' : 'GROKBOT_CONN_UNREADABLE' },
    )
  }
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('非 JSON 对象')
    return parsed
  } catch {
    throw Object.assign(new Error(`${kind} 文件不是 JSON 对象(格式已变更?): ${fp}`), {
      code: kind === 'credential' ? 'GROKBOT_BAD_CREDENTIAL' : 'GROKBOT_BAD_CONNECTION',
    })
  }
}

/** settings.json 可选读:坏了不致命(meta 相应位如实标缺),但读取失败时如实带原因。 */
function readOptionalJson(fp) {
  let text
  try {
    text = fs.readFileSync(fp, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT') return null
    throw new Error(`settings.json 读取失败(${e instanceof Error ? e.message : String(e)})`)
  }
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('settings.json 不是 JSON 对象')
  }
  return parsed
}

/**
 * 可导入判据(键形 = 2026-10-27 本机实证形状,零字段挑选):
 * credential 与 connection 都须 sandSealedFile:number + data 非空 string。
 */
export function pickImportableGrokbotAccounts(accounts) {
  const valid = []
  let skipped = 0
  for (const a of Array.isArray(accounts) ? accounts : []) {
    const c = a?.credential
    const n = a?.connection
    const okShape =
      c &&
      n &&
      typeof c.sandSealedFile === 'number' &&
      typeof n.sandSealedFile === 'number' &&
      cstr(c.data) !== '' &&
      cstr(n.data) !== ''
    if (okShape) valid.push(a)
    else skipped++
  }
  return { valid, skipped }
}

/** 单账号摘要(零回显):指纹/长度/密封版本/settings 布尔面,data 密文不进 meta。 */
export function summarizeGrokbotAccount(a, settings = null) {
  const c = a?.credential ?? {}
  const n = a?.connection ?? {}
  const s = settings && typeof settings === 'object' ? settings : {}
  return {
    credentialSealedVersion: typeof c.sandSealedFile === 'number' ? c.sandSealedFile : null,
    credentialDataLength: cstr(c.data).length,
    credentialDataFingerprint: cstr(c.data) ? fingerprintOf(c.data) : '-',
    connectionSealedVersion: typeof n.sandSealedFile === 'number' ? n.sandSealedFile : null,
    connectionDataLength: cstr(n.data).length,
    connectionDataFingerprint: cstr(n.data) ? fingerprintOf(n.data) : '-',
    hasActiveAccountScope: cstr(s.activeAccountScope) !== '',
    settingsVersion: typeof s.version === 'number' ? s.version : null,
  }
}

/**
 * 提取本机 Grok Bot 凭证 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * 主路径 = 桌面端 sand-secrets.json(源码级实证,Cursor OAuth token 明文直通);
 * 回落路径 = ~/.grokbot daemon 密封串(credential+connection 逐字 JSON)。
 * @param {{grokbotDir?: string, appConfigDir?: string, shellBin?: string}} [opts] 仅供测试注入
 */
export async function extractGrokbotAccounts(opts = {}) {
  // —— 主路径:sand-secrets.json(%APPDATA%\Grok Bot)——
  // 测试封闭性:任一目录注入(opts.appConfigDir/opts.grokbotDir)即禁真实环境扫描。
  const testMode = Boolean(opts.appConfigDir || opts.grokbotDir)
  const appDirs = []
  const e = process.env
  if (opts.appConfigDir) appDirs.push(opts.appConfigDir)
  else if (!testMode) {
    if (e.APPDATA) appDirs.push(path.join(e.APPDATA, APP_CONFIG_DIR_NAME))
    const usersRoot = path.join(e.SystemDrive ? `${e.SystemDrive}\\` : 'C:\\', 'Users')
    try {
      for (const u of fs.readdirSync(usersRoot)) {
        const p = path.join(usersRoot, u, 'AppData', 'Roaming', APP_CONFIG_DIR_NAME)
        if (fs.existsSync(p)) appDirs.push(p)
      }
    } catch {
      /* 用户根不可读就只认 APPDATA */
    }
  }
  const sandNotes = []
  for (const appDir of [...new Set(appDirs)]) {
    if (!fs.existsSync(appDir)) continue
    try {
      const { accounts, notes } = readSandSecretsAccounts(appDir)
      return {
        providerCode: 'grokbot',
        accounts,
        meta: {
          sourceDir: appDir,
          pathKind: 'sand-secrets',
          count: accounts.length,
          skipped: 0,
          notes,
          sessions: accounts.map((a) => ({
            source: a.source,
            accountId: a.accountId,
            key: a.key,
            valueLength: a.value.length,
            valueFingerprint: fingerprintOf(a.value),
          })),
        },
      }
    } catch (err) {
      sandNotes.push(`${path.basename(appDir)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // —— 回落路径:~/.grokbot daemon 密封串(行为与 2026-10-27 首版一致)——
  // 测试封闭性:testMode 时不扫真实用户 profile(候选 = 注入目录或空)。
  const dirs = opts.grokbotDir
    ? [opts.grokbotDir]
    : testMode
      ? []
      : candidateGrokbotDirs()
  if (dirs.length === 0) {
    throw Object.assign(
      new Error(
        '未找到 Grok Bot 凭证(sand-secrets.json 与 ~/.grokbot 均无;' +
          `sand-secrets 探测注记: ${sandNotes.join(' | ') || '(无候选目录)'});` +
          '请先在本机安装并登录 Grok Bot 桌面端 ⇒ 未判定',
      ),
      { code: 'GROKBOT_NO_SESSION' },
    )
  }
  let lastErr = null
  for (const dir of dirs) {
    try {
      const credential = readSealedJson(path.join(dir, CREDENTIAL_FILE), 'credential')
      const connection = readSealedJson(path.join(dir, CONNECTION_FILE), 'connection')
      let settings = null
      try {
        settings = readOptionalJson(path.join(dir, SETTINGS_FILE))
      } catch {
        settings = null // settings 缺失/损坏不致命,meta 里 hasActiveAccountScope=false 如实呈现
      }
      const account = { credential, connection }
      const { valid, skipped } = pickImportableGrokbotAccounts([account])
      if (valid.length === 0) {
        throw Object.assign(
          new Error(
            'daemon 凭证/连接 JSON 键形与 2026-10-27 本机实证不符' +
              '(缺 sandSealedFile:number 或 data:string 非空) ⇒ 未判定',
          ),
          { code: 'GROKBOT_NO_SESSION' },
        )
      }
      return {
        providerCode: 'grokbot',
        accounts: valid,
        meta: {
          sourceDir: dir,
          count: valid.length,
          skipped,
          sessions: valid.map((a) => summarizeGrokbotAccount(a, settings)),
        },
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? Object.assign(new Error('未判定'), { code: 'GROKBOT_UNKNOWN' })
}

export const __test__ = {
  candidateGrokbotDirs,
  pickImportableGrokbotAccounts,
  summarizeGrokbotAccount,
  readSandSecretsAccounts,
  decryptOscryptV10Blob,
  APP_CONFIG_DIR_NAME,
  CREDENTIAL_FILE,
  CONNECTION_FILE,
  SETTINGS_FILE,
}
