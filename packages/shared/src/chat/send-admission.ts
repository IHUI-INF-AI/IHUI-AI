// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对标 Qoder 借鉴清单第 9 项:发送准入回执配对(inputId)+ disposition。
 *
 * ## 在修什么
 * web 发送是 **optimistic 上屏**:用户消息先本地落 store,`setStreaming(true)` 紧随其后。
 * 此时屏幕上那条消息只证明"我按下发送了",**不证明服务端收下了这一轮**。弱网 / 网关
 * 中途失败 / 服务端 4xx 静默丢弃时,界面与事实分叉,而两者长得一模一样 —— 这就是
 * "假成功"。
 *
 * 已有机制不重叠,别合并:``pending-send.ts`` 的 `commandIdOf` 是**发送前**的重复提交闸
 * (会话 + 正文指纹,语义"上一次可能真发成功了但界面没告诉我");本模块是**发送后**的
 * 回执配对(语义"这一次服务端到底收下了没有")。前者拦第二次点击,后者定性第一次。
 *
 * ## 三条纪律
 * 1. **回执必须带同一个 inputId**:服务端在流开始时回一帧携带客户端生成的 `inputId`
 *    与 disposition。`inputId` 不符 ⇒ `matched:false`,**绝不**把别人的回执当成本条的确认
 *    (Qoder 同名错误码 `..._INPUT_ADMISSION_RESULT_MISMATCH` 的语义)。
 * 2. **失效方向恒为"未确认"**:回执缺席、形状不认、会话断在半路 —— 一律落
 *    `tentative` / `unconfirmed`,**不得**冒充 `admitted`。"没判"不写成"判过"。
 * 3. **`rejected` / `duplicate` 是终态**:`duplicate` 表示服务端已受理过同一 inputId
 *    (副作用已发生),此时重发就是真的重复副作用 ⇒ 该档禁止触发重发;`rejected` 同理
 *    不得被后续隐式证据洗白。
 *
 * ## 与 wire 契约的关系(必读,别把本文件当已接线)
 * 事件名常量 `SSE_ADMISSION_EVENT` 与载荷形状在本文件**只作声明**,**尚未**注册进
 * `packages/shared/src/sse/contract.ts` 的 `SSE_EVENTS` 与 Python 镜像
 * `apps/ai-service/app/core/sse_contract.py` 的 `SSE_EVENTS`(那两份文件的改动属并行
 * 工作流面)。因此:
 * - 服务端**当前不产出**该帧 ⇒ 线上每条消息都停在隐式证据档;
 * - 解析层不会把该帧分派进来 ⇒ `accept()` 的调用方目前只能来自测试或未来的接线;
 * - 接线需同批改两处契约 + `apps/api` 网关 schema + `api-client` 分派,**四件缺一不可**。
 * 在完成之前,本模块的价值是:隐式证据档能把"发出去了"与"服务端收下了"在数据上分开,
 * 而不是让两者共用同一个布尔。
 */

/** 准入回执的 wire 事件名(声明用;见头注「与 wire 契约的关系」)。 */
export const SSE_ADMISSION_EVENT = 'admission' as const

/**
 * 处置决定四档。覆盖"服务端拿到这条输入之后做了什么"的全部结局:
 * - `accepted`:已收下,本轮立即执行;
 * - `queued`:已收下,但排在队尾等前一轮结束(Qoder 的 `queuedTurnId` 即此档);
 * - `rejected`:明确拒收(权限 / 参数 / 额度),本轮不会产生任何内容;
 * - `duplicate`:同一 inputId 之前已受理过 —— 本次是幂等重放,**副作用已发生**。
 */
export const ADMISSION_DISPOSITIONS = ['accepted', 'queued', 'rejected', 'duplicate'] as const
export type AdmissionDisposition = (typeof ADMISSION_DISPOSITIONS)[number]

/** 表外取值一律 false(未知档不得被当成任何已知档,与 §0.3 同纪律)。 */
export function isAdmissionDisposition(value: unknown): value is AdmissionDisposition {
  return typeof value === 'string' && (ADMISSION_DISPOSITIONS as readonly string[]).includes(value)
}

/**
 * 准入回执载荷(服务端 → 客户端)。
 *
 * 只有 `inputId` + `disposition` 是必需的:其余字段缺席时读作"服务端没说明",
 * **不得**据此编造(尤其 `queuedTurnId` 缺席不等于"没排队")。
 */
export interface SendAdmissionReceipt {
  /** 客户端生成的稳定输入标识,必须与本条发送时带的那个逐字相等 */
  readonly inputId: string
  readonly disposition: AdmissionDisposition
  /** 服务端为这一轮分配的助手消息 id(与本条乐观占位可能不同,故单列) */
  readonly messageId?: string
  /** `queued` 档专用:排队项标识,供队列面板后续插队 / 撤回 */
  readonly queuedTurnId?: string
  /** 拒收原因码(命名错误码,与 stream-error-disposition 同一套码表) */
  readonly reason?: string
}

