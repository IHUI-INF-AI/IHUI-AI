// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-webview.tsx —— `react-native-webview` 的小程序端承载。
 *
 * 为什么必须补:该包入口同样是未编译的 `src/index.ts`(入口实测),由壳承载闭包里的
 * `ChatToolsScreen` / `LoginScreen` 带入;weapp 侧不转译 node_modules 的 .ts ⇒ ModuleParseError。
 *
 * 为什么这里**不做**真网页承载:小程序的网页能力是独立组件 `<web-view>` + 业务域名白名单 +
 * 独立页面级容器,与 RN 的 in-app WebView props 不同形(不是同一层东西)。端内已有
 * `pages/webview/index` 那条真通道;要在这里"实现"只能造假 props,反而把差异藏起来。
 * ⇒ 本文件给的是**最小可见替代**:显示链接 + 点击复制,并点名真出路。
 */
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { JSX } from 'react'
import { onToast } from '@/host/on-toast'

let warned = false

/**
 * XUI-012:必须同时提供**命名导出**。
 *
 * 消费方按 RN 上游包的形状写 `import { WebView } from 'react-native-webview'`
 * (`apps/mobile-rn/src/screens/{ArtifactPreview,Login,WebView}Screen.tsx` 三处),
 * 而本文件修前只有 `export default` —— 命名导入在 ESM 下拿到的是 `undefined`,
 * 小程序端共享屏一渲染就抛 "Element type is invalid",整屏白。
 *
 * 这里让 default 与 named 指向**同一个函数**:两个名字一份实现,不存在第二份行为。
 */
export default function WebView({
  source,
  style,
}: {
  source?: { uri?: string }
  style?: unknown
  [k: string]: unknown
}): JSX.Element {
  const uri = source?.uri ?? ''
  if (!warned) {
    warned = true
    console.warn(
      '[rn-compat] react-native-webview 在小程序端不同形(只有 <web-view> + 业务域名白名单)⇒ 此处只显示外链;真网页承载走端内 pages/webview/index',
    )
  }
  const open = (): void => {
    if (!uri) return
    void Taro.setClipboardData({ data: uri }).then(() => onToast('链接已复制', { kind: 'info' }))
  }
  return (
    <View style={{ ...(style as object), padding: 12 }}>
      <Text onClick={open} style={{ color: '#2563eb' }}>
        {uri || '(无链接)'}
      </Text>
    </View>
  )
}

export type WebViewNavigation = Record<string, unknown>

/** XUI-012:命名导出与 default 是同一函数引用(见文件上方 `export default function WebView`)。 */
export { WebView }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
