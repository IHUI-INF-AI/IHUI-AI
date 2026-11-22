<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 竞品逆向 Round10：把判据族装车到真实入口（2026-11-23）

> 对照件：Qoder CN 0.5.14 / TRAE CN 3.4.20 / WorkBuddy 5.11.3 / DeepSeek Harness 0.2.2-rc.5
> 前序：`competitive-reverse-engineering-round8-2026-11-14.md`（复现 4 判据）、
> `competitive-reverse-engineering-round9-2026-11-15.md`（补 5 判据 + 聚合入口，122 用例）
> 本轮性质：**不是再造判据，而是把已造好的判据接到真实业务入口**（round9 的结论是「零生产 importer」）

## 1. 问题：造好没装车

round9 沉淀了 9 个判据模块与一个聚合入口 `app/services/reverse_engineered_gates.py`（六 kind），
但 `grep` 结果显示除 `revert_check` 一处 opt-in 外，**没有任何生产代码调用它们**。
按 §0.9「判据必须在真跑它的那一刻才成立」，这一族能力当时等于不存在。

## 2. 本轮装了两处

### 2.1 `GuardedToolPipeline` stage 2.5：gate_suite 前置

- `apps/ai-service/app/services/guarded_tool_pipeline.py`
  - 新常量 `STAGE_GATE` / `ERROR_GATE_BLOCKED`、`GATE_KEY = "__gate_suite__"`、`GATE_KEY_ABSENT` 哨兵
  - `extract_gate_request(args)`：把控制键 `__gate_suite__` 从工具入参里剥离，返回 `(clean_args, gate_spec)`；
    非映射/无键不猜形状（返回哨兵 = 不介入）
  - stage 顺序：prompt(1) → input scan(2) → **gate_suite(2.5)** → budget(3)。判据 `verdict != "allowed"`
    即 `PipelineError(STAGE_GATE, gate_suite_blocked, reason)`，判据抛异常一律 fail-closed
  - `PipelineResult.gate` 面板随 `to_dict()` 输出，前端/审计可见判据原文
- 真调用点：`apps/ai-service/app/services/agent_loop_v2.py::_security_precheck`
  在构造 pipeline 后提取控制键、回写 `tc.args = gate_args`（控制键绝不进真实工具），
  阻断回填 `{"blocked": True, "reason": msg, "scan": pr.scan, "gate": pr.gate}`

**关键缺陷（本轮抓到并修）**：`_PreGate` 新增的 `gate` 字段被插在 `timings` 之前，
而早期 stage 用**位置参数**构造 `_PreGate(False, errors, budget, scan, timings, False)` ——
于是 `timings` 落进 `gate`、`False` 落进 `timings`，`to_dict()["gate"]` 会被写成 timings 字典。
`mypy --strict` 抓到了四处 `arg-type`，行为测试**没有**抓到。修法：字段挪到末尾 + 新增
`test_pre_gate_field_order_keeps_timings_and_gate_separate` 钉住 `dataclasses.fields` 顺序与六参构造。

### 2.2 `context://` 统一命名空间进工具入口

- `apps/ai-service/app/services/mcp_server.py`
  - `_deref_context_uri_alias(path, roots)`：把 `context://workspace/<rel>` 降成工作区相对路径
  - 接在 `_validate_path_in_workspace`（22 个调用点的单一入口），读写工具全部自动生效：
    `read_file` / `list_files` / `write_file` / `file_edit`
  - 虚拟 URI **只换名字**：降级后仍走白名单 + symlink 解析 + 敏感文件/目录黑名单三层真实判据
  - 四个工具 schema 引用同一份 `_CONTEXT_URI_HINT`（§0.6 单一真相源），模型可见这个命名空间

**判据自身的坑（本轮发现）**：`context_fs.resolve_context_uri` 第 10 步把调用方传入的
`roots[namespace]` **原样拼进 `canonical_path`**。若接线层把宿主目录当虚拟根，
canonical 会变成 `context://workspace/C:/...` ——「看着像虚拟 URI、其实是宿主路径」，
正是判据注释里禁止的用法。修法：传逻辑根 `_CONTEXT_VIRTUAL_ROOT="root"`，
并加防御断言：虚拟路径任一段含盘符冒号或反斜杠 ⇒ 拒绝。

## 3. 验证（现读）

- 新增接线测试：`tests/test_gate_suite_pipeline_wiring.py` **17 例**、
  `tests/test_context_uri_tool_namespace.py` **23 例**（合计 40 例）
- 相关面合并：26 个测试文件 **671 passed, 1 skipped**（含既有 54 例管线/判据回归）
- ruff：本次四个文件 `All checks passed`；mypy：`guarded_tool_pipeline.py` 自身 0 error
  （仓库存量 764 error 在其它文件，非本轮引入）
