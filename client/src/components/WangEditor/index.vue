<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ name: 'WangEditor', inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请输入内容' },
  height: { type: [Number, String] as any, default: 300 },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  blur: [event: FocusEvent]
}>()

const editorStyle = computed(() => ({
  minHeight: typeof props.height === 'number' ? `${props.height}px` : props.height,
}))

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  emit('change', target.value)
}
</script>

<template>
  <div :class="cn('w-full overflow-hidden rounded-md border border-input bg-background', $attrs.class as any)" :style="($attrs.style as any)">
    <div class="flex items-center gap-1 border-b border-input bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
      <span class="px-1 py-0.5">B</span>
      <span class="px-1 py-0.5 italic">I</span>
      <span class="px-1 py-0.5 underline">U</span>
      <span class="ml-auto">富文本编辑</span>
    </div>
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :style="editorStyle"
      class="block w-full resize-y bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @input="onInput"
      @blur="(e) => emit('blur', e)"
    />
  </div>
</template>
