// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 平台适配层:为鸿蒙(RNOH + ArkTS 自写桥)留替换点 —— 深链与外部浏览器统一从这里取。

export * as Linking from 'expo-linking'
export type { QueryParams } from 'expo-linking'
export * as WebBrowser from 'expo-web-browser'
// 透明转发:业务侧沿用 `import * as Linking from ...`,命名空间对象上必须直接可见
// addEventListener / getInitialURL / parse 等成员。
export * from 'expo-linking'
