module.exports = [
"[project]/apps/web/src/hooks/use-updater.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useUpdater",
    ()=>useUpdater
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/tauri-bridge.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
;
/** 初始状态。 */ const INITIAL_STATE = {
    status: 'idle',
    session: null,
    progress: 0,
    downloaded: 0,
    total: 0,
    error: null
};
/** 静默检查延迟(启动后 5 秒,避免与初始化竞争资源)。 */ const SILENT_CHECK_DELAY_MS = 5000;
/**
 * 开发环境测试模式(仅 development):
 * - Tauri 开发环境:自动启用(无需 URL 参数),因为桌面端无法手动加参数
 * - 浏览器开发环境:URL 参数 ?dev-update=1 启用,sessionStorage 持久化(防 HMR 重新加载丢失参数)
 * 生产环境永远返回 false。
 */ const DEV_UPDATE_STORAGE_KEY = 'ihui-dev-update-test';
function isDevUpdateTest() {
    if ("TURBOPACK compile-time truthy", 1) return false;
    //TURBOPACK unreachable
    ;
    const isLocalhost = undefined;
    // 浏览器开发环境:URL 参数 ?dev-update=1 启用,并用 sessionStorage 持久化
    // (Turbopack HMR 重新编译会重新加载页面,可能丢失 URL 参数,sessionStorage 兜底)
    const devParam = undefined;
}
/** 模拟更新会话(开发测试用,15.2MB 假包,~4s 下载完)。 */ function createMockSession() {
    const total = Math.round(15.2 * 1024 * 1024);
    return {
        info: {
            version: '0.2.0',
            date: new Date().toISOString(),
            notes: '新增更新推送功能,支持下拉窗提示和精美动画按钮\n优化桌面端启动性能\n修复若干已知问题'
        },
        downloadAndInstall: async (onProgress)=>{
            let downloaded = 0;
            onProgress?.({
                downloaded: 0,
                total
            });
            const chunkSize = total / 25;
            for(let i = 0; i < 25; i++){
                await new Promise((r)=>setTimeout(r, 150));
                downloaded = Math.min(downloaded + chunkSize, total);
                onProgress?.({
                    downloaded,
                    total
                });
            }
            onProgress?.({
                downloaded: total,
                total
            });
        }
    };
}
function useUpdater() {
    const [state, setState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](INITIAL_STATE);
    const mountedRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](true);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        mountedRef.current = true;
        return ()=>{
            mountedRef.current = false;
        };
    }, []);
    /** 检查更新。silent=true 时不显示 error(静默启动检查)。 */ const checkForUpdate = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (silent = false)=>{
        // 开发测试模式:不依赖 Tauri,直接返回模拟更新
        if (isDevUpdateTest()) {
            setState({
                ...INITIAL_STATE,
                status: 'checking'
            });
            await new Promise((r)=>setTimeout(r, 800));
            if (!mountedRef.current) return;
            setState({
                ...INITIAL_STATE,
                status: 'available',
                session: createMockSession()
            });
            return;
        }
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTauri"])()) return;
        setState({
            ...INITIAL_STATE,
            status: 'checking'
        });
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["checkForUpdates"])();
        if (!mountedRef.current) return;
        if (!session) {
            // 已是最新或检查失败
            setState({
                ...INITIAL_STATE,
                status: 'idle',
                error: silent ? null : 'check_failed'
            });
            return;
        }
        setState({
            ...INITIAL_STATE,
            status: 'available',
            session
        });
    }, []);
    /** 下载并安装更新。 */ const downloadAndInstall = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        if (!state.session) return;
        setState((prev)=>({
                ...prev,
                status: 'downloading',
                progress: 0
            }));
        try {
            await state.session.downloadAndInstall((p)=>{
                if (!mountedRef.current) return;
                const ratio = p.total > 0 ? p.downloaded / p.total : 0;
                setState((prev)=>({
                        ...prev,
                        status: 'downloading',
                        progress: ratio,
                        downloaded: p.downloaded,
                        total: p.total
                    }));
            });
            if (!mountedRef.current) return;
            setState((prev)=>({
                    ...prev,
                    status: 'installing',
                    progress: 1
                }));
            // 安装完成,等待用户点击重启或自动重启
            setState((prev)=>({
                    ...prev,
                    status: 'done'
                }));
        } catch (e) {
            if (!mountedRef.current) return;
            setState((prev)=>({
                    ...prev,
                    status: 'error',
                    error: e instanceof Error ? e.message : String(e)
                }));
        }
    }, [
        state.session
    ]);
    /** 重启应用(安装完成后调用)。 */ const restart = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        if (isDevUpdateTest()) {
            setState(INITIAL_STATE);
            return;
        }
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["restartApp"])();
    }, []);
    /** 关闭提示(回到 idle)。 */ const dismiss = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        setState(INITIAL_STATE);
    }, []);
    // 启动静默检查(Tauri 环境 5 秒后,开发测试模式 1 秒后)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (isDevUpdateTest()) {
            const timer = setTimeout(()=>void checkForUpdate(true), 1000);
            return ()=>clearTimeout(timer);
        }
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTauri"])()) return;
        const timer = setTimeout(()=>{
            void checkForUpdate(true);
        }, SILENT_CHECK_DELAY_MS);
        return ()=>clearTimeout(timer);
    }, [
        checkForUpdate
    ]);
    // 监听托盘菜单 "检查更新" 事件(由 useDesktopEvents 转发的 CustomEvent)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTauri"])() && !isDevUpdateTest()) return;
        const handler = ()=>void checkForUpdate(false);
        window.addEventListener('desktop-check-update', handler);
        return ()=>window.removeEventListener('desktop-check-update', handler);
    }, [
        checkForUpdate
    ]);
    return {
        ...state,
        checkForUpdate,
        downloadAndInstall,
        restart,
        dismiss
    };
}
}),
"[project]/apps/web/src/hooks/use-intersection-observer.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useIntersectionObserver",
    ()=>useIntersectionObserver,
    "useLazyImage",
    ()=>useLazyImage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useIntersectionObserver(options) {
    const ref = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    const [isIntersecting, setIntersecting] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const observer = undefined;
    }, [
        options?.root,
        options?.rootMargin,
        options?.threshold
    ]);
    return {
        ref,
        isIntersecting
    };
}
function useLazyImage() {
    const { ref, isIntersecting } = useIntersectionObserver({
        threshold: 0.1
    });
    const [src, setSrc] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    const [isLoaded, setLoaded] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (isIntersecting && ref.current) {
            const dataSrc = ref.current.dataset.src;
            if (dataSrc) {
                setSrc(dataSrc);
                setLoaded(true);
            }
        }
    }, [
        isIntersecting,
        ref
    ]);
    return {
        ref,
        isLoaded,
        src
    };
}
}),
"[project]/apps/web/src/hooks/use-analytics.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAnalytics",
    ()=>useAnalytics
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
;
function useAnalytics() {
    const bufferRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"]([]);
    const flushTimerRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    const flush = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        if (bufferRef.current.length === 0) return;
        const batch = bufferRef.current.splice(0, bufferRef.current.length);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/analytics/track', {
            method: 'POST',
            body: JSON.stringify({
                events: batch
            })
        });
    }, []);
    const scheduleFlush = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(flush, 5000);
    }, [
        flush
    ]);
    const track = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((event)=>{
        bufferRef.current.push({
            ...event,
            props: {
                ...event.props,
                ts: Date.now()
            }
        });
        if (bufferRef.current.length >= 20) {
            void flush();
        } else {
            scheduleFlush();
        }
    }, [
        flush,
        scheduleFlush
    ]);
    const trackPageView = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((path, title)=>{
        track({
            name: 'page_view',
            category: 'navigation',
            label: title ?? path,
            props: {
                path
            }
        });
    }, [
        track
    ]);
    const trackClick = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((label, category = 'ui')=>{
        track({
            name: 'click',
            category,
            label
        });
    }, [
        track
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        return ()=>{
            if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
            void flush();
        };
    }, [
        flush
    ]);
    return {
        track,
        trackPageView,
        trackClick,
        flush
    };
}
}),
"[project]/apps/web/src/hooks/use-route-analytics.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRouteAnalytics",
    ()=>useRouteAnalytics
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$analytics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-analytics.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
function useRouteAnalytics() {
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    const { track, trackPageView, flush } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$analytics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAnalytics"])();
    const enterTimeRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](Date.now());
    const prevPathRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"]('');
    // 路由变化追踪
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        const path = pathname ?? '/';
        if (!path) return;
        // 结束上一页停留时间追踪
        if (prevPathRef.current && prevPathRef.current !== path) {
            const duration = Math.round((Date.now() - enterTimeRef.current) / 1000);
            track({
                name: 'page_time',
                category: 'user_engagement',
                value: duration,
                label: prevPathRef.current
            });
        }
        // 页面浏览
        trackPageView(path);
        // 路由切换事件
        track({
            name: 'route_change',
            category: 'navigation',
            label: path,
            props: {
                from: prevPathRef.current,
                to: path
            }
        });
        prevPathRef.current = path;
        enterTimeRef.current = Date.now();
    }, [
        pathname,
        track,
        trackPageView
    ]);
    // beforeunload flush
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const handleBeforeUnload = undefined;
    }, [
        track,
        flush
    ]);
    // 不再返回 currentPath,避免调用方订阅 usePathname 触发重渲染
    return {};
}
}),
"[project]/apps/web/src/hooks/use-global-shortcuts.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGlobalShortcuts",
    ()=>useGlobalShortcuts
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
const DEFAULT_SHORTCUTS = [
    // Ctrl+K 区分作用域:编辑器聚焦 → inline-edit;其他 → 命令面板(open-chat)
    {
        key: 'Ctrl+K',
        description: '命令面板 / 行内编辑',
        event: '__cmd_k__'
    },
    {
        key: 'Ctrl+P',
        description: '搜索',
        event: 'global-shortcut:search'
    },
    {
        key: 'Ctrl+Shift+N',
        description: '新建对话',
        event: 'global-shortcut:new-chat'
    },
    {
        key: 'Ctrl+/',
        description: '快捷键帮助',
        event: '__toggle_help__'
    },
    {
        key: 'Ctrl+Shift+D',
        description: '短剧编辑器',
        event: 'global-shortcut:open-drama'
    },
    // 2026-07-30 用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"
    // VS Code 标准命令面板快捷键:Ctrl+Shift+P 打开 Plus 命令面板(视图/工具/设置切换)
    // 设计依据:① VS Code 用户最熟悉 ② 不与项目已有 Ctrl+P(搜索)冲突(matchShortcut 修复后严格区分 shift)
    // ③ 用户在面板内输入字符过滤 + ↑↓ 导航 + Enter 确认,完整覆盖 9 项菜单访问
    {
        key: 'Ctrl+Shift+P',
        description: '命令面板(视图切换)',
        event: 'global-shortcut:open-plus'
    },
    // VS Code 标准设置快捷键:Ctrl+, 直接打开设置页(高频入口,免命令面板搜索)
    {
        key: 'Ctrl+,',
        description: '打开设置',
        event: 'global-shortcut:open-settings'
    },
    // 对话模式切换(2026-07-28 立,补全 ChatMode 4态三通道)
    // Ctrl+1/2/3/4 切换 build/plan/review/spec,仅在 AI 面板打开时生效(由 ai-side-panel 监听 keydown)
    // 全局注册主要用于帮助面板展示 + 统一 preventDefault 阻止浏览器 tab 切换默认行为
    {
        key: 'Ctrl+1',
        description: '切换到构建模式',
        event: 'global-shortcut:mode-build'
    },
    {
        key: 'Ctrl+2',
        description: '切换到计划模式',
        event: 'global-shortcut:mode-plan'
    },
    {
        key: 'Ctrl+3',
        description: '切换到审查模式',
        event: 'global-shortcut:mode-review'
    },
    {
        key: 'Ctrl+4',
        description: '切换到规格模式',
        event: 'global-shortcut:mode-spec'
    }
];
// ============================================================================
// 快捷键匹配
// ============================================================================
/** 判断键盘事件是否匹配快捷键组合（格式如 "Ctrl+K"、"Ctrl+Shift+N"）
 *
 * 2026-07-30 严格匹配修复(用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"):
 * - 修复前:wantShift=false 时不检查 shiftKey,导致 Ctrl+P 会匹配 Ctrl+Shift+P 按键事件
 *   → 注册 Ctrl+Shift+P 永远不触发(被 Ctrl+P 先 break)
 * - 修复后:未指定的 modifier 必须为 false(严格匹配),让 Ctrl+P 与 Ctrl+Shift+P 严格区分
 * - 影响审计:现有快捷键全部 wantShift=true 或 wantShift=false 的纯 Ctrl 组合,
 *   修复后行为更精确(用户按 Ctrl+Shift+K 不再误触 Ctrl+K),无回归风险
 *
 * 2026-07-30 Mac 兼容性优化(用户规则:"继续按你的建议去做执行 完美细致完整毫无遗漏"):
 * - 优化前:wantCtrl 严格匹配 ctrlKey,Mac 用户按 Cmd+X 不触发 Ctrl+X 注册的快捷键
 *   (Tooltip 显示 ⌘⇧P 但实际监听只支持 Ctrl,UI 与行为不一致)
 * - 优化后:Mac 上 wantCtrl 接受 ctrlKey || metaKey(Cmd),与 VS Code 标准行为一致
 *   (VS Code 在 Mac 上 Cmd+P = 搜索,Cmd+Shift+P = 命令面板,跟 Win/Linux Ctrl+P 等价)
 * - 严格匹配仍保留:Mac 上 wantCtrl=true 时,"未声明 cmd 但按了 metaKey"不返回 false
 *   (因为 wantCtrl 在 Mac 上接受 metaKey,这是合法行为)
 * - 无回归风险:Windows/Linux 上 wantCtrl 仍只接受 ctrlKey,行为不变
 */ function matchShortcut(event, keyCombo) {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const parts = keyCombo.toLowerCase().split('+');
    const targetKey = parts.pop();
    if (!targetKey) return false;
    const wantCtrl = parts.includes('ctrl');
    const wantCmd = parts.includes('cmd') || parts.includes('meta');
    const wantShift = parts.includes('shift');
    const wantAlt = parts.includes('alt');
    const wantMod = parts.includes('mod');
    if (wantMod) {
        if (isMac ? !event.metaKey : !event.ctrlKey) return false;
    }
    // Mac 兼容性(2026-07-30):Mac 上 wantCtrl 接受 ctrlKey || metaKey(Cmd),
    // 让 Mac 用户用 Cmd+X 触发 Ctrl+X 注册的快捷键(VS Code 标准行为)
    // Windows/Linux 上 wantCtrl 仍只接受 ctrlKey
    if (wantCtrl && !wantMod) {
        if (isMac) {
            if (!event.metaKey && !event.ctrlKey) return false;
        } else {
            if (!event.ctrlKey) return false;
        }
    }
    if (wantCmd && !event.metaKey) return false;
    if (wantShift && !event.shiftKey) return false;
    if (wantAlt && !event.altKey) return false;
    // 严格匹配:未在组合中声明的 modifier 必须为 false
    // (修复前缺失此约束,导致 Ctrl+P 误匹配 Ctrl+Shift+P,Ctrl+Shift+P 永不触发)
    // Mac 兼容性(2026-07-30):wantCtrl=true 时,metaKey 是合法的,不返回 false
    if (!wantCtrl && !wantMod && event.ctrlKey && !event.metaKey) return false;
    if (!wantCmd && !wantMod && event.metaKey && !event.ctrlKey) {
        // Mac 上 wantCtrl=true 时,metaKey 是合法的(wantCtrl 接受 metaKey),不返回 false
        if (!(isMac && wantCtrl)) return false;
    }
    if (!wantShift && event.shiftKey) return false;
    if (!wantAlt && event.altKey) return false;
    return event.key.toLowerCase() === targetKey;
}
function useGlobalShortcuts() {
    const [scope, setScopeState] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]('global');
    const [showHelpPanel, setHelpPanel] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const shortcutsRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](new Map());
    const toggleHelpPanelRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](()=>{});
    const listenersRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](new Set());
    const versionRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](0);
    const subscribe = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((cb)=>{
        listenersRef.current.add(cb);
        return ()=>{
            listenersRef.current.delete(cb);
        };
    }, []);
    const emitChange = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        versionRef.current++;
        listenersRef.current.forEach((l)=>l());
    }, []);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSyncExternalStore"](subscribe, ()=>versionRef.current, ()=>versionRef.current);
    const toggleHelpPanel = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        setHelpPanel((v)=>!v);
    }, []);
    toggleHelpPanelRef.current = toggleHelpPanel;
    const setScope = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((s)=>{
        setScopeState(s);
    }, []);
    const registerShortcut = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((key, handler, sc)=>{
        shortcutsRef.current.set(key, {
            handler,
            scope: sc ?? 'global'
        });
        emitChange();
        return ()=>{
            shortcutsRef.current.delete(key);
            emitChange();
        };
    }, [
        emitChange
    ]);
    const unregisterShortcut = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((key)=>{
        shortcutsRef.current.delete(key);
        emitChange();
    }, [
        emitChange
    ]);
    // 注册默认快捷键
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        for (const def of DEFAULT_SHORTCUTS){
            const handler = ()=>{
                if (def.event === '__toggle_help__') {
                    toggleHelpPanelRef.current();
                } else if (def.event === '__cmd_k__') {
                    // Ctrl+K 作用域判断:
                    // - Monaco 编辑器聚焦 → 不派发(由 use-ide-shortcuts 直接派发 inline-edit)
                    // - 其他场景 → 派发 open-chat(命令面板,向后兼容)
                    if ("TURBOPACK compile-time truthy", 1) return;
                    //TURBOPACK unreachable
                    ;
                    const active = undefined;
                    const inMonaco = undefined;
                } else if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
                ;
            };
            shortcutsRef.current.set(def.key, {
                handler,
                scope: 'global',
                description: def.description
            });
        }
        emitChange();
    // 默认快捷键在组件卸载时由 GC 回收，无需手动清理
    }, [
        emitChange
    ]);
    // 全局 keydown 监听
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const onKeyDown = undefined;
    }, [
        scope
    ]);
    const shortcuts = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>Array.from(shortcutsRef.current.entries()).map(([key, entry])=>({
                key,
                scope: entry.scope,
                description: entry.description,
                active: entry.scope === 'global' || entry.scope === scope
            })), [
        scope
    ]);
    return {
        registerShortcut,
        unregisterShortcut,
        setScope,
        scope,
        showHelpPanel,
        toggleHelpPanel,
        shortcuts
    };
}
}),
"[project]/apps/web/src/hooks/use-websocket.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useWebSocket",
    ()=>useWebSocket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$notifications$2f$use$2d$notification$2d$websocket$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/notifications/use-notification-websocket.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/types/src/index.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
;
;
;
function useWebSocket() {
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])((s)=>s.token);
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            baseUrl: ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : '',
            tokenProvider: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().token
        }), []);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$notifications$2f$use$2d$notification$2d$websocket$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNotificationWebSocket"])(token, config);
}
}),
"[project]/apps/web/src/hooks/use-global-notification.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGlobalNotification",
    ()=>useGlobalNotification
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/notification.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$websocket$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-websocket.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/notification.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
function useGlobalNotification() {
    const unreadCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNotificationStore"])((s)=>s.unreadCount);
    const unreadMessageCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNotificationStore"])((s)=>s.unreadMessageCount);
    const handleWsMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNotificationStore"])((s)=>s.handleWsMessage);
    const markAllRead = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNotificationStore"])((s)=>s.markAllAsRead);
    const clearAll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNotificationStore"])((s)=>s.clearAll);
    const setUnreadCounts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNotificationStore"])((s)=>s.setUnreadCounts);
    const isAuthenticated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])((s)=>s.isAuthenticated);
    const [visible, setVisible] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const { lastMessage } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$websocket$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useWebSocket"])();
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        handleWsMessage(lastMessage);
    }, [
        lastMessage,
        handleWsMessage
    ]);
    // 登录后从 API 初始化未读计数(仅一次,避免角标在 WS 推送前为 0)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!isAuthenticated) return;
        let cancelled = false;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getUnreadCount"])().then((res)=>{
            if (cancelled || !res.success || !res.data) return;
            setUnreadCounts({
                notifications: res.data.notification ?? 0,
                messages: res.data.message ?? 0
            });
        }).catch(()=>{
        // 静默失败:接口不可用时不影响 UI
        });
        return ()=>{
            cancelled = true;
        };
    }, [
        isAuthenticated,
        setUnreadCounts
    ]);
    return {
        unreadCount,
        unreadMessageCount,
        visible,
        setVisible,
        markAllRead,
        clearAll
    };
}
}),
"[project]/apps/web/src/hooks/use-auth-bootstrap.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAuthBootstrap",
    ()=>useAuthBootstrap
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$user$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/user.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/cookie-utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/auth.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
/**
 * 用 refreshToken 调 /api/auth/refresh 获取新 accessToken。
 * 成功返回 { accessToken, refreshToken },失败返回 null 并清理 refresh cookie。
 * 这是"自动登录"的核心:浏览器关闭再打开后,refreshToken cookie(30d)仍在,
 * 自动换取新 token 实现免密登录。
 */ async function tryRefresh() {
    const refreshToken = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getRefreshTokenCookie"])();
    if (!refreshToken) return null;
    try {
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["refreshAccessToken"])(refreshToken);
        if (!r.success || !r.data?.accessToken) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearRefreshTokenCookie"])();
            return null;
        }
        return {
            accessToken: r.data.accessToken,
            refreshToken: r.data.refreshToken
        };
    } catch  {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearRefreshTokenCookie"])();
        return null;
    }
}
function useAuthBootstrap() {
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])((s)=>s.token);
    const isAuthenticated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])((s)=>s.isAuthenticated);
    const setUser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])((s)=>s.setUser);
    const setToken = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])((s)=>s.setToken);
    const logout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])((s)=>s.logout);
    const fetchProfile = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$user$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useUserStore"])((s)=>s.fetchProfile);
    const [ready, setReady] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const [error, setError] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        let cancelled = false;
        async function bootstrap() {
            // 从 cookie 读取 token（SSR 场景下 store 尚未水合）
            let storedToken = token;
            if (!storedToken && typeof document !== 'undefined') {
                const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
                storedToken = match ? decodeURIComponent(match[1]) : null;
            }
            // 无 accessToken:尝试用 refreshToken 自动登录(自动登录闭环)
            if (!storedToken) {
                const refreshed = await tryRefresh();
                if (cancelled) return;
                if (refreshed) {
                    storedToken = refreshed.accessToken;
                    setToken(refreshed.accessToken, refreshed.refreshToken ?? null);
                } else {
                    setReady(true);
                    return;
                }
            }
            // 🎭 Mock 模式: token 以 mock_ 开头时,跳过 /auth/me API 调用
            if (storedToken.startsWith('mock_')) {
                setToken(storedToken, null);
                const mockUserCookie = document.cookie.match(/(?:^|;\s*)mock_user_info=([^;]+)/);
                if (mockUserCookie && mockUserCookie[1]) {
                    try {
                        const decoded = decodeURIComponent(escape(atob(decodeURIComponent(mockUserCookie[1]))));
                        const mockUser = JSON.parse(decoded);
                        setUser(mockUser);
                    } catch  {
                    /* base64 解析失败时,token 仍然标记已认证,user 留空 */ }
                }
                if (!cancelled) setReady(true);
                return;
            }
            setToken(storedToken, null);
            try {
                const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/auth/me');
                if (cancelled) return;
                if (res.success) {
                    const u = res.data.user;
                    // 保留 roleId(后端 publicUser 已返回),admin layout 守卫需用它判断权限
                    setUser({
                        id: u.id,
                        nickname: u.nickname,
                        avatar: u.avatar,
                        phone: u.phone,
                        roleId: u.roleId,
                        username: u.username,
                        status: u.status
                    });
                    await fetchProfile();
                } else {
                    // token 失效:尝试 refreshToken 自动续期(自动登录闭环)
                    const refreshed = await tryRefresh();
                    if (cancelled) return;
                    if (refreshed) {
                        setToken(refreshed.accessToken, refreshed.refreshToken ?? null);
                        const retry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/auth/me');
                        if (!cancelled && retry.success) {
                            const u = retry.data.user;
                            setUser({
                                id: u.id,
                                nickname: u.nickname,
                                avatar: u.avatar,
                                phone: u.phone,
                                roleId: u.roleId,
                                username: u.username,
                                status: u.status
                            });
                            await fetchProfile();
                        } else {
                            logout();
                        }
                    } else {
                        logout();
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : '引导失败');
                }
            } finally{
                if (!cancelled) setReady(true);
            }
        }
        bootstrap();
        return ()=>{
            cancelled = true;
        };
    // 仅在挂载时执行一次
    }, []);
    return {
        ready,
        isAuthenticated,
        error
    };
}
}),
"[project]/apps/web/src/hooks/use-desktop.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDesktop",
    ()=>useDesktop,
    "useDesktopEvents",
    ()=>useDesktopEvents,
    "useSystemTheme",
    ()=>useSystemTheme,
    "useTrayStatus",
    ()=>useTrayStatus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/tauri-bridge.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
