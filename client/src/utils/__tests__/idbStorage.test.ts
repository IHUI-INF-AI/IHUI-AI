import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type MockIDBRequest = {
  onsuccess: ((...args: unknown[]) => void) | null
  onerror: ((...args: unknown[]) => void) | null
  onupgradeneeded?: ((...args: unknown[]) => void) | null
  result: unknown
  error: unknown
}

type MockIndexedDB = {
  open: ReturnType<typeof vi.fn>
}

type MockDB = {
  createObjectStore: ReturnType<typeof vi.fn>
  objectStoreNames: { contains: ReturnType<typeof vi.fn> }
  transaction: ReturnType<typeof vi.fn>
}

type MockTransaction = {
  objectStore: ReturnType<typeof vi.fn>
}

type MockObjectStore = Record<string, ReturnType<typeof vi.fn>>

// 创建初始化的 mock request
function createInitRequest(db: unknown) {
  return {
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onupgradeneeded: null as ((event: unknown) => void) | null,
    result: db,
    error: null,
  }
}

// 让 init 通过 open 回调完成初始化
function setupInitMock(indexedDBMock: MockIndexedDB, db: unknown) {
  const req = createInitRequest(db)
  indexedDBMock.open.mockImplementation(() => {
    setTimeout(() => {
      if (req.onupgradeneeded) {
        req.onupgradeneeded({ target: { result: db } })
      }
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  })
  return req
}

describe('idbStorage', () => {
  let mockIndexedDB: MockIndexedDB
  let mockDB: MockDB
  let mockTransaction: MockTransaction

  beforeEach(() => {
    vi.clearAllMocks()

    mockDB = {
      createObjectStore: vi.fn(() => ({
        createIndex: vi.fn(),
      })),
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
      transaction: vi.fn(),
    }

    mockTransaction = {
      objectStore: vi.fn(() => ({
        add: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        index: vi.fn(() => ({
          openCursor: vi.fn(),
        })),
      })),
    }

    mockDB.transaction = vi.fn(() => mockTransaction)

    mockIndexedDB = {
      open: vi.fn(),
    }

    vi.stubGlobal('indexedDB', mockIndexedDB)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('isSupported', () => {
    it('应该返回true当indexedDB可用时', async () => {
      const { idbStorage } = await import('../idbStorage')
      expect(idbStorage.isSupported()).toBe(true)
    })

    it('应该返回false当indexedDB不可用时', async () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('indexedDB', undefined)
      vi.resetModules()

      const { idbStorage } = await import('../idbStorage')
      expect(idbStorage.isSupported()).toBe(false)
    })
  })

  describe('init', () => {
    it('应该成功初始化数据库', async () => {
      const mockRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
        result: mockDB,
        error: null,
      }

      mockIndexedDB.open.mockImplementation(() => {
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.onupgradeneeded({ target: { result: mockDB } })
          }
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess()
          }
        }, 0)
        return mockRequest
      })

      const { idbStorage } = await import('../idbStorage')
      await expect(idbStorage.init()).resolves.toBeUndefined()
    })

    it('应该在indexedDB不可用时抛出错误', async () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('indexedDB', undefined)
      vi.resetModules()

      const { idbStorage } = await import('../idbStorage')
      await expect(idbStorage.init()).rejects.toThrow('IndexedDB is not supported')
    })
  })

  describe('addRecord', () => {
    it('应该成功添加记录', async () => {
      const addRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: 'test-id',
        error: null,
      }

      const mockStore = {
        add: vi.fn(() => {
          setTimeout(() => {
            if (addRequest.onsuccess) addRequest.onsuccess()
          }, 0)
          return addRequest
        }),
        createIndex: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }

      const mockTx = {
        objectStore: vi.fn(() => mockStore),
      }

      mockDB.transaction = vi.fn(() => mockTx)

      const initRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
        result: mockDB,
        error: null,
      }

      mockIndexedDB.open.mockImplementation(() => {
        setTimeout(() => {
          if (initRequest.onupgradeneeded) {
            initRequest.onupgradeneeded({ target: { result: mockDB } })
          }
          if (initRequest.onsuccess) {
            initRequest.onsuccess()
          }
        }, 0)
        return initRequest
      })

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()

      const record = { id: 'test-id', data: 'test-data' }
      const result = await idbStorage.addRecord('sync-history', record)
      expect(result).toBe('test-id')
    })
  })

  describe('getRecordById', () => {
    it('应该成功获取记录', async () => {
      const getRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: { id: 'test-id', data: 'test-data' },
        error: null,
      }

      const mockStore = {
        get: vi.fn(() => {
          setTimeout(() => {
            if (getRequest.onsuccess) getRequest.onsuccess()
          }, 0)
          return getRequest
        }),
        add: vi.fn(),
        createIndex: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }

      const mockTx = {
        objectStore: vi.fn(() => mockStore),
      }

      mockDB.transaction = vi.fn(() => mockTx)

      const initRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
        result: mockDB,
        error: null,
      }

      mockIndexedDB.open.mockImplementation(() => {
        setTimeout(() => {
          if (initRequest.onupgradeneeded) {
            initRequest.onupgradeneeded({ target: { result: mockDB } })
          }
          if (initRequest.onsuccess) {
            initRequest.onsuccess()
          }
        }, 0)
        return initRequest
      })

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()

      const result = await idbStorage.getRecordById('sync-history', 'test-id')
      expect(result).toEqual({ id: 'test-id', data: 'test-data' })
    })
  })

  describe('deleteRecord', () => {
    it('应该成功删除记录', async () => {
      const deleteRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: undefined,
        error: null,
      }

      const mockStore = {
        delete: vi.fn(() => {
          setTimeout(() => {
            if (deleteRequest.onsuccess) deleteRequest.onsuccess()
          }, 0)
          return deleteRequest
        }),
        add: vi.fn(),
        createIndex: vi.fn(),
        get: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }

      const mockTx = {
        objectStore: vi.fn(() => mockStore),
      }

      mockDB.transaction = vi.fn(() => mockTx)

      const initRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
        result: mockDB,
        error: null,
      }

      mockIndexedDB.open.mockImplementation(() => {
        setTimeout(() => {
          if (initRequest.onupgradeneeded) {
            initRequest.onupgradeneeded({ target: { result: mockDB } })
          }
          if (initRequest.onsuccess) {
            initRequest.onsuccess()
          }
        }, 0)
        return initRequest
      })

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()

      const result = await idbStorage.deleteRecord('sync-history', 'test-id')
      expect(result).toBe(true)
    })
  })

  describe('clearStore', () => {
    it('应该成功清空存储', async () => {
      const clearRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: undefined,
        error: null,
      }

      const mockStore = {
        clear: vi.fn(() => {
          setTimeout(() => {
            if (clearRequest.onsuccess) clearRequest.onsuccess()
          }, 0)
          return clearRequest
        }),
        add: vi.fn(),
        createIndex: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }

      const mockTx = {
        objectStore: vi.fn(() => mockStore),
      }

      mockDB.transaction = vi.fn(() => mockTx)

      const initRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
        result: mockDB,
        error: null,
      }

      mockIndexedDB.open.mockImplementation(() => {
        setTimeout(() => {
          if (initRequest.onupgradeneeded) {
            initRequest.onupgradeneeded({ target: { result: mockDB } })
          }
          if (initRequest.onsuccess) {
            initRequest.onsuccess()
          }
        }, 0)
        return initRequest
      })

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()

      await expect(idbStorage.clearStore('sync-history')).resolves.toBeUndefined()
    })
  })

  describe('getRecordCount', () => {
    it('应该成功获取记录数量', async () => {
      const countRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: 5,
        error: null,
      }

      const mockStore = {
        count: vi.fn(() => {
          setTimeout(() => {
            if (countRequest.onsuccess) countRequest.onsuccess()
          }, 0)
          return countRequest
        }),
        add: vi.fn(),
        createIndex: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        put: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }

      const mockTx = {
        objectStore: vi.fn(() => mockStore),
      }

      mockDB.transaction = vi.fn(() => mockTx)

      const initRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
        result: mockDB,
        error: null,
      }

      mockIndexedDB.open.mockImplementation(() => {
        setTimeout(() => {
          if (initRequest.onupgradeneeded) {
            initRequest.onupgradeneeded({ target: { result: mockDB } })
          }
          if (initRequest.onsuccess) {
            initRequest.onsuccess()
          }
        }, 0)
        return initRequest
      })

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()

      const count = await idbStorage.getRecordCount('sync-history')
      expect(count).toBe(5)
    })
  })

  describe('updateRecord', () => {
    it('应该成功更新记录', async () => {
      const putRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        result: undefined,
        error: null,
      }

      const mockStore = {
        put: vi.fn(() => {
          setTimeout(() => {
            if (putRequest.onsuccess) putRequest.onsuccess()
          }, 0)
          return putRequest
        }),
        add: vi.fn(),
        createIndex: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }

      const mockTx = {
        objectStore: vi.fn(() => mockStore),
      }

      mockDB.transaction = vi.fn(() => mockTx)

      const initRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
        result: mockDB,
        error: null,
      }

      mockIndexedDB.open.mockImplementation(() => {
        setTimeout(() => {
          if (initRequest.onupgradeneeded) {
            initRequest.onupgradeneeded({ target: { result: mockDB } })
          }
          if (initRequest.onsuccess) {
            initRequest.onsuccess()
          }
        }, 0)
        return initRequest
      })

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()

      const result = await idbStorage.updateRecord('sync-history', 'test-id', { data: 'updated' })
      expect(result).toBe(true)
    })
  })

  // init 边界场景
  describe('init 边界', () => {
    it('db已存在时直接返回不重复打开', async () => {
      const openSpy = mockIndexedDB.open
      const req = setupInitMock(mockIndexedDB, mockDB)

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await idbStorage.init()
      await idbStorage.init()

      expect(openSpy).toHaveBeenCalledTimes(1)
    })

    it('并发调用init共享同一个Promise', async () => {
      const openSpy = mockIndexedDB.open
      const req = setupInitMock(mockIndexedDB, mockDB)

      const { idbStorage } = await import('../idbStorage')
      const p1 = idbStorage.init()
      const p2 = idbStorage.init()
      const p3 = idbStorage.init()
      await Promise.all([p1, p2, p3])

      expect(openSpy).toHaveBeenCalledTimes(1)
    })

    it('indexedDB.open失败时拒绝Promise', async () => {
      const error = new Error('open failed')
      mockIndexedDB.open.mockImplementation(() => {
        const req: MockIDBRequest = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: null,
          error,
        }
        setTimeout(() => {
          if (req.onerror) req.onerror()
        }, 0)
        return req
      })

      const { idbStorage } = await import('../idbStorage')
      await expect(idbStorage.init()).rejects.toBe(error)
    })

    it('stores已存在时跳过创建', async () => {
      // 让 contains 返回 true，模拟升级时 stores 已存在
      mockDB.objectStoreNames.contains = vi.fn(() => true)
      const createObjectStoreSpy = mockDB.createObjectStore

      const req = setupInitMock(mockIndexedDB, mockDB)

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()

      expect(req.onupgradeneeded).not.toBeNull()
      expect(createObjectStoreSpy).not.toHaveBeenCalled()
    })
  })

  // getRecords 测试
  describe('getRecords', () => {
    // 构造一个完整的游标对象用于测试
    function setupCursorMock(records: unknown[], limit?: number) {
      const cursorRequest: MockIDBRequest = {
        onsuccess: null as ((e: unknown) => void) | null,
        onerror: null as (() => void) | null,
        result: null,
        error: null,
      }

      let index = 0
      const cursor = {
        get value() { return records[index] },
        continue: vi.fn(() => {
          index++
          setTimeout(() => {
            const e = { target: { result: index < records.length ? cursor : null } }
            if (cursorRequest.onsuccess) cursorRequest.onsuccess(e)
          }, 0)
        }),
      }

      const indexRequest: { openCursor: ReturnType<typeof vi.fn> } = {
        openCursor: vi.fn(() => {
          setTimeout(() => {
            const e = { target: { result: index < records.length ? cursor : null } }
            if (cursorRequest.onsuccess) cursorRequest.onsuccess(e)
          }, 0)
          return cursorRequest
        }),
      }

      const mockStore = {
        add: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        createIndex: vi.fn(),
        index: vi.fn(() => indexRequest),
      }

      mockDB.transaction = vi.fn(() => ({ objectStore: vi.fn(() => mockStore) }))
      return { mockStore, cursorRequest }
    }

    it('不带limit时按倒序返回所有记录', async () => {
      const records = [
        { id: '1', timestamp: 100 },
        { id: '2', timestamp: 200 },
        { id: '3', timestamp: 300 },
      ]
      setupCursorMock(records)
      setupInitMock(mockIndexedDB, mockDB)

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      const result = await idbStorage.getRecords('sync-history')
      expect(result).toEqual(records)
    })

    it('带limit时只返回指定数量', async () => {
      const records = [
        { id: '1', timestamp: 100 },
        { id: '2', timestamp: 200 },
        { id: '3', timestamp: 300 },
      ]
      setupCursorMock(records, 2)
      setupInitMock(mockIndexedDB, mockDB)

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      const result = await idbStorage.getRecords('sync-history', 2)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(records[0])
    })

    it('游标错误时拒绝Promise', async () => {
      const error = new Error('cursor error')
      const cursorRequest: MockIDBRequest = {
        onsuccess: null,
        onerror: null,
        result: null,
        error,
      }
      const indexRequest = {
        openCursor: vi.fn(() => {
          setTimeout(() => {
            if (cursorRequest.onerror) cursorRequest.onerror()
          }, 0)
          return cursorRequest
        }),
      }
      const mockStore = {
        add: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        createIndex: vi.fn(),
        index: vi.fn(() => indexRequest),
      }
      mockDB.transaction = vi.fn(() => ({ objectStore: vi.fn(() => mockStore) }))
      setupInitMock(mockIndexedDB, mockDB)

      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await expect(idbStorage.getRecords('sync-history')).rejects.toBe(error)
    })
  })

  // 错误处理：直接初始化后只测错误路径
  describe('错误处理', () => {
    // 辅助：让所有 store 方法返回指定错误的 request
    function setupErrorStore(method: string, error: Error) {
      const req: MockIDBRequest = {
        onsuccess: null,
        onerror: null,
        result: null,
        error,
      }
      const store: MockObjectStore = {
        add: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(),
        put: vi.fn(),
        createIndex: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }
      store[method] = vi.fn(() => {
        setTimeout(() => {
          if (req.onerror) req.onerror()
        }, 0)
        return req
      })
      mockDB.transaction = vi.fn(() => ({ objectStore: vi.fn(() => store) }))
      return req
    }

    it('addRecord 错误时拒绝', async () => {
      const err = new Error('add fail')
      setupErrorStore('add', err)
      setupInitMock(mockIndexedDB, mockDB)
      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await expect(idbStorage.addRecord('sync-history', { id: 'x' })).rejects.toBe(err)
    })

    it('getRecordById 错误时拒绝', async () => {
      const err = new Error('get fail')
      setupErrorStore('get', err)
      setupInitMock(mockIndexedDB, mockDB)
      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await expect(idbStorage.getRecordById('sync-history', 'x')).rejects.toBe(err)
    })

    it('deleteRecord 错误时拒绝', async () => {
      const err = new Error('del fail')
      setupErrorStore('delete', err)
      setupInitMock(mockIndexedDB, mockDB)
      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await expect(idbStorage.deleteRecord('sync-history', 'x')).rejects.toBe(err)
    })

    it('clearStore 错误时拒绝', async () => {
      const err = new Error('clear fail')
      setupErrorStore('clear', err)
      setupInitMock(mockIndexedDB, mockDB)
      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await expect(idbStorage.clearStore('sync-history')).rejects.toBe(err)
    })

    it('getRecordCount 错误时拒绝', async () => {
      const err = new Error('count fail')
      setupErrorStore('count', err)
      setupInitMock(mockIndexedDB, mockDB)
      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await expect(idbStorage.getRecordCount('sync-history')).rejects.toBe(err)
    })

    it('updateRecord 错误时拒绝', async () => {
      const err = new Error('put fail')
      setupErrorStore('put', err)
      setupInitMock(mockIndexedDB, mockDB)
      const { idbStorage } = await import('../idbStorage')
      await idbStorage.init()
      await expect(idbStorage.updateRecord('sync-history', 'x', { a: 1 })).rejects.toBe(err)
    })
  })

  // 私有 getDB 间接测试：未初始化时调用其他方法会触发 init
  describe('getDB 私有方法', () => {
    it('未初始化db时调用操作方法会触发init', async () => {
      const req = setupInitMock(mockIndexedDB, mockDB)
      const { idbStorage } = await import('../idbStorage')

      // 直接调用 getRecordCount，触发 getDB -> init
      // getRecordCount 使用 readonly 事务 + count
      const countReq: MockIDBRequest = {
        onsuccess: null,
        onerror: null,
        result: 0,
        error: null,
      }
      const mockStore = {
        add: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        count: vi.fn(() => {
          setTimeout(() => {
            if (countReq.onsuccess) countReq.onsuccess()
          }, 0)
          return countReq
        }),
        put: vi.fn(),
        createIndex: vi.fn(),
        index: vi.fn(() => ({ openCursor: vi.fn() })),
      }
      mockDB.transaction = vi.fn(() => ({ objectStore: vi.fn(() => mockStore) }))

      const count = await idbStorage.getRecordCount('sync-history')
      expect(count).toBe(0)
      expect(mockIndexedDB.open).toHaveBeenCalled()
    })
  })

})
