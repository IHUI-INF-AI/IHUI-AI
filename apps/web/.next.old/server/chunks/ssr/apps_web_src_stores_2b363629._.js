module.exports = [
"[project]/apps/web/src/stores/persist-helpers.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createPersistConfig",
    ()=>createPersistConfig,
    "ssrStorage",
    ()=>ssrStorage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
;
const noopStorage = {
    getItem: ()=>null,
    setItem: ()=>{},
    removeItem: ()=>{}
};
const ssrStorage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : noopStorage);
function createPersistConfig(name, partialize) {
    return {
        name,
        storage: ssrStorage,
        ...partialize ? {
            partialize
        } : {}
    };
}
}),
"[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAuthStore",
    ()=>useAuthStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/cookie-utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/persist-helpers.ts [app-ssr] (ecmascript)");
;
;
;
;
;
const useAuthStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persist"])((set, get)=>({
        token: null,
        refreshToken: null,
        expiresIn: null,
        isAuthenticated: false,
        user: null,
        setToken: (token, refreshOrPair)=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["setAuthCookie"])(token);
            if (refreshOrPair === null || refreshOrPair === undefined) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearRefreshTokenCookie"])();
                set({
                    token,
                    isAuthenticated: !!token,
                    refreshToken: null,
                    expiresIn: null
                });
                return;
            }
            if (typeof refreshOrPair === 'string') {
                // 默认 session cookie(浏览器关闭失效);autoLogin 由 setTokenWithPrefs 控制
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["setRefreshTokenCookie"])(refreshOrPair || null);
                set({
                    token,
                    isAuthenticated: !!token,
                    refreshToken: refreshOrPair || null,
                    expiresIn: null
                });
                return;
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["setRefreshTokenCookie"])(refreshOrPair.refreshToken ?? null);
            set({
                token,
                isAuthenticated: !!token,
                refreshToken: refreshOrPair.refreshToken ?? null,
                expiresIn: refreshOrPair.expiresIn ?? null
            });
        },
        setTokenWithPrefs: (token, refreshOrPair, autoLogin)=>{
            const refreshToken = typeof refreshOrPair === 'string' ? refreshOrPair : refreshOrPair.refreshToken;
            const expiresIn = typeof refreshOrPair === 'string' ? null : refreshOrPair.expiresIn ?? null;
            const cookieMaxAge = autoLogin ? __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["REMEMBER_MAX_AGE"] : undefined;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["setAuthCookie"])(token, {
                maxAge: cookieMaxAge
            });
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["setRefreshTokenCookie"])(refreshToken ?? null, {
                maxAge: cookieMaxAge
            });
            set({
                token,
                isAuthenticated: !!token,
                refreshToken: refreshToken ?? null,
                expiresIn
            });
        },
        hydrateRefreshToken: ()=>{
            const { refreshToken } = get();
            if (refreshToken) return; // 内存已有,无需恢复
            const fromCookie = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getRefreshTokenCookie"])();
            if (fromCookie) {
                set({
                    refreshToken: fromCookie
                });
            }
        },
        setUser: (user)=>set({
                user
            }),
        logout: ()=>{
            const { refreshToken } = get();
            if (refreshToken) {
                void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logout"])(refreshToken).catch(()=>{});
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["setAuthCookie"])(null);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearRefreshTokenCookie"])();
            set({
                token: null,
                refreshToken: null,
                expiresIn: null,
                isAuthenticated: false,
                user: null
            });
        }
    }), // 2026-07-21 安全审计加固:严禁把 token / refreshToken 持久化到 localStorage
// 原因:localStorage 可被任意 JavaScript 读取,任何 XSS 漏洞
// (含第三方依赖的间接 XSS) 都会让攻击者通过 localStorage.getItem('ihui-auth')
// 直接拿到 access_token + refresh_token,造成全账户劫持
// 修复:仅持久化非敏感 UI 状态(isAuthenticated + user)到 localStorage
// access_token 改用 httpOnly cookie(由后端 Set-Cookie 写入,JS 无法读取)
// refresh_token 必须由后端管理(httpOnly cookie + 定期轮换)
// 此处仅保留 isAuthenticated 标志位用于 UI 渲染决策
(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createPersistConfig"])('ihui-auth', (s)=>({
        isAuthenticated: s.isAuthenticated,
        user: s.user
    }))));
}),
"[project]/apps/web/src/stores/login-dialog.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLoginDialogStore",
    ()=>useLoginDialogStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
;
const useLoginDialogStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set)=>({
        isOpen: false,
        mode: 'login',
        redirectUrl: null,
        open: (mode = 'login', redirectUrl)=>set({
                isOpen: true,
                mode,
                redirectUrl: redirectUrl ?? null
            }),
        close: ()=>set({
                isOpen: false,
                redirectUrl: null
            }),
        setMode: (mode)=>set({
                mode
            })
    }));
}),
"[project]/apps/web/src/stores/notification.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useNotificationStore",
    ()=>useNotificationStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$notifications$2f$ws$2d$notification$2d$adapter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/notifications/ws-notification-adapter.ts [app-ssr] (ecmascript)");
;
;
;
const useNotificationStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persist"])((set)=>({
        notifications: [],
        unreadCount: 0,
        messages: [],
        unreadMessageCount: 0,
        setNotifications: (notifications)=>set({
                notifications,
                unreadCount: notifications.filter((n)=>!n.isRead).length
            }),
        addNotification: (item)=>set((s)=>({
                    notifications: [
                        item,
                        ...s.notifications
                    ],
                    unreadCount: s.unreadCount + (item.isRead ? 0 : 1)
                })),
        markAsRead: (id)=>set((s)=>{
                let decremented = false;
                const notifications = s.notifications.map((n)=>{
                    if (n.id === id && !n.isRead) {
                        decremented = true;
                        return {
                            ...n,
                            isRead: true
                        };
                    }
                    return n;
                });
                return {
                    notifications,
                    unreadCount: Math.max(0, s.unreadCount - (decremented ? 1 : 0))
                };
            }),
        markAllAsRead: ()=>set((s)=>({
                    notifications: s.notifications.map((n)=>({
                            ...n,
                            isRead: true
                        })),
                    unreadCount: 0
                })),
        setMessages: (messages)=>set({
                messages,
                unreadMessageCount: messages.filter((m)=>!m.isRead).length
            }),
        addMessage: (msg)=>set((s)=>({
                    messages: [
                        msg,
                        ...s.messages
                    ],
                    unreadMessageCount: s.unreadMessageCount + (msg.isRead ? 0 : 1)
                })),
        markMessageAsRead: (id)=>set((s)=>{
                let decremented = false;
                const messages = s.messages.map((m)=>{
                    if (m.id === id && !m.isRead) {
                        decremented = true;
                        return {
                            ...m,
                            isRead: true
                        };
                    }
                    return m;
                });
                return {
                    messages,
                    unreadMessageCount: Math.max(0, s.unreadMessageCount - (decremented ? 1 : 0))
                };
            }),
        clearAll: ()=>set({
                notifications: [],
                unreadCount: 0
            }),
        setUnreadCounts: (counts)=>set({
                unreadCount: counts.notifications,
                unreadMessageCount: counts.messages
            }),
        handleWsMessage: (msg)=>{
            const entry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$notifications$2f$ws$2d$notification$2d$adapter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["transformWsNotification"])(msg);
            if (entry) {
                useNotificationStore.getState().addNotification(entry);
            }
        }
    }), {
    name: 'ihui-notification',
    partialize: (s)=>({
            unreadCount: s.unreadCount,
            unreadMessageCount: s.unreadMessageCount
        })
}));
}),
"[project]/apps/web/src/stores/storage-adapter.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * storage-adapter — web 端 localStorage 持久化 transport(2026-07-25 立)
 *
 * 用途:
 * - 包装 `window.localStorage` 为 `@ihui/shared/stores` 定义的 `PersistTransport`
 * - 供 `createAuthStore` / `createUserStore` 等 zustand persist 工厂使用
 * - **不**包含任何 token 相关方法(只做 user / isAuthenticated / theme 等非敏感状态持久化)
 *   遵循 web 端 2026-07-21 安全审计结论:token 一律走 cookie,localStorage 不可存
 *
 * 与共享层 transport 的差异:
 * - `@ihui/shared/stores/transport.ts` 的 `createSyncTransport` 接受通用 SyncStorageAdapter
 *   工厂,本文件针对 web 端 `window.localStorage` 提供两个开箱即用工厂
 * - 包含 SSR 安全 fallback(避免 Next.js 服务端渲染阶段访问 `window` 报错)
 *
 * 使用示例:
 * ```ts
 * // 客户端直接用(假设 window 存在,如 useEffect 内部)
 * const transport = createLocalStorageTransport()
 * transport.setItem('k', 'v')
 *
 * // SSR 安全版(顶层模块作用域安全,服务端返回 noop 内存 transport)
 * const ssrTransport = createSSRSafeWebTransport()
 * ```
 */ __turbopack_context__.s([
    "createLocalStorageTransport",
    ()=>createLocalStorageTransport,
    "createSSRSafeWebTransport",
    ()=>createSSRSafeWebTransport
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/transport.ts [app-ssr] (ecmascript)");
;
function createLocalStorageTransport() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createSyncTransport"])({
        getItem: (key)=>window.localStorage.getItem(key),
        setItem: (key, value)=>window.localStorage.setItem(key, value),
        removeItem: (key)=>window.localStorage.removeItem(key)
    });
}
function createSSRSafeWebTransport() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createSSRSafeTransport"])(()=>({
            getItem: (key)=>window.localStorage.getItem(key),
            setItem: (key, value)=>window.localStorage.setItem(key, value),
            removeItem: (key)=>window.localStorage.removeItem(key)
        }));
}
}),
"[project]/apps/web/src/stores/user.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * user — web 端用户 store(2026-07-28 迁移至 @ihui/shared/stores 工厂)
 *
 * 迁移说明:
 * - 原 create<UserState>()(persist(...)) 手写实现 → createUserStore<UserProfile> 工厂
 * - 工厂提供:profile / loading / error / setProfile / updateProfile / setLoading / setError / reset
 * - 本地扩展(工厂不提供):statistics / following / followers / setStatistics / fetchProfile
 *   通过 setState 注入到 vanilla store,运行时与工厂字段共存
 * - 类型扩展:WebUserState extends UserStoreState<UserProfile>,通过 as unknown as UseBoundStore 暴露扩展字段
 * - 持久化保持与历史一致:profile + statistics + following + followers(partialize 覆盖工厂默认行为)
 * - 版本设为 0,与历史 localStorage 数据一致
 *
 * 调用方(use-auth-bootstrap / use-settings-user-info / use-user-auth)的 selector 用法不变:
 *   useUserStore((s) => s.profile) / useUserStore((s) => s.fetchProfile) 等均可用。
 */ __turbopack_context__.s([
    "useUserStore",
    ()=>useUserStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$user$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/user-store.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$user$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/user.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$storage$2d$adapter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/storage-adapter.ts [app-ssr] (ecmascript)");
;
;
;
const userTransport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$storage$2d$adapter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createSSRSafeWebTransport"])();
const createdStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$user$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createUserStore"])({
    transport: userTransport,
    persistKey: 'ihui-user',
    // 与历史 localStorage 数据一致(原 persist 未设 version,zustand 默认 0)
    version: 0,
    // 持久化字段与原实现一致:profile + statistics + following + followers
    // 工厂 partialize 类型只认 UserStoreState<UserProfile>,扩展字段通过 unknown 双重断言访问
    partialize: (s)=>({
            profile: s.profile,
            statistics: s.statistics,
            following: s.following,
            followers: s.followers
        })
});
// 类型别名:接受扩展字段的 setState(工厂类型只认 UserStoreState<UserProfile>)
const setExtended = createdStore.setState;
// 注入 web 端扩展状态与方法
setExtended({
    statistics: null,
    following: 0,
    followers: 0,
    setStatistics: (stats)=>{
        if (stats) {
            setExtended({
                statistics: stats,
                following: stats.followingCount,
                followers: stats.fansCount
            });
        } else {
            setExtended({
                statistics: stats
            });
        }
    },
    fetchProfile: async ()=>{
        createdStore.setState({
            loading: true,
            error: null
        });
        const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$user$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getProfile"])();
        if (!res.success) {
            createdStore.setState({
                loading: false,
                error: res.error
            });
            return;
        }
        // 后端 /api/auth/me 已补全 gender/birthday/createdAt 等字段,AuthUser 与 UserProfile 形状一致
        createdStore.setState({
            profile: res.data,
            loading: false
        });
    }
});
const useUserStore = createdStore.useUserStore;
}),
"[project]/apps/web/src/stores/language.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLanguageStore",
    ()=>useLanguageStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
