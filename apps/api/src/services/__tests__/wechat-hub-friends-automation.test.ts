// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 好友/进群申请自动化闸回归：
 *  - 策略默认关闭，写路径在策略开关 / 频次 / 申请存在性三道闸上依次拒绝；
 *  - 扫描是读路径，桥 disabled / 超时抛错 / 失败结果三态都折算成视图，绝不抛 500；
 *  - 审计无论成败都落 metadata，成功才占一小时额度，保留最近 20 条；
 *  - DB / guard / manager 全部桩掉，不连真桥、不连真库。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  WechatActionResult,
  WechatFriendAuditEntry,
  WechatFriendsPolicy,
} from '@ihui/types'

const hoisted = vi.hoisted(() => ({
  performAction: vi.fn(),
  patchMetadata: vi.fn(),
  account: { id: 'acc-1', userId: 'u1', metadata: {} as Record<string, unknown> },
}))

vi.mock('../../db/index.js', () => ({
  dbRead: { select: vi.fn() },
  db: { update: () => ({ set: vi.fn() }) },
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: async () => hoisted.account,
}))
vi.mock('../wechat-hub/account-store.js', () => ({
  patchAccountMetadata: hoisted.patchMetadata,
}))
vi.mock('../wechat-hub/manager.js', () => ({
  wechatHubManager: { performAction: hoisted.performAction },
}))

import {
  acceptFriendRequest,
  readFriendsAudit,
  readFriendsOverview,
  readFriendsPolicy,
  readFriendsPolicyView,
  scanFriendRequests,
  updateFriendsPolicy,
  FRIENDS_AUDIT_KEEP,
} from '../wechat-hub/friends-automation.js'

const NOW = Date.now()

function bridgeActionResult(overrides: Partial<WechatActionResult>): WechatActionResult {
  return { ok: false, status: 'failed', data: {}, reason: null, ...overrides }
}

function scanBridgeResult(requests: unknown[], extra: Record<string, unknown> = {}): WechatActionResult {
  return bridgeActionResult({
    ok: true,
    status: 'accepted',
    data: { status: 'ok', requests, scannedAt: NOW, rawCount: requests.length, ...extra },
  })
}

function seedAudit(
  entries: Array<Partial<WechatFriendAuditEntry>>,
  ageMs = 1000,
): WechatFriendAuditEntry[] {
  return entries.map((entry, index) => ({
    at: NOW - ageMs - index * 1000,
    requestId: entry.requestId ?? `req-${index}`,
    nickname: entry.nickname ?? '',
    ok: entry.ok ?? false,
    status: entry.status ?? 'failed',
    errorCode: entry.errorCode ?? null,
  }))
}

function setMetadata(metadata: Record<string, unknown>): void {
  hoisted.account.metadata = metadata
}

beforeEach(() => {
  hoisted.performAction.mockReset()
  hoisted.patchMetadata.mockReset()
  hoisted.patchMetadata.mockResolvedValue(undefined)
  setMetadata({})
})

describe('readFriendsPolicy', () => {
  it('缺省默认关闭：每小时 3 个、每 24 小时 10 个、间隔 60 秒', () => {
    expect(readFriendsPolicy(undefined)).toEqual({
      enabled: false,
      maxAcceptsPerHour: 3,
      maxAcceptsPerDay: 10,
      minGapSeconds: 60,
    })
    expect(readFriendsPolicy({ friendAutomation: null })).toEqual({
      enabled: false,
      maxAcceptsPerHour: 3,
      maxAcceptsPerDay: 10,
      minGapSeconds: 60,
    })
  })

  it('非法类型回落缺省，越界数值夹到边界', () => {
    const policy = readFriendsPolicy({
      friendAutomation: { enabled: 'yes', maxAcceptsPerHour: 99, maxAcceptsPerDay: 999, minGapSeconds: -5 },
    })
    expect(policy.enabled).toBe(false)
    expect(policy.maxAcceptsPerHour).toBe(10)
    expect(policy.maxAcceptsPerDay).toBe(50)
    expect(policy.minGapSeconds).toBe(0)
    const lower = readFriendsPolicy({ friendAutomation: { maxAcceptsPerHour: 0, maxAcceptsPerDay: 0 } })
    expect(lower.maxAcceptsPerHour).toBe(1)
    expect(lower.maxAcceptsPerDay).toBe(1)
  })
})

