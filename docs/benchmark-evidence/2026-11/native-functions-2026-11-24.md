<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 四程序原生二进制「函数级」深度取证（2026-11-24）

> 对照程序：DeepSeek Harness · TRAE CN · Qoder CN · WorkBuddy（版本以本轮现读为准）
> 上一轮（2026-11-23，`deep-native-2026-11-23/README.md`）已完成 44 条行为/符号级候选；
> 本轮只补**原生函数级反编译**这一整块，不重复已结论的行为面。
>
> 纪律：只读目标安装目录，绝不写入；不运行任何目标程序本体；不提取 token/cookie/账号；不破解许可证。
> 取设计与行为：任何单条对方源码连续片段 ≤10 行；伪代码只摘一两条关键判据并改写为中文描述，不整段粘贴。
> 每条固定六栏：**证据**（绝对路径 + 符号/串 + 可复核命令）· **三档**（观察 / 推断 / 未知）·
> **IHUI 现状**（真跑过的 grep 结果与命中文件）· **落点建议**（绝对路径）· **超越轴** · **最小复现范围**。

## 0. 进度与口径（本轮滚动更新）

### 0.1 工具链现读（2026-11-24，本机实测）

| 工具 | 路径 / 版本 | 状态 |
|---|---|---|
| rizin | `C:\Program Files\Rizin\bin\rizin.exe` | 可用 |
| Ghidra | `D:\DevEnv\ghidra_12.1.4\support\analyzeHeadless.bat` | found=true；JAVA_HOME=`C:\Program Files\Java\jdk-21-temp\jdk-21.0.2+13` |
| craft-anything CLI | `C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe` | 0.5.0；native 工具集全 available；引擎 ghidra/rizin/java 均 found |

> 注：`.ihui/mcp.json` 内旧的 craft-anything 0.6.1 路径与旧 JDK 路径均已失效，本轮不采用。

### 0.2 安装路径现读（不存在即记「未判定（路径不存在）」，不伪造）

