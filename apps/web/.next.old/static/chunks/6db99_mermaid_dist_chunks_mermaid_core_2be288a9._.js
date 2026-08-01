(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "__export",
    ()=>__export,
    "__name",
    ()=>__name
]);
var __defProp = Object.defineProperty;
var __name = (target, value)=>__defProp(target, "name", {
        value,
        configurable: true
    });
var __export = (target, all)=>{
    for(var name in all)__defProp(target, name, {
        get: all[name],
        enumerable: true
    });
};
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "log",
    ()=>log,
    "setLogLevel",
    ()=>setLogLevel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/logger.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dayjs$40$1$2e$11$2e$21$2f$node_modules$2f$dayjs$2f$dayjs$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/dayjs@1.11.21/node_modules/dayjs/dayjs.min.js [app-client] (ecmascript)");
;
;
var LEVELS = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5
};
var log = {
    trace: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
        for(var _len = arguments.length, _args = new Array(_len), _key = 0; _key < _len; _key++){
            _args[_key] = arguments[_key];
        }
    }, "trace"),
    debug: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
        for(var _len = arguments.length, _args = new Array(_len), _key = 0; _key < _len; _key++){
            _args[_key] = arguments[_key];
        }
    }, "debug"),
    info: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
        for(var _len = arguments.length, _args = new Array(_len), _key = 0; _key < _len; _key++){
            _args[_key] = arguments[_key];
        }
    }, "info"),
    warn: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
        for(var _len = arguments.length, _args = new Array(_len), _key = 0; _key < _len; _key++){
            _args[_key] = arguments[_key];
        }
    }, "warn"),
    error: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
        for(var _len = arguments.length, _args = new Array(_len), _key = 0; _key < _len; _key++){
            _args[_key] = arguments[_key];
        }
    }, "error"),
    fatal: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
        for(var _len = arguments.length, _args = new Array(_len), _key = 0; _key < _len; _key++){
            _args[_key] = arguments[_key];
        }
    }, "fatal")
};
var setLogLevel = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    let level = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "fatal";
    let numericLevel = LEVELS.fatal;
    if (typeof level === "string") {
        if (level.toLowerCase() in LEVELS) {
            numericLevel = LEVELS[level];
        }
    } else if (typeof level === "number") {
        numericLevel = level;
    }
    log.trace = ()=>{};
    log.debug = ()=>{};
    log.info = ()=>{};
    log.warn = ()=>{};
    log.error = ()=>{};
    log.fatal = ()=>{};
    if (numericLevel <= LEVELS.fatal) {
        log.fatal = console.error ? console.error.bind(console, format("FATAL"), "color: orange") : console.log.bind(console, "\x1B[35m", format("FATAL"));
    }
    if (numericLevel <= LEVELS.error) {
        log.error = console.error ? console.error.bind(console, format("ERROR"), "color: orange") : console.log.bind(console, "\x1B[31m", format("ERROR"));
    }
    if (numericLevel <= LEVELS.warn) {
        log.warn = console.warn ? console.warn.bind(console, format("WARN"), "color: orange") : console.log.bind(console, "\x1b[33m", format("WARN"));
    }
    if (numericLevel <= LEVELS.info) {
        log.info = console.info ? console.info.bind(console, format("INFO"), "color: lightblue") : console.log.bind(console, "\x1B[34m", format("INFO"));
    }
    if (numericLevel <= LEVELS.debug) {
        log.debug = console.debug ? console.debug.bind(console, format("DEBUG"), "color: lightgreen") : console.log.bind(console, "\x1B[32m", format("DEBUG"));
    }
    if (numericLevel <= LEVELS.trace) {
        log.trace = console.debug ? console.debug.bind(console, format("TRACE"), "color: lightgreen") : console.log.bind(console, "\x1B[32m", format("TRACE"));
    }
}, "setLogLevel");
var format = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((level)=>{
    const time = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dayjs$40$1$2e$11$2e$21$2f$node_modules$2f$dayjs$2f$dayjs$2e$min$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])().format("ss.SSS");
    return "%c".concat(time, " : ").concat(level, " : ");
}, "format");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-VAUOI2AC.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "selectSvgElement",
    ()=>selectSvgElement
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/rendering-util/selectSvgElement.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$40$7$2e$9$2e$0$2f$node_modules$2f$d3$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3@7.9.0/node_modules/d3/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/select.js [app-client] (ecmascript) <export default as select>");
;
;
;
var selectSvgElement = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((id)=>{
    const { securityLevel } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    let root = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])("body");
    if (securityLevel === "sandbox") {
        var _sandboxElement_node;
        const sandboxElement = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])("#i".concat(id));
        var _sandboxElement_node_contentDocument;
        const doc = (_sandboxElement_node_contentDocument = (_sandboxElement_node = sandboxElement.node()) === null || _sandboxElement_node === void 0 ? void 0 : _sandboxElement_node.contentDocument) !== null && _sandboxElement_node_contentDocument !== void 0 ? _sandboxElement_node_contentDocument : document;
        root = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(doc.body);
    }
    const svg = root.select("#".concat(id));
    return svg;
}, "selectSvgElement");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-C7G6YPKG.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "compileStyles",
    ()=>compileStyles,
    "isLabelStyle",
    ()=>isLabelStyle,
    "solidStateFill",
    ()=>solidStateFill,
    "styles2String",
    ()=>styles2String,
    "userNodeOverrides",
    ()=>userNodeOverrides
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
;
;
// src/rendering-util/rendering-elements/shapes/handDrawnShapeStyles.ts
var solidStateFill = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((color)=>{
    const { handDrawnSeed } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    return {
        fill: color,
        hachureAngle: 120,
        // angle of hachure,
        hachureGap: 4,
        fillWeight: 2,
        roughness: 0.7,
        stroke: color,
        seed: handDrawnSeed
    };
}, "solidStateFill");
var compileStyles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node)=>{
    const stylesMap = styles2Map([
        ...node.cssCompiledStyles || [],
        ...node.cssStyles || [],
        ...node.labelStyle || []
    ]);
    return {
        stylesMap,
        stylesArray: [
            ...stylesMap
        ]
    };
}, "compileStyles");
var styles2Map = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((styles)=>{
    const styleMap = /* @__PURE__ */ new Map();
    styles.forEach((style)=>{
        const [key, value] = style.split(":");
        styleMap.set(key.trim(), value === null || value === void 0 ? void 0 : value.trim());
    });
    return styleMap;
}, "styles2Map");
var isLabelStyle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((key)=>{
    return key === "color" || key === "font-size" || key === "font-family" || key === "font-weight" || key === "font-style" || key === "text-decoration" || key === "text-align" || key === "text-transform" || key === "line-height" || key === "letter-spacing" || key === "word-spacing" || key === "text-shadow" || key === "text-overflow" || key === "white-space" || key === "word-wrap" || key === "word-break" || key === "overflow-wrap" || key === "hyphens";
}, "isLabelStyle");
var styles2String = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node)=>{
    const { stylesArray } = compileStyles(node);
    const labelStyles = [];
    const nodeStyles = [];
    const borderStyles = [];
    const backgroundStyles = [];
    stylesArray.forEach((style)=>{
        const key = style[0];
        if (isLabelStyle(key)) {
            labelStyles.push(style.join(":") + " !important");
        } else {
            nodeStyles.push(style.join(":") + " !important");
            if (key.includes("stroke")) {
                borderStyles.push(style.join(":") + " !important");
            }
            if (key === "fill") {
                backgroundStyles.push(style.join(":") + " !important");
            }
        }
    });
    return {
        labelStyles: labelStyles.join(";"),
        nodeStyles: nodeStyles.join(";"),
        stylesArray,
        borderStyles,
        backgroundStyles
    };
}, "styles2String");
var userNodeOverrides = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node, options)=>{
    var _stylesMap_get;
    const { themeVariables, handDrawnSeed } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    const { nodeBorder, mainBkg } = themeVariables;
    const { stylesMap } = compileStyles(node);
    const result = Object.assign({
        roughness: 0.7,
        fill: stylesMap.get("fill") || mainBkg,
        fillStyle: "hachure",
        // solid fill
        fillWeight: 4,
        hachureGap: 5.2,
        stroke: stylesMap.get("stroke") || nodeBorder,
        seed: handDrawnSeed,
        strokeWidth: ((_stylesMap_get = stylesMap.get("stroke-width")) === null || _stylesMap_get === void 0 ? void 0 : _stylesMap_get.replace("px", "")) || 1.3,
        fillLineDash: [
            0,
            0
        ],
        strokeLineDash: getStrokeDashArray(stylesMap.get("stroke-dasharray"))
    }, options);
    return result;
}, "userNodeOverrides");
var getStrokeDashArray = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((strokeDasharrayStyle)=>{
    if (!strokeDasharrayStyle) {
        return [
            0,
            0
        ];
    }
    const dashArray = strokeDasharrayStyle.trim().split(/\s+/).map(Number);
    if (dashArray.length === 1) {
        const val = isNaN(dashArray[0]) ? 0 : dashArray[0];
        return [
            val,
            val
        ];
    }
    const first = isNaN(dashArray[0]) ? 0 : dashArray[0];
    const second = isNaN(dashArray[1]) ? 0 : dashArray[1];
    return [
        first,
        second
    ];
}, "getStrokeDashArray");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ZERO_WIDTH_SPACE",
    ()=>ZERO_WIDTH_SPACE,
    "calculateTextDimensions",
    ()=>calculateTextDimensions,
    "calculateTextHeight",
    ()=>calculateTextHeight,
    "calculateTextWidth",
    ()=>calculateTextWidth,
    "cleanAndMerge",
    ()=>cleanAndMerge,
    "decodeEntities",
    ()=>decodeEntities,
    "encodeEntities",
    ()=>encodeEntities,
    "generateId",
    ()=>generateId,
    "getEdgeId",
    ()=>getEdgeId,
    "getStylesFromArray",
    ()=>getStylesFromArray,
    "handleUndefinedAttr",
    ()=>handleUndefinedAttr,
    "interpolateToCurve",
    ()=>interpolateToCurve,
    "isDetailedError",
    ()=>isDetailedError,
    "parseFontSize",
    ()=>parseFontSize,
    "random",
    ()=>random,
    "removeDirectives",
    ()=>removeDirectives,
    "utils_default",
    ()=>utils_default,
    "wrapLabel",
    ()=>wrapLabel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/utils.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$braintree$2f$sanitize$2d$url$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@braintree/sanitize-url/dist/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$40$7$2e$9$2e$0$2f$node_modules$2f$d3$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3@7.9.0/node_modules/d3/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasis$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basis.js [app-client] (ecmascript) <export default as curveBasis>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basisClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasisClosed$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basisClosed.js [app-client] (ecmascript) <export default as curveBasisClosed>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basisOpen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasisOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basisOpen.js [app-client] (ecmascript) <export default as curveBasisOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpX__as__curveBumpX$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bump.js [app-client] (ecmascript) <export bumpX as curveBumpX>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpY__as__curveBumpY$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bump.js [app-client] (ecmascript) <export bumpY as curveBumpY>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bundle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBundle$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bundle.js [app-client] (ecmascript) <export default as curveBundle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinalClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinalClosed$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinalClosed.js [app-client] (ecmascript) <export default as curveCardinalClosed>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinalOpen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinalOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinalOpen.js [app-client] (ecmascript) <export default as curveCardinalOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinal$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinal.js [app-client] (ecmascript) <export default as curveCardinal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRomClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRomClosed$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRomClosed.js [app-client] (ecmascript) <export default as curveCatmullRomClosed>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRomOpen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRomOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRomOpen.js [app-client] (ecmascript) <export default as curveCatmullRomOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRom$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRom$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRom.js [app-client] (ecmascript) <export default as curveCatmullRom>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinear$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/linear.js [app-client] (ecmascript) <export default as curveLinear>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linearClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinearClosed$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/linearClosed.js [app-client] (ecmascript) <export default as curveLinearClosed>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneX__as__curveMonotoneX$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/monotone.js [app-client] (ecmascript) <export monotoneX as curveMonotoneX>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneY__as__curveMonotoneY$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/monotone.js [app-client] (ecmascript) <export monotoneY as curveMonotoneY>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$natural$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveNatural$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/natural.js [app-client] (ecmascript) <export default as curveNatural>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveStep$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js [app-client] (ecmascript) <export default as curveStep>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepAfter__as__curveStepAfter$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js [app-client] (ecmascript) <export stepAfter as curveStepAfter>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepBefore__as__curveStepBefore$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js [app-client] (ecmascript) <export stepBefore as curveStepBefore>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/select.js [app-client] (ecmascript) <export default as select>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$es$2d$toolkit$40$1$2e$49$2e$0$2f$node_modules$2f$es$2d$toolkit$2f$dist$2f$compat$2f$function$2f$memoize$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/es-toolkit@1.49.0/node_modules/es-toolkit/dist/compat/function/memoize.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$es$2d$toolkit$40$1$2e$49$2e$0$2f$node_modules$2f$es$2d$toolkit$2f$dist$2f$compat$2f$object$2f$merge$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/es-toolkit@1.49.0/node_modules/es-toolkit/dist/compat/object/merge.mjs [app-client] (ecmascript)");
