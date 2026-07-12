export interface AgentRule {
  id: string
  agentId: string
  ruleName: string
  ruleCode: string
  ruleType: string
  priority: number
  status: number
  description: string | null
}

export interface ListData {
  list: AgentRule[]
  total: number
}

export interface AgentRuleForm {
  agentId: string
  ruleName: string
  ruleCode: string
  ruleType: string
  priority: string
  status: boolean
  description: string
}
