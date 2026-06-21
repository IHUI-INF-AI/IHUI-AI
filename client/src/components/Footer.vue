<template>
  <footer class="footer-container" role="contentinfo" :aria-label="t('footer.acknowledgments')">
    <!-- 主内容区 -->
    <div class="footer-main">
      <!-- 左侧联系信息 -->
      <div class="left-section">
        <div class="contact-content">
          <h3 class="company-name">{{ t('footer.companyName') }}</h3>
          <ul class="contact-list">
            <li class="contact-item">
              <div class="address-block">
                <span class="address-line">{{ t('footer.addressLabel') }}{{ t('footer.addressLine1') }}</span>
                <span class="address-line"><span class="address-placeholder">{{ t('footer.addressLabel') }}</span>{{ t('footer.addressLine2') }}</span>
              </div>
            </li>
            <li class="contact-item">
              <span class="contact-label">{{ getSplit('footer.companyContact', 0) }}:</span>
              <span class="contact-value">{{ getSplit('footer.companyContact', 1) }}</span>
            </li>
            <li class="contact-item">
              <span class="contact-label">{{ getSplit('footer.companyEmail', 0) }}:</span>
              <div style="display: flex; flex-direction: column; align-items: flex-start">
                <span class="contact-value">{{ getSplit('footer.companyEmail', 1) }}</span>
                <span class="contact-value">{{ replaceAtSymbol(t('footer.companyEmail2')) }}</span>
              </div>
            </li>
          </ul>
          <div class="quick-links-row">
            <router-link to="/about" class="footer-link">{{ t('routes.about') }}</router-link>
            <router-link to="/support/document-center" class="footer-link">{{ t('routes.help') }}</router-link>
            <router-link to="/feedback" class="footer-link">{{ t('routes.feedback') }}</router-link>
          </div>
          <div class="quick-links-row">
            <router-link to="/privacy-policy" class="footer-link">
              {{ t('routes.privacyPolicy') }}
            </router-link>
            <router-link to="/terms-of-service" class="footer-link">
              {{ t('routes.termsOfService') }}
            </router-link>
            <router-link to="/user-agreement" class="footer-link">
              {{ t('routes.userAgreement') }}
            </router-link>
          </div>
        </div>
      </div>

      <!-- 中间支持平台和模型 -->
      <div class="platforms-container">
        <!-- 第一排：支持接入平台和云服务器 -->
        <div class="platform-row">
          <div class="platform-group">
            <h4 class="platform-title">{{ t('footer.supportedPlatforms') }}</h4>
            <div class="platform-icons">
              <div class="icon-button">
                <img
                  :src="'/footer/awsp/n8n.png'"
                  class="icon-bg"
                  alt="n8n"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/awsp/coze.png'"
                  class="icon-bg"
                  alt="ihui"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="platform-row">
          <div class="model-group">
            <h4 class="model-title">{{ t('footer.models') }}</h4>
            <div class="model-icons">
              <div class="icon-button">
                <img
                  :src="'/footer/model/2.png'"
                  class="icon-bg"
                  alt="model-2"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/model/3x.png'"
                  class="icon-bg"
                  alt="model-3x"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/model/4.png'"
                  class="icon-bg"
                  alt="model-4"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/model/5.png'"
                  class="icon-bg"
                  alt="model-5"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/model/6.png'"
                  class="icon-bg"
                  alt="model-6"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/model/7.png'"
                  class="icon-bg"
                  alt="model-7"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/model/8x.png'"
                  class="icon-bg"
                  alt="model-8x"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/model/9.png'"
                  class="icon-bg"
                  alt="model-9"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 第二排：支付平台和模型 -->
        <div class="platform-row">
          <div class="model-group">
            <h4 class="model-title">{{ t('footer.paymentPlatforms') }}</h4>
            <div class="model-icons">
              <div class="icon-button">
                <img
                  :src="'/footer/zf/DY.png'"
                  class="icon-bg"
                  alt="DY"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/zf/VISA.png'"
                  class="icon-bg"
                  alt="VISA"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/zf/YL.png'"
                  class="icon-bg"
                  alt="YL"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/zf/weixin@1x.png'"
                  class="icon-bg"
                  alt="weixin"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/zf/zfb.png'"
                  class="icon-bg"
                  alt="zfb"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
            </div>
          </div>

          <div class="model-group">
            <h4 class="model-title">{{ t('footer.cloudDatabases') }}</h4>
            <div class="model-icons">
              <div class="icon-button">
                <img
                  :src="'/footer/shujuku/1.png'"
                  class="icon-bg"
                  alt="shujuku-1"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/shujuku/2.png'"
                  class="icon-bg"
                  alt="shujuku-2"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/shujuku/3.png'"
                  class="icon-bg"
                  alt="shujuku-3"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/shujuku/4.png'"
                  class="icon-bg"
                  alt="shujuku-4"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div class="icon-button">
                <img
                  :src="'/footer/shujuku/5.png'"
                  class="icon-bg"
                  alt="shujuku-5"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧区域：小程序二维码和推广平台 -->
      <div class="right-section">
        <!-- 官方推广平台 -->
        <div class="promotion-section">
          <h4 class="promotion-title">{{ t('footer.officialPromotion') }}</h4>
          <div class="promotion-icons">
            <!-- 第一排：8个图标 -->
            <div class="promotion-row">
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(0)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/1.png'"
                    class="icon-bg"
                    alt="tgpt-1"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 0">
                  <img :src="promotionQrs[0]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(1)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/2.png'"
                    class="icon-bg"
                    alt="tgpt-2"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 1">
                  <img :src="promotionQrs[1]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(2)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/3.png'"
                    class="icon-bg"
                    alt="tgpt-3"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 2">
                  <img :src="promotionQrs[2]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(3)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/4.png'"
                    class="icon-bg"
                    alt="tgpt-4"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 3">
                  <img :src="promotionQrs[3]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(4)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/5.png'"
                    class="icon-bg"
                    alt="tgpt-5"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 4">
                  <img :src="promotionQrs[4]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(5)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/6.png'"
                    class="icon-bg"
                    alt="tgpt-6"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 5">
                  <img :src="promotionQrs[5]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(6)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/7.png'"
                    class="icon-bg"
                    alt="tgpt-7"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 6">
                  <img :src="promotionQrs[6]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button qr-left">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(7)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/8.png'"
                    class="icon-bg"
                    alt="tgpt-8"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 7">
                  <img :src="promotionQrs[7]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
            </div>

            <!-- 第二排：8个图标 -->
            <div class="promotion-row">
              <div class="icon-button">
                <a href="https://x.com/ok502319984" target="_blank" rel="noopener noreferrer" class="link-wrapper">
                  <img
                    :src="'/footer/tuiguangpingtai/9.png'"
                    class="icon-bg"
                    alt="tgpt-9"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </a>
              </div>
              <div class="icon-button">
                <a href="https://www.facebook.com/share/17kQMPNhQb/" target="_blank" rel="noopener noreferrer" class="link-wrapper">
                  <img
                    :src="'/footer/tuiguangpingtai/10.png'"
                    class="icon-bg"
                    alt="tgpt-10"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </a>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(10)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/11.png'"
                    class="icon-bg"
                    alt="tgpt-11"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 10">
                  <img :src="promotionQrs[10]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(11)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/12.png'"
                    class="icon-bg"
                    alt="tgpt-12"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 11">
                  <img :src="promotionQrs[11]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <a href="https://x.com/ok502319984" target="_blank" rel="noopener noreferrer" class="link-wrapper">
                  <img
                    :src="X_TWITTER_ICON"
                    class="icon-bg"
                    alt="tgpt-13"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </a>
              </div>
              <div class="icon-button">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(13)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/15.png'"
                    class="icon-bg"
                    alt="tgpt-15"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 13">
                  <img :src="promotionQrs[13]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
              <div class="icon-button">
                <a href="https://github.com/AIZHS2025" target="_blank" rel="noopener noreferrer" class="link-wrapper">
                  <img
                    :src="'/footer/tuiguangpingtai/16.png'"
                    class="icon-bg"
                    alt="tgpt-16"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </a>
              </div>
              <div class="icon-button qr-left">
                <div
                  class="img-wrapper"
                  @mouseenter="setPromotionHover(15)"
                  @mouseleave="clearPromotionHover"
                >
                  <img
                    :src="'/footer/tuiguangpingtai/14.png'"
                    class="icon-bg"
                    alt="tgpt-extra"
                    loading="lazy"
                    @error="handleImageError"
                  />
                </div>
                <div class="qr-popover" v-show="hoveredPromotionIndex === 15">
                  <img :src="promotionQrs[15]" class="qr-image" :alt="t('footer.officialPromotion')" @error="handleImageError" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：小程序二维码 -->
        <div class="qrcode-container">
          <div class="qrcode-section">
            <div class="qrcode-item">
              <div class="qrcode-text">{{ t('footer.officialApp') }}</div>
              <div
                class="qrcode-image-wrapper"
                @mouseenter="handleQrcodeMouseEnter"
                @mouseleave="handleQrcodeMouseLeave"
              >
                <img
                  :src="FOOTER_ICON_2"
                  class="qrcode-image"
                  :alt="t('footer.officialApp')"
                  fetchpriority="high"
                  @error="handleImageError"
                />
              </div>
            </div>
            <div class="qrcode-item">
              <div class="qrcode-text">{{ t('footer.contactUs') }}</div>
              <div
                class="qrcode-image-wrapper"
                @mouseenter="handleQrcodeMouseEnter"
                @mouseleave="handleQrcodeMouseLeave"
              >
                <img
                  :src="FOOTER_ICON_3"
                  class="qrcode-image"
                  :alt="t('footer.contactUs')"
                  fetchpriority="high"
                  @error="handleImageError"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 许可证信息 -->
      <div class="license-wrapper">
        <img
          :src="FOOTER_ICP_ICON"
          class="rectangle-1"
          :alt="t('footer.icp')"
          fetchpriority="high"
          @error="handleImageError"
        />
        <div class="text">{{ t('footer.icp') }}</div>
        <div class="text-1">{{ t('footer.copyright') }}</div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
