<template>
  <div class="vip-page page-container">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${scrollProgress})` }"></div>

    <!-- 深度背景系统 -->
    <div class="vip-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
    </div>

    <!-- VIP背景图片（同步UniApp bg-image） -->
    <div class="vip-bg-image-container">
      <img
        :src="vipBgImage"
        alt="VIP Background"
        class="vip-bg-image"
        loading="eager"
      />
      <div class="vip-bg-overlay"></div>
    </div>

    <!-- 英雄区域 -->
    <section id="vip-hero" class="vip-hero radius-auto" aria-labelledby="vip-hero-title">
      <div class="hero-content container">
        <div class="hero-text scroll-reveal" data-animation="fadeInUp">
          <div class="hero-badge">
            <span class="status-dot"></span>
            <span class="badge-text font-edix">VIP Membership</span>
          </div>
          <h1 id="vip-hero-title" class="hero-title">
            <el-icon class="crown-icon"><Trophy /></el-icon>
            {{ t('vip.hero.title') }}
          </h1>
          <p class="hero-subtitle">{{ t('vip.hero.subtitle') }}</p>
          <div class="hero-stats">
            <div class="stat-item scroll-reveal" data-delay="100" data-animation="fadeInUp">
              <span class="stat-number count-up gradient-text" data-target="100" data-count-id="tools">
                {{ animatedNumbers.get('tools') || 0 }}+
              </span>
              <span class="stat-label">{{ t('vip.hero.stats.aiTools') }}</span>
            </div>
            <div class="stat-item scroll-reveal" data-delay="200" data-animation="fadeInUp">
              <span class="stat-number gradient-text">24/7</span>
              <span class="stat-label">{{ t('vip.hero.stats.customerService') }}</span>
            </div>
            <div class="stat-item scroll-reveal" data-delay="300" data-animation="fadeInUp">
              <span class="stat-number gradient-text">∞</span>
              <span class="stat-label">{{ t('vip.hero.stats.unlimited') }}</span>
            </div>
          </div>
        </div>
        <div class="hero-image scroll-reveal" data-delay="400" data-animation="fadeInRight">
          <div class="vip-card-preview">
            <div class="vip-card glass">
              <div class="card-header">
                <el-icon class="card-crown"><Trophy /></el-icon>
                <span class="card-title">{{ t('vip.card.vipMember') }}</span>
              </div>
              <div class="card-content">
                <div class="member-info">
                  <div class="member-name">
                    {{ userInfo?.username || t('vip.card.memberName') }}
                  </div>
                  <div class="member-level">{{ t('vip.card.diamondMember') }}</div>
                </div>
                <div class="card-benefits">
                  <div class="benefit-item">{{ t('vip.card.benefits.unlimitedChat') }}</div>
                  <div class="benefit-item">{{ t('vip.card.benefits.exclusiveModel') }}</div>
                  <div class="benefit-item">{{ t('vip.card.benefits.prioritySupport') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- VIP特权 -->
    <section id="vip-benefits" class="vip-benefits radius-auto" aria-labelledby="vip-benefits-heading">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">PRIVILEGES</span>
          <h2 id="vip-benefits-heading">{{ t('vip.benefits.title') }}</h2>
          <p>{{ t('vip.benefits.subtitle') }}</p>
          <div class="section-underline"></div>
        </div>
        <div class="benefits-grid">
          <div
            class="benefit-card glass scroll-reveal glow-border"
            v-for="(benefit, idx) in vipBenefits"
            :key="benefit.id"
            :data-delay="Number(idx) * 100"
            data-animation="fadeInUp"
          >
            <div class="benefit-icon pulse-glow">
              <el-icon :size="32">
                <component :is="benefit.icon" />
              </el-icon>
            </div>
            <h3 class="benefit-title">{{ benefit.title }}</h3>
            <p class="benefit-description">{{ benefit.description }}</p>
            <ul class="benefit-features">
              <li v-for="feature in benefit.features" :key="feature">
                <span class="check-dot"></span>
                {{ feature }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- 价格套餐 -->
    <section id="vip-pricing" class="pricing-section radius-auto" aria-labelledby="vip-pricing-heading">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">PRICING</span>
          <h2 id="vip-pricing-heading">{{ t('vip.pricing.title') }}</h2>
          <p>{{ t('vip.pricing.subtitle') }}</p>
          <div class="section-underline"></div>
        </div>

        <div class="pricing-toggle scroll-reveal" data-animation="fadeInUp">
          <el-radio-group v-model="billingCycle" class="billing-toggle">
            <el-radio-button value="monthly">{{ t('vip.pricing.billing.monthly') }}</el-radio-button>
            <el-radio-button value="yearly">{{ t('vip.pricing.billing.yearly') }}</el-radio-button>
          </el-radio-group>
          <div class="discount-badge" v-if="billingCycle === 'yearly'">
            <el-tag effect="dark">{{ t('vip.pricing.discount.yearlyDiscount') }}</el-tag>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="pricingLoading" class="pricing-loading">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>{{ t('vip.pricing.loading') }}</p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="pricingError" class="pricing-error glass">
          <el-icon :size="32"><CircleClose /></el-icon>
          <p>{{ pricingError }}</p>
          <el-button @click="fetchPricingPlans">{{ t('vip.pricing.retry') }}</el-button>
        </div>

        <!-- 价格卡片 -->
        <div v-else class="pricing-cards">
          <div
            v-for="(plan, idx) in pricingPlans"
            :key="plan.id"
            class="pricing-card glass scroll-reveal"
            :class="{
              recommended: plan.recommended,
              selected: selectedPlan?.id === plan.id,
            }"
            :data-delay="Number(idx) * 150"
            data-animation="fadeInUp"
            @click="selectedPlan = plan"
          >
            <div v-if="plan.recommended" class="recommended-badge">
              <el-icon><Star /></el-icon>
              {{ t('vip.pricing.plans.recommended') }}
            </div>

            <div class="plan-header">
              <h3 class="plan-name">{{ plan.name }}</h3>
              <div class="plan-price">
                <span class="currency">¥</span>
                <span class="amount gradient-text count-up" :data-target="getCurrentPrice(plan)" :data-count-id="plan.id">
                  {{ animatedNumbers.get(plan.id) || getCurrentPrice(plan) }}
                </span>
                <span class="period"
                  >/{{
                    billingCycle === 'monthly'
                      ? t('vip.pricing.billing.month')
                      : t('vip.pricing.billing.year')
                  }}</span
                >
              </div>
              <div v-if="billingCycle === 'yearly' && plan.yearlyDiscount" class="original-price">
                {{ t('vip.pricing.discount.originalPrice', { price: plan.yearlyPrice }) }}
              </div>
              <p class="plan-description">{{ plan.description }}</p>
            </div>

            <div class="plan-features">
              <div class="feature-category" v-for="category in plan.features" :key="category.name">
                <h4 class="category-name">{{ category.name }}</h4>
                <ul class="feature-list">
                  <li v-for="feature in category.items" :key="feature" class="feature-item">
                    <el-icon class="check-icon"><Check /></el-icon>
                    {{ feature }}
                  </li>
                </ul>
              </div>
            </div>

            <div class="plan-action">
              <button
                class="select-plan-btn magnetic-btn ripple-btn"
                :class="{ primary: plan.recommended }"
                @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleSelectPlan(plan) }"
                @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
                @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)"
              >
                <span class="btn-text">
                  {{
                    userInfo?.isVip || vipInfo?.isVip ? t('vip.pricing.plans.upgrade') : t('vip.pricing.plans.subscribe')
                  }}
                </span>
                <span class="btn-glow"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 用户评价 -->
    <section id="vip-testimonials" class="testimonials" aria-labelledby="vip-testimonials-heading">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">TESTIMONIALS</span>
          <h2 id="vip-testimonials-heading">{{ t('vip.testimonials.title') }}</h2>
          <p>{{ t('vip.testimonials.subtitle') }}</p>
          <div class="section-underline"></div>
        </div>
        <div class="testimonials-grid">
          <div
            v-for="(testimonial, idx) in testimonials"
            :key="testimonial.id"
            class="testimonial-card glass scroll-reveal"
            :data-delay="Number(idx) * 120"
            data-animation="fadeInUp"
          >
            <div class="testimonial-content">
              <div class="quote-icon">"</div>
              <p class="testimonial-text">{{ testimonial.content }}</p>
            </div>
            <div class="testimonial-author">
              <el-avatar :src="testimonial.avatar" :size="48">
                <el-icon><User /></el-icon>
              </el-avatar>
              <div class="author-info">
                <h4 class="author-name">{{ testimonial.name }}</h4>
                <p class="author-title">{{ testimonial.title }}</p>
              </div>
              <div class="rating">
                <el-rate v-model="testimonial.rating" disabled show-score />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 常见问题 -->
    <section id="vip-faq" class="faq-section" aria-labelledby="vip-faq-heading">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">FAQ</span>
          <h2 id="vip-faq-heading">{{ t('vip.faq.title') }}</h2>
          <p>{{ t('vip.faq.subtitle') }}</p>
          <div class="section-underline"></div>
        </div>
        <div class="faq-content glass scroll-reveal" data-animation="fadeInUp">
          <el-collapse v-model="activeFaq" class="faq-collapse">
            <el-collapse-item
              v-for="faq in faqs"
              :key="faq.id"
              :title="faq.question"
              :name="faq.id"
              class="faq-item"
            >
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="faq-answer" v-html="sanitizeHtml(faq.answer)"></div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </section>

    <!-- 立即开通 -->
    <section id="vip-cta" class="cta-section" aria-labelledby="vip-cta-heading">
      <div class="container">
        <div class="cta-content glass scroll-reveal" data-animation="fadeInUp">
          <h2 id="vip-cta-heading">{{ t('vip.cta.title') }}</h2>
          <p>{{ t('vip.cta.subtitle') }}</p>
          <div class="cta-actions">
            <button
              class="cta-btn primary magnetic-btn ripple-btn"
              :aria-label="t('vip.cta.upgrade')"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleQuickUpgrade() }"
              @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
              @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)"
            >
              <el-icon><Trophy /></el-icon>
              <span class="btn-text">{{ t('vip.cta.upgrade') }}</span>
              <span class="btn-glow"></span>
            </button>
            <button
              class="cta-btn ghost magnetic-btn"
              :aria-label="t('vip.cta.viewPlans')"
              @click="scrollToPlans"
              @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
              @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)"
            >
              <span class="btn-text">{{ t('vip.cta.viewPlans') }}</span>
            </button>
          </div>
          <div class="cta-guarantee">
            <el-icon><Lock /></el-icon>
            <span>{{ t('vip.cta.guarantee') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 固定底部购买栏（同步UniApp buy-section + safe-area适配） -->
    <div class="vip-fixed-bottom-bar">
      <div class="vip-bottom-inner container">
        <div class="vip-bottom-price-info">
          <span class="vip-bottom-currency">¥</span>
          <span class="vip-bottom-amount">{{ vipPriceData?.amount || '---' }}</span>
          <span class="vip-bottom-period">{{ t('Vip.permanentVip') }}</span>
        </div>
        <button
          class="vip-bottom-buy-btn magnetic-btn ripple-btn"
          @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); openPurchasePopup() }"
          @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
          @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)"
        >
          <span class="btn-text">{{ t('Vip.oneClickVip') }}</span>
          <span class="btn-glow"></span>
        </button>
      </div>
    </div>

    <!-- 支付对话框 -->
    <el-dialog
      v-model="showPaymentDialog"
      :title="t('vip.payment.confirmOrder')"
      width="500px"
      class="payment-dialog"
    >
      <div class="order-summary" v-if="selectedPlan">
        <div class="order-header">
          <h3>{{ t('vip.payment.orderDetails') }}</h3>
        </div>
        <div class="order-item">
          <div class="item-info">
            <h4>{{ selectedPlan.name }}</h4>
            <p>{{ selectedPlan.description }}</p>
            <div class="billing-info">
              {{
                t('vip.payment.billingCycle', {
                  cycle:
                    billingCycle === 'monthly' ? t('vip.payment.monthly') : t('vip.payment.yearly'),
                })
              }}
            </div>
          </div>
          <div class="item-price">¥{{ getCurrentPrice(selectedPlan) }}</div>
        </div>

        <div
          class="discount-section"
          v-if="billingCycle === 'yearly' && selectedPlan.yearlyDiscount"
        >
          <div class="discount-item">
            <span>{{ t('vip.payment.yearlyDiscount') }}</span>
            <span class="discount-amount">-¥{{ getDiscountAmount(selectedPlan) }}</span>
          </div>
        </div>

        <div class="order-total">
          <div class="total-line">
            <span class="total-label">{{ t('vip.payment.total') }}</span>
            <span class="total-amount">¥{{ getCurrentPrice(selectedPlan) }}</span>
          </div>
        </div>

        <div class="payment-methods">
          <h4>{{ t('vip.payment.paymentMethods') }}</h4>
          <el-radio-group v-model="paymentMethod" class="payment-options">
            <el-radio value="wechat" class="payment-option">
              <div class="payment-method-content">
                <span class="payment-icon">💬</span>
                <span class="payment-name">{{ t('vip.payment.wechatPay') }}</span>
              </div>
            </el-radio>
            <el-radio value="alipay" class="payment-option">
              <div class="payment-method-content">
                <span class="payment-icon">💰</span>
                <span class="payment-name">{{ t('vip.payment.alipay') }}</span>
              </div>
            </el-radio>
          </el-radio-group>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showPaymentDialog = false">{{ t('vip.payment.cancel') }}</el-button>
          <el-button @click="handlePaymentClick" :loading="processing">
            {{
              t('vip.payment.confirmPay', {
                price: selectedPlan ? getCurrentPrice(selectedPlan) : 0,
              })
            }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 二维码支付对话框 -->
    <el-dialog
      v-model="qrCodeDialogVisible"
      :title="t('vip.payment.qrCodeTitle')"
      width="400px"
      class="qr-code-dialog"
    >
      <div class="qr-code-content">
        <div class="qr-code-tip">{{ t('vip.payment.qrCodeTip') }}</div>
        <div class="qr-code-image" v-if="qrCodeUrl">
          <img :src="qrCodeUrl" :alt="t('vip.payment.qrCodeAlt')" loading="lazy" />
        </div>
        <div class="qr-code-footer">
          <el-button @click="qrCodeDialogVisible = false">{{ t('vip.payment.close') }}</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 购买确认弹窗（同步UniApp ConfirmPurchasePopUp） -->
    <el-dialog
      v-model="showPurchasePopup"
      :title="t('vip.payment.confirmOrder')"
      width="500px"
      class="payment-dialog"
      @close="closePurchasePopup"
    >
      <div class="order-summary" v-if="vipPriceData">
        <div class="order-header">
          <h3>{{ t('vip.payment.orderDetails') }}</h3>
        </div>
        <div class="order-item">
          <div class="item-info">
            <h4>{{ t('vip.payment.vipName') }}</h4>
            <p>{{ t('vip.payment.paymentOnetime') }}</p>
            <div class="billing-info">{{ t('vip.payment.lifetimeMember') }}</div>
          </div>
          <div class="item-price">¥{{ vipPriceData.amount }}</div>
        </div>

        <div class="vip-benefits-list">
          <div class="benefit-check">{{ t('vip.payment.benefits.unlimitedCopy') }}</div>
          <div class="benefit-check">{{ t('vip.payment.benefits.premiumModel') }}</div>
          <div class="benefit-check">{{ t('vip.payment.benefits.referral') }}</div>
          <div class="benefit-check">{{ t('vip.payment.benefits.support') }}</div>
          <div class="benefit-check highlight">{{ t('vip.payment.benefits.lifetime') }}</div>
        </div>

        <div class="order-total">
          <div class="total-line">
            <span class="total-label">{{ t('vip.payment.total') }}</span>
            <span class="total-amount">¥{{ vipPriceData.amount }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closePurchasePopup">{{ t('vip.payment.cancel') }}</el-button>
          <el-button @click="handlePaymentClick" :loading="processing">
            {{ t('vip.payment.payNow', { amount: vipPriceData?.amount || 0 }) }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { computed, onMounted, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trophy, Star, Check, User, Lock, Loading, CircleClose } from '@/lib/lucide-fallback'
import { useAuthStore } from '@/stores/auth'
import { useVipBenefits } from '@/composables/vip/useVipBenefits'
import { useVipPricing } from '@/composables/vip/useVipPricing'
import { useVipTestimonials } from '@/composables/vip/useVipTestimonials'
import { useVipFaqs } from '@/composables/vip/useVipFaqs'
import { useVipPayment } from '@/composables/vip/useVipPayment'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import { useVipAnalytics } from '@/composables/useAnalytics'
import { getvipPrice } from '@/api/vip'
import { ElMessage } from 'element-plus'
import { useSEO } from '@/composables/useSEO'
import { useCleanup } from '@/composables/useCleanup'

useSEO({
  title: 'VIP会员 - 智汇AI社区',
  description: '智汇AI社区VIP会员，享受更多AI服务和专属权益',
  keywords: 'VIP会员,AI会员,智汇AI会员,会员权益',
  ogTitle: 'VIP会员 - 智汇AI社区',
  ogDescription: '智汇AI社区VIP会员，享受更多AI服务和专属权益',
  canonical: 'https://www.zhihui-ai.com/vip'
})

// VIP背景图片（同步UniApp image组件）
const vipBgImage = ref('/images/vip-bg.png')

const { t } = useI18n()
const authStore = useAuthStore()
const userInfo = computed(() => authStore.user)
const vipInfo = ref<any>(null)
const { loading: _loadingVipInfo, execute: executeVipApi } = useApiError({ showMessage: false })
const { trackVipPageView, trackVipPlanClick, trackVipPurchaseClick, trackVipPurchaseSuccess } = useVipAnalytics()

// 动态价格获取（getvipPrice API）
const vipPriceData = ref<any>(null)
const showPurchasePopup = ref(false)

// ============ 高级动效系统 ============
const cleanup = useCleanup()
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())
const scrollProgress = ref(0)
const animatedNumbers = ref<Map<string, number>>(new Map())

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

// 滚动进度计算
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = Math.min(scrollTop / docHeight, 1)
    document.documentElement.style.setProperty('--scroll-progress', `${scrollProgress.value}`)
  })
}

// 数字计数动画
const initCountAnimation = () => {
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const target = parseInt(el.dataset.target || '0')
          const id = el.dataset.countId || Math.random().toString()
          animateNumber(id, 0, target, 2000)
          counterObserver.unobserve(el)
        }
      })
    },
    { threshold: 0.5 }
  )

  nextTick(() => {
    document.querySelectorAll('.count-up').forEach((el) => {
      counterObserver.observe(el)
    })
  })
}

const animateNumber = (id: string, start: number, end: number, duration: number) => {
  const startTime = performance.now()

  const update = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOutExpo = 1 - Math.pow(2, -10 * progress)
    const current = Math.floor(start + (end - start) * easeOutExpo)
    animatedNumbers.value.set(id, current)
    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }

  requestAnimationFrame(update)
}

// 磁吸按钮效果
const handleMagneticMove = (e: MouseEvent, btnRef: HTMLElement | null) => {
  if (!btnRef) return
  const rect = btnRef.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  btnRef.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`
}

