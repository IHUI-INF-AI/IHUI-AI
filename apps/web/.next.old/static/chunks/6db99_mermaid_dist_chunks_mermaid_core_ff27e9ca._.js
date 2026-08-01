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
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/diagram-FQU43EPY.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "diagram",
    ()=>diagram
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-JWPE2WC7.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/diagrams/eventmodeling/parser.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs [app-client] (ecmascript) <locals>");
// src/diagrams/eventmodeling/db.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$chunks$2f$mermaid$2d$parser$2e$core$2f$chunk$2d$KEIR6QF5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-KEIR6QF5.mjs [app-client] (ecmascript)");
// src/diagrams/eventmodeling/renderer.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$40$7$2e$9$2e$0$2f$node_modules$2f$d3$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3@7.9.0/node_modules/d3/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/select.js [app-client] (ecmascript) <export default as select>");
;
;
;
;
;
;
;
// src/diagrams/eventmodeling/types.ts
var PositionFrameKind = "position frame";
var FramePositionedKind = "frame positioned";
var PositionRelationKind = "position relation";
var RelationPositionedKind = "relation positioned";
// src/diagrams/eventmodeling/db.ts
var setOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(_rawOptString) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("options str", _rawOptString);
}, "setOptions");
var getOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return {};
}, "getOptions");
var clear2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    reset();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clear"])();
}, "clear");
function reset() {
    store = {};
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(reset, "reset");
var DEFAULT_EVENTMODELING_CONFIG = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultConfig_default"].eventmodeling;
var getConfig3 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])({
        ...DEFAULT_EVENTMODELING_CONFIG,
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])().eventmodeling
    });
    return config;
}, "getConfig");
var store = {};
function getState() {
    let state = initial;
    const { ast } = store;
    const diagramProps2 = getDiagramProps();
    if (!ast) {
        throw new Error("No data for EventModel");
    }
    ast.frames.forEach((frame, index)=>{
        const textProps = calculateTextProps(frame, ast.dataEntities, diagramProps2);
        state = dispatch(state, {
            $kind: PositionFrameKind,
            index,
            frame,
            textProps
        });
        let sourceFrames = void 0;
        if (hasSourceFrame(frame)) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("source frame", frame.sourceFrames);
            sourceFrames = ast.frames.filter((currentFrame)=>{
                return frame.sourceFrames.some((sf)=>sf.$refText === currentFrame.name);
            });
            sourceFrames.forEach((sourceFrame)=>{
                state = dispatch(state, {
                    $kind: PositionRelationKind,
                    index,
                    frame,
                    sourceFrame
                });
            });
        } else {
            state = dispatch(state, {
                $kind: PositionRelationKind,
                index,
                frame
            });
        }
    });
    state = {
        ...state,
        sortedSwimlanesArray: sortedSwimlanesArray(state.swimlanes)
    };
    return state;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(getState, "getState");
