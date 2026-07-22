import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage, fns } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  fns: {
    showShareMenu: vi.fn(),
    hideShareMenu: vi.fn(),
    showToast: vi.fn(),
  },
}))

vi.mock('@tarojs/taro', () => {
  const mock = {
    getStorageSync: (key: string) => taroStorage[key] ?? '',
    showShareMenu: fns.showShareMenu,
    hideShareMenu: fns.hideShareMenu,
    showToast: fns.showToast,
  }
  return { ...mock, default: mock }
})

import {
  getInviteCode,
  getSharePath,
  getShareInfo,
  getTimelineShareInfo,
  showShareMenu,
  hideShareMenu,
  onShareSuccess,
  shareConfig,
} from '../src/utils/share'

describe('miniapp-taro 分享功能', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    vi.clearAllMocks()
  })

  describe('getInviteCode', () => {
    it('无用户信息时返回空字符串', () => {
      expect(getInviteCode()).toBe('')
    })

    it('有 inviteCode 时返回', () => {
      taroStorage['ihui_user_info'] = { inviteCode: 'INVITE123' }
      expect(getInviteCode()).toBe('INVITE123')
    })

    it('用户信息无 inviteCode 字段时返回空字符串', () => {
      taroStorage['ihui_user_info'] = { id: 'u1', nickname: 'Test' }
      expect(getInviteCode()).toBe('')
    })
  })

  describe('getSharePath', () => {
    it('默认路径使用 fallbackPath', () => {
      const path = getSharePath()
      expect(path).toContain(shareConfig.fallbackPath)
      expect(path).toContain('source=share')
      expect(path).toContain('inviteCode=')
    })

    it('传入自定义路径', () => {
      const path = getSharePath('/pages/detail/detail')
      expect(path).toContain('/pages/detail/detail?')
    })

    it('路径已有 ? 时用 & 拼接', () => {
      const path = getSharePath('/pages/detail?id=1')
      expect(path).toContain('/pages/detail?id=1&source=share')
    })

    it('路径无 ? 时用 ? 拼接', () => {
      const path = getSharePath('/pages/index')
      expect(path).toContain('/pages/index?source=share')
    })

    it('包含 inviteCode 参数', () => {
      taroStorage['ihui_user_info'] = { inviteCode: 'ABC' }
      const path = getSharePath('/pages/test')
      expect(path).toContain('inviteCode=ABC')
    })
  })

  describe('getShareInfo', () => {
    it('使用默认 title 和 imageUrl', () => {
      const info = getShareInfo()
      expect(info.title).toBe(shareConfig.defaultTitle)
      expect(info.imageUrl).toBe(shareConfig.defaultImageUrl)
      expect(info.path).toContain('source=share')
    })

    it('自定义 title 和 imageUrl', () => {
      const info = getShareInfo('/pages/test', '自定义标题', 'https://img.png')
      expect(info.title).toBe('自定义标题')
      expect(info.imageUrl).toBe('https://img.png')
    })

    it('只有 title 时 imageUrl 用默认值', () => {
      const info = getShareInfo(undefined, '自定义标题')
      expect(info.title).toBe('自定义标题')
      expect(info.imageUrl).toBe(shareConfig.defaultImageUrl)
    })
  })

  describe('getTimelineShareInfo', () => {
    it('使用默认值', () => {
      const info = getTimelineShareInfo()
      expect(info.title).toBe(shareConfig.defaultTitle)
      expect(info.imageUrl).toBe(shareConfig.defaultImageUrl)
      expect(info.query).toContain('source=share')
      expect(info.query).toContain('inviteCode=')
    })

    it('自定义 title 和 imageUrl', () => {
      const info = getTimelineShareInfo('朋友圈标题', 'https://img.png')
      expect(info.title).toBe('朋友圈标题')
      expect(info.imageUrl).toBe('https://img.png')
    })

    it('包含 inviteCode', () => {
      taroStorage['ihui_user_info'] = { inviteCode: 'XYZ' }
      const info = getTimelineShareInfo()
      expect(info.query).toContain('inviteCode=XYZ')
    })
  })

  describe('showShareMenu', () => {
    it('默认参数调用', () => {
      showShareMenu()
      expect(fns.showShareMenu).toHaveBeenCalledWith({
        withShareTicket: true,
        showShareItems: ['shareAppMessage', 'shareTimeline'],
      })
    })

    it('withShareTicket=false', () => {
      showShareMenu(false)
      expect(fns.showShareMenu).toHaveBeenCalledWith({
        withShareTicket: false,
        showShareItems: ['shareAppMessage', 'shareTimeline'],
      })
    })

    it('自定义 showShareItems', () => {
      showShareMenu(true, ['shareAppMessage'])
      expect(fns.showShareMenu).toHaveBeenCalledWith({
        withShareTicket: true,
        showShareItems: ['shareAppMessage'],
      })
    })
  })

  describe('hideShareMenu', () => {
    it('调用 Taro.hideShareMenu', () => {
      hideShareMenu()
      expect(fns.hideShareMenu).toHaveBeenCalled()
    })
  })

  describe('onShareSuccess', () => {
    it('显示分享成功 toast', () => {
      onShareSuccess()
      expect(fns.showToast).toHaveBeenCalledWith({
        title: '分享成功', icon: 'success', duration: 2000,
      })
    })
  })
})
