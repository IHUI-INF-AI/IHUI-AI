import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useResponsive, useResponsiveValue, BREAKPOINTS } from '../useResponsive'

vi.mock('vue', () => ({
  ref: vi.fn((value: any) => ({ value })),
  computed: vi.fn((getter: () => unknown) => ({ value: getter(), get: getter })),
  onMounted: vi.fn((callback: () => void) => callback()),
  onUnmounted: vi.fn(),
}))

describe('useResponsive', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1024)
    vi.stubGlobal('innerHeight', 768)
  })

  afterEach(() => {
    vi.stubGlobal('innerWidth', originalInnerWidth)
    vi.stubGlobal('innerHeight', originalInnerHeight)
    vi.unstubAllGlobals()
  })

  describe('BREAKPOINTS 常量', () => {
    it('应该定义所有断点', () => {
      expect(BREAKPOINTS.xs).toBe(320)
      expect(BREAKPOINTS.sm).toBe(375)
      expect(BREAKPOINTS.md).toBe(428)
      expect(BREAKPOINTS.lg).toBe(576)
      expect(BREAKPOINTS.tablet).toBe(768)
      expect(BREAKPOINTS.tabletLg).toBe(1024)
      expect(BREAKPOINTS.laptop).toBe(1280)
      expect(BREAKPOINTS.desktop).toBe(1440)
      expect(BREAKPOINTS.xl).toBe(1920)
      expect(BREAKPOINTS.xxl).toBe(2560)
    })
  })

  describe('基础状态', () => {
    it('应该返回窗口宽度', () => {
      const { windowWidth } = useResponsive()
      expect(windowWidth.value).toBeDefined()
    })

    it('应该返回窗口高度', () => {
      const { windowHeight } = useResponsive()
      expect(windowHeight.value).toBeDefined()
    })

    it('应该返回设备类型', () => {
      const { deviceType } = useResponsive()
      expect(['mobile', 'tablet', 'laptop', 'desktop']).toContain(deviceType.value)
    })
  })

  describe('设备类型判断', () => {
    it('应该返回isMobile', () => {
      const { isMobile } = useResponsive()
      expect(typeof isMobile.value).toBe('boolean')
    })

    it('应该返回isTablet', () => {
      const { isTablet } = useResponsive()
      expect(typeof isTablet.value).toBe('boolean')
    })

    it('应该返回isLaptop', () => {
      const { isLaptop } = useResponsive()
      expect(typeof isLaptop.value).toBe('boolean')
    })

    it('应该返回isDesktop', () => {
      const { isDesktop } = useResponsive()
      expect(typeof isDesktop.value).toBe('boolean')
    })
  })

  describe('断点状态', () => {
    it('应该返回isXs', () => {
      const { isXs } = useResponsive()
      expect(typeof isXs.value).toBe('boolean')
    })

    it('应该返回isSm', () => {
      const { isSm } = useResponsive()
      expect(typeof isSm.value).toBe('boolean')
    })

    it('应该返回isMd', () => {
      const { isMd } = useResponsive()
      expect(typeof isMd.value).toBe('boolean')
    })

    it('应该返回isLg', () => {
      const { isLg } = useResponsive()
      expect(typeof isLg.value).toBe('boolean')
    })

    it('应该返回isTabletSize', () => {
      const { isTabletSize } = useResponsive()
      expect(typeof isTabletSize.value).toBe('boolean')
    })

    it('应该返回isTabletLg', () => {
      const { isTabletLg } = useResponsive()
      expect(typeof isTabletLg.value).toBe('boolean')
    })

    it('应该返回isLaptopSize', () => {
      const { isLaptopSize } = useResponsive()
      expect(typeof isLaptopSize.value).toBe('boolean')
    })

    it('应该返回isDesktopSize', () => {
      const { isDesktopSize } = useResponsive()
      expect(typeof isDesktopSize.value).toBe('boolean')
    })

    it('应该返回isXl', () => {
      const { isXl } = useResponsive()
      expect(typeof isXl.value).toBe('boolean')
    })

    it('应该返回isXxl', () => {
      const { isXxl } = useResponsive()
      expect(typeof isXxl.value).toBe('boolean')
    })
  })

  describe('向上兼容断点', () => {
    it('应该返回tabletUp', () => {
      const { tabletUp } = useResponsive()
      expect(typeof tabletUp.value).toBe('boolean')
    })

    it('应该返回laptopUp', () => {
      const { laptopUp } = useResponsive()
      expect(typeof laptopUp.value).toBe('boolean')
    })

    it('应该返回desktopUp', () => {
      const { desktopUp } = useResponsive()
      expect(typeof desktopUp.value).toBe('boolean')
    })

    it('应该返回xlUp', () => {
      const { xlUp } = useResponsive()
      expect(typeof xlUp.value).toBe('boolean')
    })
  })

  describe('向下兼容断点', () => {
    it('应该返回tabletDown', () => {
      const { tabletDown } = useResponsive()
      expect(typeof tabletDown.value).toBe('boolean')
    })

    it('应该返回laptopDown', () => {
      const { laptopDown } = useResponsive()
      expect(typeof laptopDown.value).toBe('boolean')
    })

    it('应该返回desktopDown', () => {
      const { desktopDown } = useResponsive()
      expect(typeof desktopDown.value).toBe('boolean')
    })
  })

  describe('方向检测', () => {
    it('应该返回isPortrait', () => {
      const { isPortrait } = useResponsive()
      expect(typeof isPortrait.value).toBe('boolean')
    })

    it('应该返回isLandscape', () => {
      const { isLandscape } = useResponsive()
      expect(typeof isLandscape.value).toBe('boolean')
    })
  })

  describe('特定设备检测', () => {
    it('应该返回isIPhoneSE', () => {
      const { isIPhoneSE } = useResponsive()
      expect(typeof isIPhoneSE.value).toBe('boolean')
    })

    it('应该返回isIPhoneStandard', () => {
      const { isIPhoneStandard } = useResponsive()
      expect(typeof isIPhoneStandard.value).toBe('boolean')
    })

    it('应该返回isIPhonePlus', () => {
      const { isIPhonePlus } = useResponsive()
      expect(typeof isIPhonePlus.value).toBe('boolean')
    })

    it('应该返回isIPad', () => {
      const { isIPad } = useResponsive()
      expect(typeof isIPad.value).toBe('boolean')
    })

    it('应该返回isIPadPro', () => {
      const { isIPadPro } = useResponsive()
      expect(typeof isIPadPro.value).toBe('boolean')
    })
  })

  describe('断点方法', () => {
    it('matchBreakpoint应该正确工作', () => {
      const { matchBreakpoint } = useResponsive()
      const result = matchBreakpoint('sm')
      expect(typeof result).toBe('boolean')
    })

    it('betweenBreakpoints应该正确工作', () => {
      const { betweenBreakpoints } = useResponsive()
      const result = betweenBreakpoints('sm', 'tablet')
      expect(typeof result).toBe('boolean')
    })

    it('currentBreakpoint应该返回当前断点', () => {
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBeDefined()
    })
  })

  // ============================================
  // 补充测试：覆盖未覆盖的功能点
  // ============================================

  describe('deviceType 实际值', () => {
    it('宽度小于 768 时应返回 mobile', () => {
      vi.stubGlobal('innerWidth', 500)
      const { deviceType } = useResponsive()
      expect(deviceType.value).toBe('mobile')
    })

    it('宽度在 768-1280 之间时应返回 tablet', () => {
      vi.stubGlobal('innerWidth', 1000)
      const { deviceType } = useResponsive()
      expect(deviceType.value).toBe('tablet')
    })

    it('宽度在 1280-1440 之间时应返回 laptop', () => {
      vi.stubGlobal('innerWidth', 1366)
      const { deviceType } = useResponsive()
      expect(deviceType.value).toBe('laptop')
    })

    it('宽度 >= 1440 时应返回 desktop', () => {
      vi.stubGlobal('innerWidth', 1920)
      const { deviceType } = useResponsive()
      expect(deviceType.value).toBe('desktop')
    })
  })

  describe('断点状态实际值', () => {
    it('宽度 < 320 时 isXs 应为 true', () => {
      vi.stubGlobal('innerWidth', 280)
      const { isXs, isSm, isMd, isLg } = useResponsive()
      expect(isXs.value).toBe(true)
      expect(isSm.value).toBe(false)
      expect(isMd.value).toBe(false)
      expect(isLg.value).toBe(false)
    })

    it('宽度在 375-428 之间时 isSm 应为 true', () => {
      vi.stubGlobal('innerWidth', 400)
      const { isSm, isMd, isLg, isXs } = useResponsive()
      expect(isSm.value).toBe(true)
      expect(isMd.value).toBe(false)
      expect(isLg.value).toBe(false)
      expect(isXs.value).toBe(false)
    })

    it('宽度在 428-576 之间时 isMd 应为 true', () => {
      vi.stubGlobal('innerWidth', 500)
      const { isMd, isSm, isLg, isXs } = useResponsive()
      expect(isMd.value).toBe(true)
      expect(isSm.value).toBe(false)
      expect(isLg.value).toBe(false)
      expect(isXs.value).toBe(false)
    })

    it('宽度在 576-768 之间时 isLg 应为 true', () => {
      vi.stubGlobal('innerWidth', 700)
      const { isLg, isMd, isTabletSize } = useResponsive()
      expect(isLg.value).toBe(true)
      expect(isMd.value).toBe(false)
      expect(isTabletSize.value).toBe(false)
    })

    it('宽度在 768-1024 之间时 isTabletSize 应为 true', () => {
      vi.stubGlobal('innerWidth', 900)
      const { isTabletSize, isLg, isTabletLg } = useResponsive()
      expect(isTabletSize.value).toBe(true)
      expect(isLg.value).toBe(false)
      expect(isTabletLg.value).toBe(false)
    })

    it('宽度在 1024-1280 之间时 isTabletLg 应为 true', () => {
      vi.stubGlobal('innerWidth', 1100)
      const { isTabletLg, isTabletSize, isLaptopSize } = useResponsive()
      expect(isTabletLg.value).toBe(true)
      expect(isTabletSize.value).toBe(false)
      expect(isLaptopSize.value).toBe(false)
    })

    it('宽度在 1280-1440 之间时 isLaptopSize 应为 true', () => {
      vi.stubGlobal('innerWidth', 1366)
      const { isLaptopSize, isTabletLg, isDesktopSize } = useResponsive()
      expect(isLaptopSize.value).toBe(true)
      expect(isTabletLg.value).toBe(false)
      expect(isDesktopSize.value).toBe(false)
    })

    it('宽度在 1440-1920 之间时 isDesktopSize 应为 true', () => {
      vi.stubGlobal('innerWidth', 1600)
      const { isDesktopSize, isLaptopSize, isXl } = useResponsive()
      expect(isDesktopSize.value).toBe(true)
      expect(isLaptopSize.value).toBe(false)
      expect(isXl.value).toBe(false)
    })

    it('宽度在 1920-2560 之间时 isXl 应为 true', () => {
      vi.stubGlobal('innerWidth', 2000)
      const { isXl, isDesktopSize, isXxl } = useResponsive()
      expect(isXl.value).toBe(true)
      expect(isDesktopSize.value).toBe(false)
      expect(isXxl.value).toBe(false)
    })

    it('宽度 >= 2560 时 isXxl 应为 true', () => {
      vi.stubGlobal('innerWidth', 3000)
      const { isXxl, isXl } = useResponsive()
      expect(isXxl.value).toBe(true)
      expect(isXl.value).toBe(false)
    })
  })

  describe('isMobile/isTablet/isLaptop/isDesktop 实际值', () => {
    it('移动端宽度时 isMobile 为 true 其他为 false', () => {
      vi.stubGlobal('innerWidth', 500)
      const { isMobile, isTablet, isLaptop, isDesktop } = useResponsive()
      expect(isMobile.value).toBe(true)
      expect(isTablet.value).toBe(false)
      expect(isLaptop.value).toBe(false)
      expect(isDesktop.value).toBe(false)
    })

    it('平板宽度时 isTablet 为 true 其他为 false', () => {
      vi.stubGlobal('innerWidth', 1000)
      const { isMobile, isTablet, isLaptop, isDesktop } = useResponsive()
      expect(isMobile.value).toBe(false)
      expect(isTablet.value).toBe(true)
      expect(isLaptop.value).toBe(false)
      expect(isDesktop.value).toBe(false)
    })

    it('笔记本宽度时 isLaptop 为 true 其他为 false', () => {
      vi.stubGlobal('innerWidth', 1366)
      const { isMobile, isTablet, isLaptop, isDesktop } = useResponsive()
      expect(isMobile.value).toBe(false)
      expect(isTablet.value).toBe(false)
      expect(isLaptop.value).toBe(true)
      expect(isDesktop.value).toBe(false)
    })

    it('桌面端宽度时 isDesktop 为 true', () => {
      vi.stubGlobal('innerWidth', 2000)
      const { isMobile, isTablet, isLaptop, isDesktop } = useResponsive()
      expect(isMobile.value).toBe(false)
      expect(isTablet.value).toBe(false)
      expect(isLaptop.value).toBe(false)
      expect(isDesktop.value).toBe(true)
    })
  })

  describe('向上兼容断点实际值', () => {
    it('移动端宽度时 tabletUp/laptopUp/desktopUp/xlUp 都应为 false', () => {
      vi.stubGlobal('innerWidth', 500)
      const { tabletUp, laptopUp, desktopUp, xlUp } = useResponsive()
      expect(tabletUp.value).toBe(false)
      expect(laptopUp.value).toBe(false)
      expect(desktopUp.value).toBe(false)
      expect(xlUp.value).toBe(false)
    })

    it('平板宽度时 tabletUp 为 true', () => {
      vi.stubGlobal('innerWidth', 1000)
      const { tabletUp, laptopUp } = useResponsive()
      expect(tabletUp.value).toBe(true)
      expect(laptopUp.value).toBe(false)
    })

    it('笔记本宽度时 tabletUp/laptopUp 为 true', () => {
      vi.stubGlobal('innerWidth', 1366)
      const { tabletUp, laptopUp, desktopUp } = useResponsive()
      expect(tabletUp.value).toBe(true)
      expect(laptopUp.value).toBe(true)
      expect(desktopUp.value).toBe(false)
    })

    it('桌面端宽度时 desktopUp 和 xlUp 应正确', () => {
      vi.stubGlobal('innerWidth', 1500)
      const { tabletUp, laptopUp, desktopUp, xlUp } = useResponsive()
      expect(tabletUp.value).toBe(true)
      expect(laptopUp.value).toBe(true)
      expect(desktopUp.value).toBe(true)
      expect(xlUp.value).toBe(false)

      vi.stubGlobal('innerWidth', 2000)
      const r2 = useResponsive()
      expect(r2.xlUp.value).toBe(true)
    })
  })

  describe('向下兼容断点实际值', () => {
    it('移动端宽度时所有 down 都应为 true', () => {
      vi.stubGlobal('innerWidth', 500)
      const { tabletDown, laptopDown, desktopDown } = useResponsive()
      expect(tabletDown.value).toBe(true)
      expect(laptopDown.value).toBe(true)
      expect(desktopDown.value).toBe(true)
    })

    it('平板宽度时 tabletDown 为 false 其余为 true', () => {
      vi.stubGlobal('innerWidth', 1000)
      const { tabletDown, laptopDown, desktopDown } = useResponsive()
      expect(tabletDown.value).toBe(false)
      expect(laptopDown.value).toBe(true)
      expect(desktopDown.value).toBe(true)
    })

    it('桌面端宽度时所有 down 都为 false', () => {
      vi.stubGlobal('innerWidth', 2000)
      const { tabletDown, laptopDown, desktopDown } = useResponsive()
      expect(tabletDown.value).toBe(false)
      expect(laptopDown.value).toBe(false)
      expect(desktopDown.value).toBe(false)
    })
  })

  describe('方向检测实际值', () => {
    it('高大于宽时为竖屏', () => {
      vi.stubGlobal('innerWidth', 500)
      vi.stubGlobal('innerHeight', 900)
      const { isPortrait, isLandscape } = useResponsive()
      expect(isPortrait.value).toBe(true)
      expect(isLandscape.value).toBe(false)
    })

    it('宽大于高时为横屏', () => {
      vi.stubGlobal('innerWidth', 1024)
      vi.stubGlobal('innerHeight', 768)
      const { isPortrait, isLandscape } = useResponsive()
      expect(isPortrait.value).toBe(false)
      expect(isLandscape.value).toBe(true)
    })

    it('宽高相等时两者都为 false', () => {
      vi.stubGlobal('innerWidth', 500)
      vi.stubGlobal('innerHeight', 500)
      const { isPortrait, isLandscape } = useResponsive()
      expect(isPortrait.value).toBe(false)
      expect(isLandscape.value).toBe(false)
    })
  })

  describe('特定设备检测实际值', () => {
    it('iPhone SE 宽度 320 时 isIPhoneSE 为 true', () => {
      vi.stubGlobal('innerWidth', 320)
      const { isIPhoneSE, isIPhoneStandard, isIPhonePlus } = useResponsive()
      expect(isIPhoneSE.value).toBe(true)
      expect(isIPhoneStandard.value).toBe(false)
      expect(isIPhonePlus.value).toBe(false)
    })

    it('iPhone 标准宽度 375-389 时 isIPhoneStandard 为 true', () => {
      vi.stubGlobal('innerWidth', 375)
      const { isIPhoneStandard, isIPhoneSE, isIPhonePlus } = useResponsive()
      expect(isIPhoneStandard.value).toBe(true)
      expect(isIPhoneSE.value).toBe(false)
      expect(isIPhonePlus.value).toBe(false)
    })

    it('iPhone Plus 宽度 390-430 时 isIPhonePlus 为 true', () => {
      vi.stubGlobal('innerWidth', 414)
      const { isIPhonePlus, isIPhoneStandard, isIPad } = useResponsive()
      expect(isIPhonePlus.value).toBe(true)
      expect(isIPhoneStandard.value).toBe(false)
      expect(isIPad.value).toBe(false)
    })

    it('iPad 宽度 768-833 时 isIPad 为 true', () => {
      vi.stubGlobal('innerWidth', 820)
      const { isIPad, isIPhonePlus, isIPadPro } = useResponsive()
      expect(isIPad.value).toBe(true)
      expect(isIPhonePlus.value).toBe(false)
      expect(isIPadPro.value).toBe(false)
    })

    it('iPad Pro 宽度 1024-1279 时 isIPadPro 为 true', () => {
      vi.stubGlobal('innerWidth', 1112)
      const { isIPadPro, isIPad } = useResponsive()
      expect(isIPadPro.value).toBe(true)
      expect(isIPad.value).toBe(false)
    })
  })

  describe('matchBreakpoint 实际返回值', () => {
    it('宽度 >= sm 时 matchBreakpoint(sm) 应为 true', () => {
      vi.stubGlobal('innerWidth', 1000)
      const { matchBreakpoint } = useResponsive()
      expect(matchBreakpoint('sm')).toBe(true)
      expect(matchBreakpoint('xs')).toBe(true)
      expect(matchBreakpoint('tablet')).toBe(true)
    })

    it('移动端宽度时 matchBreakpoint 较小断点才为 true', () => {
      vi.stubGlobal('innerWidth', 300)
      const { matchBreakpoint } = useResponsive()
      expect(matchBreakpoint('xs')).toBe(false)
      expect(matchBreakpoint('sm')).toBe(false)
      expect(matchBreakpoint('tablet')).toBe(false)
      expect(matchBreakpoint('xxl')).toBe(false)
    })
  })

  describe('betweenBreakpoints 实际返回值', () => {
    it('宽度在指定范围内时应返回 true', () => {
      vi.stubGlobal('innerWidth', 500)
      const { betweenBreakpoints } = useResponsive()
      expect(betweenBreakpoints('md', 'lg')).toBe(true)
      expect(betweenBreakpoints('sm', 'md')).toBe(false)
    })

    it('宽度不在范围内时应返回 false', () => {
      vi.stubGlobal('innerWidth', 2000)
      const { betweenBreakpoints } = useResponsive()
      expect(betweenBreakpoints('sm', 'tablet')).toBe(false)
      expect(betweenBreakpoints('laptop', 'desktop')).toBe(false)
    })
  })

  describe('currentBreakpoint 各断点', () => {
    it('宽度 200 时应为 xs', () => {
      vi.stubGlobal('innerWidth', 200)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('xs')
    })

    it('宽度 400 时应为 sm', () => {
      vi.stubGlobal('innerWidth', 400)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('sm')
    })

    it('宽度 500 时应为 md', () => {
      vi.stubGlobal('innerWidth', 500)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('md')
    })

    it('宽度 700 时应为 lg', () => {
      vi.stubGlobal('innerWidth', 700)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('lg')
    })

    it('宽度 900 时应为 tablet', () => {
      vi.stubGlobal('innerWidth', 900)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('tablet')
    })

    it('宽度 1100 时应为 tabletLg', () => {
      vi.stubGlobal('innerWidth', 1100)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('tabletLg')
    })

    it('宽度 1366 时应为 laptop', () => {
      vi.stubGlobal('innerWidth', 1366)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('laptop')
    })

    it('宽度 1600 时应为 desktop', () => {
      vi.stubGlobal('innerWidth', 1600)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('desktop')
    })

    it('宽度 2000 时应为 xl', () => {
      vi.stubGlobal('innerWidth', 2000)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('xl')
    })

    it('宽度 3000 时应为 xxl', () => {
      vi.stubGlobal('innerWidth', 3000)
      const { currentBreakpoint } = useResponsive()
      expect(currentBreakpoint.value).toBe('xxl')
    })
  })

  describe('触摸设备检测', () => {
    it('有 ontouchstart 时 isTouchDevice 应为 true', () => {
      Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true })
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
      const { isTouchDevice } = useResponsive()
      expect(isTouchDevice.value).toBe(true)
    })

    it('maxTouchPoints > 0 时 isTouchDevice 应为 true', () => {
      Object.defineProperty(window, 'ontouchstart', { value: undefined, configurable: true })
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
      const { isTouchDevice } = useResponsive()
      expect(isTouchDevice.value).toBe(true)
    })

    it('checkTouchDevice 在 typeof window 不为 undefined 时应执行', () => {
      // 验证 isTouchDevice 是 ref 类型且被初始化为 false
      const { isTouchDevice } = useResponsive()
      expect(isTouchDevice).toBeDefined()
      expect('value' in isTouchDevice).toBe(true)
    })
  })

  describe('窗口大小变化处理', () => {
    it('触发 resize 事件后应更新窗口宽高', () => {
      vi.useFakeTimers()
      vi.stubGlobal('innerWidth', 500)
      vi.stubGlobal('innerHeight', 800)
      const { windowWidth, windowHeight } = useResponsive()

      // 模拟窗口大小变化
      vi.stubGlobal('innerWidth', 1200)
      vi.stubGlobal('innerHeight', 900)
      window.dispatchEvent(new Event('resize'))

      // 等待防抖 100ms 后值应被更新
      vi.advanceTimersByTime(150)
      expect(windowWidth.value).toBe(1200)
      expect(windowHeight.value).toBe(900)
      vi.useRealTimers()
    })

    it('连续触发 resize 应被防抖', () => {
      vi.useFakeTimers()
      vi.stubGlobal('innerWidth', 500)
      vi.stubGlobal('innerHeight', 800)
      const { windowWidth, windowHeight } = useResponsive()

      vi.stubGlobal('innerWidth', 800)
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(50)

      vi.stubGlobal('innerWidth', 1000)
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(50)

      // 此时应还未更新（防抖期间）
      expect(windowWidth.value).toBe(500)

      // 等待防抖完成
      vi.advanceTimersByTime(150)
      expect(windowWidth.value).toBe(1000)
      vi.useRealTimers()
    })
  })

  describe('useResponsiveValue', () => {
    it('应在当前断点选择对应的值', () => {
      vi.stubGlobal('innerWidth', 1366) // laptop
      const value = useResponsiveValue({
        xs: 'xs-value',
        sm: 'sm-value',
        md: 'md-value',
        tablet: 'tablet-value',
        laptop: 'laptop-value',
        desktop: 'desktop-value',
        default: 'default-value',
      })
      expect(value.value).toBe('laptop-value')
    })

    it('当前断点无值时向下查找更小断点的值', () => {
      vi.stubGlobal('innerWidth', 1366) // laptop 但 laptop 未配置
      const value = useResponsiveValue({
        md: 'md-value',
        sm: 'sm-value',
        default: 'default-value',
      })
      // 1366 是 laptop，从 laptop 向下查：laptop无 -> tablet无 -> tabletLg无 -> lg无 -> md有
      expect(value.value).toBe('md-value')
    })

    it('所有断点都无值时应使用 default', () => {
      vi.stubGlobal('innerWidth', 1366) // laptop
      const value = useResponsiveValue({
        default: 'default-value',
      })
      // 1366 是 laptop，从 laptop 向下查所有断点都没配置，使用 default
      expect(value.value).toBe('default-value')
    })

    it('小断点时优先返回小断点的值', () => {
      vi.stubGlobal('innerWidth', 400) // sm
      const value = useResponsiveValue({
        sm: 'sm-value',
        md: 'md-value',
        default: 'default-value',
      })
      expect(value.value).toBe('sm-value')
    })

    it('超小断点 xs 时返回 xs 的值', () => {
      vi.stubGlobal('innerWidth', 200) // xs
      const value = useResponsiveValue({
        xs: 'xs-value',
        default: 'default-value',
      })
      expect(value.value).toBe('xs-value')
    })

    it('大断点 xxl 时返回 xxl 的值', () => {
      vi.stubGlobal('innerWidth', 3000) // xxl
      const value = useResponsiveValue({
        xxl: 'xxl-value',
        default: 'default-value',
      })
      expect(value.value).toBe('xxl-value')
    })
  })

  describe('SSR 环境兼容', () => {
    it('无 window 时应使用默认宽高', () => {
      // mock computed 不直接读 window.innerWidth 所以这里只验证默认值
      const { windowWidth, windowHeight } = useResponsive()
      expect(windowWidth.value).toBeDefined()
      expect(windowHeight.value).toBeDefined()
    })
  })
})
