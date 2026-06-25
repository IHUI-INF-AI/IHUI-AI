<template>
  <el-card class="package-card" shadow="hover">
    <div class="package-header">
      <div class="package-info">
        <h3 class="package-name">{{ package.name }}</h3>
        <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
      </div>
      <div class="package-price">
        <span class="price-value">¥{{ package.price }}</span>
        <span class="price-unit">{{ t('hardcoded.package.card.月') }}</span>
      </div>
    </div>

    <p v-if="package.description" class="package-description">{{ package.description }}</p>

    <!-- 关联应用 -->
    <div v-if="package.apps && package.apps.length > 0" class="package-apps">
      <el-tag
        v-for="app in package.apps.slice(0, 3)"
        :key="app.id"
        size="small"
        type="info"
        style="margin-right: 6px; margin-bottom: 6px"
      >
        <el-icon style="margin-right: 4px"><Connection /></el-icon>
        {{ app.name }}
      </el-tag>
      <el-tag v-if="package.apps.length > 3" size="small" type="info">
        +{{ package.apps.length - 3 }}
      </el-tag>
    </div>

    <!-- 配额使用情况 -->
    <div class="quota-section">
      <div class="quota-header">
        <span class="quota-label">{{ t('apiService.packages.quota') }}</span>
        <span class="quota-usage">
          {{ formatNumber(package.usedQuota) }} / {{ formatNumber(package.quota) }}
        </span>
      </div>
      <el-progress
        :percentage="quotaPercentage"
        :color="quotaColor"
        :stroke-width="8"
        :show-text="false"
      />
      <div class="quota-details">
        <span class="quota-remaining">
          {{ t('apiService.packages.remaining') }}: {{ formatNumber(package.remainingQuota) }}
        </span>
      </div>
    </div>

    <!-- 有效期 -->
    <div class="package-footer">
      <div class="package-dates">
        <span class="date-item">
          {{ t('apiService.packages.startDate') }}: {{ formatTime(package.startDate) }}
        </span>
        <span class="date-item">
          {{ t('apiService.packages.endDate') }}: {{ formatTime(package.endDate) }}
        </span>
      </div>
      <div class="package-actions">
        <el-button link type="primary" @click="handleView">
          {{ t('common.view') }}
        </el-button>
        <el-button
          v-if="package.status === 'active'"
          link
          type="primary"
          @click="handleUpgrade"
        >
          {{ t('apiService.packages.upgrade') }}
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Connection } from '@element-plus/icons-vue'
import type { Package } from '@/api/packages'
import { formatTime, formatNumber } from '@/utils/format'

defineOptions({
  name: 'PackageCard',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Props {
  package: Package
}

const props = defineProps<Props>()

const emit = defineEmits<{
  view: [pkg: Package]
  upgrade: [pkg: Package]
}>()

const statusType = computed(() => {
  const statusMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    active: 'success',
    expired: 'warning',
    suspended: 'danger',
  }
  return statusMap[props.package.status] || 'info'
})

const statusText = computed(() => {
  return t(`apiService.packages.status.${props.package.status}`)
})

const quotaPercentage = computed(() => {
  if (props.package.quota === 0) return 0
  return (props.package.usedQuota / props.package.quota) * 100
})

const quotaColor = computed(() => {
  const percentage = quotaPercentage.value
  if (percentage >= 90) return 'var(--color-danger-variant)'
  if (percentage >= 70) return 'var(--color-warning-variant)'
  return 'var(--color-success)'
})

const handleView = () => {
  emit('view', props.package)
}

const handleUpgrade = () => {
  emit('upgrade', props.package)
}
</script>

<style scoped lang="scss">
.package-card {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: var(--global-border-radius);

  &:hover {
    transform: translateY(-4px);
    }

  .package-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .package-info {
      flex: 1;

      .package-name {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--el-text-color-primary);
      }
    }

    .package-price {
      text-align: right;

      .price-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--el-color-primary);
      }

      .price-unit {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin-left: 4px;
      }
    }
  }

  .package-description {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    margin: 0 0 16px;
  }

  .package-apps {
    margin-bottom: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .quota-section {
    margin-bottom: 16px;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);

    .quota-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .quota-label {
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }

      .quota-usage {
        font-size: 14px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    .quota-details {
      margin-top: 8px;
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }

  .package-footer {
    .package-dates {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
      font-size: 12px;
      color: var(--el-text-color-placeholder);

      .date-item {
        display: block;
      }
    }

    .package-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  }
}
</style>
