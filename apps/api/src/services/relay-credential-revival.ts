// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活判死行的「凭证版本驱动复活」单一真相源(2026-11-15 立)。
 *
 * 立因(根治「掉线只能人工重登」):既有判死闸门把「上游旧票据作废」这一票据级、
 * 可逆的事实外推成账号级不可逆 —— `revivableCandidatesOf` 无条件排除判死行,而各平台
 * 回灌腿 / 导入器 / 镜像 pull 一旦写入新票,`credVersion` 必然前进,这恰恰是「新证据已到」
 * 的最强信号,闸门却完全不看它。结果是:客户端重新登录后新票进了池,行仍永久
 * `down + temp_unschedulable=true`,且告警走 10 年去重窗静默 ⇒ 只能人工重导。
 *
 * 本模块不删判死闸门(删了就会退回「每 6h 拿死票空撞上游」的无限循环),而是给闸门
 * 补上唯一缺的那半格:**判死时把当时的 credVersion 记进 extra_metadata,只有版本号
 * 前进过(有新票)才放行解摘;凭证没变就继续静默**。
 *
 * 判据全仓只此一份(§0.6):scheduler 的解摘闸门、各平台回灌腿的即时复活补丁、
 * 本机重扫导入后的健康复位,一律 import 本模块,不许各写一份版本号比较。
 * 纯函数、零 IO、零凭据明文:credVersion 只是整数代次,extra_metadata 只读写留痕键。
 */
import type { SQL } from 'drizzle-orm'

/** 留痕键名。写进 `extra_metadata` 的 jsonb,形状见 TerminalVerdictSnapshot。 */
export const TERMINAL_VERDICT_KEY = 'terminalVerdict' as const

/** 判死瞬间的凭证代次快照。 */
export interface TerminalVerdictSnapshot {
  /** 命中的判死码 id(来自 config/relay-irreversible-verdicts.json)。 */
  id: string
  /** 判死那一刻池行的 cred_version;之后任何写票路径都会 +1。 */
  credVersion: number
  /** ISO 时刻,仅供人查账,不参与判据。 */
  at: string
}

/** 复活判据所需的最小行面(各调用方 select 时带上这几列即可)。 */
export interface RevivalEvidenceRow {
  credVersion?: unknown
  extraMetadata?: unknown
  lastErrorMessage?: unknown
  last_error_message?: unknown
  healthStatus?: unknown
  refreshFailureCount?: unknown
  tempUnschedulable?: unknown
}

