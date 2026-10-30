// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展媒体代理子路由 2(2026-09-20 n12d 平台补齐):
 *   图像  Ideogram /generate(同步 JSON,V3 文字渲染)+ Recraft /images/generations(同步,矢量生图)
 *   视频  Vidu /ent/v2/text2video|img2video(异步)+ PixVerse /openapi/v2/video(异步)
 *   音频  MiniMax /v1/t2a_v2(同步 hex→base64)+ Stability Audio /v2beta/audio/create +
 *         Fish Audio /v1/tts(同步二进制→base64)
 *
 * 异步任务统一走 createTask/taskStore 模式:本地 taskId → 上游 id → 轮询。
 */
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import {
  requireAuth,
  callVendor,
  fetchWithTimeout,
  recordUsage,
  createTask,
  requireVendorKey,
  taskStore,
  VENDORS,
  taskIdParam,
  type FastifyPluginAsync,
} from './_shared.js'

// ---- Ideogram V3 官方参数(prompt/aspect_ratio/style_type/magic_prompt_option 等) ----
const ideogramBody = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(), // V_3 | V_3_TURBO | V_2_TURBO ...
  aspect_ratio: z.string().optional(), // ASPECT_1_1 | ASPECT_16_9 | ASPECT_9_16 ...
  style_type: z.string().optional(), // AUTO | REALISTIC | DESIGN | RENDER_3D | ANIME
  magic_prompt_option: z.string().optional(), // AUTO | ON | OFF
  seed: z.number().int().optional(),
  color_weight: z.number().optional(),
  palette: z.array(z.unknown()).optional(),
  negative_prompt: z.string().optional(),
})

// ---- Recraft 官方参数(OpenAI 兼容 + style/substyle/背景色等) ----
const recraftBody = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(), // recraftv3 | recraftv3_svg | recraft20b
  size: z.string().optional(), // 1024x1024 | 1365x1024 ...
  style: z.string().optional(), // realistic_image | digital_illustration | vector_illustration
  substyle: z.string().optional(),
  n: z.number().int().min(1).max(6).optional(),
  background_color: z.string().optional(),
  controls: z.record(z.string(), z.unknown()).optional(),
})

// ---- Vidu 官方参数(model/prompt/images/duration/resolution 等) ----
const viduBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // viduq1 | vidu2.0 | vidu1.5 | vidu1.0
  images: z.array(z.string()).optional(), // 图生视频(首帧 URL 数组,最多 7)
  duration: z.number().optional(), // 4 | 8
  resolution: z.string().optional(), // 720p | 1080p
  aspect_ratio: z.string().optional(), // 16:9 | 9:16 | 1:1
  bgm: z.boolean().optional(),
  off_peak: z.boolean().optional(),
  callback_url: z.string().optional(),
  seed: z.number().int().optional(),
})

// ---- PixVerse OpenAPI v2 官方参数(model/prompt/aspect_ratio/resolution 等) ----
const pixverseBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(), // v4.5 | v4 | v3.5
  aspect_ratio: z.string().optional(), // 16:9 | 9:16 | 1:1 | 4:3 | 3:4
  resolution: z.string().optional(), // 360p | 540p | 720p | 1080p
  duration: z.number().optional(), // 5 | 8
  negative_prompt: z.string().optional(),
  seed: z.number().int().optional(),
  style: z.string().optional(),
  motion_mode: z.number().int().optional(), // 0 普通 | 1 快速
  image: z.string().optional(), // 图生视频(公网 img_url)
})

// ---- MiniMax T2A v2 官方参数(text/voice_setting/audio_setting 等) ----
const minimaxTtsBody = z.object({
  text: z.string().min(1),
  model: z.string().optional(), // speech-02-hd | speech-02-turbo | speech-01-turbo ...
  voice: z.string().optional(), // voice_id,缺省 male-qn-qingse
  speed: z.number().optional(),
  vol: z.number().optional(),
  pitch: z.number().optional(),
  sample_rate: z.number().int().optional(),
  bitrate: z.number().int().optional(),
  format: z.string().optional(), // mp3 | flac | wav | pcm
  language_boost: z.string().optional(),
})