;
function useDesktop() {
    // 2026-07-26 用户反馈(第六次):useState(() => isTauri()) 在静态导出 + Tauri 2.x 异步注入时机下
    //   第一次 render 时 window.__TAURI_INTERNALS__ 尚未注入,isDesktop 始终为 false,
    //   MainShell 标题栏 `isDesktop && (...)` 永不渲染。
    // 修复:用 useState(false) 初始值 + useEffect 异步检测,避免 hydration mismatch。
    // 浏览器端 useEffect 永远检测不到,稳定返回 false,不影响 SSR/CSR 一致性。
    // 2026-07-29:withGlobalTauri 关闭后,__TAURI__ 不再注入,isTauri() 只检查
    //   __TAURI_INTERNALS__,轮询逻辑不变(本就依赖此标识的注入时机)。
    const [isDesktop, setIsDesktop] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const [appInfo, setAppInfo] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    const [isMaximized, setIsMaximized] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const [autostartEnabled, setAutostartEnabled] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const [loading, setLoading] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](true);
    // 初始化:挂载后探测 Tauri(避免 hydration mismatch)
    // 2026-07-28 优化:原 10 秒超时太长,首启桌面端 UI(窗口控制按钮/resize/拖拽)10 秒内不显示
    //   - Tauri 2.x 在 Windows 上注入 __TAURI_INTERNALS__ 通常 100-500ms 内完成
    //   - 缩短到 3 秒超时,50ms 间隔轮询,正常情况 100-500ms 内检测到
    //   - 浏览器端永远检测不到,稳定 false
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        let cancelled = false;
        const start = Date.now();
        const TIMEOUT_MS = 3000;
        const INTERVAL_MS = 50;
        const check = ()=>{
            if (cancelled) return;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTauri"])()) {
                setIsDesktop(true);
                return;
            }
            if (Date.now() - start > TIMEOUT_MS) {
                // 浏览器端或 Tauri 注入失败,保持 false
                return;
            }
            setTimeout(check, INTERVAL_MS);
        };
        check();
        return ()=>{
            cancelled = true;
        };
    }, []);
    // 初始化:加载 appInfo + 窗口状态 + 自启状态
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!isDesktop) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        void (async ()=>{
            const [info, maximized, autostart] = await Promise.all([
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getDesktopAppInfo"])(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isWindowMaximized"])(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAutostartEnabled"])()
            ]);
            if (cancelled) return;
            setAppInfo(info);
            setIsMaximized(maximized);
            setAutostartEnabled(autostart);
            setLoading(false);
        })();
        return ()=>{
            cancelled = true;
        };
    }, [
        isDesktop
    ]);
    // 监听窗口最大化状态变化(Resize 事件)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!isDesktop) return;
        const onResize = ()=>{
            void (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isWindowMaximized"])().then(setIsMaximized);
        };
        window.addEventListener('resize', onResize);
        return ()=>window.removeEventListener('resize', onResize);
    }, [
        isDesktop
    ]);
    const minimize = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["minimizeWindow"])();
    }, []);
    const toggleMaximize = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        const next = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["toggleMaximizeWindow"])();
        setIsMaximized(next);
    }, []);
    const close = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["closeWindow"])();
    }, []);
    const toggleAutostart = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        if (autostartEnabled) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["disableAutostart"])();
            setAutostartEnabled(false);
        } else {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["enableAutostart"])();
            setAutostartEnabled(true);
        }
    }, [
        autostartEnabled
    ]);
    const resetWindow = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["resetWindowState"])();
    }, []);
    const notify = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (title, body)=>{
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendDesktopNotification"])(title, body);
    }, []);
    return {
        isDesktop,
        appInfo,
        isMaximized,
        autostartEnabled,
        loading,
        minimize,
        toggleMaximize,
        close,
        toggleAutostart,
        resetWindow,
        notify
    };
}
function useSystemTheme() {
    const [systemTheme, setSystemTheme] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTauri"])()) return;
        let cancelled = false;
        // 挂载时一次性获取当前系统主题
        void (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSystemTheme"])().then((theme)=>{
            if (cancelled) return;
            if (theme) setSystemTheme(theme);
        });
        // 监听 OS 主题切换事件(onSystemThemeChange 返回同步清理函数)
        const unlisten = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["onSystemThemeChange"])((theme)=>{
            setSystemTheme(theme);
        });
        return ()=>{
            cancelled = true;
            unlisten();
        };
    }, []);
    return systemTheme;
}
function useDesktopEvents() {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTauri"])()) return;
        // 动态 import 避免浏览器端加载 Tauri event API
        let unlistenTray;
        let unlistenShortcut;
        let unlistenBeforeClose;
        let cancelled = false;
        void (async ()=>{
            const { listen } = await __turbopack_context__.A("[project]/node_modules/.pnpm/@tauri-apps+api@2.11.1/node_modules/@tauri-apps/api/event.js [app-ssr] (ecmascript, async loader)");
            if (cancelled) return;
            // 托盘菜单事件
            unlistenTray = await listen('desktop-tray-action', (event)=>{
                const action = event.payload;
                switch(action){
                    case 'new_chat':
                        // 复用浏览器内 Ctrl+Shift+N 相同的 CustomEvent
                        window.dispatchEvent(new CustomEvent('global-shortcut:new-chat'));
                        break;
                    case 'toggle_theme':
                        window.dispatchEvent(new CustomEvent('desktop-theme-toggle'));
                        break;
                    case 'open_settings':
                        window.dispatchEvent(new CustomEvent('desktop-open-settings'));
                        break;
                    case 'check_update':
                        window.dispatchEvent(new CustomEvent('desktop-check-update'));
                        break;
                }
            });
            // 系统级快捷键事件
            unlistenShortcut = await listen('desktop-shortcut', (event)=>{
                const action = event.payload;
                switch(action){
                    case 'new_chat':
                        // 窗口聚焦时浏览器内 keydown 也会触发,前端去重由 use-global-shortcuts 处理
                        window.dispatchEvent(new CustomEvent('global-shortcut:new-chat'));
                        break;
                    case 'quick_screenshot':
                        window.dispatchEvent(new CustomEvent('desktop-quick-screenshot'));
                        break;
                }
            });
            // 2026-07-29 #12:窗口关闭前事件,前端保存正在编辑的消息
            unlistenBeforeClose = await listen('desktop-before-close', ()=>{
                window.dispatchEvent(new CustomEvent('desktop-before-close'));
            });
        })();
        return ()=>{
            cancelled = true;
            unlistenTray?.();
            unlistenShortcut?.();
            unlistenBeforeClose?.();
        };
    }, []);
}
function useTrayStatus(isStreaming, unreadCount) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTauri"])()) return;
        if (isStreaming) {
            void (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setTrayStatus"])('thinking');
        } else if (unreadCount > 0) {
            void (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setTrayStatus"])('new_message');
        } else {
            void (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setTrayStatus"])('idle');
        }
    }, [
        isStreaming,
        unreadCount
    ]);
}
}),
"[project]/apps/web/src/hooks/use-toast.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLoading",
    ()=>useLoading,
    "useToast",
    ()=>useToast
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript)");
'use client';
;
;
function useToast() {
    const success = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((message, description)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success(message, description ? {
            description
        } : undefined), []);
    const error = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((message, description)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(message, description ? {
            description
        } : undefined), []);
    const warning = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((message, description)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(message, description ? {
            description
        } : undefined), []);
    const info = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((message, description)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].info(message, description ? {
            description
        } : undefined), []);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            toast: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"],
            success,
            error,
            warning,
            info
        }), [
        success,
        error,
        warning,
        info
    ]);
}
// 加载状态管理
let loadingCount = 0;
const loadingListeners = new Set();
function useLoading() {
    const setLoading = (loading)=>{
        if (loading) {
            loadingCount++;
        } else {
            loadingCount = Math.max(0, loadingCount - 1);
        }
        const isLoading = loadingCount > 0;
        loadingListeners.forEach((fn)=>fn(isLoading));
    };
    const withLoading = async (fn)=>{
        setLoading(true);
        try {
            return await fn();
        } finally{
            setLoading(false);
        }
    };
    return {
        setLoading,
        withLoading
    };
}
}),
"[project]/apps/web/src/hooks/use-third-party-auth.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isDemoMode",
    ()=>isDemoMode,
    "useThirdPartyAuth",
    ()=>useThirdPartyAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$third$2d$party$2d$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/third-party-config.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/oauth-utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$domains$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/auth-domains.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-toast.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
