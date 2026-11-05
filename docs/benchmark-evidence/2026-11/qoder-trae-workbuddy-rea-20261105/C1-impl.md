<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# C1 工具面惰性装载（tool_surface_budget）

- HEAD（开工现读）：`923546ffec8e145a90c551f8c9c035eca9bc42f4`
- 计划改动：
  - 新建 `apps/ai-service/app/services/tool_surface_budget.py`
  - 新建 `apps/ai-service/tests/test_tool_surface_budget.py`
  - 接线 `apps/ai-service/app/services/mcp_server.py`（仅 `list_tools` 列表面一处）
- 边界自查：开工时 `git status --porcelain -- .../mcp_server.py .../tool_surface.py` = 空（无他席在飞）⇒ 放行。
  `apps/ai-service/tests/test_workbuddy_tasks.py` 是他席在飞，未碰。

## 现场读数

- 取证册 `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W1-workbuddy-main.md`
  §2 表行 21 观察到对侧 65 枚工具面里的**惰性装载**组（`ToolSearch` + `DeferExecuteTool`）；
  缺口表第 ⑤ 行判本仓「零对位」。
- 复跑取证册口径 `grep -c "^async def _tool_\|^def _tool_" app/services/mcp_server.py` = **80**（与册子一致）。
- 但**列表面**口径是另一格：`len(_TOOLS)` 现读 = **111**（`_TOOL_HANDLERS` 同为 111，双射判据在位）。
  ⇒ 常驻进 prompt 的是这 111 枚，比取证册记的 80 更多；本票按 111 枚这一面收口。
- 仓内既有同族件（全部 import 复用，未复写）：`tool_surface.py`（能力/形态门）、
  `capability_matrix.py`（台账）、`permission_mode.py`（ChatMode 词汇表 + 模式×权限收窄单源）、
  `tool_budget_governor.py`（**执行面**配额，与列表面不同轴，互不替代）、
  `mcp_server` 的 `_DEFERRED_TOOL_SCHEMAS` + `get_tool_schema`（deferral 反查面）。
- `permission-lease` 现读只在 TS 侧（`apps/cli/src/tools/permission-lease.ts` + `scripts/check-permission-lease-bounded.mjs`），
  ai-service 无 Python 对应件 ⇒ 无可 import 之物；本票未涉及租约轴，未复写。

## 落了什么

1. `app/services/tool_surface_budget.py`（658 行，纯判据、零第三方依赖：只用 stdlib `json/dataclasses/contextvars/contextlib` + 本仓既有模块）
   - 输入：`RoundContext`（会话模式 / 已声明意图（支持 `前缀*`）/ 上轮用过 / 上轮被拒 / 轮次）+ `BudgetTable`（具名预算表，模式→档）。
   - 输出：`SurfaceDecision`（本轮可见工具集 + **逐条** `SurfaceEntry.reason`，说清每枚为什么在/为什么不在 + 判据现场 limits）。
   - 三态：`selected` / `deferred` / `unjudged`。`unjudged` 的唯一出口 `_unjudge()` **原对象、原序**交回入参清单，一条不藏；
     触发格逐条列在模块头注（无上下文 / 模式缺 / 模式认不出 / 表不在册 / 表缺该档 / 档要求意图而本轮没有）。
   - 优先级：5 必付格 `always` → 4 本轮意图 → 3 上轮用过 → 2 表内优先族 → 1 中性 → 0 降权（`demote`/上轮被拒）；
     上限两轴可独立设（`max_visible` / `max_schema_bytes`），`always` **不受上限挤压**。
   - 在册表：`lean`（不设上限，只走必付格）/ `tight`（build·spec 28 枚 24KB，plan·review 18 枚 14KB，ask 需显式意图）；
     五档 ChatMode 全覆盖，缺档即整表不生效（由测试形状锁钉住）。
   - 接线出口 `apply_tool_surface_budget()`：先 `filter_visible_tools`（能力门在前），把被摘掉的枚作为 `ineligible` 下传 ⇒
     即使误把全量清单交进纯判据也翻不回来；env `MCP_TOOL_SURFACE_BUDGET` **只负责选表**，纯判据 `select_tool_surface` 不读 env。
   - 刻意不做的一件事（头注有因）：不在列表面再跑一次模式×权限收窄 —— `get_tool_schema` 不在 `READONLY_TOOLS` 里，
     收进来会把反查面一起挤掉，那是「惰性装载退化成单向阉割」。模式×权限归 `routers/llm.py` 既有单源那道闸。
