<template>
  <div class="login-page-root" :class="{ 'mouse-active': isMouseInViewport }">
    <!-- 深度背景系统 -->
    <div class="login-bg-system">
      <!-- 发光球体 -->
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <div class="bg-glow-orb orb-3"></div>
      <div class="mouse-glow-effect"></div>
      <!-- 环境光晕 -->
      <div class="ambient-aura aura-1"></div>
      <div class="ambient-aura aura-2"></div>
    </div>

    <!-- 跨项目登录提示和切换按钮 -->
    <div v-if="!isMobile && sourceInfo" class="cross-project-banner radius-auto scroll-reveal" data-animation="fadeInDown">
      <div class="banner-content">
        <el-icon class="banner-icon"><ArrowLeftRight /></el-icon>
        <span>{{ getLoggingInText(sourceInfo.name) }}</span>
      </div>
      <div class="banner-actions">
        <!-- 总管理端切换到用户端 -->
        <el-button
          v-if="currentSource === 'admin' || currentSource === 'edu-admin'"
          size="small"
          type="primary"
          plain
          @click="(e: MouseEvent) => { createRipple(e, e.currentTarget as HTMLElement); switchProject('user') }"
          class="switch-project-btn ripple-btn"
        >
          {{ t('login.crossProject.user') }}
        </el-button>
        <!-- 用户端切换到总管理端 -->
        <el-button
          v-if="currentSource === 'user' || currentSource === 'edu-web'"
          size="small"
          type="primary"
          plain
          @click="(e: MouseEvent) => { createRipple(e, e.currentTarget as HTMLElement); switchProject('admin') }"
          class="switch-project-btn ripple-btn"
        >
          {{ t('login.crossProject.admin') }}
        </el-button>
      </div>
    </div>

    <!-- 左侧品牌文本区域 - 现代化排版 -->
    <!-- 注意：不使用 scroll-reveal 动画，因为 transform 会干扰 fixed 定位 -->
    <div v-show="!isMobile" class="login-left-brand">
      <div class="brand-text-container">
        <!-- 主要内容区域 - 垂直居中 -->
        <div class="brand-main-content">
          <!-- 顶部：Logo + 品牌名 -->
          <div class="brand-header">
            <div class="brand-logo-wrapper">
              <img :src="logoImage" :alt="t('login.ihuiLogo')" class="logo-image" />
            </div>
            <div class="brand-name-group">
              <span class="brand-name font-edix">IHUI INF . AI</span>
              <span class="brand-badge font-edix">AI PLATFORM</span>
            </div>
          </div>

          <!-- 中部：核心标语 -->
          <div class="brand-hero">
            <h1 class="brand-title font-edix">
              <span class="title-prefix">{{ t('login.worldFirst') }}</span>
              <span class="title-main font-edix">AI APP STORE</span>
            </h1>
            <p class="brand-subtitle">{{ t('login.oneStopAI') }}</p>
          </div>

          <!-- 底部：数据指标 -->
          <div class="brand-metrics">
            <div class="metric-item">
              <span class="metric-value font-edix">100+</span>
              <span class="metric-label">{{ t('login.aiModels') }}</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-item">
              <span class="metric-value font-edix">{{ t('login.users500k') }}</span>
              <span class="metric-label">{{ t('login.users') }}</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-item">
              <span class="metric-value font-edix">99.9%</span>
              <span class="metric-label">{{ t('login.availability') }}</span>
            </div>
          </div>

          <!-- 装饰线 -->
          <div class="brand-decoration">
            <span class="deco-line"></span>
            <span class="deco-text font-edix">AIGC TO AGI</span>
            <span class="deco-line"></span>
          </div>
        </div>

        <!-- 品牌轮播图 - 定位在底部 -->
        <div class="brand-marquee-wrapper">
          <div class="brand-marquee" ref="marqueeRef">
            <div class="marquee-track">
              <div class="marquee-item" v-for="i in 8" :key="i">
                <img :src="getMarqueeImageSrc(i)" :alt="`Brand ${i}`" class="marquee-image" />
              </div>
              <!-- 复制一份用于无缝滚动 -->
              <div class="marquee-item" v-for="i in 8" :key="`copy-${i}`">
                <img :src="getMarqueeImageSrc(i)" :alt="`Brand ${i}`" class="marquee-image" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 登录表单容器 -->
    <!-- 注意：移除了 scroll-reveal、data-animation 和 glass-card，因为 transform/backdrop-filter 会影响内部 position: fixed 元素的定位 -->
    <div class="login-form-wrapper">
      <UniversalLogin
        :mode="isRegisterMode ? 'register' : 'login'"
        :project-selector-props="{
          isMobile,
          currentSource,
          availableProjects,
          selectedProject,
          selectProject,
          selectProjectText: t('login.selectProject'),
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useMediaQuery } from '@vueuse/core'
import { logger } from '../utils/logger'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { ArrowLeftRight } from '@/lib/lucide-fallback'
import { defineAsyncComponent } from 'vue'
const UniversalLogin = defineAsyncComponent(() => import('@/components/login/UniversalLogin.vue'))
import { useLoginProject } from '@/composables/login/useLoginProject'
import { useLoginAuth } from '@/composables/login/useLoginAuth'
import { useMouseGlow } from '@/composables/useMouseGlow'
import logoImage from '@/assets/images/logo-app.jpg'

