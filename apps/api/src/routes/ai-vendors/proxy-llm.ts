/**
 * LLM 代理子路由:Dashscope(10 端点)+ Doubao(8 端点)+ Gemini(8 端点)+ aiVendorV2Routes(新签名样板)。
 */
import { z } from 'zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { success, error } from '../../utils/response.js'
import { callVendor as newCallVendor } from '../../services/vendor-caller-service.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  createTask,
  chatBody,
  imageBody,
  ttsBody,
  asrBody,
  promptModelBody,
  textModelBody,
  multimodalBody,
} from './_shared.js'

export const llmVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // 1. Dashscope(阿里通义)— 10 端点
  server.post('/dashscope/chat', async (request, reply) => {
    const body = chatBody.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/dashscope/image', async (request, reply) => {
    const body = imageBody.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'dashscope', 'image', data)
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  server.post('/dashscope/image-edit', async (request, reply) => {
    const body = z
      .object({ prompt: z.string().optional(), imageUrl: z.string().optional() })
      .parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/dashscope/tts', async (request, reply) => {
    const body = ttsBody.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/text-to-audio',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/dashscope/asr', async (request, reply) => {
    const body = asrBody.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.get('/dashscope/models', async (_request, reply) => {
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/dashscope/video', async (request, reply) => {
    const body = promptModelBody.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'dashscope', 'video', data)
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  server.post('/dashscope/embedding', async (request, reply) => {
    const body = textModelBody.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/dashscope/multimodal', async (request, reply) => {
    const body = multimodalBody.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/dashscope/agent', async (request, reply) => {
    const body = z
      .object({ agentId: z.string().optional(), messages: z.array(z.unknown()).optional() })
      .parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/agents/generation',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // 2. Doubao(豆包/字节)— 8 端点
  server.post('/doubao/chat', async (request, reply) => {
    const body = chatBody.parse(request.body)
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  server.post('/doubao/image', async (request, reply) => {
    const body = imageBody.parse(request.body)
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  server.post('/doubao/image-edit', async (request, reply) => {
    const body = z
      .object({
        prompt: z.string().optional(),
        image: z.string().optional(),
        model: z.string().optional(),
        size: z.string().optional(),
        strength: z.number().optional(),
      })
      .parse(request.body)
    if (!body.prompt || !body.image) {
      return reply.status(400).send(error(400, 'prompt 和 image 为必填'))
    }
    const payload = {
      model: body.model ?? 'doubao-seededit-3-0-i2i',
      prompt: body.prompt,
      image: body.image,
      ...(body.size ? { size: body.size } : {}),
      ...(body.strength !== undefined ? { strength: body.strength } : {}),
    }
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      reply,
      { method: 'POST', body: JSON.stringify(payload) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  server.post('/doubao/tts', async (request, reply) => {
    const body = ttsBody.parse(request.body)
    const data = await callVendor('doubao', 'https://openspeech.bytedance.com/api/v1/tts', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  server.post('/doubao/asr', async (request, reply) => {
    const body = asrBody.parse(request.body)
    const data = await callVendor('doubao', 'https://openspeech.bytedance.com/api/v1/asr', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  server.get('/doubao/models', async (_request, reply) => {
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/models',
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/doubao/video', async (request, reply) => {
    const body = promptModelBody.parse(request.body)
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'doubao', 'video', data)
    recordUsage(request.userId!, 'doubao')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  server.post('/doubao/embedding', async (request, reply) => {
    const body = textModelBody.parse(request.body)
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/embeddings',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  server.post('/doubao/multimodal', async (request, reply) => {
    const body = multimodalBody.parse(request.body)
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // 3. Gemini(Google)— 8 端点
  server.post('/gemini/chat', async (request, reply) => {
    const body = multimodalBody.parse(request.body)
    const model = body.model ?? 'gemini-2.0-flash'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  server.post('/gemini/image', async (request, reply) => {
    const body = imageBody.parse(request.body)
    const model = body.model ?? 'imagen-3.0-generate-002'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`,
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          instances: [{ prompt: body.prompt }],
          parameters: { sampleCount: 1 },
        }),
      },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  server.post('/gemini/tts', async (request, reply) => {
    const body = ttsBody.parse(request.body)
    const data = await callVendor(
      'gemini',
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          input: { text: body.text },
          voice: { languageCode: 'zh-CN', name: body.voice },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  server.post('/gemini/asr', async (request, reply) => {
    const body = asrBody.parse(request.body)
    const data = await callVendor(
      'gemini',
      'https://speech.googleapis.com/v1/speech:recognize',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  server.get('/gemini/models', async (_request, reply) => {
    const data = await callVendor(
      'gemini',
      'https://generativelanguage.googleapis.com/v1beta/models',
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/gemini/video', async (request, reply) => {
    const body = promptModelBody.parse(request.body)
    const model = body.model ?? 'veo-3.0-generate-preview'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning`,
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          instances: [{ prompt: body.prompt }],
          parameters: { sampleCount: 1 },
        }),
      },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'gemini', 'video', data)
    recordUsage(request.userId!, 'gemini')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  server.post('/gemini/embedding', async (request, reply) => {
    const body = textModelBody.parse(request.body)
    const model = body.model ?? 'text-embedding-004'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
      reply,
      { method: 'POST', body: JSON.stringify({ content: { parts: [{ text: body.text }] } }) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  server.post('/gemini/multimodal', async (request, reply) => {
    const body = multimodalBody.parse(request.body)
    const model = body.model ?? 'gemini-2.0-flash'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })
}

// R4 重构样板:新签名 callVendor(vendor, ctx, reply) 业务路由
// 当前已迁移:DASHSCOPE(10 端点)、DOUBAO(8 端点)、GEMINI(8 端点)
export const llmVendorV2Routes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  server.post('/v2/dashscope/chat', async (request, reply) => {
    const body = chatBody.parse(request.body)
    const data = await newCallVendor(
      'dashscope',
      { method: 'POST', endpoint: '/compatible-mode/v1/chat/completions', body },
      reply,
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/v2/dashscope/image', async (request, reply) => {
    const body = imageBody.parse(request.body)
    const data = await newCallVendor(
      'dashscope',
      { method: 'POST', endpoint: '/api/v1/services/aigc/text2image/image-synthesis', body },
      reply,
    )
    if (data === null) return
    const task = createTask(request.userId!, 'dashscope', 'image', data)
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  server.post('/v2/dashscope/tts', async (request, reply) => {
    const body = ttsBody.parse(request.body)
    const data = await newCallVendor(
      'dashscope',
      { method: 'POST', endpoint: '/api/v1/services/audio/tts/text-to-audio', body },
      reply,
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/v2/dashscope/asr', async (request, reply) => {
    const body = asrBody.parse(request.body)
    const data = await newCallVendor(
      'dashscope',
      { method: 'POST', endpoint: '/api/v1/services/audio/asr/transcription', body },
      reply,
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  server.post('/v2/doubao/chat', async (request, reply) => {
    const body = chatBody.parse(request.body)
    const data = await newCallVendor(
      'doubao',
      { method: 'POST', endpoint: '/api/v3/chat/completions', body },
      reply,
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  server.post('/v2/gemini/chat', async (request, reply) => {
    const body = multimodalBody.parse(request.body)
    const model = body.model ?? 'gemini-2.0-flash'
    const data = await newCallVendor(
      'gemini',
      {
        method: 'POST',
        endpoint: `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        body,
        configOverride: { headerName: 'x-goog-api-key' },
      },
      reply,
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })
}
