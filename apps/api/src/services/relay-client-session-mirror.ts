// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 客户端会话镜像(2026-11-11 立)—— 号池 OAuth 票"双消费者轮换竞态"根治的服务端。
//
// 立因(2026-11-11 minimax 死票取证,证据链见 scripts/client-session-mirror-bridge.mjs 头注):
// 采自本机客户端的 OAuth 票与客户端副本共享同一条 grant;两边各自刷新各自轮转 rt,
// 上游反滥用按"rt 重放"处理 → 整条 grant 吊销(invalid_grant "start a new
// authorization"),两端全灭且无法自动复活。
//
// 根治 = 单一消费者化,两个钩子全部收口在 refreshOne 咽喉:
//  1. 刷前 pull(refreshOne 内):客户端副本的 rt 比池新(mtime 晚于池 lastRefreshAt)
//     且 rt 不同 ⇒ 采纳客户端 rt 作为刷新基底 —— 绝不用上游已见过的旧 rt 去重放。
//  2. 刷后 push(refreshOne 成功后):新凭据写回客户端副本 —— 客户端下次用票就是
//     池刚换的新票,不再持有旧 rt。
// 死票自愈性质:票因竞态死了,只要客户端重新登录/续票成功,下一次保活 pull 就会
// 采纳新 rt 自动复活 —— 无需人工重导。
import { spawn } from 'node:child_process'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { logger } from '../utils/logger.js'

// services → src → api → apps → 仓根(四级 dirname,少一级就指到 apps/api/scripts 找不到桥)
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
)
const BRIDGE = path.join(REPO_ROOT, 'scripts', 'client-session-mirror-bridge.mjs')
const RUN_AS_USER_SCRIPT = path.join(REPO_ROOT, 'apps', 'api', 'scripts', 'run-as-user.ps1')
const BRIDGE_TIMEOUT_MS = 60_000

/** 镜像注册面:采自本机客户端副本、且凭据会被客户端自己轮换的平台。
 *  数据驱动 —— 新平台接入只改这里(桥内补 pull 分支即可)。 */
export const MIRROR_PROVIDERS: ReadonlySet<string> = new Set(['minimax', 'qoder', 'workbuddy'])

/**
 * 明确不接入镜像的平台与理由(审计留痕;漏接比错接更危险,这里逐个说清):
 * - trae:池刷新主通道是 cookie→GetUserToken(响应不带新 rt,`refreshToken:undefined`
 *   保原值),不动 rt;设备证明 ExchangeToken 通道设备绑定且客户端信封有 10 分钟级
 *   sync-trae-client-session 双向收敛,历史上零 invalid_grant。若未来 trae 刷新开始
 *   轮转 rt,这里要重新评估接入。
 * - doubao/loomy/opencode/zcode/codearts/minimax(sk-api 票):无 refreshToken 或凭据
 *   不轮换(AK/SK 长期有效、sessionid/静态 key),不存在双消费者轮换竞态。
 * - codex/raccoon/lingma/grokbot:当前池内无票;接入后面世时按同判据评估。
 */
export const MIRROR_EXCLUDED: Readonly<Record<string, string>> = Object.freeze({
  trae: 'GetUserToken 主通道不轮换 rt + 设备证明绑定 + 10 分钟级客户端回灌收敛,无竞态暴露',
  doubao: 'cookie 票无 rt,sessionid 不轮换',
  loomy: 'session 直写,无 rt',
  opencode: '池票无 rt',
  zcode: 'credentials.json 直写,无 rt',
  codearts: 'AK/SK 长期凭据,STS 派生不互踢',
  codex: '池内无票(面世时按同判据评估)',
  raccoon: '池内无票(面世时按同判据评估)',
  lingma: '池内无票(面世时按同判据评估)',
  grokbot: '池内无票(面世时按同判据评估)',
})

