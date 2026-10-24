// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { ComponentProps } from 'react'
import { Switch as TaroSwitch } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

/**
 * 开关组件 —— 与 `packages/ui-native/src/switch.tsx` 逐类对齐(「一模一样」契约)。
 *
 * RN 端是 react-native 原生 `Switch` 的薄封装(只透传 props);小程序端对应 Taro 原生
 * `Switch`(WeChat 同款原生控件),本组件做同形态的薄封装。两端都用平台原生开关控件,
 * 视觉由各自原生实现保证一致,组件层只负责透传 props + className。
 *
 * 改默认外观(如开启态色档)需两端 switch.tsx 同改,不要在一端写死。
 */
export type SwitchProps = ComponentProps<typeof TaroSwitch>

export function Switch({ className, ...props }: SwitchProps) {
  return <TaroSwitch className={cn(className)} {...props} />
}

export default Switch
