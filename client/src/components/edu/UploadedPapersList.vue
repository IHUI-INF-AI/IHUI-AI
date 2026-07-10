<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="uploaded-papers-list">
    <slot />
  </div>
</template>