| 程序 | 任务给定路径 | 现读结果 | 实际取证根 |
|---|---|---|---|
| Trae | `C:\Trae CN\resources\app\modules\` | 存在 | 同左 |
| Qoder | `C:\Users\Administrator\AppData\Local\Qoder CN\resources\` | **不存在**（该根仅为 updater/缓存，无 resources） | `C:\Qoder CN\resources\`（上一轮 README 亦记此根） |
| WorkBuddy | `C:\Users\Administrator\AppData\Local\WorkBuddy` 与 `C:\workbuddy` | 前者存在但枚举到 0 个原生 PE/Node；后者存在，原生件全部在其下 | `C:\workbuddy\resources\app.asar.unpacked\` |
| DeepSeek Harness | `C:\Users\Administrator\AppData\Local\@deepseek-ai\dsh-desktop-updater` | **不存在** | `C:\Apps\DeepSeekHarness` |

### 0.3 原生件体量分级（决定分析手段）

- **仅 rizin 定向（秒级），不进 Ghidra 全量**：Trae `ai_agent.dll` 271.48MB、`harness.dll` 253.65MB、`agent-tool-host.exe` 96.43MB、`toolhost.dll` 95.31MB、`libckg.dll` 37.83MB；Qoder `skia.node` 26.03MB、`libvips-42.dll` 18.24MB、`AoqClientSdk.dll` 14.01MB。
- **可进函数级分析（小体积）**：Trae `sbox_sdk.dll` 2.21MB、`vm_sdk.dll` 2.46MB、`aiep_ipc.dll` 0.55MB、`aiep_sbox.dll` 0.72MB、`run_helper.exe` 0.65MB；Qoder `system_commit.node` 0.65MB、`native_clipboard.node` 0.69MB、`notification_permission.node` 1.47MB、`keytar.node` 0.67MB；WorkBuddy `job-object.node`、`tsbx*.dll`、`sandbox_ffi.dll`、`process-snapshot.node`、`perf_metrics.node`；DSH `koffi.node`、`reflink.node`、`frame-forwarding` 节点。
- 体量纪律：单目标 >15 分钟无产出即记「未判定（体量超限）」换下一个；每次只起一个分析实例。

### 0.4 本轮进度（滚动）

> 下表为 2026-11-24 12:30 复评后的现读值，旧稿「函数清单待取 / 伪代码 0 条 / 状态未开始」系滚动表未同步 §1 已落地证据，已作废。

| 程序 | 已完成 | 函数清单 | 伪代码/反编译条数 | 状态 |
|---|---|---|---|---|
| Trae | 路径 + 体量分级；P3-01(ALPC)/P3-02(双探测 SDK) 已 Ghidra 伪代码；§0.5 raw 取证 + §0.6 **craft deep 函数级复评**（libckg Go 函数表 + 四大件字符串→函数定位 + 反编译） | 小件 Ghidra 已取；libckg 33406 Go 函数（pclntab）；四大件 stripped，按判据词定位到函数 | 2（P3-01/02 Ghidra）+ §0.5 + §0.6 函数级伪代码 | 判据已核、函数级完成；仅超大函数体未逐条展开（如实记已定位未逐条） |
| Qoder | 路径纠正（`C:\Qoder CN`）+ 枚举；P3-05/06/07 已取证 | 小件 `system_commit/native_clipboard/notification_permission.node` 可进；`keytar.node` stripped 仅字符串面 | 3（P3-05/06/07，含字符串级；令牌一次性闭包 `function_not_found`） | 判据已核；大件面未展开 |
| WorkBuddy | 两处路径核对 + 枚举；P3-03/04 已 Ghidra 伪代码 | `job-object.node` craft builtin 2492 切分函数（全 stripped）；`sandbox_ffi/tsbx.dll` 未逐条展开 | 2（P3-03/04 Ghidra）+ P3-04 函数清单 | 判据已核；`sandbox_ffi/tsbx` 未逐条 |
| DeepSeek Harness | 路径纠正（`C:\Apps`）+ 枚举；业务逻辑上一轮已到 JS/TS 面 | 原生面以第三方/运行时件为主，无可进的自研业务 DLL | 0（本轮原生函数级无新增；业务判定已在 JS/TS 面） | 原生面完成枚举，无新增结论 |

### 0.5 复评补录（2026-11-24 12:30，倒着用证据核判据）

> 触发：对话里一度断言「五大件在本机找不到、函数级分析物理上做不了」。本次实测推翻该结论，
> 并把取证结论**反过来核 IHUI 现有判据有没有漏**。纪律不变：只读目标目录、不运行目标程序、
> 不提取凭据；下列均为符号/字符串级**观察**，不把推断写成观察。

**① 五大件路径纠正（原结论错在搜索面开窄）**：五件全部存在，只是不在 `sandbox/x64/` 而在
`ai-agent/` 与 `ckg/binary/` 下（复现：`find "C:\Trae CN" -maxdepth 6 -type f -iname ...`）：

| 件 | 实际路径 | 字节 |
|---|---|---|
| `ai_agent.dll` | `C:\Trae CN\resources\app\modules\ai-agent\ai_agent.dll` | 284,664,208 |
| `harness.dll` | `...\ai-agent\harness.dll` | 265,971,600 |
| `toolhost.dll` | `...\ai-agent\toolhost.dll` | 99,944,848 |
| `agent-tool-host.exe` | `...\ai-agent\bin\agent-tool-host.exe` | 101,117,328 |
| `libckg.dll` | `...\ckg\binary\libckg.dll` | 39,672,720 |

**② libckg.dll 函数级观察（Go c-shared，非 sqlite-vec 那么简单）**：模块 `ide/ckg/codekg/cmd/server`
（vcs `417a6ec`，2026-09-22），依赖 `go-sqlcipher`/`gorm`/`grpc`/`sarama`。二进制内可复核串：

- 存储层：`data_storage.SQLiteVecStorageV2`、`SQLite format 3`、表 `%w_rowids(rowid INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, chunk_id, chunk_offset)`；
  幂等 upsert `INSERT INTO "%w"."%w_rowid"(rowid,nodeno) VALUES(?1,?2) ON CONFLICT(rowid) DO UPDATE SET nodeno=excluded.nodeno`；
  函数 `EntityStorage.UpsertUriMeta`、`upsertUriMetaFromExistingUriMeta`。
- 缺向量计数：`WHERE vte.entityID IS NULL) as missing_vector_entity_count` + `MissingVectorEntityCount` 字段，
  与 `(SELECT COUNT(*) FROM vector_to_entity) as vector_to_entity_count` 成对出现（缺数/总数对照）。
- 版本治理（此前未观察）：`consts.StorageVersion`、`GetLocalStorageVersion` / `GetTargetStorageVersion`、
  `IsVersionMatched(Request{version} → Response{code,error,matched})` —— 客户端/服务端存储版本握手。
- 本地/远端双路：`HasAlreadyLocalEmbeddingAtDisk` / `HasAlreadyLocalEmbeddingAtRuntime`、
  `retrieve_by_embedding_prepare` → `local_remote_embedding_selector` → `retrieve_by_embedding_from_remote`；
  检索结果缓存 `Get/SetEmbeddingSearchResultsFromCache`；嵌入模型 `codekg_bge_m3`。

**③ 四大件函数级观察（内嵌 Python/JS 源码字符串）**：

- 交付队列状态机：`state TEXT NOT NULL CHECK (state IN ('queued','claimed','delivered','cancelled'))`
  （`ai_agent.dll` / `toolhost.dll` / `agent-tool-host.exe` 均命中）；审批态 `'$.session_notification.status' IN ('pending','approved')`（`harness.dll`）。
- 命令级超时：`timeout: int = 120` 默认值、`_DBW_PRECHECK_POLL_TIMEOUT` 预检轮询上限、
  `"message": "timeout waiting precheck"`；具名超时回执 `Timeout after {timeoutMs}ms waiting for selector ...`。
- 断点续读游标：`reply_user_read_cursor`（含 `plan_item_index` / `message_index`）、
  `SELECT status, last_cursor_rowid, end_rowid ...`。

**④ 反向核 IHUI 判据结论（本轮真正的产出）**：

| 对照观察 | IHUI 现状（现读） | 判定 |
|---|---|---|
| `missing_vector_entity_count` + 总数对照 | `codebase-index-service.ts:322` 注释明写对齐该字段，`IndexIntegrityReason='missing_vectors'`、审计 `degraded` | 已覆盖，无需改 |
| 1536 维 / HNSW / 租户 / 90 天保留 | `schema/codebase-index.ts` + service 的 1536 校验、pgvector `<=>` ANN | 已覆盖且存储层更强（sqlite-vec → pgvector） |
| 幂等 upsert（`ON CONFLICT`） | 入库按 `(path,chunk)` 去重、指纹 `v1536:tree-sitter-chunk-v1` 判重建 | 形态不同、语义等价，不照搬 |
| 存储版本握手 `IsVersionMatched` | 静态配置指纹 `CODE_INDEX_CONFIG_FINGERPRINT`（只服务重建判定） | 非缺口：握手是 C/S 协议，IHUI 单机无此边界；照搬降级 |
| 交付队列四态 / 审批两态 | `cancelled` 语义在订单/工作流/队列判据中已闭环（域不同） | 非缺口：域不同，能力已具 |
| 断点续读游标 | WS 通知走 `markAsRead`/`unreadCount`，无 rowid 级断点 | **可选增益**，非对照方独有（通用分页模型），证据不足以判为"漏" |

**结论**：豆包「CKG 这条没的可榨、照学反而降级」的总判断成立；但其「五大件物理上做不了」与
「P3-04 指纹自报未落」两处**事实错误**已由本轮纠正 —— 五件都在，`orphan_guard.rs` 的
`VerifyOutcome`/`sha256_of_file`/`verify_artifact` 也已落地（文档 §1 P3-04 与 §2 表中"可选未落"字样过时）。
本轮不改任何生产代码：取证结论若与现有判据同构或域不同，照搬即违反 §0「重交付结果」。

### 0.6 craft deep 模式函数级复评（2026-11-24 12:45，纠正「只做到字符串级」）

> 触发：机主指出此前只做 rizin + raw strings，未用 craft deep 模式真正把函数级榨透。复核属实——
> `craft capabilities` 显示 `analysis_mode: deep` 默认开启、Ghidra/Java/rizin 引擎齐备，而此前一次未用。
> 本轮用 craft 0.5.0 `--deep`（前置全局旗标）+ `--project .ihui-agent/tmp/craft-deep-*` 落证据，
> 只读目标、不运行、不提凭据；伪代码来自 builtin clean-room lifter（Ghidra 全量建库在 37MB Go 件上 >300s 超时，故走 builtin，如实标注）。

**libckg.dll（Go 1.25 c-shared，主模块 `ide/ckg`，33406 函数 / 1227 包，`native-go-binary-show` 内置 pclntab 解析）**

| 函数（Go 全名，观察） | 函数级证据 | 判据含义 |
|---|---|---|
| `data_storage.(*SQLiteVecStorageV2).GetVersion` | 伪代码 `mov eax, 2; ret`（地址 `0x37ef340c0`，1 块 2 指令） | 存储版本**硬编码 2**，非配置驱动 |
| `ckg_config.(*Config).GetTargetStorageVersion` | 伪代码校验入参长度 `r9==10`，逐字比对 `0x765f6574696c7173`+`0x6365`（ASCII `sqlite_v`+`ec`）后返回 `2`，否则返回 `0` | 版本握手判据本体＝**`sqlite_vec` 精确匹配 → 版本 2**，此前只有函数名、无判据 |
| `data_storage.(*EntityStorage).UpsertUriMeta` | 引用串 `idempotency_level` + `uri_canonical = ?`；伪代码调 `util.IsSubdirectory` 后分派 | 幂等键＝规范化 URI，带幂等级别字段（此前只见 `ON CONFLICT` 串） |
| `data_storage.(*SQLiteVecStorageV2).AddEmbeddingDocument` | 函数体仅 `runtime.gopanic()`（无业务逻辑） | **单条写入未实现，实际走批量** `AddEmbeddingDocuments`——边界发现 |
| `data_storage.(*SQLiteVecStorageV2).QueryByEmbedding` | 栈展开 `0x30c0`，引用串含 `RetrieveCodeChunk start`、`[GetOrCreateStorage] Storage creation completed` | 批量向量检索，与索引/存储生命周期同函数族 |

**四大件（PE / stripped，`core-feature-find` 字符串→函数定位 + `native-function-study` 反编译）**

| 件 | 判据词 → 函数（观察） | 函数级证据 |
|---|---|---|
| `ai_agent.dll` | `queued` → `sub_180988775`（4639B） | 串 `[Toolhost] VM SDK not ready yet, whitelist paths queued for deferred flush`；伪代码 switch 分派 + 跳转表偏移 `rcx+=0x5c7`；KERNEL32 完成端口 `Post/GetQueuedCompletionStatus(Ex)` 导入 |
| `ai_agent.dll` | `approval` → `sub_1801302fa`（自动/降级/手动）、`sub_180a92fd1`（11326B） | 串 `cached_auto_approval_available`、`[PermissionV3] downgrade explicit auto_approval profile`、`manual_approval`、`Automatic approval review failed`；后者伪代码含 guardian 解析、`allow`/`low` 分支与状态位清零 |
| `ai_agent.dll` | `timeout_ms` → `sub_1809aae07` | 请求结构 `CliRequest{session_id,command_id,args,timeout_ms,binary_data,extra}`；**三级超时** `timeout_ms` / `kill_timeout_ms` / `busy_timeout_ms`（此前只记 `timeout:int=120`） |
| `harness.dll` / `toolhost.dll` / `agent-tool-host.exe` | `timeout_ms` 45 命中、`queued` 21 命中、`timeout` 171 命中→33 函数 | 均命中函数级定位；未逐函数深挖（体量/边际），如实记「已定位未逐条」 |

**反向核 IHUI 判据**：以上进一步坐实 §0.5 结论且无新增缺口——版本握手我们是静态配置指纹 `v1536:tree-sitter-chunk-v1`（单机无 C/S 握手边界）；幂等/规范化键在数据库层已有；`AddEmbeddingDocument` 未实现恰说明对照方也不支持单条写；三级超时我们 `hook_runtime`/`scan_login`/`rg_fallback_parity` 已覆盖具名超时 + 无界等待防护；审批三级我们业务域不同但 `cancelled`/超时终态已闭环。**仍不改生产代码**——deep 模式的价值是把「未判定」变成有据的观察，不是照搬。

---

## 1. 取证条目（P3-NN，滚动增补）

> 复现命令约定：rizin=`C:\Program Files\Rizin\bin\rizin.exe`；
> craft=`C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe`（0.5.0，`--deep` 全局旗标前置）。
> 伪代码来自 craft 0.5.0 deep 模式的 builtin clean-room lifter（Ghidra 12.1.4 作 deep 引擎，37MB Go 件建库超时时回退 builtin，见 §0.6）；下文只摘一两条关键判据并改写为中文，不整段粘贴对方源码。

### P3-01（B 档）Trae ALPC IPC 通道：安全描述符由外部入参，空参/建段失败显式报错

- **证据**：
  - 文件 `C:\Trae CN\resources\app\modules\sandbox\x64\aiep_ipc.dll`（577,424 字节）。
  - 导出（rizin）：`CreateIPCInterface` / `CreateIPCInterface2` / `DestroyIPCInterface` / `InitIPCInterface2WithSecurityDescriptor`。
    复核：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iE" "C:\Trae CN\resources\app\modules\sandbox\x64\aiep_ipc.dll"`
  - 导入（rizin）：`ntdll!NtAlpcCreatePort` / `NtAlpcConnectPort` / `NtAlpcAcceptConnectPort` / `NtAlpcSendWaitReceivePort` / `NtAlpcCreatePortSection` / `NtAlpcDisconnectPort` 等 12 条 ALPC 原语；**未见** advapi32 的 SD/ACL 构造 API。
    复核：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "ii" "<同路径>"` 后按 `Security|Descriptor|ACL|Token|Alpc` 过滤。
  - 伪代码（Ghidra）：`CreateIPCInterface` 分配 0x130 字节、`CreateIPCInterface2` 分配 0x198 字节；构造失败句柄槽写 0 并返回 false。`InitIPCInterface2WithSecurityDescriptor` 入参为 null 直接返回 0，否则转内部实现 `FUN_180005ac0`；该内部函数对「通道参数为空 / 配置指针为空」走错误分支，错误码为 `0xc000000d`（STATUS_INVALID_PARAMETER）；`NtAlpcCreatePortSection` 返回负值走错误分支；随后申请两块 0xc839 字节缓冲，任一为空亦走错误分支；错误提示串经 XOR（0x7c/0xfe/0x8b/0x97）解密后上报 `"Error"`。
    复核：`& craft --deep native-function-pseudocode "<dll>" --function InitIPCInterface2WithSecurityDescriptor --output-format json`。
- **三档**：
  - 观察：四个导出名、12 条 ALPC 导入、两套对象布局尺寸（0x130/0x198）、空参返回 0、建段失败/缓冲失败走错误分支、错误码 0xc000000d、提示串加密存储。
  - 推断：V2 接口在 V1 基础上多挂外部传入的安全描述符段；DLL 自身不构造 SD，只负责把调用方给的 SD 挂到 ALPC 端口；两块 0xc839 缓冲疑为收发消息池。
  - 未知：SDDL/ACL 主体与主体身份、ALPC 端口名、收发帧格式、SD 在调用方（harness / toolhost）何处构造；XOR 解密后的完整错误文案未逐条还原。
- **IHUI 现状（2026-11-24 复评 + 本票落地）**：`Grep "CreateRestrictedToken|InitializeSecurityDescriptor|SetSecurityDescriptorDacl|SetEntriesInAcl|CreateProcessAsUser|AdjustTokenPrivileges" C:\IHUI-AI\apps\desktop\src-tauri\src` → 0 命中属实，但**原文结论"完全没有原生 ALPC/SD 通道面"已过时**：`apps\desktop\src-tauri\src\ipc_channel_acl.rs`（285 行，B2-02）早已落地**命名管道** SD/DACL 兜底面 —— `build_restricted_sddl` 把 DACL 钉死「当前用户 + SYSTEM」（不带 Everyone / Authenticated Users / Builtin Users）、`validate_restricted_sddl` 复核「恰好两条 ACE」、`validate_user_sid` / `validate_pipe_name` 形状校验、`create_restricted_pipe` 失败返回 `Err` 不退回裸管道、`RestrictedPipe` + `Drop` 收口不留半初始化句柄。本轮补的是**ALPC 抽象层**：`apps\desktop\src-tauri\src\ipc_channel.rs`（新建）给出通道 trait 三面（open / close / attach_security_descriptor，外部 SD 由调用方传入、本层不构造 SD）+ 显式错误码族（`InvalidParameter` 映射 `STATUS_INVALID_PARAMETER = 0xc000000d`、`PortCreateFailed` / `SectionCreateFailed` / `BufferAllocFailed` / `UnsupportedPlatform` / `Unjudged`）+ RAII `HandleToken` / `HandleTracker` 计数台账（构造中途失败零句柄残留）+ 可注入 `ChannelBackend` 假工厂；非 Windows 或 ALPC 后端未取证落 `unsupported` / `unjudged`，不假装可用。**装车**：`sandbox_ipc.rs` 的 `ipc_channel_selftest` 回执新增 `transport` / `alpc_status` 两栏。提交 `390022b9`。
- **落点建议**：`C:\IHUI-AI\apps\desktop\src-tauri\src\ipc_channel.rs`（先登记边界 trait：open / close / 挂接外部 SD）。
- **超越轴**：fail-closed 边界——空参、建段失败、缓冲分配失败均显式返回错误码，不回落裸管道；接口构造失败不留半初始化句柄。可测性：注入假端口创建失败，断言无对象残留。
- **最小复现范围**：接口句柄对象 + 外部 SD 入参 + 端口创建失败即拒；不实现 ALPC 收发循环，先用命名管道兜底 trait。

### P3-02（A 档）Trae 作业级 / VM 级两套探测 SDK 同构：双判定值 + TLS 结果留痕

- **证据**：
  - 文件 `C:\Trae CN\resources\app\modules\sandbox\sbox_sdk.dll`（2,320,272 字节）与 `...\sandbox\unified\vm_sdk.dll`（2,582,928 字节）。
  - 导出（rizin）：`SBoxSDK_Init/InitV2/IsSBoxSupported/CreateSandbox/GetSBoxInfo/FreeSBoxInfo/Action/GetLastError/UnInit`；`VMSDK_Init/InitV2/IsVMSupported/CreateProcess/GetVMInfo/FreeVMInfo/Action/GetLastError/UnInit`。
    复核：`& rizin -qc "iE" "<dll>"`。
  - 伪代码（Ghidra）：两个 `Is*Supported` 函数体同构。入参为 null 或空串走默认配置分支；非空则按串构造配置；取全局单例对象 → 调判定函数得原始结果 `iVar2` → 再经归一函数得 `iVar3`；结果写入 TLS 槽位；日志串 `stage=support_check native_domain=support_status native={}`；判定为 0 时清空 TLS 结果，非 0 时在 TLS 写入 API 名（`api=SBoxSDK_IsSBoxSupported` / `api=VMSDK_IsVMSupported`）。
    复核：`& craft --deep native-function-pseudocode "<dll>" --function SBoxSDK_IsSBoxSupported --output-format json`（VM 侧换 `VMSDK_IsVMSupported`）。
- **三档**：
  - 观察：两套 SDK 导出面平行；探测函数模板复用；同时产出「原始判定值」与「归一值」；TLS 槽存结果与来源 API 名；失败清空留痕。
  - 推断：SBox 对应作业/容器级、VM 对应微虚拟机级，两接口形态平行可各自独立探测。
  - 未知：判定值与归一值的具体枚举、底层调用了哪些 OS 能力探测 API（在被调子程序内，未展开）；12 个不支持原因码位于 `trae-sandbox.exe` 而非这两个 DLL（上一轮已列）；VM 后端技术仍未知。
- **IHUI 现状（2026-11-24 12:30 复评，原结论过时）**：`apps\desktop\src-tauri\src\sandbox_sdk.rs` 已有 Job 级 trait 与装配；`Grep "IsVMSupported|microvm|HostCompute"` tauri src → 0 命中属实（VM 后端实现仍不做，符合最小复现范围）。但「探测结果无来源 API 留痕」**已过时**：提交 `9ed1ebdb` 补入 `ProbeRecord{source_api, raw, state}`（原始判定值 + 归一三态 + 来源 API 名双值留痕）、`ProbeTrace`（不成立/未判定清空、仅成立留痕）、`API_JOB_OBJECT_PROBE` / `API_MICRO_VM_PROBE` 两来源常量 + `log_support_check`，3 个测试钉住。结论＝**双判定值 + 来源留痕已具备**；仅 VM 后端技术仍未知（实现不在本票最小范围）。
- **落点建议**：`C:\IHUI-AI\apps\desktop\src-tauri\src\sandbox_sdk.rs` 扩展 trait：支持 / 不支持 / 未判定三态 + 来源 API 名留痕；VM 级只留探测桩与原因码。
- **超越轴**：fail-closed——任一不支持原因码命中即拒绝执行；可测性：探测结果双值（原始/归一）与未判定态均可注入夹具。
- **最小复现范围**：两套同构 trait + 入参配置分支 + 结果留痕；不做 VM 后端实现。

### P3-03（A 档）WorkBuddy 沙箱 SDK：受限令牌 + 自定义 DACL + Job 执法；IsSupported 为恒真桩

- **证据**：
  - 文件 `C:\workbuddy\resources\app.asar.unpacked\cli\vendor\sandbox\5.11.4\tsbx_sdk.dll`（576,280 字节）。
  - 导出（rizin）：`LsSDK_Init/UnInit/IsSupported/CreateSandbox/AttachSuspended/ResumeSandbox/ReleaseSandbox/WaitSandbox/GetSandboxProcessId/ReadAuditEvents/ReadNetworkAuditEvents/ExpandRulesJsonEnvVars/GetLastError/Free`。
    复核：`& rizin -qc "iE" "<dll>"`。
  - 导入（rizin）ADVAPI32：`CreateProcessAsUserW` / `OpenProcessToken` / `GetTokenInformation` / `AdjustTokenPrivileges` / `CreateRestrictedToken` / `InitializeSecurityDescriptor` / `InitializeAcl` / `SetSecurityDescriptorDacl` / `SetEntriesInAclW` / `GetNamedSecurityInfoW` / `SetNamedSecurityInfoW` / `SetTokenInformation`；KERNEL32：`CreateJobObjectW` / `AssignProcessToJobObject` / `SetInformationJobObject` / `CreateProcessW` / `ReadProcessMemory` / `WriteProcessMemory` / `Process32FirstW/NextW`。
    复核：`& rizin -qc "ii" "<dll>"` 后按 `Token|Security|Acl|JobObject|Process` 过滤。
  - 伪代码（Ghidra）：`LsSDK_IsSupported(void)` 函数体仅 `return 1`（恒真桩，真正能力检查不在此函数）。`LsSDK_CreateSandbox(uint *config, longlong ctx)`：全局初始化标志为 0 → 返回 3；配置指针或上下文为 0 → 返回 1；配置结构首字段（尺寸）小于 0x38 → 返回 1；另一字段为 0 → 返回 1；尺寸 ≥0x80 才读取其中宽字符串字段；日志命中 `Creating sandbox (passthrough) for: %s, shmem=%s`（存在 passthrough 直通模式与共享内存参数）。
    复核：`& craft --deep native-function-pseudocode "<dll>" --function LsSDK_CreateSandbox --output-format json`。
- **三档**：
  - 观察：14 个生命周期/审计导出；受限令牌与自定义 DACL 构造 API 族导入齐全；`IsSupported` 恒 1；`CreateSandbox` 返回码 1=参数/结构无效、3=未初始化，结构尺寸阈值 0x38/0x80；passthrough 与 shmem 串。
  - 推断：沙箱进程经受限令牌降权 + 自定义 DACL + Job 兜底三层执法；`ReadAuditEvents` / `ReadNetworkAuditEvents` 双路事件读取；`AttachSuspended` 挂起态派生再 `ResumeSandbox` 恢复。
  - 未知：受限令牌剔除了哪些权限/SID、DACL 允许/拒绝主体清单、passthrough 触发条件、shmem 布局与权限；`IsSupported` 恒真是否意味着能力探测上推到外部 tsbx 层。
- **IHUI 现状**：本轮 `Grep "CreateRestrictedToken|InitializeSecurityDescriptor|SetSecurityDescriptorDacl|SetEntriesInAcl|CreateProcessAsUser|AdjustTokenPrivileges" C:\IHUI-AI\apps\desktop\src-tauri\src` → 0 命中；Job Object 三 API 已在 `terminal_session.rs` / `orphan_guard.rs` / `sandbox_sdk.rs`。结论＝**完全没有**令牌降权与 SD/DACL 构造面。
- **落点建议**：`C:\IHUI-AI\apps\desktop\src-tauri\src\sandbox_sdk.rs` 新增受限令牌构造与 DACL 装配 trait（先桩后接）；审计事件读取面另立 `sandbox_metrics.rs`（对应上一轮 B2-10）。
- **超越轴**：fail-closed——未初始化、结构过小、空参显式返回错误码，不回落裸跑；可测性：返回码族（1/3/成功）与尺寸阈值各钉夹具。注意：不照搬 `IsSupported` 恒真桩（那是对照方的弱点，IHUI 探测必须给未判定态）。
- **最小复现范围**：Init/Create/Wait/Release 生命周期 + 入参结构版本校验 + 未初始化拒建；令牌降权与 DACL 本轮只留 trait 桩，不接真实受限令牌。

### P3-04（B 档）WorkBuddy no-orphans 原生 Job 件：两谓词 + 前置 IsProcessInJob 查询 + 源码指纹自报

- **证据**：
  - 文件 `C:\workbuddy\resources\app.asar.unpacked\cli\bin\native\win32-x64\job-object.node`（298,264 字节，Rust napi addon）。
  - 导出/字符串（rizin）：`napi_register_module_v1`、`codebuddy_no_orphans_source_sha256`；注册方法 JS 名 `ensureKillOnCloseJob` / `isProcessInJob`；错误串 `Cannot pin Windows Job` / `Cannot enable Windows no-orphans Job` / `Cannot create Windows no-orphans Job` / `Expected a process ID`；错误码族 `ERR_AGENT_CLI_WINDOWS_JOB`。
    复核：`& rizin -qc "iz" "<node>"` 后按 `orphan|job|mutex|pid|sha256|terminate` 过滤。
  - 导入（rizin）：`CreateJobObjectW` / `AssignProcessToJobObject` / `SetInformationJobObject` / `IsProcessInJob` / `OpenProcess` / `CreateMutexA` / `ReleaseMutex` / `CloseHandle` / `TerminateProcess`；Rust 侧经 dlopen/dlsym 动态取号（字符串 `dlopen failed` / `dlsym failed` 族在 `.rdata`）。
    复核：`& rizin -qc "ii" "<node>"`。
- **三档**：
  - 观察：两个 napi 方法名、四条构造失败错误串、错误码前缀、源码 sha256 自报导出、Job/互斥/终止 API 集。
  - 推断：`ensureKillOnCloseJob` 把作业句柄 pinned 到进程（关闭句柄触发内核清组）；`isProcessInJob` 提供前置判活查询；sha256 供加载侧校验 addon 完整性。
  - 未知：Job 限制类参数（CPU/内存/断开动作）、业务单例互斥名（二进制内仅见 `Local\RustBacktraceMutex00000000` 回溯互斥）、sha256 比对发生在加载方还是运行时；napi 闭包内部实现因 stripped 未逐函数还原。
- **IHUI 现状**：`orphan_guard.rs:61` 已 `AssignProcessToJobObject`；`terminal_session.rs` 已 Job 装配 + `TerminateJobObject`；本轮 `Grep "IsProcessInJob" C:\IHUI-AI\apps\desktop\src-tauri\src` → 0 命中（无「目标是否已在 Job」前置查询）。**本票已补（提交 `390022b9`）**：`orphan_guard.rs` 新增 `JobQueryOutcome`（`InJob` / `NotInJob` / `QueryFailed{last_error}` / `Unjudged`）、可注入 `JobQueryAdapter` trait（单测用假适配器断言三态，不在测试里真调系统 API）、纯判定 `classify_probe`、生产实现 `WinJobQueryAdapter`（kernel32 原始 FFI：`OpenProcess` → `IsProcessInJob`（Job 句柄传 null 表示「任意 Job」）→ `CloseHandle`），错误码族前缀对齐 `ERR_AGENT_CLI_WINDOWS_JOB`；非 Windows 落 `Unjudged`、不默认布尔值。`install()` 与 `AssignProcessToJobObject` 一行未动（不重做 Job 装配）。结论＝**Job 兜底 + 前置判活谓词均已具备**；「源码指纹自报」也**已落地**（`orphan_guard.rs` 的 `VerifyOutcome{Ok,Mismatch,Unjudged}` / `sha256_of_file`（64 KiB 分块）/ `verify_artifact`（白名单空⇒Unjudged 阻断，不是放行）/ `verify_artifact_path`，纯逻辑夹具可测；2026-11-24 12:30 复评修正原"可选未落"表述）。
- **落点建议**：`C:\IHUI-AI\apps\desktop\src-tauri\src\orphan_guard.rs` 补 `IsProcessInJob` 前置判活谓词；源码指纹自报件作为可选项远期评估。
- **超越轴**：可测性——判活谓词单独注入假句柄/假进程断言；不重复造 Job 装配（IHUI 已更稳）。
- **最小复现范围**：`ensure_kill_on_close` + `is_process_in_job` 两个纯谓词；失败错误码族对齐 `ERR_AGENT_CLI_WINDOWS_JOB` 形态。

### P3-05（B 档）Qoder 提交内存预判：系统级字段已被 IHUI 覆盖，主进程级两字段来源未判定

- **证据**：
  - 文件 `C:\Qoder CN\resources\bin\system_commit.node`（685,568 字节）。
  - 字符串/方法名（rizin）：`getSystemCommit`；返回字段 `commitTotalBytes` / `commitLimitBytes` / `mainProcessCommitLimitBytes` / `mainProcessCommitAvailableBytes`；PDB 路径串 `apps\desktop\native\systemCommit\build\Release\system_commit.pdb`。
    复核：`& rizin -qc "iz" "<node>"` 后按 `commit|charge|memory|available|limit|total` 过滤。
  - 导入（rizin）：仅 `GlobalMemoryStatusEx` + 进程/堆基础 API；**未见**专用进程 commit charge 查询 API。
    复核：`& rizin -qc "ii" "<node>"`。
  - 函数清单（craft builtin）：2492 个切分函数，全 stripped（`sub_` 名）；按方法名取伪代码返回 `function_not_found`（Rust napi 闭包未保留导出名）。
    复核：`& craft --deep native-functions-list "<node>" --output-format json`。
- **三档**：
  - 观察：一个查询方法、四个返回字段名、导入仅 `GlobalMemoryStatusEx`、PDB 工程路径可证其为桌面端原生件。
  - 推断：系统级总提交/可用取 `GlobalMemoryStatusEx` 的页面文件字段；`mainProcessCommit*` 两字段为调用进程级提交限额/余量，但专用查询 API 未出现在导入表，疑经动态解析或由上层 JS 折算——**本轮未函数级核实**。
  - 未知：主进程 commit 取值的具体 API（`GetProcessCommitCharge` / `NtQueryInformationProcess(ProcessCommitCharge)` 等）、字段单位与封顶口径；闭包内部数值折算逻辑。
- **IHUI 现状**：`C:\IHUI-AI\apps\desktop\src-tauri\src\system_memory.rs` 已实现系统级四态 `ok/tight/critical/unjudged`，读取同样只用 `GlobalMemoryStatusEx`（`ullTotalPageFile/ullAvailPageFile`），读数缺失或上限为 0 落 `unjudged`；无主进程级 commit 字段。本轮 `Grep "GlobalMemoryStatusEx|commitTotal|SystemCommit" C:\IHUI-AI\apps` 命中 `system_memory.rs` 与 `cua_desktop_environment_snapshot.py`。结论＝**系统级已覆盖且未判定语义更严；主进程级缺**。
- **落点建议**：维持 `system_memory.rs` 现状；主进程级字段在拿到专用 API 证据前不新增（避免凭字段名臆造实现）。
- **超越轴**：fail-closed——IHUI 读数缺失落 `unjudged` 而非冒充有余量，已优于对照方证据可见部分；PG 监控台账为可选增益。
- **最小复现范围**：不新增代码；若后续补主进程级，先取证对应查询 API 再落判据。

### P3-06（C 档）Qoder 剪贴板：读/写/取令牌三命令，令牌一次性语义未判定

- **证据**：
  - 文件 `C:\Qoder CN\resources\bin\native_clipboard.node`（721,408 字节）。
  - 字符串/方法名（rizin）：`writeClipboard` / `readClipboard` / `getClipboardToken`。
    复核：`& rizin -qc "iz" "<node>"` 后按 `clipboard|token|lease|read|write` 过滤。
  - 导入（rizin）：`OpenClipboard` / `CloseClipboard` / `GetClipboardSequenceNumber` / `SetClipboardData` / `GetClipboardData` / `RegisterClipboardFormatW` / `EmptyClipboard` / `IsClipboardFormatAvailable`。
    复核：`& rizin -qc "ii" "<node>"`。
- **三档**：
  - 观察：三个 napi 方法名；Win32 剪贴板 API 族齐全；导入含 `GetClipboardSequenceNumber`（剪贴板序号）。
  - 推断：一次性令牌可借剪贴板序号做防重放/防串内容绑定；令牌由 `getClipboardToken` 单独签发。
  - 未知：令牌生成算法、一次性消费判定点、令牌与内容是否绑定；闭包内部 stripped，伪代码未取到。
- **IHUI 现状（2026-11-24 复评，原文结论已过时）**：一次性票据**已落地**，不是"缺"——`apps\desktop\src-tauri\src\clipboard_grant.rs`（271 行，2026-11-23 B3-06）给出 `GrantStore::issue` / `consume` 与 `GrantVerdict`（`Unknown` / `AlreadyConsumed` / `Expired` / `Ok`），四条语义：① 一次性（同票第二次消费即 `AlreadyConsumed`，不给"再读一点"的缝隙）② 有时限（到点即过期，边界不算有效）③ 有界（未消费票据上限 `MAX_PENDING_GRANTS`，超出先丢最早到期的一张）④ 不认识就拒。票据不落仓、不进日志。**装车**：`lib.rs:3666` 的 `clipboard_issue_grant` 命令签发，`lib.rs:3677` 在读取前 `consume` 校验，非 `Ok` 即拒。剩余缺口：令牌与 `GetClipboardSequenceNumber`（剪贴板序号）**未绑定**——对照方的防重放/防串内容绑定语义仍属**未知**，未取证不臆造。
- **落点建议**：`C:\IHUI-AI\apps\desktop\src-tauri\src\lib.rs` 命令层远期补一次性读取令牌；令牌不落仓、不进日志。
- **超越轴**：fail-closed——二次消费即拒；可测性：令牌签发/消费/过期三态夹具。
- **最小复现范围**：读 / 写 / 取令牌三命令；令牌绑定与一次性判定在证据补齐前留未知桩。

### P3-07（C 档）Qoder 通知权限：WinRT 投影归一 granted / denied 两态

- **证据**：
  - 文件 `C:\Qoder CN\resources\bin\notification_permission.node`（1,537,536 字节）。
  - 字符串（rizin）：方法 `getNotificationPermissionStatus`；结局串 `granted` / `denied`；主体为大量 `Windows.UI.Notifications.IToast*` / `ToastNotificationManager*` WinRT 接口投影串；PDB 路径 `apps\desktop\native\notificationPermission\build\Release\notification_permission.pdb`。
    复核：`& rizin -qc "iz" "<node>"` 后按 `notif|permission|granted|denied` 过滤。
- **三档**：
  - 观察：单查询方法、两个结局字面量、WinRT Toast 接口族、PDB 工程路径。
  - 推断：权限态经 WinRT 查询后归一为 granted/denied 两态返回 JS 侧。
  - 未知：是否存在第三态（如 prompts / unsupported / 受限）、WinRT 调用失败归哪一态；本轮二进制内仅见 granted/denied 两串，未见第三态字面量。
- **IHUI 现状（2026-11-24 复评，原文结论已过时）**：桌面原生权限态查询**已落地**——`apps\desktop\src-tauri\src\notification_permission.rs`（Windows 读注册表 `NOTIFICATION_SETTINGS_PATH` 的 `NOC_GLOBAL_SETTING_TOASTS_ENABLED`，归一为 `allowed` / `denied` / `unjudged` **三态**；键缺失、读失败、非 Windows 一律 `unjudged` 并点名原因，**绝不默认 allowed**——原文明写"取不到就是 unjudged，不然会把没判当允许"），4 条单测钉住「缺值不冒充允许 / 异常值点名 / 非 Windows 未判定」。命令 `query_notification_permission` 已注册（`lib.rs:4894` / `:5846`）。剩余缺口两条：① Web 侧仍走浏览器 `Notification.permission`，`Grep` 全 `apps` 仅命中 `lib.rs`，**未见桌面命令的消费方**；② WinRT 投影实现本轮仍**未取**，现走注册表显式键（属等价替代，不是照搬）。
- **落点建议**：`C:\IHUI-AI\apps\desktop\src-tauri\src\notification_permission.rs`（远期，单命令回权限态）。
- **超越轴**：可测性——三态/未判定夹具；fail-closed：WinRT 查询失败落未判定，不得默认 granted。
- **最小复现范围**：单命令回权限态；失败未判定而非放行。

## 2. 本轮新候选编号表（P3-NN，滚动汇总）

| 编号 | 程序 | 主题 | 档位 | 落点（绝对路径） | 超越轴（一句话） |
|---|---|---|---|---|---|
| P3-01 | Trae | ALPC IPC 通道 + 外部 SD 入参 + 空参/建段失败显式报错 | B | `apps\desktop\src-tauri\src\ipc_channel.rs` | fail-closed：端口/缓冲失败显式错误码，不留半初始化句柄 |
| P3-02 | Trae | 作业级/VM 级双探测 SDK 同构 + 双判定值 + TLS 留痕 | A | `apps\desktop\src-tauri\src\sandbox_sdk.rs` | fail-closed + 可测性：探测带未判定态与来源 API 名 |
| P3-03 | WorkBuddy | 受限令牌 + 自定义 DACL + Job 执法 + 双路审计事件 | A | `apps\desktop\src-tauri\src\sandbox_sdk.rs` / `sandbox_metrics.rs` | fail-closed：未初始化/结构过小/空参显式拒建；不照搬恒真 IsSupported 桩 |
| P3-04 | WorkBuddy | no-orphans Job 两谓词 + IsProcessInJob 前置判活 + 指纹自报 | B | `apps\desktop\src-tauri\src\orphan_guard.rs` | 可测性：判活谓词独立注入；不重复造 Job 装配 |
| P3-05 | Qoder | 提交内存预判字段族（系统级已有，主进程级未判定） | B | `apps\desktop\src-tauri\src\system_memory.rs`（维持现状） | fail-closed：读数缺失 unjudged；主进程级证据不足不臆造 |
| P3-06 | Qoder | 剪贴板读/写/一次性令牌 | C | `apps\desktop\src-tauri\src\lib.rs` | fail-closed：令牌二次消费即拒，不落仓 |
| P3-07 | Qoder | 通知权限 WinRT 态查询 | C | `apps\desktop\src-tauri\src\notification_permission.rs` | 可测性 + fail-closed：查询失败落未判定，不默认 granted |

## 3. 未判定 / 未做（按程序，含原因）

- **Trae 大体积原生件（rizin + raw 符号/字符串级已取证，未进 Ghidra 全量伪代码）**：`ai_agent.dll` 271.48MB、`harness.dll` 253.65MB、`toolhost.dll` 95.31MB、`agent-tool-host.exe` 96.43MB、`libckg.dll` 37.83MB。§0.5 已从内嵌 Python/JS 源码串取到**函数级符号与 SQL 证据**：审批结局枚举（`queued/claimed/delivered/cancelled`、`pending/approved`）、命令级 `timeout:int=120` + `_DBW_PRECHECK_POLL_TIMEOUT` + 具名超时回执、断点游标（`reply_user_read_cursor`/`last_cursor_rowid`）、CKG schema（`SQLiteVecStorageV2`/`vector_to_entity`/`missing_vector_entity_count`/`StorageVersion`握手/`ON CONFLICT`幂等）。**仍未取得**的是这些符号对应的 Ghidra 级伪代码基本块（体量纪律：全量分析 >15 分钟无产出风险高，放弃）；对照 IHUI 判据后这些语义均已覆盖或形态不同（照搬即降级），故不补反编译。
- **Trae**：`aiep_sbox.dll` 仅见导出 `DetourFinishHelperProcess`；Detours 注入细节、ALPC 与命名管道链路拆分、SDDL/ACL 主体静态不可达，未动态验证。
- **Qoder**：`AoqClientSdk.dll` 14.01MB（RTC 引擎）、`sgsdk.dll` 7.01MB、`keytar.node` 凭据存储面未展开函数级；`.node` Rust/打包 stripped，方法名只能从字符串区取，闭包内部伪代码解析为 `function_not_found`。
- **WorkBuddy**：`sandbox_ffi.dll`（manager configure/initialize/start/stop + 可等待定时器 + WSASocket 复制面）、`tsbx.dll`（`LsInjectBridge` / `Tsbx_DumpHookSnapshot` + 命名管道等待 + 进程内存读写）函数级判据未逐条展开；`process-snapshot.node` 仅 darwin 两版，win32 无此件；跨进程内核命名 mutex、重启放弃阈值、manual 心跳周期、注册表写入原子性仍未知。
- **DeepSeek Harness**：原生面以 node-pty / koffi / sharp / sherpa-onnx / reflink / frame-forwarding 等第三方与运行时件为主，未见自研大型 C++ 业务 DLL；业务判定（审批结局、输出 drain、游标/lossy）上一轮已到 JS/TS 包面，本轮原生函数级未新增结论。
- **全部**：未运行目标程序做动态验证；凡并发交错、洪峰、规则执法强度、时序相关结论一律记推断，不进观察。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
