'use client'

/** 工作流步骤类型(引擎支持的 type 字段) */
export type StepType =
  'trigger' | 'echo' | 'skill' | 'llm' | 'condition' | 'delay' | 'loop' | 'parallel' | 'tool'

/** 工作流单步定义 */
export interface WorkflowStep {
  name: string
  type: StepType
  input?: string
  skill?: string
  condition?: string
  thenSteps?: WorkflowStep[]
  elseSteps?: WorkflowStep[]
  duration?: number
  count?: number
  steps?: WorkflowStep[]
  config?: Record<string, unknown>
  continueOnFail?: boolean
}

/** React Flow 节点数据类型 */
export interface StepNodeData {
  label: string
  stepType: StepType
  step: WorkflowStep
  /** 节点在画布上的颜色主题 */
  color: 'blue' | 'amber' | 'emerald' | 'violet' | 'red' | 'slate'
  [key: string]: unknown
}

/** 设备图标映射 */
export const STEP_ICONS: Record<StepType, string> = {
  trigger: 'Zap',
  echo: 'Terminal',
  skill: 'Bot',
  llm: 'Brain',
  condition: 'GitFork',
  delay: 'Clock',
  loop: 'Repeat',
  parallel: 'Layers',
  tool: 'Wrench',
}

export const STEP_LABELS: Record<StepType, string> = {
  trigger: '触发器',
  echo: '测试回显',
  skill: 'AI 技能',
  llm: 'LLM 调用',
  condition: '条件分支',
  delay: '延迟',
  loop: '循环',
  parallel: '并行执行',
  tool: 'MCP 工具',
}

export const STEP_COLORS: Record<StepType, StepNodeData['color']> = {
  trigger: 'blue',
  echo: 'slate',
  skill: 'violet',
  llm: 'emerald',
  condition: 'amber',
  delay: 'slate',
  loop: 'blue',
  parallel: 'violet',
  tool: 'amber',
}
