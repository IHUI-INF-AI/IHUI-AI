// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'

import type { BestOfNResultData } from '@/api/best-of-api'

/**
 * Best-of-N 对比视图状态(W23,2026-09-14 立)。
 *
 * /bestof 斜杠命令执行成功后把完整结果写入本 store,
 * 工具面板的 BestOfCompare tab 读取并展示 N 候选并排对比,
 * 用户可改选候选并把选中者「落盘」为会话内的 assistant 消息。
 */

interface BestOfState {
  /** 最近一次 /bestof 的任务描述(空 = 无记录);工具面板单卡视图用 */
  task: string
  /** 最近一次 /bestof 的完整结果(null = 尚无);工具面板单卡视图用 */
  result: BestOfNResultData | null
  /** 用户改选的候选 id(null = 沿用后端 winner) */
  selectedId: number | null
  /** P3 #36(2026-09-16 立):runId → 完整结果映射,支撑消息流内对比卡按 runId 取数。
   *  历史消息 meta.bestOfRunId 关联各自结果,互不覆盖;上限 5 条(新的挤掉最旧的)。 */
  results: Record<string, BestOfNResultData>
  /** runId → 任务描述(与 results 同生命周期) */
  tasks: Record<string, string>
  setResult: (task: string, result: BestOfNResultData) => void
  setSelected: (id: number) => void
  clear: () => void
}

/** results 映射上限(防长会话无限膨胀;LRU 语义按插入序近似)。 */
const BEST_OF_RESULTS_CAP = 5

export const useBestOfStore = create<BestOfState>((set, get) => ({
  task: '',
  result: null,
  selectedId: null,
  results: {},
  tasks: {},
  setResult: (task, result) => {
    // P3 #36:同时写入 runId 映射(消息流对比卡按 runId 取数),并裁剪超限旧条目
    const results = { ...get().results, [result.runId]: result }
    const tasks = { ...get().tasks, [result.runId]: task }
    const runIds = Object.keys(results)
    if (runIds.length > BEST_OF_RESULTS_CAP) {
      for (const old of runIds.slice(0, runIds.length - BEST_OF_RESULTS_CAP)) {
        delete results[old]
        delete tasks[old]
      }
    }
    set({ task, result, selectedId: null, results, tasks })
  },
  setSelected: (id) => set({ selectedId: id }),
  clear: () => set({ task: '', result: null, selectedId: null, results: {}, tasks: {} }),
}))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
