<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 执行网关与可丢弃工作副本 · 架构计划

> 状态：Phase 2 的 Task RPC、CLI 客户端、无头单发 `--task-workspace`、Git/非 Git 副本、会话级文件工具经宿主网关写副本、任务命令默认走宿主 AppContainer 已通过（`tool-host-client` 8/8 + `task-workspace-session` 2/2，假模型跑完整 `runAgent` 回合）；真实模型、REPL/ACP、容器与 MCP 迁移待做。
> 目标不是把所有工具再写一遍，而是让以后新增工具**不需要再讨论“能不能出网 / 能不能写工作区”**。

## 0. 一句话架构

Agent 只产生“意图”和“能力调用”；运行时把所有副作用收进**唯一执行网关**：

```text
Agent / CLI / Desktop
        │  capability request（read/write/exec/net/mcp）
        ▼
Execution Gateway（tool-host）
        │  默认 deny + 能力令牌 + 配额 + 审计
        ├─ AppContainer：轻量、只读或无工作区写的命令，无 internetClient
        ├─ Workspace Stage：Git clone/share 或 overlay，副本内可写，来源工作区不动
        └─ Container/VM（Phase 3）：任意命令、完整工具链，network=none，workspace 挂载
```

三条不可绕过的规则：

1. **网关之外无副作用**：禁止业务代码直接 `Command::new`、`std::fs::write`、HTTP socket、MCP spawn。
2. **默认拒绝**：没有显式能力令牌，网络、工作区写、外部凭据全部拒绝；失败 fail-closed，不静默回退。
3. **任务工作副本可丢弃**：Agent 在副本里写，产出以 patch/artifact 形式发布；不降低用户工作区完整性、不加宽 ACL/MIC。

## 1. 为什么不能再用“补丁式沙箱”

当前 AppContainer 已能阻断默认宿主命令的出网，但有三类结构性例外：

- CLI 普通命令走 Node `runSandboxed`，不是宿主路径；
- 全量前台 / Git 需要写工作区，AppContainer 低完整性被 MIC 拦；
- MCP server 可能本来就需要网络或任意路径。

继续在每条路径上打补丁，会重新长出“命令黑名单、环境变量代理、ACL 放宽”这些假边界。正确做法是把**写**从“给进程更多权限”改成“给任务一个可丢弃副本”。

## 2. 核心数据契约

### 2.1 能力请求

```json
{
  "kind": "exec | read | write | net | mcp",
  "scope": {
    "workspace": "task|source",
    "paths": ["relative/path"],
    "network": "none|proxy:allowlist",
    "ttlSec": 300
  },
  "idempotencyKey": "turnId|toolCallId",
  "taskId": "task-..."
}
```

### 2.2 执行回执

```json
{
  "state": "ok|denied|failed",
  "kind": "appcontainer|workspace-stage|container",
  "taskId": "...",
  "exitCode": 0,
  "artifact": {"patch": "...", "changedFiles": []},
  "audit": {"requestId": "...", "decision": "allow", "policy": "..."}
}
```

### 2.3 工作副本

- **Git 工作区**：`git clone --shared` 到 AppContainer 的 `AC` 下，副本有独立 `.git`，可跑 Git；
- **非 Git 工作区**：Phase 2 树拷贝 + 副本内基线 Git 提交；Phase 3 用容器 bind mount；
- **发布**：只接受 `git diff --cached --binary` 或 artifact patch；由调用方显式 `publish`，不自动写源工作区；Git 源要求 clean，非 Git 源逐文件比对基线后再 apply。

## 3. 分阶段任务

### Phase 0 — 冻结边界（已完成）
- 现有 `AppContainer` 默认档保留；
- `inherit`、MCP relay、CLI 普通命令登记为“待迁移”，不再新增同类例外；
- 新增代码不得直接 `Command::new` / `fs::write` / socket；CI 用 grep 规则先做告警。

### Phase 1 — Task Workspace MVP（已完成）
- 新增 `apps/desktop/src-tauri/src/task_workspace.rs`：
  - `prepare_git(source, task_id)`：校验源仓库干净 → 在 AppContainer `AC` 根下创建共享对象 clone；
  - `stage_root()`：返回副本根；
  - `diff_patch()`：收集 tracked + untracked，输出 binary patch 与 changedFiles；
  - `publish()`：显式把 patch apply 回源工作区（仅 clean 源）；
  - `abandon()`：删除副本。
- 验收：Git 仓库 → 副本内 AppContainer 写文件成功且断网 → 源工作区未被改动 → patch 生成 → publish 后源文件变化。
- 不在本轮接 CLI/UI；先把“副本 + 断网 + patch”这条硬链路做实。
- **实测（2026-11-27）**：
  - `cargo test --lib task_workspace`：3/3 通过（Git 副本写/publish、非 Git 树拷贝/冲突拒绝、脏源/非法 task_id）；
  - 用例在 AppContainer 内写副本 `a.txt` 成功，同一副本 `ping 8.8.8.8` 非零退出且无 `TTL=`；
  - 源工作区在 publish 前保持 `before`，publish 后变为 `after`；
  - 脏源、`../` task_id 均被拒绝；
  - `sandbox_spawn::tests::appcontainer_token_is_real_and_network_is_blocked` 回归通过。


