<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T12 · mtree 原生件 + qoder-context-hook 宿主 + 跨 8 版钩子契约差分（goal-b46 取证席）

## 0. 头注（开工现读）

- 仓库 HEAD（开工时）：`05e018e5836f564b74c9c9afcbbd0461e1c742cf`
- 取证时刻：2026-11-01 03:22 – 03:58（本机墙钟，`date` 现读；起点为首次枚举靶件）
- 逆向工具：Ghidra `12.1.4` @ `D:/DevEnv/ghidra_12.1.4`，`JAVA_HOME=C:\Program Files\Java\jdk-21-temp\jdk-21.0.2+13`，`support/analyzeHeadless.bat` + Java postScript（PyGhidra 不可用，已按上一席实测绕开）
- 本席自写脚本（全部落在**项目外** `D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/`，不入仓）：
  `B46Survey.java`（导出/导入/段表/函数/定义字符串/关键字→引用函数/定量反编译）、`B46Decomp.java`（定点反编译剪枝与 diff 属主）、`PeParse.mjs`（PE 头/导出表/导入表/ASCII+UTF-16 串收割）、`HashTables.mjs`（哈希算法**连续表**签名）、`RipXref.mjs`+`CallerChain.mjs`（RIP 相对引用与调用链）、`ContractDiff.mjs`/`NameDiff.mjs`/`TokenMatrix.mjs`/`HookDiff.mjs`
- 靶（绝对路径 + 体积 + 盘上 sha256，本席复核；与派单书体积有出入处以本表为准）：

  | 靶 | 绝对路径 | 字节 | sha256 |
  | --- | --- | --- | --- |
  | mtree@1.0.91 | `C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/1.0.91.b22f2d0a/runtime/native/mtree/mtree.win32-x64-msvc.node` | 1,868,808 | `e8d7955740092bc59b231d1c10605c8e2689f9b279f1c308b6c9c6dd11d95c2d` |
  | mtree@1.0.51 | `…/qoder-context/1.0.51.fa026ec3/runtime/native/mtree/mtree.win32-x64-msvc.node` | 1,815,552 | `149b9d45070bf754eb081f32e3816096d7469918c38f27b7425c5c7c1ace19f4` |
  | hook.exe@1.0.91 | `…/qoder-context/1.0.91.b22f2d0a/bin/qoder-context-hook.exe` | 641,544 | `79d6d476d1d087313cecdd0684c94d09b3b30feb608cd16442f59791e8590104` |
  | hook.exe@1.0.84 | `…/qoder-context/1.0.84.f756706/bin/qoder-context-hook.exe` | 641,024 | `7cc11f7b5cfa279864349316af397af49ba84135f852de109970a8d1ae03fb22` |
  | hook.exe@1.0.74 | `…/qoder-context/1.0.74.7a73af9/bin/qoder-context-hook.exe` | 611,840 | `a0b097cb37b2698d39d07b57ef966da09cd3bad4919ef1b41bd2e97ee3ab7896` |

- 体积序列现读更正（派单书只登记到 1.0.74/78 那一档）：mtree 八版 = 1,815,552 / 1,794,048 / 1,794,048 / 1,815,552 / 1,858,048 / 1,858,048 / **1,868,808** / **1,868,808**；hook.exe 仅 1.0.74 起存在（1.0.51/61/61/72 四版 `bin/` 里**没有**该件，只有 `rg.exe` + `qoder-context.cmd`）。
- 红线执行情况：**未执行任何靶件**（不 launch / 不注入 / 不联网）；未破解授权；未提取凭据；`C:/Users/Administrator/.qoder-cn/` 下只读程序包与声明文件，配置/台账类只取字段名不取值（本次实际只读了 `hooks/hooks.json`、`runtime/runtime-manifest.json`、`.qoder-plugin/plugin.json`、`runtime/native/mtree/index.cjs` 与三个 JS 入口的字面量，未打开 `installed_plugins*.json` / `marketplaces/**` / `logs/*.log`，因此**无跳过项**）；反编译产物与脚本一律留在 `D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/`。
- `rg.exe`（5,429,760 → 1.0.84 起 5,440,512）是 vendored 上游 ripgrep，**未逆向**，一句带过。

三态标注约定：**[观察]** = 本次由文件字节或 Ghidra 输出直接量到；**[推断]** = 由观察到的形态推得、未逐一取证；**[未知]/未找到** = 射程内没有证据。**"未检索到某字面量"绝不写成"对方没有该能力"。**

---

## 1. C · 跨 8 版钩子契约差分（纯文本，最便宜的一格）

### C1 `hooks.json` 逐版形态表（[观察]，`ContractDiff.mjs` 一次读出，可复跑）

