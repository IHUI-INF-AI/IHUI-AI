<template>
  <!--
    PaperUpload.vue — 考试试卷上传（PR-E E2）
    双模式：page 模式（独立路由页）/ dialog 模式（v-model:visible 控制的弹窗）
    参考自 CertUpload.vue，扩展试卷类型 + 科目 + 考试日期 + 分数
  -->
  <div v-if="mode === 'page'" class="member-paper-upload">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.profile.paperUploadTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.profile.paperUploadSubtitle') }}</p>
      </div>
    </header>
    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />
    <section class="upload-form-section">
      <PaperUploadForm
        ref="formRef"
        :submitting="submitting"
        @submit="handleSubmit"
        @reset="handleReset"
      />
    </section>
  </div>

  <el-dialog
    v-else
    v-model="dialogVisible"
    :title="t('edu.profile.paperUploadTitle')"
    width="640px"
    :close-on-click-modal="false"
    append-to-body
    @closed="handleClosed"
  >
    <PaperUploadForm
      ref="formRef"
      :submitting="submitting"
      @submit="handleSubmit"
      @reset="handleReset"
    />
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * PaperUpload 组件壳：管理 page/dialog 两种渲染模式
 * 内部表单逻辑抽到 PaperUploadForm 子组件复用
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useStudentProfile } from '@/composables/useStudentProfile'
import {
  uploadedPapersApi,
  type UploadedPaperCreate,
} from '@/api/edu/uploaded-papers'
import PaperUploadForm from './PaperUploadForm.vue'

interface Props {
  /** 渲染模式：page 独立页 / dialog 弹窗 */
  mode?: 'page' | 'dialog'
  /** dialog 模式的可见性（v-model:visible） */
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'page',
  visible: false,
})

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'success', paper: UploadedPaperCreate): void
}>()

const { t } = useI18n()
const { error, refresh } = useStudentProfile()

const submitting = ref(false)
const formRef = ref<{ reset: () => void } | null>(null)

// dialog 模式的可见性双向绑定
const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

async function handleSubmit(payload: UploadedPaperCreate) {
  if (submitting.value) return
  submitting.value = true
  try {
    await uploadedPapersApi.create(payload)
    ElMessage.success(t('edu.profile.uploadSuccess'))
    handleReset()
    // PR-F 修复: 试卷上传成功后应刷新 papers 而非 certs
    await refresh('papers')
    emit('success', payload)
    if (props.mode === 'dialog') {
      dialogVisible.value = false
    }
  } catch (e) {
    console.error('[PaperUpload] submit failed', e)
    ElMessage.error(t('edu.profile.uploadFailed'))
  } finally {
    submitting.value = false
  }
}

function handleReset() {
  formRef.value?.reset()
}

function handleClosed() {
  handleReset()
}

// page 模式下没有 visible 监听，dialog 模式关闭时由 handleClosed 处理
watch(
  () => props.visible,
  (val) => {
    if (!val && props.mode === 'dialog') {
      handleReset()
    }
  },
)
</script>

<style scoped lang="scss">
.member-paper-upload {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.error-alert {
  margin: 0;
}

.upload-form-section {
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  padding: 24px;
}

@media (width <= 640px) {
  .upload-form-section {
    padding: 16px;
  }
}
</style>
