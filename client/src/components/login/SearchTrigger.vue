<template>
  <div class="search-trigger-inline">
    <button
      class="search-trigger-button"
      type="button"
      :aria-label="$t('common.search')"
      @click="handleClick"
    >
      <div class="icon-container">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          fill="none"
          class="search-icon"
        >
          <circle r="8" cy="11" cx="11" />
          <line y2="16.65" y1="22" x2="16.65" x1="22" />
        </svg>
      </div>
      <div class="cmd-k-hint">
        <kbd>⌘</kbd>
        <kbd>K</kbd>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  isExpanded?: boolean
  isDarkMode?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  isDarkMode: false,
})

const emit = defineEmits<{
  toggle: []
}>()

const { t: _t } = useI18n()

const _iconColor = computed(() => {
  return 'currentColor'
})

const handleClick = () => {
  emit('toggle')
}
</script>

<style lang="scss" scoped>
// 内联搜索触发器 - 放在 header-right 最左侧
.search-trigger-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: transparent;
}

.search-trigger-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  margin: 0;
  background-color: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  outline: none;
  color: var(--el-text-color-primary);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  overflow: visible;
  /* 统一按钮高度，与其他 header 按钮对齐 */
  height: var(--header-action-height, 40px);
  min-height: var(--header-action-height, 40px);
  box-sizing: border-box;

  &:hover {
    background-color: var(--el-fill-color-light);
    transform: scale(1.06);

    .cmd-k-hint {
      width: 46px;
      opacity: 1;
      margin-left: 6px;
    }
  }

  &:active {
    transform: scale(0.98);
  }
}

// 图标容器
.icon-container {
  --icon-size: 16px;

  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-size);
  height: var(--icon-size);
  flex: 0 0 var(--icon-size);
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  background-color: transparent;
  border-radius: 0;
  line-height: 1;
}

.search-icon {
  display: block;
  flex-shrink: 0;
  transition: transform 0.2s ease;
  stroke: var(--el-text-color-primary);
  color: var(--el-text-color-primary);
  width: 16px;
  height: 16px;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

// cmd-k-hint - 默认隐藏，hover 时向右滑出
.cmd-k-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 20px;
  width: 0;
  opacity: 0;
  margin-left: 0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  white-space: nowrap;

  kbd {
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 600;
    background: var(--el-fill-color);
    color: var(--el-text-color-regular);
    padding: 2px 4px;
    border-radius: var(--global-border-radius-sm, 4px);
    border: none;
    min-width: 16px;
    height: 16px;
    line-height: 12px;
    text-align: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

// 移动端适配 - 隐藏整个组件
@media (width <= 767px) {
  .search-trigger-inline {
    display: none;
  }
}

// 亮色模式样式
html:not(.dark) {
  .search-trigger-button {
    color: var(--el-text-color-primary);
  }

  .search-icon {
    stroke: var(--el-text-color-primary);
  }

  .cmd-k-hint kbd {
    background: var(--el-fill-color);
    color: var(--el-text-color-regular);
  }
}

// 暗色模式样式
html.dark {
  .search-trigger-button {
    color: var(--el-text-color-primary);
  }

  .search-icon {
    stroke: var(--el-text-color-primary);
  }

  .cmd-k-hint kbd {
    background: var(--el-fill-color-dark);
    color: var(--el-text-color-regular);
  }

  .search-trigger-button:hover {
    background-color: var(--el-fill-color-dark);
  }
}
</style>
