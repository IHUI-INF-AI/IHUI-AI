<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# B2-12：tool-host 进程切分 + 命名管道 JSON-RPC（2026-11-27）

## 结论

W4-06 已从「契约 + 少量消费方」推进到**可运行契约 + 多客户端池 + 跨宿主幂等 + CLI 双键贯通 + MCP stdio 归宿主 + 宿主侧输入/编码收口 + AppContainer 网络阻断 + 单份 sidecar 安装包**。执行宿主仍是独立进程，会话侧只持客户端句柄；同一 `turnId|toolCallId` 重试不会产生第二次副作用；宿主内的 MCP 子进程由宿主拥有，CLI 保留原 framing 与 id 分派；安装包从「两条根宿主记录」收敛为「一条 `File` + 安装后一份宿主」。

本机真读数（宿主包内二进制 + CLI 行为代码，2026-11-27 21:17 本地时区）：

| 项目 | 落点 | 最终读数 |
| --- | --- | --- |
| tool-host 进程集成 | `apps/desktop/src-tauri/tests/tool_host.rs` | **7/7**（池并发、跨宿主同双键去重、坏客户端重建、重启缓存清空、MCP relay、安装资源布局查找、安装根目录布局查找、AppContainer/继承档、宿主 RPC 断网、超时） |
| tool-host 协议/策略单元 | `apps/desktop/src-tauri/src/tool_host.rs` 内 `#[cfg(test)]` + `--lib tool_host` | **8/8**（错 token/首包顺序、缓存淘汰、restart 清缓存时保留在飞闸门、Task RPC 授权/准备/丢弃、同源同 taskId 重放、换源拒绝、`service/FileWrite`/`FileDelete` 只动副本、`normalize_program`、UTF 解码等） |
| Task Workspace 单元 | `apps/desktop/src-tauri/src/task_workspace.rs` 的 `#[cfg(test)]` | **6/6**（Git clone 副本写/publish；非 Git 树拷贝、`.gitignore` 文件也进基线、源改动拒绝覆盖；网关 `write_file`/`delete_file` 留在副本内且拒绝 `..`/绝对路径/符号链接/Windows 保留名/ADS；删除经 publish 变成源文件删除；脏源/非法 task_id 拒绝），publish 先 `git apply --check` 再落盘 |
| 沙箱进程单元 | `apps/desktop/src-tauri/src/sandbox_spawn.rs` 的 `#[cfg(test)]` | **7/7**（AppContainer 令牌可查询为真、AppContainer 出网失败、低完整性写中完整性路径被拒、Job 终止整树、stdout/stderr 管道）；体检用 `cargo test --lib sandbox` 统计为 **45/45**（含既有沙箱 token/ACL/指标过滤集） |
| CLI 消费方 | `apps/cli/src/sandbox/tool-host.ts` + `run_command` + 会话级 `--task-workspace` | **10/10**（双键上下文、同键重试、强制前台走宿主、写工作区/中文输出、默认 AppContainer 档 ping 断网、TaskPrepare Git 副本、非 Git 树拷贝副本、diff→publish 回源、源改动拒绝覆盖；另含假模型 `runAgent` + `write_file` 经宿主 `FileWrite` 写副本、任务副本里的 `run_command` 默认走宿主 AppContainer 写副本后再 publish 两条） |
| CLI MCP 消费方 | `apps/cli/src/sandbox/tool-host-mcp.ts` | **2/2**（宿主拉起 stdio server，initialize/tools/list/tools/call 全链路；`isError` 不标死连接） |
| 桌面正常业务 | `git_channel_ipc.rs` 的 `GitRunner` | **1/1**（临时仓库真实 `git status` 经宿主 `inherit` 档返回 facts） |
| 桌面自检 | `src/lib.rs` 的 `sandbox_self_test` | **1/1**（`reports_tool_host_probe`，可用时真执行 echo） |
| NSIS 安装包（当前磁盘包，未安装回读） | `desktop-build.mjs` + Tauri bundle | `智汇AI_0.1.94_x64-setup.exe` **10,823,147 字节**，mtime `2026-11-27 21:00:34`，SHA-256 `463A5CB373A211981EF7AED5044C503E38DB6655A2DB9AF64B300A731B4EC075`；`installer.nsi` 仍只有 **1 条** `File /a "/oname=ihui-tool-host.exe"`，源是 `target/release/ihui-tool-host.exe`（**2,183,168 字节**，SHA-256 `4ACCB9A64F02D8C9B3AFF149B8B43B52FEC61478CA9D487C4D65B8641C6A4B22`），不是 development 的 `resources` 副本（**2,164,736 字节**，SHA-256 `0E059507B3145769E818A3488990155C38AC8E6FFC8A8947F241E1FF959D6BF6`）。该包由 `DESKTOP_ALLOW_UNSIGNED=1` 产出的本地未签名自测包，**不得进更新源/发版/上传 CDN**；包内宿主已跑 CLI 8/8 + MCP 2/2 = **10/10**，但整包仍**未安装回读**。 |
| 五层体检 | `benchmarks/capability-scorecard/run.mjs` | **111 通过 / 0 失败**（记忆 37、规划与反思 9、沙箱 45、toolhost 20） |