2. `app/services/mcp_server.py`（+23/−3，只有列表面一处）：`list_tools(*, surface_context=None)`；
   末尾 `return _filter_visible_tools(tools)` → `gated = _filter_visible_tools(tools)` +
   `return _apply_tool_surface_budget(gated, context=surface_context)`。`_TOOLS`/`_TOOL_HANDLERS` 一条不动。
3. `tests/test_tool_surface_budget.py`（506 行，29 例）：①缺席仍可直调（spy 命中 + 双射判据不破）②unjudged ⇒ 与全量逐字同序同对象（反向牙）
   ③表改值 ⇒ 集合变化可断言（10/20/无上限三档单调；意图/上轮用过捞回；被拒降权但不锁死）+ `get_tool_schema` 在 `max_visible=0` 下仍必付
   ④能力门次序（两种喂法 + `computer_*` 经 env 与经产品形态两条通道）⑤纯判据 env 无关 ⑥上下文载体作用域/异常复位 ⑦接线锁
   （含 AST 层：`list_tools` 里必须有这把尺、`call_tool` 里必须没有）。
4. 两份新 .py 已 `watermark.mjs inject`（派单书写「新建 .py 不必注水印」与现读不符：`scripts/watermark.mjs:190` 的扩展名族含 `'.py': 'hash'`，
   且 §5c「新建源文件必跑 inject」是铁律 ⇒ 按铁律办并验证）。

## 验证末行现读

- `pnpm check:pytest -- tests/test_tool_surface_budget.py`
  → `run 档结论:pass(exit 0)—— 跑成功 29 条,0 失败 0 错误` / `RESULT verdict=GREEN exit=0`
- 同轴回归六件（`test_tool_surface_gate` / `test_tool_surface_budget` / `test_chat_mode_tool_gate` /
  `test_mcp_capability_gate` / `test_mcp_export_capability_proxy` / `test_mcp_server`）
  → `291 passed in 118.99s (0:01:58)`
- `node scripts/check-mypy.mjs --worktree`
  → `Success: no issues found in 689 source files` / `✅ mypy 守门通过(0 errors, 18.1s)`
- `.venv/Scripts/python.exe -m ruff check app/services/tool_surface_budget.py tests/test_tool_surface_budget.py app/services/mcp_server.py`
  → `All checks passed!`
- `node scripts/watermark.mjs verify <三文件>` → `覆盖 3/3 … 残迹 0 … 载荷损坏 0 … 纳入口径的文件均已携带完整溯源水印。`
- 零扰动实测：未设 env、未交上下文 ⇒ `[t.name for t in MCPServer().list_tools()] == [t.name for t in _TOOLS]`（111 枚逐字同序）；
  设 `MCP_TOOL_SURFACE_BUDGET=tight` + 交 `session_mode="build"` 上下文 ⇒ 可见 28 枚。

## 未竟带解锁条件

1. **下一腿：把本轮上下文交进调用点**（本票边界禁止动 routers，故只落了载体与形参）。
   解锁条件：允许改 `apps/ai-service/app/routers/llm.py`（与 `services/conversation.py`）——
   在 `_filter_agent_tools_for_chat_mode` 之后用
   `use_round_context(RoundContext(session_mode=chat_mode, declared_intent=tuple(agent_tools)))`
   包住 `_mcp.list_tools()` 那一格即可（`declared_intent` 交进去后，查找表型消费点一条都不会少拿，已由 ③ 的意图档捞回断言钉住）。
   风险提示：`routers/llm.py` 现读非我射程，动它需先扫他席在飞。
2. **对方 `ToolSearch` 那一格的「搜缺席工具」入口**：本票只做了缺席 schema 的反查（`get_tool_schema` 必付），
   没有做"按关键词搜缺席工具名"的内置工具。解锁条件：新增一枚 `_tool_*` 必须同批登记 `_TOOLS`+`_TOOL_HANDLERS`
   （双射判据）并同步 `docs`/README 工具表；建议另票，别塞进本票。
3. **列表面枚数的回归锁**：现在没有任何尺在量「本轮进 prompt 的工具枚数/字节」，本票的 111→28 只由测试断言。
   解锁条件：主席落判据面时把 `estimate_schema_bytes` 汇成一条 token 回归门（§12e 前置 = 存量先归零，先 warn 档）。
4. 未做 `.env` / 服务清单登记：`MCP_TOOL_SURFACE_BUDGET` 是可选部署开关，未进 `app/core/config.py`
   （该文件现读被他席改动 `M`，本票不碰）。若要进受管键，需与 `check-env-drift.mjs` 同批。
5. 本席未提交、未推送、未动 `PROJECT_PLAN.md` / `AGENTS.md` / `scripts/`（按派单边界）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
