/**
 * @ihui/shared/hooks/use-auth — 跨端共享 Auth Hook(2026-07-25 立)
 *
 * 设计原则:
 * 1. 依赖注入:各端必须传入 TokenStore 实现(不内置存储逻辑)
 * 2. 零新依赖:纯 useState + useEffect,不引入 zustand(兼容 extension MV3 / mobile-rn Hermes)
 * 3. 非破坏性:与各端现有 auth store 平行存在,可通过 re-export 桥接(参考 date-utils 模式)
 * 4. 泛型 TUser:兼容 miniapp-taro 的 UserInfo 扩展(默认 AuthUser)
 *
 * 各端接入示例:
 * - mobile-rn: useAuth({ store: rnTokenStore, bindTransport: bindTokenStoreToApiClient })
 * - extension: useAuth({ store: extTokenStore, bindTransport: bindTokenStoreToApiClient, fetchProfile: getProfile })
 * - web: 桥接版,内部订阅 useAuthStore,对外接口与本 hook 一致(保留 getState() 能力)
 * - miniapp-taro: useAuth<UserInfo>({ store: taroTokenStore })
 *
 * 前置依赖:packages/shared/src/auth/token-store.ts(已存在,提供 TokenStore 接口)
 */
import { useCallback, useEffect, useState } from 'react';
/**
 * 跨端共享 Auth Hook
 *
 * @example
 * ```ts
 * // mobile-rn 接入示例
 * const auth = useAuth({
 *   store: rnTokenStore,
 *   bindTransport: bindTokenStoreToApiClient,
 *   fetchProfile: async () => {
 *     const res = await getProfile()
 *     return { success: res.success, data: res.data }
 *   },
 * })
 * ```
 */
export function useAuth(options) {
    const { store, bindTransport, fetchProfile, logoutApi, autoBind = true } = options;
    // user 独立管理(不放入 store,因各端 user 持久化策略不同)
    const [user, setUser] = useState(null);
    // token state 仅用于触发 React 重渲染(真值从 store 同步读取)
    const [tokenVersion, setTokenVersion] = useState(0);
    const [ready, setReady] = useState(false);
    // 挂载时绑定 transport
    useEffect(() => {
        if (autoBind && bindTransport) {
            bindTransport(store);
        }
        setReady(true);
    }, [store, bindTransport, autoBind]);
    // 从 store 同步读取 token(内存缓存,无 async)
    const token = store.getToken();
    const refreshToken = store.getRefreshToken();
    // tokenVersion 仅用于触发 React 重渲染(setTokenVersion 在 login/logout 中调用)
    // void 显式消费,避免"未使用变量"警告
    void tokenVersion;
    const isAuthenticated = !!token;
    const login = useCallback(async (newToken, newRefreshToken, newUser) => {
        await store.setToken(newToken);
        if (newRefreshToken !== undefined) {
            await store.setRefreshToken(newRefreshToken);
        }
        setTokenVersion((v) => v + 1);
        if (newUser) {
            setUser(newUser);
        }
        else if (fetchProfile) {
            const res = await fetchProfile();
            if (res.success && res.data) {
                setUser(res.data);
            }
        }
    }, [store, fetchProfile]);
    const logout = useCallback(async () => {
        const rt = store.getRefreshToken();
        if (logoutApi && rt) {
            try {
                await logoutApi(rt);
            }
            catch {
                // 后端 logout 失败不阻塞本地清理
            }
        }
        await store.clearAll?.();
        setUser(null);
        setTokenVersion((v) => v + 1);
    }, [store, logoutApi]);
    const refresh = useCallback(async () => {
        // 默认不实现,各端按需注入 refresh 逻辑
        // web/extension 可通过 useCallback 闭包注入 chrome.alarms / cookie refresh
        return false;
    }, []);
    return {
        user,
        token,
        refreshToken,
        isAuthenticated,
        ready,
        login,
        logout,
        refresh,
        setUser,
    };
}
//# sourceMappingURL=use-auth.js.map