// 品牌轮播图图标导入
import kouziIcon from '@/assets/images/kouzi-icon.png'
import bbxIcon from '@/assets/images/bbxlogo.svg'
import brand4Icon from '@/assets/images/组 1392.svg'
import openaiIcon from '@/assets/images/openai.png'
import brand6Icon from '@/assets/images/智谱清言@1x.png'
import brand7Icon from '@/assets/images/gork.png'
import brand8Icon from '@/assets/images/ali.png'
import brand9Icon from '@/assets/images/华为.svg'

// 统一工具 composables
const { showSuccess } = useOperationFeedback()
const { t } = useI18n()
const route = useRoute()

// 移动端检测 - 使用 useMediaQuery（响应式）
const isMobile = useMediaQuery('(max-width: 992px)')

// ============ 高级动效系统 ============
const { isMouseInViewport } = useMouseGlow()

// 滚动动画观察器
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())

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

let visibilityTimer: ReturnType<typeof setInterval> | null = null
let rafId: number | null = null // requestAnimationFrame ID

// 使用 Composables
// 注意：composables 中的 isMobile 参数目前未使用，已移除
const projectComposable = useLoginProject()
const {
  currentSource,
  selectedProject,
  sourceInfo,
  availableProjects,
  getLoggingInText,
  switchProject,
  selectProject,
} = projectComposable

// 登录状态检查 - 在 onMounted 中处理消息提示
useLoginAuth({
  onLoginSuccess: () => {
    // 在组件挂载后处理登录成功后的消息提示
    try {
      const message = route.query.message as string
      if (message) {
        showSuccess(decodeURIComponent(message))
      }
    } catch (err) {
      logger.error('Failed to process login message:', err)
    }
  },
})

// resize 监听处理函数（具名引用，确保 add/remove 一致）
let resizeRafId: number | null = null
const handleBrandResize = () => {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    updateBrandTextSpacing()
  })
}

// 更新品牌文本容器的间距，确保避让登录表单
// 使用全局 CSS 变量和登录容器位置来精确计算
const updateBrandTextSpacing = (retryCount = 0, maxRetries = 15) => {
  if (isMobile.value) return // 移动端不需要调整

  const loginContainer = document.querySelector('.login-content.login-page') as HTMLElement | null
  const brandContainer = document.querySelector('.login-left-brand') as HTMLElement | null

  if (!loginContainer || !brandContainer) {
    if (retryCount < maxRetries) {
      setTimeout(() => updateBrandTextSpacing(retryCount + 1, maxRetries), 150)
    }
    return
  }

  const loginRect = loginContainer.getBoundingClientRect()
  const loginLeft = loginRect.left
  const _loginTop = loginRect.top // 预留供将来使用
  const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--login-header-height'), 10) || 60

  // 如果登录容器还没有渲染完成，延迟重试
  if (loginRect.width < 100 || loginLeft <= 0) {
    if (retryCount < maxRetries) {
      setTimeout(() => updateBrandTextSpacing(retryCount + 1, maxRetries), 150)
    }
    return
  }

  // 从全局 CSS 变量读取间距值
  const rootStyles = getComputedStyle(document.documentElement)
  const spacing = parseInt(rootStyles.getPropertyValue('--login-spacing'), 10) || 20

  // 设置完整的定位属性
  // 使用与登录栏相同的顶部位置
  const topPosition = headerHeight + spacing
  brandContainer.style.position = 'fixed'
  brandContainer.style.left = `${spacing}px`
  brandContainer.style.top = `${topPosition}px`
  brandContainer.style.bottom = `${spacing}px`

  // 计算宽度：登录栏左边界 - 左间距 - 与登录栏的间距
  const availableWidth = loginLeft - spacing - spacing
  if (availableWidth > 0) {
    brandContainer.style.width = `${availableWidth}px`
    brandContainer.style.maxWidth = `${availableWidth}px`
  }
}

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()

