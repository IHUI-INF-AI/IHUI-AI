<template>
  <!--
    PaperUploadForm.vue — 试卷上传表单（PR-E E2）
    被 PaperUpload.vue 复用：page 模式 + dialog 模式共用一份表单逻辑
    含：标题/试卷类型/科目/考试日期/得分/总分/文件上传 + 前端校验
  -->
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="120px"
    label-position="right"
    class="upload-form"
  >
    <el-form-item :label="t('edu.profile.paperTitleLabel')" prop="title">
      <el-input
        v-model="form.title"
        :placeholder="t('edu.profile.paperTitlePlaceholder')"
        maxlength="100"
        show-word-limit
      />
    </el-form-item>

    <el-form-item :label="t('edu.profile.paperTypeLabel')" prop="paper_type">
      <el-select v-model="form.paper_type" style="width: 100%">
        <el-option :label="t('edu.profile.paperTypeUnitTest')" value="unit_test" />
        <el-option :label="t('edu.profile.paperTypeMidterm')" value="midterm" />
        <el-option :label="t('edu.profile.paperTypeFinal')" value="final" />
        <el-option :label="t('edu.profile.paperTypeMockExam')" value="mock_exam" />
        <el-option :label="t('edu.profile.paperTypeCompetition')" value="competition" />
        <el-option :label="t('edu.profile.paperTypeOther')" value="other" />
      </el-select>
    </el-form-item>

    <el-form-item :label="t('edu.profile.paperSubjectLabel')" prop="subject">
      <el-select v-model="form.subject" style="width: 100%">
        <el-option :label="t('edu.profile.subjectChinese')" value="chinese" />
        <el-option :label="t('edu.profile.subjectMath')" value="math" />
        <el-option :label="t('edu.profile.subjectEnglish')" value="english" />
        <el-option :label="t('edu.profile.subjectPhysics')" value="physics" />
        <el-option :label="t('edu.profile.subjectChemistry')" value="chemistry" />
        <el-option :label="t('edu.profile.subjectBiology')" value="biology" />
        <el-option :label="t('edu.profile.subjectHistory')" value="history" />
        <el-option :label="t('edu.profile.subjectGeography')" value="geography" />
        <el-option :label="t('edu.profile.subjectPolitics')" value="politics" />
        <el-option :label="t('edu.profile.subjectOther')" value="other" />
      </el-select>
    </el-form-item>

    <el-form-item :label="t('edu.profile.paperExamDateLabel')" prop="exam_date">
      <el-date-picker
        v-model="form.exam_date"
        type="date"
        value-format="YYYY-MM-DD"
        :placeholder="t('edu.profile.paperExamDateLabel')"
        style="width: 100%"
      />
    </el-form-item>

    <el-form-item :label="t('edu.profile.paperScoreLabel')" prop="score">
      <el-input-number
        v-model="form.score"
        :min="0"
        :max="form.full_score || 1000"
        :placeholder="t('edu.profile.paperScorePlaceholder')"
        style="width: 100%"
      />
    </el-form-item>

    <el-form-item :label="t('edu.profile.paperFullScoreLabel')" prop="full_score">
      <el-input-number
        v-model="form.full_score"
        :min="1"
        :max="1000"
        :placeholder="t('edu.profile.paperFullScorePlaceholder')"
        style="width: 100%"
      />
    </el-form-item>

    <el-form-item :label="t('edu.profile.selectFile')" prop="file_url">
      <el-upload
        :auto-upload="false"
        :limit="1"
        :on-change="handleFileChange"
        :on-exceed="handleExceed"
        :on-remove="handleFileRemove"
        :file-list="fileList"
        :before-upload="() => false"
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
        class="paper-uploader"
      >
        <el-button :icon="UploadFilled">{{ t('edu.profile.selectFile') }}</el-button>
        <template #tip>
          <div class="upload-hint">{{ t('edu.profile.fileTypeHint') }}</div>
        </template>
      </el-upload>
    </el-form-item>

    <el-form-item :label="t('edu.profile.paperDescriptionLabel')" prop="description">
      <el-input
        v-model="form.description"
        type="textarea"
        :rows="3"
        :placeholder="t('edu.profile.paperDescriptionPlaceholder')"
        maxlength="500"
        show-word-limit
      />
    </el-form-item>

    <el-form-item>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        {{ t('edu.common.submit') }}
      </el-button>
      <el-button @click="handleReset">{{ t('edu.common.cancel') }}</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import {
  type UploadedPaperCreate,
  type PaperType,
  type PaperSubject,
} from '@/api/edu/uploaded-papers'
import { validateFile } from '@/utils/fileValidation'

