<template>
  <!-- 导航菜单项 - 使用 button 标签，外层 nav 语义 -->
  <nav class="main-menu-items" ref="menuContainerRef" role="navigation" aria-label="主导航">
    <template v-for="(item, index) in visibleMenuItems" :key="item?.key || index">
      <button v-if="item && item.type === 'dropdown'" class="menu-item dropdown-trigger" :class="{
        active: activeIndex === item.key,
        open: openDropdownKey === item.key,
        'agents-dropdown': item.key === 'agents',
      }" :ref="bindDropdownTriggerRef(index, item.key)" type="button"
        @click.prevent="e => handleDropdownTriggerClick(item, e)"
        @mouseenter="e => openDropdownWithTrigger(item.key, e)"
        @mouseleave="handleDropdownTriggerLeave(item.key, $event)" :aria-label="item.ariaLabel" aria-haspopup="true"
        :aria-expanded="openDropdownKey === item.key">
        {{ item.label }}
      </button>
      <button v-if="item && item.type === 'button'" class="menu-item" :class="{ active: activeIndex === item.key }"
        :ref="bindMenuItemRef(index)" @click="handleMenuClick(item)" :aria-label="item.ariaLabel"
        :aria-current="activeIndex === item.key ? 'page' : undefined" type="button">
        {{ item.label }}
      </button>
      <a v-else-if="item && item.type === 'link'" class="menu-item" :ref="bindMenuItemRef(index)" :href="item.href"
        :target="item.target" :aria-label="item.ariaLabel">
        {{ item.label }}
      </a>
    </template>

    <!-- 单一下拉层：根据 openDropdownKey 显示，避免 v-for 内 Teleport 导致不显示 -->
    <Teleport to="body">
      <div v-if="currentDropdownItem && currentDropdownItem.children?.length" class="dropdown-menu header-nav-dropdown"
        :style="{
          position: 'fixed',
          zIndex: 'var(--z-popover)',
          display: 'block',
          visibility: 'visible',
          opacity: 1,
          pointerEvents: 'auto',
          top: dropdownMenuPosition.top,
          left: dropdownMenuPosition.left,
          right: 'auto',
        }" :ref="bindDropdownMenuRef" @mouseenter="openDropdownKey && toggleDropdown(openDropdownKey, true)"
        @mouseleave="openDropdownKey && handleDropdownMenuLeave(openDropdownKey, $event)">
        <button v-for="child in currentDropdownItem.children" :key="child.key" class="dropdown-item" type="button"
          :class="{ active: activeIndex === child.key }" @click="handleMenuClick(child)">
          {{ child.label }}
        </button>
      </div>
    </Teleport>

    <!-- 更多功能按钮 - 只有当有隐藏项时才显示 -->
    <div v-show="hiddenMenuItems.length > 0" class="menu-item dropdown" :class="{
      open: showMoreMenu,
    }" :ref="setMoreButtonRef" @mouseenter="openMoreMenu" @mouseleave="handleMoreTriggerLeave">
      <button class="dropdown-trigger" type="button" @mousedown.stop="handleMoreButtonMouseDown"
        @click.stop="toggleMoreMenu" @mouseup.stop :aria-label="moreFeaturesLabel" aria-haspopup="true"
        :aria-expanded="showMoreMenu">
        {{ moreFeaturesLabel }}
      </button>
      <!-- Teleport 到 body 避免 header 内 transform/overflow 影响 fixed 定位 -->
      <Teleport to="body">
        <div v-if="showMoreMenu" class="dropdown-menu header-nav-more-dropdown" data-more-menu="true"
          :style="moreMenuStyle" :ref="setMoreMenuContainerRef" @mouseenter="onMorePanelEnter"
          @mouseleave="handleMoreMenuLeave">
          <template v-if="hiddenMenuItems.length > 0">
            <template v-for="item in hiddenMenuItems" :key="item?.key">
              <button v-if="item && item.type === 'button'" class="dropdown-item"
                :class="{ active: activeIndex === item.key }" @click="handleMenuClick(item)" type="button">
                {{ item.label }}
              </button>
              <a v-else-if="item && item.type === 'link'" class="dropdown-item" :href="item.href" :target="item.target">
                {{ item.label }}
              </a>
              <template v-else-if="item && item.type === 'dropdown' && item.children">
                <template v-for="child in item.children" :key="child?.key">
                  <button v-if="child && child.type === 'button'" class="dropdown-item"
                    :class="{ active: activeIndex === child.key }" @click="handleMenuClick(child)" type="button">
                    {{ child.label }}
                  </button>
                  <a v-else-if="child && child.type === 'link'" class="dropdown-item" :href="child.href"
                    :target="child.target">
                    {{ child.label }}
                  </a>
                </template>
              </template>
            </template>
          </template>
          <div v-else class="dropdown-item empty-menu">
            <span style="color: var(--el-text-color-secondary); font-size: 14px;">
              {{ t('navigation.noMoreItems') }}
            </span>
          </div>
        </div>
      </Teleport>
    </div>
  </nav>

  <!-- 移动端导航菜单组件 -->
  <MobileMenu :showMenu="showMenu" @close="closeMenus" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useThrottleFn, useEventListener } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import { useEduPlatformNav } from '@/composables/useEduPlatformNav'
import { useCleanup } from '@/composables/useCleanup'

// 确保 logger 存在，如果不存在则创建一个安全的 logger
const safeLogger = logger || {
  debug: () => { },
  error: () => { },
  warn: () => { },
  info: () => { }
}
import { getI18nGlobal } from '@/locales'

// 使用动态导入优化组件体积
const MobileMenu = defineAsyncComponent(() => import('./MobileMenu.vue'))

// 2026-06-26 修复: 与 Header.vue / MobileMenu.vue 同形 - 顶层 useRouter/useRoute
// 改为 try/catch + 懒加载, 防止 Vite HMR / Teleport 渲染时机异常时
// 'injection "Symbol(router)" not found' / 'injection "Symbol(route location)" not found'
// 警告级联到 ErrorBoundary 兜底白屏.
let router: ReturnType<typeof useRouter> | null = null
try {
  router = useRouter()
} catch (e) {
  if (import.meta.env.DEV) {
    safeLogger.debug('[HeaderNavigation] useRouter unavailable on init:', e)
  }
}

let route: ReturnType<typeof useRoute> | null = null
try {
  route = useRoute()
} catch (e) {
  if (import.meta.env.DEV) {
    safeLogger.debug('[HeaderNavigation] useRoute unavailable on init:', e)
  }
}

const getRouter = (): ReturnType<typeof useRouter> | null => {
  if (router) return router
  try {
    router = useRouter()
    return router
  } catch {
    return null
  }
}

const getRoute = (): ReturnType<typeof useRoute> | null => {
  if (route) return route
  try {
    route = useRoute()
    return route
  } catch {
    return null
  }
}

// 2026-06-26 修复: 包装 route 访问, route 为 null 时回退到空路径
// 解决 useRouter/useRoute 上下文注入失败时模板渲染报错的问题
const safeRoute = computed(() => {
  const r = getRoute()
  if (r) return r
  return {
    path: '/',
    name: undefined as string | undefined,
    query: {} as Record<string, unknown>,
    params: {} as Record<string, unknown>,
    fullPath: '/',
    meta: {} as Record<string, unknown>,
  } as unknown as ReturnType<typeof useRoute>
})

// 使用全局作用域，因为组件在 Teleport 中会失去父级作用域
interface UseI18nOptions {
  useScope?: 'global' | 'local'
}
const { t, locale } = (useI18n as (options?: UseI18nOptions) => ReturnType<typeof useI18n>)({ useScope: 'global' })

// 从auth store获取登录状态（供模板或后续逻辑使用）
const _authStore = useAuthStore()

// 定义emits
const emit = defineEmits(['select'])

