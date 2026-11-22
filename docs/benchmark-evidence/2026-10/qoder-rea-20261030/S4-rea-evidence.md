<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S4 — REA(MCP 服务器 `rea` / CLI `rea@6.4.0`)取证读数报告

> 认领@2026-10-30/S4

席位:S4(REA 证据榨取 + 补跑)
输入证据(盘上既有,未重跑):

- `G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\asar-analysis.json`(193,121,114 B;subject = `G:\Qoder CN\.qoder-versions\0.4.11\resources\app.asar`)
- `G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\agentsdk-analysis.json`(24,183,892 B;subject = `.../app.asar.unpacked/node_modules/@qoder-ai/qoder-cn-agent-sdk`)
- `G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\files.json`(1,400,884 B;asar 文件清单)

分析器物(本席产出,全部落在 `s4/`):

- `s4/mine.mjs` — 单遍解析证据 JSON,聚合 coverage/limitations/unknowns/fingerprints/nodes/edges/relations,输出 `s4/<name>.mined.json` + stdout 摘要
- `s4/files.mjs` — files.json 的自有代码 vs 三方依赖分布,输出 `s4/files.mined.json`
- 运行形态:`node --max-old-space-size=8192 s4/mine.mjs <证据> <输出名>`

标记约定:[观察] = 直接从 JSON 键读出的量;[推断] = 由观察值推出的结论;[未知] = REA 明说或结构上取不到。

---

## 1. app.asar 证据面总览(asar-analysis.json)

| 读数 | 值 | 怎么量的 | 标记 |
|---|---|---|---|
| 根件 sha256 / inventory_graph_sha256 / manifest_id | 均在 `normalized_result` 顶层(键:`input_path, format, root_artifact_sha256, inventory_manifest_id, inventory_graph_sha256, integrity_contradictions, graph, summary, statistics, limitations, semantic_graph`) | `s4/mine.mjs` → `nr_keys` | [观察] |
| 清单总条目 | 12,956 条(files.json 行数) | `s4/files.mjs` `rows` | [观察] |
| REA 认定为「相关」的文件 | 4,463(`statistics.relevant_files`,= graph 里 `asar-entry` 节点数 4,463,两处自洽) | mine/deep | [观察] |
| 解析成功的 JS | 4,157(`parsed_javascript_files`) | statistics | [观察] |
| parse failures | 16(`statistics.parse_failures`);files.json 自有文件的 `parse` 值里**没有** failed(见 §5)⇒ 16 枚落在三方件 | statistics + files.mjs | [观察]/[推断] |
| AST 节点访问量 | 18,362,585(`visited_ast_nodes`) | statistics | [观察] |
| findings | 19,479(`statistics.findings`;证据面**不含** findings 数组本体,只有计数) | statistics | [观察] |
| 读入文本字节 | 118,061,676(`text_bytes_read`),invalid_utf8_files = 0 | statistics | [观察] |
| graph | nodes 17,096 / edges 18,274 | mine | [观察] |
| semantic_graph | evidence_contexts 8,680 / nodes 31,707 / relations 23,157 / fingerprints 869 / unknowns 58,323 | mine | [观察] |
| summary(Electron 安全面) | browser_windows 6、explicit_web_preferences 33、**preload_entrypoints 0、context_bridge_apis 0、exposed_api_members 0**、ipc{operations 5, main_handlers 5, literal_channels **0**, dynamic_channel_operations **5**, renderer_transmissions 0, renderer_listeners 0, paired 0}、sender_validation_observations 11、utility_processes 0、native_addon_bindings 0(resolved 0) | `nr.summary` | [观察] |

**summary 的读法(关键)**:REA 在这个 asar 上**没有**静态定位到任何 preload 入口、任何 `contextBridge.exposeInMainWorld` 成员、任何字面量 IPC 通道名(5 枚 IPC 操作全部是 dynamic-channel 形态、通道名不可解析)。⇒ "壳层安全面"这一格,静态重建只给得出**计数与形态**,给不出**通道名与 API 表**。[观察](计数)+ [推断](含义)

## 2. graph.coverage 与 semantic_graph.coverage(静态重建覆盖到哪一层)

`graph.coverage` = `{status:"partial", truncated:false, omitted_count:null, limits:[5 条]}`;
`semantic_graph.coverage` = `{status:"partial", truncated:TRUE, omitted_nodes:null, omitted_relations:null, limits:[同一组 5 条], families:[12]}`。
limits 逐条(值现读):`javascript_analysis_parent_result_budget_bytes = 2,014,996,724`;`javascript_analysis_semantic_result_budget_bytes = 0` 与 `= 10,145`(**同名两条、一条为 0**);`worker_heap_limit_bytes = 6,467,616,768`;`worker_timeout_ms = 1,800,000`。[观察]

**12 个语义维(family)的 retained_relations**(量法:`semantic_graph.coverage.families[].retained_relations`,脚本 `s4/mine.mjs` 打印 `semantic_coverage`):

| family | status | retained_relations | unknown_ids 长度 |
|---|---|---|---|
| data-flow | partial | 17,327 | 6,687 |
| object-flow | partial | 1,999 | 8,410 |
| closure | partial | 1,897 | 4,112 |
| call-flow | partial | 1,463 | 6,080 |
| promise-ownership | partial | 278 | 4,250 |
| event | partial | 128 | 4,112 |
| timer | partial | 56 | 4,092+ |
| boundary | partial | **7** | 4,112 |
| resource-lifecycle | partial | **2** | 4,112 |
| child-process | partial | **0** | 4,112 |
| configuration | partial | **0** | 4,112 |
| request | partial | **0** | 4,112 |

**缺口维 = child-process / configuration / request 三族关系数为 0**,boundary 只留 7 条、resource-lifecycle 只留 2 条。⇒ 静态重建**证不出**"这壳起了什么子进程、读了哪些配置、发了哪些网络请求"这一层(不是"没有",是"没拿到")。[观察](retained=0)
按 REA 自己的免责条款(§3 第 5 条"unavailable facts … must not be read as absence"),**不得**把 0 读成"Qoder 不 spawn 子进程/不发请求"。

