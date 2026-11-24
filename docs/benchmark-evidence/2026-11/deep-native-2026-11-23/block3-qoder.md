<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# block3 · Qoder CN 未吸收可复现设计

> 对照对象：Qoder CN 0.5.14，安装根 `C:\Qoder CN`。本轮纯只读取证：未运行 Qoder 本体、
> 未加载任何 node 原生扩展/exe、未提取凭据/token/cookie/登录态。所有结论分级标注
> （观察 / 推断 / 未知），混淆产物只做到字符串与符号级，不声称逆出源码。
> 既有只读参考：`docs/RELAY_QODER_LISTMODELS_EVIDENCE.md`、`docs/RELAY_QODER_MIGRATION_ENTRYPOINT.md`
> （0.4.11 版本取证，本轮不重做其结论）。

## 取证面与覆盖

| 面 | 路径 / 工具 | 粒度 |
|---|---|---|
| worker SDK 协议 | `resources\app.asar.unpacked\node_modules\@qoder-ai\qoder-cn-agent-sdk\dist\_worker\` | `proto\chat.proto` 全文读取；`qoder-worker-runtime.obf.mjs`（34.8MB，XOR base64 混淆）字符串/符号级；`runtime-info.json` 全读 |
| 原生扩展（RTC） | `...\aoq-electron-sdk\prebuilds\win32-x64\aoq_node_ext.node` + 伴随 DLL | rizin `iE`/`ii` 导入导出表 + ASCII 字符串扫描 |
| 原生扩展（系统能力） | `resources\bin\` 下 `native_clipboard.node` / `notification_permission.node` / `system_commit.node` / `dji_mic_button.node` | rizin `iE` + ASCII 字符串扫描 |
| 浏览器桥 | `resources\native-messaging-host\qoder-app-host.cjs`（3559B 全读）；注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.qoder.app.connector`；`resources\browser-connector\chrome-extension\manifest.json` | 源码全读 + 注册清单只读 + 扩展清单只读 |
| 协作 CLI | `resources\collaboration-cli\`（manifest/skills 四篇 md 全读；`dist\host\index.js` 1.36MB 命令注册表字符串级） | 文档明文 + 打包内命令名/退出码类 |
| 主包 | `resources\app.asar`（200.6MB） | `craft-anything-cli --deep js-app-map` 静态盘点（1394 文件列到 16，源码模块/IPC 配对解析为 0） |

**本轮没碰**：未动态启动任何进程；未拆 `AoqClientSdk.dll`（14.7MB C++ 引擎）内部；
未解码 obf.mjs 的 XOR 字符串池；未读取 `~/.qoder` 下任何凭据/会话文件内容（仅读
native host 注册清单与目录结构）。Ghidra 未用于本轮，原生结论不依赖反编译。

## 候选条目

| ID | 设计名 | 价值档 | 复现代价 | 超越轴 | 一句话 |
|---|---|---|---|---|---|
| B3-01 | 浏览器桥 native host 落地 + 扩展来源 fail-closed 绑定 | A | M | fail-closed 边界 | 判据层 IHUI 已有且部分超越，但 stdio host 进程与来源白名单落地完全缺失 |
| B3-02 | 进程组存活判定（PGID+启动时间）与失活整组回收 | A | M | 可测性 | 按组快照比对判连续存活，失活才整组回收；IHUI 已有更稳的 Job Object 内核兜底 |
| B3-03 | 协作 CLI 身份三档 + 退出码/幂等契约 | A | M | fail-closed 身份 + PG 落账 | host 固定 User/RuntimeOwner/RuntimeAgent，CLI 不可自选身份，退出码 3/4/130 与部分结果分页成文 |
| B3-04 | 系统提交内存（commit charge）OOM 预判面 | A | S | 可测性 + PG 监控 | 查询提交总量/限额/当前进程提交占用，派生重活前做余量预检 |
| B3-05 | Windows 通知权限状态原生查询 | B | S | 可测性 | 区分"能发通知"与"系统总开关是否允许"，IHUI 仅有发送插件 |
| B3-06 | 剪贴板一次性读取令牌 | B | S | fail-closed 边界 | 读剪贴板须持短寿一次性令牌，防跨上下文偷读 |
| B3-07 | 模型请求元数据分层 + Advisor 工具 + patches 增量编辑 | B | M | 可测性 + PG 追踪 | proto 四层元数据、限次顾问工具、按 cache_id 的消息/工具补丁复用 |
| B3-08 | worker 行协议 + PTY 子通道 + 并发登记/VM 资源限额 | B | M | 可测性 | stdin/stdout 行 JSON 四态子通道；执行登记表 + aborted 预检 + 堆限额 |
| B3-09 | RTC 音视频原生引擎桥 | C | L | 可测性 | N-API 桥接 C++ 引擎做采集/播放/帧观测/设备回调；IHUI 仅有服务端计费与 WebRTC 端口面 |
| B3-10 | 硬件专用键盘钩子 + 回放状态机（大疆麦克风按钮） | C | L | 零缺省行为变化 | 强硬件绑定的低级钩子与回放队列，对照记录，不建议照搬 |

## 逐条六要素

### B3-01 浏览器桥 native host 落地 + 扩展来源 fail-closed 绑定

- **证据**：
  - `C:\Qoder CN\resources\native-messaging-host\qoder-app-host.cjs`：
    注册表目录 `~/.qoder/browser-connector/clients`；`staleAfterMs = 30_000`；
    `futureTimestampToleranceMs = 5_000`；存活判定 `process.kill(pid, 0)`，`EPERM` 视为存活；
    记录字段 `{ id, port, pid, timestamp }`；优选排序 timestamp 倒序 + id 字典序；
    帧 = 4 字节 LE 长度头 + JSON body；入站 `watchRelayClients`（`protocolVersion === 2`）
    开启 1s 轮询广播 `relayClientsChanged`；空表回 `{ error: "not_running", clients: [] }`；
    畸形帧回 `{ error: "invalid_request", clients: [] }`；长度 0 或 >1MB 直接 `process.exit(1)`。
  - 注册清单 `C:\Users\Administrator\.qoder\browser-connector\com.qoder.app.connector.json`：
    `"type": "stdio"`；`allowed_origins` 绑两个扩展 id
    `chrome-extension://gblapfbnbicdckfhkllcnfleiemhmgeb/`、
    `chrome-extension://oknkojfamnpljdfpinkhbibicojelkoj/`；`path` 指向
    `hosts\<sha256>\Qoder Browser Connector.exe`（`hosts\` 下实测 10 个哈希版本目录并存）。
  - 扩展清单 `C:\Qoder CN\resources\browser-connector\chrome-extension\manifest.json`：
    权限含 `nativeMessaging`；`externally_connectable` 仅 5 个 qoder 域名；`host_permissions` 为
    `<all_urls>`；`chrome-extension.json` 固定 `extensionId` + `sha256` + `publicKeyMode: fixed_dev`。
  - 可复核命令：`Get-Content <cjs>`；`Get-ChildItem HKCU:\Software\Google\Chrome\NativeMessagingHosts`；
    `Get-Content <清单 json>`。
- **三档**：观察 = 上述字段、判据、清单与扩展 id 均为静态直读；推断 = `hosts\<sha256>\*.exe`
  为该 cjs 同逻辑的打包发行版（10 个哈希目录对应历史版本并存）；未知 = exe 内部是否还有
  第二道来源校验（静态未拆，本轮不运行）。
- **IHUI 现状**：
  - 判据纯函数已有且部分超越：`C:\IHUI-AI\apps\extension\lib\native-messaging-protocol.ts`
    （固定小端字节序、具名拒绝原因族 `malformed/stale/future-skew/dead-pid/lease-mismatch`、
    按 id 去重 + lease 匹配、全量 + diff 差分发布；`DEFAULT_PEER_STALE_AFTER_MS = 30_000`、
    `DEFAULT_FUTURE_TOLERANCE_MS = 5_000`，与对照同档）。
  - 扩展内消息信任：`C:\IHUI-AI\apps\extension\lib\message-trust.ts`（id / 扩展页面 URL / 无 tab
    三层判据）。
  - 落地缺口：grep `connectNative|sendNativeMessage|clientsDirectory|watchRelayClients` 于
    `apps\extension` 仅命中判据层文件；`apps\desktop\src-tauri\src` 无 native messaging host。
    结论 = **部分覆盖**：协议/注册表判据已有等价且超越，stdio host 进程、注册表写方、
    实际 `connectNative` 通道完全没有。
- **落点建议**：新增 `apps\desktop\src-tauri\src\native_connector_host.rs`（或独立 stdio 宿主脚本）；
  新增扩展侧 `apps\extension\lib\connector-client.ts`；注册清单生成件随安装落地。
- **超越轴**：fail-closed 边界。对照的来源校验只发生在 Chrome 按 `allowed_origins` 拉起 host
  这一侧；host 进程本身不校验来源，一旦被本地其他程序以 stdio 直接拉起，无第二道闸。IHUI 落地时
  应在 host 侧自校验启动上下文，注册清单与 host 双端钉死扩展 id 白名单；取不到可信身份即拒绝且
  不写注册表。测试：夹具模拟未登记 origin / 伪造扩展 id，断言 host 拒绝、不产出优选记录。
- **最小复现范围**：stdio 4B LE 帧收发；clients 目录注册表的读/校验/优选/差分广播；
  host 启动即校验允许来源白名单，失败 fail-closed 退出。

### B3-02 进程组存活判定（PGID+启动时间）与失活整组回收

- **证据**：
  - `...\qoder-cn-agent-sdk\dist\_worker\qoder-worker-runtime.obf.mjs`（字符串级）：
    派生组查询 `/bin/ps -axo pid=,pgid=,lstart=`；注释明文"同组后台进程可以比 Shell 活得久。
    用成员 PID + 启动时间识别组的连续存活"；比对成员 `pid / pgid / lstart`，组失活后
    `process.kill(-pid, 'SIGKILL')` 回收整组。
  - 可复核命令：`Select-String -Path <obf.mjs> -Pattern 'pgid|lstart|kill\(-|SIGKILL|/bin/ps'`。
- **三档**：观察 = ps 参数、字段名、负 pgid 杀组调用为直读；推断 = 用于 worker 派生 shell
  任务的组级清理，避免后台孤儿；未知 = 组表持久化形态与 win32 分支（产物目标 win32-x64，
  但该段走 `/bin/ps`，属 Git Bash / POSIX 面）。
- **IHUI 现状**：
  - `C:\IHUI-AI\apps\desktop\src-tauri\src\orphan_guard.rs`：主进程挂进
    `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 作业对象，退出时内核 `TerminateJobObject` 兜底清整棵
    后代树，不依赖枚举完备性。
  - `C:\IHUI-AI\apps\desktop\src-tauri\src\terminal_session.rs`：`killpg(pgrp, SIGTERM)` 组级信号。
  - `C:\IHUI-AI\apps\api\src\services\terminal-service.ts`：node-pty 本地 + SSH 双后端。
  - 结论 = **已有等价且更稳**（内核兜底 vs 枚举判活）；但"按 PGID + 启动时间判组连续存活、
    确认失活才整组回收"这一显式判据在 CLI / ai-service 子进程面未见独立实现。
