<template>
  <div class="withdrawal-page">
    <!-- 深度背景系统 -->
    <div class="wd-bg-system">
      <div class="wd-glow-orb wd-glow-1"></div>
      <div class="wd-glow-orb wd-glow-2"></div>
      <div class="wd-noise-layer"></div>
    </div>

    <div class="wd-content-wrapper">
      <!-- 页面标题 -->
      <header class="wd-header wd-scroll-reveal">
        <div class="wd-header-line"></div>
        <h1 class="wd-title">
          <span class="wd-title-icon">◈</span>
          {{ t('withdrawal.title') }}
        </h1>
        <p class="wd-subtitle">Secure Fund Withdrawal System</p>
      </header>

      <!-- 余额卡片 -->
      <section class="wd-balance-card wd-glass-card wd-scroll-reveal" style="

--delay: 0.1s">
        <div class="wd-balance-glow"></div>
        <div class="wd-balance-header">
          <span class="wd-balance-icon">◇</span>
          <span class="wd-balance-label">{{ t('withdrawal.availableAmount') }}</span>
        </div>
        <div class="wd-balance-amount">
          <span class="wd-currency">¥</span>
          <span class="wd-amount-value">{{ formatPrice(availableAmount) }}</span>
        </div>
        <div class="wd-balance-decoration">
          <div class="wd-deco-line"></div>
          <div class="wd-deco-dot"></div>
        </div>
      </section>

      <!-- 规则面板 -->
      <section class="wd-rules-panel wd-glass-card wd-scroll-reveal" v-if="withdrawConfig" style="

