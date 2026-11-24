<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11 续轮取证：Codex 26.1111 引擎侧权限强制层 + Windows sandbox 强制判据

> 本轮目标：把上一轮 R11-command-runner.md 缺口里点名要补的「**策略枚举本体的真实字段名**」
> 与「**Windows sandbox 能强制到什么程度**」取证到位，并复现为本仓独立判据 gate。
> 水位：纯只读（`strings` 定向抽取，不反编译、不运行对侧程序）。

## 0. 本轮为什么换目标

上一轮 R11-command-runner.md 已覆盖 command-runner 的 crate 清单、命令执行能力面、
Windows 沙箱 API、参数转义、模块结构，但其「缺口」章节明确留了四条待办：

- argv 转义精确算法未确认；
- 网络过滤实际落点未定位；
- `token.rs` 降权步骤未展开；
- **策略枚举本体的真实字段名需取证上层协议/主程序侧**。

本轮 MSIX 已更新到 `26.1111.2228.0`，且**引擎侧新增三个原生 exe**（上一轮前端 chunk
取证时还不存在/未注意）：

| 二进制 | 体积 | 角色 |
|---|---|---|
| `codex-code-mode-host.exe` | 80,459,056 | code-mode 代码执行宿主（Jupyter 式 cell，gRPC） |
| `codex-command-runner.exe` | 8,932,144 | 命令执行 + 权限档案 + Windows sandbox 强制 |
| `codex-windows-sandbox-service.exe` | 58,484,528 | 沙箱服务 |
| `codex-windows-sandbox-setup.exe` | 19,556,144 | 一次性预配器（建 CodexSandboxUsers 账户/组） |
| `codex.exe` | 382,514,992 | 主引擎 |

本轮把火力集中在**权限档案形状 + Windows sandbox 强制判据**——这是「agent 怎么把一套
权限落地成真沙箱」的最底层，比前端 chunk 的行为逻辑又深一层。

## 1. 引擎侧权限档案真实形状（补上一轮缺口）

从 `codex-command-runner.exe` 抽出的策略枚举字段名（逐字）：

```
struct CanonicalFileSystemPermissions { entries, glob_scan_max_depth }
struct RawFileSystemSandboxEntry { access, missing_path_behavior }
enum RawFileSystemPath { Special | Path | GlobPattern }
enum FileSystemSpecialPath { Root, Minimal, ProjectRoots, Tmpdir, SlashTmp, Unknown }
enum TaggedPermissionProfile { Managed | External }
enum SerializedManagedFileSystemPermissions { Restricted | Unrestricted }
```

访问档枚举（`RawFileSystemSandboxEntry.access`）取值（逐字）：

```
ReadWriteDenyRestrictedEnabled   → read / write / deny / restricted / enabled（+ none 别名）
```

关键结论：**Codex 引擎侧文件系统访问档是五档**（read / write / deny / restricted /
enabled），而非本仓 `permission_profiles.py` 现有的三档（read / write / deny）。
`restricted` 与 `enabled` 是 Windows sandbox 强制语义下的两档。

## 2. Windows sandbox 强制判据（本轮核心取证）

`codex-command-runner.exe` 三条强制判据错误消息（逐字，作为规则锚）：

```
only restricted managed filesystem permissions can be enforced by the Windows sandbox
only managed permission profiles can be enforced by the Windows sandbox
permission profile requests full-disk filesystem writes, which cannot be enforced by the Windows sandbox
```

还原成判据（这是 Windows 原生沙箱的**能力边界**声明）：

1. **External 档案不可被 Windows sandbox 强制** —— 只有 managed 档案走原生强制路径
   （External 表示由外部沙箱接管）。
2. **full-disk 写不可强制** —— 档案请求覆盖整个文件系统的写时，Windows sandbox 管不住。
3. **managed 但 unrestricted 不可强制** —— 只有 `restricted` 范围的托管文件系统权限能被强制。

唯一可强制路径：**managed + restricted**。

## 3. 取证到但本轮不移植的部分（诚实边界）

- **Windows sandbox 账户模型**（`codex-windows-sandbox-setup.exe`）：`CodexSandboxUsers`
  托管组、`CodexSandbox<account>` 每账户、capability SID、`Local\CodexSandboxReadAcl`、
  `Global\CodexSandboxSetup` mutex、DPAPI 保护凭据、WFP 防火墙规则
  （`codex_wfp_dns_53_*` / `codex_wfp_smb_445_*` / `codex_wfp_icmp_*`）——这是**真实降权
  执行层**，属 `proc_sandbox.py` / `code_exec_sandbox.py` 射程，本 gate 不碰。
