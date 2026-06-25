<template>
  <div class="share-page">
    <!-- 深度背景系统 -->
    <div class="share-page__background">
      <div class="share-page__glow share-page__glow--1"></div>
      <div class="share-page__glow share-page__glow--2"></div>
      <div class="share-page__glow share-page__glow--3"></div>
    </div>

    <!-- 页面头部 -->
    <div class="share-page__header glass-card scroll-reveal">
      <button class="share-page__back-btn ripple-btn" :aria-label="t('common.back')" @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <h1 class="share-page__title">{{ t('share.title') }}</h1>
      <div class="share-page__header-accent"></div>
    </div>

    <div class="share-page__content">
      <!-- 预览卡片 -->
      <div class="share-preview glass-card scroll-reveal" style="

--reveal-delay: 0.1s">
        <div class="share-preview__card">
          <div class="share-preview__image">
            <img :src="shareData.image || defaultImage" alt="Share Preview" loading="lazy" />
            <div class="share-preview__image-overlay"></div>
          </div>
          <div class="share-preview__info">
            <h3 class="share-preview__title">{{ shareData.title }}</h3>
            <p class="share-preview__description">{{ shareData.description }}</p>
            <div class="share-preview__meta">
              <span class="share-preview__meta-item">
                <el-icon><User /></el-icon>
                {{ shareData.author }}
              </span>
              <span class="share-preview__meta-item">
                <el-icon><View /></el-icon>
                {{ shareData.views }}
              </span>
              <span class="share-preview__meta-item">
                <el-icon><Star /></el-icon>
                {{ shareData.likes }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 分享平台选择 -->
      <div class="share-options glass-card scroll-reveal" style="

--reveal-delay: 0.2s">
        <h3 class="share-options__title">
          <span class="share-options__title-text">{{ t('share.shareTo') }}</span>
          <span class="share-options__title-line"></span>
        </h3>
        <div class="share-options__grid">
          <button
            v-for="platform in platforms"
            :key="platform.id"
            class="share-options__platform ripple-btn"
            @click="shareToPlatform(platform.id)"
          >
            <div class="share-options__platform-icon" :style="{ '--platform-color': platform.color }">
              <el-icon :size="24">
                <component :is="platform.icon" />
              </el-icon>
            </div>
            <span class="share-options__platform-name">{{ platform.name }}</span>
            <div class="share-options__platform-glow"></div>
          </button>
        </div>
      </div>

      <!-- 操作按钮组 -->
      <div class="share-actions scroll-reveal" style="

--reveal-delay: 0.3s">
        <button class="share-actions__btn share-actions__btn--primary ripple-btn" @click="copyLink">
          <el-icon><Link /></el-icon>
          <span>{{ t('share.copyLink') }}</span>
          <div class="share-actions__btn-shine"></div>
        </button>
        <button class="share-actions__btn ripple-btn" @click="generateQRCode">
          <el-icon><View /></el-icon>
          <span>{{ t('share.qrCode') }}</span>
        </button>
        <button class="share-actions__btn ripple-btn" @click="downloadImage">
          <el-icon><Download /></el-icon>
          <span>{{ t('share.downloadImage') }}</span>
        </button>
      </div>

      <!-- 分享统计 -->
      <div class="share-stats glass-card scroll-reveal" style="

--reveal-delay: 0.4s" v-loading="loadingStats">
        <div class="share-stats__header">
          <span class="share-stats__header-text">{{ t('share.stats') }}</span>
          <div class="share-stats__header-indicator"></div>
        </div>
        <div class="share-stats__content">
          <div class="share-stats__item">
            <span class="share-stats__label">{{ t('share.totalShares') }}</span>
            <span class="share-stats__value">{{ shareStats.totalShares }}</span>
          </div>
          <div class="share-stats__item">
            <span class="share-stats__label">{{ t('share.currentShares') }}</span>
            <span class="share-stats__value">{{ shareStats.shareCount }}</span>
          </div>
          <div v-if="shareStats.shareSources && Object.keys(shareStats.shareSources).length > 0" class="share-stats__sources">
            <div class="share-stats__label">{{ t('share.shareSources') }}</div>
            <div class="share-stats__sources-list">
              <span
                v-for="(count, source) in shareStats.shareSources"
                :key="source"
                class="share-stats__source-tag"
              >
                {{ source }}: {{ count }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 分享设置 -->
      <div class="share-settings glass-card scroll-reveal" style="

--reveal-delay: 0.5s">
        <h3 class="share-settings__title">
          <span class="share-settings__title-text">{{ t('share.shareSettings') }}</span>
          <span class="share-settings__title-line"></span>
        </h3>
        <el-form :model="shareSettings" label-width="120px" class="share-settings__form">
          <el-form-item :label="t('share.customTitle')">
            <el-input
              v-model="shareSettings.customTitle"
              :placeholder="t('share.customTitlePlaceholder')"
              class="share-settings__input"
            />
          </el-form-item>
          <el-form-item :label="t('share.customDesc')">
            <el-input
              v-model="shareSettings.customDesc"
              type="textarea"
              :rows="3"
              :placeholder="t('share.customDescPlaceholder')"
              class="share-settings__input"
            />
          </el-form-item>
          <el-form-item :label="t('share.shareType')">
            <el-radio-group v-model="shareSettings.shareType" class="share-settings__radio-group">
              <el-radio value="public">{{ t('share.public') }}</el-radio>
              <el-radio value="private">{{ t('share.private') }}</el-radio>
              <el-radio value="password">{{ t('share.password') }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="shareSettings.shareType === 'password'" :label="t('share.password')">
            <el-input v-model="shareSettings.password" type="password" show-password class="share-settings__input" />
          </el-form-item>
          <el-form-item :label="t('share.expireTime')">
            <el-select v-model="shareSettings.expireTime" :placeholder="t('share.selectExpire')" class="share-settings__select">
              <el-option :label="t('share.neverExpire')" value="never" />
              <el-option :label="t('share.oneDay')" value="1d" />
              <el-option :label="t('share.oneWeek')" value="7d" />
              <el-option :label="t('share.oneMonth')" value="30d" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- QR码弹窗 -->
    <el-dialog v-model="qrCodeVisible" :title="t('share.qrCode')" width="400px" center class="share-qr-dialog">
      <div class="share-qr__container">
        <div class="share-qr__code">
          <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="QR Code" style="width: 100%; height: 100%;" />
        </div>
        <p class="share-qr__tip">{{ t('share.scanQRCode') }}</p>
      </div>
      <template #footer>
        <button class="share-actions__btn ripple-btn" @click="qrCodeVisible = false">{{ t('common.close') }}</button>
        <button class="share-actions__btn share-actions__btn--primary ripple-btn" @click="downloadQRCode">
          {{ t('share.downloadQRCode') }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import {
  ArrowLeft,
  User,
  View,
  Star,
  Link,
  Download,
  ChatDotRound,
  Share,
  Message,
  Picture,
} from '@element-plus/icons-vue'

const { t } = useI18n()
const route = useRoute()

const defaultImage = '/images/common/empty.svg'

const shareData = reactive({
  title: t('share.defaultTitle'),
  description: t('share.defaultDescription'),
  image: '',
  author: t('share.defaultAuthor'),
  views: 1234,
  likes: 567,
})

const shareSettings = reactive({
  customTitle: '',
  customDesc: '',
  shareType: 'public',
  password: '',
  expireTime: 'never',
})

const platforms = [
  { id: 'wechat', name: t('share.wechat'), icon: ChatDotRound, color: 'var(--social-wechat)' },
  { id: 'weibo', name: t('share.weibo'), icon: Share, color: 'var(--social-weibo)' },
  { id: 'qq', name: t('share.qq'), icon: Message, color: 'var(--social-qq)' },
  { id: 'douyin', name: t('share.douyin'), icon: Picture, color: 'var(--el-text-color-primary)' },
  { id: 'link', name: t('share.copyLink'), icon: Link, color: 'var(--el-text-color-primary)' },
]

const qrCodeVisible = ref(false)
const qrCodeDataUrl = ref('')
const shareStats = ref<{
  totalShares: number
  shareSources: Record<string, number>
  shareCount: number
}>({
  totalShares: 0,
  shareSources: {},
  shareCount: 0,
})
const { loading: loadingStats, execute: executeApi } = useApiError({ showMessage: false })

const handleBack = () => {
  window.history.go(-1)
}

const shareToPlatform = async (platformId: string) => {
  const shareUrl = window.location.href
  const shareTitle = shareSettings.customTitle || shareData.title
  const shareDesc = shareSettings.customDesc || shareData.description

  let shareLink = ''

  switch (platformId) {
    case 'wechat':
      // 微信分享需要JSSDK配置
      try {
        const { getWechatShareConfig, recordShare } = await import('@/api/content/share')
        const config = await getWechatShareConfig(shareUrl)
        
        if (config.success && config.data) {
          // 配置微信JSSDK
          await configureWechatJSSDK(config.data, shareTitle, shareDesc, shareData.image || defaultImage)
          
          // 记录分享事件
          recordShare({
            shareType: 'wechat',
            shareUrl,
            shareSource: 'wechat',
            contentId: route.params.id as string,
            contentType: 'share',
          })
            .then(() => {
              // 分享成功后刷新统计
              loadShareStats()
            })
            .catch((error: any) => {
              logger.warn('Failed to record WeChat share (does not affect sharing):', error)
            })
        } else {
          ElMessage.warning(t('share.wechatConfigFailed'))
          generateQRCode()
        }
      } catch (error) {
        logger.error('WeChat share configuration failed:', error)
        ElMessage.warning(t('share.wechatConfigFailed'))
        generateQRCode()
      }
      break
    case 'weibo':
      shareLink = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`
      window.open(shareLink, '_blank')
      // 记录分享事件
      import('@/api/content/share').then(({ recordShare }) => {
        recordShare({
          shareType: 'weibo',
          shareUrl,
          shareSource: 'weibo',
          contentId: route.params.id as string,
          contentType: 'share',
        })
          .then(() => {
            // 分享成功后刷新统计
            loadShareStats()
          })
          .catch((error: any) => {
            logger.warn('Failed to record Weibo share (does not affect sharing):', error)
          })
      })
      break
    case 'qq':
      shareLink = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}&summary=${encodeURIComponent(shareDesc)}`
      window.open(shareLink, '_blank')
      // 记录分享事件
      import('@/api/content/share').then(({ recordShare }) => {
        recordShare({
          shareType: 'qq',
          shareUrl,
          shareSource: 'qq',
          contentId: route.params.id as string,
          contentType: 'share',
        })
          .then(() => {
            // 分享成功后刷新统计
            loadShareStats()
          })
          .catch((error: any) => {
            logger.warn('Failed to record QQ share (does not affect sharing):', error)
          })
      })
      break
    case 'douyin':
      ElMessage.info(t('share.douyinShareTip'))
      copyLink()
      break
    case 'link':
      copyLink()
      // 记录分享事件
      import('@/api/content/share').then(({ recordShare }) => {
        recordShare({
          shareType: 'link',
          shareUrl,
          shareSource: 'copy',
          contentId: route.params.id as string,
          contentType: 'share',
        })
          .then(() => {
            // 分享成功后刷新统计
            loadShareStats()
          })
          .catch((error: any) => {
            logger.warn('Failed to record link share (does not affect sharing):', error)
          })
      })
      break
  }
}

// 配置微信JSSDK
const configureWechatJSSDK = async (
  config: { appId: string; timestamp: number; nonceStr: string; signature: string },
  title: string,
  desc: string,
  imgUrl: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 动态加载微信JSSDK
    const script = document.createElement('script')
    script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
    script.onload = () => {
      try {
        const wx = (window as { wx?: any }).wx as {
          config: (config: Record<string, unknown>) => void
          ready: (callback: () => void) => void
          error: (callback: (error: any) => void) => void
          updateAppMessageShareData: (data: { title: string; desc: string; link: string; imgUrl: string; success?: () => void; cancel?: () => void }) => void
          updateTimelineShareData: (data: { title: string; link: string; imgUrl: string; success?: () => void }) => void
        }
        if (!wx) {
          reject(new Error('微信JSSDK加载失败'))
          return
        }

        // 配置JSSDK
        wx.config({
          debug: false,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'],
        })

        wx.ready(() => {
          // 分享到朋友
          wx.updateAppMessageShareData({
            title,
            desc,
            link: window.location.href,
            imgUrl,
            success: () => {
              logger.info('WeChat share configuration successful')
              resolve()
            },
            cancel: () => {
              logger.info('User cancelled WeChat share')
              resolve()
            },
          })

          // 分享到朋友圈
          wx.updateTimelineShareData({
            title,
            link: window.location.href,
            imgUrl,
            success: () => {
              logger.info('WeChat Moments share configuration successful')
            },
          })
        })

        wx.error((res: any) => {
          logger.error('WeChat JSSDK configuration failed:', res)
          reject(new Error('微信JSSDK配置失败'))
        })
      } catch (error) {
        reject(error)
      }
    }

    script.onerror = () => {
      reject(new Error('微信JSSDK脚本加载失败'))
    }

    document.head.appendChild(script)
  })
}

const copyLink = async () => {
  const link = window.location.href
  try {
    await navigator.clipboard.writeText(link)
    ElMessage.success(t('share.linkCopied'))
    
    // 记录链接分享事件
    const { recordShare } = await import('@/api/content/share')
    recordShare({
      shareType: 'link',
      shareUrl: link,
      shareSource: 'copy',
      contentId: route.params.id as string,
      contentType: 'share',
    })
      .then(() => {
        // 分享成功后刷新统计
        loadShareStats()
      })
      .catch((error: any) => {
        logger.warn('Failed to record link share (does not affect sharing):', error)
      })
  } catch {
    ElMessage.error(t('share.copyFailed'))
  }
}

const generateQRCode = async () => {
  try {
    logger.info('Starting to generate share QR code...')
    const QRCode = await import('qrcode')
    const shareUrl = window.location.href
    qrCodeDataUrl.value = await QRCode.toDataURL(shareUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: 'var(--el-text-color-primary)',
        light: 'var(--el-bg-color)',
      },
    })

    qrCodeVisible.value = true
    logger.info('QR code generated successfully')
  } catch (error) {
    logger.error('Failed to generate QR code:', error)
    ElMessage.error(t('share.qrCodeGenerateFailed'))
  }
}

