<template>
  <div class="input-area">
    <div v-if="quotedMessage" class="quoted-preview">
      <div class="quoted-preview-header">
        <el-icon><MessageCircle /></el-icon>
        <span>{{ t('floatingChat.replyingTo', { role: quotedMessage.role === 'user' ? t('common.user') : 'AI' }) }}</span>
        <el-button link size="small" class="cancel-reply-btn" @click="$emit('cancelReply')">
          <el-icon><X /></el-icon>
        </el-button>
      </div>
      <div class="quoted-preview-content">
        {{ quotedMessage.content.substring(0, 100) }}{{ quotedMessage.content.length > 100 ? '...' : '' }}
      </div>
    </div>

    <div v-if="uploadedFiles.length > 0" class="file-preview">
      <div v-for="file in uploadedFiles" :key="file.id" class="preview-item">
        <el-image v-if="file.type?.startsWith('image/')" :src="file.preview" fit="cover" class="preview-image" />
        <div v-else class="preview-file">
          <el-icon><Document /></el-icon>
          <span class="file-name">{{ file.name }}</span>
          <span v-if="file.size" class="file-size">{{ formatFileSize(file.size) }}</span>
        </div>
        <el-button link size="small" class="remove-file-btn" :title="t('common.delete')" @click="$emit('removeFile', index)">
          <el-icon><X /></el-icon>
        </el-button>
      </div>
    </div>

    <div v-if="quickTools && quickTools.length > 0" ref="quickToolsBarRef" class="quick-tools-bar">
      <button
        v-for="(tool, index) in quickTools"
        :key="index"
        class="quick-tool-item"
        :title="tool.text"
        @click="$emit('useQuickTool', tool.text)"
      >
        {{ tool.text }}
      </button>
    </div>

    <div class="input-wrapper">
      <div
        ref="inputRef"
        class="chat-input"
        :class="{ 'has-voice-card': voiceAudioData }"
        contenteditable="true"
        :data-placeholder="placeholder"
        @keydown.enter.exact.prevent="handleSend"
        @keydown.enter.shift.exact="handleShiftEnter"
        @input="handleInputChange"
        @paste="handlePaste"
      ></div>

      <div class="input-actions">
        <el-tooltip v-if="enableVoice" :content="isRecording ? '停止录音' : (voiceAudioData ? '重新录音' : t('floatingChat.voiceInput'))" placement="top">
          <el-button
            link
            size="small"
            class="action-btn"
            :class="{ 'is-recording': isRecording, 'has-audio': voiceAudioData }"
            @click="$emit('toggleVoice')"
          >
            <el-icon v-if="isRecording"><MicrophoneOff /></el-icon>
            <el-icon v-else><Microphone /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip v-if="enableFileUpload" :content="t('floatingChat.uploadFile')" placement="top">
          <el-button link size="small" class="action-btn" @click="$emit('uploadFile')">
            <UploadPlusIcon :size="16" />
          </el-button>
        </el-tooltip>

        <el-button
          type="primary"
          size="small"
          class="send-btn"
          :disabled="isSending"
          @click="handleSend"
        >
          <el-icon v-if="!isSending"><Promotion /></el-icon>
          <el-icon v-else class="is-loading"><Loader2 /></el-icon>
          <span class="send-btn-text">{{ t('floatingChat.send') }}</span>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageCircle, X, Document, Microphone, MicrophoneOff, Promotion, Loader2 } from '@/lib/lucide-fallback'
import { UploadPlusIcon } from '@/components/icons'
import type { ChatMessage } from '@/types/ai-platform.types'
import { formatFileSize } from '@/utils/format'

export interface FilePreview {
  id: string
  name: string
  type: string
  preview: string
  size?: number
}

export interface QuickTool {
  text: string
  icon?: string
}

const props = defineProps<{
  placeholder?: string
  isSending?: boolean
  isRecording?: boolean
  enableVoice?: boolean
  enableFileUpload?: boolean
  uploadedFiles?: FilePreview[]
  quickTools?: QuickTool[]
  quotedMessage?: ChatMessage | null
  voiceAudioData?: { audioUrl: string; duration: number } | null
}>()

