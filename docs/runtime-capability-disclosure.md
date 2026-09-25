<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 运行时能力与数据披露（Runtime Capability & Data Disclosure）

> 面向用户与审计者的实话文档：产品在用户机器上到底能干什么、数据去哪了、哪些东西会自动执行。
>
> **取证口径**：本文每一条论断都指向本仓具体代码位置（`文件路径:行号`），或标注为
> **实测快照**（2026-09-24 ~ 09-25 在本机 `G:\IHUI-AI` 这份 checkout 上执行命令取回）。
> 凡取证不到的，一律写「未验证」或「不适用」，不用含糊措辞填空。
>
> **文档不自称完备**：行号会随提交漂移。若某条与你看到的代码不符，以代码为准并视为本文缺陷。

---

## 0. 一句话总览

这个产品有三类执行体，能力和风险完全不同，**不要混为一谈**：

| 执行体 | 跑在哪 | 以谁的身份 | 能碰什么 |
| --- | --- | --- | --- |
| CLI（`apps/cli`） | 用户自己的机器 | 启动 CLI 的那个账号 | 用户机器全盘（沙箱默认关闭，见 §3.1） |
| ai-service（`apps/ai-service`） | **我们部署它的服务器 / 自托管实例的机器** | 该服务进程账号 | 该机器文件系统 + 网络；`run_command` 真的在那台机上执行（§4.2） |
| 端侧代理（web / desktop / extension / RN / 小程序） | **用户自己的机器 / 手机 / 浏览器** | 用户已登录的那个应用 | 浏览器 DOM、本站页面、（桌面端）**操作系统级鼠标键盘与剪贴板**（§4.4） |

模型厂商（29 个上游端点，§6.1）是第四方：你的对话内容与文件内容会原文发给它们。

---

## 1. 权限模式的真实语义

唯一真源 `packages/types/src/permission-mode.ts:20-26` 定义五档，Python 侧镜像在
`apps/ai-service/app/core/permission_mode.py`，两侧成员与别名由守门
`scripts/check-permission-mode-vocabulary.mjs` 对账。

| 规范档 | 别名（会被归一） | 审批门效果 | 出处 |
| --- | --- | --- | --- |
| `default` | `default` | `ask` —— 每次数确认 | `packages/types/src/permission-mode.ts:156-162` |
| `manual` | `manual` | `ask`（**无落库拼写**，不能存进 workspace 权限表） | 同上 + `:100-101` |
| `acceptEdits` | `accept-edits`、`auto` | `auto-approve-safe` —— 只放行"安全/只读"工具 | `:39-51`、`:173-177` |
| `bypassPermissions` | `bypass-permissions`、`accept-all` | **`auto-approve-all` —— 全部免确认** | `:39-51`、`:156-162` |
| `plan` | `read-only`、`plan-only` | `readonly` —— 白名单外工具直接拦截 | `:39-51`、`:168-171` |

**必须知道的三件事：**

1. **没有任何一档是"永远要确认"的子集。** 实测在全仓检索
   `ALWAYS_CONFIRM|NEVER_AUTO|UNSKIPPABLE|永远需要确认` **零命中**（取证命令：
   `grep -rniE "ALWAYS_CONFIRM|NEVER_AUTO|UNSKIPPABLE" apps/cli/src apps/ai-service/app packages`）。
   `IHUI_YOLO` 环境变量一旦设置，CLI 的危险命令模式拦截**整条跳过**：
   `apps/cli/src/tools/builtins.ts:442-447`、`apps/cli/src/tools/terminal.ts:231-235`
   两处都是 `if (dangerousMatch && !process.env.IHUI_YOLO)` —— 即 YOLO 之下连
   `rm -rf /`、`git reset --hard`、`shutdown`（模式表见
   `apps/cli/src/tools/command-safety.ts:13-29`）也不再被这道拦。
   服务端同型开关是 `DANGEROUS_COMMAND_BLOCKED=false`（默认 `true`，
   `apps/ai-service/app/services/mcp_server.py:279-283`）。
   ⚠️ 这与任务书里"某档位必须继续尊重 destructive 永远确认子集"的期待**不符**，属我方现状而非设计目标。

2. **只读命令免确认的口子按 basename 判定。** `isReadonlyCommand`
   （`apps/cli/src/tools/command-safety.ts:61-81`）先查 basename 白名单
   （`:31-39`，含 `git`/`docker`/`kubectl`/`cargo`），命中后再查子命令表
   （`:45-50`）；`git push`、`docker run` **不在**子命令表里，所以不会被判只读。
   但 `ls`/`cat`/`pwd`/`ps`/`wc`/`head`/`tail` 等**无子命令表**的条目在 `:80` 直接
   `return true` —— 也就是 `head` 类命令的任意参数组合都免确认执行。
   免确认的后果写在 `apps/cli/src/tools/builtins.ts:450-459`：`readonlyAutoApproved`
   为真时跳过 `confirmDangerous`，同时也跳过了"无确认回调即默认拒绝"的兜底。

3. **非法拼写不会静默降级。** `normalizePermissionMode` 认不出来返回 `null` 而非
   `default`，注释在 `packages/types/src/permission-mode.ts:64-75` 明确理由
   （静默降级=授权误导）。展示层同理：认不出的值显示为 `unknown`（`:146-151`）。

**服务端自主性另有一层**：`apps/ai-service/app/services/control_autonomy.py:5-21`
决定"这一轮该不该把操控本站的工具交给模型"，判定依据是正则+关键词并集（`:53-90`），
失败一律降级为"不加工具"。它只注入**用户当前真在线的端**对应的工具族
（`:34-40`），且在线状态是问 `apps/api` 拿的，不是猜的。

---

## 2. 可读写路径：两层沙箱 + 三道 Python 守卫

### 2.1 CLI 第一层：资源限制型（**不是**文件系统隔离）

`apps/cli/src/sandbox/index.ts:5-14` 的自述就写明"不实现 chroot/namespace 级隔离"。真实语义：

- **超时 / 输出上限 / 环境变量过滤**真实生效：`spawnSync` 带 `timeout`、`maxBuffer`、
  过滤后的 `env`（`:393-402`，异步变体 `:509-518`）。
- **内存 / CPU 上限仅 POSIX**（`resource` 选项，`:404-411`），Windows 上忽略。
- **进程树强杀**真实存在：POSIX 走 `kill(-pid)` 进程组，Windows 走
  `taskkill /T /F`（`:528-545`）。
