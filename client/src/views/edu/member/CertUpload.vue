<template>
  <div class="member-cert-upload">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.profile.certUploadTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.profile.certUploadSubtitle') }}</p>
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
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        label-position="right"
        class="upload-form"
      >
        <el-form-item :label="t('edu.profile.certTitleLabel')" prop="title">
          <el-input
            v-model="form.title"
            :placeholder="t('edu.profile.certTitleLabel')"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item :label="t('edu.profile.certIssuerLabel')" prop="issuer">
          <el-input
            v-model="form.issuer"
            :placeholder="t('edu.profile.certIssuerLabel')"
            maxlength="100"
          />
        </el-form-item>

        <el-form-item :label="t('edu.profile.certIssueDateLabel')" prop="issue_date">
          <el-date-picker
            v-model="form.issue_date"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="t('edu.profile.certIssueDateLabel')"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item :label="t('edu.profile.certTypeLabel')" prop="cert_type">
          <el-select v-model="form.cert_type" style="width: 100%">
            <el-option :label="t('edu.profile.certTypeCertificate')" value="certificate" />
            <el-option :label="t('edu.profile.certTypeTranscript')" value="transcript" />
            <el-option :label="t('edu.profile.certTypeDiploma')" value="diploma" />
            <el-option :label="t('edu.profile.certTypeOther')" value="other" />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('edu.profile.selectFile')" prop="file_url">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-exceed="handleExceed"
            :on-remove="handleFileRemove"
            :file-list="fileList"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
            class="cert-uploader"
          >
            <el-button :icon="UploadFilled">{{ t('edu.profile.selectFile') }}</el-button>
            <template #tip>
              <div class="upload-hint">{{ t('edu.profile.fileTypeHint') }}</div>
            </template>
          </el-upload>
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
    </section>

    <section v-loading="loading" class="cert-list-section">
      <CertificateList :certs="certificates" :uploaded="uploadedCerts" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { useStudentProfile } from '@/composables/useStudentProfile'
import { uploadedCertsApi, type UploadedCertCreate, type UploadedCertType } from '@/api/edu/uploaded-certs'
import CertificateList from '@/components/edu/CertificateList.vue'
import { validateFile } from '@/utils/fileValidation'

const { t } = useI18n()
const { loading, error, certificates, uploadedCerts, loadAll, refresh } = useStudentProfile()

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)
const fileList = ref<UploadFile[]>([])
const fileUrl = ref('')

interface UploadForm {
  title: string
  issuer: string
  issue_date: string
  cert_type: UploadedCertType
  file_url: string
}

const form = reactive<UploadForm>({
  title: '',
  issuer: '',
  issue_date: '',
  cert_type: 'certificate',
  file_url: '',
})

const rules: FormRules = {
  title: [{ required: true, message: t('edu.profile.certTitleLabel'), trigger: 'blur' }],
  issuer: [{ required: true, message: t('edu.profile.certIssuerLabel'), trigger: 'blur' }],
  issue_date: [{ required: true, message: t('edu.profile.certIssueDateLabel'), trigger: 'change' }],
  cert_type: [{ required: true, message: t('edu.profile.certTypeLabel'), trigger: 'change' }],
  file_url: [{ required: true, message: t('edu.profile.selectFile'), trigger: 'change' }],
}

const canSubmit = computed(() => {
  return (
    form.title.trim() !== '' &&
    form.issuer.trim() !== '' &&
    form.issue_date !== '' &&
    fileUrl.value !== ''
  )
})

function handleFileChange(file: UploadFile) {
  // PR-F F5：接入 utils/fileValidation.ts 统一校验
  const raw = file.raw
  if (raw) {
    const result = validateFile(raw, {
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
      maxSize: 10 * 1024 * 1024, // 10MB
    })
    if (!result.valid) {
      ElMessage.error(result.errors[0] || t('edu.profile.uploadFailed'))
      return
    }
  }
  fileList.value = [file]
  // 实际项目中应调用上传接口拿回 url，此处 mock 用本地 blob url 占位
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
  if (!formRef.value || submitting.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    submitting.value = true
    try {
      const payload: UploadedCertCreate = {
        title: form.title.trim(),
        issuer: form.issuer.trim(),
        issue_date: form.issue_date,
        cert_type: form.cert_type,
        file_url: fileUrl.value,
      }
      await uploadedCertsApi.create(payload)
      ElMessage.success(t('edu.profile.uploadSuccess'))
      handleReset()
      await refresh('certs')
    } catch (e) {
      console.error('[CertUpload] submit failed', e)
      ElMessage.error(t('edu.profile.uploadFailed'))
    } finally {
      submitting.value = false
    }
  })
}

function handleReset() {
  form.title = ''
  form.issuer = ''
  form.issue_date = ''
  form.cert_type = 'certificate'
  form.file_url = ''
  fileUrl.value = ''
  fileList.value = []
  formRef.value?.clearValidate()
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.member-cert-upload {
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

.upload-form-section,
.cert-list-section {
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  padding: 24px;
}

.upload-form {
  max-width: 640px;
}

.cert-uploader {
  width: 100%;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

@media (width <= 640px) {
  .upload-form-section,
  .cert-list-section {
    padding: 16px;
  }
}
</style>