- **落点建议**：`apps\cli\src\subagents\` 下新增进程组判活辅助；或 `apps\ai-service` 子进程
  回收支路复用同一判据。
- **超越轴**：可测性。注入 ps 输出夹具（成员存活 / 启动时间漂移 / 组解散三态）钉死判据；
  判活输入缺失时默认保守保留而非误杀（零缺省行为变化）。
- **最小复现范围**：给定 pgid 与成员 `(pid, lstart)` 快照，比对当前 ps 输出判定组是否连续
  存活；仅在确认失活后整组回收，回收动作留痕。

### B3-03 协作 CLI 身份三档 + 退出码/幂等契约

- **证据**：
  - `resources\collaboration-cli\collaboration-cli\skills\desktop\SKILL.md` 与
    `references\identities.md`：身份三档 **User / RuntimeOwner / RuntimeAgent**，由 host 从可信
    会话上下文选定；CLI 不得自选身份，不加 `--identity` / `--runtime-context-fd` / `--profile`，
    不要 token、不构造凭据管道；401/403/404 不授权切换身份、扩成员或调私有 API。
  - `references\operations.md`：退出码 **4 = 部分结果**（`complete:false` + `nextOffset`）、
    **3 = 拒绝/缺 host 上下文**、**130 = 取消/超时**；响应形 `{ success, data }` /
    `{ success:false, error }`；`outcome_unknown` / 断连 / 超大结果后写可能已成功，须先查询
    再重试，不重放 create；`requestId` 用于同一操作的幂等重试。
  - `dist\host\index.js`：命令注册表 78 条（命令名 → `operation` / `resource` 映射，族含
    `project / issue / issue-comment / discussion / discussion-member / discussion-team /
    discussion-invitation / message / file / project-member / project-team / project-agent /
    project-invitation / agent / runtime-agent / runtime-owner / team / team-task / user`）；
    `ExitError` 类携带 `exitCode` 字段。
  - 可复核命令：`Select-String -Path index.js -Pattern '"([a-z-]+( [a-z-]+)+)":\s*\{'` 提取命令键；
    读 `operations.md` / `identities.md` 明文。
- **三档**：观察 = 命令名、退出码、字段、文档明文；推断 = host 进程持有凭据并按身份过滤
  可用命令集；未知 = host 与 CLI 之间凭据传递的通道形态（fd / env / 临时管道，静态未见）。
- **IHUI 现状**：
  - `C:\IHUI-AI\apps\cli\src\subagents\worker-pool.ts`：workers Map 登记、并发档唯一出口
    `resolveMaxConcurrency`、kill 有界预算与 residual kill 留痕、exit 归因。
  - `apps\ai-service` 信任门 `test_agent_runtime_trust_gate.py`：已信任 + 工具级 allow/deny。
  - `apps\web\src\components\ai\swarm-topology-view.tsx`：swarm / delegate 拓扑概念。
  - grep `RuntimeOwner|RuntimeAgent|nextOffset|collection.complete|leaderSessionId|team-task`：
    无对照式三档身份枚举与跨命令退出码契约。结论 = **完全没有**（身份委派概念存在，
    契约层不存在）。
- **落点建议**：`apps\cli\src\commands\collab\` 新增身份档枚举、命令→所需身份映射、退出码与
  分页类型；ai-service 侧注入不可由客户端改写的身份上下文。
- **超越轴**：fail-closed 身份边界 + PostgreSQL 统一落账。身份判定失败默认 deny；拒绝 /
  部分结果 / 委派动作入 PostgreSQL 台账（不使用 sqlite 本地状态库）。测试：夹具以错误身份调用
  越权命令，断言 exit 3、无副作用、台账留痕。
- **最小复现范围**：三档身份枚举 + 命令身份映射；退出码 3/4/130 与 `{success,data}` 响应形；
  分页 `complete / nextOffset`；写操作 `outcome_unknown` 禁止盲目重放。

### B3-04 系统提交内存（commit charge）OOM 预判面

- **证据**：
  - `C:\Qoder CN\resources\bin\system_commit.node`（685.6KB，N-API）：方法 `getSystemCommit`；
    字段 `commitTotalBytes / commitLimitBytes / mainProcessCommitLimitBytes /
    mainProcessCommitAvailableBytes`。
  - 可复核命令：rizin `-qc "iE"` 看导出；ASCII 字符串扫描上述字段名。
- **三档**：观察 = 方法名与四个字段名直读；推断 = 桌面端在派生重活 / worker 前查提交余量做
  OOM 预判与降级；未知 = 阈值策略、触发动作与调用方位置（主包加密池内，静态不可见）。
- **IHUI 现状**：grep `commitLimit|CommitLimit|GetProcessCommitCharge|mainProcessCommit|
  commitTotalBytes` 于 `apps\desktop` **0 命中**；现有 OOM 防护仅有单文件大小上限
  （`lib.rs` 50MB 注释与图片尺寸校验）。结论 = **完全没有**。
- **落点建议**：新增 `apps\desktop\src-tauri\src\system_memory.rs`（Win API 查询系统提交总量 /
  限额 / 当前进程提交占用），接入 worker / 重活派生前预检位。
- **超越轴**：可测性 + PG 监控落账。周期性采样提交余量入 PostgreSQL 监控表；低余量时拒绝派生
  并出声告警，而非静默失败。测试：注入采样夹具断言低余量分支拒绝派生且读数可观测。
- **最小复现范围**：读取系统提交限额与当前进程提交占用，返回四元组；低于阈值给出预警或
  拒绝派生。

### B3-05 Windows 通知权限状态原生查询

- **证据**：
  - `C:\Qoder CN\resources\bin\notification_permission.node`（1.54MB，N-API）：方法
    `getNotificationPermissionStatus`；PDB 路径暴露源码目录 `apps/desktop/native/notificationPermission`；
    导入 `AppPolicyGetWindowingModel` 等 Win API。
  - 可复核命令：rizin `-qc "iE"`；字符串扫描 `getNotificationPermissionStatus`。
- **三档**：观察 = 方法名 / PDB / 导入符号直读；推断 = 查询系统通知总开关或应用通知权限状态，
  供 UI 引导；未知 = 状态枚举取值集（静态未拆）。
- **IHUI 现状**：`apps\desktop\src-tauri\Cargo.toml` 仅依赖 `tauri-plugin-notification = "2.3"`
  （发送通知）；grep 通知权限状态查询接口 **0 命中**。web / 扩展侧的 `Notification.permission` /
  `requestPermission` 是浏览器页面权限，非 Windows 系统总开关。结论 = **部分覆盖**
  （能发，不能查系统权限状态）。
- **落点建议**：新增 `apps\desktop\src-tauri\src\notification_permission.rs`。
- **超越轴**：可测性。权限状态枚举与降级文案走纯函数判定，夹具三态（允许 / 拒绝 / 未决）钉测；
  不改变现有发送链路的缺省行为。
- **最小复现范围**：查询当前应用 Windows 通知权限状态并返回枚举；无权限时 UI 给出引导，
  不静默失败。

### B3-06 剪贴板一次性读取令牌

- **证据**：
  - `C:\Qoder CN\resources\bin\native_clipboard.node`（721.4KB，N-API）：方法
    `readClipboard / writeClipboard / getClipboardToken`；字段 `filePaths`；Win API
    `GetActiveWindow / GetTempPath2W` 等。
  - 可复核命令：ASCII 字符串扫描上述方法名与字段。
- **三档**：观察 = 方法名 / 字段名直读；推断 = `getClipboardToken` 签发一次性令牌，读剪贴板
  须持令牌，防页面或其他上下文跨边界偷读；未知 = 令牌生命周期与绑定粒度（窗口 / 会话 / 进程）。
- **IHUI 现状**：`apps\desktop\src-tauri\src\lib.rs` `clipboard_get / clipboard_set` 用 arboard，
  带图片 base64 长度与尺寸校验；无读取令牌面。结论 = **部分覆盖**（读写有，一次性令牌无）。
- **落点建议**：desktop 剪贴板命令层加一次性签发 / 消费令牌；扩展侧读剪贴板走令牌换票。
- **超越轴**：fail-closed 边界。令牌一次性、绑定发起窗口 / 上下文，过期不可复用；测试：
  同一令牌二次消费断言拒绝。
- **最小复现范围**：读剪贴板前签发短寿命令牌，消费即失效；无令牌读取拒绝。

### B3-07 模型请求元数据分层 + Advisor 工具 + patches 增量编辑

- **证据**：`...\qoder-cn-agent-sdk\dist\_worker\proto\chat.proto`（proto3 明文，全文读取）：
  - `ChatMetadata` 四层：`WorkspaceMetadata`（`file_count / languages / codebase_status /
    codebase_soft_status / codebase_external_id / data_policy`）、`BusinessMetadata`
    （`id / name / begin_at / product / version / type / stage / sub_task`）、
    `ContextMetadata`（`request_id / session_id / task_id / request_set_id / machine_id /
    client_type / source_session_id`）、`UserMetadata`（`user_id`）。
  - `Tool` 内含 `Advisor`（`name / model / max_uses`）；`patches: map<string, ChatPatchList>`，
    `ChatPatch`（`cache_id / action / position / content / name / rename_to / description /
    parameters`）。
  - `Usage` 细分 `cached_tokens / cacheable_tokens / reasoning_tokens`；`ReasoningEffort`
    枚举 0–6 档。服务仅 `ChatCompletion`（unary）与 `ChatCompletionStream`（server-streaming）；
    **proto 面无 Cancel / 中断 / 能力协商 RPC**。
  - 可复核命令：直接读 `chat.proto`；grep 上述字段名。
- **三档**：观察 = 字段 / 枚举 / RPC 名为 proto 明文；推断 = patches 用于会话内消息与工具定义
  增量复用，Advisor 是限次调用的顾问型工具；未知 = patch 合并冲突策略与 Advisor 调用结算规则
  （运行时行为，静态不可见）。
- **IHUI 现状**：`apps\api\src\routes\v1-public.ts` 已透传 `reasoning_effort`（字符串或数字档）；
  grep `request_set_id / source_session_id / Advisor / max_uses / ChatPatch / cache_id` 于
  `apps\api\src` 无真实命中（噪音为优惠券 `maxUses`、保险 advisories、SQLi 注释）。
  结论 = **部分覆盖**（推理强度有，分层元数据 / Advisor / patches 无）。
- **落点建议**：`apps\ai-service\app\` 请求元数据模型落四层结构；api 路由透传；工具定义补丁结构
  与 Advisor 限次计数。
- **超越轴**：可测性 + PG 追踪。分层元数据落 PostgreSQL 请求追踪表（`request_set_id` 串批、
  `source_session_id` 溯源）；测试：夹具断言缺层 / 越层字段被 Zod 拒绝。
- **最小复现范围**：请求带四层元数据；Advisor 工具带 `max_uses` 计数；patches 按 `cache_id`
  对既有消息 / 工具做增量编辑；流式 / 非流式两种响应形。

### B3-08 worker 行协议 + PTY 子通道 + 并发登记 / VM 资源限额

- **证据**：`qoder-worker-runtime.obf.mjs`（混淆产物，字符串级）：
  - 主通道：`send()` 向 stdout 写 `JSON.stringify(message) + '\n'`；stdin 经 `readline` 按行解析。
  - PTY 子通道：`message.action === 'spawn'` → `pty.spawn(program, args, options)`；回执
    `{ type: 'ready', pid }`；`onExit` → `{ type: 'exit', exitCode, signal }` 后
    `process.exit(0)`；未 spawn 回 `{ type: 'error', message }`。
  - 并发与沙箱：`activeExecutions = new Map`；`execute` 前查 `signal?.aborted`；超并发上限抛错；
    VM 构造带 `resourceLimits: { maxOldGenerationSizeMb, maxYoungGeneration... }`；
    `AbortController` 发起请求取消，`requestController.abort()`。
  - 可复核命令：`Select-String -Path <obf.mjs> -Pattern 'ready|exit|error|activeExecutions|
    resourceLimits|AbortController|pty.spawn'`。
