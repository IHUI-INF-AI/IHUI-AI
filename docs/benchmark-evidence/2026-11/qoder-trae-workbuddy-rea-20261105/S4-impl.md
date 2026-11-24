<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S4 落地:Trae MCP/提示/历史分维配额复现+超越(goal-b49 第 3 行能力)
HEAD(现读 git rev-parse HEAD)= e557c22648652636498e67f726fe74de1f46291f
计划动的文件:
- apps/ai-service/app/services/tool_budget_governor.py(新增四维 + 具名拒绝 + 投影)
- apps/ai-service/app/core/capability_matrix.py(台账登记四维键)
- apps/ai-service/tests/test_tool_budget_dims_b49.py(新建,每维正反对照)
禁碰:apps/ai-service/app/core/config.py、app/services/workbuddy_tasks.py、tests/test_workbuddy_tasks.py(他席在飞)、apps/cli/**、packages/**、apps/api/**、apps/web/**、apps/miniapp-taro/**、scripts/**、docs/benchmark-evidence/**、PROJECT_PLAN.md、AGENTS.md

## 1. 现场读数(动手前 / 收尾时各现读一次)
- 开工 HEAD:`e557c22648652636498e67f726fe74de1f46291f`(与主席派单一致)。
- **收尾时 HEAD 已被推进**:`15f1acea0ce2b24aff3debc90a7ea30eb46318f7`(现读 `git log e557c22..HEAD` 只有 1 枚 = S2 席产物落地)。
  现读 `git log e557c22..HEAD -- <本席两枚被改文件>` = **空** ⇒ 那枚提交未碰 `tool_budget_governor.py` / `capability_matrix.py`;
  本席 diff 对 HEAD 为 403 insertions / 6 deletions,6  deletions 全部是本席有意替换的行 ⇒ **无"整 blob 回写成旧版"风险**(守门 298 同型)。
- 三枚目标文件动手前 `git status --porcelain -- <路径>`:**均为净**(tool_budget_governor.py 与 capability_matrix.py 无输出;测试文件不存在 ⇒ 新建合法)。
- 收尾时本席产出:`M capability_matrix.py` / `M tool_budget_governor.py` / `?? tests/test_tool_budget_dims_b49.py`(git status 现读,仅此三枚,禁碰清单内文件本席未写一个字节)。
- 他席现场(未碰,仅登记):`M apps/ai-service/app/core/config.py`、`M app/services/workbuddy_tasks.py`、`M tests/test_workbuddy_tasks.py`、`?? app/services/workbuddy_behaviors.py`。
- 台账条目数:HEAD 现读 92 条 `"key":` ⇒ 工作树现读 96 条(净增 4,与四维同数)。
- 行数现读:tool_budget_governor.py 667(改前 314)、capability_matrix.py 1103(改前 1061)、新测试 324。
- **两条票面事实被现读证伪**(按 §0.1/§12f 就地纠,不按错口径写代码):
  1. "该仓无 `from __future__ import annotations`" ⇒ 实测 1358/1605 个 .py 都有,本票两枚目标文件本身就带。故新注解按仓内既有形态写(`X | None`),**未**用字符串形态;mypy --strict 实测 0 errors 背书。
  2. `pnpm check:pytest -- apps/ai-service/tests/xxx.py`(仓根相对路径)⇒ 实测 rc=4 `file or directory not found`(runner 的派生 cwd 是 apps/ai-service)。可用形态 = `pnpm check:pytest -- tests/test_tool_budget_dims_b49.py`。
  3. 附带:`-p no:xdist` 在本仓不可用(pyproject addopts 含 `-n auto --dist loadfile`,禁该插件会 exit 4,注释已自证)。

## 2. 落了什么
`apps/ai-service/app/services/tool_budget_governor.py`
- 新增四维(维度名 = 配置字段名 = 台账键,三者同源,由测试 ① 钉死):
  `mcp_tool_limit` / `mcp_token_limit` / `custom_prompt_token_limit` / `history_query_limit`,默认全 **0 = 该维关闭**;`ToolBudgetConfig` 新增字段一律追加在既有四字段之后 ⇒ 位置参数构造不受影响。
- 四维**只受自身取值管辖**,与 `enabled` 无耦合;`enabled` / `max_tools_per_run` / `max_cost_per_run_usd` / `max_concurrency` 的判据、文案、`acquire/release/record_usage/get_state` 行为**一字未动**(`_limits_active()` 保持只量 run 三维;`get_state` 的 `used`/`remaining` 形状未扩 ⇒ 既有精确等值断言继续绿)。
- 具名拒绝唯一出口:`dim_exceed_reason(维度名, 实测值, 上限值)` ⇒ reason 三要素齐备并明写"未静默截断";`GateResult` 新增 `dimension` 字段(默认空串 ⇒ run 路径形状不变),`ToolBudgetExceededError.dimension` 透传。
- 公开入口:`check_mcp_tool_count` / `consume_mcp_tokens`(+`refund_mcp_tokens`,按 run 累加的令牌桶,被拒本次不入账) / `check_custom_prompt` / `check_history_query` / 通用 `check_dim` / 投影 `dim_limits`、`dim_state`。
- 失效方向:未知维度 ⇒ ValueError 点名全部合法维度(不返回 0 冒充"没配");累加维走 `check_dim` ⇒ ValueError 指向 `consume_mcp_tokens`(同维不开第二条消耗通道,§0.6);负数上限 / 负数实测 / 空 run_id ⇒ ValueError,不夹逼。
- token 量法 `estimate_tokens`:CJK 1 token/字、其余 4 字符≈1 token 向上取整,零第三方依赖;docstring 如实标注**是估算**,并写明换 tokenizer 只替这一处。
- `ToolBudgetConfig.from_env(environ=None)`:唯一 env 读取点,读四枚大写键 `TOOL_BUDGET_*_ENV`(非法值 ⇒ 该维关闭 + warning,绝不猜上限);`enabled` 恒 False ⇒ env 只装分维不会顺手打开 run 循环门。模块级单例改为 `ToolBudgetGovernor(ToolBudgetConfig.from_env())` ⇒ from_env 有真实消费者,未配 env 时与旧裸构造逐零差异。
- 投影:`_limits()` 在保留 `max_tools`/`max_cost`/`max_concurrency` 三键的前提下 update 四维 ⇒ `:139`/`get_state()`(`:251` 那一格)自动带出新维度。

`apps/ai-service/app/core/capability_matrix.py`
- 台账形状先现读确认:`CAPABILITY_MATRIX: list[dict[str,str]]`,必填键 = key/env/default/category/owner_module/doc_ref/reason_if_off(test_capability_matrix REQUIRED_FIELDS 同口径)。
- 追加 4 条(开关类,default "0",owner_module `app.services.tool_budget_governor`,doc_ref 指向 `TOOL_BUDGET_*_ENV` 常量名而非行号 ⇒ 不腐烂)。J1 取证由源文件的带引号常量声明满足;本席不改 config.py ⇒ 不涉及 J4/settings 族。

`apps/ai-service/tests/test_tool_budget_dims_b49.py`(新建,21 例)
- 每维正反对照(未超放行 / 超限具名拒 + 原因含维度名·实测值·上限值)、默认不配即不拦且零计数、令牌桶按 run 且不污染、估算器量法钉值、未知维度/累加维/负数三条失效方向、run 循环维回归(`enabled=False` 时四维开也恒 `budget_disabled`;`max_tools_per_run=2` 仍按旧文案"次数超限"拒;`used`/`remaining` 形状等值)、投影新旧键共存、from_env 四形态、**四维 env 必须同时在台账在册**(超越轴的可测化)。
- 零判据复制:维度名/env 键/量法/文案常量全部 import 源模块(§22c 同纪律),测试内不写第二份。

## 3. 验证(末行现读)
- 本票新档:`[run-ai-service-tests] run 档结论:pass(exit 0)—— run 档结论:通过 —— 跑成功 21 条,0 失败 0 错误` / `RESULT verdict=GREEN exit=0`
- 与既有 run 循环维同批回归(test_tool_budget_dims_b49 + test_tool_budget_governor + test_agent_budget_governor + test_llm_budget_governor + test_guarded_tool_pipeline + test_capability_matrix):`跑成功 200 条,0 失败 0 错误` / `RESULT verdict=GREEN exit=0`
- 类型:`✅ mypy 守门通过(0 errors, 2.7s)` / `判定面=工作树磁盘(人工逃生舱,不得作为提交门禁),mypy 实检 689 个源文件`(`node scripts/check-mypy.mjs --worktree`)
- 台账对账:`node scripts/check-capability-matrix.mjs`(工作树档)⇒ **本票四维零报错**;全场只剩 1 条与本票无关的红:`[J4 settings族台账逃逸] config.Settings 默认关布尔字段 "workbuddy_tasks_behavior_driver_enabled"`(他席在飞的 config.py 引入,HEAD 现读该字段 0 命中、工作树 1 命中 ⇒ 不是已入库存量,本席禁碰 config.py,交主席)
- 水印:`node scripts/watermark.mjs inject` 已对新文件执行;`verify` 三枚 ⇒ `覆盖 3/3 个指定文件, 残迹 0, 载荷损坏 0, 仅隐写 0 … 纳入口径的文件均已携带完整溯源水印。`
- Python 侧格式/静态:`.venv/Scripts/ruff.exe check`(仓内唯一 Python 尺;prettier **无 Python parser**,实测 `No parser could be inferred for file ...py` ⇒ 票面"prettier 后重新 inject"对 .py 不成立)⇒ `All checks passed!`(5 项 autofix 后复跑,水印复验仍 3/3)
- 行尾:三枚文件字节级现读 `crlf=0`(与 `.gitattributes * text=auto eol=lf` 一致)。

## 4. 未竟(逐条带解锁条件)
1. **四个 check_* 尚无生产调用点**(MCP 注册面 / 自定义提示存储 / 历史查询出口三处)。解锁条件 = 主席确认相关文件(`app/services/mcp_server.py`、提示与历史读写所在文件)在动手当刻 `git status --porcelain` 净且无他席租约;接线时拒绝必须映射成对上层可见的具名错误(禁止在接线处改成截断到上限)。
2. **令牌桶的消耗计量口径未接真实用量**:现按调用方传入的 token 数记账。解锁条件 = 第 1 条落点后由调用方把 MCP 工具 schema 的真实 token 交出来(需要一份 tool schema 计量出口,属另一票射程)。
3. **token 量法是估算**:解锁条件 = 引入真 tokenizer ⇒ 新 pip 依赖,票面禁;需机主批准后方可换,换时只替 `estimate_tokens` 一处。
4. **台账那格与本席无关的 J4 红**:解锁条件 = 他席把 `workbuddy_tasks_behavior_driver_enabled` 登记进台账(带 `settings_field`)或摘除其在飞改动;本席无权改 config.py。
5. **落档归主席**:本席禁 commit/push,故未做;解锁条件 = 主席按 §12h 走 `safe-commit.mjs` 或 `object-space-land.mjs`,落地后复跑受影响门(mypy 全量档按 HEAD/索引面、`check-capability-matrix --staged`、门 89 接线面)。本票未动 `scripts/**` ⇒ 无 `immutable-exempt` trailer 需求。
6. **对方 aiFeatures 另两维未落**(`chatMessageQueryLimit=400`、`serverHistoryCacheLimit=400`):票面射程只给四维,这两枚属同族但需另派。解锁条件 = 主席确认是否并入同一台账族(并入即同 `tool_budget_governor.py` 追加,零新文件)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
