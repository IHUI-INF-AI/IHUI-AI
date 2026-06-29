<template>
  <div class="home-container">
    <!-- i18n: home.comments.mainContent -->
    <!-- i18n: home.comments.firstPage -->
    <main id="first-page" class="page-section" aria-labelledby="home-hero-title">
      <!-- i18n: home.comments.interactiveText -->
      <div class="page-content first-page-content-overlay">
        <h1 id="home-hero-title" class="brand-welcome-text font-edix">WELCOME IHUI INF . AI</h1>
        <p class="hero-description">
          <span class="typing-text">{{ currentTypingText }}</span><span class="cursor-blink">_</span>
        </p>
        <div class="hero-cta">
        <button type="button" class="hero-cta-btn" :aria-label="t('home.page1.ctaPrimary')" @click="handleOpenChat">
          {{ t('home.page1.ctaPrimary') }}
        </button>
        <el-button type="default" size="large" class="hero-cta-btn ghost" @click="goToLearnAI">
          {{ t('home.page1.ctaSecondary') }}
        </el-button>
        <el-button type="success" size="large" class="hero-cta-btn miniapp-btn" @click="showMiniappQR = true">
          <el-icon><Iphone /></el-icon>
          {{ t('home.miniappBtn') }}
        </el-button>
      </div>

      <!-- 小程序二维码弹窗 -->
      <Teleport to="body">
        <div v-if="showMiniappQR" class="miniapp-modal-overlay" @click="showMiniappQR = false">
          <div class="miniapp-modal" @click.stop>
            <div class="miniapp-modal-header">
              <span>{{ t('home.miniappModal.title') }}</span>
              <button class="miniapp-modal-close" :aria-label="t('common.close')" @click="showMiniappQR = false">×</button>
            </div>
            <div class="miniapp-modal-body">
              <img src="/footer/erweima/footer-icon-2.png" class="miniapp-qr-code" :alt="t('home.miniappModal.qrAlt')" />
              <p class="miniapp-scan-tip">{{ t('home.miniappModal.scanTip') }}</p>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
    </main>

    <!-- i18n: home.comments.secondPage -->
    <main id="second-page" class="page-section radius-auto" aria-labelledby="home-page2-title">
      <div class="page-content second-page-content">
        <div class="second-page-title-wrapper">
          <h2 id="home-page2-title" class="second-page-title">{{ t('home.page2.title') }}</h2>
          <h3 class="second-page-title-english font-edix">{{ t('home.page2.titleEn') }}</h3>
          <p class="second-page-description">{{ t('home.page2.content') }}</p>
        </div>
        <!-- i18n: home.comments.featuresGrid -->
        <div class="features-grid">
          <div
            class="feature-card ihui-ai-card-hover ihui-ai-fade-in-left-animation"
            @click="goToXuqiu"
            :class="{ 'is-navigating': isNavigating }"
            style="animation-delay: 0.1s"
          >
            <el-icon class="feature-icon" aria-hidden="true">
              <svg
                class="linear-icon"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="8"
                  r="2.5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                />
                <circle
                  cx="7"
                  cy="14"
                  r="2"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                />
                <circle
                  cx="17"
                  cy="14"
                  r="2"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                />
                <path
                  d="M12 10.5v2M9.5 12.5l-1.5 1M14.5 12.5l1.5 1"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </el-icon>
            <span>{{ t('home.page2.features.modelIntegration') }}</span>
          </div>
          <div
            class="feature-card ihui-ai-card-hover ihui-ai-fade-in-top-animation"
            @click="goToXuqiu"
            :class="{ 'is-navigating': isNavigating }"
            style="animation-delay: 0.2s"
          >
            <el-icon class="feature-icon" aria-hidden="true">
              <svg
                class="linear-icon"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
              >
                <path
                  d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 6h18"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <path
                  d="M9 10a3 3 0 1 1 6 0v8H9V10z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </el-icon>
            <span>{{ t('home.page2.features.appStore') }}</span>
          </div>
          <div
            class="feature-card ihui-ai-card-hover ihui-ai-fade-in-right-animation"
            @click="goToXuqiu"
            :class="{ 'is-navigating': isNavigating }"
            style="animation-delay: 0.3s"
          >
            <el-icon class="feature-icon" aria-hidden="true">
              <svg
                class="linear-icon"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </el-icon>
            <span>{{ t('home.page2.features.contentCreation') }}</span>
          </div>
          <div
            class="feature-card ihui-ai-card-hover ihui-ai-fade-in-top-animation"
            @click="goToLearnAI"
            :class="{ 'is-navigating': isNavigating }"
            style="animation-delay: 0.5s"
          >
            <el-icon class="feature-icon" aria-hidden="true">
              <svg
                class="linear-icon"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
              >
                <path
                  d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M10 7h6M10 11h6M10 15h4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </el-icon>
            <span>{{ t('home.page2.features.edu') }}</span>
          </div>
          <div
            class="feature-card ihui-ai-card-hover ihui-ai-fade-in-right-animation"
            @click="goToXuqiu"
            :class="{ 'is-navigating': isNavigating }"
            style="animation-delay: 0.6s"
          >
            <el-icon class="feature-icon" aria-hidden="true">
              <svg
                class="linear-icon"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 2v4M12 18v4M2 12h4M18 12h4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <path
                  d="M12 8l4 4-4 4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </el-icon>
            <span>{{ t('home.page2.features.navigation') }}</span>
          </div>
        </div>

        <!-- 核心优势展示区域 -->
        <div class="advantages-section">
          <div class="advantages-header">
            <h3 class="advantages-title">{{ t('home.page2.advantages.title') }}</h3>
            <h4 class="advantages-title-english font-edix">{{ t('home.page2.advantages.titleEn') }}</h4>
            <p class="advantages-subtitle">{{ t('home.page2.advantages.subtitle') }}</p>
          </div>
          <div class="advantages-grid">
            <div
              class="advantage-card ihui-ai-card-hover"
              :class="{
                'ihui-ai-fade-in-bottom-animation': true,
                'is-navigating': isNavigating
              }"
              style="animation-delay: 0.7s"
            >
              <div class="advantage-icon professional-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5z"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h4 class="advantage-card-title">{{ t('home.page2.advantages.professional.title') }}</h4>
              <p class="advantage-card-description">
                {{ t('home.page2.advantages.professional.description') }}
              </p>
            </div>

            <div
              class="advantage-card ihui-ai-card-hover"
              :class="{
                'ihui-ai-fade-in-bottom-animation': true,
                'is-navigating': isNavigating
              }"
              style="animation-delay: 0.8s"
            >
              <div class="advantage-icon efficient-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 6v6l4 2"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h4 class="advantage-card-title">{{ t('home.page2.advantages.efficient.title') }}</h4>
              <p class="advantage-card-description">
                {{ t('home.page2.advantages.efficient.description') }}
              </p>
            </div>

            <div
              class="advantage-card ihui-ai-card-hover"
              :class="{
                'ihui-ai-fade-in-bottom-animation': true,
                'is-navigating': isNavigating
              }"
              style="animation-delay: 0.9s"
            >
              <div class="advantage-icon reliable-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 12l2 2 4-4"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3zM3 12c1 0 3-1 3-3S4 6 3 6s-3 1-3 3 2 3 3 3zM12 21c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3z"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h4 class="advantage-card-title">{{ t('home.page2.advantages.reliable.title') }}</h4>
              <p class="advantage-card-description">
                {{ t('home.page2.advantages.reliable.description') }}
              </p>
            </div>

            <div
              class="advantage-card ihui-ai-card-hover"
              :class="{
                'ihui-ai-fade-in-bottom-animation': true,
                'is-navigating': isNavigating
              }"
              style="animation-delay: 1.0s"
            >
              <div class="advantage-icon innovative-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2v6m0 8v6M2 12h6m8 0h6"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke-width="1.6"
                    fill="none"
                  />
                </svg>
              </div>
              <h4 class="advantage-card-title">{{ t('home.page2.advantages.innovative.title') }}</h4>
              <p class="advantage-card-description">
                {{ t('home.page2.advantages.innovative.description') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 第三页 - 新闻展示 -->
    <HomePage3 />

    <!-- 第四页 - 价格展示 -->
    <HomePage4
      :title="t('home.page4.title')"
      :title-en="t('home.page4.titleEn')"
      :content="t('home.page4.content')"
    />

    <!-- 第五页 - 包含合作伙伴和Footer -->
    <main class="page-section" id="fifth-page">
      <div class="page-content fifth-page-content">
        <h2 class="fifth-page-title">{{ t('home.page5.title') }}</h2>
        <h3 class="fifth-page-title-english font-edix">{{ t('home.page5.titleEn') }}</h3>
        <p class="fifth-page-description">{{ t('home.page5.content') }}</p>
        <div
          class="brand-marquee"
          @mousedown="handleMarqueeMouseDown"
          @touchstart="handleMarqueeTouchStart"
          @wheel="handleMarqueeWheel"
        >
          <div class="marquee-track" ref="marqueeTrackRef" :class="{ 'dragging': isDragging }">
            <!-- 原始卡片列表 -->
            <div class="marquee-item" v-for="i in 15" :key="i">
              <img
                :src="getMarqueeImageSrc(i)"
                :alt="getMarqueeImageAlt(i)"
                class="marquee-image"
                width="160"
                height="80"
                loading="lazy"
                @error="handleImageError($event, i)"
                @load="handleImageLoad($event, i)"
              >
            </div>
            <!-- 复制一份用于无缝循环 -->
            <div class="marquee-item" v-for="i in 15" :key="`copy-${i}`">
              <img
                :src="getMarqueeImageSrc(i)"
                :alt="getMarqueeImageAlt(i)"
                class="marquee-image"
                width="160"
                height="80"
                loading="lazy"
                @error="handleImageError($event, i)"
                @load="handleImageLoad($event, i)"
              >
            </div>
          </div>
        </div>
        <p class="marquee-footer-text">{{ t('home.page5.joinText') }}</p>
      </div>
      <Footer />
    </main>

    <!-- 优惠活动弹窗 -->
    <PromotionModal @get-credits="handleGetCredits" />

    <!-- 页码指示器（右侧小圆点） -->
    <PageIndicator :current-page="currentPageIndex" :total-pages="totalPages" :scroll-to-page="scrollToPageIndex" />

    <!-- 向下滚动按钮（底部箭头） -->
    <ScrollDownButton :current-page="currentPageIndex" :total-pages="totalPages" :scroll-to-page="scrollToPageIndex" />
  </div>
</template>

<script setup lang="ts">

import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useIntersectionObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import { loadModule, getCurrentLocale } from '@/locales'
import _IhuiAiEffectsLayer from '@/components/IhuiAiEffectsLayer.vue'
import Footer from '@/components/Footer.vue'
import HomePage3 from '@/components/home/HomePage3.vue'
import HomePage4 from '@/components/home/HomePage4.vue'
import PromotionModal from '@/components/home/PromotionModal.vue'
import PageIndicator from '@/components/home/PageIndicator.vue'
import ScrollDownButton from '@/components/home/ScrollDownButton.vue'
import { Iphone } from '@element-plus/icons-vue'

import { useHomeNavigation } from '@/composables/home/useHomeNavigation'
import { useFullPageScroll } from '../composables/home/useFullPageScroll'
import { useHomeAnalytics } from '@/composables/useAnalytics'

// 小程序二维码弹窗状态
const showMiniappQR = ref(false)

// 小程序二维码弹窗：ESC 关闭 + 背景滚动锁定
const onMiniappKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showMiniappQR.value) {
    showMiniappQR.value = false
  }
}
watch(showMiniappQR, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', onMiniappKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onMiniappKeydown)
    document.body.style.overflow = ''
  }
})
// 品牌跑马灯图片导入
import kouziIcon from '@/assets/images/kouzi-icon.png'
import bbxIcon from '@/assets/images/bbxlogo.svg'
import openaiIcon from '@/assets/images/openai.png'
import brand6Icon from '@/assets/images/智谱清言@1x.png'
import brand7Icon from '@/assets/images/gork.png'
import brand8Icon from '@/assets/images/8@1x.png'
import brand9Icon from '@/assets/images/ali.png'
import brand10Icon from '@/assets/images/TX.png'
import brand11Icon from '@/assets/images/华为.svg'
import brand12Icon from '@/assets/images/百度.svg'
import brand13Icon from '@/assets/images/ybx.png'
import brand14Icon from '@/assets/images/Yushu.png'
import brand15Icon from '@/assets/images/dbsfdx.png'
import brand16Icon from '@/assets/images/jldx.png'
import n8nIcon from '@/assets/images/n8n.svg'

