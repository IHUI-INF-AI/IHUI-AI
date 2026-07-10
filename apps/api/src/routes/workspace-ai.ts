/**
 * Workspace AI 路由 — 重建旧架构 AI Workspace 的 15 个核心子模块端点。
 *
 * 迁移自 Python FastAPI (commit 3ee96cf0: server/app/api/v1/workspace/routes.py)。
 * 路由前缀：/api/workspace（在 server.ts 注册）。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import {
  swarmManager,
  subagentManager,
  agentLoop,
  sandboxExecutor,
  computerUse,
  codebaseIndexer,
  incrementalIndexer,
  vectorIndexer,
  checkpointManager,
  backgroundAgentManager,
  permissionManager,
  personaRegistry,
  routineManager,
  githubClient,
  fsBridge,
} from '../services/workspace-ai-service.js';

export const workspaceAiRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权：复用 workspace.ts 的模式
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  };

  // 初始化权限推送函数（复用 ws-notifications 的 pushNotification 装饰器）
  const pushFn = (typeof server.pushNotification === 'function')
    ? (userId: string, payload: unknown) => server.pushNotification(userId, payload)
    : null;
  if (pushFn) permissionManager.setPushFn(pushFn);

  // ===========================================================================
  // 1. FS Bridge — 文件系统桥接 (browse/read/write/edit/grep/glob/run)
  // ===========================================================================

  server.post('/fs/browse', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path?: string };
    try {
      const entries = fsBridge.browse(body.path);
      return reply.send(success({ entries }));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/fs/open', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path: string; name?: string };
    if (!body.path) return reply.status(400).send(error(400, 'path 不能为空'));
    try {
      const name = body.name ?? body.path.split(/[\\/]/).pop() ?? 'workspace';
      const techStack = fsBridge.detectTechStack(body.path);
      fsBridge.addRecent({ path: body.path, name, techStack });
      return reply.send(success({ path: body.path, name, techStack }));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.get('/fs/recent', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ workspaces: fsBridge.loadRecent() }));
  });

  server.post('/fs/read', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path: string; workspacePath: string; startLine?: number; endLine?: number };
    if (!body.path || !body.workspacePath) return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'));
    try {
      const result = fsBridge.read(body);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/fs/write', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path: string; workspacePath: string; content: string; createDirs?: boolean };
    if (!body.path || !body.workspacePath) return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'));
    try {
      const result = fsBridge.write(body);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/fs/edit', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path: string; workspacePath: string; oldText: string; newText: string };
    if (!body.path || !body.workspacePath) return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'));
    try {
      const result = fsBridge.edit(body);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/fs/delete', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path: string; workspacePath: string; recursive?: boolean };
    if (!body.path || !body.workspacePath) return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'));
    try {
      const result = fsBridge.delete(body);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/fs/grep', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path: string; workspacePath: string; pattern: string; glob?: string; outputMode?: string };
    if (!body.path || !body.workspacePath || !body.pattern) return reply.status(400).send(error(400, 'path/workspacePath/pattern 不能为空'));
    try {
      const result = fsBridge.grep({ ...body, outputMode: body.outputMode as 'content' | 'files_with_matches' | 'count' | undefined });
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/fs/glob', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { path: string; workspacePath: string; pattern: string };
    if (!body.path || !body.workspacePath || !body.pattern) return reply.status(400).send(error(400, 'path/workspacePath/pattern 不能为空'));
    try {
      const result = fsBridge.glob(body);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/fs/run', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { command: string; workspacePath: string; cwd?: string; timeoutMs?: number };
    if (!body.command || !body.workspacePath) return reply.status(400).send(error(400, 'command 和 workspacePath 不能为空'));
    try {
      const result = await fsBridge.run(body);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  // ===========================================================================
  // 2. Swarm — 群体智能多 Agent 编排
  // ===========================================================================

  const createSwarmSchema = z.object({
    task: z.string().min(1),
    workspacePath: z.string().min(1),
    modelId: z.string().optional(),
    agents: z.array(z.object({
      role: z.enum(['coordinator', 'worker', 'reviewer']),
      name: z.string().min(1),
      description: z.string().optional(),
      systemPrompt: z.string().optional(),
      tools: z.array(z.string()).optional(),
      model: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
    })).min(1),
  });

  server.post('/swarms', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const parsed = createSwarmSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const plan = swarmManager.create(parsed.data);
    return reply.status(201).send(success(plan));
  });

  server.get('/swarms', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ swarms: swarmManager.list() }));
  });

  server.get('/swarms/:swarmId', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { swarmId } = request.params as { swarmId: string };
    const plan = swarmManager.get(swarmId);
    if (!plan) return reply.status(404).send(error(404, 'Swarm 不存在'));
    return reply.send(success(plan));
  });

  server.post('/swarms/:swarmId/execute', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { swarmId } = request.params as { swarmId: string };
    try {
      const plan = await swarmManager.execute(swarmId);
      return reply.send(success(plan));
    } catch (e) {
      return reply.status(404).send(error(404, (e as Error).message));
    }
  });

  server.delete('/swarms/:swarmId', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { swarmId } = request.params as { swarmId: string };
    const canceled = swarmManager.cancel(swarmId);
    if (!canceled) return reply.status(404).send(error(404, 'Swarm 不存在'));
    return reply.send(success({ canceled: true }));
  });

  // ===========================================================================
  // 3. Subagents — 子代理委派
  // ===========================================================================

  server.get('/subagents', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { workspacePath?: string };
    if (query.workspacePath) subagentManager.discover(query.workspacePath);
    return reply.send(success({ subagents: subagentManager.list() }));
  });

  server.post('/subagents/delegate', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { name: string; prompt: string; workspacePath: string; model?: string };
    if (!body.name || !body.prompt) return reply.status(400).send(error(400, 'name 和 prompt 不能为空'));
    try {
      const result = await subagentManager.delegate(body);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(404).send(error(404, (e as Error).message));
    }
  });

  // ===========================================================================
  // 4. AgentLoop — Agent Runtime (工具调用循环 + 状态管理)
  // ===========================================================================

  const agentRunSchema = z.object({
    goal: z.string().min(1),
    sessionId: z.string().optional(),
    model: z.string().optional(),
    maxIterations: z.number().int().min(1).max(100).optional(),
    tools: z.array(z.string()).optional(),
    workspacePath: z.string().optional(),
  });

  server.post('/agent/run', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const parsed = agentRunSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const task = await agentLoop.run(parsed.data);
    return reply.send(success(task));
  });

  server.get('/agent/tasks', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ tasks: agentLoop.listRunning() }));
  });

  server.get('/agent/tasks/:taskId', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { taskId } = request.params as { taskId: string };
    const task = agentLoop.status(taskId);
    if (!task) return reply.status(404).send(error(404, '任务不存在'));
    return reply.send(success(task));
  });

  server.post('/agent/tasks/:taskId/cancel', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { taskId } = request.params as { taskId: string };
    const canceled = agentLoop.cancel(taskId);
    if (!canceled) return reply.status(400).send(error(400, '任务不存在或不可取消'));
    return reply.send(success({ canceled: true }));
  });

  server.get('/agent/tools', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ tools: agentLoop.listTools() }));
  });

  // ===========================================================================
  // 5. Sandbox — 沙箱执行环境
  // ===========================================================================

  server.post('/sandbox/execute', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { command: string; workspacePath: string; cwd?: string; timeoutMs?: number; mode?: string };
    if (!body.command || !body.workspacePath) return reply.status(400).send(error(400, 'command 和 workspacePath 不能为空'));
    try {
      const mode = body.mode ? sandboxExecutor.resolveMode(body.mode) : undefined;
      const result = await sandboxExecutor.execute({
        command: body.command,
        workspacePath: body.workspacePath,
        cwd: body.cwd,
        timeoutMs: body.timeoutMs,
        mode,
      });
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  // ===========================================================================
  // 6. ComputerUse — 计算机操作
  // ===========================================================================

  server.get('/computer-use/status', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ enabled: computerUse.isEnabled() }));
  });

  server.post('/computer-use/screenshot', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    try {
      const result = await computerUse.takeScreenshot();
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/computer-use/mouse/click', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { x: number; y: number; button?: string };
    if (typeof body.x !== 'number' || typeof body.y !== 'number') return reply.status(400).send(error(400, 'x 和 y 必须为数字'));
    try {
      await computerUse.mouseClick({ x: body.x, y: body.y, button: body.button as 'left' | 'right' | 'double' | undefined });
      return reply.send(success({ clicked: true }));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/computer-use/keyboard/type', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { text: string };
    if (!body.text) return reply.status(400).send(error(400, 'text 不能为空'));
    try {
      await computerUse.keyboardType({ text: body.text });
      return reply.send(success({ typed: true }));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/computer-use/keyboard/key', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { key: string };
    if (!body.key) return reply.status(400).send(error(400, 'key 不能为空'));
    try {
      await computerUse.keyboardKey({ key: body.key });
      return reply.send(success({ pressed: true }));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.get('/computer-use/screen-size', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    try {
      const size = await computerUse.getScreenSize();
      return reply.send(success(size));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  // ===========================================================================
  // 7. CodebaseIndex — 代码库索引
  // ===========================================================================

  server.post('/codebase/index', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { workspacePath: string };
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    try {
      const index = codebaseIndexer.index(body.workspacePath);
      return reply.send(success(index));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.get('/codebase/search', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { workspacePath: string; q: string; topK?: string };
    if (!query.workspacePath || !query.q) return reply.status(400).send(error(400, 'workspacePath 和 q 不能为空'));
    const results = codebaseIndexer.search(query.workspacePath, query.q, query.topK ? parseInt(query.topK, 10) : 20);
    return reply.send(success({ results }));
  });

  server.post('/codebase/incremental', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { workspacePath: string };
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    try {
      const result = incrementalIndexer.incrementalUpdate(body.workspacePath);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.get('/codebase/status', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { workspacePath: string };
    if (!query.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    return reply.send(success(incrementalIndexer.status(query.workspacePath)));
  });

  // ===========================================================================
  // 8. VectorIndex — 向量索引管理
  // ===========================================================================

  server.post('/vector/index', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { workspacePath: string };
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    try {
      const result = await vectorIndexer.indexWorkspace(body.workspacePath);
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/vector/search', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { workspacePath: string; query: string; topK?: number };
    if (!body.workspacePath || !body.query) return reply.status(400).send(error(400, 'workspacePath 和 query 不能为空'));
    try {
      const results = await vectorIndexer.search(body);
      return reply.send(success({ results }));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  // ===========================================================================
  // 9. Checkpoint — 检查点状态恢复
  // ===========================================================================

  server.get('/checkpoints', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { workspacePath: string };
    if (!query.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    return reply.send(success({ checkpoints: checkpointManager.list(query.workspacePath) }));
  });

  server.post('/checkpoints/:id/rollback', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const body = request.body as { workspacePath: string };
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    const cp = checkpointManager.rollback(body.workspacePath, id);
    if (!cp) return reply.status(404).send(error(404, '检查点不存在'));
    return reply.send(success(cp));
  });

  server.post('/checkpoints/undo', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { workspacePath: string };
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    const cp = checkpointManager.undoLast(body.workspacePath);
    if (!cp) return reply.status(404).send(error(404, '无检查点可撤销'));
    return reply.send(success(cp));
  });

  // ===========================================================================
  // 10. BackgroundAgents — 后台长时运行 Agent
  // ===========================================================================

  const startBgAgentSchema = z.object({
    prompt: z.string().min(1),
    workspacePath: z.string().min(1),
    modelId: z.string().optional(),
    userUuid: z.string().optional(),
    maxIterations: z.number().int().min(1).max(100).optional(),
    systemPrompt: z.string().optional(),
  });

  server.post('/background-agents', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const parsed = startBgAgentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const agentId = backgroundAgentManager.start({ ...parsed.data, userUuid: parsed.data.userUuid ?? request.userId });
    return reply.status(201).send(success({ agentId }));
  });

  server.get('/background-agents', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ agents: backgroundAgentManager.list() }));
  });

  server.get('/background-agents/:agentId', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { agentId } = request.params as { agentId: string };
    const agent = backgroundAgentManager.get(agentId);
    if (!agent) return reply.status(404).send(error(404, '后台 Agent 不存在'));
    return reply.send(success(agent));
  });

  server.post('/background-agents/:agentId/cancel', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { agentId } = request.params as { agentId: string };
    const canceled = backgroundAgentManager.cancel(agentId);
    if (!canceled) return reply.status(400).send(error(400, 'Agent 不存在或不可取消'));
    return reply.send(success({ canceled: true }));
  });

  // ===========================================================================
  // 11. Permissions — Agent 权限确认
  // ===========================================================================

  const permissionCheckSchema = z.object({
    workspacePath: z.string().min(1),
    mode: z.enum(['default', 'acceptEdits', 'plan', 'bypassPermissions']),
    tool: z.string().min(1),
    args: z.record(z.unknown()).default({}),
  });

  server.post('/permissions/check', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const parsed = permissionCheckSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const result = await permissionManager.check({
      userId: request.userId,
      ...parsed.data,
    });
    return reply.send(success(result));
  });

  server.post('/permissions/:requestId/resolve', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { requestId } = request.params as { requestId: string };
    const body = request.body as { approved: boolean };
    const resolved = permissionManager.resolve(requestId, body.approved);
    if (!resolved) return reply.status(400).send(error(400, '请求不存在或已处理'));
    return reply.send(success({ resolved: true }));
  });

  server.get('/permissions/requests', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ requests: permissionManager.listPending(request.userId) }));
  });

  server.get('/permissions/rules', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { workspacePath: string };
    if (!query.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    return reply.send(success({ rules: permissionManager.loadRules(query.workspacePath) }));
  });

  // ===========================================================================
  // 12. PersonaRegistry — 人格注册
  // ===========================================================================

  server.get('/personas', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { category?: string };
    return reply.send(success({ personas: personaRegistry.list(query.category) }));
  });

  server.get('/personas/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const persona = personaRegistry.get(id);
    if (!persona) return reply.status(404).send(error(404, 'Persona 不存在'));
    return reply.send(success(persona));
  });

  const createPersonaSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1),
    systemPrompt: z.string().min(1),
    tools: z.array(z.string()).optional(),
    examples: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  });

  server.post('/personas', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const parsed = createPersonaSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    try {
      const persona = personaRegistry.create(parsed.data);
      return reply.status(201).send(success(persona));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.patch('/personas/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const updated = personaRegistry.update(id, body);
    if (!updated) return reply.status(404).send(error(404, 'Persona 不存在'));
    return reply.send(success(updated));
  });

  server.delete('/personas/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const deleted = personaRegistry.delete(id);
    if (!deleted) return reply.status(400).send(error(400, 'Persona 不存在或为内置'));
    return reply.send(success({ deleted: true }));
  });

  // ===========================================================================
  // 13. Routines — 例行程序
  // ===========================================================================

  const createRoutineSchema = z.object({
    name: z.string().min(1),
    prompt: z.string().min(1),
    cronExpression: z.string().min(1),
    workspacePath: z.string().min(1),
    modelId: z.string().optional(),
  });

  server.get('/routines', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    return reply.send(success({ routines: routineManager.list() }));
  });

  server.post('/routines', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const parsed = createRoutineSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    const routine = routineManager.create(parsed.data);
    return reply.status(201).send(success(routine));
  });

  server.get('/routines/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const routine = routineManager.get(id);
    if (!routine) return reply.status(404).send(error(404, '例行程序不存在'));
    return reply.send(success(routine));
  });

  server.patch('/routines/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const updated = routineManager.update(id, body);
    if (!updated) return reply.status(404).send(error(404, '例行程序不存在'));
    return reply.send(success(updated));
  });

  server.delete('/routines/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const deleted = routineManager.delete(id);
    if (!deleted) return reply.status(404).send(error(404, '例行程序不存在'));
    return reply.send(success({ deleted: true }));
  });

  server.post('/routines/:id/trigger', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { id } = request.params as { id: string };
    const agentId = routineManager.trigger(id);
    if (!agentId) return reply.status(400).send(error(400, '例行程序不存在或未启用'));
    return reply.send(success({ agentId }));
  });

  // ===========================================================================
  // 14. GitHubIntegration — GitHub 集成
  // ===========================================================================

  server.post('/github/detect', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const body = request.body as { workspacePath: string };
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'));
    const repo = await githubClient.detectRemote(body.workspacePath);
    return reply.send(success({ repo }));
  });

  const createPRSchema = z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    title: z.string().min(1),
    head: z.string().min(1),
    base: z.string().min(1),
    body: z.string().optional(),
  });

  server.post('/github/prs', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const parsed = createPRSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    try {
      const pr = await githubClient.createPR(parsed.data);
      return reply.status(201).send(success(pr));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.get('/github/prs', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { owner: string; repo: string; state?: string };
    if (!query.owner || !query.repo) return reply.status(400).send(error(400, 'owner 和 repo 不能为空'));
    try {
      const prs = await githubClient.listPRs(query);
      return reply.send(success(prs));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.get('/github/prs/:number', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { number } = request.params as { number: string };
    const query = request.query as { owner: string; repo: string };
    if (!query.owner || !query.repo) return reply.status(400).send(error(400, 'owner 和 repo 不能为空'));
    try {
      const pr = await githubClient.getPR({ owner: query.owner, repo: query.repo, number: parseInt(number, 10) });
      return reply.send(success(pr));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/github/prs/:number/comments', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { number } = request.params as { number: string };
    const body = request.body as { owner: string; repo: string; body: string };
    if (!body.owner || !body.repo || !body.body) return reply.status(400).send(error(400, 'owner/repo/body 不能为空'));
    try {
      const result = await githubClient.addPRComment({ owner: body.owner, repo: body.repo, number: parseInt(number, 10), body: body.body });
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.post('/github/prs/:number/reviewers', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { number } = request.params as { number: string };
    const body = request.body as { owner: string; repo: string; reviewers: string[] };
    if (!body.owner || !body.repo || !body.reviewers) return reply.status(400).send(error(400, 'owner/repo/reviewers 不能为空'));
    try {
      const result = await githubClient.requestReview({ owner: body.owner, repo: body.repo, number: parseInt(number, 10), reviewers: body.reviewers });
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.put('/github/prs/:number/merge', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const { number } = request.params as { number: string };
    const body = request.body as { owner: string; repo: string; commitTitle?: string; mergeMethod?: string };
    if (!body.owner || !body.repo) return reply.status(400).send(error(400, 'owner 和 repo 不能为空'));
    try {
      const result = await githubClient.mergePR({
        owner: body.owner, repo: body.repo, number: parseInt(number, 10),
        commitTitle: body.commitTitle, mergeMethod: body.mergeMethod as 'merge' | 'squash' | 'rebase' | undefined,
      });
      return reply.send(success(result));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });

  server.get('/github/issues', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const query = request.query as { owner: string; repo: string; state?: string };
    if (!query.owner || !query.repo) return reply.status(400).send(error(400, 'owner 和 repo 不能为空'));
    try {
      const issues = await githubClient.listIssues(query);
      return reply.send(success(issues));
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message));
    }
  });
};