- **三档**：观察 = 函数名 / 消息 type / 字段 / 常量名直读；推断 = 宿主经 stdin 下发任务、
  stdout 回事件流，PTY 为内嵌终端子通道；未知 = 宿主→worker 取消消息类型、协议版本握手、
  并发上限常量具体值（混淆池内，静态不可见）。
- **IHUI 现状**：`apps\api\src\services\terminal-service.ts`（node-pty 本地 + SSH 双后端、
  Redis scrollback）；`apps\desktop\src-tauri\src\terminal_session.rs`；`apps\cli\src\subagents\
  worker-pool.ts`（workers Map、并发档出口、kill 预算、`WorkerResourceLimits`）；workflow
  运行时 `registerRunAbortSignal` + `dispose` 防 controller 泄漏。结论 = **部分覆盖**
  （并发登记 / 取消 / PTY 已有，worker 行协议帧格式与 ready/exit/error 子通道契约未见独立抽象）。
- **落点建议**：`apps\cli\src\subagents\worker-protocol.ts`（行协议编解码 + 消息类型联合）；
  VM 沙箱限额配置单一出口。
- **超越轴**：可测性。帧编解码为纯函数，夹具覆盖分片 / 畸形行 / exit 事件；资源限额走单一出口
  解析，禁止散落字面量。
