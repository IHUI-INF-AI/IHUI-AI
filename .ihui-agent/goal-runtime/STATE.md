<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Goal Runtime STATE

- goal: 【2026-11-23 机主 /goal】用 craft-anything 0.5.0 `--deep` + REA 6.4.0 深度分析本机 **Qoder CN 0.5.14 / Trae CN 3.4.20 / WorkBuddy 5.11.3 / DeepSeek Harness 0.2.2-rc.5**，把前后端能力与最底层原生代码的设计复现进 IHUI-AI 并至少一轴超越。用户口语「抄袭」按本仓 §0.13 落地为：学习行为与设计 → 用本仓栈写自己的代码 → 测试钉住 → 至少一轴超越。红线：不粘专有源码、不破解许可证、不绕过付费、不提取凭据。
- status: **active（2026-11-23 午后）**：A 段 + **18 枚已入库**（`9e350367`→`fde9dc53`→`18044ae2`→`6f51d5c2`→`57391e73`→`4f7de183`→`276aa2cd`→`72b182a3`→`f2897112`→`0c717ac3`→`43911aae`→`6aaaccb0`→`0280efbd`→`ec781c0a`(B1-11)→`687c0409`(B3-04)→`9e4dfe9e`(B4-03)→`2364f996`(B1-05)→`acdb8d73`(P0-8b)）；C 段文档 `706d1faa` + 第 23/24 节已入库；C 段拓扑图已交付；**他席并发推进**（`b6bd8d8e` deny 审批档、`d2b4b528` B1-08、`8ee6291a` B4-09、`767d895e` 积分倍数同源）⇒ 后续避让；下一步 = 剩余待立项 13 条逐条判承载 + 修 archify theme-state（P0-1 不采纳；B1-06/B4-11/B4-10/B2-11/B2-08 等已裁决不做）
- 收尾口径（第 24 节）：44 条候选 = 我落 16 / 他席落 2 / 不采纳 10 / 已有等价 5 / 待立项 11
  （B4-12 复核为不采纳：CLI 无启动期历史清理动作，只有 `deleteSession(id)` 手动删；
  B1-10 复核为已有等价：`spill_retention.py` 已含 UTF-8 字节计价 / 头尾预算二分 / 图片不可切 / omitted 精确差分）
- 基线（现读，绝不复做）:
  - round8（2026-11-14）：4 判据复现，证据原落 `E:/` 盘已不存在。
  - round9（2026-11-15）：补 5 判据 + 聚合入口 `reverse_engineered_gates.py`，122 用例；**结论=零生产 importer**（本轮 A 段的由来）。
  - `docs/agent-harness-benchmark-2026-11-19.md`（1884 行）：112 项能力落地。
  - 本仓已超越的原生同构件：`terminal_session.rs`（Job Object + BREAKAWAY_OK）、`orphan_guard.rs`、`workspace_index.rs`、`embedded_browser.rs`。

## A 段实绩（已入 HEAD `9e350367`，本票 6 文件）

1. **gate_suite 装车**：`guarded_tool_pipeline.py` 新增 stage 2.5（`STAGE_GATE` / `ERROR_GATE_BLOCKED` /
   `GATE_KEY="__gate_suite__"` / `GATE_KEY_ABSENT` / `extract_gate_request` / `PipelineResult.gate`）；
   `agent_loop_v2.py::_security_precheck` 为**唯一真调用点**（控制键剥离后回写 `tc.args`，阻断面板带 `gate`）。
   缺省 `gate_request is None` ⇒ 判据函数一次都不调用（零行为、零开销）。
2. **context:// 命名空间装车**：`mcp_server._deref_context_uri_alias` 接在 `_validate_path_in_workspace`
   （22 个调用点单一入口）⇒ `read_file/list_files/write_file/file_edit` 全部支持
   `context://workspace/<rel>`；降级后仍走白名单 + symlink + 敏感黑名单三层真实判据；
   四工具 schema 同源提示 `_CONTEXT_URI_HINT`。
3. **修掉两个真实缺陷**：
   - `_PreGate` 新字段插在 `timings` 前 ⇒ 早期 stage 的位置参数错位（`timings` 落进 `gate`、`False` 落进
     `timings`）。mypy 抓到、行为测试漏掉。已把 `gate` 挪到末尾 + 新增字段序用例钉住。
   - 判据 `resolve_context_uri` 会把 `roots[ns]` 原样拼进 `canonical_path` ⇒ 传宿主路径会产出
     "看着像虚拟 URI、其实是宿主路径"的 canonical。接线传逻辑根 `_CONTEXT_VIRTUAL_ROOT="root"` +
     防御断言（虚拟路径任一段含盘符冒号/反斜杠即拒）。

## 验证（现读）

- `tests/test_gate_suite_pipeline_wiring.py` 17 例、`tests/test_context_uri_tool_namespace.py` 23 例（40 例）
- 相关面 26 个测试文件 **671 passed / 1 skipped**（含既有 54 例管线与判据回归）
- ruff：本次四文件 `All checks passed`；mypy `--strict`：`guarded_tool_pipeline.py` 自身 0 error
- 反向变异 3 次（gate 阻断短路 / 面板键改名 / `_PreGate` 字段序回退 / `if not ctx_ok` 短路）均如期转红并恢复
- 落地通道：`isolated-git` 被 [30a]+[298] 双门拦；**30a 的整改动作 `git tag lost-commit/*` 已被本仓
  history-guard 明令禁止**（判据互斥、无法整改）⇒ 走 §12 官方出口 `object-space-land` 落地成功（HEAD `9e350367`）。
- 落地后复跑判红归因（全部 not-ours）：门 315 `scripts/lib/radius-tokens.mjs` 引 `PX_WRAPPERS` 但
  `scripts/lib/length-units.mjs` 缺该导出（他席工作树）；门 318 `apps/miniapp-taro/src/pages/login/login.css:439`
  含 24px 模糊半径（他席工作树）；门 184/263/153/321 rc=2 未判定。本票 24 门记录里仅 30a rc=1。

## B 段（取证席 `o_000Vqse6sOc`，已落盘）

- `docs/benchmark-evidence/2026-11/deep-native-2026-11-23/`：README（46KB，P0 8 条六栏全文 + P1 12 + P2 24 +
  未判定总表 + 复现命令）+ block1-dsh / block2-trae / block3-qoder / block4-workbuddy（合计 44 条候选，A 档 19）。
- **该目录属他席产物，未提交、不得写入。**

## P0-1 复核结论：不采纳（本轮实证）

取证席判「未知审批档位静默折成 `on_request` = fail-open」。复核后**不成立**：
IHUI 语义里 `never` 才是恒 auto-approve（最宽松），`on_request` 是"需询问"（更严）；且既有 58 号票测试
`test_exec_policy_decision_wiring_58.py::test_unknown_policy_value_degrades_to_on_request` 已把该行为钉成契约。
按 §0.13「复现行为与设计、不盲抄」，本改动已完整回滚（`agent_engine.py` 零 diff）。真正待收敛的是
「两套档位字面量」的单一真相源（`agent_loop_v2` 三值 vs `patch_safety` 四值），属独立工单。

## P0-8 实绩（2026-11-23 晚，本票待入库）

**对照语义**：TRAE CKG 在 sqlite_vec 侧统计 `missing_vector_entity_count` /
`total_embedding_entities`。本轮只取统计与判定这一层（端侧嵌入 / 常驻守护不做）。

**落点** `apps/api/src/services/codebase-index-service.ts`（762 行既有文件，纯增益）：
- `IndexStats` 增 `missingVectorChunks` 与 `vectorCoverage`（0 切片 ⇒ 0，不拿 1 冒充完整）
- `getStats` SQL 增 `COUNT(*) FILTER (WHERE "embedding" IS NULL)`；旧列原样保留
- 新增 `auditIntegrity(repoId?, ownerUuid?)` 四态：`unjudged/owner_required`（无归属不发查询）·
  `empty/no_chunks`（0 切片不记 ok）· `degraded/missing_vectors` · `ok/complete`
- 路由 `GET /v1/codebase-search/stats` 零改动（`success(stats)` 直出，新字段向后兼容）

**验证**：新增 `apps/api/src/services/__tests__/codebase-index-integrity-audit.test.ts` **14 例**；
与既有 `codebase-index-tenant-isolation.test.ts` 合并 **2 文件全绿**；
`pnpm turbo typecheck --filter=@ihui/api` **9/9 successful**（cache 8/9）。
反向变异 3 次（无归属短路 / 空库短路 / `missing` 列改常量 0）均如期转红并恢复。