onMounted(() => {
  // 初始化高级动效系统
  initScrollAnimations()


  // 简化：只处理被其他脚本/样式意外隐藏的情况，不重复设置CSS已定义的样式
  // CSS样式已在 Login.vue.styles.scss 中正确定义，这里只做兜底检查
  const ensureVisible = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      const loginContainer = document.querySelector(
        '.login-content.login-page'
      ) as HTMLElement | null

      // 只检查是否被意外隐藏，不重复设置CSS已定义的样式
      if (loginContainer) {
        const computedStyle = window.getComputedStyle(loginContainer)
        const rect = loginContainer.getBoundingClientRect()

        // 只在被意外隐藏或尺寸异常时才修复
        const isHidden =
          computedStyle.display === 'none' ||
          computedStyle.opacity === '0' ||
          computedStyle.visibility === 'hidden' ||
          rect.height < 100 ||
          rect.width < 100

        if (isHidden) {
          // 只修复可见性问题，尺寸由CSS控制
          if (computedStyle.display === 'none') {
            loginContainer.style.display = 'flex'
          }
          if (computedStyle.opacity === '0') {
            loginContainer.style.opacity = '1'
          }
          if (computedStyle.visibility === 'hidden') {
            loginContainer.style.visibility = 'visible'
          }
        }
      }

      // 处理其他可能遮盖登录页面的组件（z-index调整）
      const chatInputBox = document.querySelector('.chat-shell') as HTMLElement | null
      if (chatInputBox) {
        const computedZIndex = window.getComputedStyle(chatInputBox).zIndex
        if (parseInt(computedZIndex) > 1000) {
          chatInputBox.style.zIndex = '999'
        }
      }

      const chatToggleBtn = document.querySelector('.chat-toggle-btn') as HTMLElement | null
      if (chatToggleBtn) {
        const computedZIndex = window.getComputedStyle(chatToggleBtn).zIndex
        if (parseInt(computedZIndex) > 1000) {
          chatToggleBtn.style.zIndex = '999'
        }
      }

      // 强制隐藏所有错误覆盖层（登录页面不允许显示错误覆盖层）
      const errorOverlay = document.querySelector('.error-overlay') as HTMLElement | null
      if (errorOverlay) {
        // 使用 .hidden 工具类隐藏，使用工具类
        errorOverlay.classList.add('hidden')
      }

      // 确保错误边界容器背景透明
      const errorWrapper = document.querySelector('.error-boundary-wrapper') as HTMLElement | null
      if (errorWrapper) {
        errorWrapper.style.background = 'transparent'
        errorWrapper.style.backgroundColor = 'transparent'
        errorWrapper.style.backgroundImage = 'none'
      }

      rafId = null
    })
  }

  // 只在挂载时检查一次，不再定时检查（CSS样式应该正常工作）
  ensureVisible()

  // 监听窗口大小变化，更新品牌文本容器间距
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleBrandResize)

    // 使用 ResizeObserver 监听登录容器尺寸变化
    const loginContainer = document.querySelector('.login-content.login-page')
    if (loginContainer) {
      const resizeObserver = new ResizeObserver(() => {
        updateBrandTextSpacing()
      })
      resizeObserver.observe(loginContainer)

      // 在组件卸载时清理
      cleanup.add(() => {
        resizeObserver.disconnect()
      })
    }

    // 使用 nextTick 确保 DOM 已渲染后再执行
    // updateBrandTextSpacing 现在有内置的重试机制，不需要多次延迟调用
    nextTick(() => {
      // 初始调用，函数会自动重试直到登录表单渲染完成
      updateBrandTextSpacing()
    })
  }

  // 可选：如果确实需要定时检查（例如有动态样式注入），可以启用，但建议移除
  // visibilityTimer = setInterval(ensureVisible, 5000)
})

