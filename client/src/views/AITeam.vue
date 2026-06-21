<template>
  <div class="ai-team-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('aiTeam.title') }}</h1>
    </div>

    <div class="search-section">
      <div class="unified-search-bar">
        <el-input
          v-model="searchText"
          :placeholder="t('aiTeam.searchPlaceholder')"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="drawer-section">
        <div class="drawer-toggle" @click="drawerVisible = !drawerVisible">
          <el-icon><Menu /></el-icon>
          <span>{{ t('aiTeam.categories') }}</span>
        </div>

        <div v-show="drawerVisible" class="drawer-content">
          <div
            v-for="item in drawerList"
            :key="item.id"
            class="drawer-item"
            :class="{ active: drawerSelected.id === item.id }"
            @click="handleDrawerClick(item)"
          >
            {{ item.showName }}
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ t('common.loading') }}</span>
      </div>

      <div v-else class="agent-list">
        <div v-if="agentList.length > 0" class="agent-cards">
          <div
            v-for="agent in agentList"
            :key="agent.botId"
            class="agent-card"
            @click="handleAgentClick(agent)"
          >
            <div class="agent-avatar">
              <img :src="agent.avatar || defaultAvatar" alt="Avatar" />
            </div>
            <div class="agent-info">
              <div class="agent-name">{{ agent.agentName ?? agent.name }}</div>
              <div class="agent-desc">{{ agent.description ?? agent.prologue ?? t('aiTeam.noDescription') }}</div>
              <div class="agent-stats">
                <span class="stat-item">
                  <el-icon><Star /></el-icon>
                  {{ agent.likeCount || 0 }}
                </span>
                <span class="stat-item">
                  <el-icon><Collection /></el-icon>
                  {{ agent.collectCount || 0 }}
                </span>
              </div>
            </div>
            <div class="agent-actions">
              <el-button
                :type="agent.isThumbs ? 'warning' : 'default'"
                size="small"
                @click.stop="handleLike(agent)"
              >
                <el-icon><Star /></el-icon>
              </el-button>
              <el-button
                :type="agent.isCollect ? 'success' : 'default'"
                size="small"
                @click.stop="handleCollect(agent)"
              >
                <el-icon><Collection /></el-icon>
              </el-button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <img src="/images/common/empty-box.svg" alt="Empty" class="empty-icon" />
          <p class="empty-text">{{ t('aiTeam.noAgents') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Menu, Loading, Star, Collection } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import { toggleAgentThumbs, toggleAgentCollect, getUserFavorites } from '@/api/agents'
import { category } from '@/services/api'
import type { UserInfoData } from '@/api/user'
import { useApiError } from '@/composables/useApiError'

interface Agent {
  botId: string
  name: string
  description?: string
  avatar?: string
  likeCount?: number
  collectCount?: number
  isThumbs?: number
  isCollect?: number
}

interface DrawerItem {
  id: number
  showName: string
  code: string
}

interface FavoriteItem {
  favoriteId: string
  agentId: string
  agentName: string
  description?: string
  avatar?: string
  price?: number
  collectCount?: number
  downloadCount?: number
  status?: string
  favoriteTime: string
}

interface CategoryItem {
  id: number
  showName: string
  code: string
}

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

const searchText = ref('')
const drawerVisible = ref(false)
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const agentList = ref<Agent[]>([])

const drawerList = ref<DrawerItem[]>([
  { id: 111, showName: t('aiTeam.oldEmployee'), code: 'old' },
  { id: 222, showName: t('aiTeam.newEmployee'), code: 'new' },
])

const drawerSelected = ref<DrawerItem>({ id: 222, showName: t('aiTeam.newEmployee'), code: 'new' })
const code = ref('new')
const _pageSize = ref(10)
const pageNum = ref(1)

const defaultAvatar = '/images/common/userIcon.svg'

const handleSearch = () => {
  pageNum.value = 1
  getData()
}

const handleDrawerClick = (item: DrawerItem) => {
  drawerSelected.value = item
  code.value = item.code
  pageNum.value = 1
  searchText.value = ''
  getData()
}

const handleLike = async (agent: Agent) => {
  try {
    const user = authStore.user as UserInfoData | null
    const uuid = user?.uuid || ''
    await toggleAgentThumbs({ uuid, botId: agent.botId })
    const index = agentList.value.findIndex(a => a.botId === agent.botId)
    if (index !== -1) {
      const currentAgent = agentList.value[index]
      if (currentAgent) {
        currentAgent.isThumbs = currentAgent.isThumbs === 1 ? 0 : 1
        currentAgent.likeCount =
          currentAgent.isThumbs === 1
            ? (currentAgent.likeCount || 0) + 1
            : (currentAgent.likeCount || 0) - 1
      }
    }
    ElMessage.success(t('aiTeam.likeSuccess'))
  } catch (_error) {
    ElMessage.error(t('aiTeam.likeFailed'))
  }
}

const handleCollect = async (agent: Agent) => {
  try {
    const user = authStore.user as UserInfoData | null
    const uuid = user?.uuid || ''
    await toggleAgentCollect({ uuid, botId: agent.botId })
    const index = agentList.value.findIndex(a => a.botId === agent.botId)
    if (index !== -1) {
      const currentAgent = agentList.value[index]
      if (currentAgent) {
        currentAgent.isCollect = currentAgent.isCollect === 0 ? 1 : 0
        currentAgent.collectCount =
          currentAgent.isCollect === 1
            ? (currentAgent.collectCount || 0) + 1
            : (currentAgent.collectCount || 0) - 1
      }
    }
    ElMessage.success(t('aiTeam.collectSuccess'))
  } catch (_error) {
    ElMessage.error(t('aiTeam.collectFailed'))
  }
}

const handleAgentClick = (agent: Agent) => {
   
  router.push({ path: '/ai-assistant', query: { agentId: agent.botId } } as any)
}

const getData = async () => {
  const user = authStore.user as UserInfoData | null
  const uuid = user?.uuid || ''
  if (code.value === 'new') {
    const result = await executeApi(() => getUserFavorites({
      uuid,
      search: searchText.value,
    }))
    if (result) {
      agentList.value = (result || []).map((item: FavoriteItem) => ({
        botId: item.agentId,
        name: item.agentName,
        description: item.description,
        avatar: item.avatar,
        likeCount: 0,
        collectCount: item.collectCount || 0,
        isThumbs: 0,
        isCollect: 1,
      }))
    }
  } else if (code.value === 'old') {
    agentList.value = []
  } else {
    agentList.value = []
  }
}

onMounted(async () => {
  try {
    const categories = await category('1') as { data?: CategoryItem[] }
    if (categories.data && categories.data.length > 0) {
      drawerList.value = drawerList.value.concat(categories.data)
    }
  } catch (error) {
    logger.error('Failed to fetch categories:', error)
  }

  getData()
})
</script>

<style scoped>
.ai-team-page {
  min-height: 100vh;
  background: var(--el-bg-color);
}

.page-header {
  background: var(--el-bg-color);
  padding: 20px;
  box-shadow: var(--global-box-shadow);
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.search-section {
  padding: 16px 20px;
  background: var(--el-bg-color);
}

.search-input {
  width: 100%;
}

.content-wrapper {
  display: flex;
  padding: 20px;
  gap: 20px;
}

.drawer-section {
  width: 200px;
  flex-shrink: 0;
}

.drawer-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.3s;
}

.drawer-toggle:hover {
  background: var(--el-fill-color-light);
}

.drawer-content {
  margin-top: 12px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.drawer-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s;
  border-bottom: var(--unified-border-bottom);
}

.drawer-item:last-child {
  border-bottom: none;
}

.drawer-item:hover {
  background: var(--el-fill-color-light);
}

.drawer-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}

.agent-list {
  flex: 1;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
}

.loading-state .el-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.agent-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.agent-card {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: var(--global-box-shadow);
}

.agent-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--global-box-shadow);
}

.agent-avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.agent-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.agent-info {
  text-align: center;
  margin-bottom: 12px;
}

.agent-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.agent-desc {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.agent-stats {
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.agent-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  width: 120px;
  height: 120px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
}

@media (width <= 768px) {
  .content-wrapper {
    flex-direction: column;
  }

  .drawer-section {
    width: 100%;
  }

  .agent-cards {
    grid-template-columns: 1fr;
  }
}
</style>