const { t } = useI18n()
const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// 全屏分页滚动（供模板中的 currentPage / totalPages / scrollToPage 使用）
const { currentPage, totalPages, scrollToPage } = useFullPageScroll()
// 组件期望 0-based 页码，useFullPageScroll 为 1-based，做一层适配
const currentPageIndex = computed(() => currentPage.value - 1)
const scrollToPageIndex = (index: number) => scrollToPage(index + 1)

// 打字机效果
const typewriterPhrases = computed(() => [
  t('home.page1.content'),
  t('home.typewriter.explore'),
  t('home.typewriter.brand'),
  t('home.typewriter.connect'),
])
const currentTypingText = ref('')
let typewriterPhraseIdx = 0
let typewriterCharIdx = 0
let typewriterDeleting = false
let typewriterTimer: ReturnType<typeof setTimeout> | null = null
// 跑马灯相关的延迟定时器（统一管理，卸载时清理）
const pendingTimers: ReturnType<typeof setTimeout>[] = []
const trackTimer = (id: ReturnType<typeof setTimeout>) => {
  pendingTimers.push(id)
  return id
}

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
  if (reduceMotion) {
    currentTypingText.value = t('home.page1.content')
    return
  }
  if (typewriterTimer) clearTimeout(typewriterTimer)
  typewriterPhraseIdx = 0
  typewriterCharIdx = 0
  typewriterDeleting = false
  currentTypingText.value = ''
  runTypewriterEffect()
}

