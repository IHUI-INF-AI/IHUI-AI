// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被追溯追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * W4-14:ptc 执行器接缝的第一个真实实现。
 *
 * 它只把 `run_code` 这一个模型可见工具翻译成 PTC runtime 请求,不把 bindings
 * 伪装成“可直接调用的工具”。权限、hook、审计仍在外层 `executeToolCall` 单点;
 * binding 由调用方提供,调用方必须只注入只读/已授权的宿主函数。
 */

import type {
  PtcBindingNamespace,
  PtcJsonValue,
  PtcRuntime,
  PtcRunResult,
  PtcRunSpec,
} from '@ihui/ptc-runtime'

import type { ParsedToolCall, ToolContext, ToolResult } from './index.js'
import type { ToolExecutor } from './tool-executor.js'

export const PTC_RUN_CODE_TOOL_NAME = 'run_code'

/** 单程序绑定调用总数预算;不是并发上限。 */
export const PTC_DEFAULT_MAX_BINDING_CALLS = 1000
export const PTC_MAX_BINDING_CALLS = 10_000

/** 单程序同时在飞的绑定调用上限;排队而不是直接拒绝。 */
export const PTC_DEFAULT_MAX_CONCURRENT_BINDING_CALLS = 10
export const PTC_MAX_CONCURRENT_BINDING_CALLS = 64

/** 一个 agent 回合内所有 run_code 共享的绑定调用并发上限。 */
export const PTC_MAX_TURN_CONCURRENT_CALLS = 64

/** 每个 run_code 最多配置多少条命名空间/成员级配额;防止配置面无限膨胀。 */
export const PTC_MAX_BINDING_QUOTA_SCOPES = 64

/** 范围并发优先级上限;0 表示默认、不抢占,10 表示最高。 */
export const PTC_MAX_BINDING_SCOPE_PRIORITY = 10

/** 排队老化上限;0 关闭,10 表示低优先级最多可追平最高优先级。 */
export const PTC_MAX_BINDING_PRIORITY_AGING = 10

/** 范围并发权重上限;1 表示基准份额,10 表示同优先级下约 10 倍空槽份额。 */
export const PTC_MAX_BINDING_SCOPE_WEIGHT = 10

/** 命名空间/成员范围配额;调用总数与并发上限共用同一形状。 */
export interface PtcBindingScopeQuota {
  /** 绑定命名空间,例如 `tools`。 */
  namespace: string
  /** 可选成员名;省略表示整个命名空间聚合。 */
  member?: string
  /** 该范围在一次 run_code 内的上限。 */
  limit: number
}

export type PtcBindingCallQuota = PtcBindingScopeQuota

/** 范围并发配额;priority 只影响排队顺序,不抢占已在飞的调用。 */
export interface PtcBindingConcurrencyQuota extends PtcBindingScopeQuota {
  /** 0..10,缺省 0;数值越大越优先拿到空出的并发槽。 */
  priority?: number
  /** 1..10,缺省 1;同优先级下按权重分配空槽份额。 */
  weight?: number
}

/**
 * 一个 agent 回合内多个 run_code 共享的绑定调用预算。
 * `remaining` 由绑定调用同步扣减;`limit` 只读,便于消息里说明上限。
 */
export interface PtcTurnBudget {
  readonly limit: number
  remaining: number
}

/** 新建一份回合预算;非法值留给执行器在启动进程前归 invalid_arguments。 */
export function createPtcTurnBudget(limit: number): PtcTurnBudget {
  return { limit, remaining: limit }
}

/**
 * 一个 agent 回合内多个 run_code 共享的绑定调用并发闸。
 * 它只共享“同时在飞总数”,不共享命名空间/成员配额;scope 并发仍按单程序计算。
 * 传入 owner 时按 owner 当前在飞数做最小在飞优先调度,避免单个 run_code 长期占满空槽。
 */
export interface PtcTurnConcurrency {
  readonly limit: number
  /** acquire 成功返回幂等 release;signal 取消时拒绝排队中的 acquire。 */
  acquire(signal?: AbortSignal, owner?: string): Promise<() => void>
}

interface TurnConcurrencyWaiter {
  readonly resolve: (release: () => void) => void
  readonly reject: (error: Error) => void
  readonly signal?: AbortSignal
  readonly owner?: string
  readonly seq: number
  onAbort?: () => void
}

