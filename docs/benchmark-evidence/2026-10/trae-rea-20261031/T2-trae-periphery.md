<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T2 席报告 — Trae CN 3.4.12 的 agent 外围能力载体(ckg / sandbox / browser-bridge / ai-completion / 相关扩展 / 契约面)

> 认领@2026-10-31/T2(取证席,只读)
> 取证根:`C:/Users/Administrator/AppData/Local/Programs/Trae CN/resources/app/`(VS Code fork,解包非 asar,可直接读)
> 射程纪律:`modules/ai-agent/` = **T1 席射程,本席一字未碰**(只在证明"进程关系"时引用 shell 侧符号名,不引用其内部实现)。
> 每条结论标 [观察]/[推断]/[未知];[观察] 带可复验定位(路径 + 字节偏移或可重跑命令)。
> 红线执行:未粘任何 Trae/字节专有源码正文;只记符号名、键名、枚举值、数量、路径、字节数;未读 `AppData/Roaming/Trae CN/`、未读任何 `*.dat`/token/cookie/sqlite 正文。
> 本席取证工具(可复验):`.ihui-agent/tmp/trae-rea/s2/bin-strings.mjs`(二进制 ASCII 抽取 + 正则过滤)、`ctx.mjs`(大文件定点取样,按字节偏移)、`enums2.mjs`(压缩 bundle 枚举块还原)。
> **所有计数为 2026-10-31 现读值**(§0.1);文中每枚数字都在 §10 给了重跑命令。

---

## 0. 产品身份与装机形态 [观察]

- `product.json`(79,538 B)顶层键 **82 枚**。锚点键:`nameLong=Trae CN`、`applicationName`/`dataFolderName=.trae-cn`、`peerDataFolderNames=[".trae"]`、`urlProtocol=trae-cn`、`win32AppUserModelId=ByteDance.TraeCN`、`vscodeVersion=1.107.1`、`version=1.107.1`、`quality=stable`、`target=user`、`traeVersionCode=20250325`、`packageType=TRAE_CN`、`brandName=TRAE`、`provider=Yinli`、`providerCode=cn`、`deeplinkHost=trae.ai-ide`、`migration.protocol=v1`、`serverApplicationName=trae-cn-server`(远程 server)、`serverDataFolderName=.trae-cn-server`。
- `checksums` 是**逐文件哈希清单**(键形如 `vs/base/parts/sandbox/electron-browser/preload.js`,值为 43 字符 base64/SHA-256 短形)—— 壳层自带文件级完整性面。
- 三套内置扩展清单并存:`builtInExtensions`(3 枚,含 `sha256` + `vsix` 路径,全是微软 js-debug 系)、`traeBuiltinExtensions`(**14 条条目**)、`soloBuiltinExtensions`(3 条)。`traeBuiltinExtensions` id 清单:`cloudide.icube-devtool-ports`、`byted-icube.go-enhance`、`byted-icube.python-enhance`、`byted-icube.java-helper`、`byted-icube.node-helper`、`byted-icube.integrations-extended`、`cloudide.icube-remote-ssh`、`cloudide.dsl-agent-logs`、`byted-icube.icube-go-coding-experience-helper`、`byted-solo.builtin-mcp`、`git-ai.git-ai-vscode`、`byted-icube.trae-tob-git-ai-vscode`、`cloudide.icube-im-bridge`、`byted-solo.builtin-mcp`(末两枚重复登记同一 id ⇒ **装机清单存在同 id 双条目**,[观察] 非笔误,现读 14 条里 `byted-solo.builtin-mcp` 出现 2 次)。
- **关键:第三方 publisher 的扩展被当 builtin 发**。`git-ai.git-ai-vscode`(publisher=`git-ai`,`extensionPublisherOrgs=["microsoft"]`、`trustedExtensionPublishers=["microsoft","github"]` 均不含 `git-ai`)仍在 `traeBuiltinExtensions` 里 ⇒ 信任清单与 builtin 装载清单**不是同一把闸**([观察];这是安全面事实,不是建议)。
- `extensions/` 一级目录实测 **109 枚**。`modules/` 实测 4 枚:`ai-agent`(702 MB,T1)、`ckg`(41 MB)、`sandbox`(13 MB)、`browser-bridge`(2 MB)。`bin/` = `ffmpeg.exe` 7,384,464 B + `ffprobe.exe` 7,280,016 B + `libwinpthread-1.dll`。`native/browser-preview/win32-x64/` = `browser-preview.node` 88,976 B + `browser-preview-capture.exe` 76,688 B(IDE 内置浏览器预览的截图腿,与 §3 的 browser-bridge 是两套东西)。
- `iCubeApp`(18,918 B JSON 字符串)按渠道分档存鉴权 appid:`authConfig.TRAE.{stable,beta,alpha,dev,local}`、`authConfig.SOLO.*`;`__iCube_app_tenant_overrides.bytedance.hubConfig` 另有 `appId{TRAE,SOLO}/fpId/serviceId/appKey`。`bootConfig` 存 `feedbackMail`、`defaultGitEmail`、`condition.website/bytedanceLoginPage`、`iCube.normal=https://api.trae.com.cn`、`market.{trae,bytedance}`。[观察] 只记键名结构,值除公开域名外不复现。

---

## 1. `modules/ckg/` —— Code Knowledge Graph:独立原生服务,不是索引库 [观察·重点]

### 1.1 载体形态

整目录只有 **7 个文件**(`find . -type f | wc -l` = 7):

| 文件 | 字节 | 性质 |
|---|---|---|
| `binary/libckg.dll` | **39,672,720** | 全部实现 |
| `binary/libstdc++-6.dll` | 2,416,064 | CGO/C++ 运行库 |
| `binary/libgcc_s_seh-1.dll` | 165,072 | 同上 |
| `binary/libwinpthread-1.dll` | 74,320 | 同上 |
| `start.bat` / `start.sh` | 3,196 / 2,971 | 启动器(含完整命令行) |
| `meta.json` | 303 | 模块注册清单 |

- **实现语言 = Go + CGO,不是 Rust**。硬证据:`libckg.dll` 内含 Go 模块伪版本 `v0.0.0-20260922072231-417a6ec81284+dirty`、构建路径 `C:/67332/ckg/codekg/protocol/codekg.pb.go`、内部包路径族 `ide/ckg/codekg/*`、gRPC 符号 `*grpc.ServiceDesc` / `UnimplementedCodeKGServer` / `"mustEmbedUnimplementedCodeKGServer`。`RUST_LOG=INFO`(`start.bat` 里设)是**残留环境变量**,不代表本体语言([推断],证据:同文件里无任何 rustc 路径,而 Go 运行时符号成组出现)。
- **服务名/协议**:`meta.json` = `{name:"ckg",version:"1.0.0",entry:"start.sh",entry_windows:"start.bat",connections:[{socket:{port:50000}}],protocol:[],env:{LD_LIBRARY_PATH:"./binary"},contributes:{}}` ⇒ **TCP socket 端口 50000 是声明式登记的**,shell 侧按 `connections` 注入 `%PORT0%`(命令行 `-port=%PORT0%`)。
- **`start.bat`/`start.sh` 引用的 `binary/ckg_server_windows_x64.exe` 与 `binary/ckg_server` 在本机装机里不存在**(§1.1 表即全量)。[观察] 现读只有 DLL。[推断] 出厂形态改为 `c-shared` 构建的 DLL 由宿主 FFI 载入 —— 同一 DLL 内确实存在 `ide/ckg/codekg/util/ffi` 包路径,且入口包 `ide/ckg/codekg/cmd/server` 也在 DLL 内,两者同面 ⇒ exe 与 dll 是同一份 Go 代码的两种产物,本机只发了 dll。
- 命令行(逐字取自 `start.bat`,非源码):`-port -ide_version -version_code=2 -storage_path "<ICUBE_MODULAR_DATA_DIR>\ckg_server" -local_embedding -embedding_storage_type=sqlite_vec -app_id -limit_cpu=1 -source_product=native_ide [--ideType=]`。**`-local_embedding` 与 `-embedding_storage_type=sqlite_vec` 是命令行常量** ⇒ 向量化在本地跑、向量索引与库共址(sqlite-vec)。`-limit_cpu=1` 是它给后台索引留的 CPU 预算。
- 启动器还按环境把 `AI_NATIVE_ENV` 分成 8 档:`desktop / desktop_ssh / plugin / plugin_remote / plugin_boe / cloudide / practice / marscode_boe / marscode_boei18n`([观察] 分支体逐条可读);并固定 `DB_PATH=<.icube>/ai-chat/database.db`、`FILE_BASE_DIR=<.icube>/ai-chat/snapshot`、`ICUBE_MODULAR_DATA_DIR=%USERPROFILE%\.icube`(用户态,本席未进入)。

### 1.2 内部组件构成(包路径即组件清单)[观察]

`libckg.dll` 中 `ide/ckg/...` 包路径共 30+ 枚,组件面(取全):
`components/{env, tasks, periodic, pipeline, pipeline_steps, pipeline_runner, pipeline_context, contextfs, ckg_config, ckg_metrics, qps_limiter, file_system, data_manager, data_storage, knowledgebase, query_service, ignore_service, splitter/model, splitter/common}` + `util/{ffi, ipc, config, ahanet, ahanet/transport}` + `model` + `protocol` + `config/domain` + `clients/ts`。
[推断] `clients/ts` = tree-sitter 客户端(`splitter` = 切片器一族);`ahanet` 是字节内部网络层(IDE 侧同名符号见 §1.4,两侧对齐)。
配置三件套:`*model.CodeKGABConfig`(A/B)、`*model.CodeKGTCCConfig`(配置中心)、`GetCodeKGFeaturesConfig` ⇒ **索引行为本身是被 AB/特性开关驱动的**([观察] 符号存在;具体开关名在 DLL 常量池未逐枚取名,[未知])。

### 1.3 它索引什么、怎么算增量 [观察·核心]

