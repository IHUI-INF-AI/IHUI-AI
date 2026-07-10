<script setup lang="ts">
defineProps<{ version1?: string; version2?: string }>()
</script>

<template>
  <div class="version-diff">
    <slot />
  </div>
</template>
