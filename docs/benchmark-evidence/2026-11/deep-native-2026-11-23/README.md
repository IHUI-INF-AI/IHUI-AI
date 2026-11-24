<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 深水区原生能力测绘（2026-11-23）：四程序「尚未被吸收的可复现设计」

> 对照程序：DeepSeek Harness 0.2.2-rc.5 · TRAE CN 3.4.20 · Qoder CN 0.5.14 · WorkBuddy 5.11.3
> 本轮口径：**只产出清单与证据**。未改 IHUI 任何源码，未 commit/push，未跑 dev/build/typecheck/测试；
> 未运行四个目标程序本体，未破解许可证，未提取任何凭据/token/登录态。
> 取的是**行为与设计**，不是代码原文：全文无超过 10 行的对方源码连续片段。

每条候选固定六栏，缺一栏的不进清单：
**证据**（绝对路径 + 符号/字符串/协议名 + 可复核命令）· **三档**（观察 / 推断 / 未知）·
**IHUI 现状**（真跑过的 grep 结果与命中文件）· **落点建议**（绝对文件路径）·
**超越轴**（可测性 / PostgreSQL 统一数据层替代 sqlite / fail-closed 边界 / 零缺省行为变化）· **最小复现范围**。

分块全文（逐条六栏原始版）：
[`block1-dsh.md`](block1-dsh.md) · [`block2-trae.md`](block2-trae.md) ·
[`block3-qoder.md`](block3-qoder.md) · [`block4-workbuddy.md`](block4-workbuddy.md)。
本文是四块的**去重、排序与裁决结果**；凡本文与分块冲突，以本文为准并在 §3 留痕。

---

## 0. 一句话结论

44 条候选里，真正值钱的是 IHUI **结构性缺的四个底层件**，而不是再抄一个功能：
反向守护进程拓扑（B4-01）、跨进程注册表三判据（B4-04/B3-01）、终态前输出完成闸门（B1-02/B2-03/B3-08）、
沙箱能力探测 fail-closed 平行面（B2-01）。另有一处**语义反向的坑**必须先拆：IHUI 的
`approval_policy = "never"` 是「恒免审放行」，与 DeepSeek Harness 的 `never`（确定性拒绝）**方向相反**，
直接照搬档位名会把 fail-closed 改成 fail-open。

## 1. 硬数字（本轮到量，非累计）

| 程序 | 版本 / 安装根 | 本轮取证面 | 粒度上限 | 候选 | A / B / C |
|---|---|---|---|---|---|
| DeepSeek Harness | 0.2.2-rc.5 / `C:\Apps\DeepSeekHarness` | `app.asar`（约 199MB）+ `app.asar.unpacked\dsh\node_modules\@deepseek-ai`（336 包） | asar 内文本与符号；未反编译 | 11 | 3 / 7 / 1 |
| TRAE CN | 3.4.20 / `C:\Trae CN` | `modules\{ai-agent,ckg,sandbox}`（`browser-bridge` 未碰） | 导出表 / 导入表 / 定向字符串 / 启动脚本 | 11 | 6 / 4 / 1 |
| Qoder CN | 0.5.14 / `C:\Qoder CN` | `qoder-cn-agent-sdk`（proto 明文 + 混淆 worker）、5 个原生 `.node`、`native-messaging-host`、`collaboration-cli` | proto 明文全读；混淆产物只到字符串级 | 10 | 4 / 5 / 1 |
| WorkBuddy | 5.11.3 / `C:\workbuddy` | `cli\bin\{daemon-supervisor,no-orphans,windows-job,startup-profile}`（全读）、`cli\dist\codebuddy-lite-wb.mjs`（12.8MB，关键词切片）、`vendor\sandbox\5.11.4\tsbx_rules.json`（全读） | JS 策略面全读；原生 `.node` 未反编译 | 12 | 6 / 5 / 1 |
| **合计** | — | — | — | **44** | **19 / 21 / 4** |

**能力探测的诚实边界**：284MB `ai_agent.dll`、266MB `harness.dll`、100MB `toolhost.dll`、101MB
`agent-tool-host.exe` 的**全量反编译未做**，Ghidra 逐函数还原未做（craft-anything CLI 的 capabilities 里
`ghidra found=false`，本轮也未启用原生反编译）。所有原生结论止于导出表 + 导入表 + 定向字符串；
凡「VM 后端是 Hyper-V 还是别的微虚拟机」这类，一律记「未知」，不进「观察」。

## 2. 结论摘要（按价值排序，8 条）

1. **审批语义必须先收敛再谈复现**（P0-1）。IHUI 现存两套字面量：`("never","on-request","always")`
   （`apps\ai-service\app\services\agent_loop_v2.py:2905`）与 `never/on_request/unless_trusted/
   granular_sandbox_approval`（`app\core\patch_safety.py:42-45`），中间靠 `agent_engine.py:889`
   的 `"on-request" → "on_request"` 映射表桥接；而 `agent_engine.py:920` 是
   `.get(..., "on_request")` —— **未知档位静默变成 on_request 而不是拒收**。同时
   `patch_safety.py:132-134` 明写「never: 覆盖 writable_roots / 沙箱检查，恒 auto-approve」，
   与对照方 `dsh-user-approval` 的 `never`（每个 ask 确定性拒绝）**方向相反**。三条一起看：
   直接抄档位名 = 把 fail-open 抄得更彻底。
2. **反向守护进程拓扑是 IHUI 缺的那一半**（P0-2）。WorkBuddy 的 supervisor「never joins a worker's Job」，
   以 `detached:true + windowsHide + unref` 拉起 daemon，按请求 id 配对握手，名下无 worker 即自退；
   IHUI 只有 `apps\cli\src\util\parent-bound.ts`（父死子随死的**正向**看门狗）。现有 Job Object 体系
   只解决了「别留孤儿」，没解决「主进程没了服务还得活」。
3. **跨进程注册表是四程序的共同缺口，且应一次落成**（P0-3）。WorkBuddy 用 `<pid>.json` / `manual-*.json`
   + 存活 / 身份 / 端口三判据 + 陈旧回收；Qoder 用 `~/.qoder/browser-connector/clients` + 30s stale
   + `process.kill(pid,0)`（EPERM 视为存活）。IHUI 现状只有内存 Map（`apps\cli\src\tools\background-registry.ts`，
   头注「只报不恢复」）与 `serve.ts` 的 8841 `strictPort` 占用即失败。两块合成一条落点，数据落 **PG** 而非散落 json。
