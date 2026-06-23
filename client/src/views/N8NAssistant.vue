<template>
  <div class="n8n-assistant-page">
    <!-- Deep Background System -->
    <div class="cyber-background">
      <div class="glow-orb glow-orb--1"></div>
      <div class="glow-orb glow-orb--2"></div>
      <div class="glow-orb glow-orb--3"></div>
    </div>

    <!-- Page Header -->
    <div class="page-header glass-card">
      <button class="back-btn ripple-btn" aria-label="返回" @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <h1 class="page-title">
        <span class="title-glow">{{ pageTitle }}</span>
      </h1>
      <div class="header-accent"></div>
    </div>

    <!-- Guide Toggle -->
    <div class="tishi-block glass-card ripple-btn" @click="tishiHandle">
      <div class="tishi-icon-wrapper">
        <el-icon class="tishi-icon">
          <InfoFilled v-if="!tishiShow" />
          <Close v-else />
        </el-icon>
      </div>
      <span class="tishi-text">{{
        tishiShow ? t('n8nAssistant.close') : t('n8nAssistant.viewGuide')
      }}</span>
      <div class="tishi-indicator" :class="{ active: tishiShow }"></div>
    </div>

    <!-- Guide Content -->
    <Transition name="slide-fade">
      <div v-show="tishiShow" class="intelligent-assistant glass-card scroll-reveal">
        <div class="guide-content">
          <h3 class="guide-title">
            <span class="title-accent"></span>
            {{ t('n8nAssistant.guideTitle') }}
          </h3>
          <ul class="guide-list">
            <li v-for="(item, index) in guideItems" :key="index" class="guide-item">
              <span class="item-marker"></span>
              <span class="item-text">{{ item }}</span>
            </li>
          </ul>
        </div>
      </div>
    </Transition>

    <!-- Tishi Box -->
    <Transition name="slide-fade">
      <div v-if="tishiShow && tishiContent" class="tishi-box glass-card-dark scroll-reveal">
        <div class="tishi-box-back">
          <div class="tishi-title">
            <div class="title-icon-wrapper">
              <el-icon><InfoFilled /></el-icon>
            </div>
            <span class="tishi-title-text">{{ t('n8nAssistant.tishiTitle') }}</span>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="tishi-content" v-html="sanitizeHtml(tishiContent)"></div>
        </div>
        <div class="card-border-glow"></div>
      </div>
    </Transition>

    <!-- Chat Container -->
    <div class="chat-container glass-card" ref="chatContainer">
      <div v-if="questionList.length === 0" class="welcome-message scroll-reveal">
        <div class="welcome-avatar">
          <div class="avatar-ring"></div>
          <div class="avatar-ring avatar-ring--2"></div>
          <img :src="botAvatar" alt="Bot" loading="lazy" />
        </div>
        <div class="welcome-text">{{ t('n8nAssistant.welcome') }}</div>
        <div class="welcome-particles">
          <span v-for="n in 6" :key="n" class="particle"></span>
        </div>
      </div>

      <div v-for="(item, index) in questionList" :key="index" class="message-group scroll-reveal">
        <div v-if="item.imgsList && item.imgsList.length > 0" class="question-images">
          <img
            v-for="(img, imgIndex) in item.imgsList"
            :key="imgIndex"
            :src="img.imgUrl"
            alt="Question Image"
            class="question-image"
            loading="lazy"
          />
        </div>

        <div class="question-container">
          <div class="question-actions">
            <button class="action-btn ripple-btn" aria-label="复制到输入框" @click="copyToInput(item.question)">
              <el-icon><CopyDocument /></el-icon>
            </button>
          </div>
          <div class="question-text glass-card-accent">
            {{ item.question }}
            <div class="message-glow"></div>
          </div>
        </div>

        <div class="answer-container glass-card">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-if="isAnswerVisible(index) && agentContentList[index]"
            class="answer-content"
            v-html="formatContent(agentContentList[index].content)"
          ></div>

          <div v-if="isAnswerVisible(index) && agentContentList[index]" class="answer-media">
            <el-image
              v-for="(img, imgIndex) in agentContentList[index].imgUrlList"
              :key="'img-' + imgIndex"
              :src="img"
              :preview-src-list="agentContentList[index].imgUrlList"
              fit="cover"
              class="answer-image"
            />

            <audio
              v-for="(audio, audioIndex) in agentContentList[index].audioUrlList"
              :key="'audio-' + audioIndex"
              :src="audio"
              controls
              class="answer-audio"
            />

            <video
              v-for="(video, videoIndex) in agentContentList[index].videoUrlList"
              :key="'video-' + videoIndex"
              :src="video"
              controls
              preload="none"
              class="answer-video"
            />
          </div>

          <div class="answer-meta">
            <span class="token-consumption">
              <span class="token-icon"></span>
              {{ t('n8nAssistant.generated') }}
              <span v-if="agentContentList[index].total_tokens !== undefined" class="token-value">
                {{
                  t('n8nAssistant.tokensConsumed', {
                    count: formatTokens(agentContentList[index].total_tokens),
                  })
                }}
              </span>
            </span>
          </div>

          <div class="answer-actions">
            <button class="action-btn ripple-btn" aria-label="切换答案显示" @click="toggleAnswerVisibility(index)">
              <el-icon>
                <View v-if="!answerVisibilityStates[index]" />
                <Hide v-else />
              </el-icon>
            </button>
            <button
              class="action-btn ripple-btn"
              aria-label="切换思考过程"
              @click="toggleThinking(index)"
              v-if="agentContentList[index] && agentContentList[index].isHaveSikao"
            >
              <el-icon><Reading /></el-icon>
            </button>
            <button
              class="action-btn ripple-btn"
              aria-label="复制内容"
              @click="
                copyContent(agentContentList[index].copyContent || agentContentList[index].content)
              "
            >
              <el-icon><CopyDocument /></el-icon>
            </button>
            <button
              class="action-btn ripple-btn"
              aria-label="下载图片"
              @click="downloadImages(index)"
              v-if="
                agentContentList[index] &&
                agentContentList[index].imgUrlList &&
                agentContentList[index].imgUrlList.length > 0
              "
            >
              <el-icon><Download /></el-icon>
            </button>
            <button class="action-btn ripple-btn" aria-label="分享" @click="shareMessage(index)">
              <el-icon><Share /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-message">
        <div class="cyber-loader">
          <div class="loader-ring"></div>
          <div class="loader-ring loader-ring--2"></div>
          <div class="loader-core"></div>
        </div>
        <span class="loading-text">{{ t('n8nAssistant.generating') }}</span>
      </div>
    </div>

    <!-- Quick Actions -->
    <div
      class="quick-actions glass-card"
      v-if="suggestedQuestionsList.length > 0 && questionList.length === 0"
    >
      <div class="quick-actions-scroll">
        <button
          v-for="(question, index) in suggestedQuestionsList"
          :key="index"
          class="quick-action-btn ripple-btn"
          @click="handleQuickActionClick(question)"
        >
          <span class="btn-text">{{ question }}</span>
          <span class="btn-glow"></span>
        </button>
      </div>
    </div>

    <!-- Thinking Panel -->
    <Transition name="scale-fade">
      <div class="thinking-panel glass-card-dark" v-if="thinkingPanelVisible">
        <div class="thinking-panel-header">
          <div class="thinking-icon-wrapper">
            <el-icon><Reading /></el-icon>
          </div>
          <span class="thinking-title">{{ t('n8nAssistant.thinkingTitle') }}</span>
          <div class="loader-container">
            <div class="loader-dot"></div>
            <div class="loader-dot"></div>
            <div class="loader-dot"></div>
            <div class="loader-dot"></div>
          </div>
        </div>
        <div class="thinking-progress-container" v-if="showThinkingProgress">
          <div class="thinking-progress-bar" :style="{ width: thinkingProgress + '%' }">
            <div class="progress-glow"></div>
          </div>
          <div class="thinking-progress-text">{{ Math.floor(thinkingProgress) }}%</div>
        </div>
        <div class="thinking-content">
          <span v-if="displayedThinkingContent.length === 0" class="thinking-tip">{{
            t('n8nAssistant.thinkingTip')
          }}</span>
          {{ displayedThinkingContent }}
        </div>
        <div class="panel-border-glow"></div>
      </div>
    </Transition>

    <!-- Input Section -->
    <div class="input-section glass-card">
      <div class="input-glow-line"></div>
      <div class="model-selector">
        <el-select v-model="selectedModel" placeholder="Select Model" size="small" class="cyber-select">
          <el-option
            v-for="model in modelList"
            :key="model.name"
            :label="model.name"
            :value="model.name"
          />
        </el-select>
      </div>

      <div class="input-wrapper">
        <div class="input-container">
          <el-input
            v-model="prompt"
            type="textarea"
            :rows="inputFocused ? 4 : 1"
            :placeholder="t('n8nAssistant.placeholder')"
            @focus="inputFocused = true"
            @blur="inputFocused = false"
            @keydown.enter.ctrl="handleSendMessage"
            class="message-input cyber-input"
          />
          <div class="input-border-glow" :class="{ active: inputFocused }"></div>
        </div>

        <div class="input-actions">
          <button class="action-btn ripple-btn" aria-label="上传图片" @click="handleImageUpload">
            <el-icon><Picture /></el-icon>
          </button>
          <button class="action-btn ripple-btn" aria-label="语音输入" @click="handleVoiceInput">
            <el-icon><Microphone /></el-icon>
          </button>
          <button
            class="send-btn ripple-btn"
            @click="handleSendMessage"
            :disabled="!prompt.trim() || loading"
            :class="{ loading: loading }"
          >
            <el-icon v-if="!loading"><Promotion /></el-icon>
            <span class="btn-text">{{ t('n8nAssistant.send') }}</span>
            <span class="btn-glow"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  InfoFilled,
  Close,
  CopyDocument,
  View,
  Hide,
  Download,
  Share,
  Picture,
  Microphone,
  Promotion,
  Reading,
} from '@element-plus/icons-vue'
import { useApiError } from '@/composables/useApiError'
import { sanitizeHtml, escapeHtml } from '@/utils/htmlSanitizer'
import { isMockEnabled } from '@/utils/envUtils'
import AI_DEFAULT_ICON from '@/assets/icons/common/ai_default.svg'

