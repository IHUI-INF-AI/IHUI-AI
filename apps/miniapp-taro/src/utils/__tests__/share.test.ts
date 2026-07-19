/**
 * 分享工具单元测试
 * 验证:
 * 1) getSharePath 自动追加 source + inviteCode 参数
 * 2) getShareInfo 默认值 + 自定义值
 * 3) getTimelineShareInfo 包含 query 字段
 * 4) 不依赖真实 Taro runtime(纯函数路径解析)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const taroStorage: Record<string, unknown> = {}
vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, val: unknown) => {
    taroStorage[key] = val
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  showShareMenu: vi.fn(),
  hideShareMenu: vi.fn(),
  showToast: vi.fn(),
}))

import { getSharePath, getShareInfo, getTimelineShareInfo, shareConfig } from '../share'

describe('miniapp-taro share 工具', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
  })

  it('getSharePath 自动追加 source + inviteCode', () => {
    taroStorage['ihui_user_info'] = { inviteCode: 'ABC123' }
    const path = getSharePath('/pages/course/detail')
    expect(path).toContain('source=share')
    expect(path).toContain('inviteCode=ABC123')
    expect(path).toMatch(/^\/pages\/course\/detail\?/)
  })

  it('getSharePath 已有 query 时用 & 追加', () => {
    taroStorage['ihui_user_info'] = { inviteCode: 'ABC123' }
    const path = getSharePath('/pages/course/detail?id=1')
    expect(path).toContain('id=1')
    expect(path).toContain('&source=share')
    expect(path).toContain('&inviteCode=ABC123')
    expect(path).not.toContain('?source') // 不应该用 ? 追加
  })

  it('getSharePath 无 inviteCode 时 query 中 inviteCode 为空值', () => {
    // 行为:即便无 inviteCode,query 仍追加 inviteCode= 占位
    taroStorage['ihui_user_info'] = {}
    const path = getSharePath('/pages/index/index')
    expect(path).toContain('source=share')
    expect(path).toContain('inviteCode=')
    expect(path).not.toContain('inviteCode=ABC123')
  })

  it('getSharePath 无 userInfo 时不抛错', () => {
    // 没有 ihui_user_info 时,函数安全降级
    const path = getSharePath('/pages/index/index')
    expect(path).toContain('source=share')
    expect(path).toBe('/pages/index/index?source=share&inviteCode=')
  })

  it('getShareInfo 使用默认 title 与图片', () => {
    taroStorage['ihui_user_info'] = { inviteCode: 'ABC123' }
    const info = getShareInfo()
    expect(info.title).toBe(shareConfig.defaultTitle)
    expect(info.imageUrl).toBe(shareConfig.defaultImageUrl)
    expect(info.path).toContain('source=share')
    expect(info.path).toContain('inviteCode=ABC123')
  })

  it('getShareInfo 支持自定义 title/imageUrl', () => {
    taroStorage['ihui_user_info'] = { inviteCode: 'ABC123' }
    const info = getShareInfo('/pages/course/detail', '好课推荐', 'https://img.example.com/cover.png')
    expect(info.title).toBe('好课推荐')
    expect(info.imageUrl).toBe('https://img.example.com/cover.png')
    expect(info.path).toBe('/pages/course/detail?source=share&inviteCode=ABC123')
  })

  it('getTimelineShareInfo 包含 query 字段', () => {
    taroStorage['ihui_user_info'] = { inviteCode: 'ABC123' }
    const info = getTimelineShareInfo()
    expect(info.title).toBe(shareConfig.defaultTitle)
    expect(info.query).toContain('source=share')
    expect(info.query).toContain('inviteCode=ABC123')
  })

  it('getTimelineShareInfo 支持自定义 title', () => {
    taroStorage['ihui_user_info'] = { inviteCode: 'ABC123' }
    const info = getTimelineShareInfo('加入智汇AI')
    expect(info.title).toBe('加入智汇AI')
  })
})
