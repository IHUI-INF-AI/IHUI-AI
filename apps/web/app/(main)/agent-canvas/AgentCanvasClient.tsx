// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { SSEEvent } from '@ihui/types'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { CanvasTaskNode } from './components/canvas-task-node'
import { NodePalette, CANVAS_DND_MIME } from './components/node-palette'
import { InspectorPanel } from './components/inspector-panel'
import { TopToolbar } from './components/top-toolbar'
import { runCanvasDag } from './canvas-api'
import {
  makeNodeId,
  toDag,
  fromDag,
  connectEdges,
  type CanvasNode,
  type CanvasEdge,
} from './helpers'
import {
  CANVAS_DAG_STORAGE_KEY,
  createDefaultParams,
  NODE_TYPE_META,
  type CanvasDag,
  type CanvasLogEntry,
  type CanvasNodeData,
  type CanvasNodeType,
} from './types'

const nodeTypes: NodeTypes = {
  canvasNode: CanvasTaskNode,
}

const EMPTY_DAG: CanvasDag = { version: 1, nodes: [], edges: [] }

/** 从 localStorage 读取 DAG(解析失败回退空画布) */
function loadDag(): CanvasDag {
  if (typeof window === 'undefined') return EMPTY_DAG
  try {
    const raw = window.localStorage.getItem(CANVAS_DAG_STORAGE_KEY)
    if (!raw) return EMPTY_DAG
    const parsed = JSON.parse(raw) as CanvasDag
    if (parsed?.version === 1 && Array.isArray(parsed.nodes)) return parsed
    return EMPTY_DAG
  } catch {
    return EMPTY_DAG
  }
}

let logSeq = 0
function makeLog(level: CanvasLogEntry['level'], message: string): CanvasLogEntry {
  logSeq += 1
  return {
    id: `log-${Date.now().toString(36)}-${logSeq}`,
    level,
    message,
    timestamp: new Date().toISOString(),
  }
}

/** SSE data → 可读日志文本(兼容 stdout/stderr/message/output 等字段) */
function sseDataToText(data: unknown): string {
  if (data === undefined || data === null) return ''
  if (typeof data === 'string') return data
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>
    const parts: string[] = []
    if (typeof d.stdout === 'string') parts.push(d.stdout)
    if (typeof d.stderr === 'string') parts.push(`[stderr] ${d.stderr}`)
    if (d.exitCode !== undefined) parts.push(`[exit ${String(d.exitCode)}]`)
    if (typeof d.message === 'string') parts.push(d.message)
    if (typeof d.output === 'string') parts.push(d.output)
    if (parts.length > 0) return parts.join('\n')
  }
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

/**
 * Agent Canvas 主客户端组件
 *
 * 三栏布局:左 NodePalette / 中 ReactFlow 画布 / 右 InspectorPanel(参数+日志),
 * 顶部 TopToolbar(Run/Stop/清空)。
 * DAG 变更防抖写入 localStorage;运行事件通过 useAgentStream(SSE) 分发进节点日志。
 */
