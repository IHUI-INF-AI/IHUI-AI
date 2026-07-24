import type { PageData as _PageData } from '@ihui/api-client'

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

export type PageData = _PageData<TaskDeveloper>

export type TaskDeveloperForm = Record<string, string>