// ---- Stability Audio 官方参数(prompt/model/duration/bpm/seed) ----
const stabilityAudioBody = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(), // stable-audio-2.5
  duration: z.number().optional(), // 秒(3-190)
  bpm: z.number().int().optional(),
  seed: z.number().int().optional(),
})

// ---- Fish Audio TTS 官方参数(text/reference_id/format 等) ----
const fishaudioTtsBody = z.object({
  text: z.string().min(1),
  reference_id: z.string().optional(), // 声音克隆音色 ID
  format: z.string().optional(), // mp3 | wav | pcm
  mp3_bitrate: z.number().optional(),
  chunk_length: z.number().int().optional(),
  normalize: z.boolean().optional(),
  latency: z.boolean().optional(),
})

// ---- Zhipu CogVideoX 官方参数(model/prompt/quality/with_audio/size 等) ----
const zhipuVideoBody = z.object({
  model: z.string().optional(), // cogvideox-3 | cogvideox-2 | cogvideox
  prompt: z.string().optional(),
  negative_prompt: z.string().optional(),
  quality: z.string().optional(), // quality | secondary
  with_audio: z.boolean().optional(), // 生成音效
  image_url: z.string().optional(), // 图生视频首帧
  size: z.string().optional(), // 如 1920x1080 / 1080x1920
  fps: z.number().int().optional(), // 30 | 60
  duration: z.number().int().optional(), // 5 | 10
  request_id: z.string().optional(),
})

