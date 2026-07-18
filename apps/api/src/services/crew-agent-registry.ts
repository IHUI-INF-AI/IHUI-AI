/**
 * 多智能体角色注册表。
 * 迁移自 v1.0.2-sealed: server/app/services/crew_agent_registry.py
 *
 * 5 个核心角色:
 * - planner   规划师: 任务分解与流程设计
 * - researcher 研究员: 信息检索与知识收集 (使用 RAG)
 * - executor  执行者: 具体任务执行
 * - reviewer  审查员: 质量检查与反馈
 * - reporter  报告员: 结果汇总与报告生成
 */

export interface AgentRoleConfig {
  role: string
  goal: string
  backstory: string
  llmModelId: string
  tools: string[]
  allowDelegation: boolean
  verbose: boolean
}

const DEFAULT_ROLES: Record<string, AgentRoleConfig> = {
  planner: {
    role: 'planner',
    goal: '分析用户需求,将复杂任务分解为可执行的子任务序列,制定最优执行计划',
    backstory:
      '你是一位经验丰富的项目规划师,擅长将复杂问题拆解为清晰的步骤。你总是考虑任务间的依赖关系和执行优先级,确保计划的高效性和可操作性。',
    llmModelId: '',
    tools: [],
    allowDelegation: true,
    verbose: true,
  },
  researcher: {
    role: 'researcher',
    goal: '利用知识库和外部资源收集与任务相关的信息,为团队提供准确的知识支撑',
    backstory:
      '你是一位严谨的研究员,拥有强大的信息检索和分析能力。你善于从海量信息中提取关键知识点,为后续执行提供可靠的依据。',
    llmModelId: '',
    tools: ['rag_search'],
    allowDelegation: false,
    verbose: true,
  },
  executor: {
    role: 'executor',
    goal: '根据规划和研究结果,高效执行具体任务,产出高质量的工作成果',
    backstory:
      '你是一位全能的执行专家,具备广泛的技能和丰富的实战经验。你能够调用各种工具和API来完成任务,确保输出结果的准确性和完整性。',
    llmModelId: '',
    tools: ['coze_workflow', 'llm_generate'],
    allowDelegation: false,
    verbose: true,
  },
  reviewer: {
    role: 'reviewer',
    goal: '审查执行结果的质量和准确性,提供改进建议,确保最终交付物满足要求',
    backstory:
      '你是一位严格的质量审查专家,对细节有着极高的敏感度。你不仅检查结果的正确性,还关注逻辑性、完整性和用户体验。',
    llmModelId: '',
    tools: [],
    allowDelegation: false,
    verbose: true,
  },
  reporter: {
    role: 'reporter',
    goal: '汇总所有阶段的结果,生成结构清晰、内容完整的最终报告',
    backstory:
      '你是一位专业的技术写作专家,擅长将复杂的技术内容转化为清晰易懂的报告。你注重逻辑结构和表达效果,确保读者能快速获取关键信息。',
    llmModelId: '',
    tools: [],
    allowDelegation: false,
    verbose: true,
  },
}

export class AgentRegistry {
  private roles: Record<string, AgentRoleConfig> = { ...DEFAULT_ROLES }

  getRole(name: string): AgentRoleConfig | undefined {
    return this.roles[name]
  }

  listRoles(): AgentRoleConfig[] {
    return Object.values(this.roles)
  }

  registerRole(config: AgentRoleConfig): void {
    this.roles[config.role] = config
  }

  updateRoleLlm(roleName: string, llmModelId: string): boolean {
    const cfg = this.roles[roleName]
    if (!cfg) return false
    cfg.llmModelId = llmModelId
    return true
  }

  /** 默认执行顺序 */
  getExecutionOrder(): string[] {
    return ['planner', 'researcher', 'executor', 'reviewer', 'reporter']
  }
}

export const agentRegistry = new AgentRegistry()
