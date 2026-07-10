<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="learning-heatmap">
    <slot />
  </div>
</template>
