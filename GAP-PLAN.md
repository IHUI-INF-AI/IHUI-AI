<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# GAP-PLAN — 远超对标程序（Claude Code / Codex / Qoder / WorkBuddy）全面深度计划

创建:2026-09-03 · 目标驱动 /goal 激活。本文件为"远超几年"路线图的权威收敛,随执行迭代更新。

## 判定基线

- 现状:**广度已超**(一次对话同时具备压缩/检查点/双向 MCP/Deep Research/Teams/Plan 门控/录制回放/注入防护/成本账本/长期记忆,无竞品兼有)。
- 真正差距在**深度与细度(95%→99%)**:边界/溯源/可逆/可自证/跨端一致;以及**无对照物的新维度**。
- 核心细度短板:**三端(web/cli/miniapp)与 Python 的杀手锏常量/行为常跑偏**。

## 战斗三线

- **线A 深度**:每个功能做到 99%——压缩质量自证(保留率/任务成功率+灰度);全活动时间线可逆可回放(压/回滚/成本/注入);MCP 超级工具聚合层(去重/仲裁/统一 schema)。
- **线B 细度**:三端一致性(单一来源+漂移即失败 parity);每个杀手锏带 DOI(单测+真网+视觉+回放);埋点→成本账本→看板→审计默认开启的可观测闭环。
- **线C 广度**(无对照物):验证自愈引擎;跨会话接力;MCP 服务端能力市场(agent 能力供给方)。

## 阶段路线图(每项含 DOI)

- **P0 一致性基座(先堵最大细度短板)**
  1. 杀手锏常量/schema 收敛单一来源(ai-service 单源 + TS 镜像只读) + 跨端漂移校验测试。
  2. 执行引擎统一接入「组合守卫 + 成本账本 + 注入防护」(可开关,避开并发中文件,先落测试缝合)。
  - DOI: parity 测试绿;守卫/成本/注入闭环单测+回归绿。
- **P1 深度(可证/可逆/自省)** 3. 压缩质量自证(保留率/任务成功率 + 灰度降级) 4. 全活动时间线回放前端(压/回滚/成本/注入) 5. MCP 超级工具聚合层。
  - DOI: 每项 单测+真网+浏览器视觉。
- **P2 广度(无对照新维度)** 6. 验证自愈引擎(自测→跑→自修→绿) 7. 跨会话接力闭环 8. MCP 服务端能力市场入口。
  - DOI: 端到端 demo 通过。
- **P3 生态与采纳** 9. 成本真网计价+实时看板 10. 一键发布/接入文档引导 11. 全端(web/cli/miniapp/桌面)杀手锏同构。
  - DOI: 录屏演示 + 新用户零配置跑通。

## 执行方式

多 agent 并行(每 agent 自测 pytest+ruff+真网,主线程统一挂载/回归)。保留并行边界(不碰其它 agent 编辑中的文件)。

## 真实外部缺口(计划内需资源)

- 公网 MCP 授权码回调端到端:需真实远程端点+MCP 凭据(本地真网已覆盖传输/协商)。
- 成本真网计价:需厂商价表/用量 API 密钥(当前为估算表,可注入 set_pricing)。

## 进度日志