interface Question {
  question: string
  imgsList?: { imgUrl: string }[]
}

interface AgentContent {
  content: string
  imgUrlList?: string[]
  videoUrlList?: string[]
  total_tokens?: number
  copyContent?: string
  thinkingContent?: string
}

const { t } = useI18n()

const pageTitle = ref(t('n8nAssistant.pageTitle'))
const tishiShow = ref(true)
const tishiContent = ref('')
const guideItems = computed(() => [
  t('n8nAssistant.guideItem1'),
  t('n8nAssistant.guideItem2'),
  t('n8nAssistant.guideItem3'),
  t('n8nAssistant.guideItem4'),
])

const questionList = ref<Question[]>([])
const agentContentList = ref<AgentContent[]>([])
const prompt = ref('')
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const inputFocused = ref(false)
const selectedModel = ref('GLM-4.5')
const modelList = ref([{ name: 'GLM-4.5' }, { name: 'DOUBAO-SEED-1.6' }])
const suggestedQuestionsList = ref<string[]>([])
const botAvatar = ref(AI_DEFAULT_ICON)

const answerVisibilityStates = ref<Record<number, boolean>>({})
const thinkingPanelVisible = ref(false)
const displayedThinkingContent = ref('')
const thinkingProgress = ref(0)
const showThinkingProgress = ref(true)
const chatContainer = ref<HTMLElement | null>(null)

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()

