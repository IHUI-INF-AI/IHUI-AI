<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# W1 取证报告 — WorkBuddy 5.9.3（Tencent）本机安装逆向

> 席位：goal-b49 逆向取证席（只取证，不改仓库代码、不 commit）
> 结论纪律：每条标注 观察 / 推断 / 未知；0 命中 ≠ 对方无该能力。
> 红线：不粘对方专有源码（只给路径+符号+偏移+行为描述）；不读不打印任何凭据内容。

## 1. 现场读数

- 本仓分支：`main`
- 本仓 HEAD：`6e6ea6f5c8be194d24aee8142adcc723b54bf8be`
- 工作树状态：`git status --porcelain | wc -l` = 195（多会话并行，本席不触碰）
- 取证引擎：`rea` = `/d/caches/npm/prefix/rea`，`rea --version` = **6.4.0**
- 对照程序安装根：`G:\workbuddy\`

| 被分析对象 | 绝对路径 | 实测大小 |
| --- | --- | --- |
| 主程序 | `G:\workbuddy\WorkBuddy.exe` | 204,590,360 B |
| Electron 应用包 | `G:\workbuddy\resources\app.asar` | 181,996,084 B |
| 已解包 main | `G:\workbuddy\resources\app.asar.unpacked\main\` | 1 MB |
| 已解包 cli | `G:\workbuddy\resources\app.asar.unpacked\cli\` | 98 MB |
| 已解包 native | `G:\workbuddy\resources\app.asar.unpacked\native\` | 2 MB |
| 已解包 renderer | `G:\workbuddy\resources\app.asar.unpacked\renderer\` | 17 MB |
| 已解包 node_modules | `G:\workbuddy\resources\app.asar.unpacked\node_modules\` | 287 MB |
| 附带资源 resources | `G:\workbuddy\resources\app.asar.unpacked\resources\` | 117 MB |
| 附带 editor-sdk-supervisor | `G:\workbuddy\resources\workbuddy-editor-sdk-supervisor.exe` | 250,136 B |

- CLI 包自述：`resources/app.asar.unpacked/cli/package.json` → name `@genie/agent-cli`，version `2.165.0`，description 自述为 "Use CodeBuddy, Tencent's AI assistant, right from your terminal"（**观察**）
- native 模块清单：`perf-metrics/`、`turing-sdk/`、`wechat-copydata-decoder/`（**观察**，未执行）
- `app.asar.unpacked` 下另有 `renderer/`、`resources/` 两目录，超出本席原射程登记，按机主"整体分析"授权一并纳入取证面（**观察**）

### REA 实跑读数（现读，非推断）

| 跑法 | 目标 | 结果 |
| --- | --- | --- |
| `rea analyze-javascript-application <app.asar> --json` | 181,996,084 B | **拒绝**：`code=artifact_integrity_mismatch`，`details.logical_path=cli/bin/native/win32-x64/job-object.node`，declared `0f7411db…` ≠ calculated `3cbb85d4…` |
| 同上 + `--integrity-policy record-and-continue` | 同上 | 进度到 **17/7189** 文件（约 10 分钟）判定不可完成，本席主动终止 ⇒ **全量 asar 图未覆盖（未知）** |
| `… unpacked/main --artifact-format directory` | 411,734 B / 3 文件 | 完成：`parsed_javascript_files=3`、`visited_ast_nodes=54409`、`findings=101`、`modules=43`、`parse_failures=0`；语义图 `coverage.status=partial, truncated=true`（`preload/fork-preload.cjs` 超父级结果预算） |
| `… unpacked/cli/vendor/shim --artifact-format directory` | 112,514 B / 8 文件 | 完成：`parsed_javascript_files=8`、`visited_ast_nodes=13186`、`findings=49`、`parse_failures=0` |
| 证据件 | — | `main-evidence.json`、`shim-evidence.json`、`asar-evidence.err`（含逐文件进度流水，本席留存于本 tmp 目录） |

**方法学自证（观察）**：main 目录 REA 的 `summary.ipc.literal_channels = 0`，而人工 grep 同目录得 41 条 `wb:` 通道字面量 ⇒ REA 的 IPC 投影对该 esbuild 产物未命中，**该维以人工取证为准**；任何"REA 0 命中"在下表一律不得读成"对方没有"。

## 2. 取证结论表

| # | 能力名 | 三态 | 证据锚点（绝对路径 + 偏移/符号） | 一句话行为描述 |
| --- | --- | --- | --- | --- |
| 1 | 应用包完整性自校验（逐条目 sha256） | 观察 | `G:\workbuddy\resources\app.asar` + REA `details.declared_sha256/calculated_sha256` | ASAR 头为每个 unpacked 条目声明哈希，读取方比对后才能采信；签名后置的原生件必然矛盾（正是本机现状）。 |
| 2 | Windows Job Object「随父而终」容器 | 观察 | `…\cli\bin\no-orphans.cjs:install()` / `…\bin\windows-job.cjs:loadBinding()` / `…\bin\native\job-object.d.ts`（NAPI-RS 生成，导出 2 个符号） | CLI 入口在任何业务 import 之前把自身挂进 kill-on-close Job，退出时内核回收全部后代；可用 `--no-orphans` 与环境变量两路关闭，加载失败只告警不崩。 |
| 3 | 刻意不采用 Bun 的 parent-death 看门狗 | 观察 | `…\cli\bin\no-orphans.cjs` 头注（约 24—27 行区） | 让 daemon/后台进程比启动器活得久，但仍负责回收自己的后代——把"父死子亡"与"子树自清"分成两格。 |
| 4 | 脱离式守护监督进程（supervisor over IPC） | 观察 | `…\cli\bin\daemon-supervisor.cjs:prepare()/start()`，`STATE=Symbol.for('codebuddy.daemon-supervisor')` | 只有 `daemon start|restart|install` 才派生一个 detached、windowsHide、stdio 三 ignore + ipc 的监管子进程；监管进程失败 ⇒ 拒绝后续 daemon 请求而不是让发起方崩溃。 |
| 5 | 三语言横切注入链（bash / node / python） | 观察 | `…\cli\vendor\shim\shell-runtime-bash-env.sh`、`node-language-shim.cjs`（994 B）、`sitecustomize.py`（55,143 B） | 经 `BASH_ENV` + `NODE_OPTIONS --require` + `sitecustomize.py` 三个宿主入口，把同一套删除/文件系统护栏注入**任意子进程**，而非只在自己的工具函数里判。 |
| 6 | 会话缺席即不生效 | 观察 | `…\shim\node-language-shim.cjs` 首屏（`SESSION_ID` 缺失即 `return`）+ `genie-safe-delete.cjs` 兼容旧入口 | 无会话 ID 时整条护栏静默退出；旧 `NODE_OPTIONS` 值仍可加载新组合器（向后兼容包装件保留）。 |
| 7 | Shell 层 rm/unlink/rmdir 重定向到回收站 | 观察 | `…\shim\safe-bin\safe-delete-bash-env.sh`（定义 3 个同名函数并 `export -f`）+ `…\shim\safe-bin\{rm,rmdir,unlink}` + `…\cli\vendor\genie-trash\win32-x64.exe` | 子进程里的 `rm` 不再真删，而是走独立回收站可执行程序；`CODEBUDDY_SAFE_DELETE_ENABLED=0` 是唯一免钩开关。 |
| 8 | Node fs 层删除钩子 | 观察 | `…\shim\node-safe-delete-shim.cjs`（33,036 B） | 对 `fs` 的删除族 API 打钩，与 shell 层同一后端；另有 darwin 专属"原生删除诊断"开关。 |
| 9 | 批量删除护栏：两阶段 check/approve | 观察 | `…\shim\safe-delete-bulk-guard.cjs:10-16`（阈值 20 / 锁 2000ms / 陈旧锁 5min / 回合态 TTL 7d / 样本 5 / 显示上限 9999）、`:442-443`（`check`、`approve` 两条命令） | 超过阈值即要求显式 approve 才可继续；状态目录 + 重放文件 + 报告路径三件分离，锁带陈旧回收。 |
| 10 | 护栏三态结论（可整改 / 需确认 / 护栏自身故障） | 观察 | 同上三个标记名 `…CONFIRM_REQUIRED / …REJECTED / …GUARD_ERROR` | 把"护栏自己出错"单列一态，不与"拒绝删除"混桶——与本仓 §0.3 的"未判定"同型。 |
| 11 | 代理式 fs 钩子（file-token + host-op） | 观察 | `…\shim\node-brokered-fs-shim.cjs`（43,160 B），钩住 12 个 fs 族 API（`readFile/writeFile/appendFile/open/copyFile/mkdir/rmdir/rm/unlink/rename/symlink/chmod`） | 文件操作先向 broker 申请令牌，主进程决定是否放行；开关两枚（`CODEBUDDY_BROKERED_FS_HOOK_ENABLED` 或 sandbox 档）任一成立即启用。 |
| 12 | broker IPC 传输层（含优先级配额） | 观察 | `…\shim\broker-ipc-client.cjs:13-19`（超时 20s、并发 128、异步上限 127、排队 8192、三档优先级 low/normal/high） | JSON-line over unix socket / named pipe；**同步请求恒留一格**不被异步占满；本层只拥有传输，语义判定留在调用方（"neutral"分层）。 |
| 13 | 可执行程序黑名单的 fail-closed 退出码契约 | 观察 | `…\shim\broker-program-policy-check.cjs:1-8` 头注 + `checkProgramPolicy()` | 三码定档：0=允许或未配置、126=禁用程序、**13=策略检查不可用即拒**；取不到 broker ⇒ 拒绝执行而非放行。 |
| 14 | brokered 核心工具集（30 条命令） | 观察 | `…\shim\brokered-bin\`（`7z/cat/chmod/cp/dd/find/grep/head/ln/ls/mkdir/mv/rar/readlink/realpath/rm/rmdir/sed/tail/tar/tee/touch/truncate/unlink/wc/zip` + `codebuddy-toybox-dispatch`）、`…\cli\vendor\toybox-macos\` | Unix 侧把整套 coreutils 换成走 broker 的 toybox 分发器；bash 启动时批量 `unalias`/`unset -f` 后用 PATH 前置接管。 |
| 15 | OS 级沙箱执行引擎（驱动/加载器/中心/CLI/GC） | 观察 | `…\cli\vendor\sandbox\5.9.5\`：`sandbox-cli.exe` 2,371,352 B、`sandbox-center.exe` 9,918,744 B、`sandbox_ffi.dll` 2,203,928 B、`tsbx*.dll` 六枚、`betterleaks.exe` 23,096,088 B、`sandbox-cli-gc.exe` 222,488 B | 命令在受控沙箱内跑，另有独立 GC 腿与泄漏探测腿（betterleaks）。 |
| 16 | 声明式沙箱规则表（按操作分维） | 观察 | `…\sandbox\5.9.5\tsbx_rules.json`：`default_action="ask"`、`file_rules=array[44]`（每条含 read/write/delete 三动作 = 132 个判定点）、`file_rules_user` 1 条、`white_process` 8 条 | 凭据路径（`.ssh\**`、`.gnupg\**`）以规则形态 **deny read**；`registry/process/network_rules` 本档为 0（观察到的只是未启用，不等于引擎不支持）。 |
| 17 | 网络出口双引擎分工 | 观察 | 同文件 `_comment_network_policy` 一行 + `network_policy={enabled,default:"allow",deny_ips,deny_domains}` | tsbx 只做 DNS hook 域名拦截（TCP 恒放行），真正的 TCP 决策交给 Rust LocalProxy——一层只做一件事，避免两处裁决打架。 |
| 18 | 自带工具链（不信任宿主环境） | 观察 | `G:\workbuddy\resources\vendor\`：`python\python.exe`(+`python313.dll`)、`PortableGit\`、`node.zip`；`…\cli\vendor\ripgrep\x64-win32\{rg.exe,ripgrep.node}`、`zsh-macos\` | 解释器与检索工具随包分发，子进程不依赖用户 PATH 上的版本。 |
| 19 | 安装清单 + 自修复 + 更新可视进度 | 观察 | `G:\workbuddy\resources\install-manifest.json`（`version:"1"`、`appVersion:"5.9.3"`、`fileCount:118`、逐文件路径含原生件）+ `Newtonsoft.Json.dll`/`RepairApp.exe` + `resources\scripts\{launch-update-progress.vbs,update-progress.ps1}` | 安装后按清单核对并修复；更新过程有独立 UI 脚本承载（vbs 包装以避开控制台）。 |
| 20 | 产品清单多变体（一份代码 5 份形态） | 观察 | `…\cli\`：`product.json` 387,311 B（**55 个顶层键**）+ `product.cloudhosted.json` 23,480 / `product.internal.json` 41,587 / `product.ioa.json` 68,122 / `product.selfhosted.json` 11,136 B | 端点、鉴权、更新、模型、工具、代理、命令、技能市场、深链、遥测、平台 appId 全部外置为清单；SaaS/私有化/内网三形态只换 JSON。 |
| 21 | 工具注册表面（65 枚） | 观察 | `product.json` → `tools=array[65]`（`Bash/PowerShell/Glob/Grep/Read/Edit/Write/NotebookEdit/WebFetch/WebSearch/Agent/Skill/SkillManage/TaskCreate·Get·Update·List/EnterPlanMode·ExitPlanMode/KillShell/TaskOutput/SlashCommand/AskUserQuestion/AskUserForStructuredInput/LSP/StructuredOutput/ToolSearch/DeferExecuteTool/ImageGen·Edit/VideoGen/AudioTranscribe/MemoryUpdate·Recall/Artifact·ArtifactControl/ComputerUse/TeamCreate·Delete/SendMessage/SendUserMessage/EnterWorktree·LeaveWorktree/CronCreate·Delete·List/DelegateTool/WeChatReply/WeComReply/PushNotification/ReportFindings/Workflow/Monitor/REPL/A2AGetAgentCard·SendMessage·GetTask·CancelTask/ListMcpResources·ReadMcpResource·WaitForMcpServers`） | 值得注意的四组：**惰性工具装载**（ToolSearch/DeferExecuteTool）、**A2A 四件套**、**定时任务三件套**、**worktree 作为工具**。 |
| 22 | 内部效用代理（21 枚） | 观察 | `product.json` → `agents=array[21]`（含 `compact/contextSummary/summaryGenerator/terminalTitleGenerator/viewImageDescriber/promptSuggestion/enhance-prompt/promptHookEvaluator/autoModeClassifier/memorySelector/insightsAnalyzer/securityReviewer/agentInstructions/statusline-setup/handoff-summary/pulse/Explore/Plan`） | 把"压缩/摘要/标题/图像描述/提示建议/模式分类/记忆挑选/洞察/安全审阅/交接摘要"各自定名为代理，而非散在主循环里。 |
| 23 | 按消耗档位强制审批 | 观察 | `product.json` → `skillApprovalRules[0]`（`target.type="bundledSkill"`、`mandatory:true`、`presentation.category="highCredit"`、`failureMode="requireApproval"`） | 高积分消耗的内建技能执行前必须人工批准；**失败方向 = 要审批**，不是放行。 |
| 24 | 请求级步数上限 + 四档 token 阈值 | 观察 | `product.json` → `requestMaxStepLimit=100`；`tokenUsageThresholds` 现读四桶：`compact{emergency:0.4, modelOverrides.deepseek:0.5}`、`summary{emergency:0.15}`、`request{emergency:0.9}`、`inputTokens{warning:0.6, critical:0.7, emergency:0.9, preMessage:0.5}` | 单次请求有硬步数预算；token 阈值按**四个用途各设一档且可被 modelOverrides 按厂商覆盖**（deepseek 的 compact 紧急线放宽到 0.5）——阈值不是全局常数而是随模型能力变形。 |
| 25 | 输出风格注册（5 档） | 观察 | `product.json` → `outputStyles=array[5]`：`Default/Proactive/Concise/Explanatory/Learning` | 模型行为风格作为可注册产物而非硬编码提示。 |
| 26 | 声明式 workflow 引擎（5 阶段 + 对抗票决） | 观察 | `…\cli\builtin\workflows\deep-research.workflow.js:1-8`（`meta.phases`：Scope→Search(5 并行)→Fetch(去重取 15)→**Verify: 每条断言 3 票对抗，需 2/3 反驳才判死**→Synthesize）+ `extractJSON()/validateJSON()`（约 16—60 行区） | 为不支持 structured output 的模型（注释点名 deepseek-chat 的 reasoning_effort 冲突）手写 JSON 抽取 + 手工 schema 校验三形态兜底。 |
| 27 | 预热进程池 + 带外控制客户端 | 观察 | `…\cli\bin\cbc-prewarm`（13,067 B）头注：只用内置 `net/fs/os/path`，故意不 require 主 bundle；`list/ping/status/activate` 四命令；win 走 `\\.\pipe\`、unix 走 `.sock`；发现目录复用 daemon 会话目录的 `PidFileEntry.kind==='prewarm'` | 以毫秒级开销查询/激活预热实例——**控制面与被控运行时彻底解耦**。 |
| 28 | 启动画像器（opt-in，零副作用） | 观察 | `…\cli\bin\startup-profile.cjs`（14,142 B）`parseOptions()`：`--startup-prof[|-md|-dir|-name]` + `CODEBUDDY_STARTUP_PROFILE=1`；`AsyncLocalStorage` 归因；对输出路径拒控制字符 | 未开启时入口不产生任何 I/O；开启即出 markdown 报告。 |
| 29 | 低内存入口档（带实测对照表） | 观察 | `…\cli\bin\codebuddy-lowmem`（2,769 B）shebang 注入 `--optimize-for-size --max-semi-space-size=2`；文件头留 macOS arm64 五轮中位数的 peak/real 对照表 | 不改一行业务代码，只换一个入口 shebang；并把收益写成对照表。 |
| 30 | 懒加载 chunk 预取（升级安全 + 三态来源） | 观察 | `…\cli\bin\preload-lazy-chunks.cjs:9-16` 契约注释：优先读 `manifest.json.lazy_files`，破损/缺失回落 readdir，目录不存在返回 `source:'missing'` 不抛；单块失败静默计数；返回 `{loaded,failed,source}` | 只加载"本 bundle 版本"的块，防并发升级把外来版本 chunk 混进 `require.cache` 污染模块图。 |
| 31 | 主进程事件总线的成本/容量/驱逐通道 | 观察 | `…\main\preload\fork-preload.cjs`（307,624 B）内 41 条 `wb:` 字面量（grep 现读），含 `conversation:creditChanged`、`:estimatedCostChanged`、`:contextUsageChanged`、`:capacityQueueUpdate`、`:queueUpdate`、`:mcpStartupStatus`、`:childAgentEvent`、`lifecycle:eviction-warning`/`:eviction-recovered`、`internal:extension-host-capability` | 积分、预估成本、上下文占用、服务端容量排队、MCP 就绪、子代理事件都作为**独立具名通道**推给渲染层；驱逐有 warning/recovered 成对通道。 |
| 32 | 渲染层网络请求经主进程代跑 | 观察 | 同上，通道 `wb:http:get`、`wb:http:post`、`wb:invoke:request`/`:response`、`wb:boundary:guest-ready`、`wb:env:snapshot` | 渲染进程不直连网络，统一由主进程代取并回 `wb:invoke` 信封；guest 边界有就绪握手。 |
| 33 | 原生件 napi 导出面（4 枚，未执行） | 观察 | `job-object.d.ts`：`ensureKillOnCloseJob`、`isProcessInJob(pid)`；`…\native\perf-metrics\index.cjs`：`isSupported/getLoadError/collect(onDone)/cancel()`；`…\native\turing-sdk\index.cjs`：`configure(4 参)/fetchDeviceToken(options)`；`…\native\wechat-copydata-decoder\index.js`：`readCopyDataPayload(lParam)/getPointerSize()` | 全部按"加载失败 ⇒ `binding=null` + 记 `loadError` + `isSupported()=false`，用到时才 `requireBinding()` 抛"的同一模板写。 |
| 34 | 采集器不拥有调度权（无 interval 设计） | 观察 | `…\native\perf-metrics\index.cjs` 的 `collect` 文档注释（约 40—55 行区） | 刻意不在插件里放 interval：调度权归调用方，以避开线程与其销毁次序问题；`cancel()` 后回调"既无 error 也无 sample"= 正在退出而非失败。 |
| 35 | 跨窗口消息解码（与外部桌面应用互通） | 观察 | `wechat-copydata-decoder` 包自述 + `TuringShieldSDK.dll` 1,243,136 B 旁证的 `qimei.dll`、`main\qimei-helper.js`(1,001 B)、`resources\qm\qm-helper.exe` | 从 `hookWindowMessage` 的 lParam 指针解 `COPYDATASTRUCT`（x64/x86 指针宽度由插件报）；设备指纹侧另有 `turing-sdk-variant.json={"variant":"domestic"}`。 |
| 36 | 企业微信/微信回复能力 | 观察（注册表） / 未知（实现） | `product.json.tools` 含 `WeChatReply/WeComReply/PushNotification`；`…\cli\vendor\wecom-cli\wecom-cli.exe` | 存在具名工具与配套可执行程序；本席未展开其调用链。 |
| 37 | A2A（Agent-to-Agent）协议四工具 | 观察（注册表） / 未知（实现） | `product.json.tools` 含 `A2AGetAgentCard/A2ASendMessage/A2AGetTask/A2ACancelTask`；`…\cli\package.json` scripts 含 `a2a:inbound/a2a:server/a2a:session` | 有服务端与入站两条腿；对方实现细节未取（在 9.88 MB 主 bundle 内，未展开）。 |
| 38 | 质量回归夹具命令面 | 观察（清单层面） | `…\cli\package.json` scripts：`quality:list / quality:run / quality:trace / quality:record`、`test:e2e`、`test:quality`、`build:brokered-sandbox-native`、`build:windows-job(:rust)`、`check:windows-job`、`package:headless`、`package:standalone`、`build:web-ui`、`build:builtin-embed` | trace/record 成对 ⇒ 存在"录制-回放"型 E2E 质量台架；本席未展开夹具本体。 |
| 39 | 渲染层与主进程整体图 | **未知** | `…\app.asar.unpacked\renderer\` 17 MB、`app.asar` 内 7,189 文件 | 全量 REA 跑到 17/7189 被终止 ⇒ 渲染层组件图、路由、状态管理**未取证**，不得据此下任何结论。 |
| 40 | 凭据/密钥面 | **未取（红线）** | `.workbuddy\`、`connector-keys\`、`%USERPROFILE%` 下任何会话件 | 按机主红线：未读、未打印、未比对内容，本席对"对方存了什么凭据"零结论。 |

## 3. 与 IHUI 对位缺口表

> 按落地价值降序。本仓行号为现读 grep/Read 所得；档位定义：`已有对位`=同等能力同等粒度；`半格`=有同名能力但缺指明的某一维；`零对位`=本仓无可检出实现 = 落地候选。
>
> **本表统计（现读）**：17 行 = 零对位 10（①③④⑤⑥⑦⑪⑭⑯⑰）+ 半格 7（②⑧⑨⑩⑫⑬⑮）。其中 **⑯⑰ 本席建议不落地**（合规/无消费者），故真正"零对位 = 落地候选"= **8 条**（①③④⑤⑥⑦⑪⑭）。

| 能力 | 本仓现状（绝对路径:行号） | 档位 | 建议落地面 | 超越轴 |
| --- | --- | --- | --- | --- |
| ① 删除保护链：回收站后端 + 批量两阶段护栏（阈值/锁/重放/报告四件分离） | `G:\IHUI-AI\apps\cli\src\tools\worktree.ts:229`（`fs.rmSync(recursive,force)`）、`G:\IHUI-AI\apps\cli\src\tools\file-batch-edit.ts:132,368,479`、`G:\IHUI-AI\apps\cli\src\tools\file-edit.ts:535`（`fs.unlinkSync`）——无任何回收站、无批量阈值、无 approve 相 | **零对位** | `apps/cli`（工具层 + 新 `tools/safe-delete/`）+ `packages/shared`（护栏判据单源）+ `scripts`（守门） | 可测性：阈值/锁 TTL/三态结论做成纯函数 + 镜像测试，对方阈值埋在 shell 与 exe 里不可单测；贴合架构：把"护栏自身故障"单列一态天然对齐本仓 §0.3「未判定」与 §12e 恒红门禁令，且直接消掉 AGENTS.md §5e-2「大批量删除只能靠 robocopy 人工口径」这一格。 |
| ② 按操作分维的声明式文件 ACL 规则表（read/write/delete 三维 × 44 条，`default_action="ask"`，凭据目录 deny read） | `G:\IHUI-AI\apps\cli\src\sandbox\index.ts:140`（`FolderTrustLevel='trusted'\|'read-only'\|'forbidden'`）、`:158`（`checkFolderTrust`）、`:199`（`SANDBOX_PROFILES` 五档）；消费点仅 `G:\IHUI-AI\apps\cli\src\tools\index.ts:1956` 一处 | **半格**（缺 read/write/delete 三动作独立裁决维；缺"规则表"这一可入库产物；默认值是档位而非 `ask`） | `packages/types`（规则类型）+ `apps/cli/src/sandbox`（判定）+ `scripts/data`（规则表 JSONL） | 边界：规则表进仓 ⇒ 可加差值棘轮守门（新增 deny 缺口即红）与豁免存活期（§0.7）；对方规则随安装包二进制分发、审不到也测不了。本仓凭据目录保护目前是 env 屏蔽（`sandbox/index.ts:80,99,109,131`），把同源判据扩到**路径读**这一维即可补齐"已被坑过两次"那格。 |
| ③ 子进程网络出口引擎（DNS 域名裁决 + 独立 TCP 代理双引擎，`deny_domains/deny_ips`） | `G:\IHUI-AI\apps\cli\src\tools\fetch-url-egress.ts:6-14`（仅 `fetch_url` 工具的字面量出口守卫，明确"NO DNS preflight"）；`apps/cli/src/sandbox/index.ts` 内 `network/egress/proxy/dns` 关键字 **0 命中**（grep 现读）⇒ 智能体经 Bash 发出的子进程网络流量无人管 | **零对位** | `apps/cli`（`sandbox/egress/` 新腿 + `tools/terminal.ts` 注入点）+ `apps/desktop`（Tauri 侧同源策略） | 超越：把两引擎分工（DNS 只判域名、TCP 只由代理判）用**可注入 fake 的裁决函数**实现，本仓可在 CI 里跑；对方需真驱动。且出口决策逐条落台账可回读（对齐 §5e-3「量得到」）。 |
| ④ Windows Job Object「随父而终」+ 脱离式监督进程 | `G:\IHUI-AI\scripts\install-console-window-hook.mjs:7,29,89`（机器级只解决 `windowsHide`，不管孤儿）；`G:\IHUI-AI\apps\cli\src\tools\git.ts:204`、本仓 `spawn` 面按 §12g 只写 stdio；全仓 `job.?object/killOnClose` **0 命中**（grep 现读，排除 `.venv/dist/node_modules/.mypy_cache`） | **零对位** | `apps/cli`（入口首屏安装 + 依赖注入点）+ `scripts`（派生纪律守门扩一维） | 超越：对方加载失败只 `warn`；本仓按 §0.3 必须把"装不上 Job"记成**未判定并点名**，不得记绿；再补一条反向门（写了 `windowsHide` 却没装 Job ⇒ WARN），把 AGENTS.md §5b/§12g 那两条口头纪律变成器物。 |
| ⑤ 工具面惰性装载（`ToolSearch` + `DeferExecuteTool`：按需把 schema 付给模型） | `G:\IHUI-AI\apps\ai-service\app\services\mcp_server.py` 现读 `^async def _tool_\|^def _tool_` = **80 枚**全量常驻；`G:\IHUI-AI\apps\cli\src\tools\builtins.ts` 9 枚；本仓 `toolSearch/deferExecuteTool` 在 `apps/`+`packages/` 源码内 0 命中（仅 `.venv` 第三方 SDK 命中，非本仓实现） | **零对位**（`packages/shared/src/chat/tool-display.ts:26` 与 `mcp-tool-activity.ts:132` 只是展示层命名，不是装载层） | `apps/ai-service`（`app/core/` 装载预算 + `routers/tools`）+ `apps/cli`（provider 侧工具表）+ `packages/types`（工具契约三面投影已有，接同一处） | 可测性：把"哪些工具进入本轮 prompt"做成可断言集合 ⇒ 能钉 token 回归；对方无此对账。贴合架构：与 §19 声明的"工具契约三面投影单源 `packages/types/src/tool-contract,schema-projection`"天然同一落点，不用新建机制。 |
| ⑥ 成本档位强制审批（`mandatory + failureMode=requireApproval + presentation.category`） | 本仓审批面：`G:\IHUI-AI\apps\cli\src\tools\danger-gate.ts`（213 行）、`permission-lease.ts`、`G:\IHUI-AI\apps\cli\src\tools\sandbox\policy.ts:221`；`highCredit/credit.*approv` 关键字在 `apps/cli/src`+`packages/types/src` **0 命中**（grep 现读） | **零对位** | `apps/api`（积分/配额同源）+ `apps/cli`（审批闸）+ `apps/web`（审批 UI 复用 `packages/ui-react` Dialog） | 超越：本仓已有积分体系与 §5e-3 配额身份去重 ⇒ 审批线可由**真实余额与消耗实测**驱动而非写死档位，并把"审批被拒 ⇒ 副作用未发生"作为断言（对齐 §5「鉴权不等于授权」）。 |
| ⑦ 对抗式多票校验 workflow（3 票反驳、2/3 才判死）+ 无 structured-output 模型的 JSON 抽取校验兜底 | `G:\IHUI-AI\apps\ai-service\app\services\agent_step_recorder.py:37`、`app\core\tunables.py:22`（`MAX_STEPS_PER_RUN=2000` 是**留存**上限，非循环预算；本仓无可检出的请求级步数硬帽）；票决类关键字 0 命中；AGENTS.md §8「独立评估(禁模型自评 yes)」有规则、无器物 | **零对位** | `apps/ai-service`（LangGraph 子图 `app/services/`）+ `apps/cli`（goal 模式 §8 第 3 步的器物） | 超越：票决结果与依据落 `.ihui-agent/state/` 台账 + 本仓守门可判"自评 yes 无对照 ⇒ 未判定"，把 §8 那条最容易静默失效的纪律变成可回归的器物；同时把 `requestMaxStepLimit` 这一维补成真预算。 |
| ⑧ 三语言横切注入（把护栏装到**别人的子进程**里：`BASH_ENV`/`NODE_OPTIONS`/`sitecustomize.py`） | `G:\IHUI-AI\apps\ai-service\app\core\shell_snapshot.py:48`（只**读** `BASH_ENV` 做快照，不装钩子）；`G:\IHUI-AI\scripts\install-console-window-hook.mjs:29,89`（唯一同型物：写机器级 `NODE_OPTIONS`，且只管窗口可见性） | **半格**（机制已在本仓存在并被验证可用，缺"把删除/出口钩子挂上去"这一格） | `apps/cli` + `apps/ai-service` + `scripts`（与 ①③ 同批落地，否则钩子上去无内容可判） | 贴合架构：本仓已有"钩子文件必须 `.mjs` 且放仓库外""派生 git 必须显式 stdio"两条血泪纪律 ⇒ 装钩时天然带 §0.10「失效方向 = 多要一次定向说明」；对方钩子坏了静默降级（`node-language-shim.cjs` 里 broker 钩子 `catch {}`），本仓必须点名。 |
| ⑨ 应用包逐条目完整性声明（sha256 per-entry） | 本仓同源能力：`G:\IHUI-AI\scripts\watermark.mjs`（五态载荷校验）、`G:\IHUI-AI\scripts\check-prod-bundle-shadow.mjs`（运行副本逐字节等值）；缺"发布包自带逐文件清单+哈希"这一格 | **半格** | `apps/desktop`（Tauri 打包腿）+ `apps/cli`（发布腿）+ `scripts`（对账门） | 超越：清单入仓 ⇒ 任何"本机被改过的原生件"由守门现读发现（对齐 §5b「判断执行的是哪份文件按实际路径不按 `git ls-files`」）；对方那份清单在本机已出现声明与实际不符（本席证据 #1）却无人判。 |
| ⑩ 自带工具链（python / PortableGit / node / rg / toybox 随包分发） | `G:\IHUI-AI\apps\desktop\src-tauri\src\git_local_status.rs:374`：**本仓当前把 `~/.workbuddy/binaries/PortableGit/cmd/git.exe` 写进 git 探测候选**（依赖对方安装残留）；`scripts/lib/gitdir.mjs` 同型首选 | **半格**（有候选清单与降级，无自带件；且对竞品产物存在隐性依赖） | `apps/desktop` + `apps/cli` + `scripts`（vendor 清单与校验） | 边界/隐私：把该硬编码依赖改为显式登记（owner+到期+证据）或自带件，摘掉"我们的 git 可用性取决于别人装没装 WorkBuddy"这一格；本仓 §0.6 单一真相源要求同一路径只由 `gitdir.mjs` 报。 |
| ⑪ CLI 启动工程三件套：预热池 + 启动画像 + 低内存档 | `G:\IHUI-AI\apps\cli\src\` 内 `prewarm/startup.?profil/lazy.?chunk/max-semi-space` 全 **0 命中**（grep 现读）；本仓仅有 `G:\IHUI-AI\scripts\dev-with-warmup.mjs`（服务层预热，不同层）与 `apps/web/package.json:14` 的 `--max-old-space-size`（构建期，非运行档） | **零对位** | `apps/cli`（入口 `bin` 层 + 新 `src/prewarm/`） | 可测性：预热控制面走带外客户端（对方 `cbc-prewarm` 只用内置模块 ⇒ 毫秒级 list/ping/status/activate），本仓可把"预热是否真被复用"做成可断言读数；画像报告直接进本仓守门做回归比对，避免"提速"变成不可证的说法。 |
| ⑫ 主进程具名事件细粒度（credit/cost/contextUsage/capacityQueue/MCP 就绪/驱逐成对） | `G:\IHUI-AI\apps\ai-service\app\core\sse_contract.py:453-456`（token 预算 80/95/100 三档 + 429 契约）、`app\core\retry_after.py:8`（21 provider 真解 Retry-After）；`capacityQueue` 关键字在 `apps`+`packages` **0 命中**；`G:\IHUI-AI\apps\cli\src\tui` 内 context 用量表关键字 0 命中 | **半格**（缺"服务端容量排队位置"推送到端、缺 TUI 上下文用量实时读数、驱逐成对通道无） | `apps/ai-service`（SSE 事件）+ `apps/web`（`packages/shared/src/chat` 事件词表）+ `apps/cli`（TUI 一格读数） | 贴合架构：本仓已有 §「监控告警词表单一真相源」与 i18n 五语言同批纪律 ⇒ 新增通道必然同批补五语言 + 词表对账（对方通道是散字符串）；驱逐 warning/recovered **成对**这一点可直接补进 §「钩子无终态不得渲染成完成」。 |
| ⑬ 声明式 workflow 产物（`meta.phases/whenToUse` 外置 + 阶段化编排） | 本仓有 LangGraph（`apps/ai-service`）与 `packages/shared/src/constants`，但无可检出的"阶段标题+何时使用"作为一等注册产物；`apps/cli/src/modes/plan-build.ts`、`personas/` 是模式而非 workflow | **半格** | `apps/ai-service`（`app/services/` 注册表）+ `apps/cli`（`skills/` 侧消费） | 边界：`whenToUse` 文本进 i18n 与 §10 交付一致性判据可被机器对账；对方该字段只进模型提示、无人校验其有效性。 |
| ⑭ 产品形态多变体（一份代码 5 份 manifest，55 键全外置） | `G:\IHUI-AI\scripts\brand-glossary.json`（翻译术语源，非部署形态源）；`apps/web` 端点/开关散在 env 与源码，无可检出的形态清单 ⇒ 私有化/SaaS 切换无单一产物 | **零对位** | `packages/config`（形态清单唯一源）+ `apps/api\|web\|ai-service`（消费侧）+ `scripts`（形态对账门） | 超越：变体差异做成 JSON 对账门（缺键/多键即红，同 `SANDBOX_PROFILES: Record<SandboxProfile,…>` 的 typecheck 强制手法，见 `apps/cli/src/sandbox/index.ts:188-190` 注释那条设计）。 |
| ⑮ 请求级步数硬预算 + 四用途 token 阈值（含按厂商覆盖） | 见 ⑦：`G:\IHUI-AI\apps\ai-service\app\core\tunables.py:22` 是**留存**帽（2000 步）不是预算帽；本仓阈值现读只有单条三档线（`app\core\sse_contract.py:453-456` 的 80%/95%/100% ⇒ 429），未按 `compact/summary/request/inputTokens` 四用途分桶，**无按厂商覆盖机制** | **半格**（缺"用途分桶"与"modelOverrides 随厂商变形"两维） | `apps/ai-service`（`app/core/tunables.py` + `sse_contract.py` 同源）+ `apps/cli`（compaction 触发与 `context-guards.ts:277-307` 的 orphan 自证挂同处） | 可测性：本仓已有 §「差值棘轮 + 现读数字」纪律 ⇒ 阈值改值必须同批改镜像测试，对方阈值只躺在 JSON 里；贴合架构：厂商覆盖这一维天然落在本仓 LiteLLM provider 注册表 + §「provider 健康四档单一真相源」那一格里，不用新建机制。 |
| ⑯ 设备指纹 / 风控 SDK（TuringShield + qimei 三件套） | 无对位，本仓也无同类需求 | **零对位 = 建议不复现** | — | 明确排除：与本仓 Apache-2.0 溯源水印（§5c）是两套价值取向；采集设备指纹进产品需资质与告知，**不在"复现+超越"射程**。 |
| ⑰ 跨窗口 COPYDATASTRUCT 互通 + 微信/企微回复腿 | 无对位（`apps/miniapp-taro` 是小程序运行时，非桌面窗口互通） | **零对位 = 低优先** | — 建议仅登记为"待有真实互通需求再启" | 超越轴暂不适用；本轮不落地，避免为对齐而造无人消费的件（本仓 §「声明必须有消费者」门 121）。 |

**已确认已有对位、本批不建议动的（免得重复投入）**：命令字符串静态判据（`G:\IHUI-AI\apps\cli\src\tools\command-policy\evaluate.ts:299-362` 三态 verdict + 严重度取最坏 + 命令替换升档 + 多段拼接判 mutating，粒度不低于对方 `broker-program-policy-check.cjs` 的 0/126/13）；worktree 作为工具（`G:\IHUI-AI\apps\cli\src\tools\worktree.ts`，含 Windows `rmSync` 兜底腿）；A2A 四件套（`G:\IHUI-AI\apps\ai-service\app\routers\a2a.py:11` 显式解析 Principal + `app\core\config.py:159`、`jwt_auth.py:37` 的 agent-card 公开白名单，已比对方"公开化必须显式列举"这条要求同型且已装车）；记忆/技能/子代理/LSP/Artifact/定时任务腿（`apps\cli\src\tools\{memory,skill-tool,subagent,lsp}.ts`、`apps\ai-service\app\tools\artifact_tools.py`、`apps\ai-service\app\services\mcp_server.py:9492` 的 `_tool_schedule_task`）。

## 4. 复验命令

```bash
# 0) 引擎与现场（可照抄）
export PATH="/d/caches/npm/prefix:$PATH"
rea --version                                   # 现读 6.4.0
cd /g/IHUI-AI && git rev-parse HEAD             # 6e6ea6f5c8be194d24aee8142adcc723b54bf8be