var _class;
;
;
;
;
;
;
var ZERO_WIDTH_SPACE = "\u200B";
var d3CurveTypes = {
    curveBasis: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasis$3e$__["curveBasis"],
    curveBasisClosed: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basisClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasisClosed$3e$__["curveBasisClosed"],
    curveBasisOpen: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basisOpen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasisOpen$3e$__["curveBasisOpen"],
    curveBumpX: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpX__as__curveBumpX$3e$__["curveBumpX"],
    curveBumpY: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpY__as__curveBumpY$3e$__["curveBumpY"],
    curveBundle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bundle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBundle$3e$__["curveBundle"],
    curveCardinalClosed: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinalClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinalClosed$3e$__["curveCardinalClosed"],
    curveCardinalOpen: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinalOpen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinalOpen$3e$__["curveCardinalOpen"],
    curveCardinal: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinal$3e$__["curveCardinal"],
    curveCatmullRomClosed: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRomClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRomClosed$3e$__["curveCatmullRomClosed"],
    curveCatmullRomOpen: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRomOpen$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRomOpen$3e$__["curveCatmullRomOpen"],
    curveCatmullRom: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRom$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRom$3e$__["curveCatmullRom"],
    curveLinear: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinear$3e$__["curveLinear"],
    curveLinearClosed: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linearClosed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinearClosed$3e$__["curveLinearClosed"],
    curveMonotoneX: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneX__as__curveMonotoneX$3e$__["curveMonotoneX"],
    curveMonotoneY: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneY__as__curveMonotoneY$3e$__["curveMonotoneY"],
    curveNatural: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$natural$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveNatural$3e$__["curveNatural"],
    curveStep: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveStep$3e$__["curveStep"],
    curveStepAfter: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepAfter__as__curveStepAfter$3e$__["curveStepAfter"],
    curveStepBefore: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepBefore__as__curveStepBefore$3e$__["curveStepBefore"]
};
var directiveWithoutOpen = /\s*(?:(\w+)(?=:):|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi;
var detectInit = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(text, config) {
    const inits = detectDirective(text, /(?:init\b)|(?:initialize\b)/);
    let results = {};
    if (Array.isArray(inits)) {
        const args = inits.map((init)=>init.args);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeDirective"])(args);
        results = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["assignWithDepth_default"])(results, [
            ...args
        ]);
    } else {
        results = inits.args;
    }
    if (!results) {
        return;
    }
    let type = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["detectType"])(text, config);
    const prop = "config";
    if (results[prop] !== void 0) {
        if (type === "flowchart-v2") {
            type = "flowchart";
        }
        results[type] = results[prop];
        delete results[prop];
    }
    return results;
}, "detectInit");
var detectDirective = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(text) {
    let type = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
    try {
        const commentWithoutDirectives = new RegExp("[%]{2}(?![{]".concat(directiveWithoutOpen.source, ")(?=[}][%]{2}).*\n"), "ig");
        text = text.trim().replace(commentWithoutDirectives, "").replace(/'/gm, '"');
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Detecting diagram directive".concat(type !== null ? " type:" + type : "", " based on the text:").concat(text));
        let match;
        const result = [];
        while((match = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["directiveRegex"].exec(text)) !== null){
            var _match_, _match_1;
            if (match.index === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["directiveRegex"].lastIndex) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["directiveRegex"].lastIndex++;
            }
            if (match && !type || type && ((_match_ = match[1]) === null || _match_ === void 0 ? void 0 : _match_.match(type)) || type && ((_match_1 = match[2]) === null || _match_1 === void 0 ? void 0 : _match_1.match(type))) {
                const type2 = match[1] ? match[1] : match[2];
                const args = match[3] ? match[3].trim() : match[4] ? JSON.parse(match[4].trim()) : null;
                result.push({
                    type: type2,
                    args
                });
            }
        }
        if (result.length === 0) {
            return {
                type: text,
                args: null
            };
        }
        return result.length === 1 ? result[0] : result;
    } catch (error) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error("ERROR: ".concat(error.message, " - Unable to parse directive type: '").concat(type, "' based on the text: '").concat(text, "'"));
        return {
            type: void 0,
            args: null
        };
    }
}, "detectDirective");
var removeDirectives = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(text) {
    return text.replace(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["directiveRegex"], "");
}, "removeDirectives");
var isSubstringInArray = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(str, arr) {
    for (const [i, element] of arr.entries()){
        if (element.match(str)) {
            return i;
        }
    }
    return -1;
}, "isSubstringInArray");
function interpolateToCurve(interpolate, defaultCurve) {
    if (!interpolate) {
        return defaultCurve;
    }
    const curveName = "curve".concat(interpolate.charAt(0).toUpperCase() + interpolate.slice(1));
    var _d3CurveTypes_curveName;
    return (_d3CurveTypes_curveName = d3CurveTypes[curveName]) !== null && _d3CurveTypes_curveName !== void 0 ? _d3CurveTypes_curveName : defaultCurve;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(interpolateToCurve, "interpolateToCurve");
function formatUrl(linkStr, config) {
    const url = linkStr.trim();
    if (!url) {
        return void 0;
    }
    if (config.securityLevel !== "loose") {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$braintree$2f$sanitize$2d$url$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeUrl"])(url);
    }
    return url;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(formatUrl, "formatUrl");
var runFunc = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(functionName) {
    for(var _len = arguments.length, params = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
        params[_key - 1] = arguments[_key];
    }
    const arrPaths = functionName.split(".");
    const len = arrPaths.length - 1;
    const fnName = arrPaths[len];
    let obj = window;
    for(let i = 0; i < len; i++){
        obj = obj[arrPaths[i]];
        if (!obj) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error("Function name: ".concat(functionName, " not found in window"));
            return;
        }
    }
    obj[fnName](...params);
}, "runFunc");
function distance(p1, p2) {
    if (!p1 || !p2) {
        return 0;
    }
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(distance, "distance");
function traverseEdge(points) {
    let prevPoint;
    let totalDistance = 0;
    points.forEach((point)=>{
        totalDistance += distance(point, prevPoint);
        prevPoint = point;
    });
    const remainingDistance = totalDistance / 2;
    return calculatePoint(points, remainingDistance);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(traverseEdge, "traverseEdge");
function calcLabelPosition(points) {
    if (points.length === 1) {
        return points[0];
    }
    return traverseEdge(points);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calcLabelPosition, "calcLabelPosition");
var roundNumber = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(num) {
    let precision = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 2;
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}, "roundNumber");
var calculatePoint = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((points, distanceToTraverse)=>{
    let prevPoint = void 0;
    let remainingDistance = distanceToTraverse;
    for (const point of points){
        if (prevPoint) {
            const vectorDistance = distance(point, prevPoint);
            if (vectorDistance === 0) {
                return prevPoint;
            }
            if (vectorDistance < remainingDistance) {
                remainingDistance -= vectorDistance;
            } else {
                const distanceRatio = remainingDistance / vectorDistance;
                if (distanceRatio <= 0) {
                    return prevPoint;
                }
                if (distanceRatio >= 1) {
                    return {
                        x: point.x,
                        y: point.y
                    };
                }
                if (distanceRatio > 0 && distanceRatio < 1) {
                    return {
                        x: roundNumber((1 - distanceRatio) * prevPoint.x + distanceRatio * point.x, 5),
                        y: roundNumber((1 - distanceRatio) * prevPoint.y + distanceRatio * point.y, 5)
                    };
                }
            }
        }
        prevPoint = point;
    }
    throw new Error("Could not find a suitable point for the given distance");
}, "calculatePoint");
var calcCardinalityPosition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((isRelationTypePresent, points, initialPosition)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("our points ".concat(JSON.stringify(points)));
    if (points[0] !== initialPosition) {
        points = points.reverse();
    }
    const distanceToCardinalityPoint = 25;
    const center = calculatePoint(points, distanceToCardinalityPoint);
    const d = isRelationTypePresent ? 10 : 5;
    const angle = Math.atan2(points[0].y - center.y, points[0].x - center.x);
    const cardinalityPosition = {
        x: 0,
        y: 0
    };
    cardinalityPosition.x = Math.sin(angle) * d + (points[0].x + center.x) / 2;
    cardinalityPosition.y = -Math.cos(angle) * d + (points[0].y + center.y) / 2;
    return cardinalityPosition;
}, "calcCardinalityPosition");
function calcTerminalLabelPosition(terminalMarkerSize, position, _points) {
    const points = structuredClone(_points);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("our points", points);
    if (position !== "start_left" && position !== "start_right") {
        points.reverse();
    }
    const distanceToCardinalityPoint = 25 + terminalMarkerSize;
    const center = calculatePoint(points, distanceToCardinalityPoint);
    const d = 10 + terminalMarkerSize * 0.5;
    const angle = Math.atan2(points[0].y - center.y, points[0].x - center.x);
    const cardinalityPosition = {
        x: 0,
        y: 0
    };
    if (position === "start_left") {
        cardinalityPosition.x = Math.sin(angle + Math.PI) * d + (points[0].x + center.x) / 2;
        cardinalityPosition.y = -Math.cos(angle + Math.PI) * d + (points[0].y + center.y) / 2;
    } else if (position === "end_right") {
        cardinalityPosition.x = Math.sin(angle - Math.PI) * d + (points[0].x + center.x) / 2 - 5;
        cardinalityPosition.y = -Math.cos(angle - Math.PI) * d + (points[0].y + center.y) / 2 - 5;
    } else if (position === "end_left") {
        cardinalityPosition.x = Math.sin(angle) * d + (points[0].x + center.x) / 2 - 5;
        cardinalityPosition.y = -Math.cos(angle) * d + (points[0].y + center.y) / 2 - 5;
    } else {
        cardinalityPosition.x = Math.sin(angle) * d + (points[0].x + center.x) / 2;
        cardinalityPosition.y = -Math.cos(angle) * d + (points[0].y + center.y) / 2;
    }
    return cardinalityPosition;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calcTerminalLabelPosition, "calcTerminalLabelPosition");
function getStylesFromArray(arr) {
    let style = "";
    let labelStyle = "";
    for (const element of arr){
        if (element !== void 0) {
            if (element.startsWith("color:") || element.startsWith("text-align:")) {
                labelStyle = labelStyle + element + ";";
            } else {
                style = style + element + ";";
            }
        }
    }
    return {
        style,
        labelStyle
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(getStylesFromArray, "getStylesFromArray");
var cnt = 0;
var generateId = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    cnt++;
    return "id-" + Math.random().toString(36).substr(2, 12) + "-" + cnt;
}, "generateId");
function makeRandomHex(length) {
    let result = "";
    const characters = "0123456789abcdef";
    const charactersLength = characters.length;
    for(let i = 0; i < length; i++){
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(makeRandomHex, "makeRandomHex");
var random = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    return makeRandomHex(options.length);
}, "random");
var getTextObj = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return {
        x: 0,
        y: 0,
        fill: void 0,
        anchor: "start",
        style: "#666",
        width: 100,
        height: 100,
        textMargin: 0,
        rx: 0,
        ry: 0,
        valign: void 0,
        text: ""
    };
}, "getTextObj");
var drawSimpleText = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(elem, textData) {
    const nText = textData.text.replace(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].lineBreakRegex, " ");
    const [, _fontSizePx] = parseFontSize(textData.fontSize);
    const textElem = elem.append("text");
    textElem.attr("x", textData.x);
    textElem.attr("y", textData.y);
    textElem.style("text-anchor", textData.anchor);
    textElem.style("font-family", textData.fontFamily);
    textElem.style("font-size", _fontSizePx);
    textElem.style("font-weight", textData.fontWeight);
    textElem.attr("fill", textData.fill);
    if (textData.class !== void 0) {
        textElem.attr("class", textData.class);
    }
    const span = textElem.append("tspan");
    span.attr("x", textData.x + textData.textMargin * 2);
    span.attr("fill", textData.fill);
    span.text(nText);
    return textElem;
}, "drawSimpleText");
var wrapLabel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$es$2d$toolkit$40$1$2e$49$2e$0$2f$node_modules$2f$es$2d$toolkit$2f$dist$2f$compat$2f$function$2f$memoize$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["memoize"])((label, maxWidth, config)=>{
    if (!label) {
        return label;
    }
    config = Object.assign({
        fontSize: 12,
        fontWeight: 400,
        fontFamily: "Arial",
        joinWith: "<br/>"
    }, config);
    if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].lineBreakRegex.test(label)) {
        return label;
    }
    const words = label.split(" ").filter(Boolean);
    const completedLines = [];
    let nextLine = "";
    words.forEach((word, index)=>{
        const wordLength = calculateTextWidth("".concat(word, " "), config);
        const nextLineLength = calculateTextWidth(nextLine, config);
        if (wordLength > maxWidth) {
            const { hyphenatedStrings, remainingWord } = breakString(word, maxWidth, "-", config);
            completedLines.push(nextLine, ...hyphenatedStrings);
            nextLine = remainingWord;
        } else if (nextLineLength + wordLength >= maxWidth) {
            completedLines.push(nextLine);
            nextLine = word;
        } else {
            nextLine = [
                nextLine,
                word
            ].filter(Boolean).join(" ");
        }
        const currentWord = index + 1;
        const isLastWord = currentWord === words.length;
        if (isLastWord) {
            completedLines.push(nextLine);
        }
    });
    return completedLines.filter((line)=>line !== "").join(config.joinWith);
}, (label, maxWidth, config)=>"".concat(label).concat(maxWidth).concat(config.fontSize).concat(config.fontWeight).concat(config.fontFamily).concat(config.joinWith));
var breakString = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$es$2d$toolkit$40$1$2e$49$2e$0$2f$node_modules$2f$es$2d$toolkit$2f$dist$2f$compat$2f$function$2f$memoize$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["memoize"])(function(word, maxWidth) {
    let hyphenCharacter = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "-", config = arguments.length > 3 ? arguments[3] : void 0;
    config = Object.assign({
        fontSize: 12,
        fontWeight: 400,
        fontFamily: "Arial",
        margin: 0
    }, config);
    const characters = [
        ...word
    ];
    const lines = [];
    let currentLine = "";
    characters.forEach((character, index)=>{
        const nextLine = "".concat(currentLine).concat(character);
        const lineWidth = calculateTextWidth(nextLine, config);
        if (lineWidth >= maxWidth) {
            const currentCharacter = index + 1;
            const isLastLine = characters.length === currentCharacter;
            const hyphenatedNextLine = "".concat(nextLine).concat(hyphenCharacter);
            lines.push(isLastLine ? nextLine : hyphenatedNextLine);
            currentLine = "";
        } else {
            currentLine = nextLine;
        }
    });
    return {
        hyphenatedStrings: lines,
        remainingWord: currentLine
    };
}, function(word, maxWidth) {
    let hyphenCharacter = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "-", config = arguments.length > 3 ? arguments[3] : void 0;
    return "".concat(word).concat(maxWidth).concat(hyphenCharacter).concat(config.fontSize).concat(config.fontWeight).concat(config.fontFamily);
});
function calculateTextHeight(text, config) {
    return calculateTextDimensions(text, config).height;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateTextHeight, "calculateTextHeight");
function calculateTextWidth(text, config) {
    return calculateTextDimensions(text, config).width;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateTextWidth, "calculateTextWidth");