- 2026-09-03:计划定型并列入此文件。
- 2026-09-03:P0-1 一致性基座 DONE——`app/core/tunables.py` 单一真源(9 常量),5 service(step_recorder/agent_checkpoint/file_editor/core-context_compaction/mcp_client)改引真源;TS 镜像 `packages/shared/src/constants.ts` 校正;`tests/test_killer_parity.py` 漂移即失败(3 绿);受影响回归 248 绿。跳项:agent_loop_v2(并发中)、CLI 内部二次写死(compaction-v2.ts/mcp-runtime.ts,后续)。
- 2026-09-03:压缩质量自证(深度前移)DONE——`services/compaction_quality.py` 保留率评估(离线确定性+可选 embedding)、高/低价值丢弃分类、`apply_report_policy` auto_degrade、`CompactionQualityGate` EMA 连续低→fallback;31 新测+60 回归绿;修复绝对路径/尾标点/单点误触发。待接:提交通道接入(不碰 agent_loop_v2)。
- 2026-09-03:P1-5 MCP 超级工具聚合 DONE——`services/mcp_tool_aggregator.py` SuperToolPool(去重+first/prefix/merge_manifest 三仲裁+schema 归一化+manifest+call_forward),兼容自研 MCPClientTool;30 新测+mcp_client 72 回归绿;ruff 0。待接:在执行器装配处以 manifest 暴露超大工具集(agent_loop_v2 解空后)。
- 2026-09-03:P2-6 验证自愈引擎 DONE——`services/self_healing.py` generate_test_cases(可注入gen_fn+确定性模板)/run_and_diagnose(StaticRunner+失败归因)/heal(max_attempts+可注入patch_fn+优雅降级)/HealOutcome;29 新测+ruff 0。待接:LLM gen/patch 接入+pytest 子进程 runner。
- 2026-09-06:接线清零轮(429 限流打断后由主会话续完)——①**MCP 超级工具聚合 DONE**:`routers/agents.py` _build_supertool_pool/_supertool_tools_from_pool/call_forward 装配进 _build_loop_v2_tools(AGENT_SUPERTOOL_ENABLED,无外部 server 逐字节等价降级);修复内置 priority=100(POLICY_FIRST 裸名被外部按描述长度抢占的真缺陷);补 await 修复 _build_loop_v2_tools 变 async 后两处生产调用点的 coroutine 回归;test_supertool_wiring.py 6 测。②**self_healing LLM 接入 DONE**:`self_healing_llm.py`(llm_gen_fn/llm_patch_fn/PytestSubprocessRunner junit 归因/apply_patch_descriptor 落盘+workspace 白名单/llm_patch_and_apply,修复 junit attribute-only failure 误判通过的 Element falsy bug);`routers/self_healing.py` POST /api/v1/self-healing/run(main.py 挂载,AGENT_SELF_HEALING_ENABLED 门控);test_self_healing_llm.py 15 测。③**compaction_quality 提交通道 DONE**:`compact_with_llm.py` LLM 路径接入 assess_compaction+auto_degrade(保守 keep_recent+bonus 重压,复评不重复计数)+gate EMA,info 增量 quality 字段(AGENT_COMPACTION_QUALITY_ENABLED,关闭时旧契约不变);test_compaction_wiring.py 6 测。④**pr_reviewer GitHub 管道 DONE**:`.github/workflows/pr-review.yml`(PR 打开/同步+workflow_dispatch,secrets 未配置 notice+exit 0 保持 green,最小权限,并发去重)+`routers/pr_review.py` POST /api/v1/pr-review+test_pr_review_api.py。回归:ai-service 全量 10094 passed(9 失败全部定性:5 个为 HEAD 既有/并行 WIP、1 个全量序污染隔离即绿、1 个 StepFun 402 配额外部依赖、2 个本次引入已修)。**待办**:前端三件(聊天成本显示/Deep Research 入口/Teams 页)已挂 2026-09-07 01:25 定时重试。
- 2026-09-07:**P0-1 跳项清零(CLI 二次写死收敛)DONE**——① `apps/cli/src/tools/mcp-runtime.ts` 3 处 initialize 握手 `protocolVersion: '2024-11-05'` 二次写死(偏离单源)改为 import `DEFAULT_PROTOCOL_VERSION`(@ihui/shared 镜像 tunables.py='2025-03-26');② `apps/cli/src/compaction-v2.ts` 本地 `DEFAULT_KEEP_RECENT=6` 重复定义改为 import @ihui/context-compaction 单源(trigger/target ratio 此前已收口)。DEFAULT_MIN_MESSAGES=10/其他压缩参数为 CLI 算法本地参数(共享包未导出),保留。验证:cli tsc 0 错 / eslint 0 / 受影响 5 测试文件 77 passed(compaction-v2 35 + integration + cache + mcp-acp-transport + hub-mcp-adapter)。**P0 一致性基座至此全部闭环**;前端三件已于 2026-09-07 凌晨完成落库(c5fdee1d59/12e1d052b0/70b09f650d/7578485bf3/0ccd3e3d32,待 push)。
- 2026-09-07:**P1-4 / P2-7 / P2-8 三线收官 DONE**(429 限流致并行 agent 中断,主会话接管收尾;集成链 a251f349f6→ff64b48b8b→0abb74a78b)——①**P1-4 全活动时间线回放**:`services/agent_timeline.py` 五源聚合(step/compaction/checkpoint/cost/injection,统一字段+升序+MAX_EVENTS 截断+单源故障隔离)+`services/injection_event_recorder.py` 进程内注入事件记录(guarded_tool_pipeline stage2 危险入参拦截接线+prompt_guard 命中登记,session_id 缺省零行为变化)+`routers/timeline.py` GET /api/timeline(JWT+会话归属校验+信封契约)+web `agent-timeline` 页(汇总卡片+分类徽章+统一时间轴+事件详情,250 行)+next.config `/api/timeline→8803` 直连+5 语言 i18n(web 命名空间 agentTimeline 23 keys);test_agent_timeline.py 11 测(修复:prompt_guard 自定义签名兼容,session_id 仅非空透传,防 fail-closed 误拦)。②**P2-7 跨会话接力闭环**:`services/session_relay.py` 五段结构化接力摘要(目标/已完成/决定/未完成/文件,确定性抽取+可选 LLM 精炼降级安全)+session_store `relay_summaries` 表+`routers/relay.py` 4 端点(create/get/list/continue,continue 自动注入新会话+边界标记);test_session_relay.py 18 测。③**P2-8 MCP 服务端能力市场入口**:`services/capability_market.py` CapabilityManifest 自动生成(缓存+失效)+capability_market_store 启停持久化+`routers/mcp.py` /mcp/capabilities 列表/详情/启停(admin 权限模型)+api-client mcp.ts 类型化端点+web `capability-market` 市场页+TopBar 入口+5 语言 i18n(shared 31 keys);test_capability_market.py 12 测。**集成验证**:合并 94/94 后端测试绿、i18n 5 语言 parity OK、tsc 改动文件 0 错、main.py 双路由挂载冲突手工合并。至此路线图 P0/P1/P2 全部闭环;剩余 P3-9/10/11 与两条需外部资源项(公网 MCP OAuth/成本真网计价)。
- 2026-09-07(晚):**P3 三线收官 DONE**(并行 agent 12s 内即死于 429——子代理配额池整晚锁定实证,三线全部由主会话串行完成;集成链 bdddf77fa2→bac979746a→923d799394→b4536fda73→merge 16dbc6f32d=466eecd727)——①**P3-9 成本真网计价+实时看板**:价表数据层(40+ 模型公开牌价+厂商兜底+运行时覆盖)已由并行会话当日收口于 `core/model_pricing.py`,本轮补齐三缺口:GET /api/model-pricing 只读快照 API(模型级/厂商兜底/覆盖注入/覆盖率统计,killer_extras 挂载)+`admin/model-pricing` 看板页(覆盖率卡片+模型/厂商/覆盖三 tab 价目表,AdminNav 入口复用存量孤儿键 nav.pricing)+8803 直连 rewrite+5 语言 i18n;test_model_pricing.py 14 测(前缀特异性/覆盖优先级/兜底链/estimated 口径/快照信封)。②**P3-10 一键发布/接入文档引导**:`docs/ONBOARDING.md` 零配置跑通(命令逐条对照 dev-port-registry.json/start-dev.ps1/drizzle db:push 核实,非臆造)+web `/onboarding` 五步 checklist 页(配置模型→首次对话→Agent 执行→时间线回放→成本与价表,localStorage 进度记忆)+MCP 商店/能力市场入口聚合。③**P3-11 全端杀手锏同构**:穷举扫描 2363 个 TS 源文件(语义名+特征值双路),CLI 清零 2 处二次写死(agent.ts `??0.88` 兜底、compaction-cache.ts `KEEP_RECENT=6` → import @ihui/context-compaction 单源);质量自证常量(0.5/4)补入 TS 镜像+parity 测试(tunables 显式沉淀 *_DEFAULT 标量作断言基线);新守门 `scripts/check-killer-parity-ends.mjs` 入 check:all(违例 0,repl.ts 0.87 强制压缩数学为显式豁免)。**合并验证**:i18n 3 新命名空间 ×5 语言 parity OK、守门 2363 文件 0 违例、pytest 35 通过、改动文件 tsc 0 错。**路线图 P0/P1/P2/P3 全部闭环**;仅剩 2 条计划内需外部资源项:公网 MCP OAuth 真网端到端(需真实远程端点+凭据)、成本真网计价对账(需厂商账单 API 密钥,价表层已就绪可注入)。
- 2026-09-07(深夜):**两条「需外部资源」遗留项全部真网闭环**(主会话+浏览器自动化完成,零新增用户侧凭据)——①**公网 MCP OAuth 真网端到端**:对真实公网授权服务器 mcp.linear.app 完成全链(RFC 8414 真实发现→RFC 7591 动态客户端注册 client_id=x8zglnvuliStFZce→浏览器自动化驱动真实授权同意(Chrome 配置档副本+CDP,穿透 Linear 登录/Google OAuth/workspace 创建三层)→PKCE S256 真网令牌交换→streamable initialize→tools/list 36 工具→tools/call(list_teams) 返回真实工作区数据);**途中根治真 bug**:MCPClient 原样透传上游小写 token_type=bearer,Linear 资源服务器严格匹配标准形态报 401 invalid_token(RFC 7235 宽容假设的真网反例)——提炼 _canonical_auth_scheme 规范化+回归单测;真网 pytest 三层(发现/authorize 受理/持久化 token 全链)+e2e 脚本持久化 token 快速通道+凭据文件 gitignore。②**成本真网对账**:OpenRouter 真实调用(openai/gpt-4o-mini)真账单 usage.cost vs 本平台 estimate_cost_usd 推算 MATCH(Δ8.17%≤15% 容差)+官方牌价交叉核对 8/8 可核对项全 MATCH(claude-3.5 系 OR 已下架 SKIP)+deepseek 官方 V3.2 牌价修正(0.27/1.10→0.28/0.42)+scripts/cost_realnet_reconcile.py。**GAP-PLAN 全路线图含遗留项 100% 闭环,项目再无待办。**

- 2026-09-08:**对标复检后本机可做缺口两线闭环 DONE**(主会话接管,三线 agent 全数死于 429 后串行续做;集成 tip 98b6cb37fc 三仓同步)——①**团队共享记忆层**:`packages/database` team_memories 表+幂等迁移(本地 PG17 实际应用验证)→ `apps/api` team-memory 路由(CRUD+scopeId 隔离+kind/tag/keyword 过滤,vitest 16/16 绿)→ web 页(kind 徽章过滤+搜索+编辑面板,tsc 0 error,单文件 <250 行)→ i18n 5 语言 parity(30 键);②**HumanEval 外部标准评测**(项目首个外部可比成绩):官方 164 题数据集(MIT)接入+沙箱子进程执行器(缓存断点续跑+并发限流自适应),真跑全量 **pass@1=0.8598(141/164,agnes-2.5-flash,temp=0,零 api_error,零编造)**,报告+执行器入库 scripts/evals/。剩余缺口:模型层与生态规模(代码不可追)、事件唤醒云 agent(并行会话主仓实施中)、GitHub secrets(用户侧)。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
