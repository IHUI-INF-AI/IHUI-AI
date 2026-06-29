<template>
  <el-drawer
    v-model="visible"
    :title="t('resourceLibrary.title')"
    direction="rtl"
    size="50%"
    class="resource-library-drawer"
  >
    <div class="library-toolbar">
      <el-input
        v-model="searchQuery"
        :placeholder="t('resourceLibrary.search')"
        clearable
        class="search-input"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>

      <div class="filters">
        <el-select
          v-model="filterType"
          :placeholder="t('resourceLibrary.type')"
          clearable
          style="width: 120px"
        >
          <el-option :label="t('resourceLibrary.all')" value="" />
          <el-option :label="t('resourceLibrary.image')" value="image" />
          <el-option :label="t('resourceLibrary.video')" value="video" />
          <el-option :label="t('resourceLibrary.3d')" value="3d" />
        </el-select>

        <el-select
          v-model="filterModel"
          :placeholder="t('resourceLibrary.model')"
          clearable
          style="width: 140px"
        >
          <el-option :label="t('resourceLibrary.all')" value="" />
          <el-option
            v-for="model in availableModels"
            :key="model"
            :label="model"
            :value="model"
          />
        </el-select>

        <el-checkbox v-model="showFavorites">
          <el-icon><Star /></el-icon>
          {{ t('resourceLibrary.favorites') }}
        </el-checkbox>
      </div>

      <div class="view-toggle">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="grid">
            <el-icon><Grid /></el-icon>
          </el-radio-button>
          <el-radio-button value="list">
            <el-icon><List /></el-icon>
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="library-stats">
      <span>{{ t('resourceLibrary.total', { count: filteredResources.length }) }}</span>
      <span v-if="selectedResources.length > 0" class="selected-count">
        {{ t('resourceLibrary.selected', { count: selectedResources.length }) }}
      </span>
    </div>

    <div class="library-content" :class="[`view-${viewMode}`]">
      <template v-if="filteredResources.length > 0">
        <div
          v-for="resource in filteredResources"
          :key="resource.id"
          class="resource-item"
          :class="{
            'is-selected': selectedResources.includes(resource.id),
            'is-favorite': resource.favorite,
          }"
          @click="handleSelect(resource)"
          @dblclick="handlePreview(resource)"
        >
          <div class="resource-thumbnail">
            <el-image
              v-if="resource.type === 'image'"
              :src="resource.thumbnailUrl || resource.url"
              fit="cover"
              lazy
            >
              <template #placeholder>
                <div class="placeholder">
                  <el-icon class="is-loading"><Loading /></el-icon>
                </div>
              </template>
              <template #error>
                <div class="placeholder error">
                  <el-icon><PictureFilled /></el-icon>
                </div>
              </template>
            </el-image>
            
            <div v-else-if="resource.type === 'video'" class="video-thumbnail">
              <el-image
                :src="resource.thumbnailUrl"
                fit="cover"
                lazy
              />
              <div class="video-overlay">
                <el-icon><VideoPlay /></el-icon>
                <span v-if="resource.metadata.duration" class="duration">
                  {{ formatDuration(resource.metadata.duration) }}
                </span>
              </div>
            </div>
            
            <div v-else class="model-thumbnail">
              <el-icon><Box /></el-icon>
            </div>

            <div v-if="selectedResources.includes(resource.id)" class="select-indicator">
              <el-icon><Check /></el-icon>
            </div>

            <button
              class="favorite-btn"
              :class="{ 'is-active': resource.favorite }"
              @click.stop="toggleFavorite(resource)"
            >
              <el-icon><Star /></el-icon>
            </button>

            <el-tag class="type-tag" size="small" :type="getTypeTagType(resource.type)">
              {{ getTypeLabel(resource.type) }}
            </el-tag>
          </div>

          <div class="resource-info">
            <div class="resource-prompt" :title="resource.prompt">
              {{ truncateText(resource.prompt, 50) }}
            </div>
            <div class="resource-meta">
              <span class="meta-item">
                <el-icon><Cpu /></el-icon>
                {{ resource.model }}
              </span>
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                {{ formatDate(resource.createdAt) }}
              </span>
            </div>
          </div>

          <div v-if="viewMode === 'list'" class="resource-actions">
            <el-button size="small" @click.stop="handleCopy(resource)">
              <el-icon><DocumentCopy /></el-icon>
            </el-button>
            <el-button size="small" @click.stop="handleDownload(resource)">
              <el-icon><Download /></el-icon>
            </el-button>
            <el-button size="small" type="danger" @click.stop="handleDelete(resource)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </template>

      <div v-else class="empty-state">
        <el-empty :description="t('resourceLibrary.empty')" />
      </div>
    </div>

    <template #footer>
      <div class="library-footer">
        <div class="footer-left">
          <el-button
            v-if="selectedResources.length > 0"
            @click="clearSelection"
          >
            {{ t('resourceLibrary.clearSelection') }}
          </el-button>
        </div>
        <div class="footer-right">
          <el-button @click="handleClose">
            {{ t('common.cancel') }}
          </el-button>
          <el-button
            type="primary"
            :disabled="selectedResources.length === 0"
            @click="handleUse"
          >
            {{ t('resourceLibrary.use') }} ({{ selectedResources.length }})
          </el-button>
        </div>
      </div>
    </template>

    <el-dialog
      v-model="showPreview"
      :title="previewResource?.prompt"
      width="80%"
      class="preview-dialog"
    >
      <div v-if="previewResource" class="preview-content">
        <el-image
          v-if="previewResource.type === 'image'"
          :src="previewResource.url"
          fit="contain"
          style="max-height: 70vh; width: 100%;"
        />
        <video
          v-else-if="previewResource.type === 'video'"
          :src="previewResource.url"
          controls
          preload="none"
          style="max-height: 70vh; width: 100%;"
        />
      </div>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Star,
  Grid,
  List,
  Loading,
  PictureFilled,
  VideoPlay,
  Box,
  Check,
  Cpu,
  Clock,
  DocumentCopy,
  Download,
  Delete,
} from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useNotificationCenter } from '@/composables/useNotificationCenter'
import type { GeneratedResource, GenerationType } from '@/types/ai-platform.types'

