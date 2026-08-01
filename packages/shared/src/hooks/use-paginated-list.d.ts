import { type PageData } from '@ihui/api-client';
export type Fetcher<T> = (query: {
    page: number;
    pageSize: number;
}) => Promise<{
    success: true;
    data: PageData<T>;
} | {
    success: false;
    error?: string;
}>;
export interface PaginatedListResult<T> {
    items: T[];
    loading: boolean;
    refreshing: boolean;
    loadingMore: boolean;
    error: string;
    page: number;
    total: number;
    refresh: () => void;
    loadMore: () => void;
    removeItem: (predicate: (item: T) => boolean) => void;
}
/**
 * 分页列表管理 Hook(无平台依赖,纯 React hooks)
 *
 * 在 shared/use-pagination 纯状态 hook 之上扩展列表管理:
 * items / loading / refreshing / loadingMore / error / refresh / loadMore / removeItem。
 *
 * 各端(RN/Taro/Web)可直接 re-export 使用,避免重复实现。
 */
export declare function usePaginatedList<T>(fetcher: Fetcher<T>, pageSize?: number): PaginatedListResult<T>;