- **路径白名单只检查"命令行文本里长得像路径的 token"**：
  `extractPathsFromCommand`（`:275-299`）按空白+引号切 token，只挑含 `/`、`\` 的那些。
  ⇒ **明确没有保护的情况**：命令自己内部拼出来的路径、经 stdin/参数文件传入的路径、
  脚本文件里的路径，一个都看不见。且当 `allowedPaths` 为空时整段检查直接跳过（`:365`）。
- **符号链接逃逸已处理，但只对"已存在"的路径**：`isPathAllowedWithRealpath`
  用 `realpathSync` 解析真实路径（`:248-264`），不存在的路径退回形式路径 ——
  注释在 `:257` 与 `:245-246` 如实承认这是残余风险。
- **`readonly` profile 的"无 shell 命令"现已真正生效（2026-09-25 修复）**：
  历史缺陷是 `SANDBOX_PROFILES.readonly` 取 `commandAllowlist: []`，而两处强制点
  都写成 `if (commandAllowlist.length > 0)` 才检查，`isCommandAllowed` 在空数组时
  `return true` —— 空数组被当作"未设置"，于是该档对命令名**零限制**（描述与行为相反）。
  **当前语义**：`commandAllowlist` 是三态 ——
  `null` = 一律拒绝所有命令（连解析不出命令名的畸形输入也拒，fail closed）；
  非空数组 = 只允许名单内；`undefined` / `[]` = 不检查（旧语义，保持不变，
  否则现网所有把空数组写进 settings 的用户会一夜之间被全禁）。
  `readonly` 档现在取 `null`（`apps/cli/src/sandbox/index.ts`），
  两处强制点（同步 `runSandboxed` 与异步 `precheckSandbox`）改为共用同一个
  `evaluateCommandAllowlist`，判定逐字同形。第二套策略层
  `apps/cli/src/tools/sandbox/policy.ts` 实测有**同一条**"空数组=不限制"的判据
  （`evaluateCommand` 的 `policy.commandAllowlist && length > 0`），已同批接受 `null`。
  ⇒ 行为变化：把 `sandbox.profile` 设为 `readonly` 的用户，其 bash / 后台命令
  现在**一律被拒**（`blocked: true`，原因串 `command_not_allowed`），这才是该档的名字的意思。
- **审计日志默认不写**：`appendSandboxAuditLog` 只在设置了
  `IHUI_SANDBOX_AUDIT_LOG` 时才落盘，未设置**静默跳过**（`:319-327`）。
  即"沙箱执行了什么"默认没有第二份记录。

### 2.2 CLI 第二层：OS 级沙箱门面（**默认关闭**）

门面 `apps/cli/src/tools/sandbox/index.ts:59-100`（策略校验 → 命令评估 → 平台分派）。
**开关默认 off**：`apps/cli/src/tools/terminal.ts:35-41` —— 需要
`settings.sandbox.enabled=true` 或 `IHUI_SANDBOX_ENABLED=1`；未启用时
`execSandboxedEntry` 直接抛错（`:52-56`），`sandbox_run` 工具返回拒绝提示（`:464-469`）。
**不启用时，CLI 的命令执行只有 §2.1 那层，且那层不隔离文件系统。**

策略模型 `policy.ts:229-327` 的判定顺序（白名单优先 → 黑名单兜底 → 网络 → 路径 → denyPaths）：

- `denyPaths` 优先级最高，落在授权区内也拒（`:308-312`）。
- 危险模式黑名单是**去引号后的正则**（`:246-266`，模式表 `:101-125`）。
  ⇒ 仍是字符串匹配，`variables as commands`、命令替换等构造不在其视野内。
- 网络：`allowNet !== true` 时只按 basename 名单拒绝（`:269-278` + `:128-131`）。
  ⇒ **明确没有保护**：`node -e "fetch(...)"`、`python -c "import urllib..."` 这类
  不叫 `curl`/`wget` 的进程联网，策略层看不见；真正的断网只在下面 bwrap 后端里。
- `workspaceRoot` 是盘符根（`C:\`）时策略直接判非法（`:148-151`）。

后端选择与降级链 `platform/detect.ts:61-132`：

| 平台 | 链路 | 真隔离 from 哪一步 |
| --- | --- | --- |
| Linux | `landlock → bwrap → prlimit → plain` | 只有 **bwrap**；Landlock 内核在位也**用不上**（Node 无 syscall 封装，`:99`、`:106-109`） |
| macOS | `sandbox-exec → prlimit → plain` | `sandbox-exec`（`:121-129`） |
| Windows | `restricted-token → plain` | **没有真隔离档**：`restricted-token` 只代表"探测到 powershell.exe"（`:77-84`），注释 `:81` 自己写明是"降级：环境变量过滤 + 超时/输出限制，非内核级隔离" |

后端真实语义：

- **Linux bwrap**（`platform/unix.ts:53-84`）：`--ro-bind / /` 整盘只读 + `--bind workspaceRoot`
  可写 + `allowWrite` 逐条 `--bind`；`allowNet !== true` 时加 `--unshare-net`（真实断网）；
  加 `--die-with-parent`、`--new-session`。
  **`denyPaths` 的实现是 `--tmpfs <path>`（`:67-68`）** ⇒ 语义是"对该路径的写入落进内存盘、
  不落真实磁盘"，**不是**"该路径读不到"。子进程仍能读到原内容的视图边界由 tmpfs 挂载决定，
  不要把 `denyPaths` 理解成读取屏蔽。
- **macOS sandbox-exec**（`unix.ts:88-124`）：profile 明文写 `(allow file-read*)`
  （`:107`，注释 `:105-106` 说明是为了不弄死动态链接器）。
  ⇒ **macOS 后端全盘可读**；`denyPaths` 只生成 `(deny file-write* ...)`（`:115-117`），
  **不拦读**。网络在 `allowNet !== true` 时不发 `(allow network*)`（`:120-122`）。
- **Windows 后端**（`platform/windows.ts:64-211`）：把命令写进临时 `run.cmd`
  （`:111`，目录来自 `mkdtemp(tmpdir())` `:105`，`finally` 删除 `:209`），
  再用 PowerShell `Start-Process cmd.exe /d /c <批处理>`（`:117`）执行，
  超时 `taskkill /T /F`（`:120`）。文件头注 `:8-14` 已如实声明三件事：
  受限令牌/JOB 对象**未实现**、`icacls` 只做只读探测（`:241-251`）**不改写任何 ACL**、
  `denyPaths` 仅在策略层生效。
- **降级档 `prlimit` / `plain`**（`detect.ts:112-114`、`:125`）：**只有资源上限，无文件系统隔离**。

### 2.3 服务端 OS 沙箱引擎（能力比 CLI 那套更强，但只有一个入口）

`apps/ai-service/app/services/os_sandbox.py`（1477 行，纯标准库 + ctypes）：

- 三后端 `win_job` / `linux_bwrap` / `mac_seatbelt`，默认按平台选（`:325-339`）。
- Windows 侧是**真的** Job Object + `CreateRestrictedToken`
  （`DISABLE_MAX_PRIVILEGE`、可选 `LUA_TOKEN`），进程 `CREATE_SUSPENDED` 创建 →
  `AssignProcessToJobObject` → `ResumeThread`，自始受约束（`:8-14`、`:345`、`:493-504`、`:727`）。
- 策略模型 `SandboxPolicy:154-176` 的默认值就是最小授权：
  `allow_network=False`、`writable_paths=[]`（**空 = 禁止一切写入**，`:163` 注释）、
  `restrict_token=True`；并有 `write ⊆ read` 不变式校验（`:214`）。
- 文件头 `:21-23` 的诚实声明照抄过来：*"Windows 上文件系统 ACL 为应用层护栏（启动前校验
  argv/cwd；内核级 per-path ACL 需 DACL 改写，代价过重）；资源限额与令牌限制为 OS-enforced。
  Linux/macOS 后端在本仓库以纯函数构造正确性测试覆盖（Windows 开发机无法真跑）"*。
  ⇒ **Linux/macOS 两个后端从未在真实内核上跑过端到端验证**，这是事实边界。
- **唯一调用方是一个 HTTP 端点**：`apps/ai-service/app/routers/sandbox_exec.py:32`
  （全仓 `grep -rn "os_sandbox" apps/ai-service/app` 除 router 与测试外零命中）。
  `POST /api/sandbox/run` 需 JWT 鉴权（`:76` `Depends(get_current_user_id)`）——
  但 **`policy` 完全来自请求体**（`:64-67`），即任何已登录用户都能自己填
  `writable_paths` / `denied_paths` / `timeout_s` / `memory_mb` 并指定 `backend`（`:70`）。
  ⇒ 服务端**不施加**默认最小授权，沙箱强度等于调用方的自觉。

### 2.4 Python 三道守卫各自覆盖到哪、明确没覆盖到哪

| 守卫 | 覆盖 | 明确没覆盖 | 接线点 |
| --- | --- | --- | --- |
| `path_guard.py` | 「敏感目录片段」单一权威源：`.git` / `node_modules` / `.venv` / `venv` / `dist` / `build` / `__pycache__` / `.next`（`:50-59`），按完整路径片段匹配（`:39-41`） | 只管**写盘工具**。它拦不住 `run_command` 里的 shell 重定向；也不知道"工作区外"概念（工作区根由另一个函数判，`mcp_server.py:484`） | `file_editor.py:44`、`mcp_server.py:40`（`:531` 说明写工具用途） |
| `network_guard.py` | 应用层 URL 出站白/黑名单；未知 mode **fail-closed**（`:56-58`）、非 http/https 协议拒绝（`:66-68`）、allowlist 模式下裸 IP 默认拒（`:76-81`） | 头注 `:6-7` 自己写明：*"这是应用层软检查，只能拦截通过本模块发起的 HTTP 请求。完整网络隔离需 OS 沙箱，本模块不提供"*。`mode` 默认 `open`（`:43`）；无策略注入时 `check_current` 返回 `(True, "no policy")`（`:172-181`） | **只有 DAG worker 一条链注入**：`dag_scheduler.py:818-825`。`run_command` 起的子进程**不经过**它 |
| `exec_policy.py` | argv 前缀规则三态 `allow/prompt/deny`（`:62`、`:71`）；POSIX 与 PowerShell 双分词器 + 特权前缀剥离（`:465`、`:563`、`:481`）；规则影子检测（`:295`） | 生效强度取决于配置档：`agent_loop_v2.py:4197` 判 `if cfg.exec_policy_mode != "enforce" or not self._approval_enabled:` 就不转真实审批。`audit` 档下 DENY 只记录后放行（`mcp_server.py:1864`） | `mcp_server.py` 的 `run_command` 链、`agent_loop_v2.py:4171` |
| `proc_sandbox.py` | Windows Job Object：内存上限默认 1.5GB、进程数上限 16、`KILL_ON_JOB_CLOSE`、UI 限制（禁剪贴板读/写、禁改系统参数、禁句柄继承到桌面对象）（`:6-15`、`:43-54`） | 头注 `:14`：*"非 Windows 或任何失败均静默降级（返回 active=False + reason），绝不影响主流程"* ⇒ **降级无声**。唯一调用点 `agent_engine.py:321`，即只护引擎起的子进程 | 同上 |

---

## 3. 存储落点：什么写在你的机器上，什么进了我们的数据库

### 3.1 CLI 写在用户机器上的（全部在 `~/.ihui/` 或 `<workspace>/.ihui*/`）

| 路径 | 内容 | 出处 |
| --- | --- | --- |
| `~/.ihui/sessions/` | 会话记录 | `apps/cli/src/commands/session.ts:30` |
| `~/.ihui/checkpoints/<sessionId>/` | 回合检查点 | `apps/cli/src/checkpoints/index.ts:58`、`hunks.ts:67` |
| `~/.ihui/audit.jsonl` | **每一次工具调用**：`tool` / `input` / `output` / `success` / `durationMs` / `error`（`:24-31`），输入输出各截断 500 字符（`:11`），写前经 `redactSecrets`（`:18`）。**默认开启**，关法是 `IHUI_AUDIT=0` 或 `settings.auditEnabled=false`（`:35-40`） | `apps/cli/src/audit.ts:10-12,24-45` |
| `~/.ihui/settings.json`、`~/.ihui/hooks.json`、`~/.ihui/mcp.json`、`~/.ihui/ai-skills.json`、`~/.ihui/tasks.json`、`~/.ihui/specs/` | 配置与用户数据 | `commands/settings.ts:380`、`hooks/index.ts:194`、`commands/mcp-config.ts:183`、`commands/ai-skills.ts:117`、`commands/tasks.ts:72`、`commands/spec.ts:111` |
| `~/.ihui/cache/announcements.json`、`~/.ihui/state/seen-announcements.json`、`~/.ihui/cache/codegraph/<hash>.json` | 公告缓存、已读状态、代码图缓存 | `announcements/index.ts:117-122`、`codegraph/persist.ts:108` |
| `~/.ihui/crash-logs/` | 崩溃日志 | `apps/cli/src/crash-handler.ts:28` |
| `~/.ihui/disabled-hooks`、`~/.ihui/trusted-folders` | 钩子禁用清单、受信任目录清单（纯文本每行一路径） | `apps/cli/src/hooks/trust.ts:35-38` |
| `<workspace>/.ihui/screenshots/browser-<ts>.png` | 浏览器截图**落在你的项目目录里** | `apps/cli/src/tools/browser.ts:495`（默认路径说明 `:464,:466`） |
| `<workspace>/.ihui/plugins/`、`<workspace>/.ihui-agent/shared/`、`<workspace>/.ihui-agent/undo-history/` | 插件目录、分享产物、撤销历史 | `commands/agent.ts:328`、`commands/share.ts:71`、`commands/undo-redo.ts:95` |
| 项目级配置 `<cwd>/.ihui/settings.json` | 与用户级叠加，工作区优先 | `apps/cli/src/config/index.ts:47-52` |

### 3.2 服务端存储

- **会话/消息原文**：`chat_conversations` / `chat_messages` /
  `conversation_message_archives`（`packages/database/src/schema/chat.ts:23,63,95`）。
- **每次 LLM 调用流水含 prompt 与 response 原文**：
  `llm_call_logs` 的 `prompt`（`packages/database/src/schema/llm-call-logs.ts:44`）与
  response 列；表注释 `:22-34` 明确记着"存的是完整原文，与'只开放功能、不开放数据'的口径冲突"，
  并给出留存续约。
  **清除器是真的挂了定时任务**（不是只有注释）：
  `purgeAllExpiredLlmCallLogRawText`（`apps/api/src/services/audit-log-service.ts:516`，
  置空 SQL 在 `:491`）由 `apps/api/src/workers/scheduler-worker.ts:49,589` 消费，
  cron 为每日 04:15（`apps/api/src/plugins/scheduler.ts:168-172`），
  默认保留 30 天，可用 `LLM_CALL_LOG_RAW_RETENTION_DAYS` 调整
  （`llm-call-logs.ts:30-31`）。到期后 `prompt=''`、`response=NULL`、
  `raw_retained=false`，token/成本列保留。
- **检查点**：`agent_checkpoints` 表，`payload jsonb` 存整轮消息与工具状态，带 `expires_at`
  （`apps/ai-service/app/services/agent_checkpoint.py:66-99`，写入 SQL `:70-81`）。
  ⚠️ **检查点不等于备份**，见 §7.1。

### 3.3 模型密钥引导（只在服务端机器上）

`scripts/lib/key-dir.mjs`：密钥唯一权威源是网盘同步目录里的
`BaiduSyncdisk/密钥/模型/`，**盘符按候选序 `F:→D:→E:→G:→C:` 取第一个真实存在者**
（`:21`、`:24-27`），可用 `IHUI_SECRETS_ROOT` / `IHUI_MODEL_KEY_DIR` 覆盖（`:25`、`:35-39`）。
文件头 `:8-14` 记录了写死盘符造成的误诊（"读不到文件"被下游门禁报成"凭据失效"）。
回填脚本只写 `.env` 中**值为空**的键、绝不覆盖已有值，输出恒为脱敏态
（AGENTS.md §5d；脚本 `scripts/env-backup-model-keys.mjs` 本档未逐行读，标**未验证**）。

---

## 4. 命令实际执行身份（这一节最容易被误解）

### 4.1 本机（开发机）实测快照 —— 2026-09-24/25

```
whoami                              → LICHUNCHUAN\Administrator
Get-CimInstance Win32_Service 总数   → 279，其中 Name/DisplayName 含 "ihui" 的：**0 个**
C:\Program Files\nssm.exe            → exists=False
C:\Windows\System32\nssm.exe         → exists=False
Listen 端口 8801/8802/8803/8810/8811  → **全部无监听**
```

⇒ **在本 checkout 所在的这台机器上，AGENTS.md §5b/§12 所述"IHUI-API/IHUI-DEPLOYLOOP/IHUI-MONITOR/IHUI-GIT-GUARD 等 NSSM 服务在跑、本机即生产机"不成立**：既没有任何 IHUI Windows 服务，也没有 `nssm.exe`，应用端口一个都没在监听。
AGENTS.md §5b 自己在 2026-09-24 加的更正条目就是这个意思（"凡「盘符 / gitdir 形态 / 远端 URL / 代理」四类，每次使用前按当次实测取值"）。

**结论对用户的含义**：AI 生成的命令在哪台机器、以谁的身份执行，取决于你走哪条链路，
**不能一概而论**——见 §4.2–§4.4。

### 4.2 服务端：`run_command` 真的在跑 ai-service 的那台机器上

`apps/ai-service/app/services/mcp_server.py:1799-1812`：`_tool_run_command` 用
`asyncio.subprocess` 在**本进程所在主机**执行 shell 命令；工作目录 `cwd` 默认 `"."`
（`:1814`）并要过 `_validate_path_in_workspace`（`:484`），工作区根来自
`MCP_WORKSPACE_ROOTS`，**未设置时退化为 `os.getcwd()`**（`:397-399`）——
即"ai-service 进程的当前目录"就是默认可操作面。
防线：危险命令硬门（`:1836-1853`，可被 `DANGEROUS_COMMAND_BLOCKED=false` 关掉 `:279-283`）、
exec_policy 三态（`:1857-1866`，非 `enforce` 档行为见 §2.4）、硬超时
`RUN_COMMAND_TIMEOUT_S` 默认 120s（`:286-291`）。
**这条链路上没有 §2.3 那个 OS 沙箱**：`run_command` 不调 `os_sandbox`，
`os_sandbox` 只被 `/api/sandbox/run` 用。
工具权限矩阵：`write_file` / `run_command` / `db_query` / `git_operations` / `file_edit` /
`resolve_conflict` / 全部 `computer_*` / `screenshot_url` / `fetch_url` 等**限 admin（roleId≥1）**
（`mcp_server.py:403-425`）。

服务监听：`apps/ai-service/.env` 实测 `HOST=0.0.0.0`（第 7 行）、`PORT=8803`（第 2 行），
`uvicorn.run(host=settings.host, ...)`（`apps/ai-service/app/main.py:946-952`）。
docker 部署下 nginx **把 `/ai-service/` 公开反向代理**到 `ai-service:8803/`
（`deploy/docker/nginx.web.conf:62-65`），另有一条 `/socket.io/ → ai-service:8803`（`:82-83`）。
⇒ 该拓扑下 ai-service 的路由**经公网可达**（有 rate-limit 但仍是可达面）。
本机（Windows 直跑部署）当前未监听 8803，见 §4.1。

### 4.3 端侧 UI 操控：命令**回到用户自己的浏览器/手机**执行

链路（`apps/ai-service/app/services/ui_action_bridge.py:5-12`）：
ai-service → `POST /api/agent-control/execute(category=…)` → api 按 category 择端并经
WebSocket 推给该用户已上线的端 → 端执行后 `POST /api/agent-control/result` → api 用
pending Map 把结果同步回工具。

category → 执行端映射是服务端一张表（`apps/api/src/routes/agent-control.ts:88-95`，
语义说明 `:14-22`）：`browser→extension`、`computer→desktop`、`ui→web`、`app_ui→rn`、
`miniapp_ui→miniapp`。

多用户隔离靠 `__user_id` 代调身份，缺失即拒（`ui_action_bridge.py:22`）。

**破坏性动作的拦截位置必须讲清楚**：`ui_action_bridge.py:23` 原文是
*"破坏性动作(删除/注销/提现/支付…)与密码字段由**前端**黑名单硬拦截，返回
DESTRUCTIVE_BLOCKED / PERMISSION_DENIED，本侧原样回传"*。
⇒ 这道闸跑在**用户的浏览器/App 里**，不在服务端。它拦的是"模型点错按钮"，
它**不是**服务端强制授权；能改前端代码或绕过前端的人不受它约束。

### 4.4 桌面端 = 操作系统级输入注入，且**端上没有二次确认**

- 执行体：Tauri Rust 命令用 `enigo` 做真实鼠标键盘事件（
  `apps/desktop/src-tauri/src/lib.rs:19` 引入，`mouse_click` `:802-827`、
  `keyboard_type` `:829-858`、`Enigo::new` `:789`）。
- 能力清单（web 侧）：`screenshot_screen` / `mouse_move` / `mouse_click` /
  `mouse_scroll` / `keyboard_type` / `keyboard_press` / `keyboard_hotkey` /
  `active_window` / `clipboard_get` / `clipboard_set`
  （`apps/web/src/hooks/use-agent-control.ts:63-71`，分发实现 `:142-209`）。
  ⇒ 含**屏幕截图与系统剪贴板读写**。
- **接收即执行**：`handleWsMessage`（`use-agent-control.ts:277-295`）按 requestId 去重后
  直接 `void executeAction(req)`，没有向用户请求确认的分支；Rust 侧 `lib.rs` 里
  `confirm|approve` 关键字命中仅出现在文件头的版权水印行（第 2 行），无授权逻辑。
  ⇒ 服务端唯一的门是"这批工具限 admin"（`mcp_server.py:411-415`）。
  换句话说：**桌面端在线时，管理员账号下的会话可以驱动你这台机器的鼠标键盘，
  而你这头不会弹任何确认框。**
- 桌面端只在 Tauri 环境生效（浏览器端 no-op），WS 直连 `http://127.0.0.1:8802`
  （`use-agent-control.ts:19`）。

