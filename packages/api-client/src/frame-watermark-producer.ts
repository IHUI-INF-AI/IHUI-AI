// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-13 票1 / b76-15(2026-10-29 立):帧水位**生产点** —— 网关 seq 派生的连续性判据。
 *
 * ## 立因(不是猜的,是现读出来的缺口)
 *
 * `packages/shared/src/sse/agent-events.ts::readFrameWatermark` 与它的同形移植
 * `./frame-watermark.ts::readFrameWatermark` 只认**帧载荷里**的四个水位字段
 * (`subscriptionId` / `logEpoch` / `fromSeq` / `toSeq`)。2026-10-29 全仓现读:
 *
 * - `StreamWatermark` 类只存在于 `apps/ai-service/app/core/sse_contract.py:459`,
 *   而 `apply_frame` 的调用面**只有测试**(`apps/ai-service/tests/*`、
 *   `scripts/tests/sse-stream-watermark.test.mjs`);`app/` 下零生产调用点;
 * - ai-service 的出站帧工厂 `_sse()`(`app/routers/llm.py:1317`)只写
 *   `event: …\ndata: …\n\n`,**从不写**这四个字段;第二处帧工厂
 *   `_format_sse()`(`app/routers/agents.py:1452`)只多写一行 `id:`;
 * - 网关侧的 `emitUpstreamLine` / `emitNamedEvent`
 *   (`apps/api/src/utils/sse-stream-registry.ts:328/361`)写的是
 *   `id: <seq>` + 未改动的 data 行,同样**不注入**这四个字段。
 *
 * ⇒ 消费侧 `client.ts::shouldDropByWatermark` 的 `readFrameWatermark` 恒返回
 * `{ verdict: 'undetermined' }`,`_frameGapDropped` 恒 0,`onRecoveryGateLedger`
 * 接到的账目恒空。这就是「看起来有、实际没跑」:判据写得很完整,但**没有生产点**。
 *
 * ## 本模块做什么(以及刻意不做什么)
 *
 * 网关确实**已经在下发**一条连续性事实:`id: <seq>` 行,`seq` 由单一计数器
 * (`emitUpstreamLine` 与 `emitNamedEvent` 共用 `session.seq += 1`)产出,对
 * 每一条会被缓冲的帧**严格连续 +1**。这是真事实,所以本模块从它派生
 * **`seq` 维**的连续性判据(`seq-discontinuity`)。
 *
 * 刻意**不编造**另两维:
 *
 * - `generation-change`(订阅代际 / subscriptionId):网关不产出代际标识。
 *   用 `replayKey` 之类冒充就是造假 —— 换流时 `seq` 会**从 1 重开**,那本来就会
 *   命中 `seq-discontinuity`,不需要一维假标识来"解释"它。
 * - `epoch-change`(日志纪元 / logEpoch):同样没有生产点。
 *
 * 两维缺席时本模块的结论是 `undetermined`(见 `FrameSeqVerdict`),**绝不**把
 * "另两维没判"写成"已判过"(AGENTS §0.3)。等生产端真下发代际/纪元字段,
 * `readFrameWatermark` 那条腿会自动接管 —— 届时 `frameKindOf` 给出的
 * `carriesPayloadWatermark` 为 true,本模块的 seq 腿自动让位,不产生第二份判据。
 *
 * ## 为什么不改网关注入四个字段(这条要写清,否则下一个人会顺手去做)
 *
 * 在网关给每条 data 帧注入 `fromSeq/toSeq/…` 会撞上两处**字节保真**契约:
 * `apps/api/tests/sse-stream-registry.test.ts:59/66` 逐字节断言写出内容与
 * `rawLine`(`id: 1\ndata: {"type":"0","value":"hi"}\n\n`),以及
 * `apps/api/tests/sse-replay-buffer-bytes.test.ts` 的 `replayFrameBytes` 口径。
 * 更硬的一条:`emitUpstreamLine` 喂的是**上游原始行**,载荷形状归 ai-service 的
 * SSE 契约(`_sse()`)所有;网关改写载荷就是"网关替上游改协议",而 `id:` 行
 * 本来就是传输层自己的字段 —— 派生的合法性正来自这一点。
 */