var calculateTextDimensions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$es$2d$toolkit$40$1$2e$49$2e$0$2f$node_modules$2f$es$2d$toolkit$2f$dist$2f$compat$2f$function$2f$memoize$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["memoize"])((text, config)=>{
    const { fontSize = 12, fontFamily = "Arial", fontWeight = 400 } = config;
    if (!text) {
        return {
            width: 0,
            height: 0
        };
    }
    const [, _fontSizePx] = parseFontSize(fontSize);
    const fontFamilies = [
        "sans-serif",
        fontFamily
    ];
    const lines = text.split(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].lineBreakRegex);
    const dims = [];
    const body = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])("body");
    if (!body.remove) {
        return {
            width: 0,
            height: 0,
            lineHeight: 0
        };
    }
    const g = body.append("svg");
    for (const fontFamily2 of fontFamilies){
        let cHeight = 0;
        const dim = {
            width: 0,
            height: 0,
            lineHeight: 0
        };
        for (const line of lines){
            const textObj = getTextObj();
            textObj.text = line || ZERO_WIDTH_SPACE;
            const textElem = drawSimpleText(g, textObj).style("font-size", _fontSizePx).style("font-weight", fontWeight).style("font-family", fontFamily2);
            const bBox = (textElem._groups || textElem)[0][0].getBBox();
            if (bBox.width === 0 && bBox.height === 0) {
                throw new Error("svg element not in render tree");
            }
            dim.width = Math.round(Math.max(dim.width, bBox.width));
            cHeight = Math.round(bBox.height);
            dim.height += cHeight;
            dim.lineHeight = Math.round(Math.max(dim.lineHeight, cHeight));
        }
        dims.push(dim);
    }
    g.remove();
    const index = isNaN(dims[1].height) || isNaN(dims[1].width) || isNaN(dims[1].lineHeight) || dims[0].height > dims[1].height && dims[0].width > dims[1].width && dims[0].lineHeight > dims[1].lineHeight ? 0 : 1;
    return dims[index];
}, (text, config)=>"".concat(text).concat(config.fontSize).concat(config.fontWeight).concat(config.fontFamily));
var InitIDGenerator = (_class = class {
    constructor(deterministic = false, seed){
        this.count = 0;
        this.count = seed ? seed.length : 0;
        this.next = deterministic ? ()=>this.count++ : ()=>Date.now();
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class, "InitIDGenerator"), _class);
var decoder;
var entityDecode = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(html) {
    decoder = decoder || document.createElement("div");
    html = escape(html).replace(/%26/g, "&").replace(/%23/g, "#").replace(/%3B/g, ";");
    decoder.innerHTML = html;
    return unescape(decoder.textContent);
}, "entityDecode");
function isDetailedError(error) {
    return "str" in error;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(isDetailedError, "isDetailedError");
var insertTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((parent, cssClass, titleTopMargin, title)=>{
    var _parent_node;
    if (!title) {
        return;
    }
    const bounds = (_parent_node = parent.node()) === null || _parent_node === void 0 ? void 0 : _parent_node.getBBox();
    if (!bounds) {
        return;
    }
    parent.append("text").text(title).attr("text-anchor", "middle").attr("x", bounds.x + bounds.width / 2).attr("y", -titleTopMargin).attr("class", cssClass);
}, "insertTitle");
var parseFontSize = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((fontSize)=>{
    if (typeof fontSize === "number") {
        return [
            fontSize,
            fontSize + "px"
        ];
    }
    const fontSizeNumber = parseInt(fontSize !== null && fontSize !== void 0 ? fontSize : "", 10);
    if (Number.isNaN(fontSizeNumber)) {
        return [
            void 0,
            void 0
        ];
    } else if (fontSize === String(fontSizeNumber)) {
        return [
            fontSizeNumber,
            fontSize + "px"
        ];
    } else {
        return [
            fontSizeNumber,
            fontSize
        ];
    }
}, "parseFontSize");
function cleanAndMerge(defaultData, data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$es$2d$toolkit$40$1$2e$49$2e$0$2f$node_modules$2f$es$2d$toolkit$2f$dist$2f$compat$2f$object$2f$merge$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["merge"])({}, defaultData, data);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(cleanAndMerge, "cleanAndMerge");
var utils_default = {
    assignWithDepth: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["assignWithDepth_default"],
    wrapLabel,
    calculateTextHeight,
    calculateTextWidth,
    calculateTextDimensions,
    cleanAndMerge,
    detectInit,
    detectDirective,
    isSubstringInArray,
    interpolateToCurve,
    calcLabelPosition,
    calcCardinalityPosition,
    calcTerminalLabelPosition,
    formatUrl,
    getStylesFromArray,
    generateId,
    random,
    runFunc,
    entityDecode,
    insertTitle,
    isLabelCoordinateInPath,
    parseFontSize,
    InitIDGenerator
};
var encodeEntities = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(text) {
    let txt = text;
    txt = txt.replace(/style.*:\S*#.*;/g, function(s) {
        return s.substring(0, s.length - 1);
    });
    txt = txt.replace(/classDef.*:\S*#.*;/g, function(s) {
        return s.substring(0, s.length - 1);
    });
    txt = txt.replace(/#\w+;/g, function(s) {
        const innerTxt = s.substring(1, s.length - 1);
        const isInt = /^\+?\d+$/.test(innerTxt);
        if (isInt) {
            return "\uFB02\xB0\xB0" + innerTxt + "\xB6\xDF";
        } else {
            return "\uFB02\xB0" + innerTxt + "\xB6\xDF";
        }
    });
    return txt;
}, "encodeEntities");
var decodeEntities = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(text) {
    return text.replace(/ﬂ°°/g, "&#").replace(/ﬂ°/g, "&").replace(/¶ß/g, ";");
}, "decodeEntities");
var getEdgeId = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((from, to, param, id)=>{
    let { counter = 0, prefix, suffix } = param;
    if (id) {
        return id;
    }
    return "".concat(prefix ? "".concat(prefix, "_") : "").concat(from, "_").concat(to, "_").concat(counter).concat(suffix ? "_".concat(suffix) : "");
}, "getEdgeId");
function handleUndefinedAttr(attrValue) {
    return attrValue !== null && attrValue !== void 0 ? attrValue : null;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(handleUndefinedAttr, "handleUndefinedAttr");
function isLabelCoordinateInPath(point, dAttr) {
    const roundedX = Math.round(point.x);
    const roundedY = Math.round(point.y);
    const sanitizedD = dAttr.replace(/(\d+\.\d+)/g, (match)=>Math.round(parseFloat(match)).toString());
    return sanitizedD.includes(roundedX.toString()) || sanitizedD.includes(roundedY.toString());
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(isLabelCoordinateInPath, "isLabelCoordinateInPath");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-OGEWGWER.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "configureLabelImages",
    ()=>configureLabelImages,
    "getSubGraphTitleMargins",
    ()=>getSubGraphTitleMargins
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
;
;
;
// src/utils/subGraphTitleMargins.ts
var getSubGraphTitleMargins = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((param)=>{
    let { flowchart } = param;
    var _flowchart_subGraphTitleMargin, _flowchart_subGraphTitleMargin1;
    var _flowchart_subGraphTitleMargin_top;
    const subGraphTitleTopMargin = (_flowchart_subGraphTitleMargin_top = flowchart === null || flowchart === void 0 ? void 0 : (_flowchart_subGraphTitleMargin = flowchart.subGraphTitleMargin) === null || _flowchart_subGraphTitleMargin === void 0 ? void 0 : _flowchart_subGraphTitleMargin.top) !== null && _flowchart_subGraphTitleMargin_top !== void 0 ? _flowchart_subGraphTitleMargin_top : 0;
    var _flowchart_subGraphTitleMargin_bottom;
    const subGraphTitleBottomMargin = (_flowchart_subGraphTitleMargin_bottom = flowchart === null || flowchart === void 0 ? void 0 : (_flowchart_subGraphTitleMargin1 = flowchart.subGraphTitleMargin) === null || _flowchart_subGraphTitleMargin1 === void 0 ? void 0 : _flowchart_subGraphTitleMargin1.bottom) !== null && _flowchart_subGraphTitleMargin_bottom !== void 0 ? _flowchart_subGraphTitleMargin_bottom : 0;
    const subGraphTitleTotalMargin = subGraphTitleTopMargin + subGraphTitleBottomMargin;
    return {
        subGraphTitleTopMargin,
        subGraphTitleBottomMargin,
        subGraphTitleTotalMargin
    };
}, "getSubGraphTitleMargins");
// src/rendering-util/rendering-elements/shapes/labelImageUtils.ts
async function configureLabelImages(container, labelText) {
    const images = container.getElementsByTagName("img");
    if (!images || images.length === 0) {
        return;
    }
    const noImgText = labelText.replace(/<img[^>]*>/g, "").trim() === "";
    await Promise.all([
        ...images
    ].map((img)=>new Promise((res)=>{
            function setupImage() {
                img.style.display = "flex";
                img.style.flexDirection = "column";
                if (noImgText) {
                    const bodyFontSize = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])().fontSize ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])().fontSize : window.getComputedStyle(document.body).fontSize;
                    const enlargingFactor = 5;
                    const [parsedBodyFontSize = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultConfig_default"].fontSize] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseFontSize"])(bodyFontSize);
                    const width = parsedBodyFontSize * enlargingFactor + "px";
                    img.style.minWidth = width;
                    img.style.maxWidth = width;
                } else {
                    img.style.width = "100%";
                }
                res(img);
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(setupImage, "setupImage");
            setTimeout(()=>{
                if (img.complete) {
                    setupImage();
                }
            });
            img.addEventListener("error", setupImage);
            img.addEventListener("load", setupImage);
        })));
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(configureLabelImages, "configureLabelImages");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-HOUHSVGY.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getIconSVG",
    ()=>getIconSVG,
    "isIconAvailable",
    ()=>isIconAvailable,
    "registerIconPacks",
    ()=>registerIconPacks,
    "unknownIcon",
    ()=>unknownIcon
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/rendering-util/icons.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$icon$2d$set$2f$get$2d$icon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@iconify/utils/lib/icon-set/get-icon.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$svg$2f$html$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@iconify/utils/lib/svg/html.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$svg$2f$build$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@iconify/utils/lib/svg/build.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$svg$2f$id$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@iconify/utils/lib/svg/id.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$icon$2f$name$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@iconify/utils/lib/icon/name.js [app-client] (ecmascript)");
;
;
;
;
var unknownIcon = {
    body: '<g><rect width="80" height="80" style="fill: #087ebf; stroke-width: 0px;"/><text transform="translate(21.16 64.67)" style="fill: #fff; font-family: ArialMT, Arial; font-size: 67.75px;"><tspan x="0" y="0">?</tspan></text></g>',
    height: 80,
    width: 80
};
var iconsStore = /* @__PURE__ */ new Map();
var loaderStore = /* @__PURE__ */ new Map();
var registerIconPacks = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((iconLoaders)=>{
    for (const iconLoader of iconLoaders){
        if (!iconLoader.name) {
            throw new Error('Invalid icon loader. Must have a "name" property with non-empty string value.');
        }
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Registering icon pack:", iconLoader.name);
        if ("loader" in iconLoader) {
            loaderStore.set(iconLoader.name, iconLoader.loader);
        } else if ("icons" in iconLoader) {
            iconsStore.set(iconLoader.name, iconLoader.icons);
        } else {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error("Invalid icon loader:", iconLoader);
            throw new Error('Invalid icon loader. Must have either "icons" or "loader" property.');
        }
    }
}, "registerIconPacks");
var getRegisteredIconData = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (iconName, fallbackPrefix)=>{
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$icon$2f$name$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["stringToIcon"])(iconName, true, fallbackPrefix !== void 0);
    if (!data) {
        throw new Error("Invalid icon name: ".concat(iconName));
    }
    const prefix = data.prefix || fallbackPrefix;
    if (!prefix) {
        throw new Error("Icon name must contain a prefix: ".concat(iconName));
    }
    let icons = iconsStore.get(prefix);
    if (!icons) {
        const loader = loaderStore.get(prefix);
        if (!loader) {
            throw new Error("Icon set not found: ".concat(data.prefix));
        }
        try {
            const loaded = await loader();
            icons = {
                ...loaded,
                prefix
            };
            iconsStore.set(prefix, icons);
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error(e);
            throw new Error("Failed to load icon set: ".concat(data.prefix));
        }
    }
    const iconData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$icon$2d$set$2f$get$2d$icon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getIconData"])(icons, data.name);
    if (!iconData) {
        throw new Error("Icon not found: ".concat(iconName));
    }
    return iconData;
}, "getRegisteredIconData");
var isIconAvailable = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (iconName)=>{
    try {
        await getRegisteredIconData(iconName);
        return true;
    } catch (e) {
        return false;
    }
}, "isIconAvailable");
var getIconSVG = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (iconName, customisations, extraAttributes)=>{
    let iconData;
    try {
        iconData = await getRegisteredIconData(iconName, customisations === null || customisations === void 0 ? void 0 : customisations.fallbackPrefix);
    } catch (e) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error(e);
        iconData = unknownIcon;
    }
    const renderData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$svg$2f$build$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["iconToSVG"])(iconData, customisations);
    const svg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$svg$2f$html$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["iconToHTML"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$iconify$2f$utils$2f$lib$2f$svg$2f$id$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["replaceIDs"])(renderData.body), {
        ...renderData.attributes,
        ...extraAttributes
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])(svg, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])());
}, "getIconSVG");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Q4XR5HBZ.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeDimensionOfText",
    ()=>computeDimensionOfText,
    "createText",
    ()=>createText
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$HOUHSVGY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-HOUHSVGY.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/rendering-util/createText.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$40$7$2e$9$2e$0$2f$node_modules$2f$d3$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3@7.9.0/node_modules/d3/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/select.js [app-client] (ecmascript) <export default as select>");
// src/rendering-util/handle-markdown-text.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$marked$40$16$2e$4$2e$2$2f$node_modules$2f$marked$2f$lib$2f$marked$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/marked@16.4.2/node_modules/marked/lib/marked.esm.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$ts$2d$dedent$40$2$2e$3$2e$0$2f$node_modules$2f$ts$2d$dedent$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/ts-dedent@2.3.0/node_modules/ts-dedent/esm/index.js [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
function preprocessMarkdown(markdown, param) {
    let { markdownAutoWrap } = param;
    const withoutBR = markdown.replace(/<br\/>/g, "\n");
    const withoutMultipleNewlines = withoutBR.replace(/\n{2,}/g, "\n");
    const withoutExtraSpaces = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$ts$2d$dedent$40$2$2e$3$2e$0$2f$node_modules$2f$ts$2d$dedent$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["dedent"])(withoutMultipleNewlines);
    if (markdownAutoWrap === false) {}
    return withoutExtraSpaces;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(preprocessMarkdown, "preprocessMarkdown");
