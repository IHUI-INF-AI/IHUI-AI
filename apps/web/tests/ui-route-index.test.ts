// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 全站路由索引单测:摘要零路径 + 按需检索 top-N(令牌成本硬约束回归面)
import { describe, it, expect } from 'vitest'

import { MAX_ROUTE_QUERY_RESULTS, NAVIGATE_DENY_RE, buildRouteIndex } from '@/lib/ui-route-index'
import { UI_ROUTES } from '@/lib/ui-routes.generated'

describe('路由检索摘要(冷 describe)', () => {
  it('total/navigable 与生成表一致,组计数总和=navigable', () => {
    const idx = buildRouteIndex()
    expect(idx.total).toBe(UI_ROUTES.length)
    expect(idx.total).toBeGreaterThan(800)
    expect(idx.navigable).toBeLessThanOrEqual(idx.total)
    expect(idx.groups.reduce((s, g) => s + g.count, 0)).toBe(idx.navigable)
  })

  it('冷摘要不暴露任何完整路径(879 条一次性铺出=0)', () => {
    const idx = buildRouteIndex()
    expect(idx.matches).toBeUndefined()
    expect(idx.queryable).toBe(true)
    const json = JSON.stringify(idx)
    // groups 只有 {prefix,count};路径形态 "/xxx" 绝不允许出现
    expect(json).not.toMatch(/"\//)
    for (const route of UI_ROUTES.slice(0, 100)) {
      expect(json).not.toContain(`"${route.path}"`)
    }
  })

  it('摘要桶数封顶 24+1,冷回执体积受控(<2KB)', () => {
    const idx = buildRouteIndex()
    expect(idx.groups.length).toBeLessThanOrEqual(25)
    const bytes = new TextEncoder().encode(JSON.stringify(idx)).length
    console.info(`[route-index] 冷摘要字节数=${bytes}`)
    expect(bytes).toBeLessThan(2048)
  })

  it('login/sso/api 禁跳路径整体不在检索面内', () => {
    const idx = buildRouteIndex('login')
    expect((idx.matches ?? []).some((m) => m.path === '/login')).toBe(false)
    for (const m of idx.matches ?? []) {
      expect(NAVIGATE_DENY_RE.test(m.path)).toBe(false)
    }
    for (const m of buildRouteIndex('sso').matches ?? []) {
      expect(NAVIGATE_DENY_RE.test(m.path)).toBe(false)
    }
    for (const m of buildRouteIndex('a', MAX_ROUTE_QUERY_RESULTS).matches ?? []) {
      expect(NAVIGATE_DENY_RE.test(m.path)).toBe(false)
    }
  })
})

describe('路由按需检索(describe query=…)', () => {
  it('关键词命中:全部匹配且带 group/param 标注', () => {
    const idx = buildRouteIndex('wallet')
    expect(idx.query).toBe('wallet')
    expect(idx.matchTotal ?? 0).toBeGreaterThan(0)
    expect((idx.matches ?? []).length).toBeGreaterThan(0)
    for (const m of idx.matches ?? []) {
      expect(m.path.toLowerCase()).toContain('wallet')
      expect(typeof m.group).toBe('string')
      expect(typeof m.param).toBe('boolean')
    }
  })

  it('命中封顶 40,limit 生效,带 query 回执受控(<6KB)', () => {
    const capped = buildRouteIndex('admin')
    expect((capped.matches ?? []).length).toBe(MAX_ROUTE_QUERY_RESULTS)
    const small = buildRouteIndex('admin', 5)
    expect((small.matches ?? []).length).toBeLessThanOrEqual(5)
    expect(small.matchTotal ?? 0).toBeGreaterThanOrEqual(small.matches?.length ?? 0)
    const bytes = new TextEncoder().encode(JSON.stringify(capped)).length
    console.info(`[route-index] 满 40 条命中回执字节数=${bytes}`)
    expect(bytes).toBeLessThan(6144)
  })

  it('多段路径片段检索(精确优先)', () => {
    const idx = buildRouteIndex('/wallet/recharge')
    expect(idx.matches?.[0]?.path).toBe('/wallet/recharge')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