- **文件识别**:`github.com/go-enry/go-enry/v2`(GitHub linguist 的 Go 移植)⇒ 语言/产物判定走 enry;`github.com/denormal/go-gitignore` ⇒ 独立 `ignore_service` 尊重 .gitignore;`github.com/cyphar/filepath-securejoin` ⇒ 越界路径防护;`github.com/go-git/go-git/v5` ⇒ 直接读仓库对象(不 shell out git)。
- **增量算法 = Merkle trie(不是 mtime,不是全量重扫)**:符号 `*merkletrie.Iter`、`*merkletrie.Action`、`*merkletrie.Change`、`*merkletrie.doubleIter`,配 `allDirty` / `markShardDirty` / `markAllShardsDirty` / `markLongShardDirty` / `markShortShardDirty` / `tableShardDirty` / `longTableShardDirty` / `shortTableShardDirty` / `initEmbeddingSearchCache`。
  ⇒ **按 shard 分长/短两表打标脏,只重算脏分片**;这是"增量"的真身。哈希件 `hash/fnv`、`hash/crc32`、`crypto/sha1`、`pjbgf/sha1cd`(SHA-1 collision detection,git 对象哈希专用)。
- **编辑事件驱动的增量**:IDE 侧 RPC 有 `document_action`,其 kind 枚举逐字 = `document_create / document_change / document_delete / document_select`,另有 `cursor_move`([观察] `workbench.desktop.main.js` 内枚举 `dj` 与方法表 `pb.METHODS`,见 §1.4)。⇒ **落盘前、选中时、光标移动时都在喂索引**,不是等 fs watch。
- **向量化**:`EmbeddingWorker`(`*tasks.EmbeddingWorker`)、`batchEmbeddingMgr`、`EmbeddingStorage`/`embeddingStorages`/`GetLocalEmbeddingStorage`/`IsLocalEmbeddingBuilding`、`QueryByEmbedding`、`EmbeddingSearch`/`embeddingSearchHelper`、`GetQueryEmbeddingModels`/`GetProjectEmbeddingType`/`GetVectorEmbeddingModels` ⇒ **按项目选 embedding 模型、查询侧与索引侧模型可不同**。
- **存储**:SQLCipher 而非明文 sqlite —— `github.com/mutecomm/go-sqlcipher/v4`;库文件名模板在 DLL 里以格式串形式出现:`%s_%x_%s_codekg.db`([观察] 同串紧邻 `error create alias`、`STATUS       : %s`)⇒ **每项目一枚加密 sqlite 落在 `-storage_path`**;另有 `github.com/klauspost/compress`、`github.com/golang/snappy`、`pierrec/lz4/v4`(压缩)、`hashicorp/golang-lru/v2`(缓存)。[未知] 表结构(未进入 `<.icube>\ckg_server`,红线)。

### 1.4 查询接口形态:一个 gRPC 服务 + 一层 shell RPC 封装 [观察]

- **gRPC 面(服务 `protocol.CodeKGServer`,proto 文件 `codekg.proto`)由消息类型反推**:`*protocol.` 开头的类型 **91 枚**。分组:
  - 生命周期/索引:`Init/Setup Request+Response`、`CancelIndex`、`DeleteIndex`、`GetBuildStatusRequest`、`RefreshTokenRequest`、`*protocol.BuildStatus`、`ProjectBuildStatus`、`DocumentBuildStatus`、`DocumentIndexStatus`、`LoginStatus`、`SetPrivacyModeRequest`、`*protocol.TeaConfigInfo`(埋点配置)。
  - 代码检索:`SearchCKGDBRequest/Response`、`RetrieveEntityRequest`、`RerankSnippetRequest/Response`、`GetFileOutlineRequest`、`ImportAnalysisRequest`/`ImportAnalysisResult`、`*protocol.RecallType`、`EmbeddingSearchItem`、`SnippetWithScore`。
  - 代码实体模型:`Symbol/Entity/EntityType/Member/Reference/RefTypeInfo/RefClassInfo/MethodInfo/Variable/TextVariable/FileVariable/ClassVariable/MethodVariable/FolderVariable/CodeChunkVariable/FileTopLevelVariable/ClassTopLevelVariable/MethodVariable/Project/VirtualFolder?` 见 `VirtualProject`、`Snippet/SnippetType/CodeSnippet/Document/DocumentRequest/Response/DocChunk/Chunk`、`CurrentEditorInfo/CurrentEditorEntity/CurrentEditorVariable/SelectedMethodInfo/SelectedClassInfo`、`UsefulFileInfo`、`Range`、`CursorMoveRequest`、`UserInfo`。
  - **ContextFS(虚拟文件系统)腿:21 枚 `Cfs*` 消息** —— `CfsMountInfo/CfsFileInfo/CfsReadRequest+Response/CfsWriteRequest+Response/CfsStatRequest+Response/CfsSearchRequest+Response/CfsSearchResult/CfsListDirRequest+Response/CfsMkdirRequest/CfsRenameRequest/CfsRemoveRequest/CfsResolveRequest+Response/CfsGenericResponse/CfsHealthResponse/CfsListMountsResponse`。
    ⇒ 这是本席认为**最被低估的一格**:CKG 不只"查代码",它把合成出来的知识**挂载成一套可按路径 read/write/mkdir/rename/remove/search/resolve/stat 的文件系统**,agent 用文件语义就能拿到索引结果([观察] 消息类型齐备;[未知] 各字段,未进 SDK 头文件)。
- **shell 侧只暴露 12 个方法**(枚举 `pb`,SERVER_NAME=`"ckg"`,定位 `workbench.desktop.main.js` 约 @15.99 MB 处):
  `create / stop / init / setup / set_indexing_enabled / refresh_token / get_build_status / document_action / cancel_index / delete_index / cursor_move / is_ckg_enabled_for_non_workspace_scenario`。
  调用形态逐字:`(await this.a.getDefaultClient()).request({service: pb.SERVER_NAME, method: pb.METHODS.Init, data: e, timeout: 0})` ⇒ **统一 `{service,method,data,timeout}` 信封 + 每模块一个默认客户端**;同一套封装同时服务 `ai-agent`(`getAiAgentRpcClient()`)与 `ckg`,并可切远程 SSH:`createRemoteAhaRpcClient(channel)` / `createLocalAhaRpcClient` / `getAhaIpcChannel` / `aha_electron`([观察] 标识符频次:AhaRpcClient 14、ahaIpc 7、getAhaIpcConnection 6)。
- **`init` 的入参即索引边界**(逐字段名,取自调用点):`{project_ids, projects, ignore_file_limit, workspace_id, global_storage_path, device_id, first_workspace_path, need_index, ckg_indexing_enabled, log_path, ppe_env_name, user_id, token, init, limit}`。⇒ **device_id + workspace_id + 多 project 一次喂入**;`ignore_file_limit` 是可被绕过的软闸。
- **状态词汇(CKG 侧与 UI 侧是两套)**:
  - 服务返回码枚举 `fg`:`SUCCEED=0, UNKNOWN_ERROR=1, PANIC=100, USER_ID_IS_MISSING=101, FILE_LIMIT_EXCEED=102, INVALID_TOKEN=103`(数值分段 1xx = 业务拒绝,[观察])。
  - 构建态枚举 `VJt`:`Building=0, Finished=1`。
  - UI 侧枚举 `wd`:`to_build_ckg / building / error / success / built`(@13438634)。
  - `get_build_status` 回包字段:`{status:{<projectId>:{status,progress,exceeded_limit,file_limit,actual_total_files}}, storage_size}` ⇒ **进度按项目分片加权,超限是逐项目显式字段**,UI 由 `exceeded_limit===true` 直接降级成"要不要建"的按钮态。
  - 重启判定:`NEED_REFRESH_CKG_KEY` / `NEED_ENABLE_LIMIT_INDEX_CKG_KEY` 两把持久化布尔(键名逐字)决定"配置变了要不要重启 ckg"。

---

## 2. `modules/sandbox/` —— 系统调用级拦截,不是 Job Object [观察·重点]

### 2.1 载体分层

16 个文件,三组并存([观察] 全量列在 §10):

| 组 | 件 | 角色 |
|---|---|---|
| 宿主(Rust) | `trae-sandbox.exe` 1,265,040 | 父进程/装载器:内含 `tokio-1.48.0`、`library\std\src\sys\sync\rwlock\futex.rs`、`TRAE_SANDBOX_CLI_PATH`、`_ensure_sdk_loaded: failed to lock sdk mutex`、`CreateProcessFailed`、`spawn_blocking wait_for_process failed` ⇒ **动态装载 SDK + 互斥锁保护 + 子进程等待** |
| 注入侧(C/C++) | `sbox_sdk.dll` 2,292,112、`unified/vm_sdk.dll` 2,557,328 | host 侧 SDK:`CreateProcessWithInject`、`TryLaunchDiagProcess`、`WaitSubProcessInit`、`InitializeSdk`、`CheckAndNormalizeSBoxDir`、`PrintPermission`、`GetCurrExeSignedName` |
| 被注入 DLL | `x64/aiep_sbox.dll` 757,136 / `x86/aiep_sbox.dll` 575,888 / `unified/x64/aiep_vm.dll` 916,880 / `unified/x86/aiep_vm.dll` 698,256;`aiep_ipc.dll` ×4(577,424/435,088 两档);`run_helper.exe` ×4(682,384/545,680) | **`aiep_` = 注入进子进程的策略执行体**;`unified/` 是与非 unified 并存的第二后端;`x64` 与 `x86` 双架构同发 |
| 垫片 | `api-ms-win-core-synch-l1-2-0.dll` 15,760 | 旧 Windows 兼容 |

- **两后端的真实差别 = 拦截面宽度**([观察],RTTI 串现读):
  - `x64/aiep_sbox.dll` 内监听接口 **5 枚**:`IKernelBaseApiListener@SBoxCore`、`INtdllApiListener@SBoxCore`、`IDnsapiApiListener@SBoxCore`、`IWs2_32ApiListener@SBoxCore`、`IAdvapi32ApiListener@SBoxCore`。
  - `unified/x64/aiep_vm.dll` 内 **8 枚**:上述 5 枚 **+ `IUser32ApiListener@SBoxCore` + `IGdiApiListener@SBoxCore` + `IWin32uApiListener@SBoxCore`**。
  ⇒ unified(vm)后端多出**窗口站/桌面/GDI 图形面**的拦截;非 unified 只封 内核+文件+进程+网络+DNS+注册表。**不是 Job Object、不是容器、不是受限令牌的单一把戏,是 inline hook 到 ntdll**。
