<template>
  <div class="n8n-agents-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Workflow /></el-icon>
        {{ t('n8nAgents.title') }}
      </h1>
      <p class="page-subtitle">{{ t('n8nAgents.subtitle') }}</p>
    </div>

    <!-- 创建按钮 -->
    <div class="action-section radius-auto">
      <el-button type="primary" size="large" @click="createN8NAgent">
        <el-icon><Plus /></el-icon>
        {{ t('n8nAgents.createN8NAgent') }}
      </el-button>
    </div>

    <!-- N8N智能体列表（复用Agents.vue的结构） -->
    <div class="agents-section radius-auto">
      <GlobalLoading v-if="loading" />
      <el-empty v-else-if="agentsList.length === 0" :description="t('n8nAgents.noAgents')" />
      <div v-else class="agents-grid">
        <AgentCard
          v-for="agent in agentsList"
          :key="agent.id"
          :agent="agent"
          @click="viewAgentDetail(agent.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Workflow, Plus } from '@/lib/lucide-fallback'
import GlobalLoading from '@/components/common/GlobalLoading.vue'
import AgentCard from '@/components/agents/AgentCard.vue'
import { getN8NAgents } from '@/api/n8n-agents'
import { useI18n } from 'vue-i18n'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const router = useRouter()

const { loading, execute: executeApi } = useApiError({ showMessage: true })
const agentsList = ref<unknown[]>([])

// 加载N8N智能体列表
const loadN8NAgents = async () => {
  const data = await executeApi(() => getN8NAgents())
  if (data !== null && typeof data === 'object') {
    const listData = data as { list?: any[] }
    agentsList.value = listData.list || []
  }
}

// 创建N8N智能体
const createN8NAgent = () => {
  router.push('/agents/create?type=n8n')
}

// 查看智能体详情
const viewAgentDetail = (agentId: string) => {
  router.push(`/agents/${agentId}`)
}

// 页面加载
onMounted(() => {
  loadN8NAgents()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.n8n-agents-page {
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (width <= $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.action-section,
.agents-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
</style>
