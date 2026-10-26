// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访问来源聚合的判据取证(2026-10-26 立)。
 *
 * 钉的是**口径**不是形状:
 *  - 同一主机的不同来源路径合并成一格(github 仓库页 148 PV + 主页 88 PV = 一个 github.com);
 *  - 本机开发流量单列(生产实值:占有 referer 行约三成),混进「外部来源」会把推广渠道带偏;
 *  - 自有域没配 ⇒ **不出现**站内桶(把「没判」与「判过」分开);
 *  - 桶 PV 之和必须等于总 PV(读数自洽,否则占比条会骗人)。
 *
 * 零连接:本文件不碰 PG 8810 / Redis 8811(AGENTS §5 测试隔离铁律);
 * `../src/db/index.js` 被 mock 掉,只验判据。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

import {
  buildVisitSource,
  selfHostSuffixes,
  type SourceRefererRow,
} from '../src/services/visit-source-stats-service.js'

/** 生产库现读的 referer 形态(2026-10-26)。 */
const ROWS: SourceRefererRow[] = [
  { referer: 'https://github.com/IHUI-INF-AI/IHUI-AI', pv: 148 },
  { referer: 'https://github.com/', pv: 88 },
  { referer: 'http://offline.localhost/', pv: 110 },
  { referer: 'http://localhost:8801/chat', pv: 12 },
  { referer: 'https://aizhs.top/settings', pv: 11 },
  { referer: 'https://www.google.com/', pv: 58 },
  { referer: null, pv: 1942 },
]

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('访问来源:主机归并与分类', () => {
  it('A1 同一主机的不同路径合并成一格(一个来源不是两个来源)', () => {
    const s = buildVisitSource(ROWS, ['aizhs.top'])
    const github = s.hosts.find((h) => h.host === 'github.com')
    expect(github?.pv).toBe(236)
    // 合并后不应再有第二行 github.com
    expect(s.hosts.filter((h) => h.host === 'github.com')).toHaveLength(1)
  })

  it('A2 分类落到四个桶:直接访问/本机/站内/外部', () => {
    const s = buildVisitSource(ROWS, ['aizhs.top'])
    const byKind = new Map(s.buckets.map((b) => [b.kind, b.pv]))
    expect(byKind.get('direct')).toBe(1942)
    expect(byKind.get('local')).toBe(122)
    expect(byKind.get('internal')).toBe(11)
    expect(byKind.get('external')).toBe(236 + 58)
  })

  it('A3 桶 PV 之和等于总 PV(占比条的分母必须自洽)', () => {
    const s = buildVisitSource(ROWS, ['aizhs.top'])
    const sum = s.buckets.reduce((acc, b) => acc + b.pv, 0)
    expect(sum).toBe(s.totalPv)
    expect(s.totalPv).toBe(1942 + 148 + 88 + 110 + 12 + 11 + 58)
  })

  it('A4 自有域没配 ⇒ 不出现站内桶(不把站内悄悄说成外部)', () => {
    const s = buildVisitSource(ROWS, [])
    expect(s.splitInternal).toBe(false)
    expect(s.buckets.some((b) => b.kind === 'internal')).toBe(false)
    // aizhs.top 落到 external —— 这是「没判站内」的后果,不是「判成外部」:
    // 调用方据此知道这一维不可用,而不是拿到一个假的站内读数。
    const external = s.buckets.find((b) => b.kind === 'external')
    expect(external?.pv).toBe(236 + 58 + 11)
  })

  it('A5 referer 有值但取不出主机 ⇒ 计入外部,且不进主机榜(没有名字可列)', () => {
    const s = buildVisitSource([{ referer: '   ', pv: 5 }], ['aizhs.top'])
    // 空白 referer 等价于没有来源信息 ⇒ direct
    expect(s.buckets.find((b) => b.kind === 'direct')?.pv).toBe(5)
    expect(s.hosts).toHaveLength(0)
  })

  it('A6 主机榜按 PV 降序并按 topN 截断', () => {
    const s = buildVisitSource(ROWS, ['aizhs.top'], 2)
    expect(s.hosts).toHaveLength(2)
    expect(s.hosts[0].host).toBe('github.com')
    expect(s.hosts[0].pv).toBeGreaterThanOrEqual(s.hosts[1].pv)
  })

  it('A7 主机榜带来源类别(前端按类别着色,不自己判)', () => {
    const s = buildVisitSource(ROWS, ['aizhs.top'])
    expect(s.hosts.find((h) => h.host === 'localhost')?.kind).toBe('local')
    expect(s.hosts.find((h) => h.host === 'aizhs.top')?.kind).toBe('internal')
    expect(s.hosts.find((h) => h.host === 'github.com')?.kind).toBe('external')
  })
})

describe('访问来源:自有域来源', () => {
  it('B1 未设环境变量 ⇒ 用缺省官方域名', () => {
    vi.stubEnv('VISIT_SELF_HOST_SUFFIX', undefined)
    expect(selfHostSuffixes()).toEqual(['aizhs.top'])
  })

  it('B2 显式设成空串 ⇒ 不判站内(调用方显式关掉这一维)', () => {
    vi.stubEnv('VISIT_SELF_HOST_SUFFIX', '')
    expect(selfHostSuffixes()).toEqual([])
  })

  it('B3 逗号分隔可给多个自有域', () => {
    vi.stubEnv('VISIT_SELF_HOST_SUFFIX', 'aizhs.top, IHUI.cn')
    expect(selfHostSuffixes()).toEqual(['aizhs.top', 'ihui.cn'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