const downloadQRCode = () => {
  if (!qrCodeDataUrl.value) {
    ElMessage.error(t('share.qrCodeNotGenerated'))
    return
  }

  try {
    const link = document.createElement('a')
    link.download = 'share-qrcode.png'
    link.href = qrCodeDataUrl.value
    link.click()
    ElMessage.success(t('share.qrCodeDownloaded'))
    logger.info('QR code downloaded successfully')
  } catch (error) {
    logger.error('Failed to download QR code:', error)
    ElMessage.error(t('share.downloadFailed'))
  }
}

const downloadImage = () => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = new Image()

  img.crossOrigin = 'anonymous'
  img.src = shareData.image || defaultImage

  img.onload = () => {
    canvas.width = img.width
    canvas.height = img.height
    ctx?.drawImage(img, 0, 0)

    const link = document.createElement('a')
    link.download = 'share-image.png'
    link.href = canvas.toDataURL('image/png')
    link.click()

    ElMessage.success(t('share.imageDownloaded'))
  }

  img.onerror = () => {
    ElMessage.error(t('share.downloadFailed'))
  }
}

// 加载分享统计
const loadShareStats = async () => {
  const { getShareStats } = await import('@/api/content/share')
  const contentId = route.params.id as string
  const data = await executeApi(() => getShareStats(contentId, 'share'))
  
  if (data !== null && typeof data === 'object') {
    shareStats.value = data
  }
}