- 反向变异（三次，均已恢复）：
  1. gate 阻断分支 `if False` ⇒ 4 例如期转红
  2. `agent_loop` 面板键 `"gate"`→`"gate_panel"` ⇒ 结构锚点 1 例转红
  3. `_PreGate` 字段序回退 ⇒ 字段序用例转红
  4. `if not ctx_ok` 短路 ⇒ 3 例转红（含「拒绝必须由判据直接给出」两例）

## 4. 超越轴（相对对照件）

1. **一次收口 vs 半态**：对照的虚拟路径允许「已解析未鉴权」；本仓 allowed 必须同时产出
   规范路径与 reason=ok，否则改判 `half_state_rejected`。
2. **虚拟命名空间不豁免任何真实判据**：`context://` 降级后仍过敏感文件黑名单
   （`data/sessions.db`、`.env*`、`.git/` 等），对照件没有这一层。
3. **控制键离开工具入参**：`__gate_suite__` 在进入真实工具前被剥离，判据请求不会污染
   handler 的 `arguments` 形状（模型也不可能通过伪造 handler 入参绕过）。

## 5. 仍欠（诚实记录）

- 聚合入口的 `scan_tier` / `computer_step` 两 kind 仍是 `unjudged`：判据返回裸 str / 判定键叫
  `status`，签名对不上 ⇒ 刻意不硬接（硬接会造第二套语义）。
- `edit_intent.evaluate_edit_intent` 需要 `{id, files:[{path, read_evidence_sha256}], command}`
  与当轮读基准，`file_edit` 目前没有这条数据链；`code_exec_sandbox.decide_code_execution`
  是 AST 判据（管 Python 代码），`run_command` 是 shell 命令字符串 ⇒ 两者都不是本轮能「真跑」的入口。
- DeepSeek Harness 336 个 `@deepseek-ai` 包只吸收了 10 个；Trae 原生 DLL 仍停在导出符号级
  （`BP_*` / `ai_agent_ipc_*` / 内嵌 libgit2、aws-lc）；WorkBuddy `daemon-supervisor` 的
  pid 注册表与 env 通道未落。以上由并行取证席继续，产物落
  `docs/benchmark-evidence/2026-11/deep-native-2026-11-23/`。

## 6. P0-8 索引完整性审计（TRAE CKG sqlite_vec → PostgreSQL/pgvector）

**对照语义**：对照件在 sqlite_vec 侧统计 `missing_vector_entity_count` /
`total_embedding_entities`，并用幂等标记（磁盘态 / 运行时态两层）避免重复嵌入。本轮只取
**统计与判定**这一层；端侧本地嵌入与常驻守护不做（取证 README 已把这两项划出最小范围）。

**落点**：`apps/api/src/services/codebase-index-service.ts`

- `IndexStats` 增 `missingVectorChunks`（缺向量切片数）与 `vectorCoverage`（0..1，4 位；
  0 切片时恒 0 而**不是 1** —— 空库不是「完整」）
- `getStats` SQL 增 `COUNT(*) FILTER (WHERE "embedding" IS NULL)`：缺向量判据落库内聚合，
  不把全表拉回 JS 筛；`COUNT(DISTINCT file_path)` 等旧列原样保留
- 新增 `auditIntegrity(repoId?, ownerUuid?)`，给**结论**而不是读数，四态互斥：
  `unjudged/owner_required`（无归属 ⇒ 一次查询都不发）· `empty/no_chunks`（0 切片，不记 ok）·
  `degraded/missing_vectors` · `ok/complete`
- 消费方 `GET /v1/codebase-search/stats` 本就是 `success(stats)` 直出，新字段向后兼容，
  路由零改动

**测试**：新增 `apps/api/src/services/__tests__/codebase-index-integrity-audit.test.ts`
**14 例**；与既有 `codebase-index-tenant-isolation.test.ts` 合并 **2 文件全绿**；
`pnpm turbo typecheck --filter=@ihui/api` **9/9 successful**（cache 8/9）。

**反向变异三次（均已恢复）**：① 无归属分支短路 ⇒ unjudged 用例转红；② 空库分支短路 ⇒
empty 用例转红；③ `missing` 列改成常量 `0` ⇒ SQL 层判据用例转红。

**顺手钉住的测法假绿（重要）**：既有 `renderSql` 的 `toQuery` cfg 缺 `getColumnCasing`
（drizzle 0.38 新签名），遇 Column 对象抛错后被 `catch` 吞成 `String(frag)`＝
`"[object Object]"`，于是 `not.toContain(...)` 这类断言**长期假绿**。新测试补上该成员，
SQL 断言才真正在断言 SQL；既有文件本轮不动（与他席在飞面重叠），已列入待办。

## 7. P0-6 home 凭据目录 deny 族（WorkBuddy tsbx_rules → 本仓凭据族）

**对照证据**：`tsbx_rules.json` 的 `%USERPROFILE%\.ssh\**` / `.gnupg\**` 读/写/删全 deny，
`default_action: ask`；开发缓存 allow 族与浏览器进程白名单本轮不在范围。

