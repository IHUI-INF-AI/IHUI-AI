<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="learning-trend-chart">
    <slot />
  </div>
</template>
