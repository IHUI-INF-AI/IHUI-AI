<template>
  <Teleport to="body">
    <Transition name="promotion-modal">
      <div v-if="visible" class="promotion-modal-overlay" @click="handleOverlayClick">
        <div class="promotion-modal-card" @click.stop>
          <!-- 关闭按钮 -->
          <button class="promotion-close-btn" @click="handleClose" :aria-label="t('home.promotionModal.close')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Logo图标 -->
          <img src="@/assets/icons/common/promotion-logo.svg" alt="Promotion Logo" class="promotion-logo-icon" />

          <!-- 标题 -->
          <h2 class="promotion-title">{{ t('home.promotionModal.title') }}</h2>

          <!-- 说明文字 -->
          <p class="promotion-subtitle">{{ t('home.promotionModal.subtitle') }}</p>

          <!-- 积分奖励列表 -->
          <div class="promotion-credits-list">
            <div class="promotion-credit-item">
              <i18n-t keypath="home.promotionModal.credits.starter" scope="global">
                <template #total>
                  <strong>4,000</strong>
                </template>
                <template #extra>
                  <strong class="extra-credit">2,000</strong>
                </template>
              </i18n-t>
            </div>
            <div class="promotion-credit-item">
              <i18n-t keypath="home.promotionModal.credits.basic" scope="global">
                <template #total>
                  <strong>7,000</strong>
                </template>
                <template #extra>
                  <strong class="extra-credit">3,500</strong>
                </template>
              </i18n-t>
            </div>
            <div class="promotion-credit-item">
              <i18n-t keypath="home.promotionModal.credits.pro" scope="global">
                <template #total>
                  <strong>22,000</strong>
                </template>
                <template #extra>
                  <strong class="extra-credit">11,000</strong>
                </template>
              </i18n-t>
            </div>
          </div>

          <!-- 额外提示 -->
          <p class="promotion-hint">
            <i18n-t keypath="home.promotionModal.hint" scope="global">
              <template #highlight>
                <strong>{{ t('home.promotionModal.doublePoints') }}</strong>
              </template>
            </i18n-t>
          </p>

          <!-- 操作按钮 -->
          <div class="promotion-actions">
            <button class="promotion-primary-btn" @click="handleGetCredits">
              {{ t('home.promotionModal.primaryButton') }}
            </button>
            <button class="promotion-secondary-link" @click="handleDismiss">
              {{ t('home.promotionModal.secondaryLink') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

interface RouteWithName {
  name?: string
}

const props = defineProps<{
  modelValue?: boolean
}>()

const emits = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
  'get-credits': []
}>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const cleanup = useCleanup()
const visible = ref(false)
const showModalTimer = ref<NodeJS.Timeout | null>(null)

// 会话级标记：当前会话是否已经显示过弹窗（用于首次访问判断）
const SESSION_SHOWN_KEY = 'promotion-modal-session-shown'

// 检查是否为主页面
const isHomePage = () => {
  if (!route) return false
  const routeName = (route as RouteWithName)?.name
  return routeName === 'home' || route?.path === '/' || route?.path === '/home'
}

// 检查当前会话是否已经显示过弹窗
const hasShownInCurrentSession = () => {
  if (typeof window === 'undefined') return true
  return sessionStorage.getItem(SESSION_SHOWN_KEY) === 'true'
}

// 标记当前会话已经显示过弹窗
const markSessionShown = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_SHOWN_KEY, 'true')
  }
}

// 检查是否在24小时内已经点击过（使用localStorage存储时间戳）
const hasShownBefore = () => {
  if (typeof window === 'undefined') return true

  // 首先检查当前会话是否已经显示过（优先级最高）
  // 这样登录成功回调到首页时不会再次弹窗
  if (hasShownInCurrentSession()) {
    return true
  }

  // 开发模式下，可以通过 URL 参数控制
  if (import.meta.env.DEV) {
    const urlParams = new URLSearchParams(window.location.search)
    // 如果 URL 参数明确设置为 true，则强制显示（用于测试）
    if (urlParams.get('forcePromotion') === 'true') {
      return false
    }
    // 如果 URL 参数明确设置为 false，则不显示
    if (urlParams.get('forcePromotion') === 'false') {
      return true
    }
  }

  const dismissedTimeStr = localStorage.getItem('promotion-modal-dismissed-time')
  if (!dismissedTimeStr) {
    return false
  }

  try {
    const dismissedTime = parseInt(dismissedTimeStr, 10)
    const now = Date.now()
    const oneDayInMs = 24 * 60 * 60 * 1000 // 24小时的毫秒数

    // 如果距离上次点击时间小于24小时，则不显示
    return (now - dismissedTime) < oneDayInMs
  } catch (error) {
    // 如果解析失败，清除无效数据
    if (import.meta.env.DEV) {
      logger.debug('Failed to parse promotion modal dismiss time, clearing invalid data:', error)
    }
    localStorage.removeItem('promotion-modal-dismissed-time')
    return false
  }
}

