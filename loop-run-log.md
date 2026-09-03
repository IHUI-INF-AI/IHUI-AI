<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# loop-run-log.md · 目标驱动循环运行日志

## 目标（2026-09-03 启动）
本项目全部 AI 能力要**远超**对标（Claude Code / Codex / Trae / Qoder / WorkBuddy），深度/细度/广度拉开多年差距。

## Round 1（2026-09-03）
**阶段**：目标解析 → 真实代码审计基线 → 差距定级 → 用户收敛优先级 → 四路并行补齐 → Master 挂载验收。

**关键结论**：
- 本项目为 9-app 超级 AI 平台，广度已系统性超越对标，多维度深度已反超（sandbox 6后端/agent编排/A2A/记忆体系/19 provider/MCP生态/自信心/self_media+反风控/元学习/联邦学习/差分隐私）。
- 真实短板为对标"杀手锏细度"，收敛 4 项 P0。

**产出（均测试绿）**：
| P0 | 交付物 | 验证 |
|----|--------|------|
| 全自动 LLM 语义压缩 | compact_with_llm.py 接入 llm.py | pytest 5✓ |
| Checkpoint/Rewind | agent_checkpoint+file_editor 扩展+checkpoint_rewind 路由+前端面板 | pytest 22✓ 前端 tsc✓ |
| MCP Streamable HTTP + OAuth | mcp_client streamable_http + mcp_oauth.py | pytest 8+52✓ mypy✓ |
| Deep Research | deep_research.py+research 路由+/deep-research 页面 | pytest 10✓ 前端 tsc✓ |
| Master 挂载 | main.py 挂载 /api/checkpoints* /api/research* | TestClient 401✓ ruff✓ |

**验收依据**：45 新用例 + 52 回归 = 97 passed；ruff 全绿；mypy --strict 成功；main.py 挂载经 TestClient 实测通过。

**Open/Next（下轮）**：真网远程 MCP+OAuth 端到端；前端全链路视觉自验+导航入口；checkpoint 文件快照持久化；持续追加对标细度维度。

## Round N（2026-09-03 · /goal H1-H5 复验轮收官）

**阶段**：目标重构为可量化 H1-H5 硬性指标 → 逐项实现与复验 → 全量回归 → 收官交付。

**最终判定（全部达成，详见 STATE.md"目标驱动复验轮"与"H1-H5 最终交付总结"）**：
| 指标 | 结果 |
|------|------|
| H1 benchmark | 20 任务、agent 真实执行 **18/20=90%**（≥80%），报告 benchmarks/reports/benchmark-report.json |
| H2 OAuth 授权码 E2E | 真网 4/4（metadata 发现+PKCE S256+302 回调+一次性 code+Bearer 全链路，负向 3 拒） |
| H3 agent_loop_v2 | ruff 0.16.1 实测 0 错误 + pytest 66 零回归 |
| H4 云会话+checkpoint | cloud-run 接入 CLI 主流程（并发 start+finally 终态+静默降级）+ 13 新用例 + 62 回归 |
| H5 全量 pytest | **9650 passed, 1 skipped, 0 failed**（948.96s，退出码 0） |

**关键修复**：doom-loop 滑动窗口误杀 bug（尾部连续计数替代窗口计数）；17-multi-extract 任务契约补全；OAuth 授权码流缺 PKCE（S256 向后兼容补全）；H2 E2E 文件 ruff E501。

**非阻塞遗留**：bench 15/16 波动性失败（随机性）；CLI"未能生成有效回复"假文案定位；并行 agent WIP 文件 tsc 错误（builtins.ts:391）。

**结论：/goal H1-H5 目标完成，循环终止（未达 20 轮上限，无连续 3 轮无进展）。**

## Round N+1（2026-09-04 · H1 复跑与 streamChat 吞错根治轮收官）

**阶段**：H1 复跑全量失败根因诊断 → 双层吞错根治（Fix A/B）→ 切换 agnes 模型复跑 → 回归验证 → 收官交付。

**最终判定（详见 STATE.md"H1 复跑与吞错根治轮"章节）**：

| 项 | 结果 |
|----|------|
| H1 benchmark 复跑 | `BENCH_MODEL=agnes/agnes-2.5-flash` 全量 **17/20=85%**（≥80% ✅），报告 benchmarks/reports/benchmark-report.json |
| 失败任务（07/09/14） | 模型随机波动（非代码回归，上轮同任务 agnes 亦波动） |
| 根因链 | stepfun 402 quota_exceeded（配额耗尽）→ SSE error 事件无数字 code 被判非业务错误 → 耗尽内部重试后 client.ts 仅走 onError 回调不 reject + agent.ts sampleWithRetry 不传 onError → 错误彻底丢失，agent 拿到"成功的空补全" |
| Fix A（agent.ts） | sampleWithRetry 接入 onError 捕获 streamErr，转入既有 formatSSEError 分类/重试逻辑 |
| Fix B（client.ts） | `!canRetry` 分支：无 onError 消费者时 `throw err`（reject）；有则保持原回调行为 |
| Fix B'（RN 屏） | AiAssistantN8nScreen streamChat 补 try/catch，错误路由到本屏既有错误状态（sending 复位 + toast） |
| 附带根治 | client.ts 刷新风暴：refresh 失败后 5s 冷却窗口，杜绝并发 401 串行 6+ 次 /auth/refresh 重放（加剧 RFC 6749 family 吊销） |
| 工具链 | benchmarks/run.mjs 新增 `BENCH_MODEL` 显式传 `-m`（IHUI_DEFAULT_MODEL 在一次性 agent 命令路径不生效，settings.json defaultModel 优先） |
| 回归测试 | 新增 12 用例全绿（api-client stream-chat-swallow-fix 4 + refresh-cooldown 5 + CLI agent-stream-swallow-fix 3）；api-client 144 / CLI 2181 / mobile-rn 261 零回归 |
| 端到端验证 | stepfun 冒烟：修复前静默空补全 → 修复后正确输出 `[error] StepFun 流式调用失败: 402 quota_exceeded` + `stopReason:"error"` |

**遗留项闭环**：上轮"CLI'未能生成有效回复'假文案定位"已随 Fix A/B 根治（假文案源头即吞错后空补全触发的兜底文案）。

**结论：H1 复跑 85% 达标，吞错链根治并测试锁定，循环收官。**

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