// 根据当前路由自动计算activeIndex
// 注意：route 可能在组件刚挂载/HMR/路由切换瞬间短暂为 undefined，需要做空值保护
const activeIndex = computed(() => {
  const routeName = ((route as { name?: string | symbol } | undefined)?.name ?? '') as string
  const routePath = route?.path ?? ''

  if (routeName === 'home' || routePath === '/' || routePath === '/home') {
    return 'home'
  } else if (
    routeName === 'xuqiu' ||
    routeName === 'plaza' ||
    routePath === '/xuqiu' ||
    routePath === '/plaza'
  ) {
    return 'xuqiu'
  } else if (routeName === 'agents' || routePath === '/agents' || routePath.startsWith('/agents')) {
    return 'agents'
  } else if (
    routeName === 'openPlatform' ||
    routeName === 'openPlatformProxy' ||
    routePath === '/open' ||
    (routePath.startsWith('/open/') && !routePath.startsWith('/open/document'))
  ) {
    return 'openPlatform'
  } else if (
    routeName === 'learnAI' ||
    routePath === '/learn-ai' ||
    routePath.startsWith('/learn-ai/')
  ) {
    return 'learnAI'
  } else if (
    routeName === 'aiCommunity' ||
    routePath === '/ai-community' ||
    routePath.startsWith('/ai-community/')
  ) {
    return 'aiCommunity'
  } else if (routeName === 'userCenter' || routePath === '/user-center') {
    return 'userCenter'
  } else if (routeName === 'vipMembership' || routePath === '/vip-membership') {
    return 'vipMembership'
  } else if (routeName === 'distributionCenter' || routePath === '/distribution-center') {
    return 'distributionCenter'
  } else if (routeName === 'recharge' || routePath === '/recharge') {
    return 'recharge'
  } else if (routeName === 'withdrawal' || routePath === '/withdrawal') {
    return 'withdrawal'
  } else if (routeName === 'orderList' || routePath === '/order-list') {
    return 'orderList'
  } else if (routeName === 'distributionOrderList' || routePath === '/distribution-order-list') {
    return 'distributionOrderList'
  } else if (routeName === 'myCommission' || routePath === '/my-commission') {
    return 'myCommission'
  } else if (routeName === 'aiTeam' || routePath === '/ai-team') {
    return 'aiTeam'
  } else if (routeName === 'aiAssistant' || routePath === '/ai-assistant') {
    return 'aiAssistant'
  } else if (routeName === 'n8nAssistant' || routePath === '/n8n-assistant') {
    return 'n8nAssistant'
  } else if (routeName === 'share' || routePath.startsWith('/share')) {
    return 'share'
  } else if (routeName === 'businessCard' || routePath === '/business-card') {
    return 'businessCard'
  } else if (routeName === 'forgotPassword' || routePath === '/forgot-password') {
    return 'forgotPassword'
  } else if (routeName === 'documentCenter' || routePath === '/support/document-center' || routePath === '/docs' || routePath.startsWith('/docs')) {
    return 'documentCenter'
  } else if (routeName === 'newsCenter' || routePath === '/about/news-center') {
    return 'newsCenter'
  } else if (routeName === 'aboutUs' || routePath === '/about/about-us') {
    return 'aboutUs'
  } else if (routeName === 'becomeSupplier' || routePath === '/about/become-supplier') {
    return 'becomeSupplier'
  }
  return ''
})

// 移动端菜单相关状态
const showMenu = ref(false)
const isMobile = ref(false)

// 响应式菜单相关状态
const menuContainerRef = ref<HTMLElement | null>(null)
const menuItemRefs = ref<(HTMLElement | null)[]>([])
const showMoreMenu = ref(false)
const moreMenuContainerRef = ref<HTMLElement | null>(null)
const moreButtonRef = ref<HTMLElement | null>(null)
/** 更多功能下拉的内联样式，避免被全局 .dropdown-menu 的 opacity/visibility 覆盖 */
const moreMenuStyle = ref<Record<string, string>>({})
const dropdownMenuRefs = ref<Map<string, HTMLElement | null>>(new Map())
const dropdownTriggerRefs = ref<Map<string, HTMLElement | null>>(new Map())

// 计算"更多功能"按钮的翻译文本
const moreFeaturesLabel = computed(() => {
  return t('navigation.moreFeatures')
})
// 内部状态，用于存储计算后的可见菜单项
const internalVisibleMenuItems = ref<MenuItems[] | null>(null)
const hiddenMenuItems = ref<MenuItems[]>([])
let menuResizeObserver: ResizeObserver | null = null
const bodyOverflowBackup = ref<string | null>(null)

// 2026-06-26 修复: 监听 locale 变化, 重置 internalVisibleMenuItems 强制重新计算可见菜单
// 背景: allMenuItems 已经是 computed (依赖 locale.value), 但 visibleMenuItems 优先使用
//       internalVisibleMenuItems.value 的缓存快照 (用于响应窗口宽度), 而该缓存不依赖 locale,
//       导致语言切换后 Header 核心菜单项 (首页/AI应用商店/学习AI) 仍显示切换前的语言
// 修复: 切换语言时清空缓存, 触发 allMenuItems 重新求值, 内部 resize observer 在用户实际操作
//       (鼠标悬停/键盘 focus 等) 时再填充 hiddenMenuItems 即可. 切换瞬间短暂回退到
//       全部展示, 不影响用户.
watch(locale, () => {
  internalVisibleMenuItems.value = null
})
const teardownResizeObserver = () => {
  if (menuResizeObserver) {
    menuResizeObserver.disconnect()
    menuResizeObserver = null
  }
}

const setupResizeObserver = () => {
  if (!menuContainerRef.value || typeof ResizeObserver === 'undefined') {
    return
  }
  teardownResizeObserver()
  menuResizeObserver = new ResizeObserver(() => {
    // 使用防抖避免频繁计算
    if (calculateTimeout) {
      clearTimeout(calculateTimeout)
    }
    calculateTimeout = setTimeout(() => {
      calculateVisibleItems()
    }, 100)
  })
  menuResizeObserver.observe(menuContainerRef.value)
}
// 计算属性：如果还没计算过，显示所有菜单项；否则显示计算后的结果
const visibleMenuItems = computed(() => {
  let items: MenuItems[] = []
  if (internalVisibleMenuItems.value === null) {
    // 初始状态：显示所有菜单项（移动端除外）
    items = isMobile.value ? [] : allMenuItems.value
  } else {
    items = internalVisibleMenuItems.value
  }
  // 过滤掉 undefined 或 null 值，确保所有项都是有效的
  return items.filter(
    (item): item is MenuItems => item !== null && typeof item === 'object' && 'type' in item
  )
})

function closeMenus() {
  if (isMobile.value && showMenu.value) {
    showMenu.value = false
  }
  openDropdownKey.value = null
  showMoreMenu.value = false
  // 确保在异常情况下恢复 body overflow（防止某些按键路径未触发 watcher）
  restoreBodyOverflow()
}

function goToPath(path: string, key: string) {
  const r = getRouter()
  if (r) {
    r.push(path)
  } else if (typeof window !== 'undefined') {
    // 路由上下文不可用, 降级为整页跳转
    window.location.href = path
  }
  emit('select', key)
  closeMenus()
}

