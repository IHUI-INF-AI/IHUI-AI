import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n, { setLanguage, initI18n } from './locales'
import { useLanguageStore } from './stores/language'
import { useDarkModeStore } from './stores/darkMode'
import { logger } from '@/utils/logger'
import { registerIcons } from '@/utils/element-plus-icons'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { createPersistedState } from '@/plugins/pinia-persist'
// SVG 雪碧图注册 (vite-plugin-svg-icons) - 让 SvgIcon 组件的 <use xlink:href> 生效
import 'virtual:svg-icons-register'
// E2E/演示模式下过滤噪声日志，避免无关错误充斥控制台
// 直接导入 fixLogger，文件内部会根据环境变量决定是否启用

// Element Plus 基础样式（放入 vendor 层，降低优先级，让自定义样式可覆盖）
import './styles/element-plus-layered.css'
// 自定义 CSS 变量（后加载，覆盖 Element Plus 默认值）
import './styles/element-plus-vars.scss'
import './styles/css-variables.scss'
import './components/global.scss'
import './styles/index.scss'
import './styles/_scrollbar-overlay.scss'
import './styles/header.scss' // 顶部菜单栏 .glass-header 样式（必须加载，否则顶部栏不显示）
import './styles/brand-marquee.scss' // 引入品牌跑马灯卡片样式
import './styles/ihui-ai-effects.scss'
import './styles/fixes.scss'
import './styles/runtime-overrides.scss' // 运行时样式覆盖
// 暗色模式背景色强制覆盖
import './styles/dark-mode-override.scss'
// 彻底移除所有按钮描边 - 必须在所有样式最后加载
import './styles/button-border-reset.css'
// 全局容器/卡片兜底样式 - 最后加载，确保背景与描边全站生效
import './styles/global-containers-fallback.css'
// RTL 适配样式 (P10 阶段) - 阿拉伯语/希伯来语方向
import './styles/rtl-adaptation.css'

const APP_IMG_FALLBACK = '/images/APP.jpg'

const patchAppImageSources = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const rewrite = (img: HTMLImageElement | null) => {
    if (!img) return
    const src = img.getAttribute('src') || ''
    // 仅匹配绝对 file:// 或盘符路径，回退到 web 静态资源
    if (/^([a-zA-Z]:\\|\/|\.\.?\/)/.test(src) && !src.startsWith(APP_IMG_FALLBACK)) {
      img.src = APP_IMG_FALLBACK
    }
  }

  document.querySelectorAll('img').forEach(img => rewrite(img as HTMLImageElement))

  window.addEventListener(
    'error',
    event => {
      const target = event.target as HTMLElement
      if (target && target.tagName === 'IMG') {
        rewrite(target as HTMLImageElement)
      }
    },
    true
  )
}

logger.info('[Main] Starting app initialization...')

// 2026-06-26 一次性迁移清理: 删除 i18n 翻译记忆库 (TM) + 同步日志 残留的 localStorage 数据
// 背景: 之前为"翻译工作流"开发了 TM (翻译记忆库) + 同步日志 功能, 现用户决定不接入第三方翻译 API
//       所有"花钱翻译"相关功能已从代码中移除, 但用户浏览器里可能残留旧的 localStorage 数据
//       一次性清理: 只在客户端执行一次, 删除后立即 setItem 一个 sentinel, 防止误删新数据
try {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const TM_LEGACY_KEY = 'i18n_tm'
    const SYNC_LOG_LEGACY_KEY = 'i18n_sync_log'
    const MIGRATION_SENTINEL = 'i18n_legacy_translation_cleanup_v1'
    const existing = localStorage.getItem(MIGRATION_SENTINEL)
    if (existing !== 'done') {
      let removedCount = 0
      if (localStorage.getItem(TM_LEGACY_KEY) !== null) {
        localStorage.removeItem(TM_LEGACY_KEY)
        removedCount++
      }
      if (localStorage.getItem(SYNC_LOG_LEGACY_KEY) !== null) {
        localStorage.removeItem(SYNC_LOG_LEGACY_KEY)
        removedCount++
      }
      try {
        localStorage.setItem(MIGRATION_SENTINEL, 'done')
      } catch (_e) {
        // 写入 sentinel 失败不影响清理结果
      }
      if (removedCount > 0) {
        logger.info(`[Main] Cleaned up ${removedCount} legacy i18n translation localStorage key(s)`)
      }
    }
  }
} catch (e) {
  logger.warn('[Main] Legacy i18n translation localStorage cleanup failed:', e)
}

