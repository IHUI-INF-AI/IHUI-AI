<template>
  <el-card class="app-card" shadow="hover">
    <div class="app-header">
      <div class="app-info">
        <h3 class="app-name">{{ app.name }}</h3>
        <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
      </div>
      <el-dropdown @command="handleCommand">
        <el-button link type="primary">
          <el-icon><MoreFilled /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="view">{{ t('common.view') }}</el-dropdown-item>
            <el-dropdown-item command="edit">{{ t('common.edit') }}</el-dropdown-item>
            <el-dropdown-item command="delete" divided>{{ t('common.delete') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    
    <p v-if="app.description" class="app-description">{{ app.description }}</p>
    
    <div class="app-stats">
      <div class="stat-item">
        <span class="stat-label">{{ t('apiService.apps.apiKeys') }}</span>
        <span class="stat-value">{{ app.apiKeyCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">{{ t('apiService.apps.requests') }}</span>
        <span class="stat-value">{{ formatNumber(app.requestCount) }}</span>
      </div>
    </div>
    
    <div class="app-tags">
      <el-tag v-if="app.groupName" size="small" type="info" style="margin-right: 8px">
        <el-icon style="margin-right: 4px"><Connection /></el-icon>
        {{ app.groupName }}
      </el-tag>
      <el-tag v-if="app.packageName" size="small" type="warning">
        <el-icon style="margin-right: 4px"><Box /></el-icon>
        {{ app.packageName }}
      </el-tag>
    </div>
    
    <div class="app-footer">
      <span class="app-time">{{ t('apiService.apps.createdAt') }}: {{ formatTime(app.createdAt) }}</span>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MoreFilled, Connection, Box } from '@element-plus/icons-vue'
import type { App } from '@/api/app/apps'
import { formatTime, formatNumber } from '@/utils/format'

defineOptions({
  name: 'AppCard',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Props {
  app: App
}

const props = defineProps<Props>()

const emit = defineEmits<{
  view: [app: App]
  edit: [app: App]
  delete: [app: App]
}>()

const statusType = computed(() => {
  const statusMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    active: 'success',
    inactive: 'info',
    suspended: 'danger',
  }
  return statusMap[props.app.status] || 'info'
})

const statusText = computed(() => {
  return t(`apiService.apps.status.${props.app.status}`)
})

const handleCommand = (command: string) => {
  switch (command) {
    case 'view':
      emit('view', props.app)
      break
    case 'edit':
      emit('edit', props.app)
      break
    case 'delete':
      emit('delete', props.app)
      break
  }
}
</script>

<style scoped lang="scss">
.app-card {
  height: 100%;
  transition: transform 0.3s ease;
  border-radius: var(--global-border-radius);
  
  &:hover {
    
    }
  
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    
    .app-info {
      flex: 1;
      
      .app-name {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--el-text-color-primary);
      }
    }
  }
  
  .app-description {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    margin: 0 0 16px;
  }
  
  .app-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      
      .stat-label {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
      
      .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: var(--el-color-primary);
      }
    }
  }
  
  .app-tags {
    margin-bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .app-footer {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    
    .app-time {
      display: block;
    }
  }
}
</style>
