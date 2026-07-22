/**
 * Clawdbot Canvas - 画布服务
 *
 * 可视化编排、节点执行。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { getNodeExecutor, type NodeExecutionContext } from './nodes.js'

export interface CanvasNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

export interface Canvas {
  id: string
  name: string
  description?: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  version: number
  createdAt: number
  updatedAt: number
}

export interface CanvasExecutionResult {
  canvasId: string
  success: boolean
  outputs: Record<string, unknown>
  duration: number
  error?: string
}

export class CanvasService extends EventEmitter {
  /** 内存画布存储 — 需后续建表持久化(workflows 表需 createdBy userId,当前接口未传 userId) */
  private canvases = new Map<string, Canvas>()

  create(canvas: Omit<Canvas, 'createdAt' | 'updatedAt' | 'version'>): Canvas {
    const now = Date.now()
    const full: Canvas = { ...canvas, version: 1, createdAt: now, updatedAt: now }
    this.canvases.set(full.id, full)
    logger.info({ canvas: full.id }, '[Canvas] Created')
    this.emit('created', full)
    return full
  }

  get(id: string): Canvas | undefined {
    return this.canvases.get(id)
  }

  list(): Canvas[] {
    return Array.from(this.canvases.values())
  }

  update(id: string, patch: Partial<Canvas>): Canvas | null {
    const canvas = this.canvases.get(id)
    if (!canvas) return null
    Object.assign(canvas, patch, { updatedAt: Date.now(), version: canvas.version + 1 })
    this.emit('updated', canvas)
    return canvas
  }

  delete(id: string): boolean {
    const removed = this.canvases.delete(id)
    if (removed) this.emit('deleted', id)
    return removed
  }

  async execute(id: string, inputs: Record<string, unknown>): Promise<CanvasExecutionResult> {
    const canvas = this.canvases.get(id)
    if (!canvas) return { canvasId: id, success: false, outputs: {}, duration: 0, error: 'Canvas not found' }

    const start = Date.now()
    const nodeExecutor = getNodeExecutor()

    // 注册画布节点
    for (const node of canvas.nodes) {
      const edges = canvas.edges.filter((e) => e.source === node.id)
      nodeExecutor.register({
        id: node.id,
        type: node.type as never,
        name: node.id,
        config: node.data,
        next: edges.filter((e) => !e.condition).map((e) => e.target),
        branches: edges.filter((e) => e.condition).map((e) => ({ condition: e.condition!, next: e.target })),
      })
    }

    const startNode = canvas.nodes.find((n) => n.type === 'start') ?? canvas.nodes[0]
    if (!startNode) {
      return { canvasId: id, success: false, outputs: {}, duration: Date.now() - start, error: 'No start node' }
    }

    const context: NodeExecutionContext = {
      workflowId: id,
      inputs,
      outputs: { ...inputs },
      visited: new Set(),
      currentNodeId: null,
    }

    try {
      let current = startNode.id
      while (current) {
        const result = await nodeExecutor.execute(current, context)
        if (!result.success) {
          return { canvasId: id, success: false, outputs: context.outputs, duration: Date.now() - start, error: result.error }
        }
        current = result.nextNodes[0] ?? ''
      }
      return { canvasId: id, success: true, outputs: context.outputs, duration: Date.now() - start }
    } catch (err) {
      return {
        canvasId: id,
        success: false,
        outputs: context.outputs,
        duration: Date.now() - start,
        error: (err as Error).message,
      }
    }
  }

  getStats() {
    return { total: this.canvases.size }
  }
}

let instance: CanvasService | null = null

export function getCanvasService(): CanvasService {
  if (!instance) instance = new CanvasService()
  return instance
}
