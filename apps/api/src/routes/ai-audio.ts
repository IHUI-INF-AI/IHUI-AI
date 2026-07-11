/**
 * R4 AI audio 子模块路由:TTS / ASR / 声纹识别 / 实时语音 WebSocket。
 *
 * 基于 DashScope CosyVoice(语音合成)、Paraformer / qwen3-asr(语音识别)、
 * 内存声纹组管理(占位实现,实际声纹比对需集成第三方服务)。
 *
 * 环境变量:
 * - DASHSCOPE_API_KEY(阿里通义 DashScope API Key)
 *
 * 注册(server.ts):
 *   server.register(aiAudioRoutes, { prefix: '/api/ai' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { verifyAccessToken } from '@ihui/auth'
import { success, error } from '../utils/response.js'
import { getVoiceService } from '../services/clawdbot/voice.js'

// 声纹识别服务实例
const voiceService = getVoiceService()

// ============================================================================
// 鉴权
// ============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

// ============================================================================
// 通用工具
// ============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/api/v1'

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
// 内存存储:声纹组 / 声纹特征
// ============================================================================

interface VoiceprintGroup {
  groupId: string
  name: string
  desc: string
  featureCount: number
  createdBy: string
}

interface VoiceprintFeature {
  featureId: string
  groupId: string
  name: string
  desc: string
  audioUrl?: string
  hasAudio: boolean
  createdBy: string
}

const voiceprintGroups = new Map<string, VoiceprintGroup>()
const voiceprintFeatures = new Map<string, VoiceprintFeature[]>()
let groupCounter = 0
let featureCounter = 0

function nextGroupId(): string {
  groupCounter += 1
  return `vpg_${groupCounter}`
}

function nextFeatureId(): string {
  featureCounter += 1
  return `vpf_${featureCounter}`
}

// ============================================================================
// 路由
// ============================================================================

export const aiAudioRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // WebSocket 路由在 handler 内部通过 query token 鉴权
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
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
    const body = request.body as {
      text: string
      voice_id?: string
      response_format?: string
      rate?: string
      volume?: string
      pitch?: string
    }
    if (!body?.text) {
      reply.status(400).send(error(400, '请提供 text'))
      return
    }
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

      // JSON 响应(可能为异步任务或错误)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        const msg = (data as { message?: string }).message ?? `TTS 请求失败 ${resp.status}`
        reply.status(502).send(error(502, `语音合成失败: ${msg}`))
        return
      }
      const output = (data as { output?: { task_id?: string; task_status?: string } }).output ?? {}
      if (output.task_id) {
        reply.send(success({ task_id: output.task_id, status: output.task_status ?? 'PENDING' }))
        return
      }
      reply.status(502).send(error(502, '语音合成未返回音频数据'))
    } catch (e) {
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
    const body = request.body as {
      audio_url?: string
      audio_base64?: string
      model?: string
      language?: string
      sample_rate?: number
    }
    if (!body?.audio_url && !body?.audio_base64) {
      reply.status(400).send(error(400, '请提供 audio_url 或 audio_base64'))
      return
    }
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
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) {
          const msg = (data as { message?: string }).message ?? '语音识别请求失败'
          reply.status(502).send(error(502, `语音识别失败: ${msg}`))
          return
        }
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
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        const msg = (data as { message?: string }).message ?? 'ASR 请求失败'
        reply.status(502).send(error(502, `语音识别失败: ${msg}`))
        return
      }
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
          const pollData = await pollResp.json().catch(() => ({}))
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
        } catch {
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
      const msg = (e as Error).name === 'AbortError' ? '语音识别超时' : (e as Error).message
      reply.status(502).send(error(502, `语音识别异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 4. POST /audio/chat — 语音对话(语音/文本输入 → AI 回复)
  // ==========================================================================
  server.post('/audio/chat', async (request, reply) => {
    if (!requireDsKey(reply)) return
    const body = request.body as {
      text?: string
      audio_base64?: string
      audio_url?: string
      voice_id?: string
      model?: string
      language?: string
      system_prompt?: string
    }
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
        const asrData = await asrResp.json().catch(() => ({}))
        const asrOutput =
          (asrData as { output?: { results?: Array<{ transcription_text?: string }> } }).output ??
          {}
        const results = asrOutput.results ?? []
        if (results.length > 0) userText = results[0]?.transcription_text ?? ''
      } catch {
        /* 忽略,后续校验 userText */
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
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        const msg = (data as { message?: string }).message ?? '对话请求失败'
        reply.status(502).send(error(502, `AI对话失败: ${msg}`))
        return
      }
      const output =
        (
          data as {
            output?: { choices?: Array<{ message?: { content?: string } }>; text?: string }
          }
        ).output ?? {}
      const choices = output.choices ?? []
      aiReply = choices.length > 0 ? (choices[0]?.message?.content ?? '') : (output.text ?? '')
    } catch (e) {
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
    const { task_id } = request.query as { task_id?: string }
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
      const data = await resp.json().catch(() => ({}))
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
    const buf = await file.toBuffer()
    const audioBase64 = buf.toString('base64')
    const model = (request.query as { model?: string }).model ?? 'paraformer-v2'
    const language = (request.query as { language?: string }).language

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
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        const msg = (data as { message?: string }).message ?? 'ASR 请求失败'
        reply.status(502).send(error(502, `语音识别失败: ${msg}`))
        return
      }
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
      const msg = (e as Error).name === 'AbortError' ? '语音识别超时' : (e as Error).message
      reply.status(502).send(error(502, `语音识别异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 声纹管理:6 端点
  // ==========================================================================

  // 7. POST /audio/voiceprint/groups/create — 创建声纹组
  server.post('/audio/voiceprint/groups/create', async (request, reply) => {
    const body = request.body as { name?: string; desc?: string }
    if (!body?.name) {
      reply.status(400).send(error(400, '请提供 name'))
      return
    }
    const groupId = nextGroupId()
    const group: VoiceprintGroup = {
      groupId,
      name: body.name,
      desc: body.desc ?? '',
      featureCount: 0,
      createdBy: request.userId!,
    }
    voiceprintGroups.set(groupId, group)
    voiceprintFeatures.set(groupId, [])
    reply.send(success(group))
  })

  // 8. GET /audio/voiceprint/groups/list — 声纹组列表
  server.get('/audio/voiceprint/groups/list', async (_request, reply) => {
    const groups = Array.from(voiceprintGroups.values())
    reply.send(success({ groups, count: groups.length }))
  })

  // 9. POST /audio/voiceprint/groups/:groupId/users — 添加声纹
  server.post('/audio/voiceprint/groups/:groupId/users', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    const group = voiceprintGroups.get(groupId)
    if (!group) {
      reply.status(404).send(error(404, `声纹组 ${groupId} 不存在`))
      return
    }
    const body = request.body as {
      name?: string
      desc?: string
      audio_url?: string
      audio_base64?: string
    }
    if (!body?.name) {
      reply.status(400).send(error(400, '请提供 name'))
      return
    }
    if (!body.audio_url && !body.audio_base64) {
      reply.status(400).send(error(400, '请提供 audio_url 或 audio_base64'))
      return
    }
    const feature: VoiceprintFeature = {
      featureId: nextFeatureId(),
      groupId,
      name: body.name,
      desc: body.desc ?? '',
      audioUrl: body.audio_url,
      hasAudio: true,
      createdBy: request.userId!,
    }
    voiceprintFeatures.get(groupId)!.push(feature)
    group.featureCount = voiceprintFeatures.get(groupId)!.length
    reply.send(success(feature))
  })

  // 10. DELETE /audio/voiceprint/groups/:groupId/users/:featureId — 删除声纹
  server.delete('/audio/voiceprint/groups/:groupId/users/:featureId', async (request, reply) => {
    const { groupId, featureId } = request.params as { groupId: string; featureId: string }
    const group = voiceprintGroups.get(groupId)
    if (!group) {
      reply.status(404).send(error(404, `声纹组 ${groupId} 不存在`))
      return
    }
    const features = voiceprintFeatures.get(groupId) ?? []
    const idx = features.findIndex((f) => f.featureId === featureId)
    if (idx < 0) {
      reply.status(404).send(error(404, `声纹特征 ${featureId} 不存在`))
      return
    }
    features.splice(idx, 1)
    group.featureCount = features.length
    reply.send(success({ feature_id: featureId, group_id: groupId }))
  })

  // 11. GET /audio/voiceprint/groups/:groupId/users — 声纹组内声纹列表
  server.get('/audio/voiceprint/groups/:groupId/users', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    if (!voiceprintGroups.has(groupId)) {
      reply.status(404).send(error(404, `声纹组 ${groupId} 不存在`))
      return
    }
    const features = voiceprintFeatures.get(groupId) ?? []
    reply.send(success({ features, count: features.length }))
  })

  // 12. POST /audio/voiceprint/identify — 声纹识别（集成 VoiceService）
  server.post('/audio/voiceprint/identify', async (request, reply) => {
    const body = request.body as {
      group_id?: string
      audio_url?: string
      audio_base64?: string
      user_id?: string
    }
    if (!body?.group_id || !voiceprintGroups.has(body.group_id)) {
      reply.status(404).send(error(404, '声纹组不存在'))
      return
    }
    if (!body.audio_url && !body.audio_base64) {
      reply.status(400).send(error(400, '请提供 audio_url 或 audio_base64'))
      return
    }
    const features = voiceprintFeatures.get(body.group_id!) ?? []
    if (features.length === 0) {
      reply.status(400).send(error(400, '声纹组中没有注册的声纹'))
      return
    }
    // 集成 VoiceService 做声纹比对
    const audioBuffer = body.audio_base64
      ? Buffer.from(body.audio_base64, 'base64')
      : Buffer.alloc(0)
    let matchedFeatureId: string | null = null
    let maxConfidence = 0
    // 遍历组内所有已注册声纹，取置信度最高的匹配
    for (const feature of features) {
      const userId = body.user_id ?? feature.name
      const result = await voiceService.verifyVoiceprint(userId, audioBuffer)
      if (result.matched && result.confidence > maxConfidence) {
        maxConfidence = result.confidence
        matchedFeatureId = feature.featureId
      }
    }
    reply.send(
      success({
        group_id: body.group_id,
        registered_speakers: features.map((f) => ({ feature_id: f.featureId, name: f.name })),
        matched_speaker: matchedFeatureId
          ? (features.find((f) => f.featureId === matchedFeatureId) ?? null)
          : null,
        confidence: maxConfidence,
        msg: matchedFeatureId
          ? `声纹匹配成功，置信度 ${(maxConfidence * 100).toFixed(1)}%`
          : '未匹配到已注册声纹',
      }),
    )
  })

  // ==========================================================================
  // 13. WS /audio/realtime — 实时语音识别 WebSocket（引导至 /ws/realtime/pcm）
  // ==========================================================================
  server.get('/audio/realtime', { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token
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