describe('scanFriendRequests（读路径）', () => {
  it('桥在线时归一化待处理申请，字段别名兜底', async () => {
    hoisted.performAction.mockResolvedValue(
      scanBridgeResult([
        { requestId: 'r1', nickname: '张三', source: '手机通讯录', kind: 'friend', clickable: true, seenAt: NOW - 5000 },
        { requestId: 'r2', nickname: '某群', source: '群聊分享', kind: 'group-invite', clickable: false },
        { requestId: '', nickname: '脏条目' },
      ]),
    )
    const view = await scanFriendRequests('u1', 'acc-1')
    expect(view.status).toBe('ok')
    expect(view.ok).toBe(true)
    expect(view.rawCount).toBe(3)
    expect(view.requests).toEqual([
      { requestId: 'r1', nickname: '张三', nicknameSource: 'control', source: '手机通讯录', kind: 'friend', clickable: true, seenAt: NOW - 5000 },
      { requestId: 'r2', nickname: '某群', nicknameSource: 'control', source: '群聊分享', kind: 'group-invite', clickable: false, seenAt: expect.any(Number) },
    ])
  })

  it('桥开关关闭时折成 disabled，requests 为空', async () => {
    hoisted.performAction.mockResolvedValue(
      bridgeActionResult({
        ok: false,
        data: { status: 'disabled', reason: 'friends-automation-off' },
      }),
    )
    const view = await scanFriendRequests('u1', 'acc-1')
    expect(view).toMatchObject({ status: 'disabled', ok: false, requests: [] })
    expect(view.reason).toBe('friends-automation-off')
  })

  it('桥抛错（超时/离线）折成 failed，不抛 500', async () => {
    hoisted.performAction.mockRejectedValue(new Error('AbortError: timed out'))
    const view = await scanFriendRequests('u1', 'acc-1')
    expect(view.status).toBe('failed')
    expect(view.ok).toBe(false)
    expect(view.reason).toContain('timed out')
    expect(view.requests).toEqual([])
  })

  it('桥返回失败结果折成 failed 并带上原因', async () => {
    hoisted.performAction.mockResolvedValue(
      bridgeActionResult({ ok: false, reason: 'HTTP 502: bad gateway', data: { rawCount: 0 } }),
    )
    const view = await scanFriendRequests('u1', 'acc-1')
    expect(view).toMatchObject({ status: 'failed', ok: false, reason: 'HTTP 502: bad gateway' })
  })

  it('窗口收起时桥回上次快照：透传 stale 与快照年龄，仍算 ok', async () => {
    hoisted.performAction.mockResolvedValue(
      scanBridgeResult([{ requestId: 'r1', nickname: '张三', clickable: true }], {
        stale: true,
        staleReason: 'window-hidden',
        cacheAgeMs: 42000,
        cached: true,
      }),
    )
    const view = await scanFriendRequests('u1', 'acc-1')
    expect(view.ok).toBe(true)
    expect(view.stale).toBe(true)
    expect(view.staleReason).toBe('window-hidden')
    expect(view.cacheAgeMs).toBe(42000)
    expect(view.requests[0]?.nickname).toBe('张三')
  })

  it('窗口收起且无历史快照：折 failed，但原因翻成人话', async () => {
    hoisted.performAction.mockResolvedValue(
      bridgeActionResult({ ok: false, reason: 'window-hidden-or-empty', data: { rawCount: 0 } }),
    )
    const view = await scanFriendRequests('u1', 'acc-1')
    expect(view.status).toBe('failed')
    expect(view.reason).toContain('微信窗口已收起')
  })
})

