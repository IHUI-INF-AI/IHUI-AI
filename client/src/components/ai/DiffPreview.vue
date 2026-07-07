<template>
  <div class="diff-preview">
    <!-- 头部：文件名 + 统计 -->
    <div class="diff-preview__header">
      <div class="diff-preview__file-info">
        <el-icon class="diff-preview__file-icon"><Document /></el-icon>
        <span class="diff-preview__file-name" :title="fileName">{{ fileName }}</span>
      </div>
      <div class="diff-preview__stats">
        <el-tag type="success" size="small" effect="light">
          +{{ stats.added }}
        </el-tag>
        <el-tag type="danger" size="small" effect="light">
          -{{ stats.removed }}
        </el-tag>
      </div>
    </div>

    <!-- 统一 Diff 视图 -->
    <div v-if="diffLines.length > 0" class="diff-preview__body">
      <div
        v-for="(line, index) in diffLines"
        :key="index"
        class="diff-preview__line"
        :class="`diff-preview__line--${line.type}`"
      >
        <span class="diff-preview__line-number diff-preview__line-number--old">{{ line.oldLineNumber }}</span>
        <span class="diff-preview__line-number diff-preview__line-number--new">{{ line.newLineNumber }}</span>
        <span class="diff-preview__line-prefix">{{ line.prefix }}</span>
        <span class="diff-preview__line-content">{{ line.content }}</span>
      </div>
    </div>
    <div v-else class="diff-preview__empty">
      {{ t('floatingChat.workspaceAgent.diffPreview.noChanges') }}
    </div>

    <!-- 操作按钮 -->
    <div v-if="diffLines.length > 0" class="diff-preview__actions">
      <el-button type="primary" size="small" @click="handleApply">
        {{ t('floatingChat.workspaceAgent.diffPreview.apply') }}
      </el-button>
      <el-button size="small" @click="handleReject">
        {{ t('floatingChat.workspaceAgent.diffPreview.reject') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Document } from '@/lib/lucide-fallback'

const { t } = useI18n()

interface Props {
  /** 旧内容 */
  oldContent: string
  /** 新内容 */
  newContent: string
  /** 文件名 */
  fileName: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  apply: [payload: { fileName: string; newContent: string }]
  reject: [payload: { fileName: string }]
}>()

interface DiffLine {
  type: 'added' | 'removed' | 'context'
  prefix: string
  content: string
  oldLineNumber: number | string
  newLineNumber: number | string
}

/**
 * 基于 LCS 的简单 diff 算法
 * 计算 oldLines 和 newLines 的最长公共子序列，
 * 然后生成统一 diff 格式的行列表
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.length > 0 ? oldText.split('\n') : []
  const newLines = newText.length > 0 ? newText.split('\n') : []

  const m = oldLines.length
  const n = newLines.length

  // 构建 LCS 表
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }

  // 回溯生成 diff 行
  const result: DiffLine[] = []
  let i = m
  let j = n

  // 临时收集，后续反转
  const tempLines: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // 上下文行（共同行）
      tempLines.push({
        type: 'context',
        prefix: ' ',
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      // 新增行（仅存在于 newLines）
      tempLines.push({
        type: 'added',
        prefix: '+',
        content: newLines[j - 1],
        oldLineNumber: '',
        newLineNumber: j,
      })
      j--
    } else if (i > 0) {
      // 删除行（仅存在于 oldLines）
      tempLines.push({
        type: 'removed',
        prefix: '-',
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: '',
      })
      i--
    }
  }

  // 反转为正序
  tempLines.reverse()

  // 添加上下文窗口（只显示变更行附近 3 行上下文，类似 git diff）
  const contextSize = 3
  const changeIndexes: number[] = []
  tempLines.forEach((line, idx) => {
    if (line.type !== 'context') {
      changeIndexes.push(idx)
    }
  })

  if (changeIndexes.length === 0) {
    return []
  }

  // 计算需要显示的行范围
  const showRanges: Array<{ start: number; end: number }> = []
  for (const idx of changeIndexes) {
    const start = Math.max(0, idx - contextSize)
    const end = Math.min(tempLines.length - 1, idx + contextSize)
    // 尝试合并到上一个范围
    if (showRanges.length > 0 && start <= showRanges[showRanges.length - 1].end + 1) {
      showRanges[showRanges.length - 1].end = end
    } else {
      showRanges.push({ start, end })
    }
  }

  // 生成最终 diff（在范围之间插入分隔标记）
  let rangeIndex = 0
  for (let k = 0; k < tempLines.length; k++) {
    if (rangeIndex < showRanges.length) {
      const range = showRanges[rangeIndex]
      if (k >= range.start && k <= range.end) {
        result.push(tempLines[k])
      } else if (k > range.end) {
        rangeIndex++
        // 不添加额外的分隔标记，保持简洁
      }
    }
  }

  // 如果变更很少，直接返回所有行
  if (result.length === 0 && tempLines.length <= 50) {
    return tempLines
  }

  return result
}

const diffLines = computed<DiffLine[]>(() => {
  return computeDiff(props.oldContent, props.newContent)
})

const stats = computed(() => {
  let added = 0
  let removed = 0
  for (const line of diffLines.value) {
    if (line.type === 'added') added++
    else if (line.type === 'removed') removed++
  }
  return { added, removed }
})

function handleApply(): void {
  emit('apply', {
    fileName: props.fileName,
    newContent: props.newContent,
  })
}

function handleReject(): void {
  emit('reject', {
    fileName: props.fileName,
  })
}
</script>

<style lang="scss" scoped>
.diff-preview {
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__file-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__file-icon {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  &__file-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__stats {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  &__body {
    max-height: 480px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  &__line {
    display: flex;
    align-items: flex-start;
    padding: 0;
    white-space: pre-wrap;
    word-break: break-word;

    &--added {
      background-color: var(--el-color-success-light-9);

      .diff-preview__line-prefix,
      .diff-preview__line-content {
        color: var(--el-color-success-dark-2);
      }
    }

    &--removed {
      background-color: var(--el-color-danger-light-9);

      .diff-preview__line-prefix,
      .diff-preview__line-content {
        color: var(--el-color-danger-dark-2);
      }
    }

    &--context {
      background-color: transparent;

      .diff-preview__line-prefix,
      .diff-preview__line-content {
        color: var(--el-text-color-regular);
      }
    }
  }

  &__line-number {
    display: inline-block;
    width: 42px;
    min-width: 42px;
    padding: 0 4px;
    text-align: right;
    color: var(--el-text-color-placeholder);
    user-select: none;
    flex-shrink: 0;

    &--old {
      border-right: 1px solid var(--el-border-color-lighter);
    }

    &--new {
      border-right: 1px solid var(--el-border-color-lighter);
    }
  }

  &__line-prefix {
    display: inline-block;
    width: 16px;
    min-width: 16px;
    text-align: center;
    font-weight: 700;
    flex-shrink: 0;
    user-select: none;
  }

  &__line-content {
    flex: 1;
    padding-right: 8px;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--el-border-color-lighter);
    background-color: var(--el-fill-color-light);
  }
}

/* 暗色模式 */
:where(html.dark) {
  .diff-preview {
    &__line {
      &--added {
        background-color: var(--color-white-8);

        .diff-preview__line-prefix,
        .diff-preview__line-content {
          color: var(--el-color-success-light-3);
        }
      }

      &--removed {
        background-color: var(--color-white-8);

        .diff-preview__line-prefix,
        .diff-preview__line-content {
          color: var(--el-color-danger-light-3);
        }
      }

      &--context {
        .diff-preview__line-prefix,
        .diff-preview__line-content {
          color: var(--el-text-color-regular);
        }
      }
    }

    &__line-number {
      color: var(--el-text-color-placeholder);
    }
  }
}
</style>