# 1) 包完整性自校验证据（本席首跑即被拦，可读全 JSON）
rea analyze-javascript-application "G:/workbuddy/resources/app.asar" --json
rea analyze-javascript-application "G:/workbuddy/resources/app.asar" --json \
    --artifact-format auto --integrity-policy record-and-continue \
    --analysis-timeout-ms 180000 --max-heap-mb 3072   # 进度流水见 .err；7189 文件，本席于 17/7189 终止

# 2) 两条完成的 directory 分析（读数在 .json 的 normalized_result.statistics）
rea analyze-javascript-application "G:/workbuddy/resources/app.asar.unpacked/main" \
    --json --artifact-format directory --analysis-timeout-ms 120000
rea analyze-javascript-application "G:/workbuddy/resources/app.asar.unpacked/cli/vendor/shim" \
    --json --artifact-format directory --analysis-timeout-ms 120000

# 3) 能力面计数（结论表 #16/#21/#22/#23/#24 的出处）
cd /g/workbuddy/resources/app.asar.unpacked/cli && node -e "const p=require('./product.json');
console.log('topKeys',Object.keys(p).length,'tools',p.tools.length,'agents',p.agents.length,
'stepLimit',p.requestMaxStepLimit, JSON.stringify(p.tokenUsageThresholds),
JSON.stringify(p.skillApprovalRules.map(r=>r.presentation&&r.presentation.category)));
console.log('quality',Object.keys(require('./package.json').scripts).filter(s=>/^quality|^a2a|^build:windows-job/.test(s)).join(','));"

