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
 *   workbuddy %LOCALAPPDATA%\CodeBuddyExtension\...\auth\workbuddy-desktop[-ai].info
 *            $wbEncrypted 字段信封,密钥取自运行中主进程 inspector;取钥→关端→重封→拉起
 *   doubao   %LOCALAPPDATA%\Doubao\User Data\Default\Network\Cookies  Chromium os_crypt v10,可重封;GUI 同上
 *   其余(loomy/lingma/grokbot)无法离线重封,由服务层给明确 409 原因。
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
import {
  closeProduct,
  launchProduct,
  listProcessesByPath,
  listProductPids,
  resolveProductExe,
} from './lib/trae-client-process.mjs'

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
  'workbuddy',
  'doubao',
])

const PROVIDER_LABEL = Object.freeze({
  codex: 'Codex',
  opencode: 'OpenCode',
  minimax: 'MiniMax Code',
  zcode: 'ZCode',
  codearts: 'CodeArts',
  qoder: 'Qoder',
  workbuddy: 'WorkBuddy',
  doubao: '豆包',
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
    // 豆包捆绑账号的整套 cookie 条目 [{source,key,host,value}](其它平台为空)
    cookies: Array.isArray(raw.cookies) ? raw.cookies : [],
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
    template.account?.uid,
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

/**
 * 写后自检(2026-10-28 补):落盘成功 ≠ 客户端下次启动读到的是我们的号。
 * 可能是行语义写错(SQLite 文本/BLOB)、别名挑错、或落点被仍在退出的客户端回写覆盖。
 * 故写完立刻按**客户端自己的读法**把凭证读回来比一遍,读不回目标值就以 write-verify 失败,
 * 绝不冒绿(六平台与 trae 的"写后自检"同口径)。
 */
export function assertReadBack(what, verify) {
  let ok = false
  try {
    ok = verify() === true
  } catch (e) {
    throw new WriteError(
      `写后自检失败(${what} 读不回来):${e instanceof Error ? e.message : String(e)}`,
      'write-verify',
    )
  }
  if (!ok) {
    throw new WriteError(
      `写后自检失败(${what} 读回的不是刚写入的凭证,落点可能被其它进程覆写)`,
      'write-verify',
    )
  }
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
  doubao: ['Doubao'],
})

/**
 * workbuddy 刻意**不进** CLIENT_IMAGES:它的字段密钥只存在于运行中的主进程
 * (9229 inspector 取 loggerGet()),main() 的预关会把钥源一起关掉。
 * 关端/写盘/拉起由 applyWorkbuddy 适配器自己做(取钥 → 关端 → 写 → 自检 → 拉起),
 * 回报字段与 CLIENT_IMAGES 平台同名同义。
 */

/**
 * 映像名之外的兜底判据(2026-10-28 补):同一产品的不同发行版/版本,exe 名未必落在上面
 * 的候选集里(codearts 的实测映像名始终没能证实;Qoder 国内/国际版命名不同)。精确名
 * 全落空时改按**可执行文件路径**含产品关键字再扫一遍,免得把"正在跑的客户端"误判成
 * "没装没跑"后盲写 —— 那种写下去必被客户端退出时的内存态覆写,表现就是"点了不好使"。
 */
export const CLIENT_PATH_HINTS = Object.freeze({
  codearts: ['codearts'],
  qoder: ['qoder'],
  minimax: ['minimax'],
  zcode: ['zcode'],
  doubao: ['doubao'],
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
  if (!hit) {
    /**
     * 精确映像名全落空 ⇒ 按安装路径关键字兜底(见 CLIENT_PATH_HINTS 头注)。
     * 判"没在跑"的代价是盲写后被客户端覆写,所以宁可多扫一次 CIM。
     */
    const scanned = listProcessesByPath(CLIENT_PATH_HINTS[provider] ?? [], env)
    if (scanned === null) {
      throw new WriteError(
        `按安装路径探测 ${PROVIDER_LABEL[provider] ?? provider} 客户端进程失败(未判定)⇒ 拒绝盲写(运行中的客户端会在退出时覆写登录态)`,
        'target-locked',
      )
    }
    if (scanned.length === 0) {
      return { product: '', wasRunning: false, closed: false, forced: false, exePath: '' }
    }
    // 同一产品可能同时存在多个映像(Electron 主进程 + 更新器/助手):只关主进程那一族,
    // 并按它的映像名轮询 —— closeProduct 的退出判据就是"该映像名的 pid 面为空"。
    const main = scanned.find((r) => !/--type=/.test(r.commandLine)) ?? scanned[0]
    hit = {
      image: main.image,
      pids: uniq(scanned.filter((r) => r.image.toLowerCase() === main.image.toLowerCase()).map((r) => r.pid)),
      exePath: main.exePath,
    }
  }
  const exePath = hit.exePath || resolveProductExe(hit.image, env) || ''
  const closed = closeProduct(hit.image, { env, pids: hit.pids })
  return {
    product: hit.image,
    wasRunning: true,
    closed: closed.closed === true,
    forced: closed.forced === true,
    exePath,
  }
}

/**
 * 关不掉就不能写(2026-10-28 补):closeProduct 的 forced 轮也可能因权限/托盘常驻
 * 而没退干净,此时写下去必然被客户端退出时的内存态覆写 —— 宁可报错让用户手动退出,
 * 也不冒绿。closed 为 false 同时覆盖"探测未知"(tasklist 抖动)这一档,一律 fail-closed。
 */
export function assertClientClosed(info) {
  if (!info?.wasRunning || info.closed) return
  throw new WriteError(
    `已尝试关闭 ${info.product} 但进程仍在运行(或关断结果未判定)⇒ 拒绝写入:运行中的客户端会用内存态覆写登录态。请手动退出 ${info.product} 后重试`,
    'target-locked',
  )
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
  assertReadBack('Codex auth.json', () => asText(readJsonObject(file, 'Codex auth.json').tokens?.access_token) === payload.token)
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
  assertReadBack(
    'OpenCode auth.json',
    () =>
      asText(readJsonObject(file, 'OpenCode auth.json')?.[providerID]?.[authType === 'api' ? 'key' : 'access']) ===
      payload.token,
  )
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
  assertReadBack(
    'MiniMax auth.json',
    () => asText(readJsonObject(file, 'MiniMax auth.json')?.records?.[recordKey]?.accessToken) === payload.token,
  )

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
  // 按客户端的读法重解一遍:重封后的 enc:v1: 必须能解回池内票(不是只看文件写没写)
  assertReadBack('ZCode credentials.json', () => {
    const reread = readJsonObject(file, 'ZCode credentials.json')
    const raw = reread[tokenKey]
    const plain =
      typeof raw === 'string' && raw.startsWith(ZCODE_ENC_PREFIX) ? extract.zcodeDecryptValue(raw, cipherKey) : raw
    return asText(plain) === payload.token
  })
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
  // Buffer 直通(豆包 32 字节自家头必须按原始字节入密文,String(buf) 会串成十进制字节列表)
  const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8')
  const ct = Buffer.concat([c.update(data), c.final()])
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
    const writeKeys = tokenKeys.length > 0 ? tokenKeys : ['securitytoken']
    for (const k of writeKeys) next[k] = payload.token
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
    let backupFile = null
    try {
      const { DatabaseSync } = require('node:sqlite')
      const db = new DatabaseSync(dbFile)
      try {
        /**
         * 2026-10-28:先关客户端再写的前提是"库已静止",但客户端被强杀时没机会 checkpoint,
         * 会残留 state.vscdb-wal(最近事务只在 WAL 里)。此时直接 copyFile 备份只拷到主库,
         * 回滚会丢事务;且客户端重启后 WAL 重放的旧行可能盖掉我们刚写的值。
         * 故写前先把 WAL 并回主库(非 WAL 模式是无副作用的空操作),再备份、再更新。
         */
        try {
          db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
        } catch {
          /* 非 WAL 模式 / 没有 WAL 可合并 */
        }
        backupFile = backupOf(dbFile)
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
    // 写后自检:按客户端的读法(SQLite 取值 → 解 DPAPI 封套)把秘密行再解一遍
    assertReadBack('CodeArts state.vscdb', () => {
      const after = extract.readSecretBlobsFromVscdb(dir).find((b) => b.key === row.key)
      if (!after) return false
      const reread = extract.decryptSafeStorageBlob(after.blob, key)
      return writeKeys.some((k) => asText(reread?.[k]) === payload.token)
    })
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
  assertReadBack('Qoder auth.v1.dat', () => {
    const reread = extract.decryptSafeStorageBlob(fs.readFileSync(authFile), key)
    return asText(asObj(reread)?.[tokenKey]) === payload.token
  })
  return writeResult('qoder', authFile, backupFile, {
    uid: payload.uid,
    replacedUid,
    notes: ['若 Qoder 正在运行,请先退出再写入(运行中客户端退出时可能覆写 auth.v1.dat)'],
    restartHint: '退出并重启 Qoder 后生效',
  })
}

// =============================================================================
// WorkBuddy — %LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop[-ai].info
// =============================================================================

/**
 * 写回配方(2026-10-28 本机实证):
 * - 字段密钥只存在于运行中的主进程(inspector 取 loggerGet)⇒ 先取钥,再关端;
 * - 落点是带 $wbEncrypted 信封的 JSON 树,客户端只认信封形态:
 *   本机文件是同账号会话(account.uid === payload.uid)⇒ 整树原样搬(含全部信封),
 *   只重封 auth.accessToken/refreshToken 并刷新 auth 明文时刻族(同账号净零场景);
 *   本机是别人号/文件缺 ⇒ 用池内 sessionTemplate 重建树,按导入实采的 sealedPaths
 *   逐路重封资料信封,再补凭证(拿不到模板就 409 no-template,绝不冒绿);
 * - 写后按客户端读法解密自检(凭证 + account.uid),再原样拉起。
 * 进程控制由适配器自己做(workbuddy 不在 CLIENT_IMAGES,main() 预关会关掉钥源),
 * 回报 client* 字段与其它 GUI 平台同名同义。
 */
export async function applyWorkbuddy(payload, opts = {}) {
  const extract = opts.extract
  const env = opts.env ?? process.env
  const procControl = String(env.IHUI_LOCAL_LOGIN_PROC_CONTROL ?? '').trim() !== '0'

  // 1) 取钥:必须有且只有一个运行中的主进程
  const mains = extract.listWorkbuddyMainProcesses()
  if (mains.length === 0) {
    throw new WriteError(
      '未发现运行中的 WorkBuddy 主进程 ⇒ 取不到字段密钥(请先启动并登录 WorkBuddy 再试)',
      'no-target',
    )
  }
  if (mains.length > 1) {
    throw new WriteError(
      `发现 ${mains.length} 个 WorkBuddy 主进程,不确定取哪个钥源;请只保留一个再重试`,
      'duplicate-accounts',
    )
  }
  const { pid, userDataDir } = mains[0]
  const edition = asText(payload.secrets.edition) || extract.resolveEdition(userDataDir)
  if (!edition) throw new WriteError(`无法判定 WorkBuddy 版本: ${userDataDir}`, 'target-shape')
  let file = asText(payload.target) ? path.resolve(payload.target) : asText(payload.secrets.authFile)
  if (!file) file = extract.workbuddyAuthFilePath(edition)
  if (!fs.existsSync(file)) {
    throw new WriteError(`本机没有 WorkBuddy 登录会话文件:${file} ⇒ 请先在本机登录一次任意账号`, 'no-target')
  }
  let key
  let keyId
  try {
    const bootstrap = await extract.readAtRestBootstrap(pid)
    const derived = extract.deriveAtRestKey(bootstrap.atRestSecretKey)
    key = derived.key
    keyId = derived.keyId
  } catch (e) {
    throw new WriteError(
      `取 WorkBuddy 字段密钥失败:${e instanceof Error ? e.message : String(e)}`,
      'target-locked',
    )
  }

  // 2) 关端(运行中客户端退出时会用内存态覆写落点 ⇒ 必须先关再写)
  let client = { product: '', wasRunning: false, closed: false, forced: false, exePath: '' }
  try {
    if (process.platform === 'win32' && procControl) {
      const pids = listProductPids('WorkBuddy', env)
      if (pids === null) {
        throw new WriteError('探测 WorkBuddy.exe 进程失败(未判定)⇒ 拒绝盲写', 'target-locked')
      }
      if (pids.length > 0) {
        const exePath = resolveProductExe('WorkBuddy', env) || ''
        const r = closeProduct('WorkBuddy', { env, pids })
        client = {
          product: 'WorkBuddy',
          wasRunning: true,
          closed: r.closed === true,
          forced: r.forced === true,
          exePath,
        }
        if (!client.closed) {
          throw new WriteError(
            '已尝试关闭 WorkBuddy 但进程仍在运行(或关断结果未判定)⇒ 拒绝写入:运行中的客户端会用内存态覆写登录态。请手动退出 WorkBuddy 后重试',
            'target-locked',
          )
        }
      }
    }

    // 3) 读原始树 → 判账号 → 打补丁 → 重封
    let raw
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      throw new WriteError(
        `读/解析 WorkBuddy 会话文件失败:${file}(${e instanceof Error ? e.message : String(e)})⇒ 拒绝覆盖`,
        'target-shape',
      )
    }
    if (!asObj(raw)) throw new WriteError(`WorkBuddy 会话文件顶层不是对象:${file}`, 'target-shape')
    const localSealed = extract.collectSealedPaths(raw)
    const session = extract.decryptSessionTree(raw, key, keyId)
    const localUid = asText(asObj(session?.account)?.uid)
    const replacedUid = localUid || null
    let tree
    if (localUid && localUid === String(payload.uid)) {
      tree = raw
    } else {
      const template = templateOf(payload)
      assertTemplateUid(template, payload.uid)
      if (!template) {
        throw new WriteError(
          `本机 WorkBuddy 在登的是${localUid ? `另一个号(${localUid})` : '未判定账号'},而该池号没有会话模板` +
            '(导入时未采集)⇒ 无法重建登录态,请重新 --from workbuddy 导入',
          'no-template',
        )
      }
      tree = cloneJson(template)
      const sealedPaths =
        Array.isArray(payload.secrets.sealedPaths) && payload.secrets.sealedPaths.length > 0
          ? payload.secrets.sealedPaths
          : localSealed
      for (const p of sealedPaths) {
        if (p === '$.auth.accessToken' || p === '$.auth.refreshToken') continue
        const v = extract.getPathByJsonPath(tree, p)
        if (typeof v === 'string') extract.setPathByJsonPath(tree, p, extract.sealField(v, key, keyId))
      }
    }
    if (!asObj(tree.auth)) tree.auth = {}
    tree.auth.accessToken = extract.sealField(payload.token, key, keyId)
    if (payload.refreshToken) tree.auth.refreshToken = extract.sealField(payload.refreshToken, key, keyId)
    if (payload.expiresAt) tree.auth.expiresAt = payload.expiresAt
    if (payload.refreshExpiresAt) tree.auth.refreshExpiresAt = payload.refreshExpiresAt
    tree.auth.lastRefreshTime = new Date().toISOString()

    const backupFile = backupOf(file)
    atomicWrite(file, `${JSON.stringify(tree)}\n`)
    // 4) 写后自检:按客户端读法解密,凭证与账号必须都是目标号
    assertReadBack('WorkBuddy 会话文件', () => {
      const reread = extract.decryptSessionTree(JSON.parse(fs.readFileSync(file, 'utf8')), key, keyId)
      return (
        asText(asObj(reread?.auth)?.accessToken) === payload.token &&
        (!payload.refreshToken || asText(asObj(reread?.auth)?.refreshToken) === payload.refreshToken) &&
        asText(asObj(reread?.account)?.uid) === String(payload.uid)
      )
    })
    // 5) 拉起 + 回报
    let restarted = false
    let launchError = ''
    if (client.wasRunning && client.closed) {
      const helperPath = path.resolve(HERE, '..', 'apps', 'api', 'scripts', 'run-as-user.ps1')
      const l = launchProduct(client.exePath, { product: client.product, helperPath, env })
      restarted = l.launched === true
      launchError = l.error || ''
    }
    return writeResult('workbuddy', file, backupFile, {
      uid: payload.uid,
      replacedUid,
      notes: [
        `版本:${edition}`,
        `信封重封:auth.accessToken${payload.refreshToken ? '+auth.refreshToken' : ''}(其余${localSealed.length}路信封按形态保留/重封)`,
      ],
      restartHint: restarted
        ? `已重新打开 WorkBuddy,登录态即时生效`
        : client.wasRunning
          ? '写入前已关闭 WorkBuddy,但未能自动重新打开:请手动启动客户端'
          : '启动 WorkBuddy 后生效',
      clientProduct: client.product,
      clientWasRunning: client.wasRunning,
      clientClosed: client.closed,
      clientForced: client.forced,
      clientRestarted: restarted,
      ...(launchError ? { clientLaunchError: launchError } : {}),
    })
  } catch (e) {
    // 写失败也要把刚关掉的客户端拉回来(与 main() 对 CLIENT_IMAGES 平台的兜底同口径)
    if (client.wasRunning && client.closed) {
      try {
        const helperPath = path.resolve(HERE, '..', 'apps', 'api', 'scripts', 'run-as-user.ps1')
        launchProduct(client.exePath, { product: client.product, helperPath, env })
      } catch {
        /* 拉不回来由用户手动启动,不掩盖写入错误 */
      }
    }
    throw e
  } finally {
    if (key) key.fill(0)
  }
}

// =============================================================================
// 豆包 — %LOCALAPPDATA%\Doubao\User Data\Default\Network\Cookies(Chromium os_crypt)
// =============================================================================

/** Chromium epoch:1601-01-01 UTC 起算的微秒 */
function chromiumNowUs() {
  return BigInt(Date.now()) * 1000n + 11644473600000000n
}

/** node:sqlite 的 BLOB 回读形态兼容(裸 Uint8Array/Buffer,与提取器同判据) */
function asBlob(rawEv) {
  if (rawEv === null || rawEv === undefined) return null
  if (Buffer.isBuffer(rawEv)) return rawEv
  if (ArrayBuffer.isView(rawEv)) return Buffer.from(rawEv.buffer, rawEv.byteOffset, rawEv.byteLength)
  return rawEv.data ? Buffer.from(rawEv.data) : null
}

/**
 * 写回配方(2026-10-28 本机实证):豆包登录态 = 字节 passport 族 cookie 整包。
 * 落点是 Chromium 旧列名 schema 的 Cookies 库(NOT NULL 全列),值 = v10 封
 * (32 字节豆包自家头 + utf8 真值,AES-256-GCM,密钥 = Local State os_crypt 剥
 * DPAPI 前缀后 CurrentUser 解)。行存在 ⇒ UPDATE(host_key,name),不存在 ⇒ INSERT
 * (默认值镜像本机实证的 ttwid 行)。进程控制走 CLIENT_IMAGES['Doubao'](main() 关/拉)。
 */
export function applyDoubao(payload, opts = {}) {
  const extract = opts.extract
  const entries = (Array.isArray(payload.cookies) ? payload.cookies : [])
    .map((c) => ({ host: asText(c?.host), name: asText(c?.key), value: asText(c?.value) }))
    .filter((c) => c.host && c.name && c.value)
  if (entries.length === 0) {
    throw new WriteError(
      '该池号没有 cookie 捆绑包(导入时未采集豆包会话)⇒ 无法写回,请重新 --from doubao 导入',
      'no-template',
    )
  }
  let userDataDir = ''
  if (payload.target) {
    userDataDir = path.resolve(payload.target)
  } else {
    for (const env of clientEnvs(opts)) {
      const hit = (extract.doubaoCandidateUserDataDirs(env) ?? []).find((d) =>
        fs.existsSync(path.join(d, 'Default', 'Network', 'Cookies')),
      )
      if (hit) {
        userDataDir = hit
        break
      }
    }
  }
  if (!userDataDir) {
    throw new WriteError(
      '本机没找到豆包 Cookies 库(%LOCALAPPDATA%\\Doubao\\User Data\\Default\\Network\\Cookies)' +
        ' ⇒ 请先安装豆包桌面端并登录一次任意账号',
      'no-target',
    )
  }
  const dbFile = path.join(userDataDir, 'Default', 'Network', 'Cookies')
  if (!fs.existsSync(dbFile)) {
    throw new WriteError(`豆包 Cookies 库不存在:${dbFile}`, 'no-target')
  }
  const key = readElectronKey(extract, path.join(userDataDir, 'Local State'))
  const { DatabaseSync } = require('node:sqlite')
  let backupFile = null
  const written = []
  try {
    const db = new DatabaseSync(dbFile)
    try {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      } catch {
        /* 非 WAL 模式 / 无 WAL 可合并 */
      }
      backupFile = backupOf(dbFile)
      const nowUs = chromiumNowUs()
      const upd = db.prepare(
        "UPDATE cookies SET value = '', encrypted_value = ?, last_update_utc = ?, last_access_utc = ? WHERE host_key = ? AND name = ?",
      )
      const ins = db.prepare(
        'INSERT INTO cookies (creation_utc, host_key, top_frame_site_key, name, value, encrypted_value, path,' +
          ' expires_utc, is_secure, is_httponly, last_access_utc, has_expires, is_persistent, priority, samesite,' +
          ' source_scheme, source_port, last_update_utc, source_type, has_cross_site_ancestor)' +
          ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      for (const e of entries) {
        const blob = encryptSafeStorageBlob(extract.wrapDoubaoAppPrefix(e.value), key)
        const r = upd.run(blob, nowUs, nowUs, e.host, e.name)
        if (Number(r.changes ?? 0) === 0) {
          // 行不存在 ⇒ 按本机实证 ttwid 行的默认值族新建(非会话票一律 NOT NULL 补齐)
          ins.run(
            nowUs, e.host, '', e.name, '', blob, '/',
            0, 1, 1, nowUs, 0, 1, 1, 0, 2, 443, nowUs, 1, 0,
          )
        }
        written.push(`${e.host}/${e.name}`)
      }
    } finally {
      db.close()
    }
    // 写后自检:按豆包读法逐条解密剥头,必须读回刚写入的值
    assertReadBack('豆包 Cookies 库', () => {
      const ro = new DatabaseSync(dbFile, { readOnly: true })
      try {
        for (const e of entries) {
          const row = ro
            .prepare('SELECT encrypted_value FROM cookies WHERE host_key = ? AND name = ?')
            .get(e.host, e.name)
          const blob = asBlob(row?.encrypted_value)
          if (!blob) return false
          const plain = extract.stripDoubaoAppPrefix(
            extract.decryptOsCryptString(blob, key, { rawBuffer: true }),
          )
          if (plain !== e.value) return false
        }
        return true
      } finally {
        ro.close()
      }
    })
  } catch (e) {
    if (e instanceof WriteError) throw e
    throw new WriteError(
      `写豆包 Cookies 库失败(豆包正在运行会独占库):${e instanceof Error ? e.message : String(e)}。请退出豆包后重试`,
      'target-locked',
    )
  }
  return writeResult('doubao', dbFile, backupFile, {
    uid: payload.uid,
    replacedUid: null,
    notes: [`已写入 ${written.length} 条会话族 cookie:${written.join(', ')}`],
    restartHint: '重启豆包桌面端后生效(运行中客户端退出时可能覆写库,建议先退出再写)',
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
  workbuddy: applyWorkbuddy,
  doubao: applyDoubao,
})

async function loadExtract() {
  const [codex, opencode, minimax, zcode, codearts, workbuddy, doubao] = await Promise.all([
    import(pathToFileURL(path.join(HERE, 'lib', 'codex-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'opencode-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'minimax-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'zcode-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'codearts-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'workbuddy-auth-extract.mjs')).href),
    import(pathToFileURL(path.join(HERE, 'lib', 'doubao-auth-extract.mjs')).href),
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
    listWorkbuddyMainProcesses: workbuddy.listWorkbuddyMainProcesses,
    readAtRestBootstrap: workbuddy.readAtRestBootstrap,
    deriveAtRestKey: workbuddy.deriveAtRestKey,
    decryptSessionTree: workbuddy.decryptSessionTree,
    sealField: workbuddy.sealField,
    collectSealedPaths: workbuddy.collectSealedPaths,
    getPathByJsonPath: workbuddy.getPathByJsonPath,
    setPathByJsonPath: workbuddy.setPathByJsonPath,
    resolveEdition: workbuddy.resolveEdition,
    workbuddyAuthFilePath: workbuddy.workbuddyAuthFilePath,
    doubaoCandidateUserDataDirs: (env) => doubao.candidateUserDataDirs(env),
    wrapDoubaoAppPrefix: doubao.wrapDoubaoAppPrefix,
    stripDoubaoAppPrefix: doubao.stripDoubaoAppPrefix,
    decryptOsCryptString: doubao.decryptOsCryptString,
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
    assertClientClosed(client)
  } catch (e) {
    const code = e instanceof WriteError ? e.code : 'target-locked'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return 1
  }
  let result
  try {
    result = await adapter(payload, { extract })
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
  CLIENT_PATH_HINTS,
  assertReadBack,
  closeClientForWrite,
  assertClientClosed,
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
  applyWorkbuddy,
  applyDoubao,
  WriteError,
  CREDENTIAL_KEYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