--delay: 0.2s">
        <div class="wd-rules-grid">
          <div class="wd-rule-item">
            <div class="wd-rule-icon">▣</div>
            <div class="wd-rule-content">
              <span class="wd-rule-label">{{ t('withdrawal.rules.minAmount') }}</span>
              <span class="wd-rule-value">¥{{ withdrawConfig.minAmount }}</span>
            </div>
          </div>
          <div class="wd-rule-divider"></div>
          <div class="wd-rule-item">
            <div class="wd-rule-icon">◐</div>
            <div class="wd-rule-content">
              <span class="wd-rule-label">{{ t('withdrawal.rules.processingTime') }}</span>
              <span class="wd-rule-value">{{ withdrawConfig.processingTime }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 表单卡片 -->
      <section class="wd-form-card wd-glass-card wd-scroll-reveal" style="

--delay: 0.3s">
        <el-form ref="withdrawFormRef" :model="withdrawForm" :rules="formRules" class="wd-form">
          
          <!-- 金额输入 -->
          <div class="wd-form-group">
            <label class="wd-form-label">
              <span class="wd-label-icon">◆</span>
              {{ t('withdrawal.form.amount') }}
            </label>
            <div class="wd-amount-wrapper">
              <el-form-item prop="amount">
                <el-input
                  v-model="withdrawForm.amount"
                  type="number"
                  :placeholder="t('withdrawal.form.amountPlaceholder')"
                  class="wd-amount-input"
                  @input="handleAmountInput"
                />
              </el-form-item>
              <button 
                type="button" 
                class="wd-btn-all wd-ripple"
                @click="withdrawAll"
              >
                {{ t('withdrawal.form.withdrawAll') }}
              </button>
            </div>
            <p class="wd-form-hint">{{ t('withdrawal.form.amountTip', { available: formatPrice(availableAmount), minAmount: withdrawConfig?.minAmount || 100 }) }}</p>
          </div>

          <!-- 提现方式 -->
          <div class="wd-form-group">
            <label class="wd-form-label">
              <span class="wd-label-icon">◆</span>
              {{ t('withdrawal.form.method') }}
            </label>
            <div class="wd-method-grid">
              <div
                v-for="item in withdrawalMethods"
                :key="item.id"
                class="wd-method-card wd-ripple"
                :class="{ 'wd-method-active': item.id === selectedMethodId }"
                @click="selectMethod(item)"
              >
                <div class="wd-method-indicator"></div>
                <img :src="item.icon" :alt="item.name" class="wd-method-icon" loading="lazy" />
                <span class="wd-method-name">{{ item.name }}</span>
                <div class="wd-method-check" v-if="item.id === selectedMethodId">
                  <span>✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 微信账号 -->
          <div class="wd-form-group wd-form-animate" v-if="selectedMethodId === 1">
            <label class="wd-form-label">
              <span class="wd-label-icon">◆</span>
              {{ t('withdrawal.form.wechatAccount') }}
            </label>
            <el-form-item prop="wechatAccount">
              <el-input
                v-model="withdrawForm.wechatAccount"
                :placeholder="t('withdrawal.form.wechatPlaceholder')"
                class="wd-text-input"
              />
            </el-form-item>
          </div>

          <!-- 支付宝账号 -->
          <div class="wd-form-group wd-form-animate" v-if="selectedMethodId === 2">
            <label class="wd-form-label">
              <span class="wd-label-icon">◆</span>
              {{ t('withdrawal.form.alipayAccount') }}
            </label>
            <el-form-item prop="alipayAccount">
              <el-input
                v-model="withdrawForm.alipayAccount"
                :placeholder="t('withdrawal.form.alipayPlaceholder')"
                class="wd-text-input"
              />
            </el-form-item>
          </div>

          <!-- 银行卡信息 -->
          <template v-if="selectedMethodId === 3">
            <div class="wd-form-group wd-form-animate">
              <label class="wd-form-label">
                <span class="wd-label-icon">◆</span>
                {{ t('withdrawal.form.realName') }}
              </label>
              <el-form-item prop="realName">
                <el-input
                  v-model="withdrawForm.realName"
                  :placeholder="t('withdrawal.form.realNamePlaceholder')"
                  class="wd-text-input"
                />
              </el-form-item>
            </div>

            <div class="wd-form-group wd-form-animate">
              <label class="wd-form-label">
                <span class="wd-label-icon">◆</span>
                {{ t('withdrawal.form.bankName') }}
              </label>
              <el-form-item prop="bankName">
                <el-input
                  v-model="withdrawForm.bankName"
                  :placeholder="t('withdrawal.form.bankNamePlaceholder')"
                  class="wd-text-input"
                />
              </el-form-item>
            </div>

            <div class="wd-form-group wd-form-animate">
              <label class="wd-form-label">
                <span class="wd-label-icon">◆</span>
                {{ t('withdrawal.form.bankAccount') }}
              </label>
              <el-form-item prop="bankAccount">
                <el-input
                  v-model="withdrawForm.bankAccount"
                  :placeholder="t('withdrawal.form.bankPlaceholder')"
                  class="wd-text-input"
                />
              </el-form-item>
            </div>
          </template>

          <!-- 备注 -->
          <div class="wd-form-group">
            <label class="wd-form-label">
              <span class="wd-label-icon">◆</span>
              {{ t('withdrawal.form.remark') }}
            </label>
            <el-form-item prop="remark">
              <el-input
                v-model="withdrawForm.remark"
                type="textarea"
                :placeholder="t('withdrawal.form.remarkPlaceholder')"
                class="wd-textarea"
                :rows="3"
              />
            </el-form-item>
          </div>

          <!-- 提交按钮 -->
          <div class="wd-action-section">
            <button
              type="button"
              class="wd-submit-btn wd-ripple"
              :class="{ 'wd-btn-loading': loading }"
              :disabled="loading"
              @click="handleSubmit"
            >
              <span class="wd-btn-bg"></span>
              <span class="wd-btn-content">
                <span v-if="loading" class="wd-btn-spinner"></span>
                <span class="wd-btn-text">
                  {{ loading ? t('withdrawal.submit.submitting') : t('withdrawal.submit.button') }}
                </span>
                <span class="wd-btn-arrow">→</span>
              </span>
            </button>
          </div>
        </el-form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { zhsWithdrawal, getWithdrawalRecords } from '@/api/withdrawal'
import { getWithdrawConfig } from '@/api/commission'
import type { WithdrawalRecord } from '@/api/withdrawal'
import type { FormInstance, FormRules } from 'element-plus'
import { useApiError } from '@/composables/useApiError'
import type { ApiResponse } from '@/types'
import { formatMoney } from '@/utils/format'

const { t } = useI18n()
const authStore = useAuthStore() as ReturnType<typeof useAuthStore> & {
  fetchUserInfo: () => Promise<unknown>
}
const availableAmount = computed(() => authStore.balance || 0)
const withdrawFormRef = ref<FormInstance>()
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const withdrawalRecords = ref<WithdrawalRecord[]>([])
const { loading: _recordsLoading, execute: executeRecordsApi } = useApiError({ showMessage: false })

interface WithdrawConfig {
  minAmount: number
  processingTime: string
}
const withdrawConfig = ref<WithdrawConfig | null>(null)

const withdrawForm = reactive({
  amount: '',
  wechatAccount: '',
  alipayAccount: '',
  realName: '',
  bankName: '',
  bankAccount: '',
  remark: ''
})

const selectedMethodId = ref(1)

const withdrawalMethods = ref([
  {
    id: 1,
    name: t('withdrawal.methods.wechat'),
    icon: '/images/wechat-pay.png',
  },
  {
    id: 2,
    name: t('withdrawal.methods.alipay'),
    icon: '/images/alipay.png',
  },
  {
    id: 3,
    name: t('withdrawal.methods.bank'),
    icon: '/images/bank-card.png',
  },
])

const formRules = computed<FormRules>(() => {
  const rules: FormRules = {
    amount: [
      { required: true, message: t('withdrawal.validation.amountRequired'), trigger: 'blur' },
      { 
        validator: (rule: any, value: string, callback: (err?: Error) => void) => {
          const amount = Number(value)
          const minAmount = withdrawConfig.value?.minAmount || 100
          if (amount < minAmount) {
            callback(new Error(t('withdrawal.validation.amountMin')))
          } else if (amount > availableAmount.value) {
            callback(new Error(t('withdrawal.validation.amountExceed')))
          } else {
            callback()
          }
        },
        trigger: 'blur'
      }
    ]
  }

  if (selectedMethodId.value === 1) {
    rules.wechatAccount = [
      { required: true, message: t('withdrawal.validation.accountRequired'), trigger: 'blur' }
    ]
  } else if (selectedMethodId.value === 2) {
    rules.alipayAccount = [
      { required: true, message: t('withdrawal.validation.accountRequired'), trigger: 'blur' }
    ]
  } else if (selectedMethodId.value === 3) {
    rules.realName = [
      { required: true, message: t('withdrawal.validation.realNameRequired'), trigger: 'blur' }
    ]
    rules.bankName = [
      { required: true, message: t('withdrawal.validation.bankNameRequired'), trigger: 'blur' }
    ]
    rules.bankAccount = [
      { required: true, message: t('withdrawal.validation.accountRequired'), trigger: 'blur' },
      { 
        validator: (rule: any, value: string, callback: (err?: Error) => void) => {
          if (!/^\d{16,19}$/.test(value)) {
            callback(new Error(t('withdrawal.validation.bankAccountInvalid')))
          } else {
            callback()
          }
        },
        trigger: 'blur'
      }
    ]
  }

  return rules
})

onMounted(async () => {
  // 余额必须从后端实时拉取，禁止从 URL 参数读取
  try {
    await authStore.fetchUserInfo()
  } catch (e) {
    logger.error('获取用户信息失败:', e)
  }
  try { await fetchWithdrawConfig(); await fetchWithdrawalRecords() } catch (e) { console.error(e) }
})

const fetchWithdrawConfig = async () => {
  try {
    const response = await getWithdrawConfig() as { code?: number; data?: any }
    if (response.code === 200 && response.data) {
      withdrawConfig.value = response.data as typeof withdrawConfig.value
    }
  } catch (error) {
    logger.error(t('withdrawal.messages.fetchInfoFailed'), error)
  }
}

const fetchWithdrawalRecords = async () => {
  const data = await executeRecordsApi(() => getWithdrawalRecords({
    page: 1,
    pageSize: 10,
  }) as Promise<ApiResponse<unknown>>)
  if (data !== null) {
    const recordsData = data as { list?: WithdrawalRecord[] }
    withdrawalRecords.value = recordsData.list || []
  }
}

const formatPrice = (price: number) => formatMoney(price)

const handleAmountInput = () => {
  const amount = Number(withdrawForm.amount)
  const maxAmount = availableAmount.value
  if (amount > maxAmount) {
    withdrawForm.amount = formatPrice(maxAmount)
  }
}

const withdrawAll = () => {
  withdrawForm.amount = formatPrice(availableAmount.value)
}

interface WithdrawalMethod {
  id: number
  name: string
  icon: string
}

const selectMethod = (item: WithdrawalMethod) => {
  selectedMethodId.value = item.id
}

const handleSubmit = async () => {
  if (!withdrawFormRef.value) return

  try {
    await withdrawFormRef.value.validate()
  } catch (error) {
    // 表单验证失败，静默返回
    if (import.meta.env.DEV) {
      logger.debug('Withdrawal form validation failed:', error)
    }
    return
  }

  const amount = Number(withdrawForm.amount)
  if (amount <= 0) {
    ElMessage.warning(t('withdrawal.inputValidAmount'))
    return
  }

  if (amount > availableAmount.value) {
    ElMessage.warning(t('withdrawal.insufficientBalance'))
    return
  }

  const selectedMethod = withdrawalMethods.value.find(item => item.id === selectedMethodId.value)
  if (!selectedMethod) {
    ElMessage.warning(t('withdrawal.selectMethod'))
    return
  }

  const user = authStore.user as { nickname?: string; openId?: string } | null
  if (!authStore.token) {
    ElMessage.error(t('withdrawal.messages.pleaseLogin'))
    return
  }

  // 构造提现方式信息（必须传给后端，不能丢失）
  const methodInfo: Record<string, string> = { method: selectedMethod.name }
  if (selectedMethodId.value === 1) {
    methodInfo.wechatAccount = withdrawForm.wechatAccount
  } else if (selectedMethodId.value === 2) {
    methodInfo.alipayAccount = withdrawForm.alipayAccount
  } else if (selectedMethodId.value === 3) {
    methodInfo.realName = withdrawForm.realName
    methodInfo.bankName = withdrawForm.bankName
    methodInfo.bankAccount = withdrawForm.bankAccount
  }
  if (withdrawForm.remark) methodInfo.remark = withdrawForm.remark

  const response = await executeApi(() => zhsWithdrawal({
    token: authStore.token || '',
    amount: amount,
    nickname: user?.nickname || '',
    openId: user?.openId || '',
    ...methodInfo,
  }) as Promise<ApiResponse<unknown>>)

  if (response !== null) {
    const responseData = response as { code?: string; message?: string }
    const { code, message } = responseData

    if (code === '200') {
      ElMessage.success(message || t('withdrawal.submitSuccess'))

      // 禁止前端直接改余额，必须从后端重新拉取
      try {
        await authStore.fetchUserInfo()
      } catch (e) {
        logger.error('刷新用户信息失败:', e)
      }

      withdrawForm.amount = ''
      withdrawForm.wechatAccount = ''
      withdrawForm.alipayAccount = ''
      withdrawForm.realName = ''
      withdrawForm.bankName = ''
      withdrawForm.bankAccount = ''
      withdrawForm.remark = ''

      await fetchWithdrawalRecords()
    } else {
      ElMessage.warning(message || t('withdrawal.submitPending'))
    }
  }
}
</script>

<style scoped lang="scss">
// ============================================
// 高科技工业风格 - 提现页面
// ============================================

// 设计令牌
$brand-primary: var(--el-text-color-primary);
$brand-accent: var(--el-bg-color);
$surface-dark: var(--color-dark-bg-1);
$surface-mid: var(--color-dark-bg-2);
$surface-light: var(--color-gray-1f1f1f);
$border-subtle: var(--border-unified-color);
$border-active: var(--border-unified-color-hover);
$text-primary: var(--color-gray-ededed);
$text-secondary: var(--color-gray-a1a1a1);
$text-muted: var(--color-gray-666);
$glow-color: var(--color-white-15);
$accent-green: var(--el-text-color-primary);

// 动画缓动
$ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
$ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);

