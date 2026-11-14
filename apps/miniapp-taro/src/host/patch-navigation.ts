// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import Taro from '@tarojs/taro'

const MAX_PAGE_STACK = 10

type NavigateOpts = Parameters<typeof Taro.navigateTo>[0]
type NavigateResult = ReturnType<typeof Taro.navigateTo>

/**
 * 小程序页面栈上限 10 层:超过后 Taro.navigateTo 会静默失效(目标页打不开、无报错)。
 * 在 app 启动处调用一次,把 navigateTo 包一层深度护栏 —— 接近上限自动降级为 redirectTo
 * (替换当前页),保证跳转一定生效。仅在 overflow 这一异常分支改变语义(原行为本就打不开),
 * 正常层数下与原 navigateTo 完全一致。单点接入,覆盖全仓所有 Taro.navigateTo 调用,无需逐个改动。
 */
export function installNavigationGuard(): void {
  const original = Taro.navigateTo
  const slot = Taro as unknown as {
    navigateTo: (opts: NavigateOpts) => NavigateResult
    __navGuarded?: boolean
  }
  if (slot.__navGuarded) return
  slot.navigateTo = (opts: NavigateOpts): NavigateResult => {
    const stack = Taro.getCurrentPages?.()?.length ?? 0
    if (stack >= MAX_PAGE_STACK) {
      return Taro.redirectTo({ url: opts.url }) as unknown as NavigateResult
    }
    return original(opts)
  }
  slot.__navGuarded = true
}
