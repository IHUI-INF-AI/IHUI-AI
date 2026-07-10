import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { success, error } from '../utils/response.js';

const idParamSchema = z.object({ id: z.string().min(1) });

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // agent_need_task — Agent 需求任务市场
  // -------------------------------------------------------------------------
  server.get('/need-task/list', async (_req, reply) => {
    return reply.send(success({ list: [], total: 0 }));
  });
  server.get('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id }));
  });
  server.post('/need-task', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }));
  });
  server.put('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, updated: true }));
  });
  server.delete('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });

  // -------------------------------------------------------------------------
  // agent_upload — Agent 资源上传管理
  // -------------------------------------------------------------------------
  server.get('/upload/list', async (_req, reply) => {
    return reply.send(success({ list: [], total: 0 }));
  });
  server.get('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id }));
  });
  server.post('/upload', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }));
  });
  server.put('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, updated: true }));
  });
  server.delete('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });

  // -------------------------------------------------------------------------
  // agent_usedetail — 代理商使用明细
  // -------------------------------------------------------------------------
  server.get('/usedetail/list', async (_req, reply) => {
    return reply.send(success({ list: [], total: 0 }));
  });
  server.get('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id }));
  });
  server.post('/usedetail', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }));
  });
  server.put('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, updated: true }));
  });
  server.delete('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });
};

export default plugin;
