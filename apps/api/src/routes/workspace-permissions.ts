// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Workspace Permissions 路由 — 工作区访问权限配置 API。
 *
 * 三种模式:
 *   - default            全部人工审计(每次操作需确认)
 *   - accept-edits       白名单放行(预置安全模板 + 用户自定义)
 *   - bypass-permissions 完全访问(无任何确认)
 *
 * 13 个端点(P3 3-3 权限继承,2026-09-17 立:用户全局默认 → 工作区显式 → 会话,
 *   存储复用 user_preferences 表 group='agent' key='defaultPermissionMode',零迁移):
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
 *   GET    /permission/requests                 列出待决人工审计请求
 *   POST   /permission/requests/:requestId/resolve  决策(允许/拒绝)解锁审计 Promise
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
// 权限档唯一真源(G-161/G-164):本文件曾有 3 份档位清单,读侧还会把不认识的档位静默归 null
import {
  PERMISSION_MODES,
  PERMISSION_MODE_WIRE,
  PERMISSION_MODE_WIRE_VALUES,
  normalizePermissionMode,
  permissionModeWire,
  type PermissionModeId,
  type PermissionModeWire,
} from '@ihui/types/permission-mode'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { permissionManager } from '../services/workspace-ai-service.js'
import type { WorkspacePermission } from '@ihui/database'
import { findUserPreferences, upsertUserPreference } from '../db/user-preferences-queries.js'
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
// 权限档取值面(存值迁移第①步 · 写侧:落库翻正到规范档,出参仍是 wire)
// =============================================================================

/**
 * 入参可接受的拼写 = wire(kebab)∪ 规范档(camel)。
 *
 * 两份清单都从 `@ihui/types/permission-mode` 派生,本文件不再出现第二份字面量,
 * 注册表新增档位时这里自动跟上。`manual` 属于规范档但**没有** wire 映射,
 * 因此它在 `resolvePersistableMode` 处仍被拒(见该函数),不会因为"接受 camel"而漏放行。
 */
const PERMISSION_MODE_INPUT_VALUES = [
  ...new Set<string>([...PERMISSION_MODE_WIRE_VALUES, ...PERMISSION_MODES]),
]

const modeInputSchema = z.enum(PERMISSION_MODE_INPUT_VALUES, {
  error: (iss) =>
    `非法权限档: ${String(iss.input)}(取值 ${PERMISSION_MODE_INPUT_VALUES.join(' / ')})`,
})

/** 一次归一同时给出落库值与出参值,避免两个分支各自归一后跑偏。 */
interface ResolvedPermissionMode {
  /** 规范档(camel)—— 写库用 */
  id: PermissionModeId
  /** wire(kebab)—— 出参用,与迁移前的 REST 契约逐字一致 */
  wire: PermissionModeWire
}

/**
 * 任意合法拼写 → { id 规范档, wire 出参 };认不出 / 无落库语义 → null(由调用方拒掉)。
 *
 * 为什么**存值**翻正成 camel 而**出参**保持 kebab:kebab 是 workspace REST 与 8 端运行时
 * 比较的历史契约,改它要跨端联动;而 `workspace_permissions.mode` 的写入口只有本路由一处,
 * 先把存值统一到规范档,判定侧就不再"两头各比各的拼写"(G-164 登记的静默失效成因)。
 * 读侧一律经 `permissionModeWire` 归一 → 遗留 kebab 行与新 camel 行都能读出同一个 wire,
 * 这正是第②步幂等回填的安全网。
 */
const resolvePersistableMode = (raw: unknown): ResolvedPermissionMode | null => {
  const id = normalizePermissionMode(raw)
  if (!id) return null
  // manual 在审批门里有语义(每次都问),但这两个档位字段从未承载它:
  // 存进去会让每一处读取都把它当成"未配置",故 PERMISSION_MODE_WIRE 无它 → 拒。
  const wire = PERMISSION_MODE_WIRE[id]
  return wire ? { id, wire } : null
}

/**
 * 库行 → 对外 DTO:mode 归一成 wire(kebab)。
 *
 * 必须显式归一:GET /permissions、GET /permission、PUT /permissions 都是**直接把库行**
 * 吐给客户端的(packages/api-client 的 `WorkspacePermission.mode` 声明为 kebab 4 值)。
 * 存值翻正成 camel 后不过这层的调用方会拿到 camel 而静默比不中。
 * 归一不出时原样吐库值 —— 与迁移前行为逐字一致,不给历史脏行新增失败模式。
 */
