<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Trae CN 3.4.12 逆向取证（2026-10-31 轮）

本目录是「逆向-复现-超越」铁律（`AGENTS.md` §0 第 11 条）的取证面存档。对照程序 = 本机安装的
`C:/Users/Administrator/AppData/Local/Programs/Trae CN/`（`manifest.json` 现读
`appVersion=3.4.12`、`buildVersion=2.3.99124`、`package=com.trae.app`、region=CN）。

上一轮（`../qoder-rea-20261030/`）只覆盖了 Qoder CN；本目录补上 Trae 这一半，
并给出**三方逐条对照的缺口矩阵**，供后续派单直接引用。

## 册面

| 文件 | 射程 | 关键读数（均为当次现读，换版需重取） |
| --- | --- | --- |
| `T1-trae-ai-agent.md` | `resources/app/modules/ai-agent/` agent 内核 | 内核是**原生 Rust 进程**（`ai_agent.dll` 282MB / `harness.dll` 248MB / `toolhost` 95MB，本地 socket 40005），非 JS；工具 145–161 枚、权限决策枚举 16 值（**命令级**粒度，无审批通道时拒绝执行而不降级）、压缩 ≥4 档、会话落 SQLite（89 次迁移、fork/resume/continue/list 齐）、子代理 43 型 × 隔离 4 档 |
| `T2-trae-periphery.md` | `ckg` / `sandbox` / `browser-bridge` / `ai-completion` / `git-ai` | `ckg` = Go+CGO 的 gRPC 服务 `CodeKGServer`（91 种消息，含 21 枚 ContextFS 虚拟文件系统），增量走 merkletrie 分片脏标；沙箱是 **API 拦截**（5+8 枚 listener）而非仅 Job Object；浏览器走 native messaging + HMAC/nonce 防重放；`ai-completion` 14 枚 tree-sitter WASM、两档模型、4 级 debounce；**AI 代码归属写 `refs/notes/ai`** |
| `T3-gap-matrix.md` | 上一轮 Qoder 清单在本仓的逐条复判 | 27 条全覆盖：**已具备 12 / 实现了但没装车 8 / 结构性缺失 7 / 未判定 0**；C 档里 5 条属壳层（本仓形态不适用），真·产品缺口只有 Workflow 工具与 Advisor/ChatPatch 两条。**时效注记（2026-11-01 现读）**：该表是 02:03 读数，其后本仓并行落地频繁，G-03（`taskCreated`/`taskCompleted`，现读派发点 `apps/cli/src/tools/background-registry.ts:486`）与 G-09（Elicitation，现读调用点 `apps/ai-service/app/services/agent_loop_v2.py:5590-5598`）两条「没装车」已被现读推翻为已落地；余下条目正逐条复量，引用本表前先读复量件 |
| `T4-native-surface.md` | 原生件 PE 结构层 + Ghidra 反编译层 | `libckg.dll`（39,672,720 B，x64）导出 23 枚 C 符号，实锤内嵌加密 SQLite + `sqlite-vec` 扩展入口（`sqlite3_vec_init`/`_numpy_init`/`_static_blobs_init`）+ ahanet 网络栈 + BP IPC 客户端，而 CKG 的 gRPC 服务不占导出表；Trae sandbox = **Detours 系统调用注入拦截**（SDK 进程 + 被注入 DLL），与本仓 `proc_sandbox.py` 的 Job Object 限额模型不同层 |
| `T5-goal-b42.md` | toolhost 反编译 + 本地 embedding 回落落地 + T2 §8 缺口现状盘点 | 含 Qoder `browser-connector`（v1.7.6，b41 零接触面）取证增量 |
| `T6-goal-b43.md` | Qoder context-plugin 破译 + Repo Wiki agent 写面落地 | `qoder-cn-context-plugin`（v1.0.91.b22f2d0a，`userVisible=false` 静默内置）= MCP-as-engine 形态，hooks 协议 5 事件 8 钩子逐字规格（SessionStart/SubagentStart/UserPromptSubmit/PostToolUse/Stop）；本仓对位落地 = `apps/ai-service/app/services/knowledge_writer.py` + `/api/v1/ai/knowledge-write` 四端点，`tests/test_knowledge_writer.py` 6/6；toolhost/harness 两件反编译当时仍「分析级完成、反编译级进行中」 |
| `trae-3.4.12-capability-architecture.html` | 交互架构图（`diagram-candidate.json` 的 finalize 产物） | 928,295 B，`archify finalize architecture --browser-check` 出 `status=pass`。**入库面只有凭据 JSON**：`.finalize.json` / `.browser-check.json` / `.delivery.json` / `.finalize-summary.json` 四枚同批入库；HTML 本体被 `.gitignore` 的 `*.html` 规则排除（与 `../qoder-rea-20261030/` 同口径——那里也是 5 枚 JSON 入库、HTML 留工作区），要重看交互图按下方命令就地重渲染：`node .ihui/skills/archify/bin/archify.mjs deliver architecture diagram-candidate.json <输出路径> --repo-root G:/IHUI-AI`（2026-11-01 补，前册只到 candidate 未出图） |

## 三条取证边界（务必知道，否则会误用这些结论）

1. **T1 未跑 REA 原生反编译**。282MB 的 PE 在时间盒内不可行，已降级静态取样并在该册 §0.3
   写明；因此 T1 的结论面是「结构 + 符号 + 字符串 + 枚举」级，不是「逐函数」级。
   本机 Ghidra 12.1.4 在位（`D:\DevEnv\ghidra_12.1.4`），真要逐函数取证需要单独立票。
2. **用户态一律未读**：`AppData/Roaming/Trae CN/`、`*.dat`、token、cookies、SQLite 正文
   只看文件名与字节数。凡涉及凭据的字段只记录「形态」，不记录值。
3. **发现一个来路不明的投毒面样本**：`modules/ai-agent/checkpoint.sh`（305B）内容是一段
   面向模型的中文指令，而两个主 DLL 对该文件名零引用、全 app 树只此一处含该串。
   取证席**未执行、未采信**，已在 T1 §0.4 登记。读这些结论时请把它当作「对方产品目录里
   存在针对 LLM 的注入样本」这一事实，而不是当作 Trae 的功能。

## 本轮已由这些结论驱动的落地

| 落地枚 | 能力 | 对照轴 |
| --- | --- | --- |
| `8aa6e04350` | 输入上下文溢出应急压缩（上游明示装不下 ⇒ 按模型窗口强制确定性压缩后立即重试） | 对齐「会话不因装不下而死」；超越点 = 只在今天必失败的路径上生效、健康请求零行为变化，且压不动时显式不猜 |
| `19653cc078` | 聊天端压缩上限改为按模型解析（原先只在客户端自报 `context_limit` 时才压） | 与执行器侧共用同一份解析出口，消灭第二套口径 |
| `1394337a7545` | AI 代码归属落 Git notes（`scripts/lib/ai-authorship-notes.mjs` + `scripts/record-ai-authorship.mjs`） | 对齐 `refs/notes/ai`；超越三条 = 「未判定」态可表达、多会话共享工作树的归因分桶与跨席重复主张可检、内容哈希自证 + 只读校验出口。消费方接线仍被在飞面挡住（见该册头注） |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
