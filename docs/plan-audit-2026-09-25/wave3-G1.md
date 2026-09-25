<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 裁决 — D6 / D14 / D16 / D18 / D19

取证基准:一律 `git -c safe.directory=* show HEAD:PROJECT_PLAN.md`(HEAD = `bb4d2b670b1`,8423 行)。
本路只读,未做任何 git 写操作,未改仓库文件。行号均为 **HEAD 版行号**。

主代理给的 D19 提交 sha `c1a6f4d4593` 已自行复验:
`git show -s --format='%H %ad %s' c1a6f4d4593` → `c1a6f4d459308780d5701523f5ca80e971123094 Fri Sep 25 10:09:06 2026 +0800 feat(cli,extension): D19 终端实时输出增量(terminal_delta)接进两端渲染面 …`;
`git merge-base --is-ancestor c1a6f4d4593 HEAD` → **IS ancestor**(已入库,可引用)。

尺子先自证(避免"零命中"是搜索坏了):`git grep -c "PROJECT_PLAN" HEAD -- PROJECT_PLAN.md` → `HEAD:PROJECT_PLAN.md:137`。

---

## 票 D6

- 台账位置(HEAD 行号):**L2402 `- [ ]`** —— 这是 D6 唯一一条以 D6 为主语的登记行。
  **没有 `- [x]` 孪生行**:HEAD 上 D6 作为独立 token 只出现在 7 行(L2035 / L2402 / L2487 / L2535 / L2783 / L2784 / L7737),
  其中 4 条 `- [x]` 行(L2487 是 D40、L2535 是 D52、L2783+L2784 是 D80)只是**交叉引用里提到 D6**,不是 D6 的完工登记。
  ⇒ **D6 属 L7737 那句"30 张双态票"的假阳性成员**(计数法把"正文提到该编号"当成了"该编号有已勾登记行")。
- 复跑命令与实测:
  - `git grep -nE "(^|[^A-Za-z0-9])D6([^0-9A-Za-z]|$)" HEAD -- PROJECT_PLAN.md` → 命中 7 行(逐条见上),`- [ ]` 行数 = 1。
  - 已落的一面(逐条独立复跑,未采信 L7737/report-1):
    - 四面板真渲染:`git grep -n -I -E "KanbanBoard|AgentSwarmMonitor|OrchestrationHubPanel|TaskKanban" HEAD -- apps/web/app apps/web/src/components/ai` → `agent-kanban/page.tsx:7,10`、`agents/[id]/PageClient.tsx:24,351`、`media-tasks/page.tsx:42,446`、`ai-side-panel-tools.tsx:44,45,58,610,619,706`。
    - `git cat-file -e HEAD:apps/ai-service/app/services/agent_loop_v2.py` → EXISTS。
    - **收敛"第 1 步"确已入库**:`git -c safe.directory=* show HEAD:apps/ai-service/app/routers/agents.py` → `:1153` 注释「D6 第 1 步(2026-09-19 立):后端栈归一——langgraph fallback 与 v1 兜底已删除」、`:1161-1166` else 分支回 `errorCode": "EXECUTOR_DISABLED"`;`agents.py:392-411` `_is_loop_v2_enabled()` **env 未设时 return True**(⇒ 运行时默认档已是 AgentLoopV2)。
  - 未收敛的一面:
    - 八套数据面并列,逐个 `git cat-file -e HEAD:<f>` 全部 IN-HEAD:`apps/api/src/routes/agents-kanban.ts`、`apps/api/src/routes/orchestration.ts`、`apps/api/src/services/orchestration-service.ts`、`apps/api/src/services/crew-orchestrator.ts`、`apps/ai-service/app/routers/orchestration.py`、`apps/ai-service/app/routers/team_orchestration.py`、`apps/ai-service/app/services/agent_orchestrator.py`、`apps/ai-service/app/services/orchestration_hub.py`。
    - 这些文件里无人 import v2:`git grep -n "agent_loop_v2" HEAD -- apps/api` → **零命中**(v2 的调用点全在 ai-service 的 `agents.py`/`agent_plan.py`)。
    - 路由仍各自独立注册:`git grep -nE "register\((agentsKanban|orchestration)Routes" HEAD -- apps/api/src/routes/index.ts` → `:616` 与 `:1115` 两条 prefix `/api` 注册。
    - 票面点名的"方案评审"产物:`git grep -lniE "agents-kanban" HEAD -- docs .ihui-agent` → 只命中 `docs/plan-audit-2026-09-25/report-1.md`(那是 53 张票的审计,不是 D6 的收敛方案)。
    - 行尾指针悬空:`grep -nE "(^|[^A-Za-z0-9])D25([^0-9A-Za-z]|$)" <HEAD plan>` → 仅 4 处,全是提及,**无 `- [ ] D25` / `- [x] D25` 条目**(L2428 自己已把 D25 记为"活文档事故面")。
    - **新发现(上一轮审计没量到的一型)**:`git grep -n "AGENT_EXECUTOR" HEAD -- apps/ai-service/.env.example` → `:324: AGENT_EXECUTOR=langgraph`,而 HEAD 代码里 `"langgraph"` ⇒ `_is_loop_v2_enabled()` False ⇒ 走 `:1161` 的 `EXECUTOR_DISABLED` 错误分支。即**照仓库自带模板配置 ai-service,agent 任务会全量报错帧**。配套两处同样滞后:`docs/AI_SERVICE.md:660` 仍把 `langgraph` 写成默认档;`agents.py:399-401` docstring 仍承诺「"langgraph" → 走 LangGraph 工作流,异常时降级 v1 run_stream 兜底」,而该兜底已在同文件 `:1153` 删除 ⇒ **同一文件内注释与实现互相矛盾**。
