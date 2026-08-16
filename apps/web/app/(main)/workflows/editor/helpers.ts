'use client'

import type { Node, Edge } from '@xyflow/react'
import type { WorkflowStep, StepNodeData, StepType } from './types'

/** 将工作流步骤数组转换为 React Flow 节点和边 */
export function stepsToNodesAndEdges(steps: WorkflowStep[]): {
  nodes: Node<StepNodeData>[]
  edges: Edge[]
} {
  const nodes: Node<StepNodeData>[] = []
  const edges: Edge[] = []

  if (!steps || steps.length === 0) {
    // 空画布 — 添加一个默认的 trigger 占位
    nodes.push(makeTriggerNode('trigger-default'))
    return { nodes, edges }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as WorkflowStep
    const id = `step-${i}`
    const node = makeStepNode(id, step, i)
    nodes.push(node)

    // 连接到前一个节点
    if (i > 0) {
      edges.push({
        id: `e-${i - 1}-${i}`,
        source: `step-${i - 1}`,
        target: id,
        type: 'smoothstep',
        animated: false,
      })
    }
  }

  return { nodes, edges }
}

/** 将 React Flow 节点转换回工作流步骤数组 */
export function nodesAndEdgesToSteps(nodes: Node<StepNodeData>[]): WorkflowStep[] {
  return nodes
    .filter((n) => n.data.stepType !== 'trigger') // 去掉 trigger 占位节点
    .map((n) => n.data.step)
}

/** 创建一个触发器节点(始终在画布顶部) */
function makeTriggerNode(id: string): Node<StepNodeData> {
  return {
    id,
    type: 'stepNode',
    position: { x: 250, y: 0 },
    data: {
      label: '手动触发',
      stepType: 'trigger',
      color: 'blue',
      step: { name: '手动触发', type: 'trigger' },
    },
    deletable: false,
    draggable: false,
  }
}

/** 创建步骤节点 */
function makeStepNode(id: string, step: WorkflowStep, index: number): Node<StepNodeData> {
  return {
    id,
    type: 'stepNode',
    position: { x: 250, y: (index + 1) * 140 },
    data: {
      label: step.name || `步骤 ${index + 1}`,
      stepType: step.type,
      color: getColorForStep(step.type),
      step,
    },
  }
}

/** 创建新步骤的默认数据 */
export function createDefaultStep(type: StepType): WorkflowStep {
  switch (type) {
    case 'trigger':
      return { name: '手动触发', type: 'trigger' }
    case 'echo':
      return { name: '测试回显', type: 'echo', input: 'hello' }
    case 'skill':
      return { name: 'AI 技能', type: 'skill', skill: 'text-summary', input: '请总结以下内容' }
    case 'llm':
      return { name: 'LLM 调用', type: 'llm', input: '请回答...' }
    case 'condition':
      return {
        name: '条件判断',
        type: 'condition',
        condition: 'true',
        thenSteps: [],
        elseSteps: [],
      }
    case 'delay':
      return { name: '延迟', type: 'delay', duration: 1000 }
    case 'loop':
      return { name: '循环', type: 'loop', count: 3, steps: [{ name: '循环步骤', type: 'echo' }] }
    case 'parallel':
      return { name: '并行', type: 'parallel', steps: [{ name: '并行任务', type: 'echo' }] }
    case 'tool':
      return { name: 'MCP 工具', type: 'tool', input: '{}' }
    default:
      return { name: '新步骤', type: 'echo' }
  }
}

function getColorForStep(type: StepType): StepNodeData['color'] {
  switch (type) {
    case 'trigger':
      return 'blue'
    case 'echo':
      return 'slate'
    case 'skill':
      return 'violet'
    case 'llm':
      return 'emerald'
    case 'condition':
      return 'amber'
    case 'delay':
      return 'slate'
    case 'loop':
      return 'blue'
    case 'parallel':
      return 'violet'
    case 'tool':
      return 'amber'
    default:
      return 'slate'
  }
}

/** 默认初始步骤(新建工作流时使用) */
export const DEFAULT_EDITOR_STEPS: WorkflowStep[] = [
  { name: '步骤 1', type: 'echo', input: 'hello world' },
]
