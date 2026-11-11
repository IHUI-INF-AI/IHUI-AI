// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 平台适配层:为鸿蒙(RNOH + ArkTS 自写桥)留替换点 —— 相册读写统一从这里取。
// 注意:必须保持**裸模块名** 'expo-media-library',metro.config.cjs 的 web 重定向靠它匹配。

export * as MediaLibrary from 'expo-media-library'
export { Asset, requestPermissionsAsync } from 'expo-media-library'
// 透明转发:业务侧沿用 `import * as MediaLibrary from ...`,命名空间对象上必须直接可见
// saveToLibraryAsync / createAssetAsync / requestPermissionsAsync 等成员。
export * from 'expo-media-library'
