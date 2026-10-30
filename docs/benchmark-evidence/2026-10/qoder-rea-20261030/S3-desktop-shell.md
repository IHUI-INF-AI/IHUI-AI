<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S3 席报告 — Qoder CN 0.4.11 桌面壳 + 内置扩展 + 用户态数据布局

> 认领@2026-10-30/S3
> 取证根:`G:\Qoder CN\.qoder-versions\0.4.11\`;用户态:`C:\Users\Administrator\.qoder-cn\`、`C:\Users\Administrator\AppData\Roaming\com.qodercn.app.stable\`
> 席位约束:只读;不解包 app.asar,不遍历 agent-sdk(S2/S7 射程)。
> 每条结论标 [观察]/[推断]/[未知];[观察] 带一手证据路径。
> 凭据红线:`.auth\`、`auth.v1.dat`、`*.dat`、token/密钥/登录态一律只记文件名+字节数,不读内容。

## 0. 产品身份与更新通道 [观察]

- `resources/product.json`(541B):`productId=qoder-cn`、`channel=stable`、`appId=com.qodercn.app`、`dataDirectoryName=com.qodercn.app.stable`、`protocolScheme=qoder-cn`、`windowsLauncherDirectory=Qoder CN\Qoder CN Launcher`、`windowsLauncherFileName=Qoder CN Launcher.exe`、`windowsLauncherMutexName=Local\QoderSpaceWindowsLauncher-qoder-cn`、`desktopUpdateDownloadBaseUrl=https://static.qoder.com.cn/qoder-app/releases`。
- `resources/build-manifest.json`(456B):`schemaVersion=1`、`productVersion=0.4.11`、`releaseChannel=stable`、`commit=d9996760…`(全 40 位)、`electronVersion=43.1.1`、`platform=win32`/`arch=x64`、`installerType=user`、`buildNumber=82468212`、`buildTime=2026-10-23T06:45:57Z`、`symbolSetId`。
- `resources/install-type.json`(23B)= `{"installType":"user"}`;`resources/app-update.yml`(108B)= electron-updater `provider: generic` + `updaterCacheDirName: qoder-cn-updater`。
- **多版本共存**:`G:\Qoder CN\.qoder-versions\` 下并存 `0.4.9/`、`0.4.11/`、`0.5.1/`,每枚旁挂 `<ver>.qoder-update-ready.json`(139–140B,字段 `releaseId`/`archiveSha256`/`payloadLayout=pending-asar-v1`);下载缓存在 `G:\Qoder CN\.qoder-update\downloads\`。
- **Launcher 是唯一启动入口**:`AppData\Local\Qoder CN\Qoder CN Launcher\state.ini`(154B,INI 而非 JSON):`[launcher] schemaVersion=3 / status=healthy / installDir=G:\Qoder CN / appExecutable=Qoder CN.exe / targetVersion=0.5.1 / updatedAt=…`,同目录 `install.ini`(115B)、`launcher-diagnostics.log`(38 KB)、`state.ini.writers/`(写者锁目录)、`i18n/{en-US,zh-CN}.properties`。壳体内置副本:`resources/launcher/Qoder CN Launcher.exe`(128 KB)。
- [推断] 更新是三段式:fast-update 文件级清单(见 §1)+ 版本目录整包落 `.qoder-versions/` + Launcher 原子切 `targetVersion`;`.qoder-app-status.json` 报 `version=0.5.1` 而取证根是 0.4.11,说明**正在运行的产品已切到 0.5.1**,0.4.11 是被留存的旧版本目录(可回滚)。

## 1. resources/ 壳层能力载体逐目录盘点 [观察]

| 目录 | 体积 | 载体性质 | 关键文件与字节数 |
|---|---|---|---|
| `node-repl/` | 3.4 MB | **持久 JS/Node 求值内核** | `nodeRepl/index.cjs` 626 KB、`runtime/kernel.mjs` 40 KB、`runtime/moduleLoader.mjs` 18 KB、`tree-sitter-javascript.wasm` 647 KB + `tree-sitter.wasm` 187 KB(= 用语法树做 REPL 内省/编辑);`package.json` 声明 `@ali/node-repl@1.1.2`、`@ali/qoder-cu-sdk@1.1.0`、`@ali/qoder-browser-use-sdk@0.4.2`;`node_modules/@qoder-space/{browser-use,computer-use}` |
| `bin/` | 3.6 MB | **原生能力 .node 模块(4 枚)** | `native_clipboard.node` 721 KB、`notification_permission.node` 1.5 MB、`dji_mic_button.node` 785 KB(DJI 麦克风硬件按钮!)、`appshot_bare_modifier_monitor.exe` 714 KB(裸修饰键全局热键监听) |
| `umid/` | 7.5 MB | **设备指纹/风控** | `sgsdk.dll` 7.35 MB(阿里安全 SDK)、`runtime-info.exe` 480 KB、`manifest.json`(字段 `schemaVersion/target/qoderCliVersion=1.1.75-hotfix.1/sdkPackageName=@qoder-ai/qoder-cn-agent-sdk/sdkVersion=1.0.56-alpha.6/files[].sha256`) |
| `dynamic-text/` | 9.9 KB | **免发版远程文案(模型名映射)** | 仅 `qoder-cn.json`,顶层 `en`/`zh`,各 51 键,全部是 `model.<代号>.{label,detail,description}`(cmodel/dmodel/gmodel/kmodel/mmodel/qmodel/qfmodel/dfmodel/gfmodel/*_latest/*_38max + auto/lite/performance/efficient/ultimate) |
| `fast-update/` | 750 KB | **文件级增量更新清单 + 可信根** | `qoder-fast-update-manifest.json` 163 KB(`{schemaVersion,files[{path,size,sha256}]}`)、`qoder-fast-update.cat` 565 KB( Authenticode 目录)、`qoder-fast-update-trust.exe` 18 KB |
| `collaboration/` | 4.4 KB | **协作域只以 Skill 形态下发** | 唯一文件 `skills/SKILL.md`(4410 B,frontmatter `name/description`);正文点名 `mcp_list/mcp_get/mcp_call` 三段式工具发现、RuntimeUser/RuntimeOwner/RuntimeAgent 三种身份、Project 访问审批 |
| `qoder-helper/` | 8.7 KB | **产品自诊断/自设置 Skill** | `skills/SKILL.md`(8730 B,可读写应用设置的 `qoder-settings` 工具)、`skills/evals/boundary-cases.md`、`skills/references/answer.md` |
| `native-messaging-host/` | 3.5 KB | **浏览器扩展↔桌面宿主** | `qoder-app-host.cjs`(读 `~/.qoder/browser-connector/clients/*.json`,逐条校验 `id/port/pid/timestamp`,30 s 视为陈旧、未来时刻容差 5 s、`process.kill(pid,0)` 判活,失效记录即删) |
| `elevate.exe` | 118 KB | 提权垫片(单文件) | — |
| `launcher/` | 133 KB | 多版本切换器 | 见 §0 |
| `tray/` | 19 KB | 托盘图标 | `tray.ico` |
| `application-icons/` | 0.7 MB | **应用内 app 图标库** | 8 枚 PNG,`{qoder,qoduck}×{light,dark}×[-windows]`(qoduck = 桌宠形象素材) |
| `bundled-resources/` | 7 MB | **插件离线预置(装机即有)** | `manifest.json`(4.5 KB):`resources[].{id,kind=qoder-plugin,version,revision,required,install{folderName,pluginId,presence=ensure-minimum,defaultEnabled,userVisible},archive{path,size,sha256,root,maxEntries=90,maxExpandedBytes=19430823},files[].sha256}`;两枚 zip:`qoder-cn-context-plugin`(1.0.84.f756706)、`qoder-cn-computer-use` |
| `PS/` | 0 | 空目录(与 `umid/PS/` 同名,阿里安全 SDK 落地残留/占位) | [未知] 用途 |
| `app.asar` | 189 MB | 主进程+前端(射程外,S7) | 未解包 |

## 2. 内置扩展层(9 枚 app-plugin + 11 枚内嵌 agent-sdk plugin)[观察]

清单唯一真相源:`resources/extensions/catalog.v1.json`(86.8 KB)= `{schemaVersion:1, productId:"qoder-cn", profile:"stable", plugins[9]}`;每枚 `{id,name,version,root,enabledByDefault,manifest(完整 JSON 对象),files[]:{path,sha256}}` —— **manifest 与逐文件 sha256 都在清单里,即"清单即完整性校验"**(壳层可离线验证插件未被篡改)。9 枚全部 `enabledByDefault:true`。

贡献面(contributes)按枚摘要,键名照抄、值不抄源码:

- `qoder.canvas` 28 MB / v0.1.0 — `views[canvas-preview @file.preview]`、`filePreviewers[canvas-tsx: filenameSuffixes=[".canvas.tsx"], refreshPolicy="live"]`、`qoderAgentSdk.plugins=[cli/canvas]`;permissions 6(含 `chat.attachAnnotation`、`chat.sendToSourceSession`、`files.readSessionResource`)。CLI 侧带 `resources/recipes/*.recipe.md` 7 份(code-review / design-system / format-viewer / presentation / report / sequence-diagram / index)与 `resources/sdk/*.d.ts` 组件表(core-primitives、chart-primitives、palettes、force-graph-layout、hooks…)→ **Canvas 是"产物 DSL + SDK 类型面 + 配方"三件套**。
- `qoder.communication` 2 MB / v0.1.0 — `views[im-channels @settings]`(企业微信/钉钉关键词),main=`dist/node/server.cjs`;permissions 16,含 `chat.interruptTurn`、`chat.observeTurn`、`extensions.manage`、**`mcp.registerInProcess`**。
- `qoder.computer-control` 1 MB / v1.0.0 — `configuration` 4 组(section `settings.browserControl`,group id `computer-use` / `record-and-replay`,带 `enablement.type=operatingSystem+versions`);`qoderAgentSdk.plugins` 5 路按 **配置键 ∧ 操作系统** 双条件门控:`browserUse`、`computerUseMacOS(darwin>=14.0)`、`computerUseWindows(win32>=10.0)`、`computerUseLinux(linux *)`、`recordAndReplay`;`nativeModules[1]`:`id=picture-in-picture-host, resourceId=qoder-computer-use-presentation-provider, lifecycle=plugin`(画中画宿主)。`recordAndReplay/.mcp.json` 声明 MCP server `event-stream`(command=node + `${QODER_PLUGIN_ROOT}/bin/computerUseClientLauncher.cjs`,timeout 220000,env_vars `QODER_HOME/QODER_CHAT_SESSION_ID`)。
- `qoder.knowledge.center` 10 MB / v0.1.1 — `views[3]`(`knowledge-center-workbench @workbench`、`qmind-source-preview @session.resource`、`knowledge-mention-preview @chat.mentionPreview`)、`sidebarNavItems[1] slot=workbench.sidebar.secondary`、`sessionResources[1](qmind-sources + taskMonitorSection)`、`chatMentionProviders[1](id=knowledge, onUnavailable=continue)`、`configuration{wikiConsumption/qmind/repoWiki.enabled 默认 true}`、activationEvents 含 **`onChatMention:knowledge`**;内嵌两枚 SDK 插件 `cli/qoder-qmind`(`mcp.json`:server `qoder-qmind`,command `${QODER_NODE_RUNTIME}`,env_vars `QMIND_HOME/QMIND_ENV/QODER_ENV`)与 `cli/qoder-repowiki`。permissions 17(含 `auth.readUserToken`、`files.stageLocal`、`workspace.readProjects`、`session.provideResources`、`chat.provideMentions`)。
- `qoder.office` 14 MB / v0.4.0 — `views[presentation @file.preview]` + `filePreviewers[pptx priority=100, hostHeader=hidden, tabIcon=hidden, hoverPreview=disabled, refreshPolicy=onOpen]`;`dist/node/fullEditor` + `fontAssets`(端内自带 PPTX 编辑器与字体)。运行侧派生 `~/.qoder-cn/bin/qoder-office-xlsx/xlsx-sidecar.exe`(**Office 走原生 sidecar 进程**)。
- `qoder.security` 1 MB / v0.3.0 — `views[security-settings @settings, directoryId=security]`、`configuration{l1StaticCheck,l2LightweightScan,l3DeepScan 默认 false}`、`qoderAgentSdk.options.securityScan` 用 **`$configuration` 变量引用**把同一把设置直接透进 SDK 选项面。
- `qoder.sites` 11 MB / v0.1.0 — `views[sites-portal @workbench, sites-publish-preview @file.preview]`、`sidebarNavItems[1]`、`filePreviewers[.qoder.site]`;`dist/plugin` 带 4 枚 skill + `execution.md`。permissions 12(含 `network.readProxy`、`enterprisePolicy.read`)。
- `qoder.find-extensions` / `qoder.desktop-pet-skill`(各 1 MB,v0.1.0)— `activationEvents=[]`、`permissions=[]`、只挂一枚 SDK 插件(`cli/findExtensions`、`cli/desktopPetSkill`);后者额外贡献 `commands/petdex.md`(**命令以 md 文件形态交付**)。

内嵌 SDK 插件清单(11 枚 `.qoder-plugin/plugin.json`,字段实测):`name / version / description / descriptionZh / author / homepage / license=Proprietary / keywords / skills:"./skills/" / commands / mcpServers:"./.mcp.json" / interface{displayName, shortDescription, longDescription, developerName, category, capabilities, defaultPrompt[]}`。
Skill 目录共 15 份 SKILL.md:canvas、browser-use、computer-use ×3(Win/mac/Linux 各一份)、record-and-replay、petdex-pets、find-extensions、qmind、knowledge-edit、knowledge-plan、sites-building/-hosting/-management/-build-agent-app。

## 3. 可观测配置键与开关面 [观察]

- 内置扩展贡献的配置键 **共 10 枚**(catalog 递归解析 `contributes.*.properties` 的键名):
  `qoder.computer-control.{computerUse, browserUse, lockedUse, recordAndReplay}.enabled`、`qoder.knowledge.center.{qmind, repoWiki, wikiConsumption}.enabled`、`qoder.security.{l1StaticCheck, l2LightweightScan, l3DeepScan}`。
- 用户态设置 `~/.qoder-cn/settings.json`(4146 B)**顶层只有 4 键**:`aicodingPluginSettingsMigrationVersion`、`enabledPlugins`(6 项,键形如 `<name>@<marketplace>`:`better-harness@qoder-bundler`、`computer-use@qoder-bundler`、`qoder-context@qoderapp-bundler`、`qoder-create-plugin@qoder-bundler`、`security-scan@qoder-bundler`、`superpowers@qoder-marketplace`)、`providers`(4 条 openai-compatible 自定义模型商)、`securityScan`。
  ⚠ 安全侧观察(值不抄):`providers.<id>.apiKey` **以明文驻留 settings.json**;`mcp-router.json` 含本机 `apiKey`;`ipc/browser-use.json` 含 `token`。三处均为文件名/键名级取证,本报告不复现内容。
- 应用级开关散在 AppData:`tray-preferences.v1.json{macosEnabled, windowsCloseBehavior}`、`notification-preferences.v1.json{turnMode:"unfocused", permissionRequestsEnabled, questionsEnabled, registrationConfirmationShown}`、`chrome-connector.v1.json{version,enabled}`、`updateNotificationSeen.v1.json`(按 update sha 做已读/`remindAt` 抑制)、`first-launch-onboarding.v1.json{version,status,serialNumber,identityCard{rarity,claimedAt,source:"local-fallback"}}`(开机引导 + 编号身份卡彩蛋)、`windows-startup-compatibility.json{schemaVersion, applicationVersion}`。

## 4. 用户态 `~/.qoder-cn` 布局(结构与字节数)[观察]

按体积(MB):`logs 5914 / file-history 1578 / tmp 722 / plugins 142 / projects 102 / extensions 35 / bin 13 / host-actions 6 / shell-snapshots 5 / tasks 4 / skills 3 / sites 2`,另有 `session-env、security-resources、qoder-knowledge、plans、memory、memories、ipc、host-actions、external-commands、entry、canvas、app、.models、.auth、.bin、.cache、.migrations`。

- **记忆**:`memory/` 43 项 = `MEMORY.md`(11.7 KB,索引式 `- [标题](文件名.md) — 一句话`) + 29 枚 `feedback-*.md`、8 枚 `reference-*.md`(其余 user/owner/check/verify/qoder 各 1)。文件名即分类前缀。`memories/019f17c6/{global,projects}` = 旧形态(按用户短 id 分 global/projects)。
- **项目级记忆(与全局同构)**:`projects/<路径 slug>/<sessionId>.jsonl`(会话转写,只统计不改引用)+ 同名 `<sessionId>/state.json` + `<sessionId>/compression-v2/state.json`;`projects/g--IHUI-AI/` 下另有 `memory/MEMORY.md` + 逐条 md、`goals/`、`task-<id>.session.execution/tool-results/`。
- **计划**:`plans/steady-shore-drum.md`(4934 B)—— 计划文档用 **三英文词随机名**,唯一目录、不分项目。
- **文件历史**:`file-history/<sessionId>/<fileUuid>@v<N>`,逐版本存整个文件体(65 条/会话样本),总量 1.58 GB —— 撤销/回滚的载体是"按会话分目录 + 逻辑版本号的原始字节快照"。
- **MCP 路由**:`mcp-router.json`(148 B)= `{schemaVersion:2, pid, baseUrl:"http://127.0.0.1:<port>", apiKey, startedAt}` —— **本机 MCP 聚合走 127.0.0.1 HTTP 路由进程,带进程号与鉴权键**;`mcp.json`(22 B)= `{"mcpServers":{}}`(用户面留空)。
- **身份/遥测**:`installation_id`(36 B,uuid4)、`umid-cache.json`(316 B,`info{machineToken, machineType, machineCode, vmInfo{isVm, brand, percentage, vmTypeCode}}`)、`state.json`(36 B,`{"lastLoginMethod":"job_token"}`)、`.qoder-app-status.json`(285 B,`logged_in/name/version=0.5.1/schema_version=1/product=snapshot_at/writer=main`)、`.last-cleanup`(25 B,纯 ISO 时刻)。
- **命令执行面**:`external-commands/registry.json`(2.3 KB)= `{schemaVersion:1, commands:{wiki:{name,description,entry:"bin/wiki-cli",defaultArgs,env{requiresAuth,vars},version:"v0.1.0",platforms:{darwin-arm64|darwin-amd64|linux-arm64|…:{url,sha256,archiveType:"zip",entryName}}}}}` —— **按平台分桶的远程可执行下载表**。`bin/7zr.exe`(601 KB,自带解压器)、`bin/qoder-cn-computer-use/QoderComputerUse.exe`、`bin/qoder-office-xlsx/xlsx-sidecar.exe`、`bin/.locks/`。
- **会话环境/持久 shell**:`session-env/<sessionId>/sessionstart-hook-<n>.sh`(空文件为主)、`shell-snapshots/snapshot-bash-<ts>-<rand>.sh`(134 枚,逐枚 1591 B = 登录 shell 环境快照,复用同一 shell 状态)。
- **进程间**:`ipc/browser-use.json`(284 B,`protocol="qoder-browser-use"` + version + instanceId + processId + endpoint(127.0.0.1 端口)+ token + createdAt);`host-actions/result-index/<sha256>-<uuid>.json`(383–392 B,按内容哈希寻址的结果索引 + `.staged/`)。
- **模型面**:`.models/<账号 v7 uuid>/catalog-v7`(67 KB,首字节为 base64 密文形态,非明文 JSON)[推断:模型目录落盘加密]。
- **日志**:`logs/latest` 是**指向 `runs/<run_id>/` 的符号链接**;`runs/` 1040 个逐进程目录,名含 ISO 时刻 + 短码 + `p<pid>`;每目录 `manifest.json`(673 B,字段 `run_id/started_at/pid/ppid/process_role=main/cli_version=1.1.79-hotfix.7/node_version=v24.18.0/platform/arch/cwd/project_id/argv[]/env_flags{debug,remote_worker,ci}/log_files{process}`)+ `qodercli.log`(单 run 7.9 MB)。另有 `logs/sessions/<路径 slug>/`、`logs/qoder-qmind/`、根 `qoder-context.log` 8.35 MB、`qoder-context-hook.log` 1.57 MB。
- **CLI 入口**:`entry/{qodercn.cmd, qoder-cn.cmd, qodercn-dispatcher.ps1(6 KB)}` —— 桌面产品同时向 PATH 交一枚 PowerShell 派发器。
- **迁移痕迹**:`.migrations/`、`plugins/.migrations/`、`qoder-knowledge/legacy-migration/state.v1.json`(旧知识层搬迁状态)。

## 5. Electron 数据目录 `AppData\Roaming\com.qodercn.app.stable\` [观察]

- 主存储 `main.sqlite` **709 MB**(+ `-wal` 4.2 MB / `-shm`);`chat-session-turn-payload-buffer.sqlite` 63.7 MB(turn 负载缓冲)、`collaboration-message-cache.sqlite` 188 KB、`sessionMigration.sqlite` 114 KB、`memoryMigration.sqlite` 24 KB —— **"会话迁移/记忆迁移"各自留有 sqlite,说明存在跨版本数据搬家工序**。
- `qoder-data.v1.json`(7 KB)顶层键即协作域模型:`version, schemaVersion, agentAccountScope, deviceId, onboardingSeedVersion, agentPresetSeedVersion, runtimes, runtimeProfiles, runtimeRegistrations, agents, agentRuntimeTargets, squads, turns, turnInputs, sessionDeliveries, attention, evidence, projects, issues, comments, subscriptions, updates, localProjectOverrides, localIssueOverrides`。
- `qoder-data.v1.ext.json`(70 KB):`schemaVersion, baselineSchemaVersion, mainFileScope, deviceId, profiles, runtimes, accounts`。
- 其余目录:`Partitions 394 MB / Cache 150 / Code Cache 103 / app-plugin-data 72 / updates 8 / logs 2.7 GB / market-assets / partner-plan-assets / rum-electron-store / crash-feedback-v1 / collaboration / application-icons / security-resources / Dictionaries / Network / Local Storage / Session Storage / blob_storage`。
- 凭据面(只记名与字节,未读内容):`.auth/`、`auth.v1.dat`(552 B)、`auth-profile-overlays.v1.dat`(879 B)、`auth.machine-id`(37 B)、`.updaterId`(36 B)、`installation_id`(36 B)、`lockfile`。

## 6. 插件 / 技能 / 扩展注册形态 [观察]

- **两套互不相干的扩展体系并存**:
  ① VS Code 式:`~/.qoder-cn/extensions/extensions.json`(864 B)= 数组,`{identifier{id}, version, location{$mid,fsPath,external,path,scheme}, relativeLocation, metadata{isApplicationScoped, isMachineScoped, isBuiltin, installedTimestamp, pinned, source:"gallery", id, publisherId, publisherDisplayName, targetPlatform, updated, private, isPreReleaseVersion, hasPreReleaseVersion}}`;实装仅 1 枚 `ms-python.debugpy-2025.14.0-win32-x64`(35 MB,含 `.vsixmanifest` + `package.nls.*.json` 多语言包)。→ **调试器与 Python 语言支持是真借了 VS Code 扩展生态**。
  ② Qoder 插件式:`~/.qoder-cn/plugins/installed_plugins_v2.json`(2.4 KB)按 `<name>@<marketplace>` 键控,值数组含 `{scope:"user", installPath, version, installedAt, lastUpdated, displayName, enabled, source:"marketplace"}`;`installed_plugins.json`(855 B)= v1 旧形态并存。
- **市场来源**:`plugins/known_marketplaces.json` = `{qoder-plugins:{source:{source:"url", url:"https://qoder.cn/apphub/api/v1/marketplace/marketplace.json"}, installLocation, lastUpdated, autoUpdate:true}}`。
- **缓存分命名空间**:`plugins/cache/{qoder-bundler, qoder-marketplace, qoderapp-bundler}`;`qoderapp-bundler/qoder-context/` **同一插件并存 8 个版本目录**(`1.0.51.fa026ec3 … 1.0.91.b22f2d0a`)+ 一份"当前"目录 —— 插件级版本共存与壳层 `.qoder-versions` 同思路。
- `plugins/data/<pluginId-slug>/` 是插件私有数据(`qoder-computer-control / qoder-context-qoderapp-bundler / qoder-knowledge-center / qoder-search / security-scan / superpowers-qoder-marketplace`)。
- **Hook 系统实装**:`qoder-context/hooks/hooks.json` 声明 `SessionStart`、`UserPromptSubmit` 两组,每条 `{async:false, hooks:[{type:"command", command:"cmd.exe", args:[…${QODER_PLUGIN_ROOT}…], name, timeout:2, env{QODER_PRODUCT_ID}}}`;`better-harness/hooks/` 只放 `hooks.json.template` + `git-scripts/`、`review-trigger/`(模板化 + 未激活)。
- **Context 插件同时供 MCP**:`qoder-context/mcp.json` server `qoder-context` → `${QODER_NODE_RUNTIME} runtime/qoder-search.bundle.mjs mcp-bridge`,env 里显式 `QODER_MTREE_NATIVE`(原生文件树索引 index.cjs)与 `QODER_SEARCH_RIPGREP_PATH`(自带 rg)—— **代码检索引擎(ripgrep + mtree)以插件形态交付**。
- 用户技能:`~/.qoder-cn/skills/` 11 枚(create-skill / docx / pdf / pptx / xlsx / find-skills / install-skill-dependency / plugin-creator / qoderwork-guidance / vm-error-recovery / serverchan@),SKILL.md frontmatter 键面实测:`name,description` 为基础,内置办公件多 `version / description_zh / license`(注意是 `description_zh` 小写,而 app-plugin manifest 用 `descriptionZh`)。

## 7. 壳层 vs 模型层:能力分层结论

**做成壳层(不依赖模型、进程外可见)的**:
1. 更新与版本共存:`.qoder-versions/<ver>/` + `*.qoder-update-ready.json(sha256+pending-asar-v1)` + Launcher `state.ini{installDir,targetVersion,status}` + `fast-update` 文件级 sha 清单 + `.cat` 可信目录 + `elevate.exe` 提权 + `updaterCacheDirName`。
2. 本地命令执行与 JS 求值:`node-repl` 常驻内核(tree-sitter 内省)+ `external-commands/registry.json` 平台分桶远程 exe + `bin/7zr.exe` + 插件 `type:"command"` hook(cmd.exe + 2 s 超时)。
3. 设备指纹:`umid/sgsdk.dll` + `runtime-info.exe` → `umid-cache.json`(machineToken/machineType/machineCode/vmInfo);`installation_id`、`auth.machine-id`、`.updaterId` 四把不同身份键并存。
4. 原生窗口/输入/外设:`bin/*.node`(剪贴板、通知权限、DJI 麦克风、裸修饰键监听)+ `picture-in-picture-host` 原生模块 + `computerUse{Windows,MacOS,Linux}` 分平台 skill。
5. 动态文案:51 键模型名映射可远程换,不动二进制。
6. 离线数据层:`main.sqlite`、`file-history`(逐版本原始字节)、`projects/<slug>/<sid>.jsonl`、`session state.json` + `compression-v2`(上下文压缩落盘)、`goals/<id>.json`(`objective/status/maxTurns/turnsUsed/timeUsedSeconds/creditsUsed`)、`plans/<三词名>.md`、`shell-snapshots`、`session-env`、`memory/*.md`。
7. 跨端与协作:`collaboration/skills/SKILL.md`(身份三态 + 审批语义)+ `qoder-data.v1.json` 的 squads/turns/issues/comments/subscriptions/attention/evidence 全套域模型 + `collaboration-message-cache.sqlite`。
8. 浏览器桥:`native-messaging-host` + `ipc/browser-use.json`(127.0.0.1 端口 + token + pid 存活校验)。
9. MCP 聚合:`mcp-router.json` 的本地 HTTP 路由(单一入口转发,而不是每个 server 一条进程)。
10. 完整性与共存:`catalog.v1.json` 逐文件 sha256、`bundled-resources` 的 `maxEntries/maxExpandedBytes`(解压炸弹护栏)、`presence:"ensure-minimum"`、`userVisible:false`。

**留给模型层的**:UI 之外的推理、工具编排语义(SKILL.md 只"解释何时用",原文明确写"Skill 不授予权限、不会让不可用工具出现")。

## 8. 与 G:\IHUI-AI 的候选缺口(结构性对照,非取舍建议)

| Qoder 有的载体 | 本仓现状 | 缺口性质 |
|---|---|---|
| `file-history/<session>/<uuid>@vN` 逐版本原字节快照 | 仅靠 git + `.ihui-agent/state/*` 台账 | **无"会话粒度"文件回滚层** |
| `memory/` 索引 md + 分类前缀 md(43 条) | `AGENTS.md` 人工条款 + 知识库生成件 | 有等价物但**无自动写回的逐条记忆文件** |
| `goals/<id>.json`(maxTurns/turnsUsed/timeUsedSeconds/creditsUsed) | `.ihui-agent/goal-runtime/STATE.md` 文本 | **机读目标预算计数器**缺失 |
| `shell-snapshots/`(每 shell 1591 B 环境快照) | 每次 Bash 冷启 | **无复用 shell 环境快照载体** |
| `session-env/<sid>/sessionstart-hook-<n>.sh` | hooks 只有 husky 提交链 | **会话级 hook 落盘面缺失** |
| `logs/runs/<run_id>/manifest.json`(argv/ppid/env_flags/cli_version/node_version/project_id)+ `latest` 软链 | `.ihui-agent/state/git-guardian.log` 单文件 | **无逐进程运行清单与 latest 指针** |
| `mcp-router.json`(单条 127.0.0.1 路由 + apiKey + pid) | `.ihui/mcp.json` 直连各 server | **无 MCP 聚合路由层** |
| `external-commands/registry.json`(平台×sha256×zip) | 无 | **远程按平台取二进制的注册表载体缺失** |
| `catalog.v1.json` + `bundled-resources/manifest.json`(逐文件 sha + 解压上限 + ensure-minimum) | `.ihui/skills/`、`.ihui-agent/` 手工 | **插件清单/完整性校验/装机预置三者皆无** |
| `plugins/installed_plugins_v2.json` + `known_marketplaces.json`(autoUpdate) + 版本目录并存 | `.ihui-agent/skills/SKILL.md` 单点 | **无插件注册表与市场(含自动更新)** |
| `dynamic-text/qoder-cn.json`(51 键模型文案) | i18n JSON 五语言 | 有 i18n 但**无免发版模型名/文案热通道** |
| `umid-cache.json` + `installation_id` + `auth.machine-id` | 无 | 设备指纹/匿名安装标识(合规敏感,列为"知道有,不建议抄") |
| `host-actions/result-index/<sha>-<uuid>.json` + `.staged/` | `object-space-land` 落地器 | **内容寻址的宿主动作结果索引**缺 |
| 版本级 `.qoder-versions/<ver>` + Launcher `state.ini` 原子切版本 | 单工作树多会话共用 | **多版本共存与原子回滚载体缺** |
| VS Code `extensions.json` + debugpy 实装 | 无调试器接入 | **语言服务器/调试器扩展生态未接** |

## 9. 主席必须知道的意外发现

1. **取证根正在被换掉**:`.qoder-versions/` 已并存 0.4.9/0.4.11/0.5.1,Launcher `state.ini` 的 `targetVersion=0.5.1`、`.qoder-app-status.json.version=0.5.1` ⇒ 0.4.11 只是留存旧版本;跨席取证需先钉 Launcher 现值,否则会出现"S2/S7 查 0.5.1、S3 查 0.4.11"的错位。
2. **`resources/bin/` 里有 `dji_mic_button.node`(785 KB)** —— 产品把 DJI 麦克风物理按键当原生输入源,外加 `appshot_bare_modifier_monitor.exe` 裸修饰键全局监听;这是"壳层持有外设"的硬证据,agent SDK 层看不到。
3. **凭据明文面**(只报键名与字节):`settings.json → providers.<id>.apiKey`、`mcp-router.json → apiKey`、`ipc/browser-use.json → token` 三处均为明文字段;而会话侧 `projects/<slug>/<sid>/state.json` 的 `items.s0.{c,u,n,p}`(nonce+密文)与 `.models/<uid>/catalog-v7` 首字节呈 base64 密文形态 ⇒ **产品对会话/模型目录做了静态加密,但对用户自填 provider key 没做**。这条对本仓 AGENTS.md §5d"密钥不入仓不入聊天"是反向参照,值得写进对比结论。
4. 附带:本席 `node -e` 读 settings.json 时曾把 provider apiKey 打进了工具输出,本报告与后续对话一律不复制其值;建议机主把这几枚 key 视同暴露、按轮换处理(只作提示,不属本席动作)。
5. **`resources/collaboration/` 与 `resources/qoder-helper/` 里除 SKILL.md 外没有任何代码**(4.4 KB / 8.7 KB 两枚纯文本目录)—— 即这两项能力的"装机形态"就是一张说明书,真正工具面全靠 MCP 动态注册(`mcp.registerInProcess` 权限)。逆向时不要把这两目录当实现件找。

## 10. 复核补充与取证方法

- **附带核对 [观察]**:`resources/app.asar.unpacked/` 仅 `node_modules/` 一个子树、总 121 MB(未遍历,交 S2);`resources/extensions/` 实测 62 MB / 9 目录,与派单口径一致;`umid/PS/` 与 `resources/PS/` **两者皆为空目录**(阿里安全 SDK 落地占位);`~/.qoder-cn/plans/` 全库只有 1 份计划文件(`steady-shore-drum.md`,4934 B)⇒ 计划层不分项目、不批量留存。
- **手段**:`ls -la`/`du -sm`/`stat -c%s` 取结构与字节数;`node -e` 解析 JSON 只取键名与短标量;`find -maxdepth` 限深度;`readlink` 判软链;未对 >100 KB 实现文件做整文件 cat。
- **未读面(红线)**:`.auth/`、`auth.v1.dat`、`auth-profile-overlays.v1.dat`、`auth.machine-id`、`.updaterId`、各 `*.sqlite` 内容、任何 `<sessionId>.jsonl` 正文;`app.asar` 未解包;agent-sdk 目录未遍历。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