- **被 hook 的具体原语(从 `aiep_sbox.dll` 符号池取)**:`NtCreateFile / NtOpenFile / NtSetInformationFile / NtDeleteFile / NtWriteFile / NtQueryInformationFile / NtQueryDirectoryFile / NtQueryFullAttributesFile / NtClose / NtQueryObject / NtOpenEvent / NtCreateEvent / NtOpenSymbolicLinkObject / NtQuerySymbolicLinkObject / NtOpenSection / NtMapViewOfSection / NtSetSecurityObject / NtCompareObjects / NtCreateProcess / NtCreateProcessEx / NtCreateUserProcess / NtTerminateProcess / NtResumeThread / NtOpenThread / NtOpenProcess / NtOpenProcessToken / NtQueryInformationToken / NtQueryInformationProcess`,配 `CreateProcessWithTokenW / CreateProcessWithLogonW / CreateProcessW/A / VirtualAlloc / VirtualAllocEx / RtlGetAppContainerNamedObjectPath / RtlAddAccessAllowedAceEx / RtlCreateEnvironmentEx / RtlSetEnvironmentVar / RtlImageNtHeader / RtlSubAuthorityCountSid / RtlCaptureContext / RtlLookupFunctionEntry / GetThreadContext / SetThreadContext / LdrRegisterDllNotification / LdrUnregisterDllNotification`。
  ⇒ 三条硬结论:[观察] ① **符号链接/section 映射单独被拦**(`NtOpenSymbolicLinkObject`+`NtQuerySymbolicLinkObject`+`NtOpenSection`+`NtMapViewOfSection`)= 防 reparse-point/junction 穿透与注入镜像;`NtCompareObjects` = 防句柄替换;② `LdrRegisterDllNotification` = **对"后来加载的 DLL"补挂 hook**,不是一次性快照;③ `RtlGetAppContainerNamedObjectPath` + `RtlAddAccessAllowedAceEx` 说明**确实建了 AppContainer/SID + ACL 条目**,即 OS 强制 + hook 执行**两层叠加**,不是二选一。
- **策略模型**:`sbox_sdk.dll`/`vm_sdk.dll` 内配置键与计数器名([观察] 逐字):`default_file_permission`、`default_rules_type`、`file_rules`/`net_rules`/`process_rules`、`network_allow`、`network_deny`、`directly_delete_rules_count`、`rules_count`/`file_rules_count`/`net_rules_count`/`process_rules_count`/`sbox_rules_large_cnt`/`vm_rules_large_cnt`、`sandbox_parse_rules`/`vm_parse_rules`/`vm_parse_net_rules`/`vm_parse_rules_test`、`UpdateConfig … ruleCount={}, fileSizeSkipRedirect={}`、`risk_rule_id`、`risk_policy_version`。
  ⇒ 规则是**热更新的一等对象**,带 `risk_rule_id` 与 `risk_policy_version`(可追溯到"哪版策略的哪条规则");`regex_error(error_escape)` 出现在同池 ⇒ **规则正文是正则**;`fileSizeSkipRedirect` ⇒ 大文件跳过重定向(性能阀)。
- **审计与逃逸面(计数即遥测)**:`audit_file`/`audit_net`、`sandbox_block_info`/`vm_block_info`/`sandbox_block_info_item`、`block_counts`、`block_file_counts`、`block_net_counts`、`block_report_count`、`block_process_drop_count`、`block_sandbox_drop_count`、`block_priority_report_count`、`block_priority_process_drop_count`、`block_priority_sandbox_drop_count`、`block_process_risk_reserved_drop_count`、`block_sandbox_risk_reserved_drop_count`、`block_process_duplicate_count`、`block_sandbox_duplicate_count`、`block_risk_unknown_count`、`proc_kill_audit_counts`、`file_black_deny_counts`、`net_audit_counts`、`file_audit_counts`、`marker_filtering`、`cross_instance_wnd_block_counts`、`proc_enum_filtered_counts`。
  ⇒ 值得抄的是**分桶粒度**:report(只报不拦)/ process_drop / sandbox_drop / priority_* / risk_reserved / duplicate / **risk_unknown** 各一枚计数器;`cross_instance_wnd_block_counts` 说明它防**跨窗口站句柄**；`sandbox_behavior_report::*::AddKnownFolder` + `git_index_lock/git_config_lock/git_head_lock/git_packed_refs_lock/git_refs_lock/microsoft_tokenbroker_cache` ⇒ **已知文件夹白名单 + 显式登记"必须可写的 git 锁文件与 token broker 缓存"**(否则 git 在沙箱里跑不动)。这是"沙箱 × 版本控制"的硬边界,本席认为是设计成熟度最高的证据。
- **签名为策略主体**:`GetCurrExeSignedName` ⇒ 拦截决策读**被拦进程自己的 Authenticode 签名主体名**,不是路径;`risk_policy_version` 配 `blocked` / `permission denied` / `unknown token` 三态([观察] 同池出现)。`aiep_sbox.dll` 内嵌清单 `<requestedPrivileges>` ⇒ manifest 声明 asInvoker 级(未提权)。
- **本席不判"逃逸方向"为结论**:上面 ①②③ 是它的**防逃逸布防点**;真正做红队验证需要动态跑,本席只读 ⇒ [未知] 实际绕过可行性。

### 2.2 与命令执行工具怎么接 [观察]

- **企业策略远程下发**,shell 侧逐字:`updateEnterpriseSandboxConfig(e?.sandbox_policies)`、`updateEnterpriseBlacklistCommands(e?.config_info.blacklist_commands)`、`updateMcpWhitelistConfig(e?.mcp_whitelist_config)`、`this.g = e?.security_rules ?? []`(与 `repo_urls` 同一份响应,按 git 仓库维度下发);策略加载态另有枚举 `a_`(@5337477,10 值):`serverAccess / serverForbidden / serverForbiddenPro / serverForbiddenSoloCode / access / forbidden / waitingList / serverCNForbidden / soloBuilder / error`。
- **沙箱类型可由服务端指定、也可由本地调试键强扭**:配置键 `ai_assistant.request.forceSandboxType`(string,default "")被塞成请求头 `x-trae-force-sandbox-type`([观察] 同处另有 `ai_assistant.request.env/agentEnv/envLane` → `x-tt-env`/`x-trae-agent-env`/`x-env-lane`)⇒ **sandbox 档位是会话属性,不是进程属性**。
- **落点是终端而不是自造 exec**:`sandboxStoragePath / sandboxConfigName / sandboxLogDir` 三参随 `terminal` 创建传入,产 `aiTerminalOptions`;另有 `aiTerminalOptions:{isReadonlyAgentTerminal:!0, agentType:"toolhost"}`。⇒ **agent 命令走 VS Code 集成终端(ptyHost)那条既有管道,沙箱按终端实例配置**;`GIT_PAGER:"cat"`、`forceShellIntegration:!0`、`hideFromUser`、`isTransient` 同批。面板开关档位逐字:`always / background_only / never`。
- **后端目标可切 host/vm**:扩展 `byted-solo.builtin-mcp` 配置键 `trae.computer-use.mtc.target`,enum `["host","vm"]`,default `host`,enumDescriptions 逐字为"控制宿主机 / 控制虚拟机"([观察] `package.json`);⇒ §2.1 的 `unified/vm_*` 就是 `vm` 档的执行体,**computer-use 这类"手会真动"的能力有独立的第二目标环境**。
- **进程治理词汇(命令执行的上层保险)** @14494726:`D`=`unknown/rg/git/shell`(检索/命令后端种类)、`T1e`=`spawn/exit/abnormal`(进程事件三态)、`vJ`=`cpu_too_high / exec_too_long / spawn_too_many`(治理原因枚举,三值)。[观察] 三枚枚举同处成组 ⇒ 有**针对派生进程的资源治理判定**,且原因词表只有 3 档(克制)。
- **env 白名单**:主进程把子进程环境按正则剥离 `[/^ELECTRON_.+$/, /^VSCODE_(?!(PORTABLE|SHELL_LOGIN|ENV_REPLACE|ENV_APPEND|ENV_PREPEND)).+$/, /^SNAP(|_.*)$/, /^GDK_PIXBUF_.+$/, /^ICUBE_.+$/, /^TRAE_NETWORK_SERVICE_CONFIG_PATH$/, /^TRAE_NET_ZMQ_ENDPOINT$/, /^TRAE_CONFIG_CHANNEL$/, /^TRAE_LOGIN_GUIDANCE_ENDPOINTS$/, /^TRAE_CDN_PREFIXES$/]`,并单独 `delete t.DEBUG / t.LD_PRELOAD`([观察] `out/main.js` 函数 `C_`)。⇒ **凭据类 env 不随派生进程外泄是写死在剥离表里的**;`TRAE_NET_INPROC_ENDPOINT` 在 Remote SSH Harness 分支里被显式 `delete` 并换成 `HARNESS_NETWORK_BACKEND="zmq"`。

---

## 3. `modules/browser-bridge/` —— Native Messaging + HMAC/scope,不是裸 CDP [观察]

### 3.1 载体与连接方式

- 整目录 2 个文件:`browser-bridge.exe`(**1,363,344 B**,`PE32+ console x86-64`,带 DigiCert 时间戳签名链)+ `VERSION`(5 B,内容 `0.2.0`)。
- **本体 = Rust,与 sandbox 同一 workspace 同一 toolchain**:PDB 路径族 `apps\icube_server_rs\modules\browser-bridge\src\{main.rs, preview.rs, security.rs}`,rustc 哈希串 `e408947bfd200af42db322daf0fadfe7e26d3bd1` 与 `trae-sandbox.exe` **逐字相同** ⇒ 两者同批构建([观察] 可复验:两文件各 grep 该 40 位短串)。crate 面含 `serde_json 1.0.140`、`sha2 0.10.8`、`hmac 0.12.1`、`hex 0.4.3`、`regex 1.13.0`、`aho-corasick 1.1.3`、`env_logger 0.11.6`、`humantime`、`tokio`(thread scope)。PDB 名 `browser_bridge.pdb`。
- **通道 = Chrome/Edge/Chromium/豆包 的 Native Messaging(stdio),不是 CDP**。shell 侧逐字(定位 `workbench.desktop.main.js` @15,999,878 起):
  - 宿主名 `iY = "com.solo.browser_bridge"`,二进制名 `Yt ? "browser-bridge.exe" : "browser-bridge"`;
  - **允许来源是硬编码的扩展 ID**:`Pri = "nbmnklcgnddbjafigmlhfjhefcfcgggn"`(32 字符 a–p 形 = Chrome 扩展 ID);
  - manifest 内容逐字结构:`{name, description:"TRAE SOLO Browser Bridge - Native Messaging Host", type:"stdio", path, allowed_origins:[`chrome-extension://${n}/`]}`;
  - 注册位 4 枚:`SOFTWARE\Google\Chrome\NativeMessagingHosts\com.solo.browser_bridge`、`…\Microsoft\Edge\…`、`…\Chromium\…`、**`…\Doubao\…`**(字节自家豆包浏览器同列)。
  ⇒ **本机装机里没有浏览器扩展本体**(§10 查:全树无含 `content_scripts` 的 manifest),扩展由用户侧安装,IDE 只登记宿主并把 ID 钉死 ⇒ 通道信任边界是"扩展 ID 白名单",不是端口。