describe('acceptFriendRequest（写路径四道闸）', () => {
  it('策略默认关闭：403 + WECHAT_FRIENDS_DISABLED，不调桥，留失败审计', async () => {
    setMetadata({ friendAutomation: { enabled: false, maxAcceptsPerHour: 3, audit: [] } })
    await expect(acceptFriendRequest('u1', 'acc-1', 'r1')).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'WECHAT_FRIENDS_DISABLED',
    })
    expect(hoisted.performAction).not.toHaveBeenCalled()
    const patch = hoisted.patchMetadata.mock.calls[0]?.[1] as {
      friendAutomation: { audit: WechatFriendAuditEntry[] }
    }
    expect(patch.friendAutomation.audit[0]).toMatchObject({
      requestId: 'r1',
      ok: false,
      errorCode: 'WECHAT_FRIENDS_DISABLED',
    })
  })

  it('一小时频次超限：429 + RATE_LIMITED，不调桥', async () => {
    const audit = seedAudit([{ requestId: 'old-1', ok: true, status: 'accepted' }])
    setMetadata({ friendAutomation: { enabled: true, maxAcceptsPerHour: 1, audit } })
    await expect(acceptFriendRequest('u1', 'acc-1', 'r1')).rejects.toMatchObject({
      statusCode: 429,
      errorCode: 'RATE_LIMITED',
    })
    expect(hoisted.performAction).not.toHaveBeenCalled()
  })

  it('requestId 不在当前扫描结果里：404 + REQUEST_NOT_FOUND，不发 friend.accept', async () => {
    setMetadata({ friendAutomation: { enabled: true, maxAcceptsPerHour: 3, audit: [] } })
    hoisted.performAction.mockResolvedValue(scanBridgeResult([
      { requestId: 'r-other', nickname: '别人', kind: 'friend', clickable: true },
    ]))
    await expect(acceptFriendRequest('u1', 'acc-1', 'r-missing')).rejects.toMatchObject({
      statusCode: 404,
      errorCode: 'REQUEST_NOT_FOUND',
    })
    expect(hoisted.performAction).toHaveBeenCalledTimes(1)
    expect(hoisted.performAction.mock.calls[0]?.[2]).toBe('friend.scan')
  })

  it('happy path：扫描命中 → 桥 accepted → 审计成功落库', async () => {
    setMetadata({ friendAutomation: { enabled: true, maxAcceptsPerHour: 3, audit: [] } })
    hoisted.performAction
      .mockResolvedValueOnce(
        scanBridgeResult([{ requestId: 'r1', nickname: '张三', source: '群聊分享', kind: 'friend', clickable: true }]),
      )
      .mockResolvedValueOnce(
        bridgeActionResult({ ok: true, status: 'accepted', data: { status: 'accepted', requestId: 'r1' } }),
      )
    const view = await acceptFriendRequest('u1', 'acc-1', 'r1')
    expect(view).toMatchObject({ ok: true, status: 'accepted', requestId: 'r1' })
    // 回执带剩余额度：本次刚用掉 1 个，小时上限 3 ⇒ 剩 2；日上限缺省 10 ⇒ 剩 9
    expect(view).toMatchObject({ remainingThisHour: 2, remainingToday: 9 })
    expect(hoisted.performAction.mock.calls[1]).toMatchObject(['u1', 'acc-1', 'friend.accept', { requestId: 'r1' }])
    const patch = hoisted.patchMetadata.mock.calls[0]?.[1] as {
      friendAutomation: { audit: WechatFriendAuditEntry[] }
    }
    expect(patch.friendAutomation.audit[0]).toMatchObject({
      requestId: 'r1',
      nickname: '张三',
      ok: true,
      status: 'accepted',
    })
  })

  it('桥侧 stale-request 失败：折 failed 视图，审计记失败与错误码', async () => {
    setMetadata({ friendAutomation: { enabled: true, maxAcceptsPerHour: 3, audit: [] } })
    hoisted.performAction
      .mockResolvedValueOnce(
        scanBridgeResult([{ requestId: 'r1', nickname: '张三', kind: 'friend', clickable: true }]),
      )
      .mockResolvedValueOnce(
        bridgeActionResult({
          ok: false,
          status: 'failed',
          data: { status: 'failed', errorCode: 'stale-request', reason: '控件名已变化' },
          reason: '控件名已变化',
        }),
      )
    const view = await acceptFriendRequest('u1', 'acc-1', 'r1')
    expect(view).toMatchObject({ ok: false, status: 'failed', errorCode: 'stale-request' })
    const patch = hoisted.patchMetadata.mock.calls[0]?.[1] as {
      friendAutomation: { audit: WechatFriendAuditEntry[] }
    }
    expect(patch.friendAutomation.audit[0]).toMatchObject({
      requestId: 'r1',
      nickname: '张三',
      ok: false,
      errorCode: 'stale-request',
    })
  })

  it('审计超过保留上限截断：新条目保留，最旧条目丢弃', async () => {
    const existing = seedAudit(
      Array.from({ length: FRIENDS_AUDIT_KEEP }, (_, i) => ({
        requestId: `old-${i}`,
        ok: i % 2 === 0,
      })),
      // 全部落在 24 小时窗口之外，避免触发每日上限，只验证截断行为
      3 * 86_400_000,
    )
    setMetadata({
      friendAutomation: {
        enabled: true,
        maxAcceptsPerHour: 10,
        maxAcceptsPerDay: 50,
        minGapSeconds: 0,
        audit: existing,
      },
    })
    hoisted.performAction
      .mockResolvedValueOnce(scanBridgeResult([{ requestId: 'r-new', nickname: '新人', kind: 'friend', clickable: true }]))
      .mockResolvedValueOnce(bridgeActionResult({ ok: true, status: 'accepted', data: { status: 'accepted' } }))
    await acceptFriendRequest('u1', 'acc-1', 'r-new')
    const patch = hoisted.patchMetadata.mock.calls[0]?.[1] as {
      friendAutomation: { audit: WechatFriendAuditEntry[] }
    }
    expect(patch.friendAutomation.audit).toHaveLength(FRIENDS_AUDIT_KEEP)
    expect(patch.friendAutomation.audit.some((e) => e.requestId === 'old-0')).toBe(false)
    expect(patch.friendAutomation.audit[FRIENDS_AUDIT_KEEP - 1]).toMatchObject({ requestId: 'r-new', ok: true })
  })

  it('24 小时上限：小时内没超但一天已满 ⇒ 429，不调桥', async () => {
    const existing = seedAudit(
      Array.from({ length: 10 }, (_, i) => ({ requestId: `d-${i}`, ok: true, status: 'accepted' })),
      3 * 3_600_000, // 3 小时前，落在 24 小时窗口、落在小时窗口之外
    )
    setMetadata({
      friendAutomation: {
        enabled: true,
        maxAcceptsPerHour: 10,
        maxAcceptsPerDay: 10,
        minGapSeconds: 0,
        audit: existing,
      },
    })
    await expect(acceptFriendRequest('u1', 'acc-1', 'r-new')).rejects.toMatchObject({
      statusCode: 429,
      errorCode: 'RATE_LIMITED',
      message: expect.stringContaining('24 小时'),
    })
    expect(hoisted.performAction).not.toHaveBeenCalled()
  })

  it('最小间隔：上一次通过才过 30 秒 ⇒ 429 并说清还要等多久', async () => {
    const existing = seedAudit([{ requestId: 'g-1', ok: true, status: 'accepted' }], 30_000)
    setMetadata({
      friendAutomation: {
        enabled: true,
        maxAcceptsPerHour: 10,
        maxAcceptsPerDay: 50,
        minGapSeconds: 60,
        audit: existing,
      },
    })
    await expect(acceptFriendRequest('u1', 'acc-1', 'r-new')).rejects.toMatchObject({
      statusCode: 429,
      errorCode: 'RATE_LIMITED',
      message: expect.stringContaining('间隔不足 60 秒'),
    })
    expect(hoisted.performAction).not.toHaveBeenCalled()
  })
})