// ============================================
// 主容器
// ============================================
.withdrawal-page {
  position: relative;
  min-height: 100vh;
  background: $surface-dark;
  overflow-x: hidden;
}

// ============================================
// 深度背景系统
// ============================================
.wd-bg-system {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
}

// 光晕球体
.wd-glow-orb {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(100px);
  opacity: 0.4;
  animation: wd-float 20s ease-in-out infinite;
}

.wd-glow-1 {
  width: 500px;
  height: 500px;
  background: var(--color-white-4);
  top: -200px;
  right: -100px;
  animation-delay: 0s;
}

.wd-glow-2 {
  width: 400px;
  height: 400px;
  background: color-mix(in srgb, var(--el-color-primary) 3%, transparent);
  bottom: 100px;
  left: -150px;
  animation-delay: -10s;
}

// 噪点层
.wd-noise-layer {
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  opacity: 0.5;
}

@keyframes wd-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.05); }
  50% { transform: translate(-10px, 20px) scale(0.95); }
  75% { transform: translate(30px, 10px) scale(1.02); }
}

// ============================================
// 内容包装器
// ============================================
.wd-content-wrapper {
  position: relative;
  z-index: var(--z-base);
  max-width: 640px;
  margin: 0 auto;
  padding: 40px 20px 60px;
}