| 版本目录 | 字节 | sha256 前 12 | 事件 | 条目 | 命令承载体 | async | env 键 | 新增语义 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0.51.fa026ec3 | 1135 | `62dbd869c49f` | SessionStart, UserPromptSubmit | 2 | `cmd.exe /d /c ${QODER_PLUGIN_ROOT}/bin/qoder-context.cmd <sub>` | 全 false | `QODER_PRODUCT_ID` | — |
| 1.0.61.7f8d7bb7 | 1135 | `62dbd869c49f`（与 1.0.51 **同哈希**） | 同上 | 2 | 同上 | 全 false | 同上 | 无 |
| 1.0.61.d5594762 | 1135 | `62dbd869c49f`（同哈希） | 同上 | 2 | 同上 | 全 false | 同上 | 无 |
| 1.0.72.34cf9e2f | 1135 | `62dbd869c49f`（同哈希） | 同上 | 2 | 同上 | 全 false | 同上 | 无 |
| **1.0.74.7a73af9** | **1119** | `8aa3d72d6763` | 同上 | 2 | **`${QODER_PLUGIN_ROOT}/bin/qoder-context-hook.exe <sub>`** | 全 false | `QODER_PRODUCT_ID` + **`QODER_SEARCH_PRODUCT_FORM`** | **转折点①** |
| 1.0.78.26e781a | 1118 | `90b3f354e1bf` | 同上 | 2 | 同 1.0.74 | **UserPromptSubmit → async true** | 同上 | 仅异步化一枚 |
| **1.0.84.f756706** | **1605** | `268bdc8b8cbc` | 同上 | **3** | 同 1.0.74 | true+false 混 | 同上 | UserPromptSubmit 挂两条（async 的 `user-prompt-submit` + 同步的 `qoder-context-prompt`）；`bin/` 里 **`qoder-context.cmd` 消失** |
| **1.0.91.b22f2d0a** | **4388** | `bb2502651a15` | **SessionStart, SubagentStart, UserPromptSubmit, PostToolUse, Stop** | **8** | 同 1.0.74 | 8 条里 5 条 async | 同上 | **转折点②**：事件 2→5、条目 2→8、首次出现 `matcher` |

- 1135→1119 那 16 字节的**全部**内容（[观察]）：`command` 由 `"cmd.exe"` + 4 个 args 变为 `"${QODER_PLUGIN_ROOT}/bin/qoder-context-hook.exe"` + 1 个 arg，并新增 env 键 `QODER_SEARCH_PRODUCT_FORM: "qoder"`。事件名、`timeout: 2`、`name` 字段一族未变。**不是**删事件、**不是**改超时。
- `timeout` 八版**恒为 2**（[观察]），1.0.91 扩到 8 条也没动它。
- 1.0.91 首次出现的 `matcher`（逐字，[观察]）：`^(?!resume$).*`（SessionStart，排除 `resume` 源）、`^(general-purpose|Explore|Plan)$`（SubagentStart 三个子代理名白名单）、`Edit|Write`（PostToolUse）、`^(mcp_call|(mcp__[^\\s]+__)?(write_wiki|edit_wiki|delete_wiki|write_knowledge|edit_knowledge|delete_knowledge|link_knowledge|unlink_knowledge))$`（知识卡编辑记账）。
- 1.0.91 的 `description` 也从 "project knowledge overview hooks" 改为 "**project knowledge and capability-gated workspace hooks**"（[观察]）——"capability-gated" 与 §3 的 `CAPABILITY_DISABLED`/`products` 表对得上。
- 逐条 subcommand：`session-start` / `qoder-context-prompt` / `user-prompt-submit` / `post-tool-use` / `knowledge-edit-record` / `stop` / `knowledge-edit-upload`（[观察]，1.0.91）。

### C2 契约转折点与配套件出现顺序（[观察]）

- 转折①=**1.0.74**：钩子宿主从 `cmd.exe + qoder-context.cmd` 换成**原生 exe 直调**，且 `bin/qoder-context-hook.exe`（611,840）**首次出现在这一版**；同版 mtree 从 1,815,552 → 1,858,048。
- 过渡=**1.0.84**：`.cmd`  shim 从 `bin/` 撤除；exe → 641,024；`rg.exe` → 5,440,512；契约首次出现"同一事件两条钩子"。
- 转折②=**1.0.91**：事件面 2→5、条目 2→8、引入 `matcher` 与 `Stop`/`PostToolUse` 两族写入型钩子；exe → 641,544。
- `runtime-manifest.json` 八版差异只有 `version` 字段与 797/796/797 的字节抖动（[观察]）；**其余键完全同构**：`schemaVersion:1`、`productId:"qoder-cn"`、`target{win32,x64}`、`javascriptRuntime{source:"qoder-electron", command:"C:\\Program Files\\Qoder CN\\Qoder CN.exe", electronRunAsNode:true, bundled:false}`、**`mtreeNapiVersion:10`**、`build{minified:true,sourceMap:false}`、`files{entry, scanWorker, legacyMigrationWorker, mtreeLoader:"native/mtree/index.cjs", mtreeBinary:"native/mtree/mtree.win32-x64-msvc.node", ripgrep:"../bin/rg.exe", assetModule:"assets/r1/a.bin", assetBinary:"assets/r1/b.bin"}`。⇒ **`a.bin`/`b.bin` 的路径与角色已由声明文件钉死（[观察]），其内部结构本次仍未读（[未知]，T6 那一格只补了一半）**。
- `plugin.json`（159/158 字节）八版只有 `version` 变，`displayName:"Qoder Context"`、`description:"Wiki, retrieval engine, and more for Qoder"` 未变（[观察]）。

### C3 与在册事实的接续

`T7` 把"多版本目录并存"当装机实锤、`archives/<插件>/<sha256>.zip` 文件名==zip 自身 sha256 是第二处；本次是**第三处**（8 个版本目录 + 4 个 `hooks.json` 哈希里 4 版逐字节同哈希，直接证明"版本目录是各自独立的不可变解包副本"），并新增**"版本内演化序列"**这一维：同一插件族在 40 天内把钩子契约从 2 事件 2 条目推到 5 事件 8 条目，且中途换掉承载体（`.cmd`→原生 exe→撤 `.cmd`）。

---

## 2. A · mtree.win32-x64-msvc.node（增量索引引擎）

Ghidra 侧读数（`mt91_summary` 同源的 `mt91_functions/exports/imports/strings_defined/keywordhits`）：函数 **3,990**、外部入口 4（含 `napi_register_module_v1`）、导入 **85**、定义字符串 **1,333**、关键字命中 315 行、定量反编译 310,483 B。PE 侧读数（`PeParse.mjs`）：**导出表恰 1 枚** = `napi_register_module_v1`，内部 DLL 名 `qoder_mtree.dll`，PDB 名 `qoder_mtree.pdb`，`subsystem=2`，段表 `.text 1,470,976 / .rdata 329,216 / .data 2,560 / .pdata 49,664`。

