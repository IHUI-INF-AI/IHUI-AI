import request from '@/utils/request'
import { LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types'

export interface MiniProgramUserInfo {
  open_id: string
  isLoggedIn: boolean
  username: string
  isVip: boolean | null
  knowledgeBaseQuota: string
  remainingTokens: string
  userId: string
  avatarUrl: string
  memberLevelText: string
  nextLevelInfoText: string
  identityTypy: number | null
  tokenQuantity: string
  phone?: string
  zhsToken?: string
}

export interface BackendUserInfo {
  uuid?: string
  username?: string
  nickname?: string
  avatar?: string
  isVip?: boolean
  identityTypy?: number
  phone?: string
  userMargin?: {
    tokenQuantity?: number
  }
  thirdPartyAccounts?: {
    accessToken?: string
  }
}

export interface BindUserData {
  open_id?: string
  nickname: string
  phone: string
  avatar: string
  fileName?: string
}

export interface VipPriceData {
  balance: number
  vipPrice?: number
  vipProducts?: Array<{
    id: string
    name: string
    price: number
    duration: number
  }>
}

export interface PhoneLoginData {
  phone: string
  code: string
}



export interface SendCodeData {
  phone: string
  tempId?: string
  tempCode?: string
}

export interface RegisterData {
  phone: string
  password: string
  parentId?: string
}

export interface UserLoginData {
  phone: string
  password: string
  code?: string
}

export interface EditPwdData {
  phone: string
  password: string
}

export interface EditPhoneData {
  phone: string
  code: string
  uuid: string
}

const normalizeResponse = <T>(response: { code?: number; success?: boolean; message?: string; data?: T }): ApiResponse<T> => {
  if (response?.code === 200 || response?.success === true) {
    return {
      code: 200,
      message: response?.message || '成功',
      data: response?.data,
      success: true,
      timestamp: Date.now(),
    }
  }
  throw new Error(response?.message || '请求失败')
}

export const miniProgramApi = {
  async getOpenId(code: string): Promise<ApiResponse<{ openId: string; unionId?: string }>> {
    try {
      const response = await request.post('/login/wechat/getOpenId', { code })
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Failed to get OpenId:', error)
      throw error
    }
  },

  async bindUser(data: BindUserData): Promise<ApiResponse<MiniProgramUserInfo>> {
    try {
      const response = await request.post('/auth_accounts/bind', data)
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Failed to bind user:', error)
      throw error
    }
  },

  async getVipPrice(token?: string): Promise<ApiResponse<VipPriceData>> {
    try {
      const response = await request.get('/fund/getInfo', {
        params: { token },
      })
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Failed to get VIP price:', error)
      throw error
    }
  },

  async sendPhoneCode(data: SendCodeData): Promise<ApiResponse<{ codeId: string }>> {
    try {
      const response = await request.post(LOGIN_PWD_PATHS.smsVerify, data)
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Failed to send verification code:', error)
      throw error
    }
  },

  async verifyPhoneCode(phone: string, code: string): Promise<ApiResponse<{ tempToken: string }>> {
    try {
      const response = await request.post(LOGIN_PWD_PATHS.verify, { phone, code })
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Failed to verify code:', error)
      throw error
    }
  },

  async register(data: RegisterData): Promise<ApiResponse<MiniProgramUserInfo>> {
    try {
      const response = await request.post(LOGIN_PWD_PATHS.registerLogin, data)
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Registration failed:', error)
      throw error
    }
  },

  async userLogin(data: UserLoginData): Promise<ApiResponse<MiniProgramUserInfo>> {
    try {
      const response = await request.post(LOGIN_PWD_PATHS.login, data, {
        // 登录前接口不会走“已登录(token)后自动补 platform-type”的拦截逻辑，这里需要显式带上
        headers: { 'platform-type': 'web' },
      })
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] User login failed:', error)
      throw error
    }
  },



  async editPassword(data: EditPwdData): Promise<ApiResponse<boolean>> {
    try {
      const response = await request.post(LOGIN_PWD_PATHS.editPasswd, data)
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Failed to modify password:', error)
      throw error
    }
  },

  async editPhone(data: EditPhoneData): Promise<ApiResponse<boolean>> {
    try {
      const response = await request.post(LOGIN_PWD_PATHS.replacePhone, data)
      return normalizeResponse(response)
    } catch (error) {
      logger.error('[Miniprogram] Failed to modify phone number:', error)
      throw error
    }
  },

  async getUserInfo(): Promise<ApiResponse<MiniProgramUserInfo>> {
    try {
      // 使用 Java 主后端（base: 2 -> /api），避免走 /api-kou
      const response = await request.get('/user/info', { base: 2 } as const)
      const normalized = normalizeResponse(response)

      if (normalized.data) {
        const userData = normalized.data as BackendUserInfo
        return {
          ...normalized,
          data: {
            open_id: userData.uuid || '',
            isLoggedIn: true,
            username: userData.username || userData.nickname || '',
            isVip: userData.isVip || false,
            knowledgeBaseQuota: String(userData.userMargin?.tokenQuantity || '0'),
            remainingTokens: String(userData.userMargin?.tokenQuantity || '0'),
            userId: userData.uuid || '',
            avatarUrl: userData.avatar || 'https://file.aizhs.top/sys-mini/daixaodiming.png',
            memberLevelText: userData.isVip ? '黄金会员' : '普通会员',
            nextLevelInfoText: userData.isVip ? '距离铂金会员还差 2000 积分' : '开通会员特权',
            identityTypy: userData.identityTypy || 0,
            tokenQuantity: String(userData.userMargin?.tokenQuantity || 0),
            phone: userData.phone || '',
            zhsToken: userData.thirdPartyAccounts?.accessToken || '',
          },
        }
      }
      return normalized as ApiResponse<MiniProgramUserInfo>
    } catch (error) {
      logger.error('[Miniprogram] Failed to get user info:', error)
      throw error
    }
  },

  async logout(): Promise<ApiResponse<boolean>> {
    // 已移除 auth/logout 接口，直接返回成功
    return { code: 200, success: true, message: 'ok', data: true }
  },
}

export default miniProgramApi
