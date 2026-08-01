(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "UnknownDiagramError",
    ()=>UnknownDiagramError,
    "addDirective",
    ()=>addDirective,
    "assignWithDepth_default",
    ()=>assignWithDepth_default,
    "calculateMathMLDimensions",
    ()=>calculateMathMLDimensions,
    "clear",
    ()=>clear,
    "commonDb_exports",
    ()=>commonDb_exports,
    "common_default",
    ()=>common_default,
    "configureSvgSize",
    ()=>configureSvgSize,
    "cssStyleSheetToString",
    ()=>cssStyleSheetToString,
    "defaultConfig",
    ()=>defaultConfig,
    "defaultConfig2",
    ()=>defaultConfig2,
    "defaultConfig_default",
    ()=>defaultConfig_default,
    "detectType",
    ()=>detectType,
    "detectors",
    ()=>detectors,
    "directiveRegex",
    ()=>directiveRegex,
    "evaluate",
    ()=>evaluate,
    "frontMatterRegex",
    ()=>frontMatterRegex,
    "getAccDescription",
    ()=>getAccDescription,
    "getAccTitle",
    ()=>getAccTitle,
    "getConfig",
    ()=>getConfig,
    "getConfig2",
    ()=>getConfig2,
    "getDiagram",
    ()=>getDiagram,
    "getDiagramLoader",
    ()=>getDiagramLoader,
    "getDiagramTitle",
    ()=>getDiagramTitle,
    "getEffectiveHtmlLabels",
    ()=>getEffectiveHtmlLabels,
    "getSiteConfig",
    ()=>getSiteConfig,
    "getThemeVariables",
    ()=>getThemeVariables3,
    "getUrl",
    ()=>getUrl,
    "getUserDefinedConfig",
    ()=>getUserDefinedConfig,
    "hasKatex",
    ()=>hasKatex,
    "lineBreakRegex",
    ()=>lineBreakRegex,
    "parseGenericTypes",
    ()=>parseGenericTypes,
    "registerDiagram",
    ()=>registerDiagram,
    "registerLazyLoadedDiagrams",
    ()=>registerLazyLoadedDiagrams,
    "renderKatexSanitized",
    ()=>renderKatexSanitized,
    "reset",
    ()=>reset,
    "sanitizeCss",
    ()=>sanitizeCss,
    "sanitizeDirective",
    ()=>sanitizeDirective,
    "sanitizeText",
    ()=>sanitizeText,
    "sanitizeText2",
    ()=>sanitizeText3,
    "saveConfigFromInitialize",
    ()=>saveConfigFromInitialize,
    "setAccDescription",
    ()=>setAccDescription,
    "setAccTitle",
    ()=>setAccTitle,
    "setConfig",
    ()=>setConfig,
    "setConfig2",
    ()=>setConfig2,
    "setDiagramTitle",
    ()=>setDiagramTitle,
    "setSiteConfig",
    ()=>setSiteConfig,
    "setupGraphViewbox",
    ()=>setupGraphViewbox,
    "setupGraphViewbox2",
    ()=>setupGraphViewbox2,
    "styles_default",
    ()=>styles_default,
    "themes_default",
    ()=>themes_default,
    "updateSiteConfig",
    ()=>updateSiteConfig
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/themes/theme-base.js
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/khroma@2.1.0/node_modules/khroma/dist/methods/adjust.js [app-client] (ecmascript) <export default as adjust>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/khroma@2.1.0/node_modules/khroma/dist/methods/darken.js [app-client] (ecmascript) <export default as darken>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/khroma@2.1.0/node_modules/khroma/dist/methods/invert.js [app-client] (ecmascript) <export default as invert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/khroma@2.1.0/node_modules/khroma/dist/methods/is_dark.js [app-client] (ecmascript) <export default as isDark>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/khroma@2.1.0/node_modules/khroma/dist/methods/lighten.js [app-client] (ecmascript) <export default as lighten>");
// src/themes/theme-dark.js
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/khroma@2.1.0/node_modules/khroma/dist/methods/rgba.js [app-client] (ecmascript) <export default as rgba>");
// src/diagrams/common/common.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dompurify$40$3$2e$4$2e$11$2f$node_modules$2f$dompurify$2f$dist$2f$purify$2e$es$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/dompurify@3.4.11/node_modules/dompurify/dist/purify.es.mjs [app-client] (ecmascript)");
var _class, _class1, _class2, _class3, _class4, _class5, _class6, _class7, _class8, _class9, _class10, _class11, _class12;
;
;
// src/assignWithDepth.ts
var assignWithDepth = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(dst, src) {
    let { depth = 2, clobber = false } = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    const config2 = {
        depth,
        clobber
    };
    if (Array.isArray(src) && !Array.isArray(dst)) {
        src.forEach((s)=>assignWithDepth(dst, s, config2));
        return dst;
    } else if (Array.isArray(src) && Array.isArray(dst)) {
        src.forEach((s)=>{
            if (!dst.includes(s)) {
                dst.push(s);
            }
        });
        return dst;
    }
    if (dst === void 0 || depth <= 0) {
        if (dst !== void 0 && dst !== null && typeof dst === "object" && typeof src === "object") {
            return Object.assign(dst, src);
        } else {
            return src;
        }
    }
    if (src !== void 0 && typeof dst === "object" && typeof src === "object") {
        Object.keys(src).forEach((key)=>{
            if (typeof src[key] === "object" && src[key] !== null && (dst[key] === void 0 || typeof dst[key] === "object")) {
                if (dst[key] === void 0) {
                    dst[key] = Array.isArray(src[key]) ? [] : {};
                }
                dst[key] = assignWithDepth(dst[key], src[key], {
                    depth: depth - 1,
                    clobber
                });
            } else if (clobber || typeof dst[key] !== "object" && typeof src[key] !== "object") {
                dst[key] = src[key];
            }
        });
    }
    return dst;
}, "assignWithDepth");
var assignWithDepth_default = assignWithDepth;
;
// src/themes/erDiagram-oldHardcodedValues.ts
var oldAttributeBackgroundColorOdd = "#ffffff";
var oldAttributeBackgroundColorEven = "#f2f2f2";
;
var mkBorder = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((col, darkMode)=>darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(col, {
        s: -40,
        l: 10
    }) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(col, {
        s: -40,
        l: -10
    }), "mkBorder");
// src/themes/theme-base.js
var Theme = (_class = class {
    updateColors() {
        var _this_cynefin, _this_cynefin1, _this_cynefin2, _this_cynefin3, _this_cynefin4, _this_cynefin5, _this_cynefin6, _this_cynefin7, _this_cynefin8, _this_cynefin9, _this_cynefin10, _this_cynefin11, _this_cynefin12, _this_cynefin13, _this_cynefin14, _this_radar, _this_radar1, _this_radar2, _this_radar3, _this_radar4, _this_radar5, _this_radar6, _this_radar7, _this_radar8, _this_radar9, _this_wardley, _this_wardley1, _this_wardley2, _this_wardley3, _this_wardley4, _this_wardley5, _this_wardley6, _this_wardley7, _this_wardley8, _this_wardley9, _this_wardley10, _this_wardley11, _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10, _this_xyChart11;
        this.primaryTextColor = this.primaryTextColor || (this.darkMode ? "#eee" : "#333");
        this.secondaryColor = this.secondaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -120
        });
        this.tertiaryColor = this.tertiaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 180,
            l: 5
        });
        this.primaryBorderColor = this.primaryBorderColor || mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = this.secondaryBorderColor || mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = this.tertiaryBorderColor || mkBorder(this.tertiaryColor, this.darkMode);
        this.noteBorderColor = this.noteBorderColor || mkBorder(this.noteBkgColor, this.darkMode);
        this.noteBkgColor = this.noteBkgColor || "#fff5ad";
        this.noteTextColor = this.noteTextColor || "#333";
        this.secondaryTextColor = this.secondaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = this.tertiaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = this.lineColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.arrowheadColor = this.arrowheadColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = this.textColor || this.primaryTextColor;
        this.border2 = this.border2 || this.tertiaryBorderColor;
        this.nodeBkg = this.nodeBkg || this.primaryColor;
        this.mainBkg = this.mainBkg || this.primaryColor;
        this.nodeBorder = this.nodeBorder || this.primaryBorderColor;
        this.clusterBkg = this.clusterBkg || this.tertiaryColor;
        this.clusterBorder = this.clusterBorder || this.tertiaryBorderColor;
        this.defaultLinkColor = this.defaultLinkColor || this.lineColor;
        this.titleColor = this.titleColor || this.tertiaryTextColor;
        this.edgeLabelBackground = this.edgeLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.nodeTextColor = this.nodeTextColor || this.primaryTextColor;
        this.actorBorder = this.actorBorder || this.primaryBorderColor;
        this.actorBkg = this.actorBkg || this.mainBkg;
        this.actorTextColor = this.actorTextColor || this.primaryTextColor;
        this.actorLineColor = this.actorLineColor || this.actorBorder;
        this.labelBoxBkgColor = this.labelBoxBkgColor || this.actorBkg;
        this.signalColor = this.signalColor || this.textColor;
        this.signalTextColor = this.signalTextColor || this.textColor;
        this.labelBoxBorderColor = this.labelBoxBorderColor || this.actorBorder;
        this.labelTextColor = this.labelTextColor || this.actorTextColor;
        this.loopTextColor = this.loopTextColor || this.actorTextColor;
        this.activationBorderColor = this.activationBorderColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 10);
        this.activationBkgColor = this.activationBkgColor || this.secondaryColor;
        this.sequenceNumberColor = this.sequenceNumberColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.lineColor);
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.sectionBkgColor = this.sectionBkgColor || this.tertiaryColor;
        this.altSectionBkgColor = this.altSectionBkgColor || "white";
        this.sectionBkgColor = this.sectionBkgColor || this.secondaryColor;
        this.sectionBkgColor2 = this.sectionBkgColor2 || this.primaryColor;
        this.excludeBkgColor = this.excludeBkgColor || "#eeeeee";
        this.taskBorderColor = this.taskBorderColor || this.primaryBorderColor;
        this.taskBkgColor = this.taskBkgColor || this.primaryColor;
        this.activeTaskBorderColor = this.activeTaskBorderColor || this.primaryColor;
        this.activeTaskBkgColor = this.activeTaskBkgColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 23);
        this.gridColor = this.gridColor || "lightgrey";
        this.doneTaskBkgColor = this.doneTaskBkgColor || "lightgrey";
        this.doneTaskBorderColor = this.doneTaskBorderColor || "grey";
        this.critBorderColor = this.critBorderColor || "#ff8888";
        this.critBkgColor = this.critBkgColor || "red";
        this.todayLineColor = this.todayLineColor || "red";
        this.vertLineColor = this.vertLineColor || "navy";
        this.taskTextColor = this.taskTextColor || this.textColor;
        this.taskTextOutsideColor = this.taskTextOutsideColor || this.textColor;
        this.taskTextLightColor = this.taskTextLightColor || this.textColor;
        this.taskTextColor = this.taskTextColor || this.primaryTextColor;
        this.taskTextDarkColor = this.taskTextDarkColor || this.textColor;
        this.taskTextClickableColor = this.taskTextClickableColor || "#003163";
        this.noteFontWeight = this.noteFontWeight || "normal";
        this.fontWeight = this.fontWeight || "normal";
        this.personBorder = this.personBorder || this.primaryBorderColor;
        this.personBkg = this.personBkg || this.mainBkg;
        if (this.darkMode) {
            this.rowOdd = this.rowOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.mainBkg, 5) || "#ffffff";
            this.rowEven = this.rowEven || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.mainBkg, 10);
        } else {
            this.rowOdd = this.rowOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 75) || "#ffffff";
            this.rowEven = this.rowEven || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 5);
        }
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || this.tertiaryColor;
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.specialStateColor = this.lineColor;
        this.cScale0 = this.cScale0 || this.primaryColor;
        this.cScale1 = this.cScale1 || this.secondaryColor;
        this.cScale2 = this.cScale2 || this.tertiaryColor;
        this.cScale3 = this.cScale3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 30
        });
        this.cScale4 = this.cScale4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.cScale5 = this.cScale5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 90
        });
        this.cScale6 = this.cScale6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.cScale7 = this.cScale7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 150
        });
        this.cScale8 = this.cScale8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 210,
            l: 150
        });
        this.cScale9 = this.cScale9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 270
        });
        this.cScale10 = this.cScale10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 300
        });
        this.cScale11 = this.cScale11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 330
        });
        if (this.darkMode) {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 75);
            }
        } else {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 25);
            }
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        const multiplier = this.darkMode ? -4 : -1;
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (5 + i * 3)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (8 + i * 3)
            });
        }
        this.classText = this.classText || this.textColor;
        this.fillType0 = this.fillType0 || this.primaryColor;
        this.fillType1 = this.fillType1 || this.secondaryColor;
        this.fillType2 = this.fillType2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = this.fillType3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = this.fillType4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = this.fillType5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = this.fillType6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = this.fillType7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || this.primaryColor;
        this.pie2 = this.pie2 || this.secondaryColor;
        this.pie3 = this.pie3 || this.tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -10
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -10
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -20
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -20
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -10
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_venn1;
        this.venn1 = (_this_venn1 = this.venn1) !== null && _this_venn1 !== void 0 ? _this_venn1 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -30
        });
        var _this_venn2;
        this.venn2 = (_this_venn2 = this.venn2) !== null && _this_venn2 !== void 0 ? _this_venn2 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -30
        });
        var _this_venn3;
        this.venn3 = (_this_venn3 = this.venn3) !== null && _this_venn3 !== void 0 ? _this_venn3 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -30
        });
        var _this_venn4;
        this.venn4 = (_this_venn4 = this.venn4) !== null && _this_venn4 !== void 0 ? _this_venn4 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -30
        });
        var _this_venn5;
        this.venn5 = (_this_venn5 = this.venn5) !== null && _this_venn5 !== void 0 ? _this_venn5 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -30
        });
        var _this_venn6;
        this.venn6 = (_this_venn6 = this.venn6) !== null && _this_venn6 !== void 0 ? _this_venn6 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 60,
            l: -30
        });
        var _this_venn7;
        this.venn7 = (_this_venn7 = this.venn7) !== null && _this_venn7 !== void 0 ? _this_venn7 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -30
        });
        var _this_venn8;
        this.venn8 = (_this_venn8 = this.venn8) !== null && _this_venn8 !== void 0 ? _this_venn8 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 120,
            l: -30
        });
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.cynefin = {
            domainFontSize: ((_this_cynefin = this.cynefin) === null || _this_cynefin === void 0 ? void 0 : _this_cynefin.domainFontSize) || 16,
            itemFontSize: ((_this_cynefin1 = this.cynefin) === null || _this_cynefin1 === void 0 ? void 0 : _this_cynefin1.itemFontSize) || 12,
            boundaryColor: ((_this_cynefin2 = this.cynefin) === null || _this_cynefin2 === void 0 ? void 0 : _this_cynefin2.boundaryColor) || this.lineColor,
            boundaryWidth: ((_this_cynefin3 = this.cynefin) === null || _this_cynefin3 === void 0 ? void 0 : _this_cynefin3.boundaryWidth) || 2,
            cliffColor: ((_this_cynefin4 = this.cynefin) === null || _this_cynefin4 === void 0 ? void 0 : _this_cynefin4.cliffColor) || "#8B0000",
            cliffWidth: ((_this_cynefin5 = this.cynefin) === null || _this_cynefin5 === void 0 ? void 0 : _this_cynefin5.cliffWidth) || 4,
            arrowColor: ((_this_cynefin6 = this.cynefin) === null || _this_cynefin6 === void 0 ? void 0 : _this_cynefin6.arrowColor) || this.lineColor,
            arrowWidth: ((_this_cynefin7 = this.cynefin) === null || _this_cynefin7 === void 0 ? void 0 : _this_cynefin7.arrowWidth) || 2,
            complexBg: ((_this_cynefin8 = this.cynefin) === null || _this_cynefin8 === void 0 ? void 0 : _this_cynefin8.complexBg) || "#E8F5E9",
            complicatedBg: ((_this_cynefin9 = this.cynefin) === null || _this_cynefin9 === void 0 ? void 0 : _this_cynefin9.complicatedBg) || "#E3F2FD",
            chaoticBg: ((_this_cynefin10 = this.cynefin) === null || _this_cynefin10 === void 0 ? void 0 : _this_cynefin10.chaoticBg) || "#FBE9E7",
            clearBg: ((_this_cynefin11 = this.cynefin) === null || _this_cynefin11 === void 0 ? void 0 : _this_cynefin11.clearBg) || "#FFF8E1",
            confusionBg: ((_this_cynefin12 = this.cynefin) === null || _this_cynefin12 === void 0 ? void 0 : _this_cynefin12.confusionBg) || "#F3E5F5",
            textColor: ((_this_cynefin13 = this.cynefin) === null || _this_cynefin13 === void 0 ? void 0 : _this_cynefin13.textColor) || this.textColor,
            labelColor: ((_this_cynefin14 = this.cynefin) === null || _this_cynefin14 === void 0 ? void 0 : _this_cynefin14.labelColor) || this.primaryTextColor
        };
        this.radar = {
            axisColor: ((_this_radar = this.radar) === null || _this_radar === void 0 ? void 0 : _this_radar.axisColor) || this.lineColor,
            axisStrokeWidth: ((_this_radar1 = this.radar) === null || _this_radar1 === void 0 ? void 0 : _this_radar1.axisStrokeWidth) || 2,
            axisLabelFontSize: ((_this_radar2 = this.radar) === null || _this_radar2 === void 0 ? void 0 : _this_radar2.axisLabelFontSize) || 12,
            curveOpacity: ((_this_radar3 = this.radar) === null || _this_radar3 === void 0 ? void 0 : _this_radar3.curveOpacity) || 0.5,
            curveStrokeWidth: ((_this_radar4 = this.radar) === null || _this_radar4 === void 0 ? void 0 : _this_radar4.curveStrokeWidth) || 2,
            graticuleColor: ((_this_radar5 = this.radar) === null || _this_radar5 === void 0 ? void 0 : _this_radar5.graticuleColor) || "#DEDEDE",
            graticuleStrokeWidth: ((_this_radar6 = this.radar) === null || _this_radar6 === void 0 ? void 0 : _this_radar6.graticuleStrokeWidth) || 1,
            graticuleOpacity: ((_this_radar7 = this.radar) === null || _this_radar7 === void 0 ? void 0 : _this_radar7.graticuleOpacity) || 0.3,
            legendBoxSize: ((_this_radar8 = this.radar) === null || _this_radar8 === void 0 ? void 0 : _this_radar8.legendBoxSize) || 12,
            legendFontSize: ((_this_radar9 = this.radar) === null || _this_radar9 === void 0 ? void 0 : _this_radar9.legendFontSize) || 12
        };
        this.wardleyEvolutionColor = this.wardleyEvolutionColor || "#dc3545";
        this.wardley = {
            backgroundColor: ((_this_wardley = this.wardley) === null || _this_wardley === void 0 ? void 0 : _this_wardley.backgroundColor) || this.background,
            axisColor: ((_this_wardley1 = this.wardley) === null || _this_wardley1 === void 0 ? void 0 : _this_wardley1.axisColor) || this.lineColor,
            axisTextColor: ((_this_wardley2 = this.wardley) === null || _this_wardley2 === void 0 ? void 0 : _this_wardley2.axisTextColor) || this.primaryTextColor,
            gridColor: ((_this_wardley3 = this.wardley) === null || _this_wardley3 === void 0 ? void 0 : _this_wardley3.gridColor) || this.gridColor,
            componentFill: ((_this_wardley4 = this.wardley) === null || _this_wardley4 === void 0 ? void 0 : _this_wardley4.componentFill) || this.background,
            componentStroke: ((_this_wardley5 = this.wardley) === null || _this_wardley5 === void 0 ? void 0 : _this_wardley5.componentStroke) || this.lineColor,
            componentLabelColor: ((_this_wardley6 = this.wardley) === null || _this_wardley6 === void 0 ? void 0 : _this_wardley6.componentLabelColor) || this.primaryTextColor,
            linkStroke: ((_this_wardley7 = this.wardley) === null || _this_wardley7 === void 0 ? void 0 : _this_wardley7.linkStroke) || this.lineColor,
            evolutionStroke: ((_this_wardley8 = this.wardley) === null || _this_wardley8 === void 0 ? void 0 : _this_wardley8.evolutionStroke) || this.wardleyEvolutionColor,
            annotationStroke: ((_this_wardley9 = this.wardley) === null || _this_wardley9 === void 0 ? void 0 : _this_wardley9.annotationStroke) || this.lineColor,
            annotationTextColor: ((_this_wardley10 = this.wardley) === null || _this_wardley10 === void 0 ? void 0 : _this_wardley10.annotationTextColor) || this.primaryTextColor,
            annotationFill: ((_this_wardley11 = this.wardley) === null || _this_wardley11 === void 0 ? void 0 : _this_wardley11.annotationFill) || this.background
        };
        this.archEdgeColor = this.archEdgeColor || "#777";
        this.archEdgeArrowColor = this.archEdgeArrowColor || "#777";
        this.archEdgeWidth = this.archEdgeWidth || "3";
        this.archGroupBorderColor = this.archGroupBorderColor || "#000";
        this.archGroupBorderWidth = this.archGroupBorderWidth || "2px";
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            dataLabelColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.dataLabelColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart11 = this.xyChart) === null || _this_xyChart11 === void 0 ? void 0 : _this_xyChart11.plotColorPalette) || "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0"
        };
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = this.git0 || this.primaryColor;
        this.git1 = this.git1 || this.secondaryColor;
        this.git2 = this.git2 || this.tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.gitBranchLabel0 = this.gitBranchLabel0 || this.branchLabelColor;
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.branchLabelColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.branchLabelColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || this.branchLabelColor;
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.branchLabelColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.branchLabelColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.branchLabelColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.emUiFill = this.emUiFill || "white";
        this.emUiStroke = this.emUiStroke || "#dbdada";
        this.emProcessorFill = this.emProcessorFill || "#edb3f6";
        this.emProcessorStroke = this.emProcessorStroke || "#b88cbf";
        this.emReadModelFill = this.emReadModelFill || "#d3f1a2";
        this.emReadModelStroke = this.emReadModelStroke || "#a3b732";
        this.emCommandFill = this.emCommandFill || "#bcd6fe";
        this.emCommandStroke = this.emCommandStroke || "#679ac3";
        this.emEventFill = this.emEventFill || "#ffb778";
        this.emEventStroke = this.emEventStroke || "#c19a0f";
        this.emSwimlaneBackgroundOdd = this.emSwimlaneBackgroundOdd || "rgb(250,250,250)";
        this.emSwimlaneBackgroundStroke = this.emSwimlaneBackgroundStroke || "rgb(240,240,240)";
        this.emArrowhead = this.emArrowhead || this.lineColor;
        this.emRelationStroke = this.emRelationStroke || this.lineColor;
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
        this.gradientStart = this.primaryBorderColor;
        this.gradientStop = this.secondaryBorderColor;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#f4f4f4";
        this.primaryColor = "#fff4dd";
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "#333";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 5;
        this.strokeWidth = 1;
        this.fontFamily = '"trebuchet ms", verdana, arial, sans-serif';
        this.fontSize = "16px";
        this.useGradient = true;
        this.dropShadow = "drop-shadow( 1px 2px 2px rgba(185,185,185,1))";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class, "Theme"), _class);
