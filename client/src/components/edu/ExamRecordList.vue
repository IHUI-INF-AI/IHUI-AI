<template>
  <section class="exam-record-list">
    <header class="section-header">
      <h3 class="section-title">{{ t('edu.profile.examRecords') }}</h3>
    </header>

    <el-empty v-if="!records.length" :description="t('edu.profile.empty')" />

    <el-table
      v-else
      :data="records"
      style="width: 100%"
      row-key="id"
    >
      <el-table-column :label="t('edu.profile.paperName')" min-width="180">
        <template #default="{ row }">
          <span class="paper-name">{{ formatPaperName(row) }}</span>
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.startTime')" width="170">
        <template #default="{ row }">
          {{ formatDateTime(row.start_at) }}
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.duration')" width="120" align="center">
        <template #default="{ row }">
          {{ formatDuration(row.duration_seconds) }}
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.score')" width="100" align="center">
        <template #default="{ row }">
          <span v-if="row.score != null" class="score-value" :class="getScoreClass(row)">
            {{ row.score }}
          </span>
          <span v-else class="score-pending">-</span>
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.passStatus')" width="110" align="center">
        <template #default="{ row }">
          <el-tag
            v-if="row.is_passed === true"
            type="success"
            size="small"
            effect="dark"
          >
            {{ t('edu.profile.passed') }}
          </el-tag>
          <el-tag
            v-else-if="row.is_passed === false"
            type="danger"
            size="small"
            effect="dark"
          >
            {{ t('edu.profile.failed') }}
          </el-tag>
          <el-tag
            v-else
            type="info"
            size="small"
            effect="plain"
          >
            {{ t('edu.profile.pending') }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.examStatus')" width="110" align="center">
        <template #default="{ row }">
          <el-tag
            :type="getExamStatusType(row.status)"
            size="small"
            effect="light"
          >
            {{ getExamStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import type { EduExamRecord } from '@/api/edu'

const { t } = useI18n()

defineProps<{
  records: EduExamRecord[]
}>()

function formatPaperName(row: EduExamRecord): string {
  if (row.paper_id) return `${t('edu.profile.paper')} #${row.paper_id}`
  return t('edu.profile.unknownPaper')
}

function formatDateTime(value?: string): string {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : value
}

function formatDuration(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '-'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  if (minutes <= 0) return `${secs}${t('edu.profile.seconds')}`
  return `${minutes}${t('edu.profile.minutes')}${secs}${t('edu.profile.seconds')}`
}

function getScoreClass(row: EduExamRecord): string {
  if (row.is_passed === true) return 'is-pass'
  if (row.is_passed === false) return 'is-fail'
  return ''
}

function getExamStatusType(status: string): 'info' | 'warning' | 'success' | 'primary' {
  switch (status) {
    case 'in_progress':
    case 'started':
      return 'warning'
    case 'submitted':
      return 'primary'
    case 'graded':
    case 'finished':
      return 'success'
    default:
      return 'info'
  }
}

function getExamStatusLabel(status: string): string {
  switch (status) {
    case 'in_progress':
    case 'started':
      return t('edu.profile.examInProgress')
    case 'submitted':
      return t('edu.profile.examSubmitted')
    case 'graded':
    case 'finished':
      return t('edu.profile.examGraded')
    default:
      return status || t('edu.profile.examUnknown')
  }
}
</script>

<style lang="scss" scoped>
:where(.exam-record-list) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

:where(.section-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:where(.section-title) {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:where(.paper-name) {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

:where(.score-value) {
  font-weight: 600;
  font-size: 15px;

  &.is-pass {
    color: var(--el-color-success);
  }

  &.is-fail {
    color: var(--el-color-danger);
  }
}

:where(.score-pending) {
  color: var(--el-text-color-placeholder);
}

:where(.exam-record-list) :deep(.el-table) {
  border-radius: 8px;
  border: 1px solid var(--color-white-30);
}

:where(.exam-record-list) :deep(.el-table th.el-table__cell) {
  background: var(--el-fill-color-light);
}
</style>