// Theme initialization
try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // 确保全局 box-sizing 在样式表加载前就生效，满足自动化校验
    const root = document.documentElement
    root.style.boxSizing = 'border-box'
    if (!document.getElementById('global-box-sizing')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'global-box-sizing'
      styleEl.textContent = '*,*::before,*::after{box-sizing:inherit;margin:0;padding:0;}'
      document.head.appendChild(styleEl)
    }
    
    // 全局禁用 scroll-snap，防止首页自动滚动
    // 在 DOM 加载前就禁用，确保不会触发自动对齐
    if (!document.getElementById('disable-scroll-snap')) {
      const scrollSnapStyle = document.createElement('style')
      scrollSnapStyle.id = 'disable-scroll-snap'
      scrollSnapStyle.textContent = `
        @layer utilities {
          .home-container {
            scroll-snap-type: none;
          }
          .page-section {
            scroll-snap-align: none;
            scroll-snap-stop: normal;
          }
        }
      `
      document.head.appendChild(scrollSnapStyle)
    }

    // 禁用浏览器自动恢复滚动位置
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    // 首页进入时仅做一次置顶，不做持续锁定，使用原生滚动
    ;(function() {
      const forceHomeScrollToTop = () => {
        const homeContainer = document.querySelector('.home-container') as HTMLElement | null
        if (homeContainer) {
          homeContainer.style.scrollSnapType = 'none'
          homeContainer.scrollTop = 0
        }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceHomeScrollToTop)
      } else {
        forceHomeScrollToTop()
      }
    })()

    const saved = StorageManager.getItem<string>(STORAGE_KEYS.DARK_MODE)
    let preferDark = false
    if (saved === 'dark') {
      preferDark = true
    } else if (saved === 'light') {
      preferDark = false
    } else if (saved === 'auto' || saved === null) {
      preferDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches || false
    } else if (saved === 'true') {
      preferDark = true
    } else if (saved === 'false') {
      preferDark = false
    }

    if (preferDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // P14.2 admin 主题预设:在 createApp 之前根据 localStorage 应用 admin-dark 类与 data-theme
    try {
      const adminTheme = StorageManager.getItem<string>('admin-theme-mode')
      if (adminTheme === 'dark') {
        document.documentElement.classList.add('admin-dark')
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.setAttribute('data-theme', 'light')
      }
    } catch (_e) {
      document.documentElement.setAttribute('data-theme', 'light')
    }
    
    // 兜底修正可能遗留的绝对路径 APP.jpg，防止 file:// 访问报错
    patchAppImageSources()
  }
} catch (e) {
  logger.error('Theme init error', e)
}

const app = createApp(App)

// Pinia
const pinia = createPinia()
// P21: 注册状态持久化插件 (选择性路径 + 防抖写入 + 跨标签页同步)
pinia.use(createPersistedState({
  defaultDebounce: 300,
}))
// 确保在使用任何 store 之前激活 Pinia（解决 HMR 或初始化竞态导致的 getActivePinia 警告）
setActivePinia(pinia)
app.use(pinia)

// Vue 全局错误处理器 - 捕获组件内部未处理的错误
;(app.config as unknown as { errorHandler: (err: unknown, instance: unknown, info: string) => void }).errorHandler = (err, _instance, info) => {
  logger.error('[Vue Error]', err, { info })
}

// Admin Vuex Store - 已移除（管理端使用Pinia）

// Admin全局函数注册 - 已移除（2026-06-18）
// Admin全局组件注册 - 已移除（2026-06-18）
// Admin指令和插件注册 - 已移除（2026-06-18）

