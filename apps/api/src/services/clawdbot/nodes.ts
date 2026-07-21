/**
 * Clawdbot Nodes - 节点系统
 *
 * 流程节点、条件分支、循环。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { evaluateSafeCondition } from './safe-condition.js'

export type NodeType =
  'start' | 'end' | 'action' | 'condition' | 'loop' | 'parallel' | 'delay' | 'webhook' | 'ai'

export interface NodeDefinition {
  id: string
  type: NodeType
  name: string
  config: Record<string, unknown>
  next?: string[]
  branches?: Array<{ condition: string; next: string }>
}

export interface NodeExecutionContext {
  workflowId: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  visited: Set<string>
  currentNodeId: string | null
}

export interface NodeExecutionResult {
  nodeId: string
  success: boolean
  output?: unknown
  nextNodes: string[]
  error?: string
}

export class NodeExecutor extends EventEmitter {
  private nodes = new Map<string, NodeDefinition>()

  register(node: NodeDefinition): void {
    this.nodes.set(node.id, node)
    this.emit('registered', node)
  }

  get(id: string): NodeDefinition | undefined {
    return this.nodes.get(id)
  }

  list(): NodeDefinition[] {
    return Array.from(this.nodes.values())
  }

  async execute(id: string, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const node = this.nodes.get(id)
    if (!node) {
      return { nodeId: id, success: false, nextNodes: [], error: 'Node not found' }
    }
    if (context.visited.has(id)) {
      return { nodeId: id, success: false, nextNodes: [], error: 'Circular reference detected' }
    }
    context.visited.add(id)
    context.currentNodeId = id

    logger.debug({ node: id, type: node.type }, '[Nodes] Executing')
    this.emit('executing', { node, context })

    let output: unknown
    let nextNodes: string[] = []

    switch (node.type) {
      case 'start':
        nextNodes = node.next ?? []
        break
      case 'end':
        break
      case 'condition':
        // 2026-07-21 安全审计加固:传递完整 context(含 inputs/outputs/...)，
        // 让 condition 能用 `outputs.x > 5` / `inputs.y === 1` 形式引用字段
        const matched = node.branches?.find((b) =>
          this.evaluateCondition(b.condition, context as unknown as Record<string, unknown>),
        )
        nextNodes = matched ? [matched.next] : (node.next ?? [])
        break
      case 'loop':
        const loopConfig = node.config as { count: number; body: string }
        for (let i = 0; i < (loopConfig.count ?? 0); i++) {
          await this.execute(loopConfig.body, context)
        }
        nextNodes = node.next ?? []
        break
      case 'parallel':
        if (node.next?.length) {
          await Promise.all(node.next.map((n) => this.execute(n, context)))
        }
        nextNodes = []
        break
      case 'delay':
        const delayMs = (node.config as { ms?: number }).ms ?? 1000
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        nextNodes = node.next ?? []
        break
      default:
        output = node.config
        nextNodes = node.next ?? []
    }

    context.outputs[id] = output
    const result: NodeExecutionResult = { nodeId: id, success: true, output, nextNodes }
    this.emit('executed', result)
    return result
  }

  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    // 2026-07-21 安全审计加固:用 safe-condition 替代 new Function 防止 RCE
    return evaluateSafeCondition(condition, context)
  }

  getStats() {
    const nodes = this.list()
    return {
      total: nodes.length,
      byType: nodes.reduce(
        (acc, n) => {
          acc[n.type] = (acc[n.type] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
    }
  }
}

let instance: NodeExecutor | null = null

export function getNodeExecutor(): NodeExecutor {
  if (!instance) instance = new NodeExecutor()
  return instance
}
