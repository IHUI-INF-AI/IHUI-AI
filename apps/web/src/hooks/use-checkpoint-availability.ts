// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D163 残余(2026-10-18 立)web 端检查点可用性消费面。
 *
 * 载体与 D153/D154 同一枚拍板:`@ihui/api-client` 的 `subscribeUserBroadcast`
 * 是设备级单例 + 引用计数,本文件**不再建第二条 per-user 常连**。
 *
 * 三条不可漂的写法:
 *  ① **状态表只由广播写入**,端内不猜、不轮询补位 —— 这正是不做这条通道时
 *     另一台设备只能靠手动刷新碰运气的缺口。
 *  ② **按 workspacePath 覆盖式落表**,不累积历史:界面要回答的是
 *     "这个工作区现在有没有可用检查点",不是事件日志。
 *  ③ **旧帧不得覆盖新事实**:生产面给 `at`(写链完成时刻),乱序到达的旧帧直接丢弃。
 */
import * as React from 'react'
import { subscribeUserBroadcast, type UserBroadcastConfig } from '@ihui/api-client'
import type { CheckpointAvailabilityEvent, CheckpointAvailabilityState } from '@ihui/types'

import { useAuthStore } from '@/stores/auth'

export interface CheckpointAvailabilityEntry {
  workspacePath: string
  state: CheckpointAvailabilityState
  /** `available` 时才有:刚可用的检查点 id */
  checkpointId?: string
  /** 技术性原因(诊断用,不是界面文案) */
  reason?: string
  at: string
}

const entries = new Map<string, CheckpointAvailabilityEntry>()
/**
 * 空表快照:模块级**单例**。getServerSnapshot 与初始 snapshot 必须是同一引用,
 * 否则 hydration 比较的是"两个都空但不同引用"的数组(与 D154 同一个坑)。
 */
const EMPTY_SNAPSHOT: readonly CheckpointAvailabilityEntry[] = Object.freeze(
  [] as CheckpointAvailabilityEntry[],
)
let snapshot: readonly CheckpointAvailabilityEntry[] = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

function publish(): void {
  snapshot = Object.freeze(
    [...entries.values()].sort((a, b) => a.workspacePath.localeCompare(b.workspacePath)),
  )
  for (const l of listeners) l()
}

/**
 * 落一帧(导出以便单测直接喂事件,不经 WS)。
 *
 * @returns 该帧是否改变了表(`false` ⇒ 重复帧或乱序旧帧,不触发重渲染)
 */
export function applyCheckpointAvailabilityEvent(evt: CheckpointAvailabilityEvent): boolean {
  const { workspacePath, state, checkpointId, reason, at } = evt.data
  const prev = entries.get(workspacePath)
  if (prev) {
    const prevAt = Date.parse(prev.at)
    const nextAt = Date.parse(at)
    // 旧帧(严格早于已知事实)不得覆盖;同一时刻的重复帧按内容判
    if (!Number.isNaN(prevAt) && !Number.isNaN(nextAt) && nextAt < prevAt) return false
    if (prev.state === state && prev.checkpointId === checkpointId && prev.at === at) return false
  }
  const next: CheckpointAvailabilityEntry = {
    workspacePath,
    state,
    at,
    ...(checkpointId !== undefined ? { checkpointId } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
  entries.set(workspacePath, next)
  publish()
  return true
}

export function getCheckpointAvailabilitySnapshot(): readonly CheckpointAvailabilityEntry[] {
  return snapshot
}

/** 订阅状态表变化(useSyncExternalStore 的 subscribe) */
export function subscribeCheckpointAvailability(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 清空(登出/单测隔离用:广播面不会自己清空,登出后留着别人的工作区名是错的) */
export function clearCheckpointAvailability(): void {
  if (entries.size === 0) return
  entries.clear()
  publish()
}

/**
 * 订阅 `checkpoint:availability` 并返回当前工作区那一行。
 *
 * 与 D153/D154 的消费者共用同一条连接(hub 内引用计数),`close()` 只减计数。
 */
export function useCheckpointAvailability(workspacePath: string): {
  entry: CheckpointAvailabilityEntry | null
  connected: boolean
  undetermined: number
} {
  const token = useAuthStore((s) => s.token)
  const [undetermined, setUndetermined] = React.useState(0)
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    if (!token) return
    if (typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: window.location.origin,
      tokenProvider: () => useAuthStore.getState().token,
    }
    const sub = subscribeUserBroadcast(config, {
      'checkpoint:availability': (evt) => {
        applyCheckpointAvailabilityEvent(evt as CheckpointAvailabilityEvent)
      },
      onUndetermined: () => setUndetermined((n) => n + 1),
      onState: (s) => setConnected(s === 'open'),
    })
    return () => sub.close()
  }, [token])

  React.useEffect(() => {
    if (!token) clearCheckpointAvailability()
  }, [token])

  const table = React.useSyncExternalStore(
    subscribeCheckpointAvailability,
    getCheckpointAvailabilitySnapshot,
    () => EMPTY_SNAPSHOT,
  )

  const wanted = workspacePath.trim()
  const entry = wanted ? (table.find((e) => e.workspacePath === wanted) ?? null) : null
  return { entry, connected, undetermined }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
