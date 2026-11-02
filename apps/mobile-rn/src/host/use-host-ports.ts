// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useHostPorts — mobile-rn 宿主端口实现(M4 B1)。
 *
 * `onNavigate`:逻辑 target 直接按 RN 路由名解析;未知 target **dev 抛错 / prod 可见错误**,
 * 不做静默 console.warn 降级(见 app-host-ports.ts 的 OnNavigate 契约)。
 * `onToast`:转发到全局轻提示通道(`host-toast`),任何壳无需自建 toast 态。
 */
import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { HostNavigateOptions, OnNavigate, OnToast } from '@ihui/types'
import { showHostToast } from './host-toast'

/**
 * `useNavigation()` 的静态类型绑定到 RootParamList 的某个具体导航器,
 * 而共享屏的 target 是跨端逻辑名(运行时才校验),故这里只取用得到的最小形状。
 * `navigate` 第三参 `{ tab }` 是端口语义:目标声明为 tabBar 页时,平台实现
 * (小程序 rn-compat)必须走 `switchTabIfNeeded`,RN 端由 tab navigator 消费。
 * `replace` 仅 stack 导航器提供 —— 缺失时绝不回落 navigate(见 performHostNavigate)。
 */
export interface LooseNavigation {
  getState(): Readonly<{ routeNames?: string[] }> | undefined
  navigate(name: string, params?: object, options?: { tab?: boolean }): void
  replace?(name: string, params?: object): void
}

export type HostNavigateOutcome =
  | { status: 'navigated'; mode: 'navigate' | 'replace'; tab: boolean }
  | { status: 'unregistered'; detail: string }
  | { status: 'capability-off'; capability: 'replace'; detail: string }

/**
 * 端口语义的纯函数实现(不依赖 React,便于直接测「不假绿」)。
 *
 * 三条硬口径:
 * 1. 未登记 target ⇒ `unregistered`,宿主负责 dev 抛错 / prod 可见错误。
 * 2. `replace: true` 但导航器没有 replace ⇒ 显式 `capability-off`,**不回落 navigate**。
 *    回落会把"替换当前页"悄悄变成"压一层新页",返回栈语义被改而调用方毫无察觉 ——
 *    这是典型的假 replace。
 * 3. `tab: true` ⇒ 把 `{ tab }` 透传给平台 navigate,由小程序的
 *    `switchTabIfNeeded` 判定是否 switchTab;RN 端 tab navigator 自行消费。
 */
export function performHostNavigate(
  nav: LooseNavigation,
  target: string,
  params: object | undefined,
  options: HostNavigateOptions | undefined,
): HostNavigateOutcome {
  const routeNames = nav.getState()?.routeNames ?? []
  if (!routeNames.includes(target)) {
    return { status: 'unregistered', detail: `未登记的路由 target: ${target}` }
  }

  if (options?.replace) {
    if (typeof nav.replace !== 'function') {
      return {
        status: 'capability-off',
        capability: 'replace',
        detail: `导航器不支持 replace,target ${target} 未执行(不回落到 navigate)`,
      }
    }
    nav.replace(target, params)
    return { status: 'navigated', mode: 'replace', tab: options.tab === true }
  }

  const tab = options?.tab === true
  nav.navigate(target, params, tab ? { tab: true } : undefined)
  return { status: 'navigated', mode: 'navigate', tab }
}

/**
 * 未登记路由 / 能力缺失的 prod 可见错误。
 *
 * 不在这里静态 import `../components/BottomPops` —— 那份文件在模块求值期就调
 * `Dimensions.get('window')`,凡是接端口的壳(含全部屏级测试)都会被迫连带加载它;
 * 走既有的轻提示通道即可,渲染层缺位时 `host-toast` 只 dev warn、不抛错。
 */
function reportHostPortError(detail: string): void {
  console.error(`[host-port] ${detail}`)
  showHostToast(detail, { kind: 'error' })
}

function useHostNavigate(): OnNavigate {
  const navigation = useNavigation()
  return useCallback<OnNavigate>(
    (target, params, options) => {
      const outcome = performHostNavigate(
        navigation as unknown as LooseNavigation,
        target,
        params as object | undefined,
        options,
      )
      if (outcome.status === 'unregistered') {
        if (__DEV__) throw new Error(`[host-port] ${outcome.detail}`)
        reportHostPortError(outcome.detail)
        return
      }
      if (outcome.status === 'capability-off') {
        if (__DEV__) throw new Error(`[host-port] ${outcome.detail}`)
        reportHostPortError(outcome.detail)
      }
    },
    [navigation],
  )
}

function useHostToast(): OnToast {
  return useCallback<OnToast>((message, options) => {
    showHostToast(message, options)
  }, [])
}

export function useHostPorts(): { onNavigate: OnNavigate; onToast: OnToast } {
  const onNavigate = useHostNavigate()
  const onToast = useHostToast()
  return { onNavigate, onToast }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