const isAnswerVisible = (index: number) => {
  return answerVisibilityStates.value[index] !== false
}

const toggleAnswerVisibility = (index: number) => {
  answerVisibilityStates.value[index] = !answerVisibilityStates.value[index]
}

const toggleThinking = (_index: number) => {
  thinkingPanelVisible.value = !thinkingPanelVisible.value
  if (thinkingPanelVisible.value) {
    simulateThinking()
  }
}

let progressInterval: ReturnType<typeof setInterval> | null = null
let textInterval: ReturnType<typeof setInterval> | null = null

const simulateThinking = () => {
  thinkingProgress.value = 0
  displayedThinkingContent.value = ''

  progressInterval = setInterval(() => {
    thinkingProgress.value += Math.random() * 10
    if (thinkingProgress.value >= 100) {
      thinkingProgress.value = 100
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
    }
  }, 200)

  const thinkingText = `${t('n8nAssistant.thinkingText1')}\n${t('n8nAssistant.thinkingText2')}\n${t('n8nAssistant.thinkingText3')}`
  let charIndex = 0

  textInterval = setInterval(() => {
    if (charIndex < thinkingText.length) {
      displayedThinkingContent.value += thinkingText[charIndex]
      charIndex++
    } else {
      if (textInterval) {
        clearInterval(textInterval)
        textInterval = null
      }
    }
  }, 50)
}

cleanup.add(() => {
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  if (textInterval) {
    clearInterval(textInterval)
    textInterval = null
  }
})

const formatContent = (content: string) => {
  if (!content) return ''
  // 安全处理：先转义 HTML，再替换换行符
  const escaped = escapeHtml(content)
  return escaped.replace(/\n/g, '<br>')
}

const formatTokens = (tokens: number) => {
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K'
  }
  return tokens.toString()
}

const tishiHandle = () => {
  tishiShow.value = !tishiShow.value
}

const handleBack = () => {
  window.history.go(-1)
}

const copyToInput = (text: string) => {
  prompt.value = text
}

const handleQuickActionClick = (question: string) => {
  prompt.value = question
  handleSendMessage()
}