;
;
const useLanguageStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persist"])((set)=>({
        locale: 'zh-CN',
        initialized: false,
        setLocale: (locale)=>set({
                locale
            }),
        setInitialized: (initialized)=>set({
                initialized
            })
    }), {
    name: 'ihui-language',
    storage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : {
            getItem: ()=>null,
            setItem: ()=>{},
            removeItem: ()=>{}
        })
}));
// 暴露给 E2E 测试用(window.__IHUI_LANGUAGE_STORE__),仅在非生产环境挂载,
// 避免生产 bundle 多余的全局属性。E2E 通过 useLanguageStore.getState().setLocale()
// 直接更新 locale,无需 reload 等待 zustand persist rehydrate。
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
}),
"[project]/apps/web/src/stores/ai-panel.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AI_PANEL_DEFAULT_WIDTH",
    ()=>AI_PANEL_DEFAULT_WIDTH,
    "AI_PANEL_MAX_WIDTH",
    ()=>AI_PANEL_MAX_WIDTH,
    "AI_PANEL_MIN_WIDTH",
    ()=>AI_PANEL_MIN_WIDTH,
    "FLOAT_DEFAULT_POSITION",
    ()=>FLOAT_DEFAULT_POSITION,
    "useAiPanelStore",
    ()=>useAiPanelStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/persist-helpers.ts [app-ssr] (ecmascript)");
;
;
;
const AI_PANEL_DEFAULT_WIDTH = 400;
const AI_PANEL_MIN_WIDTH = 320;
const AI_PANEL_MAX_WIDTH = 720;
const FLOAT_DEFAULT_POSITION = {
    x: -1,
    y: -1
} // -1 = 未初始化,首次使用时计算右上角
;
const useAiPanelStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persist"])((set)=>({
        // open=true:AI 对话框默认弹出展开(用户规则 2026-07-20 确认)
        open: true,
        width: AI_PANEL_DEFAULT_WIDTH,
        isResizing: false,
        activeWorkspace: null,
        pendingPermissionSetup: null,
        pendingFullAccess: false,
        floatMode: false,
        floatMinimized: false,
        floatCollapsed: false,
        floatPosition: FLOAT_DEFAULT_POSITION,
        openPanel: ()=>set({
                open: true
            }),
        closePanel: ()=>set({
                open: false
            }),
        togglePanel: ()=>set((s)=>({
                    open: !s.open
                })),
        setWidth: (w)=>set({
                width: Math.min(AI_PANEL_MAX_WIDTH, Math.max(AI_PANEL_MIN_WIDTH, w))
            }),
        setResizing: (v)=>set({
                isResizing: v
            }),
        setActiveWorkspace: (ws)=>set({
                activeWorkspace: ws
            }),
        setPendingPermissionSetup: (v)=>set({
                pendingPermissionSetup: v
            }),
        setPendingFullAccess: (v)=>set({
                pendingFullAccess: v
            }),
        setFloatMode: (v)=>set({
                floatMode: v
            }),
        setFloatMinimized: (v)=>set({
                floatMinimized: v
            }),
        setFloatCollapsed: (v)=>set({
                floatCollapsed: v
            }),
        setFloatPosition: (pos)=>set({
                floatPosition: pos
            })
    }), {
    ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createPersistConfig"])('ihui-ai-panel', (s)=>({
            width: s.width,
            activeWorkspace: s.activeWorkspace,
            floatMode: s.floatMode,
            floatPosition: s.floatPosition
        })),
    // 强制 open=true:rehydrate 时即使 localStorage 残留旧版本 open=false 也覆盖为 true。
    // 保证"AI 对话框默认弹出"规则在所有刷新场景下生效。
    merge: (persistedState, currentState)=>({
            ...currentState,
            ...persistedState || {},
            open: true
        })
}));
}),
"[project]/apps/web/src/stores/chat.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useChatStore",
    ()=>useChatStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/persist-helpers.ts [app-ssr] (ecmascript)");
