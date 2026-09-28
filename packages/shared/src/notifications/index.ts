// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export * from './ws-notification-adapter'
export * from './use-notification-websocket'
// notification-store.tsx 不在此导出:它含 JSX/React Context,仅前端(mobile-rn/extension)
// 通过子路径 @ihui/shared/notifications/notification-store 直接导入,避免 api 端 tsc 因缺 jsx 配置报 TS6142
