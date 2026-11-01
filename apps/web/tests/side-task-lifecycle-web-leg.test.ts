// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D75 侧任务生命周期「最小真实腿」接线锁(2026-11-01 装车,只在 web 一端)。
//
// 钉四件事:
//   ① 入队 / 补答起答 / 流末答案落地 —— 三个瞬间点的状态迁移;
//   ② 过期条目不再呈现为可取用态(cleanup 判出即从桶里收走,卡片只留「来自已清理的」);
//   ③ running 条目不受保留窗口影响(判据在共享模块,L183,端内不重算);
//   ④ cleanup 动作真的把条目收走(桶变小,不是只回一个清单)。
//
// 纪律:判据一律 import 被测源(`@ihui/shared/chat/side-task-lifecycle` + `@/stores/chat`),
// 本文件不复制任何 TTL / 状态表(§22c)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DEFAULT_SIDE_TASK_TTL_MS, isSideTaskExpired } from '@ihui/shared/chat/side-task-lifecycle'

import { useChatStore, type SideQueueItem } from '@/stores/chat'
import { sideTaskFromQueueItem } from '@/lib/side-task-projection'
import { answerSideQuestion } from '@/hooks/use-chat/slash-commands'

const { mockT, mockRunBestOfN, mockToast } = vi.hoisted(() => {
  const map: Record<string, string> = { sideBadge: '侧问', btwNoAnswer: '(无回答)' }
  const mockT = (key: string) => map[key] ?? key
  const mockRunBestOfN = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  })
  return { mockT, mockRunBestOfN, mockToast }
})

// 与 slash-commands-side.test.ts 同一套重依赖隔离:工厂 mock 缺名会在装载期抛
// "No export is defined on the mock",故 slash-commands 新增的 import 也要跟补。
vi.mock('@/api/best-of-api', () => ({ runBestOfN: mockRunBestOfN }))
vi.mock('@/components/common', () => ({ toast: mockToast }))
vi.mock('@ihui/api-client', () => ({ runCommand: vi.fn(), postSessionGoal: vi.fn() }))
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('@/components/ai/full-access-confirm-dialog', () => ({
  isFullAccessConfirmSuppressed: () => true,
}))
vi.mock('@/stores/agent-hooks', () => ({ emitAgentHook: vi.fn() }))
vi.mock('@/stores/mode', () => ({
  useModeStore: { getState: () => ({ currentMode: 'build', setMode: vi.fn() }) },
}))
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: {
    getState: () => ({
      activeWorkspace: null,
      pendingPermissionMode: null,
      setPendingFullAccess: vi.fn(),
    }),
  },
}))
vi.mock('@/stores/goal', () => ({
  useGoalStore: {
    getState: () => ({ goal: null, setGoal: vi.fn(), clear: vi.fn(), setStatus: vi.fn() }),
  },
}))
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: {
    getState: () => ({ workspacePath: null, fetchGitLog: vi.fn(), fetchDiffFiles: vi.fn() }),
  },
}))
vi.mock('@/stores/best-of', () => ({
  useBestOfStore: { getState: () => ({ setResult: vi.fn() }) },
}))

const CONV = 'conv-side-task-leg'

const bucket = (): SideQueueItem[] => useChatStore.getState().sideQueueByConversation[CONV] ?? []

const seed = (items: SideQueueItem[]): void => {
  useChatStore.setState({ sideQueueByConversation: { [CONV]: items } })
}

beforeEach(() => {
  mockRunBestOfN.mockReset()
  mockRunBestOfN.mockResolvedValue({ candidates: [{ content: '答', model: 'gpt-x' }] })
  useChatStore.setState({ messages: [], currentModel: 'test-model', sideQueueByConversation: {} })
})

