<template>
  <div class="file-manager">
    <div class="file-manager-header">
      <h2>{{ $t('file.manager.title') }}</h2>
      <div class="header-actions">
        <Button variant="default" @click="showUpload = true">
          <Upload class="h-4 w-4" />
          {{ $t('file.upload.title') }}
        </Button>
        <Button variant="outline" @click="refreshFiles">
          <Refresh class="h-4 w-4" />
          {{ $t('common.refresh') }}
        </Button>
      </div>
    </div>

    <div class="file-stats">
      <Card v-for="stat in stats" :key="stat.label" class="stat-card p-5">
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </Card>
    </div>

    <div class="file-toolbar">
      <Input
        v-model="searchQuery"
        :placeholder="$t('file.search')"
        clearable
        class="search-input"
      />
      <Select v-model="sortBy" :placeholder="$t('file.sortBy')" class="sort-select">
        <SelectOption :label="$t('file.sort.name')" value="name" />
        <SelectOption :label="$t('file.sort.size')" value="size" />
        <SelectOption :label="$t('file.sort.date')" value="date" />
      </Select>
      <div class="view-mode">
        <Radio v-model="viewMode" value="grid">
          <Grid class="h-4 w-4" />
        </Radio>
        <Radio v-model="viewMode" value="list">
          <List class="h-4 w-4" />
        </Radio>
      </div>
    </div>
    
    <div v-if="loading" class="loading-container">
      <Loading class="h-4 w-4 is-loading" />
      <span>{{ $t('common.loading') }}</span>
    </div>

    <div v-else-if="filteredFiles.length === 0" class="empty-container">
      <Empty :description="$t('file.empty')" />
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
          <Checkbox :model-value="selectedFiles.includes(file.id)" @click.stop />
        </div>
        <div class="file-preview">
          <img v-if="file.thumbnail" :src="file.thumbnail" alt="" loading="lazy" />
          <component v-else-if="getFileIcon(file.type)" :is="getFileIcon(file.type)" class="h-4 w-4" />
        </div>
        <div class="file-info">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-meta">
            {{ formatSize(file.size) }} · {{ formatDate(file.modifiedAt) }}
          </span>
        </div>
        <div class="file-actions" @click.stop>
          <details class="relative">
            <summary class="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <Button size="icon" variant="outline">
                <More class="h-4 w-4" />
              </Button>
            </summary>
            <div class="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md" @click="($event.target as HTMLElement).closest('details')!.open = false">
              <button class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" @click="previewFile(file)">
                <View class="h-4 w-4" /> {{ $t('file.preview') }}
              </button>
              <button class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" @click="downloadFile(file)">
                <Download class="h-4 w-4" /> {{ $t('file.download') }}
              </button>
              <button class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" @click="shareFile(file)">
                <Share class="h-4 w-4" /> {{ $t('common.share') }}
              </button>
              <button class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" @click="showVersionHistory(file)">
                <Clock class="h-4 w-4" /> {{ $t('file.versions.title') }}
              </button>
              <div class="my-1 h-px bg-border"></div>
              <button class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent" @click="deleteFile(file)">
                <Delete class="h-4 w-4" /> {{ $t('file.delete') }}
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
    
    <div v-if="selectedFiles.length > 0" class="batch-actions">
      <span class="selected-count">
        {{ $t('file.selected', { count: selectedFiles.length }) }}
      </span>
      <Button size="sm" variant="outline" @click="downloadSelectedFiles">
        <Download class="h-4 w-4" /> {{ $t('file.batchDownload') }}
      </Button>
      <Button size="sm" variant="outline" @click="batchShare">
        <Share class="h-4 w-4" /> {{ $t('file.batchShare') }}
      </Button>
      <Button size="sm" variant="destructive" @click="batchDelete">
        <Delete class="h-4 w-4" /> {{ $t('file.batchDelete') }}
      </Button>
      <Button size="sm" variant="outline" @click="clearSelection">
        {{ $t('file.clearSelection') }}
      </Button>
    </div>
    
    <Dialog v-model="showUpload" width="800px">
      <DialogHeader>
        <DialogTitle>{{ $t('file.upload.title') }}</DialogTitle>
      </DialogHeader>
      <EnhancedFileUpload
        ref="uploadRef"
        :upload-url="uploadUrl"
        @success="onUploadSuccess"
      />
    </Dialog>
    
    <Dialog v-model="showPreview" width="80%" top="5vh">
      <DialogHeader>
        <DialogTitle>{{ previewFile?.name }}</DialogTitle>
      </DialogHeader>
      <UnifiedViewer v-if="previewData" :url="previewData.url" :file-name="previewData.name" />
    </Dialog>
    
    <Dialog v-model="showShare" width="400px">
      <DialogHeader>
        <DialogTitle>{{ $t('file.share.title') }}</DialogTitle>
      </DialogHeader>
      <div v-if="shareData" class="share-dialog">
        <div class="flex">
          <Input v-model="shareData.url" readonly />
          <Button variant="outline" @click="copyShareUrl">{{ $t('common.copy') }}</Button>
        </div>
        <div class="share-options">
          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium text-foreground">{{ $t('file.share.expires') }}</label>
            <Select v-model="shareData.expiresIn" style="width: 100%">
              <SelectOption :label="$t('file.share.1hour')" :value="1" />
              <SelectOption :label="$t('file.share.1day')" :value="24" />
              <SelectOption :label="$t('file.share.7days')" :value="168" />
              <SelectOption :label="$t('file.share.forever')" :value="null" />
            </Select>
          </div>
          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium text-foreground">{{ $t('file.share.password') }}</label>
            <Input v-model="shareData.password" :placeholder="$t('file.share.passwordHint')" />
          </div>
        </div>
      </div>
    </Dialog>
    
    <Dialog v-model="showVersions" width="700px">
      <DialogHeader>
        <DialogTitle>{{ $t('file.versions.title') }}</DialogTitle>
      </DialogHeader>
      <div v-if="versionLoading" class="loading-container">
        <Loading class="h-4 w-4 is-loading" />
      </div>
      <div v-else-if="versions.length === 0" class="empty-state">
        {{ $t('file.versions.empty') }}
      </div>
      <div v-else>
        <div class="version-toolbar">
          <Button size="sm" variant="outline" @click="showDiffDialog = true">
            <Switch class="h-4 w-4" />
            {{ $t('file.versions.compare') }}
          </Button>
        </div>
        <div class="version-list">
          <div v-for="v in versions" :key="v.version_id" class="version-item">
            <div class="version-info">
              <span class="version-number">v{{ v.version_number }}</span>
              <span v-if="v.is_current" class="version-current">{{ $t('file.versions.current') }}</span>
              <span class="version-meta">
                {{ formatSize(v.file_size ?? 0) }} · {{ formatDate(v.created_at ?? '') }}
              </span>
              <span v-if="v.change_summary" class="version-summary">{{ v.change_summary }}</span>
            </div>
            <div class="version-actions">
              <Button size="sm" variant="outline" @click="downloadVersion(v.version_id!, v.version_number!)">
                {{ $t('file.download') }}
              </Button>
              <Button v-if="!v.is_current" size="sm" variant="secondary" @click="rollbackVersion(v.version_id!)">
                {{ $t('file.versions.rollback') }}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="showNewVersion = true">{{ $t('file.versions.new') }}</Button>
      </DialogFooter>
    </Dialog>

    <Dialog v-model="showDiffDialog" width="900px">
      <DialogHeader>
        <DialogTitle>{{ $t('file.versions.diff') }}</DialogTitle>
      </DialogHeader>
      <VersionDiff v-if="currentVersionFile" :file-id="currentVersionFile.id" :versions="versions" />
    </Dialog>

    <Dialog v-model="showNewVersion" width="500px">
      <DialogHeader>
        <DialogTitle>{{ $t('file.versions.new') }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-2">
        <div
          class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center cursor-pointer hover:bg-accent/50"
          @click="versionFileInputRef?.click()"
          @drop.prevent="onVersionFileDrop"
          @dragover.prevent
        >
          <Upload class="h-4 w-4" />
          <div class="text-sm text-muted-foreground">{{ t('fileManager.dropUpload') }}</div>
          <input ref="versionFileInputRef" type="file" class="hidden" @change="onVersionInputChange" />
        </div>
        <div v-if="newVersionFile" class="flex items-center justify-between rounded-md border border-border p-2 text-sm">
          <span class="truncate">{{ newVersionFile.name }}</span>
          <button type="button" class="text-muted-foreground hover:text-foreground" @click="removeVersionFile">×</button>
        </div>
      </div>
      <Input v-model="newVersionSummary" :placeholder="$t('file.versions.summary')" style="margin-top: 16px" />
      <DialogFooter>
        <Button variant="outline" @click="showNewVersion = false">{{ $t('common.cancel') }}</Button>
        <Button variant="default" @click="uploadNewVersion">
          {{ $t('common.upload') }}
        </Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage, ElMessageBox } from '@/utils/message'