const handleSendMessage = async () => {
  if (!prompt.value.trim()) return

  if (!isMockEnabled()) {
    ElMessage.warning(t('n8nAssistant.mockNotAvailable'))
    return
  }

  const userQuestion = prompt.value
  questionList.value.push({
    question: userQuestion,
    imgsList: [],
  })

  prompt.value = ''

  await executeApi(async () => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockResponse = {
      content: `${t('n8nAssistant.mockResponsePrefix', { question: userQuestion })}${t('n8nAssistant.mockResponseContent')}`,
      imgUrlList: [],
      audioUrlList: [],
      videoUrlList: [],
      total_tokens: Math.floor(Math.random() * 500) + 100,
      copyContent: t('n8nAssistant.mockResponseCopy', { question: userQuestion }),
      isHaveSikao: true,
    }

    agentContentList.value.push(mockResponse)
    answerVisibilityStates.value[questionList.value.length - 1] = true

    await nextTick()
    scrollToBottom()

    return {
      code: 200,
      success: true,
      message: 'success',
      data: mockResponse,
      timestamp: Date.now(),
    }
  })
}

const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const copyContent = (content: string) => {
  navigator.clipboard.writeText(content).then(() => {
    ElMessage.success(t('n8nAssistant.copySuccess'))
  }).catch(() => { ElMessage.error(t('common.copyFailed')) })
}

const downloadImages = (index: number) => {
  const images = agentContentList.value[index].imgUrlList || []
  images.forEach((url: string, imgIndex: number) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `image-${index}-${imgIndex}.png`
    link.click()
  })
  ElMessage.success(t('n8nAssistant.downloadSuccess'))
}

const shareMessage = (index: number) => {
  const shareData = {
    title: questionList.value[index].question,
    text: agentContentList.value[index].content,
  }

  if (navigator.share) {
    navigator.share(shareData).catch(() => {
      ElMessage.info(t('n8nAssistant.shareNotSupported'))
    })
  } else {
    ElMessage.info(t('n8nAssistant.shareNotSupported'))
  }
}

const handleImageUpload = () => {
  ElMessage.info(t('n8nAssistant.imageUploadNotImplemented'))
}

const handleVoiceInput = () => {
  ElMessage.info(t('n8nAssistant.voiceInputNotImplemented'))
}

onMounted(() => {
  suggestedQuestionsList.value = [
    t('n8nAssistant.suggestedQuestion1'),
    t('n8nAssistant.suggestedQuestion2'),
    t('n8nAssistant.suggestedQuestion3'),
    t('n8nAssistant.suggestedQuestion4'),
  ]
})
</script>

<style scoped lang="scss">
@use "sass:math";

// ============================================
// HIGH-TECH INDUSTRIAL DESIGN SYSTEM
// ============================================

// Design Tokens
$brand-primary: var(--el-bg-color-page);
$brand-secondary: var(--el-fill-color-darker);
$accent-cyan: var(--el-color-primary);
$accent-blue: var(--el-color-primary-light-3);
$accent-purple: var(--el-color-primary-light-5);
$surface-dark: var(--el-bg-color-page);
$surface-medium: var(--el-fill-color-darker);
$surface-light: var(--el-fill-color-dark);
$text-primary: var(--el-text-color-primary);
$text-secondary: var(--el-text-color-regular);
$text-muted: var(--el-text-color-placeholder);
$border-subtle: var(--border-unified-color);
$border-accent: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
$glow-cyan: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
$glow-blue: color-mix(in srgb, var(--el-color-primary) 30%, transparent);

// Glass Morphism Mixin
@mixin glass-effect($opacity: 0.6, $blur: 20px) {
  background: color-mix(in srgb, var(--el-bg-color) calc($opacity * 100%), transparent);
  backdrop-filter: blur($blur);
  -webkit-backdrop-filter: blur($blur);
  border: var(--unified-border);
}

@mixin glass-effect-dark($opacity: 0.8, $blur: 24px) {
  background: color-mix(in srgb, var(--el-bg-color) calc($opacity * 100%), transparent);
  backdrop-filter: blur($blur);
  -webkit-backdrop-filter: blur($blur);
  border: var(--unified-border);
}

// Glow Effect Mixin
@mixin glow-effect($color: $accent-cyan, $intensity: 0.3) {
  box-shadow: var(--global-box-shadow);
}

// ============================================
// MAIN CONTAINER
// ============================================
.n8n-assistant-page {
  min-height: 100vh;
  background: $surface-dark;
  padding-bottom: 140px;
  position: relative;
  overflow-x: hidden;
}

