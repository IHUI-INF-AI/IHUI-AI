/**
 * Subagent 扩展路由(2026-07-24 立,补建前端调用但后端缺失的端点)。
 *
 * 路径(server.ts 用 prefix:'/api' 注册 → 最终 /api/subagents/*):
 *  - POST   /subagents/auto-plan                       智能规划(LLM 集成,失败降级空桩)
 *  - GET    /subagents/roles/custom                    列出自定义角色
 *  - POST   /subagents/roles/custom                    创建自定义角色
 *  - GET    /subagents/roles/custom/:id                获取单个自定义角色
 *  - PUT    /subagents/roles/custom/:id                更新自定义角色
 *  - DELETE /subagents/roles/custom/:id                删除自定义角色
 *  - POST   /subagents/roles/auto-generate             LLM 自动生成角色(失败降级模板桩)
 *  - GET    /subagents/agents/:role/evolution-history  Agent 演化历史
 *  - POST   /subagents/agents/:role/evolve             LLM 演化分析(失败降级空补丁)
 *  - POST   /subagents/agents/:role/apply-evolution    应用演化补丁
 *  - GET    /subagents/:id/collaboration               协作消息流(从 dispatch-service 拉取)
 *
 * 设计:
 *  - 进程内 Map 存储(零迁移,与 subagent-dispatch.ts 一致)
 *  - LLM 类端点(auto-plan/auto-generate/evolve)调用 ai-service /api/llm/complete,
 *    失败/stub/超时时降级为空数据桩,保证 200 返回不阻塞前端
 *  - 鉴权:复用 packages/auth 的 authenticate(同 subagent-dispatch.ts 模式)
 *  - 校验:Zod
 *  - 响应:{ code: 0, message: 'success', data: ... }
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { subagentDispatchService } from '../services/subagent-dispatch-service.js'

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
  // 2026-08-02 安全审计加固:用 CSPRNG 替代 Math.random()。
  // cr_ ID 作为自定义角色唯一标识,Math.random() 可预测 → 攻击者可枚举他人角色 ID。
  return `cr_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
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

// ---------- LLM 调用 helper(2026-08-04 立,实装 LLM 类空桩端点) ----------

/** ai-service /api/llm/complete 响应(简化结构,只取业务关心的字段) */
interface LlmCompleteResponse {
  content?: string
  error?: boolean
  error_message?: string
  stub?: boolean
}

/**
 * 调用 ai-service /api/llm/complete 端点(15s 超时,失败返回 null)。
 *
 * 用于 LLM 类端点(auto-plan/auto-generate/evolve)获取真实 LLM 响应;
 * 失败 / stub / 超时 / 网络异常时返回 null,调用方降级为空桩数据,
 * 保证端点始终返回 200 不阻塞前端。
 *
 * 复用 utils/ai-service-fetch.ts 的 aiServiceFetch(自动注入 traceparent 头)。
 * 不引入 axios 等新依赖,用原生 fetch + AbortController 控制超时。
 *
 * @param systemPrompt 系统提示(定义任务和返回格式)
 * @param userMessage  用户消息(具体输入数据)
 * @param timeoutMs    超时毫秒(默认 15s,ai-service 可能慢)
 * @returns LLM 响应文本(trim 后)或 null
 */