// RouterLink 通过自动导入可用，无需显式导入
import './global.scss'
import { replaceAtSymbol } from '@/utils/stringUtils'
import X_TWITTER_ICON from '@/assets/x-twitter.svg'
import AI_DEFAULT_ICON from '@/assets/icons/common/ai_default.svg'
import EMPTY_ICON from '@/assets/icons/common/empty.svg'
import PROMOTION_QR_1 from '@/assets/promotion-qr-1.png'
import PROMOTION_QR_2 from '@/assets/promotion-qr-2.png'
import PROMOTION_QR_3 from '@/assets/promotion-qr-3.jpg'
import PROMOTION_QR_4 from '@/assets/promotion-qr-4.jpg'
import PROMOTION_QR_5 from '@/assets/promotion-qr-5.jpg'
import PROMOTION_QR_6 from '@/assets/promotion-qr-6.jpg'
import PROMOTION_QR_7 from '@/assets/promotion-qr-7.png'
import PROMOTION_QR_8 from '@/assets/promotion-qr-8.jpg'
import PROMOTION_QR_11 from '@/assets/promotion-qr-11.jpg'
import PROMOTION_QR_12 from '@/assets/promotion-qr-12.png'
import PROMOTION_QR_15 from '@/assets/promotion-qr-15.jpg'
const FOOTER_ICP_ICON: string = '/footer/erweima/footer-icon-1.png'
const FOOTER_ICON_2: string = '/footer/erweima/footer-icon-2.png'
const FOOTER_ICON_3: string = '/footer/erweima/footer-icon-3.png'
const fallbackIcon = AI_DEFAULT_ICON
const { t } = useI18n()
// 所有图标路径已统一使用打包资源或 /footer/ 开头的绝对路径，不再需要 BASE 变量
const promotionQrs: string[] = Array(16).fill(EMPTY_ICON)
promotionQrs[0] = PROMOTION_QR_1
promotionQrs[1] = PROMOTION_QR_2
promotionQrs[2] = PROMOTION_QR_3
promotionQrs[3] = PROMOTION_QR_4
promotionQrs[4] = PROMOTION_QR_5
promotionQrs[5] = PROMOTION_QR_6
promotionQrs[6] = PROMOTION_QR_7
promotionQrs[7] = PROMOTION_QR_8
promotionQrs[10] = PROMOTION_QR_11
promotionQrs[11] = PROMOTION_QR_12
promotionQrs[15] = PROMOTION_QR_15
import { ref } from 'vue'
const hoveredPromotionIndex = ref<number | null>(null)
const setPromotionHover = (idx: number) => {
  hoveredPromotionIndex.value = idx
}
const clearPromotionHover = () => {
  hoveredPromotionIndex.value = null
}