// ============================================
// DEEP BACKGROUND SYSTEM
// ============================================
.cyber-background {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  overflow: hidden;

  .glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(80px);
    opacity: 0.4;
    animation: orbFloat 20s ease-in-out infinite;

    &--1 {
      width: 400px;
      height: 400px;
      background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
      top: -100px;
      right: -100px;
      animation-delay: 0s;
    }

    &--2 {
      width: 300px;
      height: 300px;
      background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
      bottom: 20%;
      left: -50px;
      animation-delay: -7s;
    }

    &--3 {
      width: 250px;
      height: 250px;
      background: var(--color-violet-glow);
      top: 40%;
      right: 10%;
      animation-delay: -14s;
    }
  }

}

@keyframes orbFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -20px) scale(1.05); }
  50% { transform: translate(-20px, 30px) scale(0.95); }
  75% { transform: translate(-30px, -10px) scale(1.02); }
}

// ============================================
// GLASS CARD VARIANTS
// ============================================
.glass-card {
  @include glass-effect;

  border-radius: var(--global-border-radius);
  position: relative;
  z-index: var(--z-base);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: var(--color-white-5);
    -webkit-mask: linear-gradient(var(--el-bg-color) 0 0) content-box, linear-gradient(var(--el-bg-color) 0 0);
    mask: linear-gradient(var(--el-bg-color) 0 0) content-box, linear-gradient(var(--el-bg-color) 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  &:hover {
    border-color: $border-accent;
    transform: translateY(-2px);
  }
}

.glass-card-dark {
  @include glass-effect-dark;

  border-radius: var(--global-border-radius);
  position: relative;
  z-index: var(--z-base);

  .card-border-glow {
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: $accent-cyan;
    opacity: 0.15;
    z-index: -1;
    filter: blur(8px);
  }
}

.glass-card-accent {
  @include glass-effect(0.7, 16px);

  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  border-color: $border-accent;
  border-radius: var(--global-border-radius);
  position: relative;

  .message-glow {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--color-cyan-glow);
    pointer-events: none;
  }
}

// ============================================
// RIPPLE EFFECT
// ============================================
.ripple-btn {
  position: relative;
  overflow: hidden;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 50%;
    left: 50%;
    pointer-events: none;
    background-image: radial-gradient(circle, $accent-cyan 10%, transparent 10.01%);
    background-repeat: no-repeat;
    background-position: 50%;
    transform: translate(-50%, -50%) scale(10);
    opacity: 0;
    transition: transform 0.5s, opacity 0.5s;
  }

  &:active::after {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0.3;
    transition: 0s;
  }
}

// ============================================
// SCROLL REVEAL ANIMATION
// ============================================
.scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  animation: scrollReveal 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes scrollReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// PAGE HEADER
// ============================================
.page-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  margin: 0 20px;
  margin-top: 20px;
  position: sticky;
  top: 20px;
  z-index: var(--z-header);

  .back-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: transparent;
    color: $text-primary;
    transition: all 0.3s;

    &:hover {
      border-color: $accent-cyan;
      color: $accent-cyan;

      @include glow-effect($accent-cyan, 0.2);
    }

    .el-icon {
      font-size: 18px;
    }
  }

  .page-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;

    .title-glow {
      color: $text-primary;
    }
  }

  .header-accent {
    margin-left: auto;
    width: 8px;
    height: 8px;
    border-radius: var(--global-border-radius);
    background: $accent-cyan;
    box-shadow: var(--global-box-shadow);
    animation: pulse 2s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

// ============================================
// GUIDE TOGGLE
// ============================================
.tishi-block {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  margin: 16px 20px;
  cursor: pointer;

  .tishi-icon-wrapper {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--global-border-radius);
    background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
    border: var(--unified-border);
    transition: all 0.3s;

    .tishi-icon {
      color: $accent-cyan;
      font-size: 16px;
    }
  }

  &:hover .tishi-icon-wrapper {
    @include glow-effect($accent-cyan, 0.3);
  }

  .tishi-text {
    margin-left: 12px;
    font-size: 14px;
    font-weight: 500;
    color: $text-secondary;
    transition: color 0.3s;
  }

  &:hover .tishi-text {
    color: $text-primary;
  }

  .tishi-indicator {
    margin-left: auto;
    width: 6px;
    height: 6px;
    border-radius: var(--global-border-radius);
    background: $text-muted;
    transition: all 0.3s;

    &.active {
      background: $accent-cyan;
      box-shadow: var(--global-box-shadow);
    }
  }
}