- 判决:**L2402 = 保留未勾**;依据:上面"未收敛的一面"三条实测 —— 八套数据面在 HEAD 并列且无一指向 `agent_loop_v2`(`git grep -n "agent_loop_v2" HEAD -- apps/api` 零命中),票面点名的"方案评审"产物在 HEAD 不存在。第 1 步只归一了 ai-service 的执行器,不覆盖票面主语的"四套→单一事实源"。
- 建议改写文本(**追加在 L2402 行尾**,勾选态不动、原编号与原文字保留):
  `**[O60r 判:保留未勾 2026-09-25]** 还差三件(实测 HEAD 取径):①票面点名的"方案评审"产物不在 HEAD(`git grep -lniE "agents-kanban" HEAD -- docs` 仅命中 plan-audit 审计报告);②四套数据面仍并列(`apps/api/src/routes/agents-kanban.ts`+`orchestration.ts`+`services/orchestration-service.ts`+`crew-orchestrator.ts` 与 ai-service 侧 `routers/orchestration.py`+`team_orchestration.py`+`services/agent_orchestrator.py`+`orchestration_hub.py` 八文件逐个 `git cat-file -e HEAD:` 全在,`git grep -n "agent_loop_v2" HEAD -- apps/api` 零命中);③第 1 步(`routers/agents.py:1153` 已删 langgraph/v1 兜底、`:1161` 未启用即回 `EXECUTOR_DISABLED`)的三处配套没跟上 —— `.env.example:324` 仍写 `AGENT_EXECUTOR=langgraph`(照模板配置 ⇒ agent 任务全量错误帧)、`docs/AI_SERVICE.md:660` 仍把 langgraph 当默认档、`agents.py:399-401` docstring 仍承诺已被删除的 v1 兜底。**另:行尾"另立 D25"是悬空指针,HEAD 无 D25 条目(L2428 已自证),不得按它派单。**`
- 给主代理的额外一条:**D6 不在"双态"集合里**,L7737 的"30 张"计数法有假阳性(把交叉引用提及算成已勾登记)。裁决 D6 时不要去找/删孪生行。③那处 `AGENT_EXECUTOR` 配置陷阱是可机检的独立缺陷,建议单开一票修(它不是文档噪音:命中即整端 agent 不可用)。

---

## 票 D14

- 台账位置(HEAD 行号):L2412 `- [ ]`(票面主语行);孪生已勾行 = **L2432** `- [x] ✅(2026-09-24) **D14 云端沙箱:…纯逻辑层已验证但按③口径不装成已完成**`(其正文自述「**未合入 main**」)。
  其余命中(L528 D30 提及、L2426 审计正文提及、L7737 计数行、L7856 归属登记)都不是 D14 的完工登记。
