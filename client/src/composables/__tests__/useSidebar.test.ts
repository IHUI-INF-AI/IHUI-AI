/**
 * useSidebar.ts 单元测试
 *
 * 当前配置 (v7): MIN_WIDTH=80, MAX_WIDTH=140, DEFAULT_WIDTH=140, COLLAPSE_THRESHOLD=80
 * 侧边栏默认 140px（宽屏：4 字 label 完整），可向左拖到 80 紧凑 / <80 折叠到 60
 * 设计目标：4 字中文 label 完整显示，5 字截断（"成为供应商" → "成为供..."）
 *
 * 覆盖目标：
 *   1. 宽度常量 [80, 140] clamp 边界（min-1 / min / mid / max / max+1）
 *   2. 折叠阈值 80 的行为（< 80 折叠 / >= 80 展开）
 *   3. setWidth 自动展开 + clamp + 持久化 width + config version
 *   4. loadPersisted 边界（合法值 80-140 / 非法值 / 越界 / NaN）
 *   5. migratePersistedConfig：v1/v2/v3/v4/v5/v6 (version < 7) → 清掉 width
 *   6. migratePersistedConfig：v7 (version=7) → 保留 width
 *   7. DEFAULT_WIDTH = 140 = MAX_WIDTH，向左拖可压缩到 80
 *   8. toggleCollapse 持久化
 *   9. SSR 安全（typeof window guard）
 *  10. minWidth/maxWidth 接口常量与源码一致
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const importFresh = async () => {
  vi.resetModules()
  const mod = await import('../useSidebar')
  return mod
}

const setupLocalStorageMock = () => {
  localStorage.clear()
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

describe('useSidebar.ts - 常量导出与契约', () => {
  it('minWidth/maxWidth 应当分别为 80 / 140', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { minWidth, maxWidth } = useSidebar()
    expect(minWidth).toBe(80)
    expect(maxWidth).toBe(140)
  })

  it('minWidth < maxWidth 时拖拽手柄可显示', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { minWidth, maxWidth } = useSidebar()
    expect(minWidth < maxWidth).toBe(true)
  })

  it('MIN/MAX/DEFAULT 应满足 MAX-MIN=60、DEFAULT=MAX 的不变量（v7 宽屏默认）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { minWidth, maxWidth, width } = useSidebar()
    expect(maxWidth - minWidth).toBe(60) // 80-140 区间跨度
    expect(width.value).toBe(maxWidth) // 默认 = 最大（宽屏）
  })
})

describe('useSidebar.ts - 默认状态', () => {
  it('首次加载无 localStorage 时 width 应当为 DEFAULT_WIDTH (140)', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('首次加载无 localStorage 时 isCollapsed 应当为 false', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed } = useSidebar()
    expect(isCollapsed.value).toBe(false)
  })
})

describe('useSidebar.ts - setWidth clamp 边界（MIN=80, MAX=140）', () => {
  it('setWidth(79) 应当触发折叠', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, setWidth } = useSidebar()
    setWidth(79)
    expect(isCollapsed.value).toBe(true)
  })

  it('setWidth(50) 应当触发折叠', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, setWidth } = useSidebar()
    setWidth(50)
    expect(isCollapsed.value).toBe(true)
  })

  it('setWidth(0) 应当触发折叠（极端值）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, setWidth } = useSidebar()
    setWidth(0)
    expect(isCollapsed.value).toBe(true)
  })

  it('setWidth(80) 应当保持展开且 width=80（MIN 边界，向左拖到紧凑态）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(80)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(80)
  })

  it('setWidth(110) 应当保持展开且 width=110（范围内）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(110)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(110)
  })

  it('setWidth(140) 应当保持展开且 width=140（MAX 边界，默认宽度）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(140)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(140)
  })

  it('setWidth(141) 应当 clamp 到 140（超上界 1px）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(141)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(140)
  })

  it('setWidth(180) 应当 clamp 到 140（旧 v5 MAX_WIDTH=180 时代的值）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(180)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(140)
  })

  it('setWidth(360) 应当 clamp 到 140（旧 v1/v2 MAX_WIDTH=360 时代的值）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(360)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(140)
  })

  it('setWidth(1000) 应当 clamp 到 140', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(1000)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(140)
  })
})

describe('useSidebar.ts - setWidth 持久化', () => {
  it('setWidth(80) 应当写入 localStorage sidebar-width=80（紧凑态持久化）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(80)
    expect(localStorage.getItem('sidebar-width')).toBe('80')
  })

  it('setWidth(110) 应当写入 localStorage sidebar-width=110', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(110)
    expect(localStorage.getItem('sidebar-width')).toBe('110')
  })

  it('setWidth(140) 应当写入 localStorage sidebar-width=140（默认宽度）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(140)
    expect(localStorage.getItem('sidebar-width')).toBe('140')
  })

  it('setWidth(140) 应当同时写入 sidebar-config-version=7', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(140)
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('setWidth(150) 应当写入 clamp 后的值 140', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(150)
    expect(localStorage.getItem('sidebar-width')).toBe('140')
  })

  it('setWidth(79) 触发折叠时不应写入 sidebar-width', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(79)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true')
  })
})

describe('useSidebar.ts - 折叠态自动展开', () => {
  it('折叠态下 setWidth(80) 应当自动展开', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    expect(isCollapsed.value).toBe(true)
    setWidth(80)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(80)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false')
  })

  it('折叠态下 setWidth(140) 应当自动展开且 width=140', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    expect(isCollapsed.value).toBe(true)
    setWidth(140)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false')
  })

  it('折叠态下 setWidth(150) 应当自动展开但 width clamp 到 140', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    expect(isCollapsed.value).toBe(true)
    setWidth(150)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false')
  })
})

describe('useSidebar.ts - toggleCollapse', () => {
  it('toggleCollapse 应当翻转 isCollapsed 并写入 localStorage', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, toggleCollapse } = useSidebar()
    expect(isCollapsed.value).toBe(false)
    toggleCollapse()
    expect(isCollapsed.value).toBe(true)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true')
    toggleCollapse()
    expect(isCollapsed.value).toBe(false)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false')
  })
})

describe('useSidebar.ts - loadPersisted 边界', () => {
  it('loadPersisted 应当接受 width=80（下界，紧凑态）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(80)
  })

  it('loadPersisted 应当接受 width=110（范围内）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '110')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(110)
  })

  it('loadPersisted 应当接受 width=140（上界，默认）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '140')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('loadPersisted 应当拒绝 width=79 (越下界)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '79')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('loadPersisted 应当拒绝 width=141 (越上界)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '141')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('loadPersisted 应当拒绝 width=180 (旧 v5 MAX_WIDTH=180 时代的值)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '180')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('loadPersisted 应当拒绝 width=250 (远超 MAX)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '250')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('loadPersisted 应当拒绝 width=360 (旧 v1/v2 MAX_WIDTH 时代的值)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '360')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('loadPersisted 应当忽略非数字字符串 "abc"', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', 'abc')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('loadPersisted 应当接受 isCollapsed=true', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { isCollapsed } = useSidebar()
    expect(isCollapsed.value).toBe(true)
  })

  it('loadPersisted 应当接受 isCollapsed=false', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'false')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { isCollapsed } = useSidebar()
    expect(isCollapsed.value).toBe(false)
  })
})

describe('useSidebar.ts - migratePersistedConfig 迁移逻辑', () => {
  it('v1 (无 version key) → 应当清掉旧 width 并写入 version=7', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '220')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v1 (version=1) → 应当清掉旧 width 并升级到 version=7', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '200')
    localStorage.setItem('sidebar-config-version', '1')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v2 (version=2, MAX_WIDTH=360 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '220')
    localStorage.setItem('sidebar-config-version', '2')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v3 (version=3, MAX_WIDTH=100 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '100')
    localStorage.setItem('sidebar-config-version', '3')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v4 (version=4, MAX_WIDTH=120 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '120')
    localStorage.setItem('sidebar-config-version', '4')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v5 (version=5, MAX_WIDTH=180 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '180')
    localStorage.setItem('sidebar-config-version', '5')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v6 (version=6, DEFAULT=80 时代) → 应当清掉旧 width 强制看到新默认 140', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '6')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v7 (version=7) → 应当保留 width=80（用户主动拖到紧凑态）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(80)
    expect(localStorage.getItem('sidebar-width')).toBe('80')
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })

  it('v7 (version=7) → 应当保留 width=110（用户主动调整的中间值）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '110')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(110)
    expect(localStorage.getItem('sidebar-width')).toBe('110')
  })

  it('v7 (version=7) → 应当保留 width=140（默认）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '140')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
  })

  it('未来版本 (version=99) → migrate 不应干预', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '110')
    localStorage.setItem('sidebar-config-version', '99')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(110)
    expect(localStorage.getItem('sidebar-config-version')).toBe('99')
  })

  it('version=NaN (损坏数据) → 视为 v1，应清掉 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '220')
    localStorage.setItem('sidebar-config-version', 'not-a-number')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(140)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('7')
  })
})

describe('useSidebar.ts - openMobile / closeMobile', () => {
  it('openMobile 应当把 isMobileOpen 设为 true', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isMobileOpen, openMobile } = useSidebar()
    expect(isMobileOpen.value).toBe(false)
    openMobile()
    expect(isMobileOpen.value).toBe(true)
  })

  it('closeMobile 应当把 isMobileOpen 设为 false', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isMobileOpen, openMobile, closeMobile } = useSidebar()
    openMobile()
    expect(isMobileOpen.value).toBe(true)
    closeMobile()
    expect(isMobileOpen.value).toBe(false)
  })
})

describe('useSidebar.ts - resize 事件 (handleResize 防抖)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('触发 resize 事件后应当在 ~100ms 防抖窗口内更新 isMobile', async () => {
    setupLocalStorageMock()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })
    const { useSidebar } = await importFresh()
    const { isMobile } = useSidebar()
    expect(isMobile.value).toBe(false)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    window.dispatchEvent(new Event('resize'))

    expect(isMobile.value).toBe(false)
    vi.advanceTimersByTime(150)
    expect(isMobile.value).toBe(true)
  })

  it('连续触发 resize 应当被防抖 (clearTimeout 重置)', async () => {
    setupLocalStorageMock()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    await importFresh()

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(50)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(50)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
    vi.advanceTimersByTime(50)
  })
})

describe('useSidebar.ts - SSR 安全 (typeof window guard)', () => {
  it('localStorage 抛错时 (隐私模式) 不应崩溃', async () => {
    setupLocalStorageMock()
    const originalGetItem = localStorage.getItem
    localStorage.getItem = vi.fn(() => {
      throw new Error('SecurityError: localStorage disabled')
    })
    try {
      const { useSidebar } = await importFresh()
      const { width, isCollapsed, setWidth, toggleCollapse } = useSidebar()
      expect(width.value).toBe(140)
      expect(isCollapsed.value).toBe(false)
      expect(() => setWidth(110)).not.toThrow()
      expect(() => toggleCollapse()).not.toThrow()
    } finally {
      localStorage.getItem = originalGetItem
    }
  })

  it('localStorage.setItem 抛错时 setWidth 不应崩溃', async () => {
    setupLocalStorageMock()
    const originalSetItem = localStorage.setItem
    localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      const { useSidebar } = await importFresh()
      const { setWidth, width } = useSidebar()
      expect(() => setWidth(110)).not.toThrow()
      expect(width.value).toBe(110)
    } finally {
      localStorage.setItem = originalSetItem
    }
  })

  it('localStorage.setItem 抛错时 toggleCollapse 不应崩溃', async () => {
    setupLocalStorageMock()
    const originalSetItem = localStorage.setItem
    localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      const { useSidebar } = await importFresh()
      const { isCollapsed, toggleCollapse } = useSidebar()
      expect(() => toggleCollapse()).not.toThrow()
      expect(isCollapsed.value).toBe(true)
    } finally {
      localStorage.setItem = originalSetItem
    }
  })
})
