<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? t('edu.profile.editNote') : t('edu.profile.createNote')"
    width="640px"
    :close-on-click-modal="false"
    append-to-body
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
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { Paperclip } from '@element-plus/icons-vue'
import { notesApi, type LearningNote, type LearningNoteCreate } from '@/api/edu/notes'

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
  emit('update:visible', false)
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