const toWirePermission = (row: WorkspacePermission): WorkspacePermission => ({
  ...row,
  mode: permissionModeWire(row.mode) ?? row.mode,
})

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
  { ruleType: 'path', pattern: '**/桌面/**', operation: 'read', decision: 'allow' },
  { ruleType: 'path', pattern: '**/桌面/**', operation: 'write', decision: 'allow' },
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
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  /**
   * 用户全局默认档位的**读**判定(G-164:消掉本文件第 4 份档位清单)。
   *
   * 上一版这里写着 `const PERMISSION_MODES = ['default','accept-edits','bypass-permissions']`,
   * 后果有两处:① `PUT /permission-default` 拒收 plan;② **GET 读取时把不在清单里的值
   * 静默归 null** —— 也就是"存进去的档位被读成没配",继承链凭空掉一级。
   * 现统一走注册表:任意合法拼写(kebab / camel / 历史别名)读出为 wire,认不出才给 null。
   *
   * 存值迁移期间这里**必须**继续走归一而不是直读库值:同一条 preference 既可能是回填前的
   * kebab,也可能是回写后的 camel,两条都要读出同一个 wire。
   */
  const readWireMode = (raw: unknown): string | null => permissionModeWire(raw)

  // GET /permission-default — 用户全局默认权限模式(继承链第一级;工作区未显式配置时回退)
  server.get('/permission-default', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { list } = await findUserPreferences(request.userId, 'agent')
      const row = list.find((r) => r.key === 'defaultPermissionMode')
      const mode = readWireMode(row?.value)
      return reply.send(success({ mode }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // PUT /permission-default — 设置用户全局默认权限模式
  server.put('/permission-default', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = z.object({ mode: modeInputSchema }).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 无落库语义的档位(manual)显式拒绝,而不是"存进去然后每一处读取都当成没配"
    const resolved = resolvePersistableMode(parsed.data.mode)
    if (!resolved) {
      return reply
        .status(400)
        .send(
          error(
            400,
            `非法权限档: ${parsed.data.mode}(可落库档位为 ${Object.values(PERMISSION_MODE_WIRE).join(' / ')};manual 无落库语义)`,
          ),
        )
    }
    try {
      await upsertUserPreference(request.userId, 'agent', 'defaultPermissionMode', resolved.id)
      // 出参仍是 wire:客户端 `setWorkspacePermissionDefault` 的返回类型是 kebab 4 值
      return reply.send(success({ mode: resolved.wire }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

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
    return reply.send(success({ permissions: permissions.map(toWirePermission) }))
  })

  // GET /permission?workspacePath=xxx — 获取指定工作区权限
  server.get('/permission', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { workspacePath } = z.object({ workspacePath: z.string() }).parse(request.query)
    const permission = await getPermission(request.userId, workspacePath)
    return reply.send(success({ permission: permission ? toWirePermission(permission) : null }))
  })

  // PUT /permissions — upsert 权限
  const putSchema = z.object({
    workspacePath: z.string().min(1),
    name: z.string().min(1),
    techStack: z.string().optional(),
    // G-164:此前是 z.enum(3 档 kebab) —— 于是 `plan` 档"类型里有、链路上不可达"
    // (客户端发 plan 直接被 400 挡回)。现交唯一真源派生:kebab / camel 两种拼写都收,
    // 认不出仍拒;落库走规范档 camel(存值迁移第①步),出参继续吐 wire。
    mode: modeInputSchema,
    initializeDefaults: z.boolean().optional(),
  })
  server.put('/permissions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = putSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const resolved = resolvePersistableMode(parsed.data.mode)
      if (!resolved) {
        return reply
          .status(400)
          .send(
            error(
              400,
              `非法权限档: ${parsed.data.mode}(可落库档位为 ${Object.values(PERMISSION_MODE_WIRE).join(' / ')};manual 无落库语义)`,
            ),
          )
      }
      const permission = await upsertPermission({
        userId: request.userId,
        workspacePath: parsed.data.workspacePath,
        name: parsed.data.name,
        techStack: parsed.data.techStack,
        mode: resolved.id,
      })
      // 首次设置 acceptEdits 模式 → 创建预置安全模板(判定走规范档,不比拼写)
      if (parsed.data.initializeDefaults && resolved.id === 'acceptEdits') {
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
        // 审计流水是给人看的对外文案,与出参同口径吐 wire,不把 camel 泄进 reason
        reason: `mode set to ${resolved.wire}`,
      })
      return reply.send(success({ permission: toWirePermission(permission) }))
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
      // P1 修复(2026-08-06): 分页 limit 补上限
      .object({
        workspacePath: z.string(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(request.query)
    const logs = await listAuditLogs(request.userId, workspacePath, limit ?? 50)
    return reply.send(success({ logs }))
  })

  // GET /permission/requests — 列出当前用户的待决人工审计请求(前端可调用刷新)
  server.get('/permission/requests', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ requests: permissionManager.listWorkspacePending(request.userId) }))
  })

  // POST /permission/requests/:requestId/resolve — 用户决策(允许/拒绝)解锁审计 Promise
  const resolveSchema = z.object({
    approved: z.boolean(),
    reason: z.string().max(200).optional(),
  })
  server.post('/permission/requests/:requestId/resolve', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { requestId } = z.object({ requestId: z.string() }).parse(request.params)
    const parsed = resolveSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const ok = permissionManager.resolveWorkspace(
      requestId,
      request.userId,
      parsed.data.approved,
      parsed.data.reason,
    )
    if (!ok) return reply.status(404).send(error(404, '请求不存在、已超时或不属于当前用户'))
    return reply.send(success({ resolved: true }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