- **最小复现范围**：stdin 行 JSON 收发；spawn / ready / exit / error 四态子通道；执行登记表 +
  aborted 预检 + 并发上限；VM 堆限额。

### B3-09 RTC 音视频原生引擎桥

- **证据**：
  - `...\aoq-electron-sdk\prebuilds\win32-x64\aoq_node_ext.node`（253.9KB），伴随
    `AoqClientSdk.dll`（14.69MB）、`alivcffmpeg.dll`、`PluginOpus.dll`。
  - rizin `iE`：仅导出 `napi_register_module_v1`、`node_api_module_get_api_version_v1`。
  - rizin `ii`：导入 `AoqClientSdk` 类族 —— `AoqCreateConfig / AoqTrackParam /
    AoqConnectConfig / AoqDataMsg / AoqEngineEventListener / IAudioFrameObserver /
    IVideoFrameObserver / AoqClientEngine.createEngine / destroy / getVersion`。
  - 字符串方法面：`StartAudioCapture / StopAudioCapture / MuteAudioCapture`、
    `StartAudioPlayer ... InterruptAudioPlayer`、`StartVideoCapture / StopVideoCapture /
    PushExternalVideoCapturedFrame / PushExternalVideoEncodedFrame`、
    `SetAudioFrameObserver / EnableAudioFrameObserver`、`SetVideoFrameObserver /
    EnableVideoFrameObserver`、`OnEvent / UnEvent`；桥对象名 `AoqElectronBridge`；
    事件前缀 `AoqEvent_`；统计回调 `audioPublishStats / audioSubscribeStats /
    videoPublishStats / videoSubscribeStats`；帧回调 `onCapturedAudioFrame /
    onRemoteVideoFrame` 等；字段 `token / audioSource / videoSource`。
  - 可复核命令：`rizin -qc "iE"` / `-qc "ii" <node>`；ASCII 字符串扫描上述名。
