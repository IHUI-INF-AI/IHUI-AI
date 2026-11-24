<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# SAG2 从「能力孤岛」接进主链路：文件夹、多格式、三路融合

> 生成：2026-11-09 · 交付前先跑通再写数字。
> 所有读数来自本机真跑：`apps/ai-service` venv（Python 3.12.13）、`apps/web` vitest 4.1.10。
> 复现命令见文末；原始输出留痕 `.ihui-agent/tmp/sag2-folder-e2e/`。

## 为什么还要再做一轮

上一轮把 SAG2 的**算法**抄全了（多跳、IDF、DPP、增量、判定降级、PG 后端、融合），
但对照程序 SAG Wiki 的产品形态有三块没落地，导致能力「建好了却用不上」：

| 缺口 | 对照怎么做 | 上一轮本仓状态 | 后果 |
| --- | --- | --- | --- |
| 入口 | Add a local folder：选文件夹就有知识库 | 只能逐篇 `POST /documents` 传正文 | 没人愿意手工灌库，索引长期为空 |
| 格式 | PDF / Office / EPUB 开箱转换 | 调用方必须自己给纯文本 | 真实文件夹里的 PDF/Word 全被跳过 |
| 消费 | 桌面搜索 / CLI / Skill 共用同一检索核 | 只有独立 `/sag2` 页面 | **对话与 Agent 完全用不到 SAG2** |

第三块是最硬的：`knowledge_lookup` 与 `rag.py` 都不认识 SAG2，等于算法再强也与用户无关。

## 本轮做了什么（四件，均有真跑证据）

### 1. 本地文件夹登记 + 增量扫描

新增 `app/services/sag2_lexical/folder_ingest.py`：

- **预筛 + 终判两级**：先比 `(mtime_ns, size)`，命中且索引 hash 仍是这一份 ⇒ **不读盘**；
  变了才读文件算 `sha256` 终判。对照的 `mtime/size/hash` 语义在这里对齐。
- **单文件落桶具名**：`changed / unchanged / unsupported / failed / too_large` 五桶相加
  恒等于 `scanned`（返回体 `buckets_sum` 自证）；每个失败文件带 `reason`，不静默跳过。
- **假跳过防护**：登记表说没变、但索引已被 `remove_document` 删掉时，`document_hash(path)`
  对不上 ⇒ 强制重建。为此给 `LexicalIndex` / `PgTsVectorStore` 加公共方法 `document_hash`。
- **安全与预算**：忽略目录复用 `codebase_indexer._IGNORED_DIRS`（单源，不另抄一份）；
  单文件 8 MiB、单轮 5000 文件上限，超限具名（`too-large:` / `scan-budget:`）；只接受绝对路径。
- **watcher 可选**：`POST /folders/watch` 启停轮询，**默认关闭**（对照是常驻 Rust watcher；
  本仓是服务端多租户，默认常驻会拖累进程）。登记表默认仅在进程内，设 `SAG2_FOLDER_STATE`
  指 JSON 才落盘，返回体 `persisted` 显式自证。

### 2. 多格式抽取（零新依赖覆盖 7 类）

`extract_text(path) -> (text, parser, reason)`：

| 格式 | 实现 | 依赖 |
| --- | --- | --- |
| `.md .markdown .txt .rst .log .csv .json` | 编码容错直读（utf-8 → gbk → latin-1） | 标准库 |
| `.html .htm` | `HTMLParser` 去 `script/style/svg`，`<title>` 置顶 | 标准库 |
| `.docx` | `zipfile` + `ElementTree` 解析 `w:p` | 标准库 |
| `.xlsx` | 共享字符串 + 首个工作表 → TSV | 标准库 |
| `.epub` | 解 zip，按序抽 xhtml 正文 | 标准库 |
| `.pdf` | `pdfplumber` | 可选；缺失记 `missing-dep:pdfplumber` |

NUL 字节嗅探判二进制（`binary`）；空正文判 `empty`；解析异常判 `parse-error:<类型>`。

### 3. 接进两条消费链路（本轮关键）

**a) RAG 主链路第三路**（`app/services/rag.py::_sag2_retrieve`）：

- 与向量路、关键词路**三路并发**；索引未就绪零成本短路；
- 向量腿失效时，关键词 + SAG2 两路仍做 RRF 融合 —— SAG2 的价值恰在「没有 embedding 也能跨文件多跳」；
- 三种世界各自具名进 `stats["paths"]["sag2"]`：`ok`（含 `hops` / `judge_mode`）、
  `empty`（`index-not-ready`）、`error`（超时或异常，含类型）；
