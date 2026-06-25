<template>
  <!-- 顶部工具栏 -->
  <div class="top-toolbar">
    <div
      v-for="item in headerMenu"
      :key="item.id"
      class="top-toolbar-item"
      :class="{ 'is-navigating': isNavigating }"
      @click="handleHeaderMenuClick(item, $event)"
    >
      <div class="top-toolbar-item-text">{{ getHeaderItemTitle(item) }}</div>
      <img :src="item.imgUrl" :alt="getHeaderItemTitle(item)" class="top-toolbar-item-image" loading="lazy" />
    </div>
  </div>

  <!-- 独家开发 AI Agent应用标题 -->
  <div
    class="toolbar-title"
    :class="{ 'is-navigating': isNavigating }"
    @click="handleToolbarTitleClick($event)"
  >
    <h3>{{ t('toolbar.agents.title') }}</h3>
    <div class="toolbar-more">
      <span>{{ t('common.viewMore') }}</span>
      <img :src="rightArrowSrc" :alt="t('common.viewMore')" class="right-arrow" loading="lazy" />
    </div>
  </div>

  <!-- 第一栏 - 运营内容生成 -->
  <div
    class="featured-section"
    :class="{ 'is-navigating': isNavigating }"
    @click="handleMarketingClick($event)"
  >
    <div class="featured-content">
      <h4>{{ t('toolbar.marketing.title') }}</h4>
      <p>{{ t('toolbar.marketing.desc') }}</p>
    </div>
  </div>

  <!-- 第二栏 - AI工具网格 -->
  <div class="tools-grid">
    <div v-if="loading" class="loading-state">
      <el-skeleton :count="6" :width="'100%'" :height="'180px'" />
    </div>
    <div v-else>
      <div
        v-for="item in secondRowList"
        :key="item.id"
        class="tool-item"
        @click="handleToolItemClick(item, $event)"
        :class="{ 'tool-item-highlight': item.id === '1', 'is-navigating': isNavigating }"
      >
        <img :src="getToolImage(item)" :alt="item.title || item.name" class="tool-image" loading="lazy" />
        <div class="tool-info">
          <h5>{{ item.title || item.name }}</h5>
          <p>{{ item.description }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- 第三栏 - 定制服务 -->
  <div
    class="custom-service"
    :class="{ 'is-navigating': isNavigating }"
    @click="goToCustomMade($event)"
  >
    <img
      src="/images/svg/大模型.svg"
      :alt="t('customService.title')"
      class="custom-service-image"
      loading="lazy"
    />
    <span class="custom-service-text">{{ t('customService.subtitle') }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSafeNavigation } from '@/composables/useSafeNavigation'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { openCustomerServiceChat } from '@/composables/useOpenCustomerServiceChat'
import { getPopularTools, getToolCategoriesList, getAllToolsList } from '@/api/tools/tools'

// 兼容旧代码的别名
const _getToolCategories = getToolCategoriesList

// 创建一个兼容的自定义工具类型，包含route属性
interface CustomTool {
  id: string
  name: string
  title?: string
  description: string
  icon?: string
  route: string
  [key: string]: any
}

export type { CustomTool }

// HeaderMenuItem接口定义
export interface HeaderMenuItem {
  id: string
  title: string
  imgUrl: string
  route: string
  /** 可选的动作标识，用于触发特殊行为 */
  action?: string
}

const router = useRouter()
const { t } = useI18n()
const { showError, showWarning } = useOperationFeedback()
const { isNavigating, safeNavigate: baseSafeNavigate } = useSafeNavigation({
  componentName: 'Toolbar',
})

// 包装 safeNavigate 以添加错误提示
const safeNavigate = async (path: string, event?: MouseEvent) => {
  try {
    await baseSafeNavigate(path, event)
  } catch {
    showError(t('errors.navigateFail'))
  }
}

// 状态管理
const loading = ref(true)
const error = ref(false)
const errorMessage = ref('')

// 基础数据
const rightArrowSrc = ref(t('cmpToolbar.imagessvgxxxsvg'))
const toolCategories = ref<Array<Record<string, unknown>>>([])
const agentList = ref<Array<Record<string, unknown>>>([])

// ToolCategory接口定义
export interface ToolCategory {
  id: number
  name: string
  description: string
  icon: string
  sort: number
  status: number
}

// 顶部菜单数据 - 优先从API获取，失败则使用默认数据
const headerMenu = ref<HeaderMenuItem[]>([
  {
    id: '1',
    title: t('toolbar.menu.trafficOperation'),
    imgUrl: '/images/svg/大模型.svg',
    route: '/',
    action: 'openAIChat',
  },
  {
    id: '2',
    title: t('toolbar.menu.oneStopEquipment'),
    imgUrl: '/images/svg/大模型.svg',
    route: '/xuqiu',
  },
  {
    id: '3',
    title: t('toolbar.menu.aiTechnicalServices'),
    imgUrl: '/images/svg/大模型.svg',
    route: '/',
    action: 'openCustomerServiceChat',
  },
])

// 工具列表数据 - 优先从API获取，失败则使用默认数据
const secondRowList = ref<CustomTool[]>([
  {
    id: '1',
    title: t('toolbar.tools.items.image.title'),
    name: t('toolbar.tools.items.image.title'),
    description: t('toolbar.tools.items.image.desc'),
    icon: '/images/svg/大模型.svg',
    category: t('toolbar.tools.categories.creativeDesign'),
    categoryId: 1,
    route: '/image-generation',
    tags: [t('toolbar.tools.items.image.tag1'), t('toolbar.tools.items.image.tag2')],
    type: 'service',
    isPublic: true,
    creatorId: '1',
    creatorName: t('toolbar.tools.items.creator'),
    usageCount: 0,
    rating: 0,
    ratingCount: 0,
    price: 0,
    freeQuota: 0,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  },
  {
    id: '2',
    title: t('toolbar.tools.items.video.title'),
    name: t('toolbar.tools.items.video.title'),
    description: t('toolbar.tools.items.video.desc'),
    icon: '/images/svg/大模型.svg',
    category: t('toolbar.tools.categories.creativeDesign'),
    categoryId: 1,
    route: '/video-generation',
    tags: [t('toolbar.tools.items.video.tag1'), t('toolbar.tools.items.video.tag2')],
    type: 'service',
    isPublic: true,
    creatorId: '1',
    creatorName: t('toolbar.tools.items.creator'),
    usageCount: 0,
    rating: 0,
    ratingCount: 0,
    price: 0,
    freeQuota: 0,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  },
  {
    id: '3',
    title: t('toolbar.tools.items.copy.title'),
    name: t('toolbar.tools.items.copy.title'),
    description: t('toolbar.tools.items.copy.desc'),
    icon: '/images/svg/大模型.svg',
    category: t('toolbar.tools.categories.creativeDesign'),
    categoryId: 1,
    route: '/copy-generation',
    tags: [t('toolbar.tools.items.copy.tag1'), t('toolbar.tools.items.copy.tag2')],
    type: 'service',
    isPublic: true,
    creatorId: '1',
    creatorName: t('toolbar.tools.items.creator'),
    usageCount: 0,
    rating: 0,
    ratingCount: 0,
    price: 0,
    freeQuota: 0,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  },
  {
    id: '4',
    title: t('toolbar.tools.items.edit.title'),
    name: t('toolbar.tools.items.edit.title'),
    description: t('toolbar.tools.items.edit.desc'),
    icon: '/images/svg/大模型.svg',
    category: t('toolbar.tools.categories.creativeDesign'),
    categoryId: 1,
    route: '/video-edit',
    tags: [t('toolbar.tools.items.edit.tag1'), t('toolbar.tools.items.edit.tag2')],
    type: 'service',
    isPublic: true,
    creatorId: '1',
    creatorName: t('toolbar.tools.items.creator'),
    usageCount: 0,
    rating: 0,
    ratingCount: 0,
    price: 0,
    freeQuota: 0,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  },
  {
    id: '5',
    title: t('toolbar.tools.items.live.title'),
    name: t('toolbar.tools.items.live.title'),
    description: t('toolbar.tools.items.live.desc'),
    icon: '/images/svg/大模型.svg',
    category: t('toolbar.tools.categories.creativeDesign'),
    categoryId: 1,
    route: '/live-streaming',
    tags: [t('toolbar.tools.items.live.tag1'), t('toolbar.tools.items.live.tag2')],
    type: 'service',
    isPublic: true,
    creatorId: '1',
    creatorName: t('toolbar.tools.items.creator'),
    usageCount: 0,
    rating: 0,
    ratingCount: 0,
    price: 0,
    freeQuota: 0,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  },
  {
    id: '6',
    title: t('toolbar.tools.items.digital.title'),
    name: t('toolbar.tools.items.digital.title'),
    description: t('toolbar.tools.items.digital.desc'),
    icon: '/images/svg/大模型.svg',
    category: t('toolbar.tools.categories.creativeDesign'),
    categoryId: 1,
    route: '/digital-human',
    tags: [t('toolbar.tools.items.digital.tag1'), t('toolbar.tools.items.digital.tag2')],
    type: 'service',
    isPublic: true,
    creatorId: '1',
    creatorName: t('toolbar.tools.items.creator'),
    usageCount: 0,
    rating: 0,
    ratingCount: 0,
    price: 0,
    freeQuota: 0,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  },
])

// 加载工具分类
const loadToolCategories = async () => {
  try {
    const response = await getToolCategoriesList()
    if (response.code === 200 || response.success) {
      toolCategories.value = (response.data as unknown as Array<Record<string, unknown>>) || []
    }
  } catch (_error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.debug('Failed to load tool categories, using default data')
      })
      .catch(() => { /* logger 加载失败，静默处理 */ })
  }
}