export interface ClientSessionSnapshot {
  token: string
  refreshToken: string
  /** 客户端副本文件 mtime(ISO)—— 仲裁"谁更新"的时钟 */
  mtimeIso: string | null
  /** 平台代次字段(minimax generation 等),有就带上 */
  generation?: number | string
  /** 命中的记录定位键(minimax recordKey / qoder session id 等) */
  matchKey?: string
}

export interface MirrorPullResult {
  ok: boolean
  /** 平台采集器吐出的会话集合(形状随平台);由调用方按 uid/recordKey 挑匹配 */
  data?: unknown
  code?: string
  message?: string
}

function bridgeSpawn(
  payload: { op: 'pull' | 'push'; provider: string; payload?: unknown },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const useHelper = process.platform === 'win32' && existsSync(RUN_AS_USER_SCRIPT)
    const command = useHelper ? resolvePwsh() : process.execPath
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
          JSON.stringify([BRIDGE]),
          '-WorkingDirectory',
          REPO_ROOT,
          '-TimeoutSeconds',
          String(Math.floor(BRIDGE_TIMEOUT_MS / 1000) - 5),
        ]
      : [BRIDGE]
    const child = spawn(command, commandArgs, { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const out: Buffer[] = []
    const errBuf: Buffer[] = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill()
      } catch {
        /* 已退出 */
      }
      reject(new Error(`镜像桥超时(${BRIDGE_TIMEOUT_MS}ms)`))
    }, BRIDGE_TIMEOUT_MS)
    child.stdout.on('data', (c: Buffer) => out.push(c))
    child.stderr.on('data', (c: Buffer) => errBuf.push(c))
    child.on('error', (e) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(errBuf).toString('utf8') })
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

/** 选 PowerShell 解释器(与 relay-local-login 同一优先序;镜像走 asUser 必经 pwsh) */
function resolvePwsh(): string {
  const override = process.env.IHUI_PWSH_PATH?.trim()
  if (override && existsSync(override)) return override
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const local = process.env.LOCALAPPDATA ?? ''
  for (const candidate of [
    path.join(pf, 'PowerShell', '7', 'pwsh.exe'),
    path.join(pf, 'PowerShell', '6', 'pwsh.exe'),
    path.join(pf86, 'PowerShell', '7', 'pwsh.exe'),
    path.join(local, 'Microsoft', 'PowerShell', '7', 'pwsh.exe'),
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return 'powershell.exe'
}

/** 刷前采纳仲裁(纯函数,镜像测试钉形状)。
 *  只有客户端副本**确实比池新**(mtime 晚于池 lastRefreshAt)且 rt 不同才采纳 ——
 *  反向(池新客户端旧)绝不采纳,否则拿旧 rt 去重放反而制造 invalid_grant。 */
export function shouldAdoptClientRt(input: {
  clientRt: string
  poolRt: string
  clientMtimeIso: string | null
  poolLastRefreshAt: Date | string | null
}): boolean {
  const { clientRt, poolRt, clientMtimeIso, poolLastRefreshAt } = input
  if (!clientRt || !poolRt || clientRt === poolRt) return false
  if (!clientMtimeIso || !poolLastRefreshAt) return false
  const mtime = new Date(clientMtimeIso).getTime()
  const lastRefresh = new Date(poolLastRefreshAt).getTime()
  if (!Number.isFinite(mtime) || !Number.isFinite(lastRefresh)) return false
  return mtime > lastRefresh
}

/** recordKey/sourcePath 归一:池侧入库时空白曾被写成 NUL 字符(2026-11-11 实证
 *  "prod.cn\u0000pn7olb" vs 客户端文件 "prod.cn pn7olb"),精确比对必失配。
 *  归一 = 去空白与控制字符 + 统一小写 + 斜杠统一;键尾段足够唯一,双向包含即命中。 */
function normalizeKey(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\s\u0000-\u001f]+/g, '').replace(/[\\/]+/g, '\\').toLowerCase()
}

function keysMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const na = normalizeKey(a)
  const nb = normalizeKey(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/** 从平台采集数据里挑出与目标票匹配的会话(纯函数)。
 *  minimax:池票 secrets.recordKey/sourcePath 定位;其余按 uid 字段匹配。 */
export function pickMatchingSession(
  providerCode: string,
  data: unknown,
  match: { uid: string; recordKey?: string; sourcePath?: string },
): ClientSessionSnapshot | null {
  if (providerCode === 'minimax') {
    const records = Array.isArray(data) ? data : []
    for (const r of records as Array<{ recordKey?: string; authPath?: string; mtimeMs?: number; rec?: Record<string, unknown> }>) {
      const keyHit = keysMatch(match.recordKey, r.recordKey)
      const pathHit = keysMatch(match.sourcePath, r.authPath)
      if (!keyHit && !pathHit) continue
      const rec = r.rec ?? {}
      const token = typeof rec.accessToken === 'string' ? rec.accessToken : ''
      const rt = typeof rec.refreshToken === 'string' ? rec.refreshToken : ''
      if (!token && !rt) continue
      return {
        token,
        refreshToken: rt,
        mtimeIso: typeof r.mtimeMs === 'number' ? new Date(r.mtimeMs).toISOString() : null,
        generation: typeof rec.generation === 'number' ? rec.generation : undefined,
        matchKey: r.recordKey,
      }
    }
    return null
  }
  // qoder/workbuddy:采集器归一形状里找 uid 匹配的现役会话
  const sessions = Array.isArray(data) ? data : ((data as { sessions?: unknown[] })?.sessions ?? [])
  for (const s of sessions as Array<Record<string, unknown>>) {
    const uidCandidates = [s.uid, s.userId, s.user_id, (s.account as Record<string, unknown> | undefined)?.id]
    if (!uidCandidates.map((v) => String(v ?? '')).includes(match.uid)) continue
    const token = typeof s.accessToken === 'string' ? s.accessToken : typeof s.token === 'string' ? s.token : ''
    const rt =
      typeof s.refreshToken === 'string' ? s.refreshToken : typeof s.refresh_token === 'string' ? s.refresh_token : ''
    if (!token && !rt) continue
    return {
      token,
      refreshToken: rt,
      mtimeIso: typeof s.mtimeIso === 'string' ? s.mtimeIso : null,
      generation: typeof s.generation === 'number' ? s.generation : undefined,
      matchKey: typeof s.sessionId === 'string' ? s.sessionId : undefined,
    }
  }
  return null
}

/** 刷前 pull:读客户端副本现役会话;失败/超时/平台未注册 ⇒ null(绝不阻塞刷新主流程)。 */
export async function pullClientSession(row: {
  providerCode: string
  uid: string
  secrets?: Record<string, unknown> | null
}): Promise<ClientSessionSnapshot | null> {
  if (!MIRROR_PROVIDERS.has(row.providerCode)) return null
  const secrets = row.secrets ?? {}
  const match = {
    uid: row.uid,
    recordKey: typeof secrets.recordKey === 'string' ? secrets.recordKey : undefined,
    sourcePath: typeof secrets.sourcePath === 'string' ? secrets.sourcePath : undefined,
  }
  try {
    const { code, stdout, stderr } = await bridgeSpawn({ op: 'pull', provider: row.providerCode })
    const text = stdout.trim()
    let parsed: MirrorPullResult | null = null
    try {
      parsed = JSON.parse(text.split(/\r?\n/).filter(Boolean).pop() ?? '') as MirrorPullResult
    } catch {
      /* 非 JSON 输出按失败处理 */
    }
    if (code !== 0 || !parsed?.ok) {
      logger.warn('[client-session-mirror] pull 未成功', {
        providerCode: row.providerCode,
        uidTail: row.uid.slice(-8),
        code,
        reason: parsed?.message ?? stderr.slice(0, 120),
      })
      return null
    }
    const session = pickMatchingSession(row.providerCode, parsed.data, match)
    if (!session) {
      logger.warn('[client-session-mirror] pull 成功但未匹配到该票的客户端会话(定位键归一后仍失配)', {
        providerCode: row.providerCode,
        uidTail: row.uid.slice(-8),
        hasRecordKey: Boolean(match.recordKey),
        hasSourcePath: Boolean(match.sourcePath),
      })
    }
    return session
  } catch (e) {
    logger.warn('[client-session-mirror] pull 异常(不阻塞刷新)', {
      providerCode: row.providerCode,
      uidTail: row.uid.slice(-8),
      reason: e instanceof Error ? e.message.slice(0, 120) : String(e),
    })
    return null
  }
}

/** 刷后 push 载荷(纯函数):形状 = local-login normalizePayload 同款;
 *  secrets 带上 sourcePath/recordKey/template,写回端就地改凭证、保客户端形状。 */
export function buildPushPayload(input: {
  row: { providerCode: string; uid: string; name: string | null; secretsEncDecoded?: Record<string, unknown> | null }
  token: string
  refreshToken: string | null | undefined
  expiresAt: Date | string | null
  refreshExpiresAt?: Date | string | null
  secrets?: Record<string, unknown> | null
}): Record<string, unknown> {
  const { row, token, refreshToken, expiresAt, refreshExpiresAt, secrets } = input
  const s = secrets ?? row.secretsEncDecoded ?? {}
  return {
    provider: row.providerCode,
    uid: row.uid,
    name: row.name ?? '',
    token,
    refreshToken: refreshToken ?? '',
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : '',
    refreshExpiresAt: refreshExpiresAt ? new Date(refreshExpiresAt).toISOString() : '',
    secrets: {
      ...(typeof s.sourcePath === 'string' ? { sourcePath: s.sourcePath } : {}),
      ...(typeof s.recordKey === 'string' ? { recordKey: s.recordKey } : {}),
      ...(s.sessionTemplate && typeof s.sessionTemplate === 'object' ? { sessionTemplate: s.sessionTemplate } : {}),
    },
    cookies: [],
    target: '',
  }
}

/** 刷后 push:新凭据写回客户端副本。fire-and-forget 语义 —— 调用方不 await 也绝不影响
 *  刷新主流程;所有失败只留痕。客户端在跑时 apply* 内部守卫会拒写(WriteError),
 *  绝不强杀用户正在用的客户端。 */
export async function pushClientSession(payload: Record<string, unknown>): Promise<boolean> {
  const provider = String(payload.provider ?? '')
  if (!MIRROR_PROVIDERS.has(provider)) return false
  try {
    const { code, stdout, stderr } = await bridgeSpawn({ op: 'push', provider, payload })
    const text = stdout.trim()
    let parsed: { ok?: boolean; message?: string; file?: string } | null = null
    try {
      parsed = JSON.parse(text.split(/\r?\n/).filter(Boolean).pop() ?? '') as { ok?: boolean; message?: string }
    } catch {
      /* 非 JSON 按失败 */
    }
    if (code !== 0 || !parsed?.ok) {
      logger.warn('[client-session-mirror] push 未成功(下次刷新会再试)', {
        providerCode: provider,
        uidTail: String(payload.uid ?? '').slice(-8),
        code,
        reason: parsed?.message ?? stderr.slice(0, 120),
      })
      return false
    }
    logger.info('[client-session-mirror] 新凭据已写回客户端副本', {
      providerCode: provider,
      uidTail: String(payload.uid ?? '').slice(-8),
      file: parsed.file ?? '',
    })
    return true
  } catch (e) {
    logger.warn('[client-session-mirror] push 异常(不影响池内票)', {
      providerCode: provider,
      uidTail: String(payload.uid ?? '').slice(-8),
      reason: e instanceof Error ? e.message.slice(0, 120) : String(e),
    })
    return false
  }
}

/** 刷新成功后是否需要 push(纯函数):平台注册 + 拿到了新 token 才推。 */
export function shouldPushAfterRefresh(providerCode: string, newToken: string | null | undefined): boolean {
  return MIRROR_PROVIDERS.has(providerCode) && typeof newToken === 'string' && newToken.length > 0
}
