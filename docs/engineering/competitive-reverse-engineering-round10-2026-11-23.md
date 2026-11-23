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

## 9. P0-4 沙箱能力探测平行面（支持 / 不支持 / 未判定，不支持即拒）

**来源与证据**：`C:\Trae CN\resources\app\modules\sandbox\sbox_sdk.dll` 导出 `SBoxSDK_Init` /
`InitV2` / `IsSBoxSupported` / `CreateSandbox` / `GetSBoxInfo` / `Action` / `GetLastError` /
`UnInit`；`unified/vm_sdk.dll` 同型 `VMSDK_*`；`trae-sandbox.exe` 里逐字命中 11 条原因码。
取证 README 记「12 条」但只逐字列出 11 条 —— 第 12 条 `SdkNotLoaded` 按同二进制里的
`SDK not loaded` 错误串落定，并**标注为推断**（`is_verbatim()` 返回 false），测试钉住
「11 逐字 + 1 推断」的分布，将来补到逐字证据时该用例会红、提醒改标注而不是悄悄漂移。

**本仓缺口**：`apps/desktop/src-tauri/src` 里 `hyperv|microvm|HostCompute|ALPC|security
descriptor` 零命中；隔离面只有 `terminal_session.rs`（Job Object）与 `orphan_guard.rs`，
**没有**平行的能力探测/分档面，也没有「不支持就拒」的判定。

**落地（5 文件）**：

- 新增 `sandbox_sdk.rs`：`SandboxBackend` trait（`init / is_supported / create / action /
  kill_all / get_alive_infos / uninit`，方法面对 `SBoxSDK_*` 导出语义）、`ProbeState` 三态、
  12 条不支持原因码 + 4 条未判定原因、`SandboxGate`（**唯一执行入口**，非 `Supported` 时
  执行闭包**一次都不调**）
- `terminal_session.rs` 抽出 `assign_to_job(job, child)` 给沙箱后端复用（挂载逻辑只有一份代码）；
  `SessionInfo` 增 `isolation`（`job-object` / `process-group` / `none_job_object_unavailable`）
- `terminal_ipc.rs`：`SessionWire` 透出 `isolation`，前端可据此提示「该会话 kill 后子进程树可能残留」
- 新增 `sandbox_ipc.rs`：`sandbox_capability(tier)` / `sandbox_tiers()` 两条命令 ——
  **这是判据的 importer**（第八轮教训：判据层装了没人用等于没装）
- `lib.rs`：`mod sandbox_sdk` / `mod sandbox_ipc` + 两条命令注册

**测试**：`sandbox_sdk` **9 例**（12 条原因码逐条 ⇒ `Refused` 且闭包调用数 0、4 条未判定同样拒、
`Supported` 恰好执行一次、执行失败 ≠ 被拒、VM 桩恒 `Unjudged`、未知形态拒、原因码唯一性、
Windows 真作业对象 `init` ⇒ `Supported`、真 spawn 后 `kill_all` 清空）；
`terminal_session` **7 例**（含 `isolation_label` 诚实标签：挂不上必须带 `none_` 前缀）。
`cargo check --lib` 0 error；两个新文件 `rustfmt --check` 0 diff（存量三文件本就未过 fmt，不动）。
反向变异 2 次：M1 丢弃探测结果一律放行 ⇒ 3 例红；M2 挂不上假报 `job-object` ⇒ 1 例红，均如期。

**为什么不是「又一个没有 importer 的判据层」**：`sandbox_capability` 是前端可调命令、
`SessionInfo.isolation` 是终端会话真实字段。`SandboxGate` / `SandboxSpec` 当前没有执行入口，
模块顶部显式 `#![allow(dead_code)]` + 注释说明，等 guarded spawn 接上再撤 —— 不伪造接线。

**超越轴**：对照件把「不支持」当启动失败，错误码散在 C 接口 `GetLastError` 里；
本仓把三态做成**结构保证** —— 未判定同样拒（不把「没探到」当「支持」），
且「不支持时不创建进程」由闭包调用计数钉住，测试可直接断言副作用，不靠调用方自律。

**待办**：`MicroVmBackend` 只是桩；`SandboxGate` 的 guarded spawn 入口（把 `create` 包进
`run`）未接。

## 10. B2-03 输出 drain 闸门（Rust 侧补上 P0-5 的同型缺陷）

**来源**：`run_helper.exe` 导入 `CreateProcessW` / `WaitForSingleObject` / `GetExitCodeProcess`；
`aiep_sbox.dll` 导出 `DetourFinishHelperProcess` —— helper 跑完还要等「输出中继结束」才收尾。

