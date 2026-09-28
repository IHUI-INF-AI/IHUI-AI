// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// GET /api/admin/member/blacklist?type=device 的设备指纹区分度闸离线回归(2026-09-27,不连库)。
// 堵的是:该端点按 fingerprintHash 等值查关联账号并整包外发 userIds,既不判"这枚指纹是否
// 真有区分度",也没有行数上限 —— 而移动端采集器只喂 Platform.OS,同一 OS 的全部真机算出
// 同一枚哈希。于是"拿一枚指纹把全网同 OS 账号连成一片"与"真的只关联到 3 个账号"在响应上
// 完全同形,管理员无从分辨。三格用例:
//   A 命中集合小(3 个) ⇒ 既有 12 个键/值逐字不变(回归对照,证明没把正常功能改坏)
//   B 命中集合超阈(12 个) ⇒ discriminating:false + userIds 只给样本 + withheldUserCount 点名截断量
//   C 阈值边界(10 / 11) ⇒ 判据语义钉死
//   D 非 device 路径 ⇒ 整个响应体逐字不变(新增键不得泄漏到不相关分支)
//   E 摘线反向锁 ⇒ 见文件末 describe(把闸门换成直传 userIds 的写法,本文件必翻红)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockBlacklistRows, mockDeviceRows, ADMIN_ID } = vi.hoisted(() => ({
  mockBlacklistRows: vi.fn((): unknown[] => []),
  mockDeviceRows: vi.fn((): unknown[] => []),
  ADMIN_ID: '11111111-1111-4111-8111-111111111111',
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (resolver: () => unknown[]) => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'innerJoin',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
    ]) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return step
  }
  return {
    db: {
      // 本端点两条查询按形态区分:无参 select() = systemConfigs 黑名单行;
      // 带投影对象 select({...}) = userDevices 设备行。两个 resolver 各喂各的夹具。
      select: vi.fn((shape?: unknown) => makeChain(shape ? mockDeviceRows : mockBlacklistRows)),
      insert: vi.fn(() => makeChain(() => [])),
      update: vi.fn(() => makeChain(() => [])),
      delete: vi.fn(() => makeChain(() => [])),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => makeChain(() => [])) },
  }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }): Promise<void> => {
    request.userId = ADMIN_ID
  },
}))

import {
  adminAuthEduRoutes,
  judgeFingerprintAffiliation,
  MAX_ACCOUNTS_PER_DISCRIMINATING_FINGERPRINT,
  NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE,
} from '../src/routes/admin-auth-edu-routes.js'

const CREATED_AT = '2026-09-20T03:04:05.000Z'
const SEEN_AT = new Date('2026-09-21T10:00:00.000Z')
/** 库里是 Date,但 JSON 响应体里必然是 ISO 串(断言按"从 res.json() 拿到的形态"写)。 */
const SEEN_AT_ISO = '2026-09-21T10:00:00.000Z'
/** 真格式:32 字符指纹哈希。 */
const FP = 'deadbeefcafebabe0123456789abcdef'

/** 稳定的"不同账号" id 生成器(十进制序号编进首段,保证互不相同)。 */
function uid(n: number): string {
  return n.toString(16).padStart(8, '0') + '-1111-4111-8111-111111111111'
}

/** 一条 device 类黑名单登记(systemConfigs 行);key 即 fingerprintHash。 */
function blacklistRow(): Record<string, unknown> {
  return {
    id: 'cfg-1',
    key: FP,
    category: 'member-blacklist',
    type: 'json',
    createdAt: CREATED_AT,
    value: JSON.stringify({
      user: '张三',
      type: 'device',
      reason: '批量注册',
      status: 'active',
      expiresAt: null,
      createdAt: CREATED_AT,
    }),
  }
}

/** 一条 user_devices 行(库里确认的"该指纹被该账号用过")。 */
function deviceRow(userId: string): Record<string, unknown> {
  return {
    fingerprintHash: FP,
    userId,
    lastSeenAt: SEEN_AT,
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    ip: '203.0.113.7',
  }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(adminAuthEduRoutes, { prefix: '/api/admin' })
  await app.ready()
  return app
}

async function getDeviceList(): Promise<Record<string, unknown>> {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/admin/member/blacklist?type=device' })
  expect(res.statusCode).toBe(200)
  const body = res.json() as { code: number; data: { list: Record<string, unknown>[] } }
  await app.close()
  expect(body.code).toBe(0)
  expect(body.data.list).toHaveLength(1)
  return body.data.list[0]
}

describe('A: 命中集合小 ⇒ 既有键值逐字不变', () => {
  beforeEach(() => {
    mockBlacklistRows.mockReturnValue([blacklistRow()])
  })

  it('3 个关联账号 ⇒ userIds 仍是全集,既有 12 个键/值与改前完全同形', async () => {
    const ids = [uid(1), uid(2), uid(3)]
    mockDeviceRows.mockReturnValue(ids.map(deviceRow))
    const entry = await getDeviceList()
    // 改前该对象就是这 12 个键。这里逐字列出:任何一键被改名/换值/丢失都会红。
    expect(entry).toEqual({
      id: 'cfg-1',
      user: '张三',
      identifier: FP,
      type: 'device',
      reason: '批量注册',
      status: 'active',
      expiresAt: null,
      createdAt: CREATED_AT,
      lastSeenAt: SEEN_AT_ISO,
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      ip: '203.0.113.7',
      userIds: ids,
      // 以下为新增键(新增键不算破坏性变更),且必须如实表达"没截断"
      discriminating: true,
      matchedUserCount: 3,
      withheldUserCount: 0,
      nonDiscriminationNote: null,
    })
  })

  it('库里没有任何设备行 ⇒ userIds 空数组、仍判具区分度(正常空结果不得被闸成异常)', async () => {
    mockDeviceRows.mockReturnValue([])
    const entry = await getDeviceList()
    expect(entry.userIds).toEqual([])
    expect(entry.discriminating).toBe(true)
    expect(entry.matchedUserCount).toBe(0)
    expect(entry.lastSeenAt).toBeNull()
  })
})

