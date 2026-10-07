// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ============================================================================
// G-816031:解 fail-closed 闸门的「权威信封」层
// ============================================================================
//
// 票面判据(逐字拆成三条,本文件是唯一判据源):
//  ① **解 fail-closed 闸门只认权威信封字段,不认 RPC 时序** —— 只有
//     `deliveryKind === 'recovery'` 能解门;RPC 响应先到**不得**解门(反例必须红)。
//  ② **判「要不要重订阅」只认封闭 reason-code 集** —— 未知码计入未判定并逐条报名,
//     **不得默认「重订阅」,也不得默认「不用」**(上游 staleAuthorityRecovery.ts:1-19
//     同一条纪律:`candidate.status !== 'stale'` 即返回 undefined,不做字符串模糊匹配)。
//  ③ **迟到旧片被丢弃时,assembler 的既有序号不得被重置**(上游
//     topicWireDecoder.ts:93-100:`recover()` 只解门、保留 assembler settled ordinal,
//     于是迟到旧片仍然静默丢 —— 解门不是把水位倒回去)。
//
// 我方现状(派单前现读,勿照上游行号找东西):`git grep -nE "\bseq\b|lastSeq|maxSeq|
// outOfOrder"` 在 `packages/shared/src/sse/` 与消费面只命中**声明侧**
// (`contract.ts` 的 tool-delta `seq` 字段与其「当前不参与排序/收敛」那段口径)以及
// 若干无关同名局部量 ⇒ 消费端既没有 seq 门,也没有「权威信封」这一层。本文件补的
// 正是这一层的**判据**,不是某一条流的实现。
//
// 三条不许漂的写法:
//
// 1. **两条判据互相不得顶替**(①与②是两把尺子,不是一个判断的两种说法):
//    · 解门只看 `deliveryKind`(通道);拿 reason-code 去解门 = ①的反例;
//    · 重订阅只看 `reasonCode`(码);拿通道去定码 = ②的反例。
//    因此两个出口(`applyAuthority` / `decideSubscription`)各自只读自己那一个字段,
//    而**时序字段(arrivedFirst / rpcResponseFirst / arrivalIndex 之类)在本层结构上
//    不是入参** —— 判据不接受它们,就不可能被它们影响;这不是"读了但不用"。
//
// 2. **本层的 `settledOrdinal` 不是线格式水位**。`agent-events.ts` 的
//    `FrameWatermark`(`subscriptionId / logEpoch / fromSeq / toSeq`)是**帧上带的水位**,
//    由 `isFrameGap` 判连续性;本层的 `settledOrdinal` 是**装配器自己确认过的片序号**
//    (验收③要保住的那个"既有序号")。两者不同物,不得互相顶替;上游那套 epoch 词汇
//    我方已有出口,复制过来就是第二个真相,所以本文件不引入 logEpoch。
//
// 3. **本层刻意不读 tool-delta 的 `seq`**。`contract.ts` 现行口径写明:seq 当前**不参与**
//    排序/收敛(六个消费端只按 toolCallId 整帧覆盖),且"若将来改成按 seq 收敛,必须
//    同步改掉本段与六个消费端,不得只改一处"。把接线做在本票里就等于只改一处,所以
//    装配器要求调用方显式给出 `ordinal` 字段(装配位自己的序号);seq 的收编属那六处
//    同批改的那一票,不归本票。
//
// 既有序号的缺省是 **null 而不是 0** —— 0 是一个合法序号(线格式侧 `FrameWatermark`
// 的 fromSeq/toSeq 都允许 0),把"还没确认过任何一片"折成 0 会让首片 0 被当成迟到而
// 静默丢弃(与本仓 G-721 那条"缺席 ≠ 零值"是同一条纪律)。所以
// `settledOrdinal: number | null`;唯一能把它退回 null 的出口是
// `resetForNewGeneration(带非空理由)`,且该动作计入 `ledger().generationResets` ——
// **静默清零**正是要防的那一型。三格分别由用例 C6 / C8 / C7 钉住。
//
// 三态纪律(本仓最高频失效型是"把没判写成判过了",故三桶绝不并):
//  · **判定为可解门** = `release`(仅 `deliveryKind === 'recovery'`);
//  · **明确不可解门(放过,照报数)** = `hold`(通道在封闭集内但不是 recovery,
//    含 RPC 响应先到、正常翻页 `page`、续流 `resume`、常规 `stream`);
//  · **未判定** = 通道/码缺席、非字符串、或**不在封闭集内** ⇒ 逐条报名,
//    既不计入 hold(那是"确信不用"的肯定结论),也绝不解门、不动水位。
//
// 接线现状(**如实登记,不得读成已收口**):本出口目前是**零生产消费方**。
// 把它接进解码/路由路径需要两处改动,都不在本票允许的文件清单内:
//  ① `packages/shared/src/sse/index.ts` 加一行 re-export —— `packages/shared/package.json`
//     的 exports 表没有 `./sse/*` 子路径,包外只能经该 barrel 拿到本层(同形先例:
//     `frame-ownership-barrier.ts` / G-816030 同样未进 barrel,api-client 因零依赖
//     包边界自带同形移植件,由两侧 parity 测试对账);
//  ② 消费端在 fail-closed 分支上调用 `applyAuthority()` 并按 `ledger()` 报名。
// 本票不改别人的解析面语义,故上述两格归该面持有人接线;在那之前不得把本文件读成"门已生效"。