体检的 toolhost 20 = 进程集成 7 + 桌面 git 1 + CLI 前台双键/AppContainer/Git+非 Git TaskPrepare/任务命令默认宿主化/会话级文件工具写副本 10 + CLI MCP relay 2。本轮新增/扩展的判据：进程集成 3→7（池/跨宿主去重/重启/安装根布局）、CLI 0→10（含 Git/非 Git TaskPrepare 副本写→diff→publish、假模型 `runAgent` 文件工具写副本、任务副本命令走 AppContainer）、MCP 0→2、沙箱 AppContainer 网络判据、tool-host Task RPC 授权/丢弃；不是把旧用例重跑一遍充数。推理大脑与感知仍 `unjudged`，外部榜仍 `not_run`，没有新分数，也没有编。

## 目录

- [为什么切](#为什么切)
- [架构：池、缓存与双键](#架构池缓存与双键)
- [死锁修复](#死锁修复)
- [MCP stdio 归宿主](#mcp-stdio-归宿主)
- [宿主侧策略/编码收口](#宿主侧策略编码收口)
- [sidecar 去重与安装态](#sidecar-去重与安装态)
- [消费方接线](#消费方接线)
- [安全边界与未做项](#安全边界与未做项)
- [复跑](#复跑)
- [文件](#文件)

## 为什么切

桌面端此前是单进程：终端、浏览器、Git、沙箱执行都挂在 UI 进程里。工具一崩，会话跟着崩；工具长任务把 UI 线程占住，审批和渲染一起卡。W4-06 的做法不是"再开个线程"，而是：

- **执行宿主独立**：`ihui-tool-host.exe` 由客户端按需拉起，可单独被杀、单独重启；
- **会话只持句柄**：UI 进程不再直接 `Command::new` 跑工具；
- **宿主内再降权**：默认 `low` 档现在落 **AppContainer**（继承低完整性、无 `internetClient` capability），`ihui-tool-host.exe` 用 `CreateAppContainerProfile` + `CreateAppContainerToken` 建令牌，子进程真正不能出网；`Inherit` 只在显式要写工作区的 Git/`run_command` 全量前台路径使用，保留主令牌完整性与网络。显式 `IHUI_SANDBOX_APPCONTAINER=0` 只用于排障时回退旧低完整性根，不作为默认。
- **宿主拥有 MCP 子进程**：MCP server 的 stdin/stdout/stderr 生命周期归宿主，CLI 断线不会留下孤儿进程。

## 架构：池、缓存与双键

`ToolHostManager` 的字段是：

```text
exe: Option<PathBuf>
pool: Mutex<ClientPool>   // idle / live / max
cv: Condvar
cache: Mutex<ManagerCache> // values / order / gates
```

池默认 `max=2`，`IHUI_TOOL_HOST_POOL_SIZE` 可调 1..8，`new_with_max` 给测试与嵌入式调用用，`pool_size()` 只读诊断。`with_client` 的语义：

- 池空且 `live < max`：先 `live += 1`，**在 spawn 前释放池锁**；
- 池里有 idle：弹出客户端后**先 `drop(pool)` 再执行 `f`**；
- 没有空闲且已达上限：`Condvar` 等待，不忙转；
- `f` 返回 `Ok` 才把客户端放回 idle；传输层/RPC `Err` 直接丢弃并 `live -= 1`，下次重建；
- `restart` 只 drain idle，in-flight 调用不被打断；清空 `ManagerCache` 的 values/order，但**保留仍被持有的 per-key gate**，避免重启后同双键重试拿新闸门与旧执行并行；执行结束后再自行 remove。

**为什么还要 ManagerCache**：池里有两个宿主时，每个宿主自己的 `turnId|toolCallId` 缓存不共享。同一双键重试若被调度到另一个宿主，第二次会真的执行。现在 `execute_with_integrity` 先按双键取 per-key gate 串行化，再查管理器缓存；命中返回 `replayed=true`，成功写回，失败移除 gate；`restart` 清空缓存。不同键仍可并行落在不同宿主 PID 上。执行结果带 `hostPid`，测试据此证明两个线程确实用了两个宿主进程。

协议仍是命名管道一行一条 UTF-8 JSON；`service/Execute` 必须带非空 `turnId + toolCallId`，缺一即 `Err`，不把单键当双键。缓存上限 4096，超限淘汰最旧键；这是缓存，不是持久账本，宿主重启/Manager 重启不保留。

## 死锁修复

`git_status_reaches_tool_host_and_returns_facts` 曾在 `git init` 后挂起。加日志定位：第一次宿主调用完成，第二次调用卡住。根因不是 MCP 新代码，而是 `with_client` 的闲置复用分支：

```text
pool = self.pool.lock()
if let Some(client) = pool.idle.pop() {
    break client;          // ← 旧代码没有 drop(pool)
}
...
f(&mut client)             // 期间一直持有池锁
...
let mut pool = self.pool.lock()  // 函数末尾再次加锁 → 自死锁
```

修复为闲置复用分支先 `drop(pool)` 再 `break client`。修复后 Git 业务测试 1/1 通过，不再挂起。这个 bug 被池并发测试与跨宿主测试同时覆盖，单独跑 Git 测试不会再超时。

## MCP stdio 归宿主

旧的 `service/InitMcp` 是同步 request API，只适合测试/探针：它由宿主代发一条 MCP 请求，会丢 server 主动 notification/progress，也不能并发多 id。生产路径改为 raw relay：

- 宿主 `McpRelay::start` 拉起 MCP stdio 子进程，拥有 `stdin/stdout/stderr`；
- 数据面在 `127.0.0.1:0` 随机端口监听，首行 32 字节一次性 token 握手，只接受一个连接；
- stdout relay 与 stderr relay 各一条，stderr 也有独立端口，避免把 server 诊断日志混进 MCP 帧；
- CLI 的 `ToolHostMcpProcess` 连上后继续用自己的 ndjson/content-length framing、id 分派和 notification 处理；宿主**不解析 MCP 帧**，所以不会降级语义；
- `service/McpOpen` 返回 `host/port/stderrPort/token/pid`；`service/McpClose` 同时支持旧 `McpSession` 与 relay，关闭时 kill 子进程并 wait；
- 宿主 `service/Shutdown` 会关闭所有 MCP session/relay，不留孤儿。

真机测试 `mcp_relay_preserves_raw_frames_and_is_owned_by_host` 与 CLI `mcp-tool-host.test.ts` 覆盖：fake stdio server 由宿主拉起，`initialize`/`tools/list`/`tools/call` 全链路可用；`isError` 作为结果级失败，连接不被标死。CLI 侧 `pid=0`，真实子进程 PID 由 `mcpPid` 暴露。

## 宿主侧策略/编码收口

`service/Execute` 在宿主内先做输入收口，再进 `sandbox_spawn`：

| 项 | 规则 |
| --- | --- |
| `program` | 空/NUL 拒绝；绝对路径必须 `is_file()`；相对路径拒绝；唯一别名 `cmd.exe` 解析到 `ComSpec`（不存在则 `C:\Windows\System32\cmd.exe`） |
| `args` | 数量上限 1024，总长度上限 256KiB |
| `timeoutMs` | clamp 1..600000；超时 kill 整棵 Job 树，`timedOut=true`、`exitCode=null` |
| `cwd` | 必须是绝对路径且存在；缺省落到本会话的 AppContainer AC 可写根 |
| `integrity` | 只认 `low`/`appcontainer`/`inherit`；`low` 映射到 AppContainer，未知值拒绝，不静默回落 |
| 网络 | AppContainer 档无 `internetClient` capability；真实子进程 `ping` 非零退出，宿主 RPC 层也断言不可出网。`inherit` 仍是显式全权档，不在默认路径 |
| 环境 | 宿主进程拉起时 `env_clear()`，只保留 SystemRoot/SystemDrive/windir/ComSpec/PATH/PATHEXT/TEMP/TMP/USERPROFILE/HOME/HOMEDRIVE/HOMEPATH/APPDATA/LOCALAPPDATA/PROGRAMDATA/PROGRAMFILES/PROGRAMFILES(X86)/COMMONPROGRAMFILES/COMMONPROGRAMFILES(X86)/NUMBER_OF_PROCESSORS/PROCESSOR_ARCHITECTURE/OS/LANG/LC_ALL/PSModulePath；不把 App/CLI 的 API key 原样继承进宿主 |
| 输出 | UTF-16 BOM → UTF-8 BOM/严格 UTF-8 → 高 NUL 比例偶数长度按 UTF-16LE → GBK（无错即用）→ Windows-1252 兜底；单测覆盖 UTF-8/GBK/UTF-16LE/非法 GBK |

`normalize_program` 的定位是**防止坏客户端喂相对路径/不存在路径**，不是替代调用方命令白名单。宿主没有 settings，不能假装知道用户 allowlist；命令内容策略仍在 CLI/业务层。

## AppContainer 网络阻断

之前 `egress_gate` 只覆盖本仓 Rust 的 HTTP 出站点，管不到 `run_command` 拉起的任意子进程；低完整性只管 MIC 写盘，网卡照样能出。真正的边界要在令牌层做：

- `sandbox_spawn::create_appcontainer_token` 先用 `CreateAppContainerProfile("IHUI.ToolHost")` 建一个无 capability 的配置，再从 `kernelbase.dll` 取 `CreateAppContainerToken`（Chromium 同款未文档化导出）从普通主令牌派生 AppContainer 主令牌；
- `SECURITY_CAPABILITIES` 里 `AppContainerSid` = 该 Package SID，`Capabilities=NULL`、`CapabilityCount=0`，所以没有 `internetClient`；子进程的 `TokenIsAppContainer` 为真，网络栈在 token 层拒绝；
- 默认可写根改为 AppContainer 自己的 `%LOCALAPPDATA%\Packages\IHUI.ToolHost\AC\IHUI\sandbox\host-...`，不把用户工作区 ACL 放宽；宿主仍用 Job 管整棵进程树；
- `SandboxSpec::new` 默认 AppContainer；`resolve_integrity("low")` 也落 AppContainer；`inherit` 保留原语义，仅用于显式要写工作区的 Git/`run_command` 全量前台路径；
- 探测档位从 `low-integrity-job` 改为 `appcontainer-job`，`sandbox_self_test`、`ToolHostManager`、CLI 消费者都从 `ping` 返回的真实字段判断，不靠环境变量。

真机判据有三层：

1. `sandbox_spawn::tests::appcontainer_token_is_real_and_network_is_blocked`：`GetTokenInformation(TokenIsAppContainer)` 必须为真，`ping -n 1 8.8.8.8` 必须非零退出且无 `TTL=`；
2. `tests/tool_host.rs` 的 `tool_host_process_roundtrip...` 再通过宿主 RPC 发同一类 `ping`，断言 `exitCode != 0`，证明不是只在 `sandbox_spawn` 单测层有效；
3. 安装态宿主与开发态宿主同源，拿 **CLI 6/6 + MCP 2/2 = 8/8** 回读（含默认 AppContainer 档 ping 断网）；安装包 SHA-256 与安装后宿主 SHA-256 都记录在案。

> 2026-11-27 增补：`TaskPrepare / TaskDiff / TaskPublish / TaskAbandon` 已加入新宿主，并用开发态宿主跑通 CLI **10/10**（Git 副本写入→diff→publish、非 Git 树拷贝副本 + 源改动拒绝覆盖、假模型 `runAgent` 文件工具经宿主 `service/FileWrite` 写副本、任务副本里的 `run_command` 默认走宿主 AppContainer 写副本）；另由宿主单测覆盖 `service/FileDelete` 与删除 publish。当前 `0.1.94` 包已在 21:00 重打，但**没有重装回读**；下方 **8/8** 是更早旧包的安装态证据，不把开发态 10/10 或当前包外推成已安装验证。当前开发态 `resources` 宿主 2,164,736 字节，SHA-256 `0E059507B3145769E818A3488990155C38AC8E6FFC8A8947F241E1FF959D6BF6`；同次打包的 `target/release` 宿主 2,183,168 字节，SHA-256 `4ACCB9A64F02D8C9B3AFF149B8B43B52FEC61478CA9D487C4D65B8641C6A4B22`，包内宿主已跑 CLI 8/8 + MCP 2/2 = 10/10，但仍不是安装态。

边界：CLI 的 `runOnToolHost` 默认已改成 `appcontainer`，默认 `sleep` 类前台路径不再出网；只有显式 `IHUI_TOOL_HOST_FOREGROUND=1` 的全量前台命令仍用 `integrity: 'inherit'`（它需要写 `workspacePath`；AppContainer 令牌是低完整性，单靠给工作区加 Package SID ACL 仍会被 MIC 拦住，除非把工作区降完整性或改成宿主代写/中转，这都会改变产品语义）。补充实测：AppContainer 内 `whoami /groups` 显示 `Mandatory Label\Low Mandatory Level S-1-16-4096`，直接向 `C:\IHUI-AI\appc-test.txt` 写文件退出 1、`拒绝访问`——这条不是 ACL 缺失，而是 MIC；因此没有把全量前台强切 AppContainer。MCP relay 的 stdio server 也仍是宿主普通子进程，没有套 AppContainer。因此“默认低/宿主 RPC/CLI 默认前台档不出网”是已实测的，不能外推成“全量前台和 MCP 子进程都断网”。要收这两条，需要给全量前台路径做 workspace 的 Package SID ACL **并处理 MIC**，或把 MCP 进程也接到 AppContainer 管道；本轮没有用假代理或命令黑名单冒充。



这一项踩了三轮，最终结论是：

- **`tauri.conf.json` 不再配置 `externalBin`**，`bundle.resources` 只保留 launcher；
- Tauri 当前会从 `target/release/ihui-tool-host.exe` 收**一条**根宿主记录；
- 如果再配 `externalBin` + resources 宿主，Tauri 会同时收 `binaries/ihui-tool-host-<triple>.exe` 和 target 根副本，安装脚本出现两条 `File`；
- 所以 `desktop-toolhost-build.mjs` 只维护开发态 `resources/tool-host/ihui-tool-host.exe`，并把同一份本次编译产物复制到 `target/release/ihui-tool-host.exe` 供 Tauri 打包；不再生成 `binaries/ihui-tool-host-*.exe`。

最终证据：

- `C:\IHUI-Build\target\release\nsis\x64\installer.nsi` 只有 1 条
  `File /a "/oname=ihui-tool-host.exe"`（源为 `target/release/ihui-tool-host.exe`），卸载段只有 1 条对应 `Delete`；
- 安装包 10,800,845 字节，SHA-256 见上；
- 静默安装到 `C:\IHUI-Build\nsis-e2e` 后，`versions\0.1.94\` 下只有一份
  `ihui-tool-host.exe`（2,118,656 字节，SHA-256 见上），没有根副本、没有 `tool-host\` 资源副本；
  这份是 Tauri `cargo build --bins` 的根产物，和开发态 `resources` 副本（Task RPC 前 2,100,736 字节；加入 Git Task RPC 后 2,131,968；加入非 Git/字节保真后 2,146,816；加入 `.gitignore` 保真、publish dry-run、`FileWrite`/`FileDelete` 与 Windows 保留名/ADS/尾随点拒绝后 **2,164,736** 字节，SHA-256 `0E059507B3145769E818A3488990155C38AC8E6FFC8A8947F241E1FF959D6BF6`）同源但编译调用不同，字节数不同；旧包两份都跑过 **8/8** 消费方测试（CLI 6 + MCP 2）。当前重打包内的 target 根产物为 **2,183,168** 字节，SHA-256 `4ACCB9A64F02D8C9B3AFF149B8B43B52FEC61478CA9D487C4D65B8641C6A4B22`，已跑 CLI 8/8 + MCP 2/2 = **10/10**；仍未整包安装回读。
- 用该安装态宿主跑 CLI + MCP **8/8**（CLI 6、MCP 2，含 AppContainer 断网）；
- 卸载后安装目录不存在，开始菜单 `智汇AI.lnk` 不存在，无 `智汇AI.exe`/`ihui-app.exe`/`ihui-tool-host.exe` 残留。

另外修了 `desktop-build.mjs` 的产物钩子判据：它原来写死 `apps/desktop/src-tauri/target`，而本机 `CARGO_TARGET_DIR=C:\IHUI-Build\target`，导致 Tauri 已产出安装包、钩子却报"没有产物"并 exit 1。现在 `artifactDirFor` 优先读 `CARGO_TARGET_DIR`，`scripts/tests/desktop-build.test.mjs` 40/40 通过。`desktop-nsis-template.mjs --check` 仍 OK（46 处 IHUI 补丁）。

## 消费方接线

### CLI `run_command`

- 只在 Windows、前台、且满足 `shouldRouteForegroundToToolHost` 时走宿主；默认仍只送不可收编命令（`sleep` 类），显式 `IHUI_TOOL_HOST_FOREGROUND=1` 时全量前台命令走宿主，此时超时等价直接失败、不再自动转后台；
- 只在 `IHUI_TOOL_HOST_EXE` 指向存在的宿主，或宿主与 CLI 同目录时启用；普通安装找不到就原路径，不把"没有宿主"伪装成"已切执行"；
- 先跑 `precheckSandbox`，命令/路径白名单仍在 CLI 生效；过了闸才把 `cmd.exe /d /s /c <command>` 发给宿主；默认 `sleep` 类前台命令走 `integrity=appcontainer`、`cwd=''`（落宿主 AC 根，不碰工作区），显式 `IHUI_TOOL_HOST_FOREGROUND=1` 的全量前台命令才走 `integrity=inherit`、`cwd=workspacePath`；
- 宿主子进程 env 用 `buildFilteredEnv(blockedEnvVars)` 过滤，凭据形态变量不进宿主；
- RPC 传输出错**不盲目 fallback**：宿主可能已经执行了一半，回落会制造第二次副作用；当前返回 `tool_host_error`；
- 结果映射成 `SandboxResult` 再交给 `settleForegroundCommand`，失败分型仍是 `timed_out`/`failed`。

### 双键从上层贯通

- `ParsedToolCall.id?: string`，Anthropic `tool_use.id`、OpenAI `tool_calls[].id` 都解析；
- `ToolContext.turnId?/toolCallId?`；
- `executeToolCall` 对每个调用克隆 `callCtx`，把 `ParsedToolCall.id` 写入 `toolCallId`，避免并行批次共享 ctx 互相覆盖；
- `runToolLoop` 启动时把 `opts.ctx` 替换为带 `turnId` 的副本：优先 `turnTrace.turnId`，否则 `sessionId`，再否则 `cli-turn-${process.pid}`，不每次随机；
- `ToolHostExecOptions` 增加 `turnId/toolCallId`，`ToolHostConnection.execute` 优先用调用方键，缺失才用连接 session/random UUID；
- `builtins.ts` 的 `run_command` 宿主调用传入 `ctx.turnId/ctx.toolCallId`。

### 桌面

- `git_workspace_status`/`diff`/授权走 `GitRunner` → 宿主 `inherit` 档；Git 要读仓库、可能刷新 index，低完整性会失败；
- 宿主存在但 RPC 失败时不回退 `ProcessRunner`，状态如实 `undetermined`；只有宿主文件不存在才回退；
- `sandbox_self_test` 拉起宿主执行一次 echo，报告带 `tool_host` 与 `hostPid`；
- **不给桌面 remote capability 加 `tool_host_execute`**：远程页是 `https://aizhs.top`，一旦放开就是给线上页面（含任意 XSS）一个执行入口，属于安全倒退。桌面端只保留本地 origin 可用的执行命令。

## 安全边界与未做项

- **网络 egress 已按档位收口，不是全档**：默认 `low` 档落 AppContainer，实测无 `internetClient`、`ping` 非零退出、宿主 RPC 同判；CLI `runOnToolHost` 默认也改为 `appcontainer` 并有 ping 断网用例；显式 `IHUI_TOOL_HOST_FOREGROUND=1` 的全量前台命令、Git 路径仍走 `inherit` 并保留主令牌网络，MCP relay 的 stdio 子进程也仍是宿主普通子进程。AppContainer 令牌是低完整性，单加 Package SID ACL 不足以让它写中完整性工作区，还要处理 MIC 或改成宿主代写/中转；本轮没有把“默认已断”冒充成“全部断”。
- **AppContainer 依赖 `CreateAppContainerToken` 未文档化导出**：这是 Chromium 同款路径，已在当前 Windows 版本实测；若未来系统不导出该函数，默认 low 档会 fail-closed（`sandboxSupported=false`），不会静默回落低完整性裸跑。
- **命令白名单仍主要在 CLI/业务层**。宿主只做路径/参数上限，不知道用户 allowlist；拿到宿主 token 的调用方仍可跑任意绝对路径程序。生产接入方必须先过自己的策略闸。
- **`Inherit` 不是默认**，默认仍 `AppContainer`；显式 `inherit` 只保留完整性、仍挂 Job 限额，不是"没沙箱"。
- **交互式终端 stdin 双向流**仍走 `TerminalSession`，不塞进本协议；本协议只做一次性执行（agent 工具语义）。
- **MCP stderr 也有 loopback 端口**，但 stderr 不是 MCP 数据面，CLI 只把它当诊断流；不把 stderr 混进 stdout framing。
- **sidecar 单份依赖 Tauri 当前行为**：`tauri.conf.json` 不配 `externalBin`，由 Tauri 从 target 根收一份。已用 0.1.94 真包验证；若未来 Tauri 版本改变该行为，需要重新跑 `installer.nsi` 的宿主记录计数，不能只看构建成功。

## 复跑

```powershell
# 1. 宿主单元 + 集成（--lib tool_host 过滤集含 git/自检消费方）
cd C:\IHUI-AI\apps\desktop\src-tauri
C:\caches\cargo\bin\cargo.exe test --lib tool_host -- --test-threads=1
C:\caches\cargo\bin\cargo.exe test --test tool_host -- --test-threads=1

# 2. CLI 消费方（开发态宿主）
cd C:\IHUI-AI\apps\cli
pnpm exec tsc --noEmit -p tsconfig.json
$env:IHUI_TOOL_HOST_EXE='C:\IHUI-AI\apps\desktop\src-tauri\resources\tool-host\ihui-tool-host.exe'
pnpm exec vitest run tests/tool-host-client.test.ts tests/mcp-tool-host.test.ts
Remove-Item Env:IHUI_TOOL_HOST_EXE

# 3. 体检（111/0；toolhost 20/20）
cd C:\IHUI-AI
node benchmarks\capability-scorecard\run.mjs

# 4. 重打 sidecar + NSIS
node scripts\desktop-toolhost-build.mjs
cd C:\IHUI-AI
$env:DESKTOP_ALLOW_UNSIGNED='1'
node scripts\desktop-build.mjs -- --bundles nsis
# 断言 installer.nsi 只有一条 File /a "/oname=ihui-tool-host.exe"
$nsi='C:\IHUI-Build\target\release\nsis\x64\installer.nsi'
(Select-String -Path $nsi -Pattern 'File /a "/oname=ihui-tool-host.exe"').Count  # 期望 1

# 5. 安装态：静默装到临时目录，用宿主跑 CLI/MCP，再卸载
$installer='C:\IHUI-Build\target\release\bundle\nsis\智汇AI_0.1.94_x64-setup.exe'
$dir='C:\IHUI-Build\nsis-e2e'
Get-Process 智汇AI,ihui-app,ihui-desktop,ihui-tool-host -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
Start-Process $installer -ArgumentList '/S',"/D=$dir" -Wait
$hostExe="$dir\versions\0.1.94\ihui-tool-host.exe"
if (-not (Test-Path $hostExe)) { throw '安装后没有宿主' }
Get-ChildItem $dir -Recurse -Filter 'ihui-tool-host.exe' | Measure-Object | Select-Object -ExpandProperty Count  # 期望 1
$env:IHUI_TOOL_HOST_EXE=$hostExe
pnpm exec vitest run tests/tool-host-client.test.ts tests/mcp-tool-host.test.ts
Remove-Item Env:IHUI_TOOL_HOST_EXE
Start-Process "$dir\uninstall.exe" -ArgumentList '/S' -Wait
if (Test-Path $dir) { throw '安装目录未删除' }
if (Test-Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\智汇AI.lnk") { throw '开始菜单快捷方式未删除' }
```

## 文件

- `apps/desktop/src-tauri/src/tool_host.rs`：协议类型、命名管道服务端、客户端、池、ManagerCache、MCP raw relay/stderr relay、`normalize_program`/args/timeout/cwd 收口、env 过滤、输出解码。
- `apps/desktop/src-tauri/src/bin/ihui-tool-host.rs`：独立进程入口。
- `apps/desktop/src-tauri/src/sandbox_spawn.rs`：`IntegrityMode`、AppContainer profile/token、`appcontainer_sandbox_root`、Job 限额与 raw command line。
- `apps/desktop/src-tauri/tests/tool_host.rs`：7 个进程级测试。
- `apps/desktop/src-tauri/src/git_channel_ipc.rs`：`GitRunner` 宿主消费点。
- `apps/desktop/src-tauri/src/lib.rs`：`sandbox_self_test` 宿主探测/echo。
- `apps/cli/src/sandbox/tool-host.ts`：Node 命名管道客户端、双键传参、`ToolHostMcpProcess` 入口。
- `apps/cli/src/sandbox/tool-host-mcp.ts`：MCP raw relay 适配器（stdout/stderr）。
- `apps/cli/src/tools/builtins.ts`：`run_command` 宿主分支、`shouldRouteForegroundToToolHost`。
- `apps/cli/src/tools/index.ts`：`ParsedToolCall.id`、`ToolContext.turnId/toolCallId`、callCtx 克隆。
- `apps/cli/src/commands/agent.ts`：`runToolLoop` 注入 turnId。
- `apps/cli/tests/tool-host-client.test.ts`：8 个 CLI 消费方测试（含默认 AppContainer 档断网、TaskPrepare Git/非 Git 副本；`FileWrite/FileDelete` 的宿主侧由 Rust 单测覆盖）。
- `apps/cli/tests/mcp-tool-host.test.ts`：2 个 CLI MCP 测试。
- `scripts/desktop-toolhost-build.mjs`：release 宿主构建，开发态 resources 副本 + target 根副本。
- `apps/desktop/src-tauri/tauri.conf.json`：无 `externalBin`；resources 只保留 launcher。
- `scripts/desktop-build.mjs`：产物钩子按 `CARGO_TARGET_DIR` 取目录。
- `scripts/tests/desktop-build.test.mjs`：40/40，含 CARGO_TARGET_DIR 判据。
- `apps/desktop/src-tauri/windows/installer.nsi` + `scripts/desktop-nsis-ihui-patches.json`：卸载段删除开始菜单快捷方式；46 处 IHUI 补丁 `--check` OK。
- `benchmarks/capability-scorecard/run.mjs` / `README.md`：新增 CLI 双键、MCP relay、CLI AppContainer 断网、Git/非 Git TaskPrepare 副本写→publish、会话级文件工具写副本、任务命令默认宿主化；toolhost 20/20、总分 111/0。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
