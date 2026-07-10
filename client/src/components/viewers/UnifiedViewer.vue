<script setup lang="ts">
defineProps<{ file?: { url?: string; name?: string; type?: string } }>()
</script>

<template>
  <div class="unified-viewer">
    <slot />
  </div>
</template>