### A1 实际导出的 napi 函数数量与名字 → **推翻"24 枚"：实测 23 枚**

- [观察] 二进制内 `Failed to register function \`X\`` 一族字符串**恰好 20 枚**（1.0.51 与 1.0.91 **同一集合，零增删**，`NameDiff.mjs` 的 `comm` 两向空集）：
  `build_tree, build_tree_with_ignore, build_weighted_tree, check_is_binary_file, check_is_large_file, collect_leaf_paths, collect_stats, compare_snapshot_with_directory, compute_simhash, compute_simhash_batch, create_snapshot, decode_zstd, encode_zstd, hamming_distance, is_node_changed, is_zstd_compressed, read_snapshot_from_file, render_tree, write_snapshot_to_file, diff_tree`
- [观察] 另有 3 枚 **napi 类**：`MtreeProjectIgnore`、`MtreeWatcher`、`MerkleTreeHandle`（+ 类方法名串 21 枚：`fromJson,toJson,buildWithIgnore,loadFromFile,saveToFile,addMultiple,deleteMultiple,updateMultiple,cloneTree,diffWith,findNode,render,renderDirectory,collectLeafPaths,collectStats,isBaseIgnored,isIgnored,isIndexIgnored,reload,start,stop`）。
- [观察] JS 装载层同口径：`runtime/native/mtree/index.cjs:313` 解构 **23** 个标识符、`:315–:337` 共 **23** 行 `module.exports.X = X`，两两一致（20 函数 + 3 类）。
- **结论：派单书/T9 记的"24 枚"多算了一枚；23 才对。** 复验：
  `node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/NameDiff.mjs`（数 `Failed to register function` 集合）＋
  `node -e "…index.cjs:313 切片计数…"`（`ContractDiff.mjs` 同源）。
- [观察] Ghidra 反编译把注册动作坐实在 napi env 函数指针表上：`napi_register_module_v1` @ `0x18008b200`；单条注册形如 `(**(code**)(PTR_PTR_1801ba740 + 0x80))(env,"checkIsLargeFile",0x10,FUN_180062ee0,0,&result)` —— 即 **napi-rs 2.16.17 手写绑定，名字与回调地址成对出现在 .rdata/.text**，不是只能靠 JS 自述。
- [观察] 依赖面（`.cargo/registry` 路径串）：`napi-2.16.17`、`napi-sys-2.4.0`、`serde_json-1.0.151`、`serde_core-1.0.229`、`indexmap-2.14.0`、`once_cell-1.21.4`、`itoa-1.0.18`、`hashbrown-0.17.1`、`zstd-0.13.3`/`zstd-safe-7.2.4`、`notify-8.2.0`/`notify-debouncer-full-0.7.0`/`notify-types-2.1.0`；rustc 提交 `6b00bc3880198600130e1cf62b8f8a93494488cc`。
- [观察] 自建模块清单（panic/serde 定位串）：`src\core\{diff,error,filetype,fsmeta,gopath,node,operations,render,simhash,snapshot,watcher,weighted_tree}.rs`、`src\core\ignore\{mod,matcher,gitignore,file_check}.rs`、`src\rpc.rs` 类同族（exe 侧）。

### A2 节点哈希与 diff 三桶落层

- [观察] 结构体字段串逐字：`MerkleNode{relativePath, hash, rhash, indexing, type, fileType, mtime, children}`；快照 `snapshot{schemaVersion, root, generatedAt, rootHash, rootRhash, stats, tree}`；渲染选项 `{maxTokens, maxFilesPerDir, showHashes, indentChars, showThirdPartyDetail, budgetStrategy, scopePaths}`；权重 `{fileTypeWeights, dirNameWeights, timeDecayFactor, sizeImpactFactor, depthDecayFactor, dirBoostFactor, ignoreDirs, brokenLimit, hardLimit, sortLimit}`；`NodeInput{relativePath, hash, rhash}`；统计 `{dirNum, fileNum, indexingFileNum, totalNodes, maxDepth}`。⇒ **每节点两条哈希（`hash` 自身 + `rhash` 由 children 聚合），根同理 `rootHash`/`rootRhash`**；`type`+`indexing` 双维（印证 T9 的 `nodeType`+`indexing`）。
- [观察] 三桶与差异字段在同一 `.rdata` 连续串里：`nodeType identical changes added modified removed deserialize baseline failed:`；`diffTree` 的 napi 回调实体 = `FUN_180068d30`（`napi_create_function("diffTree",8,FUN_180068d30,…)`），`DiffOptions` 只有 `onlyLeaf`/`onlyIndexing` 两维。⇒ **`diffTree` 的 added/modified/removed 判定在原生层，JS 只消费**（把 T9 的"自述"升成实证）。
- 算法：**[观察]** 逐字连续表签名只有 **SHA-256**：K 表前 16 字连续命中 @ 文件偏移 `1593824`（VA `0x180186be0`，`.rdata`），H0..H7 初始化向量连续命中 @ `1482768`（VA `0x18016ba10`）；两处**各有 1 条** RIP 相对引用（`0x1800c03d2`、`0x180034ab9`，`RipXref.mjs` 经"已知字符串引用"正/反对照校准）。同一次扫描里 **MD5 / SHA-1 / SHA-512·BLAKE2b / CRC32 / CRC32C / FNV-1a / xxHash32 / xxHash64 的常量序列均未命中**；依赖清单里也没有 `sha2`/`md5`/`blake*`/`twox-hash`/`xxhash-rust`/`siphasher`/`ahash` 任何一枚 crate 路径。
  **[推断]** 节点/快照哈希走 SHA-256（Rust 侧自带实现或 `generic-array` 同族件）。
  **[未知]** 具体拼接形态（是否含 `relativePath`/`mtime`/size、目录聚合顺序、`rhash` 的叶子基例）——那要求继续跟 `0x180034a60`/`0x1800c0300` 两个调用簇，本席时间盒内未做完（命令见 §6）。
