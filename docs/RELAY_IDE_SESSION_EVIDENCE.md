<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder / Trae 本机会话库取证(2026-10-28)

> 承接 `docs/RELAY_SESSION_MIGRATION_EVIDENCE.md`(WorkBuddy 版)的方法论:一手证据、
> 反事实排除、不猜。本文回答一个问题:**Qoder 与 Trae 的会话历史能不能像 WorkBuddy 那样按账号搬。**

## 结论先行

1. **Qoder CN 有本机会话库,且与 WorkBuddy 同构** ——
   `~/.qoder-cn/projects/<workspace>/<sessionId>.jsonl`(转写)与同名目录 `<sessionId>/` 并存;
   实测 13 个工作区;顶层会话主转写 27 份(全递归 137 份 —— 差额是会话目录内嵌套 subagents 的
   jsonl,**口径必须区分,别把递归数当会话数**;2026-10-28 复量)。首行键 `type,sessionId,directories`(WorkBuddy 是
   `type,sessionId,timestamp`)。⇒ 现有五腿(盘点/备份/恢复/台账/搬移)的**原语可复用**,
   只需泛化"根路径 + 会话目录布局"(Qoder 的会话目录与转写同在 `projects/<ws>/` 下,
   不像 WorkBuddy 分成 `workspace/sessions/` 与 `projects/`)。
2. **Qoder 内置官方「会话导入」子系统** ——
   `%APPDATA%/com.qodercn.app.stable/sessionMigration.sqlite`,11 张表,核心
   `migration_ledger(source_product, source_ref, content_sha256, target_session_id,
   target_jsonl_path, title, fidelity_level, degrade_stats, imported_at, status, emitted_line_count)`
   加 `import_job` / `import_job_item` / `import_history` / `candidate_snapshot` 与两组语音迁移台账;
   配套 `memoryMigration.sqlite`(记忆迁移,2 表)。**当前全表 0 行**(仅 `candidate_snapshot_meta` 1 行)
   ⇒ 功能在客户端里,但本机从未用过(唯一 1 行是 2026-10-21 官方扫过 workbuddy 的
   `candidate_snapshot_meta`,session_count=0)。它反证两件事:导入目标形态 = **本机 jsonl**;
   "从别的产品导入会话"是官方认可的能力面。**触发入口已取证**(2026-10-28):仅应用内
   (设置→「导入数据」页 + `window.qoderDesktop.*` preload 桥),**无 CLI/HTTP/本地 socket**;
   `source_product` 取值集逐字 = `quest / qoderWork / questCn / qoderWorkCn / workbuddy`
   ⇒ 官方支持从 WorkBuddy 导入。详见 `docs/RELAY_QODER_MIGRATION_ENTRYPOINT.md`。
3. **Trae CN / TRAE SOLO CN 的会话正文就在本地,但是加密库、不可按文件搬(2026-10-28 一手取证更正本条的旧结论)** ——
   `%APPDATA%/Trae CN/ModularData/ai-agent/database.db` 实测 **431,788,032 B 且当天仍在写**;
   三枚 `.db` 首 16 字节**全部非 SQLite 魔数** ⇒ SQLCipher 加密;正文双主(本地库 + 云
   `RemoteGet*` / `sync_history_state`)。`~/.trae-cn/` 只有 `memory/`(AI 记忆,非对话);
   `state.vscdb` 里的会话相关键只有草稿/附件元数据/选型(`icubeAiChat%` 21 键总长 42 字节),
   那是**编辑器侧缓存的假面**,不是会话正文。
   ⇒ **不可按文件搬运**(加密 + 云同步双主,复制出去也解不开);唯一搬运动作 = 客户端标题栏
   `Export Chat`(`icube.aiChatSidebar.exportCurrentSession`,逐条人工)。
   取证全文见 `docs/RELAY_TRAE_SESSION_EVIDENCE.md`。

## 1. 证据源与实测规模(2026-10-28 本机)

