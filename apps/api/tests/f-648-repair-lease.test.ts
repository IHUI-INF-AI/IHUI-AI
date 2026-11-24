// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-648 回归锁(2026-11-13)。
 *
 * 病灶:claim 置 claimed 后释放互斥锁,executeClaimed 再置 running 执行长任务;
 * 状态机对 claimed/running 一律不可领,且无租约/心跳/超时回收 —— 执行器 OOM 或
 * 进程重启后任务永久停在 claimed/running,每轮扫描跳过,自动修复静默失效。
 *
 * 本文件锁:
 *   ① claimed 超租约 ⇒ runCycle 开头回收为 pending(审计可查);
 *   ② running 超租约 ⇒ 同样回收,attempts 保留;
 *   ③ 未超租约不回收;
 *   ④ claim/transition 进入 claimed/running 时写入未来 leaseUntil 与 heartbeatAt;
 *   ⑤ 执行期心跳续租会顺延 leaseUntil。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  REPAIR_TASK_LEASE_MS,
  createAutomationRepairService,
  createRepairTaskStore,
  type ClaimMutex,
  type RepairTaskStore,
} from '../src/services/automation-repair-service.js'
import type { FixExecutor, ScanItem } from '../src/services/automations/types.js'

const START = new Date('2026-11-13T00:00:00.000Z')

function scanItem(n: number): ScanItem {
  return {
    key: `code-scanning:${n}`,
    source: 'code-scanning',
    title: `告警 #${n}`,
    detail: 'injected',
    url: null,
    issueNumber: null,
  }
}

function makeMutex(): ClaimMutex {
  return {
    async tryLock() {
      return 'tok-test'
    },
    async unlock() {
      /* noop */
    },
  }
}

function countingExecutor(): FixExecutor & { calls: number } {
  const exec = {
    name: 'stub',
    calls: 0,
    async execute() {
      exec.calls++
      return { ok: true as const, summary: '已修复' }
    },
  }
  return exec
}

function makeService(store: RepairTaskStore, executor: FixExecutor, batchLimit?: number) {
  return createAutomationRepairService({
    repo: 'o/r',
    store,
    mutex: makeMutex(),
    itemsProvider: async () => [],
    executor,
    reporter: {
      readiness: async () => ({ ok: false as const, reason: 'not_used' }),
      async postIssueComment() {
        return { posted: false, channel: 'issue-comment' as const, reason: 'not_used' }
      },
      async openPullRequest() {
        return { posted: false, channel: 'pull-request' as const, reason: 'not_used' }
      },
    },
    owner: 'w1',
    ...(batchLimit === undefined ? {} : { batchLimit }),
  })
}

let dir = ''
let storePath = ''

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  dir = mkdtempSync(join(tmpdir(), 'ihui-f648-lease-'))
  storePath = join(dir, 'tasks.json')
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('F-648 修复任务租约回收', () => {
  it('claimed 超租约:runCycle 开头回收为 pending,不再执行', async () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(scanItem(1), 'o/r', 3, 'system:ingest')
    store.transition('code-scanning:1', 'claimed', 'w1')
    expect(store.get('code-scanning:1')?.state).toBe('claimed')

    vi.setSystemTime(START.getTime() + REPAIR_TASK_LEASE_MS + 1_000)
    const executor = countingExecutor()
    // batchLimit=0:只验证回收,不触发重新领取
    await makeService(store, executor, 0).runCycle()

    const task = store.get('code-scanning:1')!
    expect(task.state).toBe('pending')
    expect(task.leaseUntil).toBeNull()
    expect(task.heartbeatAt).toBeNull()
    expect(task.history.at(-1)).toMatchObject({
      from: 'claimed',
      to: 'pending',
      by: 'system:lease-reclaim',
    })
    expect(executor.calls).toBe(0)
  })

  it('running 超租约:回收为 pending,attempts 保留', async () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(scanItem(2), 'o/r', 3, 'system:ingest')
    store.transition('code-scanning:2', 'claimed', 'w1')
    store.transition('code-scanning:2', 'running', 'w1')

    vi.setSystemTime(START.getTime() + REPAIR_TASK_LEASE_MS + 1_000)
    const executor = countingExecutor()
    await makeService(store, executor, 0).runCycle()

    const task = store.get('code-scanning:2')!
    expect(task.state).toBe('pending')
    expect(task.attempts).toBe(1)
    expect(task.history.at(-1)).toMatchObject({
      from: 'running',
      to: 'pending',
      by: 'system:lease-reclaim',
    })
    expect(executor.calls).toBe(0)
  })

  it('未超租约:claimed/running 均不回收', async () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(scanItem(3), 'o/r', 3, 'system:ingest')
    store.transition('code-scanning:3', 'claimed', 'w1')
    store.ingest(scanItem(4), 'o/r', 3, 'system:ingest')
    store.transition('code-scanning:4', 'claimed', 'w1')
    store.transition('code-scanning:4', 'running', 'w1')

    vi.setSystemTime(START.getTime() + REPAIR_TASK_LEASE_MS - 60_000)
    const executor = countingExecutor()
    await makeService(store, executor, 0).runCycle()

    expect(store.get('code-scanning:3')?.state).toBe('claimed')
    expect(store.get('code-scanning:4')?.state).toBe('running')
    expect(executor.calls).toBe(0)
  })

  it('领取时写入未来 leaseUntil 与 heartbeatAt', async () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(scanItem(5), 'o/r', 3, 'system:ingest')
    const svc = makeService(store, countingExecutor())

    const claimed = await svc.claim('code-scanning:5')
    expect(claimed.ok).toBe(true)

    const task = store.get('code-scanning:5')!
    expect(task.state).toBe('claimed')
    expect(task.heartbeatAt).toBe(START.toISOString())
    expect(task.leaseUntil).toBe(new Date(START.getTime() + REPAIR_TASK_LEASE_MS).toISOString())
    expect(Date.parse(task.leaseUntil!)).toBeGreaterThan(Date.now())
  })

  it('执行期心跳续租:renewLease 顺延 leaseUntil 并刷新 heartbeatAt', async () => {
    const store = createRepairTaskStore(storePath)
    store.ingest(scanItem(6), 'o/r', 3, 'system:ingest')
    store.transition('code-scanning:6', 'claimed', 'w1')

    const later = new Date(START.getTime() + 10 * 60_000)
    vi.setSystemTime(later)
    const renewed = store.renewLease('code-scanning:6')!
    expect(renewed.heartbeatAt).toBe(later.toISOString())
    expect(renewed.leaseUntil).toBe(new Date(later.getTime() + REPAIR_TASK_LEASE_MS).toISOString())
    expect(store.get('code-scanning:6')?.state).toBe('claimed')
  })
})