describe('D75 三瞬间状态迁移(入队 → 补答起答 → 流末落地)', () => {
  it('瞬间①入队即 running,并带上本端实测的运行位置', () => {
    useChatStore.getState().enqueueSideQuestion(CONV, '什么是量子纠缠?')
    const item = bucket()[0]
    expect(item?.state).toBe('running')
    expect(item?.location).toBe('sameEnvironment')
    // 投影层取值单源:同一条目的 SideTask 与队列条目字段一致
    expect(sideTaskFromQueueItem(item as SideQueueItem).state).toBe('running')
  })

  it('瞬间②补答起答仍 running(请求在途不得被当成"已产出待取走")', async () => {
    useChatStore.getState().enqueueSideQuestion(CONV, '起答瞬间')
    const item = bucket()[0] as SideQueueItem
    let stateAtRequest: string | undefined
    mockRunBestOfN.mockImplementation(async () => {
      stateAtRequest = useChatStore.getState().sideQueueByConversation[CONV]?.[0]?.state
      return { candidates: [{ content: '答', model: 'gpt-x' }] }
    })
    await answerSideQuestion('起答瞬间', mockT, undefined, {
      conversationId: CONV,
      itemId: item.id,
    })
    expect(stateAtRequest).toBe('running')
  })

  it('瞬间③流末答案落地 → completed;补答路径就地翻态(不新增条目)', async () => {
    useChatStore.getState().enqueueSideQuestion(CONV, '流末落地')
    const item = bucket()[0] as SideQueueItem
    await answerSideQuestion('流末落地', mockT, undefined, {
      conversationId: CONV,
      itemId: item.id,
    })
    expect(bucket()).toHaveLength(1)
    expect(bucket()[0]?.state).toBe('completed')
    // 答案确实落了本地消息流(卡片交代的是同一枚任务,不是第二份真相)
    expect(useChatStore.getState().messages.some((m) => m.meta?.sidechat === true)).toBe(true)
  })

  it('即答路径(无队列条目)在流末登记一枚 completed 条目', async () => {
    await answerSideQuestion('未排队的侧问', mockT, undefined, { conversationId: CONV })
    const items = bucket()
    expect(items).toHaveLength(1)
    expect(items[0]?.text).toBe('未排队的侧问')
    expect(items[0]?.state).toBe('completed')
  })

  it('请求失败不写 completed:条目留在桶里等下轮流末重试(不静默丢用户的提问)', async () => {
    mockRunBestOfN.mockRejectedValue(new Error('boom'))
    useChatStore.getState().enqueueSideQuestion(CONV, '会失败的侧问')
    const item = bucket()[0] as SideQueueItem
    await expect(
      answerSideQuestion('会失败的侧问', mockT, undefined, {
        conversationId: CONV,
        itemId: item.id,
      }),
    ).rejects.toThrow('boom')
    expect(bucket()[0]?.state).toBe('running')
  })

  it('无生命周期挂点 ⇒ 一个字节都不写桶(装腿前的老调用形态零回归)', async () => {
    await answerSideQuestion('老调用', mockT)
    expect(useChatStore.getState().sideQueueByConversation).toEqual({})
  })
})

