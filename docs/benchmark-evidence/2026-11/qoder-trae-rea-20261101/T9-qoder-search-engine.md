<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T9 — Qoder 代码检索引擎本体破译（实现级）

- **HEAD（开工现读）**：`735334d665c07c924a7a186b75bde85bcbb0cfea`（main）
- **取证时刻**：2026-11-01
- **引擎**：rea `rea@6.4.0`，provider `rea-javascript-application` version `1`（`analyze-javascript-application`）
- **主靶（生效中的活引擎）**：`C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/runtime/qoder-search.bundle.mjs` = **4,794,644 B**，自述版本 `1.0.27.b0e1781`
- **最新缓存包**：`…/qoder-context/1.0.91.b22f2d0a/runtime/qoder-search.bundle.mjs` = **5,386,840 B**（`1.0.91.b22f2d0a`）
- 册内所有结论**默认针对 1.0.27**（当前接线生效那一枚）；1.0.91 的增量单列在 §7。

## 0. 定位复核：派单书给的"主靶"是活引擎，但不是最新实现体

根 `…/qoder-context/mcp.json` 的 `args[0]` 直指 `runtime/qoder-search.bundle.mjs`，且 `env.QODER_SEARCH_BUILD_ID="1.0.27.b0e1781-win32-x64"` ⇒ **1.0.27 才是这台机上正在服务 `SearchWorkspace`/`SearchKnowledge` 的那一枚**。派单书写的"约 5.4MB"对应的是 `1.0.91`（5,386,840 B），它是 marketplace 包历史副本（同级并存 8 个版本目录：1.0.51/1.0.61×2/1.0.72/1.0.74/1.0.78/1.0.84/1.0.91）。

复验：
```bash
cat "C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/mcp.json"
cat "C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/runtime/runtime-manifest.json"
ls -la "C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/"
```

**另一处与 T6 的出入（[观察]）**：1.0.27 的根 `mcp.json` 里 `alwaysAllow` **只有 `SearchKnowledge` 一枚**（`SearchWorkspace` 不在白名单），且 `toolOverrides` 只给 `SearchKnowledge` 设了 `alwaysLoad:true`。T6 记的是"白名单 = SearchWorkspace + SearchKnowledge"。⇒ 该白名单在 1.0.27 这一版是**收窄的**。复验：`grep -A3 alwaysAllow …/qoder-context/mcp.json`。

## 1. rea 取证结果与它的诚实边界

**第一次跑失败**（把 `.mjs` 单文件当靶）：

```
code=unsupported_target
message=… accepts only a directory or an .asar file
retryable=false
```
复验：`pnpm rea analyze-javascript-application <file.mjs> --format json` → 落盘 `.ihui-agent/tmp/rea-goal-b45/g-active-1027.json`（829 B，是错误信封）。
**注意这正是派单书预警的坑**：外层 shell 报 `exit code 0`，真失败写在 JSON 里。**判成功只看 JSON 有没有 `error`/`code`。**

**第二次按目录跑成功**（`--artifact-format directory`，`--max-heap-mb 3072 --analysis-timeout-ms 420000`）：
落盘 `.ihui-agent/tmp/rea-goal-b45/g-runtime-1027.json` = **2,870,781 B**，`evidence_id=ev_e9cbb74a…55644d`，`root_artifact_sha256=7208f444…19848e`，`confidence=derived`，`authority=shipped-artifact`，`integrity_contradictions=[]`。
读数（`normalized_result.statistics`，现读）：`relevant_files=5`、`parsed_javascript_files=3`、`visited_ast_nodes=1,093,810`、`findings=459`、`parse_failures=0`；产物含 `graph`（JavaScriptApplicationGraph，1,252,674 B）与 `semantic_graph`（JavaScriptSemanticRelationGraph，1,614,256 B）。

**降级必须自陈（[观察]，来自 rea 自己的 `limitations` 末条）**：
> `qoder-search.bundle.mjs: Resource constraint during analyze_javascript_application: Owned JavaScript worker exhausted its heap while analyzing qoder-search.bundle.mjs during semantic`

⇒ **rea 图形层对这枚 bundle 是"部分覆盖"**（另一条 limitations 明写 "Graph coverage is incomplete; unavailable facts remain explicit and must not be read as absence"）。所以本册的引擎内部结论**主体走静态字面量/调用点级读取**（`rg` 直读 bundle 字节），rea 图形层作为存在性与清单佐证。**未走 rea 图形完整层，结论面为静态字面量级。**

复验：
```bash
cd /g/IHUI-AI && pnpm rea analyze-javascript-application "C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/runtime" --artifact-format directory --format json --analysis-timeout-ms 420000 --max-heap-mb 3072 > .ihui-agent/tmp/rea-goal-b45/g-runtime-1027.json
node -e "const f='.ihui-agent/tmp/rea-goal-b45/g-runtime-1027.json';const j=JSON.parse(require('fs').readFileSync(f,'utf8').slice(0,require('fs').readFileSync(f,'utf8').lastIndexOf('}')+1));console.log(j.normalized_result.statistics,j.limitations)"
```

## 2. 【问 1】切片与索引：代码切片在**服务端**，客户端只做树与差异

这是本册最反直觉、也最值钱的一条。[观察]

端点表（bundle 内 `qn=` 对象，逐字节现读）：

