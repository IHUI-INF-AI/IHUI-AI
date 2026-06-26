<template>
  <el-card class="ticket-card" shadow="hover" @click="handleClick">
    <div class="ticket-header">
      <div class="ticket-title-section">
        <h3 class="ticket-title">{{ ticket.title }}</h3>
        <div class="ticket-meta">
          <el-tag :type="categoryType" size="small">{{ categoryText }}</el-tag>
          <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
          <el-tag :type="priorityType" size="small">{{ priorityText }}</el-tag>
        </div>
      </div>
      <div class="ticket-time">
        {{ formatTime(ticket.createdAt) }}
      </div>
    </div>

    <p class="ticket-description">{{ ticket.description }}</p>

    <div class="ticket-footer">
      <div class="ticket-replies">
        <el-icon><ChatDotRound /></el-icon>
        <span>{{ ticket.replies?.length || 0 }} {{ t('apiService.tickets.replies') }}</span>
      </div>
      <div class="ticket-actions">
        <el-button link type="primary" size="small" @click.stop="handleView">
          {{ t('common.view') }}
        </el-button>
        <el-button
          v-if="ticket.status === 'closed'"
          link
          type="primary"
          size="small"
          @click.stop="handleReopen"
        >
          {{ t('apiService.tickets.reopen') }}
        </el-button>
        <el-button
          v-else-if="ticket.status !== 'closed'"
          link
          type="danger"
          size="small"
          @click.stop="handleClose"
        >
          {{ t('apiService.tickets.close') }}
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChatDotRound } from '@element-plus/icons-vue'
import type { Ticket } from '@/api/system/tickets'
import { formatTime } from '@/utils/format'

defineOptions({
  name: 'TicketCard',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Props {
  ticket: Ticket
}

const props = defineProps<Props>()

const emit = defineEmits<{
  view: [ticket: Ticket]
  close: [ticket: Ticket]
  reopen: [ticket: Ticket]
}>()

const categoryType = computed(() => {
  const categoryMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    technical: 'danger',
    billing: 'warning',
    feature: 'success',
    other: 'info',
  }
  return categoryMap[props.ticket.category] || 'info'
})

const categoryText = computed(() => {
  return t(`apiService.tickets.category.${props.ticket.category}`)
})

const statusType = computed(() => {
  const statusMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    pending: 'warning',
    processing: 'danger',
    resolved: 'success',
    closed: 'info',
  }
  return statusMap[props.ticket.status] || 'info'
})

const statusText = computed(() => {
  return t(`apiService.tickets.status.${props.ticket.status}`)
})

const priorityType = computed(() => {
  const priorityMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    low: 'info',
    medium: 'success',
    high: 'warning',
    urgent: 'danger',
  }
  return priorityMap[props.ticket.priority] || 'info'
})

const priorityText = computed(() => {
  return t(`apiService.tickets.priority.${props.ticket.priority}`)
})

const handleClick = () => {
  emit('view', props.ticket)
}

const handleView = () => {
  emit('view', props.ticket)
}

const handleClose = () => {
  emit('close', props.ticket)
}

const handleReopen = () => {
  emit('reopen', props.ticket)
}
</script>

<style scoped lang="scss">
.ticket-card {
  cursor: pointer;
  transition: transform 0.3s ease;
  border-radius: var(--global-border-radius);
  margin-bottom: 16px;

  &:hover {
    
    }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .ticket-title-section {
      flex: 1;

      .ticket-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--el-text-color-primary);
      }

      .ticket-meta {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    }

    .ticket-time {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      white-space: nowrap;
    }
  }

  .ticket-description {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    margin: 0 0 12px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ticket-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: var(--unified-border);

    .ticket-replies {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .ticket-actions {
      display: flex;
      gap: 8px;
    }
  }
}
</style>