### 4.5 CLI 的浏览器与搜索

- `browser_*` 工具在**用户机器上启动本机 Chrome/Edge/Chromium**
  （候选路径枚举 `apps/cli/src/tools/browser.ts:78-92`），页面内容/截图落在工作区
  （§3.1）。
- `web_search` 把**查询关键词原文**发给 DuckDuckGo 的 HTML 接口
  （`apps/cli/src/tools/web-search.ts:24`，设计说明 `:10`），免费无 key、不缓存（`:18`）。

### 4.6 桌面宿主（Tauri + WebView2）：能读写什么、`page_*` 是否开启、数据落在哪

> 本节全部为 2026-09-25 在本机实测/逐行核对，未取证的部分直接写「未验证」。

**宿主形态：桌面端的"页面"只有我们自己的站点。**

- 主窗口固定加载 `https://aizhs.top/agents`（`apps/desktop/src-tauri/tauri.conf.json:18`），
  IPC 权限只授给这两个域名（`apps/desktop/src-tauri/capabilities/default.json:6-8`）。
- 断网时 Rust 用 `webview.eval` 把页面导航到内置离线页
  （`apps/desktop/src-tauri/src/auto_refresh.rs:256`、`:293`）。
- ⇒ 桌面里可被"读取/操作"的文档恒为自家页面，不存在"用户正在浏览的任意站点"这一目标面。
  任意站点那条路属于扩展宿主（§4.3）。