function goToHome() {
  // 如果现在在首页中，点击后切换到第一分页
  const isOnHomePage = activeIndex.value === 'home'
  if (isOnHomePage) {
    // 切换到第一分页（滚动到顶部）
    const homeContainer = document.querySelector('.home-container') as HTMLElement | null
    if (homeContainer) {
      // 优先使用 id 选择器定位第一页，更精确
      const firstPage = document.getElementById('first-page') as HTMLElement | null
      if (firstPage) {
        firstPage.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        // 如果找不到第一页元素，尝试查找第一个.page-section
        const firstPageSection = homeContainer.querySelector('.page-section:first-child') as HTMLElement | null
        if (firstPageSection) {
          firstPageSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          // 如果都找不到，直接滚动容器到顶部
          homeContainer.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
      emit('select', 'home')
      closeMenus()
      return
    }
  }
  // 不在首页或未找到容器，正常跳转
  goToPath('/', 'home')
}

function goToAgents() {
  goToPath('/agents', 'agents')
}

function _goToXuqiu() {
  goToPath('/xuqiu', 'xuqiu')
}

function goToOpenPlatform() {
  goToPath('/open', 'openPlatform')
}

function goToLearnAI() {
  goToPath('/learn-ai', 'learnAI')
}

// 构建项目URL（用于跳转到其他端口的项目）- 保留供将来使用
const _buildProjectUrl = (port: string | number | null, path = ''): string => {
  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const portValue = port === null || port === '' ? '' : String(port)
  const portPart = portValue ? `:${portValue}` : ''
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${protocol}//${hostname}${portPart}${normalizedPath}`
}

// 教育平台跳转（用户端 / 总管理端），复用 composable，跳转后关闭菜单
const { goToEduWeb, goToEduAdmin } = useEduPlatformNav({ onDone: closeMenus })

function goToAICommunity() {
  goToPath('/ai-community', 'aiCommunity')
}

function _goToUserCenter() {
  goToPath('/user-center', 'userCenter')
}

function _goToVIPMembership() {
  goToPath('/vip-membership', 'vipMembership')
}

function _goToDistributionCenter() {
  goToPath('/distribution-center', 'distributionCenter')
}

function _goToRecharge() {
  goToPath('/recharge', 'recharge')
}

function _goToWithdrawal() {
  goToPath('/withdrawal', 'withdrawal')
}

function _goToOrderList() {
  goToPath('/order-list', 'orderList')
}

function _goToDistributionOrderList() {
  goToPath('/distribution-order-list', 'distributionOrderList')
}

function _goToMyCommission() {
  goToPath('/my-commission', 'myCommission')
}

function _goToAITeam() {
  goToPath('/ai-team', 'aiTeam')
}

function _goToAIAssistant() {
  goToPath('/ai-assistant', 'aiAssistant')
}

function _goToN8NAssistant() {
  goToPath('/n8n-assistant', 'n8nAssistant')
}

function _goToPlaza() {
  goToPath('/plaza', 'plaza')
}

function _goToShare() {
  goToPath('/share', 'share')
}

function _goToBusinessCard() {
  goToPath('/business-card', 'businessCard')
}

function _goToForgotPassword() {
  goToPath('/forgot-password', 'forgotPassword')
}

// 服务与支持相关路由（条款与政策已整合到文档中心）
function goToDocumentCenter() {
  goToPath('/support/document-center', 'documentCenter')
}

// 关于我们相关路由
function goToNewsCenter() {
  goToPath('/about/news-center', 'newsCenter')
}

function goToAboutUs() {
  goToPath('/about/about-us', 'aboutUs')
}

function goToBecomeSupplier() {
  goToPath('/about/become-supplier', 'becomeSupplier')
}


// 菜单项数据结构
interface MenuItems {
  key: string
  label: string
  type: 'button' | 'link' | 'dropdown'
  href?: string
  target?: string
  ariaLabel: string
  handler?: () => void
  children?: MenuItems[]
}

// 所有菜单项配置
// 确保计算属性依赖于 locale，以便在语言切换时重新计算
const allMenuItems = computed<MenuItems[]>(() => {
  // 依赖 locale.value 确保语言切换时重新计算
  void locale.value
  const getTranslation = (key: string) => {
    try {
      const translation = t(key)
      if (translation && translation !== key) {
        return translation
      }
      const i18nGlobal = getI18nGlobal()
      if (i18nGlobal) {
        try {
          const globalTranslation = String(i18nGlobal.t(key))
          if (globalTranslation && globalTranslation !== key) {
            return globalTranslation
          }
        } catch (_e) {
          // 忽略全局 i18n 获取失败
          void _e
        }
      }
      return translation || key
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.error(t('common.errors.operationFailed'), { key, error })
      }
      return key
    }
  }
  // 菜单项配置 - 所有项目都展开为独立按钮，根据可用宽度动态显示
  // 排序策略：核心功能优先，次要功能放后面（放不下时自动进入"更多功能"）
  const items: MenuItems[] = [
    // === 核心功能 ===
    {
      key: 'home',
      label: getTranslation('common.home'),
      type: 'button',
      ariaLabel: getTranslation('common.home'),
      handler: goToHome,
    },
    {
      key: 'agents',
      label: getTranslation('navigation.aiStore'),
      type: 'button',
      ariaLabel: getTranslation('navigation.aiStore'),
      handler: goToAgents,
    },
    {
      key: 'openPlatform',
      label: t('routes.openPlatform'),
      type: 'button',
      ariaLabel: t('routes.openPlatform'),
      handler: goToOpenPlatform,
    },
    // 学习AI：点击直接跳转 /learn-ai；悬停展开下拉仅含「用户端」「管理端」
    {
      key: 'learnAI',
      label: t('common.learnAI'),
      type: 'dropdown',
      ariaLabel: t('common.learnAI'),
      handler: goToLearnAI,
      children: [
        {
          key: 'eduWeb',
          label: t('login.project.user'),
          type: 'button',
          ariaLabel: t('login.project.user'),
          handler: goToEduWeb,
        },
        {
          key: 'eduAdmin',
          label: t('login.project.admin'),
          type: 'button',
          ariaLabel: t('login.project.admin'),
          handler: goToEduAdmin,
        },
      ],
    },
    {
      key: 'aiCommunity',
      label: t('routes.aiCommunity'),
      type: 'button',
      ariaLabel: t('routes.aiCommunity'),
      handler: goToAICommunity,
    },
    {
      key: 'aiWorld',
      label: t('common.aiWorld'),
      type: 'link',
      href: '/ai-world',
      ariaLabel: t('common.aiWorld'),
    },
    // === 服务与支持（客服已整合进 AI 对话悬浮窗，不再单独入口） ===
    {
      key: 'documentCenter',
      label: t('navigation.documentCenter'),
      type: 'button',
      ariaLabel: t('navigation.documentCenter'),
      handler: goToDocumentCenter,
    },
    // === 关于我们 - 展开为独立按钮 ===
    {
      key: 'newsCenter',
      label: t('navigation.newsCenter'),
      type: 'button',
      ariaLabel: t('navigation.newsCenter'),
      handler: goToNewsCenter,
    },
    {
      key: 'aboutUs',
      label: t('navigation.aboutUs'),
      type: 'button',
      ariaLabel: t('navigation.aboutUs'),
      handler: goToAboutUs,
    },
    {
      key: 'becomeSupplier',
      label: t('navigation.becomeSupplier'),
      type: 'button',
      ariaLabel: t('navigation.becomeSupplier'),
      handler: goToBecomeSupplier,
    },
  ]

  // 2026-06-24: 后端模块缺失, 临时隐藏入口避免用户 404
  // 隐藏社区 v2 (后端社区在 /api/v1/circle/* 和 /api/v1/ask/*, 非 /api/v2/community/*)
  const HIDDEN_MENU_KEYS = ['aiCommunity']
  return items.filter(item => !HIDDEN_MENU_KEYS.includes(item.key))
})

// 设置菜单项引用
const setMenuItemRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    menuItemRefs.value[index] = el
  }
}

// 模板 ref 用：带类型的包装，避免 TS7006 隐式 any
const bindDropdownTriggerRef = (index: number, key: string) => (el: HTMLElement | null) => {
  setMenuItemRef(el, index)
  setDropdownTriggerRef(el, key)
}
const bindMenuItemRef = (index: number) => (el: HTMLElement | null) => setMenuItemRef(el, index)
const bindDropdownMenuRef = (el: HTMLElement | null) => {
  const key = openDropdownKey.value
  if (el && key) setDropdownMenuRef(el, key)
  else if (!el) clearDropdownMenuRefs()
}

const setMoreButtonRef = (el: HTMLElement | null) => {
  if (el && moreButtonRef) {
    moreButtonRef.value = el
  }
}

const setMoreMenuContainerRef = (el: HTMLElement | null) => {
  if (el && moreMenuContainerRef) {
    moreMenuContainerRef.value = el
  }
}

// 处理菜单点击
const handleMenuClick = (item: MenuItems) => {
  if (item.handler) {
    item.handler()
  }
  if (showMoreMenu.value) {
    showMoreMenu.value = false
  }
}

// 点击下拉触发器：学习AI 直接跳转；其他下拉只切换面板
function handleDropdownTriggerClick(item: MenuItems, e?: MouseEvent) {
  if (item.type !== 'dropdown') return
  if (item.key === 'learnAI') {
    goToLearnAI()
    toggleDropdown(item.key, false)
    return
  }
  const el = e?.currentTarget as HTMLElement | null
  if (el) dropdownTriggerEl.value = el
  // 只开不关：避免 hover 打开后 click 又关闭（关闭用点击外部或 ESC）
  toggleDropdown(item.key, true)
}

