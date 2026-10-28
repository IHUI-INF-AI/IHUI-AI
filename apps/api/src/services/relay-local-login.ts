// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「登录本机」— 把号池账号写进本机客户端登录态(2026-10-27 立,同日扩容到六平台)。
 *
 * 为什么要有这一层:号池只存 token/refreshToken/到期时刻,而客户端登录态是整份会话
 * (账号资料/设备信息/provider 条目…),JWT 载荷里没有这些 ⇒ 光靠票重建不出登录态。
 * 导入时已把整份会话去掉凭证存成「会话模板」(加密进 secretsEnc),这里用池内最新凭证
 * 打补丁,再交给对应脚本重封客户端存储写回。
 *
 * 分工(§0.6 单一真相源):
 * - 本服务 = 取行、平台裁决、票据策略、spawn、错误映射(不复制模板形状/凭证剔除规则);
 * - scripts/trae-login-local.mjs = Trae storage.json 重封 byteCrypto 信封 + 备份 + 原子写;
 * - scripts/local-login.mjs = codex/opencode/minimax/zcode/codearts/qoder 六平台写回。
 *
 * 票据策略(trae 之外一律不刷新):Trae 保留「临期先兜底刷新一次」的既有生产口径;
 * 其它平台写池内当前票 —— 主动刷新会轮换 refreshToken,若本机正用着同一个号就会
 * 把用户当场顶下线(用户硬约束:不许顶号)。票已临期只在结果里如实标注,让客户端自行续期。
 *
 * 安全:凭据经 stdin 进子进程,不落盘、不回显;本服务任何返回值都不含 token 明文;
 * 写前备份/原子写/模板 uid 校验全部由脚本执行(四个平台共用同一份安全实现)。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { aiRelayAccountPool, type AiRelayAccountPool } from '@ihui/database'
import { db } from '../db/index.js'
import { decryptAccountCredentials } from './relay-account-pool-service.js'
import { refreshOne } from './relay-account-pool-scheduler.js'
import type { RelayProviderCode } from './relay-account-format.js'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓库根:src|dist/services 上溯 4 级;生产(D:\DevEnv\ihui-prod)同样成立 */
const REPO_ROOT = process.env.IHUI_REPO_ROOT?.trim() || resolve(HERE, '..', '..', '..', '..')
const TRAE_SCRIPT = resolve(REPO_ROOT, 'scripts', 'trae-login-local.mjs')
const LOCAL_SCRIPT = resolve(REPO_ROOT, 'scripts', 'local-login.mjs')
/** 服务身份下换桌面用户执行的 helper(CodeArts/Qoder 的用户级 DPAPI 只能以该用户身份解) */
const RUN_AS_USER_SCRIPT = resolve(REPO_ROOT, 'apps', 'api', 'scripts', 'run-as-user.ps1')
const SPAWN_TIMEOUT_MS = 90_000
/** 票剩余寿命低于此值就视为"临期":trae 写回后客户端必然立刻轮换,与池内旧票打架 */
const EXPIRY_GUARD_MS = 60_000

/**
 * 本机登录态无法离线重建的平台 + 原因(判据见各自提取器头注;409 明说,不冒绿)。
 * 这些平台仍可正常入池/转发/保活,只是不能一键写回本机客户端。
 */
export const LOCAL_LOGIN_UNSUPPORTED_REASONS: Partial<Record<RelayProviderCode, string>> = {
  workbuddy: '加密密钥只在本机运行中的主进程内(9229 inspector),离线无法重封本机登录态',
  loomy: '本机登录态是 Electron leveldb 且被客户端独占,离线无法重建',
  doubao: '登录态是 Chrome Cookies 库(被浏览器独占),离线无法重封',
  lingma: '字段级登录态形状尚未实证(本机未安装),没有可验证的写回配方',
  grokbot: '本机凭证是 sandSealedFile 密封串,没有明文 token 可重建',
}

/** 由 scripts/local-login.mjs 接管写回的六平台 */
const LOCAL_SCRIPT_PROVIDERS: ReadonlySet<string> = new Set([
  'codex',
  'opencode',
  'minimax',
  'zcode',
  'codearts',
  'qoder',
])

