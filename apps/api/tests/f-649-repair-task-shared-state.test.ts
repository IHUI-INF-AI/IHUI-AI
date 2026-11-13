// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-649 回归锁(2026-11-14)。
 *
 * 病灶:修复任务状态的权威是每进程各一份 JSON 文件快照(启动加载一次、每次整文件
 * 覆盖),跨实例互斥锁只保护认领窗口。多实例部署下 B 的过期 pending 快照会把 A
 * 已 claimed/fixed 的状态整份覆盖 ⇒ 重复开 PR/回帖、完成状态丢失。
 *
 * 本文件锁:
 *   ① 状态以跨实例共享权威源(Redis Hash 语义)为准,同 key 并发摄入只落一条;
 *   ② 两个实例并发认领同一任务只有一个成功,另一个按权威源现状态判 in_progress;
 *   ③ 状态更新是原子条件写:过期快照的写入被拒,attempts/history 零覆盖;
 *   ④ 进程重启(新实例、全新文件路径)后从共享源读回终态,不再重复执行。
 *
 * 只注入内存共享源 + fake mutex,不连真实 Redis/DB/网络。
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createAutomationRepairService,
  createRepairTaskStore,
  type ClaimMutex,
  type SharedRepairTaskState,
} from '../src/services/automation-repair-service.js'
import type { FixExecutor, ScanItem } from '../src/services/automations/types.js'
import type { RepairTaskRecord } from '@ihui/types'

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 内存版共享权威源:transition 的"状态不在 expected 内即拒绝"与 Redis CAS 同语义。 */
function createFakeSharedState(): {
  state: SharedRepairTaskState
  records: Map<string, RepairTaskRecord>
} {
  const records = new Map<string, RepairTaskRecord>()

  const transition = async (
    key: string,
    expected: readonly RepairTaskRecord['state'][],
    mutate: (current: RepairTaskRecord) => RepairTaskRecord,
  ): Promise<RepairTaskRecord | null> => {
    const current = records.get(key)
    if (!current) return null
    // 条件写:快照已过期(他实例先改了)⇒ 整体拒绝,不覆盖任何字段
    if (!expected.includes(current.state)) return null
    const next = mutate(clone(current))
    records.set(key, clone(next))
    return clone(next)
  }

  const state: SharedRepairTaskState = {
    async load(key) {
      const task = records.get(key)
      return task ? clone(task) : null
    },
    async list(states) {
      return [...records.values()]
        .filter((task) => !states || states.includes(task.state))
        .map(clone)
    },
    async createIfAbsent(task) {
      const existing = records.get(task.key)
      if (existing) return { task: clone(existing), created: false }
      records.set(task.key, clone(task))
      return { task: clone(task), created: true }
    },
    transition,
    async renewLease(key) {
      return transition(key, ['claimed', 'running'], (current) => ({
        ...current,
        leaseUntil: new Date(Date.now() + 60_000).toISOString(),
        heartbeatAt: new Date().toISOString(),
      }))
    },
  }
  return { state, records }
}

/** 全放行互斥锁:本用例要验证的是状态条件写,不是 Redis 锁本身。 */
function allowAllMutex(): ClaimMutex {
  let seq = 0
  return {
    async tryLock() {
      return `tok-${++seq}`
    },
    async unlock() {},
  }
}

function issueItem(n: number): ScanItem {
  return {
    key: `issue:${n}`,
    source: 'issue',
    title: `崩溃:提交表单空指针 #${n}`,
    detail: 'TypeError: cannot read properties of undefined',
    url: `https://github.com/o/r/issues/${n}`,
    issueNumber: n,
  }
}

function okExecutor(): FixExecutor & { executed: string[] } {
  const executed: string[] = []
  return {
    name: 'stub',
    executed,
    async execute(task) {
      executed.push(task.key)
      return { ok: true, summary: '已定位并修复空指针' }
    },
  }
}

function makeReporter() {
  return {
    readiness: async () => ({ ok: false as const, reason: 'n/a' }),
    async postIssueComment() {
      return { posted: true, channel: 'issue-comment' as const }
    },
    async openPullRequest() {
      return { posted: false, channel: 'pull-request' as const, reason: 'not_used' }
    },
  }
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'ihui-f649-'))
}

