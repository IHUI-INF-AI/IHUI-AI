<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T4 — 原生件最底层取证(goal-b41,2026-10-31):PE 导出表 + solo-mcp 新大陆 + Ghidra libckg

> 席位:goal-b41(取证 + 落地席,只读取证;落地件见 §4)。
> 对照程序:`C:/Users/Administrator/AppData/Local/Programs/Trae CN/`(v1.107.1,与前席同装机)。
> 与 T1/T2 的分工:T2 走字符串/包路径层;本席下探到 **PE 结构层(导出表)** 与 **反编译层(Ghidra 12.1.4)**,并补扫 T2 §9-2 点名「跨席取证只遍历 modules/ 会漏」的 `byted-solo.builtin-mcp`。
> 结论三态:[观察] = 给出文件 + 复验命令,可复验;[推断] = 由观察合成;[未知] = 取不到。
> 复验命令统一形态:`node .ihui-agent/tmp/goal-b41/pe-exports.mjs <pe文件>`(纯 node 零依赖,解析 DOS/PE/COFF/OptionalHeader/DataDirectory[0]/节表 RVA 映射)。

## 1. PE 导出表面 [观察·全量 10 件]

### 1.1 libckg.dll(39,672,720 B,x64,导出 23 枚,TimeDateStamp=0)

| 导出符号组 | 枚数 | 判读 |
| --- | --- | --- |
| `sqlite3_vec_init` / `sqlite3_vec_numpy_init` / `sqlite3_vec_static_blobs_init` | 3 | **sqlite-vec 扩展入口实锤**:T2 §1.3 的 `-embedding_storage_type=sqlite_vec` 命令行常量在此落到符号级 —— 向量索引是 sqlite-vec 运行时扩展,以 c-shared 形式内嵌进 libckg |
| `authorizerTrampoline` / `commitHookTrampoline` / `rollbackHookTrampoline` / `updateHookTrampoline` / `preUpdateHookTrampoline` / `stepTrampoline` / `compareTrampoline` / `doneTrampoline` | 8 | **SQLite 作者器/钩子全家桶 trampoline**:CGO 回调桥 —— 加密库(sqlcipher 系)的 hook API 全部经 CGO trampoline 暴露 |
| `BP_GetInterface` / `BP_Initialize` / `BP_Shutdown` + `go_bp_ipc_client_on_message` | 4 | BP IPC 客户端接口族(BP = 字节内部 IPC 协议;宿主经 `BP_GetInterface` 拿接口表) |
| `go_ahanet_on_complete_bridge` / `go_ahanet_on_data_received_bridge` / `go_ahanet_on_response_started_bridge` + `go_on_connected` / `go_on_disconnected` / `go_on_message` | 6 | ahanet(字节网络层)CGO 桥,T2 §1.4 两侧对齐的实锤 |
| `authorizerTrampoline` 之外的 `_cgo_dummy_export` | 1 | CGO 构建产物标志导出 |

判读汇总:[观察] libckg = Go+CGO 单体,内嵌加密 SQLite + sqlite-vec 扩展 + ahanet 网络栈 + BP IPC 客户端;外部接口面只有 23 枚 C 导出,**CKG 的 gRPC 服务(Cfs* 21 消息)不占导出表** —— 走端口 50000 socket(T2 §1.1)。

### 1.2 sandbox 家族(4 件)[观察]

| 件 | 导出 | 关键证据 |
| --- | --- | --- |
| `sbox_sdk.dll`(2,292,112 B) | 9 枚 `SBoxSDK_{Init,InitV2,CreateSandbox,Action,IsSBoxSupported,GetSBoxInfo,FreeSBoxInfo,GetLastError,UnInit}` | 节表含 **`.detourc/.detourd/.fptable`** = Microsoft Detours 三件套节 |
| `vm_sdk.dll`(unified/) | 9 枚 `VMSDK_*`(与 SBoxSDK 逐一同构,`CreateProcess` 对位 `CreateSandbox`) | 同 Detours 节 —— **host/vm 双目标 = 同一 SDK 的两份构建**(T2 G8 的 mtc.target ∈ {host,vm}) |
| `aiep_ipc.dll` | 4 枚 `CreateIPCInterface{,2}` / `DestroyIPCInterface` / `InitIPCInterface2WithSecurityDescriptor` | IPC 面带 Windows 安全描述符初始化 |
| `aiep_vm.dll` / `aiep_sbox.dll` | 各 1 枚 `DetourFinishHelperProcess` | **Detours 注入模型实锤**:该导出是被注入进程加载 DLL 后执行 helper 逻辑的入口 —— 拦截 = 注入目标进程,不是外部 Job Object |

