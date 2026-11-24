// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    const result = (stack >= MAX_PAGE_STACK
      ? Taro.redirectTo({ url: opts.url })
      : original(opts)) as unknown as Promise<unknown>
    // 全仓 143 处 `void Taro.navigateTo(...)` 均不接 catch:路由不存在 / 分包未下载 /
    // 页面栈异常时 Promise reject,既产生未处理拒绝,又让用户「点了没反应」。
    // 单点挂一个旁路 catch 分支;返回给调用方的仍是原 Promise,其自身的 .then/.catch 不受影响。
    void result?.catch?.((err: unknown) => {
      console.warn('[nav] navigation rejected (page stayed put)', opts.url, err)
    })
    return result as unknown as NavigateResult
  }
  slot.__navGuarded = true
}

/**
 * 静默失败兜底:全仓 24 处「无 fail 回调、也无 .catch」的 Taro 通知型 API。
 *
 * 现状(2026-11-14 全量 AST 复扫):`previewImage` / `setClipboardData` / `makePhoneCall` /
 * `saveImageToPhotosAlbum` / `scanCode` 合计 24 个调用点只传了入参,既没 `fail` 回调也没
 * `.catch()`。这类 API 失败时(无相册权限 / 剪贴板被拒 / 设备不支持 / 用户取消扫码)
 * Taro 返回的 Promise 会 reject —— 调用方 `void xxx(...)` 不接,于是:
 *   ① 产生未处理的 Promise 拒绝(开发工具红字、线上静默);
 *   ② 用户「点了没反应」,且没有任何日志能定位是哪一步失败。
 *
 * 与上面的导航护栏同一形态:**单点接入,覆盖全仓,不改调用方语义**。只挂一条旁路 `catch`
 * 打印,返回给调用方的仍是原 Promise —— 它自己的 `.then/.catch` 完全不受影响,原本有
 * `fail` 回调的调用点行为也不变(回调由 Taro 自己派发)。
 *
 * 刻意不做「统一弹 toast」:这 24 处文案分属不同业务语境,统一文案会把「相册权限被拒」
 * 说成「操作失败」;正确的用户可见提示应由各自业务按语境补,本护栏只保证**不再静默**。
 */
const SILENT_APIS = [
  'previewImage',
  'setClipboardData',
  'makePhoneCall',
  'saveImageToPhotosAlbum',
  'scanCode',
] as const

export function installTaroSilentFailureGuard(): void {
  const slot = Taro as unknown as Record<string, unknown> & { __silentFailGuarded?: boolean }
  if (slot.__silentFailGuarded) return
  for (const api of SILENT_APIS) {
    const original = slot[api]
    if (typeof original !== 'function') continue
    const fn = original as (this: unknown, opts: unknown) => unknown
    slot[api] = function patched(this: unknown, opts: unknown): unknown {
      const ret = fn.call(this ?? Taro, opts)
      const maybePromise = ret as Promise<unknown> | undefined
      if (maybePromise && typeof maybePromise.catch === 'function') {
        void maybePromise.catch((err: unknown) => {
          console.warn(`[taro] ${api} rejected (no fail handler)`, err)
        })
      }
      return ret
    }
  }
  slot.__silentFailGuarded = true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
