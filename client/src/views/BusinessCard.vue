<template>
  <div class="business-card-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><UserCircle /></el-icon>
        {{ t('businessCard.title') }}
      </h1>
      <p class="page-subtitle">{{ t('businessCard.subtitle') }}</p>
    </div>

    <!-- 复用UserInfoCard组件 -->
    <div class="card-section radius-auto">
      <UserInfoCard />
    </div>

    <!-- 名片图片展示 -->
    <div v-if="cardImageUrl" class="card-preview-section radius-auto">
      <h3 class="section-title">{{ t('businessCard.title') }}</h3>
      <div class="card-preview">
        <img :src="cardImageUrl" alt="社区名片" class="card-image" />
      </div>
    </div>

    <!-- 名片上传区域 -->
    <div class="upload-section radius-auto">
      <h3 class="section-title">{{ t('businessCard.upload') }}</h3>
      <p class="upload-hint">t('businessCard.uploadHint')</p>
      <div class="upload-area" @click="triggerUpload" @dragover.prevent @drop.prevent="handleDrop">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          hidden
          @change="handleFileChange"
        />
        <div v-if="uploading" class="upload-loading">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <span>{{ t('businessCard.uploading') }}</span>
        </div>
        <div v-else-if="cardImageUrl" class="upload-replace">
          <el-icon :size="24"><Refresh /></el-icon>
          <span>{{ t('businessCard.changeImage') }}</span>
        </div>
        <div v-else class="upload-placeholder">
          <el-icon :size="48"><Upload /></el-icon>
          <span>{{ t('businessCard.dropImage') }}</span>
          <span class="upload-tip">{{ t('businessCard.customEntry') }}</span>
        </div>
      </div>
    </div>

    <!-- 名片分享功能 -->
    <div class="share-section radius-auto">
      <h3 class="section-title">{{ t('businessCard.shareCard') }}</h3>
      <div class="share-options">
        <el-button @click="shareToWechat">
          <el-icon><Share /></el-icon>
          {{ t('businessCard.shareToWechat') }}
        </el-button>
        <el-button @click="shareToMoments">
          <el-icon><Promotion /></el-icon>
          朋友圈分享
        </el-button>
        <el-button @click="copyCardLink">
          <el-icon><CopyDocument /></el-icon>
          {{ t('businessCard.copyCardLink') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { UserCircle, Share, CopyDocument, Upload, Refresh, Promotion, Loading } from '@/lib/lucide-fallback'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getBusinessCard, uploadBusinessCard } from '@/api/business-card'
import { getInviteCode } from '@/api/distribution'
import type { ApiResponse } from '@/types'
import UserInfoCard from '@/components/user/UserInfoCard.vue'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'

const { t } = useI18n()
const _router = useRouter()
const { showSuccess, showError } = useOperationFeedback()

const fileInputRef = ref<HTMLInputElement | null>(null)
const cardImageUrl = ref('')
const uploading = ref(false)

const businessCard = ref<{
  inviteCode: string
  shareLink: string
  qrCode?: string
} | null>(null)
const { loading: _loading, execute: executeApi } = useApiError({ showMessage: false })

const loadBusinessCard = async () => {
  try {
    const data = await executeApi(async () => {
      const response = await getBusinessCard()
      return response as ApiResponse<{ inviteCode?: string; shareLink?: string; qrCode?: string; card?: string }>
    })
    if (data !== null) {
      const cardData = data as { inviteCode?: string; shareLink?: string; qrCode?: string; card?: string }
      businessCard.value = {
        inviteCode: cardData.inviteCode || '',
        shareLink: cardData.shareLink || '',
        qrCode: cardData.qrCode,
      }
      if (cardData.card) {
        cardImageUrl.value = cardData.card
      }
    }
  } catch (error) {
    logger.error('[BusinessCard] Failed to load business card info:', error)
    try {
      const inviteCodeData = await executeApi(() => getInviteCode())
      if (inviteCodeData !== null) {
        const inviteData = inviteCodeData as { invite_code?: string }
        businessCard.value = {
          inviteCode: inviteData.invite_code || '',
          shareLink: `${window.location.origin}/register?invite=${inviteData.invite_code}`,
        }
      }
    } catch (_) {
      // ignore
    }
  }
}

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    uploadCardImage(target.files[0])
  }
}

