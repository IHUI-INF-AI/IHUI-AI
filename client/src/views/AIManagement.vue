<template>
  <div class="ai-management-container page-container">
    <div class="ai-management-header">
      <h1 class="page-title">{{ t('aiManagement.title') }}</h1>
      <p class="page-subtitle">{{ t('aiManagement.subtitle') }}</p>
    </div>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="agent-manager-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('aiManagement.agentList') }}</span>
            </div>
          </template>
          <AgentManager @agent-selected="handleAgentSelected" />
        </el-card>
      </el-col>

      <el-col :span="16" :xs="24">
        <el-card class="agent-chat-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('aiManagement.aiChat') }}</span>
              <el-button v-if="selectedAgentId" link size="small" @click="clearSelection">
                {{ t('aiManagement.clearSelection') }}
              </el-button>
            </div>
          </template>
          <AIChat 
            v-if="selectedAgentId" 
            mode="embedded" 
            ai-mode="agent" 
            :agent-id="selectedAgentId" 
            :key="selectedAgentId"
            :show-header="true"
            :show-minimize="false"
            :show-close="false"
            :draggable="false"
            :resizable="false"
          />
          <el-empty v-else :description="t('aiManagement.selectAgentHint')" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
 
import { ref, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentManager from '@/components/ai/AgentManager.vue'
const AIChat = defineAsyncComponent(() => import('@/components/ai/AIChat.vue'))

const { t } = useI18n()
const selectedAgentId = ref<string | null>(null)

const handleAgentSelected = (agentId: string) => {
  selectedAgentId.value = agentId
}

const clearSelection = () => {
  selectedAgentId.value = null
}
</script>

<style lang="scss" scoped>
/* 页面容器 */
.ai-management-container {
  padding: var(--spacing-xl) var(--spacing-lg);
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* 页面头部 - 左对齐，中文字体，加粗 */
.ai-management-header {
  margin-bottom: var(--spacing-lg);
  text-align: left;

  .page-title {
    font-size: 32px;
    font-weight: 700;
    font-family: var(--font-family-chinese);
    margin-bottom: var(--spacing-sm);
    color: var(--el-text-color-primary);
    line-height: 1.3;
  }

  .page-subtitle {
    font-size: 16px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }
}

/* 卡片头部 - 加粗 + 底部分隔线 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-family: var(--font-family-chinese);
  font-size: 16px;
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--unified-border-bottom);
}

/* 统一卡片样式 - 边框、圆角 */
.agent-manager-card,
.agent-chat-card {
  height: calc(100vh - 200px);
  min-height: 600px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  :deep(.el-card__header) {
    padding: var(--spacing-md);
    border-bottom: var(--unified-border-bottom);
    background-color: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius) var(--global-border-radius) 0 0;
  }

  :deep(.el-card__body) {
    height: calc(100% - 57px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-md);
  }
}

/* 空状态提示样式增强 */
:deep(.el-empty) {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl) 0;

  .el-empty__description p {
    font-family: var(--font-family-chinese);
    font-size: 14px;
    color: var(--el-text-color-placeholder);
  }

  .el-empty__image svg {
    color: var(--el-text-color-disabled);
  }
}

/* 清除选择按钮交互状态 */
.card-header :deep(.el-button--text),
.card-header :deep(.el-button.is-link) {
  font-weight: 500;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--global-border-radius);
  transition: color 0.2s ease, background-color 0.2s ease;

  &:hover {
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color);
  }

  &:active {
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color-dark);
  }
}

/* 左侧 AgentManager 卡片内部滚动条 */
.agent-manager-card :deep(.el-card__body) {
  overflow-y: auto;
}

/* 右侧聊天卡片内部 Element Plus 组件微调 */
.agent-chat-card :deep(.el-card__body) {
  overflow: hidden;
}

/* 响应式 - 平板竖屏：调整比例 */
@media (width <= 1279px) {
  .agent-manager-card,
  .agent-chat-card {
    height: auto;
    min-height: 500px;
  }
}

/* 响应式 - 移动端单列布局 */
@media (width <= 767px) {
  .ai-management-container {
    padding: var(--spacing-md);
  }

  .ai-management-header {
    margin-bottom: var(--spacing-md);

    .page-title {
      font-size: 24px;
    }

    .page-subtitle {
      font-size: 14px;
    }
  }

  .agent-manager-card,
  .agent-chat-card {
    height: auto;
    min-height: 400px;
    margin-bottom: var(--spacing-md);
  }

  /* 移动端两列变单列通过 template 的 :span 处理，
     此处补充卡片高度自适应 */
  .agent-manager-card :deep(.el-card__body),
  .agent-chat-card :deep(.el-card__body) {
    height: auto;
    min-height: 300px;
  }

  .card-header {
    font-size: 14px;
  }
}
</style>
