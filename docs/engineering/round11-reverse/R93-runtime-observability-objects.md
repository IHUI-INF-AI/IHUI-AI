<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R93 — 运行期观测：不用跑起来，它的运行痕迹已经在磁盘上

R92 结尾我给出的唯一剩余路线是"动态观测"。这轮走通了它的**第一层**，而且发现根本不需要驱动 codex——它每次启动都在 `~/.codex` 里写下三份可读的运行时数据。

## 三层数据

| 位置 | 内容 | 为什么算运行期证据 |
| --- | --- | --- |
| `~/.codex/logs_2.sqlite` | 2,361 行 `tracing` 事件 | `target` 列由 `tracing` 从**发射代码的 crate/module 路径**填充 |
| `~/.codex/state_5.sqlite` | 15 张表 / 109 列 / 62 条迁移 | 每张表的列由 `sqlx` 从**结构体字段**逐字段映射 |
| `~/.codex/.codex-global-state.json` | 17 个 `electron-*` 键 | Electron 主进程的 atom 持久化 |

这三份都不是二进制里的字符串，是**已经跑过的 codex 写下来的**。读它们等于读它自己承认的运行期形状。

## 一、crate 树：12 个 target，7 个 crate

```
codex_login::auth::manager                                   1,402
codex_app_server_transport::transport::remote_control::websocket   707
codex_app_server::message_processor                            217
codex_skills_extension::host_service                             9
codex_skills::interface                                          6
codex_http_client::custom_ca                                     4
codex_app_server::request_processors::initialize_processor       3
codex_app_server::outgoing_message                               3
codex_core_plugins::manifest                                     3
codex_core_plugins::loader                                       3
codex_core_plugins::manager                                       2
codex_core_plugins::startup_sync                                  2
```

**前三个占 2,326 / 2,361 = 98.5%。** 这个分布本身就是结论：这个二进制把绝大部分日志带宽花在**一个 auth 重试循环**和**一个 websocket transport**上，所以早前在字符串里看到那么多 retry 形状的东西不是巧合。

**crate 划分也解决了一个字符串层面判不了的问题**：`codex_skills` 与 `codex_skills_extension` 是**两个平级 crate**，不是"一个模块带子模块"。只按第一个 `::` 切就证明了——`codex_skills_extension::host_service` 不可能是 `codex_skills` 的子模块，否则同级 crate 名会缺前缀。

同理 `codex_app_server` 与 `codex_app_server_transport` 也是平级。

## 二、`state_5.sqlite`：`Thread` 结构被写下来了

62 条 `_sqlx_migrations` 不是杂项，**它就是结构体的变更日志**：

| 版本 | 迁移 | 意味着 `Thread` 多了什么 |
| --- | --- | --- |
| 1 | `threads` | 建表 |
| 5 | `threads cli version` | `cli_version` |
| 13 | `threads agent nickname` | `agent_nickname` |
| 20 | `threads model reasoning effort` | `reasoning_effort` |
| 21 | `thread spawn edges` | 子 agent 派生边表 |
| 22 | `threads agent path` | `agent_path` |
| 24 | `remote control enrollments` | 远程控制注册表 |
| 26 | `thread dynamic tools namespace` | `namespace` |
| 30 | `threads thread source` | `thread_source` |
| 39 | `threads recency at` | `recency_at` |
| 40 | `threads history mode` | `history_mode` |
| 43 | `threads is pinned` | `is_pinned` |
| 49 | `projects` | 项目管理 |
| 53 | `threads originator` | `originator` |
| 54 | `threads daybreak enabled` | `daybreak_enabled` |
| 56 | `threads creator identity` | `creator_user_id` / `creator_account_id` |
| 62 | `threads attached parent` | `attached_thread_parent_id` |

还有五条 `drop`：`logs`、`device key bindings`、`thread goals`、`memory tables`、`agent jobs`——**它们被建过又删了**，删掉的表迁到了独立库（`goals_1.sqlite`、`memories_1.sqlite`）。这说明 codex 做过一次**按域拆库**的重构，`state_5` 只留下 thread 与 project。

### `threads` 43 列

```
id, rollout_path, created_at, updated_at, source, model_provider, cwd, title,
sandbox_policy, approval_mode, tokens_used, has_user_event, archived, archived_at,
git_sha, git_branch, git_origin_url, cli_version, first_user_message, agent_nickname,
agent_role, memory_mode, model, reasoning_effort, agent_path, created_at_ms,
updated_at_ms, thread_source, preview, recency_at, recency_at_ms, history_mode, name,
is_pinned, thread_section_id, section_position, section_entered_at_ms, project_id,
originator, daybreak_enabled, creator_user_id, creator_account_id, attached_thread_parent_id
```

**43 列，与 R69 静态走记录数组抽出的 43 个 `Thread` 字段名数量吻合。**

但必须说清这不是"完全一致"：

