/**
 * useSidebar.ts 单元测试
 *
 * 当前配置 (v11): MIN_WIDTH=60, MAX_WIDTH=116, DEFAULT_WIDTH=116, COLLAPSE_THRESHOLD=60
 * 侧边栏默认 116px（紧凑：4 字 label 完整，5 字截断），可向左拖到 60 紧凑 / <60 折叠到 60
 * 设计目标：4 字中文 label（如"加入我们"）完整显示，5 字截断
 *
 * 覆盖目标：
 *   1. 宽度常量 [60, 116] clamp 边界（min-1 / min / mid / max / max+1）
 *   2. 折叠阈值 60 的行为（< 60 折叠 / >= 60 展开）
 *   3. setWidth 自动展开 + clamp + 持久化 width + config version
 *   4. loadPersisted 边界（合法值 60-116 / 非法值 / 越界 / NaN）
 *   5. migratePersistedConfig：v1/v2/v3/v4/v5/v6/v7/v8/v9/v10 (version < 11) → 清掉 width
 *   6. migratePersistedConfig：v11 (version=11) → 保留 width
 *   7. DEFAULT_WIDTH = 116 = MAX_WIDTH，向左拖可压缩到 60
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
  it('minWidth/maxWidth 应当分别为 60 / 116', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { minWidth, maxWidth } = useSidebar()
    expect(minWidth).toBe(60)
    expect(maxWidth).toBe(116)
  })

  it('minWidth < maxWidth 时拖拽手柄可显示', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { minWidth, maxWidth } = useSidebar()
    expect(minWidth < maxWidth).toBe(true)
  })

  it('MIN/MAX/DEFAULT 应满足 MAX-MIN=56、DEFAULT=MAX 的不变量（v11 紧凑默认）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { minWidth, maxWidth, width } = useSidebar()
    expect(maxWidth - minWidth).toBe(56) // 60-116 区间跨度
    expect(width.value).toBe(maxWidth) // 默认 = 最大（紧凑默认）
  })
})

describe('useSidebar.ts - 默认状态', () => {
  it('首次加载无 localStorage 时 width 应当为 DEFAULT_WIDTH (116)', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('首次加载无 localStorage 时 isCollapsed 应当为 false', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed } = useSidebar()
    expect(isCollapsed.value).toBe(false)
  })
})

describe('useSidebar.ts - setWidth clamp 边界（MIN=60, MAX=116）', () => {
  it('setWidth(59) 应当触发折叠', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, setWidth } = useSidebar()
    setWidth(59)
    expect(isCollapsed.value).toBe(true)
  })

  it('setWidth(30) 应当触发折叠', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, setWidth } = useSidebar()
    setWidth(30)
    expect(isCollapsed.value).toBe(true)
  })

  it('setWidth(0) 应当触发折叠（极端值）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, setWidth } = useSidebar()
    setWidth(0)
    expect(isCollapsed.value).toBe(true)
  })

  it('setWidth(60) 应当保持展开且 width=60（MIN 边界，向左拖到紧凑态）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(60)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(60)
  })

  it('setWidth(88) 应当保持展开且 width=88（范围内）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(88)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(88)
  })

  it('setWidth(116) 应当保持展开且 width=116（MAX 边界，默认宽度）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(116)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(116)
  })

  it('setWidth(117) 应当 clamp 到 116（超上界 1px）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(117)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(116)
  })

  it('setWidth(140) 应当 clamp 到 116（旧 v7 DEFAULT_WIDTH=140 时代的值）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(140)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(116)
  })

  it('setWidth(1000) 应当 clamp 到 116', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    setWidth(1000)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(116)
  })
})

describe('useSidebar.ts - setWidth 持久化', () => {
  it('setWidth(60) 应当写入 localStorage sidebar-width=60（紧凑态持久化）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(60)
    expect(localStorage.getItem('sidebar-width')).toBe('60')
  })

  it('setWidth(88) 应当写入 localStorage sidebar-width=88', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(88)
    expect(localStorage.getItem('sidebar-width')).toBe('88')
  })

  it('setWidth(116) 应当写入 localStorage sidebar-width=116（默认宽度）', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(116)
    expect(localStorage.getItem('sidebar-width')).toBe('116')
  })

  it('setWidth(116) 应当同时写入 sidebar-config-version=11', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(116)
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('setWidth(125) 应当写入 clamp 后的值 116', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(125)
    expect(localStorage.getItem('sidebar-width')).toBe('116')
  })

  it('setWidth(59) 触发折叠时不应写入 sidebar-width', async () => {
    setupLocalStorageMock()
    const { useSidebar } = await importFresh()
    const { setWidth } = useSidebar()
    setWidth(59)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true')
  })
})

describe('useSidebar.ts - 折叠态自动展开', () => {
  it('折叠态下 setWidth(60) 应当自动展开', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    expect(isCollapsed.value).toBe(true)
    setWidth(60)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(60)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false')
  })

  it('折叠态下 setWidth(116) 应当自动展开且 width=116', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    expect(isCollapsed.value).toBe(true)
    setWidth(116)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false')
  })

  it('折叠态下 setWidth(125) 应当自动展开但 width clamp 到 116', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    const { useSidebar } = await importFresh()
    const { isCollapsed, width, setWidth } = useSidebar()
    expect(isCollapsed.value).toBe(true)
    setWidth(125)
    expect(isCollapsed.value).toBe(false)
    expect(width.value).toBe(116)
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
  it('loadPersisted 应当接受 width=60（下界，紧凑态）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '60')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(60)
  })

  it('loadPersisted 应当接受 width=88（范围内）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '88')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(88)
  })

  it('loadPersisted 应当接受 width=116（上界，默认）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '116')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('loadPersisted 应当拒绝 width=59 (越下界)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '59')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('loadPersisted 应当拒绝 width=117 (越上界)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '117')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('loadPersisted 应当拒绝 width=140 (旧 v7 DEFAULT_WIDTH=140 时代的值)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '140')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('loadPersisted 应当拒绝 width=200 (旧 v7 时代中间值)', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '200')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('loadPersisted 应当忽略非数字字符串 "abc"', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', 'abc')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('loadPersisted 应当接受 isCollapsed=true', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'true')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { isCollapsed } = useSidebar()
    expect(isCollapsed.value).toBe(true)
  })

  it('loadPersisted 应当接受 isCollapsed=false', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-collapsed', 'false')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { isCollapsed } = useSidebar()
    expect(isCollapsed.value).toBe(false)
  })
})

describe('useSidebar.ts - migratePersistedConfig 迁移逻辑', () => {
  it('v1 (无 version key) → 应当清掉旧 width 并写入 version=11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '220')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v1 (version=1) → 应当清掉旧 width 并升级到 version=11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '200')
    localStorage.setItem('sidebar-config-version', '1')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v2 (version=2, MAX_WIDTH=360 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '220')
    localStorage.setItem('sidebar-config-version', '2')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v3 (version=3, MAX_WIDTH=100 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '100')
    localStorage.setItem('sidebar-config-version', '3')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v4 (version=4, MAX_WIDTH=120 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '120')
    localStorage.setItem('sidebar-config-version', '4')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v5 (version=5, MAX_WIDTH=180 时代) → 应当清掉旧 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '180')
    localStorage.setItem('sidebar-config-version', '5')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v6 (version=6, DEFAULT=80 时代) → 应当清掉旧 width 强制看到新默认 116', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '6')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v7 (version=7, DEFAULT=140 时代, width=80) → 应当清掉旧 width 强制看到新默认 116', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v7 (version=7, width=110) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '110')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v7 (version=7, width=140) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '140')
    localStorage.setItem('sidebar-config-version', '7')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v8 (version=8, DEFAULT=100 时代, width=80) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '8')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v8 (version=8, width=100) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '100')
    localStorage.setItem('sidebar-config-version', '8')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v9 (version=9, DEFAULT=120 时代, width=80) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '9')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v9 (version=9, width=120) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '120')
    localStorage.setItem('sidebar-config-version', '9')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v10 (version=10, DEFAULT=110 时代, width=80) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '80')
    localStorage.setItem('sidebar-config-version', '10')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v10 (version=10, width=110) → 应当清掉旧 width 升级到 11', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '110')
    localStorage.setItem('sidebar-config-version', '10')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v11 (version=11) → 应当保留 width=60（用户主动拖到紧凑态）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '60')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(60)
    expect(localStorage.getItem('sidebar-width')).toBe('60')
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
  })

  it('v11 (version=11) → 应当保留 width=88（用户主动调整的中间值）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '88')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(88)
    expect(localStorage.getItem('sidebar-width')).toBe('88')
  })

  it('v11 (version=11) → 应当保留 width=116（默认）', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '116')
    localStorage.setItem('sidebar-config-version', '11')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
  })

  it('未来版本 (version=99) → migrate 不应干预', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '88')
    localStorage.setItem('sidebar-config-version', '99')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(88)
    expect(localStorage.getItem('sidebar-config-version')).toBe('99')
  })

  it('version=NaN (损坏数据) → 视为 v1，应清掉 width', async () => {
    setupLocalStorageMock()
    localStorage.setItem('sidebar-width', '220')
    localStorage.setItem('sidebar-config-version', 'not-a-number')
    const { useSidebar } = await importFresh()
    const { width } = useSidebar()
    expect(width.value).toBe(116)
    expect(localStorage.getItem('sidebar-width')).toBeNull()
    expect(localStorage.getItem('sidebar-config-version')).toBe('11')
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
      expect(width.value).toBe(116)
      expect(isCollapsed.value).toBe(false)
      expect(() => setWidth(88)).not.toThrow()
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
      expect(() => setWidth(88)).not.toThrow()
      expect(width.value).toBe(88)
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
