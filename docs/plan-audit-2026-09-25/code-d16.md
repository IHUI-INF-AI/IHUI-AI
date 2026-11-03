<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D16 编码批次报告 — 成本感知智能路由接线(model_router → llm_gateway)

工作树:`G:\IHUI-AI`  起算 HEAD:`11ded4071a76b1a7b1940ffde154a77aa7908200`
(任务书里写的是 `199a00a9d53`,我开工时实测本机 HEAD 已前进;**所有判据按当次 HEAD 复跑**,
`git grep -n -I -E "route_live\(|from_catalog\(" HEAD -- apps/ai-service/app` 在我这台机上仍然
只命中 `model_router.py` 自身,缺口成立。)

## 单写者检查(开工前)

```
git -c safe.directory=* status --porcelain -- \
  apps/ai-service/app/core/llm_gateway.py \
  apps/ai-service/tests/test_llm_gateway.py \
  apps/ai-service/tests/test_llm_gateway_agent_messages.py \
  apps/ai-service/tests/test_model_router_wiring.py \
  apps/ai-service/app/services/model_router.py
→ 空输出(4 个既有目标文件 == HEAD;新文件不存在)⇒ 可写
```

禁改清单里的 `app/routers/llm.py`、`app/core/sse_contract.py` 实测确为 ` M`(他人正在改),
**我一行未碰**;`app/services/sandbox/**` 为 `??`(他人未入库的新包),同样未碰。

## 改了什么

| 文件 | 改动 |
| --- | --- |
| `apps/ai-service/app/core/llm_gateway.py` | +141/-8:新增 3 个模块级入口 + 把它们接进 `_resolve_auto_model` |
| `apps/ai-service/tests/test_model_router_wiring.py` | 新建(94 行,10 个用例),已注入溯源水印 |
| `apps/ai-service/.env.example` | +9:登记两个新环境变量(模板,不含凭据) |

`model_router.py` 判据本体**一行未改**(按任务书只读)。

### 接入点与行为

生产模型选择路径是 `_resolve_auto_model()`(`complete()` 与 `astream()` 在
`model` 为空或 `'auto'` 时都调它,FIM 路由也最终落到它)。接线加在它**收口出候选池之后、
取 `candidates[0]` 之前**:

```
app/core/llm_gateway.py
  _model_router_wiring_enabled()      # 开关(env)
  _auto_route_budget_usd_from_env()   # 预算(env)
  _apply_cost_aware_routing(...)      # 唯一新增决策入口
  _resolve_auto_model(has_tools, messages, budget_usd=None)   # 签名新增可选第 3 参
```

`_apply_cost_aware_routing` 的契约(不可放宽的三条):

1. **只重排、不扩池**:路由器只能用网关已经过可用性/LOCAL/运维预设/`_AUTO_ROUTE_EXCLUDED`
   过滤过的那批模型。为此我把 `_resolve_auto_model` 读目录时保留的 `{"id": ...}` 改成保留
   **完整目录条目**(`context_length` / `input_price` / `caps`),按候选顺序喂给
   `ModelRouter.from_catalog(models=pool)`;决策返回的 `selected_model` 若不在候选池内
   (`from_catalog` 兜底会带回 `DEFAULT_MODELS` 的 gpt-4o 等本部署明确不可用模型)⇒
   记 info 并**原样返回既有顺序**。
2. **实时入口按语义二选一**:`budget_usd is None` 走 `route_live()`;给了预算走
   `route(budget_usd=...)`(`route_live` 签名不收预算参数,而 `route` 收 —— 见下面"剩余")。
3. **复杂度升级链不被绕过**:COMPLEX/EXPERT 时候选已被收成单点 premium,`len<2` 直接跳过重排。

`has_code` 用 `"```" in prompt_text` 推断(唯一新增的启发式,不引入第二个真相源);
`token_count = len(prompt)//4`、`prompt` 截 20000 字 —— 与既有 `assess_complexity` 调用同口径。

### 可观测性

命中路由决策时打结构化日志,**不含任何凭据**(`decision.reason` 只有模型名/价格/档位):

- 正常:`logger.info("[auto-route] 成本感知路由 %r -> %r (complexity=%s, est_cost=$%.6f, budget=%s, reason=%s)")`
- 预算全超:`logger.warning("[auto-route] 预算 $%g 已超且无更省可选,落到最便宜档 %r (est_cost=$%.6f)")`
- 决策越池:`logger.info("... 不在可用候选池内,维持既有顺序")`
- 路由器抛错:`logger.warning("... 成本感知路由失败,维持既有顺序(降级): %s")`

### 开关名与默认值理由(默认启用)

