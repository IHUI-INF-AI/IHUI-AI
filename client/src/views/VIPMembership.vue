<template>
  <div class="vip-page">
    <!-- 深度背景系统 -->
    <div class="vip-page__background">
      <div class="vip-page__glow vip-page__glow--top"></div>
      <div class="vip-page__glow vip-page__glow--bottom"></div>
    </div>

    <!-- 主内容区 -->
    <div class="vip-page__content">
      <!-- 头部卡片 -->
      <div class="vip-header" :class="{ 'is-visible': headerVisible }">
        <div class="vip-header__glasscard">
          <div class="vip-header__badge">
            <span class="vip-header__badge-text font-edix">VIP</span>
            <div class="vip-header__badge-glow"></div>
          </div>
          <h1 class="vip-header__title">{{ t('vip.title') }}</h1>
          <p class="vip-header__subtitle">{{ t('vip.subtitle', { amount: dataInfo.amount }) }}</p>
          <div class="vip-header__price-display">
            <span class="vip-header__currency"></span>
            <span class="vip-header__amount" ref="priceRef">{{ animatedPrice }}</span>
          </div>
          <div class="vip-header__decoration">
            <div class="vip-header__line vip-header__line--left"></div>
            <div class="vip-header__diamond"></div>
            <div class="vip-header__line vip-header__line--right"></div>
          </div>
        </div>
      </div>

      <!-- 功能特性区 -->
      <div class="vip-features" :class="{ 'is-visible': featuresVisible }">
        <div class="vip-features__header">
          <div class="vip-features__title-wrapper">
            <span class="vip-features__icon">✨</span>
            <h2 class="vip-features__title">{{ t('vip.featuresTitle') }}</h2>
          </div>
          <div class="vip-features__line"></div>
        </div>

        <div class="vip-features__grid">
          <div v-for="(feature, index) in features" :key="feature.id" class="vip-feature-card"
            @click="handleRipple($event)">
            <div class="vip-feature-card__content">
              <div class="vip-feature-card__icon-wrapper">
                <span class="vip-feature-card__icon">{{ feature.icon }}</span>
              </div>
              <div class="vip-feature-card__info">
                <h3 class="vip-feature-card__title">{{ t(`vip.features.${feature.id}.title`) }}</h3>
                <p class="vip-feature-card__desc">{{ t(`vip.features.${feature.id}.desc`) }}</p>
              </div>
              <div class="vip-feature-card__tag">
                <span>VIP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计数据?-->
      <div class="vip-stats" :class="{ 'is-visible': statsVisible }">
        <div class="vip-stat" v-for="stat in stats" :key="stat.id">
          <div class="vip-stat__value">
            <span class="vip-stat__number">{{ stat.animatedValue }}</span>
            <span class="vip-stat__suffix">{{ stat.suffix }}</span>
          </div>
          <div class="vip-stat__label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <!-- 底部购买?-->
    <div class="vip-purchase-bar">
      <div class="vip-purchase-bar__bg"></div>
      <div class="vip-purchase-bar__content">
        <div class="vip-purchase-bar__price">
          <span class="vip-purchase-bar__label">{{ t('vip.payment.total') }}</span>
          <div class="vip-purchase-bar__amount">
            <span class="vip-purchase-bar__currency"></span>
            <span class="vip-purchase-bar__number">{{ animatedPrice }}</span>
          </div>
        </div>
        <button class="vip-purchase-bar__btn" @click="handleRipple($event); openPopup()">
          <span class="vip-purchase-bar__btn-text">{{ t('vip.buyButton') }}</span>
          <span class="vip-purchase-bar__btn-icon">→</span>
          <div class="vip-purchase-bar__btn-shine"></div>
        </button>
      </div>
    </div>

    <!-- 购买弹窗 -->
    <el-dialog v-model="showPopup" :title="t('vip.purchaseTitle')" width="500px" class="vip-dialog"
      :modal-class="'vip-dialog-overlay'">
      <div class="vip-popup">
        <div class="vip-popup__price-section">
          <div class="vip-popup__price-glow"></div>
          <div class="vip-popup__price">
            <span class="vip-popup__currency">¥</span>
            <span class="vip-popup__amount">{{ dataInfo.amount }}</span>
          </div>
          <p class="vip-popup__desc">{{ t('vip.purchaseDesc') }}</p>
        </div>
        <div class="vip-popup__features">
          <div v-for="feature in vipFeatures" :key="feature.id" class="vip-popup__feature">
            <div class="vip-popup__check">
              <el-icon>
                <Check />
              </el-icon>
            </div>
            <span class="vip-popup__feature-text">{{ feature.name }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="vip-popup__footer">
          <button class="vip-popup__btn vip-popup__btn--cancel" @click="showPopup = false">
            {{ t('common.cancel') }}
          </button>
          <button class="vip-popup__btn vip-popup__btn--confirm" @click="handlePayment" :disabled="paymentLoading">
            <span v-if="paymentLoading" class="vip-popup__loading"></span>
            <span v-else>{{ t('vip.confirmPayment') }}</span>
          </button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { logger } from '@/utils/logger'
import { getVipProducts, purchaseVip } from '@/api/user'
import { useVipAnalytics } from '@/composables/useAnalytics'
import { useCleanup } from '@/composables/useCleanup'

const cleanup = useCleanup()

const { t } = useI18n()
const authStore = useAuthStore() as ReturnType<typeof useAuthStore> & {
  fetchUserInfo: () => Promise<unknown>
}
const { trackVipPageView, trackVipPlanClick, trackVipPurchaseClick, trackVipPurchaseSuccess } = useVipAnalytics()

// VIP产品接口
interface VipProduct {
  id: string | number
  price: number
  name?: string
  [key: string]: unknown
}

const showPopup = ref(false)
const paymentLoading = ref(false)
const dataInfo = ref({ amount: 0 })
const selectedVipProduct = ref<VipProduct | null>(null)

// ============ 动画状?============
const headerVisible = ref(true)
const featuresVisible = ref(true)
const statsVisible = ref(true)
const featureCardsVisible = reactive([true, true, true, true])
const animatedPrice = ref(0)
const priceRef = ref<HTMLElement | null>(null)

// 统计数据
const stats = reactive([
  { id: 'users', value: 10000, animatedValue: 0, suffix: '+', label: t('vip.stats.activeUsers') },
  { id: 'features', value: 50, animatedValue: 0, suffix: '+', label: t('vip.stats.aiFeatures') },
  { id: 'satisfaction', value: 99, animatedValue: 0, suffix: '%', label: t('vip.stats.satisfaction') },
])

const features = [
  {
    id: 'ai_copywriting',
    icon: '✍️',
  },
  {
    id: 'ai_chat',
    icon: '💬',
  },
  {
    id: 'ai_analysis',
    icon: '📊',
  },
  {
    id: 'ai_design',
    icon: '🎨',
  },
]

const vipFeatures = ref([
  { id: 1, name: t('vip.features.ai_copywriting.title') },
  { id: 2, name: t('vip.features.ai_chat.title') },
  { id: 3, name: t('vip.features.ai_analysis.title') },
  { id: 4, name: t('vip.features.ai_design.title') },
])

// ============ 数字计数动画 ============
const animateRafIds = new Set<number>()

cleanup.add(() => {
  animateRafIds.forEach((id) => cancelAnimationFrame(id))
  animateRafIds.clear()
})

function animateNumber(
  start: number,
  end: number,
  duration: number,
  callback: (value: number) => void
) {
  const startTime = performance.now()
  const diff = end - start

  function update(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    // 缓动函数 - easeOutExpo
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
    const currentValue = Math.round(start + diff * easeProgress)
    callback(currentValue)

    if (progress < 1) {
      animateRafIds.delete(rafId)
      rafId = requestAnimationFrame(update)
      animateRafIds.add(rafId)
    } else {
      animateRafIds.delete(rafId)
    }
  }

  let rafId = requestAnimationFrame(update)
  animateRafIds.add(rafId)
}

// 监听价格变化，触发动?
watch(() => dataInfo.value.amount, (newVal) => {
  animateNumber(0, newVal, 1500, (val) => {
    animatedPrice.value = val
  })
})

// ============ 滚动动画观察?============
let observer: IntersectionObserver | null = null

cleanup.add(() => {
  observer?.disconnect()
  observer = null
})

function setupScrollAnimations() {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement
          if (target.classList.contains('vip-header')) {
            headerVisible.value = true
          } else if (target.classList.contains('vip-features')) {
            featuresVisible.value = true
            // 依次显示特性卡?
            features.forEach((_, index) => {
              cleanup.addTimer(() => {
                featureCardsVisible[index] = true
              }, index * 150)
            })
          } else if (target.classList.contains('vip-stats')) {
            statsVisible.value = true
            // 启动统计数字动画
            stats.forEach((stat) => {
              animateNumber(0, stat.value, 2000, (val) => {
                stat.animatedValue = val
              })
            })
          }
        }
      })
    },
    { threshold: 0.2 }
  )
}