**测法假绿（顺手钉住）**：既有 `renderSql` 的 `toQuery` cfg 缺 `getColumnCasing`（drizzle 0.38 新签名），
遇 Column 抛错后被 `catch` 吞成 `"[object Object]"` ⇒ `not.toContain(...)` 长期假绿。
新测试已补齐该成员；既有文件未改（他席在飞面重叠），列入待办。

**入库（现读）**：经 §12 官方出口 `object-space-land` 落地 **HEAD `fde9dc53`**（3 文件 / 342+ / 4-；
父提交 `d126fc9a`，未丢他席任何提交）。CAS 前 4 次被并发提交挤掉，第 5 次成功；每轮预检
（水印 3/3 · 门 98 · 门 231）均通过。工作树对这三条路径零差异。

**落地后复跑归因（EXIT=1，全部 not-ours；本器明示"落地不回滚、只拒绝报绿"）**：
- 门 318 阴影：命中 `apps/miniapp-taro/src/pages/login/login.css:439`（他席在飞 24rpx 模糊半径）
- 门 212/150：`scripts/lib/radius-tokens.mjs` 引 `PX_WRAPPERS`（`length-units.mjs` 未导出，他席在飞）
- 门 298：`packages/api-client/*` 三条工作树旧档（他席 staged 面）
- 门 198：`apps/api/src/jobs/trae-models-sync.ts` 无条件覆盖形态（他席新文件）
- 门 107：`apps/web/public/pdfjs/pdf.worker.min.mjs` 登记实物不存在（存量）
- 门 184/153/321：rc=2 未判定（取不到输入，不记绿也不冒红，§0.3）
- 门 19：warn 不阻塞

## P0-6 实绩（2026-11-23 晚，本票待入库）

**对照语义**：WorkBuddy `tsbx_rules.json` 的 `%USERPROFILE%\.ssh\**` / `.gnupg\**` 读写删全 deny。

**缺口（现读）**：凭据族全是工作区相对形态，`toAclPath` 对越界绝对路径原样回落 ⇒
home 的 `.ssh/config`、`.gnupg/*`、`.aws/credentials`、`.kube/config`、`.docker/config.json`、
`.netrc`、`.pypirc` 整片漏过（`.gnupg` 全仓 0 命中）。

**落点**：`apps/cli/src/sandbox/file-access-policy.ts` 追加 8 条 home 凭据族
（`**/.ssh/**` 等，read/write deny、delete ask、enforce、credential、逐条 why），
`**/` 前置不做 home 现算（跨盘/网络盘更稳，并覆盖子目录 copy 凭据）。

**验证**：新增 `apps/cli/tests/home-credential-deny-p06.test.ts` 13 例；与既有
`acl-followup-b49.test.ts` 合并 **2 文件 32 例全绿**；`pnpm turbo typecheck --filter=ihui-cli`
8/8 successful；prettier 两文件通过。反向变异 2 次（移 `.ssh` 族 / `.gnupg` 读改 allow）
均如期转红并恢复。

**入库（现读）**：`object-space-land` 第 1 次 CAS 即成功 ⇒ **HEAD `18044ae2`**
（3 文件 / 214+；父 `08c47543`）。其后他席又推进 2 枚（`c9c38285` / `2c05e689`），
本枚仍在历史链上；三条路径工作树零差异。

## P0-5 实绩（2026-11-23 晚，本票待入库）

**真实缺口（不是"为对齐而加"）**：unified_exec 此前用纯字符串 buffer，超限保留头 4000 + 尾
16000 + 中段标记；增量读取按**旧长度** `buffer[before:]` 切。截断发生后字符串长度缩短 ⇒
`before` 落到随机位置，最坏得空串 ⇒ **这段输出被静默吞掉**，回执只写"(无新增输出)"。

**落点**：新增 `apps/ai-service/app/services/output_ring.py`（绝对偏移只增、head 不丢、
尾部滚动、read 纯函数双游标、lossy/dropped_chars、settle 四态封闭集 + first-wins）；
`agent_engine.py` unified_exec 会话改持 ring、buffer 退场；`_wait_settled` 按
`ring.total_written` 读，回执新增 `nextOffset`/`outputLossy`/`outputDroppedChars`
（lossy 时附 `outputLossyNote`）。

**验证**：`tests/test_output_ring.py` 21 例 + `tests/test_unified_exec_output_ring_wiring.py`
4 例；与既有 harness 四/八/十一批合并 **5 文件 57 例全绿**；ruff 四文件通过；
mypy --strict 新模块 0 error（存量 764 非本轮）；水印 3/3 通过。
反向变异 2 次（洞检测短路 / nextOffset 回退 before）均如期转红并恢复。

**入库（现读）**：`object-space-land` 第 1 次 CAS 即成功 ⇒ **HEAD `6f51d5c2`**
（5 文件 / 641+ / 18-；父 `a02af886`）。落地前被别席 `object-space-land` 锁挡了约 12 分钟
（20176 → 21816 两轮持有），锁空后首试即中；五条路径工作树零差异。

## 剩余（下一轮入口 + 裁决结论，2026-11-23 午后现读）

**已裁决「不本轮做」的候选（原因逐条，避免下轮重做）**：

- **B3-07 请求元数据四层 + Advisor + patches**：证据已读（`block3-qoder.md:209-232`，四层 =
  `WorkspaceMetadata` / `ContextMetadata`（含 `request_set_id`/`machine_id`）/ 另两层 + `Advisor{name,model,max_uses}`
  + `patches: map<string, ChartPatchList>` 按 `cache_id` 复用）。**需在 ai-service 请求组装链落地**
  （`agent_loop_v2.py` 巨型文件）且超越轴要求 PG 追踪表 ⇒ 单独立项，不做"只有模型没有 importer"的纸面件。

- **B2-08 ContextFS 动词面**：现读 `context_fs.py`（232 行）只做**路径解析**，动词（read/list/glob/grep/write）
  由**既有工具名**承担（`context://workspace/<rel>` 是路径别名，工具本身已能 ls/cat/grep）⇒ **已等价覆盖，
  不重复造**；只有当"虚拟 FS 需要比宿主工具更严/更快"时才值得新建动词层。

- **B1-06 race fence**：落点 `app/services/goal_round_driver.py` **在本仓不存在**（P1 表写的是建议落点），
  且 ai-service 侧没有 goal 轮次驱动 ⇒ 新建文件 + 零消费点 = §0.9「造好没装车」。需先定 goal 运行时归属。
- **B4-11 崩溃看门狗重启腿**：`worker-pool.ts::handleWorkerExit` 已确认**无重启腿**，但 worker 是**一次性任务**
  （重启 = 重复执行带副作用），本仓无常驻服务型 worker 可挂 ⇒ 与 B2-04 同因（先定承载）。
- **B4-10 lazy chunk manifest 版本防污染**：`prewarm.ts` 只有**单个状态件**（schema + 指纹 + pid），
  本仓无 preload/chunk 清单机制 ⇒ 做 manifest = 纸面件。
- **B2-11 快照只读面**：`checkpoint_rewind.py`（482 行）现读已有 4 端点，其中 **3 个 GET 只读**
  （列表 / file-versions / impact）⇒ 已等价覆盖，无需重造。
- **P0-2 反向 supervisor / P0-3 PG 注册表**：目标目录 `apps/cli/src/daemon/` 不存在，且 CLI 侧无 PG 依赖；
  两票都要求「PG 统一数据层」⇒ **需先定承载**（是 CLI 起 PG 客户端，还是注册中心放 ai-service），不应硬造。
- **P0-7 回合前上下文自检**：须碰工具结果回填流（`agent_loop_v2` 巨型文件），已判单独立项。

**仍需做（有真实缺口 + 有消费点）**：

- **B1-05 沙箱三级策略 + 会话级额外可写根**：现读 `sandbox.py`（1058 行）只有 `strict`/`relaxed` 两档 +
  **静态** `_workspace_roots()`；缺「会话侧车可写根」（注销即失效 / 续跑需重注册）。消费点明确
  （`_resolve_workdir` / `_path_within` 现成调用链），是本轮之后最值得的一枚。
- **B3-07 请求元数据四层**：现读 `base_provider.py`（181 行）`_request` 只有 provider/model，
  无 purpose / trace 层；消费点 = 四层元数据透传 OTel span（本轮 B1-11 已铺好日志/追踪双腿）。
- **P0-8 剩余两块**：代码实体 / 关系边表 + 索引配置与幂等标记 PG 化。
- **债**：`codebase-index-tenant-isolation.test.ts` 的 `renderSql` 假绿回灌（本轮刻意避他席在飞面）。
- **门缺陷债**：`[30a]` 与 history-guard 互斥（恒红无出路）；`[298]` 工作树臂扫他席旧档；
  archify `viewer/theme-state` 与模板能力冲突（建议降档，不是修模板）。

## 剩余（旧条目，保留背景）

