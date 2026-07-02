<template>
  <div class="api-platform-billing-page" v-loading="loading">
    <h2 class="page-title">{{ t('apiMgmt.billing.title', 'API 计费记录 (接入 BillingRecordCard)') }}</h2>
    <p class="page-subtitle">{{ t('apiMgmt.billing.subtitle', '查看 API 调用计费记录，跟踪 Token 消耗、费用和延迟') }}</p>

    <div class="toolbar">
      <el-button @click="reload">
        {{ t('common.refresh', '刷新') }}
      </el-button>
      <el-button @click="exportRecords">
        {{ t('apiService.usage.exportStats', '导出') }}
      </el-button>
    </div>

    <div v-if="error" class="error-banner">
      <el-alert :title="error" type="error" :closable="false" show-icon />
    </div>

    <div v-if="records.length === 0 && !loading" class="empty-state">
      <el-empty :description="t('apiMgmt.billing.empty', '暂无计费记录')" />
    </div>

    <div v-else class="record-list">
      <BillingRecordCard
        v-for="record in records"
        :key="record.id"
        :record="record"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getBillingRecords, type BillingRecord } from '@/api/billing'
import { logger } from '@/utils/logger'
import BillingRecordCard from '@/components/api/BillingRecordCard.vue'

defineOptions({ name: 'AdminApiBilling' })

const { t } = useI18n()
const records = ref<BillingRecord[]>([])
const loading = ref(false)
const error = ref('')

const loadRecords = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getBillingRecords({ page: 1, pageSize: 50 })
    if (res.code === 0 && res.data) {
      records.value = res.data.list || []
    } else {
      error.value = res.msg || t('apiMgmt.billing.loadFailed', '加载计费记录失败')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    logger.error('[ApiBilling] load failed:', e)
  } finally {
    loading.value = false
  }
}

const reload = () => loadRecords()

const exportRecords = () => {
  ElMessage.info(t('apiMgmt.billing.exportHint', '导出功能开发中'))
}

onMounted(loadRecords)
</script>

<style scoped lang="scss">
.api-platform-billing-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-banner {
  margin-bottom: 16px;
}

.empty-state {
  padding: 60px 0;
}
</style>