/** 新建一份回合并发闸;0/非法值由执行器在启动进程前拒绝,不在闸内静默修正。 */
export function createPtcTurnConcurrency(limit: number): PtcTurnConcurrency {
  let active = 0
  let nextSeq = 0
  const queue: TurnConcurrencyWaiter[] = []
  const activeByOwner = new Map<string, number>()

  const ownerActive = (owner?: string): number =>
    owner === undefined ? active : (activeByOwner.get(owner) ?? 0)

  const bumpOwner = (owner: string | undefined, delta: 1 | -1): void => {
    if (owner === undefined) return
    const next = (activeByOwner.get(owner) ?? 0) + delta
    if (next <= 0) activeByOwner.delete(owner)
    else activeByOwner.set(owner, next)
  }

  const detach = (waiter: TurnConcurrencyWaiter): void => {
    if (waiter.signal !== undefined && waiter.onAbort !== undefined) {
      waiter.signal.removeEventListener('abort', waiter.onAbort)
    }
  }

  const release = (owner?: string): void => {
    if (active <= 0) return
    active -= 1
    bumpOwner(owner, -1)
    drain()
  }

  const makeRelease = (owner?: string): (() => void) => {
    let released = false
    return () => {
      if (released) return
      released = true
      release(owner)
    }
  }

  const drain = (): void => {
    while (active < limit && queue.length > 0) {
      // 先清掉排队期间已 abort 的等待者,再在候选里选当前 owner 在飞最少的一个;
      // 同 owner 同分按 seq,保持 FIFO。
      let bestIndex = -1
      let bestScore = Number.POSITIVE_INFINITY
      let bestSeq = Number.POSITIVE_INFINITY
      for (let index = 0; index < queue.length; index += 1) {
        const waiter = queue[index]
        if (waiter === undefined) continue
        if (waiter.signal?.aborted === true) {
          queue.splice(index, 1)
          detach(waiter)
          waiter.reject(new Error('run_code 已终止,等待回合并发槽的绑定调用取消'))
          index -= 1
          continue
        }
        const score = ownerActive(waiter.owner)
        if (score < bestScore || (score === bestScore && waiter.seq < bestSeq)) {
          bestIndex = index
          bestScore = score
          bestSeq = waiter.seq
        }
      }
      if (bestIndex < 0) return
      const waiter = queue.splice(bestIndex, 1)[0]
      if (waiter === undefined) return
      detach(waiter)
      active += 1
      bumpOwner(waiter.owner, 1)
      waiter.resolve(makeRelease(waiter.owner))
    }
  }

  return {
    limit,
    acquire: (signal, owner) => {
      if (signal?.aborted === true) {
        return Promise.reject(new Error('run_code 已终止,绑定调用不再接受'))
      }
      if (active < limit) {
        active += 1
        bumpOwner(owner, 1)
        return Promise.resolve(makeRelease(owner))
      }
      return new Promise<() => void>((resolve, reject) => {
        const waiter: TurnConcurrencyWaiter = {
          resolve,
          reject,
          signal,
          owner,
          seq: nextSeq,
        }
        nextSeq += 1
        if (signal !== undefined) {
          const onAbort = (): void => {
            const index = queue.indexOf(waiter)
            if (index >= 0) queue.splice(index, 1)
            detach(waiter)
            reject(new Error('run_code 已终止,等待回合并发槽的绑定调用取消'))
          }
          waiter.onAbort = onAbort
          signal.addEventListener('abort', onAbort, { once: true })
        }
        queue.push(waiter)
      })
    },
  }
}

/** 每个 run_code 一个稳定的 owner 标识;仅用于回合闸的公平排队,不进入日志或模型面。 */
let nextTurnOwnerSeq = 0
function allocateTurnOwner(): string {
  nextTurnOwnerSeq += 1
  return `run-code-${nextTurnOwnerSeq}`
}

export interface PtcRunCodeArguments {
  code: string
  description: string
  timeoutMs?: number
}

export interface PtcBindingApprovalRequest {
  namespace: string
  memberName: string
  args: PtcJsonValue
  signal: AbortSignal
}

/**
 * 绑定调用前的审批钩子。返回 false/抛错都只拒绝这一次绑定,不 abort 整个程序;
 * 程序可以 catch 后换一条路径。审批等待受 worker 的逐绑定墙钟约束。
 */
export type PtcBindingApprover = (
  request: PtcBindingApprovalRequest,
) => boolean | Promise<boolean>