# 4) 沙箱规则维度（结论表 #16/#17）
cd /g/workbuddy/resources/app.asar.unpacked/cli/vendor/sandbox/5.9.5 && node -e "const j=require('./tsbx_rules.json');
console.log('default',j.default_action,'file',j.file_rules.length,'white',j.white_process.length,
'deny',j.file_rules.filter(r=>String(r.action).includes('deny')).map(r=>r.path).join(' | '));"

# 5) IPC 通道 41 条（结论表 #31/#32，同时复现 REA 该维 0 命中的反差）
grep -ohE "[\"'\`]wb:[a-zA-Z0-9:_./-]+" /g/workbuddy/resources/app.asar.unpacked/main/preload/*.cjs \
  | tr -d "\"'\`" | sort -u | wc -l

# 6) 批量护栏常量与命令面（结论表 #9/#10）
grep -nE "DEFAULT_THRESHOLD|LOCK_TIMEOUT_MS|STALE_LOCK_MS|TURN_STATE_TTL_MS|MARKER" \
  /g/workbuddy/resources/app.asar.unpacked/cli/vendor/shim/safe-delete-bulk-guard.cjs | head
grep -nE "command === '" /g/workbuddy/resources/app.asar.unpacked/cli/vendor/shim/safe-delete-bulk-guard.cjs

# 7) 本仓对位现状行号（缺口表 ①—⑮，全部现读）
cd /g/IHUI-AI
grep -n "rmSync\|unlinkSync" apps/cli/src/tools/worktree.ts apps/cli/src/tools/file-batch-edit.ts apps/cli/src/tools/file-edit.ts
grep -n "FolderTrustLevel\|checkFolderTrust\|SANDBOX_PROFILES = " apps/cli/src/sandbox/index.ts
grep -rn --exclude-dir=dist --exclude-dir=node_modules -iE "prewarm|startup.?profil|job.?object|capacityQueue|highCredit" apps packages scripts
grep -n "workbuddy" apps/desktop/src-tauri/src/git_local_status.rs
grep -c "^async def _tool_\|^def _tool_" apps/ai-service/app/services/mcp_server.py
```

### 附：本席边界声明（防误读）

- 未执行任何 WorkBuddy 原生件与任何 `.exe`/`.dll`；原生面只读 JS 绑定层与 `.d.ts` 声明（结论表 #33 的"导出符号"来自声明文件而非运行时枚举）。
- 未解包 `app.asar` 内 7,189 个文件；渲染层（#39）与主 bundle 内部实现（#36/#37 的"未知"部分）**本席零结论**。
- 未读、未打印任何凭据与会话文件内容（#40）。
- 未改 `G:/IHUI-AI` 下任何文件，除本目录 `.ihui-agent/tmp/rea-goal-b49/`；未 commit、未动台账。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
