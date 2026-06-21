<template>
  <div class="apple-login">
    <!-- Apple登录按钮 -->
    <div class="apple-login-container">
      <div class="custom-apple-btn" @click="handleAppleLogin" :disabled="loading">
        <div class="apple-logo">
          <svg viewBox="0 0 24 24" class="apple-icon">
            <path
              d="M17.052 14.764c-.118 1.341-.726 2.523-1.797 3.304-.917.674-2.07 1.058-3.242 1.086-1.165.028-2.324-.308-3.221-.942-.912-.644-1.523-1.579-1.74-2.656-.217-1.077-.065-2.204.423-3.178.488-.974 1.275-1.761 2.249-2.249.974-.488 2.101-.64 3.178-.423 1.077.217 2.012.828 2.656 1.74-.726.423-1.201 1.178-1.201 2.039 0 .861.475 1.616 1.201 2.039zm-3.159-10.368c.889 1.016-.245 2.498-1.37 2.498s-2.259-1.482-1.37-2.498c.889-1.016 2.251-1.016 2.74 0z"
              fill="var(--el-text-color-primary)"
            />
          </svg>
        </div>
        <span v-if="!loading">{{ buttonText }}</span>
        <span v-else>
          <el-icon class="spinning"><Loader2 /></el-icon>{{ t('login.apple.loggingIn') }}</span>
      </div>
    </div>

    <!-- 登录状态显示 -->
    <div v-if="loginStatus" class="login-status">
      <el-alert
        :title="loginStatus.title"
        :type="loginStatus.type"
        :description="loginStatus.message"
        show-icon
        :closable="false"
      />
      <div v-if="loginStatus.type === 'error'" class="retry-actions">
        <el-button size="small" @click="handleAppleLogin">{{ t('login.apple.retry') }}</el-button>
      </div>
    </div>

    <!-- 安全提示 -->
    <div class="security-tips">
      <p>
        <el-icon><Lock /></el-icon>{{ t('login.apple.securityTip') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '../../../utils/logger'
import { ElMessage } from 'element-plus'
import { Loader2, Lock } from '@/lib/lucide-fallback'
import { initiateAppleOAuth, handleAppleOAuthCallback } from '../api/apple'

interface Props {
  buttonText?: string
}

interface Emits {
  (e: 'login-success', data: { token: string; user: Record<string, unknown> }): void
  (e: 'login-error', error: any): void
  (e: 'switch-method', method: string): void
}

const _props = withDefaults(defineProps<Props>(), {
  buttonText: 'Apple',
})

const emit = defineEmits<Emits>()

// 组件状态
const loading = ref(false)
const loginStatus = ref<{
  title: string
  message: string
  type: 'success' | 'warning' | 'info' | 'error'
} | null>(null)

let checkClosed: ReturnType<typeof setInterval> | null = null
let messageHandler: ((event: MessageEvent) => void) | null = null

const cleanup = useCleanup()
cleanup.add(() => {
  if (checkClosed) {
    clearInterval(checkClosed)
    checkClosed = null
  }
  if (messageHandler) {
    const handler = messageHandler
    window.removeEventListener('message', handler)
    messageHandler = null
  }
})

// 处理Apple登录按钮点击
const handleAppleLogin = async () => {
  if (loading.value) return

  try {
    loading.value = true
    loginStatus.value = {
      title: t('title.apple_login.正在跳转'),
      message: t('msg.apple_login.正在跳转到App2'),
      type: 'info',
    }

    // 生成Apple OAuth URL并跳转
    const authUrl = await initiateAppleOAuth()

    // 在新窗口中打开登录页面
    const popup = window.open(
      authUrl,
      'apple-login',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      throw new Error(t('error.apple_login.无法打开登录窗口'))
    }

    // 监听弹窗关闭或消息
    checkClosed = setInterval(() => {
      if (popup.closed) {
        if (checkClosed) {
          clearInterval(checkClosed)
          checkClosed = null
        }
        loading.value = false
        loginStatus.value = null
      }
    }, 1000)

    // 监听来自弹窗的消息
    messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'APPLE_LOGIN_SUCCESS') {
        if (checkClosed) {
          clearInterval(checkClosed)
          checkClosed = null
        }
        popup.close()
        if (messageHandler) {
          const handler = messageHandler
          window.removeEventListener('message', handler)
          messageHandler = null
        }

        try {
          const result = await handleAppleOAuthCallback(event.data.code, event.data.state)

          // 检查结果是否为API响应对象
          const resultObj = result as unknown as {
            code?: number
            data?: { code?: number; token?: string; user?: any; message?: string } & Record<
              string,
              unknown
            >
            message?: string
          } & Record<string, unknown>
          const resultCode =
            resultObj.code || (resultObj.data ? (resultObj.data as { code?: number }).code : null)
          const resultData = resultObj.data || result

          if (resultCode === 200 && resultData) {
            const loginData = resultData as { token?: string; user?: any; message?: string }
            if (!loginData.token || !loginData.user) {
              throw new Error(t('error.apple_login.登录响应数据不完1'))
            }

            loginStatus.value = {
              title: t('title.apple_login.登录成功1'),
              message: t('msg.apple_login.Apple登录成3'),
              type: 'success',
            }

            emit('login-success', {
              token: loginData.token,
              user: loginData.user,
            })
          } else {
            const errorData = resultData as { message?: string }
            throw new Error(errorData?.message || t('featureAppleLogin.appleLoginFailed'))
          }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          loginStatus.value = {
            title: t('title.apple_login.登录失败2'),
            message: errorMessage || t('featureAppleLogin.appleLoginProcessFailed'),
            type: 'error',
          }
          emit('login-error', error)
        } finally {
          loading.value = false
        }
      } else if (event.data.type === 'APPLE_LOGIN_ERROR') {
        if (checkClosed) {
          clearInterval(checkClosed)
          checkClosed = null
        }
        popup.close()
        if (messageHandler) {
          const handler = messageHandler
          window.removeEventListener('message', handler)
          messageHandler = null
        }

        loginStatus.value = {
          title: t('title.apple_login.登录失败3'),
          message: event.data.error || t('featureAppleLogin.appleLoginFailed2'),
          type: 'error',
        }
        emit('login-error', new Error(event.data.error))
        loading.value = false
      }
    }

    window.addEventListener('message', messageHandler)
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Apple login failed:', error)
    ElMessage.error(errorMessage || t('featureAppleLogin.appleLoginRetry'))

    loginStatus.value = {
      title: t('title.apple_login.登录失败4'),
      message: errorMessage || t('featureAppleLogin.appleLoginFailed3'),
      type: 'error',
    }

    emit('login-error', error)
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
:where(.apple-login) {
  text-align: center;

  :where(.apple-login-container) {
    margin-bottom: 20px;

    :where(.custom-apple-btn) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 24px;
      border: none;
      border-radius: var(--global-border-radius);
      background: var(--el-bg-color);
      color: var(--el-text-color-primary);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 200px;
      height: 48px;

      &:hover:not(:disabled) {
        border: var(--unified-border);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      :where(.apple-logo) {
        width: 20px;
        height: 20px;
        flex-shrink: 0;

        .apple-icon {
          width: 100%;
          height: 100%;
        }
      }

      .spinning {
        animation: spin 1s linear infinite;
      }
    }
  }

  .login-status {
    margin: 16px 0;
  }

  .security-tips {
    margin-top: 16px;
    padding-top: 16px;
    border-top: none;

    p {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;

      .el-icon {
        font-size: 14px;
        color: var(--el-color-success);
      }
    }
  }

  .login-status {
    .retry-actions {
      margin-top: 8px;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