// ============ 涟漪点击效果 ============
function handleRipple(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const ripple = document.createElement('span')
  ripple.className = 'ripple-effect'
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`

  target.appendChild(ripple)

  cleanup.addTimer(() => {
    ripple.remove()
  }, 600)
}

onMounted(() => {
  trackVipPageView()
  fetchVipProducts()

  // 设置滚动动画
  setupScrollAnimations()

  // 延迟后开始观察元素并触发初始动画
  cleanup.addTimer(() => {
    const header = document.querySelector('.vip-header')
    const featuresEl = document.querySelector('.vip-features')
    const statsEl = document.querySelector('.vip-stats')

    if (header && observer) observer.observe(header)
    if (featuresEl && observer) observer.observe(featuresEl)
    if (statsEl && observer) observer.observe(statsEl)

    // 初始触发所有动画（页面首次加载时元素已在视口内?
    headerVisible.value = true

    // 延迟触发功能区动?
    cleanup.addTimer(() => {
      featuresVisible.value = true
      // 依次显示特性卡?
      features.forEach((_, index) => {
        cleanup.addTimer(() => {
          featureCardsVisible[index] = true
        }, index * 150)
      })
    }, 300)

    // 延迟触发统计区动?
    cleanup.addTimer(() => {
      statsVisible.value = true
      // 启动统计数字动画
      stats.forEach((stat) => {
        animateNumber(0, stat.value, 2000, (val) => {
          stat.animatedValue = val
        })
      })
    }, 600)
  }, 100)
})

const fetchVipProducts = async () => {
  try {
    const response = await getVipProducts()
    if (response.code === 200 && response.data && response.data.length > 0) {
      const products = response.data as VipProduct[]
      selectedVipProduct.value = products[0]
      dataInfo.value = { amount: products[0].price || 0 }
    }
  } catch (error) {
    logger.error(t('vip.payment.fetchVipPriceFailed'), error)
  }
}

const openPopup = () => {
  if (selectedVipProduct.value) {
    trackVipPlanClick(String(selectedVipProduct.value.id))
  }
  showPopup.value = true
}

const handlePayment = async () => {
  if (!selectedVipProduct.value) {
    ElMessage.error(t('vip.payment.selectProduct'))
    return
  }

  trackVipPurchaseClick(String(selectedVipProduct.value.id), selectedVipProduct.value.price)
  paymentLoading.value = true
  try {
    const response = await purchaseVip({
      vipLevelId: String(selectedVipProduct.value.id),
      paymentMethod: 'wechat',
    })

    if (response.code === 200 && response.data) {
      const { orderId: _orderId, paymentUrl } = response.data as { orderId: string; paymentUrl?: string }

      if (paymentUrl) {
        window.open(paymentUrl, '_blank')
      }

      trackVipPurchaseSuccess(String(selectedVipProduct.value.id), selectedVipProduct.value.price)
      ElMessage.success(t('vip.purchaseSuccess'))
      showPopup.value = false
      await authStore.fetchUserInfo()
    } else {
      ElMessage.error(response.message || t('vip.purchaseFailed'))
    }
  } catch (error) {
    logger.error(t('vip.payment.purchaseVipFailed'), error)
    ElMessage.error(t('vip.purchaseFailed'))
  } finally {
    paymentLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
// ============ 设计令牌 ============
$brand-primary: var(--el-text-color-primary);
$brand-accent: var(--el-bg-color);
$brand-glow: var(--color-white-15);
$brand-highlight: var(--el-text-color-primary);
$gray-900: var(--color-dark-bg-1);
$gray-800: var(--color-dark-bg-2);
$gray-700: var(--color-gray-1f1f1f);
$gray-600: var(--color-dark-bg-6);
$gray-500: var(--color-gray-3a3a3a);
$gray-400: var(--color-gray-666);
$gray-300: var(--color-gray-888888);
$gray-200: var(--color-gray-a1a1a1);
$gray-100: var(--color-gray-ededed);
$glass-bg: var(--color-white-3);
$glass-border: var(--border-unified-color);
$glass-hover: var(--color-white-6);
$transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);

@keyframes ripple-animation {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

// ============ 主容?============
.vip-page {
  position: relative;
  min-height: 100vh;
  background: $gray-900;
  overflow-x: hidden;
  padding-bottom: 100px;

  // ============ 深度背景系统 ============
  &__background {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: var(--z-0);
  }

  &__glow {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(120px);
    opacity: 0.4;

    &--top {
      top: -200px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 400px;
      background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    }

    &--bottom {
      bottom: -100px;
      right: -100px;
      width: 400px;
      height: 400px;
      background: var(--color-violet-8b5cf6-10);
    }
  }

  &__content {
    position: relative;
    z-index: var(--z-base);
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 20px;
  }
}

// ============ 头部区域 ============
.vip-header {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity $transition-slow, transform $transition-slow;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  &__glasscard {
    position: relative;
    background: $glass-bg;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 48px 32px;
    text-align: center;
    backdrop-filter: blur(20px);
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--color-white-10);
    }
  }

  &__badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 24px;
    margin-bottom: 20px;
    background: $gray-700;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    overflow: hidden;

    &-text {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: $gray-100;
    }

    &-glow {
      position: absolute;
      inset: 0;
      background: var(--color-white-5);
      animation: badge-shine 3s ease-in-out infinite;
    }
  }

  &__title {
    font-size: 36px;
    font-weight: 800;
    color: $gray-100;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }

  &__subtitle {
    font-size: 16px;
    color: $gray-300;
    margin-bottom: 32px;
    letter-spacing: 0.01em;
  }

  &__price-display {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
    margin-bottom: 32px;
  }

  &__currency {
    font-size: 28px;
    font-weight: 600;
    color: $gray-200;
  }

  &__amount {
    font-size: 64px;
    font-weight: 800;
    color: $gray-100;
    font-family: var(--font-family-mono);
    letter-spacing: -0.02em;
  }

  &__decoration {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  &__line {
    width: 60px;
    height: 1px;
    background: $gray-500;

    &--right {
      background: $gray-500;
    }
  }

  &__diamond {
    width: 8px;
    height: 8px;
    background: $gray-500;
    transform: rotate(45deg);
  }
}

// ============ 功能特性区 ============
.vip-features {
  margin-top: 40px;
  opacity: 0;
  transform: translateY(30px);
  transition: opacity $transition-slow, transform $transition-slow;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  &__header {
    margin-bottom: 24px;
  }

  &__title-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__icon {
    font-size: 24px;
  }

  &__title {
    font-size: 22px;
    font-weight: 700;
    color: $gray-100;
    letter-spacing: -0.01em;
  }

  &__line {
    height: 1px;
    background: $gray-600;
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

// ============ 功能卡片 ============
.vip-feature-card {
  position: relative;
  background: var(--color-dark-1e1e1e-90);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: var(--color-dark-282828-95);
    border-color: var(--border-unified-color-hover);
    transform: translateY(-2px);
  }

  &__content {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
  }

  &__icon-wrapper {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-white-5);
    border-radius: var(--global-border-radius);
    flex-shrink: 0;
  }

  &__icon {
    font-size: 28px;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 4px;
  }

  &__desc {
    font-size: 13px;
    color: var(--color-gray-999);
    line-height: 1.4;
    margin: 0;
  }

  &__tag {
    flex-shrink: 0;
    padding: 4px 12px;
    background: var(--color-dark-bg-6);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);

    span {
      font-size: 11px;
      font-weight: 700;
      color: var(--app-button-text-on-primary);
      letter-spacing: 0.05em;
    }
  }

}

// ============ 统计数据?============
.vip-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 40px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity $transition-slow, transform $transition-slow;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
}

.vip-stat {
  text-align: center;
  padding: 24px 16px;
  background: $glass-bg;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  &__value {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 2px;
    margin-bottom: 8px;
  }

  &__number {
    font-size: 32px;
    font-weight: 800;
    color: $gray-100;
    font-family: var(--font-family-mono);
  }

  &__suffix {
    font-size: 18px;
    font-weight: 600;
    color: $gray-300;
  }

  &__label {
    font-size: 13px;
    color: $gray-400;
    letter-spacing: 0.02em;
  }
}

// ============ 底部购买?============
.vip-purchase-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-header);
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));

  &__bg {
    position: absolute;
    inset: 0;
    background: var(--color-dark-0a0a0a-90);
    backdrop-filter: blur(20px);
    border-top: var(--unified-border);
  }

  &__content {
    position: relative;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  &__price {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__label {
    font-size: 12px;
    color: $gray-400;
    letter-spacing: 0.02em;
  }

  &__amount {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  &__currency {
    font-size: 18px;
    font-weight: 600;
    color: $gray-200;
  }

  &__number {
    font-size: 32px;
    font-weight: 800;
    color: $gray-100;
    font-family: var(--font-family-mono);
  }

  &__btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 32px;
    background: $gray-100;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    overflow: hidden;
    transition: transform $transition-fast, border-color $transition-fast;
    border: var(--unified-border);

    &:hover {
      transform: translateY(-2px);
      border-color: var(--border-unified-color-hover);
    }

    &:active {
      transform: translateY(0);
    }

    &-text {
      font-size: 16px;
      font-weight: 700;
      color: $gray-900;
      letter-spacing: -0.01em;
    }

    &-icon {
      font-size: 18px;
      color: $gray-900;
      transition: transform $transition-fast;
    }

    &:hover &-icon {
      transform: translateX(4px);
    }

    &-shine {
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: var(--color-white-20);
      animation: btn-shine 2s ease-in-out infinite;
    }
  }
}

// ============ 弹窗样式 ============
.vip-popup {
  &__price-section {
    position: relative;
    text-align: center;
    padding: 32px 0;
    margin-bottom: 24px;
    background: $glass-bg;
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }

  &__price-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 200px;
    background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
  }

  &__price {
    position: relative;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
    margin-bottom: 8px;
  }

  &__currency {
    font-size: 24px;
    font-weight: 600;
    color: $gray-300;
  }

  &__amount {
    font-size: 56px;
    font-weight: 800;
    color: $gray-100;
    font-family: var(--font-family-mono);
  }

  &__desc {
    font-size: 14px;
    color: $gray-400;
  }

  &__features {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__feature {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: $glass-bg;
    border-radius: var(--global-border-radius);
  }

  &__check {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-green-22c55e-10);
    border-radius: var(--global-border-radius);

    .el-icon {
      font-size: 14px;
      color: var(--color-green-22c55e);
    }
  }

  &__feature-text {
    font-size: 15px;
    color: $gray-200;
  }

  &__footer {
    display: flex;
    gap: 12px;
  }

  &__btn {
    flex: 1;
    padding: 14px 24px;
    border-radius: var(--global-border-radius);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all $transition-fast;

    &--cancel {
      background: $glass-bg;
      border: var(--unified-border);
      color: $gray-300;

      &:hover {
        background: $glass-hover;
        color: $gray-100;
      }
    }

    &--confirm {
      background: $gray-100;
      border: none;
      color: $gray-900;

      &:hover {
        background: var(--el-bg-color);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    }
  }

  &__loading {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid transparent;
    border-top-color: var(--border-unified-color);
    border-radius: var(--global-border-radius);
    animation: spin 0.8s linear infinite;
  }
}

// ============ 动画关键?============
@keyframes badge-shine {
  0%,
  100% {
    transform: translateX(-100%);
  }

  50% {
    transform: translateX(100%);
  }
}

@keyframes btn-shine {
  0% {
    left: -100%;
  }

  50%,
  100% {
    left: 100%;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ============ Element Plus 弹窗覆盖 ============
:deep(.el-dialog) {
  background: $gray-800 ;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  .el-dialog__header {
    padding: 20px 24px 0;
    border-bottom: none;

    .el-dialog__title {
      font-size: 20px;
      font-weight: 700;
      color: $gray-100 ;
    }
  }

  .el-dialog__body {
    padding: 24px;
  }

  .el-dialog__footer {
    padding: 0 24px 24px;
    border-top: none;
  }
}

// ============ 响应式设?============
@media (width >= 768px) {
  .vip-page__content {
    padding: 40px 32px;
  }

  .vip-header__glasscard {
    padding: 64px 48px;
  }

  .vip-header__title {
    font-size: 48px;
  }

  .vip-header__amount {
    font-size: 80px;
  }

  .vip-features__grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .vip-stat__number {
    font-size: 40px;
  }
}

@media (width >= 1024px) {
  .vip-features__grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .vip-feature-card__content {
    flex-direction: column;
    text-align: center;
    padding: 28px 20px;
  }

  .vip-feature-card__icon-wrapper {
    width: 72px;
    height: 72px;
    margin-bottom: 8px;
  }

  .vip-feature-card__icon {
    font-size: 40px;
  }

  .vip-feature-card__desc {
    white-space: normal;
  }

  .vip-feature-card__tag {
    margin-top: 12px;
  }
}

@media (width <= 480px) {
  .vip-header__title {
    font-size: 28px;
  }

  .vip-header__amount {
    font-size: 48px;
  }

  .vip-header__currency {
    font-size: 20px;
  }

  .vip-stats {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .vip-stat {
    padding: 20px;
  }

  .vip-stat__number {
    font-size: 28px;
  }

  .vip-purchase-bar__number {
    font-size: 28px;
  }

  .vip-purchase-bar__btn {
    padding: 12px 24px;
  }

  .vip-popup__amount {
    font-size: 44px;
  }
}
</style>
