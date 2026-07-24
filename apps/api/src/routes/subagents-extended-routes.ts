/**
 * Subagent 扩展路由(2026-07-24 立,补建前端调用但后端缺失的端点)。
 *
 * 路径(server.ts 用 prefix:'/api' 注册 → 最终 /api/subagents/*):
 *  - POST   /subagents/auto-plan                       智能规划(LLM 桩,返回空 agents)
 *  - GET    /subagents/roles/custom                    列出自定义角色
 *  - POST   /subagents/roles/custom                    创建自定义角色
 *  - GET    /subagents/roles/custom/:id                获取单个自定义角色
 *  - PUT    /subagents/roles/custom/:id                更新自定义角色
 *  - DELETE /subagents/roles/custom/:id                删除自定义角色
 *  - POST   /subagents/roles/auto-generate             LLM 自动生成角色(桩)
 *  - GET    /subagents/agents/:role/evolution-history  Agent 演化历史
 *  - POST   /subagents/agents/:role/evolve             LLM 演化分析(桩)
 *  - POST   /subagents/agents/:role/apply-evolution    应用演化补丁
 *  - GET    /subagents/:id/collaboration               协作消息流(空桩)
 *
 * 设计:
 *  - 进程内 Map 存储(零迁移,与 subagent-dispatch.ts 一致)
 *  - LLM 类端点(auto-plan/auto-generate/evolve)返回空数据桩,不阻塞前端
 *  - 鉴权:复用 packages/auth 的 authenticate(同 subagent-dispatch.ts 模式)
 *  - 校验:Zod
 *  - 响应:{ code: 0, message: 'success', data: ... }
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

// ---------- 进程内存储(零迁移) ----------

interface CustomRole {
  id: string
  role: string
  displayName: string
  systemPrompt: string
  skills: string[]
  recommendedTasks: string[]
  createdAt: string
  updatedAt: string
}

interface PromptPatch {
  originalText: string
  suggestedReplacement: string
  reason: string
}

interface EvolutionVersion {
  version: string
  prompt: string
  changes: PromptPatch[]
  createdAt: string
}

interface AgentEvolutionRecord {
  dispatchId: string
  agentRole: string
  taskDescription: string
  result: string
  retryCount: number
  userFeedback: string | undefined
  success: boolean
  durationMs: number
  tokenUsage: number
  recordedAt: string
}

interface EvolutionHistory {
  agentRole: string
  currentPrompt: string
  versions: EvolutionVersion[]
  recentRecords: AgentEvolutionRecord[]
}

const customRoles = new Map<string, CustomRole>()
const evolutionHistories = new Map<string, EvolutionHistory>()

/** 内置角色初始 prompt(对应 5 个 SubagentRole) */
const INITIAL_PROMPTS: Record<string, string> = {
  researcher: 'You are a research agent. Gather information and summarize findings.',
  coder: 'You are a coding agent. Write clean, minimal code following existing patterns.',
  reviewer: 'You are a code review agent. Identify issues and suggest improvements.',
  architect: 'You are an architecture agent. Design systems with clear boundaries.',
  debugger: 'You are a debugging agent. Diagnose root causes and propose fixes.',
}

function nowIso(): string {
  return new Date().toISOString()
}

