<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# block2 · TRAE CN 未吸收可复现设计

> 对照程序：TRAE CN 3.4.20（VSCode 派生，未打包 out/），安装面 `C:\Trae CN`。
> 取证纪律：只取行为与设计 + 符号名/字符串/协议名/路径作为证据；未粘贴对方专有源码连续原文；未运行 TRAE 本体及其任何 dll/exe；未破解许可证、未提取凭据。
> 本机 Bash 不可用，全部命令为 PowerShell；rizin 路径 `C:\Program Files\Rizin\bin\rizin.exe`。

## 取证面与覆盖

- **模块面**：`C:\Trae CN\resources\app\modules\` 下共四个目录——`ai-agent`、`ckg`、`sandbox`、`browser-bridge`。本轮覆盖前三块；`browser-bridge` 未取证（见「未做 / 未判定」）。
- **文本面（只读未执行）**：
  - `ai-agent\meta.json`（socket port 40005，activationEvents `*`）、`start.bat` / `start.sh`（环境变量与启动参数）、`checkpoint.sh`。
  - `ckg\meta.json`（socket port 50000，`env.LD_LIBRARY_PATH=./binary`）、`start.bat` / `start.sh`（守护进程启动参数）。
- **导出表（PE iE）**：rizin `-qc "iE"` 逐枚提取，覆盖 `harness.dll`、`ai_agent.dll`、`toolhost.dll`、`agent-tool-host.exe`、`ctx-cli.exe`、`libckg.dll`、`sbox_sdk.dll`、`vm_sdk.dll`、`aiep_ipc.dll`、`aiep_vm.dll`、`aiep_sbox.dll`、`trae-sandbox.exe`、`run_helper.exe`。
- **导入表（PE ii）**：rizin `-qc "ii"` 提取上述可执行/库的依赖 DLL 与导入 API，判进程模型与子系统依赖。
- **定向字符串**：自研扫描器 `_scratch\trae\scan-strings.ps1`（ASCII + UTF-16LE 可打印串，按关键词过滤）对 9 个二进制提协议名/管道名/端口/环境变量/错误码/路径/事件名；大文件未做全量字符串 dump。
- **IHUI 现状核验**：在 `C:\IHUI-AI` 仓内用 Grep / Read 逐候选命中绝对路径或记录零命中；源码只读，未改任何仓内文件，未跑 dev/build/typecheck/测试。
- **粒度边界**：本轮为导出表 / 导入表 / 定向字符串 / 启动脚本级取证。**284MB `ai_agent.dll`、266MB `harness.dll`、100MB `toolhost.dll`、101MB `agent-tool-host.exe` 的全量反编译未做**；Ghidra 逐函数还原未做。凡仅由文件名/符号名推测的结论，一律归入「推断」，不进「观察」。

## 候选条目

| ID | 设计名 | 价值档 | 复现代价 | 超越轴 | 一句话 |
|----|--------|--------|----------|--------|--------|
| B2-01 | 双模式隔离 SDK 平行面（作业级沙箱 + 微虚拟机级 + 能力探测枚举） | A | L | fail-closed 边界 | 两套平行 SDK 接口 + 启动器先探测支持度，不支持则显式拒绝而非直跑 |
| B2-02 | IPC 通道安全描述符 / ALPC 端口 ACL 边界 | A | M | fail-closed 边界 | 建 IPC 端口与目录对象时带安全描述符，ACL 构建失败即拒绝 |
| B2-03 | helper 进程拉起-等待-退出码中继 + 输出 drain 完成判定 | A | M | 可测性 | 子进程由 helper 拉起并中继退出码，输出 drain 完才提交终态 |
| B2-04 | 分级看门狗重连（断连重连 / 错误重试 / 瞬态有限重试 / 终局上抛） | A | M | 可测性 | 连接失败按成因分级动作，退避有上限，终局错误不静默丢消息 |
| B2-05 | 工具执行审批三态 + 命令超时显式入参 | A | M | fail-closed 边界 | 每次工具调用带审批档位与 timeout_ms，缺省落更严一侧 |
| B2-06 | 回合前上下文 checkpoint 自检钩子（原文是否仍在上下文） | A | S | 可测性 | 工具调用前校验关键原文指纹，缺失则回源重读，不凭摘要继续 |
| B2-07 | 常驻原生模块统一 BP ABI（三函数绑定 + IPC 句柄生命周期） | B | L | 可测性 | 宿主按统一导出表加载原生模块，Initialize/Shutdown 配对可单测 |
| B2-08 | ContextFS 动词面（list/read/write/delete/grep/glob）+ 传输超时与 trace 透传 | B | M | PostgreSQL 统一数据层 | 把上下文产物挂成虚拟文件树，经本地通道暴露动词面，带超时与追踪头 |
| B2-09 | 本地代码知识图谱守护：索引幂等标记 + 管线步骤 + 完整性统计（sqlite_vec → pgvector 替代） | B | L | PostgreSQL 统一数据层替代 sqlite | 常驻索引服务的幂等/管线/统计设计复现，存储统一走 PG/pgvector |
| B2-10 | 沙箱生命周期与拦截行为埋点（进程清点 / 管道重定向计数 / 崩溃事件） | B | M | 可测性 | 沙箱建销、拦截、崩溃全进结构化事件流，计数可对账 |
| B2-11 | 会话快照版本链对照补只读面（按 message_id 反查版本 + 文件 diff 清单） | C | S | PostgreSQL 统一数据层 | 本仓已有回滚，对照补按消息反查版本与文件差异两个只读面 |

## 逐条五要素

### B2-01 双模式隔离 SDK 平行面（作业级沙箱 + 微虚拟机级 + 能力探测枚举）

- **证据**：
  - `C:\Trae CN\resources\app\modules\sandbox\sbox_sdk.dll` 导出 `SBoxSDK_Init` / `SBoxSDK_InitV2` / `SBoxSDK_IsSBoxSupported` / `SBoxSDK_CreateSandbox` / `SBoxSDK_GetSBoxInfo` / `SBoxSDK_FreeSBoxInfo` / `SBoxSDK_Action` / `SBoxSDK_GetLastError` / `SBoxSDK_UnInit`。
  - `C:\Trae CN\resources\app\modules\sandbox\unified\vm_sdk.dll` 导出 `VMSDK_Init` / `VMSDK_InitV2` / `VMSDK_IsVMSupported` / `VMSDK_CreateProcess` / `VMSDK_GetVMInfo` / `VMSDK_FreeVMInfo` / `VMSDK_Action` / `VMSDK_GetLastError` / `VMSDK_UnInit`。
  - 复核命令：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iE" "C:\Trae CN\resources\app\modules\sandbox\sbox_sdk.dll"`（vm_sdk.dll 同形替换路径）。
  - `trae-sandbox.exe` 字符串命中能力枚举：`Supported` / `OSFailed` / `FileMissX64Ipc` / `FileMissX64Biz` / `FileMissX86Ipc` / `FileMissX86Biz` / `SignatureFailed` / `FileVersionMismatch` / `WineNotSupported` / `ArchUnsupported` / `ShmUnavailable` / `UdsUnavailable`，以及 `is_sbox_supported returned`、`SDK not loaded`、`sdk_load_failed`。
