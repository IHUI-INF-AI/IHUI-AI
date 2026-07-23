'use client'

import * as React from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { DagDefinition } from '@ihui/shared/subagents/index'
import { DagNode, type DagNodeData } from './DagNode'

const NODE_WIDTH = 180
const NODE_HEIGHT = 88
const H_GAP = 80
const V_GAP = 28

/** 简单分层布局:入度 0 → level 0,其余 level = max(前驱) + 1 */
function layout(dag: DagDefinition): Map<string, { x: number; y: number }> {
  const { nodes, edges } = dag
  const levelMap = new Map<string, number>()
  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const n of nodes) {
    levelMap.set(n.id, 0)
    inDeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!adj.has(e.from) || !inDeg.has(e.to)) continue
    adj.get(e.from)!.push(e.to)
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1)
  }

  // 拓扑 BFS 计算层级
  const queue: string[] = []
  for (const n of nodes) {
    if ((inDeg.get(n.id) ?? 0) === 0) queue.push(n.id)
  }
  const visited = new Set<string>()
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const next of adj.get(cur) ?? []) {
      const newLevel = (levelMap.get(cur) ?? 0) + 1
      if (newLevel > (levelMap.get(next) ?? 0)) levelMap.set(next, newLevel)
      queue.push(next)
    }
  }

  // 按 level 分组,纵向堆叠
  const byLevel = new Map<number, string[]>()
  for (const n of nodes) {
    const lv = levelMap.get(n.id) ?? 0
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(n.id)
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const [lv, ids] of byLevel) {
    ids.forEach((id, idx) => {
      positions.set(id, {
        x: 40 + lv * (NODE_WIDTH + H_GAP),
        y: 40 + idx * (NODE_HEIGHT + V_GAP),
      })
    })
  }
  return positions
}

const nodeTypes: NodeTypes = { agent: DagNode }

interface DagGraphProps {
  dag: DagDefinition | undefined
  className?: string
}

function DagGraphInner({ dag, className }: DagGraphProps) {
  // 基于 dag 内容的签名:仅在节点/边集合变化时重置内部 state,避免拖拽时被覆盖
  const signature = useMemo(() => {
    if (!dag) return ''
    const ns = dag.nodes.map((n) => `${n.id}:${n.agentRole}`).join('|')
    const es = dag.edges.map((e) => `${e.from}->${e.to}`).join('|')
    return `${ns}#${es}`
  }, [dag])

  const [nodes, setNodes] = React.useState<Node[]>([])
  const [edges, setEdges] = React.useState<Edge[]>([])

  useEffect(() => {
    if (!dag || dag.nodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }
    const positions = layout(dag)
    const nextNodes: Node[] = dag.nodes.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 }
      const data: DagNodeData = { agentRole: n.agentRole, task: n.task, nodeId: n.id }
      return {
        id: n.id,
        type: 'agent',
        position: pos,
        data: data as unknown as Record<string, unknown>,
      }
    })
    const nextEdges: Edge[] = dag.edges.map((e, i) => ({
      id: `e-${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      label: e.condition,
      markerEnd: { type: MarkerType.ArrowClosed },
    }))
    setNodes(nextNodes)
    setEdges(nextEdges)
    // 仅依赖 signature(内容指纹),避免 dag 引用变化但内容相同时重置拖拽位置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  )
  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [],
  )

  if (!dag || dag.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center py-10 text-sm text-muted-foreground ${className ?? ''}`}>
        无 DAG 配置
      </div>
    )
  }

  return (
    <div className={`h-[420px] w-full overflow-hidden rounded-md border bg-background ${className ?? ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap position="bottom-left" pannable zoomable className="!bg-background" />
      </ReactFlow>
    </div>
  )
}

export function DagGraph(props: DagGraphProps) {
  return (
    <ReactFlowProvider>
      <DagGraphInner {...props} />
    </ReactFlowProvider>
  )
}

export { DAG_NODE_ROLE_LABEL as DAG_ROLE_LABEL } from './DagNode'