describe('策略读写与聚合视图', () => {
  it('updateFriendsPolicy 合并字段、夹上限并保留既有审计', async () => {
    const existing = seedAudit([{ requestId: 'old-1', ok: true }])
    setMetadata({ friendAutomation: { enabled: false, maxAcceptsPerHour: 2, audit: existing } })
    const next = await updateFriendsPolicy('u1', 'acc-1', { enabled: true, maxAcceptsPerHour: 99 })
    expect(next).toEqual({
      enabled: true,
      maxAcceptsPerHour: 10,
      maxAcceptsPerDay: 10,
      minGapSeconds: 60,
    })
    const patch = hoisted.patchMetadata.mock.calls[0]?.[1] as {
      friendAutomation: { audit: WechatFriendAuditEntry[] }
    }
    expect(patch.friendAutomation.audit).toHaveLength(1)
  })

  it('readFriendsPolicyView 读出 metadata 策略', async () => {
    setMetadata({ friendAutomation: { enabled: true, maxAcceptsPerHour: 5 } })
    const policy = await readFriendsPolicyView('u1', 'acc-1')
    expect(policy).toEqual<WechatFriendsPolicy>({
      enabled: true,
      maxAcceptsPerHour: 5,
      maxAcceptsPerDay: 10,
      minGapSeconds: 60,
    })
  })

  it('readFriendsOverview 拼装 policy + scan + audit', async () => {
    const existing = seedAudit([{ requestId: 'old-1', ok: true, status: 'accepted' }])
    setMetadata({ friendAutomation: { enabled: true, maxAcceptsPerHour: 3, audit: existing } })
    hoisted.performAction.mockResolvedValue(
      scanBridgeResult([{ requestId: 'r1', nickname: '张三', kind: 'friend', clickable: true }]),
    )
    const overview = await readFriendsOverview('u1', 'acc-1')
    expect(overview.policy).toEqual({
      enabled: true,
      maxAcceptsPerHour: 3,
      maxAcceptsPerDay: 10,
      minGapSeconds: 60,
    })
    expect(overview.scan.status).toBe('ok')
    expect(overview.scan.requests[0]?.requestId).toBe('r1')
    expect(overview.audit).toHaveLength(1)
  })

  it('脏审计条目被静默剔除', () => {
    const audit = readFriendsAudit({
      friendAutomation: {
        audit: [
          { at: NOW, requestId: 'ok-1', ok: true },
          { at: 'not-a-number', requestId: 'bad-1' },
          { at: NOW },
          'not-an-object',
        ],
      },
    })
    expect(audit).toHaveLength(1)
    expect(audit[0]?.requestId).toBe('ok-1')
  })
})