/**
 * 必须「以桌面登录用户身份」执行写回的平台:Local State 的密钥是用户级 DPAPI,
 * IHUI-API 以 LocalSystem 运行时既解不开(SYSTEM 主密钥不同)、落点又指向 systemprofile。
 * 走 apps/api/scripts/run-as-user.ps1(WTSQueryUserToken → CreateProcessAsUser);
 * 非服务身份时该脚本原样直跑,行为与直接 spawn 等价。
 */
const RUN_AS_USER_PROVIDERS: ReadonlySet<string> = new Set(['codearts', 'qoder'])

/**
 * 选 PowerShell 解释器:优先 pwsh 7(本机实测 powershell.exe 可能被替换成
 * 「PS7 二进制 + PS5.1 $PSHOME」的怪异形态,模块搜索路径里没有可加载的
 * Utility 模块 ⇒ ConvertFrom-Json/Test-Path/Add-Type 全部「找不到」)。
 * 次序:IHUI_PWSH_PATH > Program Files\PowerShell\{7,6} > 自带 powershell.exe。
 */
function powershellPath(): string {
  const override = process.env.IHUI_PWSH_PATH?.trim()
  if (override && existsSync(override)) return override
  const pf = process.env.ProgramFiles?.trim() || 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)']?.trim() || 'C:\\Program Files (x86)'
  const local = process.env.LOCALAPPDATA?.trim()
  const candidates = [
    resolve(pf, 'PowerShell', '7', 'pwsh.exe'),
    resolve(pf, 'PowerShell', '6', 'pwsh.exe'),
    resolve(pf86, 'PowerShell', '7', 'pwsh.exe'),
    ...(local ? [resolve(local, 'Microsoft', 'PowerShell', '7', 'pwsh.exe')] : []),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  const root = process.env.SystemRoot?.trim() || 'C:\\Windows'
  return resolve(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

export class LocalLoginError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: 400 | 409 | 500 | 502,
  ) {
    super(message)
    this.name = 'LocalLoginError'
  }
}

export interface LocalLoginResult {
  ok: true
  providerCode: RelayProviderCode
  /** 目标账号 */
  uid: string
  /** 写入前本机在登的 uid(解析不到为 null) */
  replacedUid: string | null
  /** 实际写入的客户端存储文件 */
  targetFile: string
  backupFile: string
  /** 写回端逐条说明(如 MiniMax 同目录 auth-state 同步、CodeArts 秘密行键) */
  notes: string[]
  /**
   * 写入的是临期票:客户端启动后会自行续期。非 trae 平台不做主动刷新(防顶号),
   * 临期/过期票照写并在此如实标注。
   */
  tokenNearExpiry: boolean
  /** 写回前是否让号池兜底刷新过一次(仅 trae 临期/过期票会走到) */
  refreshed: boolean
  restartHint: string
  /** Trae 专属:设备证明信封是否在场/是否写回 */
  deviceEnvelopePresent?: boolean
  deviceEnvelopeWritten?: boolean
  /** Trae 专属:写回时该产品是否在跑、是否被优雅关闭、是否已自动重新拉起 */
  clientProduct?: string
  clientWasRunning?: boolean
  clientClosed?: boolean
  /** 客户端托盘常驻/关不掉时是否走了强制结束(用户已在确认框授权替换登录态) */
  clientForced?: boolean
  clientRestarted?: boolean
  clientLaunchError?: string
}

function runScript(
  scriptPath: string,
  args: string[],
  payload: unknown,
  opts: { asUser?: boolean } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const useHelper =
      opts.asUser === true &&
      process.platform === 'win32' &&
      RUN_AS_USER_SCRIPT !== '' &&
      existsSync(RUN_AS_USER_SCRIPT)
    const command = useHelper ? powershellPath() : process.execPath
    const commandArgs = useHelper
      ? [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          RUN_AS_USER_SCRIPT,
          '-Exe',
          process.execPath,
          '-ArgJson',
          JSON.stringify([scriptPath, ...args]),
          '-WorkingDirectory',
          REPO_ROOT,
          '-TimeoutSeconds',
          String(Math.max(5, Math.floor(SPAWN_TIMEOUT_MS / 1000) - 5)),
        ]
      : [scriptPath, ...args]
    const child = spawn(command, commandArgs, {
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const out: Buffer[] = []
    const errBuf: Buffer[] = []
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* 已退出 */
      }
      finish(() =>
        reject(new LocalLoginError(`写回脚本超时(${SPAWN_TIMEOUT_MS}ms)`, 'timeout', 500)),
      )
    }, SPAWN_TIMEOUT_MS)
    child.stdout.on('data', (c: Buffer) => out.push(c))
    child.stderr.on('data', (c: Buffer) => errBuf.push(c))
    child.on('error', (e) => finish(() => reject(e)))
    child.on('close', (code) =>
      finish(() =>
        resolvePromise({
          code,
          stdout: Buffer.concat(out).toString('utf8'),
          stderr: Buffer.concat(errBuf).toString('utf8'),
        }),
      ),
    )
    child.stdin.end(JSON.stringify(payload))
  })
}