const openMoreMenu = () => {
  showMoreMenu.value = true
  moreMenuStyle.value = computeMoreMenuStyle()
  nextTick(() => {
    setTimeout(() => updateMoreMenuPosition(), 10)
  })
}

/** 鼠标已移入下拉面板（Teleport 到 body 时 relatedTarget 可能拿不到面板，用此标志避免误关） */
const morePanelMouseInside = ref(false)

const closeMoreMenu = () => {
  morePanelMouseInside.value = false
  showMoreMenu.value = false
}

const onMorePanelEnter = () => {
  morePanelMouseInside.value = true
  openMoreMenu()
}

// 处理更多按钮的 mouseleave（下拉在 body 时 relatedTarget 常为 null，用延迟+标志判断）
const handleMoreTriggerLeave = (event: MouseEvent) => {
  if (isTogglingMoreMenu) return
  const to = event.relatedTarget as Node | null
  const menu = moreMenuContainerRef.value
  if (menu && to && (menu === to || menu.contains(to))) return

  setTimeout(() => {
    if (!isTogglingMoreMenu && !morePanelMouseInside.value) {
      closeMoreMenu()
    }
  }, 280)
}


// 处理更多菜单的 mouseleave，避免从菜单移回按钮时被关闭（与 dropdown 逻辑一致）
const handleMoreMenuLeave = (event: MouseEvent) => {
  const triggerContainer = moreButtonRef.value
  const to = event.relatedTarget as Node | null
  if (triggerContainer && to && (triggerContainer === to || triggerContainer.contains(to))) {
    return
  }
  closeMoreMenu()
}

// 标记是否正在处理更多功能按钮点击（防止外部点击检测干扰）
let isTogglingMoreMenu = false

// 处理更多功能按钮的mousedown事件，提前设置标志
const handleMoreButtonMouseDown = (e: MouseEvent) => {
  // 在mousedown阶段就设置标志，确保在click事件触发前标志已设置
  isTogglingMoreMenu = true
  e.stopPropagation()
  safeLogger.debug(t('headerNav.moreFeaturesMouseDown'), {
    isTogglingMoreMenu: true,
    target: e.target,
  })
  // 延迟清除标志，给click事件足够时间（增加到300ms）
  setTimeout(() => {
    isTogglingMoreMenu = false
    safeLogger.debug(t('headerNav.moreFeaturesClearFlag'))
  }, 300)
}

// 切换更多菜单显示
const toggleMoreMenu = (e?: MouseEvent) => {
  safeLogger.debug(t('headerNav.moreFeaturesToggle'), {
    currentShowMoreMenu: showMoreMenu.value,
    hiddenMenuItemsLength: hiddenMenuItems.value.length,
    event: e,
    isTogglingMoreMenu,
  })

  if (e) {
    e.stopPropagation()
    e.preventDefault()
    isTogglingMoreMenu = true
    setTimeout(() => {
      isTogglingMoreMenu = false
    }, 300)
  }

  const wasOpen = showMoreMenu.value
  showMoreMenu.value = !showMoreMenu.value
  safeLogger.debug(t('headerNav.moreMenuSwitch', { value: showMoreMenu.value }), showMoreMenu.value, {
    wasOpen,
    nowOpen: showMoreMenu.value,
  })

  if (showMoreMenu.value && !wasOpen) {
    moreMenuStyle.value = computeMoreMenuStyle()
    nextTick(() => {
      setTimeout(() => updateMoreMenuPosition(), 50)
    })
  }
}

// 下拉菜单状态（桌面）
const openDropdownKey = ref<string | null>(null)
// 下拉层定位（用响应式绑定到模板）
const dropdownMenuPosition = ref({ top: '0px', left: '0px' })
// 打开时暂存触发器元素，用于直接取 getBoundingClientRect，避免 ref 未就绪导致位置在左上角
const dropdownTriggerEl = ref<HTMLElement | null>(null)
// 当前打开的下拉对应菜单项（用于单一下拉层渲染）
const currentDropdownItem = computed(() => {
  const key = openDropdownKey.value
  if (!key) return null
  return allMenuItems.value.find((i: MenuItems) => i.key === key) ?? null
})
// 存储下拉菜单关闭的延迟定时器
const dropdownCloseTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())

const toggleDropdown = (key: string, open?: boolean) => {
  // 清除该菜单的关闭定时器（如果存在）
  const timer = dropdownCloseTimers.value.get(key)
  if (timer) {
    clearTimeout(timer)
    dropdownCloseTimers.value.delete(key)
  }

  openDropdownKey.value =
    open === undefined ? (openDropdownKey.value === key ? null : key) : open ? key : null
  if (openDropdownKey.value === key) {
    // 优先用事件带来的触发器元素直接算位置，保证在按钮正下方
    if (dropdownTriggerEl.value) {
      const rect = dropdownTriggerEl.value.getBoundingClientRect()
      dropdownMenuPosition.value = {
        top: `${rect.bottom + 2}px`,
        left: `${rect.left}px`,
      }
      dropdownTriggerEl.value = null
    } else if (dropdownTriggerRefs.value.get(key)) {
      updateDropdownPosition(key)
    } else {
      nextTick(() => {
        const tryUpdate = (retries = 0) => {
          if (dropdownTriggerRefs.value.get(key)) {
            updateDropdownPosition(key)
            return
          }
          if (retries < 15) setTimeout(() => tryUpdate(retries + 1), 20)
        }
        tryUpdate()
      })
    }
  }
}

// 悬停打开下拉，并记录触发器元素用于定位
function openDropdownWithTrigger(key: string, e: MouseEvent) {
  const el = e?.currentTarget as HTMLElement | null
  if (el) dropdownTriggerEl.value = el
  toggleDropdown(key, true)
}

const handleDropdownTriggerLeave = (key: string, event: MouseEvent) => {
  const menu = dropdownMenuRefs.value.get(key)
  const to = event.relatedTarget as Node | null
  if (menu && to && (menu === to || menu.contains(to))) {
    return
  }

  // 清除之前的关闭定时器
  const existingTimer = dropdownCloseTimers.value.get(key)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  // 延迟关闭，给用户时间将鼠标移动到下拉菜单
  const closeTimer = setTimeout(() => {
    // 如果 openDropdownKey 仍然是当前 key，才关闭
    // 这样如果用户已经移动鼠标到菜单上（触发了 mouseenter），菜单不会被关闭
    if (openDropdownKey.value === key) {
      toggleDropdown(key, false)
    }
    dropdownCloseTimers.value.delete(key)
  }, 150) // 150ms 延迟，给用户足够时间移动鼠标到菜单

  dropdownCloseTimers.value.set(key, closeTimer)
}

const handleDropdownMenuLeave = (key: string, event: MouseEvent) => {
  const triggerContainer = dropdownTriggerRefs.value.get(key)
  const to = event.relatedTarget as Node | null
  if (triggerContainer && to && (triggerContainer === to || triggerContainer.contains(to))) {
    return
  }

  // 清除之前的关闭定时器
  const existingTimer = dropdownCloseTimers.value.get(key)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  // 延迟关闭，给用户时间将鼠标移回触发器
  const closeTimer = setTimeout(() => {
    if (openDropdownKey.value === key) {
      toggleDropdown(key, false)
    }
    dropdownCloseTimers.value.delete(key)
  }, 100) // 100ms 延迟

  dropdownCloseTimers.value.set(key, closeTimer)
}

// 设置下拉菜单 ref
const setDropdownMenuRef = (el: HTMLElement | null, key: string) => {
  if (el) {
    dropdownMenuRefs.value.set(key, el)
    nextTick(() => {
      updateDropdownPosition(key)
    })
  } else {
    dropdownMenuRefs.value.delete(key)
  }
}

// 清空下拉菜单 ref（单一下拉层卸载时调用）
const clearDropdownMenuRefs = () => {
  dropdownMenuRefs.value.clear()
}

// 设置下拉菜单触发器 ref
const setDropdownTriggerRef = (el: HTMLElement | null, key: string) => {
  if (el) {
    dropdownTriggerRefs.value.set(key, el)
  } else {
    dropdownTriggerRefs.value.delete(key)
  }
}

