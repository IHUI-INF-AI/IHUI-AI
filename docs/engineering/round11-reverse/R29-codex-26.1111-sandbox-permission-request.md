<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R29 · Codex 26.1111 沙箱权限请求档位封闭集（sandbox_permissions 三档）

> 逆向-复现-超越铁律第 ③ 步交付。对照程序：Codex CLI 26.1111 主引擎
> `codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`（364.8MB，strings 定向抽取，
> 不做全量反编译）。本仓复现：`app/core/sandbox_permission_request.py` +
> `tests/test_sandbox_permission_request.py`。

## 1. 目标

下潜 agent loop **审批/沙箱越权请求**轴。前轮 R28 固化了回合错误码封闭集；本轮转
exec 参数层——`sandbox_permissions` 字段的**请求档位**值域。

## 2. 取证（Evidence）

codex.exe strings 逐字锚（连续 token 拼接形态，多次命中）：

```
sandbox_permissions additional_permissions justification prefix_rule workdir
use_default require_escalated with_additional_permissions
```

三档值域逐字确证：`use_default` / `require_escalated` / `with_additional_permissions`。
语义（对照上游 `permissions_instructions`）：
- `use_default`：默认沙箱策略放行；
- `require_escalated`：请求越权到沙箱外执行（需审批 + justification）；
- `with_additional_permissions`：在既有授权上追加权限（不整体越权）。

**取证纠偏（防后人踩，模块 docstring + 测试双重标注）**：strings 中 `none` 紧邻
`terminal_statusnone` 出现，是否属 `sandbox_permissions` 值域**未确证**——故本封闭集
**只收三档**（对照逐字确证的），`none` 作为本仓既有默认单列（`NONE_DEFAULT`），不计入
成员。三档是否同一 Rust enum 变体、serde rename 为何未从二进制确证。

## 3. 本仓真空白确认

- `app/core/exec_params.py:223` `sandbox_permissions: str = "none"` 是**自由字符串**，
  无封闭集、无校验——消费面可凭空写任意档位而静默放行；
- 全仓 grep `require_escalated` 仅在 `permissions_instructions.py:76` 作**文档字符串**出现
  （教 agent 怎么请求越权），`with_additional_permissions` **零命中**，无任何封闭集/校验；
- 结论：本仓缺「`sandbox_permissions` 请求档位封闭集 + 需审批/是否整体越权判据」。

## 4. 复现交付

`app/core/sandbox_permission_request.py` + `tests/test_sandbox_permission_request.py`（24 用例）。

- **`SandboxPermissionRequest`** 三档 `StrEnum`（逐字对照，对齐 `turn_stop_reason` 同纪律）；
- **`SANDBOX_PERMISSION_REQUEST_VALUES`** 字面量总表（供守门静态解析，漂移由 pytest 钉死）；
- **`NONE_DEFAULT = "none"`**：本仓既有默认单列，原样放行但不计入封闭集成员（归属未确证）；
- **`ensure_sandbox_permission_request()`**：值域闭合判据，未登记档位抛
  `SandboxPermissionError` 点名（对齐 `ensure_turn_stop_reason`，不静默放行）；
- **`requires_user_approval()`**：`require_escalated`/`with_additional_permissions` ⇒ True；
  `use_default`/`none` ⇒ False；未登记 ⇒ 抛错（遵循 §0 铁律 3「没判绝不写成判过」）；
- **`is_full_escalation()`**：仅 `require_escalated` 是整体越权；`with_additional_permissions`
  是既有授权上追加、非整体越权。

## 5. 一轴超越

对照把三档散在 exec 参数序列化与各审批分支（运行时遇到才区分），「该请求是否需用户审批、
是否整体越权」靠**分支位置隐式决定**，无统一判据。本仓：
- 档位**显式 StrEnum 封闭集** + 校验判据（未登记抛错点名）；
- **`requires_user_approval`/`is_full_escalation` 纯函数**输出「需审批 × 整体越权」二维；
- 未登记档位**抛错不静默判 False**（对齐 §0 铁律 3）；
- 可 diff 可单测可挂审批前置。

## 6. 验证实数

- **24 pytest 全过**。含 **3 处反向变异**：use_default 误判需审批 / require_escalated 误判非整体 /
  with_additional_permissions 误判不需审批——均由封闭集 + 判据守住。
- **ruff 全绿**（--fix 自动修 1 处 import 排序）。
- **py_compile OK**；**水印 head/tail 2/2**。

## 7. 诚实边界

- **未接生产路径**（`exec_params.py` 属核心件，接入点留属主）。本模块是**请求档位真相源**，
  可被 `exec_params.sandbox_permissions` 校验点引用，不改动其现有默认值语义。
- 三档是**对照逐字确证**，但「是否需审批 / 是否整体越权」二维语义是本仓按对照上游
  `permissions_instructions` 推定的工程映射（`require_escalated` 需审批有文档支撑；
  `with_additional_permissions` 需审批是推定，对照未逐字段确证）。
- `none` 是否属对照值域未确证，单列处理；若后续确证应并入封闭集并调整成员数。
- 对照是否还有第四档（如 `sandbox_permissions` 之外的 `additional_permissions` 字段语义）
  未下潜——本轮只取 `sandbox_permissions` 单字段值域。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