- 复跑命令与实测:
  - `git ls-tree -r HEAD --name-only | grep -i "app/services/sandbox"` → 只有 `apps/ai-service/app/services/sandbox.py` 一条 ⇒ **`sandbox/` 包目录未入库**(`git status --porcelain -- apps/ai-service/app/services/sandbox` → `?? apps/ai-service/app/services/sandbox/`,磁盘上有 `board.py image_cache.py models.py queue.py`,属他人未跟踪在飞物)。
  - 三件缺项的符号级否定:`git grep -l "image_cache\|ensure_image\|SandboxQueue\|cross_project_board" HEAD -- apps packages scripts` → **零命中**;`ImageCache` 仅 1 处命中且落在 `apps/web/public/pdfjs/pdf.worker.min.mjs`(第三方产物,与沙箱无关)。
  - 容器隔离这一维**已实现且被消费**:`apps/ai-service/app/services/container_runtime.py` 467 行;`git grep -ln container_runtime HEAD -- apps/ai-service/app` → `routers/agent_runtime.py` + 自身;该路由真调 5 处(`:29` import、`:471` `start_run`、`:488` `list_runs`、`:497` `snapshot`、`:509` `events_queue`、`:534` `cancel`)⇒ 票面四点里"容器隔离"闭环,其余三点未开工。
  - 现场无丢失:`git tag -l 'backup/wip-d14*'` → `backup/wip-d14-2026-09-24` 在位(L2432 承诺的 WIP 归档成立)。
  - **纠一条把机器态记成欠账的登记**:L7854-7857 说「门 35 mypy 仍红,根因是未跟踪的 `sandbox/` 半成品包尚未导出被 `tool_input_scanner.py:32` / `mcp_server.py:1954` 引用的 `_DANGEROUS_PATTERNS`、`sandbox_executor`」。实测 HEAD 侧:`sandbox.py` 就导出这两个符号(`git -c safe.directory=* show HEAD:apps/ai-service/app/services/sandbox.py` → `:116 _DANGEROUS_PATTERNS = [`、`:169 class SandboxExecutor`、`:804 sandbox_executor = SandboxExecutor()`),而 `tool_input_scanner.py:32` 的 `from .sandbox import _DANGEROUS_PATTERNS` 在**干净检出**下解析正常。红只发生在**本机磁盘**(包目录 shadow 同名模块文件)⇒ 属机器态,不是 D14 的 HEAD 欠项,也不构成"已有人实现了 queue/board"的证据。
- 判决:**L2412 = 保留未勾**;依据:`git grep -l "image_cache|ensure_image|SandboxQueue|cross_project_board" HEAD -- apps packages scripts` 零命中 + `sandbox/` 包在 HEAD 不存在 ⇒ 票面四件事里三件(镜像缓存 / 任务队列 / 跨项目并行看板)结构上不可能已完工,孪生行 L2432 本人也写明"不装成已完成"。
- 建议改写文本(**追加在 L2412 行尾**,勾选态不动):
  `**[O60r 判:保留未勾 2026-09-25]** 还差三件(实测:git grep -l "image_cache|ensure_image|SandboxQueue|cross_project_board" HEAD -- apps packages scripts → 零命中;git status --porcelain -- apps/ai-service/app/services/sandbox → "??" 该包在 HEAD 不存在)。已闭环的只有容器隔离一维:container_runtime.py 467 行且被 routers/agent_runtime.py:29 真调(start_run/list_runs/snapshot/events_queue/cancel 五处)。WIP 现场在 tag backup/wip-d14-2026-09-24。**注意 L7854 把门 35 的红记成该包欠项,实测是机器态 shadow(HEAD 的 sandbox.py:116/169/804 就导出那两个符号),别据此派单。**`

---

## 票 D16

- 台账位置(HEAD 行号):未勾 3 行 —— L2415(裸票面)/ L2416(带"对账进度",自称"'预算降级'链路未重证,保持未勾")/ L7715(自称"本行是裸副本…2026-09-25 补测:零非测试调用点")。
  已勾 3 行 —— L2417(✅ 指针行)/ **L2418(✅ 现行判定,三点口径 + 预算降级取证)**/ L7836(✅ 网关接线入库 `1da740ab494`)。
