<template>
  <div class="payment-page">
    <div class="payment-container">
      <div class="header">
        <h1 class="title">{{ t('payment.memberCenter') }}</h1>
        <p class="subtitle">{{ t('payment.memberCenterSubtitle') }}</p>
      </div>

      <div class="package-container">
        <div class="package active">
          <div class="package-header">
            <span class="package-title">{{ t('payment.vipTitle') }}</span>
            <span class="package-tag">{{ t('payment.superValue') }}</span>
          </div>
          <div class="package-price">
            <span class="price">¥588</span>
            <span class="original-price">¥1288</span>
          </div>
          <div class="package-desc">
            <p>{{ t('payment.vipPrivileges') }}</p>
            <p>{{ t('payment.privilege1') }}</p>
            <p>{{ t('payment.privilege2') }}</p>
            <p>{{ t('payment.privilege3') }}</p>
            <p>{{ t('payment.privilege4') }}</p>
          </div>
          <div class="select-icon">✓</div>
        </div>
      </div>

      <div class="payment-methods">
        <h3 class="section-title">{{ t('payment.paymentMethod') }}</h3>
        <div
          class="method"
          :class="{ active: payMethod === 'wxpay' }"
          @click="selectPayMethod('wxpay')"
        >
          <img class="method-icon" src="/static/images/wxpay.png" alt="微信支付" loading="lazy" />
          <span class="method-name">{{ t('payment.wechatPay') }}</span>
          <div class="select-icon" v-if="payMethod === 'wxpay'">✓</div>
        </div>
        <div
          class="method"
          :class="{ active: payMethod === 'alipay' }"
          @click="selectPayMethod('alipay')"
        >
          <img class="method-icon" src="/static/images/alipay.png" alt="支付宝" loading="lazy" />
          <span class="method-name">{{ t('payment.alipay') }}</span>
          <div class="select-icon" v-if="payMethod === 'alipay'">✓</div>
        </div>
        <div
          v-if="payMethodDowngraded"
          class="method-downgrade-hint"
        >
          <span>{{ t('payment.channelBusyHint', { method: payMethodLabel }) }}</span>
        </div>
      </div>

      <div class="agreement">
        <el-checkbox v-model="isAgree" />
        <span class="agreement-text">
          我已阅读并同意
          <span class="link" @click="openAgreement">《{{ t('payment.memberServiceAgreement') }}》</span>
        </span>
      </div>

      <el-button
        class="pay-button"
        type="primary"
        :disabled="!isValid"
        @click="doPayment"
        size="large"
        round
      >
        立即支付 {{ totalAmount }}元
      </el-button>

      <el-dialog
        v-model="showResultDialog"
        width="400px"
        :show-close="false"
        center
      >
        <div class="result-popup">
          <div class="result-icon" :class="{ success: paymentSuccess }">
            <span v-if="paymentSuccess">✓</span>
            <span v-else>✗</span>
          </div>
          <h3 class="result-title">{{ paymentSuccess ? t('payment.paySuccess') : t('payment.payFailed') }}</h3>
          <p class="result-message">{{ paymentResultMessage }}</p>
          <el-button
            class="result-button"
            type="primary"
            @click="closeResultPopup"
          >
            {{ paymentSuccess ? '完成' : '重试' }}
          </el-button>
        </div>
      </el-dialog>

      <!-- 支付二维码弹窗 -->
      <el-dialog
        v-model="showQrCodeDialog"
        width="380px"
        :show-close="!qrExpired"
        :close-on-click-modal="false"
        center
      >
        <div class="qrcode-popup">
          <h3 class="qrcode-title">
            <span>{{ t('payment.scanToPay', { method: payMethodLabel }) }}</span>
          </h3>
          <div v-if="!qrExpired" class="qrcode-wrapper">
            <div class="qrcode-img" :class="{ expired: qrExpired }">
              <div v-if="qrCodeUrl" class="qr-placeholder">
                <span class="qr-icon">📱</span>
                <span class="qr-hint">¥{{ totalAmount }}</span>
              </div>
              <div v-else class="qr-loading">
                <div class="qr-spinner"></div>
                <span>{{ t('payment.loading') }}</span>
              </div>
            </div>
            <div class="qrcode-countdown">
              <span class="countdown-label">{{ t('payment.qrcodeValidity') }}</span>
              <span class="countdown-value" :class="{ urgent: qrCountdown <= 60 }">
                {{ formatCountdown(qrCountdown) }}
              </span>
            </div>
            <el-button
              v-if="qrCountdown <= 0"
              class="qrcode-refresh-btn"
              type="primary"
              @click="refreshQrCode"
            >
              刷新二维码
            </el-button>
          </div>
          <div v-else class="qrcode-expired">
            <div class="expired-icon">⏱</div>
            <h4>{{ t('payment.qrcodeExpired') }}</h4>
            <p>{{ t('payment.refreshAndRetry') }}</p>
            <el-button
              class="qrcode-refresh-btn"
              type="primary"
              @click="refreshQrCode"
            >
              刷新二维码
            </el-button>
          </div>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { getUserToken } from '@/utils/request'

