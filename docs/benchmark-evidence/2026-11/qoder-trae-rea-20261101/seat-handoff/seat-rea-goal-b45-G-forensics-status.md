<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# G-forensics 心跳 — T9 Qoder 检索引擎本体破译

席: 取证席(G-forensics)
目标: 用 rea 把 Qoder `qoder-search.bundle.mjs` 破到实现级 + 出「可派单缺口清单」
开工: 2026-11-01
HEAD(现读): `735334d665c07c924a7a186b75bde85bcbb0cfea` (main)
产出册: `G:/IHUI-AI/docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T9-qoder-search-engine.md`

## 定位复核结果(已实测)

派单书给的"主靶"路径确实存在，但**它不是最新实现体**，且**它才是当前接线生效的那一枚**：

| 形态 | 绝对路径 | 字节 | 版本自述 | 接线状态 |
| --- | --- | --- | --- | --- |
| 生效中(活引擎) | `…/qoder-context/runtime/qoder-search.bundle.mjs` | 4,794,644 | runtime-manifest `1.0.27.b0e1781` | 根 `mcp.json` 的 `args[0]` 直指它，`QODER_SEARCH_BUILD_ID=1.0.27.b0e1781-win32-x64` |
| 最新缓存包 | `…/qoder-context/1.0.91.b22f2d0a/runtime/qoder-search.bundle.mjs` | 5,386,840 | `1.0.91.b22f2d0a` |  marketplace 包历史副本(8 个版本目录并存) |

⇒ 派单书说的"约 5.4MB"= 枚 `1.0.91`(5,386,840 B)；而 `-size +1M` 现读到的 `runtime/` 那枚是 1.0.27。
⇒ 本席**两枚都读**，并逐格标明属于哪一枚；差异本身就是"对方在演进什么"的证据。

版本目录(现读 8 枚): 1.0.51 / 1.0.61.7f8d7bb7 / 1.0.61.d5594762 / 1.0.72 / 1.0.74 / 1.0.78 / 1.0.84 / 1.0.91
bundle 体积单调递增 5,231,179 → 5,386,840；mtree `.node` 1,794,048 → 1,868,808。

## runtime 组件面(现读)

- `native/mtree/index.cjs` 10,628 B(napi 加载器，可读 JS)
- `native/mtree/mtree.win32-x64-msvc.node` 1,794,048 B(原生，本席**不**反编译，只读 bundle 侧调用面)
- `ripgrep/rg.exe` 5,429,760 B(1.0.27)；1.0.91 改指 `../bin/rg.exe`
- `assets/r1/a.bin` 3,409 B + `b.bin` 110,918 B(T6 标"未解/加密资产"——本席只判"被谁调用"，不破解)
- `syncWorkspaceScanWorker.js` 1,769 B(1.0.27)
- **1.0.91 独有**: `knowledge-legacy-migration-worker.js`(manifest 键 `legacyMigrationWorker`)⇒ 知识侧有代际迁移，1.0.27 无

## 已开工动作

1. `rea analyze-javascript-application` 对 bundle 落盘 JSON → `.ihui-agent/tmp/rea-goal-b45/g-*.json`(判成功只看 JSON 有无 error/code，不看退出码)
2. 静态字面量级抽取(chunk/score/rerank/mtree/BM25/embedding 标识符与调用点)
3. 本仓对撞基准现读: `codebase_indexer.py` / `knowledge_rag.py` / `mcp_server.py` / `packages/database`

## 边界自证

- 只分析程序包(`.mjs`/`.node`/manifest/mcp.json/hooks.json 结构)；不打印 `installed_plugins*.json`、`marketplaces/**` 的值，不看 `logs/qoder-context*.log` 内容
- 不粘对方源码进册(只写结构事实/函数名/定量读数/最长几行签名形态)
- 不执行插件、不联网、不反编译原生件、不提凭据
- 不 `git add`/`commit`/`push`；不改 `apps/**` `packages/**` `scripts/**` `PROJECT_PLAN.md` `AGENTS.md` `README*.md`

