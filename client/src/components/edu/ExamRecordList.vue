<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="exam-record-list">
    <slot />
  </div>
</template>