const firstPageSectionRef = ref<HTMLElement | null>(null)
const marqueeTrackRef = ref<HTMLElement | null>(null)
const heroAnimationReady = ref(reduceMotion ? true : false)

// 跑马灯拖拽相关状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragCurrentX = ref(0)
const dragOffset = ref(0)

// 跑马灯固定参数（原按钮切换档位已移除）
const WHEEL_SENSITIVITY = 0.5
const MARQUEE_SPEED = 1
let animationId: number | null = null
let homeScrollRafId: number | null = null
let _originalTransform = ''
let isMouseDown = false
let isTouchStart = false
let lastTouchTime = 0
// 惯性滑动相关
let dragVelocity = 0
let lastDragX = 0
let lastDragTime = 0
let inertiaId: number | null = null

// 认证状态
const authStore = useAuthStore()
type AuthUserLite = {
  uuid?: string | null
  nickname?: string | null
  email?: string | null
  phone?: string | null
  needPwd?: number | null
}
const _authUser = computed(() => authStore.user as unknown as AuthUserLite | null)

useIntersectionObserver(
  firstPageSectionRef,
  entries => {
    const [entry] = entries
    if (entry?.isIntersecting) {
      heroAnimationReady.value = true
      return true
    }
    return false
  },
  { threshold: 0.1 }
)

