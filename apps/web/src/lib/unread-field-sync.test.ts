// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  buildUnreadEntityKey,
  createUnreadFieldSync,
  type UnreadStatusEvent,
} from './unread-field-sync'

/**
 * 乐观未读 overlay + 字段级对账 + 失败回滚标脏 单测(2026-09-30,票 G-977979)。
 *
 * 锁定四条不变量:
 *  1. 持久化失败 → UI 未读回滚 + 标脏精确工作区 + bump 版本(下轮 refetch 恢复)
 *  2. 同事件双订阅者只落库一次(1s/256 去重窗口 + 已有未读只补角标)
 *  3. 当前可见会话不置未读
 *  4. 服务端回包只对账 unreadAt 字段,不覆盖其他字段
 */

const WS = { workspacePath: 'G:/ws/a' }

function makeEvent(partial: Partial<UnreadStatusEvent> = {}): UnreadStatusEvent {
  return {
    reason: 'status_changed',
    unreadSignal: 'background_terminal',
    workspacePath: WS.workspacePath,
    sessionId: 'sess-1',
    status: 'completed',
    updatedAt: 500,
    ...partial,
  }
}

const ACTIVE_WATCHING = { ...WS, sessionId: 'sess-1' }
const ACTIVE_ELSEWHERE = { ...WS, sessionId: 'sess-other' }

interface SetUnreadCall {
  workspacePath: string
  workspaceIdentity?: string
  sessionId: string
  unread: boolean
}

function createDeps(options: { fail?: boolean; resolvedUnreadAt?: number } = {}) {
  const calls: SetUnreadCall[] = []
  return {
    calls,
    deps: {
      setUnread: async (params: SetUnreadCall) => {
        if (options.fail) {
          throw new Error('persist down')
        }
        calls.push(params)
        return { unreadAt: options.resolvedUnreadAt ?? 900 }
      },
    },
  }
}

/** 等待乐观持久化的微任务链(catch 回滚)落定。 */
async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('后台终态 → 未读基本路径', () => {
  it('写精确实体键 overlay + 补角标 + 落库,回包后字段对账并清 overlay', async () => {
    const { deps, calls } = createDeps({ resolvedUnreadAt: 777 })
    const sync = createUnreadFieldSync(deps)
    const key = buildUnreadEntityKey(makeEvent())

    expect(sync.handleStatusEvent(makeEvent(), ACTIVE_ELSEWHERE)).toBe('optimistic')
    expect(sync.getState().overlayByEntityKey[key]).toBeGreaterThan(0)
    expect(sync.getState().badgeByEntityKey[key]).toBe(true)
    expect(calls).toHaveLength(1)

    await flushAsync()
    const state = sync.getState()
    // 回包只对账 unreadAt:行字段拿到服务端权威值,乐观 overlay 退场
    expect(state.rowsByEntityKey[key]?.unreadAt).toBe(777)
    expect(state.overlayByEntityKey[key]).toBeUndefined()
    expect(state.badgeByEntityKey[key]).toBe(true)
  })

  it('非后台终态 / 非终态事件跳过', () => {
    const { deps, calls } = createDeps()
    const sync = createUnreadFieldSync(deps)
    expect(
      sync.handleStatusEvent(makeEvent({ unreadSignal: 'foreground' }), ACTIVE_ELSEWHERE),
    ).toBe('skipped')
    expect(sync.handleStatusEvent(makeEvent({ status: 'running' }), ACTIVE_ELSEWHERE)).toBe('skipped')
    expect(calls).toHaveLength(0)
    expect(sync.getState().overlayByEntityKey).toEqual({})
  })
})

describe('当前可见会话不置未读', () => {
  it('同工作区且激活的就是该会话 → skipped,不落库不写 overlay', () => {
    const { deps, calls } = createDeps()
    const sync = createUnreadFieldSync(deps)
    expect(sync.handleStatusEvent(makeEvent(), ACTIVE_WATCHING)).toBe('skipped')
    expect(calls).toHaveLength(0)
    expect(sync.getState().badgeByEntityKey).toEqual({})
  })

  it('同工作区但激活的是别的会话 → 照常置未读;不同工作区同 id → 照常置未读', () => {
    const { deps, calls } = createDeps()
    const sync = createUnreadFieldSync(deps)
    expect(sync.handleStatusEvent(makeEvent(), ACTIVE_ELSEWHERE)).toBe('optimistic')
    expect(
      sync.handleStatusEvent(
        makeEvent({ workspacePath: 'G:/ws/b' }),
        { workspacePath: 'G:/ws/b', sessionId: 'sess-1' },
      ),
    ).toBe('skipped')
    // 第二个是"正在看",第一个已落库
    expect(calls).toHaveLength(1)
  })
})

