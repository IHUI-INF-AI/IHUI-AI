// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 活跃流会话注册表(#22,api 网关层,零 ai-service 行为变化)。
 *
 * 与 sse-replay-buffer.ts(已发送事件缓冲)配套:本文件管理「正在进行中」的上游流,
 * 支撑 Last-Event-ID 标准重放的三条路径:
 *
 * 1. 接管(核心):客户端断线后 15s 宽限窗口内重连(POST + Last-Event-ID 头),
 *    新连接先重放 buffer 中缺失段(id > Last-Event-ID),再无缝接续正在生成的上游流。
 * 2. 重放兜底:宽限期已过(上游被 abort)但缓冲仍在 60s 保留窗口,
 *    重连时仅重放缺失段后结束(内容补齐,尾部由前端既有 dedupe 前缀续写降级处理)。
 * 3. 降级:缓冲也过期/未知 key → 走原有重新生成路径,前端 receivedContent
 *    前缀匹配 dedupe 降级保留(与重连改造前行为一致)。
 *
 * 保序说明:接管为同步单 tick 操作(取缺失段 + 换绑),期间原转发循环必然挂起在
 * await reader.read() 上,不存在并发写入窗口;断线期间上游新事件不再直写客户端
 * (已断连,写入丢弃),但均已进 replay buffer,重连时经缺失段重放找回。
 *
 * 两层架构(2026-09-19 立,多副本就绪):本文件为连接绑定层,持 raw socket /
 * AbortController / 宽限定时器等不可序列化资源,永远留在本进程;可序列化状态
 * (回放帧旁路复制 / 会话元数据 / abort 广播)委托 sse-state-store.ts 状态层,
 * 由 config.SSE_REGISTRY_BACKEND 选择 memory|redis(默认 memory,行为与单副本
 * 改造前完全一致)。同副本热路径读(takeover/getReplayEvents)仍直读本地镜像
 * (sse-replay-buffer)保证同步零延迟;跨副本异步读由状态层 fetch* 方法提供。
 *
 * G-714(2026-10-05 立)生产侧接线:本层是 SSE 的**发送路径**,字节水位的两条放弃
 * 条件必须在这里同步判定才有意义(缓冲自己看不到 socket 的真实状态)。每帧写完后
 * 做三件事 —— ① 把 socket 写队列实测长度报给缓冲(未确认字节维);② 读窗口状态,
 * 饱和则让上游读循环经 waitForReplayHeadroom 暂停 drain(④ 边沿触发);③ 一旦窗口
 * 被显式放弃,写一帧「窗口已放弃、请全量重取」的协议动作并用单向闩保证只写一次,
 * 此后本会话不再往已死的窗口里追加帧(继续堆只会在重连时被读成"完整的尾巴")。
 */

import type { FastifyReply } from 'fastify'
import {
  getEventsAfter,
  getReplayWindowStatus,
  REPLAY_UNACKED_GRACE_MS,
  reportReplayPendingBytes,
  takeSaturationEdge,
  type ReplayEvent,
  type ReplayWindowStatus,
} from './sse-replay-buffer.js'
import { getSseStateStore, SSE_REPLICA_ID } from './sse-state-store.js'

/** 断线宽限期:此窗口内上游继续生成等重连接管,超时才 abort(省 token 与上游资源)。 */
export const SSE_GRACE_PERIOD_MS = 15_000

export interface StreamSession {
  /** replayKey = `${conversationId}:${messageId}`;null = 不启用编号/缓冲(原样透传) */
  replayKey: string | null
  /** Steer(2026-09-19 立):网关为本流预生成的会话 ID(uuid),随请求体
   *  streamSessionId 字段下发到 ai-service(优先于其 workspace_context 自生成 id)。
   *  POST /chat/steer 端点凭 replayKey 找回 session 后取此 ID,拼出
   *  ai-service `/llm/complete/stream/{session_id}/steer` 转发地址。
   *  null = 本流未启用 steer(非主聊天链路或缺 metadata 的降级流)。 */
  upstreamSessionId: string | null
  /** 中止上游 ai-service fetch(宽限期超时/服务端超时/正常完成清理) */
  controller: AbortController
  /** 自增序号,写入 SSE `id:` 行;客户端 Last-Event-ID 即此值 */
  seq: number
  /** 当前客户端连接(hijack 后的 ServerResponse);断线时置 null(写入丢弃) */
  raw: FastifyReply['raw'] | null
  graceTimer: ReturnType<typeof setTimeout> | null
  finished: boolean
  /**
   * G-714 ③ 单向闩:本会话的重放窗口已被显式放弃(告知帧已写出)。
   * 置位后:不再往窗口里追加帧、也不再重复写告知帧。新 session(createSession)才归零。
   */
  replayAbandoned: boolean
  /** G-714 ④:上一次观测到的饱和态(边沿只在翻转时被消费一次)。 */
  replaySaturated: boolean
}

