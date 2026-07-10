<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="notes-list">
    <slot />
  </div>
</template>
