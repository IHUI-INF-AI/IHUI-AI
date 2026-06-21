<template>
  <div class="file-manager">
    <div class="file-manager-header">
      <h2>{{ $t('file.manager.title') }}</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showUpload = true">
          <el-icon><Upload /></el-icon>
          {{ $t('file.upload.title') }}
        </el-button>
        <el-button @click="refreshFiles">
          <el-icon><Refresh /></el-icon>
          {{ $t('common.refresh') }}
        </el-button>
      </div>
    </div>

    <div class="file-stats">
      <el-card v-for="stat in stats" :key="stat.label" class="stat-card">
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </el-card>
    </div>

    <div class="file-toolbar">
      <el-input
        v-model="searchQuery"
        :placeholder="$t('file.search')"
        prefix-icon="Search"
        clearable
        class="search-input"
      />
      <el-select v-model="sortBy" :placeholder="$t('file.sortBy')" class="sort-select">
        <el-option :label="$t('file.sort.name')" value="name" />
        <el-option :label="$t('file.sort.size')" value="size" />
        <el-option :label="$t('file.sort.date')" value="date" />
      </el-select>
      <el-radio-group v-model="viewMode" class="view-mode">
        <el-radio-button value="grid">
          <el-icon><Grid /></el-icon>
        </el-radio-button>
        <el-radio-button value="list">
          <el-icon><List /></el-icon>
        </el-radio-button>
      </el-radio-group>
    </div>
    
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ $t('common.loading') }}</span>
    </div>

    <div v-else-if="filteredFiles.length === 0" class="empty-container">
      <el-empty :description="$t('file.empty')" />
    </div>
    
    <div v-else :class="['file-container', viewMode]">
      <div
        v-for="file in filteredFiles"
        :key="file.id"
        :class="['file-item', { selected: selectedFiles.includes(file.id) }]"
        @click="toggleSelect(file.id)"
        @dblclick="openFile(file)"
      >
        <div class="file-checkbox">
          <el-checkbox :model-value="selectedFiles.includes(file.id)" @click.stop />
        </div>
        <div class="file-preview">
          <img v-if="file.thumbnail" :src="file.thumbnail" alt="" loading="lazy" />
          <el-icon v-else-if="getFileIcon(file.type)"><component :is="getFileIcon(file.type)" /></el-icon>
        </div>
        <div class="file-info">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-meta">
            {{ formatSize(file.size) }} · {{ formatDate(file.modifiedAt) }}
          </span>
        </div>
        <div class="file-actions" @click.stop>
          <el-dropdown trigger="click">
            <el-button size="small" circle>
              <el-icon><More /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="previewFile(file)">
                  <el-icon><View /></el-icon> {{ $t('file.preview') }}
                </el-dropdown-item>
                <el-dropdown-item @click="downloadFile(file)">
                  <el-icon><Download /></el-icon> {{ $t('file.download') }}
                </el-dropdown-item>
                <el-dropdown-item @click="shareFile(file)">
                  <el-icon><Share /></el-icon> {{ $t('common.share') }}
                </el-dropdown-item>
                <el-dropdown-item @click="showVersionHistory(file)">
                  <el-icon><Clock /></el-icon> {{ $t('file.versions.title') }}
                </el-dropdown-item>
                <el-dropdown-item divided @click="deleteFile(file)">
                  <el-icon><Delete /></el-icon> {{ $t('file.delete') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
    
    <div v-if="selectedFiles.length > 0" class="batch-actions">
      <span class="selected-count">
        {{ $t('file.selected', { count: selectedFiles.length }) }}
      </span>
      <el-button size="small" @click="downloadSelectedFiles">
        <el-icon><Download /></el-icon> {{ $t('file.batchDownload') }}
      </el-button>
      <el-button size="small" @click="batchShare">
        <el-icon><Share /></el-icon> {{ $t('file.batchShare') }}
      </el-button>
      <el-button size="small" type="danger" @click="batchDelete">
        <el-icon><Delete /></el-icon> {{ $t('file.batchDelete') }}
      </el-button>
      <el-button size="small" @click="clearSelection">
        {{ $t('file.clearSelection') }}
      </el-button>
    </div>
    
    <el-dialog v-model="showUpload" :title="$t('file.upload.title')" width="800px">
      <EnhancedFileUpload
        ref="uploadRef"
        :upload-url="uploadUrl"
        @success="onUploadSuccess"
      />
    </el-dialog>
    
    <el-dialog v-model="showPreview" :title="previewFile?.name" width="80%" top="5vh">
      <UnifiedViewer v-if="previewData" :url="previewData.url" :file-name="previewData.name" />
    </el-dialog>
    
    <el-dialog v-model="showShare" :title="$t('file.share.title')" width="400px">
      <div v-if="shareData" class="share-dialog">
        <el-input v-model="shareData.url" readonly>
          <template #append>
            <el-button @click="copyShareUrl">{{ $t('common.copy') }}</el-button>
          </template>
        </el-input>
        <div class="share-options">
          <el-form-item :label="$t('file.share.expires')">
            <el-select v-model="shareData.expiresIn" style="width: 100%">
              <el-option :label="$t('file.share.1hour')" :value="1" />
              <el-option :label="$t('file.share.1day')" :value="24" />
              <el-option :label="$t('file.share.7days')" :value="168" />
              <el-option :label="$t('file.share.forever')" :value="null" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('file.share.password')">
            <el-input v-model="shareData.password" :placeholder="$t('file.share.passwordHint')" />
          </el-form-item>
        </div>
      </div>
    </el-dialog>
    
    <el-dialog v-model="showVersions" :title="$t('file.versions.title')" width="700px">
      <div v-if="versionLoading" class="loading-container">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
      <div v-else-if="versions.length === 0" class="empty-state">
        {{ $t('file.versions.empty') }}
      </div>
      <div v-else>
        <div class="version-toolbar">
          <el-button size="small" @click="showDiffDialog = true">
            <el-icon><Switch /></el-icon>
            {{ $t('file.versions.compare') }}
          </el-button>
        </div>
        <div class="version-list">
          <div v-for="v in versions" :key="v.version_id" class="version-item">
            <div class="version-info">
              <span class="version-number">v{{ v.version_number }}</span>
              <span v-if="v.is_current" class="version-current">{{ $t('file.versions.current') }}</span>
              <span class="version-meta">
                {{ formatSize(v.file_size) }} · {{ formatDate(v.created_at) }}
              </span>
              <span v-if="v.change_summary" class="version-summary">{{ v.change_summary }}</span>
            </div>
            <div class="version-actions">
              <el-button size="small" @click="downloadVersion(v.version_id, v.version_number)">
                {{ $t('file.download') }}
              </el-button>
              <el-button v-if="!v.is_current" size="small" type="warning" @click="rollbackVersion(v.version_id)">
                {{ $t('file.versions.rollback') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showNewVersion = true">{{ $t('file.versions.new') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDiffDialog" :title="$t('file.versions.diff')" width="900px">
      <VersionDiff v-if="currentVersionFile" :file-id="currentVersionFile.id" :versions="versions" />
    </el-dialog>

    <el-dialog v-model="showNewVersion" :title="$t('file.versions.new')" width="500px">
      <el-upload
        drag
        :auto-upload="false"
        :on-change="handleNewVersionFile"
        :limit="1"
      >
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div>{{ t('fileManager.dropUpload') }}</div>
      </el-upload>
      <el-input v-model="newVersionSummary" :placeholder="$t('file.versions.summary')" style="margin-top: 16px" />
      <template #footer>
        <el-button @click="showNewVersion = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="uploadNewVersion" :loading="uploadingVersion">
          {{ $t('common.upload') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload, Refresh, Grid, List, More, View, Download, Share, Delete,
  Document, Picture, VideoPlay, Headset, Clock, Loading, Switch
} from '@element-plus/icons-vue'
import EnhancedFileUpload from './EnhancedFileUpload.vue'
import UnifiedViewer from './viewers/UnifiedViewer.vue'
import VersionDiff from './VersionDiff.vue'
import { useFileShare } from '@/utils/fileShare'
import { useBatchDownload } from '@/utils/batchOperations'
import { formatFileSize } from '@/utils/fileValidation'
import { useFileVersion, type VersionInfo } from '@/utils/fileVersion'
import { formatTime } from '@/utils/format'

const formatDate = (date: string | number | Date) => formatTime(date, 'YYYY-MM-DD')

interface FileItem {
  id: string
  name: string
  size: number
  type: string
  thumbnail?: string
  modifiedAt: string
  url: string
}

const uploadUrl = '/api/upload/single'
const { createShare, getShareUrl } = useFileShare()
const batchDownloadUtil = useBatchDownload()
const { getVersions, createVersion, rollbackToVersion, getVersionDownloadUrl } = useFileVersion()

const loading = ref(false)
const files = ref<FileItem[]>([])
const cleanup = useCleanup()

let abortController: AbortController | null = null
cleanup.add(() => abortController?.abort())

const searchQuery = ref('')
const sortBy = ref('date')
const viewMode = ref<'grid' | 'list'>('grid')
const selectedFiles = ref<string[]>([])

const showUpload = ref(false)
const showPreview = ref(false)
const showShare = ref(false)
const showVersions = ref(false)
const showNewVersion = ref(false)
const showDiffDialog = ref(false)
const previewData = ref<{ url: string; name: string } | null>(null)
const shareData = ref<{
  fileId: string
  url: string
  expiresIn: number | null
  password: string
} | null>(null)

const versionLoading = ref(false)
const versions = ref<VersionInfo[]>([])
const currentVersionFile = ref<FileItem | null>(null)
const newVersionFile = ref<File | null>(null)
const newVersionSummary = ref('')
const uploadingVersion = ref(false)

const uploadRef = ref()

const stats = computed(() => [
  { label: t('file.stats.total'), value: files.value.length },
  { label: t('file.stats.totalSize'), value: formatSize(files.value.reduce((sum, f) => sum + f.size, 0)) },
  { label: t('file.stats.selected'), value: selectedFiles.value.length }
])

const filteredFiles = computed(() => {
  let result = [...files.value]
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(f => f.name.toLowerCase().includes(query))
  }
  
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'size':
        return b.size - a.size
      case 'date':
      default:
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    }
  })
  
  return result
})

function formatSize(bytes: number): string {
  return formatFileSize(bytes)
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Picture
  if (type.startsWith('video/')) return VideoPlay
  if (type.startsWith('audio/')) return Headset
  return Document
}

async function refreshFiles() {
  loading.value = true
  try {
    abortController = new AbortController()
    const response = await fetch('/api/upload/files', { signal: abortController.signal })
    const data = await response.json()
    type ApiFile = { id: string; name: string; size: number; mimeType?: string; createdAt: string }
    files.value = data.files.map((f: ApiFile) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.mimeType || getMimeType(f.name),
      modifiedAt: f.createdAt,
      url: `/api/upload/file/${f.id}`
    }))
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    ElMessage.error(t('fileManager.loadListFailed'))
  } finally {
    loading.value = false
  }
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

