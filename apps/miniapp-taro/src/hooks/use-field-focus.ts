// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * 平台特有:小程序 wxss 不支持 `:focus` 伪类(Taro 的聚焦书写只能是运行时状态),
 * 因此聚焦态描边走「运行时切换 + 行内样式」,与 web 的 `focus:*` 工具类、RN 的
 * `TextField`(packages/app/src/components/TextField.tsx)三端各按平台能力同取一档。
 *
 * 为什么行内样式而不是共享 class:端内输入框的描边分散在三处(JSX 工具类 / 页面 CSS /
 * 外层容器),class 级联要跟 weapp-tailwindcss 工具类与页面 CSS 比先后,行内样式
 * 稳赢一切类规则、三形态通用,且聚焦只换颜色不改宽度 ⇒ 零布局跳动(与 RN 的
 * RESTING_BORDER 同一语义)。
 *
 * 唯一取色出处就是下面这一行:聚焦态描边取墨档(亮纯黑/暗纯白,`--color-primary`
 * 随主题反转)。这是 AGENTS §4「描边不得取墨档」的唯一例外位(2026-09-30 定档);
 * 门 83 的 R8 按 `focused ? {` 条件形态放行 —— 所以这里必须写成三元,不得改成
 * `focused && {…}` 短路(判据只认条件取值)。
 *
 * 用法(三形态):
 *   // ① 描边在 Input/Textarea 自己身上(JSX 工具类或页面 CSS):
 *   const ff = useFieldFocus()
 *   <Input className="border border-border" {...ff.spread} style={ff.focusStyle} />
 *   // ② 描边在外层容器:handlers 仍在 Input 上,style 铺到容器
 *   <View style={ff.focusStyle}>
 *     <Input {...ff.spread} />
 *   </View>
 *   // 元素已有 style 时合并:style={{ ...原有, ...ff.focusStyle }}
 */
export interface FieldFocus {
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  /** 聚焦描边样式;未聚焦为 undefined ⇒ 完全不介入宿主元素的常态样式 */
  focusStyle?: CSSProperties
  /** 便捷展开:{ onFocus, onBlur } —— 铺到 Input/Textarea 上 */
  spread: { onFocus: () => void; onBlur: () => void }
}

export function useFieldFocus(): FieldFocus {
  const [focused, setFocused] = useState(false)
  return {
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    focusStyle: focused ? { borderColor: 'var(--color-primary)' } : undefined,
    spread: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
