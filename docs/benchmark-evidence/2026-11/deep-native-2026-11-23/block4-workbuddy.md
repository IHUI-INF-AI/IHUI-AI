<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# block4 · WorkBuddy 未吸收可复现设计

> 对照对象：WorkBuddy 5.11.3，安装根 `C:\workbuddy`。本轮纯只读取证：未运行本体、
> 未跑其 CLI/daemon、未加载原生 `.node`、未提取凭据/token/登录态。结论分级标注
> （观察 / 推断 / 未知），只写策略与语义，不复制对方源码。
> 既有只读参考（本轮不重做其结论）：`docs/WORKBUDDY_TASKS.md`、
> `docs/benchmark-evidence/2026-11/five-apps-2026-11-23/wb-archive.md`。
>
> **已剔除基线（不得重复计数）**：Job Object 本身（IHUI `terminal_session.rs`
> 的 BREAKAWAY_OK）、kill-on-close / 孤儿回收（IHUI `orphan_guard.rs`）。这两条
> 已判定 IHUI 超越对方原设计；本清单只写它们没覆盖到的策略面。

## 取证面与覆盖

| 面 | 路径 / 工具 | 粒度 |
|---|---|---|
| 守护入口 | `resources\app.asar.unpacked\cli\bin\daemon-supervisor.cjs`（全读）、`no-orphans.cjs`（全读）、`windows-job.cjs`（全读）、`daemon-status-brief.cjs`（全读） | 符号名 / env 键 / spawn 选项 / 状态分支级 |
| 启动与产物 | `cli\bin\codebuddy`（主分派脚本全读）、`codebuddy-lowmem`（全读）、`startup-profile.cjs`（全读）、`preload-lazy-chunks.cjs`（全读）、`daemon-supervisor.test.cjs`（全读，作行为旁证） | 分支判据 / 常量 / 断言形态级 |
| 打包业务面 | `cli\dist\codebuddy-lite-wb.mjs`（12.8MB 单包） | 关键词切片：env 白名单、daemon 注册表、重启状态机、sandbox 客户端、锁与退避；未做全模块解析 |
| 沙箱规则 | `cli\vendor\sandbox\5.11.4\tsbx_rules.json`（全读）；`sandbox-cli.exe` / `sandbox-center.exe` 未运行 | 规则条目 / 字段名 / 注释级 |
| IHUI 对账 | `apps\cli\src\`、`apps\desktop\src-tauri\src\` 静态 Select-String 对账 | 命中文件级；未跑 typecheck/测试（本轮红线） |

**本轮没碰**：`job-object.node` / `sandbox-cli.exe` 二进制内部未反编译；
`~/.codebuddy`（或等价用户目录）下会话与凭据文件未读；打包内混淆模块未还原；
未动态验证规则实际执法强度。

## 候选条目

| ID | 设计名 | 价值档 | 复现代价 | 超越轴 | 一句话 |
|---|---|---|---|---|---|
| B4-01 | 独立 daemon supervisor 进程 + IPC 请求-应答握手拓扑 | A | M | 可测性 | 守护者不加载业务、不加入 worker Job，detached 拉起 daemon 并按 id 配对握手，无 worker 自退；IHUI 仅有杀树看门狗，无此反向监护拓扑 |
| B4-02 | 父子 env 白名单透传集 + 会话键隔离集成对结构 | A | S | fail-closed 边界 | 宿主身份键显式白名单透传，会话/归属键显式隔离不向子智能体扩散；IHUI 有归类表与黑名单，缺成对白/隔离集 |
| B4-03 | 编译态/源码态双 spawn 判据 + bundle 逐级回退 | B | S | 可测性 | 按 bunfs/~BUN 路径形态判编译态选参数/入口；lite-wb→headless→full 逐级 catch 回退；IHUI 无运行态编译判据 |
| B4-04 | daemon 会话注册表：pid json + 存活/身份/端口三判据 + 陈旧回收 | A | M | PG 统一数据层 | sessionsDir 下 pid/manual json 登记 daemon，findRunningDaemon 过存活+身份当前+host 过滤，陈旧锁按 pid/端口不通回收；IHUI 内存 Map + 只报台账，无跨进程注册表 |
| B4-05 | 更新后优雅自重启状态机（pending/in-flight/idle 等待 + 拒绝原因族） | A | M | fail-closed + 可测性 | 非 idle 不重启，拒绝原因结构化（systemd 托管/忙/在飞），排空 sockets 后延时退出；IHUI 无 daemon 自重启腿 |
| B4-06 | 沙箱文件规则族：home 凭据目录 deny + 开发缓存 allow + 浏览器进程白名单 | A | M | fail-closed 边界 | 规则表按 home 绝对路径封 `.ssh`/`.gnupg`，缓存目录 allow 族，浏览器进程白名单；IHUI 凭据 deny 仅限工作区相对形态，缺 home 族与进程白名单 |
| B4-07 | 网络边界双引擎：DNS hook 域名拦截 + 常驻 TCP LocalProxy 决策 | A | L | PG 台账 + fail-closed | tsbx 只做 DNS 域名拦截，TCP 连接决策交常驻代理；sandbox-cli IPC 管道 + 超时/重试节流；IHUI 仅有命令行点名裁决与可选代理腿，常驻 TCP 兜底缺失 |
| B4-08 | 启动画像 span 树 + 并发覆盖缺口 + 目标里程碑自动停采 | B | M | 可测性 | AsyncLocalStorage 父子 span、covered/uncovered 并集时长、命中目标即停采、双格式落盘；IHUI 仅有四里程碑纯判据 |
| B4-09 | 低内存 V8 flag wrapper（optimize-for-size + 小半空间） | B | S | 可测性 | 独立包装进程加 `--optimize-for-size --max-semi-space-size=2`，不加老年代上限；IHUI 无此启动档 |
| B4-10 | lazy chunk manifest 版本防污染 + 两级预读 | B | S | 可测性 | 按本版本 `manifest.json` 的 `lazy_files` 预读，防并发升级外来 chunk 入缓存；manifest 破损回落 readdir；IHUI 预热仅有状态件读数 |
| B4-11 | 崩溃看门狗重启腿（计数 + 线性退避 + unref timer） | B | S | 可测性 | 子进程死亡监听按 restartAttempt 线性退避重启，timer unref 不挡退出；IHUI 退避纯函数已有，缺进程崩溃重启腿 |
| B4-12 | 会话历史清理按路由意图开关 | C | S | 零缺省行为变化 | 按 CLI 路由（TUI/Web/cleanup）而非实际加载产物决定历史清理缺省；headless/prewarm 待命态关闭；IHUI 无此开关 |

## 逐条五要素

### B4-01 独立 daemon supervisor 进程 + IPC 请求-应答握手拓扑

- **证据**：
  - `C:\workbuddy\resources\app.asar.unpacked\cli\bin\daemon-supervisor.cjs`：
    进程内单例符号 `Symbol.for('codebuddy.daemon-supervisor')`；通道键
    `CODEBUDDY_INTERNAL_DAEMON_CHANNEL`；守卫旗标 `--internal-daemon-supervisor`。
    `prepare()` 三分支：已有实例复用；env 带通道键则把自身当继承 IPC 的子进程；
    否则只在 `daemon start|restart|install` 命令下创建。`start()` 以
    `detached: true, windowsHide: true, stdio: ['ignore','ignore','ignore','ipc']`
    拉起 supervisor 并 `unref()`。`spawnDaemon()` 经 IPC 发 `start-daemon` 消息、
    起 60s 保活间隔直到收到 `daemon-started` 且 id 配对；`disconnect` 即判启动失败。
    `listen()` 准入校验：argv 含 `--serve` 且 `CODEBUDDY_SESSION_KIND === 'daemon'`，
    否则回错「Supervisor only starts daemon workers」；worker 再以 `detached: true`
    拉起，`handedOff` 一次性交接，workers 集合追踪，父通道断开且集合为空时自退。
  - 同文件头注释明示：supervisor "never joins a worker's Job"；
    `daemon-supervisor.test.cjs` 行为旁证：starter 退出后 daemon 仍存活；最后一个
    daemon 停止后 supervisor 自退；接班 daemon 活过旧 daemon 的 Job。
  - 复核命令：`Select-String -Path <daemon-supervisor.cjs> -Pattern 'detached|unref|handedOff|start-daemon|daemon-started|SESSION_KIND'`。
- **三档**：观察——spawn 选项、IPC 消息类型、准入校验、自退条件、测试断言均如上；
  推断——supervisor 是与 worker Job 分离的反向守护者，职责是拉起/看护 daemon 而非回收后代；
  未知——JS 面未见显式 `DETACHED_PROCESS`/`CREATE_NEW_PROCESS_GROUP` 标志位与命名内核
  mutex（bundle 内 `DETACHED_PROCESS`/`CREATE_NEW_PROCESS_GROUP`/`CreateMutex` 0 命中），
  原生层是否另有进程分离原语未判定。
- **IHUI 现状**：`Get-ChildItem apps\cli\src,apps\desktop\src-tauri\src -Recurse -File | Select-String 'spawnDaemon|start-daemon|daemon-started|handedOff' -List` → 0 命中。
  已有 `apps\cli\src\util\parent-bound.ts`，但其形态是「父死子随死」的杀树看门狗
  （对照 Job/kill-on-close 基线），方向相反。结论=完全没有「独立守护者进程 + IPC
  请求-应答握手 + 一次性交接 + 无 worker 自退」拓扑。
- **落点建议**：新增 `apps\cli\src\daemon\supervisor.ts`（握手状态机纯判据）+
  薄进程侧 runner；desktop 侧如需原生承载可在 `apps\desktop\src-tauri\src\` 新增
  `daemon_supervisor.rs`，复用现有 `terminal_session.rs` 的 Job 装配但不加入 worker Job。
- **超越轴**：可测性——把握手配对/超时/断开/交接落纯判据，注入假 IPC 通道与假时钟
  断言：id 不配对不成交、disconnect 判失败、worker 清空才自退；守护拓扑注册表落
  PostgreSQL（替代内存 Map），重启后可对账。
- **最小复现范围**：守护者进程不加载业务 bundle；经一条独立 IPC 通道接收拉起请求，
  校验命令形态与会话类型后派生 daemon；按请求 id 等应答，超时/断开显式失败；
  名下无存活 worker 即自退，不常驻空转。

### B4-02 父子 env 白名单透传集 + 会话键隔离集成对结构

- **证据**：
  - `cli\dist\codebuddy-lite-wb.mjs` L358 切片：透传白名单集合含
    `SERVER__HOST`、`SERVER__PORT`、`SHELL`、`SYSTEMROOT`、`TEMP`、`TMP`、`TMPDIR`、
    `USERPROFILE`；会话/归属隔离集合含 `CLAUDE_SESSION_ID`、`CODEBUDDY_CONVERSATION_MESSAGE_ID`、
    `CODEBUDDY_OWNER_KEY`、`CODEBUDDY_PROJECT_DIR`、`CODEBUDDY_SESSION_ID`、
    `CODEBUDDY_SESSION_KIND`、`CODEBUDDY_SESSION_LOG`、`CODEBUDDY_SESSION_NAME`、
    `CODEBUDDY_TEAMMATE_OWNER_KEY`。L738 另有 ptyEnv 子集（`SERVER__HOST/PORT`、
    `SESSION_KIND/NAME/LOG`、`GATEWAY_AUTH…`）。
  - `daemon-supervisor.cjs`：supervisor→worker 注入 `CODEBUDDY_INTERNAL_DAEMON_CHANNEL=1`；
    `CODEBUDDY_SESSION_KIND` 同时是 worker 准入校验键。
  - 复核命令：`Select-String -Path <codebuddy-lite-wb.mjs> -Pattern 'SESSION_ID|OWNER_KEY|SESSION_KIND|USERPROFILE|SYSTEMROOT'`。
- **三档**：观察——两组键名与 pty 子集如上；推断——隔离集不向 pty/子智能体扩散，
  会话身份不被派生链路污染；未知——白名单外的宿主键是丢弃还是另走默认继承，
  JS 切片未量到默认分支。
- **IHUI 现状**：`Select-String 'SESSION_KIND|CHANNEL_ENV'` → 0 命中；
  `apps\cli\src\sandbox\env-guard.ts` 有 `ROUTES` 归类表（pass-host / pass-as-param /
  set-by-us / forbidden），`apps\cli\src\sandbox\` 另有 `blockedEnvVars` 黑名单。
  结论=部分覆盖：有禁传与归类指引，缺「宿主身份键白名单透传集 + 会话键隔离集」的
  成对结构，也未见会话类型/通道键的跨进程约定。
- **落点建议**：改造 `apps\cli\src\sandbox\env-guard.ts`（或其旁侧新 `env-channel.ts`），
  登记透传白名单与会话隔离两张具名表；派生点 env 组装统一走该出口。
- **超越轴**：fail-closed 边界——未登记进白名单的宿主身份键默认不进子进程 env，
  而非黑名单漏放；隔离键被误入派生 env 时判据显式点名，测试用例钉死两集不相交。
- **最小复现范围**：子进程 env 组装分三步——剥凭据、并入白名单宿主键、显式剔除
  会话/归属隔离键；会话类型与通道键作为守护者链路的准入凭据，不进普通 worker env。

### B4-03 编译态/源码态双 spawn 判据 + bundle 逐级回退

- **证据**：
  - `daemon-supervisor.cjs` `start()`：编译态判据 = `process.versions.bun` 存在且
    `process.argv[1]` 匹配 `/^(\/\$bunfs\/|[A-Za-z]:[\\/]~BUN[\\/])/`；编译态子参数
    为 `--internal-daemon-supervisor`，源码态子参数为解析到的 `.cjs` 入口路径。
  - `codebuddy-lite-wb.mjs` L3309 sandbox 路径解析同判 `isBunCompiled`：编译态从
    exe 旁 `vendor\sandbox\<版本>` 目录取，源码态从平台包取。
  - `cli\bin\codebuddy` 主脚本：三变体 `codebuddy-lite-wb.mjs` → `codebuddy-headless.js`
    → `codebuddy.js`，逐级 `catch` `MODULE_NOT_FOUND`/`ERR_MODULE_NOT_FOUND` 回退；
    另有 `CODEBUDDY_FORCE_HEADLESS_BUNDLE`、`CODEBUDDY_FORCE_LITE_WB_BUNDLE` 强制档位 env。
  - 复核命令：`Select-String -Path <daemon-supervisor.cjs> -Pattern 'bunfs|~BUN|versions.bun'`。
- **三档**：观察——判据正则、两态参数/入口差异、三 bundle 回退顺序与强制 env 如上；
  推断——编译态下无磁盘 `.cjs` 可指，故只传旗标由宿主自举；未知——编译态内置模块
  解析失败时的完整降级链未在本轮展开。
- **IHUI 现状**：`Select-String 'bunfs|~BUN|isBunCompiled'` → 0 命中。
  结论=完全没有运行态编译/源码双形态判据（仓内有 SEA 打包脚本，但未见按运行形态
  分叉 spawn 参数/入口的实现）。
- **落点建议**：`apps\cli\src\util\spawn-isolated.ts` 旁新增纯判据模块，输出
  `{ runtimeForm: 'compiled' | 'source', entry, argv }`；supervisor/worker 派生点统一调用。
- **超越轴**：可测性——判据纯函数，注入 `argv[1]` 形态与 `versions` 形状即可断言
  两分支；回退链每级失败带结构化原因码，不靠裸异常字符串区分。
- **最小复现范围**：启动时判定产物形态；编译态传自举旗标，源码态传模块路径；
  主 bundle 加载失败按预设顺序逐级回退变体，每级缺失/损坏都记一笔可观测原因。

### B4-04 daemon 会话注册表：pid json + 存活/身份/端口三判据 + 陈旧回收

- **证据**：
  - `codebuddy-lite-wb.mjs` L2766/2786 切片：sessionsDir 下条目名匹配
    `^(\d+|manual-.+)\.json$`（`<pid>.json` 与 `manual-*.json`）；条目 `kind === 'daemon'`。
    `findRunningDaemon`：先 `registry.list({ kind: 'daemon' })`，再逐条目过
    进程存活（`kill(pid, 0)` 语义）、进程身份当前（`isProcessIdentityCurrent`）、
    remoteHostId 过滤；取 readdir 顺序第一条。默认端口 `9527`、host `127.0.0.1`，
    可被 `CODEBUDDY_DAEMON_CONFIGURED_PORT` / `CODEBUDDY_CONFIG_DIR` 覆盖。
    `waitForPidFile`：轮询 pid json 直到 endpoint 出现或进程不活，带截止时间与轮询间隔。
  - 同包 L605 切片：IDE lockfile 陈旧回收——解析锁文件后 pid 不活或端口不通即 `unlink`，
    不可解析也删除。`daemon-status-brief.cjs`：`manual-*` 条目走心跳语义，状态简报
    遇 manual 条目回退完整路径探测。
  - 复核命令：`Select-String -Path <codebuddy-lite-wb.mjs> -Pattern 'manual-|isProcessIdentityCurrent|9527|CONFIGURED_PORT|waitForPidFile'`。
- **三档**：观察——条目命名、三判据顺序、默认端口/host、陈旧回收动作如上；
  推断——注册表同时承担单例探测与状态发现；未知——条目写入的原子性（临时文件+rename
  或直接写）与并发写互斥细节本轮未量到；manual 心跳周期未在 JS 面量到。
- **IHUI 现状**：`Select-String 'pid.json|isPortOpen|configuredPort'` → 0 命中；
  `apps\cli\src\tools\background-registry.ts` 为模块级 Map + `background-ledger` 跨进程
  台账（头注明示「只报不恢复」，重启后判 `detached-unknown`，不自动重跑）；
  `apps\cli\src\commands\serve.ts` 端口 `8841`，`strictPort` 占用即失败，无单例探测。
  结论=部分覆盖：有后台任务台账，缺跨进程 pid 注册表 + 存活/身份/端口三判据 + 陈旧条目回收。
- **落点建议**：新增 `apps\cli\src\daemon\registry.ts`；注册表持久化落 PostgreSQL
  （项目数据层唯一允许 PG，禁 sqlite），不另起文件锁目录；陈旧回收复用判据纯函数。
- **超越轴**：PostgreSQL 统一数据层——注册表进库后重启可对账、可识别陈旧/被复用 pid，
  不再依赖本地 json 散落文件；可测性——判活/身份/端口三谓词全部注入，测试断言
  「身份不当前不命中」「端口不通判陈旧」。
- **最小复现范围**：daemon 启动写一条登记（pid/身份/端口/host/kind/时刻）；
  查询按存活→身份→host 顺序过滤；启动前先查在跑实例；周期或启动时清理 pid 不活、
  端口不通、身份不符的陈旧条目；判定取不到输入时落未判定，不冒绿。

### B4-05 更新后优雅自重启状态机（pending/in-flight/idle 等待 + 拒绝原因族）

- **证据**：
  - `codebuddy-lite-wb.mjs` L2786 切片：`DaemonAutoRestart` 可选绑定（未绑定时
    self-restart 抛错）；状态字段 `pendingRestart`、`restartInFlight`、`pendingSince`、
    `idleCheckTimer`、`sockets` 集合。`restartNow` 拒绝原因族含 `legacy-systemd-unit`
    （`INVOCATION_ID` 存在且非 systemd 托管）；在飞/忙时重复重启请求被忽略。
    idle 判据：ACP bridge 空闲 + 所有 session `runState` idle + registry 无
    interactive/bg/daemon 活动；idle 检查周期常量 `eZ = 10_000`；`performGracefulRestart`
    先 `releaseHttpServerForRestart`（关 HTTP server、排空 sockets），`e1 = 200ms`
    后 `exit(0)`；拒绝抛 `DaemonRestartRefusedError`（code `DAEMON_RESTART_REFUSED`）。
  - 复核命令：`Select-String -Path <codebuddy-lite-wb.mjs> -Pattern 'pendingRestart|restartInFlight|legacy-systemd-unit|releaseHttpServerForRestart|DAEMON_RESTART_REFUSED'`。
- **三档**：观察——状态字段、拒绝原因、idle 维度、排空顺序、延时退出常量如上；
  推断——这是版本更新后的优雅自重启，不是崩溃循环重启（崩溃重启见 B4-11）；
  未知——idle 等待的最大时长与强制重启阈值未在本轮切片中量到。
- **IHUI 现状**：`Select-String 'restartNow|pendingRestart|autoRestart'` → 0 命中；
  `graceful` 仅在 `acp\process-tree-reaper.ts`、`subagents\worker-pool.ts` 各 1 处，
  与 daemon 自重启无关。结论=完全没有。
- **落点建议**：新增 `apps\cli\src\daemon\auto-restart.ts`；状态机纯判据 + 进程侧
  排空/退出薄壳；desktop 侧如需跟随可在 `src-tauri\src\` 补对应生命周期钩子。
- **超越轴**：fail-closed——任一维度非 idle 绝不重启，拒绝原因结构化进日志/台账；
  可测性——状态迁移纯函数注入假 sessions/sockets 集合，断言 pending→in-flight→exit
  路径与各拒绝分支。
- **最小复现范围**：收到重启请求先记 pending；周期巡检各活动面是否 idle，非 idle 保持
  等待并点名哪一维忙；idle 后排空网络连接与服务监听，短延时后退出由外层重新拉起；
  托管环境/在飞/忙态拒绝重启并给原因码。

### B4-06 沙箱文件规则族：home 凭据目录 deny + 开发缓存 allow + 浏览器进程白名单

- **证据**：
  - `C:\workbuddy\resources\app.asar.unpacked\cli\vendor\sandbox\5.11.4\tsbx_rules.json`：
    `default_action: ask`；`file_rules` 中 `%USERPROFILE%\.ssh\**`、`.gnupg\**` 读/写/删
    全 deny；Temp/回收站/Recent 与 npm/pnpm/yarn/fnm/pyenv/conda/rustup/cargo/go/m2/
    gradle/dotnet/docker 等开发缓存目录 allow；`file_rules_user` 用户追加层；
    `white_process` 浏览器白名单（edge/chrome/firefox/brave/opera/360/QQ/搜狗等可执行名）；
    `registry_rules`/`process_rules`/`network_rules` 为空表。
  - 复核命令：`Select-String -Path <tsbx_rules.json> -Pattern 'ssh|gnupg|white_process|default_action|allow'`。
- **三档**：观察——规则条目、动作档、白名单进程名如上；推断——缓存 allow 族用于减少
  打扰式询问，凭据 deny 族是硬边界；未知——规则在 Windows 上经何种原生接口落地、
  `white_process` 匹配可执行名还是完整路径，本轮未动态验证。
- **IHUI 现状**：`Select-String '.gnupg'` → 0 命中；`apps\cli\src\sandbox\file-access-policy.ts`
  凭据族 deny 中 `.ssh/**` 为工作区根下相对形态，未见 home 绝对路径规则；
  `apps\cli\src\config\sandbox-profile.ts` 是命令白名单五档（readonly/limited/trusted/
  open/full），不是文件路径规则族。结论=部分覆盖：工作区凭据族 deny 已有，缺 home
  凭据目录族、缓存 allow 族与浏览器进程白名单。
- **落点建议**：扩充 `apps\cli\src\sandbox\file-access-policy.ts` 规则表：home 路径
  经现成路径出口现算（不写死盘符），补 `.gnupg` 等凭据族；进程白名单另立规则面，
  与文件规则分表登记。
- **超越轴**：fail-closed 边界——凭据族 enforce deny 不因档位宽松而失效；规则表版本化，
  每条带 source 与原因，测试用例断言 home 凭据在任意 profile 下均被拒。
- **最小复现范围**：规则分 deny 凭据族 / allow 缓存族 / 白名单进程三类；路径相对项
  锚定工作区、绝对项锚定 home；命中 deny 即拦截，命中 allow 免询问，未命中走默认 ask。

### B4-07 网络边界双引擎：DNS hook 域名拦截 + 常驻 TCP LocalProxy 决策

- **证据**：
  - `tsbx_rules.json` `_comment_network_policy`：双引擎分工——tsbx 仅做 DNS hook
    域名拦截（`default` 恒 allow，不拦 TCP）；TCP 连接决策由 Rust 侧常驻 LocalProxy
    承担；`deny_domains` 驱动 DNS 黑名单；`network_policy` 含 `enabled`/`default`/
    `deny_ips`/`deny_domains` 字段。
  - `codebuddy-lite-wb.mjs` L3309 切片：sandbox-cli 经 IPC 管道连 `SandboxCLIClient`，
    帧 `ts-msg-<counter>` 请求-响应，带 `requestTimeoutMs`；仅对 retryable connect
    error 重试，重试次数与日志节流（3 次/25 次）；`sandbox-center` 提供
    `addAutoGrantFileRule` 自动授权文件规则；`betterleaks` 泄漏检测；路径解析优先级
    `SANDBOX_CLI_PATH` env → vendor 版本目录 → sfe 平台包 → bin 目录；
    `gcSandboxCliVersions` 回收旧版本目录。
  - 复核命令：`Select-String -Path <tsbx_rules.json> -Pattern 'deny_domains|LocalProxy|network_policy'`；
    `Select-String -Path <codebuddy-lite-wb.mjs> -Pattern 'SandboxCLIClient|ts-msg|gcSandboxCliVersions|addAutoGrantFileRule'`。
- **三档**：观察——双引擎分工注释、帧格式、超时/重试节流、路径优先级、版本回收如上；
  推断——DNS 层做粗域名筛查，连接级精细裁决在常驻代理；未知——LocalProxy 内部规则
  与进程形态本轮未触及（Rust 二进制未反编译）；自动授权规则的审批边界未量到。
- **IHUI 现状**：`apps\cli\src\sandbox\egress\` 已有 `dns-adjudicator.ts`（DNS 裁决）、
  `env-inject.ts`（出口标记 + 可选代理腿）、`egress-guard.ts`；`env-inject.ts` 头注
  明确写明「对侧把 TCP 连接判定交给常驻 LocalProxy，本仓此刻没有、也刻意不起那个载体」。
  结论=部分覆盖：命令行点名目的地裁决 + 可选代理腿已有，常驻 TCP 连接级兜底与
  sandbox-cli 管道客户端缺失。
- **落点建议**：远期在 `apps\cli\src\sandbox\egress\` 扩常驻代理腿（先出接口与
  判据，载体可后补）；sandbox 客户端连接/超时/重试节流落独立模块。
- **超越轴**：PostgreSQL 台账统一——拦截/放行/未判定全部进 PG 审计表，可按身份回溯；
  fail-closed——代理腿不可用时显式 unjudged 并按策略阻断，不假装执法（沿用现有
  `env-inject.ts` 口径）。
- **最小复现范围**：域名级裁决与连接级裁决分两层；域名黑名单先过 DNS 面，连接决策
  交常驻代理；客户端管道带超时、可重试错误白名单与日志节流；代理不可用显式降级并出声。

### B4-08 启动画像 span 树 + 并发覆盖缺口 + 目标里程碑自动停采

- **证据**：
  - `C:\workbuddy\resources\app.asar.unpacked\cli\bin\startup-profile.cjs`：
    `AsyncLocalStorage` span 树（id/parentId/phase/label/startMs/endMs/status）；
    `events`/`milestones`；`coveredMs`/`uncoveredMs` 按并集时长算覆盖缺口；
    `droppedEntries` 上限 10000；`until` 目标里程碑（`application-ready` /
    `first-model-request` / `ui-ready`）命中即 finish；60s 超时；结果文件 `wx`
    0o600 独占创建，失败回滚已建文件；进程在目标前退出也收尾；JSON + Markdown
    双输出；带内存/CPU 资源快照；`CODEBUDDY_DISABLE_COMPILE_CACHE` 控编译缓存。
  - 复核命令：`Select-String -Path <startup-profile.cjs> -Pattern 'uncoveredMs|coveredMs|milestone|until|0o600|droppedEntries|AsyncLocalStorage'`。
- **三档**：观察——span 字段、覆盖时长算法、停采目标、上限/超时/独占创建/双输出如上；
  推断——覆盖缺口用于定位启动等待段（并发空闲期）；未知——Markdown 报告的具体
  排版与快照采样频率本轮未展开。
- **IHUI 现状**：`apps\cli\src\startup\profile.ts` 已有四里程碑纯判据
  （entry/commandParsed/firstAwait/exit，measured/unjudged 三态，时钟注入）；
  `Select-String 'uncoveredMs|startupProfiler'` → 0 命中。结论=部分覆盖：里程碑
  delta 与三态诚实已有，span 父子树、并发覆盖缺口、目标自动停采、双格式落盘与
  资源快照缺失。
- **落点建议**：扩充 `apps\cli\src\startup\profile.ts`：span 树与覆盖并集时长落
  纯判据；输出层另立薄壳负责 JSON/Markdown 落盘。
- **超越轴**：可测性——span 树构造/并集时长/缺口判定纯函数注入假时钟，确定性断言
  并发段不计重复时长；未量到的里程碑点名缺哪枚，不把缺口渲染成 0ms。
- **最小复现范围**：记录父子 span 起止；按时间并集算已覆盖与未覆盖时长；命中指定
  目标里程碑自动停采，超时兜底；条目超限丢弃并计数；报告同时出机读 JSON 与人读摘要。

### B4-09 低内存 V8 flag wrapper（optimize-for-size + 小半空间）

- **证据**：
  - `C:\workbuddy\resources\app.asar.unpacked\cli\bin\codebuddy-lowmem`：shebang
    `node --optimize-for-size --max-semi-space-size=2`；同文件注释实测峰值内存
    -44%/-41%、时间不劣化；不加 `--max-old-space-size`（保留默认老年代上限）；
    长驻 `--prewarm` 场景不建议（electron-as-node 形态更优）；Windows shimbang 不透传
    shebang 参数，需走 `NODE_OPTIONS`。
  - 复核命令：`Select-String -Path <codebuddy-lowmem> -Pattern 'optimize-for-size|max-semi-space|max-old-space'`。
- **三档**：观察——两条 flag、不加老年代上限、适用/不适用场景注释如上；
  推断——小半空间降低新生代峰值，换取更频繁回收；未知——不同负载下的 GC 停顿
  代价本轮未实测。
- **IHUI 现状**：`Select-String 'optimize-for-size|max-semi-space'` → 0 命中。
  结论=完全没有低内存启动档。
- **落点建议**：CLI 启动包装层（`apps\cli\src\` 启动器或 SEA 包装）新增低内存档，
  经 env 显式开启；Windows 下经 `NODE_OPTIONS` 透传。
- **超越轴**：可测性——起子进程跑固定负载，断言峰值内存落在阈值内且退出码正常；
  零缺省行为变化：不开档不影响现有启动参数。
- **最小复现范围**：提供一条低内存启动入口，仅加 optimize-for-size 与小半空间参数，
  不动老年代上限；标注适用短任务、不建议长驻；Windows 参数传递走环境变量兜底。

### B4-10 lazy chunk manifest 版本防污染 + 两级预读

- **证据**：
  - `C:\workbuddy\resources\app.asar.unpacked\cli\bin\preload-lazy-chunks.cjs`：
    优先读 chunk 目录 `manifest.json` 的 `lazy_files` 数组，只预读本版本 chunks，
    避免并发升级把外来版本 chunk 放进 require.cache；manifest 缺失/破损/IO 异常
    回落 `readdir` 全加载；目录不存在返回 `missing` 不抛；单 chunk 预读失败静默
    计 `failed` 不阻塞；两级预读——先并发异步预读到 OS page cache，再按扩展名走
    loader 命中缓存；变体目录 `lazy` / `lazy-headless` / `lazy-lite-wb`。
  - 复核命令：`Select-String -Path <preload-lazy-chunks.cjs> -Pattern 'manifest.json|lazy_files|readdir|missing|failed|cache'`。
- **三档**：观察——manifest 优先顺序、破损回落、失败计数、两级预读、变体目录如上；
  推断——并发升级时旧进程持旧 chunk、新进程持新 chunk，manifest 防止旧进程误纳新文件；
  未知——manifest 生成时机与版本指纹校验细节本轮未量到。
- **IHUI 现状**：`Select-String 'lazy_files'` → 0 命中；`apps\cli\src\startup\prewarm.ts`
  是预热状态件读数（hit/miss/unjudged 三态，写 pid/指纹/时刻），不做 chunk 文件预读。
  结论=完全没有 manifest 版本防污染与 chunk 两级预读。
- **落点建议**：`apps\cli\src\startup\prewarm.ts` 旁新增 chunk 预读模块；manifest
  生成随构建产物落盘，读侧只消费不手改。
- **超越轴**：可测性——manifest 缺失/破损/单文件失败/目录不存在四态各有测试用例；
  版本不符的 chunk 不得进入缓存，断言缓存清单与 manifest 一致。
- **最小复现范围**：启动前读本版本 chunk 清单；先预读页缓存再走 loader；清单异常
  回退目录全量；单个 chunk 失败不阻断其余；记录命中/失败/缺失计数。

### B4-11 崩溃看门狗重启腿（计数 + 线性退避 + unref timer）

- **证据**：
  - `codebuddy-lite-wb.mjs` L2393 切片：死亡监听 `onDeath` 链路中，`restartAttempt++`，
    重启延时 = `backoffMs * restartAttempt` 线性退避，`restartTimer` 到点重新
    `spawn()`，timer `unref`；终止态/`dead` 状态不再重启。
  - 同族退避参照：L3202 上传退避族 `exponential`/`linear`/`fixed` + 20% jitter、
    封顶 30s；L3710 ACP 重连 `initialDelay 1s`/`maxDelay 30s`/无限重试/`jitter`。
  - 复核命令：`Select-String -Path <codebuddy-lite-wb.mjs> -Pattern 'restartAttempt|backoffMs|onDeath|restartTimer'`。
- **三档**：观察——计数、线性延时、unref、终止态不重启如上；推断——这是子进程崩溃
  后的看护重启，与 B4-05 的优雅自重启分属两条腿；未知——最大重启次数/彻底放弃阈值
  未在本轮切片中量到。
- **IHUI 现状**：`apps\cli\src\acp\backoff.ts` 已有指数退避 + full jitter + 封顶 +
  预算耗尽判定（纯函数只算不睡）；`Select-String` 未见进程死亡监听重启腿。
  结论=部分覆盖：退避算法已有，缺「死亡监听 → 计数 → 退避 → 重新派生」的进程级
  看护重启实现。
- **落点建议**：`apps\cli\src\subagents\` 或 `acp\` 下新增看护重启模块，退避 delay
  复用现成 `backoff.ts`；重启预算与放弃判定显式登记。
- **超越轴**：可测性——注入假子进程与假时钟，断言计数递增、延时线性增长、预算耗尽
  后不再重启；unref 语义保证看护 timer 不阻止进程正常退出。
- **最小复现范围**：为需看护的派生进程挂死亡监听；崩溃后按尝试次数算退避延时，
  到点重新派生；超过预算或目标已终止则放弃并出声；看护计时器不阻止主进程退出。

### B4-12 会话历史清理按路由意图开关

- **证据**：
  - `cli\bin\codebuddy` 主脚本切片：`CODEBUDDY_SESSION_HISTORY_CLEANUP` 只对
    交互式 CLI（TUI、`--serve` Web UI、cleanup 路由）缺省开启；headless、
    lite-wb、`--prewarm` 待命进程缺省关闭；判定依据是路由意图而非实际加载了哪个
    bundle；bundle 回退到 TUI 时也不会误开。
  - 复核命令：`Select-String -Path <codebuddy> -Pattern 'HISTORY_CLEANUP|prewarm|headless|--serve'`。
- **三档**：观察——开关键、缺省开启/关闭的路由族、判定依据如上；推断——待命/批量
  进程清理历史会误删后续会话材料，故按意图关；未知——清理动作本身的范围与保留期
  本轮未展开。
- **IHUI 现状**：`Select-String 'HISTORY_CLEANUP'` → 0 命中。结论=完全没有
  按路由意图分流的历史清理缺省开关。
- **落点建议**：`apps\cli\src\commands\` 启动路由判定处登记意图档；历史清理入口
  读取该档决定缺省，env 可显式覆盖。
- **超越轴**：零缺省行为变化——开关只改缺省，显式配置优先；测试钉死 headless/待命
  路由缺省关、交互路由缺省开。
- **最小复现范围**：启动时先判定路由意图（交互/服务/headless/待命）；历史清理缺省
  随意图档取值；显式 env 覆盖优先；判定维度与实际加载产物解耦。

## 未做 / 未判定

- 原生 `job-object.node`、`sandbox-cli.exe`、`sandbox-center.exe` 二进制内部未反编译；
  Job 句柄归属、嵌套拒绝、沙箱落地接口只到 JS 调用面，原生行为未判定。
- supervisor 跨进程单例是否另有内核命名 mutex：bundle 内 `CreateMutex`/命名互斥
  0 命中，未见；不排除原生层持有，本轮不判有也不判无。
- daemon 崩溃重启的最大次数/彻底放弃阈值、manual 条目心跳周期、注册表写入原子性
  未在 JS 面量到。
- `tsbx_rules.json` 的 `registry_rules`/`process_rules`/`network_rules` 为空表，
  规则实际执法强度未动态验证；`white_process` 匹配粒度（可执行名/全路径）未判定。
- 未读取用户目录下任何会话/凭据/锁文件内容；未运行 WorkBuddy 本体、CLI 或 daemon。
- IHUI 侧结论基于静态 Select-String 对账；本轮未跑 typecheck/测试/构建（红线），
  现状覆盖度以文件命中为准，运行时行为未复核。
- `vendor\sandbox` 其余平台目录（linux-arm64/linux-x64/darwin）未展开，规则是否
  随平台分叉未判定。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
