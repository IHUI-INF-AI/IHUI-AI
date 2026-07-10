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
  // remote — 远程代理
  // -------------------------------------------------------------------------
  registerCrud(server, '/remote');
  // POST /remote/proxy — 代理转发请求
  server.post('/remote/proxy', async (req, reply) => {
    return reply.send(success({ proxied: true, body: req.body }));
  });

  // -------------------------------------------------------------------------
  // user_agent_context — 用户 Agent 上下文
  // -------------------------------------------------------------------------
  registerCrud(server, '/user-agent-context');

  // -------------------------------------------------------------------------
  // docs — 文档路由
  // -------------------------------------------------------------------------
  server.get('/docs/list', async (_req, reply) => {
    return reply.send(success({ list: [], total: 0 }));
  });
  server.get('/docs/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id }));
  });
};

export default plugin;
