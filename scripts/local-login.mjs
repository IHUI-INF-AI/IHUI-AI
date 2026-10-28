// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「登录本机」多平台执行端(2026-10-27 立;trae 仍走 scripts/trae-login-local.mjs)。
 *
 * 立因:号池能保活账号,但换机/退号后本机客户端的登录态还是别人的或空的。号池只存
 * 凭证(token/refreshToken/到期),客户端登录态却往往还带着账号资料/设备信息,所以
 * 导入时把整份会话去掉凭证存成「会话模板」(加密进 secretsEnc);本脚本用池内最新
 * 凭证打补丁后写回本机客户端,写前必留同目录备份,失败可人工回滚。
 *
 * 支持矩阵(判据见各适配器头注):
 *   codex    %USERPROFILE%\.codex\auth.json(或 CODEX_HOME)          明文,可重建;CLI 现读,不动进程
 *   opencode ~/.local/share/opencode/auth.json(或 XDG)               明文,可重建;CLI 现读,不动进程
 *   minimax  ~/.minimax/auth/prod/<region>/mcode-public/auth.json     明文,可重建;GUI 先关后写再拉起
 *   zcode    ~/.zcode/v2/credentials.json                              enc:v1: AES-256-GCM,可重封;GUI 同上
 *   codearts %APPDATA%\codearts-agent\...\state.vscdb                  DPAPI+AES-GCM,可重封;GUI 同上
 *   qoder    %APPDATA%\com.qoder[cn].app.*\auth.v1.dat                DPAPI+AES-GCM,可重封;GUI 同上
 *   其余(workbuddy/loomy/lingua/doubao/grokbot)无法离线重封,由服务层给明确 409 原因。
 *
 * 与 trae 的一致性(2026-10-28 补齐):凡"运行中客户端会在退出/续期时回写落点"的平台,
 * 一律 探测 → 优雅关闭(不退再补一轮,仍不退强杀)→ 写(原子落盘)→ 原样拉起,
 * 回报 clientWasRunning/clientClosed/clientForced/clientRestarted,与 trae 同字段口径。
 * CLI 平台(codex/opencode)不去杀进程:它们每次启动现读文件,写了就生效。
 * 测试/诊断可用 IHUI_LOCAL_LOGIN_PROC_CONTROL=0 关掉进程控制(关掉后运行中写回可能被覆写)。
 *
 * 安全:凭证只经标准输入进本进程,任何输出都不含 token/refreshToken 明文;
 * 写前必留 `<文件>.ihui-login-<时间戳>.bak`;模板账号与目标 uid 不一致时拒绝写入。
 *
 *   node scripts/local-login.mjs --provider codex --stdin [--json]
 *
 * 退出码:0 写入成功 / 1 写入失败 / 2 参数·输入·环境未判定。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { clientHomeEnvs } from './lib/client-home.mjs'
import { closeProduct, launchProduct, listProductPids, resolveProductExe } from './lib/trae-client-process.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

/** 各适配器共用的凭证字段(写回时模板里一律剔除,由池内权威值覆盖) */
const CREDENTIAL_KEYS = [
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'expiresAt',
  'expires_at',
  'refreshTokenExpiresAt',
  'expiresAtMs',
  'key',
  'access',
  'refresh',
  'expires',
]

export class WriteError extends Error {
  constructor(message, code = 'write-failed') {
    super(message)
    this.name = 'WriteError'
    this.code = code
  }
}

export const SUPPORTED_PROVIDERS = Object.freeze([
  'codex',
  'opencode',
  'minimax',
  'zcode',
  'codearts',
  'qoder',
])

const PROVIDER_LABEL = Object.freeze({
  codex: 'Codex',
  opencode: 'OpenCode',
  minimax: 'MiniMax Code',
  zcode: 'ZCode',
  codearts: 'CodeArts',
  qoder: 'Qoder',
})

function asText(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function asObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null
}

function asIso(v) {
  const s = asText(v)
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : s
}

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v))
}

export function parseArgs(argv) {
  const options = { provider: '', stdin: false, json: false, help: false, error: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--stdin') options.stdin = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else if (a === '--provider') options.provider = asText(argv[++i])
    else if (a.startsWith('--provider=')) options.provider = asText(a.slice('--provider='.length))
    else options.error = `未知参数: ${a}`
  }
  if (!options.help && !options.error) {
    if (!options.provider) options.error = '必须 --provider <平台代码>'
    else if (!SUPPORTED_PROVIDERS.includes(options.provider)) {
      options.error = `平台 ${options.provider} 不支持登录本机(支持: ${SUPPORTED_PROVIDERS.join(' / ')};trae 走 trae-login-local.mjs)`
    }
    if (!options.error && !options.stdin) options.error = '必须 --stdin(凭证经标准输入,不落盘)'
  }
  return options
}

/** 读取 payload 并做形状校验(字段宽松,缺凭证直接未判定) */
export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new WriteError('stdin 必须是 JSON 对象(未判定)', 'payload-shape')
  }
  const uid = asText(raw.uid)
  const token = asText(raw.token)
  if (!uid || !token) throw new WriteError('缺 uid 或 token(未判定)', 'payload-shape')
  const secrets = asObj(raw.secrets) ?? {}
  return {
    uid,
    token,
    refreshToken: asText(raw.refreshToken),
    expiresAt: asIso(raw.expiresAt),
    refreshExpiresAt: asIso(raw.refreshExpiresAt),
    secrets,
    target: asText(raw.target),
  }
}