var getThemeVariables = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme2 = (_class1 = class {
    updateColors() {
        var _this_cynefin, _this_cynefin1, _this_cynefin2, _this_cynefin3, _this_cynefin4, _this_cynefin5, _this_cynefin6, _this_cynefin7, _this_cynefin8, _this_cynefin9, _this_cynefin10, _this_cynefin11, _this_cynefin12, _this_cynefin13, _this_cynefin14, _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10, _this_xyChart11, _this_radar, _this_radar1, _this_radar2, _this_radar3, _this_radar4, _this_radar5, _this_radar6, _this_radar7, _this_radar8, _this_radar9, _this_wardley, _this_wardley1, _this_wardley2, _this_wardley3, _this_wardley4, _this_wardley5, _this_wardley6, _this_wardley7, _this_wardley8, _this_wardley9, _this_wardley10, _this_wardley11;
        this.secondBkg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 16);
        this.lineColor = this.mainContrastColor;
        this.arrowheadColor = this.mainContrastColor;
        this.nodeBkg = this.mainBkg;
        this.nodeBorder = this.border1;
        this.clusterBkg = this.secondBkg;
        this.clusterBorder = this.border2;
        this.defaultLinkColor = this.lineColor;
        this.edgeLabelBackground = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.labelBackground, 25);
        this.actorBorder = this.border1;
        this.actorBkg = this.mainBkg;
        this.actorTextColor = this.mainContrastColor;
        this.actorLineColor = this.actorBorder;
        this.signalColor = this.mainContrastColor;
        this.signalTextColor = this.mainContrastColor;
        this.labelBoxBkgColor = this.actorBkg;
        this.labelBoxBorderColor = this.actorBorder;
        this.labelTextColor = this.mainContrastColor;
        this.loopTextColor = this.mainContrastColor;
        this.noteBorderColor = this.secondaryBorderColor;
        this.noteBkgColor = this.secondBkg;
        this.noteTextColor = this.secondaryTextColor;
        this.activationBorderColor = this.border1;
        this.activationBkgColor = this.secondBkg;
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.altSectionBkgColor = this.background;
        this.taskBkgColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 23);
        this.taskTextColor = this.darkTextColor;
        this.taskTextLightColor = this.mainContrastColor;
        this.taskTextOutsideColor = this.taskTextLightColor;
        this.gridColor = this.mainContrastColor;
        this.doneTaskBkgColor = this.mainContrastColor;
        this.taskTextDarkColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.doneTaskBkgColor);
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#555";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.primaryBorderColor;
        this.specialStateColor = "#f4f4f4";
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.fillType0 = this.primaryColor;
        this.fillType1 = this.secondaryColor;
        this.fillType2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        this.cScale1 = this.cScale1 || "#0b0000";
        this.cScale2 = this.cScale2 || "#4d1037";
        this.cScale3 = this.cScale3 || "#3f5258";
        this.cScale4 = this.cScale4 || "#4f2f1b";
        this.cScale5 = this.cScale5 || "#6e0a0a";
        this.cScale6 = this.cScale6 || "#3b0048";
        this.cScale7 = this.cScale7 || "#995a01";
        this.cScale8 = this.cScale8 || "#154706";
        this.cScale9 = this.cScale9 || "#161722";
        this.cScale10 = this.cScale10 || "#00296f";
        this.cScale11 = this.cScale11 || "#01629c";
        this.cScale12 = this.cScale12 || "#010029";
        this.cScale0 = this.cScale0 || this.primaryColor;
        this.cScale1 = this.cScale1 || this.secondaryColor;
        this.cScale2 = this.cScale2 || this.tertiaryColor;
        this.cScale3 = this.cScale3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 30
        });
        this.cScale4 = this.cScale4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.cScale5 = this.cScale5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 90
        });
        this.cScale6 = this.cScale6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.cScale7 = this.cScale7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 150
        });
        this.cScale8 = this.cScale8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 210
        });
        this.cScale9 = this.cScale9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 270
        });
        this.cScale10 = this.cScale10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 300
        });
        this.cScale11 = this.cScale11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 330
        });
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
        }
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 30,
                s: -30,
                l: -(-10 + i * 4)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 30,
                s: -30,
                l: -(-7 + i * 4)
            });
        }
        this.scaleLabelColor = this.scaleLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["pie" + i] = this["cScale" + i];
        }
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.mainContrastColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.mainContrastColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        for(let i = 0; i < 8; i++){
            var _this_;
            this["venn" + (i + 1)] = (_this_ = this["venn" + (i + 1)]) !== null && _this_ !== void 0 ? _this_ : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 30);
        }
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.cynefin = {
            domainFontSize: ((_this_cynefin = this.cynefin) === null || _this_cynefin === void 0 ? void 0 : _this_cynefin.domainFontSize) || 16,
            itemFontSize: ((_this_cynefin1 = this.cynefin) === null || _this_cynefin1 === void 0 ? void 0 : _this_cynefin1.itemFontSize) || 12,
            boundaryColor: ((_this_cynefin2 = this.cynefin) === null || _this_cynefin2 === void 0 ? void 0 : _this_cynefin2.boundaryColor) || this.lineColor,
            boundaryWidth: ((_this_cynefin3 = this.cynefin) === null || _this_cynefin3 === void 0 ? void 0 : _this_cynefin3.boundaryWidth) || 2,
            cliffColor: ((_this_cynefin4 = this.cynefin) === null || _this_cynefin4 === void 0 ? void 0 : _this_cynefin4.cliffColor) || "#FF6B6B",
            cliffWidth: ((_this_cynefin5 = this.cynefin) === null || _this_cynefin5 === void 0 ? void 0 : _this_cynefin5.cliffWidth) || 4,
            arrowColor: ((_this_cynefin6 = this.cynefin) === null || _this_cynefin6 === void 0 ? void 0 : _this_cynefin6.arrowColor) || this.lineColor,
            arrowWidth: ((_this_cynefin7 = this.cynefin) === null || _this_cynefin7 === void 0 ? void 0 : _this_cynefin7.arrowWidth) || 2,
            complexBg: ((_this_cynefin8 = this.cynefin) === null || _this_cynefin8 === void 0 ? void 0 : _this_cynefin8.complexBg) || "#1B5E20",
            complicatedBg: ((_this_cynefin9 = this.cynefin) === null || _this_cynefin9 === void 0 ? void 0 : _this_cynefin9.complicatedBg) || "#0D47A1",
            chaoticBg: ((_this_cynefin10 = this.cynefin) === null || _this_cynefin10 === void 0 ? void 0 : _this_cynefin10.chaoticBg) || "#BF360C",
            clearBg: ((_this_cynefin11 = this.cynefin) === null || _this_cynefin11 === void 0 ? void 0 : _this_cynefin11.clearBg) || "#F57F17",
            confusionBg: ((_this_cynefin12 = this.cynefin) === null || _this_cynefin12 === void 0 ? void 0 : _this_cynefin12.confusionBg) || "#4A148C",
            textColor: ((_this_cynefin13 = this.cynefin) === null || _this_cynefin13 === void 0 ? void 0 : _this_cynefin13.textColor) || this.textColor,
            labelColor: ((_this_cynefin14 = this.cynefin) === null || _this_cynefin14 === void 0 ? void 0 : _this_cynefin14.labelColor) || this.primaryTextColor
        };
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            dataLabelColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.dataLabelColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart11 = this.xyChart) === null || _this_xyChart11 === void 0 ? void 0 : _this_xyChart11.plotColorPalette) || "#3498db,#2ecc71,#e74c3c,#f1c40f,#bdc3c7,#ffffff,#34495e,#9b59b6,#1abc9c,#e67e22"
        };
        this.packet = {
            startByteColor: this.primaryTextColor,
            endByteColor: this.primaryTextColor,
            labelColor: this.primaryTextColor,
            titleColor: this.primaryTextColor,
            blockStrokeColor: this.primaryTextColor,
            blockFillColor: this.background
        };
        this.radar = {
            axisColor: ((_this_radar = this.radar) === null || _this_radar === void 0 ? void 0 : _this_radar.axisColor) || this.lineColor,
            axisStrokeWidth: ((_this_radar1 = this.radar) === null || _this_radar1 === void 0 ? void 0 : _this_radar1.axisStrokeWidth) || 2,
            axisLabelFontSize: ((_this_radar2 = this.radar) === null || _this_radar2 === void 0 ? void 0 : _this_radar2.axisLabelFontSize) || 12,
            curveOpacity: ((_this_radar3 = this.radar) === null || _this_radar3 === void 0 ? void 0 : _this_radar3.curveOpacity) || 0.5,
            curveStrokeWidth: ((_this_radar4 = this.radar) === null || _this_radar4 === void 0 ? void 0 : _this_radar4.curveStrokeWidth) || 2,
            graticuleColor: ((_this_radar5 = this.radar) === null || _this_radar5 === void 0 ? void 0 : _this_radar5.graticuleColor) || "#DEDEDE",
            graticuleStrokeWidth: ((_this_radar6 = this.radar) === null || _this_radar6 === void 0 ? void 0 : _this_radar6.graticuleStrokeWidth) || 1,
            graticuleOpacity: ((_this_radar7 = this.radar) === null || _this_radar7 === void 0 ? void 0 : _this_radar7.graticuleOpacity) || 0.3,
            legendBoxSize: ((_this_radar8 = this.radar) === null || _this_radar8 === void 0 ? void 0 : _this_radar8.legendBoxSize) || 12,
            legendFontSize: ((_this_radar9 = this.radar) === null || _this_radar9 === void 0 ? void 0 : _this_radar9.legendFontSize) || 12
        };
        this.wardleyEvolutionColor = this.wardleyEvolutionColor || "#ff6b6b";
        this.wardley = {
            backgroundColor: ((_this_wardley = this.wardley) === null || _this_wardley === void 0 ? void 0 : _this_wardley.backgroundColor) || this.background,
            axisColor: ((_this_wardley1 = this.wardley) === null || _this_wardley1 === void 0 ? void 0 : _this_wardley1.axisColor) || this.lineColor,
            axisTextColor: ((_this_wardley2 = this.wardley) === null || _this_wardley2 === void 0 ? void 0 : _this_wardley2.axisTextColor) || this.primaryTextColor,
            gridColor: ((_this_wardley3 = this.wardley) === null || _this_wardley3 === void 0 ? void 0 : _this_wardley3.gridColor) || this.gridColor,
            componentFill: ((_this_wardley4 = this.wardley) === null || _this_wardley4 === void 0 ? void 0 : _this_wardley4.componentFill) || this.mainBkg,
            componentStroke: ((_this_wardley5 = this.wardley) === null || _this_wardley5 === void 0 ? void 0 : _this_wardley5.componentStroke) || this.lineColor,
            componentLabelColor: ((_this_wardley6 = this.wardley) === null || _this_wardley6 === void 0 ? void 0 : _this_wardley6.componentLabelColor) || this.primaryTextColor,
            linkStroke: ((_this_wardley7 = this.wardley) === null || _this_wardley7 === void 0 ? void 0 : _this_wardley7.linkStroke) || this.lineColor,
            evolutionStroke: ((_this_wardley8 = this.wardley) === null || _this_wardley8 === void 0 ? void 0 : _this_wardley8.evolutionStroke) || this.wardleyEvolutionColor,
            annotationStroke: ((_this_wardley9 = this.wardley) === null || _this_wardley9 === void 0 ? void 0 : _this_wardley9.annotationStroke) || this.lineColor,
            annotationTextColor: ((_this_wardley10 = this.wardley) === null || _this_wardley10 === void 0 ? void 0 : _this_wardley10.annotationTextColor) || this.primaryTextColor,
            annotationFill: ((_this_wardley11 = this.wardley) === null || _this_wardley11 === void 0 ? void 0 : _this_wardley11.annotationFill) || this.mainBkg
        };
        this.classText = this.primaryTextColor;
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.secondaryColor, 20);
        this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.pie2 || this.secondaryColor, 20);
        this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.pie3 || this.tertiaryColor, 20);
        this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -30
        }), 20);
        this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60
        }), 20);
        this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90
        }), 10);
        this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        }), 10);
        this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        }), 20);
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.gitBranchLabel0 = this.gitBranchLabel0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.labelTextColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.labelTextColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.labelTextColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.labelTextColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.labelTextColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.labelTextColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.emUiFill = this.emUiFill || "#2d2d2d";
        this.emUiStroke = this.emUiStroke || "#555";
        this.emProcessorFill = this.emProcessorFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])("#5a3d5c", 10);
        this.emProcessorStroke = this.emProcessorStroke || "#8a6d8c";
        this.emReadModelFill = this.emReadModelFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])("#3d5a2d", 10);
        this.emReadModelStroke = this.emReadModelStroke || "#6d8c5c";
        this.emCommandFill = this.emCommandFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])("#2d3d5a", 10);
        this.emCommandStroke = this.emCommandStroke || "#5c6d8c";
        this.emEventFill = this.emEventFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])("#5a452d", 10);
        this.emEventStroke = this.emEventStroke || "#8c755c";
        this.emSwimlaneBackgroundOdd = this.emSwimlaneBackgroundOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.background, 5);
        this.emSwimlaneBackgroundStroke = this.emSwimlaneBackgroundStroke || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.background, 12);
        this.emArrowhead = this.emArrowhead || this.lineColor;
        this.emRelationStroke = this.emRelationStroke || this.lineColor;
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.background, 12);
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.background, 2);
        this.nodeBorder = this.nodeBorder || "#999";
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#333";
        this.primaryColor = "#1f2020";
        this.secondaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 16);
        this.tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -160
        });
        this.primaryBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.secondaryBorderColor = mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = mkBorder(this.tertiaryColor, this.darkMode);
        this.primaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.secondaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.mainBkg = "#1f2020";
        this.secondBkg = "calculated";
        this.mainContrastColor = "lightgrey";
        this.darkTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])("#323D47"), 10);
        this.lineColor = "calculated";
        this.border1 = "#ccc";
        this.border2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__["rgba"])(255, 255, 255, 0.25);
        this.arrowheadColor = "calculated";
        this.fontFamily = '"trebuchet ms", verdana, arial, sans-serif';
        this.fontSize = "16px";
        this.labelBackground = "#181818";
        this.textColor = "#ccc";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 5;
        this.strokeWidth = 1;
        this.nodeBkg = "calculated";
        this.nodeBorder = "calculated";
        this.clusterBkg = "calculated";
        this.clusterBorder = "calculated";
        this.defaultLinkColor = "calculated";
        this.titleColor = "#F9FFFE";
        this.edgeLabelBackground = "calculated";
        this.actorBorder = "calculated";
        this.actorBkg = "calculated";
        this.actorTextColor = "calculated";
        this.actorLineColor = "calculated";
        this.signalColor = "calculated";
        this.signalTextColor = "calculated";
        this.labelBoxBkgColor = "calculated";
        this.labelBoxBorderColor = "calculated";
        this.labelTextColor = "calculated";
        this.loopTextColor = "calculated";
        this.noteBorderColor = "calculated";
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "calculated";
        this.activationBorderColor = "calculated";
        this.activationBkgColor = "calculated";
        this.sequenceNumberColor = "black";
        this.clusterBkg = "#302F3D";
        this.sectionBkgColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])("#EAE8D9", 30);
        this.altSectionBkgColor = "calculated";
        this.sectionBkgColor2 = "#EAE8D9";
        this.excludeBkgColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.sectionBkgColor, 10);
        this.taskBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__["rgba"])(255, 255, 255, 70);
        this.taskBkgColor = "calculated";
        this.taskTextColor = "calculated";
        this.taskTextLightColor = "calculated";
        this.taskTextOutsideColor = "calculated";
        this.taskTextClickableColor = "#003163";
        this.activeTaskBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__["rgba"])(255, 255, 255, 50);
        this.activeTaskBkgColor = "#81B1DB";
        this.gridColor = "calculated";
        this.doneTaskBkgColor = "calculated";
        this.doneTaskBorderColor = "grey";
        this.critBorderColor = "#E83737";
        this.critBkgColor = "#E83737";
        this.taskTextDarkColor = "calculated";
        this.todayLineColor = "#DB5757";
        this.vertLineColor = "#00BFFF";
        this.personBorder = this.primaryBorderColor;
        this.personBkg = this.mainBkg;
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.rowOdd = this.rowOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 5) || "#ffffff";
        this.rowEven = this.rowEven || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.mainBkg, 10);
        this.labelColor = "calculated";
        this.errorBkgColor = "#a44141";
        this.errorTextColor = "#ddd";
        this.useGradient = true;
        this.gradientStart = this.primaryBorderColor;
        this.gradientStop = this.secondaryBorderColor;
        this.dropShadow = "drop-shadow( 1px 2px 2px rgba(185,185,185,1))";
        this.noteFontWeight = this.noteFontWeight || "normal";
        this.fontWeight = this.fontWeight || "normal";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class1, "Theme"), _class1);
