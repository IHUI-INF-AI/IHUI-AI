export interface AgentTask {
  id: string
  title: string | null
  context: string | null
  createdName: string | null
  closingTime: string | null
  cycle: string | null
  cycleUnit: string | null
  lowestPrice: string | null
  peakPrice: string | null
  status: number
  remark: string | null
  createdAt: string | null
}

export interface ListData {
  list: AgentTask[]
  total: number
}

export interface AgentTaskForm {
  title: string
  context: string
  lowestPrice: string
  peakPrice: string
  cycle: string
  cycleUnit: string
  closingTime: string
}