// ============================================
// 滚动动画
// ============================================
.wd-scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  animation: wd-reveal 0.8s $ease-out-expo forwards;
  animation-delay: var(--delay);
}

@keyframes wd-reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 页面标题
// ============================================
.wd-header {
  margin-bottom: 32px;
  text-align: center;
}

.wd-header-line {
  width: 60px;
  height: 2px;
  background: $text-secondary;
  margin: 0 auto 20px;
}

.wd-title {
  font-size: 32px;
  font-weight: 700;
  color: $text-primary;
  margin: 0 0 8px;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.wd-title-icon {
  font-size: 24px;
  color: $accent-green;
  animation: wd-pulse 2s ease-in-out infinite;
}

@keyframes wd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.wd-subtitle {
  font-size: 13px;
  color: $text-muted;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin: 0;
}

// ============================================
// 玻璃态卡片基础
// ============================================
.wd-glass-card {
  background: var(--color-white-2);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  backdrop-filter: blur(20px);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-white-2);
    pointer-events: none;
  }
}

// ============================================
// 余额卡片
// ============================================
.wd-balance-card {
  padding: 32px;
  margin-bottom: 20px;
  text-align: center;
}

.wd-balance-glow {
  position: absolute;
  top: -50%;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 200px;
  background: var(--color-green-00ff88-05);
  filter: blur(40px);
  pointer-events: none;
}

