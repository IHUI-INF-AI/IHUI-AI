import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getI18nGlobal } from '@/locales'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'
import type { UserInfoData } from '@/api/user'
import type { ThirdPartyLoginData } from './types'
import { extractUuid, extractIsVip } from './utils'
import { useTokenStore } from './token'
import { useUserStore } from './user'
import { useWalletStore } from './wallet'
import { useVipStore } from './vip'

export const useThirdPartyStore = defineStore('thirdParty', () => {
  const isLoading = ref(false)

  const thirdPartyLogin = async (loginData: ThirdPartyLoginData): Promise<boolean> => {
    try {
      isLoading.value = true

      const tokenStore = useTokenStore()
      const userStore = useUserStore()
      const walletStore = useWalletStore()
      const vipStore = useVipStore()

      tokenStore.setToken(loginData.token, loginData.refreshToken)

      const rawUser = loginData.user as Record<string, unknown>
      const authInfoData = rawUser.authInfo as { email?: string; phone?: string; userUuid?: string; username?: string } | undefined

      const userEmail = (rawUser.email || authInfoData?.email || '') as string
      const userPhone = (rawUser.phone || authInfoData?.phone || '') as string
      const userUuid = extractUuid(rawUser)
      const userNickname = (rawUser.nickname || authInfoData?.username || rawUser.username || '') as string

      logger.info('[ThirdPartyStore] UUID extraction debug:', {
        'rawUser.uuid': rawUser.uuid,
        'rawUser.id': rawUser.id,
        'authInfoData?.userUuid': authInfoData?.userUuid,
        extractedUuid: userUuid,
      })

      const userIsVip = extractIsVip(rawUser.isVip as boolean | number | undefined)

      const vipLevelVOData = rawUser.vipLevelVO as {
        id?: string
        title?: string
        levelName?: string
        level?: number
        userVip?: { isValid?: number }
        [key: string]: unknown
      } | undefined

      const userMarginData = rawUser.userMargin as {
        id?: string
        userUuid?: string
        tokenQuantity?: string | number
        [key: string]: unknown
      } | undefined

      const identityType = (rawUser.identityType as number) ?? (rawUser.identityTypy as number) ?? 0

      userStore.user = {
        id: userUuid,
        uuid: userUuid,
        username: (rawUser.username || '') as string,
        email: userEmail,
        phone: userPhone,
        nickname: userNickname,
        avatar: (rawUser.avatar || '') as string,
        gender: (rawUser.gender as number) ?? 0,
        birthday: (rawUser.birthday || '') as string,
        signature: (rawUser.signature || '') as string,
        status: (rawUser.status as number) ?? 1,
        isVip: userIsVip,
        inviteCode: (rawUser.inviteCode || '') as string,
        createTime: (rawUser.createTime || new Date().toISOString()) as string,
        updateTime: (rawUser.updateTime || new Date().toISOString()) as string,
        needPwd: (rawUser.needPwd as number) ?? 0,
        vipLevelVO: vipLevelVOData ? { levelName: vipLevelVOData.title || vipLevelVOData.levelName || '', levelValue: vipLevelVOData.level || 0, ...vipLevelVOData } : undefined,
        identityType,
      } as UserInfoData

      if (userMarginData) {
        const tokenQuantityRaw = typeof userMarginData.tokenQuantity === 'string' ? parseFloat(userMarginData.tokenQuantity) : userMarginData.tokenQuantity || 0
        const tokenQuantity = Number.isFinite(Number(tokenQuantityRaw)) ? Number(tokenQuantityRaw) : 0
        walletStore.setFundInfo({
          id: userMarginData.id || '',
          userId: userMarginData.userUuid || userUuid,
          balance: tokenQuantity,
          frozenAmount: 0,
          totalRecharge: 0,
          totalConsumption: 0,
          totalWithdraw: 0,
          updateTime: new Date().toISOString(),
        })
      }

      if (vipLevelVOData) {
        vipStore.setVipInfo({
          id: vipLevelVOData.id || '',
          userId: userUuid,
          vipLevelId: vipLevelVOData.id || '',
          vipLevelName: vipLevelVOData.title || vipLevelVOData.levelName || '',
          startTime: '',
          endTime: '',
          isExpired: false,
          isActive: vipLevelVOData.userVip?.isValid === 1,
          privileges: [],
        })
      }

      const userData = {
        ...userStore.user,
        thirdPartyAccounts: { accessToken: loginData.token, refreshToken: loginData.refreshToken || '', loginType: loginData.loginType },
        authInfo: authInfoData,
        fundInfo: walletStore.fundInfo,
        vipInfo: vipStore.vipInfo,
        loginTime: new Date().toISOString(),
        lastActiveTime: new Date().toISOString(),
      }

      logger.info('[ThirdPartyStore] Storage data debug:', {
        'userStore.user.uuid': userStore.user?.uuid,
        'userStore.user.id': userStore.user?.id,
        userDataUuid: userData.uuid,
        userDataId: userData.id,
      })

      StorageManager.setItem(STORAGE_KEYS.USER_DATA, userData)

      logger.debug('[ThirdPartyStore] Third-party login successful:', {
        uuid: userUuid,
        nickname: userNickname,
        isVip: userIsVip,
        loginType: loginData.loginType,
      })

      return true
    } catch (error) {
      logger.error(getI18nGlobal().t('logs.thirdPartyLoginFailed'), error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    thirdPartyLogin,
  }
})
