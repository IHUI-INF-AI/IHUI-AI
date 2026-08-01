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
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand/react';
import { persist, createJSONStorage } from 'zustand/middleware';
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
export function createAuthStore(options) {
    const { tokenStore, userTransport, userPersistKey = 'ihui-auth-user', userPartialize, onLogin, onLogout, } = options;
    // 包装 transport 为 zustand persist 需要的 StateStorage 接口(返回 raw string)
    // 注意:user persist 只存 user + isAuthenticated(security: 不存 token)
    const persistStorage = {
        getItem: async (name) => {
            if (!userTransport)
                return null;
            return userTransport.getItem(name);
        },
        setItem: async (name, value) => {
            if (!userTransport)
                return;
            await userTransport.setItem(name, value);
        },
        removeItem: async (name) => {
            if (!userTransport)
                return;
            await userTransport.removeItem(name);
        },
    };
    // storeApi 在下方 createStore 调用后初始化,initialState 内的方法体在运行时
    // 才被调用(闭包延迟解析),故此处引用 storeApi 不会触发 TDZ。
    const initialState = {
        token: null,
        refreshToken: null,
        expiresIn: null,
        isAuthenticated: false,
        user: null,
        ready: false,
        setAuth: async (input) => {
            await tokenStore.setToken(input.token);
            if (input.refreshToken !== undefined) {
                await tokenStore.setRefreshToken(input.refreshToken);
            }
            // 同步镜像
            storeApi.setState({
                token: input.token,
                refreshToken: input.refreshToken ?? storeApi.getState().refreshToken,
                expiresIn: input.expiresIn ?? storeApi.getState().expiresIn,
                isAuthenticated: true,
                user: input.user !== undefined ? input.user : storeApi.getState().user,
            });
            if (onLogin) {
                await onLogin(input.user !== undefined ? input.user : storeApi.getState().user);
            }
        },
        setUser: (user) => {
            storeApi.setState({ user });
        },
        logout: async () => {
            await tokenStore.clearAll?.();
            storeApi.setState({
                token: null,
                refreshToken: null,
                expiresIn: null,
                isAuthenticated: false,
                user: null,
            });
            if (onLogout) {
                await onLogout();
            }
        },
        hydrate: () => {
            const token = tokenStore.getToken();
            const refreshToken = tokenStore.getRefreshToken();
            storeApi.setState({
                token,
                refreshToken,
                expiresIn: storeApi.getState().expiresIn,
                isAuthenticated: !!token,
            });
        },
        setReady: (ready) => {
            storeApi.setState({ ready });
        },
    };
    // 用 createStore from 'zustand/vanilla' 替代 create from 'zustand'
    // createStore 不依赖 React,可被 Taro Vite runner 正确打包(详见文件顶部修复说明)
    const storeApi = createStore()(persist(() => initialState, {
        name: userPersistKey,
        storage: createJSONStorage(() => persistStorage),
        // 安全:仅持久化 user + isAuthenticated,token 一律不落盘
        partialize: (state) => {
            const persisted = {
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            };
            if (userPartialize && state.user) {
                const partial = userPartialize(state.user);
                if (partial) {
                    persisted.user = { ...state.user, ...partial };
                }
            }
            return persisted;
        },
        // SSR 友好:hydrate 完成后设置 ready
        onRehydrateStorage: () => (state) => {
            if (state) {
                state.ready = true;
            }
        },
        version: 1,
    }));
    // 创建 bound hook:兼容原 UseBoundStore 类型签名
    // - 无参调用 useAuthStore() → 返回整个 state(useStore 的 selector 默认 identity)
    // - selector 调用 useAuthStore((s) => s.user) → 返回切片
    // - .getState()/.setState()/.subscribe() → 转发到 storeApi
    // storeApi 的方法基于闭包 state(非 this),作为引用赋值给 useBoundStore 后仍正确工作。
    const useBoundStore = Object.assign(function useAuthStoreHook(selector) {
        return useStore(storeApi, selector);
    }, {
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe,
    });
    return {
        useAuthStore: useBoundStore,
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe,
        hydrate: () => {
            const token = tokenStore.getToken();
            const refreshToken = tokenStore.getRefreshToken();
            storeApi.setState({ token, refreshToken, isAuthenticated: !!token });
        },
    };
}
//# sourceMappingURL=auth-store.js.map