.wd-balance-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.wd-balance-icon {
  font-size: 16px;
  color: $accent-green;
}

.wd-balance-label {
  font-size: 14px;
  color: $text-secondary;
  letter-spacing: 0.05em;
}

.wd-balance-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.wd-currency {
  font-size: 24px;
  font-weight: 600;
  color: $text-secondary;
}

.wd-amount-value {
  font-size: 48px;
  font-weight: 700;
  color: $text-primary;
  font-family: var(--font-family-mono);
  letter-spacing: -0.02em;
}

.wd-balance-decoration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

.wd-deco-line {
  width: 40px;
  height: 1px;
  background: $border-active;
}

.wd-deco-dot {
  width: 4px;
  height: 4px;
  background: $accent-green;
  border-radius: var(--global-border-radius);
}

// ============================================
// 规则面板
// ============================================
.wd-rules-panel {
  padding: 20px 24px;
  margin-bottom: 20px;
}

.wd-rules-grid {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.wd-rule-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wd-rule-icon {
  font-size: 14px;
  color: $text-muted;
}

.wd-rule-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wd-rule-label {
  font-size: 12px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wd-rule-value {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
  font-family: var(--font-family-mono);
}

.wd-rule-divider {
  width: 1px;
  height: 32px;
  background: $border-subtle;
}

// ============================================
// 表单卡片
// ============================================
.wd-form-card {
  padding: 32px 28px;
}

.wd-form {
  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  :deep(.el-form-item__error) {
    color: var(--color-red-ff6b6b);
    font-size: 12px;
    padding-top: 6px;
  }
}

.wd-form-group {
  margin-bottom: 28px;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.wd-form-animate {
  animation: wd-slide-in 0.4s $ease-out-expo;
}

@keyframes wd-slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.wd-form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: $text-secondary;
  margin-bottom: 12px;
}

.wd-label-icon {
  font-size: 10px;
  color: $text-muted;
}

.wd-form-hint {
  font-size: 12px;
  color: $text-muted;
  margin-top: 8px;
  line-height: 1.6;
}

// ============================================
// 输入框样式
// ============================================
.wd-amount-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.wd-amount-input,
.wd-text-input {
  flex: 1;

  :deep(.el-input__wrapper) {
    background: $surface-mid;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: none;
    padding: 12px 16px;
    transition: all 0.3s $ease-out-expo;

    &:hover {
      border-color: $border-active;
    }

    &.is-focus {
      border-color: $text-secondary;
      box-shadow: var(--global-box-shadow);
    }
  }

  :deep(.el-input__inner) {
    color: $text-primary;
    font-size: 15px;

    &::placeholder {
      color: $text-muted;
    }
  }
}

.wd-amount-input {
  :deep(.el-input__inner) {
    font-size: 20px;
    font-weight: 600;
    font-family: var(--font-family-mono);
  }
}

.wd-textarea {
  :deep(.el-textarea__inner) {
    background: $surface-mid;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 14px 16px;
    color: $text-primary;
    font-size: 14px;
    resize: none;
    transition: all 0.3s $ease-out-expo;

    &::placeholder {
      color: $text-muted;
    }

    &:hover {
      border-color: $border-active;
    }

    &:focus {
      border-color: $text-secondary;
      box-shadow: var(--global-box-shadow);
    }
  }
}

// ============================================
// 全部提现按钮
// ============================================
.wd-btn-all {
  flex-shrink: 0;
  padding: 12px 20px;
  background: transparent;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: $text-secondary;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s $ease-out-expo;

  &:hover {
    background: var(--color-white-5);
    color: $text-primary;
    border-color: $text-secondary;
  }
}

// ============================================
// 支付方式卡片
// ============================================
.wd-method-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.wd-method-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px;
  background: $surface-mid;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.3s $ease-out-expo;

  &:hover {
    border-color: $border-active;
    transform: translateY(-2px);
  }

  &.wd-method-active {
    border-color: $text-secondary;
    background: var(--color-white-4);

    .wd-method-indicator {
      opacity: 1;
    }
  }
}

.wd-method-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 2px;
  background: $accent-green;
  border-radius: var(--global-border-radius);
  opacity: 0;
  transition: opacity 0.3s;
}

