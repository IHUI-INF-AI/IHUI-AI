<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? t('edu.profile.editNote') : t('edu.profile.createNote')"
    width="640px"
    :close-on-click-modal="false"
    append-to-body
    :before-close="handleBeforeClose"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      label-position="right"
    >
      <el-form-item :label="t('edu.profile.noteTitle')" prop="title">
        <el-input
          v-model="form.title"
          :placeholder="t('edu.profile.noteTitle')"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('edu.profile.noteContent')" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="6"
          :placeholder="t('edu.profile.noteContent')"
          maxlength="2000"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('edu.profile.noteTags')">
        <el-input
          v-model="tagsInput"
          :placeholder="t('edu.profile.noteTagsHint')"
        />
      </el-form-item>

      <el-form-item :label="t('edu.profile.noteVisibility')">
        <el-switch
          v-model="form.is_public"
          :active-text="t('edu.profile.public')"
          :inactive-text="t('edu.profile.private')"
        />
      </el-form-item>

      <el-form-item :label="t('edu.profile.noteAttachments')">
        <el-upload
          :auto-upload="false"
          :limit="3"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :file-list="fileList"
          accept="image/*,.pdf,.doc,.docx"
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
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { Paperclip } from '@element-plus/icons-vue'
import { notesApi, type LearningNote, type LearningNoteCreate } from '@/api/edu/notes'
import { validateFile } from '@/utils/fileValidation'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  note?: LearningNote | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)
const fileList = ref<UploadFile[]>([])
const attachments = ref<Array<{ url: string; name: string; type: 'image' | 'file' }>>([])

// PR-F F4：dirty 检测（表单回填后快照，关闭前对比）
const initialSnapshot = ref('')
const isDirty = computed(() => {
  const current = JSON.stringify({
    title: form.title,
    content: form.content,
    is_public: form.is_public,
    tags: tagsInput.value,
    attachments: attachments.value,
  })
  return current !== initialSnapshot.value
})

const isEdit = computed(() => !!props.note?.id)

interface NoteForm {
  title: string
  content: string
  is_public: boolean
}

const form = reactive<NoteForm>({
  title: '',
  content: '',
  is_public: false,
})

const tagsInput = ref('')

const rules: FormRules = {
  title: [{ required: true, message: t('edu.profile.noteTitle'), trigger: 'blur' }],
  content: [{ required: true, message: t('edu.profile.noteContent'), trigger: 'blur' }],
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.note) {
        form.title = props.note.title || ''
        form.content = props.note.content || ''
        form.is_public = props.note.is_public ?? false
        tagsInput.value = (props.note.tags || []).join(', ')
        attachments.value = props.note.attachments ? [...props.note.attachments] : []
        fileList.value = attachments.value.map((a, i) => ({
          name: a.name,
          url: a.url,
          uid: Date.now() + i,
        } as UploadFile))
      } else {
        resetForm()
      }
      // PR-F F4：回填后立即快照（resetForm 后也要快照，否则新建态永远是 dirty）
      initialSnapshot.value = JSON.stringify({
        title: form.title,
        content: form.content,
        is_public: form.is_public,
        tags: tagsInput.value,
        attachments: attachments.value,
      })
    }
  }
)

function resetForm() {
  form.title = ''
  form.content = ''
  form.is_public = false
  tagsInput.value = ''
  attachments.value = []
  fileList.value = []
  formRef.value?.clearValidate()
}

function handleFileChange(file: UploadFile) {
  // PR-F F5：接入 utils/fileValidation.ts 统一校验
  const raw = file.raw
  if (raw) {
    const result = validateFile(raw, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      maxSize: 10 * 1024 * 1024, // 10MB
    })
    if (!result.valid) {
      ElMessage.error(result.errors[0] || t('edu.profile.uploadFailed'))
      return
    }
  }
  fileList.value.push(file)
  attachments.value.push({
    url: file.url || '',
    name: file.name,
    type: file.raw?.type?.startsWith('image/') ? 'image' : 'file',
  })
}

function handleFileRemove(file: UploadFile) {
  const idx = fileList.value.findIndex((f) => f.uid === file.uid)
  if (idx >= 0) fileList.value.splice(idx, 1)
  const aIdx = attachments.value.findIndex((a) => a.name === file.name)
  if (aIdx >= 0) attachments.value.splice(aIdx, 1)
}

function handleCancel() {
  void confirmClose(() => emit('update:visible', false))
}

// PR-F F4：el-dialog before-close 钩子（点击 X / 按 ESC / 点遮罩关闭时触发）
async function handleBeforeClose(done: () => void) {
  const ok = await confirmDirty()
  if (ok) done()
}

// 统一确认逻辑：dirty 时弹确认框，非 dirty 直接关闭
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
      const tags = tagsInput.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      if (isEdit.value && props.note) {
        await notesApi.update(props.note.id, {
          title: form.title.trim(),
          content: form.content.trim(),
          is_public: form.is_public,
          tags,
          attachments: attachments.value,
        })
        ElMessage.success(t('edu.profile.submit') + ' ✓')
      } else {
        const payload: LearningNoteCreate = {
          title: form.title.trim(),
          content: form.content.trim(),
          is_public: form.is_public,
          tags,
          attachments: attachments.value,
        }
        await notesApi.create(payload)
        ElMessage.success(t('edu.profile.submit') + ' ✓')
      }
      emit('success')
      emit('update:visible', false)
    } catch (e) {
      console.error('[NoteDialog] submit failed', e)
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
</style>
