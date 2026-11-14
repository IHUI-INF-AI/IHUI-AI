// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 会话更新流的消息身份一致性 + 稳定指纹。
 *
 * ## 解决什么问题
 *
 * 流式会话里,同一条消息会被切成很多帧(agent_message_chunk / agent_thought_chunk /
 * user_message_chunk)推给客户端。客户端按 `messageId` 把它们拼回一条消息。
 *
 * 如果**同一个 messageId 既出现为 assistant 文本、又出现为 user 文本**,
 * 客户端会把两种内容拼进同一条消息 —— 结果是用户看到自己的话混在 AI 回复里,
 * 或者 thinking 混进正文。这在重连/重放/并发写入时都可能发生。
 *
 * 对标依据:`@genie/agent-harness` 的 `lib/subagent/journal.js` 里
 * `assertMessageIdentity(e, t)` 就是这么做的 —— 它维护 `messageId → updateType`
 * 的映射,一旦同一个 id 换了 updateType 就抛 `internalError`,
 * 报错文案明确写 "… crosses X and Y"。
 *
 * ## 另两个可复用点
 *
 * ① **canonicalJson** —— 对象键排序、剔除 undefined 值后再序列化。
 *    用它算"两条消息是否真的相同"才稳定:同一份内容经不同路径构造出来,
 *    键顺序可能不同,`JSON.stringify` 直接比会误判为不同。
 *
 * ② **journal 字节上限** —— 重放日志必须封顶,否则一个长会话能把内存吃光。
 *    对标实现用了四档常量(4096 / 8MB / 2048 / 128MB),分别对应
 *    "单条通知上限 / 总量上限 / 附件帧数上限 / 附件总量上限"。
 *    本模块用同口径的常量,并**在超限时抛结构化错误而不是静默截断** ——
 *    静默截断会让客户端看到"少了半条消息"而不知道发生了什么。
 */

/** 一帧会话更新的身份声明。 */
export interface MessageFrame {
  readonly sessionId: string
  readonly messageId: string
  /** 归一后的更新类型(见 `normalizeUpdateType`)。 */
  readonly updateType: string
}

/** 原始帧(AcpSessionUpdate 子集)。 */
export interface RawUpdateFrame {
  readonly sessionId: string
  readonly update: {
    readonly sessionUpdate?: string
    readonly messageId?: string
    readonly [k: string]: unknown
  }
}

export class MessageIdentityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MessageIdentityError'
  }
}

export class JournalOverflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JournalOverflowError'
  }
}

/**
 * 三个 chunk 型更新 → 它们归属的消息角色。
 *
 * 为什么要归一:同一条消息既可能以 chunk 型帧(`agent_message_chunk`)到达,
 * 也可能以已定型的角色帧(`agent_message`)到达,不归一到角色就无法比对。
 * 归一后同一 messageId 必须始终是同一角色:正文与 thinking 是**不同角色**,
 * 共用同一 id 会被判冲突(thought 混进正文是错的);agent 与 user 交叉同理。
 */
const CHUNK_TO_ROLE: Readonly<Record<string, string>> = {
  agent_message_chunk: 'agent_message',
  agent_thought_chunk: 'agent_thought',
  user_message_chunk: 'user_message',
}

const KNOWN_ROLES = new Set(['agent_message', 'agent_thought', 'user_message'])

/**
 * 归一更新类型。
 *
 * 已经是角色名(说明对端直传)⇒ 原样返回;是 chunk 名 ⇒ 映射成角色;
 * 其它类型(工具调用、计划更新等)⇒ 返回 undefined,表示"这一帧不参与身份判定"
 * —— 它们本来就没有 messageId 契约,拉进来判会误报。
 */
export function normalizeUpdateType(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const mapped = CHUNK_TO_ROLE[raw]
  if (mapped) return mapped
  if (KNOWN_ROLES.has(raw)) return raw
  return undefined
}

/**
 * 从原始帧抽身份。缺 messageId 的 chunk 帧 ⇒ 抛错。
 *
 * 为什么缺 messageId 要报错而不是跳过:没有 id 就无法在客户端拼回原消息,
 * 那一帧会被静默丢弃 —— 用户看到的是"回复少了半段"。宁可报错让人发现。
 */