仓内既有 env 风格是 `os.environ.get("LLM_*_ENABLED", "false") in ("on","1","true","yes")`
(见 `_llm_responses_headers_enabled_from_env` / `_llm_provider_config_enabled_from_env`),
沿用该形态命名两个变量(已登记进 `.env.example`):

- `LLM_MODEL_ROUTER_WIRING_ENABLED`(**默认 true**)
- `LLM_AUTO_ROUTE_BUDGET_USD`(默认留空 = 不施预算,行为与接线前逐字一致)

判据是"现网默认目录/凭据状态下启用会不会造成可观察的行为回退",我用一次性探针脚本实测
(`.ihui-agent/tmp/plan-audit/d16-probe.py`,已删,零副作用):

```
litellm_model='stepfun/step-router-v1' baseline_chosen='stepfun/step-router-v1'
catalog=118 available_after_gateway_filters=40
router registered models = 23
  route(prompt='hello', tokens=5)          -> stepfun/step-router-v1  (trivial)
  route(prompt='查询一下价格', tokens=200) -> stepfun/step-router-v1  (simple)
  route(prompt='实现一个登录页面并修改代码', tokens=5000) -> stepfun/step-router-v1 (moderate)
```

三档复杂度下路由器首选与接线前 `candidates[0]` **逐字相同** ⇒ 默认启用不构成回退,故取
**默认 true**;并且结构上它不可能选到池外模型(第 1 条契约),所以最坏情况是"换到同一池内
另一个可用模型",不是"选到调不通的模型"。回退动作:`LLM_MODEL_ROUTER_WIRING_ENABLED=false`
(改 `.env` 后重启 ai-service,或 nssm 环境块覆盖),无需改码。
该实测结论同时被 `test_real_catalog_path_consumed_and_safe` 钉成回归(用真实
`default_models.json` + 真实 `from_catalog`,断言三档预算下首选均不变、且决策始终在池内)。

### 回落路径(一次路由失败绝不变成一次请求失败)

`_apply_cost_aware_routing` 整体包 `try/except Exception`,五态全部**原样返回入参候选池**:
开关关闭 / 候选不足 2 / 目录条目取不到(pool < 2)/ 决策越池 / 任何异常。
外层 `_resolve_auto_model` 既有的 `except → settings.litellm_model` 兜底与
`available` 为空即返回 `fallback` 的分支均未改动,`test_auto_route_still_falls_back_when_nothing_available`
覆盖后者。

## 关键发现(不是推测,是量出来的)

**预算降级在今天的目录数据上是惰性的。** `ModelRouter._to_capability` 对目录模型一律写
`reasoning_power=5 / speed_tps=60 / output_price=0`,而 `route()` 的排序键是
`(本地优先, -speed, input_price)` —— 派生能力同质 ⇒ 排序退化为稳定保序 ⇒ 首位天然就是
"最付得起的那一档",预算无从改变选择。探针三档预算(`None / 1e-3 / 1e-7`)都选到同一模型,
复现了这一点。所以:

- 我没有为了"让测试好看"去改 `model_router.py`(任务书禁止放宽判据本体);
- 证明"网关确实会把预算降级结果落到 chosen 上"这条接线契约,改用**库内既有**的
  `DEFAULT_MODELS` 异构矩阵(haiku 快而贵 / mini 慢而便宜,按传入候选池裁剪)喂路由器:
  无预算 → `claude-3.5-haiku`,预算 1.5e-4 → `gpt-4o-mini`,预算 1e-5(全超)→ `gpt-4o-mini`。
  测试体内写明为何替换、以及"目录补上速度/真实价格后本惰性即消失"。
- 让预算真正在生产起作用的前置条件是**目录补数据**(`default_models.json` 的
  `input_price`/速度)或 `_to_capability` 不再把所有模型压成同一档 —— 后者属
  `model_router.py` 判据本体,不在本票允许清单内。

## 验证(命令 + 末行原文)

```
$ cd apps/ai-service && .venv/Scripts/python -m pytest tests/test_llm_gateway.py \
    tests/test_llm_gateway_agent_messages.py tests/test_model_router_wiring.py -q
138 passed in 41.70s

$ cd apps/ai-service && .venv/Scripts/python -m mypy app/core/llm_gateway.py --ignore-missing-imports
Success: no issues found in 1 source file

$ cd apps/ai-service && .venv/Scripts/python -m mypy app/core/llm_gateway.py --ignore-missing-imports --strict
Success: no issues found in 1 source file

$ cd apps/ai-service && .venv/Scripts/python -m mypy tests/test_model_router_wiring.py --ignore-missing-imports
Success: no issues found in 1 source file

$ cd apps/ai-service && .venv/Scripts/ruff.exe check app/core/llm_gateway.py tests/test_model_router_wiring.py
All checks passed!

$ node scripts/watermark.mjs verify apps/ai-service/tests/test_model_router_wiring.py
[watermark:verify] 覆盖 1/1 个指定文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 跳过 0 个
纳入口径的文件均已携带完整溯源水印
```

