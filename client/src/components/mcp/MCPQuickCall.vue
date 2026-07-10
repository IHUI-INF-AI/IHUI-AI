<script setup lang="ts">
defineProps<{ toolName?: string }>()
</script>

<template>
  <div class="mcp-quick-call">
    <slot />
  </div>
</template>
