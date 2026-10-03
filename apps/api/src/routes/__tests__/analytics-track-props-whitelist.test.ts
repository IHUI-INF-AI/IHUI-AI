// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 埋点 props 白名单 / 值钳制测试(2026-10-03 数据出域合规整改)
 *
 * 覆盖两条入库路径:
 *   - 批量 {events:[{name,category,label,value,props}]}(web / cli 实际用法)
 *   - 单事件 {event, properties}
 * 断言要点:白名单内透传、白名单外丢弃、字符串截断 256、非标量丢弃、
 * 以及「顶层 category/label/value 与 props 同名时,合并后统一过闸」——
 * 后者是防绕过点,若 props 里的 category 能覆盖并绕过钳制,白名单就形同虚设。
 *
 * 另有一条回归防线:白名单外的键被丢弃时**整条事件仍要入库**,
 * 证明收紧是「丢字段」而不是「打挂埋点」。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  requireAuth: vi.fn(async () => {}),
  requirePermission: vi.fn(() => vi.fn(async () => {})),
  requireAnyPermission: vi.fn(() => vi.fn(async () => {})),
}))

const { insertCalls, resetQueues } = vi.hoisted(() => {
  const insertCalls: Array<Record<string, unknown>> = []
  return {
    insertCalls,
    resetQueues: () => {
      insertCalls.length = 0
    },
  }
})

// db 层只关心 insert().values() 落了什么;聚合查询不参与本用例
vi.mock('../../db/index.js', () => {
  const makeInsertChain = () => {
    const chain: Record<string, unknown> = {
      values: (values: unknown) => {
        insertCalls.push(values as Record<string, unknown>)
        return chain
      },
      returning: () => Promise.resolve([{ id: 'evt-1' }]),
      then: (onFulfilled?: (v: unknown) => unknown) => Promise.resolve([]).then(onFulfilled),
    }
    return chain
  }
  return {
    db: {
      insert: () => makeInsertChain(),
      select: () => {
        const builder: Record<string, unknown> = {
          from: () => builder,
          where: () => builder,
          groupBy: () => builder,
          orderBy: () => builder,
          limit: () => builder,
          offset: () => builder,
          then: (onFulfilled?: (v: unknown) => unknown) =>
            Promise.resolve([]).then(onFulfilled),
        }
        return builder
      },
    },
  }
})

vi.mock('@ihui/database', () => ({
  analyticsEvents: { createdAt: 'created_at', event: 'event', userId: 'user_id', properties: 'properties' },
}))

const { sanitizeAnalyticsProps, analyticsRoutes } = await import('../analytics.js')

/** 取出最后一次 insert 的 properties */
function lastProps(): Record<string, unknown> {
  const call = insertCalls[insertCalls.length - 1]
  return (call?.properties ?? {}) as Record<string, unknown>
}

/** 按序号取第 n 条 insert 的 properties(带非空断言,避免 strictNull 下靠 ! 糊过去) */
function propsAt(index: number): Record<string, unknown> {
  const call = insertCalls[index]
  if (!call) throw new Error(`insertCalls[${index}] 不存在,实际长度 ${insertCalls.length}`)
  return (call.properties ?? {}) as Record<string, unknown>
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  // 前缀与 routes/index.ts:620 的生产注册保持一致(/api 在注册时加,插件内只见 /analytics/track)
  await app.register(analyticsRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  resetQueues()
})