function toggleSelect(id: string) {
  const index = selectedFiles.value.indexOf(id)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  } else {
    selectedFiles.value.push(id)
  }
}

function clearSelection() {
  selectedFiles.value = []
}

function openFile(file: FileItem) {
  previewData.value = { url: file.url, name: file.name }
  showPreview.value = true
}

function previewFile(file: FileItem) {
  previewData.value = { url: file.url, name: file.name }
  showPreview.value = true
}

function downloadFile(file: FileItem) {
  const link = document.createElement('a')
  link.href = file.url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function shareFile(file: FileItem) {
  try {
    const share = await createShare(file.id, {
      expiresIn: shareData.value?.expiresIn || 168,
      password: shareData.value?.password || undefined
    })
    
    shareData.value = {
      fileId: file.id,
      url: getShareUrl(share.id),
      expiresIn: 168,
      password: ''
    }
    showShare.value = true
  } catch (_error) {
    ElMessage.error(t('fileManager.createShareFailed'))
  }
}

async function deleteFile(file: FileItem) {
  try {
    await ElMessageBox.confirm(t('fileManager.confirmDelete', { name: file.name }), t('fileManager.confirmDeleteTitle'), {
      type: 'warning'
    })
    
    await fetch(`/api/upload/file/${file.id}`, { method: 'DELETE' })
    await refreshFiles()
    ElMessage.success(t('fileManager.deleteSuccess'))
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('fileManager.deleteFailed'))
    }
  }
}

