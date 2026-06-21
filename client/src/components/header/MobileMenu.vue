<template>
  <!-- 移动端导航菜单 -->
  <div
    v-show="showMenu"
    class="mobile-menu"
    id="mobile-menu"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    ref="mobileMenuRef"
    @keydown.esc.stop.prevent="closeMenus"
  >
    <!-- 搜索组件已移至固定位置（屏幕右下角），此处不再渲染 -->

    <!-- 导航菜单项 -->
    <div class="mobile-menu-section">
      <a
        class="mobile-menu-item"
        :class="{ active: activeIndex === 'home' }"
        @click="goToHome"
      >
        {{ t('common.home') }}
      </a>
      <a
        class="mobile-menu-item"
        :class="{ active: activeIndex === 'agents' }"
        @click="goToAgents"
      >{{ t('hardcoded.mobile.menu.AI应用商店') }}</a>
      <a
        class="mobile-menu-item mobile-sub-item"
        :class="{ active: activeIndex === 'xuqiu' }"
        @click="goToXuqiu"
      >
        {{ t('routes.requirementSquare') }}
      </a>
      <a
        class="mobile-menu-item"
        :class="{ active: activeIndex === 'openPlatform' }"
        @click="goToOpenPlatform"
      >
        {{ t('routes.openPlatform') }}
      </a>
      <a
        class="mobile-menu-item"
        :class="{ active: activeIndex === 'learnAI' }"
        @click="goToLearnAI"
      >
        {{ t('common.learnAI') }}
      </a>
      <a
        class="mobile-menu-item"
        href="/ai-world"
      >
        {{ t('common.aiWorld') }}
      </a>
      
      <!-- 服务与支持 -->
      <a
        class="mobile-menu-item"
        :class="{ active: isSupportActive }"
        @click="toggleSupportMenu"
      >{{ t('hardcoded.mobile.menu.服务与支持') }}<i
          class="el-icon-arrow-down el-icon--right"
          :class="{ 'arrow-rotate': showSupportMenu }"
        ></i>
      </a>
      <div v-if="showSupportMenu" class="mobile-sub-menu">
        <a
          class="mobile-menu-item mobile-sub-item"
          :class="{ active: activeIndex === 'documentCenter' }"
          @click="() => goToPath('/support/document-center', 'documentCenter')"
        >{{ t('routes.documentCenter') }}</a>
      </div>
      
      <!-- 关于我们 -->
      <a
        class="mobile-menu-item"
        :class="{ active: isAboutActive }"
        @click="toggleAboutMenu"
      >{{ t('hardcoded.mobile.menu.关于我们') }}<i
          class="el-icon-arrow-down el-icon--right"
          :class="{ 'arrow-rotate': showAboutMenu }"
        ></i>
      </a>
      <div v-if="showAboutMenu" class="mobile-sub-menu">
        <a
          class="mobile-menu-item mobile-sub-item"
          :class="{ active: activeIndex === 'newsCenter' }"
          @click="() => goToPath('/about/news-center', 'newsCenter')"
        >{{ t('routes.newsCenter') }}</a>
        <a
          class="mobile-menu-item mobile-sub-item"
          :class="{ active: activeIndex === 'aboutUs' }"
          @click="() => goToPath('/about/about-us', 'aboutUs')"
        >{{ t('routes.aboutUs') }}</a>
        <a
          class="mobile-menu-item mobile-sub-item"
          :class="{ active: activeIndex === 'becomeSupplier' }"
          @click="() => goToPath('/about/become-supplier', 'becomeSupplier')"
        >{{ t('routes.becomeSupplier') }}</a>
      </div>
    </div>

    <!-- 功能区域 -->
    <div class="mobile-menu-section">
      <!-- 语言选择 -->
      <div class="mobile-menu-item mobile-menu-action" @click="toggleLanguageDropdown">
        <img v-if="currentLanguageFlagSrc" class="flag-icon" :src="currentLanguageFlagSrc" :alt="currentLanguageText" loading="lazy" />
        <span v-else class="flag-badge">{{ currentLanguageAbbr }}</span>
        <span class="language-text">{{ currentLanguageText }}</span>
        <i
          class="el-icon-arrow-down el-icon--right"
          :class="{ 'arrow-rotate': showLanguageDropdown }"
        ></i>
      </div>

      <!-- 语言下拉菜单 -->
      <div v-if="showLanguageDropdown" class="mobile-language-dropdown">
        <a
          v-for="lang in availableLanguages"
          :key="lang.code"
          class="mobile-language-option"
          :class="{ active: currentLanguage === lang.code }"
          @click="selectLanguage(lang.code)"
        >
          <img
            v-if="getFlagSrc(lang.code) !== ''"
            class="flag-icon"
            :src="getFlagSrc(lang.code)"
            :alt="lang.name"
            loading="lazy"
          />
          <span v-else class="flag-badge">{{ getAbbr(lang.code) }}</span>
          <span class="language-name">{{ lang.name }}</span>
        </a>
      </div>

      <!-- 通知组件 - 仅在登录后显示 -->
      <div v-if="isLoggedIn" class="mobile-menu-item mobile-menu-action">
        <Notification :isDarkMode="isThemeDark" />
      </div>

      <!-- 主题切换和登录按钮 - 同一排显示 -->
      <div v-if="!isLoggedIn" class="mobile-menu-item mobile-login-row">
        <div class="mobile-theme-toggle-wrapper">
          <ThemeToggle />
        </div>
        <button class="mobile-login-button" type="button" @click.stop="showLoginPopup">
          {{ t('auth.login_register') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Language } from '@/composables/useLang'
import { switchLanguage, supportedLanguages, getCurrentLanguage } from '@/composables/useLang'
import { useAuthStore } from '@/stores/auth'
import { useDarkModeStore } from '@/stores/darkMode'

// 使用动态导入优化组件体积
// Search 组件已移至 HeaderActions.vue 并固定在屏幕右下角
const Notification = defineAsyncComponent(() => import('../Notification.vue'))
const ThemeToggle = defineAsyncComponent(() => import('../ThemeToggle.vue'))

const router = useRouter()
const route = useRoute()
// 使用全局作用域，因为 Header 在 Teleport 中会失去父级作用域
interface UseI18nOptions {
  useScope?: 'global' | 'local'
}
const { t, locale } = (useI18n as (options?: UseI18nOptions) => ReturnType<typeof useI18n>)({ useScope: 'global' })

// Props
const _props = defineProps<{
  showMenu: boolean
}>()

// Emits
const emit = defineEmits<{
  (e: 'close'): void
}>()

// 从auth store获取登录状态
const authStore = useAuthStore()
const isLoggedIn = computed(() => authStore.isLoggedIn)

const darkModeStore = useDarkModeStore()
const isThemeDark = computed(() => {
  const isDark = darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark'
  return isDark
})

// 移动端菜单相关状态
const mobileMenuRef = ref<HTMLElement | null>(null)
const showSupportMenu = ref(false)
const showAboutMenu = ref(false)

// 根据当前路由自动计算activeIndex
const activeIndex = computed(() => {
  const routeName = (route as { name?: string | symbol }).name as string
  const routePath = route.path

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

// 导航方法
function goToPath(path: string, _key: string) {
  router.push(path)
  closeMenus()
}

function goToHome() {
  goToPath('/', 'home')
}

function goToAgents() {
  goToPath('/agents', 'agents')
}

function goToXuqiu() {
  goToPath('/xuqiu', 'xuqiu')
}

function goToOpenPlatform() {
  goToPath('/open', 'openPlatform')
}

function goToLearnAI() {
  goToPath('/learn-ai', 'learnAI')
}

// 构建项目URL（用于跳转到其他端口的项目）
const _buildProjectUrl = (port: string | number | null, path = ''): string => {
  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const portValue = port === null || port === '' ? '' : String(port)
  const portPart = portValue ? `:${portValue}` : ''
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${protocol}//${hostname}${portPart}${normalizedPath}`
}

// 关闭菜单
const closeMenus = () => {
  emit('close')
}

// 语言选择相关状态
const showLanguageDropdown = ref(false)
const currentLanguage = computed(() => {
  const globalLang = getCurrentLanguage.value as string | undefined
  if (globalLang) return globalLang as Language

  const localeObj = locale as unknown
  if (localeObj && typeof localeObj === 'object' && 'value' in localeObj) {
    return (localeObj as { value: string | undefined }).value || 'zh-CN'
  }
  return (locale as unknown as string) || 'zh-CN'
})

// 计算当前语言显示文本
const currentLanguageText = computed(() => {
  const currentLang = (currentLanguage.value || 'zh-CN') as Language
  return supportedLanguages[currentLang] || supportedLanguages['zh-CN']
})

// 获取所有支持的语言列表
const availableLanguages = computed(() => {
  return Object.entries(supportedLanguages).map(([code, name]) => ({
    code: code as Language,
    name,
  }))
})

// 根据语言代码获取对应的国旗图片路径
const currentLanguageAbbr = computed(() => {
  const map: Record<string, string> = {
    'zh-CN': 'CN',
    'zh-TW': 'TW',
    en: 'EN',
    ja: 'JA',
    ko: 'KO',
  }
  const code = (currentLanguage.value || 'zh-CN') as string
  return map[code] || 'LANG'
})

const getAbbr = (code: string): string => {
  const map: Record<string, string> = {
    'zh-CN': 'CN',
    'zh-TW': 'TW',
    en: 'EN',
    ja: 'JA',
    ko: 'KO',
  }
  return map[code] || 'LANG'
}

const flagSrcMap: Record<string, string> = {
  'zh-CN': '/images/flags/zh-CN.svg',
  'zh-TW': '/images/flags/zh-TW.svg',
  en: '/images/flags/en.svg',
  ja: '/images/flags/ja.svg',
  ko: '/images/flags/ko.svg',
}

const getFlagSrc = (code: string): string => {
  return flagSrcMap[code] || ''
}

// 计算当前语言的国旗路径
const currentLanguageFlagSrc = computed(() => {
  return getFlagSrc(currentLanguage.value)
})

// 切换语言下拉菜单显示
const toggleLanguageDropdown = (e?: MouseEvent) => {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  showLanguageDropdown.value = !showLanguageDropdown.value
  if (showLanguageDropdown.value) {
    showSupportMenu.value = false
    showAboutMenu.value = false
  }
}

// 选择语言
const selectLanguage = (lang: string) => {
  const validLanguages: Language[] = [
    'zh-CN',
    'zh-TW',
    'en',
    'ja',
    'ko',
  ]
  if (validLanguages.includes(lang as Language)) {
    switchLanguage(lang as Language)
    // 同步 i18n locale（仅当 locale 为 ref 时）
    const localeObj = locale as unknown
    if (localeObj && typeof localeObj === 'object' && 'value' in localeObj) {
      ;(localeObj as { value: string }).value = lang
    }
    document.documentElement.lang = lang
    showLanguageDropdown.value = false
  }
}

// 显示登录弹窗
const showLoginPopup = (event?: MouseEvent) => {
  if (isLoggedIn.value) {
    return
  }
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  router.push('/login')
  closeMenus()
}

// 切换服务与支持菜单
const toggleSupportMenu = () => {
  showSupportMenu.value = !showSupportMenu.value
  if (showSupportMenu.value) {
    showAboutMenu.value = false
    showLanguageDropdown.value = false
  }
}

// 切换关于我们菜单
const toggleAboutMenu = () => {
  showAboutMenu.value = !showAboutMenu.value
  if (showAboutMenu.value) {
    showSupportMenu.value = false
    showLanguageDropdown.value = false
  }
}

// 检查服务与支持相关页面是否激活
const isSupportActive = computed(() => {
  const routePath = route.path
  return (
    routePath.startsWith('/support/') ||
    activeIndex.value === 'documentCenter'
  )
})

// 检查关于我们相关页面是否激活
const isAboutActive = computed(() => {
  const routePath = route.path
  return (
    routePath.startsWith('/about/') ||
    activeIndex.value === 'newsCenter' ||
    activeIndex.value === 'aboutUs' ||
    activeIndex.value === 'becomeSupplier'
  )
})
</script>

<style scoped lang="scss">
// ============================================
// 移动端菜单样式 - 使用 CSS 变量替代 
// ============================================

// 移动端菜单区域样式
:where(.mobile-menu-section) {
  // CSS 变量定义
  --mobile-search-height: 36px;
  --mobile-search-font-size: 14px;
  --mobile-search-padding-left: 36px;
  --mobile-search-padding-right: 8px;
  --mobile-search-border-radius: var(--global-border-radius);
  --mobile-search-icon-size: 18px;
  --mobile-search-icon-left: 10px;

  padding: 4px;
  border-bottom: var(--unified-border-bottom);
  width: auto;
  box-sizing: border-box;

  &:last-child {
    border-bottom: none;
  }

  // 移动端搜索组件样式 - 全宽显示，图标在左侧
  // 使用 :deep() 穿透 scoped 样式
  :deep(.search-wrapper) {
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    justify-content: flex-start;
    overflow: visible;
    position: relative;
    height: var(--mobile-search-height);
  }
}

// 移动端子菜单样式
.mobile-sub-menu {
  background-color: var(--el-fill-color-light);
  padding: 4px 0;
  margin-top: 2px;
}

// 移动端菜单项样式 - 统一 font-weight
.mobile-menu-item {
  position: relative;
  font-weight: 600;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  font-size: 14px;
  width: auto;
  white-space: nowrap;
  box-sizing: border-box;
  margin: 2px 4px;
  border-radius: var(--global-border-radius);

  .el-icon-arrow-down {
    transition: transform 0.3s ease;
    margin-left: 8px;
  }

  .arrow-rotate {
    transform: rotate(180deg);
  }
}

// 子菜单项样式
.mobile-sub-menu .mobile-menu-item,
.mobile-sub-item {
  padding: 8px 16px;
  padding-left: 32px;
  font-weight: 500;
  font-size: 13px;
  width: auto;
  white-space: nowrap;
}
</style>

<style lang="scss">
/* 非 scoped：搜索框内部样式，用 :where() 降低特异性 */
:where(.mobile-menu-section) .search-wrapper .input {
  position: relative;
  right: auto;
  left: 0;
  width: 100%;
  max-width: 100%;
  opacity: 1;
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--mobile-search-border-radius);
  padding-left: var(--mobile-search-padding-left);
  padding-right: var(--mobile-search-padding-right);
  transition: all 0.25s ease;
  height: var(--mobile-search-height);
  font-size: var(--mobile-search-font-size);
  box-sizing: border-box;
}

:where(.mobile-menu-section) .search-wrapper .input.expanded {
  width: 100%;
  opacity: 1;
}

:where(.mobile-menu-section) .search-wrapper #search-icon {
  position: absolute;
  left: var(--mobile-search-icon-left);
  right: auto;
  top: 50%;
  transform: translateY(-50%);
  z-index: calc(var(--z-base) + 1);
  width: var(--mobile-search-icon-size);
  height: var(--mobile-search-icon-size);
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

:where(.mobile-menu-section) .search-wrapper.dark-mode .input {
  background-color: var(--el-bg-color);
  border-color: var(--border-unified-color);
  color: var(--el-text-color-primary);
}
</style>
