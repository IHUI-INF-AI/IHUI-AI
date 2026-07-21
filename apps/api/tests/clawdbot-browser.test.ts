import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { BrowserAutomation, getBrowserAutomation } from '../src/services/clawdbot/browser.js'

const mockResponse = (text: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => text,
  json: async () => JSON.parse(text),
  headers: new Map() as Headers,
})

describe('clawdbot BrowserAutomation 浏览器自动化', () => {
  let auto: BrowserAutomation
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => {
    auto = new BrowserAutomation()
    fetchSpy.mockReset()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  describe('navigate 导航', () => {
    it('成功导航并返回页面信息', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html><title>Test</title>body</html>') as never)
      const page = await auto.navigate('https://example.com')
      expect(page.url).toBe('https://example.com')
      expect(page.title).toBe('Test')
      expect(page.statusCode).toBe(200)
      expect(page.id).toMatch(/^page_[a-z0-9]+$/)
    })

    it('页面被存储到 pages Map', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>x</html>') as never)
      const page = await auto.navigate('https://x.com')
      expect(auto.getPage(page.id)?.url).toBe('https://x.com')
    })

    it('触发 navigated 事件', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>x</html>') as never)
      const handler = vi.fn()
      auto.on('navigated', handler)
      await auto.navigate('https://x.com')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('fetch 失败时抛错', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network') as never)
      await expect(auto.navigate('https://x.com')).rejects.toThrow('network')
    })

    it('自定义 headers 传递给 fetch', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>x</html>') as never)
      await auto.navigate('https://x.com', { headers: { Authorization: 'Bearer x' } })
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://x.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer x',
            'User-Agent': 'Clawdbot/1.0',
          }),
        }),
      )
    })
  })

  describe('scrape 抓取', () => {
    it('带 extract 时按选择器抽取', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse('<html><title>T</title><h1>Headline</h1></html>') as never,
      )
      const r = await auto.scrape({
        url: 'https://x.com',
        extract: [{ name: 'title', selector: 'h1' }],
      })
      expect(r.statusCode).toBe(200)
      expect(r.title).toBe('T')
      expect(Array.isArray(r.data.title)).toBe(true)
    })

    it('无 extract 但有 selector 时 default 字段', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html><h1>x</h1></html>') as never)
      const r = await auto.scrape({ url: 'https://x.com', selector: 'h1' })
      expect(Array.isArray(r.data.default)).toBe(true)
    })

    it('无 extract 且无 selector 时存原始 html', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>raw</html>') as never)
      const r = await auto.scrape({ url: 'https://x.com' })
      expect(r.data.html).toContain('raw')
    })

    it('触发 scraped 事件', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>x</html>') as never)
      const handler = vi.fn()
      auto.on('scraped', handler)
      await auto.scrape({ url: 'https://x.com' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('#id 选择器', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<div id="main">content</div>') as never)
      const r = await auto.scrape({
        url: 'https://x.com',
        extract: [{ name: 'main', selector: '#main' }],
      })
      expect(r.data.main).toContain('content')
    })

    it('.class 选择器', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse('<div class="item">a</div><div class="item">b</div>') as never,
      )
      const r = await auto.scrape({
        url: 'https://x.com',
        extract: [{ name: 'items', selector: '.item' }],
      })
      expect(Array.isArray(r.data.items)).toBe(true)
    })
  })

  describe('fillForm 表单填写', () => {
    it('成功提交返回 success=true', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('ok', 200) as never)
      const r = await auto.fillForm({ url: 'https://x.com', fields: { name: 'alice' } })
      expect(r.success).toBe(true)
      expect(r.submitted).toBe(true)
    })

    it('非 ok 状态 submitted=false', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('fail', 500) as never)
      const r = await auto.fillForm({ url: 'https://x.com', fields: { name: 'alice' } })
      expect(r.success).toBe(true)
      expect(r.submitted).toBe(false)
    })

    it('fetch 失败返回 success=false', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network') as never)
      const r = await auto.fillForm({ url: 'https://x.com', fields: { name: 'alice' } })
      expect(r.success).toBe(false)
      expect(r.error).toBe('network')
    })

    it('触发 formFilled 事件', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('ok', 200) as never)
      const handler = vi.fn()
      auto.on('formFilled', handler)
      await auto.fillForm({ url: 'https://x.com', fields: {} })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getPage / listPages / closePage', () => {
    it('getPage 返回指定页面', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>x</html>') as never)
      const p = await auto.navigate('https://x.com')
      expect(auto.getPage(p.id)?.url).toBe('https://x.com')
    })

    it('getPage 不存在返回 undefined', () => {
      expect(auto.getPage('not_exist')).toBeUndefined()
    })

    it('listPages 返回全部页面', async () => {
      fetchSpy.mockResolvedValue(mockResponse('<html>x</html>') as never)
      await auto.navigate('https://x.com')
      await auto.navigate('https://y.com')
      expect(auto.listPages()).toHaveLength(2)
      fetchSpy.mockReset()
    })

    it('closePage 删除页面返回 true', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>x</html>') as never)
      const p = await auto.navigate('https://x.com')
      expect(auto.closePage(p.id)).toBe(true)
      expect(auto.getPage(p.id)).toBeUndefined()
    })

    it('closePage 不存在返回 false', () => {
      expect(auto.closePage('not_exist')).toBe(false)
    })
  })

  describe('getStats', () => {
    it('返回 openPages 数', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse('<html>x</html>') as never)
      await auto.navigate('https://x.com')
      expect(auto.getStats().openPages).toBe(1)
    })
  })

  describe('单例', () => {
    it('getBrowserAutomation 返回同一实例', () => {
      expect(getBrowserAutomation()).toBe(getBrowserAutomation())
    })
  })
})