// ============================================
// GUIDE CONTENT
// ============================================
.intelligent-assistant {
  margin: 0 20px 16px;
  padding: 20px 24px;
  animation-delay: 0.1s;

  .guide-title {
    display: flex;
    align-items: center;
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;
    letter-spacing: -0.01em;

    .title-accent {
      width: 3px;
      height: 16px;
      background: $accent-cyan;
      border-radius: var(--global-border-radius);
      margin-right: 12px;
    }
  }

  .guide-list {
    margin: 0;
    padding: 0;
    list-style: none;

    .guide-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
      padding: 12px 16px;
      border-radius: var(--global-border-radius);
      background: var(--color-white-2);
      border: var(--unified-border);
      transition: all 0.3s;

      &:last-child {
        margin-bottom: 0;
      }

      &:hover {
        background: var(--color-cyan-00d4ff-05);
        border-color: $border-accent;
      }

      .item-marker {
        width: 6px;
        height: 6px;
        border-radius: var(--global-border-radius);
        background: $accent-cyan;
        margin-right: 12px;
        margin-top: 6px;
        flex-shrink: 0;
        box-shadow: var(--global-box-shadow);
      }

      .item-text {
        font-size: 14px;
        color: $text-secondary;
        line-height: 1.6;
      }
    }
  }
}

// ============================================
// TISHI BOX
// ============================================
.tishi-box {
  margin: 0 20px 16px;
  padding: 20px 24px;
  animation-delay: 0.2s;

  .tishi-title {
    display: flex;
    align-items: center;
    margin-bottom: 16px;

    .title-icon-wrapper {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--global-border-radius);
      background: $accent-cyan;
      color: $surface-dark;
      font-size: 14px;
    }

    .tishi-title-text {
      margin-left: 12px;
      font-size: 16px;
      font-weight: 600;
      color: $text-primary;
    }
  }

  .tishi-content {
    font-size: 14px;
    color: $text-secondary;
    line-height: 1.8;
  }
}

// ============================================
// CHAT CONTAINER
// ============================================
.chat-container {
  margin: 0 20px;
  min-height: 400px;
  padding: 24px;
  overflow-y: auto;
  max-height: calc(100vh - 420px);

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-white-10);
    border-radius: var(--global-border-radius);

    &:hover {
      background: var(--color-white-20);
    }
  }
}

// ============================================
// WELCOME MESSAGE
// ============================================
.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  position: relative;

  .welcome-avatar {
    width: 100px;
    height: 100px;
    margin-bottom: 24px;
    border-radius: var(--global-border-radius);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    .avatar-ring {
      position: absolute;
      inset: -8px;
      border-radius: var(--global-border-radius);
      border: 2px solid $accent-cyan;
      opacity: 0.3;
      animation: ringPulse 3s ease-in-out infinite;

      &--2 {
        inset: -16px;
        border-color: $accent-blue;
        animation-delay: -1.5s;
      }
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: var(--global-border-radius);
      border: 2px solid $border-accent;
    }
  }

  .welcome-text {
    font-size: 18px;
    font-weight: 500;
    color: $text-secondary;
    max-width: 300px;
  }

  .welcome-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;

    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: var(--global-border-radius);
      background: $accent-cyan;
      opacity: 0.4;
      animation: particleFloat 6s ease-in-out infinite;

      @for $i from 1 through 6 {
        &:nth-child(#{$i}) {
          left: math.random(100) * 1%;
          top: math.random(100) * 1%;
          animation-delay: -#{$i * 0.8}s;
          animation-duration: #{4 + math.random(4)}s;
        }
      }
    }
  }
}

@keyframes ringPulse {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.1); opacity: 0.1; }
}

@keyframes particleFloat {
  0%, 100% { transform: translate(0, 0); opacity: 0.4; }
  50% { transform: translate(#{math.random(40) - 20}px, #{math.random(40) - 20}px); opacity: 0.1; }
}

// ============================================
// MESSAGE GROUP
// ============================================
.message-group {
  margin-bottom: 28px;
  animation-delay: 0.1s;

  &:last-child {
    margin-bottom: 0;
  }
}

.question-images {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;

  .question-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      transform: scale(1.05);
      border-color: $accent-cyan;

      @include glow-effect($accent-cyan, 0.2);
    }
  }
}

.question-container {
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  margin-bottom: 16px;

  .question-actions {
    margin-right: 10px;
  }

  .question-text {
    max-width: 80%;
    padding: 14px 18px;
    color: $text-primary;
    border-radius: var(--global-border-radius);
    font-size: 14px;
    line-height: 1.7;
    word-wrap: break-word;
  }
}