function setAst(ast) {
    store.ast = ast;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(setAst, "setAst");
var diagramProps = {
    swimlaneMinHeight: 70,
    swimlanePadding: 15,
    swimlaneGap: 10,
    boxPadding: 10,
    boxOverlap: 90,
    boxDefaultY: 0,
    boxMinWidth: 80,
    boxMaxWidth: 450,
    boxMinHeight: 80,
    boxMaxHeight: 750,
    contentStartX: 250,
    textMaxWidth: 450 - 2 * 10,
    boxTextFontWeight: "bold",
    boxTextPadding: 10,
    swimlaneTextFontWeight: "bold",
    labelUiAutomation: "UI/Automation",
    labelUiAutomationPrefix: "UI/A: ",
    labelCommandReadModel: "Command/Read Model",
    labelCommandReadModelPrefix: "C/RM: ",
    labelEvents: "Events",
    labelEventsPrefix: "Stream: "
};
function getDiagramProps() {
    return diagramProps;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(getDiagramProps, "getDiagramProps");
var initial = {
    boxes: [],
    swimlanes: {},
    relations: [],
    maxR: 0,
    sortedSwimlanesArray: []
};
function extractNamespace(entityIdentifier) {
    const spl = entityIdentifier.split(".");
    if (spl.length === 2) {
        return spl[0];
    }
    return void 0;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(extractNamespace, "extractNamespace");
function extractName(entityIdentifier) {
    const spl = entityIdentifier.split(".");
    if (spl.length === 2) {
        return spl[1];
    }
    return entityIdentifier;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(extractName, "extractName");
function findSwimlaneByNamespace(swimlanes, namespace) {
    if (!namespace || namespace.length === 0) {
        return void 0;
    }
    return Object.values(swimlanes).find((swimlane)=>swimlane.namespace === namespace);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(findSwimlaneByNamespace, "findSwimlaneByNamespace");
function findNextAvailableIndex(swimlanes, boundaryMin, boundaryMax) {
    return Math.max(boundaryMin, ...Object.keys(swimlanes).filter((key)=>{
        const index = Number.parseInt(key);
        return index > boundaryMin && index < boundaryMax;
    }).map((key)=>Number.parseInt(key))) + 1;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(findNextAvailableIndex, "findNextAvailableIndex");
function calculateSwimlaneProps(frame, swimlanes) {
    const namespace = extractNamespace(frame.entityIdentifier);
    const sw = findSwimlaneByNamespace(swimlanes, namespace);
    switch(frame.modelEntityType){
        case "ui":
        case "pcr":
        case "processor":
            if (sw) {
                return {
                    index: sw.index,
                    label: sw.namespace || diagramProps.labelUiAutomation
                };
            } else if (namespace) {
                return {
                    index: findNextAvailableIndex(swimlanes, 0, 100),
                    label: diagramProps.labelUiAutomationPrefix + namespace
                };
            }
            return {
                index: 0,
                label: diagramProps.labelUiAutomation
            };
        case "rmo":
        case "readmodel":
        case "cmd":
        case "command":
            if (sw) {
                return {
                    index: sw.index,
                    label: sw.namespace || diagramProps.labelCommandReadModel
                };
            } else if (namespace) {
                return {
                    index: findNextAvailableIndex(swimlanes, 100, 200),
                    label: diagramProps.labelCommandReadModelPrefix + namespace
                };
            }
            return {
                index: 100,
                label: diagramProps.labelCommandReadModel
            };
        case "evt":
        case "event":
        default:
            if (sw) {
                return {
                    index: sw.index,
                    label: sw.namespace || diagramProps.labelEvents
                };
            } else if (namespace) {
                return {
                    index: findNextAvailableIndex(swimlanes, 200, 300),
                    label: diagramProps.labelEventsPrefix + namespace
                };
            }
            return {
                index: 200,
                label: diagramProps.labelEvents
            };
    }
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateSwimlaneProps, "calculateSwimlaneProps");
function calculateEntityVisualProps(frame) {
    const { themeVariables } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    switch(frame.modelEntityType){
        case "ui":
            var _themeVariables_emUiFill, _themeVariables_emUiStroke;
            return {
                fill: (_themeVariables_emUiFill = themeVariables.emUiFill) !== null && _themeVariables_emUiFill !== void 0 ? _themeVariables_emUiFill : "white",
                stroke: (_themeVariables_emUiStroke = themeVariables.emUiStroke) !== null && _themeVariables_emUiStroke !== void 0 ? _themeVariables_emUiStroke : "#dbdada"
            };
        case "pcr":
        case "processor":
            var _themeVariables_emProcessorFill, _themeVariables_emProcessorStroke;
            return {
                fill: (_themeVariables_emProcessorFill = themeVariables.emProcessorFill) !== null && _themeVariables_emProcessorFill !== void 0 ? _themeVariables_emProcessorFill : "#edb3f6",
                stroke: (_themeVariables_emProcessorStroke = themeVariables.emProcessorStroke) !== null && _themeVariables_emProcessorStroke !== void 0 ? _themeVariables_emProcessorStroke : "#b88cbf"
            };
        case "rmo":
        case "readmodel":
            var _themeVariables_emReadModelFill, _themeVariables_emReadModelStroke;
            return {
                fill: (_themeVariables_emReadModelFill = themeVariables.emReadModelFill) !== null && _themeVariables_emReadModelFill !== void 0 ? _themeVariables_emReadModelFill : "#d3f1a2",
                stroke: (_themeVariables_emReadModelStroke = themeVariables.emReadModelStroke) !== null && _themeVariables_emReadModelStroke !== void 0 ? _themeVariables_emReadModelStroke : "#a3b732"
            };
        case "cmd":
        case "command":
            var _themeVariables_emCommandFill, _themeVariables_emCommandStroke;
            return {
                fill: (_themeVariables_emCommandFill = themeVariables.emCommandFill) !== null && _themeVariables_emCommandFill !== void 0 ? _themeVariables_emCommandFill : "#bcd6fe",
                stroke: (_themeVariables_emCommandStroke = themeVariables.emCommandStroke) !== null && _themeVariables_emCommandStroke !== void 0 ? _themeVariables_emCommandStroke : "#679ac3"
            };
        case "evt":
        case "event":
            var _themeVariables_emEventFill, _themeVariables_emEventStroke;
            return {
                fill: (_themeVariables_emEventFill = themeVariables.emEventFill) !== null && _themeVariables_emEventFill !== void 0 ? _themeVariables_emEventFill : "#ffb778",
                stroke: (_themeVariables_emEventStroke = themeVariables.emEventStroke) !== null && _themeVariables_emEventStroke !== void 0 ? _themeVariables_emEventStroke : "#c19a0f"
            };
        default:
            return {
                fill: "red",
                stroke: "black"
            };
    }
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateEntityVisualProps, "calculateEntityVisualProps");
function calculateTextProps(frame, dataEntities, diagramProps2) {
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    var _extractName;
    const name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])((_extractName = extractName(frame.entityIdentifier)) !== null && _extractName !== void 0 ? _extractName : "", config);
    let toHtml;
    const wrapLabelConfig = {
        fontSize: 16,
        fontWeight: 700,
        fontFamily: '"trebuchet ms", verdana, arial, sans-serif',
        joinWith: "<br/>"
    };
    const wrappedName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wrapLabel"])(name, diagramProps2.textMaxWidth, wrapLabelConfig);
    let content = "<b>".concat(wrappedName, "</b>");
    if (frame.dataInlineValue) {
        toHtml = frame.dataInlineValue;
        toHtml = toHtml.substring(toHtml.indexOf("{") + 1);
        toHtml = toHtml.substring(0, toHtml.lastIndexOf("}") - 1);
        toHtml = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])(toHtml, config);
        toHtml = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wrapLabel"])(toHtml, diagramProps2.textMaxWidth, wrapLabelConfig);
        toHtml = toHtml.replaceAll(" ", "&nbsp;");
    }
    if (frame.dataReference) {
        const dataEntity = dataEntities.find((dataEntity2)=>{
            var _frame_dataReference;
            return dataEntity2.name === ((_frame_dataReference = frame.dataReference) === null || _frame_dataReference === void 0 ? void 0 : _frame_dataReference.$refText);
        });
        if (dataEntity) {
            toHtml = dataEntity.dataBlockValue;
            toHtml = toHtml.substring(toHtml.indexOf("{\n") + 2);
            toHtml = toHtml.substring(0, toHtml.lastIndexOf("}") - 1);
            toHtml = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])(toHtml, config);
            toHtml = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wrapLabel"])(toHtml, diagramProps2.textMaxWidth, wrapLabelConfig);
            toHtml = toHtml.replaceAll(" ", "&nbsp;");
            toHtml += "<br/>";
        }
    }
    const hasRenderedData = toHtml !== void 0;
    if (hasRenderedData) {
        content += '<br/><br/><code style="text-align: left; display: block;max-width:'.concat(diagramProps2.textMaxWidth, 'px">').concat(toHtml, "</code>");
    }
    const textDimensionConfig = {
        fontSize: wrapLabelConfig.fontSize,
        fontWeight: wrapLabelConfig.fontWeight,
        fontFamily: wrapLabelConfig.fontFamily
    };
    const dimensions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateTextDimensions"])(content, textDimensionConfig);
    const calculatedWidthFix = hasRenderedData ? dimensions.width / 3 : dimensions.width;
    const props = {
        content,
        width: calculatedWidthFix,
        height: dimensions.height
    };
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("[".concat(frame.name, "] ").concat(frame.entityIdentifier, " text"), props);
    return props;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateTextProps, "calculateTextProps");
