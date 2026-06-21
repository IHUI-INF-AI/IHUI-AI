/**
 * 响应式断点 Composable
 * 提供统一的响应式状态管理
 */
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

// 断点定义（与 SCSS 断点保持一致）
export const BREAKPOINTS = {
  xs: 320,      // 超小手机 (iPhone SE 1代)
  sm: 375,      // 小手机 (iPhone 6/7/8)
  md: 428,      // 中等手机 (iPhone 14 Pro Max)
  lg: 576,      // 大手机/小平板
  tablet: 768,  // 平板竖屏 (iPad Mini)
  tabletLg: 1024, // 平板横屏 (iPad Pro)
  laptop: 1280,   // 笔记本
  desktop: 1440,  // 桌面
  xl: 1920,       // 大屏桌面
  xxl: 2560,      // 超大屏/2K
} as const

export type BreakpointKey = keyof typeof BREAKPOINTS

// 设备类型
export type DeviceType = 'mobile' | 'tablet' | 'laptop' | 'desktop'

/**
 * 使用响应式断点
 */
export function useResponsive() {
  const cleanup = useCleanup()
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

  // 设备类型判断
  const deviceType = computed<DeviceType>(() => {
    if (windowWidth.value < BREAKPOINTS.tablet) return 'mobile'
    if (windowWidth.value < BREAKPOINTS.laptop) return 'tablet'
    if (windowWidth.value < BREAKPOINTS.desktop) return 'laptop'
    return 'desktop'
  })

  // 便捷布尔值
  const isMobile = computed(() => windowWidth.value < BREAKPOINTS.tablet)
  const isTablet = computed(() => windowWidth.value >= BREAKPOINTS.tablet && windowWidth.value < BREAKPOINTS.laptop)
  const isLaptop = computed(() => windowWidth.value >= BREAKPOINTS.laptop && windowWidth.value < BREAKPOINTS.desktop)
  const isDesktop = computed(() => windowWidth.value >= BREAKPOINTS.desktop)

  // 断点状态
  const isXs = computed(() => windowWidth.value < BREAKPOINTS.sm)
  const isSm = computed(() => windowWidth.value >= BREAKPOINTS.sm && windowWidth.value < BREAKPOINTS.md)
  const isMd = computed(() => windowWidth.value >= BREAKPOINTS.md && windowWidth.value < BREAKPOINTS.lg)
  const isLg = computed(() => windowWidth.value >= BREAKPOINTS.lg && windowWidth.value < BREAKPOINTS.tablet)
  const isTabletSize = computed(() => windowWidth.value >= BREAKPOINTS.tablet && windowWidth.value < BREAKPOINTS.tabletLg)
  const isTabletLg = computed(() => windowWidth.value >= BREAKPOINTS.tabletLg && windowWidth.value < BREAKPOINTS.laptop)
  const isLaptopSize = computed(() => windowWidth.value >= BREAKPOINTS.laptop && windowWidth.value < BREAKPOINTS.desktop)
  const isDesktopSize = computed(() => windowWidth.value >= BREAKPOINTS.desktop && windowWidth.value < BREAKPOINTS.xl)
  const isXl = computed(() => windowWidth.value >= BREAKPOINTS.xl && windowWidth.value < BREAKPOINTS.xxl)
  const isXxl = computed(() => windowWidth.value >= BREAKPOINTS.xxl)

  // 向上兼容断点（如 tabletUp 表示 >= tablet）
  const tabletUp = computed(() => windowWidth.value >= BREAKPOINTS.tablet)
  const laptopUp = computed(() => windowWidth.value >= BREAKPOINTS.laptop)
  const desktopUp = computed(() => windowWidth.value >= BREAKPOINTS.desktop)
  const xlUp = computed(() => windowWidth.value >= BREAKPOINTS.xl)

  // 向下兼容断点（如 tabletDown 表示 < tablet）
  const tabletDown = computed(() => windowWidth.value < BREAKPOINTS.tablet)
  const laptopDown = computed(() => windowWidth.value < BREAKPOINTS.laptop)
  const desktopDown = computed(() => windowWidth.value < BREAKPOINTS.desktop)

  // 方向
  const isPortrait = computed(() => windowHeight.value > windowWidth.value)
  const isLandscape = computed(() => windowWidth.value > windowHeight.value)

  // 特定设备检测
  const isIPhoneSE = computed(() => windowWidth.value <= 320)
  const isIPhoneStandard = computed(() => windowWidth.value >= 375 && windowWidth.value < 390)
  const isIPhonePlus = computed(() => windowWidth.value >= 390 && windowWidth.value <= 430)
  const isIPad = computed(() => windowWidth.value >= 768 && windowWidth.value < 834)
  const isIPadPro = computed(() => windowWidth.value >= 1024 && windowWidth.value < 1280)

  // 触摸设备检测
  const isTouchDevice = ref(false)

  // 检测触摸设备
  const checkTouchDevice = () => {
    if (typeof window !== 'undefined') {
      isTouchDevice.value = 'ontouchstart' in window || 
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error 旧版 API
        navigator.msMaxTouchPoints > 0
    }
  }

  // 防抖处理窗口大小变化
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null
  
  const handleResize = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout)
    }
    resizeTimeout = setTimeout(() => {
      if (typeof window !== 'undefined') {
        windowWidth.value = window.innerWidth
        windowHeight.value = window.innerHeight
      }
    }, 100)
  }

  // 检查是否匹配指定断点
  const matchBreakpoint = (breakpoint: BreakpointKey): boolean => {
    return windowWidth.value >= BREAKPOINTS[breakpoint]
  }

  // 检查是否在两个断点之间
  const betweenBreakpoints = (min: BreakpointKey, max: BreakpointKey): boolean => {
    return windowWidth.value >= BREAKPOINTS[min] && windowWidth.value < BREAKPOINTS[max]
  }

  // 获取当前断点名称
  const currentBreakpoint = computed<BreakpointKey>(() => {
    if (windowWidth.value >= BREAKPOINTS.xxl) return 'xxl'
    if (windowWidth.value >= BREAKPOINTS.xl) return 'xl'
    if (windowWidth.value >= BREAKPOINTS.desktop) return 'desktop'
    if (windowWidth.value >= BREAKPOINTS.laptop) return 'laptop'
    if (windowWidth.value >= BREAKPOINTS.tabletLg) return 'tabletLg'
    if (windowWidth.value >= BREAKPOINTS.tablet) return 'tablet'
    if (windowWidth.value >= BREAKPOINTS.lg) return 'lg'
    if (windowWidth.value >= BREAKPOINTS.md) return 'md'
    if (windowWidth.value >= BREAKPOINTS.sm) return 'sm'
    return 'xs'
  })

  // 生命周期
  onMounted(() => {
    if (typeof window !== 'undefined') {
      windowWidth.value = window.innerWidth
      windowHeight.value = window.innerHeight
      checkTouchDevice()
      cleanup.addEventListener(window, 'resize', handleResize as EventListener, { passive: true })
    }
  })

  cleanup.add(() => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout)
    }
  })

  return {
    // 原始值
    windowWidth,
    windowHeight,
    
    // 设备类型
    deviceType,
    
    // 便捷布尔值
    isMobile,
    isTablet,
    isLaptop,
    isDesktop,
    
    // 断点状态
    isXs,
    isSm,
    isMd,
    isLg,
    isTabletSize,
    isTabletLg,
    isLaptopSize,
    isDesktopSize,
    isXl,
    isXxl,
    
    // 向上兼容
    tabletUp,
    laptopUp,
    desktopUp,
    xlUp,
    
    // 向下兼容
    tabletDown,
    laptopDown,
    desktopDown,
    
    // 方向
    isPortrait,
    isLandscape,
    
    // 特定设备
    isIPhoneSE,
    isIPhoneStandard,
    isIPhonePlus,
    isIPad,
    isIPadPro,
    
    // 触摸设备
    isTouchDevice,
    
    // 方法
    matchBreakpoint,
    betweenBreakpoints,
    
    // 当前断点
    currentBreakpoint,
    
    // 断点常量
    BREAKPOINTS,
  }
}

/**
 * 响应式值选择器
 * 根据当前断点选择对应的值
 */
export function useResponsiveValue<T>(values: {
  xs?: T
  sm?: T
  md?: T
  lg?: T
  tablet?: T
  tabletLg?: T
  laptop?: T
  desktop?: T
  xl?: T
  xxl?: T
  default: T
}): ReturnType<typeof computed<T>> {
  const { currentBreakpoint } = useResponsive()
  
  return computed(() => {
    const breakpoint = currentBreakpoint.value
    
    // 按优先级查找值
    const breakpointOrder: BreakpointKey[] = ['xxl', 'xl', 'desktop', 'laptop', 'tabletLg', 'tablet', 'lg', 'md', 'sm', 'xs']
    const currentIndex = breakpointOrder.indexOf(breakpoint)
    
    // 从当前断点向下查找第一个有值的断点
    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i]
      if (values[bp] !== undefined) {
        return values[bp] as T
      }
    }
    
    return values.default
  })
}

export default useResponsive
