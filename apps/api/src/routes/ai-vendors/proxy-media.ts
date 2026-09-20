// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多媒体生成代理子路由:Suno(5 端点)+ Sora2(4 端点)。
 */
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  createTask,
  requireVendorKey,
  taskStore,
  VENDORS,
  taskIdParam,
  promptOnlyBody,
  type AsyncTask,
  type FastifyRequest,
  type FastifyReply,
  type FastifyPluginAsync,
} from './_shared.js'

// Suno 音乐生成:官方完整参数(custom_mode/instrumental/style/title/seed 等)
const sunoGenerateBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  duration: z.number().optional(),
  // Suno 官方参数
  style: z.string().optional(),
  title: z.string().optional(),
  custom_mode: z.boolean().optional(),
  instrumental: z.boolean().optional(),
  make_instrumental: z.boolean().optional(),
  tags: z.string().optional(),
  negative_tags: z.string().optional(),
  seed: z.number().optional(),
  style_weight: z.number().optional(),
  weirdness_constraint: z.number().optional(),
  audio_weight: z.number().optional(),
})

// Sora2(OpenAI videos)官方完整参数:seconds/size/input_reference 等
const sora2GenerateBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  duration: z.number().optional(),
  size: z.string().optional(),
  // OpenAI 官方参数
  seconds: z.string().optional(),
  aspect_ratio: z.string().optional(),
  input_reference: z.string().optional(),
  resolution: z.string().optional(),
  output_format: z.string().optional(),
  output_size: z.string().optional(),
})

// Agnes 视频生成:CLI 源码确认 payload 无顶层 mode 字段,img2video 仅附加 image(单图 URL)
// 约束:num_frames ≤441 且满足 8n+1;frame_rate 1-60;默认 1152x768/121帧/24fps(上游自动映射最近 preset)
const agnesVideoBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  // v2.0 参数
  width: z.number().optional(),
  height: z.number().optional(),
  num_frames: z.number().optional(),
  frame_rate: z.number().optional(),
  // 2.5 系列参数(实测 2026-09-20):mode 必填(text|image),size 仅支持 720P
  mode: z.enum(['text', 'image']).optional(),
  size: z.string().optional(),
  image: z.string().optional(),
})

