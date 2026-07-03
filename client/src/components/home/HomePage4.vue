<!-- 首页第四页 -->
<template>
  <main ref="pageSlideRef" id="fourth-page" class="page-section page-slide">
    <div class="pricing-header">
      <h1 class="pricing-title">{{ title || t('home.page4.title') }}</h1>
      <h2 class="pricing-title-english font-edix">{{ titleEn || t('home.page4.titleEn') }}</h2>
      <p class="pricing-subtitle">{{ content || t('home.page4.subtitle') }}</p>
    </div>

    <div class="pricing-cards-container">
      <div
        v-for="plan in pricingPlans"
        :key="plan.id"
        class="card pricing-card"
        @click="handleCardClick(plan)"
      >
        <div class="card-content">
          <div class="plan-name">{{ plan.name }}</div>
          <div class="plan-description">{{ plan.description }}</div>
          <div class="plan-price">
            <span class="price-symbol">¥</span>
            <span class="price-amount">{{ getCurrentPrice(plan) }}</span>
            <span class="price-period">{{ t('homePage4.month') }}</span>
          </div>
          <div v-if="plan.recommended" class="recommended-badge">{{ t('homePage4.recommended') }}</div>
          <div class="plan-features">
            <div
              v-for="(category, categoryIndex) in plan.features"
              :key="categoryIndex"
              class="feature-category"
            >
              <div class="category-name">{{ category.name }}</div>
              <ul class="feature-list">
                <li v-for="(feature, featureIndex) in category.items" :key="featureIndex">
                  {{ feature }}
                </li>
              </ul>
            </div>
          </div>
          <button
            :class="['subscribe-button', `subscribe-button-${plan.id}`]"
            @click.stop="handleSubscribe(plan)"
          >{{ t('homePage4.subscribe') }}</button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref, computed } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { useVipPricing, type PricingPlan } from '@/composables/vip/useVipPricing'

defineOptions({
  name: 'HomePage4',
  inheritAttrs: false,
})

interface Props {
  title?: string
  titleEn?: string
  content?: string
}

const _props = defineProps<Props>()
const pageSlideRef = ref<HTMLElement | null>(null)
const router = useRouter()

// 使用VIP定价数据
const { pricingPlans: basePricingPlans, getCurrentPrice } = useVipPricing()

// 扩展套餐列表，确保始终显示4个卡片
const pricingPlans = computed(() => {
  const plans = [...basePricingPlans.value]
  
  // 如果套餐数量少于4个，添加默认套餐直到有4个
  while (plans.length < 4) {
    if (plans.length === 2) {
      // 添加第3个套餐：专业版
      plans.push({
        id: 3,
        name: t('homePage4.proPlanName'),
        description: t('homePage4.proPlanDesc'),
        monthlyPrice: 199,
        yearlyPrice: 1990,
        yearlyDiscount: true,
        recommended: false,
        features: [
          {
            name: t('homePage4.proFeaturesTitle'),
            items: [t('homePage4.unlimitedAiChat'), t('homePage4.imageGeneration'), t('homePage4.videoGeneration'), t('homePage4.voiceInput'), t('homePage4.fileUpload'), t('homePage4.history90Days'), t('homePage4.dedicatedSupport'), t('homePage4.priorityResponse'), t('homePage4.advancedModelAccess')],
          },
          {
            name: t('homePage4.proToolPermissionsTitle'),
            items: [t('homePage4.aiTools150'), t('homePage4.proTemplates'), t('homePage4.largeFileUpload'), t('homePage4.apiAccess'), t('homePage4.dataExport'), t('homePage4.teamCollaboration')],
          },
          {
            name: t('homePage4.proPrivilegesTitle'),
            items: [t('homePage4.earlyAccessNewFeatures'), t('homePage4.dedicatedTechSupport'), t('homePage4.customConfig'), t('homePage4.advancedDataAnalysis')],
          },
        ],
      })
    } else if (plans.length === 3) {
      // 添加第4个套餐：旗舰版
      plans.push({
        id: 4,
        name: t('homePage4.flagshipPlanName'),
        description: t('homePage4.flagshipPlanDesc'),
        monthlyPrice: 499,
        yearlyPrice: 4990,
        yearlyDiscount: true,
        recommended: false,
        features: [
          {
            name: t('homePage4.flagshipFeaturesTitle'),
            items: [t('homePage4.unlimitedTokens'), t('homePage4.allModelAccess'), t('homePage4.fastResponse'), t('homePage4.dedicatedVipSupport')],
          },
          {
            name: t('homePage4.flagshipToolPermissionsTitle'),
            items: [t('homePage4.allAiTools'), t('homePage4.flagshipTemplates'), t('homePage4.hugeFileUpload'), t('homePage4.permanentHistory')],
          },
          {
            name: t('homePage4.flagshipPrivilegesTitle'),
            items: [t('homePage4.earlyAccessNewFeatures'), t('homePage4.dedicatedTechConsultant'), t('homePage4.customDevelopment'), t('homePage4.advancedDataExport')],
          },
          {
            name: t('homePage4.dedicatedServiceTitle'),
            items: [t('homePage4.oneOnOneTechSupport'), t('homePage4.dedicatedTraining'), t('homePage4.regularUpdates'), t('homePage4.priorityIssueHandling')],
          },
        ],
      })
    } else {
      // 如果已经有4个或更多，跳出循环
      break
    }
  }
  
  // 确保最多只返回4个套餐
  return plans.slice(0, 4)
})