另:多族 `unknown_ids` 长度齐刷刷 = 4,112(而 unknowns 实总数 58,323),`omitted_relations/omitted_nodes` 全为 `null` ⇒ [推断] 每族 unknown 清单被同一上限截断,且**截断量没有诚实上报**(null 而非数字)。这是 REA 自身的可审计性缺陷。

## 3. 8,230 条 limitations 的聚合(REA 明说"看不出来"的都有什么)

量法:`normalized_result.limitations` 是 8,230 条**字符串**(item_keys = `["<string>"]`);`s4/mine.mjs` 按"去 sha/去数字/去路径/去引号串"归一化成句式指纹再计数 ⇒ distinct_patterns = **18**;合计校验 8,211 + 9 + 10 = 8,230 ✓。

| 桶 | 条数 | 句式(归一化代表) | 性质 |
|---|---|---|---|
| 资源截断:三方件关系展开超预算 | 3,490 | `Resource constraint during analyze_javascript_application: Expanded application relationships for node_modules<PATH> exceed the parent's result budget; complete…` | 覆盖面被砍 |
| 资源截断:同上的带路径前缀副本 | 3,490 | `node_modules<PATH> Resource constraint … The parent reserved it…` | 同一事实记两行 [推断] |
| 资源截断:自有 `out/` 件关系超预算 | 609 | `… Expanded application relationships for out<PATH> exceed the parent's result budget…` | **自有代码也被砍** |
| 资源截断:`out/` 带路径副本 | 609 | `out<PATH> Resource constraint …` | |
| 资源截断:语义图超剩余预算(三方件) | 11 | `… Semantic graph for node_modules<PATH> exceeds the parent's remaining result budget` | |
| 资源截断:zod 件 1 枚 + `out/renderer/pdf.worker.min.mjs` **worker 堆耗尽** 1 枚 | 2 | `Owned JavaScript worker exhausted its heap while analyzing out<PATH> during semantic` | 唯一一枚堆爆在自有件 |
| **完整性矛盾** | **9** | `Artifact integrity metadata contradicts observed bytes at node_modules<PATH>; the observed bytes are untrusted.` | 见 §4 |
| 方法学免责(逐枚 1 条) | 10 | 见下 | REA 自陈能力边界 |

10 条方法学免责(REA 自述,非对方代码):

1. `CommonJS and ESM binding relationships were recovered from inert syntax and resolved only within the inventoried artifact container.` ⇒ 跨容器/运行时解析不可见 [观察]
2. `Dynamic IPC channel expressions remain unresolved and are never paired by textual similarity.` ⇒ 与 summary 的 literal_channels=0 互证 [观察]
3. `Electron API identity follows proven lexical module aliases. Reassigned bindings, dynamic selections, and visibly overwritten namespace members are unresolved;…`
4. `Electron relationships are derived from inert syntax; runtime registration, reachability, defaults, and enforcement remain unproven.` ⇒ **静态只能证"写了",不能证"生效"** [观察]
5. `Graph coverage is incomplete; unavailable facts remain explicit and must not be read as absence.`
6. `JavaScript and HTML were parsed as inert text; bundle bootstrap code was never executed.`
7. `Sender, frame, URL, and origin checks are observations only; REA does not claim that they enforce a complete authorization policy.` ⇒ 11 条 sender_validation **不构成授权结论** [观察]
8. `Static imports, entrypoints, workers, endpoints, and storage relationships do not prove runtime execution.`
9. `Static paths and relationships may remain unresolved when expressions are dynamic or obfuscated.`
10. `Webpack/Rspack factories were recovered from AST literals; REA did not invoke push handlers or bundle bootstrap code.` ⇒ Qoder 自有包正是 webpack 产物(`out/*/chunks/*`、哈希名 chunk),这条直接命中本项目 [推断]

`semantic_graph.limitations` 另有 11 条(量法:`s4/mine.mjs` 键 `semantic_limitations`),前几条直接对应 §2 的 0 值维:`Child-process extraction covers asynchronous node:child_process creation, literal argv/env/stdio options, exit/error listeners, and kill signals.`、`Configuration extraction covers process.env, process.argv, node:fs reads, and direct logical defaults.`、`Boundary extraction covers unshadowed JSON/global coercions plus parse and validation method candidates.`、`Function fingerprints are static candidates; equal digests can remain ambiguous and do not prove behavioral equivalence.`。[观察]

## 4. 9 条 integrity_contradictions(客户端自带二进制完整性异常)

量法:`normalized_result.integrity_contradictions` 数组长度 + `logical_path`/`declared_sha256`/`observed_sha256`(各取前 12 位),脚本 `s4/mine.mjs` → `integrity_contradictions.items`;item 键集 = `contradiction_id, occurrence_id, parent_artifact_id, logical_path, declared_sha256, observed_sha256, entry_kind, unpacked, trust, provenance, limitations`。

| # | logical_path [观察] | declared(前12) | observed(前12) |
|---|---|---|---|
| 1 | `node_modules/@img/sharp-win32-x64/lib/libvips-42.dll` | `f8d356def739` | `d1a6f6c19d25` |
| 2 | `node_modules/@img/sharp-win32-x64/lib/libvips-cpp-8.17.3.dll` | `f1b3c3eeea1b` | `509ffd8a2cc1` |
| 3 | `node_modules/aoq-electron-sdk/prebuilds/win32-x64/alivcffmpeg.dll` | `9c6db565706b` | `9fe90f4d7432` |
| 4 | `node_modules/aoq-electron-sdk/prebuilds/win32-x64/AoqClientSdk.dll` | `f9607f531fbb` | `801a4f214745` |
| 5 | `node_modules/aoq-electron-sdk/prebuilds/win32-x64/PluginOpus.dll` | `291581c73c32` | `2df9c44a93b6` |
| 6 | `node_modules/node-pty/build/Release/winpty-agent.exe` | `969ea6288ca6` | `27305a268301` |
| 7 | `node_modules/node-pty/build/Release/winpty.dll` | `ed208b219f11` | `edec2140dddc` |
| 8 | `node_modules/node-pty/prebuilds/win32-x64/winpty-agent.exe` | `0c4834a0ab2a` | `323cb3178791` |
| 9 | `node_modules/node-pty/prebuilds/win32-x64/winpty.dll` | `e1cb26d868c9` | `bbe358419e9c` |

