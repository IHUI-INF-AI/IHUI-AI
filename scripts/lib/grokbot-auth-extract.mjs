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
 *   - credential/connection 的 data 为 sandSealedFile 密封串(密封方案未公开,本机未解),
 *     提取器**不解密封包**:两个 JSON 逐字直通,解封交服务端/后续取证(§0.6 零映射)。
 *   - grokbot 走 SuperGrok/Cursor 套餐,国际产品,无国内分线。
 *
 * 安全:令牌零回显——meta 摘要只有 sha256 前 12 位指纹 / 长度 / sandSealedFile 版本号 /
 * settings 布尔面;data 密文绝不进日志与 meta。
 *
 * 退出语义(§0.3):取不到输入 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** 数据目录名(Windows %USERPROFILE%\.grokbot;macOS/Linux ~/.grokbot 同形) */
const DIR_NAME = '.grokbot'
const CREDENTIAL_FILE = 'local-exec-daemon-credential.json'
const CONNECTION_FILE = 'local-exec-daemon-connection.json'
const SETTINGS_FILE = 'settings.json'

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
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
 * 提取本机 Grok Bot daemon 凭证 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * account 信封 = { credential, connection }(两个文件的逐字 JSON;信封两键是本提取器唯一新增结构)。
 * @param {{grokbotDir?: string}} [opts] 仅供测试注入
 */
export async function extractGrokbotAccounts(opts = {}) {
  const dirs = opts.grokbotDir ? [opts.grokbotDir] : candidateGrokbotDirs()
  if (dirs.length === 0) {
    throw Object.assign(
      new Error(
        '未找到 Grok Bot 数据目录(~/.grokbot 及本机各用户 profile 均无);请先在本机登录 Grok Bot ⇒ 未判定',
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
  CREDENTIAL_FILE,
  CONNECTION_FILE,
  SETTINGS_FILE,
}