4. **「输出读完才提交终态」是一条跨程序反复出现的工程原则**（P0-5）。Trae 的 `agent-tool-host.exe` 明串
   「terminal commit requires terminal status with complete output」，DSH 用「模型游标 + 观察者绝对偏移」
   双读 + 窗口外标 lossy，Qoder worker 用 `ready / exit / error` 四态子通道。IHUI 的
   `background_tasks.py` 只有生命周期（pending/running/…/cancelled + journal + 幂等），
   `terminal_session.rs` 有七态 + 环形缓冲，但**都没有「输出 drain 完成」这道闸门**。
5. **沙箱要分层，四层互不替代**（P0-4 / P0-6 / P1 B4-07 / P2 B2-10）。能力探测（Trae 的
   `SBoxSDK_IsSBoxSupported` / `VMSDK_IsVMSupported` + 12 个不支持原因码，不支持即拒）、
   规则族（WorkBuddy 把 `%USERPROFILE%\.ssh\**` / `.gnupg\**` 读写删全 deny + 开发缓存 allow +
   浏览器进程白名单）、网络双层（DNS hook 拦域名、TCP 交常驻 LocalProxy）、行为埋点（事件名 + 计数键）。
   IHUI 目前是单层：Job Object + 仅工作区相对形态的 `.ssh/**` deny。
6. **最容易吃到「超越」红利的是数据层统一**（P0-8）。Trae CKG 把向量存本地 `sqlite_vec`
   （`-embedding_storage_type=sqlite_vec` + 独立 `-storage_path`），IHUI 已是 pgvector + PostgreSQL。
   所以落点不是「再造一个 CKG 守护」，而是把它的**索引完整性审计语义**
   （`missing_vector_entity_count` / `vector_to_entity_count` / `total_embedding_entities`）
   搬到 `codebase-index-service.ts`：纯增益、零新增存储、并顺手把「同一仓重跑两次向量行数不翻倍」变成可断言的测试。
7. **上下文自检是性价比最高的一条**（P0-7）。Trae 的 `modules\ai-agent\checkpoint.sh` 把
   「这次调用工具之前，上下文里还有没有关键原文（而不是压缩摘要/截断）」做成了自检钩子，缺失就回源重读。
   IHUI 压缩链路齐全（多份 compaction 测试在跑），但 `agent_loop_v2.py` 里只有三处注释、
   没有调用前指纹校验。S 档、单文件、可测性极高。
8. **别把当己有**：本轮实证确认 IHUI **已有等价或已超越** 的 11 处（见 §3 末「不重复造」清单），
   其中 `apps\extension\lib\native-messaging-protocol.ts` 的判据层（具名拒绝原因族 + lease + 差分广播）
   比 Qoder 的浏览器桥判据更严，缺的只是**落地侧**（stdio host 进程 + 注册表写方 + 真 `connectNative`）。

## 3. 跨块冲突与去重裁决

| 主题 | 卷入条目 | 裁决 |
|---|---|---|
| 进程注册表 | B4-04（daemon pid json）+ B3-01（browser-connector clients） | **合并为一个落点**：注册表 + 三判据 + 陈旧回收走 PG；B3-01 只保留其独有部分（host 侧 fail-closed 来源校验）。理由：两者判据同构（存活/身份/时效），分两处实现即第二真相源 |
| 沙箱 | B2-01 / B4-06 / B4-07 / B2-10 | **四层分列不合并**：能力探测、文件规则、网络边界、行为埋点对象不同；B2-10 是 B2-01 的输出口，落点同文件族 |
| 重试与看护 | B1-07（LLM provider）/ B2-04（外部服务连接 watcher）/ B4-11（子进程崩溃重启）/ B4-05（优雅自重启） | **四条不同对象，一个退避出口**：分别落 providers / services / cli-subagents / cli-daemon，退避一律复用 `apps\cli\src\acp\backoff.ts` 与 `app\core\retry_after.py`，禁止再写第四份退避 |
| 审批 | B1-04（结局封闭集）+ B2-05（命令级 timeout_ms） | **同一语义域**，本文合成 P0-1；底层档位表按 §2.1 先收敛到单一真相源 |
| 输出终态 | B1-02 / B2-03 / B3-08 | **一条原则三种载体**：P0-5 取 B1-02 为主动条目（后端），B2-03 落 Rust 侧终端、B3-08 落 CLI 行协议，三者共享「drain 完成才提交终态」判据语义 |
| 启动面 | B4-08 / B4-09 / B4-10 / B4-03 | 同族，全部进 P2，不抢占 P0 预算 |
| 已有等价（不重复造） | B3-02 进程组判活（`terminal_session.rs` 的 `killpg` + Job Object 已更稳）· B2-11 快照回滚（`routers\checkpoint_rewind.py` 已有）· `atomic_io.py` / `file_read_state.py` / `acp_bridge.py`（DSH 三组的等价件）· `apps\extension\lib\native-messaging-protocol.ts`（判据层已超越）· `terminal_session.rs` Job Object 与 `orphan_guard.rs`（已超越 WorkBuddy 原设计）· `env-inject.ts`（已显式声明「刻意不起常驻 LocalProxy 载体」） | **保留原 ID、降级为对照记录**，不进 P0/P1 |

## 4. P0：先落地 8 条（六栏全文）

### P0-1 审批语义收敛：结局封闭集 + 确定性拒绝档 + 未知值拒收 + 命令级 timeout_ms
（来源 B1-04 + B2-05）

- **证据**：`C:\IHUI-AI\apps\ai-service\app\services\agent_loop_v2.py:2905`（`_VALID_APPROVAL_POLICIES`）、
  `:8684-8690`（`approval_policy_always` / `approval_policy_never` 事件名）、`:8686` 起「never 强制免审(高危清单也放行)」；
  `C:\IHUI-AI\apps\ai-service\app\core\patch_safety.py:42-45`（四档常量）、`:132-134`（never 恒 auto-approve）；
  `app\services\agent_engine.py:889`（`"on-request": "on_request"` 映射）、`:920`（未知值缺省 `on_request`）。
  对照方：`/dsh/node_modules/@deepseek-ai/dsh-user-approval/src/index.ts`（结局 `allowed-once / rejected /
  cancelled / unavailable`，缺 answerer 或抛出 → `unavailable`，rogue 返回值归一）；Trae
  `ai_agent.dll` 的 `ExecuteCommandRequest.timeout_ms` 与 `AutoRunConfig{AlwaysAsk,Whitelist,AlwaysRun}`。
