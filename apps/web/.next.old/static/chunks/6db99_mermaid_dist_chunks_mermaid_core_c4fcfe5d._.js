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
"[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/gitGraphDiagram-IHSO6WYX.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "diagram",
    ()=>diagram
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$2Q5K7J3B$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-2Q5K7J3B.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-JWPE2WC7.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-ICXQ74PX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-WYO6CB5R.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-X3CZISLH.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-Y2CYZVJY.mjs [app-client] (ecmascript)");
// src/diagrams/git/gitGraphParser.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs [app-client] (ecmascript) <locals>");
// src/diagrams/git/gitGraphRenderer.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$40$7$2e$9$2e$0$2f$node_modules$2f$d3$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3@7.9.0/node_modules/d3/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/d3-selection@3.0.0/node_modules/d3-selection/src/select.js [app-client] (ecmascript) <export default as select>");
;
;
;
;
;
;
;
// src/diagrams/git/gitGraphTypes.ts
var commitType = {
    NORMAL: 0,
    REVERSE: 1,
    HIGHLIGHT: 2,
    MERGE: 3,
    CHERRY_PICK: 4
};
// src/diagrams/git/gitGraphAst.ts
var DEFAULT_GITGRAPH_CONFIG = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultConfig_default"].gitGraph;
var getConfig3 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cleanAndMerge"])({
        ...DEFAULT_GITGRAPH_CONFIG,
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])().gitGraph
    });
    return config;
}, "getConfig");
var state = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$2Q5K7J3B$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ImperativeState"](()=>{
    const config = getConfig3();
    const mainBranchName = config.mainBranchName;
    const mainBranchOrder = config.mainBranchOrder;
    return {
        mainBranchName,
        commits: /* @__PURE__ */ new Map(),
        head: null,
        branchConfig: /* @__PURE__ */ new Map([
            [
                mainBranchName,
                {
                    name: mainBranchName,
                    order: mainBranchOrder
                }
            ]
        ]),
        branches: /* @__PURE__ */ new Map([
            [
                mainBranchName,
                null
            ]
        ]),
        currBranch: mainBranchName,
        direction: "LR",
        seq: 0,
        options: {}
    };
});
function getID() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["random"])({
        length: 7
    });
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(getID, "getID");
function uniqBy(list, fn) {
    const recordMap = /* @__PURE__ */ Object.create(null);
    return list.reduce((out, item)=>{
        const key = fn(item);
        if (!recordMap[key]) {
            recordMap[key] = true;
            out.push(item);
        }
        return out;
    }, []);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(uniqBy, "uniqBy");
var setDirection = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(dir2) {
    state.records.direction = dir2;
}, "setDirection");
var setOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(rawOptString) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("options str", rawOptString);
    rawOptString = rawOptString === null || rawOptString === void 0 ? void 0 : rawOptString.trim();
    rawOptString = rawOptString || "{}";
    try {
        state.records.options = JSON.parse(rawOptString);
    } catch (e) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error("error while parsing gitGraph options", e.message);
    }
}, "setOptions");
var getOptions = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return state.records.options;
}, "getOptions");
var commit = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(commitDB) {
    let msg = commitDB.msg;
    let id = commitDB.id;
    const type = commitDB.type;
    let tags = commitDB.tags;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("commit", msg, id, type, tags);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Entering commit:", msg, id, type, tags);
    const config = getConfig3();
    id = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(id, config);
    msg = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(msg, config);
    tags = tags === null || tags === void 0 ? void 0 : tags.map((tag)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(tag, config));
    const newCommit = {
        id: id ? id : state.records.seq + "-" + getID(),
        message: msg,
        seq: state.records.seq++,
        type: type !== null && type !== void 0 ? type : commitType.NORMAL,
        tags: tags !== null && tags !== void 0 ? tags : [],
        parents: state.records.head == null ? [] : [
            state.records.head.id
        ],
        branch: state.records.currBranch
    };
    state.records.head = newCommit;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].info("main branch", config.mainBranchName);
    if (state.records.commits.has(newCommit.id)) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].warn("Commit ID ".concat(newCommit.id, " already exists"));
    }
    state.records.commits.set(newCommit.id, newCommit);
    state.records.branches.set(state.records.currBranch, newCommit.id);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("in pushCommit " + newCommit.id);
}, "commit");
var branch = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(branchDB) {
    let name = branchDB.name;
    const order = branchDB.order;
    name = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(name, getConfig3());
    if (state.records.branches.has(name)) {
        throw new Error('Trying to create an existing branch. (Help: Either use a new name if you want create a new branch or try using "checkout '.concat(name, '")'));
    }
    state.records.branches.set(name, state.records.head != null ? state.records.head.id : null);
    state.records.branchConfig.set(name, {
        name,
        order
    });
    checkout(name);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("in createBranch");
}, "branch");
var merge = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((mergeDB)=>{
    let otherBranch = mergeDB.branch;
    let customId = mergeDB.id;
    const overrideType = mergeDB.type;
    const customTags = mergeDB.tags;
    const config = getConfig3();
    otherBranch = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(otherBranch, config);
    if (customId) {
        customId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(customId, config);
    }
    const currentBranchCheck = state.records.branches.get(state.records.currBranch);
    const otherBranchCheck = state.records.branches.get(otherBranch);
    const currentCommit = currentBranchCheck ? state.records.commits.get(currentBranchCheck) : void 0;
    const otherCommit = otherBranchCheck ? state.records.commits.get(otherBranchCheck) : void 0;
    if (currentCommit && otherCommit && currentCommit.branch === otherBranch) {
        throw new Error("Cannot merge branch '".concat(otherBranch, "' into itself."));
    }
    if (state.records.currBranch === otherBranch) {
        const error = new Error('Incorrect usage of "merge". Cannot merge a branch to itself');
        error.hash = {
            text: "merge ".concat(otherBranch),
            token: "merge ".concat(otherBranch),
            expected: [
                "branch abc"
            ]
        };
        throw error;
    }
    if (currentCommit === void 0 || !currentCommit) {
        const error = new Error('Incorrect usage of "merge". Current branch ('.concat(state.records.currBranch, ")has no commits"));
        error.hash = {
            text: "merge ".concat(otherBranch),
            token: "merge ".concat(otherBranch),
            expected: [
                "commit"
            ]
        };
        throw error;
    }
    if (!state.records.branches.has(otherBranch)) {
        const error = new Error('Incorrect usage of "merge". Branch to be merged (' + otherBranch + ") does not exist");
        error.hash = {
            text: "merge ".concat(otherBranch),
            token: "merge ".concat(otherBranch),
            expected: [
                "branch ".concat(otherBranch)
            ]
        };
        throw error;
    }
    if (otherCommit === void 0 || !otherCommit) {
        const error = new Error('Incorrect usage of "merge". Branch to be merged (' + otherBranch + ") has no commits");
        error.hash = {
            text: "merge ".concat(otherBranch),
            token: "merge ".concat(otherBranch),
            expected: [
                '"commit"'
            ]
        };
        throw error;
    }
    if (currentCommit === otherCommit) {
        const error = new Error('Incorrect usage of "merge". Both branches have same head');
        error.hash = {
            text: "merge ".concat(otherBranch),
            token: "merge ".concat(otherBranch),
            expected: [
                "branch abc"
            ]
        };
        throw error;
    }
    if (customId && state.records.commits.has(customId)) {
        const error = new Error('Incorrect usage of "merge". Commit with id:' + customId + " already exists, use different custom id");
        error.hash = {
            text: "merge ".concat(otherBranch, " ").concat(customId, " ").concat(overrideType, " ").concat(customTags === null || customTags === void 0 ? void 0 : customTags.join(" ")),
            token: "merge ".concat(otherBranch, " ").concat(customId, " ").concat(overrideType, " ").concat(customTags === null || customTags === void 0 ? void 0 : customTags.join(" ")),
            expected: [
                "merge ".concat(otherBranch, " ").concat(customId, "_UNIQUE ").concat(overrideType, " ").concat(customTags === null || customTags === void 0 ? void 0 : customTags.join(" "))
            ]
        };
        throw error;
    }
    const verifiedBranch = otherBranchCheck ? otherBranchCheck : "";
    const commit2 = {
        id: customId || "".concat(state.records.seq, "-").concat(getID()),
        message: "merged branch ".concat(otherBranch, " into ").concat(state.records.currBranch),
        seq: state.records.seq++,
        parents: state.records.head == null ? [] : [
            state.records.head.id,
            verifiedBranch
        ],
        branch: state.records.currBranch,
        type: commitType.MERGE,
        customType: overrideType,
        customId: customId ? true : false,
        tags: customTags !== null && customTags !== void 0 ? customTags : []
    };
    state.records.head = commit2;
    state.records.commits.set(commit2.id, commit2);
    state.records.branches.set(state.records.currBranch, commit2.id);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(state.records.branches);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("in mergeBranch");
}, "merge");
var cherryPick = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(cherryPickDB) {
    let sourceId = cherryPickDB.id;
    let targetId = cherryPickDB.targetId;
    let tags = cherryPickDB.tags;
    let parentCommitId = cherryPickDB.parent;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("Entering cherryPick:", sourceId, targetId, tags);
    const config = getConfig3();
    sourceId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(sourceId, config);
    targetId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(targetId, config);
    tags = tags === null || tags === void 0 ? void 0 : tags.map((tag)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(tag, config));
    parentCommitId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(parentCommitId, config);
    if (!sourceId || !state.records.commits.has(sourceId)) {
        const error = new Error('Incorrect usage of "cherryPick". Source commit id should exist and provided');
        error.hash = {
            text: "cherryPick ".concat(sourceId, " ").concat(targetId),
            token: "cherryPick ".concat(sourceId, " ").concat(targetId),
            expected: [
                "cherry-pick abc"
            ]
        };
        throw error;
    }
    const sourceCommit = state.records.commits.get(sourceId);
    if (sourceCommit === void 0 || !sourceCommit) {
        throw new Error('Incorrect usage of "cherryPick". Source commit id should exist and provided');
    }
    if (parentCommitId && !(Array.isArray(sourceCommit.parents) && sourceCommit.parents.includes(parentCommitId))) {
        const error = new Error("Invalid operation: The specified parent commit is not an immediate parent of the cherry-picked commit.");
        throw error;
    }
    const sourceCommitBranch = sourceCommit.branch;
    if (sourceCommit.type === commitType.MERGE && !parentCommitId) {
        const error = new Error("Incorrect usage of cherry-pick: If the source commit is a merge commit, an immediate parent commit must be specified.");
        throw error;
    }
    if (!targetId || !state.records.commits.has(targetId)) {
        if (sourceCommitBranch === state.records.currBranch) {
            const error = new Error('Incorrect usage of "cherryPick". Source commit is already on current branch');
            error.hash = {
                text: "cherryPick ".concat(sourceId, " ").concat(targetId),
                token: "cherryPick ".concat(sourceId, " ").concat(targetId),
                expected: [
                    "cherry-pick abc"
                ]
            };
            throw error;
        }
        const currentCommitId = state.records.branches.get(state.records.currBranch);
        if (currentCommitId === void 0 || !currentCommitId) {
            const error = new Error('Incorrect usage of "cherry-pick". Current branch ('.concat(state.records.currBranch, ")has no commits"));
            error.hash = {
                text: "cherryPick ".concat(sourceId, " ").concat(targetId),
                token: "cherryPick ".concat(sourceId, " ").concat(targetId),
                expected: [
                    "cherry-pick abc"
                ]
            };
            throw error;
        }
        const currentCommit = state.records.commits.get(currentCommitId);
        if (currentCommit === void 0 || !currentCommit) {
            const error = new Error('Incorrect usage of "cherry-pick". Current branch ('.concat(state.records.currBranch, ")has no commits"));
            error.hash = {
                text: "cherryPick ".concat(sourceId, " ").concat(targetId),
                token: "cherryPick ".concat(sourceId, " ").concat(targetId),
                expected: [
                    "cherry-pick abc"
                ]
            };
            throw error;
        }
        const commit2 = {
            id: state.records.seq + "-" + getID(),
            message: "cherry-picked ".concat(sourceCommit === null || sourceCommit === void 0 ? void 0 : sourceCommit.message, " into ").concat(state.records.currBranch),
            seq: state.records.seq++,
            parents: state.records.head == null ? [] : [
                state.records.head.id,
                sourceCommit.id
            ],
            branch: state.records.currBranch,
            type: commitType.CHERRY_PICK,
            tags: tags ? tags.filter(Boolean) : [
                "cherry-pick:".concat(sourceCommit.id).concat(sourceCommit.type === commitType.MERGE ? "|parent:".concat(parentCommitId) : "")
            ]
        };
        state.records.head = commit2;
        state.records.commits.set(commit2.id, commit2);
        state.records.branches.set(state.records.currBranch, commit2.id);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(state.records.branches);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("in cherryPick");
    }
}, "cherryPick");
var checkout = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(branch2) {
    branch2 = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["common_default"].sanitizeText(branch2, getConfig3());
    if (!state.records.branches.has(branch2)) {
        const error = new Error('Trying to checkout branch which is not yet created. (Help try using "branch '.concat(branch2, '")'));
        error.hash = {
            text: "checkout ".concat(branch2),
            token: "checkout ".concat(branch2),
            expected: [
                "branch ".concat(branch2)
            ]
        };
        throw error;
    } else {
        state.records.currBranch = branch2;
        const id = state.records.branches.get(state.records.currBranch);
        if (id === void 0 || !id) {
            state.records.head = null;
        } else {
            var _state_records_commits_get;
            state.records.head = (_state_records_commits_get = state.records.commits.get(id)) !== null && _state_records_commits_get !== void 0 ? _state_records_commits_get : null;
        }
    }
}, "checkout");
function upsert(arr, key, newVal) {
    const index = arr.indexOf(key);
    if (index === -1) {
        arr.push(newVal);
    } else {
        arr.splice(index, 1, newVal);
    }
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(upsert, "upsert");
function prettyPrintCommitHistory(commitArr) {
    const commit2 = commitArr.reduce((out, commit3)=>{
        if (out.seq > commit3.seq) {
            return out;
        }
        return commit3;
    }, commitArr[0]);
    let line = "";
    commitArr.forEach(function(c) {
        if (c === commit2) {
            line += "	*";
        } else {
            line += "	|";
        }
    });
    const label = [
        line,
        commit2.id,
        commit2.seq
    ];
    for(const branch2 in state.records.branches){
        if (state.records.branches.get(branch2) === commit2.id) {
            label.push(branch2);
        }
    }
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(label.join(" "));
    if (commit2.parents && commit2.parents.length == 2 && commit2.parents[0] && commit2.parents[1]) {
        const newCommit = state.records.commits.get(commit2.parents[0]);
        upsert(commitArr, commit2, newCommit);
        if (commit2.parents[1]) {
            commitArr.push(state.records.commits.get(commit2.parents[1]));
        }
    } else if (commit2.parents.length == 0) {
        return;
    } else {
        if (commit2.parents[0]) {
            const newCommit = state.records.commits.get(commit2.parents[0]);
            upsert(commitArr, commit2, newCommit);
        }
    }
    commitArr = uniqBy(commitArr, (c)=>c.id);
    prettyPrintCommitHistory(commitArr);
}
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(prettyPrintCommitHistory, "prettyPrintCommitHistory");
var prettyPrint = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(state.records.commits);
    const node = getCommitsArray()[0];
    prettyPrintCommitHistory([
        node
    ]);
}, "prettyPrint");
var clear2 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    state.reset();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clear"])();
}, "clear");
var getBranchesAsObjArray = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    const branchesArray = [
        ...state.records.branchConfig.values()
    ].map((branchConfig, i)=>{
        if (branchConfig.order !== null && branchConfig.order !== void 0) {
            return branchConfig;
        }
        return {
            ...branchConfig,
            order: parseFloat("0.".concat(i))
        };
    }).sort((a, b)=>{
        var _a_order, _b_order;
        return ((_a_order = a.order) !== null && _a_order !== void 0 ? _a_order : 0) - ((_b_order = b.order) !== null && _b_order !== void 0 ? _b_order : 0);
    }).map((param)=>{
        let { name } = param;
        return {
            name
        };
    });
    return branchesArray;
}, "getBranchesAsObjArray");
var getBranches = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return state.records.branches;
}, "getBranches");
var getCommits = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return state.records.commits;
}, "getCommits");
var getCommitsArray = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    const commitArr = [
        ...state.records.commits.values()
    ];
    commitArr.forEach(function(o) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(o.id);
    });
    commitArr.sort((a, b)=>a.seq - b.seq);
    return commitArr;
}, "getCommitsArray");
var getCurrentBranch = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return state.records.currBranch;
}, "getCurrentBranch");
var getDirection = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return state.records.direction;
}, "getDirection");
var getHead = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function() {
    return state.records.head;
}, "getHead");
var db = {
    commitType,
    getConfig: getConfig3,
    setDirection,
    setOptions,
    getOptions,
    commit,
    branch,
    merge,
    cherryPick,
    checkout,
    //reset,
    prettyPrint,
    clear: clear2,
    getBranchesAsObjArray,
    getBranches,
    getCommits,
    getCommitsArray,
    getCurrentBranch,
    getDirection,
    getHead,
    setAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccTitle"],
    getAccTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccTitle"],
    getAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccDescription"],
    setAccDescription: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAccDescription"],
    setDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setDiagramTitle"],
    getDiagramTitle: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDiagramTitle"]
};
// src/diagrams/git/gitGraphParser.ts
var populate = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((ast, db2)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$JWPE2WC7$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["populateCommonDb"])(ast, db2);
    if (ast.dir) {
        db2.setDirection(ast.dir);
    }
    for (const statement of ast.statements){
        parseStatement(statement, db2);
    }
}, "populate");
var parseStatement = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((statement, db2)=>{
    const parsers = {
        Commit: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((stmt)=>db2.commit(parseCommit(stmt)), "Commit"),
        Branch: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((stmt)=>db2.branch(parseBranch(stmt)), "Branch"),
        Merge: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((stmt)=>db2.merge(parseMerge(stmt)), "Merge"),
        Checkout: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((stmt)=>db2.checkout(parseCheckout(stmt)), "Checkout"),
        CherryPicking: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((stmt)=>db2.cherryPick(parseCherryPicking(stmt)), "CherryPicking")
    };
    const parser2 = parsers[statement.$type];
    if (parser2) {
        parser2(statement);
    } else {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error("Unknown statement type: ".concat(statement.$type));
    }
}, "parseStatement");
var parseCommit = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2)=>{
    var _commit2_message, _commit2_tags;
    const commitDB = {
        id: commit2.id,
        msg: (_commit2_message = commit2.message) !== null && _commit2_message !== void 0 ? _commit2_message : "",
        type: commit2.type !== void 0 ? commitType[commit2.type] : commitType.NORMAL,
        tags: (_commit2_tags = commit2.tags) !== null && _commit2_tags !== void 0 ? _commit2_tags : void 0
    };
    return commitDB;
}, "parseCommit");
var parseBranch = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((branch2)=>{
    var _branch2_order;
    const branchDB = {
        name: branch2.name,
        order: (_branch2_order = branch2.order) !== null && _branch2_order !== void 0 ? _branch2_order : 0
    };
    return branchDB;
}, "parseBranch");
var parseMerge = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((merge2)=>{
    var _merge2_id, _merge2_tags;
    const mergeDB = {
        branch: merge2.branch,
        id: (_merge2_id = merge2.id) !== null && _merge2_id !== void 0 ? _merge2_id : "",
        type: merge2.type !== void 0 ? commitType[merge2.type] : void 0,
        tags: (_merge2_tags = merge2.tags) !== null && _merge2_tags !== void 0 ? _merge2_tags : void 0
    };
    return mergeDB;
}, "parseMerge");
var parseCheckout = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((checkout2)=>{
    const branch2 = checkout2.branch;
    return branch2;
}, "parseCheckout");
var parseCherryPicking = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((cherryPicking)=>{
    var _cherryPicking_tags;
    const cherryPickDB = {
        id: cherryPicking.id,
        targetId: "",
        tags: ((_cherryPicking_tags = cherryPicking.tags) === null || _cherryPicking_tags === void 0 ? void 0 : _cherryPicking_tags.length) === 0 ? void 0 : cherryPicking.tags,
        parent: cherryPicking.parent
    };
    return cherryPickDB;
}, "parseCherryPicking");
var parser = {
    parse: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(async (input)=>{
        const ast = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$mermaid$2d$js$2f$parser$2f$dist$2f$mermaid$2d$parser$2e$core$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["parse"])("gitGraph", input);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug(ast);
        populate(ast, db);
    }, "parse")
};
if (void 0) {
    const { it, expect, describe } = void 0;
    const mockDB = {
        commitType,
        setDirection: vi.fn(),
        commit: vi.fn(),
        branch: vi.fn(),
        merge: vi.fn(),
        cherryPick: vi.fn(),
        checkout: vi.fn()
    };
    describe("GitGraph Parser", ()=>{
        it("should parse a commit statement", ()=>{
            const commit2 = {
                $type: "Commit",
                id: "1",
                message: "test",
                tags: [
                    "tag1",
                    "tag2"
                ],
                type: "NORMAL"
            };
            parseStatement(commit2, mockDB);
            expect(mockDB.commit).toHaveBeenCalledWith({
                id: "1",
                msg: "test",
                tags: [
                    "tag1",
                    "tag2"
                ],
                type: 0
            });
        });
        it("should parse a branch statement", ()=>{
            const branch2 = {
                $type: "Branch",
                name: "newBranch",
                order: 1
            };
            parseStatement(branch2, mockDB);
            expect(mockDB.branch).toHaveBeenCalledWith({
                name: "newBranch",
                order: 1
            });
        });
        it("should parse a checkout statement", ()=>{
            const checkout2 = {
                $type: "Checkout",
                branch: "newBranch"
            };
            parseStatement(checkout2, mockDB);
            expect(mockDB.checkout).toHaveBeenCalledWith("newBranch");
        });
        it("should parse a merge statement", ()=>{
            const merge2 = {
                $type: "Merge",
                branch: "newBranch",
                id: "1",
                tags: [
                    "tag1",
                    "tag2"
                ],
                type: "NORMAL"
            };
            parseStatement(merge2, mockDB);
            expect(mockDB.merge).toHaveBeenCalledWith({
                branch: "newBranch",
                id: "1",
                tags: [
                    "tag1",
                    "tag2"
                ],
                type: 0
            });
        });
        it("should parse a cherry picking statement", ()=>{
            const cherryPick2 = {
                $type: "CherryPicking",
                id: "1",
                tags: [
                    "tag1",
                    "tag2"
                ],
                parent: "2"
            };
            parseStatement(cherryPick2, mockDB);
            expect(mockDB.cherryPick).toHaveBeenCalledWith({
                id: "1",
                targetId: "",
                parent: "2",
                tags: [
                    "tag1",
                    "tag2"
                ]
            });
        });
        it("should parse a langium generated gitGraph ast", ()=>{
            const dummy = {
                $type: "GitGraph",
                statements: [],
                accDescr: "",
                accTitle: "",
                title: ""
            };
            const gitGraphAst = {
                $type: "GitGraph",
                statements: [
                    {
                        $container: dummy,
                        $type: "Commit",
                        id: "1",
                        message: "test",
                        tags: [
                            "tag1",
                            "tag2"
                        ],
                        type: "NORMAL"
                    },
                    {
                        $container: dummy,
                        $type: "Branch",
                        name: "newBranch",
                        order: 1
                    },
                    {
                        $container: dummy,
                        $type: "Merge",
                        branch: "newBranch",
                        id: "1",
                        tags: [
                            "tag1",
                            "tag2"
                        ],
                        type: "NORMAL"
                    },
                    {
                        $container: dummy,
                        $type: "Checkout",
                        branch: "newBranch"
                    },
                    {
                        $container: dummy,
                        $type: "CherryPicking",
                        id: "1",
                        tags: [
                            "tag1",
                            "tag2"
                        ],
                        parent: "2"
                    }
                ],
                accDescr: "",
                accTitle: "",
                title: ""
            };
            populate(gitGraphAst, mockDB);
            expect(mockDB.commit).toHaveBeenCalledWith({
                id: "1",
                msg: "test",
                tags: [
                    "tag1",
                    "tag2"
                ],
                type: 0
            });
            expect(mockDB.branch).toHaveBeenCalledWith({
                name: "newBranch",
                order: 1
            });
            expect(mockDB.merge).toHaveBeenCalledWith({
                branch: "newBranch",
                id: "1",
                tags: [
                    "tag1",
                    "tag2"
                ],
                type: 0
            });
            expect(mockDB.checkout).toHaveBeenCalledWith("newBranch");
        });
    });
}
;
var LAYOUT_OFFSET = 10;
var COMMIT_STEP = 40;
var PX = 4;
var PY = 2;
var THEME_COLOR_LIMIT = 8;
var REDUX_GEOMETRY_THEMES = /* @__PURE__ */ new Set([
    "redux",
    "redux-dark",
    "redux-color",
    "redux-dark-color"
]);
var REDUX_BRANCH_LABEL_PADDING_Y = 12;
var COLOR_THEMES = /* @__PURE__ */ new Set([
    "redux-color",
    "redux-dark-color"
]);
var DARK_THEMES = /* @__PURE__ */ new Set([
    "dark",
    "redux-dark",
    "redux-dark-color",
    "neo-dark"
]);
var calcColorIndex = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(rawIndex, limit) {
    let avoidDefaultColor = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    if (avoidDefaultColor && rawIndex > 0) {
        return (rawIndex - 1) % (limit - 1) + 1;
    }
    return rawIndex % limit;
}, "calcColorIndex");
var branchPos = /* @__PURE__ */ new Map();
var commitPos = /* @__PURE__ */ new Map();
var defaultPos = 30;
var allCommitsDict = /* @__PURE__ */ new Map();
var lanes = [];
var maxPos = 0;
var dir = "LR";
var clear3 = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>{
    branchPos.clear();
    commitPos.clear();
    allCommitsDict.clear();
    maxPos = 0;
    lanes = [];
    dir = "LR";
}, "clear");
var drawText = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((txt)=>{
    const svgLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const rows = typeof txt === "string" ? txt.split(/\\n|\n|<br\s*\/?>/gi) : txt;
    rows.forEach((row)=>{
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
        tspan.setAttribute("dy", "1em");
        tspan.setAttribute("x", "0");
        tspan.setAttribute("class", "row");
        tspan.textContent = row.trim();
        svgLabel.appendChild(tspan);
    });
    return svgLabel;
}, "drawText");
var findClosestParent = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((parents)=>{
    let closestParent;
    let comparisonFunc;
    let targetPosition;
    if (dir === "BT") {
        comparisonFunc = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((a, b)=>a <= b, "comparisonFunc");
        targetPosition = Infinity;
    } else {
        comparisonFunc = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((a, b)=>a >= b, "comparisonFunc");
        targetPosition = 0;
    }
    parents.forEach((parent)=>{
        var _commitPos_get, _commitPos_get1;
        const parentPosition = dir === "TB" || dir == "BT" ? (_commitPos_get = commitPos.get(parent)) === null || _commitPos_get === void 0 ? void 0 : _commitPos_get.y : (_commitPos_get1 = commitPos.get(parent)) === null || _commitPos_get1 === void 0 ? void 0 : _commitPos_get1.x;
        if (parentPosition !== void 0 && comparisonFunc(parentPosition, targetPosition)) {
            closestParent = parent;
            targetPosition = parentPosition;
        }
    });
    return closestParent;
}, "findClosestParent");
var findClosestParentBT = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((parents)=>{
    let closestParent = "";
    let maxPosition = Infinity;
    parents.forEach((parent)=>{
        const parentPosition = commitPos.get(parent).y;
        if (parentPosition <= maxPosition) {
            closestParent = parent;
            maxPosition = parentPosition;
        }
    });
    return closestParent || void 0;
}, "findClosestParentBT");
var setParallelBTPos = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((sortedKeys, commits, defaultPos2)=>{
    let curPos = defaultPos2;
    let maxPosition = defaultPos2;
    const roots = [];
    sortedKeys.forEach((key)=>{
        const commit2 = commits.get(key);
        if (!commit2) {
            throw new Error("Commit not found for key ".concat(key));
        }
        if (commit2.parents.length) {
            curPos = calculateCommitPosition(commit2);
            maxPosition = Math.max(curPos, maxPosition);
        } else {
            roots.push(commit2);
        }
        setCommitPosition(commit2, curPos);
    });
    curPos = maxPosition;
    roots.forEach((commit2)=>{
        setRootPosition(commit2, curPos, defaultPos2);
    });
    sortedKeys.forEach((key)=>{
        const commit2 = commits.get(key);
        if (commit2 === null || commit2 === void 0 ? void 0 : commit2.parents.length) {
            const closestParent = findClosestParentBT(commit2.parents);
            curPos = commitPos.get(closestParent).y - COMMIT_STEP;
            if (curPos <= maxPosition) {
                maxPosition = curPos;
            }
            const x = branchPos.get(commit2.branch).pos;
            const y = curPos - LAYOUT_OFFSET;
            commitPos.set(commit2.id, {
                x,
                y
            });
        }
    });
}, "setParallelBTPos");
var findClosestParentPos = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2)=>{
    var _commitPos_get;
    const closestParent = findClosestParent(commit2.parents.filter((p)=>p !== null));
    if (!closestParent) {
        throw new Error("Closest parent not found for commit ".concat(commit2.id));
    }
    const closestParentPos = (_commitPos_get = commitPos.get(closestParent)) === null || _commitPos_get === void 0 ? void 0 : _commitPos_get.y;
    if (closestParentPos === void 0) {
        throw new Error("Closest parent position not found for commit ".concat(commit2.id));
    }
    return closestParentPos;
}, "findClosestParentPos");
var calculateCommitPosition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2)=>{
    const closestParentPos = findClosestParentPos(commit2);
    return closestParentPos + COMMIT_STEP;
}, "calculateCommitPosition");
var setCommitPosition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2, curPos)=>{
    const branch2 = branchPos.get(commit2.branch);
    if (!branch2) {
        throw new Error("Branch not found for commit ".concat(commit2.id));
    }
    const x = branch2.pos;
    const y = curPos + LAYOUT_OFFSET;
    commitPos.set(commit2.id, {
        x,
        y
    });
    return {
        x,
        y
    };
}, "setCommitPosition");
var setRootPosition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2, curPos, defaultPos2)=>{
    const branch2 = branchPos.get(commit2.branch);
    if (!branch2) {
        throw new Error("Branch not found for commit ".concat(commit2.id));
    }
    const y = curPos + defaultPos2;
    const x = branch2.pos;
    commitPos.set(commit2.id, {
        x,
        y
    });
}, "setRootPosition");
var drawCommitBullet = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((gBullets, commit2, commitPosition, typeClass, branchIndex, commitSymbolType)=>{
    const { theme } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    const useReduxGeometry = REDUX_GEOMETRY_THEMES.has(theme !== null && theme !== void 0 ? theme : "");
    const useColorTheme = COLOR_THEMES.has(theme !== null && theme !== void 0 ? theme : "");
    const isDark = DARK_THEMES.has(theme !== null && theme !== void 0 ? theme : "");
    if (commitSymbolType === commitType.HIGHLIGHT) {
        gBullets.append("rect").attr("x", commitPosition.x - 10 + (useReduxGeometry ? 3 : 0)).attr("y", commitPosition.y - 10 + (useReduxGeometry ? 3 : 0)).attr("width", useReduxGeometry ? 14 : 20).attr("height", useReduxGeometry ? 14 : 20).attr("class", "commit ".concat(commit2.id, " commit-highlight").concat(calcColorIndex(branchIndex, THEME_COLOR_LIMIT, useColorTheme), " ").concat(typeClass, "-outer"));
        gBullets.append("rect").attr("x", commitPosition.x - 6 + (useReduxGeometry ? 2 : 0)).attr("y", commitPosition.y - 6 + (useReduxGeometry ? 2 : 0)).attr("width", useReduxGeometry ? 8 : 12).attr("height", useReduxGeometry ? 8 : 12).attr("class", "commit ".concat(commit2.id, " commit").concat(calcColorIndex(branchIndex, THEME_COLOR_LIMIT, useColorTheme), " ").concat(typeClass, "-inner"));
    } else if (commitSymbolType === commitType.CHERRY_PICK) {
        gBullets.append("circle").attr("cx", commitPosition.x).attr("cy", commitPosition.y).attr("r", useReduxGeometry ? 7 : 10).attr("class", "commit ".concat(commit2.id, " ").concat(typeClass));
        gBullets.append("circle").attr("cx", commitPosition.x - 3).attr("cy", commitPosition.y + 2).attr("r", useReduxGeometry ? 2.5 : 2.75).attr("fill", isDark ? "#000000" : "#fff").attr("class", "commit ".concat(commit2.id, " ").concat(typeClass));
        gBullets.append("circle").attr("cx", commitPosition.x + 3).attr("cy", commitPosition.y + 2).attr("r", useReduxGeometry ? 2.5 : 2.75).attr("fill", isDark ? "#000000" : "#fff").attr("class", "commit ".concat(commit2.id, " ").concat(typeClass));
        gBullets.append("line").attr("x1", commitPosition.x + 3).attr("y1", commitPosition.y + 1).attr("x2", commitPosition.x).attr("y2", commitPosition.y - 5).attr("stroke", isDark ? "#000000" : "#fff").attr("class", "commit ".concat(commit2.id, " ").concat(typeClass));
        gBullets.append("line").attr("x1", commitPosition.x - 3).attr("y1", commitPosition.y + 1).attr("x2", commitPosition.x).attr("y2", commitPosition.y - 5).attr("stroke", isDark ? "#000000" : "#fff").attr("class", "commit ".concat(commit2.id, " ").concat(typeClass));
    } else {
        const circle = gBullets.append("circle");
        circle.attr("cx", commitPosition.x);
        circle.attr("cy", commitPosition.y);
        circle.attr("r", useReduxGeometry ? 7 : 10);
        circle.attr("class", "commit ".concat(commit2.id, " commit").concat(calcColorIndex(branchIndex, THEME_COLOR_LIMIT, useColorTheme)));
        if (commitSymbolType === commitType.MERGE) {
            const circle2 = gBullets.append("circle");
            circle2.attr("cx", commitPosition.x);
            circle2.attr("cy", commitPosition.y);
            circle2.attr("r", useReduxGeometry ? 5 : 6);
            circle2.attr("class", "commit ".concat(typeClass, " ").concat(commit2.id, " commit").concat(calcColorIndex(branchIndex, THEME_COLOR_LIMIT, useColorTheme)));
        }
        if (commitSymbolType === commitType.REVERSE) {
            const cross = gBullets.append("path");
            const constValue = useReduxGeometry ? 4 : 5;
            cross.attr("d", "M ".concat(commitPosition.x - constValue, ",").concat(commitPosition.y - constValue, "L").concat(commitPosition.x + constValue, ",").concat(commitPosition.y + constValue, "M").concat(commitPosition.x - constValue, ",").concat(commitPosition.y + constValue, "L").concat(commitPosition.x + constValue, ",").concat(commitPosition.y - constValue)).attr("class", "commit ".concat(typeClass, " ").concat(commit2.id, " commit").concat(calcColorIndex(branchIndex, THEME_COLOR_LIMIT, useColorTheme)));
        }
    }
}, "drawCommitBullet");
var drawCommitLabel = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((gLabels, commit2, commitPosition, pos, gitGraphConfig)=>{
    if (commit2.type !== commitType.CHERRY_PICK && (commit2.customId && commit2.type === commitType.MERGE || commit2.type !== commitType.MERGE) && gitGraphConfig.showCommitLabel) {
        var _text_node;
        const wrapper = gLabels.append("g");
        const labelBkg = wrapper.insert("rect").attr("class", "commit-label-bkg");
        const text = wrapper.append("text").attr("x", pos).attr("y", commitPosition.y + 25).attr("class", "commit-label").text(commit2.id);
        const bbox = (_text_node = text.node()) === null || _text_node === void 0 ? void 0 : _text_node.getBBox();
        if (bbox) {
            labelBkg.attr("x", commitPosition.posWithOffset - bbox.width / 2 - PY).attr("y", commitPosition.y + 13.5).attr("width", bbox.width + 2 * PY).attr("height", bbox.height + 2 * PY);
            if (dir === "TB" || dir === "BT") {
                labelBkg.attr("x", commitPosition.x - (bbox.width + 4 * PX + 5)).attr("y", commitPosition.y - 12);
                text.attr("x", commitPosition.x - (bbox.width + 4 * PX)).attr("y", commitPosition.y + bbox.height - 12);
            } else {
                text.attr("x", commitPosition.posWithOffset - bbox.width / 2);
            }
            if (gitGraphConfig.rotateCommitLabel) {
                if (dir === "TB" || dir === "BT") {
                    text.attr("transform", "rotate(-45, " + commitPosition.x + ", " + commitPosition.y + ")");
                    labelBkg.attr("transform", "rotate(-45, " + commitPosition.x + ", " + commitPosition.y + ")");
                } else {
                    const r_x = -7.5 - (bbox.width + 10) / 25 * 9.5;
                    const r_y = 10 + bbox.width / 25 * 8.5;
                    wrapper.attr("transform", "translate(" + r_x + ", " + r_y + ") rotate(-45, " + pos + ", " + commitPosition.y + ")");
                }
            }
        }
    }
}, "drawCommitLabel");
var drawCommitTags = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((gLabels, commit2, commitPosition, pos)=>{
    if (commit2.tags.length > 0) {
        let yOffset = 0;
        let maxTagBboxWidth = 0;
        let maxTagBboxHeight = 0;
        const tagElements = [];
        for (const tagValue of commit2.tags.reverse()){
            var _tag_node;
            const rect = gLabels.insert("polygon");
            const hole = gLabels.append("circle");
            const tag = gLabels.append("text").attr("y", commitPosition.y - 16 - yOffset).attr("class", "tag-label").text(tagValue);
            const tagBbox = (_tag_node = tag.node()) === null || _tag_node === void 0 ? void 0 : _tag_node.getBBox();
            if (!tagBbox) {
                throw new Error("Tag bbox not found");
            }
            maxTagBboxWidth = Math.max(maxTagBboxWidth, tagBbox.width);
            maxTagBboxHeight = Math.max(maxTagBboxHeight, tagBbox.height);
            tag.attr("x", commitPosition.posWithOffset - tagBbox.width / 2);
            tagElements.push({
                tag,
                hole,
                rect,
                yOffset
            });
            yOffset += 20;
        }
        for (const { tag, hole, rect, yOffset: yOffset2 } of tagElements){
            const h2 = maxTagBboxHeight / 2;
            const ly = commitPosition.y - 19.2 - yOffset2;
            rect.attr("class", "tag-label-bkg").attr("points", "\n      ".concat(pos - maxTagBboxWidth / 2 - PX / 2, ",").concat(ly + PY, "  \n      ").concat(pos - maxTagBboxWidth / 2 - PX / 2, ",").concat(ly - PY, "\n      ").concat(commitPosition.posWithOffset - maxTagBboxWidth / 2 - PX, ",").concat(ly - h2 - PY, "\n      ").concat(commitPosition.posWithOffset + maxTagBboxWidth / 2 + PX, ",").concat(ly - h2 - PY, "\n      ").concat(commitPosition.posWithOffset + maxTagBboxWidth / 2 + PX, ",").concat(ly + h2 + PY, "\n      ").concat(commitPosition.posWithOffset - maxTagBboxWidth / 2 - PX, ",").concat(ly + h2 + PY));
            hole.attr("cy", ly).attr("cx", pos - maxTagBboxWidth / 2 + PX / 2).attr("r", 1.5).attr("class", "tag-hole");
            if (dir === "TB" || dir === "BT") {
                const yOrigin = pos + yOffset2;
                rect.attr("class", "tag-label-bkg").attr("points", "\n        ".concat(commitPosition.x, ",").concat(yOrigin + 2, "\n        ").concat(commitPosition.x, ",").concat(yOrigin - 2, "\n        ").concat(commitPosition.x + LAYOUT_OFFSET, ",").concat(yOrigin - h2 - 2, "\n        ").concat(commitPosition.x + LAYOUT_OFFSET + maxTagBboxWidth + 4, ",").concat(yOrigin - h2 - 2, "\n        ").concat(commitPosition.x + LAYOUT_OFFSET + maxTagBboxWidth + 4, ",").concat(yOrigin + h2 + 2, "\n        ").concat(commitPosition.x + LAYOUT_OFFSET, ",").concat(yOrigin + h2 + 2)).attr("transform", "translate(12,12) rotate(45, " + commitPosition.x + "," + pos + ")");
                hole.attr("cx", commitPosition.x + PX / 2).attr("cy", yOrigin).attr("transform", "translate(12,12) rotate(45, " + commitPosition.x + "," + pos + ")");
                tag.attr("x", commitPosition.x + 5).attr("y", yOrigin + 3).attr("transform", "translate(14,14) rotate(45, " + commitPosition.x + "," + pos + ")");
            }
        }
    }
}, "drawCommitTags");
var getCommitClassType = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2)=>{
    var _commit2_customType;
    const commitSymbolType = (_commit2_customType = commit2.customType) !== null && _commit2_customType !== void 0 ? _commit2_customType : commit2.type;
    switch(commitSymbolType){
        case commitType.NORMAL:
            return "commit-normal";
        case commitType.REVERSE:
            return "commit-reverse";
        case commitType.HIGHLIGHT:
            return "commit-highlight";
        case commitType.MERGE:
            return "commit-merge";
        case commitType.CHERRY_PICK:
            return "commit-cherry-pick";
        default:
            return "commit-normal";
    }
}, "getCommitClassType");
var calculatePosition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2, dir2, pos, commitPos2)=>{
    const defaultCommitPosition = {
        x: 0,
        y: 0
    };
    if (commit2.parents.length > 0) {
        const closestParent = findClosestParent(commit2.parents);
        if (closestParent) {
            var _commitPos2_get;
            const parentPosition = (_commitPos2_get = commitPos2.get(closestParent)) !== null && _commitPos2_get !== void 0 ? _commitPos2_get : defaultCommitPosition;
            if (dir2 === "TB") {
                return parentPosition.y + COMMIT_STEP;
            } else if (dir2 === "BT") {
                var _commitPos2_get1;
                const currentPosition = (_commitPos2_get1 = commitPos2.get(commit2.id)) !== null && _commitPos2_get1 !== void 0 ? _commitPos2_get1 : defaultCommitPosition;
                return currentPosition.y - COMMIT_STEP;
            } else {
                return parentPosition.x + COMMIT_STEP;
            }
        }
    } else {
        if (dir2 === "TB") {
            return defaultPos;
        } else if (dir2 === "BT") {
            var _commitPos2_get2;
            const currentPosition = (_commitPos2_get2 = commitPos2.get(commit2.id)) !== null && _commitPos2_get2 !== void 0 ? _commitPos2_get2 : defaultCommitPosition;
            return currentPosition.y - COMMIT_STEP;
        } else {
            return 0;
        }
    }
    return 0;
}, "calculatePosition");
var getCommitPosition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commit2, pos, isParallelCommits)=>{
    var _branchPos_get, _branchPos_get1;
    const posWithOffset = dir === "BT" && isParallelCommits ? pos : pos + LAYOUT_OFFSET;
    const branchY = (_branchPos_get = branchPos.get(commit2.branch)) === null || _branchPos_get === void 0 ? void 0 : _branchPos_get.pos;
    const x = dir === "TB" || dir === "BT" ? (_branchPos_get1 = branchPos.get(commit2.branch)) === null || _branchPos_get1 === void 0 ? void 0 : _branchPos_get1.pos : posWithOffset;
    if (x === void 0 || branchY === void 0) {
        throw new Error("Position were undefined for commit ".concat(commit2.id));
    }
    var _getConfig2_theme;
    const useReduxGeometry = REDUX_GEOMETRY_THEMES.has((_getConfig2_theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])().theme) !== null && _getConfig2_theme !== void 0 ? _getConfig2_theme : "");
    const y = dir === "TB" || dir === "BT" ? posWithOffset : branchY + (useReduxGeometry ? REDUX_BRANCH_LABEL_PADDING_Y / 2 + 1 : -2);
    return {
        x,
        y,
        posWithOffset
    };
}, "getCommitPosition");
var drawCommits = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((svg, commits, modifyGraph, gitGraphConfig)=>{
    const gBullets = svg.append("g").attr("class", "commit-bullets");
    const gLabels = svg.append("g").attr("class", "commit-labels");
    let pos = dir === "TB" || dir === "BT" ? defaultPos : 0;
    const keys = [
        ...commits.keys()
    ];
    var _gitGraphConfig_parallelCommits;
    const isParallelCommits = (_gitGraphConfig_parallelCommits = gitGraphConfig.parallelCommits) !== null && _gitGraphConfig_parallelCommits !== void 0 ? _gitGraphConfig_parallelCommits : false;
    const sortKeys = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((a, b)=>{
        var _commits_get, _commits_get1;
        const seqA = (_commits_get = commits.get(a)) === null || _commits_get === void 0 ? void 0 : _commits_get.seq;
        const seqB = (_commits_get1 = commits.get(b)) === null || _commits_get1 === void 0 ? void 0 : _commits_get1.seq;
        return seqA !== void 0 && seqB !== void 0 ? seqA - seqB : 0;
    }, "sortKeys");
    let sortedKeys = keys.sort(sortKeys);
    if (dir === "BT") {
        if (isParallelCommits) {
            setParallelBTPos(sortedKeys, commits, pos);
        }
        sortedKeys = sortedKeys.reverse();
    }
    sortedKeys.forEach((key)=>{
        const commit2 = commits.get(key);
        if (!commit2) {
            throw new Error("Commit not found for key ".concat(key));
        }
        if (isParallelCommits) {
            pos = calculatePosition(commit2, dir, pos, commitPos);
        }
        const commitPosition = getCommitPosition(commit2, pos, isParallelCommits);
        if (modifyGraph) {
            var _branchPos_get;
            const typeClass = getCommitClassType(commit2);
            var _commit2_customType;
            const commitSymbolType = (_commit2_customType = commit2.customType) !== null && _commit2_customType !== void 0 ? _commit2_customType : commit2.type;
            var _branchPos_get_index;
            const branchIndex = (_branchPos_get_index = (_branchPos_get = branchPos.get(commit2.branch)) === null || _branchPos_get === void 0 ? void 0 : _branchPos_get.index) !== null && _branchPos_get_index !== void 0 ? _branchPos_get_index : 0;
            drawCommitBullet(gBullets, commit2, commitPosition, typeClass, branchIndex, commitSymbolType);
            drawCommitLabel(gLabels, commit2, commitPosition, pos, gitGraphConfig);
            drawCommitTags(gLabels, commit2, commitPosition, pos);
        }
        if (dir === "TB" || dir === "BT") {
            commitPos.set(commit2.id, {
                x: commitPosition.x,
                y: commitPosition.posWithOffset
            });
        } else {
            commitPos.set(commit2.id, {
                x: commitPosition.posWithOffset,
                y: commitPosition.y
            });
        }
        pos = dir === "BT" && isParallelCommits ? pos + COMMIT_STEP : pos + COMMIT_STEP + LAYOUT_OFFSET;
        if (pos > maxPos) {
            maxPos = pos;
        }
    });
}, "drawCommits");
var shouldRerouteArrow = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((commitA, commitB, p1, p2, allCommits)=>{
    const commitBIsFurthest = dir === "TB" || dir === "BT" ? p1.x < p2.x : p1.y < p2.y;
    const branchToGetCurve = commitBIsFurthest ? commitB.branch : commitA.branch;
    const isOnBranchToGetCurve = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((x)=>x.branch === branchToGetCurve, "isOnBranchToGetCurve");
    const isBetweenCommits = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((x)=>x.seq > commitA.seq && x.seq < commitB.seq, "isBetweenCommits");
    return [
        ...allCommits.values()
    ].some((commitX)=>{
        return isBetweenCommits(commitX) && isOnBranchToGetCurve(commitX);
    });
}, "shouldRerouteArrow");
var findLane = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(y1, y2) {
    let depth = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    const candidate = y1 + Math.abs(y1 - y2) / 2;
    if (depth > 5) {
        return candidate;
    }
    const ok = lanes.every((lane)=>Math.abs(lane - candidate) >= 10);
    if (ok) {
        lanes.push(candidate);
        return candidate;
    }
    const diff = Math.abs(y1 - y2);
    return findLane(y1, y2 - diff / 5, depth + 1);
}, "findLane");
var drawArrow = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((svg, commitA, commitB, allCommits)=>{
    var _branchPos_get;
    const { theme: arrowTheme } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    const useColorTheme = COLOR_THEMES.has(arrowTheme !== null && arrowTheme !== void 0 ? arrowTheme : "");
    const p1 = commitPos.get(commitA.id);
    const p2 = commitPos.get(commitB.id);
    if (p1 === void 0 || p2 === void 0) {
        throw new Error("Commit positions not found for commits ".concat(commitA.id, " and ").concat(commitB.id));
    }
    const arrowNeedsRerouting = shouldRerouteArrow(commitA, commitB, p1, p2, allCommits);
    let arc = "";
    let arc2 = "";
    let radius = 0;
    let offset = 0;
    let colorClassNum = (_branchPos_get = branchPos.get(commitB.branch)) === null || _branchPos_get === void 0 ? void 0 : _branchPos_get.index;
    if (commitB.type === commitType.MERGE && commitA.id !== commitB.parents[0]) {
        var _branchPos_get1;
        colorClassNum = (_branchPos_get1 = branchPos.get(commitA.branch)) === null || _branchPos_get1 === void 0 ? void 0 : _branchPos_get1.index;
    }
    let lineDef;
    if (arrowNeedsRerouting) {
        arc = "A 10 10, 0, 0, 0,";
        arc2 = "A 10 10, 0, 0, 1,";
        radius = 10;
        offset = 10;
        const lineY = p1.y < p2.y ? findLane(p1.y, p2.y) : findLane(p2.y, p1.y);
        const lineX = p1.x < p2.x ? findLane(p1.x, p2.x) : findLane(p2.x, p1.x);
        if (dir === "TB") {
            if (p1.x < p2.x) {
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(lineX - radius, " ").concat(p1.y, " ").concat(arc2, " ").concat(lineX, " ").concat(p1.y + offset, " L ").concat(lineX, " ").concat(p2.y - radius, " ").concat(arc, " ").concat(lineX + offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
            } else {
                var _branchPos_get2;
                colorClassNum = (_branchPos_get2 = branchPos.get(commitA.branch)) === null || _branchPos_get2 === void 0 ? void 0 : _branchPos_get2.index;
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(lineX + radius, " ").concat(p1.y, " ").concat(arc, " ").concat(lineX, " ").concat(p1.y + offset, " L ").concat(lineX, " ").concat(p2.y - radius, " ").concat(arc2, " ").concat(lineX - offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
            }
        } else if (dir === "BT") {
            if (p1.x < p2.x) {
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(lineX - radius, " ").concat(p1.y, " ").concat(arc, " ").concat(lineX, " ").concat(p1.y - offset, " L ").concat(lineX, " ").concat(p2.y + radius, " ").concat(arc2, " ").concat(lineX + offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
            } else {
                var _branchPos_get3;
                colorClassNum = (_branchPos_get3 = branchPos.get(commitA.branch)) === null || _branchPos_get3 === void 0 ? void 0 : _branchPos_get3.index;
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(lineX + radius, " ").concat(p1.y, " ").concat(arc2, " ").concat(lineX, " ").concat(p1.y - offset, " L ").concat(lineX, " ").concat(p2.y + radius, " ").concat(arc, " ").concat(lineX - offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
            }
        } else {
            if (p1.y < p2.y) {
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(lineY - radius, " ").concat(arc, " ").concat(p1.x + offset, " ").concat(lineY, " L ").concat(p2.x - radius, " ").concat(lineY, " ").concat(arc2, " ").concat(p2.x, " ").concat(lineY + offset, " L ").concat(p2.x, " ").concat(p2.y);
            } else {
                var _branchPos_get4;
                colorClassNum = (_branchPos_get4 = branchPos.get(commitA.branch)) === null || _branchPos_get4 === void 0 ? void 0 : _branchPos_get4.index;
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(lineY + radius, " ").concat(arc2, " ").concat(p1.x + offset, " ").concat(lineY, " L ").concat(p2.x - radius, " ").concat(lineY, " ").concat(arc, " ").concat(p2.x, " ").concat(lineY - offset, " L ").concat(p2.x, " ").concat(p2.y);
            }
        }
    } else {
        arc = "A 20 20, 0, 0, 0,";
        arc2 = "A 20 20, 0, 0, 1,";
        radius = 20;
        offset = 20;
        if (dir === "TB") {
            if (p1.x < p2.x) {
                if (commitB.type === commitType.MERGE && commitA.id !== commitB.parents[0]) {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(p2.y - radius, " ").concat(arc, " ").concat(p1.x + offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
                } else {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x - radius, " ").concat(p1.y, " ").concat(arc2, " ").concat(p2.x, " ").concat(p1.y + offset, " L ").concat(p2.x, " ").concat(p2.y);
                }
            }
            if (p1.x > p2.x) {
                arc = "A 20 20, 0, 0, 0,";
                arc2 = "A 20 20, 0, 0, 1,";
                radius = 20;
                offset = 20;
                if (commitB.type === commitType.MERGE && commitA.id !== commitB.parents[0]) {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(p2.y - radius, " ").concat(arc2, " ").concat(p1.x - offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
                } else {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x + radius, " ").concat(p1.y, " ").concat(arc, " ").concat(p2.x, " ").concat(p1.y + offset, " L ").concat(p2.x, " ").concat(p2.y);
                }
            }
            if (p1.x === p2.x) {
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x, " ").concat(p2.y);
            }
        } else if (dir === "BT") {
            if (p1.x < p2.x) {
                if (commitB.type === commitType.MERGE && commitA.id !== commitB.parents[0]) {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(p2.y + radius, " ").concat(arc2, " ").concat(p1.x + offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
                } else {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x - radius, " ").concat(p1.y, " ").concat(arc, " ").concat(p2.x, " ").concat(p1.y - offset, " L ").concat(p2.x, " ").concat(p2.y);
                }
            }
            if (p1.x > p2.x) {
                arc = "A 20 20, 0, 0, 0,";
                arc2 = "A 20 20, 0, 0, 1,";
                radius = 20;
                offset = 20;
                if (commitB.type === commitType.MERGE && commitA.id !== commitB.parents[0]) {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(p2.y + radius, " ").concat(arc, " ").concat(p1.x - offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
                } else {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x + radius, " ").concat(p1.y, " ").concat(arc2, " ").concat(p2.x, " ").concat(p1.y - offset, " L ").concat(p2.x, " ").concat(p2.y);
                }
            }
            if (p1.x === p2.x) {
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x, " ").concat(p2.y);
            }
        } else {
            if (p1.y < p2.y) {
                if (commitB.type === commitType.MERGE && commitA.id !== commitB.parents[0]) {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x - radius, " ").concat(p1.y, " ").concat(arc2, " ").concat(p2.x, " ").concat(p1.y + offset, " L ").concat(p2.x, " ").concat(p2.y);
                } else {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(p2.y - radius, " ").concat(arc, " ").concat(p1.x + offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
                }
            }
            if (p1.y > p2.y) {
                if (commitB.type === commitType.MERGE && commitA.id !== commitB.parents[0]) {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x - radius, " ").concat(p1.y, " ").concat(arc, " ").concat(p2.x, " ").concat(p1.y - offset, " L ").concat(p2.x, " ").concat(p2.y);
                } else {
                    lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p1.x, " ").concat(p2.y + radius, " ").concat(arc2, " ").concat(p1.x + offset, " ").concat(p2.y, " L ").concat(p2.x, " ").concat(p2.y);
                }
            }
            if (p1.y === p2.y) {
                lineDef = "M ".concat(p1.x, " ").concat(p1.y, " L ").concat(p2.x, " ").concat(p2.y);
            }
        }
    }
    if (lineDef === void 0) {
        throw new Error("Line definition not found");
    }
    svg.append("path").attr("d", lineDef).attr("class", "arrow arrow" + calcColorIndex(colorClassNum, THEME_COLOR_LIMIT, useColorTheme));
}, "drawArrow");
var drawArrows = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((svg, commits)=>{
    const gArrows = svg.append("g").attr("class", "commit-arrows");
    [
        ...commits.keys()
    ].forEach((key)=>{
        const commit2 = commits.get(key);
        if (commit2.parents && commit2.parents.length > 0) {
            commit2.parents.forEach((parent)=>{
                drawArrow(gArrows, commits.get(parent), commit2, commits);
            });
        }
    });
}, "drawArrows");
var drawBranches = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((svg, branches, gitGraphConfig, id)=>{
    const { look, theme, themeVariables } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    const { dropShadow, THEME_COLOR_LIMIT: themeColorLimit } = themeVariables;
    const useReduxGeometry = REDUX_GEOMETRY_THEMES.has(theme !== null && theme !== void 0 ? theme : "");
    const useColorTheme = COLOR_THEMES.has(theme !== null && theme !== void 0 ? theme : "");
    const g = svg.append("g");
    branches.forEach((branch2, index)=>{
        var _branchPos_get;
        const adjustIndexForTheme = calcColorIndex(index, useReduxGeometry ? themeColorLimit : THEME_COLOR_LIMIT, useColorTheme);
        const pos = (_branchPos_get = branchPos.get(branch2.name)) === null || _branchPos_get === void 0 ? void 0 : _branchPos_get.pos;
        if (pos === void 0) {
            throw new Error("Position not found for branch ".concat(branch2.name));
        }
        const spineY = dir === "TB" || dir === "BT" ? pos : useReduxGeometry ? pos + REDUX_BRANCH_LABEL_PADDING_Y / 2 + 1 : pos - 2;
        const line = g.append("line");
        line.attr("x1", 0);
        line.attr("y1", spineY);
        line.attr("x2", maxPos);
        line.attr("y2", spineY);
        line.attr("class", "branch branch" + adjustIndexForTheme);
        if (dir === "TB") {
            line.attr("y1", defaultPos);
            line.attr("x1", pos);
            line.attr("y2", maxPos);
            line.attr("x2", pos);
        } else if (dir === "BT") {
            line.attr("y1", maxPos);
            line.attr("x1", pos);
            line.attr("y2", defaultPos);
            line.attr("x2", pos);
        }
        lanes.push(spineY);
        const name = branch2.name;
        const labelElement = drawText(name);
        const bkg = g.insert("rect");
        const branchLabel = g.insert("g").attr("class", "branchLabel");
        const label = branchLabel.insert("g").attr("class", "label branch-label" + adjustIndexForTheme);
        label.node().appendChild(labelElement);
        const bbox = labelElement.getBBox();
        const borderRadius = useReduxGeometry ? 0 : 4;
        const labelPaddingX = useReduxGeometry ? 16 : 0;
        const labelPaddingY = useReduxGeometry ? REDUX_BRANCH_LABEL_PADDING_Y : 0;
        if (look === "neo") {
            bkg.attr("data-look", "neo");
        }
        bkg.attr("class", "branchLabelBkg label" + adjustIndexForTheme).attr("style", look === "neo" ? "filter:".concat(useReduxGeometry ? "url(#".concat(id, "-drop-shadow)") : dropShadow) : "").attr("rx", borderRadius).attr("ry", borderRadius).attr("x", -bbox.width - 4 - (gitGraphConfig.rotateCommitLabel === true ? 30 : 0)).attr("y", -bbox.height / 2 + 10).attr("width", bbox.width + 18 + labelPaddingX).attr("height", bbox.height + 4 + labelPaddingY);
        label.attr("transform", "translate(" + (-bbox.width - 14 - (gitGraphConfig.rotateCommitLabel === true ? 30 : 0) + labelPaddingX / 2) + ", " + (spineY - bbox.height / 2 - 2) + ")");
        if (dir === "TB") {
            bkg.attr("x", pos - bbox.width / 2 - 10).attr("y", 0);
            label.attr("transform", "translate(" + (pos - bbox.width / 2 - 5) + ", 0)");
            if (useReduxGeometry) {
                bkg.attr("transform", "translate(".concat(-labelPaddingX / 2 - 3, ", ").concat(-labelPaddingY - 10, ")"));
                label.attr("transform", "translate(" + (pos - bbox.width / 2 - 5) + ", " + (-labelPaddingY * 2 + 7) + ")");
            }
        } else if (dir === "BT") {
            bkg.attr("x", pos - bbox.width / 2 - 10).attr("y", maxPos);
            label.attr("transform", "translate(" + (pos - bbox.width / 2 - 5) + ", " + maxPos + ")");
            if (useReduxGeometry) {
                bkg.attr("transform", "translate(".concat(-labelPaddingX / 2 - 3, ", ").concat(labelPaddingY + 10, ")"));
                label.attr("transform", "translate(" + (pos - bbox.width / 2 - 5) + ", " + (maxPos + labelPaddingY * 2 + 4) + ")");
            }
        } else {
            bkg.attr("transform", "translate(-19, " + (spineY - 12 - labelPaddingY / 2) + ")");
        }
    });
}, "drawBranches");
var setBranchPosition = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(name, pos, index, bbox, rotateCommitLabel) {
    branchPos.set(name, {
        pos,
        index
    });
    pos += 50 + (rotateCommitLabel ? 40 : 0) + (dir === "TB" || dir === "BT" ? bbox.width / 2 : 0);
    return pos;
}, "setBranchPosition");
var draw = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(function(txt, id, ver, diagObj) {
    clear3();
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].debug("in gitgraph renderer", txt + "\n", "id:", id, ver);
    const db2 = diagObj.db;
    if (!db2.getConfig) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$X3CZISLH$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["log"].error("getConfig method is not available on db");
        return;
    }
    const gitGraphConfig = db2.getConfig();
    var _gitGraphConfig_rotateCommitLabel;
    const rotateCommitLabel = (_gitGraphConfig_rotateCommitLabel = gitGraphConfig.rotateCommitLabel) !== null && _gitGraphConfig_rotateCommitLabel !== void 0 ? _gitGraphConfig_rotateCommitLabel : false;
    allCommitsDict = db2.getCommits();
    const branches = db2.getBranchesAsObjArray();
    dir = db2.getDirection();
    const diagram2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$d3$2d$selection$40$3$2e$0$2e$0$2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])('[id="'.concat(id, '"]'));
    const { look, theme, themeVariables } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig2"])();
    const { useGradient, gradientStart, gradientStop, filterColor } = themeVariables;
    if (useGradient) {
        const gradient = diagram2.append("defs").append("linearGradient").attr("id", id + "-gradient").attr("gradientUnits", "objectBoundingBox").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", gradientStart).attr("stop-opacity", 1);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", gradientStop).attr("stop-opacity", 1);
    }
    if (look === "neo" && REDUX_GEOMETRY_THEMES.has(theme !== null && theme !== void 0 ? theme : "")) {
        diagram2.append("defs").append("filter").attr("id", id + "-drop-shadow").attr("height", "130%").attr("width", "130%").append("feDropShadow").attr("dx", "4").attr("dy", "4").attr("stdDeviation", 0).attr("flood-opacity", "0.06").attr("flood-color", filterColor);
    }
    let pos = 0;
    branches.forEach((branch2, index)=>{
        var _label_node;
        const labelElement = drawText(branch2.name);
        const g = diagram2.append("g");
        const branchLabel = g.insert("g").attr("class", "branchLabel");
        const label = branchLabel.insert("g").attr("class", "label branch-label");
        (_label_node = label.node()) === null || _label_node === void 0 ? void 0 : _label_node.appendChild(labelElement);
        const bbox = labelElement.getBBox();
        pos = setBranchPosition(branch2.name, pos, index, bbox, rotateCommitLabel);
        label.remove();
        branchLabel.remove();
        g.remove();
    });
    drawCommits(diagram2, allCommitsDict, false, gitGraphConfig);
    if (gitGraphConfig.showBranches) {
        drawBranches(diagram2, branches, gitGraphConfig, id);
    }
    drawArrows(diagram2, allCommitsDict);
    drawCommits(diagram2, allCommitsDict, true, gitGraphConfig);
    var _gitGraphConfig_titleTopMargin;
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$ICXQ74PX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["utils_default"].insertTitle(diagram2, "gitTitleText", (_gitGraphConfig_titleTopMargin = gitGraphConfig.titleTopMargin) !== null && _gitGraphConfig_titleTopMargin !== void 0 ? _gitGraphConfig_titleTopMargin : 0, db2.getDiagramTitle());
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setupGraphViewbox2"])(void 0, diagram2, gitGraphConfig.diagramPadding, gitGraphConfig.useMaxWidth);
}, "draw");
var gitGraphRenderer_default = {
    draw
};
if (void 0) {
    const { it, expect, describe } = void 0;
    describe("drawText", ()=>{
        it("should drawText", ()=>{
            const svgLabel = drawText("main");
            expect(svgLabel).toBeDefined();
            expect(svgLabel.children[0].innerHTML).toBe("main");
        });
    });
    describe("branchPosition", ()=>{
        const bbox = {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            toJSON: /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])(()=>"", "toJSON")
        };
        it("should setBranchPositions LR with two branches", ()=>{
            dir = "LR";
            const pos = setBranchPosition("main", 0, 0, bbox, true);
            expect(pos).toBe(90);
            expect(branchPos.get("main")).toEqual({
                pos: 0,
                index: 0
            });
            const posNext = setBranchPosition("develop", pos, 1, bbox, true);
            expect(posNext).toBe(180);
            expect(branchPos.get("develop")).toEqual({
                pos,
                index: 1
            });
        });
        it("should setBranchPositions TB with two branches", ()=>{
            dir = "TB";
            bbox.width = 34.9921875;
            const pos = setBranchPosition("main", 0, 0, bbox, true);
            expect(pos).toBe(107.49609375);
            expect(branchPos.get("main")).toEqual({
                pos: 0,
                index: 0
            });
            bbox.width = 56.421875;
            const posNext = setBranchPosition("develop", pos, 1, bbox, true);
            expect(posNext).toBe(225.70703125);
            expect(branchPos.get("develop")).toEqual({
                pos,
                index: 1
            });
        });
    });
    describe("commitPosition", ()=>{
        const commits = /* @__PURE__ */ new Map([
            [
                "commitZero",
                {
                    id: "ZERO",
                    message: "",
                    seq: 0,
                    type: commitType.NORMAL,
                    tags: [],
                    parents: [],
                    branch: "main"
                }
            ],
            [
                "commitA",
                {
                    id: "A",
                    message: "",
                    seq: 1,
                    type: commitType.NORMAL,
                    tags: [],
                    parents: [
                        "ZERO"
                    ],
                    branch: "feature"
                }
            ],
            [
                "commitB",
                {
                    id: "B",
                    message: "",
                    seq: 2,
                    type: commitType.NORMAL,
                    tags: [],
                    parents: [
                        "A"
                    ],
                    branch: "feature"
                }
            ],
            [
                "commitM",
                {
                    id: "M",
                    message: "merged branch feature into main",
                    seq: 3,
                    type: commitType.MERGE,
                    tags: [],
                    parents: [
                        "ZERO",
                        "B"
                    ],
                    branch: "main",
                    customId: true
                }
            ],
            [
                "commitC",
                {
                    id: "C",
                    message: "",
                    seq: 4,
                    type: commitType.NORMAL,
                    tags: [],
                    parents: [
                        "ZERO"
                    ],
                    branch: "release"
                }
            ],
            [
                "commit5_8928ea0",
                {
                    id: "5-8928ea0",
                    message: "cherry-picked [object Object] into release",
                    seq: 5,
                    type: commitType.CHERRY_PICK,
                    tags: [],
                    parents: [
                        "C",
                        "M"
                    ],
                    branch: "release"
                }
            ],
            [
                "commitD",
                {
                    id: "D",
                    message: "",
                    seq: 6,
                    type: commitType.NORMAL,
                    tags: [],
                    parents: [
                        "5-8928ea0"
                    ],
                    branch: "release"
                }
            ],
            [
                "commit7_ed848ba",
                {
                    id: "7-ed848ba",
                    message: "cherry-picked [object Object] into release",
                    seq: 7,
                    type: commitType.CHERRY_PICK,
                    tags: [],
                    parents: [
                        "D",
                        "M"
                    ],
                    branch: "release"
                }
            ]
        ]);
        let pos = 0;
        branchPos.set("main", {
            pos: 0,
            index: 0
        });
        branchPos.set("feature", {
            pos: 107.49609375,
            index: 1
        });
        branchPos.set("release", {
            pos: 224.03515625,
            index: 2
        });
        describe("TB", ()=>{
            pos = 30;
            dir = "TB";
            const expectedCommitPositionTB = /* @__PURE__ */ new Map([
                [
                    "commitZero",
                    {
                        x: 0,
                        y: 40,
                        posWithOffset: 40
                    }
                ],
                [
                    "commitA",
                    {
                        x: 107.49609375,
                        y: 90,
                        posWithOffset: 90
                    }
                ],
                [
                    "commitB",
                    {
                        x: 107.49609375,
                        y: 140,
                        posWithOffset: 140
                    }
                ],
                [
                    "commitM",
                    {
                        x: 0,
                        y: 190,
                        posWithOffset: 190
                    }
                ],
                [
                    "commitC",
                    {
                        x: 224.03515625,
                        y: 240,
                        posWithOffset: 240
                    }
                ],
                [
                    "commit5_8928ea0",
                    {
                        x: 224.03515625,
                        y: 290,
                        posWithOffset: 290
                    }
                ],
                [
                    "commitD",
                    {
                        x: 224.03515625,
                        y: 340,
                        posWithOffset: 340
                    }
                ],
                [
                    "commit7_ed848ba",
                    {
                        x: 224.03515625,
                        y: 390,
                        posWithOffset: 390
                    }
                ]
            ]);
            commits.forEach((commit2, key)=>{
                it("should give the correct position for commit ".concat(key), ()=>{
                    const position = getCommitPosition(commit2, pos, false);
                    expect(position).toEqual(expectedCommitPositionTB.get(key));
                    pos += 50;
                });
            });
        });
        describe("LR", ()=>{
            let pos2 = 30;
            dir = "LR";
            const expectedCommitPositionLR = /* @__PURE__ */ new Map([
                [
                    "commitZero",
                    {
                        x: 0,
                        y: 40,
                        posWithOffset: 40
                    }
                ],
                [
                    "commitA",
                    {
                        x: 107.49609375,
                        y: 90,
                        posWithOffset: 90
                    }
                ],
                [
                    "commitB",
                    {
                        x: 107.49609375,
                        y: 140,
                        posWithOffset: 140
                    }
                ],
                [
                    "commitM",
                    {
                        x: 0,
                        y: 190,
                        posWithOffset: 190
                    }
                ],
                [
                    "commitC",
                    {
                        x: 224.03515625,
                        y: 240,
                        posWithOffset: 240
                    }
                ],
                [
                    "commit5_8928ea0",
                    {
                        x: 224.03515625,
                        y: 290,
                        posWithOffset: 290
                    }
                ],
                [
                    "commitD",
                    {
                        x: 224.03515625,
                        y: 340,
                        posWithOffset: 340
                    }
                ],
                [
                    "commit7_ed848ba",
                    {
                        x: 224.03515625,
                        y: 390,
                        posWithOffset: 390
                    }
                ]
            ]);
            commits.forEach((commit2, key)=>{
                it("should give the correct position for commit ".concat(key), ()=>{
                    const position = getCommitPosition(commit2, pos2, false);
                    expect(position).toEqual(expectedCommitPositionLR.get(key));
                    pos2 += 50;
                });
            });
        });
        describe("getCommitClassType", ()=>{
            const expectedCommitClassType = /* @__PURE__ */ new Map([
                [
                    "commitZero",
                    "commit-normal"
                ],
                [
                    "commitA",
                    "commit-normal"
                ],
                [
                    "commitB",
                    "commit-normal"
                ],
                [
                    "commitM",
                    "commit-merge"
                ],
                [
                    "commitC",
                    "commit-normal"
                ],
                [
                    "commit5_8928ea0",
                    "commit-cherry-pick"
                ],
                [
                    "commitD",
                    "commit-normal"
                ],
                [
                    "commit7_ed848ba",
                    "commit-cherry-pick"
                ]
            ]);
            commits.forEach((commit2, key)=>{
                it("should give the correct class type for commit ".concat(key), ()=>{
                    const classType = getCommitClassType(commit2);
                    expect(classType).toBe(expectedCommitClassType.get(key));
                });
            });
        });
    });
    describe("building BT parallel commit diagram", ()=>{
        const commits = /* @__PURE__ */ new Map([
            [
                "1-abcdefg",
                {
                    id: "1-abcdefg",
                    message: "",
                    seq: 0,
                    type: 0,
                    tags: [],
                    parents: [],
                    branch: "main"
                }
            ],
            [
                "2-abcdefg",
                {
                    id: "2-abcdefg",
                    message: "",
                    seq: 1,
                    type: 0,
                    tags: [],
                    parents: [
                        "1-abcdefg"
                    ],
                    branch: "main"
                }
            ],
            [
                "3-abcdefg",
                {
                    id: "3-abcdefg",
                    message: "",
                    seq: 2,
                    type: 0,
                    tags: [],
                    parents: [
                        "2-abcdefg"
                    ],
                    branch: "develop"
                }
            ],
            [
                "4-abcdefg",
                {
                    id: "4-abcdefg",
                    message: "",
                    seq: 3,
                    type: 0,
                    tags: [],
                    parents: [
                        "3-abcdefg"
                    ],
                    branch: "develop"
                }
            ],
            [
                "5-abcdefg",
                {
                    id: "5-abcdefg",
                    message: "",
                    seq: 4,
                    type: 0,
                    tags: [],
                    parents: [
                        "2-abcdefg"
                    ],
                    branch: "feature"
                }
            ],
            [
                "6-abcdefg",
                {
                    id: "6-abcdefg",
                    message: "",
                    seq: 5,
                    type: 0,
                    tags: [],
                    parents: [
                        "5-abcdefg"
                    ],
                    branch: "feature"
                }
            ],
            [
                "7-abcdefg",
                {
                    id: "7-abcdefg",
                    message: "",
                    seq: 6,
                    type: 0,
                    tags: [],
                    parents: [
                        "2-abcdefg"
                    ],
                    branch: "main"
                }
            ],
            [
                "8-abcdefg",
                {
                    id: "8-abcdefg",
                    message: "",
                    seq: 7,
                    type: 0,
                    tags: [],
                    parents: [
                        "7-abcdefg"
                    ],
                    branch: "main"
                }
            ]
        ]);
        const expectedCommitPosition = /* @__PURE__ */ new Map([
            [
                "1-abcdefg",
                {
                    x: 0,
                    y: 40
                }
            ],
            [
                "2-abcdefg",
                {
                    x: 0,
                    y: 90
                }
            ],
            [
                "3-abcdefg",
                {
                    x: 107.49609375,
                    y: 140
                }
            ],
            [
                "4-abcdefg",
                {
                    x: 107.49609375,
                    y: 190
                }
            ],
            [
                "5-abcdefg",
                {
                    x: 225.70703125,
                    y: 140
                }
            ],
            [
                "6-abcdefg",
                {
                    x: 225.70703125,
                    y: 190
                }
            ],
            [
                "7-abcdefg",
                {
                    x: 0,
                    y: 140
                }
            ],
            [
                "8-abcdefg",
                {
                    x: 0,
                    y: 190
                }
            ]
        ]);
        const expectedCommitPositionAfterParallel = /* @__PURE__ */ new Map([
            [
                "1-abcdefg",
                {
                    x: 0,
                    y: 210
                }
            ],
            [
                "2-abcdefg",
                {
                    x: 0,
                    y: 160
                }
            ],
            [
                "3-abcdefg",
                {
                    x: 107.49609375,
                    y: 110
                }
            ],
            [
                "4-abcdefg",
                {
                    x: 107.49609375,
                    y: 60
                }
            ],
            [
                "5-abcdefg",
                {
                    x: 225.70703125,
                    y: 110
                }
            ],
            [
                "6-abcdefg",
                {
                    x: 225.70703125,
                    y: 60
                }
            ],
            [
                "7-abcdefg",
                {
                    x: 0,
                    y: 110
                }
            ],
            [
                "8-abcdefg",
                {
                    x: 0,
                    y: 60
                }
            ]
        ]);
        const expectedCommitCurrentPosition = /* @__PURE__ */ new Map([
            [
                "1-abcdefg",
                30
            ],
            [
                "2-abcdefg",
                80
            ],
            [
                "3-abcdefg",
                130
            ],
            [
                "4-abcdefg",
                180
            ],
            [
                "5-abcdefg",
                130
            ],
            [
                "6-abcdefg",
                180
            ],
            [
                "7-abcdefg",
                130
            ],
            [
                "8-abcdefg",
                180
            ]
        ]);
        const sortedKeys = [
            ...expectedCommitPosition.keys()
        ];
        it("should get the correct commit position and current position", ()=>{
            dir = "BT";
            let curPos = 30;
            commitPos.clear();
            branchPos.clear();
            branchPos.set("main", {
                pos: 0,
                index: 0
            });
            branchPos.set("develop", {
                pos: 107.49609375,
                index: 1
            });
            branchPos.set("feature", {
                pos: 225.70703125,
                index: 2
            });
            commits.forEach((commit2, key)=>{
                if (commit2.parents.length > 0) {
                    curPos = calculateCommitPosition(commit2);
                }
                const position = setCommitPosition(commit2, curPos);
                expect(position).toEqual(expectedCommitPosition.get(key));
                expect(curPos).toEqual(expectedCommitCurrentPosition.get(key));
            });
        });
        it("should get the correct commit position after parallel commits", ()=>{
            commitPos.clear();
            branchPos.clear();
            dir = "BT";
            const curPos = 30;
            commitPos.clear();
            branchPos.clear();
            branchPos.set("main", {
                pos: 0,
                index: 0
            });
            branchPos.set("develop", {
                pos: 107.49609375,
                index: 1
            });
            branchPos.set("feature", {
                pos: 225.70703125,
                index: 2
            });
            setParallelBTPos(sortedKeys, commits, curPos);
            sortedKeys.forEach((commit2)=>{
                const position = commitPos.get(commit2);
                expect(position).toEqual(expectedCommitPositionAfterParallel.get(commit2));
            });
        });
    });
    it("add", ()=>{
        commitPos.set("parent1", {
            x: 1,
            y: 1
        });
        commitPos.set("parent2", {
            x: 2,
            y: 2
        });
        commitPos.set("parent3", {
            x: 3,
            y: 3
        });
        dir = "LR";
        const parents = [
            "parent1",
            "parent2",
            "parent3"
        ];
        const closestParent = findClosestParent(parents);
        expect(closestParent).toBe("parent3");
        commitPos.clear();
    });
}
// src/diagrams/git/styles.js
var GIT_NAMED_COLOR_COUNT = 8;
var REDUX_GEOMETRY_THEMES2 = /* @__PURE__ */ new Set([
    "redux",
    "redux-dark",
    "redux-color",
    "redux-dark-color"
]);
var COLOR_THEMES2 = /* @__PURE__ */ new Set([
    "redux-color",
    "redux-dark-color"
]);
var NEO_THEMES = /* @__PURE__ */ new Set([
    "neo",
    "neo-dark"
]);
var DARK_THEMES2 = /* @__PURE__ */ new Set([
    "dark",
    "redux-dark",
    "redux-dark-color",
    "neo-dark"
]);
var NEO_COLOR_GEN_THEMES = /* @__PURE__ */ new Set([
    "redux",
    "redux-dark",
    "redux-color",
    "redux-dark-color",
    "neo",
    "neo-dark"
]);
var genGitGraphGradient = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    const { svgId } = options;
    let sections = "";
    if (options.useGradient && svgId) {
        for(let i = 0; i < options.THEME_COLOR_LIMIT; i++){
            sections += "\n      .label".concat(i, "  { fill: ").concat(options.mainBkg, "; stroke: url(").concat(svgId, "-gradient); stroke-width: ").concat(options.strokeWidth, ";}\n             ");
        }
    }
    return sections;
}, "genGitGraphGradient");
var genColor = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { theme, themeVariables } = config;
    const { borderColorArray } = themeVariables;
    const useReduxGeometry = REDUX_GEOMETRY_THEMES2.has(theme);
    if (NEO_THEMES.has(theme)) {
        let sections = "";
        for(let i = 0; i < options.THEME_COLOR_LIMIT; i++){
            if (i === 0) {
                sections += "\n        .branch-label".concat(i, " { fill: ").concat(options.nodeBorder, ";}\n        .commit").concat(i, " { stroke: ").concat(options.nodeBorder, ";   }\n        .commit-highlight").concat(i, " { stroke: ").concat(options.nodeBorder, "; fill: ").concat(options.nodeBorder, "; }\n        .arrow").concat(i, " { stroke: ").concat(options.nodeBorder, "; }\n        .commit-bullets { fill: ").concat(options.nodeBorder, "; }\n        .commit-cherry-pick").concat(i, " { stroke: ").concat(options.nodeBorder, "; }\n        ").concat(genGitGraphGradient(options));
            } else {
                const ci = i % GIT_NAMED_COLOR_COUNT;
                sections += "\n        .branch-label".concat(i, " { fill: ").concat(options["gitBranchLabel" + ci], "; }\n        .commit").concat(i, " { stroke: ").concat(options["git" + ci], "; fill: ").concat(options["git" + ci], "; }\n        .commit-highlight").concat(i, " { stroke: ").concat(options["gitInv" + ci], "; fill: ").concat(options["gitInv" + ci], "; }\n        .arrow").concat(i, " { stroke: ").concat(options["git" + ci], "; }\n        ");
            }
        }
        return sections;
    } else if (!COLOR_THEMES2.has(theme)) {
        let sections = "";
        for(let i = 0; i < options.THEME_COLOR_LIMIT; i++){
            sections += "\n        .branch-label".concat(i, " { fill: ").concat(options.nodeBorder, "; ").concat(useReduxGeometry ? "font-weight:".concat(options.noteFontWeight) : "", " }\n        .commit").concat(i, " { stroke: ").concat(options.nodeBorder, ";   }\n        .commit-highlight").concat(i, " { stroke: ").concat(options.nodeBorder, "; fill: ").concat(options.nodeBorder, "; }\n        .label").concat(i, "  { fill: ").concat(options.mainBkg, "; stroke: ").concat(options.nodeBorder, "; stroke-width: ").concat(options.strokeWidth, "; ").concat(useReduxGeometry ? "font-weight:".concat(options.noteFontWeight) : "", "}\n        .arrow").concat(i, " { stroke: ").concat(options.nodeBorder, "; }\n        .commit-bullets { fill: ").concat(options.nodeBorder, "; }\n        .commit-cherry-pick").concat(i, " { stroke: ").concat(options.nodeBorder, "; }\n        ");
        }
        return sections;
    } else {
        let sections = "";
        for(let i = 0; i < options.THEME_COLOR_LIMIT; i++){
            if (i === 0) {
                sections += "\n        .branch-label".concat(i, " { fill: ").concat(options.nodeBorder, "; ").concat(useReduxGeometry ? "font-weight:".concat(options.noteFontWeight) : "", " }\n        .commit").concat(i, " { stroke: ").concat(options.nodeBorder, "; }\n        .commit-highlight").concat(i, " { stroke: ").concat(options.nodeBorder, "; fill: ").concat(options.mainBkg, "; }\n        .label").concat(i, "  { fill: ").concat(options.mainBkg, "; stroke: ").concat(options.nodeBorder, "; stroke-width: ").concat(options.strokeWidth, "; ").concat(useReduxGeometry ? "font-weight:".concat(options.noteFontWeight) : "", " }\n        .arrow").concat(i, " { stroke: ").concat(options.nodeBorder, "; }\n        .commit-bullets { fill: ").concat(options.nodeBorder, "; }\n        ");
            } else {
                const colorIndex = i % borderColorArray.length;
                sections += "\n        .branch-label".concat(i, " { fill: ").concat(options.nodeBorder, "; ").concat(useReduxGeometry ? "font-weight:".concat(options.noteFontWeight) : "", " }\n        .commit").concat(i, " { stroke: ").concat(borderColorArray[colorIndex], "; fill: ").concat(borderColorArray[colorIndex], "; }\n        .commit-highlight").concat(i, " { stroke: ").concat(borderColorArray[colorIndex], "; fill: ").concat(borderColorArray[colorIndex], "; }\n        .label").concat(i, "  { fill: ").concat(DARK_THEMES2.has(theme) ? options.mainBkg : borderColorArray[colorIndex], "; stroke: ").concat(borderColorArray[colorIndex], ";  stroke-width: ").concat(options.strokeWidth, "; }\n        .arrow").concat(i, " { stroke: ").concat(borderColorArray[colorIndex], "; }\n        ");
            }
        }
        return sections;
    }
}, "genColor");
var normalTheme = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    return "".concat(Array.from({
        length: options.THEME_COLOR_LIMIT
    }, (_, i)=>i).map((i)=>{
        const ci = i % GIT_NAMED_COLOR_COUNT;
        return "\n        .branch-label".concat(i, " { fill: ").concat(options["gitBranchLabel" + ci], "; }\n        .commit").concat(i, " { stroke: ").concat(options["git" + ci], "; fill: ").concat(options["git" + ci], "; }\n        .commit-highlight").concat(i, " { stroke: ").concat(options["gitInv" + ci], "; fill: ").concat(options["gitInv" + ci], "; }\n        .label").concat(i, "  { fill: ").concat(options["git" + ci], "; }\n        .arrow").concat(i, " { stroke: ").concat(options["git" + ci], "; }\n        ");
    }).join("\n"));
}, "normalTheme");
var getStyles = /* @__PURE__ */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$Y2CYZVJY$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["__name"])((options)=>{
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$mermaid$40$11$2e$16$2e$0$2f$node_modules$2f$mermaid$2f$dist$2f$chunks$2f$mermaid$2e$core$2f$chunk$2d$WYO6CB5R$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getConfig"])();
    const { theme } = config;
    const useNeoColorGen = NEO_COLOR_GEN_THEMES.has(theme);
    var _options_commitLineColor;
    return "\n  .commit-id,\n  .commit-msg,\n  .branch-label {\n    fill: lightgrey;\n    color: lightgrey;\n    font-family: 'trebuchet ms', verdana, arial, sans-serif;\n    font-family: var(--mermaid-font-family);\n  }\n  \n  ".concat(useNeoColorGen ? genColor(options) : normalTheme(options), "\n\n  .branch {\n    stroke-width: ").concat(options.strokeWidth, ";\n    stroke: ").concat((_options_commitLineColor = options.commitLineColor) !== null && _options_commitLineColor !== void 0 ? _options_commitLineColor : options.lineColor, ";\n    stroke-dasharray:  ").concat(useNeoColorGen ? "4 2" : "2", ";\n  }\n  .commit-label { font-size: ").concat(options.commitLabelFontSize, "; fill: ").concat(useNeoColorGen ? options.nodeBorder : options.commitLabelColor, "; ").concat(useNeoColorGen ? "font-weight:".concat(options.noteFontWeight, ";") : "", "}\n  .commit-label-bkg { font-size: ").concat(options.commitLabelFontSize, "; fill: ").concat(useNeoColorGen ? "transparent" : options.commitLabelBackground, "; opacity: ").concat(useNeoColorGen ? "" : 0.5, ";  }\n  .tag-label { font-size: ").concat(options.tagLabelFontSize, "; fill: ").concat(options.tagLabelColor, ";}\n  .tag-label-bkg { fill: ").concat(useNeoColorGen ? options.mainBkg : options.tagLabelBackground, "; stroke: ").concat(useNeoColorGen ? options.nodeBorder : options.tagLabelBorder, "; ").concat(useNeoColorGen ? "filter:".concat(options.dropShadow) : "", "  }\n  .tag-hole { fill: ").concat(options.textColor, "; }\n\n  .commit-merge {\n    stroke: ").concat(useNeoColorGen ? options.mainBkg : options.primaryColor, ";\n    fill: ").concat(useNeoColorGen ? options.mainBkg : options.primaryColor, ";\n  }\n  .commit-reverse {\n    stroke: ").concat(useNeoColorGen ? options.mainBkg : options.primaryColor, ";\n    fill: ").concat(useNeoColorGen ? options.mainBkg : options.primaryColor, ";\n    stroke-width: ").concat(useNeoColorGen ? options.strokeWidth : 3, ";\n  }\n  .commit-highlight-outer {\n  }\n  .commit-highlight-inner {\n    stroke: ").concat(useNeoColorGen ? options.mainBkg : options.primaryColor, ";\n    fill: ").concat(useNeoColorGen ? options.mainBkg : options.primaryColor, ";\n  }\n\n  .arrow {\n    /* Intentional: neo themes keep the bold 8px arrow (like classic themes); only redux-geometry themes use the thinner options.strokeWidth. */\n    stroke-width: ").concat(REDUX_GEOMETRY_THEMES2.has(theme) ? options.strokeWidth : 8, ";\n    stroke-linecap: round;\n    fill: none\n  }\n  .gitTitleText {\n    text-anchor: middle;\n    font-size: 18px;\n    fill: ").concat(options.textColor, ";\n  }\n");
}, "getStyles");
var styles_default = getStyles;
// src/diagrams/git/gitGraphDiagram.ts
var diagram = {
    parser,
    db,
    renderer: gitGraphRenderer_default,
    styles: styles_default
};
;
}),
]);

//# sourceMappingURL=6db99_mermaid_dist_chunks_mermaid_core_c4fcfe5d._.js.map