| 源 | 路径 | 实测 |
| --- | --- | --- |
| Qoder 会话库 | `~/.qoder-cn/projects/<ws>/` | 13 个工作区;顶层主转写 27 份(递归 137,含嵌套 subagents);同名会话目录并存 |
| Qoder 会话文件形状 | 首行 | 键 `type,sessionId,directories`(不打印内容) |
| Qoder 导入台账 | `%APPDATA%/com.qodercn.app.stable/sessionMigration.sqlite` | 11 表;`migration_ledger` 等 0 行;`candidate_snapshot_meta` 1 行(2026-10-21 扫过 workbuddy) |
| Qoder 记忆迁移 | 同目录 `memoryMigration.sqlite` | 2 表;0 行 |
| Qoder 应用数据 | `%APPDATA%/com.qodercn.app.stable/` | `.auth` / `.bin` / `app-plugin-data` / `*.v1.json` 等(无 .vscdb) |
| **Trae 会话库** | `%APPDATA%/Trae CN/ModularData/ai-agent/database.db` | **431,788,032 B,当天仍在写;SQLCipher 加密(非 SQLite 魔数)** |
| Trae 记忆 | `~/.trae-cn/memory/projects/` | 2 个项目目录 + `user_profile.md`(AI 记忆,非对话) |
| Trae 状态库 | `%APPDATA%/Trae CN/User/globalStorage/state.vscdb` | 2.3MB;仅草稿/附件元数据/选型,非正文(见结论 3) |
| TRAE SOLO 状态库 | `%APPDATA%/TRAE SOLO CN/User/globalStorage/state.vscdb` | 1.1MB;同上 |
| Trae 工作区状态 | `.../User/workspaceStorage/<hash>/state.vscdb` | 147KB / 20KB;非正文 |

注:`~/.trae-cn` 在本机是符号链接,实体在 `G:/IHUI-AI/.DevEnv/cache/userhome/.trae-cn/`
(§26 的家目录改道;迁移时按实体路径取,勿只看链接名)。

## 2. 反事实排除(查过但不是会话库)

- `~/.qoder-cn/app`、`extensions/`、`plugins/`、`file-history/`、`canvas/` —— 应用资源/文件历史/画布。
- `%APPDATA%/com.qodercn.app.stable/logs/*/qodercli/sessions/` —— **每个进程一份的运行日志目录**,
  不是用户会话(名字像但内容是运行日志;按目录数量随重启增长可判)。
- `.../crash-feedback-v1/sessions/*/metrics.jsonl` —— 崩溃反馈指标。
- `~/.trae-cn/assistant/` —— 空目录。
- `~/.qoder`、`~/.qoderwork*` —— 浏览器连接器/技能/命令,非会话。

## 3. 施工建议

**Qoder(已装车,2026-10-28)**
- `pnpm relay:qoder-sessions` 已落地:盘点/备份/台账/搬移/复制/undo/ops 十子命令,
  路径适配层 `findQoderConversationFiles` 自写(会话目录与转写同父),判据 import 现有腿零复写。
- 账号分桶:Qoder 登录态四件套里的机器标识**不随账号变** ⇒ 沿用方案 A(按切换时刻,存量未归属)。
- 存续闸镜像名现读 `Qoder CN.exe`(env `IHUI_RELAY_QODER_IMAGE` 可覆盖);与 WorkBuddy 共用 `session-store.lock`。
- 写面 `--apply` 只走 fixture,真实库零写入。

**Trae(取证完毕:不施工)**
- 会话正文在本地 `ModularData/ai-agent/database.db`,但 **SQLCipher 加密 + 云同步双主**
  ⇒ 复制出去解不开,按文件搬不可行(证据见 `docs/RELAY_TRAE_SESSION_EVIDENCE.md`)。
- 唯一官方出口 = 客户端 `Export Chat`(`icube.aiChatSidebar.exportCurrentSession`,逐条人工)。
- 结论:**不做搬移实现**;若日后要做,必须先拿到导出文件的格式与落点(需登录态真点一次)。

## 4. 未做/未判定清单

- Qoder 会话目录内文件完整清单(attachments 等)未逐项枚举,搬移前需一次只读盘点确认。
- Qoder 官方导入的**参数级调用面**(`listSessionMigrationCandidates`/`startSessionImport` 的入参形状)
  未展开 —— 已确认只有应用内桥,无 CLI/HTTP;若要走这条官方通道需在客户端内操作或 CDP 附加(未实测)。
- Trae `Export Chat` 的导出格式与落点未取证(需登录态真点一次,本票排除)。
- Trae 聊天网关 base URL 未取证(bootConfig 运行时下发,需抓包,本票排除)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
