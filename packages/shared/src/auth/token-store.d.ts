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
/**
 * 跨端 Token 存储契约
 *
 * 描述 extension/mobile-rn/miniapp-taro 三端 token 管理的统一类型契约。
 * 同步方法(getToken/getRefreshToken)兼容内存缓存与 sync storage 两种语义;
 * 异步方法(setToken/setRefreshToken)返回 Promise<void> | void,
 * 兼容 chrome.storage.local / SecureStore / Taro.storage 等不同存储后端。
 * clearAll 为可选方法,允许各端按需实现(部分端命名差异如 clearAuth)。
 */
export interface TokenStore {
    /** 同步获取 token(extension/mobile-rn 走缓存,miniapp-taro 走 sync storage) */
    getToken(): string | null;
    /** 同步获取 refresh token */
    getRefreshToken(): string | null;
    /** 异步设置 token(写存储 + 更新缓存) */
    setToken(token: string | null): Promise<void> | void;
    /** 异步设置 refresh token */
    setRefreshToken(token: string | null): Promise<void> | void;
    /** 异步清除所有 token(可选,部分端可能用 clearAuth 等不同命名) */
    clearAll?(): Promise<void> | void;
    /** 同步获取 expiresIn(可选,各端按需实现) */
    getExpiresIn?(): number | null;
    /** 异步设置 expiresIn(可选,写存储 + 更新缓存) */
    setExpiresIn?(expiresIn: number | null): Promise<void> | void;
}
/**
 * 含 UserInfo 管理的 Token 存储扩展契约
 *
 * 为 miniapp-taro 这类需要管理 UserInfo 的端提供扩展契约,
 * 通过泛型 TUserInfo 允许各端注入自己的用户信息类型。
 */
export interface TokenStoreWithUserInfo<TUserInfo = unknown> extends TokenStore {
    /** 同步获取用户信息 */
    getUserInfo(): TUserInfo | null;
    /** 同步设置用户信息 */
    setUserInfo(info: TUserInfo): void;
}
/**
 * createInMemoryTokenStore 工厂配置项
 *
 * - initial:初始缓存值(可选,用于 hydration 场景)
 * - onSetToken/onSetRefreshToken/onSetExpiresIn/onClearAll:持久化回调,
 *   各端 adapter 在此调用 chrome.storage / SecureStore / Taro.storage
 */
export interface InMemoryTokenStoreOptions {
    /** 初始缓存值(可选,用于 hydration 场景) */
    initial?: {
        token?: string | null;
        refreshToken?: string | null;
        expiresIn?: number | null;
    };
    /** 设置 token 后的持久化回调(各端在此写存储) */
    onSetToken?: (token: string | null) => Promise<void> | void;
    /** 设置 refresh token 后的持久化回调 */
    onSetRefreshToken?: (token: string | null) => Promise<void> | void;
    /** 设置 expiresIn 后的持久化回调 */
    onSetExpiresIn?: (expiresIn: number | null) => Promise<void> | void;
    /** 清除所有 token 后的持久化回调 */
    onClearAll?: () => Promise<void> | void;
}
/**
 * setCachedWithoutPersist 入参:外部缓存更新增量
 *
 * 仅更新显式提供的字段(用 `undefined` 表示"不更新该字段",
 * `null` 表示"清空该字段")。用于跨标签页 onStorageChanged 同步:
 * 其他标签页写入 storage 后,本标签页通过 onChanged 监听到变化,
 * 需更新内存缓存但不回写 storage(否则循环触发)。
 */
export interface InMemoryTokenStoreCacheUpdates {
    token?: string | null;
    refreshToken?: string | null;
    expiresIn?: number | null;
}
/**
 * createInMemoryTokenStore 返回类型:TokenStore + expiresIn + 外部缓存更新
 *
 * 在 TokenStore 基础上:
 * - 将可选的 getExpiresIn/setExpiresIn 提升为必需方法(本工厂始终实现)
 * - 新增 setCachedWithoutPersist:供各端 onStorageChanged 监听同步缓存
 */
export type InMemoryTokenStore = TokenStore & {
    /** 异步清除所有 token(本工厂始终实现,提升为必需方法) */
    clearAll(): Promise<void> | void;
    /** 同步获取 expiresIn(本工厂始终实现) */
    getExpiresIn(): number | null;
    /** 异步设置 expiresIn(写存储 + 更新缓存) */
    setExpiresIn(expiresIn: number | null): Promise<void> | void;
    /**
     * 外部更新缓存(不触发持久化回调)
     *
     * 用于跨标签页 onStorageChanged 同步场景:其他标签页写入 storage 后,
     * 本标签页通过 onChanged 监听到变化,需更新内存缓存但不回写 storage(否则循环)。
     * 仅更新显式提供的字段(undefined = 不更新,null = 清空)。
     */
    setCachedWithoutPersist(updates: InMemoryTokenStoreCacheUpdates): void;
};
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
export declare function createInMemoryTokenStore(options?: InMemoryTokenStoreOptions): InMemoryTokenStore;
/**
 * 将 TokenStore 绑定到 @ihui/api-client 的 setTokenProvider
 *
 * 统一适配:extension/mobile-rn 等需要把 token 注入到 api-client 的端,
 * 调用此函数即可,无需各自手写 setTokenProvider({ getToken: ... })。
 *
 * 注意:miniapp-taro 因同步 storage 语义不匹配,通常不走此适配器。
 */
export declare function bindTokenStoreToApiClient(store: TokenStore): void;