var getThemeVariables2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme2();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme3 = (_class2 = class {
    updateColors() {
        var _this_cynefin, _this_cynefin1, _this_cynefin2, _this_cynefin3, _this_cynefin4, _this_cynefin5, _this_cynefin6, _this_cynefin7, _this_cynefin8, _this_cynefin9, _this_cynefin10, _this_cynefin11, _this_cynefin12, _this_cynefin13, _this_cynefin14, _this_radar, _this_radar1, _this_radar2, _this_radar3, _this_radar4, _this_radar5, _this_radar6, _this_radar7, _this_radar8, _this_radar9, _this_wardley, _this_wardley1, _this_wardley2, _this_wardley3, _this_wardley4, _this_wardley5, _this_wardley6, _this_wardley7, _this_wardley8, _this_wardley9, _this_wardley10, _this_wardley11, _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10, _this_xyChart11;
        this.cScale0 = this.cScale0 || this.primaryColor;
        this.cScale1 = this.cScale1 || this.secondaryColor;
        this.cScale2 = this.cScale2 || this.tertiaryColor;
        this.cScale3 = this.cScale3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 30
        });
        this.cScale4 = this.cScale4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.cScale5 = this.cScale5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 90
        });
        this.cScale6 = this.cScale6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.cScale7 = this.cScale7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 150
        });
        this.cScale8 = this.cScale8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 210
        });
        this.cScale9 = this.cScale9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 270
        });
        this.cScale10 = this.cScale10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 300
        });
        this.cScale11 = this.cScale11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 330
        });
        this["cScalePeer1"] = this["cScalePeer1"] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 45);
        this["cScalePeer2"] = this["cScalePeer2"] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.tertiaryColor, 40);
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 25);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this["cScale" + i], {
                h: 180
            });
        }
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 30,
                l: -(5 + i * 5)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 30,
                l: -(7 + i * 5)
            });
        }
        this.scaleLabelColor = this.scaleLabelColor !== "calculated" && this.scaleLabelColor ? this.scaleLabelColor : this.labelTextColor;
        if (this.labelTextColor !== "calculated") {
            this.cScaleLabel0 = this.cScaleLabel0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
            this.cScaleLabel3 = this.cScaleLabel3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.labelTextColor;
            }
        }
        this.nodeBkg = this.mainBkg;
        this.nodeBorder = this.border1;
        this.clusterBkg = this.secondBkg;
        this.clusterBorder = this.border2;
        this.defaultLinkColor = this.lineColor;
        this.titleColor = this.textColor;
        this.edgeLabelBackground = this.labelBackground;
        this.actorBorder = this.border1;
        this.actorBkg = this.mainBkg;
        this.labelBoxBkgColor = this.actorBkg;
        this.signalColor = this.textColor;
        this.signalTextColor = this.textColor;
        this.labelBoxBorderColor = this.actorBorder;
        this.labelTextColor = this.actorTextColor;
        this.loopTextColor = this.actorTextColor;
        this.noteBorderColor = this.border2;
        this.noteTextColor = this.actorTextColor;
        this.actorLineColor = this.actorBorder;
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.taskTextColor = this.taskTextLightColor;
        this.taskTextOutsideColor = this.taskTextDarkColor;
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.rowOdd = this.rowOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 75) || "#ffffff";
        this.rowEven = this.rowEven || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 1);
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.specialStateColor = this.lineColor;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.classText = this.primaryTextColor;
        this.fillType0 = this.primaryColor;
        this.fillType1 = this.secondaryColor;
        this.fillType2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || this.primaryColor;
        this.pie2 = this.pie2 || this.secondaryColor;
        this.pie3 = this.pie3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -40
        });
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -30
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -20
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -20
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -40
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -40
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -40
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90,
            l: -40
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -30
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_venn1;
        this.venn1 = (_this_venn1 = this.venn1) !== null && _this_venn1 !== void 0 ? _this_venn1 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -30
        });
        var _this_venn2;
        this.venn2 = (_this_venn2 = this.venn2) !== null && _this_venn2 !== void 0 ? _this_venn2 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -30
        });
        var _this_venn3;
        this.venn3 = (_this_venn3 = this.venn3) !== null && _this_venn3 !== void 0 ? _this_venn3 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -40
        });
        var _this_venn4;
        this.venn4 = (_this_venn4 = this.venn4) !== null && _this_venn4 !== void 0 ? _this_venn4 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -30
        });
        var _this_venn5;
        this.venn5 = (_this_venn5 = this.venn5) !== null && _this_venn5 !== void 0 ? _this_venn5 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -30
        });
        var _this_venn6;
        this.venn6 = (_this_venn6 = this.venn6) !== null && _this_venn6 !== void 0 ? _this_venn6 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 60,
            l: -30
        });
        var _this_venn7;
        this.venn7 = (_this_venn7 = this.venn7) !== null && _this_venn7 !== void 0 ? _this_venn7 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -30
        });
        var _this_venn8;
        this.venn8 = (_this_venn8 = this.venn8) !== null && _this_venn8 !== void 0 ? _this_venn8 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 120,
            l: -30
        });
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.cynefin = {
            domainFontSize: ((_this_cynefin = this.cynefin) === null || _this_cynefin === void 0 ? void 0 : _this_cynefin.domainFontSize) || 16,
            itemFontSize: ((_this_cynefin1 = this.cynefin) === null || _this_cynefin1 === void 0 ? void 0 : _this_cynefin1.itemFontSize) || 12,
            boundaryColor: ((_this_cynefin2 = this.cynefin) === null || _this_cynefin2 === void 0 ? void 0 : _this_cynefin2.boundaryColor) || this.lineColor,
            boundaryWidth: ((_this_cynefin3 = this.cynefin) === null || _this_cynefin3 === void 0 ? void 0 : _this_cynefin3.boundaryWidth) || 2,
            cliffColor: ((_this_cynefin4 = this.cynefin) === null || _this_cynefin4 === void 0 ? void 0 : _this_cynefin4.cliffColor) || "#8B0000",
            cliffWidth: ((_this_cynefin5 = this.cynefin) === null || _this_cynefin5 === void 0 ? void 0 : _this_cynefin5.cliffWidth) || 4,
            arrowColor: ((_this_cynefin6 = this.cynefin) === null || _this_cynefin6 === void 0 ? void 0 : _this_cynefin6.arrowColor) || this.lineColor,
            arrowWidth: ((_this_cynefin7 = this.cynefin) === null || _this_cynefin7 === void 0 ? void 0 : _this_cynefin7.arrowWidth) || 2,
            complexBg: ((_this_cynefin8 = this.cynefin) === null || _this_cynefin8 === void 0 ? void 0 : _this_cynefin8.complexBg) || "#E8F5E9",
            complicatedBg: ((_this_cynefin9 = this.cynefin) === null || _this_cynefin9 === void 0 ? void 0 : _this_cynefin9.complicatedBg) || "#E3F2FD",
            chaoticBg: ((_this_cynefin10 = this.cynefin) === null || _this_cynefin10 === void 0 ? void 0 : _this_cynefin10.chaoticBg) || "#FBE9E7",
            clearBg: ((_this_cynefin11 = this.cynefin) === null || _this_cynefin11 === void 0 ? void 0 : _this_cynefin11.clearBg) || "#FFF8E1",
            confusionBg: ((_this_cynefin12 = this.cynefin) === null || _this_cynefin12 === void 0 ? void 0 : _this_cynefin12.confusionBg) || "#F3E5F5",
            textColor: ((_this_cynefin13 = this.cynefin) === null || _this_cynefin13 === void 0 ? void 0 : _this_cynefin13.textColor) || this.textColor,
            labelColor: ((_this_cynefin14 = this.cynefin) === null || _this_cynefin14 === void 0 ? void 0 : _this_cynefin14.labelColor) || this.primaryTextColor
        };
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.radar = {
            axisColor: ((_this_radar = this.radar) === null || _this_radar === void 0 ? void 0 : _this_radar.axisColor) || this.lineColor,
            axisStrokeWidth: ((_this_radar1 = this.radar) === null || _this_radar1 === void 0 ? void 0 : _this_radar1.axisStrokeWidth) || 2,
            axisLabelFontSize: ((_this_radar2 = this.radar) === null || _this_radar2 === void 0 ? void 0 : _this_radar2.axisLabelFontSize) || 12,
            curveOpacity: ((_this_radar3 = this.radar) === null || _this_radar3 === void 0 ? void 0 : _this_radar3.curveOpacity) || 0.5,
            curveStrokeWidth: ((_this_radar4 = this.radar) === null || _this_radar4 === void 0 ? void 0 : _this_radar4.curveStrokeWidth) || 2,
            graticuleColor: ((_this_radar5 = this.radar) === null || _this_radar5 === void 0 ? void 0 : _this_radar5.graticuleColor) || "#DEDEDE",
            graticuleStrokeWidth: ((_this_radar6 = this.radar) === null || _this_radar6 === void 0 ? void 0 : _this_radar6.graticuleStrokeWidth) || 1,
            graticuleOpacity: ((_this_radar7 = this.radar) === null || _this_radar7 === void 0 ? void 0 : _this_radar7.graticuleOpacity) || 0.3,
            legendBoxSize: ((_this_radar8 = this.radar) === null || _this_radar8 === void 0 ? void 0 : _this_radar8.legendBoxSize) || 12,
            legendFontSize: ((_this_radar9 = this.radar) === null || _this_radar9 === void 0 ? void 0 : _this_radar9.legendFontSize) || 12
        };
        this.wardleyEvolutionColor = this.wardleyEvolutionColor || "#dc3545";
        this.wardley = {
            backgroundColor: ((_this_wardley = this.wardley) === null || _this_wardley === void 0 ? void 0 : _this_wardley.backgroundColor) || this.background,
            axisColor: ((_this_wardley1 = this.wardley) === null || _this_wardley1 === void 0 ? void 0 : _this_wardley1.axisColor) || this.lineColor,
            axisTextColor: ((_this_wardley2 = this.wardley) === null || _this_wardley2 === void 0 ? void 0 : _this_wardley2.axisTextColor) || this.primaryTextColor,
            gridColor: ((_this_wardley3 = this.wardley) === null || _this_wardley3 === void 0 ? void 0 : _this_wardley3.gridColor) || this.gridColor,
            componentFill: ((_this_wardley4 = this.wardley) === null || _this_wardley4 === void 0 ? void 0 : _this_wardley4.componentFill) || this.background,
            componentStroke: ((_this_wardley5 = this.wardley) === null || _this_wardley5 === void 0 ? void 0 : _this_wardley5.componentStroke) || this.lineColor,
            componentLabelColor: ((_this_wardley6 = this.wardley) === null || _this_wardley6 === void 0 ? void 0 : _this_wardley6.componentLabelColor) || this.primaryTextColor,
            linkStroke: ((_this_wardley7 = this.wardley) === null || _this_wardley7 === void 0 ? void 0 : _this_wardley7.linkStroke) || this.lineColor,
            evolutionStroke: ((_this_wardley8 = this.wardley) === null || _this_wardley8 === void 0 ? void 0 : _this_wardley8.evolutionStroke) || this.wardleyEvolutionColor,
            annotationStroke: ((_this_wardley9 = this.wardley) === null || _this_wardley9 === void 0 ? void 0 : _this_wardley9.annotationStroke) || this.lineColor,
            annotationTextColor: ((_this_wardley10 = this.wardley) === null || _this_wardley10 === void 0 ? void 0 : _this_wardley10.annotationTextColor) || this.primaryTextColor,
            annotationFill: ((_this_wardley11 = this.wardley) === null || _this_wardley11 === void 0 ? void 0 : _this_wardley11.annotationFill) || this.background
        };
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            dataLabelColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.dataLabelColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart11 = this.xyChart) === null || _this_xyChart11 === void 0 ? void 0 : _this_xyChart11.plotColorPalette) || "#ECECFF,#8493A6,#FFC3A0,#DCDDE1,#B8E994,#D1A36F,#C3CDE6,#FFB6C1,#496078,#F8F3E3"
        };
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || this.labelBackground;
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = this.git0 || this.primaryColor;
        this.git1 = this.git1 || this.secondaryColor;
        this.git2 = this.git2 || this.tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0), 25);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.gitBranchLabel0 = this.gitBranchLabel0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.labelTextColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.labelTextColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.labelTextColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.labelTextColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.labelTextColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.labelTextColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.emUiFill = this.emUiFill || "white";
        this.emUiStroke = this.emUiStroke || "#dbdada";
        this.emProcessorFill = this.emProcessorFill || "#edb3f6";
        this.emProcessorStroke = this.emProcessorStroke || "#b88cbf";
        this.emReadModelFill = this.emReadModelFill || "#d3f1a2";
        this.emReadModelStroke = this.emReadModelStroke || "#a3b732";
        this.emCommandFill = this.emCommandFill || "#bcd6fe";
        this.emCommandStroke = this.emCommandStroke || "#679ac3";
        this.emEventFill = this.emEventFill || "#ffb778";
        this.emEventStroke = this.emEventStroke || "#c19a0f";
        this.emSwimlaneBackgroundOdd = this.emSwimlaneBackgroundOdd || "rgb(250,250,250)";
        this.emSwimlaneBackgroundStroke = this.emSwimlaneBackgroundStroke || "rgb(240,240,240)";
        this.emArrowhead = this.emArrowhead || this.lineColor;
        this.emRelationStroke = this.emRelationStroke || this.lineColor;
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        Object.keys(this).forEach((k)=>{
            if (this[k] === "calculated") {
                this[k] = void 0;
            }
        });
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#f4f4f4";
        this.primaryColor = "#ECECFF";
        this.secondaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.secondaryColor = "#ffffde";
        this.tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -160
        });
        this.primaryBorderColor = mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = mkBorder(this.tertiaryColor, this.darkMode);
        this.primaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.secondaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.background = "white";
        this.mainBkg = "#ECECFF";
        this.secondBkg = "#ffffde";
        this.lineColor = "#333333";
        this.border1 = "#9370DB";
        this.primaryBorderColor = mkBorder(this.primaryColor, this.darkMode);
        this.border2 = "#aaaa33";
        this.arrowheadColor = "#333333";
        this.fontFamily = '"trebuchet ms", verdana, arial, sans-serif';
        this.fontSize = "16px";
        this.labelBackground = "rgba(232,232,232, 0.8)";
        this.textColor = "#333";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 5;
        this.strokeWidth = 1;
        this.nodeBkg = "calculated";
        this.nodeBorder = "calculated";
        this.clusterBkg = "calculated";
        this.clusterBorder = "calculated";
        this.defaultLinkColor = "calculated";
        this.titleColor = "calculated";
        this.edgeLabelBackground = "calculated";
        this.actorBorder = "calculated";
        this.actorBkg = "calculated";
        this.actorTextColor = "black";
        this.actorLineColor = "calculated";
        this.signalColor = "calculated";
        this.signalTextColor = "calculated";
        this.labelBoxBkgColor = "calculated";
        this.labelBoxBorderColor = "calculated";
        this.labelTextColor = "calculated";
        this.loopTextColor = "calculated";
        this.noteBorderColor = "calculated";
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "calculated";
        this.activationBorderColor = "#666";
        this.activationBkgColor = "#f4f4f4";
        this.sequenceNumberColor = "white";
        this.clusterBkg = "#FBFBFF";
        this.sectionBkgColor = "calculated";
        this.altSectionBkgColor = "calculated";
        this.sectionBkgColor2 = "calculated";
        this.excludeBkgColor = "#eeeeee";
        this.taskBorderColor = "calculated";
        this.taskBkgColor = "calculated";
        this.taskTextLightColor = "calculated";
        this.taskTextColor = this.taskTextLightColor;
        this.taskTextDarkColor = "calculated";
        this.taskTextOutsideColor = this.taskTextDarkColor;
        this.taskTextClickableColor = "calculated";
        this.activeTaskBorderColor = "calculated";
        this.activeTaskBkgColor = "calculated";
        this.gridColor = "calculated";
        this.doneTaskBkgColor = "calculated";
        this.doneTaskBorderColor = "calculated";
        this.critBorderColor = "calculated";
        this.critBkgColor = "calculated";
        this.todayLineColor = "calculated";
        this.vertLineColor = "calculated";
        this.sectionBkgColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__["rgba"])(102, 102, 255, 0.49);
        this.altSectionBkgColor = "white";
        this.sectionBkgColor2 = "#fff400";
        this.taskBorderColor = "#534fbc";
        this.taskBkgColor = "#8a90dd";
        this.taskTextLightColor = "white";
        this.taskTextColor = "calculated";
        this.taskTextDarkColor = "black";
        this.taskTextOutsideColor = "calculated";
        this.taskTextClickableColor = "#003163";
        this.activeTaskBorderColor = "#534fbc";
        this.activeTaskBkgColor = "#bfc7ff";
        this.gridColor = "lightgrey";
        this.doneTaskBkgColor = "lightgrey";
        this.doneTaskBorderColor = "grey";
        this.critBorderColor = "#ff8888";
        this.critBkgColor = "red";
        this.todayLineColor = "red";
        this.vertLineColor = "navy";
        this.noteFontWeight = this.noteFontWeight || "normal";
        this.fontWeight = this.fontWeight || "normal";
        this.personBorder = this.primaryBorderColor;
        this.personBkg = this.mainBkg;
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.rowOdd = "calculated";
        this.rowEven = "calculated";
        this.labelColor = "black";
        this.errorBkgColor = "#552222";
        this.errorTextColor = "#552222";
        this.useGradient = false;
        this.gradientStart = this.primaryBorderColor;
        this.gradientStop = this.secondaryBorderColor;
        this.dropShadow = "drop-shadow(1px 2px 2px rgba(185, 185, 185, 1))";
        this.updateColors();
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class2, "Theme"), _class2);
var getThemeVariables3 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme3();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme4 = (_class3 = class {
    updateColors() {
        var _this_cynefin, _this_cynefin1, _this_cynefin2, _this_cynefin3, _this_cynefin4, _this_cynefin5, _this_cynefin6, _this_cynefin7, _this_cynefin8, _this_cynefin9, _this_cynefin10, _this_cynefin11, _this_cynefin12, _this_cynefin13, _this_cynefin14, _this_radar, _this_radar1, _this_radar2, _this_radar3, _this_radar4, _this_radar5, _this_radar6, _this_radar7, _this_radar8, _this_radar9, _this_wardley, _this_wardley1, _this_wardley2, _this_wardley3, _this_wardley4, _this_wardley5, _this_wardley6, _this_wardley7, _this_wardley8, _this_wardley9, _this_wardley10, _this_wardley11, _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10, _this_xyChart11;
        this.actorBorder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.mainBkg, 20);
        this.actorBkg = this.mainBkg;
        this.labelBoxBkgColor = this.actorBkg;
        this.labelTextColor = this.actorTextColor;
        this.loopTextColor = this.actorTextColor;
        this.noteBorderColor = this.border2;
        this.noteTextColor = this.actorTextColor;
        this.actorLineColor = this.actorBorder;
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.cScale0 = this.cScale0 || this.primaryColor;
        this.cScale1 = this.cScale1 || this.secondaryColor;
        this.cScale2 = this.cScale2 || this.tertiaryColor;
        this.cScale3 = this.cScale3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 30
        });
        this.cScale4 = this.cScale4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.cScale5 = this.cScale5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 90
        });
        this.cScale6 = this.cScale6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.cScale7 = this.cScale7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 150
        });
        this.cScale8 = this.cScale8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 210
        });
        this.cScale9 = this.cScale9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 270
        });
        this.cScale10 = this.cScale10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 300
        });
        this.cScale11 = this.cScale11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 330
        });
        this["cScalePeer1"] = this["cScalePeer1"] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 45);
        this["cScalePeer2"] = this["cScalePeer2"] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.tertiaryColor, 40);
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 25);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this["cScale" + i], {
                h: 180
            });
        }
        this.scaleLabelColor = this.scaleLabelColor !== "calculated" && this.scaleLabelColor ? this.scaleLabelColor : this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 30,
                s: -30,
                l: -(5 + i * 5)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 30,
                s: -30,
                l: -(8 + i * 5)
            });
        }
        this.nodeBkg = this.mainBkg;
        this.nodeBorder = this.border1;
        this.clusterBkg = this.secondBkg;
        this.clusterBorder = this.border2;
        this.defaultLinkColor = this.lineColor;
        this.taskBorderColor = this.border1;
        this.taskTextColor = this.taskTextLightColor;
        this.taskTextOutsideColor = this.taskTextDarkColor;
        this.activeTaskBorderColor = this.taskBorderColor;
        this.activeTaskBkgColor = this.mainBkg;
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.rowOdd = this.rowOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 75) || "#ffffff";
        this.rowEven = this.rowEven || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 20);
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.primaryBorderColor;
        this.specialStateColor = this.lineColor;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.classText = this.primaryTextColor;
        this.fillType0 = this.primaryColor;
        this.fillType1 = this.secondaryColor;
        this.fillType2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || this.primaryColor;
        this.pie2 = this.pie2 || this.secondaryColor;
        this.pie3 = this.pie3 || this.tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -30
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -30
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            h: 40,
            l: -40
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -50
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -50
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -50
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_venn1;
        this.venn1 = (_this_venn1 = this.venn1) !== null && _this_venn1 !== void 0 ? _this_venn1 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -30
        });
        var _this_venn2;
        this.venn2 = (_this_venn2 = this.venn2) !== null && _this_venn2 !== void 0 ? _this_venn2 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -30
        });
        var _this_venn3;
        this.venn3 = (_this_venn3 = this.venn3) !== null && _this_venn3 !== void 0 ? _this_venn3 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -30
        });
        var _this_venn4;
        this.venn4 = (_this_venn4 = this.venn4) !== null && _this_venn4 !== void 0 ? _this_venn4 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -30
        });
        var _this_venn5;
        this.venn5 = (_this_venn5 = this.venn5) !== null && _this_venn5 !== void 0 ? _this_venn5 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -30
        });
        var _this_venn6;
        this.venn6 = (_this_venn6 = this.venn6) !== null && _this_venn6 !== void 0 ? _this_venn6 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 60,
            l: -30
        });
        var _this_venn7;
        this.venn7 = (_this_venn7 = this.venn7) !== null && _this_venn7 !== void 0 ? _this_venn7 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -30
        });
        var _this_venn8;
        this.venn8 = (_this_venn8 = this.venn8) !== null && _this_venn8 !== void 0 ? _this_venn8 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 120,
            l: -30
        });
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.cynefin = {
            domainFontSize: ((_this_cynefin = this.cynefin) === null || _this_cynefin === void 0 ? void 0 : _this_cynefin.domainFontSize) || 16,
            itemFontSize: ((_this_cynefin1 = this.cynefin) === null || _this_cynefin1 === void 0 ? void 0 : _this_cynefin1.itemFontSize) || 12,
            boundaryColor: ((_this_cynefin2 = this.cynefin) === null || _this_cynefin2 === void 0 ? void 0 : _this_cynefin2.boundaryColor) || this.lineColor,
            boundaryWidth: ((_this_cynefin3 = this.cynefin) === null || _this_cynefin3 === void 0 ? void 0 : _this_cynefin3.boundaryWidth) || 2,
            cliffColor: ((_this_cynefin4 = this.cynefin) === null || _this_cynefin4 === void 0 ? void 0 : _this_cynefin4.cliffColor) || "#8B4513",
            cliffWidth: ((_this_cynefin5 = this.cynefin) === null || _this_cynefin5 === void 0 ? void 0 : _this_cynefin5.cliffWidth) || 4,
            arrowColor: ((_this_cynefin6 = this.cynefin) === null || _this_cynefin6 === void 0 ? void 0 : _this_cynefin6.arrowColor) || this.lineColor,
            arrowWidth: ((_this_cynefin7 = this.cynefin) === null || _this_cynefin7 === void 0 ? void 0 : _this_cynefin7.arrowWidth) || 2,
            complexBg: ((_this_cynefin8 = this.cynefin) === null || _this_cynefin8 === void 0 ? void 0 : _this_cynefin8.complexBg) || "#C8E6C9",
            complicatedBg: ((_this_cynefin9 = this.cynefin) === null || _this_cynefin9 === void 0 ? void 0 : _this_cynefin9.complicatedBg) || "#DCEDC8",
            chaoticBg: ((_this_cynefin10 = this.cynefin) === null || _this_cynefin10 === void 0 ? void 0 : _this_cynefin10.chaoticBg) || "#FFE0B2",
            clearBg: ((_this_cynefin11 = this.cynefin) === null || _this_cynefin11 === void 0 ? void 0 : _this_cynefin11.clearBg) || "#FFF9C4",
            confusionBg: ((_this_cynefin12 = this.cynefin) === null || _this_cynefin12 === void 0 ? void 0 : _this_cynefin12.confusionBg) || "#D7CCC8",
            textColor: ((_this_cynefin13 = this.cynefin) === null || _this_cynefin13 === void 0 ? void 0 : _this_cynefin13.textColor) || this.textColor,
            labelColor: ((_this_cynefin14 = this.cynefin) === null || _this_cynefin14 === void 0 ? void 0 : _this_cynefin14.labelColor) || this.primaryTextColor
        };
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.packet = {
            startByteColor: this.primaryTextColor,
            endByteColor: this.primaryTextColor,
            labelColor: this.primaryTextColor,
            titleColor: this.primaryTextColor,
            blockStrokeColor: this.primaryTextColor,
            blockFillColor: this.mainBkg
        };
        this.radar = {
            axisColor: ((_this_radar = this.radar) === null || _this_radar === void 0 ? void 0 : _this_radar.axisColor) || this.lineColor,
            axisStrokeWidth: ((_this_radar1 = this.radar) === null || _this_radar1 === void 0 ? void 0 : _this_radar1.axisStrokeWidth) || 2,
            axisLabelFontSize: ((_this_radar2 = this.radar) === null || _this_radar2 === void 0 ? void 0 : _this_radar2.axisLabelFontSize) || 12,
            curveOpacity: ((_this_radar3 = this.radar) === null || _this_radar3 === void 0 ? void 0 : _this_radar3.curveOpacity) || 0.5,
            curveStrokeWidth: ((_this_radar4 = this.radar) === null || _this_radar4 === void 0 ? void 0 : _this_radar4.curveStrokeWidth) || 2,
            graticuleColor: ((_this_radar5 = this.radar) === null || _this_radar5 === void 0 ? void 0 : _this_radar5.graticuleColor) || "#DEDEDE",
            graticuleStrokeWidth: ((_this_radar6 = this.radar) === null || _this_radar6 === void 0 ? void 0 : _this_radar6.graticuleStrokeWidth) || 1,
            graticuleOpacity: ((_this_radar7 = this.radar) === null || _this_radar7 === void 0 ? void 0 : _this_radar7.graticuleOpacity) || 0.3,
            legendBoxSize: ((_this_radar8 = this.radar) === null || _this_radar8 === void 0 ? void 0 : _this_radar8.legendBoxSize) || 12,
            legendFontSize: ((_this_radar9 = this.radar) === null || _this_radar9 === void 0 ? void 0 : _this_radar9.legendFontSize) || 12
        };
        this.wardleyEvolutionColor = this.wardleyEvolutionColor || "#dc3545";
        this.wardley = {
            backgroundColor: ((_this_wardley = this.wardley) === null || _this_wardley === void 0 ? void 0 : _this_wardley.backgroundColor) || this.background,
            axisColor: ((_this_wardley1 = this.wardley) === null || _this_wardley1 === void 0 ? void 0 : _this_wardley1.axisColor) || this.lineColor,
            axisTextColor: ((_this_wardley2 = this.wardley) === null || _this_wardley2 === void 0 ? void 0 : _this_wardley2.axisTextColor) || this.primaryTextColor,
            gridColor: ((_this_wardley3 = this.wardley) === null || _this_wardley3 === void 0 ? void 0 : _this_wardley3.gridColor) || this.gridColor,
            componentFill: ((_this_wardley4 = this.wardley) === null || _this_wardley4 === void 0 ? void 0 : _this_wardley4.componentFill) || this.background,
            componentStroke: ((_this_wardley5 = this.wardley) === null || _this_wardley5 === void 0 ? void 0 : _this_wardley5.componentStroke) || this.lineColor,
            componentLabelColor: ((_this_wardley6 = this.wardley) === null || _this_wardley6 === void 0 ? void 0 : _this_wardley6.componentLabelColor) || this.primaryTextColor,
            linkStroke: ((_this_wardley7 = this.wardley) === null || _this_wardley7 === void 0 ? void 0 : _this_wardley7.linkStroke) || this.lineColor,
            evolutionStroke: ((_this_wardley8 = this.wardley) === null || _this_wardley8 === void 0 ? void 0 : _this_wardley8.evolutionStroke) || this.wardleyEvolutionColor,
            annotationStroke: ((_this_wardley9 = this.wardley) === null || _this_wardley9 === void 0 ? void 0 : _this_wardley9.annotationStroke) || this.lineColor,
            annotationTextColor: ((_this_wardley10 = this.wardley) === null || _this_wardley10 === void 0 ? void 0 : _this_wardley10.annotationTextColor) || this.primaryTextColor,
            annotationFill: ((_this_wardley11 = this.wardley) === null || _this_wardley11 === void 0 ? void 0 : _this_wardley11.annotationFill) || this.background
        };
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            dataLabelColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.dataLabelColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart11 = this.xyChart) === null || _this_xyChart11 === void 0 ? void 0 : _this_xyChart11.plotColorPalette) || "#CDE498,#FF6B6B,#A0D2DB,#D7BDE2,#F0F0F0,#FFC3A0,#7FD8BE,#FF9A8B,#FAF3E0,#FFF176"
        };
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || this.edgeLabelBackground;
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = this.git0 || this.primaryColor;
        this.git1 = this.git1 || this.secondaryColor;
        this.git2 = this.git2 || this.tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.gitBranchLabel0 = this.gitBranchLabel0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.labelTextColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.labelTextColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.labelTextColor);
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.labelTextColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.labelTextColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.labelTextColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.labelTextColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.emUiFill = this.emUiFill || "white";
        this.emUiStroke = this.emUiStroke || "#dbdada";
        this.emProcessorFill = this.emProcessorFill || "#edb3f6";
        this.emProcessorStroke = this.emProcessorStroke || "#b88cbf";
        this.emReadModelFill = this.emReadModelFill || "#d3f1a2";
        this.emReadModelStroke = this.emReadModelStroke || "#a3b732";
        this.emCommandFill = this.emCommandFill || "#bcd6fe";
        this.emCommandStroke = this.emCommandStroke || "#679ac3";
        this.emEventFill = this.emEventFill || "#ffb778";
        this.emEventStroke = this.emEventStroke || "#c19a0f";
        this.emSwimlaneBackgroundOdd = this.emSwimlaneBackgroundOdd || "rgb(250,250,250)";
        this.emSwimlaneBackgroundStroke = this.emSwimlaneBackgroundStroke || "rgb(240,240,240)";
        this.emArrowhead = this.emArrowhead || this.lineColor;
        this.emRelationStroke = this.emRelationStroke || this.lineColor;
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#f4f4f4";
        this.primaryColor = "#cde498";
        this.secondaryColor = "#cdffb2";
        this.background = "white";
        this.mainBkg = "#cde498";
        this.secondBkg = "#cdffb2";
        this.lineColor = "green";
        this.border1 = "#13540c";
        this.border2 = "#6eaa49";
        this.arrowheadColor = "green";
        this.fontFamily = '"trebuchet ms", verdana, arial, sans-serif';
        this.fontSize = "16px";
        this.tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])("#cde498", 10);
        this.primaryBorderColor = mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = mkBorder(this.tertiaryColor, this.darkMode);
        this.primaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.secondaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.lineColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 5;
        this.strokeWidth = 1;
        this.nodeBkg = "calculated";
        this.nodeBorder = "calculated";
        this.clusterBkg = "calculated";
        this.clusterBorder = "calculated";
        this.defaultLinkColor = "calculated";
        this.titleColor = "#333";
        this.edgeLabelBackground = "#e8e8e8";
        this.actorBorder = "calculated";
        this.actorBkg = "calculated";
        this.actorTextColor = "black";
        this.actorLineColor = "calculated";
        this.signalColor = "#333";
        this.signalTextColor = "#333";
        this.labelBoxBkgColor = "calculated";
        this.labelBoxBorderColor = "#326932";
        this.labelTextColor = "calculated";
        this.loopTextColor = "calculated";
        this.noteBorderColor = "calculated";
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "calculated";
        this.activationBorderColor = "#666";
        this.activationBkgColor = "#f4f4f4";
        this.sequenceNumberColor = "white";
        this.sectionBkgColor = "#6eaa49";
        this.altSectionBkgColor = "white";
        this.sectionBkgColor2 = "#6eaa49";
        this.excludeBkgColor = "#eeeeee";
        this.taskBorderColor = "calculated";
        this.taskBkgColor = "#487e3a";
        this.taskTextLightColor = "white";
        this.taskTextColor = "calculated";
        this.taskTextDarkColor = "black";
        this.taskTextOutsideColor = "calculated";
        this.taskTextClickableColor = "#003163";
        this.activeTaskBorderColor = "calculated";
        this.activeTaskBkgColor = "calculated";
        this.gridColor = "lightgrey";
        this.doneTaskBkgColor = "lightgrey";
        this.doneTaskBorderColor = "grey";
        this.critBorderColor = "#ff8888";
        this.critBkgColor = "red";
        this.todayLineColor = "red";
        this.vertLineColor = "#00BFFF";
        this.personBorder = this.primaryBorderColor;
        this.personBkg = this.mainBkg;
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.noteFontWeight = "normal";
        this.fontWeight = "normal";
        this.labelColor = "black";
        this.errorBkgColor = "#552222";
        this.errorTextColor = "#552222";
        this.useGradient = true;
        this.gradientStart = this.primaryBorderColor;
        this.gradientStop = this.secondaryBorderColor;
        this.dropShadow = "drop-shadow( 1px 2px 2px rgba(185,185,185,0.5))";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class3, "Theme"), _class3);