const resetMagnetic = (btnRef: HTMLElement | null) => {
  if (!btnRef) return
  btnRef.style.transform = 'translate(0, 0)'
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

const fetchUserVipInfo = async () => {
  // 未登录时不发起需认证请求，避免全局拦截器强制跳转 /login
  if (!authStore.token) return
  const data = await executeVipApi(async () => {
    const { getUserVipInfo: getUserVipInfoFromUser } = await import('@/api/user')
    return await getUserVipInfoFromUser()
  })
  if (data !== null && typeof data === 'object') {
    vipInfo.value = data
    logger.info('[Vip] Successfully got user VIP info', vipInfo.value)
  }
}

// 获取动态VIP价格（同步UniApp的getvipPrice API）
const fetchVipPrice = async () => {
  try {
    const token = authStore.token
    if (!token) return
    const res = await getvipPrice(token)
    if (res && (res as any).code === '200' && (res as any).data) {
      vipPriceData.value = (res as any).data
      logger.info('[Vip] Successfully got VIP price', vipPriceData.value)
    }
  } catch (err) {
    logger.warn('[Vip] Failed to get VIP price', err)
  }
}

// 打开购买弹窗（同步UniApp的ConfirmPurchasePopUp）
const openPurchasePopup = () => {
  showPurchasePopup.value = true
}

const closePurchasePopup = () => {
  showPurchasePopup.value = false
}

// 获取价格方案
const fetchPricingPlans = async () => {
  // 此函数由 useVipPricing 提供，这里仅用于错误重试
}

// 使用 Composables
const { vipBenefits } = useVipBenefits()
const {
  billingCycle,
  selectedPlan,
  pricingPlans,
  loading: pricingLoading,
  error: pricingError,
  getCurrentPrice,
  getDiscountAmount,
  handleSelectPlan: selectPlan,
  handleQuickUpgrade: quickUpgrade,
} = useVipPricing()
const { testimonials } = useVipTestimonials()
const { activeFaq, faqs, sanitizeHtml } = useVipFaqs()
const {
  showPaymentDialog,
  paymentMethod,
  processing,
  qrCodeDialogVisible,
  qrCodeUrl,
  handlePayment,
  openPaymentDialog,
  scrollToPlans,
} = useVipPayment({
  onPaymentSuccess: () => {
    if (selectedPlan.value) {
      trackVipPurchaseSuccess(selectedPlan.value.name || 'unknown', getCurrentPrice(selectedPlan.value))
    }
  }
})

// 包装 handleSelectPlan 以同时打开支付对话框
const handleSelectPlan = (plan: typeof selectedPlan.value) => {
  if (plan) {
    trackVipPlanClick(plan.name || 'unknown')
    selectPlan(plan)
    openPaymentDialog()
  }
}

// 包装 handleQuickUpgrade 以同时打开支付对话框
const handleQuickUpgrade = () => {
  quickUpgrade()
  openPaymentDialog()
}

// 包装 handlePayment 以传递 selectedPlan
const handlePaymentClick = async () => {
  try {
    if (selectedPlan.value) {
      trackVipPurchaseClick(selectedPlan.value.name || 'unknown', getCurrentPrice(selectedPlan.value))
    }
    await handlePayment(selectedPlan.value)
  } catch (e) {
    console.error('[Vip] 支付发起失败', e)
    ElMessage.error(t('common.errors.paymentInitFailed'))
  }
}

// 生命周期
onMounted(async () => {
  trackVipPageView()
  try { await fetchUserVipInfo(); await fetchVipPrice() } catch (e) { console.error(e) }

  // 初始化高级动效系统
  initScrollAnimations()
  initCountAnimation()

  // 添加事件监听
  cleanup.addEventListener(window, 'scroll', handleScroll, { passive: true })
  handleScroll()

  // 组件销毁时清理滚动观察器和动画帧
  cleanup.add(() => {
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null }
  })
  cleanup.add(() => {
    if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null }
  })

  // 如果用户已经是VIP，默认选择更高级的套餐
  if ((userInfo.value as any)?.isVip || vipInfo.value?.isVip) {
    const currentPlanIndex = pricingPlans.value.findIndex(plan => plan.recommended)
    if (currentPlanIndex < pricingPlans.value.length - 1) {
      selectedPlan.value = pricingPlans.value[currentPlanIndex + 1]
    }
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/breakpoints' as bp;

// 设计系统变量
$bg-page: var(--el-bg-color-page);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--el-text-color-regular);
$accent-highlight: var(--el-text-color-secondary);

// ============ 页面基础 ============
.vip-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  position: relative;
  background: $bg-page;
  color: $text-main;
  font-family: var(--font-family-chinese);

}

