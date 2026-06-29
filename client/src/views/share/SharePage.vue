<template>
  <div class="share-h5">
    <!-- 顶部导航 -->
    <header class="share-h5__header">
      <button
        class="share-h5__back"
        type="button"
        :aria-label="t('common.back')"
        @click="handleBack"
      >
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <h1 class="share-h5__heading">{{ t('share.title') }}</h1>
    </header>

    <main class="share-h5__main">
      <!-- 分享内容卡片 -->
      <section class="share-h5__card">
        <div class="share-h5__cover">
          <img
            v-if="shareData.image"
            :src="shareData.image"
            :alt="shareData.title"
            class="share-h5__cover-img"
            loading="lazy"
          />
          <div v-else class="share-h5__cover-placeholder">
            <el-icon :size="48"><Picture /></el-icon>
          </div>
        </div>

        <div class="share-h5__body">
          <h2 class="share-h5__title">{{ shareData.title }}</h2>
          <p class="share-h5__desc">{{ shareData.description }}</p>

          <div class="share-h5__meta">
            <span class="share-h5__meta-item">
              <el-icon><User /></el-icon>
              <span>{{ shareData.author }}</span>
            </span>
            <span v-if="shareData.views" class="share-h5__meta-item">
              <el-icon><View /></el-icon>
              <span>{{ shareData.views }}</span>
            </span>
            <span v-if="shareData.likes" class="share-h5__meta-item">
              <el-icon><Star /></el-icon>
              <span>{{ shareData.likes }}</span>
            </span>
          </div>
        </div>
      </section>

      <!-- 分享内容详情（对话内容/原文） -->
      <section v-if="shareData.content_data" class="share-h5__content">
        <h3 class="share-h5__section-title">{{ t('share.contentDetails') }}</h3>
        <div class="share-h5__content-body">
          {{ shareData.content_data }}
        </div>
      </section>

      <!-- 分享平台 -->
      <section class="share-h5__platforms">
        <h3 class="share-h5__section-title">{{ t('share.shareTo') }}</h3>
        <div class="share-h5__platform-grid">
          <button
            v-for="platform in platforms"
            :key="platform.id"
            type="button"
            class="share-h5__platform"
            :style="{ '--platform-color': platform.color }"
            @click="handleShare(platform.id)"
          >
            <span class="share-h5__platform-icon">
              <el-icon :size="22">
                <component :is="platform.icon" />
              </el-icon>
            </span>
            <span class="share-h5__platform-name">{{ platform.name }}</span>
          </button>
        </div>
      </section>

      <!-- 操作按钮 -->
      <section class="share-h5__actions">
        <button
          type="button"
          class="share-h5__btn share-h5__btn--primary"
          @click="copyLink"
        >
          <el-icon><Link /></el-icon>
          <span>{{ t('share.copyLink') }}</span>
        </button>
        <button
          type="button"
          class="share-h5__btn"
          @click="generateQRCode"
        >
          <el-icon><FullScreen /></el-icon>
          <span>{{ t('share.qrCode') }}</span>
        </button>
      </section>

      <!-- 分享统计 -->
      <section v-if="hasStats" class="share-h5__stats">
        <h3 class="share-h5__section-title">{{ t('share.stats') }}</h3>
        <div class="share-h5__stats-grid">
          <div class="share-h5__stat">
            <span class="share-h5__stat-label">{{ t('share.totalShares') }}</span>
            <span class="share-h5__stat-value">{{ shareStats.totalShares }}</span>
          </div>
          <div class="share-h5__stat">
            <span class="share-h5__stat-label">{{ t('share.currentShares') }}</span>
            <span class="share-h5__stat-value">{{ shareStats.shareCount }}</span>
          </div>
        </div>
      </section>
    </main>

    <!-- 二维码弹窗 -->
    <el-dialog
      v-model="qrCodeVisible"
      :title="t('share.qrCode')"
      width="320px"
      center
      class="share-h5__qr-dialog"
    >
      <div class="share-h5__qr">
        <img
          v-if="qrCodeDataUrl"
          :src="qrCodeDataUrl"
          :alt="t('share.qrCode')"
          class="share-h5__qr-img"
        />
        <p class="share-h5__qr-tip">{{ t('share.scanQRCode') }}</p>
      </div>
      <template #footer>
        <el-button @click="qrCodeVisible = false">{{ t('common.close') }}</el-button>
        <el-button type="primary" @click="downloadQRCode">
          {{ t('share.downloadQRCode') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import {
  ArrowLeft,
  User,
  View,
  Star,
  Link,
  Picture,
  ChatDotRound,
  Share,
  Message,
  FullScreen,
} from '@element-plus/icons-vue'

const { t } = useI18n()
const route = useRoute()

interface ShareContent {
  title: string
  description: string
  image: string
  author: string
  views: number
  likes: number
  content_type?: string
  content_data?: string
  created_at?: string
}

interface ShareStatsData {
  totalShares: number
  shareSources: Record<string, number>
  shareCount: number
}

const shareData = reactive<ShareContent>({
  title: t('share.defaultTitle'),
  description: t('share.defaultDescription'),
  image: '',
  author: t('share.defaultAuthor'),
  views: 0,
  likes: 0,
  content_type: '',
  content_data: '',
  created_at: '',
})

const shareStats = ref<ShareStatsData>({
  totalShares: 0,
  shareSources: {},
  shareCount: 0,
})

const hasStats = computed(
  () => shareStats.value.totalShares > 0 || shareStats.value.shareCount > 0
)

const platforms = [
  { id: 'wechat', name: t('share.wechat'), icon: ChatDotRound, color: '#07c160' },
  { id: 'weibo', name: t('share.weibo'), icon: Share, color: '#e6162d' },
  { id: 'qq', name: t('share.qq'), icon: Message, color: '#12b7f5' },
  { id: 'copy', name: t('share.copyLink'), icon: Link, color: '#909399' },
] as const

const qrCodeVisible = ref(false)
const qrCodeDataUrl = ref('')

const handleBack = (): void => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.href = '/'
  }
}

