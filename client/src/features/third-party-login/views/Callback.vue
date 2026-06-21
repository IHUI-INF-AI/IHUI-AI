<template>
  <div class="oauth-callback">
    <div class="callback-content">
      <div class="loading-spinner">
        <ElIcon class="is-loading" size="48">
          <Loader2 />
        </ElIcon>
      </div>
      <h3>{{ statusMessage }}</h3>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <div v-if="errorMessage" class="error-actions">
        <el-button type="primary" size="small" @click="retryLogin">{{ t('common.retry') }}</el-button>
        <el-button size="small" @click="router.push('/login')">{{ t('common.backToLogin') }}</el-button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElIcon } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getI18nGlobal } from '@/locales'
const { t } = useI18n()
import { Loader2 } from '@/lib/lucide-fallback'
import * as authApi from '../api'
import { initiateGoogleOAuth } from '../api/google'
import { initiateAppleOAuth } from '../api/apple'
import { AuthFlowService } from '@/services/auth-flow.service'
import logger from '@/utils/logger'

const route = useRoute()
const router = useRouter()

const statusMessage = ref(t('auth.processing'))
const errorMessage = ref('')

// 统一处理登录成功逻辑 - 优化版本，使用 AuthFlowService
const handleLoginSuccess = async (data: any) => {
  const loginData =
    data && typeof data === 'object' ? (data as { token?: string; user?: any; refreshToken?: string }) : {}
  const token = loginData.token || ''
  const user = loginData.user as Record<string, unknown> | undefined
  const refreshToken = loginData.refreshToken || ''

  if (!token) {
    logger.error('[Callback] Login response missing token')
    handleLoginError(getI18nGlobal().t('auth.loginResponseMissingToken'))
    return
  }

  // 使用 AuthFlowService 统一处理登录响应（原子化存储 + 自动获取用户信息）
  const result = await AuthFlowService.processLoginResponse(token, refreshToken, user)

  if (!result.success) {
    logger.error('[Callback] Failed to process login response')
    handleLoginError(getI18nGlobal().t('auth.loginStatusUpdateFailed'))
    return
  }

  // 保存记住我设置
  if (refreshToken) {
    try {
      const { RememberMeService } = await import('@/utils/rememberMeService')
      RememberMeService.setRememberMePreference(true)
      RememberMeService.saveRefreshToken(refreshToken)
      RememberMeService.resetAutoLoginRecord()
    } catch {
      // 静默处理
    }
  }

  statusMessage.value = t('auth.loginSuccessRedirecting')
  AuthFlowService.showSuccess()

  // 立即跳转到首页，不延迟
  router.replace('/').catch(() => {
    // 如果路由跳转失败，使用 window.location 强制跳转
    window.location.href = '/'
  })
}

// 统一处理登录失败逻辑
const handleLoginError = (message: string) => {
  errorMessage.value = message
  statusMessage.value = getI18nGlobal().t('common.loginFailed')
  ElMessage.error(message)
}

// 定义回调处理器类型
interface CallbackHandler {
  (code: string, state: string): Promise<unknown>
}