// 处理卡片点击
const handleCardClick = (_plan: PricingPlan) => {
  // 点击卡片时跳转到VIP页面
  router.push('/vip')
}

// 处理开通按钮点击
const handleSubscribe = (plan: PricingPlan, event?: MouseEvent) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  // 跳转到VIP购买页面，并传递选中的套餐信息
   
  router.push({ path: '/vip', query: { planId: plan.id.toString() } } as RouteLocationRaw)
}

defineExpose({
  $el: pageSlideRef,
})
</script>

<style scoped lang="scss">
/* 第四页主容器样式 */

/* 定价卡片 hover/active 状态描边样式 */
@mixin pricing-card-border-hover {
  html:not(.dark) & {
    border: 2.5px solid var(--border-unified-color);
  }
  
  html.dark & {
    border: 2.5px solid var(--border-unified-color);
  }
}

@mixin pricing-card-border-active {
  html:not(.dark) & {
    border: 2.5px solid var(--border-unified-color);
  }
  
  html.dark & {
    border: 2.5px solid var(--border-unified-color);
  }
}

#fourth-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: clamp(80px, 12vh, 140px) clamp(2px, 0.5vw, 12px) clamp(40px, 6vh, 60px);
  text-align: center;
  width: 100%;
  max-width: 100vw;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.pricing-header {
  margin-bottom: clamp(20px, 3vh, 40px);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: transparent;
  padding: 0 clamp(2px, 0.5vw, 12px);

  .pricing-title {
    font-size: clamp(24px, 3.5vw, 36px);
    font-weight: 700;
    margin: 0;
    margin-bottom: clamp(2px, 0.3vh, 4px);
    color: var(--el-text-color-primary);
    background: transparent;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0;
  }

  .pricing-title-english,
  h2.pricing-title-english,
  h2.pricing-title-english.font-edix,
  :where(.pricing-header) .pricing-title-english,
  :where(.pricing-header) h2.pricing-title-english,
  :where(.pricing-header) h2.pricing-title-english.font-edix {
    margin: 0;
    margin-bottom: clamp(12px, 2vh, 20px);
    text-align: center;
    font-size: clamp(16px, 1.8vw, 22px);
    line-height: 1.4;
    font-weight: 300;
    letter-spacing: 0.03em;
    opacity: 0.75;
  }

  h2.pricing-title-english.font-edix {
    font-family: EDIX, sans-serif;
  }

  html:not(.dark) .pricing-title-english,
  html:not(.dark) #fourth-page .pricing-title-english,
  html:not(.dark) h2.pricing-title-english {
    color: var(--el-text-color-placeholder);
  }

  html.dark .pricing-title-english,
  html.dark #fourth-page .pricing-title-english,
  html.dark h2.pricing-title-english {
    color: var(--color-white-50);
  }

  .pricing-subtitle {
    font-size: clamp(14px, 1.8vw, 18px);
    color: var(--el-text-color-secondary);
    max-width: 800px;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }
}

.pricing-cards-container {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  width: 100%;
  max-width: min(1460px, 100%);
  min-width: 0;
  padding: 8px;
  margin: 0 auto clamp(30px, 4vh, 50px);
  box-sizing: border-box;
  overflow: hidden;
  height: auto;
  min-height: auto;
  max-height: none;
  align-items: stretch;
  position: relative;
  contain: none;

  @media (width >= 1200px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
    padding: 8px;
    max-width: min(1460px, 100%);
  }

  @media (width <= 1199px) and (width >= 992px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
    padding: 8px;
    max-width: min(1260px, 100%);
  }

  @media (width <= 991px) and (width >= 768px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
    padding: 8px;
    max-width: 100%;
  }

  @media (width <= 767px) and (width >= 480px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    padding: 8px;
    max-width: 100%;
  }

  @media (width <= 479px) {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 8px;
    max-width: 100%;
  }
}

