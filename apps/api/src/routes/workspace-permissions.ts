/**
 * Workspace Permissions 路由 — 工作区访问权限配置 API。
 *
 * 三种模式:
 *   - default            全部人工审计(每次操作需确认)
 *   - accept-edits       白名单放行(预置安全模板 + 用户自定义)
 *   - bypass-permissions 完全访问(无任何确认)
 *
 * 11 个端点:
 *   GET    /templates                           获取预置安全模板
 *   GET    /permissions                          列出当前用户所有工作区权限
 *   GET    /permission                           获取指定工作区权限(query: workspacePath)
 *   PUT    /permissions                          upsert 权限(可选 initializeDefaults 创建预置规则)
 *   DELETE /permission                           删除权限(query: workspacePath,级联清理规则+审计日志)
 *   GET    /permissions/rules                    列出白名单规则
 *   POST   /permissions/rules                    添加白名单规则
 *   PATCH  /permissions/rules/:id                更新规则
 *   DELETE /permissions/rules/:id                删除规则
 *   POST   /permissions/rules/reset              重置为预置安全模板
 *   GET    /permissions/audit-log                获取审计日志
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  getPermission,
  listPermissionsByUser,
  upsertPermission,
  deletePermission,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  createRulesBulk,
  clearUserRules,
  appendAuditLog,
  listAuditLogs,
} from '../db/workspace-permission-queries.js'

// =============================================================================
// 预置安全模板 (24 条规则)
// =============================================================================

interface RuleTemplate {
  ruleType: 'path' | 'command' | 'tool'
  pattern: string
  operation?: string
  decision: 'allow' | 'deny'
}

const SAFE_TEMPLATES: RuleTemplate[] = [
  // 路径放行:开发常读写的源码目录
  { ruleType: 'path', pattern: 'src/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'src/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'src/**', operation: 'edit', decision: 'allow' },
  { ruleType: 'path', pattern: 'apps/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'apps/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'packages/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'packages/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'docs/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'tests/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'tests/**', operation: 'write', decision: 'allow' },
  { ruleType: 'path', pattern: 'scripts/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: 'scripts/**', operation: 'write', decision: 'allow' },
  // 路径放行:配置文件
  { ruleType: 'path', pattern: '*.json', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '*.md', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '*.ts', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '*.tsx', operation: 'read', decision: 'allow' },
  // 路径拒绝:敏感文件
  { ruleType: 'path', pattern: '.env*', operation: 'read', decision: 'deny' },
  { ruleType: 'path', pattern: '.env*', operation: 'write', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.key', operation: 'read', decision: 'deny' },
  { ruleType: 'path', pattern: '**/*.pem', operation: 'read', decision: 'deny' },
  { ruleType: 'path', pattern: '**/credentials*', operation: 'read', decision: 'deny' },
  // 命令放行:常用开发命令
  { ruleType: 'command', pattern: 'pnpm', operation: 'run', decision: 'allow' },
  { ruleType: 'command', pattern: 'git status', operation: 'run', decision: 'allow' },
  { ruleType: 'command', pattern: 'git diff', operation: 'run', decision: 'allow' },
  // 命令拒绝:高危命令
  { ruleType: 'command', pattern: 'rm -rf', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'git push --force', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'git reset --hard', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'DROP TABLE', operation: 'run', decision: 'deny' },
  { ruleType: 'command', pattern: 'DELETE FROM', operation: 'run', decision: 'deny' },
]

// =============================================================================
// 路由
// =============================================================================