const sessions = new Map<string, StreamSession>()

/** 实际写出:有连接直写;断线/已结束丢弃(事件已在 replay buffer,可经重放找回)。 */
function write(session: StreamSession, str: string): void {
  if (session.raw) session.raw.write(str)
}

/**
 * 在途未确认字节的**实测**口径:`reply.raw.writableLength` —— Node socket 写队列里
 * 尚未被对端消费的字节数。断线(session.raw 已置 null)时这一帧根本没写出去,
 * 谈不上"未确认"⇒ 0(那一路的压力体现在窗口字节维度,由缓冲自己计量)。
 * 桩对象/旧连接没有该属性时按 0 处理,不猜值。
 */
function pendingBytesOf(session: StreamSession): number {
  const raw = session.raw
  if (!raw) return 0
  const len = (raw as unknown as { writableLength?: unknown }).writableLength
  return typeof len === 'number' && Number.isFinite(len) && len > 0 ? Math.trunc(len) : 0
}

/**
 * G-714 ③:放弃是**显式协议动作** —— 写一帧告知「窗口已放弃、请全量重取」,
 * 恢复语义由既有路径承接:重连带 Last-Event-ID ⇒ 放弃态下 complete 恒 false
 * ⇒ 路由走 replay-window-* 降级分支做全量重新生成(= 不带 Last-Event-ID 从头订阅)。
 *
 * 只写一次(session.replayAbandoned 单向闩);不编号、不进已死的窗口 ——
 * 把告知帧塞进放弃后的缓冲,等于下一轮重放时继续冒充完整。
 *
 * 字段口径注意:载荷**不带 content / delta / text / sessionId** —— 共享解析器
 * packages/shared/src/utils/sse-parse.ts 尾部有泛化兜底,带上就会被折成 chunk/meta,
 * 把协议帧喷成正文(该文件已为此记过 D19-A1 / D113 / D151 三次)。与网关既有的
 * {type:'cancelled'} 同类:网关发帧,端侧认领属另一票(契约在飞,见交付说明)。
 */
function announceReplayAbandonment(session: StreamSession, status: ReplayWindowStatus): void {
  if (session.replayAbandoned) return
  session.replayAbandoned = true
  session.replaySaturated = false
  const payload = {
    type: 'replay-window-abandoned',
    reason: status.abandonReason,
    action: 'resubscribe-from-beginning',
    message: '重放窗口已放弃,请全量重取(不带 Last-Event-ID 重新订阅)',
    unackedBytes: status.unackedBytes,
    windowBytes: status.windowBytes,
    droppedCount: status.droppedCount,
    lowestId: status.lowestId,
  }
  try {
    write(session, `data: ${JSON.stringify(payload)}\n\n`)
    console.warn(
      `[sse-stream-registry] 重放窗口已放弃(reason=${String(status.abandonReason)}),` +
        `已告知客户端全量重取: ${session.replayKey ?? ''}`,
    )
  } catch {
    /* 告知帧写出失败不阻塞:闩已置,重连侧 complete:false 仍兜住"不许冒充完整" */
  }
}

/**
 * 一帧进缓冲 + 发送路径内的同步压力处置(G-714 ①②③④)。
 *
 * 顺序钉死:先 append(缓冲按 replayFrameBytes 现算窗口字节)→ 再报实测在途字节
 * (判①未确认字节越界、②宽限窗越界)→ 再读窗口状态(时间维在此才可被发现)。
 * 放弃态下后续帧一律不进缓冲;饱和边沿只在状态真的翻转时被消费一次(来回抖动不重复通知)。
 */
