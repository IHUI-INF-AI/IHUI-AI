import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import { config } from '../config/index.js'
import { wsAuth } from './ws-helpers.js'
import { cloneTimbre } from '../routes/ai-vendors.js'

const send = (socket: WebSocket, obj: unknown): void => {
  try {
    socket.send(JSON.stringify(obj))
  } catch {
    /* 连接已关闭 */
  }
}

const DASHSCOPE_TTS =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/audio-synthesis'

/** 调用 DashScope CosyVoice 合成音频,返回二进制 Buffer. */
async function synthesizeTTS(text: string, voice: string, signal?: AbortSignal): Promise<Buffer> {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('DashScope 未配置')
  const resp = await fetch(DASHSCOPE_TTS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'cosyvoice-v2',
      input: { text, voice },
      parameters: { text_type: 'PlainText' },
    }),
    signal,
  })
  const ct = resp.headers.get('content-type') ?? ''
  if (!resp.ok || !(ct.includes('audio') || ct.includes('octet-stream'))) {
    const err = await resp.text().catch(() => '')
    throw new Error(`TTS 失败 ${resp.status}: ${err.slice(0, 120)}`)
  }
  return Buffer.from(await resp.arrayBuffer())
}

/**
 * WebSocket AI 能力插件:agent_stream / tts_stream / realtime_pcm.
 *
 * 三者均为 1:1 流式连接(单用户独占),不需要 Redis Pub/Sub 广播;
 * 多实例广播需求由 ws-chat.ts 的聊天室承担.
 *
 * 端点:
 *   - /ws/agent/stream  Agent 流式输出(步骤/工具调用/思考),支持 interrupt/continue/cancel
 *   - /ws/tts/stream     TTS 流式合成(文本输入,音频流式输出,支持中断)
 *   - /ws/realtime/pcm   双向实时音频(ASR 输入 + TTS 输出,PCM16 16kHz)
 */
