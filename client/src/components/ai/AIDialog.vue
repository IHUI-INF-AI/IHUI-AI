<template>
  <div class="ai-dialog">
    <VoiceRecordingAnimation v-if="!isMinimized" :is-recording="isRecording" @stop="handleVoiceStop" />
    <ImageList v-if="imageListData.length > 0 && !isMinimized" :imgs-list="imageListData" @remove-image="handleRemoveImage" />
    <div 
      v-show="!isMinimized"
      ref="inputWrapperElementRef"
      class="input-wrapper" 
      :class="{ 
        'agent-mode': props.currentMode === 'agent',
        'is-hidden': props.isScrolledToBottom,
        'is-overlapping': props.isScrolledToBottom
      }"
      :data-scrolled-to-bottom="props.isScrolledToBottom"
    >
          <div class="header-top">
            <div class="dialog-title">
                <el-icon class="title-icon">
                  <ChatLineRound v-if="props.currentMode !== 'agent'" />
                  <Cpu v-else />
                </el-icon>
                <span class="title-text">{{ resolvedTitle }}</span>
                <el-tag
                  v-if="selectedModel && showModelSelector && props.currentMode !== 'agent'"
                  size="small"
                  class="model-tag"
                  :type="getModelTagType(selectedModel)"
                >
                  {{ getModelDisplayName(selectedModel) }}
                </el-tag>
                <el-tag
                  v-if="props.currentMode === 'agent'"
                  size="small"
                  class="model-tag agent-tag"
                  type="success"
                >
                  <el-icon class="tag-icon"><Cpu /></el-icon>
                  <span class="agent-tag-text">{{ t('chatMode.agentMode') }}</span>
                </el-tag>
            </div>
            <div class="header-right">
              <el-button
                v-if="enableSearch"
                link
                circle
                size="small"
                @click="toggleSearch"
                class="header-btn"
                :title="showSearch ? t('llmChatCenter.actions.closeSearch') : t('llmChatCenter.actions.searchMessages')"
              >
                <SearchIcon />
              </el-button>
              <el-button
                link
                circle
                size="small"
                @click="emit('toggleHistoryDrawer')"
                class="header-btn"
                :title="t('aiChat.history')"
              >
                <el-icon><Clock /></el-icon>
              </el-button>
              <el-dropdown v-if="showMenu" trigger="click" @command="handleHeaderMenuCommand">
                <el-button link circle size="small" class="header-btn" :title="t('common.moreActions')">
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="history">
                      <el-icon><Clock /></el-icon>
                      <span>{{ t('aiChat.history') }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="export" divided>
                      <el-icon><Download /></el-icon>
                      <span>{{ t('llmChatCenter.actions.exportChat') }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="clear">
                      <el-icon><Delete /></el-icon>
                      <span>{{ t('llmChatCenter.actions.clearChat') }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="stats">
                      <el-icon><DataAnalysis /></el-icon>
                      <span>{{ t('llmChatCenter.actions.viewStats') }}</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button 
                link 
                circle 
                size="small" 
                @click="toggleMinimize" 
                class="header-btn" 
                :title="props.isMinimized ? t('common.restore') : t('common.minimize')"
              >
                <el-icon><Minus /></el-icon>
              </el-button>
              <el-button 
                link 
                circle 
                size="small" 
                @click="handleClose" 
                class="header-btn" 
                :title="t('llmChatCenter.actions.close')"
              >
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="input-row">
            <textarea
              v-if="props.currentMode !== 'agent'"
              v-model="localInputText"
              ref="inputRef"
              :placeholder="combinedPlaceholder"
              class="chat-input"
              rows="1"
              @keydown.enter.exact.prevent="handleSendMessage"
              @keydown.enter.shift.exact="handleShiftEnter"
              @input="handleInput"
            ></textarea>
            <el-input
              v-else
              v-model="localInputText"
              ref="inputRef"
              @keyup.enter="handleAgentSendMessage"
              :placeholder="t('agentChat.inputMessagePlaceholder')"
              :disabled="isSending"
              type="textarea"
              :rows="3"
              class="agent-textarea-input"
              @input="handleInput"
            />
          </div>
          <div class="input-actions">
              <el-button
                v-if="enableVoice"
                link
                circle
                size="small"
                @click="handleVoiceToggle"
                :disabled="isRecording"
                class="input-action-btn"
                :title="t('aiChatInput.voiceInput')"
              >
                <el-icon><Microphone /></el-icon>
              </el-button>
              <el-dropdown v-if="enableFileUpload" trigger="click" @command="triggerFileUpload">
                <el-button link circle size="small" class="input-action-btn" :title="t('aiChatInput.uploadFile')">
                  <el-icon><Plus /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="image">
                      <el-icon><Picture /></el-icon>
                      <span>{{ t('commonText.fileTypes.image') }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="video">
                      <el-icon><VideoPlay /></el-icon>
                      <span>{{ t('commonText.fileTypes.video') }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="audio">
                      <el-icon><Upload /></el-icon>
                      <span>{{ t('commonText.fileTypes.audio') }}</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button
                link
                size="small"
                @click="toggleAgentMode"
                class="input-action-btn agent-mode-btn"
                :class="{ 'is-active': props.currentMode === 'agent' }"
                :title="props.currentMode === 'agent' ? t('chatMode.exitAgentMode') : t('chatMode.enterAgentMode')"
              >
                <span class="agent-mode-text">{{ props.currentMode === 'agent' ? t('chatMode.agentMode') : t('chatMode.normalMode') }}</span>
              </el-button>
              <el-dropdown v-if="showModelSelector && props.currentMode !== 'agent'" trigger="click" @command="handleModelSelect">
                <el-button link circle size="small" class="input-action-btn" :title="t('aiChatInput.selectModel')">
                  <el-icon class="model-icon">
                    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="18" height="18" style="width: 18px; height: 18px; fill: currentcolor;">
                      <path d="M830.976 184.32l124.416 71.68v176.64l-211.456 122.368-0.512-171.52L611.84 307.2l219.136-122.88z m-94.208-54.272l-217.088 124.416-224.256-129.536L511.488 0l225.28 130.048zM284.16 892.416L68.096 768v-233.984l216.064 123.904v234.496z m89.088 51.712v-235.008l140.288 80.384 139.264-80.384-1.024 233.984L511.488 1024l-138.24-79.872zM430.592 305.152L284.672 388.608l-0.512 164.352-216.064-125.952V256l138.752-79.872 223.744 129.024z m91.136 52.224l133.12 76.8-1.024 172.032-139.776 80.896-140.288-81.92V439.808l147.968-82.432z m433.152 177.152V768l-210.432 121.344-0.512-232.96 210.944-121.856z" fill="currentColor" />
                    </svg>
                  </el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu class="model-selector-dropdown">
                    <div class="model-selector-header">
                      <h3 class="model-selector-title">{{ t('home.input.model') }}</h3>
                      <div class="model-auto-switch-wrapper">
                        <span 
                          class="auto-label" 
                          :class="{ 'is-active': localIsAutoModel }"
                          @click="localIsAutoModel = !localIsAutoModel"
                        >
                          {{ localIsAutoModel ? t('home.input.auto') : t('home.input.manual') }}
                        </span>
                      </div>
                    </div>
                    <el-tabs v-model="localActiveTab" class="model-category-tabs">
                      <el-tab-pane :label="t('home.input.tabs.image')" name="image"/>
                      <el-tab-pane :label="t('home.input.tabs.video')" name="video"/>
                      <el-tab-pane :label="t('home.input.tabs.text')" name="text"/>
                      <el-tab-pane :label="t('home.input.tabs.3d')" name="3d"/>
                      <el-tab-pane :label="t('home.input.tabs.voice')" name="voice"/>
                      <el-tab-pane :label="t('home.input.tabs.digitalHuman')" name="digitalHuman"/>
                      <el-tab-pane :label="t('home.input.tabs.universal')" name="universal"/>
                    </el-tabs>
                    <div v-if="loadingModels" class="model-loading">
                      <el-icon size="16"><Loading/></el-icon>
                      <span>{{ t('common.loading') }}</span>
                    </div>
                    <div v-else-if="modelList.length===0" class="tab-empty">
                      {{ t('home.input.noModelData') }}
                    </div>
                    <div v-else class="model-list-container">
                      <div
                        v-for="item in modelList"
                        :key="item.modelCode"
                        class="model-item-card"
                        :class="{ 
                          'is-selected': localSelectedModel === item.modelCode,
                          'is-disabled': localIsAutoModel
                        }"
                        @click="handleModelItemClick(item.modelCode)"
                      >
                        <div class="model-item-icon">
                          <img
                            v-if="getModelIcon(item)"
                            :src="getModelIcon(item)"
                            :alt="item.modelName"
                            class="model-icon-img"
                            loading="lazy"
                          />
                          <el-icon v-else class="model-icon-default">
                            <Cpu />
                          </el-icon>
                        </div>
                        <div class="model-item-info">
                          <div class="model-item-name-wrapper">
                            <div class="model-item-name">
                              {{ item.modelName }}
                              <!-- 热门标识：火焰图标 -->
                              <span v-if="item.is_top == 1 || item.is_top === true || item.is_top === '1' || String(item.is_top) === '1'" class="model-badge model-badge-top" :title="t('hardcoded.a_i_dialog.热门')">
                                <img :src="fireIconSrc" :alt="t('hardcoded.a_i_dialog.热门2')" class="fire-icon" loading="lazy" />
                              </span>
                              <!-- 新模型标识：New 标签 -->
                              <span v-if="item.is_new == 1 || item.is_new === true || item.is_new === '1' || String(item.is_new) === '1'" class="model-badge model-badge-new" :title="t('hardcoded.a_i_dialog.新模型1')">New</span>
                              <!-- API 接入：与能力面板统一，</> + API 文案 -->
                              <el-tooltip :content="t('home.input.apiAccess')" placement="top">
                                <button
                                  type="button"
                                  class="model-api-btn"
                                  aria-label="API 接入"
                                  @click.stop="handleModelApiClick(item.modelCode)"
                                >
                                  <span class="model-api-btn__icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                      <path d="M5 6l6 6-6 6M13 5l2 14M19 6l-6 6 6 6" />
                                    </svg>
                                  </span>
                                  <span class="model-api-btn__text">API</span>
                                </button>
                              </el-tooltip>
                            </div>
                          </div>
                          <div v-if="item.modelDesc" class="model-item-desc">{{ item.modelDesc }}</div>
                          <!-- 模型能力指示器 -->
                          <div v-if="hasCapabilities(item)" class="model-capabilities">
                            <span v-if="item.supportsStreaming" class="capability-tag capability-streaming" :title="t('model.capabilities.streaming')">
                              {{ t('model.capabilities.streamingShort') }}
                            </span>
                            <span v-if="item.supportsImages" class="capability-tag capability-image" :title="t('model.capabilities.image')">
                              <el-icon><Picture /></el-icon>
                            </span>
                            <span v-if="item.supportsAudio" class="capability-tag capability-audio" :title="t('model.capabilities.audio')">
                              <el-icon><Microphone /></el-icon>
                            </span>
                            <span v-if="item.supportsVideo" class="capability-tag capability-video" :title="t('model.capabilities.video')">
                              <el-icon><VideoPlay /></el-icon>
                            </span>
                          </div>
                          <!-- 只对图片和视频模型显示处理时间 -->
                          <div v-if="shouldShowProcessingTime(item)" class="model-time-tag">
                            {{ item.processingTime || getDefaultProcessingTime(item) }}
                          </div>
                        </div>
                        <label class="custom-checkbox model-checkbox" :class="{ 'is-disabled': localIsAutoModel }">
                          <input
                            type="checkbox"
                            :checked="localSelectedModel === item.modelCode"
                            :disabled="localIsAutoModel"
                            @change="handleModelCheckboxChange(item.modelCode, ($event.target as HTMLInputElement).checked)"
                            @click.stop="handleCheckboxClick($event)"
                          />
                          <span class="checkmark"></span>
                        </label>
                      </div>
                    </div>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button
                v-if="props.currentMode === 'agent'"
                link
                circle
                size="small"
                @click="toggleReasoning"
                class="input-action-btn reasoning-btn"
                :class="{ 'is-active': showReasoning }"
                :title="showReasoning ? t('agentChat.hideReasoning') : t('agentChat.showReasoning')"
              >
                <el-icon><Cpu /></el-icon>
              </el-button>
              <el-button
                type="primary"
                :loading="isSending"
                :disabled="!localInputText.trim() || isSending"
                @click="props.currentMode === 'agent' ? handleAgentSendMessage() : handleSendMessage()"
                class="send-btn"
              >
                <el-icon><Promotion /></el-icon>
                <span>{{ t('aiChatInput.send') }}</span>
              </el-button>
          </div>
        </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'
import {
  ChatLineRound,
  MoreFilled,
  Download,
  Delete,
  DataAnalysis,
  Close,
  Microphone,
  Upload,
  Plus,
  Picture,
  VideoPlay,
  Cpu,
  Promotion,
  Loading,
  Clock,
  Minus
} from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import VoiceRecordingAnimation from './VoiceRecordingAnimation.vue'
import ImageList from '../InputArea/ImageList.vue'

type ChatMode = 'global' | 'dialog' | 'agent'
type FileUploadType = 'image' | 'video' | 'audio'

const MIN_TEXTAREA_HEIGHT = 40
const MAX_TEXTAREA_HEIGHT = 120
const DEFAULT_MODE = 'dialog'
const DEFAULT_ACTIVE_TAB = 'text'
// 开发环境标志，用于调试输出
const IS_DEV = import.meta.env.DEV // 在 script 中定义，避免在模板中使用 import.meta

interface ModelInfo {
  modelCode: string
  modelName: string
  modelDesc?: string
  provider?: string
  id?: string
  supportsStreaming?: boolean
  supportsImages?: boolean
  supportsAudio?: boolean
  supportsVideo?: boolean
  tags?: string[]
  icon?: string
  processingTime?: string // 处理时间，如 "20s", "10s"
  is_new?: number // 是否为新模型 (1=是, 0=否)
  is_top?: number // 是否为热门模型 (1=是, 0=否)
  category?: string
  isDigitalHuman?: boolean
  isUniversal?: boolean
}

interface ModelInfoExtended extends ModelInfo {
  category?: string
  isDigitalHuman?: boolean
  isUniversal?: boolean
}

interface ImageData {
  url: string
  name?: string
  size?: number
  type?: string
}

interface Props {
  title?: string
  currentMode?: 'global' | 'dialog' | 'agent'
  selectedModel?: string
  showModelSelector?: boolean
  enableSearch?: boolean
  showMenu?: boolean
  isMinimized?: boolean
  inputText?: string
  isSending?: boolean
  isRecording?: boolean
  showReasoning?: boolean
  enableVoice?: boolean
  enableFileUpload?: boolean
  actualInputPlaceholder?: string
  imageListData?: ImageData[]
  isAutoModel?: boolean
  isDarkMode?: boolean
  activeTab?: string
  loadingModels?: boolean
  modelList?: ModelInfo[]
  isScrolledToBottom?: boolean // 是否滚动到底部
  showHistoryDrawer?: boolean // 是否显示历史对话抽屉
}

const { t } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  // 注意：不能在这里使用 t()，因为 defineProps 会被提升到 setup 外部
  // 使用空字符串作为默认值，在组件内部通过计算属性处理国际化
  title: '',
  currentMode: DEFAULT_MODE,
  selectedModel: '',
  showModelSelector: true,
  enableSearch: true,
  showMenu: true,
  isMinimized: false,
  inputText: '',
  isSending: false,
  isRecording: false,
  showReasoning: false,
  enableVoice: true,
  enableFileUpload: true,
  // 注意：不能在这里使用 t()，因为 defineProps 会被提升到 setup 外部
  // 使用空字符串作为默认值，在组件内部通过计算属性处理国际化
  actualInputPlaceholder: '',
  imageListData: () => [],
  isAutoModel: true,
  isDarkMode: false,
  activeTab: DEFAULT_ACTIVE_TAB,
  loadingModels: false,
  modelList: () => [],
  isScrolledToBottom: false,
  showHistoryDrawer: false
})

// 解析 title，如果为空则使用默认的国际化文本
const resolvedTitle = computed(() => {
  return props.title || t('aiChat.title')
})

const emit = defineEmits<{
  'update:inputText': [value: string]
  'update:selectedModel': [value: string]
  'update:isMinimized': [value: boolean]
  'update:isAutoModel': [value: boolean]
  'update:activeTab': [value: string]
  'update:showReasoning': [value: boolean]
  'modeChange': [mode: ChatMode]
  'toggleSearch': [value: boolean]
  'headerMenuCommand': [command: string]
  'handleClose': []
  'sendMessage': []
  'agentSendMessage': []
  'voiceToggle': []
  'voiceStop': []
  'fileUpload': [type: FileUploadType]
  'removeImage': [index: number]
  'input': []
  'shiftEnter': []
  'modelSelect': [model: string]
  'toggleHistoryDrawer': []
}>()

const router = useRouter()
const inputRef = ref<HTMLTextAreaElement | null>(null)
const inputWrapperElementRef = ref<HTMLElement | null>(null)
const cleanup = useCleanup()

// 暴露 input-wrapper 元素引用，供父组件使用
defineExpose({
  inputWrapperElement: inputWrapperElementRef
})

const showSearch = ref(false)
const inputHeight = ref(MIN_TEXTAREA_HEIGHT)

const MODEL_TAG_TYPES: Record<string, string> = {
  'gpt-4': 'danger',
  'gpt-3.5': 'warning',
  'claude': 'success'
}

const getModelTagType = (model: string): string => {
  for (const [key, type] of Object.entries(MODEL_TAG_TYPES)) {
    if (model.includes(key)) return type
  }
  return 'info'
}

const getModelDisplayName = (model: string): string => {
  const modelInfo = props.modelList?.find((m: ModelInfo) => m.modelCode === model)
  return modelInfo?.modelName || model
}

const adjustTextareaHeight = (): void => {
  if (!inputRef.value) return
  
  // 智能体模式使用 el-input textarea，不需要手动调整高度
  if (props.currentMode === 'agent') {
    return
  }
  
  const textarea = inputRef.value as HTMLTextAreaElement
  if (textarea.tagName === 'TEXTAREA') {
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)
    textarea.style.height = `${newHeight}px`
    inputHeight.value = newHeight
  }
}

const toggleAgentMode = (): void => {
  const newMode: ChatMode = props.currentMode === 'agent' ? 'dialog' : 'agent'
  emit('modeChange', newMode)
}

const toggleSearch = (): void => {
  showSearch.value = !showSearch.value
  emit('toggleSearch', showSearch.value)
}

const handleHeaderMenuCommand = (command: string): void => {
  emit('headerMenuCommand', command)
}

// 切换最小化状态
const toggleMinimize = (): void => {
  if (IS_DEV) {
    logger.debug('[AIDialog] toggleMinimize called, current state:', props.isMinimized)
  }
  emit('update:isMinimized', !props.isMinimized)
}

const handleClose = (): void => {
  emit('handleClose')
}

const handleSendMessage = (): void => {
  emit('sendMessage')
}

const handleAgentSendMessage = (): void => {
  emit('agentSendMessage')
}

const handleVoiceToggle = (): void => {
  emit('voiceToggle')
}

const handleVoiceStop = (audioData?: { audioUrl: string; duration: number }): void => {
  emit('voiceStop', audioData)
}

const triggerFileUpload = (type: FileUploadType): void => {
  emit('fileUpload', type)
}

const handleRemoveImage = (index: number): void => {
  emit('removeImage', index)
}

const handleInput = (event: Event): void => {
  adjustTextareaHeight()
  emit('input', event)
}

const handleShiftEnter = (event: Event): void => {
  emit('shiftEnter', event)
}

const handleModelSelect = (model: string): void => {
  emit('update:selectedModel', model)
}

const handleModelItemClick = (modelCode: string): void => {
  // 自动模式下不允许点击选择模型
  if (localIsAutoModel.value) {
    return
  }
  emit('update:selectedModel', modelCode)
}

// API入口点击
const handleModelApiClick = (modelCode: string): void => {
   
  router.push({ path: '/open/docs', query: { model: modelCode } } as any)
}

const handleModelCheckboxChange = (modelCode: string, checked: boolean): void => {
  // 自动模式下不允许单独勾选复选框
  if (localIsAutoModel.value) {
    return
  }
  
  // 手动模式：单选模式，选中新模型时自动取消其他模型
  if (checked) {
    emit('update:selectedModel', modelCode)
  } else if (localSelectedModel.value === modelCode) {
    // 如果取消当前选中的模型，可以选择不处理或清空选择
    // emit('update:selectedModel', '')
  }
}

const handleCheckboxClick = (event: Event): void => {
  // 自动模式下阻止复选框点击
  if (localIsAutoModel.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
}

// 获取模型图标（优先使用后端返回的图标）
const getModelIcon = (model: ModelInfo): string | null => {
  // 优先使用后端返回的图标URL（从 img 字段映射）
  if (model.icon) {
    return model.icon
  }
  
  // 如果没有后端图标，根据模型名称或提供商匹配本地图标（作为后备方案）
  const modelName = model.modelName?.toLowerCase() || ''
  const provider = model.provider?.toLowerCase() || ''
  
  // 可以根据实际图标路径进行匹配
  if (modelName.includes('gemini') || provider.includes('google')) {
    return '/images/models/gemini-icon.svg'
  } else if (modelName.includes('seedream') || provider.includes('bytedance')) {
    return '/images/models/seedream-icon.svg'
  } else if (modelName.includes('midjourney')) {
    return '/images/models/midjourney-icon.svg'
  }
  
  return null
}

// 判断是否应该显示处理时间（只对图片、视频和数字人模型显示）
const shouldShowProcessingTime = (model: ModelInfo): boolean => {
  // 通过 category 或 supportsImages/supportsVideo 判断
  const modelExtended = model as ModelInfoExtended
  const category = modelExtended.category || ''
  const isImageModel = category === 'image' || model.supportsImages === true
  const isVideoModel = category === 'video' || model.supportsVideo === true
  const isDigitalHuman = modelExtended.isDigitalHuman === true
  
  // 排除全能模型（全能模型不应该显示处理时间，因为它们是文本模型）
  const isUniversal = modelExtended.isUniversal === true
  
  // 对图片、视频和数字人模型显示处理时间
  return ((isImageModel || isVideoModel || isDigitalHuman) && !isUniversal) || isDigitalHuman
}

// 获取默认处理时间（基于模型实际特性估算）
const getDefaultProcessingTime = (model: ModelInfo): string => {
  // 如果模型有指定的处理时间，直接返回
  if (model.processingTime) {
    return model.processingTime
  }
  
  const modelName = (model.modelName || '').toLowerCase()
  const modelCode = (model.modelCode || '').toLowerCase()
  
  // 根据具体模型代码或名称返回更准确的时间估算
  // 优先使用 modelCode 匹配，更精确
  
  // 图像生成模型 (按 modelCode 匹配)
  if (modelCode.includes('wan2.5-i2i') || modelCode.includes('wanx-i2i')) {
    return '15-25s' // 图像编辑和创作，中等复杂度
  }
  
  if (modelCode.includes('seedream') || modelCode.includes('seedance')) {
    if (modelCode.includes('4.5') || modelCode.includes('4.0')) {
      return '10-20s' // Seedream 4.5 速度提升10倍
    }
    return '20-30s' // 其他版本
  }
  
  if (modelCode.includes('nano-banana') || modelCode.includes('nanobanana')) {
    return '15-25s' // 4K图像生成，需要更多时间
  }
  
  // 图像生成模型 (按 modelName 匹配作为回退)
  if (modelName.includes('wan2.5-i2i') || modelName.includes('万象2.6图片创作')) {
    return '15-25s' // 图像编辑和创作，中等复杂度
  }
  
  if (modelName.includes('seedream') || modelName.includes('即梦')) {
    if (modelName.includes('4.5') || modelName.includes('4.0')) {
      return '10-20s' // Seedream 4.5 速度提升10倍
    }
    return '20-30s' // 其他版本
  }
  
  if (modelName.includes('nano') && modelName.includes('banana')) {
    return '15-25s' // 4K图像生成，需要更多时间
  }
  
  // 视频生成模型
  if (modelName.includes('wan2.5-i2v') || modelName.includes('通义2.6视频生成')) {
    return '30-60s' // 视频生成，需要更长时间
  }
  
  if (modelName.includes('veo3') || modelName.includes('veo3.1')) {
    return '40-90s' // 高质量视频生成
  }
  
  if (modelName.includes('sora-2') || modelName.includes('sora')) {
    return '60-120s' // Sora 视频生成，通常需要更长时间
  }
  
  if (modelName.includes('seedance') || modelName.includes('即梦1.5视频生成')) {
    return '30-60s' // 视频生成
  }
  
  // 文本生成模型
  if (modelName.includes('qwen-omni') || modelName.includes('通义千问3-omni')) {
    return '5-15s' // 多模态理解，响应较快
  }
  
  if (modelName.includes('qwen-plus') || modelName.includes('通义千问3-max')) {
    return '3-10s' // 文本生成，通常较快
  }
  
  if (modelName.includes('glm-4.5') || modelName.includes('智谱4.6')) {
    return '3-8s' // 高性能语言模型
  }
  
  if (modelName.includes('doubao-1.6') || modelName.includes('豆包1.6')) {
    return '2-8s' // 智能对话，响应较快
  }
  
  if (modelName.includes('deepseek-reasoner') || modelName.includes('deepseek')) {
    return '5-15s' // 深度推理，需要更多计算时间
  }
  
  if (modelName.includes('gemini-3-pro')) {
    return '4-12s' // Gemini 模型
  }
  
  // 音频生成模型
  if (modelName.includes('cosyvoice') || modelName.includes('通义语音合成')) {
    return '3-8s' // 语音合成，通常较快
  }
  
  if (modelName.includes('suno') || modelName.includes('suno5.0')) {
    return '20-60s' // 音乐生成，需要更长时间
  }
  
  // 数字人模型
  // 检查是否为数字人模型（通过名称或 isDigitalHuman 标志）
  const modelExtended = model as ModelInfoExtended
  const isDigitalHuman = modelExtended.isDigitalHuman === true
  if (isDigitalHuman || modelName.includes('keling') || modelName.includes('数字人') || modelName.includes('智汇ai数字人') || modelName.includes('智汇ai')) {
    return '30-120s' // 数字人生成，需要较长时间
  }
  
  // 根据模型能力类型返回默认时间
  if (model.supportsImages && !model.supportsVideo) {
    return '15-25s' // 图像生成模型
  } else if (model.supportsVideo) {
    return '30-90s' // 视频生成模型
  } else if (model.supportsAudio) {
    return '5-30s' // 音频生成模型（根据类型不同）
  } else {
    return '3-10s' // 文本生成模型
  }
}

// 检查模型是否有特殊能力（流式响应、图像、音频、视频）
const hasCapabilities = (model: ModelInfo): boolean => {
  return !!(model.supportsStreaming || model.supportsImages || model.supportsAudio || model.supportsVideo)
}

const toggleReasoning = (): void => {
  emit('update:showReasoning', !props.showReasoning)
}

const localInputText = computed({
  get: () => props.inputText,
  set: (value) => emit('update:inputText', value)
})

const localSelectedModel = computed({
  get: () => props.selectedModel,
  set: (value) => emit('update:selectedModel', value)
})

const localIsAutoModel = computed({
  get: () => props.isAutoModel,
  set: (value) => emit('update:isAutoModel', value)
})

const localActiveTab = computed({
  get: () => props.activeTab,
  set: (value) => emit('update:activeTab', value)
})

// 组合 placeholder：包含输入提示和快捷键提示
const combinedPlaceholder = computed(() => {
  const basePlaceholder = props.actualInputPlaceholder || t('aiChatInput.inputPlaceholder')
  const shortcutHint = t('aiChatInput.enterToSend')
  return `${basePlaceholder} (${shortcutHint})`
})

// 火焰图标路径
const fireIconSrc = computed(() => {
  const baseUrl = import.meta.env.BASE_URL || '/'
  return `${baseUrl}images/common/fire-icon.svg`
})

watch(() => props.inputText, () => {
  nextTick(() => {
    adjustTextareaHeight()
  })
})

watch(() => props.currentMode, () => {
  nextTick(() => {
    adjustTextareaHeight()
  })
})

// 监控滚动状态变化
watch(() => props.isScrolledToBottom, (newValue, oldValue) => {
  if (import.meta.env.DEV) {
    logger.debug('[AIDialog] isScrolledToBottom changed:', oldValue, '->', newValue, 'Input should:', newValue ? 'hide' : 'show')
  }
}, { immediate: true })

onMounted(() => {
  nextTick(() => {
    adjustTextareaHeight()
  })
})

cleanup.add(() => { inputRef.value?.removeEventListener('input', adjustTextareaHeight as EventListener) })
</script>

<style scoped lang="scss">
// ============================================================
// CSS Variables - 组件级变量定义 (--aid- prefix)
// 使用 CSS 变量，使用 CSS 变量控制
// ============================================================
.ai-dialog {
  // Shadow 变量 - 扁平化设计
  --aid-shadow: none;
  --aid-shadow-focus: var(--global-box-shadow);
  --aid-shadow-hover: var(--global-box-shadow);
  
  // Icon 尺寸变量
  --aid-icon-sm: 14px;
  --aid-icon-md: 18px;
  --aid-icon-lg: 20px;
  
  // Button 尺寸变量
  --aid-btn-size-sm: 24px;
  --aid-btn-size-md: 44px;
  
  // Tag 样式变量
  --aid-tag-padding: 3px 6px;
  --aid-tag-font-size: 10px;
  
  // Border 变量
  --aid-border-width: 1px;
  --aid-border-color: var(--el-border-color);
  --aid-border-color-active: var(--el-color-primary);
  
  // Layout 变量
  --aid-gap-sm: 4px;
  --aid-gap-md: 6px;
  --aid-gap-lg: 10px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  box-shadow: var(--aid-shadow); // 扁平化设计：移除所有投影
  
  // 首页模式下，使用正确的布局 - 通过增加选择器特异性，使用 CSS 变量控制
  .ai-chat-dialog.is-home &.ai-dialog {
    overflow: visible; // 改为 visible，允许消息容器显示在内部
    display: flex;
    flex-direction: column;
    position: relative;
    height: 100%;
    width: 100%;
    z-index: var(--z-0); // 作为背景层
    background: var(--el-bg-color); // 设置背景色
    border-radius: var(--global-border-radius); // 圆角
  }

  // 在顶部添加渐变装饰线，与 input-wrapper 底部的渐变线呼应
  // 这样当 input-wrapper 上移时，视觉上会有连贯的渐变过渡
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--el-color-primary-light-5);
    opacity: 0.4; // 默认稍微淡一些，与底部呼应但不过于突出
    z-index: var(--z-base);
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  
  // 当 input-wrapper hover 时，顶部渐变线也变得更明显，形成连贯的视觉过渡
  &:has(.input-wrapper:hover:not(:focus-within))::before {
    opacity: 0.8; // hover时变得更明显，与底部渐变线呼应
  }
  
  // 当 input-wrapper focus 时，顶部渐变线最明显
  &:has(.input-wrapper:focus-within)::before {
    opacity: 1; // focus时最明显，形成连贯的渐变装饰
  }

  &:not(.dark-mode) {
    --send-btn-bg: var(--color-white-15);
    --send-btn-border: var(--border-unified-color);
    --send-btn-inset: var(--color-white-20);
    --send-btn-inset-base: var(--color-white-10);
    --send-btn-shadow-1: none; // 扁平化设计：移除投影
    --send-btn-shadow-2: none; // 扁平化设计：移除投影
    --send-btn-hover-shadow-3: none; // 扁平化设计：移除投影
    --send-btn-disabled-bg: var(--color-black-10);
    --send-btn-disabled-border: var(--border-unified-color);
    --send-btn-disabled-inset: var(--color-white-5);
    --send-btn-disabled-shadow-1: none; // 扁平化设计：移除投影
    --send-btn-disabled-hover-bg: var(--color-black-15);
    --send-btn-disabled-hover-border: var(--border-unified-color);
    --ai-dialog-shadow: none; // 扁平化设计：移除投影
  }

  &.dark-mode {
    --send-btn-bg: var(--color-black-25);
    --send-btn-border: var(--border-unified-color);
    --send-btn-inset: var(--color-white-10);
    --send-btn-inset-base: var(--color-white-5);
    --send-btn-shadow-1: none; // 扁平化设计：移除投影
    --send-btn-shadow-2: none; // 扁平化设计：移除投影
    --send-btn-hover-shadow-3: none; // 扁平化设计：移除投影
    --send-btn-disabled-bg: var(--color-black-20);
    --send-btn-disabled-border: var(--border-unified-color);
    --send-btn-disabled-inset: var(--color-white-3);
    --send-btn-disabled-shadow-1: none; // 扁平化设计：移除投影
    --send-btn-disabled-hover-bg: var(--color-black-25);
    --send-btn-disabled-hover-border: var(--border-unified-color);
    --send-btn-bg-dark: color-mix(in srgb, var(--el-color-primary) 35%, transparent);
    --send-btn-border-dark: var(--border-unified-color);
    --send-btn-color-dark: var(--color-on-primary);
    --send-btn-shadow-1-dark: none; // 扁平化设计：移除投影
    --send-btn-shadow-2-dark: none; // 扁平化设计：移除投影
    --send-btn-inset-dark: var(--color-white-10);
    --send-btn-hover-shadow-3-dark: none; // 扁平化设计：移除投影
    --send-btn-disabled-bg-dark: var(--color-black-20);
    --send-btn-disabled-border-dark: var(--border-unified-color);
    --send-btn-disabled-inset-dark: var(--color-white-5);
    --send-btn-disabled-shadow-1-dark: none; // 扁平化设计：移除投影
    --send-btn-disabled-hover-bg-dark: var(--color-black-25);
    --send-btn-disabled-hover-border-dark: var(--border-unified-color);
    --ai-dialog-shadow: none; // 扁平化设计：移除投影
  }

  .header-left {
    flex: 1;
    min-width: 0;

    .dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      letter-spacing: 0.5px;

      .title-icon {
        font-size: var(--aid-icon-sm);
        width: var(--aid-icon-sm);
        height: var(--aid-icon-sm);
        color: var(--el-color-primary);
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        line-height: 1;
        vertical-align: middle;
        margin-right: var(--aid-gap-md);

        :deep(svg) {
          width: var(--aid-icon-sm);
          height: var(--aid-icon-sm);
          display: block;
          vertical-align: middle;
        }

        &:hover {
          transform: scale(1.1);
        }
      }
      
      .title-text {
        line-height: 1.4;
        vertical-align: middle;
        display: inline-block;
        font-size: 16px;
        height: auto;
      }

      .el-tag.model-tag {
        // 定义组件内部变量
        --model-tag-border: var(--el-border-width-primary) solid var(--el-color-primary);
        --model-tag-border-width: var(--el-border-width-primary);
        --model-tag-border-width: var(--aid-border-width);
        
        flex-shrink: 1;
        font-size: 11px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: var(--global-border-radius);
        background: var(--el-fill-color-light);
        color: var(--el-color-primary);

        // 亮色主题：使用更深的主题色形成强对比 - 通过 CSS 变量，使用 CSS 变量控制
        border: var(--model-tag-border-width) solid var(--model-tag-border-color);
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        max-width: 100%;
        box-sizing: border-box;
        white-space: nowrap;
        overflow: hidden;
        line-height: 1.2;
        height: auto;
        min-height: 20px;
        min-width: 0;

        :deep(.el-tag__content) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          max-width: 100%;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          line-height: 1.2;
          min-width: 0;
          flex: 1;
        }

        :deep(span) {
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.2;
          min-width: 0;
        }

        .agent-tag-text {
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.2;
          min-width: 0;
        }

        &:hover {
          background: var(--el-color-primary-light-9);

          --model-tag-border: var(--el-border-width-primary) solid var(--el-color-primary);
          --model-tag-border-width: var(--el-border-width-primary);

          transform: translateY(0); // 扁平化设计：移除位移
          box-shadow: var(--aid-shadow); // 扁平化设计：移除投影
        }

        &.el-tag--success {
          --model-tag-border-color: var(--el-color-success);

          background: var(--el-fill-color-light);
          color: var(--el-color-success);

          &:hover {
            background: var(--el-color-success-light-9);

            --model-tag-border-color: var(--el-color-success);
          }
        }

        &.agent-tag {
          padding: var(--aid-tag-padding);
          font-size: var(--aid-tag-font-size);
          max-width: 100%;
          min-width: 0;
          width: auto;
          overflow: hidden;
          box-sizing: border-box;
          
          .tag-icon {
            font-size: 11px;
            width: 11px;
            height: 11px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 2px;
          }

          :deep(.el-tag__content) {
            gap: 2px;
            max-width: 100%;
            width: 100%;
            overflow: hidden;
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            box-sizing: border-box;
            min-width: 0;
          }

          :deep(span),
          .agent-tag-text {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: inline-block;
            line-height: 1.2;
            vertical-align: middle;
            box-sizing: border-box;
            min-width: 0;
            flex-shrink: 1;
          }
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--aid-gap-sm);
    flex-shrink: 0;
    justify-content: flex-end;

    .header-btn {
      // 使用 CSS 变量，使用 CSS 变量控制
      --header-btn-size: var(--aid-btn-size-md);
      --header-btn-icon-size: var(--aid-icon-md);
      
      padding: 0;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: var(--global-border-radius);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--header-btn-size);
      min-height: var(--header-btn-size);
      width: var(--header-btn-size);
      height: var(--header-btn-size);
      margin: 0;

      :deep(.el-button__inner) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 0;
        margin: 0;
      }

      :deep(.el-icon) {
        font-size: var(--header-btn-icon-size);
        width: var(--header-btn-icon-size);
        height: var(--header-btn-icon-size);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
        flex-shrink: 0;
      }

      :deep(svg) {
        width: var(--header-btn-icon-size);
        height: var(--header-btn-icon-size);
        display: block;
        margin: 0 auto;
      }

      &:hover {
        background-color: var(--el-fill-color-light);
      }

      &:active {
        background-color: var(--el-fill-color);
      }
    }
  }

  .agent-input-wrapper {
    display: none; // 已合并到 input-wrapper 中
  }

  .input-wrapper {
    // 使用 CSS 变量，使用 CSS 变量控制 - 扁平化设计
    --input-wrapper-shadow: var(--aid-shadow);
    --input-wrapper-filter: none;
    --input-wrapper-outline: none;
    
    // 默认状态 - 确保无投影，仅保留低对比色描边
    box-shadow: var(--input-wrapper-shadow);
    filter: var(--input-wrapper-filter);
    outline: var(--input-wrapper-outline);
    
    // 确保伪元素也没有投影
    &::before,
    &::after {
      box-shadow: var(--aid-shadow);
      filter: none;
    }
    
    // 添加过渡动画，实现逐渐隐藏效果
    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s ease;
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
    
    // 当与 footer 重合时，逐渐隐藏
    &.is-overlapping {
      opacity: 0;
      transform: translateY(20px);
      visibility: hidden;
    }
    
    // 明确指定未激活状态（未hover且未focus）无投影
    &:not(:hover, :focus-within) {
      --input-wrapper-shadow: var(--aid-shadow);
    }
    
    // 确保 agent-mode 状态下也无投影
    &.agent-mode {
      --input-wrapper-shadow: var(--aid-shadow);

      // 智能体模式特殊样式调整
      .agent-textarea-input {
        width: 100%;
        margin-bottom: 0;

        :deep(.el-textarea__inner) {
          border-radius: var(--global-border-radius);
          border: none;
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.6;
          transition: all 0.2s ease;
          resize: none;
          background: transparent;
          color: var(--el-text-color-primary);
          min-height: 50px;
          max-height: 120px;
          box-sizing: border-box;

          &:focus {
            border: none;
            box-shadow: none;
            outline: none;
          }

          &::placeholder {
            color: var(--el-text-color-placeholder);
          }
        }
      }

      .agent-mode-btn {
        // 使用 CSS 变量，使用 CSS 变量控制
        --amb-bg: transparent;
        --amb-border-color: var(--el-border-color);
        --amb-text-color: var(--el-text-color-regular);
        --amb-icon-size: 16px;
        
        position: relative;

        // 通过 CSS 变量设置描边，确保始终可见
        border: var(--aid-border-width) solid var(--amb-border-color);
        background: var(--amb-bg);
        color: var(--amb-text-color);
        min-width: auto;
        width: auto;
        min-height: 22px;
        height: 22px;
        padding: 0 12px;
        border-radius: var(--global-border-radius);
        gap: var(--aid-gap-md);

        // 通过增加选择器特异性覆盖 Element Plus
        &.el-button,
        &:not(.is-active),
        &:not(.is-active, :hover) {
          background: var(--amb-bg);
          border: var(--aid-border-width) solid var(--amb-border-color);
        }

        :deep(.el-button__inner) {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--aid-gap-md);
          padding: 0;
          background: transparent;
        }

        .agent-mode-text {
          font-size: 14px;
          font-weight: 500;
          line-height: 1;
          white-space: nowrap;
          color: var(--el-text-color-primary);
        }

        :deep(.el-icon) {
          font-size: var(--amb-icon-size);
          width: var(--amb-icon-size);
          height: var(--amb-icon-size);
          margin: 0;
        }

        &:hover:not(.is-active) {
          --amb-bg: var(--el-fill-color-light);
          --amb-border-color: var(--el-color-primary-light-5);

          color: var(--el-color-primary);

          .agent-mode-text {
            color: var(--el-text-color-primary);
          }
        }

        &.is-active {
          --amb-bg: var(--el-color-primary);
          --amb-border: var(--el-border-width-primary) solid var(--el-color-primary);
          --amb-border-width: var(--el-border-width-primary);

          color: var(--color-on-primary);
          box-shadow: var(--aid-shadow); // 扁平化设计：移除投影

          .agent-mode-text {
            color: var(--color-on-primary);
          }

          :deep(.el-icon) {
            color: var(--color-on-primary);
          }

          &:hover {
            --amb-bg: var(--el-color-primary);
            --amb-border: var(--el-border-width-primary) solid var(--el-color-primary);
          --amb-border-width: var(--el-border-width-primary);

            color: var(--color-on-primary);
          }
        }

        &:not(.is-active) {
          --amb-bg: transparent;
          --amb-border-color: var(--el-border-color);

          color: var(--el-text-color-regular);
          
          .agent-mode-text {
            color: var(--el-text-color-primary);
          }
        }

        // 覆盖 Element Plus link 按钮样式 - 增加特异性
        &.el-button--link {
          border: var(--aid-border-width) solid var(--amb-border-color);
        }

        &:active:not(.is-active) {
          --amb-bg: transparent;

          transform: translateY(0) scale(0.95);
        }
      }

      .reasoning-btn {
        position: relative;

        &:hover {
          background-color: var(--el-fill-color-light);
          color: var(--el-color-primary);
        }

        &.is-active,
        &:active {
          background-color: var(--el-color-primary-light-9);
          color: var(--el-color-primary);
        }
      }

      // 确保智能体模式下的输入区域与其他模式一致
      .input-row {
        min-height: 50px;
        align-items: flex-start;
      }
    }
  }

  .input-wrapper {
    // 继承组件级变量并可覆盖
    --iw-shadow: var(--aid-shadow);
    --iw-shadow-hover: var(--aid-shadow-hover);
    --iw-shadow-focus: var(--aid-shadow-focus);
    
    display: flex;
    flex-direction: column;
    gap: 0;
    align-items: stretch;
    position: relative;
    border-radius: var(--global-border-radius);
    padding: 16px 20px;
    min-height: 106px;
    height: auto; // 根据内容自动调整高度
    max-height: none; // 不限制最大高度，允许内容完整显示
    flex-shrink: 0;
    width: 100%;
    transition: all 0.3s ease;
    overflow: visible; // 允许内部内容超出容器边缘显示
    
    // 首页模式下 - 通过增加选择器特异性，使用 CSS 变量控制
    .ai-chat-dialog.is-home &.input-wrapper {
      overflow: visible;
      position: relative;
      inset: auto;
      transform: translateY(0);
      margin: 0;
      height: auto; // 根据内容自动调整高度
      min-height: 106px; // 保持最小高度
      max-height: none; // 不限制最大高度
    }
    
    // 默认状态（未激活时）完全无投影 - 使用 CSS 变量
    box-shadow: var(--iw-shadow);
    filter: none;
    outline: none;
    
    // 默认状态样式
    background: var(--color-white-15);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: var(--unified-border);
    transform: translateY(0);
    
    // 确保伪元素也没有投影
    &::before,
    &::after {
      box-shadow: var(--aid-shadow);
      filter: none;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--el-color-primary-light-5);
      opacity: 0.6;
      border-radius: var(--global-border-radius);
      transition: opacity 0.3s ease;
    }
    
    // 添加底部渐变遮罩，让上移时过渡更自然
    &::before {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--color-white-10);
      pointer-events: none;
      z-index: -1;
      opacity: 0;
      transition: opacity 0.3s ease, height 0.3s ease;
    }
    
    // 未激活状态 - 通过 CSS 变量控制
    &:not(:hover, :focus-within, .is-overlapping) {
      --iw-shadow: var(--aid-shadow);

      transform: translateY(0);
    }

    // hover 状态（未focus时）
    &:hover:not(:focus-within) {
      background: var(--color-white-95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-color: var(--border-unified-color-hover);

      --iw-shadow: var(--iw-shadow-hover);

      box-shadow: var(--iw-shadow);
      transform: translateY(0); // 扁平化设计：移除位移
      margin-bottom: 0; // 保持margin，避免露白
      
      // hover时显示底部遮罩
      &::before {
        opacity: 1;
      }
      
      // hover时底部渐变线稍微增强
      &::after {
        opacity: 0.9;
      }
    }

    // focus 状态 - 2px 主色边框
    &:focus-within {
      background: var(--el-bg-color);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border: var(--el-border-width-primary) solid var(--el-color-primary);

      --iw-shadow: var(--iw-shadow-focus);

      box-shadow: var(--iw-shadow);
      transform: translateY(0); // 扁平化设计：移除位移
      margin-bottom: 0; // 保持margin，避免露白
      
      // focus时也显示底部遮罩（更明显）
      &::before {
        opacity: 1;
        height: 4px;
        bottom: -4px;
      }
      
      // focus时底部渐变线最明显
      &::after {
        opacity: 1;
      }
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin: 0;
      margin-top: -8px;
      margin-bottom: 10px;
      padding: 0;
      padding-bottom: 2px;
      flex-shrink: 0;
      height: auto;
      min-height: 0;
      max-height: none;
      border-bottom: var(--unified-border-bottom);
      box-sizing: border-box;
      line-height: 1;
      overflow: hidden;
      gap: 12px;
      flex-wrap: nowrap;

      .dialog-title {
        flex: 1;
        min-width: 0;
        margin: 0;
        padding: 0;
        font-size: 14px;
        gap: 8px;
        line-height: 1;
        display: flex;
        align-items: center;
        height: auto;
        vertical-align: middle;
        justify-content: flex-start;
        overflow: hidden;
        
        .title-text {
          line-height: 1;
          vertical-align: middle;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 1;
          min-width: 0;
          display: inline-block;
          font-size: inherit;
        }
        
        > span:first-of-type {
          line-height: 1;
          vertical-align: middle;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 1;
          min-width: 0;
        }

        .title-icon {
          // 使用 CSS 变量，使用 CSS 变量控制
          font-size: var(--aid-icon-sm);
          width: var(--aid-icon-sm);
          height: var(--aid-icon-sm);
          line-height: 1;
          vertical-align: middle;
          margin: 0;
          padding: 0;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;

          :deep(svg) {
            width: var(--aid-icon-sm);
            height: var(--aid-icon-sm);
            display: block;
            vertical-align: middle;
          }
        }
        
        .title-text {
          line-height: 1.4;
          vertical-align: middle;
          display: inline-block;
          font-size: 14px;
          margin: 0;
          padding: 0;
          height: auto;
        }

        .el-tag.model-tag {
          font-size: 11px;
          padding: 4px 6px;
          line-height: 1.2;
          margin: 0;
          max-width: 100%;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          box-sizing: border-box;

          :deep(.el-tag__content) {
            max-width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          :deep(span) {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: inline-block;
          }

          &.agent-tag {
            padding: var(--aid-tag-padding);
            font-size: var(--aid-tag-font-size);
            max-width: 100%;
            min-width: 0;
            width: auto;
            overflow: hidden;
            box-sizing: border-box;

            .agent-tag-text {
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              display: inline-block;
              line-height: 1.2;
              box-sizing: border-box;
              min-width: 0;
              flex-shrink: 1;
            }

            :deep(.el-tag__content) {
              max-width: 100%;
              width: 100%;
              overflow: hidden;
              white-space: nowrap;
              display: inline-flex;
              align-items: center;
              gap: 2px;
              box-sizing: border-box;
              min-width: 0;
            }
          }
        }
        
        > span:first-of-type {
          line-height: 1;
          vertical-align: middle;
          display: inline-block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 1;
          min-width: 0;
          max-width: 100%;
        }
      }

      // 使用 CSS 变量，使用 CSS 变量控制
      .header-btn {
        --header-btn-sm: var(--aid-btn-size-sm);
        
        flex-shrink: 0;
        margin: 0;
        padding: 0;
        min-width: var(--header-btn-sm);
        min-height: var(--header-btn-sm);
        width: var(--header-btn-sm);
        height: var(--header-btn-sm);
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;

        :deep(.el-icon) {
          font-size: var(--aid-icon-sm);
          width: var(--aid-icon-sm);
          height: var(--aid-icon-sm);
          line-height: 1;
          vertical-align: middle;
        }

        :deep(svg) {
          width: var(--aid-icon-sm);
          height: var(--aid-icon-sm);
          display: block;
          vertical-align: middle;
        }
      }
    }

    .input-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      width: 100%;
      min-height: 50px;
      margin-bottom: 1px;
    }

    .chat-input {
      width: 100%;
      min-height: 50px;
      max-height: 120px;
      height: 50px;
      padding: 10px 12px;
      border: none;
      border-radius: var(--global-border-radius);
      resize: none;
      outline: none;
      font-size: 14px;
      line-height: 1.6;
      transition: all 0.2s ease;
      background: transparent;
      color: var(--el-text-color-primary);
      box-sizing: border-box;

      &::placeholder {
        color: var(--el-text-color-placeholder);
      }
    }

    .input-actions {
      display: flex;
      gap: var(--aid-gap-sm);
      align-items: center;
      justify-content: flex-end;
      width: 100%;
      margin-top: 1px;

      .input-action-btn {
        // 使用 CSS 变量，使用 CSS 变量控制
        --iab-width: 44px;
        --iab-height: 22px;
        --iab-icon-size: var(--aid-icon-lg);
        
        padding: 0;
        border-radius: var(--global-border-radius);
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: var(--iab-width);
        min-height: var(--iab-height);
        width: var(--iab-width);
        height: var(--iab-height);
        margin: 0;
        
        &.agent-mode-btn {
          --iab-height: 22px;
        }

        // 通过增加选择器特异性覆盖 Element Plus
        &.is-link:not(.is-active),
        &.is-link:not(.is-active, :hover) {
          background: transparent;
        }

        :deep(.el-button__inner) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 0;
          margin: 0;
        }

        :deep(.el-icon) {
          font-size: var(--iab-icon-size);
          width: var(--iab-icon-size);
          height: var(--iab-icon-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
          flex-shrink: 0;
        }

        :deep(svg) {
          width: var(--iab-icon-size);
          height: var(--iab-icon-size);
          display: block;
          margin: 0 auto;
        }

        :deep(.model-icon) {
          color: var(--el-text-color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          width: var(--iab-icon-size);
          height: var(--iab-icon-size);
          transition: color 0.2s ease;

          svg {
            width: var(--iab-icon-size);
            height: var(--iab-icon-size);
            display: block;
            fill: currentcolor;
            transition: fill 0.2s ease;
          }
        }

        &:hover {
          background-color: var(--el-fill-color-light);

          :deep(.model-icon) {
            color: var(--el-color-primary);

            svg {
              fill: currentcolor;
            }
          }
        }
      }

      .send-btn {
        // 使用 CSS 变量，使用 CSS 变量控制
        --send-btn-shadow: var(--aid-shadow);
        
        padding: 10px 18px;
        position: relative;
        z-index: var(--z-base);
        pointer-events: auto;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        border-radius: var(--global-border-radius);
        font-weight: 500;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: var(--aid-gap-lg);
        vertical-align: middle;
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
        background: var(--send-btn-bg);
        border: var(--unified-border);
        box-shadow: var(--send-btn-shadow); // 扁平化设计：移除所有投影

        :deep(.el-button__inner) {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: var(--aid-gap-lg);
          pointer-events: none;
          width: 100%;
          height: 100%;
        }

        :deep(.el-icon) {
          font-size: var(--aid-icon-lg);
          width: var(--aid-icon-lg);
          height: var(--aid-icon-lg);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          margin: 0;
          padding: 0;
          vertical-align: middle;
        }

        span {
          font-size: 15px;
          display: inline-block;
          line-height: 1.5;
          margin: 0;
          padding: 0;
          vertical-align: middle;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        &:hover:not(:disabled) {
          transform: translateY(0) scale(1); // 扁平化设计
          background: rgb(var(--el-color-primary-rgb), 0.25);
          border-color: rgb(var(--el-color-primary-rgb), 0.4);

          --send-btn-shadow: var(--aid-shadow); // 移除投影

          :deep(.el-icon) {
            transform: translateX(3px) scale(1.05);
          }

          span {
            transform: translateX(1px);
          }
        }

        &:active:not(:disabled) {
          transform: translateY(0) scale(1); // 扁平化设计
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: var(--send-btn-disabled-bg);
          border-color: var(--send-btn-disabled-border);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);

          --send-btn-shadow: var(--aid-shadow);

          &:hover {
            transform: none;
            background: var(--send-btn-disabled-hover-bg);
            border-color: var(--send-btn-disabled-hover-border);
            opacity: 0.5;
          }
        }
      }
    }
  }

  .input-wrapper {
    // 暗色模式变量覆盖
    --iw-shadow: var(--aid-shadow);
    
    // 默认状态（未激活时）完全无投影 - 使用 CSS 变量
    box-shadow: var(--iw-shadow);
    filter: none;
    outline: none;
    
    // 默认状态样式
    background: var(--color-black-15);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border-color: var(--color-white-10);
    transform: translateY(0);
    
    // 确保伪元素也没有投影
    &::before,
    &::after {
      box-shadow: var(--aid-shadow);
      filter: none;
    }
    
    // 确保 agent-mode 状态下也无投影
    &.agent-mode {
      --iw-shadow: var(--aid-shadow);
    }
    
    // 未激活状态 - 通过 CSS 变量控制
    &:not(:hover, :focus-within, .is-overlapping) {
      --iw-shadow: var(--aid-shadow);

      transform: translateY(0);
    }
    
    // 暗色模式的底部渐变遮罩（与浅色模式保持相同的结构）
    &::before {
      background: var(--color-black-10);
      bottom: -2px;
      height: 3px;
    }
    
    // 明确指定未激活状态无投影
    &:not(:hover, :focus-within) {
      --iw-shadow: var(--aid-shadow);
    }

    // 暗色模式 hover/focus 变量 - 使用全局描边与投影
    --iw-shadow-hover-dark: var(--global-box-shadow);
    --iw-shadow-focus-dark: var(--global-box-shadow);

    // hover 状态（未focus时）
    &:hover:not(:focus-within) {
      background: var(--color-black-75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-color: var(--border-unified-color-hover);

      --iw-shadow: var(--iw-shadow-hover-dark);

      box-shadow: var(--iw-shadow);
      transform: translateY(0); // 扁平化设计：移除位移
      margin-bottom: 0;
      
      &::before {
        opacity: 1;
      }
      
      &::after {
        opacity: 0.9;
      }
    }

    // focus 状态
    &:focus-within {
      background: var(--el-color-primary);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border: var(--el-border-width-primary) solid var(--el-color-primary);

      --iw-shadow: var(--iw-shadow-focus-dark);

      box-shadow: var(--iw-shadow);
      transform: translateY(0); // 扁平化设计：移除位移
      margin-bottom: 0;
      
      &::before {
        opacity: 1;
        height: 4px;
        bottom: -4px;
      }
      
      &::after {
        opacity: 1;
      }
    }

    &.agent-mode {
      .agent-textarea-input {
        :deep(.el-textarea__inner) {
          background: transparent;
          color: var(--el-text-color-primary);

          &::placeholder {
            color: var(--el-text-color-placeholder);
          }
        }
      }

      // 暗色模式的 agent-mode-btn - 使用 CSS 变量
      .agent-mode-btn {
        --amb-bg-dark: transparent;
        --amb-border-color-dark: var(--el-border-color-darker);
        --amb-text-color-dark: var(--el-text-color-primary);
        
        border: var(--aid-border-width) solid var(--amb-border-color-dark);
        background: var(--amb-bg-dark);
        color: var(--amb-text-color-dark);
        min-width: auto;
        width: auto;
        padding: 0 12px;
        gap: var(--aid-gap-md);

        // 通过增加选择器特异性覆盖 Element Plus
        &.el-button,
        &:not(.is-active),
        &:not(.is-active, :hover) {
          background: var(--amb-bg-dark);
          border: var(--aid-border-width) solid var(--amb-border-color-dark);
        }

        :deep(.el-button__inner) {
          background: transparent;
        }

        .agent-mode-text {
          color: var(--amb-text-color-dark);
        }

        :deep(.el-icon) {
          color: var(--amb-text-color-dark);
        }

        &:hover:not(.is-active) {
          --amb-bg-dark: var(--el-fill-color);
          --amb-border-color-dark: var(--el-color-primary-light-3);

          color: var(--el-color-primary);

          .agent-mode-text {
            color: var(--el-color-primary);
          }

          :deep(.el-icon) {
            color: var(--el-color-primary);
          }
        }

        &.is-active {
          --amb-bg-dark: var(--el-color-primary);
          --amb-border-color-dark: var(--el-color-primary);

          color: var(--el-bg-color-page);
          box-shadow: var(--global-box-shadow);

          .agent-mode-text {
            color: var(--el-bg-color-page);
          }

          :deep(.el-icon) {
            color: var(--el-bg-color-page);
          }

          &:hover {
            --amb-bg-dark: var(--el-color-primary);
            --amb-border-color-dark: var(--el-color-primary);

            color: var(--el-bg-color-page);
          }
        }

        &:not(.is-active) {
          --amb-bg-dark: transparent;
          --amb-border-color-dark: var(--el-border-color-darker);

          color: var(--el-text-color-primary);
        }
      }

      .reasoning-btn {
        &.is-active {
          background-color: var(--el-color-primary-light-3);
          color: var(--el-color-primary);
        }
      }
    }

    .header-top {
      .el-tag.model-tag {
        // 暗色主题变量
        --model-tag-border-color-dark: var(--color-white-30);
        
        background: var(--el-color-primary);
        color: var(--el-bg-color-page);

        // 暗色主题：使用白色描边形成强对比 - 使用 CSS 变量
        border: var(--aid-border-width) solid var(--model-tag-border-color-dark);

        &:hover {
          --model-tag-border-color-dark: var(--color-white-50);
        }

        &.agent-tag {
          // 暗色模式 agent-tag 变量
          --agent-tag-bg-dark: var(--el-color-success);
          --agent-tag-border-dark: var(--color-white-30);
          
          background: var(--agent-tag-bg-dark);
          color: var(--el-bg-color-page);
          border: var(--aid-border-width) solid var(--agent-tag-border-dark);
          padding: var(--aid-tag-padding);
          font-size: var(--aid-tag-font-size);
          max-width: 100%;
          min-width: 0;
          width: auto;
          overflow: hidden;
          box-sizing: border-box;

          &:hover {
            --agent-tag-border-dark: var(--color-white-50);
          }

          .agent-tag-text {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: inline-block;
            line-height: 1.2;
            box-sizing: border-box;
            min-width: 0;
            flex-shrink: 1;
          }

          :deep(.el-tag__content) {
            max-width: 100%;
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 2px;
            box-sizing: border-box;
            min-width: 0;
          }
        }
      }
    }
  }

  // 暗色模式 input-actions 样式
  :where(.input-wrapper) .input-actions {
    .input-action-btn {
      :deep(.model-icon) {
        color: var(--el-text-color-primary);

        svg {
          fill: currentcolor;
          width: var(--aid-icon-lg);
          height: var(--aid-icon-lg);
        }
      }

      &:hover {
        :deep(.model-icon) {
          color: var(--el-color-primary);

          svg {
            fill: currentcolor;
          }
        }
      }
    }

    .send-btn {
      // 暗色模式 send-btn 变量
      --send-btn-shadow-dark: var(--aid-shadow);
      
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      background: var(--send-btn-bg-dark, color-mix(in srgb, var(--el-color-primary) 35%, transparent));
      border: var(--unified-border);
      color: var(--send-btn-color-dark);
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: var(--aid-gap-lg);
      vertical-align: middle;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: var(--send-btn-shadow-dark); // 扁平化设计

      :deep(.el-button__inner) {
        color: var(--color-on-primary);
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: var(--aid-gap-lg);
        width: 100%;
        height: 100%;
      }

      :deep(.el-icon) {
        color: var(--color-on-primary);
        font-size: var(--aid-icon-lg);
        width: var(--aid-icon-lg);
        height: var(--aid-icon-lg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin: 0;
        padding: 0;
        vertical-align: middle;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      span {
        color: var(--color-on-primary);
        display: inline-block;
        font-size: 15px;
        line-height: 1.5;
        margin: 0;
        padding: 0;
        vertical-align: middle;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      &:hover:not(:disabled) {
        background: rgb(var(--el-color-primary-rgb), 0.35);
        border-color: rgb(var(--el-color-primary-rgb), 0.5);
        color: var(--color-on-primary);
        transform: translateY(0) scale(1); // 扁平化设计

        :deep(.el-icon) {
          color: var(--color-on-primary);
          transform: translateX(3px) scale(1.05);
        }

        span {
          color: var(--color-on-primary);
          transform: translateX(1px);
        }
      }

      &:active:not(:disabled) {
        background: rgb(var(--el-color-primary-rgb), 0.4);
        border-color: rgb(var(--el-color-primary-rgb), 0.6);
        color: var(--color-on-primary);
        transform: translateY(0) scale(1); // 扁平化设计
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      }

      &:disabled {
        background: var(--send-btn-disabled-bg-dark);
        border-color: var(--send-btn-disabled-border-dark);
        opacity: 0.5;
        cursor: not-allowed;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);

        &:hover {
          background: var(--send-btn-disabled-hover-bg-dark);
          border-color: var(--send-btn-disabled-hover-border-dark);
          opacity: 0.6;
          transform: none;

          :deep(.el-icon) {
            transform: none;
          }

          span {
            transform: none;
          }
        }
      }
    }
  }
}

// 模型选择器下拉菜单样式 - 使用全局主题变量适配明暗色主题
// 使用 CSS 变量，使用 CSS 变量控制
:deep(.model-selector-dropdown) {
  --msd-width: 500px;
  --msd-min-height: 380px;
  --msd-max-height: 400px;
  --msd-padding: 20px;
  
  min-width: var(--msd-width);
  max-width: var(--msd-width);
  width: var(--msd-width);
  min-height: var(--msd-min-height);
  max-height: var(--msd-max-height);
  padding: var(--msd-padding);
  background: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
  box-shadow: var(--aid-shadow); // 扁平化设计
  border: var(--unified-border);
  box-sizing: border-box;
  overflow: visible;
  display: flex;
  flex-direction: column;
}

.model-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: fit-content;
  height: auto;
  margin-bottom: 20px;
  padding: 12px 20px;
  border-bottom: none;
  box-sizing: border-box;
  flex-shrink: 0;

  .model-selector-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    margin: 0;
    padding: 0;
    line-height: 1.4;
    flex-shrink: 0;
    letter-spacing: -0.3px;
  }

  .model-auto-switch-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;

    .auto-label {
      // 使用 CSS 变量，使用 CSS 变量控制
      --al-border-color: var(--color-black-8);
      --al-border-width: 2px;
      
      font-size: 14px;
      color: var(--el-text-color-regular);
      white-space: nowrap;
      font-weight: 400;
      cursor: pointer;
      user-select: none;
      padding: 4px 8px;
      border-radius: var(--global-border-radius);
      transition: all 0.2s ease;
      box-sizing: border-box;

      // 未激活状态：低对比度描边
      border: var(--al-border-width) solid var(--al-border-color);

      &:hover {
        background: var(--el-fill-color-light);
        color: var(--el-text-color-primary);

        --al-border-color: var(--border-unified-color);
      }

      &.is-active {
        // 激活状态：高对比度描边
        --al-border: var(--el-border-width-primary) solid var(--el-color-primary);
        --al-border-width: var(--el-border-width-primary);

        color: var(--el-text-color-primary);
        font-weight: 500;
        background: var(--el-fill-color-light);
      }
    }

    // 暗色主题下的 auto-label 样式
    :where(html.dark) & {
      .auto-label {
        --al-border-color: var(--border-unified-color);

        box-sizing: border-box;

        &:hover {
          background: var(--el-fill-color-light);
          color: var(--el-text-color-primary);

          --al-border-color: var(--border-unified-color);
        }

        &.is-active {
          --al-border: var(--el-border-width-primary) solid var(--el-color-primary);
        --al-border-width: var(--el-border-width-primary);

          color: var(--el-text-color-primary);
          font-weight: 500;
          background: var(--el-fill-color-light);
        }
      }
    }

  }
}

