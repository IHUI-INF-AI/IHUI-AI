// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 定时任务回归：
 *  - metadata 是共享字段，写回任务时绝不能冲掉白名单/限流/指令开关（最容易出事的一处）；
 *  - 到点判定必须「当天只跑一次」，否则服务重启会重复群发；
 *  - 单个任务失败不能打断整轮扫描。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  select: vi.fn(),
  updateSet: vi.fn(),
  broadcast: vi.fn(),
  report: vi.fn(),
  send: vi.fn(),
  moment: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  dbRead: { select: hoisted.select },
  db: { update: () => ({ set: hoisted.updateSet }) },
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: async () => ({ id: 'acc-1', label: '测试号' }),
}))
vi.mock('../wechat-hub/broadcast.js', () => ({ broadcast: hoisted.broadcast }))
vi.mock('../wechat-hub/reports.js', () => ({ buildReport: hoisted.report }))
vi.mock('../wechat-hub/manager.js', () => ({ wechatHubManager: { send: hoisted.send } }))
vi.mock('../wechat-hub/operations.js', () => ({ publishMoment: hoisted.moment }))

import { isJobDue, runDueJobs, saveJob } from '../wechat-hub/jobs'
import type { WechatJobView } from '@ihui/types'

/** 现在：2026-11-26 09:30（Asia/Shanghai，周四） */
const NOW = new Date('2026-11-26T01:30:00Z')