// ============ VIP背景图片（同步UniApp bg-image） ============
.vip-bg-image-container {
  position: relative;
  width: 100%;
  height: 400px;
  overflow: hidden;

  .vip-bg-image {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: var(--z-base);
  }

  .vip-bg-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 0%, rgba($bg-page, 0.6) 100%);
    z-index: calc(var(--z-base) + 1);
  }
}

// ============ 固定底部购买栏（同步UniApp buy-section + safe-area） ============
.vip-fixed-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-header);
  background: var(--color-rgba-15--23--42--0-95-);
  backdrop-filter: blur(20px);
  border-top: var(--unified-border);

  // Web端safe-area适配（同步UniApp env(safe-area-inset-bottom)）
  padding-bottom: env(safe-area-inset-bottom, 0);

  // iOS Safari底部安全区回退
  padding-bottom: constant(safe-area-inset-bottom, 0);

  .vip-bottom-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
  }

  .vip-bottom-price-info {
    display: flex;
    align-items: baseline;

    .vip-bottom-currency {
      font-size: 20px;
      font-weight: 800;
      color: var(--color-white);
      margin-right: 4px;
    }

    .vip-bottom-amount {
      font-size: 32px;
      font-weight: 950;
      color: var(--color-white);
    }

    .vip-bottom-period {
      font-size: 13px;
      color: var(--color-white-60);
      margin-left: 8px;
    }
  }

  .vip-bottom-buy-btn {
    padding: 14px 36px;
    background: linear-gradient(135deg, var(--color-vip-gold-start), var(--color-vip-gold-end));
    border-radius: var(--global-border-radius);
    font-size: 16px;
    font-weight: 900;
    color: var(--color-gray-1f2937);
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    overflow: hidden;

    &:hover {
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

// 暗色模式下固定底部栏
:where(html.dark) :where(body) .vip-page .vip-fixed-bottom-bar {
  background: var(--color-dark-141414-95);
}

// ============ 深度背景系统 ============
.vip-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(100px);
    opacity: 0.12;
    animation: floatOrb 18s ease-in-out infinite;

    &.orb-1 {
      width: 500px;
      height: 500px;
      top: 5%;
      right: 5%;
      background: rgba($brand-primary, 0.3);
    }

    &.orb-2 {
      width: 400px;
      height: 400px;
      bottom: 15%;
      left: 5%;
      background: rgba($accent-highlight, 0.3);
      animation-delay: -9s;
    }
  }

}

