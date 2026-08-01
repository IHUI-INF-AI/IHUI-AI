module.exports = [
"[project]/apps/web/src/lib/utils.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/design-tokens/src/index.ts [app-ssr] (ecmascript) <locals>");
;
}),
"[project]/apps/web/src/lib/tauri-bridge.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// tauri 桥接依赖:运行时由 Tauri WebView 注入,构建时 next.config.ts transpilePackages 解析。
// pnpm workspace 已将 @tauri-apps/api 与 @tauri-apps/plugin-dialog 链接到 web node_modules。
__turbopack_context__.s([
    "FILE_FILTERS",
    ()=>FILE_FILTERS,
    "checkForUpdates",
    ()=>checkForUpdates,
    "clearWebViewCache",
    ()=>clearWebViewCache,
    "closeWindow",
    ()=>closeWindow,
    "disableAutostart",
    ()=>disableAutostart,
    "enableAutostart",
    ()=>enableAutostart,
    "getActiveWindow",
    ()=>getActiveWindow,
    "getDesktopAppInfo",
    ()=>getDesktopAppInfo,
    "getLocalizedAppName",
    ()=>getLocalizedAppName,
    "getSystemTheme",
    ()=>getSystemTheme,
    "hideMainWindow",
    ()=>hideMainWindow,
    "isAutostartEnabled",
    ()=>isAutostartEnabled,
    "isTauri",
    ()=>isTauri,
    "isWindowMaximized",
    ()=>isWindowMaximized,
    "keyboardHotkey",
    ()=>keyboardHotkey,
    "keyboardPress",
    ()=>keyboardPress,
    "keyboardType",
    ()=>keyboardType,
    "listDir",
    ()=>listDir,
    "maximizeWindow",
    ()=>maximizeWindow,
    "minimizeWindow",
    ()=>minimizeWindow,
    "mouseClick",
    ()=>mouseClick,
    "mouseMove",
    ()=>mouseMove,
    "mouseScroll",
    ()=>mouseScroll,
    "onMaximizeChange",
    ()=>onMaximizeChange,
    "onSystemThemeChange",
    ()=>onSystemThemeChange,
    "openAdminWindow",
    ()=>openAdminWindow,
    "pickDirectory",
    ()=>pickDirectory,
    "pickFile",
    ()=>pickFile,
    "pickFiles",
    ()=>pickFiles,
    "pickSavePath",
    ()=>pickSavePath,
    "quitApp",
    ()=>quitApp,
    "readBinaryFile",
    ()=>readBinaryFile,
    "readTextFile",
    ()=>readTextFile,
    "resetWindowState",
    ()=>resetWindowState,
    "restartApp",
    ()=>restartApp,
    "restoreWindowState",
    ()=>restoreWindowState,
    "saveWindowState",
    ()=>saveWindowState,
    "screenshotScreen",
    ()=>screenshotScreen,
    "sendDesktopNotification",
    ()=>sendDesktopNotification,
    "setTrayStatus",
    ()=>setTrayStatus,
    "showMainWindow",
    ()=>showMainWindow,
    "startResize",
    ()=>startResize,
    "startWindowDrag",
    ()=>startWindowDrag,
    "statFile",
    ()=>statFile,
    "toggleAlwaysOnTop",
    ()=>toggleAlwaysOnTop,
    "toggleDevtools",
    ()=>toggleDevtools,
    "toggleFullscreen",
    ()=>toggleFullscreen,
    "toggleMainWindow",
    ()=>toggleMainWindow,
    "toggleMaximizeWindow",
    ()=>toggleMaximizeWindow,
    "unmaximizeWindow",
    ()=>unmaximizeWindow,
    "writeTextFile",
    ()=>writeTextFile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tauri-apps+api@2.11.1/node_modules/@tauri-apps/api/core.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tauri-apps+api@2.11.1/node_modules/@tauri-apps/api/window.js [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$plugin$2d$dialog$40$2$2e$7$2e$2$2f$node_modules$2f40$tauri$2d$apps$2f$plugin$2d$dialog$2f$dist$2d$js$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tauri-apps+plugin-dialog@2.7.2/node_modules/@tauri-apps/plugin-dialog/dist-js/index.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/format.ts [app-ssr] (ecmascript)");
;
;
;
;
function isTauri() {
    if ("TURBOPACK compile-time truthy", 1) return false;
    //TURBOPACK unreachable
    ;
}
function getLocalizedAppName() {
    if (typeof navigator !== 'undefined') {
        const lang = navigator.language.toLowerCase();
        if (lang.startsWith('zh')) return '智汇AI';
    }
    return 'IHUI AI';
}
/** 非 Tauri 环境统一抛错(用于文件读写等无安全默认值的场景)。 */ function requireTauri() {
    if (!isTauri()) {
        throw new Error('Not in Tauri environment');
    }
}
async function enableAutostart() {
    if (!isTauri()) return;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:autostart|enable');
}
async function disableAutostart() {
    if (!isTauri()) return;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:autostart|disable');
}
async function isAutostartEnabled() {
    if (!isTauri()) return false;
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:autostart|is_enabled');
}
async function showMainWindow() {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|show', {
        label
    });
}
async function hideMainWindow() {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|hide', {
        label
    });
}
async function toggleMainWindow() {
    if (!isTauri()) return false;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    const visible = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|is_visible', {
        label
    });
    if (visible) {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|hide', {
            label
        });
    } else {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|show', {
            label
        });
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|set_focus', {
            label
        });
    }
    return !visible;
}
async function minimizeWindow() {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|minimize', {
        label
    });
}
async function maximizeWindow() {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|maximize', {
        label
    });
}
async function unmaximizeWindow() {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|unmaximize', {
        label
    });
}
async function toggleMaximizeWindow() {
    if (!isTauri()) return false;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|toggle_maximize', {
        label
    });
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|is_maximized', {
        label
    });
}
async function isWindowMaximized() {
    if (!isTauri()) return false;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|is_maximized', {
        label
    });
}
async function closeWindow() {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|close', {
        label
    });
}
async function startWindowDrag() {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:window|start_dragging', {
        label
    });
}
async function startResize(direction) {
    if (!isTauri()) return;
    const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('start_resize', {
            direction,
            label
        });
    } catch  {
    // 窗口最大化/最小化时 start_resize 会失败,静默忽略
    }
}
async function toggleFullscreen() {
    if (!isTauri()) return false;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('toggle_fullscreen');
}
async function toggleAlwaysOnTop() {
    if (!isTauri()) return false;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('toggle_always_on_top');
}
function onMaximizeChange(callback) {
    if (!isTauri()) return ()=>{};
    const win = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])();
    let cancelled = false;
    let unlistenFn = null;
    let lastInvokeAt = 0;
    const THROTTLE_MS = 100;
    const promise = win.onResized(async ()=>{
        if (cancelled) return;
        const now = Date.now();
        if (now - lastInvokeAt < THROTTLE_MS) return;
        lastInvokeAt = now;
        try {
            const max = await win.isMaximized();
            if (!cancelled) callback(max);
        } catch  {
        /* ignore */ }
    });
    promise.then((fn)=>{
        if (cancelled) {
            // cleanup 已先于 Promise resolve 调用 → 立即取消订阅
            try {
                fn();
            } catch  {
            /* ignore */ }
        } else {
            unlistenFn = fn;
        }
    });
    return ()=>{
        cancelled = true;
        if (unlistenFn) {
            try {
                unlistenFn();
            } catch  {
            /* ignore */ }
            unlistenFn = null;
        }
    };
}
async function getSystemTheme() {
    if (!isTauri()) return undefined;
    try {
        const theme = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:os|theme');
        return theme;
    } catch  {
        return undefined;
    }
}
function onSystemThemeChange(callback) {
    if (!isTauri()) return ()=>{};
    const win = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])();
    let unlisten;
    win.onThemeChanged(async ()=>{
        const theme = await getSystemTheme();
        if (theme) callback(theme);
    }).then((fn)=>{
        unlisten = fn;
    });
    return ()=>{
        unlisten?.();
    };
}
async function getDesktopAppInfo() {
    if (!isTauri()) return null;
    try {
        return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('get_app_info');
    } catch  {
        return null;
    }
}
async function openAdminWindow() {
    if (!isTauri()) return;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('open_admin_window');
}
async function toggleDevtools() {
    if (!isTauri()) return;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('toggle_devtools');
}
async function quitApp() {
    if (!isTauri()) return;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('quit_app');
}
async function sendDesktopNotification(title, body) {
    if (!isTauri()) return;
    try {
        let granted = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:notification|is_permission_granted');
        if (!granted) {
            const permission = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:notification|request_permission');
            granted = permission === 'granted';
        }
        if (granted) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('plugin:notification|notify', {
                options: {
                    title,
                    body
                }
            });
        }
    } catch  {
    // 权限被拒或调用失败,静默忽略
    }
}
const FILE_FILTERS = {
    images: {
        name: '图片',
        extensions: [
            'png',
            'jpg',
            'jpeg',
            'gif',
            'webp',
            'bmp',
            'svg'
        ]
    },
    text: {
        name: '文本',
        extensions: [
            'txt',
            'md',
            'log',
            'csv',
            'json',
            'xml',
            'yml',
            'yaml',
            'toml'
        ]
    },
    pdf: {
        name: 'PDF',
        extensions: [
            'pdf'
        ]
    },
    all: {
        name: '所有文件',
        extensions: [
            '*'
        ]
    }
};
async function readTextFile(path) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('read_text_file', {
        path
    });
}
async function readBinaryFile(path) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('read_binary_file', {
        path
    });
}
async function writeTextFile(path, content) {
    requireTauri();
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('write_text_file', {
        path,
        content
    });
}
async function listDir(path) {
    if (!isTauri()) return {
        entries: []
    };
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('list_dir', {
        path
    });
}
async function statFile(path) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('stat_file', {
        path
    });
}
async function pickFile(filters = [
    FILE_FILTERS.all
]) {
    if (!isTauri()) return null;
    try {
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$plugin$2d$dialog$40$2$2e$7$2e$2$2f$node_modules$2f40$tauri$2d$apps$2f$plugin$2d$dialog$2f$dist$2d$js$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["open"])({
            multiple: false,
            filters: filters.map((f)=>({
                    name: f.name,
                    extensions: [
                        ...f.extensions
                    ]
                }))
        });
        return typeof result === 'string' ? result : null;
    } catch  {
        return null;
    }
}
async function pickFiles(filters = [
    FILE_FILTERS.all
]) {
    if (!isTauri()) return [];
    try {
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$plugin$2d$dialog$40$2$2e$7$2e$2$2f$node_modules$2f40$tauri$2d$apps$2f$plugin$2d$dialog$2f$dist$2d$js$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["open"])({
            multiple: true,
            filters: filters.map((f)=>({
                    name: f.name,
                    extensions: [
                        ...f.extensions
                    ]
                }))
        });
        if (result === null) return [];
        return Array.isArray(result) ? result : [
            result
        ];
    } catch  {
        return [];
    }
}
async function pickDirectory() {
    if (!isTauri()) return null;
    try {
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$plugin$2d$dialog$40$2$2e$7$2e$2$2f$node_modules$2f40$tauri$2d$apps$2f$plugin$2d$dialog$2f$dist$2d$js$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["open"])({
            directory: true,
            multiple: false
        });
        return typeof result === 'string' ? result : null;
    } catch  {
        return null;
    }
}
async function pickSavePath(defaultName, filters = [
    FILE_FILTERS.all
]) {
    if (!isTauri()) return null;
    try {
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$plugin$2d$dialog$40$2$2e$7$2e$2$2f$node_modules$2f40$tauri$2d$apps$2f$plugin$2d$dialog$2f$dist$2d$js$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["save"])({
            defaultPath: defaultName,
            filters: filters.map((f)=>({
                    name: f.name,
                    extensions: [
                        ...f.extensions
                    ]
                }))
        });
        return result ?? null;
    } catch  {
        return null;
    }
}
async function saveWindowState() {
    if (!isTauri()) return;
    try {
        const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('save_window_state', {
            label
        });
    } catch  {
    // 非 Tauri 环境或调用失败,静默忽略
    }
}
async function restoreWindowState() {
    if (!isTauri()) return;
    try {
        const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('restore_window_state', {
            label
        });
    } catch  {
    // 非 Tauri 环境或调用失败,静默忽略
    }
}
async function resetWindowState() {
    if (!isTauri()) return;
    try {
        const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$window$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getCurrentWindow"])().label;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('reset_window_state', {
            label
        });
    } catch  {
    // 非 Tauri 环境或调用失败,静默忽略
    }
}
async function clearWebViewCache() {
    if (!isTauri()) return {
        ok: false
    };
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('clear_webview_cache');
}
async function setTrayStatus(status) {
    if (!isTauri()) return;
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('set_tray_status', {
            status
        });
    } catch  {
    // 非桌面端或 tray 未初始化,静默忽略
    }
}
async function checkForUpdates() {
    if (!isTauri()) return null;
    try {
        const { check } = await __turbopack_context__.A("[project]/node_modules/@tauri-apps/plugin-updater/dist-js/index.js [app-ssr] (ecmascript, async loader)");
        const update = await check();
        if (!update) return null;
        return {
            info: {
                version: update.version,
                date: update.date,
                notes: update.body
            },
            downloadAndInstall: async (onProgress)=>{
                let downloaded = 0;
                let total = 0;
                await update.downloadAndInstall((event)=>{
                    switch(event.event){
                        case 'Started':
                            {
                                const d = event.data;
                                total = d.contentLength ?? 0;
                                onProgress?.({
                                    downloaded: 0,
                                    total
                                });
                                break;
                            }
                        case 'Progress':
                            {
                                const d = event.data;
                                downloaded += d.chunkLength ?? 0;
                                onProgress?.({
                                    downloaded,
                                    total
                                });
                                break;
                            }
                        case 'Finished':
                            onProgress?.({
                                downloaded: total || downloaded,
                                total
                            });
                            break;
                    }
                });
            }
        };
    } catch (e) {
        console.warn('[updater] check failed:', e);
        return null;
    }
}
async function restartApp() {
    if (!isTauri()) return;
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('restart_app');
    } catch (e) {
        console.warn('[updater] restart failed:', e);
    }
}
async function screenshotScreen(displayIndex, region) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('screenshot_screen', {
        displayIndex: displayIndex ?? null,
        region: region ?? null
    });
}
async function mouseMove(x, y, absolute) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('mouse_move', {
        x,
        y,
        absolute: absolute ?? null
    });
}
async function mouseClick(x, y, button, count) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('mouse_click', {
        x,
        y,
        button: button ?? null,
        count: count ?? null
    });
}
async function mouseScroll(deltaY, x, y) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('mouse_scroll', {
        deltaY,
        x: x ?? null,
        y: y ?? null
    });
}
async function keyboardType(text, delay) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('keyboard_type', {
        text,
        delay: delay ?? null
    });
}
async function keyboardPress(key) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('keyboard_press', {
        key
    });
}
async function keyboardHotkey(keys) {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('keyboard_hotkey', {
        keys
    });
}
async function getActiveWindow() {
    requireTauri();
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tauri$2d$apps$2b$api$40$2$2e$11$2e$1$2f$node_modules$2f40$tauri$2d$apps$2f$api$2f$core$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["invoke"])('active_window');
}
}),
"[project]/apps/web/src/lib/query-client.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getQueryClient",
    ()=>getQueryClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$queryClient$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/query-core/build/modern/queryClient.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$hydration$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/query-core/build/modern/hydration.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$utils$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/query-core/build/modern/utils.js [app-ssr] (ecmascript)");