- **[观察] simhash 是一等能力**：`src\core\simhash.rs` + `compute_simhash`/`compute_simhash_batch`/`hamming_distance` 三枚导出 + 错误串 `invalid simhash hex length: expected 64, got ` ⇒ 指纹为 **64 个 hex 字符 = 256 bit**；`computeSimhash` 的回调 `FUN_1800711f0`。

### A3 剪枝（binary / large / ignore）到底在哪一层

- **[观察] 在原生层**，四条独立证据：① `check_is_binary_file`/`check_is_large_file` 是**模块级 napi 导出**（回调 `FUN_180062b70` / `FUN_180062ee0`，各 235 字节，同尺寸、同注册模板）；② 原生 ignore 模块族 `src\core\ignore\{mod,matcher,gitignore,file_check}.rs` 在册；③ `build_tree_with_ignore` 与类 `MtreeProjectIgnore{isBaseIgnored,isIgnored,isIndexIgnored,reload}` 在册；④ 忽略文件名与内置排除集逐字出现在 `.rdata`：`.gitignore` `.qoderignore` `.aiignore` `.git` `.svn` `.hg` `.bzr` `.Trash` `.__MACOSX` `AppleDouble`（同串还带扩展名表 `.css .html .js .json .jsx .ts .tsx .vue`，属 `filetype.rs` 的权重输入）。
- **[观察] 大目录容量护栏**也在原生层：`tree size exceeds broken limit: `（配 `brokenLimit`/`hardLimit`/`sortLimit`），以及 `OS file watch limit reached.`。
- **"large" 的阈值数值 = [未知]**。已量到的：`check_is_large_file` 存在且导入了 `GetFileInformationByHandle`/`GetFileInformationByHandleEx`（拿 size/mtime/文件索引用）；在**本次已反编译的 310 KB 函数集里未出现**任何可当阈值的立即数（`0x100000/0x200000/0x400000/0xf4240/0x186a0/0x4c4b40` 等 13 个候选形全部 0 命中）。⇒ 只可写"阈值常量未在射程内找到"，**不可**写"阈值由 JS 传入"（那是 [推断] 且本席未证）。定点复跑命令见 §6。

### A4 改名检测：T9 的"两边都缺"必须**部分推翻**

- **[观察] watcher 有 rename 事件型**：`MtreeWatcher` 的字段串为 `path` + `eventType`，紧随其后的枚举串是连续的 `create modify remove rename`（同一条 `.rdata` 串，偏移 `1501110`），再后面才是 `start watcher failed:`；依赖 `notify-8.2.0` + `notify-debouncer-full-0.7.0`，选项串 `WatcherOptions{debounceTimeout}`、`[mtree-watcher] debouncer errors:`，以及 notify 的配置键 `poll_interval` / `compare_contents` / `follow_symlinks`。
- **[观察] 相似性底座也在原生层**：`compute_simhash`/`compute_simhash_batch`/`hamming_distance` + 256-bit 指纹校验串（§A2）。
- **[观察] 但 `diff_tree` 的结果桶仍然只有 added/modified/removed**，未在同族串里检索到 `renamed`/`similarity`/`score` 之类的第四桶。
- **[观察] 且这 4 枚（`computeSimhash`、`computeSimhashBatch`、`hammingDistance`、`buildWeightedTree`）连同 6 枚其它导出，在插件自带的三个 JS 入口（`qoder-search.bundle.mjs`、`syncWorkspaceScanWorker.js`、`knowledge-legacy-migration-worker.js`）里逐字 0 命中**（完整未接线清单：`writeSnapshotToFile, readSnapshotFromFile, checkIsBinaryFile, checkIsLargeFile, isNodeChanged, compareSnapshotWithDirectory, computeSimhash, computeSimhashBatch, hammingDistance, buildWeightedTree` = 23 枚里 10 枚无自带消费方；`MtreeWatcher`/`diffTree`/`renderTree`/`collectLeafPaths` 等 13 枚有）。
- 因此正确表述是：**"改名"在对方原生层有两通道（watcher 的 rename 事件 + simhash/hamming 指纹），在 `diffTree` 桶这一维确实没有，在本包自带 JS 的接线面也没找到调用点；宿主 IDE 主进程是否用掉这 10 枚 = [未知]（不在本次射程）。** T9 从 JS bundle 得到的"两边都缺 rename 检测"只覆盖了 diffTree 那一维。

### A5 1.0.51 → 1.0.91（+53,256 B，派单书说的 42 KB 那一档在 1.0.74）

- **[观察] 导出面零变化**：20 枚函数名集合两版完全相同；3 枚类名相同；21 枚方法名相同；49 个字段/选项 token 两版全在。
- **[观察] 变的是段尺寸与内部模块**：`.text 1,448,448→1,470,976`（+22,528）、`.rdata 311,808→329,216`（+17,408）、`.pdata 48,128→49,664`、`.reloc 3,584→4,608`；`exports` 表两版都是 1 枚、`imports` 两版都是 9 个 DLL / 66 个 kernel32 函数（**逐字同集**，`PeParse.mjs` 可复跑）。
- **[观察] 字符串面新增**：`src\core\{diff,node,snapshot,watcher,weighted_tree,fsmeta,filetype}.rs` 与 `src\core\ignore\file_check.rs`、`.qoderignore/.aiignore` 排除族、`buildTree`/`renderTree`/`buildWeightedTree` 等 camelCase 注册别名在 1.0.51 的 ASCII 串表里**未检索到**（1.0.51 侧串表 5,651 条 vs 1.0.91 的 5,761 条）。
- **[推断]** 增长来自"把同类能力拆成更多模块 + 更多 serde/panic 定位串 + 权重树"，不是新 API。
- **[未知]/防过头**：串缺失不等于模块不存在（Rust 只在有 panic 路径时留 `file:line`），所以**不得**写"1.0.51 没有 diff/node 模块"。

