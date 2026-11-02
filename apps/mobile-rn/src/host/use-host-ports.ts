// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * useHostPorts — mobile-rn 宿主端口实现(M4 B1)。
 *
 * `onNavigate`:逻辑 target 直接按 RN 路由名解析;未知 target **dev 抛错 / prod 可见错误**,
 * 不做静默 console.warn 降级(见 app-host-ports.ts 的 OnNavigate 契约)。
 * `onToast`:转发到全局轻提示通道(`host-toast`),任何壳无需自建 toast 态。
 */
import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { OnNavigate, OnToast } from '@ihui/types'
import { showHostToast } from './host-toast'

/**
 * `useNavigation()` 的静态类型绑定到 RootParamList 的某个具体导航器,
 * 而共享屏的 target 是跨端逻辑名(运行时才校验),故这里只取用得到的最小形状。
 * `replace` 仅 stack 导航器提供,缺省时回落 navigate(不让能力缺失伪装成成功)。
 */
interface LooseNavigation {
  getState(): Readonly<{ routeNames?: string[] }> | undefined
  navigate(name: string, params?: object): void
  replace?(name: string, params?: object): void
}

/**
 * 未登记路由的 prod 可见错误。
 *
 * 不在这里静态 import `../components/BottomPops` —— 那份文件在模块求值期就调
 * `Dimensions.get('window')`,凡是接端口的壳(含全部屏级测试)都会被迫连带加载它;
 * 走既有的轻提示通道即可,渲染层缺位时 `host-toast` 只 dev warn、不抛错。
 */
function reportUnregisteredRoute(detail: string): void {
  console.error(`[host-port] ${detail}`)
  showHostToast(detail, { kind: 'error' })
}

export function useHostNavigate(): OnNavigate {
  const navigation = useNavigation()
  return useCallback<OnNavigate>(
    (target, params, options) => {
      const nav = navigation as unknown as LooseNavigation
      const routeNames = nav.getState()?.routeNames ?? []
      if (!routeNames.includes(target)) {
        const detail = `未登记的路由 target: ${target}`
        if (__DEV__) throw new Error(`[host-port] ${detail}`)
        reportUnregisteredRoute(detail)
        return
      }
      const payload = params as object | undefined
      if (options?.replace && nav.replace) nav.replace(target, payload)
      else nav.navigate(target, payload)
    },
    [navigation],
  )
}

export function useHostToast(): OnToast {
  return useCallback<OnToast>((message, options) => {
    showHostToast(message, options)
  }, [])
}

export function useHostPorts(): { onNavigate: OnNavigate; onToast: OnToast } {
  const onNavigate = useHostNavigate()
  const onToast = useHostToast()
  return { onNavigate, onToast }
}