onMounted(async () => {
  trackHomePageView()

  try {
    await loadModule(getCurrentLocale(), 'home')
  } catch (e) {
    logger.warn('[Home] Failed to load home module:', e)
  }

  // 启动打字机效果
  startTypewriter()

  // 禁用浏览器自动恢复滚动位置
  if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }

  // 账号绑定弹窗仅在登录页展示，首页不展示

  // 确保首页容器滚动位置在顶部
  const homeContainer = document.querySelector('.home-container') as HTMLElement
  if (homeContainer) {
    // 完全禁用 scroll-snap，避免自动对齐 - 永远不重新启用
    homeContainer.style.scrollSnapType = 'none'
    homeContainer.scrollTop = 0

    // 使用 requestAnimationFrame 确保滚动位置已应用
    homeScrollRafId = requestAnimationFrame(() => {
      if (homeContainer) {
        homeContainer.scrollTop = 0
        // 不再重新启用 scroll-snap
      }
    })
  }

  if (!firstPageSectionRef.value) {
    firstPageSectionRef.value = document.getElementById('first-page') as HTMLElement | null
  }

  // 初始化跑马灯拖拽功能和自动滚动
  initMarqueeDrag()
  // 延迟启动动画，确保DOM和图片都已加载完成
  trackTimer(setTimeout(() => {
    startMarqueeAnimation()
  }, 500))
})

// 跑马灯拖拽功能
const initMarqueeDrag = () => {
  // 初始化时获取当前transform值
  nextTick(() => {
    if (marqueeTrackRef.value) {
      const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
      _originalTransform = computedStyle.transform || 'translateX(0px)'
    }
  })
}

// 鼠标按下
const handleMarqueeMouseDown = (e: MouseEvent) => {
  // 触摸设备上浏览器会模拟 mouse 事件，触摸后 500ms 内忽略鼠标事件避免冲突
  if (lastTouchTime && Date.now() - lastTouchTime < 500) return
  if (!marqueeTrackRef.value) return

  isMouseDown = true

  // 初始化惯性追踪
  dragVelocity = 0
  lastDragX = e.clientX
  lastDragTime = Date.now()

  // 停止JavaScript动画
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  isDragging.value = true
  dragStartX.value = e.clientX
  dragCurrentX.value = e.clientX

  // 移除CSS动画，改用transform控制
  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
    // 获取当前transform值
    const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
    const matrix = computedStyle.transform
    if (matrix && matrix !== 'none') {
      const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
      if (matrixValues && matrixValues.length >= 4) {
        dragOffset.value = parseFloat(matrixValues[4]) || 0
        // 规范化位置到有效范围内
        const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
        if (items.length >= 16) {
          const firstItem = items[0] as HTMLElement
          const item16 = items[15] as HTMLElement
          // 直接测量第16个卡片相对于第1个卡片的位置差
          const originalWidth = item16.offsetLeft - firstItem.offsetLeft
          while (dragOffset.value <= -originalWidth) {
            dragOffset.value += originalWidth
          }
          while (dragOffset.value > 0) {
            dragOffset.value -= originalWidth
          }
        }
      }
    } else {
      dragOffset.value = 0
    }
  }

  // 绑定到document，这样可以在整个窗口内拖拽
  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('mouseup', handleDocumentMouseUp)

  e.preventDefault()
  e.stopPropagation()
}

