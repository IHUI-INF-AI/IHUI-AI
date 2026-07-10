<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="certificate-list">
    <slot />
  </div>
</template>