;
function makeQueryClient() {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$queryClient$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["QueryClient"]({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                // P1-4 修复(2026-07-28):gcTime 从默认 5 分钟降到 2 分钟,加速未使用查询的 GC,
                // 减少长会话中缓存查询的内存占用(默认 5 分钟太长,长会话累积大量 stale 查询)
                gcTime: 2 * 60 * 1000,
                retry: 1
            },
            mutations: {
                onError: (error)=>{
                    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$utils$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isServer"]) {
                        __turbopack_context__.A("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript, async loader)").then(({ toast })=>toast.error(error.message));
                    }
                }
            },
            dehydrate: {
                shouldDehydrateQuery: (query)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$hydration$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["defaultShouldDehydrateQuery"])(query) || query.state.status === 'pending'
            }
        }
    });
}
let browserQueryClient = undefined;
function getQueryClient() {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$utils$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isServer"]) return makeQueryClient();
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
}
}),
"[project]/apps/web/src/lib/cookie-utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Auth Cookie 管理。
 *
 * - auth_token:accessToken(供 SSR/middleware 读取),跟随 access token 生命周期
 * - refresh_token:refreshToken(持久化以支持"记住 30 天"),autoLogin=true 时 max-age=30d
 *
 * 注意:与 accessToken 同等级非 httpOnly(项目现有策略),refresh 后端有家族轮换 +
 * RFC 6749 重用检测保护,被窃取后可即时吊销。
 */ __turbopack_context__.s([
    "REMEMBER_MAX_AGE",
    ()=>REMEMBER_MAX_AGE,
    "clearRefreshTokenCookie",
    ()=>clearRefreshTokenCookie,
    "getAuthCookie",
    ()=>getAuthCookie,
    "getAuthCookieDomain",
    ()=>getAuthCookieDomain,
    "getRefreshTokenCookie",
    ()=>getRefreshTokenCookie,
    "setAuthCookie",
    ()=>setAuthCookie,
    "setRefreshTokenCookie",
    ()=>setRefreshTokenCookie
]);
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const AUTH_TOKEN_COOKIE = 'auth_token';
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;
/** 2026-07-31 升级:accessToken cookie 默认 30 天(原 7 天,因 admin 测试账号用户偏好"长持久化,
 *  避免每周都要重新登录,完整覆盖 30 天 refreshToken 周期)。
 *  关键安全说明:accessToken cookie 走 document.cookie(非 httpOnly),
 *  任何 XSS 都能读取。30 天延长是用户可接受的风险(本项目 XSS 防护已就位),
 *  如果项目有独立用户要求更短 TTL,可改回 7 天(平衡用户体验与安全)。 */ const ACCESS_TOKEN_DEFAULT_MAX_AGE = 30 * 24 * 60 * 60;
function getAuthCookieDomain() {
    if ("TURBOPACK compile-time truthy", 1) return undefined;
    //TURBOPACK unreachable
    ;
    const configured = undefined;
    const host = undefined;
}
function buildCookieParts(opts) {
    const isSecure = "undefined" !== 'undefined' && window.location.protocol === 'https:';
    const domain = getAuthCookieDomain();
    const parts = [
        'path=/',
        'SameSite=Lax'
    ];
    if (opts?.maxAge !== undefined && opts.maxAge >= 0) {
        parts.push(`max-age=${opts.maxAge}`);
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if (domain) parts.push(`domain=${domain}`);
    return parts;
}
function setAuthCookie(token, opts) {
    if (typeof document === 'undefined') return;
    // 2026-07-28 加固:默认 7 天 maxAge(原默认 -1 = session cookie,关闭浏览器失效)
    const finalOpts = {
        maxAge: opts?.maxAge ?? ACCESS_TOKEN_DEFAULT_MAX_AGE
    };
    const parts = buildCookieParts(finalOpts);
    if (token) {
        document.cookie = `${AUTH_TOKEN_COOKIE}=${token}; ${parts.join('; ')}`;
    } else {
        document.cookie = `${AUTH_TOKEN_COOKIE}=; ${parts.map((p)=>p.startsWith('max-age') ? 'max-age=0' : p).join('; ')}`;
    }
}
function setRefreshTokenCookie(token, opts) {
    if (typeof document === 'undefined') return;
    const parts = buildCookieParts(opts);
    if (token) {
        document.cookie = `${REFRESH_TOKEN_COOKIE}=${token}; ${parts.join('; ')}`;
    } else {
        document.cookie = `${REFRESH_TOKEN_COOKIE}=; ${parts.map((p)=>p.startsWith('max-age') ? 'max-age=0' : p).join('; ')}`;
    }
}
function getRefreshTokenCookie() {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}
function clearRefreshTokenCookie() {
    setRefreshTokenCookie(null, {
        maxAge: 0
    });
}
function getAuthCookie() {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}
}),
"[project]/apps/web/src/lib/login-dialog-trigger.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 登录弹窗懒触发统一决策中心(2026-07-24 深度根治)。
 *
 * 设计目的:从机制上杜绝"刷新进项目就弹窗"回归。
 *
 * 历史教训:
 * - a0bc9e5c5 只修了 cookie 分支的 isPublicPath 检查,reauth 分支"保持不变"导致回归
 * - api.ts 的 401 拦截有自己的 loginDialogOpenGuard,LoginRedirectListener 没有,并发触发会弹两次
 * - isPublicPath 白名单只在 LoginRedirectListener 定义,api.ts 401 拦截根本没检查公开路径
 *
 * 根治方案:
 * - 所有触发点(LoginRedirectListener reauth/cookie 分支 + api.ts 401 拦截)统一调用 openLoginDialogOnce
 * - 公开路径白名单只在此处维护一份,新增公开页面只改这里
 * - 模块级 openGuard 跨所有触发点共享,防并发弹窗/StrictMode 双调用
 *
 * 懒触发策略(memory: 登录弹窗懒触发策略):
 * - 公开页面(/ /login /register 等)不主动弹窗
 * - 仅受保护页/用户主动操作(非 GET 401)时弹
 */ __turbopack_context__.s([
    "PUBLIC_PATHS",
    ()=>PUBLIC_PATHS,
    "__resetOpenGuardForTest",
    ()=>__resetOpenGuardForTest,
    "isPublicPath",
    ()=>isPublicPath,
    "openLoginDialogOnce",
    ()=>openLoginDialogOnce
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$login$2d$dialog$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/login-dialog.ts [app-ssr] (ecmascript)");
;
const PUBLIC_PATHS = new Set([
    '/',
    '/login',
    '/register',
    '/sso/login',
    '/sso/register',
    '/forgot-password',
    '/reset-password',
    '/about',
    '/contact',
    '/pricing',
    '/docs',
    '/api/health'
]);
function isPublicPath(path) {
    if (!path) return true;
    // 取 path 部分(去掉 query/hash),因为白名单只匹配 path
    const pathOnly = path.split('?')[0]?.split('#')[0] ?? '';
    return PUBLIC_PATHS.has(pathOnly);
}
/**
 * 全局去重 guard:同一时刻只允许一个登录弹窗。
 * 跨所有触发点(reauth / cookie / 401)共享,防并发弹窗 + React StrictMode 双调用。
 */ let openGuard = false;
function openLoginDialogOnce(target) {
    if ("TURBOPACK compile-time truthy", 1) return false;
    //TURBOPACK unreachable
    ;
    let unsub;
}
function __resetOpenGuardForTest() {
    openGuard = false;
}
}),
"[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fetchApi",
    ()=>fetchApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$login$2d$dialog$2d$trigger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/login-dialog-trigger.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/cookie-utils.ts [app-ssr] (ecmascript)");