| 键 | 路径 |
| --- | --- |
| `initCodebase` | `/api/v2/service/codebase/sync/initCodebase` |
| `upload` | `/api/v2/service/codebase/file/upload` |
| `checkStatus` | `/api/v2/service/codebase/file/checkStatusV2` |
| `getChunks` | `/api/v2/service/codebase/file/getChunks` |
| `retrieveChunks` | `/api/v2/service/codebase/search/retrieveChunks` |
| `getMerkleNode` / `batchGetMerkleNodes` / `updateMerkleNode` | `/api/v2/service/codebase/sync/{getMerkleNode,batchGetMerkleNodes,updateMerkleNodes}` |
| `startSync` / `refreshSyncLock` / `endSync` | `/api/v2/service/codebase/sync/{startSync,refreshLock,endSync}` |
| `deleteCodebase` / `deleteCodebaseAsync` / `getBundle` / `generateBundle` | `/api/v2/service/codebase/operation/*` |
| embedding / rerank | `/api/v2/service/codebase/embedding`、`/api/v2/service/pro/rerank` |
| 其他 | `commit/batchGetCommitStatus`、`file/bfDiscover`、`/api/v2/service/wiki/{queue,finish}` |

**结论**：**Merkle 节点、切片、向量索引三者都住在服务端**。客户端每次读写 merkle 节点都要打 HTTP（`updateMerkleNode` 的 payload 形态 `{model, dimensions:512, codebaseId, updates}`）。切片（chunk）**不在本地切**——bundle 里对代码只有 `getChunks`/`retrieveChunks` 两个取片出口，全仓 `grep` 代码侧**没有** `tree-sitter`、`tokenize`、`ast` 切片实现（计数现读：`tree-sitter` 0、`Tokeniz` 0）。

**向量维度恒为 512**：所有检索/状态/节点调用都带 `{model: Bo, dimensions: 512}`（[观察]，多处逐字命中）。

**chunk 主键**（[观察]）：`chunk:${sha256.update(`${unitId}\0${text}`).digest("hex").slice(0,24)}:${ordinal}` —— 前缀字面量 `chunk:`、24 位十六进制、尾挂序号。另一路 `md5.update(`${e}_${t}_${n+1}`).digest("hex")` 用于检索期片段标识（序号从 1 起）。

**代码 chunk 的字段面**（[观察]，随 `chunks` 流动）：`filePath`、`startLine`/`endLine` 形态的行定位符、`content`、`source`/`sources[]`、`score`。

**真正的本地切片只在"知识/wiki"那一侧**（[观察]）：markdown 域走 `maxTokens/overlapTokens` 的滑窗切分，默认档 `wiki: {maxTokens:500, overlapTokens:50}`，`card: {maxUnitChars:6000}`；校验函数会抛 `markdown maxTokens must be positive` / `markdown overlapTokens …`；投影器分 `textKind:"title"` 与 `textKind:"content"`，`fragmentId` 即上面那个 `chunk:` 键。

复验：
```bash
B="C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/runtime/qoder-search.bundle.mjs"
grep -oE 'qn=\{[^}]{0,900}' "$B" | head -1
grep -c "dimensions:512" "$B"; grep -c "tree-sitter" "$B"
grep -oE '.{200}chunk:.{0,80}(maxTokens|overlapTokens).{160}' "$B" | head -3
```

## 3. 【问 2】召回手段与**分数融合**（最值钱的一格）

### 3.1 策略阶梯：五档有序枚举 [观察]

bundle 里同一个五元组出现两枚（一枚用于聚合上报，一枚作为合法值表）：

```
["text_only","vector_only","hybrid_merge","hybrid_rerank","hybrid_llm_rerank"]
```

聚合函数（minified 原名 `PVt`）按这张表取下标**最小**的一档作为整场检索的 `executedStrategy`。[推断] 语义 = **多工作区并发检索时，对外报告的执行策略取"最弱那一路"**（只要有一路只做到 `text_only`，整场就报 `text_only`）。同时每个响应都带 `requestedStrategy`（请求档）与 `fallbacks[]`（降级明细）⇒ **请求档与实跑档是两字段分离的**，降级可被调用方审计。

### 3.2 两路召回

- **向量路**（函数 `R8=Oc("retrieve-chunks")`）：日志键 `vector_retrieval_started`，入参逐字 `{codebaseId, topK, filePathPattern, vectorScoreThreshold, queryLength}`；拿回后 `[...a.data].sort((c,u)=>u.score-…)` **按 score 降序**。
- **文本路**：关键词来自 `f8n(keyWords, query)`——先按 `[,，;；\s]+` 切（**含中文全角逗号分号**），再过滤停用词表（`a/an/the/is/are/how/…`），空则回落到查询本身；并产出 `targetDirectories`（限定目录）。文本路走内置 `rg.exe`（`QODER_SEARCH_RIPGREP_PATH`）+ 本地文件读，**不是**倒排索引：bundle 里 `bm25`/`BM25`/`Tfidf` 计数**全为 0**，`elasticsearch` 只作为字符串出现一次。[观察] ⇒ **关键词腿是实时 ripgrep 抓，不做词频打分**；打分全靠后面的 RRF 名次。

### 3.3 融合公式：**加权 RRF，k=60，text 权重 2 : vector 权重 1** [观察]

配置装配处逐字命中（minified，字段名完整可读）：

