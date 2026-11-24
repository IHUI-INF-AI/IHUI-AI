// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一审批决策出口契约(2026-11-24)。
 *
 * 背景:CLI 的 danger-gate 是 route 三态(flag/approved/denied + deny cause),
 * ai-service 的 managed_permissions 是求解四态(unmanaged/solved/unsatisfiable/undetermined)。
 * 两端各自正确,但没有共同记录形状 ⇒ 同一请求在两端的结论无法对账、也无法证明
 * “未判定绝不默认允许”。本模块只定义**记录形状与归一判据**,不替换任何一端判据。
 *
 * 三条纪律:
 *  ① 封闭四态:allowed / denied / undetermined / unmanaged —— 后两态都不是允许;
 *  ② 无应答 / 未判定 / 畸形输入一律 undetermined,绝不映射成 allowed;
 *  ③ 决策记录只带诊断字段,不带命令正文、环境变量或凭据。
 */

export type UnifiedDecisionState = 'allowed' | 'denied' | 'undetermined' | 'unmanaged'

/** 决策来源,便于对账时区分是 CLI 闸门还是服务端托管求解 */
export type UnifiedDecisionSource = 'cli-danger-gate' | 'ai-service-managed-permissions'

/** 可复核的审批决策记录:同一请求在两端各产一条,形状一致 */
export interface UnifiedApprovalDecision {
  /** 请求标识(由调用方给定;两端对同一请求用同一 id 才能对账) */
  requestId: string
  source: UnifiedDecisionSource
  state: UnifiedDecisionState
  /** 机器可读原因码(如 no-prompt / unsatisfiable),不含用户数据 */
  reason: string
  /** 决策时刻 ISO 字符串;由调用方注入以便测试可确定 */
  decidedAt: string
}

const STATES: ReadonlySet<string> = new Set([
  'allowed',
  'denied',
  'undetermined',
  'unmanaged',
])

/** 归一判据:非封闭四态一律 undetermined,不冒充 allowed 也不冒充 denied。 */
export function normalizeDecisionState(raw: unknown): UnifiedDecisionState {
  return typeof raw === 'string' && STATES.has(raw) ? (raw as UnifiedDecisionState) : 'undetermined'
}

/** fail-closed 出口:只有显式 allowed 才放行。 */
export function isDecisionAllowing(decision: UnifiedApprovalDecision | null | undefined): boolean {
  return decision?.state === 'allowed'
}

/**
 * CLI danger-gate route 三态 → 统一四态。
 *
 * flag/approved 都是显式允许;denied 原样;其余(含 undefined/未知字符串)→ undetermined。
 * 注意 route 的 denied cause 不能在此升级为 allowed —— 本函数只看 route。
 */
export function fromDangerGateRoute(route: unknown): UnifiedDecisionState {
  if (route === 'flag' || route === 'approved') return 'allowed'
  if (route === 'denied') return 'denied'
  return 'undetermined'
}

/**
 * ai-service managed permissions 求解态 → 统一四态。
 *
 * solved ⇒ allowed;unsatisfiable ⇒ denied;unmanaged ⇒ unmanaged(调用方按“不介入”处理,
 * **不是**允许);undetermined 与未知值原样落 undetermined。
 */
export function fromManagedSolveState(state: unknown): UnifiedDecisionState {
  if (state === 'solved') return 'allowed'
  if (state === 'unsatisfiable') return 'denied'
  if (state === 'unmanaged') return 'unmanaged'
  return 'undetermined'
}

/**
 * 两端对账:不一致返回 false。undetermined/unmanaged 不视为可放行,也不参与“放宽”匹配
 * —— 只有双方都显式 allowed 才算一致放行。
 */
export function decisionsAgree(
  cli: UnifiedApprovalDecision | null | undefined,
  service: UnifiedApprovalDecision | null | undefined,
): boolean {
  if (!cli || !service) return false
  if (cli.requestId !== service.requestId) return false
  if (isDecisionAllowing(cli) !== isDecisionAllowing(service)) return false
  // 都非放行时,具体态可不同(CLI denied vs 服务端 unsatisfiable 都是拒绝),仍算一致
  return true
}
