<template>
  <div class="function-block-container">
    <div
      v-for="(item, index) in functionList"
      :key="index"
      class="function-card"
      @click="handleNavigate(item.url, item.title)"
    >
      <div class="card-content">
        <div class="icon-container">
          <img v-if="item.iconSrc" :src="item.iconSrc" :alt="item.title" class="icon" />
          <el-icon v-else :size="48"><component :is="item.icon" /></el-icon>
        </div>
        <div class="text-container">
          <div class="title">{{ item.title }}</div>
          <div class="subtitle">{{ item.subtitle }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Users, FileText, User } from '@/lib/lucide-fallback'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import type { Component } from 'vue'

interface FunctionItem {
  title: string
  subtitle: string
  iconSrc?: string
  icon?: Component
  url: string
}

const { t } = useI18n()
const router = useRouter()
const { showInfo } = useOperationFeedback()

const functionList: FunctionItem[] = [
  {
    title: t('distribution.functionBlock.companyTeam'),
    subtitle: t('distribution.functionBlock.viewCompanyTeam'),
    icon: Users,
    url: '/distribution/team',
  },
  {
    title: t('distribution.functionBlock.aiTeam'),
    subtitle: t('distribution.functionBlock.viewAITeam'),
    icon: Users,
    url: '/ai-team',
  },
  {
    title: t('distribution.functionBlock.myCard'),
    subtitle: t('distribution.functionBlock.viewMyInfo'),
    icon: User,
    url: '/business-card',
  },
  {
    title: t('distribution.functionBlock.myQRCode'),
    subtitle: t('distribution.functionBlock.promoteQRCode'),
    icon: FileText,
    url: '',
  },
  {
    title: t('distribution.functionBlock.distributionOrders'),
    subtitle: t('distribution.functionBlock.viewDistributionOrders'),
    icon: FileText,
    url: '/distribution/orders',
  },
]

const emit = defineEmits<{
  showQRCode: []
}>()

const handleNavigate = (url: string, title: string) => {
  if (title === t('distribution.functionBlock.myQRCode')) {
    emit('showQRCode')
    return
  }
  if (url) {
    router.push(url).catch(err => {
      logger.error('[FunctionBlockColumn] Navigation failed', {
        error: err instanceof Error ? err.message : String(err),
        url,
        title,
      })
      showInfo(t('distribution.functionBlock.navigateFailed'))
    })
  }
}
</script>

<style scoped lang="scss">
.function-block-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 20px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
}

.function-card {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--el-bg-color-hover);
    transform: translateY(-2px);
  }
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-container {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: var(--el-fill-color);
  border-radius: var(--global-border-radius);
}

.icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.text-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
</style>
