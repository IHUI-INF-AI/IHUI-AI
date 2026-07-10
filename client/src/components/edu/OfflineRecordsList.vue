<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="offline-records-list">
    <slot />
  </div>
</template>
