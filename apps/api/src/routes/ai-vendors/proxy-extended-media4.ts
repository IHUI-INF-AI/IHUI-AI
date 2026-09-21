// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展媒体代理子路由 4(2026-09-20 n14c 平台补齐):
 *   音频  AssemblyAI /v2/transcript(异步创建+轮询,官方全参数) +
 *         ElevenLabs /v1/speech-to-text(Scribe STT,multipart 同步)
 *   向量  Jina Rerank /v1/rerank(重排序,同步 JSON)
 *   开源  Replicate /v1/predictions(version+input,Prefer: wait=60 同步等待,
 *         未完成可 /replicate/tasks/:taskId 轮询)
 *
 * 注:MiniMax 海螺视频已在 proxy-extended-media.ts 覆盖,此处不重复注册。
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

// ============ AssemblyAI 官方转写参数(audio_url/speech_model/language_code 等) ============
const assemblyaiBody = z.object({
  audio_url: z.string().min(1),
  speech_model: z.string().optional(), // universal | nano | best | slam-1 ...
  language_code: z.string().optional(), // zh | en | auto ...
  punctuate: z.boolean().optional(),
  format_text: z.boolean().optional(),
  dual_channel: z.boolean().optional(),
  speaker_labels: z.boolean().optional(),
  speakers_expected: z.number().int().min(1).max(32).optional(),
  language_detection: z.boolean().optional(),
  filter_profanity: z.boolean().optional(),
  redact_pii: z.boolean().optional(),
  webhook_url: z.string().optional(),
})

// ============ ElevenLabs Scribe STT 官方参数(model_id/language_code/diarize 等) ============
const elevenlabsSttBody = z.object({
  model_id: z.string().optional(), // scribe_v1
  language_code: z.string().optional(), // ISO-639-1,如 zh / en
  diarize: z.boolean().optional(), // 说话人分离
  timestamps_granularity: z.string().optional(), // none | word | character
  num_speakers: z.number().int().min(1).max(32).optional(),
  tag_audio_events: z.boolean().optional(), // 标注笑声/掌声等事件
  file_format: z.string().optional(), // wav | mp3 | m4a ...
})

// ============ Jina Rerank 官方参数(model/query/documents/top_n) ============
const jinaRerankBody = z.object({
  model: z.string().optional(), // jina-reranker-v2-base-multilingual | jina-reranker-v1t-base-en ...
  query: z.string().min(1),
  documents: z.array(z.string().min(1)).min(1).max(1000),
  top_n: z.number().int().min(1).optional(),
})

// ============ Replicate 官方预测参数(version/input 或 model 路径) ============
const replicateBody = z.object({
  version: z.string().optional(), // 模型版本 hash(version 与 model 二选一)
  model: z.string().optional(), // owner/name,走 /v1/models/{model}/predictions
  input: z.record(z.string(), z.unknown()).optional(), // 模型输入参数
  webhook: z.string().optional(),
  webhook_events_filter: z.array(z.string()).optional(),
})

/** AssemblyAI 状态 → 本地任务状态映射 */
function mapAssemblyStatus(st: string | undefined): 'running' | 'succeeded' | 'failed' {
  if (st === 'completed') return 'succeeded'
  if (st === 'error') return 'failed'
  return 'running' // queued / processing
}

/** Replicate 状态 → 本地任务状态映射 */
function mapReplicateStatus(st: string | undefined): 'running' | 'succeeded' | 'failed' {
  if (st === 'succeeded') return 'succeeded'
  if (st === 'failed' || st === 'canceled') return 'failed'
  return 'running' // starting / processing
}

