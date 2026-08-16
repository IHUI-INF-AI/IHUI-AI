'use client'

import * as React from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Connection,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { StepNode } from './nodes'
import { NodePalette } from './NodePalette'
import { PropertiesPanel } from './PropertiesPanel'
import { stepsToNodesAndEdges, nodesAndEdgesToSteps, createDefaultStep } from './helpers'
import type { StepNodeData, StepType, WorkflowStep } from './types'

// 注册自定义节点类型
const nodeTypes: NodeTypes = {
  stepNode: StepNode,
}

interface Props {
  steps: WorkflowStep[]
  onChange: (steps: WorkflowStep[]) => void
}

export function WorkflowEditor({ steps, onChange }: Props) {
  // 初始化 React Flow 状态
  const init = React.useMemo(() => stepsToNodesAndEdges(steps), [steps])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>(init.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(init.edges)
  const [selectedNode, setSelectedNode] = React.useState<Node<StepNodeData> | null>(null)
  const reactFlowRef = React.useRef<HTMLDivElement>(null)

  // 同步变更到父组件
  const sync = React.useCallback(
    (ns: Node<StepNodeData>[]) => {
      const newSteps = nodesAndEdgesToSteps(ns)
      onChange(newSteps)
    },
    [onChange],
  )

  // 连接节点
  const onConnect = React.useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds))
    },
    [setEdges],
  )

  // 选择节点
  const onNodeClick = React.useCallback((_: React.MouseEvent, node: Node<StepNodeData>) => {
    setSelectedNode(node)
  }, [])

  // 点击画布空白取消选择
  const onPaneClick = React.useCallback(() => {
    setSelectedNode(null)
  }, [])

  // 更新节点属性
  const handleUpdateNode = React.useCallback(
    (nodeId: string, step: WorkflowStep) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            data: { ...n.data, step, label: step.name },
          }
        }),
      )
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev
        return { ...prev, data: { ...prev.data, step, label: step.name } }
      })
    },
    [setNodes],
  )

  // 删除节点
  const onNodesDelete = React.useCallback(
    (deleted: Node<StepNodeData>[]) => {
      setNodes((nds) => nds.filter((n) => !deleted.find((d) => d.id === n.id)))
      if (selectedNode && deleted.find((d) => d.id === selectedNode.id)) {
        setSelectedNode(null)
      }
    },
    [selectedNode, setNodes],
  )

  // 拖放添加节点
  const onDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/reactflow') as StepType | ''
      if (!type) return

      // 获取画布坐标
      const bounds = reactFlowRef.current?.getBoundingClientRect()
      if (!bounds) return
      const position = {
        x: e.clientX - bounds.left - 100,
        y: e.clientY - bounds.top - 20,
      }

      const step = createDefaultStep(type)
      const id = `step-${Date.now()}`
      const newNode: Node<StepNodeData> = {
        id,
        type: 'stepNode',
        position,
        data: {
          label: step.name,
          stepType: type,
          color: getColor(type),
          step,
        },
      }

      setNodes((nds) => [...nds, newNode])
      // 自动连接到最后一个节点
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1]
        if (lastNode) {
          setEdges((eds) => [
            ...eds,
            {
              id: `e-${lastNode.id}-${id}`,
              source: lastNode.id,
              target: id,
              type: 'smoothstep',
              animated: false,
            },
          ])
        }
      }
    },
    [nodes, setNodes, setEdges],
  )

  // 节点变化时同步
  React.useEffect(() => {
    sync(nodes)
  }, [nodes, sync])

  return (
    <div className="flex h-[500px] rounded-lg border bg-card">
      <NodePalette onDragStart={() => {}} />
      <div className="flex-1" ref={reactFlowRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          selectionOnDrag
          panOnDrag={[1, 2]}
          className="bg-background/50"
        >
          <Controls className="!rounded-md !border !shadow-sm" />
          <MiniMap
            nodeStrokeWidth={2}
            nodeColor="hsl(var(--primary) / 0.15)"
            maskColor="hsl(var(--background) / 0.7)"
            className="!rounded-md !border !shadow-sm"
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(var(--border))"
          />
        </ReactFlow>
      </div>
      <PropertiesPanel
        node={selectedNode}
        onUpdate={handleUpdateNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  )
}

function getColor(type: StepType): StepNodeData['color'] {
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
