<script setup lang="ts">
defineProps<{ data?: any[] }>()
</script>

<template>
  <div class="category-pie-chart">
    <slot />
  </div>
</template>
