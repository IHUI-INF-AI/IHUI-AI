// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { normalizeHealthPayload, type ServiceStatus } from './health-payload'

/**
 * 2026-11-02 15:55(Asia/Shanghai) 从 `https://aizhs.top/api/health` 与
 * `http://127.0.0.1:8802/api/health` 实抓的响应，字段名逐字保留(仅 timestamp/uptime 随请求变化)。
 * 锁死这份夹具 = 锁死"后端真实裸对象"这一端，避免归一化只对着自造 shape 绿。
 */
const REAL_BACKEND_PAYLOAD = {
  status: 'ok',
  service: '@ihui/api',
  timestamp: '2026-11-02T13:55:02.572Z',
  uptime: 2117.2084197,
  redis: 'up',
}

/**
 * 修复前的页面数据路径（原样复刻 page.tsx 的 `apiOrThrow<ServiceStatus[]>` + `.filter`）：
 * 入口声明数组，不做任何形状校验。
 */
function legacyHealthyNames(services: ServiceStatus[]): string[] {
  return services.filter((s) => s.status === 'healthy').map((s) => s.name)
}

describe('normalizeHealthPayload', () => {
  it('单对象：后端真实裸对象包成一项，name 取 service，缺 latency 落 null', () => {
    const list = normalizeHealthPayload(REAL_BACKEND_PAYLOAD)
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      name: '@ihui/api',
      status: 'healthy',
      latency: null,
    })
  })

  it('数组：逐项归一，合法项原值保留（含 latency 与 message）', () => {
    const raw: ServiceStatus[] = [
      { name: 'API', status: 'healthy', latency: 12 },
      { name: 'DB', status: 'unhealthy', latency: 380, message: 'connection refused' },
    ]
    expect(normalizeHealthPayload(raw)).toEqual(raw)
  })

  it('空数组：保持空数组（页面落"暂无数据"而不是塞一条假绿）', () => {
    expect(normalizeHealthPayload([])).toEqual([])
  })

  it('缺字段：status 缺失落 unknown、name 缺失落 unknown、latency 缺失落 null', () => {
    expect(normalizeHealthPayload({})).toEqual([
      { name: 'unknown', status: 'unknown', latency: null },
    ])
    // 只给 name 也必须落 unknown：没有 status 不等于正常。
    expect(normalizeHealthPayload({ name: 'API' })).toEqual([
      { name: 'API', status: 'unknown', latency: null },
    ])
  })

  it('字段类型错：数字 name / 对象 status / 字符串 latency / 非字符串 message 全部落 unknown', () => {
    const list = normalizeHealthPayload({
      name: 42,
      status: { ok: true },
      latency: '12ms',
      message: 0,
    })
    expect(list).toEqual([{ name: 'unknown', status: 'unknown', latency: null }])
    expect(list[0]).not.toHaveProperty('message')
  })

  it('显式异常词不转绿：degraded/down/error 落 unhealthy，未知词落 unknown', () => {
    // noUncheckedIndexedAccess 下索引为 possibly undefined；取不到即断言失败，判据不放宽。
    const statusOf = (input: unknown) => normalizeHealthPayload(input)[0]?.status
    expect(statusOf({ service: 'api', status: 'degraded' })).toBe('unhealthy')
    expect(statusOf({ service: 'api', status: 'down' })).toBe('unhealthy')
    expect(statusOf({ service: 'api', status: 'maintenance' })).toBe('unknown')
    expect(statusOf({ service: 'api', status: 'OK' })).toBe('healthy')
  })

  it('顶层不是对象/数组：返回空数组，不伪造服务项', () => {
    expect(normalizeHealthPayload(null)).toEqual([])
    expect(normalizeHealthPayload('ok')).toEqual([])
    expect(normalizeHealthPayload(undefined)).toEqual([])
  })
})

describe('RP-35 反向例：撤回归一化必复现原始症状', () => {
  it('后端真实响应是裸对象而非数组（形状锁死）', () => {
    expect(Array.isArray(REAL_BACKEND_PAYLOAD)).toBe(false)
    expect(Object.keys(REAL_BACKEND_PAYLOAD).sort()).toEqual([
      'redis',
      'service',
      'status',
      'timestamp',
      'uptime',
    ])
    expect(REAL_BACKEND_PAYLOAD).not.toHaveProperty('name')
    expect(REAL_BACKEND_PAYLOAD).not.toHaveProperty('latency')
  })

  it('按数组读（修复前数据路径）喂真实裸对象必抛 TypeError', () => {
    // @ts-expect-error RP-35 的契约错位本身就是类型错：裸对象不是 ServiceStatus[]
    expect(() => legacyHealthyNames(REAL_BACKEND_PAYLOAD)).toThrow(TypeError)
  })

  it('归一化后同一份真实裸对象可安全 filter（恢复后绿）', () => {
    const names = normalizeHealthPayload(REAL_BACKEND_PAYLOAD)
      .filter((s) => s.status === 'healthy')
      .map((s) => s.name)
    expect(names).toEqual(['@ihui/api'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