const { t } = useI18n()

const payMethod = ref('wxpay')
const isAgree = ref(false)
const payMethodDowngraded = ref(false)

const product = ref({
  id: 'vip',
  name: t('payment.vipTitle'),
  price: 588,
  original_price: 1288,
  duration: -1,
})

const paymentSuccess = ref(false)
const paymentResultMessage = ref('')
const orderNo = ref('')
const showResultDialog = ref(false)
const showQrCodeDialog = ref(false)
const qrCodeUrl = ref('')
const qrCountdown = ref(300)
const qrExpired = ref(false)
let orderPollingInterval: ReturnType<typeof setInterval> | null = null
let orderPollingStopTimer: ReturnType<typeof setTimeout> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
// 跳转/重试定时器
let navTimer: ReturnType<typeof setTimeout> | null = null
const paymentRetryCount = ref(0)
const MAX_PAYMENT_RETRY = 2
// 防重复点击锁：支付进行中禁止再次点击
const isPaying = ref(false)

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()

const payMethodLabel = computed(() => {
  return payMethod.value === 'alipay' ? '支付宝' : '微信'
})

const isValid = computed(() => {
  return payMethod.value && isAgree.value
})

const totalAmount = computed(() => {
  return product.value.price
})

function getUserInfo() {
  const userInfo = StorageManager.getItem(STORAGE_KEYS.USER_INFO) as Record<string, unknown> | null
  if (!userInfo) {
    ElMessage.warning(t('payment.pleaseLoginFirst'))
    if (navTimer !== null) clearTimeout(navTimer)
    navTimer = setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
    return
  }

  if (!userInfo.openid) {
    ElMessage.warning(t('payment.userInfoIncomplete'))
    if (navTimer !== null) clearTimeout(navTimer)
    navTimer = setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
    return
  }
}

function selectPayMethod(method: string) {
  payMethod.value = method
}

function openAgreement() {
  window.open('/agreement/service', '_blank')
}

async function doPayment() {
  if (!isValid.value) return
  // 防重复点击锁：支付进行中直接返回
  if (isPaying.value) return
  isPaying.value = true

  const userInfo = StorageManager.getItem(STORAGE_KEYS.USER_INFO) as Record<string, unknown> | null
  if (!userInfo || !userInfo.openid) {
    isPaying.value = false
    ElMessage.warning(t('payment.pleaseLoginFirst'))
    if (navTimer !== null) clearTimeout(navTimer)
    navTimer = setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
    return
  }

  if (userInfo.is_permanent_VIP) {
    isPaying.value = false
    ElMessage.info(t('Payment.alreadyVip'))
    return
  }

  const loadingInstance = ElMessage({
    message: '订单创建中...',
    type: 'info',
    duration: 0,
  })

  try {
    const orderResult = await createOrder()

    loadingInstance.close()

    if (orderResult.code === 0) {
      orderNo.value = orderResult.data.order_no
      qrCodeUrl.value = orderResult.data.qr_code || ''
      showQrCodeDialog.value = true
      startQrCountdown()
      startOrderPolling()
    } else {
      ElMessage.error(orderResult.message || '创建订单失败')
    }
  } catch (error) {
    loadingInstance.close()
    if (paymentRetryCount.value < MAX_PAYMENT_RETRY) {
      paymentRetryCount.value += 1
      ElMessage.warning(`支付异常，自动重试 (${paymentRetryCount.value}/${MAX_PAYMENT_RETRY})`)
      if (navTimer !== null) clearTimeout(navTimer)
      navTimer = setTimeout(() => doPayment(), 1500)
    } else {
      ElMessage.error(error instanceof Error ? error.message : '支付异常，请稍后重试')
      logger.error('Payment exception:', error)
    }
  } finally {
    isPaying.value = false
  }
}

