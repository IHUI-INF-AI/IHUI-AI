// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'
import type { CanvasDag, CanvasNodeDef } from './types'

/**
 * Agent Canvas 编排执行 API 客户端
 *
 * 整图 DAG 一次性执行链路(P0 已实现):
 *  1. POST /api/agent-canvas/run
 *       body: { dag: CanvasDag, input?: string }
 *       resp: { code:0, data: { runId: string } }   // runId 即 langgraph threadId
 *       (apps/api 转发 ai-service POST /api/langgraph/canvas/run,
 *        后端校验 DAG(节点 id 唯一/边引用有效/无环)后动态构建 LangGraph 注册)
 *  2. 事件流复用 GET /api/agent-langgraph/:runId/stream(SSE,useAgentStream 消费):
 *       node_start/node_end 的 nodeId 与 dag.nodes[].id 对齐,
 *       data 携带 { stdout?, stderr?, exitCode?, status? } 供日志面板渲染;
 *       任一节点失败时,后端将其下游节点标记 skipped(status:"skipped")。
 */

/** POST /api/agent-canvas/run 的 data 载荷 */
interface CanvasRunData {
  runId: string
}

/** 发起整图执行,返回 runId(用作 SSE stream 的 threadId)。失败抛错由调用方 toast。 */
export async function runCanvasDag(dag: CanvasDag, input?: string): Promise<string> {
  const res = await fetchApi<CanvasRunData>('/api/agent-canvas/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dag, input }),
  })
  if (!res.success) throw new Error(res.error)
  if (!res.data?.runId) throw new Error('response missing runId')
  return res.data.runId
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