/** 脚本 stderr 形如 `❌ [code] message`;剥掉前缀取码与话术,凭据本来就不会出现在里面 */
function parseScriptError(stderr: string): { code: string; message: string } {
  const line = stderr
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .pop()
  const text = line ?? ''
  const m = /^❌\s*\[([^\]]+)]\s*(.*)$/.exec(text)
  if (m) return { code: m[1] ?? 'write-failed', message: m[2] || '写回失败' }
  return { code: 'write-failed', message: text.replace(/^❌\s*/, '') || '写回失败' }
}

/** 脚本错误码 → HTTP 状态(参数错 400;环境/模板/锁定类冲突 409;其余上游/脚本故障 502) */
function statusOf(code: string): 400 | 409 | 502 {
  if (code === 'payload-shape' || code === 'bad-args') return 400
  if (
    code === 'no-template' ||
    code === 'template-uid-mismatch' ||
    code === 'no-target' ||
    code === 'no-storage' ||
    code === 'target-shape' ||
    code === 'storage-shape' ||
    code === 'duplicate-accounts' ||
    code === 'target-locked' ||
    code === 'cipher-key-mismatch'
  ) {
    return 409
  }
  return 502
}

function parseOutput(stdout: string): Record<string, unknown> {
  try {
    const lastLine = stdout.trim().split(/\r?\n/).pop() ?? ''
    return JSON.parse(lastLine) as Record<string, unknown>
  } catch {
    throw new LocalLoginError('写回脚本返回不可解析(未判定)', 'bad-output', 502)
  }
}

/** 票是否临期(含已过期);null 到期时刻 = 无法判定,不冒充临期 */
function isNearExpiry(row: AiRelayAccountPool, now: number): boolean {
  return row.tokenExpiresAt !== null && row.tokenExpiresAt.getTime() <= now + EXPIRY_GUARD_MS
}

/**
 * 池内 trae 号没有会话模板时的最小会话(2026-10-28 立)。
 *
 * 立因:号池里一部分 trae 号是「只导入了凭证」进来的(旧导入/脚本直灌/换机),没有
 * sessionTemplate ⇒ 老实现直接 409 no-template,用户点「登录本机」必失败。而 Trae 的
 * 会话信封实际只要求 userId + 平台静态档 + 凭证;account 里的邮箱/头像/组织等资料
 * 缺了不影响客户端出登录态,登录成功后 sync-trae-client-session.mjs(每 10 分钟)会把
 * 客户端整份会话回灌成完整模板。
 *
 * 静态字段取值来自本机实测模板(2026-10-27 号池审计,零凭据):
 * host=https://api.trae.cn、userRegion={CN,CN}、scope=marscode、loginScope=trae、
 * iss/storeCountryCode/storeCountrySrc/work_country 为空串、migrateToSG=false。
 */
export function buildMinimalTraeTemplate(
  row: Pick<AiRelayAccountPool, 'uid' | 'name'>,
): Record<string, unknown> {
  const now = new Date()
  return {
    tokenReleaseAt: now.toISOString(),
    userId: row.uid,
    host: 'https://api.trae.cn',
    userRegion: { region: 'CN', _aiRegion: 'CN' },
    account: {
      username: (row.name ?? '').trim() || row.uid,
      iss: '',
      iat: Math.floor(now.getTime() / 1000),
      organization: '',
      work_country: '',
      email: '',
      avatar_url: '',
      description: '',
      scope: 'marscode',
      loginScope: 'trae',
      nonPlainTextMobile: '',
      storeCountryCode: '',
      storeCountrySrc: '',
      storeRegion: '',
      userTag: '',
      migrateToSG: false,
    },
  }
}