- 复跑命令与实测:
  - `git cat-file -e HEAD:apps/ai-service/app/services/model_router.py` → EXISTS;`git cat-file -e HEAD:apps/ai-service/tests/test_model_router_wiring.py` → EXISTS;`test_model_router.py` 的 budget 用例实测在位(`:327 test_budget_none_equals_legacy_call`、`:335 test_big_budget_keeps_ranking`、`:346 test_budget_boundary_inclusive`、`:363`)。
  - **消费点证明(推翻 L7715 的核心断言)**:`git grep -nE "router\.(route_live|route)\(|ModelRouter\.from_catalog" HEAD -- apps/ai-service/app` → 非测试调用点三条:`app/core/llm_gateway.py:1024`(`ModelRouter.from_catalog(models=pool)`)、`:1032`(`router.route_live(**kwargs)`)、`:1034`(`router.route(**kwargs, budget_usd=budget_usd)`)。生产链入口 `_apply_cost_aware_routing()` 定义在 `llm_gateway.py:996`,**被 `:1207` 在 `_resolve_auto_model` 的候选池收口处真调用**;另有 `:1161-1163` 调 `model_router.assess_complexity`。
  - 开关默认档:`llm_gateway.py:975` `os.environ.get("LLM_MODEL_ROUTER_WIRING_ENABLED", "true")` ⇒ **默认开**;两枚旋钮已登记进 `apps/ai-service/.env.example:162-163`(`LLM_MODEL_ROUTER_WIRING_ENABLED=true` / `LLM_AUTO_ROUTE_BUDGET_USD=`)。
  - 指针失效:L7715 写"现行对账见紧邻下一条",而 HEAD 的下一条是 **L7716 = D38**(union 归并后行序变了,"紧邻下一条"式指针已断)。同型缺陷也在 L7714(D15 裸副本指向 L7715)。
- 判决:
  - **L2415 = 裸副本**;依据:与 L2416/L2418 逐字同题、只缺状态与前缀,且票已在 L2418 + L7836 判定完工。
  - **L2416 = 旧文取代**;依据:该行自称的欠项("预算降级链路未重证")已被 L2418 的取证与 L7836 的入库闭合,HEAD 实测 `llm_gateway.py:1034` 就是 `route(budget_usd=...)` 的生产调用点。
  - **L7715 = 旧文取代**;依据:该行的判据("route()/route_live()/from_catalog() 在 `apps/ai-service/app` 内零非测试调用点")被 HEAD 直接推翻 —— `llm_gateway.py:1024/1032/1034` 三处非测试调用点在库,`:1207` 为生产入口。
