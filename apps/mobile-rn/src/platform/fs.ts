// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 平台适配层:为鸿蒙(RNOH + ArkTS 自写桥)留替换点 —— 业务侧只认本文件,不直接依赖 expo-file-system。

export { File, Paths, FileMode, UploadType } from 'expo-file-system'
export * as FileSystem from 'expo-file-system'
// 透明转发:业务侧沿用 `import * as FileSystem from ...`,命名空间对象上必须直接可见全部根 API。
export * from 'expo-file-system'
// legacy 面(createDownloadResumable / getContentUriAsync 等)与新版 API 不是同一套,单独成域
export * as LegacyFs from 'expo-file-system/legacy'