// ----------------------------------------------------------------------------
// 封闭集一:交付通道(deliveryKind)
// ----------------------------------------------------------------------------

/**
 * 权威信封的交付通道封闭集。**`RECOVERY` 是唯一能解 fail-closed 闸门的通道** ——
 * 这不是优先级排序,而是票面①的判据本身:其余四条都只说明"这条流还在正常走",
 * 它们先到/后到都不构成"服务端重新承认了权威"。
 */
export const RECOVERY_DELIVERY_KINDS = {
  /** 恢复通道:服务端显式以恢复流重新授予权威 —— 唯一可解门 */
  RECOVERY: 'recovery',
  /** 常规流式帧 */
  STREAM: 'stream',
  /** RPC/HTTP 响应(票面①点名的反例:它先到也不得解门) */
  RPC_RESPONSE: 'rpc-response',
  /** 正常翻页 / 历史回读 */
  PAGE: 'page',
  /** Last-Event-ID 续流(只回答"接着哪儿发",不回答"谁的权威") */
  RESUME: 'resume',
} as const

export type RecoveryDeliveryKind =
  (typeof RECOVERY_DELIVERY_KINDS)[keyof typeof RECOVERY_DELIVERY_KINDS]

/** 通道清单(封闭集的唯一派生,供测试逐条遍历与接线方校验)。 */
export const RECOVERY_DELIVERY_KIND_LIST: readonly RecoveryDeliveryKind[] =
  Object.values(RECOVERY_DELIVERY_KINDS)

// ----------------------------------------------------------------------------
// 封闭集二:reason-code → 要不要重订阅
// ----------------------------------------------------------------------------

/** 重订阅的两档结论(未判定不在此列 —— 它是第三态,不是这两档的兜底)。 */
export type RecoverySubscriptionDecision = 'resubscribe' | 'keep-subscription'

/**
 * reason-code 的**封闭集兼判例表**(单一来源;`RECOVERY_REASON_CODES` 由它的键派生,
 * 所以名单与结论不可能分叉)。前三条对齐我方既有词汇 `FrameGapKind`
 * ('generation-change' / 'epoch-change' / 'seq-discontinuity'),即"你手上的权威属于
 * 另一个代际/纪元/水位" ⇒ 必须重订阅;后两条是明确"不用重订阅"的肯定结论。
 * **集外一律未判定**,查表是精确等值(`find` 逐名比),不做前缀/包含式模糊匹配。
 */
