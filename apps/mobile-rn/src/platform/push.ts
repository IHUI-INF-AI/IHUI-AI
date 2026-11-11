// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 平台适配层:为鸿蒙(RNOH + ArkTS 自写桥)留替换点 —— 推送统一从这里取。
// usePush 再导出占位:实现仍在 src/hooks/use-push.ts,本轮只统一入口。

export * as Notifications from 'expo-notifications'
export { usePush } from '../hooks/use-push'
