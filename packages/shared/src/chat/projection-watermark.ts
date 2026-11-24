// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对话投影的水位协议(票 G-816006)。
 *
 * 上游原型:`packages/ui/src/v4/conversationProjectionStore.ts`(ACK 不构成 applied base;
 * initial 丢失后即便数值 fromSeq 恰好对上旧 projection,也不能把新 epoch delta 拼到旧状态)。
 *
 * 这一格防的失真不是"少了一条消息",而是 **UI 显示一份自洽但根本不存在的对话**:
 * 全量帧(initial/snapshot)丢了,客户端手上留着一份旧投影;新代次的第一条 delta 的 `fromSeq`
 * 数值上恰好等于本地水位,朴素实现就把它拼上去 —— 序号对得上、日志零痕迹、内容却是编的。
 *
 * 因此本协议的判序是**可用性优先于数值**:
 *   1. 从未成功应用过基线 ⇒ 任何 delta 一律拒(数值对得上也拒)。
 *   2. 基线"收到但未应用"(ACK 只证明收到,不证明可用)⇒ 任何 delta 一律拒并请求 resync。
 *   3. delta 自带基线身份而身份与已应用代次不符 ⇒ 拒(跨代次)。
 *   4. 本地水位未知(基线没带序号)⇒ 拒,不做推断。
 *   5. 整段已应用过 ⇒ 静默丢弃(重复帧 / 迟到帧)。
 *   6. 断档 ⇒ 只重订阅,**不做本地补偿**(不裁头、不补洞)。
 *
 * 明确不发明无来源字段:我方**没有** logEpoch 通道,所以 `baseId` 对 delta 是**可选**的。
 * 代次身份有两个合法来源 —— 上游真值(基线帧自带)或**本地盖章**(`local-gen-<n>`,由应用基线这件事本身
 * 产生,不是上游字段的替身)。当 delta 不带身份时,跨代次这一维**判不了**,协议把它如实回报成
 * `epochUnchecked: true` 而不是默认放行 —— 这一格是已登记的未闭合项,见交付报告。
 *
 * 纯逻辑 + 依赖注入:不派生、不读盘、不碰 React、不 import `node:*`
 * (packages/shared 被 web / 小程序 / RN 共同消费,可达面内出现内建导入会被守门 126 判红)。
 */

/** 全量帧的两种上游写法:快照 / 首包。两者在协议里同义 —— 都表示"这一代次的完整状态"。 */
export type BaselineKind = 'snapshot' | 'initial'

/** 增量帧。 */
export type DeltaKind = 'delta'

/** 协议认识的全部帧种。 */
export type FrameKind = BaselineKind | DeltaKind

/** 收到的一帧。`baseId` 可选:上游没有 epoch 通道时它是 null,而不是被编出来。 */
export interface BaselineFrame {
  readonly kind: BaselineKind
  /** 上游自带的基线身份(如会话 revision / 全量包 id)。没有 ⇒ null,由本地盖章代次。 */
  readonly baseId?: string | null
  /** 全量帧覆盖到的最后一个序号;缺省 ⇒ 本地水位未知(后续 delta 判不了衔接,只能拒)。 */
  readonly seq?: number | null
}

export interface DeltaFrame {
  readonly kind: DeltaKind
  /** 该 delta 声称属于的代次;上游无通道 ⇒ null/undefined。 */
  readonly baseId?: string | null
  /** 本帧承载的第一条记录的序号。 */
  readonly fromSeq: number
  /** 本帧承载的最后一条记录的序号;缺省视为 fromSeq。 */
  readonly toSeq?: number | null
}

export type WatermarkFrame = BaselineFrame | DeltaFrame

/** 本地投影的水位状态(不可变,每次判定产出新对象)。 */
export interface ProjectionWatermarkState {
  /** 已应用基线的代次身份;从未应用 ⇒ null。 */
  readonly baseId: string | null
  /** 已应用基线的序号水位;基线没带序号 ⇒ null(水位未知)。 */
  readonly appliedSeq: number | null
  /** 是否**真的应用过**一份全量帧。ACK 永远不改这一位。 */
  readonly baselineApplied: boolean
  /** 已收到但尚未应用的全量帧身份;非 null ⇒ 在等新基线落地,期间任何 delta 都拒。 */
  readonly pendingBaseId: string | null
  /** 已请求过 resync ⇒ 在等新基线;此位为 true 时不得再拼任何 delta。 */
  readonly awaitingBase: boolean
  /** 本地代次计数器(只在基线帧不自带身份时用来盖章;是本地事实,不是上游字段)。 */
  readonly mintedGenerations: number
  /** 最近一次拒绝的原因;null = 从未拒绝。 */
  readonly lastRejection: RejectReason | null
}