export const extendedMediaVendorRoutes4: FastifyPluginAsync = async (server) => {
  // ============ 音频:AssemblyAI STT(异步创建 + 轮询) ============
  server.post(
    '/assemblyai/transcribe',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'AssemblyAI 语音转写',
        description:
          '代理调用 https://api.assemblyai.com/v2/transcript(官方全参数,audio_url 必填,' +
          '支持 universal/nano/slam-1 模型与说话人分离/PII 脱敏);返回本地 taskId,' +
          '用 /assemblyai/tasks/:taskId 轮询',
        tags: ['AI', 'AssemblyAI', '音频'],
        body: assemblyaiBody,
      }),
    },
    async (request, reply) => {
      const body = assemblyaiBody.parse(request.body)
      const key = requireVendorKey('assemblyai', reply)
      if (!key) return
      const payload: Record<string, unknown> = { audio_url: body.audio_url }
      if (body.speech_model) payload.speech_model = body.speech_model
      if (body.language_code) payload.language_code = body.language_code
      for (const b of ['punctuate', 'format_text', 'dual_channel', 'speaker_labels', 'language_detection', 'filter_profanity', 'redact_pii'] as const) {
        if (body[b] !== undefined) payload[b] = body[b]
      }
      if (body.speakers_expected !== undefined) payload.speakers_expected = body.speakers_expected
      if (body.webhook_url) payload.webhook_url = body.webhook_url
      const data = await callVendor('assemblyai', `${VENDORS.assemblyai!.baseUrl}/v2/transcript`, reply, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (data === null) return
      const task = createTask(request.userId!, 'assemblyai', 'audio', data)
      recordUsage(request.userId!, 'assemblyai')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/assemblyai/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'AssemblyAI 转写任务查询',
        description:
          '代理调用 /v2/transcript/{id} 轮询(queued/processing/completed/error,' +
          'completed 时返回 text 与 utterances 说话人分段)',
        tags: ['AI', 'AssemblyAI', '音频'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'assemblyai' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstreamId = String(
        (task.result as { id?: string } | undefined)?.id ?? '',
      )
      const upstream = await callVendor(
        'assemblyai',
        `${VENDORS.assemblyai!.baseUrl}/v2/transcript/${upstreamId}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) {
        task.result = { ...(task.result as Record<string, unknown>), ...(upstream as Record<string, unknown>) }
        const st = (upstream as { status?: string }).status
        task.status = mapAssemblyStatus(st)
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  // ============ 音频:ElevenLabs Scribe STT(multipart 同步) ============
  server.post(
    '/elevenlabs/transcribe',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'ElevenLabs 语音转文本(Scribe)',
        description:
          '代理调用 https://api.elevenlabs.io/v1/speech-to-text(multipart 直传,文件字段名 file,' +
          'model 缺省 scribe_v1,支持 99 语言与说话人分离);同步返回转写 JSON',
        tags: ['AI', 'ElevenLabs', '音频'],
        body: elevenlabsSttBody,
      }),
    },
    async (request, reply) => {
      const body = elevenlabsSttBody.parse(request.body ?? {})
      const key = requireVendorKey('elevenlabs', reply)
      if (!key) return
      const file = await request.file()
      if (!file) return reply.status(400).send(error(400, '缺少音频文件(字段名 file)'))
      const buffer = await file.toBuffer()
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(buffer)], { type: file.mimetype }), file.filename)
      form.append('model_id', body.model_id ?? 'scribe_v1')
      if (body.language_code) form.append('language_code', body.language_code)
      if (body.diarize !== undefined) form.append('diarize', String(body.diarize))
      if (body.timestamps_granularity) form.append('timestamps_granularity', body.timestamps_granularity)
      if (body.num_speakers !== undefined) form.append('num_speakers', String(body.num_speakers))
      if (body.tag_audio_events !== undefined) form.append('tag_audio_events', String(body.tag_audio_events))
      if (body.file_format) form.append('file_format', body.file_format)
      try {
        const resp = await fetchWithTimeout(
          `${VENDORS.elevenlabs!.baseUrl}/v1/speech-to-text`,
          {
            method: 'POST',
            headers: { ...VENDORS.elevenlabs!.authHeader(key) },
            body: form,
          },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) {
          return reply.status(502).send(
            error(502, `ElevenLabs 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 400)}`),
          )
        }
        recordUsage(request.userId!, 'elevenlabs')
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `ElevenLabs 调用异常: ${msg}`))
      }
    },
  )

  // ============ 向量:Jina Rerank(重排序,同步) ============
  server.post(
    '/jina/rerank',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Jina Rerank 重排序',
        description:
          '代理调用 https://api.jina.ai/v1/rerank(官方全参数,query+documents 重排打分,' +
          'model 缺省 jina-reranker-v2-base-multilingual);同步返回按相关性排序的结果',
        tags: ['AI', 'Jina', '向量'],
        body: jinaRerankBody,
      }),
    },
    async (request, reply) => {
      const body = jinaRerankBody.parse(request.body)
      const key = requireVendorKey('jina', reply)
      if (!key) return
      const data = await callVendor('jina', `${VENDORS.jina!.baseUrl}/rerank`, reply, {
        method: 'POST',
        body: JSON.stringify({
          model: body.model ?? 'jina-reranker-v2-base-multilingual',
          query: body.query,
          documents: body.documents,
          ...(body.top_n !== undefined ? { top_n: body.top_n } : {}),
        }),
      })
      if (data === null) return
      recordUsage(request.userId!, 'jina')
      return reply.send(success(data))
    },
  )

  // ============ 开源:Replicate predictions(Prefer: wait=60 同步等待) ============
  server.post(
    '/replicate/predictions',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Replicate 开源模型推理',
        description:
          '代理调用 https://api.replicate.com/v1/predictions(version+input 官方协议,' +
          '或传 model=owner/name 走 /v1/models/{model}/predictions;带 Prefer: wait=60 同步等待)。' +
          '60 秒内未完成返回本地 taskId,用 /replicate/tasks/:taskId 轮询',
        tags: ['AI', 'Replicate', '开源'],
        body: replicateBody,
      }),
    },
    async (request, reply) => {
      const body = replicateBody.parse(request.body)
      const key = requireVendorKey('replicate', reply)
      if (!key) return
      if (!body.version && !body.model) {
        return reply.status(400).send(error(400, 'version 与 model(owner/name) 必须二选一'))
      }
      const input = body.input ?? {}
      const payload: Record<string, unknown> = { input }
      if (body.webhook) payload.webhook = body.webhook
      if (body.webhook_events_filter) payload.webhook_events_filter = body.webhook_events_filter
      const url = body.model
        ? `${VENDORS.replicate!.baseUrl}/models/${body.model}/predictions`
        : `${VENDORS.replicate!.baseUrl}/predictions`
      const data = await callVendor('replicate', url, reply, {
        method: 'POST',
        body: JSON.stringify(body.model ? payload : { version: body.version, ...payload }),
      })
      if (data === null) return
      const raw = data as Record<string, unknown>
      if (mapReplicateStatus(raw.status as string | undefined) === 'succeeded' || (raw.error && raw.status === 'failed')) {
        recordUsage(request.userId!, 'replicate')
        return reply.send(success(data))
      }
      // starting/processing:落本地任务供轮询
      const task = createTask(request.userId!, 'replicate', 'image', data)
      recordUsage(request.userId!, 'replicate')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/replicate/tasks/:taskId',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: 'Replicate 预测任务查询',
        description:
          '代理调用 /v1/predictions/{id} 轮询(starting/processing/succeeded/failed/canceled,' +
          'succeeded 时返回 output 结果数组)',
        tags: ['AI', 'Replicate', '开源'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'replicate' || task.userId !== request.userId) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstreamId = String(
        (task.result as { id?: string } | undefined)?.id ?? '',
      )
      const upstream = await callVendor(
        'replicate',
        `${VENDORS.replicate!.baseUrl}/predictions/${upstreamId}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) {
        task.result = { ...(task.result as Record<string, unknown>), ...(upstream as Record<string, unknown>) }
        const st = (upstream as { status?: string }).status
        task.status = mapReplicateStatus(st)
      }
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