```
rrfK:            D1e(this.config.rrfK, 60)
textWeight:      D1e(this.config.textWeight, 2)
vectorWeight:    D1e(this.config.vectorWeight, 1)
rerankScoreThreshold:    fLt(this.config.defaultRerankScoreThreshold, d8n)
maxRerankTokens:         SN(this.config.defaultMaxRerankTokens, p8n)
maxCharsPerResult:       SN(t.maxCharsPerResult, this.config.defaultMaxCharsPerResult ?? c8n)
mergeGapLines:           y8n(t.mergeGapLines, this.config.defaultMergeGapLines ?? u8n)
```

⇒ **这就是规格级看不到的那一格**：融合不是加权和而是**倒数排名融合（RRF, k=60）配腿权重**，且**默认把关键词腿压过向量腿 2:1**。[推断] 取向理由：代码检索里字面命中比语义近似更可信。

融合在 chunk 级落地为**来源并集**（[观察]，函数 `cLt`/`J5n`）：每枚 chunk 带 `source` 与 `sources: [...new Set([...(o.sources??[]), "vector"])]`——同一片被两路都打到时，`sources` 收进 `["text","vector"]` 而不产生副本。**去重键就是 chunk 身份本身**，融合只动来源集合与名次。

### 3.4 流水线阶段（逐字打点，七段）[观察]

遥测记录器 `m9n` 产出的 phase 序列（`kind:"phase_result"`，`version:1`）：

```
text_retrieval → vector_retrieval → fusion → rerank → symbol_expansion → adjacent_chunk_merge
```
每段固定带 `result`（`success`/`failure`/`skipped`/`degraded`）+ `durationMs` + 各自计数：`textResultCount`、`vectorResultCount`、`candidateCount`、`symbolExpandedCount`、`adjacentMergedCount`、`resultCount`。多工作区聚合侧同名字段齐（`textRetrievalMs`/`vectorRetrievalMs`/`fusionMs`/`rerankMs`/`symbolExpansionMs`/`adjacentMergeMs`/`retrievalMs`/`processingMs`），并导出 snake_case 形态（`vector_retrieval_status`、`fusion_ms`、`rerank_status`、`symbol_expanded_count`、`adjacent_merged_count`）供上报。

**`rerank` 有两次**（[观察]）：`fusion` 之后一次（`rerankStatus`/`rerankMs`/`rerankDocuments`/`maxRerankTokens`/`rerankScoreThreshold`），策略名里还单列一档 `hybrid_llm_rerank` ⇒ 存在**"重排"与"LLM 重排"两条**；后者对应端点 `/api/v2/service/pro/rerank`（独立重排服务）。
**`symbol_expansion` 在 rerank 之后**（[观察]）：它的 `result` 恒写 `"success"`（`phase:"symbol_expansion",result:"success"` 逐字命中）——**这一路不参与失败判定，也不设阈值门**，属于"锦上添花"型补召回：以命中符号为种子扩捞关联定义/引用（[推断]，具体图来源是服务端 `retrieveChunks` 响应，客户端无符号图实现）。

### 3.5 `adjacent_chunk_merge` = 行区间就近合并，且它是**降级信号位** [观察]

`mergeGapLines`（默认常量 `u8n`）控制"同一文件内两片行距小于阈值即并成一片"；计数 `adjacentMergedCount`、耗时 `adjacentMergeMs`。该 phase 的 `result` 判据逐字为 `t.fallbacks.length>0 ? "degraded" : "success"` ⇒ **合并阶段兼任降级出口的最终落点**。

### 3.6 内置检索质量自检器（本册意外收获）[观察]

bundle 里嵌了一套**检索回归自检**（不是生产路径），键名与阈值逐字可读：

- `minExpectedChunks` / `maxExpectedChunks`（各 17 处命中），失败态字面量 `too_few_chunks` / `too_many_chunks`
- 每片断言：`Chunk ${i} may not contain expected keywords (file: ${path})`
- 关键词相关度门槛：`a = i>0 ? Math.max(1, i*0.3) : 0`，`r<a` 则 `⚠️ Low keyword relevance: ${r}/${i} chunks contain expected keywords (threshold: …)`，并把该行以 `[WARNING] low_keyword_relevance matches=… total=… threshold=… query=…` 的形式**再结构化打一遍**
- 文件类型分布：`📊 File type distribution: JSON.stringify(...)`
- 外层解析器按 `got=(\d+)`、`expected_min=`/`expected_max=`/`type=`、`traceId=`、`codebase…` 反查这些 WARNING 行，超 160 字符截断到 157+`...`

⇒ 对方把"**检索到底准不准**"做成了带机器可解析 WARNING 协议的自测件（`[WARNING] <tag> k=v` 单行形态）。这是本仓可以直接抄的**形态**，不是内容。

复验：
```bash
B="C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/runtime/qoder-search.bundle.mjs"
grep -oE '.{120}rrfK.{260}' "$B" | head -1
grep -oE '\["text_only"[^]]*\]' "$B" | sort -u
grep -oE '.{170}fallbacks.{170}' "$B" | head -4
for k in bm25 BM25 Tfidf tree-sitter elasticsearch; do echo "$k $(grep -c "$k" "$B")"; done
```

## 4. 【问 3】mtree 承担什么

### 4.1 原生 API 面是**自述的**，不需要反编译 [观察]

`runtime/native/mtree/index.cjs`（10,628 B，头注 `auto-generated by NAPI-RS`）末段逐字导出 24 个符号（现读原文，非推断）：

