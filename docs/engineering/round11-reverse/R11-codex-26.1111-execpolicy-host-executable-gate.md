<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11 续轮取证：Codex 26.1111 execpolicy host_executable 声明校验层

> 承接前两轮：R11 engine-permission-enforcement（Windows sandbox 强制判据）→
> execpolicy-network-rule-gate（网络规则建表 host 校验）→ 本轮 host_executable 声明校验。
> 三轮合起来把 execpolicy 的「策略可执行性验证链」吃透：沙箱能不能强制 → 网络规则能不能
> 建表 → 可执行文件声明能不能合法建表。

## 0. 本轮目标

在 `codex-command-runner.exe`（MSIX `26.1111.2228.0`）上定向 strings，命中 execpolicy
模块的**可执行文件声明校验层**——策略语言声明「这个命令在宿主机上对应哪个可执行文件」
时的四条判据。

## 1. host_executable 四条声明判据（逐字）

```
host_executable name cannot be empty
host_executable name must be a bare executable name (got <值>)
host_executable paths must be strings (got <类型>)
host_executable paths must be absolute (got <值>)
```

- **name**：可执行文件的 bare name（`python`），不能带目录成分（`dir/python`、
  `C:/x/python`、`/usr/bin/python`）——目录成分属于 path，不是 name。
- **paths**：候选绝对路径列表（字符串数组），每个元素必须是绝对路径。

## 2. IPC spawn 协议（同轮榨出，本轮不移植但记档）

command-runner 的进程拉起走一套 **Message 9 变体 IPC 协议**（pipe 帧传输）：

```
Message::SpawnRequest | SpawnReady | Stdin | CloseStdin | Output | Resize
       | Exit | Error | Terminate
SpawnRequest{command, cwd, env, permission_profile, workspace_roots, codex_home,
             real_codex_home, cap_sids, network_proxy_restricting_sid, timeout_ms,
             tty, stdin_open, private_desktop_name}   # 13 字段
StdinPayload{data_b64} | ExitPayload{exit_code, timed_out} | OutputPayload | ResizePayload
```

这套协议是「agent 怎么把一次工具执行转成交付给沙箱进程」的传输层形状——本轮记录
不移植（本仓用 Tauri IPC，形态不同），但**协议的完备性**（9 变体覆盖 spawn→stdin→
resize→exit→error→terminate 全生命周期）值得借鉴。

## 3. 与既有模块的分工（不重复造轮子）

| 模块 | 职责 | 阶段 |
|---|---|---|
| **`host_executable_gate`（本轮）** | 声明 host_executable `{name, paths}` 的语法校验 | 策略写入前 |
| `exec_env.resolve_stdio_command` | 运行时 PATH 解析（裸名 → 找到 exe 绝对路径） | 执行时 |
| `worker_exec_context` | cwd 绝对 + 落在允许根内的工作区边界 | 执行边界 |

三者互补：**声明合法（本 gate）→ 解析到路径（exec_env）→ 执行边界合规（worker_exec_context）**。

## 4. 本轮复现：`app/core/host_executable_gate.py`

把「一份 host_executable 声明能否合法建表」抽成**策略写入前的纯函数 gate**：

- `validate_host_executable(name, paths)`：四条判据，固定顺序——
  1. name 空 → 2. name 非 bare（含 `/` 或 `\`）→ 3. paths 类型错（非 list / 含非 str）
  → 4. paths 含相对路径 → ACCEPTED。
- 三态：`ACCEPTED / REJECTED / UNDETERMINED`（name 非字符串 ⇒ UNDETERMINED 点名原因，
  §0.3「没判绝不写成判过」；paths 类型本身非法 ⇒ REJECTED，因为那是 serde type error
  有明确判据，不是"没判"）。
- 跨平台绝对路径判定：`ntpath.isabs(path) or posixpath.isabs(path)`（任一认作绝对即算，
  对标 Codex 跨平台策略语义——声明侧接受任一平台绝对形态）。

每条 REJECTED 带 rule_id（如 `host_executable.name.not_bare`）+ 逐字 codex_error 锚 +
got 值，审计可追溯到对侧具体校验。

### 判据顺序的取舍（诚实记录）

name 先于 paths（对标 codex serde 逐字段顺序：先标量 name、再列表 paths）；name 的
"空"与"非 bare"按空优先。这是本仓显式选择，测试 `test_name_*_takes_precedence_over_paths`
钉住该顺序。

## 5. 一轴超越

对照把校验埋在 execpolicy serde 反序列化层，错误只在**引擎加载策略那一刻**抛（晚了——
策略已下发、可能已执行）。本仓抽成**策略下发前**纯函数 gate：结论可 diff、可单测、可
在声明写库前拦下非法形状，拒绝原因结构化成 rule id + codex 错误锚。零第三方依赖、零
执行、纯函数 + 结构化 verdict。

## 6. 验证

- 21 个测试全过（`tests/test_host_executable_gate.py`）：四条判据各覆盖正/反例、跨平台
  绝对路径（POSIX / Windows 盘符 / UNC）、判据顺序优先级、UNDETERMINED。
- **反向变异验证**：禁用 bare-name 判据（`if False:`）后 5 测试失败，证明判据非恒真；
  恢复后全绿。
- ruff 全绿（UP042 按项目既定例外 `# noqa`；import 排序 --fix）。
- 回归：既有 `test_exec_env_bootstrap.py`（13 passed / 1 skipped）+
  `test_worker_exec_context.py`（11）全过，新 gate 未破坏既有执行层。
- 水印：新增两文件各 1 处 `IHUI-AI-PROVENANCE`。
- 红线遵守：只读 strings 取证、不反编译、不运行对侧程序、不粘源码、不碰在飞文件（新
  文件独立，未改 `exec_env.py` / `worker_exec_context.py`）。

## 7. 遗留缺口

- IPC Message 9 变体协议（§2）本轮记档不移植（本仓 Tauri IPC 形态不同）；若未来本仓
  桌面端要统一工具执行传输层，这套「spawn→stdin→resize→exit→error→terminate 全生命
  周期」的变体设计可作参照。
- `SpawnRequest` 13 字段的逐字段类型/默认值未全取证（只到字段名）。
- execpolicy 的 Starlark `match`/`not_match` 示例自测机制本仓 policy_dsl 已复现，本轮未重复。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
