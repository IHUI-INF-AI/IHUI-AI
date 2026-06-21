<template>
  <div v-if="visible" class="loading" :class="{ 'loading-full': fullscreen }">
    <div class="loading-spinner">
      <div class="spinner-item"></div>
      <div class="spinner-item"></div>
      <div class="spinner-item"></div>
    </div>
    <span class="loading-text" v-if="text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text?: string
  fullscreen?: boolean
  visible?: boolean
  lock?: boolean
}>()
</script>

<style scoped lang="scss">
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;

  &.loading-full {
    position: fixed;
    inset: 0;
    background-color: var(--color-white-80);
    z-index: var(--z-sticky);
  }

  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;

    .spinner-item {
      width: 0.2rem;
      height: 0.2rem;
      background-color: var(--el-color-primary);
      border-radius: var(--global-border-radius);
      margin: 0 0.06rem;
      animation: loading 1.4s infinite ease-in-out;

      &:nth-child(1) {
        animation-delay: -0.32s;
      }

      &:nth-child(2) {
        animation-delay: -0.16s;
      }
    }
  }

  .loading-text {
    font-size: 0.28rem;
    color: var(--el-text-color-regular);
    margin-top: 0.2rem;
  }
}

@keyframes loading {
  0%,
  80%,
  100% {
    transform: scale(0);
  }

  40% {
    transform: scale(1);
  }
}
</style>