function job(overrides: Partial<WechatJobView> = {}): WechatJobView {
  return {
    id: 'job-1',
    kind: 'broadcast',
    enabled: true,
    hour: 9,
    minute: 30,
    timezone: 'Asia/Shanghai',
    weekly: null,
    payload: { text: '早上好' },
    lastRunAt: null,
    lastRunDay: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function chain(result: unknown) {
  const node = {
    from: () => node,
    where: () => node,
    limit: () => node,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return node
}

beforeEach(() => {
  hoisted.select.mockReset()
  hoisted.updateSet.mockReset()
  hoisted.broadcast.mockReset()
  hoisted.report.mockReset()
  hoisted.send.mockReset()
  hoisted.moment.mockReset()
  hoisted.updateSet.mockReturnValue({ where: () => chain(undefined) })
})

describe('isJobDue', () => {
  it('正好命中设定分钟才算到点', () => {
    expect(isJobDue(job(), NOW)).toBe(true)
    expect(isJobDue(job({ minute: 31 }), NOW)).toBe(false)
  })

  it('当天已跑过就不再跑（重启不补发）', () => {
    expect(isJobDue(job({ lastRunDay: '2026-11-26' }), NOW)).toBe(false)
  })

  it('weekly 不匹配跳过，匹配才跑', () => {
    // 2026-11-26 是周四 = 4
    expect(isJobDue(job({ weekly: 4 }), NOW)).toBe(true)
    expect(isJobDue(job({ weekly: 1 }), NOW)).toBe(false)
  })

  it('停用的任务一律不跑', () => {
    expect(isJobDue(job({ enabled: false }), NOW)).toBe(false)
  })
})

describe('saveJob', () => {
  it('写回时只替换 jobs，白名单/限流/指令开关原样保留', async () => {
    const metadata = {
      allowedTargets: ['wxid_a'],
      rateLimitPerMinute: 12,
      commands: { enabled: true, groupEnabled: false, disabled: ['report'] },
      jobs: [],
    }
    hoisted.select.mockReturnValueOnce(chain([{ metadata }]))

    const saved = await saveJob('u1', 'acc-1', {
      kind: 'broadcast',
      hour: 9,
      minute: 30,
      payload: { text: '早上好' },
    })

    const written = hoisted.updateSet.mock.calls[0]?.[0] as { metadata: Record<string, unknown> }
    expect(written.metadata.allowedTargets).toEqual(['wxid_a'])
    expect(written.metadata.rateLimitPerMinute).toBe(12)
    expect(written.metadata.commands).toEqual({
      enabled: true,
      groupEnabled: false,
      disabled: ['report'],
    })
    const jobs = written.metadata.jobs as Array<{ id: string }>
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.id).toBe(saved.id)
  })

  it('群发缺正文 / 报告缺类型都直接 400', async () => {
    hoisted.select.mockReturnValue(chain([{ metadata: { jobs: [] } }]))
    await expect(saveJob('u1', 'acc-1', { kind: 'broadcast', payload: {} })).rejects.toMatchObject({
      errorCode: 'WECHAT_JOB_EMPTY_CONTENT',
    })
    await expect(saveJob('u1', 'acc-1', { kind: 'report', payload: {} })).rejects.toMatchObject({
      errorCode: 'WECHAT_JOB_NO_REPORT_KIND',
    })
    await expect(saveJob('u1', 'acc-1', { kind: 'moment', payload: {} })).rejects.toMatchObject({
      errorCode: 'WECHAT_JOB_EMPTY_MOMENT',
    })
    // 只发图不写字是合法的
    const saved = await saveJob('u1', 'acc-1', {
      kind: 'moment',
      payload: { mediaUrls: ['https://a.jpg'] },
    })
    expect(saved.kind).toBe('moment')
  })
})

describe('runDueJobs', () => {
  it('一个任务失败不影响同批其它任务，且执行前先落 lastRunDay', async () => {
    const failing = job({ id: 'job-bad', kind: 'broadcast' })
    const okReport = job({
      id: 'job-report',
      kind: 'report',
      payload: { reportKind: 'annual', targets: ['wxid_a'] },
    })
    hoisted.select.mockReturnValueOnce(
      chain([{ id: 'acc-1', userId: 'u1', metadata: { jobs: [failing, okReport] } }]),
    )

    hoisted.broadcast.mockRejectedValueOnce(new Error('目标为空'))
    hoisted.report.mockResolvedValueOnce({
      markdown: '## 活跃榜\n| 张三 | 2 |',
      stats: { messageCount: 4 },
    })
    hoisted.send.mockResolvedValueOnce({
      ok: true,
      status: 'delivered',
      platformMessageId: 'p1',
      reason: null,
      attempts: 1,
      rejectedBy: null,
    })

    const results = await runDueJobs(NOW)

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ jobId: 'job-bad', ok: false })
    expect(results[1]).toMatchObject({ jobId: 'job-report', ok: true })

    // 抢占闸：写回时两个任务都带了今天的 lastRunDay
    const written = hoisted.updateSet.mock.calls[0]?.[0] as {
      metadata: { jobs: Array<{ id: string; lastRunDay: string }> }
    }
    expect(written.metadata.jobs.every((item) => item.lastRunDay === '2026-11-26')).toBe(true)
  })

  it('没有到期任务时不写库', async () => {
    hoisted.select.mockReturnValueOnce(
      chain([{ id: 'acc-1', userId: 'u1', metadata: { jobs: [job({ minute: 5 })] } }]),
    )
    const results = await runDueJobs(NOW)
    expect(results).toHaveLength(0)
    expect(hoisted.updateSet).not.toHaveBeenCalled()
  })

  it('定时朋友圈到点调 publishMoment，正文与媒体原样透传', async () => {
    hoisted.select.mockReturnValueOnce(
      chain([
        {
          id: 'acc-1',
          userId: 'u1',
          metadata: {
            jobs: [
              job({
                id: 'job-moment',
                kind: 'moment',
                payload: { text: '周末见', mediaUrls: ['https://a.jpg', 'https://b.mp4'] },
              }),
            ],
          },
        },
      ]),
    )
    hoisted.moment.mockResolvedValueOnce({ ok: true, reason: null })

    const results = await runDueJobs(NOW)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ jobId: 'job-moment', ok: true })
    expect(hoisted.moment).toHaveBeenCalledTimes(1)
    const [, accountId, input] = hoisted.moment.mock.calls[0] as [
      string,
      string,
      { text: string; mediaUrls: string[] },
    ]
    expect(accountId).toBe('acc-1')
    expect(input.text).toBe('周末见')
    expect(input.mediaUrls).toEqual(['https://a.jpg', 'https://b.mp4'])
  })

  it('朋友圈发布失败只记该任务，不算成功', async () => {
    hoisted.select.mockReturnValueOnce(
      chain([
        {
          id: 'acc-1',
          userId: 'u1',
          metadata: {
            jobs: [job({ id: 'job-moment', kind: 'moment', payload: { text: '周末见' } })],
          },
        },
      ]),
    )
    hoisted.moment.mockResolvedValueOnce({ ok: false, reason: '账号离线' })

    const results = await runDueJobs(NOW)
    expect(results[0]).toMatchObject({ jobId: 'job-moment', ok: false, detail: '账号离线' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