;
;
;
;
// 2026-07-25 修复 CSRF:内存 token 为 null 时从 auth_token cookie 兜底读取。
// 原因:登录后只把 accessToken 写到 cookie(2026-07-21 安全加固后未持久化到 localStorage),
// 刷新页面后 useAuthStore.token 丢失,但 cookie 仍在。CSRF 插件(csrf.ts)对非 Bearer
// 写请求直接拒绝,导致新增服务商等表单无法保存。
(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["setTokenProvider"])({
    getToken: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().token ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$cookie$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getAuthCookie"])()
});
// A 套壳:rewrites 失效后(output: 'export'),前端直连 apps/api
// - Tauri 环境:直连 http://127.0.0.1:8802(本地 API server)
// - 浏览器环境:用 NEXT_PUBLIC_API_BASE_URL 环境变量(开发时设 http://localhost:8802)
// - 未设置时 baseUrl 为空,依赖同源反代(如 Nginx)
// 只在客户端执行(build/SSR 时跳过,避免循环依赖导致模块导出未初始化)
function detectApiBaseUrl() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
}
// 2026-07-27 修复 SSE 流被 Next.js dev proxy 中断:
// Next.js dev server 的 rewrite 代理对 SSE 流式响应有超时/缓冲问题,导致 net::ERR_ABORTED。
// streamChat 用独立的 streamBaseUrl 直连 API 服务器,绕过 dev proxy。
// 检测策略(按优先级):
// 1. Tauri 环境:直连 http://localhost:8802
// 2. 开发环境(localhost:8801):直连 http://localhost:8802(绕过 Next.js dev proxy)
// 3. 显式 env 配置:NEXT_PUBLIC_STREAM_API_BASE_URL
// 4. 生产环境:留空走同源(baseUrl 复用)
// 2026-07-27 修复:用 localhost 替代 127.0.0.1 — Chrome 系统代理/PAC 文件常把 127.0.0.1
// 路由到代理服务器导致 ERR_CONNECTION_REFUSED,而 localhost 走 bypass 列表能正常访问。
function detectStreamBaseUrl() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // 生产环境或显式配置(留空则复用 baseUrl,走同源反代)
    return process.env.NEXT_PUBLIC_STREAM_API_BASE_URL || '';
}
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
async function fetchApi(url, options = {}) {
    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(url, options);
    if (!result.success && result.status === 401) {
        const method = (options.method ?? 'GET').toUpperCase();
        // 仅用户主动操作(非 GET)的 401 才弹窗
        if (method !== 'GET') {
            const currentPath = window.location.pathname + window.location.search;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$login$2d$dialog$2d$trigger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["openLoginDialogOnce"])(currentPath);
        }
    }
    return result;
}
;
}),
"[project]/apps/web/src/lib/third-party-config.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 第三方登录统一配置管理
 *
 * 等价自旧架构 client/src/features/third-party-login/config/thirdPartyConfig.ts，
 * 适配新架构（Next.js，使用 NEXT_PUBLIC_* 前缀环境变量）。
 *
 * 生产环境只需在 .env 文件中配置对应的环境变量即可。
 */ __turbopack_context__.s([
    "ALIPAY_CONFIG",
    ()=>ALIPAY_CONFIG,
    "APPLE_CONFIG",
    ()=>APPLE_CONFIG,
    "DINGTALK_CONFIG",
    ()=>DINGTALK_CONFIG,
    "ENTERPRISE_WECHAT_CONFIG",
    ()=>ENTERPRISE_WECHAT_CONFIG,
    "FEISHU_CONFIG",
    ()=>FEISHU_CONFIG,
    "GITHUB_CONFIG",
    ()=>GITHUB_CONFIG,
    "GOOGLE_CONFIG",
    ()=>GOOGLE_CONFIG,
    "WECHAT_CONFIG",
    ()=>WECHAT_CONFIG,
    "getAllPlatformConfigs",
    ()=>getAllPlatformConfigs,
    "getPlatformConfig",
    ()=>getPlatformConfig,
    "validatePlatformConfig",
    ()=>validatePlatformConfig
]);
/**
 * Next.js 客户端 env 变量映射表。
 *
 * ⚠️ 重要:Next.js 只在编译时静态替换 `process.env.NEXT_PUBLIC_*` 的**直接字面量引用**,
 * 不支持 `process.env[key]` 的动态访问。所以必须显式列出所有用到的变量名,
 * 让 Next.js 编译器能识别并内联到客户端 chunk。
 */ const ENV_DIRECT_ACCESS = {
    NEXT_PUBLIC_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_ENABLED,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_GOOGLE_REDIRECT_URI: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
    NEXT_PUBLIC_GOOGLE_SCOPE: process.env.NEXT_PUBLIC_GOOGLE_SCOPE,
    NEXT_PUBLIC_APPLE_ENABLED: process.env.NEXT_PUBLIC_APPLE_ENABLED,
    NEXT_PUBLIC_APPLE_CLIENT_ID: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
    NEXT_PUBLIC_APPLE_REDIRECT_URI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI,
    NEXT_PUBLIC_APPLE_SCOPE: process.env.NEXT_PUBLIC_APPLE_SCOPE,
    NEXT_PUBLIC_DINGTALK_ENABLED: process.env.NEXT_PUBLIC_DINGTALK_ENABLED,
    NEXT_PUBLIC_DINGTALK_APP_ID: process.env.NEXT_PUBLIC_DINGTALK_APP_ID,
    NEXT_PUBLIC_DINGTALK_CLIENT_ID: process.env.NEXT_PUBLIC_DINGTALK_CLIENT_ID,
    NEXT_PUBLIC_DINGTALK_REDIRECT_URI: process.env.NEXT_PUBLIC_DINGTALK_REDIRECT_URI,
    NEXT_PUBLIC_DINGTALK_SCOPE: process.env.NEXT_PUBLIC_DINGTALK_SCOPE,
    NEXT_PUBLIC_ENTERPRISE_WECHAT_ENABLED: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_ENABLED,
    NEXT_PUBLIC_ENTERPRISE_WECHAT_APP_ID: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_APP_ID,
    NEXT_PUBLIC_ENTERPRISE_WECHAT_AGENT_ID: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_AGENT_ID,
    NEXT_PUBLIC_ENTERPRISE_WECHAT_REDIRECT_URI: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_REDIRECT_URI,
    NEXT_PUBLIC_ENTERPRISE_WECHAT_SCOPE: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_SCOPE,
    NEXT_PUBLIC_WECHAT_ENABLED: process.env.NEXT_PUBLIC_WECHAT_ENABLED,
    NEXT_PUBLIC_WECHAT_APP_ID: process.env.NEXT_PUBLIC_WECHAT_APP_ID,
    NEXT_PUBLIC_WECHAT_REDIRECT_URI: process.env.NEXT_PUBLIC_WECHAT_REDIRECT_URI,
    NEXT_PUBLIC_WECHAT_SCOPE: process.env.NEXT_PUBLIC_WECHAT_SCOPE,
    NEXT_PUBLIC_GITHUB_ENABLED: process.env.NEXT_PUBLIC_GITHUB_ENABLED,
    NEXT_PUBLIC_GITHUB_CLIENT_ID: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
    NEXT_PUBLIC_GITHUB_REDIRECT_URI: process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI,
    NEXT_PUBLIC_GITHUB_SCOPE: process.env.NEXT_PUBLIC_GITHUB_SCOPE,
    NEXT_PUBLIC_FEISHU_ENABLED: process.env.NEXT_PUBLIC_FEISHU_ENABLED,
    NEXT_PUBLIC_FEISHU_APP_ID: process.env.NEXT_PUBLIC_FEISHU_APP_ID,
    NEXT_PUBLIC_FEISHU_CLIENT_ID: process.env.NEXT_PUBLIC_FEISHU_CLIENT_ID,
    NEXT_PUBLIC_FEISHU_REDIRECT_URI: process.env.NEXT_PUBLIC_FEISHU_REDIRECT_URI,
    NEXT_PUBLIC_FEISHU_SCOPE: process.env.NEXT_PUBLIC_FEISHU_SCOPE,
    NEXT_PUBLIC_ALIPAY_ENABLED: process.env.NEXT_PUBLIC_ALIPAY_ENABLED,
    NEXT_PUBLIC_ALIPAY_APP_ID: process.env.NEXT_PUBLIC_ALIPAY_APP_ID,
    NEXT_PUBLIC_ALIPAY_REDIRECT_URI: process.env.NEXT_PUBLIC_ALIPAY_REDIRECT_URI,
    NEXT_PUBLIC_ALIPAY_SCOPE: process.env.NEXT_PUBLIC_ALIPAY_SCOPE
};
/**
 * 读取 Next.js 公开环境变量（客户端可见，必须以 NEXT_PUBLIC_ 前缀）。
 * 返回字符串；未配置时返回 fallback。
 */ function getEnv(key, fallback = '') {
    const v = ENV_DIRECT_ACCESS[key];
    return v === undefined || v === '' ? fallback : v;
}
/** 读取布尔环境变量，未配置时返回 fallback。 */ function getEnvBool(key, fallback = true) {
    const v = getEnv(key, '');
    if (v === '') return fallback;
    return v === 'true' || v === '1';
}
/** 当前站点 origin（用于构造默认回调地址） */ function getOrigin() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return '';
}
const GOOGLE_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_GOOGLE_ENABLED', true),
    clientId: getEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_GOOGLE_REDIRECT_URI', `${getOrigin()}/google/callback`),
    scope: getEnv('NEXT_PUBLIC_GOOGLE_SCOPE', 'openid email profile'),
    proxyPath: '/api/auth/google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
};
const APPLE_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_APPLE_ENABLED', true),
    clientId: getEnv('NEXT_PUBLIC_APPLE_CLIENT_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_APPLE_REDIRECT_URI', `${getOrigin()}/apple/callback`),
    scope: getEnv('NEXT_PUBLIC_APPLE_SCOPE', 'name email'),
    proxyPath: '/api/auth/apple',
    authUrl: 'https://appleid.apple.com/auth/authorize'
};
const DINGTALK_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_DINGTALK_ENABLED', true),
    appId: getEnv('NEXT_PUBLIC_DINGTALK_APP_ID'),
    clientId: getEnv('NEXT_PUBLIC_DINGTALK_CLIENT_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_DINGTALK_REDIRECT_URI', `${getOrigin()}/callback?platform=dingtalk`),
    scope: getEnv('NEXT_PUBLIC_DINGTALK_SCOPE', 'openid corpid'),
    proxyPath: '/api/auth/dingtalk',
    authUrl: 'https://login.dingtalk.com/oauth2/auth'
};
const ENTERPRISE_WECHAT_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_ENTERPRISE_WECHAT_ENABLED', true),
    appId: getEnv('NEXT_PUBLIC_ENTERPRISE_WECHAT_APP_ID'),
    agentId: getEnv('NEXT_PUBLIC_ENTERPRISE_WECHAT_AGENT_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_ENTERPRISE_WECHAT_REDIRECT_URI', `${getOrigin()}/callback?platform=enterpriseWechat`),
    scope: getEnv('NEXT_PUBLIC_ENTERPRISE_WECHAT_SCOPE', 'snsapi_privateinfo'),
    proxyPath: '/api/auth/login/enterprise/pc/wxCode',
    authUrl: 'https://open.work.weixin.qq.com/wwopen/sso/qrConnect'
};
const WECHAT_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_WECHAT_ENABLED', true),
    appId: getEnv('NEXT_PUBLIC_WECHAT_APP_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_WECHAT_REDIRECT_URI', `${getOrigin()}/callback?platform=wechat`),
    scope: getEnv('NEXT_PUBLIC_WECHAT_SCOPE', 'snsapi_login'),
    proxyPath: '/api/auth/wechat/mini/login',
    authUrl: 'https://open.weixin.qq.com/connect/qrconnect'
};
const GITHUB_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_GITHUB_ENABLED', true),
    clientId: getEnv('NEXT_PUBLIC_GITHUB_CLIENT_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_GITHUB_REDIRECT_URI', `${getOrigin()}/callback?platform=github`),
    scope: getEnv('NEXT_PUBLIC_GITHUB_SCOPE', 'read:user user:email'),
    proxyPath: '/api/auth/github',
    authUrl: 'https://github.com/login/oauth/authorize'
};
const FEISHU_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_FEISHU_ENABLED', true),
    appId: getEnv('NEXT_PUBLIC_FEISHU_APP_ID'),
    clientId: getEnv('NEXT_PUBLIC_FEISHU_CLIENT_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_FEISHU_REDIRECT_URI', `${getOrigin()}/callback?platform=feishu`),
    scope: getEnv('NEXT_PUBLIC_FEISHU_SCOPE', 'contact:user.base:readonly'),
    proxyPath: '/api/auth/feishu',
    authUrl: 'https://passport.feishu.cn/suite/passport/oauth/authorize'
};
const ALIPAY_CONFIG = {
    enabled: getEnvBool('NEXT_PUBLIC_ALIPAY_ENABLED', true),
    appId: getEnv('NEXT_PUBLIC_ALIPAY_APP_ID'),
    redirectUri: getEnv('NEXT_PUBLIC_ALIPAY_REDIRECT_URI', `${getOrigin()}/callback?platform=alipay`),
    scope: getEnv('NEXT_PUBLIC_ALIPAY_SCOPE', 'auth_user'),
    proxyPath: '/api/auth/alipay/pc/wxCode',
    authUrl: 'https://openauth.alipay.com/oauth2/publicAppAuthorize.htm'
};
/** 平台 → 配置映射 */ const PLATFORM_CONFIGS = {
    google: GOOGLE_CONFIG,
    apple: APPLE_CONFIG,
    dingtalk: DINGTALK_CONFIG,
    enterpriseWechat: ENTERPRISE_WECHAT_CONFIG,
    wechat: WECHAT_CONFIG,
    github: GITHUB_CONFIG,
    feishu: FEISHU_CONFIG,
    alipay: ALIPAY_CONFIG
};
function getAllPlatformConfigs() {
    return PLATFORM_CONFIGS;
}
function getPlatformConfig(platform) {
    return PLATFORM_CONFIGS[platform];
}
function validatePlatformConfig(platform) {
    const config = PLATFORM_CONFIGS[platform];
    if (!config) {
        return {
            valid: false,
            missing: [
                '平台配置不存在'
            ]
        };
    }
    if (!config.enabled) {
        return {
            valid: false,
            missing: [
                '平台未启用'
            ]
        };
    }
    const missing = [];
    if (!config.clientId && !config.appId) {
        missing.push('CLIENT_ID 或 APP_ID');
    }
    if (!config.redirectUri) {
        missing.push('REDIRECT_URI');
    }
    return {
        valid: missing.length === 0,
        missing
    };
}
}),
"[project]/apps/web/src/lib/oauth-utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * OAuth 工具函数
 *
 * 等价自旧架构 client/src/features/third-party-login/utils/oauth.ts，
 * 适配新架构并扩展：state 生成、存储、校验与授权 URL 构造。
 */ __turbopack_context__.s([
    "buildAuthUrl",
    ()=>buildAuthUrl,
    "clearOAuthState",
    ()=>clearOAuthState,
    "generateState",
    ()=>generateState,
    "getOAuthState",
    ()=>getOAuthState,
    "saveOAuthState",
    ()=>saveOAuthState,
    "validateOAuthState",
    ()=>validateOAuthState
]);
/** sessionStorage 中保存 OAuth state 的 key 前缀 */ const OAUTH_STATE_KEY_PREFIX = 'oauth_state_';
function generateState() {
    if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
        throw new Error('Web Crypto API 不可用,无法生成密码学安全随机数,拒绝降级到 Math.random()');
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b)=>b.toString(16).padStart(2, '0')).join('');
}
function buildAuthUrl(baseUrl, params) {
    const search = new URLSearchParams(params).toString();
    return search ? `${baseUrl}?${search}` : baseUrl;
}
function saveOAuthState(platform, state) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function getOAuthState(platform) {
    if ("TURBOPACK compile-time truthy", 1) return null;
    //TURBOPACK unreachable
    ;
}
function validateOAuthState(platform, state) {
    const saved = getOAuthState(platform);
    if (!saved || !state) return false;
    return saved === state;
}
function clearOAuthState(platform) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
}),
"[project]/apps/web/src/lib/auth-domains.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 分域 SSO 域配置 helper (2026-07-21 立)
 *
 * 架构:
 * - 主域 aizhs.top → 完整应用
 * - 认证子域 bsm.aizhs.top → 只承载登录/OAuth 回调,其余路径 middleware 307 跳回主域
 * - Cookie 域 .aizhs.top → 主域与认证子域共享登录态
 *
 * 跨域 OAuth 流程:
 * 1. 主域用户点 DingTalk → 302 到 bsm.aizhs.top/sso/auth?platform=dingtalk
 * 2. bsm.aizhs.top 薄页自动调用 startLogin → 跳到钉钉授权页(redirect_uri = bsm.aizhs.top/callback)
 * 3. 钉钉回调到 bsm.aizhs.top/callback?code=xxx → 写跨域 Cookie + 307 跳回主域
 * 4. 主域 useAuthBootstrap 读 Cookie → /auth/profile → 自动登录
 *
 * ⚠️ 客户端可见 env(必须 NEXT_PUBLIC_ 前缀),由 Next.js 编译期内联到 chunk。
 */ __turbopack_context__.s([
    "buildAuthSubdomainStartUrl",
    ()=>buildAuthSubdomainStartUrl,
    "buildMainDomainUrl",
    ()=>buildMainDomainUrl,
    "getAuthSubdomainOrigin",
    ()=>getAuthSubdomainOrigin,
    "getCurrentHost",
    ()=>getCurrentHost,
    "getMainDomainOrigin",
    ()=>getMainDomainOrigin,
    "isAuthSubdomainHost",
    ()=>isAuthSubdomainHost,
    "isMainDomainHost",
    ()=>isMainDomainHost
]);
const ENV_AUTH_SUBDOMAIN = process.env.NEXT_PUBLIC_AUTH_SUBDOMAIN;
const ENV_MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN;
/**
 * 解析域字符串,返回 origin(协议 + host,不带路径)
 * 兼容用户填 `https://bsm.aizhs.top` 或只填 `bsm.aizhs.top`
 */ function toOrigin(value, fallback) {
    if (!value) return fallback;
    const trimmed = value.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
}
function getAuthSubdomainOrigin() {
    return toOrigin(ENV_AUTH_SUBDOMAIN, 'https://bsm.aizhs.top');
}
function getMainDomainOrigin() {
    return toOrigin(ENV_MAIN_DOMAIN, 'https://aizhs.top');
}
function getCurrentHost() {
    if ("TURBOPACK compile-time truthy", 1) return '';
    //TURBOPACK unreachable
    ;
}
function isAuthSubdomainHost(host = getCurrentHost()) {
    if (!host) return false;
    const authHost = extractHost(getAuthSubdomainOrigin());
    if (authHost && host === authHost) return true;
    // 兼容 bsm.<mainDomain> 形式
    const mainHost = extractHost(getMainDomainOrigin());
    if (mainHost && host === `bsm.${mainHost}`) return true;
    return false;
}
function isMainDomainHost(host = getCurrentHost()) {
    if (!host) return false;
    const mainHost = extractHost(getMainDomainOrigin());
    if (!mainHost) return false;
    if (host === mainHost || host === `www.${mainHost}`) return true;
    return false;
}
/** 从 origin 字符串中取 host(失败返回空串) */ function extractHost(origin) {
    try {
        return new URL(origin).hostname.toLowerCase();
    } catch  {
        return '';
    }
}
function buildAuthSubdomainStartUrl(platform, returnTo) {
    const url = new URL('/sso/auth', getAuthSubdomainOrigin());
    url.searchParams.set('platform', platform);
    if (returnTo) url.searchParams.set('return_to', returnTo);
    return url.toString();
}
function buildMainDomainUrl(path = '/') {
    // 已经是绝对 URL,直接返回
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${getMainDomainOrigin()}${normalized}`;
}
}),
"[project]/apps/web/src/lib/remember-credentials.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * 记住密码 + 账号历史 + 自动登录 凭据管理
 *
 * 2026-07-30 重构:核心函数抽到 packages/ui-react/src/lib/remember-credentials.ts,
 * 本文件仅 re-export + 保留 web 端特有的 credentialStorage 对象(供
 * `@ihui/shared/hooks` 的 useLoginForm 注入使用,实现 CredentialStorage 接口)。
 */ __turbopack_context__.s([
    "credentialStorage",
    ()=>credentialStorage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/ui-react/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/ui-react/src/lib/remember-credentials.ts [app-ssr] (ecmascript)");
;
;
const credentialStorage = {
    loadRemembered: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["loadRememberedCredentials"],
    saveRemembered: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["saveRememberedCredentials"],
    clearRemembered: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearRememberedCredentials"],
    loadAutoLogin: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["loadAutoLogin"],
    saveAutoLogin: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["saveAutoLogin"],
    clearAutoLogin: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearAutoLogin"],
    saveLoginHistory: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$ui$2d$react$2f$src$2f$lib$2f$remember$2d$credentials$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["saveLoginHistory"]
};
}),
"[project]/apps/web/src/lib/login-preferences.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearLocalLoginPrefs",
    ()=>clearLocalLoginPrefs,
    "fetchLoginPreferences",
    ()=>fetchLoginPreferences,
    "loadLocalLoginPrefs",
    ()=>loadLocalLoginPrefs,
    "saveLocalLoginPrefs",
    ()=>saveLocalLoginPrefs,
    "saveLoginPreferences",
    ()=>saveLoginPreferences
]);
/**
 * 登录偏好(自动登录 + 自动续期)前端封装。
 *
 * 后端接口:
 *  GET /api/auth/login-preferences → { autoLogin, autoRenew }
 *  PUT /api/auth/login-preferences ← { autoLogin?, autoRenew? }
 *
 * 本地缓存(localStorage key=ihui-login-prefs)用于未登录时/登录页快速读取,
 * 登录成功后用后端返回值覆盖,保证多端一致。
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
'use client';
;
const CACHE_KEY = 'ihui-login-prefs';
const DEFAULT_PREFS = {
    autoLogin: false,
    autoRenew: true
};
function loadLocalLoginPrefs() {
    if ("TURBOPACK compile-time truthy", 1) return DEFAULT_PREFS;
    //TURBOPACK unreachable
    ;
}
function saveLocalLoginPrefs(p) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function clearLocalLoginPrefs() {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
async function fetchLoginPreferences() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/auth/login-preferences');
    if (res.success && res.data) {
        saveLocalLoginPrefs(res.data);
        return res.data;
    }
    return loadLocalLoginPrefs();
}
async function saveLoginPreferences(prefs) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/auth/login-preferences', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(prefs)
    });
    if (res.success && res.data) {
        saveLocalLoginPrefs(res.data);
        return res.data;
    }
    return null;
}
}),
"[project]/apps/web/src/lib/nav-styles.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 【2026-07-19 立】导航项 + 通用按钮共享样式常量
 *
 * 集中维护以下 4 类高频复用样式,避免散落在各组件中导致:
 * 1. 修复对齐/尺寸/颜色等 bug 时遗漏某些位置
 * 2. 风格漂移(每个组件微调变体,最终 UI 不一致)
 * 3. 难以系统性优化(改一处忘了改另外 N 处)
 *
 * 命名规则:
 * - `NAV_ITEM_*`  →  侧边栏 / 顶栏导航项(主导航)
 * - `BTN_*`       →  通用按钮(新建任务/工具栏/筛选)
 * - `CHIP_*`      →  chip / 标签(可关闭标签 / status badge)
 *
 * 中文 + 图标垂直对齐硬约束 (2026-07-19):
 * 父容器 `flex h-* items-center` + 中文 span 时,文字 span 须应用 `translateY(0.3px)`。
 * 根因:中文字体 ascent(≈11px) ≠ descent(≈3px) 不对称,ink 中心比 box 中心低 0.4-0.5px。
 * 0.3px 是 14px 字号下肉眼可识别阈值(7%)的 1/3 以下,任何 DPR 下都安全,
 * 实测 11 个侧边栏 nav 一致 delta=0.000(完美居中)。
 *
 * 配套 globals.css 已建立 `--text-vcenter-offset: 0.3px` 全局 CSS 变量,
 * 并通过 `:where(button, a, [role=button], [role=menuitem]):has(> span) > span`
 * 全局选择器自动应用,无需手动加类;覆盖 icon+文字 和 纯文字 两种场景
 * (2026-07-24 从 :has(>svg):has(>span) 放宽到 :has(>span),根治纯文字按钮偏下)。
 *
 * 调优日志(浏览器 getBoundingClientRect + Range 实测,跨 11 个侧边栏 nav 验证):
 *   - 0.5px → delta = +0.4px(过冲,文字略低于图标,可见偏差)
 *   - 0.4px → delta = +0.2px(可接受)
 *   - 0.3px → delta =  0.0px(完美居中,选定)★ 所有 nav item 一致 0.000
 *   - 0.2px → delta = -0.2px(文字略高于图标,微弱可见)
 *   - 0.1px → delta = -0.4px(过冲反方向)
 *   - 0.0px → delta = -0.5px(自然态,文字明显高于图标)
 *
 * text-xs (12px) 字号下 delta 更大,globals.css 有专用 0.7px 规则兜底。
 */ /** 侧边栏 / 顶栏主导航项基础类 (h-9 = 36px)
 *  - 与新建任务按钮 h-9 一致,视觉规整
 *  - gap-2.5 = 10px,平衡 icon 与文字间距
 *  - px-2.5 + py-2 = 10px/8px 内边距
 *  - font-medium + leading-none + whitespace-nowrap
 *  - [&>span]:translate-y-[var(--text-vcenter-offset)] 读 CSS 变量(默认 0.3px)
 *  - transition-colors 仅过渡颜色(不会让 translateY 抖动)
 */ __turbopack_context__.s([
    "BTN_NEW_CONVERSATION_CLASS",
    ()=>BTN_NEW_CONVERSATION_CLASS,
    "CHIP_BASE_CLASS",
    ()=>CHIP_BASE_CLASS,
    "HEADER_BAR_CLASS",
    ()=>HEADER_BAR_CLASS,
    "MODEL_SELECTOR_TRIGGER_CLASS",
    ()=>MODEL_SELECTOR_TRIGGER_CLASS,
    "NAV_CHILD_CLASS",
    ()=>NAV_CHILD_CLASS,
    "NAV_ITEM_BASE_CLASS",
    ()=>NAV_ITEM_BASE_CLASS,
    "NAV_ITEM_COLLAPSED_CLASS",
    ()=>NAV_ITEM_COLLAPSED_CLASS,
    "NAV_ITEM_EXPANDED_CLASS",
    ()=>NAV_ITEM_EXPANDED_CLASS,
    "TOPBAR_BTN_BASE",
    ()=>TOPBAR_BTN_BASE,
    "TOPBAR_BTN_W9",
    ()=>TOPBAR_BTN_W9
]);
const NAV_ITEM_BASE_CLASS = 'flex h-9 min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium leading-none whitespace-nowrap transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]';
const NAV_ITEM_COLLAPSED_CLASS = 'w-9 mx-auto justify-center';
const NAV_ITEM_EXPANDED_CLASS = 'w-full';
const NAV_CHILD_CLASS = 'flex h-9 w-full min-w-0 items-center gap-2 rounded-md pl-5 pr-2.5 py-1.5 text-sm font-medium leading-none whitespace-nowrap transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]';
const BTN_NEW_CONVERSATION_CLASS = 'flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm font-medium leading-none transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]';
const CHIP_BASE_CLASS = 'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border py-0 pl-7 pr-1 text-xs leading-none transition-colors';
const HEADER_BAR_CLASS = 'flex h-14 shrink-0 items-center gap-2 px-3 [&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]';
const TOPBAR_BTN_BASE = 'inline-flex h-full shrink-0 items-center justify-center rounded-md bg-card text-foreground/80 transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent [&>svg]:!h-3.5 [&>svg]:!w-3.5';
const TOPBAR_BTN_W9 = 'w-9';
const MODEL_SELECTOR_TRIGGER_CLASS = 'inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]';
}),
"[project]/apps/web/src/lib/date-utils.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$date$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/date-utils.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/src/lib/download.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildTimestamp",
    ()=>buildTimestamp,
    "downloadText",
    ()=>downloadText,
    "slugifyForFilename",
    ()=>slugifyForFilename
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$date$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/date-utils.ts [app-ssr] (ecmascript)");
;
function downloadText(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([
        content
    ], {
        type: `${mimeType};charset=utf-8`
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function slugifyForFilename(title) {
    const slug = title.toLowerCase().replace(/[^\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    return slug || 'conversation';
}
function buildTimestamp() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$date$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDateByTemplate"])(new Date(), 'YYYYMMDD-HHmm');
}
}),
"[project]/apps/web/src/lib/downloads.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 下载配置层(2026-07-19 抽取,2026-07-25 配置外置)
 *
 * 历史:原本内联在 `apps/web/src/components/sidebar.tsx` 的模块级 `DOWNLOADS` 数组
 *  耦合了 React 组件的图标 import + i18n label key,导致:
 *  1) 测试覆盖困难(必须 mock 整个 React 渲染管线)
 *  2) 后端下载元数据 schema(后续可能对接 CDN + 真实 App Store ID + APK 路径)无法独立演进
 *  3) 8 端下载数据散落在 UI 组件里,缺少单一事实源
 *
 * 抽取后:
 *  - `DownloadPlatform` 联合类型覆盖全部 8 端,与 `apps/*` 目录一一对应
 *  - `DownloadEntry` 扩展接口预留 `version?` + `sha256?` 字段(为后续真实下载元数据接入)
 *  - `DOWNLOADS` 常量集中维护,sidebar.tsx 仅做 map 渲染
 *  - 纯数据 + 类型,无 React/JSX 依赖,可独立单测
 *
 * 配置外置(2026-07-25):运营待接入字段(App Store ID / 4 端 href / APK path /
 * 微信小程序 QR)统一在 `apps/web/src/config/downloads.config.ts` 的 DOWNLOADS_CONFIG
 * 维护,本文件通过 resolveIosHref / resolveAndroidHref / resolveWechatHref 三个 resolver
 * 读取配置。空字符串值视为"未接入",UI 通过 isDownloadAvailable 判断后显示占位。
 */ __turbopack_context__.s([
    "AndroidIcon",
    ()=>AndroidIcon,
    "AppleIcon",
    ()=>AppleIcon,
    "DOWNLOADS",
    ()=>DOWNLOADS,
    "WechatMiniIcon",
    ()=>WechatMiniIcon,
    "getDownloadEntry",
    ()=>getDownloadEntry,
    "isDownloadAvailable",
    ()=>isDownloadAvailable,
    "isExternalDownloadHref",
    ()=>isExternalDownloadHref
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/globe.js [app-ssr] (ecmascript) <export default as Globe>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/monitor.js [app-ssr] (ecmascript) <export default as Monitor>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$puzzle$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Puzzle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/puzzle.js [app-ssr] (ecmascript) <export default as Puzzle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$smartphone$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Smartphone$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/smartphone.js [app-ssr] (ecmascript) <export default as Smartphone>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/terminal.js [app-ssr] (ecmascript) <export default as Terminal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/config/downloads.config.ts [app-ssr] (ecmascript)");
;
;
;
function AppleIcon({ className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: "0 0 24 24",
        fill: "currentColor",
        className: className,
        "aria-hidden": true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M17.05 20.28c-.98.95-2.05.86-3.08.4-1.09-.47-2.09-.49-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        }, void 0, false, {
            fileName: "[project]/apps/web/src/lib/downloads.tsx",
            lineNumber: 66,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/src/lib/downloads.tsx",
        lineNumber: 65,
        columnNumber: 5
    }, this);
}
function AndroidIcon({ className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: "0 0 24 24",
        fill: "currentColor",
        className: className,
        "aria-hidden": true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M17.523 15.341c-.572 0-1.04-.469-1.04-1.04s.468-1.04 1.04-1.04 1.04.469 1.04 1.04-.468 1.04-1.04 1.04m-11.045 0c-.572 0-1.04-.469-1.04-1.04s.468-1.04 1.04-1.04 1.04.469 1.04 1.04-.468 1.04-1.04 1.04m11.461-6.354 2.093-3.625a.479.479 0 0 0-.176-.652.477.477 0 0 0-.652.176l-2.114 3.662C15.683 7.964 13.954 7.5 12 7.5s-3.683.464-5.089 1.048L4.797 4.886a.477.477 0 0 0-.652-.176.479.479 0 0 0-.176.652L6.06 8.987C3.302 10.65 1.5 13.668 1.5 17h21c0-3.332-1.802-6.35-4.561-8.013"
        }, void 0, false, {
            fileName: "[project]/apps/web/src/lib/downloads.tsx",
            lineNumber: 75,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/src/lib/downloads.tsx",
        lineNumber: 74,
        columnNumber: 5
    }, this);
}
function WechatMiniIcon({ className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: "0 0 24 24",
        fill: "currentColor",
        className: className,
        "aria-hidden": true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.328.328 0 0 0 .166-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .55-.012.822-.034-.17-.585-.26-1.204-.26-1.844 0-3.97 3.842-7.19 8.583-7.19.235 0 .466.013.696.035C17.917 4.084 13.604 2.188 8.691 2.188zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 10.435 7.17c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-3.94 0-7.135 2.7-7.135 6.027 0 3.328 3.195 6.027 7.135 6.027a8.34 8.34 0 0 0 2.018-.252.578.578 0 0 1 .476.066l1.27.737a.218.218 0 0 0 .11.036.195.195 0 0 0 .194-.197.218.218 0 0 0-.032-.108l-.26-.984a.39.39 0 0 1 .142-.443C21.78 19.39 23 17.78 23 15.885c0-3.328-3.196-6.027-7.062-6.027zm-2.378 3.594c.483 0 .875.395.875.882a.879.879 0 0 1-.875.882.879.879 0 0 1-.875-.882c0-.487.392-.882.875-.882zm4.756 0c.483 0 .875.395.875.882a.879.879 0 0 1-.875.882.879.879 0 0 1-.875-.882c0-.487.392-.882.875-.882z"
        }, void 0, false, {
            fileName: "[project]/apps/web/src/lib/downloads.tsx",
            lineNumber: 84,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/src/lib/downloads.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
const DOWNLOADS = [
    {
        platform: 'web',
        labelKey: 'downloadWeb',
        descKey: 'downloadWebDesc',
        href: '/',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"]
    },
    {
        platform: 'desktop',
        labelKey: 'downloadDesktop',
        descKey: 'downloadDesktopDesc',
        href: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DOWNLOADS_CONFIG"].hrefs.desktop,
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"]
    },
    {
        platform: 'ios',
        labelKey: 'downloadIOS',
        descKey: 'downloadIOSDesc',
        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["resolveIosHref"])(),
        icon: AppleIcon
    },
    {
        platform: 'android-apk',
        labelKey: 'downloadAndroidApk',
        descKey: 'downloadAndroidDesc',
        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["resolveAndroidHref"])(),
        icon: AndroidIcon
    },
    {
        platform: 'mobile',
        labelKey: 'downloadMobile',
        descKey: 'downloadMobileDesc',
        href: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DOWNLOADS_CONFIG"].hrefs.mobile,
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$smartphone$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Smartphone$3e$__["Smartphone"]
    },
    {
        platform: 'wechat-miniapp',
        labelKey: 'downloadWechatMiniApp',
        descKey: 'downloadMiniDesc',
        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["resolveWechatHref"])(),
        icon: WechatMiniIcon
    },
    {
        platform: 'extension',
        labelKey: 'downloadExtension',
        descKey: 'downloadExtensionDesc',
        href: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DOWNLOADS_CONFIG"].hrefs.extension,
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$puzzle$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Puzzle$3e$__["Puzzle"]
    },
    {
        platform: 'cli',
        labelKey: 'downloadCli',
        descKey: 'downloadCliDesc',
        href: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$config$2f$downloads$2e$config$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DOWNLOADS_CONFIG"].hrefs.cli,
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"]
    }
];
function getDownloadEntry(platform) {
    return DOWNLOADS.find((d)=>d.platform === platform);
}
function isExternalDownloadHref(href) {
    return /^https?:/.test(href);
}
function isDownloadAvailable(platform) {
    if (platform === 'web') return true;
    const entry = getDownloadEntry(platform);
    return Boolean(entry && entry.href.length > 0);
}
}),
"[project]/apps/web/src/lib/logger.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 浏览器端轻量 logger。
 *
 * 设计目标：
 * - 生产环境只输出 error/warn(避免 info 噪音 + 减少敏感信息泄露面)
 * - 开发环境输出全部级别,便于排查
 * - SSR 安全(浏览器 API 仅在 typeof window !== 'undefined' 时执行)
 * - 不在生产打印原始 error 对象(可能含 PII),只打 message
 *
 * 为何不消费 @ihui/shared/utils/logger(2026-07-27 审计):
 * - shared logger 是三参数结构化 (module, action, err/message),为 miniapp-taro 跨端兼容设计
 * - web 端 22 处调用走变参 (...args) + 标签前缀,与 shared 签名完全不兼容
 * - web 需要 SSR 安全 + PII 保护(shared logger 无此设计),设计目标根本不同
 * - 两端 logger 各自存在是合理的端差异,非死代码;shared logger 由 miniapp-taro 消费
 */ __turbopack_context__.s([
    "logger",
    ()=>logger
]);
const isProd = typeof process !== 'undefined' && ("TURBOPACK compile-time value", "development") === 'production';
function fmt(args) {
    return args.map((a)=>{
        if (a instanceof Error) return a.message;
        if (typeof a === 'object' && a !== null) {
            try {
                return JSON.stringify(a);
            } catch  {
                return '[unserializable]';
            }
        }
        return a;
    });
}
const logger = {
    debug: (...args)=>{
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        console.info('[debug]', ...fmt(args));
    },
    info: (...args)=>{
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        console.info('[info]', ...fmt(args));
    },
    warn: (...args)=>{
        console.warn('[warn]', ...fmt(args));
    },
    error: (...args)=>{
        console.error('[error]', ...fmt(args));
    }
};
}),
"[project]/apps/web/src/lib/subagent-timeline-mapper.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * subagent-timeline-mapper — Subagent SSE 事件 → TimelineEvent 映射层(2026-07-29 立,Phase 21)
 *
 * 作用:把 ai-service 发来的 subagent_spawn / subagent_progress / subagent_end SSE 事件
 * 转换为 timeline-store 可消费的 TimelineEvent / Partial<TimelineEvent>,
 * 让 Timeline tab 自动响应 subagent 生命周期,消除与 subagent 的割裂。
 *
 * 设计约束:
 * - 纯函数,无副作用,不调用 store
 * - 不引入 any,全部用精确类型
 * - description 截断到 80 字符(避免 Timeline 行溢出)
 * - i18n(Phase 22,2026-07-29 立):meta 中新增 i18nKey + i18nParams,
 *   description 仍保留中文 fallback(向后兼容),渲染层优先用 i18n,失败时 fallback
 */ __turbopack_context__.s([
    "mapEndToTimelineUpdate",
    ()=>mapEndToTimelineUpdate,
    "mapProgressToTimelineUpdate",
    ()=>mapProgressToTimelineUpdate,
    "mapSpawnToTimelineEvent",
    ()=>mapSpawnToTimelineEvent
]);
/** description 最大长度(避免 Timeline 行溢出) */ const MAX_DESC_LEN = 80;
/** i18n key 命名空间前缀(渲染层 strip 后传给 useTranslations('ai.pane')) */ const I18N_NS = 'ai.pane.';
/** 把字符串截断到 maxLen,超出加省略号 */ function truncate(text, maxLen = MAX_DESC_LEN) {
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen - 1)}…`;
}
function mapSpawnToTimelineEvent(event) {
    return {
        id: event.id,
        type: 'subagent',
        timestamp: event.timestamp,
        title: event.role,
        description: truncate(event.task),
        status: 'running',
        meta: {
            subagentId: event.id,
            phase: 'spawn'
        }
    };
}
function mapProgressToTimelineUpdate(event) {
    switch(event.phase){
        case 'thinking':
            {
                const iter = event.iteration ?? 0;
                const desc = {
                    key: `${I18N_NS}timelineSubagentThinking`,
                    params: {
                        iteration: iter
                    }
                };
                return {
                    id: event.id,
                    updates: {
                        status: 'running',
                        description: truncate(`思考中…(第 ${iter} 轮)`),
                        meta: {
                            phase: 'thinking',
                            iteration: iter,
                            i18nKey: desc.key,
                            i18nParams: desc.params
                        }
                    }
                };
            }
        case 'tool_call':
            {
                if (!event.tool) return null;
                const iter = event.iteration ?? 0;
                const desc = {
                    key: `${I18N_NS}timelineSubagentToolCall`,
                    params: {
                        tool: event.tool,
                        iteration: iter
                    }
                };
                return {
                    id: event.id,
                    updates: {
                        status: 'running',
                        description: truncate(`调用工具:${event.tool}(第 ${iter} 轮)`),
                        meta: {
                            phase: 'tool_call',
                            tool: event.tool,
                            iteration: iter,
                            i18nKey: desc.key,
                            i18nParams: desc.params
                        }
                    }
                };
            }
        case 'tool_result':
            {
                if (!event.tool) return null;
                const ok = event.ok !== false;
                const desc = {
                    key: ok ? `${I18N_NS}timelineSubagentToolResultSuccess` : `${I18N_NS}timelineSubagentToolResultFailed`,
                    params: {
                        tool: event.tool
                    }
                };
                const okLabel = ok ? '成功' : '失败';
                return {
                    id: event.id,
                    updates: {
                        status: 'running',
                        description: truncate(`工具返回:${event.tool} ${okLabel}`),
                        meta: {
                            phase: 'tool_result',
                            tool: event.tool,
                            ok: event.ok,
                            i18nKey: desc.key,
                            i18nParams: desc.params
                        }
                    }
                };
            }
        case 'output_ready':
            {
                const preview = event.outputPreview ?? '';
                const previewShort = preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;
                const desc = {
                    key: `${I18N_NS}timelineSubagentOutputReady`
                };
                return {
                    id: event.id,
                    updates: {
                        status: 'running',
                        description: truncate(`输出就绪:${previewShort}`),
                        meta: {
                            phase: 'output_ready',
                            outputPreview: preview,
                            i18nKey: desc.key,
                            i18nParams: desc.params
                        }
                    }
                };
            }
        default:
            return null;
    }
}
function mapEndToTimelineUpdate(event) {
    if (event.status === 'failed') {
        const reason = (event.failureReason ?? '').slice(0, 100);
        return {
            id: event.id,
            updates: {
                status: 'failed',
                description: truncate(`失败:${reason}`),
                meta: {
                    phase: 'end',
                    status: event.status,
                    failureReason: event.failureReason
                }
            }
        };
    }
    return {
        id: event.id,
        updates: {
            status: 'done',
            description: '完成',
            meta: {
                phase: 'end',
                status: event.status
            }
        }
    };
}
}),
"[project]/apps/web/src/lib/model-context-capacity.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * 模型上下文容量映射 — web 端 shim
 *
 * 实现已迁移到 packages/api-client/src/model-context-capacity.ts(跨端共享)。
 * 本文件保留 re-export 以兼容现有 `@/lib/model-context-capacity` 导入路径,
 * 避免破坏 web 端既有代码。
 */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/index.ts [app-ssr] (ecmascript) <locals>");
;
;
}),
"[project]/apps/web/src/lib/markdown-mermaid-code.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// 此文件已下沉到 @ihui/shared,保留 re-export 保持向后兼容
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$markdown$2d$mermaid$2d$code$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/markdown-mermaid-code.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/src/lib/message-search.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// 此文件已下沉到 @ihui/shared,保留 re-export 保持向后兼容
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$message$2d$search$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/message-search.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/src/lib/models-api.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 模型广场 / AI 资讯 API 客户端
 *
 * 目标:把 /models 页面从"helpers.ts 写死数据"升级为"消费 seed 2026-07 真实数据"
 * 同时为后续 backend 路由补全预留 fetch 接口,带 graceful fallback。
 *
 * 后端路由(2026-07 当前可用):
 *   - GET /api/llm/models                 已存在(需 auth,代理 ai-service,旧 fetchModels 走它)
 *   - GET /api/llm/list                   已存在(DB 驱动,20 字段格式)
 *   - GET /api/news/articles/pinned       已存在(公开,置顶资讯)
 *   - GET /api/news/articles/recommended  已存在(公开,推荐资讯)
 *   - GET /api/models/market              已存在(公开,DB 驱动 zhsAiModelInfo status=1)
 *   - GET /api/news/feed                  已存在(公开,合并置顶+推荐+最新发布)
 *
 * 行为约定:
 *   - fetch 失败/超时/404 → 返回空数组 + console.warn
 *   - 永远不抛出,调用方不需要 try-catch
 *   - 严格使用 apps/web/src/lib/api 的统一鉴权
 */ __turbopack_context__.s([
    "fetchProvidersHealth",
    ()=>fetchProvidersHealth,
    "getAiNewsFeed",
    ()=>getAiNewsFeed,
    "getMarketModels",
    ()=>getMarketModels
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$logger$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/logger.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$llm$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/llm.js [app-ssr] (ecmascript)");
;
;
;
async function getMarketModels() {
    try {
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/models/market?limit=200', {
            next: {
                revalidate: 300
            }
        });
        if (result.success) {
            return result.data?.models ?? result.data?.items ?? [];
        }
        return [];
    } catch (err) {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        return [];
    }
}
async function getAiNewsFeed(limit = 6) {
    // 主路由:合并 feed
    try {
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(`/api/news/feed?limit=${limit}`, {
            next: {
                revalidate: 300
            }
        });
        if (r.success && Array.isArray(r.data?.items) && r.data.items.length > 0) {
            return r.data.items;
        }
    } catch  {
    // 静默
    }
    // fallback:分别拉 pinned + recommended(取并集去重)
    const out = [];
    try {
        const [pinned, recommended] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/news/articles/pinned', {
                next: {
                    revalidate: 300
                }
            }).catch(()=>null),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])('/api/news/articles/recommended', {
                next: {
                    revalidate: 300
                }
            }).catch(()=>null)
        ]);
        const map = new Map();
        if (pinned && pinned.success && pinned.data) {
            for (const a of pinned.data.list ?? [])map.set(String(a.id), a);
        }
        if (recommended && recommended.success && recommended.data) {
            for (const a of recommended.data.list ?? [])map.set(String(a.id), a);
        }
        for (const a of Array.from(map.values()).slice(0, limit)){
            out.push(toAiNewsItem(a));
        }
    } catch (err) {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
    }
    return out;
}
/** 资讯标题 → 关联模型 id 列表(从 seed 2026-07 真实新闻中提取) */ const TITLE_TO_MODEL_IDS = [
    {
        pattern: /GPT-?5\.6/i,
        ids: [
            'gpt-5.6-sol',
            'gpt-5.6-terra',
            'gpt-5.6-luna'
        ]
    },
    {
        pattern: /Claude Sonnet 5/i,
        ids: [
            'claude-sonnet-5'
        ]
    },
    {
        pattern: /Kimi K3/i,
        ids: [
            'kimi-k3'
        ]
    },
    {
        pattern: /Gemini 3\.5 Pro/i,
        ids: [
            'gemini-3.5-pro'
        ]
    },
    {
        pattern: /Grok 4\.5/i,
        ids: [
            'grok-4.5'
        ]
    },
    {
        pattern: /DeepSeek V4/i,
        ids: [
            'deepseek-v4-pro',
            'deepseek-v4-flash'
        ]
    },
    {
        pattern: /混元 Hy3/i,
        ids: [
            'hunyuan-hy3'
        ]
    },
    {
        pattern: /GLM-?5\.2/i,
        ids: [
            'glm-5.2'
        ]
    },
    {
        pattern: /Qwen3\.7-?Max/i,
        ids: [
            'qwen3.7-max'
        ]
    },
    {
        pattern: /Ornith-?1\.0/i,
        ids: [
            'ornith-1.0'
        ]
    },
    {
        pattern: /CodeBrain/i,
        ids: [
            'codebrain-1'
        ]
    },
    {
        pattern: /MAI-?Thinking/i,
        ids: [
            'mai-thinking-1'
        ]
    },
    {
        pattern: /Claude Opus 4\.8/i,
        ids: [
            'claude-opus-4.8'
        ]
    },
    {
        pattern: /GPT-?Red/i,
        ids: [
            'gpt-red'
        ]
    }
];
function inferRelatedModelIds(title) {
    const ids = new Set();
    for (const { pattern, ids: list } of TITLE_TO_MODEL_IDS){
        if (pattern.test(title)) {
            for (const id of list)ids.add(id);
        }
    }
    return Array.from(ids);
}
function toAiNewsItem(a) {
    const title = a.title ?? '';
    const categoryName = a.categoryName ?? a.category?.name ?? null;
    const publishedAt = a.publishedAt ?? a.createdAt ?? null;
    return {
        id: String(a.id),
        title,
        summary: a.summary ?? '',
        cover: a.coverImage ?? null,
        author: a.authorName ?? '',
        category: categoryName,
        publishedAt,
        relatedModelIds: inferRelatedModelIds(title),
        source: 'api'
    };
}
// ============================================================================
// Provider 健康状态(Phase C+D 模型选择器三态徽章)
// ============================================================================
const PROVIDERS_HEALTH_TTL = 30_000 // 30s 缓存,避免模型选择器每次 mount 都打后端
;
let providersHealthCache = null;
async function fetchProvidersHealth(force = false) {
    const now = Date.now();
    if (!force && providersHealthCache && now - providersHealthCache.ts < PROVIDERS_HEALTH_TTL) {
        return providersHealthCache.data;
    }
    try {
        const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$llm$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchProvidersHealthLite"])();
        providersHealthCache = {
            data,
            ts: now
        };
        return data;
    } catch (err) {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        return [];
    }
}
}),
"[project]/apps/web/src/lib/user-llm-configs.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 用户 LLM 配置 API 客户端
 *
 * 桥接 apps/web/src/components/chat/model-selector.tsx 与
 * apps/web/app/(main)/models/*(模型广场)等需要"查询/创建用户 LLM 配置"的客户端。
 *
 * 后端接口:
 *   - GET  /api/user/llm-configs                    列表
 *   - GET  /api/user/llm-configs/templates          平台模板(15+ 预置)
 *   - POST /api/user/llm-configs                    创建
 *   - PUT  /api/user/llm-configs/:id                更新
 *   - DELETE /api/user/llm-configs/:id              删除
 *   - POST /api/user/llm-configs/:id/test           测试已保存配置
 *   - POST /api/user/llm-configs/:id/fetch-models   拉取上游模型
 *   - POST /api/user/llm-configs/preview-test       临时测试(未保存)
 */ __turbopack_context__.s([
    "createConfig",
    ()=>createConfig,
    "fetchConfigs",
    ()=>fetchConfigs,
    "fetchTemplates",
    ()=>fetchTemplates,
    "isProviderConfigured",
    ()=>isProviderConfigured,
    "previewTest",
    ()=>previewTest,
    "updateConfig",
    ()=>updateConfig
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-ssr] (ecmascript) <locals>");
;
/** 通用 API 包装:从 ApiResult 解出 data,失败抛错 */ async function api(url, options) {
    const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])(url, options);
    if (!r.success) throw new Error(r.error || '请求失败');
    return r.data;
}
function fetchConfigs() {
    return api('/api/user/llm-configs');
}
function fetchTemplates() {
    return api('/api/user/llm-configs/templates');
}
function createConfig(input) {
    return api('/api/user/llm-configs', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
function updateConfig(id, input) {
    return api(`/api/user/llm-configs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
