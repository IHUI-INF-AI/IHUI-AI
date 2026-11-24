<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder 会话导入子系统 (sessionMigration) 触发入口取证(2026-10-28)

> 承接 `docs/RELAY_IDE_SESSION_EVIDENCE.md` 末节遗留问题:「Qoder `sessionMigration`
> 的触发入口未取证」。本文回答:**有没有可编程/可操作的触发入口,以及能否用它灌入外部会话。**
> 全部为纯只读取证(读二进制字符串、只读开 sqlite、读配置键名),未启动 Qoder、未触发任何导入。

## 1. 结论先行

1. **触发入口存在,但全部是"应用内"入口,没有对外可编程通道。**
   - **GUI 入口(已证)**:设置 → **「导入数据」**(`settings.importDataAction`,zh-CN 文案
     `"导入数据"` / en `"Import data"`),对应「数据导入」页面;首次启动的 onboarding 批次里
     也有同族卡片(`playground.onboarding.importAllSourceData`、`workbuddy` 迁移卡)。
   - **渲染进程桥(已证,仅 Electron renderer 可达)**:`window.qoderDesktop.*` preload 桥
     暴露全套方法(见 §3)。这就是那 11 张 sqlite 表背后的服务面。
   - **CLI / HTTP / 深链入口(均未证有)**:本机 `qoderclicn.exe` 未安装(PATH 与
     `~/.qoder-cn/bin` 均无);CLI worker 运行时
     `qoder-worker-runtime.obf.mjs` 对 `sessionImport|SessionMigration|migrateSourceSession`
     **0 命中**;`external-commands/registry.json` 只有 `wiki` 一条外部命令;
     `mcp.json` 为空、`mcp-router.json` 是 MCP 服务器路由(含本机 apiKey,不回放),不是会话 API。
     `product.json` 注册了 `protocolScheme:"qoder-cn"` 深链,但 asar 内未检索到
     `open-url`/`second-instance` 等字面处理点(整包字符串加密,**深链射程未判定**)。
2. **source_product 取值集合(官方支持导入的来源产品)已从代码字符串池现读确认**:
   `["quest", "qoderWork", "questCn", "qoderWorkCn", "workbuddy"]`
   显示名映射(逐字):`quest:"Qoder IDE（Quest）"`、`qoderWork:"QoderWork"`、
   `questCn:"Qoder IDE CN（Quest）"`、`qoderWorkCn:"QoderWork CN"`、`workbuddy:"WorkBuddy"`。
   即:**只从 Qoder 家族(Quest IDE 国际/CN、QoderWork 国际/CN)与腾讯 WorkBuddy 导入**,
   不支持任意第三方编辑器,也不接受用户传入的任意路径。
3. **能否用官方通道灌入外部会话:不能直接灌,只有一条"伪装来源"的间接路。**
   扫描器只认每个来源产品**硬编码的盘上布局**(asar 内 `sessionMigrationSources` 三条源,
   各自带 `platforms.{darwin,win32,linux}.databaseRelativePaths`(sqlite,路径段含 `"db"`)、
   `automationTasksRelativePaths`、`transcriptRootDirectoryName`;逐字源码把路径段住
   字符串池里,未解码)。**没有** `--from <path>` 类参数、没有自定义目录选择器
   (`migrateDataDirectory` 是"搬家 Qoder 自己的数据目录",与会话导入无关,已排除)。
   可行的间接形态:把外部会话**落成 WorkBuddy 的本机布局**
   (`~/.workbuddy/projects/<workspace>/*.jsonl` + `~/.workbuddy/workspace/sessions/<uuid>/`,
   布局已由 `docs/RELAY_SESSION_MIGRATION_EVIDENCE.md` §3 实测),然后在设置→导入数据里
   让官方扫描器发现并经 `startSessionImport` 灌入。此路成败取决于 workbuddy 适配器对
   sqlite/JSONL 的结构校验深度,**未实测(本席禁写禁启动),判"未判定·候选可行"**。
4. **盘上留痕证明这套功能真的扫过**:只读打开
   `%APPDATA%/com.qodercn.app.stable/sessionMigration.sqlite`,
   `candidate_snapshot_meta` 恰 1 行:
   `{"source_product":"workbuddy","captured_at":1792494434831,"session_count":0}`
   (≈2026-10-21 的一次检测,发现 0 个候选)——`source_product` 字面取值就此实证,
   其余 10 张表仍 0 行(从未真正导入过)。

## 2. 证据源表