const handleDrop = (e: DragEvent) => {
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0]
    if (file.type.startsWith('image/')) {
      uploadCardImage(file)
    }
  }
}

const uploadCardImage = async (file: File) => {
  uploading.value = true
  try {
    const base64 = await fileToBase64(file)
    const userData = StorageManager.getItem<{ uuid?: string }>(STORAGE_KEYS.USER_DATA)
    const id = userData?.uuid || ''

    const res = await uploadBusinessCard(id, base64, file.name)
    if (res && (res as { data?: { url?: string; card?: string } }).data) {
      const cardUrl = (res as { data: { url?: string; card?: string } }).data.url || (res as { data: { url?: string; card?: string } }).data.card || ''
      cardImageUrl.value = cardUrl
      showSuccess(t('businessCard.uploadSuccess'))
    }
  } catch (error) {
    logger.error('[BusinessCard] Failed to upload business card:', error)
    showError(t('businessCard.uploadFailed'))
  } finally {
    uploading.value = false
  }
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] || result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const shareToWechat = async () => {
  try {
    if (!businessCard.value) {
      await loadBusinessCard()
    }
    if (businessCard.value?.qrCode) {
      showSuccess(t('businessCard.scanQrCode'))
    } else {
      const shareUrl = businessCard.value?.shareLink || `${window.location.origin}/business-card/${businessCard.value?.inviteCode || ''}`
      if (navigator.share) {
        try {
          await navigator.share({
            title: t('businessCard.title'),
            text: t('businessCard.subtitle'),
            url: shareUrl,
          })
          showSuccess(t('businessCard.shareSuccess'))
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
            await copyCardLink()
          }
        }
      } else {
        await copyCardLink()
      }
    }
  } catch (error: any) {
    logger.error('Share failed:', error)
    showError(t('businessCard.shareFailed'))
  }
}

const shareToMoments = async () => {
  try {
    if (!businessCard.value) {
      await loadBusinessCard()
    }
    const shareUrl = businessCard.value?.shareLink || `${window.location.origin}/business-card/${businessCard.value?.inviteCode || ''}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('businessCard.title'),
          text: t('businessCard.subtitle'),
          url: shareUrl,
        })
        showSuccess(t('businessCard.shareSuccess'))
      } catch (shareError) {
        if ((shareError as Error).name !== 'AbortError') {
          await copyCardLink()
        }
      }
    } else {
      await copyCardLink()
    }
  } catch (error: any) {
    logger.error('Moments share failed:', error)
    showError(t('businessCard.shareFailed'))
  }
}

const copyCardLink = async () => {
  try {
    if (!businessCard.value) {
      await loadBusinessCard()
    }
    const cardLink = businessCard.value?.shareLink || `${window.location.origin}/business-card`
    await navigator.clipboard.writeText(cardLink)
    showSuccess(t('businessCard.copySuccess'))
  } catch (_error) {
    showError(t('businessCard.copyFailed'))
  }
}

onMounted(() => {
  loadBusinessCard()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.business-card-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (max-width: $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (max-width: $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (max-width: $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (max-width: $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.card-section,
.share-section,
.upload-section,
.card-preview-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);

  @media (max-width: $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
}

.upload-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: -12px 0 16px;
}

.upload-area {
  border: 2px dashed var(--el-border-color);
  border-radius: var(--global-border-radius);
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  &:hover {
    border-color: var(--el-color-primary);
    background: var(--el-fill-color-extra-light);
  }

  .upload-placeholder,
  .upload-replace,
  .upload-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }

  .upload-tip {
    font-size: 12px;
    color: var(--el-color-primary);
    font-weight: 600;
    margin-top: 4px;
  }
}

.card-preview-section {
  .card-preview {
    display: flex;
    justify-content: center;
  }

  .card-image {
    max-width: 100%;
    max-height: 400px;
    border-radius: var(--global-border-radius);
    object-fit: contain;
    box-shadow: var(--global-box-shadow);
  }
}

.share-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
