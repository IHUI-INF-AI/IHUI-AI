<template>
  <div class="video-gen-qwen">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('videoGen.qwen.title') }}</span>
          <el-tag type="primary" size="small">{{ t('videoGen.qwen.tag') }}</el-tag>
        </div>
      </template>
      <el-form :model="form" ref="formRef" label-width="120px">
        <el-form-item :label="t('videoGen.qwen.form.prompt')" prop="prompt">
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="4"
            :placeholder="t('videoGen.qwen.form.promptPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('videoGen.qwen.form.images')">
          <el-input v-model="form.images" :placeholder="t('videoGen.qwen.form.imagesPlaceholder')" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleGenerate">{{ t('videoGen.qwen.buttons.generate') }}</el-button>
        </el-form-item>
      </el-form>
      <div v-if="progress" class="progress">
        <el-progress :percentage="progress" :status="progressStatus" />
        <p>{{ progressText }}</p>
      </div>
      <div v-if="result" class="result">
        <el-alert :title="t('videoGen.qwen.messages.generateSuccess')" type="success" :closable="false" />
        <video
          v-if="result.video_url"
          :src="result.video_url"
          controls
          preload="none"
          style="max-width: 100%; margin-top: 16px"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { createDashScopeVideoWebSocket } from '@/api/services/aiGeneration.service'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'

const { t } = useI18n()
const cleanup = useCleanup()

const props = defineProps<{ userUuid: string }>()
const formRef = ref<FormInstance | null>(null)
const loading = ref(false)
const progress = ref(0)
const progressStatus = ref<'success' | 'exception' | 'warning' | undefined>(undefined)
const progressText = ref('')
const result = ref<{ video_url?: string } | null>(null)

const form = reactive({ prompt: '', images: '' })

// 组件级 WebSocket 引用，用于卸载时关闭
let activeWS: WebSocket | null = null
cleanup.add(() => activeWS?.close())

const handleGenerate = () => {
  if (!form.prompt) {
    ElMessage.warning(t('videoGen.qwen.messages.promptRequired'))
    return
  }
  loading.value = true
  progress.value = 0
  progressText.value = t('videoGen.qwen.progress.connecting')

  interface WebSocketMessage {
    event: 'video.progress' | 'video.completed' | 'error'
    data?: {
      progress?: number
      message?: string
      video_url?: string
    }
    error?: string
  }

  const _ws = createDashScopeVideoWebSocket(
    {
      prompt: form.prompt,
      images: form.images || undefined,
      user_uuid: props.userUuid,
    },
    (message: any) => {
      const msg = message as WebSocketMessage
      if (msg.event === 'video.progress') {
        progress.value = msg.data?.progress || 0
        progressText.value = msg.data?.message || t('videoGen.qwen.progress.generating')
      } else if (msg.event === 'video.completed') {
        progress.value = 100
        progressStatus.value = 'success'
        progressText.value = t('videoGen.qwen.messages.generateSuccess')
        result.value = { video_url: msg.data?.video_url }
        ElMessage.success(t('videoGen.qwen.messages.generateSuccess'))
        loading.value = false
      } else if (msg.event === 'error') {
        progressStatus.value = 'exception'
        progressText.value = msg.error || t('videoGen.qwen.messages.generateFailed')
        ElMessage.error(t('videoGen.qwen.messages.generateFailed'))
        loading.value = false
      }
    },
    () => {
      ElMessage.error(t('llmChatCenter.websocket.connectionFailed'))
      loading.value = false
    },
    () => {
      loading.value = false
    }
  )
  activeWS = _ws
}
</script>