// 更新下拉菜单位置（同时写入响应式变量，保证模板里一定有正确的 top/left）
const updateDropdownPosition = (key: string) => {
  const triggerContainer = dropdownTriggerRefs.value.get(key)
  const trigger = triggerContainer?.querySelector('.dropdown-trigger') as HTMLElement | null
  if (!trigger) return

  const triggerRect = trigger.getBoundingClientRect()
  const top = `${triggerRect.bottom + 2}px`
  const left = `${triggerRect.left}px`
  dropdownMenuPosition.value = { top, left }

  const menu = dropdownMenuRefs.value.get(key)
  if (menu) {
    menu.style.position = 'fixed'
    menu.style.top = top
    menu.style.left = left
    menu.style.right = 'auto'
    menu.style.zIndex = 'var(--z-popover)'
    menu.style.display = 'block'
    menu.style.visibility = 'visible'
    menu.style.opacity = '1'
    menu.style.pointerEvents = 'auto'
  }
}

// 保证下拉可见的最小内联样式（避免被全局 .dropdown-menu 隐藏）
const MORE_MENU_BASE_STYLE: Record<string, string> = {
  position: 'fixed',
  right: 'auto',
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  zIndex: 'var(--z-popover)',
  width: 'max-content',
  minWidth: '140px',
  maxWidth: '300px',
  maxHeight: '90vh',
  overflowY: 'auto',
  overflowX: 'hidden',
  pointerEvents: 'auto',
}

// 根据触发按钮计算「更多功能」下拉的内联样式（首帧即可见、不依赖面板 ref）
const computeMoreMenuStyle = (): Record<string, string> => {
  const triggerContainer = moreButtonRef.value
  const trigger = triggerContainer?.querySelector('.dropdown-trigger') as HTMLElement | null
  if (!trigger) {
    return { ...MORE_MENU_BASE_STYLE, top: '60px', left: '20px' }
  }
  const triggerRect = trigger.getBoundingClientRect()
  const containerRect = triggerContainer!.getBoundingClientRect()
  return {
    ...MORE_MENU_BASE_STYLE,
    top: `${triggerRect.bottom + 2}px`,
    left: `${containerRect.left}px`,
    minWidth: `${Math.max(containerRect.width, 140)}px`,
  }
}

// 更新更多菜单位置（同步更新 moreMenuStyle，并可选地更新已挂载的 DOM）
let updateMoreMenuPositionRetryCount = 0
const MAX_RETRY_COUNT = 10
const updateMoreMenuPosition = () => {
  const triggerContainer = moreButtonRef.value
  const menu = moreMenuContainerRef.value

  // 先根据按钮位置更新内联样式，确保首帧就可见且位置正确
  const style = computeMoreMenuStyle()
  if (Object.keys(style).length) {
    moreMenuStyle.value = style
  }

  if (!triggerContainer) {
    updateMoreMenuPositionRetryCount = 0
    return
  }

  if (!menu) {
    if (updateMoreMenuPositionRetryCount < MAX_RETRY_COUNT) {
      updateMoreMenuPositionRetryCount++
      nextTick(() => {
        setTimeout(() => updateMoreMenuPosition(), 10)
      })
      return
    }
    updateMoreMenuPositionRetryCount = 0
    return
  }

  updateMoreMenuPositionRetryCount = 0
  const trigger = triggerContainer.querySelector('.dropdown-trigger') as HTMLElement | null
  if (!trigger) return

  const triggerRect = trigger.getBoundingClientRect()
  const containerRect = triggerContainer.getBoundingClientRect()
  menu.style.position = 'fixed'
  menu.style.top = `${triggerRect.bottom + 2}px`
  menu.style.left = `${containerRect.left}px`
  menu.style.right = 'auto'
  menu.style.display = 'block'
  menu.style.visibility = 'visible'
  menu.style.opacity = '1'
  menu.style.zIndex = 'var(--z-popover)'
  menu.style.minWidth = `${containerRect.width}px`
  menu.style.width = 'max-content'
  menu.style.height = 'auto'
  menu.style.maxHeight = '90vh'
  menu.style.maxWidth = '300px'
  menu.style.overflowY = 'auto'
  menu.style.overflowX = 'hidden'
  menu.style.pointerEvents = 'auto'

  const menuRect = menu.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  if (menuRect.right > viewportWidth) {
    menu.style.left = `${viewportWidth - menuRect.width - 10}px`
    moreMenuStyle.value = { ...moreMenuStyle.value, left: menu.style.left }
  }
  if (menuRect.bottom > viewportHeight) {
    const newTop = `${triggerRect.top - menuRect.height - 4}px`
    menu.style.top = newTop
    moreMenuStyle.value = { ...moreMenuStyle.value, top: newTop }
  }
}

// 计算可见和隐藏的菜单项
// 使用防抖避免多次调用导致闪烁
let calculateTimeout: ReturnType<typeof setTimeout> | null = null
let isCalculating = false // 防止重复计算

const calculateVisibleItems = () => {
  // 防止重复计算
  if (isCalculating) {
    return
  }

  // 移动端：在移动菜单中显示所有项，主菜单为空
  if (isMobile.value) {
    internalVisibleMenuItems.value = []
    hiddenMenuItems.value = []
    return
  }

  // 桌面端：如果容器未就绪，延迟重试
  if (!menuContainerRef.value) {
    // 如果之前已经计算过，保持当前状态；否则延迟重试
    if (internalVisibleMenuItems.value === null) {
      nextTick(() => {
        if (menuContainerRef.value) {
          calculateVisibleItems()
        }
      })
    }
    return
  }

  const container = menuContainerRef.value
  const containerWidth = container.offsetWidth

  // 如果容器宽度为0（DOM未渲染完成），延迟重试
  if (containerWidth === 0) {
    // 如果之前已经计算过，保持当前状态；否则延迟重试
    if (internalVisibleMenuItems.value === null) {
      nextTick(() => {
        if (menuContainerRef.value && menuContainerRef.value.offsetWidth > 0) {
          calculateVisibleItems()
        }
      })
    }
    return
  }

  isCalculating = true

  // 初始化变量，确保即使在错误情况下也能正确清理
  let totalWidth = 0
  const visible: MenuItems[] = []
  const remainingItems: MenuItems[] = []

  // 使用临时元素测量每个菜单项的宽度
  let tempContainer: HTMLDivElement | null = null
  try {
    if (typeof document === 'undefined' || !document.body) {
      // SSR环境，跳过测量
      internalVisibleMenuItems.value = []
      hiddenMenuItems.value = []
      isCalculating = false
      return
    }
    tempContainer = document.createElement('div')
    tempContainer.style.position = 'absolute'
    tempContainer.style.visibility = 'hidden'
    tempContainer.style.whiteSpace = 'nowrap'
    tempContainer.style.fontSize = '14px' // 与实际菜单项字体大小一致
    tempContainer.style.fontWeight = '700'
    tempContainer.style.padding = '0 16px' // 与实际菜单项 padding 一致
    tempContainer.style.height = '36px' // 与实际菜单项高度一致
    tempContainer.style.lineHeight = '36px' // 与实际菜单项行高一致
    tempContainer.style.fontFamily = 'inherit' // 确保字体与实际一致
    document.body.appendChild(tempContainer)
  } catch (error) {
    // 错误处理：如果无法创建临时容器，跳过测量，使用默认值
    logger.error('[More Features] Failed to create temporary container', error)
    internalVisibleMenuItems.value = []
    hiddenMenuItems.value = []
    isCalculating = false
    return
  }

  // 所有可显示的菜单项
  const displayableItems: MenuItems[] = allMenuItems.value && Array.isArray(allMenuItems.value)
    ? [...allMenuItems.value]
    : []

  // 预留的"更多功能"按钮宽度（只有在有隐藏项时才需要显示）
  // 使用较小的预留宽度，让更多菜单项能够显示
  const moreButtonWidth = 90 // "More Features" button estimated width
  const menuGap = 4 // 菜单项之间的间距

  // 先测量所有菜单项的宽度
  const itemWidths: number[] = []
  for (const item of displayableItems) {
    if (!item || typeof item !== 'object' || !('type' in item)) {
      itemWidths.push(0)
      continue
    }
    if (tempContainer) {
      tempContainer.textContent = item.label || ''
      itemWidths.push(tempContainer.offsetWidth + menuGap) // 包含间距
    } else {
      itemWidths.push((item.label || '').length * 14 + 32 + menuGap) // 估算宽度
    }
  }

  // 计算所有菜单项的总宽度
  const totalItemsWidth = itemWidths.reduce((sum, w) => sum + w, 0)

  // 如果所有菜单项都能放下，不需要显示"更多功能"按钮
  const needMoreButton = totalItemsWidth > containerWidth

  // 计算可用宽度（如果需要更多按钮，则预留空间）
  const availableWidth = needMoreButton ? containerWidth - moreButtonWidth - menuGap : containerWidth

  // 测量每个菜单项的宽度，尝试尽可能多地显示；优先保留下拉项在顶部栏（避免下拉框都进「更多」）
  for (let i = 0; i < displayableItems.length; i++) {
    const item = displayableItems[i]
    // 跳过无效项
    if (!item || typeof item !== 'object' || !('type' in item)) {
      continue
    }

    const itemWidth = itemWidths[i]

    // 检查是否可以容纳当前项
    if (totalWidth + itemWidth <= availableWidth) {
      visible.push(item)
      totalWidth += itemWidth
    } else {
      // 放不下时：若是下拉项，尝试用其替换最后一个可见的非下拉项，优先保留顶部栏的下拉框
      if (item.type === 'dropdown') {
        let lastNonDropdownIndex = -1
        for (let j = visible.length - 1; j >= 0; j--) {
          if (visible[j].type !== 'dropdown') {
            lastNonDropdownIndex = j
            break
          }
        }
        if (lastNonDropdownIndex >= 0) {
          const removed = visible[lastNonDropdownIndex]
          const removedIdx = displayableItems.indexOf(removed)
          const removedWidth = removedIdx >= 0 ? itemWidths[removedIdx] : 0
          const newTotal = totalWidth - removedWidth + itemWidth
          if (newTotal <= availableWidth) {
            visible.splice(lastNonDropdownIndex, 1, item)
            totalWidth = totalWidth - removedWidth + itemWidth
            remainingItems.push(removed)
            continue
          }
        }
      }
      remainingItems.push(item)
    }
  }

  // 移除重复项
  const uniqueHidden = Array.from(
    new Map(remainingItems.map(item => [item?.key, item])).values()
  ).filter((item): item is MenuItems => item !== null && typeof item === 'object' && 'type' in item)

  // 移除临时元素
  try {
    if (tempContainer && tempContainer.parentNode && typeof document !== 'undefined') {
      document.body.removeChild(tempContainer)
    }
  } catch (error) {
    // 静默处理，不影响主流程
    logger.error('[More Features] Failed to remove temporary container', error)
  }

  internalVisibleMenuItems.value = visible
  hiddenMenuItems.value = uniqueHidden
  isCalculating = false // 重置计算标志
}