判读汇总:[观察] Trae sandbox = **Detours 系统调用注入拦截**(SDK 进程 + 被注入 DLL),本仓 proc_sandbox.py 的 Job Object 是限额模型,两者不同层(对齐判读见 T2 §8-G3,维持原判)。

### 1.3 其余 [观察]

- `sscronet.dll`(9,081,232 B):导出 **1125 枚命名符号**,C++ mangled(Cronet_* C 面 + `Cronet_FrontierConfig/KvPair/ServiceInfo/ServiceMessage` 类)—— 字节版 Chromium net;`BiStreamClient` 族(AddDelegate/CloseStream/SendData/IsStreamReady)是长连接双向流面。
- `browser-bridge.exe` / `trae-sandbox.exe` / `ctx-cli.exe`:**零导出**(EXE 无导出目录,正常);browser-bridge 行为面见 T2 §3。

## 2. byted-solo.builtin-mcp 新大陆(T2 §9-2 点名的漏扫件)[观察]

`resources/app/extensions/byted-solo.builtin-mcp/`(`package.json`:`name:"builtin-mcp"`, `displayName:"Solo Builtin MCP"`, `description:"Built-in MCP tools for iCube"`)。**未混淆、分文件 JS**,上轮只点名「22 枚工具」,本轮按子目录逐个下探:

| 子面 | 载体 | 判读 |
| --- | --- | --- |
| `record-replay/`(server 149,524 B + controller/runtime-resolver/chat-controller/permission-coordinator/config/platform-readiness/windows-runtime-client) | JS | **桌面操作录制→回放(RPA)面**:runtime-resolver + windows-runtime-client 双端解析,permission-coordinator 走 T2 §8-G5 已对齐的 scope/权限模型 |
| `core/record-replay-server.js`(149,524 B)+ `core/record-replay-launcher.js` | JS | 录制回放的服务端 + 启动器(与 record-replay/ 子目录配套) |
| `core/window-capture.js`(54,847 B) | JS | WGC 窗口捕获(上轮已点名) |
| `connectors/{mail,notes,calendar,reminders,contacts}.js`(20,597/17,330/14,617/12,478/11,060 B) | JS | **PIM 五连接器**:邮件/笔记/日历/提醒/联系人 —— 个人信息面集成,依赖系统账号体系 |
| `chronicle/{registration,legacy-skill-cleanup,server}.js` | JS | **技能编年史**:技能注册 + 服务 + **旧技能清理**(技能物的生命周期治理面) |
| `core/builtin-skill-materializer.js`(10,766 B) | JS | 技能物化器(T2 §9-2 已点名,本轮定位到文件) |
| `core/{tcc-checker,permission-guide-lock,computer-use-skill-watcher}.js` | JS | TCC 权限检查(macOS TCC 语义的跨平台移植)/ 权限引导锁 / computer-use 技能监视 |
| `locked-use/{installer-bridge,telemetry}.js` | JS | 锁定使用:安装桥 + 遥测 |
| `docs/computer-use-enablement.md` | 官方文档 | **五态命名状态机**:`mainAvailable`(Dynamic Config 硬开关)∧ `pluginInstalled` ∧ `pluginEnabled` → `effectiveEnabled`;`marketplaceAvailable` 只控 Settings 可见性不控生效;IDE 判 `enable===true`、Solo Lite 判 `enable!==false`;遗留键 `AI.ide.computerUse.enable` / `AI.soloLite.computerUse.enable` 只作一次性迁移信号,迁移成功即清除;Linux 不支持;`mainAvailable` 转 false 时拆 provider 但**不重写用户持久化的 pluginEnabled 偏好**(状态保留纪律) |

