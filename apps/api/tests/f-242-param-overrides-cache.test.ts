// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-242 回归锁(2026-11-13)。
 *
 * 病灶:每个转发请求都全量 select 一次 system_configs(category='relay_param_ops')
 * 并逐行 JSON.parse,低频变更的配置把读路径线性放大到所有 /v1/* 转发。
 *
 * 本文件锁:
 *   ① 连续两次取规则(跨 model)只查一次库 —— 整表单键,不按 model 分键;
 *   ② 30s TTL 内命中缓存,过期后重新查库;
 *   ③ 新建/更新/删除规则后缓存立即失效,下一次取规则必查库;
 *   ④ 无规则时命中空缓存,不再每请求查库判空。
 *
 * 不连库:dbRead.select 链用内存 rows 替身,TTL 用 fake timers 控制。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// 静态引入只为在收集期完成模块转换(冷启动 transform 约 40s,放进用例会撞 15s 超时);
// 每条用例仍用 loadService() 取新实例,保证缓存是冷的。
import '../src/services/relay-param-ops-config.js'

const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  listQueries: 0,
  detailQueries: 0,
  insert: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => {
      h.listQueries += 1
      return Promise.resolve(h.rows)
    },
    limit: () => {
      h.detailQueries += 1
      return Promise.resolve(h.rows)
    },
  }
  return {
    db: {
      select: vi.fn(() => chain),
      insert: h.insert,
      update: h.update,
      delete: h.del,
    },
    dbRead: { select: vi.fn(() => chain) },
    dbClient: {},
  }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

/** 每条用例取一份新模块,保证进程内规则缓存是冷的。 */
async function loadService() {
  vi.resetModules()
  return import('../src/services/relay-param-ops-config.js')
}

/** system_configs 行替身:value 为规则 JSON。 */
function ruleRow(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: id,
    value: JSON.stringify({
      name: id,
      enabled: true,
      priority: 1,
      matchConditions: { global: true },
      ops: [{ op: 'set', path: 'temperature', value: 0.5 }],
      ...patch,
    }),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

describe('F-242 参数覆盖规则缓存', () => {
  beforeEach(() => {
    h.rows = []
    h.listQueries = 0
    h.detailQueries = 0
    h.insert.mockReset()
    h.update.mockReset()
    h.del.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('① 连续两次取规则只查一次库(整表单键,跨 model 也命中)', async () => {
    h.rows = [ruleRow('relay_param_ops:a')]
    const svc = await loadService()

    const first = await svc.applyParamOpsToBody({ model: 'model-a' }, { model: 'model-a' })
    const second = await svc.applyParamOpsToBody({ model: 'model-b' }, { model: 'model-b' })

    expect(first.modified).toBe(true)
    expect(second.modified).toBe(true)
    expect(h.listQueries).toBe(1)
  })

  it('② 30s TTL 内命中缓存,过期后重新查库', async () => {
    vi.useFakeTimers()
    h.rows = [ruleRow('relay_param_ops:a')]
    const svc = await loadService()

    await svc.getMatchingParamOps('model-a')
    expect(h.listQueries).toBe(1)

    vi.advanceTimersByTime(29_000)
    await svc.getMatchingParamOps('model-a')
    expect(h.listQueries).toBe(1)

    vi.advanceTimersByTime(1_001)
    await svc.getMatchingParamOps('model-a')
    expect(h.listQueries).toBe(2)
  })

  it('③ 新建/更新/删除后缓存立即失效,下一次取规则必查库', async () => {
    h.rows = [ruleRow('relay_param_ops:a')]
    h.insert.mockReturnValue({ values: async () => undefined })
    h.update.mockReturnValue({ set: () => ({ where: async () => undefined }) })
    h.del.mockReturnValue({ where: async () => undefined })
    const svc = await loadService()

    await svc.getMatchingParamOps('model-a')
    expect(h.listQueries).toBe(1)

    await svc.createParamOpRule({
      name: 'new',
      enabled: true,
      priority: 2,
      matchConditions: { global: true },
      ops: [],
    })
    await svc.getMatchingParamOps('model-a')
    expect(h.listQueries).toBe(2)

    await svc.updateParamOpRule('relay_param_ops:a', { priority: 5 })
    await svc.getMatchingParamOps('model-a')
    expect(h.listQueries).toBe(3)

    await svc.deleteParamOpRule('relay_param_ops:a')
    await svc.getMatchingParamOps('model-a')
    expect(h.listQueries).toBe(4)
  })

  it('④ 无规则时命中空缓存,不再每请求查库判空', async () => {
    h.rows = []
    const svc = await loadService()
    const body = { model: 'model-a', temperature: 1 }

    const first = await svc.applyParamOpsToBody(body, { model: 'model-a' })
    const second = await svc.applyParamOpsToBody(body, { model: 'model-a' })

    expect(first.modified).toBe(false)
    expect(second.modified).toBe(false)
    expect(first.body).toBe(body)
    expect(h.listQueries).toBe(1)
  })
})
