<template>
  <div class="agents-empty-state agents-square-list scroll-reveal scroll-animated animate-fadeInUp">
    <!-- 工具栏：使用 sticky 固定在内容区顶部，不随列表滚动，避免 Teleport 在异步更新时导致 DOM 错误 -->
    <div class="agents-square-list__toolbar">
      <div class="agents-square-list__search-wrap">
        <el-input v-model="searchKeyword" :placeholder="t('agents.searchPlaceholder')" clearable
          class="agents-square-list__search" @keyup.enter="onSearch" @clear="onSearch">
          <template #prefix>
            <SearchIcon />
          </template>
          <template #append>
            <button type="button" class="search-bar-append-btn" @click="onSearch">
              {{ t('common.search') }}
            </button>
          </template>
        </el-input>
      </div>
      <div v-if="displayMainCategories.length > 0" class="agents-square-list__tabs">
        <button v-for="(cat, idx) in displayMainCategories" :key="cat.id === 'all' ? 'main-all' : (cat.id ?? idx)"
          type="button" class="btn-tab" :class="{ 'btn-tab--active': activeMainId === (cat.id ?? '') }"
          @click="selectMainCategory(cat)">
          {{ cat.name }}
        </button>
      </div>
      <div v-if="displaySubCategories.length > 0" class="agents-square-list__sub-tabs">
        <button v-for="(cat, idx) in displaySubCategories" :key="idx === 0 ? 'sub-all' : (cat.id ?? idx)" type="button"
          class="btn-tab btn-tab--sub" :class="{ 'btn-tab--active': activeSubId === (cat.id ?? '') }"
          @click="selectSubCategory(cat)">
          {{ cat.name }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="agents-square-list__loading">
      <el-icon class="is-loading" :size="32">
        <Loading />
      </el-icon>
      <span>{{ t('agents.loading') }}</span>
    </div>

    <div v-else-if="hasError" class="agents-square-list__loading">
      <span>{{ t('common.errors.loadFailed') }}</span>
      <button type="button" class="agents-square-list__section-more" @click="loadList(true)">{{ t('common.retry') }}</button>
    </div>

    <template v-else>
      <div v-if="hasAnyList" class="agents-square-list__content">
        <section v-for="(list, categoryName) in categorizedList" :key="categoryName"
          class="agents-square-list__section">
          <div class="agents-square-list__section-head">
            <h4 class="agents-square-list__section-title">{{ categoryName }}</h4>
            <button type="button" class="agents-square-list__section-more"
              @click="navigateToCategoryDetail(categoryName)">
              {{ t('agents.viewMore') }}
              <el-icon class="agents-square-list__section-more-icon">
                <ChevronRight />
              </el-icon>
            </button>
          </div>
          <div class="agents-square-list__grid" role="list">
            <div v-for="item in list" :key="String(item.botId ?? item.agentId ?? item.id)"
              class="agents-square-list__card-wrapper" role="listitem" @click="handleAgentClick(item)">
              <div class="agents-square-list__card glass-card">
                <div class="agents-square-list__card-header">
                  <el-avatar :src="item.agentAvatar ?? item.avatar" :size="48" class="agents-square-list__avatar">
                    <el-icon>
                      <Server />
                    </el-icon>
                  </el-avatar>
                  <div class="agents-square-list__card-info">
                    <span class="agents-square-list__card-name">
                      {{ item.agentName ?? item.botName ?? item.name ?? '' }}
                    </span>
                    <p class="agents-square-list__card-desc">
                      {{ item.agentDescription ?? item.description ?? '' }}
                    </p>
                  </div>
                </div>
                <div v-if="(item.creatorName || item.userName || item.userNickname) || categoryTags(item, categoryName).length"
                  class="agents-square-list__card-meta-row">
                  <div v-if="item.creatorName || item.userName || item.userNickname"
                    class="agents-square-list__card-meta">
                    <el-avatar
                      :src="(item as { creatorAvatar?: string; userAvatar?: string; creator_avatar?: string; user_avatar?: string }).creatorAvatar ?? (item as { userAvatar?: string }).userAvatar ?? (item as { creator_avatar?: string }).creator_avatar ?? (item as { user_avatar?: string }).user_avatar"
                      :size="20"
                      class="agents-square-list__card-meta-avatar"
                    >
                      <el-icon><User /></el-icon>
                    </el-avatar>
                    <span class="agents-square-list__card-meta-text">{{ item.creatorName ?? item.userName ?? item.userNickname }}</span>
                  </div>
                  <div v-if="categoryTags(item, categoryName).length" class="agents-square-list__card-tags">
                    <span v-for="tag in categoryTags(item, categoryName)" :key="tag" class="agents-square-list__tag">{{ tag
                    }}</span>
                  </div>
                </div>
                <div class="agents-square-list__card-footer">
                  <div class="agents-square-list__stat">
                    <span class="agents-square-list__usage-count">
                      <el-icon class="agents-square-list__usage-icon">
                        <!-- is_top 为 1 显示 hot.png，否则显示 useNum.png -->
                        <img v-if="item.is_top === 1" src="https://file.aizhs.top/sys-mini/default/hot.png" alt="hot"
                          style="width: 1em; height: 1em; display: block;" loading="lazy" />
                        <Users v-else />
                      </el-icon>
                      {{ numFormat(item.usageCount) }}
                    </span>
                  </div>
                  <div class="agents-square-list__actions" @click.stop.prevent>
                    <span class="agents-square-list__action-btn" :class="{ collected: item.isCollect === 1 }"
                      :title="item.isCollect === 1 ? t('agents.unfavorite') : t('agents.favorite')"
                      role="button" tabindex="0" @click.stop.prevent="toggleCollect(item)"
                      @keydown.enter.prevent="toggleCollect(item)" @keydown.space.prevent="toggleCollect(item)">
                      <el-icon :class="{ collected: item.isCollect === 1 }">
                        <!-- 收藏选中状态使用本地图 choucang_active.png，未选中仍然使用星星图标 -->
                        <img v-if="item.isCollect === 1" :src="choucangActive" alt="collected"
                          style="width: 1em; height: 1em; display: block;" loading="lazy" />
                        <Star v-else />
                      </el-icon>
                      <span>{{ numFormat(item.collectCount ?? 0) }}</span>
                    </span>
                    <span class="agents-square-list__action-btn" :class="{ liked: item.isThumbs === 1 }"
                      :title="t('agents.like')" role="button" tabindex="0"
                      @click.stop.prevent="toggleLike(item)"
                      @keydown.enter.prevent="toggleLike(item)" @keydown.space.prevent="toggleLike(item)">
                      <el-icon>
                        <!-- 点赞选中状态使用本地图 like_active.png，未选中仍然使用空心心形 SVG -->
                        <img v-if="item.isThumbs === 1" :src="likeActive" alt="liked"
                          style="width: 1em; height: 1em; display: block;" loading="lazy" />
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round">
                          <path
                            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      </el-icon>
                      <span>{{ numFormat(item.likeCount ?? 0) }}</span>
                    </span>
                  </div>
                  <button type="button" class="agents-square-list__use-btn" @click.stop="handleUseAgent(item)">
                    {{ t('agents.usageCount') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div v-else class="agents-square-list__empty-inner">
        <p>{{ searchKeyword ? t('agents.noSearchResult') : t('agents.emptyDescription') }}</p>
      </div>

      <div v-if="hasAnyList && hasMore && !loading" class="agents-square-list__more">
        <el-button :loading="loadingMore" @click="loadMore">{{ t('agents.loadMore') }}</el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { Server, Loading, Star, ChevronRight, Users, User } from '@/lib/lucide-fallback'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { useLoginDialog } from '@/composables/useLoginDialog'
import {
  getAgentList,
  categories as fetchCategories,
  getAgentCollect,
  getAgentLike,
  type AgentInfo,
} from '@/api/payment'
import type { Agent } from '@/api/agents'
import choucangActive from '@/assets/images/choucang_active.png'
import likeActive from '@/assets/images/like_active.png'

interface CategoryItem {
  id?: string
  name: string
  [key: string]: unknown
}

interface CategoriesData {
  agentMainCategory?: CategoryItem[]
  agentCategory?: CategoryItem[]
}

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

function isLoggedIn(): boolean {
  const userData = StorageManager.getItem<{ uuid?: string }>(STORAGE_KEYS.USER_DATA)
  return !!(userData?.uuid)
}

const emit = defineEmits<{
  (e: 'create'): void
  (e: 'clearFilters'): void
  (e: 'update:total', total: number): void
}>()

const searchKeyword = ref('')
const activeMainId = ref('')
const activeSubId = ref('')
const mainCategories = ref<CategoryItem[]>([])
const subCategories = ref<CategoryItem[]>([])
/** 主分类展示列表：前面加「全部」 */
const displayMainCategories = computed<CategoryItem[]>(() => {
  const allItem: CategoryItem = { id: 'all', name: t('common.all') }
  return [allItem, ...mainCategories.value]
})
/** 子分类展示列表：前面加「全部」 */
const displaySubCategories = computed<CategoryItem[]>(() => {
  const allItem: CategoryItem = { id: '', name: t('common.all') }
  return [allItem, ...subCategories.value]
})
const squareList = ref<Record<string, AgentInfo[]>>({})
const loading = ref(true)
const hasError = ref(false)
const loadingMore = ref(false)
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)
const SQUARE_LIST_TIMEOUT_MS = 10000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/** 从单条接口数据取主/子分类名，用于卡片标签展示 */
/** 创作者/用户头像 URL，兼容后端 camelCase / snake_case */
function _creatorAvatarUrl(item: AgentInfo): string | undefined {
  const r = item as Record<string, unknown>
  return (r.creatorAvatar ?? r.userAvatar ?? r.creator_avatar ?? r.user_avatar) as string | undefined
}

/** 从单条数据或当前 section 取分类名作为标签，兼容后端 camelCase / snake_case */
function categoryTags(item: AgentInfo, sectionName?: string): string[] {
  const tags: string[] = []
  const r = item as Record<string, unknown>
  const mainList = (r.agentMainCategory ?? r.agent_main_category) as CategoryItem[] | undefined
  const subList = (r.agentCategory ?? r.agent_category) as CategoryItem[] | undefined
  const main = mainList?.[0]?.name
  const sub = subList?.[0]?.name
  if (main) tags.push(main)
  if (sub && sub !== main) tags.push(sub)
  if (tags.length === 0 && sectionName) tags.push(sectionName)
  return tags
}

const hasAnyList = computed(() => {
  const list = categorizedList.value
  return Object.keys(list).some(k => list[k].length > 0)
})

/** 当前展示的智能体总数（供父组件 page-meta 使用） */
const totalCount = computed(() => {
  const list = categorizedList.value
  return Object.values(list).reduce((s, arr) => s + (arr?.length ?? 0), 0)
})

const categorizedList = computed(() => {
  const raw = squareList.value
  const keyword = (searchKeyword.value || '').trim().toLowerCase()
  if (keyword) {
    const all: AgentInfo[] = []
    for (const arr of Object.values(raw)) {
      if (Array.isArray(arr)) all.push(...arr)
    }
    const filtered = all.filter(item => {
      const name = String(item.agentName ?? item.name ?? '')
      const desc = String(item.agentDescription ?? item.description ?? '')
      return name.toLowerCase().includes(keyword) || desc.toLowerCase().includes(keyword)
    })
    return filtered.length ? { [t('agents.searchResult')]: filtered } : {}
  }
  // 过滤空分类（接口 data 中如 "AI+法律": [] 不展示）
  const result: Record<string, AgentInfo[]> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v) && v.length > 0) result[k] = v
  }
  return result
})