const getSplit = (key: string, index: number): string => {
  const v = t(key) as unknown
  const s = typeof v === 'string' ? v : ''
  const parts = s.split(':')

  if (index === 0) {
    return parts[0] ?? ''
  }

  if (index === 1) {
    return replaceAtSymbol(parts[1]?.split('|')[0] ?? '')
  }

  if (index === 2) {
    return replaceAtSymbol(parts[1]?.split('|')[1] ?? '')
  }

  return ''
}

// 图片加载错误处理
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (img && img.src !== fallbackIcon) {
    img.src = fallbackIcon
  }
}

// 为图标添加兜底，但不覆盖原始路径
const ensureIconPlaceholders = () => {
  const icons = document.querySelectorAll<HTMLImageElement>('.icon-bg')
  icons.forEach(icon => {
    icon.onerror = () => {
      icon.src = fallbackIcon
    }
  })
}

// 预加载关键图片（二维码等）
const preloadCriticalImages = () => {
  const urls = [FOOTER_ICP_ICON, FOOTER_ICON_2, FOOTER_ICON_3]
  urls.forEach(src => {
    const img = new Image()
    img.src = src
  })
}

// 二维码鼠标进入事件 - 空函数，不再需要遮罩层逻辑
const handleQrcodeMouseEnter = () => {
  // 不再需要遮罩层逻辑
}

