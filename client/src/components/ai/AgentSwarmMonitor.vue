<script setup lang="ts">
defineProps<{ swarmId?: string }>()
</script>

<template>
  <div class="agent-swarm-monitor">
    <slot />
  </div>
</template>