function decidePositionFrame(state, _command) {
    const command = _command;
    const visual = calculateEntityVisualProps(command.frame);
    const dimension = {
        width: command.textProps.width + 2 * diagramProps.boxTextPadding,
        height: command.textProps.height + 2 * diagramProps.boxTextPadding
    };
    const event = {
        $kind: FramePositionedKind,
        frame: command.frame,
        index: command.index,
        visual,
        dimension,
        textProps: command.textProps
    };
    return [
        event
    ];
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(decidePositionFrame, "decidePositionFrame");
function calculateX(swimlane, previousSwimlane, lastBox) {
    if (previousSwimlane === void 0) {
        return diagramProps.contentStartX;
    }
    if (previousSwimlane.index === swimlane.index && swimlane.r) {
        return swimlane.r + diagramProps.boxPadding;
    }
    if (lastBox === void 0) {
        return diagramProps.contentStartX;
    }
    return lastBox.r - diagramProps.boxOverlap + diagramProps.boxPadding;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateX, "calculateX");
function calculateMaxRight(swimlanes, swimlaneR) {
    const rs = [
        ...swimlanes.map((s)=>s.r),
        swimlaneR
    ];
    return Math.max(...rs);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(calculateMaxRight, "calculateMaxRight");
function sortedSwimlanesArray(swimlanes) {
    return Object.values(swimlanes).sort((a, b)=>a.index - b.index);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(sortedSwimlanesArray, "sortedSwimlanesArray");
function evolveFramePositioned(state, _event) {
    const event = _event;
    const swimlaneProps = calculateSwimlaneProps(event.frame, state.swimlanes);
    let swimlane;
    if (swimlaneProps.index in state.swimlanes) {
        swimlane = state.swimlanes[swimlaneProps.index];
    } else {
        swimlane = {
            index: swimlaneProps.index,
            label: swimlaneProps.label,
            r: 0,
            y: swimlaneProps.index * diagramProps.swimlaneMinHeight + diagramProps.swimlaneGap,
            height: diagramProps.swimlaneMinHeight,
            maxHeight: diagramProps.swimlaneMinHeight
        };
    }
    const lastBox = state.boxes.length > 0 ? state.boxes[state.boxes.length - 1] : void 0;
    const previousSwimlane = state.previousSwimlaneNumber !== void 0 ? state.swimlanes[state.previousSwimlaneNumber] : void 0;
    const dimension = {
        width: Math.max(diagramProps.boxMinWidth, Math.min(diagramProps.boxMaxWidth, event.dimension.width)) + 2 * diagramProps.boxPadding,
        height: Math.max(diagramProps.boxMinHeight, Math.min(diagramProps.boxMaxHeight, event.dimension.height)) + 2 * diagramProps.boxPadding
    };
    const x = calculateX(swimlane, previousSwimlane, lastBox);
    const r = x + dimension.width + diagramProps.boxPadding;
    const maxR = calculateMaxRight(Object.values(state.swimlanes), r);
    swimlane.r = x + dimension.width;
    swimlane.maxHeight = Math.max(swimlane.maxHeight, dimension.height);
    swimlane.height = Math.max(diagramProps.swimlaneMinHeight, swimlane.maxHeight) + 2 * diagramProps.swimlanePadding;
    const box = {
        x,
        y: diagramProps.swimlanePadding + swimlane.y,
        // y: diagramProps.swimlanePadding + (swimlane.y || diagramProps.boxDefaultY),
        r,
        dimension,
        leftSibling: false,
        swimlane,
        visual: event.visual,
        text: event.textProps.content,
        frame: event.frame,
        index: event.index
    };
    const newState = {
        ...state,
        boxes: [
            ...state.boxes,
            box
        ],
        swimlanes: {
            ...state.swimlanes,
            ["".concat(swimlane.index)]: swimlane
        },
        previousSwimlaneNumber: swimlaneProps.index,
        previousFrame: event.frame,
        maxR
    };
    const swimlanes = sortedSwimlanesArray(newState.swimlanes);
    if (swimlanes.length > 0) {
        swimlanes[0].y = 0;
    }
    for(let i = 1; i < swimlanes.length; i++){
        const sw = swimlanes[i];
        const prevSw = swimlanes[i - 1];
        sw.y = prevSw.y + prevSw.height + diagramProps.swimlaneGap;
    }
    return newState;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(evolveFramePositioned, "evolveFramePositioned");
function isFirstFrame(index, frame) {
    if (index === 0 && frame.sourceFrames.length === 0) {
        return true;
    }
    return false;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(isFirstFrame, "isFirstFrame");
function hasSourceFrame(frame) {
    return frame.sourceFrames !== void 0 && frame.sourceFrames !== null && frame.sourceFrames.length > 0;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(hasSourceFrame, "hasSourceFrame");
function findBoxByFrame(boxes, frame) {
    if (frame === void 0 || frame === null) {
        return void 0;
    }
    return boxes.find((box)=>box.frame.name === frame.name);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(findBoxByFrame, "findBoxByFrame");
function findBoxByLineIndex(boxes, targetSwimlane, lineIndex) {
    if (lineIndex < 0) {
        return void 0;
    }
    for(let i = lineIndex; i >= 0; i--){
        const box = boxes[i];
        if (box.swimlane.index !== targetSwimlane) {
            return box;
        }
    }
    return void 0;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(findBoxByLineIndex, "findBoxByLineIndex");
function decidePositionRelation(state, _command) {
    const command = _command;
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$chunks$2f$mermaid$2d$parser$2e$core$2f$chunk$2d$KEIR6QF5$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEmResetFrame"])(command.frame) || isFirstFrame(command.index, command.frame)) {
        return [];
    }
    const targetBox = findBoxByFrame(state.boxes, command.frame);
    if (targetBox === void 0) {
        throw new Error("Target box not found for frame ".concat(command.frame.name));
    }
    let sourceBox;
    if (command.sourceFrame) {
        sourceBox = findBoxByFrame(state.boxes, command.sourceFrame);
    } else {
        sourceBox = findBoxByLineIndex(state.boxes, targetBox.swimlane.index, command.index - 1);
    }
    if (sourceBox === void 0) {
        return [];
    }
    const event = {
        $kind: RelationPositionedKind,
        frame: command.frame,
        index: command.index,
        sourceBox,
        targetBox
    };
    return [
        event
    ];
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(decidePositionRelation, "decidePositionRelation");
function evolveRelationPositioned(state, _event) {
    const event = _event;
    const relation = {
        visual: {
            fill: "none",
            stroke: "#000"
        },
        source: {
            x: event.sourceBox.x,
            y: event.sourceBox.y
        },
        target: {
            x: event.targetBox.x,
            y: event.targetBox.y
        },
        sourceBox: event.sourceBox,
        targetBox: event.targetBox
    };
    const newState = {
        ...state,
        relations: [
            ...state.relations,
            relation
        ]
    };
    return newState;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(evolveRelationPositioned, "evolveRelationPositioned");
var deciders = {
    [PositionFrameKind]: decidePositionFrame,
    [PositionRelationKind]: decidePositionRelation
};
var evolvers = {
    [FramePositionedKind]: evolveFramePositioned,
    [RelationPositionedKind]: evolveRelationPositioned
};
function decide(state, command) {
    const fn = deciders[command.$kind];
    if (fn === void 0 || fn === null) {
        return [];
    }
    const events = fn(state, command);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("decided events", events);
    return events;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(decide, "decide");
function evolve(state, events) {
    const newState = events.reduce((previousState, event)=>{
        const fn = evolvers[event.$kind];
        if (fn === void 0 || fn === null) {
            return previousState;
        }
        return fn(previousState, event);
    }, state);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("evolve events", {
        state,
        newState,
        events
    });
    return newState;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(evolve, "evolve");
function dispatch(state, command) {
    const events = decide(state, command);
    const newState = evolve(state, events);
    return newState;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(dispatch, "dispatch");
var db = {
    getConfig: getConfig3,
    setOptions,
    getOptions,
    clear: clear2,
    setAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccTitle"],
    getAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccTitle"],
    getAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccDescription"],
    setAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccDescription"],
    setDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setDiagramTitle"],
    getDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDiagramTitle"],
    setAst,
    getDiagramProps,
    getState
};
// src/diagrams/eventmodeling/parser.ts
var parser = {
    parse: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (input)=>{
        const ast = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["parse"])("eventmodeling", input);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(ast);
        db.setAst(ast);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["populateCommonDb"])(ast, db);
    }, "parse")
};
if (void 0) {
    const { it, expect, describe } = void 0;
    describe("EventModeling Parser", ()=>{
        it("should parse simple model", ()=>{
            const result = parser.parse("eventmodeling\n  tf 01 evt Start\n\n    ");
            expect(result !== void 0);
        });
    });
}
;
var DEFAULT_CONFIG = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
var DEFAULT_EVENTMODELING_CONFIG2 = DEFAULT_CONFIG === null || DEFAULT_CONFIG === void 0 ? void 0 : DEFAULT_CONFIG.eventmodeling;
function renderD3Box(diagram2, diagramProps2) {
    return (box)=>{
        const y = box.swimlane.y + diagramProps2.swimlanePadding;
        const g = diagram2.append("g").attr("class", "em-box");
        g.append("rect").attr("x", box.x).attr("y", y).attr("rx", "3").attr("width", box.dimension.width).attr("height", box.dimension.height).attr("stroke", box.visual.stroke).attr("fill", box.visual.fill);
        const f = g.append("foreignObject").attr("x", box.x + diagramProps2.boxPadding).attr("y", y + 10).attr("width", box.dimension.width - 2 * diagramProps2.boxPadding).attr("height", box.dimension.height - 2 * diagramProps2.boxPadding);
        const text = f.append("xhtml:div").style("display", "table").style("height", "100%").style("width", "100%");
        text.append("span").style("display", "table-cell").style("text-align", "center").style("vertical-align", "middle").html(box.text);
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(renderD3Box, "renderD3Box");
function dirUpwards(sourceY, targetY) {
    return sourceY > targetY;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(dirUpwards, "dirUpwards");
function renderD3Relation(diagram2, diagramProps2, arrowheadId, themeVariables) {
    return (relation)=>{
        const sourceBoxY = relation.sourceBox.swimlane.y + diagramProps2.swimlanePadding;
        const targetBoxY = relation.targetBox.swimlane.y + diagramProps2.swimlanePadding;
        const upwards = dirUpwards(sourceBoxY, targetBoxY);
        const sourceX = relation.sourceBox.x + relation.sourceBox.dimension.width * 2 / 3;
        const targetX = relation.targetBox.x + relation.targetBox.dimension.width / 3;
        let sourceY;
        let targetY;
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("rendering relation up=".concat(upwards, " for "), {
            sourceBox: relation.sourceBox,
            targetBox: relation.targetBox
        });
        if (upwards) {
            sourceY = sourceBoxY;
            targetY = targetBoxY + relation.targetBox.dimension.height;
        } else {
            sourceY = sourceBoxY + relation.sourceBox.dimension.height;
            targetY = targetBoxY;
        }
        var _themeVariables_emRelationStroke;
        const relationStroke = (_themeVariables_emRelationStroke = themeVariables.emRelationStroke) !== null && _themeVariables_emRelationStroke !== void 0 ? _themeVariables_emRelationStroke : relation.visual.stroke;
        diagram2.append("path").attr("class", "em-relation").attr("fill", relation.visual.fill).attr("stroke", relationStroke).attr("stroke-width", "1").attr("marker-end", "url(#".concat(arrowheadId, ")")).attr("d", "M".concat(sourceX, " ").concat(sourceY, " L").concat(targetX, " ").concat(targetY));
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(renderD3Relation, "renderD3Relation");
function renderD3Swimlane(diagram2, maxR, diagramProps2, themeVariables) {
    return (swimlane)=>{
        const g = diagram2.append("g").attr("class", "em-swimlane");
        var _themeVariables_emSwimlaneBackgroundOdd;
        const oddBackground = (_themeVariables_emSwimlaneBackgroundOdd = themeVariables.emSwimlaneBackgroundOdd) !== null && _themeVariables_emSwimlaneBackgroundOdd !== void 0 ? _themeVariables_emSwimlaneBackgroundOdd : "rgb(250,250,250)";
        var _themeVariables_emSwimlaneBackgroundStroke;
        const backgroundStroke = (_themeVariables_emSwimlaneBackgroundStroke = themeVariables.emSwimlaneBackgroundStroke) !== null && _themeVariables_emSwimlaneBackgroundStroke !== void 0 ? _themeVariables_emSwimlaneBackgroundStroke : "rgb(240,240,240)";
        g.append("rect").attr("x", 0).attr("y", swimlane.y).attr("rx", "3").attr("width", maxR + diagramProps2.swimlanePadding).attr("height", swimlane.height).attr("fill", oddBackground).attr("stroke", backgroundStroke);
        g.append("text").attr("font-weight", diagramProps2.swimlaneTextFontWeight).attr("x", 30).attr("y", swimlane.y + 30).text(swimlane.label);
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(renderD3Swimlane, "renderD3Swimlane");
var draw = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(txt, id, ver, diagObj) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("in eventmodeling renderer", txt + "\n", "id:", id, ver);
    if (!DEFAULT_EVENTMODELING_CONFIG2) {
        throw new Error("EventModeling config not found");
    }
    const db2 = diagObj.db;
    const { themeVariables, eventmodeling: config } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    const diagram2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])('[id="'.concat(id, '"]'));
    const diagramProps2 = db2.getDiagramProps();
    const state = db2.getState();
    const arrowheadId = "em-arrowhead-".concat(id);
    var _themeVariables_emArrowhead;
    const arrowheadColor = (_themeVariables_emArrowhead = themeVariables.emArrowhead) !== null && _themeVariables_emArrowhead !== void 0 ? _themeVariables_emArrowhead : "#000000";
    state.sortedSwimlanesArray.forEach(renderD3Swimlane(diagram2, state.maxR, diagramProps2, themeVariables));
    state.boxes.forEach(renderD3Box(diagram2, diagramProps2));
    state.relations.forEach(renderD3Relation(diagram2, diagramProps2, arrowheadId, themeVariables));
    const marker = diagram2.append("defs").append("marker").attr("id", arrowheadId).attr("markerWidth", "10").attr("markerHeight", "7").attr("refX", "10").attr("refY", "3.5").attr("orient", "auto");
    marker.append("polygon").attr("points", "0 0, 10 3.5, 0 7").attr("fill", arrowheadColor);
    var _config_padding;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setupGraphViewbox2"])(void 0, diagram2, (_config_padding = config === null || config === void 0 ? void 0 : config.padding) !== null && _config_padding !== void 0 ? _config_padding : 30, config === null || config === void 0 ? void 0 : config.useMaxWidth);
}, "draw");
var renderer_default = {
    draw
};
// src/diagrams/eventmodeling/styles.js
var getStyles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((_options)=>"", "getStyles");
var styles_default = getStyles;
// src/diagrams/eventmodeling/diagram.ts
var diagram = {
    parser,
    db,
    renderer: renderer_default,
    styles: styles_default
};
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_ff27e9ca._.js.map