// 二维码鼠标离开事件 - 空函数，不再需要遮罩层逻辑
const handleQrcodeMouseLeave = () => {
  // 不再需要遮罩层逻辑
}

// 组件挂载时预加载关键图片
onMounted(() => {
  preloadCriticalImages()
  ensureIconPlaceholders()
})
</script>

<style lang="scss" scoped>
// ============================================
// Footer 样式 - 使用 CSS 变量替代 
// ============================================

// 亮色模式：使用纯黑色背景
:global(html:not(.dark)) {
  --footer-background: var(--el-text-color-primary);
  --footer-text-color: var(--el-bg-color);
  --footer-text-secondary: var(--color-white-70);
  --footer-border-color: var(--color-white-10);
  --footer-qrcode-bg: var(--color-white-10);
}

// 暗色模式：使用纯黑色背景
:global(html.dark) {
  --footer-background: var(--el-text-color-primary);
  --footer-text-color: var(--el-bg-color);
  --footer-text-secondary: var(--color-white-70);
  --footer-border-color: var(--color-white-10);
  --footer-qrcode-bg: var(--color-white-10);
}

.footer-container {
  width: 100%;
  min-width: auto;
  height: auto;
  z-index: var(--z-modal);
  background-color: var(--footer-background);
  color: var(--footer-text-color);
  padding: 0;
  box-sizing: border-box;
  margin: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: visible;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background-color: var(--footer-background);
    z-index: -1;
    pointer-events: none;
  }
}