;
/** 平台展示名 */ const PLATFORM_DISPLAY_NAMES = {
    google: 'Google',
    apple: 'Apple',
    dingtalk: '钉钉',
    enterpriseWechat: '企业微信',
    wechat: '微信',
    github: 'GitHub',
    feishu: '飞书',
    alipay: '支付宝'
};
/** Google GIS SDK 脚本地址 */ const GOOGLE_GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
/** 最大重试次数 */ const MAX_RETRY = 5;
/** OAuth 回调后端入口（按平台） */ function callbackPath(platform) {
    return `/api/auth/${platform}/callback`;
}
/**
 * 判断平台是否配置了真实凭据(非 placeholder)。
 * 用于 demo 模式下区分:有真凭据走真 OAuth,无真凭据走本地 mock。
 * placeholder 命名约定:dev_xxx_placeholder_xxx
 */ function hasRealCredentials(platform) {
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$third$2d$party$2d$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getPlatformConfig"])(platform);
    const id = config.clientId || config.appId || '';
    if (!id) return false;
    if (id.startsWith('dev_') && id.includes('placeholder')) return false;
    return true;
}
/** 绑定账号后端入口 */ const BIND_PATH = '/api/user/bind-third-party';
/** 解绑账号后端入口 */ const UNBIND_PATH = '/api/user/unbind-third-party';
/** 已绑定账号列表后端入口 */ const BOUND_ACCOUNTS_PATH = '/api/user/third-party-accounts';
function isDemoMode() {
    // 🛡️ 生产环境硬性约束:无论 env 怎么设,都强制关闭 demo 模式
    // 防止开发者忘记关 demo 导致生产环境任何人点登录按钮都绕过真实授权直接登录
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // 直接字面量引用,让 Next.js 编译器静态替换
    const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    if (demoMode === 'true') {
        return true;
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return false;
}
/** 构造演示模式下的本地回退登录数据（仅开发环境） */ function buildFallbackLoginData(platform) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return {
        token: `dev_${platform}_${Date.now()}`,
        user: {
            id: `${platform}_local_user`,
            username: `${platform}_local_user`,
            email: 'local@example.com',
            nickname: `${PLATFORM_DISPLAY_NAMES[platform]}本地登录`,
            avatar: '/images/common/empty.svg',
            isVip: false,
            inviteCode: 'LOCALTP',
            createTime: new Date().toISOString()
        }
    };
}
/** 登录成功后将 token/user 写入 auth store */ function applyLoginData(data) {
    const { setToken, setUser } = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState();
    setToken(data.token, data.refreshToken);
    const user = {
        id: data.user.id,
        nickname: data.user.nickname,
        avatar: data.user.avatar,
        phone: undefined
    };
    setUser(user);
}
function useThirdPartyAuth() {
    const toast = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useToast"])();
    const [loginStates, setLoginStates] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]({});
    const [boundAccounts, setBoundAccounts] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]([]);
    const [isLoading, setIsLoading] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const [currentPlatform, setCurrentPlatform] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    // Google One Tap 回调引用
    const oneTapCallbackRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    // ---- 计算属性 ----
    const enabledPlatforms = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>{
        const configs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$third$2d$party$2d$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getAllPlatformConfigs"])();
        return Object.keys(configs).filter((p)=>configs[p].enabled);
    }, []);
    const isAnyPlatformEnabled = enabledPlatforms.length > 0;
    const isPlatformEnabled = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform)=>{
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$third$2d$party$2d$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getPlatformConfig"])(platform)?.enabled === true;
    }, []);
    const isBound = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform)=>boundAccounts.some((a)=>a.platform === platform && a.status === 'active'), [
        boundAccounts
    ]);
    const getBoundAccount = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform)=>boundAccounts.find((a)=>a.platform === platform && a.status === 'active') ?? null, [
        boundAccounts
    ]);
    const getPlatformDisplayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform)=>PLATFORM_DISPLAY_NAMES[platform] ?? platform, []);
    // ---- 状态管理 ----
    const initLoginState = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform)=>{
        const state = {
            platform,
            status: 'pending',
            retryCount: 0
        };
        setLoginStates((prev)=>({
                ...prev,
                [platform]: state
            }));
        setCurrentPlatform(platform);
        return state;
    }, []);
    const updateLoginState = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform, updates)=>{
        setLoginStates((prev)=>{
            const cur = prev[platform];
            if (!cur) return prev;
            return {
                ...prev,
                [platform]: {
                    ...cur,
                    ...updates
                }
            };
        });
    }, []);
    const clearLoginState = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform)=>{
        setLoginStates((prev)=>{
            const next = {
                ...prev
            };
            delete next[platform];
            return next;
        });
        setCurrentPlatform((cur)=>cur === platform ? null : cur);
    }, []);
    // ---- 登录流程 ----
    /**
   * 构造授权 URL（含 state CSRF 防护）并重定向。
   * 优先使用后端代理入口（proxyPath）；演示模式或配置完整时直接跳转厂商授权页。
   */ const startLogin = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (platform)=>{
        const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform;
        try {
            setIsLoading(true);
            if (!isPlatformEnabled(platform)) {
                throw new Error(`${displayName}登录未启用`);
            }
            // 演示模式 + 无真实凭据:跳转到本地 Mock 授权页,完整模拟 OAuth 流程
            // 用户在 mock 页点"授权" → 跳回 /callback?code=mock_xxx&state=xxx
            // callback handler 识别 mock_ 前缀 → 直接本地登录
            // 有真实凭据(Google/GitHub/微信/钉钉/企业微信等)时跳过 mock,走真 OAuth 流程
            if (isDemoMode() && !hasRealCredentials(platform)) {
                const state = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["generateState"])();
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["saveOAuthState"])(platform, state);
                const redirectUri = `/callback?platform=${platform}`;
                const appName = encodeURIComponent('IHUI-AI');
                const mockUrl = `/oauth/mock/${platform}?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}&app_name=${appName}`;
                window.location.href = mockUrl;
                return true;
            }
            // 分域 SSO (2026-07-21):仅在生产主域(aizhs.top)上启用,
            // 主域用户点登录 → 302 跳到 bsm.aizhs.top/sso/auth?platform=xxx,
            // 由该子域薄页调用本函数发起 OAuth,回调时写跨域 Cookie + 307 跳回主域。
            // ⚠️ 本地开发(localhost / 127.0.0.1)跳过分域 SSO,直接走本地 OAuth 流程,
            // 否则跳到线上 bsm.aizhs.top(那里是另一个部署,本地代码改动不生效)
            // ⚠️ 2026-07-22 临时禁用:bsm.aizhs.top cloudflared 隧道 502(路由指向 localhost:3000
            // 但 web 实际跑 8801),需 Cloudflare 控制台修复路由后再恢复
            // 禁用后 aizhs.top 主域直接处理 OAuth,redirect_uri = https://aizhs.top/callback?platform=xxx
            if (false && "undefined" !== 'undefined' && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$domains$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isAuthSubdomainHost"])() && (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$domains$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isMainDomainHost"])()) //TURBOPACK unreachable
            ;
            // 初始化登录状态
            initLoginState(platform);
            const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$third$2d$party$2d$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getPlatformConfig"])(platform);
            const state = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["generateState"])();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["saveOAuthState"])(platform, state);
            // 配置完整 → 直接构造厂商授权 URL(真实 OAuth 流程)
            const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$third$2d$party$2d$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validatePlatformConfig"])(platform);
            const canDirectRedirect = validation.valid && !!config.authUrl && !!(config.clientId || config.appId);
            if (canDirectRedirect && config.authUrl) {
                const params = {
                    redirect_uri: config.redirectUri,
                    response_type: 'code',
                    state
                };
                // 各平台 appid 参数名差异:
                // - 支付宝:app_id
                // - 微信扫码(qrconnect)/ 企业微信(qrConnect):appid(不是 client_id)
                // - 其他(Google/Apple/钉钉/GitHub/飞书):client_id
                if (platform === 'alipay') {
                    params.app_id = config.appId || '';
                } else if (platform === 'wechat' || platform === 'enterpriseWechat') {
                    params.appid = config.appId || '';
                    // 企业微信 qrConnect 必须带 agentid(自建应用 ID)
                    if (platform === 'enterpriseWechat' && config.agentId) {
                        params.agentid = String(config.agentId);
                    }
                } else {
                    params.client_id = config.clientId || config.appId || '';
                }
                if (config.scope) params.scope = config.scope;
                // Apple 需要 response_mode
                if (platform === 'apple') params.response_mode = 'form_post';
                // Google 额外参数
                if (platform === 'google') {
                    params.access_type = 'offline';
                    params.prompt = 'consent';
                    params.include_granted_scopes = 'true';
                }
                let url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildAuthUrl"])(config.authUrl, params);
                // 微信扫码授权链接必须以 #wechat_redirect 结尾,否则报 "redirect_uri 参数错误"
                if (platform === 'wechat') url += '#wechat_redirect';
                if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
                ;
                return true;
            }
            // 回退：走后端代理入口（state 由后端接管）
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(`${PLATFORM_DISPLAY_NAMES[platform] ?? platform}登录启动失败`, msg);
            updateLoginState(platform, {
                status: 'failed',
                error: msg
            });
            return false;
        } finally{
            setIsLoading(false);
        }
    }, [
        initLoginState,
        isPlatformEnabled,
        toast,
        updateLoginState
    ]);
    /**
   * 处理登录成功：将 token/user 写入 auth store，刷新绑定列表。
   */ const handleLoginSuccess = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (platform, data)=>{
        const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform;
        try {
            updateLoginState(platform, {
                status: 'success'
            });
            applyLoginData(data);
            toast.success(`${displayName}登录成功`);
            clearLoginState(platform);
            await refreshBoundAccountsImpl(setBoundAccounts, toast);
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            updateLoginState(platform, {
                status: 'failed',
                error: msg
            });
            toast.error(`${displayName}登录处理失败`, msg);
            return false;
        }
    }, [
        clearLoginState,
        toast,
        updateLoginState
    ]);
    /**
   * 处理 OAuth 回调：校验 state → 调用后端 → 写入 auth store。
   * 演示模式或后端失败时回退为本地数据。
   */ const handleCallback = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (platform, code, state)=>{
        const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform;
        if (!code) {
            toast.error(`${displayName}登录失败`, '缺少必要的 code 参数');
            return false;
        }
        // 校验 state 防 CSRF
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateOAuthState"])(platform, state)) {
            toast.error(`${displayName}登录失败`, 'state 参数验证失败');
            updateLoginState(platform, {
                status: 'failed',
                error: 'state 参数验证失败'
            });
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearOAuthState"])(platform);
            return false;
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$oauth$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearOAuthState"])(platform);
        // 演示模式：直接返回本地数据
        if (isDemoMode()) {
            await new Promise((r)=>setTimeout(r, 600));
            return handleLoginSuccess(platform, buildFallbackLoginData(platform));
        }
        setIsLoading(true);
        try {
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(callbackPath(platform), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code,
                    state
                })
            });
            if (res.success) {
                return await handleLoginSuccess(platform, res.data);
            }
            // 后端失败 → 本地回退
            toast.warning(`${displayName}后端登录失败，已启用本地回退`, res.error);
            return await handleLoginSuccess(platform, buildFallbackLoginData(platform));
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.warning(`${displayName}登录异常，已启用本地回退`, msg);
            return await handleLoginSuccess(platform, buildFallbackLoginData(platform));
        } finally{
            setIsLoading(false);
        }
    }, [
        handleLoginSuccess,
        toast,
        updateLoginState
    ]);
    /** 处理登录失败 */ const handleLoginError = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform, error)=>{
        const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform;
        const msg = error instanceof Error ? error.message : String(error) || '登录失败';
        setLoginStates((prev)=>{
            const cur = prev[platform];
            const retryCount = (cur?.retryCount ?? 0) + 1;
            return {
                ...prev,
                [platform]: {
                    ...cur ?? {
                        platform,
                        status: 'failed',
                        retryCount
                    },
                    status: 'failed',
                    error: msg,
                    retryCount
                }
            };
        });
        if (retryCountExceeds(platform, loginStates)) {
            toast.error(`${displayName}登录多次失败，建议尝试其他登录方式`);
        } else {
            toast.error(msg || `${displayName}登录失败`);
        }
    }, [
        loginStates,
        toast
    ]);
    /** 重试登录 */ const retryLogin = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (platform)=>{
        const cur = loginStates[platform];
        if (!cur) return false;
        if (cur.retryCount >= MAX_RETRY) {
            toast.warning('重试次数过多，请尝试其他登录方式');
            return false;
        }
        clearLoginState(platform);
        return startLogin(platform);
    }, [
        clearLoginState,
        loginStates,
        startLogin,
        toast
    ]);
    /** 取消登录 */ const cancelLogin = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((platform)=>{
        clearLoginState(platform);
        toast.info(`已取消${PLATFORM_DISPLAY_NAMES[platform] ?? platform}登录`);
    }, [
        clearLoginState,
        toast
    ]);
    // ---- 账号绑定 ----
    /** 绑定第三方账号 */ const bindAccount = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (platform, code)=>{
        const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform;
        try {
            setIsLoading(true);
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(BIND_PATH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform,
                    code
                })
            });
            if (!res.success) {
                throw new Error(res.error);
            }
            toast.success(`${displayName}账号绑定成功`);
            await refreshBoundAccountsImpl(setBoundAccounts, toast);
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(`${displayName}账号绑定失败`, msg);
            return false;
        } finally{
            setIsLoading(false);
        }
    }, [
        toast
    ]);
    /** 解绑第三方账号 */ const unbindAccount = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (platform)=>{
        const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform;
        const account = getBoundAccount(platform);
        if (!account) {
            toast.error(`未找到${displayName}绑定的账号`);
            return false;
        }
        try {
            setIsLoading(true);
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(`${UNBIND_PATH}?id=${encodeURIComponent(account.id)}`, {
                method: 'DELETE'
            });
            if (!res.success) {
                throw new Error(res.error);
            }
            toast.success(`${displayName}账号解绑成功`);
            await refreshBoundAccountsImpl(setBoundAccounts, toast);
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(`${displayName}账号解绑失败`, msg);
            return false;
        } finally{
            setIsLoading(false);
        }
    }, [
        getBoundAccount,
        toast
    ]);
    /** 刷新已绑定账号列表 */ const refreshBoundAccounts = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        await refreshBoundAccountsImpl(setBoundAccounts, toast);
    }, [
        toast
    ]);
    // ---- Google One Tap ----
    /** 加载 Google GIS SDK 并初始化 One Tap */ const loadGoogleOneTap = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (clientId, callback)=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const init = undefined;
    }, [
        toast
    ]);
    /** 触发 Google One Tap 提示 */ const promptGoogleOneTap = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const g = undefined;
    }, [
        toast
    ]);
    // ---- 辅助 ----
    /** 校验过期状态 */ const checkExpiredStates = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        const now = Date.now();
        setLoginStates((prev)=>{
            let changed = false;
            const next = {
                ...prev
            };
            for (const key of Object.keys(next)){
                const s = next[key];
                if (s?.expiresAt && now > s.expiresAt) {
                    next[key] = {
                        ...s,
                        status: 'expired',
                        error: '登录已过期'
                    };
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, []);
    /** 清理所有状态 */ const clearAllStates = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        setLoginStates({});
        setCurrentPlatform(null);
        setIsLoading(false);
    }, []);
    return {
        enabledPlatforms,
        isAnyPlatformEnabled,
        currentPlatform,
        loginStates,
        boundAccounts,
        isLoading,
        isPlatformEnabled,
        isBound,
        getBoundAccount,
        getPlatformDisplayName,
        startLogin,
        handleCallback,
        handleLoginError,
        retryLogin,
        cancelLogin,
        bindAccount,
        unbindAccount,
        refreshBoundAccounts,
        loadGoogleOneTap,
        promptGoogleOneTap,
        checkExpiredStates,
        clearAllStates
    };
}
// ---- 模块级辅助函数（避免 hook 闭包中重复定义） ----
/** 判断平台重试次数是否超限 */ function retryCountExceeds(platform, states) {
    return (states[platform]?.retryCount ?? 0) >= MAX_RETRY - 1;
}
/** 刷新已绑定账号列表实现 */ async function refreshBoundAccountsImpl(setBoundAccounts, toast) {
    try {
        const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(BOUND_ACCOUNTS_PATH);
        if (res.success) {
            setBoundAccounts(res.data);
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        toast.error('刷新绑定账号列表失败', msg);
    }
}
}),
"[project]/apps/web/src/hooks/use-third-party-config.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useThirdPartyConfig",
    ()=>useThirdPartyConfig
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/image.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$third$2d$party$2d$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-third-party-auth.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
/**
 * 8 平台 provider 静态定义(对标 web 端 ThirdPartyLoginButtons.tsx 3x3 网格铺排)
 * 顺序:微信/Google/GitHub → 飞书/钉钉/企业微信 → 支付宝/Apple
 */ const PROVIDER_DEFS = [
    {
        key: 'wechat',
        labelKey: 'wechatLogin',
        icon: '/images/oauth-providers/wechat.svg'
    },
    {
        key: 'google',
        labelKey: 'googleLogin',
        icon: '/images/oauth-providers/google.svg'
    },
    {
        key: 'github',
        labelKey: 'githubLogin',
        icon: '/images/oauth-providers/github.svg',
        mono: true
    },
    {
        key: 'feishu',
        labelKey: 'feishuLogin',
        icon: '/images/loginSANFANG/feishu.png'
    },
    {
        key: 'dingtalk',
        labelKey: 'dingtalkLogin',
        icon: '/images/oauth-providers/dingtalk.svg'
    },
    {
        key: 'enterpriseWechat',
        labelKey: 'enterpriseWechat',
        icon: '/images/oauth-providers/wecom.svg'
    },
    {
        key: 'alipay',
        labelKey: 'alipayLogin',
        icon: '/images/oauth-providers/alipay.svg'
    },
    {
        key: 'apple',
        labelKey: 'appleLogin',
        icon: '/images/oauth-providers/apple.svg',
        mono: true,
        forceDisabled: true
    }
];
/** URL 回调识别的 8 平台列表(与 useThirdPartyAuth.handleCallback 入参对齐) */ const KNOWN_CALLBACK_PLATFORMS = [
    'google',
    'apple',
    'dingtalk',
    'enterpriseWechat',
    'wechat',
    'github',
    'feishu',
    'alipay'
];
function useThirdPartyConfig() {
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTranslations"])('auth');
    const { startLogin, handleCallback, isPlatformEnabled, currentPlatform } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$third$2d$party$2d$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useThirdPartyAuth"])();
    // URL OAuth 回调处理(从原 local ThirdPartyLoginButtons.tsx 移过来)
    // ⚠️ /callback 路径下跳过,避免与 OAuthCallbackHandler 双重处理导致 state 校验失败
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const path = undefined;
        const params = undefined;
        const code = undefined;
        const authCode = undefined;
        const state = undefined;
        const platformParam = undefined;
        const platform = undefined;
        // 支付宝用 auth_code 参数(其他平台用 code)
        const finalCode = undefined;
    }, [
        handleCallback
    ]);
    const providers = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>PROVIDER_DEFS.map((def)=>({
                key: def.key,
                label: t(def.labelKey),
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                    src: def.icon,
                    alt: "",
                    "aria-hidden": "true",
                    width: 16,
                    height: 16,
                    className: `h-4 w-4 shrink-0 ${def.mono ? 'dark:invert' : ''}`,
                    unoptimized: true
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-third-party-config.tsx",
                    lineNumber: 112,
                    columnNumber: 11
                }, this),
                enabled: !def.forceDisabled && isPlatformEnabled(def.key),
                forceDisabled: def.forceDisabled,
                mono: def.mono
            })), [
        t,
        isPlatformEnabled
    ]);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>({
            providers,
            currentPlatform,
            onLogin: (p)=>{
                void startLogin(p);
            }
        }), [
        providers,
        currentPlatform,
        startLogin
    ]);
}
}),
"[project]/apps/web/src/hooks/use-mounted.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$mounted$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-mounted.ts [app-ssr] (ecmascript)");
'use client';
;
}),
"[project]/apps/web/src/hooks/use-admin-routers.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAdminRouters",
    ()=>useAdminRouters
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
;
function useAdminRouters() {
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        list: [],
        loading: true,
        loaded: false
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let cancelled = false;
        setState((s)=>({
                ...s,
                loading: true
            }));
        void (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/admin/menu/getRouters').then((res)=>{
            if (cancelled) return;
            if (res.success && res.data?.list) {
                setState({
                    list: res.data.list,
                    loading: false,
                    loaded: true
                });
            } else {
                setState({
                    list: [],
                    loading: false,
                    loaded: true
                });
            }
        }).catch(()=>{
            if (!cancelled) setState({
                list: [],
                loading: false,
                loaded: true
            });
        });
        return ()=>{
            cancelled = true;
        };
    }, []);
    return state;
}
}),
"[project]/apps/web/src/hooks/use-apply-diff.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "useApplyDiff",
    ()=>useApplyDiff
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/chat.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/ai-panel.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
;
;
;
;
/** 调 /api/v1/ai/apply-diff 把 newContent 写入文件系统 */ async function callApplyDiffApi(payload) {
    const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/v1/ai/apply-diff', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!r.success) return {
        ok: false,
        error: r.error
    };
    if (!r.data?.applied) return {
        ok: false,
        error: '服务端未应用改动'
    };
    return {
        ok: true
    };
}
function useApplyDiff() {
    const applyDiff = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (messageId, toolCallId, diffInfo)=>{
        const store = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState();
        // 防止重复点击(已应用/已拒绝/应用中 不再触发)
        const tc = store.messages.find((m)=>m.id === messageId)?.toolCalls?.find((t)=>t.id === toolCallId);
        if (!tc) return;
        if (tc.applyStatus === 'applied' || tc.applyStatus === 'applying') return;
        const workspacePath = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.path;
        if (!workspacePath) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error('未绑定工作区', {
                description: '请先在 AI 面板选择本地工作区,Apply 才能写入文件'
            });
            store.setToolCallApplyStatus(messageId, toolCallId, 'error', '未绑定工作区');
            return;
        }
        store.setToolCallApplyStatus(messageId, toolCallId, 'applying');
        try {
            const result = await callApplyDiffApi({
                path: diffInfo.file_path,
                oldContent: diffInfo.old_content,
                newContent: diffInfo.new_content,
                workspacePath
            });
            if (result.ok) {
                store.setToolCallApplyStatus(messageId, toolCallId, 'applied');
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success('改动已应用', {
                    description: diffInfo.file_path
                });
            } else {
                store.setToolCallApplyStatus(messageId, toolCallId, 'error', result.error);
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error('应用失败', {
                    description: result.error
                });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            store.setToolCallApplyStatus(messageId, toolCallId, 'error', msg);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error('应用失败', {
                description: msg
            });
        }
    }, []);
    const rejectDiff = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((messageId, toolCallId)=>{
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setToolCallApplyStatus(messageId, toolCallId, 'rejected');
    }, []);
    return {
        applyDiff,
        rejectDiff
    };
}
const __TURBOPACK__default__export__ = useApplyDiff;
}),
"[project]/apps/web/src/hooks/use-chat.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useChat",
    ()=>useChat
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+react-query@5.101.2_react@19.0.0/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/common/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/common/Toaster.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/chat.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/login-dialog.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/ai-panel.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/mode.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$work$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/work-panel.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$apply$2d$diff$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-apply-diff.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/chat.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/logger.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$subagent$2d$timeline$2d$mapper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/subagent-timeline-mapper.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/timeline-store.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$model$2d$context$2d$capacity$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/model-context-capacity.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$model$2d$context$2d$capacity$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/model-context-capacity.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/format.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$full$2d$access$2d$confirm$2d$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/full-access-confirm-dialog.tsx [app-ssr] (ecmascript)");
'use client';
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
// 斜杠命令 → 自媒体 skill 直调映射(避免走 LLM chat 流,直接调 skill API)
// /wechat-article <title>  → POST /api/self-media/wechat/generate {title, dryRun:true}
// /koubo-script <MMDD>     → POST /api/self-media/koubo/generate {date, dryRun:true}
// /auto-task <taskId> <HH:MM> [titleTemplate]  → POST /api/self-media/automation/tasks/:taskId/config
//   taskId: wechat_daily | koubo_daily(仅这 2 个内置任务可配置)
//   时间格式: HH:MM(24 小时制),默认 09:00
//   titleTemplate: 可选,仅 wechat_daily 用,支持 {date} 占位符
const SELF_MEDIA_SLASH_MAP = {
    '/wechat-article': {
        endpoint: '/api/self-media/wechat/generate',
        parseArgs: (rest)=>({
                title: rest || '今日公众号文章'
            }),
        format: (r)=>{
            if (!r.success) return `❌ 公众号文章生成失败: ${r.error || '未知错误'}`;
            const d = r.data || {};
            const ok = d.ok ?? false;
            const lines = [
                `### 公众号文章生成 ${ok ? '✅' : '⚠️'}`,
                `- 标题: ${d.title || ''}`,
                `- md 路径: ${d.mdPath || '(无)'}`,
                `- 耗时: ${d.duration_ms ?? 0} ms`
            ];
            if (d.error) lines.push(`- 错误: ${d.error}`);
            if (d.stdout) lines.push('\n```\n' + String(d.stdout).slice(0, 2000) + '\n```');
            return lines.join('\n');
        }
    },
    '/koubo-script': {
        endpoint: '/api/self-media/koubo/generate',
        parseArgs: (rest)=>{
            // rest 可能是 "MMDD" 或 "MMDD 选题方向"
            const [date, ...topicParts] = rest.split(/\s+/);
            return {
                date: date || '0720',
                topic: topicParts.join(' ')
            };
        },
        format: (r)=>{
            if (!r.success) return `❌ 口播稿生成失败: ${r.error || '未知错误'}`;
            const d = r.data || {};
            const ok = d.ok ?? false;
            const lines = [
                `### 口播稿生成 ${ok ? '✅' : '⚠️'}`,
                `- 日期: ${d.date || ''}`,
                `- 篇数: ${d.articlesCount ?? 0}`,
                `- 输出: ${d.outputPath || '(无)'}`,
                `- 耗时: ${d.duration_ms ?? 0} ms`
            ];
            if (d.error) lines.push(`- 错误: ${d.error}`);
            const articles = d.articles || [];
            if (articles.length) {
                lines.push('\n---');
                for (const a of articles.slice(0, 8)){
                    lines.push(`\n#### 第 ${a.index} 篇\n\n${a.content || ''}`);
                }
            }
            return lines.join('\n');
        }
    }
};
/** /auto-task 斜杠命令:配置自媒体自动化定时任务(2026-07-22 新增)
 *  格式:/auto-task <taskId> <HH:MM> [titleTemplate]
 *  示例:/auto-task wechat_daily 09:00
 *        /auto-task koubo_daily 08:00
 *  说明:直接调 /api/self-media/automation/tasks/:taskId/config,不走 LLM chat 流 */ async function tryHandleAutoTaskSlash(text, onResult) {
    const trimmed = text.trim();
    if (trimmed !== '/auto-task' && !trimmed.startsWith('/auto-task ') && !trimmed.startsWith('/auto-task\n')) {
        return false;
    }
    const rest = trimmed.slice('/auto-task'.length).trim();
    const [taskIdRaw, timeRaw, ...titleParts] = rest.split(/\s+/);
    const taskId = taskIdRaw === 'koubo_daily' ? 'koubo_daily' : 'wechat_daily';
    const [h, m] = (timeRaw || '09:00').split(':').map(Number);
    const hour = typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 23 ? h : 9;
    const minute = typeof m === 'number' && Number.isFinite(m) && m >= 0 && m <= 59 ? m : 0;
    const titleTemplate = titleParts.join(' ') || undefined;
    try {
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(`/api/self-media/automation/tasks/${encodeURIComponent(taskId)}/config`, {
            method: 'POST',
            body: JSON.stringify({
                hour,
                minute,
                dry_run: true,
                enabled: true,
                ...titleTemplate ? {
                    title_template: titleTemplate
                } : {}
            })
        });
        if (!r.success) {
            onResult(`❌ 自动化任务配置失败: ${r.error}`);
            return true;
        }
        const d = r.data;
        if (!d.ok) {
            onResult(`❌ 自动化任务配置失败: ${d.message || d.error || '未知错误'}`);
            return true;
        }
        const cfg = d.config || {};
        const lines = [
            `### 自动化任务配置 ✅`,
            `- 任务 ID: ${taskId}`,
            `- 执行时间: 每天 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            `- dry-run: ${cfg.dry_run ? '是' : '否'}`,
            `- 已启用: ${cfg.enabled ? '是' : '否'}`
        ];
        if (titleTemplate) lines.push(`- 标题模板: ${titleTemplate}`);
        lines.push(`\n请在自动化任务页面查看详情,点击"立即触发"可测试运行。`);
        onResult(lines.join('\n'));
    } catch (e) {
        onResult(`❌ /auto-task 调用失败: ${e instanceof Error ? e.message : String(e)}`);
    }
    return true;
}
/** /plan & /act 动作型斜杠命令(2026-07-25 立,对标 Trae SOLO Plan 模式)
 * - /plan [可选说明]:切换到 ChatMode.plan(只读分析,deny write 工具)。后续说明文字被忽略(纯动作命令)。
 * - /act [可选说明]:切换到 ChatMode.build(正常执行,全工具开放,默认)。
 * - /build /review /spec 同理(2026-07-28 补全 ChatMode 4 态 / 命令通道)。
 * - 命中即返回 true,不发送给 LLM,清空输入框。toast 给反馈。
 * - 仅当输入完全匹配 /plan /act /build /review /spec 开头(后接空白或行尾)时命中,避免误伤。 */ function tryHandlePlanModeSlash(text) {
    const trimmed = text.trimStart();
    // /plan /act /build /review /spec → ChatMode 4 态(2026-07-28 移除独立 PlanActToggle 后,/plan /act 直接走 ChatMode)
    const m = /^\/(plan|act|build|review|spec)\b\s*/.exec(trimmed);
    if (!m) return false;
    const raw = m[1];
    // 映射:plan/act → ChatMode(act=build 语义一致,plan=plan 语义一致)
    const target = raw === 'act' ? 'build' : raw;
    const modeStore = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModeStore"].getState();
    if (modeStore.currentMode === target) {
        // 已是目标模式:不重复切换,仅 toast 提示当前模式
        const label = target === 'build' ? '构建' : target === 'plan' ? '计划' : target === 'review' ? '审查' : '规格';
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].info(`当前已是${label}模式`);
        return true;
    }
    modeStore.setMode(target);
    const label = target === 'build' ? '构建' : target === 'plan' ? '计划' : target === 'review' ? '审查' : '规格';
    const desc = target === 'build' ? 'AI 将正常执行,全工具开放(Ctrl+1 可快速切换)' : target === 'plan' ? 'AI 将只读分析,不执行写工具(Ctrl+2 可快速切换)' : target === 'review' ? 'AI 将只读审查(Ctrl+3 可快速切换)' : 'AI 将从代码反向生成 spec 文档(Ctrl+4 可快速切换)';
    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success(`已切换到${label}模式`, {
        description: desc
    });
    return true;
}
/** /build /review /spec 动作型斜杠命令(2026-07-28 立,补全 ChatMode 4态三通道)
 * - /build:  切换到构建模式(正常执行,全工具开放)
 * - /review: 切换到审查模式(只读审查,deny write 工具 + 强化审查 prompt)
 * - /spec:   切换到规格模式(从代码反向生成 spec 文档)
 * - 命中即返回 true,不发送给 LLM,清空输入框。toast 给反馈。
 * - 仅当输入完全匹配 /build /review /spec 开头(后接空白或行尾)时命中。
 * - t: next-intl 翻译函数(由 useChat hook 顶层 useTranslations('chat') 传入,
 *   因模块级函数无法直接调 hook,2026-07-28 i18n 补全) */ function tryHandleChatModeSlash(text, t) {
    const trimmed = text.trimStart();
    const m = /^\/(build|review|spec)\b\s*/.exec(trimmed);
    if (!m) return false;
    const target = m[1];
    const modeStore = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModeStore"].getState();
    const labelKey = target === 'build' ? 'modeBuild' : target === 'review' ? 'modeReview' : 'modeSpec';
    const label = t(labelKey);
    if (modeStore.currentMode === target) {
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].info(t('modeAlreadyActive', {
            mode: label
        }));
        return true;
    }
    modeStore.setMode(target);
    const descKey = target === 'build' ? 'modeBuildDesc' : target === 'review' ? 'modeReviewDesc' : 'modeSpecDesc';
    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success(t('modeSwitched', {
        mode: label
    }), {
        description: t(descKey)
    });
    return true;
}
/** /permission ask|auto|full 动作型斜杠命令(2026-07-25 深化,深度对标 Codex approvalMode CLI)
 * - /permission ask:切换到 default 模式(请求批准,默认)
 * - /permission auto:切换到 accept-edits 模式(自动接受编辑)
 * - /permission full:切换到 bypass-permissions 模式(完全访问,高风险)
 * - 必须以 /permission 开头,后接 ask/auto/full + 空白或行尾(避免误伤 /permissioned 等)
 * - 命中即清空输入框 + 走 switchPermissionMode 切换模式
 * - 纯 UI 状态切换,不需要登录,不调用 LLM,不需要创建会话
 * - 切换失败时回滚 + toast 报错
 * - 切到 full → 5s 撤销 toast(与 PermissionModePopover 一致体验)
 * - 首次切到 full + 未在 localStorage 静默 → 走 store.pendingFullAccess,
 *   由 message-input 渲染 FullAccessConfirmDialog,确认后切模式 */ async function tryHandlePermissionSlash(text) {
    const trimmed = text.trimStart();
    // 必须以 /permission 开头,后接 ask/auto/full + 空白或行尾
    const m = /^\/permission\s+(ask|auto|full)\b\s*$/.exec(trimmed);
    if (!m) return false;
    const target = m[1];
    // 注:此函数内部不能直接调 useTranslations(非 React 组件),
    // 借助 useAiPanelStore 共享状态,让已挂载的 toast 监听器来显示。
    // 但 toast 是瞬时反馈,直接在内部硬编码调 sonner(2026-07-25 收尾时改用 i18n)
    const { switchPermissionMode } = await __turbopack_context__.A("[project]/apps/web/src/components/ai/permission-mode-popover.tsx [app-ssr] (ecmascript, async loader)");
    const modeMap = {
        ask: 'default',
        auto: 'accept-edits',
        full: 'bypass-permissions'
    };
    const targetMode = modeMap[target];
    // 已是目标模式:不重复切换,仅 toast 提示
    const currentMode = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.mode;
    if (currentMode === targetMode) {
        // 已是目标模式 → 不切换,提示用户(2026-07-25 收尾:用 i18n 替代硬编码)
        // 通过动态 import 加载 useTranslations hook 不可行(hook 必须在组件顶层)
        // 改用预定义文案 map(由 use-chat 调用方提供 i18n,或直接硬编码英文 fallback)
        const label = target === 'ask' ? 'Ask' : target === 'auto' ? 'Auto-approve' : 'Full access';
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].info(`Already in ${label} mode`);
        return true;
    }
    // 切到 full + 首次启用 + 未静默 → 弹确认弹窗(2026-07-25 深化,深度对标 Codex safety guard)
    // 由 message-input 的 FullAccessConfirmBridge 监听 store.pendingFullAccess 渲染 Dialog
    if (target === 'full' && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$full$2d$access$2d$confirm$2d$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isFullAccessConfirmSuppressed"])()) {
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().setPendingFullAccess(true);
        return true;
    }
    // 切换模式(乐观更新 + 落库 + 失败回滚)
    const result = await switchPermissionMode(targetMode);
    if (!result.ok) {
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(`Permission mode switch failed: ${result.error ?? 'unknown'}`);
        return true;
    }
    // 切完模式 → 把刚被 message-input useEffect 占位为 'popover' 的最新一条记录
    // source 改为 'slash'(2026-07-25 深化,来源精细化)
    try {
        const { updateLatestRecordSource } = await __turbopack_context__.A("[project]/apps/web/src/lib/permission-mode-history.ts [app-ssr] (ecmascript, async loader)");
        updateLatestRecordSource('slash', (e)=>e.mode === targetMode);
    } catch  {
    // permission-mode-history 模块不可用时静默(避免 slash 命令主流程受阻)
    }
    // 切到 full → 5s 撤销 toast(与 PermissionModePopover 一致体验)
    if (target === 'full' && result.previousMode) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"])('Switched to full access', {
            description: `AI can now run any action without confirmation (undo within 5s, previous:${result.previousMode})`,
            duration: 5000,
            action: {
                label: 'Undo',
                onClick: async ()=>{
                    await switchPermissionMode(result.previousMode);
                }
            }
        });
    } else if (target === 'auto') {
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success('Switched to auto-approve', {
            description: 'Only asks before running detected risky actions',
            duration: 3000
        });
    } else if (target === 'ask' && result.previousMode === 'bypass-permissions') {
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success('Switched to ask for approval', {
            description: 'Always asks before editing files outside this project or using the internet',
            duration: 3000
        });
    }
    return true;
}
/** 关键词 → ChatMode 映射(2026-07-28 立,AI 自动判断模式)
 * - 与原 mode-switcher.tsx 的 SUGGEST_KEYWORDS 完全一致,迁移到 use-chat.ts
 *   统一为单一事实源,移除 4 按钮后避免散落
 * - 关键词匹配采用"首次命中优先"策略,与文本子串 includes() 检测
 * - 优先级顺序:plan → build → review → spec(数组顺序决定优先级)
 * - 中英文混排:关键词里既包含中文("修改"/"分析")也包含英文("build"/"plan")
 *   兼容用户纯英文输入或中英混输场景 */ const SUGGEST_KEYWORDS = [
    {
        mode: 'plan',
        keywords: [
            '调研',
            '分析',
            '了解',
            '看看',
            '查看',
            '研究',
            '探索',
            '梳理',
            'plan'
        ]
    },
    {
        mode: 'build',
        keywords: [
            '修改',
            '实现',
            '重构',
            '添加',
            '删除',
            '编写',
            '创建',
            '修复',
            '更新',
            'build'
        ]
    },
    {
        mode: 'review',
        keywords: [
            '审查',
            '检查',
            '对比',
            '评审',
            'review',
            'diff'
        ]
    },
    {
        mode: 'spec',
        keywords: [
            '规格',
            '规范',
            '契约',
            'spec',
            'specification'
        ]
    }
];
/** 根据用户输入文本推荐 ChatMode(关键词匹配,首次命中优先)
 * - 输入为空 → 返回 null
 * - 命中关键词 → 返回对应 mode
 * - 未命中 → 返回 null(保持当前模式)
 *
 * 设计原则(2026-07-28 立,用户规则"AI 自动决策"):
 * - 保留关键词匹配 + 命中即切换的轻量启发式
 * - 不引入 LLM/embedding(轻量、毫秒级、可解释)
 * - 漏命中场景下保持当前模式,LLM 仍可正常工作(模式只是约束 write 工具) */ function suggestMode(userInput) {
    if (!userInput.trim()) return null;
    const text = userInput.toLowerCase();
    for (const { mode, keywords } of SUGGEST_KEYWORDS){
        if (keywords.some((kw)=>text.includes(kw.toLowerCase()))) {
            return mode;
        }
    }
    return null;
}
/** AI 自动判断模式(2026-07-28 立,移除 4 按钮后由 AI 决定用哪种模式)
 * - 时机:在 sendMessage 流程中,所有显式 /命令拦截后、createConversation 前
 *   用户敲完消息按发送,才触发自动切换(避免边输入边跳)
 * - 静默切换(无 toast):自动判断是辅助能力,反复提示会刷屏
 *   当前模式徽章(apps/web/src/components/chat/message-input.tsx CurrentModeBadge)会
 *   实时反映新模式,提供视觉反馈
 * - 仅当建议模式 ≠ 当前模式时才切换(避免无意义的 setState)
 * - 已在 plan/build 等模式(用户主动选择)下不打扰:
 *   例如用户已显式 /review,后续普通对话不会自动改回 build
 *   (因为关键词不命中会返回 null,保持当前模式)
 *
 * 边界场景:
 * - 短文本"看看" → 命中 plan → 自动切到只读分析
 * - 长 prompt 包含多关键词 → 数组优先级优先(plan 优先于 build)
 * - 无关键词 → 保持当前模式不变
 */ function tryAutoDetectMode(text) {
    const suggested = suggestMode(text);
    if (!suggested) return;
    const modeStore = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModeStore"].getState();
    if (modeStore.currentMode === suggested) return;
    modeStore.setMode(suggested);
}
async function tryHandleSelfMediaSlash(text, onResult) {
    // 返回 true 表示命中斜杠命令(已调 skill),false 表示走原 chat 流程
    // 优先检查 /auto-task(独立处理,因 endpoint 含路径参数)
    if (await tryHandleAutoTaskSlash(text, onResult)) return true;
    const trimmed = text.trim();
    const matched = Object.keys(SELF_MEDIA_SLASH_MAP).find((cmd)=>trimmed === cmd || trimmed.startsWith(cmd + ' ') || trimmed.startsWith(cmd + '\n'));
    if (!matched) return false;
    const cfg = SELF_MEDIA_SLASH_MAP[matched];
    const rest = trimmed.slice(matched.length).trim();
    const body = cfg.parseArgs(rest);
    try {
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(cfg.endpoint, {
            method: 'POST',
            body: JSON.stringify({
                ...body,
                dryRun: true
            })
        });
        onResult(cfg.format(r));
    } catch (e) {
        onResult(`❌ ${matched} 调用失败: ${e instanceof Error ? e.message : String(e)}`);
    }
    return true;
}
/** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
 *  传入 streamChat → api /ai/chat/stream → ai-service /api/llm/complete/stream
 *  ai-service 收到后从 mcp_server 加载完整 schema,走 tool loop(complete→tool_calls→execute→astream)
 *  2026-07-27 补齐 12 核心 MCP 工具(read_file/search_codebase/file_search 等),共 34 个 */ const AGENT_TOOLS = [
    // ===== 核心 MCP 工具(2026-07-27 补齐,对标 Trae Work + Codex 工具集)=====
    // 之前只传 browser/computer 工具,LLM 看不到 read_file/search_codebase 等核心工具 schema,
    // 导致用户问"读一下 xxx 文件"时 LLM 无法调用 read_file,只能瞎编。
    // 现在补齐普通用户可用的核心工具(admin only 工具由后端 mcp_server 权限检查兜底)。
    'read_file',
    'search_codebase',
    'file_search',
    'analyze_code',
    'generate_test',
    'web_search',
    'search_web',
    'vision_analyze',
    'knowledge_lookup',
    'dispatch_subagent',
    'summarize_artifacts',
    'proactive_suggestion',
    // 12 browser tools
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
    // 10 computer tools
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set'
];
/**
 * 插件市场 pluginId → ai-service MCP 工具名映射(2026-07-22 立)。
 *
 * 用户在插件市场点击"+"添加到对话后,selectedTools 存 pluginId。
 * sendMessage 时通过 mergeAgentTools() 把对应 MCP 工具名合并到 agentTools,
 * 传给后端 ai-service /api/llm/complete/stream。
 *
 * 仅 realIntegrated=true 的插件有真实 MCP 工具映射;'model' 接入类和
 * 仅 prompt 意图类无映射,不参与 mergeAgentTools(避免污染 AGENT_TOOLS)。
 */ const PLUGIN_ID_TO_TOOLS = {
    // 12 browser tools(所有浏览器类插件共用同一组 browser_* 工具)
    'playwright-mcp': [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    puppeteer: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    'browser-use': [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    stagehand: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    skyvern: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    selenium: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    playwright: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    multion: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    axiom: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    brightdata: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    browserbase: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    browserless: [
        'browser_screenshot',
        'browser_click_element',
        'browser_type_text',
        'browser_scroll',
        'browser_navigate',
        'browser_extract_dom',
        'browser_wait_for_element',
        'browser_get_attribute',
        'browser_hover',
        'browser_select_option',
        'browser_switch_tab',
        'browser_close_tab'
    ],
    // 10 computer tools(所有电脑控制类插件共用同一组 computer_* 工具)
    'anthropic-computer-use': [
        'computer_screenshot_screen',
        'computer_mouse_move',
        'computer_mouse_click',
        'computer_keyboard_type',
        'computer_mouse_scroll',
        'computer_keyboard_press',
        'computer_keyboard_hotkey',
        'computer_active_window',
        'computer_clipboard_get',
        'computer_clipboard_set'
    ],
    'open-interpreter': [
        'computer_screenshot_screen',
        'computer_mouse_move',
        'computer_mouse_click',
        'computer_keyboard_type',
        'computer_mouse_scroll',
        'computer_keyboard_press',
        'computer_keyboard_hotkey',
        'computer_active_window',
        'computer_clipboard_get',
        'computer_clipboard_set'
    ],
    'auto-gpt': [
        'computer_screenshot_screen',
        'computer_mouse_move',
        'computer_mouse_click',
        'computer_keyboard_type',
        'computer_mouse_scroll',
        'computer_keyboard_press',
        'computer_keyboard_hotkey',
        'computer_active_window',
        'computer_clipboard_get',
        'computer_clipboard_set'
    ],
    babyagi: [
        'computer_screenshot_screen',
        'computer_mouse_move',
        'computer_mouse_click',
        'computer_keyboard_type',
        'computer_mouse_scroll',
        'computer_keyboard_press',
        'computer_keyboard_hotkey',
        'computer_active_window',
        'computer_clipboard_get',
        'computer_clipboard_set'
    ],
    'self-operating-computer': [
        'computer_screenshot_screen',
        'computer_mouse_move',
        'computer_mouse_click',
        'computer_keyboard_type',
        'computer_mouse_scroll',
        'computer_keyboard_press',
        'computer_keyboard_hotkey',
        'computer_active_window',
        'computer_clipboard_get',
        'computer_clipboard_set'
    ],
    'claude-desktop': [
        'computer_screenshot_screen',
        'computer_mouse_move',
        'computer_mouse_click',
        'computer_keyboard_type',
        'computer_mouse_scroll',
        'computer_keyboard_press',
        'computer_keyboard_hotkey',
        'computer_active_window',
        'computer_clipboard_get',
        'computer_clipboard_set'
    ],
    // 其他真集成插件:filesystem / postgres / search / code-exec / github / langgraph
    'filesystem-mcp': [
        'read_file',
        'write_file'
    ],
    'postgres-mcp': [
        'db_query'
    ],
    duckduckgo: [
        'search_web'
    ],
    'code-interpreter-mcp': [
        'run_command'
    ],
    e2b: [
        'run_command'
    ],
    'github-mcp': [
        'run_command'
    ],
    langgraph: [
        'run_command'
    ]
};
/**
 * 合并默认 AGENT_TOOLS + 用户已选插件对应的 MCP 工具(2026-07-22 立)。
 *
 * 调用时机:sendMessage / sendAnswer 构造 streamChat 参数前。
 * 去重保证工具名唯一,ai-service 收到后从 mcp_server 加载完整 schema。
 */ function mergeAgentTools() {
    const selected = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().selectedTools;
    const extra = selected.flatMap((id)=>PLUGIN_ID_TO_TOOLS[id] ?? []);
    return [
        ...new Set([
            ...AGENT_TOOLS,
            ...extra
        ])
    ];
}
/** 浏览器类工具:命中即自动在右侧 WorkPanel 打开 URL(2026-07-22 立,P2 联动) */ const BROWSER_TOOL_NAMES = new Set([
    'browser_navigate',
    'browser_click',
    'browser_extract',
    'browser_screenshot',
    'web_search',
    'fetch-url',
    'fetch_url',
    'web_fetch'
]);
/** 从 tool args/result 提取 URL(与 tool-call-card.tsx extractUrl 逻辑一致) */ function extractToolUrl(args, result) {
    if (args) {
        const fromArgs = args.url || args.href || args.link || args.target;
        if (typeof fromArgs === 'string' && /^https?:\/\//i.test(fromArgs)) return fromArgs;
    }
    if (typeof result === 'string') {
        const match = result.match(/https?:\/\/[^\s"'<>]+/i);
        if (match) return match[0];
    } else if (result && typeof result === 'object') {
        const obj = result;
        const fromResult = obj.url || obj.href || obj.link;
        if (typeof fromResult === 'string' && /^https?:\/\//i.test(fromResult)) return fromResult;
    }
    if (Array.isArray(result)) {
        const first = result.find((r)=>{
            if (typeof r === 'object' && r !== null) {
                const u = r.url;
                return typeof u === 'string' && /^https?:\/\//i.test(u);
            }
            return false;
        });
        if (first) return first.url;
    }
    return null;
}
/** onToolCall 工厂:绑定 assistantMessageId,生成统一 handler 给 streamChat 用 */ function createToolCallHandler(assistantMessageId) {
    return (event)=>{
        if (event.type === 'tool-call-start') {
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().addToolCall(assistantMessageId, {
                id: event.toolCallId,
                toolName: event.toolName,
                args: event.args ?? {},
                status: 'running',
                iteration: event.iteration
            });
            // browser_navigate 类工具:args 含 url 时立即打开 WorkPanel(无需等 result)
            if (BROWSER_TOOL_NAMES.has(event.toolName) && event.args) {
                const url = extractToolUrl(event.args);
                if (url) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$work$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useWorkPanelStore"].getState().openPanel({
                        url,
                        source: 'ai-tool'
                    });
                }
            }
        } else {
            // tool-result
            const updates = {
                status: event.isError ? 'error' : 'success',
                result: event.result
            };
            if (event.args) updates.args = event.args;
            if (event.iteration !== undefined) updates.iteration = event.iteration;
            // 后端 repeated: true 标记(同 tool_name + 同 args 已执行过,跳过实际调用)
            if (event.repeated === true) updates.repeated = true;
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().updateToolCall(assistantMessageId, event.toolCallId, updates);
            // tool-result 含 URL:延迟打开(仅当之前 args 没 url 时,result 含 url 的场景)
            if (!BROWSER_TOOL_NAMES.has(event.toolName)) return;
            const url = extractToolUrl(event.args, event.result);
            if (url) {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$work$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useWorkPanelStore"].getState().openPanel({
                    url,
                    source: 'ai-tool'
                });
            }
        }
    };
}
/**
 * #9 流式 token 节流(2026-07-25 立):
 * 用 requestAnimationFrame 每帧合并一次 token,避免每个 token 触发 store 更新 + React 重渲染。
 * - batch(delta):累加 delta,标记 dirty,下帧 flush
 * - flush():立即把累积 delta 一次性 append(用于错误/中止前最后冲刺)
 * - cancel():取消 raf,清空累积(用于 finally)
 */ function createDeltaBatcher(appendFn) {
    let pending = '';
    let rafId = null;
    const flush = ()=>{
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (pending) {
            const d = pending;
            pending = '';
            appendFn(d);
        }
    };
    const batch = (delta)=>{
        pending += delta;
        if (rafId === null) {
            rafId = requestAnimationFrame(()=>{
                rafId = null;
                if (pending) {
                    const d = pending;
                    pending = '';
                    appendFn(d);
                }
            });
        }
    };
    const cancel = ()=>{
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        pending = '';
    };
    return {
        batch,
        flush,
        cancel
    };
}
/**
 * #9 多 agent stream 节流(2026-07-25 立):
 * 单一 manager 管理多个 agentId 各自的 batcher,flushAll/cancelAll 统一清理。
 */ function createAgentDeltaBatcher() {
    const map = new Map();
    const batch = (agentId, delta)=>{
        let b = map.get(agentId);
        if (!b) {
            b = createDeltaBatcher((d)=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().appendToAgentStream(agentId, d));
            map.set(agentId, b);
        }
        b.batch(delta);
    };
    const flushAll = ()=>{
        for (const b of map.values())b.flush();
    };
    const cancelAll = ()=>{
        for (const b of map.values())b.cancel();
        map.clear();
    };
    return {
        batch,
        flushAll,
        cancelAll
    };
}
/** 后台持久化消息，失败仅打日志，不阻塞流式体验
 *  P2 多端同步:metadata 参数用于标记 questionId/isAnswer(用户回答)或其他业务元数据 */ async function persistMessageSafe(conversationId, content, role, metadata) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendMessage"])(conversationId, content, role, metadata);
    if (!res.success) {
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].error(`[chat] persist ${role} message failed:`, res.error);
        // 用户可见提示(非阻塞 toast),让用户知道消息未保存到服务端
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error('消息保存失败', {
            description: res.error || '网络异常,本次对话未被服务端记录'
        });
    }
}
/** 后台持久化 AI 主动提问挂起状态 + WS 广播到多端
 *  失败仅打日志,不阻塞主流程(用户仍能在当前端看到弹窗,只是其他端不会同步) */ async function persistQuestionSafe(conversationId, question) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["persistQuestion"])({
        conversationId,
        ...question
    });
    if (!res.success) {
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].error(`[chat] persist question ${question.questionId} failed:`, res.error);
    // 静默失败:不弹 toast(避免干扰用户),仅日志记录
    // 影响:其他端不会收到 ai_question WS 事件,但当前端弹窗仍正常工作
    }
}
function useChat() {
    const messages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.messages);
    const currentModel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.currentModel);
    const isStreaming = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.isStreaming);
    const error = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.error);
    // P4-2: fallback 通知状态(主模型失败切换到备用模型时设置,UI 展示横幅)
    const [fallbackNotice, setFallbackNotice] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQueryClient"])();
    // ChatMode 斜杠命令 toast i18n(2026-07-28 立,模块级函数无法调 hook,由此处传入 t)
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTranslations"])('chat');
    const abortRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    // P1 错误重试(2026-07-23):保存最后发送内容,toast 加 retry 按钮
    const lastSentContentRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"]('');
    // #10 sendAnswer 错误重试(2026-07-25 立):保存最后回答内容,toast 加 retry 按钮
    // 与 lastSentContentRef 对称,sendAnswer catch 块复用 sendMessage 路径的 retry 模式
    const lastSentAnswerRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    // P3 修复:切换会话时清空 lastSentContentRef/lastSentAnswerRef,释放大文本引用
    // (用户输入可能含大段粘贴代码,ref 不会自动释放;retry toast 在切换会话后不再有意义)
    const conversationId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.conversationId);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        lastSentContentRef.current = '';
        lastSentAnswerRef.current = null;
    }, [
        conversationId
    ]);
    const sendMessage = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (content)=>{
        const text = content.trim();
        if (!text) return false;
        lastSentContentRef.current = text;
        const store = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState();
        if (store.isStreaming) return false;
        // /plan & /act 动作型斜杠命令拦截(2026-07-25 立,对标 Trae SOLO Plan 模式):
        // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
        // - 命中即清空输入框 + toast 反馈
        if (tryHandlePlanModeSlash(text)) return true;
        // /build /review /spec 动作型斜杠命令拦截(2026-07-28 立,补全 ChatMode 4态三通道):
        // - 纯 ChatMode 切换,不需要登录,不调用 LLM,不创建会话
        // - 命中即清空输入框 + toast 反馈(返回 true 与 tryHandlePlanModeSlash 一致)
        if (tryHandleChatModeSlash(text, t)) return true;
        // /permission ask|auto|full 动作型斜杠命令拦截(2026-07-25 深化,对标 Codex approvalMode):
        // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
        // - 命中即清空输入框 + toast 反馈(切 full 时弹 5s 撤销 toast)
        if (await tryHandlePermissionSlash(text)) return true;
        // AI 自动判断 ChatMode(2026-07-28 立,移除 4 按钮后由 AI 决定用哪种模式):
        // - 时机:所有 /命令拦截后、createConversation 前(用户敲完按发送才触发)
        // - 静默切换,无 toast(自动判断是辅助能力,反复提示会刷屏)
        // - 当前模式徽章(CurrentModeBadge)实时反映新模式,提供视觉反馈
        // - 显式 /命令优先级最高(已在上方拦截,这里只处理普通对话)
        tryAutoDetectMode(text);
        // 未登录拦截(2026-07-24 立,修复"未登录点发送无反应"问题):
        // - 不调 createConversation(避免 401 无可见反馈)
        // - toast 提示 + 弹出登录弹窗(用户偏好:登录/注册用弹窗)
        // - return false 让 MessageInput 保留输入内容,登录后可直接重发
        // - 注意:仅检查 isAuthenticated(UI 标志位)。token 刷新后为 null 但 cookie 仍有效,
        //   不能用 !token 判断,否则会误拦刷新后已登录用户。stale 场景由 createConversation
        //   401 失败兜底(下方 createRes.status === 401 分支处理)。
        if (!__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().isAuthenticated) {
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning('请先登录', {
                description: '登录后即可与 AI 对话'
            });
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLoginDialogStore"].getState().open('login');
            return false;
        }
        // 拦截自媒体斜杠命令(/wechat-article / /koubo-script),直接调 skill API,
        // 不走 LLM chat 流。结果作为 assistant 消息追加到对话。
        const slashHit = await tryHandleSelfMediaSlash(text, (assistantContent)=>{
            const m = store.currentModel;
            store.addMessage({
                role: 'user',
                content: text,
                model: m
            });
            store.addMessage({
                role: 'assistant',
                content: assistantContent,
                model: m
            });
        });
        if (slashHit) return true;
        const model = store.currentModel;
        // 1. 若无 conversationId，先创建会话并同步 URL
        let conversationId = store.conversationId;
        if (!conversationId) {
            const createRes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createConversation"])({
                model
            });
            if (!createRes.success) {
                // 401 兜底(2026-07-24 立):isAuthenticated 可能 stale(localStorage 持久化但 cookie 已失效),
                // createConversation 返回 401 时需明确提示用户重新登录,而非静默 setError。
                // fetchApi wrapper 已调 openLoginDialogOnce 打开弹窗,此处补 toast + 同步 auth 状态。
                if (createRes.status === 401) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning('登录已过期', {
                        description: '请重新登录后继续对话'
                    });
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].setState({
                        isAuthenticated: false,
                        user: null
                    });
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLoginDialogStore"].getState().open('login');
                } else {
                    // 2026-07-27 修复"登录后点击发送无反应":createConversation 非 401 失败时
                    // (如 500/502/网络错误)只调 store.setError 用户看不到任何反馈,误以为按钮失灵。
                    // 必须 toast.error 让用户看到错误原因,并附带重试按钮。
                    const errMsg = createRes.error || `服务异常(${createRes.status ?? '未知'})`;
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error('创建会话失败', {
                        description: errMsg,
                        action: {
                            label: '重试',
                            onClick: ()=>sendMessage(lastSentContentRef.current)
                        }
                    });
                    store.setError(createRes.error);
                }
                return false;
            }
            conversationId = createRes.data.conversation.id;
            store.setConversationId(conversationId);
            const sp = new URLSearchParams(window.location.search);
            sp.set('conversationId', conversationId);
            router.replace(`/chat?${sp.toString()}`, {
                scroll: false
            });
            queryClient.invalidateQueries({
                queryKey: [
                    'chat',
                    'conversations'
                ]
            });
        }
        // 2. 持久化用户消息(后台 fire-and-forget,不阻塞流式响应)
        void persistMessageSafe(conversationId, text, 'user');
        const history = store.messages.filter((m)=>!m.error && (m.role === 'user' || m.role === 'assistant') && m.content).map((m)=>({
                role: m.role,
                content: m.content
            }));
        store.addMessage({
            role: 'user',
            content: text,
            model
        });
        // 记录该消息生成时的工作区权限模式(2026-07-25 深化,深度对标 Codex 透明性)
        // 模式用于消息气泡的徽章展示,让用户事后能识别"这条回答是基于哪种权限模式生成的"
        const currentMode = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.mode;
        const assistantId = store.addMessage({
            role: 'assistant',
            content: '',
            model,
            permissionMode: currentMode
        });
        store.setStreaming(true);
        store.setError(null);
        store.resetSubAgentActivities();
        // P4-2: 清除上一轮 fallback 通知,避免旧横幅残留到新对话轮次
        setFallbackNotice(null);
        const controller = new AbortController();
        abortRef.current = controller;
        // #13 首 token 超时区分 reasoning(2026-07-25 立):
        // 双阶超时适配 reasoning 模型(o1/R1)长思考场景:
        // - timeout30s:30s 内 reasoning + content 都未收到 → abort(完全冷启动)
        //   2026-07-27 修复:15s → 30s。StepFun step-router-v1 等推理模型首次请求冷启动
        //   可能 >15s(含 CORS preflight + TCP + LLM 首 token 延迟),15s 误 abort 导致 net::ERR_ABORTED。
        // - timeout60s:60s 内 content 未收到但 reasoning 已收到 → abort(reasoning 模型可能长时间只产 reasoning)
        // - 任一 content token 到达 → clearTimeout 两个 timer(进入正常流式)
        // - 用户主动 stop 触发的 abort 不报错(由 abortedByTimeout* 标志区分)
        let firstContentTokenReceived = false;
        let firstReasoningTokenReceived = false;
        let abortedByTimeout15s = false;
        let abortedByTimeout60s = false;
        const timeout15sId = setTimeout(()=>{
            if (!firstContentTokenReceived && !firstReasoningTokenReceived) {
                abortedByTimeout15s = true;
                controller.abort();
            }
        }, 30000);
        const timeout60sId = setTimeout(()=>{
            if (!firstContentTokenReceived && firstReasoningTokenReceived) {
                abortedByTimeout60s = true;
                controller.abort();
            }
        }, 60000);
        // #9 流式 token 节流(2026-07-25 立):
        // 用 requestAnimationFrame 每帧合并一次 token,避免每个 token 触发 store 更新 + React 重渲染
        const contentBatcher = createDeltaBatcher((d)=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().appendToMessage(assistantId, d));
        const reasoningBatcher = createDeltaBatcher((d)=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().appendReasoningToMessage(assistantId, d));
        const agentBatcher = createAgentDeltaBatcher();
        // 从 auth store 获取 userId(用于回调链路关联)
        const userId = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().user?.id ?? '';
        // 从 ai-panel store 获取当前绑定的本地工作区路径(用于注入 CLAUDE.md/AGENTS.md 项目记忆)
        const workspacePath = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.path;
        // 2026-07-31 防御性降级:'auto' 模型后端不支持,降级到 stepfun/step-router-v1
        // (正常路径 setModel 已降级,此处防止其他路径绕过 setModel 直接传 'auto')
        const effectiveModel = model === 'auto' ? 'stepfun/step-router-v1' : model;
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["streamChat"])({
                model: effectiveModel,
                messages: [
                    ...history,
                    {
                        role: 'user',
                        content: text
                    }
                ],
                signal: controller.signal,
                metadata: {
                    conversationId,
                    userId,
                    messageId: assistantId
                },
                // 模式透传(2026-07-22 立,对标 Trae Plan/Spec):build/plan/review/spec
                // Plan/Act 模式(2026-07-24 立):plan=只制定计划不执行工具,act=正常执行
                extraBody: {
                    // ChatMode 4 态唯一模式字段(2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已废弃,语义合并到 mode)
                    mode: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModeStore"].getState().currentMode
                },
                workspacePath,
                // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,API 端调用共享包压缩
                contextLimit: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$model$2d$context$2d$capacity$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getModelContextCapacity"])(effectiveModel),
                onCompaction: (info)=>{
                    // 后端自动压缩完成,toast 提示用户(对标 CLI /compact 命令的可见性)
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success('上下文已自动压缩', {
                        description: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatTokenCount"])(info.tokensBefore)} → ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatTokenCount"])(info.tokensAfter)}(移除 ${info.removedCount} 条历史)`
                    });
                },
                onQuestion: (q)=>{
                    // AI 主动提问:挂起对话,弹窗阻塞输入,等用户回答后 sendAnswer 续流
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setPendingQuestion({
                        questionId: q.questionId,
                        prompt: q.prompt,
                        options: q.options,
                        allowCustom: q.allowCustom,
                        allowMultiple: q.allowMultiple,
                        assistantMessageId: assistantId
                    });
                    // P2 多端同步:持久化挂起状态到 conversation.metadata + WS 广播 ai_question 给其他端
                    // fire-and-forget,失败仅日志(当前端弹窗仍正常,只是其他端不会同步)
                    const convId = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().conversationId;
                    if (convId) {
                        void persistQuestionSafe(convId, {
                            questionId: q.questionId,
                            prompt: q.prompt,
                            options: q.options,
                            allowCustom: q.allowCustom,
                            allowMultiple: q.allowMultiple
                        });
                    }
                },
                // P4-2: 后端 fallback 触发时设置通知状态,UI 展示"已切换到备用模型"横幅
                onFallback: (event)=>setFallbackNotice(event),
                // 2026-07-27 修复:response 已到达即清除"完全冷启动"超时(timeout15s),
                // 避免"response 到达但首 token 未到达"时误 abort 导致 net::ERR_ABORTED。
                // 保留 timeout60s(防止 reasoning 模型长时间只产 reasoning 不产 content)。
                onResponse: ()=>{
                    clearTimeout(timeout15sId);
                },
                onDelta: (delta)=>{
                    if (!firstContentTokenReceived) {
                        firstContentTokenReceived = true;
                        clearTimeout(timeout15sId);
                        clearTimeout(timeout60sId);
                    }
                    contentBatcher.batch(delta);
                },
                onAgentDelta: (_agentId, delta)=>{
                    if (!firstContentTokenReceived) {
                        firstContentTokenReceived = true;
                        clearTimeout(timeout15sId);
                        clearTimeout(timeout60sId);
                    }
                    agentBatcher.batch(_agentId, delta);
                },
                onReasoning: (delta)=>{
                    if (!firstReasoningTokenReceived) {
                        firstReasoningTokenReceived = true;
                        // 2026-07-27 修复:收到 reasoning token 即清除 timeout15s(完全冷启动超时),
                        // 避免冷启动延迟 + 首个 reasoning 到达间隔 >30s 时误 abort。
                        // 保留 timeout60s(防止 reasoning 模型长时间只产 reasoning 不产 content)。
                        clearTimeout(timeout15sId);
                    }
                    reasoningBatcher.batch(delta);
                },
                onToolCall: (event)=>{
                    // 2026-07-27 修复工具调用场景下 15s 超时中断 SSE 流:
                    // 工具调用过程中 SSE 只发 tool-call-start/tool-result 事件,不发 content/reasoning token,
                    // 导致 firstContentTokenReceived 和 firstReasoningTokenReceived 都为 false,
                    // 15s 后 timeout15s 触发 controller.abort() 中断 SSE 流,UI 显示"无响应"。
                    // 修复:收到任意 tool-call 事件即视为正常响应,清除两个超时定时器。
                    if (!firstContentTokenReceived) {
                        firstContentTokenReceived = true;
                        clearTimeout(timeout15sId);
                        clearTimeout(timeout60sId);
                    }
                    createToolCallHandler(assistantId)(event);
                },
                // Subagent 自动派发(2026-07-28 立,对标 Trae Work):
                // 后端 dispatch_subagent 工具执行前后发 subagent_spawn/end SSE 事件,
                // 前端通过回调写入 chat store.subAgentActivities,UI 自动展示生命周期。
                // 2026-07-29 Phase 21:同步写入 timeline-store,让 Timeline tab 实时响应。
                onSubagentSpawn: (evt)=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().addSubagentSpawn(evt);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTimelineStore"].getState().addEvent((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$subagent$2d$timeline$2d$mapper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["mapSpawnToTimelineEvent"])(evt));
                },
                onSubagentProgress: (evt)=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().updateSubagentProgress(evt);
                    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$subagent$2d$timeline$2d$mapper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["mapProgressToTimelineUpdate"])(evt);
                    if (update) __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTimelineStore"].getState().updateEvent(update.id, update.updates);
                },
                onSubagentEnd: (evt)=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().markSubagentEnd(evt);
                    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$subagent$2d$timeline$2d$mapper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["mapEndToTimelineUpdate"])(evt);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTimelineStore"].getState().updateEvent(update.id, update.updates);
                },
                agentTools: mergeAgentTools(),
                onError: (errMsg, info)=>{
                    // #9 错误前先 flush 累积 token,避免最后一批内容丢失
                    contentBatcher.flush();
                    reasoningBatcher.flush();
                    agentBatcher.flushAll();
                    const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(errMsg, info);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                    if (formatted.severity === 'auth') {
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLoginDialogStore"].getState().open('login');
                    }
                    // 前端错误码透出(P1,2026-07-22 立):toast description 前缀 [errorCode],
                    // 让用户直接定位问题(MODEL_NOT_CONFIGURED/PROVIDER_NOT_IMPLEMENTED/LLM_ERROR 等)
                    const ec = info?.errorCode;
                    const toastDesc = formatted.severity === 'auth' ? formatted.message : ec ? `[${ec}] ${formatted.rawMessage}` : formatted.rawMessage;
                    if (formatted.severity === 'ratelimit') {
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(formatted.title, {
                            description: toastDesc
                        });
                    } else if (formatted.severity === 'safety') {
                        // 内容被 AI 厂商安全策略拦截,用 warning 级别提示用户调整提问方式
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(formatted.title, {
                            description: formatted.message
                        });
                    } else {
                        // P1 错误重试(2026-07-23):toast 加 retry 按钮,一键重发
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(formatted.title, {
                            description: toastDesc,
                            action: {
                                label: '重试',
                                onClick: ()=>sendMessage(lastSentContentRef.current)
                            }
                        });
                    }
                }
            });
        } catch (err) {
            // #9 catch 前先 flush 累积 token,避免最后一批内容丢失
            contentBatcher.flush();
            reasoningBatcher.flush();
            agentBatcher.flushAll();
            if (err instanceof DOMException && err.name === 'AbortError') {
                // #13 区分两种超时:15s 完全冷启动 vs 60s reasoning 已收到但 content 未到
                // 用户主动 stop 触发的 abort(abortedByTimeout* 均为 false)静默不报错
                if (abortedByTimeout15s) {
                    const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(err, 'AI 响应超时(15 秒内未收到任何内容),请稍后重试');
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                } else if (abortedByTimeout60s) {
                    const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(err, 'AI 思考超时(60 秒内未产出回答内容,可能 reasoning 模型思考过长),请稍后重试或换用普通模型');
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                }
            } else {
                const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(err);
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                if (formatted.severity === 'auth') {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLoginDialogStore"].getState().open('login');
                }
                // 前端错误码透出(P1):catch 路径(HTTP 4xx throw)的 errorCode 从 formatted 直接取
                const ec = formatted.errorCode;
                const prefix = ec ? `[${ec}] ` : '';
                if (formatted.severity === 'ratelimit' || formatted.severity === 'safety') {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(formatted.title, {
                        description: `${prefix}${formatted.message}`
                    });
                } else if (formatted.severity === 'network') {
                    // P1 错误重试(2026-07-23):网络错误 toast 加 retry 按钮
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(formatted.title, {
                        description: `${prefix}${formatted.message}`,
                        action: {
                            label: '重试',
                            onClick: ()=>sendMessage(lastSentContentRef.current)
                        }
                    });
                } else {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(formatted.title, {
                        description: `${prefix}${formatted.rawMessage}`,
                        action: {
                            label: '重试',
                            onClick: ()=>sendMessage(lastSentContentRef.current)
                        }
                    });
                }
            }
        } finally{
            clearTimeout(timeout15sId);
            clearTimeout(timeout60sId);
            // 2026-07-27 修复"AI 响应不显示":finally 必须先 flush 再 cancel,
            // 否则最后一批 token(还在 pending 未触发 rAF)会被 cancel 直接丢弃,
            // 导致 streamChat 成功返回后 UI 仍为空。
            // flush 内部已 cancelAnimationFrame + 清 pending,后续 cancel 仅兜底。
            contentBatcher.flush();
            reasoningBatcher.flush();
            agentBatcher.flushAll();
            contentBatcher.cancel();
            reasoningBatcher.cancel();
            agentBatcher.cancelAll();
            abortRef.current = null;
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setStreaming(false);
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().markAllAgentStreamsDone();
        }
        // 消息已提交到 store(即使流式出错也有 error 标记 + retry 按钮),可清空输入框
        return true;
    }, [
        router,
        queryClient,
        t
    ]);
    const stop = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        abortRef.current?.abort();
    }, []);
    // 用户回答 AI 主动提问:调 /chat/answer 续流,不中断对话
    // 后端会把 answer 作为新 user 消息 append 到 messages 末尾,继续生成
    const sendAnswer = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (answer)=>{
        const trimmed = answer.trim();
        if (!trimmed) return;
        const store = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState();
        const pending = store.pendingQuestion;
        if (!pending || store.isStreaming) return;
        // #10 入口存储 lastSentAnswerRef(2026-07-25 立):catch 块 retry 按钮用
        lastSentAnswerRef.current = {
            answer: trimmed,
            questionId: pending.questionId
        };
        // 立即关闭弹窗,避免重复提交
        store.clearPendingQuestion();
        const model = store.currentModel;
        // 历史消息(不含 answer,后端 /chat/answer 自动 append answer 到末尾)
        const history = store.messages.filter((m)=>!m.error && (m.role === 'user' || m.role === 'assistant') && m.content).map((m)=>({
                role: m.role,
                content: m.content
            }));
        // UI 上把 answer 显示为 user 消息(让用户看到自己回答了什么)
        store.addMessage({
            role: 'user',
            content: trimmed,
            model
        });
        // 记录续流时的工作区权限模式(2026-07-25 深化,深度对标 Codex 透明性)
        const currentMode = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.mode;
        const assistantId = store.addMessage({
            role: 'assistant',
            content: '',
            model,
            permissionMode: currentMode
        });
        store.setStreaming(true);
        store.setError(null);
        store.resetSubAgentActivities();
        // P4-2: 清除上一轮 fallback 通知(与 sendMessage 对称)
        setFallbackNotice(null);
        const controller = new AbortController();
        abortRef.current = controller;
        // #13 首 token 超时区分 reasoning(2026-07-25 立,与 sendMessage 对称)
        // 2026-07-27 修复:15s → 30s(与 sendMessage 同步,防冷启动误 abort)
        let firstContentTokenReceived = false;
        let firstReasoningTokenReceived = false;
        let abortedByTimeout15s = false;
        let abortedByTimeout60s = false;
        const timeout15sId = setTimeout(()=>{
            if (!firstContentTokenReceived && !firstReasoningTokenReceived) {
                abortedByTimeout15s = true;
                controller.abort();
            }
        }, 30000);
        const timeout60sId = setTimeout(()=>{
            if (!firstContentTokenReceived && firstReasoningTokenReceived) {
                abortedByTimeout60s = true;
                controller.abort();
            }
        }, 60000);
        // #9 流式 token 节流(2026-07-25 立,与 sendMessage 对称)
        const contentBatcher = createDeltaBatcher((d)=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().appendToMessage(assistantId, d));
        const reasoningBatcher = createDeltaBatcher((d)=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().appendReasoningToMessage(assistantId, d));
        const agentBatcher = createAgentDeltaBatcher();
        const userId = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().user?.id ?? '';
        const workspacePath = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.path;
        // 2026-07-31 防御性降级:与 sendMessage 对称,'auto' → stepfun/step-router-v1
        const effectiveModel = model === 'auto' ? 'stepfun/step-router-v1' : model;
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["streamChat"])({
                model: effectiveModel,
                messages: history,
                path: '/ai/chat/answer',
                extraBody: {
                    questionId: pending.questionId,
                    answer: trimmed,
                    // 模式透传(2026-07-22 立,对标 Trae Plan/Spec):build/plan/review/spec
                    // 2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已废弃,仅传 mode
                    mode: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModeStore"].getState().currentMode
                },
                signal: controller.signal,
                metadata: {
                    conversationId: store.conversationId ?? undefined,
                    userId,
                    messageId: assistantId
                },
                workspacePath,
                contextLimit: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$model$2d$context$2d$capacity$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getModelContextCapacity"])(effectiveModel),
                // P4-2: 后端 fallback 触发时设置通知状态(与 sendMessage 对称)
                onFallback: (event)=>setFallbackNotice(event),
                // 2026-07-27 修复:与 sendMessage 同步,response 到达即清除 timeout15s
                onResponse: ()=>{
                    clearTimeout(timeout15sId);
                },
                onDelta: (delta)=>{
                    if (!firstContentTokenReceived) {
                        firstContentTokenReceived = true;
                        clearTimeout(timeout15sId);
                        clearTimeout(timeout60sId);
                    }
                    contentBatcher.batch(delta);
                },
                onAgentDelta: (agentId, delta)=>{
                    if (!firstContentTokenReceived) {
                        firstContentTokenReceived = true;
                        clearTimeout(timeout15sId);
                        clearTimeout(timeout60sId);
                    }
                    agentBatcher.batch(agentId, delta);
                },
                onReasoning: (delta)=>{
                    if (!firstReasoningTokenReceived) {
                        firstReasoningTokenReceived = true;
                        // 2026-07-27 修复:与 sendMessage 同步,收到 reasoning 即清除 timeout15s
                        clearTimeout(timeout15sId);
                    }
                    reasoningBatcher.batch(delta);
                },
                onToolCall: createToolCallHandler(assistantId),
                // Subagent 自动派发(2026-07-28 立,与 sendMessage 对称):
                // sendAnswer 续流同样可能触发 dispatch_subagent 工具,需写入 store。
                // 2026-07-29 Phase 21:补齐 onSubagentProgress + 同步写入 timeline-store。
                onSubagentSpawn: (evt)=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().addSubagentSpawn(evt);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTimelineStore"].getState().addEvent((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$subagent$2d$timeline$2d$mapper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["mapSpawnToTimelineEvent"])(evt));
                },
                onSubagentProgress: (evt)=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().updateSubagentProgress(evt);
                    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$subagent$2d$timeline$2d$mapper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["mapProgressToTimelineUpdate"])(evt);
                    if (update) __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTimelineStore"].getState().updateEvent(update.id, update.updates);
                },
                onSubagentEnd: (evt)=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().markSubagentEnd(evt);
                    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$subagent$2d$timeline$2d$mapper$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["mapEndToTimelineUpdate"])(evt);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTimelineStore"].getState().updateEvent(update.id, update.updates);
                },
                agentTools: mergeAgentTools(),
                onError: (errMsg, info)=>{
                    // #9 错误前先 flush 累积 token,避免最后一批内容丢失
                    contentBatcher.flush();
                    reasoningBatcher.flush();
                    agentBatcher.flushAll();
                    const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(errMsg, info);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                    if (formatted.severity === 'auth') {
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLoginDialogStore"].getState().open('login');
                    }
                    // 前端错误码透出(P1):sendAnswer 路径同 sendMessage,toast description 加 [errorCode] 前缀
                    const ec = info?.errorCode;
                    const toastDesc = formatted.severity === 'auth' ? formatted.message : ec ? `[${ec}] ${formatted.rawMessage}` : formatted.rawMessage;
                    if (formatted.severity === 'ratelimit') {
                        // ratelimit/safety 错误保持 warning 无 retry(与 sendMessage 一致)
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(formatted.title, {
                            description: toastDesc
                        });
                    } else if (formatted.severity === 'safety') {
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(formatted.title, {
                            description: formatted.message
                        });
                    } else {
                        // #10 sendAnswer 错误加 retry 按钮(2026-07-25 立,与 sendMessage 路径对齐)
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(formatted.title, {
                            description: toastDesc,
                            action: {
                                label: '重试',
                                onClick: ()=>{
                                    const last = lastSentAnswerRef.current;
                                    if (last) sendAnswer(last.answer);
                                }
                            }
                        });
                    }
                }
            });
        } catch (err) {
            // #9 catch 前先 flush 累积 token
            contentBatcher.flush();
            reasoningBatcher.flush();
            agentBatcher.flushAll();
            if (err instanceof DOMException && err.name === 'AbortError') {
                // #13 区分两种超时,用户主动 stop 静默不报错
                if (abortedByTimeout15s) {
                    const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(err, 'AI 响应超时(15 秒内未收到任何内容),请稍后重试');
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                } else if (abortedByTimeout60s) {
                    const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(err, 'AI 思考超时(60 秒内未产出回答内容,可能 reasoning 模型思考过长),请稍后重试或换用普通模型');
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                }
            } else {
                const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSSEError"])(err);
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setMessageError(assistantId, formatted.message);
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setError(formatted.message);
                if (formatted.severity === 'auth') {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLoginDialogStore"].getState().open('login');
                }
                // 前端错误码透出(P1):catch 路径(HTTP 4xx throw)的 errorCode 从 formatted 直接取
                const ec = formatted.errorCode;
                const prefix = ec ? `[${ec}] ` : '';
                if (formatted.severity === 'ratelimit' || formatted.severity === 'safety') {
                    // ratelimit/safety 错误保持 warning 无 retry
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(formatted.title, {
                        description: `${prefix}${formatted.message}`
                    });
                } else if (formatted.severity === 'network') {
                    // #10 网络错误 toast 加 retry 按钮(2026-07-25 立,与 sendMessage 对称)
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(formatted.title, {
                        description: `${prefix}${formatted.message}`,
                        action: {
                            label: '重试',
                            onClick: ()=>{
                                const last = lastSentAnswerRef.current;
                                if (last) sendAnswer(last.answer);
                            }
                        }
                    });
                } else {
                    // #10 通用错误 toast 加 retry 按钮
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$common$2f$Toaster$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(formatted.title, {
                        description: `${prefix}${formatted.rawMessage}`,
                        action: {
                            label: '重试',
                            onClick: ()=>{
                                const last = lastSentAnswerRef.current;
                                if (last) sendAnswer(last.answer);
                            }
                        }
                    });
                }
            }
        } finally{
            clearTimeout(timeout15sId);
            clearTimeout(timeout60sId);
            // 2026-07-27 修复"AI 响应不显示"(与 sendMessage 对称):先 flush 再 cancel
            contentBatcher.flush();
            reasoningBatcher.flush();
            agentBatcher.flushAll();
            contentBatcher.cancel();
            reasoningBatcher.cancel();
            agentBatcher.cancelAll();
            abortRef.current = null;
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().setStreaming(false);
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().markAllAgentStreamsDone();
        }
        return;
    }, []);
    // 跳过当前挂起的提问:不续流 LLM,允许用户继续发新消息
    const skipQuestion = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"].getState().clearPendingQuestion();
    }, []);
    // 组件卸载时中止进行中的流式请求,避免后台僵尸请求
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        return ()=>{
            abortRef.current?.abort();
        };
    }, []);
    const clearMessages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.clearMessages);
    const setModel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.setModel);
    const pendingQuestion = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChatStore"])((s)=>s.pendingQuestion);
    // P4-2: 清除 fallback 通知(用户关闭横幅时调用)
    const clearFallbackNotice = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>setFallbackNotice(null), []);
    // P3 Inline Diff Apply 工作流:Accept 调 API 写入文件,Reject 纯前端标记
    const { applyDiff, rejectDiff } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$apply$2d$diff$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useApplyDiff"])();
    return {
        messages,
        currentModel,
        isStreaming,
        error,
        pendingQuestion,
        fallbackNotice,
        sendMessage,
        sendAnswer,
        skipQuestion,
        stop,
        clearMessages,
        setModel,
        clearFallbackNotice,
        applyDiff,
        rejectDiff
    };
}
}),
"[project]/apps/web/src/hooks/use-debounce.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$hooks$2f$use$2d$debounce$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/hooks/use-debounce.ts [app-ssr] (ecmascript)");
'use client';
;
}),
"[project]/apps/web/src/hooks/use-agent-stream.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAgentStream",
    ()=>useAgentStream
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
/**
 * LangGraph Agent SSE 流消费 hook(2026-07-23 立,Q1 HITL web 端)
 *
 * 端点:GET /api/agent-langgraph/:threadId/stream?input=<JSON>
 *
 * 实现:fetch + ReadableStream(而非 EventSource),原因:
 *  1. 可主动 abort(stop)
 *  2. 可读取错误响应体,触发 onError 而非静默重连
 *  3. 解析完整 SSE 帧(event/data 双字段),支持 12 类事件
 *
 * 事件分发(对应 SSEEventType):
 *  - session     → 标记流开始
 *  - token       → 累积到 currentContent
 *  - node_start  → 设置 currentNode
 *  - node_end    → 清除 currentNode
 *  - tool_call/tool_result → 追加事件
 *  - state_update → 更新 lastState
 *  - plan        → 更新 lastPlan
 *  - interrupt   → 设置 interruptEvent + 调用 onInterrupt(流不自动断开,等待 resume 后 server 继续 push)
 *  - done        → 调用 onDone,停止 streaming
 *  - error       → 调用 onError,停止 streaming
 *  - custom      → 追加事件
 */ const MAX_EVENTS = 200;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 3000;