**读写面（三条，按权限来源）**

1. 操作系统级输入与剪贴板：见 §4.4（`enigo` + `arboard` + `screenshots`，含屏幕截图）。
2. 文件读写被限定在 `$APPDATA/**` 的**文本**文件
   （`capabilities/default.json:29-37` 的 `fs:allow-read-text-file` / `fs:allow-write-text-file`）；
   实际写入物为 `auth.json` / `tray-settings.json` / `window-state.json`（见下面的巡检清单）。
3. 外部程序：`shell:allow-open` 只允许 `https://*` 与 `http://*`
   （`capabilities/default.json:39-44`），`file:`/自定义协议被排除在外。

**命令在哪个账号/宿主执行**：桌面主进程（Rust）内、**启动该桌面应用的那个登录账号**下；
不经服务端，也不落到我们的服务器。业务状态**不**存在 Rust 侧——实测
`apps/desktop/src-tauri/src` 里进程级状态声明只有 1 处
`static WINDOW_STATE_LAST_SAVE`（`src/lib.rs:1209`，窗口几何保存的节流时间戳）。
这条现在是机器判据：`scripts/check-desktop-event-wiring.mjs` 规则 F 规定 Rust 的进程级状态
一旦持有 `task|session|conversation|chat|message|turn|prompt|thread|goal|agent|todo`
这类业务名词即拦下提交（零容忍、不设清单豁免，唯一出口是行内 `rust-state-exempt: <原因>`）。

**`page_*`（页面语义快照句柄族）在桌面：未开启。** 三条实测判据：

1. 服务端反向闸只认扩展端申报：`apps/ai-service/app/services/control_autonomy.py:233-243`
   的 `_page_family_declared` 判定式是 `ep.get("endpoint") == "extension"`，
   桌面申报 `browserPageActions` 打不开模型可见面。
2. 择端表把这一族的 `category` 只路由到扩展端：本族走的 category 是 `browser`
   （`apps/ai-service/app/services/page_control_bridge.py:63`、`:217`），而
   `apps/api/src/routes/agent-control.ts:94-105` 的 `CATEGORY_ENDPOINT` 是"一 category 一端"的穷举表，
   `browser: 'extension'`、`computer: 'desktop'`。把 `desktop` 塞进 `browser` 会连带把
   12 个选择器形态的 `browser_*` 也投给桌面，而桌面执行不了它们。
