/**
 * @ihui/shared/stores/auth-store — 跨端共享 Auth zustand 工厂
 *
 * 设计原则(2026-07-25 立):
 * 1. 零新概念:复用已有 TokenStore 契约(stage 1-3 已落地),auth store 仅镜像状态供 React 订阅
 * 2. 依赖注入:tokenStore(必传)+ userTransport(可选,用于 user 持久化)由各端注入
 * 3. 非破坏性:与 useAuth hook(stage 4 落地)平行存在,组件可任选;后续阶段可桥接
 * 4. 安全优先:token/refreshToken/expiresIn 一律不持久化(走 tokenStore),只持久化 isAuthenticated + user
 *    遵循 web 端 2026-07-21 安全审计结论:localStorage 不可存 token,httpOnly cookie 才是正解
 *
 * 与 useAuth hook(stage 4)的差异:
 * - useAuth:hook 层(组件级 useState + useEffect),适合"用一次创建一次"的场景
 * - createAuthStore:store 层(全局 zustand + persist),适合"跨组件订阅同一份状态"的场景
 * - 二者底层都依赖同一 TokenStore,数据源一致
 *
 * 各端接入示例:
 * - web: createAuthStore({ tokenStore: webTokenStore, userTransport: localStorageTransport })
 * - mobile-rn: createAuthStore({ tokenStore: rnTokenStore, userTransport: asyncStorageTransport })
 * - miniapp-taro: createAuthStore({ tokenStore: taroTokenStore, userTransport: taroStorageTransport })
 * - extension: createAuthStore({ tokenStore: extTokenStore, userTransport: chromeStorageTransport })
 *
 * 前置依赖:packages/shared/src/auth/token-store.ts(已存在)
 */
/**
 * 修复说明(2026-07-26 立,Taro Vite 归并 bug):
 * Taro 4.2.0 Vite runner 把 `import { create } from 'zustand'` 错误归并为
 * `taro.react_production_min.create`(React 上无此函数),导致 miniapp-taro 运行时抛
 * `TypeError: taro.react_production_min.create is not a function`。
 *
 * 修复方案:用 `createStore` from 'zustand/vanilla' + `useStore` from 'zustand/react'
 * 替换 `create` from 'zustand'。`createStore` 不依赖 React(可被 Vite 正确打包),
 * `useStore` 用 `React.useSyncExternalStore`(在 Taro 中存在)。
 *
 * 注意:导出的 useAuthStore 仍保持原 UseBoundStore 类型签名,既可作 hook 调用
 * (useAuthStore((s) => s.user) 或 useAuthStore()),又可访问 .getState()/.setState()/.subscribe()。
 */
import { type StoreApi } from 'zustand/vanilla';
import { type UseBoundStore } from 'zustand/react';
import type { AuthUser } from '@ihui/api-client';
import type { TokenStore } from '../auth/token-store';
import type { PersistTransport } from './transport';
export interface AuthStoreState<TUser = AuthUser> {
    /** access token(镜像自 tokenStore,仅供 React 订阅,真值在 tokenStore) */
    token: string | null;
    /** refresh token(镜像自 tokenStore) */
    refreshToken: string | null;
    /** token 过期时间(秒),镜像自 tokenStore */
    expiresIn: number | null;
    /** 是否已认证,derived: !!token(为方便订阅者,显式存储) */
    isAuthenticated: boolean;
    /** 当前用户信息(可持久化) */
    user: TUser | null;
    /** hydrate 是否完成(用于避免首屏渲染时 user 闪烁) */
    ready: boolean;
    /**
     * 设置完整认证态(写 tokenStore + 镜像本地)
     *
     * @param input 至少需要 token,其他字段可选
     */
    setAuth: (input: {
        token: string;
        refreshToken?: string | null;
        expiresIn?: number | null;
        user?: TUser | null;
    }) => Promise<void>;
    /** 仅更新 user 字段(不触发 tokenStore 写入) */
    setUser: (user: TUser | null) => void;
    /**
     * 登出(调 tokenStore.clearAll + 清本地镜像 + 清 user)
     * 业务侧 logout API 注入由 onLogout 钩子处理
     */
    logout: () => Promise<void>;
    /**
     * 从 tokenStore 同步读取 token/refreshToken/expiresIn 并更新本地镜像
     * 初始化时(hydrate 前)由 useAuthStore 调用,后续 tokenStore 变化时各端订阅 chrome.storage.onChanged 等
     */
    hydrate: () => void;
    /** 标记 ready(true),用于 SSR 后客户端首帧渲染 */
    setReady: (ready: boolean) => void;
}
export interface CreateAuthStoreOptions<TUser = AuthUser> {
    /** 必传:各端 token 存储实现(已遵守 TokenStore 契约) */
    tokenStore: TokenStore;
    /**
     * 可选:user 持久化 transport
     * 不传则 user 仅存内存(SSR / 测试 / 不需跨会话恢复的场景)
     */
    userTransport?: PersistTransport;
    /** user 持久化的 storage key,默认 'ihui-auth-user' */
    userPersistKey?: string;
    /**
     * user 持久化 partialize(过滤掉非序列化字段)
     * 默认全量持久化
     */
    userPartialize?: (user: TUser | null) => Partial<TUser> | null;
    /** 登录成功钩子(写完 tokenStore 后调用) */
    onLogin?: (user: TUser | null) => void | Promise<void>;
    /** 登出钩子(清完 tokenStore 后调用) */
    onLogout?: () => void | Promise<void>;
}
export interface CreatedAuthStore<TUser = AuthUser> {
    /** zustand bound hook(组件用 useAuthStore(selector) 订阅) */
    useAuthStore: UseBoundStore<StoreApi<AuthStoreState<TUser>>>;
    /** 直接读 state(命令式 / 测试用) */
    getState: () => AuthStoreState<TUser>;
    /** 直接写 state(命令式 / 测试用) */
    setState: StoreApi<AuthStoreState<TUser>>['setState'];
    /** 订阅 state 变化 */
    subscribe: StoreApi<AuthStoreState<TUser>>['subscribe'];
    /** 从 tokenStore 同步镜像(初始化 / chrome.storage.onChanged 等场景调用) */
    hydrate: () => void;
}
/**
 * 创建跨端 Auth zustand store
 *
 * @example
 * ```ts
 * // web 端
 * const auth = createAuthStore({
 *   tokenStore: webTokenStore,
 *   userTransport: createSyncTransport({
 *     getItem: (k) => localStorage.getItem(k),
 *     setItem: (k, v) => localStorage.setItem(k, v),
 *     removeItem: (k) => localStorage.removeItem(k),
 *   }),
 * })
 *
 * // 组件订阅
 * const isAuthenticated = auth.useAuthStore((s) => s.isAuthenticated)
 * ```
 */
export declare function createAuthStore<TUser = AuthUser>(options: CreateAuthStoreOptions<TUser>): CreatedAuthStore<TUser>;