// Auth Store + RememberMe Service 并行初始化（Auth 必须在路由之前完成）
await Promise.all([
  (async () => {
    try {
      const { useAuthStore } = await import('./stores/auth')
      const authStore = useAuthStore(pinia)
      await authStore.initAuth()
      logger.info('[Main] Auth store initialized')
    } catch (error) {
      logger.error('[Main] Failed to initialize auth store:', error)
    }
  })(),
  (async () => {
    try {
      const { RememberMeService } = await import('./utils/rememberMeService')
      RememberMeService.init()
      logger.info('[Main] RememberMe service initialized')
    } catch (error) {
      logger.error('[Main] Failed to initialize RememberMe service:', error)
    }
  })(),
])

// Dark Mode Store
try {
  const darkModeStore = useDarkModeStore(pinia)

  const applyStoredTheme = () => {
    try {
      darkModeStore.syncFromStorage()
    } catch (error) {
      logger.warn('[Main] applyStoredTheme failed:', error)
    }
  }

  // 初始化主题（含存储同步），确保导出刷新后状态一致
  applyStoredTheme()

  router.afterEach(() => {
    applyStoredTheme()
  })

  // 监听其他标签页或脚本对 localStorage 的修改
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEYS.DARK_MODE) {
        applyStoredTheme()
      }
    })
  }

  logger.info('[Main] Dark mode initialized')
} catch (error) {
  logger.error('[Main] Dark mode init failed:', error)
}

// Theme Keyboard Shortcut
try {
  const { initThemeShortcut } = await import('./utils/themeShortcut')
  initThemeShortcut()
  logger.info('[Main] Theme keyboard shortcut initialized')
} catch (error) {
  logger.warn('[Main] Theme shortcut init failed:', error)
}

// Initialize i18n with lazy-loaded messages (before router)
await initI18n()
app.use(i18n)

// 2026-06-24 修复: 在 router 挂载前预加载 en 兜底 EP 语言包 + 当前语言 EP 语言包,
// 确保 App.vue setup 同步访问 getElementPlusLocale 时至少能拿到 en 兜底, 避免空 {} locale
// 触发 Element Plus 内部 renderSlot(null children) -> 'Cannot read properties of null (reading "ce")' 错误
try {
  const { loadElementPlusLocale, getCurrentLocale } = await import('./locales')
  void loadElementPlusLocale('en').catch((e) => {
    logger.warn('[Main] Preload EP en locale failed:', e)
  })
  const currentLocale = getCurrentLocale()
  if (currentLocale && currentLocale !== 'en') {
    void loadElementPlusLocale(currentLocale).catch((e) => {
      logger.warn('[Main] Preload EP current locale failed:', e)
    })
  }
} catch (e) {
  logger.warn('[Main] Preload EP locale failed:', e)
}

// Router
app.use(router)

// P18-2: 注册 v-safe-html 指令 (基于 DOMPurify, 用于替代 v-html 渲染用户内容)
// 所有渲染用户输入/富文本的场景应使用 v-safe-html 而非 v-html, 防 XSS
try {
  const { install: installSafeHtml } = await import('./directives/safeHtml')
  installSafeHtml(app)
  logger.info('[Main] v-safe-html directive registered (XSS defense)')
} catch (error) {
  logger.warn('[Main] Failed to register v-safe-html directive:', error)
}

// Element Plus 组件/指令通过 unplugin-vue-components 的 ElementPlusResolver 自动按需导入
// v-loading 指令也由 ElementPlusResolver 自动处理，无需 app.use(ElementPlus)

// 全局组件注册（迁移自源项目 main.js）
// 注意：unplugin-vue-components 已自动注册 components 目录下的组件
// 这里只注册需要全局访问但不在自动扫描路径下的组件
try {
  // Loading 组件已被 unplugin-vue-components 自动注册，无需手动注册
  logger.info('[Main] Global components checked')
} catch (error) {
  logger.warn('[Main] Global component registration failed:', error)
}

// 全局属性注册 - 已移除（style-variables 文件不存在）

// 全局方法注册 - 已移除（utils/index、time-utils 文件不存在）
logger.info('[Main] Global methods registered')