- 新增 `stats["sag2_fused"]` 读数，调用方不用猜这轮有没有 SAG2 参与。

**b) Agent / MCP 统一门面**（`app/services/knowledge_lookup.py`）：

- `DEFAULT_PRIORITY` 增 `sag2`（紧跟 `rag`），`_SUPPORTED_SOURCES` 同步；
- `_query_sag2` 用 `asyncio.wait_for` 2s 墙钟上限，超时记 `errors` 具名降级；
- 空索引**不记错误**（没建库不是故障，否则每轮对话挂一条假警）；
- `KnowledgeHit.citations` 带 `path [byte_start-byte_end]`，`content` 头部含
  文件 / 字节区间 / 行号 / 跳数 / doc_hash 前缀，模型可直接标注出处。

因为 MCP 的 `knowledge_lookup` 工具包装的就是这个门面，**没有新增工具名**，
Agent 侧零配置即获得 SAG2 —— 也避开了「新增工具必须补五语言显示名」的门禁面。

### 4. 前端文件夹面板

`apps/web/app/(main)/sag2/PageClient.tsx` 新增折叠面板（默认折叠，展开才拉列表，
首屏不多发请求）：路径输入 → 登记并扫描 → 扫描摘要 → 已登记列表（changed/scanned 读数、
监听开关、注销）。5 语言文案齐备，`removeFolder` 中文取「注销」以与文档区「移除」区分。

## 真跑证据

### HTTP 层端到端（FastAPI TestClient，真实临时目录）

```
ADD code= 0 registered= True scanned= 2 changed= 2
RESCAN unchanged= 2 changed= 0
RETRIEVE status= ok sources= 2 citations= ['b.txt', 'a.md']
LIST folders= 1 watching= []
UNREGISTER removed= 2
STATUS documents= 0 ready= False
```

对照解释：

- `node_modules/x.md` 被忽略目录剪掉（目录里 3 个文件，`scanned=2`）；
- 第二轮 `unchanged=2 / changed=0` 证明预筛真的挡住读盘；
- `citations` 里答案文档 `b.txt` 排第一（多跳桥接生效）；
- 注销后 `documents=0 / ready=False`，没有孤儿片。

### 测试读数

| 套件 | 结果 |
| --- | --- |
| `tests/test_sag2_folder_ingest.py`（新增） | 16 passed |
| `tests/test_sag2_rag_third_leg.py`（新增） | 3 passed |
| SAG2 + 知识门面回归（7 文件） | 110 passed |
| 接线相关回归（9 文件，含 agent_tools / mcp_server_coverage / rag 三件套） | 178 passed |
| `PageClient.test.tsx` | 18 passed（原 15 + 新增 3 条文件夹用例） |
| `src/api/sag2-lexical.test.ts` | 36 passed |
| `mypy --strict`（folder_ingest / knowledge_lookup / sag2_lexical API / rag） | 0 issues |
| `ruff check`（同上） | All checks passed |
| `eslint`（3 个前端文件） | 0 问题 |
| `tsc --noEmit -p apps/web` | 0 错误（1m57s） |

新增测试里最关键的一条是**「第二轮一次 extract 都不发生」**：
`test_second_scan_reads_no_file` 把 `extract_text` 换成计数器，断言 `calls == []`。
这钉的是「预筛真的省了 IO」，不是「读了再比 hash」——后者看起来一样，代价差一个数量级。

## 现在可以对外说的（新增 3 句）

1. **「选一个本地文件夹就能用：文档留在原处，只建词法索引；再扫描只读改过的文件，没改的一个字节都不读。」**
   证据：`RESCAN unchanged=2 changed=0`；`test_second_scan_reads_no_file` 断言读盘 0 次。
2. **「Markdown / 文本 / HTML / CSV / JSON / Word / Excel / EPUB 都能直接进索引，全程不调模型、不需要 GPU。」**
   证据：`extract_text` 七类标准库实现；e2e 里 `.md` 与 `.txt` 真建库；`test_docx_extracts_paragraphs` 真解 docx。
3. **「它不是一个孤立的搜索页：对话里的 RAG 召回多了第三路，Agent 的统一知识查询也能查到它，引用带文件、字节区间与行号。」**
   证据：`_retrieve` 三路并发与 `stats["paths"]["sag2"]`；`knowledge_lookup` 默认优先级含 `sag2`；
   `test_sag2_rag_third_leg.py` 3 passed；`test_lookup_sag2_source_returns_cited_hits` 断言引用非空。

