<template>
  <div class="audit-export">
    <div class="export-header">
      <h3 class="export-title">{{ t('settings.auditExport.title') }}</h3>
      <p class="export-desc">{{ t('settings.auditExport.description') }}</p>
    </div>

    <div class="export-options">
      <div class="option-group">
        <label>{{ t('settings.auditExport.dateRange') }}</label>
        <div class="date-range">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            :start-placeholder="t('settings.auditExport.startDate')"
            :end-placeholder="t('settings.auditExport.endDate')"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </div>
      </div>

      <div class="option-group">
        <label>{{ t('settings.auditExport.exportFormat') }}</label>
        <el-radio-group v-model="exportFormat">
          <el-radio value="json">JSON</el-radio>
          <el-radio value="csv">CSV</el-radio>
        </el-radio-group>
      </div>

      <div class="option-group">
        <label>{{ t('settings.auditExport.eventTypes') }}</label>
        <el-checkbox-group v-model="selectedTypes">
          <el-checkbox value="login">{{ t('settings.auditExport.typeLogin') }}</el-checkbox>
          <el-checkbox value="logout">{{ t('settings.auditExport.typeLogout') }}</el-checkbox>
          <el-checkbox value="password_change">{{ t('settings.auditExport.typePassword') }}</el-checkbox>
          <el-checkbox value="device_remove">{{ t('settings.auditExport.typeDevice') }}</el-checkbox>
          <el-checkbox value="suspicious_login">{{ t('settings.auditExport.typeSuspicious') }}</el-checkbox>
        </el-checkbox-group>
      </div>
    </div>

    <div class="export-preview" v-if="previewData">
      <h4>{{ t('settings.auditExport.preview') }}</h4>
      <div class="preview-stats">
        <div class="stat-item">
          <span class="stat-label">{{ t('settings.auditExport.totalEvents') }}</span>
          <span class="stat-value">{{ previewData.totalEvents }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ t('settings.auditExport.logins') }}</span>
          <span class="stat-value">{{ previewData.summary.logins }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ t('settings.auditExport.failedLogins') }}</span>
          <span class="stat-value">{{ previewData.summary.failedLogins }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ t('settings.auditExport.suspicious') }}</span>
          <span class="stat-value">{{ previewData.summary.suspiciousActivities }}</span>
        </div>
      </div>
    </div>

    <div class="export-actions">
      <el-button @click="handlePreview">{{ t('settings.auditExport.previewBtn') }}</el-button>
      <el-button type="primary" @click="handleExport" :disabled="!previewData">
        {{ t('settings.auditExport.exportBtn') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { AuditExportService, type AuditReport } from '@/utils/auditExportService'
import { SecurityLogService } from '@/utils/securityLogService'

const { t } = useI18n()

const dateRange = ref<[string, string] | null>(null)
const exportFormat = ref<'json' | 'csv'>('json')
const selectedTypes = ref<string[]>([])
const previewData = ref<AuditReport | null>(null)

const handlePreview = () => {
  const events = SecurityLogService.getLogs()

  const options = {
    format: exportFormat.value as 'json' | 'csv',
    dateRange: dateRange.value ? {
      start: new Date(dateRange.value[0]),
      end: new Date(dateRange.value[1]),
    } : undefined,
    types: selectedTypes.value.length > 0 ? selectedTypes.value : undefined,
  }

  previewData.value = AuditExportService.generateReport(events, options)
}

const handleExport = () => {
  if (!previewData.value) return

  AuditExportService.downloadReport(previewData.value, exportFormat.value)
  ElMessage.success(t('settings.auditExport.exportSuccess'))
}

onMounted(() => {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  dateRange.value = [
    thirtyDaysAgo.toISOString().split('T')[0],
    now.toISOString().split('T')[0],
  ]
})
</script>

<style scoped lang="scss">
.audit-export {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.export-header {
  margin-bottom: 20px;

  .export-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .export-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.export-options {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

.option-group {
  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
  }
}

.export-preview {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  margin-bottom: 20px;

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--el-text-color-primary);
  }

  .preview-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .stat-item {
    text-align: center;
    padding: 12px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);

    .stat-label {
      display: block;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--el-color-primary);
    }
  }
}

.export-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