;
;
;
// P1-1 修复(2026-07-28):长会话 messages 数组无上限会导致内存爆炸,
// 保留最近 MAX_MESSAGES 条(滑动窗口),超出时丢弃最旧消息。
// 500 条足够覆盖大部分长对话场景,且内存占用可控。
const MAX_MESSAGES = 500;
function genId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // 2026-07-21 安全审计加固:Web Crypto 不可用时改用 crypto.getRandomValues,
    // 严禁降级到 Math.random (CWE-330 可预测随机)
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const buf = new Uint8Array(16);
        crypto.getRandomValues(buf);
        const hex = Array.from(buf, (b)=>b.toString(16).padStart(2, '0')).join('');
        return `${Date.now().toString(36)}-${hex}`;
    }
    throw new Error('Web Crypto API 不可用,无法生成密码学安全 ID');
}
const useChatStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persist"])((set)=>({
        messages: [],
        // 2026-07-24 升级:与 ai-service default_models.json 首位 + FALLBACK_MODELS 首位对齐
        // 原 step-3.7-flash 降为备选,step-router-v1 智能路由更适合 tool calling 决策
        currentModel: 'stepfun/step-router-v1',
        isStreaming: false,
        error: null,
        conversationId: null,
        draftInput: null,
        pendingQuestion: null,
        subAgentActivities: [],
        selectedTools: [],
        recentMessages: null,
        // 2026-07-31:'auto' 模型后端不支持(MODEL_NOT_CONFIGURED),降级到 stepfun/step-router-v1
        // (智能路由模型,符合"自动"语义)。用户选"自动"时 UI 仍显示 AUTO_OPTION,底层存 step-router-v1。
        setModel: (model)=>set({
                currentModel: model === 'auto' ? 'stepfun/step-router-v1' : model
            }),
        addSelectedTool: (pluginId)=>set((s)=>s.selectedTools.includes(pluginId) ? s : {
                    selectedTools: [
                        ...s.selectedTools,
                        pluginId
                    ]
                }),
        removeSelectedTool: (pluginId)=>set((s)=>({
                    selectedTools: s.selectedTools.filter((id)=>id !== pluginId)
                })),
        clearSelectedTools: ()=>set({
                selectedTools: []
            }),
        addMessage: (msg)=>{
            const id = genId();
            const message = {
                id,
                role: msg.role,
                content: msg.content,
                createdAt: Date.now(),
                model: msg.model,
                // 透传权限模式(2026-07-25 深化,深度对标 Codex 透明性):
                // 用户消息不传(无模式),AI 消息由调用方传入当前工作区模式
                permissionMode: msg.permissionMode
            };
            set((s)=>{
                const messages = s.messages.concat(message);
                // P1-1 修复:超过上限时丢弃最旧消息(滑动窗口),防止长会话内存爆炸
                if (messages.length > MAX_MESSAGES) {
                    messages.splice(0, messages.length - MAX_MESSAGES);
                }
                return {
                    messages
                };
            });
            return id;
        },
        // P0 流式性能优化(2026-07-23):用 findIndex 替代 map,
        // 只更新目标消息引用,其他消息引用不变 → 配合 React.memo 避免全量重渲染
        appendToMessage: (id, delta)=>set((s)=>{
                const idx = s.messages.findIndex((m)=>m.id === id);
                if (idx === -1) return s;
                const target = s.messages[idx];
                if (!target) return s;
                const next = s.messages.slice();
                next[idx] = {
                    ...target,
                    content: target.content + delta
                };
                return {
                    messages: next
                };
            }),
        appendReasoningToMessage: (id, delta)=>set((s)=>{
                const idx = s.messages.findIndex((m)=>m.id === id);
                if (idx === -1) return s;
                const target = s.messages[idx];
                if (!target) return s;
                const next = s.messages.slice();
                next[idx] = {
                    ...target,
                    reasoning: (target.reasoning || '') + delta
                };
                return {
                    messages: next
                };
            }),
        setMessageError: (id, error)=>set((s)=>{
                const idx = s.messages.findIndex((m)=>m.id === id);
                if (idx === -1) return {
                    error
                };
                const target = s.messages[idx];
                if (!target) return {
                    error
                };
                const next = s.messages.slice();
                next[idx] = {
                    ...target,
                    error: true,
                    content: target.content || error
                };
                return {
                    messages: next,
                    error
                };
            }),
        clearMessages: ()=>set({
                messages: [],
                error: null
            }),
        setStreaming: (v)=>set({
                isStreaming: v
            }),
        setError: (e)=>set({
                error: e
            }),
        setConversationId: (id)=>set({
                conversationId: id
            }),
        clearDraftInput: ()=>set({
                draftInput: null
            }),
        setPendingQuestion: (q)=>set({
                pendingQuestion: q
            }),
        clearPendingQuestion: ()=>set({
                pendingQuestion: null
            }),
        appendToAgentStream: (agentId, delta, name)=>set((s)=>{
                const existing = s.subAgentActivities.find((a)=>a.agentId === agentId);
                if (existing) {
                    return {
                        subAgentActivities: s.subAgentActivities.map((a)=>a.agentId === agentId ? {
                                ...a,
                                streamingContent: (a.streamingContent || '') + delta,
                                streamingDone: false
                            } : a)
                    };
                }
                const newActivity = {
                    agentId,
                    name: name || `Agent ${agentId.slice(0, 8)}`,
                    type: 'worker',
                    status: 'running',
                    currentStep: 'Generating…',
                    completedSteps: [],
                    streamingContent: delta,
                    streamingDone: false
                };
                return {
                    subAgentActivities: [
                        ...s.subAgentActivities,
                        newActivity
                    ]
                };
            }),
        markAllAgentStreamsDone: ()=>set((s)=>({
                    subAgentActivities: s.subAgentActivities.map((a)=>({
                            ...a,
                            streamingDone: true,
                            status: a.status === 'running' || a.status === 'thinking' ? 'completed' : a.status,
                            currentStep: a.status === 'running' || a.status === 'thinking' ? '' : a.currentStep
                        }))
                })),
        resetSubAgentActivities: ()=>set({
                subAgentActivities: []
            }),
        // Subagent 自动派发(2026-07-28 立,对标 Trae Work):
        // - addSubagentSpawn: 后端 subagent_spawn SSE 事件触发,追加新 SubAgentActivity(status='running')
        // - markSubagentEnd: 后端 subagent_end SSE 事件触发,更新现有条目状态为 completed/failed
        // 与 appendToAgentStream 的区别:appendToAgentStream 用于多 agent 多路复用的 token 流分流,
        // 而 addSubagentSpawn/markSubagentEnd 用于 dispatch_subagent 工具调用的生命周期展示。
        // 两者写入同一 subAgentActivities 数组,UI 统一通过 SubAgentActivityFeed 渲染。
        addSubagentSpawn: (event)=>set((s)=>{
                // 同一 id 已存在则跳过(防止后端重复发 spawn 事件)
                if (s.subAgentActivities.some((a)=>a.agentId === event.id)) return s;
                const newActivity = {
                    agentId: event.id,
                    name: event.role || `Subagent ${event.id.slice(-6)}`,
                    type: 'worker',
                    status: 'running',
                    currentStep: event.task || '执行中…',
                    completedSteps: []
                };
                return {
                    subAgentActivities: [
                        ...s.subAgentActivities,
                        newActivity
                    ]
                };
            }),
        markSubagentEnd: (event)=>set((s)=>({
                    subAgentActivities: s.subAgentActivities.map((a)=>{
                        if (a.agentId !== event.id) return a;
                        const nextStatus = event.status === 'failed' ? 'failed' : 'completed';
                        return {
                            ...a,
                            status: nextStatus,
                            // 完成时把 currentStep 推入 completedSteps,再清空 currentStep;
                            // 失败时 currentStep 改为错误摘要,保留 step 上下文供用户排查
                            ...event.status === 'failed' ? {
                                currentStep: event.failureReason ? `失败:${event.failureReason.slice(0, 200)}` : '执行失败'
                            } : {
                                completedSteps: [
                                    ...a.completedSteps,
                                    ...a.currentStep ? [
                                        {
                                            stepAction: a.currentStep,
                                            createdAt: event.timestamp,
                                            status: 'completed'
                                        }
                                    ] : []
                                ],
                                currentStep: ''
                            },
                            streamingDone: true
                        };
                    })
                })),
        updateSubagentProgress: (event)=>set((s)=>({
                    subAgentActivities: s.subAgentActivities.map((a)=>{
                        if (a.agentId !== event.id) return a;
                        // 根据 phase 构造人类可读的 currentStep 文本
                        let stepText = a.currentStep;
                        const iter = event.iteration ? ` (轮次 ${event.iteration})` : '';
                        switch(event.phase){
                            case 'thinking':
                                stepText = `思考中…${iter}`;
                                break;
                            case 'tool_call':
                                stepText = `调用工具: ${event.tool ?? 'unknown'}${iter}`;
                                break;
                            case 'tool_result':
                                stepText = `${event.tool ?? 'unknown'} ${event.ok ? '✓' : '✗'}${iter}`;
                                break;
                            case 'output_ready':
                                stepText = '输出就绪';
                                break;
                        }
                        // tool_result 时把 tool_call 的 stepText 推入 completedSteps
                        const completedSteps = event.phase === 'tool_result' ? [
                            ...a.completedSteps,
                            {
                                stepAction: `${event.tool ?? 'unknown'} ${event.ok ? '✓' : '✗'}`,
                                createdAt: event.timestamp,
                                status: event.ok ? 'completed' : 'failed'
                            }
                        ] : a.completedSteps;
                        const toolCallsCount = event.phase === 'tool_result' ? (a.toolCallsCount ?? 0) + 1 : a.toolCallsCount ?? 0;
                        return {
                            ...a,
                            currentStep: stepText,
                            progressPhase: event.phase,
                            progressIteration: event.iteration ?? a.progressIteration,
                            progressTool: event.tool ?? a.progressTool,
                            toolCallsCount,
                            completedSteps,
                            outputPreview: event.outputPreview ?? a.outputPreview
                        };
                    })
                })),
        addToolCall: (messageId, toolCall)=>set((s)=>{
                // P1-1 修复:用 findIndex + 局部替换替代 map 全量遍历,
                // 只更新目标消息引用,其他消息引用不变 → 配合 React.memo 避免全量重渲染
                const idx = s.messages.findIndex((m)=>m.id === messageId);
                if (idx === -1) return s;
                const target = s.messages[idx];
                if (!target) return s;
                const fullCall = {
                    ...toolCall,
                    status: toolCall.status ?? 'running'
                };
                // 已存在同 id 的 toolCall 不重复添加(与原 map 实现语义一致)
                const exists = target.toolCalls?.some((tc)=>tc.id === fullCall.id);
                if (exists) return s;
                const next = s.messages.slice();
                next[idx] = {
                    ...target,
                    toolCalls: [
                        ...target.toolCalls ?? [],
                        fullCall
                    ]
                };
                return {
                    messages: next
                };
            }),
        updateToolCall: (messageId, toolCallId, updates)=>set((s)=>{
                // P1-1 修复:用 findIndex + 局部替换替代 map 全量遍历
                const idx = s.messages.findIndex((m)=>m.id === messageId);
                if (idx === -1) return s;
                const target = s.messages[idx];
                if (!target || !target.toolCalls) return s;
                const tcIdx = target.toolCalls.findIndex((tc)=>tc.id === toolCallId);
                if (tcIdx === -1) return s;
                const oldTc = target.toolCalls[tcIdx];
                if (!oldTc) return s // 类型收窄:确保 oldTc 是 ToolCall(noUncheckedIndexedAccess)
                ;
                const next = s.messages.slice();
                const newToolCalls = target.toolCalls.slice();
                newToolCalls[tcIdx] = {
                    ...oldTc,
                    ...updates
                };
                next[idx] = {
                    ...target,
                    toolCalls: newToolCalls
                };
                return {
                    messages: next
                };
            }),
        setToolCallApplyStatus: (messageId, toolCallId, status, errorMessage)=>set((s)=>{
                // P1-1 修复:用 findIndex + 局部替换替代 map 全量遍历
                const idx = s.messages.findIndex((m)=>m.id === messageId);
                if (idx === -1) return s;
                const target = s.messages[idx];
                if (!target || !target.toolCalls) return s;
                const tcIdx = target.toolCalls.findIndex((tc)=>tc.id === toolCallId);
                if (tcIdx === -1) return s;
                const oldTc = target.toolCalls[tcIdx];
                if (!oldTc) return s // 类型收窄:确保 oldTc 是 ToolCall(noUncheckedIndexedAccess)
                ;
                const next = s.messages.slice();
                const newToolCalls = target.toolCalls.slice();
                newToolCalls[tcIdx] = {
                    ...oldTc,
                    applyStatus: status,
                    applyError: status === 'error' ? errorMessage : undefined
                };
                next[idx] = {
                    ...target,
                    toolCalls: newToolCalls
                };
                return {
                    messages: next
                };
            })
    }), {
    name: 'ihui-chat',
    storage: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ssrStorage"],
    partialize: (s)=>({
            currentModel: s.currentModel,
            conversationId: s.conversationId,
            draftInput: s.draftInput,
            // 2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已从持久化中删除
            // ChatMode 由 useModeStore 独立管理,持久化不重复存储
            // #12 store messages 持久化(2026-07-25 立):
            // 仅持久化当前 conversationId 对应的 messages 最近 50 条,
            // 用于刷新页面后预填充(避免空状态闪烁),真实数据以服务端 getMessages 为准。
            recentMessages: s.conversationId ? {
                conversationId: s.conversationId,
                messages: s.messages.slice(-50)
            } : null
        }),
    // 2026-07-27 修复 React Hydration 失败导致 AI 回复未渲染:
    // 原先 onRehydrateStorage 在 persist 初始化时同步把 recentMessages.messages 赋给 state.messages,
    // 因 localStorage 是同步 API,此赋值发生在 React hydration 之前,导致:
    //   SSR 渲染 messages=[] (noopStorage 返回 null)
    //   客户端 hydration 时 messages=recentMessages.messages (50 条)
    // React 18 检测到 hydration mismatch → 丢弃服务端 DOM 重建 → 重建过程中 store 状态错乱,
    // onDelta 更新旧引用,最终 AI 回复不渲染。
    // 修复:移除 onRehydrateStorage 对 messages 的同步赋值,改为在 ai-side-panel.tsx 的
    // useEffect(hydration 后执行)中从 recentMessages 预填充,保证 SSR 与客户端首次渲染一致。
    // recentMessages 仍被持久化(partialize 中),仅恢复时机推迟到 mount 后。
    // 2026-07-24 立:旧版本无 version,localStorage 中 currentModel='stepfun/step-3.7-flash'
    // 是历史默认值(非显式选择)。version=2 migrate 把旧默认值升级到 step-router-v1。
    // 用户若显式选了其他模型(gpt-4o / claude 等),migrate 不动,保留原值。
    // 2026-07-31 立:version=3 migrate 把 'auto' 迁移到 stepfun/step-3.7-flash。
    // 原因:后端不支持 'auto' 模型,返回 MODEL_NOT_CONFIGURED 错误,导致 AI 对话无回复。
    // 'auto' 来源:早期 UI 允许选择 'auto' 或用户手动选择后被持久化。
    version: 3,
    migrate: (persisted, version)=>{
        if (persisted && typeof persisted === 'object') {
            const s = persisted;
            if (version < 2 && s.currentModel === 'stepfun/step-3.7-flash') {
                s.currentModel = 'stepfun/step-router-v1';
            }
            // version < 3:'auto' 模型后端不支持,迁移到已验证连通的 stepfun/step-3.7-flash
            if (version < 3 && (s.currentModel === 'auto' || s.currentModel === '' || !s.currentModel)) {
                s.currentModel = 'stepfun/step-3.7-flash';
            }
        }
        return persisted;
    }
}));
}),
"[project]/apps/web/src/stores/mode.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useModeStore",
    ()=>useModeStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