- **三档**：观察=上述导出名与枚举字符串逐字命中。推断=SBox 面对应作业/容器级隔离，VM 面对应更重的微虚拟机级隔离，两者接口形态平行（Init/IsSupported/Create/Action/Kill/UnInit）。未知=VM 后端具体是 Hyper-WHP / Hyper-V / 其它微虚拟机技术，字符串面未判定；两套 SDK 内部隔离边界未反编译。
- **IHUI 现状**：Grep `hyperv|microvm|HostCompute|Detours|DetourFinish|ALPC|security descriptor|InitializeSecurityDescriptor`（路径 `C:\IHUI-AI\apps\desktop\src-tauri\src`）→ **0 命中**。现有隔离仅进程树清理：`C:\IHUI-AI\apps\desktop\src-tauri\src\terminal_session.rs`（`JobObject`，CreateJobObjectW / AssignProcessToJobObject）与 `C:\IHUI-AI\apps\desktop\src-tauri\src\orphan_guard.rs`（kill-on-close 作业）。结论=**完全没有** VM/微虚拟机级平行隔离面；作业对象级进程清理已有等价。
- **落点建议**：新增 `C:\IHUI-AI\apps\desktop\src-tauri\src\sandbox_sdk.rs`（薄接口 trait：`init / is_supported / create / action / kill_all / get_alive_infos / uninit`），先复用 `terminal_session.rs` 的 `JobObject` 作为作业级实现；VM 级留能力探测桩位，不支持即返回不支持原因码。
- **超越轴**：fail-closed 边界。能力探测不通过（缺文件/签名不符/架构不符/无 SHM/UDS）时默认拒绝执行，不得回落裸跑；测试钉住每种不支持原因码与「未支持时不创建进程」的副作用断言。
- **最小复现范围**：统一沙箱 trait + 能力探测三态（支持/不支持/未判定）+ 作业级实现复用现有 Job Object；VM 级只留接口与探测桩。

### B2-02 IPC 通道安全描述符 / ALPC 端口 ACL 边界

- **证据**：
  - `C:\Trae CN\resources\app\modules\sandbox\unified\x64\aiep_ipc.dll` 导出 `CreateIPCInterface` / `CreateIPCInterface2` / `DestroyIPCInterface` / `InitIPCInterface2WithSecurityDescriptor`。
  - 复核命令：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iE" "C:\Trae CN\resources\app\modules\sandbox\unified\x64\aiep_ipc.dll"`。
  - `sbox_sdk.dll` / `vm_sdk.dll` 字符串命中：`[ipc] build alpc port security descriptor fail, code {}`、`[host] [{}] build directory security descriptor failed, code {}`、`[ipc] ipc has already inited`、`[ipc] invalid ipc server, maybe has already uninited`。
  - 导入表（`ii`）：两个 SDK 均经 ntdll `NtSetInformationProcess` / `RtlCreateEnvironmentEx`，kernel32 `CreateEventW`；`aiep_ipc.dll` 字符串含 `already connected` / `broken pipe` / `connection aborted` / `stream timeout` / `InitOnceExecuteOnce`。
