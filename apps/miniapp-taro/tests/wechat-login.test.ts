import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage, mockLoginByWechat } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  mockLoginByWechat: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const mock = {
    ENV_TYPE: { WEAPP: 'weapp', WEB: 'web', H5: 'h5', RN: 'rn', ALIPAY: 'alipay' },
    getStorageSync: (key: string) => taroStorage[key] ?? '',
    setStorageSync: (key: string, val: unknown) => { taroStorage[key] = val },
    removeStorageSync: (key: string) => { delete taroStorage[key] },
    reLaunch: vi.fn(),
    showToast: vi.fn(),
    login: vi.fn(),
    getUserProfile: vi.fn(),
    getEnv: () => 'weapp',
  }
  return { ...mock, default: mock }
})

vi.mock('../src/api', () => ({
  loginByWechat: mockLoginByWechat,
}))

import { wechatLogin, isWechatMiniProgram, type WechatClient } from '../src/utils/wechat-login'
import { getToken, getRefreshToken, getUserInfo, isLoggedIn } from '../src/utils/auth'

describe('miniapp-taro 微信静默登录', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    vi.clearAllMocks()
  })

  describe('isWechatMiniProgram', () => {
    it('weapp 环境返回 true', () => {
      expect(isWechatMiniProgram('weapp')).toBe(true)
    })

    it('web 环境返回 false', () => {
      expect(isWechatMiniProgram('web')).toBe(false)
    })

    it('h5 环境返回 false', () => {
      expect(isWechatMiniProgram('h5')).toBe(false)
    })
  })

  describe('code 获取', () => {
    it('成功获取 code 并登录', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-001', refreshToken: 'rt-001',
        expiresIn: 7200, refreshExpiresIn: 2592000,
        user: { id: 'u-001', nickname: 'User', uuid: 'u-001' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'wx-code-123'),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({}, client)
      expect(result.user.id).toBe('u-001')
      expect(mockLoginByWechat).toHaveBeenCalledWith('wx-code-123')
    })

    it('code 为空时抛错', async () => {
      const client: WechatClient = {
        login: vi.fn(async () => ''),
        getEnv: () => 'weapp',
      }
      await expect(wechatLogin({}, client)).rejects.toThrow('微信登录 code 为空')
      expect(mockLoginByWechat).not.toHaveBeenCalled()
    })

    it('client.login 抛错时传播异常', async () => {
      const client: WechatClient = {
        login: vi.fn(async () => { throw new Error('wx.login failed') }),
        getEnv: () => 'weapp',
      }
      await expect(wechatLogin({}, client)).rejects.toThrow('wx.login failed')
    })
  })

  describe('静默登录', () => {
    it('不带 profile 的静默登录成功', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-silent', refreshToken: 'rt-silent',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-silent', nickname: 'SilentUser', uuid: 'u-silent' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'silent-code'),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({}, client)
      expect(result.user.nickname).toBe('SilentUser')
      expect(getToken()).toBe('at-silent')
      expect(getRefreshToken()).toBe('rt-silent')
      expect(isLoggedIn()).toBe(true)
    })

    it('持久化 token 和 userInfo', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-persist', refreshToken: 'rt-persist',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-persist', nickname: 'Persist', avatar: 'https://avatar.png', uuid: 'u-persist' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'persist-code'),
        getEnv: () => 'weapp',
      }
      await wechatLogin({}, client)
      const userInfo = getUserInfo()
      expect(userInfo).not.toBeNull()
      expect((userInfo as { id: string }).id).toBe('u-persist')
      expect((userInfo as { nickname: string }).nickname).toBe('Persist')
    })

    it('后端返回的 isNewUser 标志传递', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-new', refreshToken: 'rt-new',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-new', nickname: 'NewUser', uuid: 'u-new', isNewUser: true } as never,
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'new-code'),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({}, client)
      expect(result.isNewUser).toBe(true)
    })

    it('isNewUser 默认 false', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-old', refreshToken: 'rt-old',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-old', nickname: 'OldUser', uuid: 'u-old' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'old-code'),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({}, client)
      expect(result.isNewUser).toBe(false)
    })
  })

  describe('登录失败降级', () => {
    it('非微信环境抛错', async () => {
      const client: WechatClient = {
        login: vi.fn(),
        getEnv: () => 'web',
      }
      await expect(wechatLogin({}, client)).rejects.toThrow('请在微信小程序中使用微信登录')
      expect(client.login).not.toHaveBeenCalled()
    })

    it('后端 API 错误时抛出供上层处理', async () => {
      mockLoginByWechat.mockRejectedValue(new Error('unionid not found'))
      const client: WechatClient = {
        login: vi.fn(async () => 'fail-code'),
        getEnv: () => 'weapp',
      }
      await expect(wechatLogin({}, client)).rejects.toThrow('unionid not found')
    })

    it('后端返回用户无昵称时用默认值', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-nonnick', refreshToken: 'rt-nonnick',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-nonnick', uuid: 'u-nonnick' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'nonnick-code'),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({}, client)
      expect(result.user.nickname).toBe('微信用户')
    })

    it('withProfile=true 但拒绝授权时不阻断登录', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-deny', refreshToken: 'rt-deny',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-deny', nickname: 'DenyUser', uuid: 'u-deny' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'deny-code'),
        getUserProfile: vi.fn(async () => { throw new Error('user deny') }),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({ withProfile: true }, client)
      expect(result.user.nickname).toBe('DenyUser')
      expect(isLoggedIn()).toBe(true)
    })

    it('withProfile=false 不调用 getUserProfile', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-noprofile', refreshToken: 'rt-noprofile',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-noprofile', nickname: 'NoProfile', uuid: 'u-noprofile' },
      })
      const getUserProfile = vi.fn()
      const client: WechatClient = {
        login: vi.fn(async () => 'no-profile-code'),
        getUserProfile,
        getEnv: () => 'weapp',
      }
      await wechatLogin({ withProfile: false }, client)
      expect(getUserProfile).not.toHaveBeenCalled()
    })

    it('后端无昵称但 profile 有昵称时用 profile 昵称', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-profile-nick', refreshToken: 'rt-profile-nick',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-nonick', uuid: 'u-nonick' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'profile-nick-code'),
        getUserProfile: vi.fn(async () => ({
          userInfo: { nickName: 'WX Nick', avatarUrl: 'https://wx/avatar.png' },
        })),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({ withProfile: true }, client)
      expect(result.user.nickname).toBe('WX Nick')
      expect(result.user.avatar).toBe('https://wx/avatar.png')
    })

    it('后端有昵称时优先用后端昵称', async () => {
      mockLoginByWechat.mockResolvedValue({
        accessToken: 'at-backend-nick', refreshToken: 'rt-backend-nick',
        expiresIn: 3600, refreshExpiresIn: 86400,
        user: { id: 'u-backend', nickname: 'Backend Nick', avatar: 'https://backend.png', uuid: 'u-backend' },
      })
      const client: WechatClient = {
        login: vi.fn(async () => 'backend-nick-code'),
        getUserProfile: vi.fn(async () => ({
          userInfo: { nickName: 'WX Nick', avatarUrl: 'https://wx/avatar.png' },
        })),
        getEnv: () => 'weapp',
      }
      const result = await wechatLogin({ withProfile: true }, client)
      expect(result.user.nickname).toBe('Backend Nick')
      expect(result.user.avatar).toBe('https://backend.png')
    })
  })
})