// ============================================
// ANSWER CONTAINER
// ============================================
.answer-container {
  padding: 20px;
  margin-bottom: 14px;

  .answer-content {
    margin-bottom: 16px;
    font-size: 14px;
    color: $text-secondary;
    line-height: 1.9;
    word-wrap: break-word;

    :deep(code) {
      background: var(--color-cyan-glow);
      padding: 2px 6px;
      border-radius: var(--global-border-radius);
      font-family: var(--font-family-mono);
      font-size: 13px;
      color: $accent-cyan;
    }
  }

  .answer-media {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 16px;

    .answer-image {
      width: 100%;
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        border-color: $accent-cyan;
      }
    }

    .answer-audio {
      width: 100%;
      border-radius: var(--global-border-radius);
      filter: invert(1) hue-rotate(180deg);
    }

    .answer-video {
      width: 100%;
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
    }
  }

  .answer-meta {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    padding: 10px 14px;
    background: var(--color-cyan-00d4ff-05);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);

    .token-consumption {
      display: flex;
      align-items: center;
      font-size: 12px;
      color: $text-muted;
      font-family: var(--font-family-mono);

      .token-icon {
        width: 6px;
        height: 6px;
        border-radius: var(--global-border-radius);
        background: $accent-cyan;
        margin-right: 8px;
        box-shadow: var(--global-box-shadow);
      }

      .token-value {
        margin-left: 4px;
        color: $accent-cyan;
      }
    }
  }

  .answer-actions {
    display: flex;
    gap: 8px;
    padding-top: 16px;
    border-top: var(--unified-border);
  }
}

// ============================================
// ACTION BUTTONS
// ============================================
.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: transparent;
  color: $text-muted;
  transition: all 0.3s;

  &:hover {
    border-color: $accent-cyan;
    color: $accent-cyan;
    background: var(--color-cyan-glow);
  }

  .el-icon {
    font-size: 16px;
  }
}

// ============================================
// LOADING MESSAGE
// ============================================
.loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;

  .cyber-loader {
    width: 60px;
    height: 60px;
    position: relative;
    margin-bottom: 20px;

    .loader-ring {
      position: absolute;
      inset: 0;
      border: 2px solid transparent;
      border-top-color: $accent-cyan;
      border-radius: var(--global-border-radius);
      animation: loaderSpin 1.2s linear infinite;

      &--2 {
        inset: 8px;
        border-top-color: $accent-blue;
        animation-direction: reverse;
        animation-duration: 0.8s;
      }
    }

    .loader-core {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 12px;
      height: 12px;
      border-radius: var(--global-border-radius);
      background: $accent-cyan;
      box-shadow: var(--global-box-shadow);
      animation: loaderPulse 1s ease-in-out infinite;
    }
  }

  .loading-text {
    font-size: 14px;
    color: $text-muted;
    letter-spacing: 0.05em;
  }
}

@keyframes loaderSpin {
  to { transform: rotate(360deg); }
}

@keyframes loaderPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
}

// ============================================
// QUICK ACTIONS
// ============================================
.quick-actions {
  margin: 16px 20px;
  padding: 18px 20px;

  .quick-actions-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 8px;

    &::-webkit-scrollbar {
      height: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--color-white-10);
      border-radius: var(--global-border-radius);
    }
  }

  .quick-action-btn {
    flex-shrink: 0;
    padding: 12px 20px;
    background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 500;
    color: $text-primary;
    white-space: nowrap;
    position: relative;
    transition: all 0.3s;

    // 扫光效果已移至全局样式 (styles/index.scss)

    &:hover {
      transform: translateY(-3px);
      border-color: $accent-cyan;

      @include glow-effect($accent-cyan, 0.25);
    }
  }
}