---

## 3. B · qoder-context-hook.exe（钩子宿主）

Ghidra：函数 **1,759**、外部入口 2（`entry`、`tls_callback_0`）、导入 107、定义字符串 640、关键字命中 74、反编译 5 函数。PE：`subsystem=3`（**GUI 件，不 AllocConsole**）、无导出表、Rust 件（`qoder_context_hook.pdb`），crate 只露出 `tokio-1.53.1 / mio-1.2.3 / serde_json-1.0.151 / itoa-1.0.18 / chrono-0.4.45 / uuid-1.26.1 / generic-array-0.14.7`。

### B1 它承担什么（[观察]，逐格给出处）

| 承担 | 证据（字面量/模块） |
| --- | --- |
| 入参 JSON 解析与形状校验 | `hook_event_name`、`cwd/new_cwd/old_cwd`、`sessionId/session_id/source`、`sessionStartSource`、`transcript_path`、`tool_name/tool_input/tool_response/toolName/tool_use_id/isError/is_error/structuredContent`、`prompt/image_urls/file_path/filePath/originalFile/content`、`request_set_id/parent_request_set_id`；模块 `src\main.rs`、`src\context.rs`、`src\rpc.rs`、`src\knowledge_edit.rs` |
| 出参成形（additionalContext 通道） | `additionalContext`、`hookSpecificOutput`、`hookEventName`、`knowledgeOverview`、`permissionDecision`、`permissionDecisionReason`；护栏码 `HOOK_RESPONSE_INVALID`/`HOOK_INPUT_TOO_LARGE`/`HOOK_INPUT_INVALID`/`HOOK_COMMAND_INVALID`/`HOOK_PROTOCOL_MISMATCH` |
| 宿主/产品身份门 | env `QODER_PRODUCT_ID`、`QODER_SEARCH_PRODUCT_FORM`、`QODER_SEARCH_HOST_PID`、`QODER_SEARCH_RUNTIME_CHANNEL`、`QODER_PLUGIN_DATA`、`QODER_SEARCH_DEV`；码 `INVALID_PRODUCT_ID`/`INVALID_HOST_PID`/`INVALID_PRODUCT_FORM`/`HOME_UNAVAILABLE`/`WORKSPACE_UNAVAILABLE`/`WORKSPACE_ILLEGAL`；宿主登记表 `run/hosts`、身份字段 `bridgePid/version/hostPid/productForm/ownerId/principalType/principalId` |
| 与守护进程建连 | `run/shared`、`endpoint.json`、`schemaVersion/protocolVersions/scopeId/principalScopeId/nonce/instanceId/endpoint`、`RPC_PROTOCOL_MISMATCH`/`RPC_REMOTE_ERROR`/`RPC_RESPONSE_INVALID`/`RPC_RESPONSE_TOO_LARGE`/`DAEMON_IDENTITY_UNAVAILABLE`、`failed_open`+`daemonDurationMs`、离线队列 `.pending.jsonl`（`id/createdAt/method/params/timeoutMilliseconds`） |
| 能力门（capability-gate） | `CAPABILITY_DISABLED` + 内嵌产品能力表：`products.qoder{configDirectory:".qoder", searchWorkspace:true, turnRelay:true, remoteCodeIndexing:true, indexSettings:true, workspaceIndexOrganizationPolicy:false}` 与 `products.qoder-cn{… , workspaceIndexOrganizationPolicy:true}` |
| 出站方法名 | `searchWorkspace`/`searchPrompt`/`mtree.sync`/`indexing.ensure`/`remoteCodeIndexing`/`turnRelay`（+ 提示文案 `SearchWorkspace is a read-only workspace search tool provided by qoder-context.`） |
| 知识卡编辑记账 | `knowledge-edit-record`/`knowledge-edit-upload`、`KNOWLEDGE_EDIT_TOOL_INVALID`/`KNOWLEDGE_EDIT_RESULT_INVALID`/`KNOWLEDGE_EDIT_FAILED`、`wiki/knowledge × write/edit/delete/link/unlink` + `mcp__<name>__` 前缀形 |
| 提示词模板就地持有 | `"overviewHeading": "# Project knowledge overview"`、`"overviewHeader": "# Project knowledge overview\nThis is the knowledge distilled…"`、`"searchPrompt": "# Workspace search routing\nUse \`SearchWorkspace\`…"`（[观察] 与本席会话里那份 system-reminder 逐字同源，说明那段注入文案来自该 exe，不是 JS bundle） |
| 日志与原子写 | `logs`、`qoder-context-hook.log`、`.log.1`、`.workspace.json`、`.tmp` + `MoveFileExW` |
| **不承担** matcher 正则求值 | **[观察] 未检索到 regex 系 crate 或 `matcher` 字面量**（crate 清单只有上面 7 枚；`pattern.rs` 命中的是 `library\core\src\str\pattern.rs`，属 std）⇒ **[推断]** matcher 求值在宿主侧，本件只按 argv 被叫起 |
| **不承担** spawn 子进程 | **[观察] 导入表无 `CreateProcess*`**（有 `OpenProcess`/`GetExitCodeProcess`/`CreateToolhelp32Snapshot`/`Process32FirstW/NextW`）⇒ **[推断]** 它只**核验**已存在的宿主进程，不起新进程；rg.exe 的 spawn 归 JS/宿主 |