export const workspacePermissionRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // GET /templates — 获取预置安全模板
  server.get('/templates', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ templates: SAFE_TEMPLATES }))
  })

  // GET /permissions — 列出当前用户所有工作区权限
  server.get('/permissions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const permissions = await listPermissionsByUser(request.userId)
    return reply.send(success({ permissions }))
  })

  // GET /permission?workspacePath=xxx — 获取指定工作区权限
  server.get('/permission', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { workspacePath } = z.object({ workspacePath: z.string() }).parse(request.query)
    const permission = await getPermission(request.userId, workspacePath)
    return reply.send(success({ permission: permission ?? null }))
  })

  // PUT /permissions — upsert 权限
  const putSchema = z.object({
    workspacePath: z.string().min(1),
    name: z.string().min(1),
    techStack: z.string().optional(),
    mode: z.enum(['default', 'accept-edits', 'bypass-permissions']),
    initializeDefaults: z.boolean().optional(),
  })
  server.put('/permissions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = putSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const permission = await upsertPermission({
        userId: request.userId,
        workspacePath: parsed.data.workspacePath,
        name: parsed.data.name,
        techStack: parsed.data.techStack,
        mode: parsed.data.mode,
      })
      // 首次设置 accept-edits 模式 → 创建预置安全模板
      if (parsed.data.initializeDefaults && parsed.data.mode === 'accept-edits') {
        await clearUserRules(request.userId, parsed.data.workspacePath)
        await createRulesBulk(
          request.userId,
          parsed.data.workspacePath,
          SAFE_TEMPLATES.map((t) => ({ ...t, builtin: true })),
        )
      }
      await appendAuditLog({
        userId: request.userId,
        workspacePath: parsed.data.workspacePath,
        toolName: 'permission-setup',
        decision: 'allow',
        reason: `mode set to ${parsed.data.mode}`,
      })
      return reply.send(success({ permission }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // DELETE /permission?workspacePath=xxx — 删除权限(级联)
  server.delete('/permission', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { workspacePath } = z.object({ workspacePath: z.string() }).parse(request.query)
    await deletePermission(request.userId, workspacePath)
    return reply.send(success({ deleted: true }))
  })

  // GET /permissions/rules — 列出白名单规则
  server.get('/permissions/rules', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { workspacePath } = z.object({ workspacePath: z.string() }).parse(request.query)
    const rules = await listRules(request.userId, workspacePath)
    return reply.send(success({ rules }))
  })

  // POST /permissions/rules — 添加规则
  const addRuleSchema = z.object({
    workspacePath: z.string().min(1),
    ruleType: z.enum(['path', 'command', 'tool']),
    pattern: z.string().min(1),
    operation: z.string().optional(),
    decision: z.enum(['allow', 'deny']),
  })
  server.post('/permissions/rules', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = addRuleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const rule = await createRule({
        userId: request.userId,
        workspacePath: parsed.data.workspacePath,
        ruleType: parsed.data.ruleType,
        pattern: parsed.data.pattern,
        operation: parsed.data.operation,
        decision: parsed.data.decision,
      })
      await appendAuditLog({
        userId: request.userId,
        workspacePath: parsed.data.workspacePath,
        toolName: 'rule-add',
        decision: 'allow',
        reason: `${parsed.data.decision} ${parsed.data.ruleType}: ${parsed.data.pattern}`,
      })
      return reply.status(201).send(success({ rule }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // PATCH /permissions/rules/:id — 更新规则
  const patchRuleSchema = z.object({
    pattern: z.string().optional(),
    operation: z.string().optional(),
    decision: z.enum(['allow', 'deny']).optional(),
  })
  server.patch('/permissions/rules/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const parsed = patchRuleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const rule = await updateRule(id, request.userId, parsed.data)
    if (!rule) return reply.status(404).send(error(404, '规则不存在'))
    return reply.send(success({ rule }))
  })

  // DELETE /permissions/rules/:id — 删除规则
  server.delete('/permissions/rules/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = z.object({ id: z.string() }).parse(request.params)
    await deleteRule(id, request.userId)
    return reply.send(success({ deleted: true }))
  })

  // POST /permissions/rules/reset — 重置为预置安全模板
  const resetSchema = z.object({ workspacePath: z.string().min(1) })
  server.post('/permissions/rules/reset', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = resetSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    await clearUserRules(request.userId, parsed.data.workspacePath)
    await createRulesBulk(
      request.userId,
      parsed.data.workspacePath,
      SAFE_TEMPLATES.map((t) => ({ ...t, builtin: true })),
    )
    const rules = await listRules(request.userId, parsed.data.workspacePath)
    return reply.send(success({ rules }))
  })

  // GET /permissions/audit-log — 获取审计日志
  server.get('/permissions/audit-log', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { workspacePath, limit } = z
      .object({ workspacePath: z.string(), limit: z.coerce.number().optional() })
      .parse(request.query)
    const logs = await listAuditLogs(request.userId, workspacePath, limit ?? 50)
    return reply.send(success({ logs }))
  })
}