// 触摸开始（移动端）
const handleMarqueeTouchStart = (e: globalThis.TouchEvent) => {
  if (!marqueeTrackRef.value) return

  isTouchStart = true
  lastTouchTime = Date.now()
  const touch = e.touches[0]

  // 初始化惯性追踪
  dragVelocity = 0
  lastDragX = touch.clientX
  lastDragTime = Date.now()

  // 停止JavaScript动画
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  isDragging.value = true
  dragStartX.value = touch.clientX
  dragCurrentX.value = touch.clientX

  // 移除CSS动画，改用transform控制
  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
    const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
    const matrix = computedStyle.transform
    if (matrix && matrix !== 'none') {
      const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
      if (matrixValues && matrixValues.length >= 4) {
        dragOffset.value = parseFloat(matrixValues[4]) || 0
        // 规范化位置到有效范围内
        const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
        if (items.length >= 16) {
          const firstItem = items[0] as HTMLElement
          const item16 = items[15] as HTMLElement
          // 直接测量第16个卡片相对于第1个卡片的位置差
          const originalWidth = item16.offsetLeft - firstItem.offsetLeft
          while (dragOffset.value <= -originalWidth) {
            dragOffset.value += originalWidth
          }
          while (dragOffset.value > 0) {
            dragOffset.value -= originalWidth
          }
        }
      }
    } else {
      dragOffset.value = 0
    }
  }

  document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false })
  document.addEventListener('touchend', handleDocumentTouchEnd)

  e.preventDefault()
  e.stopPropagation()
}

// 获取跑马灯的 gap 值和原始宽度
const getMarqueeMetrics = () => {
  if (!marqueeTrackRef.value) return { gap: 30, originalWidth: 0 }

  const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
  if (items.length < 16) return { gap: 30, originalWidth: 0 }

  const firstItem = items[0] as HTMLElement
  const item16 = items[15] as HTMLElement // 第16个卡片（索引15）
  // 动态获取实际的 gap 值
  const trackStyle = window.getComputedStyle(marqueeTrackRef.value)
  const gap = parseFloat(trackStyle.gap) || 30
  // 直接测量第16个卡片相对于第1个卡片的位置差，这是最精确的方法
  const originalWidth = item16.offsetLeft - firstItem.offsetLeft

  return { gap, originalWidth }
}

// 全局鼠标移动（绑定在document上）
let marqueeDragRafId: number | null = null
const handleDocumentMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !marqueeTrackRef.value || !isMouseDown) return

  dragCurrentX.value = e.clientX
  if (marqueeDragRafId !== null) return
  marqueeDragRafId = requestAnimationFrame(() => {
    marqueeDragRafId = null
    if (!isDragging.value || !marqueeTrackRef.value) return
    const deltaX = dragCurrentX.value - dragStartX.value
    const newPosition = dragOffset.value + deltaX

    // 记录当前帧速度（用于松手后惯性滑动）
    const now = Date.now()
    const dt = now - lastDragTime
    if (dt > 0) {
      dragVelocity = (dragCurrentX.value - lastDragX) / dt * 16
    }
    lastDragX = dragCurrentX.value
    lastDragTime = now

    // 计算原始列表宽度（15个卡片）
    const { originalWidth } = getMarqueeMetrics()
    if (originalWidth > 0) {
      // 实现无缝循环：当超出范围时无缝重置
      let finalPosition = newPosition
      while (finalPosition <= -originalWidth) {
        finalPosition += originalWidth
      }
      while (finalPosition > 0) {
        finalPosition -= originalWidth
      }

      marqueeTrackRef.value.style.transform = `translateX(${Math.round(finalPosition)}px)`
    }
  })

  e.preventDefault()
}

// 全局鼠标释放（绑定在document上）
const handleDocumentMouseUp = (e: MouseEvent) => {
  if (!isDragging.value) return

  isMouseDown = false
  isDragging.value = false

  // 取消可能挂起的 raf
  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }

  // 移除事件监听
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)

  // 有速度时启动惯性滑动，否则直接恢复自动滚动
  if (marqueeTrackRef.value) {
    if (Math.abs(dragVelocity) > 1) {
      startInertia()
    } else {
      startMarqueeAnimation()
    }
  }

  e.preventDefault()
}

// 全局触摸移动（移动端）
const handleDocumentTouchMove = (e: globalThis.TouchEvent) => {
  if (!isDragging.value || !marqueeTrackRef.value || !isTouchStart) return

  const touch = e.touches[0]
  dragCurrentX.value = touch.clientX
  if (marqueeDragRafId !== null) return
  marqueeDragRafId = requestAnimationFrame(() => {
    marqueeDragRafId = null
    if (!isDragging.value || !marqueeTrackRef.value) return
    const deltaX = dragCurrentX.value - dragStartX.value
    const newPosition = dragOffset.value + deltaX

    // 记录当前帧速度（用于松手后惯性滑动）
    const now = Date.now()
    const dt = now - lastDragTime
    if (dt > 0) {
      dragVelocity = (dragCurrentX.value - lastDragX) / dt * 16
    }
    lastDragX = dragCurrentX.value
    lastDragTime = now

    const { originalWidth } = getMarqueeMetrics()
    if (originalWidth > 0) {
      let finalPosition = newPosition
      while (finalPosition <= -originalWidth) {
        finalPosition += originalWidth
      }
      while (finalPosition > 0) {
        finalPosition -= originalWidth
      }

      marqueeTrackRef.value.style.transform = `translateX(${Math.round(finalPosition)}px)`
    }
  })

  e.preventDefault()
}

