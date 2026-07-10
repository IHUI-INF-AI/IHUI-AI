<script setup lang="ts">
defineProps<{ userId?: string }>()
</script>

<template>
  <div class="wrong-book-summary">
    <slot />
  </div>
</template>
