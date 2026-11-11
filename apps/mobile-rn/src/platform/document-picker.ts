// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 平台适配层:为鸿蒙(RNOH + ArkTS 自写桥)留替换点 —— 文档选择器统一从这里取。
// 单包成域:只求值 expo-document-picker,不牵连图片选择器(否则只 mock 其一的测试会在收集期崩)。

export * as DocumentPicker from 'expo-document-picker'
// 透明转发:业务侧沿用 `import * as DocumentPicker from ...`,命名空间对象上可直接见
// getDocumentAsync 等成员。
export * from 'expo-document-picker'
