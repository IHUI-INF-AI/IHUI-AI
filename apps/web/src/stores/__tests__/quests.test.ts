// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// 票77(2026-10-18):My Quests 登记表(store 面)单测。
// 覆盖:upsert 建档/更新、auto 评估只随 status 变迁、未知档不动、
// manual 评估空串拒绝、removeQuest 镜像删、六档计数与跨 workspace 分组、
// 评估轨迹上限、goal store 自动登记器(attachGoalQuestRecorder)。
import { useGoalStore, type Goal } from '../goal'
import type { MyGoalRow } from '@ihui/api-client'
import {
  MAX_QUEST_ASSESSMENTS,
  groupQuestsByWorkspace,
  questStatusCounts,
  useQuestsStore,
  type QuestEntry,
} from '../quests'

function makeGoal(partial: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    text: '完成票77',
    status: 'active',
    progress: 0,
    blockers: [],
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    ...partial,
  }
}

function entryOf(goalId: string): QuestEntry | undefined {
  return useQuestsStore.getState().entries[goalId]
}

describe('quests store:upsertFromGoal', () => {
  beforeEach(() => {
    useQuestsStore.setState({ entries: {} })
  })

  it('首次登记建档:快照字段齐,带一条 auto 评估', () => {
    useQuestsStore.getState().upsertFromGoal(makeGoal({ sessionId: 'sess-1' }))
    const entry = entryOf('goal-1')
    expect(entry).toBeTruthy()
    expect(entry!.text).toBe('完成票77')
    expect(entry!.status).toBe('active')
    expect(entry!.progress).toBe(0)
    expect(entry!.workspaceId).toBe('')
    expect(entry!.sessionId).toBe('sess-1')
    expect(entry!.assessments).toHaveLength(1)
    expect(entry!.assessments[0]).toMatchObject({ status: 'active', progress: 0, source: 'auto' })
  })

  it('同 goal 再登记(进度变):快照更新,评估不增(进度变化不产生 auto 评估)', () => {
    useQuestsStore.getState().upsertFromGoal(makeGoal())
    useQuestsStore.getState().upsertFromGoal(makeGoal({ progress: 40, updatedAt: 2_000_000 }))
    const entry = entryOf('goal-1')
    expect(entry!.progress).toBe(40)
    expect(entry!.updatedAt).toBe(2_000_000)
    expect(entry!.assessments).toHaveLength(1)
  })

  it('status 变迁追加 auto 评估(含新档与当时进度)', () => {
    useQuestsStore.getState().upsertFromGoal(makeGoal({ progress: 30 }))
    useQuestsStore.getState().upsertFromGoal(makeGoal({ status: 'blocked', progress: 30 }))
    const entry = entryOf('goal-1')!
    expect(entry.status).toBe('blocked')
    expect(entry.assessments).toHaveLength(2)
    expect(entry.assessments[1]).toMatchObject({ status: 'blocked', progress: 30, source: 'auto' })
  })

  it('未知状态档:原样不动,不建档不覆盖', () => {
    useQuestsStore.getState().upsertFromGoal(makeGoal())
    const before = entryOf('goal-1')
    useQuestsStore
      .getState()
      .upsertFromGoal(makeGoal({ status: 'bogus' as Goal['status'], text: '污染稿' }))
    expect(entryOf('goal-1')).toEqual(before)
    useQuestsStore.setState({ entries: {} })
    useQuestsStore.getState().upsertFromGoal(makeGoal({ status: 'bogus' as Goal['status'] }))
    expect(entryOf('goal-1')).toBeUndefined()
  })

  it('评估轨迹上限:超过 MAX_QUEST_ASSESSMENTS 裁最旧', () => {
    useQuestsStore.getState().upsertFromGoal(makeGoal())
    const statuses = ['paused', 'active', 'blocked', 'active'] as const
    for (let i = 0; i < 30; i++) {
      useQuestsStore.getState().upsertFromGoal(makeGoal({ status: statuses[i % statuses.length] }))
    }
    expect(entryOf('goal-1')!.assessments).toHaveLength(MAX_QUEST_ASSESSMENTS)
  })
})