`buildTree`、`buildTreeWithIgnore`、`MtreeProjectIgnore`、`MerkleTreeHandle`、`buildWeightedTree`、`diffTree`、`isNodeChanged`、`MtreeWatcher`、`createSnapshot`、`writeSnapshotToFile`、`readSnapshotFromFile`、`compareSnapshotWithDirectory`、`collectLeafPaths`、`collectStats`、`renderTree`、`encodeZstd`、`decodeZstd`、`isZstdCompressed`、`checkIsBinaryFile`、`checkIsLargeFile`、`computeSimhash`、`computeSimhashBatch`、`hammingDistance`

复验：`sed -n '313p' "…/runtime/native/mtree/index.cjs"`

加载器按 `napi-rs` 三元组枚举 20+ 预编译产物（win32-x64-msvc / darwin-universal / linux-*-musl / android-arm64 / freebsd-x64 / linux-s390x…），回退包名作用域 `@ali/qoder-mtree-<target>` ⇒ **Rust/NAPI-RS 原生件，阿里内部 npm 作用域**。JS 侧解析顺序（[观察]）：`process.env.QODER_MTREE_NATIVE` → `native/mtree/index.cjs` → `../../native/mtree/index.js` → `@qoder/mtree`；失败抛 `Native mtree addon not found. Build it with \`npm run build\` in packages/search-engine/native/mtree, or point QODER_MTREE_NATIVE at its index.js.` ⇒ **对方源码树里有一枚 `packages/search-engine`**（本册唯一直接暴露的对方内部布局线索）。

### 4.2 mtree 在检索里干三件事，**不干打分** [观察/推断]

1. **建/差/快照**（[观察]）：JS 侧包 `FI(e,t,n={})` 调 `diffTree(e,t,{onlyLeaf:n.onlyLeaf,onlyIndexing:n.onlyIndexing})`，把返回映射成 `{path, kind, nodeType, indexing}` 并汇总 `{added, modified, removed, total}`；日志键逐字 `mtree_diff_summary` / `mtree_diff_err`，上送形态 `mtree_diff_gzip_b64`（差集**先 gzip 再 base64**）。快照侧 `writeSnapshotToFile`/`readSnapshotFromFile` 走 zstd（`encodeZstd/decodeZstd/isZstdCompressed`），读回时**显式校验字段完整性**：`Snapshot field \`${t}\` is missing node fields (relativePath/type) — file may be truncated` 才继续。
2. **脏标传播**（[观察]）：脏标**不是布尔位，是带类型的节点属性**——diff 输出自带 `nodeType` 与 `indexing` 两维，JS 侧可按 `onlyLeaf`（只叶=文件级）或 `onlyIndexing`（只取"进索引范围"的节点）收窄；`.markDirty(`（3 处）、`.updateMerkleNodes(`、`getMerkleNode failed. result is nil` 逐字命中。⇒ **传播发生在树结构层：改一片叶 → 祖先链 hash 变 → `diffTree` 只在 `nodeType` 匹配处报变更**，客户端从不需要遍历全仓。
3. **删除/改名**（[观察]）：`diffTree` 返回**三桶**（`added`/`modified`/`removed`），改名 = `removed 旧 + added 新`；**没有任何 rename 检测**（bundle 与 napi 导出面均无 `rename`/`move`/`similarity` 型出口）。[观察] 但 `computeSimhash`/`computeSimhashBatch`/`hammingDistance` 三件套是**内容近重检测原语**（SimHash + 海明距离），在检索路径里没被用于 rename ⇒ 用于知识/内容去重侧（[推断]）。删除的服务端收尾走 `deleteCodebase`/`deleteCodebaseAsync` 与 `updateMerkleNodes`。
4. **事件驱动而非轮询**（[观察]）：`MtreeWatcher`（napi 原生 watcher）+ JS 侧 `scheduleMtreeSync`/`startMtreeSync`/`runMtreeSync`/`reportMtreeFirstBuild`/`reportMtreeFailure`；`checkIsBinaryFile`/`checkIsLargeFile`/`buildTreeWithIgnore`/`MtreeProjectIgnore` ⇒ **二进制、超大文件、工程 ignore 规则都在原生层剪掉**，不进 diff、不上送。
5. **同步要抢锁**（[观察]）：`startSync` 拿 `syncToken`（缺即 `throw`），期间 `refreshLock` 续租，收尾 `endSync` 必须见 `data.released` 否则 `EndSync did not release the sync lock`。⇒ 索引写入是**带租约的串行协议**，不是即发即忘。

### 4.3 与 Trae 的 merkletrie 分片脏标对撞

| 维 | Qoder mtree（1.0.27） | Trae merkletrie（`T2`） | 差 |
| --- | --- | --- | --- |
| 脏标粒度 | 节点带 `nodeType`+`indexing` 两维属性，可按 `onlyLeaf`/`onlyIndexing` 收窄 | 分片（shard）级脏标 | Qoder 能"只取进索引面的节点"，过滤在原生层 |
| 差集编码 | `diffTree` 三桶 + `gzip→base64` 上送；快照 `zstd` | 分片脏标随快照 | 两种压缩各管一面（**传输 zstd/gzip 分工**） |
| 完整性自证 | 快照读回**逐字段校验并拒绝截断文件** | 未见同等出口 | Qoder 多一道"读到坏档不当没发生过" |
| 改名 | 无 rename 检测（removed+added） | 无 | **两边都缺同一格**（本仓可在此超越） |
| 剪枝位置 | 原生层（binary/large/ignore） | 分片层 | Qoder 把剪枝下沉进 `.node`，JS 无规则副本 |
| 并发写 | `startSync`/`refreshLock`/`endSync` 租约协议 | 未见同等协议 | Qoder 有明确锁生命周期 |

