<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 竞品逆向 Round10：把判据族装车到真实入口（2026-11-23）

> 对照件：Qoder CN 0.5.14 / TRAE CN 3.4.20 / WorkBuddy 5.11.3 / DeepSeek Harness 0.2.2-rc.5
> 前序：`competitive-reverse-engineering-round8-2026-11-14.md`（复现 4 判据）、
> `competitive-reverse-engineering-round9-2026-11-15.md`（补 5 判据 + 聚合入口，122 用例）
> 本轮性质：**不是再造判据，而是把已造好的判据接到真实业务入口**（round9 的结论是「零生产 importer」）

## 1. 问题：造好没装车

round9 沉淀了 9 个判据模块与一个聚合入口 `app/services/reverse_engineered_gates.py`（六 kind），
但 `grep` 结果显示除 `revert_check` 一处 opt-in 外，**没有任何生产代码调用它们**。
按 §0.9「判据必须在真跑它的那一刻才成立」，这一族能力当时等于不存在。

## 2. 本轮装了两处

### 2.1 `GuardedToolPipeline` stage 2.5：gate_suite 前置

- `apps/ai-service/app/services/guarded_tool_pipeline.py`
  - 新常量 `STAGE_GATE` / `ERROR_GATE_BLOCKED`、`GATE_KEY = "__gate_suite__"`、`GATE_KEY_ABSENT` 哨兵
  - `extract_gate_request(args)`：把控制键 `__gate_suite__` 从工具入参里剥离，返回 `(clean_args, gate_spec)`；
    非映射/无键不猜形状（返回哨兵 = 不介入）
  - stage 顺序：prompt(1) → input scan(2) → **gate_suite(2.5)** → budget(3)。判据 `verdict != "allowed"`
    即 `PipelineError(STAGE_GATE, gate_suite_blocked, reason)`，判据抛异常一律 fail-closed
  - `PipelineResult.gate` 面板随 `to_dict()` 输出，前端/审计可见判据原文
- 真调用点：`apps/ai-service/app/services/agent_loop_v2.py::_security_precheck`
  在构造 pipeline 后提取控制键、回写 `tc.args = gate_args`（控制键绝不进真实工具），
  阻断回填 `{"blocked": True, "reason": msg, "scan": pr.scan, "gate": pr.gate}`

**关键缺陷（本轮抓到并修）**：`_PreGate` 新增的 `gate` 字段被插在 `timings` 之前，
而早期 stage 用**位置参数**构造 `_PreGate(False, errors, budget, scan, timings, False)` ——
于是 `timings` 落进 `gate`、`False` 落进 `timings`，`to_dict()["gate"]` 会被写成 timings 字典。
`mypy --strict` 抓到了四处 `arg-type`，行为测试**没有**抓到。修法：字段挪到末尾 + 新增
`test_pre_gate_field_order_keeps_timings_and_gate_separate` 钉住 `dataclasses.fields` 顺序与六参构造。

### 2.2 `context://` 统一命名空间进工具入口

- `apps/ai-service/app/services/mcp_server.py`
  - `_deref_context_uri_alias(path, roots)`：把 `context://workspace/<rel>` 降成工作区相对路径
  - 接在 `_validate_path_in_workspace`（22 个调用点的单一入口），读写工具全部自动生效：
    `read_file` / `list_files` / `write_file` / `file_edit`
  - 虚拟 URI **只换名字**：降级后仍走白名单 + symlink 解析 + 敏感文件/目录黑名单三层真实判据
  - 四个工具 schema 引用同一份 `_CONTEXT_URI_HINT`（§0.6 单一真相源），模型可见这个命名空间

**判据自身的坑（本轮发现）**：`context_fs.resolve_context_uri` 第 10 步把调用方传入的
`roots[namespace]` **原样拼进 `canonical_path`**。若接线层把宿主目录当虚拟根，
canonical 会变成 `context://workspace/C:/...` ——「看着像虚拟 URI、其实是宿主路径」，
正是判据注释里禁止的用法。修法：传逻辑根 `_CONTEXT_VIRTUAL_ROOT="root"`，
并加防御断言：虚拟路径任一段含盘符冒号或反斜杠 ⇒ 拒绝。

## 3. 验证（现读）

- 新增接线测试：`tests/test_gate_suite_pipeline_wiring.py` **17 例**、
  `tests/test_context_uri_tool_namespace.py` **23 例**（合计 40 例）
- 相关面合并：26 个测试文件 **671 passed, 1 skipped**（含既有 54 例管线/判据回归）
- ruff：本次四个文件 `All checks passed`；mypy：`guarded_tool_pipeline.py` 自身 0 error
  （仓库存量 764 error 在其它文件，非本轮引入）
- 反向变异（三次，均已恢复）：
  1. gate 阻断分支 `if False` ⇒ 4 例如期转红
  2. `agent_loop` 面板键 `"gate"`→`"gate_panel"` ⇒ 结构锚点 1 例转红
  3. `_PreGate` 字段序回退 ⇒ 字段序用例转红
  4. `if not ctx_ok` 短路 ⇒ 3 例转红（含「拒绝必须由判据直接给出」两例）

## 4. 超越轴（相对对照件）

1. **一次收口 vs 半态**：对照的虚拟路径允许「已解析未鉴权」；本仓 allowed 必须同时产出
   规范路径与 reason=ok，否则改判 `half_state_rejected`。
2. **虚拟命名空间不豁免任何真实判据**：`context://` 降级后仍过敏感文件黑名单
   （`data/sessions.db`、`.env*`、`.git/` 等），对照件没有这一层。
3. **控制键离开工具入参**：`__gate_suite__` 在进入真实工具前被剥离，判据请求不会污染
   handler 的 `arguments` 形状（模型也不可能通过伪造 handler 入参绕过）。

## 5. 仍欠（诚实记录）

- 聚合入口的 `scan_tier` / `computer_step` 两 kind 仍是 `unjudged`：判据返回裸 str / 判定键叫
  `status`，签名对不上 ⇒ 刻意不硬接（硬接会造第二套语义）。
- `edit_intent.evaluate_edit_intent` 需要 `{id, files:[{path, read_evidence_sha256}], command}`
  与当轮读基准，`file_edit` 目前没有这条数据链；`code_exec_sandbox.decide_code_execution`
  是 AST 判据（管 Python 代码），`run_command` 是 shell 命令字符串 ⇒ 两者都不是本轮能「真跑」的入口。
- DeepSeek Harness 336 个 `@deepseek-ai` 包只吸收了 10 个；Trae 原生 DLL 仍停在导出符号级
  （`BP_*` / `ai_agent_ipc_*` / 内嵌 libgit2、aws-lc）；WorkBuddy `daemon-supervisor` 的
  pid 注册表与 env 通道未落。以上由并行取证席继续，产物落
  `docs/benchmark-evidence/2026-11/deep-native-2026-11-23/`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