describe('quests store:recordAssessment / removeQuest', () => {
  beforeEach(() => {
    useQuestsStore.setState({ entries: {} })
    useQuestsStore.getState().upsertFromGoal(makeGoal({ progress: 55 }))
  })

  it('manual 评估追加:带 summary 与当前快照', () => {
    const ok = useQuestsStore
      .getState()
      .recordAssessment('goal-1', { summary: ' 自评估:主链路已通,余测试 ' })
    expect(ok).toBe(true)
    const entry = entryOf('goal-1')!
    expect(entry.assessments).toHaveLength(2)
    expect(entry.assessments[1]).toMatchObject({
      summary: '自评估:主链路已通,余测试',
      status: 'active',
      progress: 55,
      source: 'manual',
    })
  })

  it('空 summary 或未知 goalId:false 且不动', () => {
    expect(useQuestsStore.getState().recordAssessment('goal-1', { summary: '   ' })).toBe(false)
    expect(useQuestsStore.getState().recordAssessment('goal-404', { summary: 'x' })).toBe(false)
    expect(entryOf('goal-1')!.assessments).toHaveLength(1)
  })

  it('removeQuest 删除条目;再次 remove 幂等', () => {
    useQuestsStore.getState().removeQuest('goal-1')
    expect(entryOf('goal-1')).toBeUndefined()
    useQuestsStore.getState().removeQuest('goal-1')
    expect(useQuestsStore.getState().entries).toEqual({})
  })
})

describe('quests store:hydrateFromServer(票77 服务端聚合腿)', () => {
  beforeEach(() => {
    useQuestsStore.setState({ entries: {} })
  })

  function makeRow(partial: Partial<MyGoalRow> = {}): MyGoalRow {
    return {
      threadId: 'th-1',
      sessionId: '',
      title: '服务端标题',
      workspaceId: '',
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_100,
      goal: { status: 'active', objective: '服务端目标' },
      ...partial,
    }
  }

  it('未命中本地 sessionId:以 srv-<threadId> 建档,带真实 workspaceId 与秒→毫秒时间', () => {
    useQuestsStore
      .getState()
      .hydrateFromServer([makeRow({ threadId: 'th-1', sessionId: 'sess-x', workspaceId: 'ws-2' })])
    const entry = entryOf('srv-th-1')!
    expect(entry.text).toBe('服务端目标')
    expect(entry.status).toBe('active')
    expect(entry.workspaceId).toBe('ws-2')
    expect(entry.sessionId).toBe('sess-x')
    expect(entry.createdAt).toBe(1_700_000_000_000)
    expect(entry.updatedAt).toBe(1_700_000_100_000)
    expect(entry.assessments).toHaveLength(1)
    expect(entry.assessments[0]).toMatchObject({ status: 'active', source: 'auto' })
  })

  it('sessionId 命中本地条目:沿用 key,保 progress/评估轨迹,更新状态并追加 auto', () => {
    useQuestsStore.getState().upsertFromGoal(makeGoal({ sessionId: 'sess-1', progress: 55 }))
    useQuestsStore.getState().hydrateFromServer([
      makeRow({
        sessionId: 'sess-1',
        workspaceId: 'ws-2',
        goal: { status: 'blocked', objective: '服务端改写' },
      }),
    ])
    const entry = entryOf('goal-1')!
    expect(entry.status).toBe('blocked')
    expect(entry.progress).toBe(55)
    expect(entry.workspaceId).toBe('ws-2')
    expect(entry.text).toBe('服务端改写')
    expect(entry.assessments).toHaveLength(2)
    expect(entry.assessments.at(-1)).toMatchObject({ status: 'blocked', source: 'auto' })
    expect(entryOf('srv-th-1')).toBeUndefined()
  })

  it('同 status 重复灌入不追加 auto 条目', () => {
    useQuestsStore.getState().hydrateFromServer([makeRow()])
    useQuestsStore.getState().hydrateFromServer([makeRow({ updatedAt: 1_700_000_200 })])
    expect(entryOf('srv-th-1')!.assessments).toHaveLength(1)
    expect(entryOf('srv-th-1')!.updatedAt).toBe(1_700_000_200_000)
  })

  it('引擎评估轨迹:并轨去重、进度取最新、服务端已带同档则不再补本地 auto', () => {
    // 直接种入端内旧快照(upsertFromGoal 的 auto 时间戳是 now,会把排序断言挤到最后)
    useQuestsStore.setState({
      entries: {
        'goal-1': {
          goalId: 'goal-1',
          text: '本地目标',
          status: 'active',
          progress: 30,
          workspaceId: '',
          sessionId: 'sess-1',
          createdAt: 1_000,
          updatedAt: 2_000,
          assessments: [
            { id: 'local-1', at: 1_000, status: 'active', progress: 30, summary: '', source: 'auto' },
          ],
        },
      },
    })
    const row = makeRow({
      sessionId: 'sess-1',
      goal: { status: 'done', objective: '服务端目标' },
      assessments: [
        {
          id: 'gv-bad',
          at: 1_700_000_120_000,
          status: 'bogus',
          progress: 1,
          summary: '坏档',
          source: 'engine',
        },
        {
          id: 'gv-1',
          at: 1_700_000_150_000,
          status: 'done',
          progress: 80,
          summary: '独立校验:成立 4/5 条',
          source: 'engine',
        },
      ],
    })
    useQuestsStore.getState().hydrateFromServer([row])
    useQuestsStore.getState().hydrateFromServer([row])
    const entry = entryOf('goal-1')!
    expect(entry.status).toBe('done')
    expect(entry.progress).toBe(80)
    // 端内旧快照 + 引擎一条;第二次灌入按 id 去重,不重复追加
    expect(entry.assessments).toHaveLength(2)
    expect(entry.assessments.filter((a) => a.id === 'gv-1')).toHaveLength(1)
    expect(entry.assessments.some((a) => a.id === 'gv-bad')).toBe(false)
    expect(entry.assessments.at(-1)).toMatchObject({
      id: 'gv-1',
      status: 'done',
      progress: 80,
      summary: '独立校验:成立 4/5 条',
      source: 'auto',
    })
  })

  it('非法状态档跳过;objective 空时退 title', () => {
    useQuestsStore
      .getState()
      .hydrateFromServer([
        makeRow({ threadId: 'bad', goal: { status: 'bogus', objective: 'x' } }),
        makeRow({ threadId: 'th-2', title: '标题兜底', goal: { status: 'paused', objective: '' } }),
      ])
    expect(entryOf('srv-bad')).toBeUndefined()
    expect(entryOf('srv-th-2')!.text).toBe('标题兜底')
    expect(entryOf('srv-th-2')!.status).toBe('paused')
  })
})

