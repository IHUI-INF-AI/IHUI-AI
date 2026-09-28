// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// usePagination(纯状态)和 usePaginatedList(完整列表管理)已迁移到 @ihui/shared/hooks(单一来源)
// 本文件保留 re-export 保持外部 import { usePagination } from './use-pagination' 引用不变
// 原 miniapp-taro 本地扩展的 list/loading/appendList 逻辑已由 usePaginatedList 提供,消除重复实现
export { usePagination, usePaginatedList } from '@ihui/shared/hooks'