- B 档 25 条候选逐条落地（按 README §5 索引；每条先做「降级/升档」裁决再动手）。
- P0-2 反向守护进程拓扑（独立 supervisor + IPC 握手 + 无 worker 自退）——IHUI 只有正向看门狗
  （`apps/cli/src/util/parent-bound.ts`），这是真缺口，工作量在 Rust/CLI 侧。
- ~~P0-5 终态前输出 drain 闸门~~（2026-11-23 已落地 `6f51d5c2`，见上节）。
- P0-2 反向守护进程拓扑（supervisor 不进 worker Job）——未开始。
- ~~P0-8 pgvector 索引完整性审计~~（2026-11-23 晚已落地，见上节；剩代码实体边表 + 索引配置 PG 化未启动）。
- 债：既有 `renderSql` 假绿修法回灌 `codebase-index-tenant-isolation.test.ts`（本轮刻意不改，避他席在飞面）。
- C 段：archify 交互图未做；`docs/engineering/competitive-reverse-engineering-round10-2026-11-23.md` 已入库。
- 债：门 30a 与 history-guard 互斥（30a 恒红、无出路），需修门（非本轮范围）。
- 环境：`tests/test_nonstream_approval_delivery.py::test_execute_with_session_id_delivers_and_settles_approval`
  单跑亦红（psycopg 在 ProactorEventLoop 无法连 PG）⇒ env-blocked，非代码回归；
  `test_file_search_ripgrep_v75.py` 两条要求夹具不在 C 盘，而本仓就在 C 盘 ⇒ 环境性。

**P0-4 沙箱能力三态门（2026-11-23 晚，Rust 侧首次动工，已入库 `57391e73`）**

- 取证：`sbox_sdk.dll` 8 个导出 / `vm_sdk.dll` 同型；`trae-sandbox.exe` **11 条逐字原因码**。
  README 记 12 条但只逐字列 11 ⇒ 第 12 条 `SdkNotLoaded` 按同二进制 `SDK not loaded` 错误串
  **推断**落定，`is_verbatim()` 返 false，测试钉「11 逐字 + 1 推断」，补到逐字证据时该例会红提醒改标注。
- 本仓缺口复核：`apps/desktop/src-tauri/src` 里 `hyperv|microvm|HostCompute|ALPC|security descriptor`
  零命中；隔离面只有 `terminal_session.rs`（Job Object）+ `orphan_guard.rs`，**无能力分档、无「不支持即拒」**。
- 实绩（5 文件 / 6 路径）：新增 `sandbox_sdk.rs`（`SandboxBackend` 8 方法 trait + `ProbeState` 三态 +
  12 原因码 + 4 未判定原因 + `SandboxGate` 唯一执行入口，非 Supported 时执行闭包**零调用**）；
  `terminal_session.rs` 抽出 `assign_to_job`（挂载单一真相源）+ `SessionInfo.isolation`；
  `terminal_ipc.rs` 透出 isolation；新增 `sandbox_ipc.rs`（`sandbox_capability` / `sandbox_tiers`，
  **判据的 importer**）；`lib.rs` 两个 mod + 两命令注册。
- 验证：`cargo test --lib sandbox_sdk` **9 passed**（含 Windows 真 JobObject `init` ⇒ Supported、
  真 spawn `cmd /C exit 0` ⇒ `kill_all` 清空）；`terminal_session::tests` **7 passed**；
  `cargo check --lib` **0 error**；两个新文件 `rustfmt --check` 0 diff（存量三文件本就未过 fmt，刻意不动）；
  水印 6/6 通过。
- 反向变异：M1 丢探测结果一律放行 ⇒ 3 例红；M2 挂不上假报 `job-object` ⇒ 1 例红；均还原复绿。
- 诚实边界：`SandboxGate`/`SandboxSpec` 尚无执行入口 ⇒ 模块头 `#![allow(dead_code)]` + 注释说明（不伪造接线）；
  `MicroVmBackend` 仅桩。
- 复跑红门（均 not-ours，与前三枚同批）：门 11/150/212/315（`radius-tokens.mjs` 引 `PX_WRAPPERS`
  未导出，他席在飞）、门 11h/318（`login.css`）、门 298（`packages/api-client` 三旧档，他席 staged 面）、
  门 107（pdfjs worker 登记实物缺失，存量）、门 30a（悬空 commit，判据缺陷）、门 281（worktree 全树口径）、
  门 70b（死 i18n key 351）、门 184/153/321（rc=2 未判定）。
- 落地：`object-space-land` **第 1 次 CAS 即中**，HEAD `57391e737129f18b692f4c6f11ef81c7a1c45bdb`（父 `24b352b88`）。

**B2-03 Rust 输出 drain 闸门（2026-11-23 夜，P1 首项，已入库 `4f7de183`）**

- 真缺陷：`terminal_session.rs::poll` 里 `try_wait` 一返回 `Some(status)` 就 `set_state(Exited)`，
  但两个读线程可能还在把最后一段写进环 ⇒ 「终态」与「最后一段到达」之间有窗口，
  调用方此刻 `read_out` 拿到**半截输出**且无任何标记。与 P0-5（Python 侧）同型。
- 实绩（2 文件）：`spawn_reader` 增 `active: Arc<AtomicUsize>`（进线程 +1、EOF/断管 -1）；
  新增 `DrainOutcome` 四态 + `drain_settlement(readers_active, waited, pipe_available)` 纯判据
  （优先级 **没管道 > 还有读者 > 超时 > 完成**，防止「两路都 None」被误判 `complete`）；
  `poll` 在 `draining` 时**保持 Running**，结算后才落 `Exited`；`DRAIN_TIMEOUT_MS = 2000`；
  `SessionInfo.output_drain` + `SessionWire.output_drain` 透出。
- 验证：`terminal_session::tests` **10 passed**（含 Windows 真进程 e2e：`cmd /C "echo hello-drain & exit 0"`
  ⇒ 终态后 `read_out` 必含 `hello-drain` 且 `output_drain == complete`）；`sandbox_sdk` 仍 9 passed；
  `cargo check --lib` 0 error；水印 verify 2/2 完整。
- 变异：M1 `drain_settlement` 一律 Complete ⇒ 判据用例红；M2 `is_settled` 对 Draining 返 true ⇒ 码表用例红；均还原复绿。
- 零缺省：七态语义不动，仅多一个「输出完整性」维度；既有 `poll` 调用方最多多几毫秒 `Running`。

**B4-02 子进程 env 白名单通道（2026-11-23 夜，P1 第二项，已入库 `276aa2cd`）**

- 缺口：`env-guard.ts` 是黑名单语义（自述「未登记默认放行」）；新增 `env-channel.ts` 补**相反那条腿**：
  宿主键只给必需集（Windows 25 / POSIX 11），未登记默认不进；会话键宿主侧一律隔离；
  疑似凭据名拦；`dropped` 只记键名+原因**不回传值**。extras 为显式授权通道（先凭据后隔离的顺序是关键）。
- 接线：`hooks/index.ts` 两处 spawn（webhook 子进程 / 外部 hook 命令）从 `buildFilteredEnv`（黑名单）
  换成 `buildChildEnv`（白名单）—— hook 是外部脚本，最不该看到会话键与模型凭据。
- 测试：`env-channel-b4-02.test.ts` **13 例**；hooks 面 **7 文件 106 例** 全绿；prettier 通过；水印 2/2。
- 两处真实回归（已修并钉住）：①extras 也拦会话键 ⇒ `hooks-extended` 的 sessionId 用例转红
  （hook 上下文靠显式通道）；②`_TOKEN` 用 includes 判 ⇒ `IHUI_COMPACTED_TOKENS_BEFORE` 被误杀，改后缀判定。
- 变异：M1 未登记放行 ⇒ 2 例红；M2 凭据不拦 ⇒ 4 例红；均还原复绿。
- 边界：hook 属受信脚本故 extras 放宽会话键；第三方插件子进程应传空 extras（未在本轮）。

**B1-11 OTel 日志通道（第 14 枚，已入库 `ec781c0a`，4 文件 / 450+）**

- 缺口：`telemetry.py`（199 行）只有 traces 一条腿（`/v1/traces`），无 logs 通道、无批大小/字节界。
- 实绩：新增 `otel_log_channels.py`（三界 64 条 / 32KB / 10s + `build_batch` 先到界者停、
  超界全部入 `dropped_records`/`dropped_bytes`（UTF-8 实算）+ `should_flush` 非法输入不 flush +
  `LogChannel` 失败清空待发区且绝不抛 + 四态 enabled/saturated/unjudged/disabled）；
  `telemetry.py` 另建 `/v1/logs` 的 `LoggerProvider + BatchLogRecordProcessor(OTLPLogExporter)`，
  建不起来只降级 `unjudged(<异常类>)`；新增 `telemetry_channel_states()`；`shutdown_telemetry` 先刷日志再关 trace。
