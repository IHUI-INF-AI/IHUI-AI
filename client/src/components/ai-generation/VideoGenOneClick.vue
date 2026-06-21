<template>
  <div class="video-gen-one-click">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('videoGen.oneClick.title') }}</span>
          <el-tag type="success" size="small">{{ t('videoGen.oneClick.tag') }}</el-tag>
        </div>
      </template>
      <el-form :model="form" ref="formRef" label-width="120px">
        <el-form-item :label="t('videoGen.oneClick.form.topic')" prop="topic">
          <el-input v-model="form.topic" :placeholder="t('videoGen.oneClick.form.topicPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('videoGen.oneClick.form.duration')">
          <el-input-number v-model="form.video_duration" :min="5" :max="60" />
          {{ t('videoGen.oneClick.durationUnit') }}
        </el-form-item>
        <el-form-item :label="t('videoGen.oneClick.form.ratio')">
          <el-select v-model="form.video_ratio">
            <el-option :label="t('videoGen.oneClick.ratios.r169')" value="16:9" />
            <el-option :label="t('videoGen.oneClick.ratios.r916')" value="9:16" />
            <el-option :label="t('videoGen.oneClick.ratios.r11')" value="1:1" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('videoGen.oneClick.form.audioStyle')">
          <el-input v-model="form.audio_prompt" :placeholder="t('videoGen.oneClick.form.audioPlaceholder')" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleGenerate">{{ t('videoGen.oneClick.buttons.generate') }}</el-button>
        </el-form-item>
      </el-form>
      <div v-if="taskId" class="task-status">
        <el-alert :title="t('videoGen.kling.messages.taskId', { taskId })" type="info" />
        <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
          <el-button 
            @click="checkStatus" 
            :loading="checkingStatus"
            type="primary"
          >
            {{ checkingStatus ? t('videoGen.kling.buttons.checking') || '查询中...' : t('videoGen.kling.buttons.checkStatus') }}
          </el-button>
          <el-button 
            v-if="videoStatus && (videoStatus.status === 'processing' || videoStatus.status === 'generating' || videoStatus.status === 'pending')"
            @click="toggleAutoPoll"
            :type="autoPolling ? 'warning' : 'default'"
          >
            {{ autoPolling ? t('videoGen.oneClick.stopPolling') || '停止轮询' : t('videoGen.oneClick.startPolling') || '自动轮询' }}
          </el-button>
        </div>
        <div v-if="videoStatus" style="margin-top: 12px; padding: 12px; background: var(--el-fill-color-lighter); border-radius: var(--global-border-radius);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <strong>{{ t('videoGen.kling.status.title') || '状态' }}:</strong>
            <el-tag :type="getStatusTagType(videoStatus.status)" size="small">
              {{ getStatusLabel(videoStatus.status) }}
            </el-tag>
          </div>
          <div v-if="videoStatus.message" style="margin-top: 8px;">
            <strong>{{ t('videoGen.kling.message') || '消息' }}:</strong> {{ videoStatus.message }}
          </div>
          <div v-if="videoStatus.result && videoStatus.result.video_url" style="margin-top: 12px;">
            <el-button type="success" size="small" @click="downloadVideo(videoStatus.result.video_url)">
              <el-icon><Download /></el-icon>
              {{ t('videoGen.oneClick.downloadVideo') || '下载视频' }}
            </el-button>
            <el-button type="primary" size="small" @click="previewVideo(videoStatus.result.video_url)" style="margin-left: 8px;">
              <el-icon><VideoPlay /></el-icon>
              {{ t('videoGen.oneClick.previewVideo') || '预览视频' }}
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { startOneClickVideo, getOneClickVideoStatus } from '@/api/services/aiGeneration.service'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, VideoPlay } from '@element-plus/icons-vue'
import { h } from 'vue'
import type { FormInstance } from 'element-plus'
import { logger } from '@/utils/logger'

const { t } = useI18n()

