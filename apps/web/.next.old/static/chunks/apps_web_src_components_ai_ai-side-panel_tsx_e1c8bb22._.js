(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/web/src/components/ai/ai-side-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AISidePanel",
    ()=>AISidePanel,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- 手柄 role="separator" 配合 onPointerDown
   是可拖拽交互元素,但 jsx-a11y 默认把 separator 视为非交互元素,需 Tab 聚焦做无障碍。 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$minus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Minus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/minus.js [app-client] (ecmascript) <export default as Minus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pin$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pin.js [app-client] (ecmascript) <export default as Pin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/panel-left.js [app-client] (ecmascript) <export default as PanelLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-up.js [app-client] (ecmascript) <export default as ChevronUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sonner@2.0.7_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/utils.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/design-tokens/src/cn.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-chat.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$websocket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-websocket.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$api$2d$contracts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/api-contracts.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/notification.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$message$2d$list$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/chat/message-list.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$message$2d$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/chat/message-input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$agent$2d$task$2d$progress$2d$pane$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$question$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/chat/question-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$brand$2d$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/brand-icon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$workspace$2d$selector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/workspace-selector.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/feedback/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/feedback/Tooltip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$workspace$2f$workspace$2d$permission$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/workspace/workspace-permission-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/chat.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/ai-panel.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/mode.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/api-client/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/chat.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$pending$2d$question$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/pending-question.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/api.ts [app-client] (ecmascript) <locals>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
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
;
;
function AISidePanel() {
    _s();
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"])('chat');
    const tc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"])('aiChat');
    const tcommon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"])('common');
    // 性能修复(2026-07-25):全解构 → 单字段 selector。
    // zustand action 函数引用稳定,不会触发重渲染;state 字段(open/width/isResizing)
    // 只在对应字段变化时触发本组件重渲染,activeWorkspace 变化不再让本组件重渲染。
    const open = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[open]": (s)=>s.open
    }["AISidePanel.useAiPanelStore[open]"]);
    const width = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[width]": (s)=>s.width
    }["AISidePanel.useAiPanelStore[width]"]);
    const isResizing = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[isResizing]": (s)=>s.isResizing
    }["AISidePanel.useAiPanelStore[isResizing]"]);
    const closePanel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[closePanel]": (s)=>s.closePanel
    }["AISidePanel.useAiPanelStore[closePanel]"]);
    const setWidth = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setWidth]": (s)=>s.setWidth
    }["AISidePanel.useAiPanelStore[setWidth]"]);
    const setResizing = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setResizing]": (s)=>s.setResizing
    }["AISidePanel.useAiPanelStore[setResizing]"]);
    const activeWorkspace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[activeWorkspace]": (s)=>s.activeWorkspace
    }["AISidePanel.useAiPanelStore[activeWorkspace]"]);
    const setActiveWorkspace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setActiveWorkspace]": (s)=>s.setActiveWorkspace
    }["AISidePanel.useAiPanelStore[setActiveWorkspace]"]);
    const pendingPermissionSetup = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[pendingPermissionSetup]": (s)=>s.pendingPermissionSetup
    }["AISidePanel.useAiPanelStore[pendingPermissionSetup]"]);
    const setPendingPermissionSetup = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setPendingPermissionSetup]": (s)=>s.setPendingPermissionSetup
    }["AISidePanel.useAiPanelStore[setPendingPermissionSetup]"]);
    // 浮窗模式状态(2026-07-30)
    const floatMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[floatMode]": (s)=>s.floatMode
    }["AISidePanel.useAiPanelStore[floatMode]"]);
    const floatMinimized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[floatMinimized]": (s)=>s.floatMinimized
    }["AISidePanel.useAiPanelStore[floatMinimized]"]);
    const floatCollapsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[floatCollapsed]": (s)=>s.floatCollapsed
    }["AISidePanel.useAiPanelStore[floatCollapsed]"]);
    const floatPosition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[floatPosition]": (s)=>s.floatPosition
    }["AISidePanel.useAiPanelStore[floatPosition]"]);
    const setFloatMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setFloatMode]": (s)=>s.setFloatMode
    }["AISidePanel.useAiPanelStore[setFloatMode]"]);
    const setFloatMinimized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setFloatMinimized]": (s)=>s.setFloatMinimized
    }["AISidePanel.useAiPanelStore[setFloatMinimized]"]);
    const setFloatCollapsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setFloatCollapsed]": (s)=>s.setFloatCollapsed
    }["AISidePanel.useAiPanelStore[setFloatCollapsed]"]);
    const setFloatPosition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[setFloatPosition]": (s)=>s.setFloatPosition
    }["AISidePanel.useAiPanelStore[setFloatPosition]"]);
    const openPanel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"])({
        "AISidePanel.useAiPanelStore[openPanel]": (s)=>s.openPanel
    }["AISidePanel.useAiPanelStore[openPanel]"]);
    const { messages, currentModel, isStreaming, pendingQuestion, sendMessage, sendAnswer, skipQuestion, stop, clearMessages, setModel } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChat"])();
    const subAgentActivities = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"])({
        "AISidePanel.useChatStore[subAgentActivities]": (s)=>s.subAgentActivities
    }["AISidePanel.useChatStore[subAgentActivities]"]);
    // ChatMode 4 态(2026-07-28 移除独立 PlanActToggle):订阅 currentMode 用于动态切换输入框 placeholder
    const currentMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModeStore"])({
        "AISidePanel.useModeStore[currentMode]": (s)=>s.currentMode
    }["AISidePanel.useModeStore[currentMode]"]);
    const { lastMessage } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$websocket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useWebSocket"])();
    const lastWsRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const [loadingHistory, setLoadingHistory] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const [conversationTitle, setConversationTitle] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    const [workspaceName, setWorkspaceName] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    // 分页状态(2026-07-25 立,#8 滚动到顶部加载更多历史)
    // - hasMoreHistory:当前会话是否还有更早的消息可加载
    // - oldestCursor:下一页 before 游标(当前已加载消息中最旧一条的 id)
    // - loadingMoreHistory:防止滚动到顶部重复触发
    const [hasMoreHistory, setHasMoreHistory] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const oldestCursorRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const [loadingMoreHistory, setLoadingMoreHistory] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    // #11 切换会话 LRU 缓存(2026-07-25 立):
    // 缓存最近 5 个会话的 messages + 分页状态,切回会话时同步从缓存恢复(无闪烁),
    // 后台异步拉取最新消息对比更新。用 Map 维护插入顺序,delete + set 重新插入实现 LRU。
    // - conversationCacheRef:Map<conversationId, { messages, hasMore, oldestCursor }>
    // - prevConversationIdRef:跟踪上一次会话 ID,切换时把旧会话状态写入缓存
    const conversationCacheRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](new Map());
    const prevConversationIdRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    // P3 修复:组件卸载时清空会话 LRU 缓存,释放消息数据引用
    // (LRU 上限 5 个会话,每个会话含完整 messages 数组,长期运行累积大量消息数据)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            return ({
                "AISidePanel.useEffect": ()=>{
                    conversationCacheRef.current.clear();
                }
            })["AISidePanel.useEffect"];
        }
    }["AISidePanel.useEffect"], []);
    // 性能修复(2026-07-25):原 const pathname = usePathname() 订阅在 AISidePanel 根,
    // 导致每次路由切换 AISidePanel 整树重渲染(连带 MessageList/MessageInput/ModelSelector 等)。
    // 改为下推到 <WorkspaceNameSync> 子组件,pathname 订阅只触发子组件(渲染 null,无开销)。
    // 父组件通过 setWorkspaceName callback 接收项目名,不订阅 pathname。
    // 同步 AISidePanel 占据宽度(含右侧 8px 视觉间距)到 :root 的 --ai-panel-width CSS 变量。
    // 2026-07-30:AI 面板已移入 flex 流,不再需要 padding-left 避让。
    // --ai-panel-width 仍保留供 ScrollDownButton(marketing 页面)计算居中偏移。
    // - open=true:占位 = width + 8px(面板宽度 + 右侧间距)
    // - open=false:占位 = 0(仅渲染 width:0 的拖拽手柄,不占视觉空间)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            const occupy = open ? width + 8 : 0;
            document.documentElement.style.setProperty('--ai-panel-width', "".concat(occupy, "px"));
            return ({
                "AISidePanel.useEffect": ()=>{
                    // 卸载时复位,避免残留 CSS 变量导致内容区永久避让
                    document.documentElement.style.setProperty('--ai-panel-width', '0px');
                }
            })["AISidePanel.useEffect"];
        }
    }["AISidePanel.useEffect"], [
        open,
        width
    ]);
    // WebSocket 多端同步:统一处理 ai_response / ai_question / chat_question_answered 三种事件
    // - ai_response:其他端 AI 回复 → append/replace assistant 消息(原有逻辑)
    // - ai_question:其他端 AI 主动提问 → setPendingQuestion 弹窗(P2 新增)
    // - chat_question_answered:其他端用户已回答 → clearPendingQuestion 关闭弹窗(P2 新增)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            if (!lastMessage || lastMessage === lastWsRef.current) return;
            lastWsRef.current = lastMessage;
            const currentConv = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().conversationId;
            // P2 多端同步:AI 主动提问(其他端收到 ai_question → 弹窗)
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAIQuestion"])(lastMessage)) {
                const { conversationId, question } = lastMessage.data;
                // 仅处理当前会话的事件(其他会话的提问不弹窗,避免干扰)
                if (conversationId && currentConv && conversationId !== currentConv) return;
                // 运行时 Zod 校验:WS payload 可能因客户端版本差异 / 中间件篡改而异常,
                // 校验失败时不弹窗(避免脏数据进 store 导致 UI 崩溃)
                const pending = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$pending$2d$question$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parsePendingQuestion"])(question);
                if (pending) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().setPendingQuestion(pending);
                }
                return;
            }
            // P2 多端同步:AI 提问已回答(其他端收到 chat_question_answered → 关闭弹窗)
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAIQuestionAnswered"])(lastMessage)) {
                const { conversationId, questionId } = lastMessage.data;
                if (conversationId && currentConv && conversationId !== currentConv) return;
                const pending = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().pendingQuestion;
                // 仅关闭匹配 questionId 的弹窗(避免误关其他提问)
                if (pending && pending.questionId === questionId) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().clearPendingQuestion();
                }
                return;
            }
            // AI 回复多端同步(原有逻辑)
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$api$2d$contracts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAIResponse"])(lastMessage)) return;
            const { conversationId, message, clientMessageId } = lastMessage.data;
            if (conversationId && currentConv && conversationId !== currentConv) return;
            if (message) {
                const store = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState();
                const placeholderId = clientMessageId !== null && clientMessageId !== void 0 ? clientMessageId : message.id;
                const existing = store.messages.find({
                    "AISidePanel.useEffect.existing": (m)=>m.id === placeholderId
                }["AISidePanel.useEffect.existing"]);
                if (existing) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                        messages: store.messages.map({
                            "AISidePanel.useEffect": (m)=>m.id === placeholderId ? {
                                    id: message.id,
                                    role: 'assistant',
                                    content: message.content,
                                    createdAt: message.createdAt ? new Date(message.createdAt).getTime() : m.createdAt,
                                    error: false
                                } : m
                        }["AISidePanel.useEffect"])
                    });
                } else if (message.role === 'assistant') {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                        messages: [
                            ...store.messages,
                            {
                                id: message.id,
                                role: 'assistant',
                                content: message.content,
                                createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now()
                            }
                        ]
                    });
                }
            }
        }
    }["AISidePanel.useEffect"], [
        lastMessage
    ]);
    const setConversationId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"])({
        "AISidePanel.useChatStore[setConversationId]": (s)=>s.setConversationId
    }["AISidePanel.useChatStore[setConversationId]"]);
    // 从 store 订阅当前会话(取代原 URL ?conversationId= 同步逻辑)
    const storeConversationId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"])({
        "AISidePanel.useChatStore[storeConversationId]": (s)=>s.conversationId
    }["AISidePanel.useChatStore[storeConversationId]"]);
    // 监听 store.conversationId 变化加载历史会话
    // (AI 面板是全局 docked 组件,与 Sidebar 同性质;不再依赖 URL ?conversationId=,
    // 会话 ID 完全由 useChatStore 维护,切换会话由历史项点击 / 新建对话 等动作触发)
    // #11 LRU 缓存(2026-07-25 立):
    // - 切换会话前:把旧会话的 messages + 分页状态存入 conversationCacheRef(LRU delete+set)
    // - 缓存命中:同步从缓存恢复 store.messages(无闪烁),后台异步拉取最新消息对比更新
    // - 缓存未命中:正常拉取,拉取后写入缓存
    // - LRU 淘汰:cache.size > 5 时删除最早(Map.keys().next().value)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            if (!open) return;
            // 切换会话前保存旧会话到缓存(LRU:delete + set 重新插入)
            const prevId = prevConversationIdRef.current;
            if (prevId && prevId !== storeConversationId) {
                const currentStore = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState();
                if (currentStore.messages.length > 0) {
                    conversationCacheRef.current.delete(prevId);
                    conversationCacheRef.current.set(prevId, {
                        messages: currentStore.messages,
                        hasMore: hasMoreHistory,
                        oldestCursor: oldestCursorRef.current
                    });
                    // LRU 淘汰:超过 5 个会话时删除最早使用的
                    while(conversationCacheRef.current.size > 5){
                        const oldestKey = conversationCacheRef.current.keys().next().value;
                        if (oldestKey) conversationCacheRef.current.delete(oldestKey);
                    }
                }
            }
            prevConversationIdRef.current = storeConversationId;
            let cancelled = false;
            async function loadHistory(id) {
                // 缓存命中:同步从缓存恢复(无闪烁),后台异步拉取最新消息对比更新
                const cached = conversationCacheRef.current.get(id);
                if (cached) {
                    // LRU 更新:delete + set 重新插入到末尾(最近使用)
                    conversationCacheRef.current.delete(id);
                    conversationCacheRef.current.set(id, cached);
                    // 同步填充 store(无 loading 状态,无闪烁)
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                        messages: cached.messages,
                        error: null
                    });
                    setHasMoreHistory(cached.hasMore);
                    oldestCursorRef.current = cached.oldestCursor;
                    setLoadingHistory(false);
                    // 后台异步拉取最新消息对比更新(不阻塞 UI,完成后覆盖缓存数据)
                    void ({
                        "AISidePanel.useEffect.loadHistory": async ()=>{
                            try {
                                const [convRes, msgRes] = await Promise.all([
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConversation"])(id),
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getMessages"])(id, {
                                        pageSize: 50
                                    })
                                ]);
                                if (cancelled) return;
                                if (convRes.success && msgRes.success) {
                                    const hydrated = msgRes.data.messages.map({
                                        "AISidePanel.useEffect.loadHistory.hydrated": (m)=>({
                                                id: m.id,
                                                role: m.role,
                                                content: m.content,
                                                createdAt: new Date(m.createdAt).getTime()
                                            })
                                    }["AISidePanel.useEffect.loadHistory.hydrated"]);
                                    // 仅当当前仍在该会话时才更新 store(避免覆盖用户已切换到的新会话)
                                    if (__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().conversationId === id) {
                                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                                            messages: hydrated,
                                            error: null
                                        });
                                        setConversationTitle(convRes.data.conversation.title || null);
                                        oldestCursorRef.current = msgRes.data.nextCursor;
                                        setHasMoreHistory(msgRes.data.hasMore);
                                    }
                                    // 更新缓存为最新数据
                                    conversationCacheRef.current.delete(id);
                                    conversationCacheRef.current.set(id, {
                                        messages: hydrated,
                                        hasMore: msgRes.data.hasMore,
                                        oldestCursor: msgRes.data.nextCursor
                                    });
                                    // 恢复挂起提问(从 metadata)
                                    const meta = convRes.data.conversation.metadata;
                                    const pending = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$pending$2d$question$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parsePendingQuestion"])(meta === null || meta === void 0 ? void 0 : meta.pendingQuestion);
                                    if (pending) {
                                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().setPendingQuestion(pending);
                                    } else {
                                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().clearPendingQuestion();
                                    }
                                }
                            } catch (e) {
                            // 后台拉取失败时保留缓存数据,不阻塞用户
                            }
                        }
                    })["AISidePanel.useEffect.loadHistory"]();
                    return;
                }
                // 缓存未命中:正常拉取
                setLoadingHistory(true);
                try {
                    // #8 分页加载:默认 page=1 返回最新 pageSize 条(后端 offset 模式按 desc + reverse)
                    const [convRes, msgRes] = await Promise.all([
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConversation"])(id),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getMessages"])(id, {
                            pageSize: 50
                        })
                    ]);
                    if (cancelled) return;
                    if (convRes.success && msgRes.success) {
                        const hydrated = msgRes.data.messages.map({
                            "AISidePanel.useEffect.loadHistory.hydrated": (m)=>({
                                    id: m.id,
                                    role: m.role,
                                    content: m.content,
                                    createdAt: new Date(m.createdAt).getTime()
                                })
                        }["AISidePanel.useEffect.loadHistory.hydrated"]);
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                            messages: hydrated,
                            error: null
                        });
                        setConversationTitle(convRes.data.conversation.title || null);
                        // 记录分页游标:oldestCursor = 当前最旧一条 id,hasMoreHistory = 是否还有更早历史
                        oldestCursorRef.current = msgRes.data.nextCursor;
                        setHasMoreHistory(msgRes.data.hasMore);
                        // 写入缓存(LRU:delete + set,淘汰超 5 个的最早会话)
                        conversationCacheRef.current.delete(id);
                        conversationCacheRef.current.set(id, {
                            messages: hydrated,
                            hasMore: msgRes.data.hasMore,
                            oldestCursor: msgRes.data.nextCursor
                        });
                        while(conversationCacheRef.current.size > 5){
                            const oldestKey = conversationCacheRef.current.keys().next().value;
                            if (oldestKey) conversationCacheRef.current.delete(oldestKey);
                        }
                        // P2 多端同步:从 conversation.metadata.pendingQuestion 恢复挂起状态
                        // 场景:用户 A 在 web 提问后刷新页面 / 切换会话再切回 / 在其他端打开同一会话
                        // 后端 /chat/questions 已把 pendingQuestion 写入 conversation.metadata(merge 模式)
                        // 这里读取并还原弹窗,让用户能继续回答(不丢失挂起态)
                        //
                        // 运行时 Zod 校验:防止 DB metadata 被其他端写入异常结构 / 被外部篡改 / 字段
                        // 类型不匹配导致前端崩溃。校验失败时降级为 clearPendingQuestion(不弹窗)。
                        const meta = convRes.data.conversation.metadata;
                        const pending = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$pending$2d$question$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parsePendingQuestion"])(meta === null || meta === void 0 ? void 0 : meta.pendingQuestion);
                        if (pending) {
                            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().setPendingQuestion(pending);
                        } else {
                            // 无挂起提问或数据非法时清空(避免上一会话的弹窗残留 / 脏数据崩溃)
                            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().clearPendingQuestion();
                        }
                    } else {
                        setConversationId(null);
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                            messages: [],
                            error: null
                        });
                        setConversationTitle(null);
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().clearPendingQuestion();
                    }
                } catch (e) {
                    if (!cancelled) {
                        setConversationId(null);
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                            messages: [],
                            error: null
                        });
                        setConversationTitle(null);
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().clearPendingQuestion();
                    }
                } finally{
                    if (!cancelled) setLoadingHistory(false);
                }
            }
            if (storeConversationId) {
                // 重置分页状态(防止上一会话的游标残留)
                oldestCursorRef.current = null;
                setHasMoreHistory(false);
                // 2026-07-27 修复 React Hydration 失败导致 AI 回复未渲染:
                // 原 chat.ts onRehydrateStorage 在 persist 初始化时同步把 recentMessages.messages
                // 赋给 state.messages,因 localStorage 同步 API,赋值发生在 React hydration 之前,
                // 导致 SSR(messages=[]) 与客户端 hydration(messages=50 条) 不一致 → hydration mismatch
                // → React 丢弃服务端 DOM 重建 → store 状态错乱 → onDelta 更新旧引用 → AI 回复不渲染。
                // 修复:onRehydrateStorage 移除 messages 赋值,改为此处 useEffect(hydration 后) 预填充。
                // 条件:仅当 messages 为空(首次加载/无缓存)且 recentMessages 匹配当前会话时预填充,
                // 避免覆盖缓存命中的数据(loadHistory 内部会先检查缓存)。
                const currentStore = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState();
                if (currentStore.messages.length === 0 && currentStore.recentMessages && currentStore.recentMessages.conversationId === storeConversationId && Array.isArray(currentStore.recentMessages.messages)) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                        messages: currentStore.recentMessages.messages,
                        error: null
                    });
                }
                void loadHistory(storeConversationId);
            } else {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                    messages: [],
                    error: null
                });
                setConversationTitle(null);
                oldestCursorRef.current = null;
                setHasMoreHistory(false);
            }
            return ({
                "AISidePanel.useEffect": ()=>{
                    cancelled = true;
                }
            })["AISidePanel.useEffect"];
        // hasMoreHistory 用于切换会话前保存旧会话到缓存,但不放入依赖:
        // 避免 hasMoreHistory 变化触发 loadHistory 重载(分页加载由 handleLoadMoreHistory +
        // messages 同步 effect 处理缓存更新)
        }
    }["AISidePanel.useEffect"], [
        storeConversationId,
        setConversationId,
        open
    ]); // eslint-disable-line react-hooks/exhaustive-deps -- hasMoreHistory 故意不放入依赖,避免其变化触发 loadHistory 重载
    // #11 LRU 缓存同步(2026-07-25 立):
    // messages 变化时(用户发送新消息、收到 AI 回复、流式增量、WebSocket 多端同步等)
    // 同步更新当前会话缓存的 messages + 分页状态,确保下次切回时数据是最新的。
    // hasMoreHistory 变化时也同步(分页加载在 handleLoadMoreHistory 已单独处理,此处兜底)。
    // messages 从 useChatStore.getState() 获取最新值(避免闭包陈旧值),但依赖数组
    // 仍需包含 messages 以触发 effect(组件重渲染时 messages 引用变化触发依赖)。
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            if (!storeConversationId) return;
            const cached = conversationCacheRef.current.get(storeConversationId);
            if (!cached) return;
            const currentMsgs = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().messages;
            // 引用相同则跳过(避免无变化时重复写入)
            if (cached.messages === currentMsgs) return;
            cached.messages = currentMsgs;
            cached.hasMore = hasMoreHistory;
            cached.oldestCursor = oldestCursorRef.current;
        }
    }["AISidePanel.useEffect"], [
        storeConversationId,
        messages,
        hasMoreHistory
    ]);
    // #8 滚动到顶部加载更多历史消息(before 游标分页)
    // - 由 MessageList 在 scrollTop 接近 0 时触发
    // - 加载完成后 prepend 到 messages 头部,并保持视觉滚动位置(由 MessageList 内部处理)
    const handleLoadMoreHistory = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AISidePanel.useCallback[handleLoadMoreHistory]": async ()=>{
            const convId = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().conversationId;
            const cursor = oldestCursorRef.current;
            if (!convId || !cursor || loadingMoreHistory || !hasMoreHistory) return;
            setLoadingMoreHistory(true);
            try {
                const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getMessages"])(convId, {
                    before: cursor,
                    pageSize: 50
                });
                if (!res.success) return;
                const older = res.data.messages.map({
                    "AISidePanel.useCallback[handleLoadMoreHistory].older": (m)=>({
                            id: m.id,
                            role: m.role,
                            content: m.content,
                            createdAt: new Date(m.createdAt).getTime()
                        })
                }["AISidePanel.useCallback[handleLoadMoreHistory].older"]);
                if (older.length === 0) {
                    setHasMoreHistory(false);
                    oldestCursorRef.current = null;
                    return;
                }
                // prepend 到 messages 头部(时间正序,older 也是正序且早于当前所有消息)
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                    "AISidePanel.useCallback[handleLoadMoreHistory]": (s)=>({
                            messages: [
                                ...older,
                                ...s.messages
                            ]
                        })
                }["AISidePanel.useCallback[handleLoadMoreHistory]"]);
                oldestCursorRef.current = res.data.nextCursor;
                setHasMoreHistory(res.data.hasMore);
                // #11 LRU 缓存同步(2026-07-25 立):分页加载更多后,更新缓存的 messages + oldestCursor + hasMore
                const cached = conversationCacheRef.current.get(convId);
                if (cached) {
                    cached.messages = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].getState().messages;
                    cached.oldestCursor = res.data.nextCursor;
                    cached.hasMore = res.data.hasMore;
                }
            } finally{
                setLoadingMoreHistory(false);
            }
        }
    }["AISidePanel.useCallback[handleLoadMoreHistory]"], [
        loadingMoreHistory,
        hasMoreHistory
    ]);
    const handleNewChat = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AISidePanel.useCallback[handleNewChat]": ()=>{
            clearMessages();
            setConversationId(null);
            setConversationTitle(null);
            oldestCursorRef.current = null;
            setHasMoreHistory(false);
        }
    }["AISidePanel.useCallback[handleNewChat]"], [
        clearMessages,
        setConversationId
    ]);
    var _activeWorkspace_name, _ref, _ref1;
    // 标题显示优先级(用户规则):
    //   1. 用户在 AI 面板手动添加的本地工作区 → 显示 workspace.name(参考 Trae/Codex 顶部 project selector)
    //   2. workspace 项目页 → 显示项目文件夹名(选择项目文件时显示项目文件夹名)
    //   3. 已加载任务 → 显示任务名称(只是单纯对话时显示对话任务命名)
    //   4. 兜底 → 显示"空工作区"(没有选择项目时显示空工作区)
    const displayTitle = (_ref1 = (_ref = (_activeWorkspace_name = activeWorkspace === null || activeWorkspace === void 0 ? void 0 : activeWorkspace.name) !== null && _activeWorkspace_name !== void 0 ? _activeWorkspace_name : workspaceName) !== null && _ref !== void 0 ? _ref : conversationTitle) !== null && _ref1 !== void 0 ? _ref1 : tc('emptyWorkspace');
    // 全局快捷键 Ctrl+Shift+N:新建任务
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            if (!open) return;
            const onNewChat = {
                "AISidePanel.useEffect.onNewChat": ()=>handleNewChat()
            }["AISidePanel.useEffect.onNewChat"];
            window.addEventListener('global-shortcut:new-chat', onNewChat);
            return ({
                "AISidePanel.useEffect": ()=>window.removeEventListener('global-shortcut:new-chat', onNewChat)
            })["AISidePanel.useEffect"];
        }
    }["AISidePanel.useEffect"], [
        handleNewChat,
        open
    ]);
    // Alt+P / Option+P 快捷键:切换 Plan/Act 模式(2026-07-25 立,对标 Trae SOLO Plan 快捷键)
    // 2026-07-28 升级:Plan/Act 概念合并到 ChatMode,Alt+P 改为在 ChatMode.plan ↔ ChatMode.build 间切换
    // - 仅当 AI 面板打开时生效,避免污染其他页面
    // - 不在输入框聚焦时触发(避免与 Alt+字母 输入特殊字符冲突)
    // - 与 /plan /act 斜杠命令联动(两入口都走 ChatMode)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            if (!open) return;
            const onAltP = {
                "AISidePanel.useEffect.onAltP": (e)=>{
                    if (!e.altKey || e.key !== 'p' || e.ctrlKey || e.metaKey || e.shiftKey) return;
                    // 避免在 textarea/input 聚焦时触发(用户可能用 Alt 组合输入特殊字符)
                    const target = e.target;
                    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) {
                        return;
                    }
                    e.preventDefault();
                    // ChatMode:plan ↔ build 切换(语义对齐:plan=只读分析,build=正常执行)
                    const next = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModeStore"].getState().currentMode === 'plan' ? 'build' : 'plan';
                    __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModeStore"].getState().setMode(next);
                }
            }["AISidePanel.useEffect.onAltP"];
            window.addEventListener('keydown', onAltP);
            return ({
                "AISidePanel.useEffect": ()=>window.removeEventListener('keydown', onAltP)
            })["AISidePanel.useEffect"];
        }
    }["AISidePanel.useEffect"], [
        open
    ]);
    // Ctrl+1/2/3/4 切换 ChatMode 4态(2026-07-28 立,补全三通道)
    // - 仅当 AI 面板打开时生效,避免污染其他页面
    // - Ctrl+数字 不与打字冲突,故无需排除 textarea/input 聚焦场景
    // - 与 /build /plan /review /spec 斜杠命令 + AI 自动判断三入口联动
    //   (2026-07-28 移除 4 按钮后,4 按钮入口废弃,保留 /命令 + Ctrl 快捷键 + AI 自动判断)
    // - Ctrl+数字 在浏览器默认切换 tab,需 preventDefault 阻止
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AISidePanel.useEffect": ()=>{
            if (!open) return;
            const onModeShortcut = {
                "AISidePanel.useEffect.onModeShortcut": (e)=>{
                    // 仅匹配纯 Ctrl+数字(排除 Shift/Alt/Meta 组合,避免与浏览器其他快捷键冲突)
                    if (!e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
                    const keyMap = {
                        '1': 'build',
                        '2': 'plan',
                        '3': 'review',
                        '4': 'spec'
                    };
                    const target = keyMap[e.key];
                    if (!target) return;
                    e.preventDefault();
                    const labelMap = {
                        build: t('modeBuild'),
                        plan: t('modePlan'),
                        review: t('modeReview'),
                        spec: t('modeSpec')
                    };
                    const label = labelMap[target];
                    const modeStore = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModeStore"].getState();
                    if (modeStore.currentMode === target) {
                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(t('modeAlreadyActive', {
                            mode: label
                        }));
                        return;
                    }
                    modeStore.setMode(target);
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sonner$40$2$2e$0$2e$7_react$2d$dom$40$19$2e$0$2e$0_react$40$19$2e$0$2e$0_$5f$react$40$19$2e$0$2e$0$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(t('modeSwitched', {
                        mode: label
                    }));
                }
            }["AISidePanel.useEffect.onModeShortcut"];
            window.addEventListener('keydown', onModeShortcut);
            return ({
                "AISidePanel.useEffect": ()=>window.removeEventListener('keydown', onModeShortcut)
            })["AISidePanel.useEffect"];
        }
    }["AISidePanel.useEffect"], [
        open,
        t
    ]);
    // 拖拽调整宽度
    // 关闭态下拖拽手柄:先 openPanel 再开始 resize,实现"拖拽即打开"
    const handleResizeStart = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AISidePanel.useCallback[handleResizeStart]": (e)=>{
            e.preventDefault();
            const store = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState();
            if (!store.open) {
                store.openPanel();
            }
            setResizing(true);
            const startX = e.clientX;
            const startWidth = store.width;
            const onMove = {
                "AISidePanel.useCallback[handleResizeStart].onMove": (ev)=>{
                    const delta = ev.clientX - startX;
                    setWidth(startWidth + delta);
                }
            }["AISidePanel.useCallback[handleResizeStart].onMove"];
            const onUp = {
                "AISidePanel.useCallback[handleResizeStart].onUp": ()=>{
                    setResizing(false);
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                }
            }["AISidePanel.useCallback[handleResizeStart].onUp"];
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        }
    }["AISidePanel.useCallback[handleResizeStart]"], [
        setResizing,
        setWidth
    ]);
    // ==================== 浮窗拖拽逻辑(2026-07-30)====================
    // 浮窗模式下面板 position:fixed,通过 header 拖拽改变 floatPosition。
    // 使用 ref 记录拖拽起始坐标,pointermove 更新 store,pointerup 清理监听。
    const floatDragStart = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const handleFloatDragStart = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AISidePanel.useCallback[handleFloatDragStart]": (e)=>{
            if (!floatMode || floatMinimized) return;
            // 只响应左键 + 拖拽区域(不是按钮)
            const target = e.target;
            if (target.closest('button, a, input, textarea, select')) return;
            e.preventDefault();
            const startX = floatPosition.x < 0 ? window.innerWidth - width - 24 : floatPosition.x;
            const startY = floatPosition.y < 0 ? 8 : floatPosition.y;
            floatDragStart.current = {
                x: startX,
                y: startY,
                px: e.clientX,
                py: e.clientY
            };
            const onMove = {
                "AISidePanel.useCallback[handleFloatDragStart].onMove": (ev)=>{
                    if (!floatDragStart.current) return;
                    const dx = ev.clientX - floatDragStart.current.px;
                    const dy = ev.clientY - floatDragStart.current.py;
                    const newX = Math.max(8, Math.min(window.innerWidth - width - 8, floatDragStart.current.x + dx));
                    const newY = Math.max(8, Math.min(window.innerHeight - 120, floatDragStart.current.y + dy));
                    setFloatPosition({
                        x: newX,
                        y: newY
                    });
                }
            }["AISidePanel.useCallback[handleFloatDragStart].onMove"];
            const onUp = {
                "AISidePanel.useCallback[handleFloatDragStart].onUp": ()=>{
                    floatDragStart.current = null;
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                }
            }["AISidePanel.useCallback[handleFloatDragStart].onUp"];
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        }
    }["AISidePanel.useCallback[handleFloatDragStart]"], [
        floatMode,
        floatMinimized,
        floatPosition,
        width,
        setFloatPosition
    ]);
    // 性能修复(2026-07-25):WorkspaceNameSync 子组件渲染 null,内部订阅 usePathname,
    // 把项目名通过 onNameChange callback 回传给父组件(setWorkspaceName)。
    // pathname 变化只触发子组件重渲染,不触发 AISidePanel 根重渲染。
    const workspaceNameSync = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WorkspaceNameSync, {
        onNameChange: setWorkspaceName
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
        lineNumber: 634,
        columnNumber: 29
    }, this);
    // 浮窗最小化态(或浮窗模式 + 面板关闭):渲染 FAB 按钮
    if (floatMode && (floatMinimized || !open)) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                workspaceNameSync,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    onClick: ()=>{
                        setFloatMinimized(false);
                        setFloatCollapsed(false);
                        openPanel();
                    },
                    "aria-label": tc('title'),
                    className: "fixed z-sticky flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card shadow-lg transition-all hover:scale-105 hover:shadow-xl",
                    style: {
                        left: floatPosition.x < 0 ? 'auto' : "".concat(floatPosition.x, "px"),
                        right: floatPosition.x < 0 ? '24px' : 'auto',
                        top: floatPosition.y < 0 ? '8px' : "".concat(floatPosition.y, "px")
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$brand$2d$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BrandIcon"], {
                        vendor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$brand$2d$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inferVendor"])(currentModel),
                        size: 22,
                        className: "text-primary"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                        lineNumber: 656,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                    lineNumber: 641,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true);
    }
    // 浮窗折叠态:只显示输入框 + 展开按钮,点击展开拉出完整面板
    // 用户交互:Pin → 折叠态(只看输入框)→ 点击展开 → 完整面板(对话历史+header)
    // 2026-07-30:工具条与输入卡片融合(共享 border + bg-card),不再占独立行;
    // 按钮无额外 px,左间距 = 容器 px-1.5(6px)= 上下 py-1.5(6px),四向一致。
    if (floatMode && floatCollapsed) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                workspaceNameSync,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    "data-testid": "ai-panel-root",
                    className: "ai-panel-root fixed z-sticky ai-float-glow rounded-xl",
                    style: {
                        width,
                        left: floatPosition.x < 0 ? 'auto' : "".concat(floatPosition.x, "px"),
                        right: floatPosition.x < 0 ? '24px' : 'auto',
                        top: floatPosition.y < 0 ? '8px' : "".concat(floatPosition.y, "px")
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                        "aria-label": tc('title'),
                        className: "flex flex-col overflow-hidden rounded-xl bg-shell-panel",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$message$2d$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MessageInput"], {
                            onSend: sendMessage,
                            onStop: stop,
                            isStreaming: isStreaming,
                            placeholder: currentMode === 'plan' ? t('placeholderPlan') : t('placeholder'),
                            sendLabel: t('send'),
                            stopLabel: t('stop'),
                            model: currentModel,
                            onModelChange: setModel,
                            modelLabel: t('model'),
                            onFloatDragStart: handleFloatDragStart,
                            onTriggerClick: ()=>setFloatCollapsed(false),
                            floatHeader: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setFloatCollapsed(false),
                                        "aria-label": tc('floatMode'),
                                        className: "ml-auto inline-flex items-center gap-1.5 rounded-md py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUp$3e$__["ChevronUp"], {
                                                className: "h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 706,
                                                columnNumber: 21
                                            }, void 0),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: tc('floatMode')
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 707,
                                                columnNumber: 21
                                            }, void 0)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 700,
                                        columnNumber: 19
                                    }, void 0),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                        content: tc('dockPanel'),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>{
                                                setFloatMode(false);
                                                setFloatCollapsed(false);
                                            },
                                            "aria-label": tc('dockPanel'),
                                            className: "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeft$3e$__["PanelLeft"], {
                                                className: "h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 719,
                                                columnNumber: 23
                                            }, void 0)
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                            lineNumber: 710,
                                            columnNumber: 21
                                        }, void 0)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 709,
                                        columnNumber: 19
                                    }, void 0),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                        content: tc('minimize'),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setFloatMinimized(true),
                                            "aria-label": tc('minimize'),
                                            className: "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$minus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Minus$3e$__["Minus"], {
                                                className: "h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 729,
                                                columnNumber: 23
                                            }, void 0)
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                            lineNumber: 723,
                                            columnNumber: 21
                                        }, void 0)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 722,
                                        columnNumber: 19
                                    }, void 0)
                                ]
                            }, void 0, true)
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                            lineNumber: 686,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                        lineNumber: 680,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                    lineNumber: 670,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true);
    }
    // 关闭态:仅渲染拖拽手柄(可拖拽打开),不渲染整个面板内容。
    // 2026-07-30 彻底根治:容器从 fixed 改为 flex 子元素(relative + shrink-0),
    // width:0 使容器在 flex 流中不占视觉空间;手柄 right-[-12px] 跨越容器右边缘 8px 命中。
    // py-2 与 MainShell 的 pt-2/mb-2 垂直对齐(8px 上下间距)。
    // 2026-07-31 移动端适配:加 hidden lg:block 让 docked 关闭态(手柄)在 < 1024px 隐藏,
    // 避免 AISidePanel 在 mobile 视口下占 400px 宽把 work-area 推到 viewport 外。
    // mobile 下 AI 面板入口改用浮窗 FAB(由 floatMode 路径独立渲染,不受此规则影响)。
    if (!open) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                workspaceNameSync,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative hidden h-full shrink-0 py-2 lg:block",
                    style: {
                        width: 0
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        onPointerDown: handleResizeStart,
                        tabIndex: 0,
                        role: "separator",
                        "aria-orientation": "vertical",
                        "aria-label": tcommon('resize'),
                        className: "group absolute right-[-12px] top-3 bottom-3 z-20 w-2 cursor-col-resize outline-none",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line', isResizing && 'is-resizing')
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 773,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                "aria-hidden": "true",
                                className: "ai-panel-handle-tooltip",
                                children: tc('handleHint')
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 784,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                        lineNumber: 765,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                    lineNumber: 752,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            workspaceNameSync,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                // AI 面板容器(最外层,DevTools 可选中)
                // - docked 模式:relative + shrink-0 + py-2,flex 流内布局,mr-1.5 固定 6px 间距
                // - float 模式:fixed 定位,z-sticky,可拖拽,品牌色微光浮窗视觉(ai-float-glow)
                //   rounded-xl 匹配内层 aside 圆角(光晕跟随圆角呈圆弧),去掉 py-2(浮窗无需上下间距)
                // data-testid="ai-panel-root":全局唯一最外层容器标识,DevTools / E2E 可直接选中
                // 2026-07-31 移动端适配(根治):docked 模式加 hidden lg:block,
                // 避免 AISidePanel 在 mobile 视口(< 1024px)下占 400px 宽把 work-area 推到 viewport 外,
                // 导致 mobile button (x=406) 在 iPhone 14 (390px) 视口外不可见。
                // mobile 下 AI 面板入口改用浮窗 FAB(floatMode 路径独立渲染,不受此规则影响)。
                "data-testid": "ai-panel-root",
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('ai-panel-root', floatMode ? 'fixed z-sticky ai-float-glow rounded-xl' : 'relative hidden h-full shrink-0 lg:block mr-1.5 py-2'),
                style: floatMode ? {
                    width,
                    left: floatPosition.x < 0 ? 'auto' : "".concat(floatPosition.x, "px"),
                    right: floatPosition.x < 0 ? '24px' : 'auto',
                    top: floatPosition.y < 0 ? '8px' : "".concat(floatPosition.y, "px"),
                    height: 'min(600px, calc(100vh - 100px))',
                    transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)'
                } : {
                    width,
                    transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                        "aria-label": tc('title'),
                        // Pane 默认锚点(2026-07-29 立):AgentTaskProgressPane 用这个 data-testid 找到 AI 面板容器
                        // 作为 Pane 默认位置的视口坐标系锚点,空消息时也能定位(不再依赖 message-list-inline-panel)
                        "data-testid": "ai-side-panel-aside",
                        // AI 面板必须有独立 bg-shell-panel 背景:
                        // 1) 卡片感:AI 面板作为独立 flex 子元素,需要自己的背景色形成卡片视觉边界;
                        // 2) 暗色模式下的遮罩一致性:登录/SSO/认证授权弹窗打开时,z-modal=2000 遮罩(z-50 Dialog 也会盖)叠加在 AI 面板之上,
                        //    若 AI 面板透明,内容透到变暗的 work-area 上,视觉上像"AI 面板高亮"未被遮罩盖住;有 bg-shell-panel 后,
                        //    AI 面板背景独立变暗,真正"暗下去到背景里"。
                        // 之前 commit 5d378c22e 担心"深色背景下默认滚动条轨道透出深色",但 message-list 已加 hover-scroll
                        // (scrollbar-width: none + ::-webkit-scrollbar { display: none })完全隐藏滚动条,不会透色,
                        // 恢复 bg-shell-panel 安全。
                        className: "flex h-full flex-col overflow-hidden rounded-xl bg-shell-panel",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                                onPointerDown: floatMode ? handleFloatDragStart : undefined,
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex h-14 shrink-0 items-center gap-2 px-3', // 2026-07-19 中文 + 图标垂直对齐:主标题 span 视觉居中
                                '[&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]', // 浮窗模式:header 可拖拽,非交互区域 cursor-move
                                floatMode && 'cursor-move'),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex h-8 w-8 items-center justify-center rounded-lg text-foreground/80",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$brand$2d$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BrandIcon"], {
                                            vendor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$brand$2d$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inferVendor"])(currentModel),
                                            size: 18,
                                            className: "text-foreground/80"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                            lineNumber: 856,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 855,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex min-w-0 flex-1 items-center gap-1 overflow-hidden",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "flex min-w-0 items-center gap-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "whitespace-nowrap text-sm font-semibold",
                                                    children: displayTitle
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                    lineNumber: 864,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$workspace$2d$selector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WorkspaceSelector"], {}, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                    lineNumber: 867,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                            lineNumber: 863,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 862,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                        content: tc('newConversation'),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: handleNewChat,
                                            disabled: isStreaming,
                                            "aria-label": tc('newConversation'),
                                            className: "inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                className: "h-4 w-4"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 887,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                            lineNumber: 880,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 879,
                                        columnNumber: 13
                                    }, this),
                                    floatMode ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                                content: tc('dockPanel'),
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>{
                                                        setFloatMode(false);
                                                        setFloatMinimized(false);
                                                    },
                                                    "aria-label": tc('dockPanel'),
                                                    className: "inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeft$3e$__["PanelLeft"], {
                                                        className: "h-4 w-4"
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                        lineNumber: 909,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                    lineNumber: 900,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 899,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                                content: tc('minimize'),
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>setFloatMinimized(true),
                                                    "aria-label": tc('minimize'),
                                                    className: "inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$minus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Minus$3e$__["Minus"], {
                                                        className: "h-4 w-4"
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                        lineNumber: 919,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                    lineNumber: 913,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 912,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                        content: tc('floatMode'),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>{
                                                setFloatMode(true);
                                                setFloatMinimized(false);
                                                setFloatCollapsed(true);
                                                openPanel();
                                            },
                                            "aria-label": tc('floatMode'),
                                            className: "inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pin$3e$__["Pin"], {
                                                className: "h-4 w-4"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 936,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                            lineNumber: 925,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 924,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$feedback$2f$Tooltip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                        content: tcommon('close'),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: closePanel,
                                            "aria-label": tcommon('close'),
                                            className: "inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                className: "h-4 w-4"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                                lineNumber: 947,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                            lineNumber: 941,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 940,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 842,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative min-h-0 flex-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$message$2d$list$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MessageList"], {
                                        messages: messages,
                                        isStreaming: isStreaming,
                                        isLoading: loadingHistory,
                                        emptyTitle: t('empty'),
                                        emptyHint: t('emptyHint'),
                                        assistantLabel: t('assistant'),
                                        loadingLabel: t('loading'),
                                        hasMoreHistory: hasMoreHistory,
                                        loadingMoreHistory: loadingMoreHistory,
                                        onLoadMoreHistory: handleLoadMoreHistory,
                                        onTemplateSelect: (content)=>{
                                            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"].setState({
                                                draftInput: content
                                            });
                                        },
                                        // Phase 18.2: 传递 subAgentActivities 到 MessageList,
                                        // Trae Work 风格 inline 渲染在最后一条 AI 消息下方(而非 AI 面板底部)
                                        subAgentActivities: subAgentActivities,
                                        // Phase 18.4: step budget(从 store 派生,目前用固定 60 上限)
                                        stepBudget: subAgentActivities.length > 0 ? {
                                            used: subAgentActivities.reduce((sum, a)=>sum + a.completedSteps.length, 0),
                                            total: 60
                                        } : undefined
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 954,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$agent$2d$task$2d$progress$2d$pane$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AgentTaskProgressPane"], {}, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                        lineNumber: 983,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 953,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$message$2d$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MessageInput"], {
                                onSend: sendMessage,
                                onStop: stop,
                                isStreaming: isStreaming,
                                // 2026-07-28 升级:placeholder 切换依据从 planMode 改为 ChatMode
                                // - ChatMode.plan → placeholderPlan(只读分析提示)
                                // - 其他(build/review/spec)→ placeholder(默认)
                                placeholder: currentMode === 'plan' ? t('placeholderPlan') : t('placeholder'),
                                sendLabel: t('send'),
                                stopLabel: t('stop'),
                                model: currentModel,
                                onModelChange: setModel,
                                modelLabel: t('model')
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 991,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$chat$2f$question$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["QuestionDialog"], {
                                question: pendingQuestion,
                                onSubmit: sendAnswer,
                                onSkip: skipQuestion
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 1007,
                                columnNumber: 11
                            }, this),
                            pendingPermissionSetup && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$workspace$2f$workspace$2d$permission$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WorkspacePermissionDialog"], {
                                open: !!pendingPermissionSetup,
                                onOpenChange: (open)=>{
                                    if (!open) setPendingPermissionSetup(null);
                                },
                                workspacePath: pendingPermissionSetup.path,
                                workspaceName: pendingPermissionSetup.name,
                                techStack: pendingPermissionSetup.techStack,
                                onSaved: (perm)=>{
                                    // 弹窗保存成功:回写 store.activeWorkspace.mode(已绑定 workspace 的 mode)
                                    if (activeWorkspace && activeWorkspace.path === perm.workspacePath) {
                                        setActiveWorkspace({
                                            ...activeWorkspace,
                                            mode: perm.mode
                                        });
                                    }
                                    setPendingPermissionSetup(null);
                                }
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 1013,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                        lineNumber: 826,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        onPointerDown: handleResizeStart,
                        tabIndex: 0,
                        role: "separator",
                        "aria-orientation": "vertical",
                        "aria-label": tcommon('resize'),
                        className: "group absolute right-[-4px] top-3 bottom-3 z-20 w-2 cursor-col-resize outline-none",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line', isResizing && 'is-resizing')
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 1044,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                "aria-hidden": "true",
                                className: "ai-panel-resize-tooltip",
                                children: tc('resizeHandleHint')
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                                lineNumber: 1054,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                        lineNumber: 1036,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/ai-side-panel.tsx",
                lineNumber: 796,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_s(AISidePanel, "36gjA2u11J5NnYJ1aAM0mVqcGJ4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChat"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$mode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModeStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$websocket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useWebSocket"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"]
    ];
});
_c = AISidePanel;
/**
 * WorkspaceNameSync 子组件(性能修复 2026-07-25)。
 *
 * 设计目的:把 usePathname 订阅从 AISidePanel 根下推到本子组件,
 * 避免每次路由切换 AISidePanel 整树重渲染(连带 MessageList /
 * MessageInput / ModelSelector 等重渲染)。
 *
 * - 内部订阅 usePathname + useEffect 拉取 workspace 项目名
 * - 通过 onNameChange callback 回传给父组件(setWorkspaceName)
 * - 渲染 null,无视觉开销
 * - 若 activeWorkspace 已绑定则跳过拉取(原逻辑保留)
 */ function WorkspaceNameSync(param) {
    let { onNameChange } = param;
    _s1();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "WorkspaceNameSync.useEffect": ()=>{
            if (!pathname) {
                onNameChange(null);
                return;
            }
            const m = pathname.match(/^\/workspace\/([^/]+)/);
            if (!m) {
                onNameChange(null);
                return;
            }
            // activeWorkspace 已绑定时跳过 URL 项目名拉取,避免无谓网络请求
            if (__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$ai$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAiPanelStore"].getState().activeWorkspace) {
                return;
            }
            const projectId = m[1];
            let cancelled = false;
            void ({
                "WorkspaceNameSync.useEffect": async ()=>{
                    try {
                        var _res_data_project, _res_data;
                        const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["fetchApi"])("/api/workspace/projects/".concat(encodeURIComponent(projectId)));
                        if (cancelled) return;
                        if (res.success && ((_res_data = res.data) === null || _res_data === void 0 ? void 0 : (_res_data_project = _res_data.project) === null || _res_data_project === void 0 ? void 0 : _res_data_project.name)) {
                            onNameChange(res.data.project.name);
                        } else {
                            onNameChange(null);
                        }
                    } catch (e) {
                        if (!cancelled) onNameChange(null);
                    }
                }
            })["WorkspaceNameSync.useEffect"]();
            return ({
                "WorkspaceNameSync.useEffect": ()=>{
                    cancelled = true;
                }
            })["WorkspaceNameSync.useEffect"];
        }
    }["WorkspaceNameSync.useEffect"], [
        pathname,
        onNameChange
    ]);
    return null;
}
_s1(WorkspaceNameSync, "V/ldUoOTYUs0Cb2F6bbxKSn7KxI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c1 = WorkspaceNameSync;
const __TURBOPACK__default__export__ = AISidePanel;
var _c, _c1;
__turbopack_context__.k.register(_c, "AISidePanel");
__turbopack_context__.k.register(_c1, "WorkspaceNameSync");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=apps_web_src_components_ai_ai-side-panel_tsx_e1c8bb22._.js.map