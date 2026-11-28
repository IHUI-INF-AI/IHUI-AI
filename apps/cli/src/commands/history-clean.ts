/**
 * B4-12 会话历史清理按路由意图(2026-11-28 立)。
 *
 * ## 立因
 *
 * 「清理历史」是一个**不可逆**动作,但用户说的"清一下"在四种意图下指向四种完全不同的范围:
 * 清一条会话、清一个分支的全部会话、清一段检查点、或者全清。此前的实现只有
 * `deleteSession(id)`,意图一律当成"清会话",于是:
 *
 *   - 用户想"清掉这个分支的" ⇒ 只清了一条,剩下的还在;
 *   - 用户想"清掉刚才那几步" ⇒ 整条会话没了。
 *
 * 故本模块把「意图」变成第一类输入:先分类,再据意图**校验必需的 scope**,
 * 最后产出删除计划。判据的核心是 **scope 必须与意图匹配** —— 缺参数是 `scope_missing`,
 * 给错参数是 `scope_mismatch`,而不是"猜一个合理默认"。
 *
 * ## 判据
 *
 * 1. 意图不认识 ⇒ `unknown_intent`,**不落默认全清**;
 * 2. `session` 必须给 `sessionId`,`branch` 必须给 `branchId`,`checkpoint` 必须给 `checkpointId`;
 * 3. `all` **不要求 scope**,但**必须显式** `confirmAll: true` —— 不可逆全清不能凭一个默认值;
 * 4. scope 里带了与意图不匹配的字段 ⇒ `scope_mismatch`(防止"我以为是清分支其实是全清");
 * 5. 计划产出 `targets` 与 `keep`,**keep 必须非空** —— 全清也要留一条恢复锚点。
 *
 * 刻意不做:不 fs.rm / 不调 db / 不读磁盘 —— 本模块只回答"该删什么、该留什么",
 * 真正的删除由调用方按 plan 执行,且必须先把 plan 交给用户确认。
 */

export const ROUTE_INTENTS = ['session', 'branch', 'checkpoint', 'all'] as const

export type RouteIntent = (typeof ROUTE_INTENTS)[number]

export type CleanReason =
  | 'ok'
  | 'unknown_intent'
  | 'scope_missing'
  | 'scope_mismatch'
  | 'confirm_required'

export interface CleanScope {
  readonly sessionId?: unknown
  readonly branchId?: unknown
  readonly checkpointId?: unknown
  readonly confirmAll?: unknown
}

export interface CleanPlan {
  readonly intent: RouteIntent
  readonly targets: readonly string[]
  readonly keep: readonly string[]
}

export interface CleanDecision {
  readonly allowed: boolean
  readonly intent: RouteIntent | null
  readonly reason: CleanReason
  readonly plan: CleanPlan | null
  readonly detail: string
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * 把路由意图分类。认不出返回 null —— **不返回 'all'**,那是把"不认识"当成"全清"。
 */
export function classifyRouteIntent(route: unknown): RouteIntent | null {
  if (typeof route !== 'string') return null
  const normalized = route.trim().toLowerCase()
  const direct = ROUTE_INTENTS.find((intent) => intent === normalized)
  if (direct) return direct
  // 别名:只是输入习惯,不是语义扩展,映射必须是一对一。
  if (normalized === 'chat' || normalized === 'conversation') return 'session'
  if (normalized === 'flow' || normalized === 'fork') return 'branch'
  if (normalized === 'step' || normalized === 'rewind') return 'checkpoint'
  if (normalized === 'everything' || normalized === 'wipe') return 'all'
  return null
}

/** 每个意图要求哪个 scope 字段,以及哪些字段是"不该出现"的。 */
const REQUIRED_FIELD: Record<Exclude<RouteIntent, 'all'>, keyof CleanScope> = {
  session: 'sessionId',
  branch: 'branchId',
  checkpoint: 'checkpointId',
}

function emit(
  allowed: boolean,
  intent: RouteIntent | null,
  reason: CleanReason,
  detail: string,
  plan: CleanPlan | null = null,
): CleanDecision {
  return { allowed, intent, reason, plan, detail }
}

/**
 * 按意图产出清理计划(纯判据,不执行删除)。
 *
 * 判序见文件头注释的 1-5。
 */
export function planHistoryClean(route: unknown, scope: unknown): CleanDecision {
  const intent = classifyRouteIntent(route)
  if (intent === null) {
    return emit(false, null, 'unknown_intent',
      '意图不认(取不到),点名:session/branch/checkpoint/all —— 绝不落默认全清')
  }

  const scopeObj: CleanScope | null =
    scope !== null && typeof scope === 'object' && !Array.isArray(scope)
      ? (scope as CleanScope)
      : null

  if (intent === 'all') {
    const confirmed = scopeObj?.confirmAll === true
    if (!confirmed) {
      return emit(false, intent, 'confirm_required',
        'all 是不可逆全清,必须显式 confirmAll: true —— 不凭默认值清库')
    }
    return emit(true, intent, 'ok',
      '全清已显式确认:保留最近一条会话作为恢复锚点',
      { intent, targets: ['*'], keep: ['latest-session-anchor'] })
  }

  const required = REQUIRED_FIELD[intent]
  if (scopeObj === null) {
    return emit(false, intent, 'scope_missing',
      `意图 ${intent} 需要 ${String(required)},但 scope 取不到`)
  }

  const value = scopeObj[required]
  if (!nonEmptyString(value)) {
    return emit(false, intent, 'scope_missing',
      `意图 ${intent} 需要非空的 ${String(required)}`)
  }

  // 给错 scope:与其"忽略多余字段",不如显式拒绝 —— 多余字段通常意味着调用方搞错了意图。
  const strays: string[] = []
  if (scopeObj.confirmAll !== undefined && scopeObj.confirmAll !== null) strays.push('confirmAll')
  for (const key of ['sessionId', 'branchId', 'checkpointId'] as const) {
    if (key === required) continue
    if (scopeObj[key] !== undefined && scopeObj[key] !== null) strays.push(key)
  }
  if (strays.length > 0) {
    return emit(false, intent, 'scope_mismatch',
      `意图 ${intent} 只认 ${String(required)},但还给了 ${strays.join('/')} —— 意图与范围不一致`)
  }

  const target = `${intent}:${value.trim()}`
  return emit(true, intent, 'ok',
    `按 ${intent} 意图清理 ${target}`,
    { intent, targets: [target], keep: ['latest-session-anchor'] })
}

/**
 * 判据层别名:调用方普遍以"清理历史"这个动作为入口,
 * 保留一entrypoint 以免每个 caller 自己写一遍 `planHistoryClean(...).allowed` 的判断。
 * 返回 null 表示"已允许且给了 plan",否则返回拒绝原因(便于日志直接打出来)。
 */
export function cleanHistory(route: unknown, scope: unknown): { plan: CleanPlan } | { refusal: string } {
  const decision = planHistoryClean(route, scope)
  if (!decision.allowed || decision.plan === null) {
    return { refusal: `${decision.reason}: ${decision.detail}` }
  }
  return { plan: decision.plan }
}
