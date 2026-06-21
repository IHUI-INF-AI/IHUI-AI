import { describe, it, expect, vi } from 'vitest'
import { usePagination } from '../usePagination'

describe('usePagination', () => {
  describe('默认配置', () => {
    const { pagination } = usePagination()

    it('应该有默认的分页值', () => {
      expect(pagination.page).toBe(1)
      expect(pagination.pageSize).toBe(20)
      expect(pagination.total).toBe(0)
    })
  })

  describe('自定义配置', () => {
    it('应该接受自定义初始值', () => {
      const { pagination } = usePagination({
        initialPage: 2,
        initialPageSize: 50,
      })

      expect(pagination.page).toBe(2)
      expect(pagination.pageSize).toBe(50)
    })
  })

  describe('分页操作', () => {
    it('应该正确处理页码变更', async () => {
      const onPageChange = vi.fn()
      const { pagination, handlePageChange } = usePagination({
        onPageChange,
      })

      await handlePageChange(3)

      expect(pagination.page).toBe(3)
      expect(onPageChange).toHaveBeenCalledWith(3)
    })

    it('应该正确处理每页数量变更', async () => {
      const onPageSizeChange = vi.fn()
      const { pagination, handlePageSizeChange } = usePagination({
        onPageSizeChange,
      })

      pagination.page = 5
      await handlePageSizeChange(25)

      expect(pagination.pageSize).toBe(25)
      expect(pagination.page).toBe(1)
      expect(onPageSizeChange).toHaveBeenCalledWith(25)
    })

    it('重置时应该回到初始状态', () => {
      const { pagination, resetPagination } = usePagination({
        initialPage: 1,
        initialPageSize: 20,
      })

      pagination.page = 5
      pagination.total = 100
      resetPagination()

      expect(pagination.page).toBe(1)
      expect(pagination.pageSize).toBe(20)
      expect(pagination.total).toBe(0)
    })
  })

  describe('边界情况', () => {
    it('应该处理空数据', () => {
      const { pagination } = usePagination()
      pagination.total = 0

      expect(pagination.total).toBe(0)
    })

    it('应该正确设置总数', () => {
      const { pagination } = usePagination()
      pagination.total = 1000

      expect(pagination.total).toBe(1000)
    })
  })

  describe('回调函数', () => {
    it('应该在页码变更时调用回调', async () => {
      const onPageChange = vi.fn()
      const { handlePageChange } = usePagination({ onPageChange })

      await handlePageChange(2)

      expect(onPageChange).toHaveBeenCalledTimes(1)
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('应该在每页数量变更时调用回调', async () => {
      const onPageSizeChange = vi.fn()
      const { handlePageSizeChange } = usePagination({ onPageSizeChange })

      await handlePageSizeChange(50)

      expect(onPageSizeChange).toHaveBeenCalledTimes(1)
      expect(onPageSizeChange).toHaveBeenCalledWith(50)
    })

    it('应该支持异步回调', async () => {
      const asyncCallback = vi.fn().mockResolvedValue(undefined)
      const { handlePageChange } = usePagination({ onPageChange: asyncCallback })

      await handlePageChange(3)

      expect(asyncCallback).toHaveBeenCalled()
    })
  })
})