- **三档**：观察 = 导入符号 / 方法名 / 事件前缀 / 伴随 DLL 直读；推断 = N-API 桥接 C++ RTC
  引擎做采集 / 播放 / 帧观测 / 设备状态回调；未知 = 引擎厂商私有协议、鉴权 token 交换流程、
  默认编码参数（静态未拆，不运行）。
- **IHUI 现状**：`packages\database\src\schema\agent-billings.ts` 有 `rtc_begin_time /
  rtc_end_time / rtc_duration` 计费字段；`packages\api-client\src\endpoints\srs.ts` 有
  `webrtcPort`（SRS / WebRTC 服务端口）；`apps\desktop\src-tauri\src` 无任何音频 / 视频帧
  原生桥业务命中。结论 = **完全没有**原生媒体引擎桥（仅有服务端 RTC 计费与 WebRTC 端口面）。
- **落点建议**：本轮不落地；若后续桌面通话成为需求，新增 `apps\desktop\src-tauri\src\
  rtc_bridge.rs` + 前端帧观测接口，引擎适配器可替换。
- **超越轴**：可测性。桥接层抽接口，采集 / 播放 / 观察者可注入夹具；媒体流与凭据边界
  fail-closed，token 不落仓。
- **最小复现范围**：引擎创建 / 销毁生命周期；采集 / 播放启停；帧观察者注册与回调；事件订阅 /
  退订。