export interface PtcToolExecutorOptions {
  runtime: PtcRuntime
  /**
   * 本次调用可见的宿主命名空间。缺省为空(纯计算程序)。
   * 该回调抛出/返回非法命名空间时,结果归为 invalid_arguments,不启动执行。
   */
  resolveBindings?: (ctx: ToolContext) => PtcBindingNamespace[] | Promise<PtcBindingNamespace[]>
  /**
   * 单次 run_code 的绑定调用总预算。缺省 1000,上限 10000;超限会 abort 子进程,
   * 不让程序 catch 后继续无限循环。非法配置归 invalid_arguments,不启动执行。
   */
  maxBindingCalls?: number
  /**
   * 单次 run_code 同时在飞的绑定调用上限。缺省 10,上限 64;超出的调用排队,
   * 不直接拒绝。非法配置归 invalid_arguments,不启动执行。
   */
  maxConcurrentBindingCalls?: number
  /**
   * 命名空间/成员级调用配额。键不存在、重复、limit 非法都在启动进程前归
   * invalid_arguments;未配置的范围只受总预算约束。
   */
  maxBindingCallsByScope?: readonly PtcBindingCallQuota[]
  /**
   * 命名空间/成员级并发配额;与全局 maxConcurrentBindingCalls 叠加。
   * 未知范围、重复 scope、limit 非 1..64、priority 非 0..10 整数都在启动进程前归 invalid_arguments。
   */
  maxConcurrentCallsByScope?: readonly PtcBindingConcurrencyQuota[]
  /**
   * 排队老化上限;0 关闭,1..10 表示每个空槽分配轮给仍在排队的调用 +1 级
   * 有效优先级,最多加到该值。它只缓解持续高优先级导致的低优先级饥饿,
   * 不改变基础 priority,也不抢占在飞调用。
   */
  priorityAging?: number
  /**
   * 回合级共享并发闸;缺省 undefined 时只看单程序/范围并发。
   * 传入后每个绑定调用先占单程序槽,再占回合槽,两级都拿到才执行。
   */
  turnConcurrency?: PtcTurnConcurrency
  /**
   * 回合级共享预算;缺省 undefined 时只按单程序 maxBindingCalls 约束。
   * 传入后每次真实绑定调用都会同步扣减 remaining,多个 run_code 复用同一对象。
   */
  turnBudget?: PtcTurnBudget
  /**
   * 绑定调用前的审批等待。缺省 undefined = 全部放行(保持旧行为);配置后
   * 每个绑定在真正执行前 await 一次,返回 false 或抛错都只拒绝该次绑定。
   * 审批不消耗额外预算:拒绝发生在 reserveBindingCall 之前。
   */
  approveBinding?: PtcBindingApprover
  /**
   * 宿主侧 TypeScript 预检;缺省 true。它只检查程序自身可判定的类型错误,
   * 不改变 worker 的 strip-only 擦除,也不把 enum/namespace 编译成运行时代码。
   */
  typeCheck?: boolean
  /**
   * 保留式执行的 owner。缺省 undefined 保持一次性;传入同一个对象时,
   * NodeReplRuntime 会在多次 run_code 之间保留顶层变量。
   */
  stateOwner?: object
}

/**
 * PTC 执行器只接 `run_code`。在 PTC 模式下,模型不该直接调用其它工具;
 * 直接调用会被归为 unknown_tool,不会静默回退到 native。
 */