const props = defineProps<{ userUuid: string }>()
const formRef = ref<FormInstance | null>(null)
const loading = ref(false)
const checkingStatus = ref(false)
const taskId = ref('')
const videoStatus = ref<{ status: string; message: string; result?: Record<string, unknown> } | null>(null)
const autoPolling = ref(false)
let pollingTimer: number | null = null

const form = reactive({
  topic: '',
  video_duration: 15,
  video_ratio: '16:9',
  audio_prompt: '',
})

// 获取状态标签类型
const getStatusTagType = (status: string) => {
  const statusLower = status.toLowerCase()
  if (statusLower === 'completed' || statusLower === 'success') {
    return 'success'
  } else if (statusLower === 'processing' || statusLower === 'generating') {
    return 'warning'
  } else if (statusLower === 'failed' || statusLower === 'error') {
    return 'danger'
  } else if (statusLower === 'pending' || statusLower === 'waiting') {
    return 'info'
  }
  return ''
}

// 获取状态标签文本
const getStatusLabel = (status: string) => {
  const statusLower = status.toLowerCase()
  switch (statusLower) {
    case 'completed':
    case 'success':
      return t('videoGen.oneClick.status.completed') || '已完成'
    case 'processing':
    case 'generating':
      return t('videoGen.oneClick.status.processing') || '处理中'
    case 'failed':
    case 'error':
      return t('videoGen.oneClick.status.failed') || '失败'
    case 'pending':
    case 'waiting':
      return t('videoGen.oneClick.status.pending') || '等待中'
    default:
      return status
  }
}

const handleGenerate = async () => {
  if (!form.topic) {
    ElMessage.warning(t('videoGen.oneClick.messages.topicRequired'))
    return
  }
  loading.value = true
  try {
    const response = await startOneClickVideo({
      topic: form.topic,
      video_duration: form.video_duration,
      video_ratio: form.video_ratio,
      audio_prompt: form.audio_prompt || undefined,
      user_uuid: props.userUuid,
    })
    if (response.success && response.data?.task_id) {
      taskId.value = response.data.task_id
      videoStatus.value = null
      ElMessage.success(t('videoGen.kling.messages.taskSubmitted'))
      // 自动开始轮询
      startAutoPoll()
    } else {
      ElMessage.error(response.message || t('videoGen.qwen.messages.generateFailed'))
    }
  } catch (error) {
    logger.error('Video generation failed:', error)
    ElMessage.error(t('videoGen.qwen.messages.generateFailed'))
  } finally {
    loading.value = false
  }
}

const checkStatus = async () => {
  if (!taskId.value) {
    ElMessage.warning(t('videoGen.kling.messages.taskIdRequired') || '请先提交生成任务')
    return
  }

  try {
    checkingStatus.value = true
    const response = await getOneClickVideoStatus(taskId.value)

    if (response.success || response.code === 200) {
      videoStatus.value = response.data || null
      const status = response.data?.status || 'unknown'
      const message = response.data?.message || ''

      // 根据状态显示不同消息
      switch (status.toLowerCase()) {
        case 'completed':
        case 'success':
          ElMessage.success(message || t('videoGen.kling.messages.statusCompleted') || '视频生成完成')
          stopAutoPoll() // 完成后停止轮询
          if (response.data?.result) {
            logger.info('Video generation result:', response.data.result)
          }
          break
        case 'processing':
        case 'generating':
          // 处理中时不显示消息，避免频繁提示
          break
        case 'failed':
        case 'error':
          ElMessage.error(message || t('videoGen.kling.messages.statusFailed') || '视频生成失败')
          stopAutoPoll() // 失败后停止轮询
          break
        case 'pending':
        case 'waiting':
          // 等待中时不显示消息
          break
        default:
          logger.info(`Task status: ${status}`)
      }
    } else {
      ElMessage.error(response.message || t('videoGen.kling.messages.checkStatusFailed') || '查询状态失败')
    }
  } catch (error) {
    logger.error('Video generation status query failed:', error)
    ElMessage.error(t('videoGen.kling.messages.checkStatusFailed') || '查询状态失败')
  } finally {
    checkingStatus.value = false
  }
}