export interface HealthRevivalPatch {
  healthStatus: 'unknown'
  refreshFailureCount: 0
  lastErrorMessage: null
  tempUnschedulable: false
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

/**
 * 读判死留痕。形状不合法(缺 id / credVersion 不是有限数)一律 null = 未判定 ⇒ 不放行。
 * 绝不因为「看着像」就猜一个版本出来 —— 猜错会把死票放回撞上游的循环里。
 */
export function terminalVerdictOf(
  row: RevivalEvidenceRow | null | undefined,
): TerminalVerdictSnapshot | null {
  const extra = asRecord(row?.extraMetadata)
  if (!extra) return null
  const snap = asRecord(extra[TERMINAL_VERDICT_KEY])
  if (!snap) return null
  const id = typeof snap.id === 'string' && snap.id ? snap.id : ''
  const credVersion = asFiniteNumber(snap.credVersion)
  const at = typeof snap.at === 'string' ? snap.at : ''
  if (!id || credVersion === null || !at) return null
  return { id, credVersion, at }
}

/** 构造判死留痕。verdictId 空 / credVersion 取不到 ⇒ null(未判定,不写假证据)。 */
export function terminalVerdictSnapshotOf(
  row: RevivalEvidenceRow,
  verdictId: string | null,
  now: Date = new Date(),
): TerminalVerdictSnapshot | null {
  const credVersion = asFiniteNumber(row.credVersion)
  if (!verdictId || credVersion === null) return null
  const at = now.toISOString()
  if (!Number.isFinite(Date.parse(at))) return null
  return { id: verdictId, credVersion, at }
}

/**
 * 判死之后凭证代次是否前进过 —— 本轮唯一认可的「新票已到池」证据。
 *
 * 覆盖全部写票路径:`refreshOne` 成功换票 / 六条会话回灌腿 / `importAccounts` 覆盖导入 /
 * 镜像 pull 采纳客户端 rt,四者都走 `credVersion + 1`(既有口径,本模块不另立一份)。
 * 没有留痕 / 留痕坏了 / 版本字段取不到 ⇒ false(fail-closed,宁可继续静默)。
 */
export function hasFreshCredentials(row: RevivalEvidenceRow | null | undefined): boolean {
  const snap = terminalVerdictOf(row)
  if (!snap) return false
  const current = asFiniteNumber(row?.credVersion)
  if (current === null) return false
  return current > snap.credVersion
}

/**
 * 解摘闸门用:有判死留痕 ∧ 凭证代次已前进 ⇒ 放行解摘。
 * 注意不在这里判「lastErrorMessage 是否还命中判死码」—— 导入器会清掉错误信息,
 * 那种行本来就不在解摘候选里;多行一层正则就是第二份判据(§0.6 禁)。
 */
export function shouldReviveTerminal(row: RevivalEvidenceRow | null | undefined): boolean {
  return terminalVerdictOf(row) !== null && hasFreshCredentials(row)
}

/**
 * 把留痕从 extra_metadata 里摘掉(纯函数,不改入参、不丢其它键)。
 * 复活成功后调用;留痕不摘会让下一轮解摘继续拿旧版本比,形成假阳性。
 */
export function stripTerminalVerdict(extra: unknown): Record<string, unknown> {
  const src = asRecord(extra)
  if (!src) return {}
  const out: Record<string, unknown> = { ...src }
  delete out[TERMINAL_VERDICT_KEY]
  return out
}

/**
 * 回灌腿 / 导入后的即时复活补丁(与「巡检刷新成功」分支同形)。
 *
 * 为什么需要它:解摘腿 6h 一轮,而回灌腿每 10 分钟就能把本机重登的新票写进池;
 * 让新票落地那一刻就把健康面复位,比等下一轮解摘更快,且不依赖判死闸门。
 *
 * 反向牙:客户端票已过期(给了 clientExpiresAt 且 <= now)⇒ null,不把死票复活;
 * 行本来健康且无失败面 ⇒ null(不产生无意义写);行形状取不到 ⇒ 按「异常」处理但
 * 只依赖明确为真的 broken 信号,绝不凭空把 healthy 行改成 unknown。
 */
export function healthRevivalPatchOf(
  row: RevivalEvidenceRow | null | undefined,
  opts: { clientExpiresAt?: Date | null; now?: Date } = {},
): HealthRevivalPatch | null {
  const { clientExpiresAt, now = new Date() } = opts
  if (clientExpiresAt) {
    const exp =
      clientExpiresAt instanceof Date
        ? clientExpiresAt.getTime()
        : Date.parse(String(clientExpiresAt))
    if (!Number.isFinite(exp) || exp <= now.getTime()) return null
  }
  const status = String(row?.healthStatus ?? '')
  const failures = asFiniteNumber(row?.refreshFailureCount) ?? 0
  const broken =
    (status !== '' && status !== 'healthy') || failures > 0 || row?.tempUnschedulable === true
  if (!broken) return null
  return {
    healthStatus: 'unknown',
    refreshFailureCount: 0,
    lastErrorMessage: null,
    tempUnschedulable: false,
  }
}

/**
 * 解摘写库用的 extra_metadata 补丁形状提示类型(纯声明,不生成 SQL)。
 * 各调用方用 drizzle `sql` 表达式做 `extra_metadata - 'terminalVerdict'` 原子删键,
 * 避免并发下整对象覆盖丢掉别的键;本模块只负责判据,不负责写库形态。
 */
export type TerminalVerdictRemoval = SQL | Record<string, unknown>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
