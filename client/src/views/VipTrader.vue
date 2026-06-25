<template>
  <div class="vip-trader-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Briefcase /></el-icon>
        {{ t('vipTrader.title') }}
      </h1>
      <p class="page-subtitle">{{ t('vipTrader.subtitle', { price: traderPrice }) }}</p>
    </div>

    <!-- 操盘手权益（复用Vip.vue的结构） -->
    <div class="features-section radius-auto">
      <h3 class="section-title">{{ t('vipTrader.features.title') }}</h3>
      <div class="features-list">
        <div v-for="feature in features" :key="feature.id" class="feature-item">
          <span class="feature-icon">{{ feature.icon }}</span>
          <div class="feature-info">
            <div class="feature-title">{{ feature.title }}</div>
            <div v-if="feature.desc" class="feature-desc">{{ feature.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 购买按钮 -->
    <div class="buy-section radius-auto">
      <div class="price-info">
        <div class="price">
          <span class="symbol">¥</span>
          <span class="number">{{ traderPrice }}</span>
        </div>
      </div>
      <el-button type="primary" size="large" @click="handlePurchase" style="width: 100%">
        {{ t('vipTrader.purchase.button') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Briefcase } from '@/lib/lucide-fallback'
import { getTraderPrice } from '@/api/vip'
import { normalizeApiResponse } from '@/utils/api-response'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const router = useRouter()

const traderPrice = ref(18888)
const { loading: _loadingPrice, execute: executeApi } = useApiError({ showMessage: false })

const features = [
  {
    id: 'distribution_qualification',
    title: t('vipTrader.features.distributionQualification.title'),
    desc: t('vipTrader.features.distributionQualification.desc'),
    icon: '🏅',
  },
  {
    id: 'ai_courses',
    title: t('vipTrader.features.aiCourses.title'),
    desc: t('vipTrader.features.aiCourses.desc'),
    icon: '🎓',
  },
  {
    id: 'founder_qa',
    title: t('vipTrader.features.founderQa.title'),
    desc: t('vipTrader.features.founderQa.desc'),
    icon: '🤝',
  },
  {
    id: 'agent_beta',
    title: t('vipTrader.features.agentBeta.title'),
    desc: t('vipTrader.features.agentBeta.desc'),
    icon: '🧪',
  },
  {
    id: 'vip_max_discount',
    title: t('vipTrader.features.vipMaxDiscount.title'),
    desc: t('vipTrader.features.vipMaxDiscount.desc'),
    icon: '💎',
  },
  {
    id: 'custom_agent_discount',
    title: t('vipTrader.features.customAgentDiscount.title'),
    desc: t('vipTrader.features.customAgentDiscount.desc'),
    icon: '⚡',
  },
  {
    id: 'all_vip_rights',
    title: t('vipTrader.features.allVipRights.title'),
    desc: t('vipTrader.features.allVipRights.desc'),
    icon: '🎁',
  },
  {
    id: 'vertical_account_incubation',
    title: t('vipTrader.features.verticalAccountIncubation.title'),
    desc: t('vipTrader.features.verticalAccountIncubation.desc'),
    icon: '🚀',
  },
  {
    id: 'secondary_distribution',
    title: t('vipTrader.features.secondaryDistribution.title'),
    desc: t('vipTrader.features.secondaryDistribution.desc'),
    icon: '🌐',
  },
  {
    id: 'offline_learning',
    title: t('vipTrader.features.offlineLearning.title'),
    desc: t('vipTrader.features.offlineLearning.desc'),
    icon: '🏢',
  },
]

// 加载操盘手价格
const loadTraderPrice = async () => {
  const data = await executeApi(async () => {
    const response = await getTraderPrice()
    return normalizeApiResponse<{ amount?: number }>(response)
  })
  if (data !== null && typeof data === 'object') {
    const priceData = data as { amount?: number }
    traderPrice.value = priceData.amount || 18888
  }
}

// 处理购买
const handlePurchase = () => {
  // 跳转到VIP购买页面，传递操盘手类型
  router.push(`/vip?type=trader`)
}

onMounted(() => {
  loadTraderPrice()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.vip-trader-page {
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

.features-section,
.buy-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.feature-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.feature-info {
  flex: 1;
}

.feature-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.buy-section {
  text-align: center;
}

.price-info {
  margin-bottom: 20px;
}

.price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.symbol {
  font-size: 20px;
  color: var(--el-color-primary);
}

.number {
  font-size: 36px;
  font-weight: 700;
  color: var(--el-color-primary);
}
</style>