复验：见 §4.1/§4.2 命令；对撞侧读 `docs/benchmark-evidence/2026-10/trae-rea-20261031/T2-trae-periphery.md`（须现读，勿引本表数字当现值）。

## 5. 【问 4】上下文组装：排序、去重、装箱

- **排序**：向量腿先按 `score` 降序（[观察]），融合按加权 RRF 名次（§3.3），重排过 `rerankScoreThreshold` 与 `maxRerankTokens`（送重排服务前先按 token 预算裁候选集）。[推断] `maxRerankTokens` 的存在说明**重排是有 token 成本的付费/慢路径**，所以先裁再排。
- **去重**：**跨腿靠 chunk 身份 + `sources[]` 并集**（§3.3），不是相似度阈值；**同一片重复出现**在知识侧另有计数器 `r.set(s, c+1)` ⇒ 同 text 在同 unit 内递增 ordinal，**不丢弃、只编号**（[观察]）。跨代去重的原语是 napi 的 `computeSimhash`+`hammingDistance`（[观察]：存在于导出面；[未知]：具体阈值与调用点在 bundle 语义图未覆盖区）。
- **装箱**：三层预算，全部是配置字段而非硬编码（[观察]）：
  - 单片上限 `maxChunkChars`
  - 每结果上限 `maxCharsPerResult`（默认常量 `c8n`）
  - 总量上限 `maxTotalChars`（默认常量 `s8n`）
  - 就近合并 `mergeGapLines`（默认 `u8n`）——同文件相邻片合成一片，省一次"上下文重复"
  ⇒ **"每文件配额"这一格他们真做了**（`maxCharsPerResult` 逐结果=逐片，配合 `filePathPattern` 限定与 `targetDirectories`）。[推断] 跨文件的公平性靠 RRF 名次自然分布，未见显式 per-file 名额表。
- **窗口渲染**：mtree 自带 `renderTree({cwd, scope, maxTokens})` 与 `countFiles({cwd, scope})`（[观察]，JS 包了一层 `_$e` 注入 cwd）⇒ **仓库树文本是被"按 token 预算渲染"出来的**，这是"装箱"的另一半：不是只装箱命中片，还装箱目录骨架。

复验：`grep -oE '.{80}(maxCharsPerResult|maxTotalChars|maxChunkChars).{120}' "$B" | head -4`、`grep -oE '.{120}renderTree.{200}' "$B" | head -2`

## 6. 【问 5】知识条目那一侧：与代码检索是**同一套检索、不同一套构建**

[观察] 三点：
1. **共用检索面**：`retrieveChunks` 一个端点同时服务代码与知识片；策略阶梯、RRF、rerank、遥测字段两域同构（`indexModeSelected` 有 `remote_file_indexing_completed`、`remote_file_indexing_pending`、`remote_file_indexing_timed_out`、`initial_indexing`、`repository_index_started/completed/failed`、`index_mode_selected`、`create_index_plan`/`index_plan_created`）。
2. **构建面自成一套**（[观察]）：域开关 `domains:{wiki:{…chunking…}, card:{maxUnitChars}}`、`embedding:{qps:5, batchSize:16, timeoutMs:1e4, retry:{attempts:3, backoffBaseMs:1e3, backoffCapMs:6e4}}`、`deltaGate:{wiki,cards}`、`lease:{ttlMs:12e4, heartbeatMs:3e4, onConflict:"wait", waitTimeoutMs:6e4, pollIntervalMs:500}`、`backflowCommits:100`、`maxChangedFiles:1e3`、`resumeInterruptedRuns:!0`，端点 `/api/v2/service/wiki/queue` 与 `/wiki/finish`。**注意顶层 `enabled:!1`**——知识自动索引管线默认关，靠 `resumeInterruptedRuns`/`deltaGate`/`backflow` 增量续跑。
3. **知识索引有独立健康态与日志去重**（[观察]）：`knowledge vector index degraded|recovered|ready|progress` 四态，按 `readiness==="ready"` 分级到 warn/info/debug，且带 `lastLogged`/`lastLoggedAt` 三件套做**同态不重复上报**（函数 `LJt(u.lastLogged,s,u.lastLoggedAt,c)`）。

`SearchKnowledge` 的实现与 `SearchWorkspace` **在同一个 bundle、同一套融合管线里**（[观察]：两者都出现在 `mcp.json`/`toolOverrides`，bundle 内 `SearchKnowledge` 3 处、`search_workspace` 1 处字面量）。[未知] 8 枚知识写工具的具体工具名清单——本轮未能定位注册表（bundle 内未出现 `name:"…",description` 形态，注册走 SDK 的其它 API，且 rea 语义层因堆耗尽未覆盖该面）。**这一问按 §9 记为未判定，不冒充已读。**

复验：`grep -oE '.{100}knowledge vector index .{220}' "$B" | head -3`、`grep -oE 'domains:\{wiki:.{0,420}' "$B" | head -1`

## 7. 【问 6】失败与降级：契约是"抛错并附索引状态"，但**聚合状态位偏乐观**

[观察] 错误类：
```
Rc = class extends Error { constructor(n, o=[], r){…}; this.indexStatuses = o; this.name = "ProviderSearchError" }
```
抛出点逐字：
- `throw new Rc("vector index is initializing", [d])` —— 向量索引尚在初始化
- `throw new Rc("vector index is initializing", [j_(root,"initial_indexing",e.indexStatuses)])`
- `s.length===0 ⇒ throw new Rc("vector retrieval unavailable", [j_(root,"failed",e.indexStatuses)])` —— **某一工作区所有向量分片都失败 ⇒ 硬抛，不返回空数组**