// ============================================================================
// Props & Emits
// ============================================================================

const props = withDefaults(defineProps<{
  modelValue?: boolean
  resources?: GeneratedResource[]
  multiple?: boolean
}>(), {
  modelValue: false,
  resources: () => [],
  multiple: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', resources: GeneratedResource[]): void
}>()

// ============================================================================
// Setup
// ============================================================================

const { t } = useI18n()
const { showSuccess, showConfirm } = useNotificationCenter()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const searchQuery = ref('')
const filterType = ref('')
const filterModel = ref('')
const showFavorites = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')
const selectedResources = ref<string[]>([])
const showPreview = ref(false)
const previewResource = ref<GeneratedResource | null>(null)

const availableModels = computed(() => {
  const models = new Set(props.resources.map((r: GeneratedResource) => r.model))
  return Array.from(models)
})

const filteredResources = computed(() => {
  let result = [...props.resources]
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((r: GeneratedResource) =>
      r.prompt.toLowerCase().includes(query) ||
      r.model.toLowerCase().includes(query) ||
      r.tags.some((tag: string) => tag.toLowerCase().includes(query))
    )
  }
  
  if (filterType.value) {
    result = result.filter(r => r.type === filterType.value)
  }
  
  if (filterModel.value) {
    result = result.filter(r => r.model === filterModel.value)
  }
  
  if (showFavorites.value) {
    result = result.filter(r => r.favorite)
  }
  
  result.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  return result
})

const handleSelect = (resource: GeneratedResource) => {
  if (props.multiple) {
    const index = selectedResources.value.indexOf(resource.id)
    if (index >= 0) {
      selectedResources.value.splice(index, 1)
    } else {
      selectedResources.value.push(resource.id)
    }
  } else {
    selectedResources.value = [resource.id]
  }
}

const handlePreview = (resource: GeneratedResource) => {
  previewResource.value = resource
  showPreview.value = true
}

const toggleFavorite = (resource: GeneratedResource) => {
  resource.favorite = !resource.favorite
  showSuccess(resource.favorite ? t('resourceLibrary.addedToFavorite') : t('resourceLibrary.removedFromFavorite'))
}

const handleCopy = async (resource: GeneratedResource) => {
  try {
    await navigator.clipboard.writeText(resource.prompt)
    showSuccess(t('resourceLibrary.promptCopied'))
  } catch {
    showSuccess(t('resourceLibrary.copyFailed'))
  }
}

const handleDownload = (resource: GeneratedResource) => {
  const link = document.createElement('a')
  link.href = resource.url
  link.download = `${resource.type}-${resource.id}.${resource.metadata.format}`
  link.click()
}

const handleDelete = async (_resource: GeneratedResource) => {
  const confirmed = await showConfirm(t('resourceLibrary.confirmDelete'), t('resourceLibrary.deleteResource'))
  if (confirmed) {
    showSuccess(t('resourceLibrary.deleted'))
  }
}

const clearSelection = () => {
  selectedResources.value = []
}

