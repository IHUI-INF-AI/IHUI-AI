<template>
  <Dialog
    ref="dialogRef"
    :model-value="visible"
    width="640px"
    :close-on-click-overlay="false"
    @update:model-value="emit('update:visible', $event)"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEdit ? t('edu.profile.editNote') : t('edu.profile.createNote') }}</DialogTitle>
      </DialogHeader>
      <form ref="formRef" @submit.prevent>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-24 shrink-0 text-sm">{{ t('edu.profile.noteTitle') }}</label>
        <div class="flex-1">
          <Input
            v-model="form.title"
            :placeholder="t('edu.profile.noteTitle')"
            maxlength="100"
          />
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-24 shrink-0 text-sm">{{ t('edu.profile.noteContent') }}</label>
        <div class="flex-1">
          <Textarea
            v-model="form.content"
            :rows="6"
            :placeholder="t('edu.profile.noteContent')"
            maxlength="2000"
          />
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-24 shrink-0 text-sm">{{ t('edu.profile.noteTags') }}</label>
        <div class="flex-1">
          <Input
            v-model="tagsInput"
            :placeholder="t('edu.profile.noteTagsHint')"
          />
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-24 shrink-0 text-sm">{{ t('edu.profile.noteVisibility') }}</label>
        <div class="flex-1">
          <Switch v-model="form.is_public" />
          <span class="text-sm text-muted-foreground">
            {{ form.is_public ? t('edu.profile.public') : t('edu.profile.private') }}
          </span>
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-24 shrink-0 text-sm">{{ t('edu.profile.noteAttachments') }}</label>
        <div class="flex-1">
          <div class="space-y-2">
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              multiple
              class="hidden"
              @change="onFileInputChange"
            />
            <Button variant="outline" className="" @click="fileInputRef?.click()"><Paperclip />{{ t('edu.profile.selectFile') }}</Button>
            <div v-if="fileList.length" class="space-y-1">
              <div v-for="(file, index) in fileList" :key="index" class="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span class="truncate">{{ file.name }}</span>
                <button type="button" class="text-muted-foreground hover:text-foreground" @click="handleFileRemove(file)">×</button>
              </div>
            </div>
            <div class="upload-hint">{{ t('edu.profile.fileTypeHint') }}</div>
          </div>
        </div>
      </div>
    </form>

      <DialogFooter>
        <Button variant="outline" className="" @click="handleCancel">{{ t('edu.profile.cancel') }}</Button>
        <Button variant="default" className="" :disabled="submitting" @click="handleSubmit">
          {{ t('edu.profile.submit') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useFormRef } from '@/composables/useFormRef'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from '@/utils/message'
import { Paperclip } from '@/lib/lucide-fallback'
import { notesApi, type LearningNote, type LearningNoteCreate } from '@/api/edu/notes'
import { validateFile } from '@/utils/fileValidation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  note?: LearningNote | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const formRef = useFormRef()
const submitting = ref(false)
const fileList = ref<any[]>([])
const attachments = ref<Array<{ url: string; name: string; type: 'image' | 'file' }>>([])

// PR-F F7：焦点陷阱（Dialog 打开记录触发元素、关闭还原焦点）
const triggerEl = ref<HTMLElement | null>(null)
const dialogRef = ref<{ $el?: HTMLElement } | null>(null)
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !dialogRef.value?.$el) return
  const focusable = dialogRef.value!.$el!.querySelectorAll<HTMLElement>(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

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

const rules: Record<string, any> = {
  title: [{ required: true, message: t('edu.profile.noteTitle'), trigger: 'blur' }],
  content: [{ required: true, message: t('edu.profile.noteContent'), trigger: 'blur' }],
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      // PR-F F7：记录触发元素 + 注册 Tab 焦点陷阱
      triggerEl.value = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', onKeydown)
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
        } as any))
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
      // PR-F F7：Dialog 打开后自动聚焦第一个表单项
      nextTick(() => {
        const input = formRef.value?.$el?.querySelector('input') as HTMLInputElement | null
        input?.focus()
      })
    } else {
      // PR-F F7：Dialog 关闭后移除监听并还原焦点到触发元素
      window.removeEventListener('keydown', onKeydown)
      nextTick(() => triggerEl.value?.focus())
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
  formRef.value?.clearValidate?.()
}

function handleFileChange(file: any) {
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

function handleFileRemove(file: any) {
  const idx = fileList.value.findIndex((f) => f.uid === file.uid)
  if (idx >= 0) fileList.value.splice(idx, 1)
  const aIdx = attachments.value.findIndex((a) => a.name === file.name)
  if (aIdx >= 0) attachments.value.splice(aIdx, 1)
}

const fileInputRef = ref<HTMLInputElement | null>(null)
function onFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []
  target.value = ''
  if (!files.length) return
  if (fileList.value.length + files.length > 3) {
    ElMessage.warning(t('edu.profile.fileTypeHint'))
    return
  }
  for (const f of files) {
    handleFileChange({ raw: f, name: f.name, url: '', uid: Date.now() + Math.random() } as any)
  }
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
  await formRef.value?.validate?.(async (valid: boolean) => {
    if (!valid) return
    submitting.value = true
    try {
      const tags = tagsInput.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      if (isEdit.value && props.note) {
        await notesApi.update(props.note.id!, {
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
  color: hsl(var(--muted-foreground));
  margin-top: 4px;
}
</style>
