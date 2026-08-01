(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AgentTaskProgressPane",
    ()=>AgentTaskProgressPane,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pin$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pin.js [app-client] (ecmascript) <export default as Pin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pin$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PinOff$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pin-off.js [app-client] (ecmascript) <export default as PinOff>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$minimize$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Minimize2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/minimize-2.js [app-client] (ecmascript) <export default as Minimize2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$maximize$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Maximize2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/maximize-2.js [app-client] (ecmascript) <export default as Maximize2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Circle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle.js [app-client] (ecmascript) <export default as Circle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$todo$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ListTodo$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/list-todo.js [app-client] (ecmascript) <export default as ListTodo>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/message-square.js [app-client] (ecmascript) <export default as MessageSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$tree$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ListTree$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/list-tree.js [app-client] (ecmascript) <export default as ListTree>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevrons$2d$up$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronsUpDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevrons-up-down.js [app-client] (ecmascript) <export default as ChevronsUpDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevrons$2d$down$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronsDownUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevrons-down-up.js [app-client] (ecmascript) <export default as ChevronsDownUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-down.js [app-client] (ecmascript) <export default as ArrowDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$help$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__HelpCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-help.js [app-client] (ecmascript) <export default as HelpCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$keyboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Keyboard$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/keyboard.js [app-client] (ecmascript) <export default as Keyboard>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$timer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Timer$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/timer.js [app-client] (ecmascript) <export default as Timer>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$grip$2d$vertical$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__GripVertical$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/grip-vertical.js [app-client] (ecmascript) <export default as GripVertical>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/lib/utils.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/design-tokens/src/cn.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-intl@3.26.5_next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1._l26yftrpqorr5u2bvptfdohmci/node_modules/next-intl/dist/index.react-client.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/agent-progress-pane.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/chat.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/progress-jump-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/stores/timeline-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$agent$2d$progress$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-agent-progress.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$hover$2d$preview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/use-hover-preview.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$foldable$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/foldable-section.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$thinking$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/thinking-section.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$tool$2d$calls$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/tool-calls-section.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$changes$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/changes-section.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$terminal$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/terminal-section.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$overview$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/overview-section.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$copy$2d$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/copy-button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$progress$2d$ring$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/progress-ring.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$connection$2d$status$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/connection-status.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$hover$2d$preview$2d$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/hover-preview-card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$batch$2d$header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/batch-header.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$checklist$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/checklist.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$resource$2d$budget$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/resource-budget.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$timeline$2d$tab$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/timeline-tab.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$sub$2d$agent$2d$task$2d$tree$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ai/progress-sections/sub-agent-task-tree.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
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
;
;
;
/**
 * AgentTaskProgressPane — AI 面板右上角的小 popover(2026-07-29 v18)
 *
 * v18 改动(用户规则:"这个展开态的容器怎么拖动不了了呢?之前不是支持的吗"
 * + "位置还是不对啊 应该偏下一些 现在都给顶部按钮都挡上了"):
 * - **删除 React Portal + paneAnchor state + MutationObserver + fallback selector**:
 *   v17 的 portal 方案有 3 大隐患全部命中 — ① querySelector 返回 3 个 ai-side-panel-container
 *   (AI 面板多次渲染 / StrictMode 双调用 / HMR 残留)导致 Pane 错挂到 (0, 0) 关闭态容器;
 *   ② Portal 实际行为在 Next.js streaming + Suspense 下不可靠,Pane.parentElement 在某时机是
 *   body 不是 ai-side-panel-container,right:8 错位;③ 双向 selector 强绑定 + 防御性 fallback
 *   反而把"应该不渲染"的边界情况勉强渲染了 — 看起来"在"实际位置永远错。v18 根除:
 *   Pane 改用 inline JSX,作为 aside inner div(react tree parent)的子元素渲染,
 *   DOM 父级 = CSS containing block = inner div,绝对定位天然正确,0 状态机可漂移。
 * - **恢复拖动功能**:v17 因为 v15 JS 坐标漂移 bug 把拖拽连根拔起,用户要求恢复。
 *   v18 用 **handle 元素 + 纯 DOM style.transform** 实现:
 *   ① 拖动只在 header 左侧 GripVertical 区域启动,onMouseDown 用 `closest('button')` 早退
 *      → 不会污染 tab 切换 / 展开全部 / 快捷键 / 置顶 / 最小化 按钮的 onClick 路径,
 *      解决 v13 "拖动状态机吞 click → minimize 按钮不好使"问题;
 *   ② 拖动过程中直接改 paneRef.current.style.transform,不走 setState → 不触发 React 重渲染
 *      → 不影响 MessageList / SubAgentTaskTree 等子组件性能;
 *   ③ 拖动结束后写 localStorage(`pane-drag-v18`),下次加载时从 dataset 恢复偏移,
 *      解决 v15 "用视口绝对坐标 → resize 后位置错"的根因(transform 是相对偏移,无视口依赖)。
 * - **位置调整**:positionStyle 仍是 `top: 8, right: 8`,但 Pane 现在是 aside inner div
 *   (top = header bottom = 56px)的子元素,绝对定位后 Pane 顶部在 viewport 64px
 *   (header 56 + 8 间距),正好避开 header 工具栏(用户规则"应该偏下一些 现在都给顶部按钮
 *   都挡上了")。Pane 高度由 `max-h-[60vh]` + flex 列布局控制,不会超出 inner div 范围。
 *
 * v17 历史(已废弃,保留注释便于追溯):用 React Portal 挂到 ai-side-panel-container +
 * 删除拖拽。根因 — portal target 多实例 + parentElement 在某些时机是 body 不是 container +
 * 双向 selector 强绑定易被破坏 → Pane 错位到 (0, 0) 关闭态容器或"啥都没了"。
 *
 * v15 历史(已废弃):用 React Portal + JS 视口坐标 + 500ms 轮询。根因 — JS 坐标在 React 时序下
 * 永远不稳定,反复出现位置漂移。
 *
 * v13 历史(已废弃):用 onMouseDown 拖拽状态机 + setState 触发 transform。
 * 根因 — setState 拖拽时整个 Pane 重渲染 + 500ms 内多次 setState 容易让 click 路径被吞。
 * v18 改用纯 DOM style.transform,不触发 React 重渲染,根除。
 */ // ─── 模块级常量(避免每次 render 创建新数组,打破 React.memo 优化) ─────
const EMPTY_TOOLS = Object.freeze([]);
/** 步骤预算上限(对标 Trae Work 60 step budget) */ const STEP_BUDGET_TOTAL = 60;
/** 时间窗匹配缓冲(避免边界跨越) */ const TOOL_TIME_WINDOW_TRAILING_MS = 5000;
const TOOL_TIME_WINDOW_LEADING_MS = 1000;
/** 每 step 默认预览的工具调用条数上限 */ const PREVIEW_TOOL_LIMIT = 4;
/**
 * v18:删除 v17 强绑定的 PANE_ANCHOR_SELECTOR / FALLBACK_SELECTOR — Pane 现在是 aside
 * inner div 的 React tree 子元素,DOM 父级 + CSS containing block 都由 React 渲染机制
 * 保证,不再需要 querySelector 双向绑定 selector。彻底根除"双向绑定漏改 → Pane 不渲染"
 * + "selector 找到错位置(关闭态容器 / 多次渲染残留)"的 bug 链。
 */ /** Skeleton 行数(v13:3 → 4,更符合常见 plan 步骤规模) */ const PLAN_SKELETON_ROWS = 4;
/** 完成态庆祝横幅显示时长 */ const CELEBRATION_DURATION_MS = 3000;
const SHORTCUT_GROUPS = [
    {
        i18nKey: 'shortcutsGroupNav',
        items: [
            {
                keys: '↑/↓',
                i18nKey: 'shortcutSectionNav'
            },
            {
                keys: 'Home/End',
                i18nKey: 'shortcutSectionFirstLast'
            }
        ]
    },
    {
        i18nKey: 'shortcutsGroupPane',
        items: [
            {
                keys: '?',
                i18nKey: 'shortcutShowHelp'
            },
            {
                keys: 'Esc',
                i18nKey: 'shortcutCloseHelp'
            }
        ]
    },
    {
        i18nKey: 'shortcutsGroupTrigger',
        items: [
            {
                keys: 'Ctrl+Shift+J',
                i18nKey: 'shortcutTogglePane'
            },
            {
                keys: '↑',
                i18nKey: 'shortcutOpenPane'
            }
        ]
    }
];
// ─── 状态图标映射 ────────────────────────────────────────────────────
const PLAN_ICON = {
    pending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Circle$3e$__["Circle"],
    in_progress: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"],
    completed: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"]
};
const PLAN_CLS = {
    pending: 'text-muted-foreground/60',
    in_progress: 'text-primary',
    completed: 'text-emerald-500'
};
// ─── Tab 切换按钮配置(模块级,避免打破 React.memo 优化) ───────────────
const TAB_BUTTONS = [
    {
        id: 'inline',
        i18nKey: 'tabInline',
        Icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"]
    },
    {
        id: 'timeline',
        i18nKey: 'tabTimeline',
        Icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$tree$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ListTree$3e$__["ListTree"]
    }
];
// ─── 单个 plan step 渲染(v13:i18n 化 hover 预览) ────────────────────
const PlanStepItem = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["memo"](_s(function PlanStepItem(param) {
    let { step, index, linkedMessageId, linkedMessagePreview, relatedTools, isHighlighted } = param;
    _s();
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"])('ai.pane');
    const anchorRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const Icon = PLAN_ICON[step.status];
    // ProgressJumpStore 接入点
    const setHoveredPlanStep = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "PlanStepItem.PlanStepItem.useProgressJumpStore[setHoveredPlanStep]": (s)=>s.setHoveredPlanStep
    }["PlanStepItem.PlanStepItem.useProgressJumpStore[setHoveredPlanStep]"]);
    const setHoveredMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "PlanStepItem.PlanStepItem.useProgressJumpStore[setHoveredMessage]": (s)=>s.setHoveredMessage
    }["PlanStepItem.PlanStepItem.useProgressJumpStore[setHoveredMessage]"]);
    const requestJumpToMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "PlanStepItem.PlanStepItem.useProgressJumpStore[requestJumpToMessage]": (s)=>s.requestJumpToMessage
    }["PlanStepItem.PlanStepItem.useProgressJumpStore[requestJumpToMessage]"]);
    const flashHighlight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "PlanStepItem.PlanStepItem.useProgressJumpStore[flashHighlight]": (s)=>s.flashHighlight
    }["PlanStepItem.PlanStepItem.useProgressJumpStore[flashHighlight]"]);
    const stepLabel = step.status === 'in_progress' ? t('stepInProgress', {
        n: index + 1,
        step: step.step
    }) : step.status === 'completed' ? t('stepCompleted', {
        n: index + 1,
        step: step.step
    }) : t('stepPending', {
        n: index + 1,
        step: step.step
    });
    // HoverPreviewCard 接入点:buildContent + useHoverPreview(250ms 延迟 / 100ms 关闭)
    const previewData = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "PlanStepItem.PlanStepItem.useMemo[previewData]": ()=>{
            if (step.status === 'pending' && !step.explanation && !linkedMessagePreview && relatedTools.length === 0) {
                return null;
            }
            return {
                step,
                index,
                linkedMessagePreview,
                relatedToolCount: relatedTools.length
            };
        }
    }["PlanStepItem.PlanStepItem.useMemo[previewData]"], [
        step,
        index,
        linkedMessagePreview,
        relatedTools.length
    ]);
    const buildPreviewContent = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "PlanStepItem.PlanStepItem.useCallback[buildPreviewContent]": (data)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[10px] text-muted-foreground/70",
                        children: t('previewStepNumberAndName', {
                            n: data.index + 1,
                            step: data.step.step
                        })
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 253,
                        columnNumber: 9
                    }, this),
                    data.step.explanation && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[10px] leading-relaxed text-muted-foreground/80",
                        children: data.step.explanation
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 257,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap gap-x-2 text-[10px] text-muted-foreground/60",
                        children: [
                            data.step.durationMs !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: t('previewDuration', {
                                    duration: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$foldable$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDuration"])(data.step.durationMs)
                                })
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 263,
                                columnNumber: 13
                            }, this),
                            data.step.tokenUsage !== undefined && data.step.tokenUsage > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: t('previewTokenK', {
                                    k: Math.round(data.step.tokenUsage / 1000)
                                })
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 266,
                                columnNumber: 13
                            }, this),
                            data.relatedToolCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: t('previewToolCalls', {
                                    n: data.relatedToolCount
                                })
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 269,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 261,
                        columnNumber: 9
                    }, this),
                    data.linkedMessagePreview && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "border-t border-border/40 pt-1 text-[10px] text-muted-foreground/60",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-medium text-foreground/70",
                                children: t('previewRelatedMessage')
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 274,
                                columnNumber: 13
                            }, this),
                            ' ',
                            data.linkedMessagePreview
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 273,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 252,
                columnNumber: 7
            }, this)
    }["PlanStepItem.PlanStepItem.useCallback[buildPreviewContent]"], [
        t
    ]);
    const { visible, position, content, hoverHandlers } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$hover$2d$preview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useHoverPreview"])({
        buildContent: buildPreviewContent,
        // anchorRef 类型兼容:useHoverPreview 期望 RefObject<HTMLElement>,实际是 HTMLDivElement
        anchorRef: anchorRef,
        data: previewData,
        delayMs: 250,
        closeDelayMs: 100
    });
    // 点击跳转接入点
    const onClick = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "PlanStepItem.PlanStepItem.useCallback[onClick]": ()=>{
            if (!linkedMessageId) return;
            requestJumpToMessage(linkedMessageId);
            flashHighlight(linkedMessageId);
            // 最佳努力滚动:用 data-message-id 选择器(若 MessageList 加上即可工作)
            const el = document.querySelector('[data-message-id="'.concat(linkedMessageId, '"]'));
            if (el) el.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            // 派发自定义事件,MessageList 未来监听可响应
            window.dispatchEvent(new CustomEvent('ihui:scroll-to-message', {
                detail: {
                    messageId: linkedMessageId
                }
            }));
        }
    }["PlanStepItem.PlanStepItem.useCallback[onClick]"], [
        linkedMessageId,
        requestJumpToMessage,
        flashHighlight
    ]);
    // 鼠标 hover 接入点:同步 store(setHoveredPlanStep + setHoveredMessage)
    const onMouseEnter = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "PlanStepItem.PlanStepItem.useCallback[onMouseEnter]": (e)=>{
            hoverHandlers.onMouseEnter(e);
            setHoveredPlanStep(step.id);
            if (linkedMessageId) setHoveredMessage(linkedMessageId);
        }
    }["PlanStepItem.PlanStepItem.useCallback[onMouseEnter]"], [
        hoverHandlers,
        setHoveredPlanStep,
        setHoveredMessage,
        step.id,
        linkedMessageId
    ]);
    const onMouseLeave = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "PlanStepItem.PlanStepItem.useCallback[onMouseLeave]": (e)=>{
            hoverHandlers.onMouseLeave(e);
            setHoveredPlanStep(null);
            setHoveredMessage(null);
        }
    }["PlanStepItem.PlanStepItem.useCallback[onMouseLeave]"], [
        hoverHandlers,
        setHoveredPlanStep,
        setHoveredMessage
    ]);
    // 键盘无障碍:Enter / Space 触发跳转(满足 jsx-a11y/click-events-have-key-events)
    const onKeyDown = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "PlanStepItem.PlanStepItem.useCallback[onKeyDown]": (e)=>{
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        }
    }["PlanStepItem.PlanStepItem.useCallback[onKeyDown]"], [
        onClick
    ]);
    // 步骤关联工具调用的精简 Checklist(仅 in_progress 时显示,避免噪声)
    const checklistItems = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "PlanStepItem.PlanStepItem.useMemo[checklistItems]": ()=>{
            if (relatedTools.length === 0) return [];
            return relatedTools.slice(0, PREVIEW_TOOL_LIMIT).map({
                "PlanStepItem.PlanStepItem.useMemo[checklistItems]": (tool)=>({
                        id: tool.id,
                        label: tool.toolName,
                        status: tool.status === 'success' ? 'completed' : tool.status === 'error' ? 'skipped' : 'in_progress',
                        meta: tool.durationMs !== undefined ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$foldable$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDuration"])(tool.durationMs) : undefined
                    })
            }["PlanStepItem.PlanStepItem.useMemo[checklistItems]"]);
        }
    }["PlanStepItem.PlanStepItem.useMemo[checklistItems]"], [
        relatedTools
    ]);
    // v13: status 变化时短暂 scale + transition 动画(从 in_progress 切到 completed 时尤其明显)
    // 用 ref 跟踪 prev status,变化时触发 400ms 缩放回弹
    const [iconBumpKey, setIconBumpKey] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](0);
    const prevStatusRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](step.status);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "PlanStepItem.PlanStepItem.useEffect": ()=>{
            if (prevStatusRef.current !== step.status) {
                prevStatusRef.current = step.status;
                setIconBumpKey({
                    "PlanStepItem.PlanStepItem.useEffect": (k)=>k + 1
                }["PlanStepItem.PlanStepItem.useEffect"]);
            }
        }
    }["PlanStepItem.PlanStepItem.useEffect"], [
        step.status
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: anchorRef,
                role: "button",
                tabIndex: 0,
                onClick: onClick,
                onKeyDown: onKeyDown,
                onMouseEnter: onMouseEnter,
                onMouseLeave: onMouseLeave,
                onFocus: hoverHandlers.onFocus,
                onBlur: hoverHandlers.onBlur,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex cursor-pointer items-start gap-1.5 px-2 py-0.5 text-[11px] leading-relaxed transition-colors', step.status === 'in_progress' && 'bg-primary/10', isHighlighted && 'bg-primary/5 ring-1 ring-primary/30'),
                "aria-label": stepLabel,
                "data-testid": "plan-step-".concat(step.id),
                "data-plan-step-id": step.id,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('mt-0.5 h-3 w-3 shrink-0 transition-all duration-300', PLAN_CLS[step.status], step.status === 'in_progress' && 'animate-spin', // status 切换时短暂放大回弹(在 tailwind 配置中需支持 animate-icon-pop)
                        'animate-icon-pop')
                    }, "icon-".concat(iconBumpKey), false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 384,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "min-w-0 flex-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-1.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex-1 break-all', step.status === 'pending' && 'text-muted-foreground/60'),
                                        children: [
                                            index + 1,
                                            ". ",
                                            step.step
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 397,
                                        columnNumber: 13
                                    }, this),
                                    step.durationMs !== undefined && step.status !== 'pending' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "shrink-0 text-[10px] tabular-nums text-muted-foreground/70",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$foldable$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDuration"])(step.durationMs)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 406,
                                        columnNumber: 15
                                    }, this),
                                    step.tokenUsage !== undefined && step.tokenUsage > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "shrink-0 text-[10px] tabular-nums text-muted-foreground/60",
                                        title: "".concat(step.tokenUsage, " tokens"),
                                        children: [
                                            Math.round(step.tokenUsage / 1000),
                                            "k"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 411,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 396,
                                columnNumber: 11
                            }, this),
                            step.status === 'in_progress' && step.explanation && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-0.5 break-all text-[10px] text-muted-foreground/60",
                                children: step.explanation
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 420,
                                columnNumber: 13
                            }, this),
                            step.status === 'in_progress' && checklistItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-0.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$checklist$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Checklist"], {
                                        items: checklistItems,
                                        dense: true,
                                        "data-testid": "plan-step-tools-".concat(step.id)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 427,
                                        columnNumber: 15
                                    }, this),
                                    relatedTools.length > PREVIEW_TOOL_LIMIT && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "pl-3 text-[10px] text-muted-foreground/50",
                                        children: t('moreItems', {
                                            n: relatedTools.length - PREVIEW_TOOL_LIMIT
                                        })
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 429,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 426,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 395,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 365,
                columnNumber: 7
            }, this),
            visible && content !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$hover$2d$preview$2d$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HoverPreviewCard"], {
                visible: visible,
                position: position,
                content: content,
                "data-testid": "hover-preview-".concat(step.id)
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 438,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}, "scxITP/fEcNjVEEj6ADIpQ4929o=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$hover$2d$preview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useHoverPreview"]
    ];
}));
_c = PlanStepItem;
function MinimizedSummaryBar(param) {
    let { progress, toolCallCount, subagentCount, onExpand } = param;
    _s1();
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"])('ai.pane');
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs shadow-md",
        "data-testid": "pane-minimized-bar",
        role: "status",
        "aria-live": "polite",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                className: "h-3 w-3 animate-spin text-primary",
                "aria-hidden": true
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 473,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-medium text-foreground",
                children: t('minimizedRunning')
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 474,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-muted-foreground",
                children: "·"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 475,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-muted-foreground",
                children: [
                    toolCallCount,
                    " ",
                    t('minimizedTools')
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 476,
                columnNumber: 7
            }, this),
            subagentCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-muted-foreground",
                        children: "·"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 481,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-muted-foreground",
                        children: [
                            subagentCount,
                            " ",
                            t('minimizedSubagents')
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 482,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-muted-foreground",
                children: "·"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 487,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-medium text-primary",
                children: [
                    Math.round(progress),
                    "%"
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 488,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-1 w-16 overflow-hidden rounded-sm bg-muted/40",
                "aria-hidden": true,
                "data-testid": "pane-minimized-progress-track",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-full rounded-sm bg-primary transition-all duration-300",
                    style: {
                        width: "".concat(Math.min(100, Math.max(0, progress)), "%")
                    },
                    "data-testid": "pane-minimized-progress-fill"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                    lineNumber: 495,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 490,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: onExpand,
                className: "ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground",
                "aria-label": t('expand'),
                title: t('expand'),
                "data-testid": "pane-expand",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$maximize$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Maximize2$3e$__["Maximize2"], {
                    className: "h-3 w-3",
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                    lineNumber: 509,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 501,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
        lineNumber: 467,
        columnNumber: 5
    }, this);
}
_s1(MinimizedSummaryBar, "h6+q2O3NJKPY5uL0BIJGLIanww8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"]
    ];
});
_c1 = MinimizedSummaryBar;
function AgentTaskProgressPane() {
    _s2();
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"])('ai.pane');
    const open = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"])({
        "AgentTaskProgressPane.useAgentProgressPaneStore[open]": (s)=>s.open
    }["AgentTaskProgressPane.useAgentProgressPaneStore[open]"]);
    const threadId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"])({
        "AgentTaskProgressPane.useAgentProgressPaneStore[threadId]": (s)=>s.threadId
    }["AgentTaskProgressPane.useAgentProgressPaneStore[threadId]"]);
    const setThreadId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"])({
        "AgentTaskProgressPane.useAgentProgressPaneStore[setThreadId]": (s)=>s.setThreadId
    }["AgentTaskProgressPane.useAgentProgressPaneStore[setThreadId]"]);
    const pinned = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"])({
        "AgentTaskProgressPane.useAgentProgressPaneStore[pinned]": (s)=>s.pinned
    }["AgentTaskProgressPane.useAgentProgressPaneStore[pinned]"]);
    const togglePin = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"])({
        "AgentTaskProgressPane.useAgentProgressPaneStore[togglePin]": (s)=>s.togglePin
    }["AgentTaskProgressPane.useAgentProgressPaneStore[togglePin]"]);
    const closePane = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"])({
        "AgentTaskProgressPane.useAgentProgressPaneStore[closePane]": (s)=>s.closePane
    }["AgentTaskProgressPane.useAgentProgressPaneStore[closePane]"]);
    const setProgress = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"])({
        "AgentTaskProgressPane.useAgentProgressPaneStore[setProgress]": (s)=>s.setProgress
    }["AgentTaskProgressPane.useAgentProgressPaneStore[setProgress]"]);
    // v9: 展开全部/折叠全部控制
    const [expandAll, setExpandAll] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](null);
    // Phase 19: BatchHeader 折叠状态(默认折叠,避免初次打开时 pane 太长)
    const [batchCollapsed, setBatchCollapsed] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](true);
    // v13: 快捷键帮助面板开关(pane 打开时按 ? 弹出,Esc 或点关闭按钮收起)
    const [showHelp, setShowHelp] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    // Phase 23(2026-07-29):最小化模式 — pane 不完全隐藏,显示 1-2 行摘要条
    const [isMinimized, setIsMinimized] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    // v15: 实时计时器 tick(state-only,每 1000ms 递增,触发 Pane 内部重渲染)
    // 仅在 isStreaming / sessionStart 存在时启用,避免空闲 tick 浪费
    const [elapsedTick, setElapsedTick] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](0);
    // v15: mounted 标志(SSR 安全 — createPortal 需要 document.body,SSR 时不存在)
    const [mounted, setMounted] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            setMounted(true);
        }
    }["AgentTaskProgressPane.useEffect"], []);
    // Phase 24(2026-07-29):客户端 mount 后同步 localStorage 中的 open/pinned 状态,
    // 避免 SSR 用默认值 false/true,CSR 却是 true 触发 hydration 错误
    // (与 agent-progress-trigger.tsx 的 hydrate 互为冗余 — hydrationApplied flag 保证幂等)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hydrateAgentProgressPaneFromStorage"])();
        }
    }["AgentTaskProgressPane.useEffect"], []);
    // 从 useChatStore 同步 conversationId + 读取 messages(用于 planStep↔message 关联)
    const conversationId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"])({
        "AgentTaskProgressPane.useChatStore[conversationId]": (s)=>s.conversationId
    }["AgentTaskProgressPane.useChatStore[conversationId]"]);
    const chatMessages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"])({
        "AgentTaskProgressPane.useChatStore[chatMessages]": (s)=>s.messages
    }["AgentTaskProgressPane.useChatStore[chatMessages]"]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            if (conversationId !== threadId) {
                setThreadId(conversationId);
            }
        }
    }["AgentTaskProgressPane.useEffect"], [
        conversationId,
        threadId,
        setThreadId
    ]);
    // v18:删除 v17 的 paneAnchor state + MutationObserver + fallback selector。
    // Pane 现在是 aside inner div 的 inline JSX 子元素(在 ai-side-panel.tsx 的
    // `<div className="relative min-h-0 flex-1">` 内),DOM 父级 + CSS containing block
    // 都是 inner div,绝对定位天然锚定到 AI 面板右上角。
    // - 不再需要 querySelector 找锚点 → 根除"3 个 ai-side-panel-container 选错" + "双向
    //   data-testid 漏改" + "Portal target 在某些时机是 body 不是 container"的所有 v17 隐患。
    // - 不再需要 MutationObserver 监听 body 子节点变化 → 减少 1 个全局监听器。
    // - 不再需要 `if (!paneAnchor) return null` → 加载即渲染,0 状态机可漂移。
    const progress = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$agent$2d$progress$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgress"])(open ? threadId : null);
    const { planSteps, isStreaming, subagents, tools, changes, terminals, overview } = progress;
    // v15: 实时计时器 — 仅在 streaming 或 sessionStart 存在时每秒 tick,空闲时停止
    // elapsed 派生:基于 sessionStart + 累计 tick 秒数,避免依赖当前 Date.now()(避免重渲染后时间跳变)
    const shouldTick = isStreaming || overview.sessionStart !== null;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            if (!shouldTick) return;
            const id = window.setInterval({
                "AgentTaskProgressPane.useEffect.id": ()=>{
                    setElapsedTick({
                        "AgentTaskProgressPane.useEffect.id": (n)=>n + 1
                    }["AgentTaskProgressPane.useEffect.id"]);
                }
            }["AgentTaskProgressPane.useEffect.id"], 1000);
            return ({
                "AgentTaskProgressPane.useEffect": ()=>window.clearInterval(id)
            })["AgentTaskProgressPane.useEffect"];
        }
    }["AgentTaskProgressPane.useEffect"], [
        shouldTick
    ]);
    const elapsedLabel = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[elapsedLabel]": ()=>{
            if (overview.sessionStart === null) return '';
            const startMs = Date.parse(overview.sessionStart);
            if (Number.isNaN(startMs)) return '';
            // elapsedTick 触发 setInterval 强制重算(本身不参与计算),此处读取以满足 eslint 检查
            const _tick = elapsedTick;
            void _tick;
            const totalSec = Math.floor((Date.now() - startMs) / 1000);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$foldable$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatElapsed"])(totalSec);
        }
    }["AgentTaskProgressPane.useMemo[elapsedLabel]"], [
        overview.sessionStart,
        elapsedTick
    ]);
    // v15: 失败计数(派生)— failed subagent + failed tool
    const failureCount = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[failureCount]": ()=>{
            const failedSubagents = subagents.filter({
                "AgentTaskProgressPane.useMemo[failureCount]": (s)=>s.status === 'failed' || s.status === 'dead'
            }["AgentTaskProgressPane.useMemo[failureCount]"]).length;
            const failedTools = tools.filter({
                "AgentTaskProgressPane.useMemo[failureCount]": (t)=>t.status === 'error'
            }["AgentTaskProgressPane.useMemo[failureCount]"]).length;
            const failedTerminals = terminals.filter({
                "AgentTaskProgressPane.useMemo[failureCount]": (t)=>t.status === 'failed'
            }["AgentTaskProgressPane.useMemo[failureCount]"]).length;
            return failedSubagents + failedTools + failedTerminals;
        }
    }["AgentTaskProgressPane.useMemo[failureCount]"], [
        subagents,
        tools,
        terminals
    ]);
    // v9: token 统计(汇总 planSteps + subagents 的 tokenUsage)
    const totalTokens = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[totalTokens]": ()=>{
            const planTokens = planSteps.reduce({
                "AgentTaskProgressPane.useMemo[totalTokens].planTokens": (sum, s)=>{
                    var _s_tokenUsage;
                    return sum + ((_s_tokenUsage = s.tokenUsage) !== null && _s_tokenUsage !== void 0 ? _s_tokenUsage : 0);
                }
            }["AgentTaskProgressPane.useMemo[totalTokens].planTokens"], 0);
            const subagentTokens = subagents.reduce({
                "AgentTaskProgressPane.useMemo[totalTokens].subagentTokens": (sum, s)=>{
                    var _s_tokenUsage;
                    return sum + ((_s_tokenUsage = s.tokenUsage) !== null && _s_tokenUsage !== void 0 ? _s_tokenUsage : 0);
                }
            }["AgentTaskProgressPane.useMemo[totalTokens].subagentTokens"], 0);
            return planTokens + subagentTokens;
        }
    }["AgentTaskProgressPane.useMemo[totalTokens]"], [
        planSteps,
        subagents
    ]);
    const tokenRate = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[tokenRate]": ()=>{
            if (!overview.sessionStart || totalTokens === 0) return 0;
            const startMs = Date.parse(overview.sessionStart);
            if (Number.isNaN(startMs)) return 0;
            const elapsedSec = (Date.now() - startMs) / 1000;
            if (elapsedSec < 1) return 0;
            return Math.round(totalTokens / elapsedSec);
        }
    }["AgentTaskProgressPane.useMemo[tokenRate]"], [
        overview.sessionStart,
        totalTokens
    ]);
    const etaMs = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[etaMs]": ()=>{
            if (planSteps.length === 0) return null;
            const completed = planSteps.filter({
                "AgentTaskProgressPane.useMemo[etaMs].completed": (s)=>s.status === 'completed' && s.durationMs !== undefined
            }["AgentTaskProgressPane.useMemo[etaMs].completed"]);
            if (completed.length === 0) return null;
            const avgMs = completed.reduce({
                "AgentTaskProgressPane.useMemo[etaMs]": (sum, s)=>{
                    var _s_durationMs;
                    return sum + ((_s_durationMs = s.durationMs) !== null && _s_durationMs !== void 0 ? _s_durationMs : 0);
                }
            }["AgentTaskProgressPane.useMemo[etaMs]"], 0) / completed.length;
            const remaining = planSteps.filter({
                "AgentTaskProgressPane.useMemo[etaMs]": (s)=>s.status === 'pending'
            }["AgentTaskProgressPane.useMemo[etaMs]"]).length;
            return remaining > 0 ? Math.round(avgMs * remaining) : null;
        }
    }["AgentTaskProgressPane.useMemo[etaMs]"], [
        planSteps
    ]);
    const contextUsage = totalTokens > 0 ? Math.min(100, totalTokens / 128000 * 100) : 0;
    // v10: completedCount + progressPct 用 useMemo 缓存
    const { completedCount, progressPct } = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo": ()=>{
            if (planSteps.length === 0) return {
                completedCount: 0,
                progressPct: 0
            };
            const completed = planSteps.filter({
                "AgentTaskProgressPane.useMemo": (s)=>s.status === 'completed'
            }["AgentTaskProgressPane.useMemo"]).length;
            return {
                completedCount: completed,
                progressPct: completed / planSteps.length * 100
            };
        }
    }["AgentTaskProgressPane.useMemo"], [
        planSteps
    ]);
    // v13: 完成态庆祝横幅(全部 plan steps completed 时短暂显示)
    const [showCelebration, setShowCelebration] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const celebrationShownRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](false);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            const allComplete = planSteps.length > 0 && progressPct >= 100;
            if (allComplete && !celebrationShownRef.current) {
                celebrationShownRef.current = true;
                setShowCelebration(true);
                const id = window.setTimeout({
                    "AgentTaskProgressPane.useEffect.id": ()=>setShowCelebration(false)
                }["AgentTaskProgressPane.useEffect.id"], CELEBRATION_DURATION_MS);
                return ({
                    "AgentTaskProgressPane.useEffect": ()=>window.clearTimeout(id)
                })["AgentTaskProgressPane.useEffect"];
            }
            // 当有新的 pending step 出现(任务重置/新 plan)时,重置庆祝标志以便再次触发
            if (!allComplete && planSteps.length === 0) {
                celebrationShownRef.current = false;
            }
            return undefined;
        }
    }["AgentTaskProgressPane.useEffect"], [
        planSteps,
        progressPct
    ]);
    // v17 终极根治:删除 Phase 23 "idle 状态自动展开最小化面板" useEffect
    // 根因:这个 effect 在 `isMinimized && progressPct === 0 && tools.length === 0`
    //      时立刻 `setIsMinimized(false)`,把用户的 minimize 操作秒级撤销。
    //      表现为"按了 minimize 按钮,Pane 没变化"——按钮没坏,是 effect 在背后 reset。
    //      正确语义:minimize 完全由用户控制,点 minimize = 真要最小化,直到主动点展开为止。
    //      不允许任何"自动展开"逻辑干扰用户操作(自动展开的副作用是"按钮好像坏了")。
    // Phase 23(2026-07-29 立):idle 状态自动展开最小化面板
    // 当 AI 不在执行时(progressPct=0 且无工具调用),自动退出最小化模式
    // useEffect 依赖用原始 primitive(`progressPct` number / `tools.length` number),
    // 避免数组/对象引用每 render 新建导致的 effect 无限重跑(§useEffect 依赖项含对象引用陷阱)
    // React.useEffect(() => {  // <-- 2026-07-29 注释保留,v17 已删除
    //   if (isMinimized && progressPct === 0 && tools.length === 0) {
    //     setIsMinimized(false)
    //   }
    // }, [isMinimized, progressPct, tools.length])
    // Phase 16: 进度环状态推导
    const ringState = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[ringState]": ()=>{
            if (planSteps.length === 0) return 'idle';
            if (progressPct >= 100) return 'completed';
            if (isStreaming) return 'in_progress';
            return 'idle';
        }
    }["AgentTaskProgressPane.useMemo[ringState]"], [
        planSteps.length,
        progressPct,
        isStreaming
    ]);
    // Phase 16: SSE 连接状态推导
    const connectionState = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[connectionState]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$connection$2d$status$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveConnectionState"])(isStreaming, progress.overview.reconnectAttempt, !!progress.overview.error, threadId)
    }["AgentTaskProgressPane.useMemo[connectionState]"], [
        isStreaming,
        progress.overview.reconnectAttempt,
        progress.overview.error,
        threadId
    ]);
    // 同步 planSteps 进度到 store(供 trigger 显示 "01/06" 格式)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            const total = planSteps.length;
            const currentIdx = planSteps.findIndex({
                "AgentTaskProgressPane.useEffect.currentIdx": (s)=>s.status === 'in_progress'
            }["AgentTaskProgressPane.useEffect.currentIdx"]);
            const current = currentIdx >= 0 ? currentIdx + 1 : 0;
            setProgress(current, total);
        }
    }["AgentTaskProgressPane.useEffect"], [
        planSteps,
        setProgress
    ]);
    // Phase 19: planStep ↔ message 映射(时间窗 + 索引兜底)
    const planStepLinkMap = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[planStepLinkMap]": ()=>{
            const m = new Map();
            const assistantMsgs = chatMessages.filter({
                "AgentTaskProgressPane.useMemo[planStepLinkMap].assistantMsgs": (msg)=>msg.role === 'assistant'
            }["AgentTaskProgressPane.useMemo[planStepLinkMap].assistantMsgs"]);
            planSteps.forEach({
                "AgentTaskProgressPane.useMemo[planStepLinkMap]": (step, idx)=>{
                    let match = null;
                    // 1) 时间窗匹配:startedAt ~ endedAt
                    if (step.startedAt && step.endedAt) {
                        const startMs = Date.parse(step.startedAt);
                        const endMs = Date.parse(step.endedAt);
                        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
                            const found = assistantMsgs.find({
                                "AgentTaskProgressPane.useMemo[planStepLinkMap].found": (msg)=>msg.createdAt >= startMs && msg.createdAt <= endMs
                            }["AgentTaskProgressPane.useMemo[planStepLinkMap].found"]);
                            if (found) match = {
                                messageId: found.id,
                                preview: found.content.slice(0, 80)
                            };
                        }
                    }
                    // 2) 索引兜底
                    if (!match) {
                        const fallback = assistantMsgs[idx];
                        if (fallback) match = {
                            messageId: fallback.id,
                            preview: fallback.content.slice(0, 80)
                        };
                    }
                    if (match) m.set(step.id, match);
                }
            }["AgentTaskProgressPane.useMemo[planStepLinkMap]"]);
            return m;
        }
    }["AgentTaskProgressPane.useMemo[planStepLinkMap]"], [
        planSteps,
        chatMessages
    ]);
    // Phase 19: 把映射写入 ProgressJumpStore(供跨组件反向联动)
    const linkPlanStepToMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "AgentTaskProgressPane.useProgressJumpStore[linkPlanStepToMessage]": (s)=>s.linkPlanStepToMessage
    }["AgentTaskProgressPane.useProgressJumpStore[linkPlanStepToMessage]"]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            planStepLinkMap.forEach({
                "AgentTaskProgressPane.useEffect": (link, stepId)=>{
                    linkPlanStepToMessage(stepId, link.messageId);
                }
            }["AgentTaskProgressPane.useEffect"]);
        }
    }["AgentTaskProgressPane.useEffect"], [
        planStepLinkMap,
        linkPlanStepToMessage
    ]);
    // Phase 19: 切换会话时清空联动状态(避免脏数据)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            if (!open) {
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"].getState().clearAllLinks();
            }
        }
    }["AgentTaskProgressPane.useEffect"], [
        open,
        threadId
    ]);
    // Phase 19: 每个 plan step 关联的工具调用(时间窗 + 缓冲)
    const toolsByStep = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[toolsByStep]": ()=>{
            const map = new Map();
            planSteps.forEach({
                "AgentTaskProgressPane.useMemo[toolsByStep]": (step)=>{
                    const startMs = step.startedAt ? Date.parse(step.startedAt) : Number.NaN;
                    const endMs = step.endedAt ? Date.parse(step.endedAt) : Date.now();
                    if (Number.isNaN(startMs)) {
                        map.set(step.id, EMPTY_TOOLS);
                        return;
                    }
                    const related = tools.filter({
                        "AgentTaskProgressPane.useMemo[toolsByStep].related": (t)=>{
                            const tStart = Date.parse(t.startedAt);
                            return !Number.isNaN(tStart) && tStart >= startMs - TOOL_TIME_WINDOW_LEADING_MS && tStart <= endMs + TOOL_TIME_WINDOW_TRAILING_MS;
                        }
                    }["AgentTaskProgressPane.useMemo[toolsByStep].related"]);
                    map.set(step.id, related);
                }
            }["AgentTaskProgressPane.useMemo[toolsByStep]"]);
            return map;
        }
    }["AgentTaskProgressPane.useMemo[toolsByStep]"], [
        planSteps,
        tools
    ]);
    // Phase 19: BatchHeader 状态推导(running / completed / failed / partial)
    const subagentBatchStats = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"]({
        "AgentTaskProgressPane.useMemo[subagentBatchStats]": ()=>{
            const completedCount = subagents.filter({
                "AgentTaskProgressPane.useMemo[subagentBatchStats]": (s)=>s.status === 'done'
            }["AgentTaskProgressPane.useMemo[subagentBatchStats]"]).length;
            const failedCount = subagents.filter({
                "AgentTaskProgressPane.useMemo[subagentBatchStats]": (s)=>s.status === 'failed' || s.status === 'dead'
            }["AgentTaskProgressPane.useMemo[subagentBatchStats]"]).length;
            const running = subagents.filter({
                "AgentTaskProgressPane.useMemo[subagentBatchStats]": (s)=>s.status === 'running' || s.status === 'spawned'
            }["AgentTaskProgressPane.useMemo[subagentBatchStats]"]).length;
            let status = 'completed';
            if (running > 0) status = 'running';
            else if (failedCount > 0 && completedCount > 0) status = 'partial';
            else if (failedCount > 0) status = 'failed';
            return {
                agentCount: subagents.length,
                completedCount,
                failedCount,
                status
            };
        }
    }["AgentTaskProgressPane.useMemo[subagentBatchStats]"], [
        subagents
    ]);
    // Phase 19: 时间线事件写入 TimelineStore(供 TimelineTab 渲染)
    const setEvents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTimelineStore"])({
        "AgentTaskProgressPane.useTimelineStore[setEvents]": (s)=>s.setEvents
    }["AgentTaskProgressPane.useTimelineStore[setEvents]"]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            const fallbackTs = new Date().toISOString();
            const events = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$timeline$2d$tab$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["flattenToTimelineEvents"])({
                plans: planSteps.map({
                    "AgentTaskProgressPane.useEffect.events": (p)=>{
                        var _p_startedAt, _ref;
                        return {
                            id: p.id,
                            step: p.step,
                            status: p.status,
                            timestamp: (_ref = (_p_startedAt = p.startedAt) !== null && _p_startedAt !== void 0 ? _p_startedAt : p.endedAt) !== null && _ref !== void 0 ? _ref : fallbackTs,
                            explanation: p.explanation
                        };
                    }
                }["AgentTaskProgressPane.useEffect.events"]),
                subagents: subagents.map({
                    "AgentTaskProgressPane.useEffect.events": (s)=>({
                            id: s.id,
                            nickname: s.nickname,
                            handle: s.handle,
                            status: s.status,
                            spawnedAt: s.spawnedAt,
                            currentTask: s.currentTask
                        })
                }["AgentTaskProgressPane.useEffect.events"]),
                tools: tools.map({
                    "AgentTaskProgressPane.useEffect.events": (t)=>({
                            id: t.id,
                            toolName: t.toolName,
                            status: t.status,
                            startedAt: t.startedAt,
                            durationMs: t.durationMs
                        })
                }["AgentTaskProgressPane.useEffect.events"])
            });
            setEvents(events);
        }
    }["AgentTaskProgressPane.useEffect"], [
        planSteps,
        subagents,
        tools,
        setEvents
    ]);
    // Phase 19: 监听 pendingJumpToMessage → 最佳努力滚动到消息
    const pendingJump = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "AgentTaskProgressPane.useProgressJumpStore[pendingJump]": (s)=>s.pendingJumpToMessage
    }["AgentTaskProgressPane.useProgressJumpStore[pendingJump]"]);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            if (!pendingJump) return;
            const { messageId } = pendingJump;
            const el = document.querySelector('[data-message-id="'.concat(messageId, '"]'));
            if (el) el.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }["AgentTaskProgressPane.useEffect"], [
        pendingJump
    ]);
    // Phase 19: 高亮推导(从 store 派生 isHighlighted)
    const hoveredPlanStepId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "AgentTaskProgressPane.useProgressJumpStore[hoveredPlanStepId]": (s)=>s.hoveredPlanStepId
    }["AgentTaskProgressPane.useProgressJumpStore[hoveredPlanStepId]"]);
    const hoveredMessageId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"])({
        "AgentTaskProgressPane.useProgressJumpStore[hoveredMessageId]": (s)=>s.hoveredMessageId
    }["AgentTaskProgressPane.useProgressJumpStore[hoveredMessageId]"]);
    const isStepHighlighted = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AgentTaskProgressPane.useCallback[isStepHighlighted]": (stepId, linkedMessageId)=>{
            if (hoveredPlanStepId === stepId) return true;
            if (linkedMessageId && hoveredMessageId === linkedMessageId) return true;
            return false;
        }
    }["AgentTaskProgressPane.useCallback[isStepHighlighted]"], [
        hoveredPlanStepId,
        hoveredMessageId
    ]);
    // Phase 19: Timeline tab state
    const activeTab = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTimelineStore"])({
        "AgentTaskProgressPane.useTimelineStore[activeTab]": (s)=>s.activeTab
    }["AgentTaskProgressPane.useTimelineStore[activeTab]"]);
    const setActiveTab = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTimelineStore"])({
        "AgentTaskProgressPane.useTimelineStore[setActiveTab]": (s)=>s.setActiveTab
    }["AgentTaskProgressPane.useTimelineStore[setActiveTab]"]);
    // Esc 关闭(unpin 状态下生效) + 帮助面板关闭
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            if (!open) return;
            const onKey = {
                "AgentTaskProgressPane.useEffect.onKey": (e)=>{
                    const el = e.target;
                    if (el) {
                        const tag = el.tagName;
                        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
                            return;
                        }
                    }
                    // 帮助面板打开时,Esc 优先关帮助,避免冒泡到外层 closePane
                    if (e.key === 'Escape' && showHelp) {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowHelp(false);
                        return;
                    }
                    if (e.key === 'Escape' && !pinned) {
                        e.preventDefault();
                        closePane();
                    }
                    // v13: 按 ? (Shift+/) 切换帮助面板
                    if (e.key === '?') {
                        e.preventDefault();
                        setShowHelp({
                            "AgentTaskProgressPane.useEffect.onKey": (v)=>!v
                        }["AgentTaskProgressPane.useEffect.onKey"]);
                    }
                }
            }["AgentTaskProgressPane.useEffect.onKey"];
            window.addEventListener('keydown', onKey);
            return ({
                "AgentTaskProgressPane.useEffect": ()=>window.removeEventListener('keydown', onKey)
            })["AgentTaskProgressPane.useEffect"];
        }
    }["AgentTaskProgressPane.useEffect"], [
        open,
        pinned,
        closePane,
        showHelp
    ]);
    // v11: 折叠子区键盘导航
    const onSectionsKeyDown = (e)=>{
        var _headers_nextIdx;
        const target = e.target;
        if (!target.matches('[data-section-header]')) return;
        const container = e.currentTarget;
        const headers = Array.from(container.querySelectorAll('[data-section-header]'));
        if (headers.length === 0) return;
        const currentIdx = headers.indexOf(target);
        if (currentIdx === -1) return;
        let nextIdx = currentIdx;
        switch(e.key){
            case 'ArrowDown':
                e.preventDefault();
                nextIdx = (currentIdx + 1) % headers.length;
                break;
            case 'ArrowUp':
                e.preventDefault();
                nextIdx = (currentIdx - 1 + headers.length) % headers.length;
                break;
            case 'Home':
                e.preventDefault();
                nextIdx = 0;
                break;
            case 'End':
                e.preventDefault();
                nextIdx = headers.length - 1;
                break;
            default:
                return;
        }
        (_headers_nextIdx = headers[nextIdx]) === null || _headers_nextIdx === void 0 ? void 0 : _headers_nextIdx.focus();
    };
    // click-outside 关闭
    // v17 终极根治:删除 isDragging 拦截(无拖拽状态机,click 路径纯粹)
    const paneRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            if (!open || pinned) return;
            const onClick = {
                "AgentTaskProgressPane.useEffect.onClick": (e)=>{
                    const target = e.target;
                    if (paneRef.current && !paneRef.current.contains(target)) {
                        const trigger = document.querySelector('[data-testid="agent-progress-trigger"]');
                        if (trigger && trigger.contains(target)) return;
                        closePane();
                    }
                }
            }["AgentTaskProgressPane.useEffect.onClick"];
            const id = window.setTimeout({
                "AgentTaskProgressPane.useEffect.id": ()=>{
                    document.addEventListener('mousedown', onClick);
                }
            }["AgentTaskProgressPane.useEffect.id"], 0);
            return ({
                "AgentTaskProgressPane.useEffect": ()=>{
                    window.clearTimeout(id);
                    document.removeEventListener('mousedown', onClick);
                }
            })["AgentTaskProgressPane.useEffect"];
        }
    }["AgentTaskProgressPane.useEffect"], [
        open,
        pinned,
        closePane
    ]);
    // Phase 17: 自动滚动逻辑
    const scrollRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"](null);
    const [autoScroll, setAutoScroll] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](true);
    const [showJumpToLatest, setShowJumpToLatest] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"](false);
    const onScroll = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AgentTaskProgressPane.useCallback[onScroll]": ()=>{
            const el = scrollRef.current;
            if (!el) return;
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            const atBottom = distanceFromBottom < 20;
            setAutoScroll(atBottom);
            setShowJumpToLatest(!atBottom && el.scrollHeight > el.clientHeight + 50);
        }
    }["AgentTaskProgressPane.useCallback[onScroll]"], []);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            const el = scrollRef.current;
            if (!el || !autoScroll) return;
            const id = requestAnimationFrame({
                "AgentTaskProgressPane.useEffect.id": ()=>{
                    el.scrollTop = el.scrollHeight;
                }
            }["AgentTaskProgressPane.useEffect.id"]);
            return ({
                "AgentTaskProgressPane.useEffect": ()=>cancelAnimationFrame(id)
            })["AgentTaskProgressPane.useEffect"];
        }
    }["AgentTaskProgressPane.useEffect"], [
        planSteps,
        tools.length,
        subagents.length,
        changes.length,
        terminals.length,
        progress.overview.content,
        autoScroll
    ]);
    const jumpToLatest = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AgentTaskProgressPane.useCallback[jumpToLatest]": ()=>{
            const el = scrollRef.current;
            if (!el) return;
            el.scrollTo({
                top: el.scrollHeight,
                behavior: 'smooth'
            });
            setAutoScroll(true);
        }
    }["AgentTaskProgressPane.useCallback[jumpToLatest]"], []);
    // 切换 tab 回调
    const onTabChange = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AgentTaskProgressPane.useCallback[onTabChange]": (tab)=>({
                "AgentTaskProgressPane.useCallback[onTabChange]": ()=>setActiveTab(tab)
            })["AgentTaskProgressPane.useCallback[onTabChange]"]
    }["AgentTaskProgressPane.useCallback[onTabChange]"], [
        setActiveTab
    ]);
    // v15: 滚动到首个失败项(subagent/tool/terminal)
    const scrollToFirstFailure = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AgentTaskProgressPane.useCallback[scrollToFirstFailure]": ()=>{
            var _paneRef_current, _paneRef_current1;
            const failedSubagent = (_paneRef_current = paneRef.current) === null || _paneRef_current === void 0 ? void 0 : _paneRef_current.querySelector('[data-testid^="subagent-item-"][data-status="failed"], [data-testid^="subagent-item-"][data-status="dead"]');
            const failedTool = (_paneRef_current1 = paneRef.current) === null || _paneRef_current1 === void 0 ? void 0 : _paneRef_current1.querySelector('[data-status="error"]');
            const first = failedSubagent !== null && failedSubagent !== void 0 ? failedSubagent : failedTool;
            if (first instanceof HTMLElement) {
                first.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                // 视觉提示:短暂高亮 600ms
                first.classList.add('animate-flash-highlight');
                window.setTimeout({
                    "AgentTaskProgressPane.useCallback[scrollToFirstFailure]": ()=>first.classList.remove('animate-flash-highlight')
                }["AgentTaskProgressPane.useCallback[scrollToFirstFailure]"], 700);
            }
        }
    }["AgentTaskProgressPane.useCallback[scrollToFirstFailure]"], []);
    // BatchHeader 折叠切换回调
    const onBatchCollapsedChange = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AgentTaskProgressPane.useCallback[onBatchCollapsedChange]": (next)=>setBatchCollapsed(next)
    }["AgentTaskProgressPane.useCallback[onBatchCollapsedChange]"], []);
    // v18 拖动 handle(2026-07-29 立,用户规则"之前不是支持的吗"):
    // ⚠️ Hooks 必须在 return null 之前调用,否则报 "Rendered more hooks than during the previous render"。
    // - 纯 DOM style.transform,不走 React state → 不触发重渲染
    // - onMouseDown 用 closest('button') 早退 → 不污染 button click 路径
    //   (minimize / pin / expand-all / help / tab 按钮 100% 触发原 onClick)
    // - 拖动结束后写 localStorage(`pane-drag-v18`),下次 mount 时从 useEffect 恢复
    // - 用 transform 而非视口坐标 → resize 后偏移仍正确(相对 inner div,不是 viewport)
    //
    // v19 修复(2026-07-29):删除原 closest 选择器中的 `[data-no-drag]` —
    //   该选择器本意为"defensive 早退",但因 GripVertical icon 本身带 data-no-drag,
    //   → 用户在 handle icon 上 mousedown 时 closest('[data-no-drag]') 命中,
    //   → 早退,拖动彻底失效。v19 改为仅 button / [role="button"] / input 早退,
    //   整个 header 空白 + GripVertical icon 都能正常启动拖动。
    const onHandleMouseDown = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"]({
        "AgentTaskProgressPane.useCallback[onHandleMouseDown]": (e)=>{
            // 仅 button / [role="button"] / input 区域早退,其余 header 区域(空白 + GripVertical icon)启动拖动
            if (e.target.closest('button, [role="button"], input')) return;
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const paneEl = paneRef.current;
            if (!paneEl) return;
            // 读取已有 transform(可能从 localStorage 恢复过)
            const baseTransform = paneEl.style.transform || '';
            const match = baseTransform.match(/translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/);
            const baseX = (match === null || match === void 0 ? void 0 : match[1]) ? parseFloat(match[1]) : 0;
            const baseY = (match === null || match === void 0 ? void 0 : match[2]) ? parseFloat(match[2]) : 0;
            let lastDx = 0;
            let lastDy = 0;
            const onMove = {
                "AgentTaskProgressPane.useCallback[onHandleMouseDown].onMove": (ev)=>{
                    lastDx = ev.clientX - startX;
                    lastDy = ev.clientY - startY;
                    paneEl.style.transform = "translate(".concat(baseX + lastDx, "px, ").concat(baseY + lastDy, "px)");
                }
            }["AgentTaskProgressPane.useCallback[onHandleMouseDown].onMove"];
            const onUp = {
                "AgentTaskProgressPane.useCallback[onHandleMouseDown].onUp": ()=>{
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    // 持久化到 localStorage(v19 key,与恢复逻辑保持一致)
                    // 同时 clamp Y 不让 Pane 顶部 < 8px(viewport),防止下次刷新挡 header 按钮
                    try {
                        const safeY = Math.max(baseY + lastDy, -64);
                        localStorage.setItem('pane-drag-v19', JSON.stringify({
                            x: baseX + lastDx,
                            y: safeY
                        }));
                    } catch (e) {
                    // localStorage 写入失败(隐私模式 / 配额满)→ 静默忽略
                    }
                }
            }["AgentTaskProgressPane.useCallback[onHandleMouseDown].onUp"];
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        }
    }["AgentTaskProgressPane.useCallback[onHandleMouseDown]"], []);
    // v18:从 localStorage 恢复拖动偏移(v15 视口坐标 vs v18 transform 偏移的差异 —
    // v18 是相对 inner div 的偏移,不是视口绝对坐标,resize 后无需重新校准)
    //
    // v19 加固(2026-07-29 立,用户规则"位置还是不对啊 应该偏下一些"):
    // - 边界检查:getBoundingClientRect 读 Pane 实际位置,如果顶部 < 安全阈值(64+8=72px
    //   即 header 底部 + 8px 间距),说明 localStorage 残留了 v18 拖动数据(用户拖到了
    //   屏幕顶部),自动删除并重置到默认位置。这是"位置挡按钮"的根因防护。
    // - key 迁移:v18 → v19,清掉旧 localStorage 数据,防止 v18 错位状态被新代码读取。
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"]({
        "AgentTaskProgressPane.useEffect": ()=>{
            const el = paneRef.current;
            if (!el) return;
            try {
                // v19 一次性清理 v18 残留
                localStorage.removeItem('pane-drag-v18');
                const saved = localStorage.getItem('pane-drag-v19');
                if (saved) {
                    const { x, y } = JSON.parse(saved);
                    // 边界 clamp:Y 不能让 Pane 顶部小于 0(viewport 顶部 0 安全阈值)
                    // 视口 0 - inner div 顶部 72px = -72px,所以 Y 不能小于 -72
                    // 留 8px buffer,clamp 到 -64px 之内(让 Pane 顶部最高位于 viewport 8px,正好避开 header)
                    const safeY = Math.max(y, -64);
                    el.style.transform = "translate(".concat(x, "px, ").concat(safeY, "px)");
                }
            } catch (e) {
            // localStorage 读取失败或 JSON 解析失败 → 静默忽略
            }
        }
    }["AgentTaskProgressPane.useEffect"], [
        open
    ]);
    // v18 终极方案:Pane 是 aside inner div(`<div className="relative min-h-0 flex-1">`)
    // 的 inline JSX 子元素,绝对定位天然锚定到 inner div 右上角。
    // - inner div 顶部 = aside 顶部 + 56(header) = viewport 64px
    // - Pane top:8 → viewport 72px,正好避开 header 56 工具栏(用户规则"应该偏下一些")
    // - Pane right:8 → inner div 右边 8px
    // - AI 面板 resize / open / close / window resize → Pane 0 JS 自动跟随(浏览器原生排版)
    // - 拖动用纯 DOM style.transform(不影响 React state,不影响 Pane 位置计算)
    const positionStyle = {
        position: 'absolute',
        top: 8,
        right: 8
    };
    // v18:删除 `if (!paneAnchor) return null`(没有 portal anchor 概念了)
    if (!open || !mounted) return null;
    // Phase 23(2026-07-29):最小化模式 — 渲染摘要条替代完整面板
    if (isMinimized) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "absolute z-popover",
            style: positionStyle,
            "data-testid": "pane-minimized-container",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MinimizedSummaryBar, {
                progress: progressPct,
                toolCallCount: tools.length,
                subagentCount: subagents.length,
                onExpand: ()=>setIsMinimized(false)
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 1099,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
            lineNumber: 1094,
            columnNumber: 7
        }, this);
    }
    // v18 终极方案:inline JSX,Pane 是 aside inner div 的子元素。
    // - 绝对定位 top:8 right:8 → 锚定 inner div 右上角(viewport 64px,避开 header 56)
    // - 拖动用纯 DOM style.transform(handle 元素 + onHandleMouseDown 启动)
    // - 内部 button click 路径不被污染(handle onMouseDown 用 closest('button') 早退)
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: paneRef,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('absolute z-popover', 'flex w-[280px] max-h-[60vh] flex-col', 'overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md'),
        style: positionStyle,
        role: "complementary",
        "aria-label": t('ariaLabel'),
        "data-testid": "agent-progress-pane",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('flex h-8 shrink-0 select-none items-center gap-1 border-b border-border px-1.5'),
                onMouseDown: onHandleMouseDown,
                "data-testid": "pane-header",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$grip$2d$vertical$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__GripVertical$3e$__["GripVertical"], {
                        className: "h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40",
                        "aria-hidden": true
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1141,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$connection$2d$status$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConnectionStatusDot"], {
                        state: connectionState,
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('transition-all duration-300', connectionState === 'connected' && 'shadow-[0_0_0_1px_rgb(16_185_129/0.3)]', connectionState === 'reconnecting' && 'shadow-[0_0_0_1px_rgb(245_158_11/0.3)]', connectionState === 'disconnected' && 'shadow-[0_0_0_1px_rgb(239_68_68/0.3)]')
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1145,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$todo$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ListTodo$3e$__["ListTodo"], {
                        className: "h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1154,
                        columnNumber: 9
                    }, this),
                    planSteps.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$progress$2d$ring$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ProgressRing"], {
                            value: progressPct,
                            state: ringState,
                            centerMode: "percent",
                            size: 16,
                            strokeWidth: 2,
                            "aria-label": t('progressLabel', {
                                pct: Math.round(progressPct)
                            })
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1157,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1156,
                        columnNumber: 11
                    }, this),
                    connectionState !== 'connected' && connectionState !== 'connecting' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$connection$2d$status$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConnectionStatus"], {
                            state: connectionState,
                            reconnectAttempt: progress.overview.reconnectAttempt,
                            totalAttempts: 5,
                            error: progress.overview.error,
                            className: "ml-0.5"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1169,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1168,
                        columnNumber: 11
                    }, this),
                    planSteps.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$resource$2d$budget$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResourceBudget"], {
                            used: planSteps.length,
                            total: STEP_BUDGET_TOTAL,
                            label: t('stepBudgetLabel'),
                            variant: "inline",
                            active: isStreaming,
                            className: "ml-0.5 hidden sm:inline-flex",
                            "data-testid": "pane-step-budget"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1181,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1180,
                        columnNumber: 11
                    }, this),
                    elapsedLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "ml-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-muted/50 px-1 text-[10px] tabular-nums text-muted-foreground/70",
                        "data-testid": "pane-elapsed",
                        title: t('elapsedTitle', {
                            time: elapsedLabel
                        }),
                        "aria-label": t('elapsedTitle', {
                            time: elapsedLabel
                        }),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$timer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Timer$3e$__["Timer"], {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('h-2.5 w-2.5', isStreaming ? 'animate-pulse text-primary' : 'text-muted-foreground/60'),
                                "aria-hidden": true
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1199,
                                columnNumber: 13
                            }, this),
                            elapsedLabel
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1193,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1209,
                        columnNumber: 9
                    }, this),
                    TAB_BUTTONS.map((tab)=>{
                        const TabIcon = tab.Icon;
                        const active = activeTab === tab.id;
                        const label = t(tab.i18nKey);
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            role: "tab",
                            "aria-selected": active,
                            onClick: onTabChange(tab.id),
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('inline-flex h-5 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-sm px-1 text-[10px] font-medium transition-colors', active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground/70 hover:bg-accent/40 hover:text-foreground'),
                            "data-testid": "pane-tab-".concat(tab.id),
                            title: label,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TabIcon, {
                                    className: "h-2.5 w-2.5",
                                    "aria-hidden": true
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                    lineNumber: 1231,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: label
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                    lineNumber: 1232,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, tab.id, true, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1216,
                            columnNumber: 13
                        }, this);
                    }),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setExpandAll(expandAll === true ? false : true),
                        "aria-label": expandAll === true ? t('collapseAll') : t('expandAll'),
                        title: expandAll === true ? t('collapseAll') : t('expandAll'),
                        className: "inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                        "data-testid": "pane-expand-all",
                        children: expandAll === true ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevrons$2d$down$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronsDownUp$3e$__["ChevronsDownUp"], {
                            className: "h-3 w-3"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1245,
                            columnNumber: 13
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevrons$2d$up$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronsUpDown$3e$__["ChevronsUpDown"], {
                            className: "h-3 w-3"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1247,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1236,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setShowHelp((v)=>!v),
                        "aria-label": t('helpToggle'),
                        "aria-expanded": showHelp,
                        "aria-controls": "pane-help-panel",
                        title: t('helpToggle'),
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors', showHelp ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'),
                        "data-testid": "pane-help-toggle",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$help$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__HelpCircle$3e$__["HelpCircle"], {
                            className: "h-3 w-3"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1266,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1251,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: togglePin,
                        "aria-label": pinned ? t('unpin') : t('pin'),
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors', pinned ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'),
                        title: pinned ? "".concat(t('unpin'), "(").concat(t('pinHintUnpinned'), ")") : "".concat(t('pin'), "(").concat(t('pinHintPinned'), ")"),
                        "data-testid": "pane-pin",
                        children: pinned ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pin$3e$__["Pin"], {
                            className: "h-3 w-3"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1283,
                            columnNumber: 21
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pin$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PinOff$3e$__["PinOff"], {
                            className: "h-3 w-3"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1283,
                            columnNumber: 51
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1268,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setIsMinimized(true),
                        "aria-label": t('minimize'),
                        className: "inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        title: "".concat(t('minimize'), "(").concat(t('minimizeHint'), ")"),
                        "data-testid": "pane-minimize",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$minimize$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Minimize2$3e$__["Minimize2"], {
                            className: "h-3 w-3"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                            lineNumber: 1293,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1285,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 1132,
                columnNumber: 7
            }, this),
            showCelebration && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex shrink-0 items-center gap-1.5 border-b border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300",
                role: "status",
                "aria-live": "polite",
                "data-testid": "pane-celebration-banner",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                        className: "h-3 w-3 shrink-0 animate-pulse",
                        "aria-hidden": true
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1305,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex-1 truncate",
                        children: t('celebrate')
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1306,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 1299,
                columnNumber: 9
            }, this),
            failureCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: scrollToFirstFailure,
                className: "flex shrink-0 w-full items-center gap-1.5 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-left text-[11px] text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/60",
                "aria-live": "polite",
                "data-testid": "pane-failure-banner",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                        className: "h-3 w-3 shrink-0",
                        "aria-hidden": true
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1319,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex-1 truncate",
                        children: t('failureBanner', {
                            n: failureCount
                        })
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1320,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "shrink-0 text-[10px] text-destructive/80",
                        children: "›"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1321,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 1312,
                columnNumber: 9
            }, this),
            showHelp && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: "pane-help-panel",
                role: "dialog",
                "aria-label": t('helpPanelTitle'),
                className: "shrink-0 border-b border-border bg-muted/40 px-3 py-2",
                "data-testid": "pane-help-panel",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-1.5 flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-1.5 text-[11px] font-medium text-foreground",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$keyboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Keyboard$3e$__["Keyboard"], {
                                        className: "h-3 w-3 text-muted-foreground",
                                        "aria-hidden": true
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1336,
                                        columnNumber: 15
                                    }, this),
                                    t('helpPanelTitle')
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1335,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setShowHelp(false),
                                "aria-label": t('helpClose'),
                                className: "inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                "data-testid": "pane-help-close",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                    className: "h-2.5 w-2.5"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                    lineNumber: 1346,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1339,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1334,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2",
                        role: "list",
                        "aria-label": t('helpPanelTitle'),
                        "data-testid": "pane-help-groups",
                        children: SHORTCUT_GROUPS.map((group)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                role: "listitem",
                                className: "space-y-0.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60",
                                        children: t(group.i18nKey)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1357,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "space-y-0.5",
                                        children: group.items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "flex items-center justify-between gap-2 text-[10px] text-muted-foreground/80",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: t(item.i18nKey)
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1366,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("kbd", {
                                                        className: "inline-flex h-4 shrink-0 items-center rounded-sm border border-border/60 bg-background px-1 font-mono text-[9px] font-medium text-foreground/80 shadow-sm",
                                                        children: item.keys
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1367,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, item.i18nKey, true, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1362,
                                                columnNumber: 21
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1360,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, group.i18nKey, true, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1356,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1349,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 1327,
                columnNumber: 9
            }, this),
            planSteps.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-b border-border/40 px-2 py-1 sm:hidden",
                "data-testid": "pane-step-budget-block-wrapper",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$resource$2d$budget$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResourceBudget"], {
                    used: planSteps.length,
                    total: STEP_BUDGET_TOTAL,
                    label: t('stepBudgetLabel'),
                    variant: "block",
                    active: isStreaming,
                    "data-testid": "pane-step-budget-block"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                    lineNumber: 1385,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 1381,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: scrollRef,
                onScroll: onScroll,
                className: "relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1",
                "data-testid": "plan-list",
                children: [
                    activeTab === 'timeline' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$timeline$2d$tab$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TimelineTab"], {
                        showTabs: false,
                        className: "min-h-0",
                        "data-testid": "pane-timeline-view"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1405,
                        columnNumber: 11
                    }, this),
                    (activeTab === 'inline' || activeTab === 'all') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            !threadId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col items-center gap-1.5 px-3 py-5 text-center",
                                "data-testid": "pane-empty-state",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$todo$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ListTodo$3e$__["ListTodo"], {
                                        className: "h-6 w-6 text-muted-foreground/30",
                                        "aria-hidden": true,
                                        "data-testid": "pane-empty-icon"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1417,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-0.5",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-[12px] font-medium text-foreground/80",
                                                "data-testid": "pane-empty-title",
                                                children: t('emptyTitle')
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1423,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-[10px] leading-relaxed text-muted-foreground/60",
                                                children: t('emptySubtitle')
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1429,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1422,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "mt-1 w-full space-y-0.5 text-left text-[10px] text-muted-foreground/60",
                                        "data-testid": "pane-empty-hints",
                                        "aria-label": t('emptyHintsLabel'),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "flex items-start gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-accent/30",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "shrink-0 text-primary/80",
                                                        children: "1."
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1440,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: t('emptyHint1')
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1441,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1439,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "flex items-start gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-accent/30",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "shrink-0 text-primary/80",
                                                        children: "2."
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1444,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: t('emptyHint2')
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1445,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1443,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "flex items-start gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-accent/30",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "shrink-0 text-primary/80",
                                                        children: "3."
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1448,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: t('emptyHint3')
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1449,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1447,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1434,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1413,
                                columnNumber: 15
                            }, this),
                            threadId && planSteps.length === 0 && // v13: skeleton 行数 3 → 4,加 `animate-skeleton` shimmer 渐变动画
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1 px-2 py-2",
                                "data-testid": "plan-skeleton",
                                children: Array.from({
                                    length: PLAN_SKELETON_ROWS
                                }, (_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-1.5",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-3 w-3 shrink-0 animate-skeleton rounded-sm bg-gradient-to-r from-muted/40 via-muted/70 to-muted/40 bg-[length:200%_100%]"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1460,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-2.5 animate-skeleton rounded-sm bg-gradient-to-r from-muted/40 via-muted/70 to-muted/40 bg-[length:200%_100%]",
                                                style: {
                                                    width: "".concat(50 + i * 12, "%")
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1461,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, i, true, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1459,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1457,
                                columnNumber: 15
                            }, this),
                            planSteps.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        role: "list",
                                        "aria-label": t('planListLabel'),
                                        children: planSteps.map((step, idx)=>{
                                            var _planStepLinkMap_get;
                                            const link = (_planStepLinkMap_get = planStepLinkMap.get(step.id)) !== null && _planStepLinkMap_get !== void 0 ? _planStepLinkMap_get : null;
                                            var _link_messageId, _link_preview, _toolsByStep_get, _link_messageId1;
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PlanStepItem, {
                                                step: step,
                                                index: idx,
                                                linkedMessageId: (_link_messageId = link === null || link === void 0 ? void 0 : link.messageId) !== null && _link_messageId !== void 0 ? _link_messageId : null,
                                                linkedMessagePreview: (_link_preview = link === null || link === void 0 ? void 0 : link.preview) !== null && _link_preview !== void 0 ? _link_preview : null,
                                                relatedTools: (_toolsByStep_get = toolsByStep.get(step.id)) !== null && _toolsByStep_get !== void 0 ? _toolsByStep_get : EMPTY_TOOLS,
                                                isHighlighted: isStepHighlighted(step.id, (_link_messageId1 = link === null || link === void 0 ? void 0 : link.messageId) !== null && _link_messageId1 !== void 0 ? _link_messageId1 : null)
                                            }, step.id, false, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1476,
                                                columnNumber: 23
                                            }, this);
                                        })
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1472,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mx-2 mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/60",
                                        "aria-live": "polite",
                                        "aria-atomic": "true",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "flex items-center gap-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: t('completedCount', {
                                                            done: completedCount,
                                                            total: planSteps.length
                                                        })
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1494,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$copy$2d$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CopyButton"], {
                                                        text: planSteps.map((s, i)=>"".concat(i + 1, ". [").concat(s.status, "] ").concat(s.step)).join('\n'),
                                                        "aria-label": t('copyPlan'),
                                                        "data-testid": "copy-plan-btn"
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1497,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1493,
                                                columnNumber: 19
                                            }, this),
                                            isStreaming && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "flex items-center gap-0.5 text-primary",
                                                role: "status",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                        className: "h-2.5 w-2.5 animate-spin"
                                                    }, void 0, false, {
                                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                        lineNumber: 1505,
                                                        columnNumber: 23
                                                    }, this),
                                                    t('executing')
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                lineNumber: 1504,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                        lineNumber: 1488,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true),
                            threadId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$foldable$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FoldableSectionProvider"], {
                                value: {
                                    expandAll,
                                    setExpandAll
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    onKeyDown: onSectionsKeyDown,
                                    role: "toolbar",
                                    "aria-label": t('sectionsToolbarLabel'),
                                    "data-testid": "sections-container",
                                    className: "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$thinking$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ThinkingSection"], {
                                            content: overview.content,
                                            currentNode: overview.currentNode,
                                            isStreaming: isStreaming
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                            lineNumber: 1522,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$tool$2d$calls$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ToolCallsSection"], {
                                            tools: tools
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                            lineNumber: 1527,
                                            columnNumber: 19
                                        }, this),
                                        subagents.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$batch$2d$header$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BatchHeader"], {
                                                    batchIndex: 1,
                                                    title: t('subagentBatch'),
                                                    agentCount: subagentBatchStats.agentCount,
                                                    completedCount: subagentBatchStats.completedCount,
                                                    failedCount: subagentBatchStats.failedCount,
                                                    status: subagentBatchStats.status,
                                                    collapsed: batchCollapsed,
                                                    onCollapsedChange: onBatchCollapsedChange,
                                                    defaultCollapsed: true,
                                                    className: "mx-1.5 mt-1.5",
                                                    "data-testid": "subagent-batch-header"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                    lineNumber: 1531,
                                                    columnNumber: 23
                                                }, this),
                                                !batchCollapsed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "mx-1.5 mt-1 space-y-1",
                                                    "data-testid": "subagent-batch-body",
                                                    children: subagents.map((sa)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$sub$2d$agent$2d$task$2d$tree$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SubAgentTaskTree"], {
                                                            subagent: sa,
                                                            "data-testid": "subagent-task-tree-".concat(sa.id)
                                                        }, sa.id, false, {
                                                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                            lineNumber: 1547,
                                                            columnNumber: 29
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                                    lineNumber: 1545,
                                                    columnNumber: 25
                                                }, this)
                                            ]
                                        }, void 0, true),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$changes$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ChangesSection"], {
                                            changes: changes
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                            lineNumber: 1557,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$terminal$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TerminalSection"], {
                                            terminals: terminals
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                            lineNumber: 1558,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ai$2f$progress$2d$sections$2f$overview$2d$section$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OverviewSection"], {
                                            overview: overview,
                                            isStreaming: isStreaming,
                                            totalTokens: totalTokens,
                                            tokenRate: tokenRate,
                                            etaMs: etaMs,
                                            contextUsage: contextUsage
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                            lineNumber: 1559,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                    lineNumber: 1515,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1514,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true),
                    showJumpToLatest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: jumpToLatest,
                        "aria-label": t('jumpToLatest'),
                        title: t('jumpToLatest'),
                        className: "absolute bottom-2 left-1/2 inline-flex h-6 -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-2 text-[10px] text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-accent-foreground",
                        "data-testid": "pane-jump-latest",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowDown$3e$__["ArrowDown"], {
                                className: "h-2.5 w-2.5"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1583,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: t('latest')
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                                lineNumber: 1584,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                        lineNumber: 1575,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
                lineNumber: 1397,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ai/agent-task-progress-pane.tsx",
        lineNumber: 1114,
        columnNumber: 5
    }, this);
}
_s2(AgentTaskProgressPane, "BmFVRXt04Ll+ztwKbTttADf0Xo4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$intl$40$3$2e$26$2e$5_next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$_l26yftrpqorr5u2bvptfdohmci$2f$node_modules$2f$next$2d$intl$2f$dist$2f$index$2e$react$2d$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTranslations"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$agent$2d$progress$2d$pane$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgressPaneStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$chat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$use$2d$agent$2d$progress$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAgentProgress"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTimelineStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$progress$2d$jump$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useProgressJumpStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTimelineStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$stores$2f$timeline$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTimelineStore"]
    ];
});
_c2 = AgentTaskProgressPane;
const __TURBOPACK__default__export__ = AgentTaskProgressPane;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "PlanStepItem");
__turbopack_context__.k.register(_c1, "MinimizedSummaryBar");
__turbopack_context__.k.register(_c2, "AgentTaskProgressPane");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=apps_web_src_components_ai_agent-task-progress-pane_tsx_66823579._.js.map