export const RECOVERY_REASON_CODE_DECISIONS = {
  /** 订阅代际已变(手上是旧一代订阅的结论) */
  'stale-subscription-generation': 'resubscribe',
  /** 纪元已变(会话重建 / fork / rewind 后裸游标仍能对上,而内容属另一纪元) */
  'stale-epoch': 'resubscribe',
  /** 水位不连续(手上的 seq 接不上服务端要发的下一段) */
  'stale-sequence': 'resubscribe',
  /** 权威已复核且仍然有效 —— 明确的"不用"(不是"没判") */
  'authority-current': 'keep-subscription',
  /** 恢复订阅已在途 —— 不得重复发起,也是明确的"不用" */
  'recovery-in-flight': 'keep-subscription',
} as const satisfies Record<string, RecoverySubscriptionDecision>

export type RecoveryReasonCode = keyof typeof RECOVERY_REASON_CODE_DECISIONS

/**
 * 封闭集的成员清单。守门 120「名单类判据必须有正向证明」要求每条成员都被测试拿当
 * 输入 —— 导出它就是为了那份遍历断言,不是给消费方当类型兜底。
 */
export const RECOVERY_REASON_CODES: readonly RecoveryReasonCode[] = Object.keys(
  RECOVERY_REASON_CODE_DECISIONS,
) as readonly RecoveryReasonCode[]

/**
 * 查表(精确等值)。先 `find` 把任意字符串收窄成集内成员,再用它索引常量表 ——
 * 全程无类型断言:集外字符串永远走不到索引那一步,冒充不出结论。
 */
function decisionForReasonCode(value: string): RecoverySubscriptionDecision | undefined {
  const hit = RECOVERY_REASON_CODES.find((code) => code === value)
  return hit === undefined ? undefined : RECOVERY_REASON_CODE_DECISIONS[hit]
}

function deliveryKindOf(value: string): RecoveryDeliveryKind | undefined {
  return RECOVERY_DELIVERY_KIND_LIST.find((kind) => kind === value)
}

// ----------------------------------------------------------------------------
// 三态结论的形状
// ----------------------------------------------------------------------------

/** 解门判定的三态(票面①)。 */
export type GateReleaseVerdict = 'release' | 'hold' | 'undetermined'

/**
 * 解门判定的封闭细分(同一态内也不并桶;计数见 `ledger().releaseByReason`)。
 * 刻意不另立"原因清单"常量当第二份真相 —— 计数表按实际出现的键生长。
 */
export type GateReleaseReason =
  | 'recovery-delivery'
  | 'non-recovery-delivery'
  | 'delivery-kind-absent'
  | 'delivery-kind-malformed'
  | 'delivery-kind-unknown'
  | 'envelope-unreadable'

/** 重订阅判定的三态(票面②;前两档来自封闭集,第三档是未判定)。 */
export type SubscriptionDecisionVerdict = RecoverySubscriptionDecision | 'undetermined'

export type SubscriptionDecisionReason =
  | 'reason-code-listed'
  | 'reason-code-absent'
  | 'reason-code-malformed'
  | 'reason-code-unknown'
  | 'envelope-unreadable'

/** 片处置的三态(票面③)。 */
export type ChunkDispositionKind = 'accept' | 'drop-late' | 'undetermined'

export type ChunkDispositionReason =
  | 'ahead-of-watermark'
  | 'at-or-behind-watermark'
  | 'ordinal-absent'
  | 'ordinal-malformed'
  | 'input-unreadable'

/** 解门判定结论。 */
export interface GateReleaseDecision {
  readonly verdict: GateReleaseVerdict
  readonly reason: GateReleaseReason
  /** 读到的通道原值(报名用);信封整体不可读时为 null */
  readonly deliveryKind: string | null
  /** 本次判定是否真的把门关着打开(recovery 幂等重放 ⇒ false,但仍照计 release) */
  readonly changed: boolean
}

