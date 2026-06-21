import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  useMediaQuery,
  useBreakpoints,
  usePreferredDark,
  usePreferredLight,
  usePreferredReducedMotion,
  usePreferredContrast,
} from '../useMediaQuery'

const mockMatchMedia = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

vi.stubGlobal('matchMedia', mockMatchMedia)

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: vi.fn((fn) => fn()),
    onUnmounted: vi.fn(),
  }
})

// 辅助函数：根据 query 内容判断是否匹配，用于断点测试
const mockMatchByQuery = (matchFn: (query: string) => boolean) => {
  mockMatchMedia.mockImplementation((query: string) => ({
    matches: matchFn(query),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

// 辅助函数：按断点设置 mock，使指定断点匹配为 true
const mockBreakpoint = (bp: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl') => {
  mockMatchByQuery((query) => {
    if (bp === 'xs' && query.includes('max-width: 639')) return true
    if (bp === 'sm' && query.includes('min-width: 640') && query.includes('max-width: 767')) return true
    if (bp === 'md' && query.includes('min-width: 768') && query.includes('max-width: 1023')) return true
    if (bp === 'lg' && query.includes('min-width: 1024') && query.includes('max-width: 1279')) return true
    if (bp === 'xl' && query.includes('min-width: 1280') && query.includes('max-width: 1535')) return true
    if (bp === '2xl' && query.includes('min-width: 1536')) return true
    return false
  })
}

describe('useMediaQuery.ts', () => {
  beforeEach(() => {
    mockMatchMedia.mockReset()
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  describe('useMediaQuery', () => {
    it('应该返回匹配状态', () => {
      const matches = useMediaQuery('(min-width: 768px)')
      expect(typeof matches.value).toBe('boolean')
    })

    it('应该反映初始匹配状态为 true', () => {
      // mock 一次返回 matches: true
      mockMatchMedia.mockReturnValueOnce({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      const matches = useMediaQuery('(min-width: 768px)')
      expect(matches.value).toBe(true)
    })

    it('SSR 场景下 window 不存在时应返回 false', () => {
      // 临时移除 window 模拟 SSR 环境
      const originalWindow = global.window
      // @ts-expect-error 测试需要移除 window
      delete global.window
      const matches = useMediaQuery('(min-width: 768px)')
      expect(matches.value).toBe(false)
      global.window = originalWindow
    })

    it('事件触发时应更新 matches 值', () => {
      // 捕获事件处理函数，模拟媒体查询变化
      const handlerRef: { fn?: (event: { matches: boolean }) => void } = {}
      mockMatchMedia.mockReturnValueOnce({
        matches: false,
        addEventListener: vi.fn((event, fn) => { handlerRef.fn = fn }),
        removeEventListener: vi.fn(),
      })
      const matches = useMediaQuery('(min-width: 768px)')
      expect(matches.value).toBe(false)
      // 模拟事件触发：变为 true
      handlerRef.fn!({ matches: true })
      expect(matches.value).toBe(true)
      // 模拟事件触发：变回 false
      handlerRef.fn!({ matches: false })
      expect(matches.value).toBe(false)
    })
  })

  describe('useBreakpoints', () => {
    it('应该返回所有断点状态', () => {
      const breakpoints = useBreakpoints()

      expect(breakpoints.current).toBeDefined()
      expect(breakpoints.xs).toBeDefined()
      expect(breakpoints.sm).toBeDefined()
      expect(breakpoints.md).toBeDefined()
      expect(breakpoints.lg).toBeDefined()
      expect(breakpoints.xl).toBeDefined()
      expect(breakpoints['2xl']).toBeDefined()
    })

    it('isMobile应该是布尔值', () => {
      const { isMobile } = useBreakpoints()
      expect(typeof isMobile.value).toBe('boolean')
    })

    it('isTablet应该是布尔值', () => {
      const { isTablet } = useBreakpoints()
      expect(typeof isTablet.value).toBe('boolean')
    })

    it('isDesktop应该是布尔值', () => {
      const { isDesktop } = useBreakpoints()
      expect(typeof isDesktop.value).toBe('boolean')
    })

    it('greater应该返回布尔值', () => {
      const { greater } = useBreakpoints()
      const isGreaterMd = greater('md')
      expect(typeof isGreaterMd.value).toBe('boolean')
    })

    it('smaller应该返回布尔值', () => {
      const { smaller } = useBreakpoints()
      const isSmallerLg = smaller('lg')
      expect(typeof isSmallerLg.value).toBe('boolean')
    })

    it('between应该返回布尔值', () => {
      const { between } = useBreakpoints()
      const isBetween = between('sm', 'lg')
      expect(typeof isBetween.value).toBe('boolean')
    })

    it('current 在所有断点都不匹配时返回 2xl', () => {
      // 默认 mock 返回 matches: false，所有断点都不匹配，最终返回 2xl
      const { current } = useBreakpoints()
      expect(current.value).toBe('2xl')
    })

    it('current 在 xs 匹配时返回 xs，isMobile 为 true', () => {
      mockBreakpoint('xs')
      const { current, isMobile, isTablet, isDesktop } = useBreakpoints()
      expect(current.value).toBe('xs')
      expect(isMobile.value).toBe(true)
      expect(isTablet.value).toBe(false)
      expect(isDesktop.value).toBe(false)
    })

    it('current 在 sm 匹配时返回 sm，isMobile 为 true', () => {
      mockBreakpoint('sm')
      const { current, isMobile, isTablet, isDesktop } = useBreakpoints()
      expect(current.value).toBe('sm')
      expect(isMobile.value).toBe(true)
      expect(isTablet.value).toBe(false)
      expect(isDesktop.value).toBe(false)
    })

    it('current 在 md 匹配时返回 md，isTablet 为 true', () => {
      mockBreakpoint('md')
      const { current, isMobile, isTablet, isDesktop } = useBreakpoints()
      expect(current.value).toBe('md')
      expect(isMobile.value).toBe(false)
      expect(isTablet.value).toBe(true)
      expect(isDesktop.value).toBe(false)
    })

    it('current 在 lg 匹配时返回 lg，isDesktop 为 true', () => {
      mockBreakpoint('lg')
      const { current, isMobile, isTablet, isDesktop } = useBreakpoints()
      expect(current.value).toBe('lg')
      expect(isMobile.value).toBe(false)
      expect(isTablet.value).toBe(false)
      expect(isDesktop.value).toBe(true)
    })

    it('current 在 xl 匹配时返回 xl，isDesktop 为 true', () => {
      mockBreakpoint('xl')
      const { current, isMobile, isTablet, isDesktop } = useBreakpoints()
      expect(current.value).toBe('xl')
      expect(isMobile.value).toBe(false)
      expect(isTablet.value).toBe(false)
      expect(isDesktop.value).toBe(true)
    })

    it('current 在 2xl 匹配时返回 2xl，isDesktop 为 true', () => {
      mockBreakpoint('2xl')
      const { current, isMobile, isTablet, isDesktop } = useBreakpoints()
      expect(current.value).toBe('2xl')
      expect(isMobile.value).toBe(false)
      expect(isTablet.value).toBe(false)
      expect(isDesktop.value).toBe(true)
    })

    it('greater 在匹配时返回 true', () => {
      // greater('md') 查询 min-width: 768px
      mockMatchByQuery((query) => query.includes('min-width: 768'))
      const { greater } = useBreakpoints()
      expect(greater('md').value).toBe(true)
    })

    it('smaller 在匹配时返回 true', () => {
      // smaller('lg') 查询 max-width: 1023px
      mockMatchByQuery((query) => query.includes('max-width: 1023'))
      const { smaller } = useBreakpoints()
      expect(smaller('lg').value).toBe(true)
    })

    it('between 在匹配时返回 true', () => {
      // between('sm', 'lg') 查询 min-width: 640px and max-width: 1023px
      mockMatchByQuery((query) => query.includes('min-width: 640') && query.includes('max-width: 1023'))
      const { between } = useBreakpoints()
      expect(between('sm', 'lg').value).toBe(true)
    })
  })

  describe('usePreferredDark', () => {
    it('应该返回布尔值', () => {
      const prefersDark = usePreferredDark()
      expect(typeof prefersDark.value).toBe('boolean')
    })

    it('暗色模式匹配时返回 true', () => {
      mockMatchByQuery((query) => query.includes('prefers-color-scheme: dark'))
      const prefersDark = usePreferredDark()
      expect(prefersDark.value).toBe(true)
    })
  })

  describe('usePreferredLight', () => {
    it('应该返回布尔值', () => {
      const prefersLight = usePreferredLight()
      expect(typeof prefersLight.value).toBe('boolean')
    })

    it('亮色模式匹配时返回 true', () => {
      mockMatchByQuery((query) => query.includes('prefers-color-scheme: light'))
      const prefersLight = usePreferredLight()
      expect(prefersLight.value).toBe(true)
    })
  })

  describe('usePreferredReducedMotion', () => {
    it('应该返回布尔值', () => {
      const prefersReducedMotion = usePreferredReducedMotion()
      expect(typeof prefersReducedMotion.value).toBe('boolean')
    })

    it('减少动画匹配时返回 true', () => {
      mockMatchByQuery((query) => query.includes('prefers-reduced-motion: reduce'))
      const prefersReducedMotion = usePreferredReducedMotion()
      expect(prefersReducedMotion.value).toBe(true)
    })
  })

  describe('usePreferredContrast', () => {
    it('默认返回 no-preference', () => {
      // 默认 mock 返回 matches: false，两个查询都不匹配
      const prefersContrast = usePreferredContrast()
      expect(prefersContrast.value).toBe('no-preference')
    })

    it('more 匹配时返回 more', () => {
      mockMatchByQuery((query) => query.includes('prefers-contrast: more'))
      const prefersContrast = usePreferredContrast()
      expect(prefersContrast.value).toBe('more')
    })

    it('less 匹配时返回 less', () => {
      mockMatchByQuery((query) => query.includes('prefers-contrast: less'))
      const prefersContrast = usePreferredContrast()
      expect(prefersContrast.value).toBe('less')
    })
  })
})