分布:3 家厂商、4 类能力(图像 libvips / 实时音视频 SDK `aoq-electron-sdk` / 伪终端 winpty 双副本)。REA 定性为 `the observed bytes are untrusted`,条目自带 `trust`/`provenance` 字段。[观察]
[推断] 三种解释需主席分辨:(a) 厂商打包时改过二进制而未回写 asar integrity 清单;(b) 安装/更新过程替换过(0.4.11 是 `.qoder-versions` 版本目录形态);(c) 真篡改。静态证据**不足以**定案 ⇒ [未知]。换 Authenticode 签名核对这条腿:本机 REA 的 `inspect_signature`、`list_architectures` 皆 `available:false`,原因码 `unsupported_host`("Native macOS utilities require macOS"),量法 = `s4/capabilities.json`(179,761 B,`rea@6.4.0 capabilities` 原样落盘)。[观察]

## 5. app.asar 自有代码 vs 三方依赖(files.json,12,956 行)

量法:`s4/files.mjs` 按 `path` 是否含 `/node_modules/` 分桶累加 `bytes`;`total_bytes = 147,543,660`。

| 桶 | 文件数 | 字节 | 占比 |
|---|---|---|---|
| 自有(非 node_modules) | **1,837** | **70,817,441** | 48.0% |
| node_modules | 11,119 | 76,726,219 | 52.0% |

自有代码只住在**一个顶层目录**:`out/`(1,835 文件 / 70,815,068 B)+ 2 枚根文件(2,373 B)。[观察]

| `out/` 二级目录 | 文件数 | 字节 |
|---|---|---|
| `out/renderer` | 1,706 | 45,989,276 |
| `out/main` | 120 | 18,574,099 |
| `out/preload` | 9 | 6,251,693 |

自有件的 REA 分类(`files.json` 的 `kind`/`fileKind`/`parse` **只对自有 1,837 行有值**,node_modules 行这三键为空 ⇒ 相关性判定是后加层):kind = javascript-asset 610 / unknown 1,219 / artifact 6 / package 2;parse = complete 606 / partial 4 / included 2 / null 6 /(未标)1,219。
⇒ **自有 JS 解析率 = 606/610 = 99.3% complete,4 枚 partial,0 枚 failed**;扩展名分布 `.js` 1,818、`.cjs` 9、`.json` 6、`.mjs` 2、`.html` 2。[观察]

最大的自有件(路径 + 字节,现读):

| 路径 | 字节 | parse |
|---|---|---|
| `out/main/electronMain.js` | 17,828,077 | **partial** |
| `out/renderer/assets/Cux9x6wn.js` | 15,009,999 | complete |
| `out/preload/pluginViewDiagramRuntime.cjs` | 3,450,036 | complete |
| `out/renderer/assets/Xom1o5KH.js` | 3,252,844 | partial |
| `out/renderer/assets/presentation-render.worker-*.js` ×2 | 各 ≈2,734,000 | complete |
| `out/preload/pluginViewRuntime.cjs` | 2,610,621 | complete |
| `out/renderer/pdf.worker.min.mjs` | 1,078,612 | complete |
| `out/preload/index.cjs` | 191,036 | complete |
| `out/renderer/office-reader/_framework/dotnet.native.js` / `dotnet.runtime.js` | 216,184 / 198,479 | complete |

三条对主席有用的结构事实:
① **主进程就一枚 17.8MB 的 `out/main/electronMain.js`,且只拿到 partial** ⇒ 全壳最大的单点不可见面积。[观察]
② `out/preload/` 实有 9 个文件、6.25MB(含 `pluginViewDiagramRuntime.cjs`、`pluginViewRuntime.cjs`),而 §1 报 `preload_entrypoints = 0` ⇒ REA 认不出这些 preload 的注册入口。[观察](强反差)
③ `office-reader/_framework/dotnet.*.js` = Blazor WASM 运行时 ⇒ Office 预览不是 JS 解析器。[观察](路径)+[推断](用途)
④ renderer chunk 名是 8 位随机哈希(`Cux9x6wn.js`)⇒ 无 source map 时按标识符追功能不可行(graph 里 `source-map` 节点仅 10 枚,见 §6)。[推断]

## 6. app.asar 的语义节点/边角色分布 + 能力相关抽样

### 6.1 graph 层(量法:`s4/mine.mjs` 对 `graph.nodes[].kind`、`graph.edges[].relation` 计数)

| node kind | n | | edge relation | n |
|---|---|---|---|---|
| unknown | 8,227 | | contains | 12,962 |
| asar-entry | 4,463 | | maps_to | 4,480 |
| javascript-asset | 3,395 | | calls | 486 |
| javascript-module | 292 | | imports | 218 |
| endpoint | 248 | | exposes | 120 |
| artifact | 235 | | loads | 8 |
| package | 210 | | | |
| source-map | 10 | | | |
| native-addon | 9 | | | |
| electron-renderer | 6 | | | |
| electron-main | 1 | | | |