// 轮询配置
const POLL_INTERVAL = 5000 // 初始轮询间隔（5秒）
const MAX_POLL_INTERVAL = 30000 // 最大轮询间隔（30秒）
const MAX_POLL_COUNT = 120 // 最大轮询次数（10分钟）
let pollCount = 0
let currentPollInterval = POLL_INTERVAL
let consecutiveErrors = 0

// 开始自动轮询（优化版：支持指数退避和最大次数限制）
const startAutoPoll = () => {
  if (pollingTimer) {
    return // 已经在轮询
  }
  autoPolling.value = true
  pollCount = 0
  consecutiveErrors = 0
  currentPollInterval = POLL_INTERVAL
  
  // 立即查询一次
  checkStatus()
  
  // 开始轮询
  const poll = () => {
    pollCount++
    
    // 检查是否超过最大轮询次数
    if (pollCount > MAX_POLL_COUNT) {
      logger.warn('Video status polling reached maximum count, auto stopped')
      ElMessage.warning(t('videoGen.oneClick.messages.pollTimeout') || '状态查询超时，请手动刷新')
      stopAutoPoll()
      return
    }
    
    // 执行状态查询
    checkStatus().then(() => {
      // 成功时重置错误计数和轮询间隔
      consecutiveErrors = 0
      currentPollInterval = POLL_INTERVAL
    }).catch(() => {
      // 失败时增加错误计数和轮询间隔（指数退避）
      consecutiveErrors++
      currentPollInterval = Math.min(
        POLL_INTERVAL * Math.pow(2, consecutiveErrors),
        MAX_POLL_INTERVAL
      )
      logger.warn(`Status query failed, next polling interval adjusted to ${currentPollInterval}ms`)
    })
    
    // 设置下次轮询
    if (pollingTimer) {
      pollingTimer = window.setTimeout(poll, currentPollInterval)
    }
  }
  
  // 开始轮询
  pollingTimer = window.setTimeout(poll, currentPollInterval)
}

// 停止自动轮询
const stopAutoPoll = () => {
  if (pollingTimer) {
    clearTimeout(pollingTimer)
    pollingTimer = null
  }
  autoPolling.value = false
  pollCount = 0
  consecutiveErrors = 0
  currentPollInterval = POLL_INTERVAL
}

// 切换自动轮询
const toggleAutoPoll = () => {
  if (autoPolling.value) {
    stopAutoPoll()
  } else {
    startAutoPoll()
  }
}

// 下载视频
const downloadVideo = (videoUrl: string) => {
  if (!videoUrl) {
    ElMessage.warning(t('videoGen.oneClick.videoUrlEmpty') || '视频URL为空')
    return
  }
  const link = document.createElement('a')
  link.href = videoUrl
  link.download = `video_${taskId.value}.mp4`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success(t('videoGen.oneClick.downloadStarted') || '开始下载视频')
}

// 预览视频
const previewVideo = (videoUrl: string) => {
  if (!videoUrl) {
    ElMessage.warning(t('videoGen.oneClick.videoUrlEmpty') || '视频URL为空')
    return
  }
  ElMessageBox({
    title: t('videoGen.oneClick.previewVideo') || '预览视频',
    message: h('video', {
      src: videoUrl,
      controls: true,
      style: { width: '100%', maxWidth: '800px' },
    }),
    showCancelButton: false,
    confirmButtonText: t('common.close') || '关闭',
  })
}

// 监听任务ID变化，自动开始轮询
watch(taskId, (newTaskId) => {
  if (newTaskId) {
    startAutoPoll()
  } else {
    stopAutoPoll()
  }
})

// 组件卸载时清理
onUnmounted(() => {
  stopAutoPoll()
})
</script>