export function AgentCanvasClient() {
  const t = useTranslations('agentCanvas')
  const initial = React.useMemo(() => fromDag(loadDag()), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(initial.edges)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [runId, setRunId] = React.useState('')
  const [isStarting, setIsStarting] = React.useState(false)
  const [runError, setRunError] = React.useState<string | null>(null)
  const flowRef = React.useRef<HTMLDivElement>(null)

  // ---- SSE 事件 → 节点状态/日志 ----
  const appendLog = React.useCallback(
    (nodeId: string, level: CanvasLogEntry['level'], message: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: { ...n.data, logs: [...n.data.logs, makeLog(level, message)].slice(-100) },
              }
            : n,
        ),
      )
    },
    [setNodes],
  )

  const setStatus = React.useCallback(
    (nodeId: string, status: CanvasNodeData['status']) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)),
      )
    },
    [setNodes],
  )

  const handleSseEvent = React.useCallback(
    (evt: SSEEvent) => {
      // 整图执行:node_* 事件必须携带 nodeId 才能定位画布节点
      const targetId = evt.nodeId
      if (!targetId) {
        // 无 nodeId 的全局事件:error → 所有 running 节点标记 failed;done → 收尾
        if (evt.type === 'error') {
          setRunError(sseDataToText(evt.data) || t('logErrorFallback'))
          setNodes((nds) =>
            nds.map((n) =>
              n.data.status === 'running' ? { ...n, data: { ...n.data, status: 'failed' } } : n,
            ),
          )
        } else if (evt.type === 'done') {
          setNodes((nds) =>
            nds.map((n) =>
              n.data.status === 'running' ? { ...n, data: { ...n.data, status: 'success' } } : n,
            ),
          )
        }
        return
      }
      switch (evt.type) {
        case 'node_start':
          setStatus(targetId, 'running')
          appendLog(targetId, 'info', '▶ 节点开始执行')
          break
        case 'node_end': {
          const text = sseDataToText(evt.data)
          // 上游失败 → 后端返回 skipped,需在 failed 之前判断(避免 exitCode=null 误判)
          if (/"status"\s*:\s*"skipped"/.test(text)) {
            setStatus(targetId, 'skipped')
            appendLog(targetId, 'warn', `⏭ ${t('logSkippedUpstream')}`)
            break
          }
          const failed = /"status"\s*:\s*"failed"/.test(text) || /\[exit [^0]/.test(text)
          setStatus(targetId, failed ? 'failed' : 'success')
          if (text) appendLog(targetId, failed ? 'error' : 'info', text)
          break
        }
        case 'tool_call':
          appendLog(targetId, 'info', `${t('logToolCall')}${sseDataToText(evt.data)}`)
          break
        case 'tool_result':
          appendLog(targetId, 'info', `${t('logToolResult')}${sseDataToText(evt.data)}`)
          break
        case 'token':
          // token 高频,聚合到最近一条 info 日志尾部,避免刷屏
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== targetId) return n
              const logs = n.data.logs
              const last = logs[logs.length - 1]
              const chunk = String(evt.data ?? '')
              if (last && last.level === 'info' && last.message.startsWith('📄')) {
                const merged = [...logs]
                merged[merged.length - 1] = { ...last, message: last.message + chunk }
                return { ...n, data: { ...n.data, logs: merged } }
              }
              return { ...n, data: { ...n.data, logs: [...logs, makeLog('info', `📄 ${chunk}`)] } }
            }),
          )
          break
        case 'interrupt':
          appendLog(targetId, 'warn', `${t('logWaitReview')}${sseDataToText(evt.data)}`)
          break
        case 'error':
          setStatus(targetId, 'failed')
          appendLog(
            targetId,
            'error',
            `${t('logRunError')}${sseDataToText(evt.data) || t('logErrorFallback')}`,
          )
          break
        case 'done':
          setNodes((nds) =>
            nds.map((n) =>
              n.data.status === 'running' ? { ...n, data: { ...n.data, status: 'success' } } : n,
            ),
          )
          appendLog(targetId, 'exit', '■ 运行结束 (done)')
          break
        default:
          break
      }
    },
    [appendLog, setStatus, setNodes, t],
  )

  const stream = useAgentStream({
    threadId: runId,
    onEvent: handleSseEvent,
    onError: (msg) => {
      setRunError(msg)
      // 连接失败:所有仍在 running 的节点标记 failed
      setNodes((nds) =>
        nds.map((n) =>
          n.data.status === 'running' ? { ...n, data: { ...n.data, status: 'failed' } } : n,
        ),
      )
    },
  })
  const streamRef = React.useRef(stream)
  streamRef.current = stream

  // ---- DAG 持久化(防抖 500ms) ----
  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(CANVAS_DAG_STORAGE_KEY, JSON.stringify(toDag(nodes, edges)))
      } catch {
        /* quota exceeded — 忽略 */
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [nodes, edges])

  // ---- 画布操作 ----
  const onConnect = React.useCallback(
    (connection: Connection) => setEdges((eds) => connectEdges(connection, eds)),
    [setEdges],
  )

  const addNodeAt = React.useCallback(
    (type: CanvasNodeType, position?: { x: number; y: number }) => {
      const id = makeNodeId(type)
      const meta = NODE_TYPE_META[type]
      const newNode: CanvasNode = {
        id,
        type: 'canvasNode',
        position: position ?? { x: 120 + nodes.length * 40, y: 80 + nodes.length * 30 },
        data: {
          // 与 NodePalette/InspectorPanel 一致直接用 meta.title(NODE_TYPE_META 无 i18n key)
          label: `${meta.title} ${nodes.length + 1}`,
          nodeType: type,
          params: createDefaultParams(type, t('defaultReviewPrompt')),
          status: 'idle',
          logs: [],
        },
      }
      setNodes((nds) => [...nds, newNode])
      setSelectedId(id)
    },
    [nodes.length, setNodes, t],
  )

  const onDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const type = e.dataTransfer.getData(CANVAS_DND_MIME) as CanvasNodeType | ''
      if (!type || !(type in NODE_TYPE_META)) return
      const bounds = flowRef.current?.getBoundingClientRect()
      if (!bounds) return
      addNodeAt(type, { x: e.clientX - bounds.left - 95, y: e.clientY - bounds.top - 25 })
    },
    [addNodeAt],
  )

  const onNodeClick = React.useCallback((_: React.MouseEvent, node: CanvasNode) => {
    setSelectedId(node.id)
  }, [])

  const onPaneClick = React.useCallback(() => setSelectedId(null), [])

  const handleRename = React.useCallback(
    (nodeId: string, name: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: name } } : n)),
      )
    },
    [setNodes],
  )

  const handleUpdateParams = React.useCallback(
    (nodeId: string, patch: Partial<CanvasNodeData['params']>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, params: { ...n.data.params, ...patch } } }
            : n,
        ),
      )
    },
    [setNodes],
  )

  // ---- Run:整图 DAG 一次性执行(POST /api/agent-canvas/run → runId 即 langgraph threadId) ----
  const handleRun = React.useCallback(async () => {
    setRunError(null)
    if (nodes.length === 0) {
      setRunError(t('errorEmptyCanvas'))
      return
    }
    setIsStarting(true)
    try {
      const dag = toDag(nodes, edges)
      // 重置所有节点状态与日志,避免残留上一次运行结果
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, status: 'idle' as const, logs: [] } })),
      )
      const id = await runCanvasDag(dag)
      setRunId(id)
      // threadId state 更新后由 effect 启动流(闭包内 stream.start 仍是旧 threadId)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsStarting(false)
    }
  }, [nodes, edges, setNodes, t])

  // runId 就绪后启动 SSE 流(后端已按 threadId 注册 canvas 图,input 可为空)
  const startedRunRef = React.useRef('')
  React.useEffect(() => {
    if (!runId || startedRunRef.current === runId) return
    startedRunRef.current = runId
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, logs: [makeLog('info', t('logGraphStarted'))] },
      })),
    )
    streamRef.current.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  const handleStop = React.useCallback(() => {
    streamRef.current.stop()
    // 手动停止:所有 running 节点回到 idle
    setNodes((nds) =>
      nds.map((n) =>
        n.data.status === 'running'
          ? {
              ...n,
              data: {
                ...n.data,
                status: 'idle',
                logs: [...n.data.logs, makeLog('warn', t('logUserStop'))],
              },
            }
          : n,
      ),
    )
  }, [setNodes, t])

  const handleClear = React.useCallback(() => {
    streamRef.current.stop()
    setNodes([])
    setEdges([])
    setSelectedId(null)
    setRunId('')
    setRunError(null)
    startedRunRef.current = ''
    try {
      window.localStorage.removeItem(CANVAS_DAG_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [setNodes, setEdges])

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <TopToolbar
        isStreaming={stream.isStreaming}
        isStarting={isStarting}
        runError={runError}
        onRun={() => void handleRun()}
        onStop={handleStop}
        onClear={handleClear}
      />
      <div className="flex h-[calc(100vh-210px)] min-h-[480px] rounded-lg border bg-card">
        <NodePalette onAdd={(type) => addNodeAt(type)} />
        <div className="min-w-0 flex-1" ref={flowRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            className="bg-background/50 [&_.react-flow__attribution]:!bg-transparent [&_.react-flow__attribution]:!text-muted-foreground/60"
          >
            {/* Controls/MiniMap 默认白底(xyflow 硬编码),深色模式下用 token 覆盖,
                按钮图标继承全局 text-foreground(白),不覆盖 bg 会白底白图标看不清 */}
            <Controls className="!rounded-md !border !border-border !bg-card !shadow-sm [&_button]:!bg-card [&_button]:!border-border [&_button]:!text-foreground [&_button:hover]:!bg-muted [&_button]:!border-b" />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          </ReactFlow>
        </div>
        <InspectorPanel
          node={selectedNode?.data ?? null}
          nodeId={selectedNode?.id ?? null}
          onUpdateParams={handleUpdateParams}
          onRename={handleRename}
        />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
