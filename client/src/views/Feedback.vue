<template>
  <div class="feedback-page">
    <div class="container">
      <!-- 头部 -->
      <header class="hub-header ihui-ai-fade-in-top-animation">
        <h1>{{ t('feedback.title') }}</h1>
        <p class="subtitle">{{ t('feedback.content.tip') }}</p>
      </header>

      <main class="feedback-main ihui-ai-fade-in-top-animation">
        <!-- 视图切换 -->
        <div class="view-toggle">
          <el-radio-group v-model="pageView" @change="handleViewChange">
            <el-radio-button value="list">{{ t('Feedback.feedbackRecords') }}</el-radio-button>
            <el-radio-button value="form">{{ t('Feedback.submitFeedback') }}</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 反馈列表视图 -->
        <section v-if="pageView === 'list'" class="feedback-list-section card-glass">
          <div class="console-header">
            <div class="id-block">FEEDBACK_LOG</div>
            <div class="status-block"><span class="dot"></span> {{ feedbackList.length }} RECORDS</div>
          </div>

          <div v-if="feedbackList.length === 0 && !listLoading" class="empty-list">
            <el-empty :description="t('feedbackPage.noRecords')" />
          </div>

          <div v-else class="feedback-list">
            <div
              v-for="item in feedbackList"
              :key="item.id"
              class="feedback-item"
              @click="viewFeedbackDetail(item)"
            >
              <div class="item-header">
                <span class="item-type-badge" :class="item.type">{{ item.type }}</span>
                <span class="item-status" :class="item.status">{{ item.status }}</span>
              </div>
              <div class="item-content">{{ item.content }}</div>
              <div class="item-meta">
                <span v-if="item.contact">{{ t('feedbackPage.contact') }}: {{ item.contact }}</span>
                <span class="item-time">{{ formatTime(item.createTime) }}</span>
              </div>
              <div v-if="item.images && item.images.length > 0" class="item-images">
                <img
                  v-for="(img, idx) in item.images.slice(0, 3)"
                  :key="idx"
                  :src="img"
                  class="item-image-thumb"
                  loading="lazy"
                />
                <span v-if="item.images.length > 3" class="more-images">+{{ item.images.length - 3 }}</span>
              </div>
            </div>
          </div>

          <div v-if="listLoading" class="list-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>{{ t('Feedback.loading') }}</span>
          </div>
        </section>

        <!-- 反馈表单视图 -->
        <section v-else class="feedback-console card-glass">
          <div class="console-header">
            <div class="id-block">PROTOCOL_0{{ transId }}</div>
            <div class="status-block"><span class="dot"></span> {{ viewMode === 'detail' ? 'VIEW_ONLY' : 'READY_FOR_INPUT' }}</div>
          </div>

          <el-form
            ref="feedbackFormRef"
            :model="feedbackForm"
            :rules="feedbackRules"
            label-position="top"
            class="tech-form"
          >
            <!-- 协议类型选择 -->
            <div class="form-section">
              <label>SECTOR_CLASSIFICATION</label>
              <div class="type-matrix">
                <button
                  v-for="type in feedbackTypes"
                  :key="type.value"
                  class="type-node"
                  :class="{ active: feedbackForm.type === type.value }"
                  @click="viewMode !== 'detail' && (feedbackForm.type = type.value)"
                  :disabled="viewMode === 'detail'"
                  type="button"
                >
                  <span class="ico">{{ type.icon }}</span>
                  <span class="label">{{ type.label.toUpperCase() }}</span>
                </button>
              </div>
            </div>

            <!-- 数据报文 -->
            <div class="form-section">
              <label>DATA_PAYLOAD / MESSAGE</label>
              <el-form-item prop="content">
                <div class="textarea-console">
                  <el-input
                    v-model="feedbackForm.content"
                    type="textarea"
                    :rows="6"
                    :maxlength="1000"
                    :disabled="viewMode === 'detail'"
                    placeholder="ENTER DETAILED LOG DATA..."
                  />
                  <div class="console-footer">
                    <span class="count">{{ feedbackForm.content.length }}/1000 BIT</span>
                    <span class="hint" v-if="viewMode !== 'detail'">CTRL+ENTER TO TRANSMIT</span>
                  </div>
                </div>
              </el-form-item>
            </div>

            <div class="form-grid">
              <!-- 联系人标识 -->
              <div class="form-section">
                <label>SENDER_IDENTIFIER</label>
                <el-form-item prop="contact">
                  <el-input
                    v-model="feedbackForm.contact"
                    :disabled="viewMode === 'detail'"
                    placeholder="EMAIL OR PHONE..."
                  />
                </el-form-item>
              </div>

              <!-- 附件上传 -->
              <div class="form-section" v-if="viewMode !== 'detail'">
                <label>ATTACHED_EVIDENCE</label>
                <div
                  class="upload-drop-zone"
                  :class="{ active: isDragOver }"
                  @dragover.prevent="isDragOver = true"
                  @dragleave.prevent="isDragOver = false"
                  @drop.prevent="handleDrop"
                  @click="triggerFileInput"
                >
                  <div class="upload-ico"><UploadCloud /></div>
                  <span class="upload-txt">UPLOAD_IMAGES ({{ uploadedImages.length }}/9)</span>
                  <input ref="fileInputRef" type="file" hidden accept="image/*" multiple @change="handleFileChange" />
                </div>
                <div class="preview-grid" v-if="uploadedImages.length">
                  <div v-for="(img, i) in uploadedImages" :key="i" class="preview-item">
                    <img :src="img.preview" alt="反馈图片" loading="lazy" />
                    <button aria-label="删除图片" @click.stop="removeImage(i)">×</button>
                  </div>
                </div>
              </div>

              <!-- 详情模式下显示已有图片 -->
              <div class="form-section" v-else-if="feedbackForm.images && feedbackForm.images.length > 0">
                <label>ATTACHED_EVIDENCE</label>
                <div class="preview-grid">
                  <div v-for="(img, i) in feedbackForm.images" :key="i" class="preview-item">
                    <img :src="img" alt="反馈图片" loading="lazy" />
                  </div>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <template v-if="viewMode === 'detail'">
                <button class="btn-transmit" @click.prevent="viewMode = 'add'; Object.assign(feedbackForm, { type: 'feature', content: '', contact: '', images: [] })">
                  {{ t('feedbackPage.backToSubmit') }}
                </button>
              </template>
              <template v-else>
                <button class="btn-transmit" :disabled="isSubmitting" @click.prevent="submitFeedback">
                  {{ isSubmitting ? 'TRANSMITTING...' : 'TRANSMIT SIGNAL' }}
                </button>
                <el-button link @click="resetForm" class="btn-reset">CLEAR_BUFFER</el-button>
              </template>
            </div>
          </el-form>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { UploadCloud, Loading } from '@/lib/lucide-fallback'
