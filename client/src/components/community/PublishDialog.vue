<template>
  <el-dialog
    v-model="visible"
    :title="t('community.publish.title')"
    width="640px"
    :close-on-click-modal="false"
    class="publish-dialog"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="publish-form"
    >
      <!-- 内容类型选择 -->
      <el-form-item :label="t('community.publish.contentType')" prop="type">
        <div class="type-selector">
          <button
            v-for="typeOption in typeOptions"
            :key="typeOption.value"
            type="button"
            class="type-option"
            :class="{ 'is-selected': form.type === typeOption.value }"
            @click="form.type = typeOption.value"
          >
            <el-icon><component :is="typeOption.icon" /></el-icon>
            <span>{{ typeOption.label }}</span>
          </button>
        </div>
      </el-form-item>

      <!-- 标题 -->
      <el-form-item :label="t('community.publish.titleLabel')" prop="title">
        <el-input
          v-model="form.title"
          :placeholder="t('community.publish.titlePlaceholder')"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <!-- 内容上传/输入 -->
      <el-form-item :label="t('community.publish.content')" prop="contentUrl">
        <!-- 图片/视频/音频上传 -->
        <div v-if="['image', 'video', 'audio', 'music'].includes(form.type)" class="content-upload">
          <!-- 预览区域 -->
          <div v-if="form.contentUrl" class="preview-area">
            <img
              v-if="form.type === 'image'"
              :src="form.contentUrl"
              class="preview-image"
              alt="预览图片"
              @error="handlePreviewError"
              loading="lazy"
            />
            <video
              v-else-if="form.type === 'video'"
              :src="form.contentUrl"
              class="preview-video"
              controls
              preload="none"
            />
            <audio
              v-else-if="form.type === 'audio' || form.type === 'music'"
              :src="form.contentUrl"
              class="preview-audio"
              controls
            />
            <button type="button" class="remove-btn" @click="clearContent">
              <el-icon><Close /></el-icon>
            </button>
          </div>

          <!-- 上传区域 -->
          <el-upload
            v-else
            class="content-uploader"
            :action="uploadUrl"
            :accept="acceptTypes[form.type]"
            :show-file-list="false"
            :before-upload="handleBeforeUpload"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            drag
          >
            <div class="upload-placeholder">
              <el-icon class="upload-icon"><Upload /></el-icon>
              <p class="upload-text">{{ t('community.publish.uploadTip') }}</p>
              <p class="upload-hint">{{ getUploadHint(form.type) }}</p>
            </div>
          </el-upload>

          <!-- 或者输入URL -->
          <div class="url-input-section">
            <el-divider>{{ t('community.publish.orInputUrl') }}</el-divider>
            <el-input
              v-model="form.contentUrl"
              :placeholder="t('community.publish.contentUrlPlaceholder')"
            >
              <template #prefix>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
          </div>
        </div>

        <!-- 文章/代码输入 -->
        <div v-else class="text-content">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="8"
            :placeholder="form.type === 'code' ? t('community.publish.codePlaceholder') : t('community.publish.articlePlaceholder')"
          />
        </div>
      </el-form-item>

      <!-- 描述（非文章/代码类型时显示） -->
      <el-form-item
        v-if="!['article', 'code'].includes(form.type)"
        :label="t('community.publish.description')"
        prop="description"
      >
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="t('community.publish.descriptionPlaceholder')"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <!-- AI来源 -->
      <el-form-item :label="t('community.publish.aiSource')" prop="aiSource">
        <el-select v-model="form.aiSource" :placeholder="t('community.publish.selectAiSource')">
          <el-option-group v-for="group in aiSourceGroups" :key="group.label" :label="group.label">
            <el-option
              v-for="source in group.options"
              :key="source.value"
              :label="source.label"
              :value="source.value"
            />
          </el-option-group>
        </el-select>
      </el-form-item>

      <!-- 提示词（可选） -->
      <el-form-item :label="t('community.publish.prompt')">
        <el-input
          v-model="form.prompt"
          type="textarea"
          :rows="3"
          :placeholder="t('community.publish.promptPlaceholder')"
        />
      </el-form-item>

      <!-- 标签 -->
      <el-form-item :label="t('community.publish.tags')">
        <div class="tags-input">
          <el-tag
            v-for="tag in form.tags"
            :key="tag"
            closable
            @close="removeTag(tag)"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="form.tags.length < 5"
            v-model="newTag"
            class="tag-input"
            size="small"
            :placeholder="t('community.publish.addTag')"
            @keydown.enter.prevent="addTag"
            @blur="addTag"
          />
        </div>
        <div class="hot-tags">
          <span class="hot-tags-label">{{ t('community.publish.hotTags') }}:</span>
          <el-tag
            v-for="tag in hotTags"
            :key="tag"
            class="hot-tag"
            :class="{ 'is-selected': form.tags.includes(tag) }"
            @click="toggleHotTag(tag)"
          >
            {{ tag }}
          </el-tag>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ t('community.publish.submit') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Image, VideoPlay, Headphones, Music, Document, Code,
  Upload, Close, Link
} from '@/lib/lucide-fallback'
import { publishCreation, getHotTags, type ContentType, type AISource, type PublishCreationParams } from '@/api/ai/ai-community'
import { useOperationFeedback } from '@/composables/useOperationFeedback'