describe('quests selectors', () => {
  beforeEach(() => {
    useQuestsStore.setState({ entries: {} })
  })

  it('questStatusCounts 六档全覆盖 + total', () => {
    useQuestsStore.getState().upsertFromGoal(makeGoal({ id: 'a' }))
    useQuestsStore.getState().upsertFromGoal(makeGoal({ id: 'b', status: 'done' }))
    useQuestsStore.getState().upsertFromGoal(makeGoal({ id: 'c', status: 'blocked' }))
    const counts = questStatusCounts(useQuestsStore.getState().entries)
    expect(counts.total).toBe(3)
    expect(counts.active).toBe(1)
    expect(counts.done).toBe(1)
    expect(counts.blocked).toBe(1)
    expect(counts.paused).toBe(0)
    expect(counts.usageLimited).toBe(0)
    expect(counts.budgetLimited).toBe(0)
  })

  it('groupQuestsByWorkspace:空 workspaceId 排最前,组内 updatedAt 降序', () => {
    // workspaceId 是 quests 表自有维度(服务端聚合端点落地后接真实标识),
    // 不经 goal 透传 ⇒ 直接种子 entries 验证分组与排序
    const seed = (goalId: string, workspaceId: string, updatedAt: number): QuestEntry => ({
      goalId,
      text: `任务${goalId}`,
      status: 'active',
      progress: 0,
      workspaceId,
      createdAt: 1,
      updatedAt,
      assessments: [],
    })
    useQuestsStore.setState({
      entries: {
        w1a: seed('w1a', 'ws-1', 100),
        cur: seed('cur', '', 300),
        w1b: seed('w1b', 'ws-1', 200),
      },
    })
    const groups = groupQuestsByWorkspace(useQuestsStore.getState().entries)
    const [currentGroup, wsGroup] = groups
    expect(currentGroup!.workspaceId).toBe('')
    expect(currentGroup!.quests.map((q) => q.goalId)).toEqual(['cur'])
    expect(wsGroup!.workspaceId).toBe('ws-1')
    expect(wsGroup!.quests.map((q) => q.goalId)).toEqual(['w1b', 'w1a'])
  })
})

describe('goal → quests 自动登记器', () => {
  beforeEach(() => {
    useQuestsStore.setState({ entries: {} })
  })

  afterEach(() => {
    useGoalStore.setState({ goal: null })
  })

  it('setGoal 自动建档;clear 自动随删(镜像语义)', () => {
    useGoalStore.getState().setGoal('跨 workspace 的目标')
    expect(entryOf(useGoalStore.getState().goal!.id)).toBeTruthy()
    const goalId = useGoalStore.getState().goal!.id
    expect(entryOf(goalId)!.text).toBe('跨 workspace 的目标')

    useGoalStore.getState().clear()
    expect(entryOf(goalId)).toBeUndefined()
  })

  it('goal status 变化(如 addBlocker → blocked)自动追加 auto 评估', () => {
    useGoalStore.getState().setGoal('状态机联动')
    const goalId = useGoalStore.getState().goal!.id
    useGoalStore.getState().addBlocker('服务端聚合端点未接')
    const entry = entryOf(goalId)!
    expect(entry.status).toBe('blocked')
    expect(entry.assessments.at(-1)).toMatchObject({ status: 'blocked', source: 'auto' })
  })
})