// ============ 容器 ============
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 40px;
  position: relative;
  z-index: var(--z-base);
}

// ============ 玻璃态效果 ============
.glass {
  background: rgb(var(--el-fill-color-light-rgb), 0.4);
  backdrop-filter: blur(24px);
  border: var(--unified-border);
}

// ============ 滚动触发动画 ============
.scroll-reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: none;

  &.scroll-animated {
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }

  &.animate-fadeInRight {
    opacity: 1;
    transform: translateX(0);
  }
}

.scroll-reveal[data-animation="fadeInRight"] {
  transform: translateX(40px);
}

// ============ 渐变文字 ============
.gradient-text {
  color: $brand-primary;
}

// ============ 脉冲发光（扁平化：原 keyframes 0/50/100% box-shadow 全相同，现改为 transform 缩放呼吸）============
.pulse-glow {
  animation: pulseScale 2s ease-in-out infinite;
}

@keyframes pulseScale {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.06); }
}

// ============ 磁吸按钮 ============
.magnetic-btn {
  position: relative;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  .btn-text {
    position: relative;
    z-index: calc(var(--z-base) + 1);
  }

  // 扫光效果已移至全局样式 (styles/index.scss)
}

// ============ 涟漪效果 ============
.ripple-btn {
  position: relative;
  overflow: hidden;
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(60px, 60px); }
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -20px) scale(1.05); }
  50% { transform: translate(-20px, 30px) scale(0.95); }
  75% { transform: translate(-30px, -10px) scale(1.02); }
}