/**
 * 从任意帧载荷里读回执。形状不认 ⇒ `null`(**不猜、不补默认档**):
 * 把形状坏的帧读成 `accepted` 等于用一次解析失败伪造"服务端收下了"。
 */
export function readSendAdmissionReceipt(raw: unknown): SendAdmissionReceipt | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = raw as Record<string, unknown>
  const inputId = v['inputId']
  const disposition = v['disposition']
  if (typeof inputId !== 'string' || inputId.length === 0) return null
  if (!isAdmissionDisposition(disposition)) return null

  const receipt: {
    inputId: string
    disposition: AdmissionDisposition
    messageId?: string
    queuedTurnId?: string
    reason?: string
  } = { inputId, disposition }
  const messageId = v['messageId']
  if (typeof messageId === 'string' && messageId.length > 0) receipt.messageId = messageId
  const queuedTurnId = v['queuedTurnId']
  if (typeof queuedTurnId === 'string' && queuedTurnId.length > 0) receipt.queuedTurnId = queuedTurnId
  const reason = v['reason']
  if (typeof reason === 'string' && reason.length > 0) receipt.reason = reason
  return receipt
}

/**
 * 客户端生成的稳定输入标识。
 *
 * 优先 `crypto.randomUUID()`(浏览器与 Node 18+ 都有);取不到或抛错时退到
 * 时间戳 + 随机后缀 —— 退化值同样**只在本轮内唯一**,配对语义不依赖全局强度。
 * 不用 `Math.random()` 单独成 id:同一毫秒内连发两条会撞,而撞的方向是"把别人的回执
 * 认成自己的",正是本模块要防的那一格。
 */
export function createInputId(): string {
  const holder = globalThis as { crypto?: { randomUUID?: () => string } }
  const fn = holder.crypto?.randomUUID
  if (typeof fn === 'function') {
    try {
      return fn.call(holder.crypto)
    } catch {
      // 退化,不向上抛:发送链不能因为取 id 失败而中断
    }
  }
  const stamp = Date.now().toString(36)
  const noise = Math.random().toString(36).slice(2, 10)
  const seq = (ID_SEQ += 1).toString(36)
  return `in-${stamp}-${noise}-${seq}`
}

/** 退化路径的进程内自增,保证同毫秒同随机源也不撞 */
let ID_SEQ = 0

/** 隐式准入证据:不是服务端回执,但**能证明**这一轮真的开始了。 */
export type AdmissionEvidence =
  /** 响应头已到(流已建立 ⇒ 网关已受理) */
  | 'stream-open'
  /** 收到任意正文 / 推理增量 ⇒ 上游模型已在产出 */
  | 'delta'
  /** 收到流尾 `done` ⇒ 整轮已跑完 */
  | 'done'

/**
 * 消息侧的呈现态。与 `AdmissionDisposition` **不是同一套词**,别互换:
 * - `tentative`:发出去了,服务端还没给任何证据(乐观上屏的默认档);
 * - `admitted`:`accepted` 回执,或有隐式证据证明本轮真的开始了;
 * - `queued`:`queued` 回执(已收下但排在队尾,**不是**"正在回答");
 * - `rejected`:`rejected` 回执(终态);
 * - `unconfirmed`:本轮已收场(失败 / 主动停止),而始终没拿到任何准入证据 ——
 *   这一档存在的意义是**不让它冒充 admitted**,用户据此知道"这条可能没送到"。
 */
export const ADMISSION_PHASES = [
  'tentative',
  'admitted',
  'queued',
  'rejected',
  'unconfirmed',
] as const
export type AdmissionPhase = (typeof ADMISSION_PHASES)[number]

/** 一次判定的结果(`changed:false` 供渲染层跳过无谓写盘,与 store 的等价即不写同取向)。 */
export interface AdmissionResolution {
  /** 回执的 inputId 是否与本条一致。`false` ⇒ 这条回执不属于本轮,phase 不变 */
  readonly matched: boolean
  readonly phase: AdmissionPhase
  /** 相对上一次判定是否发生了状态迁移 */
  readonly changed: boolean
  readonly receipt?: SendAdmissionReceipt
}

/** 本轮收场方式(`settle` 入参) */
export type AdmissionOutcome =
  /** 拿到了回答(有正文 ⇒ 服务端必然收下过) */
  | 'answered'
  /** 以错误收场 */
  | 'failed'
  /** 用户主动停止 */
  | 'aborted'

export interface SendAdmissionTracker {
  readonly inputId: string
  readonly messageId: string
  /** 当前档(只读快照;每次判定后更新) */
  readonly phase: AdmissionPhase
  /** 当前判定结果(不改变状态,供渲染层随时读) */
  read(): AdmissionResolution
  /** 记一次隐式证据 */
  noteEvidence(evidence: AdmissionEvidence): AdmissionResolution
  /** 收一帧回执(形状不认 / inputId 不符都返回 matched:false 且不改状态) */
  accept(rawReceipt: unknown): AdmissionResolution
  /** 收场结算 */
  settle(outcome: AdmissionOutcome): AdmissionResolution
  /** 落消息 `meta` 的补丁(端上 `updateMessageMeta(messageId, patch)` 直接用) */
  metaPatch(): Record<string, unknown>
}

