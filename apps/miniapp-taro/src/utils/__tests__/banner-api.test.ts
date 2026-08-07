/**
 * 运营 banner API 单元测试
 * 验证 getBannerList 调用参数 + 失败降级路径
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// hoisted 状态 — vi.mock 工厂会用到
const { mockFetchApi } = vi.hoisted(() => ({ mockFetchApi: vi.fn() }))

// mock Taro:避免触发 @tarojs/runtime 的 ENABLE_INNER_HTML 全局依赖
vi.mock('@tarojs/taro', () => ({
  ENV_TYPE: { WEAPP: 'weapp', WEB: 'web', H5: 'h5' },
  getEnv: () => 'weapp',
  getStorageSync: () => '',
  setStorageSync: () => {},
  removeStorageSync: () => {},
  showToast: () => {},
  reLaunch: () => {},
  default: {
    ENV_TYPE: { WEAPP: 'weapp', WEB: 'web', H5: 'h5' },
    getEnv: () => 'weapp',
    getStorageSync: () => '',
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showToast: () => {},
    reLaunch: () => {},
  },
}))

// mock @ihui/api-client:拦截 fetchApi 调用,返回 ApiResult<T>
// getBannerList/getHomePage 内部走 api-bridge.ts → fetchApi(url, { method, params })
vi.mock('@ihui/api-client', () => ({
  fetchApi: (url: string, options?: { method?: string; params?: unknown }) =>
    mockFetchApi(url, options?.params),
}))

import { getBannerList, getHomePage, type Banner } from '../../api'

describe('miniapp-taro 运营 banner API', () => {
  beforeEach(() => {
    mockFetchApi.mockReset()
  })

  it('getBannerList 调用 /content/banner/list 并透传 position + status', async () => {
    mockFetchApi.mockResolvedValueOnce({
      success: true,
      data: {
        list: [
          {
            id: 1,
            title: '618 课程大促',
            coverUrl: 'https://cdn/b1.png',
            link: '/pages/course/list',
            linkType: 'page',
            position: 'home',
            sortOrder: 100,
            status: 1,
          },
        ],
        total: 1,
      },
    })
    const res = await getBannerList({ position: 'home', status: 1 })
    expect(mockFetchApi).toHaveBeenCalledWith('/content/banner/list', { position: 'home', status: 1 })
    expect(res.list).toHaveLength(1)
    const first: Banner = res.list[0] as Banner
    expect(first.title).toBe('618 课程大促')
    expect(first.linkType).toBe('page')
    expect(first.status).toBe(1)
  })

  it('getBannerList 不传参数时正常请求', async () => {
    mockFetchApi.mockResolvedValueOnce({ success: true, data: { list: [], total: 0 } })
    const res = await getBannerList()
    expect(mockFetchApi).toHaveBeenCalledWith('/content/banner/list', undefined)
    expect(res.total).toBe(0)
  })

  it('getBannerList 后端报错时抛错(由调用方决定降级)', async () => {
    mockFetchApi.mockResolvedValueOnce({ success: false, error: '网络异常' })
    await expect(getBannerList({ position: 'home' })).rejects.toThrow('网络异常')
  })

  it('getHomePage 返回 { banner: Banner[] } 结构', async () => {
    mockFetchApi.mockResolvedValueOnce({
      success: true,
      data: {
        banner: [
          { id: 'a', title: 'A', coverUrl: 'https://a.png' },
          { id: 'b', title: 'B', coverUrl: 'https://b.png', link: '/pages/x' },
        ],
      },
    })
    const res = await getHomePage()
    expect(res.banner).toHaveLength(2)
    const list = res.banner as Banner[]
    expect(list[0]?.title).toBe('A')
    expect(list[1]?.link).toBe('/pages/x')
  })

  it('Banner 类型兼容 linkType 枚举值', () => {
    // 类型层面验证
    const a: Banner = { id: 1, title: 't', coverUrl: 'c', linkType: 'webview' }
    const b: Banner = { id: 2, title: 't', coverUrl: 'c', linkType: 'page' }
    const c: Banner = { id: 3, title: 't', coverUrl: 'c', linkType: 'none' }
    expect([a.linkType, b.linkType, c.linkType]).toEqual(['webview', 'page', 'none'])
  })
})