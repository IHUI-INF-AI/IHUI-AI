<script setup lang="ts">
defineProps<{ title?: string; content?: string }>()
</script>

<template>
  <div class="ai-report-section">
    <slot />
  </div>
</template>
