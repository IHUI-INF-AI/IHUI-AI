import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { checkAuth } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import {
  findCozeVariableList,
  findCozeVariableByName,
  createCozeVariable,
  updateCozeVariable,
  deleteCozeVariable,
} from '../db/misc-queries.js';

// =============================================================================
// Zod schemas
// =============================================================================

const retrieveQuerySchema = z.object({
  variableName: z.string().min(1).max(100),
  botId: z.string().max(100).optional(),
});

const listQuerySchema = z.object({
  botId: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createBodySchema = z.object({
  botId: z.string().min(1).max(100),
  variableName: z.string().min(1).max(100),
  variableValue: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  dataType: z.string().max(20).optional(),
});

const updateBodySchema = z.object({
  id: z.string().uuid('无效的 ID'),
  variableName: z.string().min(1).max(100).optional(),
  variableValue: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  dataType: z.string().max(20).optional(),
});

const deleteBodySchema = z.object({
  id: z.string().uuid('无效的 ID'),
});

// =============================================================================
// Coze 变量服务路由（挂载于 /api/coze/variables）
// =============================================================================

export const cozeVariablesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return;
  });

  // GET /retrieve - 查询单个变量
  server.get('/retrieve', async (request, reply) => {
    const parsed = retrieveQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const variable = await findCozeVariableByName(parsed.data.variableName, parsed.data.botId);
    if (!variable) return reply.status(404).send(error(404, '变量不存在'));
    return reply.send(success(variable));
  });

  // GET /list - 变量列表
  server.get('/list', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { botId, search, page, pageSize } = parsed.data;
    const result = await findCozeVariableList({ botId, search, page, pageSize });
    return reply.send(success(result));
  });

  // POST /update - 更新变量
  server.post('/update', async (request, reply) => {
    const parsed = updateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { id, variableName, variableValue, description, dataType } = parsed.data;
    const variable = await updateCozeVariable(id, {
      ...(variableName !== undefined ? { variableName } : {}),
      ...(variableValue !== undefined ? { variableValue } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(dataType !== undefined ? { dataType } : {}),
    });
    if (!variable) return reply.status(404).send(error(404, '变量不存在'));
    return reply.send(success(variable));
  });

  // POST /create - 创建变量
  server.post('/create', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const variable = await createCozeVariable(parsed.data);
    return reply.status(201).send(success(variable));
  });

  // POST /delete - 删除变量
  server.post('/delete', async (request, reply) => {
    const parsed = deleteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await deleteCozeVariable(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });
};