.model-category-tabs {
  width: 100%;
  margin-top: 16px;
  margin-bottom: 16px;
  padding: 16px 0;
  box-sizing: border-box;
  flex-shrink: 0;

  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0;
    border-bottom: none;
    
    &::after {
      display: none;
    }
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0;
    overflow: visible;
    
    &::after {
      display: none;
      content: none;
      width: 0;
      height: 0;
      border: none;
    }
  }

  :deep(.el-tabs__nav-scroll) {
    overflow: visible;
  }

  :deep(.el-tabs__nav) {
    display: flex;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
    flex-wrap: wrap;
    padding-left: 12px;
    padding-right: 12px;
  }

  :deep(.el-tabs__item) {
    // 使用 CSS 变量，使用 CSS 变量控制
    --mct-item-bg: var(--el-fill-color-light);
    --mct-item-color: var(--el-text-color-regular);
    --mct-item-border-color: transparent;
    --mct-item-height: 32px;
    
    padding: 8px 16px;
    font-size: 14px;
    color: var(--mct-item-color);
    background: var(--mct-item-bg);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    margin-right: 0;
    transition: all 0.2s ease;
    cursor: pointer;
    height: var(--mct-item-height);
    line-height: 16px;
    box-sizing: border-box;
    flex-shrink: 0;
    font-weight: 400;

    &:hover {
      --mct-item-bg: var(--el-fill-color);
      --mct-item-color: var(--el-text-color-primary);
    }

    &.is-active {
      --mct-item-bg: var(--el-bg-color-page);
      --mct-item-color: var(--el-text-color-primary);
      --mct-item-border: var(--el-border-width-primary) solid var(--el-color-primary);
      --mct-item-border-width: var(--el-border-width-primary);

      font-weight: 500;
      box-shadow: var(--global-box-shadow);

      // 选中状态：添加粗描边，与容器背景形成强对比
      border-width: 2px;
    }
  }
  
  // 暗色主题下的选中状态描边
  :where(html.dark) & {
    :deep(.el-tabs__item.is-active) {
      // 暗色主题下使用更亮的颜色形成强对比
      --mct-item-border: var(--el-border-width-primary) solid var(--el-color-primary);
      --mct-item-border-width: var(--el-border-width-primary);

      border-width: 2px;
    }
  }

  :deep(.el-tabs__active-bar) {
    display: none;
  }
}