const initialState = {
    events: [],
    interruptEvent: null,
    currentNode: null,
    content: '',
    lastState: null,
    lastPlan: null,
    error: null
};
/**
 * 解析单个 SSE 帧(以空行分隔的文本块),返回 SSEEvent 或 null
 *
 * 帧格式:
 *   event: <type>
 *   data: <json>
 *
 * 或仅 data 行(默认 message 事件,LangGraph 不使用,但兼容)
 */ function parseSseFrame(frame) {
    const lines = frame.split('\n');
    let eventType = 'message';
    const dataLines = [];
    for (const line of lines){
        if (!line) continue;
        if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
        }
    }
    if (dataLines.length === 0) return null;
    const dataStr = dataLines.join('\n');
    try {
        const parsed = JSON.parse(dataStr);
        // 服务端可能省略 type 字段,用 event: 行兜底
        if (!parsed.type) {
            parsed.type = eventType;
        }
        return parsed;
    } catch  {
        // data 非 JSON(如纯文本 token),包装为 custom 事件
        return {
            type: 'custom',
            threadId: '',
            data: dataStr,
            timestamp: new Date().toISOString()
        };
    }
}
function useAgentStream(options) {
    const { threadId, onEvent, onInterrupt, onDone, onError, autoReconnect = false } = options;
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialState);
    const [isStreaming, setIsStreaming] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [reconnectAttempt, setReconnectAttempt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const abortRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const streamRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // 回调存 ref,避免 start 依赖变化导致闭包陈旧
    const cbRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])({
        onEvent,
        onInterrupt,
        onDone,
        onError
    });
    cbRef.current = {
        onEvent,
        onInterrupt,
        onDone,
        onError
    };
    // 重连相关 ref
    const autoReconnectRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(autoReconnect);
    autoReconnectRef.current = autoReconnect;
    const receivedDoneRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const userStoppedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const lastInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(undefined);
    const reconnectAttemptRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const reconnectTimerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // start 函数 ref(供重连递归调用,避免闭包陈旧)
    const startRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(()=>{});
    const clearReconnectTimer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);
    const stop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        userStoppedRef.current = true;
        clearReconnectTimer();
        if (streamRef.current) {
            streamRef.current.cancel().catch(()=>{});
            streamRef.current = null;
        }
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        setIsStreaming(false);
    }, [
        clearReconnectTimer
    ]);
    const clear = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setState(initialState);
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
    }, []);
    const clearInterrupt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setState((s)=>({
                ...s,
                interruptEvent: null
            }));
    }, []);
    const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((input)=>{
        if (!threadId) return;
        // 已在流中,先停止旧流
        if (abortRef.current) {
            stop();
        }
        clearReconnectTimer();
        // 重置重连标志(每次主动 start 都视为新会话)
        receivedDoneRef.current = false;
        userStoppedRef.current = false;
        lastInputRef.current = input;
        // 主动 start 时重置重连计数(但重连内部调用 start 时不重置)
        // 用 reconnectAttemptRef > 0 判断是否为重连调用
        if (reconnectAttemptRef.current === 0) {
            setReconnectAttempt(0);
        }
        const query = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : '';
        const url = `/api/agent-langgraph/${threadId}/stream${query}`;
        const controller = new AbortController();
        abortRef.current = controller;
        setState((s)=>({
                ...initialState,
                events: s.events
            }));
        setIsStreaming(true);
        const dispatch = (evt)=>{
            setState((prev)=>{
                const events = [
                    ...prev.events,
                    evt
                ];
                // 截断保留最近 MAX_EVENTS 条
                if (events.length > MAX_EVENTS) {
                    events.splice(0, events.length - MAX_EVENTS);
                }
                const next = {
                    ...prev,
                    events
                };
                switch(evt.type){
                    case 'token':
                        next.content = prev.content + String(evt.data ?? '');
                        next.currentNode = prev.currentNode;
                        break;
                    case 'node_start':
                        next.currentNode = evt.nodeId ?? null;
                        break;
                    case 'node_end':
                        next.currentNode = null;
                        break;
                    case 'state_update':
                        next.lastState = evt.data;
                        break;
                    case 'plan':
                        next.lastPlan = evt.data;
                        break;
                    case 'interrupt':
                        next.interruptEvent = evt;
                        break;
                    case 'error':
                        next.error = String(evt.data ?? '未知错误');
                        break;
                    default:
                        break;
                }
                return next;
            });
            // 派发回调(在 setState 之外,避免回调内 setState 死循环)
            const cb = cbRef.current;
            cb.onEvent?.(evt);
            if (evt.type === 'interrupt') cb.onInterrupt?.(evt);
            if (evt.type === 'done') {
                receivedDoneRef.current = true;
                cb.onDone?.();
                setIsStreaming(false);
            }
            if (evt.type === 'error') {
                cb.onError?.(String(evt.data ?? '未知错误'));
                setIsStreaming(false);
            }
        };
        // 尝试自动重连(stream 异常中断时)
        const tryReconnect = ()=>{
            if (!autoReconnectRef.current) return;
            if (userStoppedRef.current) return;
            if (receivedDoneRef.current) return;
            if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
                setReconnectAttempt(0);
                reconnectAttemptRef.current = 0;
                return;
            }
            reconnectAttemptRef.current += 1;
            const attempt = reconnectAttemptRef.current;
            setReconnectAttempt(attempt);
            const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            reconnectTimerRef.current = setTimeout(()=>{
                reconnectTimerRef.current = null;
                // 重连前再次检查用户是否已 stop
                if (userStoppedRef.current) return;
                startRef.current(lastInputRef.current);
            }, delay);
        };
        (async ()=>{
            try {
                const res = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        Accept: 'text/event-stream'
                    }
                });
                if (!res.ok || !res.body) {
                    const msg = `HTTP ${res.status}`;
                    cbRef.current.onError?.(msg);
                    setState((s)=>({
                            ...s,
                            error: msg
                        }));
                    setIsStreaming(false);
                    // HTTP 错误也尝试重连
                    tryReconnect();
                    return;
                }
                const reader = res.body.getReader();
                streamRef.current = reader;
                // 重连成功后重置计数
                if (reconnectAttemptRef.current > 0) {
                    reconnectAttemptRef.current = 0;
                    setReconnectAttempt(0);
                }
                const decoder = new TextDecoder();
                let buffer = '';
                // SSE 流式响应的标准模式:while(true) 持续读取直到 done
                while(true){
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, {
                        stream: true
                    });
                    // SSE 帧以空行(\n\n)分隔
                    let idx = buffer.indexOf('\n\n');
                    while(idx !== -1){
                        const frame = buffer.slice(0, idx);
                        buffer = buffer.slice(idx + 2);
                        const evt = parseSseFrame(frame);
                        if (evt) dispatch(evt);
                        idx = buffer.indexOf('\n\n');
                    }
                }
                // stream 正常结束但未收到 done event → 可能是 server 主动关闭,尝试重连
                tryReconnect();
            } catch (err) {
                if (controller.signal.aborted) {
                    // 主动 stop,不报错
                    return;
                }
                const msg = err instanceof Error ? err.message : String(err);
                cbRef.current.onError?.(msg);
                setState((s)=>({
                        ...s,
                        error: msg
                    }));
                // 网络错误尝试重连
                tryReconnect();
            } finally{
                setIsStreaming(false);
                streamRef.current = null;
                abortRef.current = null;
            }
        })();
    }, [
        threadId,
        stop,
        clearReconnectTimer
    ]);
    // 保持 startRef 最新,供重连递归调用
    startRef.current = start;
    // 卸载时清理重连定时器
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        return ()=>{
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, []);
    return {
        events: state.events,
        isStreaming,
        interruptEvent: state.interruptEvent,
        currentNode: state.currentNode,
        content: state.content,
        lastState: state.lastState,
        lastPlan: state.lastPlan,
        error: state.error,
        reconnectAttempt,
        start,
        stop,
        clear,
        clearInterrupt
    };
}
}),
"[project]/apps/web/src/hooks/use-agent-progress.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SUBAGENT_COLOR_CLASS",
    ()=>SUBAGENT_COLOR_CLASS,
    "useAgentProgress",
    ()=>useAgentProgress
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$agent$2d$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-agent-stream.ts [app-ssr] (ecmascript)");
'use client';
;
;
/** 昵称池(Codex 风格:validator/reviewer/explorer/implementer 等) */ const NICKNAME_POOL = [
    'validator',
    'reviewer',
    'explorer',
    'implementer',
    'planner',
    'tester',
    'researcher',
    'optimizer',
    'debugger',
    'refactorer'
];
/** 子代理颜色池(循环分配) */ const COLOR_POOL = [
    'cyan',
    'blue',
    'green',
    'yellow',
    'magenta',
    'red'
];
const SUBAGENT_COLOR_CLASS = {
    cyan: 'text-cyan-500',
    blue: 'text-blue-500',
    green: 'text-emerald-500',
    yellow: 'text-amber-500',
    magenta: 'text-fuchsia-500',
    red: 'text-red-500'
};
/** 从 threadId 派生稳定昵称(同一 threadId 总是得到相同昵称) */ function deriveNickname(threadId, index) {
    // 基于 threadId 哈希到 NICKNAME_POOL,保证稳定
    let hash = 0;
    for(let i = 0; i < threadId.length; i++){
        hash = hash * 31 + threadId.charCodeAt(i) >>> 0;
    }
    const name = NICKNAME_POOL[hash % NICKNAME_POOL.length] ?? 'agent';
    // 若有多个同基础名,加序号
    return index === 0 ? name : `${name}-${index + 1}`;
}
function parseToolData(data) {
    if (!data || typeof data !== 'object') return {};
    return data;
}
/** 从 tool args 推导 InlineDiffInfo */ function deriveDiffInfoFromArgs(toolName, args) {
    const pickStr = (keys)=>{
        for (const k of keys){
            const v = args[k];
            if (typeof v === 'string') return v;
        }
        return '';
    };
    const filePath = pickStr([
        'path',
        'file_path',
        'filePath',
        'filename'
    ]) || '(未知文件)';
    if (toolName === 'edit_file') {
        const oldContent = pickStr([
            'oldText',
            'old_text',
            'oldContent',
            'old_content'
        ]);
        const newContent = pickStr([
            'newText',
            'new_text',
            'newContent',
            'new_content'
        ]);
        if (!oldContent && !newContent) return null;
        return {
            file_path: filePath,
            old_content: oldContent,
            new_content: newContent
        };
    }
    if (toolName === 'write_file') {
        const content = pickStr([
            'content',
            'fileContent',
            'file_content',
            'text'
        ]);
        if (!content) return null;
        return {
            file_path: filePath,
            old_content: '',
            new_content: content,
            is_new_file: true
        };
    }
    return null;
}
const CHANGE_TOOL_NAMES = new Set([
    'edit_file',
    'write_file'
]);
/** 从 SSE 事件提取 PlanStep(支持 plan_updated / plan / node_start / node_end) */ function extractPlanFromEvents(events) {
    // 优先:Codex 风格 plan_updated 事件(权威快照)
    // 兼容 ai-service langgraph_stream.py 发出的 plan 事件(update 中含 "plan" 字段)
    const planSnapshots = events.filter((e)=>e.type === 'plan_updated' || e.type === 'plan');
    if (planSnapshots.length > 0) {
        const lastSnapshot = planSnapshots[planSnapshots.length - 1];
        if (!lastSnapshot) return [];
        const data = lastSnapshot.data;
        if (data?.plan && Array.isArray(data.plan)) {
            const steps = data.plan.map((item, idx)=>{
                const step = {
                    id: `plan-${idx}`,
                    step: item.step,
                    status: item.status,
                    explanation: data.explanation
                };
                // Codex:从 plan_updated 快照中提取时间戳(若上游提供)
                if (item.startedAt) step.startedAt = item.startedAt;
                if (item.endedAt) step.endedAt = item.endedAt;
                if (item.durationMs !== undefined) step.durationMs = item.durationMs;
                if (item.tokenUsage !== undefined) step.tokenUsage = item.tokenUsage;
                // 若有 startedAt 但无 durationMs,基于当前时间计算 in_progress 的 elapsedMs
                if (step.status === 'in_progress' && step.startedAt && step.durationMs === undefined) {
                    const startMs = Date.parse(step.startedAt);
                    if (!Number.isNaN(startMs)) {
                        step.durationMs = Math.max(0, Date.now() - startMs);
                    }
                }
                return step;
            });
            // 硬规则:最多一个 in_progress(冗余校验,违反时只保留第一个,其余降级为 pending)
            const inProgressCount = steps.filter((s)=>s.status === 'in_progress').length;
            if (inProgressCount > 1) {
                let foundFirst = false;
                for (const s of steps){
                    if (s.status === 'in_progress') {
                        if (foundFirst) s.status = 'pending';
                        foundFirst = true;
                    }
                }
            }
            return steps;
        }
    }
    // 降级:从 node_start / node_end 配对派生(兼容旧事件)
    const map = new Map();
    for (const evt of events){
        if (evt.type === 'node_start') {
            const nodeId = evt.nodeId ?? `node-${evt.timestamp}`;
            map.set(nodeId, {
                id: nodeId,
                step: nodeId,
                status: 'in_progress',
                startedAt: evt.timestamp
            });
        } else if (evt.type === 'node_end') {
            const nodeId = evt.nodeId ?? '';
            const existing = nodeId ? map.get(nodeId) : undefined;
            if (existing) {
                existing.status = 'completed';
                existing.endedAt = evt.timestamp;
                const startMs = Date.parse(existing.startedAt ?? '');
                const endMs = Date.parse(evt.timestamp);
                if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
                    existing.durationMs = Math.max(0, endMs - startMs);
                }
            }
        }
    }
    const steps = Array.from(map.values());
    // 硬规则:最多一个 in_progress
    const inProgressCount = steps.filter((s)=>s.status === 'in_progress').length;
    if (inProgressCount > 1) {
        let foundFirst = false;
        for (const s of steps){
            if (s.status === 'in_progress') {
                if (foundFirst) s.status = 'pending';
                foundFirst = true;
            }
        }
    }
    return steps;
}
/** 从 SSE 事件提取 Subagent(支持 subagent_spawn / subagent_end / subagent_status)
 *  v10 Phase 5:同时从 tool_call/tool_result 事件中按 data.subagentId 关联工具调用
 */ function extractSubagentsFromEvents(events) {
    const map = new Map();
    let nicknameIndex = 0;
    for (const evt of events){
        if (evt.type === 'subagent_spawn') {
            const data = evt.data;
            const id = data?.id ?? data?.threadId ?? `sub-${evt.timestamp}`;
            const threadId = data?.threadId ?? id;
            const nickname = data?.nickname ?? deriveNickname(threadId, nicknameIndex);
            const color = COLOR_POOL[nicknameIndex % COLOR_POOL.length] ?? 'cyan';
            nicknameIndex++;
            map.set(id, {
                id,
                threadId,
                nickname,
                handle: `@${nickname}`,
                color,
                status: 'running',
                role: data?.role,
                spawnedAt: evt.timestamp,
                currentTask: data?.task,
                pendingApproval: data?.pendingApproval,
                tools: []
            });
        } else if (evt.type === 'subagent_end') {
            const data = evt.data;
            const id = data?.id ?? data?.threadId ?? '';
            const existing = id ? map.get(id) : undefined;
            if (existing) {
                existing.status = data?.status ?? 'done';
                existing.endedAt = evt.timestamp;
                const startMs = Date.parse(existing.spawnedAt);
                const endMs = Date.parse(evt.timestamp);
                if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
                    existing.durationMs = Math.max(0, endMs - startMs);
                }
                // Codex:提取死亡原因 + 最终 token/工具调用统计
                const reason = data?.failureReason ?? data?.error;
                if (reason) existing.failureReason = reason;
                if (data?.tokenUsage !== undefined) existing.tokenUsage = data.tokenUsage;
                if (data?.toolCalls !== undefined) existing.toolCalls = data.toolCalls;
            }
        } else if (evt.type === 'subagent_status') {
            const data = evt.data;
            const id = data?.id ?? data?.threadId ?? '';
            const existing = id ? map.get(id) : undefined;
            if (existing) {
                if (data?.status) existing.status = data.status;
                if (data?.task !== undefined) existing.currentTask = data.task;
                if (data?.pendingApproval !== undefined) existing.pendingApproval = data.pendingApproval;
                // Codex:实时 token / tool 调用累计 + 死亡原因
                if (data?.tokenUsage !== undefined) existing.tokenUsage = data.tokenUsage;
                if (data?.toolCalls !== undefined) existing.toolCalls = data.toolCalls;
                const reason = data?.failureReason ?? data?.error;
                if (reason) existing.failureReason = reason;
            }
        }
    }
    // v10 Phase 5:从 tool_call/tool_result 事件中按 data.subagentId 关联工具调用
    const toolMap = new Map();
    for (const evt of events){
        if (evt.type !== 'tool_call' && evt.type !== 'tool_result') continue;
        const data = evt.data;
        const subagentId = data?.subagentId;
        if (!subagentId) continue;
        const existing = map.get(subagentId);
        if (!existing) continue;
        // 初始化 tools 数组
        if (!existing.tools) existing.tools = [];
        if (evt.type === 'tool_call') {
            const toolData = parseToolData(evt.data);
            const id = toolData.id ?? `tool-${evt.timestamp}`;
            const toolName = toolData.name ?? toolData.toolName ?? 'unknown';
            const args = toolData.args ?? toolData.arguments ?? {};
            const tool = {
                id,
                toolName,
                args,
                status: 'running',
                startedAt: evt.timestamp,
                iteration: toolData.iteration
            };
            toolMap.set(id, tool);
            existing.tools.push(tool);
        } else if (evt.type === 'tool_result') {
            const toolData = parseToolData(evt.data);
            const id = toolData.id ?? '';
            const tool = id ? toolMap.get(id) : undefined;
            if (tool) {
                tool.status = toolData.error ? 'error' : 'success';
                tool.result = toolData.result;
                tool.error = toolData.error;
                tool.endedAt = evt.timestamp;
                const startMs = Date.parse(tool.startedAt);
                const endMs = Date.parse(evt.timestamp);
                if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
                    tool.durationMs = Math.max(0, endMs - startMs);
                }
            }
        }
    }
    return Array.from(map.values());
}
/** 从 SSE 事件提取 TerminalTask(支持 terminal_start / terminal_end) */ function extractTerminalsFromEvents(events) {
    const map = new Map();
    for (const evt of events){
        if (evt.type === 'terminal_start') {
            const data = evt.data;
            const id = data?.id ?? `term-${evt.timestamp}`;
            map.set(id, {
                id,
                command: data?.command ?? '',
                status: 'running',
                startedAt: evt.timestamp
            });
        } else if (evt.type === 'terminal_end') {
            const data = evt.data;
            const id = data?.id ?? '';
            const existing = id ? map.get(id) : undefined;
            if (existing) {
                existing.status = data?.status ?? 'completed';
                existing.output = data?.output;
                existing.endedAt = evt.timestamp;
                const startMs = Date.parse(existing.startedAt);
                const endMs = Date.parse(evt.timestamp);
                if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
                    existing.durationMs = Math.max(0, endMs - startMs);
                }
                // Codex:提取退出码(若未提供,根据 status 推导:completed=0 / failed=1)
                if (data?.exitCode !== undefined) {
                    existing.exitCode = data.exitCode;
                } else if (existing.status === 'completed') {
                    existing.exitCode = 0;
                } else if (existing.status === 'failed') {
                    existing.exitCode = 1;
                }
            }
        }
    }
    return Array.from(map.values());
}
function useAgentProgress(threadId) {
    const effectiveThreadId = threadId ?? '';
    const stream = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$agent$2d$stream$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAgentStream"])({
        threadId: effectiveThreadId,
        onDone: ()=>{},
        onError: ()=>{},
        autoReconnect: true
    });
    const { events, isStreaming, currentNode, content, lastPlan, error, interruptEvent, reconnectAttempt } = stream;
    // 聚合 planSteps(Codex 三状态 + explanation + 最多一个 in_progress 硬规则)
    const planSteps = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>extractPlanFromEvents(events), [
        events
    ]);
    // 聚合 subagents(Codex 昵称 + @handle + dead agents 可见)
    const subagents = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>extractSubagentsFromEvents(events), [
        events
    ]);
    // 聚合 terminals
    const terminals = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>extractTerminalsFromEvents(events), [
        events
    ]);
    // 聚合 tools(保留原有,用于 changes 派生)
    const tools = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>{
        const map = new Map();
        for (const evt of events){
            if (evt.type === 'tool_call') {
                const data = parseToolData(evt.data);
                const id = data.id ?? `tool-${evt.timestamp}`;
                const toolName = data.name ?? data.toolName ?? 'unknown';
                const args = data.args ?? data.arguments ?? {};
                map.set(id, {
                    id,
                    toolName,
                    args,
                    status: 'running',
                    startedAt: evt.timestamp,
                    iteration: data.iteration
                });
            } else if (evt.type === 'tool_result') {
                const data = parseToolData(evt.data);
                const id = data.id ?? '';
                const existing = id ? map.get(id) : undefined;
                if (existing) {
                    existing.status = data.error ? 'error' : 'success';
                    existing.result = data.result;
                    existing.error = data.error;
                    existing.endedAt = evt.timestamp;
                    const startMs = Date.parse(existing.startedAt);
                    const endMs = Date.parse(evt.timestamp);
                    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
                        existing.durationMs = Math.max(0, endMs - startMs);
                    }
                }
            }
        }
        return Array.from(map.values());
    }, [
        events
    ]);
    // 聚合 changes
    const changes = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>{
        const result = [];
        for (const tool of tools){
            if (!CHANGE_TOOL_NAMES.has(tool.toolName)) continue;
            const diffInfo = deriveDiffInfoFromArgs(tool.toolName, tool.args);
            if (!diffInfo) continue;
            result.push({
                id: tool.id,
                filePath: diffInfo.file_path,
                toolName: tool.toolName,
                diffInfo,
                timestamp: tool.endedAt ?? tool.startedAt
            });
        }
        return result;
    }, [
        tools
    ]);
    // 聚合 overview:综合 stream 状态 + 计数
    const overview = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>{
        let status = 'idle';
        if (isStreaming) status = 'running';
        else if (error) status = 'failed';
        else if (interruptEvent) status = 'interrupted';
        else if (events.some((e)=>e.type === 'done')) status = 'completed';
        const sessionEvent = events.find((e)=>e.type === 'session');
        const completedSteps = planSteps.filter((s)=>s.status === 'completed').length;
        const inProgressSteps = planSteps.filter((s)=>s.status === 'in_progress').length;
        const pendingSteps = planSteps.filter((s)=>s.status === 'pending').length;
        const activeSubagents = subagents.filter((s)=>s.status === 'running' || s.status === 'spawned').length;
        const deadSubagents = subagents.filter((s)=>s.status === 'done' || s.status === 'failed' || s.status === 'dead').length;
        const runningTerminals = terminals.filter((t)=>t.status === 'running').length;
        // 历史耗时样本(已完成的 plan steps duration,用于 bracket 分位数)
        const historicalDurations = planSteps.filter((s)=>s.status === 'completed' && s.durationMs !== undefined).map((s)=>s.durationMs);
        return {
            status,
            currentNode,
            plan: lastPlan,
            content,
            error,
            interruptEvent,
            sessionStart: sessionEvent?.timestamp ?? null,
            totalSteps: planSteps.length,
            completedSteps,
            inProgressSteps,
            pendingSteps,
            totalSubagents: subagents.length,
            activeSubagents,
            deadSubagents,
            totalTerminals: terminals.length,
            runningTerminals,
            totalChanges: changes.length,
            historicalDurations,
            reconnectAttempt
        };
    }, [
        events,
        isStreaming,
        error,
        interruptEvent,
        currentNode,
        lastPlan,
        content,
        planSteps,
        subagents,
        terminals,
        changes,
        reconnectAttempt
    ]);
    return {
        overview,
        planSteps,
        subagents,
        terminals,
        tools,
        changes,
        events,
        isStreaming,
        start: stream.start,
        stop: stream.stop,
        clear: stream.clear
    };
}
}),
"[project]/apps/web/src/hooks/use-context-menu.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useContextMenu",
    ()=>useContextMenu
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useContextMenu({ buildItems } = {}) {
    const [visible, setVisible] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const [position, setPosition] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]({
        x: 0,
        y: 0
    });
    const [data, setData] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    const close = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        setVisible(false);
        setData(null);
    }, []);
    const items = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>{
        if (!data) return [];
        if (buildItems) return buildItems(data);
        return [];
    }, [
        data,
        buildItems
    ]);
    const onContextMenu = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((e)=>{
        e.preventDefault();
        setPosition({
            x: e.clientX,
            y: e.clientY
        });
        setVisible(true);
    }, []);
    return {
        visible,
        position,
        items,
        data,
        contextMenuHandlers: {
            onContextMenu
        },
        close,
        setData
    };
}
}),
"[project]/apps/web/src/hooks/use-context-mention.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGetSchema",
    ()=>useGetSchema,
    "useListTables",
    ()=>useListTables,
    "useSearchMentions",
    ()=>useSearchMentions,
    "useSearchSymbols",
    ()=>useSearchSymbols
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+react-query@5.101.2_react@19.0.0/node_modules/@tanstack/react-query/build/modern/useQuery.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
;
/** 构建 query string(跳过 undefined/null/空值) */ function buildQuery(params) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)){
        if (value !== undefined && value !== null && value !== '') {
            qs.append(key, String(value));
        }
    }
    const str = qs.toString();
    return str ? `?${str}` : '';
}
function useSearchMentions(query, type, workspacePath, enabled = true) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            'context-mentions',
            type,
            query,
            workspacePath ?? ''
        ],
        queryFn: async ()=>{
            const qs = buildQuery({
                q: query || undefined,
                type,
                workspacePath: workspacePath || undefined,
                limit: 20
            });
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(`/api/context/mentions${qs}`);
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        enabled,
        staleTime: 60_000,
        retry: false
    });
}
function useListTables(query, enabled = true) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            'context-tables',
            query
        ],
        queryFn: async ()=>{
            const qs = buildQuery({
                q: query || undefined,
                limit: 50
            });
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(`/api/context/database/tables${qs}`);
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        enabled,
        staleTime: 60_000,
        retry: false
    });
}
function useGetSchema(tableName, enabled = true) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            'context-schema',
            tableName
        ],
        queryFn: async ()=>{
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(`/api/context/database/schema/${encodeURIComponent(tableName)}`);
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        enabled: !!tableName && enabled,
        staleTime: 60_000,
        retry: false
    });
}
function useSearchSymbols(query, enabled = true) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            'context-symbols',
            query
        ],
        queryFn: async ()=>{
            const qs = buildQuery({
                q: query,
                limit: 20
            });
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(`/api/context/symbols${qs}`);
            if (!res.success) throw new Error(res.error);
            return res.data;
        },
        enabled: query.trim().length > 0 && enabled,
        staleTime: 60_000,
        retry: false
    });
}
}),
"[project]/apps/web/src/hooks/use-textarea-auto-height.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useTextareaAutoHeight",
    ()=>useTextareaAutoHeight
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
;
function useTextareaAutoHeight(value, options = {}) {
    const { threeLinePx = 60, maxHeightPx = 120 } = options;
    const ref = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    const resize = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        const el = ref.current;
        if (!el) return;
        if (!el.value) {
            el.style.height = '';
            el.style.overflowY = 'hidden';
            return;
        }
        el.style.height = 'auto';
        const sh = el.scrollHeight;
        if (sh < threeLinePx) {
            el.style.height = '';
            el.style.overflowY = 'hidden';
        } else if (sh <= maxHeightPx) {
            el.style.height = `${sh}px`;
            el.style.overflowY = 'hidden';
        } else {
            el.style.height = `${maxHeightPx}px`;
            el.style.overflowY = 'auto';
        }
    }, [
        threeLinePx,
        maxHeightPx
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        resize();
    }, [
        value,
        resize
    ]);
    return {
        ref,
        resize
    };
}
}),
"[project]/apps/web/src/hooks/use-permission-auto-revert.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "__AUTO_REVERT_STORAGE_KEY__",
    ()=>__AUTO_REVERT_STORAGE_KEY__,
    "formatRemaining",
    ()=>formatRemaining,
    "usePermissionAutoRevert",
    ()=>usePermissionAutoRevert
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/logger.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/ai-panel.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$permission$2d$mode$2d$popover$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/permission-mode-popover.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
/**
 * 高风险模式自动撤销倒计时(2026-07-25 深化,深度对标 Codex CLI 安全护栏)
 *
 * 为什么需要:
 * - 用户切到 bypass-permissions 后,5s 撤销 toast 只能覆盖"刚点错"的场景
 * - 真正风险是"忘了切回":跑了一会儿任务,发现高风险模式还开着
 * - 自动倒计时兜底:1 小时后无脑切回 default,即使忘记也不会持续高风险
 *
 * 数据流:
 * - 输入:当前 activeWorkspaceMode
 * - 输出:{ remainingMs, isActive, cancelRevert, extendRevert, startedAt }
 * - 副作用:倒计时归零 → 自动调 switchPermissionMode('default')
 *
 * 持久化:
 * - startedAt 写到 localStorage(ihui:auto-revert-bypass),跨刷新延续
 * - 用户主动 cancelRevert → 清除 localStorage(下次开启重新计时)
 * - 解除工作区绑定 / 切换工作区 → 清除(避免跨工作区污染)
 *
 * 2026-07-25 修复 2 个边缘场景:
 * 1) 跨工作区 record 污染:record 携带 workspacePath,切换工作区时校验并清掉
 * 2) 自动撤销归零 race condition:record 携带 monotonic version,自动切回前
 *    校验 ref 是否还是我们 watch 的那个(防止用户最后一刻手动切到 bypass)
 *
 * 时序细节:
 * - 用 Date.now() 算剩余,不用 setInterval 累积(setInterval 在标签页后台会被节流到 1 分钟,误差大)
 * - 用 1s 的 setInterval 仅触发 setState(强制重渲染剩余时间)
 * - 跨标签页同步:监听 'storage' 事件(用户在另一标签页点撤销时,本标签页也跟着清掉)
 */ const STORAGE_KEY = 'ihui:auto-revert-bypass';