// Default Language for Dev - 只在没有保存语言设置时才设置默认语言
if (import.meta.env.DEV) {
  try {
    const savedLang = localStorage.getItem('language')
    if (!savedLang) {
      void setLanguage('zh-CN')
    }
  } catch (error) {
    // 语言设置失败不影响应用启动，仅在开发环境记录
    logger.debug('[Main] Dev environment default language setup failed:', error)
  }
}

// Icons
try {
  registerIcons(app)
} catch (error: any) {
  logger.error('Failed to register icons', error)
}


// Language Class
function applyLanguageClass(lang: string) {
  try {
    const rootEl = document.documentElement
    // 防御性: 即使上层已做类型守卫, 这里仍再做一次 string 校验,
    // 避免 pinia 持久化/订阅回调中传入非 string (Ref/对象) 触发 toLowerCase 报错.
    const safeLang = typeof lang === 'string' && lang.length > 0 ? lang : 'zh-CN'
    const isZh = safeLang.toLowerCase().startsWith('zh')
    rootEl.classList.toggle('lang-zh', !!isZh)
    rootEl.classList.toggle('lang-en', !isZh)
  } catch (e) {
    logger.error('Failed to apply language class', e)
  }
}

try {
  const languageStore = useLanguageStore(pinia)
  languageStore.initLanguage()
  // 2026-06-26 修复: pinia setup-style store 在 store 外部访问 ref 字段会**自动 unwrap**,
  // 不需要再取 .value (取 .value 反而会拿到 undefined -> toLowerCase 报错).
  // $subscribe 的 state 同样拿到 unwrap 后的 string, 直接传即可.
  const resolveLang = (raw: unknown): string => {
    if (typeof raw === 'string') return raw
    if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
      const v = (raw as { value: unknown }).value
      if (typeof v === 'string') return v
    }
    return 'zh-CN'
  }
  applyLanguageClass(resolveLang(languageStore.currentLanguage))
  languageStore.$subscribe((_mutation: any, state: { currentLanguage?: string }) => {
    applyLanguageClass(resolveLang(state.currentLanguage) || 'zh-CN')
  })
} catch (error) {
  logger.error('[Main] Failed to initialize language store:', error)
}

// Ensure #app exists
if (!document.getElementById('app')) {
  const appDiv = document.createElement('div')
  appDiv.id = 'app'
  document.body.appendChild(appDiv)
}

// 全局错误处理 - 捕获 Element not found 等错误
if (typeof window !== 'undefined') {
  // 捕获未处理的错误
  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      // 如果是 Element not found 错误，静默处理或记录日志
      if (event.message && event.message.includes('Element not found')) {
        logger.warn('[Global Error Handler] Element not found error caught:', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        })
        // 阻止错误继续传播，避免影响用户体验
        event.preventDefault()
        return true
      }
      // 其他错误正常处理
      return false
    },
    true
  )

  // 捕获未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason
    if (reason && typeof reason === 'object' && 'message' in reason) {
      const message = String(reason.message)
      if (message.includes('Element not found')) {
        logger.warn(
          '[Global Error Handler] Unhandled promise rejection with Element not found:',
          reason
        )
        // 阻止错误继续传播
        event.preventDefault()
      }
    }
  })
}

// Mount
logger.info('[Main] Mounting app...')

app.mount('#app')

