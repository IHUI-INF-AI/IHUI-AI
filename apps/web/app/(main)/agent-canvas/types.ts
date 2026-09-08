// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/** Agent Canvas 可视化任务编排 — 类型与常量定义 */

/** 节点类型:AI 智能体 / 工具调用 / 人工审核 */
export type CanvasNodeType = 'agent' | 'tool' | 'human-review'

/** 节点运行状态(由 SSE node_start/node_end/error/done 事件驱动) */
export type CanvasRunStatus = 'idle' | 'running' | 'success' | 'failed'

/** 单条节点日志(stdout/stderr/系统事件均归一化到此结构) */
export interface CanvasLogEntry {
  id: string
  /** 日志级别,对应 stdout(info)/stderr(error)/exit/warn */
  level: 'info' | 'warn' | 'error' | 'exit'
  message: string
  timestamp: string
}

/** 节点参数(agent/tool/human-review 共用超集) */
export interface CanvasNodeParams {
  /** agent:调用的技能标识 */
  skill?: string
  /** agent/tool:输入文本(试运行 input) */
  input?: string
  /** tool:MCP 工具名 */
  tool?: string
  /** human-review:审核提示语 */
  prompt?: string
}

/** 画布节点数据(存入 React Flow node.data) */
export interface CanvasNodeData extends Record<string, unknown> {
  label: string
  nodeType: CanvasNodeType
  params: CanvasNodeParams
  status: CanvasRunStatus
  logs: CanvasLogEntry[]
}

/** 单个节点定义(DAG 持久化格式) */
export interface CanvasNodeDef {
  id: string
  type: CanvasNodeType
  name: string
  params: CanvasNodeParams
  position: { x: number; y: number }
}

/** 单条边定义(DAG 持久化格式) */
export interface CanvasEdgeDef {
  id: string
  source: string
  target: string
}

/** localStorage 持久化的完整 DAG */
export interface CanvasDag {
  version: 1
  nodes: CanvasNodeDef[]
  edges: CanvasEdgeDef[]
}

/** 节点类型元信息(调色板 + 节点渲染共用) */
export const NODE_TYPE_META: Record<
  CanvasNodeType,
  {
    title: string
    desc: string
    badge: string
    border: string
    bg: string
    accentText: string
  }
> = {
  agent: {
    title: 'Agent',
    desc: '调用 AI 智能体执行子任务',
    badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/40',
    bg: 'bg-violet-500/5',
    accentText: 'text-violet-500',
  },
  tool: {
    title: 'Tool',
    desc: '调用 MCP 工具/命令行',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/5',
    accentText: 'text-amber-500',
  },
  'human-review': {
    title: 'Review',
    desc: '人工审核中断(HITL)',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/5',
    accentText: 'text-blue-500',
  },
}

/** 新建节点的默认参数(reviewPrompt 由调用方注入 i18n 文案,本模块保持无 UI 依赖) */
export function createDefaultParams(type: CanvasNodeType, reviewPrompt?: string): CanvasNodeParams {
  switch (type) {
    case 'agent':
      return { skill: 'text-summary', input: '' }
    case 'tool':
      return { tool: 'shell', input: '' }
    case 'human-review':
      return { prompt: reviewPrompt }
  }
}

/** DAG localStorage key */
export const CANVAS_DAG_STORAGE_KEY = 'ihui:agent-canvas:dag:v1'
