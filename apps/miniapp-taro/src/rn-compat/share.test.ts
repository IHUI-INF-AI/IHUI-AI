// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

const taro = vi.hoisted(() => ({
  setClipboardData: vi.fn(async () => ({})),
  showShareMenu: vi.fn(),
  showModal: vi.fn(async () => ({ confirm: true })),
}))

vi.mock('@tarojs/taro', () => ({ default: taro }))
vi.mock('@tarojs/components', () => ({
  View: () => null,
  Text: () => null,
  ScrollView: () => null,
  Image: () => null,
  Input: () => null,
  Switch: () => null,
  Textarea: () => null,
}))

import { Share } from './apis'

beforeEach(() => {
  taro.setClipboardData.mockClear()
  taro.setClipboardData.mockResolvedValue({})
  taro.showShareMenu.mockClear()
  taro.showModal.mockClear()
})

describe('rn-compat Share', () => {
  it('常量与 RN 同名同值(调用方按 Share.sharedAction 比较)', () => {
    expect(Share.sharedAction).toBe('sharedAction')
    expect(Share.dismissedAction).toBe('dismissedAction')
  })

  it('优先复制 url,并打开转发菜单(好友 + 朋友圈),不再弹 modal', async () => {
    const res = await Share.share({ title: 't', message: 'm', url: 'https://a.example/x' })
    expect(taro.setClipboardData).toHaveBeenCalledTimes(1)
    expect(taro.setClipboardData).toHaveBeenCalledWith({ data: 'https://a.example/x' })
    expect(taro.showShareMenu).toHaveBeenCalledTimes(1)
    const options = taro.showShareMenu.mock.calls[0]?.[0] as {
      withShareTicket?: boolean
      showShareItems?: string[]
      fail?: () => void
    }
    expect(options.withShareTicket).toBe(true)
    expect(options.showShareItems).toEqual(['shareAppMessage', 'shareTimeline'])
    expect(typeof options.fail).toBe('function')
    expect(taro.showModal).not.toHaveBeenCalled()
    expect(res).toEqual({ action: 'sharedAction', activityType: undefined })
  })

  it('无 url 时复制 message', async () => {
    const res = await Share.share({ message: '看这个: https://a.example/y' })
    expect(taro.setClipboardData).toHaveBeenCalledWith({ data: '看这个: https://a.example/y' })
    expect(res.action).toBe('sharedAction')
  })

  it('剪贴板被拒 ⇒ 仍打开转发菜单,不把整次分享判失败', async () => {
    taro.setClipboardData.mockRejectedValueOnce(new Error('denied'))
    const res = await Share.share({ message: 'm' })
    expect(taro.showShareMenu).toHaveBeenCalledTimes(1)
    expect(res.action).toBe('sharedAction')
  })

  it('无内容且平台没有转发菜单 API ⇒ dismissedAction(调用方的取消分支可达)', async () => {
    const original = taro.showShareMenu
    // @ts-expect-error 模拟不提供该 API 的宿主
    taro.showShareMenu = undefined
    const res = await Share.share({})
    expect(res.action).toBe('dismissedAction')
    expect(taro.setClipboardData).not.toHaveBeenCalled()
    taro.showShareMenu = original
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