/** 拒绝拼接的原因(全部可判、有出处,不含猜测)。 */
export type RejectReason =
  | 'no-baseline' // 从未应用过全量帧
  | 'awaiting-base' // 全量帧收到未应用 / 已请求重订阅,正在等基线
  | 'base-mismatch' // delta 自带的代次与已应用代次不符(跨代次)
  | 'watermark-unknown' // 基线没带序号,本地水位未知,无法判衔接
  | 'gap' // 断档:fromSeq 落在水位之后,或部分重叠(协议禁止本地补偿)

/** 静默丢弃的原因。 */
export type DropReason =
  | 'duplicate' // 与已应用水位同一点的重复帧
  | 'late' // 整段在水位之前(迟到帧)

/** 放行拼接的原因。 */
export type ApplyReason =
  | 'baseline-established' // 全量帧落地 = 新基线
  | 'contiguous' // 同代次内序号恰好接着水位
  | 'resume-overlap' // resume 重发最后一条:拼接其余部分,首条须由调用方幂等去重

/** 三个动作的 reason 合起来的封闭集:任何判决的 reason 都必须落在这里。 */
export type WatermarkReason = ApplyReason | DropReason | RejectReason

export type WatermarkVerdict =
  | {
      readonly action: 'apply'
      readonly reason: ApplyReason
      /** 本帧落地后的水位(delta 才有意义)。 */
      readonly seq: number | null
      /** delta 不带代次身份 ⇒ 跨代次那一维没判到,如实报名,不静默放行。 */
      readonly epochUnchecked: boolean
      /** true ⇒ 帧的第一条与已应用水位重合,调用方必须去重后再拼。 */
      readonly dedupHead: boolean
    }
  | {
      readonly action: 'drop'
      readonly reason: DropReason
      readonly seq: number | null
      readonly epochUnchecked: boolean
      readonly dedupHead: boolean
    }
  | {
      readonly action: 'resync'
      readonly reason: RejectReason
      readonly seq: number | null
      readonly epochUnchecked: boolean
      readonly dedupHead: boolean
    }

export interface WatermarkTransition {
  readonly state: ProjectionWatermarkState
  readonly verdict: WatermarkVerdict
}

/**
 * ACK 的结果。核心约束:**ACK 不构成可用基线**。
 * 只有 `verdict.action === 'apply'` 的帧才允许被 ACK,且 ACK 本身不推进水位、不建基线 ——
 * 推进水位的唯一通道是 `applyFrame`。
 */
export interface AcknowledgeResult {
  readonly acked: boolean
  readonly state: ProjectionWatermarkState
  readonly reason: 'applied' | 'not-applied' | 'unknown-frame'
}

export function createWatermarkState(seed?: {
  readonly baseId?: string | null
}): ProjectionWatermarkState {
  return {
    baseId: seed?.baseId ?? null,
    appliedSeq: null,
    baselineApplied: false,
    pendingBaseId: null,
    awaitingBase: false,
    mintedGenerations: 0,
    lastRejection: null,
  }
}

/** 帧的水位上界:delta 用 toSeq(缺省 fromSeq),全量帧用 seq。 */
function frameUpperSeq(frame: WatermarkFrame): number | null {
  if (frame.kind === 'delta') return frame.toSeq ?? frame.fromSeq
  return frame.seq ?? null
}

function isBaselineFrame(frame: WatermarkFrame): frame is BaselineFrame {
  return frame.kind === 'snapshot' || frame.kind === 'initial'
}

/**
 * 帧是否自带代次身份。写成显式两值比较而不是 `== null` —— 本仓 eslint `eqeqeq` 是 error,
 * 而"用宽松相等抄一条捷径"会让规则在别处也长不出来。
 */
function carriesBaseId(value: string | null | undefined): boolean {
  return value !== null && value !== undefined
}

// 三个构造函数按动作分开,而不是一个 `verdictOf(action, reason: string)`:
// 后者必须把 reason 强转回各自动作的联合,等于在类型层重新开一个"任何字符串都行"的口子。
function applyVerdict(
  reason: ApplyReason,
  seq: number | null,
  epochUnchecked: boolean,
  dedupHead: boolean,
): WatermarkVerdict {
  return { action: 'apply', reason, seq, epochUnchecked, dedupHead }
}

function dropVerdict(
  reason: DropReason,
  seq: number | null,
  epochUnchecked: boolean,
  dedupHead: boolean,
): WatermarkVerdict {
  return { action: 'drop', reason, seq, epochUnchecked, dedupHead }
}

function resyncVerdict(
  reason: RejectReason,
  seq: number | null,
  epochUnchecked: boolean,
  dedupHead: boolean,
): WatermarkVerdict {
  return { action: 'resync', reason, seq, epochUnchecked, dedupHead }
}

