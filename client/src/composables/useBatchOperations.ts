/**
 * 批量操作 Composable
 * 提供批量选择、操作和管理功能
 */

import { ref, computed } from 'vue'
import { useOperationFeedback } from './useOperationFeedback'
import { useConfirmDialog } from './useConfirmDialog'
import { logger } from '@/utils/logger'

export interface BatchOperation<T> {
  /** 操作名称 */
  name: string
  /** 操作函数 */
  execute: (items: T[]) => Promise<void> | void
  /** 确认消息 */
  confirmMessage?: string
  /** 是否危险操作 */
  dangerous?: boolean
}

export interface BatchOperationsOptions<T> {
  /** 操作列表 */
  operations: BatchOperation<T>[]
  /** 是否多选 */
  multiple?: boolean
}

/**
 * 批量操作 Composable
 */
export function useBatchOperations<T extends { id?: string | number }>(
  options: BatchOperationsOptions<T>
) {
  const { operations: _operations, multiple = true } = options
  const { showSuccess, showError, showWarning } = useOperationFeedback()
  const { confirm } = useConfirmDialog()

  const selectedItems = ref<T[]>([])
  const isSelecting = ref(false)

  // 是否全选
  const isAllSelected = computed(() => {
    return false // 需要外部提供总列表来判断
  })

  // 选中数量
  const selectedCount = computed(() => selectedItems.value.length)

  // 是否有选中项
  const hasSelection = computed(() => selectedItems.value.length > 0)

  /**
   * 切换选择模式
   */
  const toggleSelectMode = () => {
    isSelecting.value = !isSelecting.value
    if (!isSelecting.value) {
      clearSelection()
    }
  }

  /**
   * 选择/取消选择项
   */
  const toggleSelection = (item: T) => {
    const index = selectedItems.value.findIndex(selected => selected.id === item.id)

    if (index !== -1) {
      selectedItems.value.splice(index, 1)
    } else {
      if (multiple) {
        selectedItems.value.push(item)
      } else {
        selectedItems.value = [item]
      }
    }
  }

  /**
   * 全选/取消全选
   */
  const toggleSelectAll = (allItems: T[]) => {
    if (selectedItems.value.length === allItems.length) {
      clearSelection()
    } else {
      selectedItems.value = [...allItems]
    }
  }

  /**
   * 清空选择
   */
  const clearSelection = () => {
    selectedItems.value = []
  }

  /**
   * 执行批量操作
   */
  const executeOperation = async (operation: BatchOperation<T>, items?: T[]) => {
    const targetItems = items || selectedItems.value

    if (targetItems.length === 0) {
      showWarning('请先选择要操作的项目')
      return false
    }

    // 确认操作
    if (operation.confirmMessage) {
      const confirmed = await confirm(
        operation.confirmMessage.replace('{count}', String(targetItems.length))
      )
      if (!confirmed) {
        return false
      }
    }

    try {
      await operation.execute(targetItems)
      showSuccess(`成功${operation.name} ${targetItems.length} 项`)
      clearSelection()
      return true
    } catch (error) {
      logger.error(`Batch ${operation.name} failed:`, error)
      showError(
        `批量${operation.name}失败: ${error instanceof Error ? error.message : String(error)}`
      )
      return false
    }
  }

  /**
   * 检查项是否被选中
   */
  const isSelected = (item: T): boolean => {
    return selectedItems.value.some(selected => selected.id === item.id)
  }

  return {
    selectedItems,
    isSelecting,
    isAllSelected,
    selectedCount,
    hasSelection,
    toggleSelectMode,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    executeOperation,
    isSelected,
  }
}