- 验证：`test_otel_log_channels.py` **14 例**；合并四个既有 telemetry 测试 **227 例**绿；ruff 0（自动修 2 处 import 排序）；
  `mypy --strict` 两文件 0 error（存量 775 全在别文件）。
- 落地：`object-space-land` 首试即中，HEAD `ec781c0a`（父 `d4f3d4bd`）；复跑红门同批（门 318 三条全他席 `0459da81` + rc=2 184/263/153/321 + 门 19 warn）。

**B3-04 提交内存余量预判（第 15 枚，已入库 `687c0409`，4 文件 / 12+ / 1-）**

- 缺口：本仓起大任务前无「这台机器撑不撑得住」的读数。
- 实绩：新增 `system_memory.rs`（`MemoryReading` 四字段 + 四态 + `classify_pressure` 纯判据 +
  `probe_pressure` 唯一入口 + `read_memory`（Windows `GlobalMemoryStatusEx`，非 Windows 恒 None））；
  `Cargo.toml` 补 `Win32_System_SystemInformation`（同版本 windows 0.61 不添副本）；
  `lib.rs` 接 `system_memory_pressure(requested_bytes)`。
- 判据：取不到/提交上限读成 0 ⇒ unjudged 点名；请求超余量直接 critical；分档看**扣掉请求后**余量占比
  （<15% tight、<5% critical）；减法不下溢（requested==avail ⇒ critical 非 panic）。
- 验证：**8 例**绿（含**真机四字段读面**实跑 `GlobalMemoryStatusEx`）；全 lib `516 passed / 1 failed`，
  失败例 = `auto_refresh::tests::常驻循环前必须串上准入闸且离线兜底仍在其前` **存量红**
  （HEAD 版 `auto_refresh.rs` 本身 2 处 `loop {`、该文件工作树零差异 ⇒ not-ours）。
- 落地：HEAD `687c0409`（父 `2f31bcd0`）；复跑红门同批（门 318 三条他席 + rc=2 184/153/321 + 门 19）。

**B4-03 自举 runner 编译态/源码态单源判据（第 16 枚，已入库 `9e4dfe9e`，5 文件）**

- 病灶（现读）：`proxy-relay-host.ts` 早有 `--import tsx` 加载器且注释称"唯一一份"；
  `parent-bound.ts` **零形态判定**，源码态 `spawn(node, ['x.ts'])` 必失败且被 `runner.on('error', () => {})` 静默吞掉
  ⇒ **看门狗在源码/tsx 态从未真正拉起过，账面看不出来**。
- 实绩：新增 `apps/cli/src/util/run-mode.ts`（形态三态 + `isNodeExecutable`（SEA/打包器拒当解释器）+
  `stripTypesSupported`（22.6+，解析失败 false）+ `canImportTsx`（createRequire 零副作用）+
  `planSelfRunner`（compiled 直跑 / source 先 tsx 再 `--experimental-strip-types` / 双缺 ⇒ ok:false 点名））；
  接线 `parent-bound.ts`（先 plan 再 spawn，!ok ⇒ return null）与 `proxy-relay-host.ts` **runner + probe 两条腿**。
- 验证：`run-mode-b4-03.test.ts` **13 例**（含两处接线回潮闸：`[modulePath, RUNNER_FLAG` 清零、
  `planSelfRunner` 恰两次、旧 `[...loader, modulePath` 清零）；与 `parent-bound.test.ts`(12)、
  `egress-relay.test.ts`(10) 合并 **35 例**绿；`pnpm turbo typecheck --filter=ihui-cli` **8/8**；prettier 四文件通过。
- 一次真实回归：首版把 plan 块放在 `payload` 定义前 ⇒ `TS2448/TS2454`（行为测试全绿、类型检查红）——
  与 P0-4 那次「`_PreGate` 字段序」同类：**行为测试挡不住声明顺序错**；已按 identity → payload → plan → spawn 重排。
- 落地：HEAD `9e4dfe9e`（父 `038825d1`，本器日志明示「第 1 次 CAS 成功」）。

**B1-05 会话附加目录接入 sandbox workdir 收敛（第 17 枚，已入库 `2364f996`，4 文件）**

- **复核结论（先说不重造什么）**：会话附加目录本仓早已存在 —— `mcp_server._SESSION_EXTRA_ROOTS`
  是 `BoundedTtlDict`（6h TTL / 5000 键上限 / `(主体,会话)` 复合键 / 系统根与伪文件系统拒 /
  ContextVar 注入 handler await 链）。本轮**不重造注册表**（§0.6 / §0.22c）。
- **真正的缺口（一致性缺陷）**：`_validate_path_in_workspace`（local cwd 校验）兜底查 ContextVar ⇒ **认**；
  `sandbox.py::_resolve_workdir` 只认静态 `MCP_WORKSPACE_ROOTS` ⇒ **不认**。
  同一会话 `add_directories` 后，local 后端放行、docker/ssh 后端拒绝 —— 用户看到"功能随机失效"。
- 实绩：`sandbox.py` 新增 `_merge_writable_roots`（唯一合并口径：去重 / 静态在前 / 空项剔除）+
  `_resolve_workdir(..., extra_roots=None)` + `execute(*, extra_writable_roots=None)`（keyword-only 追加）
  + `_execute_local(..., extra_roots=None)` 透传；`mcp_server.py` 非 local 分支补
  `extra_writable_roots=list(_active_extra_roots()) or None`（+3 行）。
- 验证：`test_sandbox_session_roots_b105.py` **10 例**（无附加集拒（文案点出"会话附加目录"）/
  有附加集放行 / **只扩不收** / 附加集外仍拒 / relaxed 不受影响 / 空集逐字等价 / 合并去重 / 空输入 /
  **端到端 local 真跑 `echo`**：传附加根 exit 0、不传 `SandboxError` / 接线回潮闸）；
  与 sandbox 七个受影响面合并 **298 例**绿；ruff 0；`mypy --strict` `sandbox.py` 0 error。
- 落地：`object-space-land` **第 1 次 CAS 成功**，HEAD `2364f996`（父 `c721f968`）。
- 边界：注册表仍归 mcp_server；只接 `run_command` 非 local 分支；modal/daytona/singularity 的 workdir
  由各后端解释，本层只保证传入前判据一致。

## P0-8 第二批实绩（已入库 `acdb8d73`，7 路径）

- schema 三表：`codebase_entities` / `codebase_edges` / `codebase_index_states`（唯一索引 `owner_uuid+repo_id`，
  状态表 `owner_uuid NOT NULL`）；迁移 `20261123151500_codebase_entity_edge_state.sql`（全 `IF NOT EXISTS`）；
  journal 追加 idx 448（转 LF 避免整文件行尾重写）。
- 服务层：`CODE_INDEX_CONFIG_FINGERPRINT_DEFAULT` / `resolveIndexConfigFingerprint` / `IndexStateSnapshot` /
  `RebuildDecision` / `needsRebuild`（判序 没状态 > 配置变 > 过期 > 可复用；时钟倒挂按 stale；窗口边界闭；
  `maxAgeMs<=0` 不判时间）/ `getIndexState`（无归属零 DB 调用）/ `markIndexed`（空 ownerUuid 或空指纹**写前抛错**，
  `onConflictDoUpdate` 幂等）/ `indexChunks` 末尾 best-effort 标记（失败只 warn 不影响索引结果）。
- 测试 `codebase-index-entity-state.test.ts` **13 例**（与首批 14 合并 **27 例绿**）；`pnpm turbo typecheck
  --filter=@ihui/api --filter=@ihui/database` **10/10**；`check-migration-from-zero.mjs --skip-full` **PASS**
  （449/449 逐条应用成功、schema diff 双向为空（4 处 `KNOWN_SCHEMA_HOLES` 既有基线）、改写件 13/13）；
  `check-drizzle-journal-sync.mjs` 现读 `state=ok entries=449 sqlFiles=449 problems=0`。
- **一次真实回归**：`REPO_ROOT` 上溯 4 层算成 `apps/`（应 5 层）⇒ 3 例源码扫描 ENOENT。
- **顺手根治存量漂移**：journal 的 `20260928050000_lessons_difficulty` 条目对应 `.sql` 在 `4fa6b2cf`
  快照里丢失 ⇒ `check-drizzle-journal-sync` 常红（`journalOnly=1`）、按链建库缺 `lessons.difficulty`。
  按 schema（`learn.ts:71`）反推补齐同名迁移（`ADD COLUMN IF NOT EXISTS varchar(20)` + 列注释，幂等）⇒
  落地后该门 **state=ok entries=449 sqlFiles=449 problems=0**。
