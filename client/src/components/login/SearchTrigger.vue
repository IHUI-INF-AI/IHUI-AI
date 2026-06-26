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
  transition: background-color 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), outline 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), outline-offset 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  overflow: visible;

  // 合并亮/暗模式：用语义化 token 即可在不同主题下自动适配
  // - hover 背景：var(--el-fill-color-light)（亮色 #fafafa / 暗色 #2d2d2d）
  // - kbd 背景：var(--el-fill-color)（亮色 #f0f2f5 / 暗色 #3d3d3d）
  // - 描边/分隔：var(--unified-border)
  &:hover {
    background-color: var(--el-fill-color-light);
    transform: scale(1.06);

    // 展开 cmd-k-hint（按钮在 hover 时"拉开"）
    :deep(.cmd-k-hint) {
      width: 46px;
      opacity: 1;
      margin-left: 6px;
    }
  }

  &:active {
    transform: scale(0.98);
  }

  // 键盘焦点可达性：focus-visible 仅在键盘聚焦时显示
  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
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
  transition: width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), margin-left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  white-space: nowrap;

  // 关键修复：scoped 样式默认无法穿透到 slot 内容或子组件根节点
  // 使用 :deep() 包裹 kbd 选择器,确保样式真正作用到 kbd 元素上
  // 亮/暗色合并：使用 var(--el-fill-color) 自动适配
  //   - 亮色: --color-gray-f0f2f5 (#f0f2f5 浅灰)
  //   - 暗色: --color-dark-bg-7 (#3d3d3d 深灰)
  :deep(kbd) {
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 600;
    background-color: var(--el-fill-color);
    color: var(--el-text-color-regular);
    padding: 2px 4px;
    border-radius: var(--global-border-radius);
    border: none;
    min-width: 16px;
    height: 16px;
    line-height: 12px;
    text-align: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-style: normal;
  }
}

// 移动端适配 - 隐藏整个组件
@media (width <= 767px) {
  .search-trigger-inline {
    display: none;
  }
}

/* ============================================
 * 高对比度模式适配
 * 用 :where() 降特异性,不与正常主题样式冲突
 * 关键:
 *   - 高对比度模式下按钮必须始终带 1px 描边以保证可见性
 *   - hover 背景用 var(--el-fill-color-light) 自动适配高对比度色
 * ============================================ */
:where(html.high-contrast-light) .search-trigger-button,
:where(html.high-contrast-dark) .search-trigger-button {
  border: 1px solid var(--el-text-color-primary);

  &:hover {
    background-color: var(--el-fill-color-light);
  }
}
</style>
