// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * admin 技能市场列表字段契约测试(行为变更票:恒空 → 能显示)。
 *
 * 立因:后端 GET /skills/market 返回 `{ items, total, page, pageSize }`
 * (packages/shared/src/skills/market.ts 的 SkillMarketListResponse,apps/api/src/routes/skills.ts
 * 写入),用户侧 apps/web/app/(main)/skills/market/page.tsx 读 `items` 一直正确;
 * 而 admin 侧(types.ts / SkillMarketDialog.tsx / api-client 出口)按 `list` 解包 ⇒ **恒空**。
 *
 * 两层判据,缺一不可:
 *  A 运行时:mock api-client 返回**后端现契约形态**(items),断言 searchMarketSkills
 *    真按 items 解包并映射出非空视图模型(只改类型让编译器闭嘴过不了这一层)。
 *  B 源码锚点(反向对照):消费链四个文件里凡"解包/声明键"处必须是 `items`,出现
 *    `?.list` / `list:` 解包形态即红 —— 有人改回 `list` 时 A 可能因 mock 同步被改而失真,
 *    B 是独立的一道牙。变异取证:把 dialog 解包改回 `marketData?.list` ⇒ B 红;
 *    把 helpers 改回 `return r.data`(类型不随改) ⇒ typecheck 红、A 红。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const dialogFile = resolve(here, '..', 'SkillMarketDialog.tsx')
const typesFile = resolve(here, '..', 'types.ts')
const helpersFile = resolve(here, '..', 'helpers.ts')
// here = apps/web/app/(main)/admin/skills/__tests__ → 上溯 7 级到仓库根
const apiClientFile = resolve(
  here,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'api-client',
  'src',
  'endpoints',
  'skills-market.ts',
)

// helpers 的导入面只有两处:@ihui/api-client(fetchMarketSkills)与 @/lib/api(api() 通路,
// 本测试不触发)。mock 掉即可在无网络/无 Next 环境下直测 searchMarketSkills。
vi.mock('@ihui/api-client', () => ({ fetchMarketSkills: vi.fn() }))
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))

import { fetchMarketSkills } from '@ihui/api-client'
import { searchMarketSkills } from '../helpers'

type MarketFetchResult = Awaited<ReturnType<typeof fetchMarketSkills>>

/** 与后端 SkillMarketEntry 逐字段同形的夹具(少一个字段都会在映射处暴露类型错) */
const ENTRY_A = {
  name: 'web-scraper',
  description: 'A scraper skill',
  tags: ['automation', 'scraping'],
  author: 'IHUI',
  version: '1.2.0',
  license: 'MIT',
  installCount: 42,
  rating: 4.5,
  ratingCount: 8,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  enabled: true,
  source: 'builtin' as const,
}
const ENTRY_B = { ...ENTRY_A, name: 'pdf-tools', description: 'PDF toolkit' }

function backendEnvelope() {
  // 后端现契约:键是 items。这里刻意**不给** list 键 —— 按 list 解包的实现拿到的是 undefined。
  return {
    success: true,
    data: { items: [ENTRY_A, ENTRY_B], total: 2, page: 1, pageSize: 20 },
  } as MarketFetchResult
}

describe('A · 运行时:searchMarketSkills 真按 items 解包(恒空缺陷的行为级证明)', () => {
  beforeEach(() => {
    vi.mocked(fetchMarketSkills).mockReset()
  })

  it('后端返回 items 两条目 ⇒ 视图模型非空、字段逐项落位', async () => {
    vi.mocked(fetchMarketSkills).mockResolvedValue(backendEnvelope())
    const r = await searchMarketSkills('', '', 1, 20)
    expect(r.items).toHaveLength(2)
    const first = r.items[0]
    expect(first).toBeDefined()
    // id 以 name 为键(市场条目没有数据库 id;detail/install/unlist 均按 name 寻址)
    expect(first?.id).toBe('web-scraper')
    expect(first?.name).toBe('web-scraper')
    expect(first?.description).toBe('A scraper skill')
    expect(first?.version).toBe('1.2.0')
    expect(first?.author).toBe('IHUI')
    expect(first?.rating).toBe(4.5)
    expect(first?.installCount).toBe(42)
    expect(first?.createdAt).toBe('2026-08-01T00:00:00.000Z')
    expect(first?.tags).toEqual(['automation', 'scraping'])
    expect(r.total).toBe(2)
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(20)
  })

  it('反向对照:响应只带 items 而无 list ⇒ 按 list 解包的旧实现此处必为空', async () => {
    vi.mocked(fetchMarketSkills).mockResolvedValue(backendEnvelope())
    const r = await searchMarketSkills('q', '', 1, 20)
    // 旧缺陷形态:marketData?.list ?? [] ⇒ 恒 []。这里断言"非空"即反向钉死改回 list 必红。
    expect(r.items.length).toBeGreaterThan(0)
    const legacyListShape = r as unknown as { list?: unknown }
    expect(legacyListShape.list).toBeUndefined()
  })

  it('请求参数原样透传给 api-client 出口(不手拼 URL)', async () => {
    vi.mocked(fetchMarketSkills).mockResolvedValue(backendEnvelope())
    await searchMarketSkills('pdf', 'tag-x', 3, 10)
    expect(fetchMarketSkills).toHaveBeenCalledWith({
      q: 'pdf',
      tag: 'tag-x',
      page: 3,
      pageSize: 10,
    })
  })
})

describe('B · 源码锚点:消费链四个文件的解包/声明键必须都是 items', () => {
  it('SkillMarketDialog 按 items 解包,且全文件不存在 ?.list 解包形态', () => {
    const src = readFileSync(dialogFile, 'utf8')
    expect(src).toMatch(/marketData\?\.items\s*\?\?\s*\[\]/)
    expect(src).not.toMatch(/\?\.list\b/)
  })

  it('types.ts 的 MarketListResponse 声明 items: MarketSkill[](list 声明不得回潮)', () => {
    const src = readFileSync(typesFile, 'utf8')
    const block = src.match(/export interface MarketListResponse\s*\{[\s\S]*?\n\}/)
    expect(block, 'MarketListResponse 接口须保持在 types.ts(签名被改先修本测试)').not.toBeNull()
    expect(block?.[0]).toMatch(/items:\s*MarketSkill\[\]/)
    expect(block?.[0]).not.toMatch(/(^|[{\s,])list:\s*MarketSkill\[\]/)
  })

  it('api-client 出口 SkillMarketListResult 声明 items(旧 list 契约注释不得回潮)', () => {
    const src = readFileSync(apiClientFile, 'utf8')
    const block = src.match(/export interface SkillMarketListResult\s*\{[\s\S]*?\n\}/)
    expect(block, 'SkillMarketListResult 须保持在 api-client 出口').not.toBeNull()
    expect(block?.[0]).toMatch(/items:\s*SkillMarketItem\[\]/)
    expect(block?.[0]).not.toMatch(/(^|[{\s,])list:\s*SkillMarketItem\[\]/)
  })

  it('helpers.searchMarketSkills 从 data.items 取值(改回 data.list 即红)', () => {
    const src = readFileSync(helpersFile, 'utf8')
    const body = src.match(/export async function searchMarketSkills[\s\S]*?\n\}/)
    expect(body, 'searchMarketSkills 函数体须存在').not.toBeNull()
    expect(body?.[0]).toMatch(/data\.items/)
    expect(body?.[0]).not.toMatch(/data\.list/)
  })
})
// ⁠占位尾行,inject 会补第三层载荷
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