// 全局触摸结束（移动端）
const handleDocumentTouchEnd = (e: globalThis.TouchEvent) => {
  if (!isDragging.value) return

  isTouchStart = false
  isDragging.value = false

  // 取消可能挂起的 raf
  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }

  // 移除事件监听
  document.removeEventListener('touchmove', handleDocumentTouchMove)
  document.removeEventListener('touchend', handleDocumentTouchEnd)

  // 有速度时启动惯性滑动，否则直接恢复自动滚动
  if (marqueeTrackRef.value) {
    if (Math.abs(dragVelocity) > 1) {
      startInertia()
    } else {
      startMarqueeAnimation()
    }
  }

  e.preventDefault()
}

// 鼠标滚轮控制跑马灯：滚轮上下滚动时跑马灯左右移动，停下后顺势滑一段
// 灵敏度固定为 WHEEL_SENSITIVITY
let wheelRafId: number | null = null
let wheelDelta = 0
let wheelVelocity = 0
let wheelStopTimer: ReturnType<typeof setTimeout> | null = null
const handleMarqueeWheel = (e: WheelEvent) => {
  if (!marqueeTrackRef.value) return
  // 阻止页面默认滚动
  e.preventDefault()
  const sensitivity = WHEEL_SENSITIVITY
  // 累积滚轮增量和速度
  wheelDelta += e.deltaY
  wheelVelocity = -e.deltaY * sensitivity
  // 滚轮时取消惯性（正在滚轮，不需要惯性）
  if (inertiaId !== null) { cancelAnimationFrame(inertiaId); inertiaId = null }
  // 重置停止定时器：100ms 没有新滚轮事件就启动惯性
  if (wheelStopTimer) clearTimeout(wheelStopTimer)
  if (wheelRafId !== null) return
  wheelRafId = requestAnimationFrame(() => {
    wheelRafId = null
    if (!marqueeTrackRef.value) return
    // 停止自动滚动
    if (animationId !== null) { cancelAnimationFrame(animationId); animationId = null }

    const { originalWidth } = getMarqueeMetrics()
    if (originalWidth <= 0) { wheelDelta = 0; return }

    // 获取当前位置
    const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
    const matrix = computedStyle.transform
    let currentPosition = 0
    if (matrix && matrix !== 'none') {
      const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
      if (matrixValues && matrixValues.length >= 4) {
        currentPosition = parseFloat(matrixValues[4]) || 0
      }
    }
    // 滚轮向下（deltaY>0）跑马灯向左移，滚轮向上向右移
    currentPosition -= wheelDelta
    wheelDelta = 0
    // 无缝循环
    while (currentPosition <= -originalWidth) currentPosition += originalWidth
    while (currentPosition > 0) currentPosition -= originalWidth
    marqueeTrackRef.value.style.transform = `translateX(${Math.round(currentPosition)}px)`
    marqueeTrackRef.value.style.animation = 'none'

    // 滚轮停止 100ms 后启动惯性滑动
    wheelStopTimer = setTimeout(() => {
      wheelStopTimer = null
      if (Math.abs(wheelVelocity) > 1) {
        dragVelocity = wheelVelocity
        startInertia()
      } else {
        startMarqueeAnimation()
      }
    }, 100)
  })
}

// 惯性滑动：松手后按拖拽速度继续滑，逐渐减速到停
const startInertia = () => {
  if (!marqueeTrackRef.value) return
  const { originalWidth } = getMarqueeMetrics()
  if (originalWidth <= 0) { startMarqueeAnimation(); return }

  // 获取当前位置作为惯性起点
  const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
  const matrix = computedStyle.transform
  let currentPosition = 0
  if (matrix && matrix !== 'none') {
    const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
    if (matrixValues && matrixValues.length >= 4) {
      currentPosition = parseFloat(matrixValues[4]) || 0
    }
  }

  const friction = 0.92
  const minVelocity = 1

  const step = () => {
    if (!marqueeTrackRef.value) { inertiaId = null; return }
    if (Math.abs(dragVelocity) < minVelocity) {
      inertiaId = null
      startMarqueeAnimation()
      return
    }
    currentPosition += dragVelocity
    dragVelocity *= friction
    // 无缝循环
    while (currentPosition <= -originalWidth) currentPosition += originalWidth
    while (currentPosition > 0) currentPosition -= originalWidth
    marqueeTrackRef.value.style.transform = `translateX(${Math.round(currentPosition)}px)`
    inertiaId = requestAnimationFrame(step)
  }
  inertiaId = requestAnimationFrame(step)
}

