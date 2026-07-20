/**
 * 扩展子路由:Tencent(4 端点)+ Volcengine(5 端点)+ 通用端点(17)+ Admin(4)。
 */
import { z } from 'zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { FALLBACK_VENDORS } from '../../services/ai-vendor-config-service.js'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  createTask,
  requireVendorKeys,
  fetchWithTimeout,
  buildTencentHeaders,
  volcengineSign,
  pollVolcengineTask,
  VENDORS,
  taskStore,
  aigcStore,
  timbreStore,
  usageStore,
  tencentActiveJobs,
  genId,
  vendorParam,
  taskIdParam,
  timbreIdParam,
  recordIdParam,
  reqKeyParam,
  tasksQuery,
  promptOnlyBody,
  jimengBody,
  type AsyncTask,
  type AigcRecord,
  type Timbre,
  type UsageStat,
} from './_shared.js'

const hunyuan3dSubmitBody = z.object({
  Prompt: z.string().optional(),
  ImageBase64: z.string().optional(),
  ImageUrl: z.string().optional(),
  ResultFormat: z.string().optional(),
  EnablePBR: z.boolean().optional(),
})

const hunyuan3dQueryBody = z.object({ JobId: z.string().optional() })

const volcVisualBody = z
  .object({ prompt: z.string().optional(), images: z.array(z.string()).optional() })
  .passthrough()

const jimeng4ProcessBody = z.object({ req_key: z.string().optional() }).passthrough()

const proxyBody = z.object({
  vendor: z.string().optional(),
  endpoint: z.string().optional(),
  payload: z.unknown().optional(),
})

const timbreCloneBody = z.object({
  voiceName: z.string().optional(),
  audioUrl: z.string().optional(),
  vendor: z.string().optional(),
})

const timbreUpdateBody = z.object({
  voiceName: z.string().optional(),
  audioUrl: z.string().optional(),
  status: z.enum(['training', 'ready', 'failed']).optional(),
})

const watermarkImageBody = z.object({
  imageUrl: z.string().optional(),
  text: z.string().optional(),
  position: z.string().optional(),
})

const watermarkVideoBody = z.object({
  videoUrl: z.string().optional(),
  text: z.string().optional(),
  position: z.string().optional(),
})

const aigcRecordBody = z.object({
  type: z.string().optional(),
  vendor: z.string().optional(),
  prompt: z.string().optional(),
  resultUrl: z.string().optional(),
})

