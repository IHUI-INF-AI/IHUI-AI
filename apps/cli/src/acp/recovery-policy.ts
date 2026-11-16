// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 方法恢复策略 —— 「崩溃之后这个方法能不能重试」。
 *
 * ## 为什么需要这一层
 *
 * 进程崩溃/连接断开后,调用方手里有一堆"发出了但没收到回执"的请求。
 * 它必须逐个决定:**重试、还是标记结果未知?**
 *
 * 猜错的代价是不对称的:
 *   · 把 `mutation`(非幂等写)当 `read` 重试 ⇒ **重复扣款/重复创建**;
 *   · 把 `read` 当 `mutation` 放弃 ⇒ 只是多做一次人工确认,代价小得多。
 *
 * 所以这件事不能"看着像只读就重试",必须有**显式声明**。
 *
 * ## 对齐依据
 *
 * WorkBuddy 的 `通用子智能体日志规范` 用 `CODEBUDDY_HOST_METHOD_RECOVERY_POLICIES`
 * 给每个 host 方法标了四档(`lib/runtime/codebuddy-resource-recovery.js`):
 *
 *   read                 → retry_after_recovery   只读,崩了照重试
 *   idempotent_mutation  → retry_after_recovery   幂等写,重试结果一样
 *   mutation             → outcome_unknown        非幂等写,**结果未知**
 *   control              → not_applicable         控制类,不适用
 *
 * 四档里最关键的是 `mutation → outcome_unknown`:它明确表示"**别假装知道**"。
 * 本仓此前没有这个概念 —— 崩溃后只能靠人回忆"刚才那个操作到底成没成"。
 *
 * ## 一条纪律
 *
 * **未声明的方法一律按 `mutation`(结果未知)处理**,不按 `read`。
 * 失效方向恒为"多要一次确认",绝不是"多扣一次款"。
 */

/** 恢复语义四档。 */
export type RecoveryKind =
  /** 只读:崩溃后可无条件重试。 */
  | 'read'
  /** 幂等写:重试与首次执行结果相同,可重试。 */
  | 'idempotent_mutation'
  /** 非幂等写:崩溃后**结果未知**,重试可能造成重复副作用。 */
  | 'mutation'
  /** 控制类(关闭/取消等):不适用重试语义。 */
  | 'control'

/** 崩溃后的处置建议。 */
export type CrashDisposition =
  /** 可重试。 */
  | 'retry_after_recovery'
  /** 结果未知 —— 必须由人/上层核实后再决定。 */
  | 'outcome_unknown'
  /** 不适用。 */
  | 'not_applicable'

export interface RecoveryPolicy {
  readonly kind: RecoveryKind
  readonly crashDisposition: CrashDisposition
}

/** kind → disposition 的唯一映射(与对齐实现逐字同义)。 */
const DISPOSITION_OF: Readonly<Record<RecoveryKind, CrashDisposition>> = {
  read: 'retry_after_recovery',
  idempotent_mutation: 'retry_after_recovery',
  mutation: 'outcome_unknown',
  control: 'not_applicable',
}

const POLICY_CACHE = new Map<RecoveryKind, RecoveryPolicy>()

/** 由 kind 构造策略(同一 kind 返回同一冻结对象,便于 === 比较)。 */
export function policyOf(kind: RecoveryKind): RecoveryPolicy {
  const cached = POLICY_CACHE.get(kind)
  if (cached) return cached
  const p = Object.freeze({ kind, crashDisposition: DISPOSITION_OF[kind] })
  POLICY_CACHE.set(kind, p)
  return p
}

/**
 * 方法名 → 恢复策略的登记表。
 *
 * 只登记**我方真实存在**的方法(ACP 与 x.ai/* 扩展),不抄对方的方法名 ——
 * 对方的方法名在我们这里没有对应实现,登记了就是"申报了不存在的能力"。
 *
 * 判据解释:
 *   · `session/list` / `x.ai/turn/state` / `x.ai/turn/chronicle` 等纯读 ⇒ read;
 *   · `session/set_mode` / `set_config_option` 写同一字段,重复执行结果相同 ⇒ idempotent_mutation;
 *   · `session/fork` / `goal/create` / `turn/create` 每次调用产生**新实体** ⇒ mutation;
 *   · `session/close` / `session/cancel` 关闭类,重试无意义 ⇒ control。
 */
const REGISTRY: Readonly<Record<string, RecoveryKind>> = Object.freeze({
  // ── 纯读 ──────────────────────────────────────────────────────────────
  'session/list': 'read',
  'x.ai/turn/state': 'read',
  'x.ai/turn/chronicle': 'read',
  'x.ai/turn/parked': 'read',
  'x.ai/checkpoint/list': 'read',
  'x.ai/checkpoint/read': 'read',
  'x.ai/goal/list': 'read',
  'x.ai/workflow/plan': 'read',
  'x.ai/rewind/points': 'read',
  'x.ai/mcp/listServers': 'read',
  'x.ai/mcp/serverStatus': 'read',

  // ── 幂等写(重复执行结果相同)───────────────────────────────────────
  'session/set_mode': 'idempotent_mutation',
  'session/set_config_option': 'idempotent_mutation',
  'x.ai/session/repair': 'idempotent_mutation',
  'x.ai/goal/update': 'idempotent_mutation',
  'x.ai/checkpoint/restore': 'idempotent_mutation',

  // ── 非幂等写(每次调用产生新实体,崩溃后结果未知)─────────────────
  'session/fork': 'mutation',
  'session/delete': 'mutation',
  'x.ai/turn/create': 'mutation',
  'x.ai/turn/transition': 'mutation',
  'x.ai/turn/synthetic-finish': 'mutation',
  'x.ai/goal/create': 'mutation',
  'x.ai/goal/iterate': 'mutation',
  'x.ai/rewind/execute': 'mutation',
  'x.ai/mcp/callTool': 'mutation',

  // ── 控制类 ────────────────────────────────────────────────────────────
  'session/close': 'control',
  'session/cancel': 'control',
  'x.ai/mcp/reconnect': 'control',
})

/**
 * 查一个方法的恢复策略。
 *
 * **未登记的方法按 `mutation`(结果未知)返回** —— 这是本模块最重要的一个决定。
 * 默认成 `read` 会让"新加了一个写方法但忘了登记"变成"崩溃后自动重试 ⇒ 重复副作用";
 * 默认成 `mutation` 只会让调用方多问一次。
 */
export function recoveryPolicyOf(method: string): RecoveryPolicy {
  const kind = REGISTRY[method]
  if (kind) return policyOf(kind)
  return policyOf('mutation')
}

/** 该方法崩溃后是否可安全重试。 */
export function canRetryAfterCrash(method: string): boolean {
  return recoveryPolicyOf(method).crashDisposition === 'retry_after_recovery'
}

/** 已登记的方法清单(供审计/看板;不含未登记的兜底项)。 */
export function registeredMethods(): readonly string[] {
  return Object.keys(REGISTRY).sort()
}

/** 按策略分组的统计(便于一眼看出"有多少方法崩了不敢重试")。 */
export function summarizeByKind(): Record<RecoveryKind, number> {
  const out: Record<RecoveryKind, number> = {
    read: 0,
    idempotent_mutation: 0,
    mutation: 0,
    control: 0,
  }
  for (const kind of Object.values(REGISTRY)) out[kind] += 1
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