/**
 * Trae:票还有 60 秒以上寿命就直接写(客户端不会立刻轮换,池内票保持同一枚);
 * 临期/已过期才让号池兜底刷新一次(此窗口本机没有该号登录态,不会把客户端顶下线)。
 * 刷新失败不阻塞写回 —— 客户端自带设备证明,通常能自己把票续活,再由同步回灌池。
 */
async function loginTraeLocal(row: AiRelayAccountPool): Promise<LocalLoginResult> {
  let current = row
  const nearExpiry = isNearExpiry(current, Date.now())
  let refreshed = false
  if (nearExpiry) {
    try {
      refreshed = await refreshOne(current)
    } catch {
      refreshed = false
    }
    if (refreshed) {
      const [next] = await db
        .select()
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, current.id))
        .limit(1)
      if (next) current = next
    }
  }

  const creds = decryptAccountCredentials(current)
  const stored = creds.secrets.sessionTemplate
  const notes: string[] = []
  let template: Record<string, unknown>
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    template = stored as Record<string, unknown>
  } else {
    // 没有模板不再一票否决:用平台静态字段合成最小会话(见 buildMinimalTraeTemplate 头注)
    template = buildMinimalTraeTemplate(current)
    notes.push(
      '该号没有会话模板,已按平台静态字段生成最小会话(不影响登录态;客户端登录成功后 10 分钟内的同步会把完整资料回填进号池)',
    )
  }

  const payload = {
    uid: current.uid,
    token: creds.token,
    refreshToken: creds.refreshToken ?? undefined,
    expiresAt: current.tokenExpiresAt?.toISOString(),
    refreshExpiresAt: current.refreshExpiresAt?.toISOString(),
    sessionTemplate: template,
    deviceId: current.deviceId ?? undefined,
    deviceKeyPem:
      typeof creds.secrets.deviceKeyPem === 'string' ? creds.secrets.deviceKeyPem : undefined,
    devicePubPem:
      typeof creds.secrets.devicePubPem === 'string' ? creds.secrets.devicePubPem : undefined,
    /**
     * 必传:客户端在跑时它的内存态会在退出时覆写 storage.json,写回端必须先优雅关闭
     * 客户端、写盘、自检、再重新拉起(见 scripts/lib/trae-client-process.mjs 头注)。
     * 不传 ⇒ 写回端遇到运行中的客户端直接 409,绝不盲写。
     */
    restartClient: true,
  }

  let outcome
  try {
    outcome = await runScript(TRAE_SCRIPT, ['--stdin', '--json'], payload)
  } catch (e) {
    if (e instanceof LocalLoginError) throw e
    const message = e instanceof Error ? e.message : String(e)
    throw new LocalLoginError(`启动写回脚本失败:${message}`, 'spawn-failed', 500)
  }
  if (outcome.code !== 0) {
    const { code, message } = parseScriptError(outcome.stderr)
    throw new LocalLoginError(message, code, statusOf(code))
  }

  const parsed = parseOutput(outcome.stdout)
  const targetFile = typeof parsed.storageFile === 'string' ? parsed.storageFile : ''
  if (!targetFile) {
    throw new LocalLoginError('写回脚本未回报落点(未判定)', 'bad-output', 502)
  }
  const clientProduct = typeof parsed.clientProduct === 'string' ? parsed.clientProduct : ''
  const clientWasRunning = parsed.clientWasRunning === true
  const clientClosed = parsed.clientClosed === true
  const clientForced = parsed.clientForced === true
  const clientRestarted = parsed.clientRestarted === true
  const clientLaunchError =
    typeof parsed.clientLaunchError === 'string' ? parsed.clientLaunchError : ''
  if (clientClosed) {
    notes.push(
      clientRestarted
        ? `写入前已${clientForced ? '强制' : '优雅'}关闭并重新打开 ${clientProduct || 'Trae'} 客户端(运行中的客户端会用内存态覆写登录态,故必须先关后写)`
        : `写入前已关闭 ${clientProduct || 'Trae'} 客户端,但未能自动重新拉起,请手动打开客户端`,
    )
  }
  return {
    ok: true,
    providerCode: 'trae',
    uid: typeof parsed.uid === 'string' ? parsed.uid : current.uid,
    replacedUid: typeof parsed.replacedUid === 'string' ? parsed.replacedUid : null,
    targetFile,
    backupFile: typeof parsed.backupFile === 'string' ? parsed.backupFile : '',
    notes,
    tokenNearExpiry: nearExpiry && !refreshed,
    refreshed,
    restartHint:
      typeof parsed.restartHint === 'string' ? parsed.restartHint : '重启 Trae CN 客户端后生效',
    deviceEnvelopePresent: parsed.deviceEnvelopePresent === true,
    deviceEnvelopeWritten: parsed.deviceEnvelopeWritten === true,
    clientProduct,
    clientWasRunning,
    clientClosed,
    clientForced,
    clientRestarted,
    clientLaunchError,
  }
}