.model-loading,
.tab-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 240px;
  padding: 60px 24px;
  color: var(--el-text-color-placeholder);
  gap: 8px;
  font-size: 14px;
  box-sizing: border-box;
  flex: 1;
}

.model-list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-height: 280px;
  min-height: 200px;
  overflow: hidden auto;
  padding-right: 6px;
  padding-left: 0;
  padding-top: 16px;
  border-top: none;
  box-sizing: border-box;
  flex: 1;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: var(--global-border-radius);

    &:hover {
      background: var(--el-border-color-hover);
    }
  }
}

.model-item-card {
  // 使用 CSS 变量，使用 CSS 变量控制
  --mic-bg: transparent;
  --mic-border-color: transparent;
  --mic-border-width: 2px;
  
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--global-border-radius);
  background: var(--mic-bg);
  border: var(--mic-border-width) solid var(--mic-border-color); // 使用透明边框，避免布局偏移
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  box-sizing: border-box;

  // 普通状态 hover - 粗描边
  &:hover:not(.is-disabled, .is-selected) {
    --mic-bg: transparent;
    --mic-border-color: var(--el-border-color-lighter);
  }

  // 选中状态 - 始终显示粗描边
  &.is-selected:not(.is-disabled) {
    --mic-bg: var(--el-fill-color-light);
    --mic-border-color: var(--el-border-color-lighter);
    
    // 选中状态 hover - 描边稍微加深
    &:hover:not(.is-disabled) {
      --mic-bg: var(--el-fill-color-light);
      --mic-border-color: var(--el-border-color);
    }
  }
  
  // 禁用状态 - 不显示描边
  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;

    --mic-border-color: transparent;
    
    &:hover {
      --mic-bg: transparent;
      --mic-border-color: transparent;
    }
    
    // 即使选中，禁用状态下也不显示描边
    &.is-selected,
    &.is-selected:hover {
      --mic-border-color: transparent;
    }
  }
  
  // 暗色主题下的样式
  :where(html.dark) & {
    // 普通状态 hover - 粗描边
    &:hover:not(.is-disabled, .is-selected) {
      --mic-bg: transparent;
      --mic-border-color: var(--border-unified-color);
    }
    
    // 选中状态 - 始终显示粗描边
    &.is-selected:not(.is-disabled) {
      --mic-bg: var(--el-fill-color-light);
      --mic-border-color: var(--border-unified-color);
      
      // 选中状态 hover - 描边稍微加深
      &:hover:not(.is-disabled) {
        --mic-bg: var(--el-fill-color-light);
        --mic-border-color: var(--border-unified-color);
      }
    }
  }

  .model-item-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;

    .model-icon-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .model-icon-default {
      font-size: 28px;
      color: var(--el-text-color-regular);
    }
  }

  .model-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    max-width: calc(100% - 36px - 12px - 24px);
    box-sizing: border-box;
    padding-top: 2px;

    .model-item-name-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      width: 100%;
    }

    .model-item-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      line-height: 1.4;
      word-break: break-word;
      overflow-wrap: break-word;
      margin: 0;
      padding: 0;
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    // API 接入按钮：与能力面板统一，</> + API，无链式图标
    .model-api-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 26px;
      padding: 0 8px;
      border: var(--unified-border);
      background: transparent;
      border-radius: var(--global-border-radius);
      color: var(--el-text-color-secondary);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: var(--el-fill-color-light);
        color: var(--el-text-color-primary);
        border-color: var(--el-border-color);
      }

      &:focus-visible {
        outline: 2px solid var(--el-color-primary-light-7);
        outline-offset: 1px;
      }
    }

    .model-api-btn__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      flex-shrink: 0;

      svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    }

    .model-api-btn__text {
      flex-shrink: 0;
    }

    .model-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.2s ease;
      margin-left: 6px;
      vertical-align: middle;

      &:hover {
        transform: scale(1.1);
      }

      &.model-badge-top {
        // 热门：火焰图标
        .fire-icon {
          width: 18px;
          height: 18px;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 0 3px var(--ai-orange-glow));
        }
      }

      &.model-badge-new {
        // 新模型：New 文字标签
        font-size: 10px;
        font-weight: 700;
        color: var(--color-on-primary); // 明暗模式自动适配：亮色=白字（绿底）、暗色=黑字（浅绿底）
        background: var(--el-color-success);
        padding: 2px 6px;
        border-radius: var(--global-border-radius);
        line-height: 1.2;
        letter-spacing: 0.5px;
        box-shadow: var(--global-box-shadow);
      }
    }

    // 暗色主题下的样式
    :where(html.dark) & {
      .model-badge {
        &.model-badge-top {
          .fire-icon {
            filter: drop-shadow(0 0 3px var(--ai-orange-glow-alt));
          }
        }

        &.model-badge-new {
          background: var(--el-color-success-light-4);
          box-shadow: var(--global-box-shadow);
        }
      }
    }

    .model-item-desc {
      font-size: 13px;
      color: var(--el-text-color-regular);
      line-height: 1.5;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
      overflow-wrap: break-word;
      margin: 0;
      padding: 0;
    }

    .model-time-tag {
      display: inline-block;
      font-size: 11px;
      color: var(--el-text-color-regular);
      background: var(--el-fill-color-light);
      padding: 4px 10px;
      border-radius: var(--global-border-radius);
      margin-top: 4px;
      width: fit-content;
      white-space: nowrap;
      line-height: 1.3;
      font-weight: 400;
    }
  }

  .model-checkbox {
    flex-shrink: 0;
    margin-top: 8px;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    font-size: 16px;
    color: var(--el-text-color-primary);
    transition: color 0.3s;
    background-color: transparent;
    background: transparent;
    
    input[type="checkbox"] {
      display: none;
    }
    
    .checkmark {
      width: 24px;
      height: 24px;
      border: 2px solid var(--el-text-color-primary);
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 0;
      transition: background-color 1.3s, border-color 1.3s, color 1.3s, transform 0.3s;
      transform-style: preserve-3d;
      position: relative;
    }
    
    .checkmark::before {
      content: "\2713";
      font-size: 16px;
      color: transparent;
      transition: color 1.3s, transform 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      margin: 0;
      padding: 0;
      transform: none; /* 移除 translateY，使用 flexbox 居中 */
      text-align: center; /* 确保文本居中 */
      box-sizing: border-box; /* 确保包含边框 */
    }
    
    input[type="checkbox"]:checked + .checkmark {
      background-color: var(--el-text-color-primary);
      border-color: var(--el-text-color-primary);
      transform: scale(1.1) rotateZ(360deg) rotateY(360deg);
    }
    
    input[type="checkbox"]:checked + .checkmark::before {
      color: var(--color-on-primary);
      transform: none; /* 移除 translateY，使用 flexbox 居中 */
    }
    
    &:hover:not(.is-disabled) {
      color: var(--el-text-color-regular);
      
      .checkmark {
        border-color: var(--el-text-color-regular);
        background-color: var(--el-fill-color-light);
        transform: scale(1.05);
      }
    }
    
    input[type="checkbox"]:focus + .checkmark {
      box-shadow: var(--global-box-shadow);
      outline: none;
    }
    
    &.is-disabled {
      cursor: not-allowed;
      opacity: 0.5;
      
      .checkmark {
        cursor: not-allowed;
        border-color: var(--el-disabled-border-color);
        background-color: var(--el-disabled-bg-color);
      }
      
      input[type="checkbox"]:checked + .checkmark {
        background-color: var(--el-disabled-bg-color);
        border-color: var(--el-disabled-border-color);
      }
      
      &:hover .checkmark {
        transform: none;
        background-color: var(--el-disabled-bg-color);
        border-color: var(--el-disabled-border-color);
      }
    }
    
    // 暗色模式适配
    :where(html.dark) & {
      color: var(--el-text-color-primary);

      .checkmark {
        border-color: var(--el-color-primary); // 暗色下边框跟随主色，避免浅色边框在浅色背景上消失
      }

      &:hover:not(.is-disabled) .checkmark {
        border-color: var(--el-color-primary);
        background-color: var(--color-white-10);
      }

      input[type="checkbox"]:checked + .checkmark {
        background-color: var(--el-color-primary); // 与亮色逻辑一致：primary 背景
        border-color: var(--el-color-primary);
      }

      input[type="checkbox"]:checked + .checkmark::before {
        color: var(--color-on-primary); // 明暗模式自动适配：暗色下=黑对号
      }
    }
  }
}

