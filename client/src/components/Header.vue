<template>
  <!-- 顶部菜单栏 - 直接使用glass-header，移除header-wrapper嵌套 -->
  <div class="glass-header" :class="{ 'dark-mode': isThemeDark, 'login-page-header': isLoginPage }">
    <!-- Logo部分 -->
    <HeaderLogo />

    <!-- 导航菜单 -->
    <HeaderNavigation @select="handleSelect" />

    <!-- 跨项目切换横幅（移动端显示） -->
    <div v-if="showCrossProjectBanner" class="header-cross-project-banner">
      <!-- 左侧：您正在登录文字 -->
      <el-icon class="banner-icon"><ArrowLeftRight /></el-icon>
      <span class="banner-text">{{ crossProjectText }}</span>

      <!-- 右侧：切换到 + 按钮 -->
      <div class="switch-section">
        <span class="switch-label">{{ t('login.crossProject.switchTo') }}</span>
        <el-button
          v-if="currentSource === 'admin' || currentSource === 'edu-admin'"
          size="small"
          type="primary"
          plain
          @click="switchProject('user')"
          class="switch-btn"
        >
          {{ t('login.crossProject.user') }}
        </el-button>
        <el-button
          v-if="currentSource === 'user' || currentSource === 'edu-web'"
          size="small"
          type="primary"
          plain
          @click="switchProject('admin')"
          class="switch-btn"
        >
          {{ t('login.crossProject.admin') }}
        </el-button>
      </div>
    </div>

    <!-- 项目选择器（移动端显示，当没有source参数时） -->
    <div v-if="showProjectSelector" class="header-project-selector">
      <el-icon class="selector-icon"><ArrowLeftRight /></el-icon>
      <span class="selector-title">{{ t('login.selectProject') }}</span>
      <div class="project-buttons">
        <button
          v-for="project in limitedProjects"
          :key="project.key"
          :class="['project-btn', { active: selectedProject === project.key }]"
          @click="selectProject(project.key)"
        >
          {{ project.name }}
        </button>
      </div>
    </div>

    <!-- 右侧功能区 -->
    <HeaderActions
      @language-change="handleLanguageChange"
      @show-login-popup="handleShowLoginPopup"
    />
  </div>
  <!-- glass-header 结束 -->
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, defineAsyncComponent } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '../utils/logger'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDarkModeStore } from '@/stores/darkMode'
import { ArrowLeftRight } from '@/lib/lucide-fallback'

// 常量定义
const MOBILE_BREAKPOINT = 768
// 统一使用8888端口
const PROJECT_PORTS = {
  admin: 8888,
  'edu-web': 8888,
  'edu-admin': 8888,
} as const

// 组件导入 - 使用动态导入优化首屏加载
const HeaderLogo = defineAsyncComponent(() => import('./header/HeaderLogo.vue'))
const HeaderNavigation = defineAsyncComponent(() => import('./header/HeaderNavigation.vue'))
const HeaderActions = defineAsyncComponent(() => import('./header/HeaderActions.vue'))

// 2026-06-26 修复: Header 在 App.vue 中通过 <Teleport to="body"> 渲染,
// 脱离了 RouterView 的 provide/inject 上下文, 顶层 useRoute/useRouter
// 会返回 undefined. 之前 HMR 抖动期也会偶发 'injection "Symbol(route location)"
// not found' 警告. 此处用 try-catch + 安全回退对象, 后续 watch/computed 访问
// route.query / route.path 时统一走 safeRoute.safeQuery, 避免抛错被
// ErrorBoundary 兜底为白屏. router 也同步兜底, 路由操作降级为 location.href.
const EMPTY_ROUTE = {
  path: '/',
  name: undefined as string | undefined,
  query: {} as Record<string, unknown>,
  params: {} as Record<string, unknown>,
  fullPath: '/',
  meta: {} as Record<string, unknown>,
}
let _route: ReturnType<typeof useRoute> = EMPTY_ROUTE as never
let _router: ReturnType<typeof useRouter> | null = null
try {
  _route = useRoute()
  _router = useRouter()
} catch (err) {
  // 路由上下文未就绪 (Teleport 脱离 / HMR 抖动), 回退到只读占位
  if (import.meta.env.DEV) {
    logger.warn('[Header] router context unavailable, using fallback:', err)
  }
}
const route = _route
const router = _router
const { t } = useI18n()

