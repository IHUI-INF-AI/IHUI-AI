// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * V3 #66 判据 1 + 4:档位是唯一真相源、且跨会话持久。
 *
 * 这里同时钉住镜像桥的三条不变量(挂载即以真相源覆写 mirror / mirror 变化被采纳 /
 * 任一方向写入不回环)—— 桥失灵的表现永远是"看上去都对",只能靠计数断言查。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachViewModeMirror,
  isDiffViewMode,
  useDiffViewModeStore,
  type ViewModeMirror,
} from '../diff-view-mode'

const STORAGE_KEY = 'ihui-diff-view-mode'

function resetStore(): void {
  localStorage.clear()
  useDiffViewModeStore.setState({ mode: 'split', threeWayOpen: false })
}

/** 一个可控的 mirror(等价于 IDE store 的那份档位字段) */
function makeMirror(initial: 'split' | 'unified') {
  let value = initial
  const listeners = new Set<() => void>()
  const mirror: ViewModeMirror = {
    get: () => value,
    set: (mode) => {
      value = mode
      for (const l of [...listeners]) l()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    mirror,
    /** 模拟用户在遗留 surface 上点击(直接改值并广播) */
    click(mode: 'split' | 'unified') {
      value = mode
      for (const l of [...listeners]) l()
    },
    peek: () => value,
    listenerCount: () => listeners.size,
  }
}

describe('diff-view-mode:唯一真相源 + 持久化', () => {
  beforeEach(() => resetStore())

  it('默认档为 split(与改造前 IDE 的默认值一致,不偷偷改既有观感)', () => {
    expect(useDiffViewModeStore.getState().mode).toBe('split')
  })

  it('setMode 落盘到 localStorage,且只落 mode/threeWayOpen(不落函数)', () => {
    useDiffViewModeStore.getState().setMode('unified')
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(String(raw)) as { state: { mode?: string; setMode?: unknown } }
    expect(parsed.state.mode).toBe('unified')
    expect(parsed.state.setMode).toBeUndefined()
  })

  it('重灌(模拟刷新)后仍是用户上次选的那一档', () => {
    useDiffViewModeStore.getState().setMode('unified')
    useDiffViewModeStore.getState().setThreeWayOpen(true)
    // 用户关掉浏览器时的存储现场
    const persisted = localStorage.getItem(STORAGE_KEY)
    expect(persisted).not.toBeNull()
    // 先把内存清回默认值(注意:setState 同样会经 persist 写盘,所以必须把现场放回去,
    // 否则本用例测的是"刚写进去的默认值",永远绿 —— 这是一台自证夹具最容易骗自己的姿势)
    useDiffViewModeStore.setState({ mode: 'split', threeWayOpen: false })
    localStorage.setItem(STORAGE_KEY, String(persisted))
    void useDiffViewModeStore.persist?.rehydrate()
    expect(useDiffViewModeStore.getState().mode).toBe('unified')
    expect(useDiffViewModeStore.getState().threeWayOpen).toBe(true)
  })

  it('toggleMode 只在两档间翻转,不会翻出第三种值', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 6; i++) {
      useDiffViewModeStore.getState().toggleMode()
      seen.add(useDiffViewModeStore.getState().mode)
    }
    expect([...seen].sort()).toEqual(['split', 'unified'])
  })

  it('同值 setMode 不产生新状态引用(订阅面不因重复写而抖动)', () => {
    useDiffViewModeStore.getState().setMode('unified')
    const before = useDiffViewModeStore.getState()
    useDiffViewModeStore.getState().setMode('unified')
    expect(useDiffViewModeStore.getState()).toBe(before)
  })

  it('非法档位不写入(持久化数据被手改坏时不把坏值带进渲染面)', () => {
    useDiffViewModeStore.getState().setMode('bogus' as 'split')
    expect(useDiffViewModeStore.getState().mode).toBe('split')
    expect(isDiffViewMode('unified')).toBe(true)
    expect(isDiffViewMode('split')).toBe(true)
    expect(isDiffViewMode('three-way')).toBe(false)
    expect(isDiffViewMode(undefined)).toBe(false)
  })
})

describe('diff-view-mode:与遗留档位 surface 的镜像桥', () => {
  beforeEach(() => resetStore())

  it('挂载即以真相源覆写 mirror —— 持久化值必须盖掉 mirror 的硬编码默认值', () => {
    useDiffViewModeStore.getState().setMode('unified')
    const h = makeMirror('split')
    const detach = attachViewModeMirror(h.mirror)
    expect(h.peek()).toBe('unified')
    detach()
  })

  it('mirror 变化 ⇒ 真相源采纳(IDE 的切换按钮仍然有效)', () => {
    const h = makeMirror('split')
    const detach = attachViewModeMirror(h.mirror)
    h.click('unified')
    expect(useDiffViewModeStore.getState().mode).toBe('unified')
    expect(h.peek()).toBe('unified')
    detach()
  })

  it('真相源变化 ⇒ mirror 跟上,且**只写一次**(不回环)', () => {
    const h = makeMirror('split')
    const spy = vi.spyOn(h.mirror, 'set')
    const detach = attachViewModeMirror(h.mirror)
    const baseline = spy.mock.calls.length
    useDiffViewModeStore.getState().setMode('unified')
    expect(h.peek()).toBe('unified')
    expect(spy.mock.calls.length - baseline).toBe(1)
    detach()
    spy.mockRestore()
  })

  it('解绑后两个方向都不再传播(不留悬挂订阅)', () => {
    const h = makeMirror('split')
    const detach = attachViewModeMirror(h.mirror)
    detach()
    expect(h.listenerCount()).toBe(0)
    useDiffViewModeStore.getState().setMode('unified')
    expect(h.peek()).toBe('split')
    h.click('split')
    expect(useDiffViewModeStore.getState().mode).toBe('unified')
  })

  it('mirror 报出非法档位时不采纳(坏值不进真相源,也不落盘)', () => {
    const listeners = new Set<() => void>()
    let value: 'split' | 'unified' = 'split'
    const mirror: ViewModeMirror = {
      get: () => value,
      set: (mode) => {
        value = mode
      },
      subscribe: (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
    }
    const detach = attachViewModeMirror(mirror)
    value = 'nope' as 'split'
    for (const l of [...listeners]) l()
    expect(useDiffViewModeStore.getState().mode).toBe('split')
    detach()
  })

  it('mirror.set 抛错也不把桥卡死(re-entrancy 标志必须复位)', () => {
    let calls = 0
    const mirror: ViewModeMirror = {
      get: () => 'unified',
      set: () => {
        calls += 1
        throw new Error('mirror exploded')
      },
      subscribe: () => () => {},
    }
    expect(() => attachViewModeMirror(mirror)).toThrow()
    // 抛过之后真相源仍可正常驱动一个健康的 mirror
    const h = makeMirror('split')
    const detach = attachViewModeMirror(h.mirror)
    useDiffViewModeStore.getState().setMode('unified')
    expect(h.peek()).toBe('unified')
    expect(calls).toBe(1)
    detach()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