var getThemeVariables4 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme4();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme5 = (_class4 = class {
    updateColors() {
        var _this_cynefin, _this_cynefin1, _this_cynefin2, _this_cynefin3, _this_cynefin4, _this_cynefin5, _this_cynefin6, _this_cynefin7, _this_cynefin8, _this_cynefin9, _this_cynefin10, _this_cynefin11, _this_cynefin12, _this_cynefin13, _this_cynefin14, _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10, _this_xyChart11, _this_radar, _this_radar1, _this_radar2, _this_radar3, _this_radar4, _this_radar5, _this_radar6, _this_radar7, _this_radar8, _this_radar9, _this_wardley, _this_wardley1, _this_wardley2, _this_wardley3, _this_wardley4, _this_wardley5, _this_wardley6, _this_wardley7, _this_wardley8, _this_wardley9, _this_wardley10, _this_wardley11;
        this.secondBkg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.contrast, 55);
        this.border2 = this.contrast;
        this.actorBorder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.border1, 23);
        this.actorBkg = this.mainBkg;
        this.actorTextColor = this.text;
        this.actorLineColor = this.actorBorder;
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.signalColor = this.text;
        this.signalTextColor = this.text;
        this.labelBoxBkgColor = this.actorBkg;
        this.labelBoxBorderColor = this.actorBorder;
        this.labelTextColor = this.text;
        this.loopTextColor = this.text;
        this.noteBorderColor = "#999";
        this.noteBkgColor = "#666";
        this.noteTextColor = "#fff";
        this.cScale0 = this.cScale0 || "#555";
        this.cScale1 = this.cScale1 || "#F4F4F4";
        this.cScale2 = this.cScale2 || "#555";
        this.cScale3 = this.cScale3 || "#BBB";
        this.cScale4 = this.cScale4 || "#777";
        this.cScale5 = this.cScale5 || "#999";
        this.cScale6 = this.cScale6 || "#DDD";
        this.cScale7 = this.cScale7 || "#FFF";
        this.cScale8 = this.cScale8 || "#DDD";
        this.cScale9 = this.cScale9 || "#BBB";
        this.cScale10 = this.cScale10 || "#999";
        this.cScale11 = this.cScale11 || "#777";
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.cScaleLabel0 = this.cScaleLabel0 || this.cScale1;
        this.cScaleLabel2 = this.cScaleLabel2 || this.cScale1;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                l: -(5 + i * 5)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                l: -(8 + i * 5)
            });
        }
        this.nodeBkg = this.mainBkg;
        this.nodeBorder = this.border1;
        this.clusterBkg = this.secondBkg;
        this.clusterBorder = this.border2;
        this.defaultLinkColor = this.lineColor;
        this.titleColor = this.text;
        this.sectionBkgColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.contrast, 30);
        this.sectionBkgColor2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.contrast, 30);
        this.taskBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.contrast, 10);
        this.taskBkgColor = this.contrast;
        this.taskTextColor = this.taskTextLightColor;
        this.taskTextDarkColor = this.text;
        this.taskTextOutsideColor = this.taskTextDarkColor;
        this.activeTaskBorderColor = this.taskBorderColor;
        this.activeTaskBkgColor = this.mainBkg;
        this.gridColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.border1, 30);
        this.doneTaskBkgColor = this.done;
        this.doneTaskBorderColor = this.lineColor;
        this.critBkgColor = this.critical;
        this.critBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.critBkgColor, 10);
        this.todayLineColor = this.critBkgColor;
        this.vertLineColor = this.critBkgColor;
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.transitionColor = this.transitionColor || "#000";
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f4f4f4";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.stateBorder = this.stateBorder || "#000";
        this.innerEndBackground = this.primaryBorderColor;
        this.specialStateColor = "#222";
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.classText = this.primaryTextColor;
        this.fillType0 = this.primaryColor;
        this.fillType1 = this.secondaryColor;
        this.fillType2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["pie" + i] = this["cScale" + i];
        }
        this.pie12 = this.pie0;
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        for(let i = 0; i < 8; i++){
            var _this_;
            this["venn" + (i + 1)] = (_this_ = this["venn" + (i + 1)]) !== null && _this_ !== void 0 ? _this_ : this["cScale" + i];
        }
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.cynefin = {
            domainFontSize: ((_this_cynefin = this.cynefin) === null || _this_cynefin === void 0 ? void 0 : _this_cynefin.domainFontSize) || 16,
            itemFontSize: ((_this_cynefin1 = this.cynefin) === null || _this_cynefin1 === void 0 ? void 0 : _this_cynefin1.itemFontSize) || 12,
            boundaryColor: ((_this_cynefin2 = this.cynefin) === null || _this_cynefin2 === void 0 ? void 0 : _this_cynefin2.boundaryColor) || this.lineColor,
            boundaryWidth: ((_this_cynefin3 = this.cynefin) === null || _this_cynefin3 === void 0 ? void 0 : _this_cynefin3.boundaryWidth) || 2,
            cliffColor: ((_this_cynefin4 = this.cynefin) === null || _this_cynefin4 === void 0 ? void 0 : _this_cynefin4.cliffColor) || "#8B0000",
            cliffWidth: ((_this_cynefin5 = this.cynefin) === null || _this_cynefin5 === void 0 ? void 0 : _this_cynefin5.cliffWidth) || 4,
            arrowColor: ((_this_cynefin6 = this.cynefin) === null || _this_cynefin6 === void 0 ? void 0 : _this_cynefin6.arrowColor) || this.lineColor,
            arrowWidth: ((_this_cynefin7 = this.cynefin) === null || _this_cynefin7 === void 0 ? void 0 : _this_cynefin7.arrowWidth) || 2,
            complexBg: ((_this_cynefin8 = this.cynefin) === null || _this_cynefin8 === void 0 ? void 0 : _this_cynefin8.complexBg) || "#E8F5E9",
            complicatedBg: ((_this_cynefin9 = this.cynefin) === null || _this_cynefin9 === void 0 ? void 0 : _this_cynefin9.complicatedBg) || "#E3F2FD",
            chaoticBg: ((_this_cynefin10 = this.cynefin) === null || _this_cynefin10 === void 0 ? void 0 : _this_cynefin10.chaoticBg) || "#FBE9E7",
            clearBg: ((_this_cynefin11 = this.cynefin) === null || _this_cynefin11 === void 0 ? void 0 : _this_cynefin11.clearBg) || "#FFF8E1",
            confusionBg: ((_this_cynefin12 = this.cynefin) === null || _this_cynefin12 === void 0 ? void 0 : _this_cynefin12.confusionBg) || "#F3E5F5",
            textColor: ((_this_cynefin13 = this.cynefin) === null || _this_cynefin13 === void 0 ? void 0 : _this_cynefin13.textColor) || this.textColor,
            labelColor: ((_this_cynefin14 = this.cynefin) === null || _this_cynefin14 === void 0 ? void 0 : _this_cynefin14.labelColor) || this.primaryTextColor
        };
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            dataLabelColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.dataLabelColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart11 = this.xyChart) === null || _this_xyChart11 === void 0 ? void 0 : _this_xyChart11.plotColorPalette) || "#EEE,#6BB8E4,#8ACB88,#C7ACD6,#E8DCC2,#FFB2A8,#FFF380,#7E8D91,#FFD8B1,#FAF3E0"
        };
        this.radar = {
            axisColor: ((_this_radar = this.radar) === null || _this_radar === void 0 ? void 0 : _this_radar.axisColor) || this.lineColor,
            axisStrokeWidth: ((_this_radar1 = this.radar) === null || _this_radar1 === void 0 ? void 0 : _this_radar1.axisStrokeWidth) || 2,
            axisLabelFontSize: ((_this_radar2 = this.radar) === null || _this_radar2 === void 0 ? void 0 : _this_radar2.axisLabelFontSize) || 12,
            curveOpacity: ((_this_radar3 = this.radar) === null || _this_radar3 === void 0 ? void 0 : _this_radar3.curveOpacity) || 0.5,
            curveStrokeWidth: ((_this_radar4 = this.radar) === null || _this_radar4 === void 0 ? void 0 : _this_radar4.curveStrokeWidth) || 2,
            graticuleColor: ((_this_radar5 = this.radar) === null || _this_radar5 === void 0 ? void 0 : _this_radar5.graticuleColor) || "#DEDEDE",
            graticuleStrokeWidth: ((_this_radar6 = this.radar) === null || _this_radar6 === void 0 ? void 0 : _this_radar6.graticuleStrokeWidth) || 1,
            graticuleOpacity: ((_this_radar7 = this.radar) === null || _this_radar7 === void 0 ? void 0 : _this_radar7.graticuleOpacity) || 0.3,
            legendBoxSize: ((_this_radar8 = this.radar) === null || _this_radar8 === void 0 ? void 0 : _this_radar8.legendBoxSize) || 12,
            legendFontSize: ((_this_radar9 = this.radar) === null || _this_radar9 === void 0 ? void 0 : _this_radar9.legendFontSize) || 12
        };
        this.wardleyEvolutionColor = this.wardleyEvolutionColor || "#dc3545";
        this.wardley = {
            backgroundColor: ((_this_wardley = this.wardley) === null || _this_wardley === void 0 ? void 0 : _this_wardley.backgroundColor) || this.background,
            axisColor: ((_this_wardley1 = this.wardley) === null || _this_wardley1 === void 0 ? void 0 : _this_wardley1.axisColor) || this.lineColor,
            axisTextColor: ((_this_wardley2 = this.wardley) === null || _this_wardley2 === void 0 ? void 0 : _this_wardley2.axisTextColor) || this.primaryTextColor,
            gridColor: ((_this_wardley3 = this.wardley) === null || _this_wardley3 === void 0 ? void 0 : _this_wardley3.gridColor) || this.gridColor,
            componentFill: ((_this_wardley4 = this.wardley) === null || _this_wardley4 === void 0 ? void 0 : _this_wardley4.componentFill) || this.background,
            componentStroke: ((_this_wardley5 = this.wardley) === null || _this_wardley5 === void 0 ? void 0 : _this_wardley5.componentStroke) || this.lineColor,
            componentLabelColor: ((_this_wardley6 = this.wardley) === null || _this_wardley6 === void 0 ? void 0 : _this_wardley6.componentLabelColor) || this.primaryTextColor,
            linkStroke: ((_this_wardley7 = this.wardley) === null || _this_wardley7 === void 0 ? void 0 : _this_wardley7.linkStroke) || this.lineColor,
            evolutionStroke: ((_this_wardley8 = this.wardley) === null || _this_wardley8 === void 0 ? void 0 : _this_wardley8.evolutionStroke) || this.wardleyEvolutionColor,
            annotationStroke: ((_this_wardley9 = this.wardley) === null || _this_wardley9 === void 0 ? void 0 : _this_wardley9.annotationStroke) || this.lineColor,
            annotationTextColor: ((_this_wardley10 = this.wardley) === null || _this_wardley10 === void 0 ? void 0 : _this_wardley10.annotationTextColor) || this.primaryTextColor,
            annotationFill: ((_this_wardley11 = this.wardley) === null || _this_wardley11 === void 0 ? void 0 : _this_wardley11.annotationFill) || this.background
        };
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || this.edgeLabelBackground;
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.pie1, 25) || this.primaryColor;
        this.git1 = this.pie2 || this.secondaryColor;
        this.git2 = this.pie3 || this.tertiaryColor;
        this.git3 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -30
        });
        this.git4 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60
        });
        this.git5 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90
        });
        this.git6 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.git7 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || this.labelTextColor;
        this.gitBranchLabel0 = this.branchLabelColor;
        this.gitBranchLabel1 = "white";
        this.gitBranchLabel2 = this.branchLabelColor;
        this.gitBranchLabel3 = "white";
        this.gitBranchLabel4 = this.branchLabelColor;
        this.gitBranchLabel5 = this.branchLabelColor;
        this.gitBranchLabel6 = this.branchLabelColor;
        this.gitBranchLabel7 = this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.emUiFill = this.emUiFill || "white";
        this.emUiStroke = this.emUiStroke || "#dbdada";
        this.emProcessorFill = this.emProcessorFill || "#edb3f6";
        this.emProcessorStroke = this.emProcessorStroke || "#b88cbf";
        this.emReadModelFill = this.emReadModelFill || "#d3f1a2";
        this.emReadModelStroke = this.emReadModelStroke || "#a3b732";
        this.emCommandFill = this.emCommandFill || "#bcd6fe";
        this.emCommandStroke = this.emCommandStroke || "#679ac3";
        this.emEventFill = this.emEventFill || "#ffb778";
        this.emEventStroke = this.emEventStroke || "#c19a0f";
        this.emSwimlaneBackgroundOdd = this.emSwimlaneBackgroundOdd || "rgb(250,250,250)";
        this.emSwimlaneBackgroundStroke = this.emSwimlaneBackgroundStroke || "rgb(240,240,240)";
        this.emArrowhead = this.emArrowhead || this.lineColor;
        this.emRelationStroke = this.emRelationStroke || this.lineColor;
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.primaryColor = "#eee";
        this.contrast = "#707070";
        this.secondaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.contrast, 55);
        this.background = "#ffffff";
        this.tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -160
        });
        this.primaryBorderColor = mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = mkBorder(this.tertiaryColor, this.darkMode);
        this.primaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.secondaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.mainBkg = "#eee";
        this.secondBkg = "calculated";
        this.lineColor = "#666";
        this.border1 = "#999";
        this.border2 = "calculated";
        this.note = "#ffa";
        this.text = "#333";
        this.critical = "#d42";
        this.done = "#bbb";
        this.arrowheadColor = "#333333";
        this.fontFamily = '"trebuchet ms", verdana, arial, sans-serif';
        this.fontSize = "16px";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 5;
        this.strokeWidth = 1;
        this.nodeBkg = "calculated";
        this.nodeBorder = "calculated";
        this.clusterBkg = "calculated";
        this.clusterBorder = "calculated";
        this.defaultLinkColor = "calculated";
        this.titleColor = "calculated";
        this.edgeLabelBackground = "white";
        this.actorBorder = "calculated";
        this.actorBkg = "calculated";
        this.actorTextColor = "calculated";
        this.actorLineColor = this.actorBorder;
        this.signalColor = "calculated";
        this.signalTextColor = "calculated";
        this.labelBoxBkgColor = "calculated";
        this.labelBoxBorderColor = "calculated";
        this.labelTextColor = "calculated";
        this.loopTextColor = "calculated";
        this.noteBorderColor = "calculated";
        this.noteBkgColor = "calculated";
        this.noteTextColor = "calculated";
        this.activationBorderColor = "#666";
        this.activationBkgColor = "#f4f4f4";
        this.sequenceNumberColor = "white";
        this.sectionBkgColor = "calculated";
        this.altSectionBkgColor = "white";
        this.sectionBkgColor2 = "calculated";
        this.excludeBkgColor = "#eeeeee";
        this.taskBorderColor = "calculated";
        this.taskBkgColor = "calculated";
        this.taskTextLightColor = "white";
        this.taskTextColor = "calculated";
        this.taskTextDarkColor = "calculated";
        this.taskTextOutsideColor = "calculated";
        this.taskTextClickableColor = "#003163";
        this.activeTaskBorderColor = "calculated";
        this.activeTaskBkgColor = "calculated";
        this.gridColor = "calculated";
        this.doneTaskBkgColor = "calculated";
        this.doneTaskBorderColor = "calculated";
        this.critBkgColor = "calculated";
        this.critBorderColor = "calculated";
        this.todayLineColor = "calculated";
        this.vertLineColor = "calculated";
        this.personBorder = this.primaryBorderColor;
        this.personBkg = this.mainBkg;
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.noteFontWeight = "normal";
        this.fontWeight = "normal";
        this.rowOdd = this.rowOdd || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.mainBkg, 75) || "#ffffff";
        this.rowEven = this.rowEven || "#f4f4f4";
        this.labelColor = "black";
        this.errorBkgColor = "#552222";
        this.errorTextColor = "#552222";
        this.useGradient = true;
        this.gradientStart = this.primaryBorderColor;
        this.gradientStop = this.secondaryBorderColor;
        this.dropShadow = "drop-shadow( 1px 2px 2px rgba(185,185,185,1))";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class4, "Theme"), _class4);
var getThemeVariables5 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme5();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme6 = (_class5 = class {
    updateColors() {
        var _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10;
        this.primaryTextColor = this.primaryTextColor || (this.darkMode ? "#eee" : "#333");
        this.secondaryColor = this.secondaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -120
        });
        this.tertiaryColor = this.tertiaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 180,
            l: 5
        });
        this.primaryBorderColor = this.primaryBorderColor || mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = this.secondaryBorderColor || mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = this.tertiaryBorderColor || mkBorder(this.tertiaryColor, this.darkMode);
        this.noteBorderColor = this.noteBorderColor || mkBorder(this.noteBkgColor, this.darkMode);
        this.noteBkgColor = this.noteBkgColor || "#fff5ad";
        this.noteTextColor = this.noteTextColor || "#333";
        this.secondaryTextColor = this.secondaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = this.tertiaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = this.lineColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.arrowheadColor = this.arrowheadColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = this.textColor || this.primaryTextColor;
        this.border2 = this.border2 || this.tertiaryBorderColor;
        this.nodeBkg = this.nodeBkg || this.primaryColor;
        this.mainBkg = this.mainBkg || this.primaryColor;
        this.nodeBorder = this.nodeBorder || this.primaryBorderColor;
        this.clusterBkg = this.clusterBkg || this.tertiaryColor;
        this.clusterBorder = this.clusterBorder || this.tertiaryBorderColor;
        this.defaultLinkColor = this.defaultLinkColor || this.lineColor;
        this.titleColor = this.titleColor || this.tertiaryTextColor;
        this.edgeLabelBackground = this.edgeLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.nodeTextColor = this.nodeTextColor || this.primaryTextColor;
        this.actorBorder = this.actorBorder || this.primaryBorderColor;
        this.actorBkg = this.actorBkg || this.mainBkg;
        this.actorTextColor = this.actorTextColor || this.primaryTextColor;
        this.actorLineColor = this.actorLineColor || this.actorBorder;
        this.labelBoxBkgColor = this.labelBoxBkgColor || this.actorBkg;
        this.signalColor = this.signalColor || this.textColor;
        this.signalTextColor = this.signalTextColor || this.textColor;
        this.labelBoxBorderColor = this.labelBoxBorderColor || this.actorBorder;
        this.labelTextColor = this.labelTextColor || this.actorTextColor;
        this.loopTextColor = this.loopTextColor || this.actorTextColor;
        this.activationBorderColor = this.activationBorderColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 10);
        this.activationBkgColor = this.activationBkgColor || this.secondaryColor;
        this.sequenceNumberColor = this.sequenceNumberColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.lineColor);
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        const primaryColor = "#ECECFE";
        const secondaryColor = "#E9E9F1";
        const tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 180,
            l: 5
        });
        this.sectionBkgColor = this.sectionBkgColor || tertiaryColor;
        this.altSectionBkgColor = this.altSectionBkgColor || "white";
        this.sectionBkgColor = this.sectionBkgColor || secondaryColor;
        this.sectionBkgColor2 = this.sectionBkgColor2 || primaryColor;
        this.excludeBkgColor = this.excludeBkgColor || "#eeeeee";
        this.taskBorderColor = this.taskBorderColor || this.primaryBorderColor;
        this.taskBkgColor = this.taskBkgColor || primaryColor;
        this.activeTaskBorderColor = this.activeTaskBorderColor || primaryColor;
        this.activeTaskBkgColor = this.activeTaskBkgColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(primaryColor, 23);
        this.gridColor = this.gridColor || "lightgrey";
        this.doneTaskBkgColor = this.doneTaskBkgColor || "lightgrey";
        this.doneTaskBorderColor = this.doneTaskBorderColor || "grey";
        this.critBorderColor = this.critBorderColor || "#ff8888";
        this.critBkgColor = this.critBkgColor || "red";
        this.todayLineColor = this.todayLineColor || "red";
        this.taskTextColor = this.taskTextColor || this.textColor;
        this.taskTextOutsideColor = this.taskTextOutsideColor || this.textColor;
        this.vertLineColor = this.vertLineColor || this.primaryBorderColor;
        this.taskTextLightColor = this.taskTextLightColor || this.textColor;
        this.taskTextColor = this.taskTextColor || this.primaryTextColor;
        this.taskTextDarkColor = this.taskTextDarkColor || this.textColor;
        this.taskTextClickableColor = this.taskTextClickableColor || "#003163";
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.personBorder = this.personBorder || this.primaryBorderColor;
        this.personBkg = this.personBkg || this.mainBkg;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.specialStateColor = this.lineColor;
        this.cScale0 = this.cScale0 || primaryColor;
        this.cScale1 = this.cScale1 || secondaryColor;
        this.cScale2 = this.cScale2 || tertiaryColor;
        this.cScale3 = this.cScale3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 30
        });
        this.cScale4 = this.cScale4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60
        });
        this.cScale5 = this.cScale5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 90
        });
        this.cScale6 = this.cScale6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120
        });
        this.cScale7 = this.cScale7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 150
        });
        this.cScale8 = this.cScale8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 210,
            l: 150
        });
        this.cScale9 = this.cScale9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 270
        });
        this.cScale10 = this.cScale10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 300
        });
        this.cScale11 = this.cScale11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 330
        });
        if (this.darkMode) {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 75);
            }
        } else {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 25);
            }
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        const multiplier = this.darkMode ? -4 : -1;
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (5 + i * 3)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (8 + i * 3)
            });
        }
        this.classText = this.classText || this.textColor;
        this.fillType0 = this.fillType0 || primaryColor;
        this.fillType1 = this.fillType1 || secondaryColor;
        this.fillType2 = this.fillType2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 64
        });
        this.fillType3 = this.fillType3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: 64
        });
        this.fillType4 = this.fillType4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -64
        });
        this.fillType5 = this.fillType5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: -64
        });
        this.fillType6 = this.fillType6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 128
        });
        this.fillType7 = this.fillType7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || primaryColor;
        this.pie2 = this.pie2 || secondaryColor;
        this.pie3 = this.pie3 || tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            l: -10
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(tertiaryColor, {
            l: -10
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60,
            l: -20
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60,
            l: -20
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120,
            l: -10
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.quadrant1Fill = this.quadrant1Fill || primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.plotColorPalette) || "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0"
        };
        this.requirementBackground = this.requirementBackground || primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = this.git0 || primaryColor;
        this.git1 = this.git1 || secondaryColor;
        this.git2 = this.git2 || tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.gitBranchLabel0 = this.gitBranchLabel0 || this.branchLabelColor;
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.branchLabelColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.branchLabelColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || this.branchLabelColor;
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.branchLabelColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.branchLabelColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.branchLabelColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#ffffff";
        this.primaryColor = "#cccccc";
        this.mainBkg = "#ffffff";
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "#333";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 3;
        this.strokeWidth = 2;
        this.primaryBorderColor = mkBorder(this.primaryColor, this.darkMode);
        this.fontFamily = "arial, sans-serif";
        this.fontSize = "14px";
        this.nodeBorder = "#000000";
        this.stateBorder = "#000000";
        this.useGradient = true;
        this.gradientStart = "#0042eb";
        this.gradientStop = "#eb0042";
        this.dropShadow = "drop-shadow( 0px 1px 2px rgba(0, 0, 0, 0.25));";
        this.tertiaryColor = "#ffffff";
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.noteFontWeight = "normal";
        this.fontWeight = "normal";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class5, "Theme"), _class5);
var getThemeVariables6 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme6();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme7 = (_class6 = class {
    updateColors() {
        var _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10;
        this.primaryTextColor = this.primaryTextColor || (this.darkMode ? "#eee" : "#333");
        this.secondaryColor = this.secondaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -120
        });
        this.tertiaryColor = this.tertiaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 180,
            l: 5
        });
        this.primaryBorderColor = this.primaryBorderColor || mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = this.secondaryBorderColor || mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = this.tertiaryBorderColor || mkBorder(this.tertiaryColor, this.darkMode);
        this.noteBorderColor = this.noteBorderColor || mkBorder(this.noteBkgColor, this.darkMode);
        this.noteBkgColor = this.noteBkgColor || "#fff5ad";
        this.noteTextColor = this.noteTextColor || "#333";
        this.secondaryTextColor = this.secondaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = this.tertiaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = this.lineColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.arrowheadColor = this.arrowheadColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = this.textColor || this.primaryTextColor;
        this.border2 = this.border2 || this.tertiaryBorderColor;
        this.nodeBkg = this.nodeBkg || this.primaryColor;
        this.mainBkg = this.mainBkg || this.primaryColor;
        this.nodeBorder = this.nodeBorder || this.border1;
        this.clusterBkg = this.clusterBkg || this.tertiaryColor;
        this.clusterBorder = this.clusterBorder || this.tertiaryBorderColor;
        this.defaultLinkColor = this.defaultLinkColor || this.lineColor;
        this.titleColor = this.titleColor || this.tertiaryTextColor;
        this.edgeLabelBackground = this.edgeLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.nodeTextColor = this.nodeTextColor || this.primaryTextColor;
        this.actorBorder = this.actorBorder || this.primaryBorderColor;
        this.actorBkg = this.actorBkg || this.mainBkg;
        this.actorTextColor = this.actorTextColor || this.primaryTextColor;
        this.actorLineColor = this.actorLineColor || this.actorBorder;
        this.labelBoxBkgColor = this.labelBoxBkgColor || this.actorBkg;
        this.signalColor = this.signalColor || this.textColor;
        this.signalTextColor = this.signalTextColor || this.textColor;
        this.labelBoxBorderColor = this.labelBoxBorderColor || this.actorBorder;
        this.labelTextColor = this.labelTextColor || this.actorTextColor;
        this.loopTextColor = this.loopTextColor || this.actorTextColor;
        this.activationBorderColor = this.activationBorderColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 10);
        this.activationBkgColor = this.activationBkgColor || this.secondaryColor;
        this.sequenceNumberColor = this.sequenceNumberColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.lineColor);
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.sectionBkgColor = this.sectionBkgColor || this.tertiaryColor;
        this.altSectionBkgColor = this.altSectionBkgColor || "white";
        this.sectionBkgColor = this.sectionBkgColor || this.secondaryColor;
        this.sectionBkgColor2 = this.sectionBkgColor2 || this.primaryColor;
        this.excludeBkgColor = this.excludeBkgColor || "#eeeeee";
        this.taskBorderColor = this.taskBorderColor || this.primaryBorderColor;
        this.taskBkgColor = this.taskBkgColor || this.primaryColor;
        this.activeTaskBorderColor = this.activeTaskBorderColor || this.primaryColor;
        this.activeTaskBkgColor = this.activeTaskBkgColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 23);
        this.gridColor = this.gridColor || "lightgrey";
        this.doneTaskBkgColor = this.doneTaskBkgColor || "lightgrey";
        this.doneTaskBorderColor = this.doneTaskBorderColor || "grey";
        this.critBorderColor = this.critBorderColor || "#ff8888";
        this.critBkgColor = this.critBkgColor || "red";
        this.todayLineColor = this.todayLineColor || "red";
        this.vertLineColor = this.vertLineColor || this.primaryBorderColor;
        this.taskTextColor = this.taskTextColor || this.textColor;
        this.taskTextOutsideColor = this.taskTextOutsideColor || this.textColor;
        this.taskTextLightColor = this.taskTextLightColor || this.textColor;
        this.taskTextColor = this.taskTextColor || this.primaryTextColor;
        this.taskTextDarkColor = this.taskTextDarkColor || this.textColor;
        this.taskTextClickableColor = this.taskTextClickableColor || "#003163";
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.personBorder = this.personBorder || this.primaryBorderColor;
        this.personBkg = this.personBkg || this.mainBkg;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.specialStateColor = this.lineColor;
        this.cScale0 = this.cScale0 || this.primaryColor;
        this.cScale1 = this.cScale1 || this.secondaryColor;
        this.cScale2 = this.cScale2 || this.tertiaryColor;
        this.cScale3 = this.cScale3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 30
        });
        this.cScale4 = this.cScale4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.cScale5 = this.cScale5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 90
        });
        this.cScale6 = this.cScale6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.cScale7 = this.cScale7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 150
        });
        this.cScale8 = this.cScale8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 210,
            l: 150
        });
        this.cScale9 = this.cScale9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 270
        });
        this.cScale10 = this.cScale10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 300
        });
        this.cScale11 = this.cScale11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 330
        });
        if (this.darkMode) {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 75);
            }
        } else {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 25);
            }
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        const multiplier = this.darkMode ? -4 : -1;
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (5 + i * 3)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (8 + i * 3)
            });
        }
        this.classText = this.classText || this.textColor;
        this.fillType0 = this.fillType0 || this.primaryColor;
        this.fillType1 = this.fillType1 || this.secondaryColor;
        this.fillType2 = this.fillType2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = this.fillType3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = this.fillType4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = this.fillType5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = this.fillType6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = this.fillType7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || this.primaryColor;
        this.pie2 = this.pie2 || this.secondaryColor;
        this.pie3 = this.pie3 || this.tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -10
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -10
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -20
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -20
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -10
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.plotColorPalette) || "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0"
        };
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = this.git0 || "#0b0000";
        this.git1 = this.git1 || "#4d1037";
        this.git2 = this.git2 || "#3f5258";
        this.git3 = this.git3 || "#4f2f1b";
        this.git4 = this.git4 || "#6e0a0a";
        this.git5 = this.git5 || "#3b0048";
        this.git6 = this.git6 || "#995a01";
        this.git7 = this.git7 || "#154706";
        this.gitDarkMode = true;
        if (this.gitDarkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.gitBranchLabel0 = this.gitBranchLabel0 || this.branchLabelColor;
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.branchLabelColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.branchLabelColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || this.branchLabelColor;
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.branchLabelColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.branchLabelColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.branchLabelColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#333";
        this.primaryColor = "#1f2020";
        this.secondaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 16);
        this.tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -160
        });
        this.primaryBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.secondaryBorderColor = mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = mkBorder(this.tertiaryColor, this.darkMode);
        this.primaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.secondaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.mainBkg = "#2a2020";
        this.secondBkg = "calculated";
        this.mainContrastColor = "lightgrey";
        this.darkTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])("#323D47"), 10);
        this.border1 = "#ccc";
        this.border2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__["rgba"])(255, 255, 255, 0.25);
        this.arrowheadColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.fontFamily = "arial, sans-serif";
        this.fontSize = "14px";
        this.labelBackground = "#181818";
        this.textColor = "#ccc";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 3;
        this.strokeWidth = 1;
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "#333";
        this.THEME_COLOR_LIMIT = 12;
        this.fontFamily = "arial, sans-serif";
        this.fontSize = "14px";
        this.useGradient = true;
        this.gradientStart = "#0042eb";
        this.gradientStop = "#eb0042";
        this.dropShadow = "drop-shadow( 1px 2px 2px rgba(185,185,185,0.2))";
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.noteFontWeight = "normal";
        this.fontWeight = "normal";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class6, "Theme"), _class6);