// 启动跑马灯动画（JavaScript控制）
const startMarqueeAnimation = () => {
  if (!marqueeTrackRef.value || isDragging.value) return
  // 取消可能正在进行的惯性滑动
  if (inertiaId !== null) {
    cancelAnimationFrame(inertiaId)
    inertiaId = null
  }
  // reduceMotion 下不启动跑马灯动画,避免视觉回归测试截图不稳定
  if (reduceMotion) return

  // 停止之前的动画
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // 停止CSS动画，改用JavaScript控制
  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
  }

  // 等待DOM渲染完成后再计算
  nextTick(() => {
    trackTimer(setTimeout(() => {
      if (!marqueeTrackRef.value || isDragging.value) return

      // 获取当前位置
      const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
      const matrix = computedStyle.transform
      let currentPosition = 0
      if (matrix && matrix !== 'none') {
        const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
        if (matrixValues && matrixValues.length >= 4) {
          currentPosition = parseFloat(matrixValues[4]) || 0
        }
      }

      const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
      if (items.length === 0 || items.length < 30) {
        // 如果项目还没加载完，重试
        trackTimer(setTimeout(() => startMarqueeAnimation(), 100))
        return
      }

      const firstItem = items[0] as HTMLElement
      if (!firstItem || firstItem.offsetWidth === 0) {
        // 如果宽度还没计算出来，重试
        trackTimer(setTimeout(() => startMarqueeAnimation(), 100))
        return
      }

      const _itemWidth = firstItem.offsetWidth
      // 直接测量第16个卡片（复制的第1个）相对于第1个卡片的位置差
      // 这是最精确的方法，避免了任何计算误差
      const item16 = items[15] as HTMLElement // 第16个卡片（索引15）
      const originalWidth = item16.offsetLeft - firstItem.offsetLeft

      // 规范化当前位置到有效范围内 [-originalWidth, 0]
      // 确保位置在有效范围内，避免溢出
      // 注意：初始位置 0 是有效的，表示从第一个卡片开始
      while (currentPosition < -originalWidth) {
        currentPosition += originalWidth
      }
      while (currentPosition > 0) {
        currentPosition -= originalWidth
      }

      const speed = MARQUEE_SPEED

      const animate = () => {
        if (!marqueeTrackRef.value || isDragging.value) {
          animationId = null
          return
        }

        currentPosition -= speed

        // 无缝循环重置逻辑
        // 当 currentPosition <= -originalWidth 时，原始部分的15个卡片已经完全滚出视口
        // 此时复制部分的第一个卡片正好在原始部分第一个卡片的位置（因为内容完全相同）
        // 应该立即重置，让原始部分的第一个卡片显示，实现无缝循环
        if (currentPosition <= -originalWidth) {
          // 加上 originalWidth，让位置回到有效范围内，实现无缝循环
          currentPosition = currentPosition + originalWidth
        }

        // 使用 Math.round 确保像素值是整数，避免模糊
        marqueeTrackRef.value.style.transform = `translateX(${Math.round(currentPosition)}px)`
        animationId = requestAnimationFrame(animate)
      }

      animationId = requestAnimationFrame(animate)
    }, 100))
  })
}

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (animationId !== null) { cancelAnimationFrame(animationId); animationId = null } })
cleanup.add(() => { if (homeScrollRafId !== null) { cancelAnimationFrame(homeScrollRafId); homeScrollRafId = null } })
cleanup.add(() => { if (marqueeDragRafId !== null) { cancelAnimationFrame(marqueeDragRafId); marqueeDragRafId = null } })
cleanup.add(() => { if (inertiaId !== null) { cancelAnimationFrame(inertiaId); inertiaId = null } })
cleanup.add(() => { if (wheelRafId !== null) { cancelAnimationFrame(wheelRafId); wheelRafId = null } })
cleanup.add(() => { if (wheelStopTimer) { clearTimeout(wheelStopTimer); wheelStopTimer = null } })
cleanup.add(() => {
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
  document.removeEventListener('touchmove', handleDocumentTouchMove)
  document.removeEventListener('touchend', handleDocumentTouchEnd)
  document.removeEventListener('keydown', onMiniappKeydown)
})
cleanup.add(() => { if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null } })
cleanup.add(() => { pendingTimers.forEach(clearTimeout); pendingTimers.length = 0 })
cleanup.add(() => { document.body.style.overflow = '' })

const navigation = useHomeNavigation()
const { isNavigating } = navigation
const { trackHomePageView, trackHeroCTAClick, trackFeatureCardClick } = useHomeAnalytics()

const goToXuqiu = (event?: MouseEvent) => {
  trackFeatureCardClick('xuqiu')
  navigation.goToXuqiu(event)
}

const goToLearnAI = (event?: MouseEvent) => {
  trackHeroCTAClick('secondary')
  navigation.goToLearnAI(event)
}