⇒ 这条与本仓 §0.3 同构且做得更实：**"取不到"是显式异常 + 结构化 `indexStatuses` 附件，绝不静默返回空**。调用方可以按异常名 `ProviderSearchError` + `indexStatuses` 判"是没建完、还是建完但打不通"。远端侧对应三态 `pending/completed/timed_out`（`remote_file_indexing_*`）+ `wait_remote_index`。

[观察] **两处乐观位（是真缺陷，可作为超越轴）**：
- 聚合文本状态 `iQ(e)` = `e.includes("success")?"success":e.includes("failure")?"failure":"skipped"` ⇒ **多工作区里只要有一路 success，整场就报 success**，同场的 failure 被吞。
- `symbol_expansion` 的 `result` 恒 `"success"`（§3.4）⇒ 该阶段无失败面。
- 对照之下 `executedStrategy` 却是**取下标最小（最弱）一档**（§3.1）⇒ 同一份遥测里，策略维悲观、状态维乐观，两维不自洽。

[观察] 另有 `search_failed`（`… ? … : "search_failed"` 终态位）与 `errorSummary`/`statusCode` 随上报带出。

复验：`grep -oE '.{60}ProviderSearchError.{0,60}' "$B" | head -2`、`grep -oE 'function iQ.{0,160}' "$B" | head -1`、`grep -oE '.{80}(vector index is initializing|vector retrieval unavailable).{80}' "$B"`

## 8. 1.0.27 → 1.0.91 的演进线索（对方正在动哪格）

[观察]（包面差异，非 bundle 内实现对比）：
- `files` 新增 `legacyMigrationWorker: "knowledge-legacy-migration-worker.js"`（1.0.27 无此文件/此键）⇒ **知识侧有一次代际迁移**，1.0.91 起带迁移 worker。
- `ripgrep` 从 `ripgrep/rg.exe` 改指 `../bin/rg.exe`；`bin/` 里新增 `qoder-context-hook.exe`。
- bundle 体积 4,794,644 → 5,386,840（+592,196 B，约 +12%）；mtree `.node` 1,794,048 → 1,868,808（+74,760 B）。8 个历史包体积单调递增。
- 1.0.27 的 `mcp.json` `alwaysAllow` 只有 `SearchKnowledge`（§0）。
复验：
```bash
R="C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context"
diff <(cat "$R/runtime/runtime-manifest.json") <(cat "$R/1.0.91.b22f2d0a/runtime/runtime-manifest.json")
```
[未知] 1.0.91 bundle 内部实现增量（本席时间盒给了活引擎，未对 1.0.91 跑第二轮 rea）。

## 9. 未判定登记（§0.3：取不到就是取不到）

| 问 | 未判定内容 | 原因 |
| --- | --- | --- |
| 2 | `rerankScoreThreshold`/`maxRerankTokens`/`mergeGapLines`/`maxCharsPerResult`/`maxTotalChars` 的**默认常量数值**（`d8n`/`p8n`/`u8n`/`c8n`/`s8n`） | minify 后为变量名，数值需解常量定义链；rea 语义层堆耗尽未覆盖 |
| 4 | `simhash`/`hammingDistance` 的**阈值与调用点** | napi 导出面确证存在；bundle 内消费点未定位（未反编译原生件，本席时间盒排除） |
| 5 | **8 枚知识写工具的工具名清单** | bundle 内未命中 `name:"…",description` 注册形态，工具清单需从 MCP `tools/list` 运行时取，本席不执行插件 ⇒ 判未判定 |
| 3 | `MtreeWatcher` 的事件语义（去抖窗、批量粒度） | 需反编译 `.node` 或运行时观察，二者均在本席时间盒外 |
| 全 | 1.0.91 相对 1.0.27 的**实现级**增量 | 未跑第二轮 rea |

## 10. 缺口对撞表（本席唯一交付判据；≤10 条，按补齐性价比排序）

