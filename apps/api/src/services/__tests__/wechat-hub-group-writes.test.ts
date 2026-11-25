// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群写动作闸回归：
 *  - 策略默认关闭，没有有效令牌绝不执行；
 *  - 令牌是无状态 HMAC 签名，两套独立重放集合验同一枚都能过（跨实例等价）；
 *  - 令牌一次性（jti 重放拒）、60 秒过期、绑定账号-动作-群-目标集合-标题/正文；
 *  - 单次目标数与一小时频次两道上限只在桥成功后才占额度。
 * 时间全部由 now 参数注入，不依赖真实时钟；DB/guard/manager/contacts 一律桩掉，不连真库。
 */

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WechatGroupActionInput, WechatGroupWritePolicy } from '@ihui/types'
import {
  PEAK_PLAN_TTL_MS,
  assertGroupWriteAllowed,
  issueGroupPlan,
  readGroupWritePolicy,
  recordGroupWriteSuccess,
  type GroupWriteRateWindowMap,
  type GroupWriteUsedSet,
} from '../wechat-hub/group-writes.js'
import { wechatHubOperationsRoutes } from '../../routes/wechat-hub-operations.js'

const hoisted = vi.hoisted(() => ({
  select: vi.fn(),
  updateSet: vi.fn(),
  nicknames: vi.fn(),
  patchMetadata: vi.fn(),
  preview: vi.fn(),
  runAction: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  dbRead: { select: hoisted.select },
  db: { update: () => ({ set: hoisted.updateSet }) },
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: async () => ({ id: 'acc-1', userId: 'u1', metadata: {} }),
}))
vi.mock('../wechat-hub/account-store.js', () => ({
  patchAccountMetadata: hoisted.patchMetadata,
}))
vi.mock('../wechat-hub/contacts.js', () => ({
  findMemberNicknames: hoisted.nicknames,
}))
vi.mock('../wechat-hub/manager.js', () => ({ wechatHubManager: {} }))
vi.mock('../wechat-hub/operations.js', () => ({
  deleteContact: vi.fn(),
  fetchMoments: vi.fn(),
  listMomentArchive: vi.fn(),
  previewGroupAction: hoisted.preview,
  publishMoment: vi.fn(),
  runGroupAction: hoisted.runAction,
  syncContacts: vi.fn(),
}))
vi.mock('../../plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'u1'
    return true
  }),
}))

/** 现在：2026-11-26 09:30（Asia/Shanghai，周四） */
const NOW = new Date('2026-11-26T01:30:00Z')
const NOW_MS = NOW.getTime()