@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes borderGlow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes pulseGlow {
  /* 死代码已删除：原 0/50/100% 三个 box-shadow 全部相同，扁平化设计要求移除 box-shadow 深度效果 */
}

@keyframes rippleExpand {
  0% { transform: scale(0); opacity: 0.6; }
  100% { transform: scale(4); opacity: 0; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
}

// ============ Section 标题 ============
.section-header {
  text-align: center;
  margin-bottom: 80px;

  .section-idx {
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 900;
    color: $brand-primary;
    opacity: 0.6;
    letter-spacing: 0.1em;
  }

  h2 {
    font-size: clamp(32px, 5vw, 48px);
    font-weight: 950;
    letter-spacing: -0.02em;
    margin: 12px 0 16px;
  }

  p {
    font-size: 18px;
    color: $text-sec;
  }

  .section-underline {
    width: 60px;
    height: 4px;
    background: $brand-primary;
    margin: 24px auto 0;
    border-radius: var(--global-border-radius);
  }
}

// ============ Hero 区域 ============
:where(.vip-hero) {
  padding: 120px 0 100px;
  position: relative;
  overflow: hidden;

  .hero-content {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 80px;
    align-items: center;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 32px;
    background: rgb(var(--el-fill-color-light-rgb), 0.3);

    .status-dot {
      width: 6px;
      height: 6px;
      background: $brand-primary;
      border-radius: var(--global-border-radius);
      animation: pulse 2s infinite;
    }
  }

  .hero-title {
    font-size: clamp(40px, 5vw, 64px);
    font-weight: 950;
    line-height: 1.2;
    letter-spacing: -0.03em;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 20px;

    .crown-icon {
      font-size: 56px;
      color: $brand-primary;
    }
  }

  .hero-subtitle {
    font-size: 20px;
    color: $text-sec;
    margin-bottom: 48px;
    line-height: 1.6;
  }

  .hero-stats {
    display: flex;
    gap: 48px;

    .stat-item {
      text-align: center;

      .stat-number {
        display: block;
        font-size: clamp(32px, 4vw, 48px);
        font-weight: 950;
        letter-spacing: -0.02em;
        margin-bottom: 8px;
      }

      .stat-label {
        font-size: 14px;
        color: $text-sec;
        font-weight: 600;
      }
    }
  }
}

// ============ VIP 卡片预览 ============
:where(.vip-card-preview) {
  perspective: 1500px;

  :where(.vip-card) {
    width: 360px;
    height: 220px;
    border-radius: var(--global-border-radius);
    padding: 32px;
    position: relative;
    overflow: hidden;

    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      position: relative;
      z-index: var(--z-base);

      .card-crown {
        font-size: 28px;
        color: $brand-primary;
      }

      .card-title {
        font-size: 20px;
        font-weight: 800;
      }
    }

    .card-content {
      position: relative;
      z-index: var(--z-base);

      .member-info {
        margin-bottom: 20px;

        .member-name {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .member-level {
          font-size: 13px;
          color: $text-sec;
        }
      }

      .card-benefits {
        .benefit-item {
          font-size: 13px;
          color: $text-sec;
          margin-bottom: 6px;
          padding-left: 16px;
          position: relative;

          &::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: $brand-primary;
            font-weight: 700;
          }
        }
      }
    }
  }
}