const wsAiPlugin: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. /ws/agent/stream — Agent 流式输出
  //    客户端发送: {"text":"..."} 或 {"command":"interrupt"|"continue"|"cancel"}
  //    服务端推送: ready / start / delta / done / error / interrupted / resumed / cancelled
  // ==========================================================================
  server.get('/ws/agent/stream', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string; bot_id?: string }
    const botId = query.bot_id ?? 'default'
    ;(async () => {
      const userId = await wsAuth(socket, query.token)
      if (!userId) return
      send(socket, { event: 'ready', bot_id: botId, user: userId })

      let controller: AbortController | null = null
      let paused = false

      socket.on('message', async (data: Buffer) => {
        const raw = data.toString()
        if (raw === 'ping') {
          socket.send('pong')
          return
        }
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(raw) as Record<string, unknown>
        } catch {
          return
        }

        // 控制指令:interrupt(暂停当前流) / continue(恢复) / cancel(取消)
        const cmd = msg.command as string | undefined
        if (cmd === 'cancel') {
          controller?.abort()
          send(socket, { event: 'cancelled' })
          return
        }
        if (cmd === 'interrupt') {
          paused = true
          controller?.abort()
          send(socket, { event: 'interrupted' })
          return
        }
        if (cmd === 'continue') {
          paused = false
          send(socket, { event: 'resumed' })
          return
        }

        // 文本输入:启动 Agent 流式调用
        const text = msg.text as string | undefined
        if (!text) return
        if (paused) {
          send(socket, { event: 'error', msg: '已暂停,请先发送 continue' })
          return
        }

        controller?.abort()
        controller = new AbortController()
        send(socket, { event: 'start', ts: Date.now() })

        try {
          const resp = await fetch(`${config.AI_SERVICE_URL}/agent/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, bot_id: botId, text, stream: true }),
            signal: controller.signal,
          })
          if (!resp.ok || !resp.body) {
            send(socket, { event: 'error', msg: `AI service ${resp.status}` })
            return
          }
          const reader = resp.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (line.trim()) send(socket, { event: 'delta', raw: line })
            }
          }
          if (buffer.trim()) send(socket, { event: 'delta', raw: buffer })
        } catch (e) {
          // interrupt/cancel 触发的 AbortError 已发送对应事件,此处不重复报错
          if ((e as Error).name !== 'AbortError') {
            send(socket, { event: 'error', msg: (e as Error).message })
          }
        } finally {
          send(socket, { event: 'done' })
          controller = null
        }
      })

      socket.on('close', () => controller?.abort())
    })()
  })

  // ==========================================================================
  // 2. /ws/tts/stream — TTS 流式合成
  //    客户端发送: {"action":"synthesize","text":"...","voice":"longxiaochun"}
  //                {"action":"interrupt"}  中断当前合成
  //    服务端推送: task.start / audio.chunk(base64) / audio.done / task.error / interrupted
  // ==========================================================================
  server.get('/ws/tts/stream', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string }
    ;(async () => {
      const userId = await wsAuth(socket, query.token)
      if (!userId) return
      let aborted = false
      socket.on('close', () => {
        aborted = true
      })

      socket.on('message', async (data: Buffer) => {
        const raw = data.toString()
        if (raw === 'ping') {
          socket.send('pong')
          return
        }
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(raw) as Record<string, unknown>
        } catch {
          return
        }
        const action = msg.action as string | undefined
        if (action === 'interrupt') {
          aborted = true
          send(socket, { event: 'interrupted' })
          return
        }
        if (action === 'ping') {
          send(socket, { event: 'pong', ts: Date.now() })
          return
        }
        if (action !== 'synthesize') return

        const text = msg.text as string | undefined
        if (!text) {
          send(socket, { code: 400, event: 'error', message: '缺少 text' })
          return
        }
        aborted = false
        send(socket, { code: 0, event: 'task.start', ts: Date.now() })
        try {
          const audio = await synthesizeTTS(text, (msg.voice as string) ?? 'longxiaochun')
          const CHUNK = 8192
          for (let i = 0; i < audio.length; i += CHUNK) {
            if (aborted) {
              send(socket, { event: 'interrupted' })
              return
            }
            send(socket, {
              code: 0,
              event: 'audio.chunk',
              data: audio.subarray(i, i + CHUNK).toString('base64'),
              format: 'pcm',
              sample_rate: 16000,
            })
          }
          send(socket, { code: 0, event: 'audio.done', size: audio.length })
        } catch (e) {
          send(socket, { code: 500, event: 'task.error', message: (e as Error).message })
        }
      })
    })()
  })

  // ==========================================================================
  // 3. /ws/realtime/pcm — 双向实时音频(ASR 输入 + TTS 输出,PCM16 16kHz)
  //    客户端发送: 二进制 PCM 帧(ASR 输入,累积至 asr.stop)
  //                {"type":"asr.stop"}      提交累积 PCM 做识别
  //                {"type":"asr.cancel"}    清空 ASR 缓冲
  //                {"type":"tts.request","text":"...","voice":"..."}  请求 TTS 输出
  //                {"type":"tts.interrupt"} 中断 TTS 输出
  //    服务端推送: ready / asr.result / pcm.chunk(base64) / tts.done / tts.interrupted / error
  // ==========================================================================
  server.get('/ws/realtime/pcm', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string }
    ;(async () => {
      const userId = await wsAuth(socket, query.token)
      if (!userId) return
      send(socket, {
        event: 'ready',
        user: userId,
        audio: { sample_rate: 16000, sample_width: 2, channels: 1 },
      })

      let ttsController: AbortController | null = null
      let asrBuffer = Buffer.alloc(0)

      socket.on('message', async (data: Buffer) => {
        // 优先解析为 JSON 控制消息;解析失败则视为二进制 PCM 帧(ASR 输入)
        let msg: Record<string, unknown> | null = null
        try {
          msg = JSON.parse(data.toString()) as Record<string, unknown>
        } catch {
          asrBuffer = Buffer.concat([asrBuffer, data])
          return
        }

        const type = msg.type as string | undefined
        if (type === 'asr.stop') {
          const pcm = asrBuffer
          asrBuffer = Buffer.alloc(0)
          if (pcm.length === 0) {
            send(socket, { event: 'asr.result', text: '' })
            return
          }
          try {
            const resp = await fetch(`${config.AI_SERVICE_URL}/asr/pcm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream', 'X-User-Id': userId },
              body: pcm,
            })
            const result = (await resp.json().catch(() => ({}))) as { text?: string }
            send(socket, { event: 'asr.result', text: result.text ?? '' })
          } catch (e) {
            send(socket, { event: 'error', msg: `ASR 失败: ${(e as Error).message}` })
          }
          return
        }
        if (type === 'asr.cancel') {
          asrBuffer = Buffer.alloc(0)
          return
        }
        if (type === 'tts.interrupt') {
          ttsController?.abort()
          send(socket, { event: 'tts.interrupted' })
          return
        }
        if (type === 'tts.request') {
          const text = msg.text as string | undefined
          if (!text) return
          ttsController?.abort()
          ttsController = new AbortController()
          try {
            const audio = await synthesizeTTS(
              text,
              (msg.voice as string) ?? 'longxiaochun',
              ttsController.signal,
            )
            const CHUNK = 4096
            for (let i = 0; i < audio.length; i += CHUNK) {
              if (ttsController.signal.aborted) return
              send(socket, {
                event: 'pcm.chunk',
                data: audio.subarray(i, i + CHUNK).toString('base64'),
                sample_rate: 16000,
                sample_width: 2,
                channels: 1,
              })
            }
            send(socket, { event: 'tts.done', size: audio.length })
          } catch (e) {
            if ((e as Error).name !== 'AbortError') {
              send(socket, { event: 'error', msg: (e as Error).message })
            }
          } finally {
            ttsController = null
          }
        }
      })

      socket.on('close', () => ttsController?.abort())
    })()
  })

  // ==========================================================================
  // 4. /ws/stock/stream — Stock 流式分析
  //    客户端发送: {"symbol":"600519","question":"最近走势如何?"}
  //    服务端推送: ready / start / delta(分段分析文本) / done / error
  // ==========================================================================
  server.get('/ws/stock/stream', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string }
    ;(async () => {
      const userId = await wsAuth(socket, query.token)
      if (!userId) return
      send(socket, { event: 'ready', user: userId })

      socket.on('message', async (data: Buffer) => {
        const raw = data.toString()
        if (raw === 'ping') {
          socket.send('pong')
          return
        }
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(raw) as Record<string, unknown>
        } catch {
          return
        }

        const symbol = msg.symbol as string | undefined
        const question = msg.question as string | undefined
        if (!symbol || !question) {
          send(socket, { event: 'error', msg: '缺少 symbol 或 question' })
          return
        }

        send(socket, { event: 'start', symbol, ts: Date.now() })

        // 简化实现：返回固定分析结果，分段流式推送
        const sections = [
          `【${symbol}】分析报告\n\n`,
          `问题：${question}\n\n`,
          '1. 技术指标分析\n' +
            '   - 建议关注均线系统、MACD、RSI 等关键技术指标\n' +
            '   - 重点观察近期成交量变化与价格突破/跌破关键位\n\n',
          '2. 基本面评估\n' +
            '   - 留意最新财报数据、营收与利润增长趋势\n' +
            '   - 关注行业景气度与公司在行业中的竞争地位\n\n',
          '3. 市场情绪判断\n' +
            '   - 观察主力资金流向与北向/南向资金动向\n' +
            '   - 留意市场热点轮动与板块效应\n\n',
          '4. 风险提示\n' +
            '   - 以上为框架性分析，具体操作请结合实时数据\n' +
            '   - 股市有风险，投资需谨慎\n',
        ]

        for (const section of sections) {
          send(socket, { event: 'delta', content: section })
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        send(socket, { event: 'done', symbol, ts: Date.now() })
      })
    })()
  })

  // ==========================================================================
  // 5. /ws/timbre/generate — 实时音色生成（迁移自旧架构 ws/timbre_generate.py）
  //    客户端发送: {"action":"auth","token":"..."} 完成认证
  //                {"action":"generate","voiceName":"...","audioUrl":"...","vendor":"doubao"}
  //    服务端推送: auth.ok / auth.fail / task.start / task.done / task.error
  // ==========================================================================
  server.get('/ws/timbre/generate', { websocket: true }, (socket, request) => {
    const query = request.query as { token?: string }
    ;(async () => {
      const userId = await wsAuth(socket, query.token)
      if (!userId) return
      send(socket, { code: 0, event: 'auth.ok', user: userId })

      socket.on('message', async (data: Buffer) => {
        const raw = data.toString()
        if (raw === 'ping') {
          send(socket, { code: 0, event: 'pong', ts: Date.now() })
          return
        }
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(raw) as Record<string, unknown>
        } catch {
          send(socket, { code: 400, event: 'error', message: 'JSON 格式错误' })
          return
        }

        const action = msg.action as string | undefined
        if (action === 'auth') {
          send(socket, { code: 0, event: 'auth.ok', user: userId })
          return
        }
        if (action !== 'generate') {
          send(socket, { code: 400, event: 'error', message: `未知 action: ${action}` })
          return
        }

        const voiceName = msg.voiceName as string | undefined
        const audioUrl = msg.audioUrl as string | undefined
        if (!voiceName || !audioUrl) {
          send(socket, { code: 400, event: 'error', message: '缺少 voiceName 或 audioUrl' })
          return
        }
        const vendor = (msg.vendor as string) ?? 'doubao'
        const taskId = `timbre_${Date.now()}_${userId.slice(0, 8)}`
        send(socket, { code: 0, event: 'task.start', taskId })

        const result = await cloneTimbre(userId, voiceName, audioUrl, vendor)
        if (result.error) {
          send(socket, { code: 500, event: 'task.error', taskId, message: result.error })
        } else {
          send(socket, { code: 0, event: 'task.done', taskId, data: result.timbre })
        }
      })
    })()
  })
}

export const wsAi = fp(wsAiPlugin, {
  name: 'ws-ai',
  fastify: '5.x',
})