/** 会话模板(导入时采集;凭证已剔除)。没有模板时返回 null,由适配器用本机现役会话兜底 */
function templateOf(payload) {
  return asObj(payload.secrets.sessionTemplate)
}

/** 模板账号与目标 uid 对不上 ⇒ 拒绝写入(防止拿错号的模板把本机登录态写成别人) */
export function assertTemplateUid(template, uid) {
  if (!template) return null
  const candidates = [
    template.uid,
    template.userId,
    template.user_id,
    template.account_id,
    template.account?.id,
    asObj(template.tokens)?.account_id,
    asObj(template.user)?.id,
    asObj(template.user)?.userId,
    asObj(template.user)?.uid,
  ]
  const found = candidates.map((v) => asText(v)).find(Boolean) ?? ''
  if (found && !String(uid).startsWith('auto:') && found !== String(uid)) {
    throw new WriteError(
      `会话模板的账号(${found})与目标 uid(${uid})不一致 ⇒ 拒绝写入(模板与账号错配)`,
      'template-uid-mismatch',
    )
  }
  return found || null
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/** 同目录备份;文件不存在(首次创建)不产生备份,返回 null */
function backupOf(file) {
  if (!fs.existsSync(file)) return null
  const backupFile = `${file}.ihui-login-${stamp()}.bak`
  fs.copyFileSync(file, backupFile)
  return backupFile
}

/** 同步等待(不 fork 子进程 —— Atomics.wait 阻塞当前线程即可) */
function sleepSync(ms) {
  if (!(ms > 0)) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * 原子写:临时文件写完再 rename,避免半截 JSON 被客户端读走。
 * 与 trae-login-local.mjs 同口径(Windows 上目标常被扫描器/索引器/客户端短暂持有 ⇒
 * rename 偶发 EPERM/EBUSY,退避重试;超过预算才失败,失败时清临时文件、主文件保持原样)。
 */
function atomicWrite(file, data) {
  const dir = path.dirname(file)
  const tmp = path.join(dir, `.${path.basename(file)}.ihui-tmp-${process.pid}-${Date.now()}`)
  fs.writeFileSync(tmp, data)
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(tmp, file)
      return
    } catch (e) {
      const transient = ['EPERM', 'EBUSY', 'EACCES', 'EEXIST'].includes(e?.code)
      if (transient && attempt < 12) {
        sleepSync(120)
        continue
      }
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* 残留临时文件不影响主文件 */
      }
      throw e
    }
  }
}

function readJsonObject(file, label) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    throw new WriteError(`读不了 ${label}:${file}(${e instanceof Error ? e.message : String(e)})`, 'target-shape')
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new WriteError(`${label} 不是合法 JSON:${file} ⇒ 拒绝覆盖(先人工确认)`, 'target-shape')
  }
  if (!asObj(parsed)) throw new WriteError(`${label} 顶层不是对象:${file} ⇒ 拒绝覆盖`, 'target-shape')
  return parsed
}

function writeResult(providerCode, file, backupFile, extra = {}) {
  return { ok: true, providerCode, targetFile: file, backupFile: backupFile ?? '', notes: [], ...extra }
}

// =============================================================================
// 客户端进程控制(2026-10-28 与 trae 对齐:运行中 GUI 会在退出时用内存态覆写落点)
// =============================================================================

/**
 * 需要「先关客户端再写」的平台 → 进程映像候选名(Windows tasklist 口径,不带 .exe)。
 *
 * 判据不是"是不是桌面程序",而是**落点会不会被运行中的客户端整块回写**:
 *   codearts  state.vscdb 是 SQLite,客户端独占库、退出时整库落盘;
 *   qoder     auth.v1.dat,适配器注释已点明"运行中客户端退出时可能覆写";
 *   minimax   auth.json 由 MiniMax Code 桌面端持在内存,退出/token 续期时回写;
 *   zcode     credentials.json(enc:v1:)同属桌面端整块回写的那一类;
 *   codex/opencode 是 CLI,每次执行现读 auth.json,写文件不需要动进程(也不该去杀)。
 * 候选名按"先具体后宽泛"排列(同一平台国内版/国际版映像名不同,取第一个命中的)。
 */
export const CLIENT_IMAGES = Object.freeze({
  codearts: ['CodeArts Agent', 'CodeArts', 'codearts-agent'],
  qoder: ['Qoder CN', 'Qoder'],
  minimax: ['MiniMax Code', 'MiniMaxCode'],
  zcode: ['ZCode'],
})

/**
 * 写前探测并关闭客户端。未安装/没在跑 ⇒ 返回 wasRunning=false,由适配器直接写。
 * 探测失败(tasklist 不可用)⇒ 抛 target-locked:运行中盲写必被覆写,宁可明说也不冒绿。
 */