- 超时：**[观察]** `hooks.json` 每条 `timeout: 2` 由宿主解释；本件字面量里只有 `timeoutMilliseconds`（`.pending.jsonl` 的 RPC 请求字段），未检索到进程级看门狗/强杀串 ⇒ 是否在本件强制超时 = **[未知]**。
- stdout 采集：**[观察]** `GetStdHandle`+`WriteConsoleW`/`WriteFile` 与 `ReadConsoleW`/`ReadFile` 成对，且带 Rust 侧的两条 Windows stdio 约束串（`Windows stdio in console mode does not support writing non-UTF-8 byte sequences`、`Windows stdin in console mode does not support non-UTF-16 input; encountered unpaired surrogate`）⇒ 采集/回写走 stdio，且**对控制台模式做了显式分支**（配合 `GetConsoleMode`）。

### B2 权限/审批面

- **[观察] 有 `permissionDecision` + `permissionDecisionReason` 两个出参键，并检索到取值字面量 `allow`**，紧邻文案是给 `SearchWorkspace` 免确认的理由。
- **[观察] 在本件字节里未检索到 `deny` / `ask` / `always` / `approve` / `reject` 这些取值形**（`node -e` 对原文件做 latin1 全量 `indexOf`，`allow` 3 处命中、`deny` 0 处、`ask` 仅落在 "do not ask a subagent…" 的提示文案里）。
- ⇒ 结论口径：**"该宿主件自带权限应答通道，但本席只观察到 `allow` 一档；其余档位未找到"**。**不得**写成"Qoder 不支持 deny/ask"——对照 Trae 内核那句逐字实锤（`requires confirmation, but direct mode has no confirmation channel`）说的是"根本没有确认通道"，形态不同轴，不能互证。

### B3 与宿主怎么通信

- **[观察] argv 分发**：`hooks.json` 把子命令作为唯一 arg 传入（`session-start` 等）。三版字面量对照（`TokenMatrix.mjs`，原始字节 `includes`，非行集差）：`session-start`/`post-tool-use`/`cwd-changed` 三枚**只在 1.0.74 命中，1.0.84 与 1.0.91 未命中**；`user-prompt-submit`/`stop`/`knowledge-edit-record` 依序出现（`knowledge-edit-record` 自 1.0.84 起）。
- **[观察] 守护进程侧走 JSON-RPC + 命名管道**：`jsonrpc` + `CreateIoCompletionPort`/`GetQueuedCompletionStatusEx`/`NtDeviceIoControlFile`/`CancelIoEx` + tokio/mio 的管道件（`NamedPipe was not previously connecting`），端点从 `<QODER_PLUGIN_DATA>/…/run/shared/endpoint.json` 读，带 `protocolVersions`/`nonce`/`principalScopeId` 握手与 `RPC_PROTOCOL_MISMATCH` 拒识；离线期写 `.pending.jsonl`。
- **[观察] 退出码约定**：件里有 `GetExitCodeProcess`（读**别人**的子进程状态）与 `HOOK_COMMAND_INVALID` 一类错误身份，**未检索到**自述的退出码表 ⇒ 本件退出码语义 = **[未知]**。
- **[推断]** 综合形态 = "薄壳 argv 客户端 + 本机 JSON-RPC 守护进程"：钩子事件进 stdio，能力/身份门就地判，重活转给常驻守护（守护由 `QODER_SEARCH_*` env + `run/hosts` 定位）。**[未知]**：守护侧实现（那是 JS/Electron 侧的 `qoder-search.bundle.mjs`，非本件）。

---

## 4. 对在册结论的点名更正（算交付，不算法差）

1. **推翻 `T9`（qoder-search-engine 册）"24 枚 napi 导出"**：实测 **23** 枚（20 函数 + 3 类），且 `index.cjs:313/:315–337` 两侧同为 23；1.0.51 与 1.0.91 该集合**一字未变**。
2. **部分推翻 `T9`"改名检测两边都缺"**：原生 watcher 有 `rename` 事件型，`compute_simhash/compute_simhash_batch/hamming_distance`（256-bit 指纹）是原生一等导出；`diffTree` 结果桶确实仍只有 added/modified/removed。T9 那条从 JS 自述得出，只覆盖了 diffTree 一维。
3. **印证 `T9` 其余三条**（升到二进制实证）：`nodeType`+`indexing` 双维、剪枝（binary/large/ignore）**下沉原生层**、`diffTree` 三桶在原生判定。
4. **补 `T6`（context-plugin 册）的运行时四件**：`mtree.win32-x64-msvc.node` 与 `qoder-context-hook.exe` **已读实现**（本册）；`assets/r1/a.bin`/`b.bin` **仍未读**，但其路径与角色已由 `runtime-manifest.json` 的 `assetModule`/`assetBinary` 键钉死（[观察]），保持 [未知] 不冒充。
5. **接续 `T7`"多版本目录并存"**：本册 §C3 给第三处证据 + 新增"版本内演化序列"维。

---

## 5. 缺口对撞表（≤8，按补齐性价比排序；观察类/等条件类不进表）