const handleClose = () => {
  visible.value = false
}

const handleUse = () => {
  const selected = props.resources.filter((r: GeneratedResource) => 
    selectedResources.value.includes(r.id)
  )
  emit('select', selected)
  visible.value = false
}

const getTypeTagType = (type: GenerationType): '' | 'success' | 'warning' | 'info' => {
  const types: Record<GenerationType, '' | 'success' | 'warning' | 'info'> = {
    image: '',
    video: 'success',
    '3d': 'warning',
    audio: 'info',
    text: 'info',
  }
  return types[type]
}

const getTypeLabel = (type: GenerationType): string => {
  const labels: Record<GenerationType, string> = {
    image: t('resourceLibrary.image'),
    video: t('resourceLibrary.video'),
    '3d': t('resourceLibrary.3dLabel'),
    audio: t('resourceLibrary.audio'),
    text: t('resourceLibrary.text'),
  }
  return labels[type]
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatDate = (date: string | number): string => {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

watch(visible, (val) => {
  if (!val) {
    selectedResources.value = []
    previewResource.value = null
    showPreview.value = false
  }
})
</script>

<style scoped lang="scss">
.resource-library-drawer {
  :deep(.el-drawer__body) {
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.library-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-bottom: var(--unified-border-bottom);
  flex-wrap: wrap;
  
  .search-input {
    width: 200px;
  }
  
  .filters {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }
  
  .view-toggle {
    flex-shrink: 0;
  }
}

.library-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  
  .selected-count {
    color: var(--el-color-primary);
    font-weight: 500;
  }
}

.library-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  
  &.view-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    
    .resource-item {
      display: flex;
      flex-direction: column;
      border-radius: var(--global-border-radius);
      overflow: hidden;
      background: var(--el-fill-color-light);
      transition: all 0.2s;
      cursor: pointer;
      
      &:hover {
        box-shadow: var(--global-box-shadow);
        transform: translateY(-2px);
      }
      
      &.is-selected {
        outline: 2px solid var(--el-color-primary);
      }
    }
    
    .resource-thumbnail {
      position: relative;
      aspect-ratio: 16 / 9;
      
      .el-image {
        width: 100%;
        height: 100%;
      }
    }
    
    .resource-info {
      padding: 10px;
    }
    
    .resource-actions {
      display: none;
    }
  }
  
  &.view-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .resource-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-radius: var(--global-border-radius);
      background: var(--el-fill-color-light);
      cursor: pointer;
      
      &:hover {
        background: var(--el-fill-color);
      }
      
      &.is-selected {
        background: var(--el-color-primary-light-9);
      }
    }
    
    .resource-thumbnail {
      position: relative;
      width: 80px;
      height: 60px;
      flex-shrink: 0;
      border-radius: var(--global-border-radius);
      overflow: hidden;
      
      .el-image {
        width: 100%;
        height: 100%;
      }
    }
    
    .resource-info {
      flex: 1;
      min-width: 0;
    }
    
    .resource-actions {
      display: flex;
      gap: 4px;
    }
  }
}

.resource-thumbnail {
  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color);
    
    &.error {
      color: var(--el-text-color-placeholder);
    }
  }
  
  .video-thumbnail {
    position: relative;
    width: 100%;
    height: 100%;
    
    .video-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-black-30);
      color: var(--el-bg-color-page);
      
      .el-icon {
        font-size: 32px;
      }
      
      .duration {
        position: absolute;
        bottom: 4px;
        right: 4px;
        padding: 2px 6px;
        background: var(--color-black-70);
        border-radius: var(--global-border-radius);
        font-size: 12px;
      }
    }
  }
  
  .model-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color);
    
    .el-icon {
      font-size: 40px;
      color: var(--el-text-color-secondary);
    }
  }
  
  .select-indicator {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-color-primary);
    color: var(--el-bg-color-page);
    border-radius: var(--global-border-radius-sm, 4px);
  }
  
  .favorite-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-black-50);
    border: none;
    border-radius: var(--global-border-radius-sm, 4px);
    color: var(--el-bg-color-page);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    
    &.is-active {
      opacity: 1;
      color: var(--el-color-warning);
    }
  }
  
  .type-tag {
    position: absolute;
    bottom: 8px;
    left: 8px;
  }
  
  &:hover .favorite-btn {
    opacity: 1;
  }
}

.resource-info {
  .resource-prompt {
    font-size: 13px;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .resource-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

.empty-state {
  padding: 60px 20px;
}

.library-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .footer-right {
    display: flex;
    gap: 8px;
  }
}

.preview-dialog {
  .preview-content {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
