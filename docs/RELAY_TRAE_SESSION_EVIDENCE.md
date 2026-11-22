<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Trae CN / TRAE SOLO CN 会话历史本机会证(2026-10-28)

> 承接 `docs/RELAY_IDE_SESSION_EVIDENCE.md` 与 `docs/RELAY_SESSION_MIGRATION_EVIDENCE.md`
> 的方法论:一手证据、三态口径(实测 / 推断 / 未判定)、不猜。**纯只读**,零写入、零抓包、
> 未启动 Trae、未触碰登录态。凡涉凭据只报"存在",不回显值。

## 结论先行

1. **上一轮"本地无会话正文"的结论需要修正**:本机确实存在会话正体的物理落盘 ——
   `%APPDATA%/Trae CN/ModularData/ai-agent/database.db` **431,788,032 字节(≈412MB)**,
   mtime 2026-10-28 08:42(当天仍在写);SOLO 侧同路径 4,653,056 字节(mtime 2026-10-25)。
   上一轮只盘了 `state.vscdb`,漏掉了 `ModularData/ai-agent/` 这一族。
2. **但该库是 SQLCipher 加密的**:`database.db` 与 `Local Storage/config.db` 头部 16 字节
   均**不是** `SQLite format 3\0` 魔数(逐枚实测,随机字节);`ai_agent.dll` 内含
   `sqlcipher` × 165、`cipher` × 421、`PRAGMA key` × 4 处字符串 ⇒ 明文拷贝不可读,
   **按文件搬运的路径不成立**(密钥来源未取证,本票不做解密尝试,越界)。
3. **会话正文同时住在云端**:DLL 方法表与 protobuf 结构体含
   `RemoteGetMessagesResponse` / `GetHistoryUploadURL*` / `GetHistoryDownloadURL*` /
   `api/agent/v3/query_history_state` / `sync_history_state` ⇒ 聊天历史走云端同步,
   `get_messages` 是远程语义。**本地还是云端:两边都有,本地那份加密。**
4. **客户端自带「导出对话」入口(实测静态可见)**:workbench bundle 注册命令
   `workbench.action.icube.aiChatSidebar.exportCurrentSession`(标题 "Export Chat",
   AI 聊天面板标题栏菜单,聊天进行中禁用,内部调 `exportChatToFile()`),
   特性开关 `icubeExportChatEnabled`;DLL 侧有对应 RPC `export_past_chat` /
   `ExportPastChatRequest`。**能否批量搬:不能**;**单条搬:有机主登录后在客户端
   点 Export Chat 一条人肉路径**,导出落点格式本轮未判定(需登录态真点一次)。
5. TRAE SOLO CN **没有独立安装目录、没有独立注册表卸载条目**(实测枚举未命中);
   同一 Trae CN 安装包内有 `workbench.desktop.main.solo-lite*.js` 双形态 bundle,
   且 `%APPDATA%/TRAE SOLO CN/solo-lite/` 存在 ⇒ 推断 SOLO 复用 Trae CN.exe 的
   solo-lite 形态(推断,未定论)。

## 1. 证据源表(2026-10-28 本机,全部一手实测)

| 源 | 实测命令摘要 | 结论(三态) |
| --- | --- | --- |
| 安装目录定位 | 注册表 `Uninstall /f Trae` 零命中;`ls -d %LOCALAPPDATA%/Programs/Trae*` 命中 | 实测 = `C:/Users/Administrator/AppData/Local/Programs/Trae CN`(Inno Setup,`unins000.*`) |
| 包形态 | `ls resources/` | 实测:无 `app.asar`,为解包 `resources/app/` + `node_modules.asar` |
| 会话库候选 | `find`(四目录,按扩展名 sqlite/db/leveldb/rocksdb/vscdb) | 实测:`ModularData/ai-agent/database.db`(CN 412MB / SOLO 4.4MB)、`Local Storage/config.db`、两级 `state.vscdb` |
| 加密判定 | `node` 只读读首 16 字节对魔数;`node:sqlite` 打开报 `file is not a database` | 实测:三枚 .db 头部皆非 SQLite 魔数 ⇒ 加密(非未判定,是实测否定) |
| 加密实现 | `grep -a` 于 `modules/ai-agent/ai_agent.dll`(280MB) | 实测:sqlcipher×165 / PRAGMA key×4 |
| 会话 RPC | `grep -a -oE ".{60}export_past_chat.{80}"` 于 DLL | 实测方法表:`start/stop/delete/fork_chat_session`、`export_past_chat`、`get_messages`、`get_message_by_id`、`freeze_chat_session` |
| 云同步证据 | `grep -a "struct ..."` 于 DLL | 实测:`RemoteGetMessagesResponse`、`RemoteGetChatSessionResponse`、`GetHistoryUpload/DownloadURL*`、`CheckHistoryEx…`;路径 `api/agent/v3/query_history_state`、`sync_history_state` |
| 导出 UI | `grep -oE "icube…export…" workbench.desktop.main.js` | 实测:命令 `…exportCurrentSession`(带 disableWhenChating 变体)、original 标题 "Export Chat"、`icubeExportChatEnabled` |
| API 路径清单 | `grep -a -oE "/(ide\|api\|open)…"` 于 DLL | 实测:`api/ide/v1/chat`、`api/ide/v1/agents/runs`、`api/ide/v1/practice/generate_conversation_title`、`api/agent/v3/*` 全谱 |
| API 宿主 | 同上,全域名枚举 | **未判定**:包内只见 `docs.trae.cn`/`www.trae.cn`(文档站)与遥测域;聊天网关 base URL 由 bootConfig 运行时下发,静态不可见(且本票禁抓包) |
| `~/.trae-cn`(实体 `G:/IHUI-AI/.DevEnv/cache/userhome/.trae-cn`) | `ls` + `find *.jsonl` | 实测:比上一轮登记多出十余个顶层目录;`memory/projects/<一个项目>/2026*/session_memory_*.jsonl` 共 17 枚,**首行 JSON 键** = `intent,actions,outcome,learned,message_summary_time,message_id,compact_summary_meta` ⇒ 压缩记忆摘要,**不是转写**;`work/`、`assistant/` 空;存在 `trae-jwt-token`(只报存在,未回显) |