- **三档**：观察=导出符号名、日志模板串、导入 API 名。推断=IPC 通道（ALPC 端口或命名管道）与宿主目录对象在创建时构建安全描述符限定 ACL；初始化幂等、反初始化后复用判 invalid。未知=具体 SDDL/ACL 主体与允许的安全标识未判定；ALPC 与管道各自承载哪条链路未判定。
- **IHUI 现状**：Grep `ALPC|security descriptor|InitializeSecurityDescriptor|CreateNamedPipe`（`apps\desktop\src-tauri\src`）→ **0 命中**。现有跨端通信全部走 Tauri command 桥：`C:\IHUI-AI\apps\desktop\src-tauri\src\terminal_ipc.rs` 头注明确「只放 `#[tauri::command]` + wire DTO」，仓内无常驻侧车进程监听管道/UDS。结论=**完全没有**跨进程 IPC 的 ACL/安全描述符面。
- **落点建议**：未来若起常驻侧车/原生服务，新增 `C:\IHUI-AI\apps\desktop\src-tauri\src\ipc_channel.rs`：通道创建时构建安全描述符，构建失败返回显式错误码；当前阶段先在架构文档登记该边界，不提前造第二套传输。
- **超越轴**：fail-closed 边界 + 可测性。SD 构建失败必须拒建通道并出声，不得「先建后补 ACL」；单测构造 SD 失败路径，断言通道句柄未泄露、错误原因码可审计。
- **最小复现范围**：IPC 接口创建入口 + 安全描述符初始化一步 + 失败即拒的错误分支；不实现具体 RPC 协议。

### B2-03 helper 进程拉起-等待-退出码中继 + 输出 drain 完成判定

- **证据**：
  - `C:\Trae CN\resources\app\modules\sandbox\x64\run_helper.exe` 导入表（`ii`）：`CreateProcessW` / `WaitForSingleObject` / `GetExitCodeProcess` / `TerminateProcess` / `LoadLibraryExW` / `GetProcAddress` / `IsDebuggerPresent`；PDB 路径串 `C:\92068\aha_sbox_v1\Build\MinSizeRel\x64\pdb\run_helper.pdb`。
  - `aiep_sbox.dll` / `aiep_vm.dll` 各导出 `DetourFinishHelperProcess`；SDK 字符串含 `run_helper.exe "%s",#1` 与 `\x86\run_helper.exe`、`\x64\run_helper.exe` 目录形态。
  - `agent-tool-host.exe` 字符串命中进程管理器任务面：`['codex_pm'] wait failed` / `output drain task failed` / `output merge task failed` / `output limit monitor task failed`、`terminal commit requires terminal status with complete output`、`fetch binary timed out`、`fetch stdout pipe unavailable` / `fetch stderr pipe unavailable`、`transient file lock error, retrying`。
- **三档**：观察=导入 API、导出符号、命令行模板与任务名串。推断=helper 进程被沙箱链路拉起，负责创建目标进程、等待句柄、中继退出码；输出经 drain/merge/限流监控多任务归集，输出未完整不得提交终态。未知=Detours 注入方式（远程线程/钩子链细节）未判定；helper 与目标的句柄继承关系未反编译。
- **IHUI 现状**：`terminal_session.rs` 已有 `Child` 句柄、`JobObject`、七态状态机（Starting/Running/Exited/Killed/Failed/TimedOut/AlreadyFinished）与环形缓冲；`orphan_guard.rs` 补退出清树。Grep `DetourFinishHelperProcess|run_helper|output drain|output merge`（`apps\desktop\src-tauri\src`）→ **0 命中**。结论=**部分覆盖**：进程拉起/等待/清树已有；helper 中继形态、输出多任务 drain 完成判定、管道不可用降级分支无。
- **落点建议**：在 `C:\IHUI-AI\apps\desktop\src-tauri\src\terminal_session.rs` 内补「终态提交前输出 drain 完成」判定：stdout/stderr 流关闭 + 限流监控任务结束才允许落 Exited；管道不可用、输出超限、超时三分支分别留原因码。
- **超越轴**：可测性 + 零缺省行为变化。测试注入管道提前关闭、输出超 RING_BYTES、等待超时三类场景，断言终态原因码与退出码中继正确；不改现有七态对外语义。
- **最小复现范围**：等待句柄 + 退出码中继 + 输出 drain 完成闸门 + 三个失败分支原因码；不引入 Detours 注入。

### B2-04 分级看门狗重连（断连重连 / 错误重试 / 瞬态有限重试 / 终局上抛）

- **证据**：
  - `toolhost.dll` 字符串：`Connection lost, waiting for reconnect`、`[ckg_watcher] connection closed, will reconnect`、`[ckg_watcher] connection error, will retry`、`Connection closed, cancel signal sent`、`Auto-unregistered cancel handler`、`retrying upgrade after transient failure`、`remove_dir_all failed, retrying`。
  - `agent-tool-host.exe` 同串命中 `Connection lost, waiting for reconnect`、`[ckg_watcher] connection closed, will reconnect`、`[ckg_watcher] connection error, will retry`；MCP HTTP 面：`HTTP accept failed; retrying`、`HTTP socket concurrency exceeded`、`cancelling HTTP requests and connections`、`HTTP connection lifetime expired`。
  - 复核命令：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iz" "<dll 路径>"` 后按关键词过滤；本轮过滤结果存 `_scratch\trae\str-toolhost.txt`、`_scratch\trae\str-agent-tool-host.txt`。
