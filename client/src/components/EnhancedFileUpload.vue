<script setup lang="ts">
defineProps<{ accept?: string; multiple?: boolean; maxSize?: number }>()
const emit = defineEmits<{ (e: 'upload', file: File): void; (e: 'change', files: File[]): void }>()
defineExpose({ clear: () => {} })
</script>

<template>
  <div class="enhanced-file-upload">
    <slot />
  </div>
</template>