- **同时有本地 HTTP/JSON 通道**:`browser-bridge.exe` 常量池里 `127.0.0.1:19234`(唯一硬编码端口)+ `Preview unsupported` / `Preview requires a restricted lane`(`preview.rs` 文案键)。[推断] 19234 是 preview/受限车道用的本地回环入口,native messaging 是主通道。

### 3.2 作用域与凭据边界(这块设计得最干净)[观察]

- **两枚结构体,字段名逐字**:`Owner { agentRunId }`、`Scope { sessionId, browserOwner, strictBrowserOwner, tabId }`("struct Scope with 4 elements")。消息框架 `enum Frame`(internally tagged)+ `Frame::Frame` + `Owner` + `Bounds`。
  ⇒ 授权粒度 = **会话 × 浏览器归属者 × 标签页**,且 `strictBrowserOwner` 是一把可收紧的布尔(不匹配就拒);`agentRunId` 把"哪一次 agent 运行"当所有者身份。`Bounds` = 元素矩形 ⇒ **语义快照回传带几何**,能点。
- **请求带鉴权封套,四道独立校验**(逐字错误串):`missing _auth.nonce`、`missing or invalid _auth.timestamp`、`timestamp expired: diff=`、`HMAC signature mismatch`、`missing _auth.signature`、`invalid signature hex:`、`nonce replay detected:`。封套字段:`_auth{timestamp, nonce, signature}`。⇒ **HMAC 签名 + 时间窗 + nonce 防重放,三件齐**;另有 `Unauthorized`、`Invalid preview scope`、`Preview response timeout`。
- **弱点(取证须如实报,但不复现密钥原文)**:`security.rs` 的串池里驻留**一枚 39 字符的固定字面 XOR 掩码密钥**(可复验定位:`browser-bridge.exe` 字节偏移 **985,847**,全文件命中 1 处,量法见 §10;本席判其属"凭据形态内容",按红线只记偏移与长度,不抄原文)⇒ 本地载荷另有一层硬编码 XOR 混淆。它不是加密(密钥与算法同处一个可读二进制),作用是防明文误读/防跨宿主串台;真正的鉴权靠上面那套 HMAC。本席判断:**不构成越权路径**(边界在 HMAC + allowed_origins),但"密钥内联"这一点若本仓要抄这套协议,应改成从密钥目录派生(本仓 `scripts/lib/key-dir.mjs` 现成)—— 见 §8。

---

## 4. `extensions/ai-completion/` —— 本地上下文引擎 + 远端推理 + ZMQ [观察]

体量:46 MB;`extension.js`(3,793,678 B)与 `resource/aiserver/cueMain.js`(3,534,916 B)均 >3 MB,**本席全程用 `bin-strings.mjs`/`ctx.mjs` 定点取样,未整读**。

### 4.1 装载什么资产

- `activationEvents`: `onLanguage:python, onLanguage:go, onLanguage:java, onLanguage:javascript, onLanguage:typescript, onLanguage:cpp, *`(末位 `*` = 全局激活)。
- **14 枚 tree-sitter WASM 语法**(现读计数):kotlin 4,117,095 / c-sharp 3,982,234 / cpp 3,312,756 / ruby 2,105,856 / typescript 1,139,597 / typescriptreact 1,041,338 / rust 844,087 / c 767,841 / dart 762,675 / php 752,455 / javascript 584,238 / python 474,189 / java 430,131 / go 240,169;外加基座 `tree-sitter.wasm` 190,779。**没有** html/css/vue/scss/json/yaml 语法 ⇒ 补全只做**编程语言**上下文。
- **两枚 tokenizer 资产(= 两个模型档位各自的分词器)**:`resources/tokenizer/codez/tokenizer.json` 7,404,784 B、`resources/tokenizer/codeds/tokenizer.json` 1,367,962 B。
- 渲染件:`resources/wasms/canvaskit.wasm` 6,786,717 B + `resources/font/HeiTi.ttf` 1,894,471 B + `DejaVuSansMono.ttf` 335,068 B ⇒ **进程内自带 Skia 光栅 + 中文字体**(用于把代码/界面画成图像,[推断];用途细节 [未知])。
- `resources/cue/lintErrorCategory.config.json` 2,689 B:顶层两键 `rename`、`function_signature`;每键按语言(`typescript/javascript/python/go/java/…`)给 **en/zh/ja 三套诊断文案正则**(如 en `does not exist on type|cannot find name|has no exported member|Cannot find module`)⇒ **把 LSP 报错按语义类别归码,再喂进补全上下文**,且归码表本身多语言。
- `resources/scripts/{ps.sh,cpuUsage.sh}`(1,335/1,722 B)= 在 Linux 侧手写 `/proc` 读 ppid/pcpu/pmem 模仿 `ps -ax -o pid=,ppid=,pcpu=,pmem=,command=` ⇒ **自带跨平台进程自省垫片**(不依赖外部 ps)。
- `profilerWorker.js`(1,951 B):`inspector.Session` 连主线程,轮询 `process.cpuUsage()`,**CPU ≥90% 时**落 `cue-<pid>-<ts>.cpuprofile` 到 `os.tmpdir()`,经 `worker_threads.parentPort` 回 `[AutoProfiler] …` ⇒ 常驻本地进程自带性能自诊断。

### 4.2 模型档位与提示构造(硬数字)[观察]

`cueMain.js` @1,330,015 处的 `D5t = new Map([...])`(定点取样所得,逐字键名/数值):

| 档 | `max_prompt_length` | `tokenizer_name` | 其余参数 |
|---|---|---|---|
| `default` | (PromptConfig 默认) | `default` | — |
| `CodeZ` | **1450** | `codez` | `snippet_percent:30, neighboring_tabs:EagerButMedium, use_retrieval_augmented:true, retrieval_sim_threshold:.92, suffix_percent:10, edit_history_percent:20, use_edit_history_prompt:true, suffix_line_count:PromptConfigConstant.CODEZ_DEFAULT_SUFFIX_LINE_NUM, trim_end_ws:true, segmented:true` |
| `CodeDS` | **3950** | `codeds` | 同上(仅 max_prompt_length 与 tokenizer 不同) |

- 枚举 `TokenizerName`:`Default="default", CodeZ="codez", CodeDS="codeds"`;装载器对 `codez/codeds` 走专用 tokenizer 类,其余回落通用类,并带 `LRUCache(200)` 的 token 长度缓存(`tokenCache`)⇒ **本地精确算 token,不靠估**。
- `NeighboringTabsOption` 枚举四档:`Off / Medium / Eager / EagerButMedium` ⇒ **打开的标签页是显式的上下文来源维度,并按"激进程度"分档**。
- 提示模板 token:`<fim_start>`、`<fim_suffix>`、`<fim_middle>`、`<fim_prefix>`(及裸 `<fim_…>` 变体)⇒ 标准 FIM 形态。

### 4.3 触发策略:多级 debounce + 热连击缓存 [观察]

- 数值:`pre_process_debounce_interval=125`、`debounce_interval=125`、`DEBOUNCE_INTERVAL=75`、`DEBOUNCE_INTERVAL=25`、`DEBOUNCE_INTERVAL_MS=15`、`partialAnalysisDebounce:1` ⇒ **至少 4 级节拍(15/25/75/125 ms),按阶段而非全局**。
- 阶段计时器字段名即流水线构成(逐字,均在 `cueMain.js`):`contextFetchingDebounce{Start,End}Time`、`preProcessStartTime/EndTime`、`preProcessNodeBoundary{Start,End}Time`(tree-sitter 求**光标所在语法节点边界**)、`preProcessLspDiagnostics{Start,End}Time`(§4.1 的 lint 归码)、`preProcessTokenizer{Start,End}Time`、`preProcessTotalEditContext{Start,End}Time`(编辑历史)、`preProcessRewriteRange{Start,End}Time`(**算重写范围 = diff 的前置**)、`postProcess{Start,End}Time`、`requestAiServerTotal{Start,End}Time`。
- 热连击:`extension.js` 里 `inlineCompFusionHotStreakManager.consume(uri, {cursorPosition, cursorLineRange, acceptedInlineCompletionRange, cacheCursorLineTextWhenProvideInlineCompletionItems, cacheCanceledRecommendBySelectionChange})`,命中后日志逐字 `return inlineCompletionItems by hot streak consume:`,并把 `tabMode="Locator"`、`searchMethod=CandidateSearchMethod.CacheOnly` 打上 ⇒ **接受上一处补全后,下一次按键直接吃缓存候选、不再请求模型**;`CandidateSearchMethod` 含 `CacheOnly="cache…"` 档。
- 结果形态是**多编辑块**而非单行插入:`{diffBlocks:[t], tabToContinue, tabToContinueType, summaryId}`,经命令总线 `icube.multiEditResult.show` / `icube.multiEditResult.setFla…` / `icube.multiEdit.updateLatestLogId` 落地;`SummaryScenario.{Jump, Completion}` 两种摘要场景(前者配 `tabToContinue:!0` 的"跳到下一处"提示);`_showLinesDiff` 日志形如 `[1/2 begin] showLinesDiff` / `[2/2 end]`。补全载荷含 `edit_recommends[]`(多位置建议)、`edit_updated`。
- **是否本地服务?** 推理**在远端**:`apiUrl:"api.marscode.com"`(12 处)与 `apiUrl:"api.enterprise.mcdemo.show"`(12 处,企业/私有化档)。本地跑的是**上下文引擎(cue)**,不是模型。
- **与 ai-agent 的进程关系**:cue 以 `require(cueMain.js)` 形式的独立进程/工作进程运行(`cue.js`→`cueMain.js`;`worker.js`→`promptWorker.js`+`analyzer-worker.js`),与宿主经 **ZeroMQ**:`endpoint=process.env.TRAE_NET_ZMQ_ENDPOINT`,同端点键出现在 `out/main.js`(3 处)且在**剥 env 白名单**与 `HARNESS_*` 分支里被点名;另有 `TRAE_NET_INPROC_ENDPOINT`(非远程档走 in-proc)⇒ **shell 侧有 zmq / inproc 两种后端,Remote SSH Harness 强制 zmq 并要求 `HARNESS_TOOLHOST_ENDPOINT`**。[观察] 到这一层为止;`modules/ai-agent/` 内部如何消费该端点属 T1。