// ============ VIP 特权 ============
:where(.vip-benefits) {
  padding: 120px 0;

  :where(.benefits-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 32px;

    .benefit-card {
      padding: 48px 36px;
      border-radius: var(--global-border-radius);
      position: relative;
      overflow: hidden;

      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: $brand-primary;
        opacity: 0;
        transition: opacity 0.3s;
      }

      &:hover::before {
        opacity: 1;
      }

      .benefit-icon {
        width: 80px;
        height: 80px;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 28px;
        color: $brand-primary;
        background: rgba($brand-primary, 0.08);
        transition: all 0.4s;
      }

      &:hover .benefit-icon {
        background: $brand-primary;
        color: var(--el-bg-color-page);
        transform: scale(1.05);
      }

      .benefit-title {
        font-size: 24px;
        font-weight: 900;
        margin-bottom: 16px;
      }

      .benefit-description {
        font-size: 15px;
        color: $text-sec;
        margin-bottom: 24px;
        line-height: 1.7;
      }

      .benefit-features {
        list-style: none;
        padding: 0;
        margin: 0;

        li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          color: $text-sec;
          font-size: 14px;

          .check-dot {
            width: 6px;
            height: 6px;
            background: $brand-primary;
            border-radius: var(--global-border-radius);
            flex-shrink: 0;
          }
        }
      }
    }
  }
}