.footer-main {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  flex-wrap: wrap;
  padding: 0;
  margin: 0;
  width: 100%;
  min-width: auto;
  position: relative;
  z-index: var(--z-popover);
  overflow: visible; // 允许放大框完整显示
  height: 100%;
  max-height: 100vh;
  max-height: 100dvh;
  background-color: var(--footer-background);
}

/* 左侧区域 - 包含联系信息和快速链接 */
.left-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* 父容器内靠左 */
  justify-content: flex-start;
  width: auto;
  margin: 0;
  padding: 0;
  background-color: transparent;
  flex: 1 1 300px;
  max-height: 100%; /* 最大高度为父容器的100% */
}

/* 联系信息区域 */
.contact-section {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 100px;
  margin: 0;
  padding: 0;
  position: relative;
  z-index: calc(var(--z-base) + 4);
  background-color: transparent;
  flex: 0 0 auto;
}

.contact-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 10px 10px 0;
  padding-bottom: 0;
  text-align: left;
  margin-left: 0;
  width: fit-content;
  max-width: 100%;
  height: 100%;
  flex: 1 0 auto;
  font-size: 0;
  line-height: 0;
}

/* 保证最后一个子元素（第二行）无底部外边距，容器底部贴合 */
.contact-content > :last-child {
  margin-bottom: 0;
}

.contact-content .company-name {
  margin: 0 0 15px;
  text-align: left;
}

.contact-content .contact-list {
  display: block;
  margin: 0;
  padding: 0;
  max-width: 100%;
}

.contact-content .contact-item {
  margin-bottom: 0;
  justify-content: flex-start;
}

.company-name {
  font-family: var(--font-family-chinese);
  font-size: 20px;
  line-height: 36px;
  font-weight: 700;
  margin: 0 0 15px;
  padding: 0;
  color: var(--footer-text-color);
  text-align: left;
}

.contact-list {
  list-style: none;
  padding: 0;
  margin: 0 0 5px;
}

.contact-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 1px;
  text-align: left;
  justify-content: flex-start;
  font-family: var(--font-family-chinese);
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  color: var(--footer-text-color);
}

.contact-label {
  min-width: 30px;
  margin-right: 0;
  color: var(--footer-text-secondary);
}

.contact-value {
  font-size: 18px;
  display: inline-block;
  color: var(--footer-text-color);
  font-family: var(--font-family-chinese);
}

/* 地址块样式 */
.address-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.address-line {
  font-family: var(--font-family-chinese);
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  color: var(--footer-text-color);
  text-align: left;
}

.address-placeholder {
  visibility: hidden; /* 隐藏但保留宽度，确保精确对齐 */
}

.right-section {
  display: grid;
  grid-auto-rows: min-content;
  row-gap: 20px;
  place-items: center end; /* 垂直居中条目 */
  align-content: center; /* 居中整个轨道集合 */
  padding-right: 10px;
  padding-left: 10px;
  flex: 1 1 300px;
  height: auto;
  overflow: visible; /* 允许放大框完整显示 */
  max-height: 100%; /* 最大高度为父容器的100% */
}

.qrcode-container {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end; /* 靠右 */
  align-self: end; /* 在父级内右对齐 */
  margin: 0;
  padding: 0;
  width: fit-content;
  flex: 0 0 auto;
}

.qrcode-section {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 20px;
  margin: 0;
  padding: 0 5px;
  padding-left: 0;
  background-color: transparent;
  width: auto;
  min-width: auto;
  max-width: none;
  flex: 0 0 auto;
  overflow: visible;
}

.qrcode-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  flex: 0 0 auto;
  width: auto;
  position: relative;
  overflow: visible; /* 确保放大后的图片不被裁剪 */
}

.qrcode-text {
  font-family: var(--font-family-chinese);
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  margin-bottom: 2px;
  color: var(--footer-text-color);
  min-width: 0;
  position: relative;
  z-index: var(--z-base); /* 默认层级，确保在背景框下方 */
}