---

## 5. 其余与 AI/agent 相关的扩展(共查 6 枚)[观察]

体量榜(du -sk):`byted-icube.integrations-extended` 69,982 KB、`byted-solo.builtin-mcp` 62,478 KB、`ai-completion` 46,266 KB、`byted-icube.python-enhance` 13,853 KB、`byted-icube.trae-tob-git-ai-vscode` 3,346 KB、`mermaid-chat-features` 3,222 KB、`git-ai.git-ai-vscode` 488 KB、`cloudide.dsl-agent-logs` 147 KB。

### 5.1 `byted-solo.builtin-mcp`(v0.0.1,displayName "Solo Builtin MCP")—— 桌面操作能力以 MCP 交付

- 子模块目录逐字:`dist/{chronicle, connectors, core, locked-use, record-replay}`。实现件按大小(`find dist -maxdepth 2 -type f -printf '%s %p\n' | sort -rn`,现读):`dist/core/record-replay-server.js` 149,524 / `dist/extension.js` 116,268 / `dist/core/window-capture.js` 54,847 / `dist/record-replay/controller.js` 28,398 / `dist/connectors/mail.js` 20,597 / `dist/core/record-replay-launcher.js` 19,676 / `dist/connectors/notes.js` 17,330 / `dist/connectors/calendar.js` 14,617 / `dist/record-replay/runtime-resolver.js` 14,116 / `dist/connectors/reminders.js` 12,478 / `dist/record-replay/chat-controller.js` 11,321 / `dist/connectors/contacts.js` 11,060 / `dist/chronicle/registration.js` 10,811 / `dist/core/builtin-skill-materializer.js` 10,766。
- **`connectors` 是一整套 macOS 桌面数据连接器**:`mail / notes / calendar / reminders / contacts` 五枚独立实现件 + 配置键 `trae.macos-connector.enable`(default false,"Enable macOS Connectors (Notes, Reminders, Calendar, Mail, Contacts)")。
- **Skill 是从扩展里"物化"出来的**:`dist/core/builtin-skill-materializer.js` 10,766 + `dist/core/computer-use-skill-watcher.js` 7,549 ⇒ 存在一个**把内置技能落盘并监视其变化的器物**,而不是把 SKILL.md 当静态资源。另有 `dist/chronicle/legacy-skill-cleanup.js`(旧技能清理)。
- **computer-use 工具面 = 22 枚**(现读,`{name:"…"}` 形态去重):`batch, check_permissions, click, clipboard, drag, get_app_state, get_value, grounding, launch_app, list_apps, menu, open_app, perform_action, press_key, request_permissions_gui, resolve_recorded_step, screenshot, scroll, select_text, set_value, type_text, verify_recorded_step`。
  ⇒ `grounding`(界面元素定位到几何)、`get_app_state`、`batch`(批量动作)、`request_permissions_gui`(要权限就弹真权限窗)、`resolve_recorded_step`/`verify_recorded_step`(录制回放的**步级双向校验**)。
- 原生件:`@byted-solo/computer-use-mcp/variants/windows-cua-v1/vendor/cua/win32-x64/cua_driver_sdk.dll` 30,503,824 B、`cua-wgc-worker.exe` 1,138,576 B(**WGC = Windows Graphics Capture**)、`cua-restore-worker.exe` 1,016,208 B、`cua_driver_node_runtime.node` 646,032 B;`vendor/aha_cua.dll` 7,014,288 B(又见 `aha` 前缀)、`vendor/TraeRecordReplayRuntime.exe` 3,283,856 B、`vendor/trae-computer-use-mask.exe` 669,584 B(遮罩窗)。FFI 用 **`koffi`**(`@koromix/koffi-win32-x64/koffi.node` 1,055,120 B)⇒ 不编译原生扩展也能调 DLL;校验用 `zod`。
- 其余配置键:`trae.computer-use.windowsPresentation`(bool default true —— **"变更型动作执行期间显示原生覆盖层"是给用户的可见性承诺**)、`trae.computer-use.windowsCuaV1`(bool default false,改后需重启 IDE)、`trae.computer-use.mtc.target`(enum host/vm,见 §2.2)。命令面 13+ 枚:`icube.common.commands.computerUse.{checkTcc, openTccSettings, openTccSettingsIfNotGranted, captureWindow, ensureReady}`、`icube.computerUse.{install, setEnabled, getPluginState}`、`icube.recordReplay.{install, setEnabled, getPluginState}`、`icubePlugins.pluginStateChanged`。
- 其它:`dist/core/tcc-checker.js`(macOS 隐私权限自检)、`dist/record-replay/permission-coordinator.js` 8,918 B、`dist/locked-use/installer-bridge.js` 8,188 B、`dist/chronicle/{registration,server}.js`。[推断] `chronicle` = 会话行为留痕账本(与 `record-replay` 分家:`record-replay` 是"能重演",`chronicle` 是"能追责")。

### 5.2 `git-ai.git-ai-vscode`(v0.1.20,publisher `git-ai`)—— AI 代码归属写进 git notes [观察·本仓最缺的一格]

- `displayName "git-ai"`,`description "Keep track of code generated by AI."`,`main ./out/extension.js`;实现件 top:`out/blame-lens-manager.js` 70,967 / `out/utils/runtime-downloader.js` 25,004 / `out/extension.js` 21,509 / `out/child-process-supervisor.js` 19,701 / `out/blame-service.js` 19,351 / `out/ai-edit-manager.js` 17,394 / `out/repo-health.js` 16,562 / `out/repo-runtime-manager.js` 16,350 / `out/services/git-ai-runtime-service.js` 11,569 / `out/git-info-for-agent.js` 11,159 / `out/daemon-runtime-lease.mjs→.js` 11,091 / `out/diagnostics.js` 10,881。
- **归属的存储位置 = Git notes,带命名空间**(逐字,`out/diagnostics.js` @2,471):
  `function authorshipRefForNamespace(namespace) { return namespace === "default" ? "refs/notes/ai" : \`refs/notes/ai-${namespace}\` }`
  ⇒ **默认 ref `refs/notes/ai`,可多命名空间并存**;`out/repo-health.js` @11,259 有体检项 "Expected notes ref is present" / 警告 "Multiple git-ai note namespaces detected"(列出 `availableNotesRefs.filter(r=>r.startsWith("refs/notes/ai"))`)。
- **上报协议(checkpoint)字段名全表(16 枚,现读 `out/core/checkpoint-payload.js`)**:`hook_event_name, dedupe_key, session_id, chat_session_path, completion_id, cwd, edited_filepaths, will_edit_filepaths, dirty_files, edited_filepaths, editor, editor_version, extension_version, model, repo_working_dir, tool, workspace_folder`。
  - `hook_event_name` 三值:`before_edit / after_edit / checkpoint`;`operationId` 常量 `human` 或 `completionId ?? "ai_tab"`。
  - `dedupe_key` 算法逐字:`${sessionId}:${operationId}:${hookEventName}:${hashFilepaths(filepaths)}` ⇒ **幂等键由"会话+操作+事件+受影响文件集合哈希"合成**。
  - `tool` 默认值逐字 `"github-copilot-tab"`、`model` 缺省 `"default"`;`editor/editor_version/extension_version` 同批 ⇒ **这是一套跨编辑器(非 Trae 专属)的归属协议**,`MIN_VSCODE_NATIVE_HOOKS_VERSION` = **VS Code 1.109.3** 起改用上游原生 hooks、扩展停发 legacy `before_edit/after_edit` 以免重复归属(`out/utils/vscode-hooks.js` 注释自述)。
- 命令与开关:`git-ai.{toggleAICode, showRepoHealth, showStatsOverview, installManagedRuntime, restartDaemon, showDaemonLog}`;配置键 7 枚,`gitai.blameMode` **enum `["auto","off","line","all"]` default `"auto"`**(enumDescription 逐字:"TRAE 用 all,其他宿主用 line"),另有 `gitai.{enabled:false, blameEnabled:false, enableInTrae:true, enableCheckpointLogging:false, integratedTerminalWrapperEnabled:false, experiments.aiTabTracking:false}`。
  ⇒ **默认全关**(enabled/blameEnabled/enableCheckpointLogging 皆 false),`enableInTrae` 才是 true;`integratedTerminalWrapperEnabled` 的说明逐字:"让新的 TRAE 集成终端把 Git AI 当作终端 git 命令的 **git wrapper**"。
- 自定义激活事件 `onTraeGitAiTracking`(非 VS Code 标准枚举)⇒ **宿主可以向扩展发私有激活信号**。
- 运行体是**远程按平台下载的二进制**:`out/utils/runtime-downloader.js` 内平台字面 `win32 / darwin / linux` + `sha256` + `.zip/.tar.gz` + 目标名 `git-ai.exe` / `git-ai-host`;虚拟文档 scheme `git-ai-health`;daemon 侧符号 `daemonHome / daemonPid / daemonPgid / daemonLease / daemonMutationByKey / daemonProbeRepo / daemon_running / daemon_log_viewer_ / .git-ai / git-ai-stats`。命令名 `git-ai show --color=never <commitSha>`、`git-ai show-prompt <promptId>` ⇒ **daemon 有自己的可查询存储(能反查"这条 AI 改动当时用的 prompt")**。

### 5.3 `byted-icube.trae-tob-git-ai-vscode`(v0.0.1,"Trae Coding Analysis")—— 同一协议的企业侧