interface Props {
  modelValue: boolean
  /** 预填数据（从AI对话窗传入） */
  prefillData?: Partial<PublishCreationParams>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const newTag = ref('')
const hotTags = ref<string[]>([])

const form = reactive<PublishCreationParams & { tags: string[] }>({
  type: 'image',
  title: '',
  description: '',
  contentUrl: '',
  aiSource: 'ihui-ai',
  aiModelName: '',
  prompt: '',
  tags: [],
})

// 类型选项
const typeOptions = [
  { value: 'image', label: t('community.types.image'), icon: Image },
  { value: 'video', label: t('community.types.video'), icon: VideoPlay },
  { value: 'audio', label: t('community.types.audio'), icon: Headphones },
  { value: 'music', label: t('community.types.music'), icon: Music },
  { value: 'article', label: t('community.types.article'), icon: Document },
  { value: 'code', label: t('community.types.code'), icon: Code },
]

// AI来源分组
const aiSourceGroups = [
  {
    label: t('community.aiSources.imageGroup'),
    options: [
      { value: 'midjourney', label: 'Midjourney' },
      { value: 'stable-diffusion', label: 'Stable Diffusion' },
      { value: 'dall-e', label: 'DALL-E' },
      { value: 'flux', label: 'Flux' },
    ],
  },
  {
    label: t('community.aiSources.videoGroup'),
    options: [
      { value: 'sora', label: 'Sora' },
      { value: 'runway', label: 'Runway' },
      { value: 'pika', label: 'Pika' },
      { value: 'kling', label: 'Kling' },
    ],
  },
  {
    label: t('community.aiSources.audioGroup'),
    options: [
      { value: 'suno', label: 'Suno' },
      { value: 'udio', label: 'Udio' },
      { value: 'elevenlabs', label: 'ElevenLabs' },
    ],
  },
  {
    label: t('community.aiSources.textGroup'),
    options: [
      { value: 'gpt', label: 'ChatGPT' },
      { value: 'claude', label: 'Claude' },
      { value: 'gemini', label: 'Gemini' },
      { value: 'qwen', label: t('data.publish_dialog.通义千问') },
      { value: 'doubao', label: t('data.publish_dialog.豆包1') },
    ],
  },
  {
    label: t('community.aiSources.codeGroup'),
    options: [
      { value: 'cursor', label: 'Cursor' },
      { value: 'copilot', label: 'GitHub Copilot' },
      { value: 'codegeex', label: 'CodeGeeX' },
    ],
  },
  {
    label: t('community.aiSources.otherGroup'),
    options: [
      { value: 'ihui-ai', label: t('data.publish_dialog.智汇AI2') },
      { value: 'other', label: t('community.aiSources.other') },
    ],
  },
]

// 文件类型限制
const acceptTypes: Record<ContentType, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  music: 'audio/*',
  article: '',
  code: '',
  model3d: '.glb,.gltf,.obj,.fbx',
}

const uploadUrl = computed(() => import.meta.env.VITE_API_BASE_URL + '/upload')