onMounted(() => {
  const shareId = route.params.id
  if (shareId) {
    logger.debug('Loading share data for:', shareId)
  }
  loadShareStats()
})
</script>

<style scoped lang="scss">
// ============================================
// 高科技工业风格 - Share Page
// Design System: $brand-primary: var(--el-bg-color-page)
// ============================================

// Design Tokens
$brand-primary: var(--el-bg-color-page);
$brand-secondary: var(--el-fill-color-darker);
$surface-dark: var(--el-bg-color-page);
$surface-card: var(--el-fill-color-lighter);
$border-subtle: var(--border-unified-color);
$border-glow: var(--border-unified-color-hover);
$text-primary: var(--el-text-color-primary);
$text-secondary: var(--el-text-color-regular);
$text-muted: var(--el-text-color-placeholder);
$accent-cyan: var(--el-color-primary);
$accent-green: var(--el-color-success);

// Timing Functions
$ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
$ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

// ============================================
// 主容器
// ============================================
.share-page {
  position: relative;
  min-height: 100vh;
  background: $brand-primary;
  padding: 24px;
  overflow-x: hidden;

  // 全局字体设置
  font-family: var(--font-family-chinese);
  color: $text-primary;
  letter-spacing: 0.01em;
}

// ============================================
// 深度背景系统
// ============================================
.share-page__background {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
  overflow: hidden;
}