/** 单帧的 seq 判读结论。`undetermined` 是**一等结论**,不是"没问题"。 */
export type FrameSeqVerdict =
  /** 本帧没带 `id:` 行(命名帧之外的行、旧生产端、非主聊天链路) ⇒ 未判定 */
  | { readonly kind: 'undetermined'; readonly reason: string }
  /** `id:` 行在场但取不出安全整数 ⇒ 判死(不是未判定:有值而不可用是畸形) */
  | { readonly kind: 'invalid'; readonly reason: string }
  /** 本帧是第一帧(手上无游标)⇒ 立基线,不判 gap */
  | { readonly kind: 'baseline'; readonly seq: number }
  /** 与游标连续 ⇒ 可应用并推进 */
  | { readonly kind: 'continuous'; readonly seq: number }
  /** 断档:游标与本帧 seq 不衔接 ⇒ 丢弃该帧并计数(不猜、不跳过继续应用) */
  | { readonly kind: 'gap'; readonly seq: number; readonly expected: number; readonly actual: number }

/** 逐行累加器:SSE 是行流,`id:` 行与它所属的 `data:` 行必须配对,配不上就不判。 */
export interface FrameSeqTracker {
  /**
   * 喂一行(不含行尾换行)。返回该行**自身**的判读:
   * - `id:` 行 ⇒ 登记待配对 seq,返回 `undetermined`(它还没有载荷可交付);
   * - `data:` 行 ⇒ 用待配对 seq 判,判完即销号(一个 `id:` 只能认领一行);
   * - 其余字段行(`event:` / `retry:` / 注释 / 空行)⇒ `undetermined` 且**不销号**。
   *
   * 最后一条是判据不是偏好:网关的 `emitNamedEvent` 写的正是
   * `id: N\nevent: <name>\ndata: <json>\n\n`(`sse-stream-registry.ts:365`),
   * `id:` 与 `data:` 之间**隔着** `event:` 行。若把中间那行当作载荷销号,
   * 紧随的 data 行就永远认领不到 seq ⇒ 整条流恒"未判定",判据又变成哑的。
   */
  observeLine(line: string): FrameSeqVerdict
  /** 当前游标(最近一次已确立的 seq);null = 还没见过可用的 `id:` 行 */
  cursor(): number | null
}

/**
 * SSE 帧的 `id:` 行取值。只接受**非负安全整数**的十进制形态:
 * 空串 / 带空白之外的字符 / 负数 / 超安全整数 一律 invalid。
 *
 * 注意:网关的 `seq` 从 1 起(`session.seq += 1` 后才写),但本函数不从 0 起判 ——
 * "从几起"是生产端的自由,判据只要求**连续**,不要求**从 1 起**。
 */
