// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { addEdge, type Connection, type Edge, type Node } from '@xyflow/react'
import type {
  CanvasDag,
  CanvasEdgeDef,
  CanvasNodeData,
  CanvasNodeDef,
  CanvasNodeType,
} from './types'
import { createDefaultParams } from './types'

export type CanvasNode = Node<CanvasNodeData>
export type CanvasEdge = Edge

/** 调色板拖入/点击添加节点时生成唯一 id */
export function makeNodeId(type: CanvasNodeType): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** React Flow nodes/edges → 可持久化 DAG(剥离运行态 status/logs) */
export function toDag(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasDag {
  const nodeDefs: CanvasNodeDef[] = nodes.map((n) => ({
    id: n.id,
    type: n.data.nodeType,
    name: n.data.label,
    params: n.data.params,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
  }))
  const edgeDefs: CanvasEdgeDef[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }))
  return { version: 1, nodes: nodeDefs, edges: edgeDefs }
}

/** 持久化 DAG → React Flow nodes/edges(运行态重置为 idle/空日志) */
export function fromDag(dag: CanvasDag): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = dag.nodes.map((n) => ({
    id: n.id,
    type: 'canvasNode',
    position: n.position,
    data: {
      label: n.name,
      nodeType: n.type,
      params: { ...createDefaultParams(n.type), ...n.params },
      status: 'idle',
      logs: [],
    },
  }))
  const edges: CanvasEdge[] = dag.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'default',
  }))
  return { nodes, edges }
}

/** 新增连线(smoothstep 贝塞尔曲线) */
export function connectEdges(connection: Connection, edges: CanvasEdge[]): CanvasEdge[] {
  return addEdge({ ...connection, type: 'smoothstep', animated: true }, edges)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
