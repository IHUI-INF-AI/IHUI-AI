<template>
  <ElCheckbox v-model="checked" @change="handleChange">
    <slot></slot>
  </ElCheckbox>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElCheckbox } from 'element-plus'

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

const handleChange = (val: boolean) => {
  emit('update:modelValue', val)
  emit('change', val)
}
</script>

<style scoped>
/* 可以根据需要添加自定义样式 */
</style>