// 加载热门工具
const loadPopularTools = async () => {
  try {
    const response = await getPopularTools()
    if (response.code === 200 || response.success) {
      const tools = response.data || []
      if (tools.length > 0) {
        secondRowList.value = (tools as unknown as Array<Record<string, unknown>>).map(
          (tool: Record<string, unknown>) => ({
            ...tool,
            route: (tool.route as string) || `/tools/${String(tool.id || '')}`,
          })
        ) as CustomTool[]
      }
    }
  } catch (_error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.debug('Failed to load popular tools, using default data')
      })
      .catch(() => { /* logger 加载失败，静默处理 */ })
  }
}

// 加载所有工具
const loadAllTools = async () => {
  try {
    const response = await getAllToolsList({})
    const toolsData = (response as { data?: { list?: any[] } }).data || response
    const tools = Array.isArray((toolsData as { list?: any[] }).list)
      ? (toolsData as { list: any[] }).list
      : Array.isArray(toolsData)
        ? toolsData
        : []
    if (tools.length > 0) {
      if (tools.length > 0) {
        secondRowList.value = (tools as Array<Record<string, unknown>>).map(
          (tool: Record<string, unknown>) => ({
            ...tool,
            route: tool.route || `/tools/${tool.id}`,
          })
        ) as CustomTool[]
      }
    }
  } catch (_error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.debug('Failed to load all tools, using default data')
      })
      .catch(() => { /* logger 加载失败，静默处理 */ })
  }
}

