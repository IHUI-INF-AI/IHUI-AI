<template>
  <div class="unified-qr-login">
    <div class="qr-container">
      <div v-if="loading" class="loading-state">
        <el-icon class="spinning"><Loading /></el-icon>
        <p>{{ t('unifiedQRLogin.generatingQrCode') }}</p>
      </div>

      <div v-else-if="expired" class="expired-state">
        <el-icon class="expired-icon"><CircleClose /></el-icon>
        <p>{{ t('unifiedQRLogin.qrCodeExpired') }}</p>
        <el-button @click="refreshQrCode" type="primary" size="small">
          <el-icon><Refresh /></el-icon>
          {{ t('unifiedQRLogin.refreshQrCode') }}
        </el-button>
      </div>

      <div v-else class="qr-display">
        <div class="qr-image-container">
          <img
            :src="qrCodeUrl"
            :alt="t('unifiedQRLogin.qrCodeAlt', { providerName: providerNameDisplay })"
            class="qr-image"
            @error="handleImageError"
          />
          <div v-if="status === 'scanned' || status === 'confirming'" class="scanned-overlay">
            <el-icon class="success-icon"><SuccessFilledIcon /></el-icon>
            <p>
              {{
                status === 'confirming'
                  ? t('unifiedQRLogin.confirmingOnPhone')
                  : t('unifiedQRLogin.scannedConfirm')
              }}
            </p>
          </div>
        </div>

        <div class="qr-info">
          <div class="status-text">
            <span v-if="status === 'pending'" class="status-waiting">
              <el-icon><Clock /></el-icon>
              {{ t('unifiedQRLogin.scanToLogin', { provider: providerNameDisplay }) }}
            </span>
            <span v-else-if="status === 'scanning'" class="status-scanning">
              <el-icon><Loading /></el-icon>
              {{ t('unifiedQRLogin.scanning') }}
            </span>
            <span v-else-if="status === 'scanned'" class="status-scanned">
              <el-icon><SuccessFilledIcon /></el-icon>
              {{ t('unifiedQRLogin.scanned') }}
            </span>
            <span v-else-if="status === 'confirming'" class="status-confirming">
              <el-icon><Loading /></el-icon>
              {{ t('unifiedQRLogin.confirmingOnPhone') }}
            </span>
            <span v-else-if="status === 'failed'" class="status-failed">
              <el-icon><CircleClose /></el-icon>
              {{ t('unifiedQRLogin.loginFailed') }}
            </span>
          </div>

          <div v-if="countdown > 0" class="countdown">
            {{ Math.floor(countdown / 60) }}:{{ String(countdown % 60).padStart(2, '0') }}
            {{ t('unifiedQRLogin.expireAfter') }}
          </div>
          <div v-if="status === 'failed'" class="retry-actions">
            <el-button size="small" @click="refreshQrCode">{{
              t('unifiedQRLogin.retry')
            }}</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="actions">
      <el-button @click="refreshQrCode" :loading="loading">
        <el-icon><Refresh /></el-icon>
        {{ t('unifiedQRLogin.refreshQrCode') }}
      </el-button>
      <el-button type="primary" plain @click="$emit('switch-method', 'account')">
        {{ t('unifiedQRLogin.otherLoginMethods') }}
      </el-button>
    </div>

    <div class="tips">
      <p>
        <el-icon><InfoFilled /></el-icon>
        {{ t('unifiedQRLogin.noProvider', { provider: providerNameDisplay }) }}？
        <el-button link type="primary" @click="$emit('switch-method', 'account')">
          {{ t('unifiedQRLogin.useAccountPasswordLogin') }}
        </el-button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import {
  Loading,
  Refresh,
  CircleClose,
  SuccessFilledIcon,
  Clock,
  InfoFilled,
} from '@/lib/lucide-fallback'
import { generateWechatQrCode, checkWechatQrStatus } from '@/api/unified-wechat'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'

interface Props {
  provider: 'wechat'
  autoStart?: boolean
  refreshInterval?: number
  appId?: string
  autoRefresh?: boolean
  maxRefreshCount?: number
}

interface Emits {
  (
    e: 'login-success',
    data: { token: string; user: Record<string, unknown>; loginType: string }
  ): void
  (e: 'login-error', error: any): void
  (e: 'switch-method', method: string): void
}

const props = withDefaults(defineProps<Props>(), {
  autoStart: true,
  refreshInterval: 2000,
  appId: '',
  autoRefresh: true,
  maxRefreshCount: 3,
})