// 光晕效果
.share-page__glow {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(120px);
  opacity: 0.4;
  animation: glowFloat 20s ease-in-out infinite;

  &--1 {
    width: 600px;
    height: 600px;
    background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
    top: -200px;
    right: -150px;
    animation-delay: 0s;
  }

  &--2 {
    width: 500px;
    height: 500px;
    background: var(--color-green-00ff88-05);
    bottom: -100px;
    left: -100px;
    animation-delay: -7s;
  }

  &--3 {
    width: 400px;
    height: 400px;
    background: var(--color-white-3);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation-delay: -14s;
  }
}

@keyframes glowFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -20px) scale(1.05); }
  50% { transform: translate(-20px, 30px) scale(0.95); }
  75% { transform: translate(20px, 20px) scale(1.02); }
}

// ============================================
// 玻璃态卡片基础样式
// ============================================
.glass-card {
  position: relative;
  background: $surface-card;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: all 0.4s $ease-out-expo;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-white-3);
    pointer-events: none;
  }

  &:hover {
    border-color: $border-glow;
    border: var(--unified-border);
    box-shadow: var(--global-box-shadow);
  }
}

// ============================================
// 滚动动画
// ============================================
.scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  animation: scrollReveal 0.8s $ease-out-expo forwards;
  animation-delay: var(--reveal-delay);
}

