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
import { phoneLogin } from '@/api/user'
import { useLoginProject } from '@/composables/login/useLoginProject'
import { logger } from '@/utils/logger'
import request from '@/utils/request'
import { getSafeRedirectPath } from '@/utils/auth'
import { LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { useCleanup } from '@/composables/useCleanup'
import { saveLoginHistoryItem, LOGIN_HISTORY_KEYS } from './useLoginInputHistory'

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

export interface EmailFormData {
  email: string
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
    // 2026-07-04 修复: 删掉强制 11 位手机号正则 /AccountLoginForm 校验已接受 username/phone/email,
    // 后端 /api/v1/auth/login 扩展为兼容 sys_user.user_name (admin/admin123 等),
    // 不再前端拦截. 注释保留说明避免后续误回退.

    logger.info('[handleAccountLogin] Preparing to login', { isSSOAdmin, accountLen: account.length })

    const captchaCode = showCaptcha.value ? (formData.captcha || '') : ''
    const captchaUuid = showCaptcha.value ? (captchaKey.value || '') : ''

    try {
      if (isSSOAdmin) {
        await handleEnterpriseLogin(account, password, captchaCode, captchaUuid)
        // 2026-07-06: 企业(SSO)登录成功后保存账号到历史记忆 (下拉窗一键填入)
        saveLoginHistoryItem(LOGIN_HISTORY_KEYS.account, account)
        return { success: true }
      }

      const loginPayload: Record<string, string> = { phone: account, password, code: captchaCode, uuid: captchaUuid }
      const response = await request.post(LOGIN_PWD_PATHS.login, loginPayload, {
        headers: { 'platform-type': 'web' },
      })

      logger.info('[handleAccountLogin] Login response', response.data)

      const resData = (response.data as Record<string, unknown>) || {}
      const resCode = (resData?.code as number | string) ?? 0
      const msg = (resData?.msg || resData?.message || '') as string

      // 2026-06-28 联调: 后端统一响应码 SUCCESS="0" (error_codes.py),
      // 同时兼容旧 Java 后端的 code=200. 接受 0/"0"/200/"200" 均视为成功.
      if (resCode === 200 || resCode === '200' || resCode === 0 || resCode === '0') {
        // 2026-07-06 修复: 登录响应成功后立即保存账号到历史记忆 (下拉窗一键填入)
        // 提前到 token 解析之前, 确保即使 token 解析异常也能记住账号
        saveLoginHistoryItem(LOGIN_HISTORY_KEYS.account, account)
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
          } else {
            // 2026-07-06: 取消勾选记住密码时清除记住状态, 避免下次仍回填账号
            RememberMeService.setRememberMePreference(false)
            RememberMeService.clearCredentials()
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

          // 2026-07-06 修复: 统一 edu source 空 redirect 填充 (与 handlePhoneLogin 一致)
          // 之前账号登录缺少此逻辑, 导致 edu-web/edu-admin 登录后卡在登录页不跳转
          if ((source === 'edu-web' || source === 'edu-admin') && !redirectUrl) {
            const eduRoutes: Record<string, string> = {
              'edu-web': '/edu',
              'edu-admin': '/admin/edu',
            }
            redirectUrl = eduRoutes[source]
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
              router, // 2026-07-06: 传入 router 实例, 避免静态方法内 useRouter() 脱离 setup
            })
            return { success: true }
          }

          // 2026-06-27 修复: 同项目内登录成功后, 优先跳转到 redirect 参数指定的页面.
          // 路由守卫拦截 requiresAuth 页面时会 next({ name: 'login', query: { redirect: to.fullPath } }),
          // 之前直接 router.push('/') 导致 redirect 被忽略, 用户登录后无法回到原页面.
          // 安全: 只允许以单个 / 开头的相对路径, 拒绝 // (协议相对 URL) 和 http(s):// 等绝对 URL,
          // 防止开放重定向漏洞. 逻辑抽到 utils/auth.ts 的 getSafeRedirectPath, 与 UniversalLogin.vue 共用.
          if (!isCrossProject) {
            void router.push(getSafeRedirectPath(redirectUrl))
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
      // 2026-07-06 修复: 直接调用后端 /api/v1/auth/login/sms 一步登录
      // 原实现走三步流程 (verifyPhoneCode → completePhoneLogin), 但后端
      // /api/v1/auth/sms/verify 只返回 {valid: true/false} 不返回临时密钥,
      // 导致登录流程中断. 改为直接调用 /api/v1/auth/login/sms 验证码+登录一步到位.
      const response = await phoneLogin({
        phone: fullPhoneNumber,
        code: verificationCode,
      })

      if (!response.success || !response.data) {
        logger.error('[handlePhoneLogin] Login failed:', {
          success: response.success,
          message: response.message,
          code: response.code,
        })

        const msgStr = (response.message || '').trim()
        const isAccountNotFound =
          msgStr.includes(t('auth.userDoesNotExist')) ||
          msgStr.includes(t('auth.accountDoesNotExist')) ||
          msgStr.includes(t('auth.userNotRegistered')) ||
          msgStr.includes('not found') ||
          response.code === 404 ||
          response.code === 4001

        if (isAccountNotFound) {
          ElMessage.info(t('auth.accountNotExistsRegistering'))
          return false
        } else {
          ElMessage.error(msgStr || t('auth.loginFailed'))
          return false
        }
      }

      // 2026-07-06 修复: 登录响应成功后立即保存手机号到历史记忆 (下拉窗一键填入)
      // 提前到 token 解析之前, 确保即使 token 解析异常也能记住手机号
      saveLoginHistoryItem(LOGIN_HISTORY_KEYS.phone, formData.phoneNumber)

      // 从后端响应中提取 token 和用户信息
      const loginDataObj = response.data as unknown as Record<string, unknown>
      logger.debug('[handlePhoneLogin] loginData keys:', Object.keys(loginDataObj))

      let token: string = ''
      let refreshTokenValue: string = ''
      let userInfo: Record<string, unknown> | undefined

      // 后端 /auth/login/sms 返回 accessToken / access_token / token
      token =
        (loginDataObj.accessToken as string) ||
        (loginDataObj.access_token as string) ||
        (loginDataObj.token as string) ||
        ''
      refreshTokenValue =
        (loginDataObj.refreshToken as string) ||
        (loginDataObj.refresh_token as string) ||
        ''
      userInfo = (loginDataObj.user as Record<string, unknown>) || undefined

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
        // 2026-07-06: 取消勾选记住密码时清除记住状态, 避免下次仍回填账号
        RememberMeService.setRememberMePreference(false)
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

      // 2026-06-26: 教育平台源码已迁移到项目内, 登录后跳项目内路由
      if ((source === 'edu-web' || source === 'edu-admin') && !redirectUrl) {
        const eduRoutes: Record<string, string> = {
          'edu-web': '/edu',
          'edu-admin': '/admin/edu',
        }
        redirectUrl = eduRoutes[source]
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
            router, // 2026-07-06: 传入 router 实例
          })
          return true
        }

        if (!isCrossProjectSource) {
          await AuthFlowService.redirectAfterLogin({ router })
        }
        logger.info('[handlePhoneLogin] Redirect complete')
      return true
    } catch (error) {
      logger.error('[handlePhoneLogin] Login error', error)
      ElMessage.error(error instanceof Error ? error.message : t('auth.loginFailed'))
      return false
    }
  }

  /**
   * 邮箱验证码登录 (2026-07-04 立, 对齐后端 /api/v1/auth/login/email 接口).
   * 邮箱未注册时后端会自动注册账号.
   */
  const handleEmailLogin = async (formData: EmailFormData): Promise<boolean> => {
    const email = (formData.email ?? '').trim().toLowerCase()
    const code = (formData.verificationCode ?? '').trim()

    if (!email) {
      ElMessage.warning(t('auth.pleaseEnterEmail'))
      return false
    }
    if (!code) {
      ElMessage.warning(t('login.placeholders.emailCode'))
      return false
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      ElMessage.warning(t('auth.pleaseEnterCorrectEmail'))
      return false
    }

    try {
      track_funnel_local('login_submit', 'email')

      const response = await request.post(
        LOGIN_PWD_PATHS.emailLogin,
        { email, code },
        { headers: { 'platform-type': 'web' } }
      )

      const resData = (response.data as Record<string, unknown>) || {}
      const resCode = (resData?.code as number | string) ?? 0
      const isSuccess = resCode === 0 || resCode === '0' || resCode === 200 || resCode === '200'

      if (!isSuccess) {
        const msg = (resData?.msg || resData?.message || '') as string
        logger.warn('[handleEmailLogin] Backend rejected', { resCode, msg })
        ElMessage.error(msg || t('auth.loginFailed'))
        return false
      }

      // 2026-07-06 修复: 登录响应成功后立即保存邮箱到历史记忆 (下拉窗一键填入)
      // 提前到 token 解析之前, 确保即使 token 解析异常也能记住邮箱
      saveLoginHistoryItem(LOGIN_HISTORY_KEYS.email, email)

      const rawData = resData?.data as Record<string, unknown> | undefined
      const userData = (rawData?.user as Record<string, unknown>) || rawData || {}
      const thirdPartyAccounts = userData?.thirdPartyAccounts as Record<string, unknown> | undefined
      const token =
        (thirdPartyAccounts?.accessToken as string) ||
        (userData?.accessToken as string) ||
        (userData?.access_token as string) ||
        (userData?.token as string) ||
        (rawData?.accessToken as string) ||
        (rawData?.access_token as string) ||
        (rawData?.token as string) ||
        ''
      const refreshToken =
        (thirdPartyAccounts?.refreshToken as string) ||
        (userData?.refreshToken as string) ||
        (userData?.refresh_token as string) ||
        (rawData?.refreshToken as string) ||
        (rawData?.refresh_token as string) ||
        ''

      if (!token) {
        ElMessage.error(t('auth.loginFailedNoToken'))
        return false
      }

      const userForStore = (userData && Object.keys(userData).length > 0) ? userData : { email }
      if (!(userForStore as Record<string, unknown>).uuid && !(userForStore as Record<string, unknown>).id) {
        ;(userForStore as Record<string, unknown>).uuid = (userForStore as Record<string, unknown>).id || ''
      }

      await authStore.thirdPartyLogin({
        token,
        refreshToken,
        user: userForStore as Record<string, unknown>,
        loginType: 'email',
      })

      if (formData.rememberMe && refreshToken) {
        RememberMeService.setRememberMePreference(true)
        RememberMeService.saveRefreshToken(refreshToken)
        RememberMeService.saveAccountCredentials(email, refreshToken)
      } else {
        // 2026-07-06: 取消勾选记住密码时清除记住状态, 避免下次仍回填账号
        RememberMeService.setRememberMePreference(false)
        RememberMeService.clearCredentials()
      }

      ElMessage.success(t('auth.loginSuccess'))
      AuthFlowService.showSuccess()

      const source = route.query.source as string
      let redirectUrl = getSafeRedirectPath(route.query.redirect as string)

      // 2026-07-06 修复: 统一 edu source 空 redirect 填充 (与 handlePhoneLogin 一致)
      // 之前邮箱登录缺少此逻辑, 导致 edu-web/edu-admin 登录后跳首页而非 /edu
      if ((source === 'edu-web' || source === 'edu-admin') && (!redirectUrl || redirectUrl === '/')) {
        const eduRoutes: Record<string, string> = {
          'edu-web': '/edu',
          'edu-admin': '/admin/edu',
        }
        redirectUrl = eduRoutes[source]
      }

      const isCrossProject = source && ['admin', 'edu-web', 'edu-admin'].includes(source)
      if (isCrossProject && redirectUrl) {
        await AuthFlowService.redirectAfterLogin({
          source,
          redirectUrl,
          token,
          refreshToken,
          expiresIn: AuthFlowService.calculateExpiresInSeconds(),
          userInfo: userForStore as Record<string, unknown>,
          router, // 2026-07-06: 传入 router 实例
        })
        return true
      }

      if (!isCrossProject) {
        void router.push(redirectUrl)
      }
      return true
    } catch (error) {
      logger.error('[handleEmailLogin] Login error', error)
      const msg = error instanceof Error ? error.message : t('auth.loginFailed')
      ElMessage.error(msg)
      return false
    }
  }

  const track_funnel_local = (stage: string, channel: string): void => {
    // 2026-07-04 本地简化: 不依赖 tracking 服务, 避免 handleEmailLogin 引入额外依赖.
    logger.debug('[useLoginLogic] login funnel', { stage, channel })
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
    handleEmailLogin,
    handleEnterpriseLogin,
    handleSSOLogin,
    adminRedirectUrl,
  }
}