const emit = defineEmits<Emits>()
const { t } = useI18n()
const { showSuccess, showError, showWarning, showInfo } = useOperationFeedback()

const providerNameDisplay = computed(() => {
  return t(`unifiedQRLogin.${props.provider}`)
})

const defaultQrCodeUrl = computed(
  () => 'https://open.weixin.qq.com/zh_CN/htmledition/res/img/wechat-logo-new.svg'
)

const loading = ref(false)
const expired = ref(false)
const qrCodeUrl = ref('')
const status = ref<
  'pending' | 'scanning' | 'scanned' | 'confirming' | 'success' | 'failed' | 'expired'
>('pending')
const countdown = ref(0)
const loginId = ref('')
const refreshCount = ref(0)

let statusTimer: NodeJS.Timeout | null = null
let countdownTimer: NodeJS.Timeout | null = null

const generateQrCode = async () => {
  // 如果已经登录成功，不再生成新的二维码
  if (status.value === 'success') {
    logger.info('Login already successful, skipping QR code generation')
    return
  }
  
  try {
    loading.value = true
    expired.value = false

    interface QRCodeResponse {
      success?: boolean
      code?: number
      message?: string
      data?: {
        state?: string
        loginId?: string
        expiresIn?: number
        qrCodeUrl?: string
      }
      isMockData?: boolean
      mockMessage?: string
    }
    let response: QRCodeResponse

    logger.info('Starting to generate WeChat QR code')
    try {
      response = await generateWechatQrCode()
      logger.info('WeChat QR code API call completed', {
        hasResponse: !!response,
        hasData: !!response?.data,
        success: response?.success,
        code: response?.code,
        message: response?.message,
        dataType: typeof response?.data,
        dataKeys: response?.data ? Object.keys(response.data as object) : [],
        dataContent: response?.data ? JSON.stringify(response.data).substring(0, 500) : null,
        fullResponse: JSON.stringify(response).substring(0, 1000),
      })
    } catch (apiError) {
      logger.error('WeChat QR code API call error', {
        error: apiError,
        errorType: typeof apiError,
        errorMessage: apiError instanceof Error ? apiError.message : String(apiError),
      })
      throw apiError
    }

    // ⚠️ 重要：检查响应，如果 code 是 401，说明需要 token，不应该继续处理
    if (response.code === 401) {
      const errorMessage = response.message || t('unifiedQRLogin.qrCodeExpired')
      logger.error('QR code generation failed: authentication required', { code: response.code, message: errorMessage })
      showError(errorMessage)
      emit('login-error', new Error(errorMessage))
      return
    }

    // 检查响应是否成功
    if (!response.success) {
      const errorMessage = response.message || t('unifiedQRLogin.qrCodeExpired')
      logger.error('QR code generation failed', {
        code: response.code, 
        message: errorMessage,
        success: response.success,
      })
      showError(errorMessage)
      emit('login-error', new Error(errorMessage))
      expired.value = true
      status.value = 'failed'
      return
    }

    if (response && response.data) {
      const responseData = response.data as Record<string, unknown>
      logger.info('API response data exists, starting processing', {
        hasState: !!responseData.state,
        hasLoginId: !!responseData.loginId,
        hasQrCodeUrl: !!responseData.qrCodeUrl,
        hasExpiresIn: !!responseData.expiresIn,
      })
      const result = response.data
      loginId.value = result.state || result.loginId || `${props.provider}_${Date.now()}`
      status.value = 'pending'
      countdown.value = result.expiresIn || 300

      // 检查二维码URL是否有效
      let qrUrl = result.qrCodeUrl
      if (!qrUrl || qrUrl.trim() === '') {
        logger.error('Backend returned empty QR code URL', {
          response: response,
          result: result,
        })
        throw new Error(t('error.unified_q_r_login.后端返回的二维码'))
      }

      logger.info('QR code URL:', {
        url: qrUrl.substring(0, 100),
        isWechatUrl: qrUrl.startsWith('https://open.weixin.qq.com'),
        isDataUri: qrUrl.startsWith('data:'),
        isHttpUrl: qrUrl.startsWith('http://') || qrUrl.startsWith('https://'),
      })

      // 如果是微信授权URL（open.weixin.qq.com），需要生成二维码图片
      // 注意：这种情况说明后端可能返回了授权URL而不是图片URL
      if (props.provider === 'wechat' && qrUrl && qrUrl.startsWith('https://open.weixin.qq.com')) {
        try {
          // 使用浏览器兼容的方式导入 qrcode
          interface QRCodeModule {
            toDataURL: (text: string, options?: { width?: number; margin?: number }) => Promise<string>
            default?: QRCodeModule
          }
          let QRCode: QRCodeModule | undefined
          try {
            const qrcodeModule = await import('qrcode')
            QRCode = (qrcodeModule as unknown as QRCodeModule)
          } catch (importError) {
            logger.warn('Default import failed, trying browser version:', importError)
            const browserModule = await import('qrcode/lib/browser')
            QRCode = (browserModule as unknown as QRCodeModule)
          }
          
          if (!QRCode) {
            throw new Error(t('error.unified_q_r_login.QRCode模块1'))
          }
          
          // 确保使用正确的 toDataURL 方法
          const toDataURL = QRCode.default?.toDataURL || QRCode.toDataURL
          if (!toDataURL) {
            throw new Error(t('error.unified_q_r_login.QRCodeto2'))
          }
          
          // 使用类型断言来处理 color 选项（qrcode 库支持但类型定义不完整）
           
          const qrOptions = { width: 280, margin: 2, color: { dark: 'var(--el-text-color-primary)', light: 'var(--el-bg-color)' } } as any
          qrCodeUrl.value = await toDataURL(qrUrl, qrOptions)
        } catch (qrError) {
          logger.error('Failed to generate QR code image:', qrError)
          // 如果生成失败，尝试使用原始URL（可能是图片URL）
          if (qrUrl && (qrUrl.startsWith('http://') || qrUrl.startsWith('https://') || qrUrl.startsWith('data:'))) {
            qrCodeUrl.value = qrUrl
          } else {
            qrCodeUrl.value = defaultQrCodeUrl.value
          }
        }
      } else if (qrUrl && (qrUrl.startsWith('http://') || qrUrl.startsWith('https://') || qrUrl.startsWith('data:'))) {
        // 如果是有效的URL（图片URL或data URI），直接使用
        qrCodeUrl.value = qrUrl
        logger.info('Using direct URL as QR code')
      } else {
        // 如果都不符合，使用默认图标
        logger.warn('Invalid QR code URL format, using default icon:', qrUrl)
        qrCodeUrl.value = defaultQrCodeUrl.value
      }

      logger.info('Final QR code URL set:', {
        hasUrl: !!qrCodeUrl.value,
        urlLength: qrCodeUrl.value.length,
        urlPrefix: qrCodeUrl.value.substring(0, 50),
      })

      startStatusPolling()
      startCountdown()

      showInfo(t('unifiedQRLogin.qrCodeGenerated', { provider: providerNameDisplay.value }))

      if (response.isMockData) {
        showInfo(
          response.mockMessage ||
            t('unifiedQRLogin.qrCodeGenerated', { provider: providerNameDisplay.value })
        )
      }
    } else {
      // 如果响应数据为空，记录详细信息
      logger.error('API response data is empty', {
        hasResponse: !!response,
        responseCode: response?.code,
        responseSuccess: response?.success,
        responseMessage: response?.message,
        responseData: response?.data,
        responseKeys: response ? Object.keys(response) : [],
      })
      const errorMsg = response?.message || t('unifiedQRLogin.qrCodeExpired')
      showError(errorMsg)
      emit('login-error', new Error(errorMsg))
      expired.value = true
      status.value = 'failed'
    }
  } catch (error: any) {
    logger.error(
      t('unifiedQRLogin.logger.generateProviderQrCodeFailed', {
        provider: providerNameDisplay.value,
      }),
      error
    )
    const errorMessage = error instanceof Error ? error.message : t('unifiedQRLogin.qrCodeExpired')
    
    // 如果是因为401错误，显示更友好的提示
    if (errorMessage.includes('401') || errorMessage.includes(t('unifiedQr.loginRequired')) || errorMessage.includes(t('unifiedQr.auth'))) {
      showError(t('unifiedQr.qrFailed'))
    } else {
      showError(errorMessage)
    }
    
    emit('login-error', error)
    
    // 设置过期状态，让用户知道可以刷新
    expired.value = true
    status.value = 'failed'
  } finally {
    loading.value = false
  }
}