export function closeClientForWrite(provider, env = process.env) {
  const images = CLIENT_IMAGES[provider]
  if (!images || process.platform !== 'win32') return null
  if (String(env.IHUI_LOCAL_LOGIN_PROC_CONTROL ?? '').trim() === '0') return null
  let hit = null
  for (const image of images) {
    const pids = listProductPids(image, env)
    if (pids === null) {
      throw new WriteError(
        `探测 ${image}.exe 进程失败(未判定)⇒ 拒绝盲写(运行中的客户端会在退出时覆写登录态)`,
        'target-locked',
      )
    }
    if (pids.length > 0) {
      hit = { image, pids }
      break
    }
  }
  if (!hit) return { product: '', wasRunning: false, closed: false, forced: false, exePath: '' }
  const exePath = resolveProductExe(hit.image, env) ?? ''
  const closed = closeProduct(hit.image, { env, pids: hit.pids })
  return {
    product: hit.image,
    wasRunning: true,
    closed: closed.closed === true,
    forced: closed.forced === true,
    exePath,
  }
}

/** 写完后原样拉起(服务身份走 run-as-user.ps1,桌面身份 detached spawn) */
export function relaunchClient(info, env = process.env) {
  if (!info?.wasRunning || !info.closed) return { restarted: false, error: '' }
  const helperPath = path.resolve(HERE, '..', 'apps', 'api', 'scripts', 'run-as-user.ps1')
  const launched = launchProduct(info.exePath, { product: info.product, helperPath, env })
  return { restarted: launched.launched === true, error: launched.error || '' }
}

/**
 * 候选环境:登录态落在**真实用户**名下,而生产 API 以 LocalSystem 运行时
 * %USERPROFILE%/%APPDATA% 指向 systemprofile ⇒ 逐个真实家目录派生等价 env 再探测
 * (判据单源:scripts/lib/client-home.mjs;普通桌面进程下与原 env 等价)。
 */
function clientEnvs(opts = {}) {
  return clientHomeEnvs(opts.env ?? process.env)
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))]
}

function firstExisting(candidates) {
  return candidates.find((p) => fs.existsSync(p)) ?? ''
}

/** 候选目录里第一个存在目录的落点(文件还没建过时也能定位到正确目录) */
function firstUsableDir(candidates) {
  return candidates.find((p) => fs.existsSync(p)) ?? candidates.find((p) => fs.existsSync(path.dirname(p))) ?? ''
}

// =============================================================================
// Codex — %USERPROFILE%\.codex\auth.json(CODEX_HOME 可覆盖)
// =============================================================================

/**
 * 不在模板里的本机 auth.json 键(凭证族)一律不沿用:本机现役文件可能是别的号,
 * 把别人的 id_token/refresh_token 带进新号 = 账号错配。
 */
const CODEX_CRED_TOKENS = ['access_token', 'refresh_token', 'id_token', 'OPENAI_API_KEY']

export function applyCodex(payload, opts = {}) {
  const extract = opts.extract
  let file = payload.target ? path.resolve(payload.target) : ''
  if (!file) {
    const candidates = uniq(
      clientEnvs(opts).map((env) => {
        const home = extract.resolveCodexHome(env)
        return home ? path.join(home, 'auth.json') : ''
      }),
    )
    if (candidates.length === 0) {
      throw new WriteError('解析不出 Codex 数据目录(CODEX_HOME/USERPROFILE/HOME 全缺)', 'no-target')
    }
    file = firstExisting(candidates) || firstUsableDir(candidates) || candidates[0]
  }
  const exists = fs.existsSync(file)
  if (!exists && !fs.existsSync(path.dirname(file))) {
    throw new WriteError(
      `本机没有 Codex 数据目录(${path.dirname(file)})。请先在本机执行一次 \`codex login\`,或设置 CODEX_HOME`,
      'no-target',
    )
  }
  const existing = exists ? readJsonObject(file, 'Codex auth.json') : {}
  const template = templateOf(payload)
  assertTemplateUid(template, payload.uid)
  const replacedUid = asText(asObj(existing.tokens)?.account_id) || null

  const out = {}
  // 本机现役文件里非凭证的旁键保留(如自定义 provider 配置),凭证键不沿用
  for (const [k, v] of Object.entries(existing)) {
    if (k === 'tokens' || CODEX_CRED_TOKENS.includes(k)) continue
    out[k] = v
  }
  for (const [k, v] of Object.entries(template ?? {})) {
    if (k === 'tokens' || CODEX_CRED_TOKENS.includes(k)) continue
    out[k] = v
  }
  const tokens = {}
  const tplTokens = asObj(template?.tokens)
  if (tplTokens) {
    for (const [k, v] of Object.entries(tplTokens)) {
      if (CODEX_CRED_TOKENS.includes(k)) continue
      tokens[k] = v
    }
  }
  tokens.access_token = payload.token
  const accountId =
    asText(payload.secrets.accountId) || asText(tokens.account_id) || (payload.uid.startsWith('auto:') ? '' : payload.uid)
  if (accountId) tokens.account_id = accountId
  else delete tokens.account_id
  if (payload.refreshToken) tokens.refresh_token = payload.refreshToken
  else delete tokens.refresh_token
  const idToken = asText(payload.secrets.idToken)
  if (idToken) tokens.id_token = idToken
  else delete tokens.id_token
  out.auth_mode = asText(out.auth_mode) || 'chatgpt'
  out.tokens = tokens
  out.last_refresh = new Date().toISOString()

  const backupFile = backupOf(file)
  atomicWrite(file, `${JSON.stringify(out, null, 2)}\n`)
  return writeResult('codex', file, backupFile, {
    uid: payload.uid,
    replacedUid,
    restartHint: '重启 Codex CLI / IDE 扩展后生效(新会话读取 auth.json)',
  })
}

