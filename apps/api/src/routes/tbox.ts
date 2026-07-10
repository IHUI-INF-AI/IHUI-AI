import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tboxDevice, tboxCommand } from '@ihui/database';
import { success, error } from '../utils/response.js';

const registerSchema = z.object({
  deviceNo: z.string().min(1).max(100),
  deviceName: z.string().max(200).optional(),
  deviceType: z.string().max(50).optional(),
  userId: z.string().uuid().optional(),
});

const commandSchema = z.object({
  command: z.enum(['reboot', 'lock', 'unlock', 'upgrade']),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const eventSchema = z.object({
  deviceNo: z.string(),
  eventType: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
});

const tboxRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 设备列表
  server.get('/devices', async (_req, reply) => {
    const list = await db.select().from(tboxDevice).orderBy(desc(tboxDevice.registeredAt)).limit(100);
    return reply.send(success(list));
  });

  // 设备详情
  server.get('/devices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const device = await db.select().from(tboxDevice).where(eq(tboxDevice.id, id)).limit(1);
    if (!device[0]) return reply.status(404).send(error(404, '设备不存在'));
    return reply.send(success(device[0]));
  });

  // 设备注册
  server.post('/devices', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const [device] = await db.insert(tboxDevice).values(body).returning();
    return reply.status(201).send(success(device));
  });

  // 指令下发
  server.post('/devices/:id/command', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = commandSchema.parse(req.body);
    const device = await db.select().from(tboxDevice).where(eq(tboxDevice.id, id)).limit(1);
    if (!device[0]) return reply.status(404).send(error(404, '设备不存在'));
    const [cmd] = await db.insert(tboxCommand).values({
      deviceId: id,
      command: body.command,
      payload: body.payload,
      status: 'sent',
      sentAt: new Date(),
    }).returning();
    return reply.status(201).send(success(cmd));
  });

  // 指令历史
  server.get('/devices/:id/commands', async (req, reply) => {
    const { id } = req.params as { id: string };
    const list = await db.select().from(tboxCommand).where(eq(tboxCommand.deviceId, id)).orderBy(desc(tboxCommand.createdAt)).limit(50);
    return reply.send(success(list));
  });

  // 事件通知接收（X-Signature 签名验证）
  server.post('/events', async (req, reply) => {
    const signature = req.headers['x-signature'] as string | undefined;
    if (!signature) return reply.status(401).send(error(401, '缺少签名'));
    // TODO: 验证签名（需要共享密钥）
    const body = eventSchema.parse(req.body);
    // 根据设备号查找设备
    const device = await db.select().from(tboxDevice).where(eq(tboxDevice.deviceNo, body.deviceNo)).limit(1);
    if (!device[0]) return reply.status(404).send(error(404, '设备未注册'));
    // 更新设备状态
    await db.update(tboxDevice).set({
      status: body.eventType === 'online' ? 'online' : 'offline',
      lastOnlineAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tboxDevice.id, device[0].id));
    return reply.send(success({ received: true }));
  });
};

export default tboxRoutes;