cleanup.add(() => { if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null } })
cleanup.add(() => { if (visibilityTimer) { clearInterval(visibilityTimer); visibilityTimer = null } })
cleanup.add(() => { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null } })
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
cleanup.add(() => { if (typeof window !== 'undefined') { window.removeEventListener('resize', handleBrandResize) } })
// 尝试恢复容器 display/opacity，避免影响其它页面
cleanup.add(() => {
  const targets: (HTMLElement | null)[] = [
    document.querySelector('.login-content.login-page') as HTMLElement | null,
  ]
  targets.forEach(target => {
    if (!target) return
    target.style.display = ''
    target.style.opacity = ''
    target.style.visibility = ''
    target.style.pointerEvents = ''
    target.style.backgroundColor = ''
    target.style.minHeight = ''
    target.style.minWidth = ''
  })
})

// 使用完整登录组件 UniversalLogin

// 根据路由判断是否为注册模式
const isRegisterMode = computed(
  () => ((route as any).name as string) === 'register' || route.path === '/register'
)

// 品牌轮播图函数
const marqueeRef = ref<HTMLElement | null>(null)

const getMarqueeImageSrc = (index: number) => {
  const images = [kouziIcon, bbxIcon, brand4Icon, openaiIcon, brand6Icon, brand7Icon, brand8Icon, brand9Icon]
  return images[(index - 1) % images.length] || '/images/logo.svg'
}
</script>

<style lang="scss">
/* 需要全局作用域以覆盖子组件/Element Plus 的内部样式 */
@use './Login.vue.styles.scss' as *;
</style>

<style lang="scss" scoped>
// ============ 高科技工业风格登录页样式 ============
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--el-text-color-regular);
$brand-tertiary: var(--el-text-color-secondary);
$bg-page: var(--el-bg-color-page);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);

// ============ 根容器 ============
// 通过 CSS 变量控制子组件样式（遵循规则 3：禁止跨组件样式覆盖）
.login-page-root {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;

  // ============ CSS 变量传递给子组件 ============
  // 子组件 UniversalLogin 会继承这些变量值
  --ulogin-content-width: 420px;
  --ulogin-content-min-width: 380px;
  --ulogin-content-max-width: 480px;
  --ulogin-right-spacing: 20px;
  --ulogin-spacing: 20px;
  --ulogin-header-height: 60px;
  --ulogin-content-min-height: 580px;

  &.mouse-active .mouse-glow-effect {
    opacity: 0;
  }
}

// ============ 深度背景系统 ============
:where(.login-bg-system) {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  overflow: hidden;

  // 发光球体
  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(100px);
    opacity: 0.12;
    animation: floatOrb 20s ease-in-out infinite;

    &.orb-1 {
      width: 500px;
      height: 500px;
      top: -10%;
      right: 15%;
      background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
      animation-delay: 0s;
    }

    &.orb-2 {
      width: 400px;
      height: 400px;
      bottom: 10%;
      left: 5%;
      background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
      animation-delay: -7s;
    }

    &.orb-3 {
      width: 300px;
      height: 300px;
      top: 40%;
      left: 30%;
      background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
      animation-delay: -14s;
    }
  }

  .mouse-glow-effect {
    position: absolute;
    left: 0;
    top: 0;
    width: 800px;
    height: 800px;
    border-radius: var(--global-border-radius);
    background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
    opacity: 0;
    pointer-events: none;
  }

  // 环境光晕
  .ambient-aura {
    position: absolute;
    width: 60vw;
    height: 60vw;
    border-radius: var(--global-border-radius);
    filter: blur(150px);
    opacity: 0.06;
    mix-blend-mode: screen;

    &.aura-1 {
      top: -20%;
      right: -15%;
      background: var(--color-cyan-00d4ff-05);
    }

    &.aura-2 {
      bottom: -25%;
      left: -15%;
      background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
    }
  }
}

// ============ 滚动触发动画系统 ============
.scroll-reveal {
  opacity: 0;
  transition: none;

  &.scroll-animated {
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }

  &.animate-fadeInDown {
    opacity: 1;
    transform: translateY(0);
  }

  &.animate-fadeInLeft {
    opacity: 1;
    transform: translateX(0);
  }

  &.animate-fadeInRight {
    opacity: 1;
    transform: translateX(0);
  }
}

