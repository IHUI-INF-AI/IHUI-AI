// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816009:内容失败与传输失败分档(跨端共享,无端特定依赖)。
 *
 * 故障形态(上游 packages/ui/src/v4/conversationProjectionStore.ts:780-820 同型):
 * 重试到超时仍在投同一批被拒的 delta —— 因为分档缺失时,"内容被拒"(确定性,重投
 * 必然再拒)和"传输抖动"(瞬态,重试有意义)走同一条 resume 阶梯。三条判据:
 *
 * 1. **内容故障 ⇒ 跳过 resume 阶梯直取强制 snapshot**(上游 :785-790,注释理由
 *   "resume 只会把同一批 delta 再投一遍,必然再被拒"),终态标 content。
 * 2. **同一 flight 内先内容失败后瞬态失败 ⇒ 终态仍归内容失败**(上游 :812-814
 *   "一旦本次 flight 出现过内容失败,终态就归内容失败:后续瞬态 fault 不该把它洗白"
 *   —— 洗白那条就是本票存在的理由)。
 * 3. **纯瞬态超时 ⇒ contentEligible 不置、重试仍被允许**(上游 :949-961 反向锁:
 *   把 contentEligible:false 置上会把仍有意义的重试也取消掉)。
 *
 * 与 G-896418 的关系:分档的前提是判定有 code —— 信封/字段层的 typed fault
 * (fault.sse.fieldRejected)直接计入内容故障。
 */

/** 失败分档:content = 确定性内容故障;transient = 瞬态(传输/超时)。 */
export type StreamFaultTier = 'content' | 'transient'

/**
 * 确定性内容故障的 code 白名单。判定只认 code/status 字面,不认 message 文本
 * (与 SSE_FIELD_FAULT_CODE "判定侧只认稳定码"同一口径)。
 * 不在表内 ⇒ 瞬态(默认档),重试仍被允许。
 */
const CONTENT_FAULT_CODES: ReadonlySet<string> = new Set([
  // b76-05 严格投影 typed fault:字段全型校验被拒 ⇒ 同一批 delta 重投必然再被拒
  'fault.sse.fieldRejected',
  // 内容面确定性拒绝(内容策略/请求体不可读)
  'fault.content.rejected',
  'fault.request.invalid',
])

/** 确定性 4xx:请求本身就不会被第二次接受(重试无意义)。 */
const CONTENT_FAULT_STATUS: ReadonlySet<number> = new Set([400, 404, 413, 422])

/**
 * 判定一个 fault 是否确定性内容故障(上游 isDeterministicContentFault 的同形判定)。
 * 接受形状:{ code?: unknown; status?: unknown; errorCode?: unknown }(ErrorAwareMessage
 * 的 errorCode 与 typed fault 的 code 都能进);形状不符 ⇒ false(瞬态默认档)。
 */
export function isDeterministicContentFault(fault: unknown): boolean {
  if (typeof fault !== 'object' || fault === null) return false
  const v = fault as Record<string, unknown>
  if (typeof v['code'] === 'string' && CONTENT_FAULT_CODES.has(v['code'])) return true
  if (typeof v['errorCode'] === 'string' && CONTENT_FAULT_CODES.has(v['errorCode'])) return true
  if (typeof v['status'] === 'number' && CONTENT_FAULT_STATUS.has(v['status'])) return true
  return false
}

/** 单个 flight(一次发送-投影周期)内累积的分档状态。 */
export interface StreamFaultFlightTracker {
  /** 记一次失败;返回该失败的分档。 */
  record(fault: unknown): StreamFaultTier
  /** 终态分档:出现过内容故障 ⇒ 恒 content(瞬态不得洗白);纯瞬态 ⇒ transient;无失败 ⇒ null。 */
  readonly terminalTier: StreamFaultTier | null
  /** 是否出现过内容故障(决定 contentEligible 与 recovery 策略)。 */
  readonly contentFaultSeen: boolean
  /** 瞬态失败次数。 */
  readonly transientCount: number
}

export function createStreamFaultTracker(): StreamFaultFlightTracker {
  let contentFaultSeen = false
  let transientCount = 0
  const tracker: StreamFaultFlightTracker = {
    record(fault) {
      if (isDeterministicContentFault(fault)) {
        contentFaultSeen = true
        return 'content'
      }
      transientCount += 1
      return 'transient'
    },
    get contentFaultSeen() {
      return contentFaultSeen
    },
    get transientCount() {
      return transientCount
    },
    get terminalTier() {
      // 洗白防线:只要本次 flight 出现过内容失败,终态就归内容失败
      if (contentFaultSeen) return 'content'
      if (transientCount > 0) return 'transient'
      return null
    },
  }
  return tracker
}

/** 恢复决策:strategy 决定走不走 resume 阶梯;contentEligible 只在内容故障时**显式**置 false。 */
export interface StreamRecoveryDecision {
  /** content ⇒ 强制 snapshot(resume 只会重投同一批被拒 delta);transient ⇒ 允许 resume 阶梯。 */
  strategy: 'force-snapshot' | 'resume'
  /**
   * 内容故障时显式 false(重试无意义);**纯瞬态不置**(undefined)——
   * 上游 :949-961 反向锁:置了会把仍有意义的重试也取消掉。
   */
  contentEligible?: false
  tier: StreamFaultTier
}

/**
 * 由 flight 分档状态得恢复决策;无失败 ⇒ null(调用方继续正常流)。
 */
export function resolveStreamRecoveryDecision(
  tracker: StreamFaultFlightTracker,
): StreamRecoveryDecision | null {
  const tier = tracker.terminalTier
  if (tier === null) return null
  if (tier === 'content') {
    return { strategy: 'force-snapshot', contentEligible: false, tier }
  }
  // 纯瞬态:contentEligible 刻意**不置**——该重试的重试
  return { strategy: 'resume', tier }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
