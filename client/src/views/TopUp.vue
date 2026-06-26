<template>
  <div class="top-up-page page-container">
    <!-- Loading 遮罩层 -->
    <div v-if="loading" class="loading-mask">
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ t('topUp.loading') }}</div>
      </div>
    </div>

    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Wallet /></el-icon>
        {{ t('topUp.title') }}
      </h1>
      <p class="page-subtitle">{{ t('topUp.subtitle') }}</p>
    </div>

    <!-- 用户信息卡片（显示当前余额） -->
    <div class="user-info-section radius-auto">
      <UserInfoCard />
    </div>

    <!-- 充值金额选择 - 金额网格 -->
    <div class="amount-section radius-auto">
      <h3 class="section-title">{{ t('topUp.selectAmount') }}</h3>
      <div class="amount-grid">
        <div
          v-for="(item, index) in amountList"
          :key="index"
          class="amount-item"
          :class="{ 'amount-item-active': selectedAmount === item.value }"
          @click="selectAmount(item.value)"
        >
          <div class="amount-value">{{ item.value }}</div>
          <div class="amount-label">{{ item.label }}</div>
          <div class="amount-price" v-if="item.discount">¥{{ item.price }}</div>
          <div class="amount-price" v-else>¥{{ item.value }}</div>
        </div>
      </div>
    </div>

    <!-- 自定义金额 -->
    <div class="custom-amount-section radius-auto">
      <h3 class="section-title">{{ t('topUp.customAmount') }}</h3>
      <div class="custom-input-wrapper">
        <span class="currency-symbol">¥</span>
        <input
          class="custom-input"
          type="digit"
          v-model="customAmount"
          :placeholder="t('topUp.customPlaceholder')"
          @blur="onCustomAmountBlur"
        />
      </div>
    </div>

    <!-- 支付方式选择 -->
    <div class="payment-methods-section radius-auto">
      <h3 class="section-title">{{ t('topUp.selectPaymentMethod') }}</h3>
      <div class="method-list">
        <div
          v-for="method in paymentMethods"
          :key="method.id"
          class="method-item"
          :class="{ active: selectedMethod === method.id }"
          @click="selectedMethod = method.id"
        >
          <div class="method-icon">
            <component :is="method.icon" />
          </div>
          <div class="method-info">
            <div class="method-name">{{ method.name }}</div>
            <div class="method-desc">{{ method.desc }}</div>
          </div>
          <div class="method-radio">
            <el-radio :model-value="selectedMethod" :value="method.id" />
          </div>
        </div>
      </div>
    </div>

    <!-- 充值操作 -->
    <div class="top-up-actions radius-auto">
      <el-button size="large" @click="router.back()">{{ t('topUp.cancel') }}</el-button>
      <el-button
        size="large"
        type="primary"
        :disabled="!selectedAmount || selectedAmount < 1"
        :loading="creatingOrder"
        @click="handleTopUp"
      >
        {{ t('topUp.submit') }}
      </el-button>
    </div>

    <!-- 充值说明 -->
    <div class="notice-section radius-auto">
      <h3 class="notice-title">{{ t('topUp.noticeTitle') }}</h3>
      <div class="notice-content">
        <p>{{ t('topUp.notice1') }}</p>
        <p>{{ t('topUp.notice2') }}</p>
        <p>{{ t('topUp.notice3') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Wallet, CreditCard, Smartphone } from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { createTopUpOrder } from '@/api/payment/top-up'
import UserInfoCard from '@/components/user/UserInfoCard.vue'
import { logger } from '@/utils/logger'

const router = useRouter()
const { t } = useI18n()
const { showError } = useOperationFeedback()

const loading = ref(false)
const selectedAmount = ref(0)
const customAmount = ref('')
const selectedMethod = ref<'wechat' | 'alipay'>('wechat')
const creatingOrder = ref(false)

const amountList = ref([
  { value: 10, label: t('topUp.amountLabels.coins', { count: 10 }), price: 10, discount: false },
  { value: 50, label: t('topUp.amountLabels.coins', { count: 50 }), price: 50, discount: false },
  { value: 100, label: t('topUp.amountLabels.coins', { count: 100 }), price: 100, discount: true },
  { value: 200, label: t('topUp.amountLabels.coins', { count: 200 }), price: 180, discount: true },
  { value: 500, label: t('topUp.amountLabels.coins', { count: 500 }), price: 450, discount: true },
  { value: 1000, label: t('topUp.amountLabels.coins', { count: 1000 }), price: 900, discount: true },
])

const paymentMethods = [
  {
    id: 'wechat' as const,
    name: t('topUp.paymentMethods.wechat.name'),
    desc: t('topUp.paymentMethods.wechat.desc'),
    icon: Smartphone,
  },
  {
    id: 'alipay' as const,
    name: t('topUp.paymentMethods.alipay.name'),
    desc: t('topUp.paymentMethods.alipay.desc'),
    icon: CreditCard,
  },
]

function selectAmount(amount: number) {
  selectedAmount.value = amount
  customAmount.value = ''
}

function onCustomAmountBlur() {
  if (!customAmount.value) return
  // 校验：必须是正数、最多两位小数、范围 1~50000
  const num = Number(customAmount.value)
  if (isNaN(num) || num <= 0) {
    showError(t('topUp.errors.invalidAmount'))
    customAmount.value = ''
    return
  }
  // 最多两位小数
  const parts = customAmount.value.split('.')
  if (parts.length > 1 && parts[1].length > 2) {
    showError(t('topUp.errors.amountDecimals'))
    customAmount.value = ''
    return
  }
  // 合理范围限制
  if (num < 1 || num > 50000) {
    showError(t('topUp.errors.amountRange'))
    customAmount.value = ''
    return
  }
  selectedAmount.value = num
}

const handleTopUp = async () => {
  // 充值金额校验：正数、数字、合理范围、最多两位小数
  const amount = Number(selectedAmount.value)
  if (!selectedAmount.value || isNaN(amount) || amount < 1) {
    showError(t('topUp.errors.selectAmount'))
    return
  }
  if (amount > 50000) {
    showError(t('topUp.errors.amountRange'))
    return
  }

  try {
    creatingOrder.value = true
    const response = await createTopUpOrder({
      amount: amount,
      payment_method: selectedMethod.value,
    })

    if (response.success || response.code === 200) {
      if (response.data?.order_id) {
        router.push(`/payment?orderId=${response.data.order_id}`)
      } else {
        router.push('/top-up/success')
      }
    } else {
      showError(response.message || t('topUp.errors.createOrderFailed'))
    }
  } catch (error) {
    logger.error(t('topUp.errors.logger.createOrderFailed'), error)
    showError(t('topUp.errors.createOrderRetry'))
  } finally {
    creatingOrder.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.top-up-page {
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;
  position: relative;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.loading-mask {
  position: fixed;
  inset: 0;
  background: var(--color-black-50);
  z-index: var(--z-notification);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-container {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 40px 60px;
  text-align: center;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid var(--el-border-color-lighter);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.page-header {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (width <= $desktop-breakpoint-sm) { font-size: 20px; }

  @media (width <= $desktop-breakpoint-xs) { font-size: 18px; }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) { font-size: 12px; }
}

.user-info-section,
.amount-section,
.payment-methods-section,
.custom-amount-section,
.notice-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) { padding: 16px; }
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
}

.amount-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  @media (width <= $desktop-breakpoint-xs) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.amount-item {
  background: var(--el-fill-color-light);
  border: 2px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius);
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.amount-item-active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.amount-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}

.amount-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.amount-price {
  font-size: 16px;
  color: var(--el-color-danger);
  font-weight: 500;
}

.custom-input-wrapper {
  display: flex;
  align-items: center;
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 24px;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--el-color-primary);
  }
}

.currency-symbol {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-right: 16px;
}

.custom-input {
  flex: 1;
  font-size: 20px;
  color: var(--el-text-color-primary);
  background: transparent;
  border: none;
  outline: none;

  &::placeholder {
    color: var(--el-text-color-placeholder);
  }
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.method-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--el-bg-color);
  }

  &.active {
    background-color: var(--el-color-primary-light-9);
  }
}

.method-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
}

.method-info { flex: 1; }

.method-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.method-desc {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.top-up-actions {
  display: flex;
  gap: 12px;
  padding: 20px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.notice-section {
  .notice-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 16px;
  }

  .notice-content {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.8;

    p {
      margin: 0 0 8px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>