import { ElMessage } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { submitFeedback as submitFeedbackApi, getFeedbacks, type Feedback } from '@/api/feedback'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const _router = useRouter()
const { handleResult: _handleResult } = useOperationFeedback()

const transId = ref(Math.floor(Math.random() * 9000 + 1000))
const isSubmitting = ref(false)
const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const feedbackFormRef = ref<InstanceType<typeof import('element-plus')['ElForm']> | null>(null)

const pageView = ref<'list' | 'form'>('list')
const viewMode = ref<'add' | 'detail'>('add')
const feedbackList = ref<Feedback[]>([])
const listLoading = ref(false)

const feedbackForm = reactive({ type: 'feature', content: '', contact: '', images: [] as string[] })

interface UploadedImage {
  file: File
  preview: string | ArrayBuffer | null
}
const uploadedImages = ref<UploadedImage[]>([])

const feedbackTypes = [
  { value: 'feature', label: t('feedback.type.feature'), icon: '✨' },
  { value: 'bug', label: t('feedback.type.bug'), icon: '🐛' },
  { value: 'experience', label: t('feedback.type.experience'), icon: '💡' },
  { value: 'other', label: t('feedback.type.other'), icon: '📝' },
]

const feedbackRules = {
  content: [{ required: true, message: t('feedback.rules.contentRequired'), trigger: 'blur' }, { min: 10, message: t('feedback.rules.contentMin'), trigger: 'blur' }]
}