// ─────────────────────────────────────────────────────────────
// 纯函数层:sanitizeAnalyticsProps
// ─────────────────────────────────────────────────────────────
describe('sanitizeAnalyticsProps', () => {
  it('白名单内的键原样透传', () => {
    const out = sanitizeAnalyticsProps({
      path: '/chat',
      ts: 1730000000000,
      category: 'navigation',
      label: 'vip',
      value: 1.5,
      ref: 'r-1',
      durationMs: 300,
      count: 7,
      from: '/a',
      to: '/b',
      result: 'ok',
      errorCode: 'E_TIMEOUT',
      feature: 'chat',
      itemType: 'model',
      itemId: 'm-1',
    })
    expect(out).toEqual({
      path: '/chat',
      ts: 1730000000000,
      category: 'navigation',
      label: 'vip',
      value: 1.5,
      ref: 'r-1',
      durationMs: 300,
      count: 7,
      from: '/a',
      to: '/b',
      result: 'ok',
      errorCode: 'E_TIMEOUT',
      feature: 'chat',
      itemType: 'model',
      itemId: 'm-1',
    })
  })

  it('白名单外的键被丢弃(不报错、不入库)', () => {
    const out = sanitizeAnalyticsProps({
      path: '/chat',
      // 典型的事故形态:某次前端改动顺手把用户输入 / 凭据塞进 props
      userInput: '张三的身份证号',
      password: 'hunter2',
      email: 'a@b.com',
      __proto__: { polluted: true },
      nested: { deep: { user: 'x' } },
    })
    expect(out).toEqual({ path: '/chat' })
    // 显式确认敏感键一个都没漏
    expect(Object.keys(out)).not.toContain('userInput')
    expect(Object.keys(out)).not.toContain('password')
    expect(Object.keys(out)).not.toContain('email')
  })

  it('字符串值截断到 256', () => {
    const long = 'x'.repeat(1000)
    const out = sanitizeAnalyticsProps({ path: long })
    expect(out.path).toHaveLength(256)
    expect(out.path).toBe('x'.repeat(256))
  })

  it('恰好 256 长的字符串不被截断(边界不含糊)', () => {
    const exact = 'y'.repeat(256)
    expect(sanitizeAnalyticsProps({ label: exact }).label).toBe(exact)
  })

  it('数字 / 布尔透传', () => {
    const out = sanitizeAnalyticsProps({ ts: 1730000000000, value: 0, count: -3, success: true })
    expect(out).toEqual({ ts: 1730000000000, value: 0, count: -3, success: true })
  })

  it('非标量值一律丢弃(null / undefined / 对象 / 数组 / NaN / Infinity)', () => {
    const out = sanitizeAnalyticsProps({
      path: '/ok',
      label: null,
      value: undefined,
      itemType: { nested: 1 },
      itemId: ['a', 'b'],
      // NaN / Infinity 序列化成 JSON 会变 null,入库即失真,直接丢
      durationMs: NaN,
      count: Infinity,
    })
    expect(out).toEqual({ path: '/ok' })
  })

  it('非对象输入收敛为 {}', () => {
    expect(sanitizeAnalyticsProps(null)).toEqual({})
    expect(sanitizeAnalyticsProps(undefined)).toEqual({})
    expect(sanitizeAnalyticsProps('str')).toEqual({})
    expect(sanitizeAnalyticsProps(42)).toEqual({})
    expect(sanitizeAnalyticsProps([1, 2, 3])).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────
// 路由层:批量格式 {events:[...]}
// ─────────────────────────────────────────────────────────────
describe('POST /api/analytics/track 批量格式', () => {
  it('白名单内的键能落库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: {
        events: [
          {
            name: 'page_view',
            category: 'navigation',
            label: 'chat',
            props: { path: '/chat', ts: 1730000000000, sessionId: 'sid-1' },
          },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ data: { success: true, inserted: 1 } })
    expect(lastProps()).toEqual({
      category: 'navigation',
      label: 'chat',
      path: '/chat',
      ts: 1730000000000,
      sessionId: 'sid-1',
    })
  })

  it('白名单外的键被丢弃,但事件本身照常入库(不 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: {
        events: [
          {
            name: 'search',
            category: 'search',
            // keyword 是用户自由文本,整改后不入库
            props: { keyword: '张三 身份证 1234567890', path: '/search' },
          },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ data: { inserted: 1 } })
    const props = lastProps()
    expect(props).toEqual({ category: 'search', path: '/search' })
    expect(props).not.toHaveProperty('keyword')
  })

  it('props 里的值被截断到 256', async () => {
    const long = 'z'.repeat(5000)
    await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: { events: [{ name: 'click', props: { label: long } }] },
    })
    expect(lastProps().label).toHaveLength(256)
  })

  it('props 覆盖顶层同名字段时,仍走白名单与钳制(防绕过)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: {
        events: [
          {
            name: 'click',
            category: 'ui',
            label: 'top',
            props: { label: 'a'.repeat(400), category: { evil: true } },
          },
        ],
      },
    })
    // 回归防线:props 里的值类型不符(schema 宽松 + handler 钳制)必须**静默丢字段**,
    // 绝不能在校验期变成 4xx/5xx 打挂整批埋点。
    // 曾踩过的坑:给 schema 子键声明 type:['string','number','boolean'] 后,
    // ajv 对「值类型不符」报 FST_ERR_VALIDATION,该错误在响应序列化阶段变成 500,整批丢失。
    expect(res.statusCode).toBe(200)
    const props = lastProps()
    // props.label 覆盖了顶层 label,但依然被截断
    expect(props.label).toHaveLength(256)
    // props.category 是对象 → 丢弃;顶层 category 不应因此复活
    expect(props).not.toHaveProperty('category')
  })

  it('白名单内的键携带非法值类型时,整批仍 200 入库(值被丢,事件不丢)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: {
        events: [
          // 未来某次前端改动误传对象/数组 —— 收敛成丢弃,而非打挂
          { name: 'a', props: { path: { nested: 1 }, label: ['x'] } },
          // 同批次里的正常事件不能被上一条的脏数据连累
          { name: 'b', props: { path: '/ok' } },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ data: { inserted: 2 } })
    expect(propsAt(0)).toEqual({})
    expect(propsAt(1)).toEqual({ path: '/ok' })
  })

  it('批量多条:逐条独立过滤,互不影响', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: {
        events: [
          { name: 'a', props: { path: '/a', junk: 1 } },
          { name: 'b', props: { label: 'ok' } },
        ],
      },
    })
    expect(insertCalls).toHaveLength(2)
    expect(propsAt(0)).toEqual({ path: '/a' })
    expect(propsAt(1)).toEqual({ label: 'ok' })
  })
})

// ─────────────────────────────────────────────────────────────
// 路由层:单事件格式 {event, properties}
// ─────────────────────────────────────────────────────────────
describe('POST /api/analytics/track 单事件格式', () => {
  it('properties 过白名单:白名单内透传、白名单外丢弃', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: {
        event: 'login',
        properties: { ref: 'r-9', token: 'sk-should-never-persist' },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(lastProps()).toEqual({ ref: 'r-9' })
  })

  it('properties 的字符串值被截断', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: { event: 'click', properties: { path: 'q'.repeat(999) } },
    })
    expect(lastProps().path).toHaveLength(256)
  })

  it('缺少 event 与 events 时 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/track',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