function genId(): string {
  return `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 从任务描述生成 kebab-case 角色 slug(用于 auto-generate 桩) */
function taskToRoleSlug(task: string): string {
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 32)
  return slug || 'custom-agent'
}

export const subagentsExtendedRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权 helper(复用 subagent-dispatch.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // ---------- Zod schemas ----------

  const autoPlanSchema = z.object({
    task: z.string().min(1, '任务描述不能为空'),
    constraints: z
      .object({ maxAgents: z.number().int().min(1).max(20).optional() })
      .optional(),
  })

  const customRoleSchema = z.object({
    role: z.string().min(1).max(64),
    displayName: z.string().min(1).max(128),
    systemPrompt: z.string().min(1).max(8000),
    skills: z.array(z.string()).max(50).default([]),
    recommendedTasks: z.array(z.string()).max(50).default([]),
  })

  const autoGenerateSchema = z.object({
    task: z.string().min(1, '任务描述不能为空'),
  })

  const applyEvolutionSchema = z.object({
    patches: z
      .array(
        z.object({
          originalText: z.string(),
          suggestedReplacement: z.string(),
          reason: z.string(),
        }),
      )
      .min(1, '至少一个补丁'),
  })

  // ---------- POST /subagents/auto-plan(LLM 桩,返回空 agents) ----------

  server.post('/subagents/auto-plan', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = autoPlanSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // LLM 未集成,返回空 agents 桩,不阻塞前端
    return reply.send(
      success({
        orchestration: 'parallel',
        agents: [],
        estimatedDuration: '0s',
        estimatedCost: '0',
        reasoning: '智能规划功能待 LLM 集成,当前返回空规划。',
        topologyStats: [],
        generatedAt: nowIso(),
      }),
    )
  })

  // ---------- GET /subagents/roles/custom ----------

  server.get('/subagents/roles/custom', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const roles = Array.from(customRoles.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
    return reply.send(success({ roles }))
  })

  // ---------- POST /subagents/roles/custom ----------

  server.post('/subagents/roles/custom', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = customRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    // role 唯一性校验
    for (const r of customRoles.values()) {
      if (r.role === input.role) {
        return reply.status(409).send(error(409, `角色技术名 ${input.role} 已存在`))
      }
    }

    const now = nowIso()
    const role: CustomRole = {
      id: genId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    }
    customRoles.set(role.id, role)
    return reply.send(success({ role }))
  })

  // ---------- GET /subagents/roles/custom/:id ----------

  server.get('/subagents/roles/custom/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    const role = customRoles.get(id)
    if (!role) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    return reply.send(success({ role }))
  })

  // ---------- PUT /subagents/roles/custom/:id ----------

  server.put('/subagents/roles/custom/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    const existing = customRoles.get(id)
    if (!existing) {
      return reply.status(404).send(error(404, '角色不存在'))
    }

    const parsed = customRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    // role 唯一性校验(排除自身)
    for (const r of customRoles.values()) {
      if (r.id !== id && r.role === input.role) {
        return reply.status(409).send(error(409, `角色技术名 ${input.role} 已存在`))
      }
    }

    const updated: CustomRole = {
      ...existing,
      ...input,
      updatedAt: nowIso(),
    }
    customRoles.set(id, updated)
    return reply.send(success({ role: updated }))
  })

  // ---------- DELETE /subagents/roles/custom/:id ----------

  server.delete('/subagents/roles/custom/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    const deleted = customRoles.delete(id)
    if (!deleted) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    return reply.send(success({ deleted: true }))
  })

  // ---------- POST /subagents/roles/auto-generate(LLM 桩) ----------

  server.post('/subagents/roles/auto-generate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = autoGenerateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { task } = parsed.data

    // LLM 未集成,返回基于 task 的简单模板桩
    return reply.send(
      success({
        role: taskToRoleSlug(task),
        displayName: `${task.slice(0, 24)} 专家`,
        systemPrompt: `You are a specialized agent for: ${task}.`,
        skills: [],
        recommendedTasks: [],
        reasoning: '自动生成功能待 LLM 集成,当前返回模板桩。',
      }),
    )
  })

  // ---------- GET /subagents/agents/:role/evolution-history ----------

  server.get(
    '/subagents/agents/:role/evolution-history',
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      const { role } = request.params as { role: string }
      const stored = evolutionHistories.get(role)
      if (stored) {
        return reply.send(success(stored))
      }
      // 返回初始空历史
      return reply.send(
        success({
          agentRole: role,
          currentPrompt: INITIAL_PROMPTS[role] ?? '',
          versions: [],
          recentRecords: [],
        }),
      )
    },
  )

  // ---------- POST /subagents/agents/:role/evolve(LLM 桩) ----------

  server.post('/subagents/agents/:role/evolve', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { role } = request.params as { role: string }
    // LLM 未集成,返回 needsEvolution: false 桩,不阻塞前端
    return reply.send(
      success({
        agentRole: role,
        scannedRecords: 0,
        needsEvolution: false,
        patches: [],
        summary: '演化分析功能待 LLM 集成,当前无补丁。',
        analyzedAt: nowIso(),
      }),
    )
  })

  // ---------- POST /subagents/agents/:role/apply-evolution ----------

  server.post(
    '/subagents/agents/:role/apply-evolution',
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      const { role } = request.params as { role: string }
      const parsed = applyEvolutionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { patches } = parsed.data

      // 应用补丁到内存历史
      const stored = evolutionHistories.get(role)
      const currentPrompt =
        stored?.currentPrompt ?? INITIAL_PROMPTS[role] ?? ''
      let newPrompt = currentPrompt
      for (const p of patches) {
        if (p.originalText.length > 0) {
          newPrompt = newPrompt.replace(p.originalText, p.suggestedReplacement)
        }
      }

      const version: EvolutionVersion = {
        version: `v${(stored?.versions.length ?? 0) + 1}`,
        prompt: newPrompt,
        changes: patches,
        createdAt: nowIso(),
      }

      const history: EvolutionHistory = {
        agentRole: role,
        currentPrompt: newPrompt,
        versions: [...(stored?.versions ?? []), version],
        recentRecords: [],
      }
      evolutionHistories.set(role, history)
      return reply.send(success({ version }))
    },
  )

  // ---------- GET /subagents/:id/collaboration(空桩) ----------

  server.get('/subagents/:id/collaboration', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    // 协作消息流由 subagent-dispatch-service 维护,这里返回空桩避免 404
    return reply.send(
      success({
        dispatchId: id,
        messages: [],
        relations: [],
      }),
    )
  })
}

export default subagentsExtendedRoutes