## 仍然不能说的（边界，不是缺陷）

1. **「支持所有格式」** —— PDF 需要 `pdfplumber`（当前环境未安装，会记 `missing-dep:pdfplumber`）；
   图片 OCR、音视频转写**没有实现**（对照是可选组件，本仓未做）。
2. **「实时监听文件变化」** —— watcher 是**轮询且默认关闭**，不是内核级 inotify。
3. **「搜索全局可用」** —— 目前入口是 `/sag2` 工作台；全局快捷搜索（任意页面唤起）未做。
4. **「大规模已验证」** —— 上限仍是实测 20k 文档（内存倒排建库 850s）；本轮只加了文件夹与接线，
   没有重跑 51 万规模。默认后端仍是内存，重启即空；PG 后端需显式配置。
5. **「跨语言检索」** —— 对照 0.2.6 有此能力，本仓只有 CJK 单字 + bigram + 英文词元，
   没有中英同义桥接，仍会漏「中文问、英文文档答」。

## 2026-11-09 后续三轮对账：上面 5 条边界，3 条已消除、1 条收窄、1 条仍在

> 上面「仍然不能说的」是**当日读数**，原样保留（历史有价值）。本节只声明**现在**的状态，
> 每条给出可重跑的判据，不覆盖原文。证据：`sag2-round3-20261109.md`、`sag2-round4-20261109.md`、
> `sag2-round5-20261109.md`。

| # | 当日边界 | 现在 | 判据 |
| --- | --- | --- | --- |
| 1 | PDF 需 pdfplumber；图片 OCR、音视频转写没实现 | **已实现** | PDF 四级链（自研 `pdf_text` → `pdfium` → `pdfplumber` → 栅格化+OCR，逐级留痕）；图片 OCR 走 rapidocr/tesseract 可插拔；音视频走 faster-whisper。`pypdfium2` 已进主依赖，扫描件不再需要额外装东西 |
| 2 | watcher 是轮询且默认关闭 | **真事件监听，默认开** | `fs_watch.py` 用 ctypes 直调 `ReadDirectoryChangesW` / `inotify`，抖动合并、溢出按整树重扫；`watch_real` 默认 `True`；`/folders` 的 `watch_modes` 如实报 `win32-rdc` / `linux-inotify` / `polling` |
| 3 | 无全局快捷搜索 | **仍在** | 入口仍是 `/sag2` 工作台；这是本文唯一未消除的边界 |
| 4 | 上限 20k、建库 850s | **200k / 30.6–33.4s** | `scripts/sag2_scale_probe.py --docs 200000`；同口径三档见 round5 §2 |
| 5 | 没有中英同义桥接 | **有限桥接** | `bridge.py` 三源：内置词典/外部 JSON、正文括号对照、词典别名；打分降权（0.9/0.8/0.6）。**纯跨语言（两文无任何对照）仍不桥**，如实返回无桥 |

### 本轮（第五轮）补的两件事

- **OCR 真识别实测**：合成退化样本上 CER 0–9%（干净/倾斜/噪声/JPEG 档 0，72dpi 0.009，失焦 6–9%），
  关键实体 6–7/7；两页无文本层 PDF 的 CER 为 0.0045；端到端扫描件入库后两条自然语言查询都以扫描件为 top1。
  代价：单页 2.4–4.7s、两页 PDF 7.6s 本地 CPU，只适合后台扫描，不进同步请求路径。
- **新登记的真实边界**：双栏版面 OCR 会串栏（右栏首句被提前、右栏两句被拆），是引擎阅读顺序，
  本轮不修（按 x 聚类切栏的阈值风险大于收益）。

## 复现方式

```bash
# 1) HTTP 层端到端（本机 venv，真临时目录，跑完自动清理）
cd /g/IHUI-AI/apps/ai-service
./.venv/Scripts/python.exe ../../.ihui-agent/tmp/sag2-folder-e2e/e2e.py

# 2) 后端测试
./.venv/Scripts/python.exe -m pytest \
  tests/test_sag2_folder_ingest.py tests/test_sag2_rag_third_leg.py \
  tests/test_rag.py tests/test_rag_rrf_fusion.py tests/test_knowledge_lookup.py \
  -p no:randomly -q

# 3) 前端测试与类型
cd /g/IHUI-AI/apps/web
npx vitest run "app/(main)/sag2/PageClient.test.tsx" --reporter=dot
npx tsc --noEmit -p tsconfig.json
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