- **三档**：观察=日志模板串逐字命中。推断=分级策略：连接关闭（closed）走 reconnect，连接错误（error）走 retry，瞬态文件锁/升级失败走有限次重试；终局错误取消信号并注销取消处理器。未知=退避算法、最大重试次数、重连间隔未从字符串面判定。
- **IHUI 现状**：已有 LLM/传输层重试：`C:\IHUI-AI\apps\ai-service\app\core\agent_failure_vocabulary.py`（`RETRYABLE` / `terminal` 分类，retry 闸唯一取源）、`C:\IHUI-AI\apps\ai-service\app\core\responses_retry.py`（`decide_stream_retry`）、`C:\IHUI-AI\apps\ai-service\app\middleware\llm_metrics.py`（指数退避 60s..1800s 计数）；socket.io 侧 `C:\IHUI-AI\apps\ai-service\app\main.py:753` 有 `max_reconnect_attempts`（缺省 3）。结论=**部分覆盖**：模型流与网络传输重试有；常驻外部服务 watcher（对照 ckg_watcher 形态）的分级重连循环无。
- **落点建议**：新增 `C:\IHUI-AI\apps\ai-service\app\services\connection_watcher.py`：输入连接状态事件（closed/error/transient/terminal），分级映射到 reconnect / retry / 有限次瞬态重试 / 上抛；退避参数显式可配，上限到了上抛终局错误。
- **超越轴**：可测性。用假连接注入四类事件，断言分别走重连、重试、有限次、上抛分支；终局分支必须取消在途请求并注销处理器，不静默丢消息。
- **最小复现范围**：状态分类 → 分级动作 → 有上限退避 → 终局上抛；不接具体远端服务。

### B2-05 工具执行审批三态 + 命令超时显式入参

- **证据**：
  - `ai_agent.dll` 字符串命中 `AutoRunConfig` 与档位枚举 `AlwaysAsk` / `Whitelist` / `AlwaysRun`；请求结构串 `ExecuteCommandRequest`，字段 `session_id` / `command_id` / `args` / `timeout_ms` / `binary_data` / `extra`。
  - 复核命令：扫描器 `_scratch\trae\scan-strings.ps1` 对 `C:\Trae CN\resources\app\modules\ai-agent\ai_agent.dll` 提取，结果存 `_scratch\trae\str-ai_agent.txt`。
- **三档**：观察=枚举名与字段名串。推断=工具调用按档位决定是否询问/放行白名单/直接执行；超时随命令请求显式传入，而非全局默认。未知=白名单存储位置、前缀匹配规则、超时后动作（终止/挂起）未判定。
- **IHUI 现状**：审批策略已有四态，`C:\IHUI-AI\apps\ai-service\app\core\patch_safety.py:42-45`：`APPROVAL_POLICY_NEVER` / `ON_REQUEST` / `UNLESS_TRUSTED` / `GRANULAR_SANDBOX_APPROVAL`；决策矩阵在 `C:\IHUI-AI\apps\ai-service\app\routers\agent_runtime.py`（`_check_permission`、`GET /permission/check`）；持久化见 `C:\IHUI-AI\apps\ai-service\app\services\approval_persistence.py`（`approval_grants` / `exec_prefix`）。Grep `timeout_ms|timeoutMs|command_id|auto_run|autoRun|alwaysAsk|alwaysRun|whitelist`（`agent_runtime.py`）→ **0 命中**。结论=**部分覆盖**：审批档位与授权持久化已有；命令级 `timeout_ms` 显式入参与强制中断无。
- **落点建议**：`agent_runtime.py` 工具执行请求补 `timeout_ms` 字段（缺省走配置上限），超时强制中断在途子进程/流；白名单执行前缀复用 `approval_persistence.py` 的 `approval_grants`，不另建存储。
- **超越轴**：fail-closed 边界。审批档位缺失或识别不出时落更严一侧（询问/拒绝）；越权用例断言「副作用没发生」并成对留正向对照（对齐 §5 认证不等于授权纪律）。
- **最小复现范围**：请求超时字段 + 超时中断 + 白名单前缀匹配；审批决策矩阵沿用现有实现。

### B2-06 回合前上下文 checkpoint 自检钩子（原文是否仍在上下文）

- **证据**：
  - `C:\Trae CN\resources\app\modules\ai-agent\checkpoint.sh` 文本（只读未执行）：要求自问「上下文里还有没有 RFC 全文（完整原版，而不是压缩摘要、截断等）？如果没有，请重新阅读原 RFC；并且下次调用任意工具之前，都需要重新执行这个脚本」。
  - 旁证：`harness.dll` 字符串命中 `checkpoint.json`、`delete title marker`、`title_generated`；`ai_agent.dll` 命中 `get_operation_snapshot_by_toolcall_id`、`get_reference`。
