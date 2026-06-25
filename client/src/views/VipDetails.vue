<template>
  <div class="vip-details-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Crown /></el-icon>
        {{ t('vipDetails.title') }}
      </h1>
      <p class="page-subtitle">{{ t('vipDetails.subtitle') }}</p>
    </div>

    <GlobalLoading v-if="loading" />

    <!-- 月度会员卡片 -->
    <div v-if="!loading" class="vip-card monthly radius-auto">
      <div class="card-header">
        <div class="vip-type">
          <div class="title">{{ t('vipDetails.monthly.title') }}</div>
          <div class="days">{{ t('vipDetails.monthly.days') }}</div>
        </div>
        <div class="vip-price">
          <span class="price-symbol">¥</span>
          <span class="price-value">{{ monthlyPrice }}</span>
        </div>
      </div>

      <div class="benefits-list">
        <div v-for="benefit in monthlyBenefits" :key="benefit" class="benefit-item">
          <el-icon class="benefit-icon"><Check /></el-icon>
          <span class="benefit-text">{{ benefit }}</span>
        </div>
      </div>

      <el-button type="primary" class="vip-button" @click="choosePlan('monthly')">
        {{ t('vipDetails.monthly.select') }}
      </el-button>
    </div>

    <!-- 年度会员卡片 -->
    <div v-if="!loading" class="vip-card yearly radius-auto">
      <div class="card-header">
        <div class="vip-type">
          <div class="title">{{ t('vipDetails.yearly.title') }}</div>
          <div class="days">{{ t('vipDetails.yearly.days') }}</div>
        </div>
        <div class="vip-price">
          <span class="price-symbol">¥</span>
          <span class="price-value">{{ yearlyPrice }}</span>
        </div>
      </div>

      <div class="benefits-list">
        <div v-for="benefit in yearlyBenefits" :key="benefit" class="benefit-item">
          <el-icon class="benefit-icon"><Check /></el-icon>
          <span class="benefit-text">{{ benefit }}</span>
        </div>
      </div>

      <el-button type="primary" class="vip-button yearly-button" @click="choosePlan('yearly')">
        {{ t('vipDetails.yearly.select') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Crown, Check } from '@/lib/lucide-fallback'
import GlobalLoading from '@/components/common/GlobalLoading.vue'
import { getVipPrice } from '@/api/vip'
import { normalizeApiResponse } from '@/utils/api-response'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import { useVipAnalytics } from '@/composables/useAnalytics'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { trackVipPageView, trackVipPlanClick } = useVipAnalytics()

const { loading, execute: executeApi } = useApiError({ showMessage: false })
const monthlyPrice = ref(39.9)
const yearlyPrice = ref(299)
// 价格是否加载成功：失败时禁止下单，避免用默认价格误扣费
const priceLoaded = ref(false)
// 价格加载中：加载完成前禁止下单
const priceLoading = ref(true)

const monthlyBenefits = [
  t('vipDetails.monthly.benefits.0'),
  t('vipDetails.monthly.benefits.1'),
  t('vipDetails.monthly.benefits.2'),
  t('vipDetails.monthly.benefits.3'),
]

const yearlyBenefits = [
  t('vipDetails.yearly.benefits.0'),
  t('vipDetails.yearly.benefits.1'),
  t('vipDetails.yearly.benefits.2'),
  t('vipDetails.yearly.benefits.3'),
]

// 加载VIP价格
const loadVipPrice = async () => {
  const token = authStore.token
  if (!token) {
    logger.error('[VipDetails] Token does not exist')
    priceLoading.value = false
    return
  }
  try {
    const data = await executeApi(async () => {
      const response = await getVipPrice(token)
      return normalizeApiResponse<{ list?: Array<{ price?: number; duration?: number; amount?: number }> } | { amount?: number }>(response)
    })
    if (data !== null && typeof data === 'object') {
      const priceData = data as { list?: Array<{ price?: number; duration?: number; amount?: number }> | { price?: number; duration?: number; amount?: number } }
      // 如果返回的是数组，按duration区分月度/年度
      if (Array.isArray(priceData.list)) {
        let gotMonthly = false
        let gotYearly = false
        for (const pkg of priceData.list) {
          if (pkg.duration && pkg.duration >= 360) {
            const price = pkg.price || pkg.amount
            if (typeof price === 'number') {
              yearlyPrice.value = price
              gotYearly = true
            }
          } else if (pkg.duration && pkg.duration <= 35) {
            const price = pkg.price || pkg.amount
            if (typeof price === 'number') {
              monthlyPrice.value = price
              gotMonthly = true
            }
          }
        }
        // 两个价格都成功获取才算加载成功
        priceLoaded.value = gotMonthly && gotYearly
      } else {
        // 兼容单个amount字段的响应
        const pkg = priceData.list as { price?: number; duration?: number; amount?: number } | undefined
        const amount = pkg?.amount || pkg?.price
        if (typeof amount === 'number') {
          monthlyPrice.value = amount
          priceLoaded.value = true
        }
      }
    }
  } catch (err) {
    logger.error('[VipDetails] 加载VIP价格失败:', err)
  } finally {
    priceLoading.value = false
  }
}

// 选择会员方案
const choosePlan = (plan: 'monthly' | 'yearly') => {
  trackVipPlanClick(plan)
  if (!authStore.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: '/vip/details' } })
    return
  }

  // 价格加载中或加载失败：禁止下单，避免用默认价格误扣费
  if (priceLoading.value) {
    ElMessage.warning(t('common.errors.priceLoading'))
    return
  }
  if (!priceLoaded.value) {
    ElMessage.error(t('common.errors.priceLoadFailed'))
    return
  }

  const planData = {
    type: plan,
    name: plan === 'yearly' ? t('vipDetails.yearlyMember') : t('vipDetails.monthlyMember'),
    price: plan === 'yearly' ? yearlyPrice.value : monthlyPrice.value,
    days: plan === 'yearly' ? 365 : 30,
  }

  logger.debug('[VipDetails] Select member plan:', planData)
  router.push({ path: '/vip', query: { type: plan, price: planData.price.toString(), days: planData.days.toString() } })
}

