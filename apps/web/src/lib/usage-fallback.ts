// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * usage_update used=0 瞬时假值守卫 + task_complete 弱 fallback
 * (机制吸收 G-977988;上游出处 zcode packages/ui/src/lib/zcodeTaskUsageFallback.ts:1-103)。
 * 纯函数组:per 任务键的"收到过正数 usage_update"登记由调用方持有(Set),
 * 本文件只提供键构造与登记函数,不在模块级藏状态(上游是模块级 Set,这里改为显式传入)。
 *
 * 核心规则:
 *  1. Agent 在普通工具调用期间会短暂发出 used=0 的 usage_update —— 不是 context
 *     真被清空,而是上游 replay/子调用 usage 缺失造成的瞬时假值。非压缩轮次保留
 *     上一个正数,防输入栏的上下文占用闪一下后消失;
 *  2. 压缩轮(/compact、/compress 前缀识别)接受 0:压缩后 used 真的会归零重算;
 *  3. breakdown 在 used/size 全等时保留旧值(用量没变,分类明细不许被上游丢字段冲掉);
 *  4. task_complete.usage 是本轮 prompt 的 token 统计,不是上下文窗口快照 —— 只有
 *     从未收到过正数 usage_update 的任务键才当弱 fallback,否则会覆盖真实 context used;
 *  5. contextWindow 缺席时用 currentUsage.size 兜底。
 */

export interface ContextUsageSnapshot {
  used: number
  size: number
  breakdown?: Record<string, number> | null
}

export interface UsageKeyParams {
  workspacePath: string
  workspaceIdentity?: string | null
  taskId: string
}

export interface BuildUsageFromUpdateParams {
  currentUsage: ContextUsageSnapshot | null | undefined
  incomingUsage: ContextUsageSnapshot
  /** 最近一条用户输入,用于识别压缩轮 */
  latestUserPrompt?: string | null
}

/** 任务键:workspacePath::identity(缺席回退 path)::taskId,供调用方一次性登记 */
export function buildUsageKey(params: UsageKeyParams): string {
  const identity = params.workspaceIdentity?.trim() || params.workspacePath
  return `${params.workspacePath}::${identity}::${params.taskId}`
}

/** 只登记"正数"的 usage_update;used/size 任一非正数(瞬时假值/缺字段)不登记 */
export function recordPositiveUsageUpdate(
  keys: Set<string>,
  params: UsageKeyParams & { used: number; size: number },
): void {
  if (!Number.isFinite(params.used) || params.used <= 0) return
  if (!Number.isFinite(params.size) || params.size <= 0) return
  keys.add(buildUsageKey(params))
}

/** 压缩轮识别:精确命令或带参前缀(/compact、/compress) */
export function isContextCompressionPrompt(prompt: string | null | undefined): boolean {
  const normalized = prompt?.trim() ?? ''
  return (
    normalized === '/compact' ||
    normalized.startsWith('/compact ') ||
    normalized === '/compress' ||
    normalized.startsWith('/compress ')
  )
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/** usage_update → 展示用量:瞬时 0 假值守卫 + breakdown 保留 */
export function buildUsageFromUpdate(params: BuildUsageFromUpdateParams): ContextUsageSnapshot {
  const { currentUsage, incomingUsage, latestUserPrompt } = params
  // used/size 全等且新包丢了 breakdown:保留旧分类明细(用量没变,明细不该消失)
  const usageWithRetainedBreakdown =
    !incomingUsage.breakdown &&
    currentUsage?.breakdown &&
    currentUsage.used === incomingUsage.used &&
    currentUsage.size === incomingUsage.size
      ? { ...incomingUsage, breakdown: currentUsage.breakdown }
      : incomingUsage
  if (
    currentUsage &&
    isPositiveFinite(currentUsage.used) &&
    isPositiveFinite(currentUsage.size) &&
    !isPositiveFinite(incomingUsage.used) &&
    !isContextCompressionPrompt(latestUserPrompt)
  ) {
    // 瞬时 used=0 假值:非压缩轮保留上一个正数,防上下文占用闪断
    return currentUsage
  }
  return usageWithRetainedBreakdown
}

/**
 * 真实上下文分母的模型来源(G-1101879):优先取**用量帧回带的 model** ——
 * 后端 `model=='auto'` 会按可用性自动路由到别的厂商,会话当前选中模型与实际运行的
 * 窗口不一致(选 auto/32K 却路由到 200K 时占用率整体偏小),拿会话模型当分母会算偏;
 * 用量帧缺席(或空串)时回落会话当前模型。容量出口 `getModelContextCapacity` 由调用方
 * 按返回的 id 另取 —— 本函数只决定"用哪个模型 id 算分母"。
 */
export function resolveContextDenominatorModel(params: {
  /** 用量帧回带的实际计费模型(MessageUsage.model);缺席/空串 = 还没收到用量帧 */
  usageModel?: string | null
  /** 会话当前选中模型(回落用) */
  sessionModel?: string | null
}): string {
  const fromFrame = params.usageModel?.trim()
  if (fromFrame) return fromFrame
  return params.sessionModel?.trim() ?? ''
}

export interface BuildUsageFromPromptCompletionParams {
  currentUsage: ContextUsageSnapshot | null | undefined
  currentContextWindow?: number | null
  totalTokens?: number | null
  /** 该任务键是否收到过正数 usage_update(见 buildUsageKey / recordPositiveUsageUpdate) */
  hasPositiveUsageUpdate: boolean
}

/**
 * task_complete.usage → 弱 fallback(仅从未收到过正数 usage_update 的任务键采信)。
 * 返回 null 表示"无 fallback 可用,保持现状"。
 */
export function buildUsageFromPromptCompletion(
  params: BuildUsageFromPromptCompletionParams,
): ContextUsageSnapshot | null {
  const { currentUsage, currentContextWindow, totalTokens, hasPositiveUsageUpdate } = params
  // contextWindow 缺席时用 currentUsage.size 兜底
  const contextWindow = currentContextWindow ?? currentUsage?.size ?? null
  if (!contextWindow || contextWindow <= 0) return null
  if (!totalTokens || !Number.isFinite(totalTokens) || totalTokens <= 0) return null
  // 已收到过真实 usage_update 的键不采信:它是 prompt 统计,不是窗口快照,
  // 拿它覆盖会丢掉 provider 报的真实 context used。
  if (hasPositiveUsageUpdate) return null
  return {
    ...currentUsage,
    size: contextWindow,
    used: Math.min(contextWindow, Math.max(currentUsage?.used ?? 0, totalTokens)),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
