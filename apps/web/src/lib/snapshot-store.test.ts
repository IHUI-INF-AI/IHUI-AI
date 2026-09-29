// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import { createSnapshotStore, type SnapshotReader } from './snapshot-store'

interface FakeView {
  revision: number
  label: string
}

type NextResult = { ok: true; view: FakeView } | { ok: false; error: unknown }

/** 可编排的假 reader:记录 subscribe/read 调用序,支持手动推送变更 */
function createFakeReader() {
  const calls: string[] = []
  let changeHandler: ((view: FakeView) => void) | null = null
  let next: NextResult = { ok: false, error: new Error('未编排的读取') }
  const reader: SnapshotReader<FakeView> & {
    setNext: (view: FakeView) => void
    setNextError: (error: unknown) => void
    emit: (view: FakeView) => void
  } = {
    setNext(view) {
      next = { ok: true, view }
    },
    setNextError(error) {
      next = { ok: false, error }
    },
    emit(view) {
      changeHandler?.(view)
    },
    read() {
      calls.push('read')
      return next.ok ? Promise.resolve(next.view) : Promise.reject(next.error)
    },
    subscribe(onChange) {
      calls.push('subscribe')
      changeHandler = onChange
      return () => {
        calls.push('unsubscribe')
        changeHandler = null
      }
    },
  }
  return { reader, calls }
}

describe('snapshot-store(G-977971 快照 store:LKG / revision / generation)', () => {
  it('旧连接 commit 被拒:换源后旧源迟到推送不得串写', async () => {
    const store = createSnapshotStore<FakeView>()
    const sourceA = createFakeReader()
    const sourceB = createFakeReader()
    sourceA.reader.setNext({ revision: 1, label: 'A1' })
    const connA = store.connect(sourceA.reader)
    await connA.ready
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 1, label: 'A1' } })

    sourceB.reader.setNext({ revision: 2, label: 'B2' })
    const connB = store.connect(sourceB.reader)
    await connB.ready

    // A 连接已被 B 取代:A 的推送(即使 revision 更大)必须被 generation 门拒绝
    sourceA.reader.emit({ revision: 99, label: 'A-stale' })
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 2, label: 'B2' } })
    connA.dispose()
    connB.dispose()
  })

  it('revision 回退被拒;等值 revision 不重复广播', async () => {
    const store = createSnapshotStore<FakeView>()
    const source = createFakeReader()
    source.reader.setNext({ revision: 1, label: 'v1' })
    const conn = store.connect(source.reader)
    await conn.ready
    const listener = vi.fn()
    store.subscribe(listener)
    const callsAfterReady = listener.mock.calls.length // connect 时的 loading 广播在订阅前,计 0

    source.reader.emit({ revision: 5, label: 'v5' })
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 5, label: 'v5' } })
    expect(listener.mock.calls.length).toBe(callsAfterReady + 1)

    // 回退被拒
    source.reader.emit({ revision: 4, label: 'v4-stale' })
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 5, label: 'v5' } })
    // 等值不重复广播
    source.reader.emit({ revision: 5, label: 'v5-again' })
    expect(listener.mock.calls.length).toBe(callsAfterReady + 1)
    // 前进才广播
    source.reader.emit({ revision: 6, label: 'v6' })
    expect(listener.mock.calls.length).toBe(callsAfterReady + 2)
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 6, label: 'v6' } })
    conn.dispose()
  })

  it('Last Known Good:成功后断源保持旧数据且不进 error 态、不广播', async () => {
    const store = createSnapshotStore<FakeView>()
    const source = createFakeReader()
    source.reader.setNext({ revision: 1, label: 'good' })
    const conn = store.connect(source.reader)
    await conn.ready
    const listener = vi.fn()
    store.subscribe(listener)
    const callsBefore = listener.mock.calls.length

    source.reader.setNextError(new Error('源断了'))
    await expect(conn.reload()).rejects.toThrow('源断了')
    // UI 保持旧数据
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 1, label: 'good' } })
    // 保留旧数据 = 无状态变化 = 不广播
    expect(listener.mock.calls.length).toBe(callsBefore)
    conn.dispose()
  })

  it('从未成功过的失败才进 error 态;恢复成功后回到 ready', async () => {
    const store = createSnapshotStore<FakeView>()
    const source = createFakeReader()
    source.reader.setNextError(new Error('首次就挂'))
    const conn = store.connect(source.reader)
    await expect(conn.ready).rejects.toThrow('首次就挂')
    expect(store.getSnapshot().status).toBe('error')

    source.reader.setNext({ revision: 1, label: 'recover' })
    await conn.reload()
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 1, label: 'recover' } })
    conn.dispose()
  })

  it('先订阅再读:connect 保证 subscribe 先于 read(防丢事件)', async () => {
    const store = createSnapshotStore<FakeView>()
    const source = createFakeReader()
    source.reader.setNext({ revision: 1, label: 'v1' })
    const conn = store.connect(source.reader)
    await conn.ready
    expect(source.calls[0]).toBe('subscribe')
    expect(source.calls[1]).toBe('read')
    conn.dispose()
  })

  it('dispose 后不再收推送、reload 出口清空;无连接 reload 拒绝', async () => {
    const store = createSnapshotStore<FakeView>()
    await expect(store.reload()).rejects.toThrow('快照源尚未连接')

    const source = createFakeReader()
    source.reader.setNext({ revision: 1, label: 'v1' })
    const conn = store.connect(source.reader)
    await conn.ready
    conn.dispose()
    expect(source.calls).toContain('unsubscribe')
    source.reader.emit({ revision: 2, label: 'v2' })
    expect(store.getSnapshot()).toEqual({ status: 'ready', view: { revision: 1, label: 'v1' } })
    await expect(store.reload()).rejects.toThrow('快照源尚未连接')
  })

  it('非 Error 抛出物也归一成 Error 进 error 态', async () => {
    const store = createSnapshotStore<FakeView>()
    const source = createFakeReader()
    source.reader.setNextError('字符串错误')
    const conn = store.connect(source.reader)
    await expect(conn.ready).rejects.toThrow('字符串错误')
    const state = store.getSnapshot()
    expect(state.status).toBe('error')
    if (state.status === 'error') expect(state.error).toBeInstanceOf(Error)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