// 标记为已点击（记录当前时间戳）
const markAsShown = () => {
  if (typeof window !== 'undefined') {
    const now = Date.now()
    localStorage.setItem('promotion-modal-dismissed-time', now.toString())
  }
}

// 显示弹窗的统一方法
const showModalIfNeeded = () => {
  const shouldShow = isHomePage() && !hasShownBefore() && !visible.value

  if (shouldShow) {
    // 清除可能存在的定时器
    if (showModalTimer.value) {
      clearTimeout(showModalTimer.value)
    }

    // 等待页面就绪后再显示弹窗，避免遮挡首屏内容
    let retryCount = 0
    const MAX_RETRY = 6
    const showWhenReady = () => {
      // 检查页面是否就绪：首屏 CTA 按钮已渲染且可见
      const heroCta = document.querySelector('.hero-cta-btn')
      const isReady = heroCta && heroCta.getBoundingClientRect().height > 0
      if (isReady) {
        visible.value = true
        markSessionShown()
        if (import.meta.env.DEV) {
          logger.debug('[PromotionModal] Showing modal after page ready', {
            isHomePage: isHomePage(),
            routeName: (route as RouteWithName)?.name,
            routePath: route?.path
          })
        }
      } else if (retryCount < MAX_RETRY) {
        // 页面未就绪，500ms 后重试，最多重试 6 次（共 3 秒）
        retryCount++
        showModalTimer.value = setTimeout(showWhenReady, 500)
      }
    }

    // 首次延迟 1000ms 后开始检测页面就绪
    showModalTimer.value = setTimeout(showWhenReady, 1000)
  } else if (!isHomePage()) {
    visible.value = false
  } else {
    // 在开发模式下，记录为什么不显示
    if (import.meta.env.DEV) {
      logger.debug('[PromotionModal] Not showing modal', {
        isHomePage: isHomePage(),
        hasShownBefore: hasShownBefore(),
        hasShownInCurrentSession: hasShownInCurrentSession(),
        visible: visible.value,
        routeName: (route as RouteWithName)?.name,
        routePath: route?.path
      })
    }
  }
}

// 初始化显示逻辑
const initModal = () => {
  showModalIfNeeded()

  // 延迟检查是否显示，因为 showModalIfNeeded 是异步的
  setTimeout(() => {
  }, 100)
}

// 监听路由变化（包括路由名称和路径）
watch([() => (route as RouteWithName)?.name, () => route?.path], ([_newName, _newPath]) => {
  showModalIfNeeded()
}, { immediate: true })

// 监听 modelValue 变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== undefined) {
    visible.value = newVal
  }
})

watch(visible, (newVal) => {
  emits('update:modelValue', newVal)
  if (!newVal) {
    emits('close')
  }
  // ESC 键监听 + 背景滚动锁定
  if (newVal) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && visible.value) {
    handleClose()
  }
}

const handleClose = () => {
  visible.value = false
  markSessionShown()
  markAsShown()
}

const handleOverlayClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

const handleGetCredits = () => {
  emits('get-credits')
  // 记录点击时间，然后关闭
  markAsShown()
  handleClose()
  // 跳转到VIP会员详情页面（选择套餐页面）
  if (!router) return
  router.push('/vip/details').catch((error: any) => {
    // 忽略导航重复错误
    if (error instanceof Error && error.name !== 'NavigationDuplicated' && error.name !== 'NavigationRedirected') {
      logger.error('[PromotionModal] Failed to navigate to VIP page:', error)
    }
  })
}

const handleDismiss = () => {
  // 记录点击时间，然后关闭
  markAsShown()
  handleClose()
}

onMounted(() => {
  nextTick(() => {
    // 立即尝试初始化
    initModal()

    // 如果路由信息还没准备好，延迟重试
    const tryInit = (attempt = 1) => {
      if (isHomePage()) {
        initModal()
      } else if (attempt < 5) {
        setTimeout(() => tryInit(attempt + 1), 200)
      } else {
        // 最后一次尝试
        if (route?.path === '/' || route?.path === '/home') {
          initModal()
        }
      }
    }

    // 如果第一次初始化失败，延迟重试
    setTimeout(() => {
      if (!visible.value && isHomePage()) {
        tryInit()
      }
    }, 500)
  })
})