async function refreshQrCode() {
  // 防重复点击锁
  if (isPaying.value) return
  isPaying.value = true

  // 先关闭旧订单，避免产生多个未支付订单
  if (orderNo.value) {
    try {
      const token = getUserToken()
      await fetch('/api/payment/closeOrder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ order_no: orderNo.value }),
      })
    } catch (err) {
      logger.warn('关闭旧订单失败，继续创建新订单:', err)
    }
    orderNo.value = ''
  }

  // 停止旧订单的轮询和倒计时
  stopOrderPolling()
  stopQrCountdown()

  qrExpired.value = false
  qrCountdown.value = 300
  qrCodeUrl.value = ''
  paymentRetryCount.value = 0
  const loadingInstance = ElMessage({
    message: '正在刷新二维码...',
    type: 'info',
    duration: 0,
  })
  try {
    const orderResult = await createOrder()
    loadingInstance.close()
    if (orderResult.code === 0) {
      orderNo.value = orderResult.data.order_no
      qrCodeUrl.value = orderResult.data.qr_code || ''
      startQrCountdown()
      startOrderPolling()
    } else {
      ElMessage.error(orderResult.message || '刷新二维码失败')
    }
  } catch (error) {
    loadingInstance.close()
    ElMessage.error(error instanceof Error ? error.message : '刷新失败，请稍后再试')
  } finally {
    isPaying.value = false
  }
}

function startQrCountdown() {
  stopQrCountdown()
  countdownInterval = setInterval(() => {
    qrCountdown.value -= 1
    if (qrCountdown.value <= 0) {
      qrExpired.value = true
      stopQrCountdown()
    }
  }, 1000)
}

function stopQrCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '已过期'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function createOrder() {
  const userInfo = StorageManager.getItem(STORAGE_KEYS.USER_INFO) as Record<string, unknown> | null
  if (!userInfo) {
    throw new Error(t('Payment.notLogged'))
  }

  if (!userInfo.openid) {
    throw new Error(t('payment.userNoOpenid'))
  }

  if (!product.value.id) {
    throw new Error(t('Payment.incompleteProduct'))
  }

  if (!payMethod.value) {
    throw new Error(t('Payment.selectPayMethod'))
  }

  const params = {
    productId: product.value.id,
    payMethod: payMethod.value,
    openid: userInfo.openid,
  }

  const token = getUserToken()
  const response = await fetch('/api/payment/createOrder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(t('payment.createOrderFailed', { status: response.status }))
  }

  const result = await response.json()
  return result
}

function _callWxPay(payParams: Record<string, unknown>) {
  if (!payParams) return
  ElMessage.info(t('payment.redirectingPayment'))
}

function startOrderPolling() {
  orderPollingInterval = setInterval(() => {
    checkOrderStatus()
  }, 3000)

  // 60 秒后自动停止轮询，保存返回值以便组件卸载时清理
  orderPollingStopTimer = setTimeout(() => {
    stopOrderPolling()
  }, 60000)
}

function stopOrderPolling() {
  if (orderPollingInterval) {
    clearInterval(orderPollingInterval)
    orderPollingInterval = null
  }
  if (orderPollingStopTimer) {
    clearTimeout(orderPollingStopTimer)
    orderPollingStopTimer = null
  }
}