/* 当二维码 hover 时，降低文字的层级 */
.qrcode-item:hover .qrcode-text {
  z-index: var(--z-0); /* 降低层级，确保被黑色背景框遮挡 */
}

.qrcode-image-wrapper {
  position: relative;
  display: inline-block;
  width: 100px;
  height: 100px;
  z-index: calc(var(--z-base) + 9); /* 降低层级，避免覆盖开发工具选择层 */
  transition: transform 0.3s ease;
  transform-origin: center center; /* 设置变换原点为中心 */
  overflow: visible; /* 始终允许放大后的内容显示，不裁剪 */
}

/* 黑色背景框 - 在 hover 时显示，遮挡下方文字 */
.qrcode-image-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100px;
  height: 100px;
  background-color: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  opacity: 0;
  transition:
    transform 0.3s ease,
    border-radius 0.3s ease,
    opacity 0.3s ease;
  transform-origin: center center;
  z-index: var(--z-base); /* 在二维码图片下方，但在文字上方 */
  pointer-events: none;
}

.qrcode-image {
  width: 100px;
  height: 100px;
  object-fit: contain;
  display: block;
  position: relative;
  z-index: calc(var(--z-base) + 10); // 降低层级，避免覆盖开发工具选择层
  transition:
    transform 0.3s ease,
    border-radius 0.3s ease,
    box-shadow 0.3s ease;
  transform-origin: center center; /* 设置变换原点为中心 */
  border-radius: var(--global-border-radius); /* 默认圆角 */
  background-color: var(--el-text-color-primary);
}

/* 鼠标移入二维码时稍微放大并向上移动 */
.qrcode-image-wrapper:hover::before {
  transform: scale(1.2) translateY(-30px); /* 与二维码图片同步放大和移动 */
  border-radius: var(--global-border-radius); /* 与二维码图片圆角匹配 */
  opacity: 1; /* 显示黑色背景框 */
}

.qrcode-image-wrapper:hover .qrcode-image {
  transform: scale(1.2) translateY(-30px); /* 放大1.2倍并向上移动30px */
  border-radius: var(--global-border-radius); /* 放大后添加圆角 */
  box-shadow: var(--global-box-shadow); /* 使用全局投影 */
}

.qrcode-image-wrapper:hover {
  z-index: calc(var(--z-base) + 11); /* 适度提高层级 */
  overflow: visible; /* hover 时也保持 visible，不裁剪放大后的图片 */
}

/* 平台和模型区域 */
.platforms-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  width: auto;
  min-width: 300px;
  margin: 0 auto;
  flex: 1 1 300px;
  align-self: end; /* 让容器贴父级底部 */
  justify-content: flex-end; /* 容器内部内容向下对齐 */
  margin-top: auto; /* 在可用空间中将自身推到底部 */
  max-height: 100%; /* 最大高度为父容器的100% */
}

/* 行容器样式 */
.platform-row {
  display: flex;
  flex-direction: row;
  gap: 50px;
  justify-content: center;
  width: 100%;
}

.platform-group,
.model-group {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0;
  margin-bottom: 2px;
  position: relative;
  z-index: calc(var(--z-base) + 9);
  min-width: 100px;
}

.platform-title,
.model-title {
  font-family: var(--font-family-chinese);
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  margin: 0;
  text-align: left;
  color: var(--footer-text-color);
  white-space: nowrap;
  writing-mode: horizontal-tb;
  display: inline-block;
  width: auto;
  height: auto;
}

.promotion-title {
  font-family: var(--font-family-chinese);
  font-size: 18px;
  line-height: 32px;
  font-weight: 700;
  margin: 0 -10px 0 0;
  text-align: center;
  color: var(--footer-text-color);
  white-space: nowrap;
  writing-mode: horizontal-tb;
  display: inline-block;
  width: 100%;
  height: auto;
}

.platform-icons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 4px;
  margin: 0;
}

.promotion-icons {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-start;
  gap: 4px;
  margin: 0;
}

