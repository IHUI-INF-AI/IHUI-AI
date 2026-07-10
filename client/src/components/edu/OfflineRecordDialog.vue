<template>
  <Dialog
    ref="dialogRef"
    :model-value="visible"
    width="560px"
    :close-on-click-overlay="false"
    @update:model-value="emit('update:visible', $event)"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEdit ? t('edu.profile.editOffline') : t('edu.profile.createOffline') }}</DialogTitle>
      </DialogHeader>
      <form ref="formRef" @submit.prevent>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">{{ t('edu.profile.offlineTitleField') }}</label>
        <div class="flex-1">
          <Input
            v-model="form.title"
            :placeholder="t('edu.profile.offlineTitleField')"
            maxlength="100"
          />
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">{{ t('edu.profile.offlineDate') }}</label>
        <div class="flex-1">
          <Input
            type="date"
            v-model="form.record_date"
            :placeholder="t('edu.profile.offlineDate')"
            style="width: 100%"
          />
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">{{ t('edu.profile.offlineDuration') }}</label>
        <div class="flex-1">
          <Input
            type="number"
            v-model="form.duration_minutes"
            :min="1"
            :max="1440"
            :step="15"
            style="width: 180px"
          />
          <span class="unit-suffix">{{ t('edu.profile.minutes') }}</span>
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">{{ t('edu.profile.offlineActivityType') }}</label>
        <div class="flex-1">
          <Select v-model="form.activity_type" style="width: 100%">
            <SelectOption :label="t('edu.profile.activityTraining')" value="training" />
            <SelectOption :label="t('edu.profile.activitySelfStudy')" value="self_study" />
            <SelectOption :label="t('edu.profile.activityPractice')" value="practice" />
            <SelectOption :label="t('edu.profile.activityReading')" value="reading" />
            <SelectOption :label="t('edu.profile.activityOther')" value="other" />
          </Select>
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">{{ t('edu.profile.offlineDescription') }}</label>
        <div class="flex-1">
          <Textarea
            v-model="form.description"
            :rows="3"
            :placeholder="t('edu.profile.offlineDescription')"
            maxlength="500"
          />
        </div>
      </div>

      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">{{ t('edu.profile.offlineProof') }}</label>
        <div class="flex-1">
          <div class="space-y-2">
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onFileInputChange"
            />
            <Button variant="outline" className="" @click="fileInputRef?.click()"><Paperclip />{{ t('edu.profile.selectFile') }}</Button>
            <div v-if="fileList.length" class="space-y-1">
              <div v-for="(file, index) in fileList" :key="index" class="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span class="truncate">{{ file.name }}</span>
                <button type="button" class="text-muted-foreground hover:text-foreground" @click="handleFileRemove">×</button>
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
import {
  offlineRecordsApi,
  type OfflineRecord,
  type OfflineRecordCreate,
  type OfflineActivityType,
} from '@/api/edu/offline-records'
import { validateFile } from '@/utils/fileValidation'
import { Select, SelectOption } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  record?: OfflineRecord | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const formRef = useFormRef()
const submitting = ref(false)
const fileList = ref<any[]>([])
const proofUrl = ref('')

// PR-F F7：焦点陷阱（Dialog 打开记录触发元素、Tab 循环、关闭还原焦点）
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

const rules: Record<string, any> = {
  title: [{ required: true, message: t('edu.profile.offlineTitleField'), trigger: 'blur' }],
  record_date: [{ required: true, message: t('edu.profile.offlineDate'), trigger: 'change' }],
  duration_minutes: [{ required: true, message: t('edu.profile.offlineDuration'), trigger: 'change' }],
  activity_type: [{ required: true, message: t('edu.profile.offlineActivityType'), trigger: 'change' }],
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      // PR-F F7：记录触发元素 + 注册 Tab 焦点陷阱
      triggerEl.value = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', onKeydown)
      if (props.record) {
        form.title = props.record.title || ''
        form.record_date = props.record.record_date || new Date().toISOString().slice(0, 10)
        form.duration_minutes = props.record.duration_minutes || 30
        form.activity_type = props.record.activity_type || 'self_study'
        form.description = props.record.description || ''
        proofUrl.value = props.record.proof_url || ''
        fileList.value = proofUrl.value
          ? [{ name: 'proof', url: proofUrl.value, uid: Date.now() } as any]
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
    } else {
      // PR-F F7：Dialog 关闭后移除监听并还原焦点到触发元素
      window.removeEventListener('keydown', onKeydown)
      nextTick(() => triggerEl.value?.focus())
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
  formRef.value?.clearValidate?.()
}

function handleFileChange(file: any) {
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

const fileInputRef = ref<HTMLInputElement | null>(null)
function onFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []
  target.value = ''
  if (!files.length) return
  const f = files[0]
  handleFileChange({ raw: f, name: f.name, url: '', uid: Date.now() } as any)
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
  await formRef.value?.validate?.(async (valid: boolean) => {
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
        await offlineRecordsApi.update(props.record.id!, payload)
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
  color: hsl(var(--muted-foreground));
  margin-top: 4px;
}

.unit-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}
</style>