function nonMarkdownToLines(nonMarkdownText) {
    return nonMarkdownText.split(/\\n|\n|<br\s*\/?>/gi).map((line)=>{
        var _line_trim_match;
        var _line_trim_match_map;
        return (_line_trim_match_map = (_line_trim_match = line.trim().match(/<[^>]+>|[^\s<>]+/g)) === null || _line_trim_match === void 0 ? void 0 : _line_trim_match.map((word)=>({
                content: word,
                type: "normal"
            }))) !== null && _line_trim_match_map !== void 0 ? _line_trim_match_map : [];
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(nonMarkdownToLines, "nonMarkdownToLines");
function markdownToLines(markdown) {
    let config = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    const preprocessedMarkdown = preprocessMarkdown(markdown, config);
    const nodes = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$marked$40$16$2e$4$2e$2$2f$node_modules$2f$marked$2f$lib$2f$marked$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["marked"].lexer(preprocessedMarkdown);
    const lines = [
        []
    ];
    let currentLine = 0;
    function processNode(node) {
        let parentType = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "normal";
        if (node.type === "text") {
            const textLines = node.text.split("\n");
            textLines.forEach((textLine, index)=>{
                if (index !== 0) {
                    currentLine++;
                    lines.push([]);
                }
                textLine.split(" ").forEach((word)=>{
                    word = word.replace(/&#39;/g, "'");
                    if (word) {
                        lines[currentLine].push({
                            content: word,
                            type: parentType
                        });
                    }
                });
            });
        } else if (node.type === "strong" || node.type === "em") {
            node.tokens.forEach((contentNode)=>{
                processNode(contentNode, node.type);
            });
        } else if (node.type === "html") {
            lines[currentLine].push({
                content: node.text,
                type: "normal"
            });
        }
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(processNode, "processNode");
    nodes.forEach((treeNode)=>{
        if (treeNode.type === "paragraph") {
            var _treeNode_tokens;
            (_treeNode_tokens = treeNode.tokens) === null || _treeNode_tokens === void 0 ? void 0 : _treeNode_tokens.forEach((contentNode)=>{
                processNode(contentNode);
            });
        } else if (treeNode.type === "html") {
            lines[currentLine].push({
                content: treeNode.text,
                type: "normal"
            });
        } else {
            lines[currentLine].push({
                content: treeNode.raw,
                type: "normal"
            });
        }
    });
    return lines;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(markdownToLines, "markdownToLines");
function nonMarkdownToHTML(text) {
    if (!text) {
        return "";
    }
    return "<p>".concat(/**
   * Replace new lines with <br /> tags.
   *
   * Unlike in markdown text, `\n` sequences are treated as line breaks here.
   */ text.replace(/\\n|\n/g, "<br />"), "</p>");
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(nonMarkdownToHTML, "nonMarkdownToHTML");
function markdownToHTML(markdown) {
    let { markdownAutoWrap } = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    const nodes = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$marked$40$16$2e$4$2e$2$2f$node_modules$2f$marked$2f$lib$2f$marked$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["marked"].lexer(markdown);
    function output(node) {
        if (node.type === "text") {
            if (markdownAutoWrap === false) {
                return node.text.replace(/\n */g, "<br/>").replace(/ /g, "&nbsp;");
            }
            return node.text.replace(/\n */g, "<br/>");
        } else if (node.type === "strong") {
            var _node_tokens;
            return "<strong>".concat((_node_tokens = node.tokens) === null || _node_tokens === void 0 ? void 0 : _node_tokens.map(output).join(""), "</strong>");
        } else if (node.type === "em") {
            var _node_tokens1;
            return "<em>".concat((_node_tokens1 = node.tokens) === null || _node_tokens1 === void 0 ? void 0 : _node_tokens1.map(output).join(""), "</em>");
        } else if (node.type === "paragraph") {
            var _node_tokens2;
            return "<p>".concat((_node_tokens2 = node.tokens) === null || _node_tokens2 === void 0 ? void 0 : _node_tokens2.map(output).join(""), "</p>");
        } else if (node.type === "space") {
            return "";
        } else if (node.type === "html") {
            return "".concat(node.text);
        } else if (node.type === "escape") {
            return node.text;
        }
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("Unsupported markdown: ".concat(node.type));
        return node.raw;
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(output, "output");
    return nodes.map(output).join("");
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(markdownToHTML, "markdownToHTML");
// src/rendering-util/splitText.ts
function splitTextToChars(text) {
    if (Intl.Segmenter) {
        return [
            ...new Intl.Segmenter().segment(text)
        ].map((s)=>s.segment);
    }
    return [
        ...text
    ];
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(splitTextToChars, "splitTextToChars");
function splitWordToFitWidth(checkFit, word) {
    const characters = splitTextToChars(word.content);
    return splitWordToFitWidthRecursion(checkFit, [], characters, word.type);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(splitWordToFitWidth, "splitWordToFitWidth");
function splitWordToFitWidthRecursion(checkFit, usedChars, remainingChars, type) {
    if (remainingChars.length === 0) {
        return [
            {
                content: usedChars.join(""),
                type
            },
            {
                content: "",
                type
            }
        ];
    }
    const [nextChar, ...rest] = remainingChars;
    const newWord = [
        ...usedChars,
        nextChar
    ];
    if (checkFit([
        {
            content: newWord.join(""),
            type
        }
    ])) {
        return splitWordToFitWidthRecursion(checkFit, newWord, rest, type);
    }
    if (usedChars.length === 0 && nextChar) {
        usedChars.push(nextChar);
        remainingChars.shift();
    }
    return [
        {
            content: usedChars.join(""),
            type
        },
        {
            content: remainingChars.join(""),
            type
        }
    ];
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(splitWordToFitWidthRecursion, "splitWordToFitWidthRecursion");
function splitLineToFitWidth(line, checkFit) {
    if (line.some((param)=>{
        let { content } = param;
        return content.includes("\n");
    })) {
        throw new Error("splitLineToFitWidth does not support newlines in the line");
    }
    return splitLineToFitWidthRecursion(line, checkFit);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(splitLineToFitWidth, "splitLineToFitWidth");
function splitLineToFitWidthRecursion(words, checkFit) {
    let lines = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [], newLine = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : [];
    if (words.length === 0) {
        if (newLine.length > 0) {
            lines.push(newLine);
        }
        return lines.length > 0 ? lines : [];
    }
    let joiner = "";
    if (words[0].content === " ") {
        joiner = " ";
        words.shift();
    }
    var _words_shift;
    const nextWord = (_words_shift = words.shift()) !== null && _words_shift !== void 0 ? _words_shift : {
        content: " ",
        type: "normal"
    };
    const lineWithNextWord = [
        ...newLine
    ];
    if (joiner !== "") {
        lineWithNextWord.push({
            content: joiner,
            type: "normal"
        });
    }
    lineWithNextWord.push(nextWord);
    if (checkFit(lineWithNextWord)) {
        return splitLineToFitWidthRecursion(words, checkFit, lines, lineWithNextWord);
    }
    if (newLine.length > 0) {
        lines.push(newLine);
        words.unshift(nextWord);
    } else if (nextWord.content) {
        const [line, rest] = splitWordToFitWidth(checkFit, nextWord);
        lines.push([
            line
        ]);
        if (rest.content) {
            words.unshift(rest);
        }
    }
    return splitLineToFitWidthRecursion(words, checkFit, lines);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(splitLineToFitWidthRecursion, "splitLineToFitWidthRecursion");
// src/rendering-util/createText.ts
function applyStyle(dom, styleFn) {
    if (styleFn) {
        dom.attr("style", styleFn);
    }
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(applyStyle, "applyStyle");
var maxSafeSizeForWidth = 16384;
async function addHtmlSpan(element, node, width, classes) {
    let addBackground = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : false, config = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const fo = element.append("foreignObject");
    fo.attr("width", "".concat(Math.min(10 * width, maxSafeSizeForWidth), "px"));
    fo.attr("height", "".concat(Math.min(10 * width, maxSafeSizeForWidth), "px"));
    const div = fo.append("xhtml:div");
    const sanitizedLabel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasKatex"])(node.label) ? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["renderKatexSanitized"])(node.label.replace(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].lineBreakRegex, "\n"), config) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])(node.label, config);
    const labelClass = node.isNode ? "nodeLabel" : "edgeLabel";
    const span = div.append("span");
    span.html(sanitizedLabel);
    applyStyle(span, node.labelStyle);
    span.attr("class", "".concat(labelClass, " ").concat(classes));
    applyStyle(div, node.labelStyle);
    div.style("display", "table-cell");
    div.style("white-space", "nowrap");
    div.style("line-height", "1.5");
    if (width !== Number.POSITIVE_INFINITY) {
        div.style("max-width", width + "px");
        div.style("text-align", "center");
    }
    div.attr("xmlns", "http://www.w3.org/1999/xhtml");
    if (addBackground) {
        div.attr("class", "labelBkg");
    }
    let bbox = div.node().getBoundingClientRect();
    if (bbox.width === width) {
        div.style("display", "table");
        div.style("white-space", "break-spaces");
        div.style("width", width + "px");
        bbox = div.node().getBoundingClientRect();
    }
    return fo.node();
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(addHtmlSpan, "addHtmlSpan");
function createTspan(textElement, lineIndex, lineHeight) {
    let centerText = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : false;
    const tspan = textElement.append("tspan").attr("class", "text-outer-tspan").attr("x", 0).attr("y", lineIndex * lineHeight - 0.1 + "em").attr("dy", lineHeight + "em");
    if (centerText) {
        tspan.attr("text-anchor", "middle");
    }
    return tspan;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(createTspan, "createTspan");
function computeWidthOfText(parentNode, lineHeight, line) {
    const testElement = parentNode.append("text");
    const testSpan = createTspan(testElement, 1, lineHeight);
    updateTextContentAndStyles(testSpan, line);
    const textLength = testSpan.node().getComputedTextLength();
    testElement.remove();
    return textLength;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(computeWidthOfText, "computeWidthOfText");
function computeDimensionOfText(parentNode, lineHeight, text) {
    var _testSpan_node;
    const testElement = parentNode.append("text");
    const testSpan = createTspan(testElement, 1, lineHeight);
    updateTextContentAndStyles(testSpan, [
        {
            content: text,
            type: "normal"
        }
    ]);
    const textDimension = (_testSpan_node = testSpan.node()) === null || _testSpan_node === void 0 ? void 0 : _testSpan_node.getBoundingClientRect();
    if (textDimension) {
        testElement.remove();
    }
    return textDimension;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(computeDimensionOfText, "computeDimensionOfText");
function createFormattedText(width, g, structuredText) {
    let addBackground = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : false, centerText = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : false;
    const lineHeight = 1.1;
    const labelGroup = g.append("g");
    const bkg = labelGroup.insert("rect").attr("class", "background").attr("style", "stroke: none");
    const textElement = labelGroup.append("text").attr("y", "-10.1");
    if (centerText) {
        textElement.attr("text-anchor", "middle");
    }
    let lineIndex = 0;
    for (const line of structuredText){
        const checkWidth = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((line2)=>computeWidthOfText(labelGroup, lineHeight, line2) <= width, "checkWidth");
        const linesUnderWidth = checkWidth(line) ? [
            line
        ] : splitLineToFitWidth(line, checkWidth);
        for (const preparedLine of linesUnderWidth){
            const tspan = createTspan(textElement, lineIndex, lineHeight, centerText);
            updateTextContentAndStyles(tspan, preparedLine);
            lineIndex++;
        }
    }
    if (addBackground) {
        const bbox = textElement.node().getBBox();
        const padding = 2;
        bkg.attr("x", bbox.x - padding).attr("y", bbox.y - padding).attr("width", bbox.width + 2 * padding).attr("height", bbox.height + 2 * padding);
        return labelGroup.node();
    } else {
        return textElement.node();
    }
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(createFormattedText, "createFormattedText");
function decodeHTMLEntities(text) {
    const regex = /&(amp|lt|gt);/g;
    return text.replace(regex, (match, entity)=>{
        switch(entity){
            case "amp":
                return "&";
            case "lt":
                return "<";
            case "gt":
                return ">";
            default:
                return match;
        }
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(decodeHTMLEntities, "decodeHTMLEntities");
function updateTextContentAndStyles(tspan, wrappedLine) {
    tspan.text("");
    wrappedLine.forEach((word, index)=>{
        const innerTspan = tspan.append("tspan").attr("font-style", word.type === "em" ? "italic" : "normal").attr("class", "text-inner-tspan").attr("font-weight", word.type === "strong" ? "bold" : "normal");
        if (index === 0) {
            innerTspan.text(decodeHTMLEntities(word.content));
        } else {
            innerTspan.text(" " + decodeHTMLEntities(word.content));
        }
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(updateTextContentAndStyles, "updateTextContentAndStyles");
async function replaceIconSubstring(text) {
    let config = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    const pendingReplacements = [];
    text.replace(/(fa[bklrs]?):fa-([\w-]+)/g, (fullMatch, prefix, iconName)=>{
        pendingReplacements.push((async ()=>{
            const registeredIconName = "".concat(prefix, ":").concat(iconName);
            if (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$HOUHSVGY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isIconAvailable"])(registeredIconName)) {
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$HOUHSVGY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getIconSVG"])(registeredIconName, void 0, {
                    class: "label-icon"
                });
            } else {
                return "<i class='".concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])(fullMatch, config).replace(":", " "), "'></i>");
            }
        })());
        return fullMatch;
    });
    const replacements = await Promise.all(pendingReplacements);
    return text.replace(/(fa[bklrs]?):fa-([\w-]+)/g, ()=>{
        var _replacements_shift;
        return (_replacements_shift = replacements.shift()) !== null && _replacements_shift !== void 0 ? _replacements_shift : "";
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(replaceIconSubstring, "replaceIconSubstring");
var createText = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async function(el) {
    let text = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "", { style = "", isTitle = false, classes = "", useHtmlLabels = true, markdown = true, isNode = true, /**
   * The width to wrap the text within. Set to `Number.POSITIVE_INFINITY` for no wrapping.
   */ width = 200, addSvgBackground = false } = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, config = arguments.length > 3 ? arguments[3] : void 0;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("XYZ createText", text, style, isTitle, classes, useHtmlLabels, isNode, "addSvgBackground: ", addSvgBackground);
    if (useHtmlLabels) {
        const htmlText = markdown ? markdownToHTML(text, config) : nonMarkdownToHTML(text);
        const decodedReplacedText = await replaceIconSubstring((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["decodeEntities"])(htmlText), config);
        const inputForKatex = text.replace(/\\\\/g, "\\");
        const node = {
            isNode,
            label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasKatex"])(text) ? inputForKatex : decodedReplacedText,
            labelStyle: style.replace("fill:", "color:")
        };
        const vertexNode = await addHtmlSpan(el, node, width, classes, addSvgBackground, config);
        return vertexNode;
    } else {
        const sanitizeBR = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["decodeEntities"])(text.replace(/<br\s*\/?>/g, "<br/>"));
        const structuredText = markdown ? markdownToLines(sanitizeBR.replace("<br>", "<br/>"), config) : nonMarkdownToLines(sanitizeBR);
        const svgLabel = createFormattedText(width, el, structuredText, text ? addSvgBackground : false, !isNode);
        if (isNode) {
            if (/stroke:/.exec(style)) {
                style = style.replace("stroke:", "lineColor:");
            }
            const nodeLabelTextStyle = style.replace(/stroke:[^;]+;?/g, "").replace(/stroke-width:[^;]+;?/g, "").replace(/fill:[^;]+;?/g, "").replace(/color:/g, "fill:");
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgLabel).attr("style", nodeLabelTextStyle);
        } else {
            const edgeLabelRectStyle = style.replace(/stroke:[^;]+;?/g, "").replace(/stroke-width:[^;]+;?/g, "").replace(/fill:[^;]+;?/g, "").replace(/background:/g, "fill:");
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgLabel).select("rect").attr("style", edgeLabelRectStyle.replace(/background:/g, "fill:"));
            const edgeLabelTextStyle = style.replace(/stroke:[^;]+;?/g, "").replace(/stroke-width:[^;]+;?/g, "").replace(/fill:[^;]+;?/g, "").replace(/color:/g, "fill:");
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgLabel).select("text").attr("style", edgeLabelTextStyle);
        }
        if (isTitle) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgLabel).selectAll("tspan.text-outer-tspan").classed("title-row", true);
        } else {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgLabel).selectAll("tspan.text-outer-tspan").classed("row", true);
        }
        return svgLabel;
    }
}, "createText");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-7BUUIJ7U.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeLabelTransform",
    ()=>computeLabelTransform,
    "getLineFunctionsWithOffset",
    ()=>getLineFunctionsWithOffset,
    "markerOffsets",
    ()=>markerOffsets,
    "markerOffsets2",
    ()=>markerOffsets2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
;
// src/rendering-util/labelTransform.ts
var computeLabelTransform = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((bbox, useHtmlLabels)=>{
    if (useHtmlLabels) {
        return "translate(" + -bbox.width / 2 + ", " + -bbox.height / 2 + ")";
    }
    var _bbox_x;
    const x = (_bbox_x = bbox.x) !== null && _bbox_x !== void 0 ? _bbox_x : 0;
    var _bbox_y;
    const y = (_bbox_y = bbox.y) !== null && _bbox_y !== void 0 ? _bbox_y : 0;
    return "translate(" + -(x + bbox.width / 2) + ", " + -(y + bbox.height / 2) + ")";
}, "computeLabelTransform");
// src/utils/lineWithOffset.ts
var markerOffsets = {
    aggregation: 17.25,
    extension: 17.25,
    composition: 17.25,
    dependency: 6,
    lollipop: 13.5,
    arrow_point: 4,
    arrow_barb: 0,
    arrow_barb_neo: 5.5
};
var markerOffsets2 = {
    arrow_point: 4,
    arrow_cross: 12.5,
    arrow_circle: 12.5
};
function calculateDeltaAndAngle(point1, point2) {
    if (point1 === void 0 || point2 === void 0) {
        return {
            angle: 0,
            deltaX: 0,
            deltaY: 0
        };
    }
    point1 = pointTransformer(point1);
    point2 = pointTransformer(point2);
    const [x1, y1] = [
        point1.x,
        point1.y
    ];
    const [x2, y2] = [
        point2.x,
        point2.y
    ];
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    return {
        angle: Math.atan(deltaY / deltaX),
        deltaX,
        deltaY
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateDeltaAndAngle, "calculateDeltaAndAngle");
var pointTransformer = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((data)=>{
    if (Array.isArray(data)) {
        return {
            x: data[0],
            y: data[1]
        };
    }
    return data;
}, "pointTransformer");
var getLineFunctionsWithOffset = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((edge)=>{
    return {
        x: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(d, i, data) {
            let offset = 0;
            const DIRECTION = pointTransformer(data[0]).x < pointTransformer(data[data.length - 1]).x ? "left" : "right";
            if (i === 0 && Object.hasOwn(markerOffsets, edge.arrowTypeStart)) {
                const { angle, deltaX } = calculateDeltaAndAngle(data[0], data[1]);
                offset = markerOffsets[edge.arrowTypeStart] * Math.cos(angle) * (deltaX >= 0 ? 1 : -1);
            } else if (i === data.length - 1 && Object.hasOwn(markerOffsets, edge.arrowTypeEnd)) {
                const { angle, deltaX } = calculateDeltaAndAngle(data[data.length - 1], data[data.length - 2]);
                offset = markerOffsets[edge.arrowTypeEnd] * Math.cos(angle) * (deltaX >= 0 ? 1 : -1);
            }
            const differenceToEnd = Math.abs(pointTransformer(d).x - pointTransformer(data[data.length - 1]).x);
            const differenceInYEnd = Math.abs(pointTransformer(d).y - pointTransformer(data[data.length - 1]).y);
            const differenceToStart = Math.abs(pointTransformer(d).x - pointTransformer(data[0]).x);
            const differenceInYStart = Math.abs(pointTransformer(d).y - pointTransformer(data[0]).y);
            const startMarkerHeight = markerOffsets[edge.arrowTypeStart];
            const endMarkerHeight = markerOffsets[edge.arrowTypeEnd];
            const extraRoom = 1;
            if (differenceToEnd < endMarkerHeight && differenceToEnd > 0 && differenceInYEnd < endMarkerHeight) {
                let adjustment = endMarkerHeight + extraRoom - differenceToEnd;
                adjustment *= DIRECTION === "right" ? -1 : 1;
                offset -= adjustment;
            }
            if (differenceToStart < startMarkerHeight && differenceToStart > 0 && differenceInYStart < startMarkerHeight) {
                let adjustment = startMarkerHeight + extraRoom - differenceToStart;
                adjustment *= DIRECTION === "right" ? -1 : 1;
                offset += adjustment;
            }
            return pointTransformer(d).x + offset;
        }, "x"),
        y: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(d, i, data) {
            let offset = 0;
            const DIRECTION = pointTransformer(data[0]).y < pointTransformer(data[data.length - 1]).y ? "down" : "up";
            if (i === 0 && Object.hasOwn(markerOffsets, edge.arrowTypeStart)) {
                const { angle, deltaY } = calculateDeltaAndAngle(data[0], data[1]);
                offset = markerOffsets[edge.arrowTypeStart] * Math.abs(Math.sin(angle)) * (deltaY >= 0 ? 1 : -1);
            } else if (i === data.length - 1 && Object.hasOwn(markerOffsets, edge.arrowTypeEnd)) {
                const { angle, deltaY } = calculateDeltaAndAngle(data[data.length - 1], data[data.length - 2]);
                offset = markerOffsets[edge.arrowTypeEnd] * Math.abs(Math.sin(angle)) * (deltaY >= 0 ? 1 : -1);
            }
            const differenceToEnd = Math.abs(pointTransformer(d).y - pointTransformer(data[data.length - 1]).y);
            const differenceInXEnd = Math.abs(pointTransformer(d).x - pointTransformer(data[data.length - 1]).x);
            const differenceToStart = Math.abs(pointTransformer(d).y - pointTransformer(data[0]).y);
            const differenceInXStart = Math.abs(pointTransformer(d).x - pointTransformer(data[0]).x);
            const startMarkerHeight = markerOffsets[edge.arrowTypeStart];
            const endMarkerHeight = markerOffsets[edge.arrowTypeEnd];
            const extraRoom = 1;
            if (differenceToEnd < endMarkerHeight && differenceToEnd > 0 && differenceInXEnd < endMarkerHeight) {
                let adjustment = endMarkerHeight + extraRoom - differenceToEnd;
                adjustment *= DIRECTION === "up" ? -1 : 1;
                offset -= adjustment;
            }
            if (differenceToStart < startMarkerHeight && differenceToStart > 0 && differenceInXStart < startMarkerHeight) {
                let adjustment = startMarkerHeight + extraRoom - differenceToStart;
                adjustment *= DIRECTION === "up" ? -1 : 1;
                offset += adjustment;
            }
            return pointTransformer(d).y + offset;
        }, "y")
    };
}, "getLineFunctionsWithOffset");
if (void 0) {
    const { it, expect, describe } = void 0;
    describe("calculateDeltaAndAngle", ()=>{
        it("should calculate the angle and deltas between two points", ()=>{
            expect(calculateDeltaAndAngle([
                0,
                0
            ], [
                0,
                1
            ])).toStrictEqual({
                angle: 1.5707963267948966,
                deltaX: 0,
                deltaY: 1
            });
            expect(calculateDeltaAndAngle([
                1,
                0
            ], [
                0,
                -1
            ])).toStrictEqual({
                angle: 0.7853981633974483,
                deltaX: -1,
                deltaY: -1
            });
            expect(calculateDeltaAndAngle({
                x: 1,
                y: 0
            }, [
                0,
                -1
            ])).toStrictEqual({
                angle: 0.7853981633974483,
                deltaX: -1,
                deltaY: -1
            });
            expect(calculateDeltaAndAngle({
                x: 1,
                y: 0
            }, {
                x: 1,
                y: 0
            })).toStrictEqual({
                angle: NaN,
                deltaX: 0,
                deltaY: 0
            });
        });
        it("should calculate the angle and deltas if one point in undefined", ()=>{
            expect(calculateDeltaAndAngle(void 0, [
                0,
                1
            ])).toStrictEqual({
                angle: 0,
                deltaX: 0,
                deltaY: 0
            });
            expect(calculateDeltaAndAngle([
                0,
                1
            ], void 0)).toStrictEqual({
                angle: 0,
                deltaX: 0,
                deltaY: 0
            });
        });
    });
}
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-52WLFC77.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clear",
    ()=>clear,
    "edgeLabels",
    ()=>edgeLabels,
    "insertEdge",
    ()=>insertEdge,
    "insertEdgeLabel",
    ()=>insertEdgeLabel,
    "markers_default",
    ()=>markers_default,
    "positionEdgeLabel",
    ()=>positionEdgeLabel,
    "terminalLabels",
    ()=>terminalLabels
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ZGVPDNZ5.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$C7G6YPKG$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-C7G6YPKG.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-7BUUIJ7U.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$OGEWGWER$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-OGEWGWER.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Q4XR5HBZ$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Q4XR5HBZ.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/rendering-util/rendering-elements/edges.js
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$40$7$2e$9$2e$0$2f$node_modules$2f$d3$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3@7.9.0/node_modules/d3/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasis$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basis.js [app-client] (ecmascript) <export default as curveBasis>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinear$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/linear.js [app-client] (ecmascript) <export default as curveLinear>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinal$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinal.js [app-client] (ecmascript) <export default as curveCardinal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpX__as__curveBumpX$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bump.js [app-client] (ecmascript) <export bumpX as curveBumpX>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpY__as__curveBumpY$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bump.js [app-client] (ecmascript) <export bumpY as curveBumpY>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRom$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRom$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRom.js [app-client] (ecmascript) <export default as curveCatmullRom>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneX__as__curveMonotoneX$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/monotone.js [app-client] (ecmascript) <export monotoneX as curveMonotoneX>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneY__as__curveMonotoneY$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/monotone.js [app-client] (ecmascript) <export monotoneY as curveMonotoneY>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$natural$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveNatural$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/natural.js [app-client] (ecmascript) <export default as curveNatural>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveStep$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js [app-client] (ecmascript) <export default as curveStep>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepAfter__as__curveStepAfter$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js [app-client] (ecmascript) <export stepAfter as curveStepAfter>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepBefore__as__curveStepBefore$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js [app-client] (ecmascript) <export stepBefore as curveStepBefore>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__line$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/line.js [app-client] (ecmascript) <export default as line>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/select.js [app-client] (ecmascript) <export default as select>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$roughjs$40$4$2e$6$2e$6$2f$node_modules$2f$roughjs$2f$bundled$2f$rough$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/roughjs@4.6.6/node_modules/roughjs/bundled/rough.esm.js [app-client] (ecmascript)");
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
// src/rendering-util/rendering-elements/edgeMarker.ts
var addEdgeMarkers = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(svgPath, edge, url, id, diagramType) {
    let useMargin = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : false, strokeColor = arguments.length > 6 ? arguments[6] : void 0;
    if (edge.arrowTypeStart) {
        addEdgeMarker(svgPath, "start", edge.arrowTypeStart, url, id, diagramType, useMargin, strokeColor);
    }
    if (edge.arrowTypeEnd) {
        addEdgeMarker(svgPath, "end", edge.arrowTypeEnd, url, id, diagramType, useMargin, strokeColor);
    }
}, "addEdgeMarkers");
var arrowTypesMap = {
    arrow_cross: {
        type: "cross",
        fill: false
    },
    arrow_point: {
        type: "point",
        fill: true
    },
    arrow_barb: {
        type: "barb",
        fill: true
    },
    arrow_barb_neo: {
        type: "barb",
        fill: true
    },
    arrow_circle: {
        type: "circle",
        fill: false
    },
    aggregation: {
        type: "aggregation",
        fill: false
    },
    extension: {
        type: "extension",
        fill: false
    },
    composition: {
        type: "composition",
        fill: true
    },
    dependency: {
        type: "dependency",
        fill: true
    },
    lollipop: {
        type: "lollipop",
        fill: false
    },
    only_one: {
        type: "onlyOne",
        fill: false
    },
    zero_or_one: {
        type: "zeroOrOne",
        fill: false
    },
    one_or_more: {
        type: "oneOrMore",
        fill: false
    },
    zero_or_more: {
        type: "zeroOrMore",
        fill: false
    },
    requirement_arrow: {
        type: "requirement_arrow",
        fill: false
    },
    requirement_contains: {
        type: "requirement_contains",
        fill: false
    }
};
var arrowTypesWithMarginSupport = [
    "cross",
    "point",
    "circle",
    "lollipop",
    "aggregation",
    "extension",
    "composition",
    "dependency",
    "barb"
];
var addEdgeMarker = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(svgPath, position, arrowType, url, id, diagramType) {
    let useMargin = arguments.length > 6 && arguments[6] !== void 0 ? arguments[6] : false, strokeColor = arguments.length > 7 ? arguments[7] : void 0;
    const arrowTypeInfo = arrowTypesMap[arrowType];
    const marginSupport = arrowTypeInfo && arrowTypesWithMarginSupport.includes(arrowTypeInfo.type);
    if (!arrowTypeInfo) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("Unknown arrow type: ".concat(arrowType));
        return;
    }
    const endMarkerType = arrowTypeInfo.type;
    const suffix = position === "start" ? "Start" : "End";
    const offset = useMargin && marginSupport ? "-margin" : "";
    const originalMarkerId = "".concat(id, "_").concat(diagramType, "-").concat(endMarkerType).concat(suffix).concat(offset);
    if (strokeColor && strokeColor.trim() !== "") {
        const colorId = strokeColor.replace(/[^\dA-Za-z]/g, "_");
        const coloredMarkerId = "".concat(originalMarkerId, "_").concat(colorId);
        if (!document.getElementById(coloredMarkerId)) {
            const originalMarker = document.getElementById(originalMarkerId);
            if (originalMarker) {
                var _originalMarker_parentNode;
                const coloredMarker = originalMarker.cloneNode(true);
                coloredMarker.id = coloredMarkerId;
                const paths = coloredMarker.querySelectorAll("path, circle, line");
                paths.forEach((path)=>{
                    path.setAttribute("stroke", strokeColor);
                    if (arrowTypeInfo.fill) {
                        path.setAttribute("fill", strokeColor);
                    }
                });
                (_originalMarker_parentNode = originalMarker.parentNode) === null || _originalMarker_parentNode === void 0 ? void 0 : _originalMarker_parentNode.appendChild(coloredMarker);
            }
        }
        svgPath.attr("marker-".concat(position), "url(".concat(url, "#").concat(coloredMarkerId, ")"));
    } else {
        svgPath.attr("marker-".concat(position), "url(".concat(url, "#").concat(originalMarkerId, ")"));
    }
}, "addEdgeMarker");
// src/rendering-util/rendering-elements/edges.js
var resolveEdgeCurveType = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((edgeCurve)=>{
    var _getConfig2_flowchart, _getConfig2;
    return typeof edgeCurve === "string" ? edgeCurve : (_getConfig2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])()) === null || _getConfig2 === void 0 ? void 0 : (_getConfig2_flowchart = _getConfig2.flowchart) === null || _getConfig2_flowchart === void 0 ? void 0 : _getConfig2_flowchart.curve;
}, "resolveEdgeCurveType");
var edgeLabels = /* @__PURE__ */ new Map();
var terminalLabels = /* @__PURE__ */ new Map();
var clear = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    edgeLabels.clear();
    terminalLabels.clear();
}, "clear");
var getLabelStyles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((styleArray)=>{
    if (!styleArray) {
        return "";
    }
    if (typeof styleArray === "string") {
        return styleArray;
    }
    return styleArray.reduce((acc, style)=>acc + ";" + style, "");
}, "getLabelStyles");
var insertEdgeLabel = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (elem, edge)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    let useHtmlLabels = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getEffectiveHtmlLabels"])(config);
    const { labelStyles } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$C7G6YPKG$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["styles2String"])(edge);
    edge.labelStyle = labelStyles;
    const edgeLabel = elem.insert("g").attr("class", "edgeLabel");
    const label = edgeLabel.insert("g").attr("class", "label").attr("data-id", edge.id);
    const isMarkdown = edge.labelType === "markdown";
    const markdownWidth = void 0;
    const labelElement = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Q4XR5HBZ$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createText"])(elem, edge.label, {
        style: getLabelStyles(edge.labelStyle),
        useHtmlLabels,
        addSvgBackground: true,
        isNode: false,
        markdown: isMarkdown,
        // Plain text edge labels should auto-wrap, markdown edge labels respect markdownAutoWrap config
        width: isMarkdown ? markdownWidth : void 0
    }, config);
    label.node().appendChild(labelElement);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("abc82", edge, edge.labelType);
    let bbox = labelElement.getBBox();
    let transformBbox = bbox;
    if (useHtmlLabels) {
        const div = labelElement.children[0];
        const dv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(labelElement);
        bbox = div.getBoundingClientRect();
        transformBbox = bbox;
        dv.attr("width", bbox.width);
        dv.attr("height", bbox.height);
    } else {
        const textEl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(labelElement).select("text").node();
        if (textEl && typeof textEl.getBBox === "function") {
            transformBbox = textEl.getBBox();
        }
    }
    label.attr("transform", (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeLabelTransform"])(transformBbox, useHtmlLabels));
    edgeLabels.set(edge.id, edgeLabel);
    edge.width = bbox.width;
    edge.height = bbox.height;
    let fo;
    if (edge.startLabelLeft) {
        const startEdgeLabelLeft = elem.insert("g").attr("class", "edgeTerminals");
        const inner = startEdgeLabelLeft.insert("g").attr("class", "inner");
        const startLabelElement = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createLabel_default"])(inner, edge.startLabelLeft, getLabelStyles(edge.labelStyle) || "", false, false);
        fo = startLabelElement;
        let slBox = startLabelElement.getBBox();
        if (useHtmlLabels) {
            const div = startLabelElement.children[0];
            const dv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(startLabelElement);
            slBox = div.getBoundingClientRect();
            dv.attr("width", slBox.width);
            dv.attr("height", slBox.height);
        }
        inner.attr("transform", (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeLabelTransform"])(slBox, useHtmlLabels));
        if (!terminalLabels.get(edge.id)) {
            terminalLabels.set(edge.id, {});
        }
        terminalLabels.get(edge.id).startLeft = startEdgeLabelLeft;
        setTerminalWidth(fo, edge.startLabelLeft);
    }
    if (edge.startLabelRight) {
        const startEdgeLabelRight = elem.insert("g").attr("class", "edgeTerminals");
        const inner = startEdgeLabelRight.insert("g").attr("class", "inner");
        const startLabelElement = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createLabel_default"])(inner, edge.startLabelRight, getLabelStyles(edge.labelStyle) || "", false, false);
        fo = startLabelElement;
        let slBox = startLabelElement.getBBox();
        if (useHtmlLabels) {
            const div = startLabelElement.children[0];
            const dv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(startLabelElement);
            slBox = div.getBoundingClientRect();
            dv.attr("width", slBox.width);
            dv.attr("height", slBox.height);
        }
        inner.attr("transform", (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeLabelTransform"])(slBox, useHtmlLabels));
        if (!terminalLabels.get(edge.id)) {
            terminalLabels.set(edge.id, {});
        }
        terminalLabels.get(edge.id).startRight = startEdgeLabelRight;
        setTerminalWidth(fo, edge.startLabelRight);
    }
    if (edge.endLabelLeft) {
        const endEdgeLabelLeft = elem.insert("g").attr("class", "edgeTerminals");
        const inner = endEdgeLabelLeft.insert("g").attr("class", "inner");
        const endLabelElement = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createLabel_default"])(endEdgeLabelLeft, edge.endLabelLeft, getLabelStyles(edge.labelStyle) || "", false, false);
        fo = endLabelElement;
        let slBox = endLabelElement.getBBox();
        if (useHtmlLabels) {
            const div = endLabelElement.children[0];
            const dv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(endLabelElement);
            slBox = div.getBoundingClientRect();
            dv.attr("width", slBox.width);
            dv.attr("height", slBox.height);
        }
        inner.attr("transform", (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeLabelTransform"])(slBox, useHtmlLabels));
        if (!terminalLabels.get(edge.id)) {
            terminalLabels.set(edge.id, {});
        }
        terminalLabels.get(edge.id).endLeft = endEdgeLabelLeft;
        setTerminalWidth(fo, edge.endLabelLeft);
    }
    if (edge.endLabelRight) {
        const endEdgeLabelRight = elem.insert("g").attr("class", "edgeTerminals");
        const inner = endEdgeLabelRight.insert("g").attr("class", "inner");
        const endLabelElement = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createLabel_default"])(endEdgeLabelRight, edge.endLabelRight, getLabelStyles(edge.labelStyle) || "", false, false);
        fo = endLabelElement;
        let slBox = endLabelElement.getBBox();
        if (useHtmlLabels) {
            const div = endLabelElement.children[0];
            const dv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(endLabelElement);
            slBox = div.getBoundingClientRect();
            dv.attr("width", slBox.width);
            dv.attr("height", slBox.height);
        }
        inner.attr("transform", (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["computeLabelTransform"])(slBox, useHtmlLabels));
        if (!terminalLabels.get(edge.id)) {
            terminalLabels.set(edge.id, {});
        }
        terminalLabels.get(edge.id).endRight = endEdgeLabelRight;
        setTerminalWidth(fo, edge.endLabelRight);
    }
    return labelElement;
}, "insertEdgeLabel");
function setTerminalWidth(fo, value) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getEffectiveHtmlLabels"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])()) && fo) {
        fo.style.width = value.length * 9 + "px";
        fo.style.height = "12px";
    }
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(setTerminalWidth, "setTerminalWidth");
var positionEdgeLabel = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((edge, paths)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Moving label abc88 ", edge.id, edge.label, edgeLabels.get(edge.id), paths);
    let path = paths.updatedPath ? paths.updatedPath : paths.originalPath;
    const siteConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    const { subGraphTitleTotalMargin } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$OGEWGWER$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSubGraphTitleMargins"])(siteConfig);
    if (edge.label) {
        const el = edgeLabels.get(edge.id);
        let x = edge.x;
        let y = edge.y;
        if (path) {
            const pos = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils_default"].calcLabelPosition(path);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Moving label " + edge.label + " from (", x, ",", y, ") to (", pos.x, ",", pos.y, ") abc88");
            if (paths.updatedPath) {
                x = pos.x;
                y = pos.y;
            }
        }
        el.attr("transform", "translate(".concat(x, ", ").concat(y + subGraphTitleTotalMargin / 2, ")"));
    }
    if (edge.startLabelLeft) {
        const el = terminalLabels.get(edge.id).startLeft;
        let x = edge.x;
        let y = edge.y;
        if (path) {
            const pos = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils_default"].calcTerminalLabelPosition(edge.arrowTypeStart ? 10 : 0, "start_left", path);
            x = pos.x;
            y = pos.y;
        }
        el.attr("transform", "translate(".concat(x, ", ").concat(y, ")"));
    }
    if (edge.startLabelRight) {
        const el = terminalLabels.get(edge.id).startRight;
        let x = edge.x;
        let y = edge.y;
        if (path) {
            const pos = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils_default"].calcTerminalLabelPosition(edge.arrowTypeStart ? 10 : 0, "start_right", path);
            x = pos.x;
            y = pos.y;
        }
        el.attr("transform", "translate(".concat(x, ", ").concat(y, ")"));
    }
    if (edge.endLabelLeft) {
        const el = terminalLabels.get(edge.id).endLeft;
        let x = edge.x;
        let y = edge.y;
        if (path) {
            const pos = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils_default"].calcTerminalLabelPosition(edge.arrowTypeEnd ? 10 : 0, "end_left", path);
            x = pos.x;
            y = pos.y;
        }
        el.attr("transform", "translate(".concat(x, ", ").concat(y, ")"));
    }
    if (edge.endLabelRight) {
        const el = terminalLabels.get(edge.id).endRight;
        let x = edge.x;
        let y = edge.y;
        if (path) {
            const pos = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils_default"].calcTerminalLabelPosition(edge.arrowTypeEnd ? 10 : 0, "end_right", path);
            x = pos.x;
            y = pos.y;
        }
        el.attr("transform", "translate(".concat(x, ", ").concat(y, ")"));
    }
}, "positionEdgeLabel");
var orthogonalizeToLabelClippedPoints = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((edge, points)=>{
    var _edge_id;
    if (!(edge === null || edge === void 0 ? void 0 : edge.isLabelEdge) || !(edge === null || edge === void 0 ? void 0 : (_edge_id = edge.id) === null || _edge_id === void 0 ? void 0 : _edge_id.endsWith("-to-label")) || !Array.isArray(points)) {
        return points;
    }
    if (points.length !== 2) {
        return points;
    }
    const [start, end] = points;
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (dx < 1e-3 || dy < 1e-3) {
        return points;
    }
    if (dy >= dx) {
        return [
            start,
            {
                x: start.x,
                y: end.y
            },
            end
        ];
    }
    return [
        start,
        {
            x: end.x,
            y: start.y
        },
        end
    ];
}, "orthogonalizeToLabelClippedPoints");
var outsideNode = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node, point2)=>{
    const x = node.x;
    const y = node.y;
    const dx = Math.abs(point2.x - x);
    const dy = Math.abs(point2.y - y);
    const w = node.width / 2;
    const h = node.height / 2;
    return dx >= w || dy >= h;
}, "outsideNode");
var intersection = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node, outsidePoint, insidePoint)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("intersection calc abc89:\n  outsidePoint: ".concat(JSON.stringify(outsidePoint), "\n  insidePoint : ").concat(JSON.stringify(insidePoint), "\n  node        : x:").concat(node.x, " y:").concat(node.y, " w:").concat(node.width, " h:").concat(node.height));
    const x = node.x;
    const y = node.y;
    const dx = Math.abs(x - insidePoint.x);
    const w = node.width / 2;
    let r = insidePoint.x < outsidePoint.x ? w - dx : w + dx;
    const h = node.height / 2;
    const Q = Math.abs(outsidePoint.y - insidePoint.y);
    const R = Math.abs(outsidePoint.x - insidePoint.x);
    if (Math.abs(y - outsidePoint.y) * w > Math.abs(x - outsidePoint.x) * h) {
        let q = insidePoint.y < outsidePoint.y ? outsidePoint.y - h - y : y - h - outsidePoint.y;
        r = R * q / Q;
        const res = {
            x: insidePoint.x < outsidePoint.x ? insidePoint.x + r : insidePoint.x - R + r,
            y: insidePoint.y < outsidePoint.y ? insidePoint.y + Q - q : insidePoint.y - Q + q
        };
        if (r === 0) {
            res.x = outsidePoint.x;
            res.y = outsidePoint.y;
        }
        if (R === 0) {
            res.x = outsidePoint.x;
        }
        if (Q === 0) {
            res.y = outsidePoint.y;
        }
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("abc89 top/bottom calc, Q ".concat(Q, ", q ").concat(q, ", R ").concat(R, ", r ").concat(r), res);
        return res;
    } else {
        if (insidePoint.x < outsidePoint.x) {
            r = outsidePoint.x - w - x;
        } else {
            r = x - w - outsidePoint.x;
        }
        let q = Q * r / R;
        let _x = insidePoint.x < outsidePoint.x ? insidePoint.x + R - r : insidePoint.x - R + r;
        let _y = insidePoint.y < outsidePoint.y ? insidePoint.y + q : insidePoint.y - q;
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("sides calc abc89, Q ".concat(Q, ", q ").concat(q, ", R ").concat(R, ", r ").concat(r), {
            _x,
            _y
        });
        if (r === 0) {
            _x = outsidePoint.x;
            _y = outsidePoint.y;
        }
        if (R === 0) {
            _x = outsidePoint.x;
        }
        if (Q === 0) {
            _y = outsidePoint.y;
        }
        return {
            x: _x,
            y: _y
        };
    }
}, "intersection");
var cutPathAtIntersect = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((_points, boundaryNode)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("abc88 cutPathAtIntersect", _points, boundaryNode);
    let points = [];
    let lastPointOutside = _points[0];
    let isInside = false;
    _points.forEach((point2)=>{
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("abc88 checking point", point2, boundaryNode);
        if (!outsideNode(boundaryNode, point2) && !isInside) {
            const inter = intersection(boundaryNode, lastPointOutside, point2);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("abc88 inside", point2, lastPointOutside, inter);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("abc88 intersection", inter, boundaryNode);
            let pointPresent = false;
            points.forEach((p)=>{
                pointPresent = pointPresent || p.x === inter.x && p.y === inter.y;
            });
            if (!points.some((e)=>e.x === inter.x && e.y === inter.y)) {
                points.push(inter);
            } else {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("abc88 no intersect", inter, points);
            }
            isInside = true;
        } else {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("abc88 outside", point2, lastPointOutside);
            lastPointOutside = point2;
            if (!isInside) {
                points.push(point2);
            }
        }
    });
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("returning points", points);
    return points;
}, "cutPathAtIntersect");
function extractCornerPoints(points) {
    const cornerPoints = [];
    const cornerPointPositions = [];
    for(let i = 1; i < points.length - 1; i++){
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        if (prev.x === curr.x && curr.y === next.y && Math.abs(curr.x - next.x) > 5 && Math.abs(curr.y - prev.y) > 5) {
            cornerPoints.push(curr);
            cornerPointPositions.push(i);
        } else if (prev.y === curr.y && curr.x === next.x && Math.abs(curr.x - prev.x) > 5 && Math.abs(curr.y - next.y) > 5) {
            cornerPoints.push(curr);
            cornerPointPositions.push(i);
        }
    }
    return {
        cornerPoints,
        cornerPointPositions
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(extractCornerPoints, "extractCornerPoints");
var findAdjacentPoint = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(pointA, pointB, distance) {
    const xDiff = pointB.x - pointA.x;
    const yDiff = pointB.y - pointA.y;
    const length = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
    const ratio = distance / length;
    return {
        x: pointB.x - ratio * xDiff,
        y: pointB.y - ratio * yDiff
    };
}, "findAdjacentPoint");
var fixCorners = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(lineData) {
    const { cornerPointPositions } = extractCornerPoints(lineData);
    const newLineData = [];
    for(let i = 0; i < lineData.length; i++){
        if (cornerPointPositions.includes(i)) {
            const prevPoint = lineData[i - 1];
            const nextPoint = lineData[i + 1];
            const cornerPoint = lineData[i];
            const newPrevPoint = findAdjacentPoint(prevPoint, cornerPoint, 5);
            const newNextPoint = findAdjacentPoint(nextPoint, cornerPoint, 5);
            const xDiff = newNextPoint.x - newPrevPoint.x;
            const yDiff = newNextPoint.y - newPrevPoint.y;
            newLineData.push(newPrevPoint);
            const a = Math.sqrt(2) * 2;
            let newCornerPoint = {
                x: cornerPoint.x,
                y: cornerPoint.y
            };
            if (Math.abs(nextPoint.x - prevPoint.x) > 10 && Math.abs(nextPoint.y - prevPoint.y) >= 10) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Corner point fixing", Math.abs(nextPoint.x - prevPoint.x), Math.abs(nextPoint.y - prevPoint.y));
                const r = 5;
                if (cornerPoint.x === newPrevPoint.x) {
                    newCornerPoint = {
                        x: xDiff < 0 ? newPrevPoint.x - r + a : newPrevPoint.x + r - a,
                        y: yDiff < 0 ? newPrevPoint.y - a : newPrevPoint.y + a
                    };
                } else {
                    newCornerPoint = {
                        x: xDiff < 0 ? newPrevPoint.x - a : newPrevPoint.x + a,
                        y: yDiff < 0 ? newPrevPoint.y - r + a : newPrevPoint.y + r - a
                    };
                }
            } else {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Corner point skipping fixing", Math.abs(nextPoint.x - prevPoint.x), Math.abs(nextPoint.y - prevPoint.y));
            }
            newLineData.push(newCornerPoint, newNextPoint);
        } else {
            newLineData.push(lineData[i]);
        }
    }
    return newLineData;
}, "fixCorners");
var generateDashArray = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((len, oValueS, oValueE)=>{
    const middleLength = len - oValueS - oValueE;
    const dashLength = 2;
    const gapLength = 2;
    const dashGapPairLength = dashLength + gapLength;
    const numberOfPairs = Math.floor(middleLength / dashGapPairLength);
    const middlePattern = Array(numberOfPairs).fill("".concat(dashLength, " ").concat(gapLength)).join(" ");
    const dashArray = "0 ".concat(oValueS, " ").concat(middlePattern, " ").concat(oValueE);
    return dashArray;
}, "generateDashArray");
var insertEdge = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(elem, edge, clusterDb, diagramType, startNode, endNode, diagramId) {
    let skipIntersect = arguments.length > 7 && arguments[7] !== void 0 ? arguments[7] : false;
    if (!diagramId) {
        throw new Error('insertEdge: missing diagramId for edge "'.concat(edge.id, '" — edge IDs require a diagram prefix for uniqueness'));
    }
    const { handDrawnSeed, layout } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    let points = edge.points;
    let pointsHasChanged = false;
    const tail = startNode;
    var head = endNode;
    const edgeClassStyles = [];
    for(const key in edge.cssCompiledStyles){
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$C7G6YPKG$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isLabelStyle"])(key)) {
            continue;
        }
        edgeClassStyles.push(edge.cssCompiledStyles[key]);
    }
    if (layout === "swimlane") {
        if (head.intersect && tail.intersect && Array.isArray(points) && points.length >= 2) {
            if (points.length === 2) {
                points = [
                    tail.intersect(points[0]),
                    head.intersect(points[1])
                ];
            } else {
                const innerPoints = points.slice(1, -1);
                const firstInner = innerPoints[0];
                const lastInner = innerPoints[innerPoints.length - 1];
                const TOLERANCE = 0.5;
                const lastIsPinned = Math.abs(points[points.length - 1].x - lastInner.x) < TOLERANCE && Math.abs(points[points.length - 1].y - lastInner.y) < TOLERANCE;
                const newFirst = tail.intersect(firstInner);
                const newLast = lastIsPinned ? lastInner : head.intersect(lastInner);
                const lastIsDuplicate = Math.abs(newLast.x - lastInner.x) < TOLERANCE && Math.abs(newLast.y - lastInner.y) < TOLERANCE;
                const firstIsDuplicate = Math.abs(newFirst.x - firstInner.x) < TOLERANCE && Math.abs(newFirst.y - firstInner.y) < TOLERANCE;
                const startPoints = firstIsDuplicate ? [] : [
                    newFirst
                ];
                const endPoints = lastIsDuplicate ? [] : [
                    newLast
                ];
                points = [
                    ...startPoints,
                    ...innerPoints,
                    ...endPoints
                ];
            }
        }
        points = orthogonalizeToLabelClippedPoints(edge, points);
    } else if (head.intersect && tail.intersect && !skipIntersect) {
        points = points.slice(1, edge.points.length - 1);
        points.unshift(tail.intersect(points[0]));
        points.push(head.intersect(points[points.length - 1]));
    }
    const pointsStr = btoa(JSON.stringify(points));
    if (edge.toCluster) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("to cluster abc88", clusterDb.get(edge.toCluster));
        points = cutPathAtIntersect(edge.points, clusterDb.get(edge.toCluster).node);
        pointsHasChanged = true;
    }
    if (edge.fromCluster) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("from cluster abc88", clusterDb.get(edge.fromCluster), JSON.stringify(points, null, 2));
        points = cutPathAtIntersect(points.reverse(), clusterDb.get(edge.fromCluster).node).reverse();
        pointsHasChanged = true;
    }
    let lineData = points.filter((p)=>!Number.isNaN(p.y));
    const edgeCurveType = resolveEdgeCurveType(edge.curve);
    if (edgeCurveType !== "rounded") {
        lineData = fixCorners(lineData);
    }
    let curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinear$3e$__["curveLinear"];
    switch(edgeCurveType){
        case "linear":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinear$3e$__["curveLinear"];
            break;
        case "basis":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasis$3e$__["curveBasis"];
            break;
        case "cardinal":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$cardinal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCardinal$3e$__["curveCardinal"];
            break;
        case "bumpX":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpX__as__curveBumpX$3e$__["curveBumpX"];
            break;
        case "bumpY":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$bump$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__bumpY__as__curveBumpY$3e$__["curveBumpY"];
            break;
        case "catmullRom":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$catmullRom$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveCatmullRom$3e$__["curveCatmullRom"];
            break;
        case "monotoneX":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneX__as__curveMonotoneX$3e$__["curveMonotoneX"];
            break;
        case "monotoneY":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$monotone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__monotoneY__as__curveMonotoneY$3e$__["curveMonotoneY"];
            break;
        case "natural":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$natural$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveNatural$3e$__["curveNatural"];
            break;
        case "step":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveStep$3e$__["curveStep"];
            break;
        case "stepAfter":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepAfter__as__curveStepAfter$3e$__["curveStepAfter"];
            break;
        case "stepBefore":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$step$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__stepBefore__as__curveStepBefore$3e$__["curveStepBefore"];
            break;
        case "rounded":
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$linear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveLinear$3e$__["curveLinear"];
            break;
        default:
            curve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$curve$2f$basis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__curveBasis$3e$__["curveBasis"];
    }
    const { x, y } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getLineFunctionsWithOffset"])(edge);
    const lineFunction = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$shape$40$3$2e$2$2e$0$2f$node_modules$2f$d3$2d$shape$2f$src$2f$line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__line$3e$__["line"])().x(x).y(y).curve(curve);
    let strokeClasses;
    switch(edge.thickness){
        case "normal":
            strokeClasses = "edge-thickness-normal";
            break;
        case "thick":
            strokeClasses = "edge-thickness-thick";
            break;
        case "invisible":
            strokeClasses = "edge-thickness-invisible";
            break;
        default:
            strokeClasses = "edge-thickness-normal";
    }
    switch(edge.pattern){
        case "solid":
            strokeClasses += " edge-pattern-solid";
            break;
        case "dotted":
            strokeClasses += " edge-pattern-dotted";
            break;
        case "dashed":
            strokeClasses += " edge-pattern-dashed";
            break;
        default:
            strokeClasses += " edge-pattern-solid";
    }
    let svgPath;
    let linePath = edgeCurveType === "rounded" ? generateRoundedPath(applyMarkerOffsetsToPoints(lineData, edge), 5) : lineFunction(lineData);
    const edgeStyles = Array.isArray(edge.style) ? edge.style : [
        edge.style
    ];
    let strokeColor = edgeStyles.find((style)=>style === null || style === void 0 ? void 0 : style.startsWith("stroke:"));
    let animationClass = "";
    if (edge.animate) {
        animationClass = "edge-animation-fast";
    }
    if (edge.animation) {
        animationClass = "edge-animation-" + edge.animation;
    }
    let animatedEdge = false;
    if (edge.look === "handDrawn") {
        const rc = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$roughjs$40$4$2e$6$2e$6$2f$node_modules$2f$roughjs$2f$bundled$2f$rough$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].svg(elem);
        Object.assign([], lineData);
        const svgPathNode = rc.path(linePath, {
            roughness: 0.3,
            seed: handDrawnSeed
        });
        strokeClasses += " transition";
        svgPath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgPathNode).select("path").attr("id", "".concat(diagramId, "-").concat(edge.id)).attr("class", " " + strokeClasses + (edge.classes ? " " + edge.classes : "") + (animationClass ? " " + animationClass : "")).attr("style", edgeStyles ? edgeStyles.reduce((acc, style)=>acc + ";" + style, "") : "");
        let d = svgPath.attr("d");
        svgPath.attr("d", d);
        elem.node().appendChild(svgPath.node());
    } else {
        var _pathStyle_match;
        const stylesFromClasses = edgeClassStyles.join(";");
        const styles = edgeStyles ? edgeStyles.reduce((acc, style)=>acc + style + ";", "") : "";
        const pathStyle = (stylesFromClasses ? stylesFromClasses + ";" + styles + ";" : styles) + ";" + (edgeStyles ? edgeStyles.reduce((acc, style)=>acc + ";" + style, "") : "");
        svgPath = elem.append("path").attr("d", linePath).attr("id", "".concat(diagramId, "-").concat(edge.id)).attr("class", " " + strokeClasses + (edge.classes ? " " + edge.classes : "") + (animationClass ? " " + animationClass : "")).attr("style", pathStyle);
        strokeColor = (_pathStyle_match = pathStyle.match(/stroke:([^;]+)/)) === null || _pathStyle_match === void 0 ? void 0 : _pathStyle_match[1];
        animatedEdge = edge.animate === true || !!edge.animation || stylesFromClasses.includes("animation");
        const pathNode = svgPath.node();
        const len = typeof pathNode.getTotalLength === "function" ? pathNode.getTotalLength() : 0;
        const oValueS = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markerOffsets2"][edge.arrowTypeStart] || 0;
        const oValueE = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markerOffsets2"][edge.arrowTypeEnd] || 0;
        if (edge.look === "neo" && !animatedEdge) {
            const dashArray = edge.pattern === "dotted" || edge.pattern === "dashed" ? generateDashArray(len, oValueS, oValueE) : "0 ".concat(oValueS, " ").concat(len - oValueS - oValueE, " ").concat(oValueE);
            const mOffset = "stroke-dasharray: ".concat(dashArray, "; stroke-dashoffset: 0;");
            svgPath.attr("style", mOffset + svgPath.attr("style"));
        }
    }
    svgPath.attr("data-edge", true);
    svgPath.attr("data-et", "edge");
    svgPath.attr("data-id", edge.id);
    svgPath.attr("data-points", pointsStr);
    svgPath.attr("data-look", (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["handleUndefinedAttr"])(edge.look));
    if (edge.showPoints) {
        lineData.forEach((point3)=>{
            elem.append("circle").style("stroke", "red").style("fill", "red").attr("r", 1).attr("cx", point3.x).attr("cy", point3.y);
        });
    }
    let url = "";
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])().flowchart.arrowMarkerAbsolute || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])().state.arrowMarkerAbsolute) {
        url = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search;
        url = url.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("arrowTypeStart", edge.arrowTypeStart);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("arrowTypeEnd", edge.arrowTypeEnd);
    const useMargin = !animatedEdge && (edge === null || edge === void 0 ? void 0 : edge.look) === "neo";
    addEdgeMarkers(svgPath, edge, url, diagramId, diagramType, useMargin, strokeColor);
    const midIndex = Math.floor(points.length / 2);
    const point2 = points[midIndex];
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils_default"].isLabelCoordinateInPath(point2, svgPath.attr("d"))) {
        pointsHasChanged = true;
    }
    let paths = {};
    if (pointsHasChanged) {
        paths.updatedPath = points;
    }
    paths.originalPath = edge.points;
    return paths;
}, "insertEdge");
function generateRoundedPath(points, radius) {
    if (points.length < 2) {
        return "";
    }
    let path = "";
    const size = points.length;
    const epsilon = 1e-5;
    for(let i = 0; i < size; i++){
        const currPoint = points[i];
        const prevPoint = points[i - 1];
        const nextPoint = points[i + 1];
        if (i === 0) {
            path += "M".concat(currPoint.x, ",").concat(currPoint.y);
        } else if (i === size - 1) {
            path += "L".concat(currPoint.x, ",").concat(currPoint.y);
        } else {
            const dx1 = currPoint.x - prevPoint.x;
            const dy1 = currPoint.y - prevPoint.y;
            const dx2 = nextPoint.x - currPoint.x;
            const dy2 = nextPoint.y - currPoint.y;
            const len1 = Math.hypot(dx1, dy1);
            const len2 = Math.hypot(dx2, dy2);
            if (len1 < epsilon || len2 < epsilon) {
                path += "L".concat(currPoint.x, ",").concat(currPoint.y);
                continue;
            }
            const nx1 = dx1 / len1;
            const ny1 = dy1 / len1;
            const nx2 = dx2 / len2;
            const ny2 = dy2 / len2;
            const dot = nx1 * nx2 + ny1 * ny2;
            const clampedDot = Math.max(-1, Math.min(1, dot));
            const angle = Math.acos(clampedDot);
            if (angle < epsilon || Math.abs(Math.PI - angle) < epsilon) {
                path += "L".concat(currPoint.x, ",").concat(currPoint.y);
                continue;
            }
            const cutLen = Math.min(radius / Math.sin(angle / 2), len1 / 2, len2 / 2);
            const startX = currPoint.x - nx1 * cutLen;
            const startY = currPoint.y - ny1 * cutLen;
            const endX = currPoint.x + nx2 * cutLen;
            const endY = currPoint.y + ny2 * cutLen;
            path += "L".concat(startX, ",").concat(startY);
            path += "Q".concat(currPoint.x, ",").concat(currPoint.y, " ").concat(endX, ",").concat(endY);
        }
    }
    return path;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(generateRoundedPath, "generateRoundedPath");
function calculateDeltaAndAngle(point1, point2) {
    if (!point1 || !point2) {
        return {
            angle: 0,
            deltaX: 0,
            deltaY: 0
        };
    }
    const deltaX = point2.x - point1.x;
    const deltaY = point2.y - point1.y;
    const angle = Math.atan2(deltaY, deltaX);
    return {
        angle,
        deltaX,
        deltaY
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateDeltaAndAngle, "calculateDeltaAndAngle");
function applyMarkerOffsetsToPoints(points, edge) {
    const newPoints = points.map((point2)=>({
            ...point2
        }));
    if (points.length >= 2 && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markerOffsets"][edge.arrowTypeStart]) {
        const offsetValue = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markerOffsets"][edge.arrowTypeStart];
        const point1 = points[0];
        const point2 = points[1];
        const { angle } = calculateDeltaAndAngle(point1, point2);
        const offsetX = offsetValue * Math.cos(angle);
        const offsetY = offsetValue * Math.sin(angle);
        newPoints[0].x = point1.x + offsetX;
        newPoints[0].y = point1.y + offsetY;
    }
    const n = points.length;
    if (n >= 2 && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markerOffsets"][edge.arrowTypeEnd]) {
        const offsetValue = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$7BUUIJ7U$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markerOffsets"][edge.arrowTypeEnd];
        const point1 = points[n - 1];
        const point2 = points[n - 2];
        const { angle } = calculateDeltaAndAngle(point2, point1);
        const offsetX = offsetValue * Math.cos(angle);
        const offsetY = offsetValue * Math.sin(angle);
        newPoints[n - 1].x = point1.x - offsetX;
        newPoints[n - 1].y = point1.y - offsetY;
    }
    return newPoints;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(applyMarkerOffsetsToPoints, "applyMarkerOffsetsToPoints");
// src/rendering-util/rendering-elements/markers.js
var insertMarkers = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, markerArray, type, id)=>{
    markerArray.forEach((markerName)=>{
        markers[markerName](elem, type, id);
    });
}, "insertMarkers");
var extension = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].trace("Making markers for ", id);
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-extensionStart").attr("class", "marker extension " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 1,7 L18,13 V 1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-extensionEnd").attr("class", "marker extension " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 1,1 V 13 L18,7 Z");
    elem.append("marker").attr("id", id + "_" + type + "-extensionStart-margin").attr("class", "marker extension " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("viewBox", "0 0 20 14").append("polygon").attr("points", "10,7 18,13 18,1").style("stroke-width", 2).style("stroke-dasharray", "0");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-extensionEnd-margin").attr("class", "marker extension " + type).attr("refX", 9).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("viewBox", "0 0 20 14").append("polygon").attr("points", "10,1 10,13 18,7").style("stroke-width", 2).style("stroke-dasharray", "0");
}, "extension");
var composition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionStart").attr("class", "marker composition " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionEnd").attr("class", "marker composition " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionStart-margin").attr("class", "marker composition " + type).attr("refX", 15).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("viewBox", "0 0 15 15").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionEnd-margin").attr("class", "marker composition " + type).attr("refX", 3.5).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
}, "composition");
var aggregation = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationStart").attr("class", "marker aggregation " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationEnd").attr("class", "marker aggregation " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationStart-margin").attr("class", "marker aggregation " + type).attr("refX", 15).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 2).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationEnd-margin").attr("class", "marker aggregation " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 2).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
}, "aggregation");
var dependency = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyStart").attr("class", "marker dependency " + type).attr("refX", 6).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("path").attr("d", "M 5,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyEnd").attr("class", "marker dependency " + type).attr("refX", 13).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L14,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyStart-margin").attr("class", "marker dependency " + type).attr("refX", 4).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 5,7 L9,13 L1,7 L9,1 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyEnd-margin").attr("class", "marker dependency " + type).attr("refX", 16).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 18,7 L9,13 L14,7 L9,1 Z");
}, "dependency");
var lollipop = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopStart").attr("class", "marker lollipop " + type).attr("refX", 13).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6);
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopEnd").attr("class", "marker lollipop " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6);
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopStart-margin").attr("class", "marker lollipop " + type).attr("refX", 13).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("stroke-width", 2);
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopEnd-margin").attr("class", "marker lollipop " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("stroke-width", 2);
}, "lollipop");
var point = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("marker").attr("id", id + "_" + type + "-pointEnd").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", 5).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-pointStart").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", 4.5).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto").append("path").attr("d", "M 0 5 L 10 10 L 10 0 z").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-pointEnd-margin").attr("class", "marker " + type).attr("viewBox", "0 0 11.5 14").attr("refX", 11.5).attr("refY", 7).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 10.5).attr("markerHeight", 14).attr("orient", "auto").append("path").attr("d", "M 0 0 L 11.5 7 L 0 14 z").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-pointStart-margin").attr("class", "marker " + type).attr("viewBox", "0 0 11.5 14").attr("refX", 1).attr("refY", 7).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11.5).attr("markerHeight", 14).attr("orient", "auto").append("polygon").attr("points", "0,7 11.5,14 11.5,0").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
}, "point");
var circle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("marker").attr("id", id + "_" + type + "-circleEnd").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", 11).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-circleStart").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", -1).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-circleEnd-margin").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refY", 5).attr("refX", 12.25).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 14).attr("markerHeight", 14).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-circleStart-margin").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", -2).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 14).attr("markerHeight", 14).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
}, "circle");
var cross = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("marker").attr("id", id + "_" + type + "-crossEnd").attr("class", "marker cross " + type).attr("viewBox", "0 0 11 11").attr("refX", 12).attr("refY", 5.2).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("path").attr("d", "M 1,1 l 9,9 M 10,1 l -9,9").attr("class", "arrowMarkerPath").style("stroke-width", 2).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-crossStart").attr("class", "marker cross " + type).attr("viewBox", "0 0 11 11").attr("refX", -1).attr("refY", 5.2).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("path").attr("d", "M 1,1 l 9,9 M 10,1 l -9,9").attr("class", "arrowMarkerPath").style("stroke-width", 2).style("stroke-dasharray", "1,0");
    elem.append("marker").attr("id", id + "_" + type + "-crossEnd-margin").attr("class", "marker cross " + type).attr("viewBox", "0 0 15 15").attr("refX", 17.7).attr("refY", 7.5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 1,1 L 14,14 M 1,14 L 14,1").attr("class", "arrowMarkerPath").style("stroke-width", 2.5);
    elem.append("marker").attr("id", id + "_" + type + "-crossStart-margin").attr("class", "marker cross " + type).attr("viewBox", "0 0 15 15").attr("refX", -3.5).attr("refY", 7.5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 1,1 L 14,14 M 1,14 L 14,1").attr("class", "arrowMarkerPath").style("stroke-width", 2.5).style("stroke-dasharray", "1,0");
}, "cross");
var barb = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-barbEnd").attr("refX", 19).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M 19,7 L9,13 L14,7 L9,1 Z");
}, "barb");
var barbNeo = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { themeVariables } = config;
    const { transitionColor } = themeVariables;
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-barbEnd").attr("refX", 19).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "strokeWidth").attr("orient", "auto").append("path").attr("d", "M 19,7 L11,14 L13,7 L11,0 Z");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-barbEnd-margin").attr("refX", 17).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M 19,7 L11,14 L13,7 L11,0 Z").attr("fill", "".concat(transitionColor));
}, "barbNeo");
var only_one = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneStart").attr("class", "marker onlyOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").append("path").attr("d", "M9,0 L9,18 M15,0 L15,18");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneEnd").attr("class", "marker onlyOne " + type).attr("refX", 18).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").append("path").attr("d", "M3,0 L3,18 M9,0 L9,18");
}, "only_one");
var zero_or_one = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneStart").attr("class", "marker zeroOrOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto");
    startMarker.append("circle").attr("fill", "white").attr("cx", 21).attr("cy", 9).attr("r", 6);
    startMarker.append("path").attr("d", "M9,0 L9,18");
    const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneEnd").attr("class", "marker zeroOrOne " + type).attr("refX", 30).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto");
    endMarker.append("circle").attr("fill", "white").attr("cx", 9).attr("cy", 9).attr("r", 6);
    endMarker.append("path").attr("d", "M21,0 L21,18");
}, "zero_or_one");
var one_or_more = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreStart").attr("class", "marker oneOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").append("path").attr("d", "M0,18 Q 18,0 36,18 Q 18,36 0,18 M42,9 L42,27");
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreEnd").attr("class", "marker oneOrMore " + type).attr("refX", 27).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").append("path").attr("d", "M3,9 L3,27 M9,18 Q27,0 45,18 Q27,36 9,18");
}, "one_or_more");
var zero_or_more = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreStart").attr("class", "marker zeroOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto");
    startMarker.append("circle").attr("fill", "white").attr("cx", 48).attr("cy", 18).attr("r", 6);
    startMarker.append("path").attr("d", "M0,18 Q18,0 36,18 Q18,36 0,18");
    const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreEnd").attr("class", "marker zeroOrMore " + type).attr("refX", 39).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto");
    endMarker.append("circle").attr("fill", "white").attr("cx", 9).attr("cy", 18).attr("r", 6);
    endMarker.append("path").attr("d", "M21,18 Q39,0 57,18 Q39,36 21,18");
}, "zero_or_more");
var only_one_neo = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { themeVariables } = config;
    const { strokeWidth } = themeVariables;
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneStart").attr("class", "marker onlyOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M9,0 L9,18 M15,0 L15,18").attr("stroke-width", "".concat(strokeWidth));
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneEnd").attr("class", "marker onlyOne " + type).attr("refX", 18).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M3,0 L3,18 M9,0 L9,18").attr("stroke-width", "".concat(strokeWidth));
}, "only_one_neo");
var zero_or_one_neo = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { themeVariables } = config;
    const { strokeWidth, mainBkg } = themeVariables;
    const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneStart").attr("class", "marker zeroOrOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse");
    startMarker.append("circle").attr("fill", mainBkg !== null && mainBkg !== void 0 ? mainBkg : "white").attr("cx", 21).attr("cy", 9).attr("stroke-width", "".concat(strokeWidth)).attr("r", 6);
    startMarker.append("path").attr("d", "M9,0 L9,18").attr("stroke-width", "".concat(strokeWidth));
    const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneEnd").attr("class", "marker zeroOrOne " + type).attr("refX", 30).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto");
    endMarker.append("circle").attr("fill", mainBkg !== null && mainBkg !== void 0 ? mainBkg : "white").attr("cx", 9).attr("cy", 9).attr("stroke-width", "".concat(strokeWidth)).attr("r", 6);
    endMarker.append("path").attr("d", "M21,0 L21,18").attr("stroke-width", "".concat(strokeWidth));
}, "zero_or_one_neo");
var one_or_more_neo = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { themeVariables } = config;
    const { strokeWidth } = themeVariables;
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreStart").attr("class", "marker oneOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M0,18 Q 18,0 36,18 Q 18,36 0,18 M42,9 L42,27").attr("stroke-width", "".concat(strokeWidth));
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreEnd").attr("class", "marker oneOrMore " + type).attr("refX", 27).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M3,9 L3,27 M9,18 Q27,0 45,18 Q27,36 9,18").attr("stroke-width", "".concat(strokeWidth));
}, "one_or_more_neo");
var zero_or_more_neo = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { themeVariables } = config;
    const { strokeWidth, mainBkg } = themeVariables;
    const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreStart").attr("class", "marker zeroOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto");
    startMarker.append("circle").attr("fill", mainBkg !== null && mainBkg !== void 0 ? mainBkg : "white").attr("cx", 45.5).attr("cy", 18).attr("r", 6).attr("stroke-width", "".concat(strokeWidth));
    startMarker.append("path").attr("d", "M0,18 Q18,0 36,18 Q18,36 0,18").attr("stroke-width", "".concat(strokeWidth));
    const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreEnd").attr("class", "marker zeroOrMore " + type).attr("refX", 39).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse");
    endMarker.append("circle").attr("fill", mainBkg !== null && mainBkg !== void 0 ? mainBkg : "white").attr("cx", 11).attr("cy", 18).attr("r", 6).attr("stroke-width", "".concat(strokeWidth));
    endMarker.append("path").attr("d", "M21,18 Q39,0 57,18 Q39,36 21,18").attr("stroke-width", "".concat(strokeWidth));
}, "zero_or_more_neo");
var requirement_arrow = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_arrowEnd").attr("refX", 20).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").append("path").attr("d", "M0,0\n      L20,10\n      M20,10\n      L0,20");
}, "requirement_arrow");
var requirement_arrow_neo = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { themeVariables } = config;
    const { strokeWidth } = themeVariables;
    elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_arrowEnd").attr("refX", 20).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("stroke-width", "".concat(strokeWidth)).attr("viewBox", "0 0 25 20").append("path").attr("d", "M0,0\n      L20,10\n      M20,10\n      L0,20").attr("stroke-linejoin", "miter");
}, "requirement_arrow_neo");
var requirement_contains = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const containsNode = elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_containsStart").attr("refX", 0).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").append("g");
    containsNode.append("circle").attr("cx", 10).attr("cy", 10).attr("r", 9).attr("fill", "none");
    containsNode.append("line").attr("x1", 1).attr("x2", 19).attr("y1", 10).attr("y2", 10);
    containsNode.append("line").attr("y1", 1).attr("y2", 19).attr("x1", 10).attr("x2", 10);
}, "requirement_contains");
var requirement_contains_neo = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, type, id)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { themeVariables } = config;
    const { strokeWidth } = themeVariables;
    const containsNode = elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_containsStart").attr("refX", 0).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("g");
    containsNode.append("circle").attr("cx", 10).attr("cy", 10).attr("r", 9).attr("fill", "none");
    containsNode.append("line").attr("x1", 1).attr("x2", 19).attr("y1", 10).attr("y2", 10);
    containsNode.append("line").attr("y1", 1).attr("y2", 19).attr("x1", 10).attr("x2", 10);
    containsNode.selectAll("*").attr("stroke-width", "".concat(strokeWidth));
}, "requirement_contains_neo");
var markers = {
    extension,
    composition,
    aggregation,
    dependency,
    lollipop,
    point,
    circle,
    cross,
    barb,
    barbNeo,
    only_one,
    zero_or_one,
    one_or_more,
    zero_or_more,
    only_one_neo,
    zero_or_one_neo,
    one_or_more_neo,
    zero_or_more_neo,
    requirement_arrow,
    requirement_contains,
    requirement_arrow_neo,
    requirement_contains_neo
};
var markers_default = insertMarkers;
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-FWX5IMBZ.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getRegisteredLayoutAlgorithm",
    ()=>getRegisteredLayoutAlgorithm,
    "registerLayoutLoaders",
    ()=>registerLayoutLoaders,
    "render",
    ()=>render
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$52WLFC77$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-52WLFC77.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ZGVPDNZ5.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
;
;
;
;
;
;
// src/internals.ts
var internalHelpers = {
    common: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"],
    getConfig: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"],
    insertCluster: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["insertCluster"],
    insertEdge: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$52WLFC77$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["insertEdge"],
    insertEdgeLabel: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$52WLFC77$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["insertEdgeLabel"],
    insertMarkers: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$52WLFC77$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markers_default"],
    insertNode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["insertNode"],
    interpolateToCurve: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["interpolateToCurve"],
    labelHelper: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ZGVPDNZ5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["labelHelper"],
    log: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"],
    positionEdgeLabel: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$52WLFC77$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["positionEdgeLabel"]
};
// src/rendering-util/render.ts
var layoutAlgorithms = {};
var registerLayoutLoaders = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((loaders)=>{
    for (const loader of loaders){
        layoutAlgorithms[loader.name] = loader;
    }
}, "registerLayoutLoaders");
var registerDefaultLayoutLoaders = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    registerLayoutLoaders([
        {
            name: "dagre",
            loader: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async ()=>await __turbopack_context__.A("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/dagre-VKFMJZFB.mjs [app-client] (ecmascript, async loader)"), "loader")
        },
        {
            name: "swimlane",
            loader: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async ()=>await __turbopack_context__.A("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/swimlanes-5IMT3BWC.mjs [app-client] (ecmascript, async loader)"), "loader")
        },
        ...("TURBOPACK compile-time truthy", 1) ? [
            {
                name: "cose-bilkent",
                loader: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async ()=>await __turbopack_context__.A("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/cose-bilkent-JH36ORCC.mjs [app-client] (ecmascript, async loader)"), "loader")
            }
        ] : "TURBOPACK unreachable"
    ]);
}, "registerDefaultLayoutLoaders");
registerDefaultLayoutLoaders();
var render = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (data4Layout, svg, positions)=>{
    if (!(data4Layout.layoutAlgorithm in layoutAlgorithms)) {
        throw new Error("Unknown layout algorithm: ".concat(data4Layout.layoutAlgorithm));
    }
    if (data4Layout.diagramId) {
        for (const node of data4Layout.nodes){
            const originalDomId = node.domId || node.id;
            node.domId = "".concat(data4Layout.diagramId, "-").concat(originalDomId);
        }
    }
    const layoutDefinition = layoutAlgorithms[data4Layout.layoutAlgorithm];
    const layoutRenderer = await layoutDefinition.loader();
    const { theme, themeVariables } = data4Layout.config;
    const { useGradient, gradientStart, gradientStop } = themeVariables;
    const svgId = svg.attr("id");
    svg.append("defs").append("filter").attr("id", "".concat(svgId, "-drop-shadow")).attr("height", "130%").attr("width", "130%").append("feDropShadow").attr("dx", "4").attr("dy", "4").attr("stdDeviation", 0).attr("flood-opacity", "0.06").attr("flood-color", "".concat((theme === null || theme === void 0 ? void 0 : theme.includes("dark")) ? "#FFFFFF" : "#000000"));
    svg.append("defs").append("filter").attr("id", "".concat(svgId, "-drop-shadow-small")).attr("height", "150%").attr("width", "150%").append("feDropShadow").attr("dx", "2").attr("dy", "2").attr("stdDeviation", 0).attr("flood-opacity", "0.06").attr("flood-color", "".concat((theme === null || theme === void 0 ? void 0 : theme.includes("dark")) ? "#FFFFFF" : "#000000"));
    if (useGradient) {
        const gradient = svg.append("linearGradient").attr("id", svg.attr("id") + "-gradient").attr("gradientUnits", "objectBoundingBox").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
        gradient.append("svg:stop").attr("offset", "0%").attr("stop-color", gradientStart).attr("stop-opacity", 1);
        gradient.append("svg:stop").attr("offset", "100%").attr("stop-color", gradientStop).attr("stop-opacity", 1);
    }
    return layoutRenderer.render(data4Layout, svg, internalHelpers, {
        algorithm: layoutDefinition.algorithm
    }, positions);
}, "render");
var getRegisteredLayoutAlgorithm = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    let algorithm = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "", { fallback = "dagre" } = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    if (algorithm in layoutAlgorithms) {
        return algorithm;
    }
    if (fallback in layoutAlgorithms) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("Layout algorithm ".concat(algorithm, " is not registered. Using ").concat(fallback, " as fallback."));
        return fallback;
    }
    throw new Error("Both layout algorithms ".concat(algorithm, " and ").concat(fallback, " are not registered."));
}, "getRegisteredLayoutAlgorithm");
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_2be288a9._.js.map