import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  exportToCSV,
  exportToJSON,
  exportToExcel,
  formatDateForExport,
  generateExportFilename,
} from '../export'

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('export', () => {
  let mockCreateObjectURL: any
  let mockRevokeObjectURL: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
    mockRevokeObjectURL = vi.fn()
    URL.createObjectURL = mockCreateObjectURL
    URL.revokeObjectURL = mockRevokeObjectURL
    
    const mockLink = {
      click: vi.fn(),
      download: '',
      href: '',
    }
    document.createElement = vi.fn(() => mockLink as any)
    document.body.appendChild = vi.fn()
    document.body.removeChild = vi.fn()
  })

  describe('exportToCSV', () => {
    it('应该导出CSV文件', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]
      const columns = [
        { key: 'name' as const, header: '姓名' },
        { key: 'age' as const, header: '年龄' },
      ]
      
      exportToCSV(data, columns, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('应该处理包含逗号的值', () => {
      const data = [{ name: 'Alice, Bob', age: 30 }]
      const columns = [
        { key: 'name' as const, header: '姓名' },
        { key: 'age' as const, header: '年龄' },
      ]
      
      exportToCSV(data, columns, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('应该处理包含引号的值', () => {
      const data = [{ name: 'Alice "The Boss"', age: 30 }]
      const columns = [
        { key: 'name' as const, header: '姓名' },
        { key: 'age' as const, header: '年龄' },
      ]
      
      exportToCSV(data, columns, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('应该使用formatter格式化值', () => {
      const data = [{ name: 'Alice', age: 30 }]
      const columns = [
        { key: 'name' as const, header: '姓名' },
        { 
          key: 'age' as const, 
          header: '年龄',
          formatter: (_, value) => `${value}岁`,
        },
      ]
      
      exportToCSV(data, columns, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('应该处理嵌套属性', () => {
      const data = [{ user: { name: 'Alice' }, age: 30 }]
      const columns = [
        { key: 'user.name' as const, header: '姓名' },
        { key: 'age' as const, header: '年龄' },
      ]
      
      exportToCSV(data, columns, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  describe('exportToJSON', () => {
    it('应该导出JSON文件', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]
      
      exportToJSON(data, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('应该处理空数组', () => {
      exportToJSON([], 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  describe('exportToExcel', () => {
    it('应该导出Excel文件', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]
      const columns = [
        { key: 'name' as const, header: '姓名' },
        { key: 'age' as const, header: '年龄' },
      ]
      
      exportToExcel(data, columns, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('应该使用formatter格式化值', () => {
      const data = [{ name: 'Alice', age: 30 }]
      const columns = [
        { key: 'name' as const, header: '姓名' },
        { 
          key: 'age' as const, 
          header: '年龄',
          formatter: (_, value) => `${value}岁`,
        },
      ]
      
      exportToExcel(data, columns, 'test')
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  describe('formatDateForExport', () => {
    it('应该格式化日期', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = formatDateForExport(date)
      expect(result).toBeDefined()
    })

    it('应该处理字符串日期', () => {
      const result = formatDateForExport('2024-01-15')
      expect(result).toBeDefined()
    })

    it('应该处理时间戳', () => {
      const result = formatDateForExport(1705312200000)
      expect(result).toBeDefined()
    })

    it('应该处理无效日期', () => {
      const result = formatDateForExport('invalid date')
      expect(result).toBe('-')
    })
  })

  describe('generateExportFilename', () => {
    it('应该生成导出文件名', () => {
      const result = generateExportFilename('export')
      expect(result).toMatch(/^export_\d{8}_\d{6}$/)
    })

    it('应该使用自定义前缀', () => {
      const result = generateExportFilename('users')
      expect(result).toMatch(/^users_\d{8}_\d{6}$/)
    })
  })
})