.wd-method-icon {
  width: 36px;
  height: 36px;
  object-fit: contain;
  margin-bottom: 10px;
  filter: grayscale(0.3);
  transition: filter 0.3s;

  .wd-method-active & {
    filter: grayscale(0);
  }
}

.wd-method-name {
  font-size: 13px;
  color: $text-secondary;
  text-align: center;
  transition: color 0.3s;

  .wd-method-active & {
    color: $text-primary;
  }
}

.wd-method-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  background: $accent-green;
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: $brand-primary;
  font-weight: 700;
  animation: wd-pop 0.3s $ease-out-back;
}

@keyframes wd-pop {
  from {
    transform: scale(0);
  }

  to {
    transform: scale(1);
  }
}

// ============================================
// 提交按钮
// ============================================
.wd-action-section {
  display: flex;
  justify-content: center;
  margin-top: 36px;
}

.wd-submit-btn {
  position: relative;
  min-width: 220px;
  height: 52px;
  background: $brand-primary;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s $ease-out-expo;

  &:hover:not(:disabled) {
    border-color: $text-secondary;
    transform: translateY(-2px);

    .wd-btn-bg {
      opacity: 1;
    }

    .wd-btn-arrow {
      transform: translateX(4px);
    }
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.wd-btn-bg {
  position: absolute;
  inset: 0;
  background: var(--color-white-5);
  opacity: 0;
  transition: opacity 0.3s;
}

.wd-btn-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  padding: 0 24px;
}

.wd-btn-text {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
  letter-spacing: 0.02em;
}

.wd-btn-arrow {
  font-size: 16px;
  color: $text-secondary;
  transition: transform 0.3s $ease-out-expo;
}

.wd-btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-unified-color);
  border-top-color: $text-primary;
  border-radius: var(--global-border-radius);
  animation: wd-spin 0.8s linear infinite;
}

