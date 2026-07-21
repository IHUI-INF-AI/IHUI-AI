/**
 * 多智能体编排引擎。
 * 等价自 v1.0.2-sealed: server/app/services/crew_orchestrator.py
 *
 * 核心职责:
 * 1. 创建多智能体会话
 * 2. 分解任务并分配给各角色 (planner→researcher→executor→reviewer→reporter)
 * 3. 协调智能体间的协作 (共享 context)
 * 4. 汇总结果 (reporter 角色)
 *
 * 简化模式: 顺序调用 LLM 模拟多角色协作 (CrewAI 未安装时的回退方案)
 * 集成 RAG: researcher 角色注入知识库上下文
 */

import { randomUUID } from 'node:crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { crewSession, crewTask, crewMessage, crewArtifact, type CrewSession } from '@ihui/database'
import { agentRegistry, type AgentRoleConfig } from './crew-agent-registry.js'
import { getClawdbotGateway } from './clawdbot/gateway.js'
import { knowledgeRagService } from './knowledge-rag-service.js'
import { callRealLlm, type LlmMessage } from './crew-llm-adapter.js'
import { getCrewToolDefinitions, executeCrewTool } from './crew-tools.js'

export interface TaskPlan {
  role: string
  description: string
  expectedOutput: string
}

/** Crew 流式事件(与 @ihui/api-client/endpoints/crew.ts CrewStreamEvent 同源) */
export interface CrewStreamEvent {
  type:
    | 'start'
    | 'planning'
    | 'plan'
    | 'task_start'
    | 'task_complete'
    | 'task_error'
    | 'tool_call'
    | 'tool_result'
    | 'complete'
    | 'error'
  content?: string
  sessionId?: string
  role?: string
  taskIndex?: number
  tasks?: Array<{ role: string; description: string }>
  toolCall?: { id: string; name: string; args: Record<string, unknown> }
  toolResult?: {
    id: string
    name: string
    success: boolean
    output?: unknown
    error?: string
    durationMs: number
  }
  /** G7: complete/error 事件携带本次会话的 LLM 用量汇总(用于路由层扣费) */
  usage?: UsageAccumulator
  /** G7: complete/error 事件携带会话所属用户(用于路由层扣费) */
  userId?: string
}

export interface SessionConfig {
  modelId?: string
  collectionName?: string
  maxRetries?: number
}

/** G7: 会话级 LLM 用量汇总 */
export interface UsageAccumulator {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
  calls: number
}

export interface SessionResult {
  success: boolean
  sessionId?: string
  result?: string
  error?: string
  /** G7: 本次会话的 LLM 用量汇总(用于路由层扣费) */
  usage?: UsageAccumulator
  /** G7: 会话所属用户(用于路由层扣费) */
  userId?: string
}

export interface SessionDetail {
  id: string
  userId: string
  title: string
  status: string
  inputMessage: string
  outputMessage: string | null
  createdAt: string | null
  completedAt: string | null
}

/** 流式进度事件(已合并到 CrewStreamEvent,保留别名兼容) */
export type StreamEvent = CrewStreamEvent

class CrewOrchestrator {
  /** G7: 会话级 usage 累计(会话结束清理) */
  private _sessionUsage = new Map<string, UsageAccumulator>()