- **三档**：观察=脚本文本与 checkpoint 相关字符串。推断=把「关键原文是否已被压缩/截断出上下文」做成每次工具调用前的自检钩子，缺失则回源重读。未知=该脚本在 harness 内的接线点、判定指纹（哈希/片段）与自动重读范围未判定。
- **IHUI 现状**：已有压缩/截断链路：`C:\IHUI-AI\apps\ai-service\tests\test_token_compaction_integration.py`、`test_token_compaction.py`、`test_thread_rollout_truncation_wiring.py`；会话交接见 `C:\IHUI-AI\apps\ai-service\app\services\session_handoff.py`。Grep `fingerprint|原文|重读|re-read|checkpoint self|自检|anchor`（`C:\IHUI-AI\apps\ai-service\app\services\agent_loop_v2.py`）→ 3 条命中均为注释（`:746`「中间不重读全局」、`:8110`「原文不出进程」、`:8561` 权限注释），无回合前指纹校验/重读钩子实现。结论=**部分覆盖**：上下文压缩与截断有；工具调用前的「原文是否还在」自检钩子无。
- **落点建议**：在 `C:\IHUI-AI\apps\ai-service\app\services\agent_loop_v2.py` 工具调用前补自检：对关键引用（文件/RFC/规范）记录指纹或锚点，上下文窗内校验不到则回源重读并留痕，不凭压缩摘要继续。
- **超越轴**：可测性。注入「上下文已截断、关键锚点缺失」的桩上下文，断言触发回源重读而非直接下发工具调用；重读动作有日志可审计。
- **最小复现范围**：调用前自检钩子 + 缺失重读 + 留痕；不改动现有压缩策略本身。

### B2-07 常驻原生模块统一 BP ABI（三函数绑定 + IPC 句柄生命周期）

- **证据**：
  - 四份 PE 导出表同型三函数：`BP_GetInterface` / `BP_Initialize` / `BP_Shutdown`。
    - `harness.dll`（内部名 `harness_server.dll`）另导出 `ai_agent_ipc_connect` / `ai_agent_ipc_disconnect` / `ai_agent_ipc_init` / `ai_agent_ipc_recv`。
    - `ai_agent.dll` 同型：`BP_GetInterface` / `BP_Initialize` / `BP_Shutdown` + `ai_agent_ipc_connect` / `disconnect` / `init` / `recv`。
    - `toolhost.dll`（内部名 `agent_toolhost.dll`）：`BP_GetInterface` / `BP_Initialize` / `BP_Shutdown`。
    - `libckg.dll`（内部名 `libckg_server_windows_x64.dll`）：`BP_GetInterface` / `BP_Initialize` / `BP_Shutdown`。
  - 复核命令：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iE" "<dll 路径>"`，结果存 `_scratch\trae\ie-*.txt`。
- **三档**：观察=导出符号名逐字命中。推断=宿主进程按统一 ABI 动态加载原生模块，取接口 → 初始化 → 关闭，IPC 句柄经 connect/init/recv/disconnect 生命周期管理。未知=接口函数签名、参数内存布局、线程模型未判定（全量反编译未做）。
- **IHUI 现状**：桌面端 Rust 静态编译进 Tauri，无动态插件加载面。Grep `BP_GetInterface|BP_Initialize|GetInterface|LoadLibrary|sidecar`（`apps\desktop\src-tauri\src`）→ 仅命中 `checkin_capture.rs` / `operator.rs` 中 HMAC `sidecar` 注释（备份伴随文件，与原生插件无关）；无原生模块 ABI 加载。结论=**完全没有**该动态 ABI 面。
- **落点建议**：本轮不落地代码；若未来引入侧车/原生插件，新增 `C:\IHUI-AI\apps\desktop\src-tauri\src\native_plugin_abi.rs`，定义三函数绑定签名与句柄生命周期，初始化/关闭配对约束；加载前验签复用 `orphan_guard.rs` 的 `verify_artifact`。
- **超越轴**：可测性。ABI 契约用桩实现单测钉住 Initialize/Shutdown 配对、重复初始化拒绝、句柄释放；验签失败 fail-closed。
- **最小复现范围**：三函数绑定表 + 初始化/关闭配对 + 句柄回收；不实现具体模块逻辑。

### B2-08 ContextFS 动词面（list/read/write/delete/grep/glob）+ 传输超时与 trace 透传

- **证据**：
  - `C:\Trae CN\resources\app\modules\ai-agent\bin\ctx-cli.exe`（PDB `ctx_cli.pdb`）字符串：标题 `CliContextFS CLI - AI Agent Context Management`；子命令 `ls` / `cat` / `write` / `grep`（参数 `pattern` / `ignore_case` / `limit` / `json`）；虚拟路径校验串 `-path must be a context:// virtual path`。
  - 传输与协议：gRPC 方法 `/command.CommandService/Execute`；`ContextFS uds/gRPC request timed out after 30s`；`$ContextFS gRPC command failed (code`；`ContextFS uds/gRPC transport failed:`。
  - trace 头：`cfs_process_token` / `CFS_TRACE_ID` / `contextfs_trace_id` / `CFS_TRACEPARENT` / `contextfs_traceparent`；工具命令 ID `icube.common.commands.tooling.contextfsGlob` / `contextfsGrep` / `readFile` / `writeFile` / `createFile` / `deleteFile` / `listFolder`。
  - 复核命令：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iz" "C:\Trae CN\resources\app\modules\ai-agent\bin\ctx-cli.exe"`，过滤结果存 `_scratch\trae\str-ctx-cli.txt`。