- `description "Trae Coding Analysis runtime and contribution checkpoint extension."`;件:`out/runtime-controller.js` 59,647、`out/daemon/daemon-supervisor.js` 32,886、`out/checkpoint-orchestrator.js`、`out/known-human-checkpoint-manager.js`、`out/cue-inline-completion-checkpoint-batcher.js`、`out/svn.js`、`out/tenant-config.js`、`out/{git,contribution,reporting,runtime,vcs}/`。
- **checkpointKind 三值(现读)**:`trae`(AI 产出)/ `ai_tab`(补全)/ `known_human`(已知人类改动)⇒ 归属不是二值 AI/人,而是**三值,且"known_human"由专门器物维护**;补全侧还有**批量器**(batcher)。
- **带熔断的持久重试**:`checkpointQueue = new Map()`, `pendingRetryCheckpoints = []`, `pendingRetryTimer`, `drainingCheckpoints`, `checkpointRetryFailures`, `checkpointRetryNotBefore`, `checkpointRecoveryRequested`;`requestCheckpointRecovery()` 逐字触发 `daemonSupervisor.requestImmediateRecovery()` + `startRuntimeBootstrap("checkpoint_failure_recovery")` ⇒ **checkpoint 失败会去修运行体本身,而不是只丢日志**;`started-at-ns.js`(纳秒启动时刻,用于租约/判活)。
- **SVN 同等支持**:`svnDiscovery / svnInventory / svnBinary` + 命令 `tob-git-ai.getSvnRepositories` ⇒ 归属层不假设"只有 git"。
- 配置键 5 枚:`tobGitAi.runtime.maxArchiveBytes`(**下载归档体积上限**,解压炸弹护栏)、`tobGitAi.dataFinder.{appId,appKey,channelDomain}`(埋点上报目标,值未抄)、`tobGitAi.debug`;命令含 `tob-git-ai.{setRuntimeEnabled, executeTraeCheckpoint, checkpointCueInlineCompletion, showDaemonLog, showDaemonLogDebug, onToolLifecycle}`。

### 5.4 `byted-icube.integrations-extended`(v0.0.4,"Trae: Integrations")—— SaaS 能力以命令即工具形态发

- 命令 17 枚(键名照抄):`supabase.{listProjects,getProject,pauseProject,restoreProject,applyMigration,listMigrations,listTables}`、`llm.{getConfig,setConfig,checkConfig,deleteConfig}`、`stripe.{checkConfig,getAllPrices}`、`icube.figma.transform`、`larkCli.{install,checkUpdate,getCliStatus}`;配置键 1 枚 `icube.integrations.larkCli.useBundledInstall`。
- **它自带一整个 Node 运行时**:`dist/bundled/node-v24.14.0-win-x64.zip` = **36,217,529 B**(70 MB 里的主体)。⇒ 跑第三方 CLI(Lark CLI)不依赖用户机器上的 node。[推断] 这是该扩展 69,982 KB 的主要构成。
- `product.json` 的 `soloBuiltinExtensions` 另有 `byted-solo.integrations-extended`(与 `byted-icube.integrations-extended` 同功能两发布线,[推断] TRAE/SOLO 双品牌)。

### 5.5 `mermaid-chat-features`(唯一用了上游 LanguageModelTools API 的)

- `contributes` = `configuration, chatOutputRenderers, languageModelTools`。工具声明逐字段:`name/toolReferenceName = renderMermaidDiagram`、`displayName "Mermaid Renderer"`、`canBeReferencedInPrompt: true`、`when: "config.mermaid-chat.enabled"`、`inputSchema{markup:string}`(描述明确"只给 markup,不要包 code block")。渲染器:`{viewType:"vscode.chatMermaidDiagram", mimeTypes:["text/vnd.mermaid"]}`。
  ⇒ **图表输出走自定义 MIME + 输出渲染器**,而不是让模型吐 HTML。
- 注:`package.json` 的 `displayName/description` 是 `%占位符%` 未展开(该包靠 l10n 文件解析)—— 实测 `node` 读取得到字面 `NaNisplayName%`,说明**本仓做同类对账时不能只读 package.json,要连 l10n 面**。

### 5.6 `cloudide.dsl-agent-logs` —— agent 日志的一等查看器

- 12 枚命令(逐字):`dsl-agent-logs.{selectStream, removeStream, enableStream, disableStream, clear, export, filterByLevel, clearLevelFilter, search, clearSearchFilter, copyLogEntry, addLogEntry}`;`contributes` = `viewsContainers, views, commands, menus`;`activationEvents=["onCommand:dsl-agent-logs.activate"]`。
  ⇒ **多流(multi-stream)选择 + 按级别过滤 + 搜索 + 导出**的 agent 日志视图,以扩展形态交付;`addLogEntry` 说明写入方在别处(宿主/其他扩展可投递)。

---

## 6. 状态词汇表与契约面(对照 AGENTS.md §30)[观察·重点]

- `out/nls.zh-cn.messages.json` = **数字索引的 18,249 条目**(不是键值映射,是位置数组形);配套 `out/nls.keys.json` = **1,587 元素数组**、`out/nls.messages.json` 862,583 B、`out/nls.ja.messages.json` 1,319,609 B。⇒ nls 是**按序号取文案**的编译产物;本席**没有**用它定位 agent 语义(序号无语义),而是**直接从压缩 bundle 还原枚举块**(方法见 §10)——这才是"状态词汇是一等契约"的真落点。
- 还原出**含状态词的枚举块 36 枚**。对本仓 §30 最有价值的 8 组(成员逐字,附字节定位,可复验):

| 定位 | 推断归属(证据在同段) | 成员 |
|---|---|---|
| @10488344 | 紧邻 code-review 枚举,系**一次模型/agent 请求的结果码** `pd` | `success / invalid_request / parse_error / timeout / cancelled / session_missing / messages_empty / agent_exception / empty_content / network_error / json_parse_failed`(**11 值,全是 snake_case**) |
| @11294473 | 尾随 `me("IICubeCommonToolingTerminalTraceService")` ⇒ **终端命令执行相位机** `Xgs` | `start / find_reusable_terminal / create_terminal / terminal_ready / wait_shell_integration / ensure_terminal_environment / send_command / extension_responded_run_command / command_finished / error`(10 值) |
| @15706117 | 每值映射一枚 nls 文案 ⇒ **卡住归因分类** `Kh` | `client_not_sent / process_not_running / ipc_channel_issue / rust_stuck / network_stuck / server_queuing / sse_stuck / rust_to_renderer / subsequent_slow_response / unknown`(10 值) |
| @13613715 | 尾随 `me("migrationOrchestrator")` ⇒ **搬迁/交接状态机** `FEs` | `idle / preparing / downloading / installing / migrating / handing_off / waiting_ack / exiting / completed / **failed_retryable** / **failed_terminal**`(11 值) |
| @10488118 | 代码评审任务态 `Ar` + 模式 `Bn` | `idle / reviewing / completed / failed`;`summaryAndReview / summary / review` |
| @6037109 | 权限三态 `ab` | `granted / denied / pending` |
| @13438634 | CKG 面板态 `wd`(§1.4) | `to_build_ckg / building / error / success / built` |
| @4623259 | 秘密存储后端 `lUi`(尾随 `me("secretStorageService")`) | `unknown / basic_text / gnome_any / gnome_libsecret / gnome_keyring / kwallet / kwallet5 / kwallet6 / **dpapi** / keychain_access`(10 值,含平台判定函数 `isKwallet*`/`isGnome*`) |

- 另 4 组值得本仓注意的形状:
  - @4729802 `agentNotificationService`(尾随 `me("agentNotificationService")`)状态只有 3 值:`success / error / waiting`。
  - @9844837 检查类四态:`failed / off / passed / skipped`(注意 **没有"未判定"档**)。
  - @6761155 查找类:`found / notFound / timeout / error`(**timeout 与 notFound 分家**)。
  - @5351121 日志级别:`trace/info/warn/error`;@5312830 仓库态:`unknown / none_git_repo / clean / dirty / merging`。
  - 重复三元组并存:@3532924 `pending/accepted/rejected` 与 @5339290 `pending/fulfilled/rejected` ⇒ **同一语义两套词(accepted vs fulfilled)**,即使字节级也已在漂移([观察] 两枚都在 bundle 里,值域互不引用)。

---

## 7. 结论:哪些能力被做成"壳层"(与模型无关、进程外可见)

1. **代码知识 = 独立原生服务**(Go,39.6 MB DLL),端口登记在 `meta.json`,本地 embedding + sqlite-vec + SQLCipher,按项目分库,Merkle-trie 分片脏标 + IDE 文档/光标事件双驱动,`{service,method,data,timeout}` 信封 RPC,12 个对外方法 + 91 个 gRPC 消息(含 21 枚 ContextFS 虚拟文件系统消息)。
2. **命令执行隔离 = ntdll/ws2_32/advapi32/dnsapi(+user32/gdi/win32u)API 拦截 + AppContainer/ACL 叠加**,策略是热更新规则集(正则 + file/net/process 三类 + `risk_rule_id`/`risk_policy_version`),每类拦截各有一枚计数器,连"沙箱自己丢了多少条"都要量;git 锁文件与 token broker 缓存被显式白名单化。
3. **浏览器接管 = native messaging host(4 家浏览器注册)+ HMAC(timestamp/nonce/signature)+ Owner{agentRunId}/Scope{sessionId,browserOwner,strictBrowserOwner,tabId}**,能力回传带 `Bounds` 几何。
4. **补全 = 本地上下文引擎(14 语法 tree-sitter + 2 档 tokenizer + token 预算百分位分配 + 诊断归码 + 4 级 debounce + 热连击缓存),推理在远端**,进程间用 ZMQ/inproc,自带 cpuprofile 自诊断与 `/proc` 垫片。
5. **桌面操作 = MCP 扩展交付 22 枚工具 + koffi FFI + WGC 捕获 worker + 独立 VM 目标档**;技能由 `builtin-skill-materializer` 物化并被 watcher 监视;`chronicle`(留痕)与 `record-replay`(重演)分家且带权限协调器。
6. **AI 代码归属 = 跨编辑器的 checkpoint 协议 + Git notes(`refs/notes/ai[-ns]`)持久化 + 按平台 sha256 下载的原生 daemon**;三值归属(AI/补全/known_human),失败会反过来修运行体。
7. **状态词汇是编译期枚举**,命名统一 snake_case;把"卡住的原因""失败的两种结局(可重试/终局)""秘密存储的后端种类"都当成契约词表发出去。
8. **完整性三处并存**:`product.json.checksums`(逐文件)、`builtInExtensions[].sha256+vsix`、`tobGitAi.runtime.maxArchiveBytes`(归档体积上限)。

---

## 8. 本项目大概率没有的机制(逐条:对方是什么 / 本仓现状 / 最小落点)[观察·本席交付重心]

> 现状栏全部为 `G:/IHUI-AI` 实 grep 结果(命令见 §10),未查的标 [未知]。