- **三档**：观察＝上述行号实现实读、两套字面量并存、映射表存在；推断＝`:920` 的缺省值使非法档位
  静默降级为 on_request（fail-open 而非拒收）；未知＝所有端点是否都过映射表（未逐端点核）。
- **IHUI 现状**：`Grep "allowed-once" apps\ai-service\app` → 无命中；`Grep "timeout_ms|timeoutMs" agent_runtime.py` → 无命中。
  结论＝**部分覆盖**：档位、授权持久化（`approval_persistence.py` 的 `approval_grants` / `exec_prefix`）、
  CAS/owner/超时守卫已有；缺结局四态封闭集、确定性拒绝档、缺答者 fail-closed、asked/decided 审计对同 turn 闭合、命令级超时强制中断。
- **落点建议**：改造 `apps\ai-service\app\services\agent_loop_v2.py`（结局枚举 + 归一 + 拒绝档）与
  `app\core\patch_safety.py`（档位表收敛为单一真相源）；`app\routers\agent_runtime.py` 补 `timeout_ms` 入参与中断；
  `app\services\approval_persistence.py` 补一次性授予语义。
- **超越轴**：fail-closed 边界。非法/未知档位**拒收**而不是落到 on_request；无答者 → `unavailable` 不放行；
  `never` 语义单向定死（若保留 IHUI 现有「免审」语义，必须改名，不得与拒绝档共用一词）。
  测试：夹具以非法档调用，断言拒绝且无副作用；成对留正向对照（对齐仓库「认证不等于授权」纪律）。
- **最小复现范围**：四态结局封闭集 + 确定性拒绝档 + 未知值拒收 + 命令级 `timeout_ms` 与超时中断；不改现有 ask 链路的对外语义。

### P0-2 反向守护进程拓扑：独立 supervisor + IPC 请求-应答握手 + 无 worker 自退
（来源 B4-01）

- **证据**：`C:\workbuddy\resources\app.asar.unpacked\cli\bin\daemon-supervisor.cjs`：单例键
  `Symbol.for('codebuddy.daemon-supervisor')`、通道键 `CODEBUDDY_INTERNAL_DAEMON_CHANNEL`、守卫旗标
  `--internal-daemon-supervisor`；`start()` 用 `detached:true, windowsHide:true,
  stdio:['ignore','ignore','ignore','ipc']` + `unref()`；`spawnDaemon()` 发 `start-daemon`、60s 保活轮询直到
  `daemon-started` 且 id 配对，`disconnect` 即判启动失败；`listen()` 准入要求 argv 含 `--serve` 且
  `CODEBUDDY_SESSION_KIND === 'daemon'`，否则回「Supervisor only starts daemon workers」；`handedOff` 一次性交接，
  workers 空且父通道断即自退；同文件头注「never joins a worker's Job」；`daemon-supervisor.test.cjs` 三条行为旁证。
- **三档**：观察＝spawn 选项、消息类型、准入校验、自退条件、测试断言；推断＝supervisor 是与 worker Job
  分离的反向守护者；未知＝JS 面无 `DETACHED_PROCESS` / `CreateMutex`（bundle 内 0 命中），原生层是否另有分离原语未判定。
- **IHUI 现状**：`Select-String 'spawnDaemon|start-daemon|daemon-started|handedOff'` 于 `apps\cli\src` +
  `apps\desktop\src-tauri\src` → **0 命中**；已有 `apps\cli\src\util\parent-bound.ts` 是「父死子随死」的正向形态。结论＝**完全没有**。
- **落点建议**：新增 `apps\cli\src\daemon\supervisor.ts`（握手状态机纯判据 + 薄进程 runner）；
  desktop 需要原生承载时新增 `apps\desktop\src-tauri\src\daemon_supervisor.rs`（复用 `terminal_session.rs` 的 Job 装配，
  但**不加入** worker 的 Job）。
- **超越轴**：可测性 + PostgreSQL 统一数据层。握手配对/超时/断开/交接全落纯判据，注入假 IPC 通道与假时钟断言；
  守护拓扑与 worker 归属落 PG 注册表（替代内存 Map），重启后可对账。
- **最小复现范围**：守护者不加载业务 bundle；独立通道收拉起请求；校验命令形态与会话类型后派生 daemon；
  按请求 id 等应答，超时/断开显式失败；名下无存活 worker 即自退。

### P0-3 跨进程注册表：三判据（存活 / 身份 / 端口）+ 陈旧回收 + PG 落账
（来源 B4-04 + B3-01 注册表部分）

- **证据**：`cli\dist\codebuddy-lite-wb.mjs` L2766/2786 切片：条目名匹配 `^(\d+|manual-.+)\.json$`、`kind==='daemon'`、
  `findRunningDaemon` 依次过 `kill(pid,0)` / `isProcessIdentityCurrent` / `remoteHostId` 过滤、默认 `9527` /
  `127.0.0.1`、`waitForPidFile` 带截止时间；L605 切片：锁文件 pid 不活或端口不通即 `unlink`。
  `C:\Qoder CN\resources\native-messaging-host\qoder-app-host.cjs`：`clients` 目录、`staleAfterMs=30_000`、
  `futureTimestampToleranceMs=5_000`、字段 `{ id, port, pid, timestamp }`、`process.kill(pid,0)` 且 `EPERM` 视为存活、
  timestamp 倒序 + id 字典序优选、畸形帧回 `invalid_request`。
- **三档**：观察＝条目命名、三判据顺序、默认端口、恢复动作、字段名；推断＝注册表同时承担单例探测与状态发现；
  未知＝条目写入原子性（临时文件+rename？）与并发写互斥、manual 心跳周期未量到。
- **IHUI 现状**：`Select-String 'pid.json|isPortOpen|configuredPort'` → 0 命中；`apps\cli\src\tools\background-registry.ts`
  是模块级 Map + `background-ledger`（头注「只报不恢复」，重启判 `detached-unknown`）；`apps\cli\src\commands\serve.ts`
  端口 8841、`strictPort` 占用即失败、无单例探测。结论＝**部分覆盖**。
- **落点建议**：新增 `apps\cli\src\daemon\registry.ts`，判据纯函数化，存储落 **PostgreSQL**（不另起 json 目录）；
  浏览器桥侧的注册表复用 `apps\extension\lib\native-messaging-protocol.ts` 既有判据（已超越，勿另写）。
