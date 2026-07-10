<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ name: 'Uplaod', inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  files: { type: Array as any, default: () => [] },
  uploadUrl: { type: String, default: '' },
  action: { type: String, default: '' },
  accept: { type: String, default: 'image/*' },
  limit: { type: Number, default: 1 },
  onUploadSuccess: { type: Function, default: null },
  onUploadRemove: { type: Function, default: null },
  headers: { type: Object as any, default: () => ({}) },
  name: { type: String, default: 'file' },
  maxSize: { type: Number, default: 7 * 1024 * 1024 },
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:files': [files: any[]]
  success: [response: any, file: any]
  error: [error: any]
  remove: [file: any, index: number]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const errorMsg = ref('')

const innerFiles = computed<any[]>(() => props.files || [])
const endpoint = computed(() => props.action || props.uploadUrl)

const triggerSelect = () => {
  errorMsg.value = ''
  if (innerFiles.value.length >= props.limit) return
  inputRef.value?.click()
}

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const fileList = target.files
  if (!fileList || fileList.length === 0) return

  const remaining = props.limit - innerFiles.value.length
  const files = Array.from(fileList).slice(0, remaining)

  target.value = ''

  for (const file of files) {
    if (file.size > props.maxSize) {
      errorMsg.value = `文件 ${file.name} 超过大小限制`
      continue
    }
    await uploadFile(file)
  }
}

const uploadFile = (file: File) => {
  if (!endpoint.value) {
    const url = URL.createObjectURL(file)
    const item = { name: file.name, url }
    const list = [...innerFiles.value, item]
    emit('update:files', list)
    if (props.limit === 1) emit('update:modelValue', url)
    emit('success', { url }, item)
    props.onUploadSuccess?.(item, { url })
    return Promise.resolve()
  }

  uploading.value = true
  const formData = new FormData()
  formData.append(props.name, file)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', endpoint.value, true)
  Object.keys(props.headers || {}).forEach((key) => {
    xhr.setRequestHeader(key, props.headers[key])
  })

  return new Promise<void>((resolve) => {
    xhr.onload = () => {
      uploading.value = false
      if (xhr.status >= 200 && xhr.status < 300) {
        let res: any = xhr.responseText
        try {
          res = JSON.parse(xhr.responseText)
        } catch {
          /* keep raw text */
        }
        const url = (res && (res.url || res.data?.url || res.data)) || ''
        const item = { name: file.name, url }
        const list = [...innerFiles.value, item]
        emit('update:files', list)
        if (props.limit === 1) emit('update:modelValue', url)
        emit('success', res, item)
        props.onUploadSuccess?.(item, res)
      } else {
        errorMsg.value = `上传失败：${xhr.status}`
        emit('error', new Error(`上传失败：${xhr.status}`))
      }
      resolve()
    }
    xhr.onerror = () => {
      uploading.value = false
      errorMsg.value = '网络错误，上传失败'
      emit('error', new Error('网络错误'))
      resolve()
    }
    xhr.send(formData)
  })
}

const removeFile = (index: number) => {
  const file = innerFiles.value[index]
  const list = innerFiles.value.filter((_, i) => i !== index)
  emit('update:files', list)
  if (props.limit === 1) {
    emit('update:modelValue', list.length > 0 ? list[list.length - 1].url : '')
  }
  emit('remove', file, index)
  props.onUploadRemove?.(file, index)
}
</script>

<template>
  <div :class="cn('inline-block', $attrs.class as any)" :style="($attrs.style as any)">
    <div class="flex flex-wrap items-center gap-2">
      <div
        v-for="(file, index) in innerFiles"
        :key="index"
        class="group relative h-24 w-24 overflow-hidden rounded-md border border-input bg-muted"
      >
        <img v-if="file.url" :src="file.url" :alt="file.name" class="h-full w-full object-cover" />
        <div v-else class="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{{ file.name }}</div>
        <button
          type="button"
          class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
          @click="removeFile(index)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <button
        v-if="innerFiles.length < limit"
        type="button"
        class="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        :disabled="uploading"
        @click="triggerSelect"
      >
        <svg v-if="uploading" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
        <span class="text-xs">{{ uploading ? '上传中' : '点击上传' }}</span>
      </button>
    </div>

    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      class="hidden"
      @change="onFileChange"
    />

    <p v-if="errorMsg" class="mt-1 text-xs text-destructive">{{ errorMsg }}</p>
  </div>
</template>