/** 重订阅判定结论。 */
export interface SubscriptionDecisionOutcome {
  readonly verdict: SubscriptionDecisionVerdict
  /** 封闭集内命中的码;未判定为 null(未判定不得被折成任一档) */
  readonly reasonCode: string | null
  readonly detail: SubscriptionDecisionReason
  /** 报名用的原值描述(仅未判定档给值) */
  readonly raw: string | null
}

/** 片处置结论。 */
export interface ChunkDisposition {
  readonly kind: ChunkDispositionKind
  readonly ordinal: number | null
  readonly reason: ChunkDispositionReason
  /**
   * **本次判定之后的既有序号**。验收③的机器证据就在这一格:
   * `drop-late` 与 `undetermined` 两档必须给出与判定前逐字相等的值。
   */
  readonly settledOrdinalAfter: number | null
}

/** 未判定报名条目(三轴共用一张清单,轴已标注 —— 不得只给计数)。 */
export interface RecoveryGateUndeterminedItem {
  readonly axis: 'gate-release' | 'subscription' | 'chunk'
  readonly reason: string
  /** 被拒读的原值描述(对象/数组只写形状名,不把载荷内容刷进台账) */
  readonly raw: string | null
}

/** 三态账目快照:接线方与测试读它,而不是读日志文案。 */
export interface RecoveryGateLedger {
  readonly released: number
  readonly held: number
  readonly undetermined: number
  readonly releaseByReason: Readonly<Record<string, number>>
  readonly resubscribe: number
  readonly keepSubscription: number
  readonly subscriptionUndetermined: number
  readonly subscriptionByReason: Readonly<Record<string, number>>
  readonly chunksAccepted: number
  readonly chunksDroppedLate: number
  readonly chunksUndetermined: number
  readonly chunkByReason: Readonly<Record<string, number>>
  /** 换代重置次数 —— 唯一能把既有序号清零的通道;静默清零才是要防的那一型 */
  readonly generationResets: number
  readonly undeterminedItems: readonly RecoveryGateUndeterminedItem[]
}

/** 闸门状态快照(验收①③都读它:解门路径不得改 settledOrdinal)。 */
export interface RecoveryGateSnapshot {
  readonly open: boolean
  /**
   * 装配器已确认的最大片序号;**null = 还没确认过任何一片**。
   * 缺省刻意不是 0:把"没有"折成 0 会让首片序号 0 被当成迟到而静默丢弃
   * (本仓 G-721 那条"缺席 ≠ 零值"的纪律在同一格上的应用;线格式侧
   * `FrameWatermark` 也允许 fromSeq/toSeq 取 0)。
   */
  readonly settledOrdinal: number | null
}

export interface RecoveryGate {
  /** 票面①:权威信封进账 —— 只读 deliveryKind,只这一件事 */
  applyAuthority(envelope: unknown): GateReleaseDecision
  /** 票面②:要不要重订阅 —— 只读 reasonCode,只这一件事;未判定不改任何状态 */
  decideSubscription(envelope: unknown): SubscriptionDecisionOutcome
  /** 票面③:收一片 —— accept 推进水位;drop-late / undetermined 一律不动状态 */
  acceptChunk(input: unknown): ChunkDisposition
  snapshot(): RecoveryGateSnapshot
  ledger(): RecoveryGateLedger
  /**
   * **唯一**能移动 settledOrdinal 的另一条路:显式换代 / 重连。
   * 必须带非空 reason(换代要被看见、可归因),并记入 `generationResets` 而非静默清零。
   */
  resetForNewGeneration(reason: string): void
}

// ----------------------------------------------------------------------------
// 读取侧的守卫(零 any;未知输入一律走这几把尺子)
// ----------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 线格式两族键(camelCase / snake_case)同视,与 `readFrameWatermark` 同一取向。 */
function readWireField(source: Record<string, unknown>, camel: string, snake: string): unknown {
  const value = source[camel]
  return value !== undefined ? value : source[snake]
}