@keyframes scrollReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 涟漪按钮效果
// ============================================
.ripple-btn {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s $ease-in-out;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: var(--global-border-radius);
    background: var(--color-white-30);
    transform: translate(-50%, -50%);
    transition: width 0.6s ease, height 0.6s ease, opacity 0.6s ease;
    opacity: 0;
  }

  &:active::after {
    width: 300px;
    height: 300px;
    opacity: 0;
    transition: 0s;
  }
}

// ============================================
// 页面头部
// ============================================
.share-page__header {
  position: relative;
  z-index: calc(var(--z-base) + 9);
  display: flex;
  align-items: center;
  padding: 16px 24px;
  margin-bottom: 32px;
}

.share-page__back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-right: 16px;
  background: var(--color-white-5);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: $text-primary;
  font-size: 18px;
  transition: all 0.3s $ease-in-out;

  &:hover {
    background: var(--color-white-10);
    border-color: $border-glow;
    transform: translateX(-2px);
  }
}

.share-page__title {
  flex: 1;
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: $text-primary;
}

.share-page__header-accent {
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 1px;
  background: $accent-cyan;
  opacity: 0.3;
}

// ============================================
// 内容容器
// ============================================
.share-page__content {
  position: relative;
  z-index: calc(var(--z-base) + 9);
  max-width: 800px;
  margin: 0 auto;
}

