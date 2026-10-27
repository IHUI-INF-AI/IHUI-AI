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
   实测 13 个工作区 / 113 份转写。首行键 `type,sessionId,directories`(WorkBuddy 是
   `type,sessionId,timestamp`)。⇒ 现有五腿(盘点/备份/恢复/台账/搬移)的**原语可复用**,
   只需泛化"根路径 + 会话目录布局"(Qoder 的会话目录与转写同在 `projects/<ws>/` 下,
   不像 WorkBuddy 分成 `workspace/sessions/` 与 `projects/`)。
2. **Qoder 内置官方「会话导入」子系统** ——
   `%APPDATA%/com.qodercn.app.stable/sessionMigration.sqlite`,11 张表,核心
   `migration_ledger(source_product, source_ref, content_sha256, target_session_id,
   target_jsonl_path, title, fidelity_level, degrade_stats, imported_at, status, emitted_line_count)`
   加 `import_job` / `import_job_item` / `import_history` / `candidate_snapshot` 与两组语音迁移台账;
   配套 `memoryMigration.sqlite`(记忆迁移,2 表)。**当前全表 0 行**(仅 `candidate_snapshot_meta` 1 行)
   ⇒ 功能在客户端里,但本机从未用过。它反证两件事:导入目标形态 = **本机 jsonl**;
   "从别的产品导入会话"是官方认可的能力面(后续可查其 CLI/命令入口,本轮未做)。
3. **Trae CN / TRAE SOLO CN 本地没有会话正文** ——
   `~/.trae-cn/` 只有 `memory/`(2 个项目目录 + `user_profile.md`,是 AI 记忆不是对话);
   `User/globalStorage/state.vscdb`(2.3MB / 1.1MB)里会话相关键只有
   `revert:attachment-meta:v1:session:*`(622B)、`draft:session:*:code`(379B)、
   `AI.agent.model.session_selected_model`(数百字节)—— 都是草稿/附件元数据/选型;
   `icubeAiChat%` 键 21 个、总长 **42 字节**;最长键是 `model_list_map`(274KB)与主题。
   ⇒ 完整对话**大概率在云端**,本地不可搬。**判定为「未判定」而非「不存在」**:
   要定论还需在登录态下抓聊天历史请求,或查客户端导出对话入口(本轮未做)。

## 1. 证据源与实测规模(2026-10-28 本机)

| 源 | 路径 | 实测 |
| --- | --- | --- |
| Qoder 会话库 | `~/.qoder-cn/projects/<ws>/` | 13 个工作区 / 113 份 `*.jsonl`;同名会话目录并存 |
| Qoder 会话文件形状 | 首行 | 键 `type,sessionId,directories`(不打印内容) |
| Qoder 导入台账 | `%APPDATA%/com.qodercn.app.stable/sessionMigration.sqlite` | 11 表;`migration_ledger` 等 0 行;`candidate_snapshot_meta` 1 行 |
| Qoder 记忆迁移 | 同目录 `memoryMigration.sqlite` | 2 表;0 行 |
| Qoder 应用数据 | `%APPDATA%/com.qodercn.app.stable/` | `.auth` / `.bin` / `app-plugin-data` / `*.v1.json` 等(无 .vscdb) |
| Trae 记忆 | `~/.trae-cn/memory/projects/` | 2 个项目目录 + `user_profile.md` |
| Trae 状态库 | `%APPDATA%/Trae CN/User/globalStorage/state.vscdb` | 2.3MB;无会话正文键(见结论 3) |
| TRAE SOLO 状态库 | `%APPDATA%/TRAE SOLO CN/User/globalStorage/state.vscdb` | 1.1MB;同上 |
| Trae 工作区状态 | `.../User/workspaceStorage/<hash>/state.vscdb` | 147KB / 20KB;无会话正文 |

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

**Qoder(可搬,建议下一刀)**
- 复用 `relay-session-*` 五腿的原语,新增一个路径适配层(根 = `~/.qoder-cn/projects`,
  会话落点 = `<ws>/<sessionId>.jsonl` + `<ws>/<sessionId>/`),不要复制判据(§0.6)。
- 账号分桶键:Qoder 的登录态四件套(`auth.v1.dat` + `machine-id` + `.auth/machine_id` +
  `auth-profile-overlays.v1.dat`)里的机器标识**不随账号变**,因此只能沿用**方案 A**
  (按切换时刻分桶,存量显式未归属),与 WorkBuddy 同口径。
- 搬移前置同上:当日快照 + 客户端存续检查(§9d 的 guard 可复用)。

**Trae(卡在取证)**
- 本地无正文 ⇒ 先取证:① 登录态下抓聊天历史请求(是否为云端分页接口);② 客户端导出对话入口
  (对 `app.asar`/二进制做 strings,本轮未做);③ 若有导出文件,落在哪。
- 在拿到上述证据前**不做**任何搬移实现(§0.3)。

## 4. 未做/未判定清单

- Qoder `sessionMigration` 的**触发入口**(CLI 子命令? 设置项?)未取证 —— 若存在,是"外部会话灌入 Qoder"
  的官方通道,价值高于自研导入。
- Trae 云端会话端点未取证(未抓包)。
- Qoder 会话目录内文件的完整清单(是否含 attachments 等)未逐项枚举,搬移前需一次只读盘点确认。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