// 页面加载
onMounted(() => {
  trackVipPageView()
  loadVipPrice()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.vip-details-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
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

  @media (width <= $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.vip-card {
  margin-bottom: $desktop-section-gap;
  padding: 32px;
  background: var(--el-bg-color-page);
  border-radius: var(--global-border-radius); // 使用项目标准圆角
  border: var(--unified-border);

  // 扁平化设计：无阴影

  @media (width <= $desktop-breakpoint-xs) {
    padding: 24px;
  }
}

// 暗色模式下的VIP卡片
html.dark .vip-card {
  // 扁平化设计：无阴影
}

.monthly {
  background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
}

.yearly {
  background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
  border-color: var(--color-yellow-ffd700-30);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.vip-type {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.days {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.vip-price {
  display: flex;
  align-items: flex-start;
}

.price-symbol {
  font-size: 24px;
  color: var(--el-color-primary);
  font-weight: 700;
  line-height: 1;
  margin-top: 8px;
}

.price-value {
  font-size: 48px;
  color: var(--el-color-primary);
  font-weight: 700;
  line-height: 1;
}

.yearly .price-symbol,
.yearly .price-value {
  color: var(--color-yellow-ffd700);
}

.benefits-list {
  margin-bottom: 24px;
}

.benefit-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.benefit-icon {
  color: var(--color-yellow-ffd700);
  flex-shrink: 0;
  font-size: 20px;
}

.benefit-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.vip-button {
  width: 100%;
  height: 50px;
  border-radius: var(--global-border-radius);
  font-size: 16px;
  font-weight: 600;
}

.yearly-button {
  background: var(--el-text-color-primary);
  border: none;
}
</style>