// ============================================
// 预览卡片
// ============================================
.share-preview {
  padding: 0;
  margin-bottom: 24px;
}

.share-preview__card {
  display: flex;
  flex-direction: column;
}

.share-preview__image {
  position: relative;
  width: 100%;
  height: 280px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s $ease-out-expo;
  }

  &:hover img {
    transform: scale(1.05);
  }
}

.share-preview__image-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-black-40);
  pointer-events: none;
}

.share-preview__info {
  padding: 24px;
}

.share-preview__title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: $text-primary;
}

.share-preview__description {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.7;
  color: $text-secondary;
}

.share-preview__meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.share-preview__meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-family: var(--font-family-mono);
  color: $text-muted;
  letter-spacing: 0.02em;

  .el-icon {
    color: $accent-cyan;
    opacity: 0.7;
  }
}

// ============================================
// 分享平台选择
// ============================================
.share-options {
  padding: 28px;
  margin-bottom: 24px;
}

.share-options__title {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 24px;
}

.share-options__title-text {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  white-space: nowrap;
}

.share-options__title-line {
  flex: 1;
  height: 1px;
  background: $border-glow;
}

.share-options__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
}

.share-options__platform {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px;
  background: var(--color-white-2);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.4s $ease-out-expo;

  &:hover {
    background: var(--color-white-5);
    border-color: var(--platform-color, $border-glow);
    transform: translateY(-4px);

    .share-options__platform-glow {
      opacity: 1;
    }

    .share-options__platform-icon {
      transform: scale(1.1);
    }
  }
}

.share-options__platform-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 12px;
  background: var(--platform-color, $brand-secondary);
  border-radius: var(--global-border-radius);
  color: var(--el-bg-color-page);
  transition: transform 0.4s $ease-out-expo;
}

.share-options__platform-name {
  font-size: 13px;
  font-weight: 500;
  color: $text-secondary;
  text-align: center;
}

.share-options__platform-glow {
  position: absolute;
  inset: -1px;
  border-radius: var(--global-border-radius);
  background: var(--platform-color, transparent);
  opacity: 0;
  filter: blur(20px);
  transition: opacity 0.4s ease;
  z-index: -1;
}

// ============================================
// 操作按钮组
// ============================================
.share-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.share-actions__btn {
  position: relative;
  flex: 1;
  min-width: 140px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 52px;
  padding: 0 24px;
  background: var(--color-white-5);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: $text-primary;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s $ease-in-out;

  .el-icon {
    font-size: 18px;
    opacity: 0.8;
  }

  &:hover {
    background: var(--color-white-8);
    border-color: $border-glow;
    transform: translateY(-2px);
  }

  &--primary {
    background: var(--el-fill-color-dark);
    border-color: $accent-cyan;
    color: $accent-cyan;

    &:hover {
      background: var(--el-fill-color);
      box-shadow: var(--global-box-shadow);
    }
  }
}

.share-actions__btn-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: var(--color-white-5);
  animation: btnShine 3s ease-in-out infinite;
}

@keyframes btnShine {
  0%, 100% { left: -100%; }
  50% { left: 100%; }
}

// ============================================
// 分享统计
// ============================================
.share-stats {
  padding: 24px;
  margin-bottom: 24px;
}

.share-stats__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: var(--unified-border-bottom);
}

.share-stats__header-text {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
}

.share-stats__header-indicator {
  width: 8px;
  height: 8px;
  border-radius: var(--global-border-radius);
  background: $accent-green;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.share-stats__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-stats__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-white-2);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
}