const getShareUrl = (): string => {
  return window.location.href
}

const handleShare = async (platformId: string): Promise<void> => {
  const shareUrl = getShareUrl()
  const shareTitle = shareData.title
  const shareDesc = shareData.description

  switch (platformId) {
    case 'wechat':
      // 微信分享需要 JSSDK，H5 环境下提示用户使用右上角分享
      ElMessage.info(t('share.wechatConfigFailed'))
      break
    case 'weibo': {
      const link = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`
      window.open(link, '_blank')
      break
    }
    case 'qq': {
      const link = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}&summary=${encodeURIComponent(shareDesc)}`
      window.open(link, '_blank')
      break
    }
    case 'copy':
      await copyLink()
      break
  }

  // 异步记录分享事件（不阻塞用户操作）
  recordShareEvent(platformId, shareUrl).catch((error: unknown) => {
    logger.warn('Failed to record share event:', error)
  })
}

const recordShareEvent = async (
  shareType: string,
  shareUrl: string
): Promise<void> => {
  try {
    const { recordShare } = await import('@/api/share')
    await recordShare({
      shareType: shareType as 'wechat' | 'weibo' | 'qq' | 'link' | 'other',
      shareUrl,
      shareSource: shareType,
      contentId: (route.params.id as string) || '',
      contentType: 'share',
    })
    await loadShareStats()
  } catch (error) {
    logger.warn('Record share event failed:', error)
  }
}

const copyLink = async (): Promise<void> => {
  const link = getShareUrl()
  try {
    await navigator.clipboard.writeText(link)
    ElMessage.success(t('share.linkCopied'))
  } catch {
    // 降级方案：使用 textarea 复制
    try {
      const textarea = document.createElement('textarea')
      textarea.value = link
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      ElMessage.success(t('share.linkCopied'))
    } catch {
      ElMessage.error(t('share.copyFailed'))
    }
  }
}

