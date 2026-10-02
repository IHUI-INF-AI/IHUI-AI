// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端输入框聚焦描边的**规则层** —— 不 import `@tarojs/components`,所以能被直接单测。
 *
 * 为什么与组件分开:`FocusField.tsx` 一 import Taro 组件,测试就在**收集期**挂掉
 * (本机 `@tarojs/components/dist/` 下没有 `index.js`,入口靠 exports 映射),
 * 而"取哪一档 / 常态该不该涂透明"这两条恰恰是最需要被量一次的东西。
 * 判据与接线分开,规则才测得到(同 AGENTS §"auto-login-policy 单独成文件"那条理由)。
 *
 * 规矩只有一句,两端同值:聚焦上色取 `var(--color-primary)`(亮纯黑/暗纯白,AGENTS §4
 * 「唯一例外位:输入框/选择控件的聚焦态描边取墨档」);RN 侧同一条例外在
 * `packages/app/src/components/TextField.tsx`。
 */

/** 聚焦描边的唯一取档处 */
export const FOCUS_INK_BORDER = 'var(--color-primary)'

/** 常态为聚焦预留的描边位(调用方自己没画 border 时才补) */
export const RESTING_BORDER_PLACEHOLDER = {
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
} as const

export type FieldInlineStyle = { borderWidth?: string; borderStyle?: string; borderColor?: string }

/**
 * 调用方这一串 class 里是否已经自己画了描边(有 ⇒ 常态不得覆盖它,否则可见边框会消失)。
 * 工具类可能带变体前缀(`focus:border-primary`)、染色后缀(`border-primary/20`)、任意值
 * (`border-[2rpx]`),所以按 `:` 切段后判"某段以 border 开头";`rounded-*`/`divide-*` 不是本元素的描边。
 */
export function hasRestingBorder(className?: string): boolean {
  if (!className) return false
  return className.split(/\s+/).some((token) =>
    token
      .replace(/^!/, '')
      .split(':')
      .some((seg) => /^border(?!-radius)/.test(seg)),
  )
}

/**
 * 常态:没画过描边的输入框先占 1px 透明位 —— weapp 全局 `box-sizing: border-box` 由 preflight 给定,
 * 预留后聚焦只换颜色 ⇒ 不产生 1px 布局跳动(与 web `border border-input` → `focus-visible:border-primary` 同形)。
 * 聚焦:换成墨档。已画描边的调用方:两种情况下都**只**在聚焦时改颜色。
 */
export function computeFocusStyle(
  focused: boolean,
  className?: string,
): FieldInlineStyle | undefined {
  const rest = hasRestingBorder(className) ? undefined : { ...RESTING_BORDER_PLACEHOLDER }
  if (!focused) return rest
  return { ...(rest ?? {}), borderColor: FOCUS_INK_BORDER }
}

/**
 * 把本组件算出的描边档与调用方给的 style 合成一份。
 * Taro 的 `style` 既可能是对象也可能是 **CSS 文本串**,所以对串只能拼接、不能展开
 * (展开字符串是 TS2698)。拼接时把调用方放后面 ⇒ 同一条属性仍是调用方赢,
 * 本组件只补它没写的东西,不抢它的观感。
 */
export function mergeFocusStyle(
  base: FieldInlineStyle | undefined,
  caller?: string | Record<string, string> | null,
): string | Record<string, string> | undefined {
  if (!base) return caller ?? undefined
  if (caller === null || caller === undefined) {
    return Object.entries(base)
      .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
      .join(';')
  }
  if (typeof caller === 'string') {
    const text = Object.entries(base)
      .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
      .join(';')
    return `${text};${caller}`
  }
  return { ...base, ...caller }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