- **超越轴**：PostgreSQL 统一数据层（重启可对账、能识别被复用的 pid，不再依赖散落 json 文件）+ 可测性
  （存活/身份/端口三谓词全部注入：「身份不当前不命中」「端口不通判陈旧」）。取不到输入落「未判定」，不冒绿。
- **最小复现范围**：登记（pid / 身份 / 端口 / host / kind / 时刻）→ 存活→身份→host 顺序过滤 →
  启动前查在跑实例 → 周期清理陈旧条目。

### P0-4 沙箱能力探测平行面：支持 / 不支持 / 未判定三态，不支持即拒
（来源 B2-01）

- **证据**：`C:\Trae CN\resources\app\modules\sandbox\sbox_sdk.dll` 导出 `SBoxSDK_Init` / `InitV2` /
  `IsSBoxSupported` / `CreateSandbox` / `GetSBoxInfo` / `Action` / `GetLastError` / `UnInit`；
  `unified\vm_sdk.dll` 同型 `VMSDK_*`；`trae-sandbox.exe` 命中 12 个原因码
  `OSFailed / FileMissX64Ipc / FileMissX64Biz / FileMissX86Ipc / FileMissX86Biz / SignatureFailed /
  FileVersionMismatch / WineNotSupported / ArchUnsupported / ShmUnavailable / UdsUnavailable` 及
  `is_sbox_supported returned` / `SDK not loaded`。复核：`rizin -qc "iE" <dll>`。
- **三档**：观察＝导出名与枚举串逐字命中；推断＝SBox 对应作业/容器级、VM 对应微虚拟机级，两套接口形态平行；
  未知＝VM 后端技术（Hyper-V / WHP / 其它）、内部隔离边界（未反编译）。
- **IHUI 现状**：`Grep 'hyperv|microvm|HostCompute|ALPC|security descriptor'` 于 `apps\desktop\src-tauri\src` → **0 命中**；
  现有隔离只有 `terminal_session.rs`（`CreateJobObjectW` / `AssignProcessToJobObject`）与 `orphan_guard.rs`。结论＝**完全没有**平行隔离面。
- **落点建议**：新增 `apps\desktop\src-tauri\src\sandbox_sdk.rs`（trait：`init / is_supported / create / action /
  kill_all / get_alive_infos / uninit`）；作业级实现直接复用 `terminal_session.rs` 的 Job Object，VM 级只留探测桩与原因码。
- **超越轴**：fail-closed 边界。任一不支持原因码命中即**拒绝执行**，不得回落裸跑；测试钉住每个原因码 +
  「不支持时不创建进程」的副作用断言。
- **最小复现范围**：统一 trait + 三态探测 + 作业级实现；不做 VM 后端。

