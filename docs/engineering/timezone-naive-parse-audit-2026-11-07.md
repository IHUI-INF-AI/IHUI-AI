<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 时区 / naive 时间解析审计（2026-11-07）

本文件是 `apps/ai-service` 中**所有字符串时间解析点**的判定台账。目的不是记录"改了什么"，
而是记录**"探到了但确认不该改"**的条目与理由——否则下一个人看到 naive 解析仍会当漏改，
再跑一轮同样的审计。

## 判定口径

只有同时满足以下三条才算"需要修的同病"：

1. 时间串来自外部输入或落盘文件；
2. 解析后返回 naive；
3. 该值参与**过期 / 有效期 / 超时**比较。

只做记录、只做展示、只做排序键、只做字符串透传的，一律不参与判定。
naive 的语义必须显式：**UTC**（机内自产）、**北京时间**（第三方签到域）、或**宿主本地**
（成对写读的本机文件）。

## 本批修复（2 处）

| 位置 | 问题 | 处置 |
|---|---|---|
| `app/services/ttl_json_store.py:parse_timestamp` | `fromisoformat` 对无偏移串成功返回 naive，直接 `.timestamp()` 按宿主本地解释；而写侧 `iso_now()` 是 `time.gmtime()` 的 UTC 串 ⇒ 宿主非 UTC 时保留期整体漂 8 小时 | 解析后显式补 UTC 再 `.timestamp()`；兜底 `strptime` 分支同样补 UTC。夹具 `tests/test_retention_ttl_store.py::test_parse_timestamp_naive_is_utc_not_host_local` |
| `app/routers/cost_ledger.py:_parse_dt` | naive 行与 `_parse_bound` 的 aware 边界混比 ⇒ `TypeError` | naive 显式补 UTC，两侧同类。夹具 `tests/test_cost_ledger_router.py::test_query_window_accepts_naive_at` |

## 签到域（3 处，已在 `df4b135ba7` 按北京时间成对改造）

`checkin_qoder.py:169`、`checkin_workbuddy.py:188`、`keepalive/probes.py:213`。
第三方返回的 aware 串转北京 naive；第三方 naive 串按北京墙钟解释；比较侧同为北京 naive。

## 故意不动（探到了，确认无害）

| 位置 | 形态 | 为什么不动 |
|---|---|---|
| `services/agent_timeline.py:_to_epoch` | 无偏移 ISO → `.timestamp()` | 只做排序键，不判过期；naive 统一落宿主本地，组内相对顺序不变 |
| `services/dag_scheduler.py:_to_epoch` | 同上 | 同上 |
| `core/queue_items.py:_parse_ts` | naive 显式补 UTC | 队列排序 / epoch，不判过期 |
| `services/a2a_service.py` | 自产 `now(UTC).isoformat()` 往返 | 记录/索引分，不判过期 |
| `services/audit_service.py` | 自产 ISO 落库 `timestamptz` | 记录时间戳 |
| `services/long_term_memory.py` | 取自产 ISO 后切 `[:10]` | 日期展示 |
| `services/publish/anti_risk/risk_scoring.py` | `Z→+00:00` 转 epoch | 风险窗口排序，不判过期 |
| `services/model_catalog.py` | naive→UTC 后比 `release_date` | 模型代次分类，不是时刻比较 |
| `services/importers/aider.py` | `strptime(...).replace(tzinfo=UTC)` | 导入记录，显式 UTC |
| `services/importers/ir.py` | naive→UTC 后格式化 | 导入记录 |
| `services/publish/platform_rule_versions.py` | 日精度 `strptime` | 两侧同形、日粒度版本比较 |
| `services/publish/platform_dom_selectors.py` | 日精度 `strptime` | 同上 |
| `services/hook_engine.py` 节流比较 | 两侧 naive UTC + 同宿主偏移 | 写入与比较同源，偏移相消，不是 8h 漂移 |
| `services/hook_engine.py:2037` | 去 `Z` 后做时长字符串运算 | 时间线展示，不判过期 |
| `services/background_tasks.py:_parse_iso` | 普通 `fromisoformat` | 仅回放任务日志字段；超时用 `timeout_s`，不用时间戳 |
| `services/session_summarizer.py:_extract_start_time` | `fromisoformat` | 会话摘要的 `start_time` 元数据，不判过期 |
| `services/mcp_server.py:6578` | `Z→+00:00` 转 epoch | 团队板闲置逐出；写侧 `_team_task_now()` 是 aware UTC，naive 分支不走 |
| `tools/automation_tools.py:131` | `Z→+00:00`，无偏移直接拒绝 | 入参校验，fail-closed |
| `core/ledger_merge.py` | 原始 `at` 保留 naive，排序时 `_order_key` 统一补 UTC | 账本合并取最早；比较键已显式 UTC |
| `core/file_watcher.py:371` | `date.fromisoformat` 解析**声明的到期日** | 到期日是日历日期（无时区语义）；"今天"已走 `cn_today()`（`:377`），不存在两套"今天" |
| `skills/koubo_workflow/project_boundary.py:121` | `time.mktime(strptime(...))` | 会话锁文件由本机 `time.strftime` 写入、本机读取，成对自洽且不跨机；单边改 CN 反而制造新漂移 |
| `routers/ai_skills.py:631` | `str[:10]` | 趋势按日聚合展示 |
| `services/hook_engine.py:2179/2215` | `str[:10]` | 预测按日聚合展示 |
| `skills/content_engine/full_audit.py:630-631` | `str[:10]` | 审计按日聚合展示 |
| `services/cost_ledger.py:395` | `str(at)[:10]` | 报表日期过滤（按串内日历日），不判过期 |
| `skills/koubo_workflow/tools/topic_pool.py:103` | `str[:10]` | 选题池展示 |
| `routers/llm.py:1043` | `fromisoformat(_created_at)` | 生产端 `approval_persistence._now_iso()` 是 UTC `Z`（aware），比较侧 `now(UTC)` aware，安全 |
| `services/ab_test_scheduler.py:512` / `ab_test_tracker.py:781` | 强制 naive→UTC | 实验超时/窗口，口径显式 |
| `services/memory_decay.py:690` / `dream_service.py:200` | 强制 naive→UTC | 衰减年龄，口径显式 |
| `services/knowledge_compiler.py:372` | 强制 naive→UTC | 卡片 TTL，口径显式 |
| `core/approval_replay.py:98` | 强制 naive→UTC | 保留期，口径显式 |
| `services/checkin_credits.py:79` | 强制 naive→UTC | 日额度，口径显式 |
| `services/rules_engine.py:1374` / `llm_budget_governor.py:394` | 生产端 aware UTC | 统计窗/预算范围，两侧同类 |
| `services/db_sync_scheduler.py:261` | 落盘用 `now(_CN_TZ)`，带 `+08:00` | 调度到期，读回 aware |
| `core/current_time_reminder.py:283` | 快照 ISO 往返 | 与 `time_provider` 同源 |
| `routers/ai_skills.py:658` / `edu_canteen_receipt.py:281` / `checkin_store.py:2247` / `koubo_validate.py:1184` | 日 / 月日精度 | 日历日期，非时刻比较 |
| `scripts/migrate_self_media_history.py:44` / `services/opencompass_scrape.py:229` | 一次性迁移 / 抓取日期 | 非运行时过期判定 |

