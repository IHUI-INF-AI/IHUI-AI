/**
 * Subagent 派单服务(2026-07-22 立)。
 *
 * 职责:
 *  1. 维护进程内 active dispatches Map(简化实现,不持久化;后续可换 Redis)
 *  2. 调 apps/ai-service 的 agent_orchestrator HTTP 接口(pipeline/parallel/run-decomposed)
 *  3. 未暴露的编排模式(debate/vote/critique/with_communication)→ 501 降级
 *  4. 维护派单 → 拓扑映射(单 dispatch = 1 主 agent 节点 + 边按编排模式生成)
 *
 * 设计:
 *  - 跨服务调用超时 30s,失败降级为 dispatch.status='failed' + result 填错误信息
 *  - ai-service 无对应路由(404)→ 抛 ServiceUnavailableError,路由层返回 501
 *  - 拓扑从本地 Map 推导(无需 ai-service 提供 topology 接口)
 */

import type {
  SubagentDispatch,
  DispatchInput,
  SwarmTopology,
  TopologyNode,
  TopologyEdge,
  OrchestrationMode,
  SubagentRole,
} from '@ihui/types/subagent-dispatch'

/** ai-service 基础 URL(优先 env,回退 AGENTS.md §6 文档值 8000) */
const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL && process.env.AI_SERVICE_URL.length > 0
    ? process.env.AI_SERVICE_URL.replace(/\/$/, '')
    : 'http://localhost:8000'

/** 跨服务调用超时(ms) */
const AI_SERVICE_TIMEOUT_MS = 30_000

/** 5 默认 agent 中文标签(用于拓扑节点 label) */
const ROLE_LABELS: Record<SubagentRole, string> = {
  researcher: '研究助手',
  coder: '代码助手',
  reviewer: '审查助手',
  architect: '架构师',
  debugger: '调试助手',
}

/** ai-service 返回的 OrchestrationResult 形状(子集,只取需要的字段) */
interface AiOrchestrationResult {
  orchestration_id?: string
  final_output?: string
  status?: string
  steps?: Array<{ agent_name?: string; status?: string; output?: string }>
}

interface AiServiceResponse {
  code?: number
  message?: string
  data?: AiOrchestrationResult | null
}

/** 派单创建结果:成功 dispatch / 失败 reason / 501 notImplemented */
export interface DispatchCallResult {
  dispatch: SubagentDispatch
  /** 'ok' = ai-service 调用成功;'failed' = 调用失败,dispatch 标记 failed;'not_implemented' = ai-service 无该编排路由 */
  outcome: 'ok' | 'failed' | 'not_implemented'
}