## 2. 逐条排除清单(查过,不是会话正文的明文载体)

- `%APPDATA%/Trae CN/User/globalStorage/state.vscdb`(2.3MB)与 `workspaceStorage/*/state.vscdb`:
  上一轮已量,仅草稿/附件元数据/选型键(前提,未重复做)。
- `%APPDATA%/Trae CN/Session Storage`(103KB)、`WebStorage`(40KB)、`Local Storage/leveldb`:
  Chromium webview 存储家族,体积与用途均不匹配 412MB 会话库;`Local Storage/config.db` 已判加密。
- `%APPDATA%/Trae CN/ModularData/ai-agent/command-execution/<md5>/`、`snapshot/`(20 轮保留)、
  `sandbox/`、`hooks_env/`:命令执行留痕/快照目录,非对话转写。
- `%APPDATA%/Trae CN/ModularData/ai-agent/agent-data-migration-state.json`:
  内部 schema 迁移状态(version/tasks.project_domain_v2/watermark)⇒ 反证 database.db
  确由 ai-agent 模块管理并在演进。
- `resources/app/extensions/ai-completion/`(代码补全)、`byted-icube.integrations-extended`、
  `cloudide.dsl-agent-logs`:grep 方法名/键位均不含会话正文读取路径。
- `~/.trae-cn/memory/**/session_memory_*.jsonl`:见证据表,摘要族非转写族。
- `G:/`、`D:/` 盘根与 Program Files:`find -maxdepth 3 -iname *trae*` 未命中其它安装副本。

## 3. 要定论还缺什么证据

1. **导出格式与落点**:需机主在登录态真点一次 "Export Chat"(客户端内动作),或登录态抓包
   看 `export_past_chat` RPC 的返回载荷形态。本票刻意排除 ⇒ **未判定**。
2. **聊天网关 base URL**:bootConfig 运行时下发,静态字符串枚举不可得;抓包才拿得到 ⇒ **未判定**。
3. **SOLO 的应用形态**:推断复用 Trae CN.exe(solo-lite bundle),但从未实测启动参数;
   定论需看一次 SOLO 进程的命令行(启动它被本票禁止)⇒ **未判定**。
4. **SQLCipher 密钥来源**:未取证也**不取**(解密他人无法授权的库超出本票范围;即便可解,
   产物也是别人产品的私有格式)。

## 4. 施工建议:**不施工**

- 按文件搬:库加密 + 私有 schema + 云端双主 ⇒ 硬搬必坏,五腿原语(WorkBuddy/Qoder 型)
  在此**无可复用面**(那边是明文 jsonl,这边连明文面都不存在)。
- 唯一现实出口 = **人肉逐条导出**:机主打开 Trae CN → 目标会话 → 面板标题栏 "Export Chat"
  →(若开关 `icubeExportChatEnabled` 被灰掉则此路也不通,现读客户端界面判定)。批量历史
  只能走云端 API,那需要登录态凭据与逆向私有协议,投入产出比不成立,且踩 §「不代取凭据」边界。
- 若未来 Trae 官方提供数据导出/账号注销数据包申请(参见 docs.trae.cn 隐私口径),以官方渠道为准。

## 5. 本次用的关键命令(全部只读,可复跑)

```bash
# 1. 安装定位 + 包结构
ls -d "$LOCALAPPDATA/Programs/Trae CN" && ls "…/resources/app"
# 2. 会话库候选枚举(四目录,按扩展名)
find "$APPDATA/Trae CN" -type f \( -iname "*.db" -o -iname "*.vscdb" -o -iname "*.leveldb" \) | grep -v …
# 3. 加密判定(首 16 字节对 SQLite 魔数)
node -e '…fs.readSync(fd, Buffer.alloc(16), 0, 16, 0)…'
# 4. DLL 字符串取证(方法表/struct/API 路径)
grep -a -oE ".{60}export_past_chat.{80}" "…/modules/ai-agent/ai_agent.dll"
# 5. 导出 UI 命令定位
grep -oE "icube[a-zA-Z.]*[Ee]xport[a-zA-Z.]*" "…/out/vs/workbench/workbench.desktop.main.js"
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
