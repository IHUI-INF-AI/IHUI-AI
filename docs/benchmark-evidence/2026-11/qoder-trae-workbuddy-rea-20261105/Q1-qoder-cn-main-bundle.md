<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Q1 — Qoder CN 0.5.3 主程序逆向取证（goal-b49 逆向取证席）

> 引擎：rea-agents 6.4.0 + 自研对象空间取尺（asar 头部索引 + 偏移归属检索）。全程只读，未执行被分析程序，未改动 `G:\Qoder CN` 任何字节。

## 1. 现场读数

- 本仓 HEAD（现读 `git rev-parse HEAD`）：`6e6ea6f5c8be194d24aee8142adcc723b54bf8be`，分支 `main`
- 靶：`G:\Qoder CN\.qoder-versions\0.5.3\`；`resources\app.asar` 196,842,548 B（6,435 个条目，`/out` 139 MB、`/node_modules` 152 MB）、`Qoder CN.exe` 225,510,400 B、`app.asar.unpacked/`（12 个原生包）
- 版本事实（现读 `build-manifest.json`）：productVersion 0.5.3 / electronVersion **43.1.1** / commit `26e9614f…` / buildNumber 85766108；`product.json`：appId `com.qodercn.app`、protocolScheme `qoder-cn`、launcher 互斥量名 `Local\QoderSpaceWindowsLauncher-qoder-cn`
- mtree 原生件位置（现读 `bundled-resources/manifest.json` + 插件目录）：`…/qoder-context/1.0.91.b22f2d0a/runtime/native/mtree/{index.cjs 10,628B, mtree.win32-x64-msvc.node 1,868,808B}`；**app.asar 内 63 个 `.node/.dll/.wasm` 条目中无任何 mtree 件**
- 主进程包未做字符串混淆（实测：`electronMain.js` 内 `decodeURIComponent(h)` 型解码器签名 0 次，`Service:` 明文 381 次）⇒ 字面量检索结论可信；仅 `remoteSdkDaemonBridge.js`/`dataDirectoryProcess.js` 等小卫星文件被混淆
- REA 进度如实登记：**分析层=部分完成**。① `rea analyze-javascript-application app-main`（21 MB/50 源，含 `electronMain.js` 19.5 MB）在单文件上 `provider_timeout`（120 s/源），只落 partial Evidence（`root_artifact_sha256 2785dd45d3d1ce73…`、565 节点）；② 摘掉 `electronMain.js` 后重跑 49 源切片 **成功**：`evidence_id ev_b00ac554ba3f4359a89998fea7b884804a27fce8c4f5bc44ca46897738d8bae3`、`root_artifact_sha256 8e8ead4361fb620e…`、`inventory_graph_sha256 7dcc247b87336d56…`、graph **582 节点**；③ `rea decompile … --procedure computeSimhash`（Ghidra 12.1.4）在 330 s 处 `provider_timeout`；④ **整包层（app.asar 196 MB 全量）未做 REA 分析**，改用自研 asar 索引尺逐文件取证。结论以②+自研尺为准，①③如实标为未收口。（同目录他席产出 `asar-evidence.json` 亦为 `provider_timeout`，停在 44/7189 源 ⇒ "整包层 REA"在本机时限内对任何席都不可达，非本席漏跑）
- 本席取证面（全部 0 命中即为该面 0 命中）：app.asar 全文、Qoder CN.exe、launcher/trust 两个 exe、`app.asar.unpacked/`、`extensions/`、`collaboration-cli/`、`node-repl/`、`browser-connector/`、`native-messaging-host/`、`dynamic-text/`、`fast-update/`、插件三入口 + `index.cjs` + `.node`、`qoder-worker-runtime.obf.mjs`(34.8 MB)

## 2. T12 未收口格 #6 结清表（10 枚逐枚）

判定基线：`index.cjs` 是**纯转发装载器**（按平台选 `.node` → 解构 23 名 → 逐条 `module.exports.X = X`，无任何业务调用），故其在 `index.cjs` 内的命中只算"声明"不算"消费"。23 枚全量对照实测（次数为字面量命中，已含子串噪声）：

| 导出名 | 三态 | 主程序内消费方证据锚点 | 一句话行为 |
|---|---|---|---|
| writeSnapshotToFile | 观察=主程序 0 消费方；未知=native 内部自调 | 0 命中（asar 全文/worker-runtime/三入口）；仅 `index.cjs@9094,9547,9569` 声明 + `.node` 注册名 | 把 Merkle 树快照落盘（配 zstd） |
| readSnapshotFromFile | 同上 | 同上（`index.cjs@9115,9604,9627`） | 从盘读回快照做增量 |
| checkIsBinaryFile | 同上 | 同上（`index.cjs@9220,9904,9924`） | 二进制判定（喂给建树/比对） |
| checkIsLargeFile | 同上 | 同上（`index.cjs@9239,9957,9976`） | 超大文件跳过判定 |
| isNodeChanged | 同上 | 同上（`index.cjs@9281,10086,10102`） | 单节点前像是否变更 |
| compareSnapshotWithDirectory | 同上 | 同上（`index.cjs@9326,10221,10252`） | 快照 ↔ 目录实况差集 |
| computeSimhash | 同上 | 同上（`index.cjs@9386,9402,10386…`） | 64bit 近似指纹 |
| computeSimhashBatch | 同上 | 同上（`index.cjs@9402,10433,10455`） | 批量指纹 |
| hammingDistance | 同上 | 同上（`index.cjs@9423,10490,10508`） | 指纹海明距（改名候选） |
| buildWeightedTree | 同上 | 同上（`index.cjs@9440,10539,10559`） | 加权树（非均匀叶子权重） |

**结清结论（10/10 结清，0 枚找到消费方）**
1. 观察：主程序**结构上不可能**消费这 10 枚 —— ① app.asar 63 个原生条目里没有 mtree 二进制；② asar 全文对 `native/mtree`、`mtreeLoader`、`mtreeBinary`、`mtreeNapiVersion`、`QODER_MTREE_NATIVE`、`MtreeWatcher`、`MerkleTreeHandle` 全 0 命中 ⇒ 主程序从不装载该 addon；③ 主包明文未混淆，10 个符号名字面量 0 命中；④ 插件自带的 `runtime-manifest.json` 把 mtree 角色（`mtreeLoader`/`mtreeBinary`/`scanWorker`/`legacyMigrationWorker`）只交给插件自身 runtime，而读该 manifest 角色的代码在 asar 内 0 命中。
2. 观察：真实消费方全在插件三入口内，13 枚有消费方（`buildTree` 8/2/1、`renderTree` 14/11、`collectLeafPaths`、`diffTree`、`MtreeWatcher`、`createSnapshot`、`collectStats`、`buildTreeWithIgnore`、`MtreeProjectIgnore`、`encodeZstd`/`decodeZstd`/`isZstdCompressed` 各 1 次于 `qoder-search.bundle.mjs`）；10 枚在四处 JS 面均 0 ⇒ **交付形态里的死导出**。
3. 观察（机制）：mtree 由插件侧按候选链装载：env `QODER_MTREE_NATIVE` → `native/mtree/index.cjs` → `../../native/mtree/index.js` → 兜底 `@qoder/mtree`；插件 `mcp.json` 把 `QODER_MTREE_NATIVE=${QODER_PLUGIN_ROOT}/runtime/native/mtree/index.cjs` 注入，宿主只提供 `QODER_PLUGIN_ROOT/CLAUDE_PLUGIN_ROOT/QODER_PLUGIN_DATA/QODER_PRODUCT_ID/QODER_NODE_RUNTIME` 这几个占位符（`electronMain.js` 字节偏移 4,751,687 与 11,830,625 附近）。
4. 未知（差哪一步）：这 10 枚是否被 `.node` **内部自调**（Rust/napi glue 里被别的导出函数直接调用）无法由静态字面量判定；Ghidra 反编译在 330 s 超时。缺的一步 = 先用 `D:/DevEnv/ghidra_12.1.4/support/analyzeHeadless` 对 `mtree.win32-x64-msvc.node` 预建项目库，再用 `rea decompile --snapshot <库>` 复用库取 xrefs。本席未做，不得据此冒判"死代码"。
5. 旁证（推断）：`qoder-search.bundle.mjs@5,287,973 / 5,288,757` 的遥测字段把 `enable_simhash`/`simhash_enabled` 恒置 `"false"`，另有 `mtree-build-failed`/`server-index-end` 动作名 ⇒ simhash 族在**当前构建里被功能开关关掉**，与"native 导出无 JS 消费方"同向（推断，依据=字面量恒 false 的埋点，非分支证据）。

## 3. 主程序能力取证表（主进程面）

| # | 能力 | 三态 | 证据锚点（路径 + 偏移/行） | 一句话 |
|---|---|---|---|---|
| 1 | 主进程 DI 能力总账 | 观察 | `app.asar:/out/main/electronMain.js@18,509,841`（4.2 KB 注册块内 156 个唯一键） | 一次可读出全部分层能力名，含 15 个 `chatSession*`、17 个 `native*` |
| 2 | 会话冷启动/恢复 | 观察 | 同上块内 `workspaceModeRestoreService`/`sessionWorkspaceRootResolver`/`chatSessionCompositionService`/`applicationExitGuardService`；`resumeSession`(8 处)/`activeChatSessionId`(2)/`openSession` | 工作区模式 + 会话根解析 + 退场守卫三段式恢复 |
| 3 | 跨产品迁移（含竞品） | 观察 | 同块内 `sessionMigrationService`/`memoryMigrationService`/`codexMigrationDiscoveryService`/`workBuddyMigrationDiscoveryService`/`workBuddyMemorySyncService`/`codexMemorySyncService`/`remoteQoderIdeMigrationService`/`qoderWorkMigrationService`/`onboardingDataImportService` | 把 Codex/WorkBuddy/Qoder Work 的会话与记忆**发现→迁移→持续同步**，6 枚 migration 族 |
| 4 | 设备/进程侧车与远控 | 观察 | `/out/main/remoteControlProcess.js`(7,157B)、`remoteControlScopeDatabase.js`(15,963B)、`remoteSdkDaemonBridge.js`(1,396B)；块内 `peerDeviceService`/`peerSessionCatalogWatch`/`peerProjectionService`/`qoderCliDaemonService`/`qoderRemoteControlControllerService` | 手机/远端可控本地会话，作用域自带库 |
| 5 | 数据目录单例 + 认领文件 | 观察 | `/out/main/dataDirectoryProcess.js`（原子 rename 发布 `{pid,interfaceLanguage,…}` 认领件，mode 384）| 多实例互斥 + 语言面握手；文件被混淆（唯一例外面） |
| 6 | MCP 本地路由守护 | 观察 | `~/.qoder-cn/mcp-router.json` 字段形态 `{schemaVersion,pid,baseUrl(127.0.0.1:随机口),apiKey,startedAt}`（值不入报） | 宿主起一个带 per-process key 的 localhost MCP 路由，指针文件即服务发现 |
| 7 | 宿主即 Node 运行时（Electron run-as-node） | 观察 | `electronMain.js@4,008,564`（`bundledExecutablePath`+`electronRunAsNode`）+ 插件 `mcp.json` 的 `${QODER_NODE_RUNTIME}` | 不另装 node，复用自身 exe 跑插件/MCP 子进程 |
| 8 | 插件贡献/权限声明模型 | 观察 | `resources/extensions/catalog.v1.json`（10 枚内建插件、33 条权限名、15 种 activationEvent、8 类 contributes 含 `nativeModules`/`qoderAgentSdk`/`sessionResources`/`chatMentionProviders`） | 声明式能力面 + 细粒度权限词表 + 激活事件 |
| 9 | 内置资源装机策略 | 观察 | `bundled-resources/manifest.json`（`install.presence="ensure-minimum"`、`revision`、`archive.sha256`、`maxEntries`/`maxExpandedBytes`、逐文件 sha256 清单）| 随包插件按"最低版本保证"安装，且解压配额显式封顶 |
| 10 | 双更新通道 | 观察 | ①`app-update.yml`(generic provider `static.qoder.com.cn/qoder-app/releases` + `updaterCacheDirName`)+`electron-updater@6.8.9`；②`fast-update/qoder-fast-update-manifest.json`（逐文件 sha256 覆盖 dll/pak/locales）+ `qoder-fast-update.cat` + `qoder-fast-update-trust.exe`(18,944B，串含 `Qoder Windows Fast Update Trust Anchor`、`Qoder.Space.WindowsFastUpdate`) | 通道 A 换整包，通道 B 只换运行时二进制且验 Authenticode 信任锚 |
| 11 | 启动器托管的快切换 | 观察 | `launcher/Qoder CN Launcher.exe`(141,824B，.NET) 串：`CanSuperviseFastHandoff`/`FastHandoffRejectionReason`/`FastApplyingWaitTimeout`/`IsFastApplyingTimedOut`/`IsSystemNsisUpdate`/`PollUpdate`/`UpdatePollResult`/`ManifestSha256` | 更新由外部启动器监管：有拒绝原因枚举、超时判定、NSIS/系统面分支 |
| 12 | 浏览器连接器协议 | 观察 | `native-messaging-host/qoder-app-host.cjs`(3,559B)：扫 `~/.qoder/browser-connector/clients/*.json`，记录 `{id,port,pid,timestamp}`，`staleAfterMs=30_000`、未来时刻容差 5s、`process.kill(pid,0)` 判活（EPERM 视为活）、非法记录即删；`background.js`(301,120B) 内三个宿主名 `com.qoder.app.connector`/`com.qoder.browser_connector`/`com.qoder.work.connector` | 用"带心跳的认领件目录"做本地服务发现，无需固定端口 |
| 13 | 扩展包供应链钉死 | 观察 | `browser-connector/chrome-extension.json`：`{version,url,publicKeyMode:"fixed_dev",extensionId,sha256}`；MV3 manifest 权限 14 项 + `externally_connectable` 5 源白名单 | 第三方分发物按"扩展 ID + sha256 + 版本化 URL"三钉装载 |
| 14 | 协作协议（issue/discussion/team） | 观察 | `collaboration-cli/dist/host/{index.js 1,356,094B,entry.js 1,229,809B}` + `skills/desktop/SKILL.md`(8,860B) 与 3 篇 references；命令面 `project list`/`message send`/`file read --file-id`/`agent inspect`/`project-invitation create`/`team-task delegate`；内建工具 `list_agents`/`create_team_task` + `leaderSessionId`/`wait_chat_sessions`/`send_message_to_chat_session`；三身份 User/RuntimeOwner/RuntimeAgent；批次上限 100 项、附件 10 件×50 MB、turn-scoped `localPath` 用完即清 | 身份由宿主按可信会话上下文选定且禁止从资源 ID 反推，拒绝后不得换身份重试 |
| 15 | 动态文案下发 + 包内兜底 | 观察 | `dynamic-text/qoder-cn.json`（2 个 locale × 60 键，全部 `model.*` 的 label/description/detail 三元组）；`electronMain.js@19,473,138` 的 `dynamicTextFallbackFilePath:{productId,isPackaged,resources…}`；块内 `dynamicTextService`+`agentResultErrorTextService`+`cloudConfigurationService`；IPC 通道表 `/out/main/chunks/gCdH7wBw.js@51,523`（`dynamicTextGet`/`dynamicTextChanged`） | 文案走远端配置服务，安装包只带一份"绝不显示裸 key"的兜底快照 |
| 16 | 会话侧写盘簇（CLI 面） | 观察 | `~/.qoder-cn/` 现读：`file-history/<sid>/<uuid>@vN`(244 目录)、`tasks/`(275)、`shell-snapshots/snapshot-bash-<ts>-<rand>.sh`(144)、`session-env/<sid>/sessionstart-hook-4.sh`(7)、`memory/*.md`(46，含 MEMORY.md 与 `feedback-*.md`)、`logs/sessions/<proj>/<sid>/segments/*.jsonl`、`logs/runs/<ts-pid>/{manifest.json,qodercli.log}`、`host-actions/result-index/<sha64>-<uuid>.json`、`skill-usage.json`(10 项) | 每会话一套版本化文件快照 + shell 快照 + hook 注入件 + 分段只追加转写 |
| 17 | 钩子宿主（主进程侧） | 观察 | `electronMain.js@6,832,892 / 11,157,903 / 5,707,881`：返回 `{PreToolUse:[{matcher,hooks:[…]}],PostToolUse:[…],PostToolUseFailure:[…]}`；块内 `userHooksService`；`…/builtin/hook-config/SKILL.md` | 主进程内联装钩子，三事件带 matcher（`Stop`/`UserPromptSubmit`/`SubagentStop` 在主包 0 命中） |
| 18 | 语音/实时与投屏 | 观察 | 块内 `voiceRecognitionService`/`liveVoiceService`/`voiceDiscussionService`/`liveVoiceOverlayService`/`dynamicIslandService`/`companionOverlayService`/`hostedPresentationService`；`node_modules/aoq-electron-sdk`(32.5 MB，含 `AoqClientSdk.dll`/`PluginOpus.dll`/`alivcffmpeg.dll`) | 实时音视频 SDK 直接入包，配桌面浮层与"灵动岛"式提示 |
| 19 | 观测/诊断自证 | 观察 | 块内 `coreObservabilityService`/`telemetryService`/`processPerformanceMonitorService`/`devV8MemoryProfilerService`/`nativeCrashService`/`crashFeedbackService`/`networkDiagnosticsService`/`architectureMismatchService`；`@arms/rum-electron` 依赖 | 崩溃、性能、V8 内存、架构不匹配各有专责服务 |
| 20 | 包内依赖画像 | 观察 | asar `/package.json`(2,604B) + 154 个 npm 包：`@modelcontextprotocol/{client,server,sdk,core,node}` 全家桶、`hono`+`@hono/node-server`、`ws`、`eventsource`、`jose`、`croner`、`proper-lockfile`、`undici`、`node:sqlite`(主包 import) | 桌面内自带 HTTP 服务器 + 调度器 + 锁文件 + 嵌入式 SQL 引擎 |
| 21 | 宿主注入的会话/Turn 上下文协议 | 观察 | `resources/node-repl/nodeRepl/UPSTREAM.md`（两条能力名 `com.node-repl/request-context-v1` 注工作区+额外可读目录、`com.node-repl/turn-context-v1` 注会话与 Turn 标识，并明文"仅可信宿主注入、工具参数不能覆盖"）；`resources/node-repl/package.json`（`@ali/node-repl` 1.1.2 / `@ali/qoder-cu-sdk` 1.1.0 / `@ali/qoder-browser-use-sdk` 0.4.2） | REPL 型工具的身份来自宿主注入而非入参，与本仓 §5「身份不得住客户端可整写字段」同型 |
| 22 | 插件 runtime 角色契约 + napi ABI 闸 | 观察 | 插件 `runtime/runtime-manifest.json`（`javascriptRuntime:{source:qoder-electron, electronRunAsNode:true, bundled:false}`、`mtreeNapiVersion:10`、`files` 8 个角色名 entry/scanWorker/legacyMigrationWorker/mtreeLoader/mtreeBinary/ripgrep/assetModule/assetBinary、`build.minified:true`）；`app.asar.unpacked/…/_worker/runtime-info.json`（自带 git commit `0eb78f009c6510fe…`、`build.site:cn`、`assets.ripgrep`、并把 CI 绝对路径整串落进产物） | 原生件按"角色名 + napi ABI 版本号"配对装载；构建溯源随包发布（对方此处泄露了内部 CI 路径 = 我们的反向教训） |
| 23 | 上游仓库结构自证 | 观察 | `qoder-search.bundle.mjs@3,913,303–3,913,450` 内嵌其 monorepo `package.json` 字面量（`packages/search-engine/native/mtree/{index.js,index.d.ts,*.node}`、exports `./plugin-runtime/index-settings-client.js`、`./knowledge`→`knowledge-client.js`、peer `@ali/qoder-knowledge-kit@^0.31.0`、dep `@vscode/ripgrep@^1.18.0`） | 打包器把 workspace 清单当常量写进产物 ⇒ 未发布即可被读出模块边界（本仓水印/溯源纪律的反面教材） |

## 4. 与 IHUI 对位缺口表（按落地价值降序，前 8 条可直接开工）

| 能力 | 本仓现状（路径:行，现读） | 档位 | 建议落地面 | 超越轴 |
|---|---|---|---|---|
| 协作身份由宿主入参 + 拒绝后禁换身份（#14） | `apps/ai-service/app/core/jwt_auth.py:322`（`async def require_request_user_id`，令牌主体由承载层显式入参）；`AGENTS.md §5「认证不等于授权」`；无任何 issue/discussion 命令面（`grep teamTask\|createTeamTask` 于 `apps/api/src/routes/subagents-extended-routes.ts` = 0 命中） | **零对位=落地候选** | `apps/cli/src/commands/`（新 `collab-*`）+ `apps/api/src/routes/` + `packages/types/src/capability-catalog.ts:31-37`（`CAPABILITY_DATA_CLASSES` 登记） | 他们靠 SKILL.md 口头约束身份；我们把三身份 + "拒不改投" 做成 `capability-catalog` 机器判据并加守门，且批次上限(100)与附件上限当场回 `missedIds`（对齐 §134 批量写诚实性） |
| 动态文案下发 + 包内兜底快照（#15） | `apps/cli/src/announcements/index.ts:6-16`（拉公告 + TTL 缓存）；`packages/i18n/messages/*`（静态五语言）；模型展示名散在 `apps/web/app/(main)/settings/llm/types-v2.ts` | **半格（缺"文案目录随包兜底 + 键集对齐校验"）** | `packages/i18n/` 增 `dynamic-catalog`（远端拉 → 本地快照 → 启动即用）+ `scripts/check-i18n-keys.mjs` 同源对账 | 他们只 2 locale×60 键；我们已有五语言 parity 门，把动态目录纳入同一 parity 判据即"覆盖更全 + 破损可检" |
| 本地服务发现 = 带心跳的认领件目录（#12/#6） | `apps/cli/src/server/http-server.ts:39,89`（默认绑 127.0.0.1）+ `apps/cli/src/server/ws-bridge.ts:120`（origin 白名单）；无 pid 心跳件、无 native messaging（`grep nativeMessaging` 全仓仅 `docs/benchmark-evidence/**` 5 篇文档命中） | **零对位=落地候选** | `apps/cli/src/server/` 增 `clients/<id>.json` 认领件（port+pid+timestamp+30s 陈旧）与 `apps/extension/` 宿主名登记 | 他们的判定不含签名；我们加"认领件写方身份 = 本仓 `installation_id` 同族键"并配只读哨兵（§5e-1 可整改性），杜绝伪造 client 记录 |
| 双更新通道 + 启动器托管快切换（#10/#11） | `apps/desktop/src-tauri/tauri.conf.json:44-46`（endpoints+minisign pubkey）、`:60`（createUpdaterArtifacts）；`apps/cli/src/updater.ts:6-19`（仅"提示有新版"）；无逐文件 sha256 运行时清单、无信任锚校验器 | **半格（只有整包通道，缺"运行时件差分 + 外部监管交接"）** | `scripts/desktop-build.mjs` 产出 `fast-update-manifest.json`（逐文件 sha256）+ `apps/desktop/src-tauri/src/` 增 apply/verify 腿 | Tauri 侧把"拒绝原因/超时"显式化（借 `FastHandoffRejectionReason` 语义），并让校验失败**默认不动当前版本**（对方 exe 级信任锚我们可用 minisign 同强度且可测） |
| 插件贡献/权限词表 + 激活事件（#8） | `packages/types/src/capability-extensions.ts:25-37`（激活事件枚举 + `EXTENSION_CONTRIBUTION_KINDS = ['tools','commands','views']`）、`:136-142,258-298`（校验器）；装机策略见 `apps/cli/src/commands/plugin-updates.ts:113` | **半格（贡献类型 3 类 vs 对方 8 类；无 `nativeModules`/`sessionResources`/`chatMentionProviders`）** | `packages/types/src/capability-extensions.ts:36` 扩词表 + `apps/cli/src/plugins/` 消费；新增档须同批有消费方（AGENTS §4 圆角同源教训） | 把权限词表接到 `capability-catalog` 的 dataClass（默认拒绝），对方 catalog 只有声明无运行时数据类切分 |
| 内置资源装机策略 + 解压配额（#9） | `apps/cli/src/commands/plugin-marketplace.ts`、`registry-install.ts`；现读无 `presence` 策略与 `maxEntries/maxExpandedBytes` 等价物（`grep -r ensure-minimum/maxExpandedBytes apps packages` = 0） | **零对位=落地候选** | `apps/cli/src/lib/registry/`（cache.ts 同层）加 `ensure-minimum` 语义 + 解压炸弹上限 | 我们的守门体系可把"清单腐烂/过期"纳入 §0.7 验过才免，对方只有装机策略无到期判据 |
| 会话侧写盘簇：版本化文件快照 + shell 快照 + hook 注入件（#16） | `apps/cli/src/checkpoints/{hunk-tracker.ts,index.ts,manifest-integrity.ts}`、`apps/cli/src/sessions/state-store.ts:32-37,105,138,157,173`、`apps/ai-service/app/core/shell_snapshot.py:37`（`SNAPSHOT_DIRNAME = "shell-snapshots"` —— 与对方目录逐字同名）、`apps/ai-service/tests/test_shell_snapshot_wiring_55.py:49` | **已有对位（快照/状态件/shell 快照均在）；缺"每会话 `<uuid>@vN` 可寻址版本序列"** | `apps/cli/src/checkpoints/manifest-integrity.ts` 旁增版本命名与 GC（他们 244 目录 65 版无清理 ⇒ 我们补死亡机制，AGENTS §"工作队列必须有死亡机制"） | 我们的 LangGraph checkpoint（`apps/ai-service/app/main.py:985-990`）+ `resume_agent_execute`(`routers/agents.py:1916,1995,2257`) 已在服务端，属**双端更强** |
| 跨产品迁移/记忆同步族（#3） | 仅 WorkBuddy/Qoder/Trae 的**重置**器：`apps/desktop/src-tauri/src/{workbuddy_reset.rs,qoder_reset.rs,minimax_reset.rs}`；无发现→迁移→持续同步三段；`docs/benchmark-evidence/2026-10/` 亦无对位实现 | **零对位=落地候选** | `apps/cli/src/commands/import-sessions.ts`、`import.ts`（已有入口）扩为"发现器 + 迁移器 + 同步器"三层，键形沿用 `projects/<sanitized>-<hash8>` | 对方迁移=单向吸量；我们做成显式 dry-run + 落 `.ihui-agent/tmp` 可回滚，并加 `check-delivery-report-consistency` 同族守门 |
| 宿主即 Node 运行时 / run-as-node（#7） | `apps/cli` 以 npm 包形态直跑 node；`apps/desktop` Tauri sidecar 另装；无"复用自身 exe 当 node" | **零对位=低优先** | 先不做（收益 = 少一个 node 依赖，代价 = 启动器复杂度）；若做，落 `scripts/dev-with-warmup.mjs` 同层启动器 | — |
| MCP 本地路由守护（#6） | `apps/cli/src/commands/mcp-config.ts`、`mcp-market.ts`；`apps/ai-service/app/services/mcp_server.py:198-206`（`_mcp_permission_profiles_enabled_from_env`：env `MCP_PERMISSION_PROFILES_ENABLED` 默认 off）；无 localhost 路由 + 随机口 + per-process key | **半格（有 MCP 栈，缺"多客户端共享路由"）** | `apps/cli/src/server/` 增 router：指针文件含 `{pid,baseUrl,startedAt,keyRef}`，密钥**不落盘**（只存 fp 前缀，对齐 `scripts/data/exposed-credentials.jsonl` 纪律） | 对方 `apiKey` 明文进 JSON；我们只存指纹 + 到期 + 轮换器（§"暴露凭据主动轮换器"）= 同能力更安全 |
| simhash/海明距/加权树/快照比对原语（#2 死导出面） | `apps/ai-service/app/services/codebase_indexer.py:61,1370,1455-1470,1506`（`compute_simhash`+`RENAME_MAX_HAMMING`+汉明候选）、`dir_rhash.py:9,72,107,140`（自底向上前像 + `diff_dir_rhash`）、`rename_detect.py`、`context_engine.py` | **已有对位（Python 面全有）** | 不新建；把 `writeSnapshotToFile/readSnapshotFromFile`（持久化树快照）补到 `dir_rhash.py` 旁 = 增量索引省一次全扫 | 对方 4 枚 zstd/快照件导出在交付里无人调用（本席 §2）；我们只在有消费方时落盘格式，避免死面 |
| 宿主注入 session/turn 上下文、工具参数不可覆盖（#21） | `packages/types/src/tool-contract.ts:210`（`ROUTING_IDENTITY_KEYS`）与 `:238`（明文"路由身份由宿主在 closure/ctx 绑定，只准放业务入参"）、`packages/types/src/schema-projection.ts`；服务端侧 `apps/ai-service/app/core/jwt_auth.py:322` | **半格（键集禁入已有，缺"Turn 级作用域 + 注入面被拒收的机器判据"）** | `packages/types/src/tool-contract.ts:210` 扩 turn 作用域键 + 新守门（差值棘轮）判"工具入参 schema 出现身份键即红" | 对方只在文档里写"不能覆盖"；我们把这条做成提交链判据（对齐 §0.9"判据必须装车"）= 同能力可证 |
| 插件 runtime 角色契约 + napi ABI 版本闸（#22） | `apps/cli/src/commands/mcp-config.ts`（命令级配置）；无"角色名清单 + ABI 闸"层（现读 `grep -rn --include=*.ts --include=*.py --include=*.mjs --include=*.rs` 于 `apps packages scripts`，关键字 `napiVersion`/`mtreeBinary`/`assetModule` = 0 命中） | **零对位=落地候选（低优先，等有原生件时再装）** | `apps/desktop/src-tauri/` 与 `scripts/desktop-build.mjs` 产物侧新增 `runtime-roles.json`（角色名 + sha256 + abiVersion），装载前校验，取不到即 exit 2 未判定 | 对方 ABI 闸只有一个整数；我们同时钉 sha256 + 到期（§0.7"验过才免"）+ 缺角色即拒装 |
| 构建溯源随包发布（#22/#23 反面） | `scripts/watermark.mjs`（三层水印）；本仓无同名自证清单（现读 `grep -rn --include=*.ts --include=*.mjs --include=*.json build-manifest apps scripts packages` = 0 命中） | **半格（有水印链，无"装机可自证 commit/electron 版本"清单）** | `apps/cli` 启动时读本仓版 `build-manifest.json`（productVersion/commit/electronVersion/symbolSetId），并让 `apps/cli/src/min-version-probe.ts` 与它对账 | 对方把内部 CI 绝对路径漏进产物（#23）；我们只放脱敏字段 ⇒ 可自证且不泄露 |
| 主进程能力总账可读出（#1） | `packages/types/src/capability-catalog.ts:31-37`（`CAPABILITY_DATA_CLASSES` = 对外开放面单一真相源）；无内部服务总账 | **半格（对外面有，内部面散）** | 不动业务；以 `capability-catalog` 为核，把 `apps/ai-service/app/main.py` 的启动服务清单导出为可 diff 快照 | 对方注册块运行时才可见；我们入库可被守门 diff ⇒ 漂移即红 |

## 5. 复验命令（本席实跑过的）

```bash
# 现场与靶
cd /g/IHUI-AI && git rev-parse HEAD
ls -la "/g/Qoder CN/.qoder-versions/0.5.3/resources/"

# asar 索引尺（本席产出，6435 条目 → 归属任意字节）
cd /g/IHUI-AI/.ihui-agent/tmp/rea-goal-b49
python asar_grep.py 'dynamicTextService' 4          # → /out/main/electronMain.js in-file@18509841
python asar_grep.py 'native/mtree' 5                # → hits 0（主程序从不装载 mtree）
python asar_grep.py 'mtreeNapiVersion' 3            # → hits 0
python dump.py "/out/main/electronMain.js" 18509841 2200   # DI 注册块（需 MSYS_NO_PATHCONV=1）

# §2 的 23×6 消费方矩阵（一次性打印，含 index.cjs/.node/worker-runtime）
cd /c/Users/Administrator/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/1.0.91.b22f2d0a/runtime
#   （脚本内 names=23 枚 × files=6 面；末行输出 JS-consumer-absent = 本表 10 枚）

# 结构性判定：asar 内无 mtree 二进制
python -c "import json;i=json.load(open('asar-index.json'));print([e['path'] for e in i if e['path'].endswith('.node')][:8])"

# 主包未混淆（字面量检索可信）
grep -a -c 'decodeURIComponent(h)' electronMain.js   # 0
grep -a -o 'Service:' electronMain.js | wc -l        # 381

# 注册块读数（156 唯一键）
python -c "d=open('electronMain.js',encoding='utf8',errors='replace').read();import re;s=d.find('agentConfigurationService:\$2');e=d.find('pluginMcpContributionController',s);print(len(set(re.findall(r'([A-Za-z][A-Za-z0-9_]*):',d[s:e+40]))))"

# 装机/更新/协作/文案面
cat "/g/Qoder CN/.qoder-versions/0.5.3/resources/app-update.yml"
head -c 400 "/g/Qoder CN/.qoder-versions/0.5.3/resources/fast-update/qoder-fast-update-manifest.json"
cat "/g/Qoder CN/.qoder-versions/0.5.3/resources/native-messaging-host/qoder-app-host.cjs" | head -60
cat "/g/Qoder CN/.qoder-versions/0.5.3/resources/browser-connector/chrome-extension.json"
head -40 "/g/Qoder CN/.qoder-versions/0.5.3/resources/collaboration-cli/collaboration-cli/skills/desktop/SKILL.md"

# REA（如实登记：①③在时限内失败，非"没跑"；②成功）
export PATH="/d/caches/npm/prefix:$PATH"
# 先重建切片（本席收尾时已删掉 42 MB 对方 bundle 副本，只留索引尺与证据）
MSYS_NO_PATHCONV=1 python - <<'PY'   # 同 §1 的 base=16+1687407；把 /out/main/*.js 落到 app-main/
PY
rea analyze-javascript-application app-main --artifact-format directory --format toon --analysis-timeout-ms 120000 --token-limit 9000        # ① provider_timeout @electronMain.js，partial 565 节点
rea analyze-javascript-application app-main-small --artifact-format directory --format toon --analysis-timeout-ms 300000 --token-limit 5000  # ② 成功：evidence_id ev_b00ac554…，582 节点
rea decompile "<…>/runtime/native/mtree/mtree.win32-x64-msvc.node" --procedure computeSimhash   # ③ 需 GHIDRA_INSTALL_DIR + JAVA_HOME；330 s provider_timeout
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
