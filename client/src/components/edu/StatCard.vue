<script setup lang="ts">
defineProps<{ title?: string; value?: string | number }>()
</script>

<template>
  <div class="stat-card">
    <slot />
  </div>
</template>
