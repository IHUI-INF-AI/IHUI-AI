// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展媒体代理子路由(2026-09-20 四大模态补齐):
 *   图像  Stability /v2beta/stable-image(同步 multipart)+ Flux BFL /v1/{model}(异步轮询)
 *   视频  Kling /v1/videos(JWT 签名异步)+ Runway /v1/text_to_video|image_to_video +
 *         Luma /dream-machine/v1/generations + MiniMax /v1/video_generation
 *   音频  MiniMax /v1/music_generation(同步)+ ElevenLabs TTS/音效(二进制→base64)
 *
 * 异步任务统一走 createTask/taskStore 模式(与 sora2/agnes 一致):本地 taskId → 上游 id → 轮询。
 */
import { z } from 'zod'
import { createHmac } from 'crypto'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import {
  requireAuth,
  callVendor,
  fetchWithTimeout,
  recordUsage,
  createTask,
  requireVendorKey,
  requireVendorKeys,
  taskStore,
  VENDORS,
  taskIdParam,
  type FastifyPluginAsync,
} from './_shared.js'

// ---- Stability 官方参数(aspect_ratio/seed/negative_prompt/cfg_scale 等) ----
const stabilityBody = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(), // core | ultra | sd3.5-large | sd3.5-medium ...
  aspect_ratio: z.string().optional(), // 16:9 | 1:1 | 21:9 ...
  negative_prompt: z.string().optional(),
  seed: z.number().int().optional(),
  cfg_scale: z.number().optional(),
  output_format: z.string().optional(), // png | jpeg | webp
})

// ---- Flux(BFL)官方参数(prompt/width/height/prompt_upsampling/seed 等) ----
const fluxBody = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(), // flux-pro-1.1 | flux-pro-1.1-ultra | flux-dev | flux-kontext-pro ...
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  aspect_ratio: z.string().optional(),
  raw: z.boolean().optional(),
  prompt_upsampling: z.boolean().optional(),
  seed: z.number().int().optional(),
  safety_tolerance: z.number().int().min(0).max(6).optional(),
  output_format: z.string().optional(),
  image_prompt: z.string().optional(), // 图生图/编辑(base64 或 URL, kontext 系列)
})

// ---- Kling 可灵官方参数(model_name/prompt/cfg_scale/aspect_ratio/duration 等) ----
const klingBody = z.object({
  prompt: z.string().optional(),
  negative_prompt: z.string().optional(),
  model: z.string().optional(), // kling-v3 | kling-v2-master | kling-v2-1
  cfg_scale: z.number().optional(),
  aspect_ratio: z.string().optional(),
  duration: z.string().optional(), // "5" | "10"
  mode: z.string().optional(), // std | pro
  image: z.string().optional(), // 图生视频:base64 或 URL
  image_tail: z.string().optional(), // 首尾帧模式的尾帧
  camera_control: z.record(z.string(), z.unknown()).optional(),
})

// ---- Runway 官方参数(promptText/model/ratio/duration/seed 等) ----
const runwayBody = z.object({
  prompt: z.string().optional(), // 映射 promptText
  model: z.string().optional(), // gen4_turbo | gen3_alpha_turbo
  ratio: z.string().optional(), // 1280:720 | 720:1280 ...
  duration: z.number().int().optional(), // 5 | 10
  seed: z.number().int().optional(),
  image: z.string().optional(), // 图生视频:URL(promptImage)
})

// ---- Luma 官方参数(prompt/model/resolution/duration/aspect_ratio 等) ----
const lumaBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // ray-2 | ray-flash-2
  resolution: z.string().optional(), // 720p | 1080p | 4k
  duration: z.string().optional(), // "5s" | "9s"
  aspect_ratio: z.string().optional(),
  image: z.string().optional(), // 图生视频(keyframes.image0)
  image_end: z.string().optional(), // 尾帧(keyframes.image1)
  loop: z.boolean().optional(),
})

// ---- MiniMax 官方参数(model/prompt/first_frame_image 等) ----
const minimaxVideoBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // video-01 | video-01-live | T2V-01 ...
  first_frame_image: z.string().optional(),
  prompt_optimizer: z.boolean().optional(),
  callback_url: z.string().optional(),
})

const minimaxMusicBody = z.object({
  prompt: z.string().optional(), // 歌词或曲风描述
  lyrics: z.string().optional(),
  audio_type: z.string().optional(), // instrumental | male | female
  sample_rate: z.number().int().optional(),
  bitrate: z.number().int().optional(),
  format: z.string().optional(), // mp3 | flac | wav
})

