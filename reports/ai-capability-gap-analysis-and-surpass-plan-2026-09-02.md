<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI AI 能力深度差距分析与超越路线图

> 生成日期:2026-09-02 · 依据:代码实查(apps/ai-service 模块级证据)+ 2026-09 竞品公开资料联网核实
> 结论口径:诚实评估,不空许诺。所有"现状"均标注代码出处;所有"差距"均给出对标对象的具体能力项。

---

## 0. 结论摘要

**现状定位:能力广度已达第一梯队边缘,工程深度落后对标产品 1~2 个身位。**

- **广度**:50+ 内置工具、MCP 双向(客户端 + JSONRPC server)、多智能体编排(orchestrator 1640 行 + DAG 调度 + A2A)、上下文压缩(TS/Py 双端对齐)、四层记忆体系、评测自进化(eval + opencompass + meta_learner)——能力域数量上已覆盖 Claude Code / Codex / Trae / Qoder 的绝大部分。
- **深度**:agent 循环的可靠性工程(流式、检查点、权限、沙箱、后台任务)、项目知识引擎、端到端基准验证,与 Claude Code 2.1.x / Codex 存在实质差距。
- **超越路径**:不硬拼模型层,以 **①编码 agent 可靠性(对标 Claude Code)②项目知识引擎(对标 Qoder RepoWiki,差异化主攻)③评测驱动自进化闭环(本项目独有,做成护城河)** 三条主线,12 个月双梯队第一。

---

## 1. 竞品能力基线(2026-09 联网核实)

| 能力项 | Claude Code 2.1.x | OpenAI Codex | Trae SOLO | Qoder | WorkBuddy |
|---|---|---|---|---|---|
| 形态 | CLI/VSCode/Desktop/Web/JetBrains | App/CLI/IDE/Web/云 | IDE+SOLO 工作台+移动端 | IDE+JetBrains+CLI+移动端 | 桌面 Agent+小程序 |
| 子代理 | 上限 20 并发、嵌套 3 层、独立上下文 | 多 Agent 并行+云沙箱(1-64GB 容器) | 多 Agent 并行(2-20 并发云端) | 多专家协作+Quest(最长 26h/10 万文件) | ❌ |
| 计划模式 | Plan mode(plan.md 可编辑+确认门) | — | — | — | — |
| 检查点/回滚 | Checkpointing(Escape×2 回滚) | 隔离沙箱天然回滚 | — | — | — |
| 权限/沙箱 | OS 级沙箱 Bash、Auto Mode 分类器审批 | 容器隔离+审批门 | — | 沙箱+权限 | — |
| Hooks | 生命周期钩子(命令/HTTP/agent 检查) | ✅ | ✅ | ✅ | — |
| 技能体系 | SKILL.md 标准格式+热加载+市场+插件捆绑 | Skills(同规范) | Agent 市场 | — | — |
| MCP | 客户端+tool deferral(工具定义不进上下文)+list_changed 动态更新 | ✅ | ✅ | ✅ | — |
| 上下文压缩 | /compact + Auto Memory | — | 统一上下文池 | Repo Wiki+Knowledge Card+Memory | 腾讯文档资料库 |
| 后台/自动化 | 后台任务+Routines 定时+GitHub Actions | Automations+心跳 | 移动端派活 | 云端 Agent | 定时任务 |
| 基准成绩 | — | Terminal Bench 2.0:82.0% | — | — | — |
| 自进化 | ✗(人工维护 skills) | ✗ | ✗ | ✗ | ✗ |

**关键观察**:五家竞品均无"评测驱动自进化"闭环;Qoder 的知识引擎是唯一值得正面攻的产品差异点。

---

## 2. 本项目现状盘点(代码实查证据)

### 2.1 Agent 循环(`app/services/agent_loop.py`,580 行)

**已有**:
- 迭代循环 + function calling 原生解析(降级 ```tool_call``` 文本块)(L160-192)
- 并行工具执行:单轮最大 5 并发、分批 gather、白名单过滤、幂等只读工具重试 1 次(L30-61, L306-370)
- 用户画像 + 长期记忆 + meta_lessons 三重 system prompt 注入,失败全降级不阻塞(L86-134)
- 完成后记忆闭环:洞察保存、GraphRAG 实体抽取、episodic→semantic 提炼、L4 自评,全部 fire-and-forget(L385-495)

**差距(P0 级硬伤)**:
1. **`run_stream` 是假流式**:L507-577 只执行**单轮** LLM 调用,`max_iterations`/`tools` 参数声明后弃用(L529 `# noqa: F841`),不做工具循环——流式入口实际绕过了整个 agent 能力。
2. **工具结果全量回填**:L367-370 把工具输出原样 `json.dumps` 写入 memory,无 token 上限、无分页——一次大结果即可能撑爆下一轮上下文。
3. **无检查点/回滚**:循环中断后无状态恢复。
4. **无计划模式**:无只读阶段、无计划确认门。
5. **无 token 预算内嵌**:预算治理(llm_budget_governor.py)存在但未接入循环。