主要边形制(量法:`s4/agg.mjs` `EDGE pairs`):`javascript-asset -contains-> unknown` 8,211、`artifact -contains-> asar-entry` 4,463、`asar-entry -maps_to-> javascript-asset` 4,157、`javascript-asset -calls-> endpoint` **486**、`javascript-module -imports-> javascript-module` 196、`javascript-module -exposes-> javascript-module` 114、`electron-renderer -loads-> javascript-asset` 7、`package -loads-> electron-main` 1、`electron-main -maps_to-> javascript-asset` 1。[观察]

### 6.2 语义层(量法:`semantic_graph.nodes[].kind`、`relations[].kind`)

nodes 31,707:expression 18,862 / module 4,157 / call-site 2,447 / binding 1,759 / property-slot 1,541 / function 904 / parameter 839 / return-site 731 / listener 128 / promise 112 / event 84 / task 64 / timer 48 / literal 22 / boundary 7 / resource 2。
relations 23,157:reads 7,191 / aliases 6,462 / defines 3,153 / captures 1,897 / reads-property 1,752 / argument-to-parameter 617 / writes 521 / calls 479 / returns-to-call 367 / writes-property 220 / creates-promise 112 / awaits 96 / registers-listener 84 / schedules-timer 48 / removes-listener 44 / returns-task 30 / detaches-task 30 / spreads 20 / chains 10 / cancels-timer 8 / coerces 7 / destructures 7(+1)。
`relations[].resolution`:resolved 16,206 / candidate 6,951 ⇒ **30% 的语义边只是"候选"不是结论**。[观察]
fingerprints 869 全部 `status=complete / algorithm=rea.javascript-semantic-function`,键集 = `function_node_id, algorithm, status, components, limitations, evidence, fingerprint_id, fingerprint_sha256`;⇒ 869 枚函数指纹(占 function 节点 904 的 96%),可做版本间比对锚点,但 REA 自陈"equal digests can remain ambiguous and do not prove behavioral equivalence"。**fingerprints 没有 kind/type/category 维**(量法:`s4/mine.mjs` `semantic.fp_type` 聚合结果 = `[["<none>", 869]]`),可分类的只有 `status` 与 `algorithm` 两键。[观察]

### 6.2b unknowns 58,323 条的聚合(任务要 kind/category:该数组**无这两个键**)

键集实测 = `node_id, family, relation_kinds, reason, detail, candidate_node_ids, evidence, unknown_id`(`s4/mine.mjs` `semantic.unknown_keys`;`unknown_kind`/`unknown_category` 聚合结果均为空数组)。可用的两维是 `family` 与 `reason`:

| family | n | | reason | n |
|---|---|---|---|---|
| object-flow | 8,410 | | resource-limit | **49,344**(84.6%)|
| data-flow | 6,687 | | ambiguous-target | 3,728 |
| call-flow | 6,080 | | unknown-value | 2,575 |
| promise-ownership | 4,250 | | dynamic-call | 1,968 |
| configuration / closure / child-process / request / boundary / timer / resource-lifecycle / event | **各 4,112** | | dynamic-property | 708 |
| 合计 | 58,323 ✓ | | 合计 | 58,323 ✓ |

量法:`s4/agg.mjs` 的 `# SG unknown families`(全 12 族)+ `s4/mine.mjs` 的 `semantic.unknown_reason`(5 值)。
`detail` 句式 top(量法 `s4/deep.mjs` `unknowns.top_messages`,归一化去路径/数字/sha 后计数):`node_modules<PATH> Resource constraint …` **41,892**、`out<PATH> Resource constraint …` **7,308**、`Static read property <PATH> has unknown-coverage presence; its receiver is unresolved or not a retained container; object identity is complete.` 1,749、`Unsupported MemberExpression call target.` 1,381、同句 object-identity=partial 790、`Computed member property is not a static string or number.` 666、`Static read property path is unresolved … partial` 521、`Unsupported CallExpression value. Unknown value at binding.` 313(+17 类)。
⇒ [观察] **84.6% 的"未知"是预算截断造成的,不是代码看不懂造成的**;真·语义不可判定(dynamic-call 1,968 + ambiguous-target 3,728 + unknown-value 2,575 + dynamic-property 708 = **8,979 条 = 15.4%**)才是静态方法本身的天花板。[推断]

### 6.2c 869 枚指纹里"与 agent 能力相关"的挑拣结果(诚实汇报:挑不出来)

指纹只挂 `function_node_id` + `components`(无名字、无端点、无通道维),而 `function` 语义节点(904 枚)的名字面在证据里是 `label`/`identity` 混合、自有件多为压缩后的单字母标识(`s4/mine.mjs` `semantic.node_category` 里 `e 251 / i 201 / k 167 / Object 225 / res 274` 这类局部变量名占前列)。⇒ **工具注册 / 提示词常量 / 网络端点 / IPC 通道 / 原生绑定这五类"目标"在 869 枚指纹里没有可直接分类的挂载点**(命中 0,逐类量法见 §6.3);能给的只有"函数级可比对锚"这一形态。[观察]

### 6.3 agent 能力相关的四类目标(逐类给量法与结论)

