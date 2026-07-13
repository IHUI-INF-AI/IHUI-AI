export interface AgentRule {
  id: string
  agentId: string
  ruleName: string
  ruleCode: string
  ruleType: string
  priority: number
  status: number
  description?: string
}

export interface RuleParam {
  id: string
  ruleId: string
  name: string
  code: string
  type: string
  value: string
  status: number
}

export interface ListData<T> {
  list: T[]
  total: number
}

export interface RuleForm {
  agentId: string
  ruleName: string
  ruleCode: string
  ruleType: string
  priority: string
  status: boolean
  description: string
}