3. 投递按 **userId 而非 instanceId**（`agent-control.ts:292` `pushNotification(ep.userId, …)`），
   且结果**先回者定终**（`agent-control.ts:350-358` 取到 pending 即 resolve 并删除）。
   同一用户若同时挂着扩展与桌面，两者都会收到同一条 `browser` 族指令并各自执行，
   谁先返回谁的答案被采信——桌面那份"自家页面快照"就可能顶掉用户浏览器标签页的真实结果。

⇒ 因此桌面端**故意不申报**这一族：`apps/web/src/hooks/use-agent-control.ts:98-107` 的
`buildCapability()` 里没有 `browserPageActions` 字段。这条不是口头约定，
`scripts/tests/desktop-page-host.test.mjs` 把它钉成双向不变量
（"申报 ⟺ 接线三条件成立"：只挂壳会红，只把闸放开却没人接也会红）。
要让桌面真正成为第三个执行宿主，前置动作是新增一条独立 category + 让闸按端类型白名单放行 +
桌面消费端复用 `@ihui/dom-actions` 的 `runPageAction` 与 `buildPageApiInstallExpression()`
（不得端内自拼表达式/句柄格式/错误码），属未决项，不是已完成项。

**注入与派发本身可行（实测）**：共享包的唯一装配入口产出的自足表达式，在真实 Blink 引擎
（本机 Edge 145 headless，与 WebView2 同内核家族）里跑通——
`install=ok / schema=1 / rows=3 / roles=button,combobox,textbox`，
`page_click` 触达页面自身注册的 listener（`click.reached-handler=true`），
`page_type` 写入值 `注入文本 42`、`page_select` 置为 `ops`、`page_press_key` 返回 ok，
失效句柄给出 `HANDLE_SCOPE_MISMATCH`、伪造句柄给出 `HANDLE_MALFORMED`。
同一次实测还量到注入源码需要的打包器辅助符是 `["__name"]`
（⇒ 端内把 `(fnSource)(opts)` 手拼进 eval 必然 `ReferenceError`，这是必须走装配入口的实证）。
**边界**：未在真机 WebView2 窗口内跑过端到端（需 cargo 构建 GUI 壳），此处只主张"同内核家族的
Blink 引擎已验证"，不主张 WebView2 已验证。派发形态是页内合成事件（`isTrusted:false`），
与扩展宿主同形，不是 OS 级真实输入（那是 §4.4 的 `computer_*`）。

**WebView2 数据目录与加密落点**：数据目录是
`%LOCALAPPDATA%\com.ihui.desktop\EBWebView`（代码内两处清理逻辑
`src/lib.rs:1426-1435` prod 体积清理、`:1613-1620` dev 每次启动清空）；本机该目录已由
改道机制指到 `G:\DevEnv\cache\userhome\appdata-local-com.ihui.desktop`（巡检脚本量到的真身）。
落盘加密的单一真相源是 `apps/web/src/lib/local-vault.ts`（信封字段 `ihuiVaultV1` →
`{alg,kid,iv,ct}`），巡检守门 `scripts/check-desktop-cache-plaintext.mjs`（只读、warn-only，
不进提交链——它判的是机器状态，提交者结构上满足不了）。
**2026-09-25 本机实测读数为 `violations`，不是"干净"**：实扫 9 个文件，其中
`EBWebView\Default\Local Storage\leveldb\000003.log`（9967B）里有 2 条
`ihui-chat` 的**明文 persist** 记录（`ihui-chat:plain`），并有 11 处 CJK 以 UTF-16 字节形态命中；
同清单里 roaming 的 `auth.json`/`tray-settings.json`/`window-state.json` 无 CJK 命中。
⇒ 结论要如实讲：**桌面本地聊天正文当前是明文落盘**，已入库的加密实现没有覆盖到这个键。
本轮没有动它（属另一条待办，且修它需要存量数据的迁移语义，不是加一行代码）。

**两条桌面链路的定名（同日起为机器判据）**：`chain: continuous` = Rust `.emit` →
`use-desktop.ts` listen → `CustomEvent`（无 id 无队列，页面未挂载监听即丢）；
`chain: replayable` = api `agent.action` 经 WS 送达的指令面（至少一次，故端内按 requestId 幂等去重，
`use-agent-control.ts` 与 `apps/extension/lib/agent-control-bridge.ts` 各一份）。
两条链分属不同通道，因此只补"不得混用/不得摘标记"的防回退断言（同一守门的规则 E）。

---

## 5. 会自动执行的东西（无人值守面）

### 5.1 生命周期钩子（用户可配置，默认按配置执行）

- **事件清单 18 项**（`apps/cli/src/hooks/index.ts:61-88`）：
  `preToolCall`、`postToolCall`、`sessionStart`、`sessionEnd`、`userPromptSubmit`、
  `preCompact`、`postCompact`、`notification`、`stop`、`stopFailure`、
  `postToolUseFailure`、`permissionDenied`、`subagentStart`、`subagentStop`、
  `turnStart`、`turnEnd`、`turnError`、`turnComplete`。
- **每个钩子二选一**：本地 shell 命令，或 HTTP webhook（`HookEntry` `:43-58`，
  `body?: string` 在 `:54`）。
- **command 形态是 `spawnSync(entry.command, { shell: true, env: {...process.env, ...} })`**
  （`runHookEntry` `:327-350`）——默认 10 秒超时（`:49,:340`），**完整继承父进程环境**
  （包括所有 API key；沙箱那套 env 过滤在这条路上**不生效**，除非钩子自己实现）。
- **webhook 形态会把工具输入/输出原文带出机器**：环境变量注入
  `IHUI_TOOL_INPUT` / `IHUI_TOOL_OUTPUT`（`:353-392`），body 模板支持
  `{{toolArgs}}` / `{{event}}` 等占位（`:54`、`buildWebhookBody` `:147`）。
  ⇒ 配了 webhook 钩子 = 你主动把会话内容发给那个地址。默认目标地址由用户自己写，
  产品不预设任何遥测接收端。
- **配置多源加载**（`listHooksConfigPaths` `:184-190`，`CONFIG_SOURCE_DIRS` `:182`）：
  `<cwd>/.ihui`、`<cwd>/.claude`、`<cwd>/.cursor`，再 `~/.ihui`、`~/.claude`、`~/.cursor`，
  深合并（`:201-227`）。损坏文件被静默忽略（`:222-224`）。
- **folder-trust 这道 P0 门现已接线（2026-09-25 修复），当前语义如下**：
  历史缺陷是 `apps/cli/src/hooks/trust.ts` 写好了 `gateHook()`，但全仓零调用方，
  派发路径不过门 ⇒ "git clone 恶意仓库不会自动执行 hooks"（该文件头注 `:13`）
  当时只是设计意图。现在：
  1. `loadHooksConfig` 给每条钩子盖上来源戳 `source: 'project' | 'user'`
     与 `sourceFolder`（按配置文件落点判定；**判不出来时保守取 `project`**）。
  2. 唯一的执行收口点 `runHookEntry` 在 `spawnSync` 之前查门：
     `source === 'project'`（或未盖章）的 **command** 形态钩子，其来源目录必须
     在 `~/.ihui/trusted-folders` 里，否则**不执行**。
  3. 被跳过时返回 `exitCode: 0` 并把原因写进 stderr —— 跳过的钩子**不会**
     反过来阻断工具调用（那会让用户以为是自己的工具坏了），但会打一条
     ⚠ 提示（同一钩子只提示一次）。
  **如何信任一个目录**：把该目录的绝对路径单独作为一行写进
  `~/.ihui/trusted-folders`（CLI 目前**没有** `ihui hooks trust` 子命令，
  `gateHook` 的旧文案指的就是这个不存在的命令，已改为指向真实出口）。
  **非交互出口**：`IHUI_TRUST_WORKSPACE=1` 视同已信任当前工作区
  （CI / 脚本 / 无 TTY 用；首次生效打印一次警告）。它只免"目录信任"，
  **不免** `~/.ihui/disabled-hooks`（那是用户逐条关掉的开关）。
  ⇒ **行为变化（有意的安全收紧，不是回归）**：`trusted-folders` 不存在即
  default-deny，所以此前靠工作区里的 `.ihui|.claude|.cursor/hooks.json`
  自动跑 command 钩子的配置，从现在起会一律停摆，直到你把该目录登记进
  `~/.ihui/trusted-folders` 或设 `IHUI_TRUST_WORKSPACE=1`。
  `~/.ihui/hooks.json`（用户主目录来源）行为完全不变。
  **未闭环**：webhook 形态仍不过这道门（本次修复范围按 command 收口），
  所以陌生仓库里的 webhook 配置依然会把会话内容带出机器 —— 见上面一条。