;
;
/** SSR 安全的 localStorage 替代存储 */ const noopStorage = {
    getItem: ()=>null,
    setItem: ()=>{},
    removeItem: ()=>{}
};
const useModeStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persist"])((set)=>({
        currentMode: 'build',
        setMode: (currentMode)=>set({
                currentMode
            })
    }), {
    name: 'ihui-mode',
    storage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : noopStorage),
    // 仅持久化 currentMode(setMode 是函数,由 store 自动重建)
    partialize: (state)=>({
            currentMode: state.currentMode
        })
}));
}),
"[project]/apps/web/src/stores/work-panel.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WORK_PANEL_DEFAULT_WIDTH",
    ()=>WORK_PANEL_DEFAULT_WIDTH,
    "WORK_PANEL_MAX_WIDTH",
    ()=>WORK_PANEL_MAX_WIDTH,
    "WORK_PANEL_MIN_WIDTH",
    ()=>WORK_PANEL_MIN_WIDTH,
    "useWorkPanelStore",
    ()=>useWorkPanelStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/browser-hub.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/browser.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/persist-helpers.ts [app-ssr] (ecmascript)");
;
;
;
;
const WORK_PANEL_DEFAULT_WIDTH = 480;
const WORK_PANEL_MIN_WIDTH = 320;
const WORK_PANEL_MAX_WIDTH = 900;
/** 最大 Tab 数量(超出自动关闭最旧) */ const MAX_TABS = 5;
/** 最大最近访问记录数 */ const MAX_RECENT_URLS = 30;
/** 最大收藏数 */ const MAX_FAVORITES = 100;
/**
 * 2026-07-31 完美化:loadUrl 去重锁
 * 防止同一 URL 在短时间内被多次触发 createBrowserSession
 * (React StrictMode 双渲染 / 用户快速双击 / 电路断路器重试 都可能触发)
 * 当 _inFlightUrl === url 时,后续相同 URL 的 loadUrl 调用直接跳过
 */ let _inFlightUrl = null;