| #   | 源(一手)                                                             | 取证动作                                          | 关键产出                                                                                                             |
| --- | -------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `G:\Qoder CN\.qoder-versions\0.4.11\resources\app.asar`(189MB,现役版) | `grep -a` 字符串检索 + 上下文窗口提取             | IPC 方法表、`window.qoderDesktop.*` 桥、`sessionMigrationSources`、source_product 数组、中文文案                     |
| 2   | `...\state.ini`(Launcher)                                            | 读                                                | 现役 `installDir=G:\Qoder CN`,appExecutable=`.qoder-versions\0.4.11\Qoder CN.exe`                                  |
| 3   | `%APPDATA%/com.qodercn.app.stable/sessionMigration.sqlite             | `node:sqlite` `readOnly:true`                     | `candidate_snapshot_meta` 1 行 `workbuddy/session_count=0`,余表 0 行                                                |
| 4   | `~/.qoder-cn/entry/qodercn-dispatcher.ps1`                             | 读                                                | CLI 解析链(`qoderclicn`/`QODERCN_CLI_BIN`),提示 `qodercn ide`/`chat`/`serve-web`/`tunnel` 子命令;本机 CLI 未安装 |
| 5   | `~/.qoder-cn/external-commands/registry.json`                          | 读                                                | 仅 `wiki` 一条外部命令,无 import/migrate 类                                                                          |
| 6   | `~/.qoder-cn/{argv.json,mcp.json,mcp-router.json,settings.json}`、`%APPDATA%/com.qodercn.app.stable/qoder-data.v1*.json` | 只取键名+脱敏值形态(node 遍历,不回显内容) | 导入/迁移开关**零命中**:仅 `onboardingSeedVersion`、`aicodingPluginSettingsMigrationVersion`(插件设置版本位,非本功能);qoder-data.v1.ext.json 823 叶键无 import/migration 族 |
| 7   | CLI worker `app.asar.unpacked/.../@qoder-ai/qoder-cn-agent-sdk/dist/_worker/qoder-worker-runtime.obf.mjs` | grep 计数 | `sessionImport|SessionMigration|migrateSourceSession` = **0** ⇒ CLI 侧无此能力 |
| 8   | `G:\Qoder CN\resources\product.json`                                   | 读                                                | `protocolScheme:"qoder-cn"`(深链注册存在,处理面未判定)                                                              |

## 3. 服务面全清单(由 asar 逐字检索)

### 3.1 renderer 桥(`window.qoderDesktop.*`,preload 层逐字命中)

- 会话迁移:`getSessionMigrationOverview(force?)` · `listSessionMigrationCandidates(sourceProduct, force?)` · `migrateSourceSession(payload)`
- 导入作业(对应 `import_job*` 表):`startSessionImport` · `getSessionImportJob` · `resumeSessionImport` · `pauseSessionImport` · `cancelSessionImport` · `onSessionImportProgressChanged`
- WorkBuddy 族:`getWorkBuddyMigrationOverview` · `startWorkBuddyMcpMigration` · `startWorkBuddySkillMigration` · `startWorkBuddyPluginMigration`(能力包:Skill/MCP/插件)
- QoderWork 族:`getQoderWorkMigrationOverview` · `getQoderWorkMigrationState` · `startQoderWorkMigration` · `onQoderWorkMigrationStateChanged`
- 其他:`getMemoryMigrationOverview`(记忆,配 `memoryMigration.sqlite`) · `inspectRemoteQoderIdeImport` / `importRemoteQoderIdeData`(**SSH 远端导入**,见 §3.3) · `getAutomationTaskImportOverview` / `automationTaskImportStart`(自动化任务)

### 3.2 IPC 通道注册表(主进程 ⇄ 渲染,方法名逐字命中)

`sessionMigrationGetOverview` / `sessionMigrationListCandidates` / `sessionMigrationMigrate` /
`sessionImportGetJob` / `sessionImportStart` / `sessionImportResume` / `sessionImportPause` /
`sessionImportCancel` / `automationTaskImportGetOverview` / `automationTaskImportStart` /
`automationTaskImportProgressChanged`。通道字符串本体住加密池(形如 `x(1476,1525)`),
外部进程无 socket/pipe 可投:IPC 面 = `~/.qoder-cn/ipc/` 仅 `browser-use.json`(浏览器连接器句柄),与会话导入无关。

### 3.3 SSH 远端导入(文案逐字,第二入口形态)

`remoteImportTitle:"从 SSH 实例导入"`:只读**已登记的 SSH 实例**(设置-连接),从远端 Qoder IDE
Remote Runtime 导入 会话/任务/记忆/MCP;硬约束逐条见于文案:身份绑定
(`remoteImportSessionsMissing:"未找到当前本机身份对应的远端 Qoder IDE 会话"`、
`remoteImportMachineIdMissing`)、版本闸(`remoteImportRuntimeUnsupported:"…Remote Runtime 版本不支持数据迁移"`)。
同样**不接受任意路径/任意产品**。

## 4. 输入清单形状(扫描器期望什么)

`sessionMigrationSources`(asar 逐字结构,值经加密函数 `n()` 间接):

1. 源 #1:四平台齐,`databaseRelativePaths`(多段路径,中段含字面 `"db"`,即 sqlite 会话库)+ `automationTasksRelativePaths` → 对应 **QoderWork/qoderWorkCn**(有自动化任务面)。
2. 源 #2:darwin/win32,`databaseRelativePaths`(两候选)+ `transcriptRootDirectoryName` → 对应 **WorkBuddy**(会话 sqlite + JSONL 转写根)。
3. 源 #3:三平台仅 `transcriptRootDirectoryName` → 对应 **Quest**(纯 JSONL 转写根,与本机 `~/.qoder-cn/projects/<ws>/*.jsonl` 同构)。

适配器映射逐字:`bVx={quest:gl0, questCn:gl0, qoderWork:a0x, workbuddy:aVx}`。
`applicationEnvironment` 提供 `importSourceNames`/`importSourceProducts` 覆盖位(仅改名/裁剪,
不能新增来源;`importSourceProducts` 由进程环境判定,非生产环境直接返回空集)。
目标侧落库字段即 `migration_ledger(source_product, source_ref, content_sha256, source_mtime,
target_session_id, target_jsonl_path, title, fidelity_level, degrade_stats, imported_at,
status, emitted_line_count)`(逐字命中 `kVx(t)` 行映射:`sourceProduct/sourceRef/contentSha256/
sourceMtime/targetSessionId/targetJsonlPath/title/fidelityLevel/degradeStats/importedAt/status/emittedLineCount`)。
语音族另有 `sourceVoiceSessionId/sourceThinkingSessionId/projectionSha256` 行映射(逐字命中)。

## 5. 与自研导入对比的判定

- 官方通道**不可脚本化触发**(无 CLI 子命令、无 HTTP、无本地 socket 面、深链未证),自动化灌入只能走自研。
- 但官方通道**验证了目标形状**:它写进 CLI 会话目录的也是 `target_jsonl_path` 指向的 JSONL
  (与 `~/.qoder-cn/projects/<ws>/<sessionId>.jsonl` 同面),且自带去重账(content_sha256+source_ref)
  与降级计量(fidelity_level/degrade_stats/emitted_line_count)——自研导入器可对照这 12 个字段补台账。
- "伪装 WorkBuddy 布局借官方通道"是候选路线(§1.3),风险在适配器结构校验未知;若要做,
  先小样本试 `~/.workbuddy/projects/` 面(转写根通道),再观察 `candidate_snapshot_meta.session_count` 是否 >0。

## 6. 未判定项(点名)

1. **深链 `qoder-cn://` 是否路由到导入页**:整包字符串加密,`open-url`/`second-instance` 字面零命中,未解码池 ⇒ 未判定。
2. **workbuddy/quest 适配器对源的结构校验深度**(表名/schema/首行键校验):需动态实验(写夹具+启动),本席纯只读约束下不做。
3. DevTools/CDP 附加到 renderer 后直接调 `window.qoderDesktop.startSessionImport` 是否可行:理论通路,需以调试端口启动应用,未实测。
4. `databaseRelativePaths`/`transcriptRootDirectoryName` 的具体明文路径:住加密字符串池,静态未解(源 #3 的转写根按同构布局推断为 `<产品配置目录>/projects`,标注为推断非实证)。

## 7. 复现命令(全部只读)

```bash
A="/g/Qoder CN/.qoder-versions/0.4.11/resources/app.asar"
grep -aoE 'te=\["quest"[^]]*\]' "$A"                       # source_product 取值集
grep -aoE '"settings\.importDataAction":"[^"]*"' "$A"      # 设置页「导入数据」入口文案
grep -aoE 'window\.qoderDesktop\.(start|get|list|migrate)[A-Za-z]*' "$A" | sort -u   # 桥方法面
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.APPDATA+'/com.qodercn.app.stable/sessionMigration.sqlite',{readOnly:true});console.log(db.prepare('SELECT * FROM candidate_snapshot_meta').all())"
```
