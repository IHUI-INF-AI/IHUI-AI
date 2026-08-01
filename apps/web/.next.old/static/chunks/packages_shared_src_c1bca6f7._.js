(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/packages/shared/src/utils/format.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 格式化文件大小（1024 进制，保留 1 位小数，单位 B/KB/MB/GB/TB）。
 */ __turbopack_context__.s([
    "formatAmount",
    ()=>formatAmount,
    "formatDuration",
    ()=>formatDuration,
    "formatFileSize",
    ()=>formatFileSize,
    "formatMoney",
    ()=>formatMoney,
    "formatPhone",
    ()=>formatPhone,
    "formatPrice",
    ()=>formatPrice,
    "formatTokenCount",
    ()=>formatTokenCount,
    "formatTokenValue",
    ()=>formatTokenValue
]);
function formatFileSize(bytes) {
    if (bytes < 1024) return "".concat(bytes, " B");
    const k = 1024;
    const sizes = [
        'B',
        'KB',
        'MB',
        'GB',
        'TB'
    ];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return "".concat((bytes / Math.pow(k, i)).toFixed(1), " ").concat(sizes[i]);
}
function formatPrice(cents) {
    if (!cents || isNaN(cents)) return '0.00';
    return (Number(cents) / 100).toFixed(2);
}
function formatMoney(amount) {
    return Number(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function formatPhone(phone) {
    return String(phone || '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}
function formatTokenCount(tokens) {
    if (tokens >= 1_000_000) {
        const m = tokens / 1_000_000;
        return "".concat(Number.isInteger(m) ? m : m.toFixed(1), "M");
    }
    if (tokens >= 1_000) {
        const k = tokens / 1_000;
        return "".concat(Number.isInteger(k) ? k : k.toFixed(0), "K");
    }
    return String(tokens);
}
function formatAmount(n) {
    let fallback = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : '—';
    const num = typeof n === 'string' ? Number(n) : n;
    if (typeof num !== 'number' || isNaN(num)) return fallback;
    return num.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatTokenValue(value) {
    if (value === undefined || value === null || value === '') return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    if (num >= 100000000) return "".concat((num / 100000000).toFixed(2), "亿");
    if (num >= 10000) return "".concat((num / 10000).toFixed(2), "万");
    return String(Math.floor(num));
}
function formatDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = sec % 60;
    return [
        h,
        m,
        s
    ].map((n)=>String(n).padStart(2, '0')).join(':');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/notifications/ws-notification-adapter.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * WS 通知消息转换器(纯逻辑,零平台依赖)
 *
 * 各端 notification store 调用此函数把 WS 消息转为统一 entry,
 * 然后用自己的状态管理方式(zustand / React Context)添加到 store。
 */ /** WS 通知消息的松散类型(兼容 web 的 WSNotification 和 RN 的 WSNotification) */ __turbopack_context__.s([
    "transformWsNotification",
    ()=>transformWsNotification
]);
function transformWsNotification(msg) {
    var _data_message;
    if (!msg || msg.type !== 'notification' || !msg.data) return null;
    const data = msg.data;
    const str = (v)=>typeof v === 'string' ? v : undefined;
    var _str, _str1, _str2, _ref, _str3;
    return {
        id: (_str = str(data.id)) !== null && _str !== void 0 ? _str : "".concat(Date.now()),
        type: data.type,
        title: (_str1 = str(data.title)) !== null && _str1 !== void 0 ? _str1 : data.type === 'ai_response' ? 'AI 回复' : '新通知',
        content: (_ref = (_str2 = str(data.content)) !== null && _str2 !== void 0 ? _str2 : str((_data_message = data.message) === null || _data_message === void 0 ? void 0 : _data_message.content)) !== null && _ref !== void 0 ? _ref : '',
        isRead: false,
        createdAt: (_str3 = str(data.createdAt)) !== null && _str3 !== void 0 ? _str3 : new Date().toISOString()
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/notifications/use-notification-websocket.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * WebSocket 通知客户端(共享 hook,各端通用)。
 *
 * 使用共享层 @ihui/api-client 的 WebSocketClient(框架无关),
 * 此处仅做 React hook 薄包装,由各端注入自己的 token 获取函数和 baseUrl。
 *
 * 功能:
 * - 登录后自动连接 ws://host/ws/notifications?token=<access_token>
 * - 心跳:30s ping,服务端回 pong
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 组件卸载时关闭连接
 * - token 变化(登录/登出)自动重连
 *
 * 用法:在已登录的组件中调用
 * `const { connected, lastMessage } = useNotificationWebSocket(token, config)`
 */ __turbopack_context__.s([
    "useNotificationWebSocket",
    ()=>useNotificationWebSocket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$ws$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/ws-client.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useNotificationWebSocket(token, config) {
    _s();
    const [connected, setConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [lastMessage, setLastMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const clientRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useNotificationWebSocket.useEffect": ()=>{
            if (!token) return;
            const client = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$ws$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createNotificationClient"])({
                baseUrl: config.baseUrl,
                tokenProvider: config.tokenProvider
            }, {
                onOpen: {
                    "useNotificationWebSocket.useEffect.client": ()=>setConnected(true)
                }["useNotificationWebSocket.useEffect.client"],
                onClose: {
                    "useNotificationWebSocket.useEffect.client": ()=>setConnected(false)
                }["useNotificationWebSocket.useEffect.client"],
                onMessage: {
                    "useNotificationWebSocket.useEffect.client": (msg)=>setLastMessage(msg)
                }["useNotificationWebSocket.useEffect.client"]
            });
            clientRef.current = client;
            client.connect();
            return ({
                "useNotificationWebSocket.useEffect": ()=>{
                    client.disconnect();
                    clientRef.current = null;
                }
            })["useNotificationWebSocket.useEffect"];
        }
    }["useNotificationWebSocket.useEffect"], [
        token,
        config.baseUrl,
        config.tokenProvider
    ]);
    return {
        connected,
        lastMessage
    };
}
_s(useNotificationWebSocket, "Jd+lx/goa5MaLqyamNtICXI5gXI=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/stores/transport.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * @ihui/shared/stores/transport — 跨端持久化 transport 抽象
 *
 * 5 端存储后端差异:
 * - web: localStorage(同步)
 * - mobile-rn: AsyncStorage(异步)
 * - miniapp-taro: Taro.storage(同步,跨平台封装)
 * - extension: chrome.storage.local(异步,含 onChanged 跨上下文同步)
 * - desktop: Tauri Store(异步,通过 IPC 桥接)
 *
 * zustand persist 中间件的 storage 接口签名:
 *   { getItem, setItem, removeItem } — 全部可同步可异步
 *
 * 本模块提供 4 个工厂:
 * 1. createMemoryTransport:无持久化(SSR / 测试用)
 * 2. createSyncTransport:同步 storage 包装(localStorage / Taro.storage)
 * 3. createAsyncTransport:异步 storage 包装(AsyncStorage / chrome.storage / Tauri Store)
 * 4. createJsonTransport:在上述任一 transport 之上加 JSON 序列化(默认行为)
 *
 * 设计原则:
 * - 零运行时开销:transport 实例化一次,后续 set/get 直接调用底层 API
 * - 类型安全:PersistTransport 接口约束三方法签名,支持同步+异步混合
 * - SSR 安全:createMemoryTransport 在 window/Taro/AsyncStorage 不可用时自动 fallback
 */ __turbopack_context__.s([
    "createAsyncTransport",
    ()=>createAsyncTransport,
    "createJsonTransport",
    ()=>createJsonTransport,
    "createMemoryTransport",
    ()=>createMemoryTransport,
    "createSSRSafeTransport",
    ()=>createSSRSafeTransport,
    "createSyncTransport",
    ()=>createSyncTransport
]);
function createMemoryTransport() {
    const store = new Map();
    return {
        getItem: (key)=>{
            var _store_get;
            return (_store_get = store.get(key)) !== null && _store_get !== void 0 ? _store_get : null;
        },
        setItem: (key, value)=>{
            store.set(key, value);
        },
        removeItem: (key)=>{
            store.delete(key);
        }
    };
}
function createSyncTransport(adapter) {
    return {
        getItem: (key)=>adapter.getItem(key),
        setItem: (key, value)=>adapter.setItem(key, value),
        removeItem: (key)=>adapter.removeItem(key)
    };
}
function createAsyncTransport(adapter) {
    return {
        getItem: (key)=>adapter.getItem(key),
        setItem: (key, value)=>adapter.setItem(key, value),
        removeItem: (key)=>adapter.removeItem(key)
    };
}
function createJsonTransport(base) {
    return {
        getItem: async (key)=>{
            const raw = await base.getItem(key);
            if (raw === null || raw === '') return null;
            try {
                return JSON.stringify(JSON.parse(raw));
            } catch (e) {
                return null;
            }
        },
        setItem: async (key, value)=>{
            await base.setItem(key, value);
        },
        removeItem: async (key)=>{
            await base.removeItem(key);
        }
    };
}
function createSSRSafeTransport(getClientAdapter) {
    const memory = createMemoryTransport();
    let client = null;
    const ensureClient = ()=>{
        if (!client) {
            try {
                client = createSyncTransport(getClientAdapter());
            } catch (e) {
                client = memory;
            }
        }
        return client;
    };
    return {
        getItem: (key)=>{
            if (!hasWindow()) return memory.getItem(key);
            return ensureClient().getItem(key);
        },
        setItem: (key, value)=>{
            if (!hasWindow()) {
                memory.setItem(key, value);
                return;
            }
            ensureClient().setItem(key, value);
        },
        removeItem: (key)=>{
            if (!hasWindow()) {
                memory.removeItem(key);
                return;
            }
            ensureClient().removeItem(key);
        }
    };
}
/**
 * SSR/Node 环境检测:用 globalThis.window 代替 typeof window,
 * 避免 Node 服务端 typecheck 报"Cannot find name 'window'"(apps/api typecheck 复现)
 */ function hasWindow() {
    return typeof globalThis !== 'undefined' && 'window' in globalThis;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/stores/auth-store.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ /**
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
 */ __turbopack_context__.s([
    "createAuthStore",
    ()=>createAuthStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/vanilla.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
;
;
;
function createAuthStore(options) {
    var _s = __turbopack_context__.k.signature();
    const { tokenStore, userTransport, userPersistKey = 'ihui-auth-user', userPartialize, onLogin, onLogout } = options;
    // 包装 transport 为 zustand persist 需要的 StateStorage 接口(返回 raw string)
    // 注意:user persist 只存 user + isAuthenticated(security: 不存 token)
    const persistStorage = {
        getItem: async (name)=>{
            if (!userTransport) return null;
            return userTransport.getItem(name);
        },
        setItem: async (name, value)=>{
            if (!userTransport) return;
            await userTransport.setItem(name, value);
        },
        removeItem: async (name)=>{
            if (!userTransport) return;
            await userTransport.removeItem(name);
        }
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
        setAuth: async (input)=>{
            await tokenStore.setToken(input.token);
            if (input.refreshToken !== undefined) {
                await tokenStore.setRefreshToken(input.refreshToken);
            }
            var _input_refreshToken, _input_expiresIn;
            // 同步镜像
            storeApi.setState({
                token: input.token,
                refreshToken: (_input_refreshToken = input.refreshToken) !== null && _input_refreshToken !== void 0 ? _input_refreshToken : storeApi.getState().refreshToken,
                expiresIn: (_input_expiresIn = input.expiresIn) !== null && _input_expiresIn !== void 0 ? _input_expiresIn : storeApi.getState().expiresIn,
                isAuthenticated: true,
                user: input.user !== undefined ? input.user : storeApi.getState().user
            });
            if (onLogin) {
                await onLogin(input.user !== undefined ? input.user : storeApi.getState().user);
            }
        },
        setUser: (user)=>{
            storeApi.setState({
                user
            });
        },
        logout: async ()=>{
            var _tokenStore_clearAll;
            await ((_tokenStore_clearAll = tokenStore.clearAll) === null || _tokenStore_clearAll === void 0 ? void 0 : _tokenStore_clearAll.call(tokenStore));
            storeApi.setState({
                token: null,
                refreshToken: null,
                expiresIn: null,
                isAuthenticated: false,
                user: null
            });
            if (onLogout) {
                await onLogout();
            }
        },
        hydrate: ()=>{
            const token = tokenStore.getToken();
            const refreshToken = tokenStore.getRefreshToken();
            storeApi.setState({
                token,
                refreshToken,
                expiresIn: storeApi.getState().expiresIn,
                isAuthenticated: !!token
            });
        },
        setReady: (ready)=>{
            storeApi.setState({
                ready
            });
        }
    };
    // 用 createStore from 'zustand/vanilla' 替代 create from 'zustand'
    // createStore 不依赖 React,可被 Taro Vite runner 正确打包(详见文件顶部修复说明)
    const storeApi = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createStore"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])(()=>initialState, {
        name: userPersistKey,
        storage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>persistStorage),
        // 安全:仅持久化 user + isAuthenticated,token 一律不落盘
        partialize: (state)=>{
            const persisted = {
                user: state.user,
                isAuthenticated: state.isAuthenticated
            };
            if (userPartialize && state.user) {
                const partial = userPartialize(state.user);
                if (partial) {
                    persisted.user = {
                        ...state.user,
                        ...partial
                    };
                }
            }
            return persisted;
        },
        // SSR 友好:hydrate 完成后设置 ready
        onRehydrateStorage: ()=>(state)=>{
                if (state) {
                    state.ready = true;
                }
            },
        version: 1
    }));
    // 创建 bound hook:兼容原 UseBoundStore 类型签名
    // - 无参调用 useAuthStore() → 返回整个 state(useStore 的 selector 默认 identity)
    // - selector 调用 useAuthStore((s) => s.user) → 返回切片
    // - .getState()/.setState()/.subscribe() → 转发到 storeApi
    // storeApi 的方法基于闭包 state(非 this),作为引用赋值给 useBoundStore 后仍正确工作。
    const useBoundStore = Object.assign(_s(function useAuthStoreHook(selector) {
        _s();
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"])(storeApi, selector);
    }, "tRpAAnpj2/w/nb/IphdrVKKBg0Y=", false, function() {
        return [
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"]
        ];
    }), {
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe
    });
    return {
        useAuthStore: useBoundStore,
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe,
        hydrate: ()=>{
            const token = tokenStore.getToken();
            const refreshToken = tokenStore.getRefreshToken();
            storeApi.setState({
                token,
                refreshToken,
                isAuthenticated: !!token
            });
        }
    };
} //# sourceMappingURL=auth-store.js.map
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/stores/user-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * @ihui/shared/stores/user-store — 跨端共享 User zustand 工厂
 *
 * 设计原则(2026-07-25 立):
 * 1. 泛型 TProfile:各端注入自己的用户信息类型(web: UserProfile + UserStatistics / miniapp-taro: UserInfo / RN: AuthUser)
 * 2. 纯逻辑层:只管 profile 状态,fetchProfile 等 API 调用由各端在 useEffect 中自行注入
 *    原因:shared 包不应依赖 @ihui/api-client 之外的端特定 API
 * 3. 依赖注入:transport 由各端注入(localStorage / AsyncStorage / Taro.storage / chrome.storage)
 * 4. 可选持久化:不传 transport 时 profile 仅存内存
 *
 * 与 useUserStore(各端现有)的差异:
 * - 现有 useUserStore:耦合 fetchProfile 等端特定 API
 * - createUserStore:只管 profile CRUD,各端在 useEffect 中调用 fetchProfile 后 setProfile
 *
 * 各端接入示例:
 * - web: createUserStore<UserProfile>({ transport: localStorageTransport, persistKey: 'ihui-user' })
 *        useEffect(() => { fetchProfile().then(p => setProfile(p)) }, [])
 * - mobile-rn: 同上,transport 用 AsyncStorage
 *
 * 修复说明(2026-07-26 立):
 * Taro 4.2.0 Vite runner 把 `import { create } from 'zustand'` 错误归并为
 * `taro.react_production_min.create`(React 上无此函数),导致 miniapp-taro 端运行时抛
 * `TypeError: taro.react_production_min.create is not a function`。
 * 修复方案:改用 `createStore` from 'zustand/vanilla' 创建 vanilla store,
 * 再用 `useStore` from 'zustand/react' 绑定 React hook,
 * 拆分 vanilla store 与 React hook 绑定,避开 Taro Vite 的归并 bug。
 * 行为保持不变:useUserStore 仍可作 hook 调用,且支持 .getState()/.setState()/.subscribe()。
 */ __turbopack_context__.s([
    "createUserStore",
    ()=>createUserStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/vanilla.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
;
;
;
function createUserStore() {
    let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    var _s = __turbopack_context__.k.signature();
    const { transport, persistKey = 'ihui-user', partialize, version = 1 } = options;
    const persistStorage = {
        getItem: async (name)=>{
            if (!transport) return null;
            return transport.getItem(name);
        },
        setItem: async (name, value)=>{
            if (!transport) return;
            await transport.setItem(name, value);
        },
        removeItem: async (name)=>{
            if (!transport) return;
            await transport.removeItem(name);
        }
    };
    const initialState = {
        profile: null,
        loading: false,
        error: null,
        setProfile: (profile)=>{
            storeApi.setState({
                profile
            });
        },
        updateProfile: (patch)=>{
            storeApi.setState((s)=>s.profile ? {
                    profile: {
                        ...s.profile,
                        ...patch
                    }
                } : s);
        },
        setLoading: (loading)=>{
            storeApi.setState({
                loading
            });
        },
        setError: (error)=>{
            storeApi.setState({
                error
            });
        },
        reset: ()=>{
            storeApi.setState({
                profile: null,
                loading: false,
                error: null
            });
        }
    };
    const storeApi = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createStore"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])(()=>initialState, {
        name: persistKey,
        storage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>persistStorage),
        ...partialize ? {
            partialize: partialize
        } : {},
        ...version !== undefined ? {
            version
        } : {}
    }));
    // 用 Object.assign 把 React hook 与 vanilla store API 合并成 UseBoundStore 兼容对象,
    // 这样 useUserStore 既能作 hook 调用,又能访问 .getState()/.setState()/.subscribe()
    const useBoundStore = Object.assign(_s(function useUserStoreHook(selector) {
        _s();
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"])(storeApi, selector);
    }, "tRpAAnpj2/w/nb/IphdrVKKBg0Y=", false, function() {
        return [
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"]
        ];
    }), {
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe,
        getInitialState: storeApi.getInitialState
    });
    return {
        useUserStore: useBoundStore,
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe,
        reset: ()=>{
            storeApi.setState({
                profile: null,
                loading: false,
                error: null
            });
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/stores/theme-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * @ihui/shared/stores/theme-store — 跨端共享 Theme zustand 工厂
 *
 * 设计原则(2026-07-25 立):
 * 1. 统一类型:ThemeMode('light'|'dark'|'system') + AccentColor(5 色) + FontSize(3 级) + highContrast
 * 2. 跨端兼容:web(next-themes) / RN(styled-components ThemeProvider) / Taro(原生样式) / extension(CSS class) / desktop(CSS var)
 * 3. 依赖注入:transport 可选 + onChange 回调(用于同步 DOM class / 原生主题)
 * 4. SSR 安全:createSSRSafeTransport 自动 fallback
 *
 * 与 useThemeStore(各端现有)的差异:
 * - 现有 useThemeStore:耦合 DOM 操作(直接 toggle .dark class)
 * - createThemeStore:仅镜像状态,DOM 同步由 onChange 回调处理(各端策略不同)
 *
 * 各端接入示例:
 * - web: createThemeStore({ transport: ssrSafeLocalStorage, onChange: (s) => next-themes.setTheme(s.theme) })
 * - mobile-rn: createThemeStore({ transport: asyncStorageTransport, onChange: (s) => NativeTheme.set(s.theme) })
 * - miniapp-taro: createThemeStore({ transport: taroStorageTransport, onChange: (s) => Taro.setNavigationBarColor(...) })
 * - extension: createThemeStore({ transport: chromeStorageTransport, onChange: (s) => document.body.dataset.theme = s.theme })
 *
 * ============================================================================
 * 修复说明(2026-07-26 立):
 * Taro 4.2.0 Vite runner 把 `import { create } from 'zustand'` 错误归并为
 * `taro.react_production_min.create`(React 上无此函数),导致运行时抛
 * `TypeError: taro.react_production_min.create is not a function`。
 *
 * 解决方案:用 `createStore` from 'zustand/vanilla'(纯 store,无 React 绑定)
 * + `useStore` from 'zustand/react'(React hook 绑定,显式传入 storeApi)
 * 替换 `create` from 'zustand'(在 Taro Vite 下被错误归并)。
 *
 * 手动构造 UseBoundStore 兼容对象,既可作为 hook 调用,又保留
 * .getState() / .setState() / .subscribe() 接口,确保调用方 API 完全兼容。
 * ============================================================================
 */ __turbopack_context__.s([
    "createThemeStore",
    ()=>createThemeStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/vanilla.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.14_@types+react@19.2.17_immer@11.1.15_react@19.0.0_use-sync-external-store@1.6.0_react@19.0.0_/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
;
;
;
const DEFAULT_STATE = {
    theme: 'system',
    accentColor: 'green',
    fontSize: 'medium',
    highContrast: false
};
function createThemeStore() {
    let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    var _s = __turbopack_context__.k.signature();
    const { transport, persistKey = 'ihui-theme', onChange, initialTheme = DEFAULT_STATE.theme, initialAccentColor = DEFAULT_STATE.accentColor, initialFontSize = DEFAULT_STATE.fontSize, version = 1 } = options;
    const persistStorage = {
        getItem: async (name)=>{
            if (!transport) return null;
            return transport.getItem(name);
        },
        setItem: async (name, value)=>{
            if (!transport) return;
            await transport.setItem(name, value);
        },
        removeItem: async (name)=>{
            if (!transport) return;
            await transport.removeItem(name);
        }
    };
    // emit 包装:每次 state 变化后调用 onChange
    const emit = (state)=>{
        if (onChange) onChange(state);
    };
    // storeApi 在下方声明,这里通过闭包引用(运行时 storeApi 已初始化)
    const initialState = {
        theme: initialTheme,
        accentColor: initialAccentColor,
        fontSize: initialFontSize,
        highContrast: false,
        setTheme: (theme)=>{
            storeApi.setState({
                theme
            });
            emit(storeApi.getState());
        },
        setAccentColor: (accentColor)=>{
            storeApi.setState({
                accentColor
            });
            emit(storeApi.getState());
        },
        setFontSize: (fontSize)=>{
            storeApi.setState({
                fontSize
            });
            emit(storeApi.getState());
        },
        toggleHighContrast: ()=>{
            storeApi.setState((s)=>({
                    highContrast: !s.highContrast
                }));
            emit(storeApi.getState());
        },
        reset: ()=>{
            storeApi.setState({
                ...DEFAULT_STATE
            });
            emit(storeApi.getState());
        }
    };
    // 使用 createStore(zustand/vanilla)避免 Taro Vite 把 `create` 归并到
    // taro.react_production_min.create 的问题
    const storeApi = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createStore"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])(()=>initialState, {
        name: persistKey,
        storage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>persistStorage),
        version
    }));
    // 手动构造 UseBoundStore:既可作为 hook 调用,又保留 .getState/.setState/.subscribe
    const useBoundStore = Object.assign(_s(function useThemeStoreHook(selector) {
        _s();
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"])(storeApi, selector);
    }, "tRpAAnpj2/w/nb/IphdrVKKBg0Y=", false, function() {
        return [
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$14_$40$types$2b$react$40$19$2e$2$2e$17_immer$40$11$2e$1$2e$15_react$40$19$2e$0$2e$0_use$2d$sync$2d$external$2d$store$40$1$2e$6$2e$0_react$40$19$2e$0$2e$0_$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"]
        ];
    }), {
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe
    });
    return {
        useThemeStore: useBoundStore,
        getState: storeApi.getState,
        setState: storeApi.setState,
        subscribe: storeApi.subscribe,
        reset: ()=>{
            storeApi.setState({
                ...DEFAULT_STATE
            });
            emit(storeApi.getState());
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/stores/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$transport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/transport.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$auth$2d$store$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/auth-store.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/user-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$theme$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/theme-store.ts [app-client] (ecmascript)");
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/date-utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 日期/数字格式化工具(统一带时区,避免各页面散落 Date.toLocaleString())
 * AGENTS.md §4: 时间用 Intl.DateTimeFormat + 强制 Asia/Shanghai 时区
 */ __turbopack_context__.s([
    "formatCurrency",
    ()=>formatCurrency,
    "formatDate",
    ()=>formatDate,
    "formatDateByTemplate",
    ()=>formatDateByTemplate,
    "formatDateOnly",
    ()=>formatDateOnly,
    "formatNumber",
    ()=>formatNumber,
    "formatRelativeTime",
    ()=>formatRelativeTime,
    "formatShortDate",
    ()=>formatShortDate,
    "formatShortDateTime",
    ()=>formatShortDateTime,
    "formatShortDateWithYear",
    ()=>formatShortDateWithYear,
    "formatTimeOnly",
    ()=>formatTimeOnly,
    "getFormatters",
    ()=>getFormatters
]);
const DEFAULT_TZ = 'Asia/Shanghai';
function getFormatters(locale) {
    const dateFormatter = new Intl.DateTimeFormat(locale, {
        timeZone: DEFAULT_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const dateOnlyFormatter = new Intl.DateTimeFormat(locale, {
        timeZone: DEFAULT_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const timeOnlyFormatter = new Intl.DateTimeFormat(locale, {
        timeZone: DEFAULT_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const numberFormatter = new Intl.NumberFormat(locale);
    const currencyFormatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CNY'
    });
    return {
        dateFormatter,
        dateOnlyFormatter,
        timeOnlyFormatter,
        numberFormatter,
        currencyFormatter
    };
}
function formatDate(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (!input) return '-';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '-';
    return getFormatters(locale).dateFormatter.format(d);
}
function formatDateOnly(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (!input) return '-';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '-';
    return getFormatters(locale).dateOnlyFormatter.format(d);
}
function formatTimeOnly(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (!input) return '-';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '-';
    return getFormatters(locale).timeOnlyFormatter.format(d);
}
function formatShortDateTime(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale, {
        timeZone: DEFAULT_TZ,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(d);
}
function formatShortDate(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale, {
        timeZone: DEFAULT_TZ,
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}
function formatShortDateWithYear(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale, {
        timeZone: DEFAULT_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}
function formatNumber(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (input === null || input === undefined || Number.isNaN(input)) return '-';
    return getFormatters(locale).numberFormatter.format(input);
}
function formatCurrency(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (input === null || input === undefined || Number.isNaN(input)) return '-';
    return getFormatters(locale).currencyFormatter.format(input);
}
// ---------------------------------------------------------------------------
// 相对时间(用于资讯列表/直播/通知等"X 分钟前"场景)
// ---------------------------------------------------------------------------
const RTF_CACHE = new Map();
function formatRelativeTime(input) {
    let locale = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'zh-CN';
    if (!input) return '-';
    const then = input instanceof Date ? input.getTime() : new Date(input).getTime();
    if (Number.isNaN(then)) return '-';
    let rtf = RTF_CACHE.get(locale);
    if (!rtf) {
        rtf = new Intl.RelativeTimeFormat(locale, {
            numeric: 'auto'
        });
        RTF_CACHE.set(locale, rtf);
    }
    const diffSec = Math.round((then - Date.now()) / 1000);
    const absDiff = Math.abs(diffSec);
    if (absDiff < 60) return rtf.format(Math.round(diffSec), 'second');
    if (absDiff < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (absDiff < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (absDiff < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
    if (absDiff < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
    return rtf.format(Math.round(diffSec / 31536000), 'year');
}
function formatDateByTemplate(input) {
    let format = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'YYYY-MM-DD HH:mm:ss';
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: DEFAULT_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(d);
    const map = {};
    for (const p of parts)map[p.type] = p.value;
    var _map_hour;
    // Intl hour12=false 在某些环境返回 "24",需归一为 "00"
    const hour = map.hour === '24' ? '00' : (_map_hour = map.hour) !== null && _map_hour !== void 0 ? _map_hour : '00';
    var _map_year, _map_month, _map_day, _map_minute, _map_second;
    return format.replace('YYYY', (_map_year = map.year) !== null && _map_year !== void 0 ? _map_year : '0000').replace('MM', (_map_month = map.month) !== null && _map_month !== void 0 ? _map_month : '00').replace('DD', (_map_day = map.day) !== null && _map_day !== void 0 ? _map_day : '00').replace('HH', hour).replace('mm', (_map_minute = map.minute) !== null && _map_minute !== void 0 ? _map_minute : '00').replace('ss', (_map_second = map.second) !== null && _map_second !== void 0 ? _map_second : '00');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/auth/sso-core.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * SSO 共享核心(纯逻辑,零平台依赖)
 *
 * 仅依赖 fetch + URL(RN/taro/web 均有 polyfill),不 import expo/@tarojs/window。
 * 各端薄封装注入 apiBase / clientId,平台独占逻辑留在各端。
 */ __turbopack_context__.s([
    "SSO_ENDPOINTS",
    ()=>SSO_ENDPOINTS,
    "buildSsoLoginUrl",
    ()=>buildSsoLoginUrl,
    "exchangeSsoCode",
    ()=>exchangeSsoCode,
    "extractSsoCode",
    ()=>extractSsoCode,
    "ssoLogout",
    ()=>ssoLogout,
    "validateToken",
    ()=>validateToken
]);
const SSO_ENDPOINTS = {
    code: '/api/auth/sso/code',
    exchange: '/api/auth/sso/exchange',
    logout: '/api/auth/sso/logout',
    validate: '/api/auth/sso/validate'
};
async function exchangeSsoCode(apiBase, code, clientId) {
    try {
        const resp = await fetch("".concat(apiBase).concat(SSO_ENDPOINTS.exchange), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                clientId
            })
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.code !== 200 || !data.data) return null;
        return data.data;
    } catch (e) {
        return null;
    }
}
async function validateToken(apiBase, token) {
    try {
        const resp = await fetch("".concat(apiBase).concat(SSO_ENDPOINTS.validate), {
            headers: {
                Authorization: "Bearer ".concat(token)
            }
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.code !== 200 || !data.data) return null;
        return data.data;
    } catch (e) {
        return null;
    }
}
async function ssoLogout(apiBase, token) {
    try {
        const resp = await fetch("".concat(apiBase).concat(SSO_ENDPOINTS.logout), {
            method: 'POST',
            headers: {
                Authorization: "Bearer ".concat(token)
            }
        });
        return resp.ok;
    } catch (e) {
        return false;
    }
}
function extractSsoCode(url) {
    try {
        const parsed = new URL(url);
        return parsed.searchParams.get('sso_code');
    } catch (e) {
        return null;
    }
}
function buildSsoLoginUrl(webBase, redirectUri, clientId) {
    const params = new URLSearchParams({
        redirect: redirectUri,
        client_id: clientId
    });
    return "".concat(webBase, "/sso/login?").concat(params.toString());
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/auth/token-store.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([
    "bindTokenStoreToApiClient",
    ()=>bindTokenStoreToApiClient,
    "createInMemoryTokenStore",
    ()=>createInMemoryTokenStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-client] (ecmascript)");
;
function createInMemoryTokenStore(options) {
    var _options_initial, _options_initial1, _options_initial2;
    var _options_initial_token;
    let cachedToken = (_options_initial_token = options === null || options === void 0 ? void 0 : (_options_initial = options.initial) === null || _options_initial === void 0 ? void 0 : _options_initial.token) !== null && _options_initial_token !== void 0 ? _options_initial_token : null;
    var _options_initial_refreshToken;
    let cachedRefreshToken = (_options_initial_refreshToken = options === null || options === void 0 ? void 0 : (_options_initial1 = options.initial) === null || _options_initial1 === void 0 ? void 0 : _options_initial1.refreshToken) !== null && _options_initial_refreshToken !== void 0 ? _options_initial_refreshToken : null;
    var _options_initial_expiresIn;
    let cachedExpiresIn = (_options_initial_expiresIn = options === null || options === void 0 ? void 0 : (_options_initial2 = options.initial) === null || _options_initial2 === void 0 ? void 0 : _options_initial2.expiresIn) !== null && _options_initial_expiresIn !== void 0 ? _options_initial_expiresIn : null;
    return {
        getToken: ()=>cachedToken,
        getRefreshToken: ()=>cachedRefreshToken,
        getExpiresIn: ()=>cachedExpiresIn,
        setToken: async (token)=>{
            var _options_onSetToken;
            cachedToken = token;
            await (options === null || options === void 0 ? void 0 : (_options_onSetToken = options.onSetToken) === null || _options_onSetToken === void 0 ? void 0 : _options_onSetToken.call(options, token));
        },
        setRefreshToken: async (token)=>{
            var _options_onSetRefreshToken;
            cachedRefreshToken = token;
            await (options === null || options === void 0 ? void 0 : (_options_onSetRefreshToken = options.onSetRefreshToken) === null || _options_onSetRefreshToken === void 0 ? void 0 : _options_onSetRefreshToken.call(options, token));
        },
        setExpiresIn: async (expiresIn)=>{
            var _options_onSetExpiresIn;
            cachedExpiresIn = expiresIn;
            await (options === null || options === void 0 ? void 0 : (_options_onSetExpiresIn = options.onSetExpiresIn) === null || _options_onSetExpiresIn === void 0 ? void 0 : _options_onSetExpiresIn.call(options, expiresIn));
        },
        clearAll: async ()=>{
            var _options_onClearAll;
            cachedToken = null;
            cachedRefreshToken = null;
            cachedExpiresIn = null;
            await (options === null || options === void 0 ? void 0 : (_options_onClearAll = options.onClearAll) === null || _options_onClearAll === void 0 ? void 0 : _options_onClearAll.call(options));
        },
        setCachedWithoutPersist: (updates)=>{
            if (updates.token !== undefined) cachedToken = updates.token;
            if (updates.refreshToken !== undefined) cachedRefreshToken = updates.refreshToken;
            if (updates.expiresIn !== undefined) cachedExpiresIn = updates.expiresIn;
        }
    };
}
function bindTokenStoreToApiClient(store) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setTokenProvider"])({
        getToken: ()=>store.getToken()
    });
} //# sourceMappingURL=token-store.js.map
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/jwt-utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "base64UrlDecode",
    ()=>base64UrlDecode,
    "readExp",
    ()=>readExp
]);
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/**
 * 原生 atob 引用(模块加载时一次性捕获)。
 * web 端存在原生 atob;mobile-rn Hermes / 旧版环境无。
 */ const nativeAtob = typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function' ? globalThis.atob : undefined;
/**
 * 原生 TextDecoder 构造器引用。
 * web 端 / RN 0.71+ 存在;旧版 Hermes 无。
 */ const NativeTextDecoder = typeof globalThis !== 'undefined' && 'TextDecoder' in globalThis ? globalThis.TextDecoder : undefined;
/** 纯 JS atob polyfill(对称反向解码,兼容 Hermes 等无 atob 环境)。 */ function atobPolyfill(input) {
    const cleanInput = input.replace(/=+$/, '');
    let result = '';
    let i = 0;
    while(i < cleanInput.length){
        const a = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        const b = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        const c = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        const d = BASE64_CHARS.indexOf(cleanInput[i++] || '');
        if (a < 0 || b < 0) break;
        result += String.fromCharCode(a << 2 | b >> 4);
        if (c >= 0) result += String.fromCharCode((b & 15) << 4 | c >> 2);
        if (d >= 0) result += String.fromCharCode((c & 3) << 6 | d);
    }
    return result;
}
/** UTF-8 解码:优先用原生 TextDecoder,缺失时回退到纯 JS polyfill。 */ function utf8Decode(bytes) {
    if (NativeTextDecoder) return new NativeTextDecoder().decode(bytes);
    let result = '';
    let i = 0;
    while(i < bytes.length){
        const b = bytes[i++] || 0;
        if (b < 0x80) {
            result += String.fromCharCode(b);
        } else if (b < 0xe0) {
            const b2 = bytes[i++] || 0;
            result += String.fromCharCode((b & 0x1f) << 6 | b2 & 0x3f);
        } else if (b < 0xf0) {
            const b2 = bytes[i++] || 0;
            const b3 = bytes[i++] || 0;
            result += String.fromCharCode((b & 0x0f) << 12 | (b2 & 0x3f) << 6 | b3 & 0x3f);
        } else {
            const b2 = bytes[i++] || 0;
            const b3 = bytes[i++] || 0;
            const b4 = bytes[i++] || 0;
            const codepoint = (b & 0x07) << 18 | (b2 & 0x3f) << 12 | (b3 & 0x3f) << 6 | b4 & 0x3f;
            const adjusted = codepoint - 0x10000;
            result += String.fromCharCode(0xd800 | adjusted >> 10, 0xdc00 | adjusted & 0x3ff);
        }
    }
    return result;
}
function base64UrlDecode(input) {
    const s = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = s + '='.repeat((4 - s.length % 4) % 4);
    const binary = nativeAtob ? nativeAtob(padded) : atobPolyfill(padded);
    const bytes = Uint8Array.from(binary, (c)=>c.charCodeAt(0));
    return utf8Decode(bytes);
}
function readExp(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadPart = parts[1];
    if (!payloadPart) return null;
    try {
        const decoded = JSON.parse(base64UrlDecode(payloadPart));
        return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch (e) {
        return null;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/theme.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Theme/gender cross-end shared constants.
 *
 * 被 packages/shared/src/constants.ts、storage-keys.ts 等多处引用,
 * 必须存在否则阻塞全仓 typecheck。
 */ __turbopack_context__.s([
    "GENDERS",
    ()=>GENDERS,
    "GENDER_KEYS",
    ()=>GENDER_KEYS,
    "LOCALE_STORAGE_KEY",
    ()=>LOCALE_STORAGE_KEY,
    "THEME_STORAGE_KEY",
    ()=>THEME_STORAGE_KEY
]);
const GENDERS = [
    {
        value: 1,
        key: 'male'
    },
    {
        value: 2,
        key: 'female'
    },
    {
        value: 0,
        key: 'secret'
    }
];
const GENDER_KEYS = {
    male: 'profileEdit.gender_male',
    female: 'profileEdit.gender_female',
    secret: 'profileEdit.gender_secret'
};
const THEME_STORAGE_KEY = 'ihui-theme';
const LOCALE_STORAGE_KEY = 'ihui-locale';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/storage-keys.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享 storage key 常量
 * 命名规范:
 * - TOKEN/REFRESH_TOKEN 用下划线前缀(历史遗留,向后兼容,已在各端使用)
 * - 其他 key 用连字符前缀(新规范,与 theme.ts 一致)
 * 各端禁止本地硬编码 storage key 字符串,必须 import 本文件常量
 */ // 历史遗留:下划线前缀(已在各端使用,保持向后兼容)
// 直接定义,避免通过 '../constants' 形成循环依赖:
// constants.ts -> constants/index.ts -> constants/storage-keys.ts -> constants.ts
__turbopack_context__.s([
    "API_BASE_URL_STORAGE_KEY",
    ()=>API_BASE_URL_STORAGE_KEY,
    "COZE_CONFIG_STORAGE_KEY",
    ()=>COZE_CONFIG_STORAGE_KEY,
    "EXPIRES_IN_STORAGE_KEY",
    ()=>EXPIRES_IN_STORAGE_KEY,
    "INVITE_CODE_STORAGE_KEY",
    ()=>INVITE_CODE_STORAGE_KEY,
    "PENDING_ROUTE_STORAGE_KEY",
    ()=>PENDING_ROUTE_STORAGE_KEY,
    "REFRESH_ALARM_NAME",
    ()=>REFRESH_ALARM_NAME,
    "REFRESH_TOKEN_STORAGE_KEY",
    ()=>REFRESH_TOKEN_STORAGE_KEY,
    "SSO_CODE_STORAGE_KEY",
    ()=>SSO_CODE_STORAGE_KEY,
    "SSO_USER_STORAGE_KEY",
    ()=>SSO_USER_STORAGE_KEY,
    "TOKEN_STORAGE_KEY",
    ()=>TOKEN_STORAGE_KEY,
    "USER_INFO_STORAGE_KEY",
    ()=>USER_INFO_STORAGE_KEY,
    "VIP_STORAGE_KEY",
    ()=>VIP_STORAGE_KEY
]);
// theme.ts 已定义,这里 re-export 避免重复
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/theme.ts [app-client] (ecmascript)");
const TOKEN_STORAGE_KEY = 'ihui_token';
const REFRESH_TOKEN_STORAGE_KEY = 'ihui_refresh_token';
;
const USER_INFO_STORAGE_KEY = 'ihui-user-info';
const VIP_STORAGE_KEY = 'ihui-vip-info';
const INVITE_CODE_STORAGE_KEY = 'ihui-invite-code';
const SSO_CODE_STORAGE_KEY = 'ihui-sso-code';
const SSO_USER_STORAGE_KEY = 'ihui-sso-user';
const COZE_CONFIG_STORAGE_KEY = 'coze-config-v1';
const EXPIRES_IN_STORAGE_KEY = 'ihui_token_expires_in';
const REFRESH_ALARM_NAME = 'ihui-refresh-token';
const API_BASE_URL_STORAGE_KEY = 'ihui_api_base_url';
const PENDING_ROUTE_STORAGE_KEY = 'ihui_pending_route';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/error-codes.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 错误码定义 — 等价自旧架构 client/src/config/error-codes.ts
 * 业务错误码枚举、判定函数与错误消息映射
 */ __turbopack_context__.s([
    "ERROR_CODES",
    ()=>ERROR_CODES,
    "getErrorMessage",
    ()=>getErrorMessage,
    "isAccountDeleted",
    ()=>isAccountDeleted,
    "isAccountDisabled",
    ()=>isAccountDisabled,
    "isAccountLocked",
    ()=>isAccountLocked,
    "isBadRequest",
    ()=>isBadRequest,
    "isCaptchaExpired",
    ()=>isCaptchaExpired,
    "isCaptchaWrong",
    ()=>isCaptchaWrong,
    "isForbidden",
    ()=>isForbidden,
    "isInternalServerError",
    ()=>isInternalServerError,
    "isNotFound",
    ()=>isNotFound,
    "isPasswordExpired",
    ()=>isPasswordExpired,
    "isPasswordWrong",
    ()=>isPasswordWrong,
    "isPhoneNotVerified",
    ()=>isPhoneNotVerified,
    "isServiceUnavailable",
    ()=>isServiceUnavailable,
    "isSuccess",
    ()=>isSuccess,
    "isTokenExpired",
    ()=>isTokenExpired,
    "isTooManyRequests",
    ()=>isTooManyRequests
]);
const ERROR_CODES = {
    TOKEN_EXPIRED: [
        40101,
        499,
        401
    ],
    // 2026-06-28 联调: 后端统一响应码 SUCCESS="0" (server/app/schemas/error_codes.py),
    // 同时保留 200/201 兼容旧 Java 后端返回的 HTTP 状态码作为业务码的场景.
    SUCCESS: [
        200,
        201,
        0
    ],
    BAD_REQUEST: [
        400
    ],
    FORBIDDEN: [
        403
    ],
    NOT_FOUND: [
        404
    ],
    INTERNAL_SERVER_ERROR: [
        500
    ],
    SERVICE_UNAVAILABLE: [
        503
    ],
    ACCOUNT_LOCKED: [
        40301,
        40302
    ],
    ACCOUNT_DISABLED: [
        40303,
        40304
    ],
    ACCOUNT_DELETED: [
        40305
    ],
    PASSWORD_EXPIRED: [
        40310
    ],
    PASSWORD_WRONG: [
        40102,
        40103
    ],
    CAPTCHA_EXPIRED: [
        40001
    ],
    CAPTCHA_WRONG: [
        40002
    ],
    PHONE_NOT_VERIFIED: [
        40320
    ],
    TOO_MANY_REQUESTS: [
        429
    ]
};
function isTokenExpired(code) {
    if (typeof code === 'number') {
        return ERROR_CODES.TOKEN_EXPIRED.includes(code);
    }
    const str = String(code).trim();
    if (/^\d+$/.test(str)) {
        const numCode = parseInt(str, 10);
        return ERROR_CODES.TOKEN_EXPIRED.includes(numCode);
    }
    if (str === 'A40101' || str.endsWith('40101')) return true;
    return false;
}
function isSuccess(code) {
    const numCode = typeof code === 'string' ? parseInt(code, 10) : code;
    return ERROR_CODES.SUCCESS.includes(numCode);
}
function isBadRequest(code) {
    return ERROR_CODES.BAD_REQUEST.includes(code);
}
function isForbidden(code) {
    return ERROR_CODES.FORBIDDEN.includes(code);
}
function isNotFound(code) {
    return ERROR_CODES.NOT_FOUND.includes(code);
}
function isInternalServerError(code) {
    return ERROR_CODES.INTERNAL_SERVER_ERROR.includes(code);
}
function isServiceUnavailable(code) {
    return ERROR_CODES.SERVICE_UNAVAILABLE.includes(code);
}
function isAccountLocked(code) {
    return ERROR_CODES.ACCOUNT_LOCKED.includes(code);
}
function isAccountDisabled(code) {
    return ERROR_CODES.ACCOUNT_DISABLED.includes(code);
}
function isAccountDeleted(code) {
    return ERROR_CODES.ACCOUNT_DELETED.includes(code);
}
function isPasswordExpired(code) {
    return ERROR_CODES.PASSWORD_EXPIRED.includes(code);
}
function isPasswordWrong(code) {
    return ERROR_CODES.PASSWORD_WRONG.includes(code);
}
function isCaptchaExpired(code) {
    return ERROR_CODES.CAPTCHA_EXPIRED.includes(code);
}
function isCaptchaWrong(code) {
    return ERROR_CODES.CAPTCHA_WRONG.includes(code);
}
function isPhoneNotVerified(code) {
    return ERROR_CODES.PHONE_NOT_VERIFIED.includes(code);
}
function isTooManyRequests(code) {
    return ERROR_CODES.TOO_MANY_REQUESTS.includes(code);
}
function getErrorMessage(code) {
    if (isAccountLocked(code)) return 'errors.accountLocked';
    if (isAccountDisabled(code)) return 'errors.accountDisabled';
    if (isAccountDeleted(code)) return 'errors.accountDeleted';
    if (isPasswordExpired(code)) return 'errors.passwordExpired';
    if (isPasswordWrong(code)) return 'errors.passwordWrong';
    if (isCaptchaExpired(code)) return 'errors.captchaExpired';
    if (isCaptchaWrong(code)) return 'errors.captchaWrong';
    if (isPhoneNotVerified(code)) return 'errors.phoneNotVerified';
    if (isTooManyRequests(code)) return 'errors.tooManyRequests';
    if (isTokenExpired(code)) return 'errors.tokenExpired';
    if (isForbidden(code)) return 'errors.forbidden';
    if (isNotFound(code)) return 'errors.notFound';
    if (isInternalServerError(code)) return 'errors.serverError';
    if (isServiceUnavailable(code)) return 'errors.serviceUnavailable';
    return 'errors.unknown';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/coze.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Coze 跨端共享配置常量
 * 各端 Coze 客户端禁止本地硬编码,必须 import 本文件常量
 */ __turbopack_context__.s([
    "COZE_DEFAULT_BASE_URL",
    ()=>COZE_DEFAULT_BASE_URL,
    "COZE_DEFAULT_TIMEOUT",
    ()=>COZE_DEFAULT_TIMEOUT,
    "COZE_STORAGE_KEY",
    ()=>COZE_STORAGE_KEY
]);
const COZE_DEFAULT_BASE_URL = 'https://api.coze.cn';
const COZE_DEFAULT_TIMEOUT = 30000;
const COZE_STORAGE_KEY = 'coze-config-v1';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/payment-codes.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 支付结果码跨端共享常量
 * 消除 mobile-rn 和 miniapp-taro 两端支付宝 resultCode 硬编码重复
 */ // 支付宝小程序 resultCode(支付宝官方文档)
__turbopack_context__.s([
    "ALIPAY_RESULT_CODE",
    ()=>ALIPAY_RESULT_CODE,
    "WECHAT_PAY_ERROR_CODE",
    ()=>WECHAT_PAY_ERROR_CODE,
    "isAlipayCancel",
    ()=>isAlipayCancel,
    "isAlipayPending",
    ()=>isAlipayPending,
    "isAlipaySuccess",
    ()=>isAlipaySuccess,
    "isWechatPayCancel",
    ()=>isWechatPayCancel,
    "isWechatPaySuccess",
    ()=>isWechatPaySuccess
]);
const ALIPAY_RESULT_CODE = {
    SUCCESS: '9000',
    PENDING: '8000',
    FAILED: '4000',
    CANCEL: '6001',
    NETWORK_ERROR: '6002'
};
function isAlipaySuccess(code) {
    return code === ALIPAY_RESULT_CODE.SUCCESS;
}
function isAlipayCancel(code) {
    return code === ALIPAY_RESULT_CODE.CANCEL;
}
function isAlipayPending(code) {
    return code === ALIPAY_RESULT_CODE.PENDING;
}
const WECHAT_PAY_ERROR_CODE = {
    SUCCESS: 0,
    CANCEL: -2,
    NETWORK_ERROR: -1,
    INSUFFICIENT_FUNDS: -100
};
function isWechatPaySuccess(code) {
    return code === WECHAT_PAY_ERROR_CODE.SUCCESS;
}
function isWechatPayCancel(code) {
    return code === WECHAT_PAY_ERROR_CODE.CANCEL;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/external-urls.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享外部 URL 常量
 * 消除 mobile-rn 和 miniapp-taro 两端 CDN / 头像 fallback URL 硬编码重复
 */ __turbopack_context__.s([
    "DEFAULT_AVATAR_URL",
    ()=>DEFAULT_AVATAR_URL,
    "DEFAULT_SHARE_IMAGE_URL",
    ()=>DEFAULT_SHARE_IMAGE_URL
]);
const DEFAULT_AVATAR_URL = 'https://file.aizhs.top/sys-mini/daixaodiming.png';
const DEFAULT_SHARE_IMAGE_URL = '/static/share.png'// 跨端 web 端基础 URL(已存在的 WEB_BASE 也 re-export 到这里统一管理)
// 注意:如果 packages/shared/src/constants.ts 已定义 WEB_BASE,这里不重复定义,只 re-export
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/sso-client-ids.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端 SSO client_id 注册表
 * 集中管理各端 SSO client_id,便于后端注册表统一
 */ __turbopack_context__.s([
    "SSO_CLIENT_IDS",
    ()=>SSO_CLIENT_IDS
]);
const SSO_CLIENT_IDS = {
    WEB: 'web',
    EXTENSION: 'extension',
    MINIAPP_TARO: 'miniapp-taro',
    MOBILE_RN: 'mobile-rn',
    DESKTOP: 'desktop',
    CLI: 'cli'
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/page-size.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享分页常量
 * 消除 mobile-rn 和 miniapp-taro 两端 PAGE_SIZE 重复定义
 */ __turbopack_context__.s([
    "COURSE_PAGE_SIZE",
    ()=>COURSE_PAGE_SIZE,
    "DEFAULT_PAGE_SIZE",
    ()=>DEFAULT_PAGE_SIZE
]);
const DEFAULT_PAGE_SIZE = 20;
const COURSE_PAGE_SIZE = 12;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/share.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端分享 URL 参数约定
 * 消除 miniapp-taro 本地 shareConfig 硬编码
 */ __turbopack_context__.s([
    "SHARE_PARAM",
    ()=>SHARE_PARAM
]);
const SHARE_PARAM = {
    SOURCE_PARAM: 'source',
    SOURCE_VALUE: 'share',
    INVITE_CODE_PARAM: 'inviteCode'
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享常量统一入口
 * 各端从此处统一 import,禁止本地硬编码重复
 */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/theme.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$error$2d$codes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/error-codes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$storage$2d$keys$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/storage-keys.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$coze$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/coze.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$payment$2d$codes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/payment-codes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$external$2d$urls$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/external-urls.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$sso$2d$client$2d$ids$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/sso-client-ids.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$page$2d$size$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/page-size.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/share.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/constants.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// TOKEN_STORAGE_KEY / REFRESH_TOKEN_STORAGE_KEY 已迁移至 ./constants/storage-keys.ts
// 此处 re-export 保持向后兼容(已有大量代码从 'constants' 直接 import)
__turbopack_context__.s([
    "REFRESH_LEAD_MS",
    ()=>REFRESH_LEAD_MS,
    "TOKEN_EXPIRED_CODES",
    ()=>TOKEN_EXPIRED_CODES,
    "WEB_BASE",
    ()=>WEB_BASE
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$storage$2d$keys$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/storage-keys.ts [app-client] (ecmascript) <locals>");
/**
 * Error codes (business error enum, predicates, i18n key mapping) - shared across all apps.
 * @see ./constants/error-codes.ts
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$error$2d$codes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/error-codes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/theme.ts [app-client] (ecmascript)");
// 统一 re-export constants/ 目录下所有常量
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/index.ts [app-client] (ecmascript) <locals>");
;
const REFRESH_LEAD_MS = 5 * 60 * 1000;
const TOKEN_EXPIRED_CODES = [
    401,
    40101,
    499
];
const WEB_BASE = 'https://aizhs.top';
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/auth/auto-refresh.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * Token 自动刷新核心逻辑(跨端共享,零平台依赖)
 *
 * 各端 web/extension/mobile-rn 的 token 自动刷新实现共享如下核心计算:
 * 1. REFRESH_LEAD_MS:提前续期时间(5 分钟,从 constants.ts re-export)
 * 2. MIN_DELAY_MS / MAX_DELAY_MS:setTimeout / chrome.alarms 调度边界
 * 3. computeRefreshDelay:从 JWT exp 计算下一次 refresh 延迟(带 clamp)
 * 4. createInFlightRefresh:飞行中请求去重器(同一时间只允许一个 refresh)
 *
 * 各端薄封装实现:
 * - web: setTimeout 调度器(inFlightRefresh + refreshTimer)
 * - extension: chrome.alarms 调度器(scheduleOnce + clearSchedule)
 * - mobile-rn: 暂未实现(未来可基于 setInterval / BackgroundFetch)
 */ __turbopack_context__.s([
    "MAX_DELAY_MS",
    ()=>MAX_DELAY_MS,
    "MIN_DELAY_MS",
    ()=>MIN_DELAY_MS,
    "computeRefreshDelay",
    ()=>computeRefreshDelay,
    "createInFlightRefresh",
    ()=>createInFlightRefresh
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/jwt-utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/constants.ts [app-client] (ecmascript) <locals>");
;
;
;
const MIN_DELAY_MS = 30 * 1000;
const MAX_DELAY_MS = 24 * 60 * 60 * 1000;
function computeRefreshDelay(accessToken) {
    let leadMs = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["REFRESH_LEAD_MS"];
    const exp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readExp"])(accessToken);
    if (!exp) return null;
    const delayMs = exp * 1000 - Date.now() - leadMs;
    return Math.max(MIN_DELAY_MS, Math.min(delayMs, MAX_DELAY_MS));
}
function createInFlightRefresh() {
    let inFlight = null;
    return {
        get: ()=>inFlight,
        set: (p)=>{
            inFlight = p;
        },
        clear: ()=>{
            inFlight = null;
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/auth/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$auth$2f$sso$2d$core$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/auth/sso-core.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$auth$2f$token$2d$store$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/auth/token-store.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$auth$2f$auto$2d$refresh$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/auth/auto-refresh.ts [app-client] (ecmascript) <locals>"); //# sourceMappingURL=index.js.map
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/notifications/use-notification-websocket.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * WebSocket 通知客户端(共享 hook,各端通用)。
 *
 * 使用共享层 @ihui/api-client 的 WebSocketClient(框架无关),
 * 此处仅做 React hook 薄包装,由各端注入自己的 token 获取函数和 baseUrl。
 *
 * 功能:
 * - 登录后自动连接 ws://host/ws/notifications?token=<access_token>
 * - 心跳:30s ping,服务端回 pong
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 组件卸载时关闭连接
 * - token 变化(登录/登出)自动重连
 *
 * 用法:在已登录的组件中调用
 * `const { connected, lastMessage } = useNotificationWebSocket(token, config)`
 */ __turbopack_context__.s([
    "useNotificationWebSocket",
    ()=>useNotificationWebSocket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$ws$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/ws-client.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useNotificationWebSocket(token, config) {
    _s();
    const [connected, setConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [lastMessage, setLastMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const clientRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useNotificationWebSocket.useEffect": ()=>{
            if (!token) return;
            const client = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$ws$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createNotificationClient"])({
                baseUrl: config.baseUrl,
                tokenProvider: config.tokenProvider
            }, {
                onOpen: {
                    "useNotificationWebSocket.useEffect.client": ()=>setConnected(true)
                }["useNotificationWebSocket.useEffect.client"],
                onClose: {
                    "useNotificationWebSocket.useEffect.client": ()=>setConnected(false)
                }["useNotificationWebSocket.useEffect.client"],
                onMessage: {
                    "useNotificationWebSocket.useEffect.client": (msg)=>setLastMessage(msg)
                }["useNotificationWebSocket.useEffect.client"]
            });
            clientRef.current = client;
            client.connect();
            return ({
                "useNotificationWebSocket.useEffect": ()=>{
                    client.disconnect();
                    clientRef.current = null;
                }
            })["useNotificationWebSocket.useEffect"];
        }
    }["useNotificationWebSocket.useEffect"], [
        token,
        config.baseUrl,
        config.tokenProvider
    ]);
    return {
        connected,
        lastMessage
    };
} //# sourceMappingURL=use-notification-websocket.js.map
_s(useNotificationWebSocket, "Jd+lx/goa5MaLqyamNtICXI5gXI=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/notifications/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$notifications$2f$ws$2d$notification$2d$adapter$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/notifications/ws-notification-adapter.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$notifications$2f$use$2d$notification$2d$websocket$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/notifications/use-notification-websocket.js [app-client] (ecmascript)"); // notification-store.tsx 不在此导出:它含 JSX/React Context,仅前端(mobile-rn/extension)
 // 通过子路径 @ihui/shared/notifications/notification-store 直接导入,避免 api 端 tsc 因缺 jsx 配置报 TS6142
 //# sourceMappingURL=index.js.map
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/validation/dict-schema.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EMPTY_DICT_ITEM_FORM",
    ()=>EMPTY_DICT_ITEM_FORM,
    "EMPTY_DICT_TYPE_FORM",
    ()=>EMPTY_DICT_TYPE_FORM,
    "dictItemSchema",
    ()=>dictItemSchema,
    "dictTypeSchema",
    ()=>dictTypeSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-client] (ecmascript) <export * as z>");
;
const dictTypeSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(64, 'maxLength'),
    code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(64, 'maxLength').regex(/^[a-z][a-z0-9_]*$/, 'pattern'),
    description: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(500, 'maxLength').optional().default('')
});
const EMPTY_DICT_TYPE_FORM = {
    name: '',
    code: '',
    description: ''
};
/**
 * 字典项(Item)表单 schema。
 *
 * 校验规则:
 * - label:必填,1-128
 * - value:必填,1-128
 * - sort:整数,>= 0
 * - dictType:必填
 * - listClass:必须是预定义的 ListClass
 * - status:0 或 1
 * - cssClass:可选
 * - remark:可选,最大 500
 */ const LIST_CLASS_VALUES = [
    'default',
    'primary',
    'success',
    'info',
    'warning',
    'danger'
];
const dictItemSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    label: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(128, 'maxLength'),
    value: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(128, 'maxLength'),
    sort: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().int('integer').min(0, 'min'),
    dictType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required'),
    listClass: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum(LIST_CLASS_VALUES),
    status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].union([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].literal(0),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].literal(1)
    ]),
    cssClass: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(64, 'maxLength').optional().default(''),
    remark: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(500, 'maxLength').optional().default('')
});
const EMPTY_DICT_ITEM_FORM = {
    label: '',
    value: '',
    sort: 0,
    cssClass: '',
    listClass: 'default',
    status: 1,
    remark: '',
    dictType: ''
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/validation/tag-schema.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EMPTY_TAG_FORM",
    ()=>EMPTY_TAG_FORM,
    "tagSchema",
    ()=>tagSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-client] (ecmascript) <export * as z>");
;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const tagSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(64, 'maxLength'),
    description: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(500, 'maxLength').optional().default(''),
    color: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(16, 'maxLength').refine((v)=>v === '' || HEX_COLOR_RE.test(v), {
        message: 'pattern'
    }).optional().default('')
});
const EMPTY_TAG_FORM = {
    name: '',
    description: '',
    color: ''
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/validation/help-schema.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EMPTY_HELP_FORM",
    ()=>EMPTY_HELP_FORM,
    "HELP_CATEGORY_VALUES",
    ()=>HELP_CATEGORY_VALUES,
    "helpSchema",
    ()=>helpSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-client] (ecmascript) <export * as z>");
;
const HELP_CATEGORIES = [
    'account',
    'payment',
    'project',
    'ai',
    'tech'
];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const helpSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    title: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(200, 'maxLength'),
    slug: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(120, 'maxLength').refine((v)=>v === '' || SLUG_RE.test(v), {
        message: 'pattern'
    }).optional().default(''),
    category: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum(HELP_CATEGORIES),
    content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(50_000, 'maxLength'),
    isPublished: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean()
});
const EMPTY_HELP_FORM = {
    title: '',
    slug: '',
    category: 'account',
    content: '',
    isPublished: false
};
const HELP_CATEGORY_VALUES = HELP_CATEGORIES;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/validation/ask-schema.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ASK_STATUS_VALUES",
    ()=>ASK_STATUS_VALUES,
    "EMPTY_ASK_FORM",
    ()=>EMPTY_ASK_FORM,
    "askSchema",
    ()=>askSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-client] (ecmascript) <export * as z>");
;
const STATUS_VALUES = [
    -1,
    0,
    1
];
const askSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    title: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(200, 'maxLength'),
    content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'required').max(10_000, 'maxLength'),
    tags: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(500, 'maxLength').optional().default(''),
    status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].union([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].literal(-1),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].literal(0),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].literal(1)
    ]),
    isResolved: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean()
});
const EMPTY_ASK_FORM = {
    title: '',
    content: '',
    tags: '',
    status: 1,
    isResolved: false
};
const ASK_STATUS_VALUES = STATUS_VALUES;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/validation/form-schema.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 共享 Zod schema 工具(实时校验、错误信息国际化)。
 *
 * 设计原则:
 * 1. 业务页直接复用预制 z.string().min(1, msg('required')) 模式
 * 2. `msg()` 自动将 zod issue code 映射到 `admin.validation.*` i18n key
 * 3. schema 不绑定到具体 page;`useZodForm` hook 调用 schema 时注入 i18n translator
 *
 * 用法:
 * ```ts
 * const schema = z.object({
 *   name: z.string().min(1, msg('required', { field: '名称' })),
 *   email: z.string().email(msg('email')),
 *   age: z.number().int().min(18, msg('min', { min: 18 })),
 * })
 * ```
 */ /** i18n key 命名空间前缀 */ __turbopack_context__.s([
    "DEFAULT_VALIDATION_MESSAGES",
    ()=>DEFAULT_VALIDATION_MESSAGES,
    "VALIDATION_KEYS",
    ()=>VALIDATION_KEYS,
    "VALIDATION_NS",
    ()=>VALIDATION_NS,
    "buildMessage",
    ()=>buildMessage
]);
const VALIDATION_NS = 'admin.validation';
function buildMessage(t, key, vars) {
    return t("".concat(VALIDATION_NS, ".").concat(key), vars);
}
const VALIDATION_KEYS = {
    required: true,
    min: true,
    max: true,
    minLength: true,
    maxLength: true,
    email: true,
    url: true,
    uuid: true,
    number: true,
    integer: true,
    positive: true,
    pattern: true,
    enum: true,
    custom: true
};
const DEFAULT_VALIDATION_MESSAGES = {
    required: 'Required',
    min: 'Min value is {min}',
    max: 'Max value is {max}',
    minLength: 'Min length is {min}',
    maxLength: 'Max length is {max}',
    email: 'Invalid email',
    url: 'Invalid URL',
    uuid: 'Invalid UUID',
    number: 'Must be a number',
    integer: 'Must be an integer',
    positive: 'Must be positive',
    pattern: 'Invalid format',
    enum: 'Invalid value',
    custom: 'Invalid value'
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/validation/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$validation$2f$dict$2d$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/validation/dict-schema.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$validation$2f$tag$2d$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/validation/tag-schema.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$validation$2f$help$2d$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/validation/help-schema.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$validation$2f$ask$2d$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/validation/ask-schema.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$validation$2f$form$2d$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/validation/form-schema.ts [app-client] (ecmascript)");
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/workflows/approval-machine.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "approvalMachine",
    ()=>approvalMachine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/xstate.development.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/assign-393c348f.development.esm.js [app-client] (ecmascript) <export a as assign>");
;
const approvalMachine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setup"])({
    types: {
        context: {},
        events: {}
    },
    guards: {
        hasApprover: (param)=>{
            let { event } = param;
            return event.type !== 'APPROVE' || Boolean(event.approverId);
        }
    },
    actions: {
        recordApprover: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            approverId: (param)=>{
                let { event } = param;
                return event.type === 'APPROVE' ? event.approverId : undefined;
            }
        }),
        recordRejection: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            approverId: (param)=>{
                let { event } = param;
                return event.type === 'REJECT' ? event.approverId : undefined;
            },
            rejectReason: (param)=>{
                let { event } = param;
                return event.type === 'REJECT' ? event.reason : undefined;
            }
        }),
        incrementSubmit: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            submitCount: (param)=>{
                let { context } = param;
                return context.submitCount + 1;
            }
        })
    }
}).createMachine({
    id: 'approval',
    initial: 'draft',
    context: {
        submitCount: 0
    },
    states: {
        draft: {
            on: {
                SUBMIT: {
                    target: 'submitted',
                    actions: 'incrementSubmit'
                },
                CANCEL: 'cancelled'
            }
        },
        submitted: {
            on: {
                APPROVE: {
                    target: 'approved',
                    guard: 'hasApprover',
                    actions: 'recordApprover'
                },
                REJECT: {
                    target: 'rejected',
                    actions: 'recordRejection'
                },
                CANCEL: 'cancelled'
            }
        },
        approved: {
            on: {
                REVOKE: 'draft'
            }
        },
        rejected: {
            on: {
                RESUBMIT: {
                    target: 'submitted',
                    actions: 'incrementSubmit'
                },
                CANCEL: 'cancelled'
            }
        },
        cancelled: {
            type: 'final'
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/workflows/refund-machine.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "refundMachine",
    ()=>refundMachine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/xstate.development.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/assign-393c348f.development.esm.js [app-client] (ecmascript) <export a as assign>");
;
const refundMachine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setup"])({
    types: {
        context: {},
        events: {}
    },
    actions: {
        recordReviewer: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            reviewerId: (param)=>{
                let { event } = param;
                return event.type === 'REVIEW' ? event.reviewerId : undefined;
            }
        }),
        recordRejection: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            rejectReason: (param)=>{
                let { event } = param;
                return event.type === 'REJECT' ? event.reason : undefined;
            }
        }),
        recordTransaction: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            transactionId: (param)=>{
                let { event } = param;
                return event.type === 'REFUND_SUCCESS' ? event.transactionId : undefined;
            }
        }),
        recordError: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            errorMessage: (param)=>{
                let { event } = param;
                return event.type === 'REFUND_FAIL' ? event.error : undefined;
            }
        }),
        incrementRetry: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            retryCount: (param)=>{
                let { context } = param;
                return context.retryCount + 1;
            }
        })
    }
}).createMachine({
    id: 'refund',
    initial: 'pending',
    context: {
        retryCount: 0
    },
    states: {
        pending: {
            on: {
                REVIEW: {
                    target: 'reviewing',
                    actions: 'recordReviewer'
                },
                CANCEL: 'cancelled'
            }
        },
        reviewing: {
            on: {
                APPROVE_REFUND: 'refunding',
                REJECT: {
                    target: 'rejected',
                    actions: 'recordRejection'
                }
            }
        },
        refunding: {
            on: {
                REFUND_SUCCESS: {
                    target: 'refunded',
                    actions: 'recordTransaction'
                },
                REFUND_FAIL: {
                    target: 'failed',
                    actions: 'recordError'
                }
            }
        },
        refunded: {
            type: 'final'
        },
        rejected: {
            type: 'final'
        },
        failed: {
            on: {
                RETRY: {
                    target: 'refunding',
                    actions: 'incrementRetry'
                },
                CANCEL: 'cancelled'
            }
        },
        cancelled: {
            type: 'final'
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/workflows/withdrawal-machine.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WITHDRAWAL_AUTO_APPROVE_THRESHOLD",
    ()=>WITHDRAWAL_AUTO_APPROVE_THRESHOLD,
    "withdrawalMachine",
    ()=>withdrawalMachine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/xstate.development.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/assign-393c348f.development.esm.js [app-client] (ecmascript) <export a as assign>");
;
const AUTO_APPROVE_THRESHOLD = 100;
const withdrawalMachine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setup"])({
    types: {
        context: {},
        events: {}
    },
    guards: {
        isBelowAutoApproveThreshold: (param)=>{
            let { event } = param;
            return event.type === 'AUTO_APPROVE' && event.amount < AUTO_APPROVE_THRESHOLD;
        },
        isAboveAutoApproveThreshold: (param)=>{
            let { event } = param;
            return event.type === 'AUTO_APPROVE' && event.amount >= AUTO_APPROVE_THRESHOLD;
        }
    },
    actions: {
        setAmount: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            amount: (param)=>{
                let { event } = param;
                return event.type === 'AUTO_APPROVE' ? event.amount : 0;
            }
        }),
        recordApprover: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            approverId: (param)=>{
                let { event } = param;
                return event.type === 'APPROVE' ? event.approverId : undefined;
            }
        }),
        recordRejection: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            rejectReason: (param)=>{
                let { event } = param;
                return event.type === 'REJECT' ? event.reason : undefined;
            }
        }),
        recordTransaction: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            transactionId: (param)=>{
                let { event } = param;
                return event.type === 'PAY_SUCCESS' ? event.transactionId : undefined;
            },
            paidAt: (param)=>{
                let { event } = param;
                return event.type === 'PAY_SUCCESS' ? event.paidAt : undefined;
            }
        }),
        recordError: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            errorMessage: (param)=>{
                let { event } = param;
                return event.type === 'PAY_FAIL' ? event.error : undefined;
            }
        }),
        incrementRetry: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            retryCount: (param)=>{
                let { context } = param;
                return context.retryCount + 1;
            }
        })
    }
}).createMachine({
    id: 'withdrawal',
    initial: 'requested',
    context: {
        amount: 0,
        retryCount: 0
    },
    states: {
        requested: {
            on: {
                AUTO_APPROVE: [
                    {
                        target: 'paying',
                        guard: 'isBelowAutoApproveThreshold',
                        actions: 'setAmount'
                    },
                    {
                        target: 'verifying',
                        actions: 'setAmount'
                    }
                ],
                CANCEL: 'cancelled'
            }
        },
        verifying: {
            on: {
                APPROVE: {
                    target: 'approved',
                    actions: 'recordApprover'
                },
                REJECT: {
                    target: 'rejected',
                    actions: 'recordRejection'
                }
            }
        },
        approved: {
            on: {
                PAY: 'paying',
                CANCEL: 'cancelled'
            }
        },
        paying: {
            on: {
                PAY_SUCCESS: {
                    target: 'paid',
                    actions: 'recordTransaction'
                },
                PAY_FAIL: {
                    target: 'failed',
                    actions: 'recordError'
                }
            }
        },
        paid: {
            type: 'final'
        },
        rejected: {
            type: 'final'
        },
        failed: {
            on: {
                RETRY: {
                    target: 'paying',
                    actions: 'incrementRetry'
                },
                CANCEL: 'cancelled'
            }
        },
        cancelled: {
            type: 'final'
        }
    }
});
const WITHDRAWAL_AUTO_APPROVE_THRESHOLD = AUTO_APPROVE_THRESHOLD;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/workflows/ticket-machine.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ticketMachine",
    ()=>ticketMachine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/xstate.development.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/xstate@5.32.5/node_modules/xstate/dist/assign-393c348f.development.esm.js [app-client] (ecmascript) <export a as assign>");