// =============================================================================
// OpenCode — %USERPROFILE%\.local\share\opencode\auth.json
// =============================================================================

const OPENCODE_CRED_KEYS = ['key', 'access', 'accessToken', 'refresh', 'refreshToken', 'expires', 'expiresAt']

export function applyOpencode(payload, opts = {}) {
  const extract = opts.extract
  let file = payload.target ? path.resolve(payload.target) : ''
  let dirs = []
  if (!file) {
    dirs = uniq(clientEnvs(opts).flatMap((env) => extract.candidateDataDirs(env)))
    const candidates = dirs.map((d) => path.join(d, 'auth.json'))
    file = firstExisting(candidates) || firstUsableDir(candidates) || (candidates[0] ?? '')
  }
  if (!file) {
    throw new WriteError('解析不出 OpenCode 数据目录(XDG_DATA_HOME/USERPROFILE/HOME 全缺)', 'no-target')
  }
  const exists = fs.existsSync(file)
  if (!exists && !fs.existsSync(path.dirname(file))) {
    throw new WriteError(
      `本机没有 OpenCode 数据目录(${path.dirname(file)})。请先在本机 \`opencode auth login\` 登录一次`,
      'no-target',
    )
  }
  const existing = exists ? readJsonObject(file, 'OpenCode auth.json') : {}
  const template = templateOf(payload)
  const providerID = asText(payload.secrets.providerID) || asText(template?.providerID)
  if (!providerID) {
    throw new WriteError(
      '该号没有 providerID(导入时未采集 OpenCode 会话)⇒ 无法判定写哪个 provider 条目',
      'no-template',
    )
  }
  assertTemplateUid(template, payload.uid)
  const prev = asObj(existing[providerID])
  const replacedUid = asText(prev?.accountId) || null

  const authType =
    asText(payload.secrets.authType) || asText(template?.type) || (payload.refreshToken ? 'oauth' : 'api')
  const base = template ?? prev ?? {}
  const entry = {}
  for (const [k, v] of Object.entries(base)) {
    if (OPENCODE_CRED_KEYS.includes(k)) continue
    entry[k] = v
  }
  entry.type = authType
  const accountId =
    asText(payload.secrets.accountId) || asText(template?.accountId) || (payload.uid.startsWith('auto:') ? '' : payload.uid)
  if (accountId) entry.accountId = accountId
  else delete entry.accountId
  if (authType === 'api') {
    entry.key = payload.token
    for (const k of ['access', 'accessToken', 'refresh', 'refreshToken', 'expires', 'expiresAt']) delete entry[k]
  } else {
    entry.access = payload.token
    for (const k of ['key', 'accessToken']) delete entry[k]
    if (payload.refreshToken) entry.refresh = payload.refreshToken
    else delete entry.refresh
    const expMs = payload.expiresAt ? Date.parse(payload.expiresAt) : Number.NaN
    if (Number.isFinite(expMs)) entry.expires = expMs
    else delete entry.expires
  }
  existing[providerID] = entry

  const backupFile = backupOf(file)
  atomicWrite(file, `${JSON.stringify(existing, null, 2)}\n`)
  return writeResult('opencode', file, backupFile, {
    uid: payload.uid,
    replacedUid,
    restartHint: '重启 OpenCode 后生效',
  })
}

// =============================================================================
// MiniMax Code — ~/.minimax/auth/prod/<region>/mcode-public/auth.json
// =============================================================================

const MINIMAX_CRED_KEYS = ['accessToken', 'refreshToken', 'expiresAtMs']

export function applyMinimax(payload, opts = {}) {
  const extract = opts.extract
  let file = payload.target ? path.resolve(payload.target) : ''
  if (!file) {
    const hits = []
    for (const env of clientEnvs(opts)) {
      for (const root of extract.minimaxCandidateRoots({ env })) {
        for (const f of extract.minimaxDiscoverAuthFiles(root)) hits.push(f.authPath)
      }
    }
    const preferred = asText(payload.secrets.sourcePath)
    file = preferred && fs.existsSync(preferred) ? preferred : uniq(hits)[0] ?? ''
  }
  if (!file) {
    throw new WriteError(
      '本机没找到 MiniMax Code 会话文件(~/.minimax/auth/prod/<region>/mcode-public/auth.json)',
      'no-target',
    )
  }
  if (!fs.existsSync(file)) {
    throw new WriteError(`指定的 MiniMax 会话文件不存在:${file}`, 'no-target')
  }
  const doc = readJsonObject(file, 'MiniMax auth.json')
  const records = asObj(doc.records)
  if (!records) throw new WriteError('MiniMax auth.json 缺 records 对象 ⇒ 无法定位会话', 'target-shape')

  const template = templateOf(payload)
  assertTemplateUid(template, payload.uid)
  const keys = Object.keys(records)
  let recordKey = asText(payload.secrets.recordKey) || asText(template?.recordKey)
  if (!recordKey && keys.length === 1) recordKey = keys[0]
  if (!recordKey) {
    throw new WriteError(
      `该号没有记录键(recordKey),且本机文件里有 ${keys.length} 条会话 ⇒ 无法判定写哪一条`,
      'no-template',
    )
  }
  const prev = asObj(records[recordKey])
  const replacedUid = null

  const base = template ?? prev ?? {}
  const entry = {}
  for (const [k, v] of Object.entries(base)) {
    if (MINIMAX_CRED_KEYS.includes(k)) continue
    entry[k] = v
  }
  entry.accessToken = payload.token
  if (payload.refreshToken) entry.refreshToken = payload.refreshToken
  else delete entry.refreshToken
  const expMs = payload.expiresAt ? Date.parse(payload.expiresAt) : Number.NaN
  if (Number.isFinite(expMs)) entry.expiresAtMs = expMs
  else delete entry.expiresAtMs
  records[recordKey] = entry
  doc.records = records

  const backupFile = backupOf(file)
  atomicWrite(file, `${JSON.stringify(doc, null, 2)}\n`)

  // 同目录 auth-state.json 的 expiresAtMs 与实际会话同步(存在才改,不发明字段)
  const notes = []
  const stateFile = path.join(path.dirname(file), 'auth-state.json')
  let stateBackup = ''
  if (fs.existsSync(stateFile)) {
    try {
      const state = readJsonObject(stateFile, 'MiniMax auth-state.json')
      if (Number.isFinite(expMs)) {
        state.expiresAtMs = expMs
        stateBackup = backupOf(stateFile) ?? ''
        atomicWrite(stateFile, `${JSON.stringify(state, null, 2)}\n`)
        notes.push(`auth-state.json 的 expiresAtMs 已同步(${stateBackup ? `备份 ${stateBackup}` : '无原文件可备份'})`)
      }
    } catch {
      notes.push('auth-state.json 解析失败,已跳过(主会话文件已写入)')
    }
  }
  return writeResult('minimax', file, backupFile, {
    uid: payload.uid,
    replacedUid,
    notes,
    restartHint: '重启 MiniMax Code(mcode)后生效',
  })
}