- 另有 ai-service 侧的 hook 引擎（`apps/ai-service/app/services/hook_engine.py`），
  以及 git 层钩子链：`.husky/` 下 pre-commit / post-commit / pre-push / commit-msg /
  reference-transaction，提交即触发（见 §5.2）。

### 5.2 提交/推送链上的自动动作

- **每次 `git commit` 之后自动 `git push origin <branch>`**：
  `.husky/post-commit:119` 调 `node scripts/git-push-guard.mjs`；
  该脚本职责写在其头注 `scripts/git-push-guard.mjs:15-16`（"检测 → 若本地 ahead 则自动 push
  含 upstream 设置"），并内置推送被 push protection 拒收时的凭据形状点名（`:64`）。
  异步化后 commit 秒回、后台 worker 推送（AGENTS.md §5b"推送异步化"条），
  状态文件 `.workbuddy/push-state.json`。
  ⇒ **在本仓做出的提交，默认会被推到 origin。**
- **pre-push 跑全量质量门**（typecheck 等，AGENTS.md §20 第 3 道防线）。
- **禁止 `git stash`** 由 `.husky/reference-transaction` 硬拦（AGENTS.md §12d）。
- **`--no-verify` 会跳过约 110 道守门**——这是仓库自己的记录（AGENTS.md §12e、守门 78 条），
  审计时应假定"任何一次提交都可能是在跳过门禁的情况下产生的"。

### 5.3 本机计划任务（实测快照，`Get-ScheduledTask -TaskName 'IHUI*'`，共 15 项）

**Principal 全部是 `Administrator`**，即这些任务都以交互管理员身份运行：

| 任务 | 触发 | 动作（wscript 隐藏启动器 → 真实脚本） | 写入/删除面 |
| --- | --- | --- | --- |
| `IHUI-AI git-guardian` | 每 **2 分钟** | `scripts/git-guardian-hidden.vbs` | 自愈 `.git`/嵌套 ref/工作区跟踪文件/**家目录 junction**/C 盘根封口；现已接邮件出口 |
| `IHUI Git Backup Refresh` | 每 **15 分钟** | `git-backup-refresh-hidden.vbs` → `scripts/git-backup-refresh.mjs` | 对**仓外**备份 gitdir 做增量 fetch + `read-tree --reset` 重建其索引 |
| `IHUI credential-health` | 每 **6 小时** | `credential-health-hidden.vbs` → `scripts/check-credential-health.mjs` | 探测凭据活性；失败写 `UNDELIVERED` 标记 + 发邮件 |
| `IHUI C-Drive AutoMaintain` | 每日 03:00 | `c-drive-maintain-hidden.vbs` → `scripts/c-drive-auto-maintain.ps1` | **删除**：见 §5.4 |
| `IHUI-AI-DevProcessCleanup` | 每 **10 分钟** + 登录 | `cleanup-zombie-processes-hidden.vbs` → `cleanup-zombie-processes.ps1` | **杀进程 + 修剪内存**：见 §5.4 |
| `IHUI-AI-G-Root-Guardian` | 登录时（restartCount=999） | `g-root-guardian-hidden.vbs` → `g-root-guardian.ps1` | **删除 `G:\` 根未知项**：见 §5.4 |
| `IHUI-KillGitSelector` | 每 **1 分钟** | `kill-git-selector-hidden.vbs` | ⚠️ 其包装的 `scripts/kill-git-selector.ps1` **在本 checkout 实测不存在**；vbs 头注 `:26-29` 写明"脚本缺失时静默 bail，不弹控制台"。⇒ 每分钟被拉起一次、什么也不做 |
| `IHUI-RefreshCliToken` | 每周 | `node scripts/refresh-cli-token.mjs`（**直接以 node.exe 为动作**，未走 vbs 包装） | 刷新 CLI token |
| `IHUI_Ai_Dev` / `IHUI_Api_Dev` / `IHUI_Web_Dev` / `IHUI_Dev_Start` | 单次 TimeTrigger（StartBoundary 2026-08-31，已过期） | `scripts/_*_independent.cmd` | 拉起开发服务 |
| `IHUI-AI-AutoStart` | 登录（**Disabled**） | `scripts/start-all-services.ps1` | — |
| `IHUI-AutoRecovery-HealthCheck` / `-Startup` | 5 分钟 / 登录（**均 Disabled**） | `scripts/auto-recovery/*.ps1` | — |

**另外两件实测到的事**：

- `scripts/backup-pg-local-hidden.vbs` 头注（第 5 行）自称是
  "Hidden launcher for IHUI-PG-Backup scheduled task"，但实测计划任务列表里
  **没有 `IHUI-PG-Backup`**。⇒ 该启动器是孤儿，数据库备份**没有**在自动跑（本机）。
- 全机 279 个服务中零个 IHUI 服务（§4.1），所以 AGENTS.md 里"部署环 IHUI-DEPLOYLOOP
  每 30 分钟跑一次"这类描述**在本机不适用**。

### 5.4 三个删除/杀进程面的确切判据

- **`scripts/c-drive-auto-maintain.ps1`**：总原则写在头注 `:15`
  —— *"删除面按名字，不整片；宽口径整片清扫只在 `IHUI_TEMP_WIDE_SWEEP=1` 时启用"*
  （实现 `:212-239`）。唯一删除出口是 `ForceDelete`（`:94`），每次先过 `Test-Protected`
  （`:57`）保护 `secrets` / `密钥` / `credentials` / `backups` / `BaiduSyncdisk` 等整目录。
  `-DryRun` 拦在该出口上。
- **`scripts/cleanup-zombie-processes.ps1`**：`Kill-Process`（`:131-140`，
  `Stop-Process -Force`）按三类理由下杀手——runaway install（`:200`）、
  高 CPU 低内存僵尸（`:220`）、孤儿 `tsx watch`（`:304`）；另对大内存进程做
  WorkingSet 修剪（`:251`）。判据来自 `Get-CimInstance Win32_Process` 的命令行（`:173`）。
  ⇒ 它**会杀进程**，且每 10 分钟一轮。
- **`scripts/g-root-guardian.ps1`**：监视路径硬编码 `$script:WatchPath = 'G:\'`（`:44`），
  配置 `g-root-blacklist.json`（`:42`），日志写
  `g:\IHUI-AI\.ihui-agent\tmp\g-root-guardian.log`（`:43`、`:238`）。
  分类是 **allowlist-first**：不在白名单、又不匹配黑名单/启发式的"未知项"被记
  `BLOCK:unknown`（`:233`），然后**递归强删**：`Remove-Item -Recurse -Force`（`:256`），
  失败退回 `[System.IO.Directory]::Delete($path, $true)`（`:261`）或
  `[System.IO.File]::Delete`（`:263`）。
  ⇒ **在盘符 `G:\` 根新建任何目录/文件都可能在一两秒内被无声删除**（AGENTS.md §15
  的"禁止在 `G:\` 根目录创建任何文件"就是这条的镜像）。
  风险如实登记：`WatchPath` 是写死的盘符，换机不会自适应。

### 5.5 服务端自动任务与 CI 侧自动动作

- **api 侧 BullMQ 定时任务 21 项**，清单唯一真源
  `apps/api/src/plugins/scheduler.ts:61-173`，逐条含 cron 与中文说明。节选与本档最相关的：
  `llm-call-log-purge-daily`（`15 4 * * *`，`:168-172`，**原文清除**）、
  `data-archive-daily`（`30 4 * * *`，`:69`）、`file-cleanup-hourly`（`:72`）、
  `cleanup-old-heat`（`:95-98`，清 90 天前热度数据）、
  `oauth-session-cleanup`（`:100-103`）、`subscription-recurring-charge`
  （`:105-108`，**连续包月自动扣款扫描**）、`budget-alert-check`（`:152-156`，
  80%/100% 阈值时**站内信 + 发邮件**）、`edu-arrear-remind-daily`（`:159-163`，
  **自动发催费提醒**）、`ai-feed-collect` / `-process` / `-drain`（`:131-149`，
  **服务端主动抓取 17 个外部信源并调 LLM 做摘要**）、
  第三方 token 刷新三项（`:112-127`，企业微信/公众号/钉钉）。
  消费端 `apps/api/src/workers/scheduler-worker.ts`。
  ⚠️ 这份清单是本仓代码声明；**这些任务是否在你的实例上真的在跑**取决于 Redis/BullMQ
  与 worker 是否启动，本文档**未验证**（§8）。
- **CI 每 20 分钟把整仓镜像推到国内仓库**：`.github/workflows/mirror-to-cn.yml`
  的 `on.schedule.cron: '*/20 * * * *'`（`:25`），
  推 `https://gitee.com/<owner>/IHUI-AI.git`（`:77`）与 GitCode（`:217-228`，
  未配 `GITCODE_TOKEN` 则跳过 `:223-225`）；检出是 `fetch-depth: 0` **全历史 + LFS**（`:38-40`）。
  ⇒ **进了 git 的东西（含历史提交）会被同步到第三方托管平台。**
  这是"哪些内容算内部"的硬边界：不要指望 `.gitignore` 之外的东西只留在自己手里。
  同时该任务会**删除国内仓的内部备份 tag**（`:99-148`，`git push --delete`）。