- 落地：`object-space-land` 第 1 次 CAS 成功（父 `8ee6291a`）；7/7 路径水印预检通过、跳门留痕 `kind=bypass-landing`。
- 边界：实体/边**无任何写入点、无消费方**（骨架未通电）；`needsRebuild`/`getIndexState` 仅测试消费方。

- **门 30a 处置（2026-11-23 现读修正）**：此前记作「与 history-guard 互斥、恒红无出路」**不成立** ——
  直跑 `check-commit-loss-guard.mjs` 现读 `exit 0`（14 枚悬空 commit 落「30 天窗内」报数档）。
  真缺陷在**建议文案**：它教人 `git tag lost-commit/<name> <hash>` 备份，而该动作被
  `.husky/reference-transaction` 的 prepared 阶段硬禁（用户 2026-11-22「本仓从今天起不保留历史」定案；
  引用事务钩子 `--no-verify` 也绕不过）⇒ 已改成政策下可执行的三条（`git cherry-pick <hash>` 拾回 /
  `git show <hash>` 查看 / 确认丢弃即无须处置），并把「已备份即放行」分支在本仓恒假的现状写进脚本注释。
  验证：`scripts/tests/check-commit-loss-guard.test.mjs` **86/86**、`-hint.test.mjs` **6/6**、现读 `exit 0`。

## 动态读数（当次现读）

- 本票提交 `9e350367` 已在历史；其后他席又推进（当次 HEAD `55aae297`）。
- 工作树仍有他席 staged 的 README 四语与一批派生件；`scripts/lib/length-units.mjs`、`login.css` 为他席在飞改动。

- round: 1 / max_rounds: 20
- started: 2026-11-23

## P0-8 第三批（已落地 dc0526c8，2026-11-23 17:5x）

- 实体写入通道通电：`deriveEntitiesFromChunks`（纯函数，身份键 `${filePath}|${kind}|${name}`，行区间 min..max，
  无 symbolName 跳过，kind 缺省 'symbol'，按 filePath/lineStart/name 排序）+ `indexChunks` 同事务写
  （每个 filePath 先删 chunks 再删 entities，插切片后按 BATCH_SIZE=100 分批插实体，返回 entities 计数）。
- 三删除面同步删实体（`deleteByRepo` / `deleteByFileScoped` / `deleteByFiles`），返回 chunk 删除数语义不变。
- 另立 `_entityOwnerScope`（`_ownerScope` 绑切片表 expires_at，实体表无该列）；文件内出现 5 次，测试按计数断言。
- 测试 `codebase-index-entity-write.test.ts` 14 例；三批合跑 41 例绿；tsc 0；落地提交 dc0526c8（3 文件 +356/-5，父 65f76d81）。

## P0-8 第四批（在飞，2026-11-23 18:0x）

- 实体读面：`findEntities`（无归属零 DB 调用；name/kind/filePath 一律 eq；limit 夹 [1,200]、默认 50）；
  端点 `GET /api/v1/codebase/repo/:repoId/entities`（limit 显式解析，非法 400）。
- Python 消费方：`knowledge_fs.list_symbols` + `GET /ai/knowledge-fs/symbols`；空集三因三分
  （path_missing / catalog_missing / upstream_unavailable），每条定义同时给 vpath 便于直接 read。
- 测试：API `codebase-index-entity-read.test.ts` 9 例；Python `test_knowledge_fs_symbols.py` 12 例（+既有 20 → 32 绿）。
- 未做：edges 仍无写入通道；list_symbols 尚无 mcp 工具面入口；needsRebuild 仍无生产消费方。
## P0-8 第四批（已落地 48757f23，2026-11-23 18:2x）

- entity 读面 `findEntities` + `GET /api/v1/codebase/repo/:repoId/entities`；knowledge_fs.list_symbols + `GET /ai/knowledge-fs/symbols`。
- 空集三因三分：path_missing / catalog_missing / upstream_unavailable。
- 测试：API 9 例、Python 12 例（+既有 20 → 32 绿）、tsc 全库 0 错误。
- 落地 7 文件 +541/−0。

## P0-8 第五批（在飞）

- MCP 工具 `list_symbol_definitions`：name/path/repo_id/limit，身份只认 `__user_id`，
  repo_id 缺省按 path 用 `_default_repo_id` 推导（与 index_codebase 同源）；空集 detail 原委透传。
- 测试 9 例绿；mcp_registry/deferral/guards/capability_gate 105 例绿；mcp_server+protocol 265 例绿。
- 改动面 mcp_server.py +87/−0；md 第 27 节 +38/−0。
- 仍未做：edges 写入通道；index-state 端点与 needsRebuild 生产消费方；list_symbol_definitions 在客户端清单可见性依赖 aggregator/deferral。
## 第五批落地（b94ff88a，2026-11-23 18:5x）

- MCP 工具 `list_symbol_definitions` 已入库：mcp_server.py +87、新测试 131 行、md 第 27 节 +38。
- 本轮三枚：dc0526c8（第三批 实体写入同事务）/ 48757f23（第四批 读面+符号视图 +541）/ b94ff88a（第五批 工具面 +256）。
- 全仓 API tsc 现读 0 错误；P0-8 五批测试合计：实体写 14 + 状态 13 + 完整性 14 + 读面 9 + py 符号 12 + mcp 工具 9。
- 落地通道：object-space-land 三枚均成功；复跑红全落他席面（门 315 radius-tokens PX_WRAPPERS、门 318 阴影 3 处、门 184/263/153/321 rc=2）。
- 仍未做（下一轮候选）：edges 写入通道（需切片器带 import）；index-state 端点与 needsRebuild 生产消费方；list_symbol_definitions 在客户端首屏清单的可见性（依赖 aggregator/deferral）。
## P0-8 第六批（已完成，待随第七批一并落地 2026-11-23 19:2x）

- `evaluateRebuild` 纯函数：把「读状态→取指纹→判档」收一处，缺省 maxAgeMs=0（不按时间判过期），
  无归属走 getIndexState 零 DB ⇒ `rebuild-no-state`。
- 端点 `GET /api/v1/codebase/repo/:repoId/index-state`（maxAgeMs NaN/负 ⇒ 400「maxAgeMs 必须是非负整数」）。
- Python `knowledge_fs.index_state`（缺 decision 字段 ⇒ upstream_unavailable，空串不冒充 reuse-fresh）；
  `list_symbols` 的 catalog_missing 分支只在该支多发一次请求做富化，取不到标未判定且不改三因三分结论。
- 测试：API 9 例（codebase-index-state-read.test.ts）、Python 11 例（test_knowledge_fs_index_state.py）。

## P0-8 第七批（已完成，待落地 2026-11-23 19:2x）

- `deriveEdgesFromImports` 纯函数：fromName 取 filePath 本身（不取 basename，避免 a/index.ts 与 b/index.ts 撞名）；
  toName 取 import 名字原文（不解析目标文件，假装解析会产出错误边）；line 须正整数；去重键 (filePath,name,line)。
- `indexChunks(repoId, chunks, ownerUuid?, retentionDays?, imports?)`：边与切片同一事务先删后插，
  清除面 `clearFilePaths = 切片文件 ∪ 边文件`（纯声明文件也要换新）；返回 `{indexed,vectorized,localEmbedded,entities,edges}`。
- `_edgeOwnerScope` 独立谓词（边表无过期列，复用切片谓词会拼出指错表的列对象）。
- 三处删除方法（deleteByRepo / deleteByFileScoped / deleteByFiles）同步删边。
- 路由 `indexSchema.imports` `.max(20000)`；indexChunks 第 4 位 undefined、第 5 位 b.imports。
- Python：`collect_import_edges(root, rel_paths)` 复用 `core.code_symbol_graph.index_code` 单源（不新写正则）；
  `_write_to_api(..., *, root)` 整仓档传 root 上传 imports，单文件档刻意不传（其 file_path 是 basename）。
- 测试：API 14 例（codebase-index-edge-write.test.ts）、Python 6 例（test_codebase_indexer_import_edges.py）。
- 顺手修两处脆断言：journal「末条」→「在册」；`_entityOwnerScope` 精确计数 → 下界；第七批删除面从 2 次 delete → 3 次。
- 已知边界：TS 风格 `import {x} from 'm'` 不匹配既有正则（测试里钉成事实）；边尚无读消费方。
- 验证：API 6 文件 73 例绿、全库 tsc 0 错误、ai-service 5 文件 37 例绿、prettier 全绿、水印 11/11。
## P0-8 第八批（已完成，待落地 2026-11-23 19:4x）