// 点击外部关闭下拉菜单
const handleClickOutsideDropdown = (event: MouseEvent) => {
  const target = event.target
  if (!target || !(target instanceof Element)) return

  // 如果正在切换更多功能菜单，忽略此次点击检测
  if (isTogglingMoreMenu) {
    return
  }

  const container = menuContainerRef.value
  const clickInsideMenu = container?.contains(target) || target.closest('.mobile-menu')

  // 检查是否点击了"更多功能"按钮或菜单容器
  const moreButton = moreButtonRef.value
  const moreMenu = moreMenuContainerRef.value

  // 检查点击是否在更多功能按钮容器内（包括内部的button）
  let clickMoreButton = false
  if (moreButton) {
    // 检查是否是按钮本身
    if (moreButton === target || moreButton.contains(target)) {
      clickMoreButton = true
    } else {
      // 检查是否是按钮内的dropdown-trigger
      const trigger = moreButton.querySelector('.dropdown-trigger')
      if (trigger && (trigger === target || trigger.contains(target))) {
        clickMoreButton = true
      }
      // 检查是否通过closest找到
      const closestDropdown = target.closest('.menu-item.dropdown')
      if (closestDropdown === moreButton) {
        clickMoreButton = true
      }
    }
  }

  const clickMoreMenu = moreMenu && (moreMenu === target || moreMenu.contains(target))

  // 如果点击在任一导航下拉面板内，不关闭
  for (const menu of dropdownMenuRefs.value.values()) {
    if (menu && (menu === target || menu.contains(target))) return
  }

  // 如果点击在更多功能按钮或菜单内，不关闭
  if (clickMoreButton || clickMoreMenu) {
    return
  }

  // 如果点击在菜单容器内，也不关闭（可能是其他菜单项）
  if (clickInsideMenu) {
    return
  }

  // 否则关闭菜单
  if (showMoreMenu.value) {
    showMoreMenu.value = false
  }
  openDropdownKey.value = null
}

// 点击外部关闭菜单
const handleClickOutside = (event: MouseEvent) => {
  try {
    const target = event.target
    if (!target || !(target instanceof Element)) {
      return
    }
    if (
      isMobile.value &&
      showMenu.value &&
      !target.closest('.glass-header') &&
      !target.closest('.mobile-menu')
    ) {
      showMenu.value = false
    }
  } catch (_error) {
    // 静默处理错误
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (showMenu.value || showMoreMenu.value || openDropdownKey.value) {
      event.stopPropagation()
      event.preventDefault()
      closeMenus()
    }
  }
}

const restoreBodyOverflow = () => {
  if (bodyOverflowBackup.value !== null) {
    document.body.style.overflow = bodyOverflowBackup.value
    bodyOverflowBackup.value = null
  }
}

watch(
  () => showMenu.value,
  val => {
    if (typeof document === 'undefined') return
    if (val) {
      if (bodyOverflowBackup.value === null) {
        bodyOverflowBackup.value = document.body.style.overflow
      }
      document.body.style.overflow = 'hidden'
    } else {
      restoreBodyOverflow()
    }
  }
)

watch(
  () => allMenuItems.value.length,
  () => {
    // 延迟计算，确保 DOM 已更新
    if (calculateTimeout) {
      clearTimeout(calculateTimeout)
    }
    calculateTimeout = setTimeout(() => {
      nextTick(() => {
        calculateVisibleItems()
      })
    }, 100)
  }
)

watch(
  () => safeRoute.value.path,
  () => {
    closeMenus()
    // 延迟计算，确保 DOM 已更新
    if (calculateTimeout) {
      clearTimeout(calculateTimeout)
    }
    calculateTimeout = setTimeout(() => {
      nextTick(() => {
        calculateVisibleItems()
      })
    }, 100)
  }
)

watch(
  () => locale.value,
  () => {
    // 延迟计算，确保翻译文本已更新
    if (calculateTimeout) {
      clearTimeout(calculateTimeout)
    }
    calculateTimeout = setTimeout(() => {
      nextTick(() => {
        calculateVisibleItems()
      })
    }, 150) // 翻译可能需要更多时间
  }
)

// 更多功能菜单打开时，立即设置内联样式并更新位置（避免下拉不显示）
watch(
  () => showMoreMenu.value,
  isOpen => {
    if (isOpen) {
      moreMenuStyle.value = computeMoreMenuStyle()
      nextTick(() => {
        updateMoreMenuPosition()
        setTimeout(() => updateMoreMenuPosition(), 80)
      })
    }
  }
)

// 保存resize处理函数以便清理
const handleResize = useThrottleFn(() => {
  checkScreenSize()
  // 更新所有打开的下拉菜单位置
  if (openDropdownKey.value) {
    updateDropdownPosition(openDropdownKey.value)
  }
  if (showMoreMenu.value) {
    updateMoreMenuPosition()
  }
}, 150)

// 处理滚动事件，更新下拉菜单位置
const handleScroll = useThrottleFn(() => {
  if (openDropdownKey.value) {
    updateDropdownPosition(openDropdownKey.value)
  }
  if (showMoreMenu.value) {
    updateMoreMenuPosition()
  }
}, 100)

// 检查当前屏幕宽度
const checkScreenSize = () => {
  const wasMobile = isMobile.value
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) {
    showMenu.value = false
  }
  // 如果从移动端切换到桌面端，或者从桌面端切换到移动端，关闭所有下拉菜单
  if (wasMobile !== isMobile.value) {
    openDropdownKey.value = null
    showMoreMenu.value = false
  }
  // 使用防抖重新计算可见菜单项，避免多次调用导致闪烁
  if (calculateTimeout) {
    clearTimeout(calculateTimeout)
  }
  calculateTimeout = setTimeout(() => {
    calculateVisibleItems()
  }, 100) // 增加延迟时间，确保 DOM 已更新
}