const DEFAULT_DURATION_MS = 60 * 60 * 1000 // 1 小时
;
/** 模块级单调计数器(2026-07-25 修复 race condition):跨 hook 实例也单调递增 */ let globalRecordVersion = 0;
function readRecord() {
    if ("TURBOPACK compile-time truthy", 1) return null;
    //TURBOPACK unreachable
    ;
}
function writeRecord(record) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function usePermissionAutoRevert(durationMs = DEFAULT_DURATION_MS) {
    // 国际化文本(2026-07-25 深化):自动撤销触发的反馈 toast
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTranslations"])('chat.permission');
    const activeWorkspace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"])((s)=>s.activeWorkspace);
    const activeMode = activeWorkspace?.mode;
    // 初始读 localStorage(SSR 阶段跳过,客户端首次渲染再读)
    const [record, setRecord] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](null);
    // 客户端 mount 时强制读一次(2026-07-25 修复:useState lazy initializer 在 SSR 返回 null 后,
    // 客户端 hydration 不会重跑,导致 expired/刷新场景的 record 被 effect 1 覆盖)
    const [hydrated, setHydrated] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    // 2026-07-25 修复 race condition:缓存当前 watch 的 record 引用,
    // 自动切回 effect 用 ref === record 校验,防止用户最后一刻手动切到 bypass
    // 引起的 record 替换被误判为"刚启动的新 record"
    const watchedRecordRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (hydrated) return;
        const loaded = readRecord();
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:hydration] readRecord', {
            hasLoaded: !!loaded,
            version: loaded?.version,
            ws: loaded?.workspacePath,
            startedAt: loaded?.startedAt,
            startedAtAgo: loaded ? Date.now() - loaded.startedAt : null
        });
        setRecord(loaded);
        watchedRecordRef.current = loaded;
        setHydrated(true);
    }, [
        hydrated
    ]);
    // 强制 1s 重渲染,刷新倒计时显示
    const [tick, setTick] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](0);
    // 模式变化 / 工作区变化 → 同步 record(2026-07-25 修复跨工作区污染 + race condition)
    // - 切到 bypass-permissions:
    //   * 已有 record 且 workspacePath 匹配 + 未到期 → 保持(刷新场景)
    //   * 已有 record 但 workspacePath 不匹配 → 跨工作区,启动新 record
    //   * 已有 record + workspacePath 匹配 + 已到期 → 不启动新 record,让 auto-switch effect 处理
    //     (否则模式 effect 永久重启,auto-switch 永远等不到归零时刻)
    //   * 无 record → 启动新 record
    // - 切到 default / accept-edits → 清掉
    // 依赖:hydrated(防 hydration 前 effect 覆盖)+ activeWorkspace.path(防跨工作区污染)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!hydrated) return;
        const currentPath = activeWorkspace?.path ?? null;
        if (activeMode === 'bypass-permissions') {
            setRecord((prev)=>{
                if (prev && prev.workspacePath === currentPath) {
                    const elapsed = Date.now() - prev.startedAt;
                    if (elapsed < prev.durationMs) {
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:mode-effect] 保持同工作区未到期 record', {
                            prevVersion: prev.version,
                            currentPath
                        });
                        return prev;
                    }
                    // 2026-07-25 修复:同工作区已到期 → 不重启 record,
                    // 让归零 effect 走自动切回逻辑(否则模式 effect 永久覆盖归零时刻)
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:mode-effect] 保持同工作区已到期 record 让 auto-switch 处理', {
                        prevVersion: prev.version,
                        currentPath
                    });
                    return prev;
                }
                // 跨工作区 或 无 record → 启动新 record
                const next = {
                    startedAt: Date.now(),
                    durationMs,
                    workspacePath: currentPath ?? '',
                    version: ++globalRecordVersion
                };
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:mode-effect] 启动新 record', {
                    prev: prev ? {
                        version: prev.version,
                        ws: prev.workspacePath,
                        expired: Date.now() - prev.startedAt >= prev.durationMs
                    } : null,
                    nextVersion: next.version,
                    currentPath
                });
                writeRecord(next);
                watchedRecordRef.current = next;
                return next;
            });
        } else {
            setRecord((prev)=>{
                if (prev) writeRecord(null);
                watchedRecordRef.current = null;
                return null;
            });
        }
    }, [
        activeMode,
        activeWorkspace?.path,
        durationMs,
        hydrated
    ]);
    // 1s 触发 setState 强制重渲染剩余时间
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!record) return;
        const id = window.setInterval(()=>setTick((n)=>n + 1), 1000);
        return ()=>window.clearInterval(id);
    }, [
        record
    ]);
    // 跨标签页同步(2026-07-25 修复:从 storage 事件加载的 record 也需要同步到 watchedRecordRef,
    // 否则用户在另一标签页点击 cancel 后,本标签页自动切回 effect 看到的是过期的本地 ref)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const onStorage = undefined;
    }, []);
    // 计算剩余时间
    const remainingMs = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>{
        if (!record) return 0;
        const elapsed = Date.now() - record.startedAt;
        return Math.max(0, record.durationMs - elapsed);
    }, [
        record
    ]);
    // 快到期提醒(2026-07-25 深化,防"被切懵"):
    // - 剩 5 分钟:警告 toast,可一键续期 1h
    // - 剩 1 分钟:紧急 toast
    // 用 ref 去重,每个阈值只弹一次
    const warnedFiveMinRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](false);
    const warnedOneMinRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!record) {
            warnedFiveMinRef.current = false;
            warnedOneMinRef.current = false;
            return;
        }
        if (remainingMs > 5 * 60 * 1000) {
            warnedFiveMinRef.current = false;
            warnedOneMinRef.current = false;
            return;
        }
        if (remainingMs <= 5 * 60 * 1000 && remainingMs > 60 * 1000 && !warnedFiveMinRef.current) {
            warnedFiveMinRef.current = true;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"])(t('revertWarning5minTitle'), {
                description: t('revertWarning5minDesc'),
                duration: 10000,
                action: {
                    label: t('extendOneHour'),
                    onClick: ()=>extendRevert(DEFAULT_DURATION_MS)
                }
            });
        } else if (remainingMs <= 60 * 1000 && remainingMs > 0 && !warnedOneMinRef.current) {
            warnedOneMinRef.current = true;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"])(t('revertWarning1minTitle'), {
                description: t('revertWarning1minDesc'),
                duration: 8000,
                action: {
                    label: t('extendOneHour'),
                    onClick: ()=>extendRevert(DEFAULT_DURATION_MS)
                }
            });
        }
    // 2026-07-25 修复:依赖 tick 让 effect 在 1s 后重新检查 remainingMs(同归零 effect 原因)
    }, [
        remainingMs,
        record,
        t,
        tick
    ]);
    // 倒计时归零 → 自动切回 default
    // 2026-07-25 修复:本地优先,API 失败不阻断本地切换(兜底安全护栏必须保证最终生效)
    // 1. 先乐观更新 store + localStorage → 立即退出高风险
    // 2. 后台异步调 API 落库 + 失败重试 1 次
    // 2026-07-25 race condition 防御:自动切回前校验 watchedRecordRef === record,
    // 防止用户在最后一刻手动切到 bypass 时旧 expired record 残留触发自动切回
    const autoSwitchedRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!record) {
            autoSwitchedRef.current = false;
            watchedRecordRef.current = null;
            return;
        }
        if (remainingMs > 0) return;
        if (autoSwitchedRef.current) {
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:auto-switch] 跳过:已触发过', {
                autoSwitchedRef: autoSwitchedRef.current
            });
            return;
        }
        // 2026-07-25 race condition 防御:当前 record 不是我们 watch 的那个
        // (用户已重启 record / 切走模式 / 跨标签页 cancel),跳过自动切回
        if (watchedRecordRef.current !== record) {
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:auto-switch] 跳过:watchedRecordRef !== record', {
                watched: watchedRecordRef.current?.version,
                record: record.version
            });
            return;
        }
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:auto-switch] 通过所有检查,准备切回');
        // 当前模式已被切走 → 清 record 退出
        const current = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.mode;
        if (current !== 'bypass-permissions') {
            setRecord(null);
            writeRecord(null);
            watchedRecordRef.current = null;
            return;
        }
        autoSwitchedRef.current = true;
        // 计算本次完全访问累计时长(2026-07-25 深化):让用户知道"我开了多久"
        const usedMs = record ? Math.min(Date.now() - record.startedAt, record.durationMs) : 0;
        const usedMin = Math.round(usedMs / 60000);
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:auto-switch] 触发自动切回', {
            usedMin,
            currentMode: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.mode
        });
        // 立即本地切回(安全护栏兜底,不能被 API 失败阻断)
        const store = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState();
        if (store.activeWorkspace) {
            store.setActiveWorkspace({
                ...store.activeWorkspace,
                mode: 'default'
            });
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:auto-switch] 已设 store mode=default', {
                newMode: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace?.mode
            });
        } else {
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].info('[auto-revert:auto-switch] store.activeWorkspace 为空,无法切回');
        }
        setRecord(null);
        writeRecord(null);
        watchedRecordRef.current = null;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"])(t('autoRevertedTitle'), {
            description: t('autoRevertedDescWithDuration', {
                usedMin
            }),
            duration: 6000
        });
        // 自动切回 → 把刚被 message-input useEffect 占位为 'popover' 的最新一条记录
        // source 改为 'auto-revert'(2026-07-25 深化,来源精细化)
        // useEffect 回调不是 async,用 IIFE 包 await
        void (async ()=>{
            try {
                const { updateLatestRecordSource } = await __turbopack_context__.A("[project]/apps/web/src/lib/permission-mode-history.ts [app-ssr] (ecmascript, async loader)");
                updateLatestRecordSource('auto-revert', (e)=>e.mode === 'default');
            } catch  {
            // 静默
            }
        })();
        // 后台异步落库 + 失败重试
        void (async ()=>{
            for(let attempt = 0; attempt < 2; attempt++){
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$permission$2d$mode$2d$popover$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["switchPermissionMode"])('default');
                if (result.ok) return;
                // 短暂等待再重试
                await new Promise((r)=>setTimeout(r, 1500));
            }
            // 2 次都失败:记录到 console(不阻塞 UI,本地已切回)
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logger"].warn('[usePermissionAutoRevert] 自动切回 default 后落库失败,已本地切回');
        })();
    }, [
        remainingMs,
        record,
        t
    ]);
    /** 用户主动取消自动撤销(不清工作区模式,只取消计时) */ const cancelRevert = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        setRecord(null);
        writeRecord(null);
        watchedRecordRef.current = null;
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success(t('cancelAutoRevert') + ' ✓', {
            description: '当前保持完全访问,关闭标签页/刷新后也不会自动降级',
            duration: 3000
        });
    }, [
        t
    ]);
    /** 延长计时(从 now 重置 durationMs) */ const extendRevert = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((extraMs = durationMs)=>{
        const currentPath = activeWorkspace?.path ?? '';
        const next = {
            startedAt: Date.now(),
            durationMs: extraMs,
            workspacePath: currentPath,
            version: ++globalRecordVersion
        };
        watchedRecordRef.current = next;
        setRecord(next);
        writeRecord(next);
    }, [
        durationMs,
        activeWorkspace?.path
    ]);
    // 全局句柄(2026-07-25 深化):toast callback 在 React 组件作用域外触发不了 hook,
    // 把 extendRevert 挂到 window 上,供任何 toast action.onClick 安全调用
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const w = undefined;
    }, [
        extendRevert
    ]);
    return {
        /** 是否处于高风险 + 倒计时激活态 */ isActive: !!record && remainingMs > 0,
        /** 剩余 ms(0 表示已到期) */ remainingMs,
        /** 切到 bypass 的时间戳(显示"X 分钟前切到"用) */ startedAt: record?.startedAt ?? null,
        cancelRevert,
        extendRevert
    };
}
function formatRemaining(ms) {
    if (ms <= 0) return '00:00';
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor(totalSec % 3600 / 60);
    const s = totalSec % 60;
    const pad = (n)=>String(n).padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}
