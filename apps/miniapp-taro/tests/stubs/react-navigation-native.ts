// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * node 环境下的 @react-navigation/native 最小桩。
 *
 * 背景:薄壳页真加载 RN 壳(`@rn-shells/PostCreateScreen`)时会引导航族。该包 index 会拉
 * `createStandardNavigationFactories.js → standard-navigation`,而 pnpm 链接面里
 * `standard-navigation` 没有在包内 node_modules 落链(`require.resolve` 直接 ERR),vitest 的
 * 外部化/内联两条路径都会在收集期抛 `SyntaxError: Unexpected token 'typeof'`(10 个套件里
 * 1 个整份不收、零用例执行)。node 环境本来也渲染不了导航容器,这里只切平台依赖:
 * 保留「有 hook、返回形状正确、动作是 no-op」,断言判据不变。
 */

import type { ReactNode } from 'react'

type NavigationStub = {
  navigate: (..._args: unknown[]) => void
  push: (..._args: unknown[]) => void
  replace: (..._args: unknown[]) => void
  goBack: () => void
  setParams: (..._args: unknown[]) => void
  dispatch: (..._args: unknown[]) => void
  reset: (..._args: unknown[]) => void
  addListener: (..._args: unknown[]) => () => void
  removeListener: (..._args: unknown[]) => void
  canGoBack: () => boolean
  isFocused: () => boolean
  setOptions: (..._args: unknown[]) => void
}

const noop = () => {}
const navigation: NavigationStub = {
  navigate: noop,
  push: noop,
  replace: noop,
  goBack: noop,
  setParams: noop,
  dispatch: noop,
  reset: noop,
  addListener: () => () => {},
  removeListener: noop,
  canGoBack: () => false,
  isFocused: () => true,
  setOptions: noop,
}

export const useNavigation = <T = NavigationStub>(): T => navigation as unknown as T

export const useRoute = <T = { key: string; name: string; params: Record<string, unknown> }>(): T =>
  ({ key: 'test-route', name: 'TestRoute', params: {} }) as unknown as T

export const useIsFocused = (): boolean => true

export const useFocusEffect = (_effect: () => void | (() => void)): void => {}

export const useNavigationState = <T>(selector: (state: unknown) => T): T =>
  selector({ index: 0, routes: [], stale: false, type: 'stack', key: 'test-stack' })

export const useHeaderHeight = (): number => 0

export const useScrollToTop = (_ref: unknown): void => {}

export const useLocale = (): string => 'zh'

export const useLinkProps = (_props: unknown): { href: string } => ({ href: '' })

export const useLinkBuilder = (): { buildHref: (name: string) => string } => ({
  buildHref: (name: string) => `/${name}`,
})

export function createNavigationContainerRef<T = unknown>(): T {
  return {} as T
}

export const DefaultTheme = {
  dark: false,
  colors: {
    primary: '#0a7ea4',
    background: '#ffffff',
    card: '#ffffff',
    text: '#11181c',
    border: '#e5e7eb',
    notification: '#ef4444',
  },
  fonts: {},
}

export const DarkTheme = { ...DefaultTheme, dark: true }

export const ThemeProvider = ({ children }: { children?: ReactNode }) => children

export const NavigationContainer = ({ children }: { children?: ReactNode }) => children

export const Link = ({ children }: { children?: ReactNode }) => children

export const NavigationIndependentTree = ({ children }: { children?: ReactNode }) => children