// =============================================================================
// ZCode — ~/.zcode/v2/credentials.json(enc:v1: AES-256-GCM)
// =============================================================================

const ZCODE_ENC_PREFIX = 'enc:v1:'

/** 与 ZCode 客户端同形的重封:enc:v1: + b64url(iv).b64url(tag).b64url(ct) */
export function encryptZcodeValue(plaintext, key) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(String(plaintext), 'utf8'), c.final()])
  const tag = c.getAuthTag()
  return `${ZCODE_ENC_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`
}

export function applyZcode(payload, opts = {}) {
  const extract = opts.extract
  let file = payload.target ? path.resolve(payload.target) : ''
  /** 命中落点所属的环境 —— enc:v1: 的 fallback 密钥由「家目录+用户名」派生,必须同源 */
  let keyEnv = opts.env ?? process.env
  if (!file) {
    for (const env of clientEnvs(opts)) {
      const hit = uniq(extract.zcodeCandidateRoots({ env }).map((r) => path.join(r, 'v2', 'credentials.json'))).find(
        (p) => fs.existsSync(p),
      )
      if (hit) {
        file = hit
        keyEnv = env
        break
      }
    }
  }
  if (!file) {
    throw new WriteError('本机没找到 ZCode 凭据文件(~/.zcode/v2/credentials.json)', 'no-target')
  }
  if (!fs.existsSync(file)) throw new WriteError(`指定的 ZCode 凭据文件不存在:${file}`, 'no-target')
  const rawMap = readJsonObject(file, 'ZCode credentials.json')

  const cipherKey = extract.zcodeDeriveCipherKey(keyEnv)
  const existingPlain = {}
  for (const [k, v] of Object.entries(rawMap)) {
    if (typeof v !== 'string') continue
    if (!v.startsWith(ZCODE_ENC_PREFIX)) {
      existingPlain[k] = v
      continue
    }
    try {
      existingPlain[k] = extract.zcodeDecryptValue(v, cipherKey)
    } catch {
      throw new WriteError(
        '本机 ZCode 凭据解不开(AES-256-GCM AUTH 不过):密钥派生环境与写入时不一致(检查 ZCODE_CREDENTIAL_SECRET)⇒ 拒绝覆盖',
        'cipher-key-mismatch',
      )
    }
  }

  const templateMap = asObj(payload.secrets.credentialMap)
  const base = { ...existingPlain }
  if (templateMap) {
    for (const [k, v] of Object.entries(templateMap)) {
      if (k === 'rawCredentials') continue
      if (typeof v === 'string' && v) base[k] = v
    }
  }
  const tokenKeys = [
    'oauth:bigmodel:access_token',
    'zcodejwttoken',
    ...Object.keys(base).filter((k) => k.startsWith('project-key-location:v1:')),
  ]
  const tokenKey = tokenKeys.find((k) => asText(base[k]) === payload.token) ?? tokenKeys.find((k) => asText(base[k]))
  if (!tokenKey) {
    throw new WriteError(
      '该号没有 ZCode 凭据图(导入时未采集本机 credentials.json)⇒ 无法判定写哪枚 token',
      'no-template',
    )
  }
  base[tokenKey] = payload.token

  const out = {}
  for (const [k, v] of Object.entries(base)) {
    const wasEncrypted =
      typeof rawMap[k] === 'string' && String(rawMap[k]).startsWith(ZCODE_ENC_PREFIX)
    out[k] = wasEncrypted || !(k in rawMap) ? encryptZcodeValue(v, cipherKey) : v
  }
  const backupFile = backupOf(file)
  atomicWrite(file, `${JSON.stringify(out, null, 2)}\n`)
  return writeResult('zcode', file, backupFile, {
    uid: payload.uid,
    replacedUid: null,
    notes: [`写入凭据键:${tokenKey}`],
    restartHint: '重启 ZCode 桌面端 / TUI 后生效',
  })
}