async function checkOrderStatus() {
  try {
    const result = await getOrderStatus()

    if (result.code === 0) {
      const orderData = result.data

      if (orderData.isPaid) {
        stopOrderPolling()
        showPaymentResult(true, '恭喜您成为VIP会员！')
        refreshUserInfo()
      } else if (orderData.status === 'failed' || orderData.status === 'closed' || orderData.status === 'cancelled') {
        // 订单失败/关闭/取消：停止轮询并提示用户
        stopOrderPolling()
        stopQrCountdown()
        qrExpired.value = true
        showPaymentResult(false, t('payment.orderCancelled'))
      }
    }
  } catch (error) {
    logger.error('Failed to check order status:', error)
  }
}

async function getOrderStatus() {
  const userInfo = StorageManager.getItem(STORAGE_KEYS.USER_INFO) as Record<string, unknown> | null
  if (!userInfo || !userInfo.openid) {
    throw new Error(t('Payment.notLoggedOrNoOpenId'))
  }

  const token = getUserToken()
  const response = await fetch('/api/payment/checkOrderStatus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify({ openid: userInfo.openid }),
  })

  if (!response.ok) {
    throw new Error(t('payment.checkOrderFailed', { status: response.status }))
  }

  return await response.json()
}

function showPaymentResult(success: boolean, message: string) {
  paymentSuccess.value = success
  paymentResultMessage.value = message
  showResultDialog.value = true
}

function closeResultPopup() {
  showResultDialog.value = false

  if (paymentSuccess.value) {
    window.location.href = '/member'
  }
}

function refreshUserInfo() {
  const userInfo = StorageManager.getItem(STORAGE_KEYS.USER_INFO) as Record<string, unknown> | null
  if (!userInfo || !userInfo.openid) {
    logger.error('Failed to refresh user info: user not logged in or openid does not exist')
    return
  }

  const token = getUserToken()
  fetch('/api/user/getUserInfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify({ openid: userInfo.openid }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((result) => {
      if (result.code === 0 && result.data) {
        StorageManager.setItem(STORAGE_KEYS.USER_INFO, result.data)
      }
    })
    .catch((err) => {
      logger.error('Failed to refresh user info:', err)
    })
}

cleanup.add(() => {
  stopOrderPolling()
  stopQrCountdown()
  if (navTimer !== null) {
    clearTimeout(navTimer)
    navTimer = null
  }
})

// 初始化
getUserInfo()
</script>

<style scoped lang="scss">
.payment-page {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--color-payment-purple-start) 0%, var(--color-payment-purple-end) 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.payment-container {
  width: 100%;
  max-width: 480px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 32px;
  box-shadow: var(--global-box-shadow);
}

.header {
  text-align: center;
  margin-bottom: 32px;

  .title {
    font-size: 28px;
    font-weight: bold;
    color: var(--color-gray-333);
    margin: 0 0 8px;
  }

  .subtitle {
    font-size: 14px;
    color: var(--color-gray-666);
    margin: 0;
  }
}

.package-container {
  margin-bottom: 32px;

  .package {
    padding: 24px;
    border-radius: var(--global-border-radius);
    background: var(--color-gray-f8f8f8);
    position: relative;
    border: 2px solid transparent;
    transition: all 0.3s;

    &.active {
      border-color: var(--color-blue-0056d6);
      background: var(--color-blue-0056d6-5);
    }

    .package-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .package-title {
        font-size: 18px;
        font-weight: bold;
        color: var(--color-gray-333);
      }

      .package-tag {
        font-size: 12px;
        color: var(--color-white);
        background: var(--color-orange-ff6b00);
        padding: 4px 12px;
        border-radius: var(--global-border-radius);
      }
    }

    .package-price {
      margin-bottom: 16px;

      .price {
        font-size: 32px;
        font-weight: bold;
        color: var(--color-blue-0056d6);
        margin-right: 12px;
      }

      .original-price {
        font-size: 14px;
        color: var(--color-gray-999);
        text-decoration: line-through;
      }
    }

    .package-desc {
      display: flex;
      flex-direction: column;
      gap: 8px;

      p {
        font-size: 14px;
        color: var(--color-gray-666);
        margin: 0;

        &::before {
          content: '• ';
          color: var(--color-blue-0056d6);
        }
      }
    }

    .select-icon {
      position: absolute;
      right: 24px;
      bottom: 24px;
      width: 32px;
      height: 32px;
      background: var(--color-blue-0056d6);
      color: var(--color-white);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
  }
}