async function callAiService(
  systemPrompt: string,
  userMessage: string,
  timeoutMs = 15_000,
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const body: Record<string, unknown> = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      // temperature=0 确定性输出(编排/角色生成/演化分析均不需要创造性)
      temperature: 0,
    }
    const res = await aiServiceFetch(null, '/api/llm/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as LlmCompleteResponse
    // ai-service 返回 error=true 表示 LLM 调用失败(无 API key / provider 异常)
    if (json.error) return null
    // stub 模式表示 ai-service 无真实 LLM(降级返回的占位内容),不作为有效响应
    if (json.stub) return null
    const text = json.content ?? ''
    return text.trim() || null
  } catch {
    // AbortError(超时)/ fetch 网络异常 / JSON 解析异常 → 降级 null
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 安全解析 LLM 返回的 JSON 内容。
 *
 * LLM 经常在 JSON 前后加 ```json 围栏或解释文字,需要:
 *  1. 优先提取 ```json ... ``` 或 ``` ... ``` 围栏内容
 *  2. 回退到首个 { 到末尾 } 的子串
 *  3. JSON.parse 失败时返回 null(调用方降级为空桩)
 *
 * @returns 解析后的对象或 null
 */
function safeParseLlmJson<T>(text: string): T | null {
  // 1. 提取 ```json ... ``` 或 ``` ... ``` 围栏内容
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1]! : text
  // 2. 提取首个 { 到末尾 } 的子串(跳过 LLM 解释文字)
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T
  } catch {
    return null
  }
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
    constraints: z.object({ maxAgents: z.number().int().min(1).max(20).optional() }).optional(),
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

  // ---------- POST /subagents/auto-plan(调用 ai-service 生成编排计划) ----------

  server.post('/subagents/auto-plan', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = autoPlanSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 调用 ai-service /api/llm/complete,要求 LLM 返回 JSON 编排计划
    const systemPrompt =
      'Analyze the following task and suggest a multi-agent orchestration plan. ' +
      'Return JSON: { orchestration: "parallel"|"sequential"|"pipeline", ' +
      'agents: [{ role, goal, systemPrompt }], estimatedDuration, reasoning }'
    const userMessage = JSON.stringify({
      task: parsed.data.task,
      constraints: parsed.data.constraints,
    })

    const llmText = await callAiService(systemPrompt, userMessage)
    if (llmText) {
      const plan = safeParseLlmJson<{
        orchestration?: string
        agents?: Array<{
          role?: string
          goal?: string
          systemPrompt?: string
        }>
        estimatedDuration?: string
        reasoning?: string
      }>(llmText)
      if (plan && Array.isArray(plan.agents)) {
        // 过滤无效 agent(必须包含 role 字符串)
        const agents = plan.agents.filter(
          (a): a is { role: string; goal: string; systemPrompt: string } =>
            !!a && typeof a.role === 'string' && typeof a.systemPrompt === 'string',
        )
        return reply.send(
          success({
            orchestration: plan.orchestration ?? 'parallel',
            agents,
            estimatedDuration: plan.estimatedDuration ?? '0s',
            estimatedCost: '0',
            reasoning: plan.reasoning ?? 'LLM 生成的编排计划',
            topologyStats: [],
            generatedAt: nowIso(),
          }),
        )
      }
    }

    // fallback:LLM 不可达 / 返回无效 JSON / 解析失败 → 返回空桩(保留前端兼容格式)
    return reply.send(
      success({
        orchestration: 'parallel',
        agents: [],
        estimatedDuration: '0s',
        estimatedCost: '0',
        reasoning: 'LLM 不可达或返回无效,返回空规划。',
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
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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

  // ---------- POST /subagents/roles/auto-generate(调用 ai-service 生成角色定义) ----------

  server.post('/subagents/roles/auto-generate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = autoGenerateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { task } = parsed.data

    // 调用 ai-service /api/llm/complete,要求 LLM 返回 JSON 角色定义
    const systemPrompt =
      'Generate a specialized agent role definition for the task. ' +
      'Return JSON: { role, displayName, systemPrompt, skills: [], recommendedTasks: [] }'
    const llmText = await callAiService(systemPrompt, task)
    if (llmText) {
      const role = safeParseLlmJson<{
        role?: string
        displayName?: string
        systemPrompt?: string
        skills?: unknown
        recommendedTasks?: unknown
      }>(llmText)
      // 必须包含 role + systemPrompt 才视为有效生成
      if (role && typeof role.role === 'string' && typeof role.systemPrompt === 'string') {
        // 安全转换 skills / recommendedTasks(必须是 string[],否则降级为空数组)
        const skills = Array.isArray(role.skills)
          ? role.skills.filter((s): s is string => typeof s === 'string')
          : []
        const recommendedTasks = Array.isArray(role.recommendedTasks)
          ? role.recommendedTasks.filter((s): s is string => typeof s === 'string')
          : []
        return reply.send(
          success({
            role: role.role,
            displayName:
              typeof role.displayName === 'string' ? role.displayName : `${task.slice(0, 24)} 专家`,
            systemPrompt: role.systemPrompt,
            skills,
            recommendedTasks,
            reasoning: 'LLM 自动生成',
          }),
        )
      }
    }

    // fallback:LLM 不可达 / 返回无效 / 解析失败 → 返回模板桩(保留前端兼容格式)
    return reply.send(
      success({
        role: taskToRoleSlug(task),
        displayName: `${task.slice(0, 24)} 专家`,
        systemPrompt: `You are a specialized agent for: ${task}.`,
        skills: [],
        recommendedTasks: [],
        reasoning: 'LLM 不可达或返回无效,返回模板桩。',
      }),
    )
  })

  // ---------- GET /subagents/agents/:role/evolution-history ----------

  server.get('/subagents/agents/:role/evolution-history', async (request, reply) => {
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
  })

  // ---------- POST /subagents/agents/:role/evolve(调用 ai-service 分析演化) ----------

  server.post('/subagents/agents/:role/evolve', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { role } = request.params as { role: string }

    // 读取演化历史记录;无记录 → 无需演化,直接返回空桩(避免无谓 LLM 调用)
    const stored = evolutionHistories.get(role)
    const recentRecords = stored?.recentRecords ?? []
    if (recentRecords.length === 0) {
      return reply.send(
        success({
          agentRole: role,
          scannedRecords: 0,
          needsEvolution: false,
          patches: [],
          summary: '无演化记录,跳过分析。',
          analyzedAt: nowIso(),
        }),
      )
    }

    // 调用 ai-service /api/llm/complete,要求 LLM 分析记录并返回补丁
    const systemPrompt =
      "Analyze the agent's recent execution records and suggest prompt improvements. " +
      'Return JSON: { needsEvolution: boolean, patches: [{ originalText, suggestedReplacement, reason }], summary }'
    // 只取最近 10 条记录(避免上下文过长 + token 浪费)
    const recordsSample = recentRecords.slice(-10)
    const userMessage = JSON.stringify({
      agentRole: role,
      currentPrompt: stored?.currentPrompt ?? INITIAL_PROMPTS[role] ?? '',
      recentRecords: recordsSample,
    })

    const llmText = await callAiService(systemPrompt, userMessage)
    if (llmText) {
      const result = safeParseLlmJson<{
        needsEvolution?: boolean
        patches?: Array<{
          originalText?: unknown
          suggestedReplacement?: unknown
          reason?: unknown
        }>
        summary?: string
      }>(llmText)
      if (result) {
        // 安全过滤有效 patch(必须 originalText + suggestedReplacement 都是字符串)
        const patches: PromptPatch[] = []
        if (Array.isArray(result.patches)) {
          for (const p of result.patches) {
            if (
              p &&
              typeof p.originalText === 'string' &&
              typeof p.suggestedReplacement === 'string' &&
              typeof p.reason === 'string'
            ) {
              patches.push({
                originalText: p.originalText,
                suggestedReplacement: p.suggestedReplacement,
                reason: p.reason,
              })
            }
          }
        }
        return reply.send(
          success({
            agentRole: role,
            scannedRecords: recentRecords.length,
            // needsEvolution 显式 false 时尊重 LLM 判断;否则按 patches 是否非空推断
            needsEvolution:
              typeof result.needsEvolution === 'boolean'
                ? result.needsEvolution
                : patches.length > 0,
            patches,
            summary: result.summary ?? `LLM 分析了 ${recentRecords.length} 条记录`,
            analyzedAt: nowIso(),
          }),
        )
      }
    }

    // fallback:LLM 不可达 / 返回无效 / 解析失败 → 返回空补丁桩
    return reply.send(
      success({
        agentRole: role,
        scannedRecords: recentRecords.length,
        needsEvolution: false,
        patches: [],
        summary: 'LLM 不可达或返回无效,跳过演化分析。',
        analyzedAt: nowIso(),
      }),
    )
  })

  // ---------- POST /subagents/agents/:role/apply-evolution ----------

  server.post('/subagents/agents/:role/apply-evolution', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { role } = request.params as { role: string }
    const parsed = applyEvolutionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { patches } = parsed.data

    // 应用补丁到内存历史
    const stored = evolutionHistories.get(role)
    const currentPrompt = stored?.currentPrompt ?? INITIAL_PROMPTS[role] ?? ''
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
  })

  // ---------- GET /subagents/:id/collaboration(从 subagent-dispatch-service 拉取) ----------

  server.get('/subagents/:id/collaboration', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }

    // 从 subagent-dispatch-service 获取协作消息(with_communication 模式产生)
    const messages = subagentDispatchService.getMessages(id)
    // 派单资源统计(若派单不存在返回 null,前端可据此判断 dispatch 是否存在)
    const dispatchStats = subagentDispatchService.getDispatchStats(id) ?? null

    // 推导协作关系(from→to:type 边,聚合 count 便于前端渲染关系图)
    // 用 Map 聚合避免相同 from→to:type 边重复出现
    const relationMap = new Map<string, { from: string; to: string; type: string; count: number }>()
    for (const msg of messages) {
      const key = `${msg.from}->${msg.to}:${msg.type}`
      const existing = relationMap.get(key)
      if (existing) {
        existing.count++
      } else {
        relationMap.set(key, { from: msg.from, to: msg.to, type: msg.type, count: 1 })
      }
    }
    const relations = Array.from(relationMap.values())

    return reply.send(
      success({
        dispatchId: id,
        // 派单不存在时 status='unknown',前端据此显示"派单未找到"
        dispatchStatus: dispatchStats?.status ?? 'unknown',
        messages,
        relations,
        totalMessages: messages.length,
      }),
    )
  })
}

export default subagentsExtendedRoutes
