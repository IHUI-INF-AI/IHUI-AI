// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展媒体代理子路由 5(2026-09-21 n15b 媒体平台补齐):
 *   聚合  fal(同步 fal.run + 队列 queue.fal.run,覆盖 Flux/Kling/Veo 等数百模型) +
 *         freepik(聚合图像,text-to-image 异步任务)
 *   音乐  mureka(昆仑万维天工音乐)
 *   语音  hume(Octave TTS/EVI) + inworld(TTS) + soniox(STT) + gladia(STT audio_url 直传)
 *   图像  getimg(多管线文生图) + bria(文生图 2.2)
 *
 * 各 body 全 optional(prompt/model 为主 + 各家官方参数),上游错误透传不吞。
 * 注:PlayAI(PlayHT) 官方异步 TTS 为 api.play.ht/api/v2/tts 且需 X-USER-ID +
 * AUTHORIZATION 双凭据,与规划端点不符,本轮跳过。
 */
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  requireVendorKey,
  VENDORS,
  taskIdParam,
  type FastifyPluginAsync,
} from './_shared.js'

// ---- fal 官方参数(每模型 schema 不同,prompt 常用字段透传,其余模型输入全透传) ----
const falBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // fal-ai/flux/dev 等(generate 必填)
  image_url: z.string().optional(),
  negative_prompt: z.string().optional(),
  seed: z.number().int().optional(),
  image_size: z.record(z.string(), z.unknown()).optional(),
  num_images: z.number().int().optional(),
  guidance_scale: z.number().optional(),
  num_inference_steps: z.number().int().optional(),
})

// ---- mureka 官方参数(prompt/lyrics/instrumental/reference 等) ----
const murekaBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // mureka-6 | mureka-5 等
  lyrics: z.string().optional(),
  instrumental: z.boolean().optional(),
  reference_id: z.string().optional(),
  reference_audio: z.string().optional(),
  vocal_gender: z.string().optional(),
  negative_language_ids: z.array(z.string()).optional(),
})

// ---- hume Octave TTS 官方参数(text/utterances/voice/context 等) ----
const humeTtsBody = z.object({
  text: z.string().optional(),
  utterances: z.array(z.unknown()).optional(),
  model: z.string().optional(), // OCTAVE_V2 | OCTAVE
  voice: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  split_utterances: z.boolean().optional(),
})

// ---- inworld TTS 官方参数(text/voiceId/modelId/audioConfig 等) ----
const inworldTtsBody = z.object({
  text: z.string().optional(),
  voiceId: z.string().optional(),
  modelId: z.string().optional(),
  audioConfig: z.record(z.string(), z.unknown()).optional(),
  temperature: z.number().optional(),
})

// ---- soniox STT 官方参数(model/file_url/audio/语言与说话人分离等) ----
const sonioxBody = z.object({
  model: z.string().optional(),
  file_url: z.string().optional(),
  audio: z.string().optional(), // base64 音频
  file_format: z.string().optional(),
  language_hints: z.array(z.string()).optional(),
  enable_speaker_diarization: z.boolean().optional(),
  enable_language_identification: z.boolean().optional(),
  client_request_id: z.string().optional(),
})

// ---- gladia STT v2 官方参数(audio_url 直传 + 转写选项) ----
const gladiaBody = z.object({
  audio_url: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  languages: z.array(z.string()).optional(),
  detect_language: z.boolean().optional(),
  toggle_diarization: z.boolean().optional(),
  toggle_noise_reduction: z.boolean().optional(),
  custom_vocabulary: z.array(z.string()).optional(),
  callback_url: z.string().optional(),
})

// ---- getimg 官方参数(prompt/model/宽高/steps/guidance 等,pipeline 决定端点段) ----
const getimgBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // realistic-vision-v5-1 | flux-dev 等
  pipeline: z.string().optional(), // stable-diffusion | flux | sd3
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  steps: z.number().int().optional(),
  guidance: z.number().optional(),
  negative_prompt: z.string().optional(),
  seed: z.number().int().optional(),
  output_format: z.string().optional(),
  response_format: z.string().optional(),
})

