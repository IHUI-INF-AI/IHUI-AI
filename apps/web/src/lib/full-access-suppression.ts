// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 高风险档确认弹窗的"不再提醒"记录(票 G-414 ②)
 *
 * 立因(此前形态,现读复验于票面登记的那枚 HEAD):
 * - `isFullAccessConfirmSuppressed()` 判的是 `localStorage.getItem(key) === '1'` ——
 *   一次性勾了"不再提醒"就**永久**压制安全确认弹窗:无期限、无版本、不绑被静默的对象。
 *   档位风险说明变了、或用户其实想被重新问一次,都没有出口(唯一的"重新提醒我"只在历史面板里)。
 * - 同文件另一个 key(`ihui:full-access-acknowledged`)注释承诺"一次性确认标志(用于 toast 文案)",
 *   但全仓 `getItem` 零命中 ⇒ 只写不读 = 装饰(与 `ihui:preferred-permission-mode` 同一型)。
 *
 * 现在的形态:一条**可判、有期限、绑守卫对象**的授权记录。
 * - 绑档:记录写清它静默的是哪一个守卫对象(`FULL_ACCESS_GUARD_SUBJECTS` 封闭集);
 *   新增一档必须在这里登记,否则记录对不上 ⇒ 重新问人(而不是默认放行)。
 * - 绑风险说明版本:`FULL_ACCESS_GUARD_POLICY_VERSION` 一变,旧静默即失效。
 * - 有期限:`FULL_ACCESS_SUPPRESSION_TTL_MS` 到期后重新问人。
 * - 三态不并桶:granted / 各种"必须问"(带原因) / undetermined(存储不可用或 SSR)——
 *   判不出时 fail-closed 照问,**但状态单独点名**,不把"没判"写成"已静默",也不写成"没静默过"。
 *
 * 兼容旧形态:旧记录是裸字符串 `'1'`(没有绑的对象、没有期限)⇒ 判 `malformed` ⇒ 重新问一次。
 * 这不是打断用户,而是"没有绑定期限的静默不算授权"这一判据的必然结论;问过一次即写入新记录。
 *
 * 参照同仓既有形态:`apps/web/src/hooks/use-permission-auto-revert.ts` 的 `AutoRevertRecord`
 * (readRecord 逐字段验类型,旧版缺字段视为无效)—— 同一套"记录必须是可判结构"的写法,不再另起。
 */

import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

/**
 * 可被"不再提醒"静默的守卫对象封闭集。新增一档必须同时在这里登记。
 *
 * 它是 `WorkspacePermissionMode` 的**子集**(不是同一件事):这里列的是"进档前要先问人"的档,
 * 而档位类型本身还包含不需要确认的档。类型层的这层关系由下面那条编译期断言钉住 ——
 * 有人往封闭集里塞一个不存在的档名时,那行会直接编译不过(而不是静默多出一种"没人认识的 subject")。
 */
export const FULL_ACCESS_GUARD_SUBJECTS = ['bypass-permissions'] as const
export type FullAccessGuardSubject = (typeof FULL_ACCESS_GUARD_SUBJECTS)[number]
// 编译期断言:封闭集必须落在档位类型内(运行时 erased,不引第二个真相源)
type _SubjectWithinMode = FullAccessGuardSubject extends WorkspacePermissionMode ? true : false
const _subjectWithinMode: _SubjectWithinMode = true
void _subjectWithinMode

/**
 * 风险说明的策略版本。弹窗的风险条目/文案实质变化时 +1 ⇒ 所有旧静默记录自动失效(重新问人)。
 * 依据:静默是对"这一版风险告知"的同意,不是对"以后所有风险告知"的一次性白名单。
 */
export const FULL_ACCESS_GUARD_POLICY_VERSION = 1

/** 一次"不再提醒"的有效期(ms)。30 天:到期重新问一次,而不是永久不再问。 */
export const FULL_ACCESS_SUPPRESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 记录结构版本(与策略版本分开:改存储形状不该改变用户对风险的同意)。 */
export const FULL_ACCESS_RECORD_SCHEMA = 1

/** 沿用既有 key 名,避免同仓长出第三个 key;值形态从裸 '1' 升级为版本化记录。 */
export const FULL_ACCESS_SUPPRESSION_KEY = 'ihui:full-access-suppressed'

