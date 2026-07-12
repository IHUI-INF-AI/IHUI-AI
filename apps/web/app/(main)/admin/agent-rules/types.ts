export interface AgentRule {
  id: string
  agentId: string
  name: string
  code: string
  type: string
  priority: number
  status: number
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
  name: string
  code: string
  type: string
  priority: string
  status: boolean
}