// 保留旧的样式以兼容（如果需要）
.model-auto-switch {
  display: none; // 隐藏旧样式
}

.model-tabs {
  display: none; // 隐藏旧样式
}

.model-radio-group {
  display: none; // 隐藏旧样式

  .model-item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;

    .model-name {
      font-weight: 500;
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    .model-provider {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      display: flex;
      align-items: center;
      gap: 4px;

      &::before {
        content: '';
        display: inline-block;
        width: 4px;
        height: 4px;
        border-radius: var(--global-border-radius);
        background: var(--el-color-primary);
      }
    }

    .model-desc {
      font-size: 11px;
      color: var(--el-text-color-placeholder);
      line-height: 1.4;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .model-capabilities {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 4px;
      align-items: center;

      .capability-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: var(--global-border-radius);
        background: var(--el-fill-color-light);
        color: var(--el-text-color-secondary);
        border: var(--unified-border);
        transition: all 0.2s ease;
        
        .el-icon {
          font-size: 12px;
        }

        &:hover {
          background: var(--el-fill-color);
          border-color: var(--el-border-color-light);
        }
        
        // 流式响应能力
        &.capability-streaming {
          background: var(--color-black-10);
          color: var(--el-color-primary);
          border-color: var(--color-black-30);
        }
        
        // 图像能力
        &.capability-image {
          background: var(--color-success-10);
          color: var(--el-color-success);
          border-color: var(--color-success-30);
        }
        
        // 音频能力
        &.capability-audio {
          background: var(--color-warning-10);
          color: var(--el-color-warning);
          border-color: var(--color-warning-30);
        }
        
        // 视频能力
        &.capability-video {
          background: var(--color-danger-10);
          color: var(--el-color-danger);
          border-color: var(--color-danger-30);
        }
      }
    }
  }

  .el-radio {
    display: none; // 隐藏旧样式
    width: 100%;
    margin: 0;
    padding: 8px 12px;
    border-radius: var(--global-border-radius);
    transition: all 0.2s ease;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.is-checked {
      background: var(--el-color-primary-light-9);
      border: var(--el-border-width-primary) solid var(--el-color-primary);

      .model-name {
        color: var(--el-color-primary);
      }
    }
  }
}

