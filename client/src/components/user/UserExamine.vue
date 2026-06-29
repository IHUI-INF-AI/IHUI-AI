<template>
  <div class="user-examine">
    <h3 class="section-title">{{ t('userComponents.examine.title') }}</h3>
    <div class="examine-list">
      <div v-for="item in examines" :key="item.id" class="examine-item">
        <div class="item-image">
          <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
          <div v-else class="no-image">
            <el-icon :size="32"><DocumentChecked /></el-icon>
          </div>
        </div>
        <div class="item-content">
          <h4 class="item-title">{{ item.title }}</h4>
          <p class="item-desc">{{ item.description }}</p>
          <div class="item-meta">
            <span class="item-status" :class="item.status">{{ formatStatus(item.status) }}</span>
            <span class="item-time">{{ formatTime(item.submitTime) }}</span>
          </div>
          <p v-if="item.rejectReason" class="reject-reason">{{ t('userComponents.examine.rejectReason') }}: {{ item.rejectReason }}</p>
        </div>
        <div class="item-actions">
          <el-button type="primary" link @click="handleView(item)">{{ t('userComponents.examine.view') }}</el-button>
          <el-button v-if="item.status === 'rejected'" type="warning" link @click="handleResubmit(item.id)">{{ t('userComponents.examine.resubmit') }}</el-button>
        </div>
      </div>
      <div v-if="examines.length === 0" class="empty-state">
        <el-icon :size="48"><DocumentChecked /></el-icon>
        <p>{{ t('userComponents.examine.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DocumentChecked } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatTime as _formatTime } from '@/utils/format'

const { t } = useI18n()

interface ExamineItem {
  id: string
  title: string
  description?: string
  image?: string
  status: 'pending' | 'approved' | 'rejected'
  submitTime: string
  rejectReason?: string
}

const _props = defineProps<{
  examines?: ExamineItem[]
}>()

const emit = defineEmits<{
  (e: 'view', item: ExamineItem): void
  (e: 'resubmit', id: string): void
}>()

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: t('statisticsComponents.pending'),
    approved: t('statisticsComponents.passed'),
    rejected: t('statisticsComponents.rejected'),
  }
  return statusMap[status] || status
}

const formatTime = (time: string) => _formatTime(time, 'YYYY-MM-DD')

const handleView = (item: ExamineItem) => {
  emit('view', item)
}

const handleResubmit = (id: string) => {
  emit('resubmit', id)
}
</script>

<style scoped>
.user-examine {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  box-shadow: var(--global-box-shadow);
}

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.examine-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.examine-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  transition: background 0.2s;
}

.examine-item:hover {
  background: var(--bg-hover);
}

.item-image {
  width: 80px;
  height: 80px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-desc {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.item-status {
  padding: 2px 8px;
  font-size: 12px;
  border-radius: var(--global-border-radius);
}

.item-status.pending {
  background: var(--warning-light);
  color: var(--warning-color);
}

.item-status.approved {
  background: var(--success-light);
  color: var(--success-color);
}

.item-status.rejected {
  background: var(--danger-light);
  color: var(--danger-color);
}

.item-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.reject-reason {
  margin: 0;
  padding: 8px;
  font-size: 12px;
  color: var(--danger-color);
  background: var(--danger-light);
  border-radius: var(--global-border-radius);
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--text-secondary);
}

.empty-state .el-icon {
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
