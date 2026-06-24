<template>
  <div class="logo-container" ref="logoContainerRef">
    <!-- 移动端菜单按钮 - 放在Logo左侧 -->
    <button
      v-if="isMobile"
      type="button"
      @click="handleMenuToggle"
      class="menu-item menu-more-button mobile-menu-button"
      :class="{ active: showMenu }"
      :aria-label="t('hardcoded.header_logo.展开或收起移动端')"
      :aria-expanded="showMenu"
      aria-controls="mobile-menu"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="more-icon"
      >
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
    <img
      ref="logoImgRef"
      @click="handleLogoClick"
      @keydown.enter.prevent="handleLogoClick"
      @keydown.space.prevent="handleLogoClick"
      tabindex="0"
      role="link"
      :aria-label="t('common.siteName')"
      :src="logoSrc"
      :alt="t('common.siteName')"
      class="logo"
      @error="handleLogoError"
      @load="handleLogoLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDarkModeStore } from '@/stores/darkMode'
// 不再需要导?Menu ?X 图标，统一使用 SVG
import { useThrottleFn, useEventListener } from '@vueuse/core'
import { defaultResponsiveConfig } from '@/utils/responsiveEnhancement'
import { useCleanup } from '@/composables/useCleanup'

const router = useRouter()
const route = useRoute()
// 使用全局作用域，因为 Header ?Teleport 中会失去父级作用?
interface UseI18nOptions {
  useScope?: 'global' | 'local'
}
const { t } = (useI18n as (options?: UseI18nOptions) => ReturnType<typeof useI18n>)({ useScope: 'global' })
const darkModeStore = useDarkModeStore()
// 确保 dark mode store 已初始化
if (typeof window !== 'undefined') {
  // 确保主题已应用（darkModeStore 会自动应用主题）
  darkModeStore.setThemeMode(darkModeStore.themeMode, 'user', true)
}
const isDarkMode = computed(() => darkModeStore.isDarkMode)

// 移动端菜单状?
const isMobile = ref(false)
const showMenu = ref(false)

// 检查屏幕尺?
const checkScreenSize = () => {
  const mobileBreakpoint = defaultResponsiveConfig.breakpoints.md
  isMobile.value = window.innerWidth < mobileBreakpoint
  if (!isMobile.value) {
    showMenu.value = false
  }
}

// 初始化时立即检查屏幕尺寸
if (typeof window !== 'undefined') {
  checkScreenSize()
}

// 切换菜单
const handleMenuToggle = () => {
  showMenu.value = !showMenu.value
  // 触发自定义事件，通知父组?
  window.dispatchEvent(new CustomEvent('mobile-menu-toggle', { detail: { open: showMenu.value } }))
}

// 监听屏幕尺寸变化
const handleResize = useThrottleFn(() => {
  checkScreenSize()
}, 150)

// 监听外部点击关闭菜单
const handleClickOutside = (event: MouseEvent) => {
  try {
    const target = event.target
    if (!target || !(target instanceof Element)) {
      return
    }
    if (
      isMobile.value &&
      showMenu.value &&
      !target.closest('.logo-container') &&
      !target.closest('.mobile-menu')
    ) {
      showMenu.value = false
      window.dispatchEvent(new CustomEvent('mobile-menu-toggle', { detail: { open: false } }))
    }
  } catch (_error) {
    // 静默处理错误
  }
}

// Logo路径 - 根据暗色模式切换 logo 图片
const logoSrc = computed(() => {
  const baseUrl = import.meta.env.BASE_URL || '/'
  return isDarkMode.value ? `${baseUrl}images/bailogo.svg` : `${baseUrl}images/logo.svg`
})

// Logo元素的ref引用
const logoImgRef = ref<HTMLImageElement | null>(null)
const logoContainerRef = ref<HTMLDivElement | null>(null)