判读汇总:[观察] computer-use 的**状态机五态 + 双产品差异化 + 遗留键迁移语义**是可直接吸收的规格(本仓桌面接管若做启用面,按此形状);record-replay/PIM connectors 属壳层产品能力,本仓对位物形态不同(Agent 平台 vs 桌面 IDE),登记不落地。

## 3. libckg.dll Ghidra 反编译层 [观察]

> 装机:Ghidra 12.1.4(`D:/DevEnv/ghidra_12.1.4`)+ headless(`analyzeHeadless.bat`);脚本 `ckg_surface.java`(导出/函数分布/contextfs 反编译三段)。
> 实测:导入+自动分析 **901 秒**(x86 Constant Reference Analyzer 148s / Stack 149s / Rust String Analyzer 13s / Go strings 150,283 条);PyGhidra 不可用(headless 未启 PyGhidra,报 `GhidraScriptLoadException: Ghidra was not started with PyGhidra`),改 Java 脚本(自动编译)。
> 产物:`D:/DevEnv/Temp/ihui-scratch/goal-b41-ghidra/{ckg_exports,ckg_func_summary,ckg_cfs_funcs,ckg_cfs_decompiled.c}`(夹具目录,§15b scratch)。

### 3.1 定量:T3 尾注的「rea load 预算天花板」被 headless 路线突破 [观察]

| 指标 | rea analyze(5.5min 预算,T3 尾注) | Ghidra headless(本席) |
| --- | --- | --- |
| libckg 39.6MB | `provider_timeout`(op=list_documents) | **导入+全量分析成功**,`ckg_proj` 项目落盘 |
| 函数分辨率 | 17,319 节点(JavaScriptApplicationGraph,前端资产混扫) | **35,908 函数**(原生 PE 纯扫) |

### 3.2 contextfs 组件完整函数面(155 函数,反编译级)[观察·本席最硬一格]

`ide/ckg/codekg/components/contextfs.*` 共 **155 函数**(Ghidra RTTI 恢复)。结构事实(T2 字符串层不可见):

1. **六种 ChildProvider**(挂载点后端):`Composite` / `Disk` / `Mem` / `Memory` / `Remote` / `Static`,每个都实现 `GetChild` + `ListChildren` —— **ContextFS 是「一棵组合挂载树 + 多后端」**:同一棵虚拟路径树下可同时挂磁盘目录、内存盘、远程盘与静态节点。
2. **双 Fs 实现**:`MemFs` 与 `RemoteFs` 各自实现全套 `Mkdir/Read/ReadDir/Remove/RemoveAll/Rename/Stat/Write`(Go 接口 `fs.FS` 超集,含写面)——T2 §8-G2 的「先不做写」对本仓成立,对侧**写面是全的**。
3. **协议修正**:分发出口为 `main.decodeJSONRPCParams[...]` / `main.replyInvoke[...]` —— 端口 50000 的服务协议是 **JSON-RPC**(T2 §1.4 称 gRPC 服务面,.proto 消息类型 91 枚是内部域模型;wire 协议按反编译事实更正为 JSON-RPC 分发)。
4. **ORM 层**:类型 equality 栈泄漏 gorm struct tag 逐字 —— `gorm:"primaryKey;autoIncrement;column:id"` / `EntityID string gorm:"type:varchar(1023);not_null;column:entityID;index"` / `UriID int` —— 存储栈 = **Go + gorm + (sqlcipher 系)加密 sqlite**(T2 §1.3 的 go-sqlcipher 结论之上加 gorm 一层)。
5. **鉴权**:`WithCfsAuth` / `CfsAuthFromContext` —— CFS 读写带 **context.Context 级凭据注入**;`expandHome` 表明挂载配置支持 `~` 展开。
6. **样本**(完整反编译带原始源码行号):
   ```
   Golang source: C:/67332/ckg/codekg/components/contextfs/memfs.go:78
   Golang signature [from_rtti_method]: func (*MemFs) Read(context.Context, string) ([]uint8, error)
   ```
   —— Ghidra Go 分析器从 RTTI 恢复出**原始源文件路径与行号**(memfs.go:78),源码级锚点直接可引。

