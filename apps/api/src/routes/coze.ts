/**
 * Coze 平台集成路由（迁移自旧架构 server/app/api/v1/coze/）。
 *
 * 包含 12 个子模块:apps / audio / chat-audio / conversations / datasets /
 * files / review / templates / workflows / workflows/async / workspaces / bot。
 * variables 子模块已由 coze-variables.ts（DB 存储）独立覆盖,此处不重复。
 *
 * 环境变量:
 * - COZE_API_KEY   Coze PAT/Bearer Token
 * - COZE_BASE_URL  Coze Open API 根地址(默认 https://api.coze.cn)
 *
 * 注册(server.ts):
 *   server.register(cozeRoutes, { prefix: '/api/coze' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';

// =============================================================================
// 鉴权
// =============================================================================

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
    return true;
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
}

// =============================================================================
// Coze 配置 & 通用请求工具
// =============================================================================

function cozeBaseUrl(): string {
  return process.env.COZE_BASE_URL ?? 'https://api.coze.cn';
}

function cozeApiKey(): string {
  return process.env.COZE_API_KEY ?? '';
}

function requireCozeConfig(reply: FastifyReply): boolean {
  if (!cozeApiKey()) {
    reply.status(503).send(error(503, 'Coze 服务未配置(COZE_API_KEY 缺失)'));
    return false;
  }
  return true;
}

function cozeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${cozeApiKey()}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** 带超时的 fetch,默认 30s。 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 通用 Coze JSON API 代理。失败时写入 reply 并返回 null。 */
async function cozeRequest(
  method: string,
  path: string,
  reply: FastifyReply,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<unknown | null> {
  if (!requireCozeConfig(reply)) return null;
  try {
    const resp = await fetchWithTimeout(
      cozeBaseUrl() + path,
      { ...options, method, headers: cozeHeaders(options.headers as Record<string, string> | undefined) },
      timeoutMs,
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      reply.status(502).send(error(502, `Coze 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`));
      return null;
    }
    return data;
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message;
    reply.status(502).send(error(502, `Coze 调用异常: ${msg}`));
    return null;
  }
}

/** Coze multipart 上传代理。 */
async function cozeUpload(
  path: string,
  reply: FastifyReply,
  fields: Record<string, string>,
  file: { buffer: Buffer; filename: string },
): Promise<unknown | null> {
  if (!requireCozeConfig(reply)) return null;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([new Uint8Array(file.buffer)]), file.filename || 'upload');
  try {
    const resp = await fetchWithTimeout(cozeBaseUrl() + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cozeApiKey()}` },
      body: form,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      reply.status(502).send(error(502, `Coze 上传失败: ${resp.status}`));
      return null;
    }
    return data;
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message;
    reply.status(502).send(error(502, `Coze 上传异常: ${msg}`));
    return null;
  }
}

/** 读取 multipart 请求中的字段与单个文件。 */
async function readMultipart(
  request: FastifyRequest,
): Promise<{ fields: Record<string, string>; file: { buffer: Buffer; filename: string } | null }> {
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; filename: string } | null = null;
  for await (const part of request.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = String(part.value);
    } else if (part.type === 'file') {
      const buffer = await part.toBuffer();
      file = { buffer, filename: part.filename };
    }
  }
  return { fields, file };
}

/** SSE 流式代理:POST JSON 到 Coze 上游,逐行转发为 text/event-stream。 */
async function streamCozeSse(
  reply: FastifyReply,
  upstreamPath: string,
  payload: unknown,
): Promise<void> {
  if (!requireCozeConfig(reply)) return;
  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  try {
    const resp = await fetch(cozeBaseUrl() + upstreamPath, {
      method: 'POST',
      headers: cozeHeaders(),
      body: JSON.stringify(payload),
    });
    if (!resp.ok || !resp.body) {
      raw.write(`data: ${JSON.stringify({ error: `Coze ${resp.status}` })}\n\n`);
      raw.end();
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (line) raw.write(`data: ${line}\n\n`);
      }
    }
    if (buf.trim()) raw.write(`data: ${buf.trim()}\n\n`);
    raw.end();
  } catch (e) {
    raw.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
    raw.end();
  }
}

// =============================================================================
// 共享 Zod schemas
// =============================================================================

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// Coze 路由（挂载于 /api/coze）
// =============================================================================

export const cozeRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // ===========================================================================
  // 1. apps — Coze 应用管理
  // ===========================================================================
  // GET /apps/list              应用列表
  // GET /apps/list_api_apps     API 应用列表
  // GET /apps/events            应用事件列表
  server.get('/apps/list', async (request, reply) => {
    const parsed = pageQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const { page, size } = parsed.data;
    const data = await cozeRequest('GET', `/v1/apps/list?page_index=${page}&page_size=${size}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.get('/apps/list_api_apps', async (request, reply) => {
    const parsed = pageQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const { page, size } = parsed.data;
    const data = await cozeRequest('GET', `/v1/apps/list_api_apps?page_index=${page}&page_size=${size}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.get('/apps/events', async (request, reply) => {
    const q = z.object({ app_id: z.string().min(1), page: z.coerce.number().int().min(1).default(1), size: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(request.query);
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'));
    const { app_id, page, size } = q.data;
    const data = await cozeRequest('GET', `/v1/apps/events?app_id=${encodeURIComponent(app_id)}&page_index=${page}&page_size=${size}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 2. audio — 音频处理
  // ===========================================================================
  // GET    /audio/voices          音色列表
  // POST   /audio/speech          语音合成
  // POST   /audio/chat-audio      音频对话
  // GET    /audio/voiceprints     声纹列表
  // POST   /audio/voiceprints     创建声纹
  // PUT    /audio/voiceprints     更新声纹
  // DELETE /audio/voiceprints     删除声纹
  server.get('/audio/voices', async (request, reply) => {
    const q = z.object({ filter_type: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'));
    const params = new URLSearchParams();
    if (q.data.filter_type) params.set('filter_type', q.data.filter_type);
    const data = await cozeRequest('GET', `/v1/audio/voices?${params.toString()}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/audio/speech', async (request, reply) => {
    const b = z.object({
      input: z.string().min(1),
      voice_id: z.string().min(1),
      response_format: z.string().optional(),
      speed: z.number().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/audio/speech', reply, {
      body: JSON.stringify({
        input: b.data.input,
        voice_id: b.data.voice_id,
        response_format: b.data.response_format ?? 'mp3',
        speed: b.data.speed ?? 1.0,
      }),
    });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/audio/chat-audio', async (request, reply) => {
    const b = z.object({
      bot_id: z.string().min(1),
      conversation_id: z.string().optional(),
      audio_data: z.string().min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const payload: Record<string, unknown> = {
      bot_id: b.data.bot_id,
      additional_messages: [{ role: 'user', content: b.data.audio_data, content_type: 'audio' }],
    };
    if (b.data.conversation_id) payload.conversation_id = b.data.conversation_id;
    const data = await cozeRequest('POST', '/v3/chat', reply, { body: JSON.stringify(payload) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.get('/audio/voiceprints', async (_request, reply) => {
    const data = await cozeRequest('GET', '/v1/audio/voiceprints', reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/audio/voiceprints', async (request, reply) => {
    const b = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      audio_data: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const body: Record<string, unknown> = { name: b.data.name };
    if (b.data.description) body.description = b.data.description;
    if (b.data.audio_data) body.audio_data = b.data.audio_data;
    const data = await cozeRequest('POST', '/v1/audio/voiceprints', reply, { body: JSON.stringify(body) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.put('/audio/voiceprints', async (request, reply) => {
    const b = z.object({
      voiceprint_id: z.string().min(1),
      name: z.string().optional(),
      description: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const body: Record<string, unknown> = { voiceprint_id: b.data.voiceprint_id };
    if (b.data.name) body.name = b.data.name;
    if (b.data.description) body.description = b.data.description;
    const data = await cozeRequest('PUT', '/v1/audio/voiceprints', reply, { body: JSON.stringify(body) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.delete('/audio/voiceprints', async (request, reply) => {
    const b = z.object({ voiceprint_id: z.string().min(1) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('DELETE', '/v1/audio/voiceprints', reply, { body: JSON.stringify({ voiceprint_id: b.data.voiceprint_id }) });
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 3. chat-audio — 聊天音频
  // ===========================================================================
  // POST /chat-audio/simple       简单音频对话
  // POST /chat-audio/one-to-one   一对一音频流式对话(SSE)
  // POST /chat-audio/plugin       插件音频对话
  server.post('/chat-audio/simple', async (request, reply) => {
    const b = z.object({
      bot_id: z.string().min(1),
      conversation_id: z.string().optional(),
      audio_data: z.string().min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const payload: Record<string, unknown> = {
      bot_id: b.data.bot_id,
      additional_messages: [{ role: 'user', content: b.data.audio_data, content_type: 'audio' }],
    };
    if (b.data.conversation_id) payload.conversation_id = b.data.conversation_id;
    const data = await cozeRequest('POST', '/v3/chat', reply, { body: JSON.stringify(payload) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/chat-audio/one-to-one', async (request, reply) => {
    const b = z.object({
      bot_id: z.string().min(1),
      user_id: z.string().min(1),
      conversation_id: z.string().optional(),
      audio_data: z.string().min(1),
      voice_id: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const payload: Record<string, unknown> = {
      bot_id: b.data.bot_id,
      user_id: b.data.user_id,
      stream: true,
      additional_messages: [{ role: 'user', content: b.data.audio_data, content_type: 'audio' }],
    };
    if (b.data.conversation_id) payload.conversation_id = b.data.conversation_id;
    if (b.data.voice_id) payload.voice_id = b.data.voice_id;
    return streamCozeSse(reply, '/v3/chat', payload);
  });

  server.post('/chat-audio/plugin', async (request, reply) => {
    const b = z.object({
      bot_id: z.string().min(1),
      conversation_id: z.string().optional(),
      plugin_id: z.string().min(1),
      audio_data: z.string().min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const payload: Record<string, unknown> = {
      bot_id: b.data.bot_id,
      plugin_id: b.data.plugin_id,
      additional_messages: [{ role: 'user', content: b.data.audio_data, content_type: 'audio' }],
    };
    if (b.data.conversation_id) payload.conversation_id = b.data.conversation_id;
    const data = await cozeRequest('POST', '/v3/chat', reply, { body: JSON.stringify(payload) });
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 4. conversations — 会话管理
  // ===========================================================================
  // POST /conversations/list              会话列表
  // POST /conversations/messages          消息列表
  // POST /conversations/messages/feedback 消息反馈
  // POST /conversations/retrieve          会话详情
  server.post('/conversations/list', async (request, reply) => {
    const b = z.object({
      bot_id: z.string().min(1),
      user_id: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/conversation/list?bot_id=${encodeURIComponent(b.data.bot_id)}&user_id=${encodeURIComponent(b.data.user_id)}&page_size=${b.data.limit}&page_index=${Math.floor(b.data.offset / b.data.limit) + 1}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/conversations/messages', async (request, reply) => {
    const b = z.object({
      conversation_id: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/conversation/message/list?conversation_id=${encodeURIComponent(b.data.conversation_id)}&page_size=${b.data.limit}&page_index=${Math.floor(b.data.offset / b.data.limit) + 1}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/conversations/messages/feedback', async (request, reply) => {
    const b = z.object({
      message_id: z.string().min(1),
      conversation_id: z.string().min(1),
      feedback_type: z.string().min(1),
      content: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/conversation/message/feedback', reply, {
      body: JSON.stringify({
        message_id: b.data.message_id,
        conversation_id: b.data.conversation_id,
        feedback_type: b.data.feedback_type,
        content: b.data.content ?? '',
      }),
    });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/conversations/retrieve', async (request, reply) => {
    const b = z.object({ conversation_id: z.string().min(1) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/conversation/retrieve?conversation_id=${encodeURIComponent(b.data.conversation_id)}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 5. datasets — 数据集/知识库
  // ===========================================================================
  // POST /datasets                  创建数据集
  // POST /datasets/list             数据集列表
  // POST /datasets/documents/upload 文档上传(multipart)
  // POST /datasets/documents/list   文档列表
  // POST /datasets/images/upload    图片上传(multipart)
  // POST /datasets/images/list      图片列表
  server.post('/datasets', async (request, reply) => {
    const b = z.object({
      name: z.string().min(1),
      space_id: z.string().min(1),
      description: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const body: Record<string, unknown> = { name: b.data.name, space_id: b.data.space_id };
    if (b.data.description) body.description = b.data.description;
    const data = await cozeRequest('POST', '/v1/datasets/create', reply, { body: JSON.stringify(body) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/datasets/list', async (request, reply) => {
    const b = z.object({
      space_id: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/datasets/list?space_id=${encodeURIComponent(b.data.space_id)}&page_size=${b.data.limit}&page_index=${Math.floor(b.data.offset / b.data.limit) + 1}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/datasets/documents/upload', async (request, reply) => {
    const { fields, file } = await readMultipart(request);
    if (!file) return reply.status(400).send(error(400, '未检测到上传文件'));
    const datasetId = fields.dataset_id;
    if (!datasetId) return reply.status(400).send(error(400, '缺少 dataset_id'));
    const data = await cozeUpload('/v1/datasets/documents/upload', reply, {
      dataset_id: datasetId,
      document_name: file.filename || 'doc',
      document_source: '0',
    }, file);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/datasets/documents/list', async (request, reply) => {
    const b = z.object({
      dataset_id: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/datasets/documents/list?dataset_id=${encodeURIComponent(b.data.dataset_id)}&page_size=${b.data.limit}&page_index=${Math.floor(b.data.offset / b.data.limit) + 1}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/datasets/images/upload', async (request, reply) => {
    const { fields, file } = await readMultipart(request);
    if (!file) return reply.status(400).send(error(400, '未检测到上传文件'));
    const datasetId = fields.dataset_id;
    if (!datasetId) return reply.status(400).send(error(400, '缺少 dataset_id'));
    const data = await cozeUpload('/v1/datasets/images/upload', reply, { dataset_id: datasetId }, file);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/datasets/images/list', async (request, reply) => {
    const b = z.object({
      dataset_id: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/datasets/images/list?dataset_id=${encodeURIComponent(b.data.dataset_id)}&page_size=${b.data.limit}&page_index=${Math.floor(b.data.offset / b.data.limit) + 1}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 6. files — 文件管理
  // ===========================================================================
  // POST /files/upload  文件上传(multipart)
  server.post('/files/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send(error(400, '未检测到上传文件'));
    const buffer = await data.toBuffer();
    const result = await cozeUpload('/v1/files/upload', reply, {}, { buffer, filename: data.filename || 'upload' });
    if (result === null) return;
    reply.send(success(result));
  });

  // ===========================================================================
  // 7. review — 内容审核
  // ===========================================================================
  // POST /review/update_review_result  更新审核结果
  // GET  /review/status                查询审核状态
  server.post('/review/update_review_result', async (request, reply) => {
    const b = z.object({
      bot_id: z.string().min(1),
      connector_id: z.string().min(1),
      audit_status: z.number().int(),
      reason: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const body: Record<string, unknown> = { audit_status: b.data.audit_status };
    if (b.data.reason) body.reason = b.data.reason;
    const data = await cozeRequest('PUT', `/v1/connectors/${encodeURIComponent(b.data.connector_id)}/bots/${encodeURIComponent(b.data.bot_id)}`, reply, { body: JSON.stringify(body) }, 15_000);
    if (data === null) return;
    reply.send(success({ success: true, message: 'ok', data }));
  });

  server.get('/review/status', async (request, reply) => {
    const q = z.object({ bot_id: z.string().min(1), connector_id: z.string().min(1) }).safeParse(request.query);
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/connectors/${encodeURIComponent(q.data.connector_id)}/bots/${encodeURIComponent(q.data.bot_id)}`, reply, undefined, 15_000);
    if (data === null) return;
    reply.send(success({ bot_id: q.data.bot_id, connector_id: q.data.connector_id, data }));
  });

  // ===========================================================================
  // 8. templates — 模板管理
  // ===========================================================================
  // GET  /templates/list       模板列表
  // POST /templates/duplicate  复制模板
  server.get('/templates/list', async (request, reply) => {
    const parsed = pageQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const { page, size } = parsed.data;
    const data = await cozeRequest('GET', `/v1/templates/list?page_index=${page}&page_size=${size}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/templates/duplicate', async (request, reply) => {
    const b = z.object({
      template_id: z.string().min(1),
      workspace_id: z.string().min(1),
      name: z.string().min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/templates/duplicate', reply, {
      body: JSON.stringify({ template_id: b.data.template_id, workspace_id: b.data.workspace_id, name: b.data.name }),
    });
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 9. workflows — 工作流
  // ===========================================================================
  // POST /workflows/runs                运行工作流
  // POST /workflows/runs/stream         流式运行(SSE)
  // POST /workflows/runs/resume         恢复中断工作流(SSE)
  // POST /workflows/runs/history        运行历史
  // POST /workflows/runs/execute-nodes  节点执行历史
  // POST /workflows/search/model/run    模型搜索工作流
  server.post('/workflows/runs', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      parameters: z.record(z.string(), z.unknown()).optional(),
      is_async: z.boolean().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const body: Record<string, unknown> = { workflow_id: b.data.workflow_id, parameters: b.data.parameters ?? {} };
    if (b.data.is_async) body.is_async = true;
    const data = await cozeRequest('POST', '/v1/workflow/run', reply, { body: JSON.stringify(body) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/workflows/runs/stream', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      parameters: z.record(z.string(), z.unknown()).optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    return streamCozeSse(reply, '/v1/workflow/stream_run', {
      workflow_id: b.data.workflow_id,
      parameters: b.data.parameters ?? {},
    });
  });

  server.post('/workflows/runs/resume', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      event_id: z.string().min(1),
      resume_data: z.string().min(1),
      interrupt_type: z.string().min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    return streamCozeSse(reply, '/v1/workflow/stream_run', {
      workflow_id: b.data.workflow_id,
      event_id: b.data.event_id,
      resume_data: b.data.resume_data,
      interrupt_type: b.data.interrupt_type,
    });
  });

  server.post('/workflows/runs/history', async (request, reply) => {
    const b = z.object({ workflow_id: z.string().min(1), execute_id: z.string().min(1) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/workflow/run_histories?workflow_id=${encodeURIComponent(b.data.workflow_id)}&execute_id=${encodeURIComponent(b.data.execute_id)}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/workflows/runs/execute-nodes', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      execute_id: z.string().min(1),
      node_execute_uuid: z.string().min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/workflow/run_histories/execute_nodes?workflow_id=${encodeURIComponent(b.data.workflow_id)}&execute_id=${encodeURIComponent(b.data.execute_id)}&node_execute_uuid=${encodeURIComponent(b.data.node_execute_uuid)}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/workflows/search/model/run', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      content: z.string().min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/workflow/run', reply, {
      body: JSON.stringify({ workflow_id: b.data.workflow_id, parameters: { content: b.data.content } }),
    });
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 10. workflows/async — 异步工作流
  // ===========================================================================
  // POST /workflows/async        异步运行
  // POST /workflows/async/stream 流式运行(SSE)
  // POST /workflows/async/chat   工作流对话
  server.post('/workflows/async', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      user_id: z.string().min(1).optional(),
      input_data: z.record(z.string(), z.unknown()).default({}),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/workflow/run', reply, {
      body: JSON.stringify({ workflow_id: b.data.workflow_id, parameters: b.data.input_data }),
    });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/workflows/async/stream', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      user_id: z.string().min(1).optional(),
      input_data: z.record(z.string(), z.unknown()).default({}),
      chat_id: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    return streamCozeSse(reply, '/v1/workflow/stream_run', {
      workflow_id: b.data.workflow_id,
      parameters: b.data.input_data,
    });
  });

  server.post('/workflows/async/chat', async (request, reply) => {
    const b = z.object({
      workflow_id: z.string().min(1),
      user_id: z.string().min(1).optional(),
      input_data: z.record(z.string(), z.unknown()).default({}),
      chat_id: z.string().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const body: Record<string, unknown> = {
      workflow_id: b.data.workflow_id,
      parameters: b.data.input_data,
      chat_id: b.data.chat_id ?? '',
    };
    const data = await cozeRequest('POST', '/v1/workflow/run', reply, { body: JSON.stringify(body) });
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 11. workspaces — 工作空间
  // ===========================================================================
  // GET  /workspaces/list           工作空间列表
  // POST /workspaces/members/create 添加成员
  // POST /workspaces/members/delete 删除成员
  server.get('/workspaces/list', async (request, reply) => {
    const parsed = pageQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const { page, size } = parsed.data;
    const data = await cozeRequest('GET', `/v1/workspaces/list?page_index=${page}&page_size=${size}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/workspaces/members/create', async (request, reply) => {
    const b = z.object({
      workspace_id: z.string().min(1),
      members: z.array(z.record(z.string(), z.unknown())).min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/workspaces/members/create', reply, {
      body: JSON.stringify({ workspace_id: b.data.workspace_id, members: b.data.members }),
    });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/workspaces/members/delete', async (request, reply) => {
    const b = z.object({
      workspace_id: z.string().min(1),
      member_ids: z.array(z.string().min(1)).min(1),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/workspaces/members/delete', reply, {
      body: JSON.stringify({ workspace_id: b.data.workspace_id, member_ids: b.data.member_ids }),
    });
    if (data === null) return;
    reply.send(success(data));
  });

  // ===========================================================================
  // 12. bot — 机器人管理（对应旧架构 CozeClient bot 能力）
  // ===========================================================================
  // GET  /bot/list     机器人列表
  // GET  /bot/get      机器人详情
  // POST /bot/create   创建机器人
  // POST /bot/update   更新机器人
  // POST /bot/delete   删除机器人
  // POST /bot/publish  发布机器人
  server.get('/bot/list', async (request, reply) => {
    const q = z.object({
      space_id: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      size: z.coerce.number().int().min(1).max(100).default(20),
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'));
    const params = new URLSearchParams({ page_index: String(q.data.page), page_size: String(q.data.size) });
    if (q.data.space_id) params.set('space_id', q.data.space_id);
    const data = await cozeRequest('GET', `/v1/bot/list?${params.toString()}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.get('/bot/get', async (request, reply) => {
    const q = z.object({ bot_id: z.string().min(1) }).safeParse(request.query);
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('GET', `/v1/bot/get_online_info?bot_id=${encodeURIComponent(q.data.bot_id)}`, reply);
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/bot/create', async (request, reply) => {
    const b = z.object({ space_id: z.string().min(1), name: z.string().min(1), description: z.string().optional() })
      .passthrough()
      .safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/bot/create', reply, { body: JSON.stringify(b.data) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/bot/update', async (request, reply) => {
    const b = z.object({ bot_id: z.string().min(1) }).passthrough().safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/bot/update', reply, { body: JSON.stringify(b.data) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/bot/delete', async (request, reply) => {
    const b = z.object({ bot_id: z.string().min(1) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/bot/delete', reply, { body: JSON.stringify({ bot_id: b.data.bot_id }) });
    if (data === null) return;
    reply.send(success(data));
  });

  server.post('/bot/publish', async (request, reply) => {
    const b = z.object({ bot_id: z.string().min(1), version: z.string().optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'));
    const data = await cozeRequest('POST', '/v1/bot/publish', reply, {
      body: JSON.stringify({ bot_id: b.data.bot_id, version: b.data.version ?? '' }),
    });
    if (data === null) return;
    reply.send(success(data));
  });
};
