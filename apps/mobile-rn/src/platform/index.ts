// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 平台适配层总入口(按域汇总):业务代码只 import 本入口或其同名子模块,不直接依赖 expo-*。
// 鸿蒙接入时逐域替换实现即可,业务侧 import 不用再动。

export * from './fs'
export * from './picker'
// media-library 的 Asset 与 expo-asset 的 Asset 同名,汇总层给相册资源加 Media 前缀避免冲突
export * as MediaLibrary from './media-library'
export { Asset as MediaAsset, requestPermissionsAsync } from './media-library'
export * from './audio'
export * from './camera'
// expo-image-picker 也导出同名 useCameraPermissions,这里显式指向相机域以消除歧义
export { useCameraPermissions } from './camera'
export * from './blur'
export * from './secure-store'
export * from './push'
export * from './device'
export * from './updates'
export * from './linking'
export * from './biometrics'
export * from './asset'
export * from './ui'
