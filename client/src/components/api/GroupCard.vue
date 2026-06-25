<template>
  <el-card class="group-card" shadow="hover">
    <div class="group-header">
      <div class="group-info">
        <h3 class="group-name">{{ group.name }}</h3>
        <el-tag :type="typeTagType" size="small">{{ typeText }}</el-tag>
        <el-tag :type="statusType" size="small" style="margin-left: 8px">{{ statusText }}</el-tag>
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
    
    <p v-if="group.description" class="group-description">{{ group.description }}</p>
    
    <div class="group-specs">
      <div class="spec-item">
        <span class="spec-label">{{ t('apiService.groups.features.models') }}</span>
        <span class="spec-value">{{ group.models?.length || 0 }}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">{{ t('apiService.groups.features.concurrent') }}</span>
        <span class="spec-value">{{ group.maxConcurrent || '-' }}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">{{ t('apiService.groups.features.rateLimit') }}</span>
        <span class="spec-value">{{ formatNumber(group.rateLimit || 0) }}/min</span>
      </div>
    </div>
    
    <div class="group-footer">
      <div class="app-count">
        <el-icon><Connection /></el-icon>
        <span>{{ t('apiService.groups.appCount') }}: {{ group.appCount || 0 }}</span>
      </div>
      <span class="group-time">{{ t('apiService.groups.createdAt') }}: {{ formatTime(group.createdAt) }}</span>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MoreFilled, Connection } from '@element-plus/icons-vue'
import type { ApiGroup } from '@/api/groups'
import { formatTime, formatNumber } from '@/utils/format'

defineOptions({
  name: 'GroupCard',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Props {
  group: ApiGroup
}

const props = defineProps<Props>()

const emit = defineEmits<{
  view: [group: ApiGroup]
  edit: [group: ApiGroup]
  delete: [group: ApiGroup]
}>()

const typeTagType = computed(() => {
  const typeMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    basic: 'info',
    standard: 'success',
    premium: 'warning',
    enterprise: 'danger',
  }
  return typeMap[props.group.type] || 'info'
})

const typeText = computed(() => {
  return t(`apiService.groups.types.${props.group.type}`)
})

const statusType = computed(() => {
  const statusMap: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    active: 'success',
    inactive: 'info',
  }
  return statusMap[props.group.status] || 'info'
})

const statusText = computed(() => {
  return t(`apiService.groups.status.${props.group.status}`)
})

const handleCommand = (command: string) => {
  switch (command) {
    case 'view':
      emit('view', props.group)
      break
    case 'edit':
      emit('edit', props.group)
      break
    case 'delete':
      emit('delete', props.group)
      break
  }
}
</script>

<style scoped lang="scss">
.group-card {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: var(--global-border-radius);
  
  &:hover {
    transform: translateY(-4px);
    }
  
  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    
    .group-info {
      flex: 1;
      
      .group-name {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--el-text-color-primary);
      }
    }
  }
  
  .group-description {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    margin: 0 0 16px;
  }
  
  .group-specs {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    
    .spec-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .spec-label {
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
      
      .spec-value {
        font-size: 15px;
        font-weight: 600;
        color: var(--el-color-primary);
      }
    }
  }
  
  .group-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    
    .app-count {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--el-color-primary);
    }
  }
}
</style>