/** 报名用的原值描述:只给形状/字面量。 */
function describeRaw(value: unknown): string | null {
  if (value === undefined) return null
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'string':
      return value.length === 0 ? "''(空串)" : `'${value}'`
    case 'number':
    case 'bigint':
    case 'boolean':
      return String(value)
    default:
      return typeof value
  }
}

function isPlainNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** 交付通道读取结论:known 之外一律"判不出",但细分原因必须可报。 */
export type DeliveryKindRead =
  | { readonly verdict: 'known'; readonly kind: RecoveryDeliveryKind; readonly raw: string }
  | {
      readonly verdict: 'undetermined'
      readonly reason: Exclude<GateReleaseReason, 'recovery-delivery' | 'non-recovery-delivery'>
      readonly raw: string | null
    }

/**
 * 从权威信封读交付通道:封闭集内的字符串 ⇒ known;
 * 缺席 / 非字符串 / 空串 / **不在封闭集** ⇒ 一律 undetermined(不猜、不折成 hold)。
 * 纯函数,导出是为了接线方能在不动状态的前提下先问一句"这帧够格吗"。
 */
export function readDeliveryKind(envelope: unknown): DeliveryKindRead {
  if (!isRecord(envelope)) {
    return { verdict: 'undetermined', reason: 'envelope-unreadable', raw: describeRaw(envelope) }
  }
  const raw = readWireField(envelope, 'deliveryKind', 'delivery_kind')
  if (raw === undefined) {
    return { verdict: 'undetermined', reason: 'delivery-kind-absent', raw: null }
  }
  if (!isPlainNonEmptyString(raw)) {
    return { verdict: 'undetermined', reason: 'delivery-kind-malformed', raw: describeRaw(raw) }
  }
  const kind = deliveryKindOf(raw)
  if (kind === undefined) {
    return { verdict: 'undetermined', reason: 'delivery-kind-unknown', raw: `'${raw}'` }
  }
  return { verdict: 'known', kind, raw: `'${raw}'` }
}

/**
 * 重订阅判定的纯函数出口(同 `readDeliveryKind`:不持状态,接线方可先行问询)。
 * 只读 reasonCode,**不读** deliveryKind —— 用通道定码是票面②的反例。
 */
export function decideSubscriptionFromEnvelope(envelope: unknown): SubscriptionDecisionOutcome {
  if (!isRecord(envelope)) {
    return {
      verdict: 'undetermined',
      reasonCode: null,
      detail: 'envelope-unreadable',
      raw: describeRaw(envelope),
    }
  }
  const raw = readWireField(envelope, 'reasonCode', 'reason_code')
  if (raw === undefined) {
    return { verdict: 'undetermined', reasonCode: null, detail: 'reason-code-absent', raw: null }
  }
  if (!isPlainNonEmptyString(raw)) {
    return {
      verdict: 'undetermined',
      reasonCode: null,
      detail: 'reason-code-malformed',
      raw: describeRaw(raw),
    }
  }
  const decision = decisionForReasonCode(raw)
  if (decision !== undefined) {
    return { verdict: decision, reasonCode: raw, detail: 'reason-code-listed', raw: null }
  }
  return {
    verdict: 'undetermined',
    reasonCode: null,
    detail: 'reason-code-unknown',
    raw: `'${raw}'`,
  }
}

/** 片序号读取结论。 */
export type ChunkOrdinalRead =
  | { readonly verdict: 'known'; readonly ordinal: number }
  | {
      readonly verdict: 'undetermined'
      readonly reason: Exclude<
        ChunkDispositionReason,
        'ahead-of-watermark' | 'at-or-behind-watermark'
      >
      readonly raw: string | null
    }

/**
 * 读装配器自己的序号字段 `ordinal`(单一键名,不做同义键并桶)。
 * **不读 `seq`** —— 理由见文件头第 3 条;把 seq 收编成判据属那六个消费端同批改的一票。
 */