// 组件卸载时清理定时器和事件监听
cleanup.add(() => {
  if (showModalTimer.value) {
    clearTimeout(showModalTimer.value)
  }
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped lang="scss">
.promotion-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-notification);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-black-50);
  backdrop-filter: blur(4px);
  padding: 20px;

  // 深色模式
  html.dark & {
    background: var(--color-black-70);
  }
}

.promotion-modal-card {
  position: relative;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 40px 32px 32px;
  max-width: 480px;
  width: 100%;
  border: var(--unified-border);
  text-align: center;

  // 深色模式
  html.dark & {
    background: var(--el-bg-color);
    border-color: var(--color-white-10);
  }
}

/* 关闭按钮：严格正方形（长宽一致），透明背景 */
.promotion-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  aspect-ratio: 1;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, color 0.2s ease;
  color: var(--el-text-color-regular);

  &:hover {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    transform: rotate(90deg);
  }

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  &:hover svg {
    transform: rotate(-90deg);
  }

  html.dark & {
    background: transparent;
    color: var(--el-text-color-secondary);

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-regular);
    }
  }
}

/* 移动端：强制 44×44 正方形 */
@media (width <= 767px) {
  .promotion-close-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
}

.promotion-logo-icon {
  width: 80px;
  height: 80px;
  object-fit: contain;
  display: block;
  margin: 0 auto 20px;
}

.promotion-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 12px;
  letter-spacing: -0.5px;

  // 深色模式
  html.dark & {
    color: var(--el-text-color-regular);
  }
}

.promotion-subtitle {
  font-size: 16px;
  color: var(--el-text-color-primary);
  margin: 0 0 24px;
  line-height: 1.5;

  // 深色模式
  html.dark & {
    color: var(--el-text-color-secondary);
  }
}

.promotion-credits-list {
  margin: 24px 0;
  text-align: left;
}

.promotion-credit-item {
  font-size: 15px;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  line-height: 1.6;

  strong {
    font-weight: 700;
    color: var(--el-text-color-primary);

    &.extra-credit {
      color: var(--el-color-success);
    }
  }

  &:last-child {
    margin-bottom: 0;
  }

  // 深色模式
  html.dark & {
    color: var(--el-text-color-secondary);

    strong {
      color: var(--el-text-color-regular);

      &.extra-credit {
        color: var(--el-color-success-light-3);
      }
    }
  }
}

.promotion-hint {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 20px 0 28px;
  line-height: 1.5;

  strong {
    font-weight: 700;
    color: var(--el-text-color-primary);
  }

  // 深色模式
  html.dark & {
    color: var(--el-text-color-secondary);

    strong {
      color: var(--el-text-color-regular);
    }
  }
}

.promotion-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.promotion-primary-btn {
  width: 100%;
  padding: 14px 24px;
  background: var(--el-color-primary);
  color: var(--el-bg-color-page);
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: var(--el-color-primary-light-3);
    color: var(--el-bg-color-page);
    transform: translateY(-2px);
  }

  &:active {
    background: var(--el-color-primary-light-5);
    transform: translateY(0);
  }

  // 深色模式：白底黑字
  html.dark & {
    background: var(--el-color-primary);
    color: var(--el-bg-color-page);

    &:hover {
      background: var(--el-color-primary-light-3);
      color: var(--el-bg-color-page);
    }

    &:active {
      background: var(--el-color-primary-light-5);
      color: var(--el-bg-color-page);
    }
  }
}

.promotion-secondary-link {
  background: none;
  border: none;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  cursor: pointer;
  padding: 8px;
  transition: color 0.2s ease;

  &:hover {
    color: var(--el-text-color-placeholder);
  }

  // 深色模式
  html.dark & {
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-text-color-primary);
    }

    &:active {
      color: var(--el-text-color-secondary);
    }
  }
}

// 过渡动画 - 覆盖层淡入淡出
.promotion-modal-enter-active,
.promotion-modal-leave-active {
  transition: opacity 0.3s ease;
}

.promotion-modal-enter-from,
.promotion-modal-leave-to {
  opacity: 0;
}

// 卡片淡入+轻微上移
.promotion-modal-enter-active .promotion-modal-card {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.promotion-modal-leave-active .promotion-modal-card {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.promotion-modal-enter-from .promotion-modal-card,
.promotion-modal-leave-to .promotion-modal-card {
  opacity: 0;
  transform: translateY(12px);
}

// 响应式设计
@media (width <= 640px) {
  .promotion-modal-card {
    padding: 32px 24px 24px;
    max-width: 100%;
    margin: 0 16px;
  }

  .promotion-title {
    font-size: 24px;
  }

  .promotion-subtitle {
    font-size: 15px;
  }

  .promotion-credit-item {
    font-size: 14px;
  }
}
</style>