/** 读数封闭集:一档放行,五档"必须问且各有各的名字",一档"判不出"。 */
export const SUPPRESSION_STATES = [
  'granted',
  'absent',
  'acknowledged_once',
  'expired',
  'policy_stale',
  'subject_unregistered',
  'malformed',
  'undetermined',
] as const
export type SuppressionState = (typeof SUPPRESSION_STATES)[number]

/** 判定结论:`suppressed` 与 `state` 不得只留一个(只留布尔就把五种原因压成了一个)。 */
export interface SuppressionDecision {
  /** 是否允许跳过确认弹窗 —— 只有 granted 为 true。 */
  suppressed: boolean
  state: SuppressionState
  /** 一句话依据(诊断/测试用;不进 UI 文案,故不占 i18n 键)。 */
  detail: string
  acknowledgedAt?: number
  expiresAt?: number
}

/** 单个守卫对象的授权。 */
interface Grant {
  policyVersion: number
  /** 用户勾"我了解风险"的时刻(ms)。 */
  acknowledgedAt: number
  /** 静默到期时刻(ms);null = 只确认过一次,下次仍要问。 */
  expiresAt: number | null
}

/**
 * 记录按守卫对象分格 —— 单值形态在长出第二档的那天就会"给 B 档授权顺手抹掉 A 档",
 * 所以现在就按映射写:一格授权只管一格。
 */
interface SuppressionRecord {
  schema: number
  grants: Record<string, Grant>
}

/** 存储读不到(隐私模式 / SSR / 解析失败)时区分"没有记录"与"判不出",不静默当"没静默过"。 */
type RawRead = { kind: 'missing' } | { kind: 'unavailable' } | { kind: 'raw'; raw: string }

function readRaw(): RawRead {
  if (typeof window === 'undefined') return { kind: 'unavailable' }
  try {
    const raw = window.localStorage.getItem(FULL_ACCESS_SUPPRESSION_KEY)
    return raw === null || raw === '' ? { kind: 'missing' } : { kind: 'raw', raw }
  } catch {
    return { kind: 'unavailable' }
  }
}

function writeGrant(subject: FullAccessGuardSubject, grant: Grant): void {
  if (typeof window === 'undefined') return
  // 读-改-写:只换本 subject 那一格,别档授权原样留着。
  const read = readRaw()
  const existing = read.kind === 'raw' ? parseRecord(read.raw) : null
  const record: SuppressionRecord =
    existing !== null && existing.schema === FULL_ACCESS_RECORD_SCHEMA
      ? existing
      : { schema: FULL_ACCESS_RECORD_SCHEMA, grants: {} }
  record.grants[subject] = grant
  try {
    window.localStorage.setItem(FULL_ACCESS_SUPPRESSION_KEY, JSON.stringify(record))
  } catch {
    // 隐私模式 / quota 超出:静默失败;下次 evaluate 落 absent ⇒ 照问人
  }
}

/** 逐字段验类型(参照 AutoRevertRecord 的 readRecord)。返回 null = 记录不可判 ⇒ 当作 malformed。 */
function parseRecord(raw: string): SuppressionRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const r = parsed as Partial<SuppressionRecord>
  if (typeof r.schema !== 'number') return null
  if (typeof r.grants !== 'object' || r.grants === null) return null
  const grants: Record<string, Grant> = {}
  for (const [subject, value] of Object.entries(r.grants)) {
    const grant = parseGrant(value)
    // 读不出形状的**那一格**丢掉(等价于没授权,fail-closed),而不是整条记录判废 ——
    // 一格坏不该撤销另一格的同意。
    if (grant !== null) grants[subject] = grant
  }
  return { schema: r.schema, grants }
}

function parseGrant(value: unknown): Grant | null {
  if (typeof value !== 'object' || value === null) return null
  const g = value as Partial<Grant>
  if (typeof g.policyVersion !== 'number' || typeof g.acknowledgedAt !== 'number') return null
  if (!(g.expiresAt === null || typeof g.expiresAt === 'number')) return null
  return { policyVersion: g.policyVersion, acknowledgedAt: g.acknowledgedAt, expiresAt: g.expiresAt }
}