function buildService(opts: {
  shared: SharedRepairTaskState
  dir: string
  owner: string
  items: ScanItem[]
}): { service: ReturnType<typeof createAutomationRepairService>; executor: ReturnType<typeof okExecutor> } {
  const executor = okExecutor()
  const service = createAutomationRepairService({
    repo: 'o/r',
    store: createRepairTaskStore(join(opts.dir, 'tasks.json')),
    shared: opts.shared,
    mutex: allowAllMutex(),
    itemsProvider: async () => opts.items,
    executor,
    reporter: makeReporter(),
    owner: opts.owner,
  })
  return { service, executor }
}

// ---------------------------------------------------------------------------
// 回归
// ---------------------------------------------------------------------------

describe('F-649 修复任务共享权威状态', () => {
  it('两实例并发摄入/认领同一任务:只落一条,只有一个认领成功', async () => {
    const { state, records } = createFakeSharedState()
    const a = buildService({ shared: state, dir: tempDir(), owner: 'inst-a', items: [issueItem(1)] })
    const b = buildService({ shared: state, dir: tempDir(), owner: 'inst-b', items: [issueItem(1)] })

    const created = await Promise.all([a.service.ingestPending(), b.service.ingestPending()])
    expect(created[0] + created[1]).toBe(1)
    expect(records.size).toBe(1)

    const results = await Promise.all([a.service.claim('issue:1'), b.service.claim('issue:1')])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    const winner = results.find((r) => r.ok)!
    const loser = results.find((r) => !r.ok)!
    expect(winner.task?.state).toBe('claimed')
    expect(loser.reason).toBe('in_progress')
    expect(records.get('issue:1')?.state).toBe('claimed')
    // 只有一次 claimed 迁移被写入,没有第二个实例的回帖/执行入口
    expect(records.get('issue:1')?.history.filter((h) => h.to === 'claimed')).toHaveLength(1)
  })

  it('状态更新是条件写:过期 pending 快照不能覆盖已 fixed 的记录', async () => {
    const { state } = createFakeSharedState()
    const a = buildService({ shared: state, dir: tempDir(), owner: 'inst-a', items: [issueItem(2)] })
    expect(await a.service.ingestPending()).toBe(1)
    // B 实例在此刻读到的过期快照(pending)
    const stale = await state.load('issue:2')
    expect(stale?.state).toBe('pending')

    expect((await a.service.runNext())?.ok).toBe(true)
    const before = await state.load('issue:2')
    expect(before?.state).toBe('fixed')
    expect(before?.attempts).toBe(1)

    // B 拿过期快照写 claimed:前置状态条件不满足 ⇒ 拒绝,attempts/history 零覆盖
    const overwritten = await state.transition('issue:2', [stale!.state], (current) => ({
      ...current,
      state: 'claimed',
      attempts: 0,
      history: [],
    }))
    expect(overwritten).toBeNull()
    const after = await state.load('issue:2')
    expect(after?.state).toBe('fixed')
    expect(after?.attempts).toBe(1)
    expect(after?.history).toEqual(before?.history)
  })

  it('进程重启(新实例、全新文件路径)后从共享源读回终态,不重复执行', async () => {
    const { state } = createFakeSharedState()
    const a = buildService({ shared: state, dir: tempDir(), owner: 'inst-a', items: [issueItem(3)] })
    expect(await a.service.ingestPending()).toBe(1)
    expect((await a.service.runNext())?.ok).toBe(true)
    expect(a.executor.executed).toEqual(['issue:3'])

    // 新实例:本地文件快照为空(全新目录),状态只能从共享权威源恢复
    const b = buildService({ shared: state, dir: tempDir(), owner: 'inst-b', items: [] })
    await b.service.hydrate()
    expect(b.service.getTask('issue:3')?.state).toBe('fixed')
    expect(b.service.listTasks('fixed')).toHaveLength(1)
    expect(await b.service.runNext()).toBeNull()
    expect(b.executor.executed).toHaveLength(0)
  })
})
