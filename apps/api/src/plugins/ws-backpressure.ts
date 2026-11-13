// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebSocket 下行链路的统一背压闸(F-116)。
 *
 * 故障型:客户端长期不读 socket 但维持 pong,写队列会无界堆积(内存被吃掉),
 * 而旧写法只判「连接是否已关」——半死连接照样被每一帧广播命中。
 *
 * 本模块是**唯一**的阈值与判定出口:四个 `ws-*` 投递链路共用同一份常量,
 * 各文件不得再写自己的魔数。两种处置由调用方按链路语义选择,本模块不替它决定:
 *  - 跳过本帧(`sentWithBackpressure` 返回 'skipped'):通知/广播/房间聊天,
 *    一帧可丢(通知可重拉、房间有回放缓冲),断线反而代价更大;
 *  - 断开连接:客服会话(1:1、无补发缓冲),丢掉的那一帧重连后也补不回来。
 *
 * 另一处必须在此收口:`ws.send` 的写失败走 **callback** 而非抛出,同步 try/catch
 * 在「连接已断」这一主场景下根本不会命中。故发送一律走本模块的 callback 形态。
 */
import type { WebSocket } from '@fastify/websocket'

/**
 * 单连接写队列堆积水位(字节):超过即认为消费端长期不读。
 * 取 1MB —— 远大于正常单帧(文本消息上限 8000 字符),又远小于任一实例可承受的残留内存。
 */
export const WS_BACKPRESSURE_LIMIT_BYTES = 1024 * 1024

/** 跳过喊话的节流窗口,与 ws-broadcast 既有丢帧台账同档(60s)。 */
const SKIP_NOTICE_THROTTLE_MS = 60_000

/** 一次发送尝试的结论:交给 socket / 因背压跳过 / 写失败(连接应摘除)。 */
export type WsSendOutcome = 'sent' | 'skipped' | 'failed'

/** 该连接的写队列是否已超水位。 */
export function isWsBackpressured(
  socket: WebSocket,
  limit: number = WS_BACKPRESSURE_LIMIT_BYTES,
): boolean {
  return socket.bufferedAmount > limit
}

/**
 * 带背压闸与写失败感知的发送单点。
 *
 * - 超水位 ⇒ 不调用 `send`,返回 'skipped'(连接保持挂表);
 * - `send` 同步抛出或 callback 报错 ⇒ 调一次 `onFailure`(通常为摘线/计数)。
 *
 * @param onFailure 连接被判定为不可写的回调(可能同步,也可能来自 callback 的异步调用)
 */
export function sendWithBackpressure(
  socket: WebSocket,
  msg: string,
  onFailure: () => void,
  limit: number = WS_BACKPRESSURE_LIMIT_BYTES,
): WsSendOutcome {
  if (isWsBackpressured(socket, limit)) return 'skipped'
  try {
    socket.send(msg, (err) => {
      if (err) onFailure()
    })
    return 'sent'
  } catch {
    onFailure()
    return 'failed'
  }
}

export interface BackpressureSkipLedger {
  /** 记录一次跳过;返回本次是否应当喊话(首次立即喊,之后每 60s 复读一次) */
  record(): boolean
  /** 累计跳过帧数 */
  total(): number
}

/**
 * 「首喊 + 节流复读」台账:既不静默丢帧,也不每帧刷屏。
 * 形态与 ws-broadcast 既有的 createSendFailureLedger 同档,但语义不同 ——
 * 跳过**不是**断线,故不能复用那本"丢帧即摘线"的账。
 */
export function createBackpressureSkipLedger(now: () => number = Date.now): BackpressureSkipLedger {
  let count = 0
  let lastAtMs = 0
  return {
    record(): boolean {
      count += 1
      const t = now()
      const due = count === 1 || t - lastAtMs >= SKIP_NOTICE_THROTTLE_MS
      if (due) lastAtMs = t
      return due
    },
    total(): number {
      return count
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
