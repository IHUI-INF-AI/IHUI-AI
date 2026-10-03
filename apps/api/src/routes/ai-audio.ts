// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * R4 AI audio 子模块路由:TTS / ASR / 声纹识别 / 实时语音 WebSocket。
 *
 * 基于 DashScope CosyVoice(语音合成)、Paraformer / qwen3-asr(语音识别)、
 * Speaker Recognition(声纹注册/比对/列表/删除)。
 *
 * 环境变量:
 * - DASHSCOPE_API_KEY(阿里通义 DashScope API Key)
 *
 * 注册(server.ts):
 *   server.register(aiAudioRoutes, { prefix: '/api/ai' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { verifyAccessToken } from '@ihui/auth'
import { success, error } from '../utils/response.js'
import { fetchWithinDeadline, isDeadlineAbort } from '../utils/fetch-deadline.js'
import { boundedDeadlineFetchImpl } from '../utils/proxy-dispatcher.js'

// ============================================================================
// 通用工具
// ============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  // G-814420(2026-09-29):旧写法在 fetch() resolve(= 响应头到达)时就走 finally{clearTimeout},
  // 于是 DashScope 发完 headers 之后停滞时,这条请求既没有 deadline 也不会被 abort —— await resp.json()
  // / arrayBuffer() 永久挂住该请求处理链。deadline 现在罩到响应体消费结束(见 utils/fetch-deadline.ts)。
  // label 刻意不带 url:audioUrl 是供应商签发的带签名参数的 OSS 地址,不得进错误文案(守门 67 同型)。
  // G-749(2026-10-03):出站传输经 boundedDeadlineFetchImpl 走 boundedEgressFetch 同一个
  // 有界主循环(直连侧不传 dispatcher),deadline 的收口语义不变。
  return fetchWithinDeadline(url, options, {
    timeoutMs,
    label: 'ai-audio→DashScope 出站请求',
    fetchImpl: boundedDeadlineFetchImpl(),
  })
}

// G-815411(2026-09-29):出站 deadline 的 abort(reason 带 label)不得被 `.catch(() => ({}))`
// 折叠成空对象 —— 旧形态「headers 200 + body 停滞 ⇒ data={}」把网络故障伪装成空结果
// (§5e 失败必须响;守门 134 同族:改了 0 行与改成功不得同形)。只有非 abort 的解析失败
// 保持旧折叠(只降级错误文案,不改成败判定)。
function readOutboundJson(resp: Response): Promise<unknown> {
  return resp.json().catch((e: unknown) => {
    if (isDeadlineAbort(e)) throw e
    return {}
  })
}

// abort 在响应体阶段浮出时,日志必须点名 label(响应文案里已带,日志再记一份结构化的)。
function logOutboundFailure(request: FastifyRequest, e: unknown): void {
  const info = isDeadlineAbort(e)
    ? { label: e.deadlineLabel, kind: 'deadline-abort' }
    : { kind: 'outbound-failure' }
  request.log.error({ ...info, err: (e as Error)?.message ?? String(e) }, 'ai-audio 出站请求失败')
}

const DASHSCOPE_BASE = process.env.DASHSCOPE_BASE ?? 'https://dashscope.aliyuncs.com/api/v1'

function dsHeaders(asyncMode = false): Record<string, string> {
  const key = process.env.DASHSCOPE_API_KEY
  const h: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  if (asyncMode) h['X-DashScope-Async'] = 'enable'
  return h
}

function requireDsKey(reply: FastifyReply): string | null {
  const key = process.env.DASHSCOPE_API_KEY
  if (!key) {
    reply.status(503).send(error(503, 'DashScope 服务未配置'))
    return null
  }
  return key
}

// ============================================================================
// CosyVoice 音色列表(DashScope 不提供动态 list-voices 接口,使用预定义音色)
// ============================================================================

const COSYVOICE_VOICES = [
  {
    voice_id: 'longxiaochun',
    name: '龙小春',
    language: 'zh-CN',
    gender: 'male',
    description: '年轻男声,自然亲切',
  },
  {
    voice_id: 'longxiaoxia',
    name: '龙小夏',
    language: 'zh-CN',
    gender: 'female',
    description: '年轻女声,温柔甜美',
  },
  {
    voice_id: 'longlaotie',
    name: '龙老铁',
    language: 'zh-CN',
    gender: 'male',
    description: '中年男声,沉稳有力',
  },
  {
    voice_id: 'longyuan',
    name: '龙媛',
    language: 'zh-CN',
    gender: 'female',
    description: '成熟女声,优雅知性',
  },
  {
    voice_id: 'longshu',
    name: '龙书',
    language: 'zh-CN',
    gender: 'male',
    description: '书生男声,温文尔雅',
  },
  {
    voice_id: 'longcheng',
    name: '龙诚',
    language: 'zh-CN',
    gender: 'male',
    description: '播音男声,专业标准',
  },
  {
    voice_id: 'longwan',
    name: '龙婉',
    language: 'zh-CN',
    gender: 'female',
    description: '播音女声,字正腔圆',
  },
  {
    voice_id: 'longhua',
    name: '龙华',
    language: 'zh-CN',
    gender: 'male',
    description: '东北男声,幽默风趣',
  },
  {
    voice_id: 'longxiaobei',
    name: '龙小贝',
    language: 'zh-CN',
    gender: 'female',
    description: '童声女声,活泼可爱',
  },
]

// ============================================================================
// 支持的音频模型列表(TTS / ASR / 声纹)
// ============================================================================

const AUDIO_MODELS = [
  {
    id: 'cosyvoice-v2',
    name: 'CosyVoice v2',
    type: 'tts',
    manufacturer: 'dashscope',
    sample_rate: 24000,
    description: 'DashScope CosyVoice v2 语音合成,支持多语言与多音色',
  },
  {
    id: 'cosyvoice-v1',
    name: 'CosyVoice v1',
    type: 'tts',
    manufacturer: 'dashscope',
    sample_rate: 24000,
    description: 'DashScope CosyVoice v1 语音合成',
  },
  {
    id: 'paraformer-v2',
    name: 'Paraformer v2',
    type: 'asr',
    manufacturer: 'dashscope',
    sample_rate: 16000,
    description: 'DashScope Paraformer v2 语音识别(异步任务模式)',
  },
  {
    id: 'paraformer-v1',
    name: 'Paraformer v1',
    type: 'asr',
    manufacturer: 'dashscope',
    sample_rate: 16000,
    description: 'DashScope Paraformer v1 语音识别',
  },
  {
    id: 'qwen3-asr',
    name: 'Qwen3-ASR',
    type: 'asr',
    manufacturer: 'dashscope',
    sample_rate: 16000,
    description: 'DashScope Qwen3-ASR 多模态语音识别(走多模态对话端点)',
  },
  {
    id: 'speaker-recognition',
    name: 'Speaker Recognition',
    type: 'voiceprint',
    manufacturer: 'dashscope',
    sample_rate: 16000,
    description: 'DashScope 声纹识别(注册 / 比对 / 列表 / 删除)',
  },
] as const

// ============================================================================
// DashScope 声纹识别 API（Speaker Recognition）
// ============================================================================

const DS_SPEAKER_URL = `${DASHSCOPE_BASE}/services/audio/asr/speaker-recognition`

// ============================================================================
// 路由
// ============================================================================

export const aiAudioRoutes: FastifyPluginAsync = async (server) => {
  // P1 修复(2026-08-06):audio_base64 无上限 → 恶意请求可提交超大 JSON base64
  // 体撑爆内存(内存 DoS)。上限对齐上传接口的 25MB 音频(≈33.6MB base64)。
  const MAX_AUDIO_BASE64_LENGTH = Math.ceil((25 * 1024 * 1024) / 3) * 4
  const ttsBody = z.object({
    text: z.string(),
    voice_id: z.string().optional(),
    response_format: z.string().optional(),
    rate: z.string().optional(),
    volume: z.string().optional(),
    pitch: z.string().optional(),
  })
  const asrBody = z.object({
    audio_url: z.string().optional(),
    audio_base64: z.string().max(MAX_AUDIO_BASE64_LENGTH).optional(),
    model: z.string().optional(),
    language: z.string().optional(),
    sample_rate: z.number().optional(),
  })
  const chatBody = z.object({
    text: z.string().optional(),
    audio_base64: z.string().max(MAX_AUDIO_BASE64_LENGTH).optional(),
    audio_url: z.string().optional(),
    voice_id: z.string().optional(),
    model: z.string().optional(),
    language: z.string().optional(),
    system_prompt: z.string().optional(),
  })
  const taskIdQuery = z.object({ task_id: z.string().optional() })
  const modelLanguageQuery = z.object({
    model: z.string().optional(),
    language: z.string().optional(),
  })
  const cloneBody = z.object({
    voice_id: z.string().optional(),
    audio_url: z.string().optional(),
    audio_base64: z.string().max(MAX_AUDIO_BASE64_LENGTH).optional(),
    sample_rate: z.number().optional(),
  })
  const voiceIdParam = z.object({ voiceId: z.string() })
  const tokenQuery = z.object({ token: z.string().optional() })

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // WebSocket 路由在 handler 内部通过 query token 鉴权
    if (request.headers.upgrade === 'websocket') return
    if (!(await checkAuth(request, reply))) return
  })

  // ==========================================================================
  // 1. GET /audio/voices — CosyVoice 音色列表
  // ==========================================================================
  server.get('/audio/voices', async (_request, reply) => {
    reply.send(success({ voices: COSYVOICE_VOICES, count: COSYVOICE_VOICES.length }))
  })

  // ==========================================================================
  // 2. POST /audio/speech — TTS(DashScope CosyVoice)
  // ==========================================================================
  server.post('/audio/speech', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const parsed = ttsBody.safeParse(request.body)
    if (!parsed.success || !parsed.data.text) {
      reply.status(400).send(error(400, '请提供 text'))
      return
    }
    const body = parsed.data
    const fmt = (body.response_format ?? 'mp3').toLowerCase()
    const parameters: Record<string, unknown> = { text_type: 'PlainText' }
    if (body.rate) parameters.rate = body.rate
    if (body.volume) parameters.volume = body.volume
    if (body.pitch) parameters.pitch = body.pitch

    const payload = {
      model: 'cosyvoice-v2',
      input: { text: body.text, voice: body.voice_id ?? 'longxiaochun' },
      parameters,
    }

    try {
      const resp = await fetchWithTimeout(
        `${DASHSCOPE_BASE}/services/aigc/text2audio/audio-synthesis`,
        { method: 'POST', headers: dsHeaders(), body: JSON.stringify(payload) },
        120_000,
      )
      const contentType = resp.headers.get('content-type') ?? ''

      // 音频二进制直返
      if (contentType.includes('audio') || contentType.includes('octet-stream')) {
        const buf = Buffer.from(await resp.arrayBuffer())
        reply.header('Content-Type', `audio/${fmt}`)
        reply.header('Content-Disposition', `attachment; filename="speech.${fmt}"`)
        reply.send(buf)
        return
      }

      // JSON 响应(可能为异步任务或错误)。G-815411:!resp.ok 在读 body 之前判;
      // 成功分支的 abort 不再被折叠成空结果(读失败必须响,不得伪装成空数据)。
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? `TTS 请求失败 ${resp.status}`
        reply.status(502).send(error(502, `语音合成失败: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output = (data as { output?: { task_id?: string; task_status?: string } }).output ?? {}
      if (output.task_id) {
        reply.send(success({ task_id: output.task_id, status: output.task_status ?? 'PENDING' }))
        return
      }
      reply.status(502).send(error(502, '语音合成未返回音频数据'))
    } catch (e) {
      logOutboundFailure(request, e)
      const msg =
        (e as Error).name === 'AbortError' ? '语音合成超时,请缩短文本后重试' : (e as Error).message
      reply.status(502).send(error(502, `语音合成异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 3. POST /audio/recognize — ASR(DashScope Paraformer / qwen3-asr)
  // ==========================================================================
  server.post('/audio/recognize', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const parsed = asrBody.safeParse(request.body)
    if (!parsed.success || (!parsed.data.audio_url && !parsed.data.audio_base64)) {
      reply.status(400).send(error(400, '请提供 audio_url 或 audio_base64'))
      return
    }
    const body = parsed.data
    const model = body.model ?? 'paraformer-v2'
    const audioRef = body.audio_url ?? `data:audio/wav;base64,${body.audio_base64}`

    // qwen3-asr 走多模态对话端点
    if (model.startsWith('qwen3-asr')) {
      const asrOptions: Record<string, unknown> = { enable_lid: true, enable_itn: false }
      if (body.language) asrOptions.language = body.language
      const payload = {
        model,
        input: {
          messages: [
            { role: 'system', content: [{ text: '' }] },
            { role: 'user', content: [{ audio: audioRef }] },
          ],
        },
        parameters: { asr_options: asrOptions },
      }
      try {
        const resp = await fetchWithTimeout(
          `${DASHSCOPE_BASE}/services/aigc/multimodal-generation/generation`,
          { method: 'POST', headers: dsHeaders(), body: JSON.stringify(payload) },
          120_000,
        )
        // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}))
          const msg = (data as { message?: string }).message ?? '语音识别请求失败'
          reply.status(502).send(error(502, `语音识别失败: ${msg}`))
          return
        }
        const data = await readOutboundJson(resp)
        const output =
          (
            data as {
              output?: { choices?: Array<{ message?: { content?: Array<{ text?: string }> } }> }
              request_id?: string
            }
          ).output ?? {}
        let transcription = ''
        const choices = output.choices ?? []
        if (choices.length > 0) {
          const contentList = choices[0]?.message?.content ?? []
          for (const item of contentList) {
            if (item.text) transcription += item.text
          }
        }
        reply.send(
          success({
            transcription,
            model,
            audio_url: body.audio_url ?? '',
            request_id: (data as { request_id?: string }).request_id ?? '',
          }),
        )
      } catch (e) {
        logOutboundFailure(request, e)
        const msg = (e as Error).name === 'AbortError' ? '语音识别超时' : (e as Error).message
        reply.status(502).send(error(502, `语音识别异常: ${msg}`))
      }
      return
    }

    // Paraformer-v2 走专用 ASR 端点(异步任务模式)
    const parameters: Record<string, unknown> = { sample_rate: body.sample_rate ?? 16000 }
    if (body.language) parameters.language_hints = [body.language]
    const payload = {
      model,
      input: { file_urls: [audioRef] },
      parameters,
    }
    try {
      const resp = await fetchWithTimeout(
        `${DASHSCOPE_BASE}/services/audio/asr/transcription`,
        { method: 'POST', headers: dsHeaders(true), body: JSON.stringify(payload) },
        120_000,
      )
      // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? 'ASR 请求失败'
        reply.status(502).send(error(502, `语音识别失败: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output =
        (
          data as {
            output?: {
              task_id?: string
              task_status?: string
              results?: Array<{ transcription_text?: string }>
            }
            request_id?: string
          }
        ).output ?? {}
      const results = output.results ?? []
      if (results.length > 0) {
        const transcripts = results.map((r) => ({ transcription: r.transcription_text ?? '' }))
        reply.send(
          success({
            results: transcripts,
            request_id: (data as { request_id?: string }).request_id ?? '',
          }),
        )
        return
      }
      const taskId = output.task_id
      if (taskId) {
        // 轮询一次(快速任务)
        try {
          const pollResp = await fetchWithTimeout(
            `${DASHSCOPE_BASE}/tasks/${taskId}`,
            { method: 'GET', headers: dsHeaders() },
            60_000,
          )
          // G-815411:poll 完全无守卫的这一格补上 —— !ok 先判,成功分支 abort 不折叠
          if (!pollResp.ok) {
            const pollErr = await pollResp.json().catch(() => ({}))
            const msg =
              (pollErr as { message?: string }).message ?? `任务查询失败 ${pollResp.status}`
            reply.status(502).send(error(502, `语音识别失败: ${msg}`))
            return
          }
          const pollData = await readOutboundJson(pollResp)
          const pollOutput =
            (
              pollData as {
                output?: {
                  task_status?: string
                  results?: Array<{ transcription_text?: string }>
                  message?: string
                }
                request_id?: string
              }
            ).output ?? {}
          const status = pollOutput.task_status ?? ''
          if (status === 'SUCCEEDED') {
            const transcripts = (pollOutput.results ?? []).map((r) => ({
              transcription: r.transcription_text ?? '',
            }))
            reply.send(
              success({
                task_id: taskId,
                status: 'SUCCEEDED',
                results: transcripts,
                request_id: (pollData as { request_id?: string }).request_id ?? '',
              }),
            )
            return
          }
          if (status === 'FAILED') {
            reply.status(502).send(error(502, `语音识别失败: ${pollOutput.message ?? '未知错误'}`))
            return
          }
          reply.send(
            success({ task_id: taskId, status, msg: '任务处理中,请稍后使用 task_id 查询结果' }),
          )
        } catch (e) {
          if (isDeadlineAbort(e)) {
            // G-815411:poll 的 deadline abort 不得被读成「任务处理中」(把网络故障伪装成空结果)
            logOutboundFailure(request, e)
            reply.status(502).send(error(502, `语音识别失败: ${(e as Error).message}`))
            return
          }
          reply.send(
            success({
              task_id: taskId,
              status: output.task_status ?? '',
              msg: '任务处理中,请稍后使用 task_id 查询结果',
            }),
          )
        }
        return
      }
      reply.status(502).send(error(502, '语音识别未返回结果'))
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? '语音识别超时' : (e as Error).message
      reply.status(502).send(error(502, `语音识别异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 4. POST /audio/chat — 语音对话(语音/文本输入 → AI 回复)
  // ==========================================================================
  server.post('/audio/chat', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const parsed = chatBody.safeParse(request.body)
    const body = parsed.success ? parsed.data : {}
    let userText = body?.text

    // 1) 音频输入先做 ASR
    if (!userText && (body?.audio_base64 || body?.audio_url)) {
      const audioRef = body.audio_url ?? `data:audio/wav;base64,${body.audio_base64}`
      const lang = body?.language?.split('-')[0]
      const asrPayload = {
        model: 'paraformer-v2',
        input: { file_urls: [audioRef] },
        parameters: { sample_rate: 16000, ...(lang ? { language_hints: [lang] } : {}) },
      }
      try {
        const asrResp = await fetchWithTimeout(
          `${DASHSCOPE_BASE}/services/audio/asr/transcription`,
          { method: 'POST', headers: dsHeaders(true), body: JSON.stringify(asrPayload) },
          120_000,
        )
        // G-815411:ASR 前置完全无守卫的这一格补上 —— !ok 先判,成功分支 abort 不折叠
        if (!asrResp.ok) {
          const asrErr = await asrResp.json().catch(() => ({}))
          const msg =
            (asrErr as { message?: string }).message ?? `ASR 请求失败 ${asrResp.status}`
          logOutboundFailure(request, new Error(`ASR ${asrResp.status}: ${msg}`))
          reply.status(502).send(error(502, `语音识别失败: ${msg}`))
          return
        }
        const asrData = await readOutboundJson(asrResp)
        const asrOutput =
          (asrData as { output?: { results?: Array<{ transcription_text?: string }> } }).output ??
          {}
        const results = asrOutput.results ?? []
        if (results.length > 0) userText = results[0]?.transcription_text ?? ''
      } catch (e) {
        if (isDeadlineAbort(e)) {
          // G-815411:abort 不得被读成「语音识别未获取到有效文本」(网络故障伪装成用户输入问题)
          logOutboundFailure(request, e)
          reply.status(502).send(error(502, `语音识别异常: ${(e as Error).message}`))
          return
        }
        /* 其余失败保持旧忽略行为,后续校验 userText */
      }
      if (!userText) {
        reply.status(400).send(error(400, '语音识别未获取到有效文本'))
        return
      }
    }

    if (!userText) {
      reply.status(400).send(error(400, '请提供 text 或 audio 输入'))
      return
    }

    // 2) AI 对话
    const systemMsg = body?.system_prompt ?? '你是一个智能助手,请简洁明了地回答用户的问题.'
    const chatPayload = {
      model: body?.model ?? 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userText },
        ],
      },
    }
    let aiReply = ''
    try {
      const resp = await fetchWithTimeout(
        `${DASHSCOPE_BASE}/services/aigc/text-generation/generation`,
        { method: 'POST', headers: dsHeaders(), body: JSON.stringify(chatPayload) },
        60_000,
      )
      // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? '对话请求失败'
        reply.status(502).send(error(502, `AI对话失败: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output =
        (
          data as {
            output?: { choices?: Array<{ message?: { content?: string } }>; text?: string }
          }
        ).output ?? {}
      const choices = output.choices ?? []
      aiReply = choices.length > 0 ? (choices[0]?.message?.content ?? '') : (output.text ?? '')
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? 'AI 对话超时' : (e as Error).message
      reply.status(502).send(error(502, `AI对话异常: ${msg}`))
      return
    }
    if (!aiReply) {
      reply.status(502).send(error(502, 'AI未返回有效回复'))
      return
    }

    // 3) 返回文本回复(客户端可再调用 /audio/speech 合成语音)
    reply.send(
      success({
        user_text: userText,
        ai_text: aiReply,
        voice_id: body?.voice_id ?? 'longxiaochun',
        model: body?.model ?? 'qwen-turbo',
        msg: 'AI回复已生成,音频文件通过 /audio/speech 接口获取',
      }),
    )
  })

  // ==========================================================================
  // 5. GET /audio/download — 按 task_id 下载异步 TTS 音频
  // ==========================================================================
  server.get('/audio/download', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const { task_id } = taskIdQuery.parse(request.query)
    if (!task_id) {
      reply.status(400).send(error(400, '请提供 task_id'))
      return
    }
    try {
      const resp = await fetchWithTimeout(
        `${DASHSCOPE_BASE}/tasks/${task_id}`,
        { method: 'GET', headers: dsHeaders() },
        30_000,
      )
      // G-815411:完全无守卫的这一格补上 —— !ok 先判,成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        const msg =
          (errData as { message?: string }).message ?? `任务查询失败 ${resp.status}`
        reply.status(502).send(error(502, `下载音频异常: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output =
        (
          data as {
            output?: {
              task_status?: string
              results?: Array<{ url?: string }>
              audio?: { url?: string }
              message?: string
            }
          }
        ).output ?? {}
      const status = output.task_status ?? 'UNKNOWN'
      if (status === 'SUCCEEDED') {
        const results = output.results ?? []
        let audioUrl = ''
        for (const r of results) {
          if (r.url) {
            audioUrl = r.url
            break
          }
        }
        if (!audioUrl) audioUrl = output.audio?.url ?? ''
        if (audioUrl) {
          const audioResp = await fetchWithTimeout(audioUrl, {}, 120_000)
          const buf = Buffer.from(await audioResp.arrayBuffer())
          reply.header('Content-Type', 'audio/mp3')
          reply.header('Content-Disposition', 'attachment; filename="speech.mp3"')
          reply.send(buf)
          return
        }
        reply.status(404).send(error(404, '音频文件URL未找到'))
        return
      }
      if (status === 'FAILED') {
        reply.status(502).send(error(502, `任务失败: ${output.message ?? '未知错误'}`))
        return
      }
      reply.send(success({ task_id, status, msg: '任务处理中' }))
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? '下载音频超时' : (e as Error).message
      reply.status(502).send(error(502, `下载音频异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 6. POST /audio/upload — 上传音频文件做 ASR
  // ==========================================================================
  server.post('/audio/upload', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const file = await request.file()
    if (!file) {
      reply.status(400).send(error(400, '请上传音频文件'))
      return
    }
    // 2026-07-24 安全加固:音频文件类型校验 + 大小限制(防 CWE-434)
    const AUDIO_MAX_SIZE = 25 * 1024 * 1024 // 25MB(DashScope ASR 限制)
    const AUDIO_ALLOWED_EXTS = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac']
    const filename = file.filename ?? 'audio.wav'
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
    if (!AUDIO_ALLOWED_EXTS.includes(ext)) {
      reply.status(400).send(error(400, `仅支持音频格式: ${AUDIO_ALLOWED_EXTS.join(', ')}`))
      return
    }
    // P1 修复(2026-08-06):原实现先 file.toBuffer() 全量读入内存再校验大小,
    // 超大文件已被完整缓冲后才被拒绝 → 内存 DoS。改为流式读取并限制总量。
    const chunks: Buffer[] = []
    let totalBytes = 0
    for await (const chunk of file.file) {
      totalBytes += chunk.length
      if (totalBytes > AUDIO_MAX_SIZE) {
        file.file.resume() // 排空剩余流,避免连接悬挂
        reply.status(400).send(error(400, '音频文件不能超过 25MB'))
        return
      }
      chunks.push(chunk)
    }
    const buf = Buffer.concat(chunks)
    const audioBase64 = buf.toString('base64')
    const { model: qsModel, language } = modelLanguageQuery.parse(request.query)
    const model = qsModel ?? 'paraformer-v2'

    const audioRef = `data:audio/wav;base64,${audioBase64}`
    const parameters: Record<string, unknown> = { sample_rate: 16000 }
    if (language) parameters.language_hints = [language]
    const payload = {
      model,
      input: { file_urls: [audioRef] },
      parameters,
    }
    try {
      const resp = await fetchWithTimeout(
        `${DASHSCOPE_BASE}/services/audio/asr/transcription`,
        { method: 'POST', headers: dsHeaders(true), body: JSON.stringify(payload) },
        120_000,
      )
      // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? 'ASR 请求失败'
        reply.status(502).send(error(502, `语音识别失败: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output =
        (
          data as {
            output?: { task_id?: string; results?: Array<{ transcription_text?: string }> }
          }
        ).output ?? {}
      const results = output.results ?? []
      if (results.length > 0) {
        const transcripts = results.map((r) => ({ transcription: r.transcription_text ?? '' }))
        reply.send(success({ results: transcripts }))
        return
      }
      if (output.task_id) {
        reply.send(success({ task_id: output.task_id, status: 'PENDING', msg: '任务处理中' }))
        return
      }
      reply.status(502).send(error(502, '语音识别未返回结果'))
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? '语音识别超时' : (e as Error).message
      reply.status(502).send(error(502, `语音识别异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 声纹管理:4 端点（DashScope Speaker Recognition API）
  // ==========================================================================

  // 7. POST /speaker/register — 注册声纹
  server.post('/speaker/register', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const parsed = cloneBody.safeParse(request.body)
    if (!parsed.success || !parsed.data.voice_id) {
      reply.status(400).send(error(400, '请提供 voice_id'))
      return
    }
    const body = parsed.data
    if (!body.audio_url && !body.audio_base64) {
      reply.status(400).send(error(400, '请提供 audio_url 或 audio_base64'))
      return
    }
    const audioUrl = body.audio_url ?? `data:audio/wav;base64,${body.audio_base64}`
    const payload = {
      model: 'speaker-recognition',
      input: {
        action: 'register',
        voice_id: body.voice_id,
        audio_url: audioUrl,
        sample_rate: body.sample_rate ?? 16000,
      },
    }
    try {
      const resp = await fetchWithTimeout(
        DS_SPEAKER_URL,
        { method: 'POST', headers: dsHeaders(), body: JSON.stringify(payload) },
        60_000,
      )
      // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? `注册失败 ${resp.status}`
        reply.status(502).send(error(502, `声纹注册失败: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output = (data as { output?: { voice_id?: string; status?: string } }).output ?? {}
      reply.send(
        success({
          voice_id: output.voice_id ?? body.voice_id,
          status: output.status ?? 'registered',
        }),
      )
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? '声纹注册超时' : (e as Error).message
      reply.status(502).send(error(502, `声纹注册异常: ${msg}`))
    }
  })

  // 8. POST /speaker/compare — 声纹比对
  server.post('/speaker/compare', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const parsed = cloneBody.safeParse(request.body)
    if (!parsed.success || !parsed.data.voice_id) {
      reply.status(400).send(error(400, '请提供 voice_id'))
      return
    }
    const body = parsed.data
    if (!body.audio_url && !body.audio_base64) {
      reply.status(400).send(error(400, '请提供 audio_url 或 audio_base64'))
      return
    }
    const audioUrl = body.audio_url ?? `data:audio/wav;base64,${body.audio_base64}`
    const payload = {
      model: 'speaker-recognition',
      input: {
        action: 'compare',
        voice_id: body.voice_id,
        audio_url: audioUrl,
        sample_rate: body.sample_rate ?? 16000,
      },
    }
    try {
      const resp = await fetchWithTimeout(
        DS_SPEAKER_URL,
        { method: 'POST', headers: dsHeaders(), body: JSON.stringify(payload) },
        60_000,
      )
      // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? `比对失败 ${resp.status}`
        reply.status(502).send(error(502, `声纹比对失败: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output =
        (data as { output?: { matched?: boolean; confidence?: number; score?: number } }).output ??
        {}
      reply.send(
        success({
          voice_id: body.voice_id,
          matched: output.matched ?? false,
          confidence: output.confidence ?? output.score ?? 0,
        }),
      )
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? '声纹比对超时' : (e as Error).message
      reply.status(502).send(error(502, `声纹比对异常: ${msg}`))
    }
  })

  // 9. GET /speaker/list — 声纹组列表
  server.get('/speaker/list', async (request, reply) => {
    if (!requireDsKey(reply)) return
    try {
      const resp = await fetchWithTimeout(
        `${DS_SPEAKER_URL}?action=list`,
        { method: 'GET', headers: dsHeaders() },
        30_000,
      )
      // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? `查询失败 ${resp.status}`
        reply.status(502).send(error(502, `声纹列表查询失败: ${msg}`))
        return
      }
      const data = await readOutboundJson(resp)
      const output = (data as { output?: { voices?: unknown[] } }).output ?? {}
      reply.send(success({ voices: output.voices ?? [], count: (output.voices ?? []).length }))
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? '查询超时' : (e as Error).message
      reply.status(502).send(error(502, `声纹列表查询异常: ${msg}`))
    }
  })

  // 10. DELETE /speaker/:voiceId — 删除声纹
  server.delete('/speaker/:voiceId', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const { voiceId } = voiceIdParam.parse(request.params)
    if (!voiceId) {
      reply.status(400).send(error(400, '请提供 voiceId'))
      return
    }
    try {
      const resp = await fetchWithTimeout(
        `${DS_SPEAKER_URL}?action=delete&voice_id=${encodeURIComponent(voiceId)}`,
        { method: 'DELETE', headers: dsHeaders() },
        30_000,
      )
      // G-815411:!resp.ok 先判;成功分支 abort 不折叠成空结果
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        const msg = (data as { message?: string }).message ?? `删除失败 ${resp.status}`
        reply.status(502).send(error(502, `声纹删除失败: ${msg}`))
        return
      }
      await readOutboundJson(resp)
      reply.send(success({ voice_id: voiceId, deleted: true }))
    } catch (e) {
      logOutboundFailure(request, e)
      const msg = (e as Error).name === 'AbortError' ? '删除超时' : (e as Error).message
      reply.status(502).send(error(502, `声纹删除异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 11. GET /audio/models — 支持的音频模型列表(TTS / ASR / 声纹)
  // ==========================================================================
  server.get('/audio/models', async (_request, reply) => {
    reply.send(success({ models: AUDIO_MODELS, count: AUDIO_MODELS.length }))
  })

  // ==========================================================================
  // 12. GET /audio/health — 音频服务健康检查
  // ==========================================================================
  server.get('/audio/health', async (_request, reply) => {
    const dashscopeConfigured = Boolean(process.env.DASHSCOPE_API_KEY)
    reply.send(
      success({
        status: dashscopeConfigured ? 'ok' : 'degraded',
        service: 'ai-audio',
        dashscope_configured: dashscopeConfigured,
        models_count: AUDIO_MODELS.length,
      }),
    )
  })

  // ==========================================================================
  // 13. WS /audio/realtime — 实时语音识别 WebSocket（引导至 /ws/realtime/pcm）
  // ==========================================================================
  server.get('/audio/realtime', { websocket: true }, (socket, request) => {
    const { token } = tokenQuery.parse(request.query)
    if (!token) {
      socket.close(4001, '缺少 token')
      return
    }
    ;(async () => {
      try {
        await verifyAccessToken(token)
      } catch {
        socket.close(4003, 'token 无效')
        return
      }
      socket.send(
        JSON.stringify({
          type: 'websocket_connected',
          content:
            'WebSocket 连接已建立。实时语音识别请使用 /ws/realtime/pcm 端点（支持二进制 PCM 流式 ASR + TTS 输出）。',
          redirect: '/ws/realtime/pcm',
          alternatives: {
            http_asr: 'POST /api/ai/audio/recognize （非流式 ASR）',
            http_tts: 'POST /api/ai/audio/speech （非流式 TTS）',
          },
        }),
      )
      socket.on('message', (data: Buffer) => {
        const text = data.toString()
        if (text === 'ping') {
          socket.send('pong')
          return
        }
        try {
          const msg = JSON.parse(text)
          if (msg.command === 'end' || msg.command === 'close') {
            socket.send(JSON.stringify({ type: 'system', content: '连接已主动关闭' }))
            socket.close()
            return
          }
        } catch {
          /* 非 JSON 文本,忽略 */
        }
        // 引导用户到 /ws/realtime/pcm
        socket.send(
          JSON.stringify({
            type: 'redirect',
            content: '请使用 /ws/realtime/pcm 端点进行实时语音识别',
            endpoint: '/ws/realtime/pcm',
            protocol: '二进制 PCM 帧 + JSON 控制消息',
          }),
        )
      })
    })()
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