// ============================================
// 移动端响应式样式 - 使用 CSS 变量，使用 CSS 变量控制
// ============================================
@media (width <= 768px) {
  .ai-dialog .input-wrapper {
    // CSS 变量定义
    --mobile-icon-size: 16px;
    --mobile-btn-size: 44px;
    --mobile-btn-min-size: 36px;
    --mobile-icon-lg: 18px;
    
    padding: 12px 16px;
    box-shadow: none;
    filter: none;
    outline: none;

    .header-top {
      margin: 0;
      padding: 0;
      padding-bottom: 6px;
      width: 100%;
      height: auto;
      min-height: 0;
      line-height: 1;
    }

    :where(.header-top) :where(.header-left) .dialog-title {
      font-size: 14px;
      gap: 8px;

      .title-icon {
        font-size: var(--mobile-icon-size);
        width: var(--mobile-icon-size);
        height: var(--mobile-icon-size);

        :deep(svg) {
          width: var(--mobile-icon-size);
          height: var(--mobile-icon-size);
        }
      }
    }

    :where(.header-top) :where(.header-right) .header-btn {
      padding: 0;
      min-width: var(--mobile-btn-min-size);
      min-height: var(--mobile-btn-min-size);
      width: var(--mobile-btn-size);
      height: var(--mobile-btn-size);

      :deep(.el-button__inner) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 0;
      }

      :deep(.el-icon) {
        font-size: var(--mobile-icon-lg);
        width: var(--mobile-icon-lg);
        height: var(--mobile-icon-lg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
      }

      :deep(svg) {
        width: var(--mobile-icon-lg);
        height: var(--mobile-icon-lg);
        display: block;
        margin: 0 auto;
      }
    }

    .ai-dialog {
      // 移动端输入区域变量
      --mobile-action-btn-size: 44px;
      --mobile-action-btn-height: 22px;
      --mobile-action-icon-size: 20px;
      
      .input-wrapper {
        padding: 6px;
        gap: 8px;
        box-shadow: none;
        filter: none;
        outline: none;
      }

      .input-actions .send-btn {
        padding: 8px 14px;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 8px;
        vertical-align: middle;

        :deep(.el-button__inner) {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 100%;
        }

        :deep(.el-icon) {
          font-size: var(--mobile-icon-lg);
          width: var(--mobile-icon-lg);
          height: var(--mobile-icon-lg);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin: 0;
          padding: 0;
          vertical-align: middle;
        }

        span {
          display: inline-block;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
          padding: 0;
          vertical-align: middle;
        }
      }

      .input-actions .input-action-btn {
        min-width: var(--mobile-action-btn-size);
        min-height: var(--mobile-action-btn-height);
        width: var(--mobile-action-btn-size);
        height: var(--mobile-action-btn-height);
        padding: 0;

        :deep(.el-button__inner) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 0;
        }

        :deep(.el-icon) {
          font-size: var(--mobile-action-icon-size);
          width: var(--mobile-action-icon-size);
          height: var(--mobile-action-icon-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
        }

        :deep(svg) {
          width: var(--mobile-action-icon-size);
          height: var(--mobile-action-icon-size);
          display: block;
          margin: 0 auto;
        }
      }
    }
  }
}

