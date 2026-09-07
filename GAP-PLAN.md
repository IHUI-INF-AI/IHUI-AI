# GAP-PLAN — 远超对标程序（Claude Code / Codex / Trae / Qoder / WorkBuddy）全面深度计划

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
- ~~成本真网计价~~:已关闭(2026-09-07 P3-9 DONE,LiteLLM 公开价表免密钥接入+实时汇率)。
- 云端并行沙箱 worktree:需容器基础设施(非代码单点可解)。
- 一键部署管道:需线上服务器/nginx 操作权限。

## 进度日志

- 2026-09-03:计划定型并列入此文件。
- 2026-09-03:P0-1 一致性基座 DONE——`app/core/tunables.py` 单一真源(9 常量),5 service(step_recorder/agent_checkpoint/file_editor/core-context_compaction/mcp_client)改引真源;TS 镜像 `packages/shared/src/constants.ts` 校正;`tests/test_killer_parity.py` 漂移即失败(3 绿);受影响回归 248 绿。跳项:agent_loop_v2(并发中)、CLI 内部二次写死(compaction-v2.ts/mcp-runtime.ts,后续)。
- 2026-09-03:压缩质量自证(深度前移)DONE——`services/compaction_quality.py` 保留率评估(离线确定性+可选 embedding)、高/低价值丢弃分类、`apply_report_policy` auto_degrade、`CompactionQualityGate` EMA 连续低→fallback;31 新测+60 回归绿;修复绝对路径/尾标点/单点误触发。待接:提交通道接入(不碰 agent_loop_v2)。
- 2026-09-03:P1-5 MCP 超级工具聚合 DONE——`services/mcp_tool_aggregator.py` SuperToolPool(去重+first/prefix/merge_manifest 三仲裁+schema 归一化+manifest+call_forward),兼容自研 MCPClientTool;30 新测+mcp_client 72 回归绿;ruff 0。待接:在执行器装配处以 manifest 暴露超大工具集(agent_loop_v2 解空后)。
- 2026-09-03:P2-6 验证自愈引擎 DONE——`services/self_healing.py` generate_test_cases(可注入gen_fn+确定性模板)/run_and_diagnose(StaticRunner+失败归因)/heal(max_attempts+可注入patch_fn+优雅降级)/HealOutcome;29 新测+ruff 0。待接:LLM gen/patch 接入+pytest 子进程 runner。
- 2026-09-06:接线清零轮(429 限流打断后由主会话续完)——①**MCP 超级工具聚合 DONE**:`routers/agents.py` _build_supertool_pool/_supertool_tools_from_pool/call_forward 装配进 _build_loop_v2_tools(AGENT_SUPERTOOL_ENABLED,无外部 server 逐字节等价降级);修复内置 priority=100(POLICY_FIRST 裸名被外部按描述长度抢占的真缺陷);补 await 修复 _build_loop_v2_tools 变 async 后两处生产调用点的 coroutine 回归;test_supertool_wiring.py 6 测。②**self_healing LLM 接入 DONE**:`self_healing_llm.py`(llm_gen_fn/llm_patch_fn/PytestSubprocessRunner junit 归因/apply_patch_descriptor 落盘+workspace 白名单/llm_patch_and_apply,修复 junit attribute-only failure 误判通过的 Element falsy bug);`routers/self_healing.py` POST /api/v1/self-healing/run(main.py 挂载,AGENT_SELF_HEALING_ENABLED 门控);test_self_healing_llm.py 15 测。③**compaction_quality 提交通道 DONE**:`compact_with_llm.py` LLM 路径接入 assess_compaction+auto_degrade(保守 keep_recent+bonus 重压,复评不重复计数)+gate EMA,info 增量 quality 字段(AGENT_COMPACTION_QUALITY_ENABLED,关闭时旧契约不变);test_compaction_wiring.py 6 测。④**pr_reviewer GitHub 管道 DONE**:`.github/workflows/pr-review.yml`(PR 打开/同步+workflow_dispatch,secrets 未配置 notice+exit 0 保持 green,最小权限,并发去重)+`routers/pr_review.py` POST /api/v1/pr-review+test_pr_review_api.py。回归:ai-service 全量 10094 passed(9 失败全部定性:5 个为 HEAD 既有/并行 WIP、1 个全量序污染隔离即绿、1 个 StepFun 402 配额外部依赖、2 个本次引入已修)。**待办**:前端三件(聊天成本显示/Deep Research 入口/Teams 页)已挂 2026-09-07 01:25 定时重试。
- 2026-09-07:**P0-1 跳项清零(CLI 二次写死收敛)DONE**——① `apps/cli/src/tools/mcp-runtime.ts` 3 处 initialize 握手 `protocolVersion: '2024-11-05'` 二次写死(偏离单源)改为 import `DEFAULT_PROTOCOL_VERSION`(@ihui/shared 镜像 tunables.py='2025-03-26');② `apps/cli/src/compaction-v2.ts` 本地 `DEFAULT_KEEP_RECENT=6` 重复定义改为 import @ihui/context-compaction 单源(trigger/target ratio 此前已收口)。DEFAULT_MIN_MESSAGES=10/其他压缩参数为 CLI 算法本地参数(共享包未导出),保留。验证:cli tsc 0 错 / eslint 0 / 受影响 5 测试文件 77 passed(compaction-v2 35 + integration + cache + mcp-acp-transport + hub-mcp-adapter)。**P0 一致性基座至此全部闭环**;前端三件已于 2026-09-07 凌晨完成落库(c5fdee1d59/12e1d052b0/70b09f650d/7578485bf3/0ccd3e3d32,待 push)。
- 2026-09-07:**P3-9 成本真网计价 DONE**——① `apps/api/src/services/litellm-price-sync.ts`:LiteLLM 公开价表(免密钥,model_prices_and_context_window.json)→ai_pricing,USD/token→分/千token 换算(6 位小数+AI_PRICE_USD_TO_CNY 汇率,默认 7.2),事务 upsert 保留历史价;启动 30s 首跑+每 24h 同步(AI_LITELLM_PRICE_SYNC_ENABLED 门控);POST /api/admin/ai-pricing/sync-litellm 手动触发。②**精度根治**:ai_pricing 两列 integer→numeric(18,6)(drizzle mode:'number',消费端零适配)——integer 下 gpt-4o-mini(≈0.108 分/千token)会 round 归 0,numeric 后保留;迁移 20260907010000+本地 PG17 已应用。③12 个纯函数单测全绿(apps/api+packages/database tsc 0 错)。commit 2232a967f3 三仓一致。实时看板侧:admin/ai-cost+session-usage-badge 既有。**"真实外部缺口"清单中"成本真网计价"一条就此关闭**(汇率静态可 env 校准,未接实时汇率 API)。
- 2026-09-07:**收尾产品面双 MVP + 实时汇率 DONE(commit 79eca14770 三仓一致,基于 origin/main 7dad5ec784)**——①**用户侧定时自动化 MVP**(对标 WorkBuddy automations):`user_automations` 表+`agent-automation-scheduler.ts`(60s tick,once/recurring+RRULE 简版解析 HOURLY/DAILY/WEEKLY,执行经 agent-runtime SSE 流,lastResult 落库,解析失败自动 paused 防死循环,once 靠 lastRunAt IS NULL 防重跑)+/api/automations CRUD+run-now(全部 userId 越权防护)+web 管理页(状态徽章/表单 Dialog/RRULE 前端拼装与反解);parseNextRun 14 用例。②**Repo Wiki MVP**(对标 Qoder):`repo_wiki_docs` 表+`repo-wiki-service.ts`(模块分组预算:每模块≤8 文件/单文件 8KB/总量 120KB;LLM 1+1 次生成 overview+≤6 模块文档,逐模块失败跳过)+/api/repo-wiki generate/list/detail/delete+web 页面(File System Access API 选夹收集,前端预算截断,MarkdownStream 渲染);预算纯函数 11 用例。③**实时汇率**:litellm-price-sync 静态 env 汇率→frankfurter.app(ECB 数据免密钥)24h 缓存+失败回退 env/静态值,15 用例(fetch 全 stub)。④迁移 20260907020000/20260907030000+本地 PG17 已应用;journal idx245/246;i18n automations(键×5 语言)+repoWiki(28 键×5 语言)注入且与页面实际 t() 用键对齐(防死键门禁);apps/api+web+database+api-client tsc 全绿。**至此对标报告所有可在本机闭环项全部关闭;剩余=云端沙箱 worktree/部署管道(需外部资源)**。