describe('D75 过期与清理:判据全在共享模块,端内不重算', () => {
  it('③ running 不受保留窗口影响(超 TTL 仍收不走,也仍是可补答的待答首条)', () => {
    const now = Date.now()
    seed([
      {
        id: 'r1',
        text: '还在跑',
        createdAt: now - DEFAULT_SIDE_TASK_TTL_MS - 1,
        state: 'running',
        location: 'sameEnvironment',
      },
    ])
    const cleaned = useChatStore.getState().cleanupExpiredSideTasks(CONV, now)
    expect(cleaned).toEqual([])
    expect(bucket()).toHaveLength(1)
    expect(useChatStore.getState().peekPendingSideQuestion(CONV)?.id).toBe('r1')
    // 同一判定在共享层也是"未过期"(本行只是复述判据,不是端内另立一套)
    expect(isSideTaskExpired(sideTaskFromQueueItem(bucket()[0] as SideQueueItem), now)).toBe(false)
  })

  it('②+④ completed 超过共享默认保留窗口 ⇒ 不再呈现可取用态,且 cleanup 真把条目收走', () => {
    const now = Date.now()
    seed([
      {
        id: 'c1',
        text: '早已答完',
        createdAt: now - DEFAULT_SIDE_TASK_TTL_MS - 1,
        state: 'completed',
        location: 'sameEnvironment',
      },
      { id: 'c2', text: '刚入队', createdAt: now, state: 'running', location: 'sameEnvironment' },
    ])
    const expired = sideTaskFromQueueItem(bucket()[0] as SideQueueItem)
    expect(isSideTaskExpired(expired, now)).toBe(true)

    const cleaned = useChatStore.getState().cleanupExpiredSideTasks(CONV, now)
    expect(cleaned.map((e) => e.id)).toEqual(['c1'])
    // 条目确实从桶里消失(不是只回清单);剩余待答条目一枚不少
    expect(bucket().map((q) => q.id)).toEqual(['c2'])
    // 已产出的条目不再被当成待答首条
    expect(useChatStore.getState().peekPendingSideQuestion(CONV)?.id).toBe('c2')
  })

  it('expired 标记条目同样被收走;桶收空后整键摘除(不留持久化空桶)', () => {
    const now = Date.now()
    seed([
      { id: 'e1', text: '已过期', createdAt: now, state: 'expired', location: 'sameEnvironment' },
    ])
    const cleaned = useChatStore.getState().cleanupExpiredSideTasks(CONV, now)
    expect(cleaned.map((e) => e.title)).toEqual(['已过期'])
    expect(useChatStore.getState().sideQueueByConversation[CONV]).toBeUndefined()
  })

  it('close 的确认判据出自共享 needsCloseConfirm:running 要确认、纯 completed 不打扰', async () => {
    const { needsCloseConfirm } = await import('@ihui/shared/chat/side-task-lifecycle')
    seed([
      {
        id: 'a',
        text: '待答',
        createdAt: Date.now(),
        state: 'running',
        location: 'sameEnvironment',
      },
    ])
    expect(needsCloseConfirm(sideTaskFromQueueItem(bucket()[0] as SideQueueItem))).toBe(true)
    useChatStore.getState().setSideTaskState(CONV, 'a', 'completed')
    expect(needsCloseConfirm(sideTaskFromQueueItem(bucket()[0] as SideQueueItem))).toBe(false)
  })
})

describe('D75 卡片挂载点(队列真正渲染的位置)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = (rel: string): string => readFileSync(join(here, '../src', rel), 'utf8')

  it('message-input 在同一输入区插槽渲染卡片,并注入 task / cleaned / confirmOpen / onAction', () => {
    const s = src('components/chat/message-input.tsx')
    const mount = s.slice(s.indexOf('<SideTaskLifecycleCard'))
    expect(mount.length).toBeGreaterThan(0)
    for (const prop of [
      'task={sideTask}',
      'cleaned={cleanedSideTasks}',
      'confirmOpen={sideTaskConfirmOpen}',
      'onAction={handleSideTaskAction}',
    ]) {
      expect(mount.includes(prop), prop).toBe(true)
    }
  })

  it('四档动作各有真实落点,没有一档接成空函数', () => {
    const s = src('components/chat/message-input.tsx')
    const handler = s.slice(
      s.indexOf('const handleSideTaskAction'),
      s.indexOf('const handleSideTaskAction') + 1_800,
    )
    expect(handler.includes("action === 'close'")).toBe(true)
    expect(handler.includes('needsCloseConfirm(sideTask)')).toBe(true)
    expect(handler.includes('store.removeSideQuestion(conversationId, sideTask.id)')).toBe(true)
    expect(handler.includes('store.cleanupExpiredSideTasks(conversationId, Date.now())')).toBe(true)
    expect(handler.includes('setSideTaskConfirmOpen(false)')).toBe(true)
    // 空实现形态(=> {})一律不许出现
    expect(handler.includes('=> {}')).toBe(false)
  })

  it('端内不出现第二套过期算式:message-input 不自己减 createdAt', () => {
    const s = src('components/chat/message-input.tsx')
    expect(/Date\.now\(\)\s*-\s*[a-zA-Z.]*createdAt/.test(s)).toBe(false)
    expect(s.includes("from '@ihui/shared/chat/side-task-lifecycle'")).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