export const extendedMediaVendorRoutes2: FastifyPluginAsync = async (server) => {
  // ============ 图像:Ideogram(同步 JSON,V3) ============
  server.post(
    '/ideogram/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Ideogram 文生图(V3 文字渲染)',
        description:
          '代理调用 https://api.ideogram.ai/generate(官方 V3 全参数,image_request 包裹),' +
          'model 缺省 V_3;返回 image_url 列表',
        tags: ['AI', 'Ideogram', '图像'],
        body: ideogramBody,
      }),
    },
    async (request, reply) => {
      const body = ideogramBody.parse(request.body)
      const key = requireVendorKey('ideogram', reply)
      if (!key) return
      const { prompt, ...rest } = body
      const resp = await fetchWithTimeout(
        `${VENDORS.ideogram!.baseUrl}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': key,
          },
          body: JSON.stringify({
            image_request: { prompt, model: body.model ?? 'V_3', ...rest },
          }),
        },
        120_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply
          .status(502)
          .send(error(502, `Ideogram 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`))
      }
      recordUsage(request.userId!, 'ideogram')
      return reply.send(success(data))
    },
  )

  // ============ 图像:Recraft(同步,OpenAI 兼容) ============
  server.post(
    '/recraft/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Recraft 矢量生图',
        description:
          '代理调用 https://external.api.recraft.ai/v1/images/generations(官方全参数),' +
          'model 缺省 recraftv3,style 缺省 realistic_image',
        tags: ['AI', 'Recraft', '图像'],
        body: recraftBody,
      }),
    },
    async (request, reply) => {
      const body = recraftBody.parse(request.body)
      const key = requireVendorKey('recraft', reply)
      if (!key) return
      const resp = await fetchWithTimeout(
        `${VENDORS.recraft!.baseUrl}/images/generations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            prompt: body.prompt,
            model: body.model ?? 'recraftv3',
            size: body.size ?? '1024x1024',
            style: body.style ?? 'realistic_image',
            ...(body.substyle ? { substyle: body.substyle } : {}),
            ...(body.n ? { n: body.n } : {}),
            ...(body.background_color ? { background_color: body.background_color } : {}),
            ...(body.controls ? { controls: body.controls } : {}),
          }),
        },
        120_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply
          .status(502)
          .send(error(502, `Recraft 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`))
      }
      recordUsage(request.userId!, 'recraft')
      return reply.send(success(data))
    },
  )

  // ============ 视频:Vidu(异步 text2video/img2video) ============
  server.post(
    '/vidu/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Vidu 文生/图生视频',
        description:
          '代理调用 https://api.vidu.com/ent/v2/text2video(带 images 时切 img2video),' +
          'model 缺省 viduq1;返回本地 taskId,用 /vidu/tasks/:taskId 轮询',
        tags: ['AI', 'Vidu', '视频'],
        body: viduBody,
      }),
    },
    async (request, reply) => {
      const body = viduBody.parse(request.body)
      const key = requireVendorKey('vidu', reply)
      if (!key) return
      const { images, ...rest } = body
      const payload: Record<string, unknown> = { model: body.model ?? 'viduq1', ...rest }
      if (images) payload.images = images.map((url) => ({ url }))
      const kind = images ? 'img2video' : 'text2video'
      const data = await callVendor('vidu', `${VENDORS.vidu!.baseUrl}/ent/v2/${kind}`, reply, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (data === null) return
      const task = createTask(request.userId!, 'vidu', 'video', { ...data, _kind: kind })
      recordUsage(request.userId!, 'vidu')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/vidu/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Vidu 任务查询',
        description:
          '代理调用 /ent/v2/tasks/{上游id}/creations 轮询(state: queued/processing/success/failed)',
        tags: ['AI', 'Vidu', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'vidu' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstreamId = String(
        (task.result as { task_id?: string } | undefined)?.task_id ?? '',
      )
      const upstream = await callVendor(
        'vidu',
        `${VENDORS.vidu!.baseUrl}/ent/v2/tasks/${upstreamId}/creations`,
        reply,
        { method: 'GET' },
      )
      if (upstream) {
        task.result = { ...(task.result as Record<string, unknown>), ...(upstream as Record<string, unknown>) }
        const st = (upstream as { state?: string }).state
        if (st === 'success') task.status = 'succeeded'
        else if (st === 'failed') task.status = 'failed'
        else if (st === 'queued' || st === 'processing') task.status = 'running'
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  // ============ 视频:PixVerse(异步 text/image generate) ============
  server.post(
    '/pixverse/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'PixVerse 文生/图生视频',
        description:
          '代理调用 https://app-api.pixverse.ai/openapi/v2/video/text/generate' +
          '(带 image 时切 image/generate);返回本地 taskId,用 /pixverse/tasks/:taskId 轮询',
        tags: ['AI', 'PixVerse', '视频'],
        body: pixverseBody,
      }),
    },
    async (request, reply) => {
      const body = pixverseBody.parse(request.body)
      const key = requireVendorKey('pixverse', reply)
      if (!key) return
      const { image, ...rest } = body
      const kind = image ? 'image' : 'text'
      const payload: Record<string, unknown> = {
        model: body.model ?? 'v4.5',
        duration: body.duration ?? 5,
        quality: '540p',
        ...(image ? { img_url: image } : {}),
        ...rest,
      }
      const data = await callVendor(
        'pixverse',
        `${VENDORS.pixverse!.baseUrl}/openapi/v2/video/${kind}/generate`,
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'pixverse', 'video', { ...data, _kind: kind })
      recordUsage(request.userId!, 'pixverse')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/pixverse/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'PixVerse 任务查询',
        description:
          '代理调用 /openapi/v2/async/result?video_id={上游id} 轮询(status: 1 成功 | 2 生成中 | 3 排队 | 5 失败 | 7 审核)',
        tags: ['AI', 'PixVerse', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'pixverse' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const resp = (task.result ?? {}) as Record<string, unknown>
      const inner = (resp.Resp ?? {}) as Record<string, unknown>
      const upstreamId = String(inner.video_id ?? '')
      const upstream = await callVendor(
        'pixverse',
        `${VENDORS.pixverse!.baseUrl}/openapi/v2/async/result?video_id=${upstreamId}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) {
        task.result = {
          ...(task.result as Record<string, unknown>),
          ...(upstream as Record<string, unknown>),
        }
        const st = (upstream as { Resp?: { status?: number } }).Resp?.status
        if (st === 1) task.status = 'succeeded'
        else if (st === 5 || st === 7) task.status = 'failed'
        else if (st === 2 || st === 3) task.status = 'running'
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  // ============ 音频:MiniMax T2A v2(同步,hex→base64) ============
  server.post(
    '/minimax/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'MiniMax 文本转语音(T2A v2)',
        description:
          '代理调用 https://api.minimax.chat/v1/t2a_v2(官方全参数),voice 缺省 male-qn-qingse;' +
          '返回 base64 data URL 音频(上游 hex 自动解码)',
        tags: ['AI', 'MiniMax', '音频'],
        body: minimaxTtsBody,
      }),
    },
    async (request, reply) => {
      const body = minimaxTtsBody.parse(request.body)
      const key = requireVendorKey('minimax', reply)
      if (!key) return
      const voiceSetting: Record<string, unknown> = {
        voice_id: body.voice ?? 'male-qn-qingse',
      }
      if (body.speed !== undefined) voiceSetting.speed = body.speed
      if (body.vol !== undefined) voiceSetting.vol = body.vol
      if (body.pitch !== undefined) voiceSetting.pitch = body.pitch
      const audioSetting: Record<string, unknown> = {}
      if (body.sample_rate !== undefined) audioSetting.sample_rate = body.sample_rate
      if (body.bitrate !== undefined) audioSetting.bitrate = body.bitrate
      if (body.format !== undefined) audioSetting.format = body.format
      const data = (await callVendor('minimax', `${VENDORS.minimax!.baseUrl}/t2a_v2`, reply, {
        method: 'POST',
        body: JSON.stringify({
          model: body.model ?? 'speech-02-hd',
          text: body.text,
          stream: false,
          voice_setting: voiceSetting,
          ...(Object.keys(audioSetting).length > 0 ? { audio_setting: audioSetting } : {}),
          ...(body.language_boost ? { language_boost: body.language_boost } : {}),
        }),
      })) as { data?: { audio?: string }; base_resp?: Record<string, unknown> } | null
      if (data === null) return
      const hex = data.data?.audio ?? ''
      const bytes = hex ? Buffer.from(hex, 'hex') : Buffer.alloc(0)
      const format = body.format ?? 'mp3'
      recordUsage(request.userId!, 'minimax')
      return reply.send(
        success({
          audio: bytes.length
            ? `data:audio/${format};base64,${bytes.toString('base64')}`
            : undefined,
          bytes: bytes.length,
          base_resp: data.base_resp,
        }),
      )
    },
  )

  // ============ 音频:Stability Audio(同步,multipart) ============
  server.post(
    '/stability-audio/generate',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Stability 音频生成(stable-audio)',
        description:
          '代理调用 https://api.stability.ai/v2beta/audio/create(multipart 官方全参数),' +
          'model 缺省 stable-audio-2.5;返回 base64 音频',
        tags: ['AI', 'Stability', '音频'],
        body: stabilityAudioBody,
      }),
    },
    async (request, reply) => {
      const body = stabilityAudioBody.parse(request.body)
      const key = requireVendorKey('stability', reply)
      if (!key) return
      const form = new FormData()
      form.append('prompt', body.prompt)
      form.append('model', body.model ?? 'stable-audio-2.5')
      if (body.duration !== undefined) form.append('duration', String(body.duration))
      if (body.bpm !== undefined) form.append('bpm', String(body.bpm))
      if (body.seed !== undefined) form.append('seed', String(body.seed))
      const resp = await fetchWithTimeout(
        `${VENDORS.stability!.baseUrl}/v2beta/audio/create`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'audio/wav',
          },
          body: form,
        },
        120_000,
      )
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        return reply
          .status(502)
          .send(error(502, `Stability 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 400)}`))
      }
      const buf = Buffer.from(await resp.arrayBuffer())
      recordUsage(request.userId!, 'stability')
      return reply.send(
        success({ audio: `data:audio/wav;base64,${buf.toString('base64')}`, bytes: buf.length }),
      )
    },
  )

  // ============ 音频:Fish Audio(同步,二进制→base64) ============
  server.post(
    '/fishaudio/tts',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Fish Audio 文本转语音',
        description:
          '代理调用 https://api.fish.audio/v1/tts(官方全参数,reference_id 指定克隆音色);' +
          '返回 base64 data URL 音频',
        tags: ['AI', 'FishAudio', '音频'],
        body: fishaudioTtsBody,
      }),
    },
    async (request, reply) => {
      const body = fishaudioTtsBody.parse(request.body)
      const key = requireVendorKey('fishaudio', reply)
      if (!key) return
      const resp = await fetchWithTimeout(
        `${VENDORS.fishaudio!.baseUrl}/v1/tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: body.text,
            ...(body.reference_id ? { reference_id: body.reference_id } : {}),
            ...(body.format ? { format: body.format } : {}),
            ...(body.mp3_bitrate !== undefined ? { mp3_bitrate: body.mp3_bitrate } : {}),
            ...(body.chunk_length !== undefined ? { chunk_length: body.chunk_length } : {}),
            ...(body.normalize !== undefined ? { normalize: body.normalize } : {}),
            ...(body.latency !== undefined ? { latency: body.latency } : {}),
          }),
        },
        120_000,
      )
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        return reply
          .status(502)
          .send(error(502, `FishAudio 调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 400)}`))
      }
      const buf = Buffer.from(await resp.arrayBuffer())
      const format = body.format ?? 'mp3'
      recordUsage(request.userId!, 'fishaudio')
      return reply.send(
        success({ audio: `data:audio/${format};base64,${buf.toString('base64')}`, bytes: buf.length }),
      )
    },
  )

  // ============ 视频:Zhipu CogVideoX(异步 videos/generations) ============
  // 官方端点:POST https://open.bigmodel.cn/api/paas/v4/videos/generations
  server.post(
    '/zhipu/video',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: '智谱 CogVideoX 视频生成',
        description:
          '代理调用 https://open.bigmodel.cn/api/paas/v4/videos/generations(官方全参数,' +
          'model 缺省 cogvideox-3,with_audio 生成音效,image_url 图生视频);' +
          '返回上游 id,用 /zhipu/video/tasks/:taskId 轮询',
        tags: ['AI', 'Zhipu', '视频'],
        body: zhipuVideoBody,
      }),
    },
    async (request, reply) => {
      const body = zhipuVideoBody.parse(request.body ?? {})
      const key = requireVendorKey('zhipu', reply)
      if (!key) return
      const payload = { model: body.model ?? 'cogvideox-3', ...body }
      const data = await callVendor(
        'zhipu',
        `${VENDORS.zhipu!.baseUrl}/videos/generations`,
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'zhipu')
      return reply.send(success(data))
    },
  )

  // 官方端点:GET https://open.bigmodel.cn/api/paas/v4/videos/generations/{id}
  server.get(
    '/zhipu/video/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: '智谱 CogVideoX 任务查询',
        description:
          '代理调用 /videos/generations/{上游id} 轮询(task_status: SUCCESS|FAIL|PROCESSING)',
        tags: ['AI', 'Zhipu', '视频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const key = requireVendorKey('zhipu', reply)
      if (!key) return
      const data = await callVendor(
        'zhipu',
        `${VENDORS.zhipu!.baseUrl}/videos/generations/${encodeURIComponent(taskId)}`,
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
