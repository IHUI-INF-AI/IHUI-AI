<template>
  <div class="document-center page-layout">
    <h1 class="title-lg">{{ t('open.documentCenter.title') || '文档中心' }}</h1>
    <p class="subtitle-sm">{{ t('open.documentCenter.subtitle') || '上传、管理和分享您的文件' }}</p>
    
    <div class="document-tabs">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="t('documentCenter.upload') || '文件上传'" name="upload">
          <div class="upload-section">
            <EnhancedFileUpload
              :upload-url="uploadUrl"
              :max-size="100 * 1024 * 1024"
              :accept="['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.png', '.gif', '.mp4', '.mp3']"
              :chunk-size="5 * 1024 * 1024"
              :enable-folder="true"
              :enable-compress="true"
              @success="onUploadSuccess"
              @error="onUploadError"
            />
          </div>
        </el-tab-pane>
        
        <el-tab-pane :label="t('documentCenter.files') || '文件管理'" name="files">
          <FileManager />
        </el-tab-pane>
        
        <el-tab-pane :label="t('documentCenter.shared') || '我的分享'" name="shared">
          <div class="shared-section">
            <div v-if="sharedFiles.length === 0" class="empty-state">
              {{ t('documentCenter.noShared') || '暂无分享文件' }}
            </div>
            <div v-else class="shared-list">
              <div v-for="share in sharedFiles" :key="share.id" class="shared-item">
                <div class="share-info">
                  <span class="share-name">{{ share.fileName }}</span>
                  <span class="share-meta">
                    {{ t('documentCenter.shareLink') || '分享链接' }}: {{ share.shareUrl }}
                  </span>
                </div>
                <div class="share-actions">
                  <el-button size="small" @click="copyShareLink(share)">
                    {{ t('common.copy') || '复制' }}
                  </el-button>
                  <el-button size="small" type="danger" @click="deleteShare(share.id)">
                    {{ t('common.delete') || '删除' }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import EnhancedFileUpload from '@/components/EnhancedFileUpload.vue'
import FileManager from '@/components/FileManager.vue'
import { useFileShare } from '@/utils/fileShare'

const { t } = useI18n()
const { listShares, deleteShare: removeShare, getShareUrl } = useFileShare()

const activeTab = ref('upload')
const uploadUrl = '/api/upload/single'
const sharedFiles = ref<(ShareLink & { shareUrl: string })[]>([])

interface ShareLink {
  id: string
  fileId: string
  fileName: string
  url: string
  createdAt: number
  expiresAt: number | null
  password: string | null
  maxDownloads: number | null
  currentDownloads: number
}

function onUploadSuccess(_files: unknown[]): void {
  ElMessage.success(t('documentCenter.uploadSuccess') || '上传成功')
}

function onUploadError(error: string): void {
  ElMessage.error(t('documentCenter.uploadError') || '上传失败: ' + error)
}

async function loadSharedFiles(): Promise<void> {
  const shares = await listShares()
  sharedFiles.value = shares.map((share: ShareLink) => ({
    ...share,
    shareUrl: getShareUrl(share.id)
  }))
}

function copyShareLink(share: ShareLink & { shareUrl: string }): void {
  navigator.clipboard.writeText(share.shareUrl)
  ElMessage.success(t('documentCenter.linkCopied') || '链接已复制')
}

async function deleteShare(shareId: string): Promise<void> {
  await removeShare(shareId)
  await loadSharedFiles()
  ElMessage.success(t('documentCenter.shareDeleted') || '分享已删除')
}

onMounted(() => {
  loadSharedFiles()
})
</script>

<style scoped>
.document-center {
  padding: 24px;
}

.document-tabs {
  margin-top: 24px;
}

.upload-section {
  padding: 24px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.shared-section {
  padding: 16px;
}

.shared-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shared-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.share-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-name {
  font-weight: 500;
}

.share-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.share-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--el-text-color-secondary);
}
</style>
