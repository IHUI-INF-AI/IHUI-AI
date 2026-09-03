<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# STATE.md · 目标驱动执行状态（2026-09-03 初始化）

目标（/goal）：本项目全部 AI 能力要**远超** 对标（Claude Code / Codex / Trae / Qoder / WorkBuddy），在深度/细度/广度上拉开多年差距。

## 硬性判定基线（已完成真实代码审计，非自称）
本项目是 9-app 超级 AI 平台（web/api/ai-service/cli/desktop/extension/miniapp-taro/mobile-rn），
19 个模型 provider、40+ router、多模块高级能力。
在**广度上已系统性超越**所有对标；在下列**深度维度已反超**：
- 沙箱：Local/Docker/SSH/Modal/Daytona/Singularity 6 种后端
- Agent 编排：串行/并行/辩论 + A2A
- 记忆体系：长期/向量/多模态/衰减/主动遗忘/提取
- MCP 生态、hooks、checkpoint、plan_mode、19 provider 路由、工具 schema 跨模型双向适配、
  上下文压缩跨端对齐（TS+Py）、self_media 发布+反风险、元学习/联邦学习/差分隐私/技能进化

## 真实短板（对标"杀手锏细度"，本轮四阶段 P0 补齐）
- P0-1 全自动 LLM 语义压缩（对齐 `/compact`）
- P0-2 用户可感知 Checkpoint/Rewind 撤销
- P0-3 远程 MCP Streamable HTTP + OAuth
- P0-4 Deep Research 多轮深度研究闭环

## 验收标准（每个 P0）
1. 后端核心逻辑生产级实现，pytest 单测通过
2. 自有新路由文件（APIRouter 独立定义），**不**改写他人文件避免并行冲突
3. typecheck/lint（ruff/mypy）+ 关键 import 全绿
4. Master 统一在内 app/main.py 挂载路由后全链路可调

## 执行状态
| P0 | 状态 | 负责 agent | 验证 |
|----|------|-----------|------|
| P0-1 LLM 语义压缩 | DONE | A1 | pytest 5✓, ruff✓ |
| P0-2 Checkpoint/Rewind | DONE | A2 | pytest 22✓, ruff✓, 前端 tsc✓ |
| P0-3 MCP Remote+OAuth | DONE | A3 | pytest 8+52回归✓, ruff✓, mypy✓ |
| P0-4 Deep Research | DONE | A4 | pytest 10✓, ruff✓, 前端 tsc✓ |
| Master 挂载+验收 | DONE | master | TestClient 401挂载✓, 45+52✓, ruff✓ |
| P0-5 Computer Use 浏览器控制 | DONE | A5 | cli tsc✓, 真实Playwright冒烟✓ |
| P0-6 上下文压缩感知 UI | DONE | A6 | ai tsc✓, 5语言JSON✓, py_compile✓, 埋点接入✓ |
| P0-7 云托管 Agent 会话 | DONE | A7 | ruff✓, pytest 3✓, web tsc✓ |

## 第二轮交付（2026-09-03，差距审计后再补齐三缺口）
差距审计结论：代码库工具/权限系统/多Agent编排(串并辩+分解+通信)/实时流式/Provider适配/Hook/注入防护/审计均已反超；**真实缺口为浏览器控制、压缩感知UI、云会话持久化**。
- P0-5：apps/cli/src/tools/browser.ts 空占位 → Playwright 真实工具集（open/snapshot/click/type/screenshot/extract_text/close），单例复用+`String.raw`绕过esbuild宿主注入
- P0-6：新 routers/context_compaction.py（record_compaction 进程内存储 + GET /api/context-compaction）+ web ContextCompactionPanel + /context-compaction 页面 + 5语言
- P0-6b：llm.py 两处 `/compact` 压缩点埋点 record_compaction()，压缩发生时回写 → 感知UI有真实数据（compile✓ + 改动行 ruff 0错误）
- P0-7：services/cloud_run_store.py（进程dict+JSON落盘，重启可恢复）+ routers/cloud_runs.py（GET /api/cloud-runs 分页 + {run_id} 详情）+ agents.py 运行埋点 + web /cloud-agent 页面 + 5语言

## 前端导航接入 + 视觉自验（2026-09-03）
- nav-data.ts `ADVANCED_AI_TOOLS_CHILDREN` 新增 `/deep-research`（labelKey=deepResearch, icon=Rocket）
- 5 语言文件（zh-CN/zh-TW/en/ja/ko）新增 deepResearch 翻译，JSON 全合法
- next.config.ts 已加 /api/research* 与 /api/checkpoints* 代理 → 8803
- 视觉自验：browser 展开"高级 AI 工具"含"深度研究"项；/deep-research 页渲染输入框+启动按钮，无 404/白屏；
  代理链路 web 8801 → 8803 返回 401（认证拦截，非 404）✓

## 第二轮视觉自验（2026-09-03）
- /cloud-agent 渲染「云托管 Agent 会话」标题+刷新+空态「暂无运行记录」，无 JS 错误 ✓
- /context-compaction 渲染「上下文压缩感知」+累计压缩次数+空态提示，无 JS 错误 ✓
- /api/cloud-runs 与 /api/context-compaction 经 web 代理 → 8803 返回 401（挂载+鉴权拦截，非404）✓

## 待办（整体目标仍未完结，持续补齐对标细度）
- 真网验证：streamable_http 连真实远程 MCP Server + OAuth 授权码端到端
- checkpoint 文件快照从进程内提升为持久化（Redis）
- CheckpointRewindPanel 已在会话级引入侧供接入（当前需外部传 sessionId 挂载）
- Computer Use 前端控制面板（P0-5 已实现 CLI 工具集，web 可视化驾驶舱待补齐）
- /cloud-run /context-compaction 侧边栏导航入口（当前手动访问 URL，未加入 nav-data）
- CLI 侧云会话写入（跨端闭环，当前仅 HTTP streaming 路径落盘）
- 更多对标细度维度：计算机控制/Agent Teams/SDK 一致性等

（本文件随阶段推进更新）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
