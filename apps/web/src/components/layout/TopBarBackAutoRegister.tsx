// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌‌‌‌​‌‌‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTopBarBackStore } from '@/stores/topbar-back'

/**
 * TopBarBackAutoRegister — 子页面统一返回键自动声明器(2026-09-09 立)
 *
 * 背景(用户反馈"还有页面有遗漏"):上一轮只把"页面已自行声明的返回意图"收敛到顶栏,
 * 但绝大多数详情/子页面(agents/[id]、articles/[id]、admin/** 二级页等 60+ 路由)
 * 从未声明返回意图,顶栏返回键不出现 = 统一返回键覆盖不全。
 *
 * 本组件全局挂载(GlobalShell),按路由深度自动声明:
 * - 路径深度 ≥ 2(如 /agents/123、/settings/profile)→ 声明 fallbackHref = 一级父路由
 *   (一级父路由必然存在:app/(main) 全部一级目录均有 page.tsx,已穷举核对)
 * - 一级列表页 / 首页 / 营销页 → 不声明,顶栏返回键动画收起
 * - 页面级自定义声明(useTopBarBack / <BackButton />)优先:子组件 effect 先于本组件执行
 *   (React 自底向上),已有人注册时本组件让位不覆盖;页面撤回后自然回落
 *
 * 免返回前缀(公开分享/认证/h5 壳,非"工作区子页"语义):
 * /sso、/h5、/share(含 /chat/share、/business-card/share、/ai-world/share)。
 * 认证路由(/login、/forgot-password、/callback、/apple、/google、/forbidden、/status)
 * 路径深度均 < 2,天然不触发;/login 在 GlobalShell 早退分支,本组件不挂载。
 *
 * en 语言镜像路由(app/en/*,全部为一级列表页)剥掉 locale 前缀后再按深度判定。
 */
const EXEMPT_PREFIXES = [
  '/sso',
  '/h5',
  '/share',
  '/chat/share',
  '/business-card/share',
  '/ai-world/share',
]

export function TopBarBackAutoRegister() {
  const pathname = usePathname()

  React.useEffect(() => {
    if (!pathname || pathname === '/') return
    if (EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return

    const segs = pathname.split('/').filter(Boolean)
    if (segs[0] === 'en') segs.shift()
    if (segs.length < 2) return

    // 页面级自定义声明优先(如 CloudRunsView 详情视图的 onBack),不覆盖
    if (useTopBarBackStore.getState().config) return

    const config = { fallbackHref: `/${segs[0]}` }
    const store = useTopBarBackStore.getState()
    store.setConfig(config)
    return () => store.clearConfig(config)
  }, [pathname])

  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌‌‌‌‌‌‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
