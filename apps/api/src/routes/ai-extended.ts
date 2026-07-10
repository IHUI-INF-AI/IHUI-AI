import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { success, error } from '../utils/response.js';

const idParamSchema = z.object({ id: z.string().min(1) });

function registerCrud(server: FastifyInstance, prefix: string) {
  server.get(`${prefix}/list`, async (_req, reply) => {
    return reply.send(success({ list: [], total: 0 }));
  });
  server.get(`${prefix}/:id`, async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id }));
  });
  server.post(`${prefix}`, async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }));
  });
  server.put(`${prefix}/:id`, async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, updated: true }));
  });
  server.delete(`${prefix}/:id`, async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // ai/capabilities — 统一 AI 能力列表
  // -------------------------------------------------------------------------
  server.get('/capabilities', async (_req, reply) => {
    const capabilities = [
      { id: 'chat', name: 'AI 对话', models: ['gpt-4o', 'claude-3.5-sonnet', 'deepseek-chat'] },
      { id: 'image-gen', name: 'AI 绘画', models: ['dall-e-3', 'sd-xl', 'flux'] },
      { id: 'video-gen', name: 'AI 视频', models: ['sora', 'runway-gen3'] },
      { id: 'music-gen', name: 'AI 音乐', models: ['suno', 'udio'] },
      { id: 'code', name: 'AI 代码', models: ['cursor', 'copilot'] },
      { id: 'voice', name: 'AI 语音', models: ['whisper', 'tts-1'] },
    ];
    return reply.send(success(capabilities));
  });

  // -------------------------------------------------------------------------
  // ai/model_info — 统一模型信息
  // -------------------------------------------------------------------------
  server.get('/model-info', async (_req, reply) => {
    const models = [
      { id: 'gpt-4o', vendor: 'openai', contextWindow: 128000, inputPrice: 2.5, outputPrice: 10 },
      { id: 'claude-3.5-sonnet', vendor: 'anthropic', contextWindow: 200000, inputPrice: 3, outputPrice: 15 },
      { id: 'deepseek-chat', vendor: 'deepseek', contextWindow: 64000, inputPrice: 0.14, outputPrice: 0.28 },
    ];
    return reply.send(success(models));
  });

  // -------------------------------------------------------------------------
  // ai/outbound_routes — AI 外呼路由
  // -------------------------------------------------------------------------
  registerCrud(server, '/outbound-routes');

  // -------------------------------------------------------------------------
  // ai/video_routes — AI 视频路由 + 任务
  // -------------------------------------------------------------------------
  registerCrud(server, '/video-routes');
  // POST /video-routes/tasks/create — 创建视频生成任务
  server.post('/video-routes/tasks/create', async (req, reply) => {
    return reply.status(201).send(success({ taskId: crypto.randomUUID(), status: 'pending', body: req.body }));
  });
  // GET /video-routes/tasks/:id — 查询任务状态
  server.get('/video-routes/tasks/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的任务 ID'));
    return reply.send(success({ taskId: parsed.data.id, status: 'pending' }));
  });

  // -------------------------------------------------------------------------
  // developer/model_test — 开发者模型测试
  // -------------------------------------------------------------------------
  registerCrud(server, '/developer/model-test');
  // POST /developer/model-test/run — 执行模型测试
  server.post('/developer/model-test/run', async (req, reply) => {
    return reply.send(success({ result: 'ok', body: req.body }));
  });
};

export default plugin;