// 初始状态
.scroll-reveal[data-animation="fadeInUp"] {
  transform: translateY(40px);
}

.scroll-reveal[data-animation="fadeInDown"] {
  transform: translateY(-40px);
}

.scroll-reveal[data-animation="fadeInLeft"] {
  transform: translateX(-40px);
}

.scroll-reveal[data-animation="fadeInRight"] {
  transform: translateX(40px);
}

// ============ 玻璃态卡片 ============
.glass-card {
  background: rgb(var(--el-fill-color-light-rgb), 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: rgba($brand-primary, 0.2);
  }
}

// ============ 涟漪效果 ============
.ripple-btn {
  position: relative;
  overflow: hidden;
}

// ============ 品牌区域样式优化 - 现代化排版 ============
:where(.login-left-brand) {
  .brand-text-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    width: 100%;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
    background-color: transparent;
    background: transparent;
  }

  // 主要内容区域 - 垂直居中
  .brand-main-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    flex: 1;
    width: 100%;
  }

  // 顶部：Logo + 品牌名
  .brand-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  // Logo 容器 - 正方形小圆角
  .brand-logo-wrapper {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: var(--global-border-radius);
    overflow: hidden;
    border: var(--unified-border);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.05);
      border-color: rgba($brand-primary, 0.35);
    }

    .logo-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  // 品牌名组
  :where(.brand-name-group) {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .brand-name {
      font-size: 20px;
      font-weight: 800;
      color: $text-main;
      letter-spacing: 0.05em;
      line-height: 1.1;

      // EDIX 字体 - 英文品牌名
      &.font-edix {
        font-family: EDIX, sans-serif;
      }
    }

    .brand-badge {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      font-weight: 600;
      color: $text-sec;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 3px 8px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      width: fit-content;

      // EDIX 字体 - 英文徽章
      &.font-edix {
        font-family: EDIX, sans-serif;
      }
    }
  }

  // 中部：核心标语
  .brand-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .brand-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin: 0;

    // h1 标签使用 EDIX 字体
    &.font-edix {
      font-family: EDIX, sans-serif;
    }

    .title-prefix {
      font-size: clamp(42px, 4vw, 56px);
      font-weight: 900;
      color: $text-main;
      letter-spacing: 0.05em;
    }

    :where(.title-main) {
      font-size: clamp(36px, 4.5vw, 56px);
      font-weight: 900;
      color: var(--el-text-color-primary);
      letter-spacing: -0.02em;
      line-height: 1.05;
      white-space: nowrap;

      &.font-edix {
        font-family: EDIX, sans-serif;
      }
    }
  }

  .brand-subtitle {
    font-size: clamp(16px, 1.8vw, 20px);
    font-weight: 400;
    color: $text-sec;
    letter-spacing: 0.02em;
    margin: 0;
    line-height: 1.5;
  }

  // 底部：数据指标
  :where(.brand-metrics) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 24px 40px;
    border-top: var(--unified-border);
    border-bottom: var(--unified-border-bottom);
    width: fit-content;

    :where(.metric-item) {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .metric-value {
        font-size: 28px;
        font-weight: 800;
        color: $brand-primary;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
        line-height: 1;

        // EDIX 字体 - 数值
        &.font-edix {
          font-family: EDIX, sans-serif;
        }
      }

      .metric-label {
        font-size: 12px;
        font-weight: 500;
        color: $text-sec;
        letter-spacing: 0.02em;
      }
    }

    .metric-divider {
      width: 1px;
      height: 40px;
      background: var(--el-fill-color-darker);
    }
  }

  // 装饰线
  .brand-decoration {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    opacity: 0.4;

    .deco-line {
      flex: 1;
      height: 1px;
      background: var(--el-fill-color-darker);
    }

    .deco-text {
      font-size: 12px;
      font-weight: 600;
      color: $text-sec;
      letter-spacing: 0.1em;

      // EDIX 字体 - 装饰文字
      &.font-edix {
        font-family: EDIX, sans-serif;
      }
    }
  }

  // 品牌轮播图
  .brand-marquee-wrapper {
    width: 100%;
    overflow: visible; // 允许超出容器边缘显示
    margin-top: 16px;
  }

  .brand-marquee {
    width: 100%;
    overflow: hidden;

    .marquee-track {
      display: flex;
      align-items: center;
      gap: 24px;
      animation: marqueeScroll 20s linear infinite;
      width: max-content;
    }

    .marquee-item {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      background: var(--el-bg-color);
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      transition: all 0.3s ease;

      &:hover {
        background: var(--el-bg-color);
        transform: translateY(-2px);
      }
    }

    .marquee-image {
      height: 32px;
      width: auto;
      max-width: 80px;
      object-fit: contain;
    }
  }
}

