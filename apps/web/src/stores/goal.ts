// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// D152(2026-09-29 立,用户拍板「服务化,但存会话元数据、不建新表」):
// 六档状态词汇的**唯一来源**是 `@ihui/types` 的 `GOAL_STATUSES`,本端不得再抄一份字面量
// —— 本票丢的第一次交付就是"四态写死在端内",服务端主副本一来就按六档发帧,
// 端内那份字面量当场成为第二真相(AGENTS §30「状态词汇是一等契约」)。
// 它同时是**第三个域**:与 AGENT_TASK_STATUSES(Kanban 六列)、
// WORKSPACE_AGENT_TASK_STATUSES(workspace 进程内任务态)不得并集,同名值
// blocked/done 属同词不同义 —— 判据见 scripts/check-agent-status-vocabulary-parity.mjs SV2。
import { GOAL_STATUSES, type GoalStatus as CanonicalGoalStatus } from '@ihui/types'
import type { GoalUpdateEvent } from '@ihui/api-client'
import { clampPercent } from '@ihui/shared/utils/clamp-percent'

import { ssrStorage } from './persist-helpers'
import { createGoalPersistStorage } from '@/lib/chat-persist-crypto'

/**
 * /goal 会话目标状态机(W24,2026-09-14 立;D152 2026-09-29 降为**本地缓存**)。
 *
 * D152 之前:这份 store 是目标的**唯一真相** —— 只活在当前这台浏览器里,
 * 换浏览器 / 换端即丢,引擎对它零感知(票面否证:web 侧实现完整,缺的是服务侧主人)。
 * D152 之后:服务端主副本住在 `threads.metadata.goalState`(唯一写口
 * `session_store.set_thread_goal_state`,上行出口 `POST /llm/sessions/{session_id}/goal`),
 * 本 store 的职责变成
 *   ① **乐观更新的落点**(slash 命令先写本地,再打上行动作);
 *   ② **服务端下行帧的缓存**(`goal_updated` 帧到达即覆盖,见 applyServerGoal);
 *   ③ **persist 兜底**(服务端当轮取不到主副本时,本机体验不得退化 ——
 *      票第 8 栏的回退口径:端点在、前端没收到帧 ⇒ 退回纯本地态,功能不中断)。
 *
 * 状态机六档(active/paused/blocked/done/usageLimited/budgetLimited)+ 线格式第七值
 * `cleared`(单帧承载清除,不建 goal_cleared 第二帧)。
 * - /goal <目标> 斜杠命令设定目标(乐观置 active + 上行 set)
 * - 工具面板 GoalCard 展示目标 / 进度 / 阻塞原因,并提供自动续跑
 * - 自动续跑:把续跑指令写入 chat store draftInput + draftAutoSend,
 *   由 MessageInput 消费后自动发送(复用首页 CTA 通道)
 * - localStorage 持久化(ssrStorage 兼容 SSR),刷新后目标不丢
 */

/** 目标状态:六档,**取自 @ihui/types 的 GOAL_STATUSES**,本端不另写字面量联合 */
export type GoalStatus = CanonicalGoalStatus

export interface Goal {
  id: string
  /** 目标描述(用户输入原文;下行帧的 objective 覆盖它) */
  text: string
  status: GoalStatus
  /** 进度百分比 0-100(端内自算,服务端主副本不承载它 —— 帧到达时**保留**本地这一维) */
  progress: number
  /** 阻塞原因列表(非空时通常伴随 status=blocked) */
  blockers: string[]
  createdAt: number
  updatedAt: number
  /** 累计耗时(ms),由服务端计量随帧带来;缺省 = 本端没有该维数据,GoalCard 退回 updatedAt-createdAt */
  elapsedMs?: number
  /** 累计 token 用量(服务端计量,与 usage 帧同族口径,不是本地估算) */
  tokenUsage?: number
  /** 该目标归属的会话 id(下行帧带来);空串 = 帧没给,端内不猜 */
  sessionId?: string
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
  /**
   * D152(2026-09-29 立):服务端下行帧 `goal_updated` 的**唯一**落点。
   *
   * 三条口径(错一条就会把"多端同一会话"演成"每台机器各说各话"):
   *  · `status:'cleared'` ⇒ 整条目标清空,**幂等**(连收两帧 cleared 与收一帧同形);
   *  · 六档之一 ⇒ 覆盖本地那份(objective/status/elapsedMs/tokenUsage/updatedAt),
   *    本地没有目标时按帧新建(别的端先 /goal,本端不刷新即见 —— 票面验收①);
   *    `progress` 与 `blockers` 是端内维度,服务端不承载 ⇒ 同目标继续时**保留**,
   *    换了 objective 才归零(把别人进度抹掉比不覆盖更糟);
   *  · 未知档 ⇒ **原样不动**,不猜、不折成 active(把"没认出来"写成"看见了"是本仓最高频失效型)。
   */
  applyServerGoal: (frame: GoalUpdateEvent) => void
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
          const clamped = clampPercent(Math.round(progress))
          return { goal: { ...s.goal, progress: clamped, updatedAt: Date.now() } }
        }),
      advance: (delta) =>
        set((s) => {
          if (!s.goal) return s
          const clamped = clampPercent(Math.round(s.goal.progress + delta))
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
      applyServerGoal: (frame) =>
        set((s) => {
          // 单帧承载清除(拍板:不建 goal_cleared 第二帧)。幂等:已空再清仍是空。
          if (frame.status === 'cleared') return { goal: null }
          // 未知档:原样不动。宁可这一帧什么都不改,也不把"没认出来的状态"写成"active"。
          if (!GOAL_STATUSES.includes(frame.status)) return s
          // 服务端 updatedAt 是 epoch **秒**(time.time()),端内一切时刻是毫秒 —— 不换算就会
          // 得到一个 1970 年的时间戳,而 GoalCard 的耗时条会算出天文数字。
          const serverMs =
            typeof frame.updatedAt === 'number' ? Math.round(frame.updatedAt * 1000) : undefined
          const text = frame.objective ?? ''
          const sameObjective = s.goal !== null && (text === '' || text === s.goal.text)
          if (s.goal && sameObjective) {
            return {
              goal: {
                ...s.goal,
                // 帧没带 objective(pause/resume 保留既有目标)⇒ 保留本地文本,不得抹成空串
                text: text || s.goal.text,
                status: frame.status,
                ...(typeof frame.elapsedMs === 'number' ? { elapsedMs: frame.elapsedMs } : {}),
                ...(typeof frame.tokenUsage === 'number' ? { tokenUsage: frame.tokenUsage } : {}),
                ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
                ...(serverMs !== undefined ? { updatedAt: serverMs } : { updatedAt: Date.now() }),
              },
            }
          }
          // 本地没有目标(或目标换了)⇒ 按帧新建:别的端 /goal 了,本端不刷新即见。
          if (!text) return s
          const now = Date.now()
          return {
            goal: {
              id: genGoalId(),
              text,
              status: frame.status,
              // 新建的本地维度归零:服务端不承载 progress/blockers,凭空造一份就是假进度
              progress: 0,
              blockers: [],
              createdAt: serverMs ?? now,
              updatedAt: serverMs ?? now,
              ...(typeof frame.elapsedMs === 'number' ? { elapsedMs: frame.elapsedMs } : {}),
              ...(typeof frame.tokenUsage === 'number' ? { tokenUsage: frame.tokenUsage } : {}),
              ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
            },
          }
        }),
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