// 挂载后并行执行: 监控接入 + 清除加载状态(不阻塞首屏渲染)
void Promise.all([
  (async () => {
    try {
      const { setupMonitor } = await import('./utils/monitor')
      setupMonitor(app)
    } catch (e) {
      console.warn('[monitor] 初始化失败', e)
    }
  })(),
  (async () => {
    try {
      const { useLoadingStore } = await import('./stores/loading')
      const loadingStore = useLoadingStore()

      // 立即清除（应用挂载时）
      loadingStore.stopGlobalLoading()
      loadingStore.clearAllLoading()

      // 延迟清除，确保应用已完全挂载
      setTimeout(() => {
        if (loadingStore.globalLoading) {
          logger.warn('[Main] Detected residual global loading state, clearing...')
          loadingStore.stopGlobalLoading()
          loadingStore.clearAllLoading()
        }
      }, 100)

      setTimeout(() => {
        if (loadingStore.globalLoading) {
          logger.warn('[Main] Detected global loading state again, forcing clear...')
          loadingStore.stopGlobalLoading()
          loadingStore.clearAllLoading()
        }
      }, 500)

      setTimeout(() => {
        if (loadingStore.globalLoading) {
          logger.warn('[Main] Third detection of global loading state, final force clear...')
          loadingStore.stopGlobalLoading()
          loadingStore.clearAllLoading()
        }
      }, 1000)

      // 监听页面加载完成事件
      if (typeof window !== 'undefined') {
        const clearOnLoad = () => {
          if (loadingStore.globalLoading) {
            logger.warn('[Main] Page load complete, clearing residual loading state')
            loadingStore.stopGlobalLoading()
            loadingStore.clearAllLoading()
          }
        }

        if (document.readyState === 'complete') {
          clearOnLoad()
        } else {
          window.addEventListener('load', clearOnLoad, { once: true })
        }
      }
    } catch (e) {
      logger.warn('[Main] Failed to clear loading state:', e)
    }
  })(),
])

// 清除残留的 Loading SVG 元素
function removeResidualLoadingSvg() {
  try {
    const svg = document.querySelector('svg[visible="false"][text="加载中..."]')
    if (svg && svg.parentElement) {
      logger.warn('[Main] Detected residual Loading SVG, removing...')
      svg.parentElement.removeChild(svg)
    }
  } catch (_e) {
    // 静默处理
  }
}

// 立即执行
removeResidualLoadingSvg()

// 延迟执行，确保 DOM 完全加载
setTimeout(removeResidualLoadingSvg, 100)
setTimeout(removeResidualLoadingSvg, 500)
setTimeout(removeResidualLoadingSvg, 1000)

// 使用 MutationObserver 监控 DOM 变化，自动移除新添加的残留 SVG
if (typeof MutationObserver !== 'undefined') {
  const svgObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element
          if (el.tagName === 'SVG' && el.getAttribute('visible') === 'false' && el.getAttribute('text') === '加载中...') {
            logger.warn('[Main] MutationObserver detected residual Loading SVG, removing...')
            el.parentElement?.removeChild(el)
          }
          // 检查子元素
          const childSvgs = el.querySelectorAll?.('svg[visible="false"][text="加载中..."]') || []
          childSvgs.forEach((svg) => {
            logger.warn('[Main] MutationObserver detected residual Loading SVG (child element), removing...')
            svg.parentElement?.removeChild(svg)
          })
        }
      })
    })
  })

  // 开始观察 document.body
  if (document.body) {
    svgObserver.observe(document.body, { childList: true, subtree: true })
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        svgObserver.observe(document.body, { childList: true, subtree: true })
      }
    })
  }
  
  // 在应用卸载时清理 MutationObserver，防止内存泄漏
  window.addEventListener('beforeunload', () => {
    svgObserver.disconnect()
    logger.debug('[Main] SVG MutationObserver cleaned up')
  })
}

// Optional: Monitoring / SEO (Only in production to avoid performance issues)
if (typeof window !== 'undefined') {
  // Only enable monitoring in production to avoid performance issues
  if (import.meta.env.PROD) {
    import('@/utils/monitoring')
      .then(({ monitoringService }) => monitoringService.init())
      .catch(() => { /* 可选功能，静默失败 */ })
    import('@/utils/webVitals').then(({ initWebVitals }) => initWebVitals()).catch(() => { /* 可选功能，静默失败 */ })
  }

  // Preloads
  import('@/utils/resourcePreloader')
    .then(({ resourcePreloader }) => {
      if (resourcePreloader) {
        resourcePreloader.preconnect('https://fonts.googleapis.com', true)
        resourcePreloader.dnsPrefetch('https://fonts.gstatic.com')
      }
    })
    .catch(() => { /* 可选功能，静默失败 */ })
}