const formatTime = (time: string) => {
  if (!time) return ''
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const loadFeedbackList = async () => {
  listLoading.value = true
  try {
    const res = await getFeedbacks({ page: 1, pageSize: 50 })
    if (res && res.success && res.data) {
      const data = res.data as { list?: Feedback[] }
      feedbackList.value = data.list || []
    }
  } catch (error) {
    logger.error('Failed to load feedback list:', error)
  } finally {
    listLoading.value = false
  }
}

const handleViewChange = (val: string) => {
  if (val === 'list') {
    loadFeedbackList()
  }
}

const viewFeedbackDetail = (item: Feedback) => {
  viewMode.value = 'detail'
  feedbackForm.type = item.type
  feedbackForm.content = item.content
  feedbackForm.contact = item.contact || ''
  feedbackForm.images = item.images || []
  pageView.value = 'form'
}

const triggerFileInput = () => fileInputRef.value?.click()
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) addFiles(target.files)
}
const handleDrop = (e: DragEvent) => {
  isDragOver.value = false
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
}
const addFiles = (files: FileList) => {
  const remaining = 9 - uploadedImages.value.length
  Array.from(files).slice(0, remaining).forEach(f => {
    if (!f.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = ev => uploadedImages.value.push({ file: f, preview: ev.target?.result ?? null })
    r.readAsDataURL(f)
  })
}
const removeImage = (i: number) => uploadedImages.value.splice(i, 1)

const submitFeedback = async () => {
  if (!feedbackFormRef.value) return
  await feedbackFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      isSubmitting.value = true
      try {
        const imageUrls = uploadedImages.value.map(img => img.preview as string).filter(Boolean)
        await submitFeedbackApi({
          type: feedbackForm.type as 'feature' | 'bug' | 'experience' | 'other',
          content: feedbackForm.content,
          contact: feedbackForm.contact || undefined,
          images: imageUrls.length > 0 ? imageUrls : undefined,
        })
        ElMessage.success(t('feedback.submitSuccess'))
        resetForm()
        transId.value = Math.floor(Math.random() * 9000 + 1000)
        loadFeedbackList()
      } catch {
        ElMessage.error(t('Feedback.submitFailed'))
      } finally {
        isSubmitting.value = false
      }
    }
  })
}

const resetForm = () => {
  feedbackFormRef.value?.resetFields()
  uploadedImages.value = []
  feedbackForm.type = 'feature'
  feedbackForm.content = ''
  feedbackForm.contact = ''
  feedbackForm.images = []
  viewMode.value = 'add'
}

onMounted(() => {
  loadFeedbackList()
})
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.feedback-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.container { position: relative; z-index: var(--z-base); max-width: 900px; margin: 0 auto; padding: 0 40px;

 @include bp.tablet-down { padding: 0 24px; } }

.hub-header {
  padding: 40px 0;
  text-align: center;
  h1 { font-size: clamp(32px, 5vw, 48px); font-weight: 900; letter-spacing: -2px; color: var(--el-text-color-primary); }
  .subtitle { color: var(--el-text-color-secondary); font-size: 16px; margin-top: 12px; }
}

.view-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.feedback-console, .feedback-list-section {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 60px;
  margin-bottom: 120px;

  @include bp.tablet-down { padding: 32px; }

  .console-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 40px;
    font-family: var(--font-family-mono);
    font-size: 10px;
    font-weight: 800;
    .id-block { color: var(--el-text-color-secondary); }
    .status-block { color: var(--el-color-primary); display: flex; align-items: center; gap: 8px; .dot { width: 6px; height: 6px; border-radius: var(--global-border-radius); background: var(--el-color-primary); } }
  }
}

.form-section {
  margin-bottom: 40px;
  label { font-family: var(--font-family-mono); font-size: 10px; color: var(--el-text-color-secondary); font-weight: 800; display: block; margin-bottom: 20px; letter-spacing: 2px; }
}