---

## 6. 出站网络目标清单（实测 grep，不凭印象）

### 6.1 模型厂商端点

`apps/ai-service/app/core/llm_gateway.py` 内出现的**去重后 29 个 https 主机**（实测命令
`grep -hoE "https://[a-zA-Z0-9.-]+\.[a-z]{2,}" apps/ai-service/app/core/llm_gateway.py | sort -u | wc -l` → 29）：

```
ai-gateway.vercel.sh          api.ainative.studio        api.cerebras.ai
api.cloudflare.com            api.cohere.ai              api.deepseek.com
api.inference.net             api.mistral.ai             api.nlpcloud.io
api.reka.ai                   api.routeway.ai            api.scaleway.ai
api.x5m5x.com                 api.xiaomimimo.com         apihub.agnes-ai.com
bailian-intl.alibabacloud.com bazaarlink.ai              dashscope.aliyuncs.com
generativelanguage.googleapis.com                        integrate.api.nvidia.com
k.token6688.com               modal.com                  models.inference.ai.azure.com
open.bigmodel.cn              opencode.ai                pnywsahxhac1qjbo.us-east-2.aws.endpoints.huggingface.cloud
router.huggingface.co         us-api.x5m5x.com           aizhs.top
```

实际启用哪些由 `LLM_PROVIDERS(_JSON)` 环境变量决定（`apps/ai-service/app/core/config.py`），
其 schema 由守门 `scripts/check-llm-provider-schema.mjs` 校验（32 provider 白名单，
AGENTS.md 守门速查第 33 项）。
⇒ **你发出去的文字会落到上面这些厂商**，具体哪一家取决于当次实例的配置。

"精选最新模型"白名单是 `CURATED_LATEST` 正则元组
（`apps/ai-service/app/services/model_catalog.py:288-296`，含 Anthropic / OpenAI / Google /
智谱四族的代次模式），未命中白名单的厂商走 `:744` 的兜底批次。

本地推理端点默认值（同仓 `apps/ai-service/app/core/config.py:161-164`）：
Ollama `http://localhost:11434`、LM Studio `http://localhost:1234`、llama.cpp
`http://localhost:8080`。

### 6.2 自家服务与产品面

- **`https://api.aizhs.top`** 是对外生产 API 基址（桌面端默认
  `apps/desktop/scripts/ensure-web-out.mjs:37,39`；对外文档承诺
  `apps/web/app/(main)/docs/api/page.tsx:73`）。
- **扩展**的 host 权限面收窄到三处：`http://localhost:8802/*`、
  `http://localhost:8803/*`（VoiceInput STT 兜底直连 ai-service）、
  `https://*.aizhs.top/*`（`apps/extension/wxt.config.ts:39-44`）。
  权限清单含 `tabs`、`scripting`、`identity`、`alarms`（`:28-38`）
  ⇒ **可向所访问页面注入脚本、可读所有标签页 URL、可后台定时唤醒**。
- **桌面端自动更新**拉两个端点：`https://aizhs.top/desktop-feed.json` 与
  GitHub Releases 的 `desktop-updater-feed/latest.json`
  （`apps/desktop/src-tauri/tauri.conf.json:43-47`），更新包**由 minisign 公钥校验**
  （`:48` 的 `pubkey`）。deep-link scheme `ihui://`（`:51-53`）。

### 6.3 告警 / 遥测出口

- **到人运维只有一条通道：邮件**。发信一律经
  `apps/api/scripts/notify-deploy-failure.ts`：Resend 端点常量
  `https://api.resend.com/emails`（`:36`），默认 From
  `智汇AI官方 <IHUI-AI@aizhs.top>`（`:35`），环境变量清单 `:40-46`；
  回落链 SMTP → Resend（`:389-396`），且经 `smtp.qq.com` 中继时 From 邮箱段必须等于登录账号
  （`:248` 注释）。
- 运维告警收件人由 `apps/api/.env` 的 `ALERT_EMAIL_TO` 控制（AGENTS.md §5e）。
- **无第三方产品遥测**：实测在 `apps/web/app`、`apps/web/src`、`apps/ai-service/app`、
  `apps/desktop/src`、`packages/shared/src` 检索
  `sentry|posthog|umami|plausible|gtag|google-analytics|mixpanel|amplitude`
  （`grep -rniE`）**未命中任何埋点 SDK**；命中的全是文档正文/营销文案里的字样
  （如 `apps/web/app/(main)/docs/mcp/page.tsx:106`、
  `apps/web/app/(main)/use-cases/product-analysis/page.tsx:57`）。
  ⇒ 用户行为统计走的是**自家** `analytics-events` / `visit-tracking` 表
  （`packages/database/src/schema/`），不发第三方。
- **CLI 的 `audit.jsonl` 只落本地，不上报**（`apps/cli/src/audit.ts:45`，无网络调用）。
- 服务端 `ai-feed-collect` 会主动抓 17 个外部信源（`scheduler.ts:132-135`）；
  具体信源清单在 `apps/api/src/services/ai-feed-service.ts`，**本档未逐项列出**（未验证）。

---

## 7. 没有保证的边界

### 7.1 会话恢复 / 检查点 **不等于** 备份

- 服务端检查点是**带 `expires_at` 的数据库行**
  （`apps/ai-service/app/services/agent_checkpoint.py:92-99`），到期即非长期存储；
  它的用途是"断点续跑"（`agent_loop_v2.py:15-16` 的功能自述），不是灾备。
- 可回滚性依赖 `checkpoint_id` 存在：`derive_step_evidence` 只有在拿到
  `checkpoint_id` 时才附 `rollback={kind:'checkpoint', available:True}`
  （`apps/ai-service/app/services/agent_loop_v2.py:645-655`）。无 checkpoint_id 时
  `write_file` 的 `rollback` 就是 `None` —— **写下去的内容没有任何自动回滚通道**。
- CLI 检查点写在 `~/.ihui/checkpoints/`（§3.1），删了就是删了；仓外恢复源
  只覆盖 **git 对象库**（`scripts/git-backup-refresh.mjs`），不覆盖用户家目录。

### 7.2 沙箱不覆盖的路径与形态

- CLI 第二层 OS 沙箱**默认关闭**（§2.2）。不启用时文件系统**无任何 OS 级约束**。
- macOS Seatbelt 后端**全盘可读**，`denyPaths` 不拦读（§2.2）。
- Windows 后端**不改写 ACL**，`denyPaths` 只在策略层（`platform/windows.ts:12-14`）。
- bwrap 的 `denyPaths` 是 tmpfs 遮蔽（写入不落真盘），不是读取屏蔽（§2.2）。
- `prlimit` / `plain` / `restricted-token` 三档降级**都没有文件系统隔离**
  （`detect.ts:81,112-114,125`）。