function acceptReplayEvent(session: StreamSession, event: ReplayEvent): void {
  const key = session.replayKey
  if (!key || session.replayAbandoned) return
  getSseStateStore().appendReplayEvent(key, event)
  reportReplayPendingBytes(key, pendingBytesOf(session))
  const status = getReplayWindowStatus(key, session.seq)
  if (status.saturated !== session.replaySaturated) {
    takeSaturationEdge(key) // 消费这一条边沿:同一条边上层只看到一次
    session.replaySaturated = status.saturated
  }
  if (status.abandoned) announceReplayAbandonment(session, status)
}

/** 等 socket 'drain'(或 error/close/宽限窗超时)一次;监听器用完即摘,不留悬挂。 */
function waitForSocketDrain(raw: FastifyReply['raw']): Promise<void> {
  return new Promise<void>((resolvePromise) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      raw.off('drain', finish)
      raw.off('error', finish)
      raw.off('close', finish)
      resolvePromise()
    }
    const timer = setTimeout(finish, REPLAY_UNACKED_GRACE_MS)
    raw.on('drain', finish)
    raw.on('error', finish)
    raw.on('close', finish)
  })
}

/**
 * G-714 ④「饱和即暂停 drain」的闸:上游读循环每处理完一个 chunk 后 await 本函数。
 *
 * - 无 replayKey / 已放弃 / 无连接(断线时事件只进缓冲,不占 socket)/ 未饱和 ⇒ 立即放行。
 * - 饱和 ⇒ 挂起等 socket 'drain'(对端把写队列消费掉),最长等 REPLAY_UNACKED_GRACE_MS;
 *   醒来先按实测 writableLength 复核一次未确认字节(drain 之后不复核就会一直挂着饱和),
 *   超时**不**主动 abort 上游 —— 时间维(②)由下一次状态读取落放弃闩并照发告知帧。
 * 返回 'abandoned' 表示窗口已被显式放弃(告知帧已写出),调用方应停止继续透传。
 */
export async function waitForReplayHeadroom(
  session: StreamSession,
): Promise<'clear' | 'abandoned'> {
  const key = session.replayKey
  if (!key) return 'clear'
  if (session.replayAbandoned) return 'abandoned'
  const before = getReplayWindowStatus(key, session.seq)
  if (before.abandoned) {
    announceReplayAbandonment(session, before)
    return 'abandoned'
  }
  if (!session.raw || !before.saturated) return 'clear'
  takeSaturationEdge(key) // 这一条进入边沿由本闸消费(读即清)
  await waitForSocketDrain(session.raw)
  const raw = session.raw
  if (raw) reportReplayPendingBytes(key, pendingBytesOf(session))
  const after = getReplayWindowStatus(key, session.seq)
  if (after.abandoned) {
    announceReplayAbandonment(session, after)
    return 'abandoned'
  }
  if (after.saturated !== session.replaySaturated) {
    takeSaturationEdge(key)
    session.replaySaturated = after.saturated
  }
  return 'clear'
}

/**
 * 创建流会话并开始缓冲。同 replayKey 若有旧 session(防御:前端禁同 messageId 并发双发)
 * 立即 abort,保证单上游单消费者。
 */
export function createSession(
  raw: FastifyReply['raw'],
  controller: AbortController,
  replayKey: string | null,
  /** Steer(2026-09-19 立):随请求体 streamSessionId 下发的预生成 ID,默认 null */
  upstreamSessionId: string | null = null,
): StreamSession {
  const session: StreamSession = {
    replayKey,
    upstreamSessionId,
    controller,
    seq: 0,
    raw,
    graceTimer: null,
    finished: false,
    replayAbandoned: false,
    replaySaturated: false,
  }
  if (replayKey) {
    const old = sessions.get(replayKey)
    if (old && !old.finished) old.controller.abort()
    sessions.set(replayKey, session)
    const store = getSseStateStore()
    store.registerStream(replayKey) // 清旧缓冲 + 取消其待释放定时器(redis 下远端 DEL)
    // 跨副本可见的会话元数据(归属副本 + 上游会话 ID,steer 转发等场景)
    store.upsertSessionMeta({
      replayKey,
      replicaId: SSE_REPLICA_ID,
      upstreamSessionId,
      createdAt: Date.now(),
    })
  }
  return session
}