let _inFlightTs = 0;
const IN_FLIGHT_TTL_MS = 10000 // 10s 超时自动释放(防死锁)
;
/** URL 安全白名单(与 markdown-stream.tsx 一致) */ function isSafeUrl(href) {
    return /^(https?:|mailto:|\/|#)/.test(href);
}
/** 规范化 URL:无协议补 https://,搜索词转搜索引擎 */ function normalizeUrl(input) {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    if (/^[\w-]+(\.[\w-]+)+/.test(trimmed) && !/\s/.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
}
/** 创建新 Tab */ function createTab(url, title) {
    const now = Date.now();
    return {
        id: `tab-${now}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'browser',
        title: title ?? url,
        url,
        history: [
            url
        ],
        historyIndex: 0,
        state: {
            status: 'loading',
            url,
            mode: 'iframe'
        },
        closable: true,
        createdAt: now,
        updatedAt: now
    };
}
/** 更新 active tab(不可变更新) */ function patchActiveTab(tabs, activeTabId, patch) {
    if (!activeTabId) return tabs;
    return tabs.map((t)=>t.id === activeTabId ? {
            ...t,
            ...patch(t),
            updatedAt: Date.now()
        } : t);
}
/** 更新 active tab 的 state 字段 */ function patchActiveTabState(tabs, activeTabId, statePatch) {
    return patchActiveTab(tabs, activeTabId, (tab)=>({
            state: {
                ...tab.state,
                ...statePatch
            }
        }));
}
const useWorkPanelStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persist"])((set, get)=>({
        open: false,
        width: WORK_PANEL_DEFAULT_WIDTH,
        isResizing: false,
        addressInput: '',
        tabs: [],
        activeTabId: null,
        favorites: [],
        recentUrls: [],
        openPanel: (params)=>{
            if (params?.url) {
                get().navigate(params.url, params.source ?? 'user');
            } else {
                set({
                    open: true
                });
            }
        },
        closePanel: ()=>set({
                open: false
            }),
        toggle: ()=>set((s)=>({
                    open: !s.open
                })),
        navigate: (rawUrl, source = 'user')=>{
            void source; // 保留参数兼容性(P3 MVP 不区分来源行为)
            const url = normalizeUrl(rawUrl);
            if (!url || !isSafeUrl(url)) {
                // 标记当前 tab 为 blocked(若有)
                const { tabs, activeTabId } = get();
                if (activeTabId) {
                    set({
                        open: true,
                        tabs: patchActiveTabState(tabs, activeTabId, {
                            status: 'blocked',
                            mode: 'external',
                            error: 'URL 不安全'
                        })
                    });
                }
                return;
            }
            const { tabs, activeTabId, recentUrls } = get();
            // 无 active tab → 新建 tab
            if (!activeTabId || tabs.length === 0) {
                const tab = createTab(url);
                set({
                    open: true,
                    tabs: [
                        tab
                    ],
                    activeTabId: tab.id,
                    addressInput: url,
                    recentUrls: [
                        {
                            url,
                            title: url,
                            visitedAt: Date.now()
                        },
                        ...recentUrls.filter((r)=>r.url !== url)
                    ].slice(0, MAX_RECENT_URLS)
                });
                get().loadUrl(url);
                return;
            }
            // 更新 active tab:截断前进栈 + push url + state 重置
            const newTabs = patchActiveTab(tabs, activeTabId, (tab)=>{
                const newHistory = [
                    ...tab.history.slice(0, tab.historyIndex + 1),
                    url
                ];
                return {
                    url,
                    title: url,
                    history: newHistory,
                    historyIndex: newHistory.length - 1,
                    state: {
                        status: 'loading',
                        url,
                        mode: 'iframe'
                    }
                };
            });
            set({
                open: true,
                tabs: newTabs,
                addressInput: url,
                recentUrls: [
                    {
                        url,
                        title: url,
                        visitedAt: Date.now()
                    },
                    ...recentUrls.filter((r)=>r.url !== url)
                ].slice(0, MAX_RECENT_URLS)
            });
            get().loadUrl(url);
        },
        // P1-3:主动探测嵌入能力,不可嵌入 → CDP 完整 Chrome 模式(对标 Trae/Cursor)
        // 浏览器对 X-Frame-Options/CSP frame-ancestors 拦截的站点不触发 iframe onError,
        // 必须主动调后端 probeEmbed 预判。CDP 失败时降级到截图模式(保证可用性)。
        loadUrl: (url)=>{
            // 2026-07-31 完美化:去重锁
            // 同一 URL 在 IN_FLIGHT_TTL_MS 内重复调用直接跳过,防止多次 createBrowserSession
            const now = Date.now();
            if (_inFlightUrl === url && now - _inFlightTs < IN_FLIGHT_TTL_MS) {
                return;
            }
            // 超时清理(防死锁:如果上一次 loadUrl 异常未释放锁)
            if (_inFlightUrl && now - _inFlightTs >= IN_FLIGHT_TTL_MS) {
                _inFlightUrl = null;
            }
            _inFlightUrl = url;
            _inFlightTs = now;
            void (async ()=>{
                try {
                    let canEmbed = true;
                    try {
                        const probe = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["probeEmbed"])(url);
                        if (probe.success && probe.data) {
                            canEmbed = probe.data.canEmbed;
                        }
                    } catch  {
                    // 探测失败 → 默认尝试 iframe(保留 onFailed 兜底)
                    }
                    if (canEmbed) {
                        // 可嵌入 → 保持 iframe 模式,等 iframe onLoad 触发 onLoaded
                        return;
                    }
                    // 不可嵌入 → CDP 模式(可交互,对标 Trae/Cursor 内置浏览器)
                    const { tabs: preTabs, activeTabId: preId } = get();
                    if (!preId) return;
                    // 先关闭旧 CDP 会话(同 tab 重新导航时)
                    const preTab = preTabs.find((t)=>t.id === preId);
                    if (preTab?.state.sessionId) {
                        void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["closeBrowserSession"])(preTab.state.sessionId);
                    }
                    const cdpResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createBrowserSession"])({
                        url,
                        viewport_width: 1280,
                        viewport_height: 720
                    });
                    const { tabs: cdpTabs, activeTabId: cdpId } = get();
                    if (!cdpId) return;
                    if (cdpResult.success && cdpResult.data?.session_id) {
                        set({
                            tabs: patchActiveTabState(cdpTabs, cdpId, {
                                status: 'loaded',
                                mode: 'cdp',
                                sessionId: cdpResult.data.session_id,
                                title: cdpResult.data.title || url,
                                error: undefined,
                                screenshot: undefined
                            })
                        });
                        return;
                    }
                    // CDP 失败 → 降级到截图模式(保证可用性)
                    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["takeScreenshot"])({
                        url,
                        width: 1280,
                        height: 720,
                        fullPage: false,
                        waitUntil: 'load',
                        timeout: 15000
                    });
                    const { tabs, activeTabId } = get();
                    if (!activeTabId) return;
                    if (result.success && result.data?.screenshot) {
                        set({
                            tabs: patchActiveTabState(tabs, activeTabId, {
                                status: 'screenshot',
                                mode: 'screenshot',
                                screenshot: result.data.screenshot,
                                title: result.data.title,
                                error: undefined
                            })
                        });
                    } else {
                        set({
                            tabs: patchActiveTabState(tabs, activeTabId, {
                                status: 'failed',
                                mode: 'external',
                                error: result.error || 'CDP 和截图均失败,该网站禁止嵌入'
                            })
                        });
                    }
                } finally{
                    // 释放锁:无论成功/失败/异常,都清除 in-flight 状态
                    if (_inFlightUrl === url) {
                        _inFlightUrl = null;
                    }
                }
            })();
        },
        back: ()=>{
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            const tab = tabs.find((t)=>t.id === activeTabId);
            if (!tab || tab.historyIndex <= 0) return;
            // CDP 模式:后端浏览器后退(navigation 事件会更新地址栏 + title)
            if (tab.state.mode === 'cdp' && tab.state.sessionId) {
                void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["browserHubBack"])(tab.state.sessionId);
                return;
            }
            // iframe 模式:本地历史栈
            const newIndex = tab.historyIndex - 1;
            const url = tab.history[newIndex];
            set({
                tabs: patchActiveTab(tabs, activeTabId, ()=>({
                        url,
                        historyIndex: newIndex,
                        state: {
                            status: 'loading',
                            url,
                            mode: 'iframe'
                        }
                    })),
                addressInput: url
            });
            get().loadUrl(url);
        },
        forward: ()=>{
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            const tab = tabs.find((t)=>t.id === activeTabId);
            if (!tab || tab.historyIndex >= tab.history.length - 1) return;
            // CDP 模式:后端浏览器前进
            if (tab.state.mode === 'cdp' && tab.state.sessionId) {
                void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["browserHubForward"])(tab.state.sessionId);
                return;
            }
            // iframe 模式:本地历史栈
            const newIndex = tab.historyIndex + 1;
            const url = tab.history[newIndex];
            set({
                tabs: patchActiveTab(tabs, activeTabId, ()=>({
                        url,
                        historyIndex: newIndex,
                        state: {
                            status: 'loading',
                            url,
                            mode: 'iframe'
                        }
                    })),
                addressInput: url
            });
            get().loadUrl(url);
        },
        reload: ()=>{
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            const tab = tabs.find((t)=>t.id === activeTabId);
            if (!tab || !tab.url) return;
            // CDP 模式:后端浏览器刷新
            if (tab.state.mode === 'cdp' && tab.state.sessionId) {
                void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["browserHubReload"])(tab.state.sessionId);
                return;
            }
            // iframe 模式
            set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                    status: 'loading',
                    mode: 'iframe',
                    screenshot: undefined,
                    error: undefined
                })
            });
            get().loadUrl(tab.url);
        },
        stop: ()=>{
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                    status: 'idle'
                })
            });
        },
        newTab: (url)=>{
            const { tabs } = get();
            const tabUrl = url ?? '';
            const tab = createTab(tabUrl || 'about:blank');
            // 超出上限 → 关闭最旧 tab
            let newTabs = [
                ...tabs,
                tab
            ];
            if (newTabs.length > MAX_TABS) {
                newTabs = newTabs.slice(newTabs.length - MAX_TABS);
            }
            set({
                open: true,
                tabs: newTabs,
                activeTabId: tab.id,
                addressInput: tabUrl
            });
            if (tabUrl) {
                get().loadUrl(tabUrl);
            }
        },
        closeTab: (tabId)=>{
            const { tabs, activeTabId } = get();
            const idx = tabs.findIndex((t)=>t.id === tabId);
            if (idx < 0) return;
            // CDP 模式:关闭后端会话(异步,不阻塞 UI)
            const closingTab = tabs[idx];
            if (closingTab?.state.mode === 'cdp' && closingTab.state.sessionId) {
                void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["closeBrowserSession"])(closingTab.state.sessionId);
            }
            const newTabs = tabs.filter((t)=>t.id !== tabId);
            // 关的是 active tab → 切换到相邻
            let newActiveId = activeTabId;
            let newAddressInput = '';
            if (activeTabId === tabId) {
                if (newTabs.length === 0) {
                    newActiveId = null;
                    newAddressInput = '';
                } else {
                    // 优先切到右侧,无则左侧
                    const newIdx = Math.min(idx, newTabs.length - 1);
                    newActiveId = newTabs[newIdx].id;
                    newAddressInput = newTabs[newIdx].url ?? '';
                }
            }
            set({
                tabs: newTabs,
                activeTabId: newActiveId,
                addressInput: newAddressInput
            });
        },
        setActiveTab: (tabId)=>{
            const { tabs } = get();
            const tab = tabs.find((t)=>t.id === tabId);
            if (!tab) return;
            set({
                activeTabId: tabId,
                addressInput: tab.url ?? ''
            });
        },
        reorderTabs: (fromId, toId, position = 'after')=>{
            const { tabs } = get();
            if (fromId === toId) return;
            const fromIdx = tabs.findIndex((t)=>t.id === fromId);
            const toIdx = tabs.findIndex((t)=>t.id === toId);
            if (fromIdx < 0 || toIdx < 0) return;
            // 拖到原位置 no-op(顺序不变)
            // 'after' 命中:from 已在 to 之后(相邻)
            if (position === 'after' && fromIdx === toIdx + 1) return;
            // 'before' 命中:from 已在 to 之前(相邻)
            if (position === 'before' && fromIdx + 1 === toIdx) return;
            const next = [
                ...tabs
            ];
            const [moved] = next.splice(fromIdx, 1);
            if (!moved) return;
            // 'after':直接用原 toIdx 插入(原行为,后兼容)
            // 'before':用 newToIdx(移除后 toId 在新数组中的位置,等于 toIdx 或 toIdx-1)
            const newToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
            const insertIdx = position === 'after' ? toIdx : newToIdx;
            next.splice(insertIdx, 0, moved);
            set({
                tabs: next
            });
        },
        addFavorite: (url, title)=>{
            const { favorites } = get();
            if (favorites.some((f)=>f.url === url)) return;
            set({
                favorites: [
                    {
                        url,
                        title,
                        addedAt: Date.now()
                    },
                    ...favorites
                ].slice(0, MAX_FAVORITES)
            });
        },
        removeFavorite: (url)=>{
            set((s)=>({
                    favorites: s.favorites.filter((f)=>f.url !== url)
                }));
        },
        clearHistory: ()=>set({
                recentUrls: []
            }),
        setWidth: (w)=>set({
                width: Math.min(WORK_PANEL_MAX_WIDTH, Math.max(WORK_PANEL_MIN_WIDTH, w))
            }),
        setResizing: (v)=>set({
                isResizing: v
            }),
        setAddressInput: (v)=>set({
                addressInput: v
            }),
        onLoaded: ()=>{
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                    status: 'loaded',
                    error: undefined
                })
            });
        },
        onFailed: (error)=>{
            // iframe 失败 → CDP 模式优先(可交互),CDP 失败降级截图
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            const tab = tabs.find((t)=>t.id === activeTabId);
            if (!tab?.url) {
                set({
                    tabs: patchActiveTabState(tabs, activeTabId, {
                        status: 'failed',
                        mode: 'external',
                        error: error ?? '该网站禁止嵌入'
                    })
                });
                return;
            }
            // 保留 loading 状态(CDP/截图期间仍显示 loading)
            set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                    status: 'loading',
                    error: undefined
                })
            });
            const url = tab.url;
            void (async ()=>{
                // CDP 模式优先(可交互,对标 Trae/Cursor)
                const cdpResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createBrowserSession"])({
                    url,
                    viewport_width: 1280,
                    viewport_height: 720
                });
                const { tabs: curTabs, activeTabId: curId } = get();
                if (!curId) return;
                if (cdpResult.success && cdpResult.data?.session_id) {
                    set({
                        tabs: patchActiveTabState(curTabs, curId, {
                            status: 'loaded',
                            mode: 'cdp',
                            sessionId: cdpResult.data.session_id,
                            title: cdpResult.data.title || url,
                            error: undefined,
                            screenshot: undefined
                        })
                    });
                    return;
                }
                // CDP 失败 → 降级截图
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["takeScreenshot"])({
                    url,
                    width: 1280,
                    height: 720,
                    fullPage: false,
                    waitUntil: 'load',
                    timeout: 15000
                });
                const { tabs: failTabs, activeTabId: failId } = get();
                if (!failId) return;
                if (result.success && result.data?.screenshot) {
                    set({
                        tabs: patchActiveTabState(failTabs, failId, {
                            status: 'screenshot',
                            mode: 'screenshot',
                            screenshot: result.data.screenshot,
                            title: result.data.title,
                            error: undefined
                        })
                    });
                } else {
                    set({
                        tabs: patchActiveTabState(failTabs, failId, {
                            status: 'failed',
                            mode: 'external',
                            error: result.error || error || 'CDP 和截图均失败,该网站禁止嵌入'
                        })
                    });
                }
            })();
        },
        setScreenshot: (screenshot, title)=>{
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                    status: 'screenshot',
                    mode: 'screenshot',
                    screenshot,
                    title
                })
            });
        },
        onCdpNavigation: (url, title)=>{
            const { tabs, activeTabId } = get();
            if (!activeTabId) return;
            set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                    url,
                    title: title || url,
                    status: 'loaded'
                }),
                addressInput: url
            });
        },
        openCdpSession: (url, sessionId, title)=>{
            const { tabs, recentUrls } = get();
            const tab = createTab(url, title);
            // 覆盖默认 iframe state,直接绑定为 cdp 模式(复用外部已创建的 BrowserHub 会话)
            tab.state = {
                status: 'loaded',
                url,
                mode: 'cdp',
                sessionId,
                title: title ?? url
            };
            set({
                open: true,
                tabs: [
                    ...tabs,
                    tab
                ],
                activeTabId: tab.id,
                addressInput: url,
                recentUrls: [
                    {
                        url,
                        title: title ?? url,
                        visitedAt: Date.now()
                    },
                    ...recentUrls.filter((r)=>r.url !== url)
                ].slice(0, MAX_RECENT_URLS)
            });
        },
        reset: ()=>set({
                tabs: [],
                activeTabId: null,
                addressInput: ''
            })
    }), {
    ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$persist$2d$helpers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createPersistConfig"])('ihui-work-panel', (s)=>({
            width: s.width,
            // 持久化 tabs 但清除 screenshot(体积大,需重新加载)
            tabs: s.tabs.map((t)=>({
                    ...t,
                    state: {
                        ...t.state,
                        screenshot: undefined,
                        status: 'idle',
                        progress: undefined
                    }
                })),
            favorites: s.favorites,
            recentUrls: s.recentUrls
        }))
}));
// 开发调试暴露(非 production):供 browser 验证 / DevTools 触发 openPanel
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
}),
"[project]/apps/web/src/stores/timeline-store.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useTimelineStore",
    ()=>useTimelineStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
'use client';
;
const useTimelineStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        activeTab: 'inline',
        events: [],
        expandedEventIds: [],
        filterType: 'all',
        setActiveTab: (tab)=>set({
                activeTab: tab
            }),
        setEvents: (events)=>set({
                events
            }),
        addEvent: (event)=>set((s)=>s.events.some((e)=>e.id === event.id) ? s : {
                    events: [
                        ...s.events,
                        event
                    ]
                }),
        updateEvent: (id, updates)=>set((s)=>({
                    events: s.events.map((e)=>e.id === id ? {
                            ...e,
                            ...updates
                        } : e)
                })),
        upsertEvent: (event)=>set((s)=>{
                const exists = s.events.some((e)=>e.id === event.id);
                if (exists) {
                    return {
                        events: s.events.map((e)=>e.id === event.id ? {
                                ...e,
                                ...event
                            } : e)
                    };
                }
                return {
                    events: [
                        ...s.events,
                        event
                    ]
                };
            }),
        removeEvent: (id)=>set((s)=>({
                    events: s.events.filter((e)=>e.id !== id),
                    expandedEventIds: s.expandedEventIds.filter((eid)=>eid !== id)
                })),
        toggleExpanded: (id)=>set((s)=>({
                    expandedEventIds: s.expandedEventIds.includes(id) ? s.expandedEventIds.filter((eid)=>eid !== id) : [
                        ...s.expandedEventIds,
                        id
                    ]
                })),
        setExpanded: (id, expanded)=>set((s)=>{
                const has = s.expandedEventIds.includes(id);
                if (expanded && !has) return {
                    expandedEventIds: [
                        ...s.expandedEventIds,
                        id
                    ]
                };
                if (!expanded && has) return {
                    expandedEventIds: s.expandedEventIds.filter((eid)=>eid !== id)
                };
                return s;
            }),
        isExpanded: (id)=>get().expandedEventIds.includes(id),
        setFilterType: (type)=>set({
                filterType: type
            }),
        filteredEvents: ()=>{
            const { events, filterType } = get();
            if (filterType === 'all') return events;
            return events.filter((e)=>e.type === filterType);
        },
        reset: ()=>set({
                activeTab: 'inline',
                events: [],
                expandedEventIds: [],
                filterType: 'all'
            })
    }));
}),
"[project]/apps/web/src/stores/progress-jump-store.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useProgressJumpStore",
    ()=>useProgressJumpStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
'use client';
;
let nonceCounter = 0;
let highlightTimer = null;
const useProgressJumpStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        pendingJumpToMessage: null,
        hoveredPlanStepId: null,
        hoveredMessageId: null,
        highlightedMessageId: null,
        planStepToMessageId: {},
        messageToPlanStepIds: {},
        requestJumpToMessage: (messageId)=>{
            nonceCounter += 1;
            set({
                pendingJumpToMessage: {
                    messageId,
                    nonce: nonceCounter
                }
            });
        },
        clearPendingJump: ()=>set({
                pendingJumpToMessage: null
            }),
        setHoveredPlanStep: (id)=>set({
                hoveredPlanStepId: id
            }),
        setHoveredMessage: (id)=>set({
                hoveredMessageId: id
            }),
        flashHighlight: (messageId)=>{
            if (highlightTimer) {
                clearTimeout(highlightTimer);
                highlightTimer = null;
            }
            set({
                highlightedMessageId: messageId
            });
            highlightTimer = setTimeout(()=>{
                if (get().highlightedMessageId === messageId) {
                    set({
                        highlightedMessageId: null
                    });
                }
                highlightTimer = null;
            }, 1500);
        },
        linkPlanStepToMessage: (planStepId, messageId)=>{
            const s = get();
            if (s.planStepToMessageId[planStepId] === messageId) return;
            set({
                planStepToMessageId: {
                    ...s.planStepToMessageId,
                    [planStepId]: messageId
                },
                messageToPlanStepIds: {
                    ...s.messageToPlanStepIds,
                    [messageId]: Array.from(new Set([
                        ...s.messageToPlanStepIds[messageId] ?? [],
                        planStepId
                    ]))
                }
            });
        },
        clearAllLinks: ()=>{
            set({
                planStepToMessageId: {},
                messageToPlanStepIds: {},
                hoveredPlanStepId: null,
                hoveredMessageId: null,
                highlightedMessageId: null
            });
        }
    }));
}),
"[project]/apps/web/src/stores/context-mention.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useContextMentionStore",
    ()=>useContextMentionStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
;
const useContextMentionStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set)=>({
        mentions: [],
        activeType: 'file',
        addMention: (mention)=>set((s)=>{
                if (s.mentions.some((m)=>m.id === mention.id)) return s;
                return {
                    mentions: [
                        ...s.mentions,
                        mention
                    ]
                };
            }),
        removeMention: (id)=>set((s)=>({
                    mentions: s.mentions.filter((m)=>m.id !== id)
                })),
        clearMentions: ()=>set({
                mentions: []
            }),
        setActiveType: (type)=>set({
                activeType: type
            })
    }));
}),
"[project]/apps/web/src/stores/agent-progress-pane.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "hydrateAgentProgressPaneFromStorage",
    ()=>hydrateAgentProgressPaneFromStorage,
    "useAgentProgressPaneStore",
    ()=>useAgentProgressPaneStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-ssr] (ecmascript)");
;
;
const STORAGE_KEY = 'ihui-agent-progress-pane-v6';
function loadPersisted() {
    if ("TURBOPACK compile-time truthy", 1) return {};
    //TURBOPACK unreachable
    ;
}
let persistTimer = null;
function schedulePersistWrite(state) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
const useAgentProgressPaneStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["subscribeWithSelector"])((set)=>({
        open: false,
        threadId: null,
        pinned: true,
        progressCurrent: 0,
        progressTotal: 0,
        openPane: ()=>set({
                open: true
            }),
        closePane: ()=>set({
                open: false
            }),
        toggle: ()=>set((s)=>({
                    open: !s.open
                })),
        setThreadId: (threadId)=>set({
                threadId
            }),
        togglePin: ()=>set((s)=>({
                    pinned: !s.pinned
                })),
        setProgress: (current, total)=>set({
                progressCurrent: current,
                progressTotal: total
            }),
        reset: ()=>set({
                open: false,
                threadId: null,
                pinned: true,
                progressCurrent: 0,
                progressTotal: 0
            })
    })));
// 持久化订阅(仅持久化 open/pinned)
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
/**
 * Phase 24(2026-07-29 立,SSR 修复):客户端 mount 后调用,同步 localStorage 中的
 * 持久化值到 store。仅 patch 已存在的字段,避免用 false 覆盖 SSR 默认值。
 *
 * 使用方式(在应用根组件挂载后调用一次):
 * ```tsx
 * function App() {
 *   useEffect(() => {
 *     hydrateAgentProgressPaneFromStorage()
 *   }, [])
 *   return <Root />
 * }
 * ```
 */ let hydrationApplied = false;
function hydrateAgentProgressPaneFromStorage() {
    if (hydrationApplied) return;
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
    const persisted = undefined;
}
}),
"[project]/apps/web/src/stores/ide-workspace.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useIDEWorkspace",
    ()=>useIDEWorkspace
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/logger.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/workspace.ts [app-ssr] (ecmascript)");
;
;
;
/** 扩展名 → 语言映射 */ const EXT_LANG = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    py: 'python',
    go: 'go',
    rs: 'rust',
    sh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
    xml: 'xml',
    svg: 'xml',
    vue: 'vue',
    svelte: 'svelte'
};
/** BrowseEntry → FileNode */ function entryToFileNode(entry, parentId) {
    const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
    return {
        id: `${parentId}/${entry.name}`,
        name: entry.name,
        path: entry.path,
        type: entry.isDir ? 'folder' : 'file',
        language: entry.isDir ? undefined : EXT_LANG[ext] ?? 'text',
        size: entry.size || undefined,
        lastModified: entry.modified || undefined,
        children: entry.isDir ? [] : undefined
    };
}
/** 在树中查找节点 */ function findNode(nodes, id) {
    for (const n of nodes){
        if (n.id === id) return n;
        if (n.children) {
            const found = findNode(n.children, id);
            if (found) return found;
        }
    }
    return null;
}
/** localStorage 键 */ const LS_EXPANDED_FOLDERS = 'ide:expandedFolders';
/** 从 localStorage 恢复展开的文件夹 id 集合(仅在客户端调用) */ function loadExpandedFolders() {
    if ("TURBOPACK compile-time truthy", 1) return new Set();
    //TURBOPACK unreachable
    ;
}
/** 持久化展开的文件夹 id 集合到 localStorage */ function saveExpandedFolders(folders) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
/** 更新树中指定节点的 children */ function updateTreeChildren(nodes, folderId, children) {
    return nodes.map((n)=>{
        if (n.id === folderId) return {
            ...n,
            children
        };
        if (n.children) return {
            ...n,
            children: updateTreeChildren(n.children, folderId, children)
        };
        return n;
    });
}
const useIDEWorkspace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        activeView: 'files',
        activeTopTab: 'editor',
        workspacePath: '',
        fileTree: [],
        loadedFolders: new Set(),
        expandedFolders: new Set(),
        selectedFileId: null,
        openTabs: [],
        activeTabId: null,
        diffFiles: [],
        activeDiffFileId: null,
        diffViewMode: 'split',
        gitCommits: [],
        gitBranches: [],
        gitCurrentBranch: 'main',
        loading: false,
        error: null,
        setActiveView: (view)=>set({
                activeView: view
            }),
        setActiveTopTab: (tab)=>set({
                activeTopTab: tab
            }),
        setWorkspacePath: (path)=>set({
                workspacePath: path
            }),
        toggleFolder: (folderId)=>{
            const state = get();
            const next = new Set(state.expandedFolders);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
                // 如果文件夹子项未加载,异步加载
                if (!state.loadedFolders.has(folderId)) {
                    get().fetchFolderChildren(folderId);
                }
            }
            saveExpandedFolders(next);
            set({
                expandedFolders: next
            });
        },
        restoreExpandedFolders: ()=>{
            const saved = loadExpandedFolders();
            if (saved.size === 0) return;
            set({
                expandedFolders: saved
            });
        },
        selectFile: (fileId)=>set({
                selectedFileId: fileId
            }),
        openFile: (file)=>{
            if (file.type !== 'file') return;
            const state = get();
            const existing = state.openTabs.find((t)=>t.fileId === file.id);
            if (existing) {
                set({
                    activeTabId: existing.id,
                    selectedFileId: file.id
                });
                return;
            }
            const newTab = {
                id: `tab-${file.id}`,
                fileId: file.id,
                filename: file.name,
                path: file.path,
                language: file.language ?? 'text',
                content: '',
                isDirty: false
            };
            set({
                openTabs: [
                    ...state.openTabs,
                    newTab
                ],
                activeTabId: newTab.id,
                selectedFileId: file.id
            });
            // 异步加载文件内容
            get().fetchFileContent(file.path).then((content)=>{
                set((s)=>({
                        openTabs: s.openTabs.map((t)=>t.id === newTab.id ? {
                                ...t,
                                content
                            } : t)
                    }));
            });
        },
        closeTab: (tabId)=>{
            const state = get();
            const idx = state.openTabs.findIndex((t)=>t.id === tabId);
            if (idx === -1) return;
            const tabs = state.openTabs.filter((t)=>t.id !== tabId);
            let activeTabId = state.activeTabId;
            if (state.activeTabId === tabId) {
                activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null;
            }
            set({
                openTabs: tabs,
                activeTabId
            });
        },
        setActiveTab: (tabId)=>set({
                activeTabId: tabId
            }),
        setActiveDiffFile: (fileId)=>set({
                activeDiffFileId: fileId
            }),
        setDiffViewMode: (mode)=>set({
                diffViewMode: mode
            }),
        // ============ Fetch Actions ============
        fetchFileTree: async ()=>{
            const { workspacePath } = get();
            if (!workspacePath) return;
            set({
                loading: true,
                error: null
            });
            try {
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["browseDirectory"])(workspacePath);
                if (result.success) {
                    const tree = result.data.entries.map((e)=>entryToFileNode(e, workspacePath));
                    set({
                        fileTree: tree,
                        loading: false
                    });
                    // 自动恢复顶层展开文件夹的子项(刷新后懒加载状态重建)
                    const { expandedFolders, fetchFolderChildren } = get();
                    for (const node of tree){
                        if (node.type === 'folder' && expandedFolders.has(node.id)) {
                            void fetchFolderChildren(node.id);
                        }
                    }
                } else {
                    set({
                        loading: false,
                        error: result.error ?? '加载文件树失败'
                    });
                }
            } catch (e) {
                set({
                    loading: false,
                    error: e.message
                });
            }
        },
        fetchFolderChildren: async (folderId)=>{
            const state = get();
            if (!state.workspacePath) return;
            // 已加载则跳过(防止自动恢复时重复 fetch)
            if (state.loadedFolders.has(folderId)) return;
            const folder = findNode(state.fileTree, folderId);
            if (!folder || folder.type !== 'folder') return;
            try {
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["browseDirectory"])(folder.path);
                if (result.success) {
                    const children = result.data.entries.map((e)=>entryToFileNode(e, folder.id));
                    set({
                        fileTree: updateTreeChildren(state.fileTree, folderId, children),
                        loadedFolders: new Set(state.loadedFolders).add(folderId)
                    });
                    // 递归恢复嵌套展开文件夹的子项
                    const { expandedFolders, fetchFolderChildren } = get();
                    for (const child of children){
                        if (child.type === 'folder' && expandedFolders.has(child.id)) {
                            void fetchFolderChildren(child.id);
                        }
                    }
                }
            } catch (e) {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].error('fetchFolderChildren error:', e);
            }
        },
        fetchFileContent: async (filePath)=>{
            const { workspacePath } = get();
            if (!workspacePath) return '';
            try {
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["readFile"])({
                    path: filePath,
                    workspacePath
                });
                if (result.success) return result.data.content;
                return '';
            } catch (e) {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].error('fetchFileContent error:', e);
                return '';
            }
        },
        fetchDiffFiles: async ()=>{
            const { workspacePath } = get();
            if (!workspacePath) return;
            try {
                // 获取 git diff --name-status 变更文件列表
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["runCommand"])({
                    command: 'git diff --name-status HEAD',
                    workspacePath
                });
                if (!result.success || !result.data.stdout.trim()) {
                    set({
                        diffFiles: []
                    });
                    return;
                }
                // 解析变更列表
                const lines = result.data.stdout.trim().split('\n').filter(Boolean);
                const diffFiles = [];
                for (const line of lines){
                    const [status, filename] = line.split('\t');
                    if (!filename) continue;
                    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
                    const statusMap = {
                        A: 'added',
                        M: 'modified',
                        D: 'deleted',
                        R: 'renamed'
                    };
                    // 获取 diff 统计
                    const statResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["runCommand"])({
                        command: `git diff --numstat HEAD -- "${filename}"`,
                        workspacePath
                    });
                    let additions = 0;
                    let deletions = 0;
                    if (statResult.success && statResult.data.stdout.trim()) {
                        const parts = statResult.data.stdout.trim().split('\t');
                        additions = parseInt(parts[0] ?? '0', 10) || 0;
                        deletions = parseInt(parts[1] ?? '0', 10) || 0;
                    }
                    diffFiles.push({
                        id: `diff-${filename}`,
                        filename,
                        status: statusMap[status?.[0] ?? 'M'] ?? 'modified',
                        oldContent: '',
                        newContent: '',
                        additions,
                        deletions,
                        language: EXT_LANG[ext] ?? 'text'
                    });
                }
                set({
                    diffFiles,
                    activeDiffFileId: diffFiles[0]?.id ?? null
                });
            } catch (e) {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].error('fetchDiffFiles error:', e);
                set({
                    diffFiles: []
                });
            }
        },
        fetchGitLog: async ()=>{
            const { workspacePath } = get();
            if (!workspacePath) return;
            try {
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["runCommand"])({
                    command: 'git log -20 --pretty=format:%H%x00%an%x00%ar%x00%s',
                    workspacePath
                });
                if (!result.success || !result.data.stdout.trim()) {
                    set({
                        gitCommits: []
                    });
                    return;
                }
                const commits = result.data.stdout.trim().split('\n').filter(Boolean).map((line)=>{
                    const [id, author, time, ...msgParts] = line.split('\x00');
                    return {
                        id: id ?? '',
                        message: msgParts.join('\x00'),
                        author: author ?? '',
                        time: time ?? ''
                    };
                });
                set({
                    gitCommits: commits
                });
            } catch (e) {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].error('fetchGitLog error:', e);
                set({
                    gitCommits: []
                });
            }
        },
        fetchGitBranches: async ()=>{
            const { workspacePath } = get();
            if (!workspacePath) return;
            try {
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["runCommand"])({
                    command: 'git branch --list',
                    workspacePath
                });
                if (!result.success) return;
                const lines = result.data.stdout.trim().split('\n').filter(Boolean);
                const branches = lines.map((l)=>l.replace(/^\*?\s+/, '').trim()).filter(Boolean);
                const current = lines.find((l)=>l.startsWith('*'))?.replace(/^\*\s+/, '').trim() ?? 'main';
                set({
                    gitBranches: branches,
                    gitCurrentBranch: current
                });
            } catch (e) {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].error('fetchGitBranches error:', e);
            }
        }
    }));
}),
"[project]/apps/web/src/stores/tags-view.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useTagsViewStore",
    ()=>useTagsViewStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
;
const useTagsViewStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set, get)=>({
        tags: [],
        activePath: null,
        dirtyPaths: new Set(),
        pinnedPaths: new Set(),
        addTag: (tag)=>set((s)=>{
                if (s.tags.some((t)=>t.path === tag.path)) return {
                    activePath: tag.path
                };
                return {
                    tags: [
                        ...s.tags,
                        tag
                    ],
                    activePath: tag.path
                };
            }),
        removeTag: (path)=>set((s)=>{
                const tags = s.tags.filter((t)=>t.path !== path);
                const activePath = s.activePath === path ? tags[tags.length - 1]?.path ?? null : s.activePath;
                // 标签关闭时同步清理脏状态 + pinned 状态,防止残留导致幽灵指示点 / 幽灵 pin
                let dirtyPaths = s.dirtyPaths;
                if (s.dirtyPaths.has(path)) {
                    const next = new Set(s.dirtyPaths);
                    next.delete(path);
                    dirtyPaths = next;
                }
                let pinnedPaths = s.pinnedPaths;
                if (s.pinnedPaths.has(path)) {
                    const next = new Set(s.pinnedPaths);
                    next.delete(path);
                    pinnedPaths = next;
                }
                return {
                    tags,
                    activePath,
                    dirtyPaths,
                    pinnedPaths
                };
            }),
        closeAll: ()=>set((s)=>{
                // 保留 pinned 标签(Chrome 风格,closeAll 不关 pinned)
                const tags = s.tags.filter((t)=>s.pinnedPaths.has(t.path));
                const activePath = tags.length > 0 ? tags.some((t)=>t.path === s.activePath) ? s.activePath : tags[tags.length - 1]?.path ?? null : null;
                const survivorPaths = new Set(tags.map((t)=>t.path));
                const dirtyPaths = new Set();
                s.dirtyPaths.forEach((p)=>{
                    if (survivorPaths.has(p)) dirtyPaths.add(p);
                });
                return {
                    tags,
                    activePath,
                    dirtyPaths
                };
            }),
        reorderTags: (fromIndex, toIndex)=>set((s)=>{
                // 边界守卫:无操作 / 越界直接 return 保持原状
                if (fromIndex === toIndex) return s;
                if (fromIndex < 0 || fromIndex >= s.tags.length) return s;
                if (toIndex < 0 || toIndex >= s.tags.length) return s;
                const next = s.tags.slice();
                const [moved] = next.splice(fromIndex, 1);
                // 边界守卫:noUncheckedIndexedAccess 下 moved 为 TagItem | undefined
                // 理论上 fromIndex 已校验过,这里只是消除 TS 错误并补防御
                if (!moved) return s;
                next.splice(toIndex, 0, moved);
                return {
                    tags: next
                };
            }),
        setDirty: (path, dirty)=>set((s)=>{
                const has = s.dirtyPaths.has(path);
                if (dirty && has) return s;
                if (!dirty && !has) return s;
                const next = new Set(s.dirtyPaths);
                if (dirty) next.add(path);
                else next.delete(path);
                return {
                    dirtyPaths: next
                };
            }),
        isDirty: (path)=>get().dirtyPaths.has(path),
        togglePin: (path)=>set((s)=>{
                const nextPinned = new Set(s.pinnedPaths);
                const wasPinned = nextPinned.has(path);
                if (wasPinned) {
                    // unpin:仅移除 pinned 标记,tags 顺序保持不变(停在当前位置)
                    nextPinned.delete(path);
                    return {
                        pinnedPaths: nextPinned
                    };
                }
                // pin:加标记 + 把 tag 挪到 pinned 区末尾(所有已 pinned 之后、非 pinned 之前)
                nextPinned.add(path);
                const target = s.tags.find((t)=>t.path === path);
                if (!target) return {
                    pinnedPaths: nextPinned
                };
                const pinnedTags = s.tags.filter((t)=>t.path !== path && nextPinned.has(t.path));
                const nonPinnedTags = s.tags.filter((t)=>t.path !== path && !nextPinned.has(t.path));
                return {
                    pinnedPaths: nextPinned,
                    tags: [
                        ...pinnedTags,
                        target,
                        ...nonPinnedTags
                    ]
                };
            }),
        isPinned: (path)=>get().pinnedPaths.has(path)
    }));
}),
];

//# sourceMappingURL=apps_web_src_stores_2b363629._.js.map