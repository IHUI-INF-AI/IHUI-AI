<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S8 席报告:Qoder CN 0.4.11 → 0.5.1 版本差集取证

> 认领@2026-10-30/S8

范围声明:本席只查 `G:\Qoder CN\.qoder-versions\0.5.1\`,并把它与 0.4.11 做差集量化。0.4.11 的 app.asar 展开、agent-sdk 内容细节、resources 展开属 S2/S3 席,本席只取其**目录名/字节数/条目数/清单指纹**用于对账,不读源码内容。产出物:`G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\s8\catalog-delta.mjs`、`...\s8\fast-update-delta.mjs`(只读脚本)。

## 0. 前提更正(最重要,先落)

**「正在运行的还是 0.4.11」不成立 —— 0.5.1 已激活并正在运行。** [观察] 四条一手证据:

1. `G:\Qoder CN\resources\build-manifest.json`(13:46)现值 `productVersion=0.5.1`、`commit=ef0366398c…`、`buildNumber=84759508`;
2. `G:\Qoder CN\resources\app.asar` = **196,831,317 B,sha256=`7cdfc0a41795cf86162f028444bbf034916321cb03c54311873e573cd24916e4`**,与 `G:\Qoder CN\.qoder-versions\0.5.1\resources\app.asar.qoder-pending` 的 sha256 **逐字节相等**(同值同尺寸,本机现算);对照 `…\0.4.11\resources\app.asar` = 189,505,973 B / sha256=`e9d780de8caa3d108ffe476c5de01f91eb543a067cb1ed9653ac5cd1663a9580`;
3. 在跑的 12 个进程全部 `Path=G:\Qoder CN\Qoder CN.exe`,`StartTime=2026/10/30 20:37:12` 起(全部在 asar 落地之后),即已加载 0.5.1 代码;
4. `C:\Users\Administrator\AppData\Local\Qoder CN\Qoder CN Launcher\state.ini`(154 B,schemaVersion=3)`status=healthy / targetVersion=0.5.1 / updatedAt=2026-10-30T12:37:19.911Z`(=本地 20:37:19,与进程启动时刻同秒),同目录 `install.ini`(115 B)`status=idle / targetVersion=0.5.1`。

⇒ 结论:`app.asar.qoder-pending` 这个名字是 **payload 布局戳记(payloadLayout=pending-asar-v1)**,不是「尚未生效」的标志位;版本暂存目录里的 pending 件是**与激活件等字节内容的留存副本**。[推断] 0.4.11 暂存件之所以叫 `app.asar`(0.4.9/0.5.1 都叫 `.qoder-pending`),是不同时序下的命名残留,不构成"未激活"判据。

体积口径同时更正:**app.asar 差集是 +7,325,344 B(≈+7.0 MiB,+3.9%),不是 +15MB。**

## 1. browser-connector(新增能力载体)[观察]

落点 `G:\Qoder CN\.qoder-versions\0.5.1\resources\browser-connector\`,0.4.11 整目录不存在。821 项 fast-update 清单里新增 21 条路径、合计 ≈446,344 B。

结构:
- `chrome-extension.json`(323 B):`version=1.7.6`、`extensionId=oknkojfamnpljdfpinkhbibicojelkoj`、`publicKeyMode=fixed_dev`、`sha256=f80ae220f83546e7…`、下载 URL `https://download.qoder.com/qoder-work/bin/browser-connector/chrome-extension/1.7.6/qoder-work-chrome-extension-v1.7.6.zip`(原文形如 `qoderwork-chrome-extension-v1.7.6.zip`)。
- `chrome-extension/.qoder-extension-package.json`(95 B):`{version,sha256}` 双字段自证完整性(与上行同值)。
- `chrome-extension/manifest.json`(2,390 B,MV3):permissions 含 **`debugger`**(=CDP 通道)、`nativeMessaging`、`sidePanel`、`scripting`、`tabs`/`tabGroups`/`activeTab`、`webNavigation`、`storage`、`history`、`downloads`、`clipboardRead/Write`、`alarms`;host_permissions `<all_urls>` + `http://127.0.0.1/*`;`externally_connectable.matches` 列 `qoder.com/qoder.com.cn/qoder.cn/test.qoder.*`;固定 `key`(公钥)使扩展 ID 恒定;三条 content_scripts。
- 部件:`background.js`(301,540 B,service_worker/module)、`content-scripts/accessibility-tree.js`(4,223)/`page-bridge.js`(4,956)/`visual-indicator.js`(7,873)、`sidepanel.html|js|css|controls.html|controls.js`(5,356/18,730/11,143/17,861/15,760)、`assets/sidepanel-bridge-C1xXXnHa.js`(3,146)+`sidepanel-i18n-CfEuOUU6.js`(474)、`_locales/{en,zh_CN}/messages.json`(9,217/9,445)、icons 三档。