### 2.2 工具生态(`app/services/mcp_server.py`,4738 行)

**已有(实查注册清单,50+)**:
- 文件/代码:`read_file` `write_file` `file_edit` `file_search` `list_files` `search_codebase` `analyze_code` `generate_test`
- 执行/版本:`run_command` `git_operations` `code_review` `review_pr` `bug_fix` `feature_plan`
- 浏览器全套:`browser_navigate/click_element/type_text/screenshot/extract_dom/scroll/hover/...`(13 个)
- 计算机操作(computer use):`computer_mouse/keyboard/screenshot/clipboard/active_window`(10 个)
- 知识/内容:`web_search` `search_web` `fetch_url` `knowledge_lookup` `parse_document` `generate_chart` `image_generation` `vision_analyze`
- 编排:`dispatch_subagent` `schedule_task` `configure_automation_task`

**结论:工具广度已达 Claude Code 水准,此前"工具单薄"的判断有误,予以修正。**

**差距**:
1. `run_command` 无 OS 级沙箱、无危险命令强制审批门(项目有 `dangerous-command-detector` util 但未确认接入工具层)。
2. 无后台任务语义(等价 `run_in_background`):长命令阻塞整轮。
3. `dispatch_subagent` 无并发上限/嵌套深度/输出限额控制(对比 Claude Code 的 20 并发/3 层嵌套)。
4. 工具定义全量进上下文,无 deferral(Claude Code 已做:工具描述仅名字进上下文,用时才展开)。

### 2.3 上下文工程(`app/core/context_compaction.py` 648 行 + `context_engine.py` 2014 行)

**已有(工程扎实,超预期)**:
- 跨端双实现对齐:Python 与 TS 共享包 `@ihui/context-compaction` 逐常量一致(0.88 触发/0.6 目标/尾部保留 6 条)(L38-41)
- 分层金字塔摘要:近层 200 字符/远层 120 字符,时间距离加权(L53-61)
- tool_calls 配对保护(防孤 tool 消息 400)、摘要防嵌套、两级降级(truncate→incompressible)(L11-18)
- tiktoken BPE 精确估算 + base64 图片占位(1200 token/张)(L63-118)

**差距**:
1. **压缩全是规则摘要(字符截断),无 LLM 语义摘要层**——丢失的是信息而非冗余;Claude Code /compact 为模型驱动摘要。
2. 无检索增强压缩:被压缩丢弃的内容无向量索引兜底(有 knowledge_graph/codebase_indexer 但未与压缩联动)。
3. 无 `/context` 式 token 占比可视化与预算面板。
4. 无增量摘要缓存:每轮重压缩代价高。

### 2.4 记忆体系(`memory_service.py` 1146 行 + `long_term_memory.py` 380 行 + user_profile + knowledge_graph + active_forgetter + dream_service)

**已有:四层记忆(工作/情景/语义/画像)+ 遗忘 + 巩固 + GraphRAG,广度超全部竞品。**

**差距**:记忆质量无评测(存了什么、召回准不准、遗忘是否伤召回,均无指标);这是"有器官无体检"。

### 2.5 MCP(`mcp.py` 客户端 + `mcp_official.py` JSONRPC server)

**已有:双向实现。server 端支持 initialize/tools/resources/prompts/tools_call 完整方法集(mcp_official.py 实查)。**

**差距**:无 tool deferral、无 `list_changed` 动态通知、无 OAuth 远程连接、无 sampling 能力(server 端有 `sampling_handler` 痕迹,完成度待验证)。

### 2.6 编排(`agent_orchestrator.py` 1640 行 + dag_scheduler + agent_comm + a2a_service + agent_checkpoint + agent_loop_v2)

**已有:DAG 调度、agent 间通信、A2A 协议、checkpoint 服务文件存在。**

**差距**:
1. `agent_loop.py` 与 `agent_loop_v2.py` 双轨并存,能力不对等(v2 有记忆闭环标注,v1 也有)——两套循环是维护债与行为不一致源。
2. 子代理无工作区锁/冲突消解(Claude Code Agent Teams 有 workspace locking)。
3. `agent_checkpoint.py` 存在但未接入主循环(见 2.1-3)。
4. 无云端隔离执行环境(Codex 容器 / Cursor Background Agents 级别)。

### 2.7 评测与自进化(`eval_service.py` + opencompass + `meta_learner` + failure_clusterer + skills 自进化)

**已有:竞品均无的全链路自进化雏形——任务后自评→失败聚类→meta_lessons 注入下一轮→Skill 自动进化评估。这是本项目唯一的"人无我有"。**