// 表单验证规则
const rules: FormRules = {
  type: [{ required: true, message: t('community.publish.typeRequired'), trigger: 'change' }],
  title: [
    { required: true, message: t('community.publish.titleRequired'), trigger: 'blur' },
    { min: 2, max: 100, message: t('community.publish.titleLength'), trigger: 'blur' },
  ],
  contentUrl: [
    {
      validator: (_rule, _value, callback) => {
        if (['image', 'video', 'audio', 'music'].includes(form.type) && !form.contentUrl) {
          callback(new Error(t('community.publish.contentRequired')))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
  aiSource: [{ required: true, message: t('community.publish.aiSourceRequired'), trigger: 'change' }],
}

// 获取上传提示
const getUploadHint = (type: ContentType) => {
  const hints: Record<ContentType, string> = {
    image: t('community.publish.imageHint'),
    video: t('community.publish.videoHint'),
    audio: t('community.publish.audioHint'),
    music: t('community.publish.musicHint'),
    article: '',
    code: '',
    model3d: t('community.publish.model3dHint'),
  }
  return hints[type] || ''
}

// 上传相关
const handleBeforeUpload = (file: File) => {
  const maxSize = form.type === 'video' ? 500 : 50 // MB
  if (file.size / 1024 / 1024 > maxSize) {
    showError(t('community.publish.fileTooLarge', { size: maxSize }))
    return false
  }
  return true
}

const handleUploadSuccess = (response: { url: string }) => {
  form.contentUrl = response.url
  showSuccess(t('community.publish.uploadSuccess'))
}

const handleUploadError = () => {
  showError(t('community.publish.uploadFailed'))
}

const clearContent = () => {
  form.contentUrl = ''
}

const handlePreviewError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.src = '/images/common/placeholder.svg'
}

// 标签相关
const addTag = () => {
  const tag = newTag.value.trim()
  if (tag && !form.tags.includes(tag) && form.tags.length < 5) {
    form.tags.push(tag)
    newTag.value = ''
  }
}

const removeTag = (tag: string) => {
  form.tags = form.tags.filter(t => t !== tag)
}

const toggleHotTag = (tag: string) => {
  if (form.tags.includes(tag)) {
    removeTag(tag)
  } else if (form.tags.length < 5) {
    form.tags.push(tag)
  }
}

// 加载热门标签
const loadHotTags = async () => {
  try {
    const res = await getHotTags()
    if (res.success && res.data) {
      hotTags.value = res.data
    }
  } catch {
    // 静默失败
  }
}

// 提交
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true

  try {
    const params: PublishCreationParams = {
      type: form.type as ContentType,
      title: form.title,
      description: form.description,
      contentUrl: form.contentUrl,
      aiSource: form.aiSource as AISource,
      aiModelName: form.aiModelName,
      prompt: form.prompt,
      tags: form.tags,
    }

    const res = await publishCreation(params)

    if (res.success) {
      showSuccess(t('community.publish.success'))
      emit('success')
      handleClose()
    } else {
      showError(res.message || t('community.publish.failed'))
    }
  } catch (_err) {
    showError(t('community.publish.failed'))
  } finally {
    submitting.value = false
  }
}

// 关闭弹窗
const handleClose = () => {
  visible.value = false
  // 重置表单
  form.type = 'image'
  form.title = ''
  form.description = ''
  form.contentUrl = ''
  form.aiSource = 'ihui-ai'
  form.aiModelName = ''
  form.prompt = ''
  form.tags = []
  newTag.value = ''
}

// 监听预填数据
watch(() => props.prefillData, (data) => {
  if (data) {
    Object.assign(form, data)
    if (data.tags) form.tags = [...data.tags]
  }
}, { immediate: true })

onMounted(() => {
  loadHotTags()
})
</script>

<style scoped lang="scss">
.publish-dialog {
  :deep(.el-dialog__body) {
    padding: 20px 24px;
    max-height: 70vh;
    overflow-y: auto;
  }
}

// 使用 :where() 包裹外层容器，降低后代选择器特异性
:where(.publish-form) {
  // 类型选择器
  :where(.type-selector) {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;

    :where(.type-option) {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 16px;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      background: var(--el-bg-color);
      cursor: pointer;
      transition: border-color 0.2s, background-color 0.2s;

      .el-icon {
        font-size: 24px;
        color: var(--el-text-color-secondary);
      }

      span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      &:hover {
        border-color: var(--el-color-primary-light-5);
        background: var(--el-color-primary-light-9);
      }

      &.is-selected {
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        background: var(--el-color-primary-light-9);

        .el-icon, span {
          color: var(--el-color-primary);
        }
      }
    }
  }

  // 内容上传区域
  .content-upload {
    .preview-area {
      position: relative;
      margin-bottom: 16px;

      .preview-image {
        max-width: 100%;
        max-height: 300px;
        border-radius: var(--global-border-radius);
      }

      .preview-video {
        width: 100%;
        max-height: 300px;
        border-radius: var(--global-border-radius);
      }

      .preview-audio {
        width: 100%;
      }

      .remove-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: var(--global-border-radius);
        background: var(--color-black-60);
        color: var(--el-bg-color-page);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background: var(--color-black-80);
        }
      }
    }

    .content-uploader {
      :deep(.el-upload-dragger) {
        padding: 40px 20px;
        border-radius: var(--global-border-radius);

        &:hover {
          border: var(--el-border-width-primary) solid var(--el-color-primary);
        }
      }

      :where(.upload-placeholder) {
        text-align: center;

        .upload-icon {
          font-size: 48px;
          color: var(--el-text-color-placeholder);
          margin-bottom: 12px;
        }

        .upload-text {
          font-size: 14px;
          color: var(--el-text-color-primary);
          margin: 0 0 8px;
        }

        .upload-hint {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          margin: 0;
        }
      }
    }

    .url-input-section {
      margin-top: 16px;
    }
  }

  // 标签输入
  .tags-input {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    .tag-input {
      width: 100px;
    }
  }

  .hot-tags {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    .hot-tags-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .hot-tag {
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s, border-color 0.2s;

      &:hover {
        background: var(--el-color-primary-light-8);
      }

      &.is-selected {
        background: var(--el-color-primary);
        color: var(--el-bg-color-page);
        border: var(--el-border-width-primary) solid var(--el-color-primary);
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