function previewTest(input) {
    return api('/api/user/llm-configs/preview-test', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
function isProviderConfigured(configs, _modelId, _provider, templateCode) {
    if (!configs?.length || !templateCode) return false;
    return configs.some((c)=>c.enabled && c.providerCode === templateCode);
}
}),
"[project]/apps/web/src/lib/llm-templates.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// 此文件已下沉到 @ihui/shared,保留 re-export 保持向后兼容
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$llm$2d$templates$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/llm-templates.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/src/lib/token-estimate.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Token 估算工具
 *
 * 简易客户端估算:英文 ~4 字符/token,中文 ~1.5 字符/token。
 * 与服务端 tiktoken 精确计数存在 ±10% 误差,仅用于 UI 进度条展示。
 *
 * 供 ContextUsageRing 等组件复用。
 */ __turbopack_context__.s([
    "estimateChatMessagesTokens",
    ()=>estimateChatMessagesTokens,
    "estimateConversationTokens",
    ()=>estimateConversationTokens,
    "estimateMessageTokens",
    ()=>estimateMessageTokens,
    "estimateTokens",
    ()=>estimateTokens
]);
function estimateTokens(text) {
    if (!text) return 0;
    const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const other = text.length - cjk;
    return Math.ceil(cjk / 1.5 + other / 4);
}
function estimateMessageTokens(message) {
    return estimateTokens(message.content ?? '') + 4;
}
function estimateConversationTokens(messages) {
    return messages.reduce((sum, m)=>sum + estimateMessageTokens(m), 0);
}
function estimateChatMessagesTokens(messages) {
    return messages.filter((m)=>!m.error && (m.role === 'user' || m.role === 'assistant') && m.content).reduce((sum, m)=>sum + estimateMessageTokens(m), 0);
}
}),
"[project]/apps/web/src/lib/permission-mode-history.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 权限模式历史记录(2026-07-25 立,深度对标 OpenAI Codex CLI 审计能力)
 *
 * 目的:
 * - 用户每次切权限模式(default / accept-edits / bypass-permissions)都记录一条
 * - 持久化到 localStorage,跨刷新可查
 * - 提供"过去一段时间每个模式累计用了多久"统计
 * - 给用户安全感和事后追溯能力(出问题可查"我什么时候切的什么模式")
 *
 * 数据流:
 * - 写入:permission-mode-popover / cyclePermissionMode(Shift+Tab) / use-chat.ts 拦截的 /permission 切
 *   + 自动撤销 1h 计时器归零 → auto-revert 来源
 *   调 recordModeChange 追加
 * - 读取:PermissionHistoryPanel(挂载在 message-input 末尾)
 *   调 getRecentHistory 渲染最近 10 条
 * - 统计:getTotalDurationByMode 用于历史面板底部的"X 模式累计 N 小时"汇总
 *
 * 容量:
 * - 最多 50 条(防无限增长),超过从最旧淘汰
 * - 与 full-access-confirm-dialog / use-permission-auto-revert 共用 localStorage 风格:
 *   try/catch 包裹所有读 / 写,隐私模式 / quota 超出静默
 *
 * 不在本文件做的事:
 * - 不导出 React hook(纯函数,调用方自己用 useEffect 同步 state)
 * - 不在内部用任何 store(zustand / ai-panel store)(避免循环依赖)
 * - 不做时区转换(Date.now() → Intl.DateTimeFormat 由调用方处理)
 */ __turbopack_context__.s([
    "MAX_HISTORY_ENTRIES",
    ()=>MAX_HISTORY_ENTRIES,
    "PERMISSION_HISTORY_KEY",
    ()=>PERMISSION_HISTORY_KEY,
    "clearHistory",
    ()=>clearHistory,
    "formatDuration",
    ()=>formatDuration,
    "formatRelativeTime",
    ()=>formatRelativeTime,
    "getRecentHistory",
    ()=>getRecentHistory,
    "getTotalDurationByMode",
    ()=>getTotalDurationByMode,
    "recordModeChange",
    ()=>recordModeChange,
    "updateLatestRecordSource",
    ()=>updateLatestRecordSource
]);
const PERMISSION_HISTORY_KEY = 'ihui:permission-mode-history';
const MAX_HISTORY_ENTRIES = 50;
function readAll() {
    if ("TURBOPACK compile-time truthy", 1) return [];
    //TURBOPACK unreachable
    ;
}
function writeAll(entries) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function recordModeChange(entry) {
    const all = readAll();
    const next = [
        entry,
        ...all
    ].slice(0, MAX_HISTORY_ENTRIES);
    writeAll(next);
}
function updateLatestRecordSource(source, predicate) {
    if ("TURBOPACK compile-time truthy", 1) return false;
    //TURBOPACK unreachable
    ;
    const all = undefined;
    const latest = undefined;
}
function getRecentHistory(workspacePath, limit = 10) {
    const all = readAll();
    const filtered = workspacePath === undefined ? all : all.filter((e)=>e.workspacePath === workspacePath);
    return filtered.slice(0, limit);
}
function getTotalDurationByMode(mode, sinceMs = 0) {
    const all = readAll();
    if (all.length === 0) return 0;
    // 按时间正序(最早在前),方便按段累加
    const sorted = [
        ...all
    ].sort((a, b)=>a.timestamp - b.timestamp);
    let totalMs = 0;
    // 段定义:[startMs, endMs),startMs = 当前条 timestamp,endMs = 下一条 timestamp 或 now
    // 段归属"前一条的 mode"——所以段归属的判断用 sorted[i-1].mode
    for(let i = 1; i < sorted.length; i++){
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev.mode !== mode) continue;
        const segStart = Math.max(prev.timestamp, sinceMs);
        const segEnd = curr.timestamp;
        if (segEnd > segStart) totalMs += segEnd - segStart;
    }
    // 最后一段(从最后一条到现在):如果最后一条的 mode 是目标 mode,累加到 now
    const last = sorted[sorted.length - 1];
    if (last.mode === mode) {
        const segStart = Math.max(last.timestamp, sinceMs);
        const segEnd = Date.now();
        if (segEnd > segStart) totalMs += segEnd - segStart;
    }
    return totalMs;
}
function clearHistory() {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function formatDuration(ms) {
    if (ms <= 0) return '0秒';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor(totalSec % 3600 / 60);
    const s = totalSec % 60;
    if (h > 0 && m > 0) return `${h}小时${m}分钟`;
    if (h > 0) return `${h}小时`;
    if (m > 0) return `${m}分钟`;
    return `${s}秒`;
}
function formatRelativeTime(timestamp, now = Date.now()) {
    const diff = now - timestamp;
    if (diff < 0) return '刚刚';
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return '刚刚';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}分钟前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}小时前`;
    const day = Math.floor(hour / 24);
    if (day < 30) return `${day}天前`;
    // 超过 30 天显示具体日期
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
}),
"[project]/apps/web/src/lib/ai-skill-variables.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// 此文件已下沉到 @ihui/shared,保留 re-export 保持向后兼容
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$ai$2d$skill$2d$variables$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/ai-skill-variables.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/src/lib/dangerous-command-detector.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// 此文件已下沉到 @ihui/shared,保留 re-export 保持向后兼容
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$dangerous$2d$command$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/dangerous-command-detector.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/src/lib/pending-question.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parsePendingQuestion",
    ()=>parsePendingQuestion
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-ssr] (ecmascript) <export * as z>");
;
/**
 * AI 主动提问挂起状态运行时校验 schema。
 *
 * 用途:
 * 1. loadHistory 从 conversation.metadata.pendingQuestion 恢复挂起状态时校验
 *    (DB metadata 可能被其他端写入异常结构 / 被外部篡改 / 字段类型不匹配)
 * 2. WS ai_question 事件 payload 校验(其他端通过 Redis Pub/Sub 传入的数据)
 *
 * 失败时返回 null,调用方应 clearPendingQuestion 降级(不弹窗),避免脏数据
 * 让 zustand store 持有非法结构导致后续 UI 崩溃。
 *
 * 类型来源:PendingQuestionFromSchema 由 z.infer 自动推导,与 stores/chat.ts 的
 * PendingQuestion 接口结构对齐(结构化类型兼容)。若 schema 漂移,调用方 TS 立即报错,
 * 无需依赖运行时测试发现。
 */ const QuestionOptionSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    id: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
    label: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string()
});
const PendingQuestionSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    questionId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
    prompt: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
    options: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(QuestionOptionSchema),
    allowCustom: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean(),
    allowMultiple: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean(),
    /** 关联的 assistant 消息 ID,用户回答后追加到该消息上下文 */ assistantMessageId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional()
});
function parsePendingQuestion(data) {
    const result = PendingQuestionSchema.safeParse(data);
    if (!result.success) {
        // data 为 null/undefined 时静默返回 null(正常:无挂起提问)
        // data 非 null 但结构非法时,dev 环境 console.warn 辅助调试脏数据来源
        if (("TURBOPACK compile-time value", "development") !== 'production' && data !== null && data !== undefined) {
            console.warn('[parsePendingQuestion] 数据校验失败,降级为 null:', result.error.issues, data);
        }
        return null;
    }
    return result.data;
}
}),
"[project]/apps/web/src/lib/search-suggestions.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// 此文件已下沉到 @ihui/shared,保留 re-export 保持向后兼容
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$search$2d$suggestions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/search-suggestions.ts [app-ssr] (ecmascript)");
;
}),
"[project]/apps/web/src/lib/path-labels.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 集中式 path → 标签规格映射单一事实来源。
 *
 * 用途:TagsView 渲染时根据 tag.path + 当前 locale 实时派生标签标题,
 * 取代"store 中存 title 字符串"的旧设计 — 语言切换后已存在标签自动重译。
 *
 * 复用现有导航定义,不重复维护:
 * - FLAT_NAV_ITEMS(主侧边栏) → ns='nav'
 * - ADMIN_NAV(AdminNav)     → ns='admin'
 * - EXTRA_PATH_LABELS       → 未在侧边栏的 17 条独立页面路由 + 86 条 2026-07-28 自动扩展
 *
 * 匹配策略:精确匹配优先,未命中则按最长前缀匹配回退。
 * 兜底:TagsView 走 deriveTitle 把 kebab-case 转 Title Case(单语言英文标题)。
 */ __turbopack_context__.s([
    "resolvePathLabelSpec",
    ()=>resolvePathLabelSpec
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$sidebar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/sidebar.tsx [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$layout$2f$AdminNav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/layout/AdminNav.tsx [app-ssr] (ecmascript)");
;
;
/** 主侧边栏路由 → ns='nav',key=labelKey */ const NAV_ENTRIES = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$sidebar$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["FLAT_NAV_ITEMS"].map((item)=>({
        href: item.href,
        spec: {
            ns: 'nav',
            key: item.labelKey
        }
    }));
/** AdminNav 路由 → ns='admin',key=labelKey */ const ADMIN_ENTRIES = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$layout$2f$AdminNav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ADMIN_NAV"].map((item)=>({
        href: item.href,
        spec: {
            ns: 'admin',
            key: item.labelKey
        }
    }));
/**
 * 未在侧边栏中暴露但用户可能通过 URL 直接访问的独立页面路由。
 * 这些路由的标签规格走对应独立页面命名空间,确保标题正确翻译。
 *
 * 2026-07-28 自动扩展 86 条:基于 Next.js 路由扫描 + zh-CN.json 已有 key 匹配。
 * 用户反馈"标签栏卡片文本没做好 i18n",补全直接 URL 访问页面的翻译规格。
 */ const EXTRA_PATH_LABELS = [
    // ===== 原有 21 条独立页面路由 =====
    {
        href: '/about',
        spec: {
            ns: 'nav',
            key: 'about'
        }
    },
    {
        href: '/articles',
        spec: {
            ns: 'articles',
            key: 'title'
        }
    },
    {
        href: '/business-card',
        spec: {
            ns: 'nav',
            key: 'businessCard'
        }
    },
    {
        href: '/pricing',
        spec: {
            ns: 'nav',
            key: 'pricing'
        }
    },
    {
        href: '/support',
        spec: {
            ns: 'nav',
            key: 'support'
        }
    },
    {
        href: '/ai-generation',
        spec: {
            ns: 'nav',
            key: 'aiGeneration'
        }
    },
    {
        href: '/ask',
        spec: {
            ns: 'nav',
            key: 'ask'
        }
    },
    {
        href: '/comments',
        spec: {
            ns: 'nav',
            key: 'comments'
        }
    },
    {
        href: '/developer',
        spec: {
            ns: 'nav',
            key: 'developer'
        }
    },
    {
        href: '/drama',
        spec: {
            ns: 'nav',
            key: 'drama'
        }
    },
    {
        href: '/edu',
        spec: {
            ns: 'nav',
            key: 'edu'
        }
    },
    {
        href: '/image-gen',
        spec: {
            ns: 'nav',
            key: 'imageGen'
        }
    },
    {
        href: '/member',
        spec: {
            ns: 'nav',
            key: 'member'
        }
    },
    {
        href: '/mobile-dashboard',
        spec: {
            ns: 'nav',
            key: 'mobileDashboard'
        }
    },
    {
        href: '/notifications',
        spec: {
            ns: 'nav',
            key: 'notifications'
        }
    },
    {
        href: '/commission',
        spec: {
            ns: 'nav',
            key: 'commission'
        }
    },
    {
        href: '/contact',
        spec: {
            ns: 'nav',
            key: 'contact'
        }
    },
    {
        href: '/mcp-projects',
        spec: {
            ns: 'nav',
            key: 'mcpProjects'
        }
    },
    {
        href: '/openclaw',
        spec: {
            ns: 'nav',
            key: 'openclaw'
        }
    },
    {
        href: '/recruitment',
        spec: {
            ns: 'nav',
            key: 'recruitment'
        }
    },
    {
        href: '/blog',
        spec: {
            ns: 'blog',
            key: 'title'
        }
    },
    // ===== 2026-07-31 修订:/chat 标签显示「首页」对齐主工作区内容 =====
    // 背景:/chat 路由本身只是 AISidePanel 的快捷入口,page.tsx 复用 /home 的工作区首页内容
    // (export { default } from '../home/page')。原 spec 走 aiChat.title="AI任务",
    // 导致刷新 /chat?conversationId=xxx 时主工作区显示首页内容但标签显示"AI任务",
    // 用户反馈"AI任务这种东西不应该存在啊 ai任务不是在左侧任务列表里吗
    // 还有在ai对话框中就解决了啊"。
    // 解决:/chat 标签改用 nav.home="首页",与主工作区渲染的首页内容视觉一致。
    // AI 任务的实际入口仍是左侧 SidebarChatHistory + 右侧 AISidePanel,标签栏不再
    // 重复出现"AI任务"概念。
    // /chat/history 已通过 NAV_ENTRIES(nav.chatHistory="对话历史")注册,此处不重复。
    // /chat/favorites 复用 chatHistory.favoritesTitle(5 语言均有)。
    // /chat/templates /chat/settings /chat/share/[id] 保留原 aiChat spec(独立功能页)。
    {
        href: '/chat',
        spec: {
            ns: 'nav',
            key: 'home'
        }
    },
    {
        href: '/chat/templates',
        spec: {
            ns: 'aiChat',
            key: 'templates'
        }
    },
    {
        href: '/chat/settings',
        spec: {
            ns: 'aiChat',
            key: 'settings'
        }
    },
    {
        href: '/chat/favorites',
        spec: {
            ns: 'chatHistory',
            key: 'favoritesTitle'
        }
    },
    {
        href: '/chat/share/[id]',
        spec: {
            ns: 'aiChat',
            key: 'share'
        }
    },
    // ===== 2026-07-28 自动扩展(用户反馈"标签栏卡片文本没做好 i18n")=====
    // admin 子路由 - 走 admin 命名空间已有 key
    {
        href: '/admin/agreements',
        spec: {
            ns: 'admin',
            key: 'agreements'
        }
    },
    {
        href: '/admin/ai-metrics',
        spec: {
            ns: 'admin',
            key: 'aiMetrics'
        }
    },
    {
        href: '/admin/asks',
        spec: {
            ns: 'admin',
            key: 'asks'
        }
    },
    {
        href: '/admin/behavior',
        spec: {
            ns: 'admin',
            key: 'behavior'
        }
    },
    {
        href: '/admin/circles',
        spec: {
            ns: 'admin',
            key: 'circles'
        }
    },
    {
        href: '/admin/clawdbot/permissions',
        spec: {
            ns: 'admin',
            key: 'permissions'
        }
    },
    {
        href: '/admin/comment-logs',
        spec: {
            ns: 'admin',
            key: 'commentLogs'
        }
    },
    {
        href: '/admin/comments',
        spec: {
            ns: 'admin',
            key: 'comments'
        }
    },
    {
        href: '/admin/customer-service',
        spec: {
            ns: 'admin',
            key: 'customerService'
        }
    },
    {
        href: '/admin/demand-audit',
        spec: {
            ns: 'admin',
            key: 'demandAudit'
        }
    },
    {
        href: '/admin/demand-audit/[id]',
        spec: {
            ns: 'admin',
            key: 'demandAudit'
        }
    },
    {
        href: '/admin/demand-square/[id]',
        spec: {
            ns: 'admin',
            key: 'demandSquare'
        }
    },
    {
        href: '/admin/distribution/orders',
        spec: {
            ns: 'admin',
            key: 'orders'
        }
    },
    {
        href: '/admin/edu',
        spec: {
            ns: 'admin',
            key: 'edu'
        }
    },
    {
        href: '/admin/edu-settings',
        spec: {
            ns: 'admin',
            key: 'eduSettings'
        }
    },
    {
        href: '/admin/edu/class/members',
        spec: {
            ns: 'admin',
            key: 'members'
        }
    },
    {
        href: '/admin/edu/learn/live',
        spec: {
            ns: 'admin',
            key: 'live'
        }
    },
    {
        href: '/admin/exchange-rates',
        spec: {
            ns: 'admin',
            key: 'exchangeRates'
        }
    },
    {
        href: '/admin/learn',
        spec: {
            ns: 'admin',
            key: 'learn'
        }
    },
    {
        href: '/admin/menu',
        spec: {
            ns: 'admin',
            key: 'menu'
        }
    },
    {
        href: '/admin/menu-permission',
        spec: {
            ns: 'admin',
            key: 'menuPermission'
        }
    },
    {
        href: '/admin/message-templates',
        spec: {
            ns: 'admin',
            key: 'messageTemplates'
        }
    },
    {
        href: '/admin/oss',
        spec: {
            ns: 'admin',
            key: 'oss'
        }
    },
    {
        href: '/admin/private-letters',
        spec: {
            ns: 'admin',
            key: 'privateLetters'
        }
    },
    {
        href: '/admin/refund/[id]',
        spec: {
            ns: 'admin',
            key: 'refund'
        }
    },
    {
        href: '/admin/resources/tags',
        spec: {
            ns: 'admin',
            key: 'tags'
        }
    },
    {
        href: '/admin/saas/[slug]',
        spec: {
            ns: 'admin',
            key: 'saas'
        }
    },
    {
        href: '/admin/schedule/logs',
        spec: {
            ns: 'admin',
            key: 'logs'
        }
    },
    {
        href: '/admin/search-hot-words',
        spec: {
            ns: 'admin',
            key: 'searchHotWords'
        }
    },
    {
        href: '/admin/security/anomalies',
        spec: {
            ns: 'admin',
            key: 'anomalies'
        }
    },
    {
        href: '/admin/security/ip-reputation',
        spec: {
            ns: 'admin',
            key: 'ipReputation'
        }
    },
    {
        href: '/admin/security/threat-dashboard',
        spec: {
            ns: 'admin',
            key: 'threatDashboard'
        }
    },
    {
        href: '/admin/sensitive-word',
        spec: {
            ns: 'admin',
            key: 'sensitiveWord'
        }
    },
    {
        href: '/admin/sensitive-words',
        spec: {
            ns: 'admin',
            key: 'sensitiveWords'
        }
    },
    {
        href: '/admin/signin-rule',
        spec: {
            ns: 'admin',
            key: 'signinRule'
        }
    },
    {
        href: '/admin/video-logs',
        spec: {
            ns: 'admin',
            key: 'videoLogs'
        }
    },
    // 其他独立页面
    {
        href: '/ai-world/[id]',
        spec: {
            ns: 'nav',
            key: 'aiWorld'
        }
    },
    {
        href: '/ai-world/favorites',
        spec: {
            ns: 'nav',
            key: 'favorites'
        }
    },
    {
        href: '/article',
        spec: {
            ns: 'articles',
            key: 'title'
        }
    },
    {
        href: '/articles/[id]',
        spec: {
            ns: 'articles',
            key: 'title'
        }
    },
    {
        href: '/articles/edit',
        spec: {
            ns: 'articles',
            key: 'title'
        }
    },
    {
        href: '/articles/hot',
        spec: {
            ns: 'articles',
            key: 'title'
        }
    },
    {
        href: '/blog/[slug]',
        spec: {
            ns: 'blog',
            key: 'title'
        }
    },
    {
        href: '/business-card/favorites',
        spec: {
            ns: 'nav',
            key: 'favorites'
        }
    },
    {
        href: '/certificate/download',
        spec: {
            ns: 'certificate',
            key: 'download'
        }
    },
    {
        href: '/circles/post',
        spec: {
            ns: 'circles',
            key: 'post'
        }
    },
    {
        href: '/commission/plan',
        spec: {
            ns: 'nav',
            key: 'plan'
        }
    },
    {
        href: '/distribution/commission',
        spec: {
            ns: 'distribution',
            key: 'commissionTitle'
        }
    },
    {
        href: '/distribution/team',
        spec: {
            ns: 'distribution',
            key: 'teamTitle'
        }
    },
    {
        href: '/distribution/team/[id]',
        spec: {
            ns: 'distribution',
            key: 'teamTitle'
        }
    },
    {
        href: '/distribution/token',
        spec: {
            ns: 'distribution',
            key: 'tokenTitle'
        }
    },
    {
        href: '/distribution/withdraw',
        spec: {
            ns: 'distribution',
            key: 'withdrawTitle'
        }
    },
    {
        href: '/docs',
        spec: {
            ns: 'nav',
            key: 'docs'
        }
    },
    {
        href: '/exam/wrong-questions',
        spec: {
            ns: 'exam',
            key: 'wrongQuestions'
        }
    },
    {
        href: '/feature-center/agents',
        spec: {
            ns: 'nav',
            key: 'agents'
        }
    },
    {
        href: '/feature-center/models',
        spec: {
            ns: 'nav',
            key: 'models'
        }
    },
    {
        href: '/image-gen/favorites',
        spec: {
            ns: 'nav',
            key: 'favorites'
        }
    },
    {
        href: '/knowledge-rag/[id]/chunks',
        spec: {
            ns: 'knowledgeRag',
            key: 'chunks'
        }
    },
    {
        href: '/knowledge-rag/manage',
        spec: {
            ns: 'knowledgeRag',
            key: 'manage'
        }
    },
    {
        href: '/learn/topic',
        spec: {
            ns: 'learn',
            key: 'topic'
        }
    },
    {
        href: '/learn/topic/[id]',
        spec: {
            ns: 'learn',
            key: 'topic'
        }
    },
    {
        href: '/models/contact',
        spec: {
            ns: 'models',
            key: 'contact'
        }
    },
    {
        href: '/oauth/authorize',
        spec: {
            ns: 'oauth',
            key: 'authorizeTitle'
        }
    },
    {
        href: '/payment/checkout',
        spec: {
            ns: 'payment',
            key: 'checkout'
        }
    },
    {
        href: '/plugins',
        spec: {
            ns: 'plugins',
            key: 'title'
        }
    },
    {
        href: '/points/sign-in',
        spec: {
            ns: 'points',
            key: 'signIn'
        }
    },
    {
        href: '/publish/accounts',
        spec: {
            ns: 'publish',
            key: 'accounts.title'
        }
    },
    {
        href: '/publish/history',
        spec: {
            ns: 'publish',
            key: 'history.title'
        }
    },
    {
        href: '/publish/new',
        spec: {
            ns: 'publish',
            key: 'new.title'
        }
    },
    {
        href: '/search/history',
        spec: {
            ns: 'search',
            key: 'history'
        }
    },
    {
        href: '/settings/authorizations',
        spec: {
            ns: 'settings',
            key: 'authorizationsTitle'
        }
    },
    {
        href: '/settings/icp-record',
        spec: {
            ns: 'settings',
            key: 'icpRecordTitle'
        }
    },
    {
        href: '/settings/login-security',
        spec: {
            ns: 'settings',
            key: 'loginSecurity'
        }
    },
    {
        href: '/settings/model-record',
        spec: {
            ns: 'settings',
            key: 'modelRecordTitle'
        }
    },
    {
        href: '/settings/security-log',
        spec: {
            ns: 'settings',
            key: 'securityLogTitle'
        }
    },
    {
        href: '/skills/market',
        spec: {
            ns: 'skills',
            key: 'market'
        }
    },
    {
        href: '/sso/redirect',
        spec: {
            ns: 'sso',
            key: 'redirect'
        }
    },
    {
        href: '/sso/register',
        spec: {
            ns: 'sso',
            key: 'registerTitle'
        }
    },
    {
        href: '/student/certificates',
        spec: {
            ns: 'student',
            key: 'certificates'
        }
    },
    {
        href: '/student/my-lessons',
        spec: {
            ns: 'student',
            key: 'myLessonsTitle'
        }
    },
    {
        href: '/student/wrong-book',
        spec: {
            ns: 'student',
            key: 'wrongBookTitle'
        }
    },
    {
        href: '/user/articles',
        spec: {
            ns: 'user',
            key: 'articles'
        }
    },
    {
        href: '/vip/details',
        spec: {
            ns: 'vip',
            key: 'details'
        }
    },
    {
        href: '/wallet/recharge',
        spec: {
            ns: 'wallet',
            key: 'recharge'
        }
    },
    {
        href: '/wallet/withdraw',
        spec: {
            ns: 'wallet',
            key: 'withdraw'
        }
    },
    {
        href: '/workspace/permissions',
        spec: {
            ns: 'workspace',
            key: 'permissionsPage'
        }
    }
];
/** 合并所有路由 → 标签规格映射 */ const ALL_PATH_LABEL_MAP = [
    ...NAV_ENTRIES,
    ...ADMIN_ENTRIES,
    ...EXTRA_PATH_LABELS
];
/** 按 href 长度降序排列,用于最长前缀匹配(长的优先) */ const SORTED_PATH_LABELS = [
    ...ALL_PATH_LABEL_MAP
].sort((a, b)=>b.href.length - a.href.length);
function resolvePathLabelSpec(pathname) {
    if (!pathname || pathname === '/') return {
        ns: 'nav',
        key: 'home'
    };
    // 精确匹配
    const exact = ALL_PATH_LABEL_MAP.find((e)=>e.href === pathname);
    if (exact) return exact.spec;
    // 最长前缀匹配(已按 href 长度降序)
    for (const entry of SORTED_PATH_LABELS){
        if (pathname.startsWith(`${entry.href}/`)) return entry.spec;
    }
    return null;
}
}),
"[project]/apps/web/src/lib/menu-actions.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dispatchMenuAction",
    ()=>dispatchMenuAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/tauri-bridge.ts [app-ssr] (ecmascript) <locals>");
;
async function dispatchMenuAction(id) {
    switch(id){
        case 'file.open_admin':
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["openAdminWindow"])();
            return;
        case 'file.quit':
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["quitApp"])();
            return;
        case 'view.reload':
            // Tauri WebView 内 Ctrl+R 可能被 webview 拦截,显式 reload 兜底;
            // 浏览器端 location.reload() 也安全
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            return;
        case 'view.devtools':
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["toggleDevtools"])();
            return;
        case 'view.fullscreen':
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["toggleFullscreen"])();
            return;
        case 'view.always_on_top':
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$tauri$2d$bridge$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["toggleAlwaysOnTop"])();
            return;
        case 'help.about':
            {
                // 简单 toast 占位(后续可换 Modal 显示版本号/版权/快捷键 cheat sheet)
                const { toast } = await __turbopack_context__.A("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-ssr] (ecmascript, async loader)");
                toast('智汇AI Desktop', {
                    description: '© 2026 IHUI-AI · 工作空间权限 + 8 端协同 + 176 模型',
                    duration: 4000
                });
                return;
            }
        default:
            {
                // 穷举保护:未来新增 MenuActionId 漏改此 switch 时 TS 编译期就会报错
                const _exhaustive = id;
                void _exhaustive;
            }
    }
}
}),
"[project]/apps/web/src/lib/tokenUtils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 客户端 Token 自动刷新工具。
 *
 * 背景：后端 accessToken TTL 通常 2h,refreshToken TTL 7d。避免用户长时间停留
 * 后突然 401,在 token 过期前 5 分钟自动调用 /api/auth/refresh 续期。
 *
 * 使用方式(在登录成功后):
 *   import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'
 *   startAutoRefresh(err => useLoginDialogStore.getState().open('login'))
 *
 * 依赖:useAuthStore 持久化 token + refreshToken(accessToken 必须是 JWT 带 exp 字段)。
 */ __turbopack_context__.s([
    "clearRefreshTimer",
    ()=>clearRefreshTimer,
    "startAutoRefresh",
    ()=>startAutoRefresh,
    "stopAutoRefresh",
    ()=>stopAutoRefresh
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$utils$2f$jwt$2d$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/utils/jwt-utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/auth.ts [app-ssr] (ecmascript)");
;
;
;
const REFRESH_LEAD_MS = 5 * 60 * 1000 // 提前 5 分钟续期
;
const MIN_DELAY_MS = 30 * 1000 // 最小 30s,避免 setTimeout 越界
;
const MAX_DELAY_MS = 24 * 60 * 60 * 1000 // 上限 24h
;
let refreshTimer = null;
let inFlightRefresh = null;
let stopped = false;
function clearRefreshTimer() {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
}
/** 根据 accessToken 的 exp 在过期前 leadMs 调度 setTimeout 续期 */ function schedule(opts) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
    const exp = undefined;
    const expMs = undefined;
    const delay = undefined;
}
async function doRefresh(opts) {
    if (inFlightRefresh) {
        const tokens = await inFlightRefresh;
        if (tokens) {
            opts.onRefreshed(tokens);
            schedule({
                ...opts,
                ...tokens
            });
        }
        return;
    }
    inFlightRefresh = (async ()=>{
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["refreshAccessToken"])(opts.refreshToken);
            if (!result.success || !result.data?.accessToken) {
                opts.onError?.(new Error(`refresh 失败: ${'error' in result ? result.error : 'unknown'}`));
                return null;
            }
            const data = result.data;
            opts.onRefreshed(data);
            schedule({
                ...opts,
                ...data
            });
            return data;
        } catch (e) {
            opts.onError?.(e);
            return null;
        } finally{
            inFlightRefresh = null;
        }
    })();
    await inFlightRefresh;
}
function applyRefreshed(tokens) {
    if (stopped) return;
    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().setToken(tokens.accessToken, tokens);
}
function startAutoRefresh(onError) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
    const token = undefined, refreshToken = undefined;
}
function stopAutoRefresh() {
    stopped = true;
    clearRefreshTimer();
}
}),
];

//# sourceMappingURL=apps_web_src_lib_fa503db3._.js.map