const openPolicy: WechatGroupWritePolicy = {
  enabled: true,
  maxTargetsPerAction: 5,
  maxActionsPerHour: 3,
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

function freshStores(): { used: GroupWriteUsedSet; windows: GroupWriteRateWindowMap } {
  return { used: new Map(), windows: new Map() }
}

function kickInput(confirmToken: string | undefined, memberIds: string[] = ['wxid_a', 'wxid_b']): WechatGroupActionInput {
  return { action: 'kick', conversationId: 'conv-1', memberIds, confirmToken }
}

beforeEach(() => {
  hoisted.select.mockReset()
  hoisted.updateSet.mockReset()
  hoisted.nicknames.mockReset()
  hoisted.patchMetadata.mockReset()
  hoisted.preview.mockReset()
  hoisted.runAction.mockReset()
  hoisted.nicknames.mockResolvedValue({ wxid_a: '张三' })
  hoisted.updateSet.mockReturnValue({ where: () => chain(undefined) })
})

describe('readGroupWritePolicy', () => {
  it('缺省默认关闭，单次 5 人、每小时 3 次', () => {
    expect(readGroupWritePolicy(undefined)).toEqual({
      enabled: false,
      maxTargetsPerAction: 5,
      maxActionsPerHour: 3,
    })
    expect(readGroupWritePolicy({ groupWrites: null })).toEqual({
      enabled: false,
      maxTargetsPerAction: 5,
      maxActionsPerHour: 3,
    })
  })

  it('非法字段类型回落缺省，越界数值夹到 1–10', () => {
    const policy = readGroupWritePolicy({
      groupWrites: { enabled: 'yes', maxTargetsPerAction: 99, maxActionsPerHour: 0 },
    })
    expect(policy).toEqual({ enabled: false, maxTargetsPerAction: 10, maxActionsPerHour: 1 })
  })
})

describe('assertGroupWriteAllowed', () => {
  it('策略未开启一律拒，409 + WECHAT_GROUP_WRITES_DISABLED', () => {
    const closed = readGroupWritePolicy({})
    const { used, windows } = freshStores()
    expect(() =>
      assertGroupWriteAllowed(closed, {
        accountId: 'acc-1',
        input: kickInput('any-token'),
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(
      expect.objectContaining({ statusCode: 409, errorCode: 'WECHAT_GROUP_WRITES_DISABLED' }),
    )
  })

  it('开启后缺 confirmToken 直接拒，409 + WECHAT_GROUP_CONFIRM_REQUIRED', () => {
    const { used, windows } = freshStores()
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input: kickInput(undefined),
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(
      expect.objectContaining({ statusCode: 409, errorCode: 'WECHAT_GROUP_CONFIRM_REQUIRED' }),
    )
  })

  it('令牌过期拒，409 + WECHAT_GROUP_CONFIRM_EXPIRED', async () => {
    const { used, windows } = freshStores()
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b'],
      policy: openPolicy,
      now: NOW_MS,
    })
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input: kickInput(plan.confirmToken),
        now: NOW_MS + PEAK_PLAN_TTL_MS + 1,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(/已过期/)
  })

  it('同一令牌复用第二次必失败（jti 一次性）', async () => {
    const { used, windows } = freshStores()
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b'],
      policy: openPolicy,
      now: NOW_MS,
    })
    const input = kickInput(plan.confirmToken)
    assertGroupWriteAllowed(openPolicy, {
      accountId: 'acc-1',
      input,
      now: NOW_MS,
      used,
      rateWindows: windows,
    })
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input,
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(
      expect.objectContaining({ statusCode: 409, errorCode: 'WECHAT_GROUP_CONFIRM_EXPIRED' }),
    )
  })

  it('令牌与群不匹配拒（换会话复用同一张单子）', async () => {
    const { used, windows } = freshStores()
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b'],
      policy: openPolicy,
      now: NOW_MS,
    })
    const input = kickInput(plan.confirmToken)
    input.conversationId = 'conv-2'
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input,
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(/不匹配/)
  })

  it('目标数超单次上限拒，400 + WECHAT_GROUP_TARGETS_EXCEEDED', async () => {
    const tight: WechatGroupWritePolicy = { enabled: true, maxTargetsPerAction: 2, maxActionsPerHour: 3 }
    const { used, windows } = freshStores()
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b', 'wxid_c'],
      policy: tight,
      now: NOW_MS,
    })
    expect(() =>
      assertGroupWriteAllowed(tight, {
        accountId: 'acc-1',
        input: kickInput(plan.confirmToken, ['wxid_a', 'wxid_b', 'wxid_c']),
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(
      expect.objectContaining({ statusCode: 400, errorCode: 'WECHAT_GROUP_TARGETS_EXCEEDED' }),
    )
  })

  it('一小时频次超限拒，429 + WECHAT_GROUP_RATE_LIMITED', async () => {
    const once: WechatGroupWritePolicy = { enabled: true, maxTargetsPerAction: 5, maxActionsPerHour: 1 }
    const { used, windows } = freshStores()
    windows.set('acc-1', [NOW_MS])
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b'],
      policy: once,
      now: NOW_MS,
    })
    expect(() =>
      assertGroupWriteAllowed(once, {
        accountId: 'acc-1',
        input: kickInput(plan.confirmToken),
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(
      expect.objectContaining({ statusCode: 429, errorCode: 'WECHAT_GROUP_RATE_LIMITED' }),
    )
  })

  it('happy path：令牌消费一次成功，目标集合顺序无关，成功后才记频次', async () => {
    const { used, windows } = freshStores()
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b'],
      policy: openPolicy,
      now: NOW_MS,
    })

    expect(plan.targets).toEqual([
      { memberId: 'wxid_a', name: '张三', reason: null },
      { memberId: 'wxid_b', name: null, reason: null },
    ])
    expect(plan.warnings.some((w) => w.includes('不可逆'))).toBe(true)
    expect(plan.confirmToken).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/)

    // 目标顺序反过来也能对上同一张单子
    const input = kickInput(plan.confirmToken, ['wxid_b', 'wxid_a'])
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input,
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).not.toThrow()
    recordGroupWriteSuccess('acc-1', NOW_MS, windows)
    expect(windows.get('acc-1')).toEqual([NOW_MS])

    // 令牌已被这次成功消费，再来一次必挂
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input,
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(/已被使用/)
  })

  it('签名令牌无状态：两套独立重放集合验同一枚都能过（跨实例等价）', async () => {
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b'],
      policy: openPolicy,
      now: NOW_MS,
    })
    const input = kickInput(plan.confirmToken)
    const first = freshStores()
    const second = freshStores()

    // 第一套集合验过并记下 jti
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input,
        now: NOW_MS,
        used: first.used,
        rateWindows: first.windows,
      }),
    ).not.toThrow()
    // 第二套全新集合里没有这枚 jti，仅凭签名仍能验过（模拟另一个实例）
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input,
        now: NOW_MS,
        used: second.used,
        rateWindows: second.windows,
      }),
    ).not.toThrow()
    // 回到第一套，jti 已重放
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input,
        now: NOW_MS,
        used: first.used,
        rateWindows: first.windows,
      }),
    ).toThrowError(/已被使用/)
  })

  it('payload 任一字节被篡改必拒（签名不匹配）', async () => {
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a', 'wxid_b'],
      policy: openPolicy,
      now: NOW_MS,
    })
    const parts = plan.confirmToken.split('.')
    const body = parts[0] ?? ''
    const sig = parts[1] ?? ''
    const flipped = body[0] === 'A' ? 'B' : 'A'
    const tampered = `${flipped}${body.slice(1)}.${sig}`
    const { used, windows } = freshStores()
    expect(() =>
      assertGroupWriteAllowed(openPolicy, {
        accountId: 'acc-1',
        input: kickInput(tampered),
        now: NOW_MS,
        used,
        rateWindows: windows,
      }),
    ).toThrowError(/不匹配/)
  })

  it('开关关闭仍出预览单，warnings 首条提示开关未开，不可逆提示紧随其后', async () => {
    const closed = readGroupWritePolicy({})
    const plan = await issueGroupPlan({
      accountId: 'acc-1',
      action: 'kick',
      conversationId: 'conv-1',
      chatTitle: '测试群',
      memberIds: ['wxid_a'],
      policy: closed,
      now: NOW_MS,
    })
    expect(plan.warnings[0]).toContain('群写开关当前关闭')
    expect(plan.warnings[1]).toContain('不可逆')
  })
})

describe('路由入参校验', () => {
  it('create 不带 memberIds 在 schema 层拒 400', async () => {
    const app = Fastify()
    await app.register(wechatHubOperationsRoutes)
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/wechat-hub/accounts/acc-1/groups/plan',
      payload: { action: 'create' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('kick 空 memberIds 在 schema 层拒 400', async () => {
    const app = Fastify()
    await app.register(wechatHubOperationsRoutes)
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/wechat-hub/accounts/acc-1/groups/plan',
      payload: { action: 'kick', conversationId: 'conv-1', memberIds: [] },
    })
    expect(res.statusCode).toBe(400)
  })
})