### Phase 2 — 网关 RPC
- `tool_host` 增加 `service/TaskPrepare` / `service/TaskDiff` / `service/TaskPublish` / `service/TaskAbandon`；
- 源工作区只接受宿主 `IHUI_TOOL_HOST_WORKSPACE_ROOTS` 中已 canonical 的根，空集合全部拒绝；
- `TaskWorkspace::prepare` 自动分流：Git 顶层走共享对象 clone；非 Git 目录走树拷贝 + 副本内基线提交，发布前逐文件比对源与基线，拒绝覆盖任务期间被用户改过的文件；
- CLI `tool-host` 增加 `taskPrepare / taskDiff / taskPublish / taskAbandon` 客户端，`runOnToolHost` 支持 `workspaceRoots`；连接键包含 roots，切换工作区就重建宿主连接；
- 非任务 CLI 的 `run_command` 仍只把 `sleep` 类路由宿主；任务模式下**所有前台命令**都走宿主 `service/Execute`，cwd 固定为任务副本、integrity 固定 AppContainer，默认断网；background/自动收编命令因宿主协议不提供 ChildProcess 句柄而显式拒绝，不回落 CLI 直跑。
- 任务命令复用的是 TaskPrepare 的那个宿主连接：带 `taskWorkspaceId` 的 `runOnToolHost` 不再按 `blockedEnvVars`/roots 重建连接；否则新宿主进程的 `tasks` map 是空的，任务副本句柄会直接丢。
- 任务模式派生子 Agent 时，`taskWorkspaceId` 与授权 roots 随 `setupAgentTools` 继承；`isolation=worktree` 会换掉写目标、离开当前任务副本，因此显式拒绝而不是让它绕过网关。子 Agent 的任务副本回归用例还没有补。
- 文件工具在任务模式下不再由 CLI 进程直接 `fs.write`：`write_file` / `edit_file` / `delete_file` 分别走宿主 `service/FileWrite` / `service/FileDelete`；宿主只允许动当前任务副本，拒绝绝对路径、`..`、符号链接逃逸、Windows 保留设备名、ADS 冒号与尾随空格/点。删除前仍在副本上跑同一套 `evaluateBulkDelete` 护栏，非 clean 不落副作用。批量编辑仍走原路径，待迁移。
- CLI 无头单发增加显式 `--task-workspace`（或 `IHUI_TASK_WORKSPACE=1`）：先 `TaskPrepare`，再把 `runAgent` 的 `workspacePath`、检查点、文件工具全部指向副本；`workspaceRoots` 仍保留真实源根，避免 `run_command` 因 cwd 变化重建宿主、丢失任务；只有 `end_turn` 才 `TaskPublish`，`error/cancelled` 等丢弃副本；
- 安全细节：`service/TaskPrepare` 只接受与 `IHUI_TOOL_HOST_WORKSPACE_ROOTS` 中某个 canonical 根**完全相等**的源；空集合 fail-closed；同源同 `taskId` 的重放返回同一副本，换成另一个源就拒绝；CLI 连接复用的 key 包含 roots，避免 A 工作区的授权泄漏到 B 工作区；`TaskAbandon` 幂等，宿主的 `tasks` map Drop 时也会清理副本。
- 非 Git 副本的 `git add -A -f` 把 `.gitignore` 忽略的文件也纳入基线，避免 Agent 改了 ignored 文件却在 patch 里消失；publish 先 `git apply --check` 再真正 apply，防止多文件补丁只落一半。
- 安全扫描的相对路径改为按 `ToolContext.workspacePath` 解析，不再拿 CLI 进程 cwd 顶替；`--task-workspace` 下扫描和文件工具看同一个副本根。
- 实测：`pnpm --dir apps/cli exec vitest run tests/tool-host-client.test.ts` **8/8**（TaskPrepare Git/非 Git 副本、diff、publish 与源改动拒绝覆盖）；`tests/task-workspace-session.test.ts` **2/2**（假模型 + 真实 `runAgent`：`write_file` 经宿主 `FileWrite` 写副本；`run_command` 默认走宿主 AppContainer 写副本；两条都 publish 后才落源）。
- 仍未完成：REPL/TUI/ACP 与子 Agent 接入、容器后端、MCP manifest、桌面端 roots 注入；无头 `--task-workspace` 还没用真实模型跑过完整回合。

### Phase 3 — 强隔离后端
- `SandboxBackend` 抽象：`AppContainer`（轻量）、`Container`（任意工具链，network=none，bind mount task workspace）；
- 非 Git 工作区用 overlay/容器挂载；MCP 必须在同一后端；
- 网络只通过 host 侧代理，能力令牌 + allowlist + 审计；不允许容器直连。

### Phase 4 — 迁移与删除
- CLI 普通命令改走网关；
- Git 通道改走 stage；
- MCP 全部走网关；
- 删除 `inherit` 直通和 Node `runSandboxed` 的绕过路径；找不到 stage 即 fail-closed。

### Phase 5 — 架构不变量测试
- 断网：每个后端 `ping` 非零、无 TTL；
- 写：stage 内写成功、源工作区不动；
- 绕过：代码扫描无网关外 `spawn`/`fs::write`/socket；
- 发布：patch apply、冲突/脏源拒绝；
- 幂等：同 `turnId|toolCallId` 不产生第二次副作用；
- 审计：每条请求有 decision/effect/artifact；
- 安装态：NSIS 单宿主、CLI/MCP 回读、卸载无残留。

## 4. 明确不做

- 不把用户工作区降为低完整性；
- 不给 Package SID 大面积 ACL；
- 不做“复制整个工作区再覆盖回去”的伪 broker；
- 不用命令黑名单/环境变量代理冒充 OS 断网；
- 不让模型自己声明“我不会联网”。

## 5. 验收口径

“彻底”不是没有后续代码，而是**新增工具不需要再改安全边界**：

- 新工具只需声明 capability（read/write/exec/net/mcp）；
- 运行时默认拒绝，显式授权才放行；
- 所有效果可审计、可重放、可回滚；
- 没有第二条执行路径。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