export function messageIdentityOf(
  frame: RawUpdateFrame,
  options: { requireMessageId?: boolean } = {},
): MessageFrame | undefined {
  const raw = frame.update.sessionUpdate
  const role = normalizeUpdateType(raw)
  if (role === undefined) return undefined

  const messageId = frame.update.messageId
  const hasId = typeof messageId === 'string' && messageId.trim() !== ''

  if (!hasId) {
    // 缺 id 分两种:
    //   · 流式 chunk(有 id 才有"同一条消息的多个片段"概念)⇒ 严格模式下报错;
    //   · 一次性展示帧(如 Plan 全文、系统提示)⇒ 本来就没有 id,合法。
    // 默认宽松(不报错),因为本仓现存的展示帧确实都不带 id;
    // 需要严格保证"每条流式更新都可拼回原消息"的调用方自行开 requireMessageId。
    if (options.requireMessageId === true) {
      throw new MessageIdentityError(`ACP v2 ${String(raw)} 缺少 messageId`)
    }
    return undefined
  }
  return { sessionId: frame.sessionId, messageId, updateType: role }
}

/** 身份映射:同一会话同一 messageId 只能有一个角色。 */
export class MessageIdentityTracker {
  private readonly seen = new Map<string, string>()

  /**
   * 记录一帧;若同一 (sessionId, messageId) 换了角色 ⇒ 抛错。
   *
   * 用组合键 `sessionId\0messageId` 而不是只 messageId:不同会话里
   * 同名 messageId 是合法的(各自独立的命名空间)。
   */
  assertAndRecord(frame: MessageFrame): void {
    const key = `${frame.sessionId}\u0000${frame.messageId}`
    const prev = this.seen.get(key)
    if (prev !== undefined && prev !== frame.updateType) {
      throw new MessageIdentityError(
        `ACP v2 messageId ${JSON.stringify(frame.messageId)} 在会话 ${JSON.stringify(frame.sessionId)} 中跨类型:${prev} 与 ${frame.updateType}`,
      )
    }
    this.seen.set(key, frame.updateType)
  }

  /** 该消息已记录的角色;未见过返回 undefined。 */
  roleOf(sessionId: string, messageId: string): string | undefined {
    return this.seen.get(`${sessionId}\u0000${messageId}`)
  }

  get size(): number {
    return this.seen.size
  }

  clear(): void {
    this.seen.clear()
  }
}

/**
 * 稳定序列化:对象键排序、剔除 undefined 值。
 *
 * 与对标实现的 `canonicalJson` 同义。用途:算内容指纹、写重放日志、
 * 做幂等去重 —— 任何"同一份内容必须得到同一个字符串"的场合。
 *
 * 注意数组**保持原序**(顺序是语义的一部分),只对对象键排序。
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
  }
  const s = JSON.stringify(value)
  return s === undefined ? 'null' : s
}

/** 一帧的字节数(UTF-8)。 */
export function frameBytes(frame: unknown): number {
  return Buffer.byteLength(JSON.stringify(frame) ?? 'null', 'utf8')
}

/**
 * 日志上限四档(与对标实现同口径)。
 *
 * 分开四档而不是一个总数,是因为超限的四种原因需要不同处置:
 *   · `maxFrameBytes` 超 ⇒ 单帧畸形(通常是 bug),应报错而不是截断;
 *   · `maxTotalBytes` 超 ⇒ 会话太长,应落盘分片;
 *   · `maxAttachmentFrames` / `maxAttachmentBytes` 超 ⇒ 附件太多,应转存。
 */
export const JOURNAL_LIMITS = Object.freeze({
  /** 单条通知上限 4 KB。 */
  maxFrameBytes: 4096,
  /** 日志总量上限 8 MB。 */
  maxTotalBytes: 8 * 1024 * 1024,
  /** 附件帧数上限 2048。 */
  maxAttachmentFrames: 2048,
  /** 附件总量上限 128 MB。 */
  maxAttachmentBytes: 128 * 1024 * 1024,
})

/** 累计帧字节数。 */
export function totalBytes(frames: readonly unknown[]): number {
  return frames.reduce<number>((n, f) => n + frameBytes(f), 0)
}

/**
 * 断言一帧不超单帧上限。超了抛错(不截断)。
 *
 * 截断一帧 JSON 会产生**结构损坏**的载荷,客户端解析会失败且无法归因;
 * 报错至少能说清"这一帧太大了"。
 */
export function assertFrameWithinLimit(frame: unknown, label = 'frame'): void {
  const bytes = frameBytes(frame)
  if (bytes > JOURNAL_LIMITS.maxFrameBytes) {
    throw new JournalOverflowError(
      `${label} 超过单帧上限:${bytes} > ${JOURNAL_LIMITS.maxFrameBytes} 字节`,
    )
  }
}

/** 断言累计不超总量上限。 */
export function assertTotalWithinLimit(frames: readonly unknown[], label = 'journal'): void {
  const bytes = totalBytes(frames)
  if (bytes > JOURNAL_LIMITS.maxTotalBytes) {
    throw new JournalOverflowError(
      `${label} 超过总量上限:${bytes} > ${JOURNAL_LIMITS.maxTotalBytes} 字节`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