/** 六平台:写池内当前票,不主动刷新(刷新会轮换 refreshToken ⇒ 可能顶掉正在用的本机客户端) */
async function loginViaScript(
  row: AiRelayAccountPool,
  providerCode: RelayProviderCode,
): Promise<LocalLoginResult> {
  const creds = decryptAccountCredentials(row)
  const payload = {
    uid: row.uid,
    token: creds.token,
    refreshToken: creds.refreshToken ?? undefined,
    expiresAt: row.tokenExpiresAt?.toISOString(),
    refreshExpiresAt: row.refreshExpiresAt?.toISOString(),
    secrets: creds.secrets,
  }

  let outcome
  try {
    outcome = await runScript(
      LOCAL_SCRIPT,
      ['--provider', providerCode, '--stdin', '--json'],
      payload,
      { asUser: RUN_AS_USER_PROVIDERS.has(providerCode) },
    )
  } catch (e) {
    if (e instanceof LocalLoginError) throw e
    const message = e instanceof Error ? e.message : String(e)
    throw new LocalLoginError(`启动写回脚本失败:${message}`, 'spawn-failed', 500)
  }
  if (outcome.code !== 0) {
    const { code, message } = parseScriptError(outcome.stderr)
    throw new LocalLoginError(message, code, statusOf(code))
  }

  const parsed = parseOutput(outcome.stdout)
  const targetFile = typeof parsed.targetFile === 'string' ? parsed.targetFile : ''
  if (!targetFile) {
    throw new LocalLoginError('写回脚本未回报落点(未判定)', 'bad-output', 502)
  }
  return {
    ok: true,
    providerCode,
    uid: typeof parsed.uid === 'string' ? parsed.uid : row.uid,
    replacedUid: typeof parsed.replacedUid === 'string' ? parsed.replacedUid : null,
    targetFile,
    backupFile: typeof parsed.backupFile === 'string' ? parsed.backupFile : '',
    notes: Array.isArray(parsed.notes)
      ? parsed.notes.filter((n): n is string => typeof n === 'string')
      : [],
    tokenNearExpiry: isNearExpiry(row, Date.now()),
    refreshed: false,
    restartHint: typeof parsed.restartHint === 'string' ? parsed.restartHint : '重启客户端后生效',
  }
}

/**
 * 把号池账号写进本机客户端登录态。
 *
 * @throws LocalLoginError 平台不支持(409,带原因)/ 模板缺失或错配(409)/ 客户端环境不可写(409)/
 *   脚本故障(502)。任何错误信息都不含凭据明文。
 */
export async function loginAccountLocal(row: AiRelayAccountPool): Promise<LocalLoginResult> {
  const providerCode = row.providerCode as RelayProviderCode
  if (providerCode === 'trae') return loginTraeLocal(row)
  const unsupported = LOCAL_LOGIN_UNSUPPORTED_REASONS[providerCode]
  if (unsupported) {
    throw new LocalLoginError(
      `平台 ${providerCode} 暂不支持登录本机:${unsupported}`,
      'unsupported-provider',
      409,
    )
  }
  if (!LOCAL_SCRIPT_PROVIDERS.has(providerCode)) {
    throw new LocalLoginError(
      `平台 ${providerCode} 未登记本机登录态写回配方`,
      'unsupported-provider',
      409,
    )
  }
  return loginViaScript(row, providerCode)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
