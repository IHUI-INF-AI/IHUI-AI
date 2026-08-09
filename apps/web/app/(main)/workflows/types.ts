export type TriggerType = 'manual' | 'schedule' | 'event' | 'webhook'
export type WfStatus = 'active' | 'inactive'

export interface WorkflowItem {
  id: string
  name: string
  description?: string
  triggerType: TriggerType
  steps?: unknown[]
  isActive: boolean
  createdAt: string
}

/** 工作流步骤类型(从 editor/types 重导出,供 create dialog 使用) */
export type { WorkflowStep } from './editor/types'

export interface WorkflowForm {
  name: string
  description: string
  triggerType: TriggerType
  steps: string
}
