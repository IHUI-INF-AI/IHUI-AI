/**
 * @ihui/shared/stores — 跨端共享 zustand store 工厂集合(2026-07-25 立)
 *
 * 4 类 store 工厂:
 * - createAuthStore:Auth(token + user + isAuthenticated),依赖 TokenStore 契约
 * - createUserStore:User profile(可泛型 TProfile)
 * - createThemeStore:Theme mode + accent + font + highContrast
 * - transport 抽象:createMemoryTransport / createSyncTransport / createAsyncTransport
 *               / createJsonTransport / createSSRSafeTransport
 *
 * 设计原则:
 * 1. 零运行时依赖:除 zustand 外不依赖任何端特定 API(@ihui/api-client 仅类型)
 * 2. 依赖注入:所有 IO(持久化 + token 存储)由各端注入
 * 3. 安全优先:auth store 不持久化 token,只持久化 user + isAuthenticated
 *    遵循 web 端 2026-07-21 安全审计结论
 * 4. 非破坏性:与已有 useAuth hook(stage 4)平行存在,共享同一 TokenStore
 */

export * from './transport'
export * from './auth-store'
export * from './user-store'
export * from './theme-store'
