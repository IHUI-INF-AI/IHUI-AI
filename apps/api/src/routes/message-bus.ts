/**
 * 多通道消息总线路由(Wave 3 W3-2,飞书/钉钉/TG/Slack/Discord/微信 统一消息总线)。
 *
 * 端点:
 *  - GET  /message-bus/channels        列出已配置渠道(从环境变量读取)
 *  - POST /message-bus/send           发送消息到指定渠道
 *  - POST /message-bus/webhook/:channel 接收渠道 webhook 回调
 *
 * 在 server.ts 注册:server.register(messageBusRoutes, { prefix: '/api' })
 * 响应格式:{ code: 0, message: 'success', data: ... }
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import type {
  MessageBusChannel,
  MessageBusSendInput,
  MessageBusSendResult,
  MessageBusWebhookPayload,
} from '@ihui/types'
import { success, error } from '../utils/response.js'
import { getMessageBusAdapter } from '../services/message-bus/index.js'

const CHANNELS = ['feishu', 'dingtalk', 'telegram', 'slack', 'discord', 'wechat'] as const

const channelSchema = z.enum(CHANNELS)

const sendSchema = z.object({
  channel: channelSchema,
  content: z.string().min(1),
  mentions: z.array(z.string()).max(50).optional(),
})

/** 渠道显示名 + 配置检测用的环境变量 key */
const channelMeta: Array<{
  channel: MessageBusChannel['channel']
  name: string
  envKeys: string[]
}> = [
  { channel: 'feishu', name: '飞书', envKeys: ['FEISHU_WEBHOOK_URL'] },
  { channel: 'dingtalk', name: '钉钉', envKeys: ['DINGTALK_WEBHOOK_URL'] },
  { channel: 'telegram', name: 'Telegram', envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] },
  { channel: 'slack', name: 'Slack', envKeys: ['SLACK_WEBHOOK_URL'] },
  { channel: 'discord', name: 'Discord', envKeys: ['DISCORD_WEBHOOK_URL'] },
  { channel: 'wechat', name: '微信', envKeys: ['WECHAT_WEBHOOK_URL'] },
]

export async function messageBusRoutes(server: FastifyInstance) {
  // GET /message-bus/channels — 列出全部渠道及配置状态
  server.get('/message-bus/channels', async (_request: FastifyRequest, reply: FastifyReply) => {
    const channels: MessageBusChannel[] = channelMeta.map((c) => {
      const webhookUrl = process.env[c.envKeys[0]!]
      const enabled = c.envKeys.every((k) => process.env[k])
      return {
        id: c.channel,
        channel: c.channel,
        name: c.name,
        webhookUrl: webhookUrl || undefined,
        enabled,
      }
    })
    return reply.send(success(channels))
  })

  // POST /message-bus/send — 发送消息到指定渠道
  server.post('/message-bus/send', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = sendSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data as MessageBusSendInput
    const adapter = getMessageBusAdapter(input.channel)
    if (!adapter) {
      return reply.status(400).send(error(400, `不支持的渠道: ${input.channel}`))
    }
    const result: MessageBusSendResult = await adapter.send(input.content, {
      mentions: input.mentions,
    })
    if (!result.success) {
      return reply.status(502).send(error(502, result.error ?? '发送失败'))
    }
    return reply.send(success(result))
  })

  // POST /message-bus/webhook/:channel — 接收渠道 webhook 回调
  server.post<{ Params: { channel: string } }>(
    '/message-bus/webhook/:channel',
    async (request, reply) => {
      const { channel } = request.params
      const parsedChannel = channelSchema.safeParse(channel)
      if (!parsedChannel.success) {
        return reply.status(400).send(error(400, `无效的渠道: ${channel}`))
      }
      const body = (request.body ?? {}) as Record<string, unknown>
      const payload: MessageBusWebhookPayload = {
        channel: parsedChannel.data,
        event: (body.event as string | undefined) ?? 'message',
        data: (body.data as Record<string, unknown> | undefined) ?? body,
        timestamp: Date.now(),
      }
      return reply.send(success({ received: true, payload }))
    },
  )
}
