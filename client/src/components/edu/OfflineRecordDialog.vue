<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? t('edu.profile.editOffline') : t('edu.profile.createOffline')"
    width="560px"
    :close-on-click-modal="false"
    append-to-body
    :before-close="handleBeforeClose"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="110px"
      label-position="right"
    >
      <el-form-item :label="t('edu.profile.offlineTitleField')" prop="title">
        <el-input
          v-model="form.title"
          :placeholder="t('edu.profile.offlineTitleField')"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('edu.profile.offlineDate')" prop="record_date">
        <el-date-picker
          v-model="form.record_date"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('edu.profile.offlineDate')"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="t('edu.profile.offlineDuration')" prop="duration_minutes">
        <el-input-number
          v-model="form.duration_minutes"
          :min="1"
          :max="1440"
          :step="15"
          style="width: 180px"
        />
        <span class="unit-suffix">{{ t('edu.profile.minutes') }}</span>
      </el-form-item>

      <el-form-item :label="t('edu.profile.offlineActivityType')" prop="activity_type">
        <el-select v-model="form.activity_type" style="width: 100%">
          <el-option :label="t('edu.profile.activityTraining')" value="training" />
          <el-option :label="t('edu.profile.activitySelfStudy')" value="self_study" />
          <el-option :label="t('edu.profile.activityPractice')" value="practice" />
          <el-option :label="t('edu.profile.activityReading')" value="reading" />
          <el-option :label="t('edu.profile.activityOther')" value="other" />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('edu.profile.offlineDescription')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="t('edu.profile.offlineDescription')"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('edu.profile.offlineProof')">
        <el-upload
          :auto-upload="false"
          :limit="1"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :file-list="fileList"
          accept="image/*"
        >
          <el-button :icon="Paperclip">{{ t('edu.profile.selectFile') }}</el-button>
          <template #tip>
            <div class="upload-hint">{{ t('edu.profile.fileTypeHint') }}</div>
          </template>
        </el-upload>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ t('edu.profile.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('edu.profile.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { Paperclip } from '@element-plus/icons-vue'
import {
  offlineRecordsApi,
  type OfflineRecord,
  type OfflineRecordCreate,
  type OfflineActivityType,
} from '@/api/edu/offline-records'
import { validateFile } from '@/utils/fileValidation'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  record?: OfflineRecord | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)
const fileList = ref<UploadFile[]>([])
const proofUrl = ref('')

// PR-F F4：dirty 检测
const initialSnapshot = ref('')
const isDirty = computed(() => {
  const current = JSON.stringify({
    title: form.title,
    record_date: form.record_date,
    duration_minutes: form.duration_minutes,
    activity_type: form.activity_type,
    description: form.description,
    proof_url: proofUrl.value,
  })
  return current !== initialSnapshot.value
})

const isEdit = computed(() => !!props.record?.id)

interface OfflineForm {
  title: string
  record_date: string
  duration_minutes: number
  activity_type: OfflineActivityType
  description: string
}

const form = reactive<OfflineForm>({
  title: '',
  record_date: new Date().toISOString().slice(0, 10),
  duration_minutes: 30,
  activity_type: 'self_study',
  description: '',
})

const rules: FormRules = {
  title: [{ required: true, message: t('edu.profile.offlineTitleField'), trigger: 'blur' }],
  record_date: [{ required: true, message: t('edu.profile.offlineDate'), trigger: 'change' }],
  duration_minutes: [{ required: true, message: t('edu.profile.offlineDuration'), trigger: 'change' }],
  activity_type: [{ required: true, message: t('edu.profile.offlineActivityType'), trigger: 'change' }],
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.record) {
        form.title = props.record.title || ''
        form.record_date = props.record.record_date || new Date().toISOString().slice(0, 10)
        form.duration_minutes = props.record.duration_minutes || 30
        form.activity_type = props.record.activity_type || 'self_study'
        form.description = props.record.description || ''
        proofUrl.value = props.record.proof_url || ''
        fileList.value = proofUrl.value
          ? [{ name: 'proof', url: proofUrl.value, uid: Date.now() } as UploadFile]
          : []
      } else {
        resetForm()
      }
      // PR-F F4：回填后立即快照
      initialSnapshot.value = JSON.stringify({
        title: form.title,
        record_date: form.record_date,
        duration_minutes: form.duration_minutes,
        activity_type: form.activity_type,
        description: form.description,
        proof_url: proofUrl.value,
      })
      // PR-F F7：Dialog 打开后自动聚焦第一个表单项
      nextTick(() => {
        const input = formRef.value?.$el?.querySelector('input') as HTMLInputElement | null
        input?.focus()
      })
    }
  }
)

function resetForm() {
  form.title = ''
  form.record_date = new Date().toISOString().slice(0, 10)
  form.duration_minutes = 30
  form.activity_type = 'self_study'
  form.description = ''
  proofUrl.value = ''
  fileList.value = []
  formRef.value?.clearValidate()
}

function handleFileChange(file: UploadFile) {
  // PR-F F5：接入 utils/fileValidation.ts 统一校验
  const raw = file.raw
  if (raw) {
    const result = validateFile(raw, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
      maxSize: 10 * 1024 * 1024, // 10MB
    })
    if (!result.valid) {
      ElMessage.error(result.errors[0] || t('edu.profile.uploadFailed'))
      return
    }
  }
  fileList.value = [file]
  proofUrl.value = file.url || ''
}

function handleFileRemove() {
  fileList.value = []
  proofUrl.value = ''
}

function handleCancel() {
  void confirmClose(() => emit('update:visible', false))
}

// PR-F F4：el-dialog before-close 钩子
async function handleBeforeClose(done: () => void) {
  const ok = await confirmDirty()
  if (ok) done()
}

async function confirmDirty(): Promise<boolean> {
  if (!isDirty.value) return true
  try {
    await ElMessageBox.confirm(t('edu.profile.dirtyConfirm'), t('edu.profile.cancel'), {
      type: 'warning',
      confirmButtonText: t('edu.profile.discard'),
      cancelButtonText: t('edu.profile.keepEditing'),
    })
    return true
  } catch {
    return false
  }
}

function confirmClose(close: () => void) {
  confirmDirty().then((ok) => {
    if (ok) close()
  })
}

async function handleSubmit() {
  if (!formRef.value || submitting.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    submitting.value = true
    try {
      const payload: OfflineRecordCreate = {
        title: form.title.trim(),
        record_date: form.record_date,
        duration_minutes: form.duration_minutes,
        activity_type: form.activity_type,
        description: form.description.trim() || undefined,
        proof_url: proofUrl.value || undefined,
      }

      if (isEdit.value && props.record) {
        await offlineRecordsApi.update(props.record.id, payload)
        ElMessage.success(t('edu.profile.submit') + ' ✓')
      } else {
        await offlineRecordsApi.create(payload)
        ElMessage.success(t('edu.profile.submit') + ' ✓')
      }
      emit('success')
      emit('update:visible', false)
    } catch (e) {
      console.error('[OfflineRecordDialog] submit failed', e)
      ElMessage.error(t('edu.profile.uploadFailed'))
    } finally {
      submitting.value = false
    }
  })
}
</script>

<style scoped lang="scss">
.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.unit-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