// ============================================
// 下拉菜单样式 - 使用 CSS 变量，使用 CSS 变量控制
// ============================================
.mode-switcher,
.el-dropdown {
  // CSS 变量定义
  --dropdown-width: 500px;
  --dropdown-padding: 20px;
  --dropdown-radius: 15px;
  --dropdown-icon-size: 18px;
  
  :deep(.el-dropdown-menu) {
    &.model-selector-dropdown {
      min-width: var(--dropdown-width);
      max-width: var(--dropdown-width);
      width: var(--dropdown-width);
      padding: var(--dropdown-padding);
      border-radius: var(--dropdown-radius);
      box-sizing: border-box;
    }

    .el-dropdown-item {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      padding: 10px 16px;
      min-height: 40px;

      .el-icon {
        flex-shrink: 0;
        width: var(--dropdown-icon-size);
        height: var(--dropdown-icon-size);
        font-size: var(--dropdown-icon-size);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;

        svg {
          width: var(--dropdown-icon-size);
          height: var(--dropdown-icon-size);
          display: block;
        }
      }

      span {
        flex: 1;
        font-size: 14px;
        line-height: 1.5;
        margin: 0;
        padding: 0;
        white-space: nowrap;
      }
    }
  }
}

</style>

<!-- 全局样式：使用 @layer utilities 确保优先级，使用 CSS 变量控制 -->
<style lang="scss">
@layer utilities {
  /* model-selector-dropdown 圆角 */
  .el-dropdown-menu.model-selector-dropdown,
  ul.model-selector-dropdown,
  .el-popper .el-dropdown-menu.model-selector-dropdown,
  body > .el-popper .el-dropdown-menu.model-selector-dropdown,
  body > .el-popper ul.model-selector-dropdown,
  #el-popper-container .el-dropdown-menu.model-selector-dropdown,
  #el-popper-container ul.model-selector-dropdown,
  .el-dropdown__popper .el-dropdown-menu.model-selector-dropdown,
  .el-popper[class*="el-dropdown__popper"] .el-dropdown-menu.model-selector-dropdown,
  .el-popper[class*="el-dropdown__popper"] ul.model-selector-dropdown {
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }

  /* model-item-card hover 和选中状态效果 */
  .model-item-card {
    --mic-border-color: transparent;
    --mic-bg: transparent;
    
    border: 2px solid var(--mic-border-color);
    transition: border-color 0.15s ease, background-color 0.15s ease;
    background: var(--mic-bg);
    
    &:hover:not(.is-disabled, .is-selected) {
      --mic-border-color: var(--el-border-color-lighter);
      --mic-bg: transparent;
    }
    
    &.is-selected:not(.is-disabled) {
      --mic-border-color: var(--el-border-color-lighter);
      --mic-bg: var(--el-fill-color-light);
      
      &:hover:not(.is-disabled) {
        --mic-border-color: var(--el-border-color);
        --mic-bg: var(--el-fill-color-light);
      }
    }
    
    &.is-disabled {
      --mic-border-color: transparent;
      
      &:hover,
      &.is-selected,
      &.is-selected:hover {
        --mic-border-color: transparent;
        --mic-bg: transparent;
      }
    }
  }

  /* 暗色主题 model-item-card */
  :where(html.dark) .model-item-card {
    &:hover:not(.is-disabled, .is-selected) {
      --mic-border-color: var(--color-white-12);
    }
    
    &.is-selected:not(.is-disabled) {
      --mic-border-color: var(--color-white-12);
      
      &:hover:not(.is-disabled) {
        --mic-border-color: var(--color-white-18);
      }
    }
  }

  /* 外层容器圆角 */
  .el-popper[class*="el-dropdown__popper"]:has(.model-selector-dropdown),
  .el-popper[class*="el-dropdown__popper"]:has(ul.model-selector-dropdown),
  #el-popper-container > .el-popper:has(.model-selector-dropdown),
  #el-popper-container > .el-popper:has(ul.model-selector-dropdown) {
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }

  /* agent-mode-btn 描边 */
  .input-action-btn.agent-mode-btn {
    --amb-border-color: var(--el-border-color);
    --amb-height: 22px;
    
    border: var(--unified-border);
    min-height: var(--amb-height);
    height: var(--amb-height);
  }

  :where(html.dark) .input-action-btn.agent-mode-btn {
    --amb-border-color: var(--el-border-color-darker);
  }

  /* model-category-tabs 选中状态描边 */
  .model-category-tabs :deep(.el-tabs__item.is-active) {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
  }

  /* model-tag 描边 */
  .model-tag.el-tag {
    --mt-border: var(--el-border-width-primary) solid var(--el-color-primary);
    --mt-border-width: var(--el-border-width-primary);
    
    border: var(--unified-border);
    
    &:hover {
      border-color: var(--mt-border-color);
    }
    
    &.el-tag--success {
      --mt-border-color: var(--el-color-success);
    }
  }

  :where(html.dark) .model-tag.el-tag {
    --mt-border-color: var(--color-white-30);
    
    &:hover {
      border-color: var(--color-white-50);
    }
  }

  /* input-wrapper 阴影控制 */
  .ai-dialog:not(:has(.input-wrapper:hover), :has(.input-wrapper:focus-within))::before,
  .ai-dialog:not(:has(.input-wrapper:hover), :has(.input-wrapper:focus-within))::after {
    box-shadow: none;
    filter: none;
    outline: none;
  }

  .input-wrapper:not(:hover, :focus-within) {
    box-shadow: none;
    filter: none;
    outline: none;
    transform: translateY(0);
  }

  .input-wrapper:hover:not(:focus-within),
  .input-wrapper:focus-within {
    box-shadow: var(--global-box-shadow);
  }

  .input-wrapper:not(:hover, :focus-within)::before,
  .input-wrapper:not(:hover, :focus-within)::after {
    box-shadow: none;
    filter: none;
  }
}
</style>