@keyframes wd-spin {
  to { transform: rotate(360deg); }
}

// ============================================
// 涟漪效果
// ============================================
.wd-ripple {
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: var(--color-white-10);
    border-radius: var(--global-border-radius);
    transform: translate(-50%, -50%);
    opacity: 0;
    pointer-events: none;
  }

  &:active::after {
    width: 200%;
    height: 200%;
    opacity: 1;
    transition: width 0.4s, height 0.4s, opacity 0.4s;
  }
}

// ============================================
// 响应式
// ============================================
@media (width <= 768px) {
  .wd-content-wrapper {
    padding: 30px 16px 50px;
  }

  .wd-title {
    font-size: 26px;
  }

  .wd-amount-value {
    font-size: 40px;
  }

  .wd-balance-card,
  .wd-form-card {
    padding: 24px 20px;
  }

  .wd-method-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .wd-method-card {
    padding: 16px 8px;
  }

  .wd-method-icon {
    width: 30px;
    height: 30px;
  }

  .wd-method-name {
    font-size: 12px;
  }

  .wd-rules-grid {
    flex-direction: column;
    gap: 16px;
  }

  .wd-rule-divider {
    width: 60px;
    height: 1px;
  }

  .wd-submit-btn {
    min-width: 180px;
    height: 48px;
  }
}

@media (width <= 480px) {
  .wd-content-wrapper {
    padding: 24px 12px 40px;
  }

  .wd-title {
    font-size: 22px;
  }

  .wd-amount-value {
    font-size: 34px;
  }

  .wd-currency {
    font-size: 20px;
  }

  .wd-balance-card,
  .wd-form-card {
    padding: 20px 16px;
    border-radius: var(--global-border-radius);
  }

  .wd-amount-wrapper {
    flex-direction: column;
    gap: 10px;
  }

  .wd-btn-all {
    width: 100%;
  }

  .wd-method-grid {
    grid-template-columns: 1fr;
  }

  .wd-method-card {
    flex-direction: row;
    justify-content: flex-start;
    gap: 12px;
    padding: 14px 16px;
  }

  .wd-method-icon {
    margin-bottom: 0;
  }

  .wd-method-indicator {
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: 2px;
    height: 24px;
    border-radius: var(--global-border-radius);
  }

  .wd-method-check {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }

  .wd-submit-btn {
    width: 100%;
    min-width: auto;
  }
}
</style>