- api `findEdges`（四等值过滤 + limit 夹取 [1,200] + 排序三元组 + 无归属零 DB）；
  `GET /repo/:repoId/edges`（limit 显式解析 400 / 无身份 401 / 失败 500 独立文案）。
- py `knowledge_fs.list_imports`（direction=from|to 两档不猜；空集三档 path_missing /
  catalog_missing（detail 必须点明 TS/JS 不产边）/ upstream_unavailable）+ `GET /ai/knowledge-fs/imports`。
- mcp `find_import_edges`（target+direction+repo_id?/path?/limit?；身份只认 __user_id；
  repo_id 缺省按 path 用 _default_repo_id 推导；四条拒绝路径断言零副作用）。
- 测试：api 8 例、py 9 例、mcp 13 例；MCP 注册与护栏既有 293 例绿（含工具数双射）；py 组 52 例绿。
- 待落地：8 路径（service/route/3 测试 + knowledge_fs/route/mcp_server/2 测试 + md 第 30 节）。
- 待办：find_import_edges 在客户端清单可见性（aggregator/deferral）；边表"被引用计数"聚合无据不造。
## 第六批入库（bab77067，2026-11-23 20:0x）

- 提交标题「feat(codebase): 索引状态判据读面与知识FS消费(P0-8 第六批)」,9 文件 +551/−5。
- 含 knowledge_fs.py(+80)、test_knowledge_fs_index_state.py(139)、test_knowledge_fs_symbols.py(+54)、
  v1-codebase-search.ts(+29)、codebase-index-entity-state.test.ts(3/−1)、codebase-index-entity-write.test.ts(7/−1)、
  codebase-index-state-read.test.ts(160)、codebase-index-service.ts(+36)、md 第 28 节(+48)。
- 教训：落地排队窗口极长（本机同时 3-4 个 land 实例互撞，单轮 20-25 分钟）；基线 CAS 会随他席提交漂移 ⇒
  落地必须带"等锁空闲 + 现读 HEAD + exit 1 自动重试"的自愈循环。
## 第七八批 + B3-03 入库（2026-11-23 20:2x）

- P0-8 第七批（导入边写入通道）：`deriveEdgesFromImports` 纯函数 + `indexChunks` 第五参 `imports`
  同事务 + 清除面「切片文件 ∪ 边文件」并集 + 三处删除面同步删边 + Python `collect_import_edges(root=)`
  （单源复用 `code_symbol_graph`，单文件索引档刻意不传 root）。
- P0-8 第八批（边读面 + MCP）：`findEdges` 四等值过滤 + `_clampLimit` 单源 + `GET /repo/:repoId/edges`
  + `knowledge_fs.list_imports` 两档方向不猜 + MCP `find_import_edges`（四条拒绝路径零副作用）。
- 合并落地 `c7f5dda8`（13 文件 +1187/−15），2 次 CAS 成功，通道仍是 `object-space-land`
  （`LAND_BLOBS` 清单模式 + 等锁 600s + 现读 HEAD）。
- B3-03 契约 `ce18ffb2`：`apps/cli/src/commands/collab/identity.ts` + `exit-codes.ts`
  + `tests/collab-identity-contract.test.ts`(33 例) + `subagent-collab.ts` 四处生产入口接线
  （dispatchTask / spawnParallel / arbitrateConflict / visualizeTopology）。
- **重要教训（文档是热区）**：他席每落一票就改第 24 表（16→17→18→19 条滚动），
  文档与代码**不能同批落地**——第 29/30 节曾被他人连工作树一起提交带入库（`6921d40a`）；
  本次第 31/32 节改为**单路径、落地前一刻**基于最新 HEAD 追加 + `hash-object` 重算。
- 另一个教训：`IHUI_LAND_SINGLE_INSTANCE_WAIT_MS=0` 快重试只适合"锁长期被他人持"的场景；
  锁空闲时应设大等待值一次抢成，避免多实例自撞写入同一日志。
## P0-8 第九批：边表过期语义对齐（`62954013`）

- 六处改动（schema `expiresAt` + 迁移不回填 + 写入带 `expiresAt` + 读面谓词过期过滤 +
  `purgeExpired` 增补边表分批删除 + 路由 `retentionDays` 开口）：缺一处就回到"幽灵边"。
- 为什么不回填存量：回填等于编造保留期，与"不造无据指标"同一纪律。
- 测试：`codebase-index-edge-write.test.ts` 新增 5 例；`purgeExpired` 用例从"按调用次数计数"
  改为"按渲染 SQL 文本分流"（多扫一张表会被误判成切片腿多跑一轮）。六文件 73 例绿。
- **主文档第 33 节未落**：他席在同一分钟连落 `9ff8f4e6`（24.4 归零）与 `527ae085`（24.1 指针），
  我方 blob 每轮都滞后；按"失效方向=多拒一次"放弃本次文档落地，全文留
  `.ihui-agent/tmp/round10-sec33.md`，代码侧记录以本提交 message 为准。

## 本轮收口：44 条候选全部有处置

- 他席 `9ff8f4e6` 宣告 24.4 待开发归零：B2-02/B2-07/B3-01/B3-07/B3-08/B3-09/B4-05/B4-07
  八条全部落地，并在 24.5/24.7 如实登记边界（Rust 未编译 / PG 未真连 / host 未构建 /
  更新安装未触发 / RTC 非完整 WebRTC）。
- 账：我这侧 27 条 + 他席 2 条（B1-08/B4-09）+ 不采纳 10 + 已有等价 5 + 收口 8 = 44。
- P0-8 三条遗留现状：② 边表过期列已补（第九批）；③ `find_import_edges` 未进
  `tool_surface_budget.py` 的 `priority_prefixes`（首屏可被裁掉，属可见性而非缺陷）；
  ① 无调度器按 `evaluateRebuild` 自动重建（产品决策，未获授权不默认）。

## 2026-11-23 22:00-23:25 「都要解决完成」两条收口

### ① archify `viewer/theme-state` 恒红 —— 已真解决（不是降档保留）
成因：`bin/visual-check.mjs` L1697 把主题塞进 URL query，L1875 只 `getAttribute('data-theme')`
**读属性不设属性**，而模板页头写死 `data-theme="dark"` ⇒ 请求 light 读到的仍是 dark ⇒ 恒红。
修法：模板（`.ihui/skills/archify/assets/template.html`）在 `<meta viewport>` 后插同步脚本，
只认 `light|dark` 两个白名单值才 `setAttribute`（不拿 URL 当任意属性注入口），head 顶部同步执行免首帧跳变。
重跑 `archify.mjs finalize ... --out-dir review-1 --quality showcase --json` ⇒
`status:"pass"`、四门 `validate/deliver/check/browser-check` 全 pass、diagnostics 0；
产物 `seven-landings.html` 101132 字节 / sha256 `2a84b6b4…`，receipt 在 `review-1/`。
注意 `update.noticeRequired:true`（3.2.0→3.3.0），须在最终回复保留一条紧凑提示、不主动安装。

### ② P0-8 遗留① 自动重建 —— 三层闭合（不是"留个产品决策"）
- 第十批 `3759cc5a`：`judgeRebuildCandidates` 纯判据 + `GET /rebuild-candidates`（13 例）。
- 第十二批 `684f8cad`：`codebase_repos` 表（`repoId` 是 hash 不可逆 ⇒ 必须有 `localPath` 登记面）
  + 迁移 `20261123210000_codebase_repos.sql` + journal idx=453 + `registerRepoPath`/`listRepoPaths`/
  `forgetRepoPath` + `GET /repos` / `PUT /repos/:repoId/path` / `DELETE /repos/:repoId/path`（8 例）。
  清单项现带 `localPath`（未登记为 null），服务层拼、纯判据不读 DB。
- 第十三批 `8013104f`：`codebase_auto_rebuild.py` 调度层 —— `auto_rebuild_enabled`（**只认白名单真值**，
  `enable`/`2` 一律关）、`auto_rebuild_limit`（解析失败回落 3、天花板 10）、`plan_auto_rebuild`
  （保持服务端决策序、未登记路径**点名跳过**、超限**标记不丢弃**）、`run_auto_rebuild`
  （单仓失败降级成一行不炸整轮）、`auto_rebuild_if_enabled`（关时返回 skipped+reason，不留空白）(28 例)。
  缺省关闭理由：整仓索引真花 embedding，能自己花钱的自动化默认必须关；开=`CODEBASE_AUTO_REBUILD=1`。

### 本轮入库（我方 8 枚 + 他席代提交 1 枚）
`c7f5dda8`(P0-8 七八批) / `ce18ffb2`(B3-03，他席代提交我方工作树) / `964bff08`(文档 31/32) /
`62954013`(九批) / `ed30e683`(遗留③) / `3759cc5a`(十批) / `5a84c4ee`(第十一批，他席代提交) /
`684f8cad`(十二批) / `8013104f`(十三批)。