| 目标 | 读数 | 标记 |
|---|---|---|
| **工具注册** | 证据面**没有** tool/注册类节点(`s4/mine.mjs` capability 段按 kind/role 含 `tool` 过滤 ⇒ 命中 0)。app.asar 侧唯一可见的 MCP 痕迹是三方件本体:`node_modules/@modelcontextprotocol/{client,sdk,server,core}/dist/…`(`s4/agg.mjs` `EDGE relation@source` 中 contains 边 top4 全是各包内的 `zod` 副本,650/648/626/546)。 | [观察] 零命中 / [推断] 工具注册住在运行时数据或 native 侧 |
| **提示词常量** | 无 prompt/instruction/system 类语义节点(mine capability `prompt_node_total` = 0);`literal` 节点仅 22 枚。⇒ 静态面**看不到**任何系统提示词常量。 | [观察](零命中)/[未知](真实位置) |
| **网络端点** | endpoint 248 节点 / 492 观测:`identity.namespace` = network 242、route 6;来源文件 `out/renderer/pdf.worker.min.mjs` **490** 条、`@modelcontextprotocol/client/dist/ajvProvider-*` 各 1 条;mechanism 全是 `call:e.get / call:t.get / call:dict.get / call:Name.get` 之类 ⇒ 取值是 PDF 字典键名(`MCID`、`ColorTransform`、`FreeText`、`Title`)这类**假阳性**,不是 URL。`s4/mine.mjs` 的 URL 正则扫 60,001 条字符串 ⇒ **host 聚合为空(0 个真实 URL)**。唯一外链:三方 demo 页 `node_modules/sprintf-js/demo/angular.html` 引 `https://ajax.googleapis.com/ajax/libs/angularjs/1.3.0-3.0/…`(external、resolution_status=external)。 | [观察] 静态重建**没有**恢复出任何 Qoder 后端端点 |
| **IPC 通道** | `summary.ipc`:operations 5 = main_handlers 5 = dynamic_channel_operations 5,**literal_channels 0**、renderer_transmissions 0、renderer_listeners 0、paired 0;通道名在 graph 里 0 命中(`s4/agg.mjs` `# channel/operation values` 只出现 REA 自己的 `operation=analyze-javascript-source` 4,112 / `project-javascript-application` 4,099 / `parse-json-module` 16 ⇒ "channel" 键根本不存在)。`# IPC-hits n=0`、`# PREF-hits n=0`。 | [观察] 通道名不可得 |
| **原生绑定** | 9 枚 native-addon 节点(全部 `unpacked:true`,量法 `s4/agg.mjs # NATIVE-ADDON`):`node-pty` conpty.node 312,320 / conpty_console_list.node 134,656 ×2 副本(build/Release + prebuilds)/ pty.node 303,104 ×2;`aoq-electron-sdk/prebuilds/win32-x64/aoq_node…` 253,952;`@img/sharp-win32-x64/lib/sharp-win32-x64.node` 433,152;`@napi-rs/canvas-win32-x64-msvc/skia.win32-x64…` **27,294,720**。但 `summary.native_addon_bindings = 0`、`resolved_native_addon_bindings = 0`、边里也只有 `asar-entry -maps_to-> native-addon` 9 条 ⇒ **知道有 9 个 .node,不知道谁 require 了它们**。 | [观察] |
| **子进程能力** | asar 侧 `javascript-module` 的 `declared_specifier`/`specifier` 全集(量法 `s4/specs.mjs`,共 30 项):`http2 42 / stream 24 / node:http 19 / node:http2 18 / crypto 15 / http 10 / node:https 9 / fs 6 / path 4 / process 4 / node:net 4 / node:stream 2 / hono/utils/mime 4` + 若干相对 chunk(`./types-*.mjs` 8 等);**没有 `child_process`**。`reference_kind`:static-import 51 / require 26 / dynamic-import 1;`module_format`:esm 33 / commonjs 20 / unknown 3。 | [观察] asar 的 292 枚模块面看不到 spawn 能力(与 §2 child-process=0 同向) |
| **源图** | source-map 节点 10 枚,全部 `{declared_url:"*.map", resolved_path:null, available:false}`(即 `@modelcontextprotocol/client` 的 ajvProvider/cfWorkerProvider/dialects 系列 `.map`),⇒ 声明了但件不在包内;自有件面 `static_analysis.source_map_urls` 合计仅 **1** 条(量法 `s4/ownstatic.mjs out/`)。 | [观察] |

### 6.4 per-file `static_analysis` 维(REA 每枚 JS 件都留了这张表;量法 `s4/ownstatic.mjs`)

4,099 枚文件带 `static_analysis`,固定 12 键:`parse_status, parse_error_count, visited_ast_nodes, references[], endpoints[], storage[], bundler_registrations[], role_paths[], source_map_urls[], vendors[], electron{}, limitations[]`。
全局面数组合计:references 15,550 / endpoints 2,549 / storage 71 / source_map_urls 453 / vendors 29 / limitations 4,111;**bundler_registrations 与 role_paths 两个数组维合计 = 0(一条都没有)**。
自有 `out/` 面(609 枚):references 3,537 / endpoints 263 / storage 69 / vendors 7 / source_map_urls 1 / limitations 615,`electron` 子对象(`browser_windows/context_bridge_apis/ipc/sender_validations/utility_processes/native_addon_bindings`)在抽样里逐维为空数组。
⇒ [观察] Webpack/Rspack 工厂在 Qoder 自有 bundle 里**一条都没注册进证据面**,而 §3 第 10 条免责条款照样写了;[推断] 17.8MB 单文件 bundle 的 `bundler_registrations=0` + `parse_status=partial` 一起说明:REA 对打包壳的模块表是失效的,`javascript-module` 那 292 枚基本来自三方散件而非壳层。[未知] 壳层真实模块数。

## 7. agentsdk 证据面(`agentsdk-analysis.json`,subject = `@qoder-ai/qoder-cn-agent-sdk`)

| 读数 | 值 | 量法 |
|---|---|---|
| relevant_files / parsed JS / AST / findings / parse_failures | 152 / 134 / 4,068,357 / 2,493 / **0** | `nr.statistics` |
| text_bytes_read | 35,113,971(0 invalid utf8) | 同上 |
| graph | nodes **710** / edges **2,512**;kind 分布:unknown 229 / endpoint 161 / javascript-module 160 / javascript-asset 132 / artifact 19 / electron-renderer 4 / package 3 / worker 1 /(+1 截断);relation 分布:**imports 1,780** / contains 410 / calls 225 / exposes 88 / maps_to 4 / loads 3 / **persists_to 2** | `s4/mine.mjs` `graph.*` |
| semantic | nodes 7,629 / relations 7,196(resolved 4,921 + candidate 2,275)/ fingerprints **174** 全 complete / unknowns 3,714 / evidence_contexts 607 | mine + `s4/agg.mjs` |
| coverage | graph `partial, truncated:false`;semantic `partial, truncated:TRUE`;limits:parent 预算 2,068,135,948 B、`semantic_result_budget_bytes = 0`(**只有一条,连 10,145 那条都没有**)、worker 堆 6,467,616,768 B、超时 1,800,000 ms | `s4/show.mjs graph_coverage/semantic_coverage` |
| limitations | 235 条 / 10 个句式:资源截断 111+111+6 = 228、方法学免责 7、**`dist/_worker/qoder-worker-runtime.obf.mjs` worker 堆耗尽 1** | mine `limitations.top_patterns` |
| summary | browser_windows 0、web_preferences 0、ipc 全 0、sender_validation 0、native_addon_bindings 0 ⇒ 纯 node 侧 SDK,不含 Electron 面 | `nr.summary` |

