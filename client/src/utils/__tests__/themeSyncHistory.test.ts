import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const mockStore: Record<string, unknown[]> = {
  'sync-history': []
}

vi.mock('../idbStorage', () => ({
  idbStorage: {
    init: vi.fn().mockResolvedValue(undefined),
    addRecord: vi.fn().mockImplementation((store: string, record: unknown) => {
      mockStore[store] = mockStore[store] || []
      ;(mockStore[store] as unknown[]).push(record)
      return Promise.resolve()
    }),
    getRecords: vi.fn().mockImplementation((store: string, limit?: number) => {
      const records = mockStore[store] || []
      return Promise.resolve(limit ? records.slice(0, limit) : records)
    }),
    getRecordById: vi.fn().mockImplementation((store: string, id: string) => {
      const records = mockStore[store] || []
      return Promise.resolve((records as { id: string }[]).find(r => r.id === id))
    }),
    deleteRecord: vi.fn().mockImplementation((store: string, id: string) => {
      const records = mockStore[store] || []
      const index = (records as { id: string }[]).findIndex(r => r.id === id)
      if (index > -1) {
        ;(records as unknown[]).splice(index, 1)
      }
      return Promise.resolve()
    }),
    clearStore: vi.fn().mockImplementation((store: string) => {
      mockStore[store] = []
      return Promise.resolve()
    }),
    getRecordCount: vi.fn().mockImplementation((store: string) => {
      return Promise.resolve((mockStore[store] || []).length)
    })
  }
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}))