// ============ 价格套餐 ============
:where(.pricing-section) {
  padding: 120px 0;
  background: rgba($brand-primary, 0.02);

  .pricing-toggle {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-bottom: 60px;

    .billing-toggle {
      background: rgb(var(--el-fill-color-light-rgb), 0.5);
      border-radius: var(--global-border-radius);
      padding: 4px;
    }

    .discount-badge {
      animation: pulse 2s infinite;
    }
  }

  .pricing-loading,
  .pricing-error {
    text-align: center;
    padding: 60px;

    p {
      margin-top: 16px;
      color: $text-sec;
    }
  }

  .pricing-error {
    border-radius: var(--global-border-radius);
    max-width: 400px;
    margin: 0 auto;
  }

  :where(.pricing-cards) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 32px;

    :where(.pricing-card) {
      padding: 48px 36px;
      border-radius: var(--global-border-radius);
      position: relative;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

      &.recommended {
        transform: scale(1.05);
        z-index: calc(var(--z-base) + 1);

        .recommended-badge {
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          background: $brand-primary;
          color: var(--el-bg-color-page);
          padding: 10px 24px;
          border-radius: var(--global-border-radius);
          font-size: 12px;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      &.selected {
        border-color: $brand-primary;
      }

      .plan-header {
        text-align: center;
        margin-bottom: 36px;

        .plan-name {
          font-size: 20px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 16px;
        }

        .plan-price {
          margin-bottom: 12px;

          .currency {
            font-size: 24px;
            font-weight: 800;
          }

          .amount {
            font-size: 56px;
            font-weight: 950;
            letter-spacing: -0.02em;
          }

          .period {
            font-size: 16px;
            color: $text-sec;
          }
        }

        .original-price {
          font-size: 14px;
          color: $text-sec;
          text-decoration: line-through;
          margin-bottom: 16px;
        }

        .plan-description {
          font-size: 14px;
          color: $text-sec;
          line-height: 1.6;
        }
      }

      :where(.plan-features) {
        margin-bottom: 36px;

        :where(.feature-category) {
          margin-bottom: 24px;

          .category-name {
            font-size: 14px;
            font-weight: 900;
            color: $brand-primary;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: var(--unified-border-bottom);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .feature-list {
            list-style: none;
            padding: 0;
            margin: 0;

            .feature-item {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 10px 0;
              font-size: 14px;
              color: $text-sec;

              .check-icon {
                color: $brand-primary;
                font-size: 16px;
                flex-shrink: 0;
              }
            }
          }
        }
      }

      :where(.plan-action) {
        :where(.select-plan-btn) {
          width: 100%;
          height: 56px;
          border-radius: var(--global-border-radius);
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          border: var(--unified-border);
          background: transparent;
          color: inherit;
          transition: all 0.3s;

          &.primary {
            background: $brand-primary;
            color: var(--el-bg-color-page);
            border: none;
          }

          &:hover {
            background: $brand-primary;
            color: var(--el-bg-color-page);
            border-color: $brand-primary;
          }

          html.dark & {
            background: var(--el-bg-color);
            color: var(--el-text-color-primary);
            border-color: var(--el-border-color);

            &.primary {
              background: var(--el-color-primary);
              color: var(--el-text-color-primary);
            }

            &:hover {
              background: var(--el-color-primary);
              color: var(--el-text-color-primary);
            }
          }
        }
      }
    }
  }
}

// ============ 用户评价 ============
:where(.testimonials) {
  padding: 120px 0;

  :where(.testimonials-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 32px;

    :where(.testimonial-card) {
      padding: 40px 36px;
      border-radius: var(--global-border-radius);
      transition: all 0.4s;
      position: relative;

      &:hover {
        .quote-icon {
          transform: scale(1.1);
        }
      }

      .testimonial-content {
        margin-bottom: 28px;
        position: relative;

        .quote-icon {
          position: absolute;
          top: -16px;
          left: -8px;
          font-size: 72px;
          font-weight: 900;
          color: rgba($brand-primary, 0.15);
          line-height: 1;
          transition: transform 0.3s;
        }

        .testimonial-text {
          font-size: 16px;
          line-height: 1.8;
          color: $text-sec;
          font-style: italic;
          padding-top: 20px;
        }
      }

      .testimonial-author {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-top: 20px;
        border-top: var(--unified-border);

        .author-info {
          flex: 1;

          .author-name {
            font-size: 16px;
            font-weight: 800;
            margin-bottom: 4px;
          }

          .author-title {
            font-size: 14px;
            color: $text-sec;
            margin: 0;
          }
        }
      }
    }
  }
}

// ============ 常见问题 ============
:where(.faq-section) {
  padding: 120px 0;
  background: rgba($brand-primary, 0.02);

  .faq-content {
    max-width: 900px;
    margin: 0 auto;
    border-radius: var(--global-border-radius);
    overflow: hidden;

    .faq-collapse {
      :deep(.el-collapse-item__header) {
        font-size: 16px;
        font-weight: 700;
        padding: 24px 32px;
        background: transparent;
      }

      :deep(.el-collapse-item__content) {
        padding: 0 32px 24px;
      }

      .faq-answer {
        color: $text-sec;
        line-height: 1.8;
      }
    }
  }
}

// ============ CTA 区域 ============
:where(.cta-section) {
  padding: 120px 0;

  :where(.cta-content) {
    padding: 80px;
    border-radius: var(--global-border-radius);
    text-align: center;
    background: rgba($brand-primary, 0.05);

    h2 {
      font-size: clamp(32px, 4vw, 42px);
      font-weight: 950;
      margin-bottom: 16px;
    }

    p {
      font-size: 18px;
      color: $text-sec;
      margin-bottom: 40px;
    }

    .cta-actions {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 32px;

      .cta-btn {
        height: 60px;
        padding: 0 40px;
        border-radius: var(--global-border-radius);
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;

        &.primary {
          background: $brand-primary;
          color: var(--el-bg-color-page);
          border: none;
        }

        &.ghost {
          background: transparent;
          border: var(--unified-border);
          color: inherit;

          &:hover {
            background: rgba($brand-primary, 0.05);
            border-color: $brand-primary;
          }
        }
      }

      .cta-guarantee {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14px;
        color: $text-sec;
      }
    }
  }
}

// 暗色模式下按钮样式
// 暗色模式：深色背景 + 浅色文字
html.dark .cta-btn.primary {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

// ============ 对话框样式 ============
.payment-dialog,
.qr-code-dialog {
  :deep(.el-dialog__header) {
    padding: 24px 32px;
    border-bottom: var(--unified-border-bottom);
  }

  :deep(.el-dialog__body) {
    padding: 32px;
  }
}

:where(.order-summary) {
  .order-header {
    margin-bottom: 24px;

    h3 {
      font-size: 18px;
      font-weight: 800;
    }
  }

  .order-item {
    display: flex;
    justify-content: space-between;
    padding: 20px 0;
    border-bottom: var(--unified-border-bottom);

    .item-info {
      h4 {
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 8px;
      }

      p {
        color: $text-sec;
        margin-bottom: 8px;
      }

      .billing-info {
        font-size: 14px;
        color: $text-sec;
      }
    }

    .item-price {
      font-size: 24px;
      font-weight: 900;
      color: $brand-primary;
    }
  }

  .discount-section {
    padding: 16px 0;

    .discount-item {
      display: flex;
      justify-content: space-between;
      color: $text-sec;

      .discount-amount {
        color: var(--el-color-success);
        font-weight: 700;
      }
    }
  }

  .order-total {
    padding: 20px 0;

    .total-line {
      display: flex;
      justify-content: space-between;

      .total-label {
        font-size: 18px;
        font-weight: 800;
      }

      .total-amount {
        font-size: 28px;
        font-weight: 950;
        color: $brand-primary;
      }
    }
  }

  :where(.payment-methods) {
    margin-top: 24px;

    h4 {
      margin-bottom: 16px;
      font-weight: 700;
    }

    .payment-options {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .payment-method-content {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-radius: var(--global-border-radius);
        transition: all 0.3s;

        &:hover {
          background: rgba($brand-primary, 0.05);
        }

        .payment-icon {
          font-size: 24px;
        }

        .payment-name {
          font-weight: 600;
        }
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.qr-code-content {
  text-align: center;

  .qr-code-tip {
    margin-bottom: 24px;
    color: $text-sec;
  }

  .qr-code-image {
    margin-bottom: 24px;

    img {
      max-width: 240px;
      border-radius: var(--global-border-radius);
    }
  }
}

// 购买弹窗VIP权益列表
.vip-benefits-list {
  padding: 16px 0;
  border-top: var(--unified-border);
  border-bottom: var(--unified-border-bottom);
  margin: 16px 0;

  .benefit-check {
    padding: 8px 0;
    font-size: 14px;
    color: $text-sec;

    &.highlight {
      color: var(--el-color-danger);
      font-weight: 700;
    }
  }
}

// ============ 响应式设计 ============
@include bp.mobile-only {
  .container {
    padding: 0 24px;
  }

  .vip-hero {
    padding: 80px 0 60px;

    .hero-content {
      grid-template-columns: 1fr;
      text-align: center;
      gap: 48px;
    }

    .hero-badge {
      justify-content: center;
    }

    .hero-title {
      justify-content: center;
      font-size: 36px;
    }

    .hero-stats {
      justify-content: center;
      gap: 32px;
    }

    .hero-image {
      .vip-card {
        width: 100%;
        max-width: 320px;
        margin: 0 auto;
      }
    }
  }

  .benefits-grid {
    grid-template-columns: 1fr;
  }

  .pricing-cards {
    grid-template-columns: 1fr;

    .pricing-card.recommended {
      transform: none;
    }
  }

  .testimonials-grid {
    grid-template-columns: 1fr;
  }

  .cta-content {
    padding: 48px 24px ;

    .cta-actions {
      flex-direction: column;
    }
  }
}

@include bp.tablet-only {
  .vip-hero .hero-content {
    grid-template-columns: 1fr;
    text-align: center;

    .hero-stats {
      justify-content: center;
    }
  }

  .pricing-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
