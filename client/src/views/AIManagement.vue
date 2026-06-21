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

      <el-col :span="16">
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
.ai-management-container {
  padding: 20px;
  width: 100%;
  margin: 0 auto;
}

.ai-management-header {
  margin-bottom: 24px;
  text-align: center;

  .page-title {
    font-size: 32px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--el-text-color-primary);
  }

  .page-subtitle {
    font-size: 16px;
    color: var(--el-text-color-regular);
  }
}

.agent-manager-card,
.agent-chat-card {
  height: calc(100vh - 200px);
  min-height: 600px;

  :deep(.el-card__body) {
    height: calc(100% - 57px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
</style>
