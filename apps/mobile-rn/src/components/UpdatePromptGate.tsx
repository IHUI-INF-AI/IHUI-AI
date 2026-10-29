// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * OTA 卡片的加载门。
 *
 * expo-updates 的 JS 包在**求值期**就调用 requireNativeModule('ExpoUpdates'),
 * 而未编入该原生模块的包(本机 debug APK 即此型)会当场抛
 * `Cannot find native module 'ExpoUpdates'` ⇒ startup 红屏。
 * 故不能静态 import UpdatePrompt:按原生模块存在性按需 require,
 * 缺失时渲染空组件(更新能力不可用不应拖垮整个 App)。
 */
import { requireOptionalNativeModule } from 'expo-modules-core'
import type { ComponentType } from 'react'

interface PromptModule {
  UpdatePrompt: ComponentType
}

/* eslint-disable @typescript-eslint/no-require-imports -- 按需加载:静态 import 会在缺原生模块的包里启动即抛 */
const promptModule: PromptModule | null =
  requireOptionalNativeModule('ExpoUpdates') !== null
    ? (require('./UpdatePrompt') as PromptModule)
    : null
/* eslint-enable @typescript-eslint/no-require-imports */

export const UpdatePromptGate: ComponentType = promptModule ? promptModule.UpdatePrompt : () => null