// 定义emits
const emit = defineEmits(['select', 'language-change', 'show-login-popup'])

// 事件处理函数
const handleSelect = (index: string) => {
  emit('select', index)
}

const handleLanguageChange = (lang: string) => {
  emit('language-change', lang)
}

const handleShowLoginPopup = () => {
  emit('show-login-popup')
}

// 以下代码已移至子组件，不再需要
// Logo相关代码已移至HeaderLogo.vue
// 导航相关代码已移至HeaderNavigation.vue
// Actions相关代码已移至HeaderActions.vue

// 判断是否为登录页面
const isLoginPage = computed(() => {
  return route.path === '/login'
})

const darkModeStore = useDarkModeStore()
const isThemeDark = computed(() => {
  return darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark'
})

// 构建项目URL
const buildProjectUrl = (port: number | null, path = ''): string => {
  if (typeof window === 'undefined') return ''

  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const currentPort = window.location.port
  const portValue = port === null ? currentPort : String(port)
  const portPart = portValue ? `:${portValue}` : ''
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''

  return `${protocol}//${hostname}${portPart}${normalizedPath}`
}

// 跨项目切换相关
const currentSource = computed(() => {
  return (route.query.source as string) || null
})

// 项目信息映射
const projectInfoMap = computed<Record<string, { name: string; url: string }>>(() => {
  if (typeof window === 'undefined') return {} as Record<string, { name: string; url: string }>

  const currentOrigin = buildProjectUrl(null)

  const result: Record<string, { name: string; url: string }> = {
    main: { name: t('login.project.main'), url: currentOrigin },
    open: { name: t('login.project.open'), url: `${currentOrigin}/open` },
    admin: {
      name: t('login.project.admin') || '总管理端',
      url: buildProjectUrl(PROJECT_PORTS.admin),
    },
    'edu-web': {
      name: t('login.project.eduWeb'),
      url: buildProjectUrl(PROJECT_PORTS['edu-web']),
    },
    'edu-admin': {
      name: t('login.project.eduAdmin') || '教育管理后台',
      url: buildProjectUrl(PROJECT_PORTS['edu-admin']),
    },
    user: { name: t('login.project.user'), url: buildProjectUrl(8888) },
  }

  return result
})

const sourceInfo = computed(() => {
  try {
    const source = currentSource.value
    if (!source) return null

    return projectInfoMap.value[source] || null
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    return null
  }
})

const crossProjectText = computed(() => {
  if (!sourceInfo.value) return ''

  try {
    return (
      t('login.crossProject.loggingIn', { project: sourceInfo.value.name }) ||
      `您正在登录 ${sourceInfo.value.name}`
    )
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    return `您正在登录 ${sourceInfo.value.name}`
  }
})

// 响应式窗口宽度检测
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const mobileBreakpoint = MOBILE_BREAKPOINT
const isMobile = computed(() => windowWidth.value < mobileBreakpoint)

// 监听窗口大小变化
let resizeRafId: number | null = null
const handleResize = () => {
  if (typeof window !== 'undefined') {
    if (resizeRafId !== null) return
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null
      windowWidth.value = window.innerWidth
    })
  }
}
const cleanup = useCleanup()
cleanup.add(() => {
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
})

const showCrossProjectBanner = computed(() => {
  // 只在移动端且存在sourceInfo时显示
  return isMobile.value && !!sourceInfo.value
})

// 项目选择器相关
const selectedProject = ref<string>('admin')

