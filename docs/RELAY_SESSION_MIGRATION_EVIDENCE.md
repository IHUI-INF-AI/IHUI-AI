<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# WorkBuddy 会话搬家取证记录(⑦施工前置 · 2026-10-27)

> 本文是号池对标 workbuddy-switch ⑦「会话搬家」的一手取证记录。
> 结论先行:**该能力是本地操作,不依赖云端会话端点** —— 证据反事实:官方
> 客户端 asar、官方 web 全部 chunk、本机登录态、wb-switch 二进制里均未发现
> 任何会话列表/导出/写回/删除的云端 API;搬家的真实作用面是本地存储。

## 1. 证据源与排查面(全部一手,当日实测)

| 源 | 位置 | 结论 |
|---|---|---|
| wb-switch 二进制 | `%LOCALAPPDATA%/workbuddy-switch/wb-switch-rust.exe`(27.5MB, Rust/tauri) | 命令面字符串全解(见 §2) |
| 官方桌面客户端 | `G:/workbuddy/resources/app.asar` + `conversation-report.html` | 主 asar 为壳,零会话 API 路径;报告模板给导出字段形状(§4) |
| 官方 web 门户 | `assets.workbuddy.cn`(15 个核心 chunk 全拉取) | 仅 `/billing/ide/trial` 等计费面,零会话 API |
| 官方聊天 SPA | `copilot.tencent.com/console/` | 401(APISIX 网关挡未登录壳请求),静态 chunk 名不可枚举 |
| 本机登录态 | `%LOCALAPPDATA%/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop.info` | auth/account 两面;当前 accessToken 为 `$wbEncrypted` 信封 |
| 本机会话库 | `~/.workbuddy/workspace/sessions/<uuid>/`、`~/.workbuddy/projects/<workspace>/*.jsonl` | 2026-10-27 实测 58 会话目录 / 90 工作区 / 217 份转写 |

已排除的假设:~~会话搬家走云端会话 API~~(credits.rs/variant2.rs/asar/web 四面
均无 `/conversations` 类端点;wb-switch 二进制中唯一会话样 hit 是本地深链
`/api/open-session`)。

## 2. wb-switch 会话搬家命令面(exe 字符串逐字取证)

- **账号切换族**:`switch_account` / `switch_codebuddy_ide_account` /
  `switch_codebuddy_cn_ide_account` / `switch_codebuddy_cli_account` /
  `switch_vscode_ext_account` / `switch_jetbrains_account` —— 按 IDE 形态
  切本地 auth 文件(auth 文件按 variant 命名:`auth.workbuddy` / `auth.workbuddy-ai`)。
- **会话搬移族**:`list_sessions` / `list_account_sessions` / `copy_sessions` /
  `copy_sessions_cross` / `copy_linked_sessions` / `session_sync_cross` /
  `sync_session_group_safe_batch` / `sync_session_group_unify` /
  `sync_session_group_pair` / `preview_session_group_pair`。
- **预览先行**:`*_session_links_preview`(含 `codebuddy_intl_ide_session_links_preview`)——
  所有跨账号动作都有 preview 档,先看后动。
- **台账与锁**:`codebuddy_ide_session_links.json` / `vscode_session_links.json` /
  `session_links.json` + `*.lock`(会话链接台账是搬家的记账面)。
- **覆盖的 IDE 面**:CodeBuddy IDE(`codebuddy-ide-sessions`)、VSCode 扩展
  (`vscode-sessions`)、CLI、JetBrains(`secret-storage.xml` 特征)。

## 3. 本机会话面清单(⑦操作对象)

1. **桌面登录态**:`%LOCALAPPDATA%/CodeBuddyExtension/Data/Public/auth/
   workbuddy-desktop.info`(备份在 `~/.wb-switch/backups/`)。注意环境陷阱:
   沙盒/便携环境的 `LOCALAPPDATA` 可能被重定向,必须双候选探测(实现见
   `relay-session-inspect.ts` 的 `defaultInspectPaths`)。
2. **会话库**:`~/.workbuddy/workspace/sessions/<conversationId>/`(每会话一目录)
   + `~/.workbuddy/projects/<workspace>/<conversationId>.jsonl`(逐会话转写)。
3. **wb-switch 状态**:`~/.wb-switch/`(accounts.json / backups / hook-events.jsonl)
   与 `%LOCALAPPDATA%/workbuddy-switch/`(含 `*_session_links.json` 台账,本机未建)。

## 4. 官方导出形状(conversation-report.html 字段投影)

`conversationId` / `title` / `role` / `content` / `textContent` / `timestamp` ——
官方"会话报告"是自包含 HTML,数据键位即上列。⑦做导出时对齐此形状,不发明第三种格式。

## 5. ⑦施工红线(隐私删除链,定案先行)

- 会话库**无按账号分桶的本地标记**(实测):跨账号搬移前必须先建隔离台账,
  否则搬家=串号(把 A 账号的会话历史暴露给 B 账号)。
- 删除/写回链设计先行:逐条可撤、先备份后动、永不静默清空 —— 设计票另起,
  不在本记录内拍板。
- 只读盘点器 `pnpm relay:sessions`(apps/api/scripts/relay-session-inspect.ts)
  是⑦第一刀:零写入/零上游/永不回显 token 与消息内容。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