### B3-10 硬件专用键盘钩子 + 回放状态机（大疆麦克风按钮）

- **证据**：
  - `C:\Qoder CN\resources\bin\dji_mic_button.node`（785.4KB，N-API）：字符串 `keyboard_hook`、
    `buttonDown`、`matchedDjiReport`、`hotkey`、`eventMs`、`lastDjiReportMs`；回放状态机事件
    `dji_native_app_command_volume_up_enqueued / ..._hotkey_enqueued /
    ..._raw_volume_up_down_enqueued / ..._replay_decision / ..._replay_worker_started /
    ..._replay_worker_stopped / ..._raw_volume_up_up_suppressed / ..._hotkey_started`。
  - 可复核命令：ASCII 字符串扫描上述事件串。
- **三档**：观察 = 钩子名 / 状态机事件串直读；推断 = 全局键盘钩子识别大疆麦克风物理按键，
  去抖后回放为音量热键，带回放队列与抑制判定；未知 = 硬件识别协议与按键映射表。
- **IHUI 现状**：`apps\desktop\src-tauri\src\lib.rs` 用 `tauri-plugin-global-shortcut` 注册
  固定全局快捷键，另有 `keyboard_type / keyboard_press / keyboard_hotkey` 注入命令；无低级
  `keyboard_hook` 钩子与专用硬件回放状态机。结论 = **完全没有**（且不建议照搬）。