/**
 * 客户端连接断开:进入宽限期而非立即 abort 上游(行为变化点,#22 核心)。
 * 宽限期内重连可接管;超时才 abort 上游并安排缓冲释放(60s 供 Last-Event-ID 重放)。
 */
export function detachOnClose(session: StreamSession): void {
  if (session.finished) return
  session.raw = null
  const key = session.replayKey
  if (!key) {
    // 无缓冲能力(缺 metadata):保持原行为,断线立即 abort
    session.controller.abort()
    return
  }
  if (session.graceTimer) return
  session.graceTimer = setTimeout(() => {
    session.graceTimer = null
    if (session.finished) return
    session.controller.abort()
    getSseStateStore().releaseStream(key)
  }, SSE_GRACE_PERIOD_MS)
}

/**
 * 接管:取消宽限定时器 → 取缺失段(rawLine 已含 `data: ` 前缀,不含换行)
 * → 换绑新连接。同步单 tick 完成,返回后由调用方先写 missed,原循环继续实时写新连接。
 */
export function takeoverStream(
  session: StreamSession,
  lastSeq: number,
  raw: FastifyReply['raw'],
): ReplayEvent[] {
  if (session.graceTimer) {
    clearTimeout(session.graceTimer)
    session.graceTimer = null
  }
  // 同副本热路径:直读本地镜像(同步零延迟;跨副本异步读走状态层 fetchReplayEvents)
  const missed = session.replayKey ? getEventsAfter(session.replayKey, lastSeq) : []
  session.raw = raw
  // G-714:接管即"客户端已确认到 lastSeq" —— 换绑后必须按**新**连接重测在途字节。
  // 不重报的话,旧连接遗留的写队列长度会被读成"仍未确认",宽限窗一到就把一条
  // 已经追回来的连接误判成放弃(放弃是终态,误判一次的代价是整轮重新生成)。
  if (session.replayKey) reportReplayPendingBytes(session.replayKey, pendingBytesOf(session))
  return missed
}

/** 取回放缓冲中 id > lastSeq 的事件(replay-only 兜底路径)。 */
export function getReplayEvents(replayKey: string, lastSeq: number): ReplayEvent[] {
  return getEventsAfter(replayKey, lastSeq)
}

/** 查找进行中的会话(接管路径入口)。 */
export function findSession(replayKey: string): StreamSession | undefined {
  return sessions.get(replayKey)
}

/** 流结束:清理会话与宽限定时器,缓冲保留 60s 供重连重放尾部。 */
export function finishSession(session: StreamSession): void {
  session.finished = true
  if (session.graceTimer) {
    clearTimeout(session.graceTimer)
    session.graceTimer = null
  }
  if (session.replayKey) {
    if (sessions.get(session.replayKey) === session) sessions.delete(session.replayKey)
    const store = getSseStateStore()
    store.releaseStream(session.replayKey)
    store.deleteSessionMeta(session.replayKey)
  }
}

/**
 * 上游行统一出口(#22):data 行编号(`id: <seq>`) + 缓冲 + 完整闭合(`\n\n`)写出;
 * 空行/非 data 行/[DONE]/无 replayKey 的 data 行原样透传(data 行统一补空行闭合)。
 * rawLine 存 `data: ...`(不含换行),重放时按 `id: N\n${rawLine}\n\n` 组帧。
 */
export function emitUpstreamLine(session: StreamSession, line: string): void {
  const dataContent = line.startsWith('data:') ? line.slice(5).replace(/^\s/, '') : null
  const canBuffer =
    session.replayKey !== null &&
    dataContent !== null &&
    dataContent !== '' &&
    dataContent !== '[DONE]'
  if (canBuffer) {
    session.seq += 1
    write(session, `id: ${session.seq}\ndata: ${dataContent}\n\n`)
    acceptReplayEvent(session, {
      id: session.seq,
      rawLine: `data: ${dataContent}`,
    })
    return
  }
  if (dataContent === null) write(session, line + '\n')
  else if (dataContent === '') write(session, '\n')
  else write(session, `data: ${dataContent}\n\n`)
}