| # | 对方那格是什么（含三态） | 本仓现读有什么（file:line） | 判定 | 最小落点 |
| --- | --- | --- | --- | --- |
| 1 | **逐节点双哈希**：`MerkleNode{hash, rhash}` + `snapshot{rootHash, rootRhash}`，`rhash` 自 children 聚合 ⇒ 目录级前像可整枝比对（[观察]） | `apps/ai-service/app/services/codebase_indexer.py:143` `_merkle_root = sha256(sorted("path:hash"))`（**只有扁平根**）；`:810` 逐文件比 `prev_snapshot.get(rel_path) == content_hash`；`:133` 快照是每文件一张 dict | **真缺口**（本仓有增量，缺的是"目录级聚合维"） | `_load_snapshot` 前像里加一层 `dir -> rhash`；walk 自底向上聚合，`rhash` 相同的目录整枝跳过（不改现有逐文件判据，只加前置剪） |
| 2 | **ignore 三文件族原生解析**：`.gitignore`/`.qoderignore`/`.aiignore` + 内置 VCS/系统排除 + 可 `reload` 的 `MtreeProjectIgnore`（[观察]） | 同文件 `:110-114` `_IGNORED_DIRS` 硬编码目录名集合；`:478` 只把它当参数传；全仓 `gitignore` 命中面里没有 indexer（`grep -rln gitignore apps/ai-service/app/services/` 无 `codebase_indexer.py`） | **真缺口** | indexer 增加"逐级读 `.gitignore`/`.qoderignore` → 合成排除谓词"，把 `_IGNORED_DIRS` 降级为兜底默认，谓词单源一处 |
| 3 | **事件驱动增量**：`MtreeWatcher`（notify 8.2 + debouncer-full 0.7）`eventType ∈ {create,modify,remove,rename}` + `WatcherOptions.debounceTimeout`（[观察]） | indexer 的增量只在**调用时**成立：`:792` 取前像、`:816` 算 `deleted_paths` 差集、`:859` 有变更才重建；无 watch 源（`grep watchdog/Observer` 于该文件 0 命中） | **真缺口** | 加"事件流→去抖→只重算受影响子树"的入口；`rename` 单独成桶（配合 #4），无事件时退回现有全量 walk |
| 4 | **改名相似底座**：`compute_simhash`/`compute_simhash_batch`（256-bit，`expected 64` hex 校验串）+ `hamming_distance` 原生导出（[观察]） | `apps/ai-service/app/services/publish/anti_risk/content_dedup.py` 有 minhash/shingles 一类的**内容去重**用途；索引侧 `grep -i simhash|hamming|renamed codebase_indexer.py` **0 命中** | **真缺口**（不是"本仓无相似技术"，是"索引链没接相似"） | 改名候选打分：同尺寸/同扩展名 + 前 N 块 simhash 汉明距离阈，命中即"移动"而非"删+增"；复用 `content_dedup` 里已有指纹件，不另起炉灶 |
| 5 | **token 预算 + 10 维目录权重**：`render_tree{maxTokens,maxFilesPerDir,budgetStrategy,scopePaths,showHashes}` + `WeightConfig{fileTypeWeights,dirNameWeights,timeDecayFactor,sizeImpactFactor,depthDecayFactor,dirBoostFactor,ignoreDirs,brokenLimit,hardLimit,sortLimit}` + 串 `Content may be folded due to token limit…`（[观察]） | indexer 只有切片长度 `:118 MAX_CHUNK_CHARS=8000`、`:125 MAX_FILES_PER_INDEX=5000`；`grep -i "budget\|weight\|render_tree" codebase_indexer.py` 0 命中 | **真缺口** | 给"仓库结构概览"这类上下文装配加一档 token 预算渲染（先目录按权重排序、超预算折叠并显式写"已折叠 N 项"），权重维度按需分批 |
| 6 | **钩子宿主 = 独立原生进程**（GUI subsystem、stdio JSON + 本机 JSON-RPC、`run/hosts` 宿主身份核验、`CAPABILITY_DISABLED` 就地降权、离线 `.pending.jsonl`）（[观察]） | `apps/cli/src/hooks/index.ts:627` `HOOK_EVENT_KEYS` 现读 **31 档**（含 `permissionRequest/taskCreated/taskCompleted/worktreeCreate/worktreeRemove/cwdChanged/fileChanged/elicitation…`），`:383` `dispatchHookEntry` 唯一收口，`:243` `additionalContext` 通道，`:261` `PermissionHookDecision = deny\|allow\|ask\|modify` **四形状**（对方本件只观察到 `allow` 一档），`:486/:1002` AbortSignal 超时 | **本仓事件面与权限应答面更宽 = 已具备**；对方胜在**进程隔离 + 宿主身份绑定**这一型（本仓钩子在 CLI 进程内跑，崩了拖宿主） | 不追原生件；把"钩子超时/崩溃隔离"与"宿主 PID/产品身份入参校验"两格补进 `dispatchHookEntry` 单点（异步钩子已有独立生命周期，落点在那一层） |
| 7 | **内嵌 per-product 能力表**（`products.qoder` vs `qoder-cn`，键含 `configDirectory/searchWorkspace/turnRelay/remoteCodeIndexing/indexSettings/workspaceIndexOrganizationPolicy`，`workspaceIndexOrganizationPolicy`+`indexSettings` 自 1.0.91 起出现）（[观察]） | `grep -i "capabilit\|productForm\|product_form" apps/cli/src/hooks/index.ts` **0 命中**；本仓产品形态差异散在各端配置里，无"能力→按形态降权"的声明式单源 | **真缺口（小）** | 一张 `productForm → 能力布尔` 的声明式表（`packages/config` 或 `packages/types` 单源），钩子/工具注册处按表降权并在缺键时显式报"能力未开"而非静默 |
| 8 | **快照压缩与文件 IO 原生化**：`encode_zstd`/`decode_zstd`/`is_zstd_compressed`/`read_snapshot_from_file`/`write_snapshot_to_file`（zstd-0.13.3/zstd-safe-7.2.4 在册）（[观察]）；注：这 5 枚在插件自带 JS 里**未找到调用点**（§A4 未接线清单） | indexer 快照为明文 JSON（`:133 _MERKLE_SNAPSHOT_DIR`，每 repo 一枚）；`zstd` 在本仓只出现在 `apps/ai-service/app/core/rollout_archive.py`（另一用途） | **真缺口（小）+ 形态参考**：对方"能力齐但自带 JS 未接"正是本仓可超越处 | 快照落盘加一层 zstd/gzip + 魔数自识别（读旧明文兼容），并把压缩件复用给 rollout_archive，不写第二份 |