// ============================================
// THINKING PANEL
// ============================================
.thinking-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 85%;
  max-width: 500px;
  max-height: 60vh;
  padding: 24px;
  z-index: var(--z-dropdown);
  overflow-y: auto;

  .panel-border-glow {
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: $accent-cyan;
    opacity: 0.2;
    z-index: -1;
    filter: blur(12px);
  }

  .thinking-panel-header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;

    .thinking-icon-wrapper {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--global-border-radius);
      background: $accent-cyan;
      color: $surface-dark;
    }

    .thinking-title {
      margin-left: 12px;
      font-size: 16px;
      font-weight: 600;
      color: $text-primary;
    }

    .loader-container {
      display: flex;
      gap: 6px;
      margin-left: auto;

      .loader-dot {
        width: 8px;
        height: 8px;
        background: $accent-cyan;
        border-radius: var(--global-border-radius);
        animation: bounce 1.4s infinite ease-in-out both;
        box-shadow: var(--global-box-shadow);

        &:nth-child(1) { animation-delay: -0.32s; }
        &:nth-child(2) { animation-delay: -0.16s; }
        &:nth-child(3) { animation-delay: -0.08s; }
      }
    }
  }

  .thinking-progress-container {
    position: relative;
    height: 28px;
    background: var(--color-white-5);
    border-radius: var(--global-border-radius);
    margin-bottom: 20px;
    overflow: hidden;
    border: var(--unified-border);

    .thinking-progress-bar {
      height: 100%;
      background: $accent-cyan;
      border-radius: var(--global-border-radius);
      transition: width 0.3s;
      position: relative;

      .progress-glow {
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 30px;
        height: 100%;
        background: var(--color-white-30);
        animation: progressShine 1.5s ease-in-out infinite;
      }
    }

    .thinking-progress-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px;
      font-weight: 600;
      color: $text-primary;
      font-family: var(--font-family-mono);
    }
  }

  .thinking-content {
    font-size: 14px;
    color: $text-secondary;
    line-height: 1.9;
    white-space: pre-wrap;

    .thinking-tip {
      color: $accent-cyan;
      font-style: italic;
    }
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes progressShine {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

// ============================================
// INPUT SECTION
// ============================================
.input-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px 24px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0));
  z-index: var(--z-header);
  border-radius: var(--global-border-radius);
  border-bottom: none;

  .input-glow-line {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 1px;
    background: $accent-cyan;
  }

  .model-selector {
    margin-bottom: 14px;

    .cyber-select {
      width: 100%;

      :deep(.el-input__wrapper) {
        background: var(--color-white-3);
        border: var(--unified-border);
        border-radius: var(--global-border-radius);
        box-shadow: none;
        transition: all 0.3s;

        &:hover,
        &.is-focus {
          border-color: $accent-cyan;
          box-shadow: var(--global-box-shadow);
        }

        .el-input__inner {
          color: $text-primary;
          font-size: 14px;

          &::placeholder {
            color: $text-muted;
          }
        }

        .el-input__suffix {
          color: $text-muted;
        }
      }
    }
  }

  .input-wrapper {
    display: flex;
    gap: 12px;
    align-items: flex-end;

    .input-container {
      flex: 1;
      position: relative;

      .cyber-input {
        :deep(.el-textarea__inner) {
          background: var(--color-white-3);
          border: var(--unified-border);
          border-radius: var(--global-border-radius);
          color: $text-primary;
          font-size: 14px;
          padding: 14px 16px;
          resize: none;
          transition: all 0.3s;

          &::placeholder {
            color: $text-muted;
          }

          &:focus {
            border-color: $accent-cyan;
            box-shadow: var(--global-box-shadow);
          }
        }
      }

      .input-border-glow {
        position: absolute;
        inset: -2px;
        border-radius: var(--global-border-radius);
        background: $accent-cyan;
        opacity: 0;
        z-index: -1;
        filter: blur(8px);
        transition: opacity 0.3s;

        &.active {
          opacity: 0.2;
        }
      }
    }

    .input-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
  }

  .send-btn {
    height: 44px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: $accent-cyan;
    border: none;
    border-radius: var(--global-border-radius);
    color: $surface-dark;
    font-size: 14px;
    font-weight: 600;
    position: relative;
    transition: all 0.3s;

    // 扫光效果已移至全局样式 (styles/index.scss)

    &:hover:not(:disabled) {
      transform: translateY(-2px);

      @include glow-effect($accent-cyan, 0.4);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.loading {
      opacity: 0.7;
    }
  }
}

// ============================================
// TRANSITIONS
// ============================================
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}

// ============================================
// RESPONSIVE
// ============================================
@media (width <= 768px) {
  .page-header {
    margin: 16px;
    padding: 14px 18px;

    .page-title {
      font-size: 18px;
    }
  }

  .tishi-block,
  .intelligent-assistant,
  .tishi-box,
  .chat-container,
  .quick-actions {
    margin-left: 16px;
    margin-right: 16px;
  }

  .thinking-panel {
    width: 92%;
  }

  .input-section {
    padding: 16px 18px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
  }

  .question-container .question-text {
    max-width: 90%;
  }
}

// ============================================
// ELEMENT PLUS OVERRIDES
// ============================================
:deep(.el-select-dropdown) {
  background: $surface-medium ;
  border: var(--unified-border);
  border-radius: var(--global-border-radius) ;

  .el-select-dropdown__item {
    color: $text-secondary;

    &:hover {
      background: var(--color-cyan-glow);
      color: $text-primary;
    }

    &.selected {
      color: $accent-cyan;
      background: var(--color-cyan-00d4ff-15);
    }
  }
}

:deep(.el-image-viewer__wrapper) {
  background: var(--color-black-95);
}
</style>
