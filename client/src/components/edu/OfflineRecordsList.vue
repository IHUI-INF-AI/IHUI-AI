<template>
  <section class="offline-records-list">
    <header class="section-header">
      <h3 class="section-title">{{ t('edu.profile.offlineRecords') }}</h3>
    </header>

    <el-empty v-if="!records.length" :description="t('edu.profile.empty')" />

    <template v-else>
      <ul class="record-list">
        <li
          v-for="record in visibleRecords"
          :key="record.id"
          class="record-item"
        >
          <div class="record-date-col">
            <span class="record-date">{{ formatDate(record.record_date) }}</span>
          </div>

          <div class="record-type-col">
            <el-tag
              :type="getTypeTagType(record.activity_type)"
              size="small"
              effect="dark"
              :class="getTypeTagClass(record.activity_type)"
              :style="getTypeTagStyle(record.activity_type)"
            >
              {{ getTypeLabel(record.activity_type) }}
            </el-tag>
          </div>

          <div class="record-main">
            <div class="record-title" :title="record.title">{{ record.title || '-' }}</div>
            <p v-if="record.description" class="record-desc">{{ summarize(record.description) }}</p>
          </div>

          <div class="record-duration-col">
            <span class="duration-value">{{ record.duration_minutes ?? 0 }}</span>
            <span class="duration-unit">{{ t('edu.profile.minutes') }}</span>
          </div>

          <div class="record-actions">
            <el-button text :icon="Edit" size="small" @click.stop="emit('edit', record)" />
            <el-button text :icon="Delete" size="small" @click.stop="emit('delete', record)" />
          </div>
        </li>
      </ul>

      <div v-if="showViewAll" class="view-all-bar">
        <el-button
          type="primary"
          plain
          size="small"
          @click="emit('view-all')"
        >
          {{ t('edu.profile.viewAll') }}
          <el-icon class="view-all-icon"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { ArrowRight, Edit, Delete } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { OfflineRecord, OfflineActivityType } from '@/api/edu/offline-records'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  records: OfflineRecord[]
  limit?: number
}>(), {
  limit: 0,
})

const emit = defineEmits<{
  (e: 'view-all'): void
  (e: 'edit', record: OfflineRecord): void
  (e: 'delete', record: OfflineRecord): void
}>()

const visibleRecords = computed<OfflineRecord[]>(() => {
  if (!props.limit || props.limit <= 0) return props.records
  return props.records.slice(0, props.limit)
})

const showViewAll = computed(() => {
  if (!props.limit || props.limit <= 0) return false
  return props.records.length > props.limit
})

const SUMMARY_MAX = 80

function summarize(content?: string): string {
  if (!content) return ''
  const text = String(content).replace(/\s+/g, ' ').trim()
  if (text.length <= SUMMARY_MAX) return text
  return text.slice(0, SUMMARY_MAX) + '…'
}

function formatDate(value?: string): string {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD') : value
}

function getTypeTagType(type: OfflineActivityType): 'primary' | 'success' | 'warning' | 'info' {
  switch (type) {
    case 'self_study':
      return 'success'
    case 'practice':
      return 'warning'
    case 'other':
      return 'info'
    case 'training':
    case 'reading':
    default:
      return 'primary'
  }
}

function getTypeTagClass(type: OfflineActivityType): string {
  return `is-${type}`
}

function getTypeTagStyle(type: OfflineActivityType): Record<string, string> {
  switch (type) {
    case 'training':
      return {
        backgroundColor: 'var(--el-color-primary)',
        borderColor: 'var(--el-color-primary)',
        color: 'var(--color-edu-reading-text)',
      }
    case 'reading':
      return {
        backgroundColor: 'var(--color-edu-reading)',
        borderColor: 'var(--color-edu-reading)',
        color: 'var(--color-edu-reading-text)',
      }
    default:
      return {}
  }
}

function getTypeLabel(type: OfflineActivityType): string {
  switch (type) {
    case 'training':
      return t('edu.profile.activityTraining')
    case 'self_study':
      return t('edu.profile.activitySelfStudy')
    case 'practice':
      return t('edu.profile.activityPractice')
    case 'reading':
      return t('edu.profile.activityReading')
    default:
      return t('edu.profile.activityOther')
  }
}
</script>

<style lang="scss" scoped>
:where(.offline-records-list) {
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

:where(.record-list) {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

:where(.record-item) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--color-white-50);
  }
}

:where(.record-date-col) {
  flex-shrink: 0;
  width: 100px;
}

:where(.record-date) {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

:where(.record-type-col) {
  flex-shrink: 0;
  width: 70px;
  display: flex;
  align-items: center;
}

:where(.record-main) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:where(.record-title) {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:where(.record-desc) {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.record-duration-col) {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  gap: 2px;
  padding-left: 8px;
  border-left: 1px solid var(--color-white-30);
}

:where(.record-actions) {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  padding-left: 8px;
  margin-left: auto;

  :where(.el-button) {
    padding: 4px;
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

:where(.duration-value) {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}

:where(.duration-unit) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.view-all-bar) {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

:where(.view-all-icon) {
  margin-left: 4px;
}

@media (max-width: 640px) {
  :where(.record-item) {
    flex-wrap: wrap;
  }

  :where(.record-date-col),
  :where(.record-type-col) {
    width: auto;
  }

  :where(.record-duration-col) {
    border-left: none;
    padding-left: 0;
  }

  :where(.record-actions) {
    padding-left: 0;
    margin-left: 0;
  }
}
</style>