### 落地通道实况（下次续做必须照此办）
- 唯一出口 `node scripts/object-space-land.mjs`；`LAND_BLOBS` 清单 + `LAND_BLOB_PROOF` **两样都必填**
  （缺 proof 直接 exit 2）。
- 本机 3–4 个 land 实例共用一把锁，他席 5–8 分钟落一枚 ⇒ 我方常 `skipped-held`。
  **判僵死**：读 `meta.json` 的 pid → 两次采样 CPU 与子进程数（12s 间隔）→
  CPU 不动且 `kids=0` 才可 `Stop-Process -Force` + 删锁目录；`kids=1` 且 CPU 在涨 = 正在落地，**不可杀**。
  本轮杀过一个 `cpu 0.8s / kids=1 / HEAD 已前进` 的僵死 36092，之后立即落地成功。
- 落成后若报「落地后受影响判据复跑判红」，先看是不是**他席在飞文件**导致
  （本轮 16 臂红全部来自他席 350 unstaged/14 untracked；举证 `git status | grep 我的文件` 为空即非我方）。
- 第十三批那次 `LAND_RC=1` 属这一类：提交已在 `8013104f`，不回滚、不报绿。

### 2026-11-24 00:20-00:55 archify 3.3.0 升级 + Windows browser-check 根治（已入库 `a0855704`，已推送）

**根因（源码级对比，非猜测）**：3.3.0 相对 3.2.0 单方面删掉了四处 Windows 专属适配，
四处缺任一都会让 `finalize` 的第四门 `browser-check` 红：

| 适配点 | 3.2.0 | 3.3.0 |
|---|---|---|
| `node:child_process` import | `{ spawn, spawnSync }` | 只有 `spawn` |
| `windowsProfileHolderPids()` | 有（pwsh + Get-CimInstance 按命令行里的 profile 路径反查 chrome.exe） | 删了 |
| `releaseWindowsProfileHolders()` | 有（逐个 `taskkill /PID <pid> /T /F`） | 删了 |
| 两轮 SIGTERM/SIGKILL 都失败后 | win32 不抛错：`taskkill /T /F` 杀整棵树 → `releasePipes()` → `waitExit(2000)` | **直接 `throw ARCHIFY_TEMP_CLEANUP`** |
| `cleanup()` 签名 | `cleanup({ retries = 3, delayMs } = {})`，win32 传 `retries:20` + 递增 delay（总窗口 7-8s） | `cleanup()` 无参，硬编码 `attempt < 3`（总窗口 ~600ms） |

机制：Chrome 是多进程（browser + renderer + gpu + utility），Node 在 win32 上 `child.kill()`
最终落到 `TerminateProcess`，**只终止被 spawn 的主进程**，渲染子进程仍握着 `--user-data-dir`
里的文件句柄 ⇒ `fs.rmSync(maxRetries:0)` 撞 `EBUSY/EPERM` ⇒ 3.3.0 的 600ms 窗口必然耗尽 ⇒
`ARCHIFY_TEMP_CLEANUP` ⇒ 上层翻成 `viewer/temp-cleanup-incomplete` ⇒ 四门第三红。

**修法（打在 3.3.0 上，不是回滚）**——两文件三处补丁，全部带 `补丁(IHUI-AI 2026-11-24)` 注释：
1. `renderers/shared/owned-temp-directory.mjs`：`cleanup()` 恢复参数化 `{ retries, delayMs }`
   （默认仍 3 次，调用方可放大）。
2. `bin/visual-check.mjs`：import 补 `spawnSync`；在 `export class ChromeVisualBrowser` 前插回
   `windowsProfileHolderPids` + `releaseWindowsProfileHolders`；`finishClose()` 内补 `waitExit` /
   `releasePipes` 两个闭包 + win32 分支（`taskkill /T /F` → `releasePipes()` → `await waitExit(2000)`，
   非 win32 保持原 `throw`）+ 收尾 `releaseWindowsProfileHolders(profilePath)` 与
   `cleanup(win32 ? { retries:20, delayMs:min(500,200*(attempt+1)) } : undefined)`。
3. `assets/template.html`：3.3.0 官方**已内建** `?theme=` 读取（L17 与 L6995 两处），
   3.2.0 上那 +14 行旧补丁在升级中自然被覆盖，无需保留。

**验证（同机同 candidate 对照）**：3.3.0 原版连跑三次全红（`review-3/4/5`）；
补丁后连跑**两次全绿**（`review-7` 9.3s、`review-8` 7.9s），四门 validate/deliver/check/browser-check
全 pass，`diagnostics: []`，`browserCheck{requested:true,ran:true}`，
artifact 941483B / sha `9160cd19…`，`update.status: current`（installedVersion=3.3.0）。
3.2.0 的历史绿基线是 artifact 101132B / sha `2a84b6b4…`（产物本身不同，属 3.3.0 能力扩展所致，非回归）。

**落地通道补充（本文上面那段要按此更正）**：
- `LAND_BLOBS` + `LAND_BLOB_PROOF` 是 **blob 模式**的要求；**工作树模式**只给 `LAND_PATHS` 即可
  （本轮 432 条路径就是这样落的）。路径清单**必须从磁盘枚举**、不能从 `git status` 取——
  后者对未跟踪目录折叠成一条 `?? dir/`，会漏掉上百个文件。
- 与基线**逐字节相同**的路径必须从 `LAND_PATHS` 剔除（本器拒绝"声明了但没变"的路径；
  本轮 16 条：LICENSE/LICENSE-MIT/package-lock.json/4 个 examples json/vendor LICENSE 等）。
- **锁僵死判据修正**：`kids=1` 且 CPU 不涨也是僵死（本轮 pid 2148 持有 20.7 分钟，
  CPU 冻在 1s、子进程 `land-gate-rerun-worker.mjs` 也冻在 1.55s），杀掉清锁后立即成功。
- 三处需显式留痕的放行旗本轮全用了：`LAND_ALLOW_STALE=1`（官方包精简 `package.json` scripts 8 条 +
  删除对应脚本）、`IHUI_LAND_SKIP_WATERMARK=1`（上游 vendored 包，注入本地零宽载荷会破坏
  `artifact.sha256` 与后续升级 diff）、`IHUI_LAND_SKIP_DANGLING_GATE=1`（10 处全指向
  `vendor/{typescript,deps}.cjs`，`module.exports` 非字面量属 CJS 技术特性）。
- **遗留（下次该做的正事）**：archify 应登记为 vendored 第三方根，让水印预检与 D1 悬空导入
  判据**结构性豁免**这一个目录，而不是每次升级都靠三个 skip 旗。

### 2026-11-24 00:55-01:40 archify 登记为第三方来源根（承接上一段遗留，本轮已做完）

**不是新造机制 —— 本仓本来就有一档，我用它。** `watermark.mjs` 头注原文写着"**减去**来源台账
已登记的第三方内容(`config/third-party-provenance/*.json` 的 roots,经 `scripts/lib/third-party-roots.mjs`
单点解析)。横幅是归属主张,**不得打到第三方作品上**"。所以正解是**登记**，不是加跳门。

**改动三处（判据单源，零新增清单）**：
1. `config/third-party-provenance/copied.json` 新增条目 `archify-skill-v3.3.0-bundle`，
   `roots: [".ihui/skills/archify"]`（整目录，`coveredByRoots` 的 `rel.startsWith(r+'/')` 分支覆盖全部子路径），
   `modification: modified-copy`（如实写两处补丁落点）、`license.texts[0]` 用 `inRepo` 形态指向
   `.ihui/skills/archify/LICENSE`（sha256 `cfc7749b…` / 11358 字节，P3 内容寻址自证）。
2. `check-dangling-local-imports.mjs` 的 `auditOneFace(rev, shadowCtx, thirdParty = null)` 加第三参数：
   缺省 `null` = **不过滤**（`--self-test` 与锚点历史面对照跑旧行为，既有断言一字不变）；主流程传
   `createExclusionPredicate(ROOT)` 并把被排除枚数由返回值 `thirdPartySkipped` **报数**。
   台账算不出来时构造谓词就抛 `LedgerUnavailable` ⇒ 落进既有 catch ⇒ exit 2 **未判定**。
3. 新测试 `scripts/tests/third-party-dangling-exclusion.test.mjs`（4 条）：整目录任意深度被排除（含
   尚未 `git add` 与前缀不得"像不像"误命中）、自研源码不被排除、条目 P3/P8 口径字段、形状锁。

