(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-JWPE2WC7.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "populateCommonDb",
    ()=>populateCommonDb
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
;
// src/diagrams/common/populateCommonDb.ts
function populateCommonDb(ast, db) {
    if (ast.accDescr) {
        var _db_setAccDescription;
        (_db_setAccDescription = db.setAccDescription) === null || _db_setAccDescription === void 0 ? void 0 : _db_setAccDescription.call(db, ast.accDescr);
    }
    if (ast.accTitle) {
        var _db_setAccTitle;
        (_db_setAccTitle = db.setAccTitle) === null || _db_setAccTitle === void 0 ? void 0 : _db_setAccTitle.call(db, ast.accTitle);
    }
    if (ast.title) {
        var _db_setDiagramTitle;
        (_db_setDiagramTitle = db.setDiagramTitle) === null || _db_setDiagramTitle === void 0 ? void 0 : _db_setDiagramTitle.call(db, ast.title);
    }
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(populateCommonDb, "populateCommonDb");
;
}),
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/cynefinDiagram-TSTJHNR4.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "diagram",
    ()=>diagram
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-JWPE2WC7.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-VAUOI2AC.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/diagrams/cynefin/cynefinParser.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs [app-client] (ecmascript) <locals>");
;
;
;
;
;
;
;
// src/diagrams/cynefin/cynefinDb.ts
var createDefaultData = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>({
        domains: /* @__PURE__ */ new Map(),
        transitions: []
    }), "createDefaultData");
