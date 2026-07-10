import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { success, error } from '../utils/response.js';

const idParamSchema = z.object({ id: z.string().min(1) });

// 通用 CRUD 工厂：为每个模块注册 list/detail/create/update/delete
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
  // advertise — 广告管理
  registerCrud(server, '/advertise');
  // video — 视频管理
  registerCrud(server, '/video');
  // video_preload — 视频预加载
  registerCrud(server, '/video-preload');
  // user_video_comment — 视频评论追踪
  registerCrud(server, '/user-video-comment');
  // user_video_log — 视频日志追踪
  registerCrud(server, '/user-video-log');
  // user_agent_image — 用户 Agent 图片
  registerCrud(server, '/user-agent-image');
};

export default plugin;
