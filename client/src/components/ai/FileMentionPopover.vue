<template>
  <div class="file-mention-popover" @click.stop>
    <!-- 搜索输入 -->
    <div class="file-mention-popover__input-wrapper">
      <span class="file-mention-popover__prompt">@</span>
      <input
        ref="inputRef"
        v-model="filter"
        type="text"
        class="file-mention-popover__input"
        :placeholder="t('floatingChat.workspaceAgent.fileMention.searchPlaceholder', '输入文件名搜索…')"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
        @keydown.enter.prevent="commitSelection"
        @keydown.esc.prevent="cancel"
      />
    </div>

    <!-- 文件列表 -->
    <ul v-if="results.length > 0" class="file-mention-popover__list" role="listbox">
      <li
        v-for="(path, idx) in results"
        :key="path"
        class="file-mention-popover__item"
        :class="{ 'is-selected': idx === selectedIndex }"
        role="option"
        :aria-selected="idx === selectedIndex"
        :title="path"
        @click="selectFile(path)"
        @mouseenter="selectedIndex = idx"
      >
        <el-icon class="file-mention-popover__file-icon"><Document /></el-icon>
        <div class="file-mention-popover__item-main">
          <span class="file-mention-popover__name">{{ fileName(path) }}</span>
          <span class="file-mention-popover__dir">{{ dirName(path) }}</span>
        </div>
      </li>
    </ul>

    <!-- 空状态 -->
    <div v-else class="file-mention-popover__empty">
      <span v-if="loading">{{ t('common.loading', '加载中…') }}</span>
      <span v-else>{{ filter ? t('floatingChat.workspaceAgent.fileMention.noResults', '无匹配文件') : t('floatingChat.workspaceAgent.fileMention.typeToSearch', '输入关键词搜索文件') }}</span>
    </div>

    <!-- 操作提示 -->
    <div class="file-mention-popover__hint">
      <kbd>↑↓</kbd> {{ t('floatingChat.workspaceAgent.slashPalette.navigate', '导航') }}
      <kbd>Enter</kbd> {{ t('floatingChat.workspaceAgent.slashPalette.select', '选择') }}
      <kbd>Esc</kbd> {{ t('floatingChat.workspaceAgent.slashPalette.cancel', '取消') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElIcon } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import { searchFiles } from '@/api/services/workspace.service'

const { t } = useI18n()

interface Props {
  workspacePath: string
  initialQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialQuery: '',
})

const emit = defineEmits<{
  select: [path: string]
  cancel: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const filter = ref(props.initialQuery)
const results = ref<string[]>([])
const selectedIndex = ref(0)
const loading = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const visibleResults = computed(() => results.value)

/** 防抖搜索工作区文件 */
async function doSearch(query: string): Promise<void> {
  if (!props.workspacePath) {
    results.value = []
    return
  }
  loading.value = true
  try {
    const files = await searchFiles(props.workspacePath, query, 30)
    results.value = files
    selectedIndex.value = 0
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

/** 防抖包装 */
function scheduleSearch(query: string): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void doSearch(query)
  }, 180)
}

watch(() => filter.value, (val: string) => {
  scheduleSearch(val)
})

function moveSelection(delta: number): void {
  if (visibleResults.value.length === 0) return
  const len = visibleResults.value.length
  selectedIndex.value = (selectedIndex.value + delta + len) % len
  scrollIntoView()
}

function commitSelection(): void {
  const path = visibleResults.value[selectedIndex.value]
  if (path) {
    selectFile(path)
  } else {
    cancel()
  }
}

function selectFile(path: string): void {
  emit('select', path)
}

function cancel(): void {
  emit('cancel')
}

function scrollIntoView(): void {
  nextTick(() => {
    const el = document.querySelector('.file-mention-popover__item.is-selected') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function fileName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

function dirName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return ''
  return normalized.substring(0, idx)
}

onMounted(() => {
  nextTick(() => {
    inputRef.value?.focus()
    // 将光标移到末尾
    if (inputRef.value) {
      const len = inputRef.value.value.length
      inputRef.value.setSelectionRange(len, len)
    }
  })
  // 初始搜索
  void doSearch(filter.value)
})
</script>

<style lang="scss" scoped>
.file-mention-popover {
  width: 100%;
  max-width: 460px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px; // 用户偏好: 8px 圆角
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); // 无蓝色发光, 仅柔和投影
  overflow: hidden;
  font-size: 13px;
  z-index: calc(var(--z-base, 1) + 50);

  &__input-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-light);
  }

  &__prompt {
    color: var(--el-color-primary);
    font-weight: 600;
    font-size: 14px;
    flex-shrink: 0;
  }

  &__input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: var(--el-text-color-primary);
    padding: 2px 0;

    &::placeholder {
      color: var(--el-text-color-placeholder);
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    max-height: 260px;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background-color 0.15s ease; // 平滑过渡
    border-bottom: 1px solid var(--el-border-color-extra-light);

    &:last-child {
      border-bottom: none;
    }

    &:hover,
    &.is-selected {
      // hover 用低对比度背景区分容器 (与 sidebar 按钮描边色一致)
      background: var(--el-fill-color-light);
    }
  }

  &__file-icon {
    flex-shrink: 0;
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }

  &__item-main {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  &__name {
    color: var(--el-text-color-primary);
    font-weight: 500;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }

  &__dir {
    color: var(--el-text-color-secondary);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }

  &__empty {
    padding: 16px 12px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-placeholder);
    font-size: 11px;

    kbd {
      display: inline-flex;
      align-items: center;
      padding: 1px 5px;
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      background: var(--el-bg-color);
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 10px;
      color: var(--el-text-color-regular);
    }
  }
}

// 暗色模式: 背景更黑
:where(html.dark) {
  .file-mention-popover {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);

    &__item:hover,
    &__item.is-selected {
      background: var(--el-fill-color-dark);
    }

    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
}
</style>
