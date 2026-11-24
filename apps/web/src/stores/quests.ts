// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票77(2026-10-18)独立切片:Goal-driven 自评估闭环 + My Quests 跨 workspace 全局看板。
// D152 口径:goal 主副本在 threads.metadata.goalState,端内 goal store 只是**单会话**缓存。
// 服务端跨会话聚合端点已落地(`GET /api/sessions/goals`,api-client `listMyGoals`),
// 看板挂载时经 `hydrateFromServer` 灌入真实 workspaceId 与跨会话目标;
// 本表仍是端内登记表:goal 生命周期每次变化经 attachGoalQuestRecorder 自动登记快照,
// 自评估条目双腿:status 变迁自动记(auto)+ 看板手动记(manual)。
// 依赖 51 已确认入库(台账 6425 行,✅2026-09-28)。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { GOAL_STATUSES, type GoalStatus as CanonicalGoalStatus } from '@ihui/types'
import { clampPercent } from '@ihui/shared/utils/clamp-percent'
import type { MyGoalAssessment, MyGoalRow } from '@ihui/api-client'

import { ssrStorage } from './persist-helpers'
import { createGoalPersistStorage } from '@/lib/chat-persist-crypto'
import { useGoalStore, type Goal } from './goal'

/** 目标状态:六档,**取自 @ihui/types 的 GOAL_STATUSES**,本端不另写字面量联合 */
export type QuestStatus = CanonicalGoalStatus

/** 自评估条目来源:auto=goal 生命周期自动登记;manual=看板手动记录 */
type QuestAssessmentSource = 'auto' | 'manual'

export interface QuestAssessment {
  id: string
  at: number
  /** 评估后的状态(六档词汇,不造新词) */
  status: QuestStatus
  /** 评估后的进度 0-100 */
  progress: number
  /** 评估结论;auto 条目可为空串(只承载状态/进度变迁) */
  summary: string
  source: QuestAssessmentSource
}

export interface QuestEntry {
  goalId: string
  text: string
  status: QuestStatus
  progress: number
  /** 归属 workspace;'' = 端内未取到 workspace 标识(服务端聚合端点未接),不猜 */
  workspaceId: string
  /** 该目标归属的会话 id(goal 帧带来);缺省 = 帧没给 */
  sessionId?: string
  createdAt: number
  updatedAt: number
  /** 自评估轨迹:追加式,上限 MAX_QUEST_ASSESSMENTS,越旧越先裁 */
  assessments: QuestAssessment[]
}

/** 单条 quest 的自评估轨迹上限(±10 进度按钮不产生条目,status 变迁才记,故 20 足够) */
export const MAX_QUEST_ASSESSMENTS = 20