function parseSeq(raw: string): number | null {
  const text = raw.trim()
  if (text === '') return null
  // 只认 `^[0-9]+$`:避免 `Number('0x10')` / `Number(' 1e3 ')` 这类把非十进制写法读成数
  if (!/^[0-9]+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

/**
 * 建一台逐行 seq 追踪器。无 I/O、无时钟、不持全局状态 —— 一台实例对应一条流
 * (与 `streamAuthority` 同生命周期:`streamChat` 内建,跨 attempt 保留)。
 *
 * **跨 attempt 保留是刻意的**:重连续传后服务端接着原 `seq` 继续发(`Last-Event-ID`
 * 那条腿保证了这一点),所以游标不能按 attempt 清零 —— 清零会让重连后的第一帧
 * 永远"立基线",把真实断档整批放行。真的换了流(新会话 / 新 messageId)时 `seq`
 * 从 1 重开,会命中 `gap`,`expected`/`actual` 把事实点名给上层。
 */
export function createFrameSeqTracker(): FrameSeqTracker {
  let pending: number | null = null
  let last: number | null = null

  return {
    observeLine(line: string): FrameSeqVerdict {
      if (line.startsWith('id:')) {
        const seq = parseSeq(line.slice(3))
        if (seq === null) {
          // 畸形 id 行:销号(不让它去认领下一行 data,那会把序号张冠李戴)
          pending = null
          return { kind: 'invalid', reason: 'id 行不是非负安全整数' }
        }
        pending = seq
        // 它自己不是可交付帧;结论归它认领的那一行
        return { kind: 'undetermined', reason: 'id 行,等待同帧 data 行配对' }
      }

      // 空行是 SSE 的帧分隔符;`event:` / `retry:` / `:` 注释行是**同一帧内**的
      // 其它字段行。它们都不是载荷,不参与判读,也**不销号** —— 网关的命名帧
      // 正是 `id: N\nevent: <name>\ndata: …`,在中间销号会让整条流恒未判定。
      if (!line.startsWith('data:')) {
        return { kind: 'undetermined', reason: '非载荷字段行,不承载可判读载荷' }
      }

      if (pending === null) {
        // 没有可用 seq 认领:本行按未判定放行(旧生产端 / 命名帧 event: 行 /
        // 非主聊天链路)。**不**在这里立基线 —— 没有 id 就没有连续性事实。
        return { kind: 'undetermined', reason: '本行没有可配对的 id 行' }
      }

      const seq = pending
      pending = null
      if (last === null) {
        last = seq
        return { kind: 'baseline', seq }
      }
      if (seq === last + 1) {
        last = seq
        return { kind: 'continuous', seq }
      }
      // 断档:游标不推进(推进了就等于把缺口算成"已应用",再也无法自愈)
      return { kind: 'gap', seq, expected: last + 1, actual: seq }
    },

    cursor(): number | null {
      return last
    },
  }
}

/**
 * 本帧是否携带**载荷级**水位四字段(`readFrameWatermark` 那条腿的射程)。
 *
 * 存在意义:两条腿同时在场时必须只有一份判据生效。载荷级水位在场 ⇒ 由
 * `shouldDropByWatermark` 的既有分支判(它能判三维),seq 腿让位;不在场 ⇒
 * seq 腿只判它真能判的那一维。这是"单一真相源"在**同一事实的两条来源**上的落法
 * (AGENTS §0.6),不是两份平行判据。
 */
export function carriesPayloadWatermark(frame: unknown): boolean {
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) return false
  const f = frame as Record<string, unknown>
  const has = (camel: string, snake: string): boolean =>
    f[camel] !== undefined || f[snake] !== undefined
  return (
    has('subscriptionId', 'subscription_id') &&
    has('logEpoch', 'log_epoch') &&
    has('fromSeq', 'from_seq') &&
    has('toSeq', 'to_seq')
  )
}

/** 断档事实的紧凑读法(进遥测/错误上报用;不含任何用户可见文案)。 */
export interface FrameSeqGapFact {
  readonly expected: number
  readonly actual: number
  /** 本次流内累计断档帧数(含本帧) */
  readonly dropped: number
}

/**
 * 上报给 `onFrameWatermarkFacts` 的帧水位事实(`StreamChatOptions` 的公开契约)。
 *
 * 三个字段各自回答一个**不能合并**的问题(合并就是把"没判"写成"判过"):
 * - `kind` —— 这条事实是怎么产生的:`seq-discontinuity` / `seq-invalid` /
 *   `authority-closed` / `payload-invalid` 是**丢弃**事件;`stream-end` 是终态兜底;
 * - `dropped` —— 本次流累计丢弃帧数(0 是**有效读数**,不是"未采到");
 * - `payloadWatermarkSeen` —— 载荷级四字段到底有没有到场。false 意味着
 *   `generation-change` / `epoch-change` 两维**从未被判定过**,上层不得把
 *   "没报那两维"读成"那两维没问题";
 * - `cursor` —— seq 腿当下的游标;null = 一次可用的 `id:` 行都没见过。
 */
export interface FrameWatermarkFacts {
  readonly kind: string
  readonly dropped: number
  readonly cursor: number | null
  readonly payloadWatermarkSeen: boolean
}

export const __test__ = { parseSeq }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