// 加载智能体数据
const loadAgentData = async () => {
  try {
    // 智能体API调用占位
  } catch (_error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.debug('Failed to load agent data')
      })
      .catch(() => { /* logger 加载失败，静默处理 */ })
  }
}

// 初始化数据加载
const initData = async () => {
  try {
    loading.value = true
    error.value = false

    // 并行加载所有数据
    await Promise.all([
      loadToolCategories(),
      (async () => {
        // 对于工具列表，先尝试热门工具，如果失败则尝试所有工具
        try {
          await loadPopularTools()
        } catch (_error) {
          import('@/utils/logger').then(({ logger }) => {
            logger.debug('Popular tools API failed, trying to load all tools')
          })
          await loadAllTools()
        }
      })(),
      loadAgentData(),
    ])
  } catch (err) {
    import('@/utils/logger').then(({ logger }) => {
      logger.error('Data initialization failed', err instanceof Error ? err : new Error(String(err)))
    })
    error.value = true
    errorMessage.value = t('errors.loadDataFailed')
    showError(t('errors.loadDataFailed'))
  } finally {
    loading.value = false
  }
}

// 验证路由是否存在
const isValidRoute = (route: string): boolean => {
  if (!route || route === '/') return true
  try {
    const routerWithResolve = router as { resolve?: (to: string) => { matched?: any[] } }
    if (routerWithResolve.resolve) {
      const resolved = routerWithResolve.resolve(route)
      return (resolved.matched && resolved.matched.length > 0) || route.startsWith('/')
    }
    return route.startsWith('/')
  } catch {
    return false
  }
}


// 方法
const handleHeaderMenuClick = (item: HeaderMenuItem, event?: MouseEvent) => {
  if (item.action === 'openCustomerServiceChat') {
    openCustomerServiceChat()
    return
  }
  if (item.action === 'openAIChat' && typeof (window as Window & { openFloatingChat?: () => void }).openFloatingChat === 'function') {
    (window as Window & { openFloatingChat: (opts?: { theme?: string }) => void }).openFloatingChat({})
    return
  }
  if (isValidRoute(item.route)) {
    safeNavigate(item.route, event)
  } else {
    showWarning(t('errors.routeNotFound'))
  }
}