function genAssessmentId(): string {
  return `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 服务端引擎轨迹 → 端内轨迹:六档词汇外剔除、按 id 去重、按 at 升序、封顶 */
function ingestServerAssessments(
  prev: QuestAssessment[],
  incoming: MyGoalAssessment[] | undefined,
): QuestAssessment[] {
  if (!incoming || incoming.length === 0) return prev
  const byId = new Map<string, QuestAssessment>()
  for (const a of prev) byId.set(a.id, a)
  for (const a of incoming) {
    if (!(GOAL_STATUSES as readonly string[]).includes(a.status)) continue
    byId.set(a.id, {
      id: a.id,
      at: a.at,
      status: a.status as QuestStatus,
      progress: clampPercent(Math.round(a.progress)),
      summary: a.summary,
      // 端内来源词汇只有 auto/manual:引擎轨迹归自动评估腿
      source: 'auto',
    })
  }
  return Array.from(byId.values())
    .sort((x, y) => x.at - y.at)
    .slice(-MAX_QUEST_ASSESSMENTS)
}

interface QuestsState {
  entries: Record<string, QuestEntry>
  /** goal store 快照变化时的登记口(recorder 自动调用;同一 goal 幂等) */
  upsertFromGoal: (goal: Goal) => void
  /** goal 被清除(cleared)⇒ 登记表随删(镜像语义,不留僵尸条目) */
  removeQuest: (goalId: string) => void
  /** 手动自评估:对现有 quest 追加一条 manual 条目;quest 不存在或 summary 空白 ⇒ false 不动 */
  recordAssessment: (
    goalId: string,
    input: { summary: string; status?: QuestStatus; progress?: number },
  ) => boolean
  /**
   * 服务端跨会话聚合(票77 GET /api/sessions/goals)灌入本地登记表。
   * sessionId 命中的本地条目沿用原 key(保 progress/assessments),
   * 未命中的以 `srv-<threadId>` 登记;服务端状态词汇非法/形状不符的行跳过。
   */
  hydrateFromServer: (rows: MyGoalRow[]) => void
}

export const useQuestsStore = create<QuestsState>()(
  persist(
    (set) => ({
      entries: {},
      upsertFromGoal: (goal) =>
        set((s) => {
          // 状态词汇守门:未知档原样不动(goal store 已守,此处防二手污染)
          if (!GOAL_STATUSES.includes(goal.status)) return s
          const prev = s.entries[goal.id]
          const now = Date.now()
          if (!prev) {
            return {
              entries: {
                ...s.entries,
                [goal.id]: {
                  goalId: goal.id,
                  text: goal.text,
                  status: goal.status,
                  progress: goal.progress,
                  workspaceId: '',
                  ...(goal.sessionId ? { sessionId: goal.sessionId } : {}),
                  createdAt: goal.createdAt,
                  updatedAt: goal.updatedAt,
                  assessments: [
                    {
                      id: genAssessmentId(),
                      at: now,
                      status: goal.status,
                      progress: goal.progress,
                      summary: '',
                      source: 'auto' as const,
                    },
                  ],
                },
              },
            }
          }
          // 自评估闭环的 auto 腿:status 变迁才记(±10 进度是操作噪声,不记,防刷屏)
          const statusChanged = prev.status !== goal.status
          const assessments = statusChanged
            ? [
                ...prev.assessments,
                {
                  id: genAssessmentId(),
                  at: now,
                  status: goal.status,
                  progress: goal.progress,
                  summary: '',
                  source: 'auto' as const,
                },
              ].slice(-MAX_QUEST_ASSESSMENTS)
            : prev.assessments
          return {
            entries: {
              ...s.entries,
              [goal.id]: {
                ...prev,
                text: goal.text,
                status: goal.status,
                progress: goal.progress,
                ...(goal.sessionId ? { sessionId: goal.sessionId } : {}),
                updatedAt: Math.max(prev.updatedAt, goal.updatedAt),
                assessments,
              },
            },
          }
        }),
      removeQuest: (goalId) =>
        set((s) => {
          if (!s.entries[goalId]) return s
          const entries = { ...s.entries }
          delete entries[goalId]
          return { entries }
        }),
      recordAssessment: (goalId, input) => {
        const summary = input.summary.trim()
        if (!summary) return false
        let appended = false
        set((s) => {
          const prev = s.entries[goalId]
          if (!prev) return s
          appended = true
          const assessment: QuestAssessment = {
            id: genAssessmentId(),
            at: Date.now(),
            status: input.status ?? prev.status,
            progress: input.progress ?? prev.progress,
            summary,
            source: 'manual',
          }
          return {
            entries: {
              ...s.entries,
              [goalId]: {
                ...prev,
                assessments: [...prev.assessments, assessment].slice(-MAX_QUEST_ASSESSMENTS),
              },
            },
          }
        })
        return appended
      },
      hydrateFromServer: (rows) =>
        set((s) => {
          const entries = { ...s.entries }
          const now = Date.now()
          for (const row of rows) {
            const rawStatus = row.goal.status
            if (!(GOAL_STATUSES as readonly string[]).includes(rawStatus)) continue
            const status = rawStatus as QuestStatus
            const key =
              Object.keys(entries).find((k) => {
                const sid = entries[k]?.sessionId
                return row.sessionId !== '' && sid === row.sessionId
              }) ?? `srv-${row.threadId}`
            const prev = entries[key]
            const createdAt = Math.round(row.createdAt * 1000)
            const updatedAt = Math.round(row.updatedAt * 1000)
            const server = ingestServerAssessments([], row.assessments)
            const serverLatest = server.at(-1)
            if (!prev) {
              const assessments =
                server.length > 0
                  ? server
                  : [
                      {
                        id: genAssessmentId(),
                        at: now,
                        status,
                        progress: 0,
                        summary: '',
                        source: 'auto' as const,
                      },
                    ]
              entries[key] = {
                goalId: key,
                text: row.goal.objective || row.title,
                status,
                progress: serverLatest?.progress ?? 0,
                workspaceId: row.workspaceId,
                ...(row.sessionId ? { sessionId: row.sessionId } : {}),
                createdAt,
                updatedAt,
                assessments,
              }
              continue
            }
            const merged = ingestServerAssessments(prev.assessments, row.assessments)
            // 引擎轨迹已带同一 status ⇒ 不重复记本地 auto 条目(每次刷新都灌入会刷屏)
            const serverCarriesStatus = server.some((a) => a.status === status)
            const statusChanged = prev.status !== status && !serverCarriesStatus
            entries[key] = {
              ...prev,
              text: row.goal.objective || prev.text || row.title,
              status,
              progress: serverLatest?.progress ?? prev.progress,
              workspaceId: row.workspaceId,
              ...(row.sessionId ? { sessionId: row.sessionId } : {}),
              createdAt: Math.min(prev.createdAt, createdAt),
              updatedAt: Math.max(prev.updatedAt, updatedAt),
              assessments: statusChanged
                ? [
                    ...merged,
                    {
                      id: genAssessmentId(),
                      at: now,
                      status,
                      progress: serverLatest?.progress ?? prev.progress,
                      summary: '',
                      source: 'auto' as const,
                    },
                  ].slice(-MAX_QUEST_ASSESSMENTS)
                : merged,
            }
          }
          return { entries }
        }),
    }),
    {
      name: 'ihui-quests',
      // D48(G-56)同族:quest 文本是用户自撰的会话派生内容 → 与 goal 同层加密,
      // 复用同一 HKDF 出口(goal 密文解不开 quests,反之亦然)
      storage: createGoalPersistStorage(ssrStorage),
      partialize: (s: QuestsState) => ({ entries: s.entries }),
    },
  ),
)

/** 六档状态计数(看板汇总条;六档全覆盖,零计数的档也出键) */
export function questStatusCounts(entries: Record<string, QuestEntry>): Record<
  QuestStatus,
  number
> & {
  total: number
} {
  const counts = Object.fromEntries(GOAL_STATUSES.map((status) => [status, 0])) as Record<
    QuestStatus,
    number
  >
  let total = 0
  for (const entry of Object.values(entries)) {
    if (!GOAL_STATUSES.includes(entry.status)) continue
    counts[entry.status] += 1
    total += 1
  }
  return { ...counts, total }
}

/** 跨 workspace 分组:workspaceId='' 排最前(当前工作空间),组内按 updatedAt 降序 */
export function groupQuestsByWorkspace(entries: Record<string, QuestEntry>): Array<{
  workspaceId: string
  quests: QuestEntry[]
}> {
  const buckets = new Map<string, QuestEntry[]>()
  for (const entry of Object.values(entries)) {
    const list = buckets.get(entry.workspaceId) ?? []
    list.push(entry)
    buckets.set(entry.workspaceId, list)
  }
  return Array.from(buckets.entries())
    .map(([workspaceId, quests]) => ({
      workspaceId,
      quests: quests.sort((a, b) => b.updatedAt - a.updatedAt),
    }))
    .sort((a, b) => {
      if (a.workspaceId === '' && b.workspaceId !== '') return -1
      if (b.workspaceId === '' && a.workspaceId !== '') return 1
      return a.workspaceId.localeCompare(b.workspaceId)
    })
}

/**
 * goal → quests 自动登记器(模块导入侧生效一次):
 * 监听 goal store,goal 出现/变化即 upsert,goal 清空(cleared)即随删。
 * attach 时先补登记当前 goal(防"登记器晚于首个 goal"漏记首拍)。
 */
let recorderAttached = false
function attachGoalQuestRecorder(): void {
  if (recorderAttached) return
  recorderAttached = true
  const { upsertFromGoal, removeQuest } = useQuestsStore.getState()
  let prev: Goal | null = useGoalStore.getState().goal
  if (prev) upsertFromGoal(prev)
  useGoalStore.subscribe((state) => {
    const next: Goal | null = state.goal
    if (next) {
      upsertFromGoal(next)
    } else if (prev) {
      removeQuest(prev.id)
    }
    prev = next
  })
}

attachGoalQuestRecorder()
