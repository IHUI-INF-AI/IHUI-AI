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
  // category_dictionary — 分类字典管理
  // -------------------------------------------------------------------------
  registerCrud(server, '/category-dictionary');

  // -------------------------------------------------------------------------
  // bot_sites — Bot 站点配置
  // -------------------------------------------------------------------------
  registerCrud(server, '/bot-sites');

  // -------------------------------------------------------------------------
  // ws_admin — WebSocket 管理
  // -------------------------------------------------------------------------
  // GET /ws-admin/connections — WebSocket 连接列表
  server.get('/ws-admin/connections', async (_req, reply) => {
    // TODO: 从 WS 插件获取连接列表
    return reply.send(success({ list: [], total: 0 }));
  });
  // GET /ws-admin/connections/:id — 连接详情
  server.get('/ws-admin/connections/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id }));
  });
  // DELETE /ws-admin/connections/:id — 关闭连接
  server.delete('/ws-admin/connections/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'));
    return reply.send(success({ id: parsed.data.id, closed: true }));
  });

  // -------------------------------------------------------------------------
  // compat_routes — 兼容性路由（旧 API 路径）
  // -------------------------------------------------------------------------
  // GET /compat/* — 旧 API 兼容：返回废弃提示
  server.get('/compat/*', async (_req, reply) => {
    return reply.status(410).send(success({ deprecated: true, message: '此 API 已废弃，请使用新版本' }));
  });
};

export default plugin;