// 通用的回调处理函数
const handleGenericCallback = async (handler: CallbackHandler, providerName: string) => {
  try {
    const { code, state } = route.query
    if (!code || !state) {
      throw new Error(getI18nGlobal().t('messages.missingAuthParams'))
    }

    const result = await handler(code as string, state as string)
    const resultObj = result as {
      code?: number
      data?: { code?: number; message?: string } & Record<string, unknown>
    } & Record<string, unknown>
    const resultCode =
      resultObj.code || (resultObj.data ? (resultObj.data as { code?: number }).code : null)
    const resultData = resultObj.data || result

    if (resultCode === 200 && resultData) {
      handleLoginSuccess(resultData)
    } else {
      const errorMsg = (resultData as { message?: string })?.message || getI18nGlobal().t('common.loginFailed')
      throw new Error(errorMsg)
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const msg = String(errorMessage || '')

    // 根据错误类型提供友好的错误消息
    let friendly: string
    if (msg.includes('state') || msg.includes(t('featureCallback.expired')) || msg.includes(t('featureCallback.verifyFailed'))) {
      friendly = getI18nGlobal().t('auth.requestExpired')
    } else if (msg.includes(t('featureCallback.missing')) || msg.includes('missing') || msg.includes('code')) {
      friendly = getI18nGlobal().t('messages.missingAuthParams')
    } else if (msg.includes('CSRF') || msg.includes(t('featureCallback.attack'))) {
      friendly = getI18nGlobal().t('auth.requestExpired')
    } else {
      friendly = msg || getI18nGlobal().t('auth.callbackError', { provider: providerName })
    }

    handleLoginError(friendly)
  }
}

const retryLogin = async () => {
  const name = String((route as any).name || '')
  try {
    if (name === 'GoogleCallback') {
      const url = await initiateGoogleOAuth()
      window.location.href = url
      return
    }
    if (name === 'AppleCallback') {
      const url = await initiateAppleOAuth()
      window.location.href = url
      return
    }
    router.push('/login')
  } catch {
    router.push('/login')
  }
}

// 处理Google回调
const handleGoogleCallback = () => {
  const { code, state } = route.query as Record<string, string>
  const opener = (
    typeof window !== 'undefined' ? (window as Window & { opener?: Window | null }).opener : null
  ) as Window | null
  if (opener && !opener.closed) {
    if (code && state) {
      try {
        opener.postMessage({ type: 'GOOGLE_LOGIN_SUCCESS', code, state }, window.location.origin)
      } finally {
        setTimeout(() => {
          window.close()
        }, 100)
      }
    } else {
      try {
        opener.postMessage(
          { type: 'GOOGLE_LOGIN_ERROR', error: getI18nGlobal().t('messages.missingAuthParams') },
          window.location.origin
        )
      } finally {
        setTimeout(() => {
          window.close()
        }, 100)
      }
    }
    return
  }
  handleGenericCallback(authApi.handleGoogleOAuthCallback, 'Google')
}

// 处理Apple回调
const handleAppleCallback = () => {
  const { code, state } = route.query as Record<string, string>
  const opener = (
    typeof window !== 'undefined' ? (window as Window & { opener?: Window | null }).opener : null
  ) as Window | null
  if (opener && !opener.closed) {
    if (code && state) {
      try {
        opener.postMessage({ type: 'APPLE_LOGIN_SUCCESS', code, state }, window.location.origin)
      } finally {
        setTimeout(() => {
          window.close()
        }, 100)
      }
      } else {
        try {
          opener.postMessage(
            { type: 'APPLE_LOGIN_ERROR', error: getI18nGlobal().t('messages.missingAuthParams') },
            window.location.origin
          )
      } finally {
        setTimeout(() => {
          window.close()
        }, 100)
      }
    }
    return
  }
  handleGenericCallback(authApi.handleAppleOAuthCallback, 'Apple')
}


onMounted(() => {
  // 根据路由名称处理对应的回调
  switch ((route as any).name) {

    case 'GoogleCallback':
      handleGoogleCallback()
      break
    case 'AppleCallback':
      handleAppleCallback()
      break
    default:
      errorMessage.value = getI18nGlobal().t('auth.unknownCallbackType')
      statusMessage.value = getI18nGlobal().t('messages.operationFailed')
      ElMessage.error(getI18nGlobal().t('auth.unknownCallbackType'))
  }
})
</script>

<style scoped>
.oauth-callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
}

.callback-content {
  text-align: center;
  padding: 40px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
}

.loading-spinner {
  margin-bottom: 20px;
}

.error-message {
  color: var(--el-text-color-regular);
  margin-top: 10px;
}

.error-actions {
  margin-top: 12px;
}
</style>