.model-icons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 4px;
  margin: 0;
  flex: 1;
}

/* 推广平台图标按钮样式 */
.promotion-section .icon-button {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

/* 通用图标按钮 */
.icon-button {
  width: 30px;
  height: 30px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  border-radius: var(--global-border-radius);
}

.icon-button:hover {
  background-color: transparent;
}

/* 图片包装器样式，适配横向长图片 */
.img-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--global-border-radius);
}

.icon-bg {
  width: 48px;
  height: 48px;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
  color: var(--el-text-color-primary);
}

/* 图标样式 */
.bxbxl-chrome,
.ant-designgoogle-outlined,
.frame-034-instagram,
.shape,
.vector-9,
.vector-10,
.vector-11,
.vector-12,
.vector-13,
.vector-14,
.docker,
.githab,
.vector-16,
.frame-17,
.group-10,
.group-11,
.vector-20,
.vector-21,
.vector-22,
.vector-23 {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
}

/* 推广平台区域 - 调整位置和样式 */
.promotion-section {
  width: auto;
  max-width: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  padding: 0;
  margin: 0;
  position: relative;
  z-index: calc(var(--z-base) + 49);
  background-color: transparent;
  flex: 0 0 auto;
  overflow: visible; /* 允许放大框完整显示 */
}

/* 推广平台图标容器样式 */
.promotion-icons {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  width: auto;
  margin: 0;
  overflow: visible; /* 允许放大框完整显示 */
}

/* 推广平台行样式 - 每行展示3个图标 */
.promotion-row {
  display: flex;
  justify-content: flex-start;
  width: auto;
  gap: 6px;
  margin-bottom: 0;
  overflow: visible; /* 允许放大框完整显示 */
}

/* 图标按钮样式，确保大小合适 */
.promotion-section .icon-button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  overflow: visible; /* 确保放大框不被裁剪 */
  position: relative;
  z-index: calc(var(--z-base) + 49); /* 基础层级 */
}

/* 保证悬浮时弹窗层级足够高 */
.promotion-section .icon-button:hover {
  z-index: var(--z-loading); /* hover 时提高到最高层级 */
}

/* 推广平台图片包装器样式 */
.promotion-section .img-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--global-border-radius);
}

.link-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--global-border-radius);
}

.qr-popover {
  position: absolute;
  top: -200px; /* 向上弹出，在图标上方 */
  left: -75px;
  width: 180px;
  height: 180px;
  background-color: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  z-index: var(--z-notification); /* 最高层级，确保在 footer 外显示 */
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

/* 右侧图标的悬浮窗向左移动，避免被屏幕裁切 */
.icon-button.qr-left .qr-popover {
  left: -140px;
}

.qr-image {
  width: 168px;
  height: 168px;
  object-fit: contain;
  border-radius: var(--global-border-radius);
}

/* 快速链接区域 - 放在联系信息下面 */
.quick-links-wrapper {
  display: flex;
  justify-content: flex-start; /* 父容器内靠左 */
  align-items: flex-start;
  width: 100%;
  margin-top: 0;
  margin-bottom: 0;
  padding: 0 10px;
  z-index: calc(var(--z-base) + 19);
  position: relative;
  flex: 0 0 auto;
  align-self: flex-start;
}

.quick-links {
  display: flex;
  flex-direction: column;
  gap: 0;
  justify-content: flex-start; /* 内容靠左 */
  align-items: flex-start;
  padding: 0;
  width: 100%;
  max-width: 100%;
}

.quick-links-row {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  width: 200px;
  margin-left: 68px;
  margin-top: 0;
  height: 14px;
  font-weight: 700;
  line-height: 0;
  padding-bottom: 0;
  margin-bottom: 0;
}

/* 第一行与公司信息之间保留 20px 下移 */
.contact-content .quick-links-row:first-of-type {
  margin-top: auto;
}

/* 两行之间的间距为 8px */
.quick-links-row + .quick-links-row {
  margin-top: 6px;
}

.footer-link {
  color: var(--footer-text-secondary);
  font-family: var(--font-family-chinese);
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.3s ease;
  white-space: nowrap;
  position: relative;
  padding: 0;
  display: inline-block;
  height: 14px;
  vertical-align: middle;
  text-align: center;
  width: 60px;

  &:hover {
    color: var(--footer-text-color);
    background-color: var(--el-fill-color-light);
  }

  &:focus {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  &.router-link-active {
    color: var(--footer-text-color);
    font-weight: 700;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: var(--footer-text-color);
      border-radius: var(--global-border-radius);
    }
  }
}

/* 许可证和版权信息 */
.license-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 0;
  border-radius: var(--global-border-radius);
  position: relative;
  background-color: transparent;
  border: none;
  width: 100%;
  margin-top: 0;
  order: 5; /* 确保它在最后显示 */
  z-index: var(--z-popover);

  .rectangle-1 {
    width: 14px;
    height: 13px;
    object-fit: cover;
    margin-right: 4px;
  }

  .text {
    white-space: nowrap;
    color: var(--footer-text-secondary);
    font-family: var(--font-family-chinese);
    font-size: 12px;
    line-height: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin-right: 4px;
  }

  .text-1 {
    white-space: nowrap;
    color: var(--footer-text-secondary);
    font-family: var(--font-family-chinese);
    font-size: 12px;
    line-height: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin-top: 0;
  }
}