/** 守卫对象是否已登记(闭集判据,不接受"未知 subject 默认放行")。 */
export function isFullAccessGuardSubject(value: unknown): value is FullAccessGuardSubject {
  return typeof value === 'string' && (FULL_ACCESS_GUARD_SUBJECTS as readonly string[]).includes(value)
}

/**
 * 判定"现在该不该问人"。
 *
 * 任何一条不成立都返回 suppressed:false —— 静默必须是**证出来的**,不是默认值。
 */
export function evaluateFullAccessSuppression(
  subject: FullAccessGuardSubject,
  now: number = Date.now(),
): SuppressionDecision {
  if (!isFullAccessGuardSubject(subject)) {
    return { suppressed: false, state: 'subject_unregistered', detail: `守卫对象未登记:${String(subject)}` }
  }
  const read = readRaw()
  if (read.kind === 'unavailable') {
    return { suppressed: false, state: 'undetermined', detail: 'localStorage 不可读(SSR 或隐私模式)' }
  }
  if (read.kind === 'missing') {
    return { suppressed: false, state: 'absent', detail: '没有任何确认记录' }
  }
  const record = parseRecord(read.raw)
  if (record === null) {
    // 旧形态裸 '1'(无绑对象、无期限)落在这里:没有期限与归属的静默不构成授权。
    return { suppressed: false, state: 'malformed', detail: '记录读不出版本化结构(含旧版裸 "1")' }
  }
  if (record.schema !== FULL_ACCESS_RECORD_SCHEMA) {
    return { suppressed: false, state: 'malformed', detail: `记录结构版本 ${record.schema} 不认` }
  }
  const grant = record.grants[subject]
  if (grant === undefined) {
    return { suppressed: false, state: 'absent', detail: `这一档(${subject})没有授权记录` }
  }
  if (grant.policyVersion !== FULL_ACCESS_GUARD_POLICY_VERSION) {
    return {
      suppressed: false,
      state: 'policy_stale',
      detail: `风险说明已换版(记录 ${grant.policyVersion} vs 当前 ${FULL_ACCESS_GUARD_POLICY_VERSION})`,
      acknowledgedAt: grant.acknowledgedAt,
    }
  }
  if (grant.expiresAt === null) {
    return {
      suppressed: false,
      state: 'acknowledged_once',
      detail: '只确认过一次,未勾"不再提醒"',
      acknowledgedAt: grant.acknowledgedAt,
    }
  }
  if (now >= grant.expiresAt) {
    return {
      suppressed: false,
      state: 'expired',
      detail: `静默已于 ${new Date(grant.expiresAt).toISOString()} 到期`,
      acknowledgedAt: grant.acknowledgedAt,
      expiresAt: grant.expiresAt,
    }
  }
  return {
    suppressed: true,
    state: 'granted',
    detail: `静默剩余 ${Math.max(0, Math.ceil((grant.expiresAt - now) / 86_400_000))} 天`,
    acknowledgedAt: grant.acknowledgedAt,
    expiresAt: grant.expiresAt,
  }
}

/** 写:用户勾了"我了解风险"(未必勾"不再提醒")⇒ 只记确认时刻,下次仍问。 */
export function recordFullAccessAcknowledgement(subject: FullAccessGuardSubject, now: number = Date.now()): void {
  writeGrant(subject, {
    policyVersion: FULL_ACCESS_GUARD_POLICY_VERSION,
    acknowledgedAt: now,
    expiresAt: null,
  })
}

/** 写:用户同时勾了"不再提醒"⇒ 有期限、绑档、绑版本的静默。 */
export function grantFullAccessSuppression(subject: FullAccessGuardSubject, now: number = Date.now()): void {
  writeGrant(subject, {
    policyVersion: FULL_ACCESS_GUARD_POLICY_VERSION,
    acknowledgedAt: now,
    expiresAt: now + FULL_ACCESS_SUPPRESSION_TTL_MS,
  })
}

/** 清:历史面板"重新提醒我"走这里,立刻恢复询问(整条记录清掉,不留半档)。 */
export function clearFullAccessSuppression(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(FULL_ACCESS_SUPPRESSION_KEY)
  } catch {
    // 清不掉也只会让 evaluate 落 absent/undetermined ⇒ 照问人
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
