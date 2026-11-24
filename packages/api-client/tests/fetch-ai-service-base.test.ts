// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import { setTransport, type Transport, type TransportInit } from '../src/transport.js'
import { fetchAiServiceJson, setAiServiceBase, setBaseUrl } from '../src/client.js'

/**
 * fetchAiServiceJson 的 ai-service 专用基址通道(2026-10-12 立)。
 *
 * 锁定真实故障:web 端在"Tauri + 本地 origin(dev 8801)"下 REST 共享 baseUrl 是
 * 本机 API 8802,而 /api/checkin/* 等路由只存在于 ai-service(8803) ——
 * fetchAiServiceJson 复用共享基址把它们打到 8802 → Fastify 404
 * (信封 `Route GET:/api/checkin/accounts not found`)。
 *
 * 三条契约:
 *   ① 未注入(null,默认):沿用共享 baseUrl —— RN/extension/Taro 等其它端零回归;
 *   ② 注入非空:直连指定 base(Tauri 本地 dev → 8803),且尾斜杠归一不产生 `//`;
 *   ③ 注入 ''(同源):输出裸路径 —— 浏览器 dev 走 next rewrites / 生产走 nginx 反代。
 */

/** 捕获 fetchAiServiceJson 实际发出的 URL */
function captureUrls(): { urls: string[]; transport: Transport } {
  const urls: string[] = []
  const transport: Transport = vi.fn(async (url: string, _init: TransportInit) => {
    urls.push(url)
    return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' }
  }) as unknown as Transport
  setTransport(transport)
  return { urls, transport }
}

afterEach(() => {
  // 复位:恢复默认 transport + 清掉基址注入,避免模块级状态串用例
  setTransport(undefined as unknown as Transport)
  setAiServiceBase(null)
  setBaseUrl('')
})

describe('fetchAiServiceJson ai-service 专用基址通道', () => {
  it('① 未注入(null)沿用共享 baseUrl —— 旧行为锁定,其它端零回归', async () => {
    const { urls } = captureUrls()
    setBaseUrl('http://127.0.0.1:8802')

    await fetchAiServiceJson('/api/checkin/accounts')

    expect(urls).toEqual(['http://127.0.0.1:8802/api/checkin/accounts'])
  })

  it('② 注入非空直连指定 base(桌面端 dev 场景 → 8803),不再落 8802', async () => {
    const { urls } = captureUrls()
    setBaseUrl('http://127.0.0.1:8802') // REST 共享基址仍是 8802
    setAiServiceBase('http://127.0.0.1:8803')

    await fetchAiServiceJson('/api/checkin/accounts')

    expect(urls).toEqual(['http://127.0.0.1:8803/api/checkin/accounts'])
    // 显式断言坏值不再出现(404 的直接原因:共享基址 8802)
    expect(urls[0]).not.toContain('8802')
  })

  it('② 注入的尾斜杠被归一,不产生 `//`', async () => {
    const { urls } = captureUrls()
    setAiServiceBase('http://127.0.0.1:8803/')

    await fetchAiServiceJson('/api/checkin/records')

    expect(urls).toEqual(['http://127.0.0.1:8803/api/checkin/records'])
  })

  it('③ 注入空串(同源)输出裸路径 —— 浏览器 dev 走 rewrites / 生产走 nginx 反代', async () => {
    const { urls } = captureUrls()
    setBaseUrl('http://127.0.0.1:8802')
    setAiServiceBase('')

    await fetchAiServiceJson('/api/checkin/accounts')

    expect(urls).toEqual(['/api/checkin/accounts'])
  })

  it('params 通道在专用基址下同样生效(带 query 的签到端点不受影响)', async () => {
    const { urls } = captureUrls()
    setAiServiceBase('http://127.0.0.1:8803')

    await fetchAiServiceJson('/api/checkin/records', { params: { page: 1, kw: 'trae' } })

    expect(urls).toEqual(['http://127.0.0.1:8803/api/checkin/records?page=1&kw=trae'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