  /** G7: 初始化会话 usage 累计器 */
  private initUsage(sessionId: string): UsageAccumulator {
    const u: UsageAccumulator = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      model: '',
      calls: 0,
    }
    this._sessionUsage.set(sessionId, u)
    return u
  }

  /** G7: 累计 LLM 调用 usage */
  private accUsage(
    sessionId: string,
    r: { usage: { promptTokens: number; completionTokens: number; totalTokens: number }; modelUsed: string },
  ): void {
    const u = this._sessionUsage.get(sessionId)
    if (!u) return
    u.promptTokens += r.usage.promptTokens
    u.completionTokens += r.usage.completionTokens
    u.totalTokens += r.usage.totalTokens
    u.model = r.modelUsed // 记录最后使用的模型
    u.calls++
  }

  /** G7: 取出并清理会话 usage */
  private clearUsage(sessionId: string): UsageAccumulator | undefined {
    const u = this._sessionUsage.get(sessionId)
    this._sessionUsage.delete(sessionId)
    return u
  }

  /** 创建多智能体会话 */
  async createSession(opts: {
    userId: string
    inputMessage: string
    title?: string
    config?: SessionConfig
  }): Promise<string> {
    const sessionId = randomUUID()
    await db.insert(crewSession).values({
      id: sessionId,
      userId: opts.userId,
      title: opts.title || opts.inputMessage.slice(0, 50),
      status: 'pending',
      inputMessage: opts.inputMessage,
      config: (opts.config ?? {}) as Record<string, unknown>,
    })
    return sessionId
  }

  /** 同步执行会话 */
  async executeSession(sessionId: string): Promise<SessionResult> {
    const rows = await db.select().from(crewSession).where(eq(crewSession.id, sessionId)).limit(1)
    const session = rows[0]
    if (!session) return { success: false, error: '会话不存在' }
    if (session.status === 'running') return { success: false, error: '会话正在执行中' }

    await db.update(crewSession).set({ status: 'running' }).where(eq(crewSession.id, sessionId))

    const config = (session.config ?? {}) as SessionConfig
    this.initUsage(sessionId) // G7: 初始化 usage 累计
    try {
      const result = await this.runSimplified(
        sessionId,
        session.inputMessage,
        session.userId,
        config,
      )
      await this.updateSessionStatus(sessionId, 'completed', result)
      return {
        success: true,
        sessionId,
        result,
        usage: this.clearUsage(sessionId),
        userId: session.userId,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await this.updateSessionStatus(sessionId, 'failed', msg)
      return {
        success: false,
        error: msg,
        usage: this.clearUsage(sessionId),
        userId: session.userId,
      }
    }
  }

  /** 流式执行会话 (AsyncGenerator) */
  async *executeSessionStreaming(sessionId: string): AsyncGenerator<StreamEvent> {
    const rows = await db.select().from(crewSession).where(eq(crewSession.id, sessionId)).limit(1)
    const session = rows[0]
    if (!session) {
      yield { type: 'error', content: '会话不存在' }
      return
    }
    if (session.status === 'running') {
      yield { type: 'error', content: '会话正在执行中' }
      return
    }

    await db.update(crewSession).set({ status: 'running' }).where(eq(crewSession.id, sessionId))

    const config = (session.config ?? {}) as SessionConfig
    this.initUsage(sessionId) // G7: 初始化 usage 累计
    yield { type: 'start', content: '多智能体协作开始', sessionId }

    try {
      yield { type: 'planning', content: '正在分析任务并制定执行计划...' }
      const taskPlan = this.planTasks(session.inputMessage)
      yield {
        type: 'plan',
        content: `任务分解完成, 共 ${taskPlan.length} 个步骤`,
        tasks: taskPlan.map((t) => ({ role: t.role, description: t.description })),
      }

      const context: Record<string, string> = { input: session.inputMessage }
      const results: Record<string, string> = {}

      for (let i = 0; i < taskPlan.length; i++) {
        const plan = taskPlan[i]!
        const cfg = agentRegistry.getRole(plan.role)
        if (!cfg) continue

        yield {
          type: 'task_start',
          role: plan.role,
          taskIndex: i,
          content: `[${plan.role}] 开始执行: ${plan.description.slice(0, 80)}...`,
        }

        const taskId = await this.createTaskRecord(sessionId, i, plan.role, plan.description)
        await this.updateTaskStatus(taskId, 'running')

        let prompt = this.buildPrompt(plan.role, cfg, plan, context)
        if (plan.role === 'researcher') {
          const ragContext = await this.getRagContext(session.inputMessage, config)
          if (ragContext) prompt += `\n\n知识库参考信息:\n${ragContext}`
        }

        let output: string
        try {
          // executor 角色:启用工具调用循环(function calling)
          if (plan.role === 'executor') {
            output = yield* this.executeWithTools(
              prompt,
              config,
              session.userId,
              sessionId,
              i,
              taskId,
            )
          } else {
            output = await this.callLlm(prompt, config, sessionId, session.userId)
          }
          await this.updateTaskStatus(taskId, 'completed', output)
        } catch (e) {
          output = `[${plan.role} 执行失败: ${e instanceof Error ? e.message : String(e)}]`
          await this.updateTaskStatus(taskId, 'failed', undefined, output)
          yield { type: 'task_error', role: plan.role, content: output }
        }

        results[plan.role] = output
        context[plan.role] = output
        await this.logMessage(sessionId, plan.role, 'next', output)

        yield {
          type: 'task_complete',
          role: plan.role,
          taskIndex: i,
          content: output.length > 500 ? output.slice(0, 500) + '...' : output,
        }
      }

      const finalResult = results['reporter'] ?? results['executor'] ?? '无结果'
      await this.updateSessionStatus(sessionId, 'completed', finalResult)
      // 保存最终产物
      await this.saveArtifact(sessionId, 'final_report', 'text', finalResult)
      yield {
        type: 'complete',
        content: finalResult,
        sessionId,
        usage: this.clearUsage(sessionId),
        userId: session.userId,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await this.updateSessionStatus(sessionId, 'failed', msg)
      yield {
        type: 'error',
        content: `执行异常: ${msg}`,
        sessionId,
        usage: this.clearUsage(sessionId),
        userId: session.userId,
      }
    }
  }

  /** 固定 5 步任务分解 */
  private planTasks(inputMessage: string): TaskPlan[] {
    return [
      {
        role: 'planner',
        description: `分析以下需求并制定执行计划:\n${inputMessage}`,
        expectedOutput: '结构化的执行计划,包含步骤和优先级',
      },
      {
        role: 'researcher',
        description: `根据规划师的计划,检索相关知识库信息:\n${inputMessage}`,
        expectedOutput: '关键知识点和信息汇总',
      },
      {
        role: 'executor',
        description: '根据规划和研究结果,执行核心任务',
        expectedOutput: '任务执行成果',
      },
      {
        role: 'reviewer',
        description: '审查执行结果,检查质量和准确性',
        expectedOutput: '审查意见和改进建议',
      },
      {
        role: 'reporter',
        description: '汇总所有阶段结果,生成最终报告',
        expectedOutput: '完整的最终报告',
      },
    ]
  }

  /** 构建角色提示词 */
  private buildPrompt(
    role: string,
    cfg: AgentRoleConfig,
    plan: TaskPlan,
    context: Record<string, string>,
  ): string {
    let prompt = `你是${cfg.role}.\n目标: ${cfg.goal}\n背景: ${cfg.backstory}\n\n`
    prompt += `当前任务: ${plan.description}\n\n`
    if (role !== 'planner' && context['planner']) {
      prompt += `规划师输出:\n${context['planner']}\n\n`
    }
    if (['executor', 'reviewer', 'reporter'].includes(role) && context['researcher']) {
      prompt += `研究员输出:\n${context['researcher']}\n\n`
    }
    if (['reviewer', 'reporter'].includes(role) && context['executor']) {
      prompt += `执行者输出:\n${context['executor']}\n\n`
    }
    if (role === 'reporter' && context['reviewer']) {
      prompt += `审查员输出:\n${context['reviewer']}\n\n`
    }
    prompt += '请输出你的工作成果:'
    return prompt
  }

  /** 获取 RAG 上下文(不限定 owner,查询全局知识库) */
  private async getRagContext(query: string, config: SessionConfig): Promise<string> {
    try {
      return await knowledgeRagService.getRagContext({
        query,
        collectionName: config.collectionName ?? 'default',
        topK: 5,
        // 不限定 owner,检索全局知识库(含 system 种子文档)
        ownerUuid: '',
      })
    } catch {
      return ''
    }
  }

  /**
   * executor 工具调用循环(function calling)
   *
   * 流程:
   * 1. 发送 prompt + tools 定义给 LLM
   * 2. 若 LLM 返回 tool_calls,逐个执行工具,把结果作为 tool role 消息追加
   * 3. 再次调用 LLM,基于工具结果继续推理
   * 4. 重复直到 LLM 不再发起 tool_call(返回纯 content),或达到最大轮数
   *
   * @yields CrewStreamEvent (tool_call / tool_result)
   * @returns 最终 LLM 输出的文本
   */
  private async *executeWithTools(
    prompt: string,
    config: SessionConfig,
    userId: string,
    sessionId: string,
    taskIndex: number,
    taskId: string,
  ): AsyncGenerator<CrewStreamEvent, string, void> {
    const tools = getCrewToolDefinitions()
    const MAX_ROUNDS = 5
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          '你是 executor 角色。你可以调用工具完成子任务。当任务完成时,直接输出最终结果文本(不调用工具)。',
      },
      { role: 'user', content: prompt },
    ]

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const result = await callRealLlm({
        modelId: config.modelId || undefined,
        messages,
        tools,
        toolChoice: 'auto',
        temperature: 0.3,
        userId, // G7: 传 userId 记成本
        sessionId, // G7: 传 sessionId 关联会话
      })
      this.accUsage(sessionId, result) // G7: 累计 usage

      // 无工具调用 → 返回最终内容
      if (!result.toolCalls || result.toolCalls.length === 0) {
        return result.content
      }

      // 把 assistant 的 tool_calls 消息追加到历史
      messages.push({
        role: 'assistant',
        content: result.content || '',
        tool_calls: result.toolCalls,
      })

      // 逐个执行工具
      for (const call of result.toolCalls) {
        const toolName = call.function.name
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          args = { _raw: call.function.arguments }
        }

        yield {
          type: 'tool_call',
          role: 'executor',
          taskIndex,
          toolCall: { id: call.id, name: toolName, args },
        }

        const toolStart = Date.now()
        const toolResult = await executeCrewTool(toolName, args, {
          userId,
          sessionId,
          taskId,
        })
        const durationMs = Date.now() - toolStart

        // 工具结果转字符串(给 LLM 用)
        const resultStr =
          typeof toolResult.output === 'string'
            ? toolResult.output
            : JSON.stringify(toolResult.output ?? null)

        yield {
          type: 'tool_result',
          role: 'executor',
          taskIndex,
          toolResult: {
            id: call.id,
            name: toolName,
            success: toolResult.success,
            output: toolResult.output,
            error: toolResult.error,
            durationMs,
          },
        }

        // 追加 tool role 消息(OpenAI 格式)
        messages.push({
          role: 'tool',
          content: toolResult.success
            ? resultStr.slice(0, 8000)
            : `工具执行失败: ${toolResult.error ?? '未知错误'}`,
          tool_call_id: call.id,
          name: toolName,
        })
      }
    }

    // 达到最大轮数,返回最后的内容
    const finalResult = await callRealLlm({
      modelId: config.modelId || undefined,
      messages,
      temperature: 0.3,
      userId, // G7: 传 userId 记成本
      sessionId, // G7: 传 sessionId 关联会话
    })
    this.accUsage(sessionId, finalResult) // G7: 累计 usage
    return finalResult.content
  }

  /** 调用 LLM(优先真实 SDK,失败回退到 clawdbot gateway 占位) */
  private async callLlm(
    prompt: string,
    config: SessionConfig,
    sessionId?: string,
    userId?: string,
  ): Promise<string> {
    try {
      const result = await callRealLlm({
        modelId: config.modelId || undefined,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        userId, // G7: 传 userId 记成本
        sessionId, // G7: 传 sessionId 关联会话
      })
      if (sessionId) this.accUsage(sessionId, result) // G7: 累计 usage
      return result.content
    } catch (err) {
      // 真实 LLM 调用失败(无配置/key 无效/网络错误),回退到 gateway 占位
      const reason = err instanceof Error ? err.message : String(err)
      const gateway = getClawdbotGateway()
      const response = await gateway.routeCompletion({
        modelId: config.modelId ?? '',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      })
      return `${response.content}\n\n[LLM 真实调用失败,使用占位响应。原因: ${reason}]`
    }
  }

  private async runSimplified(
    sessionId: string,
    inputMessage: string,
    userId: string,
    config: SessionConfig,
  ): Promise<string> {
    const taskPlan = this.planTasks(inputMessage)
    const context: Record<string, string> = { input: inputMessage }
    const results: Record<string, string> = {}

    for (let i = 0; i < taskPlan.length; i++) {
      const plan = taskPlan[i]!
      const cfg = agentRegistry.getRole(plan.role)
      if (!cfg) continue

      const taskId = await this.createTaskRecord(sessionId, i, plan.role, plan.description)
      await this.updateTaskStatus(taskId, 'running')

      let prompt = this.buildPrompt(plan.role, cfg, plan, context)
      if (plan.role === 'researcher') {
        const ragContext = await this.getRagContext(inputMessage, config)
        if (ragContext) prompt += `\n\n知识库参考信息:\n${ragContext}`
      }

      const maxRetries = config.maxRetries ?? 2
      let output: string | null = null
      let lastError: Error | null = null

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          output = await this.callLlm(prompt, config, sessionId, userId)
          break
        } catch (e) {
          lastError = e as Error
          if (attempt < maxRetries) {
            prompt += `\n\n注意: 上次执行失败(${lastError.message}), 请重试.`
          } else {
            output = `[${plan.role} 执行失败 (重试${maxRetries}次): ${lastError.message}]`
          }
        }
      }

      if (output) {
        results[plan.role] = output
        context[plan.role] = output
        await this.updateTaskStatus(taskId, 'completed', output)
        await this.logMessage(sessionId, plan.role, 'next', output)
      }
    }

    return results['reporter'] ?? results['executor'] ?? '无结果'
  }

  // ===== 持久化辅助 =====

  private async createTaskRecord(
    sessionId: string,
    index: number,
    role: string,
    description: string,
  ): Promise<string> {
    const taskId = randomUUID()
    await db.insert(crewTask).values({
      id: taskId,
      sessionId,
      taskIndex: index,
      agentRole: role,
      description,
      status: 'pending',
    })
    return taskId
  }

  private async updateTaskStatus(
    taskId: string,
    status: string,
    output?: string,
    error?: string,
  ): Promise<void> {
    const set: Record<string, unknown> = { status }
    if (output !== undefined) set.outputData = output
    if (error !== undefined) set.errorMessage = error
    if (status === 'running') set.startedAt = new Date()
    if (status === 'completed' || status === 'failed') set.completedAt = new Date()
    await db.update(crewTask).set(set).where(eq(crewTask.id, taskId))
  }

  private async updateSessionStatus(
    sessionId: string,
    status: string,
    result?: string,
  ): Promise<void> {
    const set: Record<string, unknown> = { status }
    if (result !== undefined) set.outputMessage = result
    if (status === 'completed' || status === 'failed') set.completedAt = new Date()
    await db.update(crewSession).set(set).where(eq(crewSession.id, sessionId))
  }

  private async logMessage(
    sessionId: string,
    fromRole: string,
    toRole: string,
    content: string,
  ): Promise<void> {
    await db.insert(crewMessage).values({
      sessionId,
      fromRole,
      toRole,
      content: content.slice(0, 10000),
      messageType: 'text',
    })
  }

  async saveArtifact(
    sessionId: string,
    name: string,
    type: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await db.insert(crewArtifact).values({
      sessionId,
      name,
      type,
      content,
      metadata: metadata ?? {},
    })
  }

  // ===== 查询方法 =====

  async getSession(sessionId: string): Promise<SessionDetail | null> {
    const rows = await db.select().from(crewSession).where(eq(crewSession.id, sessionId)).limit(1)
    const s = rows[0]
    if (!s) return null
    return this.toSessionDetail(s)
  }

  async listSessions(userId = '', limit = 20): Promise<SessionDetail[]> {
    const conditions = userId ? [eq(crewSession.userId, userId)] : []
    const query = conditions.length
      ? db
          .select()
          .from(crewSession)
          .where(and(...conditions))
      : db.select().from(crewSession)
    const rows = await query.orderBy(desc(crewSession.createdAt)).limit(limit)
    return rows.map((s) => this.toSessionDetail(s))
  }

  private toSessionDetail(s: CrewSession): SessionDetail {
    return {
      id: s.id,
      userId: s.userId,
      title: s.title,
      status: s.status,
      inputMessage: s.inputMessage,
      outputMessage: s.outputMessage,
      createdAt: s.createdAt ? s.createdAt.toISOString() : null,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    }
  }

  async listTasks(sessionId: string): Promise<
    Array<{
      id: string
      taskIndex: number
      agentRole: string
      description: string
      status: string
      outputData: string | null
      errorMessage: string | null
      startedAt: string | null
      completedAt: string | null
    }>
  > {
    const rows = await db
      .select()
      .from(crewTask)
      .where(eq(crewTask.sessionId, sessionId))
      .orderBy(crewTask.taskIndex)
    return rows.map((t) => ({
      id: t.id,
      taskIndex: t.taskIndex,
      agentRole: t.agentRole,
      description: t.description,
      status: t.status,
      outputData: t.outputData,
      errorMessage: t.errorMessage,
      startedAt: t.startedAt ? t.startedAt.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    }))
  }

  async listArtifacts(sessionId: string): Promise<
    Array<{
      id: string
      name: string
      type: string
      content: string
      createdAt: string | null
    }>
  > {
    const rows = await db
      .select()
      .from(crewArtifact)
      .where(eq(crewArtifact.sessionId, sessionId))
      .orderBy(desc(crewArtifact.createdAt))
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      content: a.content,
      createdAt: a.createdAt ? a.createdAt.toISOString() : null,
    }))
  }

  async listMessages(sessionId: string): Promise<
    Array<{
      id: string
      fromRole: string
      toRole: string
      content: string
      messageType: string
      createdAt: string | null
    }>
  > {
    const rows = await db
      .select()
      .from(crewMessage)
      .where(eq(crewMessage.sessionId, sessionId))
      .orderBy(desc(crewMessage.createdAt))
    return rows.map((m) => ({
      id: m.id,
      fromRole: m.fromRole,
      toRole: m.toRole,
      content: m.content,
      messageType: m.messageType,
      createdAt: m.createdAt ? m.createdAt.toISOString() : null,
    }))
  }
}

export const crewOrchestrator = new CrewOrchestrator()
