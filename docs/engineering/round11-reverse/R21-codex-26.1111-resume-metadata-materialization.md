<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 CompactionResumeMetadata 物化算法 取证报告（Round 21）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` codex.exe 364.8MB。
下潜 R20 §6 遗留——`resume_metadata` 6 元素物化算法（CompactionResumeMetadata
结构体内部语义 + cold 物化判定）。

## 1. 取证方法

对 codex.exe 364.8MB 做流式 `strings` 定向扫（按 `CompactionResumeMetadata` /
`summary_first_user` / `summary_final_agent` 反查 SQL schema + panic 文案）+
全仓 grep 确认真空白。

## 2. 关键取证发现

### 2.1 结构体声明（逐字）
```
struct CompactionResumeMetadata with 6 elements
```
**6 元素的字段组成未逐字列出**（结构体声明是逐字，字段名是推定——见诚实边界）。

### 2.2 SQL schema 暴露的两个 summary 时间锚（逐字 8 项同形）
cold 物化时用到的两个视图，来自 strings 抽取的 SQL SELECT 片段：
```
summary_first_user_*  8 项: turn_id / item_id / rollout_ordinal / updated_at_ordinal
                            / created_at_ms / started_at_ms / completed_at_ms / item_json
summary_final_agent_* 同上 8 项
```
这两个视图是 cold_resume / cold_fork 物化 thread 历史时重建「首条用户消息」与
「最近一条 agent 消息」的时间定位。

### 2.3 复合 payload 关联字段（逐字）
`compaction_response_id` / `latest_token_usage_record` / `next_order`（rollout 序号锚）。

## 3. 本仓三层分工（防冗余核查）

| 本仓模块 | 轴 | 关系 |
|---|---|---|
| `turn_resume_kind.py`（R20） | resume kind 六值分类 + Windows job object 恢复 | **上游**：kind 判定后走物化 |
| `turn_suspension.py`（R19） | 挂起侧四段顺序状态机 | **不同侧**：挂起非物化 |
| `turn_phase_advance.py`（R15） | 回合进行中 phase 前进决策 | **不同轴** |

**真空白确认**：`grep CompactionResumeMetadata|summary_first_user|summary_final_agent`
在 ai-service 全仓零命中 ⇒ Codex 独有的「cold 物化时间锚对账」在本仓无对应语义。

## 4. 复现交付

`apps/ai-service/app/core/resume_metadata_materialization.py` +
`tests/test_resume_metadata_materialization.py`（11 用例）。

- `ResumeMetadata`：6 元素推定组成（first_user_turn_id / first_user_item_json /
  final_agent_turn_id / final_agent_item_json / next_order / compaction_response_id）。
- `DiskSummaryView`：磁盘 rollout summary 视图（readable + 两个 rollout_ordinal）。
- `MaterializationDecision`：四档封闭集（MATERIALIZE_FULL / DEGRADE_TO_PARTIAL /
  FAIL_NO_ANCHOR / FAIL_ORDER_MISMATCH）。
- `classify_materialization()`：4 条优先级链（双缺→order 冲突→partial→full）。
- `materialization_elements()`：6 元素推定组成可机检（fail-closed）。

## 5. 一轴超越

对照把「两个 summary 锚缺失/冲突」散在 SQL 查询的运行时分支（查不到就降级或 panic），
且 **next_order 与 final_agent_rollout_ordinal 的冲突判据没有显式化**（rollout 已推进
到 next_order 之后 → summary 视图过期 → 物化会丢数据）。本仓提前为纯函数：结论可 diff、
可单测、可在编排层挂前置，每档带命中的锚字段名 + 冲突的具体 ordinal。`materialized_anchors`
元组把「实际物化了哪些锚」显式化（对照隐式）。

## 6. 诚实边界

- **6 元素字段组成是推定**：`struct CompactionResumeMetadata with 6 elements` 声明逐字，
  但 6 个字段名（first_user_turn_id / first_user_item_json / final_agent_turn_id /
  final_agent_item_json / next_order / compaction_response_id）是按 SQL schema + 复合
  payload 关联字段**反推**，非逐字取证的字段表。
- **未接生产路径**：`session_store` / `agent_loop_v2` 属核心在飞件（` M`），接入点留属主。
- `MaterializationDecision` 是**物化语义对照真相源**，不替换 `turn_resume_kind.ResumeAction`
  （恢复 kind 轴）/ `session_store` 持久化层（真实磁盘 IO）。
- **优先级是推定序**：本模块假定「双缺 > order 冲突 > partial > full」，对照 SQL 查询
  多条件同时命中时内部确切优先序未从二进制确证。
- **真实磁盘 IO / SQL 查询执行**不复现（属持久化层）。

## 7. 验证实数（2026-11-16 当次现读）

- **11 pytest 全过**（含 2 处反向变异：next_order=None 不应走 order_mismatch /
  partial first_user 锚不阻塞 full 物化，均转红）。
- **ruff 全绿**（修 4 处：unused import `pytest` + 3 处自动 fix）。
- **水印 2/2**：`resume_metadata_materialization.py` /
  `test_resume_metadata_materialization.py` 各 1。
- 字节数：`resume_metadata_materialization.py` 9396 /
  `test_resume_metadata_materialization.py` 9081。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