// 监听来自 HeaderLogo 的菜单切换事件
const handleMobileMenuToggle = (event: CustomEvent) => {
  if (isMobile.value) {
    showMenu.value = event.detail.open
  }
}

onMounted(() => {
  // 初始化时检查屏幕尺寸，这会自动触发菜单项计算
  checkScreenSize()
  // 使用 useEventListener 自动处理事件清理
  useEventListener(window, 'resize', handleResize)
  useEventListener(window, 'orientationchange', handleResize)
  useEventListener(window, 'scroll', handleScroll, true) // 监听所有滚动事件
  useEventListener(document, 'click', (e: MouseEvent) => {
    // 同步处理移动端菜单关闭
    handleClickOutside(e)
    // 异步处理桌面下拉关闭，确保 toggleMoreMenu 先执行
    setTimeout(() => {
      handleClickOutsideDropdown(e)
    }, 0)
  })
  // 监听 Escape（window 已能捕获，无需重复注册 document）
  useEventListener(window, 'keydown', handleEscape)
  // 监听移动端菜单切换事件
  useEventListener(window, 'mobile-menu-toggle', handleMobileMenuToggle as EventListener)
  // 延迟初始化，确保 DOM 完全渲染
  setTimeout(() => {
    nextTick(() => {
      setupResizeObserver()
      calculateVisibleItems()
    })
  }, 200) // 给足够的时间让 DOM 渲染完成
})

const cleanup = useCleanup()
cleanup.add(() => {
  teardownResizeObserver()
  restoreBodyOverflow()
  dropdownCloseTimers.value.forEach((timer) => {
    clearTimeout(timer)
  })
  dropdownCloseTimers.value.clear()
})
</script>

<style lang="scss" scoped>
// 移动端菜单区域样式
:where(.mobile-menu-section) {
  padding: 12px 8px;
  border-bottom: var(--unified-border-bottom);
  width: 100%;
  box-sizing: border-box;

  &:last-child {
    border-bottom: none;
  }

  // 移动端搜索组件样式 - 全宽显示，图标在左侧
  :where(.search-wrapper) {
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    justify-content: flex-start;
    overflow: visible;
    position: relative;
    height: 36px;

    // 搜索输入框 - 全宽显示
    .input {
      position: relative;
      right: auto;
      left: 0;
      width: 100%;
      max-width: 100%;
      opacity: 1;
      background-color: var(--el-bg-color);
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      padding-left: 36px;
      padding-right: 8px;
      transition: all 0.25s ease;
      height: 36px;
      font-size: 14px;
      box-sizing: border-box;
    }

    // 展开状态也保持全宽
    .input.expanded {
      width: 100%;
      opacity: 1;
    }

    // 搜索图标按钮 - 绝对定位在左侧
    #search-icon {
      position: absolute;
      left: 8px;
      right: auto;
      top: 50%;
      transform: translateY(-50%);
      z-index: calc(var(--z-base) + 1);
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      pointer-events: auto;
    }
  }

  // 暗色模式下的搜索框
  :where(.search-wrapper.dark-mode) {
    .input {
      background-color: var(--el-bg-color);
      border-color: var(--el-border-color);
      color: var(--el-text-color-primary);
    }
  }
}

// 主菜单项容器
.main-menu-items {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  height: 48px;
  overflow: visible;

  // 菜单项 CSS 变量定义
  --menu-item-padding: 8px 16px;
  --menu-item-font-size: 14px;
  --menu-item-font-weight: 700;
  --menu-item-line-height: 1.5;
  --menu-item-height: 36px;

  // 菜单项颜色变量
  --menu-item-color: var(--el-text-color-primary);
  --menu-item-bg: transparent;
  --menu-item-hover-bg: var(--el-fill-color-light);
  --menu-item-hover-color: var(--el-text-color-primary);
  --menu-item-active-bg: var(--el-color-primary);
  --menu-item-active-color: var(--el-bg-color-page);
  --menu-item-border: none;
  --menu-item-hover-border: var(--unified-border);
  --menu-item-active-border: var(--el-border-width-primary) solid var(--el-color-primary);
}

// 菜单项基础样式
.menu-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--menu-item-padding);
  font-size: var(--menu-item-font-size);
  font-weight: var(--menu-item-font-weight);
  font-family: var(--font-family-chinese);
  line-height: var(--menu-item-line-height);
  color: var(--menu-item-color);
  background-color: var(--menu-item-bg);
  border: var(--menu-item-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  height: var(--menu-item-height);
  min-height: var(--menu-item-height);
  max-height: var(--menu-item-height);
  box-sizing: border-box;
  flex-shrink: 0;

  &:hover {
    background-color: var(--menu-item-hover-bg);
    color: var(--menu-item-hover-color);
    border: var(--menu-item-hover-border);
  }

  &.active {
    background-color: var(--menu-item-active-bg);
    color: var(--menu-item-active-color);
    border: var(--menu-item-active-border);
    font-weight: 600;
  }
}

button.menu-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--menu-item-padding);
  font-size: var(--menu-item-font-size);
  font-weight: var(--menu-item-font-weight);
  font-family: var(--font-family-chinese);
  line-height: var(--menu-item-line-height);
  color: var(--menu-item-color);
  background-color: var(--menu-item-bg);
  border: var(--menu-item-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  height: var(--menu-item-height);
  min-height: var(--menu-item-height);
  max-height: var(--menu-item-height);
  box-sizing: border-box;
  appearance: none;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background-color: var(--menu-item-hover-bg);
    color: var(--menu-item-hover-color);
    border: var(--menu-item-hover-border);
  }

  &.active {
    background-color: var(--menu-item-active-bg);
    color: var(--menu-item-active-color);
    border: var(--menu-item-active-border);
    font-weight: 600;
  }
}

a.menu-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--menu-item-padding);
  font-size: var(--menu-item-font-size);
  font-weight: var(--menu-item-font-weight);
  font-family: var(--font-family-chinese);
  line-height: var(--menu-item-line-height);
  color: var(--menu-item-color);
  background-color: var(--menu-item-bg);
  border: var(--menu-item-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  height: var(--menu-item-height);
  min-height: var(--menu-item-height);
  max-height: var(--menu-item-height);
  box-sizing: border-box;
  appearance: none;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background-color: var(--menu-item-hover-bg);
    color: var(--menu-item-hover-color);
    border: var(--menu-item-hover-border);
  }

  &.active {
    background-color: var(--menu-item-active-bg);
    color: var(--menu-item-active-color);
    border: var(--menu-item-active-border);
    font-weight: 600;
  }
}

div.menu-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--menu-item-padding);
  font-size: var(--menu-item-font-size);
  font-weight: var(--menu-item-font-weight);
  font-family: var(--font-family-chinese);
  line-height: var(--menu-item-line-height);
  color: var(--menu-item-color);
  border: var(--menu-item-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  height: var(--menu-item-height);
  min-height: var(--menu-item-height);
  max-height: var(--menu-item-height);
  box-sizing: border-box;
  flex-shrink: 0;

  &:hover {
    background-color: var(--menu-item-hover-bg);
    color: var(--menu-item-hover-color);
    border: var(--menu-item-hover-border);
  }

  &.active {
    background-color: var(--menu-item-active-bg);
    color: var(--menu-item-active-color);
    border: var(--menu-item-active-border);
    font-weight: 600;
  }

  .dropdown-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 32px;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    color: inherit;
    background-color: transparent;
    cursor: pointer;
    white-space: nowrap;
  }
}

// 组件特有样式（全局样式在 index.scss 中定义）

// ═══════════════════════════════════════════════════════════════════════════
// 下拉菜单样式 - 大气简约未来科技风
// 设计理念：玻璃拟态 + 精密边框 + 多层阴影 + 微妙光效
// ═══════════════════════════════════════════════════════════════════════════