**差距**:
1. 无端到端 agent 基准(对标 SWE-bench / Terminal Bench):自进化没有标尺,改进无法证真。
2. 自评闭环未进 CI,回归无门禁。
3. 失败聚类结果与 skill 修复之间无自动验证环(改了 skill 后是否真的提升,无对照实验)。

### 2.8 安全与治理(`llm_budget_governor.py` + audit_service + differential_privacy + hook_engine 1879 行)

**已有:预算治理、审计、差分隐私、hook 引擎(1879 行,规模超 Claude Code hooks 体系)。**

**差距**:Windows 本机(火绒 HIPS 拦 rename/写)使 OS 级沙箱方案复杂;无权限模式体系(default/plan/bypass 分级)、无敏感操作 UI 审批流、无 MCP server 管理员 allowlist/denylist。

### 2.9 差距矩阵(0-5 分,5=竞品旗舰水准)

| 维度 | 本项目 | Claude Code | Codex | Qoder | 差距主因 |
|---|---|---|---|---|---|
| 工具广度 | 4.5 | 4.5 | 4.5 | 4 | 已对齐 |
| Agent 循环可靠性 | 2.5 | 5 | 5 | 4 | 假流式/无checkpoint/无权限门 |
| 上下文压缩 | 3 | 4.5 | 4 | 4.5 | 无语义摘要/无检索兜底 |
| 记忆体系广度 | 4.5 | 3 | 3 | 4 | **领先** |
| 记忆质量度量 | 1.5 | 3 | 3 | 3.5 | 无评测 |
| MCP | 3.5 | 4.5 | 4 | 4 | 无deferral/动态更新 |
| 多智能体编排 | 4 | 4.5 | 4.5 | 4.5 | 无锁/无隔离环境 |
| 项目知识引擎 | 2 | 3.5 | 3.5 | 5 | codebase_indexer 未产品化 |
| 评测/基准 | 2 | 5(隐性) | 5 | 4 | 无端到端基准 |
| 评测驱动自进化 | 3 | 1 | 1 | 1 | **独有,未产品化** |
| 安全/沙箱/权限 | 2 | 5 | 5 | 4 | 无沙箱/审批门 |
| 多端覆盖 | 4.5 | 4.5 | 5 | 4 | 8 端已有,一致性待验 |
| 模型层 | 2.5(聚合) | 5(自研) | 5(自研) | 3.5 | 结构性,不硬拼 |

**结论:最大短板 = Agent 循环可靠性 + 评测基准 + 项目知识引擎 + 安全权限。最大长板 = 记忆广度 + 自进化雏形 + MCP 双向 + 8 端。**

---

## 3. 超越策略(差异化定位)

**不做的**:不训模型、不硬拼 Claude Code 的终端生态位、不做通用 IDE(信息差打不过字节/阿里)。

**三张王牌**:
1. **可靠性补齐是入场券**(Phase 0-1):对齐 Claude Code 循环工程,否则一切长板无意义——工具再多,一次假流式就露底。
2. **项目知识引擎 = 主攻差异化**(对标并超越 Qoder):把 `codebase_indexer` + `knowledge_graph` + 记忆体系整合为 "RepoWiki + Knowledge Card + 任务经验记忆" 三件套,叠加上本项目独有的 GraphRAG 与四层记忆,做"比 Qoder 更懂仓库"。
3. **评测驱动自进化 = 护城河**(竞品为零):把 meta_learner 闭环产品化——失败聚类→假设→skill/记忆修复→基准对照验证→自动发布,形成"越用越强"的可量化飞轮。这是唯一无法被抄袭速度追上的能力(需要数据积累)。

---

## 4. 分阶段开发计划

### Phase 0:地基修正(2 周,全部 P0)

| # | 任务 | 修改点 | 验收 |
|---|---|---|---|
| 0-1 | 真流式 agent 循环:`run_stream` 接入完整迭代循环,逐事件 yield(llm chunk/tool 执行/迭代状态) | `agent_loop.py:507-577` 重写;复用 run 的工具执行逻辑抽公共函数 | 流式端到端演示多轮工具调用;删除 F841 死参数 |
| 0-2 | 工具结果回填加护栏:token 上限(默认 8k/结果)+ 截断标记 + 超限提示 LLM 分页拉取 | `_execute_tool_call` 出口 | 大输出用例上下文不爆 |
| 0-3 | checkpoint 接入:每轮迭代前快照会话状态(复用 `agent_checkpoint.py`),支持 cancel/failed 恢复 | agent_loop + agent_checkpoint | 中断恢复用例通过 |
| 0-4 | plan mode:工具白名单降级为只读子集 + 产出计划文档 + 用户确认门(路由层) | agents 路由 + 前端确认 UI | 复杂任务默认先计划后执行 |
| 0-5 | `run_command` 审批门:接入 dangerous-command-detector,危险命令强制人审;权限分级(read/write/exec) | mcp_server run_command + hook_engine | 危险命令 100% 拦截 |
| 0-6 | `dispatch_subagent` 治理:并发上限(默认 5)、嵌套深度(≤2)、单代理输出限额、超时 | mcp_server dispatch_subagent | 超限用例拒绝并提示 |
| 0-7 | 自建 IHUI-Bench v0:20 个真实任务(修复 bug/写测试/重构/多文件变更),脚本化评分 | 新增 `apps/ai-service/bench/` | 每日回归可跑,基线数字出炉 |
| 0-8 | 合并 agent_loop 与 v2:以 v1 接口为壳、v2 能力为芯,删除双轨 | agent_loop.py | 一套循环,回归全绿 |

