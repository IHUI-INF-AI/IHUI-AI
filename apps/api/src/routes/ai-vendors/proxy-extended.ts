/**
 * 扩展子路由:Tencent(4 端点)+ Volcengine(5 端点)+ 通用端点(17)+ Admin(4)。
 */
import { z } from 'zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { FALLBACK_VENDORS } from '../../services/ai-vendor-config-service.js'
import { success, error } from '../../utils/response.js'
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
  aigcRecordsQuery,
  promptOnlyBody,
  jimengBody,
  type AsyncTask,
  type AigcRecord,
  type Timbre,
  type UsageStat,
} from './_shared.js'

export const extendedVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // ==========================================================================
  // 11. Tencent(腾讯混元/ARC)— 4 端点
  // ==========================================================================

  // POST /tencent/hunyuan3d/submit
  server.post('/tencent/hunyuan3d/submit', async (request, reply) => {
    const body = z
      .object({
        Prompt: z.string().optional(),
        ImageBase64: z.string().optional(),
        ImageUrl: z.string().optional(),
        ResultFormat: z.string().optional(),
        EnablePBR: z.boolean().optional(),
      })
      .parse(request.body)
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
      const headers = buildTencentHeaders('SubmitHunyuanTo3DJob', payloadStr, keys.key, keys.secret)
      const resp = await fetchWithTimeout(
        'https://ai3d.tencentcloudapi.com',
        { method: 'POST', headers, body: payloadStr },
        60_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok)
        return reply
          .status(502)
          .send(error(502, `腾讯云调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`))
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
  })

  // POST /tencent/hunyuan3d/query
  server.post('/tencent/hunyuan3d/query', async (request, reply) => {
    const body = z.object({ JobId: z.string().optional() }).parse(request.body)
    if (!body.JobId) return reply.status(400).send(error(400, 'JobId 为必填'))
    const keys = requireVendorKeys('tencent', reply)
    if (!keys) return
    try {
      const payloadStr = JSON.stringify({ JobId: body.JobId })
      const headers = buildTencentHeaders('QueryHunyuanTo3DJob', payloadStr, keys.key, keys.secret)
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
  })

  // GET /tencent/hunyuan3d/task/:taskId
  server.get('/tencent/hunyuan3d/task/:taskId', async (request, reply) => {
    const { taskId } = taskIdParam.parse(request.params)
    const keys = requireVendorKeys('tencent', reply)
    if (!keys) return
    try {
      const payloadStr = JSON.stringify({ JobId: taskId })
      const headers = buildTencentHeaders('QueryHunyuanTo3DJob', payloadStr, keys.key, keys.secret)
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
  })

  // GET /tencent/hunyuan3d/active-jobs
  server.get('/tencent/hunyuan3d/active-jobs', async (_request, reply) => {
    const jobs: Record<string, unknown> = {}
    for (const [jid, info] of tencentActiveJobs) {
      jobs[jid] = {
        ...info,
        waitMinutes: Math.round((Date.now() - (info.submitTime as number)) / 60000),
      }
    }
    return reply.send(success({ activeCount: tencentActiveJobs.size, jobs }))
  })

  // ==========================================================================
  // 12. Volcengine(火山引擎)— 5 端点
  // ==========================================================================

  // GET /volcengine/ping
  server.get('/volcengine/ping', async (_request, reply) => {
    return reply.send(success({ ok: true, module: 'volcengine' }))
  })

  // POST /volcengine/jimeng/image
  server.post('/volcengine/jimeng/image', async (request, reply) => {
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
      const final = await pollVolcengineTask(keys.key, keys.secret, 'jimeng_t2i_v40', taskId, reply)
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
  })

  // POST /volcengine/jimeng/generate
  server.post('/volcengine/jimeng/generate', async (request, reply) => {
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
  })

  // POST /volcengine/visual/:reqKey
  server.post('/volcengine/visual/:reqKey', async (request, reply) => {
    const { reqKey } = reqKeyParam.parse(request.params)
    const body = z
      .object({ prompt: z.string().optional(), images: z.array(z.string()).optional() })
      .passthrough()
      .parse(request.body)
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
  })

  // POST /volcengine/jimeng4/process
  server.post('/volcengine/jimeng4/process', async (request, reply) => {
    const body = z.object({ req_key: z.string().optional() }).passthrough().parse(request.body)
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
  })

  // ==========================================================================
  // 13. 通用工具端点 — 17 端点
  // ==========================================================================

  // GET /vendors
  server.get('/vendors', async (_request, reply) => {
    const list = Object.entries(VENDORS).map(([key, cfg]) => ({
      vendor: key,
      name: cfg.name,
      configured: Boolean(process.env[cfg.keyEnv]),
    }))
    return reply.send(success(list))
  })

  // GET /vendors/:vendor/models
  server.get('/vendors/:vendor/models', async (request, reply) => {
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
  })

  // POST /proxy
  server.post('/proxy', async (request, reply) => {
    const body = z
      .object({ vendor: z.string().optional(), endpoint: z.string().optional(), payload: z.unknown().optional() })
      .parse(request.body)
    if (!body.vendor || !body.endpoint)
      return reply.status(400).send(error(400, 'vendor 和 endpoint 为必填'))
    const cfg = VENDORS[body.vendor]
    if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${body.vendor}`))
    const url = body.endpoint.startsWith('http') ? body.endpoint : `${cfg.baseUrl}${body.endpoint}`
    const data = await callVendor(body.vendor, url, reply, {
      method: 'POST',
      body: JSON.stringify(body.payload ?? {}),
    })
    if (data === null) return
    recordUsage(request.userId!, body.vendor)
    return reply.send(success(data))
  })

  // GET /tasks
  server.get('/tasks', async (request, reply) => {
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
  })

  // GET /tasks/:taskId
  server.get('/tasks/:taskId', async (request, reply) => {
    const { taskId } = taskIdParam.parse(request.params)
    const task = taskStore.get(taskId)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'))
    return reply.send(success(task))
  })

  // DELETE /tasks/:taskId
  server.delete('/tasks/:taskId', async (request, reply) => {
    const { taskId } = taskIdParam.parse(request.params)
    const task = taskStore.get(taskId)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'))
    if (task.status === 'succeeded' || task.status === 'failed')
      return reply.status(400).send(error(400, `任务已处于终态: ${task.status}`))
    task.status = 'failed'
    task.error = '用户取消'
    task.updatedAt = Date.now()
    return reply.send(success(task))
  })

  // POST /timbre/clone
  server.post('/timbre/clone', async (request, reply) => {
    const body = z
      .object({ voiceName: z.string().optional(), audioUrl: z.string().optional(), vendor: z.string().optional() })
      .parse(request.body)
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
  })

  // GET /timbre/list
  server.get('/timbre/list', async (request, reply) => {
    const list: Timbre[] = []
    for (const t of timbreStore.values()) if (t.userId === request.userId) list.push(t)
    list.sort((a, b) => b.createdAt - a.createdAt)
    return reply.send(success(list))
  })

  // DELETE /timbre/:timbreId
  server.delete('/timbre/:timbreId', async (request, reply) => {
    const { timbreId } = timbreIdParam.parse(request.params)
    const timbre = timbreStore.get(timbreId)
    if (!timbre) return reply.status(404).send(error(404, '音色不存在'))
    if (timbre.userId !== request.userId) return reply.status(403).send(error(403, '无权删除该音色'))
    timbreStore.delete(timbreId)
    return reply.send(success({ timbreId, deleted: true }))
  })

  // PUT /timbre/:timbreId
  server.put('/timbre/:timbreId', async (request, reply) => {
    const { timbreId } = timbreIdParam.parse(request.params)
    const body = z
      .object({
        voiceName: z.string().optional(),
        audioUrl: z.string().optional(),
        status: z.enum(['training', 'ready', 'failed']).optional(),
      })
      .parse(request.body)
    const timbre = timbreStore.get(timbreId)
    if (!timbre) return reply.status(404).send(error(404, '音色不存在'))
    if (timbre.userId !== request.userId) return reply.status(403).send(error(403, '无权修改该音色'))
    if (body.voiceName !== undefined) timbre.voiceName = body.voiceName
    if (body.audioUrl !== undefined) timbre.audioUrl = body.audioUrl
    if (body.status !== undefined) timbre.status = body.status
    return reply.send(success(timbre))
  })

  // POST /watermark/image
  server.post('/watermark/image', async (request, reply) => {
    const body = z
      .object({ imageUrl: z.string().optional(), text: z.string().optional(), position: z.string().optional() })
      .parse(request.body)
    if (!body.imageUrl) return reply.status(400).send(error(400, 'imageUrl 为必填'))
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-outpainting/image-synthesis',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({ image_url: body.imageUrl, text: body.text, position: body.position ?? 'bottom-right' }),
      },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /watermark/video
  server.post('/watermark/video', async (request, reply) => {
    const body = z
      .object({ videoUrl: z.string().optional(), text: z.string().optional(), position: z.string().optional() })
      .parse(request.body)
    if (!body.videoUrl) return reply.status(400).send(error(400, 'videoUrl 为必填'))
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({ video_url: body.videoUrl, text: body.text, position: body.position ?? 'bottom-right' }),
      },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'dashscope', 'watermark-video', data)
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // GET /usage
  server.get('/usage', async (request, reply) => {
    const list: UsageStat[] = []
    for (const u of usageStore.values()) if (u.userId === request.userId) list.push(u)
    const total = list.reduce((sum, u) => sum + u.calls, 0)
    return reply.send(success({ total, vendors: list }))
  })

  // GET /usage/:vendor
  server.get('/usage/:vendor', async (request, reply) => {
    const { vendor } = vendorParam.parse(request.params)
    const u = usageStore.get(`${request.userId}:${vendor}`)
    if (!u) return reply.send(success({ userId: request.userId, vendor, calls: 0 }))
    return reply.send(success(u))
  })

  // POST /aigc/record
  server.post('/aigc/record', async (request, reply) => {
    const body = z
      .object({
        type: z.string().optional(),
        vendor: z.string().optional(),
        prompt: z.string().optional(),
        resultUrl: z.string().optional(),
      })
      .parse(request.body)
    if (!body.type || !body.vendor) return reply.status(400).send(error(400, 'type 和 vendor 为必填'))
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
  })

  // GET /aigc/records
  server.get('/aigc/records', async (request, reply) => {
    const query = aigcRecordsQuery.parse(request.query)
    const list: AigcRecord[] = []
    for (const r of aigcStore.values()) {
      if (r.userId !== request.userId) continue
      if (query.type && r.type !== query.type) continue
      if (query.vendor && r.vendor !== query.vendor) continue
      list.push(r)
    }
    list.sort((a, b) => b.createdAt - a.createdAt)
    return reply.send(success(list))
  })

  // DELETE /aigc/records/:recordId
  server.delete('/aigc/records/:recordId', async (request, reply) => {
    const { recordId } = recordIdParam.parse(request.params)
    const record = aigcStore.get(recordId)
    if (!record) return reply.status(404).send(error(404, '记录不存在'))
    if (record.userId !== request.userId) return reply.status(403).send(error(403, '无权删除该记录'))
    aigcStore.delete(recordId)
    return reply.send(success({ recordId, deleted: true }))
  })

  // GET /aigc/records/stats
  server.get('/aigc/records/stats', async (request, reply) => {
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
  })
}

// ============================================================================
// 管理端点:AI 厂商配置管理(需管理员)
// ============================================================================

export const adminAiVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /vendors — 厂商配置状态
  server.get('/vendors', async (_request, reply) => {
    const list = await listAllVendorsWithStatus()
    return reply.send(success(list))
  })

  // GET /vendors/:vendor — 厂商详情
  server.get('/vendors/:vendor', async (request, reply) => {
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
  })

  // POST /vendors/:vendor/test — 测试厂商连通性
  server.post('/vendors/:vendor/test', async (request, reply) => {
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
      return reply.send(success({ vendor, reachable: resp.status < 500, statusCode: resp.status }))
    } catch (e) {
      return reply.send(success({ vendor, reachable: false, error: (e as Error).message }))
    }
  })

  // GET /tasks — 全部异步任务(管理视角)
  server.get('/tasks', async (request, reply) => {
    const query = tasksQuery.parse(request.query)
    const list: AsyncTask[] = []
    for (const t of taskStore.values()) {
      if (query.vendor && t.vendor !== query.vendor) continue
      if (query.status && t.status !== query.status) continue
      list.push(t)
    }
    list.sort((a, b) => b.createdAt - a.createdAt)
    return reply.send(success(list))
  })

  // GET /usage — 全厂商用量
  server.get('/usage', async (_request, reply) => {
    const byVendor: Record<string, number> = {}
    let total = 0
    for (const u of usageStore.values()) {
      byVendor[u.vendor] = (byVendor[u.vendor] ?? 0) + u.calls
      total += u.calls
    }
    return reply.send(success({ total, byVendor }))
  })
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