// 入场动画 - 使用物理感的贝塞尔曲线
@keyframes dropdownReveal {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// “更多功能”下拉 Teleport 到 body，需强制覆盖全局 :where(.dropdown-menu) 的 opacity/visibility
.header-nav-more-dropdown {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.dropdown-menu.header-nav-dropdown,
.dropdown-menu {
  // 定位与尺寸 - 宽度随内容自适应，避免右侧大片空白
  position: fixed;
  width: max-content;
  min-width: 140px;
  max-width: min(280px, 95vw);
  height: auto;
  min-height: 44px;
  max-height: 85vh;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  z-index: var(--z-max);
  pointer-events: auto;

  // 玻璃拟态背景（保证可读、可点）
  background: var(--color-white-98);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);

  // 精密边框 - 极细描边（扁平化：无 box-shadow）
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  // 内边距
  padding: 8px;

  // 入场动画
  animation: dropdownReveal 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;

  // 滚动条样式
  scrollbar-width: thin;
  scrollbar-color: var(--color-black-15) transparent;

  // 显示状态
  display: block;
  visibility: visible;
  opacity: 1;

  // 鼠标桥接区域 - 帮助平滑过渡（不阻挡下方菜单项点击）
  &::before {
    content: '';
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 14px;
    background: transparent;
    pointer-events: none;
  }

  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    margin: 8px 0;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-black-12);
    border-radius: var(--global-border-radius);

    &:hover {
      background: var(--color-black-20);
    }
  }
}

// 导航下拉（Teleport 到 body）内的菜单项 - 保证可见可点
.header-nav-dropdown .dropdown-item {
  color: var(--color-dark-bg-4);
  pointer-events: auto;
  cursor: pointer;
}

.header-nav-dropdown .dropdown-item:hover {
  background-color: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  color: var(--el-color-primary);
}

// 暗色模式 - 深邃的科技感
:where(html.dark) .dropdown-menu {
  // 深色玻璃背景
  background: var(--color-dark-141419-95);
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);

  // 精密边框 - 微光边缘（扁平化：无 box-shadow）
  border-color: var(--border-unified-color);

  // 滚动条颜色
  scrollbar-color: var(--color-white-10) transparent;

  &::-webkit-scrollbar-thumb {
    background: var(--color-white-8);

    &:hover {
      background: var(--color-white-15);
    }
  }
}

// 暗色下导航下拉内菜单项文字保证可见
:where(html.dark) .header-nav-dropdown .dropdown-item {
  color: var(--color-white-95);
}

:where(html.dark) :where(.header-nav-dropdown) :where(.dropdown-item:hover) {
  color: var(--el-color-primary-light-3);
}

// ═══════════════════════════════════════════════════════════════════════════
// 下拉菜单项样式 - 精致的交互反馈
// ═══════════════════════════════════════════════════════════════════════════

.dropdown-item {
  // 布局
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 14px;
  margin-bottom: 2px;
  min-height: 36px;
  box-sizing: border-box;

  // 文字样式
  font-size: 14px;
  font-weight: 500;
  font-family: var(--font-family-chinese);
  color: var(--el-text-color-primary);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
  letter-spacing: 0.01em;

  // 背景与边框
  background-color: transparent;
  border: none;
  border-radius: var(--global-border-radius);

  // 交互 - 保证可点击、可选中
  cursor: pointer;
  pointer-events: auto;
  appearance: none;
  outline: none;
  user-select: text;
  -webkit-tap-highlight-color: transparent;

  // 过渡 - 使用高性能属性
  transition:
    background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  // 移除最后一项的底部间距
  &:last-child {
    margin-bottom: 0;
  }

  // 悬浮效果 - 微妙的位移和背景变化
  &:hover {
    background-color: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
    color: var(--el-color-primary);
    transform: translateX(3px);
    text-decoration: none;
  }

  // 焦点状态
  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--el-color-primary) 50%, transparent);
    outline-offset: -2px;
  }

  // 激活状态
  &.active {
    background-color: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
    color: var(--el-color-primary);
    font-weight: 600;

    // 左侧指示器
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 16px;
      background: var(--el-color-primary);
      border-radius: var(--global-border-radius);
    }
  }

  // 使用相对定位以支持 ::before
  position: relative;
}

// 暗色模式下的菜单项
:where(html.dark) .dropdown-item {
  color: var(--color-white-90);

  &:hover {
    background-color: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    color: var(--el-color-primary-light-3);
    text-decoration: none;
  }

  &.active {
    background-color: color-mix(in srgb, var(--el-color-primary) 20%, transparent);
    color: var(--el-color-primary-light-3);

    &::before {
      background: var(--el-color-primary);
    }
  }
}

// 响应式布局优化 - 通过 CSS 变量覆盖
@media (width <= 991px) {
  .main-menu-items {
    gap: 3px;
    // 覆盖 CSS 变量实现响应式
    --menu-item-padding: 8px 12px;
    --menu-item-font-size: 13px;
    --menu-item-height: 36px;
    --menu-item-line-height: 1.5;
  }
}

@media (width <= 767px) {
  .main-menu-items {
    display: none;
  }
}

@media (width <= 480px) {
  .dropdown-item {
    padding: 8px 12px;
    font-size: 13px;
  }
}

// 高分辨率屏幕优化 - 通过 CSS 变量覆盖
@media (width >= 1920px) {
  .main-menu-items {
    gap: 6px;
    // 覆盖 CSS 变量实现响应式
    --menu-item-padding: 10px 20px;
    --menu-item-font-size: 15px;
    --menu-item-height: 40px;
  }

  .dropdown-menu {
    padding: 6px 8px;
  }

  .dropdown-item {
    padding: 12px 18px;
    font-size: 15px;
  }
}

/* 暗色模式下选中/展开/激活的按钮：白底黑字（与未选中浅色文字、悬停浅色文字形成清晰层次） */
@layer utilities {

  html.dark button.menu-item.active,
  html.dark a.menu-item.active {
    background-color: var(--el-color-white);
    color: var(--el-color-black);
    border-color: var(--el-color-primary);
  }

  body .glass-header.dark-mode button.menu-item.active,
  body .glass-header.dark-mode a.menu-item.active,
  body :where(html.dark) .glass-header button.menu-item.active,
  body :where(html.dark) .glass-header a.menu-item.active {
    background-color: var(--el-color-white);
    color: var(--el-color-black);
    border-color: var(--el-color-primary);
  }
}

/* 深色模式下顶部菜单项：未选中/悬停用 Element Plus 暗色文字 token；选中用白底黑字 */
:where(.glass-header.dark-mode) .main-menu-items,
:where(html.dark) :where(.glass-header) .main-menu-items {
  --menu-item-color: var(--el-text-color-regular);
  --menu-item-hover-color: var(--el-text-color-primary);
  --menu-item-active-bg: var(--el-color-white);
  --menu-item-active-color: var(--el-color-black);
  --menu-item-active-border: var(--el-border-width-primary) solid var(--el-color-primary);
}

/* 默认态（未选中/未悬停/未展开）按钮文字：暗色主题下为浅色文字 */
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) .menu-item:not(.active):not(.open):not(:hover),
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) button.menu-item:not(.active):not(.open):not(:hover),
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) .menu-item:not(.active):not(.open):not(:hover),
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) button.menu-item:not(.active):not(.open):not(:hover) {
  color: var(--el-text-color-regular);
}

/* 悬停或展开时使用主文本色（dark 主题下也是浅色，对比 hover 时的深色底） */
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) .menu-item:hover,
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) button.menu-item:hover,
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) .menu-item.dropdown.open,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) .menu-item:hover,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) button.menu-item:hover,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) .menu-item.dropdown.open {
  color: var(--el-text-color-primary);
}

:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) .menu-item:hover .dropdown-trigger,
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) :where(.menu-item.dropdown.open) .dropdown-trigger,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) .menu-item:hover .dropdown-trigger,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) :where(.menu-item.dropdown.open) .dropdown-trigger {
  color: var(--el-text-color-primary);
}

/* 选中/展开：白底黑字（暗色主题下与未选中态形成强对比） */
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) .menu-item.active,
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) button.menu-item.active,
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) .menu-item.open,
:where(body) :where(.glass-header.dark-mode) :where(.main-menu-items) button.menu-item.open,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) .menu-item.active,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) button.menu-item.active,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) .menu-item.open,
:where(body) :where(html.dark) :where(.glass-header) :where(.main-menu-items) button.menu-item.open {
  background-color: var(--el-color-white);
  color: var(--el-color-black);
  border-color: var(--el-color-primary);
}
</style>