export const mediaVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // 4. Suno(音乐生成)— 5 端点
  server.post(
    '/suno/generate',
    {
      schema: buildSchema({
        summary: 'Suno 音乐生成',
        description: '代理调用 Suno v1/music/generations 接口生成音乐(异步任务)',
        tags: ['AI', 'Suno'],
        body: sunoGenerateBody,
      }),
    },
    async (request, reply) => {
      const body = sunoGenerateBody.parse(request.body)
      const data = await callVendor('suno', 'https://api.suno.ai/v1/music/generations', reply, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data === null) return
      const task = createTask(request.userId!, 'suno', 'music', data)
      recordUsage(request.userId!, 'suno')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/suno/tasks',
    {
      schema: buildSchema({
        summary: 'Suno 当前用户任务列表',
        description: '返回当前登录用户的 Suno 异步任务列表',
        tags: ['AI', 'Suno'],
      }),
    },
    async (request, reply) => {
      const key = requireVendorKey('suno', reply)
      if (!key) return
      const list: AsyncTask[] = []
      for (const t of taskStore.values()) {
        if (t.vendor === 'suno' && t.userId === request.userId) list.push(t)
      }
      return reply.send(success(list))
    },
  )

  server.get(
    '/suno/tasks/:taskId',
    {
      schema: buildSchema({
        summary: 'Suno 任务详情',
        description: '按 taskId 查询 Suno 任务详情并同步上游状态',
        tags: ['AI', 'Suno'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      // 2026-09-09 P1 越权修复:仅校验 vendor 不够,任何登录用户可凭 taskId 枚举
      // 读取他人生成的任务结果(含音视频 URL)。补归属校验,跨用户一律 404(不泄露存在性)。
      if (!task || task.vendor !== 'suno' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstream = await callVendor(
        'suno',
        `https://api.suno.ai/v1/music/generations/${encodeURIComponent(taskId)}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) task.result = upstream
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  server.post(
    '/suno/lyrics',
    {
      schema: buildSchema({
        summary: 'Suno 歌词生成',
        description: '代理调用 Suno v1/lyrics/generations 接口生成歌词',
        tags: ['AI', 'Suno'],
        body: promptOnlyBody,
      }),
    },
    async (request, reply) => {
      const body = promptOnlyBody.parse(request.body)
      const data = await callVendor('suno', 'https://api.suno.ai/v1/lyrics/generations', reply, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'suno')
      return reply.send(success(data))
    },
  )

  server.get(
    '/suno/models',
    {
      schema: buildSchema({
        summary: 'Suno 模型列表',
        description: '代理调用 Suno v1/models 接口获取可用模型列表',
        tags: ['AI', 'Suno'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('suno', 'https://api.suno.ai/v1/models', reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // 5. Sora2(OpenAI 视频)— 4 端点
  server.post(
    '/sora2/generate',
    {
      schema: buildSchema({
        summary: 'Sora2 视频生成',
        description: '代理调用 Sora2 v1/videos/generations 接口生成视频(异步任务)',
        tags: ['AI', 'Sora2'],
        body: sora2GenerateBody,
      }),
    },
    async (request, reply) => {
      const body = sora2GenerateBody.parse(request.body)
      const data = await callVendor(
        'sora2',
        `${VENDORS.sora2!.baseUrl}/v1/videos/generations`,
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'sora2', 'video', data)
      recordUsage(request.userId!, 'sora2')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/sora2/tasks',
    {
      schema: buildSchema({
        summary: 'Sora2 当前用户任务列表',
        description: '返回当前登录用户的 Sora2 异步任务列表',
        tags: ['AI', 'Sora2'],
      }),
    },
    async (request, reply) => {
      const list: AsyncTask[] = []
      for (const t of taskStore.values()) {
        if (t.vendor === 'sora2' && t.userId === request.userId) list.push(t)
      }
      return reply.send(success(list))
    },
  )

  server.get(
    '/sora2/tasks/:taskId',
    {
      schema: buildSchema({
        summary: 'Sora2 任务详情',
        description: '按 taskId 查询 Sora2 任务详情并同步上游状态',
        tags: ['AI', 'Sora2'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      // 2026-09-09 P1 越权修复:同 suno 详情,补归属校验,跨用户 404。
      if (!task || task.vendor !== 'sora2' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstream = await callVendor(
        'sora2',
        `${VENDORS.sora2!.baseUrl}/v1/videos/generations/${encodeURIComponent(taskId)}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) task.result = upstream
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  server.get(
    '/sora2/models',
    {
      schema: buildSchema({
        summary: 'Sora2 模型列表',
        description: '代理调用 Sora2 v1/models 接口获取可用模型列表',
        tags: ['AI', 'Sora2'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('sora2', `${VENDORS.sora2!.baseUrl}/v1/models`, reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // 6. Agnes AI(视频生成)— 2 端点
  server.post(
    '/agnes/video',
    {
      schema: buildSchema({
        summary: 'Agnes AI 视频生成',
        description:
          '代理调用 Agnes POST /v1/videos 创建视频任务(异步),' +
          '支持文生视频(仅 prompt)与图生视频(附加 image 单图 URL);' +
          '默认参数 model=agnes-video-v2.0/1152x768/121帧/24fps,响应含 taskId 供轮询',
        tags: ['AI', 'Agnes'],
        body: agnesVideoBody,
      }),
    },
    async (request, reply) => {
      const body = agnesVideoBody.parse(request.body)
      const { image, ...rest } = body
      const model = rest.model ?? 'agnes-video-v2.0'
      // 2.5 系列:mode 必填,size 仅 720P,不收 width/height/num_frames/frame_rate
      // v2.0:width/height/num_frames/frame_rate,不接受 mode/size(2026-09-20 实测)
      const isV25 = model.startsWith('agnes-video-2.5')
      const payload = isV25
        ? {
            model,
            prompt: rest.prompt ?? '',
            mode: rest.mode ?? (image ? 'image' : 'text'),
            size: rest.size ?? '720P',
            ...(image ? { image } : {}),
          }
        : {
            model,
            prompt: rest.prompt ?? '',
            width: rest.width ?? 1152,
            height: rest.height ?? 768,
            num_frames: rest.num_frames ?? 121,
            frame_rate: rest.frame_rate ?? 24,
            ...(image ? { image } : {}),
          }
      const data = await callVendor('agnes', 'https://apihub.agnes-ai.com/v1/videos', reply, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (data === null) return
      const task = createTask(request.userId!, 'agnes', 'video', data)
      recordUsage(request.userId!, 'agnes')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/agnes/video/tasks/:taskId',
    {
      schema: buildSchema({
        summary: 'Agnes AI 视频任务详情',
        description:
          '按 taskId 查询 Agnes 视频任务并同步上游状态;' +
          '上游轮询规则(CLI 源码确认):video_ 开头走 GET /agnesapi?video_id=,task_ 开头走 GET /v1/videos/{id};' +
          '完成时从 metadata.url / url 提取视频地址',
        tags: ['AI', 'Agnes'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (
        !task ||
        task.vendor !== 'agnes' ||
        task.type !== 'video' ||
        task.userId !== request.userId
      ) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      // 从创建响应提取上游 ID:创建响应形如 {id: "task_*", video_id: "video_*", status: "queued"}
      const raw = (task.result ?? {}) as { video_id?: string; id?: string }
      const upstreamId = raw.video_id || raw.id || ''
      const pollUrl = upstreamId.startsWith('task_')
        ? `https://apihub.agnes-ai.com/v1/videos/${encodeURIComponent(upstreamId)}`
        : `https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(upstreamId)}`
      const upstream = await callVendor('agnes', pollUrl, reply, { method: 'GET' })
      if (upstream) {
        task.result = upstream
        // 上游状态映射:queued/in_progress → running,completed → succeeded,failed → failed
        const status = (upstream as { status?: string }).status
        if (status === 'completed') task.status = 'succeeded'
        else if (status === 'failed') task.status = 'failed'
        else if (task.status === 'pending') task.status = 'running'
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