- 建议改写文本(整行成品,保留原编号与原文字):
  - L2415 →
    `- [ ] D16 多模型智能路由(任务类型分类器+成本感知选模+预算降级)(G-21) **[O60r 判:裸副本]** 本行正题逐字存活于 L2418 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L2416 →
    `- [ ] D16 多模型智能路由(任务类型分类器+成本感知选模+预算降级)(G-21) **对账进度(2026-09-24,HEAD 取证)**:ai-service model_router.py(TaskComplexity/assess_complexity/_estimate_cost)+ tests/test_model_router.py 已在 HEAD;"预算降级"链路未重证,保持未勾。 **[O60r 判:旧文取代]** 本行结论已被就地改写取代:现行登记见 L2418(已勾)与 L7836(网关接线入库 1da740ab494);"预算降级未重证"作废 —— 实测 HEAD `app/core/llm_gateway.py:1034` 即 `router.route(budget_usd=)` 生产调用点、入口 `:996`/调用 `:1207`、开关 `:975` 默认 true。不重复计账、勿照本行派单。`
  - L7715 →
    `- [ ] D16 多模型智能路由(任务类型分类器+成本感知选模+预算降级)(G-21) **本行是裸副本**;2026-09-25 补测那句"`route()/route_live()/from_catalog()` 在 `apps/ai-service/app` 内零非测试调用点"**已被 HEAD 推翻**(`app/core/llm_gateway.py:1024 from_catalog / :1032 route_live / :1034 route(budget_usd=)`,生产入口 `:1207`)⇒ 属已完工而非部分开工。 **[O60r 判:旧文取代]** 原写"见紧邻下一条"是断指针(HEAD 下一条 L7716 是 D38);现行判定见 L2418 与 L7836(均已勾),不重复计账、勿照本行派单。`
- 需主代理定一处口径(我没有擅自替它翻勾或改判):预算降级**代码路径 + 测试在库**,但**运维开关默认不施预算**(`LLM_AUTO_ROUTE_BUDGET_USD=` 空 ⇒ `budget_usd=None`)。按"实现且被消费"的判据我判它闭环(L2418 也这么记);若主代理把票面"预算降级"读成"必须默认对用户生效",则 L2418 那行本身应回退成保留未勾 + 注明开关默认关。

---

## 票 D18

- 台账位置(HEAD 行号):未勾 2 行 —— L2436(裸票面)/ L2437(同题 + "**发布就绪性已上机器闸门(2026-09-24,本票)**…")。已勾 1 行 —— L2434(✅ NuGet 发布出口)。
- 复跑命令与实测:
  - 门已装车:`git cat-file -e HEAD:packages/sdk/tests/publish-ready.test.mjs` → EXISTS;`git -c safe.directory=* show HEAD:package.json` → `:120 "check:sdk-publish": "node --test packages/sdk/tests/publish-ready.test.mjs"`,且 `check:all`(`:71`)链内含 `check:sdk-publish`(按 `&` 切分数组计 1)。
  - 用例数漂移:HEAD 顶层 `^test(` 计数 = **13**(票面 L2437 写 8 —— L2434 那票又加了 5 条 .NET/NuGet 用例与三条变异对照)。
  - NuGet 通道**已不是"整条待建"**:`git -c safe.directory=* show HEAD:.github/workflows/release-sdk.yml` → `:648 nuget-publish:` job、`:756 dotnet nuget push`、`:746/:764/:806` 发布后 flatcontainer 回读判据、`:254` gate 的 `need nuget` 分支 ⇒ L2437 那句"NuGet 通道整条待建"过期(现行事实就是 L2434 那条 ✅)。
  - 真欠项(可机检的那一条):`git tag -l 'sdk-v*'` → **0**(票面"打 `sdk-v0.1.0` tag 推 origin(唯一触发器)"未做,发布列车从未发车)。
  - 不可机检项(属 owner/对外动作,不能由 HEAD 判):GitHub secrets(NPM/PYPI/MAVEN/NUGET)、npm `@ihui` org 与 trusted publisher、PyPI 项目归属、Maven groupId 域名验证、homebrew sha256 回填。
- 判决:
  - **L2436 = 裸副本**;依据:与 L2437 逐字同题(L2437 的开头就是 L2436 全文再加对账段),同编号双行只有一行带正文。
  - **L2437 = 保留未勾**;依据:`git tag -l 'sdk-v*'` 实测 0 ⇒ 票面自列的"剩余全为人工或对外不可逆动作"里连**唯一由本仓控制的那枚触发 tag**都还没打,发布出口从未跑过任何一次真实通道。
- 建议改写文本:
  - L2436 →
    `- [ ] D18 Agent SDK 对外开放(G-23) **[O60r 判:裸副本]** 本行正题逐字存活于 L2437 的同编号登记(那行是该票的现行判定行;票面剩余项为对外/人工动作,故两行都未勾),不重复计账、勿照本行派单。`
  - L2437 →(**行尾追加**,勾选态不动)
    `**[O60r 判:保留未勾 2026-09-25]** 还差(实测 HEAD 取径):①票面唯一由本仓控制的触发器仍未打 —— `git tag -l 'sdk-v*'` = 0,四/五条通道从未跑过一次真实发布;②余下全为 owner 侧不可逆动作(GitHub secrets NPM/PYPI/MAVEN/NUGET、npm @ihui org 与 trusted publisher、PyPI 归属、Maven groupId 域名验证、homebrew sha256 回填),无法由仓库内容判在不在。**本行两处过期须就地更正**:"NuGet 通道整条待建"作废 —— HEAD 的 `.github/workflows/release-sdk.yml:648` 已有 `nuget-publish:` job(`:756` push、`:746` flatcontainer 回读、`:254` gate `need nuget`),即 L2434 那条 ✅;`publish-ready.test.mjs` 顶层用例数由本行写的 8 → 实测 13。门本身确认已装车:`package.json:120` `check:sdk-publish` 且在 `check:all`(`:71`)链内。`

---

## 票 D19

- 台账位置(HEAD 行号):未勾 —— **L2438 `- [ ]`**(票面主语行)+ **L7838 `- [ ]（进行中）`**("产出完整但按住");非 checkbox 的子项 **L2439**(HEAD 级复核段)。已勾 —— L7244(派发前置 + 两半落地)、L7972(复测后仍按住)、**L8358(解锁入库 `c1a6f4d4593`)**。
- 复跑命令与实测:
  - 消费点(按端逐个数 `onTerminalDelta` 命中文件):`git grep -c "onTerminalDelta" HEAD -- <dir>` → web 2 / **extension 2** / **cli 3** / **mobile-rn 1** / **miniapp-taro 0** / desktop 0 / `packages/api-client` 2 / `packages/shared` 0 / `packages/app` 0。
  - 帧名落地文件面:`git grep -ln "terminal_delta" HEAD -- apps packages scripts` → 19 个路径,含 `apps/extension/entrypoints/sidepanel/pages/ChatPage.tsx`、`apps/extension/tests/terminal-delta.test.tsx`、`apps/cli/src/commands/{agent,repl}.ts`、`apps/cli/tests/terminal-delta.test.ts` ⇒ **L7838 点名的按住物全部已入库**。
  - 台账基线现值:`git -c safe.directory=* show HEAD:scripts/data/sse-dispatch-coverage.json` → `baseline: web 27 / extension 17 / miniapp-taro 21 / mobile-rn 19 / cli 14`(与 L8366 记的 extension 16→17、cli 13→14 一致;`docs/plan-audit-2026-09-25/code-d19.md` 写的是 12→14,属该报告自身措辞漂移,不影响 HEAD 读数)。
  - 守门 90 实跑(只读):`node scripts/check-sse-dispatch-parity.mjs` → **exit 0**,末行 `✅ SSE 端内 dispatch 覆盖守门通过(5 端,帧 28 个)` ⇒ L7838 登记的"全量模式红 4 项"已收敛清零。
  - **仍欠的实项(四件事,逐条量)**:
    - miniapp-taro 增量渲染:HEAD 台账 `missing["miniapp-taro"].onTerminalDelta = "no-terminal-delta-ui"`,分组文案自述"现仅 miniapp-taro 属本组";端内 `git grep -n "terminal" HEAD -- apps/miniapp-taro/src/api/index.ts` → 只有 `case 'terminal_start'`(`:452`)与 `case 'terminal_end'`(`:455`),**无 `terminal_delta` case**;`onTerminalDelta` 在 `apps/miniapp-taro` 命中 0。
    - cli 终端整帧:`missing["cli"].onTerminalStart / onTerminalEnd = "no-terminal-stream-ui"` 仍在册(cli 只接了 delta,没接两帧的卡片宿主)。
    - hunk diff 面:`codeChanges` 按端 → web 5 文件 / cli 2 文件 / **extension 0 / mobile-rn 0 / miniapp-taro 0 / packages-app 0 / packages-shared 0**;且 `git grep -ln "unifiedDiff" HEAD` 只命中 ai-service 4 个 Python 文件(生产侧),**客户端契约里根本没有这一帧** ⇒ "全量对齐"结构性无从谈起。
    - 审批流面:`git grep -lE "onApproval|approvalRequest" HEAD -- <端>` → web 3 / ai-service 8 / **extension 0 / mobile-rn 0 / miniapp-taro 0 / cli 0**(与 L7257-7258 当年"HEAD 面移动端审批 = 0"一致,并行会话那半边至今未进 HEAD)。
  - **认领面污染(必须优先处理的一条)**:`grep -cE "^- \[ \]（进行中）" <HEAD plan>` = 36,其中提及 D19 的正是 L7838 这一条,且工作树副本同样在(本机 `PROJECT_PLAN.md` 命中 1)⇒ 票已完工入库却仍挂着"有人在途"标记,`node scripts/check-task-claims.mjs` 的派单前扫描会把它当在途项跳过/误派。
- 判决:
  - **L2438 = 保留未勾**;依据:上面"仍欠的实项"——HEAD 台账仍登记 `missing["miniapp-taro"].onTerminalDelta`,extension/mobile-rn/miniapp-taro 三端对 `codeChanges` 与 `onApproval|approvalRequest` 均 0 命中。
  - **L7838 = 旧文取代**;依据:该行整段成立的前提(两枚硬阻塞)已被 HEAD 逐条解除 —— 点名文件全部入库、`stream-tool-ledger` 不再压在 `agent.ts` 的同一份 diff 上、台账基线已随代码同票抬到 17/14,且守门 90 全量现跑现绿(exit 0)。
  - **L2439 = 旧文取代**(它是 L2438 的缩进子项、非编号登记行,改写风险最低);依据:"terminal_delta 在两移动端均 0 命中"与 HEAD 实测相反(mobile-rn 1 文件 / extension 2 / cli 3,仅 miniapp-taro 为 0)。
- 建议改写文本:
  - L7838 →
    `- [ ] **[O60r 判:旧文取代]** 本行"产出完整但按住"的两条硬阻塞均已解除,现行判定见 L8358 的同编号已勾登记(`c1a6f4d4593` 已入库,`git merge-base --is-ancestor` 复验):点名文件 `apps/extension/entrypoints/sidepanel/pages/ChatPage.tsx`、`apps/cli/src/commands/{agent,repl}.ts`、`apps/extension/tests/terminal-delta.test.tsx`、`apps/cli/tests/terminal-delta.test.ts` 与台账(`baseline.extension 17 / cli 14`)逐个 `git cat-file -e HEAD:` 全在;`node scripts/check-sse-dispatch-parity.mjs` 现跑 exit 0(原记"全量红 4 项"已清零)。**本行的 `（进行中）` 标记一并删除 —— 它会把已入库的票继续算成在途项。**票面其余欠项见 L2438,勿照本行派单。`
  - L2439 →
    `  - **D19 第 68 轮复核(HEAD 级)**〔原文保留〕**[O60r 判:旧文取代]** 本段三条计数已过期,现行实测:desktop `onTerminalDelta` 0(薄壳复用 web,by-design)、mobile-rn 1、extension 2、cli 3,**仅 miniapp-taro 0**;`codeChanges`(hunk)web 5 / cli 2 / 其余三端 0 且客户端契约无此帧;`onApproval|approvalRequest` 仅 web 3 + ai-service 8。现行判定以 O60r 报告与 L2438 行尾追加的复跑命令为准,勿照本段派单。`
  - L2438 →(**行尾追加**,勾选态不动)
    `**[O60r 判:保留未勾 2026-09-25]** 还差四件(实测 HEAD 取径):① miniapp-taro `onTerminalDelta` —— HEAD 台账 `scripts/data/sse-dispatch-coverage.json` 仍登记 `missing["miniapp-taro"].onTerminalDelta="no-terminal-delta-ui"`,端内 `src/api/index.ts` 只有 `terminal_start`(:452)/`terminal_end`(:455)两个 case;② cli 的 `onTerminalStart/onTerminalEnd` 仍挂 `no-terminal-stream-ui`(只接了 delta);③ hunk diff:`codeChanges` 在 extension/mobile-rn/miniapp-taro 三包 0 命中,`unifiedDiff` 在 HEAD 只有 ai-service 4 个 Python 生产点 ⇒ 客户端契约里没这一帧;④ 审批流:`onApproval|approvalRequest` 在 extension/mobile-rn/miniapp-taro/cli 四端 0 命中(web 3 / ai-service 8)。**已闭环部分(勿重做)**:`c1a6f4d4593` 已把 extension 与 cli 接上、mobile-rn 半边由 `cd75f590861`+`b81ba7c05d4` 落库,门 90 现跑 exit 0。**另:帧名 `terminal_delta` 至今不在 `SSE_EVENTS` 双契约里(`sse_contract.py` grep 计数 0、`packages/shared/src/sse/contract.ts` 只有 TERMINAL_START/END)⇒ 若把"登记进契约"算本票范围,这是第 5 件欠项;它也可能归 D34,请主代理定性。**`

---

## 汇总

| 票 | 未勾行 | 判决 | 一句依据 |
| --- | --- | --- | --- |
| D6 | L2402 | 保留未勾 | `git grep -n "agent_loop_v2" HEAD -- apps/api` 零命中 + 八套数据面逐个 `git cat-file -e HEAD:` 全在 ⇒ "四套→单一事实源"未发生;"方案评审"产物 HEAD 不存在 |
| D6 | (无 `- [x]` 孪生) | 假阳性成员 | D6 只被 L2487/L2535/L2783/L2784 的**交叉引用**提到 ⇒ L7737 的"30 张双态"计数法把提及当登记 |
| D14 | L2412 | 保留未勾 | `git grep -l "image_cache\|ensure_image\|SandboxQueue\|cross_project_board" HEAD` 零命中 + `sandbox/` 包在 HEAD 不存在(`?? ` 于工作树) |
| D16 | L2415 | 裸副本 | 与 L2418(已勾)逐字同题,票的三点口径均已在 HEAD 且被 `llm_gateway.py:1207` 消费 |
| D16 | L2416 | 旧文取代 | 自称的欠项"预算降级未重证"已被 L2418 + L7836 闭合(`llm_gateway.py:1034 route(budget_usd=)`) |
| D16 | L7715 | 旧文取代 | "零非测试调用点"被 HEAD 推翻:`llm_gateway.py:1024/1032/1034` 三处非测试调用点在库 |
| D18 | L2436 | 裸副本 | 与 L2437 逐字同题(后者 = 前者全文 + 对账段) |
| D18 | L2437 | 保留未勾 | `git tag -l 'sdk-v*'` = 0 ⇒ 票面唯一由本仓控制的触发器未打;另需就地更正该行"NuGet 通道待建"过期(workflow `:648` 有 job)与"8 用例"(实测 13) |
| D19 | L2438 | 保留未勾 | HEAD 台账仍登记 `missing["miniapp-taro"].onTerminalDelta`;`codeChanges`/`onApproval` 在 extension·mobile-rn·miniapp-taro 三端 0 命中 |
| D19 | L2439(子项) | 旧文取代 | 该行"两移动端 terminal_delta 均 0"与 HEAD 相反(mobile-rn 1 / extension 2 / cli 3) |
| D19 | L7838 | 旧文取代 | 两条硬阻塞均解除:点名文件全部 `git cat-file -e HEAD:` 通过、门 90 现跑 exit 0、基线已同票抬到 17/14;**其 `（进行中）` 标记必须一并删除** |

---

## 我这路没做完 / 需主代理复核

1. **没有耗尽的轮次**:约用了 25 / 40 轮,五张票全部给完判决,无遗留未判行。
2. **D6 的"评审"子面无法从仓库否定**:report-1 自己声明 `.ihui-agent/` 部分子树被 gitignore ⇒ 可能存在**未入库**的收敛方案文档。我判"保留未勾"不依赖这条否定式(靠的是八套并列 + apps/api 零引用 v2),故结论稳;但若主代理想找"评审已做"的证据,只能问人,不能从 HEAD 证。
3. **D6 顺手量到一个可机检的真实缺陷(不属本路裁决范围,建议单开一票)**:照 `apps/ai-service/.env.example:324`(`AGENT_EXECUTOR=langgraph`)配置 ai-service ⇒ `agents.py:1161-1166` 直接回 `EXECUTOR_DISABLED` 错误帧,agent 任务全量失败;同文件 `:399-401` 的 docstring 还承诺已被 `:1153` 删除的 v1 兜底,`docs/AI_SERVICE.md:660` 的默认档同样过期。这是"第 1 步只改实现、没改模板与文档"的典型形态,值得配一条门(开关取值集合 ↔ 模板值 ↔ 兜底分支存在性三方对账)。
4. **D16 的口径分歧请主代理拍**:成本感知/预算降级的**代码 + 消费点 + 测试 + env 登记**都在 HEAD,但 `LLM_AUTO_ROUTE_BUDGET_USD` 默认留空 ⇒ 默认部署下"预算降级"这条分支不被激活(只有运维设了才生效)。我按"实现且被消费"判 L2415/L2416/L7715 三行为副本/过期(不动 L2418 的 ✅);若从严要求"对用户默认可达",该改判的是 L2418,不是这三行。
5. **D19 的一条归属未定性**:`terminal_delta` 至今不在双契约(`sse_contract.py` 的 `SSE_EVENTS` / `packages/shared/src/sse/contract.ts`)里,守门 90 的帧清单是从 `packages/api-client/src/client.ts` 派生的,所以它绿而契约门看不见该帧。这件事算 D19 的第 5 件欠项还是 D34(事件契约票)的欠项,我没有依据裁定,已写进 L2438 建议文本的末句请主代理定性。
6. **"某人正在做"的判断我只给了一条,并附证据**:L7854-7857 归因的 `apps/ai-service/app/services/sandbox/`(`?? ` 未跟踪,含 board/image_cache/models/queue)是**他人未入库在飞物**,我据此判 D14 的三件缺项"不可当作已实现";这是"存在未跟踪物"的证据,不是"该会话正在推进 D14"的证据 —— 后者我**没有依据**,故未下结论,派单前请自行确认。
7. **落盘时的两个结构提醒**(避免主代理二次踩坑):
   - 改写指针句时**不要写"见紧邻下一条"** —— HEAD 上 L7714(D15)/ L7715(D16)这种指针已经因 union 归并全部错位(L7715 的下一条现在是 D38)。必须写**具体行号 + 编号**。
   - **行号会漂**:主代理落盘请按"编号 + 稳定前缀"定位,不要照抄本文行号。可用前缀:L2402 `D6 多 agent 栈收敛` / L2412 `D14 云端沙箱 agent` / L2415+L2416+L7715 `D16 多模型智能路由` / L2436+L2437 `D18 Agent SDK 对外开放` / L2438 `D19 desktop/miniapp/mobile-rn 对话流 parity` / L7838 `D19(extension + cli 的`。
   - 改写含 `D6`/`D14`/`D16`/`D18`/`D19` 编号的行会受守门 71 管辖(整行消失即拦),本路建议全部是**只追加/只替换文案、保留编号**,符合该门的"改写不算丢失"通道;但按 §12,提交 `PROJECT_PLAN.md` 前须跑 `node scripts/merge-live-doc.mjs --file PROJECT_PLAN.md`,提交后立即 `git show <新提交>^..<新提交>` 做行级对账。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