export function createPtcToolExecutor(options: PtcToolExecutorOptions): ToolExecutor {
  const resolveBindings = options.resolveBindings ?? (() => [])

  return {
    kind: 'ptc',
    async execute(call: ParsedToolCall, ctx: ToolContext): Promise<ToolResult> {
      if (call.name !== PTC_RUN_CODE_TOOL_NAME) {
        return failure(
          `ptc 模式只接受 ${PTC_RUN_CODE_TOOL_NAME},拒绝直接调用 ${call.name}`,
          'unknown_tool',
        )
      }

      const parsed = parseRunCodeArguments(call.arguments)
      if (!parsed.ok) return failure(parsed.message, 'invalid_arguments')

      const maxBindingCalls = options.maxBindingCalls ?? PTC_DEFAULT_MAX_BINDING_CALLS
      if (
        !Number.isInteger(maxBindingCalls) ||
        maxBindingCalls < 1 ||
        maxBindingCalls > PTC_MAX_BINDING_CALLS
      ) {
        return failure(
          `maxBindingCalls 必须是 1..${PTC_MAX_BINDING_CALLS} 的整数`,
          'invalid_arguments',
        )
      }

      const maxConcurrentBindingCalls =
        options.maxConcurrentBindingCalls ?? PTC_DEFAULT_MAX_CONCURRENT_BINDING_CALLS
      if (
        !Number.isInteger(maxConcurrentBindingCalls) ||
        maxConcurrentBindingCalls < 1 ||
        maxConcurrentBindingCalls > PTC_MAX_CONCURRENT_BINDING_CALLS
      ) {
        return failure(
          `maxConcurrentBindingCalls 必须是 1..${PTC_MAX_CONCURRENT_BINDING_CALLS} 的整数`,
          'invalid_arguments',
        )
      }

      const priorityAging = options.priorityAging ?? 0
      if (
        !Number.isInteger(priorityAging) ||
        priorityAging < 0 ||
        priorityAging > PTC_MAX_BINDING_PRIORITY_AGING
      ) {
        return failure(
          `priorityAging 必须是 0..${PTC_MAX_BINDING_PRIORITY_AGING} 的整数`,
          'invalid_arguments',
        )
      }

      const turnConcurrency = options.turnConcurrency
      if (turnConcurrency !== undefined) {
        if (
          !Number.isInteger(turnConcurrency.limit) ||
          turnConcurrency.limit < 1 ||
          turnConcurrency.limit > PTC_MAX_TURN_CONCURRENT_CALLS
        ) {
          return failure(
            `turnConcurrency.limit 必须是 1..${PTC_MAX_TURN_CONCURRENT_CALLS} 的整数`,
            'invalid_arguments',
          )
        }
      }

      const turnBudget = options.turnBudget
      if (turnBudget !== undefined) {
        if (
          !Number.isInteger(turnBudget.limit) ||
          turnBudget.limit < 1 ||
          turnBudget.limit > PTC_MAX_BINDING_CALLS ||
          !Number.isInteger(turnBudget.remaining) ||
          turnBudget.remaining < 0 ||
          turnBudget.remaining > turnBudget.limit
        ) {
          return failure(
            `turnBudget 必须是 limit 1..${PTC_MAX_BINDING_CALLS} 且 remaining 0..limit 的整数`,
            'invalid_arguments',
          )
        }
        if (turnBudget.remaining === 0) {
          return failure(
            `code_run_failed(tool-call-limit): 本回合绑定调用预算已用尽` +
              `(上限 ${turnBudget.limit});不要再发起新的 run_code。`,
            'code_run_failed',
          )
        }
      }

      let bindings: PtcBindingNamespace[]
      try {
        bindings = await resolveBindings(ctx)
      } catch (error) {
        return failure(
          `解析 ptc bindings 失败: ${errorMessage(error)}`,
          'invalid_arguments',
        )
      }

      const quotas = normalizeBindingQuotas(options.maxBindingCallsByScope, bindings)
      if (!quotas.ok) return failure(quotas.message, 'invalid_arguments')
      const concurrencyScopes = normalizeBindingConcurrencyQuotas(
        options.maxConcurrentCallsByScope,
        bindings,
      )
      if (!concurrencyScopes.ok) {
        return failure(concurrencyScopes.message, 'invalid_arguments')
      }

      const abort = linkAbortSignal(ctx.signal)
      const allowance = createAllowance(maxBindingCalls)
      const limiter = createScopedBindingLimiter(
        maxConcurrentBindingCalls,
        concurrencyScopes.scopes,
        abort.signal,
        priorityAging,
      )
      // 同一次 run_code 的绑定调用共用一个 owner;不同 run_code 的 owner 不同。
      // owner 只在回合闸内部做公平排队,不写进日志、错误消息或模型可见公告。
      const turnOwner =
        turnConcurrency === undefined ? undefined : allocateTurnOwner()
      const wrappedBindings = wrapBindings(
        bindings,
        allowance,
        quotas.quotas,
        limiter,
        (reason) => abort.abort(reason),
        turnBudget,
        turnConcurrency,
        abort.signal,
        turnOwner,
        options.approveBinding,
      )

      let spec: PtcRunSpec
      try {
        spec = options.runtime.resolve({
          program: parsed.value.code,
          bindings: wrappedBindings,
          cwd: ctx.workspacePath,
          signal: abort.signal,
          typeCheck: options.typeCheck !== false,
          ...(options.stateOwner === undefined ? {} : { stateOwner: options.stateOwner }),
          ...(parsed.value.timeoutMs === undefined
            ? {}
            : { timeoutMs: parsed.value.timeoutMs }),
        })
      } catch (error) {
        limiter.dispose()
        abort.dispose()
        return failure(errorMessage(error), 'invalid_arguments')
      }

      let result: PtcRunResult
      try {
        result = await options.runtime.run(spec)
      } catch (error) {
        return failure(`PTC runtime 调用失败: ${errorMessage(error)}`, 'code_run_failed')
      } finally {
        limiter.dispose()
        abort.dispose()
      }

      const logs = result.logs.join('\n')
      if (allowance.violation !== undefined) {
        return {
          success: false,
          output: logs,
          error:
            `code_run_failed(tool-call-limit): ${allowance.violation.message};` +
            `程序已终止。已有日志保留;不要 catch 后继续循环。`,
          errorType: 'code_run_failed',
        }
      }
      if (result.error) {
        return {
          success: false,
          output: logs,
          error: `code_run_failed(${result.error.kind}): ${result.error.message}`,
          errorType: 'code_run_failed',
        }
      }

      const valueText =
        result.value === undefined
          ? ''
          : typeof result.value === 'string'
            ? result.value
            : JSON.stringify(result.value)
      return {
        success: true,
        output: [logs, valueText].filter((part) => part.length > 0).join('\n'),
      }
    },
  }
}

