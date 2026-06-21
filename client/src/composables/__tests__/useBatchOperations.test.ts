import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useBatchOperations, BatchOperation } from '../useBatchOperations'

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../useOperationFeedback', () => ({
  useOperationFeedback: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
  }),
}))

vi.mock('../useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}))

describe('useBatchOperations', () => {
  interface TestItem {
    id: number
    name: string
  }

  const createWrapper = (operations: BatchOperation<TestItem>[] = []) => {
    let result: ReturnType<typeof useBatchOperations<TestItem>> | null = null

    const wrapper = mount(
      defineComponent({
        setup() {
          result = useBatchOperations<TestItem>({ operations })
          return {}
        },
        render: () => h('div'),
      })
    )

    return { wrapper, result }
  }

  const mockOperations: BatchOperation<TestItem>[] = [
    {
      name: '删除',
      execute: vi.fn(),
      confirmMessage: '确定删除 {count} 项吗？',
    },
    {
      name: '导出',
      execute: vi.fn(),
    },
    {
      name: '危险操作',
      execute: vi.fn(),
      dangerous: true,
      confirmMessage: '确定执行危险操作吗？',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该初始化默认状态', () => {
    const { result } = createWrapper(mockOperations)

    expect(result!.selectedItems.value).toEqual([])
    expect(result!.isSelecting.value).toBe(false)
    expect(result!.selectedCount.value).toBe(0)
    expect(result!.hasSelection.value).toBe(false)
  })

  it('应该切换选择模式', () => {
    const { result } = createWrapper(mockOperations)

    result!.toggleSelectMode()
    expect(result!.isSelecting.value).toBe(true)

    result!.toggleSelectMode()
    expect(result!.isSelecting.value).toBe(false)
  })

  it('应该选择/取消选择项', () => {
    const { result } = createWrapper(mockOperations)
    const item: TestItem = { id: 1, name: 'Item 1' }

    result!.toggleSelection(item)
    expect(result!.selectedItems.value).toHaveLength(1)
    expect(result!.isSelected(item)).toBe(true)

    result!.toggleSelection(item)
    expect(result!.selectedItems.value).toHaveLength(0)
    expect(result!.isSelected(item)).toBe(false)
  })

  it('应该支持多选', () => {
    const { result } = createWrapper(mockOperations)
    const items: TestItem[] = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]

    result!.toggleSelection(items[0])
    result!.toggleSelection(items[1])

    expect(result!.selectedItems.value).toHaveLength(2)
  })

  it('应该全选/取消全选', () => {
    const { result } = createWrapper(mockOperations)
    const items: TestItem[] = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]

    result!.toggleSelectAll(items)
    expect(result!.selectedItems.value).toHaveLength(2)

    result!.toggleSelectAll(items)
    expect(result!.selectedItems.value).toHaveLength(0)
  })

  it('应该清空选择', () => {
    const { result } = createWrapper(mockOperations)
    const item: TestItem = { id: 1, name: 'Item 1' }

    result!.toggleSelection(item)
    expect(result!.selectedItems.value).toHaveLength(1)

    result!.clearSelection()
    expect(result!.selectedItems.value).toHaveLength(0)
  })

  it('应该检查项是否被选中', () => {
    const { result } = createWrapper(mockOperations)
    const item: TestItem = { id: 1, name: 'Item 1' }

    expect(result!.isSelected(item)).toBe(false)

    result!.toggleSelection(item)
    expect(result!.isSelected(item)).toBe(true)
  })

  it('应该返回选中数量', () => {
    const { result } = createWrapper(mockOperations)
    const items: TestItem[] = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]

    expect(result!.selectedCount.value).toBe(0)

    result!.toggleSelection(items[0])
    expect(result!.selectedCount.value).toBe(1)

    result!.toggleSelection(items[1])
    expect(result!.selectedCount.value).toBe(2)
  })

  it('应该返回hasSelection', () => {
    const { result } = createWrapper(mockOperations)
    const item: TestItem = { id: 1, name: 'Item 1' }

    expect(result!.hasSelection.value).toBe(false)

    result!.toggleSelection(item)
    expect(result!.hasSelection.value).toBe(true)
  })

  it('应该执行批量操作', async () => {
    const execute = vi.fn()
    const operations: BatchOperation<TestItem>[] = [
      { name: '测试操作', execute },
    ]
    const { result } = createWrapper(operations)
    const item: TestItem = { id: 1, name: 'Item 1' }

    result!.toggleSelection(item)
    const success = await result!.executeOperation(operations[0])

    expect(execute).toHaveBeenCalled()
    expect(success).toBe(true)
  })

  it('应该在没有选中项时警告', async () => {
    const execute = vi.fn()
    const operations: BatchOperation<TestItem>[] = [
      { name: '测试操作', execute },
    ]
    const { result } = createWrapper(operations)

    const success = await result!.executeOperation(operations[0])

    expect(execute).not.toHaveBeenCalled()
    expect(success).toBe(false)
  })

  it('应该使用指定项执行操作', async () => {
    const execute = vi.fn()
    const operations: BatchOperation<TestItem>[] = [
      { name: '测试操作', execute },
    ]
    const { result } = createWrapper(operations)
    const item: TestItem = { id: 1, name: 'Item 1' }

    const success = await result!.executeOperation(operations[0], [item])

    expect(execute).toHaveBeenCalledWith([item])
    expect(success).toBe(true)
  })

  it('应该处理操作错误', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('操作失败'))
    const operations: BatchOperation<TestItem>[] = [
      { name: '测试操作', execute },
    ]
    const { result } = createWrapper(operations)
    const item: TestItem = { id: 1, name: 'Item 1' }

    result!.toggleSelection(item)
    const success = await result!.executeOperation(operations[0])

    expect(success).toBe(false)
  })
})