**本仓缺口（真缺陷）**：`terminal_session.rs::poll` 里 `try_wait` 一返回 `Some(status)` 就直接
`set_state(Exited)`；此刻两个读取线程可能还在把最后一段写进环形缓冲。于是「终态」与
「最后一段到达」之间存在窗口，调用方在这个窗口读 `read_out` 拿到的是**半截输出**，
且没有任何标记说它不完整。

**落地（2 文件）**：

- 读线程计数：`spawn_reader` 增 `active: Arc<AtomicUsize>` 参数，进线程 +1、EOF / 管道断后 -1
- 新增 `DrainOutcome` 四态（`draining / complete / drain_timeout / pipe_unavailable`）与
  `drain_settlement(readers_active, waited, pipe_available)` 纯判据；优先级
  **没有管道 > 还有读者 > 超时 > 完成** —— 把「没管道」排在「读者为 0」前是关键，
  否则「两路都 None」会被误判成 `complete`（没读过任何东西却说完整）
- `poll`：子进程退出后先结算 drain，`draining` 时**保持 `Running`**（不抢先报终态），
  `complete` / `timeout` / `pipe_unavailable` 才落 `Exited`；超时预算
  `DRAIN_TIMEOUT_MS = 2000`，超时如实标 `drain_timeout` 而不是永久卡在 `Running`
- `SessionInfo.output_drain` + `SessionWire.output_drain` 透出，前端见 `drain_timeout` 须提示可能丢尾

**测试**：`terminal_session::tests` **10 例**（新增 3：纯判据六种组合、四态码与 `is_settled`
诚实性、Windows 真进程 e2e —— `cmd /C "echo hello-drain & exit 0"` 到终态后 `read_out`
必须含 `hello-drain` 且 `output_drain == complete`）。`cargo check --lib` 0 error。
反向变异 2 次：M1 一律报 `complete` ⇒ 判据用例红；M2 `is_settled` 对 `Draining` 返 true ⇒
码表用例红，均如期。

**零缺省**：七态对外语义不动（终态仍是 `Exited`），只多一个「输出完整性」维度；
既有 `poll` 调用方最多多看到几毫秒的 `Running`，无行为回退。

**超越轴**：对照件把「等 helper 结束」藏在 `DetourFinishHelperProcess` 的隐式约定里；
本仓把它变成**回执里的显式字段**，等待有上限、超时如实标丢尾 —— 与第 8 节 Python 侧
P0-5 是同一件事，两处口径一致（`complete / truncated / pipe_unavailable / timeout`）。

**待办**：`MicroVmBackend` 桩；`SandboxGate` 的 guarded spawn 入口未接（承第 9 节）。

## 11. B4-02 子进程 env 白名单通道（补上与黑名单相反的那条腿）

**来源**：`lite-wb.mjs` L358 的白名单（`USERPROFILE` / `SYSTEMROOT` / `TEMP` …）与隔离集
（`*_SESSION_ID` / `*_OWNER_KEY`）；`daemon-supervisor.cjs` 的
`CODEBUDDY_INTERNAL_DAEMON_CHANNEL` / `CODEBUDDY_SESSION_KIND` 显式通道键。

**本仓现状**：`apps/cli/src/sandbox/env-guard.ts` 是**归类表 + 黑名单语义**，它自己的文档里
写明「未登记的键默认放行」。黑名单的固有缺口是"没列进去就穿透"——新增一个会泄漏会话身份的
键（`*_SESSION_ID` / 新的 `*_TOKEN`），在有人想起补表之前一直是漏的。

**落地（3 文件）**：

- 新增 `apps/cli/src/sandbox/env-channel.ts`：白名单语义。宿主键只给必需集
  （Windows 25 键 / POSIX 11 键），未登记默认不进；会话键（`*_SESSION_ID` / `_OWNER_KEY` /
  `_SESSION_KEY` / `_SESSION_TOKEN` / `_WORKER_ID`）在宿主侧一律隔离；疑似凭据名
  （`API_KEY` / `SECRET` / `PASSWORD` / `*_TOKEN` 后缀…）拦下；`dropped` 只记键名与原因码，
  **不回传值**——被丢的往往正是凭据，打进日志等于换个地方泄漏
- `extras` 是显式授权通道：调用方点名的会话键可以进（hook 上下文靠这条），凭据形态仍拦。
  顺序刻意是「先凭据、后隔离」：反过来的话 `*_SESSION_TOKEN` 会被当成普通会话键放出去