.card {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  min-height: 100%;
  border-radius: var(--global-border-radius);
  text-align: center;
  cursor: pointer;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: stretch;
  justify-content: center;
  user-select: none;
  font-weight: bolder;
  color: var(--el-text-color-primary);
  position: relative;
  margin: 0;
  padding: 0;
  overflow: hidden visible;
  isolation: isolate;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);

  &:nth-child(1) {
    background: var(--color-white-70);
    border: 2.5px solid var(--border-unified-color);
    box-shadow: none;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    transform: translateZ(0);

    html.dark & {
      background: var(--color-dark-1e283c-60);
      border: 2.5px solid var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html.dark &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &.selected,
    html:not(.dark) &.active {
      border-color: var(--border-unified-color);
    }

    html.dark &.selected,
    html.dark &.active {
      border-color: var(--border-unified-color);
    }
  }

  &:nth-child(2) {
    background: var(--color-white-75);
    border: 2.5px solid var(--border-unified-color);
    box-shadow: none;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    transform: translateZ(0);

    html.dark & {
      background: var(--color-dark-231e32-65);
      border: 2.5px solid var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html.dark &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &.selected,
    html:not(.dark) &.active {
      border-color: var(--border-unified-color);
    }

    html.dark &.selected,
    html.dark &.active {
      border-color: var(--border-unified-color);
    }
  }

  &:nth-child(3) {
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);

    html:not(.dark) & {
      background: var(--color-blue-f0f5ff-90);
      border: 2.5px solid var(--border-unified-color);
      box-shadow: none;

      .plan-name,
      .plan-description,
      .category-name,
      .feature-list li {
        color: var(--el-text-color-primary);
      }
    }

    html.dark & {
      background: var(--color-dark-23232d-75);
      border: 2.5px solid var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html.dark &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &.selected,
    html:not(.dark) &.active {
      border-color: var(--border-unified-color);
    }

    html.dark &.selected,
    html.dark &.active {
      border-color: var(--border-unified-color);
    }
  }

  &:nth-child(4) {
    background: var(--color-white-80);
    border: 2.5px solid var(--border-unified-color);
    box-shadow: none;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);

    html.dark & {
      background: var(--color-dark-28231e-70);
      border: 2.5px solid var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html.dark &:hover {
      border-color: var(--border-unified-color);
      box-shadow: none;
    }

    html:not(.dark) &.selected,
    html:not(.dark) &.active {
      border-color: var(--border-unified-color);
    }

    html.dark &.selected,
    html.dark &.active {
      border-color: var(--border-unified-color);
    }
  }

  &:active {
    transform: scale(0.99) translateZ(0);
  }
}

.card-content {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 100%;
  padding: clamp(10px, 1.4vw, 16px) clamp(4px, 0.6vw, 10px) clamp(10px, 1.4vw, 16px) clamp(20px, 2.5vw, 32px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(4px, 0.6vw, 8px);
  position: relative;
  z-index: calc(var(--z-base) + 1);
  box-sizing: border-box;
  border-radius: var(--global-border-radius);
  overflow: hidden visible;
}

.plan-name {
  font-size: clamp(18px, 2.3vw, 26px);
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 4px;
  line-height: 1.2;
  letter-spacing: 0.3px;
  flex-shrink: 0;
  position: relative;
}

/* 专业版和旗舰版的标题特殊效果 */
.card:nth-child(2) .plan-name {
  color: var(--el-text-color-primary);
}

.card:nth-child(4) .plan-name {
  color: var(--el-color-warning);
}

.plan-description {
  font-size: clamp(13px, 1.5vw, 17px);
  color: var(--el-text-color-secondary);
  margin: 0 0 6px;
  font-weight: normal;
  line-height: 1.4;
  flex-shrink: 0;
}

.plan-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin: 0 0 8px;
  padding: 6px 0;
  flex-shrink: 0;
  position: relative;
  
  /* 添加微妙的背景分隔 */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    background: var(--color-black-8);
    
    html.dark & {
      background: var(--color-white-8);
    }
  }

  .price-symbol {
    font-size: clamp(18px, 2vw, 24px);
    font-weight: 600;
    color: var(--el-text-color-primary);
    align-self: flex-start;
    margin-top: 2px;
  }

  .price-amount {
    font-size: clamp(32px, 4vw, 48px);
    font-weight: 700;
    color: var(--el-text-color-primary);
    line-height: 1;
    letter-spacing: -0.5px;
  }

  .price-period {
    font-size: clamp(14px, 1.6vw, 18px);
    color: var(--el-text-color-secondary);
    font-weight: normal;
    align-self: flex-end;
    margin-bottom: 2px;
  }
}

/* 基础版价格样式 - 清新蓝色 */
:where(.card:nth-child(1)) .plan-price {
  .price-amount {
    color: var(--el-text-color-primary);
  }

  .price-symbol {
    color: var(--color-sky-87cefa-80);
  }
}