type ParseResult =
  | { ok: true; value: PtcRunCodeArguments }
  | { ok: false; message: string }

export function parseRunCodeArguments(args: Record<string, unknown>): ParseResult {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, message: 'run_code 参数必须是对象' }
  }
  if (typeof args.code !== 'string' || args.code.trim() === '') {
    return { ok: false, message: 'run_code.code 必须是非空字符串' }
  }
  if (typeof args.description !== 'string' || args.description.trim() === '') {
    return { ok: false, message: 'run_code.description 必须是非空字符串' }
  }
  if (args.timeoutMs !== undefined) {
    if (
      typeof args.timeoutMs !== 'number' ||
      !Number.isFinite(args.timeoutMs) ||
      args.timeoutMs <= 0
    ) {
      return { ok: false, message: 'run_code.timeoutMs 必须是正数' }
    }
  }

  return {
    ok: true,
    value: {
      code: args.code,
      description: args.description,
      ...(args.timeoutMs === undefined ? {} : { timeoutMs: args.timeoutMs }),
    },
  }
}

function failure(message: string, errorType: string): ToolResult {
  return { success: false, output: '', error: message, errorType }
}

interface BindingLimitViolation {
  readonly message: string
}

interface BindingAllowance {
  readonly limit: number
  calls: number
  violation?: BindingLimitViolation
}

function createAllowance(limit: number): BindingAllowance {
  return { limit, calls: 0 }
}

interface BindingQuotaState {
  readonly key: string
  readonly limit: number
  calls: number
}

type BindingQuotaMap = Map<string, BindingQuotaState>
type NormalizeQuotasResult =
  | { ok: true; quotas: BindingQuotaMap }
  | { ok: false; message: string }

export interface NormalizedBindingScope {
  readonly key: string
  readonly limit: number
  readonly priority: number
  readonly weight?: number
}

type NormalizedScopeMap = Map<string, NormalizedBindingScope>
type NormalizeScopeResult =
  | { ok: true; scopes: NormalizedScopeMap }
  | { ok: false; message: string }

/**
 * 把外部范围配额钉到真实存在的 namespace/member 上。
 * 未知范围直接 fail-closed:拼错 `tools.read_fil` 不能静默变成“没有配额”。
 */
function normalizeBindingScopes(
  quotas: readonly PtcBindingScopeQuota[] | undefined,
  bindings: readonly PtcBindingNamespace[],
  optionName: string,
  maxLimit: number,
  allowPriority = false,
  allowWeight = false,
): NormalizeScopeResult {
  if (quotas === undefined) return { ok: true, scopes: new Map() }
  if (!Array.isArray(quotas)) {
    return { ok: false, message: `${optionName} 必须是数组` }
  }
  if (quotas.length > PTC_MAX_BINDING_QUOTA_SCOPES) {
    return {
      ok: false,
      message: `${optionName} 最多 ${PTC_MAX_BINDING_QUOTA_SCOPES} 条`,
    }
  }

  const namespaces = new Map<string, PtcBindingNamespace>()
  for (const namespace of bindings) namespaces.set(namespace.global, namespace)

  const result: NormalizedScopeMap = new Map()
  for (const [index, quota] of quotas.entries()) {
    if (quota === null || typeof quota !== 'object' || Array.isArray(quota)) {
      return { ok: false, message: `${optionName}[${index}] 必须是对象` }
    }
    const namespace = quota.namespace
    if (
      typeof namespace !== 'string' ||
      namespace.length === 0 ||
      namespace !== namespace.trim() ||
      namespace.includes('.')
    ) {
      return {
        ok: false,
        message: `${optionName}[${index}].namespace 必须是不含点的非空字符串`,
      }
    }
    const member = quota.member
    if (
      member !== undefined &&
      (typeof member !== 'string' ||
        member.length === 0 ||
        member !== member.trim() ||
        member.includes('.'))
    ) {
      return {
        ok: false,
        message: `${optionName}[${index}].member 必须是不含点的非空字符串`,
      }
    }
    if (
      !Number.isInteger(quota.limit) ||
      quota.limit < 1 ||
      quota.limit > maxLimit
    ) {
      return {
        ok: false,
        message:
          `${optionName}[${index}].limit 必须是 ` +
          `1..${maxLimit} 的整数`,
      }
    }
    const rawPriority = (quota as PtcBindingConcurrencyQuota).priority
    if (!allowPriority && rawPriority !== undefined) {
      return {
        ok: false,
        message: `${optionName}[${index}].priority 只用于并发配额`,
      }
    }
    const rawWeight = (quota as PtcBindingConcurrencyQuota).weight
    if (!allowWeight && rawWeight !== undefined) {
      return {
        ok: false,
        message: `${optionName}[${index}].weight 只用于并发配额`,
      }
    }
    let priority = 0
    if (allowPriority && rawPriority !== undefined) {
      if (
        !Number.isInteger(rawPriority) ||
        rawPriority < 0 ||
        rawPriority > PTC_MAX_BINDING_SCOPE_PRIORITY
      ) {
        return {
          ok: false,
          message:
            `${optionName}[${index}].priority 必须是 ` +
            `0..${PTC_MAX_BINDING_SCOPE_PRIORITY} 的整数`,
        }
      }
      priority = rawPriority
    }
    let weight = 1
    if (allowWeight && rawWeight !== undefined) {
      if (
        !Number.isInteger(rawWeight) ||
        rawWeight < 1 ||
        rawWeight > PTC_MAX_BINDING_SCOPE_WEIGHT
      ) {
        return {
          ok: false,
          message:
            `${optionName}[${index}].weight 必须是 ` +
            `1..${PTC_MAX_BINDING_SCOPE_WEIGHT} 的整数`,
        }
      }
      weight = rawWeight
    }

    const key = member === undefined ? namespace : `${namespace}.${member}`
    if (result.has(key)) {
      return { ok: false, message: `绑定配额范围重复: ${key}` }
    }
    const targetNamespace = namespaces.get(namespace)
    if (targetNamespace === undefined) {
      return {
        ok: false,
        message: `未知的绑定配额命名空间: ${namespace}`,
      }
    }
    if (
      member !== undefined &&
      !Object.prototype.hasOwnProperty.call(targetNamespace.functions, member)
    ) {
      return {
        ok: false,
        message: `未知的绑定配额成员: ${key}`,
      }
    }
    result.set(key, { key, limit: quota.limit, priority, weight })
  }
  return { ok: true, scopes: result }
}

