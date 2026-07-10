<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="skill-radar-chart">
    <slot />
  </div>
</template>