/* 专业版价格样式 - 紫色 */
:where(.card:nth-child(2)) .plan-price {
  .price-amount {
    color: var(--el-text-color-primary);
  }

  .price-symbol {
    :where(html:not(.dark)) & {
      color: var(--el-text-color-primary);
      opacity: 0.9;
    }

    :where(html.dark) & {
      color: var(--el-text-color-primary);
      opacity: 0.9;
    }
  }
}

/* 企业版价格样式 - 优雅深蓝 */
:where(.card:nth-child(3)) .plan-price {
  .price-amount {
    color: var(--el-text-color-primary);

    /* 明亮模式下使用深蓝色 */
    :where(html:not(.dark)) & {
      color: var(--el-color-primary);
    }
  }

  .price-symbol {
    color: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.8);

    :where(html.dark) & {
      color: var(--color-gray-dcdce6-90);
    }
  }
}

/* 旗舰版价格样式 - 金色 */
:where(.card:nth-child(4)) .plan-price {
  .price-amount {
    color: var(--el-color-warning);
  }

  .price-symbol {
    :where(html:not(.dark)) & {
      color: var(--el-color-warning);
      opacity: 0.9;
    }

    :where(html.dark) & {
      color: var(--el-text-color-primary);
      opacity: 0.9;
    }
  }
}

.recommended-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--el-text-color-primary);
  color: var(--app-button-text-on-primary);
  padding: 5px 12px;
  border-radius: var(--global-border-radius);
  font-size: clamp(12px, 1.3vw, 15px);
  font-weight: 600;
  z-index: calc(var(--z-base) + 9);
  line-height: 1.3;
  box-shadow: none;
  letter-spacing: 0.3px;

  /* 暗色主题适配 */
  html.dark & {
    background: var(--color-black-95);
    color: var(--el-text-color-primary);
    box-shadow: none;
  }
}

.plan-features {
  width: 100%;
  text-align: left;
  margin: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden visible;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: clamp(8px, 1vw, 12px);
  align-content: start;

  .feature-category {
    margin-bottom: 0;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;

    .category-name {
      font-size: clamp(12px, 1.4vw, 15px);
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin: 0 0 4px;
      line-height: 1.3;
      padding-bottom: 0;
      border-bottom: none;
      flex-shrink: 0;
      letter-spacing: 0.1px;
    }

      .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: visible;

      li {
        font-size: clamp(12px, 1.2vw, 14px);
        color: var(--el-text-color-secondary);
        margin: 0;
        padding-left: 22px;
        position: relative;
        font-weight: normal;
        line-height: 1.5;
        flex-shrink: 0;
        overflow: visible;
        word-wrap: break-word;
        word-break: break-word;
      }

      li::before {
        content: "\2713";
        position: absolute;
        left: 0;
        top: 1px;
        color: var(--el-text-color-primary);
        font-weight: bold;
        font-size: clamp(12px, 1.3vw, 15px);
        line-height: 1;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
    }
  }

  /* 当功能分类数量为奇数时，最后一个占满整行 */
  .feature-category:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  /* 响应式：小屏幕时单列显示 */
  @media (width <= 991px) {
    grid-template-columns: 1fr;
    gap: clamp(12px, 1.5vw, 18px);
  }
}

.subscribe-button {
  width: 100%;
  padding: clamp(7px, 1vw, 10px) clamp(16px, 2vw, 24px);
  border: none;
  border-radius: var(--global-border-radius);
  font-size: clamp(13px, 1.5vw, 17px);
  font-weight: 600;
  cursor: pointer;
  margin-top: auto;
  letter-spacing: 0.3px;
  flex-shrink: 0;
  background: var(--el-text-color-primary);
  color: var(--app-button-text-on-primary);

  html.dark & {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
  }
}


/* 响应式字体和间距调整 */
@media (width <= 1199px) {
  .card-content {
    padding: clamp(10px, 1.4vw, 16px) clamp(8px, 1.2vw, 14px) clamp(10px, 1.4vw, 16px) clamp(18px, 2.2vw, 28px);
  }
  
  .plan-features .feature-category {
    margin-bottom: 6px;
    
    .category-name {
      margin-bottom: 3px;
      padding-bottom: 2px;
    }
    
    .feature-list li {
      margin-bottom: 2px;
    }
  }
}

@media (width <= 767px) {
  #fourth-page {
    padding: 60px 8px 30px;
  }

  .pricing-header {
    margin-bottom: 24px;

    .pricing-title {
      font-size: clamp(20px, 5vw, 28px);
    }

    .pricing-subtitle {
      font-size: clamp(12px, 3vw, 16px);
    }
  }

  .pricing-cards-container {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 8px;
  }

  .card-content {
    padding: 16px;
  }

  .plan-name {
    font-size: 20px;
  }

  .plan-price {
    .price-amount {
      font-size: 32px;
    }

    .price-symbol {
      font-size: 18px;
    }
  }

  .plan-features {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .subscribe-button {
    padding: 10px 20px;
    font-size: 15px;
  }
}
</style>
