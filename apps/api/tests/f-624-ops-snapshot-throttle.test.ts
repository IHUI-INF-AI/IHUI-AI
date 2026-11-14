// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-624 回归锁(2026-11-13)。
 *
 * 病灶:/ws/relay/ops 每个 socket 各自 buildRelayOpsSnapshot(每 15s 一帧),refresh 无节流;
 * 一个 admin token 连 N 个页面,就把每组 4 次大范围 llm_call_logs 聚合放大 N 倍。
 *
 * 本文件锁:
 *   ① 并发 3 次读取只触发 1 次重建,且共享同一份结果;
 *   ② TTL 内复用缓存,过期后首个请求才重建;
 *   ③ refresh 在最小间隔内不重建,窗口过后才重建;
 *   ④ 并发 refresh 单飞,复用同一 in-flight Promise;
 *   ⑤ 源锁:WS 推送走共享快照入口,refresh 走节流入口。
 *
 * DB/渠道路由/告警服务全部 mock,不触达真实 PG/Redis;重建函数用计数桩注入。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/services/relay-channel-router.js', () => ({
  getCircuitState: vi.fn(() => ({ state: 'closed', failureCount: 0, lastFailureAt: null })),
  getRecentCalls: vi.fn(() => []),
}))

vi.mock('../src/services/relay-alert-rules-service.js', () => ({
  listAlertRules: vi.fn(async () => []),
  listRecentAlertEvents: vi.fn(async () => []),
}))

import {
  createRelayOpsSnapshotCache,
  type RelayOpsSnapshot,
} from '../src/services/relay-ops-snapshot.js'

function makeSnapshot(): RelayOpsSnapshot {
  return {
    ts: new Date(1_700_000_000_000).toISOString(),
    alerts: { rules: [], events: [] },
    channels: { groups: [], stats: [] },
    usage: { overview: null },
  }
}

let clock = 1_700_000_000_000
const now = (): number => clock

/** 计数桩:每次 rebuild 加一,并返回新对象(便于断言是否复用同一份结果) */
function makeBuildStub(): { build: () => Promise<RelayOpsSnapshot>; calls: () => number } {
  let calls = 0
  return {
    build: async () => {
      calls += 1
      return makeSnapshot()
    },
    calls: () => calls,
  }
}

describe('F-624 运维快照共享缓存 / refresh 节流与单飞', () => {
  beforeEach(() => {
    clock = 1_700_000_000_000
  })

  it('并发 3 次读取只重建 1 次,且共享同一份结果', async () => {
    const stub = makeBuildStub()
    const cache = createRelayOpsSnapshotCache({ now, build: stub.build })

    const results = await Promise.all([cache.get(), cache.get(), cache.get()])

    expect(stub.calls()).toBe(1)
    expect(new Set(results).size).toBe(1)
  })

  it('TTL 内复用缓存,过期后首个请求才重建', async () => {
    const stub = makeBuildStub()
    const cache = createRelayOpsSnapshotCache({ now, ttlMs: 5_000, build: stub.build })

    const first = await cache.get()
    clock += 4_999
    expect(await cache.get()).toBe(first)
    expect(stub.calls()).toBe(1)

    clock += 1
    const second = await cache.get()
    expect(second).not.toBe(first)
    expect(stub.calls()).toBe(2)
  })

  it('refresh 在最小间隔内不重建,窗口过后才重建', async () => {
    const stub = makeBuildStub()
    const cache = createRelayOpsSnapshotCache({
      now,
      refreshMinIntervalMs: 1_000,
      build: stub.build,
    })

    const first = await cache.get()
    expect(stub.calls()).toBe(1)

    clock += 999
    expect(await cache.refresh()).toBe(first)
    expect(stub.calls()).toBe(1)

    clock += 1
    const second = await cache.refresh()
    expect(second).not.toBe(first)
    expect(stub.calls()).toBe(2)
  })

  it('并发 refresh 单飞:复用同一 in-flight Promise', async () => {
    let release!: (snapshot: RelayOpsSnapshot) => void
    let calls = 0
    const build = (): Promise<RelayOpsSnapshot> => {
      calls += 1
      return new Promise((resolve) => {
        release = resolve
      })
    }
    const cache = createRelayOpsSnapshotCache({ now, build })

    const pending = [cache.refresh(), cache.refresh(), cache.refresh()]
    expect(calls).toBe(1)

    const snapshot = makeSnapshot()
    release(snapshot)
    const results = await Promise.all(pending)

    expect(calls).toBe(1)
    for (const result of results) expect(result).toBe(snapshot)
  })
})

const PLUGIN_SOURCE = readFileSync(
  fileURLToPath(new URL('../src/plugins/ws-relay-ops.ts', import.meta.url)),
  'utf8',
)

describe('F-624 源锁', () => {
  it('WS 推送走共享缓存模式,refresh 走节流模式', () => {
    expect(PLUGIN_SOURCE).toMatch(
      /buildRelayOpsSnapshot\(\{ mode: isRefresh \? 'refresh' : 'cached' \}\)/,
    )
    expect(PLUGIN_SOURCE).not.toMatch(/buildRelayOpsSnapshot\(\)/)
  })
})