**IHUI 缺口（现读）**：凭据族此前全是**工作区相对**形态（`.ssh/**` 只命中工作区根），
而 `toAclPath` 对越界绝对路径走"绝对回落"原样返回 ⇒ home 下的 `.ssh/config`、
`.gnupg/private-keys-v1.d/*`、`.aws/credentials`、`.kube/config`、`.docker/config.json`、
`.netrc`、`.pypirc` **整片不在尺子上**（`.gnupg` 全仓 0 命中）。

**落点**：`apps/cli/src/sandbox/file-access-policy.ts` 追加 8 条 home 凭据族
（`**/.ssh/**` / `**/.gnupg/**` / `**/.aws/**` / `**/.kube/**` / `**/.docker/config.json` /
`**/.netrc` / `**/.pypirc` / `**/.gitconfig.local`），统一 `read: deny` / `write: deny` /
`delete: ask`、`enforcement: 'enforce'`、`source: 'credential'`、每条带 why。
形态选 `**/` 前置而不做 home 现算：用户目录可能在别的盘/网络盘，现算取错就是不设防；
本仓 glob 的 `**` 天然跨盘符，并顺手覆盖"工作区子目录里 copy 了一份凭据"。

**测试**：新增 `apps/cli/tests/home-credential-deny-p06.test.ts` **13 例**（含绝对形态保真、
"传绝对路径不绕过"、POSIX/Windows 双形态、delete 只 ask、反向牙 docs 不误伤）；
与既有 `acl-followup-b49.test.ts` 合并 **2 文件 32 例全绿**；
`pnpm turbo typecheck --filter=ihui-cli` **8/8 successful**；
prettier `--check` 两文件通过。反向变异 2 次（移 `.ssh` 族 / `.gnupg` 读改 allow）
均如期转红并恢复。

**超越轴**：对照件是进程内快照规则；本仓是纯函数 + 注入式读取器（可测），新增族全部
enforce（不存在 advisory 出声档），越界绝对路径不折叠、由尾段 glob 兜住。

## 8. P0-5 终态前输出完成闸门（DSH 双游标 → 常驻 shell 有界环）

**对照语义**：`dsh-jobs` 的模型推进游标与观察者绝对偏移**双读**、窗口外读标 `lossy`
不报错、结算 first-wins 只投递一轮；`agent-tool-host.exe` 明串「terminal commit requires
terminal status with complete output」。

**IHUI 的真实缺口（现读，这是缺陷而不是"为对齐而加"）**：`unified_exec` 的输出此前是一个
纯字符串 buffer，超限时保留「头部 4000 + 中间截断标记 + 尾部 16000」，而增量读取用
`buffer[before:]` 按**旧长度**切。截断一旦发生，字符串从 `total` 缩到 `head+tail+标记`：
`before` 比新长度大 ⇒ 空串 ⇒ 这段输出被**静默吞掉**，回执只写「(无新增输出)」，没有任何
lossy 标记。这就是对照件「terminal commit requires complete output」要挡的那一型。

**落点**：

- 新增 `apps/ai-service/app/services/output_ring.py`：`OutputRing`（绝对偏移 `total_written`
  只增不减、head 段永不被丢、尾部按容量滚动、`read()` 纯函数双游标、窗口外标
  `lossy`/`dropped_chars`、中段插丢弃标记；`settle()` 四态封闭集
  `ok/truncated/pipe_unavailable/timeout` + first-wins）
- `agent_engine.py` 的 unified_exec 改为会话持 `ring`（legacy `buffer` 退场、删除字符串截断
  分支），`_append_output` 只 `ring.append(_strip_ansi(chunk))`，`_wait_settled` 按
  `ring.total_written` 绝对偏移读；回执新增 `nextOffset` / `outputLossy` /
  `outputDroppedChars`，lossy 时附 `outputLossyNote`
- 既有 `_EXEC_BUFFER_HEAD(4000)` / `_EXEC_BUFFER_TAIL(16000)` 常量原值保留，改作
  「head 保留量 + 环容量」，产品显示语义不缩水

**测试**：`tests/test_output_ring.py` **21 例**（head 不丢、洞标记、界外读回落、limit 游标、
Unicode 按字符计、四态与 first-wins）；`tests/test_unified_exec_output_ring_wiring.py`
**4 例**（会话只持 ring、回执三字段、大输出标 lossy 而不静默变空、截断后续读不错位）；
与既有 harness 第四/八/十一批合并 **5 文件 57 例全绿**；ruff 四文件
`All checks passed`；mypy `--strict` 新模块 0 error（仓库存量 764 不在本轮）。
反向变异 2 次（洞检测短路 / `nextOffset` 回退到 `before`）均如期转红并恢复。

**超越轴**：对照件把「窗口外读 lossy」当读取侧便利；本仓把它变成**回执里的显式字段**
（模型不必猜），且 head 段永不丢、中段带丢弃标记 —— 模型能同时看到命令开头与结尾，
不会出现"静默空回执"。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
