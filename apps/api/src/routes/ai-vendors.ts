/**
 * R4 AI 厂商专属多模态后端路由。
 *
 * 代理层:将请求转发到外部 AI 厂商 API(通义/豆包/Gemini/Suno/Sora2/Coze 等)。
 * 不依赖本地数据库表;异步任务、AIGC 记录、音色、用量统计使用进程内内存存储。
 *
 * 环境变量:
 * - DASHSCOPE_API_KEY / DOUBAO_API_KEY / GEMINI_API_KEY
 * - SUNO_API_KEY / SORA2_API_KEY / COZE_API_KEY
 *
 * 注册(server.ts):
 *   server.register(aiVendorRoutes, { prefix: '/api/ai' })
 *   server.register(adminAiVendorRoutes, { prefix: '/api/admin/ai' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';

// ============================================================================
// 鉴权
// ============================================================================

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

// ============================================================================
// 通用工具
// ============================================================================

/** 带超时的 fetch,默认 30s(同步请求)。 */
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

interface VendorConfig {
  name: string;
  keyEnv: string;
  baseUrl: string;
  authHeader: (key: string) => Record<string, string>;
}

/** 各厂商配置:名称、环境变量、Base URL、鉴权头构造。 */
const VENDORS: Record<string, VendorConfig> = {
  dashscope: {
    name: 'Dashscope(阿里通义)',
    keyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  doubao: {
    name: 'Doubao(豆包/字节)',
    keyEnv: 'DOUBAO_API_KEY',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  gemini: {
    name: 'Gemini(Google)',
    keyEnv: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authHeader: (key) => ({ 'x-goog-api-key': key }),
  },
  suno: {
    name: 'Suno(音乐生成)',
    keyEnv: 'SUNO_API_KEY',
    baseUrl: 'https://api.suno.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  sora2: {
    name: 'Sora2(OpenAI 视频)',
    keyEnv: 'SORA2_API_KEY',
    baseUrl: 'https://api.openai.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  coze: {
    name: 'Coze(扣子)',
    keyEnv: 'COZE_API_KEY',
    baseUrl: 'https://api.coze.cn',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

/**
 * 校验厂商 API Key 是否已配置。
 * 返回 key 字符串;未配置时发送 503 响应并返回 null。
 */
function requireVendorKey(
  vendor: string,
  reply: FastifyReply,
): string | null {
  const cfg = VENDORS[vendor];
  if (!cfg) {
    reply.status(400).send(error(400, `不支持的厂商: ${vendor}`));
    return null;
  }
  const key = process.env[cfg.keyEnv];
  if (!key) {
    reply.status(503).send(error(503, `${cfg.name} 服务未配置`));
    return null;
  }
  return key;
}

/** 通用:调用外部同步 API 并返回 JSON。失败时发送 502。 */
async function callVendor(
  vendor: string,
  url: string,
  reply: FastifyReply,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<unknown | null> {
  const key = requireVendorKey(vendor, reply);
  if (!key) return null;
  const cfg = VENDORS[vendor]!;
  try {
    const resp = await fetchWithTimeout(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...cfg.authHeader(key), ...(options.headers ?? {}) },
    }, timeoutMs);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      reply.status(502).send(error(502, `${cfg.name} 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`));
      return null;
    }
    return data;
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message;
    reply.status(502).send(error(502, `${cfg.name} 调用异常: ${msg}`));
    return null;
  }
}

// ============================================================================
// 内存存储(异步任务 / AIGC 记录 / 音色 / 用量)
// ============================================================================

interface AsyncTask {
  taskId: string;
  userId: string;
  vendor: string;
  type: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface AigcRecord {
  recordId: string;
  userId: string;
  type: string;
  vendor: string;
  prompt: string;
  resultUrl?: string;
  createdAt: number;
}

interface Timbre {
  timbreId: string;
  userId: string;
  voiceName: string;
  audioUrl: string;
  vendor: string;
  status: 'training' | 'ready' | 'failed';
  createdAt: number;
}

interface UsageStat {
  userId: string;
  vendor: string;
  calls: number;
  lastCallAt: number;
}

const taskStore = new Map<string, AsyncTask>();
const aigcStore = new Map<string, AigcRecord>();
const timbreStore = new Map<string, Timbre>();
const usageStore = new Map<string, UsageStat>();

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function recordUsage(userId: string, vendor: string): void {
  const k = `${userId}:${vendor}`;
  const cur = usageStore.get(k);
  const now = Date.now();
  if (cur) {
    cur.calls += 1;
    cur.lastCallAt = now;
  } else {
    usageStore.set(k, { userId, vendor, calls: 1, lastCallAt: now });
  }
}

function createTask(userId: string, vendor: string, type: string, payload?: unknown): AsyncTask {
  const now = Date.now();
  const task: AsyncTask = {
    taskId: genId('task'),
    userId,
    vendor,
    type,
    status: 'pending',
    result: payload,
    createdAt: now,
    updatedAt: now,
  };
  taskStore.set(task.taskId, task);
  return task;
}

// ============================================================================
// 主路由:AI 厂商代理端点
// ============================================================================

export const aiVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // ==========================================================================
  // 1. Dashscope(阿里通义)— 10 端点
  // ==========================================================================

  // POST /dashscope/chat — 通义千问对话
  server.post('/dashscope/chat', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string; temperature?: number };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success(data));
  });

  // POST /dashscope/image — 通义万相文生图(异步)
  server.post('/dashscope/image', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; size?: string };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    const task = createTask(request.userId!, 'dashscope', 'image', data);
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }));
  });

  // POST /dashscope/image-edit — 图片编辑
  server.post('/dashscope/image-edit', async (request, reply) => {
    const body = request.body as { prompt?: string; imageUrl?: string };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success(data));
  });

  // POST /dashscope/tts — 语音合成
  server.post('/dashscope/tts', async (request, reply) => {
    const body = request.body as { text?: string; model?: string; voice?: string };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/text-to-audio', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success(data));
  });

  // POST /dashscope/asr — 语音识别
  server.post('/dashscope/asr', async (request, reply) => {
    const body = request.body as { audioUrl?: string; model?: string };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success(data));
  });

  // GET /dashscope/models — 可用模型列表
  server.get('/dashscope/models', async (_request, reply) => {
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models', reply, { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // POST /dashscope/video — 视频生成(异步)
  server.post('/dashscope/video', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    const task = createTask(request.userId!, 'dashscope', 'video', data);
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }));
  });

  // POST /dashscope/embedding — 文本向量化
  server.post('/dashscope/embedding', async (request, reply) => {
    const body = request.body as { text?: string; model?: string };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success(data));
  });

  // POST /dashscope/multimodal — 多模态对话
  server.post('/dashscope/multimodal', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success(data));
  });

  // POST /dashscope/agent — 智能体调用
  server.post('/dashscope/agent', async (request, reply) => {
    const body = request.body as { agentId?: string; messages?: unknown[] };
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/agents/generation', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'dashscope');
    return reply.send(success(data));
  });

  // ==========================================================================
  // 2. Doubao(豆包/字节)— 8 端点
  // ==========================================================================

  // POST /doubao/chat — 对话
  server.post('/doubao/chat', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string; temperature?: number };
    const data = await callVendor('doubao',
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'doubao');
    return reply.send(success(data));
  });

  // POST /doubao/image — 文生图
  server.post('/doubao/image', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; size?: string };
    const data = await callVendor('doubao',
      'https://ark.cn-beijing.volces.com/api/v3/images/generations', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'doubao');
    return reply.send(success(data));
  });

  // POST /doubao/tts — 语音合成
  server.post('/doubao/tts', async (request, reply) => {
    const body = request.body as { text?: string; model?: string; voice?: string };
    const data = await callVendor('doubao',
      'https://openspeech.bytedance.com/api/v1/tts', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'doubao');
    return reply.send(success(data));
  });

  // POST /doubao/asr — 语音识别
  server.post('/doubao/asr', async (request, reply) => {
    const body = request.body as { audioUrl?: string; model?: string };
    const data = await callVendor('doubao',
      'https://openspeech.bytedance.com/api/v1/asr', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'doubao');
    return reply.send(success(data));
  });

  // GET /doubao/models — 模型列表
  server.get('/doubao/models', async (_request, reply) => {
    const data = await callVendor('doubao',
      'https://ark.cn-beijing.volces.com/api/v3/models', reply, { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // POST /doubao/video — 视频生成(异步)
  server.post('/doubao/video', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string };
    const data = await callVendor('doubao',
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    const task = createTask(request.userId!, 'doubao', 'video', data);
    recordUsage(request.userId!, 'doubao');
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }));
  });

  // POST /doubao/embedding — 向量化
  server.post('/doubao/embedding', async (request, reply) => {
    const body = request.body as { text?: string; model?: string };
    const data = await callVendor('doubao',
      'https://ark.cn-beijing.volces.com/api/v3/embeddings', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'doubao');
    return reply.send(success(data));
  });

  // POST /doubao/multimodal — 多模态
  server.post('/doubao/multimodal', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string };
    const data = await callVendor('doubao',
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'doubao');
    return reply.send(success(data));
  });

  // ==========================================================================
  // 3. Gemini(Google)— 8 端点
  // ==========================================================================

  // POST /gemini/chat — 对话
  server.post('/gemini/chat', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string };
    const model = body.model ?? 'gemini-2.0-flash';
    const data = await callVendor('gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'gemini');
    return reply.send(success(data));
  });

  // POST /gemini/image — 文生图(Imagen)
  server.post('/gemini/image', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; size?: string };
    const model = body.model ?? 'imagen-3.0-generate-002';
    const data = await callVendor('gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`, reply,
      { method: 'POST', body: JSON.stringify({ instances: [{ prompt: body.prompt }], parameters: { sampleCount: 1 } }) });
    if (data === null) return;
    recordUsage(request.userId!, 'gemini');
    return reply.send(success(data));
  });

  // POST /gemini/tts — 语音合成
  server.post('/gemini/tts', async (request, reply) => {
    const body = request.body as { text?: string; model?: string; voice?: string };
    const data = await callVendor('gemini',
      'https://texttospeech.googleapis.com/v1/text:synthesize', reply,
      { method: 'POST', body: JSON.stringify({ input: { text: body.text }, voice: { languageCode: 'zh-CN', name: body.voice }, audioConfig: { audioEncoding: 'MP3' } }) });
    if (data === null) return;
    recordUsage(request.userId!, 'gemini');
    return reply.send(success(data));
  });

  // POST /gemini/asr — 语音识别
  server.post('/gemini/asr', async (request, reply) => {
    const body = request.body as { audioUrl?: string; model?: string };
    const data = await callVendor('gemini',
      'https://speech.googleapis.com/v1/speech:recognize', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'gemini');
    return reply.send(success(data));
  });

  // GET /gemini/models — 模型列表
  server.get('/gemini/models', async (_request, reply) => {
    const data = await callVendor('gemini',
      'https://generativelanguage.googleapis.com/v1beta/models', reply, { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // POST /gemini/video — 视频生成(Veo,异步)
  server.post('/gemini/video', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string };
    const model = body.model ?? 'veo-3.0-generate-preview';
    const data = await callVendor('gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning`, reply,
      { method: 'POST', body: JSON.stringify({ instances: [{ prompt: body.prompt }], parameters: { sampleCount: 1 } }) });
    if (data === null) return;
    const task = createTask(request.userId!, 'gemini', 'video', data);
    recordUsage(request.userId!, 'gemini');
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }));
  });

  // POST /gemini/embedding — 向量化
  server.post('/gemini/embedding', async (request, reply) => {
    const body = request.body as { text?: string; model?: string };
    const model = body.model ?? 'text-embedding-004';
    const data = await callVendor('gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`, reply,
      { method: 'POST', body: JSON.stringify({ content: { parts: [{ text: body.text }] } }) });
    if (data === null) return;
    recordUsage(request.userId!, 'gemini');
    return reply.send(success(data));
  });

  // POST /gemini/multimodal — 多模态
  server.post('/gemini/multimodal', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string };
    const model = body.model ?? 'gemini-2.0-flash';
    const data = await callVendor('gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'gemini');
    return reply.send(success(data));
  });

  // ==========================================================================
  // 4. Suno(音乐生成)— 5 端点
  // ==========================================================================

  // POST /suno/generate — 生成音乐(异步)
  server.post('/suno/generate', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; duration?: number };
    const data = await callVendor('suno',
      'https://api.suno.ai/v1/music/generations', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    const task = createTask(request.userId!, 'suno', 'music', data);
    recordUsage(request.userId!, 'suno');
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }));
  });

  // GET /suno/tasks — 任务列表
  server.get('/suno/tasks', async (request, reply) => {
    const key = requireVendorKey('suno', reply);
    if (!key) return;
    const list: AsyncTask[] = [];
    for (const t of taskStore.values()) {
      if (t.vendor === 'suno' && t.userId === request.userId) list.push(t);
    }
    return reply.send(success(list));
  });

  // GET /suno/tasks/:taskId — 任务详情
  server.get('/suno/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);
    if (!task || task.vendor !== 'suno') {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    // 尝试从上游拉取最新状态
    const upstream = await callVendor('suno',
      `https://api.suno.ai/v1/music/generations/${encodeURIComponent(taskId)}`, reply, { method: 'GET' });
    if (upstream) task.result = upstream;
    task.updatedAt = Date.now();
    return reply.send(success(task));
  });

  // POST /suno/lyrics — 歌词生成
  server.post('/suno/lyrics', async (request, reply) => {
    const body = request.body as { prompt?: string };
    const data = await callVendor('suno',
      'https://api.suno.ai/v1/lyrics/generations', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'suno');
    return reply.send(success(data));
  });

  // GET /suno/models — 模型列表
  server.get('/suno/models', async (_request, reply) => {
    const data = await callVendor('suno', 'https://api.suno.ai/v1/models', reply, { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // ==========================================================================
  // 5. Sora2(OpenAI 视频)— 4 端点
  // ==========================================================================

  // POST /sora2/generate — 生成视频(异步)
  server.post('/sora2/generate', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; duration?: number; size?: string };
    const data = await callVendor('sora2',
      'https://api.openai.com/v1/videos/generations', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    const task = createTask(request.userId!, 'sora2', 'video', data);
    recordUsage(request.userId!, 'sora2');
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }));
  });

  // GET /sora2/tasks — 任务列表
  server.get('/sora2/tasks', async (request, reply) => {
    const list: AsyncTask[] = [];
    for (const t of taskStore.values()) {
      if (t.vendor === 'sora2' && t.userId === request.userId) list.push(t);
    }
    return reply.send(success(list));
  });

  // GET /sora2/tasks/:taskId — 任务详情
  server.get('/sora2/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);
    if (!task || task.vendor !== 'sora2') {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    const upstream = await callVendor('sora2',
      `https://api.openai.com/v1/videos/generations/${encodeURIComponent(taskId)}`, reply, { method: 'GET' });
    if (upstream) task.result = upstream;
    task.updatedAt = Date.now();
    return reply.send(success(task));
  });

  // GET /sora2/models — 模型列表
  server.get('/sora2/models', async (_request, reply) => {
    const data = await callVendor('sora2', 'https://api.openai.com/v1/models', reply, { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // ==========================================================================
  // 6. Coze(扣子)— 8 端点
  // ==========================================================================

  // POST /coze/chat — 对话
  server.post('/coze/chat', async (request, reply) => {
    const body = request.body as { botId?: string; messages?: unknown[] };
    const data = await callVendor('coze',
      'https://api.coze.cn/v1/chat', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'coze');
    return reply.send(success(data));
  });

  // POST /coze/bot/create — 创建机器人
  server.post('/coze/bot/create', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const data = await callVendor('coze',
      'https://api.coze.cn/v1/bot/create', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'coze');
    return reply.send(success(data));
  });

  // GET /coze/bots — 机器人列表
  server.get('/coze/bots', async (request, reply) => {
    const query = request.query as { page_size?: string };
    const data = await callVendor('coze',
      `https://api.coze.cn/v1/bots/list?${new URLSearchParams({ page_size: query.page_size ?? '20' })}`, reply,
      { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // GET /coze/bots/:botId — 机器人详情
  server.get('/coze/bots/:botId', async (request, reply) => {
    const { botId } = request.params as { botId: string };
    const data = await callVendor('coze',
      `https://api.coze.cn/v1/bot/get_online_info?bot_id=${encodeURIComponent(botId)}`, reply,
      { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // POST /coze/workflow/run — 运行工作流
  server.post('/coze/workflow/run', async (request, reply) => {
    const body = request.body as { workflowId?: string; parameters?: Record<string, unknown> };
    const data = await callVendor('coze',
      'https://api.coze.cn/v1/workflow/run', reply,
      { method: 'POST', body: JSON.stringify({ workflow_id: body.workflowId, parameters: body.parameters }) });
    if (data === null) return;
    recordUsage(request.userId!, 'coze');
    return reply.send(success(data));
  });

  // GET /coze/workflows — 工作流列表
  server.get('/coze/workflows', async (_request, reply) => {
    const data = await callVendor('coze',
      'https://api.coze.cn/v1/workflows/list', reply, { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // POST /coze/knowledge/upload — 知识库上传
  server.post('/coze/knowledge/upload', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const data = await callVendor('coze',
      'https://api.coze.cn/v1/knowledge/document/create', reply,
      { method: 'POST', body: JSON.stringify(body) });
    if (data === null) return;
    recordUsage(request.userId!, 'coze');
    return reply.send(success(data));
  });

  // GET /coze/knowledge/list — 知识库列表
  server.get('/coze/knowledge/list', async (request, reply) => {
    const query = request.query as { page_size?: string };
    const data = await callVendor('coze',
      `https://api.coze.cn/v1/knowledge/list?${new URLSearchParams({ page_size: query.page_size ?? '20' })}`, reply,
      { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // ==========================================================================
  // 7. 通用工具端点 — 17 端点
  // ==========================================================================

  // GET /vendors — 支持的厂商列表
  server.get('/vendors', async (_request, reply) => {
    const list = Object.entries(VENDORS).map(([key, cfg]) => ({
      vendor: key,
      name: cfg.name,
      configured: Boolean(process.env[cfg.keyEnv]),
    }));
    return reply.send(success(list));
  });

  // GET /vendors/:vendor/models — 指定厂商模型列表
  server.get('/vendors/:vendor/models', async (request, reply) => {
    const { vendor } = request.params as { vendor: string };
    const cfg = VENDORS[vendor];
    if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`));
    // 复用各厂商的 models 端点
    const modelEndpoints: Record<string, string> = {
      dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      doubao: 'https://ark.cn-beijing.volces.com/api/v3/models',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
      suno: 'https://api.suno.ai/v1/models',
      sora2: 'https://api.openai.com/v1/models',
      coze: 'https://api.coze.cn/v1/models',
    };
    const data = await callVendor(vendor, modelEndpoints[vendor] ?? cfg.baseUrl, reply, { method: 'GET' });
    if (data === null) return;
    return reply.send(success(data));
  });

  // POST /proxy — 通用代理
  server.post('/proxy', async (request, reply) => {
    const body = request.body as { vendor?: string; endpoint?: string; payload?: unknown };
    if (!body.vendor || !body.endpoint) {
      return reply.status(400).send(error(400, 'vendor 和 endpoint 为必填'));
    }
    const cfg = VENDORS[body.vendor];
    if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${body.vendor}`));
    const url = body.endpoint.startsWith('http') ? body.endpoint : `${cfg.baseUrl}${body.endpoint}`;
    const data = await callVendor(body.vendor, url, reply,
      { method: 'POST', body: JSON.stringify(body.payload ?? {}) });
    if (data === null) return;
    recordUsage(request.userId!, body.vendor);
    return reply.send(success(data));
  });

  // GET /tasks — 异步任务列表(跨厂商,当前用户)
  server.get('/tasks', async (request, reply) => {
    const query = request.query as { vendor?: string; status?: string };
    const list: AsyncTask[] = [];
    for (const t of taskStore.values()) {
      if (t.userId !== request.userId) continue;
      if (query.vendor && t.vendor !== query.vendor) continue;
      if (query.status && t.status !== query.status) continue;
      list.push(t);
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    return reply.send(success(list));
  });

  // GET /tasks/:taskId — 异步任务详情
  server.get('/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);
    if (!task) return reply.status(404).send(error(404, '任务不存在'));
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'));
    return reply.send(success(task));
  });

  // DELETE /tasks/:taskId — 取消任务
  server.delete('/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);
    if (!task) return reply.status(404).send(error(404, '任务不存在'));
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'));
    if (task.status === 'succeeded' || task.status === 'failed') {
      return reply.status(400).send(error(400, `任务已处于终态: ${task.status}`));
    }
    task.status = 'failed';
    task.error = '用户取消';
    task.updatedAt = Date.now();
    return reply.send(success(task));
  });

  // POST /timbre/clone — 音色克隆
  server.post('/timbre/clone', async (request, reply) => {
    const body = request.body as { voiceName?: string; audioUrl?: string; vendor?: string };
    if (!body.voiceName || !body.audioUrl) {
      return reply.status(400).send(error(400, 'voiceName 和 audioUrl 为必填'));
    }
    const vendor = body.vendor ?? 'doubao';
    const vendorCfg = VENDORS[vendor];
    if (!vendorCfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`));
    const data = await callVendor(vendor,
      `${vendorCfg.baseUrl}/v1/voice/clone`, reply,
      { method: 'POST', body: JSON.stringify({ voice_name: body.voiceName, audio_url: body.audioUrl }) });
    if (data === null) return;
    const timbre: Timbre = {
      timbreId: genId('timbre'),
      userId: request.userId!,
      voiceName: body.voiceName,
      audioUrl: body.audioUrl,
      vendor,
      status: 'training',
      createdAt: Date.now(),
    };
    timbreStore.set(timbre.timbreId, timbre);
    return reply.send(success(timbre));
  });

  // GET /timbre/list — 音色列表
  server.get('/timbre/list', async (request, reply) => {
    const list: Timbre[] = [];
    for (const t of timbreStore.values()) {
      if (t.userId === request.userId) list.push(t);
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    return reply.send(success(list));
  });

  // DELETE /timbre/:timbreId — 删除音色
  server.delete('/timbre/:timbreId', async (request, reply) => {
    const { timbreId } = request.params as { timbreId: string };
    const timbre = timbreStore.get(timbreId);
    if (!timbre) return reply.status(404).send(error(404, '音色不存在'));
    if (timbre.userId !== request.userId) return reply.status(403).send(error(403, '无权删除该音色'));
    timbreStore.delete(timbreId);
    return reply.send(success({ timbreId, deleted: true }));
  });

  // POST /watermark/image — 图片水印
  server.post('/watermark/image', async (request, reply) => {
    const body = request.body as { imageUrl?: string; text?: string; position?: string };
    if (!body.imageUrl) return reply.status(400).send(error(400, 'imageUrl 为必填'));
    // 委托给通义图片编辑(若无配置则返回提示)
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-outpainting/image-synthesis', reply,
      { method: 'POST', body: JSON.stringify({ image_url: body.imageUrl, text: body.text, position: body.position ?? 'bottom-right' }) });
    if (data === null) return;
    return reply.send(success(data));
  });

  // POST /watermark/video — 视频水印
  server.post('/watermark/video', async (request, reply) => {
    const body = request.body as { videoUrl?: string; text?: string; position?: string };
    if (!body.videoUrl) return reply.status(400).send(error(400, 'videoUrl 为必填'));
    const data = await callVendor('dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', reply,
      { method: 'POST', body: JSON.stringify({ video_url: body.videoUrl, text: body.text, position: body.position ?? 'bottom-right' }) });
    if (data === null) return;
    const task = createTask(request.userId!, 'dashscope', 'watermark-video', data);
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }));
  });

  // GET /usage — 用量统计(当前用户)
  server.get('/usage', async (request, reply) => {
    const list: UsageStat[] = [];
    for (const u of usageStore.values()) {
      if (u.userId === request.userId) list.push(u);
    }
    const total = list.reduce((sum, u) => sum + u.calls, 0);
    return reply.send(success({ total, vendors: list }));
  });

  // GET /usage/:vendor — 指定厂商用量
  server.get('/usage/:vendor', async (request, reply) => {
    const { vendor } = request.params as { vendor: string };
    const u = usageStore.get(`${request.userId}:${vendor}`);
    if (!u) return reply.send(success({ userId: request.userId, vendor, calls: 0 }));
    return reply.send(success(u));
  });

  // POST /aigc/record — 记录 AIGC 生成
  server.post('/aigc/record', async (request, reply) => {
    const body = request.body as { type?: string; vendor?: string; prompt?: string; resultUrl?: string };
    if (!body.type || !body.vendor) {
      return reply.status(400).send(error(400, 'type 和 vendor 为必填'));
    }
    const record: AigcRecord = {
      recordId: genId('aigc'),
      userId: request.userId!,
      type: body.type,
      vendor: body.vendor,
      prompt: body.prompt ?? '',
      resultUrl: body.resultUrl,
      createdAt: Date.now(),
    };
    aigcStore.set(record.recordId, record);
    return reply.send(success(record));
  });

  // GET /aigc/records — AIGC 记录列表
  server.get('/aigc/records', async (request, reply) => {
    const query = request.query as { type?: string; vendor?: string };
    const list: AigcRecord[] = [];
    for (const r of aigcStore.values()) {
      if (r.userId !== request.userId) continue;
      if (query.type && r.type !== query.type) continue;
      if (query.vendor && r.vendor !== query.vendor) continue;
      list.push(r);
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    return reply.send(success(list));
  });

  // DELETE /aigc/records/:recordId — 删除 AIGC 记录
  server.delete('/aigc/records/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const record = aigcStore.get(recordId);
    if (!record) return reply.status(404).send(error(404, '记录不存在'));
    if (record.userId !== request.userId) return reply.status(403).send(error(403, '无权删除该记录'));
    aigcStore.delete(recordId);
    return reply.send(success({ recordId, deleted: true }));
  });

  // GET /aigc/records/stats — AIGC 统计
  server.get('/aigc/records/stats', async (request, reply) => {
    let total = 0;
    const byType: Record<string, number> = {};
    const byVendor: Record<string, number> = {};
    for (const r of aigcStore.values()) {
      if (r.userId !== request.userId) continue;
      total += 1;
      byType[r.type] = (byType[r.type] ?? 0) + 1;
      byVendor[r.vendor] = (byVendor[r.vendor] ?? 0) + 1;
    }
    return reply.send(success({ total, byType, byVendor }));
  });
};

// ============================================================================
// 管理端点:AI 厂商配置管理(可选,需登录)
// ============================================================================

export const adminAiVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /vendors — 厂商配置状态
  server.get('/vendors', async (_request, reply) => {
    const list = Object.entries(VENDORS).map(([key, cfg]) => ({
      vendor: key,
      name: cfg.name,
      configured: Boolean(process.env[cfg.keyEnv]),
      baseUrl: cfg.baseUrl,
    }));
    return reply.send(success(list));
  });

  // GET /vendors/:vendor — 厂商详情
  server.get('/vendors/:vendor', async (request, reply) => {
    const { vendor } = request.params as { vendor: string };
    const cfg = VENDORS[vendor];
    if (!cfg) return reply.status(404).send(error(404, '厂商不存在'));
    return reply.send(success({
      vendor,
      name: cfg.name,
      configured: Boolean(process.env[cfg.keyEnv]),
      baseUrl: cfg.baseUrl,
      keyEnv: cfg.keyEnv,
    }));
  });

  // POST /vendors/:vendor/test — 测试厂商连通性
  server.post('/vendors/:vendor/test', async (request, reply) => {
    const { vendor } = request.params as { vendor: string };
    const cfg = VENDORS[vendor];
    if (!cfg) return reply.status(404).send(error(404, '厂商不存在'));
    const key = process.env[cfg.keyEnv];
    if (!key) return reply.status(503).send(error(503, `${cfg.name} 服务未配置`));
    try {
      const resp = await fetchWithTimeout(cfg.baseUrl, {
        method: 'GET',
        headers: { ...cfg.authHeader(key) },
      }, 10_000);
      return reply.send(success({
        vendor,
        reachable: resp.status < 500,
        statusCode: resp.status,
      }));
    } catch (e) {
      return reply.send(success({ vendor, reachable: false, error: (e as Error).message }));
    }
  });

  // GET /tasks — 全部异步任务(管理视角)
  server.get('/tasks', async (request, reply) => {
    const query = request.query as { vendor?: string; status?: string };
    const list: AsyncTask[] = [];
    for (const t of taskStore.values()) {
      if (query.vendor && t.vendor !== query.vendor) continue;
      if (query.status && t.status !== query.status) continue;
      list.push(t);
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    return reply.send(success(list));
  });

  // GET /usage — 全厂商用量
  server.get('/usage', async (_request, reply) => {
    const byVendor: Record<string, number> = {};
    let total = 0;
    for (const u of usageStore.values()) {
      byVendor[u.vendor] = (byVendor[u.vendor] ?? 0) + u.calls;
      total += u.calls;
    }
    return reply.send(success({ total, byVendor }));
  });
};