const startStatusPolling = () => {
  if (statusTimer) clearInterval(statusTimer)

  statusTimer = setInterval(async () => {
    try {
      if (!loginId.value) {
        logger.warn('loginId is empty, skipping status check')
        return
      }

      logger.debug(`Checking ${props.provider} login status:`, { loginId: loginId.value, currentStatus: status.value })
      
      interface StatusResponse {
        code?: number
        message?: string
        success?: boolean
        data?: {
          status?: string
          token?: string
          userInfo?: Record<string, unknown>
        }
      }
      let response: StatusResponse

      response = await checkWechatQrStatus(loginId.value)

      // ⚠️ 重要：检查响应，如果 code 是 401，说明需要 token，停止轮询并显示错误
      if (response.code === 401) {
        stopAllTimers()
        const errorMessage = response.message || t('unifiedQRLogin.loginFailed') || t('unifiedQr.loginRequired') + t('unifiedQr.needLoginFirst')
        logger.error('Failed to check login status: authentication required', { code: response.code, message: errorMessage })
        showError(errorMessage)
        status.value = 'failed'
        emit('login-error', new Error(errorMessage))
        return
      }

      const responseDataRaw = response?.data as Record<string, unknown> | undefined
      logger.debug('Status check API response:', {
        hasResponse: !!response,
        hasData: !!responseDataRaw,
        status: responseDataRaw?.status,
        hasToken: !!responseDataRaw?.token,
        hasUser: !!responseDataRaw?.user || !!responseDataRaw?.userInfo,
      })

      const responseData =
        (
          response as {
            data?: {
              status?: string
              token?: string
              user?: Record<string, unknown>
              userInfo?: Record<string, unknown>
              message?: string
            }
          }
        ).data || response

      const responseObj = responseData as {
        status?: string
        token?: string
        user?: Record<string, unknown>
        userInfo?: Record<string, unknown>
        message?: string
      }

      const { status: newStatus, token, user, userInfo } = responseObj

      type LoginStatus =
        | 'pending'
        | 'scanning'
        | 'scanned'
        | 'confirming'
        | 'success'
        | 'failed'
        | 'expired'

      const oldStatus = status.value
      status.value = (newStatus as LoginStatus) || 'pending'
      
      if (oldStatus !== status.value) {
        logger.info(`Login status updated: ${oldStatus} -> ${status.value}`)
      }

      if (newStatus === 'success' && (token || user || userInfo)) {
        // 立即停止所有定时器，防止重复处理
        stopAllTimers()
        
        // 确保状态已更新
        status.value = 'success'
        
        logger.info('Login successful, preparing to save token and user info')
        showSuccess(`${providerNameDisplay.value}${t('auth.loginSuccess')}`)

        const userData = user || userInfo || {}
        const finalToken = token || ''

        if (!finalToken) {
          logger.error('Login successful but no token received')
          showError(t('auth.loginFailedRetry'))
          emit('login-error', new Error('Login successful but no token received'))
          return
        }

        // 保存token到多个存储位置，确保路由守卫能够检测到
        StorageManager.setItem(STORAGE_KEYS.USER_TOKEN, finalToken)
        StorageManager.setItem(STORAGE_KEYS.TOKEN, finalToken)
        StorageManager.setItem(STORAGE_KEYS.USER_DATA, userData)

        logger.info('Token and user info saved, triggering login-success event', {
          hasToken: !!finalToken,
          hasUser: Object.keys(userData).length > 0,
          loginType: props.provider,
        })
        
        // 确保状态已更新后再触发事件
        await nextTick()
        
        emit('login-success', {
          token: finalToken,
          user: userData,
          loginType: props.provider,
        })
        
        logger.info('login-success event triggered')
      } else if (newStatus === 'scanned' || newStatus === 'scanning') {
        status.value = newStatus as LoginStatus
        showInfo(t('unifiedQRLogin.scannedConfirm'))
      } else if (newStatus === 'confirming') {
        status.value = 'confirming'
        showInfo(t('unifiedQRLogin.confirmingOnPhone'))
      } else if (newStatus === 'expired') {
        stopAllTimers()
        expired.value = true
        status.value = 'expired'
        showWarning(responseObj.message || t('unifiedQRLogin.manualRefresh'))
      } else if (newStatus === 'failed') {
        stopAllTimers()
        status.value = 'failed'
        const errorMsg = responseObj.message || t('unifiedQRLogin.loginFailed')
        showError(errorMsg)
        emit('login-error', new Error(errorMsg))
      } else {
        status.value = 'pending'
      }
    } catch (error: any) {
      logger.error(
        t('unifiedQRLogin.logger.checkProviderLoginStatusFailed', {
          provider: providerNameDisplay.value,
        }),
        error
      )
    }
  }, props.refreshInterval)
}

