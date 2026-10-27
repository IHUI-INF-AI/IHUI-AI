// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useExtensionLoginRegion(2026-10-27 立)—— 扩展端登录方式优先级取「访客来源 IP 地区」的最小出口。
 *
 * 与 web 侧同语义、不同源:web 的 `useServerLoginRegion()` 住在
 * `apps/web/src/hooks/use-third-party-auth.ts`,是 web 专有文件(扩展端不得 import apps/web),
 * 这里只把「取 loginRegion」这一件事按扩展自己的请求封装重做一遍——
 * 请求出口复用 `@ihui/api-client` 已有的 `getOAuthStatus()`(GET /api/auth/oauth-status),
 * 不新造 fetch、不复算「哪个国家算国内」(判据权威住在 apps/api/src/services/login-region.ts)。
 *
 * 失效方向(§0.3 / §0.10):端点挂、网络失败、响应缺键、字段是第三种脏值 —— 一律返回 `null`
 * = **未判定**,由调用方(`planLoginRegion`)回落到更粗的判据(界面语言),
 * 绝不在这里猜成 domestic 或 overseas。
 *
 * 模块级缓存:`getOAuthStatus` 这条 GET 在一次弹窗生命周期里只需一次(popup 与 sidepanel
 * 各是独立进程,互不影响)。取不到不写缓存语义?——写:失败也是「这一轮判不出」的结论,
 * 反复重试只会把登录页的每一次渲染都变成一次网络往返;真正的重判发生在下一次打开扩展面板。
 */
import * as React from 'react'
import { getOAuthStatus } from '@ihui/api-client'
import type { LoginRegion } from '@ihui/ui-react'

/** 未判定形态:null;调用方把它原样交给 planLoginRegion 的 ipRegion。 */
let loginRegionCache: Promise<LoginRegion | null> | null = null

function readLoginRegionFromStatus(
  status: Awaited<ReturnType<typeof getOAuthStatus>>,
): LoginRegion | null {
  // 只认两个字面量:success=false / data 缺键 / 第三种值 ⇒ 一律按未判定处理。
  if (!status.success || !status.data) return null
  const value: unknown = status.data.loginRegion
  return value === 'domestic' || value === 'overseas' ? value : null
}

function loadLoginRegion(): Promise<LoginRegion | null> {
  if (!loginRegionCache) {
    loginRegionCache = getOAuthStatus()
      .then(readLoginRegionFromStatus)
      .catch(() => null)
  }
  return loginRegionCache
}

/**
 * 服务器按访客来源 IP 判出的登录呈现地区;`null` = 未判定(必须回落 locale)。
 *
 * `enabled` 缺省为 true(sidepanel 的登录页本就只在未登录时挂载)。popup 的登录界面
 * 与已登录界面共用同一个 App 组件、hook 不能条件调用,故由调用方传 `!user` 把 GET
 * 关在「真的要看登录表单」的那一刻——已登录用户不该为一条排版判据多跑一次网络往返。
 */
export function useExtensionLoginRegion(enabled = true): LoginRegion | null {
  const [region, setRegion] = React.useState<LoginRegion | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    let alive = true
    void loadLoginRegion().then((next) => {
      if (alive && next) setRegion(next)
    })
    return () => {
      alive = false
    }
  }, [enabled])

  return region
}

/** 测试面:模块级「只取一次」缓存不清掉就无法在同一进程逐档验(报 domestic / 报 overseas / 取不到)。 */
export const __test__ = {
  resetLoginRegionCache: (): void => {
    loginRegionCache = null
  },
  readLoginRegionFromStatus,
  loadLoginRegion,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
