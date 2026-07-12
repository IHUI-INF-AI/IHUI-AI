export interface TaskDeveloper {
  id: string
  taskId: string
  accept: string
  acceptAt: string | null
  amount: number
  discount: number
  realAmount: number
  nodes: string
  status: number
  publisher: string
  creator: string
  updator: string | null
  createdAt: string
  updatedAt: string
}

export interface PageData {
  list: TaskDeveloper[]
  total: number
}

export type TaskDeveloperForm = Record<string, string>
