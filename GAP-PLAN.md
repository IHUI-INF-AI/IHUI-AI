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
- **P1 深度(可证/可逆/自省)**
  3. 压缩质量自证(保留率/任务成功率 + 灰度降级) 4. 全活动时间线回放前端(压/回滚/成本/注入) 5. MCP 超级工具聚合层。
  - DOI: 每项 单测+真网+浏览器视觉。
- **P2 广度(无对照新维度)**
  6. 验证自愈引擎(自测→跑→自修→绿) 7. 跨会话接力闭环 8. MCP 服务端能力市场入口。
  - DOI: 端到端 demo 通过。
- **P3 生态与采纳**
  9. 成本真网计价+实时看板 10. 一键发布/接入文档引导 11. 全端(web/cli/miniapp/桌面)杀手锏同构。
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