**G1 · IDE 事件驱动的索引增量(而非扫盘)**
- 对方:`document_action{create,change,delete,select}` + `cursor_move` 两个高频 RPC 直喂 CKG;merkletrie 只标脏分片(`markShortShardDirty`/`markLongShardDirty`)。
- 本仓现状:**有同类底座,但只有"重扫"这一条腿**。`apps/ai-service/app/services/codebase_indexer.py:12` 自述"Merkle 增量同步:文件内容 sha256 快照持久化…快照根 hash = sha256(sorted(path:hash))";但全仓 grep `file_outline|cursor_position|selection_range|selectedSymbol` 于 `apps/ai-service/app/services/`、`apps/cli/src/` **零命中** ⇒ 编辑器光标/选区/未落盘文档事件从未进入检索路径。
- 最小落点:`apps/ai-service/app/services/context_engine.py` 增一个 `editor_state` 入参(sessionId/cursorPath/selection),并在 `apps/cli/src/utils/prompt-injection-registry.ts` 的 `PROMPT_INJECTION_ENTRIES` 同批登记一个新 id(如 `context_editor_state`,`kind:'reference_data'`)——照 `context_fs_events` 那条现成形状办(§"宿主级提示块唯一出口")。

**G2 · 把知识挂载成虚拟文件系统给 agent 用**
- 对方:`*protocol.Cfs*` **21 枚消息**(mount/read/write/stat/search/resolve/listdir/mkdir/rename/remove/health/listmounts),`components/contextfs`。
- 本仓现状:同名概念只是**一段文本注入**。`apps/cli/src/commands/agent.ts:1064` 的 `context_fs_events` = "工作区最近文件变更(60s 内,共 N 条)"纯文本;`grep -rn "contextfs|virtual_fs|mountInfo|OverlayFs"` 于 `apps/`、`packages/` **零命中** ⇒ 无挂载、无路径式检索、无写回通道。
- 最小落点:新建 `apps/ai-service/app/services/knowledge_fs.py`,把 `codebase_chunks` 的三层切片(函数/模块/架构,`symbol_type=module_summary/architecture_summary` 现有形态)按 `/repo/<dir>/<file>#<symbol>` 路径投影成只读虚拟路径,出口 `list(prefix)` / `read(path)` / `search(q)` 三函数即可(先不做写),挂到 `apps/ai-service/app/api/v1/router.py` 已有 codebase 前缀下;agent 侧只加一条 `read-only` 工具,不动权限面。

**G3 · OS 强制 + 计数诚实的沙箱(本仓只有 Job Object 一层)**
- 对方:5/8 枚 `*ApiListener`(ntdll/kernelbase/ws2_32/advapi32/dnsapi/+user32/gdi/win32u),正则规则 + `risk_rule_id`/`risk_policy_version`,**21+ 枚分桶计数器**(report / process_drop / sandbox_drop / priority_* / risk_reserved / **duplicate** / **risk_unknown**)。
- 本仓现状:**内核层已有,但只到"限额 + UI 限制";策略层是枚举档位,没有任何拦截计量。**`apps/ai-service/app/core/proc_sandbox.py` 头注自述 Windows 走 Job Object(`KILL_ON_JOB_CLOSE / PROCESS_MEMORY_LIMIT / ACTIVE_PROCESS_LIMIT / UI 限制:禁剪贴板读写/改系统参数/句柄继承到用户桌面`),纯 ctypes;`apps/ai-service/app/core/sandbox_policy.py` 只有 4 档常量 `POLICY_DANGER_FULL_ACCESS / POLICY_READ_ONLY / POLICY_EXTERNAL_SANDBOX / POLICY_WORKSPACE_WRITE` + `class SandboxPolicy / WritableRoot`;`grep -oE "block_count|audit_count|_counts|risk_rule|policy_version|drop_count"` 在 `apps/ai-service/app/core/` **零命中**(仅 `schema_check.py` 的同名局部变量)。
- 最小落点(不引入注入 DLL,零依赖路线):`apps/ai-service/app/core/proc_sandbox.py` 增一档"每次沙箱判定都落计数"——把现有拒绝分支归到 4 类稳定身份(`file / net / process / ui`)× 3 态(`allow / block / would_block`),经既有 `.ihui-agent/state/*.jsonl` 台账形态落盘,再按 §5e-3 的"量与拦同批"纪律接 `scripts/alert-volume-report.mjs` 一类的计量口;`risk_policy_version` 用本仓已有的守门编号体系代替(不新造版本号)。

**G4 · AI 代码归属写成 Git notes(跨会话、可 git 传)**
- 对方:`refs/notes/ai` / `refs/notes/ai-<ns>`,16 字段 checkpoint(`hook_event_name ∈ before_edit|after_edit|checkpoint`、`dedupe_key = session:operation:event:hash(files)`、`model/completion_id/tool/editor_version`),`git-ai show-prompt <promptId>` 可反查当次提示词;三值归属 `trae / ai_tab / known_human`;默认关(`gitai.enabled=false`)、`blameMode ∈ auto|off|line|all`。
- 本仓现状:**有"会话内、内存态、不落 git"的等价物,没有持久归属。**`apps/cli/src/checkpoints/hunk-tracker.ts:6` 自述"按 hunk(行范围)粒度追踪文件改动来源(Agent vs External)… **不依赖 git,不做 diff 算法**,只按行号范围记录",`type ChangeSource = 'agent' | 'external' | 'unknown'`(二值+未知,无 model/completion 维度);全仓 `grep -rn "refs/notes"`(排除 node_modules)**零命中**。
- 最小落点:新建 `scripts/record-ai-authorship.mjs`(纯 git plumbing,不引依赖):在 `safe-commit.mjs` 的 pathspec 提交成功后,对本次声明集按 hunk 追加 notes 到 **`refs/notes/ihui-ai`**(命名空间与本仓 gitdir 隔离),payload 键对齐上面 6 枚最小集(`hook_event_name / dedupe_key / session_id / model / tool / edited_filepaths`);判据与幂等键实现单源放 `scripts/lib/ai-authorship-notes.mjs`,镜像测试 `scripts/tests/ai-authorship-notes.test.mjs`(§22c 三口径)。这条同时补掉 G3 缺的"归属可追责"与 §12 的"谁改的"证据。

**G5 · 浏览器接管的身份/凭据边界(Owner/Scope + HMAC + nonce 防重放)**
- 对方:`Scope{sessionId, browserOwner, strictBrowserOwner, tabId}`、`Owner{agentRunId}`、`_auth{timestamp, nonce, signature}` 四道独立拒绝串;宿主注册钉死扩展 ID;XOR 仅混淆、不当加密用。
- 本仓现状:**有 CDP 通道,没有作用域与防重放。**`apps/ai-service/app/routers/browser_hub.py:253`、`apps/ai-service/app/routers/chrome_import.py`(CDP 命中 8+ 处)、`apps/ai-service/app/core/config.py:110`、`main.py:1106/1114`;`grep -rn "nonce|HMAC signature|replay|allowed_origins"` 于 `apps/ai-service/app/routers/browser_hub.py`、`chrome_import.py` **未见该类键**(本席仅对这两文件判定,[未知] 全仓别处)。另 `chrome_import.py` 存在意味着**它读浏览器 profile 数据** ⇒ 边界更该被量出来。
- 最小落点:`apps/ai-service/app/routers/browser_hub.py` 的每个动作端点入参增加 `session_id + tab_id` 并强制二者匹配已登记租约(缺任一 ⇒ 400 且落"未判定"计数,不冒绿);`apps/ai-service/app/core/` 新增 `browser_scope.py` 单源实现 `scope_of()`/`verify_scope()` 两个纯函数,`chrome_import` 侧改为只经该出口;防重放在本仓这档 HTTP 形态下可用 `dedupe_key`(借 G4 的同一算法)。

**G6 · 卡住归因 / 失败二分 的状态词表(§30 直接对标)**
- 对方:`Kh` 10 值把"卡在哪一段"拆到 `client_not_sent / process_not_running / ipc_channel_issue / rust_stuck / network_stuck / server_queuing / sse_stuck / rust_to_renderer / subsequent_slow_response / unknown`,且**逐值配文案**;`FEs` 把失败拆成 `failed_retryable` / `failed_terminal`;`Xgs` 10 段命令执行相位(含 `terminal_ready`、`wait_shell_integration`)。
- 本仓现状:**有结果码,没有"卡住位置"维,也没有可重试/终局二分。**`grep -rn "failed_retryable|failed_terminal|not_judged|undetermined"` 于 `apps/ai-service/app/`(排除 .venv)**零命中**(本仓的"未判定"约定住在 `scripts/check-*.mjs` 的 exit 2 侧,不在 agent 词表里);`apps/ai-service/app/core/stream_events.py:255` 有 `attribution` 但是错误归因(§`self_healing.py` 同),非"请求卡在哪一段"。
- 最小落点:把词表加在**已经在用英文态词汇的那一层** —— `packages/types/src/`(agent 事件/会话类型面)新增 `const AGENT_STALL_REASONS = [...] as const`(先取 5 值:`ipc_channel_issue / process_not_running / network_stuck / server_queuing / unknown`,别一次上 10),并在 `apps/ai-service/app/core/stream_events.py` 的事件里带该枚举;按 §30 + 守门 `check-i18n-keys.mjs` 五语言同批补,禁止端内硬编码中文文案。

**G7 · 本地 embedding / 离线向量索引**
- 对方:命令行常量 `-local_embedding -embedding_storage_type=sqlite_vec`,配 `GetLocalEmbeddingStorage`/`IsLocalEmbeddingBuilding`/`GetProjectEmbeddingType`。
- 本仓现状:**索引在本地,向量在远端。**`codebase_indexer.py` 头注:"依赖 … `llm_gateway.embed()`(已存在,生成 1536 维向量)",落 PG 表 `codebase_chunks`;`grep -rn "sqlite_vec|sentence-transformers|local_embedding"` 于 `apps/`、`packages/`(排除 `.venv`)**零命中**(`.venv` 里的命中是 litellm 自带常量,非本仓代码)。⇒ 索引必须联网、必须有 provider,离线/欠费即退化。
- 最小落点:不动 PG 主路;在 `apps/ai-service/app/core/llm_gateway.py` 的 `embed()` 旁加一条**同签名本地回落档**(如 provider 键 `local:fastembed`),并把"本次 embedding 来自远端还是本地"写进索引结果元数据(`codebase_chunks` 已有的切片元数据即可承载),使"离线建出来的索引"可被识别、不被在线档静默覆盖。