新文件单独跑:`10 passed in 12.00s`(`tests/test_model_router_wiring.py -q`)。

### 我的文件 0 错 / 他人既有红的区分依据

守门 35 全量 `mypy app` 在本机现读:

```
$ cd apps/ai-service && .venv/Scripts/python -m mypy app --ignore-missing-imports
app\services\tool_input_scanner.py:32: error: Module "app.services.sandbox" has no attribute "_DANGEROUS_PATTERNS"
app\services\mcp_server.py:1954: error: Module "app.services.sandbox" has no attribute "sandbox_executor"
Found 2 errors in 2 files (checked 547 source files)
```

两条都指向 `app.services.sandbox` —— `git status --porcelain -- apps/ai-service/app/services/`
实测该包是 `?? apps/ai-service/app/services/sandbox/`(**未入库的他人新包**,mypy 会顺着
import 进去),与 `app/core/llm_gateway.py` 无因果;我这台机 HEAD 上单跑
`mypy app/core/llm_gateway.py` 为 `Success`。主代理提交时若这道门红,属 §12
"他人代码致 hook 失败"一类。

### 测试隔离自查(§5 铁律)

- 全部外部依赖走 monkeypatch:`model_availability.is_model_available`、`settings.litellm_model`、
  `settings.llm_providers`、`ModelRouter.from_catalog`;`tests/conftest.py` 的 autouse 已把
  `_resolve_from_db` / `_get_pool` / `model_sync.get_shared_pool` 换成 no-op,Redis 指向
  `redis://127.0.0.1:1/0`。
- 本机实测 `8810/8811` 无监听(开发机),用例仍然零网络:全程未出现连接报错,单文件 12.00s。
- 请求级用例刻意走 **stub 模式**(无凭据),断言接线发生在 stub 判定之前,不派真实 LLM 调用。

## 收尾自检

```
$ git status --porcelain -- apps/ai-service/
 M apps/ai-service/.env.example              ← 本票
 M apps/ai-service/app/core/llm_gateway.py   ← 本票
 M apps/ai-service/app/core/sse_contract.py  ← 他人(未碰)
 M apps/ai-service/app/routers/llm.py        ← 他人(未碰)
?? apps/ai-service/app/services/completion_verification.py  ← 他人
?? apps/ai-service/app/services/sandbox/                    ← 他人
?? apps/ai-service/scripts/.e2e_free_tts.mp3                ← 他人
?? apps/ai-service/tests/test_model_router_wiring.py        ← 本票(新建)
?? apps/ai-service/tests/test_sandbox_board.py              ← 他人
?? apps/ai-service/tests/test_sandbox_image_cache.py        ← 他人
?? apps/ai-service/tests/test_sandbox_queue.py              ← 他人
?? apps/ai-service/tests/test_tool_result_duration_ms.py    ← 他人
```

无清单外路径被本票改动;探针临时脚本已删除。

## 已完成 / 剩余 / 卡点

已完成:`route_live()`+`from_catalog()`+预算降级接入真实请求链、失败五态回落、
env 开关与模板登记、接线本身的 10 个用例(含请求级)、mypy(strict)+ruff+水印。

剩余(明确未做,不在允许清单内):

1. **预算来源仍是运维 env,不是请求上下文。** 网关里没有"本轮可用美元"这个量
   (`grep -n budget app/core/llm_gateway.py` 除我新增外只有 fallback 的 token 上限),
   要按用户/租户余额施预算,得改 `app/routers/llm.py` 与计费侧 —— 前者在禁改清单。
   接线口已留好:`_resolve_auto_model(..., budget_usd=<美元>)` 现成可传。
2. **`route_live()` 不收 `budget_usd`**(本体签名)。我按"无预算走 route_live、有预算走
   route"接线而非改本体;若希望 `route_live` 也透传预算,需在 `model_router.py` 加一个参数,
   属判据本体改动,留给人拍板。
3. **目录缺速度/真实价格数据 ⇒ 预算维度惰性**(见"关键发现")。补数据或调整
   `_to_capability` 后,`test_real_catalog_path_consumed_and_safe` 的"首选不变"断言会红 ——
   那是功能开始生效的信号,届时应把它改成期望重排,而不是关掉开关。
4. 观测出口目前只有日志;若要给前端展示"本次走了哪个模型/为什么",可复用既有的
   `_emit_model_reroute` 事件(已会因改道触发),但不新增 SSE 契约字段(该文件他人正在改)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