var getThemeVariables7 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme7();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme8 = (_class7 = class {
    updateColors() {
        var _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10;
        this.primaryTextColor = this.primaryTextColor || (this.darkMode ? "#eee" : "#28253D");
        this.secondaryColor = this.secondaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -120
        });
        this.tertiaryColor = this.tertiaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 180,
            l: 5
        });
        this.primaryBorderColor = this.primaryBorderColor || mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = this.secondaryBorderColor || mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = this.tertiaryBorderColor || mkBorder(this.tertiaryColor, this.darkMode);
        this.noteBorderColor = this.noteBorderColor || mkBorder(this.noteBkgColor, this.darkMode);
        this.noteBkgColor = this.noteBkgColor || "#FEF9C3";
        this.noteTextColor = this.noteTextColor || "#28253D";
        this.secondaryTextColor = this.secondaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = this.tertiaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = this.lineColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.arrowheadColor = this.arrowheadColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = this.textColor || this.primaryTextColor;
        this.border2 = this.border2 || this.tertiaryBorderColor;
        this.nodeBkg = this.nodeBkg || this.primaryColor;
        this.mainBkg = this.mainBkg || this.primaryColor;
        this.nodeBorder = this.nodeBorder || this.primaryBorderColor;
        this.clusterBkg = this.clusterBkg || this.tertiaryColor;
        this.clusterBorder = this.clusterBorder || this.tertiaryBorderColor;
        this.defaultLinkColor = this.defaultLinkColor || this.lineColor;
        this.titleColor = this.titleColor || this.tertiaryTextColor;
        this.edgeLabelBackground = this.edgeLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.nodeTextColor = this.nodeTextColor || this.primaryTextColor;
        this.noteFontWeight = 600;
        this.actorBorder = this.actorBorder || this.primaryBorderColor;
        this.actorBkg = this.actorBkg || this.mainBkg;
        this.actorTextColor = this.actorTextColor || this.primaryTextColor;
        this.actorLineColor = this.actorLineColor || this.actorBorder;
        this.labelBoxBkgColor = this.labelBoxBkgColor || this.actorBkg;
        this.signalColor = this.signalColor || this.textColor;
        this.signalTextColor = this.signalTextColor || this.textColor;
        this.labelBoxBorderColor = this.labelBoxBorderColor || this.actorBorder;
        this.labelTextColor = this.labelTextColor || this.actorTextColor;
        this.loopTextColor = this.loopTextColor || this.actorTextColor;
        this.activationBorderColor = this.activationBorderColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 10);
        this.activationBkgColor = this.activationBkgColor || this.secondaryColor;
        this.sequenceNumberColor = this.sequenceNumberColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.lineColor);
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        const primaryColor = "#ECECFE";
        const secondaryColor = "#E9E9F1";
        const tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 180,
            l: 5
        });
        this.sectionBkgColor = this.sectionBkgColor || tertiaryColor;
        this.altSectionBkgColor = this.altSectionBkgColor || "white";
        this.sectionBkgColor = this.sectionBkgColor || secondaryColor;
        this.sectionBkgColor2 = this.sectionBkgColor2 || primaryColor;
        this.excludeBkgColor = this.excludeBkgColor || "#eeeeee";
        this.taskBorderColor = this.taskBorderColor || this.primaryBorderColor;
        this.taskBkgColor = this.taskBkgColor || primaryColor;
        this.activeTaskBorderColor = this.activeTaskBorderColor || primaryColor;
        this.activeTaskBkgColor = this.activeTaskBkgColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(primaryColor, 23);
        this.gridColor = this.gridColor || "lightgrey";
        this.doneTaskBkgColor = this.doneTaskBkgColor || "lightgrey";
        this.doneTaskBorderColor = this.doneTaskBorderColor || "grey";
        this.critBorderColor = this.critBorderColor || "#ff8888";
        this.critBkgColor = this.critBkgColor || "red";
        this.todayLineColor = this.todayLineColor || "red";
        this.taskTextColor = this.taskTextColor || this.textColor;
        this.vertLineColor = this.vertLineColor || this.primaryBorderColor;
        this.taskTextOutsideColor = this.taskTextOutsideColor || this.textColor;
        this.taskTextLightColor = this.taskTextLightColor || this.textColor;
        this.taskTextColor = this.taskTextColor || this.primaryTextColor;
        this.taskTextDarkColor = this.taskTextDarkColor || this.textColor;
        this.taskTextClickableColor = this.taskTextClickableColor || "#003163";
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.personBorder = this.personBorder || this.primaryBorderColor;
        this.personBkg = this.personBkg || this.mainBkg;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.compositeTitleBackground = "#F9F9FB";
        this.altBackground = "#F9F9FB";
        this.stateEdgeLabelBackground = "#FFFFFF";
        this.fontWeight = 600;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.specialStateColor = this.lineColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScale" + i] = this.mainBkg;
        }
        if (this.darkMode) {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 75);
            }
        } else {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 25);
            }
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        const multiplier = this.darkMode ? -4 : -1;
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (5 + i * 3)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (8 + i * 3)
            });
        }
        this.classText = this.classText || this.textColor;
        this.fillType0 = this.fillType0 || primaryColor;
        this.fillType1 = this.fillType1 || secondaryColor;
        this.fillType2 = this.fillType2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 64
        });
        this.fillType3 = this.fillType3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: 64
        });
        this.fillType4 = this.fillType4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -64
        });
        this.fillType5 = this.fillType5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: -64
        });
        this.fillType6 = this.fillType6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 128
        });
        this.fillType7 = this.fillType7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || primaryColor;
        this.pie2 = this.pie2 || secondaryColor;
        this.pie3 = this.pie3 || tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            l: -10
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(tertiaryColor, {
            l: -10
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60,
            l: -20
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60,
            l: -20
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120,
            l: -10
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.quadrant1Fill = this.quadrant1Fill || primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.plotColorPalette) || "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0"
        };
        this.requirementBackground = this.requirementBackground || primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.requirementEdgeLabelBackground = "#FFFFFF";
        this.git0 = this.git0 || primaryColor;
        this.git1 = this.git1 || secondaryColor;
        this.git2 = this.git2 || tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.gitBranchLabel0 = this.gitBranchLabel0 || this.branchLabelColor;
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.branchLabelColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.branchLabelColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || this.branchLabelColor;
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.branchLabelColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.branchLabelColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.branchLabelColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        var _this_commitLineColor;
        this.commitLineColor = (_this_commitLineColor = this.commitLineColor) !== null && _this_commitLineColor !== void 0 ? _this_commitLineColor : "#BDBCCC";
        this.erEdgeLabelBackground = "#FFFFFF";
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#ffffff";
        this.primaryColor = "#cccccc";
        this.mainBkg = "#ffffff";
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "#28253D";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 12;
        this.strokeWidth = 2;
        this.primaryBorderColor = mkBorder("#28253D", this.darkMode);
        this.fontFamily = '"Recursive Variable", arial, sans-serif';
        this.fontSize = "14px";
        this.nodeBorder = "#28253D";
        this.stateBorder = "#28253D";
        this.useGradient = false;
        this.gradientStart = "#0042eb";
        this.gradientStop = "#eb0042";
        this.dropShadow = "url(#drop-shadow)";
        this.nodeShadow = true;
        this.tertiaryColor = "#ffffff";
        this.clusterBkg = "#F9F9FB";
        this.clusterBorder = "#BDBCCC";
        this.noteBorderColor = "#FACC15";
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.actorBorder = "#28253D";
        this.filterColor = "#000000";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class7, "Theme"), _class7);
var getThemeVariables8 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme8();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme9 = (_class8 = class {
    updateColors() {
        var _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10;
        this.primaryTextColor = this.primaryTextColor || (this.darkMode ? "#eee" : "#FFFFFF");
        this.secondaryColor = this.secondaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -120
        });
        this.tertiaryColor = this.tertiaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 180,
            l: 5
        });
        this.primaryBorderColor = this.primaryBorderColor || mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = this.secondaryBorderColor || mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = this.tertiaryBorderColor || mkBorder(this.tertiaryColor, this.darkMode);
        this.noteBorderColor = this.noteBorderColor || mkBorder(this.noteBkgColor, this.darkMode);
        this.noteBkgColor = this.noteBkgColor || "#fff5ad";
        this.noteTextColor = this.noteTextColor || "#FFFFFF";
        this.secondaryTextColor = this.secondaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = this.tertiaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = this.lineColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.arrowheadColor = this.arrowheadColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = this.textColor || this.primaryTextColor;
        this.border2 = this.border2 || this.tertiaryBorderColor;
        this.nodeBkg = this.nodeBkg || this.primaryColor;
        this.mainBkg = this.mainBkg || this.primaryColor;
        this.nodeBorder = this.nodeBorder || this.border1;
        this.clusterBkg = this.clusterBkg || this.tertiaryColor;
        this.clusterBorder = this.clusterBorder || this.tertiaryBorderColor;
        this.defaultLinkColor = this.defaultLinkColor || this.lineColor;
        this.titleColor = this.titleColor || this.tertiaryTextColor;
        this.edgeLabelBackground = this.edgeLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.nodeTextColor = this.nodeTextColor || this.primaryTextColor;
        this.actorBorder = "#FFFFFF";
        this.signalColor = "#FFFFFF";
        this.labelBoxBorderColor = "#BDBCCC";
        this.actorBorder = this.actorBorder || this.primaryBorderColor;
        this.actorBkg = this.actorBkg || this.mainBkg;
        this.actorTextColor = this.actorTextColor || this.primaryTextColor;
        this.actorLineColor = this.actorLineColor || this.actorBorder;
        this.labelBoxBkgColor = this.labelBoxBkgColor || this.actorBkg;
        this.signalColor = this.signalColor || this.textColor;
        this.signalTextColor = this.signalTextColor || this.textColor;
        this.labelBoxBorderColor = this.labelBoxBorderColor || this.actorBorder;
        this.labelTextColor = this.labelTextColor || this.actorTextColor;
        this.loopTextColor = this.loopTextColor || this.actorTextColor;
        this.activationBorderColor = this.activationBorderColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 10);
        this.activationBkgColor = this.activationBkgColor || this.secondaryColor;
        this.sequenceNumberColor = this.sequenceNumberColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.lineColor);
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.sectionBkgColor = this.sectionBkgColor || this.tertiaryColor;
        this.altSectionBkgColor = this.altSectionBkgColor || "white";
        this.sectionBkgColor = this.sectionBkgColor || this.secondaryColor;
        this.sectionBkgColor2 = this.sectionBkgColor2 || this.primaryColor;
        this.excludeBkgColor = this.excludeBkgColor || "#eeeeee";
        this.taskBorderColor = this.taskBorderColor || this.primaryBorderColor;
        this.taskBkgColor = this.taskBkgColor || this.primaryColor;
        this.activeTaskBorderColor = this.activeTaskBorderColor || this.primaryColor;
        this.activeTaskBkgColor = this.activeTaskBkgColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 23);
        this.gridColor = this.gridColor || "lightgrey";
        this.doneTaskBkgColor = this.doneTaskBkgColor || "lightgrey";
        this.doneTaskBorderColor = this.doneTaskBorderColor || "grey";
        this.critBorderColor = this.critBorderColor || "#ff8888";
        this.critBkgColor = this.critBkgColor || "red";
        this.todayLineColor = this.todayLineColor || "red";
        this.taskTextColor = this.taskTextColor || this.textColor;
        this.taskTextOutsideColor = this.taskTextOutsideColor || this.textColor;
        this.taskTextLightColor = this.taskTextLightColor || this.textColor;
        this.taskTextColor = this.taskTextColor || this.primaryTextColor;
        this.taskTextDarkColor = this.taskTextDarkColor || this.textColor;
        this.taskTextClickableColor = this.taskTextClickableColor || "#003163";
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.personBorder = this.personBorder || this.primaryBorderColor;
        this.personBkg = this.personBkg || this.mainBkg;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.vertLineColor = this.vertLineColor || this.primaryBorderColor;
        this.compositeBackground = "#16141F";
        this.altBackground = "#16141F";
        this.compositeTitleBackground = "#16141F";
        this.stateEdgeLabelBackground = "#16141F";
        this.fontWeight = 600;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.specialStateColor = this.lineColor;
        this.cScale0 = this.cScale0 || this.primaryColor;
        this.cScale1 = this.cScale1 || this.secondaryColor;
        this.cScale2 = this.cScale2 || this.tertiaryColor;
        this.cScale3 = this.cScale3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 30
        });
        this.cScale4 = this.cScale4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.cScale5 = this.cScale5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 90
        });
        this.cScale6 = this.cScale6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        this.cScale7 = this.cScale7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 150
        });
        this.cScale8 = this.cScale8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 210,
            l: 150
        });
        this.cScale9 = this.cScale9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 270
        });
        this.cScale10 = this.cScale10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 300
        });
        this.cScale11 = this.cScale11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 330
        });
        if (this.darkMode) {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 75);
            }
        } else {
            for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
                this["cScale" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 25);
            }
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        const multiplier = this.darkMode ? -4 : -1;
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (5 + i * 3)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (8 + i * 3)
            });
        }
        this.classText = this.classText || this.textColor;
        this.fillType0 = this.fillType0 || this.primaryColor;
        this.fillType1 = this.fillType1 || this.secondaryColor;
        this.fillType2 = this.fillType2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = this.fillType3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = this.fillType4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = this.fillType5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = this.fillType6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = this.fillType7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || this.primaryColor;
        this.pie2 = this.pie2 || this.secondaryColor;
        this.pie3 = this.pie3 || this.tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -10
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -10
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -20
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -20
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -10
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.plotColorPalette) || "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0"
        };
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.requirementEdgeLabelBackground = "#16141F";
        this.git0 = this.git0 || this.primaryColor;
        this.git1 = this.git1 || this.secondaryColor;
        this.git2 = this.git2 || this.tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.gitBranchLabel0 = this.gitBranchLabel0 || this.branchLabelColor;
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.branchLabelColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.branchLabelColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || this.branchLabelColor;
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.branchLabelColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.branchLabelColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.branchLabelColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        var _this_commitLineColor;
        this.commitLineColor = (_this_commitLineColor = this.commitLineColor) !== null && _this_commitLineColor !== void 0 ? _this_commitLineColor : "#BDBCCC";
        this.erEdgeLabelBackground = "#16141F";
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#333";
        this.primaryColor = "#1f2020";
        this.secondaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 16);
        this.tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -160
        });
        this.primaryBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.secondaryBorderColor = mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = mkBorder(this.tertiaryColor, this.darkMode);
        this.primaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.secondaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.mainBkg = "#111113";
        this.secondBkg = "calculated";
        this.mainContrastColor = "lightgrey";
        this.darkTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])("#323D47"), 10);
        this.border1 = "#ccc";
        this.border2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__["rgba"])(255, 255, 255, 0.25);
        this.arrowheadColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.fontFamily = '"Recursive Variable", arial, sans-serif';
        this.fontSize = "14px";
        this.labelBackground = "#111113";
        this.textColor = "#ccc";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 12;
        this.strokeWidth = 2;
        var _this_noteBkgColor;
        this.noteBkgColor = (_this_noteBkgColor = this.noteBkgColor) !== null && _this_noteBkgColor !== void 0 ? _this_noteBkgColor : "#FEF9C3";
        var _this_noteTextColor;
        this.noteTextColor = (_this_noteTextColor = this.noteTextColor) !== null && _this_noteTextColor !== void 0 ? _this_noteTextColor : "#28253D";
        this.THEME_COLOR_LIMIT = 12;
        this.fontFamily = '"Recursive Variable", arial, sans-serif';
        this.fontSize = "14px";
        this.nodeBorder = "#FFFFFF";
        this.stateBorder = "#FFFFFF";
        this.useGradient = false;
        this.gradientStart = "#0042eb";
        this.gradientStop = "#eb0042";
        this.dropShadow = "url(#drop-shadow)";
        this.nodeShadow = true;
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.clusterBkg = "#1E1A2E";
        this.clusterBorder = "#BDBCCC";
        this.noteBorderColor = "#FACC15";
        this.noteFontWeight = 600;
        this.filterColor = "#FFFFFF";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class8, "Theme"), _class8);
var getThemeVariables9 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme9();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme10 = (_class9 = class {
    updateColors() {
        var _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10;
        this.primaryTextColor = this.primaryTextColor || (this.darkMode ? "#eee" : "#28253D");
        this.secondaryColor = this.secondaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -120
        });
        this.tertiaryColor = this.tertiaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 180,
            l: 5
        });
        this.primaryBorderColor = this.primaryBorderColor || mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = this.secondaryBorderColor || mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = this.tertiaryBorderColor || mkBorder(this.tertiaryColor, this.darkMode);
        this.noteBorderColor = this.noteBorderColor || mkBorder(this.noteBkgColor, this.darkMode);
        this.noteBkgColor = this.noteBkgColor || "#fff5ad";
        this.noteTextColor = this.noteTextColor || "#28253D";
        this.secondaryTextColor = this.secondaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = this.tertiaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = this.lineColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.arrowheadColor = this.arrowheadColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = this.textColor || this.primaryTextColor;
        this.border2 = this.border2 || this.tertiaryBorderColor;
        this.nodeBkg = this.nodeBkg || this.primaryColor;
        this.mainBkg = this.mainBkg || this.primaryColor;
        this.nodeBorder = this.nodeBorder || this.primaryBorderColor;
        this.clusterBkg = this.clusterBkg || this.tertiaryColor;
        this.clusterBorder = this.clusterBorder || this.tertiaryBorderColor;
        this.defaultLinkColor = this.defaultLinkColor || this.lineColor;
        this.titleColor = this.titleColor || this.tertiaryTextColor;
        this.edgeLabelBackground = this.edgeLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.nodeTextColor = this.nodeTextColor || this.primaryTextColor;
        this.actorBorder = this.actorBorder || this.primaryBorderColor;
        this.actorBkg = this.actorBkg || this.mainBkg;
        this.actorTextColor = this.actorTextColor || this.primaryTextColor;
        this.actorLineColor = this.actorLineColor || this.actorBorder;
        this.labelBoxBkgColor = this.labelBoxBkgColor || this.actorBkg;
        this.signalColor = this.signalColor || this.textColor;
        this.signalTextColor = this.signalTextColor || this.textColor;
        this.labelBoxBorderColor = this.labelBoxBorderColor || this.actorBorder;
        this.labelTextColor = this.labelTextColor || this.actorTextColor;
        this.loopTextColor = this.loopTextColor || this.actorTextColor;
        this.activationBorderColor = this.activationBorderColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 10);
        this.activationBkgColor = this.activationBkgColor || this.secondaryColor;
        this.sequenceNumberColor = this.sequenceNumberColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.lineColor);
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        const primaryColor = "#ECECFE";
        const secondaryColor = "#E9E9F1";
        const tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 180,
            l: 5
        });
        this.sectionBkgColor = this.sectionBkgColor || tertiaryColor;
        this.altSectionBkgColor = this.altSectionBkgColor || "white";
        this.sectionBkgColor = this.sectionBkgColor || secondaryColor;
        this.sectionBkgColor2 = this.sectionBkgColor2 || primaryColor;
        this.excludeBkgColor = this.excludeBkgColor || "#eeeeee";
        this.taskBorderColor = this.taskBorderColor || this.primaryBorderColor;
        this.taskBkgColor = this.taskBkgColor || primaryColor;
        this.activeTaskBorderColor = this.activeTaskBorderColor || primaryColor;
        this.activeTaskBkgColor = this.activeTaskBkgColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(primaryColor, 23);
        this.gridColor = this.gridColor || "lightgrey";
        this.doneTaskBkgColor = this.doneTaskBkgColor || "lightgrey";
        this.doneTaskBorderColor = this.doneTaskBorderColor || "grey";
        this.critBorderColor = this.critBorderColor || "#ff8888";
        this.critBkgColor = this.critBkgColor || "red";
        this.todayLineColor = this.todayLineColor || "red";
        this.taskTextColor = this.taskTextColor || this.textColor;
        this.vertLineColor = this.vertLineColor || this.primaryBorderColor;
        this.taskTextOutsideColor = this.taskTextOutsideColor || this.textColor;
        this.taskTextLightColor = this.taskTextLightColor || this.textColor;
        this.taskTextColor = this.taskTextColor || this.primaryTextColor;
        this.taskTextDarkColor = this.taskTextDarkColor || this.textColor;
        this.taskTextClickableColor = this.taskTextClickableColor || "#003163";
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.personBorder = this.personBorder || this.primaryBorderColor;
        this.personBkg = this.personBkg || this.mainBkg;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.specialStateColor = this.lineColor;
        this.cScale0 = this.cScale0 || "#f4a8ff";
        this.cScale1 = this.cScale1 || "#46ecd5";
        this.cScale2 = this.cScale2 || "#ffb86a";
        this.cScale3 = this.cScale3 || "#dab2ff";
        this.cScale4 = this.cScale4 || "#7bf1a8";
        this.cScale5 = this.cScale5 || "#c4b4ff";
        this.cScale6 = this.cScale6 || "#ffa2a2";
        this.cScale7 = this.cScale7 || "#ffdf20";
        this.cScale8 = this.cScale8 || "#a3b3ff";
        this.cScale9 = this.cScale9 || "#bbf451";
        this.cScale10 = this.cScale10 || "#74d4ff";
        this.cScale11 = this.cScale11 || "#ffa1ad";
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = this["cScaleLabel" + i] || this.scaleLabelColor;
        }
        const multiplier = this.darkMode ? -4 : -1;
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (5 + i * 3)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (8 + i * 3)
            });
        }
        this.classText = this.classText || this.textColor;
        this.fillType0 = this.fillType0 || primaryColor;
        this.fillType1 = this.fillType1 || secondaryColor;
        this.fillType2 = this.fillType2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 64
        });
        this.fillType3 = this.fillType3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: 64
        });
        this.fillType4 = this.fillType4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -64
        });
        this.fillType5 = this.fillType5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: -64
        });
        this.fillType6 = this.fillType6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 128
        });
        this.fillType7 = this.fillType7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || primaryColor;
        this.pie2 = this.pie2 || secondaryColor;
        this.pie3 = this.pie3 || tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(secondaryColor, {
            l: -10
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(tertiaryColor, {
            l: -10
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60,
            l: -20
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60,
            l: -20
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120,
            l: -10
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.quadrant1Fill = this.quadrant1Fill || primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.plotColorPalette) || "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0"
        };
        this.requirementBackground = this.requirementBackground || primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = this.git0 || primaryColor;
        this.git1 = this.git1 || secondaryColor;
        this.git2 = this.git2 || tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.gitBranchLabel0 = this.gitBranchLabel0 || this.branchLabelColor;
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.branchLabelColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.branchLabelColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || this.branchLabelColor;
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.branchLabelColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.branchLabelColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.branchLabelColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        var _this_commitLineColor;
        this.commitLineColor = (_this_commitLineColor = this.commitLineColor) !== null && _this_commitLineColor !== void 0 ? _this_commitLineColor : "#BDBCCC";
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        this.fontWeight = 600;
        this.erEdgeLabelBackground = "#FFFFFF";
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#ffffff";
        this.primaryColor = "#cccccc";
        this.mainBkg = "#ffffff";
        this.noteBkgColor = "#fff5ad";
        this.noteTextColor = "#28253D";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 12;
        this.strokeWidth = 2;
        this.primaryBorderColor = mkBorder(this.primaryColor, this.darkMode);
        this.fontFamily = '"Recursive Variable", arial, sans-serif';
        this.fontSize = "14px";
        this.nodeBorder = "#28253D";
        this.stateBorder = "#28253D";
        this.useGradient = false;
        this.gradientStart = "#0042eb";
        this.gradientStop = "#eb0042";
        this.dropShadow = "url(#drop-shadow)";
        this.nodeShadow = true;
        this.tertiaryColor = "#ffffff";
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.actorBorder = "#28253D";
        this.noteBorderColor = "#FACC15";
        this.noteFontWeight = 600;
        this.borderColorArray = [
            "#E879F9",
            //Fuchsia-400
            "#2DD4BF",
            //Teal-400
            "#FB923C",
            //Orange-400
            "#22D3EE",
            // Cyan-400
            "#4ADE80",
            // Green-400
            "#A78BFA",
            //Violet-400
            "#F87171",
            //red-400
            "#FACC15",
            //yellow-400
            "#818CF8",
            //indigo-400
            "#A3E635 ",
            //Lime-400
            "#38BDF8",
            //Sky-400
            "#FB7185"
        ];
        this.bkgColorArray = [
            "#FDF4FF",
            //Fuchsia-50
            "#F0FDFA",
            //Teal-50
            "#FFF7ED",
            //Orange-50
            "#ECFEFF",
            // Cyan-50
            "#F0FDF4",
            // Green-50
            "#F5F3FF",
            //Violet-50
            "#FEF2F2",
            //red-50
            "#FEFCE8",
            //yellow-50
            "#EEF2FF",
            //indigo-50
            "#F7FEE7",
            //Lime-50
            "#F0F9FF",
            //Sky-50
            "#FFF1F2"
        ];
        this.filterColor = "#000000";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class9, "Theme"), _class9);