.share-stats__label {
  font-size: 14px;
  color: $text-secondary;
}

.share-stats__value {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-family-mono);
  color: $accent-cyan;
  letter-spacing: 0.02em;
}

.share-stats__sources {
  margin-top: 8px;
}

.share-stats__sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.share-stats__source-tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--color-cyan-glow);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 13px;
  font-family: var(--font-family-mono);
  color: $accent-cyan;
}

// ============================================
// 分享设置
// ============================================
.share-settings {
  padding: 28px;
  margin-bottom: 24px;
}

.share-settings__title {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 24px;
}

.share-settings__title-text {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  white-space: nowrap;
}

.share-settings__title-line {
  flex: 1;
  height: 1px;
  background: $border-glow;
}

.share-settings__form {
  :deep(.el-form-item__label) {
    color: $text-secondary;
    font-size: 14px;
  }

  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner) {
    background: var(--color-white-3);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: none;
    color: $text-primary;
    transition: all 0.3s ease;

    &:hover,
    &:focus {
      border-color: $border-glow;
      background: var(--color-white-5);
    }
  }

  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    color: $text-primary;

    &::placeholder {
      color: $text-muted;
    }
  }

  :deep(.el-radio__label) {
    color: $text-secondary;
  }

  :deep(.el-radio__input.is-checked + .el-radio__label) {
    color: $accent-cyan;
  }

  :deep(.el-radio__inner) {
    background: transparent;
    border-color: $border-subtle;
  }

  :deep(.el-radio__input.is-checked .el-radio__inner) {
    background: $accent-cyan;
    border-color: $accent-cyan;
  }

  :deep(.el-select) {
    width: 100%;
  }
}

// ============================================
// QR码弹窗
// ============================================
.share-qr-dialog {
  :deep(.el-dialog) {
    background: $surface-card;
    backdrop-filter: blur(20px);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
  }

  :deep(.el-dialog__header) {
    padding: 20px 24px;
    border-bottom: var(--unified-border-bottom);
  }

  :deep(.el-dialog__title) {
    color: $text-primary;
    font-weight: 600;
  }

  :deep(.el-dialog__body) {
    padding: 24px;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px 24px;
    display: flex;
    gap: 12px;
    justify-content: center;
  }
}

.share-qr__container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-qr__code {
  width: 280px;
  height: 280px;
  background: var(--color-white-95);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border: 2px solid $border-glow;
  box-shadow: var(--global-box-shadow);
}

.share-qr__tip {
  margin: 0;
  font-size: 14px;
  color: $text-secondary;
}

// ============================================
// 响应式设计
// ============================================
@media (width <= 768px) {
  .share-page {
    padding: 16px;
  }

  .share-page__header {
    padding: 12px 16px;
    margin-bottom: 20px;
  }

  .share-page__title {
    font-size: 20px;
  }

  .share-preview__image {
    height: 200px;
  }

  .share-preview__info {
    padding: 20px;
  }

  .share-preview__title {
    font-size: 18px;
  }

  .share-options,
  .share-settings {
    padding: 20px;
  }

  .share-options__grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .share-options__platform {
    padding: 16px 8px;
  }

  .share-options__platform-icon {
    width: 44px;
    height: 44px;
  }

  .share-actions {
    flex-direction: column;
  }

  .share-actions__btn {
    width: 100%;
    min-width: unset;
  }

  .share-stats {
    padding: 20px;
  }

  .share-stats__item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .share-settings__form {
    :deep(.el-form-item) {
      margin-bottom: 16px;
    }

    :deep(.el-form-item__label) {
      width: 100%;
      text-align: left;
      margin-bottom: 8px;
    }

    :deep(.el-form-item__content) {
      margin-left: 0;
    }
  }
}

// ============================================
// 暗色模式兼容（本组件已默认暗色主题设计）
// ============================================
// 无需额外覆盖，所有样式已为暗色主题优化
</style>