function normalizeBindingQuotas(
  quotas: readonly PtcBindingCallQuota[] | undefined,
  bindings: readonly PtcBindingNamespace[],
): NormalizeQuotasResult {
  const normalized = normalizeBindingScopes(
    quotas,
    bindings,
    'maxBindingCallsByScope',
    PTC_MAX_BINDING_CALLS,
  )
  if (!normalized.ok) return normalized
  const result: BindingQuotaMap = new Map()
  for (const [key, scope] of normalized.scopes) {
    result.set(key, { key, limit: scope.limit, calls: 0 })
  }
  return { ok: true, quotas: result }
}

function normalizeBindingConcurrencyQuotas(
  quotas: readonly PtcBindingConcurrencyQuota[] | undefined,
  bindings: readonly PtcBindingNamespace[],
): NormalizeScopeResult {
  return normalizeBindingScopes(
    quotas,
    bindings,
    'maxConcurrentCallsByScope',
    PTC_MAX_CONCURRENT_BINDING_CALLS,
    true,
    true,
  )
}

function reserveBindingCall(
  allowance: BindingAllowance,
  quotas: BindingQuotaMap,
  namespaceName: string,
  memberName: string,
  turnBudget?: PtcTurnBudget,
): BindingLimitViolation | undefined {
  if (allowance.calls >= allowance.limit) {
    return {
      message:
        `工具调用额度已用尽(上限 ${allowance.limit},` +
        `第 ${allowance.calls + 1} 次被拒)`,
    }
  }

  const memberQuota = quotas.get(`${namespaceName}.${memberName}`)
  if (memberQuota !== undefined && memberQuota.calls >= memberQuota.limit) {
    return {
      message:
        `工具调用额度已用尽(${memberQuota.key} 上限 ${memberQuota.limit},` +
        `第 ${memberQuota.calls + 1} 次被拒)`,
    }
  }
  const namespaceQuota = quotas.get(namespaceName)
  if (
    namespaceQuota !== undefined &&
    namespaceQuota.calls >= namespaceQuota.limit
  ) {
    return {
      message:
        `工具调用额度已用尽(${namespaceQuota.key} 上限 ${namespaceQuota.limit},` +
        `第 ${namespaceQuota.calls + 1} 次被拒)`,
    }
  }
  if (turnBudget !== undefined && turnBudget.remaining <= 0) {
    return {
      message:
        `本回合工具调用额度已用尽(上限 ${turnBudget.limit},剩余 0)`,
    }
  }

  allowance.calls += 1
  if (namespaceQuota !== undefined) namespaceQuota.calls += 1
  if (memberQuota !== undefined) memberQuota.calls += 1
  if (turnBudget !== undefined) turnBudget.remaining -= 1
  return undefined
}