.payment-methods {
  margin-bottom: 32px;

  .section-title {
    font-size: 16px;
    font-weight: bold;
    color: var(--color-gray-333);
    margin: 0 0 16px;
  }

  .method {
    display: flex;
    align-items: center;
    padding: 16px;
    border-radius: var(--global-border-radius);
    background: var(--color-gray-f8f8f8);
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background: var(--color-gray-light);
    }

    &.active {
      border-color: var(--color-blue-0056d6);
      background: var(--color-blue-0056d6-5);
    }

    .method-icon {
      width: 40px;
      height: 40px;
      margin-right: 16px;
    }

    .method-name {
      font-size: 16px;
      color: var(--color-gray-333);
      flex: 1;
    }

    .select-icon {
      width: 28px;
      height: 28px;
      background: var(--color-blue-0056d6);
      color: var(--color-white);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
  }
}

.agreement {
  display: flex;
  align-items: center;
  margin-bottom: 24px;

  .agreement-text {
    font-size: 13px;
    color: var(--color-gray-666);
    margin-left: 8px;
  }

  .link {
    color: var(--color-blue-0056d6);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.pay-button {
  width: 100%;
  height: 56px;
  font-size: 18px;
  font-weight: bold;
  border-radius: var(--global-border-radius);

  &:disabled {
    background: var(--color-gray-ccc);
    border-color: var(--color-gray-ccc);
  }
}

.result-popup {
  text-align: center;
  padding: 20px;

  .result-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--color--ff5252);
    color: var(--color-white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    margin: 0 auto 24px;

    &.success {
      background: var(--color-green-4caf50);
    }
  }

  .result-title {
    font-size: 20px;
    font-weight: bold;
    color: var(--color-gray-333);
    margin: 0 0 16px;
  }

  .result-message {
    font-size: 14px;
    color: var(--color-gray-666);
    margin: 0 0 24px;
  }

  .result-button {
    width: 80%;
    height: 48px;
    font-size: 16px;
    border-radius: var(--global-border-radius);
  }
}

.qrcode-popup {
  text-align: center;
  padding: 20px;

  .qrcode-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-gray-333);
    margin: 0 0 24px;
  }

  .qrcode-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .qrcode-img {
    width: 200px;
    height: 200px;
    border-radius: var(--global-border-radius);
    background: var(--color-gray-f8f8f8);
    border: 2px solid var(--color-gray-e5e5e5);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.3s;

    &.expired {
      opacity: 0.4;
    }

    .qr-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      .qr-icon {
        font-size: 48px;
      }

      .qr-hint {
        font-size: 16px;
        font-weight: 700;
        color: var(--color-gray-333);
      }
    }

    .qr-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--color-gray-666);
      font-size: 13px;

      .qr-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--color-gray-e5e5e5);
        border-top-color: var(--color-blue-0056d6);
        border-radius: 50%;
        animation: qr-spin 0.8s linear infinite;
      }
    }
  }

  .qrcode-countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;

    .countdown-label {
      font-size: 12px;
      color: var(--color-gray-666);
    }

    .countdown-value {
      font-size: 24px;
      font-weight: 800;
      color: var(--color-blue-0056d6);
      font-variant-numeric: tabular-nums;

      &.urgent {
        color: var(--color--ff5252);
        animation: qr-pulse 1s ease-in-out infinite;
      }
    }
  }

  .qrcode-refresh-btn {
    width: 80%;
    height: 44px;
    font-size: 14px;
    border-radius: var(--global-border-radius);
    margin-top: 8px;
  }

  .qrcode-expired {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 0;

    .expired-icon {
      font-size: 48px;
    }

    h4 {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-gray-333);
      margin: 0;
    }

    p {
      font-size: 14px;
      color: var(--color-gray-666);
      margin: 0 0 12px;
    }
  }
}

.method-downgrade-hint {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: var(--global-border-radius);
  background: var(--color-amber-fff7e6);
  border: var(--unified-border);
  font-size: 12px;
  color: var(--color-amber-874d00);
  text-align: left;
}

@keyframes qr-spin {
  to { transform: rotate(360deg); }
}

@keyframes qr-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