const handleToolbarTitleClick = (event?: MouseEvent) => {
  safeNavigate('/agents', event)
}

const getHeaderItemTitle = (item: HeaderMenuItem): string => {
  return item.title || ''
}

const getToolImage = (item: CustomTool): string => {
  return (item.icon as string) || (item.imgUrl as string) || t('cmpToolbar.imagessvgxxxsvg2')
}

const handleMarketingClick = (_event?: MouseEvent) => {
  // 打开 AI 对话悬浮窗的生成模式
  window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { mode: 'generation' } }))
}

// 使用any类型以兼容不同来源的工具数据
const handleToolItemClick = (_item: Record<string, unknown>, event?: MouseEvent) => {
  // AI工具功能已移除，点击后跳转到首页
  safeNavigate('/', event)
}

const goToCustomMade = () => {
  openCustomerServiceChat()
}

// 组件挂载时加载数据
onMounted(() => {
  initData()
})

// 暴露给父组件的数据和方法（如果需要）
defineExpose({
  secondRowList,
  agentList,
  refreshData: initData,
})
</script>

<style scoped lang="scss">
/* 使用 CSS 变量，使用 CSS 变量控制 */
.toolbar {
  --toolbar-max-width: 100%;

  padding: 40px 20px;
  max-width: var(--toolbar-max-width);
  margin: 0 auto;
}

/* 顶部工具栏 */
.top-toolbar {
  display: flex;
  justify-content: space-around;
  margin-bottom: 40px;
  padding: 20px;
  background: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
}

.top-toolbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  padding: 10px;
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  width: 120px;
  height: 120px;
  justify-content: center;

  &:hover:not(.is-navigating) {
    transform: translateY(-5px);
  }

  &.is-navigating {
    opacity: 0.7;
    cursor: wait;
    pointer-events: none;
    transform: scale(0.98);
  }
}

.top-toolbar-item-text {
  font-weight: bold;
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-bottom: 10px;
  text-align: center;
}

.top-toolbar-item-image {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

/* 标题区域 */
.toolbar-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  cursor: pointer;
  padding: 15px 0;
  border-bottom: none;
  transition: opacity 0.3s ease;

  &.is-navigating {
    opacity: 0.7;
    cursor: wait;
    pointer-events: none;
  }
}

.toolbar-title h3 {
  font-size: 20px;
  font-weight: bold;
  color: var(--el-text-color-primary);
  margin: 0;
}

.toolbar-more {
  display: flex;
  align-items: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  cursor: pointer;

  &:hover {
    color: var(--el-color-primary);
  }
}

.right-arrow {
  width: 16px;
  height: 16px;
  margin-left: 8px;
}

/* 运营内容生成区域 */
.featured-section {
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  padding: 30px;
  margin-bottom: 30px;
  cursor: pointer;
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;

  &:hover:not(.is-navigating) {
    transform: translateY(-5px);
  }

  &.is-navigating {
    opacity: 0.7;
    cursor: wait;
    pointer-events: none;
    transform: scale(0.98);
  }
}

.featured-content {
  color: var(--el-bg-color-page);

  h4 {
    font-size: 24px;
    font-weight: bold;
    margin: 0 0 10px;
  }

  p {
    font-size: 16px;
    margin: 0;
    opacity: 0.9;
  }
}

/* AI工具网格 */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.tool-item {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: var(--unified-border);

  &:hover:not(.is-navigating) {
    transform: translateY(-5px);
    box-shadow: none;
  }

  &.tool-item-highlight {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
  }

  &.is-navigating {
    opacity: 0.7;
    cursor: wait;
    pointer-events: none;
    transform: scale(0.98);
  }
}

.tool-image {
  width: 100%;
  height: 120px;
  object-fit: contain;
  margin-bottom: 15px;
  border-radius: var(--global-border-radius);
}

.tool-info {
  h5 {
    font-size: 16px;
    font-weight: bold;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  p {
    font-size: 14px;
    color: var(--el-text-color-regular);
    margin: 0;
    line-height: 1.5;
  }
}

/* 定制服务 */
.custom-service {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
  padding: 30px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(.is-navigating) {
    transform: translateY(-5px);
    box-shadow: none;
  }

  &.is-navigating {
    opacity: 0.7;
    cursor: wait;
    pointer-events: none;
    transform: scale(0.98);
  }
}

.custom-service-image {
  width: 40px;
  height: 40px;
  margin-right: 15px;
}

.custom-service-text {
  font-size: 18px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.loading-state {
  padding: 20px;
}
</style>
