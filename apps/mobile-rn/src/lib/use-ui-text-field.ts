// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 零视觉 footprint 的"登记钩子":把某个 TextInput 背后那份 state 的 setter 交给 RN 控件注册表,
 * 渲染树一个字节都不变。为什么不换组件 —— 本机没有 iOS/Android 模拟器,任何 JSX/样式改动都无法
 * 回归(AGENTS §14 禁止把未验证的 UI 改动当交付),而"裸 TextInput 对 AI 不可见"的真正成因只是
 * 注册表拿不到写入通道,不是 TextInput 本身不能注册。
 *
 * 注册只做一次(deps 稳定),所以所有读值一律经 ref 取"当下" —— 直接闭包捕获 props 会永远读到
 * 首次渲染的旧值,这是 ui-native/input.tsx 已经踩过的坑。
 *
 * secure / password 类根本不注册(注册表另有一层文本判据,但不依赖它兜底)。
 */

import { useEffect, useRef } from 'react'

import { registerRnField } from './ui-field-registry'

export interface UseUiTextFieldOptions {
  /** 可读标签:优先 placeholder 原文,其次 accessibilityLabel / 相邻 Text */
  label: string
  /** 该输入框当下显示的值(与 JSX 里 value 同源) */
  value: string
  /**
   * 组件真正持有的 setter。省略 = 这个框根本没有写入通道(如 editable={false} 的只读框),
   * 此时仍入表但 writable:false,让 fill 拿到如实的 UNSUPPORTED_ACTION,
   * 而不是"回了 ok 而界面没动"(注册表的核心诚实原则)。
   */
  setValue?: (v: string) => void
  disabled?: boolean
  multiline?: boolean
  maxLength?: number
  /** secureTextEntry:为真则完全不注册 */
  secure?: boolean
  keyboardType?: string
}

/** 结构性敏感信号:密码 / 验证码框连 describe 都不该出现 */
function isStructurallySecure(opts: UseUiTextFieldOptions): boolean {
  return (
    opts.secure === true ||
    opts.keyboardType === 'password' ||
    opts.keyboardType === 'visible-password'
  )
}

function constraintOf(opts: UseUiTextFieldOptions): string {
  return [
    opts.multiline ? 'multiline' : '',
    typeof opts.maxLength === 'number' ? `maxLength=${opts.maxLength}` : '',
    typeof opts.keyboardType === 'string' && opts.keyboardType !== 'default'
      ? opts.keyboardType
      : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function useUiTextField(opts: UseUiTextFieldOptions): void {
  const latest = useRef(opts)
  latest.current = opts
  const skip = isStructurallySecure(opts)

  useEffect(() => {
    if (skip) return
    const handle = registerRnField({
      kind: 'input',
      label: () => latest.current.label,
      value: () => latest.current.value,
      disabled: () => latest.current.disabled === true,
      constraint: () => constraintOf(latest.current),
      sensitive: () => isStructurallySecure(latest.current),
      writable: () => typeof latest.current.setValue === 'function',
      write: (text: string) => latest.current.setValue?.(text),
    })
    return () => handle?.dispose()
  }, [skip])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
