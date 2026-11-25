// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 朋友圈本地媒体路由契约：列表返回 JSON，单文件按 content-type 原样回 Buffer；
 * 鉴权与归属校验由真实 manager 层负责，这里只验证 HTTP 边界不丢字节、不猜 MIME。
 */
import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'user-1'
    return true
  }),
}))

vi.mock('../../services/wechat-hub/manager.js', () => ({
  wechatHubManager: {
    listMomentMedia: vi.fn(),
    readMomentMedia: vi.fn(),
  },
}))

import { wechatHubManager } from '../../services/wechat-hub/manager.js'
import { wechatHubOperationsRoutes } from '../wechat-hub-operations.js'

const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0xd9])

describe('朋友圈本地媒体路由', () => {
  beforeEach(() => {
    vi.mocked(wechatHubManager.listMomentMedia).mockReset()
    vi.mocked(wechatHubManager.readMomentMedia).mockReset()
  })

  it('列表返回 JSON，单文件返回原始字节', async () => {
    const app = Fastify()
    await app.register(wechatHubOperationsRoutes)
    await app.ready()
    vi.mocked(wechatHubManager.listMomentMedia).mockResolvedValue([
      { name: 'a.jpg', size: IMAGE.length, contentType: 'image/jpeg' },
    ])
    vi.mocked(wechatHubManager.readMomentMedia).mockResolvedValue({
      contentType: 'image/jpeg',
      data: IMAGE,
    })

    const list = await app.inject({
      method: 'GET',
      url: '/wechat-hub/accounts/account-1/moments/media/list?momentId=m-1',
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toEqual({
      code: 0,
      message: 'success',
      data: [{ name: 'a.jpg', size: 4, contentType: 'image/jpeg' }],
    })

    const media = await app.inject({
      method: 'GET',
      url: '/wechat-hub/accounts/account-1/moments/media?momentId=m-1&name=a.jpg',
    })
    expect(media.statusCode).toBe(200)
    expect(media.headers['content-type']).toBe('image/jpeg')
    expect(media.rawPayload.equals(IMAGE)).toBe(true)
    await app.close()
  })
})