- **三档**：观察=命令名、超时值、trace 头名、命令 ID 串。推断=上下文产物（会话/记忆/产物/技能）挂到 `context://` 虚拟命名空间，经本地 UDS/gRPC 暴露文件树动词；每次请求带进程令牌与追踪上下文。未知=虚拟目录层级、每动词权限模型、30s 超时是否可配未判定。
- **IHUI 现状**：已有虚拟路径抽象与鉴权：`C:\IHUI-AI\apps\ai-service\app\core\context_fs.py`（`context://` 解析 + allowed/denied/unjudged 三态 verdict，解析与鉴权同一次调用完成）、`C:\IHUI-AI\apps\ai-service\app\services\knowledge_fs.py`、测试 `C:\IHUI-AI\apps\ai-service\tests\test_context_fs.py`。追踪中间件 `C:\IHUI-AI\apps\ai-service\app\middleware\trace_context.py`。结论=**部分覆盖**：虚拟路径解析/鉴权与追踪有；文件树动词处理器（list/read/write/delete/grep/glob）经通道暴露、请求超时显式入参、trace 头透传到工具面无。
- **落点建议**：在 `context_fs.py` 之上补 ContextFS 动词处理器（挂到 ai-service 现有路由），复用 `trace_context.py` 透传 trace 标识；产物与索引数据落 PostgreSQL，不新增本地状态库。
- **超越轴**：PostgreSQL 统一数据层替代 sqlite；可测性。每个动词注入半态/越界路径，断言返回 denied/unjudged 且不回落宿主 FS 路径；超时分支有显式原因码。
- **最小复现范围**：虚拟路径 → 动词分派 → 超时 + trace 透传 → 结构化 verdict；不另起本地守护进程。

### B2-09 本地代码知识图谱守护：索引幂等标记 + 管线步骤 + 完整性统计（sqlite_vec → pgvector 替代）

- **证据**：
  - `C:\Trae CN\resources\app\modules\ckg\start.bat` 启动参数：`-port=%PORT0%`、`-ide_version=`、`-version_code=2`、`-storage_path="%ICUBE_MODULAR_DATA_DIR%\ckg_server"`、`-local_embedding`、`-embedding_storage_type=sqlite_vec`、`-app_id=`、`-limit_cpu=1`、`-source_product=`；`meta.json` socket port 50000。
  - `libckg.dll` 导出 `BP_GetInterface/BP_Initialize/BP_Shutdown` 与 Go 桥接 `go_on_connected` / `go_on_disconnected` / `go_on_message` / `go_bp_ipc_client_on_message`；导出 `sqlite3_vec_init` / `sqlite3_vec_numpy_init` / `sqlite3_vec_static_blobs_init`。
  - 配置与统计串：`embedding_model`（默认 `codekg_bge_m3`）、`embedding_strategy`、`embedding_chunk`、`embedding_recall_num`、`embedding_rate_limit`、`embedding_recall_timeout`、`embedding_search_config`；幂等标记 `HasAlreadyLocalEmbeddingAtDisk` / `HasAlreadyLocalEmbeddingAtRuntime` / `HasAlreadyRemoteEmbeddingIndexedAtDisk` / `HasAlreadyRemoteEmbeddingIndexedAtRuntime`；管线 `IndexPipelineDSL` / `pipeline_steps` / `TaskQueue`；统计列 `vector_to_entity_count` / `total_embedding_entities` / `missing_vector_entity_count` / `embedding_db_path` / `embedding_db_type`；健康 `HealthResponse` / `Unhealthy` / `healthCheckConfig` / `trae://healthy`；gRPC 路径 `/protocol.CodeKG/Retrieve...`。
  - 复核命令：`& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iE" "C:\Trae CN\resources\app\modules\ckg\binary\libckg.dll"`；字符串扫描存 `_scratch\trae\str-libckg.txt`。