| # | 对方那格是什么 | 本仓现读有什么（file:line） | 判定 | 最小落点（具体文件 + 具体动作） |
| --- | --- | --- | --- | --- |
| 1 | **代码检索=关键词腿与向量腿加权 RRF 融合**（`rrfK:60`/`textWeight:2`/`vectorWeight:1`），两路同时跑 | 融合件**已有但只服务文档 RAG**：`apps/ai-service/app/services/reranker.py:113 rrf_fuse`、`:265 rerank_with_fallback`，消费者仅 `apps/ai-service/app/services/rag.py:504`、`:734`。代码路径是**串行回落不是融合**：`mcp_server.py:1341 _tool_search_codebase` 内 `use_semantic` 分支 → "失败或无结果时静默 fallback 到下方 regex"；`codebase_indexer.py:932 search()` 纯 pgvector 委托 `/api/v1/codebase/search` | **真缺口**（件在、没接到代码面上） | `apps/ai-service/app/services/mcp_server.py`（`_tool_search_codebase`）：把 regex 腿与语义腿改为**同时取回 → import `reranker.rrf_fuse`（`rankings` 两路 + 腿权重 `{text:2,vector:1}`，k 读现成 env `RAG_RRF_K`）**，不再串行二选一；配 `scripts/tests/` 镜像用例锁"融合前后名次单调性 + 单腿失败不塌成空" |
| 2 | chunk 带 `sources[]` **来源并集**（同片双命中不复制，`[...new Set([...sources,"vector"])]`），可审计每片是被哪路捞到 | `packages/database/src/schema/codebase-index.ts:41 codebaseChunks` 无来源列（字段面 `:46-:57`：`filePath/lineStart/content/embedding/embeddingProvider`）；`codebase_indexer.py:151 CodeChunk` 同缺 | **真缺口** | 给 `CodeChunk` 与 `codebaseChunks` 加 `sources: text[]`（或 varchar 逗号面），在 #1 的融合处按腿写并集；响应体逐片回 `sources`，测试断言"两路都命中的片只出现一枚且 `sources` 含二值" |
| 3 | **阶段化检索遥测**：`text_retrieval→vector_retrieval→fusion→rerank→symbol_expansion→adjacent_chunk_merge`，逐段 `result`+`durationMs`+计数 | 无同形件。`mcp_server.py:1341` 只回 `semantic_index` 单字段（`semantic_index_field` 声明 `:1363`、赋值 `:1425`、出体 `:1450`；V3 #75 加了"语义这轮为什么没给结果"，方向对但只有一腿）；`context_recall.py:29 _RECALL_THRESHOLD` 无阶段面 | **真缺口** | `apps/ai-service/app/services/mcp_server.py`：`_tool_search_codebase` 返回体加 `phases:[{phase,result,durationMs,count}]`（六段固定序），每段自计时；单测锁"腿被跳过时该段 `result="skipped"` 而不是缺项" |
| 4 | **降级可审计**：`requestedStrategy` 与 `executedStrategy` 分两字段 + `fallbacks[]`；异常 `ProviderSearchError` 附 `indexStatuses[]`，"索引没建完"与"建完但打不通"分态；空结果一律**硬抛不静默** | 部分有：`codebase_indexer.py:162-163` `embedding_provider` 注释"离线回落必须可识别不冒充"、`:180 merkle_root`、`mcp_server.py:1363` `semantic_index_field` 显式 None/非 None 语义 | **已具备（方向）+ 真缺口（形态）**：只覆盖语义一腿的请求档/执行档 | `apps/ai-service/app/services/codebase_indexer.py`（`IndexResult`，`:168`）：加 `requested_mode`/`executed_mode`/`fallbacks: list[str]`，并把"腿跳过"从注释升为字段；`_tool_search_codebase` 出口透传 |
| 5 | `adjacent_chunk_merge` + `mergeGapLines`：同文件行区间就近并片（省重复上下文），并把合并当降级落点（`fallbacks.length>0⇒"degraded"`） | 全仓 `mergeGapLines`/`adjacent` 检索仅命中"adjacent tagging"协议注释（`apps/api/src/routes/workspace.ts:46`、`apps/ai-service/app/types/api_client.py:473`），**无行区间合并实现**；`codebase_indexer.py:118 MAX_CHUNK_CHARS = 8000` 只做单片截断（`:338-339`、`:422-423`、`:446-447` 三处重复截断）；降级固定行档 `:120-121 FIXED_CHUNK_LINES = 100 / FIXED_CHUNK_OVERLAP = 50` **已有行重叠**（与对方 wiki 腿 `overlapTokens:50` 同数不同源） | **真缺口** | `apps/ai-service/app/services/codebase_indexer.py`：新增 `_merge_adjacent(chunks, gap_lines)`（同 `file_path` 且 `line_start - prev.line_end <= gap` 则并片、并片后重算 `sources` 并集），在 `search()` 出口与 #1 融合之后调用；截断三处收成一个私有 `_truncate` |
| 6 | **符号扩召回**在 rerank **之后**补一跳（`symbol_expansion`/`symbolExpandedCount`），不参与失败判定 | 本仓切片是 AST 符号级的（`codebase_indexer.py:7` 头注、`:312 _chunk_by_ast`、`:392 _chunk_by_regex`，含 `symbol_name/symbol_type`）**但无"以命中符号为种子再捞关联定义/引用"这一跳**；`mcp_server.py:1341` 的符号面只是 regex 定义行匹配 | **真缺口**（有切片底子，缺那一跳） | `apps/ai-service/app/services/codebase_indexer.py`：加 `expand_by_symbols(hits, top_k)`——取命中片的 `symbol_name` 作二次查询（同符号定义+引用片），并入结果、`sources` 标 `symbol`、计数 `symbolExpanded`；测试锁"扩展片不得把已被两路命中的片复制成两份" |
| 7 | **三层装箱预算** `maxChunkChars` / `maxCharsPerResult` / `maxTotalChars` + `maxRerankTokens`（送重排前先裁） | 只有"上下文总字"一档：`api/v1/rag.py:18` 注释列 `score_threshold / top_k / max_context_chars`、`:40 score_threshold Field(0.0–1.0)`；`codebase_indexer.py:118` 单片上限 8000 字符、`:123 MAX_CHUNKS_PER_FILE = 200`、`:127 EMBEDDING_BATCH_SIZE = 20`；**无每结果/每片之外的第二层配额，也无送重排前的 token 裁** | **真缺口（部分）** | `apps/ai-service/app/services/reranker.py`（`rerank_with_fallback:265`）：进入 `llm_rerank_scores:182` 前按 `llm_rerank_top_k:77` + 字符预算裁候选；`mcp_server.py` 出口加 `max_chars_per_result` 逐结果截断（复用 #5 的 `_truncate`） |
| 8 | **仓库树按 token 预算渲染**（napi `renderTree({cwd,scope,maxTokens})` + `countFiles`）——装的不只是命中片，还有目录骨架 | 有 `context_engine.py`/`context_recall.py`（向量召回 + `_RECALL_THRESHOLD=0.7`），但**无"目录树带预算渲染成文本"出口** | **真缺口（低成本）** | `apps/ai-service/app/services/context_engine.py`：加 `render_repo_tree(root, *, scope=None, max_tokens)`（深度/条目双限、超限逐层折叠为 `… (N more)`），把产物作为上下文一段注入；单测锁"同一 max_tokens 输入下输出字符数有上界且根目录必在输出内" |
| 9 | **检索质量自检器**：`min/maxExpectedChunks` + `too_few_chunks`/`too_many_chunks` + 关键词命中阈值 `max(1, 0.3×total)` + 可解析 `[WARNING] <tag> k=v` 单行协议 | 无同形件；本仓有 `check-delivery-report-consistency.mjs`（§10）等**产物一致性**门，但**没有"检索准不准"的量尺** | **真缺口**（形态可搬，内容自定） | 新建 `scripts/check-retrieval-quality.mjs`（只读哨兵，**不进提交链**，同 §12 只读尺子口径）：给定 fixture 查询集，跑 `search_codebase` 出口，判"期望片数区间 + 关键词命中率 ≥30% + 文件类型分布"，输出 `[WARNING] low_keyword_relevance matches= total= threshold=` 单行形态；配 `scripts/tests/` 镜像 |
| 10 | **索引写租约协议** `startSync→syncToken→refreshLock→endSync(released 必须为真)` + `checkStatusV2(fileIds)` 服务端裁决 + 上送前 `gzip→base64` | 有 Merkle 增量（`codebase_indexer.py:749 incremental=True`、`:792 _load_snapshot`、`:810 prev_snapshot.get(rel)==content_hash` 跳未变、`:816 deleted_paths` 差集、`:859` 变更才重建）——**增量这格已具备，不是缺口**；缺的是"并发写同一仓索引"的租约/续租 | **形态不适用→部分真缺口**：本仓索引在自家 PG，无跨进程上送面；但**多会话并发索引本仓真实存在**（§12 多会话） | `apps/ai-service/app/services/codebase_indexer.py`：`index_repository` 入口包一层本仓现成 `scripts/git-lock.mjs`/`deploy-lock.mjs` 同族 lease（或 PG advisory lock），带 TTL+心跳；测试断言"两个并发 index 只有一个取得租约，另一个显式让路不写脏快照" |