**为什么 D1 该排除它**：那 10 处 `import … from '…/vendor/deps.cjs'` 是**上游 archify 自己的代码**，
指向 vendored CJS（`module.exports` 非字面量）⇒ D1 按定义读不出导出面 ⇒ 每轮 exit 2。
本门回答的是「**本仓自研代码**有没有引用不存在的导出」；上游内部自洽性归上游与其
THIRD_PARTY_NOTICES，归属面由 P8 接住。排除语义边界已写进台账 `obligations` 第③条。

**登记立刻抓出的真问题（P8 归属反噬，这是本轮最有价值的读数）**：
`provenance-ledger --worktree` 在登记后判红 2 条 ——
`.ihui/skills/archify/scripts/generate-brand-marks.mjs` 与 `generate-validators.mjs` **带着我方水印横幅**。
这两份是 3.2.0 遗物：3.3.0 官方包**不含**它们（`Test-Path` 现读 False）、`package.json` 引用 **0** 处、
HEAD 仍在位 —— 典型的「3.3.0 已删但被 `heal-worktree-tracked` 恢复回来的孤儿」。按 §7 删除三问全过
（无功能承载、无等价实现且不需要、非在飞工作）⇒ 用 `LAND_REMOVE_PATHS` 从树里摘掉，
同时 P8 自然转绿（文件不在树里就无从"盖章"）。摘后 archify 文件数 448→446。

**顺带查清的存量欠账（不属本票，未混入本枚）**：`provenance-ledger` 另有一条
`P1 登记的实物不存在:copied:pdfjs-worker-6.x roots → apps/web/public/pdfjs/pdf.worker.min.mjs`。
现读三条硬事实:① `git log -- apps/web/public/pdfjs` **零提交**;② `apps/web/public/pdfjs/` 在 HEAD
**0 个文件**;③ `apps/web/src/components/media/PDFViewer.tsx` **不存在**;仓内仅剩 `.DevEnv/cache/**`
里 pdfjs-dist 的 node_modules 副本。⇒ 该条目描述的实体已整体退场，属**清单腐烂**，修法是删条目
（历史可追溯性靠提交信息承载），另立一枚做。


<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

## 2026-11-24 轮次 12(续: Cursor / Codex 增量)
- 状态: active(本轮收口;目标仍有欠账,见报告 §六)
- 取证: craft-anything 0.5.0 CLI --deep(js-app-map Cursor 3.27.22、db-sqlite-show Codex goals/memories/state);`.ihui/mcp.json` 指向的 0.6.1 盘上不存在、REA 6.4.0 不存在 —— 已如实登记,不伪造
- Cursor 读数: Electron/esbuild,56 modules / 13 IPC / 137 routes / 17 native / 11 storage / 491 vendors;530/10000 文件(partial),63,655 节点被 2,500 上限截断,31 个动态 IPC 不可见
- Codex 增量: goals_1.thread_goals 6 态 + token_budget/tokens_used/time_used_seconds;deferrals 单表;memories jobs 带 lease/watermark
- 落地1(Cursor 规则层): apps/ai-service/app/core/project_rules.py + agent_engine 注入 + llm 自动检索按 file_path 叠加;31 例,无规则目录零行为
- 落地2(Codex token 预算): apps/cli goal-run maxTokens + usage 真值 + `--max-tokens`;8 例,达成优先、缺 usage 计 0
- 验证: Python 69 passed;CLI 21 passed;ruff/mypy --strict/prettier/tsc 8/8 绿;watermark 3/3;变异 7 处(4 Python + 3 TS)均转红后恢复绿
- 报告: .ihui-agent/tmp/r12/REPORT.md
- 欠账: shadow workspace、.cursorignore 兼容、Codex 6 态 + deferral + time budget、Cursor 运行时动态面(不半成品落地)

## 2026-11-24 /goal 轮次 13（深水第三季：原生函数级 + 剩余功能缺口闭环）

**目标条件（AGENTS §8 五要素齐备）**

1. **核心任务**：四程序（DeepSeek Harness 0.2.2-rc.5 / TRAE CN 3.4.20 / Qoder CN 0.5.14 / WorkBuddy 5.11.3）的
   **原生二进制函数级面**（上一轮唯一整块记为「未做」的面）做深度取证——rizin 导出/导入/字符串 +
   Ghidra 12.1.4 headless 伪代码抽样 + craft-anything 0.5.0 `--deep`（321 工具，本机 capabilities 实测
   ghidra/rizin/frida/ilspy/mitmdump/chromium 均 found）——并把可复现设计沉淀为本仓自己的代码；
   同时清掉上一轮判为「仍需做/需先定承载」的功能缺口：B1-05 沙箱三级策略+会话侧车可写根、P0-7 回合前
   上下文自检钩子、B3-07 请求元数据四层、P0-2/P0-3 反向守护拓扑+跨进程注册表（承载本轮已确认：
   `apps/cli/src/daemon/` 已由他席落 `graceful-restart.ts`）。
2. **验证标准**：每个落地件必须有真跑的测试（pytest / vitest）与类型检查（ruff+mypy --strict / tsc），
   断言覆盖「缺省零行为变化」与「拒收/不冒绿」两侧，成对留正向对照；取证文档每条带一条自己真跑过的
   可复核命令；三档（观察/推断/未知）不许混写。落地入库走 `object-space-land` 并回读验证。
3. **约束边界**：红线照旧——不粘专有源码（单条连续片段 ≤10 行）、不破解许可证、不绕过付费、
   不提取凭据/token/cookie；**不运行任何目标程序本体**（全静态取证）；只读目标安装目录，绝不写入。
   改动限定 `apps/ai-service/**`、`apps/cli/**`、`docs/benchmark-evidence/**`；不碰他席在飞面
   （apps/api、apps/web、README*、miniapp）。不新建计划/TODO/ROADMAP，唯一台账 = PROJECT_PLAN.md。
4. **质量要求**：数据层只允许 PostgreSQL，禁 sqlite（含测试库与本地状态库）；新增源文件必跑
   `node scripts/watermark.mjs inject`；每件至少一轴超越（可测性 / PG 统一数据层 / fail-closed 边界 /
   零缺省行为变化）；「造好没装车」= 未完成（每个新导出必须有真实 importer）。
5. **异常处理**：工具缺件/超时/目标体量超限 ⇒ 记「未判定（具体原因）」，不伪造、不冒绿；
   连续 3 轮无进展 ⇒ blocked；连续 5 轮工具失败 ⇒ blocked；落地锁僵死按现读判据（两次采样 CPU +
   kids）判定后清锁，`kids=1` 且 CPU 在涨禁止杀。

**本轮实况**：取证席 2 个 + 落地席 2 个并行（文件域互斥），落地由主控串行执行（多 agent 抢同一把
land 锁已实测两次僵死）。

## 2026-11-24 07:50 轮次 12-续（第二档：规则三模式 + 索引 ignore + 时间预算）

- 状态: active(收口本轮,欠账见报告 §八)
- 落地1(Cursor 规则三模式): 用户级 `~/.ihui/rules`、`~/.cursor/rules`（env 覆盖/开关）;Agent Requested 只进目录、正文按需取;新增 MCP `read_project_rule`(locator 必填、errorCode 机器可读);线程启动改 `load_project_rules_block`(正文+目录)
- 落地2(`.cursorindexingignore`): `INDEX_IGNORE_FILENAMES` 仅索引面生效,仓库树仍 DEFAULT;命中即剪含已跟踪;`.gitignore` 对已跟踪仍 tracked_kept;`.cursorignore` 不并入(隐私待定档)
- 落地3(Codex 时间预算): goal-run 逐轮秒数记账 + `maxSeconds` 闸(未达成才收口、达成优先);CLI `--max-seconds`;摘要 `/ Ns`
- 落地4(时间账进生产账本): `GoalRoundState` 加 `seconds_spent/time_budget_seconds`;`normalize_outcome` 拒负秒/非正预算;`advance_round_state` 时间与 token 任一越线即 `budget_exhausted`;装车 `goal-verify` 请求/响应、`_ledger_fields`、`agents._should_goal_rerun`;老载荷缺键读 None
- 落地5(规则选择面可观测): MCP `list_project_rules`(selected/agentRequested/excluded/budget,支持 targetPaths 与 budgetChars 复算,不回正文)
- 验证: Python 243 passed(规则/MCP/索引组)+ 目标账本/闸门四链 64 passed;CLI 13 passed;变异 8 处均转红后恢复绿;ruff/mypy --strict/prettier/tsc 8/8/watermark 全绿
- 环境边界: `test_codebase_indexer.py` 缺 `anydoc` 无法导入(存量);git 用例需 PATH 含 Git bin(补齐后 9/9)
- 报告: `.ihui-agent/tmp/r12/REPORT.md` §八
- 仍未做: `.cursorignore` 产品定档、shadow workspace 四件套、Codex 六态/deferral、Cursor 运行时动态面