/**
 * 包装所有命名空间的成员:只计“真正发起的绑定调用”,不把 SDK/签名计入。
 * 先过并发闸,再检查总预算与 namespace/member 配额;超限先 abort 子进程,
 * 再抛错,即使程序 catch 了,下一次调用也只会看到已用尽。
 */
function wrapBindings(
  bindings: readonly PtcBindingNamespace[],
  allowance: BindingAllowance,
  quotas: BindingQuotaMap,
  limiter: BindingConcurrencyLimiter,
  abort: (reason?: unknown) => void,
  turnBudget?: PtcTurnBudget,
  turnConcurrency?: PtcTurnConcurrency,
  turnSignal?: AbortSignal,
  turnOwner?: string,
  approveBinding?: PtcBindingApprover,
): PtcBindingNamespace[] {
  return bindings.map((namespace) => {
    const functions: PtcBindingNamespace['functions'] = {}
    for (const [name, fn] of Object.entries(namespace.functions)) {
      functions[name] = async (args) => {
        // 成员、命名空间、全局三类槽在同一次 acquire 里原子占用,
        // 不存在“先持一类再等另一类”的分段持锁,因此不会出现交叉死锁。
        const release = await limiter.acquire([
          `${namespace.global}.${name}`,
          namespace.global,
        ])
        let releaseTurn: (() => void) | undefined
        try {
          // 单程序槽先拿到,再排队回合级槽;避免持有回合槽等本程序成员槽,
          // 那样会把回合槽浪费在一个尚未真正可执行的调用上。
          if (turnConcurrency !== undefined) {
            releaseTurn = await turnConcurrency.acquire(turnSignal, turnOwner)
          }
          const afterWaitViolation = allowance.violation
          if (afterWaitViolation !== undefined) {
            throw new Error(afterWaitViolation.message)
          }
          if (approveBinding !== undefined) {
            // 审批只看已解析的 namespace/member 与 JSON 参数;返回 false 或抛错
            // 都只拒绝这次绑定,不 abort 整个 run_code,也不消耗预算。
            let approved = false
            try {
              approved = await approveBinding({
                namespace: namespace.global,
                memberName: name,
                args: args as PtcJsonValue,
                signal: turnSignal ?? new AbortController().signal,
              })
            } catch (error) {
              throw new Error(
                `${namespace.global}.${name}: 审批失败: ${errorMessage(error)}`,
              )
            }
            if (!approved) {
              throw new Error(`${namespace.global}.${name}: 审批未通过`)
            }
          }
          const violation = reserveBindingCall(
            allowance,
            quotas,
            namespace.global,
            name,
            turnBudget,
          )
          if (violation !== undefined) {
            allowance.violation = violation
            abort(new Error(violation.message))
            throw new Error(violation.message)
          }
          return await fn(args)
        } finally {
          releaseTurn?.()
          release()
        }
      }
    }
    return { ...namespace, functions }
  })
}

export interface BindingConcurrencyLimiter {
  acquire(scopeKeys: readonly string[]): Promise<() => void>
  dispose(): void
}

interface ScopedWaiter {
  readonly keys: readonly string[]
  readonly priority: number
  readonly weight: number
  /** 已累积的排队老化级数;只在 priorityAging > 0 时增长。 */
  aging: number
  /** 加权公平的虚拟完成时间;同优先级下越小越先拿空槽。 */
  readonly finish: number
  /** 同优先级同权重按入队顺序 FIFO;跨优先级严格高优先级先拿空槽。 */
  readonly seq: number
  readonly resolve: (release: () => void) => void
  readonly reject: (error: Error) => void
}

/**
 * 多层并发闸:全局槽 + 每个已配置 scope 的槽。
 * 队列按可用槽扫描而不是死等队首，避免一个卡住的成员把整个命名空间队首堵死。
 * 已配置 priority 的排队者按高优先级先拿空槽;这只是排队顺序，不抢占在飞调用，
 * 高优先级 scope 自己被自己的配额卡住时，低优先级仍可继续。
 * priorityAging > 0 时，每个空槽分配轮给仍在排队的调用 +1 级有效优先级（封顶 10），
 * 防止持续高优先级把低优先级长期饿死；0 保留严格优先级。
 * run_code 被 abort/结束时只保留一个信号监听器，排队者统一拒绝。
 *
 * 导出给确定性 limiter 单测使用;不作为稳定公共 API。
 */
