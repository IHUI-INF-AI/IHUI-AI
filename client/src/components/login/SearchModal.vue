<template>
  <div class="search-modal">
    <div class="search-overlay" @click="handleClose"></div>

    <div class="search-popup" :class="{ 'dark-mode': isDarkMode }">
      <div class="search-popup-content unified-search-native-wrap">
        <svg
          class="search-input-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          fill="none"
        >
          <circle :stroke="iconColor" r="8" cy="11" cx="11" />
          <line :stroke="iconColor" y2="16.65" y1="22" x2="16.65" x1="22" />
        </svg>

        <input
          ref="searchInput"
          link
          class="search-input"
          :placeholder="$t('common.search')"
          @keydown.esc="handleClose"
        />

        <div
          class="search-close-button"
          :aria-label="$t('common.close')"
          @click="handleClose"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            fill="none"
          >
            <line :stroke="iconColor" x1="18" y1="6" x2="6" y2="18" />
            <line :stroke="iconColor" x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'

interface Props {
  isDarkMode?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  isDarkMode: false,
})

const emit = defineEmits<{
  close: []
}>()

const searchInput = ref<HTMLInputElement | null>(null)

const iconColor = computed(() => {
  return 'var(--el-text-color-regular)'
})

const handleClose = () => {
  emit('close')
}

onMounted(() => {
  nextTick(() => {
    searchInput.value?.focus()
  })
})
</script>

<style scoped lang="scss">
.search-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-loading);
}

.search-overlay {
  position: absolute;
  inset: 0;
  background-color: var(--color-black-30);
  animation: fadeIn 0.2s ease;
  cursor: pointer;
}

.search-popup {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-popup-content {
  min-width: 400px;
  max-width: 90vw;
  height: 60px;
  box-shadow: var(--global-box-shadow);
}

html.dark .search-popup-content {
  box-shadow: var(--global-box-shadow);
}

.search-input-icon {
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
}

.search-close-button {
  width: 32px;
  height: 32px;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background-color: var(--el-bg-color-hover);

    svg {
      transform: scale(1.1) rotate(90deg);
    }
  }

  svg {
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }
}

html:not(.dark) .search-input-icon {
  color: var(--el-text-color-primary);
}

html:not(.dark) .search-close-button svg {
  stroke: var(--el-text-color-primary);
}

html.dark .search-input-icon {
  color: var(--color-gray-8d9095);
}

html.dark .search-close-button svg {
  stroke: var(--color-gray-cfd3dc);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