const __AUTO_REVERT_STORAGE_KEY__ = STORAGE_KEY;
}),
"[project]/apps/web/src/hooks/use-slash-commands.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSlashCommands",
    ()=>useSlashCommands
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-ssr] (ecmascript) <export default as BookOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-ssr] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$hammer$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Hammer$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/hammer.js [app-ssr] (ecmascript) <export default as Hammer>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$repeat$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Repeat$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/repeat.js [app-ssr] (ecmascript) <export default as Repeat>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-ssr] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-ssr] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-alert.js [app-ssr] (ecmascript) <export default as ShieldAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-check.js [app-ssr] (ecmascript) <export default as ShieldCheck>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-ssr] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/target.js [app-ssr] (ecmascript) <export default as Target>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$command$2d$arg$2d$templates$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/chat/command-arg-templates.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$slash$2d$command$2d$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/chat/slash-command-data.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
/** 斜杠命令 i18n key 映射(2026-07-29 提取自 message-input.tsx)
 * key 为 SLASH_COMMAND_IDS 中的命令 id,value 为 chat namespace 下的 i18n key
 * 未命中时回退到 id 本身(原组件行为保持一致) */ const SLASH_CMD_KEY_MAP = {
    summary: 'slashCmd.summary',
    translate: 'slashCmd.translate',
    explain: 'slashCmd.explain',
    code: 'slashCmd.code',
    polish: 'slashCmd.polish',
    'wechat-article': 'slashCmd.wechat-article',
    'koubo-script': 'slashCmd.koubo-script'
};
function useSlashCommands(aiSkills, skillsLoading) {
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTranslations"])('chat');
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>[
            // 🎯 目标与循环(2026-07-29 立,置顶重点:AI 编程最主流的命令)
            // 2026-07-29 二次深化:加 argsSuggestions,点击后进入参数补全模式
            // /goal <目标条件>:设定当前会话目标,AI 围绕目标执行(对标 AGENTS.md §8 goal 模式工作流)
            // /loop on|off|N:设置循环执行模式(对标 ai-service slash_commands.py _loop_handler)
            {
                id: 'goal',
                label: '/goal',
                description: t('slashCmd.goal'),
                usage: '/goal <目标>',
                kind: 'template',
                category: 'goal',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__["Target"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 79,
                    columnNumber: 15
                }, this),
                hasArgs: true,
                argsTitle: t('slashCmd.goalArgTitle'),
                argsSuggestions: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$command$2d$arg$2d$templates$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GOAL_ARG_TEMPLATES"]
            },
            {
                id: 'loop',
                label: '/loop',
                description: t('slashCmd.loop'),
                usage: '/loop on|off|N',
                kind: 'template',
                category: 'goal',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$repeat$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Repeat$3e$__["Repeat"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 91,
                    columnNumber: 15
                }, this),
                hasArgs: true,
                argsTitle: t('slashCmd.loopArgTitle'),
                argsSuggestions: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$command$2d$arg$2d$templates$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LOOP_ARG_OPTIONS"]
            },
            // ⚡ 模式切换(2026-07-25 立,对标 Trae SOLO Plan 模式):切换 plan/act 模式
            {
                id: 'plan',
                label: '/plan',
                description: t('slashCmd.plan'),
                kind: 'action',
                category: 'mode',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 103,
                    columnNumber: 15
                }, this)
            },
            {
                id: 'act',
                label: '/act',
                description: t('slashCmd.act'),
                kind: 'action',
                category: 'mode',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$hammer$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Hammer$3e$__["Hammer"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 111,
                    columnNumber: 15
                }, this)
            },
            // 对话模式动作型命令(2026-07-28 立,补全 ChatMode 4态三通道):
            // /build /review /spec 切换 ChatMode,/plan /act 同时联动 ChatMode 和 Plan/Act
            {
                id: 'build',
                label: '/build',
                description: t('slashCmd.build'),
                kind: 'action',
                category: 'mode',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$hammer$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Hammer$3e$__["Hammer"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 121,
                    columnNumber: 15
                }, this)
            },
            {
                id: 'review',
                label: '/review',
                description: t('slashCmd.review'),
                kind: 'action',
                category: 'mode',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 129,
                    columnNumber: 15
                }, this)
            },
            {
                id: 'spec',
                label: '/spec',
                description: t('slashCmd.spec'),
                kind: 'action',
                category: 'mode',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 137,
                    columnNumber: 15
                }, this)
            },
            // 🔐 权限管理(2026-07-25 深化,深度对标 Codex approvalMode CLI):
            // /permission ask|auto|full 切换工作区权限模式(不进入 LLM 流,纯本地 UI 状态)
            // description 用 \n 拼接短描述 + 用法提示(2026-07-25 深化,提示用户支持的 3 个子命令)
            {
                id: 'permission-ask',
                label: '/permission ask',
                description: `${t('slashCmd.permissionAsk')}\n${t('permission.usageHint')}`,
                kind: 'action',
                category: 'permission',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 148,
                    columnNumber: 15
                }, this)
            },
            {
                id: 'permission-auto',
                label: '/permission auto',
                description: `${t('slashCmd.permissionAuto')}\n${t('permission.usageHint')}`,
                kind: 'action',
                category: 'permission',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__["ShieldCheck"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 156,
                    columnNumber: 15
                }, this)
            },
            {
                id: 'permission-full',
                label: '/permission full',
                description: `${t('slashCmd.permissionFull')}\n${t('permission.usageHint')}`,
                kind: 'action',
                category: 'permission',
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__["ShieldAlert"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                    lineNumber: 164,
                    columnNumber: 15
                }, this)
            },
            // ✨ AI 技能(2026-07-29 二次深化,从 /api/ai-skills 异步拉取,接入斜杠命令弹窗)
            // 每个 skill 一项,点击后填充 /skill <name> 到 textarea,后端 _skill_handler 处理
            // loading 状态:skillsLoading=true 时所有 skill 项标记 loading,弹窗分组标题显示 spinner
            ...aiSkills.map((skill)=>({
                    id: `skill-${skill.id}`,
                    label: `/skill ${skill.name}`,
                    description: skill.description,
                    usage: `/skill ${skill.name}`,
                    kind: 'template',
                    category: 'skill',
                    icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                        lineNumber: 176,
                        columnNumber: 15
                    }, this),
                    hasArgs: false,
                    loading: skillsLoading
                })),
            // 📝 内容模板:选命令后填充模板到 textarea
            ...__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$slash$2d$command$2d$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SLASH_COMMAND_IDS"].map((id)=>({
                    id,
                    label: `/${id}`,
                    description: t(SLASH_CMD_KEY_MAP[id] ?? id),
                    kind: 'template',
                    category: 'template',
                    icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/hooks/use-slash-commands.tsx",
                        lineNumber: 187,
                        columnNumber: 15
                    }, this)
                }))
        ], [
        t,
        aiSkills,
        skillsLoading
    ]);
}
}),
"[project]/apps/web/src/hooks/use-permission-mode-cycle.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "usePermissionModeCycle",
    ()=>usePermissionModeCycle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$permission$2d$mode$2d$popover$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/permission-mode-popover.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$full$2d$access$2d$confirm$2d$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/full-access-confirm-dialog.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$permission$2d$mode$2d$history$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/permission-mode-history.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/ai-panel.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
