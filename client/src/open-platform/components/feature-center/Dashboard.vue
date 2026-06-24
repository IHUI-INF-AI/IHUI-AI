<template>
  <div class="dashboard page-container">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ t('openPlatform.dashboard.title') }}</h1>
        <p class="page-subtitle">{{ t('openPlatform.dashboard.subtitle') }}</p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon">
          <el-icon :size="32"><Document /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.sdks }}</div>
          <div class="stat-label">{{ t('openPlatform.dashboard.sdks') }}</div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon">
          <el-icon :size="32"><Cpu /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.models }}</div>
          <div class="stat-label">{{ t('openPlatform.dashboard.models') }}</div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon">
          <el-icon :size="32"><UserFilled /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.agents }}</div>
          <div class="stat-label">{{ t('openPlatform.dashboard.agents') }}</div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon">
          <el-icon :size="32"><Document /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.apis }}</div>
          <div class="stat-label">{{ t('openPlatform.dashboard.apis') }}</div>
        </div>
      </el-card>
    </div>

    <!-- 快速入口 -->
    <div class="quick-access">
      <h3 class="section-title">{{ t('openPlatform.dashboard.quickAccess.title') }}</h3>
      <div class="access-grid">
        <el-card
          v-for="item in quickAccessItems"
          :key="item.id"
          class="access-card"
          shadow="hover"
          @click="handleQuickAccess(item)"
        >
          <div class="access-icon">
            <el-icon :size="28">
              <component :is="item.icon" />
            </el-icon>
          </div>
          <h4 class="access-title">{{ item.title }}</h4>
          <p class="access-desc">{{ item.description }}</p>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Document, Cpu, UserFilled, Connection, Key } from '@element-plus/icons-vue'
import { getSdks } from '@/api/sdks'
import { getAvailableModels } from '@/api/models'
import { getAgentsList } from '@/api/agents'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const router = useRouter()

// 统计数据
const stats = ref({
  sdks: 0,
  models: 0,
  agents: 0,
  apis: 8, // API 端点数量（固定值）
})

// 快速入口
const quickAccessItems = ref([
  {
    id: 'sdks',
    title: t('openPlatform.dashboard.quickAccess.sdks'),
    description: t('openPlatform.dashboard.quickAccess.sdksDesc'),
    icon: markRaw(Document),
    path: '/open/sdks',
  },
  {
    id: 'models',
    title: t('openPlatform.dashboard.quickAccess.models'),
    description: t('openPlatform.dashboard.quickAccess.modelsDesc'),
    icon: markRaw(Cpu),
    path: '/open/models',
  },
  {
    id: 'agents',
    title: t('openPlatform.dashboard.quickAccess.agents'),
    description: t('openPlatform.dashboard.quickAccess.agentsDesc'),
    icon: markRaw(UserFilled),
    path: '/open/agents',
  },
  {
    id: 'apis',
    title: t('openPlatform.dashboard.quickAccess.apis'),
    description: t('openPlatform.dashboard.quickAccess.apisDesc'),
    icon: markRaw(Connection),
    path: '/open/apis',
  },
  {
    id: 'docs',
    title: t('openPlatform.dashboard.quickAccess.docs'),
    description: t('openPlatform.dashboard.quickAccess.docsDesc'),
    icon: markRaw(Document),
    path: '/open/documents',
  },
  {
    id: 'api-key',
    title: t('openPlatform.dashboard.quickAccess.apiKey'),
    description: t('openPlatform.dashboard.quickAccess.apiKeyDesc'),
    icon: markRaw(Key),
    path: '/key-management',
  },
])

// 加载统计数据
const loadStats = async () => {
  try {
    // 加载 SDK 数量
    const sdksResponse = await getSdks({ page: 1, pageSize: 1 })
    if (sdksResponse.success && sdksResponse.data) {
      stats.value.sdks = sdksResponse.data.pagination?.total || 0
    }

    // 加载模型数量
    const modelsResponse = await getAvailableModels()
    if (modelsResponse.success && modelsResponse.data) {
      stats.value.models = modelsResponse.data.filter(m => m.isAvailable !== false).length
    }

    // 加载智能体数量
    const agentsResponse = await getAgentsList({ page: 1, pageSize: 1 })
    if (agentsResponse.success && agentsResponse.data) {
      stats.value.agents = agentsResponse.data.pagination?.total || 0
    }
  } catch (error) {
    logger.error('[Dashboard] Failed to load statistics data:', error)
  }
}

// 快速入口点击
const handleQuickAccess = (item: { path?: string }) => {
  if (item.path) {
    router.push(item.path)
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped lang="scss">
.dashboard {
  padding: 24px;
}

.page-header {
  margin-bottom: 32px;

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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 40px;

  .stat-card {
    .stat-icon {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--global-border-radius);
      margin-bottom: 16px;
      background-color: var(--el-fill-color-light);
      color: var(--el-text-color-primary);
      transition: background-color 0.3s ease;
    }

    .stat-icon:hover {
      background-color: var(--el-fill-color);
    }

    .stat-content {
      .stat-value {
        font-size: 32px;
        font-weight: 700;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

/* 暗色模式适配 */
:where(html.dark) .stat-card .stat-icon {
  background-color: var(--el-fill-color-darker);
  color: var(--el-text-color-primary);
}

:where(html.dark) :where(.stat-card) :where(.stat-icon:hover) {
  background-color: var(--el-fill-color-dark);
}

.quick-access {
  .section-title {
    margin: 0 0 20px;
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .access-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;

    .access-card {
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--global-box-shadow);
      }

      .access-icon {
        margin-bottom: 16px;
        color: var(--el-color-primary);
      }

      .access-title {
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      .access-desc {
        margin: 0;
        font-size: 14px;
        color: var(--el-text-color-regular);
        line-height: 1.5;
      }
    }
  }
}
</style>