协议面(从 background.js 取字面量,≤60 字符定位串)[观察]:`ws://127.0.0.1:`、`http://127.0.0.1:`(本地环回端口由宿主注入)、`wss://browser-connector.test-preview.qoder.sh`(云端中继腿)、字面量 `"mcp-tools"`(MCP 工具面出口名);动作词表(枚举名)`left_click`/`double_click`/`triple_click`/`right_click`/`left_click_drag`/`hover`/`scroll`/`scroll_to`/`screenshot`/`zoom`/`back`/`submit`/`accept`/`tab_ax_action`,AX 节点词表 `textbox`/`checkbox`/`radio`/`container`/`role`/`jpeg`。

形态判定:**四件套 = MV3 扩展(调试器+AX 树+侧栏)+ 原生消息宿主 + 本地 127.0.0.1 ws + MCP 工具面**。关键佐证:`resources/native-messaging-host/qoder-app-host.cjs`(3,559 B)在两版**逐字节同尺寸同文件数**(diff -rq 无差异)——即"管道"早已在册,0.5.1 才把"扩展本体"打进安装 payload。运行态 `C:\Users\Administrator\AppData\Roaming\com.qodercn.app.stable\chrome-connector.v1.json`(38 B,10/20 起存活)也只有文件名+大小读取,未 cat。[推断] 扩展是"接管用户已登录的真实浏览器",而非起一个隔离实例。