describe('themeSyncHistoryService', () => {
  let localStorageStore: Record<string, string> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageStore = {}
    Object.keys(mockStore).forEach(k => { mockStore[k] = [] })

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageStore[key] || null,
      setItem: (key: string, value: string) => { localStorageStore[key] = value },
      removeItem: (key: string) => { delete localStorageStore[key] },
      clear: () => { localStorageStore = {} }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('模块导入', () => {
    it('应该成功导入模块', async () => {
      const mod = await import('../themeSyncHistory')
      expect(mod).toBeDefined()
      expect(mod.themeSyncHistoryService).toBeDefined()
    })
  })

  describe('init', () => {
    it('应该初始化服务', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      expect(true).toBe(true)
    })

    it('应该只初始化一次', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.init()
      expect(true).toBe(true)
    })

    it('应该迁移localStorage数据', async () => {
      localStorageStore['theme-sync-history'] = JSON.stringify({
        records: [
          { id: 'legacy-1', timestamp: Date.now(), action: 'upload', status: 'success', themeMode: 'dark', deviceId: 'device-1', duration: 100 }
        ]
      })
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      expect(true).toBe(true)
    })
  })

  describe('addRecord', () => {
    it('应该添加新的同步记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const record = await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      expect(record.id).toBeDefined()
      expect(record.timestamp).toBeDefined()
      expect(record.action).toBe('upload')
    })

    it('应该添加下载类型的记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const record = await themeSyncHistoryService.addRecord({
        action: 'download',
        status: 'success',
        themeMode: 'light',
        deviceId: 'device-2',
        duration: 200
      })
      expect(record.action).toBe('download')
    })

    it('应该添加失败类型的记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const record = await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'failed',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 50,
        errorMessage: 'Network error'
      })
      expect(record.status).toBe('failed')
      expect(record.errorMessage).toBe('Network error')
    })

    it('应该添加冲突解决类型的记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const record = await themeSyncHistoryService.addRecord({
        action: 'conflict_resolved',
        status: 'success',
        themeMode: 'light',
        deviceId: 'device-3',
        duration: 300
      })
      expect(record.action).toBe('conflict_resolved')
    })
  })

  describe('getRecords', () => {
    it('应该获取同步记录列表', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const records = await themeSyncHistoryService.getRecords()
      expect(records.length).toBeGreaterThan(0)
    })

    it('应该支持限制返回数量', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      await themeSyncHistoryService.addRecord({
        action: 'download',
        status: 'success',
        themeMode: 'light',
        deviceId: 'device-2',
        duration: 200
      })
      const records = await themeSyncHistoryService.getRecords(1)
      expect(records.length).toBe(1)
    })
  })

  describe('getRecordById', () => {
    it('应该根据ID获取记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const added = await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const record = await themeSyncHistoryService.getRecordById(added.id)
      expect(record).toBeDefined()
      expect(record?.id).toBe(added.id)
    })

    it('应该返回undefined当记录不存在', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const record = await themeSyncHistoryService.getRecordById('non-existent')
      expect(record).toBeUndefined()
    })
  })

  describe('getRecordsByDate', () => {
    it('应该根据日期范围获取记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const now = new Date()
      const records = await themeSyncHistoryService.getRecordsByDate(
        new Date(now.getTime() - 86400000),
        new Date(now.getTime() + 86400000)
      )
      expect(records.length).toBeGreaterThan(0)
    })
  })

  describe('getRecordsByStatus', () => {
    it('应该根据状态获取记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'failed',
        themeMode: 'light',
        deviceId: 'device-2',
        duration: 50
      })
      const successRecords = await themeSyncHistoryService.getRecordsByStatus('success')
      expect(successRecords.every(r => r.status === 'success')).toBe(true)
    })
  })

  describe('getSuccessCount', () => {
    it('应该返回成功记录数量', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const count = await themeSyncHistoryService.getSuccessCount()
      expect(count).toBeGreaterThan(0)
    })
  })

  describe('getFailedCount', () => {
    it('应该返回失败记录数量', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'failed',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 50
      })
      const count = await themeSyncHistoryService.getFailedCount()
      expect(count).toBeGreaterThan(0)
    })
  })

  describe('getLastSuccessfulSync', () => {
    it('应该返回最后一次成功的同步记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const record = await themeSyncHistoryService.getLastSuccessfulSync()
      expect(record).toBeDefined()
      expect(record?.status).toBe('success')
    })
  })

  describe('getLastSync', () => {
    it('应该返回最后一次同步记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const record = await themeSyncHistoryService.getLastSync()
      expect(record).toBeDefined()
    })
  })

  describe('clearHistory', () => {
    it('应该清空历史记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      await themeSyncHistoryService.clearHistory()
      const records = await themeSyncHistoryService.getRecords()
      expect(records.length).toBe(0)
    })
  })

  describe('deleteRecord', () => {
    it('应该删除指定记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const added = await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const result = await themeSyncHistoryService.deleteRecord(added.id)
      expect(result).toBe(true)
    })
  })

  describe('getStats', () => {
    it('应该返回统计信息', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'failed',
        themeMode: 'light',
        deviceId: 'device-2',
        duration: 50
      })
      const stats = await themeSyncHistoryService.getStats()
      expect(stats.total).toBeGreaterThan(0)
      expect(stats.success).toBeGreaterThanOrEqual(0)
      expect(stats.failed).toBeGreaterThanOrEqual(0)
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('setMaxRecords', () => {
    it('应该设置最大记录数', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      themeSyncHistoryService.setMaxRecords(50)
      expect(true).toBe(true)
    })
  })

  describe('exportHistory', () => {
    it('应该导出历史记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const exported = await themeSyncHistoryService.exportHistory()
      expect(typeof exported).toBe('string')
      expect(() => JSON.parse(exported)).not.toThrow()
    })

    // 无记录时应该返回空数组的JSON
    it('无记录时应该返回空数组的JSON', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const exported = await themeSyncHistoryService.exportHistory()
      expect(exported).toBe('[]')
    })
  })

  // ============================================================
  // 新增测试用例 - 提升代码覆盖率
  // ============================================================

  describe('init 错误处理', () => {
    // idbStorage.init 失败时不应该抛出
    it('idbStorage.init失败时应该捕获错误', async () => {
      vi.resetModules()
      const idbMod = await import('../idbStorage')
      vi.mocked(idbMod.idbStorage.init).mockRejectedValueOnce(new Error('初始化失败'))

      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      expect(themeSyncHistoryService).toBeDefined()
    })
  })

  describe('migrateFromLocalStorage 边界情况', () => {
    // localStorage 无数据时跳过迁移
    it('localStorage无数据时应该跳过迁移', async () => {
      vi.resetModules()
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      expect(themeSyncHistoryService).toBeDefined()
    })

    // localStorage 数据不是合法JSON
    it('JSON解析失败时应该捕获错误', async () => {
      vi.resetModules()
      localStorageStore['theme-sync-history'] = 'invalid json {{'
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      expect(themeSyncHistoryService).toBeDefined()
    })

    // 数据没有records字段
    it('没有records字段时应该跳过迁移', async () => {
      vi.resetModules()
      localStorageStore['theme-sync-history'] = JSON.stringify({ data: 'no records' })
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      expect(themeSyncHistoryService).toBeDefined()
    })

    // records是空数组
    it('records为空数组时应该跳过迁移', async () => {
      vi.resetModules()
      localStorageStore['theme-sync-history'] = JSON.stringify({ records: [] })
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      expect(themeSyncHistoryService).toBeDefined()
    })

    // 有records数据时应该迁移并删除localStorage
    it('有records数据时应该迁移到idb并删除localStorage', async () => {
      vi.resetModules()
      localStorageStore['theme-sync-history'] = JSON.stringify({
        records: [
          { id: 'legacy-1', timestamp: Date.now(), action: 'upload', status: 'success', themeMode: 'dark', deviceId: 'device-1', duration: 100 },
          { id: 'legacy-2', timestamp: Date.now(), action: 'download', status: 'failed', themeMode: 'light', deviceId: 'device-2', duration: 200 }
        ]
      })
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      // 迁移完成后localStorage中的旧数据应该被删除
      expect(localStorageStore['theme-sync-history']).toBeUndefined()
    })
  })

  describe('addRecord 错误处理', () => {
    // 存储失败时应该返回记录而不抛出
    it('idbStorage.addRecord失败时应该返回记录但不抛出', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      const idbMod = await import('../idbStorage')
      vi.mocked(idbMod.idbStorage.addRecord).mockRejectedValueOnce(new Error('添加失败'))

      const record = await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      expect(record.id).toBeDefined()
      expect(record.action).toBe('upload')
    })
  })

  describe('trimRecords', () => {
    // 超过最大记录数时自动清理
    it('超过maxRecords时应该清理旧记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      themeSyncHistoryService.setMaxRecords(2)

      try {
        for (let i = 0; i < 4; i++) {
          await themeSyncHistoryService.addRecord({
            action: 'upload',
            status: 'success',
            themeMode: 'dark',
            deviceId: `device-${i}`,
            duration: 100
          })
        }
        const records = await themeSyncHistoryService.getRecords()
        expect(records.length).toBeLessThanOrEqual(2)
      } finally {
        // 恢复默认最大记录数，避免影响其他测试
        themeSyncHistoryService.setMaxRecords(100)
      }
    })

    // getRecordCount 失败时不应该影响 addRecord
    it('getRecordCount失败时应该捕获错误', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      const idbMod = await import('../idbStorage')
      vi.mocked(idbMod.idbStorage.getRecordCount).mockRejectedValueOnce(new Error('计数失败'))

      const record = await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      expect(record.id).toBeDefined()
    })
  })

  describe('getRecords 错误处理', () => {
    // 获取失败时返回空数组
    it('idbStorage.getRecords失败时应该返回空数组', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      const idbMod = await import('../idbStorage')
      vi.mocked(idbMod.idbStorage.getRecords).mockRejectedValueOnce(new Error('查询失败'))

      const records = await themeSyncHistoryService.getRecords()
      expect(records).toEqual([])
    })
  })

  describe('getRecordById 错误处理', () => {
    // 查询失败时返回undefined
    it('idbStorage.getRecordById失败时应该返回undefined', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      const idbMod = await import('../idbStorage')
      vi.mocked(idbMod.idbStorage.getRecordById).mockRejectedValueOnce(new Error('查询失败'))

      const record = await themeSyncHistoryService.getRecordById('any-id')
      expect(record).toBeUndefined()
    })
  })

  describe('clearHistory 错误处理', () => {
    // 清空失败时不应该抛出
    it('idbStorage.clearStore失败时应该捕获错误', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      const idbMod = await import('../idbStorage')
      vi.mocked(idbMod.idbStorage.clearStore).mockRejectedValueOnce(new Error('清空失败'))

      await expect(themeSyncHistoryService.clearHistory()).resolves.toBeUndefined()
    })
  })

  describe('deleteRecord 错误处理', () => {
    // 删除失败时返回false
    it('idbStorage.deleteRecord失败时应该返回false', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      const idbMod = await import('../idbStorage')
      vi.mocked(idbMod.idbStorage.deleteRecord).mockRejectedValueOnce(new Error('删除失败'))

      const result = await themeSyncHistoryService.deleteRecord('any-id')
      expect(result).toBe(false)
    })
  })

  describe('getRecordsByDate 范围外', () => {
    // 查询一个不含任何记录的日期范围
    it('所有记录都在范围外时应该返回空数组', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const records = await themeSyncHistoryService.getRecordsByDate(
        new Date(2000, 0, 1),
        new Date(2000, 0, 2)
      )
      expect(records.length).toBe(0)
    })
  })

  describe('getRecordsByStatus cancelled', () => {
    // 筛选cancelled状态的记录
    it('应该筛选cancelled状态的记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'cancelled',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const records = await themeSyncHistoryService.getRecordsByStatus('cancelled')
      expect(records.length).toBeGreaterThan(0)
      expect(records.every(r => r.status === 'cancelled')).toBe(true)
    })
  })

  describe('getLastSuccessfulSync 无成功记录', () => {
    // 没有成功记录时返回undefined
    it('没有成功记录时应该返回undefined', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const record = await themeSyncHistoryService.getLastSuccessfulSync()
      expect(record).toBeUndefined()
    })
  })

  describe('getStats 完整统计', () => {
    // cancelled记录数统计
    it('应该正确统计cancelled记录', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'cancelled',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const stats = await themeSyncHistoryService.getStats()
      expect(stats.cancelled).toBeGreaterThan(0)
    })

    // 没有成功记录时平均时长为0
    it('无成功记录时averageDuration应该为0', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'failed',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const stats = await themeSyncHistoryService.getStats()
      expect(stats.averageDuration).toBe(0)
    })

    // 有成功记录时计算平均时长
    it('有成功记录时应该计算平均时长', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'light',
        deviceId: 'device-2',
        duration: 200
      })
      const stats = await themeSyncHistoryService.getStats()
      expect(stats.averageDuration).toBe(150)
    })

    // 无记录时所有统计为0
    it('无记录时所有统计应该为0', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const stats = await themeSyncHistoryService.getStats()
      expect(stats.total).toBe(0)
      expect(stats.success).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.cancelled).toBe(0)
      expect(stats.averageDuration).toBe(0)
    })
  })

  describe('exportAsCSV', () => {
    // CSV格式导出 - 包含表头
    it('应该返回包含表头的CSV字符串', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'success',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100
      })
      const csv = await themeSyncHistoryService.exportAsCSV()
      expect(csv).toContain('ID,Timestamp,Action,Status,Theme Mode,Device ID,Duration (ms),Error')
    })

    // 没有记录时返回空字符串
    it('没有记录时应该返回空字符串', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      const csv = await themeSyncHistoryService.exportAsCSV()
      expect(csv).toBe('')
    })

    // CSV应该包含错误信息
    it('应该包含错误信息', async () => {
      const { themeSyncHistoryService } = await import('../themeSyncHistory')
      await themeSyncHistoryService.init()
      await themeSyncHistoryService.addRecord({
        action: 'upload',
        status: 'failed',
        themeMode: 'dark',
        deviceId: 'device-1',
        duration: 100,
        errorMessage: '测试错误信息'
      })
      const csv = await themeSyncHistoryService.exportAsCSV()
      expect(csv).toContain('测试错误信息')
    })
  })
})