## 状态：**已交册（席位收口）**

- 册：`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T9-qoder-search-engine.md`（315 行 / 40,484 B，未 `git add`，交主席落地）
- 水印：`watermark.mjs inject → injected`；`check-watermark-syntax.mjs`(门 95) → **全部通过 RC=0**；`watermark verify` → 覆盖 1/1，残迹/损坏/仅隐写 全 0
- rea 落盘：`g-runtime-1027.json` 2,870,781 B（成功，`evidence_id=ev_e9cbb74a…`）；`g-active-1027.json` 829 B（**失败信封**，`unsupported_target`，留作复验证据）

## 六问回答进度

| 问 | 状态 | 关键读数 |
| --- | --- | --- |
| 1 切片与索引 | 已答 | 切片/merkle/向量**三者都在服务端**（端点表逐字）；`dimensions:512`；本地代码侧无 tree-sitter/tokenize/bm25（计数 0）；本地只切 markdown |
| 2 召回与融合 | **已答（最值钱那格）** | 五档策略阶梯；**加权 RRF：`rrfK:60` / `textWeight:2` / `vectorWeight:1`**；关键词腿=实时 rg 无词频打分；chunk 级 `sources[]` 并集 |
| 3 mtree | 已答（未反编译） | `index.cjs:313` **自述 24 枚 napi 导出**；`diffTree({onlyLeaf,onlyIndexing})` 三桶；差集 gzip+b64、快照 zstd；`startSync/refreshLock/endSync` 租约；两边都无 rename 检测 |
| 4 上下文组装 | 已答 | 三层预算 `maxChunkChars/maxCharsPerResult/maxTotalChars` + `maxRerankTokens` + `mergeGapLines`；mtree `renderTree({maxTokens})` 带预算渲染目录骨架 |
| 5 知识侧 | 部分答 | 同一套检索、另一套构建（`wiki/card` 域 + `deltaGate` + `lease` + 顶层 `enabled:false`）；知识索引独立四态健康；**8 枚写工具清单未判定** |
| 6 失败降级 | 已答 | `ProviderSearchError` 附 `indexStatuses`；空结果**硬抛不静默**；**两处乐观位**（聚合 status 一路成功即成功、`symbol_expansion` 恒 success）与策略维悲观不自洽 |

## 卡住 / 降级自陈

- `analyze-javascript-application` **不接受单个 `.mjs`**，只收目录或 `.asar`（已改目录跑通）
- rea 语义层对 `qoder-search.bundle.mjs` **堆耗尽**（rea limitations 末条原文）⇒ 本册引擎内部结论主体为**静态字面量/调用点级**，已在册 §1 显式声明降级
- 未对 `1.0.91` 跑第二轮 rea（时间盒让位给活引擎 1.0.27）⇒ §9 登记未判定
- 未反编译 `mtree.win32-x64-msvc.node` / `rg.exe` / `qoder-context-hook.exe`；未破解 `assets/r1/a.bin`/`b.bin`

## 缺口对撞表

10 条；其中**真缺口 7 条**（#1 代码面加权 RRF 接线、#2 `sources[]` 列、#3 阶段化遥测、#5 `adjacent_chunk_merge`、#6 符号扩召回、#7 第二层装箱配额、#8 带预算树渲染、#9 检索质量自检器 → 计 8 条含部分），**已具备 1 条**（#10 的 Merkle 增量，按派单书预警未报成缺口），**形态不适用→部分缺口 1 条**（#10 租约）。
关键纠正：本仓融合件**已存在**（`reranker.py:113 rrf_fuse` / `:265 rerank_with_fallback`），消费者只有 `rag.py:504/:734` 文档 RAG 一处 ⇒ #1 是"没接线"，不是"要从零造"。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