与本项目对位(只描述形态):本仓 `G:\IHUI-AI\.ihui\mcp.json` 的 `servers` 数组**只登记 `rea` 一枚**(stdio,scripts/rea-mcp-entry.mjs),全仓 `git ls-files` 无 `browser-connector`/`native-messaging`/`index-settings`/`collaboration-cli` 同名资产;浏览器侧对位资产是 `G:\IHUI-AI\apps\extension\`(Wxt 形制:`entrypoints/`+`lib/`+`public/`)与本会话宿主提供的 `browser-use` 技能/插件(来自 Qoder 运行环境,不属本仓)。⇒ 差异在承载形制:Qoder 把"浏览器控制"做成**安装期随包分发的扩展 + 宿主消息管线 + 云中继**,本项目是**单个 stdio MCP server 驱动外部 CDP**。

## 2. collaboration-cli(新增能力载体)[观察]

落点 `…\0.5.1\resources\collaboration-cli\`,0.4.11 无。fast-update 新增 8 条路径,合计 ≈2,605,238 B。

- `manifest.json`(54 B):`{"package":"@ali/qoder-collab-cli","version":"0.1.7"}`;`package.json`(18 B):`{"type":"module"}`。
- `dist/host/entry.js` 1,229,809 B + `dist/host/index.js` 1,356,094 B(host 侧 bundle)。
- 随包技能 `collaboration-cli/skills/desktop/`:`SKILL.md`(8,860 B,frontmatter `name: qoder-collab-desktop`)+ `references/operations.md`(5,111)/`team-tasks.md`(3,623)/`identities.md`(1,669)。

命令面(旗标为 entry.js/index.js 字面量)[观察]:`--desktop-endpoint`、`--invocation-id`、`--runtime-context-fd`、`--profile`、`--json`、`--output`、`--schema`、`--help`、`--version`;资源/动词字面量 `project`/`project_members`/`issue`/`issues`/`discussion`/`discussion_members`/`message`/`file`/`team`/`team-member`,以及 schema 描述件 `project.yaml`/`issue.yaml`/`message.yaml`/`file.yaml`/`discussion.yaml`;index.js 内工具名 `list_messages`/`get_message`/`list_comments`/`get_comment`/`upload_unconfirmed`;SKILL 文档命令 id `team-task teams|create|send|delegate`、`discussion get`、`message list/get --subject current_agent`、`issue get|update`、`issue-comment list|get`。

Launcher 与运行时(**AppData 侧对应运行时确实存在**):`C:\Users\Administrator\AppData\Roaming\com.qodercn.app.stable\collaboration\cli\bin\`(目录 mtime 10/30 19:47,即 0.5.1 激活窗口内生成)——`qc-cli`(258 B,POSIX sh 包装):以 `ELECTRON_RUN_AS_NODE=1` 复用 `G:/Qoder CN/Qoder CN.exe` 作 node,跑 `qc-cli-argv-8ddd4b949f546bad.cjs`(1,010 B)加载 `G:/Qoder CN/resources/collaboration-cli/dist/host/entry.js`(注意:**活安装路径**,不是版本暂存路径);argv 垫片关键串 `--desktop-argv`、`runDesktop`、`COLLABORATION_CLI_LAUNCH_FAILED`、base64url 解码。⇒ 该 CLI 无独立二进制、不自带登录,身份/端点/上下文全由宿主注入(`--desktop-endpoint` + `--runtime-context-fd`),这是"宿主固定身份"的实现形制。

承载产品能力(SKILL/team-tasks 文义)[观察]:云 **Project / Issue / Discussion / message / file** 五类资源的读写 + **Team 任务**:优先走宿主内置工具 `list_agents`、`create_team_task`(回执含 `discussionId`/`leaderSessionId`/`discussionTeamId`/`sourceMessageId`)、`read_chat_session`、`wait_chat_sessions`、`send_message_to_team_task` 系列;`team-task create` 仅在宿主不Provide内置创建能力时降级使用;`team-task delegate --target-member-id` 限受信 leader、每 Turn 每目标至多一次。注意:0.4.11 与 0.5.1 的 `resources/collaboration/skills/SKILL.md` **diff -rq 无差异**(目录仍在,1 文件)⇒ 0.5.1 不是"改文档"而是"新长了可执行的 CLI 本体 + 桌面侧技能包"。[推断] 这一版把协作从"只有说明"推到"有手"。

## 3. 新扩展 qoder.index-settings [观察]

落点 `…\0.5.1\resources\extensions\qoder.index-settings\`,4 文件 89,472 B:`dist/browser/view.cjs`(47,971)、`dist/node/main.cjs`(40,306)、`.qoder-app-plugin/plugin.json`(771)、`assets/index-settings.svg`(424)。

`plugin.json` 关键键值:`schemaVersion:10`、`id:qoder.index-settings`、`name:"Workspace Index Settings"`、`version:0.1.0`、`engines.qoder:">=0.0.1"`、`main:dist/node/main.cjs`、`activationEvents:["onStartup","onView:index-settings"]`、`permissions:["auth.readState","node.callService","workspace.readProjects","workspace.writeIndexSetting"]`、`contributes.views[0] = {id:"index-settings", location:"settings", directoryId:"workspace-index", title:{default:"Workspace index", translations:{"zh-CN":"工作区索引"}}, icon, entry:"dist/browser/view.cjs"}`。

管的对象(方法名/类名为字面量)[观察]:main.cjs 服务方法 `daemon.ping`、`indexing.ensure`、`indexing.settings.snapshot`、`indexing.settings.start`、`indexing.settings.cancel`、`indexing.settings.setAuto`、`indexing.settings.setWorkspaceIndex`、`indexing.settings.reconcile`;view.cjs  DOM 键 `index-settings-repository-tabs`、`index-settings-workspace-toggle`、`index-settings-workspaces`、`index-settings-workspace-folder`、`index-settings-skeleton-tabs`、`index-settings-empty`、`index-settings-action-error` 等。

判定:**它管的是"工作区/仓库级代码索引开关"**,落在设置面(`location:"settings"` + `directoryId:"workspace-index"`),不是 wiki、不是通用设置。补齐的产品能力 = **把代码库索引从隐式行为变成可枚举、可逐仓库开关、可暂停/取消/对账的用户可控面**(setAuto + setWorkspaceIndex + snapshot + reconcile/start/cancel 五件套构成完整生命周期)。[观察] 权限里 `workspace.readProjects` + `workspace.writeIndexSetting` 是"读项目清单、写索引开关"的最小配对;`auth.readState` 说明它按登录态决定可见范围。

## 4. catalog.v1.json 条目级差集 [观察]

路径两版同名:`…\resources\extensions\catalog.v1.json`,86,765 → 92,111 B(+5,346)。结构 `{schemaVersion:1, productId, profile:"stable", plugins:[{id,name,version,root,enabledByDefault,manifest,files}]}`(schemaVersion 与 profile 两版未变)。

条目:9 → 10。新增 **1 条:`qoder.index-settings @0.1.0`**;删除 0;版本变动 0(其余 9 条 id/version/keyset/status 全等);键集变动 0。

⇒ 目录名与文件系统侧的漂移比 catalog 更大(能力面随版本的真实漂移藏在 bundle 里,catalog 只登记壳):`resources/extensions` 64,171,992 → **100,296,512 B(+36,124,520)**;`du -sb` 逐目录:`qoder.office` 14,439,271 → **50,055,095(+35,615,824,本版最大单体增量)**、`qoder.knowledge.center` 9,648,167 → 10,054,828(+406,661)、`qoder.security` 15,338 → 22,555(+7,217)、`qoder.index-settings` 0 → 89,472(新)、`qoder.canvas/communication/computer-control/desktop-pet-skill/find-extensions/sites` **逐字节同尺寸**。文件级差异 28 处,关键新增文件名(diff -rq 只报形制不读内容):`qoder.office/dist/browser/{workbook.cjs,xlsm.cjs,csv.cjs}`、`qoder.office/dist/node/{sheetsRuntime.cjs,xlsmRuntime.cjs,xlsxRuntime.cjs,xlsxHeadless.cjs}`、`qoder.office/dist/node/fullEditor/{sheets.js,sheets.css}`;`qoder.knowledge.center/cli/qoder-qmind/dist/qoder-qmind-mcp-server.cjs` 内容变;`qoder.{canvas,communication,knowledge.center,security,sites}` 的 view/main 变。

`qoder.office/.qoder-app-plugin/plugin.json` 差集(直接读出,支撑上面结论)[观察]:activationEvents 新增 `onView:workbook`、`onView:xlsm`、`onView:csv`;contributes.views 新增 3 项 `{id:workbook|xlsm|csv, title:{default:"Spreadsheet editor", zh-CN:"电子表格编辑器"}, location:"file.preview", entry:dist/browser/…}`;新增 3 条文件关联规则 `{id:xlsx, viewId:workbook, filenameSuffixes:[".xlsx"]|[".xlsm"]|[".csv"], refreshPolicy:"onOpen", priority:100, hostHeader:"hidden", hoverPreview:"disabled"}`。⇒ **0.5.1 新增内置电子表格编辑器(xlsx/xlsm/csv 就地预览与编辑,含无头 xlsx 通道)**,配套 `bundled-resources` 新增归档 id `qoder-office-xlsx`(zip 3,348,614 B,manifest.json 4,505 → 5,707,resources 2 → 3:`qoder-cn-context-plugin`,`qoder-cn-computer-use`,`qoder-office-xlsx`;`qoder-cn-context-plugin` 的 zip 哈希轮转 `a531aeaa…`→`50c9436d…`,5,409,646 → 5,415,481)。另 `qoder.security/plugin.json` 权限新增 `auth.readState`。

## 5. @qoder-ai/qoder-cn-agent-sdk 差集(只报数量与名字差)[观察]

两版路径:`{0.4.11,0.5.1}\resources\app.asar.unpacked\node_modules\@qoder-ai\qoder-cn-agent-sdk`。

- 文件集合**完全相同**:各 332 文件,`comm` 双向差集 = 0(无新增、无删除)。
- 目录名相同:`dist/_worker/{builtin,proto,vendor}`;`_worker/builtin` 两版都是 4 枚技能、同名同形制:`agent-creator/SKILL.md`、`hook-config/SKILL.md`、`sdk/SKILL.md`、`skill-creator/SKILL.md`(agents/tools 目录名在此面未出现 ⇒ 该 sdk 的 unpacked 只承载 worker runtime,agent 侧 builtin 面只有这 4 枚 skill)[观察];⇒ 新版 agent 能力**不在 unpacked 面**,应在 app.asar 内部(归 S2 席射程,本席不展开)。
- 仅 3 个文件字节变:`dist/_worker/qoder-worker-runtime.obf.mjs` 34,389,777 → 34,838,773(**+448,996**);`dist/_worker/runtime-info.json` 2,568 → 2,574;`dist/_worker/vendor/ripgrep/x64-win32/rg.exe` 5,440,512 → 5,440,520(+8)。整目录 `du -sb` 126,083,651 → 126,532,693(+449,042)。
- runtime-info.json 版本常量(键值直读):`version` **1.1.75-hotfix.1 → 1.1.79-hotfix.7**;`git.commit` `cb3c036a38ba…`→`b05eb04eeb23…`;`createdAt` 2026-10-22 → 2026-10-28;`profile:"platform"`、`target:"win32-x64"`、`copiedPackages`(10 项:含 `@lydell/node-pty`、`keytar`、`sharp`、`@silvia-odwyer/photon-node`)、`assets.packages` 版本表**两版逐条等值**(semver 7.7.4 / node-addon-api 4.3.0 / sharp 0.34.5 等未动)。⇒ 依赖零漂移,只换 worker runtime 本体。

## 6. 更新链机制取证 [观察]

- **payloadLayout=pending-asar-v1**:三枚暂存描述件同键形 `{releaseId, archiveSha256, payloadLayout}`——`0.4.9.qoder-update-ready.json`(140 B,`d5285ee0f065…`)、`0.4.11.qoder-update-ready.json`(139 B,`6f4807953712…`)、`0.5.1.qoder-update-ready.json`(139 B,`361411b2aea5…`);0.4.9/0.5.1 暂存内为 `app.asar.qoder-pending`,0.4.11 为 `app.asar`(见 §0 判定)。
- **archiveSha256 的校验点不是 asar**:0.5.1 的 `archiveSha256=361411b2…` ≠ 实测 asar `sha256=7cdfc0a4…`。⇒ [推断] 它校验的是**下载归档**(zip),解包后即失效;真正的逐文件校验另有其面 ↓。
- **fast-update = 全安装逐文件指纹清单**:`…\resources\fast-update\qoder-fast-update-manifest.json`(163,009 → **170,165 B**),结构 `{schemaVersion:1, files:[{path,size,sha256}]}`,条目 **825 → 868**;`qoder-fast-update.cat` 564,956 → 588,800 B;`qoder-fast-update-trust.exe` 18,944 B(两版同)。按 path 做差集:**新增 44 / 删除 1 / 同路径内容变 53**(脚本 `fast-update-delta.mjs`)。新增 44 条的归属聚类:`browser-connector/*` 21、`qoder.office/*` 9、`collaboration-cli/*` 8、`qoder.index-settings/*` 4、`bundled-resources/archives/*` 2;删除的 1 条 = 旧 context-plugin zip 哈希名。53 条变动里除 asar/扩展外,含 Electron 原生件(`Qoder CN.exe` 225,510,408→225,510,400、`ffmpeg.dll`、`libGLESv2.dll`、`dxcompiler.dll`)与 `node-pty`/`aoq-electron-sdk`(音视频/RTC 面)/`sharp` 的 `.node`/`.dll` 全量重编 ⇒ [推断] 本版换过一次工具链/构建机(与 runtime-info 的 CI 路径 `qoder4/aoneci-runner…` vs `qoder6/…` 相印证)。
- **多版本共存 + 激活语义**:`G:\Qoder CN\.qoder-versions\{0.4.9,0.4.11,0.5.1}\` 各自是完整安装快照(顶层 21 文件 + `resources/`);激活 = 把对应 payload 写入 `G:\Qoder CN\resources\`(实测 sha256 等值,§0),Launcher 记账 `state.ini`/`install.ini`(同 schemaVersion=3;`status=healthy|idle`;`appExecutable=Qoder CN.exe`;`installDir=G:\Qoder CN`),并留 `state.ini.writers\`(空目录 = 写者锁位)。`C:\Users\Administrator\AppData\Local\Qoder CN\Qoder CN Launcher\Qoder CN Launcher.exe` 141,824 B 与暂存 launcher 同尺寸 ⇒ 已同步。
- **下载与缓存口**:`G:\Qoder CN\.qoder-update\downloads\` 现**为空**(find 只剩两层目录,0 文件)⇒ [观察] 归档消费后即清,不留包;`resources\app-update.yml`(108 B,两版同)`provider: generic`、`url: https://static.qoder.com.cn/qoder-app/releases`、`updaterCacheDirName: qoder-cn-updater`;`product.json`(541 B,**两版逐字节相同**,diff 空)`desktopUpdateDownloadBaseUrl` 同址、`windowsLauncherDirectory/MutexName` 在册。⇒ [观察] 更新面在 0.4.11→0.5.1 之间没有任何配置漂移,漂移全在 payload。
- **回滚口**:[未知] 三枚暂存目录本身即天然回滚素材,但本席在暂存/激活两侧都没找到显式 rollback 标记件或 `previousVersion` 键;`launcher-diagnostics.log`(38,897 B)的 stage 词表只有 `process_started/context_loaded/mutex_checked/window_creating/window_created/window_shown/ack_ready/process_exited`,**不含 update/activate 语义**,退出码分布 `code=0`(185)、`code=71`(37)、`code=70`(3)、`code=1`(1)⇒ 71 的语义本席不定性 [未知]。
- **清理不彻底**[观察]:活安装仍有 `G:\Qoder CN\resources\PS\`(10/22 目录,`find` 计 0 文件 0 字节),而 0.5.1 暂存无该目录、fast-update 清单从不列它 ⇒ `PS/` 是**空壳残留**,0.5.1 "删除 PS"实为无物可删,不构成能力减项。

## 7. dynamic-text / umid / bin / node-repl / tray(及 launcher/qoder-helper)差集 [观察]

| 目录(files 4.11→5.1) | 字节(→ 差) |
|---|---|
| `bin` 4→4 | 3,758,600 → 3,758,592(−8;`appshot_bare_modifier_monitor.exe` 714,248→714,240,余同尺寸) |
| `node-repl` 69→69 | 3,404,836 → 3,404,836(**逐字节持平**;fast-update 仍列 53+15=68 条) |
| `tray` 1→1 | 19,071 → 19,071(持平) |
| `umid` 3→3 | 7,836,171 → 7,836,172(+1;`manifest.json`492/`runtime-info.exe`480,752/`sgsdk.dll`7,354,928) |
| `dynamic-text` 1→1 | 9,923 → **12,598(+2,675)**;`qoder-cn.json` 键数 **102 → 120(+18,删除 0)** |
| `fast-update` 3→3 | 746,909 → 777,909(+31,000) |
| `launcher` 3→3 | 133,553 → 144,305(+10,752;exe 131,072→141,824) |
| `qoder-helper` 8→8 | 54,427 → 57,731(+3,304) |
| `application-icons` 8→8 | 773,385 → 773,385(持平) |
| `native-messaging-host` 1→1 | 3,559 → 3,559(持平) |
| `elevate.exe` | 118,272 → 118,280(+8) |

dynamic-text 新增的 18 个键名(全为 `model.*` 三档 × {zh,en} × {label,description,detail})[观察]:`model.fast`、`model.gm51model`、`model.q37fmodel` ⇒ **0.5.1 模型清单新增 3 个档位**(动态文案面,不是硬编码)。

## 8. 未决与归属

- [未知] app.asar 内部(渲染层/主进程)差集:本席按"清单级+文件级"取证,asar 内部面归 S2。
- [未知] `qc-cli` 的完整子命令表:bundle 为混淆/打包产物,`command:"…"` 模式零命中;已得旗标与资源名见 §2,穷举需读 entry.js 内部,建议归 asar/CLI 专席。
- [未知] launcher 退出码 71/70 语义;显式回滚标记件是否存在。
- [推断] 本版三条主线:**浏览器接管(扩展随包)、协作可执行化(CLI+技能)、文档与索引可控化(office 电子表格 + workspace 索引设置)**;agent runtime 侧只是版本推进(worker 1.1.75→1.1.79),能力面增长应看 asar 内。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
