<template>
  <label class="inline-flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      v-model="checked"
      @change="handleChange"
      class="h-4 w-4 rounded border-border text-primary focus:ring-ring"
    />
    <slot></slot>
  </label>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

const checked = ref(props.modelValue || false)

watch(
  () => props.modelValue,
  newVal => {
    if (newVal !== undefined) {
      checked.value = newVal
    }
  }
)

const handleChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).checked
  emit('update:modelValue', val)
  emit('change', val)
}
</script>
