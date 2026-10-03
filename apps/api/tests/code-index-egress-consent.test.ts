// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「代码语义索引出域」镜像模块的测试(2026-10-03 数据出域合规整改,第二轮)。
 *
 * 判据不是"函数返回了什么",而是**跨进程那一步有没有真的发生**:
 * 这个模块存在的全部意义是让另一个进程(ai-service)的闸门看到用户的选择。
 * 一个"只落库不推送"的实现能通过绝大多数本地断言,却仍然是假开关 ——
 * 所以这里主要盯 `aiServiceFetch` 的调用形状(路径 / 极性),以及失败时的行为。
 *
 * 覆盖的失效型:
 *  ① 极性写反(opt-out 键被当成 opt-in 推出去)→ 判 body 的 opted_out;
 *  ② 忘了推(只 upsert 库)→ 判 aiServiceFetch 被调用;
 *  ③ **用系统 token 顶替用户身份** → 判"无 request 时必须拒绝推",这是本设计
 *     最容易被"优化"掉的一处(ai-service 按 JWT 归属,系统 token 会把决定记到
 *     system-worker 名下,等于没人 opted-out);
 *  ④ 推送失败把整次设置保存拖挂 → 判不抛,且失败可观测;
 *  ⑤ 预热误以为能给闸门"重推" → 判预热**不**发请求(闸门自愈在 ai-service 侧)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

const { aiServiceFetchMock } = vi.hoisted(() => ({ aiServiceFetchMock: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}))

vi.mock('@ihui/database', () => ({
  userPreferences: { id: 'id', userId: 'userId', group: 'group', key: 'key', value: 'value' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({ aiServiceFetch: aiServiceFetchMock }))

import { db } from '../src/db/index.js'
import {
  setCodeIndexEgressOptOut,
  preloadCodeIndexEgressOptOuts,
  isCodeIndexEgressOptedOut,
  getConsentSyncStats,
  resetCodeIndexEgressCacheForTests,
} from '../src/services/code-index-egress-consent'

const USER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

/** 假的 Fastify request(只为过类型;真身份由 aiServiceFetch 内部透传) */
const fakeRequest = { id: 'req-1' } as unknown as FastifyRequest

function stubExistingPref(exists: boolean) {
  ;(db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      where: () => ({ limit: () => Promise.resolve(exists ? [{ id: 'row-1' }] : []) }),
    }),
  })
}

/** 让 preload 的 select 链返回给定行(无 .limit();where 需为 thenable 才能被 await) */
function stubPreloadRows(rows: Array<{ userId: string; value: string | null }>) {
  ;(db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({ where: () => ({ then: (r: (v: unknown) => void) => r(rows) }) }),
  })
}

function lastPushArgs(): { path: string; body: Record<string, unknown> } {
  const call = aiServiceFetchMock.mock.calls.at(-1)
  const init = call?.[2] as RequestInit
  return { path: String(call?.[1]), body: JSON.parse(init.body as string) }
}

beforeEach(() => {
  aiServiceFetchMock.mockReset()
  aiServiceFetchMock.mockResolvedValue({ ok: true, status: 200 })
  stubExistingPref(false)
  resetCodeIndexEgressCacheForTests()
})

