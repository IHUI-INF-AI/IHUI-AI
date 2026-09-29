// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * G-698:更新检查世代互斥回归。
 *
 * 背景:桌面端更新检查有两条并存链 —— 启动静默检查/托盘「检查更新」都会调到
 * useUpdater.checkForUpdate,而检查结果与下载进度都是横跨多个 await 的异步回调。
 * 修复前没有任何世代标记:旧检查的迟到结果/旧下载链的迟到进度分片会直接覆盖
 * state(比如旧结果把新检查刚落的 downloading 又拉回 available)。
 *
 * 修复:每次发起检查自增 checkGeneration,之后所有异步结果只接受当前世代。
 * 本文件的核心判据(对着旧实现必红):**旧世代回调不得改 state**。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { UpdateProgress, UpdateSession } from '@/lib/tauri-bridge'

/** 每次被测代码调 checkForUpdates 都推入一个可控 deferred,供测试按任意顺序放行。 */
const { checkCalls } = vi.hoisted(() => {
  const checkCalls: Array<{
    promise: Promise<unknown>
    resolve: (value: unknown) => void
    reject: (reason?: unknown) => void
  }> = []
  return { checkCalls }
})

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => true,
  checkForUpdates: vi.fn(() => {
    let resolve!: (value: unknown) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    checkCalls.push({ promise, resolve, reject })
    return promise
  }),
  restartApp: vi.fn(async () => {}),
  markUpdateInstalled: vi.fn(() => {}),
  setAvailableUpdateSession: vi.fn(() => {}),
}))

import { useUpdater, isStaleCheckGeneration } from '../use-updater'
import { markUpdateInstalled, setAvailableUpdateSession } from '@/lib/tauri-bridge'

/** 让检查结果里的 setState 链路跑完(setState 是异步批处理的)。 */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** 取回第 N 次检查的可控 deferred(noUncheckedIndexedAccess 下比裸下标安全)。 */
function checkAt(index: number): { resolve: (value: unknown) => void; reject: (reason?: unknown) => void } {
  const call = checkCalls[index]
  if (!call) throw new Error(`checkCalls[${index}] 不存在(检查尚未发起?)`)
  return call
}

/** 简单会话:downloadAndInstall 直接成功(available 路径用)。 */
function makeSession(version: string): UpdateSession {
  return {
    info: { version },
    downloadAndInstall: async () => {},
  }
}

/** 可控会话:进度/完成时机由测试驱动(downloading 路径用)。 */
function makeDeferredSession(version: string): {
  session: UpdateSession
  fire: (p: UpdateProgress) => void
  finish: () => void
} {
  let onProgress: ((p: UpdateProgress) => void) | undefined
  let resolveInstall!: () => void
  const session: UpdateSession = {
    info: { version },
    downloadAndInstall: async (cb) => {
      onProgress = cb
      await new Promise<void>((resolve) => {
        resolveInstall = resolve
      })
    },
  }
  return {
    session,
    fire: (p) => onProgress?.(p),
    finish: () => resolveInstall(),
  }
}

describe('useUpdater 世代守卫(G-698)', () => {
  beforeEach(() => {
    checkCalls.length = 0
    vi.clearAllMocks()
  })

  it('isStaleCheckGeneration:世代不一致即旧世代(纯函数契约)', () => {
    expect(isStaleCheckGeneration(1, 1)).toBe(false)
    expect(isStaleCheckGeneration(1, 2)).toBe(true)
    expect(isStaleCheckGeneration(3, 2)).toBe(true)
  })

  it('旧世代检查结果迟到不得改 state,仅当前世代可落 state', async () => {
    const { result } = renderHook(() => useUpdater())
    expect(result.current.status).toBe('idle')

    // 并发发起两次检查(如启动静默检查 + 托盘「检查更新」)
    await act(async () => {
      void result.current.checkForUpdate()
    })
    expect(result.current.status).toBe('checking')
    await act(async () => {
      void result.current.checkForUpdate()
    })
    expect(result.current.status).toBe('checking')
    expect(checkCalls).toHaveLength(2)

    // 旧世代(第 1 次检查)先返回:守卫失效的话,旧结果会把 state 改成 available
    await act(async () => {
      checkAt(0).resolve(makeSession('0.1.0'))
      await flushMicrotasks()
    })
    expect(result.current.status).toBe('checking')
    expect(result.current.session).toBeNull()
    expect(setAvailableUpdateSession).not.toHaveBeenCalled()

    // 当前世代返回 → 才允许落 state
    await act(async () => {
      checkAt(1).resolve(makeSession('0.2.0'))
      await flushMicrotasks()
    })
    expect(result.current.status).toBe('available')
    expect(result.current.session?.info.version).toBe('0.2.0')
    expect(setAvailableUpdateSession).toHaveBeenCalledTimes(1)
  })

  it('旧世代的下载进度/完成回调不得改 state,也不得触发安装副作用', async () => {
    const { result } = renderHook(() => useUpdater())
    const old = makeDeferredSession('0.1.0')

    // 启动静默检查(autoInstall=true)→ 会话落地后直接进入下载
    await act(async () => {
      void result.current.checkForUpdate(true, true)
    })
    expect(result.current.status).toBe('checking')
    await act(async () => {
      checkAt(0).resolve(old.session)
      await flushMicrotasks()
    })
    expect(result.current.status).toBe('downloading')

    // 新世代检查发起 → 旧下载链整体作废
    await act(async () => {
      void result.current.checkForUpdate()
    })
    expect(result.current.status).toBe('checking')

    // 旧世代迟到进度分片:不得把 state 拉回 downloading、不得改进度
    await act(async () => {
      old.fire({ downloaded: 5_000_000, total: 15_000_000 })
      await flushMicrotasks()
    })
    expect(result.current.status).toBe('checking')
    expect(result.current.progress).toBe(0)

    // 旧世代"下载完成":不得进入 installing/done、不得标记已安装、不得清会话
    await act(async () => {
      old.finish()
      await flushMicrotasks()
    })
    expect(result.current.status).toBe('checking')
    expect(result.current.session).toBeNull()
    expect(markUpdateInstalled).not.toHaveBeenCalled()

    // 当前世代收尾不受影响:无更新 + 非静默 → up-to-date 提示
    await act(async () => {
      checkAt(1).resolve(null)
      await flushMicrotasks()
    })
    expect(result.current.status).toBe('up-to-date')
  })
})