- **落点建议**：不新增；若需硬件按键支持，走全局快捷键配置化，不写专用低级钩子。
- **超越轴**：零缺省行为变化。该设计强硬件绑定、复现性价比低；本轮作为对照面记录，不进
  复现清单主线。
- **最小复现范围**：（不建议）钩子捕获按键事件 → 识别 → 队列回放 → 抑制重复。

## 未做 / 未判定

1. **主包静态解析为空**：`app.asar`（200.6MB）经打包 / 字符串加密，`js-app-map` 实测 1394 个
   文件仅列到 16，源码模块 0、IPC 通道配对 0、窗口 0。宿主侧 worker 持锁、生命周期管理、
   判活入口，以及协作 CLI host 凭据通道、通知阈值策略、剪贴板令牌生命周期、Aoq 引擎协议，
   均在加密 / 压缩池内，本轮静态未判定。
2. **obf.mjs 只做到字符串级**：`qoder-worker-runtime.obf.mjs` 为 XOR base64 混淆产物
   （解码密钥住首行函数内），本轮未解码字符串池；取消消息类型、协议版本握手、并发上限常量值
   不可见，不写成"已逆出源码"。
3. **原生面未反编译**：四个 bin `.node` 与 `aoq_node_ext.node` 仅做到 rizin 导入 / 导出表 +
   ASCII 字符串级；`AoqClientSdk.dll` 未拆。Ghidra 未参与本轮，结论不含反编译伪代码。
4. **hosts 多版本 exe 未逐一拆解**：`~/.qoder/browser-connector/hosts\` 10 个哈希目录的
   `Qoder Browser Connector.exe`（131–150KB）未逐个比对；第二份清单
   `com.qoder.work.connector.json` 注册表指向路径本次读取为空，是否落地未判定。
5. **协作 CLI 运行时行为未动态验证**：`dist\host\*.js` 为打包产物，命令注册表与 `ExitError`
   类为字符串级取证；分页游标续接、并发锁 / 状态文件形态、附件回合级清理的实际行为需动态实验，
   本轮受只读约束未做。
6. **未触碰凭据面**：未读取 `~/.qoder`、`%APPDATA%\QoderWork CN` 下任何会话 / 令牌文件内容；
   注册清单中仅记录扩展 id 与路径，未回放任何登录态。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
