<template>
  <div class="agents-hub page-container">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ t('openPlatform.agents.title') }}</h1>
        <p class="page-subtitle">{{ t('openPlatform.agents.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="goToAgentsMarket">
          <el-icon><View /></el-icon>
          {{ t('openPlatform.agents.viewAll') }}
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filters-section">
      <div class="unified-search-input-wrap">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('openPlatform.agents.searchPlaceholder')"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>
      </div>
      <el-select
        v-model="selectedCategory"
        :placeholder="t('openPlatform.agents.filterCategory')"
        clearable
        class="category-select"
        @change="handleSearch"
      >
        <el-option
          v-for="category in categories"
          :key="category.id"
          :label="category.name"
          :value="category.id"
        />
      </el-select>
      <el-select
        v-model="selectedPlatform"
        :placeholder="t('openPlatform.agents.filterPlatform')"
        clearable
        class="platform-select"
        @change="handleSearch"
      >
        <el-option :label="t('hardcoded.agents_hub.全部平台')" value="" />
        <el-option :label="t('agents.platformCoze')" value="coze" />
        <el-option label="N8N" value="n8n" />
        <el-option label="Dify" value="dify" />
        <el-option label="Make" value="make" />
        <el-option label="Dashscope" value="dashscope" />
        <el-option :label="t('hardcoded.agents_hub.内部1')" value="internal" />
      </el-select>
    </div>

    <!-- 智能体列表 -->
    <div class="agents-content">
      <el-empty
        v-if="!loading && agents.length === 0"
        :description="t('openPlatform.agents.noAgents')"
        :image-size="120"
      />
      <div v-else class="agents-grid">
        <el-card
          v-for="agent in agents"
          :key="String(agent.id)"
          class="agent-card"
          shadow="hover"
          @click="handleAgentClick(agent)"
        >
          <div class="agent-header">
            <div class="agent-avatar">
              <el-avatar :size="48" :src="agent.avatar" :icon="UserFilled" />
            </div>
            <div class="agent-info">
              <h3 class="agent-name">{{ agent.agentName ?? agent.name }}</h3>
              <p class="agent-description">{{ agent.description ?? agent.prologue ?? t('openPlatform.agents.noDescription') }}</p>
            </div>
          </div>
          <div class="agent-meta">
            <el-tag v-if="agent.category" size="small" type="info">{{ agent.category }}</el-tag>
            <el-tag v-if="agent.platform" size="small">{{ agent.platform }}</el-tag>
            <span class="agent-usage">{{ t('openPlatform.agents.usageCount') }}: {{ agent.usageCount || 0 }}</span>
          </div>
          <div class="agent-footer">
            <el-button size="small" type="primary" @click.stop="handleUseAgent(agent)">
              <el-icon><VideoPlay /></el-icon>
              {{ t('openPlatform.agents.use') }}
            </el-button>
            <el-button size="small" @click.stop="handleViewDetail(agent)">
              <el-icon><View /></el-icon>
              {{ t('openPlatform.agents.detail') }}
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[12, 24, 48]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { View, UserFilled, VideoPlay } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { getAgentsList, getAgentCategories, type Agent, type AgentCategory } from '@/api/agents'
import { logger } from '@/utils/logger'
import { usePagination } from '@/composables/user/usePagination'

const { t } = useI18n()
const router = useRouter()

// 状态
const agents = ref<Agent[]>([])
const categories = ref<AgentCategory[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const selectedCategory = ref<string>('')
const selectedPlatform = ref<string>('')

// 分页
const { pagination, handlePageChange, handlePageSizeChange } = usePagination({
  initialPage: 1,
  initialPageSize: 12,
  onPageChange: async () => {
    await loadAgents()
  },
  onPageSizeChange: async () => {
    await loadAgents()
  },
})

// 加载分类
const loadCategories = async () => {
  try {
    const response = await getAgentCategories()
    if (response.success && response.data) {
      categories.value = response.data
    }
  } catch (error) {
    logger.error('[AgentsHub] Failed to load categories:', error)
  }
}

// 加载智能体列表
const loadAgents = async () => {
  loading.value = true
  try {
    const response = await getAgentsList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      category: selectedCategory.value || undefined,
       
      platform: selectedPlatform.value as any,
      sortBy: 'usageCount',
      sortOrder: 'desc',
    })

    if (response.success && response.data) {
      agents.value = response.data.list || []
      pagination.total = response.data.pagination?.total || 0
    } else {
      ElMessage.error(response.message || t('openPlatform.agents.loadFailed'))
    }
  } catch (error) {
    logger.error('[AgentsHub] Failed to load agent list:', error)
    ElMessage.error(t('openPlatform.agents.loadFailed'))
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadAgents()
}

// 智能体操作
const handleAgentClick = (agent: Agent) => {
  router.push(`/agents/${String(agent.id)}`)
}

const handleUseAgent = (agent: Agent) => {
  router.push(`/agents/${String(agent.id)}`)
}

const handleViewDetail = (agent: Agent) => {
  router.push(`/agents/${String(agent.id)}`)
}

const goToAgentsMarket = () => {
  router.push('/agents')
}

onMounted(() => {
  loadCategories()
  loadAgents()
})
</script>

<style scoped lang="scss">
.agents-hub {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-content {
    .page-title {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 700;
      color: var(--el-text-color-primary);
    }

    .page-subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
  }
}

.filters-section {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;

  .search-input {
    flex: 1;
    max-width: 400px;
  }

  .category-select,
  .platform-select {
    width: 150px;
  }
}

.agents-content {
  .agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  .agent-card {
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: var(--global-box-shadow);
    }

    .agent-header {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;

      .agent-avatar {
        flex-shrink: 0;
      }

      .agent-info {
        flex: 1;
        min-width: 0;

        .agent-name {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .agent-description {
          margin: 0;
          font-size: 14px;
          color: var(--el-text-color-regular);
          line-height: 1.5;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      }
    }

    .agent-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: var(--unified-border-bottom);

      .agent-usage {
        margin-left: auto;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    .agent-footer {
      display: flex;
      gap: 8px;
    }
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }
}
</style>