**SDK 的 12 维 retained_relations(量法 `s4/agg.mjs # SG coverage families`)**:data-flow 4,730 / call-flow 920 / closure 745 / object-flow 667 / promise-ownership 85 / timer 22 / boundary 12 / **request 8** / configuration 4 / event 3 / **child-process 0** / resource-lifecycle 0。
⇒ 与 asar 同型缺口(child-process 0),但 **request 这一维在 SDK 里有 8 条关系**(asar 为 0)。[观察]

**SDK 能力面关键抽样**:
- endpoint 161 节点(namespace network 122 / **route 39**),mechanism 前几:`property:path 34`、`call:request 31`、`call:client.request 25`、`call:A.get 19`、`property:route 16`、`call:A.post 11`;**来源文件 272/275 条集中在 `dist/_worker/qoder-worker-runtime.obf.mjs`**(文件名自带 `obf`= 混淆)。[观察]
- 端点值/路径全部是相对形态:`s4/deep.mjs` 的 `endpoint_hosts` 对 SDK 读出 **161 条全为 `<non-url-or-relative>`** ⇒ 没有绝对 URL;[推断] 真实 API 基址由运行时注入,静态面不可见。
- javascript-module 160 枚的 specifier 里出现 **`static-import:node:child_process`**、`dynamic-import:node:fs`、`node:fs/promises`(+`external:` 形态)、`node:https`、`node:util`、`node:path`、`node:diagnostics_channel`、`require:url/path`、`dynamic-import:http`。⇒ **子进程能力在 SDK 侧静态可见**(与 §6.3 asar 侧无 child_process  specifier 形成对照),但同族 `child-process` 关系仍为 0 ⇒ "引了 node:child_process,却没建出 spawn 关系"。[观察]+[推断]
- 观测属性里另有 `callable_id/callable_kind/static_return_shapes/return_shape_coverage` 各 33 枚 ⇒ REA 的导出返回形状表(`compare-javascript-export-shapes` 的输入面)在 SDK 证据里是实装了的。[观察]
- SDK 侧自有路径(量法 `# ARTIFACT` / `# PACKAGE`):`dist/_worker/runtime-info.json`、`dist/_worker/vendor/qoder-security/package.json`、`dist/_worker/vendor/qoder-security/.qoder-plugin/qoder-hoo…`(钩子件)、`dist/_worker/vendor/qoder-sites/skills/sites-building/{assets,templates}/**`、`…/sites-build-agent-app/assets/{cloud-agents.mjs,qca-realtime.mjs,sse-chat/web/app.js}`、`dist/_worker/vendor/qoder-sites/artifact.json`;包名 3 枚:`sites-google-oidc-example`、`qoder-site-react-starter`、`security-scan`。[观察]
- `electron-renderer` 节点在 SDK 面也有命中(模板 html 的 `html-script-reference`,`resolution_status: not-found`,如 `/src/main.tsx`、`/app.js`)⇒ 壳层模板的脚本引用指向开发态路径,打包后不存在。[观察]
- 键名红线遵守:`.obf.mjs` 内的端点值一律按"非 URL/相对"聚合,未带出任何疑似凭据字符串(脚本内 `SEC` 正则命中即 `<masked-credkey>`)。

## 8. 补跑:`resources/extensions`(目录档,新一轮证据)

命令(实测可用,exit 0,产出 `s4/extensions-analysis.json` 53,902,965 B):
`node scripts/rea.mjs analyze-javascript-application "G:/Qoder CN/.qoder-versions/0.4.11/resources/extensions" --artifact-format directory --integrity-policy record-and-continue --max-heap-mb 6144 --format json`
进度面走 stderr(`s4/extensions-analysis.err` 42,807 B,223 个 parse 步骤逐条 `rea_progress`)。subject = `{name, digest.sha256=e5d3a410…319d, format:"directory", architecture:null, local_path}`。[观察]

| 读数 | 值 |
|---|---|
| relevant_files / parsed JS / AST / findings / parse_failures | 223 / 184 / 4,499,596 / 3,955 / **0** |
| `statistics.modules` | **1,297**(唯一一份 modules 非零的证据;asar 与 agentsdk 都是 0)|
| text_bytes_read | 43,487,291 |
| graph nodes 形制 | javascript-module 840 / unknown 297 / javascript-asset 179 / **javascript-chunk 176** / source-module 43 / artifact 37 / endpoint 26 / worker 6 / electron-renderer 4 / package 3 / (+1) |
| graph edges | contains 959 / imports 683 / exposes 456 / calls 51 / loads 8 / maps_to 5 |
| semantic | nodes **26,045**(expression 19,692 / call-site 2,132 / binding 1,192 / property-slot 790 / parameter 776 / function 634 / +12 类)、relations **20,731**(aliases 6,254 / reads 5,638 / defines 2,354 / captures 1,763 / argument-to-parameter 1,380 / reads-property 1,074 / +21 类)、fingerprints **626**、unknowns **7,631**(reason:ambiguous-target 2,234 / unknown-value 1,937 / resource-limit 1,860 / dynamic-call 1,479 / dynamic-property 余量);coverage `truncated:TRUE`、`semantic_result_budget_bytes = 653` B(比 asar 的 10,145 更小)|
| limitations | 303 条 / 18 句式:资源截断 135+135+4+4+3+3+2+2+2 …;方法学免责 7 条同 §3 |
| **堆耗尽/预算爆掉的件** | `qoder.canvas/cli/canvas/resources/media/canvas-sdk.js`、`qoder.canvas/dist/node/node_modules/esbuild-wasm/esm/browser.min.js`、`qoder.communication/dist/browser/view.cjs` ×2、`qoder.security/dist/browser/view.cjs` ×2 |
| summary | 全零(无 Electron 面:extensions 不是 Electron 壳,而是能力包目录)|

