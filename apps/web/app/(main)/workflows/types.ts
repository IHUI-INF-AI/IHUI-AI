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

export interface WorkflowForm {
  name: string
  description: string
  triggerType: TriggerType
  steps: string
}