// ---- ElevenLabs TTS 官方参数(text/model_id/voice_settings 等) ----
const elevenlabsTtsBody = z.object({
  text: z.string().min(1),
  voiceId: z.string().optional(), // 默认 Rachel
  model: z.string().optional(), // eleven_multilingual_v2 | eleven_turbo_v2_5 ...
  stability: z.number().optional(),
  similarity_boost: z.number().optional(),
  style: z.number().optional(),
  speed: z.number().optional(),
  output_format: z.string().optional(), // mp3_44100_128 ...
})

const elevenlabsSfxBody = z.object({
  text: z.string().min(1),
  durationSeconds: z.number().optional(),
  promptInfluence: z.number().optional(),
})

/** Kling 官方 JWT 签名(HMAC-SHA256,iss=AK,exp=+30min) */
function klingJwt(ak: string, sk: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ iss: ak, exp: now + 1800, nbf: now - 5 })
  const sig = createHmac('sha256', sk).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

/** 从任务结果提取上游 ID(创建响应形如 {id} / {task_id} / {data.task_id}) */
function extractUpstreamId(raw: unknown): string {
  const r = (raw ?? {}) as Record<string, unknown>
  const inner = (r.data ?? {}) as Record<string, unknown>
  return String(r.id ?? r.task_id ?? inner.task_id ?? r.request_id ?? '')
}

/** 统一任务查询端点:校验归属 + 轮询上游 + 状态映射 */
async function pollTask(
  vendor: string,
  taskId: string,
  userId: string,
  pollFn: (upstreamId: string) => Promise<{ data: unknown; status?: string; upstreamId?: string }>,
) {
  const task = taskStore.get(taskId)
  if (!task || task.vendor !== vendor || task.userId !== userId) return null
  const raw = (task.result ?? {}) as Record<string, unknown>
  const upstreamId =
    (raw.upstreamId as string) || extractUpstreamId(raw) || (raw.id as string) || ''
  const polled = await pollFn(upstreamId)
  if (polled.data) task.result = polled.data
  if (polled.upstreamId) (task.result as Record<string, unknown>).upstreamId = polled.upstreamId
  const status = polled.status
  if (['succeeded', 'completed', 'done', 'finished'].includes(status ?? '')) {
    task.status = 'succeeded'
  } else if (['failed', 'error', 'cancelled'].includes(status ?? '')) {
    task.status = 'failed'
  } else if (task.status === 'pending') {
    task.status = 'running'
  }
  task.updatedAt = Date.now()
  return task
}