const startCountdown = () => {
  if (countdownTimer) clearInterval(countdownTimer)

  countdownTimer = setInterval(() => {
    countdown.value--

    if (countdown.value <= 0) {
      if (props.autoRefresh && refreshCount.value < props.maxRefreshCount) {
        refreshCount.value++
        showInfo(
          t('unifiedQRLogin.autoRefreshing', {
            current: refreshCount.value,
            max: props.maxRefreshCount,
          })
        )
        generateQrCode()
      } else {
        stopAllTimers()
        expired.value = true
        status.value = 'expired'
        showWarning(t('unifiedQRLogin.manualRefresh'))
      }
    }
  }, 1000)
}

const stopAllTimers = () => {
  if (statusTimer) {
    clearInterval(statusTimer)
    statusTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const refreshQrCode = () => {
  refreshCount.value = 0
  generateQrCode()
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  logger.error('QR code image failed to load:', {
    src: img?.src,
    currentQrCodeUrl: qrCodeUrl.value,
    status: status.value,
    qrCodeUrlLength: qrCodeUrl.value?.length || 0,
  })
  
  // 如果二维码URL为空或无效，说明后端没有返回有效的二维码
  if (!qrCodeUrl.value || qrCodeUrl.value.trim() === '' || qrCodeUrl.value === defaultQrCodeUrl.value) {
    logger.error('QR code URL is invalid, possibly due to backend API data issue', {
      qrCodeUrl: qrCodeUrl.value,
      loginId: loginId.value,
      status: status.value,
    })
    
    // 不显示错误提示，因为可能已经在生成二维码时显示过了
    // 设置过期状态，让用户可以手动刷新
    expired.value = true
    status.value = 'failed'
    return
  }
  
  // 如果当前URL不是默认URL，尝试使用默认URL
  if (qrCodeUrl.value && qrCodeUrl.value !== defaultQrCodeUrl.value) {
    logger.warn('QR code image failed to load, trying default icon')
    qrCodeUrl.value = defaultQrCodeUrl.value
  } else {
    // 如果默认URL也加载失败，显示错误并尝试重新生成
    showError(t('unifiedQRLogin.qrCodeLoadFailed'))
    expired.value = true
    status.value = 'failed'
    // 延迟后自动刷新
    setTimeout(() => {
      if (status.value === 'failed' || status.value === 'expired') {
        logger.info('Auto refreshing QR code')
        refreshQrCode()
      }
    }, 2000)
  }
}

onUnmounted(() => {
  stopAllTimers()
})

onMounted(() => {
  if (props.autoStart) {
    generateQrCode()
  }
})

defineExpose({
  generateQrCode,
  refreshQrCode,
  stopAllTimers,
})
</script>

<style lang="scss" scoped>
.unified-qr-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.qr-container {
  width: 280px;
  height: 280px;
  position: relative;
}

.loading-state,
.expired-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
  padding: 20px;
}

.spinning {
  font-size: 48px;
  animation:
    spin 1s linear infinite,
    pulse 2s ease-in-out infinite;
  color: var(--el-color-primary);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.expired-icon {
  font-size: 48px;
  color: var(--el-color-warning);
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }

  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-5px);
  }

  20%,
  40%,
  60%,
  80% {
    transform: translateX(5px);
  }
}

.qr-display {
  width: 100%;
  height: 100%;
}

.qr-image-container {
  width: 100%;
  height: 100%;
  position: relative;
  border: 2px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--el-text-color-primary);
}

.qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
}

.placeholder-icon {
  font-size: 48px;
  animation: spin 1s linear infinite;
  color: var(--el-color-primary);
}

.scanned-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-white-90);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

// 暗色模式适配
html.dark .qr-loading-overlay {
  background: var(--color-black-90);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.success-icon {
  font-size: 48px;
  color: var(--el-color-success);
  animation: successPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes successPop {
  0% {
    transform: scale(0);
    opacity: 0;
  }

  50% {
    transform: scale(1.2);
    opacity: 1;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.qr-info {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.status-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.status-waiting {
  color: var(--el-text-color-regular);
}

.status-scanning,
.status-confirming {
  color: var(--el-color-primary);
}

.status-scanned {
  color: var(--el-color-success);
}

.status-failed {
  color: var(--el-color-danger);
}

.countdown {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.retry-actions {
  margin-top: 8px;
}

.actions {
  display: flex;
  gap: 12px;
}

.tips {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;

  p {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }
}
</style>