- **三档**：观察=启动参数、配置键、默认模型名、统计列名、健康串、导出符号。推断=常驻本地守护按项目增量建索引，本地/远端嵌入两种策略带磁盘+运行时双层幂等标记；管线由步骤队列驱动；检索前走健康探测。未知=向量维度（BGE-M3 常见 1024 维为外部常识，**未在二进制中观测到维度字面量，记未知**）、代码实体/关系 schema、单例互斥机制、索引触发时机（文件监听或全量重建）未判定。
- **IHUI 现状**：代码切片语义索引已有，`C:\IHUI-AI\apps\api\src\services\codebase-index-service.ts:10`（query embedding → pgvector ANN → top-K，增量先删旧后插新，`getStats` 统计切片数/文件数/已向量化数）；嵌入抽象 `C:\IHUI-AI\apps\api\src\services\embedding-provider.ts`（DashScope / OpenAI 1536 维 / MiniMax，缺 provider 降级关键词匹配）；原生文件监听 `C:\IHUI-AI\apps\ai-service\app\services\sag2_lexical\fs_watch.py`（ReadDirectoryChangesW/inotify，debounce 合并，缓冲溢出转全量）；文档图谱 `C:\IHUI-AI\packages\database\src\schema\knowledge-graph.ts`（实体/关系边，LLM NER 抽取）；RAG 三通道融合 `C:\IHUI-AI\apps\ai-service\app\api\v1\rag.py`。结论=**部分覆盖**：切片向量检索、增量更新、文件监听、文档级图谱已有；端侧本地嵌入模型、代码符号级实体/关系边、常驻守护健康面、缺向量实体审计统计无。
- **落点建议**：不新起本地 sqlite 守护；在 `codebase-index-service.ts` 补索引完整性审计（对照 `missing_vector_entity_count` / `vector_to_entity_count` / `total_embedding_entities` 三列语义）；代码实体/关系边复用 `knowledge-graph.ts` 的实体-关系表模式扩展；索引配置（chunk/recall_num/rate_limit/recall_timeout/向量来源）落 PG 表。
- **超越轴（强制）：sqlite_vec → PostgreSQL/pgvector 统一替代**。TRAE 方案把向量存本地 `sqlite_vec` 虚拟表 + 独立 `storage_path` 目录，与业务库分裂；IHUI 数据层唯一允许 PostgreSQL，等价语义映射：① 向量列 + pgvector ANN 索引（HNSW/IVFFLAT）替代 sqlite_vec 虚拟表；② 嵌入元数据（模型名、chunk、召回数、限流、超时、向量来源 local/remote）落 PG 结构化列；③ 幂等标记从磁盘标记文件改为 PG 布尔/时间戳列（磁盘态 + 运行时态双层语义保留）；④ 检索按 `owner_uuid + repo_id` 双重隔离（沿用现有 `_ownerScope`）。测试：同一仓库重跑索引两次，向量行数不翻倍；缺向量实体可被统计查询检出。数据层现状核对：`apps\api\src` Grep `sqlite3.open|better-sqlite3|DatabaseSync|sqlcipher` → 0 命中；`apps\ai-service\app` 内 `sqlite3` 仅出现在第三方库只读解析（`browser_hub.py:331` 读浏览器 Cookies 副本、`importers\cursor.py:28` 读 Cursor `.vscdb`），自有状态库 `session_store.py` / `approval_persistence.py` / `sso_identity_store.py` 均经 `app.core.pg_sync` 走 PostgreSQL；`.db` 文件名常量为遗留哨兵，不落本地文件。
- **最小复现范围**：索引完整性统计 + 代码实体关系边表 + 配置项 PG 化；端侧本地嵌入模型与常驻守护本轮不做。

### B2-10 沙箱生命周期与拦截行为埋点（进程清点 / 管道重定向计数 / 崩溃事件）

- **证据**：
  - `sbox_sdk.dll` 字符串：`[sdk] create recycle snapshot thread failed`、`recycle snapshot worker exit timed out after 3000 ms; terminating thread`、`[sdk] recycle snapshot status={} ownedBytes={} totalBytes={} ownedICount={} ownedRCount={} volumesScanned={} volumesFailed={} invalidItems={}`、`mgr KillAllProcess` / `GetAliveProcessInfos` / `FlushStatistics` / `UpdateHostConfig`（未找到沙箱时分别报 `sandbox not found`）。
  - 事件/计数键：`sandbox_init_info` / `sandbox_action` / `sandbox_kill_process` / `sandbox_block_info` / `sandbox_block_info_item` / `block_sandbox_drop_count` / `block_priority_sandbox_drop_count` / `block_sandbox_risk_reserved_drop_count` / `block_sandbox_duplicate_count` / `trash_sandbox_drop_count` / `sandbox_used_info` / `sandbox_sdk_crash` / `sandbox_recycle_snapshot` / `sandbox_forward_connect`；`vm_sdk.dll` 另见 `vm_trace` / `vm_trace_record` / `pipe_redirect_counts` / `pipe_whitelist_bypass_counts`。
  - `trae-sandbox.exe` 崩溃事件：`{"event_name":"sandbox_sdk_crash","categories":{"code":"","pid":""},"metrics":{}}`，文案 `SDK not initialized` / `SDK already initialized` / `SDK initialization failed` / `Sandbox not supported` / `CreateSandbox failed`。
- **三档**：观察=事件名、计数键、超时串、崩溃事件 JSON 模板。推断=沙箱建销、进程拦截、管道重定向、崩溃全部进结构化行为事件流，带计数与 PID/错误码。未知=上报后端、事件保留期、采样率未判定。
- **IHUI 现状**：Grep `sandbox_action|pipe_redirect|sandbox_kill|recycle snapshot|vm_trace`（`apps\desktop\src-tauri\src`）→ **0 命中**。现有可观测面为出口门告警 `C:\IHUI-AI\apps\desktop\src-tauri\src\egress_gate.rs` 与 `C:\IHUI-AI\apps\ai-service\app\services\publish\metrics_collector.py`。结论=**完全没有**沙箱行为埋点面。
- **落点建议**：与 B2-01 同一沙箱薄面补事件输出口，新增 `C:\IHUI-AI\apps\desktop\src-tauri\src\sandbox_metrics.rs`；事件名走本仓结构化 verdict/原因码惯例，PID/code 脱敏后上报。
- **超越轴**：可测性。建/销、拦截放行、崩溃三类事件各钉一条测试；计数键可对账（拦截数 = 放行 + 拒绝 + 保留各分项之和）；崩溃事件不带凭据。
- **最小复现范围**：生命周期事件 + 拦截计数 + 崩溃事件模板；上报后端复用现有 metrics 通道。