// =============================================================================
// Electron safeStorage 公共段(CodeArts / Qoder 共用)
// =============================================================================

function readElectronKey(extract, localStatePath) {
  try {
    return extract.readAesKeyFromLocalState(localStatePath)
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : ''
    throw new WriteError(
      `读不出 Electron 加密密钥(${localStatePath}):${e instanceof Error ? e.message : String(e)}`,
      code === 'CODEARTS_BAD_LOCAL_STATE' ? 'target-shape' : 'target-locked',
    )
  }
}

export function encryptSafeStorageBlob(plaintext, key) {
  const nonce = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const ct = Buffer.concat([c.update(String(plaintext), 'utf8'), c.final()])
  return Buffer.concat([Buffer.from('v10', 'ascii'), nonce, ct, c.getAuthTag()])
}

// =============================================================================
// CodeArts — state.vscdb 的 safeStorage 秘密行
// =============================================================================

/** 从 state.vscdb 路径反推 roaming 目录(%APPDATA%\codearts-agent) */
function codeartsRoamingDir(targetFile) {
  return path.dirname(path.dirname(path.dirname(targetFile)))
}

export function applyCodearts(payload, opts = {}) {
  const extract = opts.extract
  const target = payload.target ? path.resolve(payload.target) : ''
  let roamingDirs = []
  if (target) {
    roamingDirs = [fs.existsSync(target) && fs.statSync(target).isFile() ? codeartsRoamingDir(target) : target]
  } else {
    roamingDirs = extract.codeartsCandidateRoamingDirs(opts.env ?? process.env)
  }
  if (roamingDirs.length === 0) {
    throw new WriteError('本机没找到 CodeArts 数据目录(%APPDATA%\\codearts-agent)', 'no-target')
  }

  const template = templateOf(payload)
  assertTemplateUid(template, payload.uid)
  let lastError = null
  for (const dir of roamingDirs) {
    const localStatePath = path.join(dir, 'Local State')
    if (!fs.existsSync(localStatePath)) continue
    let key
    let blobs
    try {
      key = readElectronKey(extract, localStatePath)
      blobs = extract.readSecretBlobsFromVscdb(dir)
    } catch (e) {
      lastError = e
      continue
    }
    const rows = []
    for (const b of blobs) {
      try {
        rows.push({ key: b.key, blob: b.blob, session: extract.decryptSafeStorageBlob(b.blob, key) })
      } catch {
        /* 单条解不开(旧 key 轮换等)跳过,不冒绿 */
      }
    }
    if (rows.length === 0) {
      lastError = new WriteError(`CodeArts 秘密行有 ${blobs.length} 条但全部解不开`, 'target-shape')
      continue
    }
    const templateUid = assertTemplateUid(template, payload.uid)
    const row =
      (templateUid && rows.find((r) => asText(r.session?.account?.id) === templateUid)) ||
      rows.find((r) => asText(r.session?.account?.id) === payload.uid) ||
      (rows.length === 1 ? rows[0] : null)
    if (!row) {
      throw new WriteError(
        `CodeArts 里有 ${rows.length} 条登录会话,无法判定该写哪一条(先在本机登录目标号后重试)`,
        'duplicate-accounts',
      )
    }
    const replacedUid = asText(row.session?.account?.id) || null
    const base = template ?? row.session
    const next = cloneJson(base)

    const tokenKeys = ['securitytoken', 'security_token', 'cloud_dragon_token'].filter((k) => k in base)
    for (const k of tokenKeys.length > 0 ? tokenKeys : ['securitytoken']) next[k] = payload.token
    if (asText(payload.secrets.accessKeyId)) next.accessKey = payload.secrets.accessKeyId
    if (asText(payload.secrets.secretAccessKey)) next.secretKey = payload.secrets.secretAccessKey
    if (payload.refreshToken) {
      if ('refreshToken' in base && !('refresh_token' in base)) next.refreshToken = payload.refreshToken
      else next.refresh_token = payload.refreshToken
    } else {
      delete next.refreshToken
      delete next.refresh_token
    }
    if (payload.expiresAt) {
      if ('expiration' in base && !('expires_at' in base)) next.expiration = payload.expiresAt
      else next.expires_at = payload.expiresAt
    } else {
      delete next.expires_at
      delete next.expiration
    }

    const nextBlob = encryptSafeStorageBlob(JSON.stringify(next), key)
    const dbFile = path.join(dir, 'User', 'globalStorage', 'state.vscdb')
    const backupFile = backupOf(dbFile)
    try {
      const { DatabaseSync } = require('node:sqlite')
      const db = new DatabaseSync(dbFile)
      try {
        // readSecretBlobsFromVscdb 统一回 Buffer;原行是文本 JSON 还是 BLOB 由现场值形态判定
        const current = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get(row.key)
        const useText = typeof current?.value === 'string'
        const value = useText
          ? JSON.stringify({ type: 'Buffer', data: Array.from(nextBlob) })
          : nextBlob
        db.prepare('UPDATE ItemTable SET value = ? WHERE key = ?').run(value, row.key)
      } finally {
        db.close()
      }
    } catch (e) {
      throw new WriteError(
        `写 state.vscdb 失败(CodeArts 正在运行会独占库):${e instanceof Error ? e.message : String(e)}。请退出 CodeArts Agent 后重试`,
        'target-locked',
      )
    }
    return writeResult('codearts', dbFile, backupFile, {
      uid: payload.uid,
      replacedUid,
      notes: [`已更新秘密行:${row.key.slice(0, 80)}`],
      restartHint: '重启 CodeArts Agent 后生效(运行中客户端退出时可能覆写库,建议先退出再写)',
    })
  }
  if (lastError instanceof WriteError) throw lastError
  throw new WriteError(
    `CodeArts 登录态读取失败:${lastError instanceof Error ? lastError.message : '未判定'}`,
    'target-shape',
  )
}

