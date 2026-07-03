<template>
  <div class="recharge-page">
    <!-- 深度背景系统 -->
    <div class="page-bg">
      <div class="bg-glow bg-glow--1"></div>
      <div class="bg-glow bg-glow--2"></div>
    </div>

    <!-- 页面内容 -->
    <div class="page-content">
      <!-- 页面头部 -->
      <header class="page-header" data-animate="fade-down">
        <div class="header-decor">
          <span class="decor-line"></span>
          <span class="decor-dot"></span>
        </div>
        <h1 class="page-title">
          <span class="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
            </svg>
          </span>
          {{ t('recharge.title') }}
        </h1>
        <p class="page-subtitle">Secure Transaction System</p>
      </header>

      <!-- 用户信息卡片 -->
      <section class="user-section" data-animate="fade-up" data-delay="100">
        <UserInfoCard :user="authStore.user" :show-btn="false" />
      </section>

      <!-- 金额选择区域 -->
      <section class="recharge-section" data-animate="fade-up" data-delay="200">
        <div class="glass-card amount-card">
          <div class="card-corner card-corner--tl"></div>
          <div class="card-corner card-corner--tr"></div>
          <div class="card-corner card-corner--bl"></div>
          <div class="card-corner card-corner--br"></div>
          
          <div class="card-header">
            <div class="header-icon-wrap">
              <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M6 12h.01M18 12h.01" />
              </svg>
            </div>
            <div class="header-text">
              <span class="header-title">{{ t('recharge.selectAmount') }}</span>
              <span class="header-tip">{{ t('recharge.officialRecharge') }}</span>
            </div>
            <div class="header-status">
              <span class="status-dot"></span>
              <span class="status-text">ONLINE</span>
            </div>
          </div>

          <div class="rate-info">
            <div class="rate-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="rate-icon">
                <path d="M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
              {{ t('recharge.rate') }}
            </div>
            <div class="rate-details">
              <div class="rate-item">
                <span class="rate-badge">STD</span>
                {{ t('recharge.normalUser') }}{{ price }}￥ = {{ formatTokenValue(denomination) }}{{ t('recharge.tokens') }}
              </div>
              <div class="rate-item rate-item--vip">
                <span class="rate-badge rate-badge--vip">VIP</span>
                {{ t('recharge.vipUser') }}{{ price }}￥ = {{ formatTokenValue(denominationVip) }}{{ t('recharge.tokens') }}
              </div>
              <div class="rate-item rate-item--op">
                <span class="rate-badge rate-badge--op">OPR</span>
                {{ t('recharge.operator') }}{{ price }}￥ = {{ formatTokenValue(denominationOperator) }}{{ t('recharge.tokens') }}
              </div>
            </div>
          </div>

          <div class="amount-list">
            <button
              v-for="item in amountList"
              :key="item.id"
              class="amount-item ripple-btn"
              :class="{ active: item.id === selectedAmountId }"
              @click="selectAmount(item)"
            >
              <span class="amount-glow"></span>
              <span class="amount-content">
                <img
                  :src="item.id === selectedAmountId ? '/images/gold-active.png' : '/images/gold.png'"
                  alt="Icon"
                  class="amount-icon"
                  loading="lazy"
                />
                <span class="amount-text">
                  <span class="amount-currency">￥</span>
                  {{ item.price }}
                </span>
              </span>
              <span class="amount-border"></span>
            </button>
          </div>
        </div>
      </section>

      <!-- 支付方式区域 -->
      <section class="payment-section" data-animate="fade-up" data-delay="300">
        <div class="glass-card pay-card">
          <div class="card-corner card-corner--tl"></div>
          <div class="card-corner card-corner--tr"></div>
          <div class="card-corner card-corner--bl"></div>
          <div class="card-corner card-corner--br"></div>

          <div class="card-header">
            <div class="header-icon-wrap">
              <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17 9V7a5 5 0 00-10 0v2M5 9h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2z" />
                <circle cx="12" cy="15" r="2" />
              </svg>
            </div>
            <div class="header-text">
              <span class="header-title">{{ t('recharge.selectPayment') }}</span>
              <span class="header-tip">{{ t('recharge.moreMethods') }}</span>
            </div>
            <div class="header-status">
              <span class="status-dot status-dot--secure"></span>
              <span class="status-text">SECURE</span>
            </div>
          </div>

          <div class="pay-list">
            <button
              v-for="item in paymentMethods"
              :key="item.id"
              class="pay-item ripple-btn"
              :class="{ active: item.id === selectedPaymentId }"
              @click="selectPayment(item)"
            >
              <span class="pay-glow"></span>
              <div class="pay-content">
                <img :src="item.icon" alt="Payment" class="pay-icon" loading="lazy" />
                <span class="pay-name">{{ item.name }}</span>
                <div class="pay-radio">
                  <span class="radio-outer">
                    <span class="radio-inner" :class="{ checked: item.id === selectedPaymentId }"></span>
                  </span>
                </div>
              </div>
              <span class="pay-border"></span>
            </button>
          </div>

          <div class="action-section">
            <button
              class="recharge-btn ripple-btn"
              :class="{ loading: loading }"
              :disabled="loading"
              @click="handleRecharge"
            >
              <span class="btn-glow"></span>
              <span class="btn-content">
                <svg v-if="!loading" class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                <span v-if="loading" class="btn-loader"></span>
                <span class="btn-text">{{ t('recharge.recharge') }}</span>
              </span>
              <span class="btn-border"></span>
            </button>
          </div>
        </div>
      </section>

      <!-- 底部装饰 -->
      <footer class="page-footer" data-animate="fade-up" data-delay="400">
        <div class="footer-line"></div>
        <span class="footer-text">IHUI AI · TRANSACTION TERMINAL</span>
        <div class="footer-line"></div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import UserInfoCard from '@/components/user/UserInfoCard.vue'