扩展包名(从 limitations 的路径前缀现读,量法 `s4/mine.mjs` → `limitations.top_patterns`):`qoder.canvas`、`qoder.sites`、`qoder.office`、`qoder.knowledge.center`、`qoder.communication`、`qoder.security`(≥6 个)。可见的具体能力件:`qoder.knowledge.center/cli/qoder-qmind/dist/qoder-qmind-mcp-server.cjs`(**独立 MCP 服务器 bundle**)、`qoder.sites/dist/browser/publishPreview.cjs`、`qoder.office/dist/browser/index.cjs`、`qoder.canvas/dist/browser/view.cjs`、`qoder.canvas/dist/node/main.cjs`。[观察]
⇒ 这一格的价值:**壳外资源目录的模块表是重建得出来的(1,297 modules、imports 683 边、exposes 456 边),而 app.asar 壳内重建不出来(modules 0)**。同一工具、两种结果,差别在打包形态而非目标大小。[推断]

## 9. REA 能力面清单(本轮留档 `s4/capabilities.json`,179,761 B,`rea@6.4.0`)

- `capabilities` 顶层 18 个 operation;本机 Win 侧 `available:true` = `decode_interface_builder, extract_artifact, inspect_artifact, inspect_keyed_archive, inspect_managed_artifact, inspect_managed_members, inspect_managed_native_boundaries, trace_dylib_resolution`;`available:false`(码 `unsupported_host`,理由 "Native macOS utilities require macOS")= `capture_native_ui_scenario, demangle_swift, inspect_asset_catalog, inspect_macho, inspect_plist, inspect_signature, list_architectures, observe_native_calls, observe_native_ui`。[观察]
- 子面(Ghidra/反编译类)26 条中 `available:true` 的包括:`analyze_function, procedure_pseudo_code, procedure_asm… (procedure_assembly), procedure_callers/callees, procedure_references, search_strings, list_strings, read_bytes, search_procedures, resolve_native_call_targets, inspect_native_load_image, address_to_file_offset` 等;`annotate_native_function / set_address_name(s) / inspect_native_data_type(部分)` 为 false。⇒ **原生 PE 反编译腿在本机可用**(与本仓 AGENTS §0.12 登记的 Ghidra 12.1.4 一致)。[观察]
- 与本项目对照直接相关的 CLI 命令名(`--help` 现读,留 `s4/…` 顶部输出):`analyze-javascript-application, analyze-web-bundle, compare-application-versions, compare-javascript-export-shapes, compare-source-to-bundle, build-reconstruction-obligation-ledger, evaluate-reconstruction-coverage, evidence-export/evidence-import, inspect-analysis-view, discover-webmcp-tools, inspect-electron-page, capture-electron-scenario, decompile, function, inspect-artifact, inspect-binary-layout, doctor`。[观察]
- `analyze-javascript-application` 的全部可调旗标:`--max-heap-mb`、`--analysis-timeout-ms`(默认 300000,超时返回**部分证据**)、`--artifact-format <auto|asar|directory>`、`--integrity-policy <fail|record-and-continue>`;全局 `--filter-output <keys>`、`--format <toon|json|yaml|md|jsonl>`、`--full-output`、`--token-limit/offset/count`、`--schema`、`--llms`。[观察]
  ⇒ [推断] 复跑 app.asar 想多榨出语义面,唯一有效杠杆是 `--filter-output` 缩面 + 提高语义预算(见 §10 意外 2),而不是加堆。

## 10. 主席必须知道的意外(3 条)

1. **`summary` 的"零"和盘上的"有"直接矛盾**:`out/preload/` 实有 9 个文件 / 6,251,693 B(含 `pluginViewDiagramRuntime.cjs` 3.45MB、`pluginViewRuntime.cjs` 2.61MB、`index.cjs` 191KB),`node_modules/node-pty`、`@img/sharp`、`@napi-rs/canvas`、`aoq-electron-sdk` 共 9 枚 `.node` 全在盘上,而 REA 报 `preload_entrypoints=0 / context_bridge_apis=0 / exposed_api_members=0 / native_addon_bindings=0`。⇒ 静态重建**证明不了** preload 暴露面与原生绑定的消费者,只能证明这些件存在与其哈希。谁把这些 0 读成"没有风险面",谁就在造假。[观察]
2. **语义图是被 ~10KB 预算掐死的,不是被分析能力掐死的**:limits 里 `javascript_analysis_semantic_result_budget_bytes` 同名两条、一条为 `0`、一条为 `10,145`(agentsdk 只有 0;extensions 是 653),对应 `semantic_graph.coverage.truncated=true` 与 8,230 条 limitations 里 8,211 条是 `resource_constraint`(其中 609×2 条落在**自有 `out/` 件**上)。`child-process / configuration / request` 三族 retained_relations **恰为 0**。⇒ 主席要的"起子进程/读配置/发请求"这三层,当前证据等级是**未判定**,而 REA 自己在 limitations 里明写"must not be read as absence"。复跑必须先解决语义预算,再谈结论。[观察]
3. **"网络端点"这一维在 app.asar 上是假阳性主导**:248 个 endpoint 节点里 490/492 观测来自 `out/renderer/pdf.worker.min.mjs`,值是 PDF 字典键名(`MCID`/`ColorTransform`/`FreeText`),用 URL 正则扫 60,001 条字符串得到 **0 个 host**;真正带 route/network 语义的东西反而在 SDK 那枚 `dist/_worker/qoder-worker-runtime.obf.mjs`(272 条观测、`property:path`/`call:client.request`/`route` 命名空间 39 条,且全为相对路径无绝对 URL)。⇒ **端点面必须靠动态捕获(`capture-electron-scenario` / `analyze-web-bundle`),静态这条路在本件上是死的**;同时 `obf` 命名说明对方 worker 运行时是混淆过的,这也解释了 1 枚 worker 堆耗尽。[观察]+[推断]