export function createScopedBindingLimiter(
  globalLimit: number,
  scopes: ReadonlyMap<string, NormalizedBindingScope>,
  signal: AbortSignal,
  priorityAging = 0,
): BindingConcurrencyLimiter {
  let globalActive = 0
  const scopeActive = new Map<string, number>()
  let stopped = false
  let nextQueueSeq = 0
  let virtualTime = 0
  const queue: ScopedWaiter[] = []

  const configuredKeys = (scopeKeys: readonly string[]): string[] => {
    return [...new Set(scopeKeys)].filter((key) => scopes.has(key))
  }

  const effectivePriority = (keys: readonly string[]): number => {
    let priority = 0
    for (const key of keys) {
      const scope = scopes.get(key)
      if (scope !== undefined && scope.priority > priority) {
        priority = scope.priority
      }
    }
    return priority
  }

  /** 排队排序键:基础优先级 + 老化级数,封顶在最高优先级;老化不改变基础值。 */
  const effectiveRank = (waiter: ScopedWaiter): number =>
    Math.min(waiter.priority + waiter.aging, PTC_MAX_BINDING_SCOPE_PRIORITY)

  /** 同优先级下按权重分份额;一个调用命中多个范围时取最大权重。 */
  const effectiveWeight = (keys: readonly string[]): number => {
    let weight = 1
    for (const key of keys) {
      const scope = scopes.get(key)
      if (scope !== undefined && (scope.weight ?? 1) > weight) {
        weight = scope.weight ?? 1
      }
    }
    return weight
  }

  const compareQueue = (a: ScopedWaiter, b: ScopedWaiter): number =>
    effectiveRank(b) - effectiveRank(a) ||
    a.finish - b.finish ||
    a.seq - b.seq

  const canStart = (keys: readonly string[]): boolean => {
    if (globalActive >= globalLimit) return false
    for (const key of keys) {
      const scope = scopes.get(key)
      if (scope === undefined) continue
      if ((scopeActive.get(key) ?? 0) >= scope.limit) return false
    }
    return true
  }

  const take = (waiter: Pick<ScopedWaiter, 'keys' | 'finish'>): (() => void) => {
    virtualTime = Math.max(virtualTime, waiter.finish)
    globalActive += 1
    for (const key of waiter.keys) {
      scopeActive.set(key, (scopeActive.get(key) ?? 0) + 1)
    }
    let released = false
    return () => {
      if (released) return
      released = true
      globalActive -= 1
      for (const key of waiter.keys) {
        const next = (scopeActive.get(key) ?? 1) - 1
        if (next <= 0) scopeActive.delete(key)
        else scopeActive.set(key, next)
      }
      drain()
    }
  }

  const drain = (): void => {
    if (stopped) return
    if (priorityAging > 0 && queue.length > 0) {
      for (const waiter of queue) {
        waiter.aging = Math.min(priorityAging, waiter.aging + 1)
      }
      queue.sort(compareQueue)
    }
    for (let index = 0; index < queue.length;) {
      const waiter = queue[index]
      if (waiter !== undefined && canStart(waiter.keys)) {
        queue.splice(index, 1)
        waiter.resolve(take(waiter))
      } else {
        index += 1
      }
    }
  }

  const enqueue = (
    keys: readonly string[],
    resolve: (release: () => void) => void,
    reject: (error: Error) => void,
  ): void => {
    const weight = effectiveWeight(keys)
    queue.push({
      keys,
      priority: effectivePriority(keys),
      weight,
      aging: 0,
      finish: virtualTime + 1 / weight,
      seq: nextQueueSeq++,
      resolve,
      reject,
    })
    queue.sort(compareQueue)
  }

  const stop = (reason: string): void => {
    if (stopped) return
    stopped = true
    const pending = queue.splice(0)
    for (const waiter of pending) {
      waiter.reject(new Error(reason))
    }
  }

  const onAbort = (): void => stop('run_code 已终止,排队中的绑定调用取消')
  if (signal.aborted) {
    stop('run_code 已终止,排队中的绑定调用取消')
  } else {
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return {
    acquire: (scopeKeys) => {
      if (stopped) {
        return Promise.reject(new Error('run_code 已终止,绑定调用不再接受'))
      }
      const keys = configuredKeys(scopeKeys)
      if (canStart(keys)) {
        return Promise.resolve(take({ keys, finish: virtualTime + 1 / effectiveWeight(keys) }))
      }
      return new Promise<() => void>((resolve, reject) => {
        enqueue(keys, resolve, reject)
      })
    },
    dispose: () => {
      signal.removeEventListener('abort', onAbort)
      stop('run_code 已结束,排队中的绑定调用取消')
    },
  }
}

interface LinkedAbort {
  readonly signal: AbortSignal
  abort(reason?: unknown): void
  dispose(): void
}

function linkAbortSignal(external?: AbortSignal): LinkedAbort {
  const controller = new AbortController()
  const onAbort = (): void => controller.abort(external?.reason)
  if (external?.aborted === true) {
    controller.abort(external.reason)
  } else {
    external?.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    abort: (reason?: unknown) => controller.abort(reason),
    dispose: () => external?.removeEventListener('abort', onAbort),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
