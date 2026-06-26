<template>
  <div class="voice-input-container">
    <ElButton
      :type="isActive ? 'danger' : 'default'"
      :loading="isActive"
      @click="toggleVoiceInput"
      circle
      size="large"
      class="voice-button"
    >
      <template v-if="!isActive">
        <ElIcon><Microphone /></ElIcon>
      </template>
      <template v-else>
        <ElIcon class="is-loading"><Loading /></ElIcon>
      </template>
    </ElButton>

    <div v-if="isActive" class="voice-indicator">
      <div class="voice-wave">
        <div class="wave-bar" v-for="i in 5" :key="i"></div>
      </div>
      <div class="voice-text">{{ t('voiceInput.listening') }}</div>
      <ElButton 
        size="small" 
        type="danger" 
        @click="stopRecognition" 
        class="stop-button"
      >
        <ElIcon><Close /></ElIcon>
        {{ t('voiceInput.stop') || '停止' }}
      </ElButton>
    </div>

    <div v-if="transcript" class="transcript-preview">
      <div class="transcript-text">{{ transcript }}</div>
      <ElButton size="small" @click="clearTranscript" :icon="Close" circle />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElIcon, ElMessage } from 'element-plus'
import { Microphone, Loading, Close } from '@element-plus/icons-vue'

interface Props {
  language?: string
  continuous?: boolean
  interimResults?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  language: 'zh-CN',
  continuous: false,
  interimResults: true,
})

const emit = defineEmits<{
  transcript: [text: string, isFinal: boolean]
  start: []
  end: []
  error: [error: Error]
}>()

const { t } = useI18n()

// SpeechRecognition 类型定义
interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

type WindowWithSpeechRecognition = Window & typeof globalThis & {
  SpeechRecognition?: new () => SpeechRecognition
  webkitSpeechRecognition?: new () => SpeechRecognition
}

const isActive = ref(false)
const transcript = ref('')
let recognition: SpeechRecognition | null = null

const initRecognition = () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    ElMessage.error(t('voiceInput.notSupported'))
    return null
  }

  const SpeechRecognitionClass =
    (window as WindowWithSpeechRecognition).SpeechRecognition || 
    (window as WindowWithSpeechRecognition).webkitSpeechRecognition
  if (!SpeechRecognitionClass) {
    ElMessage.error(t('voiceInput.notSupported'))
    return null
  }
  const recognitionInstance = new SpeechRecognitionClass()
  recognitionInstance.lang = props.language
  recognitionInstance.continuous = props.continuous
  recognitionInstance.interimResults = props.interimResults

  recognitionInstance.onstart = () => {
    isActive.value = true
    emit('start')
  }

  recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = ''
    let finalTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalTranscript += result[0].transcript
      } else {
        interimTranscript += result[0].transcript
      }
    }

    transcript.value = finalTranscript || interimTranscript
    emit('transcript', transcript.value, !!finalTranscript)
  }

  recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
    const errorMsg = event.error ? t('voiceInput.error', { error: event.error }) : t('voiceInput.error', { error: '' })
    const error = new Error(errorMsg)
    emit('error', error)

    if (event.error === 'no-speech') {
      ElMessage.warning(t('voiceInput.noSpeech'))
    } else if (event.error === 'audio-capture') {
      ElMessage.error(t('voiceInput.noMicrophone'))
    } else if (event.error === 'not-allowed') {
      ElMessage.error(t('voiceInput.permissionDenied'))
    } else {
      ElMessage.error(t('voiceInput.error', { error: event.error }))
    }

    stopRecognition()
  }

  recognitionInstance.onend = () => {
    isActive.value = false
    emit('end')
  }

  recognition = recognitionInstance
  return recognition
}

const toggleVoiceInput = () => {
  if (isActive.value) {
    stopRecognition()
  } else {
    startRecognition()
  }
}

const startRecognition = () => {
  if (!recognition) {
    recognition = initRecognition()
  }

  if (recognition) {
    transcript.value = ''
    recognition.start()
  }
}

const stopRecognition = () => {
  if (recognition) {
    recognition.stop()
  }
}

const clearTranscript = () => {
  transcript.value = ''
}

onUnmounted(() => {
  if (recognition) {
    recognition.stop()
  }
})

defineExpose({
  start: startRecognition,
  stop: stopRecognition,
  clear: clearTranscript,
  isActive,
  transcript,
})
</script>

<style scoped>
.voice-input-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.voice-button {
  width: 48px;
  height: 48px;
  font-size: 20px;
  transition: transform 0.3s;
}

.voice-button:hover {
  transform: scale(1.1);
}

.voice-button.is-active {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }
}

.voice-indicator {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--el-bg-color);
  border: var(--unified-border);
  padding: 16px 24px;
  border-radius: var(--global-border-radius);
  text-align: center;
  min-width: 200px;
  z-index: var(--z-header);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.stop-button {
  margin-top: 4px;
}

.voice-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
  height: 40px;
}

.wave-bar {
  width: 4px;
  background: var(--el-color-danger);
  border-radius: var(--global-border-radius);
  animation: wave 1s ease-in-out infinite;
}

.wave-bar:nth-child(1) {
  animation-delay: 0s;
  height: 20px;
}

.wave-bar:nth-child(2) {
  animation-delay: 0.1s;
  height: 30px;
}

.wave-bar:nth-child(3) {
  animation-delay: 0.2s;
  height: 40px;
}

.wave-bar:nth-child(4) {
  animation-delay: 0.3s;
  height: 30px;
}

.wave-bar:nth-child(5) {
  animation-delay: 0.4s;
  height: 20px;
}

@keyframes wave {
  0%,
  100% {
    transform: scaleY(0.5);
  }

  50% {
    transform: scaleY(1);
  }
}

.voice-text {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.transcript-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--el-fill-color-light);
  padding: 8px 12px;
  border-radius: var(--global-border-radius);
  max-width: 300px;
}

.transcript-text {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