;
/** 模式循环顺序(2026-07-25 深化,深度对标 Codex CLI Shift+Tab 循环切换)
 * default(请求批准) → accept-edits(替我审批) → bypass-permissions(完全访问) → default
 * 注意:bypass-permissions 是高风险,放在最后便于"按 3 次回正" */ const PERMISSION_CYCLE = [
    'default',
    'accept-edits',
    'bypass-permissions'
];
/** localStorage 键(2026-07-25 深化,跨刷新记忆用户上次主动选择的权限模式)
 * 仅记忆非默认模式;首次绑定工作区时如果 store 没指定,优先用这个值 */ const PERMISSION_MEMORY_KEY = 'ihui:preferred-permission-mode';
function usePermissionModeCycle() {
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTranslations"])('chat.permission');
    // 当前工作区权限模式 + 切换 store
    const activeWorkspace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"])((s)=>s.activeWorkspace);
    const setActiveWorkspace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"])((s)=>s.setActiveWorkspace);
    const setPendingFullAccess = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAiPanelStore"])((s)=>s.setPendingFullAccess);
    const activeWorkspaceMode = activeWorkspace?.mode;
    // 权限模式可发现性增强(2026-07-25 深化,深度对标 Codex CLI /help):
    // - shortcutsOpen: ? 键唤起/关闭 PermissionShortcutsModal
    const [shortcutsOpen, setShortcutsOpen] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    // 全局 ? 键监听(2026-07-25 深化,Codex CLI 风格):
    // - Shift+/ 也算,避免不同键盘布局下 ? 在不同位置
    // - 排除 textarea/input/contenteditable 内,用户打字时不应该误触
    // - 再按一次关闭(toggle),与常见 ? 文档快捷键行为一致
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const onKey = undefined;
    }, []);
    // 权限模式快捷切换(2026-07-25 深化,深度对标 Codex CLI Shift+Tab 循环):
    // - 模式改变时同步到 localStorage(只记忆非默认,避免污染用户)
    // - Shift+Tab 在 3 个模式间循环切,跳过斜杠面板/提及面板打开时
    // - 切到 bypass-permissions 复用 PermissionModePopover 同一撤销 toast
    // 监听 mode 变化 → localStorage
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
    }, [
        activeWorkspaceMode
    ]);
    // 权限模式切换历史记录(2026-07-25 立,深度对标 Codex CLI 审计能力):
    // - activeWorkspaceMode 变化时追加 1 条记录到 localStorage
    // - source 暂用 'popover' 作为默认,具体来源由调用方通过 __IHUI_RECORD_MODE_CHANGE__ 句柄覆盖
    // - 不在 hook 内做来源判断(避免 popover/Shift+Tab/slash 三处分别改 1 个 if)
    // - 主动撤销 1h 计时器归零 → auto-revert 来源,由 use-permission-auto-revert 内 hook 句柄写入
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!activeWorkspaceMode) return;
        // 首次 mount 时不记录(用户可能刚打开页面看到默认 default,记录无意义)
        // 只在 mode 真正变化时记录 —— 通过 ref 缓存上次值判断
        const w = window;
        const last = w.__IHUI_LAST_RECORDED_MODE__;
        if (last === activeWorkspaceMode) return;
        w.__IHUI_LAST_RECORDED_MODE__ = activeWorkspaceMode;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$permission$2d$mode$2d$history$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["recordModeChange"])({
            mode: activeWorkspaceMode,
            workspacePath: activeWorkspace?.path ?? '',
            timestamp: Date.now(),
            // 默认识别为 popover 来源;popover/shift-tab/slash 各自的代码路径在切完模式后会
            // 通过 __IHUI_RECORD_MODE_CHANGE__ 句柄覆盖最近一条的 source(见下)
            source: 'popover'
        });
    }, [
        activeWorkspaceMode,
        activeWorkspace?.path
    ]);
    // 切到下一个模式(Shift+Tab 循环)
    const cyclePermissionMode = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        const current = activeWorkspaceMode ?? 'default';
        const idx = PERMISSION_CYCLE.indexOf(current);
        const next = PERMISSION_CYCLE[(idx + 1) % PERMISSION_CYCLE.length] ?? 'default';
        if (next === current) return;
        // 切到 bypass-permissions + 首次启用 + 未静默 → 弹确认弹窗(2026-07-25 深化)
        // 与 popover 走同一条 FullAccessConfirmDialog(共享 store.pendingFullAccess)
        if (next === 'bypass-permissions' && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$full$2d$access$2d$confirm$2d$dialog$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isFullAccessConfirmSuppressed"])()) {
            setPendingFullAccess(true);
            return;
        }
        const previousMode = current;
        // 乐观更新 store
        if (activeWorkspace) {
            setActiveWorkspace({
                ...activeWorkspace,
                mode: next
            });
        }
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$permission$2d$mode$2d$popover$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["switchPermissionMode"])(next);
        if (!result.ok) {
            // 回滚
            if (activeWorkspace && previousMode) {
                setActiveWorkspace({
                    ...activeWorkspace,
                    mode: previousMode
                });
            }
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].error(t('cycleError', {
                error: result.error ?? '未知错误'
            }));
            return;
        }
        // 切完模式 → 把刚被 useEffect 占位为 'popover' 的最新一条记录 source 改为 'shift-tab'
        // 避免在 useEffect 内的 source 写死 'popover' 让历史面板误把 Shift+Tab 记成 popover
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$permission$2d$mode$2d$history$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["updateLatestRecordSource"])('shift-tab', (e)=>e.mode === next);
        // 切到完全访问 → 5s 撤销 toast(与 popover 一致体验)
        if (next === 'bypass-permissions') {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"])(t('switchedToFull'), {
                description: t('switchedToFullDesc', {
                    prev: previousMode
                }),
                duration: 5000,
                action: {
                    label: t('undo'),
                    onClick: ()=>void cyclePermissionMode()
                }
            });
        } else {
            // default / accept-edits → 短提示
            const labelKey = next === 'default' ? 'mode.ask' : 'mode.auto';
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success(t('cycledTo', {
                mode: t(labelKey)
            }), {
                duration: 2000
            });
        }
    }, [
        activeWorkspace,
        activeWorkspaceMode,
        setActiveWorkspace,
        setPendingFullAccess,
        t
    ]);
    const openShortcuts = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>setShortcutsOpen(true), []);
    const closeShortcuts = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>setShortcutsOpen(false), []);
    return {
        shortcutsOpen,
        openShortcuts,
        closeShortcuts,
        cyclePermissionMode
    };
}
}),
"[project]/apps/web/src/hooks/use-slash-action.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSlashAction",
    ()=>useSlashAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$prompt$2d$template$2d$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/chat/prompt-template-data.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
// i18n key 映射表(扁平结构,与 message-list 空状态共用同一组 key)
const TPL_NAME_KEY_MAP = {
    summary: 'tplSummary',
    translate: 'tplTranslate',
    explain: 'tplExplain',
    code: 'tplCode',
    polish: 'tplPolish'
};
const TPL_CONTENT_KEY_MAP = {
    summary: 'tplSummaryContent',
    translate: 'tplTranslateContent',
    explain: 'tplExplainContent',
    code: 'tplCodeContent',
    polish: 'tplPolishContent'
};
/** /permission 切换 toast 首弹记录(2026-07-25 深化,从 message-input.tsx 迁移):
 * 每个子命令模式只 toast 一次,持久化到 localStorage(跨刷新/跨标签页也只弹一次)。
 * 用 set 序列化存,key 形如 "ask,auto,full" 表示已提示过的模式集合。 */ const PERMISSION_TOAST_KEY = 'ihui:permission-toast-shown';
