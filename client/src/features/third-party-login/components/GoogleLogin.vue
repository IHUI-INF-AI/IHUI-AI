<template>
  <div class="google-login">
    <!-- 一键登录按钮 -->
    <div class="google-one-tap-container">
      <div id="g_id_onload" ref="oneTapContainer"></div>
      <div id="g_id_signin" ref="signInButton"></div>

      <!-- 自定义登录按钮 -->
      <div class="custom-google-btn" @click="handleGoogleLogin" :disabled="loading">
        <div class="google-logo">
          <svg viewBox="0 0 24 24" class="google-icon">
            <path
              fill="var(--el-text-color-primary)"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="var(--el-text-color-primary)"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="var(--el-text-color-primary)"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="var(--el-text-color-primary)"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        </div>
        <span v-if="!loading">{{ buttonText }}</span>
        <span v-else>
          <el-icon class="spinning"><Loader2 /></el-icon>{{ t('login.google.loggingIn') }}</span>
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
        <el-button size="small" @click="handleGoogleLogin">{{ t('login.google.retry') }}</el-button>
      </div>
    </div>

    <!-- 安全提示 -->
    <div class="security-tips">
      <p>
        <el-icon><Lock /></el-icon>{{ t('login.google.securityTip') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref, nextTick, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

import { logger } from '../../../utils/logger'

// 定义全局变量用于管理弹窗和消息处理器
let _popupRef: Window | null = null
let messageHandlerRef: ((event: MessageEvent) => void) | null = null
let checkClosedRef: NodeJS.Timeout | null = null
// 登录超时定时器
let loginTimeoutTimer: ReturnType<typeof setTimeout> | null = null

// Vue API 通过 auto-import 全局可用，无需导入`r`nimport { ElMessage, ElAlert } from "element-plus";
import { ElMessage } from 'element-plus'
import { Loader2, Lock } from '@/lib/lucide-fallback'
import {
  initiateGoogleOAuth,
  googleOneTapLogin,
  getGoogleOAuthConfig,
  handleGoogleOAuthCallback,
} from '../api/google'

interface Props {
  mode?: 'oneTap' | 'button' | 'popup' // 登录模式
  buttonText?: string
  autoLoad?: boolean // 是否自动加载Google One Tap
}

interface Emits {
  (e: 'login-success', data: { token: string; user: Record<string, unknown> }): void
  (e: 'login-error', error: any): void
  (e: 'switch-method', method: string): void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'button',
  buttonText: 'Google',
  autoLoad: true,
})

const emit = defineEmits<Emits>()

// 组件状态
const loading = ref(false)
const googleConfig = ref<Record<string, unknown> | null>(null)
const oneTapContainer = ref<HTMLElement | undefined>(undefined)
const signInButton = ref<HTMLElement | undefined>(undefined)
const loginStatus = ref<{
  title: string
  message: string
  type: 'success' | 'warning' | 'info' | 'error'
} | null>(null)

// Google API加载状态
let googleApiLoaded = false
let googleOneTapInitialized = false

const cleanup = useCleanup()
cleanup.add(() => {
  loginStatus.value = null
  if (messageHandlerRef) {
    window.removeEventListener('message', messageHandlerRef)
    messageHandlerRef = null
  }
  if (checkClosedRef) {
    clearInterval(checkClosedRef)
    checkClosedRef = null
  }
  if (loginTimeoutTimer !== null) {
    clearTimeout(loginTimeoutTimer)
    loginTimeoutTimer = null
  }
  _popupRef = null
})

// 加载Google API
const loadGoogleApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (googleApiLoaded) {
      resolve()
      return
    }

    // 检查是否已经加载
    if (window.google && window.google.accounts) {
      googleApiLoaded = true
      resolve()
      return
    }

    // 动态加载Google API脚本
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true

    script.onload = () => {
      googleApiLoaded = true
      resolve()
    }

    script.onerror = () => {
      reject(new Error('Google API加载失败'))
    }

    // 添加健壮的错误处理，确保document.head存在
    if (document.head) {
      try {
        document.head.appendChild(script)
      } catch (_error) {
        // 作为备选方案，尝试添加到document.body
        if (document.body) {
          try {
            document.body.appendChild(script)
          } catch (_bodyError) {
            reject(new Error('无法添加Google API脚本到文档中'))
          }
        } else {
          // 如果都不存在，稍后再尝试
          setTimeout(() => {
            if (document.head || document.body) {
              // 重新创建脚本元素
              const newScript = document.createElement('script')
              newScript.src = 'https://accounts.google.com/gsi/client'
              newScript.async = true
              newScript.defer = true
              newScript.onload = script.onload
              newScript.onerror = script.onerror
              try {
                if (document.head) {
                  document.head.appendChild(newScript)
                } else if (document.body) {
                  document.body.appendChild(newScript)
                }
              } catch (_retryError) {
                reject(new Error('重试添加Google API脚本失败'))
              }
            }
          }, 100)
        }
      }
    } else {
      setTimeout(() => {
        if (document.head) {
          try {
            document.head.appendChild(script)
          } catch (retryError) {
            logger.error('Failed to append Google script on retry:', retryError)
            reject(new Error('重试添加Google API脚本失败'))
          }
        } else {
          reject(new Error('无法添加Google API脚本到文档中'))
        }
      }, 100)
    }
  })
}