/**
 * 全量帧落地:这是**唯一**能建立/更换基线代次的通道。
 * 上游不自带身份时,由本地计数器盖章一个新代次(`local-gen-<n>`)——
 * 这是"我确实在这一刻换了一份基线"的本地事实,不是替 logEpoch 编出来的字段。
 */
function applyBaseline(state: ProjectionWatermarkState, frame: BaselineFrame): WatermarkTransition {
  const minted = state.mintedGenerations + 1
  const baseId = frame.baseId ?? `local-gen-${minted}`
  const next: ProjectionWatermarkState = {
    ...state,
    baseId,
    appliedSeq: frame.seq ?? null,
    baselineApplied: true,
    pendingBaseId: null,
    awaitingBase: false,
    mintedGenerations: minted,
    lastRejection: null,
  }
  return {
    state: next,
    verdict: applyVerdict('baseline-established', next.appliedSeq, false, false),
  }
}

/** 判定一帧:产出新状态 + 判决。**不改动入参**(纯函数,可安全用在 store reducer 里)。 */
export function applyFrame(
  state: ProjectionWatermarkState,
  frame: WatermarkFrame,
): WatermarkTransition {
  if (isBaselineFrame(frame)) return applyBaseline(state, frame)

  const upper = frameUpperSeq(frame)

  // 1. 从未应用过基线:数值对得再齐也不给拼。
  if (!state.baselineApplied) {
    return {
      state: { ...state, awaitingBase: true, lastRejection: 'no-baseline' },
      verdict: resyncVerdict('no-baseline', state.appliedSeq, !carriesBaseId(frame.baseId), false),
    }
  }

  // 2. 全量帧收到但未应用(ACK ≠ 可用基线)/ 已在等重订阅 ⇒ 拒绝一切 delta。
  if (state.pendingBaseId !== null || state.awaitingBase) {
    return {
      state: { ...state, awaitingBase: true, lastRejection: 'awaiting-base' },
      verdict: resyncVerdict(
        'awaiting-base',
        state.appliedSeq,
        !carriesBaseId(frame.baseId),
        false,
      ),
    }
  }

  // 3. 跨代次:delta 自带身份而与已应用代次不符。
  if (carriesBaseId(frame.baseId) && frame.baseId !== state.baseId) {
    return {
      state: { ...state, awaitingBase: true, lastRejection: 'base-mismatch' },
      verdict: resyncVerdict('base-mismatch', state.appliedSeq, false, false),
    }
  }

  // delta 未带身份 ⇒ 这一维没判到(如实报名,不遮成"已确认同代次")。
  const epochUnchecked = !carriesBaseId(frame.baseId)

  // 4. 基线没带序号 ⇒ 水位未知,不做推断。
  if (state.appliedSeq === null) {
    return {
      state: { ...state, awaitingBase: true, lastRejection: 'watermark-unknown' },
      verdict: resyncVerdict('watermark-unknown', null, epochUnchecked, false),
    }
  }

  const applied = state.appliedSeq

  // 5. 整段已应用过 ⇒ 静默丢弃(重复帧 / 迟到帧)。
  if (upper !== null && upper <= applied) {
    const reason: DropReason = frame.fromSeq === upper && upper === applied ? 'duplicate' : 'late'
    return {
      state: { ...state, lastRejection: null },
      verdict: dropVerdict(reason, applied, epochUnchecked, false),
    }
  }

  // 6. 断档 / 部分重叠:协议禁止本地补偿(不裁头、不补洞),只重订阅。
  const contiguous = frame.fromSeq === applied + 1
  const resumeOverlap = frame.fromSeq === applied
  if (!contiguous && !resumeOverlap) {
    return {
      state: { ...state, awaitingBase: true, lastRejection: 'gap' },
      verdict: resyncVerdict('gap', applied, epochUnchecked, false),
    }
  }

  const nextSeq = upper ?? frame.fromSeq
  const next: ProjectionWatermarkState = {
    ...state,
    appliedSeq: nextSeq,
    lastRejection: null,
  }
  return {
    state: next,
    verdict: applyVerdict(
      resumeOverlap ? 'resume-overlap' : 'contiguous',
      nextSeq,
      epochUnchecked,
      resumeOverlap,
    ),
  }
}

/**
 * "全量帧收到了但没能应用"的记账入口(payload 丢失 / 解析失败 / 渲染层拒绝)。
 * 这一步**只登记欠账,不建立基线** —— 它是 ACK 与可用基线之间那道分界的机器表达。
 */
export function noteBaselineReceived(
  state: ProjectionWatermarkState,
  frame: BaselineFrame,
): ProjectionWatermarkState {
  return {
    ...state,
    pendingBaseId: frame.baseId ?? 'pending-unidentified-baseline',
    awaitingBase: true,
  }
}