// 设置logo使用自然尺寸的辅助函数
const forceLogoSize = (img: HTMLImageElement | null) => {
  if (!img) {
    return
  }

  // 移动端隐藏logo，不设置任何样式
  if (isMobile.value) {
    img.style.display = 'none'
    const parent = img.parentElement
    if (parent) {
      parent.style.cssText = ''
    }
    return
  }

  // 如果图片还没有加载完成，等待加载完成
  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    return
  }

  // 获取图片的自然尺寸
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight

  // 计算合适的显示尺寸（保持宽高比，限制最大高度）
  const maxHeight = 36
  let displayWidth = naturalWidth
  let displayHeight = naturalHeight

  // 如果高度超过限制，按比例缩放
  if (displayHeight > maxHeight) {
    const ratio = maxHeight / displayHeight
    displayWidth = naturalWidth * ratio
    displayHeight = maxHeight
  }

  // 清除所有可能的样式干扰
  img.removeAttribute('style')
  img.removeAttribute('width')
  img.removeAttribute('height')

  // 设置内联样式使用计算后的尺寸（保持宽高比）
  img.style.cssText =
    'display: block; ' +
    'visibility: visible; ' +
    'opacity: 1; ' +
    `width: ${displayWidth}px; ` +
    `height: ${displayHeight}px; ` +
    `max-height: ${maxHeight}px; ` +
    'flex-shrink: 0; ' +
    'flex-grow: 0; ' +
    'object-fit: contain; ' +
    'position: relative; ' +
    'z-index: var(--z-base); ' +
    'box-sizing: border-box;'

  // 直接操作style对象（绕过Vue的响应式系统）
  const style = img.style as CSSStyleDeclaration & { [key: string]: any }
  style.display = 'block'
  style.visibility = 'visible'
  style.opacity = '1'
  style.width = `${displayWidth}px`
  style.height = `${displayHeight}px`
  style.maxHeight = `${maxHeight}px`
  style.flexShrink = '0'
  style.flexGrow = '0'
  style.objectFit = 'contain'
  style.position = 'relative'
  style.zIndex = '1'
  style.boxSizing = 'border-box'

  // 确保父容器也有正确的样式
  const parent = img.parentElement
  if (parent) {
    const imgWidth = parseFloat(img.style.width) || img.clientWidth || 0
    const imgHeight = parseFloat(img.style.height) || img.clientHeight || 0

    parent.style.cssText =
      'display: flex; ' +
      `width: ${imgWidth}px; ` +
      `height: ${imgHeight}px; ` +
      'margin: 0; ' +
      'padding: 0; ' +
      'flex-shrink: 0; ' +
      'flex-grow: 0; ' +
      'overflow: visible; ' +
      'position: relative;'
  }
}

// 使用MutationObserver监听DOM变化并强制修?
let logoObserver: MutationObserver | null = null
let logoRafId: number | null = null

const cleanup = useCleanup()
cleanup.add(() => {
  if (logoObserver) {
    logoObserver.disconnect()
    logoObserver = null
  }
  if (logoRafId !== null) {
    cancelAnimationFrame(logoRafId)
    logoRafId = null
  }
})

const setupLogoObserver = (img: HTMLImageElement) => {
  if (!img || logoObserver) return

  logoObserver = new MutationObserver(mutations => {
    let shouldFix = false

    mutations.forEach(mutation => {
      // 如果style属性被改变
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const currentWidth = img.clientWidth || img.offsetWidth || 0
        const currentHeight = img.clientHeight || img.offsetHeight || 0

        if (currentWidth === 0 || currentHeight === 0) {
          shouldFix = true
        }
      }

      // 如果属性被删除
      if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'width' || mutation.attributeName === 'height') {
          if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
            shouldFix = true
          }
        }
      }
    })

    if (shouldFix) {
      // 延迟修复，避免无限循?
      setTimeout(() => {
        forceLogoSize(img)
      }, 10)
    }
  })

  // 监听属性变?
  logoObserver.observe(img, {
    attributes: true,
    attributeFilter: ['style', 'width', 'height', 'class'],
    childList: false,
    subtree: false,
  })

  // 也监听父容器
  const container = img.parentElement
  if (container) {
    logoObserver.observe(container, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: false,
      subtree: false,
    })
  }
}

