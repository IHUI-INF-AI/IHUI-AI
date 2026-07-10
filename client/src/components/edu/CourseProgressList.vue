<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="course-progress-list">
    <slot />
  </div>
</template>