import type { ApiResponse } from '@/types'

const { t } = useI18n()
const authStore = useAuthStore() as ReturnType<typeof useAuthStore> & {
  fetchUserInfo: () => Promise<unknown>
}
const cleanup = useCleanup()

const price = ref(1)
const denomination = ref(100)
const denominationVip = ref(120)
const denominationOperator = ref(150)

let configAbortController: AbortController | null = null
let rechargeAbortController: AbortController | null = null
cleanup.add(() => configAbortController?.abort())
cleanup.add(() => rechargeAbortController?.abort())

const selectedAmountId = ref(1)
const selectedPaymentId = ref(1)
const loading = ref(false)

const amountList = ref([
  { id: 1, price: '10' },
  { id: 2, price: '50' },
  { id: 3, price: '100' },
  { id: 4, price: '200' },
  { id: 5, price: '500' },
  { id: 6, price: '1000' },
])

const paymentMethods = ref([
  {
    id: 1,
    name: t('recharge.wechatPay'),
    icon: '/images/wechat-pay.png',
  },
  {
    id: 2,
    name: t('recharge.alipay'),
    icon: '/images/alipay.png',
  },
])

onMounted(() => {
  fetchRechargeConfig()
})

const fetchRechargeConfig = async () => {
  try {
    configAbortController = new AbortController()
    const response = await fetch('/api/recharge/config', {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
      signal: configAbortController.signal,
    })
    const result = await response.json()
    if (result.code === 200) {
      denomination.value = result.data.denomination || 100
      denominationVip.value = result.data.denominationVip || 120
      denominationOperator.value = result.data.denominationOperator || 150
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    logger.error(t('recharge.fetchConfigFailed'), error)
  }
}

const formatTokenValue = (value: number) => {
  return value.toFixed(2)
}

const selectAmount = (item: { id: number; price: string }) => {
  selectedAmountId.value = item.id
}

const selectPayment = (item: { id: number; name: string; icon: string }) => {
  selectedPaymentId.value = item.id
}

const handleRecharge = async () => {
  const selectedAmount = amountList.value.find(item => item.id === selectedAmountId.value)
  const selectedPayment = paymentMethods.value.find(item => item.id === selectedPaymentId.value)

  if (!selectedAmount || !selectedPayment) {
    ElMessage.warning(t('recharge.selectAmountAndPayment'))
    return
  }

  loading.value = true
  try {
    rechargeAbortController = new AbortController()
    const response = await fetch('/api/recharge/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        amount: selectedAmount.price,
        paymentMethod: selectedPayment.name,
      }),
      signal: rechargeAbortController.signal,
    })
    const result = await response.json() as ApiResponse<unknown>
    if (result.code === 200) {
      ElMessage.success(t('recharge.rechargeSuccess'))
      await authStore.fetchUserInfo()
    } else {
      ElMessage.error(result.message || t('recharge.rechargeFailed'))
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    logger.error('Recharge failed:', error)
    ElMessage.error(t('recharge.rechargeFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
// ============================================
// 高科技工业风格 - 充值页面
// ============================================

// 设计令牌
$brand-primary: var(--el-bg-color-page);
$brand-accent: var(--el-text-color-primary);
$surface-glass: var(--color-white-3);
$surface-glass-hover: var(--color-white-6);
$border-subtle: var(--border-unified-color);
$border-active: var(--border-unified-color-hover);
$text-primary: var(--el-text-color-primary);
$text-secondary: var(--el-text-color-secondary);
$text-muted: var(--el-text-color-placeholder);
$glow-cyan: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
$glow-white: var(--color-white-15);

// ============================================
// 页面容器
// ============================================
.recharge-page {
  position: relative;
  min-height: 100vh;
  background: $brand-primary;
  overflow-x: hidden;
}

// ============================================
// 深度背景系统
// ============================================
.page-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
}

// 光晕效果
.bg-glow {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(120px);
  opacity: 0.5;
  animation: glowPulse 8s ease-in-out infinite;

  &--1 {
    top: -20%;
    left: -10%;
    width: 60%;
    height: 60%;
    background: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
  }

  &--2 {
    bottom: -30%;
    right: -20%;
    width: 70%;
    height: 70%;
    background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
    animation-delay: 4s;
  }
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}

// ============================================
// 页面内容
// ============================================
.page-content {
  position: relative;
  z-index: var(--z-base);
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 24px 60px;
}

// ============================================
// 页面头部
// ============================================
.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.header-decor {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;

  .decor-line {
    width: 60px;
    height: 1px;
    background: $border-active;
  }

  .decor-dot {
    width: 6px;
    height: 6px;
    background: $text-muted;
    border-radius: var(--global-border-radius);
    animation: dotPulse 2s ease-in-out infinite;
  }
}

@keyframes dotPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.page-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 32px;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}

.title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;

  svg {
    width: 28px;
    height: 28px;
    stroke: $text-secondary;
  }
}

