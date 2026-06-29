<template>
  <div class="page-indicator">
    <div
      v-for="index in totalPages"
      :key="index"
      class="indicator-dot"
      :class="{ active: currentPage === index - 1 }"
      @click="scrollToPage(index - 1)"
      :title="String(index)"
    ></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number
  totalPages: number
  scrollToPage: (index: number) => void
}

defineProps<Props>()
</script>

<style scoped>
.page-indicator {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: var(--z-dropdown);
  pointer-events: auto;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--global-border-radius);
  background-color: var(--el-text-color-placeholder);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.indicator-dot:hover {
  background-color: var(--el-text-color-secondary);
  transform: scale(1.2);
}

.indicator-dot:active {
  transform: scale(1.6);
  transition: transform 0.1s ease;
}

.indicator-dot.active {
  width: 8px;
  height: 24px;
  border-radius: var(--global-border-radius);
  background-color: var(--el-text-color-primary);
  box-shadow: none;
}

.indicator-dot.active:active {
  transform: scale(1.2);
  transition: transform 0.1s ease;
}

@media (width <= 768px) {
  .page-indicator {
    display: none;
  }
}
</style>