/* 响应式设计 */
@media (width <= 600px) {
  .footer-container {
    min-width: auto;
    padding: 0;
    max-height: none;
  }

  .footer-main {
    flex-direction: column;
    align-items: center;
    gap: 5px;
    margin-bottom: 0;
    margin-top: 0;
    padding: 5px;
  }

  .contact-section {
    width: 100%;
    min-width: auto;
    max-width: 100%;
  }

  .platform-group {
    width: 100%;
    max-width: 100%;
  }

  .right-section {
    width: 100%;
    flex-direction: column;
    align-items: center;
  }

  .promotion-section {
    width: 100%;
    max-width: 100%;
    position: static;
    right: auto;
    top: auto;
    margin-top: 5px;
  }

  .qrcode-section {
    justify-content: center;
    max-width: 100%;
    padding: 0 5px;
    gap: 5px;
  }

  .qrcode-image-wrapper {
    width: 60px;
    height: 60px;
  }

  .qrcode-image {
    width: 60px;
    height: 60px;
    max-height: 60px;
  }

  .qrcode-text {
    font-size: 12px;
    line-height: 16px;
  }

  .company-name,
  .contact-item,
  .contact-value,
  .platform-title,
  .model-title,
  .promotion-title {
    font-size: 12px;
    line-height: 16px;
  }

  .quick-links {
    gap: 12px;
  }

  .footer-link {
    font-size: 12px;
  }
}

@media (width <= 768px) {
  .footer-container {
    padding: 0;
    max-height: 350px;
  }

  .company-name {
    font-size: 14px;
    line-height: 20px;
  }

  .qrcode-text {
    font-size: 14px;
    line-height: 20px;
  }

  .qrcode-image-wrapper {
    width: 50px;
    height: 50px;
  }

  .qrcode-image {
    width: 50px;
    height: 50px;
    max-height: 50px;
  }

  .icon-button {
    width: 22px;
    height: 22px;
  }

  /* 小屏幕设备上调整.right-section的布局 */
  .right-section {
    width: 100%;
    flex-direction: column;
    align-items: center;
  }

  /* 小屏幕设备上调整.promotion-section的布局 */
  .promotion-section {
    position: static;
    right: auto;
    transform: none;
    top: auto;
    margin-top: 5px;
    width: 100%;
    max-width: 100%;
  }

  .contact-item,
  .contact-value,
  .platform-title,
  .model-title,
  .promotion-title {
    font-size: 14px;
    line-height: 20px;
  }

  .quick-links {
    gap: 15px;
  }

  .footer-link {
    font-size: 13px;
  }
}
</style>