// 初始化Google One Tap
const initializeGoogleOneTap = async () => {
  if (!googleConfig.value || googleOneTapInitialized) return

  try {
    await loadGoogleApi()

    if (!window.google?.accounts?.id) {
      throw new Error(t('error.google_login.GoogleAP'))
    }

     
    const initOptions = { client_id: String(googleConfig.value.clientId || ''), callback: handleOneTapCallback } as any
    window.google.accounts.id.initialize(initOptions)

    // 渲染One Tap提示
    if (props.mode === 'oneTap' && oneTapContainer.value && window.google?.accounts?.id) {
      window.google.accounts.id.prompt(_notification => {
        // One Tap提示未显示或被跳过，静默处理
      })
    }

    // 渲染登录按钮
    if (signInButton.value) {
      window.google.accounts.id.renderButton(signInButton.value, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      })
    }

    googleOneTapInitialized = true
  } catch (error) {
    logger.error('Initialize Google One Tap failed:', error)
  }
}

// 处理One Tap回调
const handleOneTapCallback = async (response: { credential: string }) => {
  try {
    loading.value = true
    loginStatus.value = {
      title: t('title.google_login.正在验证'),
      message: t('msg.google_login.正在验证Goog2'),
      type: 'info',
    }

    const result = await googleOneTapLogin(response.credential)

    if (result.code === 200 && result.data) {
      loginStatus.value = {
        title: t('title.google_login.登录成功1'),
        message: t('msg.google_login.Google登录3'),
        type: 'success',
      }

      emit('login-success', {
        token: result.data.token,
        user: result.data.user,
      })
    } else {
      throw new Error(result.message || t('googleLogin.failed'))
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Google One Tap login failed:', error)

    loginStatus.value = {
      title: t('title.google_login.登录失败2'),
      message: errorMessage || t('googleLogin.verifyFailed'),
      type: 'error',
    }

    emit('login-error', error)
  } finally {
    loading.value = false
  }
}

// 处理Google登录按钮点击
const handleGoogleLogin = async () => {
  if (loading.value) return

  try {
    loading.value = true
    loginStatus.value = {
      title: t('title.google_login.正在跳转3'),
      message: t('msg.google_login.正在跳转到Goo4'),
      type: 'info',
    }

    // 生成Google OAuth URL并跳转
    const authUrl = await initiateGoogleOAuth()

    // 在新窗口中打开登录页面
    const popup = window.open(
      authUrl,
      'google-login',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      throw new Error(t('error.google_login.无法打开登录窗口1'))
    }

    // 监听弹窗关闭或消息
    _popupRef = popup
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        if (messageHandler) {
          window.removeEventListener('message', messageHandler)
          messageHandlerRef = null
        }
        loading.value = false
        loginStatus.value = null
      }
    }, 1000)
    checkClosedRef = checkClosed

    // 监听来自弹窗的消息
    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'GOOGLE_LOGIN_SUCCESS') {
        clearInterval(checkClosed)
        popup.close()
        window.removeEventListener('message', messageHandler)
        messageHandlerRef = null

        try {
          const result = await handleGoogleOAuthCallback(event.data.code, event.data.state)

          if (result.code === 200 && result.data) {
            loginStatus.value = {
              title: t('title.google_login.登录成功4'),
              message: t('msg.google_login.Google登录5'),
              type: 'success',
            }

            emit('login-success', {
              token: result.data.token,
              user: result.data.user,
            })
          } else {
            throw new Error(result.message || t('featureGoogleLogin.googleLoginFailed'))
          }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          loginStatus.value = {
            title: t('title.google_login.登录失败5'),
            message: errorMessage || t('googleLogin.handleFailed'),
            type: 'error',
          }
          emit('login-error', error)
        } finally {
          loading.value = false
        }
      } else if (event.data.type === 'GOOGLE_LOGIN_ERROR') {
        clearInterval(checkClosed)
        popup.close()
        window.removeEventListener('message', messageHandler)
        messageHandlerRef = null

        loginStatus.value = {
          title: t('title.google_login.登录失败6'),
          message: event.data.error || t('googleLogin.failed'),
          type: 'error',
        }
        emit('login-error', new Error(event.data.error))
        loading.value = false
      }
    }

    window.addEventListener('message', messageHandler)
    messageHandlerRef = messageHandler

    // 添加超时机制，避免监听器泄露
    loginTimeoutTimer = setTimeout(() => {
      clearInterval(checkClosed)
      window.removeEventListener('message', messageHandler)
      messageHandlerRef = null
      if (loading.value) {
        loading.value = false
        loginStatus.value = {
          title: t('title.google_login.登录超时7'),
          message: t('msg.google_login.登录操作超时请重6'),
          type: 'warning',
        }
      }
    }, 300000) // 5分钟超时
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Google login failed:', error)
    ElMessage.error(errorMessage || t('googleLogin.retry'))

    loginStatus.value = {
      title: t('title.google_login.登录失败8'),
      message: errorMessage || t('googleLogin.failed'),
      type: 'error',
    }

    emit('login-error', error)
    loading.value = false
  }
}

