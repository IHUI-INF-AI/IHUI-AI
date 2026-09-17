// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'

import { runBestOfN, type BestOfCandidate } from '@/api/best-of-api'

/**
 * 并行世界线状态机(P3 #38 阶段1,2026-09-16 立设计,2026-09-17 落地,对标竞品全部单线执行的代差能力)。
 *
 * 同一问题 fork N 条世界线(每条指定不同模型)**并行**执行,各线独立产出答案;
 * 用户在对比视图中择优「采纳为主线」(写入会话消息流,复用 #36 落盘模式)。
 *
 * 并行执行复用 best-of-n REST 底座:每分支调 runBestOfN(task, 1, modelX)
 * (后端已验证 model 参数生效),Promise.all 并行;每线独立错误隔离
 * (单线失败不拖垮其他线,标记 error 保留现场)。
 */

export interface WorldBranch {
  id: string
  /** 展示标签(模型名) */
  label: string
  model: string
  /** 该线产出的答案(成功时有值) */
  content: string
  status: 'running' | 'success' | 'error'
  /** 单线失败原因(隔离展示,不阻塞其他线) */
  error?: string
  latencyMs?: number
  /** 候选原始数据(评分等,来自 best-of-n 响应) */
  candidate?: BestOfCandidate
}

export interface WorldsState {
  /** 任务描述(空 = 无进行中/已完成的世界线) */
  task: string
  branches: WorldBranch[]
  /** 是否有分支仍在执行 */
  running: boolean
  /** 用户采纳为正线的分支 id(null = 未采纳) */
  adoptedId: string | null
  startWorld: (task: string, models: string[]) => void
  /** 采纳某分支为正线 */
  adopt: (id: string) => void
  reset: () => void
}

/** 唯一分支 id(世界线内单调递增即可,不做 UUID)。 */
let branchSeq = 0

export const useWorldsStore = create<WorldsState>((set, get) => ({
  task: '',
  branches: [],
  running: false,
  adoptedId: null,

  startWorld: (task, models) => {
    const uniq = [...new Set(models.map((m) => m.trim()).filter(Boolean))]
    if (!task.trim() || uniq.length === 0) return
    const branches: WorldBranch[] = uniq.map((model) => ({
      id: `wb-${++branchSeq}`,
      label: model,
      model,
      content: '',
      status: 'running',
    }))
    // 新世界线覆盖旧状态(对比视图一次只看一组)
    set({ task: task.trim(), branches, running: true, adoptedId: null })

    // 并行发射;每线独立 settle(单线失败隔离)
    void Promise.all(
      branches.map(async (branch) => {
        const started = Date.now()
        try {
          const d = await runBestOfN(task, 1, branch.model)
          const winner = d.winner
          set((s) => ({
            branches: s.branches.map((b) =>
              b.id === branch.id
                ? {
                    ...b,
                    content: winner.content || '',
                    status: 'success',
                    latencyMs: Date.now() - started,
                    candidate: winner,
                  }
                : b,
            ),
          }))
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          set((s) => ({
            branches: s.branches.map((b) =>
              b.id === branch.id ? { ...b, status: 'error', error: msg } : b,
            ),
          }))
        }
      }),
    ).then(() => {
      // 全部分支 settle 后收口(仅当仍是本轮世界线时)
      if (get().running) set({ running: false })
    })
  },

  adopt: (id) => set({ adoptedId: id }),
  reset: () => set({ task: '', branches: [], running: false, adoptedId: null }),
}))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