补一条方法学警告(非"意外"但影响读法):`bundler_registrations` 与 `role_paths` 两维在 4,099 枚文件上**全为 0**,而 REA 仍逐条打印 "Webpack/Rspack factories were recovered from AST literals" 的免责句 ⇒ **REA 的 limitations 是模板化输出,包含未实际命中的条目;引用它自陈能力前必须核对对应数组维是否为 0**。[观察]

## 11. 复跑指令(主席可原样复现本席读数)

```
cd G:/IHUI-AI/.ihui-agent/tmp/qoder-rea
node --max-old-space-size=8192 s4/mine.mjs asar-analysis.json asar
node --max-old-space-size=8192 s4/mine.mjs agentsdk-analysis.json agentsdk
node --max-old-space-size=8192 s4/mine.mjs s4/extensions-analysis.json ext
node --max-old-space-size=8192 s4/agg.mjs <evidence.json>          # 端点/原生件/Electron 面/边/语义族
node --max-old-space-size=8192 s4/specs.mjs asar-analysis.json 30  # specifier / 角色 / 失败句式
node --max-old-space-size=8192 s4/ownstatic.mjs asar-analysis.json out/   # 自有件 per-file 静态维
node s4/files.mjs                                                   # asar 文件清单分布
node s4/show.mjs s4/asar.mined.json limitations.top_patterns 20     # 任意点路径切片
```
产出物全部在 `G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\s4\`:`mine.mjs / files.mjs / deep.mjs / agg.mjs / specs.mjs / ownstatic.mjs / show.mjs / kinds.mjs / nodes.mjs` 与 `asar.mined.json(5,043,161 B)`、`agentsdk.mined.json(343,454 B)`、`ext.mined.json`、`asar.deep.json`、`agentsdk.deep.json`、`asar.agg.txt`、`agentsdk.agg.txt`、`asar.specs.txt`、`asar.ownstatic.txt`、`capabilities.json/.err`、`extensions-analysis.json/.err`。
既有 193MB / 24MB 证据与 `files.json` 一律未改动、未删除;无 git 写操作;无被跟踪路径新增文件。

## 12. 静态重建能证明到哪一层(S4 席的定档答复)

| 层 | 能证到哪 | 依据 |
|---|---|---|
| 文件与哈希 | **可证**:12,956 条清单、4,463 相关件、根件/清单图 sha256、9 枚 dll/exe 完整性矛盾(declared≠observed) | §4、§5、statistics |
| 打包形态与自有代码住址 | **可证**:自有代码 100% 在 `out/`(main 1 / preload 9 / renderer 1,706),三方 11,119 件;主壳单文件 17.8MB 且 partial | §5 |
| 件级"解析得到/得不到" | **可证**:自有 JS 606/610 complete、0 failed、4 partial;16 枚 parse_failure 全在三方侧;1 枚自有件 worker 堆耗尽(pdf.worker) | §3、§5 |
| 模块图(壳内) | **证不出**:`statistics.modules=0`、292 枚 javascript-module 的 specifier 只有 node 内建与 hono/mcp 散件、`bundler_registrations=0`、`electron-main` 仅 1 条 maps_to 边 | §6.1、§6.3、§6.4 |
| 模块图(壳外扩展目录) | **可证**:`modules=1,297`、imports 683、exposes 456、javascript-chunk 176 | §8 |
| 导出返回形状(可作 API 复刻锚) | **部分可证**:SDK 面 33 枚 `static_return_shapes` + 869(asar)/174(SDK)枚 complete 函数指纹;但同族 call-flow 仅 1,463/920 条 | §6.2、§7 |
| IPC 通道名 / contextBridge API 表 | **证不出**(literal_channels 0、5 枚全 dynamic、`channel` 键不存在于证据面;免责句 "Dynamic IPC channel expressions remain unresolved and are never paired by textual similarity") | §1、§6.3 |
| 子进程 / 配置 / 网络请求三族关系 | **证不出**(retained 0/0/0;semantic 预算 10,145→653 B;unknowns 58,323 条里 resource-limit 49,344)| §2、§10.2 |
| 真实后端端点/URL | **证不出**(asar 端点 248 枚里 490/492 观测是 PDF 字典键假阳性、URL host 聚合 0;SDK 端 161 枚全相对路径)⇒ 需动态捕获 | §6.3、§7、§10.3 |
| 系统提示词 / 工具注册常量 | **证不出**(prompt/tool/literal 类节点命中 0;`literal` 仅 22 枚)| §6.3 |
| 运行时行为(注册是否生效、授权是否强制) | **结构上证不出**,REA 逐条自陈免责(§3 第 4、6、7、8 条)| §3 |

未知清单(需换手段):真实 IPC 通道名与 contextBridge 成员、后端主机与路径、子进程 argv/env、系统提示词与工具注册表、9 枚 `.node` 的 require 主体、17.8MB `electronMain.js` partial 之后的未解析面积。出路按性价比:`--filter-output` 缩面重跑 + `capture-electron-scenario`/`analyze-web-bundle` 取动态面 + 对 9 枚 `.node`/4 枚 dll 走已装 Ghidra 12.1.4 的 `procedure_pseudo_code` 腿(本机 `available:true`)。


<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