**排序依据**（#1→#10 递减）：#1/#2 是"同一份查询质量"的直接差，且本仓融合件已存在、只差接线（改一个函数）；#3/#4 决定出问题能不能定位；#5/#6/#7 是召回与观感的增量；#8/#9 低成本高信息；#10 是并发正确性兜底。

**不进表的观察**（AGENTS §1 台账门槛）：① 服务端索引是对方云形态选择，本仓本地化是既定架构，不判"缺口"；② 向量维度 512 vs 本仓 1536（`codebase-index.ts:8`）是模型档位差异，非能力差异；③ 改名无 rename 检测**两边都缺**（§4.3），属可超越点而非对撞缺口；④ 1.0.27 `alwaysAllow` 收窄为单枚是对方发版配置事实，与本仓能力无关；⑤ 8 枚知识写工具清单未取到（§9）= 待取证，不是可派单工作。

## 11. 复验命令汇总（一次性）

```bash
R="C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context"
B="$R/runtime/qoder-search.bundle.mjs"
# 0 定位
cat "$R/mcp.json" | head -30
# 2 端点表 / 维度
grep -oE 'qn=\{[^}]{0,900}' "$B" | head -1; grep -c "dimensions:512" "$B"
# 3 策略阶梯 + 融合常量
grep -oE '\["text_only"[^]]*\]' "$B" | sort -u
grep -oE '.{120}rrfK.{260}' "$B" | head -1
# 4 mtree API 面（自述）
sed -n '313p' "$R/runtime/native/mtree/index.cjs"
grep -oE 'diffTree\(e,t,\{.{0,200}' "$B" | head -1
# 7 降级契约
grep -oE '.{80}(vector index is initializing|vector retrieval unavailable).{80}' "$B"
grep -oE 'function iQ.{0,160}' "$B" | head -1
# 本仓对撞侧
grep -n "rrf_fuse\|rerank_with_fallback" apps/ai-service/app/services/rag.py
sed -n '1341,1375p' apps/ai-service/app/services/mcp_server.py
sed -n '41,80p' packages/database/src/schema/codebase-index.ts
```

## 12. 红线自证

未粘对方源码进本册（只留结构事实、函数/字段/端点名、定量读数、以及**最长两行**的签名形态）；未执行插件、未联网、未反编译 `.node`/`.exe`、未破解 `assets/r1/a.bin`/`b.bin`（仅登记其存在与被 manifest 键名指向这一事实）；未打印 `installed_plugins.json`/`installed_plugins_v2.json`/`marketplaces/**` 任何值；`logs/qoder-context*.log` 未读内容。rea 落盘件全部在项目外批准落点之外的本仓 gitignored 临时区 `.ihui-agent/tmp/rea-goal-b45/`。未 `git add`/`commit`/`push`，未改 `apps/**`、`packages/**`、`scripts/**`、`PROJECT_PLAN.md`、`AGENTS.md`、`README*.md`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