.page-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin: 0;
}

// ============================================
// 用户信息区域
// ============================================
.user-section {
  margin-bottom: 24px;

  :deep(.user-info-card) {
    background: $surface-glass ;
    border: var(--unified-border);
    backdrop-filter: blur(20px);
  }
}

// ============================================
// 玻璃态卡片
// ============================================
.glass-card {
  position: relative;
  background: $surface-glass;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 28px;
  backdrop-filter: blur(20px);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: $surface-glass-hover;
    border-color: $border-active;
  }
}

// 卡片角落装饰
.card-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: $border-active;
  }

  &--tl {
    top: -1px;
    left: -1px;
    &::before { width: 12px; height: 1px; top: 0; left: 0; }
    &::after { width: 1px; height: 12px; top: 0; left: 0; }
  }

  &--tr {
    top: -1px;
    right: -1px;
    &::before { width: 12px; height: 1px; top: 0; right: 0; }
    &::after { width: 1px; height: 12px; top: 0; right: 0; }
  }

  &--bl {
    bottom: -1px;
    left: -1px;
    &::before { width: 12px; height: 1px; bottom: 0; left: 0; }
    &::after { width: 1px; height: 12px; bottom: 0; left: 0; }
  }

  &--br {
    bottom: -1px;
    right: -1px;
    &::before { width: 12px; height: 1px; bottom: 0; right: 0; }
    &::after { width: 1px; height: 12px; bottom: 0; right: 0; }
  }
}

// ============================================
// 卡片头部
// ============================================
.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: var(--unified-border-bottom);
}

.header-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--color-white-5);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.header-icon {
  width: 22px;
  height: 22px;
  stroke: $text-secondary;
}

.header-text {
  flex: 1;
}

.header-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 2px;
}

.header-tip {
  display: block;
  font-size: 12px;
  color: $text-muted;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-white-3);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.status-dot {
  width: 6px;
  height: 6px;
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  animation: statusPulse 2s ease-in-out infinite;

  &--secure {
    background: var(--el-color-success);
  }
}

@keyframes statusPulse {
  0%, 100% { opacity: 1; box-shadow: var(--global-box-shadow); }
  50% { opacity: 0.6; box-shadow: var(--global-box-shadow); }
}

.status-text {
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  letter-spacing: 0.1em;
}

// ============================================
// 汇率信息
// ============================================
.rate-info {
  margin-bottom: 24px;
}