const handleOpenChat = (event?: MouseEvent) => {
  trackHeroCTAClick('primary')
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }

  // 使用全局AIChat
  if (typeof window !== 'undefined') {
    const openFloatingChat = (window as typeof window & {
      openFloatingChat?: (options?: { initialText?: string; mode?: string }) => void
    }).openFloatingChat

    if (openFloatingChat) {
      openFloatingChat({
        initialText: '',
        mode: 'model', // 默认使用模型模式
      })
      return
    }

    // 备用方案：使用旧的openGlobalChat
    const openGlobalChat = (window as typeof window & { openGlobalChat?: () => void }).openGlobalChat
    if (openGlobalChat) {
      openGlobalChat()
    }
  }
}

const handleGetCredits = () => {
  // 处理获取积分的逻辑，跳转到VIP会员详情页面
  // PromotionModal 组件内部已经处理了路由跳转，这里可以添加额外的逻辑
  // 例如：统计点击事件、埋点等
}

// 获取跑马灯图片路径
const getMarqueeImageSrc = (index: number) => {
  if (index === 1) return kouziIcon
  if (index === 2) return bbxIcon
  if (index === 3) return openaiIcon
  if (index === 4) return brand6Icon
  if (index === 5) return brand7Icon
  if (index === 6) return brand8Icon
  if (index === 7) return brand9Icon
  if (index === 8) return brand10Icon
  if (index === 9) return brand11Icon
  if (index === 10) return brand12Icon
  if (index === 11) return brand13Icon
  if (index === 12) return brand14Icon
  if (index === 13) return brand15Icon
  if (index === 14) return brand16Icon
  if (index === 15) return n8nIcon
  return '/images/logo.svg'
}

// 获取跑马灯图片alt文本
const getMarqueeImageAlt = (index: number) => {
  if (index === 1) return t('home.marquee.kouzi')
  if (index === 2) return t('home.marquee.bbxLogo')
  if (index === 3) return t('home.marquee.openai')
  if (index === 4) return t('home.marquee.zhipu')
  if (index === 5) return t('home.marquee.gork')
  if (index === 6) return t('home.marquee.brand8')
  if (index === 7) return t('home.marquee.ali')
  if (index === 8) return t('home.marquee.tencent')
  if (index === 9) return t('home.marquee.huawei')
  if (index === 10) return t('home.marquee.baidu')
  if (index === 11) return t('home.marquee.yuanbaoxiang')
  if (index === 12) return t('home.marquee.yushu')
  if (index === 13) return t('home.marquee.dbsfdx')
  if (index === 14) return t('home.marquee.jldx')
  if (index === 15) return t('home.marquee.n8n')
  return `Brand ${index}`
}

// 图片加载错误处理
const handleImageError = (event: Event, index: number) => {
  const img = event.target as HTMLImageElement
  const imgNames: Record<number, string> = {
    1: '扣子图标',
    2: '百宝箱logo',
    3: '品牌图标',
    4: 'OpenAI',
    5: '智谱清言',
    6: 'Gork',
    7: '品牌8',
    8: 'Ali',
    9: 'TX',
    10: 'HW',
    11: 'BD',
    12: 'YBX',
    13: 'Yushu',
    14: 'DBSFDX',
    15: 'JLDX'
  }
  logger.error(`图片加载失败 (index: ${index}, ${imgNames[index] || '未知'}):`, { src: img.src })
  // 如果自定义图标加载失败，fallback到logo（防止 logo 也失败时无限循环）
  if (index >= 1 && index <= 15 && !img.dataset.fallbackApplied) {
    logger.warn(`${imgNames[index] || '未知'}加载失败，使用默认logo`)
    img.dataset.fallbackApplied = 'true'
    img.src = '/images/logo.svg'
  }
}

// 图片加载成功处理
const handleImageLoad = (event: Event, index: number) => {
  const imgNames: Record<number, string> = {
    1: '扣子图标',
    2: '百宝箱logo',
    3: '品牌图标',
    4: 'OpenAI',
    5: '智谱清言',
    6: 'Gork',
    7: '品牌8',
    8: 'Ali',
    9: 'TX',
    10: 'HW',
    11: 'BD',
    12: 'YBX',
    13: 'Yushu',
    14: 'DBSFDX',
    15: 'JLDX'
  }
  if (imgNames[index]) {
    logger.debug(`${imgNames[index]}加载成功:`, { src: (event.target as HTMLImageElement).src })
  }
}
</script>

<style scoped lang="scss">
.miniapp-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-black-50);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-notification);
}

.miniapp-modal {
  background: var(--color-white);
  border-radius: var(--global-border-radius);
  width: 320px;
  overflow: hidden;
}

.miniapp-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);
  
  span {
    font-size: 18px;
    font-weight: 600;
  }
}

.miniapp-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-gray-999);
  
  &:hover {
    color: var(--color-gray-333);
  }
}

.miniapp-modal-body {
  padding: 30px 20px;
  text-align: center;
}

.miniapp-qr-code {
  width: 200px;
  height: 200px;
  margin-bottom: 16px;
}

.miniapp-scan-tip {
  font-size: 14px;
  color: var(--color-gray-666);
}
</style>

<style lang="scss">
@use './Home.vue.styles';
</style>