// ---- bria 官方参数(prompt/num_results/sync/aspect_ratio/medium/palette 等) ----
const briaBody = z.object({
  prompt: z.string().optional(),
  num_results: z.number().int().optional(),
  sync: z.boolean().optional(),
  aspect_ratio: z.string().optional(),
  negative_prompt: z.string().optional(),
  seed: z.number().int().optional(),
  steps: z.number().int().optional(),
  guidance_scale: z.number().optional(),
  medium: z.string().optional(),
  palette: z.array(z.unknown()).optional(),
})

// ---- freepik 官方参数(prompt/model/engine/stylization/creativity 等) ----
const freepikBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // mystic | classic-fast | flux-dev 等
  num_images: z.number().int().optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.string().optional(),
  seed: z.number().int().optional(),
  engine: z.string().optional(), // mystic 专用 automatic | magnific_illusio 等
  stylization: z.number().optional(),
  creativity: z.number().optional(),
  filter_nsfw: z.boolean().optional(),
  webhook_url: z.string().optional(),
  fixed_generation: z.boolean().optional(),
})

// fal 官方双域名(官方文档):fal.run=同步生成(POST /{model} 直接返回生成结果);
// queue.fal.run=异步队列(POST /{model} 提交,/requests/{id}/status|结果轮询)。
// 显式定义,不再从 VENDORS.fal.baseUrl replace 派生(baseUrl 本就是 queue 域名,replace 永不命中)。
const FAL_SYNC_BASE = 'https://fal.run'
const FAL_QUEUE_BASE = 'https://queue.fal.run'

// 通配参数:承接含 / 的完整 model 路径(如 fal-ai/flux/dev),单段 :model 参数接不住
const falWildcardParam = z.object({ '*': z.string().min(1) })
const falTaskQuery = z.object({ model: z.string().optional(), full: z.string().optional() })
const requestIdParam = z.object({ requestId: z.string() })
const freepikTaskQuery = z.object({
  model: z.string().optional(),
  // 提交响应附带 poll_model;轮询时 ?model= 缺省可回传 poll_model(向后兼容:均缺省 mystic)
  poll_model: z.string().optional(),
})