export function readChunkOrdinal(input: unknown): ChunkOrdinalRead {
  if (!isRecord(input)) {
    return { verdict: 'undetermined', reason: 'input-unreadable', raw: describeRaw(input) }
  }
  const raw = input.ordinal
  if (raw === undefined) {
    return { verdict: 'undetermined', reason: 'ordinal-absent', raw: null }
  }
  if (!isSafeNonNegativeInt(raw)) {
    return { verdict: 'undetermined', reason: 'ordinal-malformed', raw: describeRaw(raw) }
  }
  return { verdict: 'known', ordinal: raw }
}

// ----------------------------------------------------------------------------
// 闸门 + 装配器账目
// ----------------------------------------------------------------------------

interface MutableCounters {
  released: number
  held: number
  undetermined: number
  resubscribe: number
  keepSubscription: number
  subscriptionUndetermined: number
  chunksAccepted: number
  chunksDroppedLate: number
  chunksUndetermined: number
  generationResets: number
}

function bumpByReason(table: Record<string, number>, reason: string): void {
  table[reason] = (table[reason] ?? 0) + 1
}

/**
 * 建一台权威信封闸门。默认 **closed**(fail-closed):没有权威信封进账时,
 * 消费端不得把任何后续帧读成"已被重新承认"。
 *
 * 一台实例对应一条订阅装配位;它不持 I/O、不读时钟、不碰全局状态 ——
 * "RPC 响应先到"这类时序信息在本层**没有入参通道**,因此结构上不可能参与判定。
 */