### P0-5 终态前输出完成闸门：双游标 + lossy 标记 + drain 完成才提交
（来源 B1-02；同族 B2-03 / B3-08）

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-jobs/src/index.ts` 的 `JobRegistry`
  （`start/list/get/read/readAt/kill/wait/remove/attachController`）、模型推进游标与观察者绝对偏移**双读**、
  窗口外读标 `lossy` 不报错、结算 first-wins 后只投递一轮、无控制器的 owner 拒绝接单、job-output 引用计数；
  `agent-tool-host.exe` 明串「terminal commit requires terminal status with complete output」/
  `output drain task failed` / `fetch stdout pipe unavailable`；Qoder `qoder-worker-runtime.obf.mjs`
  的 `ready / exit / error` 四态子通道（`pty.spawn` → `{type:'ready',pid}` → `{type:'exit',exitCode,signal}`）。
  复核：`scripts\benchmark-asar-read.mjs --list "<pkg>/"` + `--get <asar 内路径>`；`rizin -qc "iz"` 后关键词过滤。
- **三档**：观察＝方法名/消息类型/字段/日志串逐字命中；推断＝观察者可无视模型游标推进读绝对偏移，
  任务终态只结算一次、迟到读拿 lossy；未知＝环容量与重启恢复的持久化形态（该包内无落地代码）。
- **IHUI 现状**：`Grep 'offset|cursor|ring|readAt|lossy|attach' app\services\background_tasks.py` → 仅一处「结果规整为可 JSON 化摘要」；
  该文件 540 行只有状态机 + journal 重建 + 幂等键 + 断点续跑 + `MAX_CONCURRENT` + 完成通知。`terminal_session.rs` 有七态 + 环形缓冲但无 drain 闸门。
  结论＝**部分覆盖**。
- **落点建议**：新增 `apps\ai-service\app\services\background_job_registry.py`（有界输出环 + 双游标 + 控制器准入），
  `background_tasks.py` 接入读取面；Rust 侧在 `apps\desktop\src-tauri\src\terminal_session.rs` 补「stdout/stderr 流关闭 +
  限流监控结束才落 Exited」，管道不可用 / 输出超 `RING_BYTES` / 超时三分支各留原因码。
- **超越轴**：fail-closed 边界 + 可测性。无控制器服务的 owner 不得挂输出引用；零缺省语义不变（现有七态对外语义不动）。
- **最小复现范围**：每任务持有界输出环；模型侧游标与观察者绝对偏移分读；窗口外读返回 lossy；结算只投递一轮；终态闸门三分支。

### P0-6 沙箱文件规则族：home 凭据目录 deny + 开发缓存 allow + 浏览器进程白名单
（来源 B4-06）

- **证据**：`C:\workbuddy\resources\app.asar.unpacked\cli\vendor\sandbox\5.11.4\tsbx_rules.json`：
  `default_action: ask`；`file_rules` 内 `%USERPROFILE%\.ssh\**` 与 `.gnupg\**` 读/写/删**全 deny**；
  Temp / 回收站 / Recent 与 `npm/pnpm/yarn/fnm/pyenv/conda/rustup/cargo/go/m2/gradle/dotnet/docker` 等开发缓存目录 allow；
  `white_process` 浏览器白名单（edge/chrome/firefox/brave/opera/360/QQ/搜狗）；`registry_rules` / `process_rules` /
  `network_rules` 为空表。复核：`Select-String -Pattern 'ssh|gnupg|white_process|default_action'`。
- **三档**：观察＝规则条目、动作档、白名单进程名；推断＝缓存 allow 用于降打扰、凭据 deny 是硬边界；
  未知＝Windows 上经何种原生接口落地、`white_process` 匹配可执行名还是全路径（未动态验证）。
- **IHUI 现状**：`Select-String '.gnupg'` → 0 命中；`apps\cli\src\sandbox\file-access-policy.ts` 的 `.ssh/**` 是**工作区根下相对形态**；
  `apps\cli\src\config\sandbox-profile.ts` 是命令白名单五档（readonly/limited/trusted/open/full），不是路径规则族。结论＝**部分覆盖**。
- **落点建议**：扩 `apps\cli\src\sandbox\file-access-policy.ts` 规则表：home 路径经现成路径出口**现算**（不写死盘符），
  补 `.gnupg` 凭据族；进程白名单另立规则面与文件规则分表。
- **超越轴**：fail-closed 边界。凭据族在**任意 profile** 下均 enforce deny；规则表版本化、每条带 source 与原因；
  测试断言「home 凭据在 open/full 档也被拒」。
- **最小复现范围**：deny 凭据族 / allow 缓存族 / 白名单进程三类；相对项锚工作区、绝对项锚 home；未命中走默认 ask。

### P0-7 回合前上下文自检钩子：关键原文还在不在
（来源 B2-06）

- **证据**：`C:\Trae CN\resources\app\modules\ai-agent\checkpoint.sh`（文本，只读未执行）：要求自问
  「上下文里还有没有 RFC 全文（完整原版，而不是压缩摘要、截断）？如果没有，请重新阅读原 RFC；
  并且下次调用任意工具之前，都需要重新执行这个脚本」；旁证 `harness.dll` 的 `checkpoint.json`。
- **三档**：观察＝脚本文本与 checkpoint 相关字符串；推断＝把「关键原文是否已被压缩/截断出上下文」做成
  每次工具调用前的自检，缺失即回源重读；未知＝脚本在 harness 的接线点、指纹形态（哈希/片段）、自动重读范围。
- **IHUI 现状**：`Grep 'fingerprint|re-read|自检|anchor' app\services\agent_loop_v2.py` → 3 条**均为注释**
  （`:746` / `:8110` / `:8561`），无实现；压缩链路测试齐备（`tests\test_token_compaction*.py`、
  `test_thread_rollout_truncation_wiring.py`）。结论＝**部分覆盖**。
- **落点建议**：`apps\ai-service\app\services\agent_loop_v2.py` 工具调用前挂自检：关键引用记指纹/锚点，
  上下文窗内校验不到即回源重读并留痕。
- **超越轴**：可测性。注入「已截断、锚点缺失」的桩上下文，断言触发回源重读而非直接下发工具调用；重读动作可审计。
- **最小复现范围**：调用前自检 + 缺失重读 + 留痕；不改现有压缩策略本身。

### P0-8 索引完整性审计：把 sqlite_vec 的语义搬进 pgvector
（来源 B2-09）

- **证据**：`C:\Trae CN\resources\app\modules\ckg\start.bat`：`-port=%PORT0%`、`-local_embedding`、
  `-embedding_storage_type=sqlite_vec`、`-storage_path="%ICUBE_MODULAR_DATA_DIR%\ckg_server"`、`-limit_cpu=1`；
  `libckg.dll` 导出 `sqlite3_vec_init` / `sqlite3_vec_numpy_init` / `sqlite3_vec_static_blobs_init` 与 `BP_*` 三函数；
  统计列 `vector_to_entity_count` / `total_embedding_entities` / `missing_vector_entity_count` /
  `embedding_db_path` / `embedding_db_type`；幂等标记 `HasAlreadyLocalEmbeddingAtDisk` / `AtRuntime` /
  `HasAlreadyRemoteEmbeddingIndexedAtDisk` / `AtRuntime`；健康面 `HealthResponse` / `Unhealthy` / `trae://healthy`。
- **三档**：观察＝启动参数、导出符号、配置键、统计列名、健康串；推断＝常驻守护按项目增量建索引、
  本地/远端两种嵌入策略带磁盘+运行时双层幂等标记、检索前先健康探测；未知＝向量维度字面量（二进制内**未命中**，
  BGE-M3 常见 1024 维属外部常识，不采信）、代码实体/关系 schema、单例互斥、索引触发方式（监听 or 全量）。
- **IHUI 现状**：`apps\api\src\services\codebase-index-service.ts:10`（query embedding → pgvector ANN → top-K、
  增量先删旧后插新、`getStats`）；`embedding-provider.ts`（DashScope / OpenAI 1536 / MiniMax，缺 provider 降级关键词）；
  `app\services\sag2_lexical\fs_watch.py`；`packages\database\src\schema\knowledge-graph.ts`（实体/关系边）；
  `app\api\v1\rag.py` 三通道融合。结论＝**部分覆盖**：缺端侧本地嵌入、代码符号级实体边、常驻健康面、**向量完整性审计统计**。
- **落点建议**：`apps\api\src\services\codebase-index-service.ts` 补三列语义的审计查询；
  代码实体/关系边按 `knowledge-graph.ts` 模式扩展；索引配置（chunk / recall_num / rate_limit / recall_timeout / 向量来源）落 PG 表。
- **超越轴（强制）：sqlite_vec → PostgreSQL/pgvector**。等价映射：① 向量列 + pgvector ANN（HNSW/IVFFlat）替代
  `sqlite_vec` 虚拟表；② 嵌入元数据（模型名、chunk、召回数、限流、超时、local/remote）落 PG 结构化列；
  ③ 幂等标记由磁盘标记文件改为 PG 布尔/时间戳列（保留磁盘态 + 运行时态双层语义）；
  ④ 检索继续按 `_ownerScope` 的 `owner_uuid + repo_id` 双隔离。
  测试：同一仓库重跑索引两次，向量行数**不翻倍**；缺向量实体能被统计查询检出。
- **最小复现范围**：审计统计 + 代码实体边表 + 配置 PG 化；端侧本地嵌入与常驻守护本轮不做。

## 5. P1：12 条（次优先，A 档剩余部分）

| ID | 设计 | 证据（可复核） | IHUI 现状 | 落点 | 超越轴 / 代价 |
|---|---|---|---|---|---|
| B1-06 | 目标自动续轮竞争裁决（race fence） | `dsh-goal-round-driver`：`RoundIdentity{goalId,revision,round}`、phase `queued/claimed/admitted`、`validReservation` / `competingQueued` / `pre-step` 前后双次校验 | 部分覆盖（`goal_round_state.py` 只有跨轮计数账本） | `apps\ai-service\app\services\goal_round_driver.py` | fail-closed：竞争/插话置 stale，过期预留拒 admit / L |
| B2-02 | IPC 通道安全描述符 / ACL 边界 | `aiep_ipc.dll` 导出 `CreateIPCInterface2` / `InitIPCInterface2WithSecurityDescriptor`；串「build alpc port security descriptor fail」 | 完全没有（跨端只走 Tauri command，`terminal_ipc.rs` 头注自述） | `apps\desktop\src-tauri\src\ipc_channel.rs`（先登记边界） | fail-closed：SD 构建失败即拒建 / M |
| B2-03 | helper 中继 + 输出 drain 完成判定 | `run_helper.exe` 导入 `CreateProcessW` / `WaitForSingleObject` / `GetExitCodeProcess`；`aiep_sbox.dll` 导出 `DetourFinishHelperProcess` | 部分覆盖（七态 + 环形缓冲，无 drain 闸门） | `apps\desktop\src-tauri\src\terminal_session.rs` | 可测性 + 零缺省 / M |
| B2-04 | 分级看门狗重连（closed→重连 / error→重试 / 瞬态→有限次 / 终局→上抛） | `toolhost.dll`「Connection lost, waiting for reconnect」「[ckg_watcher] connection closed, will reconnect」「connection error, will retry」 | 部分覆盖（模型流重试有，常驻服务 watcher 无） | `apps\ai-service\app\services\connection_watcher.py` | 可测性：四类事件各钉一条 / M |
| B2-05 | 命令级 `timeout_ms` 显式入参 | `ai_agent.dll`：`ExecuteCommandRequest{…,timeout_ms,…}`、`AutoRunConfig{AlwaysAsk,Whitelist,AlwaysRun}` | 部分覆盖（四档审批有，`timeout_ms` 0 命中）→ 已并入 P0-1 落地 | `apps\ai-service\app\routers\agent_runtime.py` | fail-closed：缺省落更严一侧 / M |
| B3-01 | 浏览器桥 native host 落地 + 来源 fail-closed 绑定 | `qoder-app-host.cjs`（4B LE 帧、`staleAfterMs=30_000`、`process.kill(pid,0)`、`relayClientsChanged`）；注册清单 `allowed_origins` 绑两个扩展 id | 部分覆盖：判据层 `apps\extension\lib\native-messaging-protocol.ts` 已超越，缺 host 进程/注册表写方/真 `connectNative` | `apps\desktop\src-tauri\src\native_connector_host.rs` + `apps\extension\lib\connector-client.ts` | fail-closed：host 侧自校验启动上下文，双端钉白名单 / M |
| B3-02 | 进程组判活（PGID + 启动时间）与整组回收 | `obf.mjs`：`ps -axo pid=,pgid=,lstart=`、`process.kill(-pid,'SIGKILL')` | 已有等价且更稳（Job Object 内核兜底 > 枚举判活），但 CLI/ai-service 无显式组判据 | `apps\cli\src\subagents\`（判活辅助） | 可测性：ps 夹具三态；输入缺失保守保留 / M |
| B3-03 | 协作 CLI 身份三档 + 退出码/幂等契约 | `collaboration-cli\skills\desktop\references\{identities,operations}.md`：User / RuntimeOwner / RuntimeAgent；退出码 3=拒绝、4=部分结果(`nextOffset`)、130=取消 | 完全没有（身份委派概念有，契约层无） | `apps\cli\src\commands\collab\` | fail-closed 身份 + PG 台账：错误身份断言无副作用 / M |
| B3-04 | 系统提交内存（commit charge）OOM 预判 | `system_commit.node`：`getSystemCommit` → `commitTotalBytes` / `commitLimitBytes` / `mainProcessCommitLimitBytes` / `mainProcessCommitAvailableBytes` | 完全没有（`apps\desktop` 0 命中） | `apps\desktop\src-tauri\src\system_memory.rs` | 可测性 + PG 监控：低余量拒绝派生并出声 / S |
| B4-02 | 父子 env 白名单透传集 + 会话键隔离集成对 | `daemon-supervisor.cjs` 的 `CODEBUDDY_INTERNAL_DAEMON_CHANNEL` / `CODEBUDDY_SESSION_KIND`；`lite-wb.mjs` L358 白名单（`USERPROFILE`/`SYSTEMROOT`/`TEMP`…）与隔离集（`*_SESSION_ID`/`*_OWNER_KEY`…） | 部分覆盖（`apps\cli\src\sandbox\env-guard.ts` 有 ROUTES 归类 + `blockedEnvVars` 黑名单） | `apps\cli\src\sandbox\env-channel.ts` | fail-closed：未登记键默认不进子进程 env / S |
| B4-05 | 更新后优雅自重启状态机 | `lite-wb.mjs` L2786：`pendingRestart` / `restartInFlight` / `legacy-systemd-unit` 拒绝原因 / `releaseHttpServerForRestart` / `DAEMON_RESTART_REFUSED` / idle 周期 10_000ms、退出延时 200ms | 完全没有（`graceful` 仅见 `process-tree-reaper.ts` / `worker-pool.ts`，与 daemon 无关） | `apps\cli\src\daemon\auto-restart.ts` | fail-closed：任一维非 idle 绝不重启 + 可测性 / M |
| B4-07 | 网络边界双引擎（DNS hook + 常驻 TCP 决策） | `tsbx_rules.json` 注释：tsbx 只做 DNS 域名拦截，TCP 交 Rust 常驻 LocalProxy；`SandboxCLIClient` 帧 `ts-msg-<n>` + 超时/重试节流 | 部分覆盖（`egress\dns-adjudicator.ts` 有；`env-inject.ts` 自述「刻意不起那个载体」） | `apps\cli\src\sandbox\egress\`（先接口后载体） | PG 台账 + fail-closed：代理不可用显式 unjudged 并阻断 / L |

## 6. P2：24 条（储备，B/C 档；六栏全文见对应 block 文件）

| ID | 设计 | 现状档 | 落点 | 超越轴 / 代价 |
|---|---|---|---|---|
| B1-01 | 工具超时结构化分类 + 嵌套 deadline 隔离（`TOOL_TIMEOUT`） | 部分覆盖（`core\tool_timeout_policy.py` 有预算、无结果码） | `apps\ai-service\app\core\tool_timeout_policy.py` | 可测性：内层/外层不串码 / S |
| B1-03 | 重复调用连续链分级 advisory（阈值 3/5/8） | 部分覆盖（`core\doom_loop.py` 窗口哈希） | `app\core\repeat_call_reminder.py` | 零缺省：只提醒不否决 / S |
| B1-05 | 沙箱三级策略解析 + 会话级额外可写根 | 部分覆盖（`services\sandbox.py` profile + 静态根） | `app\services\sandbox.py` + 会话侧车 | 可测性：注销即失效、续跑需重注册 / M |
| B1-07 | LLM 重试 provider 路由 + retryId 持久化续用 | 部分覆盖（次数/退避/抖动/Retry-After 有） | `app\providers\base_provider.py` + 会话投影 | PG 替代 sqlite（禁本地库）/ M |
| B1-08 | 工作区变更盘上快照兜底 + 按需对比 | 部分覆盖（`core\turn_diff_tracker.py` 内存净 diff） | `app\services\workspace_changes_service.py` | 可测性：补丁丢失仍能兜出 / M |
| B1-09 | 子代理 fork / spawn 双上下文播种后端 | 部分覆盖（`subagent_spawn_policy.py` 只有工具面与预算） | `app\services\subagent_backends.py` | 零缺省：默认后端不变 / M |
| B1-10 | 输出留存原语（retainer + UTF-8 边界 + omit 三态） | 部分覆盖（`services\spill_retention.py` 头尾预算 + 代理对） | `app\core\output_retention.py` | 可测性：未知计数不冒充精确 / S |
| B1-11 | OTel 事件 / 会话日志双通道（计数批 + 字节有界） | 完全没有（`app\telemetry.py` 只有 trace） | `app\services\otel_log_channels.py` | 可测性：洪峰互不挤占 / M |
| B2-07 | 常驻原生模块统一 ABI（`BP_GetInterface/Initialize/Shutdown`） | 完全没有（Rust 静态编译，无动态插件面） | `apps\desktop\src-tauri\src\native_plugin_abi.rs`（远期） | 可测性：Init/Shutdown 配对 + 验签 fail-closed / L |
| B2-08 | ContextFS 动词面（ls/cat/write/grep/glob）+ 30s 超时 + trace 透传 | 部分覆盖（`app\core\context_fs.py` 有解析与鉴权三态） | `app\core\context_fs.py` 扩动词处理器 | PG + 可测性：越界路径不回落宿主 FS / M |
| B2-10 | 沙箱生命周期与拦截行为埋点 | 完全没有（仅 `egress_gate.rs` + `metrics_collector.py`） | `apps\desktop\src-tauri\src\sandbox_metrics.rs` | 可测性：拦截数 = 放行+拒绝+保留 / M |
| B2-11 | 会话快照版本只读面（按 message_id 反查 + 文件 diff） | 已有等价（`routers\checkpoint_rewind.py`），缺两个只读查询 | `apps\ai-service\app\routers\checkpoint_rewind.py` | PG + 归属校验 / S |
| B3-05 | Windows 通知权限状态查询 | 部分覆盖（只有 `tauri-plugin-notification` 发送） | `apps\desktop\src-tauri\src\notification_permission.rs` | 可测性：三态夹具 / S |
| B3-06 | 剪贴板一次性读取令牌 | 部分覆盖（`lib.rs` 有 `clipboard_get/set`，无令牌） | `apps\desktop\src-tauri\src\lib.rs` 命令层 | fail-closed：二次消费即拒 / S |
| B3-07 | 请求元数据四层 + Advisor（`max_uses`）+ patches 增量编辑 | 部分覆盖（`v1-public.ts` 只透传 `reasoning_effort`） | ai-service 请求模型 + api 路由 | 可测性 + PG 追踪 `request_set_id` / M |
| B3-08 | worker 行协议（stdin 行 JSON + `ready/exit/error` + VM 堆限额） | 部分覆盖（`terminal-service.ts` / `worker-pool.ts` 有 PTY 与并发） | `apps\cli\src\subagents\worker-protocol.ts` | 可测性：分片/畸形行/exit 事件 / M |
| B3-09 | RTC 音视频原生引擎桥（`AoqClientSdk`） | 完全没有（仅服务端计费 + `webrtcPort`） | `apps\desktop\src-tauri\src\rtc_bridge.rs`（远期） | 可测性：帧观察者注入夹具、token 不落仓 / L |
| B3-10 | 硬件专用键盘钩子 + 回放状态机 | 完全没有，**不建议照搬** | 不新增（走全局快捷键配置化） | 零缺省：只作对照记录 / L |
| B4-03 | 编译态 / 源码态双 spawn 判据 + bundle 逐级回退 | 完全没有（`bunfs`/`~BUN` 0 命中） | `apps\cli\src\util\spawn-isolated.ts` 旁纯判据 | 可测性：两分支注入断言 + 回退留原因码 / S |
| B4-08 | 启动画像 span 树 + 并发覆盖缺口 + 目标停采 | 部分覆盖（`startup\profile.ts` 四里程碑纯判据） | `apps\cli\src\startup\profile.ts` | 可测性：并发段不重复计时 / M |
| B4-09 | 低内存 V8 启动档（`--optimize-for-size --max-semi-space-size=2`） | 完全没有 | `apps\cli` 启动包装（Windows 走 `NODE_OPTIONS`） | 可测性 + 零缺省：不开档不变 / S |
| B4-10 | lazy chunk manifest 版本防污染 + 两级预读 | 完全没有（`startup\prewarm.ts` 只读状态件） | `apps\cli\src\startup\prewarm.ts` 旁 | 可测性：四态夹具 + 版本不符不入缓存 / S |
| B4-11 | 崩溃看门狗重启腿（计数 + 线性退避 + `unref`） | 部分覆盖（`acp\backoff.ts` 纯函数只算不睡） | `apps\cli\src\subagents\` 或 `acp\` | 可测性：预算耗尽即放弃 / S |
| B4-12 | 会话历史清理按路由意图开关 | 完全没有 | `apps\cli\src\commands\` 启动路由判定 | 零缺省：显式配置优先 / S |

## 7. 未做 / 未判定（按程序，含原因）

| 程序 | 未做 / 未判定 | 原因 |
|---|---|---|
| 全部 | 原生全量反编译（Ghidra 逐函数） | craft-anything CLI capabilities 里 `ghidra found=false`；四个程序的大二进制 100–284MB，全量不现实。本轮一律止于导出/导入表 + 定向字符串 |
| 全部 | 运行目标程序做动态验证（时序、并发交错、洪峰、规则执法强度） | 红线：不运行目标程序。凡动态结论一律记「推断」 |
| DeepSeek Harness | SDK JSON-RPC 逐帧协议、`dsh-schedule` 跨会话提醒、`dsh-spill-policy` 与已吸收 pruner 的边界 | 未逐帧/逐函数对照；IHUI 已有 `acp_bridge.py` 暂判等价面 |
| DeepSeek Harness | ui/host 渲染、computer-use/cua-bundle、plugin-market、typert 类型反射、terminal/pwsh/win32 进程族、agent-team | 组内与现有能力重叠或判 C 档，未展开 |
| DeepSeek Harness | 端侧对照缺口 | IHUI 现状仅 grep 了 `apps/ai-service` Python 侧；`apps/api`、`apps/web`、`apps/desktop`、`packages/*` 未逐文件核验 |
| TRAE CN | `ai_agent.dll` / `harness.dll` / `toolhost.dll` / `agent-tool-host.exe` 函数级还原 | 同上，全量反编译未做 |
| TRAE CN | ckg 向量维度字面量、代码实体/关系 schema、单例互斥、索引触发方式、`codekg_bge_m3` 模型文件 | 字符串面未命中；不把外部常识（BGE-M3 1024 维）当观察 |
| TRAE CN | VM 后端技术、Detours 注入细节、ALPC 与命名管道链路拆分、SDDL/ACL 主体 | 静态不可达，未动态验证 |
| TRAE CN | `modules\browser-bridge` 整块、`libckg.dll` 内嵌 Kafka/ahanet 远端链路 | 不在本轮三块范围 / 未展开 |
| Qoder CN | 主包 191MB 打包 + 字符串加密：`js-app-map` 1394 文件仅列 16，源码模块与 IPC 配对 0 | 宿主侧 worker 持锁/生命周期/判活入口、host 凭据通道、通知阈值、剪贴板令牌生命周期均不可见 |
| Qoder CN | `qoder-worker-runtime.obf.mjs` 的 XOR 字符串池（34.8MB） | 未解码；取消消息类型、协议握手、并发上限常量值不可见 |
| Qoder CN | `AoqClientSdk.dll`（14.7MB C++ 引擎）、`hosts\` 下 10 个哈希版本 exe、协作 CLI 运行时行为 | 未拆 / 未逐一比对 / 只读约束下未做动态实验 |
| WorkBuddy | `job-object.node` / `sandbox-cli.exe` / `sandbox-center.exe` 内部、跨进程内核命名 mutex、重启放弃阈值、`manual` 心跳周期、注册表写入原子性 | 原生未反编译 / JS 面未量到 |
| WorkBuddy | `vendor\sandbox` 其余平台目录（linux-arm64 / linux-x64 / darwin）规则是否分叉 | 未展开 |

## 8. 复现命令速查（本机实测可用）

```powershell
# ASAR 只读（不写目标目录，不整包入上下文）
node C:\IHUI-AI\scripts\benchmark-asar-read.mjs "<asar 绝对路径>" --list ".+<包名>/"
node C:\IHUI-AI\scripts\benchmark-asar-read.mjs "<asar 绝对路径>" --get "<asar 内路径>"

# PE 导出表 / 导入表 / 字符串
& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iE" "<dll 绝对路径>"    # 导出
& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "ii" "<dll 绝对路径>"    # 导入 DLL 与 API
& 'C:\Program Files\Rizin\bin\rizin.exe' -qc "iz" "<dll 绝对路径>"    # 字符串（大文件按关键词过滤）

# craft-anything CLI 0.5.0（读目标代码必须带全局 --deep；--project 目录须事先不存在）
craft-anything-cli --deep js-app-map --input-path "<app.asar 绝对路径>" --source-paths "<app.asar.unpacked 绝对路径>"
craft-anything-cli --deep commands            # 321 条工具
craft-anything-cli --deep native-pe-resources-list
```

REA（`pnpm rea`，npx rea-agents@6.4.0）本轮**未使用**：直跑原生分析需 `GHIDRA_INSTALL_DIR` /
`JAVA_HOME` 透传，且本轮不需要反编译。`pnpm rea` 后面不要再加 `--`。

## 9. 证据文件与口径

| 文件 | 内容 |
|---|---|
| `block1-dsh.md` | DeepSeek Harness，11 条，asar 文本与符号级 |
| `block2-trae.md` | TRAE CN，11 条，导出/导入表 + 定向字符串 + 启动脚本 |
| `block3-qoder.md` | Qoder CN，10 条，proto 明文 + 原生符号 + 浏览器桥源码 |
| `block4-workbuddy.md` | WorkBuddy，12 条，supervisor / no-orphans / 规则表全读 |
| `_scratch\`（约 5.0MB，238 个文件） | 原始取证切片：`trae\{ie,ii,str}-*.txt`（导出/导入/字符串过滤结果）、`dsh\out\@deepseek-ai\`（asar 抽读件）、`qoder\`、`wb\` 切片 |

`_scratch\` 里最大的是 `trae\str-ai_agent.txt`（1.0MB）与 `str-ctx-cli.txt`（0.9MB）——都是已按关键词过滤的
字符串切片，可直接复核本文每条「证据」。若要压缩入库体积，只保留 `*-{ie,ii}-*.txt` 与 `str-*.txt` 的过滤结果即可，
删掉中间解包树不会损失可复核性。

**不重复造清单（本轮实证确认 IHUI 已有等价或已超越，勿再当新落点）**：
`app\core\session_event_log.py`（DSH session 族）· `app\core\context_compaction.py` +
`app\services\tool_result_pruner.py` + `app\core\compaction_retention.py`（DSH compaction 族）·
`app\services\mcp_client.py`（MCP 客户端面，含 resources/prompts/completion/subscribe）·
`app\services\persona_registry.py` · `app\services\tool_auto_review.py` ·
`app\utils\atomic_io.py` · `app\core\file_read_state.py`（四档 + changed_by 归因）· `app\services\acp_bridge.py` ·
`apps\desktop\src-tauri\src\terminal_session.rs`（Job Object + BREAKAWAY_OK）· `orphan_guard.rs`（kill-on-close）·
`apps\extension\lib\native-messaging-protocol.ts`（判据层已严于 Qoder）· `apps\cli\src\sandbox\egress\env-inject.ts`
（已显式声明不起常驻代理载体）· `apps\ai-service\app\routers\checkpoint_rewind.py`（快照回滚）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