> 排序依据：1–4 直接影响"增量索引的正确性与成本"（改名/整枝/ignore 语义都是当前索引链会答错的格），5 影响上下文装配质量，6–8 属工程化与小缺口。表内每条"本仓现读"列的 file:line 与计数均为 2026-11-01 本席现读，非引用旧册。

---

## 6. 复验命令（本席实跑过；产物在 `D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/`）

```bash
# C：跨 8 版契约差分（一次产出 hooks.json/runtime-manifest/plugin.json/bin/native 的字节+sha+条目表）
node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/ContractDiff.mjs

# A1：napi 注册名集合（20 函数）与两版对撞（comm 两向空集 ⇒ 导出零漂移）
node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/NameDiff.mjs
# A1/装载层同口径：loader 解构与 module.exports 各 23 枚（**纯文本计数，绝不 require 该件** ——
# require 会把 napi 原生模块加载进进程，本席红线是"不执行"）
node -e "const fs=require('fs');const L=fs.readFileSync('C:/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/1.0.91.b22f2d0a/runtime/native/mtree/index.cjs','utf8').split('\n');console.log('destructured',L[312].replace(/^const \{/,'').replace(/\} = nativeBinding.*/,'').split(',').filter(x=>x.trim()).length,'| exports',L.filter(x=>x.startsWith('module.exports.')).length)"

# PE 层（导出表/导入表/段表/串表）：四件各跑一次，输出 <tag>-pe.json + <tag>-pe.strings.txt
node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/PeParse.mjs mtree-1091.node mt91-pe.json

# A2：哈希算法的连续表签名（只认 SHA-256 族，其余全 0）
node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/HashTables.mjs mtree-1091.node
# A2 调用点：RIP 相对引用（第三行是"正反对照"——已知被引用的字符串必须命中，否则说明扫描器本身是哑的）
node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/RipXref.mjs mtree-1091.node 0x18016ba10 0x180186be0 0x1801700b2
#   现读：0x18016ba10 -> 0x180034ab9 | 0x180186be0 -> 0x1800c03d2 | 0x1801700b2(checkIsBinaryFile 串) -> 4 处
# A2 调用链上溯（以两个哈希引用点为种子，靠 Ghidra 的函数表定位属主）
node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/CallerChain.mjs mtree-1091.node mt91_functions.txt 0x1800c03d2,0x180034ab9 2
#   现读：FUN_1800c0300 <- napi_register_module_v1@0x18008b200 等 4 处；FUN_180034a60 <- 7 处

# B：三版 exe 的字面量存在性矩阵（不是行集差，避免偏移漂移造假"删除"）
node D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/TokenMatrix.mjs

# Ghidra headless（本册所有函数/字符串/反编译读数的出处）
# 1) 全量测绘（首次 -import 会跑完整分析，实测 ~6 分钟）
D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/run_mt91.bat
#    = analyzeHeadless.bat <proj_b46> b46_proj -import mtree-1091.node \
#        -scriptPath <同目录> -postScript B46Survey.java > run_mt91.log
# 2) 只跑脚本不重分析（项目已存分析结果，~40 秒；改脚本后一律走这条）
D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/run_mt91b.bat
D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/run_hk91.bat          # hook-1091.exe（-import，~3 分钟）
D:/DevEnv/Temp/ihui-scratch/goal-b46-ghidra/run_mt91d.bat         # B46Decomp.java（定点反编译剪枝/diff/simhash 属主）
```

**判成功看目录里有没有文件**（本席据此抓出两次空跑）：`B46Survey.java` 首版因 `getAddress(String)` 不存在而**静默零产物**，`GhidraScript` 需 `prog.getAddressFactory().getAddress(...)`；第二坑 = 同项目并发跑两个 headless 会 `LockException: Unable to lock project`（**必须串行**，或给每件配独立项目目录，如 `proj_b46` / `proj_b46b`）。

## 7. 未收口的格子（诚实清单）

| 格 | 状态 | 缺的一步 |
| --- | --- | --- |
| A3 "large" 阈值常量 | **[未知]**（已反编译集内无候选立即数） | `run_mt91d.bat`（`B46Decomp.java`，种子含 `180062ee0`/`180062b70`/`180036140`/`180036e40`）出 `mt91_decomp2.txt` 后 grep 比较立即数 |
| A2 `rhash` 的输入形态（拼接顺序/叶子基例） | **[推断] SHA-256，细节未知** | 从 `0x180034a60` / `0x1800c0300` 两簇做 `CallerChain.mjs` 深度 3，找 `MerkleNode` 构造点 |
| B2 `deny`/`ask` 档 | **未找到**（非"不存在"） | 反编译 `permissionDecision` 串的引用点 `FUN_140026120` 一带，或读守护侧（JS） |
| B3 argv 分发的实际键 | **[未知]**（1.0.84+ 未检索到 `session-start` 等字面量） | `B46Decomp` 换种子到 exe 的 main/context 簇，或读 `GetCommandLineW` 的引用函数 |
| `assets/r1/a.bin`(3,409 B)/`b.bin`(111,136 B) | **[未知]**（本册只钉了路径与角色） | 另席处理（T6 原格仍未闭合） |
| 10 枚未接线导出的真实消费方 | **[未知]**（不在插件包内） | 需要读 Qoder CN 主程序 bundle（另一个靶） |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
