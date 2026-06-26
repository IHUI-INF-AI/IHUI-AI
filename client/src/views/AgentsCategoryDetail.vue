<template>
  <div class="agents-category-detail page-container">
    <header class="agents-category-detail__header">
      <el-button class="back-btn" text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        {{ t('common.back') }}
      </el-button>
      <h1 class="agents-category-detail__title">{{ categoryName }}</h1>
    </header>

    <div v-if="loading" class="agents-category-detail__loading">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <span>{{ t('agents.loading') }}</span>
    </div>

    <div v-else-if="list.length === 0" class="agents-category-detail__empty">
      <el-empty :description="t('agents.noSearchResult')" />
    </div>

    <div v-else class="agents-category-detail__content">
      <div class="agents-category-detail__grid" role="list">
        <div
          v-for="item in list"
          :key="String(item.botId ?? item.agentId ?? item.id)"
          class="agents-category-detail__card-wrapper"
          role="listitem"
          @click="handleAgentClick(item)"
        >
          <div class="agents-category-detail__card glass-card">
            <div class="agents-category-detail__card-header">
              <el-avatar
                :src="item.agentAvatar ?? item.avatar"
                :size="48"
                class="agents-category-detail__avatar"
              >
                <el-icon><Server /></el-icon>
              </el-avatar>
              <div class="agents-category-detail__card-info">
                <span class="agents-category-detail__card-name">
                  {{ item.agentName ?? item.botName ?? item.name ?? '' }}
                </span>
                <p class="agents-category-detail__card-desc">
                  {{ item.agentDescription ?? item.description ?? '' }}
                </p>
                <div v-if="item.creatorName || item.userName" class="agents-category-detail__card-meta">
                  {{ item.creatorName ?? item.userName }}
                </div>
              </div>
            </div>
            <div class="agents-category-detail__card-footer">
              <span class="agents-category-detail__stat">
                {{ t('agents.usageCount') }} {{ numFormat(item.usageCount) }}
              </span>
              <div class="agents-category-detail__actions">
                <button
                  type="button"
                  class="agents-category-detail__action-btn"
                  @click.stop="toggleCollect(item)"
                >
                  <el-icon :class="{ collected: item.isCollect === 1 }">
                    <CollectionFilled v-if="item.isCollect === 1" />
                    <Star v-else />
                  </el-icon>
                </button>
                <button
                  type="button"
                  class="agents-category-detail__action-btn"
                  :class="{ liked: item.isThumbs === 1 }"
                  @click.stop="toggleLike(item)"
                >
                  <el-icon>
                    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                  </el-icon>
                  <span>{{ numFormat(item.likeCount) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasMore && !loadingMore" class="agents-category-detail__more">
        <el-button :loading="loadingMore" @click="loadMore">{{ t('agents.loadMore') }}</el-button>
      </div>
      <div v-else-if="!hasMore && list.length > 0" class="agents-category-detail__nomore">
        {{ t('agents.noMore') || '没有更多了' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Server, Loading, Star, CollectionFilled } from '@/lib/lucide-fallback'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { getAgentList, getAgentCollect, getAgentLike, type AgentInfo } from '@/api/agent/agent-plaza'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

function isLoggedIn(): boolean {
  const userData = StorageManager.getItem<{ uuid?: string }>(STORAGE_KEYS.USER_DATA)
  return !!(userData?.uuid)
}

const categoryName = ref('')
const list = ref<AgentInfo[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)
const TIMEOUT_MS = 10000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function numFormat(n: any): string {
  if (n == null || n === '') return '0'
  const num = Number(n)
  if (Number.isNaN(num)) return '0'
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`
  return String(num)
}

function goBack() {
  ((router as unknown) as { back: () => void }).back()
}

function handleAgentClick(item: AgentInfo) {
  const id = item.botId ?? item.agentId ?? item.id
  if (id) router.push(`/agents/${id}`)
}

/** 收藏：未登录先跳转登录并带回当前页；登录后根据接口返回 message 更新状态 */
async function toggleCollect(item: AgentInfo) {
  if (!isLoggedIn()) {
    router.push({ path: '/login', query: { redirect: ((route as unknown) as { fullPath: string }).fullPath } })
    return
  }
  const id = String(item.botId ?? item.agentId ?? item.id)
  const rec = item as Record<string, unknown>
  try {
    const res = (await getAgentCollect(id)) as { message?: string } | undefined
    const msg = res?.message ?? ''
    rec.isCollect = msg === '收藏成功' ? 1 : 0
    if (msg === '收藏成功') {
      rec.collectCount = (Number(rec.collectCount) || 0) + 1
    } else {
      rec.collectCount = Math.max(0, (Number(rec.collectCount) || 0) - 1)
    }
  } catch {
    ElMessage.warning(t('agents.operateFailed') || '操作失败，请稍后重试')
  }
}

/** 点赞：未登录先跳转登录并带回当前页；登录后根据接口返回 message 更新状态 */
async function toggleLike(item: AgentInfo) {
  if (!isLoggedIn()) {
    router.push({ path: '/login', query: { redirect: ((route as unknown) as { fullPath: string }).fullPath } })
    return
  }
  const id = String(item.botId ?? item.agentId ?? item.id)
  const rec = item as Record<string, unknown>
  try {
    const res = (await getAgentLike(id)) as { message?: string } | undefined
    const msg = res?.message ?? ''
    if (msg === '点赞成功') {
      rec.isThumbs = 1
      rec.likeCount = (Number(rec.likeCount) || 0) + 1
    } else {
      rec.isThumbs = 0
      rec.likeCount = Math.max(0, (Number(rec.likeCount) || 0) - 1)
    }
  } catch {
    ElMessage.warning(t('agents.operateFailed') || '操作失败，请稍后重试')
  }
}

async function loadList(reset: boolean) {
  if (reset) {
    loading.value = true
    list.value = []
    page.value = 1
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  try {
    // 与参考项目 category-detail.vue 一致：同一 bylink 接口，不传分类筛选，用 pageNum 分页，再从 res.data[categoryName] 取当前分类列表
    const res = await withTimeout(
      getAgentList({
        id: '',
        pageNum: page.value,
        pageSize,
        agentCategory: '',
        agentMainCategory: '',
        agentId: '',
      }),
      TIMEOUT_MS
    )

    const raw = res as unknown as { data?: Record<string, AgentInfo[]> } | undefined
    if (!raw || typeof raw !== 'object' || !raw.data) {
      hasMore.value = false
      return
    }
    const data = raw.data as Record<string, AgentInfo[]>
    if (Array.isArray(data)) {
      hasMore.value = false
      return
    }
    const nextList: AgentInfo[] = Array.isArray(data[categoryName.value])
      ? data[categoryName.value]
      : []

    if (reset) {
      list.value = nextList
    } else {
      list.value = list.value.concat(nextList)
    }

    if (nextList.length < pageSize) hasMore.value = false
    else page.value += 1
  } catch {
    hasMore.value = false
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  loadList(false)
}

onMounted(() => {
  const name = route.query.name
  categoryName.value = typeof name === 'string' ? decodeURIComponent(name) : ''
  loadList(true)
})

watch(
  () => route.query.name,
  (name) => {
    categoryName.value = typeof name === 'string' ? decodeURIComponent(name) : ''
    loadList(true)
  }
)
</script>

<style lang="scss" scoped>
.agents-category-detail {
  padding: 20px;
  min-height: 60vh;
}

.agents-category-detail__header {
  margin-bottom: 24px;
}

.back-btn {
  margin-bottom: 8px;
  padding-left: 0;
}

.agents-category-detail__title {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.agents-category-detail__loading,
.agents-category-detail__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--el-text-color-secondary);
}

.agents-category-detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.agents-category-detail__card-wrapper {
  cursor: pointer;
  border-radius: var(--global-border-radius);
  transition: transform 0.2s;

  &:hover {
    
  }
}

.agents-category-detail__card {
  padding: 16px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.agents-category-detail__card-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.agents-category-detail__avatar {
  flex-shrink: 0;
}

.agents-category-detail__card-info {
  flex: 1;
  min-width: 0;
}

.agents-category-detail__card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: block;
  margin-bottom: 4px;
}

.agents-category-detail__card-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin: 0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agents-category-detail__card-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.agents-category-detail__card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: var(--unified-border);
}

.agents-category-detail__stat {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.agents-category-detail__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agents-category-detail__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--global-border-radius);
  transition: color 0.2s;

  &:hover {
    color: var(--el-color-primary);
  }

  .collected {
    color: var(--el-color-warning);
  }

  &.liked,
  &.liked :deep(svg) {
    color: var(--el-color-danger);
  }
}

.agents-category-detail__more,
.agents-category-detail__nomore {
  text-align: center;
  padding: 24px 0;
}

.agents-category-detail__nomore {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