// =============================================================================
// Qoder — %APPDATA%\com.qoder[cn].app.*\auth.v1.dat
// =============================================================================

const QODER_TOKEN_ALIASES = ['token', 'accessToken']

function qoderAppDirs(env, template) {
  const base = asText(env.APPDATA)
  if (!base) return []
  const edition = asText(template?.edition)
  let dirs = []
  try {
    dirs = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (d.name.startsWith('com.qoder.app.') || d.name.startsWith('com.qodercn.app.')))
      .map((d) => {
        const full = path.join(base, d.name)
        return { full, edition: d.name.startsWith('com.qodercn.') ? 'cn' : 'intl' }
      })
  } catch {
    return []
  }
  if (edition) dirs = dirs.filter((d) => d.edition === edition)
  return dirs
    .map((d) => {
      try {
        return { ...d, mtime: fs.statSync(path.join(d.full, 'auth.v1.dat')).mtimeMs }
      } catch {
        return { ...d, mtime: -1 }
      }
    })
    .filter((d) => d.mtime >= 0)
    .sort((a, b) => b.mtime - a.mtime)
    .map((d) => d.full)
}

export function applyQoder(payload, opts = {}) {
  const extract = opts.extract
  const template = templateOf(payload)
  assertTemplateUid(template, payload.uid)
  let dir = ''
  if (payload.target) {
    const target = path.resolve(payload.target)
    dir = fs.existsSync(target) && fs.statSync(target).isFile() ? path.dirname(target) : target
  } else if (asText(template?.appDir) && fs.existsSync(asText(template.appDir))) {
    dir = asText(template.appDir)
  } else {
    for (const env of clientEnvs(opts)) {
      dir = qoderAppDirs(env, template)[0] ?? ''
      if (dir) break
    }
  }
  if (!dir) {
    throw new WriteError(
      '本机没找到 Qoder 数据目录(%APPDATA%\\com.qoder[cn].app.*;请先在本机登录一次 Qoder 客户端)',
      'no-target',
    )
  }
  const authFile = path.join(dir, 'auth.v1.dat')
  const localStatePath = path.join(dir, 'Local State')
  if (!fs.existsSync(authFile) || !fs.existsSync(localStatePath)) {
    throw new WriteError(
      `Qoder 数据目录不完整(缺 auth.v1.dat 或 Local State):${dir} ⇒ 请先在本机登录一次 Qoder 客户端`,
      'no-target',
    )
  }
  const key = readElectronKey(extract, localStatePath)
  let current
  try {
    current = extract.decryptSafeStorageBlob(fs.readFileSync(authFile), key)
  } catch (e) {
    throw new WriteError(
      `Qoder auth.v1.dat 解不开(客户端加密格式变更或密钥不匹配):${e instanceof Error ? e.message : String(e)}`,
      'target-shape',
    )
  }
  if (!asObj(current)) throw new WriteError('Qoder auth.v1.dat 解出的会话不是对象', 'target-shape')
  const replacedUid = asText(asObj(current.user)?.id) || asText(current.userId) || null

  const base = template ?? current
  const next = cloneJson(base)
  const tokenKey = QODER_TOKEN_ALIASES.find((k) => k in base) ?? 'token'
  next[tokenKey] = payload.token
  if (payload.refreshToken) next.refreshToken = payload.refreshToken
  else delete next.refreshToken
  if (payload.expiresAt) next.expiresAt = payload.expiresAt
  else delete next.expiresAt
  if (payload.refreshExpiresAt) next.refreshTokenExpiresAt = payload.refreshExpiresAt
  else if (!template) delete next.refreshTokenExpiresAt
  // 模板里的凭证字段已剔除;显式清掉另一份 token 别名,防止旧号 token 残留
  delete next[tokenKey === 'token' ? 'accessToken' : 'token']

  const nextBlob = encryptSafeStorageBlob(JSON.stringify(next), key)
  const backupFile = backupOf(authFile)
  atomicWrite(authFile, nextBlob)
  return writeResult('qoder', authFile, backupFile, {
    uid: payload.uid,
    replacedUid,
    notes: ['若 Qoder 正在运行,请先退出再写入(运行中客户端退出时可能覆写 auth.v1.dat)'],
    restartHint: '退出并重启 Qoder 后生效',
  })
}

// =============================================================================
// CLI
// =============================================================================

export const ADAPTERS = Object.freeze({
  codex: applyCodex,
  opencode: applyOpencode,
  minimax: applyMinimax,
  zcode: applyZcode,
  codearts: applyCodearts,
  qoder: applyQoder,
})