onMounted(() => {
  loadCategories()
  loadList(true)
})

watch(totalCount, (n) => {
  emit('update:total', n)
}, { immediate: true })

watch([activeMainId, activeSubId], () => {
  page.value = 1
  hasMore.value = true
  squareList.value = {}
  loadList(true)
})

async function loadCategories() {
  try {
    const res = await withTimeout(fetchCategories(), SQUARE_LIST_TIMEOUT_MS)
    const data = res?.data as CategoriesData | CategoryItem[] | undefined
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      mainCategories.value = Array.isArray(data.agentMainCategory) ? data.agentMainCategory : []
      subCategories.value = Array.isArray(data.agentCategory) ? data.agentCategory : []
      if (mainCategories.value.length && !activeMainId.value) {
        activeMainId.value = 'all'
      }
      if (subCategories.value.length && activeSubId.value === undefined) {
        activeSubId.value = ''
      }
    } else {
      mainCategories.value = []
      subCategories.value = []
    }
  } catch {
    mainCategories.value = []
    subCategories.value = []
  }
}

/** 与参考 index.vue getAgentList 一致：id、pageNum、pageSize、agentCategory、agentMainCategory、agentId */
async function loadList(reset: boolean) {
  if (reset) {
    loading.value = true
    hasError.value = false
    squareList.value = {}
    page.value = 1
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const fenlei_active_id =
      typeof activeMainId.value === 'string'
        ? activeMainId.value === 'all'
          ? ''
          : activeMainId.value
        : ''

    const res = await withTimeout(
      getAgentList({
        id: '',
        pageNum: page.value,
        pageSize,
        agentCategory: activeSubId.value || undefined,
        agentMainCategory: fenlei_active_id,
        agentId: '',
        keyword: searchKeyword.value.trim() || undefined,
      }),
      SQUARE_LIST_TIMEOUT_MS
    )

    // 兼容多种接口返回：res 为数组 | res.data 为数组 | res.data.list 为数组 | res.data 为分类对象
    const raw = res as unknown as { data?: { list?: AgentInfo[] } | AgentInfo[] | Record<string, AgentInfo[]> } | AgentInfo[] | undefined
    let data: Record<string, AgentInfo[]> | AgentInfo[] | null = null
    if (Array.isArray(raw)) {
      data = raw as AgentInfo[]
    } else if (raw && typeof raw === 'object') {
      const d = raw.data as unknown
      if (Array.isArray(d)) {
        data = d as AgentInfo[]
      } else if (d && typeof d === 'object' && !Array.isArray(d)) {
        const list = (d as Record<string, unknown>).list
        if (Array.isArray(list)) {
          data = list as AgentInfo[]
        } else {
          data = d as Record<string, AgentInfo[]>
        }
      }
    }
    if (!data) {
      hasMore.value = false
      return
    }

    let next: Record<string, AgentInfo[]> = {}
    if (Array.isArray(data)) {
      data.forEach((item: AgentInfo) => {
        const r = item as Record<string, unknown>
        const mainList = (r.agentMainCategory ?? r.agent_main_category) as CategoryItem[] | undefined
        const subList = (r.agentCategory ?? r.agent_category) as CategoryItem[] | undefined
        const mainCat = mainList?.[0]?.name
        const subCat = subList?.[0]?.name
        const category = mainCat ?? subCat ?? t('agents.agent')
        if (!next[category]) next[category] = []
        next[category].push(item)
      })
    } else if (typeof data === 'object' && data !== null) {
      next = data as Record<string, AgentInfo[]>
    }

    if (reset) {
      squareList.value = { ...next }
    } else {
      for (const [k, v] of Object.entries(next)) {
        const key = String(k)
        if (!squareList.value[key]) squareList.value[key] = []
        squareList.value[key].push(...(v || []))
      }
    }

    const totalInPage = Object.values(next).reduce((s, arr) => s + (arr?.length ?? 0), 0)
    if (totalInPage < pageSize) hasMore.value = false
    else page.value += 1
  } catch {
    hasMore.value = false
    if (reset) hasError.value = true
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  loadList(false)
}

function onSearch() {
  page.value = 1
  hasMore.value = true
  squareList.value = {}
  loadList(true)
}

function selectMainCategory(cat: CategoryItem) {
  activeMainId.value = cat.id ?? 'all'
}

function selectSubCategory(cat: CategoryItem) {
  activeSubId.value = cat.id ?? ''
}

function numFormat(n: unknown): string {
  if (n == null || n === '') return '0'
  const num = Number(n)
  if (Number.isNaN(num)) return '0'
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`
  return String(num)
}

function _handleCreate() {
  emit('create')
}

function _handleClearFilters() {
  searchKeyword.value = ''
  activeMainId.value = 'all'
  activeSubId.value = ''
  emit('clearFilters')
}

function getCategoryIdByName(name: string): string {
  const main = mainCategories.value.find(c => (c.name ?? '') === name)
  if (main?.id) return String(main.id)
  const sub = subCategories.value.find(c => (c.name ?? '') === name)
  return sub?.id ? String(sub.id) : ''
}

function navigateToCategoryDetail(categoryName: string) {
  const categoryId = getCategoryIdByName(categoryName)
  router.push({
    path: '/agents/category',
    query: { name: categoryName, id: categoryId || undefined },
  })
}

function handleAgentClick(item: AgentInfo) {
  const id = item.botId ?? item.agentId ?? item.id
  if (id) router.push(`/agents/${id}`)
}

/** 使用智能体：打开浮窗聊天并选中该智能体 */
function handleUseAgent(item: AgentInfo) {
  // 将 AgentInfo 转换为 Agent 类型
  const agentId = item.botId ?? item.agentId ?? item.id ?? ''
  const agent = {
    id: agentId,
    name: item.agentName ?? item.botName ?? item.name,
    agentName: item.agentName ?? item.botName ?? item.name,
    description: item.agentDescription ?? item.description,
    avatar: item.agentAvatar ?? item.avatar,
    botId: agentId,
    cozeBotId: agentId,
  } as Agent

  // 通过自定义事件打开浮窗聊天并选中智能体
  if (typeof window !== 'undefined') {
    // 先打开浮窗聊天对话框
    window.dispatchEvent(
      new CustomEvent('open-ai-chat', {
        detail: { mode: 'agent' },
      })
    )

    // 延迟选中智能体，确保浮窗已打开
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('select-agent', {
          detail: { agent },
        })
      )
    }, 100)
  }
}

/** 收藏：与参考项目一致，根据接口返回 message 更新 isCollect / collectCount；未登录先跳转登录并带回当前页 */
async function toggleCollect(item: AgentInfo) {
  if (!isLoggedIn()) {
    useLoginDialog().open('login', ((route as unknown) as { fullPath: string }).fullPath)
    return
  }
  const id = String(item.botId ?? item.agentId ?? item.id)
  const rec = item as Record<string, unknown>
  try {
    const res = (await getAgentCollect(id)) as { message?: string } | undefined
    const msg = res?.message ?? ''
    if (msg === t('agents.collectSuccess')) {
      rec.isCollect = 1
      rec.collectCount = (Number(rec.collectCount) || 0) + 1
    } else {
      rec.isCollect = 0
      rec.collectCount = Math.max(0, (Number(rec.collectCount) || 0) - 1)
    }
  } catch {
    ElMessage.warning(t('agents.operateFailed'))
  }
}

/** 点赞：与参考项目一致，根据接口返回 message 更新 isThumbs / likeCount；未登录先跳转登录并带回当前页 */
async function toggleLike(item: AgentInfo) {
  if (!isLoggedIn()) {
    useLoginDialog().open('login', ((route as unknown) as { fullPath: string }).fullPath)
    return
  }
  const id = String(item.botId ?? item.agentId ?? item.id)
  const rec = item as Record<string, unknown>
  try {
    const res = (await getAgentLike(id)) as { message?: string } | undefined
    const msg = res?.message ?? ''
    if (msg === t('agents.likeSuccess')) {
      rec.isThumbs = 1
      rec.likeCount = (Number(rec.likeCount) || 0) + 1
    } else {
      rec.isThumbs = 0
      rec.likeCount = Math.max(0, (Number(rec.likeCount) || 0) - 1)
    }
  } catch {
    ElMessage.warning(t('agents.operateFailed'))
  }
}
</script>

<style lang="scss" scoped>
.agents-square-list {
  padding: 24px 20px 32px;
  min-height: 400px;
  text-align: left;
}

.agents-square-list__header {
  margin-bottom: 24px;
  text-align: center;

  .empty-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 12px 0;
  }

  .empty-description {
    font-size: 15px;
    color: var(--el-text-color-regular);
    margin: 0 0 20px 0;
  }

  .empty-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
}

.agents-square-list__toolbar {
  position: sticky;
  top: 0;
  z-index: calc(var(--z-base) + 1);
  margin-bottom: 20px;
  padding-bottom: 4px;
  /* 与页面同色，避免滚动时下方卡片透出；无描边 */
  background: var(--el-bg-color-page);
  border: none;
}

.agents-square-list__search-wrap {
  margin-bottom: 12px;
}

.agents-square-list__search {
  max-width: 400px;

  :deep(.el-input__prefix),
  :deep(.el-input__prefix-inner) {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(.el-input__wrapper) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    background-color: var(--el-fill-color-light);
    border: var(--unified-border);
    box-shadow: none;
    min-height: 44px;
  }

  /* append 容器与按钮由 _search-bar-append.scss 统一提供 */
}

.agents-square-list__tabs,
.agents-square-list__sub-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.agents-square-list__tabs {
  margin-top: 10px;
  margin-bottom: 10px;
}

.btn-tab {
  padding: 6px 12px;
  min-height: 32px;
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.btn-tab--active {
  background: var(--el-color-primary);
  color: var(--el-bg-color-page);
}

.btn-tab--sub {
  padding: 6px 12px;
  font-size: 12px;
}

/* 深色模式下 tab 按钮背景为白/灰时文字改为黑色，保证可读 */
:where(html.dark) :where(.agents-square-list) .btn-tab:not(.btn-tab--active),
:where(html.dark) :where(.agents-square-list) .btn-tab:not(.btn-tab--active):hover {
  color: var(--color-dark-bg-4);
}
/* 深色模式下选中态 tab 文字改为黑色，保证可读 */
:where(html.dark) :where(.agents-square-list) .btn-tab--active {
  color: var(--color-dark-bg-4);
}

.agents-square-list__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--el-text-color-secondary);
}

.agents-square-list__section {
  margin-bottom: 28px;
}

.agents-square-list__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: var(--unified-border-bottom);
}

.agents-square-list__section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.agents-square-list__section-more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  min-height: 32px;
  font-size: 13px;
  color: var(--el-color-primary);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--global-border-radius);
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: var(--el-color-primary-light-3);
    background: var(--el-fill-color-light);
  }
}

.agents-square-list__section-more-icon {
  font-size: 14px;
}

.agents-square-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.agents-square-list__card-wrapper {
  cursor: pointer;
}

/* 与浮窗 header-btn 同一套变量；兜底在 @layer fallback，使用 CSS 变量控制 */
.agents-square-list__card {
  display: flex;
  flex-direction: column;
  padding: 8px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background-color: var(--el-bg-color);
  background: var(--el-bg-color);
  transition: border-color 0.2s ease, background-color 0.2s ease;
  box-sizing: border-box;
  box-shadow: none;

  &:hover {
    border: var(--unified-border);
    background-color: var(--el-fill-color-light);
    background: var(--el-fill-color-light);
  }
}

html.dark .agents-square-list__card {
  background-color: var(--color-white-4);
  background: var(--color-white-4);
  border-color: var(--border-unified-color);
}

html.dark .agents-square-list__card:hover {
  background-color: var(--color-white-8);
  background: var(--color-white-8);
  border-color: var(--border-unified-color-hover);
}

.agents-square-list__card-header {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  min-height: 0;
  border-radius: 0;
  background: none;
  border: none;
  border-bottom: none;
}

.agents-square-list__avatar {
  flex-shrink: 0;
}

.agents-square-list__card-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
  background: none;
  border: none;
}

.agents-square-list__card-name {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  display: block;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* 保证单行标题不被 flex 压缩，完整显示一行高度 */
  min-height: 1.4em;
  flex-shrink: 0;
  border-radius: 0;
  background: none;
  border: none;
}

.agents-square-list__card-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin: 0 0 2px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* 避免 -webkit-line-clamp 裁切第二行底部：两行完整行高 2×1.5=3em */
  min-height: 3em;
  border-radius: 0;
  background: none;
  border: none;
}

.agents-square-list__card-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  min-height: 0;
  background: none;
  border: none;
  border-radius: 0;
}

.agents-square-list__card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 0;
  margin-bottom: 0;
  border-radius: 0;
  background: none;
  border: none;
}

.agents-square-list__card-meta-avatar {
  flex-shrink: 0;
}

.agents-square-list__card-meta-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: none;
  outline: none;
  box-shadow: none;
}

.agents-square-list__card-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 0;
  overflow: hidden;
  flex-shrink: 0;
  min-height: 20px;
  border: none;
  border-bottom: none;
  background: none;
  background-color: transparent;
}

.agents-square-list__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: var(--global-border-radius-sm, 4px);
  border: none;
  /* 用内阴影代替描边，圆角更顺滑、避免锯齿 */
  box-shadow: inset 0 0 0 1px var(--border-unified-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  overflow: hidden;
}

.agents-square-list__card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  padding: 0 4px;
  margin-top: 12px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.agents-square-list__stat {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.agents-square-list__use-btn {
  height: 32px;
  padding: 0 12px;
  margin-left: auto;
  border: var(--unified-border);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  font-size: 12px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  box-sizing: border-box;
  flex-shrink: 0;
  transition: color 0.2s, border-color 0.2s, background 0.2s;

  &:hover {
    color: var(--el-color-primary);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.agents-square-list__usage-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.agents-square-list__usage-icon {
  font-size: 14px;
}

.agents-square-list__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.agents-square-list__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  min-height: 40px;
  min-width: 0;

  .el-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  &:hover {
    color: var(--el-color-primary);
  }

  &.collected,
  &.collected :deep(svg) {
    color: var(--el-color-warning);
  }

  &.liked,
  &.liked :deep(svg) {
    color: var(--el-color-danger);
  }
}

.agents-square-list__empty-inner {
  padding: 48px 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.agents-square-list__more {
  text-align: center;
  padding: 24px 0;
}
</style>