interface Props {
  submitting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
})

const emit = defineEmits<{
  (e: 'submit', payload: UploadedPaperCreate): void
  (e: 'reset'): void
}>()

const { t } = useI18n()

const formRef = ref<FormInstance | null>(null)
const fileList = ref<UploadFile[]>([])
const fileUrl = ref('')

interface UploadForm {
  title: string
  paper_type: PaperType
  subject: PaperSubject
  exam_date: string
  score: number | undefined
  full_score: number | undefined
  file_url: string
  description: string
}

const form = reactive<UploadForm>({
  title: '',
  paper_type: 'midterm',
  subject: 'math',
  exam_date: '',
  score: undefined,
  full_score: 100,
  file_url: '',
  description: '',
})

const rules: FormRules = {
  title: [{ required: true, message: t('edu.profile.paperTitleLabel'), trigger: 'blur' }],
  paper_type: [{ required: true, message: t('edu.profile.paperTypeLabel'), trigger: 'change' }],
  subject: [{ required: true, message: t('edu.profile.paperSubjectLabel'), trigger: 'change' }],
  exam_date: [{ required: true, message: t('edu.profile.paperExamDateLabel'), trigger: 'change' }],
  file_url: [{ required: true, message: t('edu.profile.selectFile'), trigger: 'change' }],
}

const canSubmit = computed(() => {
  return (
    form.title.trim() !== '' &&
    form.exam_date !== '' &&
    fileUrl.value !== '' &&
    !props.submitting
  )
})

async function handleFileChange(file: UploadFile) {
  // 前端校验文件（PR-F F5：抽到 utils/fileValidation.ts）
  const raw = file.raw
  if (raw) {
    const result = validateFile(raw, {
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
      maxSize: 10 * 1024 * 1024, // 10MB
    })
    if (!result.valid) {
      ElMessage.error(result.errors[0] || t('edu.profile.uploadFailed'))
      fileList.value = []
      return
    }
  }
  fileList.value = [file]
  fileUrl.value = file.url || ''
  form.file_url = fileUrl.value
}

function handleExceed() {
  ElMessage.warning(t('edu.profile.fileTypeHint'))
}

function handleFileRemove() {
  fileList.value = []
  fileUrl.value = ''
  form.file_url = ''
}

async function handleSubmit() {
  if (!formRef.value || props.submitting) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    const payload: UploadedPaperCreate = {
      title: form.title.trim(),
      paper_type: form.paper_type,
      subject: form.subject,
      exam_date: form.exam_date,
      score: form.score,
      full_score: form.full_score,
      file_url: fileUrl.value,
      description: form.description?.trim() || undefined,
    }
    emit('submit', payload)
  })
}

function reset() {
  form.title = ''
  form.paper_type = 'midterm'
  form.subject = 'math'
  form.exam_date = ''
  form.score = undefined
  form.full_score = 100
  form.file_url = ''
  form.description = ''
  fileUrl.value = ''
  fileList.value = []
  formRef.value?.clearValidate()
  emit('reset')
}

defineExpose({ reset })
</script>

<style scoped lang="scss">
.upload-form {
  max-width: 640px;
}

.paper-uploader {
  width: 100%;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