// 轮播动画
@keyframes marqueeScroll {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

// ============ 登录表单包装器 ============
.login-form-wrapper {
  position: relative;
  z-index: calc(var(--z-base) + 9);

  // 输入框聚焦效果增强
  :deep(.el-input__wrapper) {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: var(--unified-border);

    &:hover {
      border-color: rgba($brand-primary, 0.15);
    }

    &.is-focus {
      border-color: $brand-primary;
      outline: 2px solid rgba($brand-primary, 0.25);
      outline-offset: 2px;
    }
  }

  // 按钮样式增强 - 纯黑色背景
  :deep(.el-button--primary) {
    background: var(--el-text-color-primary);
    border: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: var(--el-text-color-regular);
      transform: translateY(-2px);
    }

    &:active {
      background: var(--el-text-color-secondary);
      transform: translateY(0);
    }
  }
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(60px, 60px); }
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -25px) scale(1.05); }
  50% { transform: translate(-25px, 35px) scale(0.95); }
  75% { transform: translate(-35px, -15px) scale(1.02); }
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

@keyframes pulseRing {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }

  50% {
    transform: scale(1.1);
    opacity: 0.2;
  }
}

@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

// ============ 暗色模式适配 ============
:where(html.dark) .login-page-root,
:where(body.dark) :where(.login-page-root) {
  :where(.login-bg-system) {
    .bg-glow-orb {
      opacity: 0.08;

      &.orb-1 {
        background: var(--color-white-5);
      }

      &.orb-2 {
        background: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
      }

      &.orb-3 {
        background: color-mix(in srgb, var(--el-color-primary) 3%, transparent);
      }
    }

    // 暗色模式下 screen 混合会让光晕过亮，影响整体视觉层次，改用 normal
    .ambient-aura {
      mix-blend-mode: normal;
    }
  }

  &.mouse-active .mouse-glow-effect {
    opacity: 0;
  }
}

// ============ 暗色模式适配 ============
:where(html.dark) .login-page-root,
:where(body.dark) :where(.login-page-root) {
  :where(.login-bg-system) {
    .mouse-glow-effect {
      opacity: 0;
    }
  }

  .glass-card {
    background: var(--el-fill-color-dark, color-mix(in srgb, var(--el-color-primary) 70%, transparent));
    border-color: var(--el-border-color-darker);

    &:hover {
      border-color: var(--el-border-color-dark);
    }
  }

  :where(.login-left-brand) {
    .brand-logo-wrapper {
      border-color: var(--color-white-20);

      &:hover {
        border-color: var(--color-white-35);
      }
    }

    :where(.brand-name-group) {
      .brand-name {
        color: var(--el-color-white);
      }

      .brand-badge {
        background: var(--color-white-8);
        color: var(--el-text-color-regular);
      }
    }

    .brand-title {
      .title-prefix {
        color: var(--el-text-color-regular);
      }

      :where(.title-main) {
        color: var(--el-color-white);
      }
    }

    .brand-subtitle {
      color: var(--el-text-color-regular);
    }

    :where(.brand-metrics) {
      border-color: var(--el-border-color-darker);

      :where(.metric-item) .metric-value {
        color: var(--el-color-white);
      }

      :where(.metric-item) .metric-label {
        color: var(--el-text-color-regular);
      }

      .metric-divider {
        background: var(--el-fill-color-light);
      }
    }

    .brand-decoration {
      .deco-line {
        background: var(--el-fill-color-light);
      }

      .deco-text {
        color: var(--el-text-color-regular);
      }
    }
  }
}

// ============ 响应式设计 ============
@media (width <= 992px) {
  .login-left-brand {
    display: none;
  }

  .login-form-wrapper {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
  }

  :where(.login-bg-system) {
    .bg-glow-orb {
      &.orb-1 {
        width: 300px;
        height: 300px;
      }

      &.orb-2 {
        width: 250px;
        height: 250px;
      }

      &.orb-3 {
        display: none;
      }
    }
  }
}
</style>