.type-matrix {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  @include bp.tablet-down { grid-template-columns: repeat(2, 1fr); }

  .type-node {
    background: var(--el-bg-color-page);
    border: var(--unified-border);
    padding: 16px;
    border-radius: var(--global-border-radius);
    color: var(--el-text-color-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.3s;
    .ico { font-size: 20px; filter: grayscale(1); }
    .label { font-family: var(--font-family-mono); font-size: 9px; font-weight: 800; }
    &.active { border: 2px solid var(--border-unified-color-hover); color: var(--el-text-color-primary); .ico { filter: grayscale(0); } }
    &:hover:not(.active) { border: 2px solid var(--border-unified-color-hover); color: var(--el-text-color-regular); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

.textarea-console {
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  padding: 20px;
  border-radius: var(--global-border-radius);
  :deep(.el-textarea__inner) { background: transparent; border: none; box-shadow: none; color: var(--el-text-color-primary); font-family: var(--font-family-mono); font-size: 14px; padding: 0; }
  .console-footer { display: flex; justify-content: space-between; margin-top: 20px; font-family: var(--font-family-mono); font-size: 9px; font-weight: 800; color: var(--el-text-color-secondary); }
}

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px;

 @include bp.tablet-down { grid-template-columns: 1fr; } }

:deep(.tech-form) {
  .el-input__wrapper { background: var(--el-bg-color-page); border: var(--unified-border); border-radius: var(--global-border-radius); box-shadow: none; padding: 12px; }
  .el-input__inner { color: var(--el-text-color-primary); font-family: var(--font-family-mono); font-size: 13px; }
}

.upload-drop-zone {
  height: 100px;
  border: 1px dashed var(--el-border-color);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s;
  .upload-ico { color: var(--el-text-color-secondary); font-size: 24px; }
  .upload-txt { font-family: var(--font-family-mono); font-size: 10px; color: var(--el-text-color-secondary); font-weight: 800; }
  &:hover, &.active { border: 2px solid var(--border-unified-color-hover); background: var(--el-fill-color-light); .upload-ico, .upload-txt { color: var(--el-color-primary); } }
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 12px;
  margin-top: 16px;

  .preview-item {
    aspect-ratio: 1;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    position: relative;
    overflow: hidden;
    img { width: 100%; height: 100%; object-fit: cover; }
    button { position: absolute; top: 2px; right: 2px; background: var(--el-mask-color); border: none; color: var(--el-text-color-primary); width: 16px; height: 16px; font-size: 10px; cursor: pointer; }
  }
}

.form-actions {
  margin-top: 60px;
  padding-top: 40px;
  border-top: var(--unified-border);
  display: flex;
  align-items: center;
  gap: 40px;
  .btn-transmit { background: var(--el-text-color-primary); color: var(--el-bg-color-page); border: none; padding: 16px 40px; border-radius: var(--global-border-radius); font-family: var(--font-family-mono); font-size: 13px; font-weight: 900; cursor: pointer; transition: all 0.3s; &:hover { background: var(--el-color-primary); color: var(--el-bg-color-page); } }
  .btn-reset { font-family: var(--font-family-mono); font-size: 11px; color: var(--el-text-color-secondary); font-weight: 800; }
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feedback-item {
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: var(--el-color-primary);
    transform: translateY(-2px);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .item-type-badge {
    font-family: var(--font-family-mono);
    font-size: 10px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: var(--global-border-radius);
    text-transform: uppercase;
    border: var(--unified-border);

    &.feature { color: var(--el-color-primary); }
    &.bug { color: var(--el-color-danger); }
    &.experience { color: var(--el-color-success); }
    &.other { color: var(--el-color-warning); }
  }

  .item-status {
    font-family: var(--font-family-mono);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--el-text-color-secondary);

    &.resolved { color: var(--el-color-success); }
    &.processing { color: var(--el-color-warning); }
  }

  .item-content {
    font-size: 14px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .item-meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-family: var(--font-family-mono);
  }

  .item-images {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    align-items: center;
  }

  .item-image-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
  }

  .more-images {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.empty-list {
  padding: 60px 0;
}

.list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

html.dark .feedback-page {
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}
</style>