;
const ticketMachine = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$xstate$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setup"])({
    types: {
        context: {},
        events: {}
    },
    guards: {
        hasAssignee: (param)=>{
            let { event } = param;
            return event.type !== 'ASSIGN' || Boolean(event.assigneeId);
        }
    },
    actions: {
        recordAssignee: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            assigneeId: (param)=>{
                let { event } = param;
                return event.type === 'ASSIGN' ? event.assigneeId : undefined;
            }
        }),
        recordResolution: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            resolution: (param)=>{
                let { event } = param;
                return event.type === 'RESOLVE' ? event.resolution : undefined;
            }
        }),
        recordReopen: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            reopenReason: (param)=>{
                let { event } = param;
                return event.type === 'REOPEN' ? event.reason : undefined;
            },
            reopenCount: (param)=>{
                let { context } = param;
                return context.reopenCount + 1;
            }
        }),
        recordRejection: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$xstate$40$5$2e$32$2e$5$2f$node_modules$2f$xstate$2f$dist$2f$assign$2d$393c348f$2e$development$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a__as__assign$3e$__["assign"])({
            rejectReason: (param)=>{
                let { event } = param;
                return event.type === 'REJECT' ? event.reason : undefined;
            }
        })
    }
}).createMachine({
    id: 'ticket',
    initial: 'open',
    context: {
        reopenCount: 0
    },
    states: {
        open: {
            on: {
                ASSIGN: {
                    target: 'assigned',
                    guard: 'hasAssignee',
                    actions: 'recordAssignee'
                },
                REJECT: {
                    target: 'rejected',
                    actions: 'recordRejection'
                }
            }
        },
        assigned: {
            on: {
                START_WORK: 'in_progress',
                REJECT: {
                    target: 'rejected',
                    actions: 'recordRejection'
                }
            }
        },
        in_progress: {
            on: {
                RESOLVE: {
                    target: 'resolved',
                    actions: 'recordResolution'
                }
            }
        },
        resolved: {
            on: {
                REOPEN: {
                    target: 'in_progress',
                    actions: 'recordReopen'
                },
                CLOSE: 'closed'
            }
        },
        closed: {
            type: 'final'
        },
        rejected: {
            type: 'final'
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/workflows/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$workflows$2f$approval$2d$machine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/workflows/approval-machine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$workflows$2f$refund$2d$machine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/workflows/refund-machine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$workflows$2f$withdrawal$2d$machine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/workflows/withdrawal-machine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$workflows$2f$ticket$2d$machine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/workflows/ticket-machine.ts [app-client] (ecmascript)");
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/ai-skill-variables.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * AI Skill 变量映射共享模块 — 2026-07-23 新增
 *
 * 详情页 `/ai-skills/[id]` 与 SkillLibrary 弹窗的 AiSkillInvokeDialog 共用,
 * 支持 15 个已知变量,覆盖全部 19 个真集成 skill。
 *
 * 变量 → skill 对应关系:
 * - content/style          → nuwa-skill
 * - requirements           → hugshu-design
 * - topic                  → agent-reach / auto-redbook-skills / obsidian-skills / guizang-ppt-skill
 * - domain                 → horizon
 * - platform               → media-crawler
 * - concept                → generative-media-skills
 * - title/subtitle         → guizang-social-card-skill
 * - content/platforms      → social-auto-upload
 * - usecase                → claude-plugins-official
 * - task                   → superpowers / agent-skills / awesome-agent-skills
 * - text                   → caveman / graphify / taste-skill
 * - language               → agent-skills (与 task 组合)
 * - input                  → awesome-claude-skills
 */ /** 把变量名映射到 i18n key(aiSkillDetail 命名空间) */ __turbopack_context__.s([
    "LONG_TEXT_VARS",
    ()=>LONG_TEXT_VARS,
    "VARIABLE_LABEL_KEY",
    ()=>VARIABLE_LABEL_KEY,
    "VARIABLE_MAX_LEN",
    ()=>VARIABLE_MAX_LEN,
    "VARIABLE_PLACEHOLDER_KEY",
    ()=>VARIABLE_PLACEHOLDER_KEY,
    "getLabelKey",
    ()=>getLabelKey,
    "getMaxLen",
    ()=>getMaxLen,
    "getPlaceholderKey",
    ()=>getPlaceholderKey,
    "isLongText",
    ()=>isLongText,
    "parseVariables",
    ()=>parseVariables
]);
const VARIABLE_LABEL_KEY = {
    content: 'inputContent',
    style: 'inputStyle',
    requirements: 'inputRequirements',
    topic: 'inputTopic',
    domain: 'inputDomain',
    platform: 'inputPlatform',
    concept: 'inputConcept',
    title: 'inputTitle',
    subtitle: 'inputSubtitle',
    platforms: 'inputPlatforms',
    usecase: 'inputUsecase',
    task: 'inputTask',
    text: 'inputText',
    language: 'inputLanguage',
    input: 'inputInput'
};
const VARIABLE_PLACEHOLDER_KEY = {
    content: 'placeholderContent',
    style: 'placeholderStyle',
    requirements: 'placeholderRequirements',
    topic: 'placeholderTopic',
    domain: 'placeholderDomain',
    platform: 'placeholderPlatform',
    concept: 'placeholderConcept',
    title: 'placeholderTitle',
    subtitle: 'placeholderSubtitle',
    platforms: 'placeholderPlatforms',
    usecase: 'placeholderUsecase',
    task: 'placeholderTask',
    text: 'placeholderText',
    language: 'placeholderLanguage',
    input: 'placeholderInput'
};
const VARIABLE_MAX_LEN = {
    content: 4000,
    style: 200,
    requirements: 1000,
    topic: 500,
    domain: 200,
    platform: 100,
    concept: 500,
    title: 200,
    subtitle: 200,
    platforms: 500,
    usecase: 500,
    task: 500,
    text: 4000,
    language: 50,
    input: 1000
};
const LONG_TEXT_VARS = new Set([
    'content',
    'requirements',
    'topic',
    'platforms',
    'text',
    'input'
]);
function parseVariables(template) {
    if (!template) return [];
    const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const seen = new Set();
    const out = [];
    let m;
    while((m = re.exec(template)) !== null){
        var _m_;
        const k = (_m_ = m[1]) !== null && _m_ !== void 0 ? _m_ : '';
        if (k && !seen.has(k)) {
            seen.add(k);
            out.push(k);
        }
    }
    return out;
}
function getLabelKey(key) {
    var _VARIABLE_LABEL_KEY_key;
    return (_VARIABLE_LABEL_KEY_key = VARIABLE_LABEL_KEY[key]) !== null && _VARIABLE_LABEL_KEY_key !== void 0 ? _VARIABLE_LABEL_KEY_key : "input".concat(key.charAt(0).toUpperCase()).concat(key.slice(1));
}
function getPlaceholderKey(key) {
    var _VARIABLE_PLACEHOLDER_KEY_key;
    return (_VARIABLE_PLACEHOLDER_KEY_key = VARIABLE_PLACEHOLDER_KEY[key]) !== null && _VARIABLE_PLACEHOLDER_KEY_key !== void 0 ? _VARIABLE_PLACEHOLDER_KEY_key : "placeholder".concat(key.charAt(0).toUpperCase()).concat(key.slice(1));
}
function getMaxLen(key) {
    var _VARIABLE_MAX_LEN_key;
    return (_VARIABLE_MAX_LEN_key = VARIABLE_MAX_LEN[key]) !== null && _VARIABLE_MAX_LEN_key !== void 0 ? _VARIABLE_MAX_LEN_key : 1000;
}
function isLongText(key) {
    return LONG_TEXT_VARS.has(key);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/async.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** 防抖:延迟执行,中途再次调用会重置计时器 */ __turbopack_context__.s([
    "debounce",
    ()=>debounce,
    "sleep",
    ()=>sleep,
    "throttle",
    ()=>throttle
]);
function debounce(func) {
    let wait = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 500;
    let timeout = null;
    return function() {
        for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
            args[_key] = arguments[_key];
        }
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(()=>func(...args), wait);
    };
}
function throttle(func) {
    let wait = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 500;
    let previous = 0;
    return function() {
        for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
            args[_key] = arguments[_key];
        }
        const now = Date.now();
        if (now - previous > wait) {
            func(...args);
            previous = now;
        }
    };
}
function sleep(ms) {
    return new Promise((resolve)=>setTimeout(resolve, ms));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/base64.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端 Base64 工具(自动检测原生 btoa,不存在时回退到 polyfill)。
 *
 * 背景:web 端有原生 btoa,mobile-rn Hermes 引擎无 btoa,miniapp-taro 需自定义 polyfill。
 * 统一为单一来源,消除跨端实现差异。
 */ __turbopack_context__.s([
    "arrayBufferToBase64",
    ()=>arrayBufferToBase64,
    "btoa",
    ()=>btoa
]);
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/**
 * 原生 btoa 引用(模块加载时一次性捕获,避免函数内递归)。
 * web 端(DOM lib)存在原生 btoa;mobile-rn Hermes / miniapp-taro 无。
 */ const nativeBtoa = typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function' ? globalThis.btoa : undefined;
function btoa(input) {
    if (nativeBtoa) {
        return nativeBtoa(input);
    }
    // polyfill 回退(原 miniapp-taro/streaming-recognizer.ts 自定义实现)
    let output = '';
    let i = 0;
    while(i < input.length){
        const a = input.charCodeAt(i++);
        const b = i < input.length ? input.charCodeAt(i++) : NaN;
        const c = i < input.length ? input.charCodeAt(i++) : NaN;
        const enc1 = a >> 2;
        const enc2 = (a & 3) << 4 | b >> 4;
        const enc3 = isNaN(b) ? 64 : (b & 15) << 2 | c >> 6;
        const enc4 = isNaN(c) ? 64 : c & 63;
        output += (BASE64_CHARS[enc1] || '') + (BASE64_CHARS[enc2] || '') + (enc3 === 64 ? '=' : BASE64_CHARS[enc3] || '') + (enc4 === 64 ? '=' : BASE64_CHARS[enc4] || '');
    }
    return output;
}
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for(let i = 0; i < bytes.byteLength; i++){
        binary += String.fromCharCode(bytes[i] || 0);
    }
    return btoa(binary);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/dangerous-command-detector.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 危险命令检测器(2026-07-25 立,深度对标 OpenAI Codex CLI safety guard)
 *
 * 触发场景:
 * - 用户在 bypass-permissions(完全访问)模式下发送 prompt
 * - prompt 包含 shell 命令,AI 会在工作区终端直接执行
 * - 部分命令是不可逆/高破坏性的(rm -rf /、mkfs、dd 等),需要在发送前拦截
 *
 * 设计原则:
 * - 纯函数,无副作用(无 React 依赖、无 I/O),可被单元测试 / message-input 任意场景复用
 * - 大小写不敏感(命令大小写在 Unix 系统下等价)
 * - 匹配策略:逐 pattern 跑正则,只要有 critical 或 high 命中即 hasDangerous=true
 * - 暴露 DANGEROUS_PATTERNS 供自验脚本引用,避免硬编码 2 处
 *
 * 不在本文件做的事:
 * - 不实际解析 shell AST(过度工程,正则足够覆盖 95% 场景)
 * - 不拦截 default / accept-edits 模式(由 message-input 调用方控制)
 * - 不持久化检测结果(无状态)
 */ __turbopack_context__.s([
    "DANGEROUS_PATTERNS",
    ()=>DANGEROUS_PATTERNS,
    "detectDangerousCommands",
    ()=>detectDangerousCommands
]);
const DANGEROUS_PATTERNS = [
    // === critical:不可逆 + 整盘/整系统级破坏 ===
    {
        id: 'rmRrfRoot',
        reason: 'Recursively deletes root or home directory, cannot be recovered',
        severity: 'critical',
        regex: /\brm\s+(-\w*r\w*f\w*\s+)+(\/\s*|\/\*|~\s*|~\/\*)/i
    },
    {
        id: 'ddToDisk',
        reason: 'Writes raw data directly to a disk device, will destroy the filesystem',
        severity: 'critical',
        regex: /\bdd\s+.*\bof=\/dev\/(sd\w+|nvme\w+|hd\w+|vd\w+)/i
    },
    {
        id: 'mkfsDisk',
        reason: 'Formats a disk device and erases all partitions',
        severity: 'critical',
        regex: /\bmkfs(\.\w+)?\s+\/dev\/(sd\w+|nvme\w+|hd\w+|vd\w+)/i
    },
    {
        id: 'redirectToDevice',
        reason: 'Redirects output to a raw disk device, will corrupt the filesystem',
        severity: 'critical',
        regex: />\s*\/dev\/(sd\w+|nvme\w+|hd\w+|vd\w+)\b/i
    },
    {
        id: 'chmodRoot',
        reason: 'Sets world-writable permissions on root or system directories',
        severity: 'critical',
        regex: /\bchmod\s+(-\w*R\w*\s+)*777\s+\//i
    },
    // === high:提权 / 任意代码执行 / fork bomb ===
    {
        id: 'sudoAny',
        reason: 'Runs a command as root via sudo',
        severity: 'high',
        regex: /\bsudo\s+/i
    },
    {
        id: 'curlPipeSh',
        reason: 'Downloads a remote script and immediately executes it',
        severity: 'high',
        regex: /\b(curl|wget)\s+.*\|\s*(sh|bash|zsh|sudo\s+sh|sudo\s+bash)\b/i
    },
    {
        id: 'forkBomb',
        reason: 'Classic Unix fork bomb that exhausts system processes',
        severity: 'high',
        regex: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/
    },
    {
        id: 'mvRootToNull',
        reason: 'Moves all files under root into /dev/null, effectively wiping the system',
        severity: 'high',
        regex: /\bmv\s+(\/\*|(\/(\s|\S)+?))\s+\/dev\/null\b/i
    },
    // === medium:删除关键文件 / 强推主分支 ===
    {
        id: 'rmEnv',
        reason: 'Deletes .env files, which often contain secrets and credentials',
        severity: 'medium',
        regex: /\brm\s+(-\w*r\w*f\w*\s+)*[^\s]*\.env\b/i
    },
    {
        id: 'rmGit',
        reason: 'Deletes the .git directory, destroying version history',
        severity: 'medium',
        regex: /\brm\s+(-\w*r\w*f\w*\s+)*[^\s]*\.git\b/i
    },
    {
        id: 'forcePushMain',
        reason: 'Force-pushes to main/master, may overwrite remote history',
        severity: 'medium',
        regex: /\bgit\s+push\s+(-\w*f\w*\s+|--force\w*\s+).*\b(main|master)\b/i
    }
];
function detectDangerousCommands(input) {
    if (!input) {
        return {
            matches: [],
            hasDangerous: false
        };
    }
    const matches = [];
    for (const pat of DANGEROUS_PATTERNS){
        if (pat.regex.test(input)) {
            matches.push({
                pattern: pat.id,
                reason: pat.reason,
                severity: pat.severity
            });
        }
    }
    const hasDangerous = matches.some((m)=>m.severity === 'critical' || m.severity === 'high');
    return {
        matches,
        hasDangerous
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/error-messages.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * errorCode → i18n key 映射表。
 * 后端 AppError 的 errorCode 是稳定标识符，前端通过此映射实现错误消息国际化。
 * 优先使用 errorCode 对应的 i18n 文案，fallback 到原始 error.message。
 */ __turbopack_context__.s([
    "getErrorI18nKey",
    ()=>getErrorI18nKey,
    "resolveErrorMessage",
    ()=>resolveErrorMessage
]);
const ERROR_CODE_TO_I18N_KEY = {
    VALIDATION_FAILED: 'errors.validationFailed',
    UNAUTHORIZED: 'errors.unauthorized',
    FORBIDDEN: 'errors.forbidden',
    NOT_FOUND: 'errors.notFound',
    CONFLICT: 'errors.conflict',
    RATE_LIMITED: 'errors.rateLimited',
    LOCKED: 'errors.locked',
    INTERNAL_ERROR: 'errors.internalError',
    UPSTREAM_FAILURE: 'errors.upstreamFailure',
    SERVICE_UNAVAILABLE: 'errors.serviceUnavailable',
    MEMBER_EXISTS: 'errors.memberExists',
    OPTIMISTIC_LOCK: 'errors.optimisticLock',
    INVALID_MONEY: 'errors.invalidMoney',
    INVALID_TIMEZONE: 'errors.invalidTimezone'
};
function getErrorI18nKey(errorCode) {
    return ERROR_CODE_TO_I18N_KEY[errorCode];
}
function resolveErrorMessage(error, t) {
    if (error.errorCode) {
        const i18nKey = getErrorI18nKey(error.errorCode);
        if (i18nKey) return t(i18nKey);
    }
    var _error_message;
    return (_error_message = error.message) !== null && _error_message !== void 0 ? _error_message : t('errors.unknown');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/file-helpers.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 文件扩展名与 MIME 类型工具(跨端统一:miniapp-taro/upload-image + web/lib/file-utils 共用)。
 */ /**
 * 从文件路径/URL 提取扩展名(小写,无点)。
 * 例:'/a/b.jpg?x=1' -> 'jpg', 'file.png' -> 'png', 'noext' -> 'jpg'(默认)
 */ __turbopack_context__.s([
    "getExt",
    ()=>getExt,
    "getMimeType",
    ()=>getMimeType
]);
function getExt(filePath) {
    const parts = filePath.substring(filePath.lastIndexOf('/') + 1).split('?');
    const baseName = parts[0] || '';
    const dotIdx = baseName.lastIndexOf('.');
    return dotIdx > -1 ? baseName.substring(dotIdx + 1).toLowerCase() : 'jpg';
}
function getMimeType(ext) {
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/form-styles.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Admin 表单通用 Tailwind class 常量(消除 9 处重复定义) */ __turbopack_context__.s([
    "inputSm",
    ()=>inputSm,
    "selectClass",
    ()=>selectClass,
    "textareaClass",
    ()=>textareaClass
]);
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const inputSm = 'h-8 text-xs';
const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/format-ext.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Extended format functions (batch 1, cross-end unified).
 */ __turbopack_context__.s([
    "formatHumanDuration",
    ()=>formatHumanDuration,
    "formatMediaTime",
    ()=>formatMediaTime,
    "formatShortDuration",
    ()=>formatShortDuration
]);
function formatShortDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return "".concat(m.toString().padStart(2, '0'), ":").concat(s.toString().padStart(2, '0'));
}
function formatMediaTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const total = Math.floor(sec);
    const h = Math.floor(total / 3600);
    const m = Math.floor(total % 3600 / 60);
    const s = total % 60;
    if (h > 0) {
        return "".concat(h, ":").concat(m.toString().padStart(2, '0'), ":").concat(s.toString().padStart(2, '0'));
    }
    return "".concat(m, ":").concat(s.toString().padStart(2, '0'));
}
function formatHumanDuration(minutes) {
    if (!minutes || minutes <= 0) return '0m';
    if (minutes < 60) return "".concat(minutes, "m");
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? "".concat(h, "h ").concat(m, "m") : "".concat(h, "h");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/format-mobile.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 移动端/小程序端通用格式工具(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn 与 apps/miniapp-taro 各登录/注册/资料页面
 * 中重复出现的"手机号/邮箱/密码"校验、格式化、脱敏逻辑。
 *
 * 平台无关:纯函数 + 纯正则,无任何平台依赖。
 *
 * 与 format.ts(已存在)的关系:
 * - format.ts:数字/货币/相对时间等通用格式化
 * - format-mobile.ts:手机/邮箱/密码/验证码等移动端业务校验 + 展示
 */ /** 中国大陆手机号正则(13/14/15/16/17/18/19 开头 + 9 位数字) */ __turbopack_context__.s([
    "CN_PHONE_REGEX",
    ()=>CN_PHONE_REGEX,
    "EMAIL_REGEX",
    ()=>EMAIL_REGEX,
    "extractPhoneDigits",
    ()=>extractPhoneDigits,
    "formatPhoneDisplay",
    ()=>formatPhoneDisplay,
    "generateSmsCode",
    ()=>generateSmsCode,
    "isValidEmail",
    ()=>isValidEmail,
    "isValidPassword",
    ()=>isValidPassword,
    "isValidPhone",
    ()=>isValidPhone,
    "isValidSmsCode",
    ()=>isValidSmsCode,
    "maskEmail",
    ()=>maskEmail,
    "maskMiddle",
    ()=>maskMiddle,
    "maskPhone",
    ()=>maskPhone
]);
const CN_PHONE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function isValidPhone(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return CN_PHONE_REGEX.test(trimmed);
}
function isValidEmail(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return EMAIL_REGEX.test(trimmed);
}
function isValidPassword(value) {
    let opts = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    const { minLength = 6, maxLength = 20, requireLetter = true, requireDigit = true } = opts;
    if (typeof value !== 'string') return false;
    if (value.length < minLength || value.length > maxLength) return false;
    // 支持 Unicode 字母(中文/日文/韩文/拉丁扩展等),用 \p{L} 替代 a-zA-Z
    if (requireLetter && !RegExp("\\p{L}", "u").test(value)) return false;
    if (requireDigit && !/\d/.test(value)) return false;
    return true;
}
function isValidSmsCode(value) {
    let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 6;
    if (typeof value !== 'string') return false;
    const re = new RegExp("^\\d{".concat(length, "}$"));
    return re.test(value.trim());
}
function maskPhone(phone) {
    if (typeof phone !== 'string') return '';
    if (phone.length < 7) {
        if (phone.length <= 3) return phone;
        return phone.slice(0, 3) + '*'.repeat(phone.length - 3);
    }
    return phone.slice(0, 3) + '****' + phone.slice(-4);
}
function maskEmail(email) {
    if (typeof email !== 'string' || !email.includes('@')) return '****';
    const [name, domain] = email.split('@');
    if (!name || !domain) return '****';
    if (name.length <= 2) return name[0] + '****@' + domain;
    return name.slice(0, 2) + '****@' + domain;
}
function formatPhoneDisplay(phone) {
    let separator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : ' ';
    if (typeof phone !== 'string') return '';
    const trimmed = phone.trim();
    if (!trimmed) return '';
    // 处理 +86 / +1 + 11 位中国手机号(优先匹配,避免贪婪匹配吞掉手机号)
    const cnIntlMatch = /^(\+\d{1,3})(\d{11})$/.exec(trimmed);
    if (cnIntlMatch) {
        const prefix = cnIntlMatch[1];
        var _cnIntlMatch_;
        const rest = (_cnIntlMatch_ = cnIntlMatch[2]) !== null && _cnIntlMatch_ !== void 0 ? _cnIntlMatch_ : '';
        if (!prefix || !rest) return trimmed;
        return "".concat(prefix, " ").concat(formatPhoneDisplay(rest, separator));
    }
    // 处理 +1 + 10 位美国/加拿大号码
    const usIntlMatch = /^(\+\d{1,3})(\d{10})$/.exec(trimmed);
    if (usIntlMatch) {
        const prefix = usIntlMatch[1];
        var _usIntlMatch_;
        const rest = (_usIntlMatch_ = usIntlMatch[2]) !== null && _usIntlMatch_ !== void 0 ? _usIntlMatch_ : '';
        if (!prefix || !rest) return trimmed;
        return "".concat(prefix, " ").concat(formatPhoneDisplay(rest, separator));
    }
    // 11 位中国大陆手机号
    if (CN_PHONE_REGEX.test(trimmed)) {
        return "".concat(trimmed.slice(0, 3)).concat(separator).concat(trimmed.slice(3, 7)).concat(separator).concat(trimmed.slice(7));
    }
    // 8 位座机(区号-号码)
    if (/^\d{8}$/.test(trimmed)) {
        return "".concat(trimmed.slice(0, 4)).concat(separator).concat(trimmed.slice(4));
    }
    // 7 位座机(区号-号码)
    if (/^\d{7}$/.test(trimmed)) {
        return "".concat(trimmed.slice(0, 3)).concat(separator).concat(trimmed.slice(3));
    }
    return trimmed;
}
function extractPhoneDigits(input) {
    if (typeof input !== 'string') return '';
    // 去除国际区号前缀
    const withoutIntl = input.replace(/^\+\d{1,3}\s*/, '');
    return withoutIntl.replace(/\D/g, '');
}
function generateSmsCode() {
    let length = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 6;
    if (length <= 0) return '';
    let code = '';
    for(let i = 0; i < length; i++){
        code += Math.floor(Math.random() * 10).toString();
    }
    return code;
}
function maskMiddle(value) {
    let head = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 3, tail = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 4;
    if (typeof value !== 'string') return '';
    if (value.length <= head + tail) return '*'.repeat(value.length);
    const headPart = value.slice(0, head);
    const tailPart = value.slice(value.length - tail);
    const middle = '*'.repeat(value.length - head - tail);
    return "".concat(headPart).concat(middle).concat(tailPart);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/image-helpers.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享 image 辅助(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn/src/hooks/useChatInput.ts 中
 * inferTypeFromMime/buildFileFromAsset 与 apps/miniapp-taro/src/utils/upload-image.ts
 * 中 chooseImages/uploadImage 的纯逻辑部分(URL 处理、文件名生成、mime 推断)。
 *
 * 平台无关:本文件不 import 任何平台 API,纯函数 + 纯类型。
 * 平台相关(选图/上传/读取)由各端自行实现,本文件只提供"输入归一化 + URL 处理"。
 *
 * 与 file-helpers.ts(getExt/getMimeType)的关系:
 * - file-helpers:基于扩展名的 URL/路径解析
 * - image-helpers:基于 mime/type 字段的文件类型推断 + URL 拼接 + 缩略图尺寸
 */ __turbopack_context__.s([
    "buildFileFromAsset",
    ()=>buildFileFromAsset,
    "buildFileName",
    ()=>buildFileName,
    "fitThumbnailSize",
    ()=>fitThumbnailSize,
    "inferTypeFromMime",
    ()=>inferTypeFromMime,
    "isLocalUrl",
    ()=>isLocalUrl,
    "joinUrl",
    ()=>joinUrl,
    "toBase64DataUrl",
    ()=>toBase64DataUrl
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$file$2d$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/file-helpers.ts [app-client] (ecmascript)");
;
function inferTypeFromMime(mime, fallback) {
    if (!mime) return fallback;
    const lower = mime.toLowerCase();
    if (lower.startsWith('image/')) return 'image';
    if (lower.startsWith('video/')) return 'video';
    if (lower.startsWith('audio/')) return 'audio';
    return fallback === 'image' || fallback === 'video' || fallback === 'audio' || fallback === 'document' ? fallback : 'document';
}
let fileIdCounter = 0;
function nextFileId() {
    return "file-".concat(Date.now(), "-").concat(++fileIdCounter);
}
function buildFileFromAsset(asset, fallback) {
    var _asset_mimeType;
    const mime = (_asset_mimeType = asset.mimeType) !== null && _asset_mimeType !== void 0 ? _asset_mimeType : null;
    var _asset_type;
    const explicitType = ((_asset_type = asset.type) !== null && _asset_type !== void 0 ? _asset_type : '').toLowerCase();
    let type = fallback;
    if (explicitType === 'image' || explicitType === 'video' || explicitType === 'audio' || explicitType === 'document') {
        type = explicitType;
    } else if (mime) {
        type = inferTypeFromMime(mime, fallback);
    }
    var _asset_uri;
    const result = {
        id: nextFileId(),
        url: (_asset_uri = asset.uri) !== null && _asset_uri !== void 0 ? _asset_uri : '',
        type
    };
    if (asset.fileName) result.filename = asset.fileName;
    if (mime) result.mimeType = mime;
    if (typeof asset.fileSize === 'number') result.size = asset.fileSize;
    return result;
}
function buildFileName(prefix, filePath) {
    let index = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    const ext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$file$2d$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getExt"])(filePath);
    const ts = Date.now();
    const p = prefix || 'img';
    return ext ? "".concat(p, "_").concat(ts, "_").concat(index, ".").concat(ext) : "".concat(p, "_").concat(ts, "_").concat(index);
}
function toBase64DataUrl(base64, mimeOrExt) {
    const mime = mimeOrExt.includes('/') ? mimeOrExt : (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$file$2d$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getMimeType"])(mimeOrExt);
    return "data:".concat(mime, ";base64,").concat(base64);
}
function joinUrl(baseUrl, path) {
    if (!path) return baseUrl;
    if (/^(https?:|file:|data:|blob:|wxfile:|ph:)/i.test(path)) return path;
    if (!baseUrl) return path;
    if (path.startsWith('/')) return baseUrl.replace(/\/$/, '') + path;
    return baseUrl.replace(/\/$/, '') + '/' + path;
}
function isLocalUrl(url) {
    if (!url) return false;
    return url.startsWith('file:') || url.startsWith('wxfile:') || url.startsWith('ph:') || url.startsWith('blob:') || !/^https?:\/\//i.test(url) && !url.startsWith('data:');
}
function fitThumbnailSize(origWidth, origHeight, maxSide) {
    if (origWidth <= 0 || origHeight <= 0) return {
        width: 0,
        height: 0
    };
    if (maxSide <= 0) return {
        width: origWidth,
        height: origHeight
    };
    const longer = Math.max(origWidth, origHeight);
    if (longer <= maxSide) return {
        width: origWidth,
        height: origHeight
    };
    const ratio = maxSide / longer;
    return {
        width: Math.round(origWidth * ratio),
        height: Math.round(origHeight * ratio)
    };
} /**
 * 文件大小格式化(1024 进制,1 位小数,B/KB/MB/GB/TB)
 * 与 format.ts 的 formatFileSize 行为一致;本文件不重新导出,调用方请从
 * '@ihui/shared/utils/format' 或 '@ihui/shared/utils'(index 合并)导入。
 */ 
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/storage.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享 storage 抽象(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn/src/lib/credential-storage.ts 与
 * apps/miniapp-taro/src/lib/credential-storage.ts 中重复的
 * "JSON 读写 + 错误兜底 + history 列表" 模式。
 *
 * 核心思想:基于 @ihui/shared/stores 的 PersistTransport(已支持 5 端),
 *          在此之上提供高阶工厂:
 *   - createJsonStorage:JSON.parse/stringify + null 兜底
 *   - createStorage:按 key 的类型化 get/set/remove(泛型)
 *   - createHistoryStorage:history 列表(去重 + LRU + maxItems)
 *
 * 平台无关:本文件不 import 任何平台 API(RN / Taro / DOM),
 * 依赖项只有 @ihui/shared/stores 的 PersistTransport。
 *
 * 各端接入:
 * ```ts
 * // mobile-rn(AsyncStorage)
 * const transport = createAsyncTransport({
 *   getItem: (k) => AsyncStorage.getItem(k),
 *   setItem: (k, v) => AsyncStorage.setItem(k, v),
 *   removeItem: (k) => AsyncStorage.removeItem(k),
 * })
 * const storage = createStorage<{ account: string; password: string }>({
 *   transport,
 *   key: 'ihui-remember-credentials',
 * })
 *
 * // miniapp-taro(Taro.storage)
 * const transport = createSyncTransport({
 *   getItem: (k) => Taro.getStorageSync(k),
 *   setItem: (k, v) => Taro.setStorageSync(k, v),
 *   removeItem: (k) => Taro.removeStorageSync(k),
 * })
 * ```
 */ __turbopack_context__.s([
    "createFlagStorage",
    ()=>createFlagStorage,
    "createHistoryStorage",
    ()=>createHistoryStorage,
    "createJsonStorage",
    ()=>createJsonStorage,
    "createStringStorage",
    ()=>createStringStorage
]);
function createJsonStorage(transport, key) {
    return {
        async get () {
            try {
                const raw = await transport.getItem(key);
                if (raw === null || raw === '') return null;
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        },
        async set (value) {
            try {
                await transport.setItem(key, JSON.stringify(value));
            } catch (e) {
            // 静默失败,storage 不可用不阻断业务
            }
        },
        async remove () {
            try {
                await transport.removeItem(key);
            } catch (e) {
            // 静默失败
            }
        }
    };
}
function createStringStorage(transport, key) {
    return {
        async get () {
            try {
                const raw = await transport.getItem(key);
                return raw === null || raw === '' ? null : raw;
            } catch (e) {
                return null;
            }
        },
        async set (value) {
            try {
                await transport.setItem(key, value);
            } catch (e) {
            // 静默失败
            }
        },
        async remove () {
            try {
                await transport.removeItem(key);
            } catch (e) {
            // 静默失败
            }
        }
    };
}
function defaultIsValid(item) {
    if (item === null || item === undefined) return false;
    if (typeof item === 'string') return item.length > 0;
    if (Array.isArray(item)) return item.length > 0;
    if (typeof item === 'object') return Object.keys(item).length > 0;
    return true;
}
function defaultEquals(a, b) {
    if (Object.is(a, b)) return true;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
        return false;
    }
}
function createHistoryStorage(options) {
    const { transport, key, maxItems, equals = defaultEquals, isValid = defaultIsValid } = options;
    const read = async ()=>{
        try {
            const raw = await transport.getItem(key);
            if (raw === null || raw === '') return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((x)=>isValid(x));
        } catch (e) {
            return [];
        }
    };
    const write = async (list)=>{
        if (list.length === 0) {
            try {
                await transport.removeItem(key);
            } catch (e) {
            // 静默
            }
        } else {
            try {
                await transport.setItem(key, JSON.stringify(list));
            } catch (e) {
            // 静默
            }
        }
        return list;
    };
    return {
        get: read,
        async push (item) {
            if (!isValid(item)) return read();
            const list = await read();
            const filtered = list.filter((x)=>!equals(x, item));
            filtered.unshift(item);
            return write(filtered.slice(0, maxItems));
        },
        async remove (item) {
            const list = await read();
            const filtered = list.filter((x)=>!equals(x, item));
            return write(filtered);
        },
        clear: ()=>write([])
    };
}
function createFlagStorage(transport, key) {
    return {
        async get () {
            try {
                const raw = await transport.getItem(key);
                return raw === '1';
            } catch (e) {
                return false;
            }
        },
        async set (enabled) {
            try {
                if (enabled) {
                    await transport.setItem(key, '1');
                } else {
                    await transport.removeItem(key);
                }
            } catch (e) {
            // 静默
            }
        },
        async clear () {
            try {
                await transport.removeItem(key);
            } catch (e) {
            // 静默
            }
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/llm-templates.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Provider → LLM 平台模板代码映射
 *
 * 用途:model-selector / 模型广场页根据 model vendor 字段,
 *       判断该模型所属厂商是否在「LLM 配置中心」里有预置模板可以一键配置。
 *
 * 平台模板定义在 apps/api/src/routes/platform-templates.ts,共 15+ 预置。
 *  - openai / anthropic / google / deepseek / moonshot / zhipu / alibaba / baidu /
 *    bytedance / stepfun / groq / openrouter / ollama / lmstudio / custom
 *
 * 映射原则:
 *  - 1:1 直接命中(大多数情况):openai ↔ openai, deepseek ↔ deepseek ...
 *  - 厂商别名合并:qwen ↔ alibaba, doubao ↔ bytedance, kimi ↔ moonshot, wenxin ↔ baidu,
 *    glm ↔ zhipu, glm-4 ↔ zhipu
 *  - 平台型 provider(如 openrouter/bedrock/azure)直接命中同名模板
 *  - 无预置模板的厂商返回 null(UI 引导用户到"自定义"模板自填 baseUrl)
 */ __turbopack_context__.s([
    "hasPresetTemplate",
    ()=>hasPresetTemplate,
    "providerToTemplateCode",
    ()=>providerToTemplateCode
]);
const VENDOR_TO_TEMPLATE = {
    // === 国际原厂(直接命中)===
    openai: 'openai',
    anthropic: 'anthropic',
    google: 'google',
    deepseek: 'deepseek',
    // === 国内原厂(别名合并)===
    qwen: 'alibaba',
    zhipu: 'zhipu',
    chatglm: 'zhipu',
    glm: 'zhipu',
    moonshot: 'moonshot',
    kimi: 'moonshot',
    doubao: 'bytedance',
    bytedance: 'bytedance',
    stepfun: 'stepfun',
    wenxin: 'baidu',
    baidu: 'baidu',
    // === 国际推理平台(直接命中)===
    groq: 'groq',
    openrouter: 'openrouter',
    // === 云平台/聚合 ===
    bedrock: 'openai',
    azure: 'openai',
    // === 本地 ===
    ollama: 'ollama',
    openwebui: 'ollama',
    lmstudio: 'lmstudio',
    local: 'ollama'
};
function providerToTemplateCode(vendor) {
    if (!vendor) return null;
    var _VENDOR_TO_TEMPLATE_vendor_toLowerCase;
    return (_VENDOR_TO_TEMPLATE_vendor_toLowerCase = VENDOR_TO_TEMPLATE[vendor.toLowerCase()]) !== null && _VENDOR_TO_TEMPLATE_vendor_toLowerCase !== void 0 ? _VENDOR_TO_TEMPLATE_vendor_toLowerCase : null;
}
function hasPresetTemplate(vendor) {
    return providerToTemplateCode(vendor) !== null;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/logger.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端日志工具(2026-07-27 立,从 apps/miniapp-taro/src/utils/logger.ts 迁移)
 *
 * 设计:
 * - 分级输出(error/warn/info/debug),currentLevel 控制最低输出级别
 * - 默认 error 级别(生产环境只输出 error,避免日志噪音)
 * - 跨端兼容:只用 console.error/warn/info,不依赖任何平台 API
 * - 签名统一:logger.error(module, action, err) / logger.warn(module, action, message) / logger.info(module, action, message)
 *
 * 消费者(2026-07-27 审计):
 * - miniapp-taro:`apps/miniapp-taro/src/utils/logger.ts` re-export 本 logger,
 *   30+ 处调用(三参数结构化,如 `logger.error('agentDialogue', 'ws 连接', e)`)
 *
 * 不消费此 logger 的端(避免误判为死代码):
 * - web:浏览器 SSR + PII 保护需求不同,独立实现 `apps/web/src/lib/logger.ts`
 *   (变参 `...args` + SSR 安全 + 生产只 error/warn + 不打印原始 error 对象)
 *   web 端 22 处调用与 shared 三参数签名不兼容,设计目标根本不同,
 *   两端 logger 各自存在是合理的端差异,非死代码。
 *
 * 用法:
 *   import { logger } from '@ihui/shared/utils/logger'
 *   logger.error('ranking/detail', '获取详情', err)
 *   logger.warn('auth', 'token过期', '请重新登录')
 *   logger.info('app', '启动', 'v1.0.0')
 */ __turbopack_context__.s([
    "logger",
    ()=>logger
]);
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};
const currentLevel = 'error';
const logger = {
    error: (module, action, err)=>{
        if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.error) {
            console.error("[".concat(module, "] ").concat(action, " failed:"), err);
        }
    },
    warn: (module, action, message)=>{
        if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.warn) {
            console.warn("[".concat(module, "] ").concat(action, ": ").concat(message));
        }
    },
    info: (module, action, message)=>{
        if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.info) {
            console.info("[".concat(module, "] ").concat(action, ": ").concat(message));
        }
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/markdown-mermaid-code.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 判断 react-markdown 代码块 className 是否为 mermaid 语言。
 *
 * react-markdown v9 会将 ```mermaid 块的 className 渲染为 "language-mermaid"，
 * 这里以大小写不敏感方式匹配，避免各渲染器中硬编码字符串。
 */ __turbopack_context__.s([
    "isMermaidLanguage",
    ()=>isMermaidLanguage
]);
function isMermaidLanguage(className) {
    return /^language-mermaid$/i.test(className !== null && className !== void 0 ? className : '');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/mcp-curated.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 精选 MCP 列表数据 — 等价自旧架构 client/src/data/mcp-curated.ts
 * 导出官方精选的 MCP（Model Context Protocol）服务器列表，供 MCP 市场展示
 */ __turbopack_context__.s([
    "CURATED_MCP_LIST",
    ()=>CURATED_MCP_LIST,
    "MCP_CATEGORY_LABELS",
    ()=>MCP_CATEGORY_LABELS,
    "findMcpById",
    ()=>findMcpById,
    "findMcpsByCategory",
    ()=>findMcpsByCategory,
    "getFeaturedMcps",
    ()=>getFeaturedMcps
]);
const CURATED_MCP_LIST = [
    {
        id: 'mcp-filesystem',
        name: 'Filesystem',
        description: '提供本地文件系统读写、目录浏览能力，支持限定根目录范围。',
        publisher: 'Anthropic',
        repository: 'https://github.com/modelcontextprotocol/servers',
        package: '@modelcontextprotocol/server-filesystem',
        transport: 'stdio',
        category: 'filesystem',
        tags: [
            '文件',
            '读写',
            '本地'
        ],
        official: true,
        featured: true,
        scopes: [
            'fs:read',
            'fs:write'
        ]
    },
    {
        id: 'mcp-fetch',
        name: 'Fetch',
        description: '抓取指定 URL 的网页内容并转为 Markdown，供模型理解。',
        publisher: 'Anthropic',
        repository: 'https://github.com/modelcontextprotocol/servers',
        package: '@modelcontextprotocol/server-fetch',
        transport: 'stdio',
        category: 'web',
        tags: [
            '网页',
            '抓取',
            'markdown'
        ],
        official: true,
        featured: true,
        scopes: [
            'net:fetch'
        ]
    },
    {
        id: 'mcp-brave-search',
        name: 'Brave Search',
        description: '通过 Brave 搜索引擎进行网络搜索，返回结构化结果。',
        publisher: 'Brave',
        repository: 'https://github.com/modelcontextprotocol/servers',
        package: '@modelcontextprotocol/server-brave-search',
        transport: 'stdio',
        category: 'search',
        tags: [
            '搜索',
            '网络',
            'brave'
        ],
        official: true,
        featured: true,
        scopes: [
            'search:web'
        ]
    },
    {
        id: 'mcp-postgres',
        name: 'PostgreSQL',
        description: '只读访问 PostgreSQL 数据库，支持执行查询与 schema 探索。',
        publisher: 'Anthropic',
        repository: 'https://github.com/modelcontextprotocol/servers',
        package: '@modelcontextprotocol/server-postgres',
        transport: 'stdio',
        category: 'database',
        tags: [
            '数据库',
            'postgres',
            'sql',
            '只读'
        ],
        official: true,
        scopes: [
            'db:query'
        ]
    },
    {
        id: 'mcp-sqlite',
        name: 'SQLite',
        description: '操作本地 SQLite 数据库，支持查询、写入与 schema 管理。',
        publisher: 'Anthropic',
        package: '@modelcontextprotocol/server-sqlite',
        transport: 'stdio',
        category: 'database',
        tags: [
            '数据库',
            'sqlite',
            'sql'
        ],
        official: true
    },
    {
        id: 'mcp-github',
        name: 'GitHub',
        description: '操作 GitHub 仓库：创建 issue、PR、搜索代码、读取文件等。',
        publisher: 'GitHub',
        package: '@modelcontextprotocol/server-github',
        transport: 'stdio',
        category: 'devtools',
        tags: [
            'github',
            'git',
            '代码',
            'issue',
            'pr'
        ],
        featured: true,
        scopes: [
            'repo:read',
            'repo:write'
        ]
    },
    {
        id: 'mcp-gitlab',
        name: 'GitLab',
        description: '操作 GitLab 项目：issue、MR、流水线、仓库文件。',
        publisher: 'modelcontextprotocol',
        package: '@modelcontextprotocol/server-gitlab',
        transport: 'stdio',
        category: 'devtools',
        tags: [
            'gitlab',
            'git',
            '代码',
            'mr'
        ]
    },
    {
        id: 'mcp-puppeteer',
        name: 'Puppeteer',
        description: '通过 Puppeteer 控制浏览器，执行页面自动化与截图。',
        publisher: 'Anthropic',
        package: '@modelcontextprotocol/server-puppeteer',
        transport: 'stdio',
        category: 'web',
        tags: [
            '浏览器',
            '自动化',
            '截图',
            'puppeteer'
        ],
        official: true
    },
    {
        id: 'mcp-memory',
        name: 'Memory',
        description: '基于知识图谱的长期记忆，跨会话保存实体与关系。',
        publisher: 'Anthropic',
        package: '@modelcontextprotocol/server-memory',
        transport: 'stdio',
        category: 'productivity',
        tags: [
            '记忆',
            '知识图谱',
            '长期'
        ],
        official: true
    },
    {
        id: 'mcp-slack',
        name: 'Slack',
        description: '与 Slack 工作区交互：发送消息、读取频道、搜索历史。',
        publisher: 'Slack',
        package: '@modelcontextprotocol/server-slack',
        transport: 'stdio',
        category: 'communication',
        tags: [
            'slack',
            '消息',
            '频道'
        ],
        scopes: [
            'slack:read',
            'slack:write'
        ]
    },
    {
        id: 'mcp-google-drive',
        name: 'Google Drive',
        description: '搜索与读取 Google Drive 中的文件内容。',
        publisher: 'Anthropic',
        package: '@modelcontextprotocol/server-google-drive',
        transport: 'stdio',
        category: 'productivity',
        tags: [
            'google',
            'drive',
            '文件',
            '云盘'
        ],
        official: true,
        scopes: [
            'drive:read'
        ]
    },
    {
        id: 'mcp-time',
        name: 'Time',
        description: '获取当前时间与时区转换，支持自定义格式。',
        publisher: 'Anthropic',
        package: '@modelcontextprotocol/server-time',
        transport: 'stdio',
        category: 'other',
        tags: [
            '时间',
            '时区',
            '日期'
        ],
        official: true
    }
];
const MCP_CATEGORY_LABELS = {
    filesystem: '文件系统',
    search: '搜索',
    database: '数据库',
    devtools: '开发工具',
    productivity: '效率工具',
    web: '网络',
    communication: '通信协作',
    other: '其他'
};
function findMcpById(id) {
    return CURATED_MCP_LIST.find((item)=>item.id === id);
}
function findMcpsByCategory(category) {
    return CURATED_MCP_LIST.filter((item)=>item.category === category);
}
function getFeaturedMcps() {
    return CURATED_MCP_LIST.filter((item)=>item.featured);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/message-search.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 消息搜索工具函数(2026-07-29 立,Phase 23)
 *
 * 纯函数模块,提供消息搜索 + 高亮 + 正则转义能力,供 message-list.tsx 接入
 * "右键菜单搜索消息 + Ctrl+F 快捷键 + 高亮匹配 + 滚动到第一个匹配" 使用。
 *
 * 设计要点:
 * - 全部为纯函数,无副作用,便于单测
 * - 大小写不敏感匹配
 * - escapeRegExp 防止用户输入的特殊字符被当作正则元字符(注入防护)
 * - highlightMatch 返回 HTML 片段,用 <mark> 标签包裹匹配项(调用方需用 dangerouslySetInnerHTML)
 */ /** 搜索消息的最小结构:只需 id + content */ __turbopack_context__.s([
    "escapeRegExp",
    ()=>escapeRegExp,
    "highlightMatch",
    ()=>highlightMatch,
    "searchMessages",
    ()=>searchMessages
]);
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
function searchMessages(messages, query) {
    const trimmed = query.trim();
    if (trimmed === '' || messages.length === 0) return [];
    const pattern = new RegExp(escapeRegExp(trimmed), 'i');
    const result = [];
    for (const m of messages){
        if (pattern.test(m.content)) {
            result.push(m.id);
        }
    }
    return result;
}
function highlightMatch(text, query) {
    const trimmed = query.trim();
    const escapedText = escapeHtml(text);
    if (trimmed === '') return escapedText;
    const escapedQuery = escapeHtml(trimmed);
    const pattern = new RegExp("(".concat(escapeRegExp(escapedQuery), ")"), 'gi');
    return escapedText.replace(pattern, '<mark class="bg-yellow-200 dark:bg-yellow-700 rounded-sm px-0.5">$1</mark>');
}
/** HTML 转义:防止 XSS,只转义 5 个核心字符(& < > " ') */ function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/object.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** 深拷贝:优先使用原生 structuredClone,降级到手动递归 */ __turbopack_context__.s([
    "deepClone",
    ()=>deepClone,
    "isEmpty",
    ()=>isEmpty
]);
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (typeof structuredClone === 'function') return structuredClone(obj);
    const clone = Array.isArray(obj) ? [] : {};
    for(const key in obj){
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            ;
            clone[key] = deepClone(obj[key]);
        }
    }
    return clone;
}
function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/role.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 用户角色标签(跨端统一:mobile-rn/UserInfoCard 共用)。
 * isVip: 1=VIP, 0=普通;identityType: 1=操盘手, 2=会员, 其他=普通用户
 * 逻辑依据 mobile-rn/UserInfoCard.tsx 原始实现:isVip===1 且 identityType===1 → 操盘手;isVip===1 → 会员。
 */ __turbopack_context__.s([
    "getRoleLabel",
    ()=>getRoleLabel
]);
function getRoleLabel(isVip, identityType) {
    if (isVip === 1 && identityType === 1) return '操盘手';
    if (isVip === 1) return '会员';
    return '普通用户';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/search-suggestions.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// 2026-07-28 立:SearchBar 三段式搜索面板(历史/热门/联想)的"热门"段数据集中管理。
// 设计:硬编码 8 个常用关键词(项目内置基线),与现有 i18n search.quickSuggestions
// 在含义上互补 — 这里是"运营推荐的热门",那里是"联想建议池"。
// 后续可下沉到 i18n / 后端配置中心,先以 const 形态稳定接口。
__turbopack_context__.s([
    "POPULAR_SEARCHES",
    ()=>POPULAR_SEARCHES
]);
const POPULAR_SEARCHES = [
    'AI 对话',
    '项目管理',
    '数据分析',
    '设置',
    '帮助',
    '快捷键',
    '个人资料',
    'AI 模型'
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/select-class.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SELECT_CLASS",
    ()=>SELECT_CLASS
]);
const SELECT_CLASS = 'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/sse-parse.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseSSEChunk",
    ()=>parseSSEChunk
]);
function applyErrorMeta(evt, json) {
    if (typeof json.code === 'number') evt.code = json.code;
    if (typeof json.statusCode === 'number' && evt.code === undefined) evt.code = json.statusCode;
    if (typeof json.errorCode === 'string') evt.errorCode = json.errorCode;
    if (typeof json.retryAfter === 'number') evt.retryAfter = json.retryAfter;
}
function parseSSEChunk(buffer) {
    const events = [];
    let rest = buffer;
    let nl;
    while((nl = rest.indexOf('\n')) !== -1){
        const line = rest.slice(0, nl).replace(/\r$/, '');
        rest = rest.slice(nl + 1);
        const evt = parseLine(line);
        if (evt) events.push(evt);
    }
    return {
        events,
        remainder: rest
    };
}
function parseLine(line) {
    if (!line || line.startsWith(':')) return null;
    let data = line;
    if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '');
    } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return null;
    }
    if (data === '[DONE]') return {
        type: 'done'
    };
    const proto = data.match(RegExp("^(\\d+):(.*)$", "s"));
    const protoType = proto === null || proto === void 0 ? void 0 : proto[1];
    const protoPayload = proto === null || proto === void 0 ? void 0 : proto[2];
    if (protoType && protoPayload) {
        try {
            const parsed = JSON.parse(protoPayload);
            if (protoType === '0' && typeof parsed === 'string') {
                return {
                    type: 'chunk',
                    content: parsed
                };
            }
            if (protoType === '9' && typeof parsed === 'string') {
                return {
                    type: 'reasoning',
                    content: parsed
                };
            }
            return null;
        } catch (e) {
            return null;
        }
    }
    try {
        const json = JSON.parse(data);
        if (typeof (json === null || json === void 0 ? void 0 : json.error) === 'string') {
            const evt = {
                type: 'error',
                content: json.error
            };
            applyErrorMeta(evt, json);
            return evt;
        }
        if ((json === null || json === void 0 ? void 0 : json.type) === 'error' && typeof (json === null || json === void 0 ? void 0 : json.message) === 'string') {
            const evt = {
                type: 'error',
                content: json.message
            };
            applyErrorMeta(evt, json);
            return evt;
        }
        if ((json === null || json === void 0 ? void 0 : json.error) === true && typeof (json === null || json === void 0 ? void 0 : json.error_message) === 'string') {
            const evt = {
                type: 'error',
                content: json.error_message
            };
            applyErrorMeta(evt, json);
            return evt;
        }
        const choices = json === null || json === void 0 ? void 0 : json.choices;
        const choice = choices === null || choices === void 0 ? void 0 : choices[0];
        if (choice) {
            var _this, _this1;
            var _content, _ref;
            const delta = (_ref = (_content = (_this = choice.delta) === null || _this === void 0 ? void 0 : _this.content) !== null && _content !== void 0 ? _content : (_this1 = choice.message) === null || _this1 === void 0 ? void 0 : _this1.content) !== null && _ref !== void 0 ? _ref : choice.text;
            if (typeof delta === 'string') return {
                type: 'chunk',
                content: delta
            };
        }
        if ((json === null || json === void 0 ? void 0 : json.type) === 'reasoning' && typeof (json === null || json === void 0 ? void 0 : json.delta) === 'string') {
            return {
                type: 'reasoning',
                content: json.delta
            };
        }
        if (typeof (json === null || json === void 0 ? void 0 : json.content) === 'string') return {
            type: 'chunk',
            content: json.content
        };
        if (typeof (json === null || json === void 0 ? void 0 : json.delta) === 'string') return {
            type: 'chunk',
            content: json.delta
        };
        if (typeof (json === null || json === void 0 ? void 0 : json.text) === 'string') return {
            type: 'chunk',
            content: json.text
        };
        if ((json === null || json === void 0 ? void 0 : json.type) === 'meta' && typeof (json === null || json === void 0 ? void 0 : json.sessionId) === 'string') {
            return {
                type: 'meta',
                sessionId: json.sessionId
            };
        }
        // done 事件:ai-service 在流末尾下发 {"type":"done","model":"...","usage":{"prompt_tokens":..,"completion_tokens":..,"total_tokens":..}}
        // 解析 usage.total_tokens 填充到消息的 tokenCount(对标原 ai_assistant.vue total_tokens 显示)
        if ((json === null || json === void 0 ? void 0 : json.type) === 'done') {
            const rawUsage = json.usage;
            const usage = rawUsage ? {
                promptTokens: typeof rawUsage.prompt_tokens === 'number' ? rawUsage.prompt_tokens : undefined,
                completionTokens: typeof rawUsage.completion_tokens === 'number' ? rawUsage.completion_tokens : undefined,
                totalTokens: typeof rawUsage.total_tokens === 'number' ? rawUsage.total_tokens : undefined
            } : undefined;
            return {
                type: 'done',
                usage,
                model: typeof json.model === 'string' ? json.model : undefined
            };
        }
        if (typeof (json === null || json === void 0 ? void 0 : json.sessionId) === 'string') {
            return {
                type: 'meta',
                sessionId: json.sessionId
            };
        }
        // 上下文自动压缩事件(跨端统一 88% 阈值触发,后端 SSE 首事件)
        const compaction = json === null || json === void 0 ? void 0 : json.compaction;
        if (compaction && compaction.triggered === true) {
            var _compaction_tokensBefore, _compaction_tokensAfter, _compaction_removedCount, _compaction_usageRatio;
            return {
                type: 'compaction',
                compaction: {
                    triggered: true,
                    tokensBefore: Number((_compaction_tokensBefore = compaction.tokensBefore) !== null && _compaction_tokensBefore !== void 0 ? _compaction_tokensBefore : 0),
                    tokensAfter: Number((_compaction_tokensAfter = compaction.tokensAfter) !== null && _compaction_tokensAfter !== void 0 ? _compaction_tokensAfter : 0),
                    removedCount: Number((_compaction_removedCount = compaction.removedCount) !== null && _compaction_removedCount !== void 0 ? _compaction_removedCount : 0),
                    usageRatio: Number((_compaction_usageRatio = compaction.usageRatio) !== null && _compaction_usageRatio !== void 0 ? _compaction_usageRatio : 0)
                }
            };
        }
        return null;
    } catch (e) {
        return data ? {
            type: 'chunk',
            content: data
        } : null;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/status-colors.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** 状态徽章颜色映射 - 统一规范，禁止使用蓝色 */ __turbopack_context__.s([
    "STATUS_COLORS",
    ()=>STATUS_COLORS,
    "TONE",
    ()=>TONE,
    "getStatusColor",
    ()=>getStatusColor
]);
const STATUS_COLORS = {
    // draft/未发布/archived → muted 灰
    draft: 'bg-muted text-muted-foreground',
    unpublished: 'bg-muted text-muted-foreground',
    archived: 'bg-muted text-muted-foreground',
    inactive: 'bg-muted text-muted-foreground',
    disabled: 'bg-muted text-muted-foreground',
    expired: 'bg-muted text-muted-foreground',
    // published/active/approved/paid/completed → emerald 绿
    published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    verified: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    enabled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    // pending/processing → amber 琥珀
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    reviewing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    submitted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    open: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    idle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    // rejected/failed/cancelled → red 红
    rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
    failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
    cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
    error: 'bg-red-500/10 text-red-600 dark:text-red-400',
    closed: 'bg-red-500/10 text-red-600 dark:text-red-400',
    // refunded → primary
    refunded: 'bg-primary/10 text-primary'
};
const TONE = {
    muted: 'bg-muted text-muted-foreground',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    primary: 'bg-primary/10 text-primary'
};
function getStatusColor(status) {
    var _STATUS_COLORS_status_toLowerCase;
    return (_STATUS_COLORS_status_toLowerCase = STATUS_COLORS[status.toLowerCase()]) !== null && _STATUS_COLORS_status_toLowerCase !== void 0 ? _STATUS_COLORS_status_toLowerCase : TONE.muted;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/storage-migration.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * storage key 迁移工具(2026-07-28 立)
 *
 * 用途:一次性迁移历史遗留 storage key 到新 key(下划线 → 连字符等命名规范统一场景)。
 *
 * 使用场景:miniapp-taro invite/vip store 启动时迁移历史 key
 *   (ihui_invite_code → ihui-invite-code / ihui_vip_info → ihui-vip-info),
 *   消除 apps/miniapp-taro/src/stores/invite.ts 与 vip.ts 中重复的 migrateLegacyXxxKey 实现。
 *
 * 设计原则:
 * - 纯函数 + transport 注入:不依赖具体 storage API,transport 由调用方注入
 * - 异常静默:try-catch 包裹,storage 读写失败不抛错,不阻断 store 初始化
 * - 同步语义:函数签名 void,适用于同步 transport(createSyncTransport);
 *   异步 transport(getItem 返回 Promise)会被 typeof 守卫忽略,不产生误写
 *
 * @example
 * ```ts
 * import { migrateLegacyStorageKey } from '@ihui/shared/utils'
 * import { createSyncTransport } from '@ihui/shared/stores'
 *
 * const transport = createSyncTransport({
 *   getItem: (k) => localStorage.getItem(k),
 *   setItem: (k, v) => localStorage.setItem(k, v),
 *   removeItem: (k) => localStorage.removeItem(k),
 * })
 * migrateLegacyStorageKey(transport, 'ihui_invite_code', 'ihui-invite-code')
 * ```
 */ __turbopack_context__.s([
    "migrateLegacyStorageKey",
    ()=>migrateLegacyStorageKey
]);
function migrateLegacyStorageKey(transport, legacyKey, newKey) {
    try {
        const legacy = transport.getItem(legacyKey);
        // typeof 守卫:仅处理同步返回的 string,忽略 Promise(异步 transport 不适用本工具)
        if (typeof legacy === 'string' && legacy) {
            transport.setItem(newKey, legacy);
            transport.removeItem(legacyKey);
        }
    } catch (e) {
    // storage 读取失败忽略,不阻断 store 初始化
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/vip-utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * VIP 状态判断纯函数(无副作用,可跨端复用)。
 *
 * 使用场景:
 * - miniapp-taro vip store(stores/vip.ts 的 getVipStatus / isVipActive)
 * - miniapp-taro member 页面剩余天数展示(calcVipRemainDays)
 * - mobile-rn vip screen(未来接入)
 * - web vip page(未来接入)
 *
 * 设计原则:纯函数 + 零依赖 + 防御性(无效日期/空值安全)。
 * 不引入任何外部 import,确保跨端可移植。
 */ /**
 * VIP 存储快照(从 storage / API 响应中读取的部分字段)。
 * 字段均可空,函数内做缺省处理。
 */ __turbopack_context__.s([
    "calcVipRemainDays",
    ()=>calcVipRemainDays,
    "getVipStatusFromSnapshot",
    ()=>getVipStatusFromSnapshot,
    "isVipActive",
    ()=>isVipActive
]);
function isVipActive(expireTime) {
    if (!expireTime) return false;
    const time = new Date(expireTime).getTime();
    if (Number.isNaN(time)) return false;
    return time > Date.now();
}
function getVipStatusFromSnapshot(snapshot) {
    const expireTime = snapshot.vipExpireTime || '';
    return {
        isVip: isVipActive(expireTime),
        level: snapshot.vipLevel || 0,
        expireTime
    };
}
function calcVipRemainDays(expireTime) {
    if (expireTime === null || expireTime === undefined || expireTime === '') return 0;
    let ms;
    if (typeof expireTime === 'number') {
        ms = expireTime > 1e12 ? expireTime : expireTime * 1000;
    } else {
        const parsed = Date.parse(expireTime);
        if (Number.isNaN(parsed)) return 0;
        ms = parsed;
    }
    const diff = ms - Date.now();
    return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/utils/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$ai$2d$skill$2d$variables$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/ai-skill-variables.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$async$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/async.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$base64$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/base64.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$dangerous$2d$command$2d$detector$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/dangerous-command-detector.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$date$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/date-utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$error$2d$messages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/error-messages.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$file$2d$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/file-helpers.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$form$2d$styles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/form-styles.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2d$ext$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/format-ext.ts [app-client] (ecmascript)");
// 移动端/小程序端通用格式工具(2026-07-30 立)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2d$mobile$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/format-mobile.ts [app-client] (ecmascript)");
// 跨端图片处理工具(2026-07-30 立,apps/mobile-rn + apps/miniapp-taro 共用)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$image$2d$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/image-helpers.ts [app-client] (ecmascript)");
// 跨端存储抽象(2026-07-30 立,apps/mobile-rn + apps/miniapp-taro 共用)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/storage.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/jwt-utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$llm$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/llm-templates.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$logger$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/logger.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$markdown$2d$mermaid$2d$code$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/markdown-mermaid-code.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$mcp$2d$curated$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/mcp-curated.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$message$2d$search$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/message-search.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$object$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/object.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$role$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/role.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$search$2d$suggestions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/search-suggestions.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$select$2d$class$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/select-class.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$sse$2d$parse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/sse-parse.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$status$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/status-colors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$storage$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/storage-migration.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$vip$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/vip-utils.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-debounce.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDebounce",
    ()=>useDebounce,
    "useDebouncedCallback",
    ()=>useDebouncedCallback
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
;
function useDebounce(value, delay) {
    _s();
    const [debounced, setDebounced] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](value);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useDebounce.useEffect": ()=>{
            const timer = setTimeout({
                "useDebounce.useEffect.timer": ()=>setDebounced(value)
            }["useDebounce.useEffect.timer"], delay);
            return ({
                "useDebounce.useEffect": ()=>clearTimeout(timer)
            })["useDebounce.useEffect"];
        }
    }["useDebounce.useEffect"], [
        value,
        delay
    ]);
    return debounced;
}
_s(useDebounce, "33bQBlXg6j7MFSTRBeGy5/ui5G8=");
function useDebouncedCallback(callback, delay) {
    _s1();
    const callbackRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](callback);
    callbackRef.current = callback;
    const timerRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useDebouncedCallback.useEffect": ()=>{
            return ({
                "useDebouncedCallback.useEffect": ()=>{
                    if (timerRef.current) clearTimeout(timerRef.current);
                }
            })["useDebouncedCallback.useEffect"];
        }
    }["useDebouncedCallback.useEffect"], []);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useDebouncedCallback.useCallback": function() {
            for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                args[_key] = arguments[_key];
            }
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout({
                "useDebouncedCallback.useCallback": ()=>callbackRef.current(...args)
            }["useDebouncedCallback.useCallback"], delay);
        }
    }["useDebouncedCallback.useCallback"], [
        delay
    ]);
}
_s1(useDebouncedCallback, "UkGxzUrhOr5DgcLtnagFp8EZ2Lg=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-countdown.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useCountdown",
    ()=>useCountdown
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useCountdown(seconds) {
    _s();
    const [count, setCount] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](seconds);
    const [isRunning, setRunning] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const timerRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const clear = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useCountdown.useCallback[clear]": ()=>{
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }["useCountdown.useCallback[clear]"], []);
    const start = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useCountdown.useCallback[start]": ()=>{
            setRunning(true);
            clear();
            timerRef.current = setInterval({
                "useCountdown.useCallback[start]": ()=>{
                    setCount({
                        "useCountdown.useCallback[start]": (prev)=>{
                            if (prev <= 1) {
                                clear();
                                setRunning(false);
                                return 0;
                            }
                            return prev - 1;
                        }
                    }["useCountdown.useCallback[start]"]);
                }
            }["useCountdown.useCallback[start]"], 1000);
        }
    }["useCountdown.useCallback[start]"], [
        clear
    ]);
    const pause = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useCountdown.useCallback[pause]": ()=>{
            setRunning(false);
            clear();
        }
    }["useCountdown.useCallback[pause]"], [
        clear
    ]);
    const reset = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useCountdown.useCallback[reset]": (resetSeconds)=>{
            clear();
            setRunning(false);
            setCount(resetSeconds !== null && resetSeconds !== void 0 ? resetSeconds : seconds);
        }
    }["useCountdown.useCallback[reset]"], [
        clear,
        seconds
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useCountdown.useEffect": ()=>{
            return clear;
        }
    }["useCountdown.useEffect"], [
        clear
    ]);
    return {
        count,
        isRunning,
        start,
        pause,
        reset
    };
}
_s(useCountdown, "1NEiOPLoWapapNeZc+QOjksX7Uc=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-mounted.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useMounted",
    ()=>useMounted
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useMounted() {
    _s();
    const [mounted, setMounted] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useMounted.useEffect": ()=>setMounted(true)
    }["useMounted.useEffect"], []);
    return mounted;
}
_s(useMounted, "LrrVfNW3d1raFE0BNzCTILYmIfo=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-clipboard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createUseClipboard",
    ()=>createUseClipboard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
function createUseClipboard(impl) {
    var _s = __turbopack_context__.k.signature();
    return _s(function useClipboard() {
        _s();
        const [lastCopied, setLastCopied] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
        const copy = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseClipboard.useClipboard.useCallback[copy]": async (text)=>{
                try {
                    const ok = await impl.writeText(text);
                    if (ok) setLastCopied(text);
                    return ok;
                } catch (e) {
                    return false;
                }
            }
        }["createUseClipboard.useClipboard.useCallback[copy]"], []);
        const read = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseClipboard.useClipboard.useCallback[read]": async ()=>{
                try {
                    if (!impl.readText) return '';
                    const text = await impl.readText();
                    setLastCopied(text);
                    return text;
                } catch (e) {
                    return '';
                }
            }
        }["createUseClipboard.useClipboard.useCallback[read]"], []);
        return {
            copy,
            read,
            lastCopied
        };
    }, "EG9BF+fgIEkcE6aOrswOyMfHlKc=");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-pagination.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "usePagination",
    ()=>usePagination
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function usePagination() {
    let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _s();
    const { total: propTotal = 0, pageSize = 10, initialPage = 1 } = options;
    const [page, setPageState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialPage);
    const [size, setSize] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](pageSize);
    const [total, setTotalState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](propTotal);
    // Sync total when prop changes(web 端用法:total 作为受控输入)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "usePagination.useEffect": ()=>{
            setTotalState(propTotal);
        }
    }["usePagination.useEffect"], [
        propTotal
    ]);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const setPage = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "usePagination.useCallback[setPage]": (p)=>{
            setPageState(Math.min(Math.max(1, p), totalPages));
        }
    }["usePagination.useCallback[setPage]"], [
        totalPages
    ]);
    const setPageSize = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "usePagination.useCallback[setPageSize]": (s)=>{
            setSize(s);
            setPageState(1);
        }
    }["usePagination.useCallback[setPageSize]"], []);
    const next = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "usePagination.useCallback[next]": ()=>{
            setPageState({
                "usePagination.useCallback[next]": (p)=>Math.min(p + 1, totalPages)
            }["usePagination.useCallback[next]"]);
        }
    }["usePagination.useCallback[next]"], [
        totalPages
    ]);
    const prev = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "usePagination.useCallback[prev]": ()=>{
            setPageState({
                "usePagination.useCallback[prev]": (p)=>Math.max(p - 1, 1)
            }["usePagination.useCallback[prev]"]);
        }
    }["usePagination.useCallback[prev]"], []);
    const reset = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "usePagination.useCallback[reset]": ()=>{
            setPageState(1);
        }
    }["usePagination.useCallback[reset]"], []);
    const setTotal = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "usePagination.useCallback[setTotal]": (t)=>{
            setTotalState(t);
        }
    }["usePagination.useCallback[setTotal]"], []);
    return {
        page,
        pageSize: size,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        setPage,
        setPageSize,
        setTotal,
        next,
        prev,
        reset
    };
}
_s(usePagination, "vDT06vTJVTEYM67KlqacPIf8Qb4=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-auth.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useAuth(options) {
    _s();
    const { store, bindTransport, fetchProfile, logoutApi, autoBind = true } = options;
    // user 独立管理(不放入 store,因各端 user 持久化策略不同)
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // token state 仅用于触发 React 重渲染(真值从 store 同步读取)
    const [tokenVersion, setTokenVersion] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [ready, setReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // 挂载时绑定 transport
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAuth.useEffect": ()=>{
            if (autoBind && bindTransport) {
                bindTransport(store);
            }
            setReady(true);
        }
    }["useAuth.useEffect"], [
        store,
        bindTransport,
        autoBind
    ]);
    // 从 store 同步读取 token(内存缓存,无 async)
    const token = store.getToken();
    const refreshToken = store.getRefreshToken();
    // tokenVersion 仅用于触发 React 重渲染(setTokenVersion 在 login/logout 中调用)
    // void 显式消费,避免"未使用变量"警告
    void tokenVersion;
    const isAuthenticated = !!token;
    const login = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAuth.useCallback[login]": async (newToken, newRefreshToken, newUser)=>{
            await store.setToken(newToken);
            if (newRefreshToken !== undefined) {
                await store.setRefreshToken(newRefreshToken);
            }
            setTokenVersion({
                "useAuth.useCallback[login]": (v)=>v + 1
            }["useAuth.useCallback[login]"]);
            if (newUser) {
                setUser(newUser);
            } else if (fetchProfile) {
                const res = await fetchProfile();
                if (res.success && res.data) {
                    setUser(res.data);
                }
            }
        }
    }["useAuth.useCallback[login]"], [
        store,
        fetchProfile
    ]);
    const logout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAuth.useCallback[logout]": async ()=>{
            var _store_clearAll;
            const rt = store.getRefreshToken();
            if (logoutApi && rt) {
                try {
                    await logoutApi(rt);
                } catch (e) {
                // 后端 logout 失败不阻塞本地清理
                }
            }
            await ((_store_clearAll = store.clearAll) === null || _store_clearAll === void 0 ? void 0 : _store_clearAll.call(store));
            setUser(null);
            setTokenVersion({
                "useAuth.useCallback[logout]": (v)=>v + 1
            }["useAuth.useCallback[logout]"]);
        }
    }["useAuth.useCallback[logout]"], [
        store,
        logoutApi
    ]);
    const refresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAuth.useCallback[refresh]": async ()=>{
            // 默认不实现,各端按需注入 refresh 逻辑
            // web/extension 可通过 useCallback 闭包注入 chrome.alarms / cookie refresh
            return false;
        }
    }["useAuth.useCallback[refresh]"], []);
    return {
        user,
        token,
        refreshToken,
        isAuthenticated,
        ready,
        login,
        logout,
        refresh,
        setUser
    };
} //# sourceMappingURL=use-auth.js.map
_s(useAuth, "FZEcFwOXIMKzZqBphb6kKeLtA4Q=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-agents.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * useAgents — 跨端 Agent 列表管理业务 Hook
 *
 * 设计原则(参照 usePagination):
 * 1. 纯逻辑层:只管 agents 列表状态 + 选中态 + loading,不绑定具体 transport
 * 2. 依赖注入:fetchers 由各端注入(web 用 fetchApi / miniapp-taro 用 get<T> / mobile-rn + extension 用 @ihui/api-client)
 * 3. 零新依赖:纯 useState + useEffect + useCallback,不引入 react-query / swr / zustand
 * 4. 非破坏性:与各端现有 useAgent / useAgents 平行存在,可通过 re-export 桥接
 *
 * 各端接入示例:
 * ```ts
 * // mobile-rn
 * import { useAgents } from '@ihui/shared/hooks'
 * import { fetchAgentList, fetchAgentDetail } from '../api/agents'
 *
 * const { agents, currentAgent, loading, error, load, selectById, refresh } = useAgents({
 *   fetchList: fetchAgentList,
 *   fetchDetail: fetchAgentDetail,
 * })
 *
 * // web (桥接版,内部仍用 react-query,对外接口与本 hook 一致)
 * // miniapp-taro (用 Taro.request 封装的 get<T>)
 * ```
 *
 * 与 web 端现有 `apps/web/src/hooks/use-agent.ts` 的差异:
 * - web 版:createAgent 改造逻辑耦合,fetchApi 硬编码
 * - 本 hook:仅列表 + 选中态管理,createAgent 留给各端自实现(避免跨端 API 路径差异)
 */ __turbopack_context__.s([
    "useAgents",
    ()=>useAgents
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useAgents(options) {
    _s();
    const { fetchList, fetchDetail, autoLoad = true } = options;
    const [agents, setAgents] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]([]);
    const [currentAgent, setCurrentAgent] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const [loading, setLoading] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [error, setError] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const load = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgents.useCallback[load]": async ()=>{
            setLoading(true);
            setError(null);
            try {
                const res = await fetchList();
                var _res_list;
                setAgents((_res_list = res.list) !== null && _res_list !== void 0 ? _res_list : []);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally{
                setLoading(false);
            }
        }
    }["useAgents.useCallback[load]"], [
        fetchList
    ]);
    const refresh = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgents.useCallback[refresh]": async ()=>{
            return load();
        }
    }["useAgents.useCallback[refresh]"], [
        load
    ]);
    const findById = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgents.useCallback[findById]": (id)=>agents.find({
                "useAgents.useCallback[findById]": (a)=>a.id === id
            }["useAgents.useCallback[findById]"])
    }["useAgents.useCallback[findById]"], [
        agents
    ]);
    const selectById = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgents.useCallback[selectById]": async (id)=>{
            // 先从本地查
            const local = agents.find({
                "useAgents.useCallback[selectById].local": (a)=>a.id === id
            }["useAgents.useCallback[selectById].local"]);
            if (local) {
                setCurrentAgent(local);
                return;
            }
            // 本地无则拉详情
            if (!fetchDetail) {
                setError("Agent ".concat(id, " not found in local list and no fetchDetail provided"));
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const detail = await fetchDetail(id);
                setCurrentAgent(detail);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally{
                setLoading(false);
            }
        }
    }["useAgents.useCallback[selectById]"], [
        agents,
        fetchDetail
    ]);
    const clearSelection = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgents.useCallback[clearSelection]": ()=>{
            setCurrentAgent(null);
        }
    }["useAgents.useCallback[clearSelection]"], []);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useAgents.useEffect": ()=>{
            if (autoLoad) {
                void load();
            }
        }
    }["useAgents.useEffect"], [
        autoLoad,
        load
    ]);
    return {
        agents,
        currentAgent,
        loading,
        error,
        load,
        refresh,
        selectById,
        clearSelection,
        findById,
        setAgents
    };
}
_s(useAgents, "kMHA1ygZ/cpFj/j2y4Zto35FA+E=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-articles.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * useArticles — 跨端文章列表管理业务 Hook
 *
 * 设计原则(参照 usePagination + useAgents):
 * 1. 纯逻辑层:只管 articles 列表 + 分页 + 筛选状态,不绑定具体 transport
 * 2. 依赖注入:fetcher 由各端注入(web 用 fetchApi / miniapp-taro 用 get<T>)
 * 3. 零新依赖:纯 useState + useEffect + useCallback
 * 4. 非破坏性:与各端现有 articles hook 平行存在
 *
 * 各端接入示例:
 * ```ts
 * import { useArticles } from '@ihui/shared/hooks'
 *
 * const {
 *   articles, page, total, categoryId, status, search,
 *   loading, loadingMore, hasNext,
 *   setCategoryId, setStatus, setSearch, setPage,
 *   load, loadMore, refresh,
 * } = useArticles({
 *   fetcher: async (params) => {
 *     const res = await fetchApi('/api/articles/list', { params })
 *     return { list: res.data.list, total: res.data.total }
 *   },
 * })
 * ```
 */ __turbopack_context__.s([
    "useArticles",
    ()=>useArticles
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useArticles(options) {
    _s();
    const { fetcher, pageSize: defaultPageSize = 10, autoLoad = true, initialCategoryId = 'all', initialStatus = 'all' } = options;
    const [articles, setArticles] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]([]);
    const [page, setPageState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](1);
    const [pageSize] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](defaultPageSize);
    const [total, setTotal] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](0);
    const [categoryId, setCategoryIdState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialCategoryId);
    const [status, setStatusState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialStatus);
    const [search, setSearchState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]('');
    const [loading, setLoading] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [loadingMore, setLoadingMore] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [error, setError] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const hasNext = page < totalPages;
    const buildParams = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[buildParams]": (overridePage)=>({
                page: overridePage !== null && overridePage !== void 0 ? overridePage : page,
                pageSize,
                categoryId: categoryId === 'all' ? undefined : categoryId,
                status: status === 'all' ? undefined : status,
                search: search.trim() || undefined
            })
    }["useArticles.useCallback[buildParams]"], [
        page,
        pageSize,
        categoryId,
        status,
        search
    ]);
    const load = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[load]": async ()=>{
            setLoading(true);
            setError(null);
            try {
                const res = await fetcher(buildParams(1));
                var _res_list;
                setArticles((_res_list = res.list) !== null && _res_list !== void 0 ? _res_list : []);
                var _res_total;
                setTotal((_res_total = res.total) !== null && _res_total !== void 0 ? _res_total : 0);
                setPageState(1);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally{
                setLoading(false);
            }
        }
    }["useArticles.useCallback[load]"], [
        fetcher,
        buildParams
    ]);
    const loadMore = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[loadMore]": async ()=>{
            if (!hasNext || loadingMore) return;
            setLoadingMore(true);
            setError(null);
            try {
                const nextPage = page + 1;
                const res = await fetcher(buildParams(nextPage));
                setArticles({
                    "useArticles.useCallback[loadMore]": (prev)=>{
                        var _res_list;
                        return [
                            ...prev,
                            ...(_res_list = res.list) !== null && _res_list !== void 0 ? _res_list : []
                        ];
                    }
                }["useArticles.useCallback[loadMore]"]);
                var _res_total;
                setTotal((_res_total = res.total) !== null && _res_total !== void 0 ? _res_total : 0);
                setPageState(nextPage);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally{
                setLoadingMore(false);
            }
        }
    }["useArticles.useCallback[loadMore]"], [
        hasNext,
        loadingMore,
        page,
        fetcher,
        buildParams
    ]);
    const refresh = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[refresh]": async ()=>{
            return load();
        }
    }["useArticles.useCallback[refresh]"], [
        load
    ]);
    const setPage = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[setPage]": (p)=>{
            setPageState(Math.min(Math.max(1, p), totalPages));
        }
    }["useArticles.useCallback[setPage]"], [
        totalPages
    ]);
    const setCategoryId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[setCategoryId]": (c)=>{
            setCategoryIdState(c);
        }
    }["useArticles.useCallback[setCategoryId]"], []);
    const setStatus = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[setStatus]": (s)=>{
            setStatusState(s);
        }
    }["useArticles.useCallback[setStatus]"], []);
    const setSearch = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[setSearch]": (s)=>{
            setSearchState(s);
        }
    }["useArticles.useCallback[setSearch]"], []);
    const resetFilters = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useArticles.useCallback[resetFilters]": ()=>{
            setCategoryIdState('all');
            setStatusState('all');
            setSearchState('');
        }
    }["useArticles.useCallback[resetFilters]"], []);
    // 挂载时 + categoryId / status 变化时重新加载(重置到第 1 页)
    // 单 effect 避免挂载时重复触发(原两 effect 模式挂载触发 2 次 load,合并后只 1 次)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useArticles.useEffect": ()=>{
            if (!autoLoad) return;
            void load();
        }
    }["useArticles.useEffect"], [
        categoryId,
        status,
        autoLoad,
        load
    ]);
    return {
        articles,
        page,
        pageSize,
        total,
        totalPages,
        hasNext,
        categoryId,
        status,
        search,
        loading,
        loadingMore,
        error,
        load,
        loadMore,
        refresh,
        setPage,
        setCategoryId,
        setStatus,
        setSearch,
        resetFilters,
        setArticles
    };
}
_s(useArticles, "gFoEnLgwMZBUi6yLg6l4AJqUyd0=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-chat.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * useChat — 跨端聊天消息管理业务 Hook
 *
 * 设计原则(参照 useAuth + useAgents):
 * 1. 纯逻辑层:只管 messages 列表 + streaming 状态 + error,hook 内部不调 streamChat
 * 2. 依赖注入:streamRunner 由各端注入(各端调 @ihui/api-client 的 streamChat 并桥接到本 hook)
 * 3. 零新依赖:纯 useState + useRef + useCallback
 * 4. 非破坏性:与各端现有 chat hook 平行存在
 *
 * 跨端差异处理:
 * - SSE 流:统一用 @ihui/api-client 的 streamChat(api-client 已封装跨端 SSE 解析)
 * - 错误格式化:各端注入 formatError(可选,默认 String(err))
 * - 消息持久化:各端在 onDone/onError 回调中自行调持久化 API
 *
 * 各端接入示例:
 * ```ts
 * import { useChat } from '@ihui/shared/hooks'
 * import { streamChat, formatSSEError } from '@ihui/api-client'
 *
 * const {
 *   messages, isStreaming, error,
 *   sendMessage, stopStreaming, clearMessages, setMessages,
 * } = useChat({
 *   streamRunner: async (opts) => {
 *     await streamChat({
 *       model: opts.model,
 *       messages: opts.apiMessages,
 *       signal: opts.signal,
 *       onDelta: opts.onDelta,
 *       onError: opts.onError,
 *       onDone: opts.onDone,
 *     })
 *   },
 *   formatError: (err) => formatSSEError(err).message,
 * })
 *
 * await sendMessage({ model, text: '你好' })
 * ```
 */ __turbopack_context__.s([
    "useChat",
    ()=>useChat
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useChat(options) {
    _s();
    const { streamRunner, formatError = (err)=>String(err), clearAssistantOnError = false } = options;
    const [messages, setMessages] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]([]);
    const [isStreaming, setIsStreaming] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [error, setError] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    // abort controller ref(stopStreaming 用)
    const abortRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    // 消息 id 自增 ref(避免使用 Date.now() 在快速连续发送时 id 冲突)
    const idCounterRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](0);
    const nextId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useChat.useCallback[nextId]": (prefix)=>{
            idCounterRef.current += 1;
            return "".concat(prefix, "-").concat(idCounterRef.current);
        }
    }["useChat.useCallback[nextId]"], []);
    const sendMessage = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useChat.useCallback[sendMessage]": async (params)=>{
            const { model, text, systemPrompt, contextLimit, meta } = params;
            const trimmed = text.trim();
            if (!trimmed || isStreaming) return;
            setError(null);
            // 构造 user 消息
            const userMsg = {
                id: nextId('u'),
                role: 'user',
                content: trimmed,
                createdAt: Date.now(),
                meta
            };
            // 构造 assistant 占位消息
            const assistantId = nextId('a');
            const assistantMsg = {
                id: assistantId,
                role: 'assistant',
                content: '',
                createdAt: Date.now()
            };
            // 更新消息列表(追加 user + assistant 占位)
            const baseMessages = [
                ...messages,
                userMsg,
                assistantMsg
            ];
            setMessages(baseMessages);
            setIsStreaming(true);
            // 构造 API 消息(含历史 + 当前 user 消息,不含 assistant 占位)
            const apiMessages = baseMessages.filter({
                "useChat.useCallback[sendMessage].apiMessages": (m)=>m.id !== assistantId
            }["useChat.useCallback[sendMessage].apiMessages"]).filter({
                "useChat.useCallback[sendMessage].apiMessages": (m)=>m.content || m.role === 'user'
            }["useChat.useCallback[sendMessage].apiMessages"]).map({
                "useChat.useCallback[sendMessage].apiMessages": (m)=>({
                        role: m.role,
                        content: m.content || ' '
                    })
            }["useChat.useCallback[sendMessage].apiMessages"]);
            // 可选 systemPrompt 注入到开头
            if (systemPrompt) {
                apiMessages.unshift({
                    role: 'system',
                    content: systemPrompt
                });
            }
            // 创建 abort controller
            const controller = new AbortController();
            abortRef.current = controller;
            // delta 累积到 assistant 消息
            const onDelta = {
                "useChat.useCallback[sendMessage].onDelta": (delta)=>{
                    setMessages({
                        "useChat.useCallback[sendMessage].onDelta": (prev)=>{
                            const copy = [
                                ...prev
                            ];
                            const last = copy[copy.length - 1];
                            if (last && last.role === 'assistant') {
                                copy[copy.length - 1] = {
                                    ...last,
                                    content: last.content + delta
                                };
                            }
                            return copy;
                        }
                    }["useChat.useCallback[sendMessage].onDelta"]);
                }
            }["useChat.useCallback[sendMessage].onDelta"];
            const onError = {
                "useChat.useCallback[sendMessage].onError": (err)=>{
                    const msg = formatError(err);
                    setError(msg);
                    setIsStreaming(false);
                    abortRef.current = null;
                    if (clearAssistantOnError) {
                        // 清空 assistant 占位
                        setMessages({
                            "useChat.useCallback[sendMessage].onError": (prev)=>prev.slice(0, -1)
                        }["useChat.useCallback[sendMessage].onError"]);
                    } else {
                        // 保留占位,填充错误信息
                        setMessages({
                            "useChat.useCallback[sendMessage].onError": (prev)=>{
                                const copy = [
                                    ...prev
                                ];
                                const last = copy[copy.length - 1];
                                if (last && last.role === 'assistant' && !last.content) {
                                    copy[copy.length - 1] = {
                                        ...last,
                                        content: "⚠ ".concat(msg)
                                    };
                                }
                                return copy;
                            }
                        }["useChat.useCallback[sendMessage].onError"]);
                    }
                }
            }["useChat.useCallback[sendMessage].onError"];
            const onDone = {
                "useChat.useCallback[sendMessage].onDone": ()=>{
                    setIsStreaming(false);
                    abortRef.current = null;
                }
            }["useChat.useCallback[sendMessage].onDone"];
            try {
                await streamRunner({
                    model,
                    apiMessages,
                    signal: controller.signal,
                    contextLimit,
                    callbacks: {
                        onDelta,
                        onError,
                        onDone
                    }
                });
            } catch (err) {
                // streamRunner 抛异常(非 SSE 内部错误,如网络断开)
                onError(err);
            }
        }
    }["useChat.useCallback[sendMessage]"], [
        messages,
        isStreaming,
        streamRunner,
        formatError,
        clearAssistantOnError,
        nextId
    ]);
    const stopStreaming = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useChat.useCallback[stopStreaming]": ()=>{
            var _abortRef_current;
            (_abortRef_current = abortRef.current) === null || _abortRef_current === void 0 ? void 0 : _abortRef_current.abort();
            abortRef.current = null;
            setIsStreaming(false);
        }
    }["useChat.useCallback[stopStreaming]"], []);
    const clearMessages = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useChat.useCallback[clearMessages]": ()=>{
            var _abortRef_current;
            setMessages([]);
            setError(null);
            setIsStreaming(false);
            (_abortRef_current = abortRef.current) === null || _abortRef_current === void 0 ? void 0 : _abortRef_current.abort();
            abortRef.current = null;
        }
    }["useChat.useCallback[clearMessages]"], []);
    return {
        messages,
        isStreaming,
        error,
        sendMessage,
        stopStreaming,
        clearMessages,
        setMessages,
        setError
    };
}
_s(useChat, "7FIbQvgEDX02xeA1PGCR3w86CY4=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-load-more.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLoadMore",
    ()=>useLoadMore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useLoadMore(fetch) {
    _s();
    const pageRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(1);
    const loadingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const loadMore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLoadMore.useCallback[loadMore]": async ()=>{
            if (loadingRef.current) return;
            loadingRef.current = true;
            const hasMore = await fetch(pageRef.current);
            if (hasMore) pageRef.current++;
            loadingRef.current = false;
        }
    }["useLoadMore.useCallback[loadMore]"], [
        fetch
    ]);
    const reset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLoadMore.useCallback[reset]": ()=>{
            pageRef.current = 1;
        }
    }["useLoadMore.useCallback[reset]"], []);
    return {
        loadMore,
        reset
    };
}
_s(useLoadMore, "UV22yK6/la+BVSAC/oi3Ii5np6M=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-social-list.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSocialList",
    ()=>useSocialList
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useSocialList(options) {
    _s();
    const { fetch, pageSize = 20 } = options;
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [hasMore, setHasMore] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const pageRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(1);
    const loadingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const load = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useSocialList.useCallback[load]": async function() {
            let reset = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : false;
            if (loadingRef.current) return;
            if (reset) {
                pageRef.current = 1;
                setHasMore(true);
                setItems([]);
            }
            if (!hasMore && !reset) return;
            loadingRef.current = true;
            setLoading(true);
            try {
                const res = await fetch({
                    page: pageRef.current,
                    pageSize
                });
                const list = res.list || [];
                setItems({
                    "useSocialList.useCallback[load]": (prev)=>reset ? list : [
                            ...prev,
                            ...list
                        ]
                }["useSocialList.useCallback[load]"]);
                const more = pageRef.current * pageSize < res.total;
                setHasMore(more);
                if (more) pageRef.current++;
            } finally{
                loadingRef.current = false;
                setLoading(false);
            }
        }
    }["useSocialList.useCallback[load]"], [
        fetch,
        pageSize,
        hasMore
    ]);
    const removeItem = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useSocialList.useCallback[removeItem]": (id)=>{
            setItems({
                "useSocialList.useCallback[removeItem]": (prev)=>prev.filter({
                        "useSocialList.useCallback[removeItem]": (item)=>item.id !== id
                    }["useSocialList.useCallback[removeItem]"])
            }["useSocialList.useCallback[removeItem]"]);
        }
    }["useSocialList.useCallback[removeItem]"], []);
    return {
        items,
        loading,
        hasMore,
        load,
        removeItem
    };
}
_s(useSocialList, "1XPY3An8JQhk7RFtHrQtUEya19o=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-paginated-list.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "usePaginatedList",
    ()=>usePaginatedList
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function usePaginatedList(fetcher) {
    let pageSize = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 20;
    _s();
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [refreshing, setRefreshing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [loadingMore, setLoadingMore] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [page, setPage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(1);
    const [total, setTotal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const fetch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "usePaginatedList.useCallback[fetch]": async (nextPage, isRefresh)=>{
            if (nextPage === 1) {
                if (isRefresh) setRefreshing(true);
                else setLoading(true);
            } else {
                setLoadingMore(true);
            }
            setError('');
            const res = await fetcher({
                page: nextPage,
                pageSize
            });
            if (res.success) {
                setItems({
                    "usePaginatedList.useCallback[fetch]": (prev)=>nextPage === 1 ? res.data.list : [
                            ...prev,
                            ...res.data.list
                        ]
                }["usePaginatedList.useCallback[fetch]"]);
                setTotal(res.data.total);
                setPage(nextPage);
            } else {
                setError(res.error || '加载失败');
            }
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }["usePaginatedList.useCallback[fetch]"], [
        fetcher,
        pageSize
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePaginatedList.useEffect": ()=>{
            void fetch(1, false);
        }
    }["usePaginatedList.useEffect"], [
        fetch
    ]);
    const refresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "usePaginatedList.useCallback[refresh]": ()=>{
            void fetch(1, true);
        }
    }["usePaginatedList.useCallback[refresh]"], [
        fetch
    ]);
    const loadMore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "usePaginatedList.useCallback[loadMore]": ()=>{
            if (loadingMore || items.length >= total) return;
            void fetch(page + 1, false);
        }
    }["usePaginatedList.useCallback[loadMore]"], [
        fetch,
        loadingMore,
        items.length,
        total,
        page
    ]);
    const removeItem = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "usePaginatedList.useCallback[removeItem]": (predicate)=>{
            setItems({
                "usePaginatedList.useCallback[removeItem]": (prev)=>prev.filter({
                        "usePaginatedList.useCallback[removeItem]": (item)=>!predicate(item)
                    }["usePaginatedList.useCallback[removeItem]"])
            }["usePaginatedList.useCallback[removeItem]"]);
            setTotal({
                "usePaginatedList.useCallback[removeItem]": (prev)=>Math.max(0, prev - 1)
            }["usePaginatedList.useCallback[removeItem]"]);
        }
    }["usePaginatedList.useCallback[removeItem]"], []);
    return {
        items,
        loading,
        refreshing,
        loadingMore,
        error,
        page,
        total,
        refresh,
        loadMore,
        removeItem
    };
} //# sourceMappingURL=use-paginated-list.js.map
_s(usePaginatedList, "3THk/AfbK56bWswyIhnkx28ULY4=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-auto-play.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAutoPlay",
    ()=>useAutoPlay
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useAutoPlay(total, interval, enabled) {
    _s();
    const [current, setCurrent] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](0);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "useAutoPlay.useEffect": ()=>{
            if (!enabled || total <= 1) return;
            const timer = setInterval({
                "useAutoPlay.useEffect.timer": ()=>{
                    setCurrent({
                        "useAutoPlay.useEffect.timer": (prev)=>(prev + 1) % total
                    }["useAutoPlay.useEffect.timer"]);
                }
            }["useAutoPlay.useEffect.timer"], interval);
            return ({
                "useAutoPlay.useEffect": ()=>clearInterval(timer)
            })["useAutoPlay.useEffect"];
        }
    }["useAutoPlay.useEffect"], [
        enabled,
        interval,
        total
    ]);
    return {
        current,
        setCurrent
    };
}
_s(useAutoPlay, "Ce5S7Zpl2S4YgGoPn+G4m52qKq8=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-agent-runtime.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAgentRuntime",
    ()=>useAgentRuntime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$agent$2d$runtime$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/agent-runtime.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useAgentRuntime(initialSessionId) {
    _s();
    const [status, setStatus] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]('idle');
    const [input, setInput] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]('');
    const [sessionId, setSessionId] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialSessionId !== null && initialSessionId !== void 0 ? initialSessionId : null);
    const [plan, setPlan] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const [output, setOutput] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]('');
    const [error, setError] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const [permission, setPermission] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const abortRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const handleSend = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgentRuntime.useCallback[handleSend]": async ()=>{
            const message = input.trim();
            if (!message || status === 'running') return;
            setStatus('running');
            setPlan(null);
            setOutput('');
            setError(null);
            setPermission(null);
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$agent$2d$runtime$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["executeAgentRuntimeStream"])({
                    message,
                    mode: 'default',
                    sessionId: sessionId !== null && sessionId !== void 0 ? sessionId : undefined
                }, {
                    onSession: {
                        "useAgentRuntime.useCallback[handleSend]": (data)=>setSessionId(data.sessionId)
                    }["useAgentRuntime.useCallback[handleSend]"],
                    onPlan: {
                        "useAgentRuntime.useCallback[handleSend]": (data)=>setPlan(data.plan)
                    }["useAgentRuntime.useCallback[handleSend]"],
                    onDelta: {
                        "useAgentRuntime.useCallback[handleSend]": (data)=>setOutput({
                                "useAgentRuntime.useCallback[handleSend]": (prev)=>prev + data.content
                            }["useAgentRuntime.useCallback[handleSend]"])
                    }["useAgentRuntime.useCallback[handleSend]"],
                    onPermission: {
                        "useAgentRuntime.useCallback[handleSend]": (data)=>setPermission(data)
                    }["useAgentRuntime.useCallback[handleSend]"],
                    onDone: {
                        "useAgentRuntime.useCallback[handleSend]": (data)=>{
                            setStatus('completed');
                            if (data.summary) setOutput(data.summary);
                        }
                    }["useAgentRuntime.useCallback[handleSend]"],
                    onError: {
                        "useAgentRuntime.useCallback[handleSend]": (data)=>{
                            setError(data.message);
                            setStatus('failed');
                        }
                    }["useAgentRuntime.useCallback[handleSend]"]
                }, {
                    signal: controller.signal
                });
            } catch (err) {
                if (controller.signal.aborted) {
                    setStatus('idle');
                } else {
                    setError(err instanceof Error ? err.message : String(err));
                    setStatus('failed');
                }
            } finally{
                abortRef.current = null;
            }
        }
    }["useAgentRuntime.useCallback[handleSend]"], [
        input,
        status,
        sessionId
    ]);
    const handleStop = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgentRuntime.useCallback[handleStop]": ()=>{
            var _abortRef_current;
            (_abortRef_current = abortRef.current) === null || _abortRef_current === void 0 ? void 0 : _abortRef_current.abort();
            setStatus('idle');
        }
    }["useAgentRuntime.useCallback[handleStop]"], []);
    const handleClear = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useAgentRuntime.useCallback[handleClear]": ()=>{
            setStatus('idle');
            setInput('');
            setSessionId(null);
            setPlan(null);
            setOutput('');
            setError(null);
            setPermission(null);
        }
    }["useAgentRuntime.useCallback[handleClear]"], []);
    return {
        status,
        input,
        setInput,
        sessionId,
        plan,
        output,
        error,
        permission,
        handleSend,
        handleStop,
        handleClear
    };
} //# sourceMappingURL=use-agent-runtime.js.map
_s(useAgentRuntime, "E6KqWf3B+0hD9L4qqAqZRCoJDVU=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-confirm-dialog.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useConfirmDialog",
    ()=>useConfirmDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
const INITIAL = {
    open: false,
    title: '确认操作',
    description: undefined,
    confirmText: '确认',
    cancelText: '取消',
    variant: 'default',
    resolve: null
};
function useConfirmDialog() {
    _s();
    const [state, setState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](INITIAL);
    const confirm = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useConfirmDialog.useCallback[confirm]": (options)=>{
            return new Promise({
                "useConfirmDialog.useCallback[confirm]": (resolve)=>{
                    var _options_title, _options_confirmText, _options_cancelText, _options_variant;
                    setState({
                        open: true,
                        title: (_options_title = options === null || options === void 0 ? void 0 : options.title) !== null && _options_title !== void 0 ? _options_title : '确认操作',
                        description: options === null || options === void 0 ? void 0 : options.description,
                        confirmText: (_options_confirmText = options === null || options === void 0 ? void 0 : options.confirmText) !== null && _options_confirmText !== void 0 ? _options_confirmText : '确认',
                        cancelText: (_options_cancelText = options === null || options === void 0 ? void 0 : options.cancelText) !== null && _options_cancelText !== void 0 ? _options_cancelText : '取消',
                        variant: (_options_variant = options === null || options === void 0 ? void 0 : options.variant) !== null && _options_variant !== void 0 ? _options_variant : 'default',
                        resolve
                    });
                }
            }["useConfirmDialog.useCallback[confirm]"]);
        }
    }["useConfirmDialog.useCallback[confirm]"], []);
    const handleClose = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useConfirmDialog.useCallback[handleClose]": (result)=>{
            setState({
                "useConfirmDialog.useCallback[handleClose]": (prev)=>{
                    var _prev_resolve;
                    (_prev_resolve = prev.resolve) === null || _prev_resolve === void 0 ? void 0 : _prev_resolve.call(prev, result);
                    return INITIAL;
                }
            }["useConfirmDialog.useCallback[handleClose]"]);
        }
    }["useConfirmDialog.useCallback[handleClose]"], []);
    return {
        open: state.open,
        title: state.title,
        description: state.description,
        confirmText: state.confirmText,
        cancelText: state.cancelText,
        variant: state.variant,
        confirm,
        handleConfirm: ()=>handleClose(true),
        handleCancel: ()=>handleClose(false)
    };
}
_s(useConfirmDialog, "LW/do+rpGN4B8oA1FNRfSE0HznU=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-form.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useForm",
    ()=>useForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function useForm(options) {
    _s();
    const { initial, schema, validateOn = 'onSubmit' } = options;
    const [values, setValuesState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initial);
    const [errors, setErrors] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]({});
    const [touched, setTouchedState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]({});
    const [isSubmitting, setIsSubmitting] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const initialValuesRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](initial);
    const dirty = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "useForm.useMemo[dirty]": ()=>JSON.stringify(values) !== JSON.stringify(initialValuesRef.current)
    }["useForm.useMemo[dirty]"], [
        values
    ]);
    const runValidation = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useForm.useCallback[runValidation]": (fieldValues, field)=>{
            if (!schema) {
                setErrors({});
                return true;
            }
            const result = schema.safeParse(fieldValues);
            if (result.success) {
                setErrors({});
                return true;
            }
            const fieldErrors = {};
            for (const issue of result.error.issues){
                const key = issue.path[0];
                if (key && !fieldErrors[key]) {
                    fieldErrors[key] = issue.message;
                }
            }
            if (field) {
                setErrors({
                    "useForm.useCallback[runValidation]": (prev)=>({
                            ...prev,
                            [field]: fieldErrors[field]
                        })
                }["useForm.useCallback[runValidation]"]);
            } else {
                setErrors(fieldErrors);
            }
            return result.success;
        }
    }["useForm.useCallback[runValidation]"], [
        schema
    ]);
    const setField = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useForm.useCallback[setField]": (name, value)=>{
            const newValues = {
                ...values,
                [name]: value
            };
            setValuesState(newValues);
            if (validateOn === 'onChange') {
                runValidation(newValues, name);
            } else {
                setErrors({
                    "useForm.useCallback[setField]": (prev)=>({
                            ...prev,
                            [name]: undefined
                        })
                }["useForm.useCallback[setField]"]);
            }
        }
    }["useForm.useCallback[setField]"], [
        values,
        validateOn,
        runValidation
    ]);
    const setValues = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useForm.useCallback[setValues]": (partial)=>{
            setValuesState({
                "useForm.useCallback[setValues]": (prev)=>({
                        ...prev,
                        ...partial
                    })
            }["useForm.useCallback[setValues]"]);
        }
    }["useForm.useCallback[setValues]"], []);
    const setTouched = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useForm.useCallback[setTouched]": function(name) {
            let isTouched = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
            setTouchedState({
                "useForm.useCallback[setTouched]": (prev)=>({
                        ...prev,
                        [name]: isTouched
                    })
            }["useForm.useCallback[setTouched]"]);
            if (validateOn === 'onBlur' && isTouched) {
                runValidation(values, name);
            }
        }
    }["useForm.useCallback[setTouched]"], [
        validateOn,
        values,
        runValidation
    ]);
    const validate = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useForm.useCallback[validate]": ()=>{
            return runValidation(values);
        }
    }["useForm.useCallback[validate]"], [
        runValidation,
        values
    ]);
    const reset = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useForm.useCallback[reset]": (resetValues)=>{
            const next = resetValues !== null && resetValues !== void 0 ? resetValues : initial;
            initialValuesRef.current = next;
            setValuesState(next);
            setErrors({});
            setTouchedState({});
            setIsSubmitting(false);
        }
    }["useForm.useCallback[reset]"], [
        initial
    ]);
    const handleSubmit = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "useForm.useCallback[handleSubmit]": (onValid)=>({
                "useForm.useCallback[handleSubmit]": async (e)=>{
                    e === null || e === void 0 ? void 0 : e.preventDefault();
                    if (validate()) {
                        setIsSubmitting(true);
                        try {
                            await onValid(values);
                        } finally{
                            setIsSubmitting(false);
                        }
                    }
                }
            })["useForm.useCallback[handleSubmit]"]
    }["useForm.useCallback[handleSubmit]"], [
        validate,
        values
    ]);
    return {
        values,
        errors,
        touched,
        dirty,
        isSubmitting,
        setField,
        setValues,
        setTouched,
        validate,
        reset,
        handleSubmit
    };
}
_s(useForm, "RFz5kum27JgbbBJIpdbz+nagv4Q=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-login-form.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLoginForm",
    ()=>useLoginForm
]);
/**
 * @ihui/shared/hooks/use-login-form — 跨端共享登录表单 Hook(2026-07-29 立)
 *
 * 设计原则(与 useAuth 一致):
 * 1. 依赖注入:各端必须传入 loginApi / storage / onLoginSuccess,不内置任何平台 API
 * 2. 零新依赖:纯 useState + useCallback,不引入 zustand(兼容 extension MV3 / mobile-rn Hermes / Taro 小程序)
 * 3. 非破坏性:与各端现有登录组件平行存在,可通过接入消除重复的 useState + handleLogin 逻辑
 * 4. UI 无关:只提供状态 + 操作函数,各端 UI 自由绑定(web shadcn / RN Pressable / Taro View)
 *
 * 复用基础设施:
 * - 不重复造轮子:各端可通过 onLoginSuccess 桥接 useAuth().login 写 token + user
 * - SSO 登录:各端注入 ssoLogin 函数即可,内部复用 @ihui/shared/auth/sso-core
 *
 * 各端接入示例:
 * - web: useLoginForm({ loginApi: (a,p) => fetchApi('/api/auth/login', {...}), storage: webStorage, onLoginSuccess: (t,r,u) => { setTokenWithPrefs(t,r,autoLogin); setUser(u) } })
 * - mobile-rn: useLoginForm({ loginApi: (a,p) => authApi.login(a,p), storage: rnStorage, onLoginSuccess: (t,r,u) => auth.login(t,r,u) })
 * - miniapp-taro: useLoginForm({ loginApi: (a,p) => loginByPassword(a,p), storage: taroStorage, onLoginSuccess: (t,r,u) => setAuth(t,u,r) })
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function useLoginForm(options) {
    _s();
    const { loginApi, storage, onLoginSuccess, ssoLogin, onSuccess, enableRemember = true, minAccountLength = 3, minPasswordLength = 6 } = options;
    // 初始化时加载已记住凭据(各端 UI 可据此回填表单)
    const [remembered] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "useLoginForm.useState": ()=>enableRemember ? storage.loadRemembered() : null
    }["useLoginForm.useState"]);
    var _remembered_account;
    const [account, setAccount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])((_remembered_account = remembered === null || remembered === void 0 ? void 0 : remembered.account) !== null && _remembered_account !== void 0 ? _remembered_account : '');
    var _remembered_password;
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])((_remembered_password = remembered === null || remembered === void 0 ? void 0 : remembered.password) !== null && _remembered_password !== void 0 ? _remembered_password : '');
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [ssoLoading, setSsoLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [rememberPassword, setRememberPasswordState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!!remembered);
    const [autoLogin, setAutoLoginState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(enableRemember && !!remembered && storage.loadAutoLogin());
    const clearError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLoginForm.useCallback[clearError]": ()=>setError(null)
    }["useLoginForm.useCallback[clearError]"], []);
    const setRememberPassword = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLoginForm.useCallback[setRememberPassword]": (v)=>{
            setRememberPasswordState(v);
            if (!v) {
                setAutoLoginState(false);
            }
        }
    }["useLoginForm.useCallback[setRememberPassword]"], []);
    const setAutoLogin = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLoginForm.useCallback[setAutoLogin]": (v)=>{
            if (v && !rememberPassword) {
                setRememberPasswordState(true);
            }
            setAutoLoginState(v);
        }
    }["useLoginForm.useCallback[setAutoLogin]"], [
        rememberPassword
    ]);
    const login = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLoginForm.useCallback[login]": async ()=>{
            setError(null);
            // 本地校验(与 web 端 loginSchema 一致:account >= 3, password >= 6)
            if (account.length < minAccountLength) {
                setError('auth.invalidAccount');
                return;
            }
            if (password.length < minPasswordLength) {
                setError('auth.invalidPassword');
                return;
            }
            setLoading(true);
            try {
                const result = await loginApi(account, password);
                if (!result.success || !result.accessToken) {
                    var _result_error;
                    setError((_result_error = result.error) !== null && _result_error !== void 0 ? _result_error : 'auth.loginFailed');
                    return;
                }
                // 保存/清除凭据 + 账号历史 + 自动登录标志(仅在启用记住密码时)
                if (enableRemember) {
                    if (rememberPassword) {
                        storage.saveRemembered(account, password);
                    } else {
                        storage.clearRemembered();
                        if (autoLogin) {
                            setAutoLoginState(false);
                            storage.clearAutoLogin();
                        }
                    }
                    storage.saveAutoLogin(autoLogin && rememberPassword);
                    storage.saveLoginHistory(account);
                }
                var _result_refreshToken;
                // 写 token + user(各端注入的回调)
                await onLoginSuccess(result.accessToken, (_result_refreshToken = result.refreshToken) !== null && _result_refreshToken !== void 0 ? _result_refreshToken : '', result.user);
                onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
            } catch (e) {
                setError('auth.loginFailed');
            } finally{
                setLoading(false);
            }
        }
    }["useLoginForm.useCallback[login]"], [
        account,
        password,
        loginApi,
        storage,
        onLoginSuccess,
        onSuccess,
        enableRemember,
        rememberPassword,
        autoLogin,
        minAccountLength,
        minPasswordLength
    ]);
    const ssoLoginAction = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLoginForm.useCallback[ssoLoginAction]": async ()=>{
            if (!ssoLogin) return;
            setError(null);
            setSsoLoading(true);
            try {
                const result = await ssoLogin();
                if (!result.success || !result.accessToken) {
                    var _result_error;
                    setError((_result_error = result.error) !== null && _result_error !== void 0 ? _result_error : 'auth.ssoFailed');
                    return;
                }
                var _result_refreshToken;
                await onLoginSuccess(result.accessToken, (_result_refreshToken = result.refreshToken) !== null && _result_refreshToken !== void 0 ? _result_refreshToken : '', result.user);
                onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
            } catch (e) {
                setError('auth.ssoFailed');
            } finally{
                setSsoLoading(false);
            }
        }
    }["useLoginForm.useCallback[ssoLoginAction]"], [
        ssoLogin,
        onLoginSuccess,
        onSuccess
    ]);
    return {
        account,
        password,
        setAccount,
        setPassword,
        loading,
        ssoLoading,
        error,
        setError,
        clearError,
        rememberPassword,
        setRememberPassword,
        autoLogin,
        setAutoLogin,
        remembered,
        login,
        ssoLoginAction,
        disabled: loading || ssoLoading
    };
}
_s(useLoginForm, "76BLl8BpvcD8ZOGe8ifiDWOetwo=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-register-form.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRegisterForm",
    ()=>useRegisterForm
]);
/**
 * @ihui/shared/hooks/use-register-form — 跨端共享注册表单 Hook(2026-07-29 立)
 *
 * 设计原则(与 useLoginForm 一致):
 * 1. 依赖注入:各端必须传入 registerApi / sendCodeApi / onRegisterSuccess,不内置任何平台 API
 * 2. 零新依赖:纯 useState + useCallback + useRef,不引入 zustand(兼容 extension MV3 / mobile-rn Hermes / Taro 小程序)
 * 3. 非破坏性:与各端现有注册组件平行存在,可通过接入消除重复的 useState + handleRegister 逻辑
 * 4. UI 无关:只提供状态 + 操作函数,各端 UI 自由绑定(web shadcn / RN Pressable / Taro View)
 * 5. 多注册类型支持:account / email / phone 三种,各端按需启用对应字段
 *
 * 复用基础设施:
 * - 不重复造轮子:各端可通过 onRegisterSuccess 桥接 useAuth().login 写 token + user(自动登录)
 * - 验证码倒计时:内置 60s 倒计时,各端注入 sendCodeApi 即可
 *
 * 各端接入示例:
 * - web EmailRegisterForm: useRegisterForm({ type: 'email', registerApi: (v) => registerByEmail(v.email, v.code, v.password), sendCodeApi: (v) => sendEmailCode(v.email, 'register'), ... })
 * - web PhoneRegisterForm: useRegisterForm({ type: 'phone', registerApi: (v) => registerByPhone(v.phone, v.code, v.password), sendCodeApi: (v) => sendCode(v.phone), ... })
 * - mobile-rn RegisterScreen: useRegisterForm({ type: 'account', registerApi: (v) => register(v.account, v.password), enableCode: false, enableConfirmPassword: true, onRegisterSuccess: async (token, rt, user) => auth.login(token, rt, user), ... })
 * - miniapp-taro register: useRegisterForm({ type: 'phone', registerApi: (v) => register({ phone: v.phone, code: v.code, password: v.password }), sendCodeApi: (v) => sendSmsCode(v.phone), ... })
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function useRegisterForm(options) {
    _s();
    const { type, registerApi, sendCodeApi, onRegisterSuccess, onSuccess, enableCode = true, enableConfirmPassword = true, enableAgreement = false, enableAutoLogin = false, countdownSeconds = 60, minAccountLength = 3, minPasswordLength = 6, maxPasswordLength = 64, codeLength = 6, phoneRegex = /^1[3-9]\d{9}$/, emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, initialCountdown = 0 } = options;
    const [values, setValues] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        account: '',
        email: '',
        phone: '',
        code: '',
        password: '',
        confirmPassword: ''
    });
    const [agreed, setAgreed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [submitting, setSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [sendingCode, setSendingCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [info, setInfo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [countdown, setCountdown] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialCountdown);
    const timerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // 倒计时 effect
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useRegisterForm.useEffect": ()=>{
            return ({
                "useRegisterForm.useEffect": ()=>{
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                    }
                }
            })["useRegisterForm.useEffect"];
        }
    }["useRegisterForm.useEffect"], []);
    const setAccount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[setAccount]": (v)=>setValues({
                "useRegisterForm.useCallback[setAccount]": (p)=>({
                        ...p,
                        account: v
                    })
            }["useRegisterForm.useCallback[setAccount]"])
    }["useRegisterForm.useCallback[setAccount]"], []);
    const setEmail = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[setEmail]": (v)=>setValues({
                "useRegisterForm.useCallback[setEmail]": (p)=>({
                        ...p,
                        email: v
                    })
            }["useRegisterForm.useCallback[setEmail]"])
    }["useRegisterForm.useCallback[setEmail]"], []);
    const setPhone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[setPhone]": (v)=>setValues({
                "useRegisterForm.useCallback[setPhone]": (p)=>({
                        ...p,
                        phone: v
                    })
            }["useRegisterForm.useCallback[setPhone]"])
    }["useRegisterForm.useCallback[setPhone]"], []);
    const setCode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[setCode]": (v)=>setValues({
                "useRegisterForm.useCallback[setCode]": (p)=>({
                        ...p,
                        code: v
                    })
            }["useRegisterForm.useCallback[setCode]"])
    }["useRegisterForm.useCallback[setCode]"], []);
    const setPassword = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[setPassword]": (v)=>setValues({
                "useRegisterForm.useCallback[setPassword]": (p)=>({
                        ...p,
                        password: v
                    })
            }["useRegisterForm.useCallback[setPassword]"])
    }["useRegisterForm.useCallback[setPassword]"], []);
    const setConfirmPassword = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[setConfirmPassword]": (v)=>setValues({
                "useRegisterForm.useCallback[setConfirmPassword]": (p)=>({
                        ...p,
                        confirmPassword: v
                    })
            }["useRegisterForm.useCallback[setConfirmPassword]"])
    }["useRegisterForm.useCallback[setConfirmPassword]"], []);
    const clearError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[clearError]": ()=>setError(null)
    }["useRegisterForm.useCallback[clearError]"], []);
    /** 启动倒计时 */ const startCountdown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[startCountdown]": ()=>{
            setCountdown(countdownSeconds);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval({
                "useRegisterForm.useCallback[startCountdown]": ()=>{
                    setCountdown({
                        "useRegisterForm.useCallback[startCountdown]": (c)=>{
                            if (c <= 1) {
                                if (timerRef.current) {
                                    clearInterval(timerRef.current);
                                    timerRef.current = null;
                                }
                                return 0;
                            }
                            return c - 1;
                        }
                    }["useRegisterForm.useCallback[startCountdown]"]);
                }
            }["useRegisterForm.useCallback[startCountdown]"], 1000);
        }
    }["useRegisterForm.useCallback[startCountdown]"], [
        countdownSeconds
    ]);
    /** 本地校验,返回错误 key 或 null */ const validate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[validate]": ()=>{
            if (type === 'account') {
                if (values.account.trim().length < minAccountLength) {
                    return 'auth.invalidAccount';
                }
            } else if (type === 'email') {
                if (!emailRegex.test(values.email)) {
                    return 'auth.invalidEmail';
                }
            } else if (type === 'phone') {
                if (!phoneRegex.test(values.phone.trim())) {
                    return 'auth.invalidPhone';
                }
            }
            if (enableCode && values.code.length < codeLength) {
                return 'auth.codePlaceholder';
            }
            if (values.password.length < minPasswordLength || values.password.length > maxPasswordLength) {
                return 'auth.invalidPassword';
            }
            if (enableConfirmPassword && values.password !== values.confirmPassword) {
                return 'auth.passwordMismatch';
            }
            if (enableAgreement && !agreed) {
                return 'auth.agreeRequired';
            }
            return null;
        }
    }["useRegisterForm.useCallback[validate]"], [
        type,
        values,
        enableCode,
        enableConfirmPassword,
        enableAgreement,
        agreed,
        minAccountLength,
        minPasswordLength,
        maxPasswordLength,
        codeLength,
        phoneRegex,
        emailRegex
    ]);
    const register = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[register]": async ()=>{
            setError(null);
            setInfo(null);
            const validationError = validate();
            if (validationError) {
                setError(validationError);
                return;
            }
            setSubmitting(true);
            try {
                const result = await registerApi(values);
                if (!result.success) {
                    var _result_error;
                    setError((_result_error = result.error) !== null && _result_error !== void 0 ? _result_error : 'auth.registerFailed');
                    return;
                }
                // 注册成功
                if (enableAutoLogin && onRegisterSuccess) {
                    // 自动登录模式:把 token + user 交给 onRegisterSuccess
                    await onRegisterSuccess(result);
                } else {
                    // 非自动登录:仅提示成功 + 跳转
                    setInfo('auth.registerSuccess');
                }
                onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
            } catch (e) {
                setError('auth.registerFailed');
            } finally{
                setSubmitting(false);
            }
        }
    }["useRegisterForm.useCallback[register]"], [
        validate,
        registerApi,
        values,
        enableAutoLogin,
        onRegisterSuccess,
        onSuccess
    ]);
    const sendCode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRegisterForm.useCallback[sendCode]": async ()=>{
            if (!sendCodeApi || countdown > 0 || sendingCode) return;
            // 发送前校验对应字段
            if (type === 'email' && !emailRegex.test(values.email)) {
                setError('auth.invalidEmail');
                return;
            }
            if (type === 'phone' && !phoneRegex.test(values.phone.trim())) {
                setError('auth.invalidPhone');
                return;
            }
            setError(null);
            setSendingCode(true);
            try {
                const result = await sendCodeApi(values);
                if (result.success) {
                    setInfo('auth.codeSent');
                    startCountdown();
                } else {
                    var _result_error;
                    setError((_result_error = result.error) !== null && _result_error !== void 0 ? _result_error : 'auth.sendCodeFailed');
                }
            } catch (e) {
                setError('auth.sendCodeFailed');
            } finally{
                setSendingCode(false);
            }
        }
    }["useRegisterForm.useCallback[sendCode]"], [
        sendCodeApi,
        countdown,
        sendingCode,
        type,
        values,
        phoneRegex,
        emailRegex,
        startCountdown
    ]);
    return {
        values,
        setAccount,
        setEmail,
        setPhone,
        setCode,
        setPassword,
        setConfirmPassword,
        agreed,
        setAgreed,
        submitting,
        sendingCode,
        error,
        info,
        setError,
        setInfo,
        clearError,
        countdown,
        register,
        sendCode,
        disabled: submitting,
        codeBtnDisabled: countdown > 0 || sendingCode
    };
}
_s(useRegisterForm, "wL5WE21ZhvvtvrfQIFBrsQ7WnOo=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-storage.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享 useStorage hook(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn 与 apps/miniapp-taro 各页面/组件中
 * "useState + useEffect 同步 storage" 重复模式(典型场景:记住密码/自动登录/历史记录)。
 *
 * 设计模式:与 use-clipboard 共享层模式对齐(工厂函数 + 平台 adapter 注入)。
 * - 调用方传 createJsonStorage/createStringStorage/createFlagStorage/createHistoryStorage 实例
 * - hook 负责 useState + useEffect 同步 + 暴露 set/remove/refresh
 *
 * 平台无关:不依赖 RN/Taro/DOM,只基于 React useState/useEffect + 共享 storage 工具。
 *
 * 各端接入:
 * ```ts
 * // mobile-rn
 * const transport = createAsyncTransport({ getItem: AsyncStorage.getItem, ... })
 * const storage = createJsonStorage<{ account: string; password: string }>(transport, 'ihui-remember-credentials')
 * export const useRememberedCredentials = createUseStorage({ storage })
 *
 * // 组件
 * const { value, set, remove, refresh, ready } = useRememberedCredentials()
 * ```
 */ __turbopack_context__.s([
    "createUseFlagStorage",
    ()=>createUseFlagStorage,
    "createUseHistoryStorage",
    ()=>createUseHistoryStorage,
    "createUseJsonStorage",
    ()=>createUseJsonStorage,
    "createUseStringStorage",
    ()=>createUseStringStorage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
function createUseJsonStorage(options) {
    var _s = __turbopack_context__.k.signature();
    const { storage, initialValue = null } = options;
    return _s(function useStorage() {
        _s();
        const [value, setValue] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialValue);
        const [ready, setReady] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
        const refresh = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseJsonStorage.useStorage.useCallback[refresh]": async ()=>{
                const next = await storage.get();
                setValue(next !== null && next !== void 0 ? next : initialValue);
            }
        }["createUseJsonStorage.useStorage.useCallback[refresh]"], [
            storage
        ]);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
            "createUseJsonStorage.useStorage.useEffect": ()=>{
                let cancelled = false;
                void ({
                    "createUseJsonStorage.useStorage.useEffect": async ()=>{
                        const next = await storage.get();
                        if (!cancelled) {
                            setValue(next !== null && next !== void 0 ? next : initialValue);
                            setReady(true);
                        }
                    }
                })["createUseJsonStorage.useStorage.useEffect"]();
                return ({
                    "createUseJsonStorage.useStorage.useEffect": ()=>{
                        cancelled = true;
                    }
                })["createUseJsonStorage.useStorage.useEffect"];
            }
        }["createUseJsonStorage.useStorage.useEffect"], [
            storage
        ]);
        const set = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseJsonStorage.useStorage.useCallback[set]": async (next)=>{
                setValue(next);
                await storage.set(next);
            }
        }["createUseJsonStorage.useStorage.useCallback[set]"], [
            storage
        ]);
        const remove = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseJsonStorage.useStorage.useCallback[remove]": async ()=>{
                setValue(initialValue);
                await storage.remove();
            }
        }["createUseJsonStorage.useStorage.useCallback[remove]"], [
            storage
        ]);
        return {
            value,
            set,
            remove,
            refresh,
            ready
        };
    }, "RTwmzheel/sf361OBfi/TATX8uQ=");
}
function createUseStringStorage(options) {
    var _s = __turbopack_context__.k.signature();
    const { storage, initialValue = '' } = options;
    return _s(function useStringStorage() {
        _s();
        const [value, setValue] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialValue);
        const [ready, setReady] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
        const refresh = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseStringStorage.useStringStorage.useCallback[refresh]": async ()=>{
                const next = await storage.get();
                setValue(next !== null && next !== void 0 ? next : initialValue);
            }
        }["createUseStringStorage.useStringStorage.useCallback[refresh]"], [
            storage
        ]);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
            "createUseStringStorage.useStringStorage.useEffect": ()=>{
                let cancelled = false;
                void ({
                    "createUseStringStorage.useStringStorage.useEffect": async ()=>{
                        const next = await storage.get();
                        if (!cancelled) {
                            setValue(next !== null && next !== void 0 ? next : initialValue);
                            setReady(true);
                        }
                    }
                })["createUseStringStorage.useStringStorage.useEffect"]();
                return ({
                    "createUseStringStorage.useStringStorage.useEffect": ()=>{
                        cancelled = true;
                    }
                })["createUseStringStorage.useStringStorage.useEffect"];
            }
        }["createUseStringStorage.useStringStorage.useEffect"], [
            storage
        ]);
        const set = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseStringStorage.useStringStorage.useCallback[set]": async (next)=>{
                setValue(next);
                await storage.set(next);
            }
        }["createUseStringStorage.useStringStorage.useCallback[set]"], [
            storage
        ]);
        const remove = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseStringStorage.useStringStorage.useCallback[remove]": async ()=>{
                setValue(initialValue);
                await storage.remove();
            }
        }["createUseStringStorage.useStringStorage.useCallback[remove]"], [
            storage
        ]);
        return {
            value,
            set,
            remove,
            refresh,
            ready
        };
    }, "RTwmzheel/sf361OBfi/TATX8uQ=");
}
function createUseFlagStorage(options) {
    var _s = __turbopack_context__.k.signature();
    const { storage, initialValue = false } = options;
    return _s(function useFlagStorage() {
        _s();
        const [value, setValue] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialValue);
        const [ready, setReady] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
        const refresh = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseFlagStorage.useFlagStorage.useCallback[refresh]": async ()=>{
                const next = await storage.get();
                setValue(next);
            }
        }["createUseFlagStorage.useFlagStorage.useCallback[refresh]"], [
            storage
        ]);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
            "createUseFlagStorage.useFlagStorage.useEffect": ()=>{
                let cancelled = false;
                void ({
                    "createUseFlagStorage.useFlagStorage.useEffect": async ()=>{
                        const next = await storage.get();
                        if (!cancelled) {
                            setValue(next);
                            setReady(true);
                        }
                    }
                })["createUseFlagStorage.useFlagStorage.useEffect"]();
                return ({
                    "createUseFlagStorage.useFlagStorage.useEffect": ()=>{
                        cancelled = true;
                    }
                })["createUseFlagStorage.useFlagStorage.useEffect"];
            }
        }["createUseFlagStorage.useFlagStorage.useEffect"], [
            storage
        ]);
        const set = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseFlagStorage.useFlagStorage.useCallback[set]": async (next)=>{
                setValue(next);
                await storage.set(next);
            }
        }["createUseFlagStorage.useFlagStorage.useCallback[set]"], [
            storage
        ]);
        const remove = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseFlagStorage.useFlagStorage.useCallback[remove]": async ()=>{
                setValue(initialValue);
                await storage.clear();
            }
        }["createUseFlagStorage.useFlagStorage.useCallback[remove]"], [
            storage
        ]);
        return {
            value,
            set,
            remove,
            refresh,
            ready
        };
    }, "RTwmzheel/sf361OBfi/TATX8uQ=");
}
function createUseHistoryStorage(options) {
    var _s = __turbopack_context__.k.signature();
    const { storage, initialList = [] } = options;
    return _s(function useHistoryStorage() {
        _s();
        const [list, setList] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](initialList);
        const [ready, setReady] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
        const refresh = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseHistoryStorage.useHistoryStorage.useCallback[refresh]": async ()=>{
                const next = await storage.get();
                setList(next);
            }
        }["createUseHistoryStorage.useHistoryStorage.useCallback[refresh]"], [
            storage
        ]);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
            "createUseHistoryStorage.useHistoryStorage.useEffect": ()=>{
                let cancelled = false;
                void ({
                    "createUseHistoryStorage.useHistoryStorage.useEffect": async ()=>{
                        const next = await storage.get();
                        if (!cancelled) {
                            setList(next);
                            setReady(true);
                        }
                    }
                })["createUseHistoryStorage.useHistoryStorage.useEffect"]();
                return ({
                    "createUseHistoryStorage.useHistoryStorage.useEffect": ()=>{
                        cancelled = true;
                    }
                })["createUseHistoryStorage.useHistoryStorage.useEffect"];
            }
        }["createUseHistoryStorage.useHistoryStorage.useEffect"], [
            storage
        ]);
        const push = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseHistoryStorage.useHistoryStorage.useCallback[push]": async (item)=>{
                const next = await storage.push(item);
                setList(next);
            }
        }["createUseHistoryStorage.useHistoryStorage.useCallback[push]"], [
            storage
        ]);
        const remove = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseHistoryStorage.useHistoryStorage.useCallback[remove]": async (item)=>{
                const next = await storage.remove(item);
                setList(next);
            }
        }["createUseHistoryStorage.useHistoryStorage.useCallback[remove]"], [
            storage
        ]);
        const clear = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseHistoryStorage.useHistoryStorage.useCallback[clear]": async ()=>{
                const next = await storage.clear();
                setList(next);
            }
        }["createUseHistoryStorage.useHistoryStorage.useCallback[clear]"], [
            storage
        ]);
        return {
            list,
            push,
            remove,
            clear,
            refresh,
            ready
        };
    }, "fIeUqRYs+Lwz+QmSsU7lXm9AxOo=");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/use-image-picker.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端共享 useImagePicker hook(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn/src/hooks/useChatInput.ts(launchImageLibraryAsync)
 * 与 apps/miniapp-taro/src/utils/upload-image.ts(Taro.chooseImage)中
 * "选图 + 错误兜底 + 类型推断 + 状态管理" 重复模式。
 *
 * 设计模式:与 use-clipboard 共享层模式对齐(工厂函数 + 平台 adapter 注入)。
 * - 调用方传 ImagePickerImpl 平台实现
 * - hook 负责 useState(useState busy/error/files) + useCallback(pick/pickFromCamera)
 *
 * 平台无关:不依赖 RN/Taro/DOM,只基于 React useState/useCallback + 共享 image-helpers。
 *
 * 各端接入:
 * ```ts
 * // mobile-rn
 * export const useImagePicker = createUseImagePicker({
 *   pickFromLibrary: async (opts) => {
 *     const result = await ImagePicker.launchImageLibraryAsync(opts)
 *     if (result.canceled) return []
 *     return result.assets ?? []
 *   },
 *   pickFromCamera: async (opts) => { ... },
 * })
 *
 * // miniapp-taro
 * export const useImagePicker = createUseImagePicker({
 *   pickFromLibrary: async (opts) => {
 *     const res = await Taro.chooseImage({ count: opts.maxCount, ... })
 *     return res.tempFilePaths.map(p => ({ uri: p }))
 *   },
 *   pickFromCamera: async (opts) => { ... },
 * })
 * ```
 */ __turbopack_context__.s([
    "createUseImagePicker",
    ()=>createUseImagePicker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$image$2d$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/image-helpers.ts [app-client] (ecmascript)");
;
;
const DEFAULT_OPTIONS = {
    maxCount: 1,
    imagesOnly: true,
    mediaType: 'image',
    quality: 0.8
};
function mergeOptions(opts) {
    return {
        ...DEFAULT_OPTIONS,
        ...opts !== null && opts !== void 0 ? opts : {}
    };
}
function createUseImagePicker(impl) {
    var _s = __turbopack_context__.k.signature();
    return _s(function useImagePicker() {
        _s();
        const [files, setFiles] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"]([]);
        const [busy, setBusy] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
        const [error, setError] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
        const fallbackType = (opts)=>{
            if (opts.mediaType === 'video') return 'video';
            if (opts.mediaType === 'all') return 'image';
            return 'image';
        };
        const pickInternal = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseImagePicker.useImagePicker.useCallback[pickInternal]": async (picker, options)=>{
                const merged = mergeOptions(options);
                setBusy(true);
                setError(null);
                try {
                    const assets = await picker(merged);
                    const newFiles = assets.filter({
                        "createUseImagePicker.useImagePicker.useCallback[pickInternal].newFiles": (a)=>!!a && (typeof a.uri === 'string' || typeof a.fileName === 'string')
                    }["createUseImagePicker.useImagePicker.useCallback[pickInternal].newFiles"]).map({
                        "createUseImagePicker.useImagePicker.useCallback[pickInternal].newFiles": (a)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$image$2d$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildFileFromAsset"])(a, fallbackType(merged))
                    }["createUseImagePicker.useImagePicker.useCallback[pickInternal].newFiles"]);
                    if (newFiles.length > 0) {
                        setFiles({
                            "createUseImagePicker.useImagePicker.useCallback[pickInternal]": (prev)=>[
                                    ...newFiles,
                                    ...prev
                                ]
                        }["createUseImagePicker.useImagePicker.useCallback[pickInternal]"]);
                    }
                    return newFiles;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'unknown';
                    setError(msg);
                    return [];
                } finally{
                    setBusy(false);
                }
            }
        }["createUseImagePicker.useImagePicker.useCallback[pickInternal]"], []);
        const pickFromLibrary = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseImagePicker.useImagePicker.useCallback[pickFromLibrary]": (options)=>pickInternal(impl.pickFromLibrary, options)
        }["createUseImagePicker.useImagePicker.useCallback[pickFromLibrary]"], [
            impl,
            pickInternal
        ]);
        const pickFromCamera = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseImagePicker.useImagePicker.useCallback[pickFromCamera]": (options)=>{
                if (impl.pickFromCamera) {
                    return pickInternal(impl.pickFromCamera, options);
                }
                // 平台不支持相机时降级为相册
                return pickInternal(impl.pickFromLibrary, options);
            }
        }["createUseImagePicker.useImagePicker.useCallback[pickFromCamera]"], [
            impl,
            pickInternal
        ]);
        const remove = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseImagePicker.useImagePicker.useCallback[remove]": (id)=>{
                setFiles({
                    "createUseImagePicker.useImagePicker.useCallback[remove]": (prev)=>prev.filter({
                            "createUseImagePicker.useImagePicker.useCallback[remove]": (f)=>f.id !== id
                        }["createUseImagePicker.useImagePicker.useCallback[remove]"])
                }["createUseImagePicker.useImagePicker.useCallback[remove]"]);
            }
        }["createUseImagePicker.useImagePicker.useCallback[remove]"], []);
        const clear = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
            "createUseImagePicker.useImagePicker.useCallback[clear]": ()=>{
                setFiles([]);
            }
        }["createUseImagePicker.useImagePicker.useCallback[clear]"], []);
        return {
            files,
            busy,
            error,
            ready: true,
            pickFromLibrary,
            pickFromCamera,
            remove,
            clear,
            setFiles
        };
    }, "8BKKZ9I7OBVo5vSsufEQ3CtA5Nw=");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/hooks/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$debounce$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-debounce.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$countdown$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-countdown.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$mounted$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-mounted.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$clipboard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-clipboard.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$pagination$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-pagination.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$auth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-auth.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$agents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-agents.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$articles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-articles.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-chat.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$load$2d$more$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-load-more.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$social$2d$list$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-social-list.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$paginated$2d$list$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-paginated-list.js [app-client] (ecmascript)");
// 跨端组件共享 hooks(2026-07-28 立,mobile-rn + miniapp-taro 同名组件业务逻辑去重)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$auto$2d$play$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-auto-play.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$agent$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-agent-runtime.js [app-client] (ecmascript)");
// 纯 React hooks 下沉(2026-07-29,apps/web → @ihui/shared)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$confirm$2d$dialog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-confirm-dialog.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$form$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-form.ts [app-client] (ecmascript)");
// 跨端共享登录表单(2026-07-29 立,web/RN/Taro 三端登录逻辑去重)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$login$2d$form$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-login-form.ts [app-client] (ecmascript)");
// 跨端共享注册表单(2026-07-29 立,web/RN/Taro 三端注册逻辑去重)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$register$2d$form$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-register-form.ts [app-client] (ecmascript)");
// 跨端存储 hook(2026-07-30 立,基于 storage 工厂的 React hook)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-storage.ts [app-client] (ecmascript)");
// 跨端图片选择 hook(2026-07-30 立,apps/mobile-rn + apps/miniapp-taro 共用)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$image$2d$picker$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-image-picker.ts [app-client] (ecmascript)"); //# sourceMappingURL=index.js.map
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/stores/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$transport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/transport.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$auth$2d$store$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/auth-store.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/user-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$theme$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/theme-store.ts [app-client] (ecmascript)"); //# sourceMappingURL=index.js.map
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/skills/market.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Skills 市场跨端共享类型(2026-07-23 立)。
 * 对齐 TRAE Work 技能市场能力:IHUI-AI 补齐搜索/安装/评分分发闭环。
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/tasks/dispatch.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 三端联动任务调度跨端共享类型(2026-07-23 立)。
 * mobile-rn 下发 → api WebSocket → desktop 接收执行 → 结果回推。
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/design/element.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Design 模式跨端共享类型(2026-07-23 立)。
 * desktop 画布 + 元素选择器 + CSS 面板 + 评论到对话闭环。
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/subagents/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Subagent 派单 + Swarm 拓扑跨端共享类型(2026-07-24 立,对标 TRAE Work 多智能体团队)。
 *
 * 2026-07-24 统一:原 @ihui/types/subagent-dispatch.ts 的类型已合并到本文件,
 * @ihui/types/subagent-dispatch.ts 已删除,所有消费者统一从 @ihui/shared/subagents 导入。
 *
 * 契约对齐 apps/api/src/routes/subagent-dispatch.ts:
 *  - POST /subagents/dispatch          → SubagentDispatchResult
 *  - GET  /subagents/active            → SubagentDispatch[]
 *  - POST /subagents/:id/cancel        → { cancelled: boolean }
 *  - POST /subagents/:id/resume        → SubagentResumeResult
 *  - GET  /subagents/topology          → SwarmTopology | SwarmTopologyV2
 *  - GET  /subagents/stats             → SubagentGlobalStats
 *  - GET  /subagents/queue             → SubagentQueueEntry[]
 *  - GET  /subagents/:id/stats         → SubagentDispatchStats
 *  - GET  /subagents/:id/dag           → DagDefinition
 *  - GET  /subagents/:id/quotas        → QuotaUsage
 *  - GET  /subagents/:id/messages      → AgentMessage[]
 */ /** Agent 角色(对齐 API Zod agentRole enum) */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/context/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 上下文系统跨端共享类型(2026-07-24 立,对标 TRAE Work #Context 系统)。
 *
 * 契约对齐 apps/api/src/routes/context-mentions.ts:
 *  - GET  /context/mentions?q=&type=             → Mention[]
 *  - GET  /context/database/tables?q=            → Mention[]
 *  - GET  /context/database/schema/:table        → TableSchema
 *  - GET  /context/symbols?q=                    → Symbol[]
 *  - POST /context/enrich                        → EnrichResult
 *  - GET  /context/sources                       → ContextSource[]
 *  - POST /context/visualization/track           → { recorded: boolean }
 *  - GET  /context/visualization                 → VisualizationData
 *  - GET  /context/compression-stats             → CompressionStats
 *  - GET  /context/memory                        → SessionMemory
 *  - DELETE /context/memory                      → { cleared: boolean }
 */ /** 上下文源类型 */ __turbopack_context__.s([
    "CONTEXT_TYPE_OPTIONS",
    ()=>CONTEXT_TYPE_OPTIONS
]);
const CONTEXT_TYPE_OPTIONS = [
    {
        value: 'file',
        label: '文件',
        color: 'bg-slate-100 text-slate-700',
        icon: 'File'
    },
    {
        value: 'folder',
        label: '目录',
        color: 'bg-slate-100 text-slate-700',
        icon: 'Folder'
    },
    {
        value: 'symbol',
        label: '符号',
        color: 'bg-indigo-100 text-indigo-700',
        icon: 'Code'
    },
    {
        value: 'database',
        label: '数据库',
        color: 'bg-emerald-100 text-emerald-700',
        icon: 'Database'
    },
    {
        value: 'web',
        label: '网页',
        color: 'bg-blue-100 text-blue-700',
        icon: 'Globe'
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/spec/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Spec 模式跨端共享类型(2026-07-24 立,对标 TRAE Work Spec 模式四阶段生命周期)。
 *
 * 契约对齐 apps/api/src/routes/spec.ts + apps/ai-service/app/routers/spec.py:
 *  - POST /spec/generate   → SpecGenerateResult
 *  - GET  /spec/templates  → SpecTemplate[]
 *  - GET  /spec/history    → SpecHistoryEntry[]
 *  - GET  /spec/load       → SpecDocument
 *  - POST /spec/diff       → SpecDiff
 *  - GET  /spec/variables  → SpecVariable[]
 *
 * 四阶段生命周期:提案 → 审批 → 实现 → 验证
 */ /** Spec 范围类型 */ __turbopack_context__.s([
    "SPEC_BUILTIN_TEMPLATES",
    ()=>SPEC_BUILTIN_TEMPLATES,
    "SPEC_LIFECYCLE_STAGES",
    ()=>SPEC_LIFECYCLE_STAGES
]);
const SPEC_BUILTIN_TEMPLATES = [
    {
        id: 'full',
        name: '完整规格',
        description: '概述 + 模块结构 + API 契约 + 数据模型 + 依赖关系(默认)',
        sections: [
            '概述',
            '模块结构',
            'API 契约',
            '数据模型',
            '依赖关系'
        ]
    },
    {
        id: 'api-only',
        name: 'API 契约',
        description: '仅提取 API endpoint,生成接口文档',
        sections: [
            '概述',
            'API 契约'
        ]
    },
    {
        id: 'schema-only',
        name: '数据模型',
        description: '仅提取数据库表 / schema,生成数据字典',
        sections: [
            '概述',
            '数据模型'
        ]
    },
    {
        id: 'module-overview',
        name: '模块概览',
        description: '仅模块结构与符号清单,快速了解代码组织',
        sections: [
            '概述',
            '模块结构'
        ]
    }
];
const SPEC_LIFECYCLE_STAGES = [
    {
        value: 'proposed',
        label: '提案',
        description: 'Spec 已生成,等待审批',
        color: 'bg-amber-100 text-amber-700'
    },
    {
        value: 'approved',
        label: '审批',
        description: '已通过审批,可进入实现阶段',
        color: 'bg-blue-100 text-blue-700'
    },
    {
        value: 'implementing',
        label: '实现',
        description: '正在按 spec 实现代码',
        color: 'bg-purple-100 text-purple-700'
    },
    {
        value: 'verified',
        label: '验证',
        description: '已验证实现符合 spec',
        color: 'bg-emerald-100 text-emerald-700'
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/plan/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Plan 模式跨端共享类型(2026-07-24 立,对标 TRAE Work Plan 模式单一计划文档)。
 *
 * Plan 模式与 Spec 模式的差异:
 *  - Plan:单一计划文档(目标 + 修改范围 + 步骤),适用于中小型功能与模块级重构
 *  - Spec:三文件组(spec.md + tasks.md + checklist.md),适用于系统级重构与高质量项目
 *
 * 本模块定义 Plan 单文档数据模型,API 端点待后续补齐(目前 web 端可先用本地状态管理)。
 */ /** Plan 步骤状态 */ __turbopack_context__.s([
    "PLAN_PRIORITY_OPTIONS",
    ()=>PLAN_PRIORITY_OPTIONS,
    "PLAN_STEP_STATUS_OPTIONS",
    ()=>PLAN_STEP_STATUS_OPTIONS
]);
const PLAN_STEP_STATUS_OPTIONS = [
    {
        value: 'pending',
        label: '待处理',
        color: 'bg-slate-100 text-slate-700'
    },
    {
        value: 'in_progress',
        label: '进行中',
        color: 'bg-blue-100 text-blue-700'
    },
    {
        value: 'completed',
        label: '已完成',
        color: 'bg-emerald-100 text-emerald-700'
    },
    {
        value: 'blocked',
        label: '阻塞',
        color: 'bg-rose-100 text-rose-700'
    },
    {
        value: 'skipped',
        label: '跳过',
        color: 'bg-amber-100 text-amber-700'
    }
];
const PLAN_PRIORITY_OPTIONS = [
    {
        value: 'low',
        label: '低',
        color: 'bg-slate-100 text-slate-700'
    },
    {
        value: 'medium',
        label: '中',
        color: 'bg-blue-100 text-blue-700'
    },
    {
        value: 'high',
        label: '高',
        color: 'bg-amber-100 text-amber-700'
    },
    {
        value: 'critical',
        label: '紧急',
        color: 'bg-rose-100 text-rose-700'
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/pay/error-types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端支付错误分类(纯逻辑,零平台依赖)
 *
 * 消除 miniapp-taro (utils/pay.ts + platform/pay.ts) 与未来 mobile-rn 端
 * 错误分类逻辑重复。各端通过 classifyPayError / is*Error 判断错误类型后,
 * 自行调用 Taro.showToast / console.warn 等平台 API 提示用户。
 */ /** 支付错误类型枚举 */ __turbopack_context__.s([
    "classifyPayError",
    ()=>classifyPayError,
    "isAliNotInstalled",
    ()=>isAliNotInstalled,
    "isCancelError",
    ()=>isCancelError,
    "isParamError",
    ()=>isParamError,
    "isWxNotInstalled",
    ()=>isWxNotInstalled
]);
function isCancelError(err) {
    const msg = err.errMsg || err.message || '';
    return msg.includes('cancel');
}
function isWxNotInstalled(err) {
    if (err.code === -100) return true;
    return (err.errMsg || '').includes('62000');
}
function isAliNotInstalled(err) {
    if (err.code === -100) return true;
    return (err.errMsg || '').includes('62009');
}
function isParamError(err) {
    const msg = err.errMsg || err.message || '';
    return msg.includes('parameter') || msg.includes('参数');
}
function classifyPayError(err) {
    const e = err instanceof Error ? {
        message: err.message
    } : typeof err === 'object' && err !== null ? err : {
        message: String(err)
    };
    if (isCancelError(e)) return 'cancel';
    if (isWxNotInstalled(e)) return 'wxNotInstalled';
    if (isAliNotInstalled(e)) return 'aliNotInstalled';
    if (isParamError(e)) return 'paramError';
    return 'unknown';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/pay/normalize.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端支付参数归一化(纯逻辑,零平台依赖)
 *
 * 后端可能返回 snake_case / camelCase / lowercase 多种字段命名
 * (appid / appId / app_id / partnerid / partnerId / partner_id …),
 * 本模块统一归一化为 lowercase 字段,供 App 端微信 orderInfo 构建等场景消费。
 */ __turbopack_context__.s([
    "buildAppWxOrderInfo",
    ()=>buildAppWxOrderInfo,
    "normalizeAliPayParams",
    ()=>normalizeAliPayParams,
    "normalizeWxPayParams",
    ()=>normalizeWxPayParams
]);
/**
 * 从原始对象中按多命名约定选取首个非空值。
 * 返回 undefined 表示所有候选键均未提供有效值。
 */ function pickFirst(obj, keys) {
    for (const k of keys){
        const v = obj[k];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
}
function normalizeWxPayParams(raw) {
    var _ref, _pickFirst, _pickFirst1;
    return {
        appid: pickFirst(raw, [
            'appid',
            'appId',
            'app_id'
        ]),
        partnerid: pickFirst(raw, [
            'partnerid',
            'partnerId',
            'partner_id'
        ]),
        prepayid: pickFirst(raw, [
            'prepayid',
            'prepayId',
            'prepay_id'
        ]),
        package: (_ref = raw.package) !== null && _ref !== void 0 ? _ref : 'Sign=WXPay',
        noncestr: (_pickFirst = pickFirst(raw, [
            'noncestr',
            'nonceStr',
            'nonce_str'
        ])) !== null && _pickFirst !== void 0 ? _pickFirst : '',
        timestamp: String((_pickFirst1 = pickFirst(raw, [
            'timestamp',
            'timeStamp'
        ])) !== null && _pickFirst1 !== void 0 ? _pickFirst1 : Math.floor(Date.now() / 1000)),
        sign: raw.sign
    };
}
function normalizeAliPayParams(raw) {
    const orderInfoStr = typeof raw.orderInfo === 'string' ? raw.orderInfo : undefined;
    var _ref;
    return {
        tradeNO: raw.tradeNO,
        orderStr: (_ref = raw.orderStr) !== null && _ref !== void 0 ? _ref : orderInfoStr,
        orderInfo: raw.orderInfo
    };
}
function buildAppWxOrderInfo(p) {
    if (typeof p.orderInfo === 'string') return p.orderInfo;
    if (p.orderInfo && typeof p.orderInfo === 'object') return JSON.stringify(p.orderInfo);
    return JSON.stringify(normalizeWxPayParams(p));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/pay/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$pay$2f$error$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/pay/error-types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$pay$2f$normalize$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/pay/normalize.ts [app-client] (ecmascript)");
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/share/share-utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端分享纯逻辑工具(零平台依赖)
 *
 * 消除 miniapp-taro utils/share.ts 中 getSharePath/getShareInfo/getTimelineShareInfo
 * 的纯逻辑部分。各端通过注入 ShareDefaults(端独占配置)和 inviteCode(从 storage 读取)
 * 复用本模块,保留 Taro API 调用(showShareMenu 等)在端内。
 */ __turbopack_context__.s([
    "getShareInfo",
    ()=>getShareInfo,
    "getSharePath",
    ()=>getSharePath,
    "getTimelineQuery",
    ()=>getTimelineQuery,
    "getTimelineShareInfo",
    ()=>getTimelineShareInfo
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants/share.ts [app-client] (ecmascript)");
;
function getSharePath(path) {
    let inviteCode = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : '';
    const query = "".concat(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SHARE_PARAM"].SOURCE_PARAM, "=").concat(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SHARE_PARAM"].SOURCE_VALUE, "&").concat(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SHARE_PARAM"].INVITE_CODE_PARAM, "=").concat(inviteCode);
    return path.includes('?') ? "".concat(path, "&").concat(query) : "".concat(path, "?").concat(query);
}
function getTimelineQuery() {
    let inviteCode = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : '';
    return "".concat(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SHARE_PARAM"].SOURCE_PARAM, "=").concat(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SHARE_PARAM"].SOURCE_VALUE, "&").concat(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SHARE_PARAM"].INVITE_CODE_PARAM, "=").concat(inviteCode);
}
function getShareInfo(opts) {
    const { defaults, path, title, imageUrl, inviteCode = '' } = opts;
    return {
        title: title || defaults.defaultTitle,
        path: getSharePath(path || defaults.fallbackPath, inviteCode),
        imageUrl: imageUrl || defaults.defaultImageUrl
    };
}
function getTimelineShareInfo(opts) {
    const { defaults, title, imageUrl, inviteCode = '' } = opts;
    return {
        title: title || defaults.defaultTitle,
        query: getTimelineQuery(inviteCode),
        imageUrl: imageUrl || defaults.defaultImageUrl
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/share/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$share$2f$share$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/share/share-utils.ts [app-client] (ecmascript)");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/seo/schema-article.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Article JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎(GPTBot/ClaudeBot/PerplexityBot)对"AI 资讯/技术博客"类
 * 长文本内容的结构化抓取,Article schema 会被搜索引擎和 AI 摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const article = generateArticleSchema({
 *   headline: 'GPT-5 正式发布',
 *   description: '...',
 *   url: 'https://aizhs.top/ai-news/gpt5-release',
 *   datePublished: '2026-07-26',
 *   authorName: '智汇 AI 编辑部',
 *   keywords: ['GPT-5', 'OpenAI', '大模型'],
 *   articleBody: '...',
 * })
 * // 注入: <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
 * ```
 */ __turbopack_context__.s([
    "DEFAULT_ARTICLE_AUTHOR",
    ()=>DEFAULT_ARTICLE_AUTHOR,
    "generateArticleSchema",
    ()=>generateArticleSchema
]);
const DEFAULT_PUBLISHER_NAME = '智汇 AI';
const DEFAULT_PUBLISHER_LOGO = 'https://aizhs.top/images/logo.png';
const DEFAULT_AUTHOR_URL = 'https://aizhs.top/about';
const SITE_WEBSITE_ID = 'https://aizhs.top/#website';
function generateArticleSchema(article) {
    var _article_publisherName;
    const result = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': "".concat(article.url, "#article"),
        headline: article.headline,
        description: article.description,
        url: article.url,
        datePublished: article.datePublished,
        author: {
            '@type': 'Person',
            name: article.authorName,
            ...article.authorUrl ? {
                url: article.authorUrl
            } : {}
        },
        publisher: {
            '@type': 'Organization',
            name: (_article_publisherName = article.publisherName) !== null && _article_publisherName !== void 0 ? _article_publisherName : DEFAULT_PUBLISHER_NAME,
            logo: {
                '@type': 'ImageObject',
                url: DEFAULT_PUBLISHER_LOGO
            }
        },
        keywords: article.keywords.join(', '),
        inLanguage: article.inLanguage,
        isPartOf: {
            '@id': SITE_WEBSITE_ID
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': article.url
        }
    };
    if (article.dateModified) {
        result.dateModified = article.dateModified;
    }
    if (article.articleBody) {
        result.articleBody = article.articleBody;
    }
    if (article.imageUrl) {
        result.image = article.imageUrl;
    }
    if (article.articleSection) {
        result.articleSection = article.articleSection;
    }
    return result;
}
const DEFAULT_ARTICLE_AUTHOR = {
    name: DEFAULT_PUBLISHER_NAME,
    url: DEFAULT_AUTHOR_URL
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/seo/schema-course.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Course JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎对"AI 教育/在线课程"类内容的结构化抓取,Course schema
 * 会被 Google Course Rich Results、Claude/GPT 学习类摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const course = generateCourseSchema({
 *   name: 'AI Agent 开发实战',
 *   description: '...',
 *   url: 'https://aizhs.top/use-cases/ai-edu',
 *   providerName: '智汇 AI',
 *   courseMode: 'online',
 *   hasCourseInstance: { startDate: '2026-08-01', endDate: '2026-12-31' },
 *   priceCurrency: 'CNY',
 *   price: 0,
 * })
 * ```
 */ __turbopack_context__.s([
    "generateCourseSchema",
    ()=>generateCourseSchema
]);
const DEFAULT_PROVIDER_NAME = '智汇 AI';
const DEFAULT_PROVIDER_URL = 'https://aizhs.top';
const SITE_WEBSITE_ID = 'https://aizhs.top/#website';
function generateCourseSchema(course) {
    var _course_providerName, _course_providerUrl, _course_providerUrl1;
    const result = {
        '@context': 'https://schema.org',
        '@type': 'Course',
        '@id': "".concat(course.url, "#course"),
        name: course.name,
        description: course.description,
        url: course.url,
        provider: {
            '@type': 'Organization',
            name: (_course_providerName = course.providerName) !== null && _course_providerName !== void 0 ? _course_providerName : DEFAULT_PROVIDER_NAME,
            url: (_course_providerUrl = course.providerUrl) !== null && _course_providerUrl !== void 0 ? _course_providerUrl : DEFAULT_PROVIDER_URL,
            sameAs: (_course_providerUrl1 = course.providerUrl) !== null && _course_providerUrl1 !== void 0 ? _course_providerUrl1 : DEFAULT_PROVIDER_URL
        },
        hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: "https://schema.org/".concat(course.hasCourseInstance.courseMode === 'onsite' ? 'Onsite' : course.hasCourseInstance.courseMode === 'blended' ? 'Blended' : 'Online'),
            startDate: course.hasCourseInstance.startDate,
            inLanguage: course.hasCourseInstance.inLanguage
        },
        about: course.about,
        inLanguage: course.inLanguage,
        isPartOf: {
            '@id': SITE_WEBSITE_ID
        }
    };
    if (course.hasCourseInstance.endDate) {
        result.hasCourseInstance.endDate = course.hasCourseInstance.endDate;
    }
    if (course.hasCourseInstance.courseWorkload) {
        result.hasCourseInstance.courseWorkload = course.hasCourseInstance.courseWorkload;
    }
    if (course.priceCurrency) {
        result.offers = {
            '@type': 'Offer',
            price: course.price,
            priceCurrency: course.priceCurrency,
            availability: 'https://schema.org/InStock',
            url: course.url
        };
    }
    if (course.coursePrerequisites && course.coursePrerequisites.length > 0) {
        result.coursePrerequisites = course.coursePrerequisites.join(', ');
    }
    if (course.teaches && course.teaches.length > 0) {
        result.teaches = course.teaches.join(', ');
    }
    if (course.educationalLevel) {
        result.educationalLevel = "https://schema.org/".concat(course.educationalLevel.charAt(0).toUpperCase()).concat(course.educationalLevel.slice(1));
    }
    return result;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/seo/schema-product.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Product JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎对"SaaS 产品/订阅套餐"类内容的结构化抓取,Product + Offer
 * schema 会被 Google Shopping、Claude/GPT 商业摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const product = generateProductSchema({
 *   name: '智汇 AI 充值套餐',
 *   description: '...',
 *   url: 'https://aizhs.top/models/billing',
 *   brand: '智汇 AI',
 *   offers: [
 *     { name: '入门包', price: 9.9, priceCurrency: 'CNY' },
 *     { name: '专业包', price: 99, priceCurrency: 'CNY' },
 *   ],
 * })
 * ```
 */ __turbopack_context__.s([
    "generateProductSchema",
    ()=>generateProductSchema
]);
const DEFAULT_BRAND = '智汇 AI';
const SITE_WEBSITE_ID = 'https://aizhs.top/#website';
function generateProductSchema(product) {
    if (product.offers.length === 0) {
        throw new Error('generateProductSchema: at least one offer is required');
    }
    var _product_brand;
    const brandName = (_product_brand = product.brand) !== null && _product_brand !== void 0 ? _product_brand : DEFAULT_BRAND;
    const prices = product.offers.map((o)=>o.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const isMultiOffer = product.offers.length > 1;
    const result = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': "".concat(product.url, "#product"),
        name: product.name,
        description: product.description,
        url: product.url,
        brand: {
            '@type': 'Brand',
            name: brandName
        },
        inLanguage: product.inLanguage,
        isPartOf: {
            '@id': SITE_WEBSITE_ID
        }
    };
    if (product.imageUrl) {
        result.image = product.imageUrl;
    }
    if (product.sku) {
        result.sku = product.sku;
    }
    if (product.gtin) {
        result.gtin = product.gtin;
    }
    if (product.category) {
        result.category = product.category;
    }
    if (isMultiOffer) {
        // 多档套餐:用 AggregateOffer 包装,价格区间 + 数量
        const firstOffer = product.offers[0];
        if (!firstOffer) {
            throw new Error('generateProductSchema: first offer is undefined');
        }
        result.offers = {
            '@type': 'AggregateOffer',
            priceCurrency: firstOffer.priceCurrency,
            lowPrice: minPrice,
            highPrice: maxPrice,
            offerCount: product.offers.length,
            price: "".concat(minPrice, "-").concat(maxPrice),
            availability: 'https://schema.org/InStock',
            url: product.url
        };
    } else {
        // 单档:Offer 直接挂载
        const single = product.offers[0];
        if (!single) {
            throw new Error('generateProductSchema: single offer is undefined');
        }
        var _single_availability;
        result.offers = {
            '@type': 'Offer',
            name: single.name,
            priceCurrency: single.priceCurrency,
            price: single.price,
            availability: "https://schema.org/".concat((_single_availability = single.availability) !== null && _single_availability !== void 0 ? _single_availability : 'InStock'),
            url: product.url,
            ...single.description ? {
                itemOffered: {
                    '@type': 'Service',
                    name: single.name,
                    description: single.description
                }
            } : {}
        };
    }
    return result;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/seo/schema-review.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Review JSON-LD schema 生成器(2026-07-26 立,GEO 强化)。
 *
 * 适配 AI 引擎对"客户评价/产品评测"类内容的结构化抓取,Review + Rating
 * schema 会被 Google Stars Rich Results、Claude/GPT 商业摘要器优先引用。
 *
 * 用法:
 * ```ts
 * const review = generateReviewSchema({
 *   itemReviewedName: '智汇 AI 智能客服',
 *   reviewBody: '...',
 *   ratingValue: 4.8,
 *   bestRating: 5,
 *   authorName: '张磊',
 *   url: 'https://aizhs.top/use-cases/customer-support',
 * })
 * ```
 */ __turbopack_context__.s([
    "generateReviewSchema",
    ()=>generateReviewSchema
]);
const SITE_WEBSITE_ID = 'https://aizhs.top/#website';
const DEFAULT_BEST = 5;
const DEFAULT_WORST = 1;
function generateReviewSchema(review) {
    var _review_bestRating;
    const bestRating = (_review_bestRating = review.bestRating) !== null && _review_bestRating !== void 0 ? _review_bestRating : DEFAULT_BEST;
    var _review_worstRating;
    const worstRating = (_review_worstRating = review.worstRating) !== null && _review_worstRating !== void 0 ? _review_worstRating : DEFAULT_WORST;
    // 校验评分范围
    if (review.ratingValue < worstRating || review.ratingValue > bestRating) {
        throw new Error("generateReviewSchema: ratingValue (".concat(String(review.ratingValue), ") must be within [").concat(String(worstRating), ", ").concat(String(bestRating), "]"));
    }
    const author = {
        '@type': 'Person',
        name: review.authorName
    };
    if (review.authorJobTitle) {
        author.jobTitle = review.authorJobTitle;
    }
    if (review.authorAffiliation) {
        author.affiliation = review.authorAffiliation;
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'Review',
        '@id': "".concat(review.itemReviewedUrl, "#review-").concat(review.datePublished),
        reviewBody: review.reviewBody,
        reviewRating: {
            '@type': 'Rating',
            ratingValue: review.ratingValue,
            bestRating,
            worstRating
        },
        author,
        datePublished: review.datePublished,
        itemReviewed: {
            '@type': 'Service',
            name: review.itemReviewedName,
            url: review.itemReviewedUrl
        },
        inLanguage: review.inLanguage,
        isPartOf: {
            '@id': SITE_WEBSITE_ID
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/seo/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$seo$2f$schema$2d$article$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/seo/schema-article.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$seo$2f$schema$2d$course$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/seo/schema-course.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$seo$2f$schema$2d$product$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/seo/schema-product.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$seo$2f$schema$2d$review$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/seo/schema-review.ts [app-client] (ecmascript)");
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/types/ai-talk.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * AI Talk 业务类型定义
 * 从旧项目 Vue2 mixin (aiBase.js / ai_index.js) 迁移,用于 React hook 化的 talk 入口与模型分发。
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/types/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$types$2f$ai$2d$talk$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/types/ai-talk.ts [app-client] (ecmascript)");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared/src/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$auth$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/auth/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$notifications$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/notifications/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$validation$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/validation/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$workflows$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/workflows/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$stores$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/stores/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$skills$2f$market$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/skills/market.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$tasks$2f$dispatch$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/tasks/dispatch.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$design$2f$element$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/design/element.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$subagents$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/subagents/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$context$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/context/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$spec$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/spec/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$plan$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/plan/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/constants.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$pay$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/pay/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$share$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/share/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$seo$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/seo/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$types$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/types/index.ts [app-client] (ecmascript) <locals>");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=packages_shared_src_c1bca6f7._.js.map