function newId(): string {
  return `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 把 DispatchInput + status + result 合并为 SubagentDispatch。
 */
function buildDispatch(
  input: DispatchInput,
  status: SubagentDispatch['status'],
  result?: string,
): SubagentDispatch {
  return {
    id: newId(),
    goal: input.goal,
    affectedFiles: input.affectedFiles,
    forbidden:
      input.forbidden && input.forbidden.length > 0
        ? input.forbidden
        : ['任何不在上述清单的文件'],
    verifyCommands: input.verifyCommands,
    constraints: input.constraints,
    deliverables: input.deliverables,
    agentRole: input.agentRole ?? 'coder',
    orchestration: input.orchestration ?? 'parallel',
    status,
    result,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

/** 拼装派单 prompt(把 AGENTS.md §11 强制格式作为 user_input 传给 agent) */
function buildAgentPrompt(input: DispatchInput): string {
  const forbidden: string[] =
    input.forbidden && input.forbidden.length > 0
      ? input.forbidden
      : ['任何不在上述清单的文件']
  return [
    '## 任务目标',
    input.goal,
    '',
    '## 受影响文件(绝对路径,只允许以下文件)',
    ...input.affectedFiles.map((f: string) => `- ${f}`),
    '',
    '## 禁止修改',
    ...forbidden.map((f: string) => `- ${f}`),
    '',
    '## 验证命令(子任务完成后必须自行运行)',
    ...input.verifyCommands.map((c: string) => `- ${c}`),
    '',
    '## 约束边界',
    input.constraints,
    '',
    '## 交付物',
    input.deliverables,
  ].join('\n')
}

/**
 * 调 ai-service agent_orchestrator 对应编排接口。
 *
 * 路由映射:
 *  - pipeline → POST /api/v1/ai/agent/pipeline
 *  - parallel → POST /api/v1/ai/agent/parallel
 *  - decomposed → POST /api/v1/ai/agent/run-decomposed
 *  - debate / vote / critique / with_communication → 无对应路由,返回 not_implemented
 */
async function callAiService(
  mode: OrchestrationMode,
  agentRole: SubagentRole,
  prompt: string,
): Promise<
  | { ok: true; finalOutput: string }
  | { ok: false; reason: 'not_implemented'; message: string }
  | { ok: false; reason: 'failed'; message: string }
> {
  // 映射编排模式到 ai-service 路由
  let path = ''
  let body: Record<string, unknown> = {}
  if (mode === 'pipeline') {
    path = '/api/v1/ai/agent/pipeline'
    body = {
      steps: [{ agent: agentRole, input_template: '{input}' }],
      initial_input: prompt,
    }
  } else if (mode === 'parallel') {
    path = '/api/v1/ai/agent/parallel'
    body = { items: [{ agent: agentRole, input: prompt }] }
  } else if (mode === 'decomposed') {
    path = '/api/v1/ai/agent/run-decomposed'
    body = { task: prompt, strategy: 'dag' }
  } else {
    return {
      ok: false,
      reason: 'not_implemented',
      message: `编排模式 "${mode}" 暂未在 ai-service 暴露 HTTP 端点(debate/vote/critique/with_communication 仅 Python 内调用),后端 orchestrator 集成待办`,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS)
  try {
    const res = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status === 404) {
      return {
        ok: false,
        reason: 'not_implemented',
        message: `ai-service 无 ${path} 路由,后端 orchestrator 集成待办`,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: 'failed',
        message: `ai-service 返回 ${res.status} ${res.statusText}`,
      }
    }
    const json = (await res.json()) as AiServiceResponse
    if (typeof json.code !== 'number' || json.code !== 0) {
      return {
        ok: false,
        reason: 'failed',
        message: json.message || 'ai-service 业务失败',
      }
    }
    const data = json.data ?? {}
    const finalOutput =
      typeof data.final_output === 'string' && data.final_output.length > 0
        ? data.final_output
        : (data.steps ?? [])
            .map((s) => `[${s.agent_name ?? 'agent'}]: ${s.output ?? ''}`)
            .join('\n')
    return { ok: true, finalOutput }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      reason: 'failed',
      message: `ai-service 调用失败: ${msg}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 单例服务:维护 active dispatches Map + 拓扑推导。
 *
 * 简化实现说明:
 *  - Map 进程内,重启丢失(后续可迁移到 Redis)
 *  - 拓扑按 dispatch 数 + 编排模式即时推导,不持久化
 */
class SubagentDispatchService {
  private dispatches = new Map<string, SubagentDispatch>()

  /** 创建并派发:同步入 Map,异步调 ai-service 更新状态 */
  async dispatch(input: DispatchInput): Promise<DispatchCallResult> {
    const role: SubagentRole = input.agentRole ?? 'coder'
    const mode: OrchestrationMode = input.orchestration ?? 'parallel'
    const prompt = buildAgentPrompt(input)

    // 先入 Map(pending),保证 GET /active 立即能看到
    const pending = buildDispatch(input, 'pending')
    this.dispatches.set(pending.id, pending)

    // 异步调 ai-service(不 await,立即返回 pending;后续 GET 查状态)
    void this.runDispatch(pending.id, mode, role, prompt)

    return { dispatch: pending, outcome: 'ok' }
  }

  /** 实际执行 ai-service 调用,更新 dispatch 状态 */
  private async runDispatch(
    id: string,
    mode: OrchestrationMode,
    role: SubagentRole,
    prompt: string,
  ): Promise<void> {
    const dispatch = this.dispatches.get(id)
    if (!dispatch) return
    // 标记 running
    dispatch.status = 'running'
    dispatch.updatedAt = nowIso()
    this.dispatches.set(id, dispatch)

    const result = await callAiService(mode, role, prompt)
    const cur = this.dispatches.get(id)
    if (!cur) return
    if (result.ok) {
      cur.status = 'completed'
      cur.result = result.finalOutput
    } else if (result.reason === 'not_implemented') {
      cur.status = 'failed'
      cur.result = result.message
    } else {
      cur.status = 'failed'
      cur.result = result.message
    }
    cur.updatedAt = nowIso()
    this.dispatches.set(id, cur)
  }

  /** 取消派单:仅 pending/running 可取消 */
  cancel(id: string): boolean {
    const d = this.dispatches.get(id)
    if (!d) return false
    if (d.status !== 'pending' && d.status !== 'running') return false
    d.status = 'cancelled'
    d.updatedAt = nowIso()
    this.dispatches.set(id, d)
    return true
  }

  /** 列出活跃派单(pending / running) */
  listActive(): SubagentDispatch[] {
    return Array.from(this.dispatches.values())
      .filter((d) => d.status === 'pending' || d.status === 'running')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** 列出全部派单(供拓扑推导) */
  listAll(): SubagentDispatch[] {
    return Array.from(this.dispatches.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
  }

  /** 推导拓扑:每个 dispatch 产生 1 个主 agent 节点;多 dispatch 间按顺序生成串行边 */
  getTopology(): SwarmTopology {
    const all = this.listAll()
    const nodes: TopologyNode[] = []
    const edges: TopologyEdge[] = []

    for (const d of all) {
      const role = d.agentRole ?? 'coder'
      const nodeStatus: TopologyNode['status'] =
        d.status === 'pending'
          ? 'waiting'
          : d.status === 'running'
            ? 'running'
            : d.status === 'completed'
              ? 'completed'
              : d.status === 'failed'
                ? 'failed'
                : 'idle'
      nodes.push({
        id: d.id,
        label: ROLE_LABELS[role] ?? role,
        role,
        status: nodeStatus,
      })
    }

    // 多 dispatch 时按创建顺序串行连接(表达"先后派发"关系)
    // 单 dispatch 不生成自环(避免 SVG 渲染怪异),仅展示节点 + 状态色
    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1]!
      const cur = all[i]!
      const prevMode = prev.orchestration ?? 'parallel'
      edges.push({
        from: prev.id,
        to: cur.id,
        label: '派单顺序',
        type: prevMode === 'parallel' ? 'parallel' : 'pipeline',
      })
    }

    return { nodes, edges }
  }
}

/** 进程内单例 */
export const subagentDispatchService = new SubagentDispatchService()
