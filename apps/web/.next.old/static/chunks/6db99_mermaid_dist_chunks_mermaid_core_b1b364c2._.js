(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-MOJQB5TN.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db,
    "getStyles",
    ()=>getStyles,
    "renderer",
    ()=>renderer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-VAUOI2AC.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
var _class, _class1;
;
;
;
;
// src/diagrams/railroad/railroadDb.ts
var diagramTitle = "";
var accTitle = "";
var accDescription = "";
var rules = [];
var ruleMap = /* @__PURE__ */ new Map();
var sanitizeText2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])(text, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])());
}, "sanitizeText");
var sanitizeAstNode = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node)=>{
    switch(node.type){
        case "terminal":
            return {
                ...node,
                value: sanitizeText2(node.value)
            };
        case "nonterminal":
            return {
                ...node,
                name: sanitizeText2(node.name)
            };
        case "sequence":
            return {
                ...node,
                elements: node.elements.map(sanitizeAstNode)
            };
        case "choice":
            return {
                ...node,
                alternatives: node.alternatives.map(sanitizeAstNode)
            };
        case "optional":
            return {
                ...node,
                element: sanitizeAstNode(node.element)
            };
        case "repetition":
            return {
                ...node,
                element: sanitizeAstNode(node.element),
                separator: node.separator ? sanitizeAstNode(node.separator) : void 0
            };
        case "special":
            return {
                ...node,
                text: sanitizeText2(node.text)
            };
    }
}, "sanitizeAstNode");
var clear2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    diagramTitle = "";
    accTitle = "";
    accDescription = "";
    rules.length = 0;
    ruleMap.clear();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clear"])();
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Database cleared");
}, "clear");
var setTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>{
    diagramTitle = sanitizeText2(text);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Title set:", text);
}, "setTitle");
var getTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return diagramTitle;
}, "getTitle");
var addRule = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((rule)=>{
    const sanitizedRule = {
        ...rule,
        name: sanitizeText2(rule.name),
        definition: sanitizeAstNode(rule.definition),
        comment: rule.comment ? sanitizeText2(rule.comment) : void 0
    };
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Adding rule:", sanitizedRule.name);
    if (ruleMap.has(sanitizedRule.name)) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("[Railroad] Rule '".concat(sanitizedRule.name, "' is already defined. Overwriting."));
    }
    rules.push(sanitizedRule);
    ruleMap.set(sanitizedRule.name, sanitizedRule);
}, "addRule");
var getRules = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return rules;
}, "getRules");
var getRule = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((name)=>{
    return ruleMap.get(name);
}, "getRule");
var setAccTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>{
    accTitle = sanitizeText2(text).replace(/^\s+/g, "");
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Accessibility title set:", text);
}, "setAccTitle");
var getAccTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return accTitle;
}, "getAccTitle");
var setAccDescription = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>{
    accDescription = sanitizeText2(text).replace(/\n\s+/g, "\n");
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Accessibility description set:", text);
}, "setAccDescription");
var getAccDescription = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return accDescription;
}, "getAccDescription");
var setDiagramTitle = setTitle;
var getDiagramTitle = getTitle;
var db = {
    clear: clear2,
    setTitle,
    getTitle,
    addRule,
    getRules,
    getRule,
    setAccTitle,
    getAccTitle,
    setAccDescription,
    getAccDescription,
    setDiagramTitle,
    getDiagramTitle
};
// src/diagrams/railroad/railroadTypes.ts
var DEFAULT_RAILROAD_CONFIG = {
    // Layout
    compactMode: false,
    // Spacing
    padding: 10,
    verticalSeparation: 8,
    horizontalSeparation: 10,
    arcRadius: 10,
    // Typography
    fontSize: 14,
    fontFamily: "monospace",
    // Colors - Terminal
    terminalFill: "#FFFFC0",
    terminalStroke: "#000000",
    terminalTextColor: "#000000",
    // Colors - Non-terminal
    nonTerminalFill: "#FFFFFF",
    nonTerminalStroke: "#000000",
    nonTerminalTextColor: "#000000",
    // Colors - Lines
    lineColor: "#000000",
    strokeWidth: 2,
    // Colors - Markers
    markerFill: "#000000",
    // Colors - Comment
    commentFill: "#E8E8E8",
    commentStroke: "#888888",
    commentTextColor: "#666666",
    // Colors - Special
    specialFill: "#F0E0FF",
    specialStroke: "#8800CC",
    // Other
    ruleNameColor: "#000066",
    showMarkers: true,
    markerRadius: 5
};
// src/diagrams/railroad/styles.ts
var COLOR_VALUE_PATTERN = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$|^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([\d\s%+,./-]+\)$|^[a-z]+$/i;
var FONT_FAMILY_PATTERN = /^[\w "',.-]+$/;
var RAILROAD_STYLE_OPTION_KEYS = /* @__PURE__ */ new Set([
    "compactMode",
    "padding",
    "verticalSeparation",
    "horizontalSeparation",
    "arcRadius",
    "fontSize",
    "fontFamily",
    "terminalFill",
    "terminalStroke",
    "terminalTextColor",
    "nonTerminalFill",
    "nonTerminalStroke",
    "nonTerminalTextColor",
    "lineColor",
    "strokeWidth",
    "markerFill",
    "commentFill",
    "commentStroke",
    "commentTextColor",
    "specialFill",
    "specialStroke",
    "ruleNameColor",
    "showMarkers",
    "markerRadius"
]);
var isRailroadStyleOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    if (!options) {
        return false;
    }
    return Object.keys(options).every((key)=>key === "railroad" || RAILROAD_STYLE_OPTION_KEYS.has(key));
}, "isRailroadStyleOptions");
var extractRailroadOverrides = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    if (!options) {
        return {};
    }
    if ("railroad" in options && options.railroad) {
        return options.railroad;
    }
    return isRailroadStyleOptions(options) ? options : {};
}, "extractRailroadOverrides");
var extractThemeOverrides = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    if (!options || isRailroadStyleOptions(options)) {
        return {};
    }
    const { railroad: _railroad, svgId: _svgId, theme: _theme, look: _look, ...themeOverrides } = options;
    return themeOverrides;
}, "extractThemeOverrides");
var sanitizeColorValue = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((value, fallback)=>{
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = value.trim();
    return COLOR_VALUE_PATTERN.test(normalized) ? normalized : fallback;
}, "sanitizeColorValue");
var sanitizeFontFamilyValue = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((value, fallback)=>{
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = value.trim();
    return FONT_FAMILY_PATTERN.test(normalized) ? normalized : fallback;
}, "sanitizeFontFamilyValue");
var sanitizeNumberValue = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((value, fallback)=>{
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}, "sanitizeNumberValue");
var parseThemeFontSize = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((value)=>{
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : void 0;
}, "parseThemeFontSize");
var buildThemeDefaults = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((themeVariables)=>{
    const fontFamily = sanitizeFontFamilyValue(themeVariables.fontFamily, DEFAULT_RAILROAD_CONFIG.fontFamily);
    var _parseThemeFontSize;
    const fontSize = (_parseThemeFontSize = parseThemeFontSize(themeVariables.fontSize)) !== null && _parseThemeFontSize !== void 0 ? _parseThemeFontSize : DEFAULT_RAILROAD_CONFIG.fontSize;
    var _themeVariables_secondBkg, _themeVariables_secondaryBorderColor, _themeVariables_secondaryTextColor, _themeVariables_mainBkg, _themeVariables_primaryBorderColor, _themeVariables_primaryTextColor, _themeVariables_labelBackground, _themeVariables_tertiaryBorderColor, _themeVariables_tertiaryTextColor, _themeVariables_tertiaryColor, _themeVariables_tertiaryBorderColor1, _themeVariables_titleColor;
    return {
        ...DEFAULT_RAILROAD_CONFIG,
        fontFamily,
        fontSize,
        terminalFill: sanitizeColorValue((_themeVariables_secondBkg = themeVariables.secondBkg) !== null && _themeVariables_secondBkg !== void 0 ? _themeVariables_secondBkg : themeVariables.secondaryColor, DEFAULT_RAILROAD_CONFIG.terminalFill),
        terminalStroke: sanitizeColorValue((_themeVariables_secondaryBorderColor = themeVariables.secondaryBorderColor) !== null && _themeVariables_secondaryBorderColor !== void 0 ? _themeVariables_secondaryBorderColor : themeVariables.lineColor, DEFAULT_RAILROAD_CONFIG.terminalStroke),
        terminalTextColor: sanitizeColorValue((_themeVariables_secondaryTextColor = themeVariables.secondaryTextColor) !== null && _themeVariables_secondaryTextColor !== void 0 ? _themeVariables_secondaryTextColor : themeVariables.textColor, DEFAULT_RAILROAD_CONFIG.terminalTextColor),
        nonTerminalFill: sanitizeColorValue((_themeVariables_mainBkg = themeVariables.mainBkg) !== null && _themeVariables_mainBkg !== void 0 ? _themeVariables_mainBkg : themeVariables.background, DEFAULT_RAILROAD_CONFIG.nonTerminalFill),
        nonTerminalStroke: sanitizeColorValue((_themeVariables_primaryBorderColor = themeVariables.primaryBorderColor) !== null && _themeVariables_primaryBorderColor !== void 0 ? _themeVariables_primaryBorderColor : themeVariables.lineColor, DEFAULT_RAILROAD_CONFIG.nonTerminalStroke),
        nonTerminalTextColor: sanitizeColorValue((_themeVariables_primaryTextColor = themeVariables.primaryTextColor) !== null && _themeVariables_primaryTextColor !== void 0 ? _themeVariables_primaryTextColor : themeVariables.textColor, DEFAULT_RAILROAD_CONFIG.nonTerminalTextColor),
        lineColor: sanitizeColorValue(themeVariables.lineColor, DEFAULT_RAILROAD_CONFIG.lineColor),
        markerFill: sanitizeColorValue(themeVariables.lineColor, DEFAULT_RAILROAD_CONFIG.markerFill),
        commentFill: sanitizeColorValue((_themeVariables_labelBackground = themeVariables.labelBackground) !== null && _themeVariables_labelBackground !== void 0 ? _themeVariables_labelBackground : themeVariables.tertiaryColor, DEFAULT_RAILROAD_CONFIG.commentFill),
        commentStroke: sanitizeColorValue((_themeVariables_tertiaryBorderColor = themeVariables.tertiaryBorderColor) !== null && _themeVariables_tertiaryBorderColor !== void 0 ? _themeVariables_tertiaryBorderColor : themeVariables.lineColor, DEFAULT_RAILROAD_CONFIG.commentStroke),
        commentTextColor: sanitizeColorValue((_themeVariables_tertiaryTextColor = themeVariables.tertiaryTextColor) !== null && _themeVariables_tertiaryTextColor !== void 0 ? _themeVariables_tertiaryTextColor : themeVariables.textColor, DEFAULT_RAILROAD_CONFIG.commentTextColor),
        specialFill: sanitizeColorValue((_themeVariables_tertiaryColor = themeVariables.tertiaryColor) !== null && _themeVariables_tertiaryColor !== void 0 ? _themeVariables_tertiaryColor : themeVariables.secondaryColor, DEFAULT_RAILROAD_CONFIG.specialFill),
        specialStroke: sanitizeColorValue((_themeVariables_tertiaryBorderColor1 = themeVariables.tertiaryBorderColor) !== null && _themeVariables_tertiaryBorderColor1 !== void 0 ? _themeVariables_tertiaryBorderColor1 : themeVariables.secondaryBorderColor, DEFAULT_RAILROAD_CONFIG.specialStroke),
        ruleNameColor: sanitizeColorValue((_themeVariables_titleColor = themeVariables.titleColor) !== null && _themeVariables_titleColor !== void 0 ? _themeVariables_titleColor : themeVariables.textColor, DEFAULT_RAILROAD_CONFIG.ruleNameColor)
    };
}, "buildThemeDefaults");
var buildRailroadStyleOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    const currentConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    var _currentConfig_themeVariables;
    const themeVariables = {
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getThemeVariables"])(),
        ...(_currentConfig_themeVariables = currentConfig.themeVariables) !== null && _currentConfig_themeVariables !== void 0 ? _currentConfig_themeVariables : {},
        ...extractThemeOverrides(options)
    };
    const themeDefaults = buildThemeDefaults(themeVariables);
    var _currentConfig_railroad;
    const railroadOptions = {
        ...(_currentConfig_railroad = currentConfig.railroad) !== null && _currentConfig_railroad !== void 0 ? _currentConfig_railroad : {},
        ...extractRailroadOverrides(options)
    };
    var _railroadOptions_compactMode, _railroadOptions_showMarkers;
    return {
        compactMode: (_railroadOptions_compactMode = railroadOptions.compactMode) !== null && _railroadOptions_compactMode !== void 0 ? _railroadOptions_compactMode : themeDefaults.compactMode,
        padding: sanitizeNumberValue(railroadOptions.padding, themeDefaults.padding),
        verticalSeparation: sanitizeNumberValue(railroadOptions.verticalSeparation, themeDefaults.verticalSeparation),
        horizontalSeparation: sanitizeNumberValue(railroadOptions.horizontalSeparation, themeDefaults.horizontalSeparation),
        arcRadius: sanitizeNumberValue(railroadOptions.arcRadius, themeDefaults.arcRadius),
        fontSize: sanitizeNumberValue(railroadOptions.fontSize, themeDefaults.fontSize),
        fontFamily: sanitizeFontFamilyValue(railroadOptions.fontFamily, themeDefaults.fontFamily),
        terminalFill: sanitizeColorValue(railroadOptions.terminalFill, themeDefaults.terminalFill),
        terminalStroke: sanitizeColorValue(railroadOptions.terminalStroke, themeDefaults.terminalStroke),
        terminalTextColor: sanitizeColorValue(railroadOptions.terminalTextColor, themeDefaults.terminalTextColor),
        nonTerminalFill: sanitizeColorValue(railroadOptions.nonTerminalFill, themeDefaults.nonTerminalFill),
        nonTerminalStroke: sanitizeColorValue(railroadOptions.nonTerminalStroke, themeDefaults.nonTerminalStroke),
        nonTerminalTextColor: sanitizeColorValue(railroadOptions.nonTerminalTextColor, themeDefaults.nonTerminalTextColor),
        lineColor: sanitizeColorValue(railroadOptions.lineColor, themeDefaults.lineColor),
        strokeWidth: sanitizeNumberValue(railroadOptions.strokeWidth, themeDefaults.strokeWidth),
        markerFill: sanitizeColorValue(railroadOptions.markerFill, themeDefaults.markerFill),
        commentFill: sanitizeColorValue(railroadOptions.commentFill, themeDefaults.commentFill),
        commentStroke: sanitizeColorValue(railroadOptions.commentStroke, themeDefaults.commentStroke),
        commentTextColor: sanitizeColorValue(railroadOptions.commentTextColor, themeDefaults.commentTextColor),
        specialFill: sanitizeColorValue(railroadOptions.specialFill, themeDefaults.specialFill),
        specialStroke: sanitizeColorValue(railroadOptions.specialStroke, themeDefaults.specialStroke),
        ruleNameColor: sanitizeColorValue(railroadOptions.ruleNameColor, themeDefaults.ruleNameColor),
        showMarkers: (_railroadOptions_showMarkers = railroadOptions.showMarkers) !== null && _railroadOptions_showMarkers !== void 0 ? _railroadOptions_showMarkers : themeDefaults.showMarkers,
        markerRadius: sanitizeNumberValue(railroadOptions.markerRadius, themeDefaults.markerRadius)
    };
}, "buildRailroadStyleOptions");
var getStyles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    const { fontFamily, fontSize, terminalFill, terminalStroke, terminalTextColor, nonTerminalFill, nonTerminalStroke, nonTerminalTextColor, lineColor, strokeWidth, markerFill, commentFill, commentStroke, commentTextColor, specialFill, specialStroke, ruleNameColor } = buildRailroadStyleOptions(options);
    return "\n  .railroad-diagram {\n    font-family: ".concat(fontFamily, ";\n    font-size: ").concat(fontSize, "px;\n  }\n\n  .railroad-terminal rect {\n    fill: ").concat(terminalFill, ";\n    stroke: ").concat(terminalStroke, ";\n    stroke-width: ").concat(strokeWidth, "px;\n  }\n\n  .railroad-terminal text {\n    fill: ").concat(terminalTextColor, ";\n    font-family: ").concat(fontFamily, ";\n    font-size: ").concat(fontSize, "px;\n    text-anchor: middle;\n    dominant-baseline: middle;\n  }\n\n  .railroad-nonterminal rect {\n    fill: ").concat(nonTerminalFill, ";\n    stroke: ").concat(nonTerminalStroke, ";\n    stroke-width: ").concat(strokeWidth, "px;\n  }\n\n  .railroad-nonterminal text {\n    fill: ").concat(nonTerminalTextColor, ";\n    font-family: ").concat(fontFamily, ";\n    font-size: ").concat(fontSize, "px;\n    text-anchor: middle;\n    dominant-baseline: middle;\n  }\n\n  .railroad-line {\n    stroke: ").concat(lineColor, ";\n    stroke-width: ").concat(strokeWidth, "px;\n    fill: none;\n  }\n\n  .railroad-start circle,\n  .railroad-end circle {\n    fill: ").concat(markerFill, ";\n  }\n\n  .railroad-comment ellipse {\n    fill: ").concat(commentFill, ";\n    stroke: ").concat(commentStroke, ";\n    stroke-width: ").concat(strokeWidth, "px;\n  }\n\n  .railroad-comment text {\n    fill: ").concat(commentTextColor, ";\n    font-style: italic;\n    font-family: ").concat(fontFamily, ";\n    font-size: ").concat(fontSize, "px;\n    text-anchor: middle;\n    dominant-baseline: middle;\n  }\n\n  .railroad-special rect {\n    fill: ").concat(specialFill, ";\n    stroke: ").concat(specialStroke, ";\n    stroke-width: ").concat(strokeWidth, "px;\n    stroke-dasharray: 5,3;\n  }\n\n  .railroad-special text {\n    fill: ").concat(nonTerminalTextColor, ";\n    font-family: ").concat(fontFamily, ";\n    font-size: ").concat(fontSize, "px;\n    text-anchor: middle;\n    dominant-baseline: middle;\n  }\n\n  .railroad-rule-name {\n    font-weight: bold;\n    fill: ").concat(ruleNameColor, ";\n    font-family: ").concat(fontFamily, ";\n    font-size: ").concat(fontSize, "px;\n  }\n\n  .railroad-group {\n    /* Grouping container, no specific styles */\n  }\n");
}, "getStyles");
// src/diagrams/railroad/railroadRenderer.ts
var PathBuilder = (_class = class {
    moveTo(x, y) {
        this.d += "M ".concat(x, " ").concat(y, " ");
        return this;
    }
    lineTo(x, y) {
        this.d += "L ".concat(x, " ").concat(y, " ");
        return this;
    }
    horizontalTo(x) {
        this.d += "H ".concat(x, " ");
        return this;
    }
    verticalTo(y) {
        this.d += "V ".concat(y, " ");
        return this;
    }
    arcTo(rx, ry, rotation, largeArc, sweep, x, y) {
        this.d += "A ".concat(rx, " ").concat(ry, " ").concat(rotation, " ").concat(largeArc ? 1 : 0, " ").concat(sweep ? 1 : 0, " ").concat(x, " ").concat(y, " ");
        return this;
    }
    build() {
        return this.d.trim();
    }
    constructor(){
        this.d = "";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class, "PathBuilder"), _class);
var RailroadRenderer = (_class1 = class {
    /**
   * Measure text dimensions
   */ measureText(text) {
        if (this.textCache.has(text)) {
            return this.textCache.get(text);
        }
        const tempText = this.svg.append("text").attr("font-family", this.config.fontFamily).attr("font-size", this.config.fontSize).text(text);
        const bbox = tempText.node().getBBox();
        const dimensions = {
            width: bbox.width,
            height: bbox.height
        };
        tempText.remove();
        this.textCache.set(text, dimensions);
        return dimensions;
    }
    /**
   * Render terminal symbol (rounded rectangle)
   */ renderTerminal(parent, value) {
        const textDim = this.measureText(value);
        const width = textDim.width + this.config.padding * 2;
        const height = textDim.height + this.config.padding * 2;
        const group = parent.append("g").attr("class", "railroad-terminal");
        group.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height).attr("rx", 10).attr("ry", 10);
        group.append("text").attr("x", width / 2).attr("y", height / 2).text(value);
        return {
            element: group.node(),
            dimensions: {
                width,
                height,
                up: height / 2,
                down: height / 2
            }
        };
    }
    /**
   * Render non-terminal symbol (rectangle)
   */ renderNonTerminal(parent, name) {
        const textDim = this.measureText(name);
        const width = textDim.width + this.config.padding * 2;
        const height = textDim.height + this.config.padding * 2;
        const group = parent.append("g").attr("class", "railroad-nonterminal");
        group.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);
        group.append("text").attr("x", width / 2).attr("y", height / 2).text(name);
        return {
            element: group.node(),
            dimensions: {
                width,
                height,
                up: height / 2,
                down: height / 2
            }
        };
    }
    /**
   * Render sequence (horizontal concatenation)
   */ renderSequence(parent, elements) {
        const rendered = elements.map((e)=>this.renderExpression(parent, e));
        let totalWidth = 0;
        let maxUp = 0;
        let maxDown = 0;
        for (const r of rendered){
            totalWidth += r.dimensions.width;
            maxUp = Math.max(maxUp, r.dimensions.up);
            maxDown = Math.max(maxDown, r.dimensions.down);
        }
        totalWidth += (rendered.length - 1) * this.config.horizontalSeparation;
        const group = parent.append("g").attr("class", "railroad-sequence");
        let x = 0;
        for(let i = 0; i < rendered.length; i++){
            const r = rendered[i];
            const y = maxUp - r.dimensions.up;
            const elem = group.node().appendChild(r.element);
            elem.setAttribute("transform", "translate(".concat(x, ", ").concat(y, ")"));
            if (i < rendered.length - 1) {
                const lineX1 = x + r.dimensions.width;
                const lineX2 = lineX1 + this.config.horizontalSeparation;
                const lineY = maxUp;
                group.append("path").attr("class", "railroad-line").attr("d", new PathBuilder().moveTo(lineX1, lineY).lineTo(lineX2, lineY).build());
            }
            x += r.dimensions.width + this.config.horizontalSeparation;
        }
        return {
            element: group.node(),
            dimensions: {
                width: totalWidth,
                height: maxUp + maxDown,
                up: maxUp,
                down: maxDown
            }
        };
    }
    /**
   * Render choice (vertical alternatives)
   */ renderChoice(parent, alternatives) {
        const rendered = alternatives.map((a)=>this.renderExpression(parent, a));
        let maxWidth = 0;
        let totalHeight = 0;
        for (const r of rendered){
            maxWidth = Math.max(maxWidth, r.dimensions.width);
            totalHeight += r.dimensions.height;
        }
        totalHeight += (rendered.length - 1) * this.config.verticalSeparation;
        const arcRadius = this.config.arcRadius;
        const arcWidth = arcRadius * 4;
        const totalWidth = maxWidth + arcWidth;
        const group = parent.append("g").attr("class", "railroad-choice");
        let y = 0;
        const centerY = totalHeight / 2;
        for (const r of rendered){
            const elemY = y;
            const elemCenterY = elemY + r.dimensions.up;
            const elemX = arcRadius * 2 + (maxWidth - r.dimensions.width) / 2;
            const elem = group.node().appendChild(r.element);
            elem.setAttribute("transform", "translate(".concat(elemX, ", ").concat(elemY, ")"));
            const leftPath = new PathBuilder();
            const isBelowCenter = elemCenterY > centerY;
            if (elemCenterY === centerY) {
                leftPath.moveTo(0, centerY).lineTo(elemX, elemCenterY);
            } else {
                leftPath.moveTo(0, centerY).arcTo(arcRadius, arcRadius, 0, false, isBelowCenter, arcRadius, centerY + (isBelowCenter ? arcRadius : -arcRadius)).lineTo(arcRadius, elemCenterY - (isBelowCenter ? arcRadius : -arcRadius)).arcTo(arcRadius, arcRadius, 0, false, !isBelowCenter, arcRadius * 2, elemCenterY).lineTo(elemX, elemCenterY);
            }
            group.append("path").attr("class", "railroad-line").attr("d", leftPath.build());
            const rightPath = new PathBuilder();
            const rightStart = elemX + r.dimensions.width;
            const rightLaneX = totalWidth - arcRadius * 2;
            if (elemCenterY === centerY) {
                rightPath.moveTo(rightStart, elemCenterY).lineTo(totalWidth, centerY);
            } else {
                rightPath.moveTo(rightStart, elemCenterY).lineTo(rightLaneX, elemCenterY).arcTo(arcRadius, arcRadius, 0, false, !isBelowCenter, totalWidth - arcRadius, elemCenterY + (isBelowCenter ? -arcRadius : arcRadius)).lineTo(totalWidth - arcRadius, centerY + (isBelowCenter ? arcRadius : -arcRadius)).arcTo(arcRadius, arcRadius, 0, false, isBelowCenter, totalWidth, centerY);
            }
            group.append("path").attr("class", "railroad-line").attr("d", rightPath.build());
            y += r.dimensions.height + this.config.verticalSeparation;
        }
        return {
            element: group.node(),
            dimensions: {
                width: totalWidth,
                height: totalHeight,
                up: centerY,
                down: totalHeight - centerY
            }
        };
    }
    /**
   * Render optional (bypass path above)
   */ renderOptional(parent, element) {
        const inner = this.renderExpression(parent, element);
        const arcRadius = this.config.arcRadius;
        const arcHeight = arcRadius * 2;
        const totalWidth = inner.dimensions.width + arcRadius * 4;
        const totalHeight = inner.dimensions.height + arcHeight;
        const group = parent.append("g").attr("class", "railroad-optional");
        const elemX = arcRadius * 2;
        const elemY = arcHeight;
        const elem = group.node().appendChild(inner.element);
        elem.setAttribute("transform", "translate(".concat(elemX, ", ").concat(elemY, ")"));
        const centerY = elemY + inner.dimensions.up;
        const lowerPath = new PathBuilder().moveTo(0, centerY).lineTo(arcRadius * 2, centerY);
        group.append("path").attr("class", "railroad-line").attr("d", lowerPath.build());
        const lowerPath2 = new PathBuilder().moveTo(elemX + inner.dimensions.width, centerY).lineTo(totalWidth, centerY);
        group.append("path").attr("class", "railroad-line").attr("d", lowerPath2.build());
        const bypassPath = new PathBuilder().moveTo(0, centerY).arcTo(arcRadius, arcRadius, 0, false, false, arcRadius, centerY - arcRadius).lineTo(arcRadius, arcRadius).arcTo(arcRadius, arcRadius, 0, false, true, arcRadius * 2, 0).lineTo(totalWidth - arcRadius * 2, 0).arcTo(arcRadius, arcRadius, 0, false, true, totalWidth - arcRadius, arcRadius).lineTo(totalWidth - arcRadius, centerY - arcRadius).arcTo(arcRadius, arcRadius, 0, false, false, totalWidth, centerY);
        group.append("path").attr("class", "railroad-line").attr("d", bypassPath.build());
        return {
            element: group.node(),
            dimensions: {
                width: totalWidth,
                height: totalHeight,
                up: centerY,
                down: totalHeight - centerY
            }
        };
    }
    /**
   * Render repetition (loop back path)
   */ renderRepetition(parent, element, min) {
        const inner = this.renderExpression(parent, element);
        const arcRadius = this.config.arcRadius;
        const arcHeight = arcRadius * 2;
        const totalWidth = inner.dimensions.width + arcRadius * 4;
        const hasBypass = min === 0;
        const totalHeight = inner.dimensions.height + arcHeight + (hasBypass ? arcHeight : 0);
        const group = parent.append("g").attr("class", "railroad-repetition");
        const elemX = arcRadius * 2;
        const elemY = hasBypass ? arcHeight : 0;
        const elem = group.node().appendChild(inner.element);
        elem.setAttribute("transform", "translate(".concat(elemX, ", ").concat(elemY, ")"));
        const centerY = elemY + inner.dimensions.up;
        group.append("path").attr("class", "railroad-line").attr("d", new PathBuilder().moveTo(0, centerY).lineTo(arcRadius * 2, centerY).build());
        group.append("path").attr("class", "railroad-line").attr("d", new PathBuilder().moveTo(elemX + inner.dimensions.width, centerY).lineTo(totalWidth, centerY).build());
        const loopY = elemY + inner.dimensions.height + arcRadius;
        const loopPath = new PathBuilder().moveTo(elemX + inner.dimensions.width, centerY).arcTo(arcRadius, arcRadius, 0, false, true, elemX + inner.dimensions.width + arcRadius, centerY + arcRadius).lineTo(elemX + inner.dimensions.width + arcRadius, loopY).arcTo(arcRadius, arcRadius, 0, false, true, elemX + inner.dimensions.width, loopY + arcRadius).lineTo(arcRadius * 2, loopY + arcRadius).arcTo(arcRadius, arcRadius, 0, false, true, arcRadius, loopY).lineTo(arcRadius, centerY + arcRadius).arcTo(arcRadius, arcRadius, 0, false, true, arcRadius * 2, centerY);
        group.append("path").attr("class", "railroad-line").attr("d", loopPath.build());
        if (hasBypass) {
            const bypassPath = new PathBuilder().moveTo(0, centerY).arcTo(arcRadius, arcRadius, 0, false, false, arcRadius, centerY - arcRadius).lineTo(arcRadius, arcRadius).arcTo(arcRadius, arcRadius, 0, false, true, arcRadius * 2, 0).lineTo(totalWidth - arcRadius * 2, 0).arcTo(arcRadius, arcRadius, 0, false, true, totalWidth - arcRadius, arcRadius).lineTo(totalWidth - arcRadius, centerY - arcRadius).arcTo(arcRadius, arcRadius, 0, false, false, totalWidth, centerY);
            group.append("path").attr("class", "railroad-line").attr("d", bypassPath.build());
        }
        return {
            element: group.node(),
            dimensions: {
                width: totalWidth,
                height: totalHeight,
                up: centerY,
                down: totalHeight - centerY
            }
        };
    }
    /**
   * Render special sequence
   */ renderSpecial(parent, text) {
        const textDim = this.measureText("? " + text + " ?");
        const width = textDim.width + this.config.padding * 2;
        const height = textDim.height + this.config.padding * 2;
        const group = parent.append("g").attr("class", "railroad-special");
        group.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);
        group.append("text").attr("x", width / 2).attr("y", height / 2).text("? " + text + " ?");
        return {
            element: group.node(),
            dimensions: {
                width,
                height,
                up: height / 2,
                down: height / 2
            }
        };
    }
    /**
   * Render an expression (recursive)
   */ renderExpression(parent, node) {
        switch(node.type){
            case "terminal":
                return this.renderTerminal(parent, node.value);
            case "nonterminal":
                return this.renderNonTerminal(parent, node.name);
            case "sequence":
                return this.renderSequence(parent, node.elements);
            case "choice":
                return this.renderChoice(parent, node.alternatives);
            case "optional":
                return this.renderOptional(parent, node.element);
            case "repetition":
                return this.renderRepetition(parent, node.element, node.min);
            case "special":
                return this.renderSpecial(parent, node.text);
            default:
                throw new Error("Unknown node type: ".concat(node.type));
        }
    }
    /**
   * Render a single rule
   */ renderRule(rule, y) {
        const group = this.svg.append("g").attr("class", "railroad-rule").attr("transform", "translate(0, ".concat(y, ")"));
        const ruleName = rule.name + " =";
        const nameWidth = this.measureText(ruleName).width + 20;
        const definitionX = nameWidth + 20;
        const defGroup = group.append("g");
        const result = this.renderExpression(defGroup, rule.definition);
        const baselineY = Math.max(20, result.dimensions.up);
        const definitionY = baselineY - result.dimensions.up;
        defGroup.attr("transform", "translate(".concat(definitionX, ", ").concat(definitionY, ")"));
        const nameGroup = group.append("g").attr("class", "railroad-rule-name-group");
        nameGroup.append("text").attr("class", "railroad-rule-name").attr("x", 0).attr("y", baselineY).text(ruleName);
        const startMarker = group.append("g").attr("class", "railroad-start");
        startMarker.append("circle").attr("cx", nameWidth).attr("cy", baselineY).attr("r", this.config.markerRadius);
        const endMarker = group.append("g").attr("class", "railroad-end");
        endMarker.append("circle").attr("cx", definitionX + result.dimensions.width + 10).attr("cy", baselineY).attr("r", this.config.markerRadius);
        group.append("path").attr("class", "railroad-line").attr("d", new PathBuilder().moveTo(nameWidth + this.config.markerRadius, baselineY).lineTo(definitionX, baselineY).build());
        group.append("path").attr("class", "railroad-line").attr("d", new PathBuilder().moveTo(definitionX + result.dimensions.width, baselineY).lineTo(definitionX + result.dimensions.width + 10 - this.config.markerRadius, baselineY).build());
        return {
            height: Math.max(40, definitionY + result.dimensions.height + this.config.padding * 2),
            width: definitionX + result.dimensions.width + 10 + this.config.markerRadius
        };
    }
    /**
   * Render all rules
   */ renderDiagram(rules2) {
        let y = this.config.padding;
        let maxWidth = 0;
        for (const rule of rules2){
            const result = this.renderRule(rule, y);
            y += result.height + this.config.verticalSeparation;
            maxWidth = Math.max(maxWidth, result.width);
        }
        return {
            width: maxWidth + this.config.padding * 2,
            height: y + this.config.padding
        };
    }
    constructor(svg, config = buildRailroadStyleOptions()){
        this.textCache = /* @__PURE__ */ new Map();
        this.svg = svg;
        this.config = config;
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class1, "RailroadRenderer"), _class1);
var configureRailroadSvgSize = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((svg, dimensions, useMaxWidth)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["configureSvgSize"])(svg, dimensions.height, dimensions.width, useMaxWidth);
    svg.attr("viewBox", "0 0 ".concat(dimensions.width, " ").concat(dimensions.height));
}, "configureRailroadSvgSize");
var draw = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text, id, _version)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Rendering diagram\n" + text);
    try {
        const svg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["selectSvgElement"])(id);
        svg.attr("class", "railroad-diagram");
        const railroadConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])().railroad;
        var _railroadConfig_useMaxWidth;
        const useMaxWidth = (_railroadConfig_useMaxWidth = railroadConfig === null || railroadConfig === void 0 ? void 0 : railroadConfig.useMaxWidth) !== null && _railroadConfig_useMaxWidth !== void 0 ? _railroadConfig_useMaxWidth : true;
        const rules2 = db.getRules();
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Rendering ".concat(rules2.length, " rules"));
        if (rules2.length === 0) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("[Railroad] No rules to render");
            configureRailroadSvgSize(svg, {
                height: 100,
                width: 200
            }, useMaxWidth);
            return;
        }
        const renderer2 = new RailroadRenderer(svg, buildRailroadStyleOptions());
        const dimensions = renderer2.renderDiagram(rules2);
        configureRailroadSvgSize(svg, dimensions, useMaxWidth);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[Railroad] Render complete");
    } catch (error) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error("[Railroad] Render error:", error);
        throw error;
    }
}, "draw");
var renderer = {
    draw
};
;
}),
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
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/ebnfDiagram-CCIWWBDH.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "diagram",
    ()=>diagram
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-MOJQB5TN.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-JWPE2WC7.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-VAUOI2AC.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/diagrams/railroad/parser/ebnfParser.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$chunks$2f$mermaid$2d$parser$2e$core$2f$chunk$2d$U6XO7XAA$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-U6XO7XAA.mjs [app-client] (ecmascript)");
;
;
;
;
;
;
;
var langiumParser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$chunks$2f$mermaid$2d$parser$2e$core$2f$chunk$2d$U6XO7XAA$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createRailroadEbnfServices"])().RailroadEbnf.parser.LangiumParser;
var transformChoice = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((choice)=>{
    const alternatives = choice.alternatives.map(transformSequence);
    if (alternatives.length === 1) {
        return alternatives[0];
    }
    return {
        type: "choice",
        alternatives
    };
}, "transformChoice");
var transformSequence = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((sequence)=>{
    const elements = sequence.elements.map(transformTerm);
    if (elements.length === 1) {
        return elements[0];
    }
    return {
        type: "sequence",
        elements
    };
}, "transformSequence");
var transformPrimary = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((primary)=>{
    switch(primary.$type){
        case "EbnfTerminal":
            return {
                type: "terminal",
                value: primary.value
            };
        case "EbnfNonTerminal":
            return {
                type: "nonterminal",
                name: primary.name
            };
        case "EbnfSpecial":
            return {
                type: "special",
                text: primary.text
            };
        case "EbnfGroup":
            return transformChoice(primary.element);
        case "EbnfOptional":
            return {
                type: "optional",
                element: transformChoice(primary.element)
            };
        case "EbnfRepetition":
            return {
                type: "repetition",
                element: transformChoice(primary.element),
                min: 0,
                max: Infinity
            };
        default:
            throw new Error("Unsupported EBNF primary node: ".concat(primary.$type));
    }
}, "transformPrimary");
var transformPostfix = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node, postfix)=>{
    switch(postfix.$type){
        case "EbnfOptionalPostfix":
            return {
                type: "optional",
                element: node
            };
        case "EbnfZeroOrMorePostfix":
            return {
                type: "repetition",
                element: node,
                min: 0,
                max: Infinity
            };
        case "EbnfOneOrMorePostfix":
            return {
                type: "repetition",
                element: node,
                min: 1,
                max: Infinity
            };
        case "EbnfExceptionPostfix":
            return {
                type: "sequence",
                elements: [
                    node,
                    {
                        type: "terminal",
                        value: "-"
                    },
                    transformPrimary(postfix.except)
                ]
            };
        default:
            throw new Error("Unsupported EBNF postfix node: ".concat(postfix.$type));
    }
}, "transformPostfix");
var transformTerm = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((term)=>{
    return term.postfixes.reduce((currentNode, postfix)=>{
        return transformPostfix(currentNode, postfix);
    }, transformPrimary(term.base));
}, "transformTerm");
var transformRule = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((rule)=>{
    return {
        name: rule.name,
        definition: transformChoice(rule.definition)
    };
}, "transformRule");
var populateDb = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((ast)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["populateCommonDb"])(ast, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]);
    if (ast.title) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].setTitle(ast.title);
    }
    ast.rules.map((rule)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].addRule(transformRule(rule)));
}, "populateDb");
var parser = {
    parse: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((input)=>{
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].clear();
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[EBNF Parser] Starting Langium parse");
        const result = langiumParser.parse(input);
        if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["MermaidParseError"](result);
        }
        const ast = result.value;
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[EBNF Parser] Parsed rules:", ast.rules.length);
        populateDb(ast);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[EBNF Parser] Parse complete");
    }, "parse"),
    parser: {
        yy: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"]
    }
};
// src/diagrams/railroad/ebnfDiagram.ts
var diagram = {
    parser,
    db: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"],
    renderer: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["renderer"],
    styles: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$MOJQB5TN$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getStyles"]
};
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_b1b364c2._.js.map