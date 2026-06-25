<template>
  <div class="commission-plan-page page-container">
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Gift /></el-icon>
        {{ t('commissionPlan.title') }}
      </h1>
      <p class="page-subtitle">{{ t('commissionPlan.subtitle') }}</p>
    </div>

    <div class="intro-section radius-auto">
      <h2 class="intro-title">{{ t('commissionPlan.introTitle') }}</h2>
      <p class="intro-desc">{{ t('commissionPlan.introDesc') }}</p>

      <StatsPanel
        :title="t('commissionPlan.myStats')"
        :stats="planStats"
        :refreshing="loading"
        @refresh="loadPlanData"
      />
    </div>

    <div class="rules-section radius-auto">
      <h3 class="section-title">{{ t('commissionPlan.rulesTitle') }}</h3>
      <div class="rules-list">
        <div class="rule-item">
          <div class="rule-number">1</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.rule1Title') }}</h4>
            <p>{{ t('commissionPlan.rule1') }}</p>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-number">2</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.rule2Title') }}</h4>
            <p>{{ t('commissionPlan.rule2') }}</p>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-number">3</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.rule3Title') }}</h4>
            <p>{{ t('commissionPlan.rule3') }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="rules-section radius-auto">
      <h3 class="section-title">{{ t('commissionPlan.ratioTitle') }}</h3>
      <div class="rules-list">
        <div class="rule-item">
          <div class="rule-number">1</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.ratioLevel1Title') }}</h4>
            <p>{{ t('commissionPlan.ratioLevel1') }}</p>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-number">2</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.ratioLevel2Title') }}</h4>
            <p>{{ t('commissionPlan.ratioLevel2') }}</p>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-number">3</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.ratioNoteTitle') }}</h4>
            <p>{{ t('commissionPlan.ratioNote') }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="rules-section radius-auto">
      <h3 class="section-title">{{ t('commissionPlan.settlementTitle') }}</h3>
      <div class="rules-list">
        <div class="rule-item">
          <div class="rule-number">1</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.settlement1Title') }}</h4>
            <p>{{ t('commissionPlan.settlement1') }}</p>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-number">2</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.settlement2Title') }}</h4>
            <p>{{ t('commissionPlan.settlement2') }}</p>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-number">3</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.settlement3Title') }}</h4>
            <p>{{ t('commissionPlan.settlement3') }}</p>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-number">4</div>
          <div class="rule-content">
            <h4>{{ t('commissionPlan.settlement4Title') }}</h4>
            <p>{{ t('commissionPlan.settlement4') }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="action-section radius-auto">
      <el-button type="primary" size="large" @click="goToVip" style="width: 100%">
        {{ t('commissionPlan.joinVip') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Gift } from '@/lib/lucide-fallback'
import { getDistributionStatistics } from '@/api/distribution/distribution'
import StatsPanel from '@/components/common/StatsPanel.vue'
import type { StatItem } from '@/components/common/StatsPanel.vue'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const router = useRouter()
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const planData = ref({
  totalCommission: 0,
  totalInvites: 0,
})

const planStats = computed<StatItem[]>(() => [
  {
    key: 'totalCommission',
    label: t('commissionPlan.totalEarnings'),
    value: planData.value.totalCommission,
    type: 'primary',
    prefix: '¥',
  },
  {
    key: 'totalInvites',
    label: t('commissionPlan.totalInvites'),
    value: planData.value.totalInvites,
    type: 'success',
  },
])

const loadPlanData = async () => {
  const response = await executeApi(() => getDistributionStatistics())
  if (response) {
    planData.value = {
      totalCommission: response.totalEarnings || 0,
      totalInvites: response.totalInvites || 0,
    }
  }
}

const goToVip = () => {
  router.push('/vip')
}

onMounted(() => {
  loadPlanData()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.commission-plan-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
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
  background-color: var(--el-bg-color-page);
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

.intro-section,
.rules-section,
.action-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.intro-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 12px;
}

.intro-desc {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
  line-height: 1.6;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.rule-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-color-primary);
  color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
  font-weight: 700;
  flex-shrink: 0;
}

.rule-content {
  flex: 1;

  h4 {
    font-size: 16px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin: 0 0 8px;
    line-height: 1.5;
  }

  p {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
    line-height: 1.6;
  }
}
</style>