async function showVersionHistory(file: FileItem) {
  currentVersionFile.value = file
  versionLoading.value = true
  showVersions.value = true
  
  try {
    versions.value = await getVersions(file.id)
  } catch (_error) {
    versions.value = []
  } finally {
    versionLoading.value = false
  }
}

function handleNewVersionFile(uploadFile: { raw: File }) {
  newVersionFile.value = uploadFile.raw
}

async function uploadNewVersion() {
  if (!newVersionFile.value || !currentVersionFile.value) return
  
  uploadingVersion.value = true
  try {
    await createVersion(currentVersionFile.value.id, newVersionFile.value, {
      changeSummary: newVersionSummary.value
    })
    ElMessage.success(t('fileManager.uploadNewVersionSuccess'))
    showNewVersion.value = false
    newVersionFile.value = null
    newVersionSummary.value = ''
    versions.value = await getVersions(currentVersionFile.value.id)
  } catch (_error) {
    ElMessage.error(t('fileManager.uploadNewVersionFailed'))
  } finally {
    uploadingVersion.value = false
  }
}

function downloadVersion(versionId: string, versionNumber: number) {
  const url = getVersionDownloadUrl(versionId)
  const link = document.createElement('a')
  link.href = url
  link.download = `${currentVersionFile.value?.name || 'file'}_v${versionNumber}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function rollbackVersion(versionId: string) {
  try {
    await ElMessageBox.confirm(t('fileManager.confirmRollback'), t('fileManager.rollbackTitle'), { type: 'warning' })
    await rollbackToVersion(versionId)
    ElMessage.success(t('fileManager.rollbackSuccess'))
    versions.value = await getVersions(currentVersionFile.value!.id)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('fileManager.rollbackFailed'))
    }
  }
}

async function downloadSelectedFiles() {
  const selected = files.value.filter(f => selectedFiles.value.includes(f.id))
  await batchDownloadUtil.downloadFiles(
    selected.map(f => ({ url: f.url, fileName: f.name }))
  )
  ElMessage.success(t('fileManager.downloadComplete'))
}

async function batchShare() {
  ElMessage.info(t('fileManager.batchShareDev'))
}

async function batchDelete() {
  try {
    await ElMessageBox.confirm(t('fileManager.confirmBatchDelete', { count: selectedFiles.value.length }), t('fileManager.confirmDeleteTitle'), {
      type: 'warning'
    })
    
    for (const id of selectedFiles.value) {
      await fetch(`/api/upload/file/${id}`, { method: 'DELETE' })
    }
    
    await refreshFiles()
    clearSelection()
    ElMessage.success(t('cmpFileManager.batchDeleteSuccess'))
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('fileManager.batchDeleteFailed'))
    }
  }
}

async function copyShareUrl() {
  if (shareData.value) {
    await navigator.clipboard.writeText(shareData.value.url)
    ElMessage.success(t('fileManager.linkCopied'))
  }
}

function onUploadSuccess(_uploadedFiles: any[]) {
  showUpload.value = false
  refreshFiles()
  ElMessage.success(t('fileManager.uploadSuccess'))
}

onMounted(() => {
  refreshFiles()
})
</script>

<style scoped>
.file-manager {
  padding: 20px;
}

.file-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.file-manager-header h2 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.file-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.file-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

.sort-select {
  width: 120px;
}

.file-container.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.file-container.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  background: var(--el-fill-color);
}

.file-item.selected {
  background: var(--el-color-primary-light-9);
  border: var(--unified-border);
}

.file-checkbox {
  margin-right: 12px;
}

.file-preview {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
}

.file-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--global-border-radius);
}

.file-preview .el-icon {
  font-size: 24px;
  color: var(--el-text-color-secondary);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  display: block;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.file-actions {
  margin-left: 12px;
}

.batch-actions {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: var(--el-box-shadow-light);
}

.selected-count {
  font-weight: 500;
}

.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.share-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-options {
  margin-top: 16px;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-toolbar {
  margin-bottom: 16px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.version-number {
  font-weight: 600;
}

.version-current {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-left: 8px;
}

.version-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.version-summary {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.version-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--el-text-color-secondary);
}
</style>