async function loadExtract() {
  const [codex, opencode, minimax, zcode, codearts] = await Promise.all([
    import(pathToFileURL(path.join(HERE, 'lib', 'codex-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'opencode-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'minimax-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'zcode-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'codearts-auth-extract.mjs')).href),
  ])
  return {
    resolveCodexHome: codex.resolveCodexHome,
    candidateDataDirs: opencode.candidateDataDirs,
    minimaxCandidateRoots: (opts) => minimax.candidateRoots(opts),
    minimaxDiscoverAuthFiles: minimax.discoverAuthFiles,
    zcodeCandidateRoots: (opts) => zcode.candidateRoots(opts),
    zcodeDeriveCipherKey: (env) => zcode.deriveCipherKey(env),
    zcodeDecryptValue: (value, key) => zcode.decryptZcodeValue(value, key),
    codeartsCandidateRoamingDirs: (env) => codearts.candidateRoamingDirs(env),
    readSecretBlobsFromVscdb: codearts.readSecretBlobsFromVscdb,
    readAesKeyFromLocalState: codearts.readAesKeyFromLocalState,
    decryptSafeStorageBlob: codearts.decryptSafeStorageBlob,
  }
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function printSummary(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }
  const label = PROVIDER_LABEL[result.providerCode] ?? result.providerCode
  const clientLine = result.clientWasRunning
    ? `   客户端: 写前已${result.clientForced ? '强制' : '优雅'}关闭 ${result.clientProduct}` +
      (result.clientRestarted ? '(已重新打开)\n' : '(未能自动重新打开,请手动启动)\n')
    : ''
  process.stdout.write(
    `✅ 已把 uid=${result.uid} 的登录态写进本机 ${label}\n` +
      `   落点: ${result.targetFile}\n` +
      (result.backupFile ? `   备份: ${result.backupFile}\n` : '   备份: (原文件不存在,本次为新建)\n') +
      `   替换前登录: ${result.replacedUid ?? '(解析不到或原未登录)'}\n` +
      clientLine +
      result.notes.map((n) => `   ${n}\n`).join('') +
      `   ${result.restartHint}\n`,
  )
}

export async function main(argv) {
  const options = parseArgs(argv)
  if (options.help) {
    process.stdout.write(
      '用法: node scripts/local-login.mjs --provider <平台> --stdin [--json]\n' +
        `平台: ${SUPPORTED_PROVIDERS.join(' / ')} (trae 走 trae-login-local.mjs)\n` +
        'stdin JSON: { uid, token, refreshToken?, expiresAt?, refreshExpiresAt?, secrets, target? }\n' +
        '  secrets = 号池 secretsEnc 解密后的整包(含 sessionTemplate / providerID / recordKey / credentialMap 等)\n' +
        '  target  = 仅供测试/运维显式指定落点(普通调用不要传)\n',
    )
    return 0
  }
  if (options.error) {
    process.stderr.write(`❌ ${options.error}\n`)
    return 2
  }

  let payloadText
  try {
    payloadText = await readStdin()
  } catch (e) {
    process.stderr.write(`❌ 读标准输入失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  if (!payloadText.trim()) {
    process.stderr.write('❌ 标准输入为空(未判定)\n')
    return 2
  }

  let payload
  try {
    payload = normalizePayload(JSON.parse(payloadText))
  } catch (e) {
    const code = e instanceof WriteError ? e.code : 'payload-shape'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }

  const adapter = ADAPTERS[options.provider]
  if (!adapter) {
    process.stderr.write(`❌ 平台 ${options.provider} 没有写回适配器\n`)
    return 2
  }
  let extract
  try {
    extract = await loadExtract()
  } catch (e) {
    process.stderr.write(`❌ 提取器加载失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  let client = null
  try {
    client = closeClientForWrite(options.provider)
  } catch (e) {
    const code = e instanceof WriteError ? e.code : 'target-locked'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return 1
  }
  let result
  try {
    result = adapter(payload, { extract })
  } catch (e) {
    // 写失败也要把刚关掉的客户端拉回来,不能把用户的客户端扔在关闭状态
    if (client?.wasRunning) relaunchClient(client)
    const code = e instanceof WriteError ? e.code : 'write-failed'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return 1
  }
  if (client?.wasRunning) {
    const re = relaunchClient(client)
    result = {
      ...result,
      clientProduct: client.product,
      clientWasRunning: true,
      clientClosed: client.closed,
      clientForced: client.forced,
      clientRestarted: re.restarted,
      ...(re.error ? { clientLaunchError: re.error } : {}),
      restartHint: re.restarted
        ? `已重新打开 ${client.product},登录态即时生效`
        : `写入前已关闭 ${client.product},但未能自动重新打开:请手动启动客户端`,
    }
  }
  printSummary(result, options.json)
  return 0
}

// 只有被当脚本直接跑才执行(测试 import 时不触发,免得吃掉测试进程的 stdin)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}

export const __test__ = {
  parseArgs,
  normalizePayload,
  assertTemplateUid,
  backupOf,
  atomicWrite,
  CLIENT_IMAGES,
  closeClientForWrite,
  relaunchClient,
  encryptZcodeValue,
  encryptSafeStorageBlob,
  loadExtract,
  applyCodex,
  applyOpencode,
  applyMinimax,
  applyZcode,
  applyCodearts,
  applyQoder,
  WriteError,
  CREDENTIAL_KEYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