const availableProjects = computed(() => {
  return [
    {
      key: 'admin',
      name: t('login.project.admin') || '总管理端',
      url: buildProjectUrl(PROJECT_PORTS.admin),
    },
    {
      key: 'edu-web',
      name: t('login.project.eduWeb'),
      url: buildProjectUrl(PROJECT_PORTS['edu-web']),
    },
    {
      key: 'edu-admin',
      name: t('login.project.eduAdmin') || '教育管理后台',
      url: buildProjectUrl(PROJECT_PORTS['edu-admin']),
    },
  ]
})

// 限制显示的项目数量（只显示前2个，在一排显示）
const limitedProjects = computed(() => {
  return availableProjects.value.slice(0, 2)
})

const showProjectSelector = computed(() => {
  // 只在移动端、登录页、且没有currentSource时显示
  return isMobile.value && isLoginPage.value && !currentSource.value
})

const selectProject = (projectKey: string) => {
  // 如果点击的是当前已选中的项目，则取消选中
  if (selectedProject.value === projectKey) {
    selectedProject.value = 'admin' // 重置为默认值
    // 清除路由中的 source 参数
    const currentQuery: Record<string, string> = {}
    const querySource = (route.query ?? {}) as Record<string, unknown>
    Object.entries(querySource).forEach(([k, v]) => {
      if (typeof v === 'string') currentQuery[k] = v
    })
    delete currentQuery.source
    if (router) {
      router.replace({ path: '/login', query: currentQuery })
    } else if (typeof window !== 'undefined') {
      // 路由上下文未就绪, 降级到整页跳转避免阻塞
      window.location.href = '/login'
    }
    return
  }

  // 否则正常切换项目
  selectedProject.value = projectKey
  const project = availableProjects.value.find(p => p.key === projectKey)

  if (project) {
    // 使用字符串形式构造路由，避免类型错误
    const redirectUrl = encodeURIComponent(`${project.url}/index`)
    if (router) {
      router.replace(`/login?source=${projectKey}&redirect=${redirectUrl}`)
    } else if (typeof window !== 'undefined') {
      window.location.href = `/login?source=${projectKey}&redirect=${redirectUrl}`
    }
  }
}

// 2026-06-26 修复: watch getter 中访问 route.query 需走安全兜底, 避免
// Teleport 上下文未注入 router 时 (HMR / 卸载) 抛 'Cannot read properties
// of undefined (reading 'query')'. route 在 setup 顶部已经过 try-catch 兜底
// 一定不为 undefined, 但 query 在 vue-router 类型中是 LocationQuery (= Record
// of arrays/strings/null), 兼容类型避免 vue-tsc 报错同时运行时安全.
watch(
  () => (route.query && (route.query as Record<string, unknown>).source) as unknown,
  source => {
    selectedProject.value = (typeof source === 'string' ? source : null) || 'admin'
  },
  { immediate: true }
)

const switchProject = (targetSource: 'admin' | 'user') => {
  try {
    const current = currentSource.value
    if (!current) return

    const safeQuery = (route.query ?? {}) as Record<string, unknown>
    const newQuery = { ...safeQuery }

    if (targetSource === 'admin') {
      // 从用户端切换到管理端
      newQuery.source = current === 'user' ? 'admin' : 'edu-admin'
    } else {
      // 从管理端切换到用户端
      newQuery.source = current === 'admin' ? 'user' : 'edu-web'
    }

    // 使用字符串形式构造路由，避免类型错误
    const queryString = Object.entries(newQuery)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&')
    const targetUrl = `${route.path || '/'}?${queryString}`
    if (router) {
      router.push(targetUrl)
    } else if (typeof window !== 'undefined') {
      window.location.href = targetUrl
    }
  } catch (error) {
    logger.error('Failed to switch project:', error)
  }
}

onMounted(() => {
  // 初始化暗色模式
  darkModeStore.syncFromStorage?.()

  // 初始化窗口宽度
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    cleanup.addEventListener(window, 'resize', handleResize as EventListener)
  }
})
</script>
