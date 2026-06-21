/**
 * 登录逻辑组合函数
 * 提取自 UniversalLogin.vue，负责账号密码登录和手机验证码登录的核心逻辑
 */

import { ref, computed, type Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useUserAuth } from '@/composables/useUserAuth'
import { AuthFlowService } from '@/services/auth-flow.service'
import { RememberMeService } from '@/utils/rememberMeService'
import { unifiedLogin } from '@/api/unified-auth'
import { verifyPhoneCode, completePhoneLogin } from '@/api/user'
import { useLoginProject } from '@/composables/login/useLoginProject'
import { logger } from '@/utils/logger'
import request from '@/utils/request'
import { LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { useCleanup } from '@/composables/useCleanup'

export interface LoginFormData {
  username: string
  password: string
  rememberMe: boolean
  captcha: string
}

export interface PhoneFormData {
  phoneNumber: string
  verificationCode: string
  rememberMe: boolean
}

export interface LoginLogicOptions {
  showCaptcha: Ref<boolean>
  captchaKey: Ref<string>
}

export function useLoginLogic(options: LoginLogicOptions) {
  const { showCaptcha, captchaKey } = options
  const cleanup = useCleanup()
  const router = useRouter()
  const route = useRoute()
  const { t } = useI18n()
  const authStore = useAuthStore()
  const userAuth = useUserAuth()
  const { availableProjects } = useLoginProject()

  const loading = computed(() => userAuth.loading.value)
  const loginCooldown = ref(0)
  let loginCooldownTimer: ReturnType<typeof setInterval> | null = null

  const adminRedirectUrl = ref<string>('')

  const startLoginCooldown = (seconds: number): void => {
    loginCooldown.value = seconds
    if (loginCooldownTimer) {
      clearInterval(loginCooldownTimer)
    }
    loginCooldownTimer = cleanup.addInterval(() => {
      loginCooldown.value--
      if (loginCooldown.value <= 0) {
        if (loginCooldownTimer) {
          clearInterval(loginCooldownTimer)
          loginCooldownTimer = null
        }
      }
    }, 1000)
  }

  const handleEnterpriseLogin = async (
    account: string,
    password: string,
    captchaCode: string,
    captchaUuid: string
  ): Promise<void> => {
    const response = await unifiedLogin('admin', {
      phone: account,
      password,
      code: captchaCode,
      uuid: captchaUuid,
    })

    if (!response.success) {
      const msgStr = (response.message || response.msg || '').trim()
      const looksLikeNotRegistered =
        msgStr.includes('未注册') ||
        msgStr.includes('请点击下方注册') ||
        msgStr.includes(t('auth.userNotRegistered'))
      const displayMsg = looksLikeNotRegistered
        ? t('auth.adminLoginNotRegisteredHint')
        : msgStr || t('auth.loginFailed')
      ElMessage.error(displayMsg)
      return
    }

    const data = response.data
    const token =
      (data?.token as string) ||
      (data?.accessToken as string) ||
      (data?.access_token as string)
    const refreshToken =
      (data?.refreshToken as string) ||
      (data?.refresh_token as string) ||
      ''
    const expiresInSeconds =
      (data?.expiresIn as number) ||
      (data?.expires_in as number) ||
      AuthFlowService.calculateExpiresInSeconds()
    const userData =
      (data?.user as Record<string, unknown>) ||
      (data?.userInfo as Record<string, unknown>)

    if (!token) {
      ElMessage.error(t('auth.loginFailedNoToken'))
      return
    }

    let redirectUrl = adminRedirectUrl.value || (route.query.redirect as string) || ''
    if (redirectUrl && !adminRedirectUrl.value) {
      let prevDecoded = ''
      while (redirectUrl !== prevDecoded) {
        prevDecoded = redirectUrl
        try {
          redirectUrl = decodeURIComponent(redirectUrl)
        } catch {
          break
        }
      }
    }

    const source = (route.query.source as string) || 'admin'
    const isCrossProjectSource = source && ['admin', 'edu-web', 'edu-admin'].includes(source)

    if (source === 'admin' && !redirectUrl) {
      const projectInfo = availableProjects.value.find(p => p.key === 'admin')
      const adminBaseUrl = (projectInfo?.url ?? '').replace(/\/$/, '')
      redirectUrl = adminBaseUrl ? `${adminBaseUrl}/index` : ''
    }

    if (isCrossProjectSource && redirectUrl) {
      try {
        const redirectUrlObj = new URL(redirectUrl)
        if (token) {
          redirectUrlObj.searchParams.set('token', token)
          redirectUrlObj.searchParams.set('access_token', token)
        }
        if (refreshToken) {
          redirectUrlObj.searchParams.set('refreshToken', refreshToken)
        }
        if (expiresInSeconds) {
          redirectUrlObj.searchParams.set('expiresIn', String(expiresInSeconds))
          redirectUrlObj.searchParams.set('expires_in', String(expiresInSeconds))
        }
        if (userData) {
          redirectUrlObj.searchParams.set(
            'userInfo',
            encodeURIComponent(JSON.stringify(userData as Record<string, unknown>))
          )
        }
        const finalUrl = redirectUrlObj.toString()
        logger.info('[handleEnterpriseLogin] New window cross-project redirect', { url: finalUrl })
        window.open(finalUrl, '_blank')
        return
      } catch (error) {
        logger.error('[handleEnterpriseLogin] Failed to build enterprise login redirect URL, falling back to default redirect', { error })
      }
    }

    logger.warn('[handleEnterpriseLogin] Missing valid cross-project redirect address, staying on current login page', {
      source,
      redirectUrl,
    })
  }

  const handleAccountLogin = async (formData: LoginFormData): Promise<{ success: boolean; needsRegister?: boolean }> => {
    const account = (formData.username ?? '').trim()
    const password = (formData.password ?? '').trim()
    const isSSOAdmin = route.query.source === 'admin'

    if (!account) {
      ElMessage.warning(t('auth.usernameOrPhoneOrEmail'))
      return { success: false }
    }
    if (!password) {
      ElMessage.warning(t('auth.validation.passwordRequired'))
      return { success: false }
    }
    if (showCaptcha.value) {
      const cap = (formData.captcha ?? '').trim()
      if (!cap) {
        ElMessage.warning(t('auth.captchaPlaceholder'))
        return { success: false }
      }
      if (!/^[a-zA-Z0-9]{1,6}$/.test(cap)) {
        ElMessage.warning(t('auth.imageCaptchaFormatError'))
        return { success: false }
      }
    }
    if (!isSSOAdmin && !/^1[3-9]\d{9}$/.test(account)) {
      ElMessage.warning(t('auth.pleaseEnterCorrectPhone'))
      return { success: false }
    }

    logger.info('[handleAccountLogin] Preparing to login', { isSSOAdmin, accountLen: account.length })

    const captchaCode = showCaptcha.value ? (formData.captcha || '') : ''
    const captchaUuid = showCaptcha.value ? (captchaKey.value || '') : ''

    try {
      if (isSSOAdmin) {
        await handleEnterpriseLogin(account, password, captchaCode, captchaUuid)
        return { success: true }
      }

      const loginPayload: Record<string, string> = { phone: account, password, code: captchaCode, uuid: captchaUuid }
      const response = await request.post(LOGIN_PWD_PATHS.login, loginPayload, {
        headers: { 'platform-type': 'web' },
      })

      logger.info('[handleAccountLogin] Login response', response.data)

      const resData = (response.data as unknown as Record<string, unknown>) || {}
      const resCode = (resData?.code as number | string) ?? 0
      const msg = (resData?.msg || resData?.message || '') as string

      if (resCode === 200 || resCode === '200') {
        const rawData = resData?.data as Record<string, unknown> | undefined
        const userData = (rawData?.user as Record<string, unknown>) || rawData
        const thirdPartyAccounts = userData?.thirdPartyAccounts as Record<string, unknown> | undefined
        const token =
          (thirdPartyAccounts?.accessToken as string) ||
          (userData?.accessToken as string) ||
          (userData?.access_token as string) ||
          (userData?.token as string) ||
          (rawData?.accessToken as string) ||
          (rawData?.access_token as string) ||
          (rawData?.token as string)
        const refreshToken =
          (thirdPartyAccounts?.refreshToken as string) ||
          (userData?.refreshToken as string) ||
          (userData?.refresh_token as string) ||
          (rawData?.refreshToken as string) ||
          (rawData?.refresh_token as string)

        logger.debug('[handleAccountLogin] Parsing result', { hasToken: !!token, hasUserData: !!userData })

        if (token) {
          const userForStore = userData || { uuid: '', id: '', username: account }
          if (!userForStore.uuid && !userForStore.id) {
            (userForStore as Record<string, unknown>).uuid = (userForStore as Record<string, unknown>).id || ''
          }

          await authStore.thirdPartyLogin({
            token,
            refreshToken: refreshToken || '',
            user: userForStore as Record<string, unknown>,
            loginType: 'password',
          })

          if (formData.rememberMe && refreshToken) {
            RememberMeService.setRememberMePreference(true)
            RememberMeService.saveRefreshToken(refreshToken)
            RememberMeService.saveAccountCredentials(account, refreshToken)
          }

          ElMessage.success(t('auth.loginSuccess'))

          const source = route.query.source as string
          let redirectUrl = route.query.redirect as string
          if (redirectUrl) {
            let prev = ''
            while (redirectUrl !== prev) {
              prev = redirectUrl
              try {
                redirectUrl = decodeURIComponent(redirectUrl)
              } catch {
                break
              }
            }
          }
          const isCrossProject = source && ['admin', 'edu-web', 'edu-admin'].includes(source)
          if (isCrossProject && redirectUrl) {
            await AuthFlowService.redirectAfterLogin({
              source,
              redirectUrl,
              token,
              refreshToken: refreshToken || '',
              expiresIn: AuthFlowService.calculateExpiresInSeconds(),
              userInfo: userForStore as Record<string, unknown>,
            })
            return { success: true }
          }

          if (!isCrossProject) {
            void router.push('/')
          }
          return { success: true }
        } else {
          ElMessage.error(t('auth.loginFailedNoToken'))
          return { success: false }
        }
      } else {
        const msgStr = (msg || '').trim()
        const resCode = (resData?.code as number | string) ?? 0
        const isAdminSource = route.query.source === 'admin'
        const looksLikeNotRegistered =
          msgStr.includes('未注册') ||
          msgStr.includes('请点击下方注册') ||
          msgStr.includes(t('auth.userNotRegistered')) ||
          msgStr.includes(t('auth.userDoesNotExist')) ||
          msgStr.includes(t('auth.accountDoesNotExist')) ||
          msgStr.toLowerCase().includes('not found') ||
          resCode === 404 ||
          resCode === 4001
        if (!isAdminSource && looksLikeNotRegistered) {
          return { success: false, needsRegister: true }
        } else {
          const displayMsg =
            isAdminSource && looksLikeNotRegistered
              ? t('auth.adminLoginNotRegisteredHint')
              : msgStr || t('auth.loginFailed')
          ElMessage.error(displayMsg)
          return { success: false }
        }
      }
    } catch (error) {
      logger.error('[handleAccountLogin] Login error', error)
      let errorMsg = error instanceof Error ? error.message : t('auth.loginFailed')
      const isAdminSource = route.query.source === 'admin'
      const looksLikeNotRegistered =
        errorMsg.includes('未注册') ||
        errorMsg.includes('请点击下方注册') ||
        errorMsg.includes(t('auth.userNotRegistered')) ||
        errorMsg.includes(t('auth.userDoesNotExist')) ||
        errorMsg.includes(t('auth.accountDoesNotExist')) ||
        errorMsg.toLowerCase().includes('not found')
      if (!isAdminSource && looksLikeNotRegistered) {
        return { success: false, needsRegister: true }
      } else {
        if (isAdminSource && looksLikeNotRegistered) {
          errorMsg = t('auth.adminLoginNotRegisteredHint')
        }
        ElMessage.error(errorMsg)
        return { success: false }
      }
    }
  }

  const handlePhoneLogin = async (
    formData: PhoneFormData,
    getFullPhoneNumber: () => string
  ): Promise<boolean> => {
    const fullPhoneNumber = getFullPhoneNumber()
    const verificationCode = formData.verificationCode

    try {
      let verifyResponse: Awaited<ReturnType<typeof verifyPhoneCode>>
      try {
        verifyResponse = await verifyPhoneCode({
          phone: fullPhoneNumber,
          code: verificationCode,
        })
      } catch (error) {
        logger.error('[handlePhoneLogin] Verification code validation failed:', error)
        throw error
      }

      if (!verifyResponse.success || !verifyResponse.data) {
        logger.error('[handlePhoneLogin] Invalid verification response:', {
          success: verifyResponse.success,
          data: verifyResponse.data,
          message: verifyResponse.message,
          code: verifyResponse.code,
        })
        throw new Error(verifyResponse.message || '校验验证码失败')
      }

      const tempKey = verifyResponse.data as string
      if (!tempKey || tempKey.trim() === '') {
        logger.error('[handlePhoneLogin] Temporary key is empty')
        throw new Error(t('error.universal_login.临时密钥为空请重2'))
      }
      logger.info('[handlePhoneLogin] Got temporary key successfully:', tempKey)

      const loginData = {
        phone: fullPhoneNumber,
        tempKey: tempKey,
      }

      const response = await completePhoneLogin(loginData)

      const codeNum = typeof response.code === 'string' ? parseInt(response.code, 10) : response.code
      const isSuccess = (codeNum === 200 || response.success === true) && response.data
      logger.debug('[handlePhoneLogin] Is response successful', { isSuccess, code: codeNum, success: response.success })

      if (isSuccess) {
        const loginData = response.data
        let token: string = ''
        let refreshTokenValue: string = ''
        let userInfo: Record<string, unknown>
 | undefined

        if (loginData && typeof loginData === 'object') {
          const loginDataObj = loginData as unknown as Record<string, unknown>
          logger.debug('[handlePhoneLogin] loginData keys:', Object.keys(loginDataObj))

          if ('thirdPartyAccounts' in loginDataObj && loginDataObj.thirdPartyAccounts) {
            const thirdPartyAccounts = loginDataObj.thirdPartyAccounts as Record<string, unknown>
            token = (thirdPartyAccounts.accessToken as string) || ''
            refreshTokenValue = (thirdPartyAccounts.refreshToken as string) || ''
            userInfo = loginDataObj as Record<string, unknown>
          }
          else if ('tokenType' in loginDataObj || 'expiresIn' in loginDataObj) {
            token = (loginDataObj.token as string) || ''
            refreshTokenValue = (loginDataObj.refreshToken as string) || ''
          }
          else if ('token' in loginDataObj || 'accessToken' in loginDataObj) {
            token = (loginDataObj.token as string) || (loginDataObj.accessToken as string) || ''
            refreshTokenValue = (loginDataObj.refreshToken as string) || ''
            userInfo = (loginDataObj.userInfo || loginDataObj.user) as Record<string, unknown> | undefined
          } else {
            throw new Error(t('auth.invalidResponseFormat'))
          }
        } else {
          throw new Error(t('auth.loginResponseMissingToken'))
        }

        if (!token) {
          throw new Error(t('auth.loginResponseMissingToken'))
        }

        logger.debug('[handlePhoneLogin] Extracted Token:', token ? 'Extracted' : 'Not found')

        const processResult = await AuthFlowService.processLoginResponse(
          token,
          refreshTokenValue,
          userInfo
        )

        if (!processResult.success) {
          throw new Error(t('auth.loginStatusUpdateFailed'))
        }

        await new Promise(resolve => setTimeout(resolve, 0))

        if (!authStore.isLoggedIn || !authStore.token) {
          logger.error('[handlePhoneLogin] Login status validation failed')
          ElMessage.error(t('auth.loginStatusUpdateFailed'))
          return false
        }

        logger.info('[handlePhoneLogin] Login successful, preparing to redirect')
        AuthFlowService.showSuccess()

        if (formData.rememberMe && authStore.refreshToken) {
          RememberMeService.setRememberMePreference(true)
          RememberMeService.saveRefreshToken(authStore.refreshToken)
          await RememberMeService.savePhoneCredentials(
            getFullPhoneNumber(),
            '+86',
            authStore.refreshToken
          )
        } else {
          await RememberMeService.clearCredentials()
        }

        const source = route.query.source as string
        let redirectUrl = route.query.redirect as string

        if (redirectUrl) {
          let prevDecoded = ''
          while (redirectUrl !== prevDecoded) {
            prevDecoded = redirectUrl
            try {
              redirectUrl = decodeURIComponent(redirectUrl)
            } catch {
              break
            }
          }
        }

        if ((source === 'edu-web' || source === 'edu-admin') && !redirectUrl) {
          const remoteUrls: Record<string, string> = {
            'edu-web': 'https://user-edu.aizhs.top',
            'edu-admin': 'https://admin-edu.aizhs.top',
          }
          redirectUrl = `${remoteUrls[source]}/index`
        }

        const isCrossProjectSource = source && ['admin', 'edu-web', 'edu-admin'].includes(source)
        if (isCrossProjectSource && redirectUrl) {
          await AuthFlowService.redirectAfterLogin({
            source,
            redirectUrl,
            token: authStore.token as string,
            refreshToken: refreshTokenValue,
            expiresIn: AuthFlowService.calculateExpiresInSeconds(),
            userInfo: processResult.userInfo || undefined,
          })
          return true
        }

        if (!isCrossProjectSource) {
          await AuthFlowService.redirectAfterLogin()
        }
        logger.info('[handlePhoneLogin] Redirect complete')
        return true

      } else {
        logger.error('[handlePhoneLogin] Login failed', {
          code: response.code,
          success: response.success,
          message: (response as { message?: string }).message
        })
        const loginResponseMessage = (response as { message?: string }).message
        const errorMessageSquare =
          typeof loginResponseMessage === 'string' ? loginResponseMessage : ''
        const isAccountNotFound =
          errorMessageSquare.includes(t('auth.userDoesNotExist')) ||
          errorMessageSquare.includes(t('auth.accountDoesNotExist')) ||
          errorMessageSquare.includes(t('auth.userNotRegistered')) ||
          errorMessageSquare.includes('not found') ||
          response.code === 404 ||
          response.code === 4001

        if (isAccountNotFound) {
          ElMessage.info(t('auth.accountNotExistsRegistering'))
          return false
        } else {
          ElMessage.error(errorMessageSquare || t('auth.loginFailed'))
          return false
        }
      }
    } catch (error) {
      logger.error('[handlePhoneLogin] Login error', error)
      ElMessage.error(error instanceof Error ? error.message : t('auth.loginFailed'))
      return false
    }
  }

  const handleSSOLogin = async (): Promise<void> => {
    const projectInfo = availableProjects.value.find(p => p.key === 'admin')
    const adminBaseUrl = (projectInfo?.url ?? '').replace(/\/$/, '')
    const redirectTarget = adminBaseUrl ? `${adminBaseUrl}/index` : ''
    adminRedirectUrl.value = redirectTarget

    const currentQuery = { ...route.query } as Record<string, string>
    currentQuery.source = 'admin'
    await router.replace({
      path: '/login',
      query: currentQuery,
    } as unknown as Parameters<typeof router.replace>[0])
  }

  return {
    loading,
    loginCooldown,
    startLoginCooldown,
    handleAccountLogin,
    handlePhoneLogin,
    handleEnterpriseLogin,
    handleSSOLogin,
    adminRedirectUrl,
  }
}
