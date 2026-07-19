/**
 * 真实微信登录流程单元测试
 * 覆盖:
 *  - 非微信环境拒绝
 *  - wx.login 拿 code → 后端换 token 完整链路
 *  - 拒绝授权 getUserProfile 不阻断登录
 *  - 持久化 token / refreshToken / userInfo
 *  - nickname/avatar 合并(后端优先,前端 profile 兜底)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// hoisted 状态对象,确保 vi.mock 工厂能访问(vi.mock 会被 hoist 到 import 之前)
const { taroStorage, mockReLaunch, mockShowToast } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  mockReLaunch: vi.fn(),
  mockShowToast: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  ENV_TYPE: { WEAPP: 'weapp', WEB: 'web', H5: 'h5' },
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, val: unknown) => {
    taroStorage[key] = val
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  reLaunch: (opts: { url: string }) => mockReLaunch(opts),
  showToast: (opts: unknown) => mockShowToast(opts),
  login: (opts: { success?: (r: { code: string }) => void; fail?: (e: unknown) => void }) => {
    if (opts.success) opts.success({ code: 'mock-code-001' })
  },
  getUserProfile: (opts: { success?: (r: unknown) => void; fail?: (e: unknown) => void }) => {
    if (opts.success)
      opts.success({
        userInfo: { nickName: 'MiniMax', avatarUrl: 'https://cdn/avatar.png' },
      })
  },
  getEnv: () => 'weapp',
  // 提供 default export: import Taro from '@tarojs/taro' 这种 ESM 默认导入要用到
  default: {
    ENV_TYPE: { WEAPP: 'weapp', WEB: 'web', H5: 'h5' },
    getEnv: () => 'weapp',
    login: (opts: { success?: (r: { code: string }) => void }) => {
      if (opts.success) opts.success({ code: 'mock-code-001' })
    },
    getUserProfile: (opts: { success?: (r: unknown) => void }) => {
      if (opts.success)
        opts.success({
          userInfo: { nickName: 'MiniMax', avatarUrl: 'https://cdn/avatar.png' },
        })
    },
    getStorageSync: (key: string) => taroStorage[key] ?? '',
    setStorageSync: (key: string, val: unknown) => {
      taroStorage[key] = val
    },
    removeStorageSync: (key: string) => {
      delete taroStorage[key]
    },
    reLaunch: (opts: { url: string }) => mockReLaunch(opts),
    showToast: (opts: unknown) => mockShowToast(opts),
  },
}))

vi.mock('../../api', () => ({
  loginByWechat: vi.fn(async (code: string) => ({
    accessToken: `at-${code}`,
    refreshToken: `rt-${code}`,
    expiresIn: 7200,
    refreshExpiresIn: 2592000,
    user: {
      id: 'u-001',
      nickname: 'Backend Nick',
      avatar: 'https://cdn/backend.png',
      uuid: 'u-001',
    },
  })),
}))

import { wechatLogin, isWechatMiniProgram, type WechatClient } from '../wechat-login'
import { getToken, getUserInfo, getRefreshToken, isLoggedIn } from '../auth'

describe('miniapp-taro 真实微信登录', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    vi.clearAllMocks()
  })

  it('isWechatMiniProgram 仅在 weapp 时为 true', () => {
    expect(isWechatMiniProgram('weapp')).toBe(true)
    expect(isWechatMiniProgram('web')).toBe(false)
    expect(isWechatMiniProgram('h5')).toBe(false)
  })

  it('非 weapp 环境直接抛错', async () => {
    const client: WechatClient = {
      login: vi.fn(),
      getEnv: () => 'web',
    }
    await expect(wechatLogin({}, client)).rejects.toThrow('请在微信小程序中使用微信登录')
    expect(client.login).not.toHaveBeenCalled()
  })

  it('完整流程:wx.login 拿 code → 后端换 token → 持久化', async () => {
    const client: WechatClient = {
      login: vi.fn(async () => 'code-xyz'),
      getUserProfile: vi.fn(async () => ({
        userInfo: { nickName: 'WX Nick', avatarUrl: 'https://wx/avatar.png' },
      })),
      getEnv: () => 'weapp',
    }
    const result = await wechatLogin({ withProfile: true }, client)
    expect(result.user.id).toBe('u-001')
    expect(result.user.nickname).toBe('Backend Nick') // 后端优先
    expect(result.user.avatar).toBe('https://cdn/backend.png') // 后端优先
    expect(isLoggedIn()).toBe(true)
    expect(getToken()).toBe('at-code-xyz')
    expect(getRefreshToken()).toBe('rt-code-xyz')
    expect((getUserInfo() as { id: string }).id).toBe('u-001')
  })

  it('withProfile=false 时不调用 getUserProfile', async () => {
    const getUserProfile = vi.fn()
    const client: WechatClient = {
      login: vi.fn(async () => 'code-2'),
      getUserProfile,
      getEnv: () => 'weapp',
    }
    await wechatLogin({ withProfile: false }, client)
    expect(getUserProfile).not.toHaveBeenCalled()
  })

  it('用户拒绝 getUserProfile 不阻断登录,昵称用默认', async () => {
    const client: WechatClient = {
      login: vi.fn(async () => 'code-3'),
      getUserProfile: vi.fn(async () => {
        throw new Error('user deny')
      }),
      getEnv: () => 'weapp',
    }
    const result = await wechatLogin({ withProfile: true }, client)
    expect(result.user.nickname).toBe('Backend Nick') // 后端有昵称就用后端的
    expect(isLoggedIn()).toBe(true)
  })

  it('后端无昵称时,使用微信 profile 昵称', async () => {
    const { loginByWechat } = await import('../../api')
    vi.mocked(loginByWechat).mockResolvedValueOnce({
      accessToken: 'at-x',
      refreshToken: 'rt-x',
      expiresIn: 1,
      refreshExpiresIn: 1,
      user: { id: 'u-no-nick', uuid: 'u-no-nick' } as never,
    })
    const client: WechatClient = {
      login: vi.fn(async () => 'code-4'),
      getUserProfile: vi.fn(async () => ({
        userInfo: { nickName: 'FromWX', avatarUrl: 'https://wx/x.png' },
      })),
      getEnv: () => 'weapp',
    }
    const result = await wechatLogin({ withProfile: true }, client)
    expect(result.user.nickname).toBe('FromWX')
    expect(result.user.avatar).toBe('https://wx/x.png')
  })

  it('后端 + profile 都无昵称时,降级为 "微信用户"', async () => {
    const { loginByWechat } = await import('../../api')
    vi.mocked(loginByWechat).mockResolvedValueOnce({
      accessToken: 'at-y',
      refreshToken: 'rt-y',
      expiresIn: 1,
      refreshExpiresIn: 1,
      user: { id: 'u-empty', uuid: 'u-empty' } as never,
    })
    const client: WechatClient = {
      login: vi.fn(async () => 'code-5'),
      getUserProfile: vi.fn(async () => ({ userInfo: {} as never })),
      getEnv: () => 'weapp',
    }
    const result = await wechatLogin({ withProfile: true }, client)
    expect(result.user.nickname).toBe('微信用户')
  })

  it('wx.login 返回空 code 时抛错', async () => {
    const client: WechatClient = {
      login: vi.fn(async () => ''),
      getEnv: () => 'weapp',
    }
    await expect(wechatLogin({}, client)).rejects.toThrow('微信登录 code 为空')
  })

  it('后端接口错误时抛出(供上层 toast 提示)', async () => {
    const { loginByWechat } = await import('../../api')
    vi.mocked(loginByWechat).mockRejectedValueOnce(new Error('unionid not found'))
    const client: WechatClient = {
      login: vi.fn(async () => 'code-6'),
      getEnv: () => 'weapp',
    }
    await expect(wechatLogin({}, client)).rejects.toThrow('unionid not found')
  })
})
