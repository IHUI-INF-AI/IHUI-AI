// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/navigation.ts —— `@react-navigation/native` 在小程序端的等价实现。
 *
 * RN 壳用 `useNavigation().navigate('CourseDetail', {id})` 这类**路由名**跳转,小程序只有路径。
 * 名字→路径的映射不靠猜:由 `scripts/gen-rn-compat.mjs` 从
 *   ① RN 导航器登记的路由名 ↔ 该路由承载的共享屏
 *   ② 跨端登记表(scripts/data/cross-end-screen-registry.json)里该共享屏的小程序页路由
 * 两条现读事实 join 出来,产出 route-map.generated.ts。
 * 映射不到时**显式点名并停在原地**,绝不静默跳到别的页(错跳比不跳更难查)。
 */
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'

import { RN_ROUTE_MAP } from './route-map.generated'

type RouteParams = Record<string, unknown>

function toPath(name: string, params: RouteParams = {}): string | null {
  const path = RN_ROUTE_MAP[name]
  if (!path) return null
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return query ? `${path}?${query}` : path
}

function switchTabIfNeeded(path: string): boolean {
  // tabBar 页必须走 switchTab,普通路径走 navigateTo(与端内既有跳转一致)
  return (
    path.startsWith('/pages/') &&
    /^(index|plaza|community|message|mine)/.test(path.split('/')[2] ?? '')
  )
}

export interface CompatNavigation {
  navigate: (name: string, params?: RouteParams) => void
  push: (name: string, params?: RouteParams) => void
  replace: (name: string, params?: RouteParams) => void
  goBack: () => void
  pop: () => void
  popToTop: () => void
  setParams: (params: RouteParams) => void
  canGoBack: () => boolean
  addListener: () => { remove: () => void }
  isFocused: () => boolean
  dispatch: (action: unknown) => void
}

let lastParams: RouteParams = {}

/** 供 useRoute 用:小程序的 router.params 即 RN 的 route.params */
export function useRoute() {
  const instance = Taro.getCurrentInstance()
  const params = (instance.router?.params ?? {}) as RouteParams
  lastParams = params
  return {
    key: 'mini',
    name: instance.router?.path ?? '',
    params,
  }
}

export function useNavigation(): CompatNavigation {
  const fail = useCallback((name: string) => {
    console.warn(
      `[rn-compat] 路由名「${name}」在 route-map.generated.ts 里没有登记 ⇒ 本次跳转未执行(不猜目标页)。`,
    )
  }, [])
  return useMemo<CompatNavigation>(
    () => ({
      navigate: (name, params) => {
        const path = toPath(name, params)
        if (!path) return fail(name)
        if (switchTabIfNeeded(path)) void Taro.switchTab({ url: path })
        else void Taro.navigateTo({ url: path })
      },
      push: (name, params) => {
        const path = toPath(name, params)
        if (!path) return fail(name)
        void Taro.navigateTo({ url: path })
      },
      replace: (name, params) => {
        const path = toPath(name, params)
        if (!path) return fail(name)
        void Taro.redirectTo({ url: path })
      },
      goBack: () => void Taro.navigateBack(),
      pop: () => void Taro.navigateBack(),
      popToTop: () => void Taro.navigateBack({ delta: 10 }),
      setParams: () => {},
      canGoBack: () => Taro.getCurrentPages().length > 1,
      addListener: () => ({ remove: () => {} }),
      isFocused: () => true,
      dispatch: () => {},
    }),
    [fail],
  )
}

export function useIsFocused() {
  return true
}

export function useFocusEffect(effect: () => () => void | undefined) {
  useEffect(() => {
    const cleanup = effect()
    return () => cleanup?.()
  }, [effect])
}

export function usePreventRemove() {}

export const CommonActions = {
  navigate: (name: string, params?: RouteParams) => ({ type: 'navigate', name, params }),
  goBack: () => ({ type: 'goBack' }),
  setParams: (params: RouteParams) => ({ type: 'setParams', params }),
}

export const StackActions = {
  push: (name: string, params?: RouteParams) => ({ type: 'push', name, params }),
  replace: (name: string, params?: RouteParams) => ({ type: 'replace', name, params }),
  pop: () => ({ type: 'pop' }),
  popToTop: () => ({ type: 'popToTop' }),
}

export function NavigationContainer({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function createNativeStackNavigator() {
  return {
    Navigator: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Screen: ({
      component: Component,
    }: {
      component?: (p: unknown) => ReactNode
      name?: string
      params?: RouteParams
    }) => (Component ? <>{Component({})}</> : null),
    Group: ({ children }: { children?: ReactNode }) => <>{children}</>,
  }
}

export function createStackNavigator() {
  return createNativeStackNavigator()
}

export function useTheme() {
  return { dark: false, colors: {} as Record<string, string> }
}

export function useScrollToTop() {
  useEffect(() => {}, [])
}

export const paramsOf = () => lastParams
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