describe('同事件多订阅者只落库一次', () => {
  it('首个订阅者落库,第二个(overlay 已在)只补角标', async () => {
    const { deps, calls } = createDeps()
    const sync = createUnreadFieldSync(deps)
    const event = makeEvent()

    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('optimistic')
    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('reconciled')
    expect(calls).toHaveLength(1)

    await flushAsync()
    expect(calls).toHaveLength(1)
  })

  it('事件直接携带 unreadAt 时直接对账字段,不创建永久 overlay,不重复落库', () => {
    const { deps, calls } = createDeps()
    const sync = createUnreadFieldSync(deps)
    const event = makeEvent({ meta: { unreadAt: 42 } })
    const key = buildUnreadEntityKey(event)

    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('reconciled')
    expect(sync.getState().rowsByEntityKey[key]?.unreadAt).toBe(42)
    expect(sync.getState().overlayByEntityKey[key]).toBeUndefined()
    expect(sync.getState().badgeByEntityKey[key]).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('持久化失败回滚后,1s 窗口内同事件不再二次落库;窗口过后允许新尝试', async () => {
    let clock = 10_000
    const { deps, calls } = createDeps({ fail: true })
    const sync = createUnreadFieldSync({ ...deps, now: () => clock })
    const event = makeEvent()

    // 首个订阅者乐观写 + 落库失败回滚(overlay 清掉),去重键仍在窗口内
    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('optimistic')
    await flushAsync()
    expect(sync.getState().overlayByEntityKey).toEqual({})
    // 第二个订阅者晚到:没有行/overlay/meta 事实,靠去重键挡住二次落库
    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('deduped')
    // 窗口过后事件重放允许新尝试
    clock += 1_500
    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('optimistic')
    expect(calls).toHaveLength(0) // 两次都失败
  })
})

describe('持久化失败回滚标脏', () => {
  it('UI 未读回滚 + 标脏精确工作区 + bump 版本(下轮 refetch 恢复)', async () => {
    const { deps, calls } = createDeps({ fail: true })
    const sync = createUnreadFieldSync(deps)
    const key = buildUnreadEntityKey(makeEvent())

    expect(sync.handleStatusEvent(makeEvent(), ACTIVE_ELSEWHERE)).toBe('optimistic')
    expect(sync.getState().overlayByEntityKey[key]).toBeGreaterThan(0)

    await flushAsync()
    const state = sync.getState()
    // 假未读被回滚:overlay 清掉、角标回落
    expect(state.overlayByEntityKey[key]).toBeUndefined()
    expect(state.badgeByEntityKey[key]).toBe(false)
    // 标脏精确工作区 + 版本 bump → 下一轮 membership join 回到持久索引事实
    expect(state.dirtyWorkspaceKeys).toEqual([WS.workspacePath])
    expect(state.membershipVersion).toBe(1)
    expect(calls).toHaveLength(0)
  })

  it('提交前行上已有未读时,失败回滚恢复行内旧值而不是清成空', async () => {
    const { deps } = createDeps({ fail: true })
    const sync = createUnreadFieldSync(deps)
    const key = buildUnreadEntityKey(makeEvent())
    // 预置行上旧未读(模拟行已 publish 且带 unreadAt)
    sync.applyServerMeta(key, { unreadAt: 33 })

    expect(sync.handleStatusEvent(makeEvent(), ACTIVE_ELSEWHERE)).toBe('reconciled')
    await flushAsync()
    // 已有未读不会再发起落库,也就不会触发失败回滚链
    expect(sync.getState().rowsByEntityKey[key]?.unreadAt).toBe(33)
    expect(sync.getState().membershipVersion).toBe(0)
  })
})

describe('服务端回包字段级对账', () => {
  it('applyServerMeta 只吃 unreadAt,标题/更新时间等其余字段一律忽略', () => {
    const { deps } = createDeps({ resolvedUnreadAt: 888 })
    const sync = createUnreadFieldSync(deps)
    const key = buildUnreadEntityKey(makeEvent())

    expect(sync.handleStatusEvent(makeEvent(), ACTIVE_ELSEWHERE)).toBe('optimistic')
    // 模拟服务端整份 meta 回包:标题与更新时间不得被覆盖
    sync.applyServerMeta(key, {
      unreadAt: 888,
      title: '服务端标题',
      updatedAt: 999,
    } as never)
    const row = sync.getState().rowsByEntityKey[key]
    expect(row?.unreadAt).toBe(888)
    expect(row?.title).toBeUndefined()
    expect(row?.updatedAt).toBeUndefined()
  })
})

describe('无 meta/updatedAt 的事件:判不出 ⇒ 放行 + 计数(G-816036)', () => {
  // 有 meta.unreadAt 的事件在更早分支直接对账,不走去重窗口;这里专测"构造不出内容 key"那一档。
  function makeNoKeyEvent(partial: Partial<UnreadStatusEvent> = {}): UnreadStatusEvent {
    const event = makeEvent({ updatedAt: undefined, ...partial })
    return event
  }

  it('无 meta 事件:构造不出内容 key ⇒ 放行(optimistic)且计数 +1,不得当成已去重', async () => {
    const clock = 10_000
    const { deps } = createDeps({ fail: true })
    const sync = createUnreadFieldSync({ ...deps, now: () => clock })
    const event = makeNoKeyEvent()

    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('optimistic')
    // 落库失败回滚后 overlay 清空;第二个订阅者走到去重判定:无内容 key ⇒ 仍必须放行
    await flushAsync()
    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('optimistic')
    expect(sync.getState().noContentKeyPassThrough).toBe(2)
  })

  it('对照:带 updatedAt 的事件仍按内容 key 走 1s 去重窗口(不得被本修法放过)', async () => {
    const clock = 10_000
    const { deps } = createDeps({ fail: true })
    const sync = createUnreadFieldSync({ ...deps, now: () => clock })
    const event = makeEvent({ updatedAt: 500 })

    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('optimistic')
    // 落库失败回滚后 overlay 清空,第二个订阅者才会走到去重窗口
    await flushAsync()
    expect(sync.handleStatusEvent(event, ACTIVE_ELSEWHERE)).toBe('deduped')
    // 有内容 key 的事件不计入"判不出"计数
    expect(sync.getState().noContentKeyPassThrough).toBe(0)
  })
})
