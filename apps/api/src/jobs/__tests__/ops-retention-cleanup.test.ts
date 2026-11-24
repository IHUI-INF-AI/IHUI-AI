// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 121 接线行为锁(2026-11-01):ops-retention-cleanup 是四族「写了保留策略却无人执行」
// 的清理函数唯一触发点。本套件钉三件事:
//  ① 作业真把四族都调到了(且各族失败互不吞);
//  ② 计时器只有一枚、形态与 jobs/pii-retention-cleanup.ts 同族(cron + start/stop 成对);
//  ③ 触发点在服务器启动路径上真被注册、关闭路径上真被停止(读 src/index.ts 的注册面)。
// 判据不在本文件复算(§22c):批上界/删除谓词由各族自己的用例钉
// (tests/outbox.test.ts、src/db/__tests__/captcha-queries.test.ts、
//  tests/retention-batch-limit.test.ts)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { mockCaptcha, mockShares, mockQuota, mockCache, mockSchedule, mockStop } = vi.hoisted(
  () => ({
    mockCaptcha: vi.fn(),
    mockShares: vi.fn(),
    mockQuota: vi.fn(),
    mockCache: vi.fn(),
    mockSchedule: vi.fn(),
    mockStop: vi.fn(),
  }),
)

vi.mock('node-cron', () => ({
  default: { schedule: mockSchedule },
  schedule: mockSchedule,
}))

vi.mock('../../db/captcha-queries.js', () => ({ cleanupExpiredCaptchas: mockCaptcha }))
vi.mock('../../services/api-key-share-service.js', () => ({ cleanupExpired: mockShares }))
vi.mock('../../services/channel-quota-service.js', () => ({ resetDailyQuota: mockQuota }))
vi.mock('../../services/storage-service.js', () => ({ cleanupCache: mockCache }))
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  runOpsRetentionCleanup,
  startOpsRetentionScheduler,
  stopOpsRetentionScheduler,
} from '../ops-retention-cleanup.js'

/** 四族全成功的默认桩。 */
function stubAllOk() {
  mockCaptcha.mockResolvedValue(11)
  mockShares.mockResolvedValue(3)
  mockQuota.mockResolvedValue(5)
  mockCache.mockReturnValue(2)
}

afterEach(() => {
  // 模块作用域的 scheduledTask 会跨用例残留:每轮收尾都显式停表,保证下一条用例从"未启动"起
  stopOpsRetentionScheduler()
})

describe('runOpsRetentionCleanup — 四族都真被调到', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('逐族清理并按稳定标识上报条数(outbox 一族不在本面:它挂 30s 排空轮)', async () => {
    stubAllOk()

    const results = await runOpsRetentionCleanup()

    expect(mockCaptcha).toHaveBeenCalledTimes(1)
    expect(mockShares).toHaveBeenCalledTimes(1)
    expect(mockQuota).toHaveBeenCalledTimes(1)
    expect(mockCache).toHaveBeenCalledTimes(1)
    expect(results).toEqual([
      { target: 'captchas', cleaned: 11, status: 'success' },
      { target: 'api_key_shares', cleaned: 3, status: 'success' },
      { target: 'ai_relay_channel_daily_usage', cleaned: 5, status: 'success' },
      { target: 'storage_cache', cleaned: 2, status: 'success' },
    ])
  })

  it('单族抛错只记该族 error,其余三族照常清理(不互相吞)', async () => {
    stubAllOk()
    mockShares.mockRejectedValue(new Error('share db down'))

    const results = await runOpsRetentionCleanup()

    expect(results.find((r) => r.target === 'api_key_shares')).toEqual({
      target: 'api_key_shares',
      cleaned: 0,
      status: 'error',
    })
    expect(results.filter((r) => r.status === 'success')).toHaveLength(3)
    expect(mockQuota).toHaveBeenCalledTimes(1)
    expect(mockCache).toHaveBeenCalledTimes(1)
  })
})

describe('调度器 — 一枚计时器 + 成对 start/stop(形态照抄 pii-retention-cleanup)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('start 注册每天 05:30 Asia/Shanghai 的一枚 cron,回调跑一轮四族清理', () => {
    stubAllOk()
    mockSchedule.mockReturnValue({ stop: mockStop })

    startOpsRetentionScheduler()

    expect(mockSchedule).toHaveBeenCalledTimes(1)
    expect(mockSchedule.mock.calls[0]![0]).toBe('30 5 * * *')
    expect(mockSchedule.mock.calls[0]![2]).toEqual({ timezone: 'Asia/Shanghai' })

    const tick = mockSchedule.mock.calls[0]![1] as () => Promise<void>
    return tick().then(() => {
      expect(mockCaptcha).toHaveBeenCalledTimes(1)
      expect(mockCache).toHaveBeenCalledTimes(1)
    })
  })

  it('重复 start 不再加第二枚计时器;stop 停表后可再起', async () => {
    stubAllOk()
    mockSchedule.mockReturnValue({ stop: mockStop })

    startOpsRetentionScheduler()
    startOpsRetentionScheduler()
    expect(mockSchedule).toHaveBeenCalledTimes(1)

    stopOpsRetentionScheduler()
    expect(mockStop).toHaveBeenCalledTimes(1)

    startOpsRetentionScheduler()
    expect(mockSchedule).toHaveBeenCalledTimes(2)
  })
})

describe('启动/关闭路径接线(门 121 的"装车"判据)', () => {
  const indexSrc = readFileSync(fileURLToPath(new URL('../../index.ts', import.meta.url)), 'utf8')

  it('index.ts 在 startBackgroundSchedulers 里注册 startOpsRetentionScheduler', () => {
    const from = indexSrc.indexOf('function startBackgroundSchedulers')
    const next = indexSrc.indexOf('\nasync function', from)
    const scoped = indexSrc.slice(from, next === -1 ? indexSrc.length : next)
    expect(from).toBeGreaterThan(-1)
    expect(scoped).toContain('startOpsRetentionScheduler()')
    expect(indexSrc).toContain("from './jobs/ops-retention-cleanup.js'")
  })

  it('index.ts 的 shutdown 相位清单里有 stopOpsRetentionScheduler', () => {
    expect(indexSrc).toContain(
      "syncStopPhase('stopOpsRetentionScheduler', stopOpsRetentionScheduler)",
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