export const extendedMediaVendorRoutes: FastifyPluginAsync = async (server) => {
  // ============ 图像:Stability(同步,multipart/form-data) ============
  server.post(
    '/stability/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Stability AI 文生图',
        description:
          '代理调用 https://api.stability.ai/v2beta/stable-image/generate/{model}(官方 multipart 参数透传),' +
          'Accept: application/json 返回 base64 图片;model 缺省 core',
        tags: ['AI', 'Stability', '图像'],
        body: stabilityBody,
      }),
    },
    async (request, reply) => {
      const body = stabilityBody.parse(request.body)
      const key = requireVendorKey('stability', reply)
      if (!key) return
      const model = body.model ?? 'core'
      const form = new FormData()
      form.append('prompt', body.prompt)
      form.append('output_format', body.output_format ?? 'png')
      if (body.aspect_ratio) form.append('aspect_ratio', body.aspect_ratio)
      if (body.negative_prompt) form.append('negative_prompt', body.negative_prompt)
      if (body.seed !== undefined) form.append('seed', String(body.seed))
      if (body.cfg_scale !== undefined) form.append('cfg_scale', String(body.cfg_scale))
      const resp = await fetchWithTimeout(
        `${VENDORS.stability!.baseUrl}/v2beta/stable-image/generate/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json', // 返回 {image: base64, finish_reason, seed}
          },
          body: form,
        },
        120_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply
          .status(502)
          .send(error(502, `Stability 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`))
      }
      recordUsage(request.userId!, 'stability')
      return reply.send(success({ model, ...data }))
    },
  )

  // ============ 图像:Flux BFL(异步创建+轮询) ============
  server.post(
    '/flux/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Flux(BFL) 文生图',
        description:
          '代理调用 https://api.bfl.ai/v1/{model} 创建生图任务(官方全参数),' +
          'model 缺省 flux-pro-1.1;返回本地 taskId,用 /flux/tasks/:taskId 轮询',
        tags: ['AI', 'Flux', '图像'],
        body: fluxBody,
      }),
    },
    async (request, reply) => {
      const body = fluxBody.parse(request.body)
      const key = requireVendorKey('flux', reply)
      if (!key) return
      const model = body.model ?? 'flux-pro-1.1'
      const { image_prompt, ...rest } = body
      const payload: Record<string, unknown> = { ...rest, prompt: body.prompt }
      if (image_prompt) payload.image_prompt = image_prompt
      const resp = await fetchWithTimeout(
        `${VENDORS.flux!.baseUrl}/v1/${model}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-key': key, // BFL 官方用 x-key 头(见 VENDORS.flux.authHeader)
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
        60_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply
          .status(502)
          .send(error(502, `Flux 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`))
      }
      const task = createTask(request.userId!, 'flux', 'image', data)
      recordUsage(request.userId!, 'flux')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/flux/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Flux 任务查询',
        description: '代理调用 https://api.bfl.ai/v1/get_result?id={上游id} 轮询生图结果',
        tags: ['AI', 'Flux', '图像'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'flux' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstreamId = extractUpstreamId(task.result)
      const upstream = await callVendor('flux', `${VENDORS.flux!.baseUrl}/v1/get_result?id=${upstreamId}`, reply, {
        method: 'GET',
      })
      if (upstream) {
        const st = (upstream as { status?: string }).status
        task.result = upstream
        if (st === 'Ready') task.status = 'succeeded'
        else if (st === 'Error' || st === 'Content Moderated') task.status = 'failed'
        else if (task.status === 'pending') task.status = 'running'
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  // ============ 视频:Kling(可灵,JWT 签名异步) ============
  const klingTaskRoute = (kind: 'text2video' | 'image2video') =>
    `https://api.klingai.com/v1/videos/${kind}`

  server.post(
    '/kling/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Kling 可灵文生视频',
        description:
          '代理调用 https://api.klingai.com/v1/videos/text2video(官方 JWT 鉴权,全参数透传);' +
          '带 image 参数时自动切换 /v1/videos/image2video 图生视频',
        tags: ['AI', 'Kling', '视频'],
        body: klingBody,
      }),
    },
    async (request, reply) => {
      const body = klingBody.parse(request.body)
      const keys = requireVendorKeys('kling', reply)
      if (!keys) return
      const { image, image_tail, ...rest } = body
      const payload: Record<string, unknown> = {
        model_name: body.model ?? 'kling-v3',
        ...rest,
      }
      if (image_tail) payload.image_tail = image_tail
      if (image) payload.image = image
      const kind = image ? 'image2video' : 'text2video'
      const resp = await fetchWithTimeout(
        klingTaskRoute(kind),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${klingJwt(keys.key, keys.secret)}`,
          },
          body: JSON.stringify(payload),
        },
        60_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply
          .status(502)
          .send(error(502, `Kling 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`))
      }
      const task = createTask(request.userId!, 'kling', 'video', { ...data, _kind: kind })
      recordUsage(request.userId!, 'kling')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/kling/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Kling 任务查询',
        description: '代理调用 https://api.klingai.com/v1/videos/{text2video|image2video}/{上游id} 轮询',
        tags: ['AI', 'Kling', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const keys = requireVendorKeys('kling', reply)
      if (!keys) return
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'kling' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const raw = (task.result ?? {}) as { _kind?: string; data?: { task_id?: string } }
      const upstreamId = raw.data?.task_id ?? ''
      const upstream = await callVendor(
        'kling',
        `${klingTaskRoute((raw._kind as 'text2video' | 'image2video') ?? 'text2video')}/${upstreamId}`,
        reply,
        { method: 'GET', headers: { Authorization: `Bearer ${klingJwt(keys.key, keys.secret)}` } },
      )
      if (upstream) {
        task.result = {
          ...(task.result as Record<string, unknown>),
          ...(upstream as Record<string, unknown>),
        }
        const st = (upstream as { data?: { task_status?: string } }).data?.task_status
        if (st === 'succeed') task.status = 'succeeded'
        else if (st === 'failed') task.status = 'failed'
        else if (st === 'submitted' || st === 'processing') task.status = 'running'
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  // ============ 视频:Runway(Gen-4) ============
  server.post(
    '/runway/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Runway 文生/图生视频',
        description:
          '代理调用 https://api.dev.runwayml.com/v1/text_to_video(带 image 时切 image_to_video),' +
          'model 缺省 gen4_turbo;X-Runway-Version: 2024-11-06',
        tags: ['AI', 'Runway', '视频'],
        body: runwayBody,
      }),
    },
    async (request, reply) => {
      const body = runwayBody.parse(request.body)
      const key = requireVendorKey('runway', reply)
      if (!key) return
      const { image } = body
      const payload: Record<string, unknown> = {
        model: body.model ?? 'gen4_turbo',
        promptText: body.prompt,
        ratio: body.ratio ?? '1280:720',
        duration: body.duration ?? 5,
        ...(body.seed !== undefined ? { seed: body.seed } : {}),
      }
      if (image) payload.promptImage = image
      const endpoint = image ? '/v1/image_to_video' : '/v1/text_to_video'
      const data = await callVendor('runway', `${VENDORS.runway!.baseUrl}${endpoint}`, reply, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (data === null) return
      const task = createTask(request.userId!, 'runway', 'video', data)
      recordUsage(request.userId!, 'runway')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/runway/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Runway 任务查询',
        description: '代理调用 https://api.dev.runwayml.com/v1/tasks/{上游id} 轮询任务状态',
        tags: ['AI', 'Runway', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = await pollTask('runway', taskId, request.userId!, async (upstreamId) => {
        const upstream = await callVendor(
          'runway',
          `${VENDORS.runway!.baseUrl}/v1/tasks/${upstreamId}`,
          reply,
          { method: 'GET' },
        )
        if (!upstream) return { data: null }
        const st = (upstream as { status?: string }).status
        return { data: upstream, status: st === 'SUCCEEDED' ? 'succeeded' : st === 'FAILED' ? 'failed' : st?.toLowerCase() }
      })
      if (!task) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success(task))
    },
  )

  // ============ 视频:Luma Dream Machine ============
  server.post(
    '/luma/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Luma Dream Machine 文生/图生视频',
        description:
          '代理调用 https://api.lumalabs.ai/dream-machine/v1/generations(官方全参数),' +
          'model 缺省 ray-2;带 image 参数时写 keyframes.image0 图生视频',
        tags: ['AI', 'Luma', '视频'],
        body: lumaBody,
      }),
    },
    async (request, reply) => {
      const body = lumaBody.parse(request.body)
      const key = requireVendorKey('luma', reply)
      if (!key) return
      const { image, image_end, ...rest } = body
      const payload: Record<string, unknown> = {
        prompt: body.prompt ?? '',
        model: body.model ?? 'ray-2',
        resolution: body.resolution ?? '720p',
        duration: body.duration ?? '5s',
        ...rest,
      }
      if (image) {
        payload.keyframes = {
          image0: { type: 'image', url: image },
          ...(image_end ? { image1: { type: 'image', url: image_end } } : {}),
        }
      }
      const data = await callVendor(
        'luma',
        `${VENDORS.luma!.baseUrl}/dream-machine/v1/generations`,
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'luma', 'video', data)
      recordUsage(request.userId!, 'luma')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/luma/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Luma 任务查询',
        description: '代理调用 /dream-machine/v1/generations/{上游id} 轮询(state: queued/dreaming/completed)',
        tags: ['AI', 'Luma', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = await pollTask('luma', taskId, request.userId!, async (upstreamId) => {
        const upstream = await callVendor(
          'luma',
          `${VENDORS.luma!.baseUrl}/dream-machine/v1/generations/${upstreamId}`,
          reply,
          { method: 'GET' },
        )
        if (!upstream) return { data: null }
        return { data: upstream, status: (upstream as { state?: string }).state }
      })
      if (!task) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success(task))
    },
  )

  // ============ 视频 + 音乐:MiniMax ============
  server.post(
    '/minimax/video',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'MiniMax 视频生成',
        description:
          '代理调用 https://api.minimax.chat/v1/video_generation(官方全参数),' +
          'model 缺省 T2V-01;返回任务 ID,用 /minimax/video/tasks/:taskId 轮询',
        tags: ['AI', 'MiniMax', '视频'],
        body: minimaxVideoBody,
      }),
    },
    async (request, reply) => {
      const body = minimaxVideoBody.parse(request.body)
      const key = requireVendorKey('minimax', reply)
      if (!key) return
      const payload = { model: body.model ?? 'T2V-01', ...body }
      const data = await callVendor(
        'minimax',
        'https://api.minimax.chat/v1/video_generation',
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'minimax', 'video', data)
      recordUsage(request.userId!, 'minimax')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/minimax/video/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'MiniMax 视频任务查询',
        description: '代理调用 /v1/query/video_generation?task_id={上游id} 轮询',
        tags: ['AI', 'MiniMax', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = await pollTask('minimax', taskId, request.userId!, async (upstreamId) => {
        const upstream = await callVendor(
          'minimax',
          `https://api.minimax.chat/v1/query/video_generation?task_id=${upstreamId}`,
          reply,
          { method: 'GET' },
        )
        if (!upstream) return { data: null }
        return { data: upstream, status: (upstream as { status?: string }).status }
      })
      if (!task) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success(task))
    },
  )

  server.post(
    '/minimax/music',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'MiniMax 音乐生成',
        description:
          '代理调用 https://api.minimax.chat/v1/music_generation(同步返回 base64 音频),' +
          'prompt/lyrics/audio_type 等官方参数',
        tags: ['AI', 'MiniMax', '音频'],
        body: minimaxMusicBody,
      }),
    },
    async (request, reply) => {
      const body = minimaxMusicBody.parse(request.body)
      const key = requireVendorKey('minimax', reply)
      if (!key) return
      const data = await callVendor(
        'minimax',
        'https://api.minimax.chat/v1/music_generation',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'minimax')
      return reply.send(success(data))
    },
  )

  // ============ 音频:ElevenLabs(TTS/音效/音色库) ============
  server.post(
    '/elevenlabs/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'ElevenLabs 文本转语音',
        description:
          '代理调用 https://api.elevenlabs.io/v1/text-to-speech/{voice_id}(官方全参数),' +
          'voiceId 缺省 Rachel;返回 base64 data URL 音频',
        tags: ['AI', 'ElevenLabs', '音频'],
        body: elevenlabsTtsBody,
      }),
    },
    async (request, reply) => {
      const body = elevenlabsTtsBody.parse(request.body)
      const key = requireVendorKey('elevenlabs', reply)
      if (!key) return
      const voiceId = body.voiceId ?? '21m00Tcm4TlvDq8ikWAM'
      const settings: Record<string, unknown> = {}
      if (body.stability !== undefined) settings.stability = body.stability
      if (body.similarity_boost !== undefined) settings.similarity_boost = body.similarity_boost
      if (body.style !== undefined) settings.style = body.style
      if (body.speed !== undefined) settings.speed = body.speed
      const resp = await fetchWithTimeout(
        `${VENDORS.elevenlabs!.baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}` +
          (body.output_format ? `?output_format=${body.output_format}` : ''),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
            'xi-api-key': key,
          },
          body: JSON.stringify({
            text: body.text,
            model_id: body.model ?? 'eleven_multilingual_v2',
            ...(Object.keys(settings).length > 0 ? { voice_settings: settings } : {}),
          }),
        },
        120_000,
      )
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        return reply
          .status(502)
          .send(
            error(502, `ElevenLabs 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 400)}`),
          )
      }
      const buf = Buffer.from(await resp.arrayBuffer())
      recordUsage(request.userId!, 'elevenlabs')
      return reply.send(
        success({
          audio: `data:audio/mpeg;base64,${buf.toString('base64')}`,
          bytes: buf.length,
          voiceId,
        }),
      )
    },
  )

  server.post(
    '/elevenlabs/sfx',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'ElevenLabs 音效生成',
        description: '代理调用 https://api.elevenlabs.io/v1/sound-generation(文字描述生成音效)',
        tags: ['AI', 'ElevenLabs', '音频'],
        body: elevenlabsSfxBody,
      }),
    },
    async (request, reply) => {
      const body = elevenlabsSfxBody.parse(request.body)
      const key = requireVendorKey('elevenlabs', reply)
      if (!key) return
      const resp = await fetchWithTimeout(
        `${VENDORS.elevenlabs!.baseUrl}/v1/sound-generation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
            'xi-api-key': key,
          },
          body: JSON.stringify({
            text: body.text,
            duration_seconds: body.durationSeconds,
            prompt_influence: body.promptInfluence,
          }),
        },
        120_000,
      )
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        return reply
          .status(502)
          .send(
            error(502, `ElevenLabs 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 400)}`),
          )
      }
      const buf = Buffer.from(await resp.arrayBuffer())
      recordUsage(request.userId!, 'elevenlabs')
      return reply.send(
        success({ audio: `data:audio/mpeg;base64,${buf.toString('base64')}`, bytes: buf.length }),
      )
    },
  )

  server.get(
    '/elevenlabs/voices',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'ElevenLabs 音色列表',
        description: '代理调用 https://api.elevenlabs.io/v1/voices 获取官方全量音色',
        tags: ['AI', 'ElevenLabs', '音频'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('elevenlabs', `${VENDORS.elevenlabs!.baseUrl}/v1/voices`, reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
