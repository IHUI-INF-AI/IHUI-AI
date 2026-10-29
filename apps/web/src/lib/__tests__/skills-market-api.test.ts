// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * skills-market-api 单测(2026-09-15,第三梯队 #14):
 * 覆盖 ① 检索参数拼装(q/tag/分页) ② 安装/评分/订阅的动作请求形状
 * ③ 错误抛出(api 返回 success:false 时 throw)。
 * fetchApi 以 vi.mock 打桩,不触真实网络。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchApiMock = vi.fn()

vi.mock('@/lib/api', () => ({
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}))

import {
  fetchSkillsMarket,
  installSkill,
  rateSkill,
  subscribeSkill,
  SKILL_MARKET_PAGE_SIZE,
} from '../skills-market-api'

describe('skills-market-api', () => {
  beforeEach(() => {
    fetchApiMock.mockReset()
  })

  it('fetchSkillsMarket:拼装分页与过滤参数(省略空值)', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 20 },
    })
    await fetchSkillsMarket({ q: 'seo', tag: '写作', page: 2, pageSize: 20 })
    const url = fetchApiMock.mock.calls[0]![0] as string
    expect(url).toContain('/api/skills/market?')
    expect(url).toContain('page=2')
    expect(url).toContain('pageSize=20')
    expect(url).toContain('q=seo')
    expect(url).toContain(encodeURIComponent('写作'))
  })

  it('fetchSkillsMarket:pageSize 缺省走 SKILL_MARKET_PAGE_SIZE', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 20 },
    })
    await fetchSkillsMarket({})
    expect(fetchApiMock.mock.calls[0]![0]).toContain(`pageSize=${SKILL_MARKET_PAGE_SIZE}`)
  })

  it('installSkill:POST 到 /install 端点', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: { name: 'seo-writer', installed: true, installCount: 12 },
    })
    const r = await installSkill('seo-writer')
    const [url, opts] = fetchApiMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('/api/skills/seo-writer/install')
    expect(opts?.method).toBe('POST')
    expect(r.installed).toBe(true)
  })

  it('rateSkill:携带 score/comment 的 JSON 体', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: { id: 'r1', userId: 1, userName: 'u', skillName: 's', score: 5 },
    })
    await rateSkill('demo-skill', { score: 5, comment: '好用' })
    const [url, opts] = fetchApiMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('/api/skills/demo-skill/rate')
    expect(JSON.parse(opts?.body as string)).toEqual({ score: 5, comment: '好用' })
  })

  it('subscribeSkill:POST /subscribe', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: { subscribed: true, subscriberCount: 3 },
    })
    await subscribeSkill('s')
    const [url, opts] = fetchApiMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('/api/skills/s/subscribe')
    expect(opts?.method).toBe('POST')
  })

  it('api 返回 success:false 时抛错(页面错误态依赖此行为)', async () => {
    fetchApiMock.mockResolvedValue({ success: false, error: 'boom' })
    await expect(fetchSkillsMarket({})).rejects.toThrow('boom')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
