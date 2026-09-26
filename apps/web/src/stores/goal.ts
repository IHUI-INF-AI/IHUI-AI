// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ssrStorage } from './persist-helpers'
import { createGoalPersistStorage } from '@/lib/chat-persist-crypto'

/**
 * /goal 会话目标状态机(W24,2026-09-14 立)。
 *
 * 四态生命周期:active(进行中) → paused(暂停)/blocked(阻塞) → done(完成)。
 * - /goal <目标> 斜杠命令设定目标
 * - 工具面板 GoalCard 展示目标 / 进度 / 阻塞原因,并提供自动续跑
 * - 自动续跑:把续跑指令写入 chat store draftInput + draftAutoSend,
 *   由 MessageInput 消费后自动发送(复用首页 CTA 通道)
 * - localStorage 持久化(ssrStorage 兼容 SSR),刷新后目标不丢
 */

/** 目标状态:进行中 / 已暂停 / 已阻塞 / 已完成 */
export type GoalStatus = 'active' | 'paused' | 'blocked' | 'done'

export interface Goal {
  id: string
  /** 目标描述(用户输入原文) */
  text: string
  status: GoalStatus
  /** 进度百分比 0-100 */
  progress: number
  /** 阻塞原因列表(非空时通常伴随 status=blocked) */
  blockers: string[]
  createdAt: number
  updatedAt: number
}

interface GoalState {
  goal: Goal | null
  /**
   * D64 ⑥(2026-09-26):卡体折叠态持久化(对标 Trae `isGoalExpanded`,E2 证据;
   * 我方此前卡恒展开)。默认展开,随本 store 一并入持久化层。
   */
  expanded: boolean
  /** 设定 / 更新目标文本(重置为 active,进度保留——迭代同一目标场景) */
  setGoal: (text: string) => void
  /** D64 ⑥:仅改目标文本(编辑目标),保留 status/progress/createdAt —— 对齐 Trae
   * 编辑目标语义(E1:composer.threadGoal.editDialog 编辑目标/保存/取消),不重置生命周期 */
  renameGoal: (text: string) => void
  setExpanded: (expanded: boolean) => void
  setProgress: (progress: number) => void
  advance: (delta: number) => void
  addBlocker: (text: string) => void
  removeBlocker: (index: number) => void
  setStatus: (status: GoalStatus) => void
  clear: () => void
}

function genGoalId(): string {
  return `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set) => ({
      goal: null,
      expanded: true,
      setGoal: (text) =>
        set((s) => {
          const now = Date.now()
          if (s.goal) {
            return {
              goal: { ...s.goal, text, status: 'active' as GoalStatus, updatedAt: now },
            }
          }
          return {
            goal: {
              id: genGoalId(),
              text,
              status: 'active',
              progress: 0,
              blockers: [],
              createdAt: now,
              updatedAt: now,
            },
          }
        }),
      renameGoal: (text) =>
        set((s) => {
          if (!s.goal) return s
          const trimmed = text.trim()
          // 空文本 / 与现文本逐字相同 ⇒ 不动(不改 updatedAt,避免无意义的"已更新"噪声)
          if (trimmed === '' || trimmed === s.goal.text) return s
          return { goal: { ...s.goal, text: trimmed, updatedAt: Date.now() } }
        }),
      setExpanded: (expanded) => set({ expanded }),
      setProgress: (progress) =>
        set((s) => {
          if (!s.goal) return s
          const clamped = Math.min(100, Math.max(0, Math.round(progress)))
          return { goal: { ...s.goal, progress: clamped, updatedAt: Date.now() } }
        }),
      advance: (delta) =>
        set((s) => {
          if (!s.goal) return s
          const clamped = Math.min(100, Math.max(0, Math.round(s.goal.progress + delta)))
          return { goal: { ...s.goal, progress: clamped, updatedAt: Date.now() } }
        }),
      addBlocker: (text) =>
        set((s) => {
          if (!s.goal) return s
          const trimmed = text.trim()
          if (!trimmed) return s
          return {
            goal: {
              ...s.goal,
              blockers: [...s.goal.blockers, trimmed],
              status: 'blocked',
              updatedAt: Date.now(),
            },
          }
        }),
      removeBlocker: (index) =>
        set((s) => {
          if (!s.goal) return s
          const blockers = s.goal.blockers.filter((_, i) => i !== index)
          // 最后一条阻塞移除后自动恢复进行中(仅 blocked 态时)
          const status: GoalStatus =
            s.goal.status === 'blocked' && blockers.length === 0 ? 'active' : s.goal.status
          return { goal: { ...s.goal, blockers, status, updatedAt: Date.now() } }
        }),
      setStatus: (status) =>
        set((s) => (s.goal ? { goal: { ...s.goal, status, updatedAt: Date.now() } } : s)),
      clear: () => set({ goal: null }),
    }),
    {
      name: 'ihui-goal',
      // D48(G-56)目标文本是用户自撰的会话派生内容 → 桌面端与 chat 同层加密,但走独立 HKDF 域
      // (chat 密文解不开 goal,反之亦然)。浏览器路径原样返回 ssrStorage,行为零变更。
      storage: createGoalPersistStorage(ssrStorage),
      partialize: (s: GoalState) => ({ goal: s.goal, expanded: s.expanded }),
    },
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