describe('B: 命中集合超阈 ⇒ 不得当"同一设备"外发', () => {
  beforeEach(() => {
    mockBlacklistRows.mockReturnValue([blacklistRow()])
  })

  it('12 个关联账号(> 阈值) ⇒ discriminating:false + 只给样本 + 点名截断量', async () => {
    const all = Array.from({ length: 12 }, (_unused, i) => uid(i + 1))
    mockDeviceRows.mockReturnValue(all.map(deviceRow))
    const entry = await getDeviceList()
    expect(entry.discriminating).toBe(false)
    // 整包不得倒出:外发数 = 样本档,而不是库里确认的 12
    expect(entry.userIds).toHaveLength(NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE)
    expect((entry.userIds as string[]).length).toBeLessThan(all.length)
    // 截断必须点名,不能静默变短
    expect(entry.matchedUserCount).toBe(12)
    expect(entry.withheldUserCount).toBe(12 - NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE)
    const note = entry.nonDiscriminationNote
    expect(typeof note).toBe('string')
    expect(note as string).toContain('Platform.OS')
    // 被 withheld 的那些 id 确实没有出现在响应里(而不是"少发了别的一些")
    const sent = new Set(entry.userIds as string[])
    expect(sent.has(all[all.length - 1])).toBe(false)
    // 既有键仍然在位且未被改动(状态码/键名不破坏)
    expect(entry.identifier).toBe(FP)
    expect(entry.type).toBe('device')
  })

  it('退化形态量级(同 OS 全部真机,800 个账号) ⇒ 仍只发样本,计数如实', async () => {
    const all = Array.from({ length: 800 }, (_unused, i) => uid(i + 1))
    mockDeviceRows.mockReturnValue(all.map(deviceRow))
    const entry = await getDeviceList()
    expect(entry.discriminating).toBe(false)
    expect(entry.userIds).toHaveLength(NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE)
    expect(entry.matchedUserCount).toBe(800)
    expect(entry.withheldUserCount).toBe(795)
  })
})

describe('C: 阈值边界钉死常量语义', () => {
  beforeEach(() => {
    mockBlacklistRows.mockReturnValue([blacklistRow()])
  })

  it('恰好等于阈值 ⇒ 判具区分度(阈值含等号,单点改动即翻红)', async () => {
    const n = MAX_ACCOUNTS_PER_DISCRIMINATING_FINGERPRINT
    mockDeviceRows.mockReturnValue(Array.from({ length: n }, (_unused, i) => deviceRow(uid(i + 1))))
    const entry = await getDeviceList()
    expect(entry.matchedUserCount).toBe(n)
    expect(entry.discriminating).toBe(true)
    expect(entry.withheldUserCount).toBe(0)
  })

  it('阈值 + 1 ⇒ 判不具区分度', async () => {
    const n = MAX_ACCOUNTS_PER_DISCRIMINATING_FINGERPRINT + 1
    mockDeviceRows.mockReturnValue(Array.from({ length: n }, (_unused, i) => deviceRow(uid(i + 1))))
    const entry = await getDeviceList()
    expect(entry.discriminating).toBe(false)
    expect(entry.matchedUserCount).toBe(n)
    expect(entry.withheldUserCount).toBe(n - NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE)
  })
})

describe('D: 非 device 路径逐字不变(新增键不得外溢)', () => {
  beforeEach(() => {
    mockBlacklistRows.mockReturnValue([blacklistRow()])
    mockDeviceRows.mockReturnValue([])
  })

  it('不带 type ⇒ 响应体与改前同形:8 个键,没有 discriminating 等新增键', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/admin/member/blacklist' })
    expect(res.statusCode).toBe(200)
    await app.close()
    // toEqual 对"多出来的键"同样判红 ⇒ 这一条同时是"闸门只作用于 device 分支"的证明
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: {
        list: [
          {
            id: 'cfg-1',
            user: '张三',
            identifier: FP,
            type: 'device',
            reason: '批量注册',
            status: 'active',
            expiresAt: null,
            createdAt: CREATED_AT,
          },
        ],
      },
    })
  })
})

describe('E: 判定函数本体(库确认集合去重;计数不是请求侧长度)', () => {
  it('重复 userId 只算一个不同账号(区分度按"不同账号"量,不按行数量)', () => {
    const dup = [uid(1), uid(2), uid(1), uid(2), uid(1)]
    const r = judgeFingerprintAffiliation(dup)
    expect(r.matchedUserCount).toBe(2)
    expect(r.discriminating).toBe(true)
    expect(r.userIds).toEqual([uid(1), uid(2)])
  })

  it('超阈时 userIds 是 confirmed 集合的前缀样本,且 withheldUserCount 与之相加等于全集', () => {
    const all = Array.from({ length: 30 }, (_unused, i) => uid(i + 1))
    const r = judgeFingerprintAffiliation(all)
    expect(r.discriminating).toBe(false)
    expect(r.userIds).toEqual(all.slice(0, NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE))
    expect(r.userIds.length + r.withheldUserCount).toBe(all.length)
  })
})
