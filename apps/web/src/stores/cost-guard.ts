// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'

/**
 * 成本预检/对比状态(P3 #43 成本协商代理 v1,2026-09-16 立)。
 *
 * v1 = 知情闭环:发送前预检(估算 tokens + 费用)展示,流结束后展示实际 tokens
 * 对比。阻塞式协商(超预算弹「继续/精简」)为阶段2。
 * 独立 store(不进 chat store):chat store 是并发改动热点,成本护栏解耦在外。
 */

export interface CostEstimate {
  /** 估算输入 tokens(字符数/3 中文近似) */
  estimatedTokensIn: number
  estimatedTokensOut: number
  /** USD(round 6 位);priced=false 表示仅兜底价,数字仅供参考 */
  estimatedCostUsd: number
  priced: boolean
}

interface CostGuardState {
  /** 最近一次发送的预检结果(null = 尚无/已过期) */
  estimate: CostEstimate | null
  /** 流结束后的实际 tokens(done/usage 事件) */
  actualTokens: number | null
  setEstimate: (e: CostEstimate | null) => void
  setActualTokens: (n: number | null) => void
}

export const useCostGuardStore = create<CostGuardState>((set) => ({
  estimate: null,
  actualTokens: null,
  setEstimate: (estimate) => set({ estimate, actualTokens: null }),
  setActualTokens: (actualTokens) => set({ actualTokens }),
}))