// 获取配置
const initializeComponent = async () => {
  try {
    const configResult = await getGoogleOAuthConfig()
    if (configResult.code === 200 && configResult.data) {
       
      googleConfig.value = configResult.data as any

      // 自动加载时初始化One Tap
      if (props.autoLoad) {
        await nextTick()
        await initializeGoogleOneTap()
      }
    }
  } catch (_error) {
    // 获取配置失败，静默处理
  }
}

// 组件挂载
onMounted(() => {
  initializeComponent()
})

// 暴露方法
defineExpose({
  initializeGoogleOneTap,
  handleGoogleLogin,
})
</script>

<style lang="scss" scoped>
:where(.google-login) {
  text-align: center;

  :where(.google-one-tap-container) {
    margin-bottom: 20px;

    :where(.custom-google-btn) {
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
      transition: border-color 0.2s ease, border-width 0.2s ease, opacity 0.2s ease;
      min-width: 200px;
      height: 48px;

      &:hover:not(:disabled) {
        border: var(--unified-border);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      :where(.google-logo) {
        width: 20px;
        height: 20px;
        flex-shrink: 0;

        .google-icon {
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
        color: var(--el-text-color-regular);
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

// Google One Tap 容器样式
:deep(#g_id_onload) {
  margin-bottom: 16px;
}

:deep(#g_id_signin) {
  margin-bottom: 16px;

  div {
    margin: 0 auto;
  }
}
</style>