export function createRecoveryGate(): RecoveryGate {
  let open = false
  /** null = 还没确认过任何一片(缺省不是 0;理由见 `RecoveryGateSnapshot.settledOrdinal`) */
  let settledOrdinal: number | null = null

  const counters: MutableCounters = {
    released: 0,
    held: 0,
    undetermined: 0,
    resubscribe: 0,
    keepSubscription: 0,
    subscriptionUndetermined: 0,
    chunksAccepted: 0,
    chunksDroppedLate: 0,
    chunksUndetermined: 0,
    generationResets: 0,
  }
  const releaseByReason: Record<string, number> = {}
  const subscriptionByReason: Record<string, number> = {}
  const chunkByReason: Record<string, number> = {}
  const undeterminedItems: RecoveryGateUndeterminedItem[] = []

  const reportUndetermined = (
    axis: RecoveryGateUndeterminedItem['axis'],
    reason: string,
    raw: string | null,
  ): void => {
    undeterminedItems.push({ axis, reason, raw })
  }

  return {
    applyAuthority(envelope) {
      const read = readDeliveryKind(envelope)

      if (read.verdict === 'undetermined') {
        // 判不出 ⇒ 第三态:既不算 hold(那是"确信不用"),也绝不解门
        counters.undetermined += 1
        bumpByReason(releaseByReason, read.reason)
        reportUndetermined('gate-release', read.reason, read.raw)
        return {
          verdict: 'undetermined',
          reason: read.reason,
          deliveryKind: read.raw,
          changed: false,
        }
      }

      if (read.kind === RECOVERY_DELIVERY_KINDS.RECOVERY) {
        const changed = !open
        open = true
        counters.released += 1
        bumpByReason(releaseByReason, 'recovery-delivery')
        return { verdict: 'release', reason: 'recovery-delivery', deliveryKind: read.raw, changed }
      }

      // 封闭集内的非 recovery 通道(rpc-response / page / resume / stream)⇒ 明确不用解门
      counters.held += 1
      bumpByReason(releaseByReason, 'non-recovery-delivery')
      return {
        verdict: 'hold',
        reason: 'non-recovery-delivery',
        deliveryKind: read.raw,
        changed: false,
      }
    },

    decideSubscription(envelope) {
      const outcome = decideSubscriptionFromEnvelope(envelope)
      bumpByReason(subscriptionByReason, outcome.detail)

      if (outcome.verdict === 'undetermined') {
        // 未知码 / 缺席 / 异形:第三态 + 报名,**状态一字不动**
        // (不动 open、不动 settledOrdinal、不计入前两档)
        counters.subscriptionUndetermined += 1
        reportUndetermined('subscription', outcome.detail, outcome.raw)
        return outcome
      }
      if (outcome.verdict === 'resubscribe') counters.resubscribe += 1
      else counters.keepSubscription += 1
      return outcome
    },

    acceptChunk(input) {
      const read = readChunkOrdinal(input)

      if (read.verdict === 'undetermined') {
        // 判不出既不是"接受"也不是"迟到":水位不得动,也不得被计成 drop-late
        counters.chunksUndetermined += 1
        bumpByReason(chunkByReason, read.reason)
        reportUndetermined('chunk', read.reason, read.raw)
        return {
          kind: 'undetermined',
          ordinal: null,
          reason: read.reason,
          settledOrdinalAfter: settledOrdinal,
        }
      }

      if (settledOrdinal !== null && read.ordinal <= settledOrdinal) {
        // 迟到旧片(含同序号重放)⇒ 丢弃,且**既有序号不得被重置**(票面③)
        counters.chunksDroppedLate += 1
        bumpByReason(chunkByReason, 'at-or-behind-watermark')
        return {
          kind: 'drop-late',
          ordinal: read.ordinal,
          reason: 'at-or-behind-watermark',
          settledOrdinalAfter: settledOrdinal,
        }
      }

      settledOrdinal = read.ordinal
      counters.chunksAccepted += 1
      bumpByReason(chunkByReason, 'ahead-of-watermark')
      return {
        kind: 'accept',
        ordinal: read.ordinal,
        reason: 'ahead-of-watermark',
        settledOrdinalAfter: settledOrdinal,
      }
    },

    snapshot() {
      return { open, settledOrdinal }
    },

    ledger() {
      return {
        released: counters.released,
        held: counters.held,
        undetermined: counters.undetermined,
        releaseByReason: { ...releaseByReason },
        resubscribe: counters.resubscribe,
        keepSubscription: counters.keepSubscription,
        subscriptionUndetermined: counters.subscriptionUndetermined,
        subscriptionByReason: { ...subscriptionByReason },
        chunksAccepted: counters.chunksAccepted,
        chunksDroppedLate: counters.chunksDroppedLate,
        chunksUndetermined: counters.chunksUndetermined,
        chunkByReason: { ...chunkByReason },
        generationResets: counters.generationResets,
        undeterminedItems: undeterminedItems.map((item) => ({ ...item })),
      }
    },

    resetForNewGeneration(reason) {
      if (!isPlainNonEmptyString(reason)) {
        throw new TypeError(
          'resetForNewGeneration 必须带非空 reason:换代是把既有序号清零的唯一合法动作,' +
            '不带理由的清零无法归因,与"迟到片把水位顶回去"同型。',
        )
      }
      open = false
      settledOrdinal = null
      counters.generationResets += 1
    },
  }
}

/**
 * 三态读数的一行版式(接线方与测试用它把"未判定"喊出来,而不是只留在账里)。
 * 刻意只此一处拼串 —— 两处各拼一遍必然与账目字段漂开。
 */
export function formatRecoveryGateLedger(ledger: RecoveryGateLedger): string {
  const items = ledger.undeterminedItems
    .map((item) => `${item.axis}:${item.reason}${item.raw === null ? '' : `=${item.raw}`}`)
    .join(', ')
  return (
    `[recovery-gate] 解门 release=${String(ledger.released)} hold=${String(ledger.held)} ` +
    `未判定=${String(ledger.undetermined)}` +
    ` | 重订阅 resubscribe=${String(ledger.resubscribe)} ` +
    `keep=${String(ledger.keepSubscription)} 未判定=${String(ledger.subscriptionUndetermined)}` +
    ` | 片 accept=${String(ledger.chunksAccepted)} drop-late=${String(ledger.chunksDroppedLate)} ` +
    `未判定=${String(ledger.chunksUndetermined)}` +
    ` | 换代重置=${String(ledger.generationResets)}` +
    ` | 报名=${String(ledger.undeterminedItems.length)}${items === '' ? '' : `(${items})`}`
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