var data = createDefaultData();
var getDomains = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>data.domains, "getDomains");
var getTransitions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>data.transitions, "getTransitions");
var setDomains = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((blocks)=>{
    if (!blocks) {
        return;
    }
    for (const block of blocks){
        const domainName = block.domain;
        var _block_items;
        const items = ((_block_items = block.items) !== null && _block_items !== void 0 ? _block_items : []).map((item)=>({
                label: item.label
            }));
        data.domains.set(domainName, {
            name: domainName,
            items
        });
    }
}, "setDomains");
var setTransitions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((transitions)=>{
    if (!transitions) {
        return;
    }
    data.transitions = transitions.filter((t)=>{
        if (t.from === t.to) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn('Cynefin: self-loop transition on domain "'.concat(t.from, '" is not meaningful and will be skipped.'));
            return false;
        }
        return true;
    }).map((t)=>({
            from: t.from,
            to: t.to,
            label: t.label || void 0
        }));
}, "setTransitions");
var getConfig2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])({
        ...__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultConfig_default"].cynefin,
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])().cynefin
    });
}, "getConfig");
var clear2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clear"])();
    data = createDefaultData();
}, "clear");
var db = {
    getDomains,
    getTransitions,
    setDomains,
    setTransitions,
    getConfig: getConfig2,
    clear: clear2,
    setAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccTitle"],
    getAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccTitle"],
    setDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setDiagramTitle"],
    getDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDiagramTitle"],
    getAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccDescription"],
    setAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccDescription"]
};
// src/diagrams/cynefin/cynefinParser.ts
var populate = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((ast)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["populateCommonDb"])(ast, db);
    db.setDomains(ast.domains);
    db.setTransitions(ast.transitions);
}, "populate");
var parser = {
    parse: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (input)=>{
        const ast = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["parse"])("cynefin", input);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(ast);
        populate(ast);
    }, "parse")
};
// src/diagrams/cynefin/cynefinBoundaries.ts
function seededRandom(seed) {
    let t = seed + 1831565813 | 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(seededRandom, "seededRandom");
function hashString(str) {
    let hash = 0;
    for(let i = 0; i < str.length; i++){
        const ch = str.charCodeAt(i);
        hash = (hash << 5) - hash + ch;
        hash |= 0;
    }
    return hash;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(hashString, "hashString");
function resolveSeed(configuredSeed, id) {
    if (typeof configuredSeed === "number" && Number.isFinite(configuredSeed) && configuredSeed !== 0) {
        return configuredSeed;
    }
    return hashString(id);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(resolveSeed, "resolveSeed");
function generateFoldPath(width, height, seed, amplitudeOverride) {
    const cx = width / 2;
    const amplitude = amplitudeOverride !== null && amplitudeOverride !== void 0 ? amplitudeOverride : width * 0.015;
    const segments = 7;
    const segHeight = height / segments;
    const points = [];
    for(let i = 0; i <= segments; i++){
        const jitter = seededRandom(seed + i * 17) * amplitude * 2 - amplitude;
        points.push({
            x: cx + jitter,
            y: i * segHeight
        });
    }
    let d = "M".concat(points[0].x, ",").concat(points[0].y);
    for(let i = 0; i < points.length - 1; i++){
        const p0 = points[i];
        const p1 = points[i + 1];
        const midY = (p0.y + p1.y) / 2;
        const dir = i % 2 === 0 ? 1 : -1;
        const offset = amplitude * 1.5 * dir * seededRandom(seed + i * 31 + 7);
        const cp1x = p0.x + offset;
        const cp1y = midY;
        const cp2x = p1.x - offset;
        const cp2y = midY;
        d += " C".concat(cp1x, ",").concat(cp1y, " ").concat(cp2x, ",").concat(cp2y, " ").concat(p1.x, ",").concat(p1.y);
    }
    return d;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(generateFoldPath, "generateFoldPath");
function generateHorizontalBoundary(width, height, seed, amplitudeOverride) {
    const cy = height / 2;
    const amplitude = amplitudeOverride !== null && amplitudeOverride !== void 0 ? amplitudeOverride : height * 0.015;
    const segments = 7;
    const segWidth = width / segments;
    const points = [];
    for(let i = 0; i <= segments; i++){
        const jitter = seededRandom(seed + i * 23) * amplitude * 2 - amplitude;
        points.push({
            x: i * segWidth,
            y: cy + jitter
        });
    }
    let d = "M".concat(points[0].x, ",").concat(points[0].y);
    for(let i = 0; i < points.length - 1; i++){
        const p0 = points[i];
        const p1 = points[i + 1];
        const midX = (p0.x + p1.x) / 2;
        const dir = i % 2 === 0 ? 1 : -1;
        const offset = amplitude * 1.5 * dir * seededRandom(seed + i * 37 + 11);
        const cp1x = midX;
        const cp1y = p0.y + offset;
        const cp2x = midX;
        const cp2y = p1.y - offset;
        d += " C".concat(cp1x, ",").concat(cp1y, " ").concat(cp2x, ",").concat(cp2y, " ").concat(p1.x, ",").concat(p1.y);
    }
    return d;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(generateHorizontalBoundary, "generateHorizontalBoundary");
function generateCliffPath(width, height) {
    const cx = width / 2;
    const topY = height * 0.5;
    const bottomY = height;
    const amplitude = width * 0.03;
    return [
        "M".concat(cx, ",").concat(topY),
        "C".concat(cx + amplitude, ",").concat(topY + (bottomY - topY) * 0.2),
        "".concat(cx - amplitude * 1.5, ",").concat(topY + (bottomY - topY) * 0.55),
        "".concat(cx + amplitude * 0.5, ",").concat(topY + (bottomY - topY) * 0.75),
        "C".concat(cx - amplitude, ",").concat(topY + (bottomY - topY) * 0.85),
        "".concat(cx + amplitude * 0.3, ",").concat(topY + (bottomY - topY) * 0.95),
        "".concat(cx, ",").concat(bottomY)
    ].join(" ");
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(generateCliffPath, "generateCliffPath");
function generateConfusionPath(cx, cy, rx, ry) {
    return [
        "M".concat(cx - rx, ",").concat(cy),
        "A".concat(rx, ",").concat(ry, " 0 1,1 ").concat(cx + rx, ",").concat(cy),
        "A".concat(rx, ",").concat(ry, " 0 1,1 ").concat(cx - rx, ",").concat(cy),
        "Z"
    ].join(" ");
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(generateConfusionPath, "generateConfusionPath");
// src/diagrams/cynefin/cynefinRenderer.ts
var DOMAIN_META = {
    complex: {
        model: "Probe \u2192 Sense \u2192 Respond",
        practice: "Emergent Practices"
    },
    complicated: {
        model: "Sense \u2192 Analyse \u2192 Respond",
        practice: "Good Practices"
    },
    clear: {
        model: "Sense \u2192 Categorise \u2192 Respond",
        practice: "Best Practices"
    },
    chaotic: {
        model: "Act \u2192 Sense \u2192 Respond",
        practice: "Novel Practices"
    },
    confusion: {
        model: "",
        practice: "Disorder"
    }
};
var getDomainLayouts = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((width, height)=>{
    const hw = width / 2;
    const hh = height / 2;
    return {
        complex: {
            cx: hw / 2,
            cy: hh / 2,
            x: 0,
            y: 0,
            w: hw,
            h: hh
        },
        complicated: {
            cx: hw + hw / 2,
            cy: hh / 2,
            x: hw,
            y: 0,
            w: hw,
            h: hh
        },
        chaotic: {
            cx: hw / 2,
            cy: hh + hh / 2,
            x: 0,
            y: hh,
            w: hw,
            h: hh
        },
        clear: {
            cx: hw + hw / 2,
            cy: hh + hh / 2,
            x: hw,
            y: hh,
            w: hw,
            h: hh
        },
        confusion: {
            cx: hw,
            cy: hh,
            x: hw * 0.7,
            y: hh * 0.7,
            w: hw * 0.6,
            h: hh * 0.6
        }
    };
}, "getDomainLayouts");
var getCynefinDomainColors = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    const defaultThemeVariables = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getThemeVariables"])();
    const currentConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const themeVariables = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])(defaultThemeVariables, currentConfig.themeVariables);
    return themeVariables.cynefin;
}, "getCynefinDomainColors");
var MAX_CONFUSION_ITEMS = 3;
var draw = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((_text, id, _version, diagram2)=>{
    const db2 = diagram2.db;
    const domains = db2.getDomains();
    const transitions = db2.getTransitions();
    const title = db2.getDiagramTitle();
    const accTitle = db2.getAccTitle();
    const accDescription = db2.getAccDescription();
    const config = db2.getConfig();
    const domainColors = getCynefinDomainColors();
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Rendering Cynefin diagram");
    const width = config.width;
    const height = config.height;
    const padding = config.padding;
    const showDomainDescriptions = config.showDomainDescriptions;
    const boundaryAmplitude = config.boundaryAmplitude;
    const totalWidth = width + padding * 2;
    const totalHeight = height + padding * 2;
    const domainBg = {
        complex: domainColors.complexBg,
        complicated: domainColors.complicatedBg,
        clear: domainColors.clearBg,
        chaotic: domainColors.chaoticBg,
        confusion: domainColors.confusionBg
    };
    const svg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["selectSvgElement"])(id);
    var _config_useMaxWidth;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["configureSvgSize"])(svg, totalHeight, totalWidth, (_config_useMaxWidth = config.useMaxWidth) !== null && _config_useMaxWidth !== void 0 ? _config_useMaxWidth : true);
    svg.attr("viewBox", "0 0 ".concat(totalWidth, " ").concat(totalHeight));
    if (accTitle) {
        svg.append("title").text(accTitle);
    }
    if (accDescription) {
        svg.append("desc").text(accDescription);
    }
    const root = svg.append("g").attr("transform", "translate(".concat(padding, ", ").concat(padding, ")"));
    const layouts = getDomainLayouts(width, height);
    const seed = resolveSeed(config.seed, id);
    const bgGroup = root.append("g").attr("class", "cynefin-backgrounds");
    const quadrantDomains = [
        "complex",
        "complicated",
        "chaotic",
        "clear"
    ];
    for (const domainName of quadrantDomains){
        const layout = layouts[domainName];
        bgGroup.append("rect").attr("class", "cynefinDomain").attr("x", layout.x).attr("y", layout.y).attr("width", layout.w).attr("height", layout.h).attr("fill", domainBg[domainName]).attr("fill-opacity", 0.4).attr("stroke", "none");
    }
    const boundaryGroup = root.append("g").attr("class", "cynefin-boundaries");
    boundaryGroup.append("path").attr("class", "cynefinBoundary").attr("d", generateFoldPath(width, height, seed, boundaryAmplitude)).attr("fill", "none");
    boundaryGroup.append("path").attr("class", "cynefinBoundary").attr("d", generateHorizontalBoundary(width, height, seed + 100, boundaryAmplitude)).attr("fill", "none");
    boundaryGroup.append("path").attr("class", "cynefinCliff").attr("d", generateCliffPath(width, height)).attr("fill", "none");
    const confusionRx = width * 0.15;
    const confusionRy = height * 0.15;
    root.append("path").attr("class", "cynefinConfusion").attr("d", generateConfusionPath(width / 2, height / 2, confusionRx, confusionRy)).attr("fill", domainBg.confusion).attr("fill-opacity", 0.5);
    const labelGroup = root.append("g").attr("class", "cynefin-labels");
    for (const domainName of quadrantDomains){
        const layout = layouts[domainName];
        labelGroup.append("text").attr("class", "cynefinDomainLabel").attr("x", layout.cx).attr("y", showDomainDescriptions ? layout.cy - 30 : layout.cy).attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(domainName.charAt(0).toUpperCase() + domainName.slice(1));
    }
    labelGroup.append("text").attr("class", "cynefinDomainLabel").attr("x", width / 2).attr("y", showDomainDescriptions ? height / 2 - 10 : height / 2).attr("text-anchor", "middle").attr("dominant-baseline", "middle").text("Confusion");
    if (showDomainDescriptions) {
        const subtitleGroup = root.append("g").attr("class", "cynefin-subtitles");
        for (const domainName of quadrantDomains){
            const layout = layouts[domainName];
            const meta = DOMAIN_META[domainName];
            subtitleGroup.append("text").attr("class", "cynefinSubtitle").attr("x", layout.cx).attr("y", layout.cy - 10).attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(meta.model);
            subtitleGroup.append("text").attr("class", "cynefinSubtitle").attr("x", layout.cx).attr("y", layout.cy + 5).attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(meta.practice);
        }
        subtitleGroup.append("text").attr("class", "cynefinSubtitle").attr("x", width / 2).attr("y", height / 2 + 8).attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(DOMAIN_META.confusion.practice);
    }
    const itemGroup = root.append("g").attr("class", "cynefin-items");
    const itemHeight = 26;
    const itemPaddingX = 10;
    const allDomains = [
        "complex",
        "complicated",
        "chaotic",
        "clear",
        "confusion"
    ];
    for (const domainName of allDomains){
        const domain = domains.get(domainName);
        if (!domain || domain.items.length === 0) {
            continue;
        }
        const layout = layouts[domainName];
        const isConfusion = domainName === "confusion";
        let itemsToRender = domain.items;
        let overflowCount = 0;
        if (isConfusion && domain.items.length > MAX_CONFUSION_ITEMS) {
            overflowCount = domain.items.length - MAX_CONFUSION_ITEMS;
            itemsToRender = domain.items.slice(0, MAX_CONFUSION_ITEMS);
        }
        let startY;
        if (isConfusion) {
            const labelOffset = showDomainDescriptions ? 22 : 14;
            startY = layout.cy + labelOffset;
        } else {
            startY = layout.cy + (showDomainDescriptions ? 25 : 15);
        }
        [
            ...itemsToRender
        ].forEach((item, idx)=>{
            const itemY = startY + idx * (itemHeight + 4);
            const g = itemGroup.append("g");
            const textEl = g.append("text").attr("class", "cynefinItemText").attr("x", 0).attr("y", itemHeight / 2).attr("text-anchor", "middle").attr("dominant-baseline", "central").text(item.label);
            let measuredWidth = item.label.length * 7;
            const textNode = textEl.node();
            if (textNode && typeof textNode.getBBox === "function") {
                const bbox = textNode.getBBox();
                if (bbox.width > 0) {
                    measuredWidth = bbox.width;
                }
            }
            const badgeWidth = measuredWidth + itemPaddingX * 2;
            const itemX = layout.cx - badgeWidth / 2;
            g.attr("transform", "translate(".concat(itemX, ", ").concat(itemY, ")"));
            g.insert("rect", "text").attr("class", "cynefinItem").attr("x", 0).attr("y", 0).attr("width", badgeWidth).attr("height", itemHeight).attr("rx", 4).attr("ry", 4).attr("fill", domainBg[domainName]).attr("fill-opacity", 0.95);
            textEl.attr("x", badgeWidth / 2).attr("y", itemHeight / 2);
        });
        if (overflowCount > 0) {
            const overflowY = startY + itemsToRender.length * (itemHeight + 4);
            const overflowLabel = "+".concat(overflowCount, " more");
            const g = itemGroup.append("g");
            const textEl = g.append("text").attr("class", "cynefinItemText").attr("x", 0).attr("y", itemHeight / 2).attr("text-anchor", "middle").attr("dominant-baseline", "central").text(overflowLabel);
            let measuredWidth = overflowLabel.length * 7;
            const textNode = textEl.node();
            if (textNode && typeof textNode.getBBox === "function") {
                const bbox = textNode.getBBox();
                if (bbox.width > 0) {
                    measuredWidth = bbox.width;
                }
            }
            const badgeWidth = measuredWidth + itemPaddingX * 2;
            const itemX = layout.cx - badgeWidth / 2;
            g.attr("transform", "translate(".concat(itemX, ", ").concat(overflowY, ")"));
            g.insert("rect", "text").attr("class", "cynefinItemOverflow").attr("x", 0).attr("y", 0).attr("width", badgeWidth).attr("height", itemHeight).attr("rx", 4).attr("ry", 4).attr("fill", domainBg[domainName]).attr("fill-opacity", 0.6);
            textEl.attr("x", badgeWidth / 2).attr("y", itemHeight / 2);
        }
    }
    if (transitions.length > 0) {
        const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
        const markerId = "cynefin-arrow-".concat(id);
        defs.append("marker").attr("id", markerId).attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto-start-reverse").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("class", "cynefinArrowHead");
        const arrowGroup = root.append("g").attr("class", "cynefin-arrows");
        transitions.forEach((transition)=>{
            const fromLayout = layouts[transition.from];
            const toLayout = layouts[transition.to];
            if (!fromLayout || !toLayout) {
                return;
            }
            if (transition.from === transition.to) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn('Cynefin renderer: skipping self-loop on domain "'.concat(transition.from, '"'));
                return;
            }
            const x1 = fromLayout.cx;
            const y1 = fromLayout.cy;
            const x2 = toLayout.cx;
            const y2 = toLayout.cy;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const offsetAmount = len * 0.15;
            const nx = -dy / len;
            const ny = dx / len;
            const cpx = mx + nx * offsetAmount;
            const cpy = my + ny * offsetAmount;
            arrowGroup.append("path").attr("class", "cynefinArrowLine").attr("d", "M".concat(x1, ",").concat(y1, " Q").concat(cpx, ",").concat(cpy, " ").concat(x2, ",").concat(y2)).attr("fill", "none").attr("marker-end", "url(#".concat(markerId, ")"));
            if (transition.label) {
                arrowGroup.append("text").attr("class", "cynefinArrowLabel").attr("x", cpx).attr("y", cpy - 6).attr("text-anchor", "middle").attr("dominant-baseline", "auto").text(transition.label);
            }
        });
    }
    if (title) {
        root.append("text").attr("class", "cynefinTitle").attr("x", width / 2).attr("y", -padding / 2).attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(title);
    }
}, "draw");
var renderer = {
    draw
};
// src/diagrams/cynefin/styles.ts
var getCynefinTheme = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    const defaultThemeVariables = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getThemeVariables"])();
    const currentConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const themeVariables = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])(defaultThemeVariables, currentConfig.themeVariables);
    return themeVariables.cynefin;
}, "getCynefinTheme");
var styles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    const t = getCynefinTheme();
    return "\n	.cynefinDomain {\n		stroke: none;\n	}\n	.cynefinDomainLabel {\n		font-size: ".concat(t.domainFontSize, "px;\n		font-weight: bold;\n		fill: ").concat(t.labelColor, ";\n	}\n	.cynefinSubtitle {\n		font-size: ").concat(t.itemFontSize - 1, "px;\n		fill: ").concat(t.textColor, ";\n		font-style: italic;\n	}\n	.cynefinItem {\n		fill-opacity: 0.95;\n		stroke: ").concat(t.boundaryColor, ";\n		stroke-width: 1;\n	}\n	.cynefinItemText {\n		font-size: ").concat(t.itemFontSize, "px;\n		fill: ").concat(t.textColor, ";\n	}\n	.cynefinItemOverflow {\n		fill-opacity: 0.6;\n		stroke: ").concat(t.boundaryColor, ";\n		stroke-width: 1;\n		stroke-dasharray: 3 2;\n	}\n	.cynefinBoundary {\n		stroke: ").concat(t.boundaryColor, ";\n		stroke-width: ").concat(t.boundaryWidth, ";\n		stroke-dasharray: 6 3;\n	}\n	.cynefinCliff {\n		stroke: ").concat(t.cliffColor, ";\n		stroke-width: ").concat(t.cliffWidth, ";\n	}\n	.cynefinConfusion {\n		stroke: ").concat(t.boundaryColor, ";\n		stroke-width: 1.5;\n		stroke-dasharray: 4 2;\n	}\n	.cynefinArrowLine {\n		stroke: ").concat(t.arrowColor, ";\n		stroke-width: ").concat(t.arrowWidth, ";\n		fill: none;\n	}\n	.cynefinArrowHead {\n		fill: ").concat(t.arrowColor, ";\n		stroke: none;\n	}\n	.cynefinArrowLabel {\n		font-size: ").concat(t.itemFontSize - 1, "px;\n		fill: ").concat(t.textColor, ";\n	}\n	.cynefinTitle {\n		font-size: ").concat(t.domainFontSize + 2, "px;\n		font-weight: bold;\n		fill: ").concat(t.labelColor, ";\n	}\n	");
}, "styles");
var styles_default = styles;
// src/diagrams/cynefin/cynefinDiagram.ts
var diagram = {
    parser,
    db,
    renderer,
    styles: styles_default
};
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_0daf5b30._.js.map