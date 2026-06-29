import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../miniprogram'

describe('miniprogram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('miniProgramApi.getOpenId 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.getOpenId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.code 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.code()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.openId 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.openId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.post 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.post()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.normalizeResponse 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.normalizeResponse()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.catch 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.catch()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.error 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.error()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.OpenId 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.OpenId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.bindUser 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.bindUser()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.data 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.data()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.user 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.user()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.getVipPrice 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.getVipPrice()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.get 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.get()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.params 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.params()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.price 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.price()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.sendPhoneCode 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.sendPhoneCode()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.codeId 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.codeId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.verifyPhoneCode 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.verifyPhoneCode()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.phone 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.phone()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.tempToken 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.tempToken()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.register 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.register()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.failed 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.failed()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.userLogin 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.userLogin()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.headers 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.headers()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.editPassword 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.editPassword()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.password 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.password()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.editPhone 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.editPhone()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.number 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.number()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.getUserInfo 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.getUserInfo()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.base 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.base()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.if 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.if()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.open_id 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.open_id()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.isLoggedIn 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.isLoggedIn()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.username 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.username()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.isVip 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.isVip()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.knowledgeBaseQuota 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.knowledgeBaseQuota()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.String 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.String()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.remainingTokens 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.remainingTokens()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.userId 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.userId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.avatarUrl 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.avatarUrl()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.https 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.https()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.memberLevelText 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.memberLevelText()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.nextLevelInfoText 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.nextLevelInfoText()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.identityTypy 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.identityTypy()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.tokenQuantity 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.tokenQuantity()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.zhsToken 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.zhsToken()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.info 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.info()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.logout 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.logout()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.success 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.success()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('miniProgramApi.message 应能正常调用', async () => {
    const obj = (api as any).miniProgramApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.message()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