.rate-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 12px;
}

.rate-icon {
  width: 16px;
  height: 16px;
  stroke: $text-muted;
}

.rate-details {
  background: var(--color-black-30);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
}

.rate-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: $text-secondary;
  padding: 8px 0;
  border-bottom: var(--unified-border-bottom);
  font-family: var(--font-family-mono);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }

  &--vip {
    color: var(--el-color-warning);
  }

  &--op {
    color: var(--el-color-primary);
  }
}

.rate-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: var(--color-white-8);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: $text-muted;

  &--vip {
    background: rgb(var(--el-color-warning-rgb, 230, 162, 60), 0.15);
    border-color: rgb(var(--el-color-warning-rgb, 230, 162, 60), 0.3);
    color: var(--el-color-warning);
  }

  &--op {
    background: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.15);
    border-color: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.3);
    color: var(--el-color-primary);
  }
}

// ============================================
// 金额选择列表
// ============================================
.amount-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.amount-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  outline: none;
  overflow: hidden;
  border-radius: var(--global-border-radius);

  &:focus-visible {
    .amount-border {
      border-color: $border-active;
    }
  }
}

.amount-glow {
  position: absolute;
  inset: 0;
  background: var(--color-white-5);
  opacity: 0;
  transition: opacity 0.4s ease;

  .amount-item:hover &,
  .amount-item.active & {
    opacity: 1;
  }
}

.amount-content {
  position: relative;
  z-index: var(--z-base);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 18px 12px;
}

.amount-border {
  position: absolute;
  inset: 0;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.3s ease;

  .amount-item:hover & {
    border-color: var(--border-unified-color-hover);
  }

  .amount-item.active & {
    border-color: var(--border-unified-color-hover);
    box-shadow: var(--global-box-shadow);
  }
}

.amount-icon {
  width: 24px;
  height: 24px;
  filter: grayscale(0.3);
  transition: filter 0.3s ease;

  .amount-item.active & {
    filter: grayscale(0) drop-shadow(0 0 8px var(--color-yellow-ffd700-50));
  }
}

.amount-text {
  font-size: 18px;
  font-weight: 700;
  color: $text-primary;
  font-family: var(--font-family-mono);
}

.amount-currency {
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
  margin-right: 2px;
}

// ============================================
// 区域间距
// ============================================
.recharge-section {
  margin-bottom: 20px;
}

.payment-section {
  margin-bottom: 32px;
}

// ============================================
// 支付方式列表
// ============================================
.pay-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 28px;
}

.pay-item {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  outline: none;
  overflow: hidden;
  border-radius: var(--global-border-radius);
  text-align: left;

  &:focus-visible {
    .pay-border {
      border-color: $border-active;
    }
  }
}

.pay-glow {
  position: absolute;
  inset: 0;
  background: var(--color-white-3);
  opacity: 0;
  transition: opacity 0.4s ease;

  .pay-item:hover &,
  .pay-item.active & {
    opacity: 1;
  }
}

.pay-content {
  position: relative;
  z-index: var(--z-base);
  display: flex;
  align-items: center;
  padding: 18px 20px;
}

.pay-border {
  position: absolute;
  inset: 0;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.3s ease;

  .pay-item:hover & {
    border-color: var(--border-unified-color-hover);
  }

  .pay-item.active & {
    border-color: var(--border-unified-color-hover);
    box-shadow: var(--global-box-shadow);
  }
}

.pay-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--global-border-radius);
  object-fit: contain;
  margin-right: 16px;
}

.pay-name {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: $text-primary;
}

.pay-radio {
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-outer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 2px solid $border-subtle;
  border-radius: var(--global-border-radius);
  transition: all 0.3s ease;

  .pay-item.active & {
    border-color: var(--border-unified-color-hover);
  }
}

.radio-inner {
  width: 10px;
  height: 10px;
  background: $brand-accent;
  border-radius: var(--global-border-radius);
  transform: scale(0);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &.checked {
    transform: scale(1);
  }
}

// ============================================
// 充值按钮
// ============================================
.action-section {
  display: flex;
  justify-content: center;
}

.recharge-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 220px;
  height: 56px;
  padding: 0 36px;
  background: transparent;
  border: none;
  cursor: pointer;
  outline: none;
  overflow: hidden;
  border-radius: var(--global-border-radius);

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    .btn-border {
      border-color: var(--border-unified-color-hover);
    }
  }
}