**G8 · 桌面操作能力的"可见性承诺"与 VM 目标档**
- 对方:`trae.computer-use.windowsPresentation`(default **true**,注释逐字"执行变更型动作期间显示原生覆盖层")+ `trae-computer-use-mask.exe`(669,584 B)+ `trae.computer-use.mtc.target ∈ {host, vm}` + `permission-coordinator.js` + `check_permissions`/`request_permissions_gui` 两枚工具。
- 本仓现状:[未知] 是否已有等价物 —— 本席未对 `packages/app`、`apps/desktop` 的覆盖层/遮罩实现做专项 grep(时间盒);可确定的是本仓**没有 host/vm 双目标档**(`grep -rn "mtc.target|target.*host.*vm"` 于 `apps/ai-service/app/core/sandbox_policy.py`、`exec_params.py` 零命中,`SandboxPolicy` 只有 4 档文件权限维度)。
- 最小落点:`apps/ai-service/app/core/exec_params.py`(其头注已声明"network/sandbox 字段,属平台执行层")补一个布尔字段 `announce_mutation_action`(默认 true)并让命令执行层消费它;真正做覆盖层属 UI 席,本席只登记"参数面缺这一格"。

---

## 9. 主席必须知道的 5 件事

1. **Trae 的三块外围能力全是原生件,不是 JS**:CKG = Go+CGO(39.6 MB DLL)、sandbox = Rust 宿主 + C++ 注入 DLL ×2 后端 ×2 架构(16 件)、browser-bridge = Rust(1.36 MB,与 sandbox **同一 rustc 构建哈希** ⇒ 同 workspace 同批构建)。本仓想在 TS/Python 侧"对齐"它们,不能按插件找,要按**进程 + socket + 拦截点**找。
2. **`modules/ai-agent/` 不是全部**:62 MB 的 `byted-solo.builtin-mcp` 才是桌面接管(22 枚工具 + koffi + WGC worker + host/vm 双目标)与"技能物化器"的载体,70 MB 的 `byted-icube.integrations-extended` 自带 **node-v24.14.0 运行时 zip(36,217,529 B)** 去跑第三方 CLI。这两枚都在 `product.json.traeBuiltinExtensions` 的 14 条里 ⇒ **跨席取证若只遍历 `modules/`,会漏掉本仓最该补的 2 格**。
3. **安全面三处硬事实(只报事实,不做指控)**:① `git-ai.git-ai-vscode` 由 publisher `git-ai` 发布,但 `trustedExtensionPublishers=["microsoft","github"]` 不含它,仍在 builtin 14 条内 ⇒ 信任表与装载表两把闸不同步;② browser-bridge 把本地通道的 XOR 混淆密钥以**硬编码字面量**内联在 exe 第 985,847 字节处(单处命中;真正的鉴权边界是 HMAC+nonce+allowed_origins,故本席不判其为越权路径);③ `tobGitAi.dataFinder.appKey` 与 `iCubeApp.appKey` 是**明文驻留在 product.json 的客户端标识键**(本席只记键名,值未抄;非用户凭据,属可提取的厂商键)。
4. **本仓已具备的比预想多**:Job Object 沙箱(`proc_sandbox.py` 含 UI 限制/内存/进程数/孤儿回收,纯 ctypes)、Merkle-式 sha256 增量索引 + 三层语义摘要(`codebase_indexer.py`)、hunk 粒度 Agent/External 归属(`hunk-tracker.ts`)、CDP 浏览器腿(`browser_hub.py`/`chrome_import.py`)。所以 §8 的 8 条里,G1/G3/G4 是**加深**,G2/G5/G6/G7 才是**补缺**。汇报时不要把它们说成"从 0 到有"。
5. **状态词表是本仓最便宜的收益**:对方 36 枚枚举块里,`Kh`(卡住归因 10 值)与 `FEs`(`failed_retryable`/`failed_terminal`)这两个形状,本仓**一个都没有**,而它俩不需要新运行时、只需要在 `packages/types` 加两个 `as const` 并让事件带上 —— 一格改动同时满足 §30(状态词汇一等契约)与 §0.3(取不到不冒绿:把"未判定"做成枚举里的显式值)。

---

## 10. 取证手段、复验命令与未取到的面

**手段**:`find -maxdepth`/`du -sm`/`ls -la`/`-printf '%s %p'` 取结构与字节数;`file` 判 PE 形态;自写三件工具做定点取样(全部落 `.ihui-agent/tmp/trae-rea/s2/`,仓库其他位置一字未改):
- `bin-strings.mjs <file> --re <regex> [--min N --cap N]` —— 二进制 ASCII 串抽取(76,128 条 ≥6 字符 ASCII 串来自 `libckg.dll`)。
- `ctx.mjs <file> <token> [--before/--after/--skip/--occ]` —— 大文件按 token 取字节窗口(报字节偏移,不报行号)。
- `enums2.mjs <bundle.js> [words]` —— 从压缩 bundle 还原 TS 枚举块(产出 36 枚含状态词的块)。
- 未使用 REA CLI(全量分析 VS Code fork 代价高,静态已足够);`G:/IHUI-AI/.ihui-agent/tmp/rea-cli-help.txt` 本席**未读**即未用 ⇒ 不构成"跑不通的出路"风险(§0.8)。

**现读数字(全部可重跑复核)**:
```bash
APP="C:/Users/Administrator/AppData/Local/Programs/Trae CN/resources/app"
ls -1d "$APP"/extensions/*/ | wc -l                              # 109
ls -1 "$APP"/modules/ | wc -l                                    # 4(ckg/sandbox/browser-bridge/ai-agent)
find "$APP"/modules/ckg -type f | wc -l                          # 7
stat -c%s "$APP"/modules/ckg/binary/libckg.dll                   # 39,672,720
node …/bin-strings.mjs "$APP"/modules/ckg/binary/libckg.dll \
  --re '^\*?protocol\.[A-Z][A-Za-z0-9]*$' --cap 500 | grep -c '^protocol'   # 91
node …/bin-strings.mjs … --re '^\*protocol\.Cfs[A-Za-z]*$' | grep -c Cfs    # 21
grep -o 'Create:"create",Stop:"stop"[^}]*' "$APP"/out/vs/workbench/workbench.desktop.main.js \
  | head -1 | tr ',' '\n' | wc -l                                 # 12
find "$APP"/modules/sandbox -type f | wc -l                      # 16
node …/bin-strings.mjs "$APP"/modules/sandbox/x64/aiep_sbox.dll \
  --re '^\.(\?AV)?I[A-Za-z0-9_]+ApiListener' | grep -c ApiListener       # 5
node …/bin-strings.mjs "$APP"/modules/sandbox/unified/x64/aiep_vm.dll \
  --re '^\.(\?AV)?I[A-Za-z0-9_]+ApiListener' | grep -c ApiListener       # 8
ls "$APP"/extensions/ai-completion/resource/aiserver/resources/wasms/ | grep -c 'tree-sitter-.*\.wasm'   # 14
node -e "console.log(Object.keys(require('$APP/product.json')).length)"   # 82
node -e "console.log(require('$APP/product.json').traeBuiltinExtensions.length)"  # 14
node -e "console.log(Object.keys(require('$APP/out/nls.zh-cn.messages.json')).length)"  # 18249
node …/enums2.mjs "$APP"/out/vs/workbench/workbench.desktop.main.js | head -1  # 36 枚状态枚举块
grep -hoE "\{\s*name:\s*\"[a-z0-9_]{3,30}\"\s*,\s*(description|title|inputSchema)" \
  "$APP"/extensions/byted-solo.builtin-mcp/dist/core/*.js \
  "$APP"/extensions/byted-solo.builtin-mcp/node_modules/@byted-solo/computer-use-mcp/dist/*.js \
  | grep -oE '"[a-z0-9_]{3,30}"' | sort -u | wc -l               # 22
grep -hoE "^\s+[a-z_]+[:,]" "$APP"/extensions/git-ai.git-ai-vscode/out/core/checkpoint-payload.js \
  | tr -d ' ,:' | sort -u | wc -l                                # 16
# 内联混淆密钥的定位(只量偏移与长度,不打印原文):
node -e "const b=require('fs').readFileSync(process.argv[1]);const i=b.indexOf('xor-mask-key');console.log(i, b.toString('latin1').split('xor-mask-key').length-1)" \
  "$APP"/modules/browser-bridge/browser-bridge.exe               # 985847 1
```
本仓侧对账命令(§8 现状栏依据):
```bash
sed -n '1,40p' apps/ai-service/app/core/proc_sandbox.py
grep -n "Merkle\|sha256(sorted" apps/ai-service/app/services/codebase_indexer.py
grep -rn -oE "file_outline|cursor_position|selectedSymbol" apps/ai-service/app/services/ apps/cli/src/   # 空
grep -rn -oE "block_count|risk_rule|policy_version|drop_count" apps/ai-service/app/core/                 # 空
grep -rn "refs/notes" apps/ packages/ --include=*.ts --include=*.py                                      # 空
sed -n '1,20p' apps/cli/src/checkpoints/hunk-tracker.ts        # "不依赖 git,不做 diff 算法"
grep -rn "sqlite_vec|local_embedding" apps/ packages/ --include=*.py --include=*.ts                       # 空(.venv 除外)
```

**未取到的面(如实登记,不猜)**
- [未知] CKG 的 proto **字段级**定义与表结构:未取 `codekg.pb.go` 字段,未进入 `<.icube>\ckg_server` 与 `database.db`(用户态红线);`-version_code=2` 的含义未定。
- [未知] CKG 里 `SearchCKGDB/RetrieveEntity/RerankSnippet/ImportAnalysis/GetFileOutline/Cfs*` 这些消息**由谁调用**:12 枚 shell 方法里不含它们 ⇒ 消费方大概率在 `modules/ai-agent/`(T1 射程),本席未证。
- [未知] sandbox 策略 JSON 的**真实 schema**(`file_rules`/`net_rules` 条目字段名只从计数串反推);`unified/vm_*` 的"VM"到底是 Hyper-V/容器还是仅路径重定向(`SetDriveDevicePaths`/`vm_compat` 暗示第三种),未动态验证。
- [未知] 浏览器扩展本体与它的能力面(装机树内无扩展;`Bounds`/语义快照的具体字段只能从结构体名推)。
- [未知] `ai-completion` 的两档模型实际是什么(CodeZ/CodeDS 是**内部代号**,本席未从任何响应体确认对应厂商/参数规模);`canvaskit` + 中文字体的具体用途(图像化输入?)未证。
- [未知] 本仓 UI 覆盖层/遮罩等价物是否存在(§8 G8 只对 `sandbox_policy.py`/`exec_params.py` 判了"无 host/vm 档",未 grep `packages/app`、`apps/desktop`)。
- [未做] REA 应用分析、任何动态跑、任何写盘(除本席 `s2/` 下三件工具与本报告)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