### 3.3 与本仓 knowledge_fs 的对位读法 [推断]

对侧 = 多后端组合挂载树(六 Provider)+ 全写面 + context 级凭据;本仓 knowledge_fs = 单后端投影(codebase_chunks)只读 + 逐用户归属隔离(fail-closed)。两轴刻意不对齐:①写面(本仓索引写入方只有索引器);②凭据模型(对侧单租户 context 注入 vs 本仓 internal_user_id + api 侧 _ownerScope)。剩余差距(多后端挂载)登记不落地 —— 本仓的「多后端」等价物是 knowledge-rag / knowledge-graph / knowledge-fs 三族独立出口,不合树。

## 4. 对撞与落地(goal-b41 两件,先对齐再超越)[观察]

| 缺口 | 对位物 | 落点 | 超越轴 |
| --- | --- | --- | --- |
| G2 ContextFS(T2 §8-G2) | `apps/ai-service/app/services/knowledge_fs.py` + `apps/ai-service/app/api/v1/knowledge_fs.py`(挂 `/api/v1/ai/knowledge-fs`)+ api 侧 `GET /repo/:repoId/chunks`·`GET /repo/:repoId/file`(v1-codebase-search.ts + open-capability-registry 登记 codebase:read) | codebase_chunks 三层切片 → `/repo/<repoId>/<file>#<symbol>` 只读虚拟路径;list/read/stat/search 四出口;身份头/检索判据单源复用 codebase_indexer(§0.6) | ①**可证明的只读**(写面刻意不存在,对侧 Cfs 有 write/mkdir/rename/remove);②**逐用户归属隔离**(对侧取证未证到);③**三态诚实**(identity/missing/upstream/empty_ambiguous 各给显式状态) |
| Qoder 导入 4 维(goal-b40 登记) | `apps/ai-service/app/services/external_runtime_import.py` | memory→`agent_longterm_memory.bulk_import_from_extract`(现成出口);automations→`task_scheduler.add_task`(确定性幂等键 `ext-<source>-<sha1[:12]>`,重复导入 duplicated 跳过);capabilities→只声明不静默注册;sessions→显式让位 relay 会话腿 | ①**每维一条真出口且不复制写入判据**;②**幂等**(同 bundle 重复导入零副作用);③**让位显式化**(sessions 维归属 relay 腿,不代写) |

测试:两文件合计 **32/32 绿**(`pnpm check:pytest -- tests/test_knowledge_fs.py tests/test_external_runtime_import.py`,全程 monkeypatch 不连库不连网,AGENTS.md §5)。

## 5. 未取到的面(如实)[未知]

1. `harness.dll`(248MB)/ `ai_agent.dll`(282MB)/ `toolhost.dll`(95MB)未逐函数反编译 —— 单件导入+分析远超本机时间盒(39.6MB 已需 901s);字符串层事实(T1 toolhost 120 命令 / harness 1437 源码路径)维持前席结论。headless 路线对它们**可行但未跑**(同一条 Ghidra 流程,时间盒外)。
2. libckg 的 `Cfs*` 消息**字段级** wire schema 未取到(消息结构域模型在反编译里有类型栈,gorm tag 已恢复 EntityID/UriID 等列;JSON-RPC 的 per-method 参数 schema 需逐方法反编译,时间盒外)。
3. Qoder 主进程(app.asar 之外的壳)字符串混淆未破,维持 goal-b39 附录的留白口径。
4. contextfs 六 Provider 的**挂载来源配置面**(DefaultConfig 的磁盘路径/远程端点形状)反编译样本已入 `ckg_cfs_decompiled.c` 但未逐字段整理。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