// Logo点击处理
const handleLogoClick = () => {
  // 如果现在在首页中，点击后切换到第一分页
  const routeName = (route as { name?: string | symbol }).name as string
  const routePath = route.path
  const isOnHomePage = routeName === 'home' || routePath === '/' || routePath === '/home'

  if (isOnHomePage) {
    // 切换到第一分页（滚动到顶部?
    const homeContainer = document.querySelector('.home-container') as HTMLElement | null
    if (homeContainer) {
      // 优先使用 id 选择器定位第一页，更精?
      const firstPage = document.getElementById('first-page') as HTMLElement | null
      if (firstPage) {
        firstPage.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        // 如果找不到第一页元素，尝试查找第一?page-section
        const firstPageSection = homeContainer.querySelector('.page-section:first-child') as HTMLElement | null
        if (firstPageSection) {
          firstPageSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          // 如果都找不到，直接滚动容器到顶部
          homeContainer.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
      return
    }
  }
  // 不在首页或未找到容器，正常跳?
  router.push('/')
}

// Logo加载处理函数
const handleLogoLoad = (event: Event) => {
  const img = event.target as HTMLImageElement

  // 如果图片已经加载成功（有自然尺寸），立即设置样式
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    // 立即设置一?
    forceLogoSize(img)

    // 使用requestAnimationFrame确保DOM已渲染后再检?
    logoRafId = requestAnimationFrame(() => {
      // 再次确保尺寸正确
      forceLogoSize(img)

      // 延迟检查，确保CSS过渡完成
      setTimeout(() => {
        // 检查尺寸是否正?
        const displayWidth = img.clientWidth || img.offsetWidth || 0
        const displayHeight = img.clientHeight || img.offsetHeight || 0

        // 如果尺寸仍然?，再次强制设?
        if (displayWidth === 0 || displayHeight === 0) {
          forceLogoSize(img)
        }
      }, 100)
    })
  }
}

// Logo错误处理
const handleLogoError = (event: Event) => {
  const img = event.target as HTMLImageElement
  const baseUrl = import.meta.env.BASE_URL || '/'
  // 如果加载失败，尝试切换到另一个主题的图片
  if (isDarkMode.value && img.src.includes('bailogo.svg')) {
    img.src = `${baseUrl}images/logo.svg`
  } else if (!isDarkMode.value && img.src.includes('logo.svg')) {
    img.src = `${baseUrl}images/bailogo.svg`
  }
}

// 监听暗色模式变化，更?logo 图片
watch(
  isDarkMode,
  () => {
    if (logoImgRef.value) {
      // 更新图片?
      logoImgRef.value.src = logoSrc.value
      // 重新设置尺寸
      nextTick(() => {
        if (logoImgRef.value && logoImgRef.value.naturalWidth > 0) {
          forceLogoSize(logoImgRef.value)
        }
      })
    }
  },
  { immediate: true } // 立即执行，确保初始加载时也能正确设置
)

// 组件挂载时初始化
onMounted(() => {
  // 检查屏幕尺?
  checkScreenSize()
  // 使用 useEventListener 自动处理事件清理
  useEventListener(window, 'resize', handleResize)
  useEventListener(document, 'click', handleClickOutside)

  // 使用ref直接访问元素
  nextTick(() => {
    if (logoImgRef.value) {
      // 确保初始加载时使用正确的图片路径
      logoImgRef.value.src = logoSrc.value
      forceLogoSize(logoImgRef.value)
      setupLogoObserver(logoImgRef.value)
    }

    // 同时使用DOM查询作为备用
    setTimeout(() => {
      const logoImg = document.querySelector(
        '.glass-header .logo-container .logo'
      ) as HTMLImageElement
      if (logoImg && logoImg !== logoImgRef.value) {
        forceLogoSize(logoImg)
        setupLogoObserver(logoImg)
      }
    }, 50)

    // 多次尝试修复（不同时机）- 只在图片加载完成后才设置
    ;[100, 300, 500, 1000].forEach(delay => {
      setTimeout(() => {
        const img =
          logoImgRef.value ||
          (document.querySelector('.glass-header .logo-container .logo') as HTMLImageElement)
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          const currentWidth = img.clientWidth || img.offsetWidth || 0
          const currentHeight = img.clientHeight || img.offsetHeight || 0

          if (currentWidth === 0 || currentHeight === 0) {
            forceLogoSize(img)
          }
        }
      }, delay)
    })
  })
})
</script>

<style scoped lang="scss">
// 使用单类，禁止高特异性
.logo-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: auto;
  height: 36px;
  flex-shrink: 0;
  flex-grow: 0;
  overflow: visible;
  position: relative;
  margin: 0;
  padding: 0;
  box-sizing: border-box;

  @media (width <= 767px) {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0;
    margin: 0;
    padding: 0;
    height: 36px;
    width: auto;
    min-width: auto;
    flex-shrink: 0;
  }
}

// 移动端菜单按钮样式
.mobile-menu-button {
  display: none;

  @media (width <= 767px) {
    display: inline-flex;
    order: -1;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 6px;
    margin: 0;
    background-color: transparent;
    border: none;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &:active {
      background-color: var(--el-fill-color);
    }

    .more-icon {
      width: 20px;
      height: 20px;
      stroke: var(--el-text-color-primary);
    }
  }
}

.logo {
  display: block;
  visibility: visible;
  opacity: 1;
  max-height: 36px;
  flex-shrink: 0;
  flex-grow: 0;
  object-fit: contain;
  position: relative;
  z-index: var(--z-base);
  box-sizing: border-box;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    filter 0.3s ease;

  /* 亮色/暗色均保持原色，避免被全局 filter 或半透明效果影响 */
  filter: none;

  @media (width <= 767px) {
    display: block;
    width: auto;
    height: 28px;
    max-height: 28px;
    margin: 0;
    padding: 0;
    flex-shrink: 0;
    flex-grow: 0;
  }

  &:hover {
    transform: scale(1.05);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 4px;
    border-radius: var(--global-border-radius);
  }
}

/* 暗色模式下 logo 保持原色 */
:where(html.dark) .logo,
:where(.glass-header.dark-mode) .logo,
:where(.glass-header.login-page-header.dark-mode) .logo {
  filter: none;
  transition:
    transform 0.2s ease,
    filter 0.3s ease;
}
</style>