var getThemeVariables10 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme10();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
;
var Theme11 = (_class10 = class {
    updateColors() {
        var _this_xyChart, _this_xyChart1, _this_xyChart2, _this_xyChart3, _this_xyChart4, _this_xyChart5, _this_xyChart6, _this_xyChart7, _this_xyChart8, _this_xyChart9, _this_xyChart10;
        this.primaryTextColor = this.primaryTextColor || (this.darkMode ? "#eee" : "#FFFFFF");
        this.secondaryColor = this.secondaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -120
        });
        this.tertiaryColor = this.tertiaryColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 180,
            l: 5
        });
        this.primaryBorderColor = this.primaryBorderColor || mkBorder(this.primaryColor, this.darkMode);
        this.secondaryBorderColor = this.secondaryBorderColor || mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = this.tertiaryBorderColor || mkBorder(this.tertiaryColor, this.darkMode);
        this.noteBorderColor = this.noteBorderColor || mkBorder(this.noteBkgColor, this.darkMode);
        this.noteBkgColor = this.noteBkgColor || "#fff5ad";
        this.noteTextColor = this.noteTextColor || "#FFFFFF";
        this.secondaryTextColor = this.secondaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = this.tertiaryTextColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.lineColor = this.lineColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.arrowheadColor = this.arrowheadColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.textColor = this.textColor || this.primaryTextColor;
        this.border2 = this.border2 || this.tertiaryBorderColor;
        this.nodeBkg = this.nodeBkg || this.primaryColor;
        this.mainBkg = this.mainBkg || this.primaryColor;
        this.nodeBorder = this.nodeBorder || this.border1;
        this.clusterBkg = this.clusterBkg || this.tertiaryColor;
        this.clusterBorder = this.clusterBorder || this.tertiaryBorderColor;
        this.defaultLinkColor = this.defaultLinkColor || this.lineColor;
        this.titleColor = this.titleColor || this.tertiaryTextColor;
        this.edgeLabelBackground = this.edgeLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.nodeTextColor = this.nodeTextColor || this.primaryTextColor;
        this.actorBorder = "#FFFFFF";
        this.signalColor = "#FFFFFF";
        this.labelBoxBorderColor = "#BDBCCC";
        this.actorBorder = this.actorBorder || this.primaryBorderColor;
        this.actorBkg = this.actorBkg || this.mainBkg;
        this.actorTextColor = this.actorTextColor || this.primaryTextColor;
        this.actorLineColor = this.actorLineColor || this.actorBorder;
        this.labelBoxBkgColor = this.labelBoxBkgColor || this.actorBkg;
        this.signalColor = this.signalColor || this.textColor;
        this.signalTextColor = this.signalTextColor || this.textColor;
        this.labelBoxBorderColor = this.labelBoxBorderColor || this.actorBorder;
        this.labelTextColor = this.labelTextColor || this.actorTextColor;
        this.loopTextColor = this.loopTextColor || this.actorTextColor;
        this.activationBorderColor = this.activationBorderColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 10);
        this.activationBkgColor = this.activationBkgColor || this.secondaryColor;
        this.sequenceNumberColor = this.sequenceNumberColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.lineColor);
        this.rectBkgColor = this.rectBkgColor || this.tertiaryColor;
        this.rootLabelColor = "#FFFFFF";
        this.sectionBkgColor = this.sectionBkgColor || this.tertiaryColor;
        this.altSectionBkgColor = this.altSectionBkgColor || "white";
        this.sectionBkgColor = this.sectionBkgColor || this.secondaryColor;
        this.sectionBkgColor2 = this.sectionBkgColor2 || this.primaryColor;
        this.excludeBkgColor = this.excludeBkgColor || "#eeeeee";
        this.taskBorderColor = this.taskBorderColor || this.primaryBorderColor;
        this.taskBkgColor = this.taskBkgColor || this.primaryColor;
        this.activeTaskBorderColor = this.activeTaskBorderColor || this.primaryColor;
        this.activeTaskBkgColor = this.activeTaskBkgColor || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 23);
        this.gridColor = this.gridColor || "lightgrey";
        this.doneTaskBkgColor = this.doneTaskBkgColor || "lightgrey";
        this.doneTaskBorderColor = this.doneTaskBorderColor || "grey";
        this.critBorderColor = this.critBorderColor || "#ff8888";
        this.critBkgColor = this.critBkgColor || "red";
        this.todayLineColor = this.todayLineColor || "red";
        this.taskTextColor = this.taskTextColor || this.textColor;
        this.vertLineColor = this.vertLineColor || this.primaryBorderColor;
        this.taskTextOutsideColor = this.taskTextOutsideColor || this.textColor;
        this.taskTextLightColor = this.taskTextLightColor || this.textColor;
        this.taskTextColor = this.taskTextColor || this.primaryTextColor;
        this.taskTextDarkColor = this.taskTextDarkColor || this.textColor;
        this.taskTextClickableColor = this.taskTextClickableColor || "#003163";
        this.archEdgeColor = this.lineColor;
        this.archEdgeArrowColor = this.lineColor;
        this.personBorder = this.personBorder || this.primaryBorderColor;
        this.personBkg = this.personBkg || this.mainBkg;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.transitionLabelColor = this.transitionLabelColor || this.textColor;
        this.stateLabelColor = this.stateLabelColor || this.stateBkg || this.primaryTextColor;
        this.stateBkg = this.stateBkg || this.mainBkg;
        this.labelBackgroundColor = this.labelBackgroundColor || this.stateBkg;
        this.compositeBackground = this.compositeBackground || this.background || this.tertiaryColor;
        this.altBackground = this.altBackground || "#f0f0f0";
        this.compositeTitleBackground = this.compositeTitleBackground || this.mainBkg;
        this.compositeBorder = this.compositeBorder || this.nodeBorder;
        this.innerEndBackground = this.nodeBorder;
        this.errorBkgColor = this.errorBkgColor || this.tertiaryColor;
        this.errorTextColor = this.errorTextColor || this.tertiaryTextColor;
        this.transitionColor = this.transitionColor || this.lineColor;
        this.specialStateColor = this.lineColor;
        this.cScale0 = this.cScale0 || "#f4a8ff";
        this.cScale1 = this.cScale1 || "#46ecd5";
        this.cScale2 = this.cScale2 || "#ffb86a";
        this.cScale3 = this.cScale3 || "#dab2ff";
        this.cScale4 = this.cScale4 || "#7bf1a8";
        this.cScale5 = this.cScale5 || "#c4b4ff";
        this.cScale6 = this.cScale6 || "#ffa2a2";
        this.cScale7 = this.cScale7 || "#ffdf20";
        this.cScale8 = this.cScale8 || "#a3b3ff";
        this.cScale9 = this.cScale9 || "#bbf451";
        this.cScale10 = this.cScale10 || "#74d4ff";
        this.cScale11 = this.cScale11 || "#ffa1ad";
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleInv" + i] = this["cScaleInv" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this["cScale" + i]);
        }
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            if (this.darkMode) {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this["cScale" + i], 10);
            } else {
                this["cScalePeer" + i] = this["cScalePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 10);
            }
        }
        this.scaleLabelColor = this.scaleLabelColor || this.labelTextColor;
        for(let i = 0; i < this.THEME_COLOR_LIMIT; i++){
            this["cScaleLabel" + i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this["cScale" + i], 75);
        }
        const multiplier = this.darkMode ? -4 : -1;
        for(let i = 0; i < 5; i++){
            this["surface" + i] = this["surface" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (5 + i * 3)
            });
            this["surfacePeer" + i] = this["surfacePeer" + i] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.mainBkg, {
                h: 180,
                s: -15,
                l: multiplier * (8 + i * 3)
            });
        }
        this.classText = this.classText || this.textColor;
        this.fillType0 = this.fillType0 || this.primaryColor;
        this.fillType1 = this.fillType1 || this.secondaryColor;
        this.fillType2 = this.fillType2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 64
        });
        this.fillType3 = this.fillType3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 64
        });
        this.fillType4 = this.fillType4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -64
        });
        this.fillType5 = this.fillType5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: -64
        });
        this.fillType6 = this.fillType6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 128
        });
        this.fillType7 = this.fillType7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            h: 128
        });
        this.pie1 = this.pie1 || this.primaryColor;
        this.pie2 = this.pie2 || this.secondaryColor;
        this.pie3 = this.pie3 || this.tertiaryColor;
        this.pie4 = this.pie4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            l: -10
        });
        this.pie5 = this.pie5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.secondaryColor, {
            l: -10
        });
        this.pie6 = this.pie6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.tertiaryColor, {
            l: -10
        });
        this.pie7 = this.pie7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -10
        });
        this.pie8 = this.pie8 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -10
        });
        this.pie9 = this.pie9 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: 0
        });
        this.pie10 = this.pie10 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60,
            l: -20
        });
        this.pie11 = this.pie11 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60,
            l: -20
        });
        this.pie12 = this.pie12 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120,
            l: -10
        });
        this.pieTitleTextSize = this.pieTitleTextSize || "25px";
        this.pieTitleTextColor = this.pieTitleTextColor || this.taskTextDarkColor;
        this.pieSectionTextSize = this.pieSectionTextSize || "17px";
        this.pieSectionTextColor = this.pieSectionTextColor || this.textColor;
        this.pieLegendTextSize = this.pieLegendTextSize || "17px";
        this.pieLegendTextColor = this.pieLegendTextColor || this.taskTextDarkColor;
        this.pieStrokeColor = this.pieStrokeColor || "black";
        this.pieStrokeWidth = this.pieStrokeWidth || "2px";
        this.pieOuterStrokeWidth = this.pieOuterStrokeWidth || "2px";
        this.pieOuterStrokeColor = this.pieOuterStrokeColor || "black";
        this.pieOpacity = this.pieOpacity || "0.7";
        var _this_vennTitleTextColor;
        this.vennTitleTextColor = (_this_vennTitleTextColor = this.vennTitleTextColor) !== null && _this_vennTitleTextColor !== void 0 ? _this_vennTitleTextColor : this.titleColor;
        var _this_vennSetTextColor;
        this.vennSetTextColor = (_this_vennSetTextColor = this.vennSetTextColor) !== null && _this_vennSetTextColor !== void 0 ? _this_vennSetTextColor : this.textColor;
        this.quadrant1Fill = this.quadrant1Fill || this.primaryColor;
        this.quadrant2Fill = this.quadrant2Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 5,
            g: 5,
            b: 5
        });
        this.quadrant3Fill = this.quadrant3Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 10,
            g: 10,
            b: 10
        });
        this.quadrant4Fill = this.quadrant4Fill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            r: 15,
            g: 15,
            b: 15
        });
        this.quadrant1TextFill = this.quadrant1TextFill || this.primaryTextColor;
        this.quadrant2TextFill = this.quadrant2TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -5,
            g: -5,
            b: -5
        });
        this.quadrant3TextFill = this.quadrant3TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -10,
            g: -10,
            b: -10
        });
        this.quadrant4TextFill = this.quadrant4TextFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryTextColor, {
            r: -15,
            g: -15,
            b: -15
        });
        this.quadrantPointFill = this.quadrantPointFill || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$is_dark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__isDark$3e$__["isDark"])(this.quadrant1Fill) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.quadrant1Fill) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.quadrant1Fill);
        this.quadrantPointTextFill = this.quadrantPointTextFill || this.primaryTextColor;
        this.quadrantXAxisTextFill = this.quadrantXAxisTextFill || this.primaryTextColor;
        this.quadrantYAxisTextFill = this.quadrantYAxisTextFill || this.primaryTextColor;
        this.quadrantInternalBorderStrokeFill = this.quadrantInternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantExternalBorderStrokeFill = this.quadrantExternalBorderStrokeFill || this.primaryBorderColor;
        this.quadrantTitleFill = this.quadrantTitleFill || this.primaryTextColor;
        this.xyChart = {
            backgroundColor: ((_this_xyChart = this.xyChart) === null || _this_xyChart === void 0 ? void 0 : _this_xyChart.backgroundColor) || this.background,
            titleColor: ((_this_xyChart1 = this.xyChart) === null || _this_xyChart1 === void 0 ? void 0 : _this_xyChart1.titleColor) || this.primaryTextColor,
            xAxisTitleColor: ((_this_xyChart2 = this.xyChart) === null || _this_xyChart2 === void 0 ? void 0 : _this_xyChart2.xAxisTitleColor) || this.primaryTextColor,
            xAxisLabelColor: ((_this_xyChart3 = this.xyChart) === null || _this_xyChart3 === void 0 ? void 0 : _this_xyChart3.xAxisLabelColor) || this.primaryTextColor,
            xAxisTickColor: ((_this_xyChart4 = this.xyChart) === null || _this_xyChart4 === void 0 ? void 0 : _this_xyChart4.xAxisTickColor) || this.primaryTextColor,
            xAxisLineColor: ((_this_xyChart5 = this.xyChart) === null || _this_xyChart5 === void 0 ? void 0 : _this_xyChart5.xAxisLineColor) || this.primaryTextColor,
            yAxisTitleColor: ((_this_xyChart6 = this.xyChart) === null || _this_xyChart6 === void 0 ? void 0 : _this_xyChart6.yAxisTitleColor) || this.primaryTextColor,
            yAxisLabelColor: ((_this_xyChart7 = this.xyChart) === null || _this_xyChart7 === void 0 ? void 0 : _this_xyChart7.yAxisLabelColor) || this.primaryTextColor,
            yAxisTickColor: ((_this_xyChart8 = this.xyChart) === null || _this_xyChart8 === void 0 ? void 0 : _this_xyChart8.yAxisTickColor) || this.primaryTextColor,
            yAxisLineColor: ((_this_xyChart9 = this.xyChart) === null || _this_xyChart9 === void 0 ? void 0 : _this_xyChart9.yAxisLineColor) || this.primaryTextColor,
            plotColorPalette: ((_this_xyChart10 = this.xyChart) === null || _this_xyChart10 === void 0 ? void 0 : _this_xyChart10.plotColorPalette) || "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0"
        };
        this.requirementBackground = this.requirementBackground || this.primaryColor;
        this.requirementBorderColor = this.requirementBorderColor || this.primaryBorderColor;
        this.requirementBorderSize = this.requirementBorderSize || "1";
        this.requirementTextColor = this.requirementTextColor || this.primaryTextColor;
        this.relationColor = this.relationColor || this.lineColor;
        this.relationLabelBackground = this.relationLabelBackground || (this.darkMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.secondaryColor, 30) : this.secondaryColor);
        this.relationLabelColor = this.relationLabelColor || this.actorTextColor;
        this.git0 = this.git0 || this.primaryColor;
        this.git1 = this.git1 || this.secondaryColor;
        this.git2 = this.git2 || this.tertiaryColor;
        this.git3 = this.git3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -30
        });
        this.git4 = this.git4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -60
        });
        this.git5 = this.git5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -90
        });
        this.git6 = this.git6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 60
        });
        this.git7 = this.git7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: 120
        });
        if (this.darkMode) {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.git7, 25);
        } else {
            this.git0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git0, 25);
            this.git1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git1, 25);
            this.git2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git2, 25);
            this.git3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git3, 25);
            this.git4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git4, 25);
            this.git5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git5, 25);
            this.git6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git6, 25);
            this.git7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$darken$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__darken$3e$__["darken"])(this.git7, 25);
        }
        this.gitInv0 = this.gitInv0 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git0);
        this.gitInv1 = this.gitInv1 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git1);
        this.gitInv2 = this.gitInv2 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git2);
        this.gitInv3 = this.gitInv3 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git3);
        this.gitInv4 = this.gitInv4 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git4);
        this.gitInv5 = this.gitInv5 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git5);
        this.gitInv6 = this.gitInv6 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git6);
        this.gitInv7 = this.gitInv7 || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.git7);
        this.branchLabelColor = this.branchLabelColor || (this.darkMode ? "black" : this.labelTextColor);
        this.gitBranchLabel0 = this.gitBranchLabel0 || this.branchLabelColor;
        this.gitBranchLabel1 = this.gitBranchLabel1 || this.branchLabelColor;
        this.gitBranchLabel2 = this.gitBranchLabel2 || this.branchLabelColor;
        this.gitBranchLabel3 = this.gitBranchLabel3 || this.branchLabelColor;
        this.gitBranchLabel4 = this.gitBranchLabel4 || this.branchLabelColor;
        this.gitBranchLabel5 = this.gitBranchLabel5 || this.branchLabelColor;
        this.gitBranchLabel6 = this.gitBranchLabel6 || this.branchLabelColor;
        this.gitBranchLabel7 = this.gitBranchLabel7 || this.branchLabelColor;
        this.tagLabelColor = this.tagLabelColor || this.primaryTextColor;
        this.tagLabelBackground = this.tagLabelBackground || this.primaryColor;
        this.tagLabelBorder = this.tagBorder || this.primaryBorderColor;
        this.tagLabelFontSize = this.tagLabelFontSize || "10px";
        this.commitLabelColor = this.commitLabelColor || this.secondaryTextColor;
        this.commitLabelBackground = this.commitLabelBackground || this.secondaryColor;
        this.commitLabelFontSize = this.commitLabelFontSize || "10px";
        var _this_commitLineColor;
        this.commitLineColor = (_this_commitLineColor = this.commitLineColor) !== null && _this_commitLineColor !== void 0 ? _this_commitLineColor : "#BDBCCC";
        this.fontWeight = 600;
        this.erEdgeLabelBackground = "#16141F";
        this.attributeBackgroundColorOdd = this.attributeBackgroundColorOdd || oldAttributeBackgroundColorOdd;
        this.attributeBackgroundColorEven = this.attributeBackgroundColorEven || oldAttributeBackgroundColorEven;
    }
    calculate(overrides) {
        if (typeof overrides !== "object") {
            this.updateColors();
            return;
        }
        const keys = Object.keys(overrides);
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
        this.updateColors();
        keys.forEach((k)=>{
            this[k] = overrides[k];
        });
    }
    constructor(){
        this.background = "#333";
        this.primaryColor = "#1f2020";
        this.secondaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])(this.primaryColor, 16);
        this.tertiaryColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$adjust$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__adjust$3e$__["adjust"])(this.primaryColor, {
            h: -160
        });
        this.primaryBorderColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.secondaryBorderColor = mkBorder(this.secondaryColor, this.darkMode);
        this.tertiaryBorderColor = mkBorder(this.tertiaryColor, this.darkMode);
        this.primaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.primaryColor);
        this.secondaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.secondaryColor);
        this.tertiaryTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.tertiaryColor);
        this.mainBkg = "#111113";
        this.secondBkg = "calculated";
        this.mainContrastColor = "lightgrey";
        this.darkTextColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$lighten$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__lighten$3e$__["lighten"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])("#323D47"), 10);
        this.border1 = "#ccc";
        this.border2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$rgba$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__rgba$3e$__["rgba"])(255, 255, 255, 0.25);
        this.arrowheadColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$khroma$40$2$2e$1$2e$0$2f$node_modules$2f$khroma$2f$dist$2f$methods$2f$invert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__invert$3e$__["invert"])(this.background);
        this.fontFamily = '"Recursive Variable", arial, sans-serif';
        this.fontSize = "14px";
        this.labelBackground = "#111113";
        this.textColor = "#ccc";
        this.THEME_COLOR_LIMIT = 12;
        this.radius = 12;
        this.strokeWidth = 2;
        var _this_noteBkgColor;
        this.noteBkgColor = (_this_noteBkgColor = this.noteBkgColor) !== null && _this_noteBkgColor !== void 0 ? _this_noteBkgColor : "#FEF9C3";
        var _this_noteTextColor;
        this.noteTextColor = (_this_noteTextColor = this.noteTextColor) !== null && _this_noteTextColor !== void 0 ? _this_noteTextColor : "#28253D";
        this.THEME_COLOR_LIMIT = 12;
        this.fontFamily = '"Recursive Variable", arial, sans-serif';
        this.fontSize = "14px";
        this.nodeBorder = "#FFFFFF";
        this.stateBorder = "#FFFFFF";
        this.useGradient = false;
        this.gradientStart = "#0042eb";
        this.gradientStop = "#eb0042";
        this.dropShadow = "url(#drop-shadow)";
        this.nodeShadow = true;
        this.archEdgeColor = "calculated";
        this.archEdgeArrowColor = "calculated";
        this.archEdgeWidth = "3";
        this.archGroupBorderColor = this.primaryBorderColor;
        this.archGroupBorderWidth = "2px";
        this.clusterBkg = "#1E1A2E";
        this.clusterBorder = "#BDBCCC";
        this.noteBorderColor = "#FACC15";
        this.noteFontWeight = 600;
        this.borderColorArray = [
            "#E879F9",
            //Fuchsia-400
            "#2DD4BF",
            //Teal-400
            "#FB923C",
            //Orange-400
            "#22D3EE",
            // Cyan-400
            "#4ADE80",
            // Green-400
            "#A78BFA",
            //Violet-400
            "#F87171",
            //red-400
            "#FACC15",
            //yellow-400
            "#818CF8",
            //indigo-400
            "#A3E635 ",
            //Lime-400
            "#38BDF8",
            //Sky-400
            "#FB7185"
        ];
        this.bkgColorArray = [];
        this.filterColor = "#FFFFFF";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class10, "Theme"), _class10);
