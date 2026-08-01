(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-2Q5K7J3B.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ImperativeState",
    ()=>ImperativeState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
var _class;
;
// src/utils/imperativeState.ts
var ImperativeState = (_class = class {
    reset() {
        this.records = this.init();
    }
    /**
   * @param init - Function that creates the default state.
   */ constructor(init){
        this.init = init;
        this.records = this.init();
    }
}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(_class, "ImperativeState"), _class);
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
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/diagram-OA4YK3LP.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "diagram",
    ()=>diagram
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$2Q5K7J3B$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-2Q5K7J3B.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-JWPE2WC7.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-VAUOI2AC.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$HOUHSVGY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-HOUHSVGY.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/diagrams/treeView/parser.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs [app-client] (ecmascript) <locals>");
;
;
;
;
;
;
;
;
;
// src/diagrams/treeView/boxDrawingPreprocessor.ts
var ALL_BOX_CHARS = /[─━│┃└┗├┣]/;
var BRANCH_CHAR = /[└┗├┣]/;
var DASH_CHAR = /[─━]/;
var DECORATION_ONLY = /^[\s│┃]+$/;
var METADATA_LINE = /^\s*(title[\t ]|accTitle[\t ]*:|accDescr[\t ]*[:{])/;
var COMMENT_LINE = /^\s*%%/;
var INDENT_UNIT = "    ";
function isBoxDrawingFormat(lines) {
    return lines.some((line)=>ALL_BOX_CHARS.test(line));
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(isBoxDrawingFormat, "isBoxDrawingFormat");
function inferSegmentWidth(contentLines) {
    for (const line of contentLines){
        const match = BRANCH_CHAR.exec(line);
        if ((match === null || match === void 0 ? void 0 : match.index) && match.index > 0) {
            return match.index;
        }
    }
    return 4;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(inferSegmentWidth, "inferSegmentWidth");
function remapErrorLines(message, lineMap) {
    return message.replace(/\bline\s+(\d+)\b/gi, (match, lineStr)=>{
        const line = parseInt(lineStr, 10);
        const original = lineMap.get(line);
        return original ? "line ".concat(original) : match;
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(remapErrorLines, "remapErrorLines");
function preprocessBoxDrawing(input) {
    const lines = input.split("\n");
    const lineMap = /* @__PURE__ */ new Map();
    let keywordIdx = -1;
    for (const [i, line] of lines.entries()){
        if (line.trim() === "treeView-beta") {
            keywordIdx = i;
            break;
        }
    }
    if (keywordIdx === -1) {
        return {
            text: input,
            lineMap
        };
    }
    const contentLineTexts = [];
    for(let i = keywordIdx + 1; i < lines.length; i++){
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === "" || COMMENT_LINE.test(line) || METADATA_LINE.test(line)) {
            continue;
        }
        if (DECORATION_ONLY.test(line)) {
            continue;
        }
        contentLineTexts.push(line.replace(/\t/g, "    "));
    }
    if (!isBoxDrawingFormat(contentLineTexts)) {
        return {
            text: input,
            lineMap
        };
    }
    const segmentWidth = inferSegmentWidth(contentLineTexts);
    const outputLines = [];
    let outLineNo = 0;
    for(let i = 0; i <= keywordIdx; i++){
        outputLines.push(lines[i]);
        outLineNo++;
        lineMap.set(outLineNo, i + 1);
    }
    for(let i = keywordIdx + 1; i < lines.length; i++){
        const line = lines[i];
        const trimmed = line.trim();
        const origLineNo = i + 1;
        if (trimmed === "") {
            outputLines.push(line);
            outLineNo++;
            lineMap.set(outLineNo, origLineNo);
            continue;
        }
        if (COMMENT_LINE.test(line)) {
            outputLines.push(line);
            outLineNo++;
            lineMap.set(outLineNo, origLineNo);
            continue;
        }
        if (METADATA_LINE.test(line)) {
            outputLines.push(line);
            outLineNo++;
            lineMap.set(outLineNo, origLineNo);
            continue;
        }
        if (DECORATION_ONLY.test(line)) {
            continue;
        }
        const normalized = line.replace(/\t/g, "    ");
        const branchMatch = BRANCH_CHAR.exec(normalized);
        if ((branchMatch === null || branchMatch === void 0 ? void 0 : branchMatch.index) !== void 0) {
            const branchCol = branchMatch.index;
            const depth = Math.round(branchCol / segmentWidth) + 1;
            let pos = branchCol + 1;
            while(pos < normalized.length && DASH_CHAR.test(normalized[pos])){
                pos++;
            }
            while(pos < normalized.length && normalized[pos] === " "){
                pos++;
            }
            const content = normalized.slice(pos).trimEnd();
            if (!content) {
                throw new Error("Line ".concat(origLineNo, ": Empty node — expected a filename or directory name after the box-drawing prefix"));
            }
            const indent = INDENT_UNIT.repeat(depth);
            outputLines.push(indent + content);
            outLineNo++;
            lineMap.set(outLineNo, origLineNo);
        } else if (/^[\s─━│┃└┗├┣]+$/.test(normalized)) {
            continue;
        } else if (ALL_BOX_CHARS.test(normalized)) {
            outputLines.push(line);
            outLineNo++;
            lineMap.set(outLineNo, origLineNo);
        } else if (/^\s+/.test(normalized)) {
            throw new Error("Line ".concat(origLineNo, ": Unexpected indentation without box-drawing characters. In box-drawing format, use ├── or └── prefixes for indented nodes."));
        } else {
            outputLines.push(line);
            outLineNo++;
            lineMap.set(outLineNo, origLineNo);
        }
    }
    return {
        text: outputLines.join("\n"),
        lineMap
    };
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(preprocessBoxDrawing, "preprocessBoxDrawing");
// src/diagrams/treeView/db.ts
var state = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$2Q5K7J3B$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ImperativeState"](()=>({
        cnt: 1,
        stack: [
            {
                id: 0,
                level: -1,
                name: "/",
                nodeType: "directory",
                children: []
            }
        ]
    }));
var clear2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    state.reset();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clear"])();
}, "clear");
var getRoot = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return state.records.stack[0];
}, "getRoot");
var getCount = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>state.records.cnt, "getCount");
var defaultConfig = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultConfig_default"].treeView;
var getConfig2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])(defaultConfig, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])().treeView);
}, "getConfig");
var addNode = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((level, name, nodeType, cssClass, icon, description)=>{
    while(level <= state.records.stack[state.records.stack.length - 1].level){
        state.records.stack.pop();
    }
    const node = {
        id: state.records.cnt++,
        level,
        name,
        nodeType,
        icon,
        cssClass,
        description,
        children: []
    };
    state.records.stack[state.records.stack.length - 1].children.push(node);
    state.records.stack.push(node);
}, "addNode");
var db = {
    clear: clear2,
    addNode,
    getRoot,
    getCount,
    getConfig: getConfig2,
    getAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccTitle"],
    getAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccDescription"],
    getDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDiagramTitle"],
    setAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccDescription"],
    setAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccTitle"],
    setDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setDiagramTitle"]
};
var db_default = db;
// src/diagrams/treeView/parser.ts
var populate = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((ast)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["populateCommonDb"])(ast, db_default);
    for (const node of ast.nodes){
        const level = typeof node.indent === "number" ? node.indent : 0;
        let name = node.name;
        const isDirectory = name.endsWith("/");
        if (isDirectory) {
            name = name.slice(0, -1);
        }
        const nodeType = isDirectory ? "directory" : "file";
        const cssClass = node.classAnnotation || void 0;
        const rawIcon = node.iconAnnotation;
        const icon = rawIcon !== void 0 ? rawIcon || "none" : void 0;
        const rawDesc = node.descAnnotation || void 0;
        const description = rawDesc ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeText"])(rawDesc, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])()) : void 0;
        db_default.addNode(level, name, nodeType, cssClass, icon, description);
    }
}, "populate");
var parser = {
    parse: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (input)=>{
        const { text, lineMap } = preprocessBoxDrawing(input);
        try {
            const ast = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["parse"])("treeView", text);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(ast);
            populate(ast);
        } catch (error) {
            if (lineMap.size > 0 && error instanceof Error) {
                error.message = remapErrorLines(error.message, lineMap);
            }
            throw error;
        }
    }, "parse")
};
// src/diagrams/treeView/icons.ts
var treeViewIcons = {
    prefix: "mermaid-treeview",
    height: 24,
    width: 24,
    icons: {
        folder: {
            body: '<path fill="currentColor" d="M10.59 4.59A2 2 0 0 0 9.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.17z"/>'
        },
        file: {
            body: '<path fill="currentColor" fill-rule="evenodd" d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.83a2 2 0 0 0-.59-1.42l-4.82-4.82A2 2 0 0 0 13.17 2H6Zm7.5 1.9l4.6 4.6h-3.6a1 1 0 0 1-1-1V3.9Z" clip-rule="evenodd"/>'
        }
    }
};
function detectIcon(name, config) {
    var _config_filenameIcons;
    const filenameIcon = config === null || config === void 0 ? void 0 : (_config_filenameIcons = config.filenameIcons) === null || _config_filenameIcons === void 0 ? void 0 : _config_filenameIcons[name];
    if (filenameIcon) {
        return filenameIcon;
    }
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx > 0) {
        const ext = name.substring(dotIdx).toLowerCase();
        const extensionIcons = config === null || config === void 0 ? void 0 : config.extensionIcons;
        var _extensionIcons_ext;
        return (_extensionIcons_ext = extensionIcons === null || extensionIcons === void 0 ? void 0 : extensionIcons[ext]) !== null && _extensionIcons_ext !== void 0 ? _extensionIcons_ext : extensionIcons === null || extensionIcons === void 0 ? void 0 : extensionIcons[ext.slice(1)];
    }
    return void 0;
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(detectIcon, "detectIcon");
function qualifyIcon(icon, defaultIconPack) {
    if (icon.includes(":")) {
        return icon;
    }
    if (icon in treeViewIcons.icons || !defaultIconPack) {
        return "".concat(treeViewIcons.prefix, ":").concat(icon);
    }
    return "".concat(defaultIconPack, ":").concat(icon);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(qualifyIcon, "qualifyIcon");
function getNodeIcon(node, config) {
    if (node.icon === "none") {
        return void 0;
    }
    if (node.icon) {
        return qualifyIcon(node.icon, config.defaultIconPack);
    }
    if (!config.showIcons) {
        return void 0;
    }
    if (node.nodeType === "file") {
        const detected = detectIcon(node.name, config);
        if (detected === "none") {
            return void 0;
        }
        if (detected) {
            return qualifyIcon(detected, config.defaultIconPack);
        }
    }
    return "".concat(treeViewIcons.prefix, ":").concat(node.nodeType === "directory" ? "folder" : "file");
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(getNodeIcon, "getNodeIcon");
// src/diagrams/treeView/renderer.ts
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$HOUHSVGY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["registerIconPacks"])([
    {
        name: treeViewIcons.prefix,
        icons: treeViewIcons
    }
]);
var ICON_SIZE = 14;
var ICON_GAP = 4;
var DESC_GAP = 16;
var iconSymbolId = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((diagramId, icon)=>"tv-icon-".concat(diagramId, "-").concat(icon.replace(/[^\w-]/g, "-")), "iconSymbolId");
var injectIconDefs = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (svg, root, config, diagramId)=>{
    const usedIcons = /* @__PURE__ */ new Set();
    const collect = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((node)=>{
        const icon = getNodeIcon(node, config);
        if (icon) {
            usedIcons.add(icon);
        }
        node.children.forEach(collect);
    }, "collect");
    collect(root);
    if (usedIcons.size === 0) {
        return;
    }
    const iconSVGs = await Promise.all([
        ...usedIcons
    ].map(async (icon)=>({
            icon,
            svg: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$HOUHSVGY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getIconSVG"])(icon, {
                height: ICON_SIZE,
                width: ICON_SIZE
            })
        })));
    const defs = svg.append("defs");
    for (const { icon, svg: iconSVG } of iconSVGs){
        defs.append("g").attr("id", iconSymbolId(diagramId, icon)).html(iconSVG);
    }
}, "injectIconDefs");
var positionLabel = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((x, y, node, domElem, config, diagramId)=>{
    var _node_cssClass;
    const nodeGroup = domElem.append("g");
    let cssClasses = "treeView-node-label";
    if (node.nodeType === "directory") {
        cssClasses += " treeView-node-dir";
    }
    if (node.cssClass) {
        cssClasses += " ".concat(node.cssClass);
    }
    const iconOffset = ICON_SIZE + ICON_GAP;
    const icon = getNodeIcon(node, config);
    const showIcon = icon !== void 0;
    if (icon) {
        nodeGroup.append("use").attr("xlink:href", "#".concat(iconSymbolId(diagramId, icon))).attr("x", x + config.paddingX).attr("y", y + config.paddingY).attr("class", "treeView-node-icon");
    }
    const label = nodeGroup.append("text").text(node.name).attr("dominant-baseline", "middle").attr("class", cssClasses);
    const { height: labelHeight, width: labelWidth } = label.node().getBBox();
    const height = labelHeight + config.paddingY * 2;
    const labelX = x + config.paddingX + (showIcon ? iconOffset : 0);
    label.attr("x", labelX);
    label.attr("y", y + height / 2);
    const labelRightEdge = labelX + labelWidth;
    const width = labelWidth + config.paddingX * 2 + (showIcon ? iconOffset : 0);
    node.BBox = {
        x,
        y,
        width,
        height
    };
    if ((_node_cssClass = node.cssClass) === null || _node_cssClass === void 0 ? void 0 : _node_cssClass.split(/\s+/).includes("highlight")) {
        nodeGroup.insert("rect", ":first-child").attr("x", x).attr("y", y + 1).attr("width", 0).attr("height", height - 2).attr("rx", 3).attr("class", "treeView-highlight-bg");
    }
    return {
        node,
        nodeGroup,
        labelRightEdge,
        centerY: y + height / 2
    };
}, "positionLabel");
var positionLine = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((domElem, x1, y1, x2, y2, lineThickness)=>{
    return domElem.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("stroke-width", lineThickness).attr("class", "treeView-node-line");
}, "positionLine");
var drawTree = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem, root, config, diagramId)=>{
    let totalHeight = 0;
    let totalWidth = 0;
    const renderInfos = [];
    const drawNode = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((elem2, node, config2, depth)=>{
        const indent = depth * (config2.rowIndent + config2.paddingX);
        const info = positionLabel(indent, totalHeight, node, elem2, config2, diagramId);
        renderInfos.push(info);
        const { height, width } = node.BBox;
        positionLine(elem2, indent - config2.rowIndent, totalHeight + height / 2, indent, totalHeight + height / 2, config2.lineThickness);
        totalWidth = Math.max(totalWidth, indent + width);
        totalHeight += height;
    }, "drawNode");
    const processNode = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(node) {
        let depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
        drawNode(elem, node, config, depth);
        node.children.forEach((child)=>{
            processNode(child, depth + 1);
        });
        const { x, y, height } = node.BBox;
        if (node.children.length) {
            const { y: endY, height: endHeight } = node.children[node.children.length - 1].BBox;
            positionLine(elem, x + config.paddingX, y + height, x + config.paddingX, endY + endHeight / 2 + config.lineThickness / 2, config.lineThickness);
        }
    }, "processNode");
    processNode(root);
    const nodesWithDesc = renderInfos.filter((ri)=>ri.node.description);
    if (nodesWithDesc.length > 0) {
        const maxLabelRight = Math.max(...renderInfos.map((ri)=>ri.labelRightEdge));
        const descX = maxLabelRight + DESC_GAP;
        for (const ri of nodesWithDesc){
            const desc = ri.nodeGroup.append("text").text(ri.node.description).attr("dominant-baseline", "middle").attr("class", "treeView-node-description").attr("x", descX).attr("y", ri.centerY);
            const descBBox = desc.node().getBBox();
            totalWidth = Math.max(totalWidth, descX + descBBox.width + config.paddingX);
        }
    }
    for (const ri of renderInfos){
        var _ri_node_cssClass;
        if ((_ri_node_cssClass = ri.node.cssClass) === null || _ri_node_cssClass === void 0 ? void 0 : _ri_node_cssClass.split(/\s+/).includes("highlight")) {
            const rect = ri.nodeGroup.select(".treeView-highlight-bg");
            if (!rect.empty()) {
                const rectWidth = totalWidth - ri.node.BBox.x + 8;
                rect.attr("width", rectWidth);
                totalWidth = Math.max(totalWidth, ri.node.BBox.x + rectWidth + 2);
            }
        }
    }
    return {
        totalHeight,
        totalWidth
    };
}, "drawTree");
var draw = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (text, id, _ver, diagObj)=>{
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Rendering treeView diagram\n" + text);
    const db2 = diagObj.db;
    const root = db2.getRoot();
    const config = db2.getConfig();
    const svg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$VAUOI2AC$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["selectSvgElement"])(id);
    await injectIconDefs(svg, root, config, id);
    const treeElem = svg.append("g");
    treeElem.attr("class", "tree-view");
    const { totalHeight, totalWidth } = drawTree(treeElem, root, config, id);
    svg.attr("viewBox", "-".concat(config.lineThickness / 2, " 0 ").concat(totalWidth, " ").concat(totalHeight));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["configureSvgSize"])(svg, totalHeight, totalWidth, config.useMaxWidth);
}, "draw");
var renderer = {
    draw
};
var renderer_default = renderer;
// src/diagrams/treeView/styles.ts
var defaultTreeViewDiagramStyles = {
    labelFontSize: "16px",
    labelColor: "black",
    lineColor: "black",
    iconColor: "#546e7a",
    descriptionColor: "#6a9955",
    highlightBg: "rgba(255, 193, 7, 0.15)",
    highlightStroke: "#ffc107"
};
var styles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((param)=>{
    let { treeView } = param;
    const { labelFontSize, labelColor, lineColor, iconColor, descriptionColor, highlightBg, highlightStroke } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])(defaultTreeViewDiagramStyles, treeView);
    return "\n    .treeView-node-label {\n        font-size: ".concat(labelFontSize, ";\n        fill: ").concat(labelColor, ";\n        white-space: pre;\n    }\n    .treeView-node-dir {\n        font-weight: bold;\n    }\n    .treeView-node-line {\n        stroke: ").concat(lineColor, ";\n    }\n    .treeView-node-icon {\n        color: ").concat(iconColor, ";\n    }\n    .treeView-node-description {\n        font-size: ").concat(labelFontSize, ";\n        fill: ").concat(descriptionColor, ";\n        font-style: italic;\n        white-space: pre;\n    }\n    .treeView-highlight-bg {\n        fill: ").concat(highlightBg, ";\n        stroke: ").concat(highlightStroke, ";\n        stroke-width: 1;\n    }\n    ");
}, "styles");
var styles_default = styles;
// src/diagrams/treeView/diagram.ts
var diagram = {
    db: db_default,
    renderer: renderer_default,
    parser,
    styles: styles_default
};
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_8ffb509f._.js.map