- 接线：`apps/cli/src/hooks/index.ts` 两处 spawn（webhook 子进程 / 外部 hook 命令）从
  `buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS)`（黑名单剥凭据）改为
  `buildChildEnv(process.env, extras)`（白名单只给必需键）

**测试**：`apps/cli/tests/env-channel-b4-02.test.ts` **13 例**（白名单透传 / 未登记不进 /
宿主侧会话键隔离 / extras 显式授权 / 凭据名拦且**整份回执序列化后不含那个值** /
`env-guard` 判 forbidden 的键拒收并给出指引 / 大小写不敏感 / 平台白名单差异 /
白名单结构自证不含会话与凭据键 / `kept` 排序与 `undefined` 跳过 / `wouldDrop` 同口径）。
与 hooks 面 **7 文件 106 例** 合并全绿（hooks-extended 36、hooks-lifecycle 11、
hook-dispatch-points 7、g-424-hook-run-events 9、hook-feedback-channel 5、
hooks-host-identity 9、本模块 13）；prettier 通过。

**两处真实回归（值得记）**：

1. 首版 `extras` 也拦会话键 ⇒ `hooks-extended::workspacePath/sessionId 通过环境变量传递`
   转红（hook 脚本里 `%IHUI_SESSION_ID%` 没被展开）。结论：隔离只该拦「宿主环境里的意外
   继承」，不该拦「调用方显式声明的键」——否则 hook 上下文根本传不出 sessionId。
2. `_TOKEN` 用 `includes` 判 ⇒ `IHUI_COMPACTED_TOKENS_BEFORE` 被误杀（它含 `_TOKEN` 子串
   但不是凭据）。改成**后缀**判定，测试已钉住这条语义。

**反向变异**：M1 未登记键也放行 ⇒ 2 例红；M2 凭据形态一律不拦 ⇒ 4 例红；均还原复绿。

**超越轴**：取证件用白名单防「意外的会话身份泄漏」；本仓把它做成**可诊断的丢弃台账**
（每个键为什么没进、且不回传值），并与既有黑名单共存而不互斥——黑名单管「已知该走别处」，
白名单管「没被点名的」。副作用可断言：被丢的键确实不出现在子进程 env 里。

**代价/边界**：hooks 是受信外部脚本，仍需拿到 `IHUI_*` 上下文，所以 extras 通道放宽了会话键；
真要「连会话键都不给」的第三方插件子进程，应传空 extras 并另立调用点（不在本轮范围）。

## 12. C 段交付：七枚落点的运行时拓扑图（archify 交互 HTML）

**产物**：`.archify/architecture-round10-seven-20261123-104053/seven-landings.html`（本地生成物，
`.archify/` 已在 `.gitignore`；候选与各轮 receipt 同目录）。

**图的内容**：四段运行时各一列——`apps/ai-service`（agent_loop_v2 调 gate_suite 判据 /
`context://` 命名空间 / output_ring）、`apps/api`（v1-codebase-search → auditIntegrity → pgvector）、
`apps/cli`（hooks 分发 / homedir 凭据族 deny / env 白名单 → 外部 hook 子进程）、
`apps/desktop (tauri)`（SandboxGate → Job Object 隔离 / drain 收尾闸门）。
每节点携带本票落地的 commit 短号；三张结卡载「来源与裁决（P0-1 不采纳、P0-7 立项）」、
「七枚落点」「超越轴与未闭环」。

**校验（现读）**：`validate` / `deliver` / `check` 三关**通过**（含桌面可读性：viewBox 1270→≤1240、
页高 1065→≤900 两轮修复，均按诊断给的 supportedFixes 只改间距与卡片长度，语义零改动）。
`browser-check` **仅剩 `viewer/theme-state` 4 条红**：产物 `resolvedTheme=dark` 而请求 `light`。

**根因（资产缺陷，非产物缺陷）**：本仓 `.ihui/skills/archify/assets/template.html` 的
`<html data-theme="dark">` 是**写死**的，全文无 `prefers-color-scheme` / 主题切换能力
（17.6KB 精简壳），因此 light 视口必然解析成 dark。曾给模板注入 `matchMedia` 脚本、
并确认脚本已进入产物 HTML（`hasMatchMedia: True`），`resolvedTheme` 仍为 dark
⇒ 该判据不经 media query 传达请求主题；模板已回滚原样（`git status` 零差异），不动这项资产。

**待办（与 [30a] 同类的判据/资产冲突）**：要么给模板补真实主题切换（并验证 `browser-check` 的
请求路径是否被尊重），要么把 `viewer/theme-state` 降为 warn；在此之前 C 段产物按「三关通过 +
主题项未判定」交付，不冒绿也不冒红。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