const emit = defineEmits<{
  (e: 'send', content: string): void
  (e: 'toggleVoice'): void
  (e: 'uploadFile'): void
  (e: 'removeFile', index: number): void
  (e: 'useQuickTool', text: string): void
  (e: 'cancelReply'): void
  (e: 'inputChange', content: string): void
  (e: 'paste', event: ClipboardEvent): void
}>()

const { t } = useI18n()
const inputRef = ref<HTMLDivElement | null>(null)

function handleSend(): void {
  const content = inputRef.value?.textContent?.trim() || ''
  if (content || props.uploadedFiles?.length) {
    emit('send', content)
    if (inputRef.value) {
      inputRef.value.textContent = ''
    }
  }
}

function handleShiftEnter(): void {
  if (inputRef.value) {
    const selection = window.getSelection()
    const range = selection?.getRangeAt(0)
    if (range && selection) {
      const br = document.createElement('br')
      range.insertNode(br)
      range.setStartAfter(br)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }
}

function handleInputChange(): void {
  const content = inputRef.value?.textContent?.trim() || ''
  emit('inputChange', content)
}

function handlePaste(event: ClipboardEvent): void {
  emit('paste', event)
}

function focus(): void {
  inputRef.value?.focus()
}

function clear(): void {
  if (inputRef.value) {
    inputRef.value.textContent = ''
  }
}

function setContent(content: string): void {
  if (inputRef.value) {
    inputRef.value.textContent = content
  }
}

defineExpose({ focus, clear, setContent, inputRef })
</script>

<style scoped>
.input-area {
  padding: 12px 16px;
  border-top: var(--unified-border);
  background: var(--el-bg-color);
}

.quoted-preview {
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  border-left: var(--el-border-width-primary) solid var(--el-color-primary);
}

.quoted-preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cancel-reply-btn {
  margin-left: auto;
  padding: 2px;
}

.quoted-preview-content {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.preview-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.preview-image {
  width: 48px;
  height: 48px;
  border-radius: var(--global-border-radius);
  object-fit: cover;
}

.preview-file {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-name {
  font-size: 12px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.remove-file-btn {
  position: absolute;
  top: -4px;
  right: -4px;
  padding: 2px;
  background: var(--el-bg-color);
  border-radius: 50%;
}

.quick-tools-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.quick-tool-item {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--el-fill-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.quick-tool-item:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.chat-input {
  flex: 1;
  min-height: 36px;
  max-height: 120px;
  padding: 8px 12px;
  background: var(--el-fill-color-blank);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  outline: none;
  font-size: 14px;
  line-height: 1.5;
  overflow-y: auto;
  word-break: break-word;
}

.chat-input:focus {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

.chat-input:empty::before {
  content: attr(data-placeholder);
  color: var(--el-text-color-placeholder);
  pointer-events: none;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  padding: 8px;
  color: var(--el-text-color-regular);
}

.action-btn:hover {
  color: var(--el-color-primary);
}

.action-btn.is-recording {
  color: var(--color-danger-variant);
  animation: pulse 1s infinite;
}

.action-btn.has-audio {
  color: var(--el-color-success);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.send-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--el-bg-color-page);
  border: var(--unified-border);
}

.send-btn.el-button--primary {
  background-color: var(--el-bg-color-page);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

.send-btn.el-button--primary .send-btn-text {
  color: var(--el-text-color-primary);
  transition: color 0.3s ease;
}

.send-btn.el-button--primary .el-icon {
  color: var(--el-text-color-primary);
}

.send-btn.el-button--primary .el-icon svg {
  fill: var(--el-text-color-primary);
  color: var(--el-text-color-primary);
  transition: fill 0.3s ease, color 0.3s ease;
}

.send-btn.el-button--primary:hover {
  background-color: var(--el-bg-color-page);
  border-color: var(--el-border-color);
}

.send-btn.el-button--primary:hover .send-btn-text {
  color: var(--el-color-primary);
}

.send-btn.el-button--primary:hover .el-icon {
  color: var(--el-color-primary);
}

.send-btn.el-button--primary:hover .el-icon svg {
  fill: var(--el-color-primary);
  color: var(--el-color-primary);
}

.send-btn-text {
  font-size: 13px;
}
</style>