describe('写入入口:极性与跨进程推送', () => {
  it('opt-out=true ⇒ 推送 opted_out=true(极性不翻)', async () => {
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    expect(lastPushArgs().body).toMatchObject({ opted_out: true })
  })

  it('opt-out=false ⇒ 推送 opted_out=false(**不得**取反成 true)', async () => {
    // 界面是 opt-out,若顺手 `!optedOut` 推出去,ai-service 会把"用户没阻止"
    // 记成"用户已授权出域" —— 方向完全反了,且这是合规闸,反了就是事故。
    await setCodeIndexEgressOptOut(fakeRequest, USER, false)
    expect(lastPushArgs().body).toMatchObject({ opted_out: false })
  })

  it('真的发了跨进程请求(只 upsert 库而不推送 = 假开关)', async () => {
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    expect(aiServiceFetchMock).toHaveBeenCalledTimes(1)
    expect(lastPushArgs().path).toBe('/api/code-index-consent/sync')
  })

  it('请求体**不含** user_id(身份只能来自 JWT,不许 body 自称)', async () => {
    // 这条是安全判据,不是风格偏好:若 body 能带 user_id,任何能复用他人 token
    // 的路径都可能替别人写"已授权出域"。
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    expect(lastPushArgs().body).not.toHaveProperty('user_id')
  })

  it('推送走 aiServiceFetch 且第���实参是 request(它负责透传该用户 JWT)', async () => {
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    // 少了 request 就没有用户身份可透传 —— 这是"顶替身份"的第一道闸
    expect(aiServiceFetchMock.mock.calls[0]?.[0]).toBe(fakeRequest)
  })

  it('推送在落库**之后**(让 ai-service 拿到的永远是已记下来的选择)', async () => {
    const order: string[] = []
    ;(db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      values: () => {
        order.push('db')
        return Promise.resolve()
      },
    })
    aiServiceFetchMock.mockImplementation(() => {
      order.push('push')
      return Promise.resolve({ ok: true, status: 200 } as Response)
    })
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    expect(order).toEqual(['db', 'push'])
  })

  it('落库失败也仍然推送', async () => {
    ;(db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('db down')
    })
    await expect(setCodeIndexEgressOptOut(fakeRequest, USER, true)).resolves.toBeUndefined()
    expect(aiServiceFetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('身份安全:缺 request 时拒绝推(不用系统 token 顶替)', () => {
  it('request 为 null ⇒ 不发请求', async () => {
    await setCodeIndexEgressOptOut(null as unknown as FastifyRequest, USER, true)
    expect(aiServiceFetchMock).not.toHaveBeenCalled()
  })

  it('缺 request 时失败被计入 stats(否则这次"没推"是静默的)', async () => {
    await setCodeIndexEgressOptOut(null as unknown as FastifyRequest, USER, true)
    const stats = getConsentSyncStats()
    expect(stats.attempted).toBe(1)
    expect(stats.failed).toBe(1)
    expect(stats.lastError).toContain('request')
  })
})

describe('推送失败:可观测,且不拖挂设置保存', () => {
  it('ai-service 返回非 2xx ⇒ 不抛', async () => {
    aiServiceFetchMock.mockResolvedValue({ ok: false, status: 503 })
    await expect(setCodeIndexEgressOptOut(fakeRequest, USER, true)).resolves.toBeUndefined()
  })

  it('网络异常 ⇒ 不抛', async () => {
    aiServiceFetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(setCodeIndexEgressOptOut(fakeRequest, USER, true)).resolves.toBeUndefined()
  })

  it('失败被计入 stats(用户以为关了、实际没关是唯一可观测点)', async () => {
    aiServiceFetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    const stats = getConsentSyncStats()
    expect(stats.attempted).toBe(1)
    expect(stats.failed).toBe(1)
    expect(stats.succeeded).toBe(0)
    expect(stats.lastError).toContain('ECONNREFUSED')
  })

  it('成功清零 lastError', async () => {
    aiServiceFetchMock.mockRejectedValueOnce(new Error('boom'))
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    aiServiceFetchMock.mockResolvedValue({ ok: true, status: 200 })
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    expect(getConsentSyncStats().lastError).toBeNull()
  })
})

describe('本模块缓存只是"我推过什么",不是闸门', () => {
  it('记录 opt-out 用户,便于排障', async () => {
    expect(isCodeIndexEgressOptedOut(USER)).toBe(false)
    await setCodeIndexEgressOptOut(fakeRequest, USER, true)
    expect(isCodeIndexEgressOptedOut(USER)).toBe(true)
    await setCodeIndexEgressOptOut(fakeRequest, USER, false)
    expect(isCodeIndexEgressOptedOut(USER)).toBe(false)
  })

  it('空 userId 直接返回(不落库)', async () => {
    await setCodeIndexEgressOptOut(fakeRequest, '', true)
    expect(aiServiceFetchMock).not.toHaveBeenCalled()
  })
})

describe('启动预热:只重建排障视图,不越界替闸门干活', () => {
  it('把库里已 opt-out 的用户读进排障视图', async () => {
    stubPreloadRows([{ userId: USER, value: 'true' }])
    await preloadCodeIndexEgressOptOuts()
    expect(isCodeIndexEgressOptedOut(USER)).toBe(true)
  })

  it('**不**发任何跨进程请求(启动期无用户 JWT;闸门自愈在 ai-service 侧)', async () => {
    // 若这里改成"重推",就会退化成用系统 token 替所有用户表态 —— 那正是本设计
    // 刻意避免的:启动自愈该由 ai-service 自己读库做(lifespan 里的
    // preload_opt_outs_from_db)。
    stubPreloadRows([{ userId: USER, value: 'true' }])
    await preloadCodeIndexEgressOptOuts()
    expect(aiServiceFetchMock).not.toHaveBeenCalled()
  })

  it('不收 value!=="true" 的行', async () => {
    stubPreloadRows([
      { userId: 'u-false', value: 'false' },
      { userId: 'u-null', value: null },
      { userId: 'u-junk', value: 'yes' },
    ])
    await preloadCodeIndexEgressOptOuts()
    expect(isCodeIndexEgressOptedOut('u-false')).toBe(false)
    expect(isCodeIndexEgressOptedOut('u-null')).toBe(false)
    expect(isCodeIndexEgressOptedOut('u-junk')).toBe(false)
  })

  it('读库失败不抛(预热失败不该让服务起不来)', async () => {
    ;(db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('db down')
    })
    await expect(preloadCodeIndexEgressOptOuts()).resolves.toBeUndefined()
  })

  it('幂等:重复调用结果一致', async () => {
    stubPreloadRows([{ userId: USER, value: 'true' }])
    await preloadCodeIndexEgressOptOuts()
    await preloadCodeIndexEgressOptOuts()
    expect(isCodeIndexEgressOptedOut(USER)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