var getThemeVariables11 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((userOverrides)=>{
    const theme = new Theme11();
    theme.calculate(userOverrides);
    return theme;
}, "getThemeVariables");
// src/themes/index.js
var themes_default = {
    base: {
        getThemeVariables
    },
    dark: {
        getThemeVariables: getThemeVariables2
    },
    default: {
        getThemeVariables: getThemeVariables3
    },
    forest: {
        getThemeVariables: getThemeVariables4
    },
    neutral: {
        getThemeVariables: getThemeVariables5
    },
    neo: {
        getThemeVariables: getThemeVariables6
    },
    "neo-dark": {
        getThemeVariables: getThemeVariables7
    },
    redux: {
        getThemeVariables: getThemeVariables8
    },
    "redux-dark": {
        getThemeVariables: getThemeVariables9
    },
    "redux-color": {
        getThemeVariables: getThemeVariables10
    },
    "redux-dark-color": {
        getThemeVariables: getThemeVariables11
    }
};
// src/schemas/config.schema.yaml?only-defaults=true
var config_schema_default = {
    "flowchart": {
        "useMaxWidth": true,
        "titleTopMargin": 25,
        "subGraphTitleMargin": {
            "top": 0,
            "bottom": 0
        },
        "diagramPadding": 8,
        "htmlLabels": null,
        "nodeSpacing": 50,
        "rankSpacing": 50,
        "curve": "basis",
        "padding": 15,
        "defaultRenderer": "dagre-wrapper",
        "wrappingWidth": 200,
        "inheritDir": false
    },
    "swimlane": {
        "useMaxWidth": true,
        "lineHops": "arc",
        "ignoreCrossLaneEdges": true,
        "optimizeRanksByCrossings": true,
        "automaticLaneOrdering": false
    },
    "sequence": {
        "useMaxWidth": true,
        "hideUnusedParticipants": false,
        "activationWidth": 10,
        "diagramMarginX": 50,
        "diagramMarginY": 10,
        "actorMargin": 50,
        "width": 150,
        "height": 65,
        "boxMargin": 10,
        "boxTextMargin": 5,
        "noteMargin": 10,
        "messageMargin": 35,
        "messageAlign": "center",
        "mirrorActors": true,
        "forceMenus": false,
        "bottomMarginAdj": 1,
        "rightAngles": false,
        "showSequenceNumbers": false,
        "actorFontSize": 14,
        "actorFontFamily": '"Open Sans", sans-serif',
        "actorFontWeight": 400,
        "noteFontSize": 14,
        "noteFontFamily": '"trebuchet ms", verdana, arial, sans-serif',
        "noteFontWeight": 400,
        "noteAlign": "center",
        "messageFontSize": 16,
        "messageFontFamily": '"trebuchet ms", verdana, arial, sans-serif',
        "messageFontWeight": 400,
        "wrap": false,
        "wrapPadding": 10,
        "labelBoxWidth": 50,
        "labelBoxHeight": 20
    },
    "gantt": {
        "useMaxWidth": true,
        "titleTopMargin": 25,
        "barHeight": 20,
        "barGap": 4,
        "topPadding": 50,
        "rightPadding": 75,
        "leftPadding": 75,
        "gridLineStartPadding": 35,
        "fontSize": 11,
        "sectionFontSize": 11,
        "numberSectionStyles": 4,
        "axisFormat": "%Y-%m-%d",
        "topAxis": false,
        "displayMode": "",
        "weekday": "sunday"
    },
    "journey": {
        "useMaxWidth": true,
        "diagramMarginX": 50,
        "diagramMarginY": 10,
        "leftMargin": 150,
        "maxLabelWidth": 360,
        "width": 150,
        "height": 50,
        "boxMargin": 10,
        "boxTextMargin": 5,
        "noteMargin": 10,
        "messageMargin": 35,
        "messageAlign": "center",
        "bottomMarginAdj": 1,
        "rightAngles": false,
        "taskFontSize": 14,
        "taskFontFamily": '"Open Sans", sans-serif',
        "taskMargin": 50,
        "activationWidth": 10,
        "textPlacement": "fo",
        "actorColours": [
            "#8FBC8F",
            "#7CFC00",
            "#00FFFF",
            "#20B2AA",
            "#B0E0E6",
            "#FFFFE0"
        ],
        "sectionFills": [
            "#191970",
            "#8B008B",
            "#4B0082",
            "#2F4F4F",
            "#800000",
            "#8B4513",
            "#00008B"
        ],
        "sectionColours": [
            "#fff"
        ],
        "titleColor": "",
        "titleFontFamily": '"trebuchet ms", verdana, arial, sans-serif',
        "titleFontSize": "4ex"
    },
    "class": {
        "useMaxWidth": true,
        "titleTopMargin": 25,
        "arrowMarkerAbsolute": false,
        "dividerMargin": 10,
        "padding": 5,
        "textHeight": 10,
        "defaultRenderer": "dagre-wrapper",
        "htmlLabels": false,
        "hideEmptyMembersBox": false,
        "hierarchicalNamespaces": true
    },
    "state": {
        "useMaxWidth": true,
        "titleTopMargin": 25,
        "dividerMargin": 10,
        "sizeUnit": 5,
        "padding": 8,
        "textHeight": 10,
        "titleShift": -15,
        "noteMargin": 10,
        "forkWidth": 70,
        "forkHeight": 7,
        "miniPadding": 2,
        "fontSizeFactor": 5.02,
        "fontSize": 24,
        "labelHeight": 16,
        "edgeLengthFactor": "20",
        "compositTitleSize": 35,
        "radius": 5,
        "defaultRenderer": "dagre-wrapper"
    },
    "er": {
        "useMaxWidth": true,
        "titleTopMargin": 25,
        "diagramPadding": 20,
        "layoutDirection": "TB",
        "minEntityWidth": 100,
        "minEntityHeight": 75,
        "entityPadding": 15,
        "nodeSpacing": 140,
        "rankSpacing": 80,
        "stroke": "gray",
        "fill": "honeydew",
        "fontSize": 12
    },
    "pie": {
        "useMaxWidth": true,
        "textPosition": 0.75,
        "donutHole": 0,
        "legendPosition": "right",
        "highlightSlice": ""
    },
    "quadrantChart": {
        "useMaxWidth": true,
        "chartWidth": 500,
        "chartHeight": 500,
        "titleFontSize": 20,
        "titlePadding": 10,
        "quadrantPadding": 5,
        "xAxisLabelPadding": 5,
        "yAxisLabelPadding": 5,
        "xAxisLabelFontSize": 16,
        "yAxisLabelFontSize": 16,
        "quadrantLabelFontSize": 16,
        "quadrantTextTopPadding": 5,
        "pointTextPadding": 5,
        "pointLabelFontSize": 12,
        "pointRadius": 5,
        "xAxisPosition": "top",
        "yAxisPosition": "left",
        "quadrantInternalBorderStrokeWidth": 1,
        "quadrantExternalBorderStrokeWidth": 2
    },
    "xyChart": {
        "useMaxWidth": true,
        "width": 700,
        "height": 500,
        "titleFontSize": 20,
        "titlePadding": 10,
        "showDataLabel": false,
        "showDataLabelOutsideBar": false,
        "showTitle": true,
        "xAxis": {
            "$ref": "#/$defs/XYChartAxisConfig",
            "showLabel": true,
            "labelFontSize": 14,
            "labelPadding": 5,
            "showTitle": true,
            "titleFontSize": 16,
            "titlePadding": 5,
            "showTick": true,
            "tickLength": 5,
            "tickWidth": 2,
            "showAxisLine": true,
            "axisLineWidth": 2,
            "labelRotation": 0
        },
        "yAxis": {
            "$ref": "#/$defs/XYChartAxisConfig",
            "showLabel": true,
            "labelFontSize": 14,
            "labelPadding": 5,
            "showTitle": true,
            "titleFontSize": 16,
            "titlePadding": 5,
            "showTick": true,
            "tickLength": 5,
            "tickWidth": 2,
            "showAxisLine": true,
            "axisLineWidth": 2,
            "labelRotation": 0
        },
        "chartOrientation": "vertical",
        "plotReservedSpacePercent": 50
    },
    "requirement": {
        "useMaxWidth": true,
        "rect_fill": "#f9f9f9",
        "text_color": "#333",
        "rect_border_size": "0.5px",
        "rect_border_color": "#bbb",
        "rect_min_width": 200,
        "rect_min_height": 200,
        "fontSize": 14,
        "rect_padding": 10,
        "line_height": 20
    },
    "mindmap": {
        "useMaxWidth": true,
        "padding": 10,
        "maxNodeWidth": 200,
        "layoutAlgorithm": "cose-bilkent"
    },
    "ishikawa": {
        "useMaxWidth": true,
        "diagramPadding": 20
    },
    "kanban": {
        "useMaxWidth": true,
        "padding": 8,
        "sectionWidth": 200,
        "ticketBaseUrl": ""
    },
    "timeline": {
        "useMaxWidth": true,
        "diagramMarginX": 50,
        "diagramMarginY": 10,
        "leftMargin": 150,
        "width": 150,
        "height": 50,
        "boxMargin": 10,
        "boxTextMargin": 5,
        "noteMargin": 10,
        "messageMargin": 35,
        "messageAlign": "center",
        "bottomMarginAdj": 1,
        "rightAngles": false,
        "taskFontSize": 14,
        "taskFontFamily": '"Open Sans", sans-serif',
        "taskMargin": 50,
        "activationWidth": 10,
        "textPlacement": "fo",
        "actorColours": [
            "#8FBC8F",
            "#7CFC00",
            "#00FFFF",
            "#20B2AA",
            "#B0E0E6",
            "#FFFFE0"
        ],
        "sectionFills": [
            "#191970",
            "#8B008B",
            "#4B0082",
            "#2F4F4F",
            "#800000",
            "#8B4513",
            "#00008B"
        ],
        "sectionColours": [
            "#fff"
        ],
        "disableMulticolor": false
    },
    "gitGraph": {
        "useMaxWidth": true,
        "titleTopMargin": 25,
        "diagramPadding": 8,
        "nodeLabel": {
            "width": 75,
            "height": 100,
            "x": -25,
            "y": 0
        },
        "mainBranchName": "main",
        "mainBranchOrder": 0,
        "showCommitLabel": true,
        "showBranches": true,
        "rotateCommitLabel": true,
        "parallelCommits": false,
        "arrowMarkerAbsolute": false
    },
    "c4": {
        "useMaxWidth": true,
        "diagramMarginX": 50,
        "diagramMarginY": 10,
        "c4ShapeMargin": 50,
        "c4ShapePadding": 20,
        "width": 216,
        "height": 60,
        "boxMargin": 10,
        "c4ShapeInRow": 4,
        "nextLinePaddingX": 0,
        "c4BoundaryInRow": 2,
        "personFontSize": 14,
        "personFontFamily": '"Open Sans", sans-serif',
        "personFontWeight": "normal",
        "external_personFontSize": 14,
        "external_personFontFamily": '"Open Sans", sans-serif',
        "external_personFontWeight": "normal",
        "systemFontSize": 14,
        "systemFontFamily": '"Open Sans", sans-serif',
        "systemFontWeight": "normal",
        "external_systemFontSize": 14,
        "external_systemFontFamily": '"Open Sans", sans-serif',
        "external_systemFontWeight": "normal",
        "system_dbFontSize": 14,
        "system_dbFontFamily": '"Open Sans", sans-serif',
        "system_dbFontWeight": "normal",
        "external_system_dbFontSize": 14,
        "external_system_dbFontFamily": '"Open Sans", sans-serif',
        "external_system_dbFontWeight": "normal",
        "system_queueFontSize": 14,
        "system_queueFontFamily": '"Open Sans", sans-serif',
        "system_queueFontWeight": "normal",
        "external_system_queueFontSize": 14,
        "external_system_queueFontFamily": '"Open Sans", sans-serif',
        "external_system_queueFontWeight": "normal",
        "boundaryFontSize": 14,
        "boundaryFontFamily": '"Open Sans", sans-serif',
        "boundaryFontWeight": "normal",
        "messageFontSize": 12,
        "messageFontFamily": '"Open Sans", sans-serif',
        "messageFontWeight": "normal",
        "containerFontSize": 14,
        "containerFontFamily": '"Open Sans", sans-serif',
        "containerFontWeight": "normal",
        "external_containerFontSize": 14,
        "external_containerFontFamily": '"Open Sans", sans-serif',
        "external_containerFontWeight": "normal",
        "container_dbFontSize": 14,
        "container_dbFontFamily": '"Open Sans", sans-serif',
        "container_dbFontWeight": "normal",
        "external_container_dbFontSize": 14,
        "external_container_dbFontFamily": '"Open Sans", sans-serif',
        "external_container_dbFontWeight": "normal",
        "container_queueFontSize": 14,
        "container_queueFontFamily": '"Open Sans", sans-serif',
        "container_queueFontWeight": "normal",
        "external_container_queueFontSize": 14,
        "external_container_queueFontFamily": '"Open Sans", sans-serif',
        "external_container_queueFontWeight": "normal",
        "componentFontSize": 14,
        "componentFontFamily": '"Open Sans", sans-serif',
        "componentFontWeight": "normal",
        "external_componentFontSize": 14,
        "external_componentFontFamily": '"Open Sans", sans-serif',
        "external_componentFontWeight": "normal",
        "component_dbFontSize": 14,
        "component_dbFontFamily": '"Open Sans", sans-serif',
        "component_dbFontWeight": "normal",
        "external_component_dbFontSize": 14,
        "external_component_dbFontFamily": '"Open Sans", sans-serif',
        "external_component_dbFontWeight": "normal",
        "component_queueFontSize": 14,
        "component_queueFontFamily": '"Open Sans", sans-serif',
        "component_queueFontWeight": "normal",
        "external_component_queueFontSize": 14,
        "external_component_queueFontFamily": '"Open Sans", sans-serif',
        "external_component_queueFontWeight": "normal",
        "wrap": true,
        "wrapPadding": 10,
        "person_bg_color": "#08427B",
        "person_border_color": "#073B6F",
        "external_person_bg_color": "#686868",
        "external_person_border_color": "#8A8A8A",
        "system_bg_color": "#1168BD",
        "system_border_color": "#3C7FC0",
        "system_db_bg_color": "#1168BD",
        "system_db_border_color": "#3C7FC0",
        "system_queue_bg_color": "#1168BD",
        "system_queue_border_color": "#3C7FC0",
        "external_system_bg_color": "#999999",
        "external_system_border_color": "#8A8A8A",
        "external_system_db_bg_color": "#999999",
        "external_system_db_border_color": "#8A8A8A",
        "external_system_queue_bg_color": "#999999",
        "external_system_queue_border_color": "#8A8A8A",
        "container_bg_color": "#438DD5",
        "container_border_color": "#3C7FC0",
        "container_db_bg_color": "#438DD5",
        "container_db_border_color": "#3C7FC0",
        "container_queue_bg_color": "#438DD5",
        "container_queue_border_color": "#3C7FC0",
        "external_container_bg_color": "#B3B3B3",
        "external_container_border_color": "#A6A6A6",
        "external_container_db_bg_color": "#B3B3B3",
        "external_container_db_border_color": "#A6A6A6",
        "external_container_queue_bg_color": "#B3B3B3",
        "external_container_queue_border_color": "#A6A6A6",
        "component_bg_color": "#85BBF0",
        "component_border_color": "#78A8D8",
        "component_db_bg_color": "#85BBF0",
        "component_db_border_color": "#78A8D8",
        "component_queue_bg_color": "#85BBF0",
        "component_queue_border_color": "#78A8D8",
        "external_component_bg_color": "#CCCCCC",
        "external_component_border_color": "#BFBFBF",
        "external_component_db_bg_color": "#CCCCCC",
        "external_component_db_border_color": "#BFBFBF",
        "external_component_queue_bg_color": "#CCCCCC",
        "external_component_queue_border_color": "#BFBFBF"
    },
    "sankey": {
        "useMaxWidth": true,
        "width": 600,
        "height": 400,
        "linkColor": "gradient",
        "nodeAlignment": "justify",
        "showValues": true,
        "prefix": "",
        "suffix": "",
        "nodeWidth": 10,
        "nodePadding": 12,
        "labelStyle": "legacy"
    },
    "block": {
        "useMaxWidth": true,
        "padding": 8
    },
    "packet": {
        "useMaxWidth": true,
        "rowHeight": 32,
        "bitWidth": 32,
        "bitsPerRow": 32,
        "showBits": true,
        "paddingX": 5,
        "paddingY": 5
    },
    "treeView": {
        "useMaxWidth": true,
        "rowIndent": 10,
        "paddingX": 5,
        "paddingY": 5,
        "lineThickness": 1,
        "showIcons": false,
        "defaultIconPack": "",
        "filenameIcons": {},
        "extensionIcons": {}
    },
    "architecture": {
        "useMaxWidth": true,
        "padding": 40,
        "iconSize": 80,
        "fontSize": 16,
        "randomize": false,
        "nodeSeparation": 75,
        "idealEdgeLengthMultiplier": 1.5,
        "edgeElasticity": 0.45,
        "numIter": 2500,
        "seed": 1
    },
    "eventmodeling": {
        "useMaxWidth": true,
        "padding": 30,
        "rowHeight": 32
    },
    "radar": {
        "useMaxWidth": true,
        "width": 600,
        "height": 600,
        "marginTop": 50,
        "marginRight": 50,
        "marginBottom": 50,
        "marginLeft": 50,
        "axisScaleFactor": 1,
        "axisLabelFactor": 1.05,
        "curveTension": 0.17
    },
    "venn": {
        "useMaxWidth": true,
        "width": 800,
        "height": 450,
        "padding": 8,
        "useDebugLayout": false
    },
    "cynefin": {
        "useMaxWidth": true,
        "width": 800,
        "height": 600,
        "padding": 40,
        "showDomainDescriptions": true,
        "boundaryAmplitude": 8,
        "seed": 0
    },
    "theme": "default",
    "look": "classic",
    "handDrawnSeed": 0,
    "layout": "dagre",
    "maxTextSize": 5e4,
    "maxEdges": 500,
    "darkMode": false,
    "fontFamily": '"trebuchet ms", verdana, arial, sans-serif;',
    "logLevel": 5,
    "securityLevel": "strict",
    "startOnLoad": true,
    "arrowMarkerAbsolute": false,
    "secure": [
        "secure",
        "securityLevel",
        "startOnLoad",
        "maxTextSize",
        "suppressErrorRendering",
        "maxEdges"
    ],
    "legacyMathML": false,
    "forceLegacyMathML": false,
    "deterministicIds": false,
    "fontSize": 16,
    "markdownAutoWrap": true,
    "suppressErrorRendering": false
};
// src/defaultConfig.ts
var config = {
    ...config_schema_default,
    // Set, even though they're `undefined` so that `configKeys` finds these keys
    // TODO: Should we replace these with `null` so that they can go in the JSON Schema?
    deterministicIDSeed: void 0,
    elk: {
        // mergeEdges is needed here to be considered
        mergeEdges: false,
        nodePlacementStrategy: "BRANDES_KOEPF",
        forceNodeModelOrder: false,
        considerModelOrder: "NODES_AND_EDGES"
    },
    themeCSS: void 0,
    // add non-JSON default config values
    themeVariables: themes_default.default.getThemeVariables(),
    sequence: {
        ...config_schema_default.sequence,
        messageFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.messageFontFamily,
                fontSize: this.messageFontSize,
                fontWeight: this.messageFontWeight
            };
        }, "messageFont"),
        noteFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.noteFontFamily,
                fontSize: this.noteFontSize,
                fontWeight: this.noteFontWeight
            };
        }, "noteFont"),
        actorFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.actorFontFamily,
                fontSize: this.actorFontSize,
                fontWeight: this.actorFontWeight
            };
        }, "actorFont")
    },
    class: {
        hideEmptyMembersBox: false,
        hierarchicalNamespaces: true
    },
    gantt: {
        ...config_schema_default.gantt,
        tickInterval: void 0,
        useWidth: void 0
    },
    c4: {
        ...config_schema_default.c4,
        useWidth: void 0,
        personFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.personFontFamily,
                fontSize: this.personFontSize,
                fontWeight: this.personFontWeight
            };
        }, "personFont"),
        flowchart: {
            ...config_schema_default.flowchart,
            inheritDir: false
        },
        external_personFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_personFontFamily,
                fontSize: this.external_personFontSize,
                fontWeight: this.external_personFontWeight
            };
        }, "external_personFont"),
        systemFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.systemFontFamily,
                fontSize: this.systemFontSize,
                fontWeight: this.systemFontWeight
            };
        }, "systemFont"),
        external_systemFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_systemFontFamily,
                fontSize: this.external_systemFontSize,
                fontWeight: this.external_systemFontWeight
            };
        }, "external_systemFont"),
        system_dbFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.system_dbFontFamily,
                fontSize: this.system_dbFontSize,
                fontWeight: this.system_dbFontWeight
            };
        }, "system_dbFont"),
        external_system_dbFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_system_dbFontFamily,
                fontSize: this.external_system_dbFontSize,
                fontWeight: this.external_system_dbFontWeight
            };
        }, "external_system_dbFont"),
        system_queueFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.system_queueFontFamily,
                fontSize: this.system_queueFontSize,
                fontWeight: this.system_queueFontWeight
            };
        }, "system_queueFont"),
        external_system_queueFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_system_queueFontFamily,
                fontSize: this.external_system_queueFontSize,
                fontWeight: this.external_system_queueFontWeight
            };
        }, "external_system_queueFont"),
        containerFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.containerFontFamily,
                fontSize: this.containerFontSize,
                fontWeight: this.containerFontWeight
            };
        }, "containerFont"),
        external_containerFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_containerFontFamily,
                fontSize: this.external_containerFontSize,
                fontWeight: this.external_containerFontWeight
            };
        }, "external_containerFont"),
        container_dbFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.container_dbFontFamily,
                fontSize: this.container_dbFontSize,
                fontWeight: this.container_dbFontWeight
            };
        }, "container_dbFont"),
        external_container_dbFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_container_dbFontFamily,
                fontSize: this.external_container_dbFontSize,
                fontWeight: this.external_container_dbFontWeight
            };
        }, "external_container_dbFont"),
        container_queueFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.container_queueFontFamily,
                fontSize: this.container_queueFontSize,
                fontWeight: this.container_queueFontWeight
            };
        }, "container_queueFont"),
        external_container_queueFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_container_queueFontFamily,
                fontSize: this.external_container_queueFontSize,
                fontWeight: this.external_container_queueFontWeight
            };
        }, "external_container_queueFont"),
        componentFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.componentFontFamily,
                fontSize: this.componentFontSize,
                fontWeight: this.componentFontWeight
            };
        }, "componentFont"),
        external_componentFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_componentFontFamily,
                fontSize: this.external_componentFontSize,
                fontWeight: this.external_componentFontWeight
            };
        }, "external_componentFont"),
        component_dbFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.component_dbFontFamily,
                fontSize: this.component_dbFontSize,
                fontWeight: this.component_dbFontWeight
            };
        }, "component_dbFont"),
        external_component_dbFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_component_dbFontFamily,
                fontSize: this.external_component_dbFontSize,
                fontWeight: this.external_component_dbFontWeight
            };
        }, "external_component_dbFont"),
        component_queueFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.component_queueFontFamily,
                fontSize: this.component_queueFontSize,
                fontWeight: this.component_queueFontWeight
            };
        }, "component_queueFont"),
        external_component_queueFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.external_component_queueFontFamily,
                fontSize: this.external_component_queueFontSize,
                fontWeight: this.external_component_queueFontWeight
            };
        }, "external_component_queueFont"),
        boundaryFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.boundaryFontFamily,
                fontSize: this.boundaryFontSize,
                fontWeight: this.boundaryFontWeight
            };
        }, "boundaryFont"),
        messageFont: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
            return {
                fontFamily: this.messageFontFamily,
                fontSize: this.messageFontSize,
                fontWeight: this.messageFontWeight
            };
        }, "messageFont")
    },
    pie: {
        ...config_schema_default.pie,
        useWidth: 984
    },
    xyChart: {
        ...config_schema_default.xyChart,
        useWidth: void 0
    },
    requirement: {
        ...config_schema_default.requirement,
        useWidth: void 0
    },
    packet: {
        ...config_schema_default.packet
    },
    eventmodeling: {
        ...config_schema_default.eventmodeling
    },
    treeView: {
        ...config_schema_default.treeView,
        useWidth: void 0
    },
    radar: {
        ...config_schema_default.radar
    },
    railroad: {
        ...config_schema_default.railroad,
        // Railroad colors and typography derive from the active theme unless explicitly overridden.
        fontSize: void 0,
        fontFamily: void 0,
        terminalFill: void 0,
        terminalStroke: void 0,
        terminalTextColor: void 0,
        nonTerminalFill: void 0,
        nonTerminalStroke: void 0,
        nonTerminalTextColor: void 0,
        lineColor: void 0,
        markerFill: void 0,
        commentFill: void 0,
        commentStroke: void 0,
        commentTextColor: void 0,
        specialFill: void 0,
        specialStroke: void 0,
        ruleNameColor: void 0
    },
    ishikawa: {
        ...config_schema_default.ishikawa
    },
    sankey: {
        ...config_schema_default.sankey,
        // Set so that `configKeys` includes this key for sanitizeDirective
        nodeColors: void 0
    },
    treemap: {
        useMaxWidth: true,
        padding: 10,
        diagramPadding: 8,
        showValues: true,
        nodeWidth: 100,
        nodeHeight: 40,
        borderWidth: 1,
        valueFontSize: 12,
        labelFontSize: 14,
        valueFormat: ","
    },
    venn: {
        ...config_schema_default.venn
    },
    cynefin: {
        ...config_schema_default.cynefin
    }
};
var keyify = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(obj) {
    let prefix = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
    return Object.keys(obj).reduce((res, el)=>{
        if (Array.isArray(obj[el])) {
            return res;
        } else if (typeof obj[el] === "object" && obj[el] !== null) {
            return [
                ...res,
                prefix + el,
                ...keyify(obj[el], "")
            ];
        }
        return [
            ...res,
            prefix + el
        ];
    }, []);
}, "keyify");
var configKeys = new Set(keyify(config, ""));
var defaultConfig_default = config;
// src/utils/sanitizeDirective.ts
var DICTIONARY_CONFIG_PATTERNS = {
    // CSS colors (sankey)
    nodeColors: /^#[\da-f]{3,8}$|^rgb\([\d\s%,.]+\)$|^hsl\([\d\s%,.]+\)$|^[a-z]+$/i,
    // iconify icon references (treeView filenameIcons/extensionIcons)
    filenameIcons: /^[\w-]+(?::[\w-]+)?$/,
    extensionIcons: /^[\w-]+(?::[\w-]+)?$/
};
var sanitizeDictionaryConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((dict, valuePattern)=>{
    for (const key of Object.keys(dict)){
        const value = dict[key];
        if (key.startsWith("__") || key.includes("proto") || key.includes("constr") || typeof value !== "string" || !valuePattern.test(value)) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("sanitize deleting dictionary entry:", key, value);
            delete dict[key];
        }
    }
}, "sanitizeDictionaryConfig");
var sanitizeDirective = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((args)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("sanitizeDirective called with", args);
    if (typeof args !== "object" || args == null) {
        return;
    }
    if (Array.isArray(args)) {
        args.forEach((arg)=>sanitizeDirective(arg));
        return;
    }
    for (const key of Object.keys(args)){
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Checking key", key);
        if (key.startsWith("__") || key.includes("proto") || key.includes("constr") || !configKeys.has(key) || args[key] == null) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("sanitize deleting key: ", key);
            delete args[key];
            continue;
        }
        if (typeof args[key] === "object") {
            const valuePattern = DICTIONARY_CONFIG_PATTERNS[key];
            if (valuePattern) {
                sanitizeDictionaryConfig(args[key], valuePattern);
            } else {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("sanitizing object", key);
                sanitizeDirective(args[key]);
            }
            continue;
        }
        const cssMatchers = [
            "themeCSS",
            "fontFamily",
            "altFontFamily"
        ];
        for (const cssKey of cssMatchers){
            if (key.includes(cssKey)) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("sanitizing css option", key);
                args[key] = sanitizeCss(args[key]);
            }
        }
    }
    if (args.themeVariables) {
        for (const k of Object.keys(args.themeVariables)){
            const val = args.themeVariables[k];
            if ((val === null || val === void 0 ? void 0 : val.match) && !val.match(/^[\d "#%(),.;A-Za-z]+$/)) {
                args.themeVariables[k] = "";
            }
        }
    }
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("After sanitization", args);
}, "sanitizeDirective");
var sanitizeCss = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((str)=>{
    let startCnt = 0;
    let endCnt = 0;
    for (const element of str){
        if (startCnt < endCnt) {
            return "{ /* ERROR: Unbalanced CSS */ }";
        }
        if (element === "{") {
            startCnt++;
        } else if (element === "}") {
            endCnt++;
        }
    }
    if (startCnt !== endCnt) {
        return "{ /* ERROR: Unbalanced CSS */ }";
    }
    return str;
}, "sanitizeCss");
// src/config.ts
var defaultConfig = Object.freeze(defaultConfig_default);
var evaluate = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((val)=>val === false || [
        "false",
        "null",
        "0"
    ].includes(String(val).trim().toLowerCase()) ? false : true, "evaluate");