import {
  Upload, Refresh, Grid, List, More, View, Download, Share, Delete,
  Document, Picture, VideoPlay, Headset, Clock, Loading, Switch
} from '@/lib/lucide-fallback'
import EnhancedFileUpload from './EnhancedFileUpload.vue'
import UnifiedViewer from './viewers/UnifiedViewer.vue'
import VersionDiff from './VersionDiff.vue'
import { useFileShare } from '@/utils/fileShare'
import { useBatchDownload } from '@/utils/batchOperations'
import { formatFileSize } from '@/utils/fileValidation'
import { useFileVersion, type VersionInfo } from '@/utils/fileVersion'
import { formatTime } from '@/utils/format'
import { Card } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Button from '@/components/ui/Button.vue'
import { Radio } from '@/components/ui/radio'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Empty } from '@/components/ui/empty'
import { Select, SelectOption } from '@/components/ui/select'

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

const versionFileInputRef = ref<HTMLInputElement | null>(null)
function onVersionInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []
  target.value = ''
  if (!files.length) return
  handleNewVersionFile({ raw: files[0] })
}
function onVersionFileDrop(e: DragEvent) {
  const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
  if (!files.length) return
  handleNewVersionFile({ raw: files[0] })
}
function removeVersionFile() {
  newVersionFile.value = null
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

function onUploadSuccess(_uploadedFiles: unknown[]) {
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
  color: hsl(var(--muted-foreground));
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
  background: hsl(var(--muted));
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  background: hsl(var(--muted));
}

.file-item.selected {
  background: hsl(var(--primary));
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
  background: hsl(var(--muted));
  border-radius: var(--global-border-radius);
}

.file-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--global-border-radius);
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
  color: hsl(var(--muted-foreground));
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
  background: hsl(var(--background));
  border-radius: var(--global-border-radius);
  box-shadow: hsl(var(--border));
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
  background: hsl(var(--muted));
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
  color: hsl(var(--primary));
  margin-left: 8px;
}

.version-meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.version-summary {
  font-size: 12px;
  color: hsl(var(--foreground));
}

.version-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: hsl(var(--muted-foreground));
}
</style>