- 列集合里有 **8 个是持久化管道**，不是 serde 字段——`created_at_ms`、`updated_at_ms`、`recency_at_ms`、`thread_section_id`、`section_position`、`section_entered_at_ms`、`project_id`、`attached_thread_parent_id`（外键与时间戳）。
- 二进制走法**漏掉、数据库补上**的 11 个名字：`memory_mode`、`agent_role`、`reasoning_effort`、`history_mode`、`thread_source`、`daybreak_enabled`、`creator_user_id`、`creator_account_id`、`is_pinned`、`originator`、`attached_thread_parent_id`。
- 所以：**数量对上，集合不同**。数量吻合说明两条取证路线指向同一个结构；集合差异说明 sqlx 的列比 wire 结构多带了存储侧字段。

这是本链第一次拿到 `memory_mode` 与 `daybreak_enabled`——R72 抽 25 名时这两个完全没出现。

## 三、`.codex-global-state.json`：证实前端是 Electron，且当前未登录

17 个键，全部落在 4 个命名空间：`desktop-`（1）、`electron-`（13）、`local-`（1）、`primary-runtime-`（1）。

两个键带账号态后缀：

```
electron-account-remote-preference:remote-project-connection-backfill-completed:signed-out
electron-owner-atoms:signed-out
```

**这是"按账号态分区写在键名里"，不是写在值里。** 存储层为每种账号态各养一份 atom，当前活的是 `signed-out` 那份。`electron-renderer-content-owner` 也读 `signed-out`。

所以 A10 那个"判低价值"的结论需要修正一半：**前端确实是 Electron**，这条路不是没有东西可抄，而是"抄的是外壳状态键清单"——有价值，但不是协议层。

这也直接解释了为什么 R93 停在"读磁盘"：**这台机器是登出状态**，任何需要模型调用的路径都跑不起来，hook 流量抓不到。这不是偷懒，是当前安装不具备条件。

所有开关都是关的：`otraces-sample-rate = 0`、`update-cdn-enabled = false`、`prefer-mxc = false`、Windows 两个 framework 开关 = false。队列模式是 `steer`。

## 四、这轮补上了什么

回到 R92 那张覆盖率表：

| 面 | R92 | R93 | 变化 |
| --- | --- | --- | --- |
| 模块树（crate 划分） | 0% | **7 crate / 12 target 全量** | 新增 |
| `Thread` 字段名 | 25（R72） | **43 列，+11 个新名** | 新增 |
| 持久化层形状 | 0% | **15 表 / 109 列 / 62 迁移** | 新增 |
| Electron 面 | "低价值" | **17 键 / 4 命名空间 / 未登录** | 修正 |
| 结构字段表 | 22% | 22% | 未变 |
| 枚举变体表 | 1.9% | 1.9% | 未变 |
| 非 hook 类型层 | 0% | 0% | 未变 |
| 函数语义 | 0% | 0% | 未变 |

**注意最后三行没动。** 这轮补的是"应用层形状"，不是"二进制内部结构"。数据库列名能告诉我们字段叫什么，但**不能告诉我们它是 `Option<String>` 还是 `Vec<T>`**——sqlx 只保存 `TEXT`/`INTEGER`/`BLOB`。

所以这一层解决的是命名，不解决类型。这个边界必须写在报告里，否则下一轮会把"列名"误当"类型契约"。

## 五、验证

| 项 | 结果 |
| --- | --- |
| 三个模块 pytest | **24 passed** |
| 变异 | `LOG_ROWS 2361→2360` 1 红；`TOTAL_COLUMNS 109→108` 2 红；`MIGRATION_COUNT 62→61` 3 红；`SIGNED_IN False→True` 2 红；全恢复绿 |
| ruff | 全绿（F401 / 命名冲突都在生成器源头修） |
| mypy | 3 个源文件无 issue |
| 水印 | 7 个新文件全部注入 |

## 六、诚实边界

1. **没驱动 codex**。没跑一次会话、没抓 hook 流量、没碰任何凭据面。证据全部来自它**已经写下**的文件。
2. `codex_login::auth::manager` 的 1,402 行日志我**只取了 target 名和行数**，没有读 `feedback_log_body`。auth 日志正文里有会话相关的东西，读它对"模块树"零贡献。
3. `.codex-global-state.json` 的**值一个都没抄**——两个键的值是标识符（安装 id、窗口几何），仓库不是放这个的地方。抄的是键名、命名空间、以及"哪个账号分支是活的"。
4. `state_5` 的读取遇到过两次不一致：直接复制会因 WAL 未 checkpoint 只看到 1 张表，带 `-wal`/`-shm` 一起复制才能看到 15 张。**最终读数以带 WAL 的那次为准**，这个坑记下来免得下轮踩。
5. 数据库是**持久化投影**，不是 serde 契约。列名能反推字段名，推不出字段类型，也推不出 `required`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
