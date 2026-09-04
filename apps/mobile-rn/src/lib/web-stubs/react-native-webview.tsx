// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * react-native-webview 的 web 平台 stub(由 metro.config.cjs resolveRequest 注入,
 * 仅 platform === 'web' 时把 'react-native-webview' 重定向到本文件)。
 *
 * 平台特有:webview 原生模块在浏览器无意义(浏览器本身就是 web 环境),
 * 渲染占位提示。调用方:WebViewScreen / ChatToolsScreen(默认导出)。
 */

import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { rnTokens as tk } from '@ihui/design-tokens'

export interface WebViewStubProps {
  source?: { uri?: string }
  style?: StyleProp<ViewStyle>
}

/** 事件参数类型(web stub 中无真实导航事件,仅供调用方类型引用) */
export type WebViewNavigation = Record<string, unknown>

const WebViewStub = function WebViewStub(props: WebViewStubProps) {
  const uri = props.source?.uri ?? ''
  return (
    <View style={[styles.container, props.style]}>
      <Text style={styles.text}>内嵌网页暂不支持浏览器预览</Text>
      {uri ? <Text style={styles.uri}>{uri}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tk.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: tk.gray[500],
    fontSize: 13,
  },
  uri: {
    color: tk.gray[400],
    fontSize: 10,
    marginTop: 4,
  },
})

export default WebViewStub
