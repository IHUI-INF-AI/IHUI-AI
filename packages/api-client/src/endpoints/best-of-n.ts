// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Best-of-N 同任务多副本自动择优端点(2026-09-07 立)。
 *
 * 对标 Cursor 多副本择优:同一任务并行跑 N 份,由评审模型打分(0-100)选最优回写。
 * 后端路由见 apps/ai-service/app/routers/best_of_n.py,
 * 经 web 代理以 `/api/best-of-n*` 直连 ai-service 8803:
 *  - POST /api/best-of-n/run → {messages, model?, n?, evaluatorModel?, sessionId?}
 *
 * 后端返回标准 `{ code: 0, data: {...} }` 包装,统一走 `fetchApi`。
 * 注意:N 副本同步串行执行 + 评审,耗时可达分钟级,需设置足够超时。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// ===================== 类型定义 =====================

/** 单个候选的执行与评审结果 */
export interface BestOfNCandidate {
  candidate_id: number
  content: string
  model: string
  ok: boolean
  error: string
  /** 评审分(0-100);n=1 或评审兜底为启发式分时可能为 null */
  score: number | null
  score_reason: string
  latency_ms: number
  tokens_in: number
  tokens_out: number
  cost_usd: number
}

/** Best-of-N 整体结果 */
export interface BestOfNRunResult {
  winner: BestOfNCandidate
  candidates: BestOfNCandidate[]
  nRequested: number
  evaluatorModel: string
  /** true = 评审模型失败,走确定性规则(最长内容/首个成功)兜底 */
  evaluatorFallback: boolean
  rationale: string
  totalCostUsd: number
  runId: string
}

/** Best-of-N 运行入参 */
export interface BestOfNRunInput {
  /** 任务消息(OpenAI 格式 role/content) */
  messages: Array<{ role: string; content: string }>
  /** 执行模型(默认走网关默认) */
  model?: string
  /** 副本数 1-5(默认 3) */
  n?: number
  /** 评审模型(默认网关便宜模型) */
  evaluatorModel?: string
  /** 关联会话 ID(成本记账归因) */
  sessionId?: string
}

/**
 * 运行 Best-of-N:同任务 N 副本并行 → LLM 评审 → 择优。
 * 耗时可达分钟级,调用方需覆盖默认超时(建议 >=120_000ms)。
 */
export async function runBestOfN(
  input: BestOfNRunInput,
  options?: { timeoutMs?: number },
): Promise<ApiResult<BestOfNRunResult>> {
  return fetchApi<BestOfNRunResult>('/api/best-of-n/run', {
    method: 'POST',
    body: JSON.stringify({
      messages: input.messages,
      model: input.model,
      n: input.n,
      evaluatorModel: input.evaluatorModel,
      sessionId: input.sessionId,
    }),
    ...(options?.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  })
}