### B2-11 会话快照版本链对照补只读面（按 message_id 反查版本 + 文件 diff 清单）

- **证据**：
  - `ai_agent.dll` 字符串（SnapshotHandler 方法名）：`create_new_version` / `update_snapshot` / `clean_up_snapshot` / `revert_check` / `revert` / `review` / `get_snapshot_id_by_message_ids` / `get_file_list` / `delete_snapshots` / `get_message_ai_edit_file_diff`；会话删除 `delete_session: clean_up_snapshot_v2`；停止处理 `chat_stopped_handle: skip snapshot finish because completed Ralph Loop already finished before Done`。
  - `harness.dll` 旁证：`SnapshotHandler start snapshot handler`、`PluginMcpSnapshot`、`clean_up_snapshot_v2`；字符串另见 `required for desktop SQLite snapshots`（对照方本地快照落 SQLite，与本仓禁令冲突，列入超越轴）。
- **三档**：观察=方法名串逐字命中。推断=每回合落快照版本，可按消息 ID 反查快照、列文件版本、取 AI 编辑文件 diff，过期快照清理；会话结束时已完成的回合跳过快照收尾。未知=快照存储介质细节、保留策略、版本链并发模型未判定。
- **IHUI 现状**：已有会话回滚链路，`C:\IHUI-AI\apps\ai-service\app\routers\checkpoint_rewind.py:11-14`：`GET /api/checkpoints?session_id=` 可回滚列表、`GET /api/checkpoints/file-versions?session_id=&path=` 文件版本清单、`POST /api/checkpoints/{id}/restore`（对话历史 + 迭代数 + tool_state + 可选文件回滚）；管理面 `C:\IHUI-AI\apps\ai-service\app\services\agent_checkpoint.py`；文件回滚 `file_editor.snapshot_file` / `rollback_file`。结论=**已有等价**：版本链与回滚在仓内落地；缺「按 message_id 反查快照版本」与「消息维度文件 diff 清单」两个只读面。
- **落点建议**：不新增存储；在 `checkpoint_rewind.py` / `agent_checkpoint.py` 补两个只读查询：按 message_id 反查快照、按消息列 AI 编辑文件 diff；数据全部落 PostgreSQL。
- **超越轴**：PostgreSQL 统一数据层。对照方桌面快照走本地 SQLite，本仓快照/版本/文件版本只落 PG；测试钉住两次 restore 后行数不变、归属校验拒他人会话（对齐鉴权纪律）。
- **最小复现范围**：两个只读查询 + 归属校验；不改动现有回滚写入路径。

## 未做 / 未判定

- **全量反编译未做**：`ai_agent.dll`（约 284MB）、`harness.dll`（约 266MB）、`toolhost.dll`（约 100MB）、`agent-tool-host.exe`（约 101MB）仅取导出表 / 导入表 / 定向字符串；未做函数级还原。Ghidra 逐函数分析未做（本机 CLI 能力面 ghidra 未注册，本轮也未启用原生反编译）。
- **未运行对照程序**：TRAE 本体及其全部 dll/exe 均未执行；未启动 ckg 50000 端口服务、未连其 IPC。
- **ckg 未判定项**：向量维度字面量未在字符串面命中；代码实体/关系图谱 schema 未取到；单例/互斥机制未命中明确串；索引触发方式（文件监听 vs 全量重建）未判定；`codekg_bge_m3` 对应的模型文件与运行时未取证。
- **sandbox 未判定项**：VM 后端技术（Hyper-WHP / Hyper-V / 其它）未知；Detours 注入与远程线程细节未知；ALPC 与命名管道各自承载的链路未拆分；安全描述符具体 SDDL/ACL 主体未取到。
- **ai-agent 未判定项**：BP ABI 函数签名与内存布局未知；ctx-cli 完整子命令参数表因 clap 内嵌串粘连未逐枚还原；`/command.CommandService/Execute` 之外的消息帧格式（thrift/protobuf 编码细节）未拆解；远端 agent 令牌交换与刷新流程未取证。
- **模块边界**：`modules\browser-bridge` 本轮未取证（不在三块范围内）；`libckg.dll` 内嵌 Kafka/ahanet 远端链路细节未展开。
- **工具使用**：craft-anything CLI 0.5.0 已就位（`C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe`），本轮未调用其 `js-app-map` / `pe-resources-list` / `commands` 深扫；导出表与定向字符串面已足够支撑本清单。
- **仓内核验边界**：IHUI 现状结论基于本轮 Grep/Read 命中；未跑 typecheck/测试/dev 服务，未改动仓内任何源码文件。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