// 扫光效果已移至全局样式 (styles/index.scss)

.btn-content {
  position: relative;
  z-index: var(--z-base);
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-icon {
  width: 20px;
  height: 20px;
  stroke: $text-primary;
  transition: transform 0.3s ease;

  .recharge-btn:hover:not(:disabled) & {
    transform: translateY(2px);
  }
}

.btn-loader {
  width: 20px;
  height: 20px;
  border: 2px solid $border-subtle;
  border-top-color: $text-primary;
  border-radius: var(--global-border-radius);
  animation: btnSpin 0.8s linear infinite;
}

@keyframes btnSpin {
  to { transform: rotate(360deg); }
}

.btn-text {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
  letter-spacing: 0.02em;
}

.btn-border {
  position: absolute;
  inset: 0;
  border: 2px solid $brand-accent;
  border-radius: var(--global-border-radius);
  transition: all 0.3s ease;

  .recharge-btn:hover:not(:disabled) & {
    box-shadow: var(--global-box-shadow);
  }

  .recharge-btn:active:not(:disabled) & {
    transform: scale(0.98);
  }
}

// ============================================
// 涟漪效果
// ============================================
.ripple-btn {
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: var(--color-white-15);
    border-radius: var(--global-border-radius);
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: width 0.6s ease, height 0.6s ease, opacity 0.6s ease;
    pointer-events: none;
    z-index: calc(var(--z-base) + 1);
  }

  &:active::before {
    width: 300px;
    height: 300px;
    opacity: 1;
    transition: 0s;
  }
}

// ============================================
// 页面底部
// ============================================
.page-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding-top: 32px;
}

.footer-line {
  width: 60px;
  height: 1px;
  background: $border-subtle;
}

.footer-text {
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

// ============================================
// 滚动动画
// ============================================
[data-animate] {
  opacity: 0;
  transform: translateY(30px);
  animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

[data-animate="fade-down"] {
  transform: translateY(-30px);
  animation-name: fadeInDown;
}

[data-delay="100"] { animation-delay: 0.1s; }
[data-delay="200"] { animation-delay: 0.2s; }
[data-delay="300"] { animation-delay: 0.3s; }
[data-delay="400"] { animation-delay: 0.4s; }

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 响应式设计
// ============================================
@media (width <= 768px) {
  .page-content {
    padding: 32px 16px 48px;
  }

  .page-title {
    font-size: 26px;
  }

  .glass-card {
    padding: 20px;
    border-radius: var(--global-border-radius);
  }

  .amount-list {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .amount-content {
    padding: 14px 10px;
  }

  .amount-text {
    font-size: 16px;
  }

  .recharge-btn {
    min-width: 180px;
    height: 50px;
  }

  .btn-text {
    font-size: 15px;
  }
}

@media (width <= 480px) {
  .page-content {
    padding: 24px 12px 40px;
  }

  .page-title {
    font-size: 22px;
  }

  .title-icon {
    width: 32px;
    height: 32px;

    svg {
      width: 22px;
      height: 22px;
    }
  }

  .glass-card {
    padding: 16px;
    border-radius: var(--global-border-radius);
  }

  .card-header {
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
  }

  .header-icon-wrap {
    width: 38px;
    height: 38px;
  }

  .header-icon {
    width: 18px;
    height: 18px;
  }

  .header-title {
    font-size: 14px;
  }

  .header-status {
    padding: 4px 8px;
  }

  .status-text {
    font-size: 12px;
  }

  .amount-list {
    gap: 8px;
  }

  .amount-content {
    padding: 12px 8px;
  }

  .amount-icon {
    width: 20px;
    height: 20px;
  }

  .amount-text {
    font-size: 14px;
  }

  .pay-content {
    padding: 14px 16px;
  }

  .pay-icon {
    width: 32px;
    height: 32px;
    margin-right: 12px;
  }

  .pay-name {
    font-size: 14px;
  }

  .recharge-btn {
    min-width: 160px;
    height: 46px;
    padding: 0 28px;
  }

  .btn-text {
    font-size: 14px;
  }
}

// ============================================
// 减少动效模式
// ============================================
@media (prefers-reduced-motion: reduce) {
  [data-animate] {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .bg-glow {
    animation: none;
  }

  .status-dot,
  .decor-dot {
    animation: none;
  }

  .ripple-btn::before {
    display: none;
  }
}
</style>
