<template>
  <div class="video-gen-kling">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('videoGen.kling.title') }}</span>
          <el-tag type="warning" size="small">{{ t('videoGen.kling.tag') }}</el-tag>
        </div>
      </template>
      <el-alert
        :title="t('videoGen.kling.instructions.title')"
        :description="t('videoGen.kling.instructions.description')"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      />
      <el-steps :active="step" finish-status="success" align-center style="margin-bottom: 24px">
        <el-step :title="t('videoGen.kling.steps.upload')" />
        <el-step :title="t('videoGen.kling.steps.identify')" />
        <el-step :title="t('videoGen.kling.steps.generate')" />
      </el-steps>

      <el-form :model="form" ref="formRef" label-width="120px">
        <el-form-item v-if="step === 0" :label="t('videoGen.kling.form.uploadVideo')">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept="video/*"
            :on-change="handleVideoUpload"
          >
            <el-button>{{ t('videoGen.kling.form.selectVideo') }}</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item v-if="step === 1" :label="t('videoGen.kling.form.selectFace')">
          <el-select v-model="form.face_id" :placeholder="t('videoGen.kling.form.selectFaceId')">
            <el-option
              v-for="face in faces"
              :key="face.face_id"
              :label="`Face ${face.face_id} (${face.time_range[0]}-${face.time_range[1]}s)`"
              :value="face.face_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="step >= 1" :label="t('videoGen.kling.form.prompt')" prop="prompt">
          <el-input v-model="form.prompt" type="textarea" :rows="4" :placeholder="t('videoGen.kling.form.promptPlaceholder')" />
        </el-form-item>

        <el-form-item>
          <el-button
            v-if="step === 0"
            type="primary"
            :loading="identifying"
            @click="handleIdentify"
          >
            {{ t('videoGen.kling.buttons.identify') }}
          </el-button>
          <el-button v-if="step === 1" type="primary" :loading="generating" @click="handleGenerate">
            {{ t('videoGen.kling.buttons.generate') }}
          </el-button>
          <el-button @click="step = 0">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <div v-if="taskId" class="task-info">
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
            {{ autoPolling ? t('videoGen.kling.stopPolling') || '停止轮询' : t('videoGen.kling.startPolling') || '自动轮询' }}
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
              {{ t('videoGen.kling.downloadVideo') || '下载视频' }}
            </el-button>
            <el-button type="primary" size="small" @click="previewVideo(videoStatus.result.video_url)" style="margin-left: 8px;">
              <el-icon><VideoPlay /></el-icon>
              {{ t('videoGen.kling.previewVideo') || '预览视频' }}
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onUnmounted, watch, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { identifyKlingVideo, createKlingVideo, getOneClickVideoStatus } from '@/api/services/aiGeneration.service'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, VideoPlay } from '@element-plus/icons-vue'
import { logger } from '@/utils/logger'
import type { UploadFile, FormInstance } from 'element-plus'

const { t } = useI18n()

const props = defineProps<{ userUuid: string }>()
const formRef = ref<FormInstance | null>(null)
const step = ref(0)
const identifying = ref(false)
const generating = ref(false)
const videoUrl = ref('')
const faces = ref<Array<{ face_id: string; time_range: [number, number] }>>([])
const taskId = ref('')
const checkingStatus = ref(false)
const videoStatus = ref<{ status: string; message: string; result?: Record<string, unknown> } | null>(null)
const autoPolling = ref(false)
let pollingTimer: number | null = null

const form = reactive({ prompt: '', face_id: '' })

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
      return t('videoGen.kling.status.completed') || '已完成'
    case 'processing':
    case 'generating':
      return t('videoGen.kling.status.processing') || '处理中'
    case 'failed':
    case 'error':
      return t('videoGen.kling.status.failed') || '失败'
    case 'pending':
    case 'waiting':
      return t('videoGen.kling.status.pending') || '等待中'
    default:
      return status
  }
}

const handleVideoUpload = async (file: UploadFile) => {
  if (file.raw) {
    const formData = new FormData()
    formData.append('file', file.raw)
    // 上传视频逻辑
    videoUrl.value = 'uploaded_url'
  }
}

const handleIdentify = async () => {
  if (!videoUrl.value) {
    ElMessage.warning(t('videoGen.kling.messages.uploadFirst'))
    return
  }
  identifying.value = true
  try {
    const response = await identifyKlingVideo({
      user_uuid: props.userUuid,
      video_url: videoUrl.value,
    })
    if (response.success && response.data?.face_data) {
      faces.value = response.data.face_data
      step.value = 1
      ElMessage.success(t('videoGen.kling.messages.identifySuccess'))
    }
  } catch (error) {
    logger.error('Video face identification failed:', error)
    ElMessage.error(t('videoGen.kling.messages.identifyFailed'))
  } finally {
    identifying.value = false
  }
}

const handleGenerate = async () => {
  if (!form.prompt || !form.face_id) {
    ElMessage.warning(t('videoGen.kling.messages.fillComplete'))
    return
  }
  generating.value = true
  try {
    const response = await createKlingVideo({
      user_uuid: props.userUuid,
      video_url: videoUrl.value,
      face_id: form.face_id,
      prompt: form.prompt,
    })
    if (response.success && response.data?.task_id) {
      taskId.value = response.data.task_id
      videoStatus.value = null
      step.value = 2
      ElMessage.success(t('videoGen.kling.messages.taskSubmitted'))
      // 自动开始轮询
      startAutoPoll()
    }
  } catch (error) {
    logger.error('Kling video generation failed:', error)
    ElMessage.error(t('videoGen.kling.messages.generateFailed'))
  } finally {
    generating.value = false
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
      ElMessage.warning(t('videoGen.kling.messages.pollTimeout') || '状态查询超时，请手动刷新')
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
    ElMessage.warning(t('videoGen.kling.videoUrlEmpty') || '视频URL为空')
    return
  }
  const link = document.createElement('a')
  link.href = videoUrl
  link.download = `video_${taskId.value}.mp4`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success(t('videoGen.kling.downloadStarted') || '开始下载视频')
}

// 预览视频
const previewVideo = (videoUrl: string) => {
  if (!videoUrl) {
    ElMessage.warning(t('videoGen.kling.videoUrlEmpty') || '视频URL为空')
    return
  }
  ElMessageBox({
    title: t('videoGen.kling.previewVideo') || '预览视频',
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
