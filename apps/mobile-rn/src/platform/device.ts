// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 平台适配层:为鸿蒙(RNOH + ArkTS 自写桥)留替换点 —— 设备信息统一从这里取。

export * as Device from 'expo-device'
export { modelId } from 'expo-device'
// 透明转发:业务侧沿用 `import * as Device from ...`,命名空间对象上必须直接可见 isDevice 等成员。
export * from 'expo-device'