export const extendedMediaVendorRoutes5: FastifyPluginAsync = async (server) => {
  // ============ 聚合:fal 同步生成(官方端点 POST https://fal.run/{model}) ============
  server.post(
    '/fal/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'fal 同步生成(Flux/Kling/Veo 等数百模型)',
        description:
          '代理调用 https://fal.run/{model}(官方同步端点,body.model 必填形如 fal-ai/flux/dev,' +
          '其余字段为该模型官方输入参数直接透传),Bearer FAL key',
        tags: ['AI', 'fal', '生成'],
        body: falBody,
      }),
    },
    async (request, reply) => {
      const body = falBody.parse(request.body ?? {})
      if (!body.model) return reply.status(400).send(error(400, 'model 必填(如 fal-ai/flux/dev)'))
      const key = requireVendorKey('fal', reply)
      if (!key) return
      const { model, ...rest } = body
      const data = await callVendor('fal', `${FAL_SYNC_BASE}/${model}`, reply, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: JSON.stringify(rest),
      })
      if (data === null) return
      recordUsage(request.userId!, 'fal')
      return reply.send(success(data))
    },
  )

  // ============ 聚合:fal 队列异步提交(官方端点 POST https://queue.fal.run/{model}) ============
  // 用通配 * 而非单段 :model:官方 model id 形如 fal-ai/flux/dev 自带 /,单段参数接不住
  server.post(
    '/fal/queue/*',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'fal 队列异步提交',
        description:
          '代理调用 https://queue.fal.run/{model}(官方队列提交,完整 model 路径在 URL 通配段,' +
          '如 fal-ai/flux/dev,返回 request_id/status_url 等上游 JSON)',
        tags: ['AI', 'fal', '生成'],
        params: falWildcardParam,
        body: falBody,
      }),
    },
    async (request, reply) => {
      const { '*': model } = falWildcardParam.parse(request.params)
      const body = falBody.parse(request.body ?? {})
      const key = requireVendorKey('fal', reply)
      if (!key) return
      const data = await callVendor('fal', `${FAL_QUEUE_BASE}/${model}`, reply, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'fal')
      return reply.send(success(data))
    },
  )

  // ============ 聚合:fal 队列状态/结果(官方端点 GET https://queue.fal.run/{model}/requests/{id}) ============
  server.get(
    '/fal/tasks/:requestId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'fal 队列任务查询',
        description:
          '代理调用 https://queue.fal.run/{model}/requests/{requestId}/status 查询状态;' +
          '加 ?full=1 取 /requests/{requestId} 完整结果(model 查询参数与提交时一致)',
        tags: ['AI', 'fal', '生成'],
        params: requestIdParam,
        querystring: falTaskQuery,
      }),
    },
    async (request, reply) => {
      const { requestId } = requestIdParam.parse(request.params)
      const q = falTaskQuery.parse(request.query ?? {})
      if (!q.model) return reply.status(400).send(error(400, 'model 查询参数必填(与提交时一致)'))
      const key = requireVendorKey('fal', reply)
      if (!key) return
      // requestId 须编码后再拼 URL(防注入/含特殊字符的 id 破坏路径)
      const requestIdEncoded = encodeURIComponent(requestId)
      const url =
        q.full === '1'
          ? `${FAL_QUEUE_BASE}/${q.model}/requests/${requestIdEncoded}`
          : `${FAL_QUEUE_BASE}/${q.model}/requests/${requestIdEncoded}/status`
      const data = await callVendor('fal', url, reply, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // ============ 音乐:mureka(官方端点 POST https://api.mureka.ai/v1/music/generate) ============
  server.post(
    '/mureka/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Mureka 音乐生成(昆仑万维天工)',
        description:
          '代理调用 https://api.mureka.ai/v1/music/generate(官方全参数,prompt/lyrics/' +
          'instrumental/reference_id 等),Bearer 鉴权,JSON 透传',
        tags: ['AI', 'Mureka', '音乐'],
        body: murekaBody,
      }),
    },
    async (request, reply) => {
      const body = murekaBody.parse(request.body ?? {})
      const key = requireVendorKey('mureka', reply)
      if (!key) return
      const data = await callVendor(
        'mureka',
        `${VENDORS.mureka!.baseUrl}/v1/music/generate`,
        reply,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'mureka')
      return reply.send(success(data))
    },
  )

  // ============ 音乐:mureka 任务查询(官方端点 GET https://api.mureka.ai/v1/music/{id}) ============
  server.get(
    '/mureka/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Mureka 任务查询',
        description: '代理调用 /v1/music/{taskId}(GET,官方 JSON 透传)',
        tags: ['AI', 'Mureka', '音乐'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const key = requireVendorKey('mureka', reply)
      if (!key) return
      const data = await callVendor(
        'mureka',
        `${VENDORS.mureka!.baseUrl}/v1/music/${encodeURIComponent(taskId)}`,
        reply,
        { method: 'GET', headers: { Authorization: `Bearer ${key}` } },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // ============ 语音:hume Octave TTS(官方端点 POST https://api.hume.ai/v0/tts) ============
  server.post(
    '/hume/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Hume Octave TTS',
        description:
          '代理调用 https://api.hume.ai/v0/tts(官方全参数,text 或 utterances 数组,' +
          'model 缺省 OCTAVE_V2),X-Hume-Api-Key 鉴权,JSON 透传',
        tags: ['AI', 'Hume', '语音'],
        body: humeTtsBody,
      }),
    },
    async (request, reply) => {
      const body = humeTtsBody.parse(request.body ?? {})
      const key = requireVendorKey('hume', reply)
      if (!key) return
      const payload: Record<string, unknown> = { model: body.model ?? 'OCTAVE_V2', ...body }
      const data = await callVendor('hume', `${VENDORS.hume!.baseUrl}/v0/tts`, reply, {
        method: 'POST',
        headers: { 'X-Hume-Api-Key': key },
        body: JSON.stringify(payload),
      })
      if (data === null) return
      recordUsage(request.userId!, 'hume')
      return reply.send(success(data))
    },
  )

  // ============ 语音:hume 音色列表(官方端点 GET https://api.hume.ai/v0/tts/voices) ============
  server.get(
    '/hume/voices',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Hume Octave 音色列表',
        description: '代理调用 /v0/tts/voices(GET,官方 JSON 透传)',
        tags: ['AI', 'Hume', '语音'],
      }),
    },
    async (_request, reply) => {
      const key = requireVendorKey('hume', reply)
      if (!key) return
      const data = await callVendor('hume', `${VENDORS.hume!.baseUrl}/v0/tts/voices`, reply, {
        method: 'GET',
        headers: { 'X-Hume-Api-Key': key },
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // ============ 语音:inworld TTS(官方端点 POST https://api.inworld.ai/tts/v1/voice:tts) ============
  server.post(
    '/inworld/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Inworld TTS',
        description:
          '代理调用 https://api.inworld.ai/tts/v1/voice:tts(官方全参数,text/voiceId/' +
          'modelId/audioConfig),Basic 鉴权,JSON 透传',
        tags: ['AI', 'Inworld', '语音'],
        body: inworldTtsBody,
      }),
    },
    async (request, reply) => {
      const body = inworldTtsBody.parse(request.body ?? {})
      const key = requireVendorKey('inworld', reply)
      if (!key) return
      const data = await callVendor('inworld', `${VENDORS.inworld!.baseUrl}/tts/v1/voice:tts`, reply, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'inworld')
      return reply.send(success(data))
    },
  )

  // ============ 语音:soniox STT(官方端点 POST https://api.soniox.com/v1/transcriptions) ============
  server.post(
    '/soniox/transcribe',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Soniox 语音转文本',
        description:
          '代理调用 https://api.soniox.com/v1/transcriptions(官方全参数,file_url 公网音频或' +
          'audio base64 直传,language_hints/说话人分离等),Bearer 鉴权,JSON 透传',
        tags: ['AI', 'Soniox', '语音'],
        body: sonioxBody,
      }),
    },
    async (request, reply) => {
      const body = sonioxBody.parse(request.body ?? {})
      const key = requireVendorKey('soniox', reply)
      if (!key) return
      const data = await callVendor('soniox', `${VENDORS.soniox!.baseUrl}/v1/transcriptions`, reply, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'soniox')
      return reply.send(success(data))
    },
  )

  // ============ 语音:gladia STT(官方端点 POST https://api.gladia.io/v2/pre-recorded) ============
  server.post(
    '/gladia/transcribe',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Gladia 语音转文本(audio_url 直传)',
        description:
          '代理调用 https://api.gladia.io/v2/pre-recorded(官方 v2 预录制转写,audio_url 直传' +
          '模式,language/diarization 等官方参数),x-gladia-key 鉴权,JSON 透传',
        tags: ['AI', 'Gladia', '语音'],
        body: gladiaBody,
      }),
    },
    async (request, reply) => {
      const body = gladiaBody.parse(request.body ?? {})
      const key = requireVendorKey('gladia', reply)
      if (!key) return
      const data = await callVendor('gladia', `${VENDORS.gladia!.baseUrl}/v2/pre-recorded`, reply, {
        method: 'POST',
        headers: { 'x-gladia-key': key },
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'gladia')
      return reply.send(success(data))
    },
  )

  // ============ 图像:getimg(官方端点 POST https://api.getimg.ai/v1/{pipeline}/text-to-image) ============
  server.post(
    '/getimg/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'GetImg 文生图(多管线)',
        description:
          '代理调用 https://api.getimg.ai/v1/{pipeline}/text-to-image(pipeline 缺省 ' +
          'stable-diffusion,支持 flux/sd3 等,model 为该管线官方模型名),Bearer 鉴权,JSON 透传',
        tags: ['AI', 'GetImg', '图像'],
        body: getimgBody,
      }),
    },
    async (request, reply) => {
      const body = getimgBody.parse(request.body ?? {})
      const key = requireVendorKey('getimg', reply)
      if (!key) return
      const { pipeline, ...rest } = body
      const data = await callVendor(
        'getimg',
        `${VENDORS.getimg!.baseUrl}/v1/${pipeline ?? 'stable-diffusion'}/text-to-image`,
        reply,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: JSON.stringify(rest),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'getimg')
      return reply.send(success(data))
    },
  )

  // ============ 图像:bria(官方端点 POST https://api.bria.ai/v1/text-to-image/base/2.2) ============
  server.post(
    '/bria/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Bria 文生图(2.2 基础版)',
        description:
          '代理调用 https://api.bria.ai/v1/text-to-image/base/2.2(官方全参数,prompt/' +
          'aspect_ratio/medium/palette 等,sync 缺省 true 同步返回),api_token 鉴权,JSON 透传',
        tags: ['AI', 'Bria', '图像'],
        body: briaBody,
      }),
    },
    async (request, reply) => {
      const body = briaBody.parse(request.body ?? {})
      const key = requireVendorKey('bria', reply)
      if (!key) return
      const payload: Record<string, unknown> = { sync: true, ...body }
      const data = await callVendor(
        'bria',
        `${VENDORS.bria!.baseUrl}/v1/text-to-image/base/2.2`,
        reply,
        {
          method: 'POST',
          headers: { api_token: key },
          body: JSON.stringify(payload),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'bria')
      return reply.send(success(data))
    },
  )

  // ============ 聚合:freepik 文生图(官方端点 POST https://api.freepik.com/v1/ai/text-to-image/{model}) ============
  server.post(
    '/freepik/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Freepik 文生图(Mystic 等聚合模型)',
        description:
          '代理调用 https://api.freepik.com/v1/ai/text-to-image/{model}(model 缺省 mystic,' +
          'engine/stylization/creativity 等 Mystic 官方参数),x-freepik-api-key 鉴权;' +
          '返回上游 data.task_id 并附带本次使用的 poll_model,用 /freepik/tasks/:taskId' +
          '?model={poll_model} 轮询',
        tags: ['AI', 'Freepik', '图像'],
        body: freepikBody,
      }),
    },
    async (request, reply) => {
      const body = freepikBody.parse(request.body ?? {})
      const key = requireVendorKey('freepik', reply)
      if (!key) return
      const { model, ...rest } = body
      const usedModel = model ?? 'mystic'
      const data = await callVendor(
        'freepik',
        `${VENDORS.freepik!.baseUrl}/v1/ai/text-to-image/${usedModel}`,
        reply,
        {
          method: 'POST',
          headers: { 'x-freepik-api-key': key },
          body: JSON.stringify(rest),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'freepik')
      // 提交与轮询的 ?model= 默认各自独立会导致轮询打到错误模型端点;
      // 上游返回 task_id(顶层或 data[] 内)时附加本次使用的 poll_model,
      // 调用方轮询 /freepik/tasks/:taskId 时以 ?model= 原样传回
      const dataObj = data as Record<string, unknown>
      const items = Array.isArray(dataObj.data) ? dataObj.data : [dataObj]
      if (items.some((it) => typeof it === 'object' && it !== null && 'task_id' in it)) {
        return reply.send(success({ ...dataObj, poll_model: usedModel }))
      }
      return reply.send(success(data))
    },
  )

  // ============ 聚合:freepik 任务查询(官方端点 GET https://api.freepik.com/v1/ai/text-to-image/{model}/{task_id}) ============
  server.get(
    '/freepik/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Freepik 任务查询',
        description:
          '代理调用 /v1/ai/text-to-image/{model}/{taskId}(GET,task id 取上游 task_id 字段,' +
          'model 查询参数与提交时一致(可直接传提交返回的 poll_model),均缺省 mystic)',
        tags: ['AI', 'Freepik', '图像'],
        params: taskIdParam,
        querystring: freepikTaskQuery,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const q = freepikTaskQuery.parse(request.query ?? {})
      const key = requireVendorKey('freepik', reply)
      if (!key) return
      const usedModel = q.model ?? q.poll_model ?? 'mystic'
      const data = await callVendor(
        'freepik',
        `${VENDORS.freepik!.baseUrl}/v1/ai/text-to-image/${usedModel}/${encodeURIComponent(taskId)}`,
        reply,
        { method: 'GET', headers: { 'x-freepik-api-key': key } },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