function useSlashAction(setInputValue, // FIXME(any): aiSkills 留作未来 skill 描述/分类查询扩展,先用 void 消费以满足 TS6133
// eslint-disable-next-line @typescript-eslint/no-unused-vars
aiSkills, inputCoreRef, onSend) {
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTranslations"])('chat');
    // FIXME(any): 临时消费 aiSkills 以满足 TS6133,见函数签名注释
    void aiSkills;
    // /permission 切换 toast 首弹记录(2026-07-25 深化):每个子命令模式只 toast 一次,
    // 持久化到 localStorage(跨刷新/跨标签页也只弹一次)。
    // React.useRef 不支持 lazy initializer(那是 useState 才有的),改用空 set + useEffect mount 填充
    const permissionToastShownRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](new Set());
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
    }, []);
    const markPermissionToastShown = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((mode)=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
    }, []);
    // 斜杠命令填充文本映射(2026-07-29 提取自 message-input.tsx)
    // - /goal /loop 命令:填充命令到 textarea 让用户继续输入参数
    //   点击后 textarea 内容为 "/goal " 或 "/loop ",光标在末尾,用户输入参数后 Enter 发送
    //   后端 ai-service slash_commands.py 的 _goal_handler / _loop_handler 负责实际处理
    // - 其他模板命令:填充完整提示词文本,用户可直接 Enter 发送
    const commandTemplates = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>({
            goal: '/goal ',
            loop: '/loop ',
            summary: t('cmdSummary'),
            translate: t('cmdTranslate'),
            explain: t('cmdExplain'),
            code: t('cmdCode'),
            polish: t('cmdPolish'),
            'wechat-article': t('cmdWechatArticle'),
            'koubo-script': t('cmdKouboScript')
        }), [
        t
    ]);
    // i18n key 为扁平结构(tplSummary / tplSummaryContent),与 message-list 空状态共用同一组 key,
    // 保证附加栏弹窗与空状态 chips 显示的模板内容完全一致。
    const promptTemplates = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"](()=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$prompt$2d$template$2d$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PROMPT_TEMPLATE_IDS"].map((id)=>({
                id,
                name: t(TPL_NAME_KEY_MAP[id] ?? id),
                content: t(TPL_CONTENT_KEY_MAP[id] ?? id)
            })), [
        t
    ]);
    /** 填充文本到 textarea 并聚焦(2026-07-29 提取自 message-input.tsx)
   * - setInputValue 写入内容
   * - requestAnimationFrame 等待 React 提交 DOM 后再 focus + setSelectionRange + resize
   *   确保光标定位在文本末尾,textarea 高度自适应 */ const fillInput = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((text)=>{
        setInputValue(text);
        requestAnimationFrame(()=>{
            inputCoreRef.current?.focus();
            inputCoreRef.current?.setSelectionRange(text.length, text.length);
            inputCoreRef.current?.resize();
        });
    }, [
        setInputValue,
        inputCoreRef
    ]);
    /** 斜杠命令选中回调(2026-07-29 提取自 message-input.tsx)
   * 动作型命令(plan/act/build/review/spec/permission-*):直接走 onSend 流程,
   * 由 use-chat.ts 的 tryHandlePlanModeSlash / tryHandleChatModeSlash / tryHandlePermissionSlash 拦截。
   * 不填充 textarea,避免用户看到 "/plan" 文字再手动按发送(多余操作)。 */ const handleCommandSelect = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((id)=>{
        // 动作型命令(2026-07-25 立):直接走 onSend 流程
        if (id === 'plan' || id === 'act' || // ChatMode 4态动作型命令(2026-07-28 立,补全三通道):
        // /build /review /spec 走 onSend,由 use-chat.ts 的 tryHandleChatModeSlash 拦截
        id === 'build' || id === 'review' || id === 'spec' || // 权限模式动作型命令(2026-07-25 深化):/permission ask|auto|full 走 onSend
        // 由 use-chat.ts 的 tryHandlePermissionSlash 拦截(纯本地 UI 状态切换,无 LLM)
        id === 'permission-ask' || id === 'permission-auto' || id === 'permission-full') {
            // /permission 切换 toast(2026-07-25 深化):仅每个模式首次弹一次,
            // 提醒用户已切换并显示完整模式名,避免反复刷屏。用 useRef 跨渲染持久,
            // 用户后续再用同一子命令不再弹(避免噪音)。
            if (id.startsWith('permission-')) {
                const mode = id.replace('permission-', '');
                if (!permissionToastShownRef.current.has(mode)) {
                    permissionToastShownRef.current.add(mode);
                    // 持久化到 localStorage(2026-07-25 二次深化):跨刷新/跨标签页也只弹一次
                    markPermissionToastShown(mode);
                    const key = mode === 'ask' ? 'permission.switchedToModeAsk' : mode === 'auto' ? 'permission.switchedToModeAuto' : 'permission.switchedToModeFull';
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].success(t(key), {
                        duration: 2500
                    });
                }
            }
            // 清空当前 textarea 内容再发送,避免与已有内容拼接
            setInputValue('');
            requestAnimationFrame(()=>inputCoreRef.current?.resize());
            void onSend(`/${id.replace('-', ' ')}`);
            return;
        }
        // skill 命令(2026-07-29 二次深化):id 形如 "skill-<skillId>",
        // 填充 "/skill <skillName> " 到 textarea 让用户确认或追加参数
        if (id.startsWith('skill-')) {
            const skillName = id.slice('skill-'.length);
            fillInput(`/skill ${skillName} `);
            return;
        }
        fillInput(commandTemplates[id] ?? '');
    }, // aiSkills 列入依赖数组(2026-07-29 预留):当前 handleCommandSelect 通过 id 前缀识别 skill 命令,
    // skillName 从 id 切片获取;未来若需要根据 aiSkills 查找 skill 描述/分类等元数据,
    // 依赖数组已就位,无需再改 hook 签名
    [
        t,
        fillInput,
        setInputValue,
        onSend,
        inputCoreRef,
        commandTemplates,
        markPermissionToastShown,
        aiSkills
    ]);
    /** 参数补全模式选择回调(2026-07-29 二次深化)
   * 用户在参数补全模式下选中候选项时触发,直接填充 insertText 到 textarea
   * 不自动发送,让用户确认后按 Enter 发送(避免误触)
   * commandId 参数保留以匹配 SlashCommandPalette onSelectArgs 签名,当前实现不使用 */ const handleCommandArgsSelect = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((_commandId, insertText)=>{
        fillInput(insertText);
    }, [
        fillInput
    ]);
    return {
        promptTemplates,
        handleCommandSelect,
        handleCommandArgsSelect
    };
}
}),
"[project]/apps/web/src/hooks/use-message-references.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useMessageReferences",
    ()=>useMessageReferences
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/format.ts [app-ssr] (ecmascript)");
'use client';
;
;
const MAX_LABEL_LENGTH = 30;
const generateId = ()=>`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function useMessageReferences() {
    const [references, setReferences] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]([]);
    const addFileReference = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((file)=>{
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) return;
        const objectUrl = URL.createObjectURL(file);
        const ref = {
            id: generateId(),
            type: isImage ? 'image' : 'video',
            label: file.name,
            preview: `${file.name} · ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatFileSize"])(file.size)}`,
            thumbnail: objectUrl,
            size: file.size
        };
        setReferences((prev)=>[
                ...prev,
                ref
            ]);
    }, []);
    const addTextReference = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((text)=>{
        const trimmed = text.trim();
        if (!trimmed) return;
        const ref = {
            id: generateId(),
            type: 'text',
            label: trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}...` : trimmed,
            preview: trimmed
        };
        setReferences((prev)=>[
                ...prev,
                ref
            ]);
    }, []);
    const addCodeReference = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((code, language)=>{
        const trimmed = code.trim();
        if (!trimmed) return;
        const summary = trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}...` : trimmed;
        const ref = {
            id: generateId(),
            type: 'text',
            label: language ? `${language} · ${summary}` : summary,
            preview: trimmed
        };
        setReferences((prev)=>[
                ...prev,
                ref
            ]);
    }, []);
    const removeReference = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((id)=>{
        setReferences((prev)=>{
            const removed = prev.find((r)=>r.id === id);
            if (removed?.thumbnail) URL.revokeObjectURL(removed.thumbnail);
            return prev.filter((r)=>r.id !== id);
        });
    }, []);
    const resetReferences = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        setReferences([]);
    }, []);
    return {
        references,
        addFileReference,
        addTextReference,
        addCodeReference,
        removeReference,
        resetReferences
    };
}
}),
"[project]/apps/web/src/hooks/use-message-send.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useMessageSend",
    ()=>useMessageSend
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$dangerous$2d$command$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/dangerous-command-detector.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$dangerous$2d$command$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/dangerous-command-detector.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
/**
 * i18n 静态映射表 — 用于消除 `t(`permission.dangerousPattern.${pattern}`)` 单变量动态拼接。
 * key 集合与 apps/web/src/lib/dangerous-command-detector.ts 的 DANGEROUS_PATTERNS[].id 一一对应;
 * 若 detector 新增 pattern 而本表漏改,运行时回退到 'permission.dangerousPattern.unknown'。
 */ const DANGEROUS_PATTERN_KEY = {
    rmRrfRoot: 'permission.dangerousPattern.rmRrfRoot',
    ddToDisk: 'permission.dangerousPattern.ddToDisk',
    mkfsDisk: 'permission.dangerousPattern.mkfsDisk',
    redirectToDevice: 'permission.dangerousPattern.redirectToDevice',
    chmodRoot: 'permission.dangerousPattern.chmodRoot',
    sudoAny: 'permission.dangerousPattern.sudoAny',
    curlPipeSh: 'permission.dangerousPattern.curlPipeSh',
    forkBomb: 'permission.dangerousPattern.forkBomb',
    mvRootToNull: 'permission.dangerousPattern.mvRootToNull',
    rmEnv: 'permission.dangerousPattern.rmEnv',
    rmGit: 'permission.dangerousPattern.rmGit',
    forcePushMain: 'permission.dangerousPattern.forcePushMain'
};
function useMessageSend(params) {
    const { value, setValue, isStreaming, isHighRisk, references, resetReferences, addFileReference, onSend, inputCoreRef, draftKey } = params;
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTranslations"])('chat');
    const [isDragOver, setIsDragOver] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const handleFileInputChange = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((e)=>{
        const files = Array.from(e.target.files ?? []);
        files.forEach(addFileReference);
        // 重置 value,允许重复选择同一文件
        e.target.value = '';
    }, [
        addFileReference
    ]);
    const handleDragOver = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((e)=>{
        if (isStreaming) return;
        // 仅在拖入文件时阻止默认行为(否则浏览器会打开文件)
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!isDragOver) setIsDragOver(true);
        }
    }, [
        isStreaming,
        isDragOver
    ]);
    const handleDragLeave = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((e)=>{
        // 仅当离开外层容器时才清除高亮(避免子元素 dragenter/dragleave 抖动)
        if (e.currentTarget === e.target) {
            setIsDragOver(false);
        }
    }, []);
    const handleDrop = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((e)=>{
        if (isStreaming) return;
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        setIsDragOver(false);
        Array.from(e.dataTransfer.files).forEach(addFileReference);
        requestAnimationFrame(()=>inputCoreRef.current?.focus());
    }, [
        isStreaming,
        addFileReference,
        inputCoreRef
    ]);
    const handlePaste = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((e)=>{
        if (isStreaming) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        const imageItems = Array.from(items).filter((item)=>item.kind === 'file' && item.type.startsWith('image/'));
        if (imageItems.length === 0) return;
        e.preventDefault();
        imageItems.forEach((item)=>{
            const file = item.getAsFile();
            if (file) {
                // 粘贴的图片无文件名,用时间戳生成
                const renamed = new File([
                    file
                ], `pasted-${Date.now()}.png`, {
                    type: file.type
                });
                addFileReference(renamed);
            }
        });
    }, [
        isStreaming,
        addFileReference
    ]);
    /** 实际发送逻辑(2026-07-25 立,危险命令检测拆分):供 submit / toast action 复用 */ const doSend = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (text, refs)=>{
        // 附件作为引用文本随消息发送:图片用 markdown image 语法,视频/其他文件用引用块
        const attachmentMarkdown = refs.map((r)=>{
            if (r.type === 'image' && r.thumbnail) {
                return `![${r.label}](${r.thumbnail})`;
            }
            if (r.type === 'video' && r.thumbnail) {
                return `<video src="${r.thumbnail}" controls></video>`;
            }
            return `> 📎 ${r.label}`;
        }).join('\n');
        const finalContent = attachmentMarkdown ? `${text}\n\n${attachmentMarkdown}` : text;
        // onSend 返回 false 表示未发送(如未登录/创建会话失败),保留输入内容不清空
        const ok = await onSend(finalContent);
        if (!ok) return;
        // 释放所有 objectURL
        refs.forEach((r)=>{
            if (r.thumbnail) URL.revokeObjectURL(r.thumbnail);
        });
        setValue('');
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        resetReferences();
        requestAnimationFrame(()=>inputCoreRef.current?.resize());
    }, [
        onSend,
        setValue,
        draftKey,
        resetReferences,
        inputCoreRef
    ]);
    const submit = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async ()=>{
        const text = value.trim();
        if (!text || isStreaming) return;
        // 危险命令检测(2026-07-25 立,深度对标 OpenAI Codex CLI safety guard):
        // - 仅在高风险模式(bypass-permissions)下拦截,其他模式不阻断(用户已选择低风险)
        // - critical/high → 弹确认 toast(带「仍要发送」action),用户点 action 才真发
        // - medium → 普通 toast 警告(不阻断,只提醒)
        if (isHighRisk) {
            const detection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$dangerous$2d$command$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["detectDangerousCommands"])(text);
            if (detection.hasDangerous) {
                // 找出最严重的 critical/high 命中的 pattern + reason 展示
                const top = detection.matches.find((m)=>m.severity === 'critical' || m.severity === 'high');
                if (top) {
                    const patternLabel = t(DANGEROUS_PATTERN_KEY[top.pattern] ?? 'permission.dangerousPattern.unknown');
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"])(t('permission.dangerousCommandTitle'), {
                        description: t('permission.dangerousCommandDesc', {
                            pattern: patternLabel,
                            reason: top.reason
                        }),
                        duration: 10_000,
                        action: {
                            label: t('permission.dangerousCommandProceed'),
                            onClick: ()=>{
                                void doSend(text, references);
                            }
                        },
                        cancel: {
                            label: t('permission.dangerousCommandCancel'),
                            onClick: ()=>{
                            // 仅关闭 toast,保留输入内容
                            }
                        }
                    });
                    return;
                }
            }
            // 仅 medium → 警告但不阻断
            if (detection.matches.length > 0) {
                const medium = detection.matches[0];
                const patternLabel = t(DANGEROUS_PATTERN_KEY[medium.pattern] ?? 'permission.dangerousPattern.unknown');
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toast"].warning(t('permission.dangerousCommandWarningOnly', {
                    pattern: patternLabel
                }), {
                    duration: 5_000
                });
            }
        }
        await doSend(text, references);
    }, [
        value,
        isStreaming,
        isHighRisk,
        t,
        doSend,
        references
    ]);
    return {
        isDragOver,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handlePaste,
        handleFileInputChange,
        submit
    };
}
}),
"[project]/apps/web/src/hooks/use-lazy-resource-hooks.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mimeToLabel",
    ()=>mimeToLabel,
    "useAiSkills",
    ()=>useAiSkills,
    "useMentionFiles",
    ()=>useMentionFiles
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/format.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$ai$2d$skills$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/ai-skills.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/workspace.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function mimeToLabel(mimeType) {
    if (!mimeType) return 'FILE';
    const sep = mimeType.indexOf('/');
    if (sep < 0) return mimeType.toUpperCase();
    return mimeType.slice(sep + 1).toUpperCase();
}
function useMentionFiles(open) {
    const [mentionFiles, setMentionFiles] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]([]);
    const mentionLoadedRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!open || mentionLoadedRef.current) return;
        mentionLoadedRef.current = true;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getRecentFilesForMention"])(30).then((res)=>{
            if (res.success && res.data?.files) {
                setMentionFiles(res.data.files.map((f)=>({
                        id: f.id,
                        name: f.name,
                        // API 不返回 path,用 mimeType · size 作为次要展示文本
                        path: `${mimeToLabel(f.mimeType)} · ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatFileSize"])(f.size)}`
                    })));
            }
        }).catch(()=>{
        // 静默失败:未登录/网络错误时保持空数组,Popover 显示"无匹配文件"
        });
    }, [
        open
    ]);
    return {
        mentionFiles
    };
}
function useAiSkills(open) {
    const [aiSkills, setAiSkills] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]([]);
    const [skillsLoading, setSkillsLoading] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const skillsLoadedRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!open || skillsLoadedRef.current) return;
        skillsLoadedRef.current = true;
        setSkillsLoading(true);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$ai$2d$skills$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["listAiSkills"])().then((res)=>{
            if (!res.success) {
                // 失败:重置 ref 允许下次打开时重试(避免一次性失败永久锁死)
                skillsLoadedRef.current = false;
                // eslint-disable-next-line no-console
                console.warn('[slash-cmd] listAiSkills failed:', res.error, res.status);
                return;
            }
            // 兼容两种响应结构(后端标准是数组,但防御性处理嵌套结构)
            const skills = Array.isArray(res.data) ? res.data : res.data && Array.isArray(res.data.skills) ? res.data.skills : [];
            if (skills.length > 0) {
                setAiSkills(skills);
            } else {
                // 空响应:重置 ref 允许下次重试(后端可能临时返回空)
                skillsLoadedRef.current = false;
                // eslint-disable-next-line no-console
                console.warn('[slash-cmd] listAiSkills returned empty or unexpected shape:', res.data);
            }
        }).catch((err)=>{
            // 网络错误:重置 ref 允许下次重试
            skillsLoadedRef.current = false;
            // 静默失败 UI,但记录错误便于排查(生产环境不影响用户体验)
            // eslint-disable-next-line no-console
            console.error('[slash-cmd] listAiSkills network error:', err);
        }).finally(()=>{
            setSkillsLoading(false);
        });
    }, [
        open
    ]);
    return {
        aiSkills,
        skillsLoading
    };
}
}),
"[project]/apps/web/src/hooks/use-hover-preview.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useHoverPreview",
    ()=>useHoverPreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useHoverPreview({ buildContent, anchorRef, data, delayMs = 250, closeDelayMs = 100, offsetX = 8, offsetY = 8 }) {
    const [visible, setVisible] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"](false);
    const [position, setPosition] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]({
        x: 0,
        y: 0
    });
    const dataRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](data);
    dataRef.current = data;
    const showTimerRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    const closeTimerRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    const clearTimers = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        if (showTimerRef.current !== null) {
            window.clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);
    const close = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        clearTimers();
        setVisible(false);
    }, [
        clearTimers
    ]);
    const show = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((e)=>{
        if (!dataRef.current) return;
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        if (visible) return;
        const anchor = anchorRef.current;
        let x = 0;
        let y = 0;
        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            x = rect.right + offsetX;
            y = rect.top + offsetY;
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
        } else if ('clientX' in e) {
            x = e.clientX + offsetX;
            y = e.clientY + offsetY;
        }
        setPosition({
            x,
            y
        });
        showTimerRef.current = window.setTimeout(()=>{
            setVisible(true);
            showTimerRef.current = null;
        }, delayMs);
    }, [
        anchorRef,
        delayMs,
        offsetX,
        offsetY,
        visible
    ]);
    const hide = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        if (showTimerRef.current !== null) {
            window.clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
        closeTimerRef.current = window.setTimeout(()=>{
            setVisible(false);
            closeTimerRef.current = null;
        }, closeDelayMs);
    }, [
        closeDelayMs
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        return ()=>clearTimers();
    }, [
        clearTimers
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (data === null) close();
    }, [
        data,
        close
    ]);
    return {
        visible,
        position,
        content: data ? buildContent(data) : null,
        hoverHandlers: {
            onMouseEnter: show,
            onMouseLeave: hide,
            onFocus: show,
            onBlur: hide
        },
        close
    };
}
}),
"[project]/apps/web/src/hooks/use-permission-request.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "usePermissionRequest",
    ()=>usePermissionRequest
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+react-query@5.101.2_react@19.0.0/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/workspace.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
function usePermissionRequest({ userId } = {}) {
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$101$2e$2_react$40$19$2e$0$2e$0$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQueryClient"])();
    const [pendingRequests, setPendingRequests] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]([]);
    // 页面加载时拉一次后端 pending 列表(兜底:刷新时仍存在的待决请求)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!userId) return;
        let cancelled = false;
        void (async ()=>{
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["listPendingPermissionRequests"])();
            if (cancelled || !res.success) return;
            const items = (res.data?.requests ?? []).map((r)=>({
                    requestId: r.requestId,
                    userId: r.userId,
                    tool: r.tool,
                    args: r.args,
                    createdAt: r.createdAt
                }));
            if (items.length > 0) {
                setPendingRequests((prev)=>{
                    const known = new Set(prev.map((p)=>p.requestId));
                    return [
                        ...prev,
                        ...items.filter((i)=>!known.has(i.requestId))
                    ];
                });
            }
        })();
        return ()=>{
            cancelled = true;
        };
    }, [
        userId
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if (!userId) return;
        let cancelled = false;
        // 复用全局 WebSocket(由 use-websocket.ts 维护);此处通过自定义事件订阅
        const handler = (e)=>{
            if (cancelled) return;
            const detail = e.detail;
            // workspace_permissions 系统的待决请求
            if (detail?.type === 'workspace.permission.request') {
                const payload = detail.payload;
                if (payload.userId !== userId) return;
                setPendingRequests((prev)=>{
                    if (prev.some((p)=>p.requestId === payload.requestId)) return prev;
                    return [
                        ...prev,
                        payload
                    ];
                });
                return;
            }
            // 兼容旧 AgentLoop 的 permission.request 事件
            if (detail?.type === 'permission.request') {
                const payload = detail.payload;
                if (payload.userId !== userId) return;
                setPendingRequests((prev)=>{
                    if (prev.some((p)=>p.requestId === payload.requestId)) return prev;
                    return [
                        ...prev,
                        payload
                    ];
                });
            }
        };
        window.addEventListener('ws:message', handler);
        return ()=>{
            cancelled = true;
            window.removeEventListener('ws:message', handler);
        };
    }, [
        userId,
        queryClient
    ]);
    const dismiss = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((requestId)=>{
        setPendingRequests((prev)=>prev.filter((r)=>r.requestId !== requestId));
    }, []);
    /**
   * 用户决策:调用后端 resolve 端点 → 后端 Promise 解锁 → 等待中的 FS 工具调用同步放行/拒绝。
   */ const resolve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](async (requestId, approved, reason)=>{
        dismiss(requestId);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["resolvePermissionRequest"])(requestId, approved, reason);
    }, [
        dismiss
    ]);
    return {
        pendingRequests,
        dismiss,
        resolve
    };
}
}),
"[project]/apps/web/src/hooks/use-click-outside.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useClickOutside",
    ()=>useClickOutside
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useClickOutside(callback) {
    const ref = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](null);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const handler = undefined;
    }, [
        callback
    ]);
    return ref;
}
}),
"[project]/apps/web/src/hooks/use-search-history.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSearchHistory",
    ()=>useSearchHistory
]);
// 2026-07-28 立:SearchBar 三段式搜索面板的"历史"段数据 hook。
// 封装 localStorage 'searchHistory' 键的读写,带 SSR + quota exceeded 防护,
// 上限 10 条 + 提交去重(最新在前)。
// 用法:
//   const { history, addHistory, clearHistory } = useSearchHistory()
// 仅在客户端运行(window 守卫),可被任意 SearchBar 消费者独立使用。
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
const STORAGE_KEY = 'searchHistory';
const MAX_ITEMS = 10;
function readFromStorage() {
    if ("TURBOPACK compile-time truthy", 1) return [];
    //TURBOPACK unreachable
    ;
}
function writeToStorage(next) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function clearStorage() {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function useSearchHistory() {
    const [history, setHistory] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"]([]);
    // 挂载后从 localStorage 读取(避免 SSR 时访问 window)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        setHistory(readFromStorage());
    }, []);
    const addHistory = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"]((item)=>{
        const trimmed = item.trim();
        if (!trimmed) return;
        setHistory((prev)=>{
            const next = [
                trimmed,
                ...prev.filter((h)=>h !== trimmed)
            ].slice(0, MAX_ITEMS);
            writeToStorage(next);
            return next;
        });
    }, []);
    const clearHistory = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"](()=>{
        setHistory([]);
        clearStorage();
    }, []);
    return {
        history,
        addHistory,
        clearHistory
    };
}
}),
"[project]/apps/web/src/hooks/use-search-popular.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSearchPopular",
    ()=>useSearchPopular
]);
// 2026-07-28 立:SearchBar 三段式搜索面板的"热门"段 hook。
// 当前为 const 直接返回(项目硬编码基线),预留 i18n / API 远程拉取扩展点。
// 后续若改为远端拉取,只需在此 hook 内 useEffect + useState,签名保持稳定。
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$suggestions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/search-suggestions.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$search$2d$suggestions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/search-suggestions.ts [app-ssr] (ecmascript)");
'use client';
;
function useSearchPopular() {
    return [
        ...__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$search$2d$suggestions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["POPULAR_SEARCHES"]
    ];
}
}),
"[project]/apps/web/src/hooks/use-native-shortcuts.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useNativeShortcuts",
    ()=>useNativeShortcuts
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useNativeShortcuts(handler) {
    const handlerRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"](handler);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        handlerRef.current = handler;
    }, [
        handler
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"](()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const isEditableTarget = undefined;
        const onKey = undefined;
    }, []);
}
}),
];

//# sourceMappingURL=apps_web_src_hooks_c1e7217e._.js.map