### Phase 1:对齐 Claude Code 核心工程(1-3 月)

1. **真子代理体系**:独立上下文 + 工具子集授权 + 父子结果回传协议;并发 20/嵌套 3 对标上限可配。
2. **MCP 增强**:tool deferral(工具定义只在名字进上下文,MCPSearch 按需展开)、`list_changed` 动态更新、远程连接 OAuth。
3. **语义压缩层**:阈值命中后先 LLM 语义摘要(可选,预算内),规则摘要降级兜底;被压缩内容同步写向量索引,提供 `context_recall` 工具回捞。
4. **token 治理产品化**:`/context` 式占比面板 + budget_governor 接入主循环硬约束。
5. **技能体系标准化**:SKILL.md 兼容格式(对齐 Anthropic 规范)+ 热加载 + 技能市场雏形;现有 skills/ 两个目录迁移。
6. **后台任务**:`run_in_background` 语义 + 完成通知(复用 IM 多平台推送,已有 im_bridge)。
7. **权限模式体系**:default / plan / auto 三模式,auto 用分类器预审(对标 Claude Code Auto Mode)。

### Phase 2:差异化拉开(3-6 月)

1. **项目知识引擎三件套**:RepoWiki(自动生成+增量同步)、Knowledge Card(高密度知识单元抽取)、任务经验记忆(复用四层记忆)——`codebase_indexer` 升级为索引底座,knowledge_graph 出图谱视图。
2. **Agent 团队协作**:共享任务板(依赖阻塞)+ 工作区文件锁 + 冲突消解(dag_scheduler 扩展)。
3. **隔离执行环境**:Windows 下容器/VM 二选一(火绒因素优先容器远程),Codex 式云沙箱对接。
4. **自进化闭环产品化**:failure_clusterer 聚类→自动生成修复假设→基准 A/B 验证→通过则自动更新 skill/lessons;看板展示"自进化收益率"。
5. **记忆质量评测**:召回命中率/遗忘损伤双指标周报,active_forgetter 参数据驱动调优。

### Phase 3:超越(6-12 月)

1. 中文编码基准第一:自建中文真实仓库任务集(配合中文生态优势),公开排名。
2. 8 端一致性 Agent 体验:同一 agent 循环 + 记忆 + 技能在 web/desktop/mobile/extension/CLI 全端等效。
3. 企业治理补全:RBAC、SSO(已有批次)、MCP server 管理员 allowlist、审计合规报表。
4. 自进化技能市场:用户共享经基准验证的 skill,形成生态网络效应。

### 度量与验收(每阶段硬指标)

- Phase 0 末:IHUI-Bench v0 任务完成率 ≥60%,假流式清零,危险命令拦截 100%。
- Phase 1 末:完成率 ≥75%,平均迭代数下降 ≥20%,token 成本/任务下降 ≥25%(压缩+deferral 贡献)。
- Phase 2 末:完成率 ≥85%,RepoWiki 在本仓库(G:/IHUI-AI)实测覆盖 ≥90% 顶层模块,自进化闭环至少 5 个真实案例(修复假设→验证→采纳)。
- Phase 3 末:IHUI-Bench 完成率 ≥92%(对标 Terminal Bench 82% 水准),中文基准公开可复现。

### 风险与对策

| 风险 | 对策 |
|---|---|
| 模型层依赖第三方,波动影响基准成绩 | combo_router 模型路由 + 基准按模型分桶记录 |
| 火绒 HIPS 干扰本机沙箱 | 执行隔离走远程容器;本机仅只读工具默认放行 |
| 并行会话互相破坏(历史两次事故) | Phase 0-8 合并循环后行为单一化;任务板锁先行 |
| 自进化误采纳坏修复 | 基准 A/B 强制门禁,未过基准不落库 |

---

## 5. 一句话总结

**当前是"广度接近、深度欠账、独有自进化未变现"的状态;Phase 0 两周内修掉 8 个硬伤后,才具备谈"超越"的资格——先补可靠性入场券,再用知识引擎和评测自进化两张竞品没有的牌拉开差距。**
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
