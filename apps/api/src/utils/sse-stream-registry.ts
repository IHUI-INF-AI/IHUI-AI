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
 */

import type { FastifyReply } from 'fastify'
import { getEventsAfter, type ReplayEvent } from './sse-replay-buffer.js'
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
}

const sessions = new Map<string, StreamSession>()

/** 实际写出:有连接直写;断线/已结束丢弃(事件已在 replay buffer,可经重放找回)。 */
function write(session: StreamSession, str: string): void {
  if (session.raw) session.raw.write(str)
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
    getSseStateStore().appendReplayEvent(session.replayKey!, {
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
    getSseStateStore().appendReplayEvent(session.replayKey!, { id: session.seq, rawLine: frame })
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
