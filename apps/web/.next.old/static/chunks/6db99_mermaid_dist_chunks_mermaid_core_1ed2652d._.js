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
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/diagram-WEI45ONY.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
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
// src/diagrams/radar/parser.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs [app-client] (ecmascript) <locals>");
;
;
;
;
;
;
// src/diagrams/radar/db.ts
var defaultOptions = {
    showLegend: true,
    ticks: 5,
    max: null,
    min: 0,
    graticule: "circle"
};
var defaultRadarData = {
    axes: [],
    curves: [],
    options: defaultOptions
};
var data = structuredClone(defaultRadarData);
var DEFAULT_RADAR_CONFIG = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultConfig_default"].radar;
var getConfig2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])({
        ...DEFAULT_RADAR_CONFIG,
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])().radar
    });
    return config;
}, "getConfig");
var getAxes = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>data.axes, "getAxes");
var getCurves = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>data.curves, "getCurves");
var getOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>data.options, "getOptions");
var setAxes = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((axes)=>{
    data.axes = axes.map((axis)=>{
        var _axis_label;
        return {
            name: axis.name,
            label: (_axis_label = axis.label) !== null && _axis_label !== void 0 ? _axis_label : axis.name
        };
    });
}, "setAxes");
var setCurves = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((curves)=>{
    data.curves = curves.map((curve)=>{
        var _curve_label;
        return {
            name: curve.name,
            label: (_curve_label = curve.label) !== null && _curve_label !== void 0 ? _curve_label : curve.name,
            entries: computeCurveEntries(curve.entries)
        };
    });
}, "setCurves");
var computeCurveEntries = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((entries)=>{
    if (entries[0].axis == void 0) {
        return entries.map((entry)=>entry.value);
    }
    const axes = getAxes();
    if (axes.length === 0) {
        throw new Error("Axes must be populated before curves for reference entries");
    }
    return axes.map((axis)=>{
        const entry = entries.find((entry2)=>{
            var _entry2_axis;
            return ((_entry2_axis = entry2.axis) === null || _entry2_axis === void 0 ? void 0 : _entry2_axis.$refText) === axis.name;
        });
        if (entry === void 0) {
            throw new Error("Missing entry for axis " + axis.label);
        }
        return entry.value;
    });
}, "computeCurveEntries");
var setOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    var _optionMap_showLegend, _optionMap_ticks, _optionMap_max, _optionMap_min, _optionMap_graticule;
    const optionMap = options.reduce((acc, option)=>{
        acc[option.name] = option;
        return acc;
    }, {});
    var _optionMap_showLegend_value, _optionMap_ticks_value, _optionMap_max_value, _optionMap_min_value, _optionMap_graticule_value;
    data.options = {
        showLegend: (_optionMap_showLegend_value = (_optionMap_showLegend = optionMap.showLegend) === null || _optionMap_showLegend === void 0 ? void 0 : _optionMap_showLegend.value) !== null && _optionMap_showLegend_value !== void 0 ? _optionMap_showLegend_value : defaultOptions.showLegend,
        ticks: (_optionMap_ticks_value = (_optionMap_ticks = optionMap.ticks) === null || _optionMap_ticks === void 0 ? void 0 : _optionMap_ticks.value) !== null && _optionMap_ticks_value !== void 0 ? _optionMap_ticks_value : defaultOptions.ticks,
        max: (_optionMap_max_value = (_optionMap_max = optionMap.max) === null || _optionMap_max === void 0 ? void 0 : _optionMap_max.value) !== null && _optionMap_max_value !== void 0 ? _optionMap_max_value : defaultOptions.max,
        min: (_optionMap_min_value = (_optionMap_min = optionMap.min) === null || _optionMap_min === void 0 ? void 0 : _optionMap_min.value) !== null && _optionMap_min_value !== void 0 ? _optionMap_min_value : defaultOptions.min,
        graticule: (_optionMap_graticule_value = (_optionMap_graticule = optionMap.graticule) === null || _optionMap_graticule === void 0 ? void 0 : _optionMap_graticule.value) !== null && _optionMap_graticule_value !== void 0 ? _optionMap_graticule_value : defaultOptions.graticule
    };
}, "setOptions");
var clear2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clear"])();
    data = structuredClone(defaultRadarData);
}, "clear");
var db = {
    getAxes,
    getCurves,
    getOptions,
    setAxes,
    setCurves,
    setOptions,
    getConfig: getConfig2,
    clear: clear2,
    setAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccTitle"],
    getAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccTitle"],
    setDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setDiagramTitle"],
    getDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDiagramTitle"],
    getAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccDescription"],
    setAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccDescription"]
};
;
var populate = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((ast)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["populateCommonDb"])(ast, db);
    const { axes, curves, options } = ast;
    db.setAxes(axes);
    db.setCurves(curves);
    db.setOptions(options);
}, "populate");
var parser = {
    parse: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (input)=>{
        const ast = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["parse"])("radar", input);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(ast);
        populate(ast);
    }, "parse")
};
// src/diagrams/radar/renderer.ts
var draw = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((_text, id, _version, diagram2)=>{
    const db2 = diagram2.db;
    const axes = db2.getAxes();
    const curves = db2.getCurves();
    const options = db2.getOptions();
    const config = db2.getConfig();
    const title = db2.getDiagramTitle();
    const svg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["selectSvgElement"])(id);
    const g = drawFrame(svg, config);
    var _options_max;
    const maxValue = (_options_max = options.max) !== null && _options_max !== void 0 ? _options_max : Math.max(...curves.map((curve)=>Math.max(...curve.entries)));
    const minValue = options.min;
    const radius = Math.min(config.width, config.height) / 2;
    drawGraticule(g, axes, radius, options.ticks, options.graticule);
    drawAxes(g, axes, radius, config);
    drawCurves(g, axes, curves, minValue, maxValue, options.graticule, config);
    drawLegend(g, curves, options.showLegend, config);
    g.append("text").attr("class", "radarTitle").text(title).attr("x", 0).attr("y", -config.height / 2 - config.marginTop);
}, "draw");
var drawFrame = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((svg, config)=>{
    const totalWidth = config.width + config.marginLeft + config.marginRight;
    const totalHeight = config.height + config.marginTop + config.marginBottom;
    const center = {
        x: config.marginLeft + config.width / 2,
        y: config.marginTop + config.height / 2
    };
    var _config_useMaxWidth;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["configureSvgSize"])(svg, totalHeight, totalWidth, (_config_useMaxWidth = config.useMaxWidth) !== null && _config_useMaxWidth !== void 0 ? _config_useMaxWidth : true);
    svg.attr("viewBox", "0 0 ".concat(totalWidth, " ").concat(totalHeight)).attr("overflow", "visible");
    return svg.append("g").attr("transform", "translate(".concat(center.x, ", ").concat(center.y, ")"));
}, "drawFrame");
var drawGraticule = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((g, axes, radius, ticks, graticule)=>{
    if (graticule === "circle") {
        for(let i = 0; i < ticks; i++){
            const r = radius * (i + 1) / ticks;
            g.append("circle").attr("r", r).attr("class", "radarGraticule");
        }
    } else if (graticule === "polygon") {
        const numAxes = axes.length;
        for(let i = 0; i < ticks; i++){
            const r = radius * (i + 1) / ticks;
            const points = axes.map((_, j)=>{
                const angle = 2 * j * Math.PI / numAxes - Math.PI / 2;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);
                return "".concat(x, ",").concat(y);
            }).join(" ");
            g.append("polygon").attr("points", points).attr("class", "radarGraticule");
        }
    }
}, "drawGraticule");
var drawAxes = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((g, axes, radius, config)=>{
    const numAxes = axes.length;
    for(let i = 0; i < numAxes; i++){
        const label = axes[i].label;
        const angle = 2 * i * Math.PI / numAxes - Math.PI / 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        g.append("line").attr("x1", 0).attr("y1", 0).attr("x2", radius * config.axisScaleFactor * cosA).attr("y2", radius * config.axisScaleFactor * sinA).attr("class", "radarAxisLine");
        const textAnchor = cosA > 0.01 ? "start" : cosA < -0.01 ? "end" : "middle";
        const dominantBaseline = sinA > 0.01 ? "hanging" : sinA < -0.01 ? "auto" : "central";
        const labelPad = 4;
        g.append("text").text(label).attr("x", radius * config.axisLabelFactor * cosA + labelPad * cosA).attr("y", radius * config.axisLabelFactor * sinA + labelPad * sinA).attr("text-anchor", textAnchor).attr("dominant-baseline", dominantBaseline).attr("class", "radarAxisLabel");
    }
}, "drawAxes");
function drawCurves(g, axes, curves, minValue, maxValue, graticule, config) {
    const numAxes = axes.length;
    const radius = Math.min(config.width, config.height) / 2;
    curves.forEach((curve, index)=>{
        if (curve.entries.length !== numAxes) {
            return;
        }
        const points = curve.entries.map((entry, i)=>{
            const angle = 2 * Math.PI * i / numAxes - Math.PI / 2;
            const r = relativeRadius(entry, minValue, maxValue, radius);
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            return {
                x,
                y
            };
        });
        if (graticule === "circle") {
            g.append("path").attr("d", closedRoundCurve(points, config.curveTension)).attr("class", "radarCurve-".concat(index));
        } else if (graticule === "polygon") {
            g.append("polygon").attr("points", points.map((p)=>"".concat(p.x, ",").concat(p.y)).join(" ")).attr("class", "radarCurve-".concat(index));
        }
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(drawCurves, "drawCurves");
function relativeRadius(value, minValue, maxValue, radius) {
    const clippedValue = Math.min(Math.max(value, minValue), maxValue);
    return radius * (clippedValue - minValue) / (maxValue - minValue);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(relativeRadius, "relativeRadius");
function closedRoundCurve(points, tension) {
    const numPoints = points.length;
    let d = "M".concat(points[0].x, ",").concat(points[0].y);
    for(let i = 0; i < numPoints; i++){
        const p0 = points[(i - 1 + numPoints) % numPoints];
        const p1 = points[i];
        const p2 = points[(i + 1) % numPoints];
        const p3 = points[(i + 2) % numPoints];
        const cp1 = {
            x: p1.x + (p2.x - p0.x) * tension,
            y: p1.y + (p2.y - p0.y) * tension
        };
        const cp2 = {
            x: p2.x - (p3.x - p1.x) * tension,
            y: p2.y - (p3.y - p1.y) * tension
        };
        d += " C".concat(cp1.x, ",").concat(cp1.y, " ").concat(cp2.x, ",").concat(cp2.y, " ").concat(p2.x, ",").concat(p2.y);
    }
    return "".concat(d, " Z");
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(closedRoundCurve, "closedRoundCurve");
function drawLegend(g, curves, showLegend, config) {
    if (!showLegend) {
        return;
    }
    const legendX = (config.width / 2 + config.marginRight) * 3 / 4;
    const legendY = -(config.height / 2 + config.marginTop) * 3 / 4;
    const lineHeight = 20;
    curves.forEach((curve, index)=>{
        const itemGroup = g.append("g").attr("transform", "translate(".concat(legendX, ", ").concat(legendY + index * lineHeight, ")"));
        itemGroup.append("rect").attr("width", 12).attr("height", 12).attr("class", "radarLegendBox-".concat(index));
        itemGroup.append("text").attr("x", 16).attr("y", 0).attr("class", "radarLegendText").text(curve.label);
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(drawLegend, "drawLegend");
var renderer = {
    draw
};
// src/diagrams/radar/styles.ts
var genIndexStyles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((themeVariables, radarOptions)=>{
    let sections = "";
    for(let i = 0; i < themeVariables.THEME_COLOR_LIMIT; i++){
        const indexColor = themeVariables["cScale".concat(i)];
        sections += "\n		.radarCurve-".concat(i, " {\n			color: ").concat(indexColor, ";\n			fill: ").concat(indexColor, ";\n			fill-opacity: ").concat(radarOptions.curveOpacity, ";\n			stroke: ").concat(indexColor, ";\n			stroke-width: ").concat(radarOptions.curveStrokeWidth, ";\n		}\n		.radarLegendBox-").concat(i, " {\n			fill: ").concat(indexColor, ";\n			fill-opacity: ").concat(radarOptions.curveOpacity, ";\n			stroke: ").concat(indexColor, ";\n		}\n		");
    }
    return sections;
}, "genIndexStyles");
var buildRadarStyleOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((radar)=>{
    const defaultThemeVariables = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getThemeVariables"])();
    const currentConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const themeVariables = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])(defaultThemeVariables, currentConfig.themeVariables);
    const radarOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])(themeVariables.radar, radar);
    return {
        themeVariables,
        radarOptions
    };
}, "buildRadarStyleOptions");
var styles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    let { radar } = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const { themeVariables, radarOptions } = buildRadarStyleOptions(radar);
    return "\n	.radarTitle {\n		font-size: ".concat(themeVariables.fontSize, ";\n		color: ").concat(themeVariables.titleColor, ";\n		dominant-baseline: hanging;\n		text-anchor: middle;\n	}\n	.radarAxisLine {\n		stroke: ").concat(radarOptions.axisColor, ";\n		stroke-width: ").concat(radarOptions.axisStrokeWidth, ";\n	}\n	.radarAxisLabel {\n		font-size: ").concat(radarOptions.axisLabelFontSize, "px;\n		color: ").concat(radarOptions.axisColor, ";\n	}\n	.radarGraticule {\n		fill: ").concat(radarOptions.graticuleColor, ";\n		fill-opacity: ").concat(radarOptions.graticuleOpacity, ";\n		stroke: ").concat(radarOptions.graticuleColor, ";\n		stroke-width: ").concat(radarOptions.graticuleStrokeWidth, ";\n	}\n	.radarLegendText {\n		text-anchor: start;\n		font-size: ").concat(radarOptions.legendFontSize, "px;\n		dominant-baseline: hanging;\n	}\n	").concat(genIndexStyles(themeVariables, radarOptions), "\n	");
}, "styles");
// src/diagrams/radar/diagram.ts
var diagram = {
    parser,
    db,
    renderer,
    styles
};
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_1ed2652d._.js.map