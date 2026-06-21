import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 工具:通过 spyOn 修改 navigator.userAgent(jsdom 中只读属性)
const setUserAgent = (ua: string) => {
  // 优先用 spyOn;若已被 spy 则先还原再重新 spy
  try {
    vi.restoreAllMocks()
  } catch { /* noop */ }
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
}

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// 工具:向 localStorage 直接写入若干设备
const seedDevices = (devices: any[]) => {
  localStorage.setItem('sync-devices', JSON.stringify(devices))
}

// 工具:重新加载模块,让 manager 从最新 localStorage 读取
const reloadManager = async () => {
  vi.resetModules()
  const mod = await import('../deviceSyncManager')
  return mod.deviceSyncManager
}

describe('deviceSyncManager', () => {
  let manager: typeof import('../deviceSyncManager').deviceSyncManager

  beforeEach(async () => {
    vi.resetModules()
    setUserAgent(DEFAULT_UA)
    localStorage.clear()
    manager = (await import('../deviceSyncManager')).deviceSyncManager
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCurrentDevice', () => {
    it('注册后应返回当前设备', () => {
      const device = manager.registerCurrentDevice()
      const current = manager.getCurrentDevice()
      expect(current?.id).toBe(device.id)
      expect(current?.isCurrentDevice).toBe(true)
    })
  })

  describe('registerCurrentDevice', () => {
    it('应该注册新设备', () => {
      const device = manager.registerCurrentDevice()
      expect(device.id).toBeDefined()
      expect(device.name).toBeDefined()
      expect(device.type).toBeDefined()
      expect(device.isCurrentDevice).toBe(true)
    })

    it('重复注册应更新现有设备', async () => {
      const first = manager.registerCurrentDevice()
      await new Promise(r => setTimeout(r, 5))
      const second = manager.registerCurrentDevice()
      expect(first.id).toBe(second.id)
      expect(manager.getDeviceCount()).toBe(1)
    })
  })

  describe('getDevices', () => {
    it('应该返回所有设备', () => {
      manager.registerCurrentDevice()
      expect(manager.getDevices().length).toBe(1)
    })

    it('应该按最后同步时间倒序排序', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'a', name: 'A', type: 'desktop', lastSyncedAt: now - 1000, createdAt: now - 2000, isCurrentDevice: false },
        { id: 'b', name: 'B', type: 'mobile', lastSyncedAt: now, createdAt: now - 2000, isCurrentDevice: false },
        { id: currentId, name: 'C', type: 'desktop', lastSyncedAt: now - 500, createdAt: now - 2000, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      const list = m.getDevices()
      expect(list[0].id).toBe('b')
      expect(list[1].id).toBe(currentId)
      expect(list[2].id).toBe('a')
    })
  })

  describe('getDeviceById', () => {
    it('应该返回指定设备', () => {
      const device = manager.registerCurrentDevice()
      expect(manager.getDeviceById(device.id)?.id).toBe(device.id)
    })

    it('找不到设备应返回 undefined', () => {
      expect(manager.getDeviceById('non-existent')).toBeUndefined()
    })
  })

  describe('removeDevice', () => {
    it('应该移除非当前设备', async () => {
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'other', name: 'O', type: 'desktop', lastSyncedAt: Date.now(), createdAt: Date.now(), isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: Date.now(), createdAt: Date.now(), isCurrentDevice: true },
      ])
      const m = await reloadManager()
      expect(m.removeDevice('other')).toBe(true)
      expect(m.getDeviceById('other')).toBeUndefined()
    })

    it('不应移除当前设备', () => {
      const device = manager.registerCurrentDevice()
      expect(manager.removeDevice(device.id)).toBe(false)
    })

    it('移除不存在的设备应返回 false', () => {
      manager.registerCurrentDevice()
      expect(manager.removeDevice('nope')).toBe(false)
    })
  })

  describe('renameDevice', () => {
    it('应该重命名设备', () => {
      const device = manager.registerCurrentDevice()
      expect(manager.renameDevice(device.id, 'New Name')).toBe(true)
      expect(manager.getDeviceById(device.id)?.name).toBe('New Name')
    })

    it('重命名不存在的设备应返回 false', () => {
      expect(manager.renameDevice('non-existent', 'X')).toBe(false)
    })
  })

  describe('updateDeviceLastSync', () => {
    it('应该更新当前设备的同步时间', () => {
      const device = manager.registerCurrentDevice()
      const before = device.lastSyncedAt
      // 等待时间戳变化
      const start = Date.now()
      while (Date.now() - start < 5) { /* busy wait */ }
      manager.updateDeviceLastSync()
      expect(manager.getCurrentDevice()!.lastSyncedAt).toBeGreaterThan(before)
    })

    it('应该更新指定设备的同步时间', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'x', name: 'X', type: 'desktop', lastSyncedAt: now - 9999, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      m.updateDeviceLastSync('x')
      expect(m.getDeviceById('x')!.lastSyncedAt).toBeGreaterThan(now - 1000)
    })

    it('设备不存在时应静默处理', () => {
      manager.registerCurrentDevice()
      expect(() => manager.updateDeviceLastSync('nope')).not.toThrow()
    })
  })

  describe('getDeviceCount', () => {
    it('应该返回设备数量', () => {
      manager.registerCurrentDevice()
      expect(manager.getDeviceCount()).toBe(1)
    })

    it('无设备时应返回 0', () => {
      expect(manager.getDeviceCount()).toBe(0)
    })
  })

  describe('getActiveDevices', () => {
    it('应返回指定小时内的活跃设备', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'old', name: 'O', type: 'desktop', lastSyncedAt: now - 48 * 60 * 60 * 1000, createdAt: now, isCurrentDevice: false },
        { id: 'new', name: 'N', type: 'mobile', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      const active = m.getActiveDevices(24)
      expect(active.length).toBe(2)
      expect(active.some(d => d.id === 'old')).toBe(false)
    })

    it('应使用默认 24 小时', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'stale', name: 'S', type: 'desktop', lastSyncedAt: now - 25 * 60 * 60 * 1000, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      expect(m.getActiveDevices().length).toBe(1)
    })
  })

  describe('getInactiveDevices', () => {
    it('应返回超过指定天数未活动的设备', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'old', name: 'O', type: 'desktop', lastSyncedAt: now - 31 * 24 * 60 * 60 * 1000, createdAt: now, isCurrentDevice: false },
        { id: 'new', name: 'N', type: 'mobile', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      const inactive = m.getInactiveDevices(30)
      expect(inactive.length).toBe(1)
      expect(inactive[0].id).toBe('old')
    })

    it('应使用默认 30 天', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'stale', name: 'S', type: 'desktop', lastSyncedAt: now - 31 * 24 * 60 * 60 * 1000, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      expect(m.getInactiveDevices().length).toBe(1)
    })
  })

  describe('cleanupOldDevices', () => {
    it('应清理过期非当前设备', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'old', name: 'O', type: 'desktop', lastSyncedAt: now - 100 * 24 * 60 * 60 * 1000, createdAt: now, isCurrentDevice: false },
        { id: 'new', name: 'N', type: 'mobile', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      const removed = m.cleanupOldDevices(90)
      expect(removed).toBe(1)
      expect(m.getDeviceById('old')).toBeUndefined()
      expect(m.getCurrentDevice()).toBeDefined()
    })

    it('应使用默认 90 天', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'stale', name: 'S', type: 'desktop', lastSyncedAt: now - 91 * 24 * 60 * 60 * 1000, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      expect(m.cleanupOldDevices()).toBe(1)
    })

    it('当前设备即使过期也应保留', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now - 1000 * 24 * 60 * 60 * 1000, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      expect(m.cleanupOldDevices(90)).toBe(0)
      expect(m.getCurrentDevice()).toBeDefined()
    })
  })

  describe('getDeviceStats', () => {
    it('应该返回设备统计', () => {
      manager.registerCurrentDevice()
      const stats = manager.getDeviceStats()
      expect(stats.total).toBe(1)
      expect(stats.active).toBe(1)
      expect(stats.byType).toBeDefined()
    })

    it('应按类型正确分类', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'd1', name: 'D1', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: 'd2', name: 'D2', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: 'm1', name: 'M1', type: 'mobile', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: 't1', name: 'T1', type: 'tablet', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: 'u1', name: 'U1', type: 'unknown', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      const stats = m.getDeviceStats()
      expect(stats.total).toBe(6)
      expect(stats.byType.desktop).toBe(3)
      expect(stats.byType.mobile).toBe(1)
      expect(stats.byType.tablet).toBe(1)
      expect(stats.byType.unknown).toBe(1)
    })
  })

  describe('clearAllDevices', () => {
    it('应只保留当前设备', async () => {
      const now = Date.now()
      const currentId = 'cur-id'
      localStorage.setItem('current-device-id', currentId)
      seedDevices([
        { id: 'a', name: 'A', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: false },
        { id: currentId, name: 'M', type: 'desktop', lastSyncedAt: now, createdAt: now, isCurrentDevice: true },
      ])
      const m = await reloadManager()
      m.clearAllDevices()
      expect(m.getDeviceCount()).toBe(1)
      expect(m.getCurrentDevice()).toBeDefined()
    })

    it('当没有当前设备时应清空所有', async () => {
      // 当前设备 id 不存在,只写入非当前设备
      seedDevices([
        { id: 'a', name: 'A', type: 'desktop', lastSyncedAt: Date.now(), createdAt: Date.now(), isCurrentDevice: false },
      ])
      const m = await reloadManager()
      m.clearAllDevices()
      expect(m.getDeviceCount()).toBe(0)
    })
  })

  // 不同 userAgent 下的设备识别
  describe('设备/浏览器/操作系统识别', () => {
    const testCases: Array<{ ua: string, expectedType: string, expectedBrowser: string, expectedOS: string }> = [
      {
        // 注意:iPhone UA 含 "Mac OS X",代码会优先匹配到 macOS 分支
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        expectedType: 'mobile',
        expectedBrowser: 'Safari',
        expectedOS: 'macOS',
      },
      {
        // 注意:iPad UA 含 "Mac OS X",代码会优先匹配到 macOS 分支
        ua: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        expectedType: 'tablet',
        expectedBrowser: 'Safari',
        expectedOS: 'macOS',
      },
      {
        ua: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
        expectedType: 'mobile',
        expectedBrowser: 'Chrome',
        expectedOS: 'Android 11',
      },
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        expectedType: 'desktop',
        expectedBrowser: 'Firefox',
        expectedOS: 'Windows 10',
      },
      {
        ua: 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36 Edg/90.0.818.42',
        expectedType: 'desktop',
        expectedBrowser: 'Edge',
        expectedOS: 'Windows 8.1',
      },
      {
        ua: 'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        expectedType: 'desktop',
        expectedBrowser: 'Chrome',
        expectedOS: 'Windows 8',
      },
      {
        ua: 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        expectedType: 'desktop',
        expectedBrowser: 'Chrome',
        expectedOS: 'Windows 7',
      },
      {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
        expectedType: 'desktop',
        expectedBrowser: 'Safari',
        expectedOS: 'macOS 10.15',
      },
      {
        ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        expectedType: 'desktop',
        expectedBrowser: 'Chrome',
        expectedOS: 'Linux',
      },
      {
        // 注意:Opera UA 中也含 "Chrome" 字符串,代码优先匹配 Chrome
        ua: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36 OPR/76.0.4017.123',
        expectedType: 'desktop',
        expectedBrowser: 'Chrome',
        expectedOS: 'Windows 10',
      },
      {
        ua: 'SomeUnknown/1.0',
        expectedType: 'desktop',
        expectedBrowser: 'Unknown Browser',
        expectedOS: 'Unknown OS',
      },
      {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
        expectedType: 'desktop',
        expectedBrowser: 'Safari',
        expectedOS: 'macOS',
      },
      {
        // 简化的 iOS UA(不含 "Mac OS X"),走 iOS 分支
        ua: 'Mozilla/5.0 (iPhone OS 15_0 like) AppleWebKit/605.1.15 OS 15_0 Safari/604.1',
        expectedType: 'mobile',
        expectedBrowser: 'Safari',
        expectedOS: 'iOS 15.0',
      },
      {
        // 简化的 iOS UA(无版本号)
        ua: 'Mozilla/5.0 (iPad) AppleWebKit/605.1.15 Safari/604.1',
        expectedType: 'desktop',
        expectedBrowser: 'Safari',
        expectedOS: 'iOS',
      },
      {
        // Android 简化 UA(无版本号)
        ua: 'Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 Chrome/90 Safari/537.36',
        expectedType: 'mobile',
        expectedBrowser: 'Chrome',
        expectedOS: 'Android',
      },
    ]

    testCases.forEach(({ ua, expectedType, expectedBrowser, expectedOS }) => {
      it(`UA: ${expectedBrowser}/${expectedOS}/${expectedType}`, () => {
        setUserAgent(ua)
        const device = manager.registerCurrentDevice()
        expect(device.type).toBe(expectedType)
        expect(device.name).toContain(expectedBrowser)
        expect(device.name).toContain(expectedOS)
      })
    })
  })

  // 异常分支
  describe('异常分支', () => {
    it('localStorage 中存了无效 JSON 时应重置', async () => {
      localStorage.setItem('sync-devices', '{not valid json')
      const m = await reloadManager()
      expect(m.getDeviceCount()).toBe(0)
    })

    it('localStorage 写入失败时应调用 logger.warn', async () => {
      manager.registerCurrentDevice()
      const loggerMod = await import('../logger')
      const warnSpy = vi.spyOn(loggerMod.logger, 'warn').mockImplementation(() => {})
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota')
      })
      // 重新注册会触发 saveDevices
      manager.registerCurrentDevice()
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  // 设备 ID 自动生成
  describe('设备ID自动生成', () => {
    it('首次访问应生成新的设备ID', async () => {
      localStorage.clear()
      const m = await reloadManager()
      m.registerCurrentDevice()
      const id = localStorage.getItem('current-device-id')
      expect(id).toBeTruthy()
      expect(id).toMatch(/^device-/)
    })

    it('已存在设备ID时应复用', async () => {
      localStorage.setItem('current-device-id', 'preset-id-123')
      const m = await reloadManager()
      const device = m.registerCurrentDevice()
      expect(device.id).toBe('preset-id-123')
    })
  })
})