- `run_command`（服务端）**不经过** `os_sandbox`（§2.3、§4.2）。
- `network_guard` 只管经过它的那一次 HTTP 调用；子进程自己联网不受它管
  （`network_guard.py:6-7`）；它只在 DAG worker 一条链上被注入（`dag_scheduler.py:818-825`）。
- `path_guard` 的敏感目录只有 8 个片段（`path_guard.py:50-59`），且只护写盘工具；
  `.ssh`、`.aws`、`AppData`、`/etc` 等**不在名单里**。
- 策略层的命令/路径/网络判定全部基于**命令行文本**，凡"我方无法静态确定语义"的构造
  不在其能力范围内（见 §2.1、§2.2）。

### 7.3 模型说"我做完了"不构成事实

- 服务端 system 提示词里就写着**禁止**声称已完成（
  `apps/ai-service/app/services/conversation.py:738`：`"禁止声称已完成或成功\n"`），
  但**提示词不是验证**。
- 现有的可解释性是**单工具粒度**的证据推导（diff / test / rollback，
  `agent_loop_v2.py:638-656`），**不存在"另起一次独立请求、按预先声明的硬性指标逐条判定任务
  是否完成"的实现**。实测全仓检索
  `completion_verif|independent_verif|goal_verify|self_report` 零命中。
  ⇒ AGENTS.md §8 那条"禁止模型自评 yes"目前是**流程约定 + 本仓自身的工程纪律**，
  不是产品内置的机制。用户侧的对应动作应是：**自己核对 `git diff` / 测试结果 / 落盘文件**，
  而不是采信对话里的完成声明。
- 同理，"守门全绿"也不等于正确：AGENTS.md 多处记录 `--no-verify` 会使约 110 道守门对单次提交
  整体作废（§12e、守门 78 条）。

### 7.4 端侧授权的可信边界

- 破坏性 UI 动作的前端黑名单（`ui_action_bridge.py:23`）跑在用户浏览器里，
  是防误触不是防越权（§4.3）。
- 桌面端 `computer_*` 无端上确认（§4.4）：防线只有服务端的 admin 工具矩阵
  （`mcp_server.py:411-415`）与"该端是否在线并心跳"（`use-agent-control.ts:15-18`）。
  ⇒ **一个 admin 账号被冒用 = 那台桌面机被遥控。**

---

## 8. 未验证清单（本文拒绝断言的部分）

以下条目本档**没有取证**，读者与后续维护者不应把它们当作已披露事实：

1. **各服务在真实生产实例上的运行账号**。§4.1 只证伪了本机（G: checkout）；
   对外生产机（另一份 checkout）的 `nssm` 服务身份本文**未验证**。
2. **`scripts/env-backup-model-keys.mjs` 的"只补空值、绝不覆盖"实现细节**——
   仅有 AGENTS.md §5d 的文字承诺，本档未逐行读码。
3. **8803 端口在真实部署环境是否被主机防火墙拦在公网之外**：代码只证明
   `HOST=0.0.0.0`（`apps/ai-service/.env:7`）与 nginx 有公开 `/ai-service/` 反代
   （`deploy/docker/nginx.web.conf:62-65`），未做外部连通性测试。
4. **`ai-feed-collect` 的 17 个信源具体域名清单**（在 `ai-feed-service.ts`，未展开）。
5. **`apps/api` 生产库的实际留存策略取值**：只验证了默认 30 天与清除器接线（§3.2），
   未核对线上 `LLM_CALL_LOG_RAW_RETENTION_DAYS` 实配值。
6. **miniapp-taro / mobile-rn 端的全部出站域名**：未逐端枚举（§6.2 只覆盖 extension
   与 desktop 的声明式权限）。
7. **`hook_engine.py`（服务端）与 `apps/cli/src/hooks/` 的事件是否同集**：未做集合对账。
8. **桌面端 `admin` 窗口的实际加载面与权限差异**：`capabilities/default.json` 已逐条读过
   （§4.6 列了窗口/IPC/文件/shell 三类），但 `admin` 窗口是 lazy create，本文未取证它
   实际加载哪个 URL、是否与 main 拿到同一套 remote 授权。
9. **检查点/消息在数据库层的加密与 RLS 实配**：仓内有 `packages/database/src/rls.ts`，
   本档未验证其对会话内容表的实际覆盖。
10. **`IHUI-PG-Backup` 之外的数据库备份节奏**：本机该任务不存在（§5.3）；
    生产实例是否另设，未验证。
11. **注入表达式在真机 WebView2 窗口内的端到端**：§4.6 只证到"同内核家族的 Blink
    （本机 Edge 145 headless）里安装/派发/错误码全部按契约工作"，
    **未**在 `apps/desktop` 构建出的 GUI 壳内跑过一次（需 cargo 构建并起窗口）。
    桌面 `page_*` 的接线三条件（§4.6）另属未决项，不是已验证的"能跑"。

---

## 9. 修订记录与更新方式

本文只描述**取证时代码的样子**。任何一条能力被增删、任何一个降级路径被改动、
任何一道门被接上或摘掉，都必须在同一提交里改本文。
漏洞与不实披露的报告渠道见 `SECURITY.md`（该文件同时登记了季度公开审计的节奏承诺）。

| 日期 | 类型 | 内容 |
| --- | --- | --- |
| 2026-09-25 | 首次建立 | 按本仓代码逐条取证成文。取证快照日期 2026-09-24 ~ 09-25，机器实测项见 §4.1 与 §5.3 |
| 2026-09-25 | 两处事实缺陷已修 | 钩子 trust gate 接线（§5.1）与 `readonly` 沙箱档的"禁止一切命令"改为 `null` 三态（§2.1）；对应登记行已就地更新为"当前语义 + 如何信任一个目录" |
| 2026-09-25 | 桌面宿主一节成文 | 新增 §4.6（桌面读写面 / 执行身份 / `page_*` 未开启的三条实测判据 / Blink 注入派发实测 / WebView2 数据落点与当日巡检读数），并把 §8 第 8 条收窄为"admin 窗口未取证"、新增第 11 条"真机 WebView2 端到端未跑" |

**本轮取证中被本文否证的既有说法**（写下来以免下一个人再信一遍）：

| 说法 | 出处 | 实测结论 |
| --- | --- | --- |
| "本机就是生产机，IHUI-API / IHUI-DEPLOYLOOP / IHUI-MONITOR 等 nssm 服务在跑" | AGENTS.md §5b / §12 | **在本 checkout 上否证**：279 个 Windows 服务里零个 IHUI 服务，`nssm.exe` 两处路径均不存在，8801/8802/8803/8810/8811 无监听（§4.1） |
| "git clone 恶意仓库不会自动执行 hooks" | `apps/cli/src/hooks/trust.ts:13` | **取证当时否证**：`gateHook` / `isFolderTrusted` 无任何外部调用方，派发路径不过 trust gate。**2026-09-25 已修**：来源戳 + `runHookEntry` 单点查门，default-deny（§5.1） |
| "`IHUI-PG-Backup` 计划任务在跑数据库备份" | `scripts/backup-pg-local-hidden.vbs:5` | **否证**：本机计划任务列表里没有该任务，启动器是孤儿（§5.3） |
| "`readonly` 沙箱档 = 只读、无 shell 命令" | `apps/cli/src/sandbox/index.ts:93` 描述文案 | **取证当时否证**：`commandAllowlist: []` 在两处强制点都被当作"未设置"，该档对命令名零限制。**2026-09-25 已修**：该档改取 `null`（一律拒绝，fail closed），两套沙箱同批（§2.1） |
| "`kill-git-selector` 定时任务在清理 git 选择器弹窗" | 计划任务 `IHUI-KillGitSelector`（每 1 分钟） | **否证**：其包装的 `scripts/kill-git-selector.ps1` 在本 checkout 不存在，任务每分钟空跑一次（§5.3） |
| "`llm_call_logs` 原文清除只是注释里的打算" | `packages/database/src/schema/llm-call-logs.ts:29-34` | **反向否证（确实接线了）**：清除函数 + worker 消费 + 每日 04:15 cron 三处齐备（§3.2） |

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
