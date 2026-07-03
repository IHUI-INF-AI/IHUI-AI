<template>
  <div class="agents-container page-container" role="main" aria-label="Agents" :class="{ 'mouse-active': isMouseInViewport }">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${scrollProgress})` }"></div>

    <!-- 深度背景系统 -->
    <div class="agents-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <div class="mouse-glow-effect"></div>
    </div>

    <!-- 页面头部 - 高科技工业风格（标题区不用 scroll-reveal，保证打字机首屏可见） -->
    <header id="agents-header" class="agents-header agents-header-visible" role="banner" aria-labelledby="agents-title">
      <div class="header-content">
        <div class="page-title-group">
          <div class="header-badge">
            <span class="status-dot"></span>
            <span class="badge-text font-edix">{{ t('agents.badge') }}</span>
          </div>
          <h1 id="agents-title" class="page-title">
            <span class="typing-text">{{ currentTypingText }}</span><span class="title-accent cursor-blink">_</span>
          </h1>
          <p class="page-subtitle">{{ t('agents.subtitle') }}</p>
        </div>
        <div class="page-meta glass-card" v-if="!loading">
          <span class="meta-dot"></span>
          <span class="meta-text">
            {{ t('agents.metaTotal', { count: squareListTotal }) }}
          </span>
          <span class="meta-badge">{{ t('agents.statusLive') }}</span>
        </div>
      </div>
      <!-- 视图切换 -->
      <div class="view-toggle-bar">
        <button :class="['toggle-btn', { active: activeView === 'marketplace' }]" @click="activeView = 'marketplace'">{{ t('agents.square') }}</button>
        <button :class="['toggle-btn', { active: activeView === 'my-agents' }]" @click="activeView = 'my-agents'; fetchDevAgents()">{{ t('agents.myAgents') }}</button>
      </div>
    </header>

    <!-- 智能体列表（工具栏在列表内用 sticky 固定，不随列表滚动） -->
    <div id="agents-content" class="agents-content" role="region" aria-labelledby="agents-title">
      <!-- 我的智能体视图 -->
      <template v-if="activeView === 'my-agents'">
        <!-- 状态标签 -->
        <div class="dev-status-bar glass-card">
          <div
            v-for="item in devHeadTypes"
            :key="item.id"
            :class="['dev-status-tab', { active: devStatus === item.id }]"
            @click="changeDevStatus(item)"
          >
            {{ item.name }}
          </div>
        </div>
        <!-- 子标签 -->
        <div v-if="devStatus === 0" class="dev-sub-tabs">
          <span
            v-for="sub in devSubTabs"
            :key="sub.id"
            :class="['dev-sub-tab', { active: devStatus === sub.id }]"
            @click="changeDevStatus(sub)"
          >
            {{ sub.name }}
          </span>
        </div>
        <!-- 搜索 -->
        <div class="dev-search">
          <el-input v-model="devSearch" :placeholder="t('agents.devSearchPlaceholder')" clearable @keyup.enter="devSearchChange" @clear="devSearchChange">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <!-- 智能体列表 -->
        <div v-if="devLoading && devDataList.length === 0" class="loading-container glass-card">
          <div class="loading-inner">
            <div class="loading-spinner"></div>
            <span class="loading-text">{{ t('agents.loading') }}</span>
          </div>
        </div>
        <div v-else-if="devDataList.length === 0" class="empty-state glass-card">
          <el-empty :description="t('agents.noAgentData')">
            <el-button type="primary" @click="handleCreateAgent">{{ t('agents.createAgent') }}</el-button>
          </el-empty>
        </div>
        <div v-else class="dev-agent-list">
          <div v-for="item in devDataList" :key="item.id" class="dev-agent-card glass-card">
            <div class="dev-card-header">
              <div class="dev-card-info">
                <img :src="item.icon || item.avatar || '/images/default-avatar.png'" :alt="item.name || t('agents.agentAvatar')" class="dev-card-avatar" loading="lazy" />
                <div>
                  <h4 class="dev-card-name">{{ item.agentName || item.agent_name || item.name }}</h4>
                  <p class="dev-card-desc">{{ item.description || item.prologue || t('agents.noDescription') }}</p>
                </div>
              </div>
              <el-tag :type="devStatus === 0 ? 'warning' : devStatus === 1 ? 'info' : 'success'" size="small">
                {{ getStatusLabel(item.publish_status ?? devStatus) }}
              </el-tag>
            </div>
            <div class="dev-card-actions">
              <el-button size="small" @click="handleCreateAgent">{{ t('common.edit') }}</el-button>
              <el-button size="small" type="danger" plain>{{ t('common.delete') }}</el-button>
            </div>
          </div>
          <div v-if="devLoading" class="dev-loading-more">
            <el-icon class="is-loading"><Loading /></el-icon>
            {{ t('agents.loading') }}
          </div>
        </div>
      </template>

      <!-- 广场视图 -->
      <template v-else>
        <div v-if="loading" class="loading-container glass-card">
          <div class="loading-inner">
            <div class="loading-spinner"></div>
            <span class="loading-text">{{ t('agents.loading') }}</span>
          </div>
          <SkeletonLoader type="list" :rows="6" :show-avatar="true" animated container-class="skeleton-agents" />
        </div>
        <AgentsSquareList v-else-if="!error" class="scroll-reveal" data-animation="fadeInUp"
          @create="handleCreateAgent" @clear-filters="handleClearAllFilters" @update:total="squareListTotal = $event" />
        <div v-else class="error-container glass-card scroll-reveal" data-animation="fadeInUp">
          <el-empty :description="error">
            <template #image>
              <el-icon :size="80" :style="{ color: 'var(--el-color-danger)' }">
                <AlertTriangle />
              </el-icon>
            </template>
            <el-button type="primary" class="retry-btn ripple-btn"
              @click="(e: MouseEvent) => { createRipple(e, e.currentTarget as HTMLElement); retryLoad() }">
              {{ t('common.retry') }}
            </el-button>
          </el-empty>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted, onActivated, watch, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { logger } from '../utils/logger'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Search, Loading } from '@/lib/lucide-fallback'
import { useSEO, generatePageStructuredData } from '@/utils/seo'
import { useCachedApi } from '@/composables/useApiCache'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useApiError } from '@/composables/useApiError'
import { useMouseGlow } from '@/composables/useMouseGlow'
import { usePagination } from '@/composables/user/usePagination'
import {
  getAgentsList,
  getAgentCategories,
  favoriteAgent,
  unfavoriteAgent,
  type Agent,
  type AgentCategory,
  type AgentPlatform,
} from '@/api/agents'
import type { ApiResponse, PaginationResponse } from '@/types'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import AgentsSquareList from '@/components/agents/AgentsSquareList.vue'

const { t } = useI18n()
const { isMouseInViewport } = useMouseGlow()

// ============ 视图切换 ============
const activeView = ref<'marketplace' | 'my-agents'>('marketplace')

// ============ 我的智能体状态 ============
const devStatus = ref(0)
const devSearch = ref('')
const devPage = ref({ page: 1, pageSize: 10 })
const devTotal = ref(0)
const devDataList = ref<unknown[]>([])
const devLoading = ref(false)
const devHeadTypes = computed(() => [
  { id: 0, name: t('agents.statusPending') },
  { id: 1, name: t('agents.statusReviewing') },
  { id: 2, name: t('agents.statusPublished') },
])
const devSubTabs = computed(() => [
  { id: 0, name: t('agents.categoryAll') },
  { id: 4, name: t('agents.statusReviewFailed') },
  { id: 5, name: t('agents.statusOffline') },
])

// ============ 高级动效系统 ============
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())
const scrollProgress = ref(0)

// 初始化滚动动画观察器
const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          const animation = el.dataset.animation || 'fadeInUp'

          setTimeout(() => {
            el.classList.add('scroll-animated', `animate-${animation}`)
          }, parseInt(delay))

          observedElements.value.add(el)
        }
      })
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  )

  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// ===== 打字机效果（与 OpenPlatform/LearnAI 一致循环） =====
const typewriterPhrases = computed(() => [
  t('agents.title'),
  t('agents.exploreAgents'),
  t('agents.createCustomAgent'),
  t('agents.oneClickDeploy')
])
const currentTypingText = ref('')
let typewriterPhraseIdx = 0
let typewriterCharIdx = 0
let typewriterDeleting = false
let typewriterTimer: ReturnType<typeof setTimeout> | null = null

const runTypewriterEffect = () => {
  const list = typewriterPhrases.value
  if (!list.length) return
  const currentPhrase = list[typewriterPhraseIdx]
  if (!currentPhrase?.length) {
    typewriterPhraseIdx = (typewriterPhraseIdx + 1) % list.length
    typewriterTimer = setTimeout(runTypewriterEffect, 500)
    return
  }
  let speed: number
  if (typewriterDeleting) {
    if (typewriterCharIdx <= 0) {
      typewriterDeleting = false
      typewriterPhraseIdx = (typewriterPhraseIdx + 1) % list.length
      currentTypingText.value = ''
      typewriterCharIdx = 0
      speed = 500
    } else {
      typewriterCharIdx--
      currentTypingText.value = currentPhrase.substring(0, typewriterCharIdx)
      speed = 60
    }
  } else {
    currentTypingText.value = currentPhrase.substring(0, typewriterCharIdx + 1)
    typewriterCharIdx++
    if (typewriterCharIdx >= currentPhrase.length) {
      typewriterDeleting = true
      speed = 2000
    } else {
      speed = 120
    }
  }
  typewriterTimer = setTimeout(runTypewriterEffect, speed)
}

const startTypewriter = () => {
  if (typewriterTimer) clearTimeout(typewriterTimer)
  typewriterPhraseIdx = 0
  typewriterCharIdx = 0
  typewriterDeleting = false
  currentTypingText.value = ''
  runTypewriterEffect()
}

// 滚动进度计算
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0
    document.documentElement.style.setProperty('--scroll-progress', `${scrollProgress.value}`)
  })
}

// 涟漪点击效果
const createRipple = (e: MouseEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const ripple = document.createElement('span')
  const size = Math.max(rect.width, rect.height)

  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  ripple.classList.add('ripple-effect')

  el.appendChild(ripple)
  setTimeout(() => ripple.remove(), 600)
}
const seo = useSEO()
const { handleResult, showError: showErrorMsg } = useOperationFeedback()
const { loading: apiLoading, error: apiError, execute } = useApiError()

// 状态管理
const agents = ref<Agent[]>([])
const categories = ref<AgentCategory[]>([])
const squareListTotal = ref(0)
const loading = computed(() => apiLoading.value)
const error = computed(() => apiError.value?.message || null)
const searchKeyword = ref('')
const selectedCategory = ref<string>('all')
const selectedPlatform = ref<AgentPlatform | undefined>(undefined)
const sortBy = ref<string>('usageCount')
const retryCount = ref(0)
const maxRetries = 3

// 分页
const { pagination } = usePagination({
  initialPage: 1,
  initialPageSize: 24,
  onPageChange: async () => {
    await debouncedLoadAgents()
  },
  onPageSizeChange: async () => {
    await debouncedLoadAgents()
  },
})

// 创建带缓存的API调用
const cachedGetAgentsList = useCachedApi(getAgentsList, {
  cacheKey: params => {
    return `agents:${params.page}:${params.pageSize}:${params.category || 'all'}:${params.keyword || ''}:${params.sortBy || 'usageCount'}:${params.platform || 'all'}`
  },
  ttl: 2 * 60 * 1000, // 2分钟缓存
  enabled: true,
  debounce: 300,
  deduplicate: true,
})

// 加载智能体列表
const loadAgents = async (isRetry = false) => {
  // 注释：已移除开发环境跳过逻辑，现在开发环境也会调用后端API获取真实智能体数据
  if (isRetry) {
    retryCount.value++
  } else {
    retryCount.value = 0
  }

  const params: Parameters<typeof getAgentsList>[0] = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    category: selectedCategory.value === 'all' ? undefined : selectedCategory.value,
    keyword: searchKeyword.value || undefined,
    sortBy: sortBy.value,
    sortOrder: 'desc' as const,
    platform: selectedPlatform.value,
  }

  const result = await execute(() => cachedGetAgentsList.execute(params), {
    showMessage: !isRetry,
  })

  if (result) {
    agents.value = result.list || []
    pagination.total = result.pagination?.total || 0
    retryCount.value = 0

    // 如果没有数据且不是第一页，重置到第一页
    if (agents.value.length === 0 && pagination.page > 1) {
      pagination.page = 1
      // 不递归调用，避免无限循环
    }
  } else {
    // 自动重试机制
    if (retryCount.value < maxRetries && !isRetry) {
      setTimeout(() => {
        loadAgents(true)
      }, 1000 * retryCount.value) // 指数退避
      return
    }
    agents.value = []
    pagination.total = 0
  }
}

// 手动重试
const retryLoad = () => {
  retryCount.value = 0
  loadAgents()
}

// 加载分类列表
const loadCategories = async () => {
  // 注释：已移除开发环境跳过逻辑，现在开发环境也会调用后端API获取真实分类数据
  try {
    const response = await getAgentCategories()
    if (response.code === 200 || response.success) {
      categories.value = response.data || []
      // 确保有"全部"选项
      if (!categories.value.find(c => c.id === 'all')) {
        categories.value.unshift({
          id: 'all',
          name: t('agents.categoryAll'),
          count: 0,
        })
      }
    } else {
      // API返回失败，使用默认分类
      categories.value = [
        { id: 'all', name: t('agents.categoryAll'), count: 0 },
        { id: 'assistant', name: t('agents.categoryAssistant'), count: 0 },
        { id: 'creative', name: t('agents.categoryCreative'), count: 0 },
        { id: 'business', name: t('agents.categoryBusiness'), count: 0 },
        { id: 'education', name: t('agents.categoryEducation'), count: 0 },
        { id: 'entertainment', name: t('agents.categoryEntertainment'), count: 0 },
      ]
    }
  } catch (error) {
    // 静默失败，使用默认分类
    logger.warn('Failed to load categories:', error)
    categories.value = [
      { id: 'all', name: t('agents.categoryAll'), count: 0 },
      { id: 'assistant', name: t('agents.categoryAssistant'), count: 0 },
      { id: 'creative', name: t('agents.categoryCreative'), count: 0 },
      { id: 'business', name: t('agents.categoryBusiness'), count: 0 },
      { id: 'education', name: t('agents.categoryEducation'), count: 0 },
      { id: 'entertainment', name: t('agents.categoryEntertainment'), count: 0 },
    ]
  }
}

const debouncedLoadAgents = useDebounceFn(() => {
  loadAgents()
}, 300)

// 统一处理搜索和筛选
const handleSearch = () => {
  if (pagination.page !== 1) {
    pagination.page = 1
  }
  debouncedLoadAgents()
}

// 使用统一的导航 composable - useSafeNavigation 不存在，使用基本实现
const router = useRouter()
const isNavigating = ref(false)

const safeNavigate = async (path: string, event?: MouseEvent | KeyboardEvent) => {
  if (isNavigating.value) {
    return
  }

  if (event) {
    event.preventDefault()
  }

  isNavigating.value = true
  try {
    await router.push(path)
  } catch (error) {
    logger.error('[Agents] Navigation error:', error)
  } finally {
    setTimeout(() => {
      isNavigating.value = false
    }, 300)
  }
}

// 点击智能体
const _handleAgentClick = (agent: Agent, event?: MouseEvent | KeyboardEvent) => {
  // 跳转到智能体详情页
  safeNavigate(`/agents/${String(agent.id)}`, event)
}

// 收藏
const _handleFavorite = async (agent: Agent) => {
  // 乐观更新
  const previousState = agent.isFavorite
  agent.isFavorite = true

  await handleResult(favoriteAgent(String(agent.id)), {
    successMessage: t('agents.favoriteSuccess'),
    errorMessage: t('agents.favoriteFailed'),
    onError: () => {
      // 回滚状态
      agent.isFavorite = previousState
    },
  })
}

// 取消收藏
const _handleUnfavorite = async (agent: Agent) => {
  // 乐观更新
  const previousState = agent.isFavorite
  agent.isFavorite = false

  await handleResult(unfavoriteAgent(String(agent.id)), {
    successMessage: t('agents.unfavoriteSuccess'),
    errorMessage: t('agents.unfavoriteFailed'),
    onError: () => {
      // 回滚状态
      agent.isFavorite = previousState
    },
  })
}

// 创建智能体
const handleCreateAgent = () => {
  safeNavigate('/agents/create')
}

// 清除所有筛选
const handleClearAllFilters = () => {
  searchKeyword.value = ''
  selectedCategory.value = 'all'
  selectedPlatform.value = undefined
  if (pagination.page !== 1) {
    pagination.page = 1
  }
  handleSearch()
}

// ============ 我的智能体方法 ============
import { getAgentList as fetchMyAgents } from '@/services/api'
import { v2Agents } from '@/api'

const fetchDevAgents = async () => {
  devLoading.value = true
  try {
    const params = {
      page: devPage.value.page,
      page_size: devPage.value.pageSize,
      status: devStatus.value,
      agent_name: devSearch.value,
    }
    // P13: v2Agents.list 已简化为纯 v1 调用 (2026-06-21 v2 空壳清理后)
    let v2Result: ApiResponse<PaginationResponse<Agent>> | null = null
    try {
      v2Result = await v2Agents.list({
        page: devPage.value.page,
        size: devPage.value.pageSize,
        keyword: devSearch.value,
      })
    } catch (e) {
      logger.warn('[P13] v2 agents.list failed, fallback to v1:', e)
    }
    const v2Res = v2Result as ApiResponse<PaginationResponse<Agent>> | null
    const records = v2Res?.data?.records ?? v2Res?.data?.list ?? []
    if (v2Res && Number(v2Res?.code) === 200 && records.length > 0) {
      // v2 路径 (v2 first / v2 优先)
      devDataList.value = devPage.value.page === 1 ? records : [...devDataList.value, ...records]
      devTotal.value = v2Res?.data?.total ?? 0
      return
    }
    // Fallback: v1 (含多平台聚合)
    const res = await fetchMyAgents(params)
    if (res && typeof res === 'object') {
      const rows = Array.isArray(res.rows) ? res.rows : []
      devDataList.value = devPage.value.page === 1 ? rows : [...devDataList.value, ...rows]
      devTotal.value = res.total || 0
    }
  } catch (error) {
    logger.error('Failed to fetch my agents:', error)
  } finally {
    devLoading.value = false
  }
}

const changeDevStatus = (item: { id: number; name: string }) => {
  devStatus.value = item.id
  devPage.value.page = 1
  devDataList.value = []
  fetchDevAgents()
}

const devSearchChange = () => {
  devPage.value.page = 1
  devDataList.value = []
  fetchDevAgents()
}

const _devScrollToLower = () => {
  if (devTotal.value > devDataList.value.length) {
    devPage.value.page += 1
    fetchDevAgents()
  }
}

const getStatusLabel = (status: number) => {
  const map: Record<number, string> = {
    0: t('agents.statusPending'),
    1: t('agents.statusReviewing'),
    2: t('agents.statusPublished'),
    4: t('agents.statusReviewFailed'),
    5: t('agents.statusOffline'),
  }
  return map[status] || t('agents.statusUnknown')
}

// SEO优化
const updateSEO = () => {
  const currentUrl = window.location.href
  const description = t('agents.subtitle')
  const keywords = `${t('agents.title')},${t('agents.seoKeywords')},${t('agents.platformCoze')},${t('agents.platformN8n')},${t('agents.platformDify')}`

  seo.updateMetaTags({
    title: t('agents.title'),
    description,
    keywords,
    url: currentUrl,
    type: 'website',
  })

  // 添加结构化数据
  seo.setStructuredData(
    generatePageStructuredData({
      title: t('agents.title'),
      description,
      url: currentUrl,
    })
  )
}

// 监听数据变化，更新SEO和重新观察动画元素
watch(
  () => [pagination.total, agents.value.length],
  () => {
    if (!loading.value) {
      updateSEO()
      // 重新观察新添加的元素
      nextTick(() => {
        document.querySelectorAll('.scroll-reveal').forEach((el) => {
          if (!observedElements.value.has(el)) {
            scrollObserver?.observe(el)
          }
        })
      })
    }
  }
)

// 初始化
onMounted(async () => {
  try {
    startTypewriter()
    // 设置SEO
    updateSEO()

    // 初始化高级动效系统
    initScrollAnimations()

    window.addEventListener('scroll', handleScroll, { passive: true })

    // 初始滚动进度计算
    handleScroll()

    // 加载分类（列表由 AgentsSquareList 使用 bylink 接口自行加载）
    await loadCategories()

    // 数据加载后重新观察新元素
    nextTick(() => {
      document.querySelectorAll('.scroll-reveal').forEach((el) => {
        if (!observedElements.value.has(el)) {
          scrollObserver?.observe(el)
        }
      })
    })
  } catch (error) {
    logger.error('Failed to initialize agents page:', error)
    showErrorMsg(t('agents.loadFailed'))
  }
})

// 清理
onActivated(() => {
  startTypewriter()
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null } })
cleanup.add(() => { if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null } })
cleanup.add(() => window.removeEventListener('scroll', handleScroll))
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })
</script>

<style scoped lang="scss">
// ============ 设计系统变量 ============
$bg-page: var(--el-bg-color-page);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--color-gray-333);

// ============ 主容器 ============
.agents-container {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 20px;

  /* 顶部留白缩小，主内容区避让由 .main-content 的 padding-top 统一处理 */
  padding-top: 12px;
  background: transparent;
  box-sizing: border-box;
  overflow-x: hidden;
  position: relative;
  min-height: 100vh;

  /* 智能体中心容器：无描边、无背景、无圆角（fallback 已排除本容器，此处仅覆盖 index 的 .page-container） */
  &.page-container {
    background-color: transparent;
    background: transparent;
    border: none;
    border-radius: 0;

    /* 暗色模式：提升特异性至 (0,3,2) 高于亮色基础 (0,3,1)，用层顺序控制 即可覆盖 */
    html.dark & {
      background-color: var(--page-bg-color);
      background: var(--page-bg-color);
    }
  }

  &.mouse-active .mouse-glow-effect {
    opacity: 0;
  }
}

// ============ 深度背景系统 ============
.agents-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .mouse-glow-effect {
    position: absolute;
    left: 0;
    top: 0;
    width: 600px;
    height: 600px;
    border-radius: var(--global-border-radius);
    background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    opacity: 0;
    pointer-events: none;
  }

  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(80px);
    opacity: 0.12;
    animation: floatOrb 15s ease-in-out infinite;

    &.orb-1 {
      width: 400px;
      height: 400px;
      top: 10%;
      right: 10%;
      background: rgba($brand-primary, 0.3);
    }

    &.orb-2 {
      width: 350px;
      height: 350px;
      bottom: 20%;
      left: 5%;
      background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
      animation-delay: -7s;
    }
  }

}

// ============ 滚动触发动画 ============
.scroll-reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: none;

  &.scroll-animated {
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============ 玻璃态卡片 ============
.glass-card {
  background: rgb(var(--el-fill-color-light-rgb), 0.4);
  backdrop-filter: blur(24px);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

// ============ 涟漪效果 ============
.ripple-btn {
  position: relative;
  overflow: hidden;
}

// ============ 页面头部 ============
.agents-header-visible {
  opacity: 1;
  animation: agentsHeaderFadeIn 0.6s ease both;
}

@keyframes agentsHeaderFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

:where(.agents-header) {
  margin-bottom: 24px;
  background: transparent;
  position: relative;
  z-index: var(--z-base);
  padding-top: 20px;

  .header-content {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
  }

  :where(.page-title-group) {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 20px;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.05em;
      width: fit-content;
      background: rgb(var(--el-fill-color-light-rgb), 0.3);
      backdrop-filter: blur(12px);

      .status-dot {
        width: 6px;
        height: 6px;
        background: $brand-primary;
        border-radius: var(--global-border-radius);
        animation: pulse 2s infinite;
      }
    }

    .page-title {
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 950;
      font-family: var(--font-family-chinese);
      color: $text-main;
      margin: 0;
      line-height: 1.1;
      letter-spacing: -0.03em;

      .typing-text {
        color: inherit;
      }

      .title-accent.cursor-blink {
        color: $brand-primary;
        animation: blink 1s step-end infinite;
      }
    }

    .page-subtitle {
      font-size: 16px;
      color: $text-sec;
      margin: 0;
      line-height: 1.6;
      max-width: 500px;
    }
  }

  .page-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    font-size: 13px;
    color: $text-sec;
    white-space: nowrap;

    .meta-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--global-border-radius);
      background: var(--el-color-success);
      border: var(--unified-border);
      animation: pulse-dot 2s ease-in-out infinite;
    }

    .meta-text {
      font-weight: 700;
    }

    .meta-badge {
      font-size: 12px;
      font-weight: 900;
      padding: 3px 8px;
      background: $brand-primary;
      color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
      border-radius: var(--global-border-radius);
      letter-spacing: 0.05em;
    }
  }
}

// ============ 筛选区域 ============
.filter-section {
  position: relative;
  z-index: var(--z-base);
  margin-bottom: 32px;
}

// ============ 内容区域 ============
:where(.agents-content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: transparent;
  position: relative;
  z-index: var(--z-base);

  .loading-container {
    padding: 60px 40px;
    border-radius: var(--global-border-radius);

    .loading-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 32px;

      .loading-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid var(--border-unified-color);
        border-top-color: var(--el-color-primary);
        border-radius: var(--global-border-radius);
        animation: spin 1s linear infinite;
      }

      .loading-text {
        font-size: 14px;
        font-weight: 700;
        color: $text-sec;
      }
    }
  }

  .error-container {
    padding: 80px 40px;
    text-align: center;
    border-radius: var(--global-border-radius);

    .retry-btn {
      margin-top: 20px;
    }
  }

  .agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;
  }

  .agent-card-wrapper {
    border-radius: var(--global-border-radius);

    :deep(.agent-card) {
      height: 100%;
      border-radius: var(--global-border-radius);
      background: rgb(var(--el-fill-color-light-rgb), 0.4);
      backdrop-filter: blur(24px);
      border: var(--unified-border);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        border-color: rgba($brand-primary, 0.3);
      }
    }
  }
}

// ============ 分页区域 ============
:where(.pagination-container) {
  margin-top: 48px;
  padding: 24px 32px;
  display: flex;
  justify-content: center;
  border-radius: var(--global-border-radius);

  :deep(.el-pagination) {
    .el-pagination__total,
    .el-pagination__sizes,
    .el-pager li,
    .btn-prev,
    .btn-next,
    .el-pagination__jump {
      color: $text-sec;
      font-weight: 600;
    }

    .el-pager li {
      border-radius: var(--global-border-radius);
      margin: 0 2px;
      transition: all 0.3s;

      &:hover {
        background: rgba($brand-primary, 0.1);
      }

      &.is-active {
        background: $brand-primary;
        color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
        font-weight: 800;
      }
    }

    .btn-prev,
    .btn-next {
      border-radius: var(--global-border-radius);
      transition: all 0.3s;

      &:hover {
        background: rgba($brand-primary, 0.1);
      }
    }
  }
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(60px, 60px);
  }
}

@keyframes floatOrb {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  25% {
    transform: translate(30px, -20px) scale(1.05);
  }

  50% {
    transform: translate(-20px, 30px) scale(0.95);
  }

  75% {
    transform: translate(-30px, -10px) scale(1.02);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.7;
    transform: scale(1.15);
  }
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }

  51%,
  100% {
    opacity: 0;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

// ============ 视图切换 ============
.view-toggle-bar {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.toggle-btn {
  background: rgb(var(--el-fill-color-light-rgb), 0.3);
  border: var(--unified-border);
  color: $text-sec;
  padding: 8px 24px;
  border-radius: var(--global-border-radius);
  font-family: var(--font-family-mono);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;

  &.active {
    background: $brand-primary;
    color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
    border-color: transparent;
  }
}

// ============ 我的智能体开发面板 ============
.dev-status-bar {
  display: flex;
  padding: 8px;
  margin-bottom: 16px;
  gap: 4px;
}

.dev-status-tab {
  flex: 1;
  text-align: center;
  padding: 8px 16px;
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-weight: 600;
  color: $text-sec;
  cursor: pointer;
  transition: all 0.3s;

  &.active {
    background: $brand-primary;
    color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
    font-weight: 800;
  }
}

.dev-sub-tabs {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding: 0 4px;
}

.dev-sub-tab {
  font-size: 14px;
  color: $text-sec;
  cursor: pointer;
  transition: all 0.3s;

  &.active {
    color: $brand-primary;
    font-weight: 700;
  }
}

.dev-search {
  margin-bottom: 16px;
  max-width: 400px;
}

.dev-agent-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dev-agent-card {
  padding: 20px;
  transition: all 0.3s;

  &:hover {
    border-color: rgba($brand-primary, 0.3);
  }
}

.dev-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.dev-card-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dev-card-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
}

.dev-card-name {
  font-size: 16px;
  font-weight: 700;
  color: $text-main;
  margin: 0 0 4px;
}

.dev-card-desc {
  font-size: 13px;
  color: $text-sec;
  margin: 0;
}

.dev-card-actions {
  display: flex;
  gap: 8px;
}

.dev-loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: $text-sec;
  font-size: 14px;
}

.empty-state {
  padding: 60px;
  text-align: center;
}

// ============ 响应式设计 ============
@media (width <= 768px) {
  .agents-container {
    padding: 12px;
  }

  .agents-header {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .page-title-group {
      .page-title {
        font-size: clamp(28px, 8vw, 36px);
      }
    }

    .page-meta {
      width: 100%;
      justify-content: center;
    }
  }

  .agents-content {
    .agents-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
  }

  .pagination-container {
    padding: 16px;

    :deep(.el-pagination) {
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
  }

  .agents-bg-system {
    .bg-glow-orb {
      opacity: 0.08;

      &.orb-1 {
        width: 250px;
        height: 250px;
      }

      &.orb-2 {
        width: 200px;
        height: 200px;
      }
    }
  }
}

@media (width <= 480px) {
  .agents-header {
    .page-title-group {
      .header-badge {
        font-size: 12px;
        padding: 6px 14px;
      }
    }
  }
}
</style>

<style lang="scss">
/* 暗色模式：智能体页面整体与容器使用深色背景
   原使用高优先级覆盖 Vue scoped [data-v-xxx] 属性选择器，
   已通过 html.dark & 嵌套将特异性提升至 (0,3,2)，用层顺序控制 */
html.dark .agents-bg-system {
  background-color: var(--page-bg-color);
  background: var(--page-bg-color);
}

html.dark .agents-content {
  background-color: transparent;
  background: transparent;
}

:where(html.dark) :where(.agents-header) .page-title,
:where(html.dark) :where(.agents-header) .page-title .typing-text {
  color: var(--el-text-color-primary);
}

html.dark .agents-header .page-subtitle,
html.dark .agents-header .page-meta,
:where(html.dark) .agents-header .meta-text {
  color: var(--el-text-color-secondary);
}

:where(html.dark) .agents-header .header-badge {
  background: var(--el-fill-color-darker);
  border-color: var(--border-unified-color);
}

html.dark .glass-card {
  background: var(--el-fill-color-darker);
  border-color: var(--border-unified-color);
}
</style>
