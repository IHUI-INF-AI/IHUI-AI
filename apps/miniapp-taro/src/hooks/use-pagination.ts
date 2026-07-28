// usePagination(纯状态)和 usePaginatedList(完整列表管理)已迁移到 @ihui/shared/hooks(单一来源)
// 本文件保留 re-export 保持外部 import { usePagination } from './use-pagination' 引用不变
// 原 miniapp-taro 本地扩展的 list/loading/appendList 逻辑已由 usePaginatedList 提供,消除重复实现
export { usePagination, usePaginatedList } from '@ihui/shared/hooks'