- **code-mode gRPC 全生命周期**（`codex-code-mode-host.exe`）：`OpenSession / CloseSession /
  SubscribeToToolCalls / CompleteToolCall / YieldObservation / CancelWait / Terminate /
  GetProcessMetrics / Execute / Wait / AcknowledgeNotification`——上一轮
  `code_mode_cell_lifecycle.py` 已复现 cell 状态机与并发边界，本轮不重复。
- **Starlark 沙箱策略**：`execpolicy` + starlark 0.14.2 命中——上一轮报告已列为「最值得
  借鉴」，本仓策略层引入声明式规则语言是后续独立任务，非本轮 gate 射程。

## 4. 本轮复现：`app/core/sandbox_enforcement_gate.py`

把「**这套权限档案 Windows sandbox 能不能强制**」抽成**下发前的纯函数判据**，不碰进程/
token/账户（那是真执行层），只回答可行性：

- 形状枚举：`FileSystemAccess`（五档 + none→deny 别名）/ `PermissionProfileKind`
  （Managed/External）/ `ManagedFilesystemScope`（Restricted/Unrestricted）。
- 判据 `check_windows_sandbox_enforceable()`：四条固定顺序——
  1. External → `BLOCKED` + `CODEX_ERR_ONLY_MANAGED`；
  2. full-disk 写（write/enabled 隐含写）→ `BLOCKED` + `CODEX_ERR_FULL_DISK_WRITES`；
  3. Managed+Unrestricted → `BLOCKED` + `CODEX_ERR_ONLY_RESTRICTED_MANAGED`；
  4. Managed+Restricted → `ENFORCEABLE`。
- 三态结论：`ENFORCEABLE / BLOCKED / UNDETERMINED`（kind 缺失、managed 缺 scope ⇒
  `UNDETERMINED` 点名原因，不冒充结论——§0.3「没判绝不写成判过」）。

### 与既有模块的分工（不重复造轮子）

| 模块 | 射程 |
|---|---|
| `permission_profiles.py` | 档案声明解析 + extends 继承（read/write/deny 三档 + glob_scan_max_depth） |
| `managed_permissions.py` | 托管允许集下的权限**组合求解**（四维 sandbox/approval/reviewer/profile） |
| `proc_sandbox.py` / `code_exec_sandbox.py` | 真实降权执行（Job Object / 受限 token） |
| **`sandbox_enforcement_gate.py`（本轮）** | **Windows sandbox 强制可行性判据**（五档 + 三条 codex 错误） |

## 5. 一轴超越

对照把判据埋在引擎内部，**只在真的去 enforce 那一刻才抛错**——那时策略已下发、cell 可能
已起，晚了。本仓把「能不能 enforce」**提前到下发/审批/预检阶段**作为纯函数判据：结论可
diff、可单测、可在策略下发前拦下不可强制的档案，避免「跑到一半才发现沙箱管不住」。
零第三方依赖、零执行、纯函数 + 结构化 verdict。

## 6. 验证

- 13 个测试全过（`tests/test_sandbox_enforcement_gate.py`），覆盖四条判据、三态、
  none 别名、`implies_write`、便捷构造器抛错。
- **反向变异验证**：禁用 full-disk 判据（`if False and ...`）后 `test_full_disk_write_blocked`
  两个参数用例失败，证明判据非恒真；恢复后全绿。
- ruff 全绿（UP042 按项目既定例外 `# noqa` 处理，与 `permission_profiles.py` 同因）。
- 回归：`managed_permissions / permission_profiles_58 / code_exec_sandbox /
  sandbox_policy_not_self_authored` 共 96 测试全过，新 gate 未破坏既有沙箱/权限层。
- 水印：新增两文件（gate + 测试）各 1 处 `IHUI-AI-PROVENANCE`。
- 红线遵守：只读 strings 取证、不反编译、不运行对侧程序、不粘源码、不碰在飞文件
  （新文件独立，未改 `permission_profiles.py` / `managed_permissions.py`）。

## 7. 遗留缺口

- 五档 `access` 的完整 `missing_path_behavior` 语义（present/absent 时行为）只取到字段名，
  未展开枚举值——后续可续挖。
- `glob_scan_max_depth` 的默认值与 `glob_pattern` 匹配算法未取证。
- Windows sandbox 真实降权执行（账户/token/WFP）属执行层，本 gate 不覆盖。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
