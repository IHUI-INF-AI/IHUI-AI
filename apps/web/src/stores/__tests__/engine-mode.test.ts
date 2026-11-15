// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * engine-mode store 桥接契约测试(2026-11-15,阶段 3 接线第 ① 片)。
 *
 * 锁定的不变量:
 *  1. setMode 写本 store 的同时必须同步 shared 全局单例(getGlobalEngineMode)
 *     —— use-agent-stream.ts 等非 React 消费点只读全局单例,不桥接则 UI 选择落空。
 *  2. 非法值回退 auto(与 shared store 的 setMode 同判据)。
 *  3. rehydrate(页面刷新从 localStorage 恢复)后必须把盘上值同步进全局单例,
 *     否则出现「UI 显示本地、实际执行走云端」的状态错位。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getGlobalEngineMode, setGlobalEngineMode } from '@ihui/shared'
import { useEngineModeStore } from '../engine-mode'

describe('engine-mode store 桥接', () => {
  beforeEach(() => {
    // 重置两侧到 auto,避免用例间串味。
    useEngineModeStore.setState({ mode: 'auto' })
    setGlobalEngineMode('auto')
    localStorage.clear()
  })

  it('setMode 写本 store 并同步全局单例(非 React 消费点可见)', () => {
    useEngineModeStore.getState().setMode('local')
    expect(useEngineModeStore.getState().mode).toBe('local')
    expect(getGlobalEngineMode()).toBe('local')

    useEngineModeStore.getState().setMode('cloud')
    expect(useEngineModeStore.getState().mode).toBe('cloud')
    expect(getGlobalEngineMode()).toBe('cloud')
  })

  it('非法值回退 auto,且两侧一致', () => {
    // 故意绕过类型传非法值,验证运行时守卫。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useEngineModeStore.getState().setMode('bogus' as any)
    expect(useEngineModeStore.getState().mode).toBe('auto')
    expect(getGlobalEngineMode()).toBe('auto')
  })

  it('持久化写入 localStorage(键 ihui-engine-mode)', () => {
    useEngineModeStore.getState().setMode('local')
    const raw = localStorage.getItem('ihui-engine-mode')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toMatchObject({ state: { mode: 'local' } })
  })
})

// rehydrate 同步是本片最关键的回归锁:刷新后全局单例必须跟上盘上值。
// 必须用「预置 localStorage → vi.resetModules → 动态 import」模拟真实刷新:store 的
// persist 在模块首次求值时就自动从 localStorage 恢复,静态 import 会让 store 在预置前
// 就 hydrated,测不到恢复链路。同探针验证:回调执行、store 恢复、global 同步三者一致。
describe('engine-mode rehydrate 桥接(模拟刷新)', () => {
  it('刷新恢复盘上 local 后,全局单例同步为 local(防 UI/执行错位)', async () => {
    localStorage.clear()
    localStorage.setItem(
      'ihui-engine-mode',
      JSON.stringify({ state: { mode: 'local' }, version: 0 }),
    )
    vi.resetModules()
    const [{ useEngineModeStore }, shared] = await Promise.all([
      import('../engine-mode'),
      import('@ihui/shared'),
    ])
    await new Promise((r) => setTimeout(r, 30))
    expect(useEngineModeStore.getState().mode).toBe('local')
    expect(shared.getGlobalEngineMode()).toBe('local')
  })

  it('刷新恢复盘上 cloud 后,全局单例同步为 cloud', async () => {
    localStorage.clear()
    localStorage.setItem(
      'ihui-engine-mode',
      JSON.stringify({ state: { mode: 'cloud' }, version: 0 }),
    )
    vi.resetModules()
    const [{ useEngineModeStore }, shared] = await Promise.all([
      import('../engine-mode'),
      import('@ihui/shared'),
    ])
    await new Promise((r) => setTimeout(r, 30))
    expect(useEngineModeStore.getState().mode).toBe('cloud')
    expect(shared.getGlobalEngineMode()).toBe('cloud')
  })
})