const generateQRCode = async (): Promise<void> => {
  try {
    const QRCode = await import('qrcode')
    qrCodeDataUrl.value = await QRCode.toDataURL(getShareUrl(), {
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
    qrCodeVisible.value = true
  } catch (error) {
    logger.error('Failed to generate QR code:', error)
    ElMessage.error(t('share.qrCodeGenerateFailed'))
  }
}

const downloadQRCode = (): void => {
  if (!qrCodeDataUrl.value) {
    ElMessage.error(t('share.qrCodeNotGenerated'))
    return
  }
  const link = document.createElement('a')
  link.download = 'share-qrcode.png'
  link.href = qrCodeDataUrl.value
  link.click()
  ElMessage.success(t('share.qrCodeDownloaded'))
}

const loadShareStats = async (): Promise<void> => {
  const contentId = (route.params.id as string) || ''
  if (!contentId) return
  try {
    const { getShareStats } = await import('@/api/share')
    const response = await getShareStats(contentId, 'share')
    if (response?.data && typeof response.data === 'object') {
      shareStats.value = response.data as ShareStatsData
    }
  } catch (error) {
    logger.warn('Failed to load share stats:', error)
  }
}

const loadShareContent = async (): Promise<void> => {
  const shareId = route.params.id as string
  if (!shareId) return

  // 优先调用后端真实 API 获取分享内容
  try {
    const { getShareContent } = await import('@/api/share')
    const response = await getShareContent(shareId)
    if (response?.success && response.data) {
      const data = response.data
      if (data.title) shareData.title = data.title
      if (data.description) shareData.description = data.description
      if (data.image) shareData.image = data.image
      if (data.author) shareData.author = data.author
      if (data.content_type) shareData.content_type = data.content_type
      if (data.content_data) shareData.content_data = data.content_data
      if (data.created_at) shareData.created_at = data.created_at
      logger.info('loadShareContent: loaded from API for shareId:', shareId)
      return
    }
    logger.warn(
      'loadShareContent: API returned no data, falling back to query/defaults for shareId:',
      shareId,
      response
    )
  } catch (error) {
    logger.warn(
      'loadShareContent: API call failed, falling back to query/defaults for shareId:',
      shareId,
      error
    )
  }

  // Fallback: 从路由 query 读取分享元数据（向后兼容，生成分享链接时携带）
  const queryTitle = route.query.title as string
  const queryDesc = route.query.description as string
  const queryImage = route.query.image as string
  const queryAuthor = route.query.author as string
  if (queryTitle) shareData.title = queryTitle
  if (queryDesc) shareData.description = queryDesc
  if (queryImage) shareData.image = queryImage
  if (queryAuthor) shareData.author = queryAuthor
}

onMounted(() => {
  loadShareContent()
  loadShareStats()
})
</script>

<style scoped lang="scss">
// 扁平化设计：仅使用边框和颜色对比，不使用 text-shadow / box-shadow

.share-h5 {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  font-family: var(--font-family-chinese);
}

.share-h5__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.share-h5__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: var(--el-fill-color-light);
    border-color: var(--el-border-color-hover);
  }
}

.share-h5__heading {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.share-h5__main {
  max-width: 640px;
  padding: 16px;
  margin: 0 auto;
}

.share-h5__card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  margin-bottom: 16px;
}

.share-h5__cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--el-fill-color-light);
  overflow: hidden;
}

.share-h5__cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.share-h5__cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-placeholder);
}

.share-h5__body {
  padding: 16px;
}

.share-h5__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.share-h5__desc {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.share-h5__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.share-h5__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.share-h5__platforms,
.share-h5__stats {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--global-border-radius);
  padding: 16px;
  margin-bottom: 16px;
}

.share-h5__content {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--global-border-radius);
  padding: 16px;
  margin-bottom: 16px;
}

.share-h5__content-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.share-h5__section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.share-h5__platform-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.share-h5__platform {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: var(--el-fill-color);
    border-color: var(--platform-color, var(--el-border-color-hover));
  }
}

.share-h5__platform-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--platform-color, var(--el-color-primary));
  border-radius: var(--global-border-radius);
  color: #ffffff;
}

.share-h5__platform-name {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.share-h5__actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.share-h5__btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: var(--el-fill-color-light);
    border-color: var(--el-border-color-hover);
  }
}

.share-h5__btn--primary {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #ffffff;

  &:hover {
    background: var(--el-color-primary-light-3);
    border-color: var(--el-color-primary-light-3);
  }
}

.share-h5__stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.share-h5__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--global-border-radius);
}

.share-h5__stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.share-h5__stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.share-h5__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.share-h5__qr-img {
  display: block;
  width: 240px;
  height: 240px;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--global-border-radius);
}

.share-h5__qr-tip {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

@media (width <= 480px) {
  .share-h5__main {
    padding: 12px;
  }

  .share-h5__platform-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .share-h5__actions {
    flex-direction: column;
  }

  .share-h5__btn {
    width: 100%;
  }
}
</style>