/** 终态:一旦落下,隐式证据与后续收场都不得改动它(见头注纪律 3)。 */
const TERMINAL_PHASES: ReadonlySet<AdmissionPhase> = new Set<AdmissionPhase>(['rejected'])

export function createSendAdmissionTracker(input: {
  inputId: string
  messageId: string
}): SendAdmissionTracker {
  const inputId = input.inputId
  const messageId = input.messageId
  let phase: AdmissionPhase = 'tentative'
  let receipt: SendAdmissionReceipt | undefined

  /**
   * 迁移的唯一出口。返回值 `changed` 是"这次真的变了",不是"这次调用过" ——
   * 渲染层靠它决定要不要写盘,写错方向会让高频证据帧把 store 打成每帧一次重渲。
   */
  const move = (next: AdmissionPhase, matched: boolean, nextReceipt?: SendAdmissionReceipt): AdmissionResolution => {
    const changed = next !== phase
    if (changed) phase = next
    if (nextReceipt) receipt = nextReceipt
    const resolution: AdmissionResolution = { matched, phase, changed }
    return receipt ? { ...resolution, receipt } : resolution
  }

  const tracker: SendAdmissionTracker = {
    inputId,
    messageId,
    get phase() {
      return phase
    },

    read() {
      const resolution: AdmissionResolution = { matched: true, phase, changed: false }
      return receipt ? { ...resolution, receipt } : resolution
    },

    noteEvidence() {
      // 终态与已确认档都不许被证据改写:证据只能"往上抬",不能把 queued 洗成 admitted,
      // 更不能把 rejected 洗白(洗白 = 用一条流证明一个明确被拒的请求成功了)。
      if (TERMINAL_PHASES.has(phase) || phase !== 'tentative') return tracker.read()
      return move('admitted', true)
    },

    accept(rawReceipt) {
      const parsed = readSendAdmissionReceipt(rawReceipt)
      // 形状不认 ⇒ 未判定。既不记绿也不冒红,更不动 phase。
      if (!parsed) return { matched: false, phase, changed: false }
      // 不是本轮的收据。这一格是 Qoder 那条 MISMATCH 的落点:宁可保持 tentative。
      if (parsed.inputId !== inputId) return { matched: false, phase, changed: false }
      // 本轮已有结论时,后来的同 id 回执不得覆盖(顺序抖动不得改写定论)
      if (phase === 'admitted' && parsed.disposition === 'accepted') {
        return move('admitted', true, parsed)
      }
      if (TERMINAL_PHASES.has(phase)) return { matched: true, phase, changed: false }

      switch (parsed.disposition) {
        case 'accepted':
          return move('admitted', true, parsed)
        case 'queued':
          return move('queued', true, parsed)
        case 'rejected':
          return move('rejected', true, parsed)
        case 'duplicate':
          // 幂等重放:服务端早已受理 ⇒ 对用户而言是"已收下",但**不得**据此再发一次。
          return move('admitted', true, parsed)
      }
    },

    settle(outcome) {
      if (TERMINAL_PHASES.has(phase)) return tracker.read()
      // 已确认收下 ⇒ 收场不改变归属(答没答完是另一维,不归准入管)
      if (phase === 'admitted' || phase === 'queued') return tracker.read()
      // 有回答 = 最强证据:服务端必然收下过
      if (outcome === 'answered') return move('admitted', true)
      // 失败 / 主动停止 且始终零证据 ⇒ 未确认(不是"没送到",是"不知道送没送到")
      return move('unconfirmed', true)
    },

    metaPatch() {
      const patch: Record<string, unknown> = {
        admission: {
          inputId,
          phase,
          ...(receipt ? { disposition: receipt.disposition } : {}),
          ...(receipt?.queuedTurnId ? { queuedTurnId: receipt.queuedTurnId } : {}),
          ...(receipt?.reason ? { reason: receipt.reason } : {}),
        },
      }
      return patch
    },
  }
  return tracker
}

/**
 * 从消息 `meta` 读回已落盘的准入档(刷新 / 回放后重建呈现态用)。
 * 读不到或不认 ⇒ `null`(**不回落 `tentative`**):老消息根本没有这一格,
 * 把它读成"未确认"等于给历史每条消息加一个不存在的告警。
 */
export function readAdmissionPhaseFromMeta(meta: Record<string, unknown> | undefined): AdmissionPhase | null {
  if (!meta) return null
  const admission = meta['admission']
  if (typeof admission !== 'object' || admission === null) return null
  const phase = (admission as Record<string, unknown>)['phase']
  return typeof phase === 'string' && (ADMISSION_PHASES as readonly string[]).includes(phase)
    ? (phase as AdmissionPhase)
    : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
