/**
 * @ihui/shared/auth/token-store — 跨端 Token 管理通用契约
 *
 * 三端(extension/mobile-rn/miniapp-taro)token 管理实现差异:
 * - extension: chrome.storage.local 异步 + onChanged 监听
 * - mobile-rn: SecureStore 异步 + AsyncStorage fallback
 * - miniapp-taro: Taro.storage 同步(无 setTokenProvider 注入,因 API 语义不匹配)
 *
 * 本文件提供:
 * 1. TokenStore 接口:跨端类型契约(可选方法允许各端按需实现)
 * 2. TokenStoreWithUserInfo 接口:扩展契约(含 UserInfo 管理)
 * 3. createInMemoryTokenStore:可复用内存缓存工厂(各端 adapter 基类)
 * 4. bindTokenStoreToApiClient:统一注入到 @ihui/api-client 的适配器
 *
 * 各端**可选**接入:现有实现保持不变,后续重构或新端接入时复用此契约。
 */
import { setTokenProvider } from '@ihui/api-client';
/**
 * 创建内存缓存 TokenStore(各端 adapter 基类)
 *
 * 维护 cachedToken/cachedRefreshToken/cachedExpiresIn 内存缓存,
 * 通过 options 回调将持久化逻辑下放到各端 adapter,实现"缓存统一 + 存储差异化"。
 *
 * @example
 * ```ts
 * // extension adapter 示意
 * const store = createInMemoryTokenStore({
 *   onSetToken: (t) => chrome.storage.local.set({ token: t }),
 *   onClearAll: () => chrome.storage.local.remove(['token', 'refreshToken']),
 * })
 * // 跨标签页同步:onStorageChanged 触发时只更新缓存,不回写 storage
 * store.setCachedWithoutPersist({ token: 'new-from-other-tab' })
 * ```
 */
export function createInMemoryTokenStore(options) {
    let cachedToken = options?.initial?.token ?? null;
    let cachedRefreshToken = options?.initial?.refreshToken ?? null;
    let cachedExpiresIn = options?.initial?.expiresIn ?? null;
    return {
        getToken: () => cachedToken,
        getRefreshToken: () => cachedRefreshToken,
        getExpiresIn: () => cachedExpiresIn,
        setToken: async (token) => {
            cachedToken = token;
            await options?.onSetToken?.(token);
        },
        setRefreshToken: async (token) => {
            cachedRefreshToken = token;
            await options?.onSetRefreshToken?.(token);
        },
        setExpiresIn: async (expiresIn) => {
            cachedExpiresIn = expiresIn;
            await options?.onSetExpiresIn?.(expiresIn);
        },
        clearAll: async () => {
            cachedToken = null;
            cachedRefreshToken = null;
            cachedExpiresIn = null;
            await options?.onClearAll?.();
        },
        setCachedWithoutPersist: (updates) => {
            if (updates.token !== undefined)
                cachedToken = updates.token;
            if (updates.refreshToken !== undefined)
                cachedRefreshToken = updates.refreshToken;
            if (updates.expiresIn !== undefined)
                cachedExpiresIn = updates.expiresIn;
        },
    };
}
/**
 * 将 TokenStore 绑定到 @ihui/api-client 的 setTokenProvider
 *
 * 统一适配:extension/mobile-rn 等需要把 token 注入到 api-client 的端,
 * 调用此函数即可,无需各自手写 setTokenProvider({ getToken: ... })。
 *
 * 注意:miniapp-taro 因同步 storage 语义不匹配,通常不走此适配器。
 */
export function bindTokenStoreToApiClient(store) {
    setTokenProvider({ getToken: () => store.getToken() });
}
//# sourceMappingURL=token-store.js.map