/** 写出一个完整 SSE data 事件(编号 + 缓冲 + 闭合),用于首事件/错误事件。 */
export function emitEvent(session: StreamSession, payloadJson: string): void {
  emitUpstreamLine(session, `data: ${payloadJson}`)
}

/**
 * 写出一个**带事件名**的完整帧(2026-09-18 立):`event: <name>` + `data: <json>`。
 *
 * 动机:compaction 等首事件此前是 data-only 帧,与 chunk/done 等命名帧协议不统一。
 * 与 emitEvent 同样编号 + 进回放缓冲(rawLine 存两行,pushEvent 的
 * `id: N\n${rawLine}\n\n` 组帧方式天然兼容多行 rawLine),重放后仍是合法命名帧。
 */
export function emitNamedEvent(
  session: StreamSession,
  eventName: string,
  payloadJson: string,
): void {
  const frame = `event: ${eventName}\ndata: ${payloadJson}`
  const canBuffer = session.replayKey !== null && payloadJson !== '' && payloadJson !== '[DONE]'
  if (canBuffer) {
    session.seq += 1
    write(session, `id: ${session.seq}\n${frame}\n\n`)
    acceptReplayEvent(session, { id: session.seq, rawLine: frame })
    return
  }
  write(session, `${frame}\n\n`)
}

/**
 * 主动中止某会话正在进行的流(2026-09-18 立,「停止」按钮的服务端闭环)。
 *
 * 背景:此前前端点停止只断开 SSE 连接,网关侧的上游 fetch 仍靠 15s 宽限期
 * 超时才 abort —— ai-service 的工具子进程/浏览器操作会继续跑完,浪费额度
 * 且留下脏状态。本函数提供显式中止通道给 `POST /api/ai/chat/abort` 调用。
 *
 * 语义:
 * - 会话键为 replayKey = `${conversationId}:${messageId}`;给 messageId 时精确匹配,
 *   否则中止该 conversationId 下所有未结束的流(切会话/多消息并发场景)。
 * - 中止前先写一帧 `{type:'cancelled', reason:'user_abort'}`(进缓冲可重放),
 *   让多端同步场景下的其它客户端也能收到终止标记。
 * - 幂等:已结束(finished)的流跳过;重复调用返回 0,不抛错。
 *
 * 多副本(2026-09-19 立):本进程命中由 abortLocalStreams 完成,同时经状态层
 * publishAbort 广播到其它副本(redis backend;memory 为 no-op,等价单副本);
 * 其它副本经 plugins/sse-registry 的 Pub/Sub 订阅回调执行同一 abortLocalStreams。
 */
export function abortConversationStreams(conversationId: string, messageId?: string): number {
  if (!conversationId) return 0
  const targetMessageId = messageId ?? null
  const aborted = abortLocalStreams(conversationId, targetMessageId)
  // 跨副本广播(接收方按 fromReplicaId 跳过发起方,自回环由订阅侧判定)
  getSseStateStore().publishAbort({
    conversationId,
    messageId: targetMessageId,
    fromReplicaId: SSE_REPLICA_ID,
  })
  return aborted
}

/**
 * 本进程内执行中止(遍历本地 sessions,不发广播):既服务本副本的 abort 端点调用
 * (经 abortConversationStreams),也作为远端 abort 广播(Pub/Sub)的订阅回调
 * 落地动作(plugins/sse-registry 注入)。语义与改造前完全一致:幂等,已结束
 * (finished)的流跳过,重复调用返回 0,不抛错。
 */
export function abortLocalStreams(conversationId: string, messageId: string | null): number {
  if (!conversationId) return 0
  const exact = messageId ? `${conversationId}:${messageId}` : null
  const prefix = `${conversationId}:`
  let aborted = 0
  for (const [key, session] of sessions) {
    if (session.finished) continue
    if (exact ? key !== exact : !key.startsWith(prefix)) continue
    try {
      emitEvent(session, JSON.stringify({ type: 'cancelled', reason: 'user_abort', messageId }))
    } catch {
      /* 终止帧写出失败不阻塞中止动作 */
    }
    session.controller.abort()
    aborted++
  }
  return aborted
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
