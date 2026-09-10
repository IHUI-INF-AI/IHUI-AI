// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'
import type { CanvasDag, CanvasNodeDef } from './types'

/**
 * Agent Canvas 编排执行 API 客户端
 *
 * ⚠️ TODO(编排端点契约):后端目前**没有**"整图 DAG 一次性执行"的 HTTP 端点。
 * 现有相关能力:
 *  - POST /api/subagents             — subagent dispatch,body.dag:{nodes:[{id,agentRole,task}],edges:[{from,to}]}
 *                                      (仅支持 researcher/coder/... 角色节点,不含 tool/human-review 类型)
 *  - GET  /api/agent-langgraph/:threadId/stream?input=<JSON>
 *                                      — LangGraph SSE 流(node_start/node_end/token/tool_call/done/error),
 *                                        前端以 threadId=canvas 运行 id 消费,实现"实时流式追踪"
 *
 * 期望的后端编排端点契约(待实现后替换 runCanvasDag 的降级路径):
 *  POST /api/agent-canvas/run
 *    body: { dag: CanvasDag, input?: string }
 *    resp: { code:0, data: { runId: string } }   // runId 即 langgraph threadId
 *    事件:复用 GET /api/agent-langgraph/:runId/stream(SSE),
 *          node_start/node_end 的 nodeId 与 dag.nodes[].id 对齐,
 *          data 携带 { stdout?, stderr?, exitCode? } 供日志面板渲染
 */

/** 发起整图执行,返回 runId(用作 SSE stream 的 threadId)。失败抛错由调用方 toast。 */
export async function runCanvasDag(dag: CanvasDag): Promise<string> {
  // TODO(编排端点契约):后端提供 POST /api/agent-canvas/run 后改为一键整图执行。
  // 当前降级策略:对第一个 agent/tool 节点做"单节点试运行",
  // 以随机 threadId 走 /api/agent-langgraph/:threadId/stream,由前端 useAgentStream 消费 SSE。
  const firstNode = pickTrialNode(dag)
  if (!firstNode) throw new Error('画布中没有可运行的节点(agent/tool)')
  const runId = `canvas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return runId
}

/** 单节点试运行的输入(编码进 SSE stream 的 graphInput) */
export function buildTrialInput(node: CanvasNodeDef): Record<string, unknown> {
  return {
    canvasNodeId: node.id,
    nodeType: node.type,
    name: node.name,
    skill: node.params.skill,
    tool: node.params.tool,
    input: node.params.input ?? '',
    prompt: node.params.prompt,
  }
}

/** 触发 human-review 节点的 interrupt(可选增强;失败静默,不阻塞主流程) */
export async function requestHumanReview(runId: string, node: CanvasNodeDef): Promise<void> {
  try {
    await fetchApi(`/api/agent-langgraph/${runId}/interrupt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: node.id,
        reason: 'human-review',
        payload: { prompt: node.params.prompt ?? '' },
      }),
    })
  } catch {
    // 后端 thread 不存在时忽略(interrupt 依赖 langgraph 运行时状态)
  }
}

function pickTrialNode(dag: CanvasDag): CanvasNodeDef | undefined {
  return dag.nodes.find((n) => n.type === 'agent' || n.type === 'tool')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