export const extendedVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // ==========================================================================
  // 11. Tencent(腾讯混元/ARC)— 4 端点
  // ==========================================================================

  // POST /tencent/hunyuan3d/submit
  server.post(
    '/tencent/hunyuan3d/submit',
    {
      schema: buildSchema({
        summary: '腾讯混元 3D 提交任务',
        description: '代理调用腾讯云 SubmitHunyuanTo3DJob 接口提交文生 3D / 图生 3D 任务',
        tags: ['AI', 'Tencent'],
        body: hunyuan3dSubmitBody,
      }),
    },
    async (request, reply) => {
      const body = hunyuan3dSubmitBody.parse(request.body)
      if (!body.Prompt && !body.ImageBase64 && !body.ImageUrl)
        return reply.status(400).send(error(400, 'Prompt / ImageBase64 / ImageUrl 至少提供一个'))
      const keys = requireVendorKeys('tencent', reply)
      if (!keys) return
      const params: Record<string, unknown> = {}
      if (body.Prompt) params.Prompt = body.Prompt
      if (body.ImageBase64) params.ImageBase64 = body.ImageBase64
      if (body.ImageUrl) params.ImageUrl = body.ImageUrl
      if (body.ResultFormat) params.ResultFormat = body.ResultFormat
      if (body.EnablePBR !== null && body.EnablePBR !== undefined) params.EnablePBR = body.EnablePBR
      try {
        const payloadStr = JSON.stringify(params)
        const headers = buildTencentHeaders(
          'SubmitHunyuanTo3DJob',
          payloadStr,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          'https://ai3d.tencentcloudapi.com',
          { method: 'POST', headers, body: payloadStr },
          60_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok)
          return reply
            .status(502)
            .send(
              error(502, `腾讯云调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
            )
        const respData = (data.Response ?? {}) as Record<string, unknown>
        const jobId = respData.JobId as string | undefined
        if (!jobId)
          return reply
            .status(502)
            .send(
              error(
                502,
                `提交任务失败: ${(respData.Error as Record<string, unknown>)?.Message ?? '未知错误'}`,
              ),
            )
        const task = createTask(request.userId!, 'tencent', 'hunyuan3d', { jobId })
        tencentActiveJobs.set(jobId, {
          userId: request.userId,
          prompt: body.Prompt ?? '',
          imageUrl: body.ImageUrl ?? '',
          submitTime: Date.now(),
          status: 'PENDING',
        })
        recordUsage(request.userId!, 'tencent')
        return reply.send(success({ JobId: jobId, taskId: task.taskId }))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `腾讯云调用异常: ${msg}`))
      }
    },
  )

  // POST /tencent/hunyuan3d/query
  server.post(
    '/tencent/hunyuan3d/query',
    {
      schema: buildSchema({
        summary: '腾讯混元 3D 查询任务',
        description: '代理调用腾讯云 QueryHunyuanTo3DJob 接口按 JobId 查询任务结果',
        tags: ['AI', 'Tencent'],
        body: hunyuan3dQueryBody,
      }),
    },
    async (request, reply) => {
      const body = hunyuan3dQueryBody.parse(request.body)
      if (!body.JobId) return reply.status(400).send(error(400, 'JobId 为必填'))
      const keys = requireVendorKeys('tencent', reply)
      if (!keys) return
      try {
        const payloadStr = JSON.stringify({ JobId: body.JobId })
        const headers = buildTencentHeaders(
          'QueryHunyuanTo3DJob',
          payloadStr,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          'https://ai3d.tencentcloudapi.com',
          { method: 'POST', headers, body: payloadStr },
          60_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) return reply.status(502).send(error(502, `腾讯云调用失败: ${resp.status}`))
        return reply.send(success(data.Response ?? data))
      } catch (e) {
        return reply.status(502).send(error(502, `腾讯云调用异常: ${(e as Error).message}`))
      }
    },
  )

  // GET /tencent/hunyuan3d/task/:taskId
  server.get(
    '/tencent/hunyuan3d/task/:taskId',
    {
      schema: buildSchema({
        summary: '腾讯混元 3D 按 taskId 查询',
        description: '通过本平台 taskId 映射到腾讯云 JobId 后查询任务状态',
        tags: ['AI', 'Tencent'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const keys = requireVendorKeys('tencent', reply)
      if (!keys) return
      try {
        const payloadStr = JSON.stringify({ JobId: taskId })
        const headers = buildTencentHeaders(
          'QueryHunyuanTo3DJob',
          payloadStr,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          'https://ai3d.tencentcloudapi.com',
          { method: 'POST', headers, body: payloadStr },
          60_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) return reply.status(502).send(error(502, `腾讯云调用失败: ${resp.status}`))
        return reply.send(success(data.Response ?? data))
      } catch (e) {
        return reply.status(502).send(error(502, `腾讯云调用异常: ${(e as Error).message}`))
      }
    },
  )

  // GET /tencent/hunyuan3d/active-jobs
  server.get(
    '/tencent/hunyuan3d/active-jobs',
    {
      schema: buildSchema({
        summary: '腾讯混元 3D 活跃任务列表',
        description: '返回当前内存中所有腾讯混元 3D 提交中的 JobId 与等待时长',
        tags: ['AI', 'Tencent'],
      }),
    },
    async (_request, reply) => {
      const jobs: Record<string, unknown> = {}
      for (const [jid, info] of tencentActiveJobs) {
        jobs[jid] = {
          ...info,
          waitMinutes: Math.round((Date.now() - (info.submitTime as number)) / 60000),
        }
      }
      return reply.send(success({ activeCount: tencentActiveJobs.size, jobs }))
    },
  )

  // ==========================================================================
  // 12. Volcengine(火山引擎)— 5 端点
  // ==========================================================================

  // GET /volcengine/ping
  server.get(
    '/volcengine/ping',
    {
      schema: buildSchema({
        summary: '火山引擎模块探活',
        description: '返回 volcengine 子模块的连通状态',
        tags: ['AI', 'Volcengine'],
      }),
    },
    async (_request, reply) => {
      return reply.send(success({ ok: true, module: 'volcengine' }))
    },
  )

  // POST /volcengine/jimeng/image
  server.post(
    '/volcengine/jimeng/image',
    {
      schema: buildSchema({
        summary: '即梦 AI 文生图(jimeng_t2i_v40)',
        description: '代理调用火山引擎 CVSync2AsyncSubmitTask 提交即梦 v40 文生图任务并轮询结果',
        tags: ['AI', 'Volcengine'],
        body: jimengBody,
      }),
    },
    async (request, reply) => {
      const body = jimengBody.parse(request.body)
      if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
      const keys = requireVendorKeys('volcengine', reply)
      if (!keys) return
      const submitBody: Record<string, unknown> = {
        req_key: 'jimeng_t2i_v40',
        prompt: body.prompt,
        return_url: true,
      }
      if (body.width) submitBody.width = body.width
      if (body.height) submitBody.height = body.height
      if (body.seed !== null && body.seed !== undefined) submitBody.seed = body.seed
      try {
        const signed = volcengineSign(
          { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' },
          submitBody,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          signed.url,
          { method: 'POST', headers: signed.headers, body: signed.body },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok)
          return reply
            .status(502)
            .send(
              error(502, `火山引擎调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
            )
        const dataBlock = data.data as Record<string, unknown> | undefined
        const taskId = dataBlock?.task_id as string | undefined
        if (!taskId) return reply.status(502).send(error(502, '未返回 task_id'))
        const final = await pollVolcengineTask(
          keys.key,
          keys.secret,
          'jimeng_t2i_v40',
          taskId,
          reply,
        )
        if (!final) return
        const finalData = final.data as Record<string, unknown> | undefined
        const imageUrls: string[] = Array.isArray(finalData?.image_urls)
          ? (finalData!.image_urls as string[])
          : []
        recordUsage(request.userId!, 'volcengine')
        return reply.send(success({ image_urls: imageUrls, request_id: data.request_id }))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `火山引擎调用异常: ${msg}`))
      }
    },
  )

  // POST /volcengine/jimeng/generate
  server.post(
    '/volcengine/jimeng/generate',
    {
      schema: buildSchema({
        summary: '即梦 AI 文生图(jimeng_t2i_v31)',
        description: '代理调用火山引擎 CVProcess 同步接口生成即梦 v31 文生图',
        tags: ['AI', 'Volcengine'],
        body: promptOnlyBody,
      }),
    },
    async (request, reply) => {
      const body = promptOnlyBody.parse(request.body)
      if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
      const keys = requireVendorKeys('volcengine', reply)
      if (!keys) return
      try {
        const signed = volcengineSign(
          { Action: 'CVProcess', Version: '2022-08-31' },
          { req_key: 'jimeng_t2i_v31', prompt: body.prompt },
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          signed.url,
          { method: 'POST', headers: signed.headers, body: signed.body },
          120_000,
        )
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) return reply.status(502).send(error(502, `火山引擎调用失败: ${resp.status}`))
        recordUsage(request.userId!, 'volcengine')
        return reply.send(success(data))
      } catch (e) {
        return reply.status(502).send(error(502, `火山引擎调用异常: ${(e as Error).message}`))
      }
    },
  )

  // POST /volcengine/visual/:reqKey
  server.post(
    '/volcengine/visual/:reqKey',
    {
      schema: buildSchema({
        summary: '火山引擎视觉任务(按 reqKey)',
        description: '代理调用火山引擎 CVSync2AsyncSubmitTask 按 reqKey 提交视觉任务并轮询结果',
        tags: ['AI', 'Volcengine'],
        params: reqKeyParam,
        body: volcVisualBody,
      }),
    },
    async (request, reply) => {
      const { reqKey } = reqKeyParam.parse(request.params)
      const body = volcVisualBody.parse(request.body)
      const keys = requireVendorKeys('volcengine', reply)
      if (!keys) return
      const submitBody: Record<string, unknown> = {
        req_key: reqKey,
        prompt: body.prompt ?? '',
        image_urls: body.images ?? [],
      }
      for (const [k, v] of Object.entries(body)) {
        if (!['prompt', 'images'].includes(k)) submitBody[k] = v
      }
      try {
        const signed = volcengineSign(
          { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' },
          submitBody,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          signed.url,
          { method: 'POST', headers: signed.headers, body: signed.body },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) return reply.status(502).send(error(502, `火山引擎调用失败: ${resp.status}`))
        const dataBlock = data.data as Record<string, unknown> | undefined
        const taskId = dataBlock?.task_id as string | undefined
        if (!taskId) return reply.status(502).send(error(502, '未返回 task_id'))
        const final = await pollVolcengineTask(keys.key, keys.secret, reqKey, taskId, reply)
        if (!final) return
        const finalData = final.data as Record<string, unknown> | undefined
        recordUsage(request.userId!, 'volcengine')
        return reply.send(
          success({ video_url: finalData?.video_url ?? '', request_id: data.request_id }),
        )
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `火山引擎调用异常: ${msg}`))
      }
    },
  )

  // POST /volcengine/jimeng4/process
  server.post(
    '/volcengine/jimeng4/process',
    {
      schema: buildSchema({
        summary: '即梦 4 通用处理',
        description: '代理调用火山引擎 CVProcess 接口透传 req_key 与透传参数',
        tags: ['AI', 'Volcengine'],
        body: jimeng4ProcessBody,
      }),
    },
    async (request, reply) => {
      const body = jimeng4ProcessBody.parse(request.body)
      if (!body.req_key) return reply.status(400).send(error(400, 'req_key 为必填'))
      const keys = requireVendorKeys('volcengine', reply)
      if (!keys) return
      try {
        const signed = volcengineSign(
          { Action: 'CVProcess', Version: '2022-08-31' },
          body,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          signed.url,
          { method: 'POST', headers: signed.headers, body: signed.body },
          120_000,
        )
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) return reply.status(502).send(error(502, `火山引擎调用失败: ${resp.status}`))
        recordUsage(request.userId!, 'volcengine')
        return reply.send(success(data))
      } catch (e) {
        return reply.status(502).send(error(502, `火山引擎调用异常: ${(e as Error).message}`))
      }
    },
  )

  // ==========================================================================
  // 13. 通用工具端点 — 17 端点
  // ==========================================================================

  // GET /vendors
  server.get(
    '/vendors',
    {
      schema: buildSchema({
        summary: 'AI 厂商列表(用户视角)',
        description: '返回当前支持的 AI 厂商清单及其配置状态',
        tags: ['AI'],
      }),
    },
    async (_request, reply) => {
      const list = Object.entries(VENDORS).map(([key, cfg]) => ({
        vendor: key,
        name: cfg.name,
        configured: Boolean(process.env[cfg.keyEnv]),
      }))
      return reply.send(success(list))
    },
  )

  // GET /vendors/:vendor/models
  server.get(
    '/vendors/:vendor/models',
    {
      schema: buildSchema({
        summary: '厂商可用模型列表',
        description: '代理调用指定厂商的 /models 接口获取可用模型清单',
        tags: ['AI'],
        params: vendorParam,
      }),
    },
    async (request, reply) => {
      const { vendor } = vendorParam.parse(request.params)
      const cfg = VENDORS[vendor]
      if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
      const modelEndpoints: Record<string, string> = {
        dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
        doubao: 'https://ark.cn-beijing.volces.com/api/v3/models',
        gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
        suno: 'https://api.suno.ai/v1/models',
        sora2: `${VENDORS.sora2!.baseUrl}/v1/models`,
        coze: 'https://api.coze.cn/v1/models',
        volcengine: 'https://visual.volcengineapi.com/',
        jimeng4: 'https://visual.volcengineapi.com/',
      }
      const data = await callVendor(vendor, modelEndpoints[vendor] ?? cfg.baseUrl, reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // POST /proxy
  server.post(
    '/proxy',
    {
      schema: buildSchema({
        summary: '通用厂商代理转发',
        description: '按 vendor 与 endpoint 透传 POST 请求到对应厂商接口',
        tags: ['AI'],
        body: proxyBody,
      }),
    },
    async (request, reply) => {
      const body = proxyBody.parse(request.body)
      if (!body.vendor || !body.endpoint)
        return reply.status(400).send(error(400, 'vendor 和 endpoint 为必填'))
      const cfg = VENDORS[body.vendor]
      if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${body.vendor}`))
      const url = body.endpoint.startsWith('http')
        ? body.endpoint
        : `${cfg.baseUrl}${body.endpoint}`
      const data = await callVendor(body.vendor, url, reply, {
        method: 'POST',
        body: JSON.stringify(body.payload ?? {}),
      })
      if (data === null) return
      recordUsage(request.userId!, body.vendor)
      return reply.send(success(data))
    },
  )

  // GET /tasks
  server.get(
    '/tasks',
    {
      schema: buildSchema({
        summary: '当前用户异步任务列表',
        description: '返回当前登录用户的异步任务,支持按 vendor/status 过滤',
        tags: ['AI'],
        querystring: tasksQuery,
      }),
    },
    async (request, reply) => {
      const query = tasksQuery.parse(request.query)
      const list: AsyncTask[] = []
      for (const t of taskStore.values()) {
        if (t.userId !== request.userId) continue
        if (query.vendor && t.vendor !== query.vendor) continue
        if (query.status && t.status !== query.status) continue
        list.push(t)
      }
      list.sort((a, b) => b.createdAt - a.createdAt)
      return reply.send(success(list))
    },
  )

  // GET /tasks/:taskId
  server.get(
    '/tasks/:taskId',
    {
      schema: buildSchema({
        summary: '查询异步任务详情',
        description: '按 taskId 查询当前用户的异步任务详情',
        tags: ['AI'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task) return reply.status(404).send(error(404, '任务不存在'))
      if (task.userId !== request.userId)
        return reply.status(403).send(error(403, '无权访问该任务'))
      return reply.send(success(task))
    },
  )

  // DELETE /tasks/:taskId
  server.delete(
    '/tasks/:taskId',
    {
      schema: buildSchema({
        summary: '取消异步任务',
        description: '按 taskId 取消当前用户的非终态异步任务',
        tags: ['AI'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task) return reply.status(404).send(error(404, '任务不存在'))
      if (task.userId !== request.userId)
        return reply.status(403).send(error(403, '无权访问该任务'))
      if (task.status === 'succeeded' || task.status === 'failed')
        return reply.status(400).send(error(400, `任务已处于终态: ${task.status}`))
      task.status = 'failed'
      task.error = '用户取消'
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  // POST /timbre/clone
  server.post(
    '/timbre/clone',
    {
      schema: buildSchema({
        summary: '音色克隆',
        description: '代理调用指定厂商的 voice/clone 接口克隆音色,并写入音色库',
        tags: ['AI'],
        body: timbreCloneBody,
      }),
    },
    async (request, reply) => {
      const body = timbreCloneBody.parse(request.body)
      if (!body.voiceName || !body.audioUrl)
        return reply.status(400).send(error(400, 'voiceName 和 audioUrl 为必填'))
      const vendor = body.vendor ?? 'doubao'
      const vendorCfg = VENDORS[vendor]
      if (!vendorCfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
      const data = await callVendor(vendor, `${vendorCfg.baseUrl}/v1/voice/clone`, reply, {
        method: 'POST',
        body: JSON.stringify({ voice_name: body.voiceName, audio_url: body.audioUrl }),
      })
      if (data === null) return
      const timbre: Timbre = {
        timbreId: genId('timbre'),
        userId: request.userId!,
        voiceName: body.voiceName,
        audioUrl: body.audioUrl,
        vendor,
        status: 'training',
        createdAt: Date.now(),
      }
      timbreStore.set(timbre.timbreId, timbre)
      return reply.send(success(timbre))
    },
  )

  // GET /timbre/list
  server.get(
    '/timbre/list',
    {
      schema: buildSchema({
        summary: '当前用户音色列表',
        description: '返回当前登录用户已克隆的音色列表,按创建时间倒序',
        tags: ['AI'],
      }),
    },
    async (request, reply) => {
      const list: Timbre[] = []
      for (const t of timbreStore.values()) if (t.userId === request.userId) list.push(t)
      list.sort((a, b) => b.createdAt - a.createdAt)
      return reply.send(success(list))
    },
  )

  // DELETE /timbre/:timbreId
  server.delete(
    '/timbre/:timbreId',
    {
      schema: buildSchema({
        summary: '删除音色',
        description: '按 timbreId 删除当前用户拥有的音色',
        tags: ['AI'],
        params: timbreIdParam,
      }),
    },
    async (request, reply) => {
      const { timbreId } = timbreIdParam.parse(request.params)
      const timbre = timbreStore.get(timbreId)
      if (!timbre) return reply.status(404).send(error(404, '音色不存在'))
      if (timbre.userId !== request.userId)
        return reply.status(403).send(error(403, '无权删除该音色'))
      timbreStore.delete(timbreId)
      return reply.send(success({ timbreId, deleted: true }))
    },
  )

  // PUT /timbre/:timbreId
  server.put(
    '/timbre/:timbreId',
    {
      schema: buildSchema({
        summary: '更新音色',
        description: '按 timbreId 更新当前用户音色的名称、音频地址或状态',
        tags: ['AI'],
        params: timbreIdParam,
        body: timbreUpdateBody,
      }),
    },
    async (request, reply) => {
      const { timbreId } = timbreIdParam.parse(request.params)
      const body = timbreUpdateBody.parse(request.body)
      const timbre = timbreStore.get(timbreId)
      if (!timbre) return reply.status(404).send(error(404, '音色不存在'))
      if (timbre.userId !== request.userId)
        return reply.status(403).send(error(403, '无权修改该音色'))
      if (body.voiceName !== undefined) timbre.voiceName = body.voiceName
      if (body.audioUrl !== undefined) timbre.audioUrl = body.audioUrl
      if (body.status !== undefined) timbre.status = body.status
      return reply.send(success(timbre))
    },
  )

  // POST /watermark/image
  server.post(
    '/watermark/image',
    {
      schema: buildSchema({
        summary: '图片水印',
        description: '代理调用 Dashscope 图片合成接口为图片添加水印',
        tags: ['AI'],
        body: watermarkImageBody,
      }),
    },
    async (request, reply) => {
      const body = watermarkImageBody.parse(request.body)
      if (!body.imageUrl) return reply.status(400).send(error(400, 'imageUrl 为必填'))
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-outpainting/image-synthesis',
        reply,
        {
          method: 'POST',
          body: JSON.stringify({
            image_url: body.imageUrl,
            text: body.text,
            position: body.position ?? 'bottom-right',
          }),
        },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // POST /watermark/video
  server.post(
    '/watermark/video',
    {
      schema: buildSchema({
        summary: '视频水印',
        description: '代理调用 Dashscope 视频合成接口为视频添加水印并创建异步任务',
        tags: ['AI'],
        body: watermarkVideoBody,
      }),
    },
    async (request, reply) => {
      const body = watermarkVideoBody.parse(request.body)
      if (!body.videoUrl) return reply.status(400).send(error(400, 'videoUrl 为必填'))
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        reply,
        {
          method: 'POST',
          body: JSON.stringify({
            video_url: body.videoUrl,
            text: body.text,
            position: body.position ?? 'bottom-right',
          }),
        },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'dashscope', 'watermark-video', data)
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  // GET /usage
  server.get(
    '/usage',
    {
      schema: buildSchema({
        summary: '当前用户用量统计',
        description: '返回当前登录用户在各厂商的调用次数与总调用次数',
        tags: ['AI'],
      }),
    },
    async (request, reply) => {
      const list: UsageStat[] = []
      for (const u of usageStore.values()) if (u.userId === request.userId) list.push(u)
      const total = list.reduce((sum, u) => sum + u.calls, 0)
      return reply.send(success({ total, vendors: list }))
    },
  )

  // GET /usage/:vendor
  server.get(
    '/usage/:vendor',
    {
      schema: buildSchema({
        summary: '当前用户单厂商用量',
        description: '按 vendor 查询当前登录用户的用量统计',
        tags: ['AI'],
        params: vendorParam,
      }),
    },
    async (request, reply) => {
      const { vendor } = vendorParam.parse(request.params)
      const u = usageStore.get(`${request.userId}:${vendor}`)
      if (!u) return reply.send(success({ userId: request.userId, vendor, calls: 0 }))
      return reply.send(success(u))
    },
  )

  // POST /aigc/record
  server.post(
    '/aigc/record',
    {
      schema: buildSchema({
        summary: '创建 AIGC 记录',
        description: '写入一条 AIGC 生成记录到当前用户名下',
        tags: ['AI'],
        body: aigcRecordBody,
      }),
    },
    async (request, reply) => {
      const body = aigcRecordBody.parse(request.body)
      if (!body.type || !body.vendor)
        return reply.status(400).send(error(400, 'type 和 vendor 为必填'))
      const record: AigcRecord = {
        recordId: genId('aigc'),
        userId: request.userId!,
        type: body.type,
        vendor: body.vendor,
        prompt: body.prompt ?? '',
        resultUrl: body.resultUrl,
        createdAt: Date.now(),
      }
      aigcStore.set(record.recordId, record)
      return reply.send(success(record))
    },
  )

  // NOTE: GET /aigc/records 已由 missing-user-routes.ts Phase 5 P0 补建(DB 持久化版),
  // 此处原内存 stub 版本删除以避免 Fastify "Method 'GET' already declared" 重复注册错误。
  // POST /aigc/record(单数)、DELETE /aigc/records/:recordId、GET /aigc/records/stats 仍走内存版。

  // DELETE /aigc/records/:recordId
  server.delete(
    '/aigc/records/:recordId',
    {
      schema: buildSchema({
        summary: '删除 AIGC 记录',
        description: '按 recordId 删除当前用户拥有的 AIGC 记录',
        tags: ['AI'],
        params: recordIdParam,
      }),
    },
    async (request, reply) => {
      const { recordId } = recordIdParam.parse(request.params)
      const record = aigcStore.get(recordId)
      if (!record) return reply.status(404).send(error(404, '记录不存在'))
      if (record.userId !== request.userId)
        return reply.status(403).send(error(403, '无权删除该记录'))
      aigcStore.delete(recordId)
      return reply.send(success({ recordId, deleted: true }))
    },
  )

  // GET /aigc/records/stats
  server.get(
    '/aigc/records/stats',
    {
      schema: buildSchema({
        summary: '当前用户 AIGC 记录统计',
        description: '按 type/vendor 维度统计当前登录用户的 AIGC 记录数量',
        tags: ['AI'],
      }),
    },
    async (request, reply) => {
      let total = 0
      const byType: Record<string, number> = {}
      const byVendor: Record<string, number> = {}
      for (const r of aigcStore.values()) {
        if (r.userId !== request.userId) continue
        total += 1
        byType[r.type] = (byType[r.type] ?? 0) + 1
        byVendor[r.vendor] = (byVendor[r.vendor] ?? 0) + 1
      }
      return reply.send(success({ total, byType, byVendor }))
    },
  )
}

// ============================================================================
// 管理端点:AI 厂商配置管理(需管理员)
// ============================================================================

export const adminAiVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /vendors — 厂商配置状态
  server.get(
    '/vendors',
    {
      schema: buildSchema({
        summary: '厂商配置列表(管理视角)',
        description: '合并数据库与 fallback 配置,返回所有 AI 厂商的配置状态',
        tags: ['Admin', 'AI'],
      }),
    },
    async (_request, reply) => {
      const list = await listAllVendorsWithStatus()
      return reply.send(success(list))
    },
  )

  // GET /vendors/:vendor — 厂商详情
  server.get(
    '/vendors/:vendor',
    {
      schema: buildSchema({
        summary: '厂商详情(管理视角)',
        description: '按 vendor 查询厂商详情,优先读数据库,缺失时回退到 fallback',
        tags: ['Admin', 'AI'],
        params: vendorParam,
      }),
    },
    async (request, reply) => {
      const { vendor } = vendorParam.parse(request.params)
      try {
        const { getVendorByCode } = await import('../../services/ai-vendor-config-service.js')
        const dbVendor = await getVendorByCode(vendor)
        if (dbVendor) {
          return reply.send(
            success({
              vendor,
              name: dbVendor.vendorName,
              configured: dbVendor.keyEnvName ? Boolean(process.env[dbVendor.keyEnvName]) : false,
              baseUrl: dbVendor.baseUrl,
              keyEnv: dbVendor.keyEnvName,
              authType: dbVendor.authType,
              isEnabled: dbVendor.isEnabled,
              source: 'db',
            }),
          )
        }
      } catch {
        /* ignore */
      }
      const cfg = FALLBACK_VENDORS[vendor]
      if (!cfg) return reply.status(404).send(error(404, '厂商不存在'))
      return reply.send(
        success({
          vendor,
          name: cfg.vendorName,
          configured: cfg.keyEnvName ? Boolean(process.env[cfg.keyEnvName]) : false,
          baseUrl: cfg.baseUrl,
          keyEnv: cfg.keyEnvName,
          authType: cfg.authType,
          isEnabled: cfg.isEnabled,
          source: 'fallback',
        }),
      )
    },
  )

  // POST /vendors/:vendor/test — 测试厂商连通性
  server.post(
    '/vendors/:vendor/test',
    {
      schema: buildSchema({
        summary: '测试厂商连通性',
        description: '按 vendor 对应配置发起一次 GET 探活,返回可达性与状态码',
        tags: ['Admin', 'AI'],
        params: vendorParam,
      }),
    },
    async (request, reply) => {
      const { vendor } = vendorParam.parse(request.params)
      const cfg = VENDORS[vendor]
      if (!cfg) return reply.status(404).send(error(404, '厂商不存在'))
      const key = process.env[cfg.keyEnv]
      if (!key) return reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
      try {
        const resp = await fetchWithTimeout(
          cfg.baseUrl,
          { method: 'GET', headers: { ...cfg.authHeader(key) } },
          10_000,
        )
        return reply.send(
          success({ vendor, reachable: resp.status < 500, statusCode: resp.status }),
        )
      } catch (e) {
        return reply.send(success({ vendor, reachable: false, error: (e as Error).message }))
      }
    },
  )

  // GET /tasks — 全部异步任务(管理视角)
  server.get(
    '/tasks',
    {
      schema: buildSchema({
        summary: '全部异步任务(管理视角)',
        description: '管理端查看所有用户的异步任务,支持按 vendor/status 过滤',
        tags: ['Admin', 'AI'],
        querystring: tasksQuery,
      }),
    },
    async (request, reply) => {
      const query = tasksQuery.parse(request.query)
      const list: AsyncTask[] = []
      for (const t of taskStore.values()) {
        if (query.vendor && t.vendor !== query.vendor) continue
        if (query.status && t.status !== query.status) continue
        list.push(t)
      }
      list.sort((a, b) => b.createdAt - a.createdAt)
      return reply.send(success(list))
    },
  )

  // GET /usage — 全厂商用量
  server.get(
    '/usage',
    {
      schema: buildSchema({
        summary: '全厂商用量(管理视角)',
        description: '管理端汇总所有用户在所有厂商的调用次数',
        tags: ['Admin', 'AI'],
      }),
    },
    async (_request, reply) => {
      const byVendor: Record<string, number> = {}
      let total = 0
      for (const u of usageStore.values()) {
        byVendor[u.vendor] = (byVendor[u.vendor] ?? 0) + u.calls
        total += u.calls
      }
      return reply.send(success({ total, byVendor }))
    },
  )
}

async function listAllVendorsWithStatus(): Promise<
  Array<{
    vendor: string
    name: string
    configured: boolean
    baseUrl: string
    isEnabled: boolean
    authType: string
    source: 'db' | 'fallback'
  }>
> {
  let dbVendors: Array<{
    vendorCode: string
    vendorName: string
    baseUrl: string
    isEnabled: boolean
    authType: string
    keyEnvName: string | null
  }> = []
  try {
    const { getEnabledVendors } = await import('../../services/ai-vendor-config-service.js')
    const list = await getEnabledVendors()
    dbVendors = list.map((v) => ({
      vendorCode: v.vendorCode,
      vendorName: v.vendorName,
      baseUrl: v.baseUrl,
      isEnabled: v.isEnabled,
      authType: v.authType,
      keyEnvName: v.keyEnvName,
    }))
  } catch {
    /* fallback 模式生效 */
  }

  const merged = new Map<
    string,
    {
      name: string
      baseUrl: string
      authType: string
      isEnabled: boolean
      source: 'db' | 'fallback'
      keyEnvName: string | null
    }
  >()
  for (const v of Object.values(FALLBACK_VENDORS)) {
    merged.set(v.vendorCode, {
      name: v.vendorName,
      baseUrl: v.baseUrl,
      authType: v.authType,
      isEnabled: v.isEnabled,
      source: 'fallback',
      keyEnvName: v.keyEnvName ?? null,
    })
  }
  for (const v of dbVendors) {
    merged.set(v.vendorCode, {
      name: v.vendorName,
      baseUrl: v.baseUrl,
      authType: v.authType,
      isEnabled: v.isEnabled,
      source: 'db',
      keyEnvName: v.keyEnvName,
    })
  }

  return Array.from(merged.entries()).map(([code, info]) => ({
    vendor: code,
    name: info.name,
    configured: info.keyEnvName ? Boolean(process.env[info.keyEnvName]) : false,
    baseUrl: info.baseUrl,
    isEnabled: info.isEnabled,
    authType: info.authType,
    source: info.source,
  }))
}
