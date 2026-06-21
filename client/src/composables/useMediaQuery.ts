import { ref, type Ref, type ComputedRef, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export const breakpoints: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)

  if (typeof window === 'undefined') {
    return matches
  }

  const mediaQuery = window.matchMedia(query)
  matches.value = mediaQuery.matches

  const handler = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }

  const cleanup = useCleanup()
  cleanup.addEventListener(mediaQuery, 'change', handler)

  return matches
}

export function useBreakpoints(): {
  current: ComputedRef<Breakpoint>
  xs: Ref<boolean>
  sm: Ref<boolean>
  md: Ref<boolean>
  lg: Ref<boolean>
  xl: Ref<boolean>
  '2xl': Ref<boolean>
  isMobile: ComputedRef<boolean>
  isTablet: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  greater: (breakpoint: Breakpoint) => Ref<boolean>
  smaller: (breakpoint: Breakpoint) => Ref<boolean>
  between: (min: Breakpoint, max: Breakpoint) => Ref<boolean>
} {
  const xs = useMediaQuery(`(max-width: ${breakpoints.sm - 1}px)`)
  const sm = useMediaQuery(`(min-width: ${breakpoints.sm}px) and (max-width: ${breakpoints.md - 1}px)`)
  const md = useMediaQuery(`(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`)
  const lg = useMediaQuery(`(min-width: ${breakpoints.lg}px) and (max-width: ${breakpoints.xl - 1}px)`)
  const xl = useMediaQuery(`(min-width: ${breakpoints.xl}px) and (max-width: ${breakpoints['2xl'] - 1}px)`)
  const twoXl = useMediaQuery(`(min-width: ${breakpoints['2xl']}px)`)

  const current = computed<Breakpoint>(() => {
    if (xs.value) return 'xs'
    if (sm.value) return 'sm'
    if (md.value) return 'md'
    if (lg.value) return 'lg'
    if (xl.value) return 'xl'
    return '2xl'
  })

  const isMobile = computed(() => xs.value || sm.value)
  const isTablet = computed(() => md.value)
  const isDesktop = computed(() => lg.value || xl.value || twoXl.value)

  const greater = (breakpoint: Breakpoint): Ref<boolean> => {
    return useMediaQuery(`(min-width: ${breakpoints[breakpoint]}px)`)
  }

  const smaller = (breakpoint: Breakpoint): Ref<boolean> => {
    return useMediaQuery(`(max-width: ${breakpoints[breakpoint] - 1}px)`)
  }

  const between = (min: Breakpoint, max: Breakpoint): Ref<boolean> => {
    return useMediaQuery(
      `(min-width: ${breakpoints[min]}px) and (max-width: ${breakpoints[max] - 1}px)`
    )
  }

  return {
    current,
    xs,
    sm,
    md,
    lg,
    xl,
    '2xl': twoXl,
    isMobile,
    isTablet,
    isDesktop,
    greater,
    smaller,
    between,
  }
}

export function usePreferredDark(): Ref<boolean> {
  return useMediaQuery('(prefers-color-scheme: dark)')
}

export function usePreferredLight(): Ref<boolean> {
  return useMediaQuery('(prefers-color-scheme: light)')
}

export function usePreferredReducedMotion(): Ref<boolean> {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

export function usePreferredContrast(): Ref<'more' | 'less' | 'no-preference'> {
  const more = useMediaQuery('(prefers-contrast: more)')
  const less = useMediaQuery('(prefers-contrast: less)')

  return computed(() => {
    if (more.value) return 'more'
    if (less.value) return 'less'
    return 'no-preference'
  }) as unknown as Ref<'more' | 'less' | 'no-preference'>
}
