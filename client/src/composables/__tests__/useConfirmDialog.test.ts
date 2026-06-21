import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessageBox: {
    confirm: vi.fn().mockResolvedValue(undefined),
    prompt: vi.fn().mockResolvedValue({ value: 'test' }),
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: vi.fn((key: string, params?: Record<string, string>) => {
      if (key === 'common.confirm') return '确认'
      if (key === 'common.cancel') return '取消'
      if (key === 'common.delete') return '删除确认'
      if (key === 'common.confirmDelete') return `确定要删除"${params?.name}"吗？`
      if (key === 'common.confirmDeleteDefault') return '确定要删除吗？'
      if (key === 'common.confirmCancel') return '确定要取消吗？'
      return key
    }),
  })),
}))

describe('useConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('confirm', () => {
    it('应该返回true当用户确认时', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirm } = useConfirmDialog()
      
      const result = await confirm('确定要执行吗？', '确认操作')
      
      expect(result).toBe(true)
    })

    it('应该返回false当用户取消时', async () => {
      const { ElMessageBox } = await import('element-plus')
      ;(ElMessageBox.confirm as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('cancel'))
      
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirm } = useConfirmDialog()
      
      const result = await confirm('确定要执行吗？', '确认操作')
      
      expect(result).toBe(false)
    })

    it('应该支持自定义选项', async () => {
      const { ElMessageBox } = await import('element-plus')
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirm } = useConfirmDialog()
      
      await confirm('确定要执行吗？', '确认操作', {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      })
      
      expect(ElMessageBox.confirm).toHaveBeenCalledWith(
        '确定要执行吗？',
        '确认操作',
        expect.objectContaining({
          type: 'warning',
          confirmButtonText: '确定',
          cancelButtonText: '取消',
        })
      )
    })
  })

  describe('confirmDelete', () => {
    it('应该显示删除确认对话框', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirmDelete } = useConfirmDialog()
      
      const result = await confirmDelete('测试项目')
      
      expect(result).toBe(true)
    })

    it('应该支持不带项目名称', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirmDelete } = useConfirmDialog()
      
      const result = await confirmDelete()
      
      expect(result).toBe(true)
    })

    it('应该支持自定义选项', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirmDelete } = useConfirmDialog()
      
      const result = await confirmDelete('测试项目', { type: 'error' })
      
      expect(result).toBe(true)
    })
  })

  describe('confirmCancel', () => {
    it('应该显示取消确认对话框', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirmCancel } = useConfirmDialog()
      
      const result = await confirmCancel()
      
      expect(result).toBe(true)
    })

    it('应该支持自定义消息', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirmCancel } = useConfirmDialog()
      
      const result = await confirmCancel('确定要放弃修改吗？')
      
      expect(result).toBe(true)
    })
  })

  describe('confirmAction', () => {
    it('应该显示操作确认对话框', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirmAction } = useConfirmDialog()
      
      const result = await confirmAction('确定要执行此操作吗？')
      
      expect(result).toBe(true)
    })

    it('应该支持自定义标题', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { confirmAction } = useConfirmDialog()
      
      const result = await confirmAction('确定要执行此操作吗？', '操作确认')
      
      expect(result).toBe(true)
    })
  })

  describe('showPrompt', () => {
    it('应该显示输入对话框', async () => {
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { showPrompt } = useConfirmDialog()
      
      const result = await showPrompt('请输入名称', '输入')
      
      expect(result).toBe('test')
    })

    it('应该返回null当用户取消时', async () => {
      const { ElMessageBox } = await import('element-plus')
      ;(ElMessageBox.prompt as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('cancel'))
      
      const { useConfirmDialog } = await import('../useConfirmDialog')
      const { showPrompt } = useConfirmDialog()
      
      const result = await showPrompt('请输入名称', '输入')
      
      expect(result).toBeNull()
    })
  })
})
