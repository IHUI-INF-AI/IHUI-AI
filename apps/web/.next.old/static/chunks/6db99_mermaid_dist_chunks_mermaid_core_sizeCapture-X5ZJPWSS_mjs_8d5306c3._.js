(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/sizeCapture-X5ZJPWSS.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "captureNodeSizes",
    ()=>captureNodeSizes,
    "shouldCaptureSizes",
    ()=>shouldCaptureSizes
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
;
// src/rendering-util/layout-algorithms/ddlt/captureContract.ts
var DDLT_SIZE_CAPTURE_VERSION = 1;
// src/rendering-util/layout-algorithms/ddlt/sizeCapture.ts
function getCaptureGlobal() {
    if (typeof globalThis === "undefined") {
        return void 0;
    }
    return globalThis;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(getCaptureGlobal, "getCaptureGlobal");
function shouldCaptureSizes() {
    var _getCaptureGlobal;
    return Boolean((_getCaptureGlobal = getCaptureGlobal()) === null || _getCaptureGlobal === void 0 ? void 0 : _getCaptureGlobal.mermaidCaptureSizes);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(shouldCaptureSizes, "shouldCaptureSizes");
function capturedFromLocation() {
    if (typeof location === "undefined") {
        return "browser-dev";
    }
    return "".concat(location.pathname).concat(location.search);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(capturedFromLocation, "capturedFromLocation");
function emitCapturedSizes(captured, element) {
    var _g;
    const g = getCaptureGlobal();
    if (!g) {
        return;
    }
    const domNode = element.node();
    var _ref;
    const ownerSvg = (_ref = domNode && "ownerSVGElement" in domNode ? domNode.ownerSVGElement : null) !== null && _ref !== void 0 ? _ref : domNode;
    var _ownerSvg_id;
    const svgId = (_ownerSvg_id = ownerSvg === null || ownerSvg === void 0 ? void 0 : ownerSvg.id) !== null && _ownerSvg_id !== void 0 ? _ownerSvg_id : "(unknown)";
    var _mermaidCapturedSizes;
    (_mermaidCapturedSizes = (_g = g).mermaidCapturedSizes) !== null && _mermaidCapturedSizes !== void 0 ? _mermaidCapturedSizes : _g.mermaidCapturedSizes = [];
    const entry = {
        svgId,
        sizes: captured
    };
    g.mermaidCapturedSizes.push(entry);
    g.mermaidLastCapturedSizes = entry;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(emitCapturedSizes, "emitCapturedSizes");
function captureNodeSizes(element, data4Layout) {
    const nodes = [];
    for (const node of data4Layout.nodes){
        if (node.isGroup) {
            continue;
        }
        var _node_width, _node_height;
        nodes.push({
            id: node.id,
            width: (_node_width = node.width) !== null && _node_width !== void 0 ? _node_width : 0,
            height: (_node_height = node.height) !== null && _node_height !== void 0 ? _node_height : 0
        });
    }
    if (nodes.length === 0) {
        return;
    }
    emitCapturedSizes({
        metadata: {
            captureVersion: DDLT_SIZE_CAPTURE_VERSION,
            capturedAt: /* @__PURE__ */ new Date().toISOString(),
            capturedFrom: capturedFromLocation()
        },
        nodes
    }, element);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(captureNodeSizes, "captureNodeSizes");
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_sizeCapture-X5ZJPWSS_mjs_8d5306c3._.js.map