/**
 * ACK 一个 delta。**只有已被 `applyFrame` 判为 apply 的帧才可 ACK**;
 * ACK 不推进水位、不建基线、不清 pending —— 那三件事只有 `applyFrame` 能做。
 *
 * `applied` 由调用方(承载层)提供"这一帧真的进了投影吗"的事实;
 * 传 false 时 ACK 必须拒绝,且把该帧登记成 pending —— 这样下一帧 delta 才会在规则 2 上被拦。
 */
export function acknowledge(
  state: ProjectionWatermarkState,
  frame: WatermarkFrame,
  applied: boolean,
): AcknowledgeResult {
  if (!isBaselineFrame(frame)) {
    const next = applied
      ? state
      : { ...state, awaitingBase: true, lastRejection: 'awaiting-base' as const }
    return {
      acked: applied,
      state: next,
      reason: applied ? 'applied' : 'not-applied',
    }
  }
  // 全量帧的 ACK:证明收到了,不证明可用 ⇒ 落 pending,由调用方随后用 applyFrame 兑现或补拉。
  if (applied) return { acked: true, state, reason: 'applied' }
  return {
    acked: false,
    state: noteBaselineReceived(state, frame),
    reason: 'not-applied',
  }
}

/** 主动请求重订阅(如上层自己发现断档);置位后一切 delta 都拒,直到新基线落地。 */
export function requestResync(state: ProjectionWatermarkState): ProjectionWatermarkState {
  return { ...state, awaitingBase: true, lastRejection: 'gap' }
}

/** 水位是否已经可用(有基线、没欠账、没在等新基线)。 */
export function isBaselineUsable(state: ProjectionWatermarkState): boolean {
  return state.baselineApplied && state.pendingBaseId === null && !state.awaitingBase
}

/** 判一帧但不改状态(给守门/测试/日志用的只读视角)。 */
export function judgeFrame(
  state: ProjectionWatermarkState,
  frame: WatermarkFrame,
): WatermarkVerdict {
  return applyFrame(state, frame).verdict
}

export const PROJECTION_WATERMARK_REJECT_REASONS = [
  'no-baseline',
  'awaiting-base',
  'base-mismatch',
  'watermark-unknown',
  'gap',
] as const satisfies readonly RejectReason[]

export const PROJECTION_WATERMARK_DROP_REASONS = [
  'duplicate',
  'late',
] as const satisfies readonly DropReason[]

export const PROJECTION_WATERMARK_APPLY_REASONS = [
  'baseline-established',
  'contiguous',
  'resume-overlap',
] as const satisfies readonly ApplyReason[]

/**
 * 三个动作 reason 的合并封闭集。派生自上面三份常量而不是再抄一遍字面量 ——
 * 多一份手写清单就多一次漂移(§22c),而漂移的表现是"判决产出登记表外的 reason 却没人发现"。
 */
export const PROJECTION_WATERMARK_REASONS = [
  ...PROJECTION_WATERMARK_APPLY_REASONS,
  ...PROJECTION_WATERMARK_DROP_REASONS,
  ...PROJECTION_WATERMARK_REJECT_REASONS,
] as const satisfies readonly WatermarkReason[]

// 反查走 Set:值集只从上面同一份常量派生,不另立第二份清单。
const APPLY_REASON_SET: ReadonlySet<string> = new Set(PROJECTION_WATERMARK_APPLY_REASONS)
const DROP_REASON_SET: ReadonlySet<string> = new Set(PROJECTION_WATERMARK_DROP_REASONS)
const REJECT_REASON_SET: ReadonlySet<string> = new Set(PROJECTION_WATERMARK_REJECT_REASONS)
const ALL_REASON_SET: ReadonlySet<string> = new Set(PROJECTION_WATERMARK_REASONS)

/**
 * 值 → 类型守卫。入参取 `unknown` 而不是 `string`:调用方(日志回放、上游帧解析)拿到的
 * 往往就是 `unknown`,若守卫只收 string,那边就只能先强转 —— 等于把"任何字符串都是 reason"
 * 的口子重新打开。
 */
export function isApplyReason(value: unknown): value is ApplyReason {
  return typeof value === 'string' && APPLY_REASON_SET.has(value)
}

export function isDropReason(value: unknown): value is DropReason {
  return typeof value === 'string' && DROP_REASON_SET.has(value)
}

export function isRejectReason(value: unknown): value is RejectReason {
  return typeof value === 'string' && REJECT_REASON_SET.has(value)
}

/** 任一动作的 reason(不区分动作;需要区分时用上面三个)。 */
export function isWatermarkReason(value: unknown): value is WatermarkReason {
  return typeof value === 'string' && ALL_REASON_SET.has(value)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
