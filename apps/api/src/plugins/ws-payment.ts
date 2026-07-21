import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { orders } from '@ihui/database'
import { wsAuth } from './ws-helpers.js'
import { getWsAutoRecoveryManager } from './ws-auto-recovery.js'

interface PaymentStatusPayload {
  orderNo: string
  status: string
  message: string
  timestamp: string
}

const send = (socket: WebSocket, obj: unknown): void => {
  try {
    socket.send(JSON.stringify(obj))
  } catch {
    /* 连接已关闭 */
  }
}

/** 订单状态字符串 → 前端可读状态字符串 */
function mapOrderStatus(status: string | null): { status: string; message: string } {
  switch (status) {
    case 'pending':
      return { status: 'pending', message: '等待支付' }
    case 'paid':
      return { status: 'paid', message: '支付成功' }
    case 'cancelled':
      return { status: 'cancelled', message: '订单已取消' }
    case 'refunded':
      return { status: 'refunded', message: '已退款' }
    default:
      return { status: 'unknown', message: '未知状态' }
  }
}

/**
 * WebSocket 支付状态实时推送插件。
 *
 * 客户端连接: ws://host/ws/payment/status/:orderNo?token=<access_token>
 * 服务端推送: { type: 'payment_status', data: { orderNo, status, message, timestamp } }
 *
 * 实现策略：
 *   1. 连接后立即推送一次当前状态
 *   2. 每 2 秒轮询订单状态，状态变化时推送
 *   3. 收到 ping 消息回复 pong
 *   4. 连接关闭时清理定时器
 *
 * 降级：前端可使用 GET /payments/:id/status 轮询替代。
 */
const wsPaymentPlugin: FastifyPluginAsync = async (server) => {
  server.get('/ws/payment/status/:orderNo', { websocket: true }, async (socket, request) => {
    const { orderNo } = request.params as { orderNo: string }
    const query = request.query as { token?: string }
    const userId = await wsAuth(socket, query.token)
    if (!userId) return

    let lastStatus: string | null | undefined = undefined
    let closed = false

    socket.on('close', () => {
      closed = true
    })

    socket.on('message', (data: Buffer) => {
      const raw = data.toString()
      if (raw === 'ping') {
        send(socket, { type: 'pong' })
        return
      }
      try {
        const msg = JSON.parse(raw) as Record<string, unknown>
        if (msg.type === 'ping') {
          send(socket, { type: 'pong' })
        }
      } catch {
        /* 忽略非 JSON 消息 */
      }
    })

    const pushStatus = async (): Promise<void> => {
      if (closed) return
      try {
        const [order] = await db
          .select({ status: orders.status })
          .from(orders)
          .where(eq(orders.orderNo, orderNo))
          .limit(1)

        const currentStatus = order?.status ?? null
        if (currentStatus === lastStatus) return
        lastStatus = currentStatus

        const { status, message } = mapOrderStatus(currentStatus)
        const payload: PaymentStatusPayload = {
          orderNo,
          status,
          message,
          timestamp: new Date().toISOString(),
        }
        send(socket, { type: 'payment_status', data: payload })

        // 终态：支付成功/取消/退款后停止轮询（pending 之外的所有状态）
        if (currentStatus !== null && currentStatus !== 'pending') {
          return
        }
      } catch {
        /* 查询失败时不关闭连接，等待下次轮询 */
      }
    }

    // 立即推送一次当前状态
    await pushStatus()

    // 每 2 秒轮询订单状态（仅 pending 状态时持续轮询）
    const interval = setInterval(async () => {
      if (closed) {
        clearInterval(interval)
        return
      }
      await pushStatus()
      // 终态后停止轮询
      if (lastStatus !== null && lastStatus !== undefined && lastStatus !== 'pending') {
        clearInterval(interval)
      }
    }, 2000)

    // 安全兜底：5 分钟后自动关闭连接，避免泄漏
    setTimeout(
      () => {
        if (!closed) {
          clearInterval(interval)
          try {
            socket.close(1000, 'timeout')
          } catch {
            /* 连接已关闭 */
          }
        }
      },
      5 * 60 * 1000,
    )
  })

  getWsAutoRecoveryManager().setFastify(server)
  getWsAutoRecoveryManager().registerPlugin('ws-payment', {
    getConnections: () => new Map(),
    removeConnection: async () => {},
  })
}

export default wsPaymentPlugin