var siteConfig = assignWithDepth_default({}, defaultConfig);
var configFromInitialize;
var directives = [];
var currentConfig = assignWithDepth_default({}, defaultConfig);
var updateCurrentConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((siteCfg, _directives)=>{
    let cfg = assignWithDepth_default({}, siteCfg);
    let sumOfDirectives = {};
    for (const d of _directives){
        sanitize(d);
        sumOfDirectives = assignWithDepth_default(sumOfDirectives, d);
    }
    cfg = assignWithDepth_default(cfg, sumOfDirectives);
    if (sumOfDirectives.theme && sumOfDirectives.theme in themes_default) {
        const tmpConfigFromInitialize = assignWithDepth_default({}, configFromInitialize);
        const themeVariables = assignWithDepth_default(tmpConfigFromInitialize.themeVariables || {}, sumOfDirectives.themeVariables);
        if (cfg.theme && cfg.theme in themes_default) {
            cfg.themeVariables = themes_default[cfg.theme].getThemeVariables(themeVariables);
        }
    }
    currentConfig = cfg;
    checkConfig(currentConfig);
    return currentConfig;
}, "updateCurrentConfig");
var setSiteConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((conf)=>{
    siteConfig = assignWithDepth_default({}, defaultConfig);
    siteConfig = assignWithDepth_default(siteConfig, conf);
    if (conf.theme && themes_default[conf.theme]) {
        siteConfig.themeVariables = themes_default[conf.theme].getThemeVariables(conf.themeVariables);
    }
    updateCurrentConfig(siteConfig, directives);
    return siteConfig;
}, "setSiteConfig");
var saveConfigFromInitialize = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((conf)=>{
    configFromInitialize = assignWithDepth_default({}, conf);
}, "saveConfigFromInitialize");
var updateSiteConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((conf)=>{
    siteConfig = assignWithDepth_default(siteConfig, conf);
    updateCurrentConfig(siteConfig, directives);
    return siteConfig;
}, "updateSiteConfig");
var getSiteConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return assignWithDepth_default({}, siteConfig);
}, "getSiteConfig");
var setConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((conf)=>{
    checkConfig(conf);
    assignWithDepth_default(currentConfig, conf);
    return getConfig();
}, "setConfig");
var getConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return assignWithDepth_default({}, currentConfig);
}, "getConfig");
var sanitize = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    if (!options) {
        return;
    }
    var _siteConfig_secure;
    [
        "secure",
        ...(_siteConfig_secure = siteConfig.secure) !== null && _siteConfig_secure !== void 0 ? _siteConfig_secure : []
    ].forEach((key)=>{
        if (Object.hasOwn(options, key)) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Denied attempt to modify a secure key ".concat(key), options[key]);
            delete options[key];
        }
    });
    Object.keys(options).forEach((key)=>{
        if (key.startsWith("__")) {
            delete options[key];
        }
    });
    Object.keys(options).forEach((key)=>{
        if (typeof options[key] === "string" && (options[key].includes("<") || options[key].includes(">") || options[key].includes("url(data:"))) {
            delete options[key];
        }
        if (typeof options[key] === "object") {
            sanitize(options[key]);
        }
    });
}, "sanitize");
var addDirective = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((directive)=>{
    var _directive_themeVariables;
    sanitizeDirective(directive);
    if (directive.fontFamily && !((_directive_themeVariables = directive.themeVariables) === null || _directive_themeVariables === void 0 ? void 0 : _directive_themeVariables.fontFamily)) {
        directive.themeVariables = {
            ...directive.themeVariables,
            fontFamily: directive.fontFamily
        };
    }
    directives.push(directive);
    updateCurrentConfig(siteConfig, directives);
}, "addDirective");
var reset = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    let config2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : siteConfig;
    directives = [];
    updateCurrentConfig(config2, directives);
}, "reset");
var ConfigWarning = {
    LAZY_LOAD_DEPRECATED: "The configuration options lazyLoadedDiagrams and loadExternalDiagramsAtStartup are deprecated. Please use registerExternalDiagrams instead.",
    FLOWCHART_HTML_LABELS_DEPRECATED: "flowchart.htmlLabels is deprecated. Please use global htmlLabels instead."
};
var issuedWarnings = {};
var issueWarning = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((warning)=>{
    if (issuedWarnings[warning]) {
        return;
    }
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn(ConfigWarning[warning]);
    issuedWarnings[warning] = true;
}, "issueWarning");
var checkConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((config2)=>{
    if (!config2) {
        return;
    }
    if (config2.lazyLoadedDiagrams || config2.loadExternalDiagramsAtStartup) {
        issueWarning("LAZY_LOAD_DEPRECATED");
    }
}, "checkConfig");
var getUserDefinedConfig = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    let userConfig = {};
    if (configFromInitialize) {
        userConfig = assignWithDepth_default(userConfig, configFromInitialize);
    }
    for (const d of directives){
        userConfig = assignWithDepth_default(userConfig, d);
    }
    return userConfig;
}, "getUserDefinedConfig");
var getEffectiveHtmlLabels = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((config2)=>{
    var _config2_flowchart, _config2_flowchart1;
    if (((_config2_flowchart = config2.flowchart) === null || _config2_flowchart === void 0 ? void 0 : _config2_flowchart.htmlLabels) != void 0) {
        issueWarning("FLOWCHART_HTML_LABELS_DEPRECATED");
    }
    var _config2_htmlLabels, _ref;
    return evaluate((_ref = (_config2_htmlLabels = config2.htmlLabels) !== null && _config2_htmlLabels !== void 0 ? _config2_htmlLabels : (_config2_flowchart1 = config2.flowchart) === null || _config2_flowchart1 === void 0 ? void 0 : _config2_flowchart1.htmlLabels) !== null && _ref !== void 0 ? _ref : true);
}, "getEffectiveHtmlLabels");
// src/diagram-api/regexes.ts
var frontMatterRegex = RegExp("^([^\\S\\n\\r]*)-{3}\\s*[\\n\\r](.*?)[\\n\\r]\\1-{3}\\s*[\\n\\r]+", "s");
var directiveRegex = /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi;
var anyCommentRegex = /\s*%%.*\n/gm;
// src/errors.ts
var UnknownDiagramError = (_class11 = class extends Error {
    constructor(message){
        super(message);
        this.name = "UnknownDiagramError";
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class11, "UnknownDiagramError"), _class11);
// src/diagram-api/detectType.ts
var detectors = {};
var detectType = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(text, config2) {
    text = text.replace(frontMatterRegex, "").replace(directiveRegex, "").replace(anyCommentRegex, "\n");
    for (const [key, { detector }] of Object.entries(detectors)){
        const diagram = detector(text, config2);
        if (diagram) {
            return key;
        }
    }
    throw new UnknownDiagramError("No diagram type detected matching given configuration for text: ".concat(text));
}, "detectType");
var registerLazyLoadedDiagrams = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    for(var _len = arguments.length, diagrams2 = new Array(_len), _key = 0; _key < _len; _key++){
        diagrams2[_key] = arguments[_key];
    }
    for (const { id, detector, loader } of diagrams2){
        addDetector(id, detector, loader);
    }
}, "registerLazyLoadedDiagrams");
var addDetector = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((key, detector, loader)=>{
    if (detectors[key]) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("Detector with key ".concat(key, " already exists. Overwriting."));
    }
    detectors[key] = {
        detector,
        loader
    };
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Detector with key ".concat(key, " added").concat(loader ? " with loader" : ""));
}, "addDetector");
var getDiagramLoader = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((key)=>{
    return detectors[key].loader;
}, "getDiagramLoader");
;
var lineBreakRegex = /<br\s*\/?>/gi;
var getRows = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((s)=>{
    if (!s) {
        return [
            ""
        ];
    }
    const str = breakToPlaceholder(s).replace(/\\n/g, "#br#");
    return str.split("#br#");
}, "getRows");
var setupDompurifyHooksIfNotSetup = /* @__PURE__ */ (()=>{
    let setup = false;
    return ()=>{
        if (!setup) {
            setupDompurifyHooks();
            setup = true;
        }
    };
})();
function setupDompurifyHooks() {
    const TEMPORARY_ATTRIBUTE = "data-temp-href-target";
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dompurify$40$3$2e$4$2e$11$2f$node_modules$2f$dompurify$2f$dist$2f$purify$2e$es$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].addHook("beforeSanitizeAttributes", (node)=>{
        if (node.tagName === "A" && node.hasAttribute("target")) {
            var _node_getAttribute;
            node.setAttribute(TEMPORARY_ATTRIBUTE, (_node_getAttribute = node.getAttribute("target")) !== null && _node_getAttribute !== void 0 ? _node_getAttribute : "");
        }
    });
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dompurify$40$3$2e$4$2e$11$2f$node_modules$2f$dompurify$2f$dist$2f$purify$2e$es$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].addHook("afterSanitizeAttributes", (node)=>{
        if (node.tagName === "A" && node.hasAttribute(TEMPORARY_ATTRIBUTE)) {
            var _node_getAttribute;
            node.setAttribute("target", (_node_getAttribute = node.getAttribute(TEMPORARY_ATTRIBUTE)) !== null && _node_getAttribute !== void 0 ? _node_getAttribute : "");
            node.removeAttribute(TEMPORARY_ATTRIBUTE);
            if (node.getAttribute("target") === "_blank") {
                node.setAttribute("rel", "noopener");
            }
        }
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(setupDompurifyHooks, "setupDompurifyHooks");
var removeScript = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((txt)=>{
    setupDompurifyHooksIfNotSetup();
    const sanitizedText = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dompurify$40$3$2e$4$2e$11$2f$node_modules$2f$dompurify$2f$dist$2f$purify$2e$es$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].sanitize(txt);
    return sanitizedText;
}, "removeScript");
var sanitizeMore = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text, config2)=>{
    if (getEffectiveHtmlLabels(config2)) {
        const level = config2.securityLevel;
        if (level === "antiscript" || level === "strict" || level === "sandbox") {
            text = removeScript(text);
        } else if (level !== "loose") {
            text = breakToPlaceholder(text);
            text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            text = text.replace(/=/g, "&equals;");
            text = placeholderToBreak(text);
        }
    }
    return text;
}, "sanitizeMore");
var sanitizeText = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text, config2)=>{
    if (!text) {
        return text;
    }
    if (config2.dompurifyConfig) {
        text = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dompurify$40$3$2e$4$2e$11$2f$node_modules$2f$dompurify$2f$dist$2f$purify$2e$es$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].sanitize(sanitizeMore(text, config2), config2.dompurifyConfig).toString();
    } else {
        text = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$dompurify$40$3$2e$4$2e$11$2f$node_modules$2f$dompurify$2f$dist$2f$purify$2e$es$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].sanitize(sanitizeMore(text, config2), {
            FORBID_TAGS: [
                "style"
            ]
        }).toString();
    }
    return text;
}, "sanitizeText");
var sanitizeTextOrArray = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((a, config2)=>{
    if (typeof a === "string") {
        return sanitizeText(a, config2);
    }
    return a.flat().map((x)=>sanitizeText(x, config2));
}, "sanitizeTextOrArray");
var hasBreaks = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>{
    return lineBreakRegex.test(text);
}, "hasBreaks");
var splitBreaks = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>{
    return text.split(lineBreakRegex);
}, "splitBreaks");
var placeholderToBreak = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((s)=>{
    return s.replace(/#br#/g, "<br/>");
}, "placeholderToBreak");
var breakToPlaceholder = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((s)=>{
    return s.replace(lineBreakRegex, "#br#");
}, "breakToPlaceholder");
var getUrl = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((useAbsolute)=>{
    let url = "";
    if (useAbsolute) {
        url = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search;
        url = CSS.escape(url);
    }
    return url;
}, "getUrl");
var getMax = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    for(var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++){
        values[_key] = arguments[_key];
    }
    const newValues = values.filter((value)=>{
        return !isNaN(value);
    });
    return Math.max(...newValues);
}, "getMax");
var getMin = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    for(var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++){
        values[_key] = arguments[_key];
    }
    const newValues = values.filter((value)=>{
        return !isNaN(value);
    });
    return Math.min(...newValues);
}, "getMin");
var parseGenericTypes = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(input) {
    const inputSets = input.split(/(,)/);
    const output = [];
    for(let i = 0; i < inputSets.length; i++){
        let thisSet = inputSets[i];
        if (thisSet === "," && i > 0 && i + 1 < inputSets.length) {
            const previousSet = inputSets[i - 1];
            const nextSet = inputSets[i + 1];
            if (shouldCombineSets(previousSet, nextSet)) {
                thisSet = previousSet + "," + nextSet;
                i++;
                output.pop();
            }
        }
        output.push(processSet(thisSet));
    }
    return output.join("");
}, "parseGenericTypes");
var countOccurrence = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((string, substring)=>{
    return Math.max(0, string.split(substring).length - 1);
}, "countOccurrence");
var shouldCombineSets = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((previousSet, nextSet)=>{
    const prevCount = countOccurrence(previousSet, "~");
    const nextCount = countOccurrence(nextSet, "~");
    return prevCount === 1 && nextCount === 1;
}, "shouldCombineSets");
var processSet = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((input)=>{
    const tildeCount = countOccurrence(input, "~");
    let hasStartingTilde = false;
    if (tildeCount <= 1) {
        return input;
    }
    if (tildeCount % 2 !== 0 && input.startsWith("~")) {
        input = input.substring(1);
        hasStartingTilde = true;
    }
    const chars = [
        ...input
    ];
    let first = chars.indexOf("~");
    let last = chars.lastIndexOf("~");
    while(first !== -1 && last !== -1 && first !== last){
        chars[first] = "<";
        chars[last] = ">";
        first = chars.indexOf("~");
        last = chars.lastIndexOf("~");
    }
    if (hasStartingTilde) {
        chars.unshift("~");
    }
    return chars.join("");
}, "processSet");
var isMathMLSupported = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>window.MathMLElement !== void 0, "isMathMLSupported");
var katexRegex = /\$\$(.*?)\$\$/g;
var hasKatex = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>{
    var _text_match;
    var _text_match_length;
    return ((_text_match_length = (_text_match = text.match(katexRegex)) === null || _text_match === void 0 ? void 0 : _text_match.length) !== null && _text_match_length !== void 0 ? _text_match_length : 0) > 0;
}, "hasKatex");
var calculateMathMLDimensions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (text, config2)=>{
    const divElem = document.createElement("div");
    divElem.innerHTML = await renderKatexSanitized(text, config2);
    divElem.id = "katex-temp";
    divElem.style.visibility = "hidden";
    divElem.style.position = "absolute";
    divElem.style.top = "0";
    const body = document.querySelector("body");
    body === null || body === void 0 ? void 0 : body.insertAdjacentElement("beforeend", divElem);
    const dim = {
        width: divElem.clientWidth,
        height: divElem.clientHeight
    };
    divElem.remove();
    return dim;
}, "calculateMathMLDimensions");
var renderKatexUnsanitized = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (text, config2)=>{
    if (!hasKatex(text)) {
        return text;
    }
    if (!(isMathMLSupported() || config2.legacyMathML || config2.forceLegacyMathML)) {
        return text.replace(katexRegex, "MathML is unsupported in this environment.");
    }
    if ("TURBOPACK compile-time truthy", 1) {
        const { default: katex } = await __turbopack_context__.A("[project]/node_modules/.pnpm/katex@0.16.47/node_modules/katex/dist/katex.mjs [app-client] (ecmascript, async loader)");
        const outputMode = config2.forceLegacyMathML || !isMathMLSupported() && config2.legacyMathML ? "htmlAndMathml" : "mathml";
        return text.split(lineBreakRegex).map((line)=>hasKatex(line) ? '<div style="display: flex; align-items: center; justify-content: center; white-space: nowrap;">'.concat(line, "</div>") : "<div>".concat(line, "</div>")).join("").replace(katexRegex, (_, c)=>katex.renderToString(c, {
                throwOnError: true,
                displayMode: true,
                output: outputMode
            }).replace(/\n/g, " ").replace(/<annotation.*<\/annotation>/g, ""));
    }
    //TURBOPACK unreachable
    ;
}, "renderKatexUnsanitized");
var renderKatexSanitized = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (text, config2)=>{
    return sanitizeText(await renderKatexUnsanitized(text, config2), config2);
}, "renderKatexSanitized");
var common_default = {
    getRows,
    sanitizeText,
    sanitizeTextOrArray,
    hasBreaks,
    splitBreaks,
    lineBreakRegex,
    removeScript,
    getUrl,
    evaluate,
    getMax,
    getMin
};
// src/setupGraphViewbox.js
var d3Attrs = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(d3Elem, attrs) {
    for (let attr of attrs){
        d3Elem.attr(attr[0], attr[1]);
    }
}, "d3Attrs");
var calculateSvgSizeAttrs = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(height, width, useMaxWidth) {
    let attrs = /* @__PURE__ */ new Map();
    if (useMaxWidth) {
        attrs.set("width", "100%");
        attrs.set("style", "max-width: ".concat(width, "px;"));
    } else {
        attrs.set("height", height);
        attrs.set("width", width);
    }
    return attrs;
}, "calculateSvgSizeAttrs");
var configureSvgSize = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(svgElem, height, width, useMaxWidth) {
    const attrs = calculateSvgSizeAttrs(height, width, useMaxWidth);
    d3Attrs(svgElem, attrs);
}, "configureSvgSize");
var setupGraphViewbox = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(graph, svgElem, padding, useMaxWidth) {
    const svgBounds = svgElem.node().getBBox();
    const sWidth = svgBounds.width;
    const sHeight = svgBounds.height;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("SVG bounds: ".concat(sWidth, "x").concat(sHeight), svgBounds);
    let width = 0;
    let height = 0;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("Graph bounds: ".concat(width, "x").concat(height), graph);
    width = sWidth + padding * 2;
    height = sHeight + padding * 2;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("Calculated bounds: ".concat(width, "x").concat(height));
    configureSvgSize(svgElem, height, width, useMaxWidth);
    const vBox = "".concat(svgBounds.x - padding, " ").concat(svgBounds.y - padding, " ").concat(svgBounds.width + 2 * padding, " ").concat(svgBounds.height + 2 * padding);
    svgElem.attr("viewBox", vBox);
}, "setupGraphViewbox");
// src/styles.ts
var themes = {};
function cssStyleSheetToString(cssStyleSheet) {
    return [
        ...cssStyleSheet.cssRules
    ].map((rule)=>rule.cssText).join("\n");
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(cssStyleSheetToString, "cssStyleSheetToString");
var getStyles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((type, userStyles, options, svgId)=>{
    let diagramStyles = "";
    if (type in themes && themes[type]) {
        diagramStyles = themes[type]({
            ...options,
            svgId
        });
    } else {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("No theme found for ".concat(type));
    }
    var _options_strokeWidth, _options_strokeWidth1;
    return " & {\n    font-family: ".concat(options.fontFamily, ";\n    font-size: ").concat(options.fontSize, ";\n    fill: ").concat(options.textColor, "\n  }\n  @keyframes edge-animation-frame {\n    from {\n      stroke-dashoffset: 0;\n    }\n  }\n  @keyframes dash {\n    to {\n      stroke-dashoffset: 0;\n    }\n  }\n  & .edge-animation-slow {\n    stroke-dasharray: 9,5 !important;\n    stroke-dashoffset: 900;\n    animation: dash 50s linear infinite;\n    stroke-linecap: round;\n  }\n  & .edge-animation-fast {\n    stroke-dasharray: 9,5 !important;\n    stroke-dashoffset: 900;\n    animation: dash 20s linear infinite;\n    stroke-linecap: round;\n  }\n  /* Classes common for multiple diagrams */\n\n  & .error-icon {\n    fill: ").concat(options.errorBkgColor, ";\n  }\n  & .error-text {\n    fill: ").concat(options.errorTextColor, ";\n    stroke: ").concat(options.errorTextColor, ";\n  }\n\n  & .edge-thickness-normal {\n    stroke-width: ").concat((_options_strokeWidth = options.strokeWidth) !== null && _options_strokeWidth !== void 0 ? _options_strokeWidth : 1, "px;\n  }\n  & .edge-thickness-thick {\n    stroke-width: 3.5px\n  }\n  & .edge-pattern-solid {\n    stroke-dasharray: 0;\n  }\n  & .edge-thickness-invisible {\n    stroke-width: 0;\n    fill: none;\n  }\n  & .edge-pattern-dashed{\n    stroke-dasharray: 3;\n  }\n  .edge-pattern-dotted {\n    stroke-dasharray: 2;\n  }\n\n  & .marker {\n    fill: ").concat(options.lineColor, ";\n    stroke: ").concat(options.lineColor, ";\n  }\n  & .marker.cross {\n    stroke: ").concat(options.lineColor, ";\n  }\n\n  & svg {\n    font-family: ").concat(options.fontFamily, ";\n    font-size: ").concat(options.fontSize, ";\n  }\n   & p {\n    margin: 0\n   }\n\n  ").concat(diagramStyles, "\n  .node .neo-node {\n    stroke: ").concat(options.nodeBorder, ';\n  }\n\n  [data-look="neo"].node rect, [data-look="neo"].cluster rect, [data-look="neo"].node polygon {\n    stroke: ').concat(options.useGradient ? "url(" + svgId + "-gradient)" : options.nodeBorder, ";\n    filter: ").concat(options.dropShadow ? options.dropShadow.replace("url(#drop-shadow)", "url(".concat(svgId, "-drop-shadow)")) : "none", ';\n  }\n  [data-look="neo"].swimlane.cluster rect {\n    filter: none;\n  }\n\n\n  [data-look="neo"].node path {\n    stroke: ').concat(options.useGradient ? "url(" + svgId + "-gradient)" : options.nodeBorder, ";\n    stroke-width: ").concat((_options_strokeWidth1 = options.strokeWidth) !== null && _options_strokeWidth1 !== void 0 ? _options_strokeWidth1 : 1, 'px;\n  }\n\n  [data-look="neo"].node .outer-path {\n    filter: ').concat(options.dropShadow ? options.dropShadow.replace("url(#drop-shadow)", "url(".concat(svgId, "-drop-shadow)")) : "none", ';\n  }\n\n  [data-look="neo"].node .neo-line path {\n    stroke: ').concat(options.nodeBorder, ';\n    filter: none;\n  }\n\n  [data-look="neo"].node circle{\n    stroke: ').concat(options.useGradient ? "url(" + svgId + "-gradient)" : options.nodeBorder, ";\n    filter: ").concat(options.dropShadow ? options.dropShadow.replace("url(#drop-shadow)", "url(".concat(svgId, "-drop-shadow)")) : "none", ';\n  }\n\n  [data-look="neo"].node circle .state-start{\n    fill: #000000;\n  }\n\n  [data-look="neo"].icon-shape .icon {\n    fill: ').concat(options.useGradient ? "url(" + svgId + "-gradient)" : options.nodeBorder, ";\n    filter: ").concat(options.dropShadow ? options.dropShadow.replace("url(#drop-shadow)", "url(".concat(svgId, "-drop-shadow)")) : "none", ';\n  }\n\n    [data-look="neo"].icon-shape .icon-neo path {\n    stroke: ').concat(options.useGradient ? "url(" + svgId + "-gradient)" : options.nodeBorder, ";\n    filter: ").concat(options.dropShadow ? options.dropShadow.replace("url(#drop-shadow)", "url(".concat(svgId, "-drop-shadow)")) : "none", ";\n  }\n\n  ").concat(userStyles, "\n");
}, "getStyles");
var addStylesForDiagram = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((type, diagramTheme)=>{
    if (diagramTheme !== void 0) {
        themes[type] = diagramTheme;
    }
}, "addStylesForDiagram");
var styles_default = getStyles;
// src/diagrams/common/commonDb.ts
var commonDb_exports = {};
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__export"])(commonDb_exports, {
    clear: ()=>clear,
    getAccDescription: ()=>getAccDescription,
    getAccTitle: ()=>getAccTitle,
    getDiagramTitle: ()=>getDiagramTitle,
    setAccDescription: ()=>setAccDescription,
    setAccTitle: ()=>setAccTitle,
    setDiagramTitle: ()=>setDiagramTitle
});
var accTitle = "";
var diagramTitle = "";
var accDescription = "";
var sanitizeText2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((txt)=>sanitizeText(txt, getConfig()), "sanitizeText");
var clear = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    accTitle = "";
    accDescription = "";
    diagramTitle = "";
}, "clear");
var setAccTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((txt)=>{
    accTitle = sanitizeText2(txt).replace(/^\s+/g, "");
}, "setAccTitle");
var getAccTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>accTitle, "getAccTitle");
var setAccDescription = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((txt)=>{
    accDescription = sanitizeText2(txt).replace(/\n\s+/g, "\n");
}, "setAccDescription");
var getAccDescription = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>accDescription, "getAccDescription");
var setDiagramTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((txt)=>{
    diagramTitle = sanitizeText2(txt);
}, "setDiagramTitle");
var getDiagramTitle = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>diagramTitle, "getDiagramTitle");
// src/diagram-api/diagramAPI.ts
var log2 = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"];
var setLogLevel2 = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setLogLevel"];
var getConfig2 = getConfig;
var setConfig2 = setConfig;
var defaultConfig2 = defaultConfig;
var sanitizeText3 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((text)=>sanitizeText(text, getConfig2()), "sanitizeText");
var setupGraphViewbox2 = setupGraphViewbox;
var getCommonDb = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return commonDb_exports;
}, "getCommonDb");
var diagrams = {};
var registerDiagram = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((id, diagram, detector)=>{
    var _diagram_injectUtils;
    if (diagrams[id]) {
        log2.warn("Diagram with id ".concat(id, " already registered. Overwriting."));
    }
    diagrams[id] = diagram;
    if (detector) {
        addDetector(id, detector);
    }
    addStylesForDiagram(id, diagram.styles);
    (_diagram_injectUtils = diagram.injectUtils) === null || _diagram_injectUtils === void 0 ? void 0 : _diagram_injectUtils.call(diagram, log2, setLogLevel2, getConfig2, sanitizeText3, setupGraphViewbox2, getCommonDb(), ()=>{});
}, "registerDiagram");
var getDiagram = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((name)=>{
    if (name in diagrams) {
        return diagrams[name];
    }
    throw new DiagramNotFoundError(name);
}, "getDiagram");
var DiagramNotFoundError = (_class12 = class extends Error {
    constructor(name){
        super("Diagram ".concat(name, " not found."));
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class12, "DiagramNotFoundError"), _class12);
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_chunk-WYO6CB5R_mjs_e1b60794._.js.map