## 存量数据口径（2026-11-07 补）

「naive 一律按 UTC」只对新写入成立还不够，必须回答**存量无偏移串是哪一版写进去的**。

### 本地可查样本

扫描 `apps/ai-service/data` 下 4 份 JSON（`agent_longterm_memory.json`、`ai_code_attribution.json`、
`audit_logs.json`、`cost_ledger.json`）：

| 分类 | 数量 | 时间范围 |
|---|---|---|
| 带 `Z` | 9 | 2026-11-06 |
| 带 `+08:00` 偏移 | 32 | 2026-11-06 ~ 2026-11-07 |
| **无偏移（naive）** | **0** | — |

`cost_ledger.json` 的 32 行 `at` 全部是 `+08:00` 的 aware 串（本地录制的 recorder 步骤时间）。

### 写侧历史

| 存储 | 写侧来源 | 历史是否出现过「无偏移本地串」 |
|---|---|---|
| `ttl_json_store` 各消费方 | `agent_step_recorder` / `agent_longterm_memory` / `audit_log` / `browser_trace` 的 `_now_iso` 都是 `time.gmtime()`；`vector_memory` / `ai_code_attribution_store` / `agent_teams` 用 `ttl_json_store.iso_now()`（同为 `gmtime`） | **否**：`git log -S "datetime.now().isoformat"` 在这些文件上 0 命中 |
| `cost_ledger` | 模块 `_now_iso` 自首笔 `a6c1fbd687` 起就是 `time.gmtime()`；`append(at=...)` 的调用方用 `datetime.now(UTC).isoformat()` 或 recorder 的 aware 串 | **否**：同上 0 命中 |

### 结论与缺口

- 代码写侧**从未**产出无偏移本地串 ⇒ 「naive 一律按 UTC」对**代码写入**的存量成立，不需要迁移。
- 唯一未证：**手工编辑 / 外部导入**的行。本工作树看不到生产 `data/` 目录或生产库
  ⇒ **缺证据：缺生产存量样本**，不能用本地 1 天样本外推。
- 口径从此写死：代码写入按 UTC；来源不明的手工/导入行也按 UTC 解析（原「宿主本地」口径作废）。
  若日后确证某批手工数据是本地墙钟，按批次单独迁移，**不做全局回退**。

## 维护约定

新增 naive 解析点时，必须在本文件补一行：位置、形态、来源、naive 语义、是否参与过期比较。
代码对应位置留一句 `时区审计:` 注释指向本文件。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
