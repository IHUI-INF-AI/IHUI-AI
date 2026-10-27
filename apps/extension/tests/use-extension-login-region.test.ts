// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ getOAuthStatus: vi.fn() }))

vi.mock('@ihui/api-client', () => ({ getOAuthStatus: h.getOAuthStatus }))

import { __test__ } from '../src/hooks/use-extension-login-region'

/**
 * 扩展端取数腿(2026-10-27 立)。排序判据在 @ihui/ui-react 的 planLoginRegion,
 * 这里只钉「取不取得到、取到的是不是脏值、取几次」——三点都是失效会**安静**的那一类:
 *   ① 取不到被读成 domestic ⇒ 海外用户看到微信扫码优先(需求反了却全绿);
 *   ② 每次渲染都发一次 GET ⇒ 弹窗打开三轮打三次;
 *   ③ 失败不缓存 ⇒ 同一个弹窗反复重试、登录页抖动。
 */
beforeEach(() => {
  h.getOAuthStatus.mockReset()
  __test__.resetLoginRegionCache()
})

/** 响应形态由被测函数自己判(它只认两个字面量),这里按"服务器可能吐出的任意形态"喂。 */
type Status = Parameters<typeof __test__.readLoginRegionFromStatus>[0]
const status = (value: unknown): Status => value as Status

describe('readLoginRegionFromStatus — 只认两个字面量', () => {
  it('domestic / overseas 透传', () => {
    expect(
      __test__.readLoginRegionFromStatus(
        status({ success: true, data: { loginRegion: 'domestic' } }),
      ),
    ).toBe('domestic')
    expect(
      __test__.readLoginRegionFromStatus(
        status({ success: true, data: { loginRegion: 'overseas' } }),
      ),
    ).toBe('overseas')
  })

  it('success=false / 缺键 / 第三种值 ⇒ null(未判定,不猜成国内)', () => {
    expect(__test__.readLoginRegionFromStatus(status({ success: false }))).toBeNull()
    expect(__test__.readLoginRegionFromStatus(status({ success: true, data: {} }))).toBeNull()
    expect(
      __test__.readLoginRegionFromStatus(status({ success: true, data: { loginRegion: 'mars' } })),
    ).toBeNull()
    expect(__test__.readLoginRegionFromStatus(status({ success: true }))).toBeNull()
  })
})

describe('loadLoginRegion — 一次弹窗生命周期只取一次', () => {
  it('两个消费者并发调用只发一次 GET(模块级缓存)', async () => {
    h.getOAuthStatus.mockResolvedValue({ success: true, data: { loginRegion: 'overseas' } })
    const [a, b] = await Promise.all([__test__.loadLoginRegion(), __test__.loadLoginRegion()])
    expect(a).toBe('overseas')
    expect(b).toBe('overseas')
    expect(h.getOAuthStatus).toHaveBeenCalledTimes(1)
  })

  it('失败也算这一轮的结论:同样只发一次,返回 null', async () => {
    h.getOAuthStatus.mockRejectedValue(new Error('network'))
    await expect(__test__.loadLoginRegion()).resolves.toBeNull()
    await expect(__test__.loadLoginRegion()).resolves.toBeNull()
    expect(h.getOAuthStatus).toHaveBeenCalledTimes(1)
  })

  it('重置缓存后重新取(下一轮打开面板会重判)', async () => {
    h.getOAuthStatus.mockResolvedValue({ success: true, data: { loginRegion: 'domestic' } })
    await __test__.loadLoginRegion()
    __test__.resetLoginRegionCache()
    h.getOAuthStatus.mockResolvedValue({ success: true, data: { loginRegion: 'overseas' } })
    await expect(__test__.loadLoginRegion()).resolves.toBe('overseas')
    expect(h.getOAuthStatus).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
