// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子智能体「派单详情」端点 —— 只补既有 endpoints/subagents.ts 缺的三条读接口。
 *
 * 契约源头 apps/api/src/routes/subagent-dispatch.ts(prefix:'/api' 由 server.ts 注册):
 *  - GET /api/subagents/:id/dag      → success(dag)(:575-589;无 DAG 配置回 404 '派单不存在或无 DAG 配置')
 *  - GET /api/subagents/:id/quotas   → success(quotas)(:593-606;不存在回 404 '派单不存在')
 *  - GET /api/subagents/:id/messages → success({ messages })(:611-622;空列表也回 200)
 *  三条均先 requireAuth(:576/:594/:612),未登录 401。
 *
 * 已复用的同类端点(不重复封装):GET /subagents/active → endpoints/subagents.ts:173,
 * POST /subagents/:id/cancel → :198,POST /subagents/:id/resume → :205。
 *
 * 类型镜像 packages/shared/src/subagents/index.ts(DagDefinition :62、QuotaUsage :81、
 * AgentMessage :301);本包未依赖 @ihui/shared,故在此就地声明同形接口,字段与后端 service
 * 返回一致(subagent-dispatch-service.ts)。
 */
import { fetchApi } from '../client.js'

/** DAG 节点(packages/shared/src/subagents/index.ts:48) */
export interface SubagentDagNode {
  id: string
  agentRole: string
  task: string
}

/** DAG 边(index.ts:56) */
export interface SubagentDagEdge {
  from: string
  to: string
  condition?: string
}

/** DAG 定义(GET /api/subagents/:id/dag → data,index.ts:62) */
export interface SubagentDagDefinition {
  nodes: SubagentDagNode[]
  edges: SubagentDagEdge[]
}

/** 配额配置(index.ts:74) */
export interface SubagentQuotaConfig {
  timeoutMs: number
  tokenQuota: number
  maxRetries: number
}

/** 配额使用情况(GET /api/subagents/:id/quotas → data,index.ts:81) */
export interface SubagentQuotaUsage {
  quota: SubagentQuotaConfig
  used: {
    elapsedMs: number
    tokensUsed: number
    retriesUsed: number
  }
  exceeded: boolean
}

/** 智能体间消息(GET /api/subagents/:id/messages → data.messages,index.ts:301) */
export interface SubagentAgentMessage {
  id: string
  fromAgent: string
  toAgent: string
  content: string
  timestamp: string
  messageType: 'task' | 'review' | 'critique' | 'vote' | 'result'
}

/** 统一请求:失败抛 Error(与 endpoints/subagents.ts:166 同口径) */
async function unwrap<T>(url: string): Promise<T> {
  const res = await fetchApi<T>(url)
  if (!res.success) throw new Error(res.error || '请求失败')
  return res.data
}

/** 派单 DAG(GET /api/subagents/:id/dag,subagent-dispatch.ts:575) */
export function getSubagentDispatchDag(id: string): Promise<SubagentDagDefinition> {
  return unwrap<SubagentDagDefinition>(`/api/subagents/${encodeURIComponent(id)}/dag`)
}

/** 派单资源配额(GET /api/subagents/:id/quotas,subagent-dispatch.ts:593) */
export function getSubagentDispatchQuotas(id: string): Promise<SubagentQuotaUsage> {
  return unwrap<SubagentQuotaUsage>(`/api/subagents/${encodeURIComponent(id)}/quotas`)
}

/** 派单协作消息(GET /api/subagents/:id/messages,subagent-dispatch.ts:611) */
export function getSubagentDispatchMessages(
  id: string,
): Promise<{ messages: SubagentAgentMessage[] }> {
  return unwrap<{ messages: SubagentAgentMessage[] }>(
    `/api/subagents/${encodeURIComponent(id)}/messages`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
