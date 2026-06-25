<template>
  <el-card class="billing-record-card" shadow="hover">
    <div class="record-header">
      <div class="record-info">
        <div class="record-main">
          <span class="record-model">{{ record.model }}</span>
          <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
        </div>
        <div class="record-endpoint">{{ record.endpoint }}</div>
      </div>
      <div class="record-cost">
        <span class="cost-value">¥{{ record.cost.toFixed(4) }}</span>
      </div>
    </div>

    <div class="record-details">
      <div class="detail-item" v-if="record.appName">
        <el-icon><Connection /></el-icon>
        <span>{{ t('apiService.billing.app') }}: {{ record.appName }}</span>
      </div>
      <div class="detail-item" v-if="record.apiKeyName">
        <el-icon><Key /></el-icon>
        <span>{{ t('apiService.billing.apiKey') }}: {{ record.apiKeyName }}</span>
      </div>
      <div class="detail-item">
        <el-icon><Document /></el-icon>
        <span>{{ t('apiService.billing.tokens') }}: {{ formatNumber(record.totalTokens) }} ({{ t('apiService.billing.input') }}: {{ formatNumber(record.inputTokens) }}, {{ t('apiService.billing.output') }}: {{ formatNumber(record.outputTokens) }})</span>
      </div>
      <div class="detail-item" v-if="record.latency">
        <el-icon><Timer /></el-icon>
        <span>{{ t('apiService.billing.latency') }}: {{ record.latency }}ms</span>
      </div>
      <div class="detail-item">
        <el-icon><Clock /></el-icon>
        <span>{{ t('apiService.billing.requestTime') }}: {{ formatTime(record.requestTime) }}</span>
      </div>
    </div>

    <div v-if="record.errorMessage" class="record-error">
      <el-alert type="error" :closable="false" show-icon>
        {{ record.errorMessage }}
      </el-alert>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Connection, Key, Document, Timer, Clock } from '@element-plus/icons-vue'
import type { BillingRecord } from '@/api/payment/billing'
import { formatTime, formatNumber } from '@/utils/format'

defineOptions({
  name: 'BillingRecordCard',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Props {
  record: BillingRecord
}

const props = defineProps<Props>()

const statusType = computed(() => {
  const statusMap: Record<string, 'success' | 'warning' | 'danger'> = {
    success: 'success',
    error: 'danger',
    timeout: 'warning',
  }
  return statusMap[props.record.status] || 'info'
})

const statusText = computed(() => {
  return t(`apiService.billing.status.${props.record.status}`)
})
</script>

<style scoped lang="scss">
.billing-record-card {
  margin-bottom: 16px;
  transition: all 0.3s ease;
  border-radius: var(--global-border-radius);

  &:hover {
    transform: translateY(-2px);
    }

  .record-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .record-info {
      flex: 1;

      .record-main {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;

        .record-model {
          font-size: 16px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }
      }

      .record-endpoint {
        font-size: 13px;
        color: var(--el-text-color-secondary);
        word-break: break-all;
      }
    }

    .record-cost {
      .cost-value {
        font-size: 18px;
        font-weight: 700;
        color: var(--el-color-danger);
      }
    }
  }

  .record-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
    padding: 12px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);

    .detail-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--el-text-color-regular);

      .el-icon {
        color: var(--el-text-color-secondary);
      }
    }
  }

  .record-error {
    margin-top: 12px;
  }
}
</style>
