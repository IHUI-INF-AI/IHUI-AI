// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View } from '@tarojs/components'
import type { CSSProperties, PropsWithChildren } from 'react'
import { themeWindowBg, useThemeRoot } from '@/lib/theme'

interface ThemeRootProps extends PropsWithChildren<unknown> {
  className?: string
  style?: CSSProperties
}

/**
 * 页面主题根容器(2026-09-03 立)— 所有页面的最外层 View 统一替换为本组件。
 *
 * 作用:
 * - 挂载 .theme-root 基础类(背景/文字色绑定 token)+ .dark 类(暗色时,
 *   app.css 的 .dark 变量块随子树生效,与 web 端 tokens.css .dark 同源)
 * - 订阅 eventCenter 主题变化(settings 页切换后全端实时响应)
 * - useDidShow 重放原生 chrome(导航栏/tabBar/窗口背景),幂等
 * - 背景同时写 inline 实色:2026-11-27 实测自定义导航栏页的分包 CSS 里
 *   `--color-background` 未落到 page 根,只靠 `.theme-root` 的 var() 会让状态栏/顶部
 *   垫高区透明,露出原生黑底(顶部出现一条黑带)。inline 值随 resolved 主题实时切换。
 *
 * 用法:<ThemeRoot> 替换页面原根 <View className="page-xxx"> →
 *       <ThemeRoot className="page-xxx">(原 className 传入,不丢样式)。
 */
export default function ThemeRoot({ children, className = '', style }: ThemeRootProps) {
  const { resolved, themeClass } = useThemeRoot()
  const cls = ['theme-root', themeClass, className].filter(Boolean).join(' ')
  return (
    <View className={cls} style={{ backgroundColor: themeWindowBg(resolved), ...style }}>
      {children}
    </View>
  )
}
