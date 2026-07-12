export interface UserAgentContext {
  id: string
  agentId: string | null
  agentName: string | null
  userUuid: string | null
  userName: string | null
  problem: string | null
  answer: string | null
  userUrl: string | null
  agentUrl: string | null
  sendTime: string | null
}

export interface ListData {
  list: UserAgentContext[]
  total: number
}

export interface UserAgentContextForm {
  agentId: string
  userUuid: string
  problem: string
  answer: string
  userUrl: string
  agentUrl: string
  sendTime: string
}
