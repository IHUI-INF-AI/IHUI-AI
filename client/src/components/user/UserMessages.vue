<template>
  <div class="user-messages">
    <h3 class="section-title">{{ t('userComponents.messages.title') }}</h3>
    <div class="message-list">
      <div v-for="message in messages" :key="message.id" class="message-item" :class="{ unread: !message.read }">
        <div class="message-icon">
          <el-icon :size="20"><Bell /></el-icon>
        </div>
        <div class="message-content">
          <h4 class="message-title">{{ message.title }}</h4>
          <p class="message-text">{{ message.content }}</p>
          <span class="message-time">{{ formatTime(message.createTime) }}</span>
        </div>
        <div class="message-actions">
          <el-button v-if="!message.read" type="primary" link @click="handleMarkRead(message.id)">
            {{ t('commonText.view') }}
          </el-button>
          <el-button type="danger" link @click="handleDelete(message.id)">
            {{ t('commonText.delete') }}
          </el-button>
        </div>
      </div>
      <div v-if="!messages?.length" class="empty-state">
        <el-icon :size="48"><Bell /></el-icon>
        <p>{{ t('userComponents.messages.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bell } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()

interface Message {
  id: string
  title: string
  content: string
  read: boolean
  createTime: string
}

const _props = defineProps<{
  messages?: Message[]
}>()

const emit = defineEmits<{
  (e: 'mark-read', id: string): void
  (e: 'delete', id: string): void
}>()

const handleMarkRead = (id: string) => {
  emit('mark-read', id)
}

const handleDelete = (id: string) => {
  emit('delete', id)
}
</script>

<style scoped>
.user-messages {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  }

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  transition: background 0.2s;
}

.message-item.unread {
  background: var(--primary-light);
  border-left: 4px solid var(--primary-color);
}

.message-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: var(--el-bg-color-page);
  border-radius: 50%;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.message-text {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.message-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.message-actions {
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
