/**
 * 多智能体角色注册表。
 * 迁移自 v1.0.2-sealed: server/app/services/crew_agent_registry.py
 *
 * 5 个核心角色 (prompt 模板外部化至 crew-roles.json + crew-role-loader.ts):
 * - planner   规划师: 任务分解与流程设计
 * - researcher 研究员: 信息检索与知识收集 (使用 RAG)
 * - executor  执行者: 具体任务执行
 * - reviewer  审查员: 质量检查与反馈
 * - reporter  报告员: 结果汇总与报告生成
 *
 * 自定义 prompt 优先级:
 *   1. CREW_ROLES_JSON env (JSON 字符串, 运营可改)
 *   2. 内置 crew-roles.json (静态资源)
 *   3. fallback (加载失败时兜底, 行为与历史硬编码一致)
 */

import { loadCrewRoles } from './crew-role-loader.js'

export interface AgentRoleConfig {
  role: string
  goal: string
  backstory: string
  llmModelId: string
  tools: string[]
  allowDelegation: boolean
  verbose: boolean
}

export class AgentRegistry {
  private roles: Record<string, AgentRoleConfig>

  constructor() {
    this.roles = loadCrewRoles()
  }

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
