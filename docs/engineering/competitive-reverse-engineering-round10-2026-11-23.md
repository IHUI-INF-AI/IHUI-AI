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

## 13. B1-01 工具超时的结构化分类（结果码 + 嵌套 deadline 隔离）

**来源**：DSH `ai_agent.dll` 的 `ExecuteCommandRequest{…, timeout_ms, …}` 与 `TOOL_TIMEOUT`
结果码语义。本仓 `app/core/tool_timeout_policy.py` 已有 per-tool 预算（run_command 120s /
subagent 300s / office 330s），但超时只产出一句自由文本 `工具执行超时(Ns)`、`error_type`
统一 `timeout` —— **答不出是谁掐断的**：是 handler 自己预算到点（内层），还是外层
`wait_for`（`loop_guard`）或 MCP 守卫（`mcp_guard`）先到。

**落地（3 文件）**：

- 新增 `apps/ai-service/app/core/tool_timeout_result.py`：`classify_timeout_scope` 纯判据
  （显式来源 > 外层窗口 > handler 窗口 > 未判定）、`format_timeout_message`（逐字复刻旧文案）、
  `timeout_scope_fields`（`timeout_scope` + `timeout_code` 两键）
- 接线 `agent_loop_v2.py` 两处超时分支：主执行路径（`_execute_single` 的 `wait_for`）把
  `timeout_scope` / `timeout_code` 并入 `tool.retry` 事件；批准后重执行分支只写日志（该处无事件通道）
- **文案零变化**：模型看到的仍是 `工具执行超时(60s)`，归因只走事件/日志

**判据三条**：① 内层 handler 自称超时时**绝不被 elapsed 改写成外层**（嵌套 deadline 隔离，
这是"显式来源最高优先"的唯一理由）；② 三个窗口之间的空隙一律 `unjudged`
（`outside-all-windows`），不猜成最近一档；③ unjudged 有独立码 `TOOL_TIMEOUT_UNJUDGED`，
读的人不会把它当成已判定。

**测试**：`test_tool_timeout_result.py` **17 例**（含两条回潮闸：looper 里不得再出现
`f"工具执行超时(` 字面量；`agent_loop_v2._format_timeout_message is format_timeout_message`
钉住"只有一份实现"）。相关面 27 例绿；`ruff` All checks passed；`mypy --strict` 0 error。

**红门归因（not-ours）**：`test_tool_timeout_policy.py` 2 例报
`AGENT_RESUME_RECEIPT_UNAVAILABLE: 续跑回执无法耐久落盘，有副作用工具未执行` ——
环境阻塞（回执落盘不可用），与本改动无关；该面 22 例仍绿。

**超越轴**：取证件只有结果码字符串；本仓把它做成可断言的四态判据 + 事件级可诊断字段，
并用「函数对象同一性」把「只有一份实现」变成机器断言。

## 14. B1-03 重复调用分级提醒（3/5/8，只提醒不否决）

**来源**：DSH 的 repeat-call reminder（阈值 3 / 5 / 8）。本仓 `DoomLoopSentinel.observe_calls`
命中阈值后只有**一档**文案 —— 第 3 次和第 8 次说的话一字不差，模型读不到「越来越严重」，
运维也分不出「刚踩线」与「该人工介入」。

**落地（3 文件）**：

- 新增 `apps/ai-service/app/core/repeat_call_reminder.py`：`advisory_level`（3 notice /
  5 warning / 8 critical；`bool`、非 int、低于 3 一律 `None`）、`classify_repeat_call`、
  `build_repeat_reminder`（三档文案，前缀 `[DOOM_LOOP_ALERT]` 保留）
- 接线 `doom_loop.observe_calls`：旧 f-string 换成 `build_repeat_reminder`，
  **notice 档逐字复刻旧文案**（既有断言与模型观感零差异）
- 纪律：三档只改措辞强度，`actions` 仍由 `plan_doom_alert_response` 决定
  （`reflecting` / `skip_tool_execution` 零变化）—— advisory **不新增否决点**

**测试**：`test_repeat_call_reminder.py` **13 例**，含三条硬断言：阈值单源
（`ADVISORY_NOTICE_REPEATS == DOOM_LOOP_REPEAT_THRESHOLD`）、函数对象同一性
（`doom_loop.build_repeat_reminder is build_repeat_reminder`）、`plan_doom_alert_response(1)`
动作不变。doom_loop 面 **46 例**绿（含既有 33）；注水印后 40 例复绿；
`ruff` All checks passed；`mypy --strict` 0 error。

**超越轴**：可测性 + 零行为变化。取证件只有提醒文本；本仓把「两处阈值必须等值」做成
机器断言（漂开即红，不靠口头同步），并把「只提醒不否决」本身钉成用例。

## 15. B3-05 通知权限三态查询（只读、不冒充）

**来源**：WorkBuddy / DSH 的通知权限状态查询 —— 发通知前先问"用户到底允不允许"，读系统开关再决定话术。本仓 `tauri-plugin-notification` 只有**发送面**：通知没弹出来时前端拿不到任何依据，只能统一报"通知失败"，把"用户关了通知"和"链路故障"混成一件事。

**落地（2 文件）**：

- 新增 `apps/desktop/src-tauri/src/notification_permission.rs`：`PermissionReport`（`state`/`reason`/`source` 三字段，`camelCase` 过 Tauri 边界）、纯判据 `classify_notification_permission(Option<u32>)` → `allowed`(1) / `denied`(0) / `unjudged`（键缺失、读失败、非 Windows、未知值都落未判定并点名原因）、`read_notification_permission()` 只读 `HKCU\…\Notifications\Settings` 的 `NOC_GLOBAL_SETTING_TOASTS_ENABLED`
- 接线 `lib.rs`：`mod notification_permission;` + `#[tauri::command] query_notification_permission()` + `invoke_handler` 注册

**判据三条**：① 三态封闭，`unjudged` 有四条点名原因（`registry-value-absent` / `registry-read-failed-*` / `unexpected-registry-value-N` / `platform-unsupported`）；② **取不到绝不默认 allowed** —— 对比取证件里的布尔 `isEnabled`，读失败返回 `false` 会把"没判"读成"用户关了"；③ 只读：不写注册表、不改权限、不发通知。

**测试**：`notification_permission` 面 **6 例**绿（0 / 1 / 缺失 / 未知值 / 非 Windows / Windows 真读不 panic 且未判定时 state 必须 unjudged）；desktop lib 面 **485 例**通过（1 例既有红见下）。

**红门归因（not-ours）**：`auto_refresh::tests::常驻循环前必须串上准入闸且离线兜底仍在其前` 报「常驻循环应恰有一处(现 2 处)」—— `git grep -F 'loop {' HEAD -- src/auto_refresh.rs` 实测 HEAD 就有 **2 处**（L852 生产循环、L1288），该文件工作树零改动、本轮只动了 `lib.rs`，属**存量红**（判据与文件现状冲突），与 B3-05 无关。

**超越轴**：可测性 + 不冒充。取证件只回答"开 / 关"；本仓把"取不到"做成第四种可见状态，并让纯判据可被夹具枚举（不需要真改注册表就能测到四种未判定路径）。

**诚实边界**：只覆盖 Windows 全局 toast 总开关；per-app 开关（`Notifications\Settings\<AppId>`）与非 Windows 平台后端口未纳入 —— 平台差异留在 `cfg` 分支，未伪造能力。

## 16. B2-10 出站拦截四桶记账（恒等式可断言）

**来源**：Qoder / Trae 的沙箱只报一个「拦截数」，放行与「只出声不拦」混在一起 —— 数字降了分不清「威胁变少」还是「规则没生效」。本仓 `egress_gate::guard_egress_target` 是唯一出站入口（真实拦截点五处：自动刷新探活、签到捕获、网页登录批次），但判定结果从不落账。

**落地（3 文件）**：

- 新增 `apps/desktop/src-tauri/src/sandbox_metrics.rs`：四桶只增计数（`allow` / `deny_enforced` / `deny_advisory` / `unjudged`）各一枚 `AtomicU64` + 独立 `total`；`record()` 先记桶再记总数（死在中间则 `total` 落后 ⇒ 判 `drifted` 可见）；`classify_consistency` 四态（`consistent` / `drifted` / `empty` / `unjudged`）；`report()` 供命令层
- 接线 `egress_gate.rs`：`bucket_for(decision, enforcement)` 纯映射（四组合封闭），`guard_egress_target` 在 `judge` 之后一行 `record` —— **判定语义零变化**
- 接线 `lib.rs`：`mod sandbox_metrics;` + `#[tauri::command] sandbox_egress_metrics()`

**判据三条**：① 恒等式 `total == allow + deny_enforced + deny_advisory + unjudged`（以 u128 求和，防 `u64` 上卷）；② `total == 0` 判 `empty`，**不冒充「零拦截」**；③ 任一维到 `u64::MAX` 判 `unjudged`（到顶之后的计数不再可信）。

**测试**：`sandbox_metrics` 面 **11 例**（含 8 线程 × 500 次并发后恒等式仍成立、溢出不上卷、`empty` 不渲染成 0）；`egress_gate` 面 **19 例**（原 17 + 映射四组合 + 埋点不改变拒绝语义）；desktop lib 面 **498 例**通过（1 例既有红同第 15 节）。

**超越轴**：可测性 + 不冒充。取证件只有计数；本仓把「拦截数对不对得上」做成一条机器不变量，并把「保留（advisory 放行）」从真拒绝里拆出来单独计。

**诚实边界**：只记计数、不记主机名（留痕仍归 `egress_gate` 的 `report_egress_warnings`）；快照各桶分别读，不是同一时刻的原子切片 —— 判据只承诺恒等式，不承诺跨桶时间一致。

## 17. B4-08 启动画像 span 树（嵌套 / 并发 / 停采三缺口）

**来源**：Qoder 的启动画像是一棵 span 树 —— 段可嵌套、可并发、目标达成后可停采。本仓 `profile.ts` 只有扁平里程碑（entry / commandParsed / exit），三处缺口：① 没有父子关系，看不出「哪一段吃掉了启动预算」；② 同名段并发打开时只能「先到者占名」，后到那段耗时**凭空消失**；③ 没有停采点，启动完成后仍在打点的路径会把稳态耗时算进启动。

**落地（2 文件）**：

- 新增 `apps/cli/src/startup/span-tree.ts`：`createSpanTree(clock, { required, stopAt })`；`open()` 返回可幂等 `close()` 的句柄；打开中的同名段即记覆盖；`stopAt` 达成后只停「新增」（`stoppedOpenCount()` 可见证据），已开段照常闭合
- 接线 `index.ts` 启动入口：`IHUI_STARTUP_SPANS=1` 才构造（默认 null ⇒ 零开销零输出），exit 时闭合 boot 段并打一行 ASCII

**判据三条**：① 判序固定：`no-spans` → `span-unclosed` → `non-monotonic`（自身负时长 / 子段越出父段窗口）→ `missing-required` → `overlapped` → `measured`；② `overlapped` 与 `unjudged` 行**不含任何 `<数字>ms`** 读数（不可信计时不得账面化，同 `profile.ts` 的 0ms 禁令）；③ 停采只停新增，已在飞的段照常闭合 —— 否则会把「停采」误读成「未闭合」的 `unjudged`。

**测试**：`span-tree-b4-08.test.ts` **14 例**（单段 / 嵌套 / 同父并发 / 不同父同名不误判 / 未闭合 / 缺必需 / 时钟回拨 / 子段越界 / 停采两态 / 最慢段等长保留先到 / 渲染无读数字面 / close 幂等 / 零缺省）；与既有 `startup-profile-prewarm.test.ts` 合并 **26 例**全绿；`pnpm turbo typecheck --filter=ihui-cli` **8/8 successful**；prettier 三文件通过。

**一次真实回归（已修并钉住）**：首版把覆盖判据写成「同父同名」，嵌套打开同名段时被判成 `measured`（读数 `maxDepth=3` 正是「后到段被当成子段吞掉」的形态）。改为「同名且仍打开」即记覆盖；不同父但**不同时**打开的两段不误判（用例已钉住）。

**超越轴**：可测性 + 不冒充。取证件只报树形耗时；本仓把「并发覆盖令计时不可信」做成独立状态，并让「停采生效」自带计数证据。

**诚实边界**：接线是 opt-in（`IHUI_STARTUP_SPANS=1`），默认零开销零输出；树里只记时间，不记文件 / 网络 I/O。

## 18. B3-06 剪贴板一次性读取票据（有界、定时、二次即拒）

**来源**：取证件读剪贴板走「先发一张票据、凭票读一次」。本仓 `clipboard_get` 是**无状态直读**：任何拿到命令权限的代码都能无限次重读剪贴板（用户复制过的密码 / token 一直留在里面）。

**落地（2 文件）**：

- 新增 `apps/desktop/src-tauri/src/clipboard_grant.rs`：`GrantStore`（进程内单例）+ 四态裁决 `Ok` / `Unknown` / `Expired` / `AlreadyConsumed`；`issue`（30s TTL、最多 8 张未消费，超出先丢最早到期的一张）+ `consume`（首读即标记，二次即拒）+ `purge`；纯判据 `classify_grant(present, consumed, expires, now)`，判序 **存在性 → 已消费 → 过期**
- 接线 `lib.rs`：抽出 `read_clipboard()` 唯一实现（`clipboard_get` 与新命令共用）；新增 `clipboard_issue_grant()` / `clipboard_read_with_grant(token, format)`；两条新命令与既有 `clipboard_get` 一样先过 `require_computer_control` —— 准入闸单一真相源不动

**判据三条**：① 一次性 —— 同票第二次判 `AlreadyConsumed`（fail-closed，不留「再读一点」的缝隙）；② 边界不算有效 —— `now >= expiresAt` 判 `Expired`；③ 未知票不给「可能有效」余地 —— `Unknown` 独立码，不折成放行。

**测试**：`clipboard_grant` 面 **10 例**（含 8 线程并发同票只出一次 `Ok`、有界淘汰最早到期、`purge` 回收计数、四态纯判据）；desktop lib 面 **508 例**通过（1 例既有红同第 15/16 节）。

**一次真实回归（已修并钉住）**：`purge` 用例首版用 `issue(1000)` + `issue(1500)`，而 `issue` 内部会先回收过期项 ⇒ 第二张发票时第一张已被清，回收数只有 1。用例改为同刻发两张，把「issue 自带过期回收」这条真实行为钉住。

**超越轴**：可测性 + 有界。取证件只有「票只读到一次」；本仓把「票有多少张、何时过期、被谁消费」都做成可断言状态，并给独立错误码。

**诚实边界**：token 只是同进程内的票据对齐，**不是跨进程安全边界**（真准入是 `require_computer_control` 与系统剪贴板权限）；既有 `clipboard_get` 保持原语义（不破坏既有调用方），票据是新增命令面。

## 19. B1-11 OTel 日志通道（与 trace 分腿 + 三界 + 超界可见）

**来源**：取证件把「会话事件日志」与 trace 分成两条独立通道。混在一条通道上时，高频日志会把采样稀疏的 trace 挤出批队列。本仓 `telemetry.py` 只有 traces 一条腿（`/v1/traces`），没有任何日志通道，也没有「批多大、字节多宽」的界。

**落地（2 文件）**：

- 新增 `apps/ai-service/app/services/otel_log_channels.py`：三界常量（**64 条 / 32KB / 10s**）+ `build_batch`（先到界者先停，被截下的**全部**计入 `dropped_records` / `dropped_bytes`，UTF-8 按字节实算）+ `should_flush`（三界任一触发；非法输入一律不 flush）+ `LogChannel`（攒批 / 发批 / 记账，失败清空待发区并记 `failures`，绝不抛）+ 四态 `enabled` / `saturated` / `unjudged` / `disabled`
- 接线 `telemetry.py`：`init_telemetry` 在 trace provider 建好后**另建** `/v1/logs` 的 `LoggerProvider + BatchLogRecordProcessor(OTLPLogExporter)`，建不起来只降级点名 `unjudged(<异常类>)`，trace 与业务都不受影响；新增 `telemetry_channel_states()` 现读两通道状态；`shutdown_telemetry` 先刷日志通道再关 trace

**判据三条**：① 条数 / 字节 / 时间三界任一触发才 flush，非法输入**不** flush（宁可等下一拍，也不提前发半批）；② 超界不静默 —— 丢的条数与字节数进批结算，并让通道状态落 `saturated`；③ 失败不抛 —— 导出异常只记 `failures` 并清空待发区（留着会无限涨），状态落 `unjudged`。

**测试**：`test_otel_log_channels.py` **14 例**（空批不算 flush / 条数界 / 字节界 / UTF-8 按字节 / 单条超界整条丢 / 非法界 ValueError / 三界 flush / 成功 enabled / 超界 saturated / 无导出器 unjudged 不抛 / 导出失败记账 / 失败后待发区清空 / disabled 通道）；与四个既有 telemetry 测试合并 **227 例**全绿；ruff 0（自动修两处 import 排序）；`mypy --strict` 两文件 **0 error**（输出里 775 条全在其他存量文件）。

**超越轴**：可测性 + 超界可见。取证件只管「发出去」；本仓把「一次最多多少、超了多少字节、这批为什么被截」做成可断言结构，并把「丢过」与「没建起来」分成两个独立状态。

**诚实边界**：本层只管批语义与界，**不判断日志内容该不该上报**（脱敏在别层）；SDK 侧批尺寸仍用 `BatchLogRecordProcessor` 默认值，本层的界用于会话日志面自建批的判据。

## 20. B3-04 提交内存余量预判

**来源**：取证件在起大任务 / 编译 / 批量写之前先读系统**提交内存**（物理 + 页面文件总和），失败时能说清「是机器没余量」而不是「任务自己崩了」。本仓此前没有任何"这台机器现在撑不撑得住"的读数。

**落地（3 文件）**：

- 新增 `apps/desktop/src-tauri/src/system_memory.rs`：`MemoryReading` 四字段（物理总量 / 物理可用 / 提交上限 / 提交可用）+ 四态 `ok` / `tight` / `critical` / `unjudged` + `classify_pressure(reading, requested_bytes)` 纯判据 + `probe_pressure` 唯一执行入口 + `read_memory`（Windows `GlobalMemoryStatusEx`，非 Windows 恒 `None`）
- `Cargo.toml` 补 `Win32_System_SystemInformation` feature（同版本 windows 0.61，**不添新副本**）
- `lib.rs` 接线 `system_memory_pressure(requested_bytes: Option<u64>)` 命令

**判据四条**：① **取不到不冒充** —— 缺读数、提交上限读成 0 一律 `unjudged` 并点名原因（读成 0 只可能是读数坏了，按 0 算会把一切都判成 critical）；② 请求本身超余量 ⇒ 直接 `critical`，不等百分比那一档；③ 分档看**扣掉请求之后**的余量占比（< 15% `tight`、< 5% `critical`，阈值是常量可单点调）；④ 余量减法不下溢 —— `requested == avail` 判 critical 而不是 panic。

**测试**：`system_memory` **8 例**（缺读数 unjudged / 零提交上限 unjudged / 充足 ok / 请求超余量 critical / 请求吃掉余量降档 / 阈值严格小于 / 边界不下溢 / **真机四字段读面**）；真机用例在本机实跑到 `GlobalMemoryStatusEx`（提交上限 > 0、可用 ≤ 上限）。

**超越轴**：「请求量」作为入参显式计入判断，且把「没读到」与「读了但不紧」分成两个状态 —— 取证件只报能不能扛，前端在他那条路上无法区分「本机不支持」与「确实有余量」。

**诚实边界**：只做读面与判据，**不负责释放 / 降级**（谁申请失败谁退避）；阈值是常量，不是按机型自适应学出来的。

## 21. B4-03 自举 runner 的编译态 / 源码态单源判据

**来源**：取证件对「同一入口在源码态与编译态各该怎么起」有明确判据；本仓两处自举脱离式 runner 的拼法**各自为政**。

**病灶（现读证据）**：

- `apps/cli/src/sandbox/egress/proxy-relay-host.ts` 早已补了源码态加载器（`/\.(?:ts|mts|cts)$/ ⇒ ['--import','tsx']`），并在注释里承认这是唯一一份；
- `apps/cli/src/util/parent-bound.ts` **没有任何形态判定** —— 直接 `spawn(process.execPath, [modulePath, RUNNER_FLAG, ...])`，而 `modulePath` 在源码/tsx 态就是 `.ts`，`node x.ts` 必失败；失败被 `runner.on('error', () => {})` 静默吞掉，只剩注释里一句「dev TS 无加载器等形态 ⇒ 静默降级」。**看门狗在这一态从未真正拉起过，账面却看不出来。**

**落地（4 文件）**：

- 新增 `apps/cli/src/util/run-mode.ts`：形态三态（`compiled` `.js/.mjs/.cjs` / `source` `.ts/.mts/.cts` / `unjudged` 其他）+ `isNodeExecutable`（basename 非 node ⇒ SEA / 打包器，不能当解释器）+ `stripTypesSupported(nodeVersion)`（22.6+，解析失败一律 false）+ `canImportTsx()`（`createRequire().resolve('tsx')`，零启动副作用）+ `planSelfRunner` 唯一判据（compiled 直跑 / source 先 tsx 再 `--experimental-strip-types` / 两条都没有 ⇒ `ok:false` 点名 `source-entry-without-loader`）
- 接线 `parent-bound.ts`：先 `planSelfRunner` 再见面（`!ok ⇒ return null`，不再盲 spawn 后吞错）
- 接线 `proxy-relay-host.ts`：runner 与 probe **两条腿**都换成同一 plan（旧 `loader` 拼法清零）
- 新增 `apps/cli/tests/run-mode-b4-03.test.ts` 13 例

**判据四条**：① 形态认不出的入口一律 `unjudged`（不按「猜是 js」处理）；② 执行器身份先于形态判（SEA 下 `process.execPath` 不是 node，拿它起脚本必然失败）；③ 源码态加载器有两条正路（仓内 `tsx` 优先、Node 22.6+ `--experimental-strip-types` 兜底）；④ **两条路都没有 ⇒ 不起进程也不冒充**（失效方向是多要一次说明，不是多放一次跳门）。

**测试**：13 例（形态家族成对 / 认不出不猜 / execPath 身份 / strip-types 版本边界 / `canImportTsx` 现读 / compiled 直跑 / tsx 参数顺序 / strip-types 兜底 / 双双缺失点名 / execPath 拒绝先于形态 / 扩展名点名 / **两处接线回潮闸**：`parent-bound` 不得再出现 `[modulePath, RUNNER_FLAG`、`proxy-relay-host` 必须 `planSelfRunner` 恰两次且旧 `[...loader, modulePath` 清零）；与 `parent-bound.test.ts`(12)、`egress-relay.test.ts`(10) 合并 **35 例**全绿；`pnpm turbo typecheck --filter=ihui-cli` 8/8 成功。

**一次真实回归**：首版把 plan 块插在 `payload` 定义之前 ⇒ `tsc` 报 `TS2448/TS2454`（block-scoped 变量先用后定义）；测试全绿而类型检查红 —— 与 P0-4 那次「`_PreGate` 字段错位」同一类教训：**行为测试挡不住声明顺序错**。已按 `identity → payload → plan → spawn` 重排。

**超越轴**：单源 + 可断言。取证件把两态判断埋在启动包装里；本仓把「当前是哪一态、用哪个加载器、为何拒绝」做成纯函数返回值，并用回潮闸钉住两处接线，防止下一个人再补一份。

**诚实边界**：只判「怎么起得起来」，不判「起来后活得对不对」（看护语义仍在 `parent-bound` 的裁决里）；`--experimental-strip-types` 只覆盖可擦除语法，遇到 enum / 装饰器等不可擦除语法仍要 tsx。

## 22. B1-05 会话附加目录接入 sandbox 的 workdir 收敛

**来源**：取证件「沙箱三级策略 + 会话级额外可写根」。

**复核结论（重要，先说明不重造什么）**：会话级附加目录在本仓**早已存在** —— `mcp_server` 的 `_SESSION_EXTRA_ROOTS` 是 `BoundedTtlDict`（6h TTL / 5000 键上限 / `(主体,会话)` 复合键 / 系统根与伪文件系统一律拒 / 经 ContextVar 注入 handler 的 await 链）。本轮**不重造注册表**（§0.6 单一真相源、§0.22c 第二份判据必然漂移）。

**真正的缺口（一致性缺陷，现读）**：同一份附加目录，两条路径判据不同 —

- local 路径：`run_command` 的 cwd 校验走 `_validate_path_in_workspace`，该函数**兜底查 ContextVar** ⇒ 认会话附加目录；
- 非 local 路径（docker / ssh / modal / daytona / singularity）：直接 `sandbox_executor.execute(workdir=cwd)` ⇒ `_resolve_workdir` 只认静态 `MCP_WORKSPACE_ROOTS` ⇒ **不认**。

结果：一次 `add_directories` 之后，同一命令在 local 后端跑得通、换 docker 后端就被判「越出工作区根」。用户看到的是"功能随机失效"。

**落地（3 文件）**：

- `sandbox.py`：新增 `_merge_writable_roots(base, extra)`（唯一合并口径：去重、静态在前、空项剔除）；`_resolve_workdir(profile, workdir, extra_roots=None)` 改为「静态 ∪ 附加」；`execute(...)` 增 **keyword-only** `extra_writable_roots`（追加在末尾，避免位置参数错位）；`_execute_local(...)` 透传同一份；
- `mcp_server.py`：非 local 分支补 `extra_writable_roots=list(_active_extra_roots()) or None`（+3 行，含说明）；
- 新增 `apps/ai-service/tests/test_sandbox_session_roots_b105.py` **10 例**。

**判据三条**：① 附加集**只扩不收** —— 静态根内的路径不因附加集而变严（与 mcp_server 的两态纪律同源）；② 合并口径唯一实现（去重 + 静态在前，两处调用都走它）；③ 空 / 缺省附加集 ⇒ 与改动前**逐字等价**（`None`、`[]`、不传三者结果一致）。

**测试**：10 例（无附加集拒（文案必须点出"会话附加目录"这一维）/ 有附加集放行 / 只扩不收 / 附加集外仍拒 / relaxed 档不受影响 / 空集等价 / 合并去重与空输入 / **端到端 local 真跑** `echo`（传附加根 ⇒ exit 0，不传 ⇒ `SandboxError`）/ **接线回潮闸**（`mcp_server` 传参逐字 + `sandbox.py` 两处调用逐字）；与 sandbox 七个受影响面（`test_sandbox` / `g212_strict_default` / `code_exec_sandbox` / `os_sandbox` / `sandbox_network_mode` / `sandbox_enforcement_gate` / `sandbox_lifecycle`）合并 **298 例**全绿；ruff 0；`mypy --strict` `sandbox.py` 0 error。

**超越轴**：两处判据**一条腿**。取证件把「会话可写根」放在自己那一层；本仓此前是"一处认、一处不认"，本轮把合并口径收成单一实现并用回潮闸钉住，还顺手把「只扩不收」写成可断言行为（不是注释里的承诺）。

**诚实边界**：注册表（TTL / 上限 / 主体绑定 / 系统根拒）仍归 `mcp_server`，本层只做消费；本轮只接 `run_command` 的非 local 分支；modal / daytona / singularity 的 `workdir` 由各后端自行解释，本层只保证**传入前**判据一致。

## 23. P0-8 第二批：代码实体/关系边表 + 索引状态幂等

**来源**：取证件 block2（Trae 的 CKG 代码知识图谱：实体节点 + 关系边，按文件路径/名称建索引）与 block3（Qoder 的增量索引：以「配置指纹 + 上次索引时刻」判要不要重建）。

**为什么分两批**：第一批（`fde9dc53`）只做了「索引完整性审计」——在**已有**的 `codebase_chunks` 上量向量覆盖。取证件里真正支撑「跨文件符号级检索」的骨架是实体表和边表，本仓此前**一张都没有**；再往上一层，取证件那套「增量索引」还有一个本仓完全没有的前提：**索引状态本身没有持久化落点**，每次索引都是一次性从头做，没有任何地方记得"上次用什么配置跑到哪一步"。

**落地（5 文件 + 1 迁移）**：

- `packages/database/src/schema/codebase-index.ts`：新增三表 ——
  - `codebase_entities`（`file_path` / `line_start` / `line_end` / `kind` / `name` / `signature`），三条索引：`(owner_uuid, repo_id)`、`(owner_uuid, repo_id, name)`、`(owner_uuid, repo_id, file_path)`；
  - `codebase_edges`（`from_entity_id`（可空，允许解析未命中时只记 `from_name`）/ `from_name` / `to_name` / `kind` / `file_path` / `line`），三条索引：`(owner, repo)`、`(owner, repo, to_name)`、`(owner, repo, from_name)`；
  - `codebase_index_states`（`owner_uuid` **NOT NULL** / `repo_id` / `config_fingerprint` / `last_run_id` / `chunk_count`（默认 0）/ `last_indexed_at`），唯一索引 `(owner_uuid, repo_id)`。
- `packages/database/drizzle/20261123151500_codebase_entity_edge_state.sql`：手写迁移（本仓迁移惯例 = 手写 SQL + journal 追加，`meta/` 只有 13 份 json 而迁移 448 条，不走 `drizzle-kit generate`）；**CREATE TABLE / INDEX / UNIQUE 全部带 `IF NOT EXISTS`**，重放安全。
- `packages/database/drizzle/meta/_journal.json`：追加 idx 448（现 449 条，末条即本条）。
- `apps/api/src/services/codebase-index-service.ts`：索引状态判据层 ——
  - `CODE_INDEX_CONFIG_FINGERPRINT_DEFAULT = 'v1536:tree-sitter-chunk-v1'`，`resolveIndexConfigFingerprint(env)` 允许 `CODE_INDEX_CONFIG_FINGERPRINT` 覆盖、空白回落默认；
  - `needsRebuild(prev, currentFingerprint, nowMs, maxAgeMs)` 纯判据，返四态 `rebuild-no-state` / `rebuild-config-changed` / `rebuild-stale` / `reuse-fresh`；
  - `getIndexState(ownerUuid, repoId)`（无归属**零 DB 调用**直接返 `null`）、`markIndexed({...})`（空 `ownerUuid` 或空指纹**写前抛错**；`onConflictDoUpdate({ target: [owner_uuid, repo_id] })` 幂等写）；
  - `indexChunks` 末尾 best-effort 调 `markIndexed(...).catch(warn)` —— **标记失败不影响本次索引结果**，不让记账腿把索引腿带死。
- 新增 `apps/api/src/services/__tests__/codebase-index-entity-state.test.ts` **13 例**。

**判据（本轮真正学到的东西，逐条）**：

1. **判序固定**：`没状态 → 配置变 → 过期 → 可复用`。前两档是"必须重建"的硬理由，第三档才是时间窗口；把时间窗口放前面会让「配置变了」这件事被 `reuse-fresh` 掩盖。
2. **时钟倒挂按 stale**：`nowMs - lastIndexedAt <= 0` 判过期而不是"新鲜"。取证件那套按 `lastIndexedAt + maxAge` 比大小，时钟回拨会算出负数剩余时间 ⇒ 永久新鲜。本仓显式把倒挂归到「重建」这一侧（fail-safe 方向）。
3. **窗口边界取闭**：恰好等于 `maxAgeMs` 不算过期（`<=` 而非 `<`），`maxAgeMs <= 0` 则**完全不判时间**（调用方显式关掉时间维，而不是被当成"永不过期"）。
4. **无主状态行拒写**：`owner_uuid` 是 NOT NULL 且 `markIndexed` 在写之前抛错。多租户表里放一条 `owner_uuid = ''` 的状态行，等于给全租户开一条共享缓存 —— 这是比「漏写」更坏的事故。
5. **幂等靠唯一索引 + upsert**，不靠「先查再写」。查-写窗口里并发两次索引会双双判"没状态"，然后写进两条。

**测试**：13 例。`vi.hoisted` 暴露 `calls` / `selectResult` / `values` / `conflict`，`vi.mock('../../db/index.js')` 用链式 stub 记录 SQL 调用，`vi.mock('../embedding-provider.js')` 断掉 embedding 网络腿；schema / 迁移 / 接线三面用 `fs.readFileSync` **源码扫描**而非 `getTableConfig`（drizzle 0.38 的 `getTableConfig` 在当前版本上 API 有漂移，取表配置会假红）。与第一批 14 例合并 **27 例绿**；`pnpm turbo typecheck --filter=@ihui/api` 9/9。

**一次真实回归（值得记）**：13 例首跑 10 绿 3 红，红在源码扫描那三例 —— `REPO_ROOT = path.resolve(__dirname, '../../../..')` 只上溯到 `apps/`，把 `apps/apps/api/src/...` 当成了路径。测试文件在 `apps/api/src/services/__tests__/`，到仓库根要 **5 层**。这类错误行为测试看不出来（它只会 `ENOENT`），属"测试自己的环境假设错了"，与业务判据无关。

**超越轴**：取证件把「索引状态」当成缓存元数据随手写；本仓把它做成**有判据的四态纯函数 + 写前拒绝非法身份的幂等写 + best-effort 标记不污染主结果**。三件事都可断言，且 `needsRebuild` 零 IO —— 不连库就能测边界（含时钟倒挂这种只有跑久了才会遇到的情况）。

**诚实边界（必须写清）**：本轮只落 **表 + 判据 + 幂等状态标记**。**实体/关系边的写入通道尚未接** —— `indexChunks` 只写 chunk，实体解析（tree-sitter 到符号）仍在 ai-service 的 `codebase_indexer` 侧，本仓没有任何代码往 `codebase_entities` / `codebase_edges` 里写一行，也没有消费方。所以这两张表现在是**已建好但未通电**的骨架；`needsRebuild` / `getIndexState` 目前只有测试消费方，真正该调它的上层（索引任务调度）尚未定承载。这一档我按"可派单的真工作"留在台账（写入通道 + 消费方各是一枚独立工单），不谎报成"已通电"。

## 24. 收尾：44 条候选处置总表与交付边界

**量**：取证席产出 44 条候选（A 19 / B 21 / C 4，去重后的 ID 全集 = B1×11 / B2×11 / B3×10 / B4×12）。我这一侧落地 **27 条**（对应 25 枚提交，含 A 段装车、P0-8 两批、B1-07/B1-09/B3-03 重头复检，以及本轮八条收口批），他席落地 2 条（B1-08 `d2b4b528` / B4-09 `8ee6291a`），不采纳 10 条，已有等价 5 条，待开发 **0 条**。27 + 2 + 10 + 5 + 0 = 44。

### 24.1 已落地（27 条候选 / 25 枚提交）

| 候选 | 设计 | 提交 | 落点 |
|---|---|---|---|
| B2-01 | 沙箱能力三态探测 + 12 原因码 + 不支持即拒 | `57391e73` | `sandbox_sdk.rs` / `sandbox_ipc.rs` |
| B1-02 | 终态前输出完成闸门（双游标 + lossy + 结算四态） | `6f51d5c2` | `output_ring.py` |
| B2-03 | 终端输出 drain 闸门（读线程计数 + 丢尾如实标） | `4f7de183` | `terminal_session.rs` |
| B4-06 | home 凭据目录 deny 族（SSH/GnuPG/AWS/kube/docker/netrc/pypirc） | `18044ae2` | `file-access-policy.ts` |
| B2-09 | 索引完整性审计（缺向量统计 + 四态） + 实体/边表 + 状态幂等 | `fde9dc53` / 本枚 | `codebase-index.ts` / `codebase-index-service.ts` |
| B1-01 | 工具超时结构化分类（`TOOL_TIMEOUT` + 嵌套 deadline 隔离） | `72b182a3` | `tool_timeout_result.py` |
| B1-03 | 重复调用 3/5/8 分级提醒（只改措辞、不新增否决点） | `f2897112` | `repeat_call_reminder.py` |
| B1-05 | 会话附加目录接入 sandbox workdir（只扩不收） | `2364f996` | `sandbox.py` / `mcp_server.py` |
| B1-11 | OTel 日志通道三界批语义（64 条 / 32KB / 10s） | `ec781c0a` | `otel_log_channels.py` |
| B2-10 | 出站拦截四桶记账与恒等式 | `43911aae` | `sandbox_metrics.rs` |
| B3-04 | 提交内存余量预判四态 | `687c0409` | `system_memory.rs` |
| B3-05 | 通知权限三态查询（只读不冒充） | `0c717ac3` | `notification_permission.rs` |
| B3-06 | 剪贴板一次性读取票据（二次消费即拒） | `0280efbd` | `clipboard_grant.rs` |
| B4-02 | 子进程 env 白名单通道（未登记默认不进） | `276aa2cd` | `env-channel.ts` |
| B4-03 | 编译态/源码态单源判据（+ 双目回潮闸） | `9e4dfe9e` | `run-mode.ts` |
| B4-08 | 启动画像 span 树（嵌套/并发/停采） | `6aaaccb0` | `span-tree.ts` |
| B1-07 | provider 级 LLM 重试路由（白名单 / always / 确定性 retryId / 可中断退避） | `e0ecbb17` | `llm_retry_policy.py` / `agent_loop_v2.py` |
| B1-09 | 子代理 fork/spawn 双上下文（终态平衡前缀 / 深度上限 / 工具面接线） | `33ab1e7b05b5817da1cb63d2ff3829bf04bf499d` | `subagent_backends.py` / `subagent_jobs.py` / `mcp_server.py` |
| B3-03 | 协作 CLI 身份三档（User/RuntimeOwner/RuntimeAgent）+ 退出码 0/3/4/130 + 幂等键 | `ce18ffb2b2d2d20749f3d25f68a095081c226c2b` | `collab/identity.ts` / `collab/exit-codes.ts` / `subagent-collab.ts` |
| B2-02 | IPC 命名管道受限 DACL（当前用户 + SYSTEM 两条 ACE，创建失败即拒） | `e61b0f229feb5e72955e4d8fe7dd372cca31b345` | `ipc_channel_acl.rs` / `sandbox_ipc.rs` |
| B2-07 | BP_* 原生模块统一 ABI（三出口 + 头三判据） | `e61b0f229feb5e72955e4d8fe7dd372cca31b345` | `native_module_abi.rs` |
| B3-01 | 浏览器桥 `connectNative` 客户端 + Chrome host 入口 + 安装器 | `acd2c821a4bd306a45da0474da827fcf6cc42377` | `native-host-client.ts` / `ihui_native_host.rs` / `install-extension-native-host.mjs` |
| B3-07 | 请求元数据四层 + PG 追踪 + patches 增量编辑 | `97f6d7a6ac806fdbd631c036e5bcb18a675ad100` | `request_metadata.py` / `chat_patch.py` / `llm.py` / `v1-public.ts` |
| B3-08 | worker 五类行协议（ready/exit/error/message_delta/complete） | `1d92ac7738789bf853e218c23aa4befbf29bd352` | `worker-protocol.ts` / `worker-pool.ts` / `worker-entry.ts` |
| B3-09 | 自托管 RTC 音视频中继（房间令牌 + 两端配对 + 音视频帧） | `1d92ac7738789bf853e218c23aa4befbf29bd352` | `rtc/bridge.ts` / `commands/rtc.ts` |
| B4-05 | 更新后优雅自重启状态机（任务排空 + 异步 spawn 确认 + 预算） | `1d92ac7738789bf853e218c23aa4befbf29bd352` | `daemon/graceful-restart.ts` / `index.ts` |
| B4-07 | 网络边界双引擎（DNS hook + 常驻 TCP LocalProxy） | `1d92ac7738789bf853e218c23aa4befbf29bd352` | `egress/local-proxy.ts` / `dns-hook.ts` / `network-boundary.ts` |

**他席并发落地（同批候选，提交不属于我这一侧）**：`B1-08`（回合级工作树快照收敛 turn.diff，`d2b4b528`）、`B4-09`（`ihui-lowmem` 低内存 V8 启动档，`8ee6291a`）。这两条原本落在我的"待立项"里，落地时点已被他席先做掉 —— 下表按本表落笔时刻（2026-11-23 16:0x）的快照记账，不追认他人的提交。

### 24.2 不采纳（10 条，判据是复核推翻而不是"没排期"）

| 候选 | 取证席的判断 | 复核结论 |
|---|---|---|
| B1-04 | 「未知档位静默折成 `on_request` = fail-open」 | **不成立**。`never` 才是恒 auto-approve（`patch_safety.py:132-134`），`on_request` 更严；既有 58 号票测试已钉成契约，改动使该面转红 ⇒ 已完整回滚。真正剩余的是「两套档位字面量单一真相源」，另立工单 |
| B2-05 | 命令级 `timeout_ms` 显式入参 | 与 B1-04 同族同域（P0-1 合并），随 B1-04 一并搁置 |
| B2-06 | 回合前上下文自检钩子 | 须改工具结果回填流（`agent_loop_v2.py` 巨型文件），单独立项不合适塞进本轮批量 |
| B4-01 | 反向守护进程拓扑 | 落点 `apps/cli/src/daemon/` **不存在**，CLI 侧无 PG 依赖 ⇒ 先定承载再谈实现 |
| B4-04 | 跨进程注册表三判据 | 同上（注册表的归宿是 PG，但承载目录未定） |
| B1-06 | 目标自动续轮竞争裁决 | 落点 `goal_round_driver.py` **本仓不存在**，ai-service 无 goal 轮次驱动 ⇒ 新建即零消费点 |
| B2-04 | 分级看门狗重连 | 本仓 worker 是一次性任务，重启 = 重复副作用，无常驻承载（与 B4-11 同因） |
| B4-11 | 崩溃看门狗重启腿 | 同上；`handleWorkerExit` 确认无重启腿，但加腿会制造重复副作用 |
| B4-10 | lazy chunk manifest 防污染 | `prewarm.ts` 只有单状态件、无 chunk 清单机制 ⇒ 照搬只会得到一个纸面件 |
| B4-12 | 会话历史清理按路由意图开关 | CLI 侧**没有启动期历史清理动作**：`session.ts` 只提供 `deleteSession(id)` 手动删，`repl.ts`/`serve.ts` 启动路径均不触发清理 ⇒ 没有可被开关控制的对象，照搬即纸面件（与 B4-10 同因） |

### 24.3 已有等价（5 条）

`B1-10`（输出留存原语：`services/spill_retention.py` 已含 UTF-8 字节计价、头尾预算二分、图片不可切、`omitted_bytes`/`omitted_images` 精确差分 —— 取证席所列四点已逐条在位）· `B2-08`（ContextFS 动词面：`context_fs.py` 只做路径解析，动词由既有工具名承担）· `B2-11`（快照只读面：`checkpoint_rewind.py` 4 端点其中 3 个只读）· `B3-02`（进程组判活：`terminal_session.rs` 的 Job Object 内核兜底比枚举判活更稳）· `B3-10`（硬件键盘钩子：**不建议照搬**，本仓走全局快捷键配置化）。

### 24.4 剩余待开发（0 条，原 8 条已全部收口）

原清单 `B2-02` / `B2-07` / `B3-01` / `B3-07` / `B3-08` / `B3-09` / `B4-05` / `B4-07` 已全部落地，逐条落点见 24.1 表末八行，验证与边界见 24.5；没有「已有等价」「业务面不同」「下轮再说」这类替代结论。**计数归零不等于每一条都拿到了生产级证据**：Rust 编译、真 PG 写入、真 Chrome host 构建、真更新安装触发的缺口逐条写在 24.7，不在这里抹平。

### 24.5 本批八条收口：验证与真实边界

| 候选 | 提交 | 已跑过的验证 | 真实边界（不冒充的部分） |
|---|---|---|---|
| B2-02 | `e61b0f229feb5e72955e4d8fe7dd372cca31b345` | 模块内纯逻辑测试（SID/SDDL/管道名三组）；`selftest` 真实创建路径已写 | 本机无 rustc/cargo，Rust 编译与 `cargo test --lib` 未跑；Windows FFI 仅静态审阅 |
| B2-07 | `e61b0f229feb5e72955e4d8fe7dd372cca31b345` | `validate_interface_header` / `validate_module_path` / `probe` 失败路径单测 | 仓内没有真实 `BP_*` DLL，未加载过任何厂商模块；只有加载器与拒错 |
| B3-01 | `acd2c821a4bd306a45da0474da827fcf6cc42377` | 扩展 6 例绿 + typecheck 0 错；安装器 dry-run 输出 manifest/registry | `cargo` 未构建 `ihui_native_host.exe`，`--apply` 未写注册表；host 二进制无本机运行证据 |
| B3-07 | `97f6d7a6ac806fdbd631c036e5bcb18a675ad100` | Python 19 例绿 + ruff 全绿；API schema 7 例绿；API typecheck 0 错 | PG 追踪表建表/写入用 mock 连接池验证，未连测试 PG 实跑；patches 在 LLM 请求进入模型前原子应用，不改持久化会话日志 |
| B3-08 | `1d92ac7738789bf853e218c23aa4befbf29bd352` | 13 例绿；worker 回归 3 套 20 例绿；CLI typecheck 0 错 | 协议只覆盖五类控制/增量事件，不接管 runAgent 的其它 NDJSON 业务事件 |
| B3-09 | `1d92ac7738789bf853e218c23aa4befbf29bd352` | 5 例真实 WebSocket 双端/三端/畸形帧/控制帧；CLI typecheck 0 错；`ihui rtc --help` 可见 | 自托管中继，不是浏览器 WebRTC 完整协商栈；未依赖 `aoq_node_ext.node` / `AoqClientSdk.dll`，未与 Qoder 私有 SDK 互通 |
| B4-05 | `1d92ac7738789bf853e218c23aa4befbf29bd352` | 9 例（含异步 spawn error 不退出旧进程）；启动 preAction 消费标记 | 本仓更新器只有检查没有安装 apply ⇒ 生产触发需调用方在拿到 `apply` 计划后调 `requestAfterUpdate`；当前没有安装器调用点 |
| B4-07 | `1d92ac7738789bf853e218c23aa4befbf29bd352` | 8 例（HTTP/CONNECT/403/400/DNS callback/promises/env 还原）；CLI typecheck 0 错 | 代理只覆盖 HTTP/S 与 CONNECT，不解析 SOCKS；DNS hook 不接管 DoH/自带解析器的私有客户端 |

### 24.6 本轮真正学到的三条（不是功能清单）

1. **"语义方向"必须先验再抄**：`never` 在对照方是确定性拒绝、在本仓是恒免审。同样的档位名，方向相反。抄名字 = 把 fail-open 抄得更彻底（B1-04 的教训）。
2. **判据要纯函数化才能测边界**：`needsRebuild` 零 IO 之后，「时钟倒挂」「恰好等于窗口」「`maxAgeMs <= 0`」这些只有跑久了才会遇到的情况，全都变成三条断言。取证件把这类判断埋在流程里，本仓抽出来。
3. **测试自己的环境假设也要被审**：`REPO_ROOT` 少上一层那次，13 例红 3 例，红的是「测试找错目录」而不是业务判据；再加 P0-4 的 `_PreGate` 字段序、B4-03 的 plan 块声明顺序 —— 三次都是"行为绿、类型/路径红"。**行为测试挡不住声明顺序与路径假设**。

### 24.7 交付边界（不谎报的部分）

1. **原生层未做全量反编译**：284MB `ai_agent.dll` / 266MB `harness.dll` / 100MB `toolhost.dll` / 101MB `agent-tool-host.exe` 一律止于导出表 + 导入表 + 定向字符串；`ghidra found=false` 未启用原生分析。
2. **未运行四个程序本体**：所有动态结论（时序、并发交错、洪峰、规则执法强度）只到「推断」档，无「观察」档。
3. **P0-8 第二批复用通道未通电**：`codebase_entities` / `codebase_edges` 已建表但**没有任何写入点、没有消费方**；`needsRebuild` / `getIndexState` 目前只有测试消费方，上层调度承载未定（见 24.4 之外的独立工单）。
4. **门缺陷：两修一待**。① 门 30a（commit 丢失风险）此前被我记作「恒红无出路」，本轮现读实测**不恒红**（直跑 `exit 0`，14 枚悬空 commit 落在「30 天窗内」的报数档）；真缺陷在**建议文案**——它教人 `git tag lost-commit/<name> <hash>` 备份，而该动作被 `.husky/reference-transaction` 在引用事务层硬禁（用户 2026-11-22「本仓从今天起不保留历史」定案，`--no-verify` 也绕不过），照做必失败 ⇒ 已改成该政策下真能执行的三条（`git cherry-pick <hash>` 拾回 / `git show <hash>` 查看 / 确认丢弃即无须处置），并把「已备份即放行」这一分支的恒假现状写进脚本注释。② `[298]` 工作树臂扫他席旧档，未修。③ `codebase-index-tenant-isolation.test.ts` 的 `renderSql` 假绿（缺 drizzle 0.38 `getColumnCasing`），刻意避他席在飞面未回灌。
5. **顺手根治一处存量漂移**（属本轮落地附带）：journal 里 `20260928050000_lessons_difficulty` 一直有条目，但对应 `.sql` 在 `4fa6b2cf`「仓库最终快照」里丢了 —— `migrate()` 找不到文件、按链新建的库缺 `lessons.difficulty` 列，而 `schema/learn.ts:71` 以为它在；`check-drizzle-journal-sync` 因此常红（`journalOnly=1`），任何触碰 `packages/database/drizzle` 的提交都会被拦。本轮按 schema 反推补齐该迁移（`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "difficulty" varchar(20)`，幂等可重放），落地后该门 `state=ok entries=449 sqlFiles=449 problems=0`。
6. **本批八条逐条边界**：Rust 未编译、PG 未真连、Chrome host 未构建、更新安装未触发、RTC 非完整 WebRTC 栈 —— 全部列在 24.5 表，不用「已落地」三个字覆盖。

## 25. P0-8 第三批：实体写入通道通电（2026-11-23）

> 与 24.1 表的关系：那张表的 P0-8 行记的是第二批（表 + 迁移 + 幂等判据）。本节把 `codebase_entities` 从"有表无写"推到"有真实生产写入方"，24.1 行不再单独改写。

### 25.1 决定性发现：切片已经自带符号身份

`ChunkInput`（`apps/api/src/services/codebase-index-service.ts` 第 31-46 行）已带 `symbolName` / `symbolType`，由 ai-service 的 tree-sitter 切片器给出。生产链是完整的：`apps/ai-service/app/services/codebase_indexer.py:1064` → `POST {api_base}/api/v1/codebase/index` → `apps/api/src/routes/v1-codebase-search.ts:192` 的 `server.post('/index')` → `codebaseIndexService.indexChunks(repoId, chunks, req.userId)`。

因此**实体派生放进 `indexChunks` 内部就是"真通电"**，不需要另起一条骨架管线。另一点是本仓 Python 侧已有等价能力：`apps/ai-service/app/core/code_symbol_graph.py`（symbol_index / callers / references / impact，纯正则、自带 `approximate=True`）与 `apps/ai-service/app/services/codebase_symbol_catalog.py`。本批不重复造第二个解析器（§0.6 单一真相源），做的是"持久化落点 + 与切片同事务的写入通道"。

### 25.2 派生口径（纯函数）

`deriveEntitiesFromChunks(chunks: readonly ChunkInput[]): EntityDraft[]`，零 IO、可直接单测：

| 纪律 | 取值 | 理由 |
| --- | --- | --- |
| 身份键 | `${filePath}\u0000${kind}\u0000${name}` | 同一符号跨多个切片出现 ⇒ 合并成**一行**（行区间 min..max），不因出现两次在符号图里变成两个节点 |
| 无符号 | `symbolName` 缺失或纯空白 ⇒ 跳过 | 不拿文件名冒充符号 |
| 种类 | `symbolType` 去空白后取，缺省 `'symbol'` | 缺省值不猜具体种类 |
| 排序 | `(filePath, lineStart, name)` 稳定排序 | 对账时可逐行比对 |

### 25.3 同一事务、同一粒度

切片的幂等语义是"按 (归属, 仓库, 文件) 先删后插"。实体必须跟同一粒度：`indexChunks` 事务内每个 `filePath` **先删 `codebase_chunks` 再删 `codebase_entities`**，切片插完后按 `BATCH_SIZE=100` 分批 `insert(codebase_entities)`，累计 `entities` 计数随返回值给出（空入参短路返 `entities: 0`，不产生空 INSERT）。

返回类型因此从三字段变成 `{ indexed, vectorized, localEmbedded, entities }`——这是对外契约的加法，既有调用方按属性取值，不受影响。

### 25.4 删除面同步（否则留幽灵节点）

三处删除方法各自追加实体删除，且**返回的 chunk 删除数语义不变**：

- `deleteByRepo(ownerUuid, repoId)`：整库清 ⇒ 实体同条件整清；
- `deleteByFileScoped(ownerUuid, repoId, filePath)`：单文件 ⇒ 总等实体同条件；
- `deleteByFiles(ownerUuid, repoId, files)`：批量 ⇒ 实体在**同一 in 批次**内用同一归属谓词清掉。

不这么做的后果是可观测的：`DELETE /repo/:repoId/files` 只删切片，实体会留成"指向已不存在文件"的节点，按名检索会持续命中幻影。

### 25.5 归属谓词不复用（本批唯一踩到的变量坑）

`_ownerScope(ownerUuid)` 绑的是**切片表两列**（`codebase_chunks.owner_uuid` + `or(isNull(expires_at), expires_at > NOW())`），实体表没有过期列 —— 直接套用会生成指向不存在列的 SQL。故另立 `_entityOwnerScope`：无归属返 `sql\`1 = 0\``（fail-closed，不返回任何行），有归属返 `eq(codebaseEntities.ownerUuid, ownerUuid)`。该谓词在文件中出现 **5 次**（定义 1 + `indexChunks` 1 + 三删除方法 3），测试按此计数断言，防日后有人图省事把两表谓词合并回去。

### 25.6 验证

- 新增 `apps/api/src/services/__tests__/codebase-index-entity-write.test.ts` **14 例**：A 组 9 例钉派生（空数组/无符号跳过/纯空白跳过/同符号跨切片合并 min..max/同文件不同 kind 不合并/跨文件同名不合并/kind 缺省/排序/不改入参）；B 组 3 例钉删除面（`deleteByRepo` 两次 delete、`deleteByFiles` 两次 delete、空清单零动作）；C 组 2 例钉源码面（`_entityOwnerScope(` 出现 5 次；`deriveEntitiesFromChunks` + `insert(codebaseEntities)` + `entities: number` + 返回值逐字）。
- 与第二批 13 例、首批 14 例**合跑 41 例全绿**（3 文件）。
- `tsc --noEmit`：本批两文件 0 错误。全仓唯一剩余 `TS2353`（`apps/api/src/services/wechat-hub/analysis.ts:207` 的 `relations` 不在 `WechatAnalysisResult` 里）来自**他席未提交的新模块**（`apps/api/src/services/wechat-hub/`、`packages/types/src/wechat-hub.ts`、`packages/database/src/schema/wechat-hub.ts` 均为未跟踪新文件），与本节改动面无关。
- prettier 两文件绿；水印 `verify` 覆盖 2/2。

### 25.7 边界（不谎报已通的部分）

1. **`codebase_edges` 仍无写入通道**：边需要 import / 调用关系信息，切片未携带；要补就得在切片器侧带上 import 列表，属下一批。
2. **`codebase_entities` 仍无读取消费方**：没有查询端点，也没有检索路径读它。真实缺口是"按名 / 按文件查实体"的读端点，或与 `code_search` 做 union —— 表已经能写，下一步该让它被读。
3. **`needsRebuild` / `getIndexState` 仍只有测试消费方**：真正该调它的上层（索引调度、`codebase_incremental_bridge.py` 的增量桥）尚未接线。

## 26. P0-8 第四批：实体读面与 knowledge_fs 符号视图（2026-11-23）

> 第三批（`dc0526c8`）把实体表的**写**通了；这一批把**读**通了。没有读方，表就是死表——这一批的全部价值在于"符号名 → 跨文件定义簇"这条链路能被 agent 真的调到。

### 26.1 API 读面：`findEntities`

`codebaseIndexService.findEntities({ repoId, ownerUuid?, name?, kind?, filePath?, limit? })`，三条纪律各有对应的负面后果：

| 纪律 | 取值 | 不这么做会怎样 |
| --- | --- | --- |
| 归属 | 无归属直接返 `[]`，**零 DB 调用** | 先查一次再判空 = 每次空跑一条带 `1 = 0` 的 SQL（与 `search()` 的 SDB-39 同一取舍） |
| 过滤 | `name` / `kind` / `filePath` 一律 `eq` | 改成模糊匹配会命中近似符号名，把"定义位置"降级成猜测 |
| 限额 | `Math.min(Math.max(1, limit ?? 50), 200)` | 响应体是明文路径清单，不设上限时一次 import 重排就可能拉回上千行 |

输出按 `(filePath, lineStart, name)` 排序；字段只给 `id / filePath / lineStart / lineEnd / kind / name`，不带任何正文。

### 26.2 端点：`GET /api/v1/codebase/repo/:repoId/entities`

挂在既有 codebase 路由族内（随该族 preHandler 鉴权），四个查询位 `name / kind / filePath / limit`。

`limit` 走**显式解析**：`Number(q.limit)` 得到 `NaN` 或 `<= 0` 直接 400（"limit 必须是正整数"）。这里刻意不静默折成默认值——那会让"我传了 limit 却没生效"变成不可观测的行为。身份只取 `req.userId`，请求里没有任何能指定归属人的字段。

### 26.3 Python 消费方：`knowledge_fs.list_symbols` + `GET /ai/knowledge-fs/symbols`

这一层才是这一批的"超越轴"。对侧（Trae ckg）的 `CfsResolve` 只解析路径形态；本仓的 `read` / `stat` 也只认**一条已知路径**。而 agent 最常见的真实问法是"这个函数到底定义在哪个文件"——输入是**符号名本身**，输出是同名符号在仓库里**所有**定义位置（跨文件的簇，单文件切片给不出这个信息）。

每条定义位置同时给出 `path`（`/repo/<repoId>/<file>#<symbol>` 虚拟路径），agent 拿到就能直接 `read`，不需要再拼一次路径。

**空集三因三分**（不合并成一个"没找到"）：

| 状态 | 判据 | 收信人能做什么 |
| --- | --- | --- |
| `ok` | 实体表有行 | 直接 read |
| `path_missing` | 实体表空 **且** 路径清单也空 | 这个仓库还没建索引 |
| `catalog_missing` | 实体表空，但路径清单有切片 | 索引早于实体表，重建索引可补齐；与"符号确实不存在"同形，故本态不作断言 |
| `upstream_unavailable` | 实体清单或路径清单取不到 | 上游不可用，空集归因**未判定** |

`limit` 在 Python 侧同样夹到 `[1, 200]`，防止绕过路由的调用方把上限抬走。

### 26.4 验证

- API 新测试 `codebase-index-entity-read.test.ts` **9 例**：无归属/null/空串三条都断言"一次 DB 都不查"；limit 五个边界（默认 50、0→1、−7→1、999→200、200→200）逐值断言；源码面钉三个过滤位必须是 `eq`（并反证不出现 `ilike` / `like`）、夹取表达式全库只有一份、路由挂了端点且 limit 显式解析。
- Python 新测试 `test_knowledge_fs_symbols.py` **12 例**（含 4 个 limit 参数化）：身份缺失时断言**不发起任何上游调用**；命中簇的文件顺序与虚拟路径逐字断言；空集三因三分各一例；limit 夹取按参数化逐值断言；路由接线一条源码面断言。
- 与既有 `test_knowledge_fs.py` 合跑 **32 例全绿**。
- `apps/api` 全库 `tsc --noEmit` 现读 **0 错误**；prettier 三文件绿；水印 `verify` 覆盖 6/6。

### 26.5 边界（这一批诚实没做的）

1. **`codebase_edges` 仍无写入通道**：边需要 import / 调用关系，切片未携带。要补得先让切片器带 import 列表——这是下一批而不是本批。
2. **`list_symbols` 还没有工具面入口**：`mcp_server.py` 的代码检索工具组尚未把这条能力挂成工具（agent 目前要走 HTTP 或 Python 调用）。下一批该做"工具面接线"，否则它仍只是"可调"而不是"会被调"。
3. **`needsRebuild` / `getIndexState` 仍只有测试消费方**：索引调度层未接线。

## 27. P0-8 第五批：MCP 工具面接线（2026-11-23）

> 第四批让实体表"能读"，但到这一步它仍只是"可调"而不是"会被调"——`list_symbols` 只有 HTTP 与 Python 两个入口，agent 的工具清单里没有它。这一批把它变成一枚真实工具。

### 27.1 工具契约：`list_symbol_definitions`

| 入参 | 语义 | 缺省行为 |
| --- | --- | --- |
| `name` | 符号名，**逐字相等、大小写敏感**（必填） | 缺失或纯空白 ⇒ `missing_argument`，不发起任何上游调用 |
| `repo_id` | 仓库标识 | 省略时按 `path` 推导 |
| `path` | 仓库根目录（默认 `.`） | 仅在省略 `repo_id` 时用于推导 |
| `limit` | 最多返回多少条定义 | 默认 50，`knowledge_fs` 侧夹取 `[1, 200]` |

两条纪律：

- **归属只认服务端注入的 `__user_id`**（与 `search_codebase` 一字不差）。缺失即 `missing_identity` 拒绝，不起"匿名查全部"的默认。
- **`repo_id` 推导与 `index_codebase` 同源**（同一份 `_default_repo_id`）。不这么做的话，agent 得先知道一枚它拿不到的路径 hash 才能用这个工具——工具就等于没接线。

### 27.2 输出：定义簇 + 三态原委

成功时给 `status=ok / repo_id / name / count / definitions[]`，每条定义含 `path`（`/repo/<repoId>/<file>#<symbol>` 虚拟路径）+ `file_path` + 行区间 + `kind`，agent 拿到即可直接 `read`。

空集时 `ok=false`，但 `status` 与 `detail` **原样透传** `path_missing` / `catalog_missing` / `upstream_unavailable` 三因——调用方据此决定"去重建索引"还是"换个符号"，而不是把三种因都读成"不存在"。

`limit` 非法（`abc` / 空串 / `None` 等非整数）⇒ `invalid_argument`，同样不发起上游调用。

### 27.3 验证

- 新测试 `test_mcp_list_symbol_definitions.py` **9 例**：缺 name、缺身份两例都断言 `assert_not_awaited()`（"不发上游"是被测出来的，不是自称的）；`limit` 三种非法值参数化；happy path 断言上游实参逐字（`("r-hash", "fn_a", "u1", limit=50)`）；`repo_id` 缺省时断言 `_default_repo_id` 被调用且推导结果进了上游入参；`catalog_missing` 的 detail 原委在原样出现在工具出参里；注册双射一条（`_TOOLS` 里恰好一枚 + `_TOOL_HANDLERS` 指向同一函数对象）。
- mcp 工具面既有回归 **105 例全绿**（`test_mcp_registry.py` / `test_mcp_tool_deferral.py` / `test_mcp_tool_guards.py` / `test_mcp_capability_gate.py`）。
- `test_mcp_server.py` + `test_mcp_protocol_completeness.py` **265 例全绿**（工具定义 ↔ 处理函数双射在 `test_tools_count_matches_registry` 上现读通过）。
- 水印 `verify` 覆盖 `mcp_server.py` 与新测试两文件。

### 27.4 边界

1. 工具能否出现在某个客户端的清单里，还取决于 tool aggregator / deferral 的既有分层（本批只保证"注册表双射 + 可被 call_tool 调到"，不承诺每个客户端都挤进首屏清单）。
2. `codebase_edges` 仍无写入通道；`needsRebuild` / `getIndexState` 仍只有测试消费方。

## 28. P0-8 第六批：索引状态判据通电（2026-11-23）

> 第二批写了 `needsRebuild` / `getIndexState` / `markIndexed`，但 `markIndexed` 有生产写入方（`indexChunks` 末尾），**判据却没有读方**——只有测试在调。这一批给它补上组合入口、HTTP 读面与 Python 消费。

### 28.1 组合入口：`evaluateRebuild`

「读状态 → 取当前指纹 → 逐档判定」三步收成一个入口。分开写各自的漏法是可枚举的：

- 漏取指纹 ⇒ 把"配置变更"读成"可复用"（指纹那一格被填成状态里旧值）；
- 漏传 `maxAgeMs` ⇒ 过期索引永远当新鲜；
- 漏读状态 ⇒ 判 `rebuild-no-state` 而实际上是没查。

三条缺省值都写死在同一处：`maxAgeMs` 缺省 **0**（不按时间判过期——窗口是运维口径，不是代码常量）；`currentFingerprint` 缺省取 `resolveIndexConfigFingerprint()`（与写状态时同源）；无归属 ⇒ `getIndexState` 返 null 且**零 DB 调用** ⇒ 判 `rebuild-no-state`。最后这条不是"没建过索引"的断言，而是"本调用方拿不到状态"的诚实落点。

### 28.2 端点：`GET /api/v1/codebase/repo/:repoId/index-state`

`maxAgeMs` 显式解析：`Number()` 得 `NaN` 或负数 ⇒ 400「maxAgeMs 必须是非负整数」；缺省 0。响应 `{ repoId, state, currentFingerprint, decision }`，`decision` 四态封闭（`rebuild-no-state` / `rebuild-config-changed` / `rebuild-stale` / `reuse-fresh`）。

### 28.3 Python 消费：`knowledge_fs.index_state` + `list_symbols` 的 `catalog_missing` 富化

`index_state(repo_id, uid, max_age_ms=0)`：身份缺失直接 `skipped_missing_identity`；响应**缺 `decision` 字段**判 `upstream_unavailable`——空串不得冒充 `reuse-fresh`（这是本节唯一一处"看起来能省"却必须守的地方）。

真正的消费点在 `list_symbols` 的 `catalog_missing` 分支：只有在"有切片却查不到实体"这一支才多发一次请求，把判据结论写进原委——

- `rebuild-config-changed` / `rebuild-stale` / `rebuild-no-state` ⇒ detail 追加「索引状态判据:xxx ⇒ 需要重建索引」；
- `reuse-fresh` ⇒ detail 一字不动（不能给它加"该重建"的暗示）；
- 状态取不到 ⇒ `index_state.status` 标未判定，**三因三分的结论本身不改档**（不混档是这一层的纪律）。

### 28.4 顺手根治两处脆弱断言（他席改动触发，非本轮引入）

合跑时两例转红，逐条核过都不是产品缺陷，而是我早前测试写得过紧：

1. `codebase-index-entity-state.test.ts` 断言 journal **末条**是本票迁移。他席新增 `20261123160000_wechat_hub` 后立刻转红。改为"本票条目**在册**"——迁移条目只增不减，末条位置随时会变，这不是契约。
2. `codebase-index-entity-write.test.ts` 断言 `_entityOwnerScope(` 恰好 5 次。第四批的 `findEntities` 是第 6 个消费点，转红。改为 `>= 5` **下界**断言，并在注释里写清"上界不设，新增消费点正是我们要的方向"——否则每次给实体面加读点都要改一次测试，会把好方向的改动逼成"改测试"。

### 28.5 验证

- API 新测试 `codebase-index-state-read.test.ts` **9 例**：无归属断言"一次 DB 都不查"；四档逐一（no-state / config-changed 优先于时间 / maxAgeMs=0 不判过期 / 超窗 stale / 时钟倒挂 stale / 窗口边界闭区间）；源码面钉组合三步各一份、路由接线与 `maxAgeMs` 校验。
- Python 新测试 `test_knowledge_fs_index_state.py` **11 例**（含四档参数化）：身份缺失不起上游；`max_age_ms` 缺省 0、负值夹 0；**响应缺 decision 判未判定**（用假 httpx client 打真取数腿，而不是只测上层）。
- 既有 `test_knowledge_fs_symbols.py` 新增 2 例，钉 `catalog_missing` 的三支富化（rebuild 档追加原委 / reuse-fresh 不追加 / 状态取不到标未判定）。三文件合跑 **44 例绿**。
- P0-8 五批 API 测试合跑 **59 例全绿**（新增 9 + 读 9 + 写 14 + 状态 13 + 完整性 14）。
- `tsc --noEmit`：本批改动面 0 错误（全库唯一残留 `hr-attendance.ts` 的 TS18048 来自他席未提交改动，`git diff --numstat` 现读 41/1）。

### 28.6 边界

1. **调度层仍未接**：`index_codebase` 工具索引前的重建判据目前由 indexer 自己的 Merkle 快照决定（那是另一套判据，且是合法的），本批只让 PG 侧状态**可判、可读、可被 Python 消费**，不声称已替换 Merkle。
2. `codebase_edges` 仍无写入通道：边需要 import / 调用关系，切片未携带；要补得先让切片器或索引 payload 带 import 清单。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
## 29. P0-8 第七批：导入边写入通道（2026-11-23）

### 29.1 本批做什么

第二批把 `codebase_edges` 表建好了，第三/四/五/六批把实体面、读面、MCP 工具面、索引状态判据一一通电，但**边表一直是空的**——没有任何一处在写它。本批补齐三件事：

1. `deriveEdgesFromImports(imports)` 纯函数：把导入清单派生成边行（`from_entity_id` 留空，按名可查）；
2. `indexChunks` 增第五参 `imports`，边行与切片**同一事务**先删后插，返回 `edges: count`；
3. 三处删除方法（`deleteByRepo` / `deleteByFileScoped` / `deleteByFiles`）同步删边。

同时把「谁产 imports」接到生产链：Python `codebase_indexer._write_to_api` 新增 `root` 关键字参数，整仓索引档按本批文件清单现读正文、调 `collect_import_edges` 产出边并随 payload 上传。

### 29.2 `fromName` 取模块路径，不取 basename

`a/index.ts` 与 `b/index.ts` 的 basename 都是 `index.ts`。若边表按 basename 记 `from`，两个不同模块的导入会折成同一个来源点，按来源查"谁依赖了我"就会把两个目录混成一团。故 `fromName` 取 **filePath 本身**（仓库相对路径，与切片同一口径）。

`toName` 取 import 的名字原文，**不解析到目标文件**：解析需要跨文件符号表，当前没有；用名字做键至少能回答"哪些文件 import 了 lodash"，而假装解析会产出错误的边（比没有边更糟）。

### 29.3 清除面必须是并集

`clearFilePaths = [...new Set([...filePaths, ...edgeRows.map((r) => r.filePath)])]`。

理由：一个文件可能**这一轮只剩 import 行**而没有可切片内容（例如纯 re-export 的桶文件、或切片器把短文件全部跳过）。如果清除面只取切片文件，这类文件上一轮的边会残留 —— 于是"文件还在，边是旧的"。并集把这类文件也纳入先删后插。

### 29.4 为什么另立 `_edgeOwnerScope`

`_ownerScope` 绑的是切片表的两列（`owner_uuid` + `or(isNull(expires_at), expires_at > NOW())`）；边表没有过期列，直接复用会拼出**指向切片的列对象** —— 在 Drizzle 里这是能编过、跑起来条件却打在错表上的那种错。故 `_edgeOwnerScope` 独立实现（无归属时 `sql\`1 = 0\``，与实体谓词同纪律）。

### 29.5 生产写入方复用既有判据，不新写正则

`collect_import_edges` 只做两件事：读文本、调 `code_symbol_graph.index_code`。import 的正则与名字拆分（含 `as` 别名剥离、逗号多名拆分）**留在 `core.code_symbol_graph` 一处**。若在 api 侧或 indexer 里再写一份 import 正则，两处一漂就会出现"边表与符号图对不上"的静默分叉 —— 这正是 §0.6 单一真相源要排除的形态。

读不到的文件直接跳过（不抛）：边是**附加**产物，不应因为某个文件读失败而让整批写入失败；索引流程本来已有独立的读失败处理。

### 29.6 边界（如实记录，不装全绿）

- **TS/JS 的 `import {x} from 'm'` 不产边**：既有正则覆盖 `import x` 与 `from m import x` 两种 Python 风格，`import { … }` 里的花括号不匹配。测试里有一条用例把这条局限钉成事实（`test_ts_style_import_is_not_matched`），以免将来误以为"边表已覆盖前端口径"。要覆盖必须改 `code_symbol_graph` 且保持单源。
- **单文件索引档不产边**：该档的 `file_path` 是 `path.name`（basename），与切片自己都不是仓库相对路径；照样产边会造出一批"路径与切片对不上"的边行。故 `_write_to_api(root=...)` 只在整仓档传。
- **边已能写，但还没有读消费方**：本批只通"写"侧；`code_search` / MCP 工具面 / `knowledge_fs` 都还没按 `toName`/`fromName` 查边。这是刻意分批 —— 先有可信的写入与删除语义，再做读面，避免"读面先立、底层却一口气都没写过"的空跑。
- **payload 上限**：路由 `indexSchema.imports` 限 20000 条。理由是坏 payload 能把一次写入拖成几分钟的巨型事务（边表是逐行插入）；上限放在入口而不是推导里，坏输入当场 400。
## 30. P0-8 第八批：导入边读面与 MCP 工具面（2026-11-23）

### 30.1 三面接线

第七批让边表「能写」，第八批让它「能读」——否则就是一张只有写入没有消费的孤表：

1. **服务层** `findEdges(opts)`：按 `fromName / toName / kind / filePath` 四个等值过滤位查边，`limit` 夹取 `[1, 200]`、缺省 50，排序 `(filePath, line, toName)`。
2. **HTTP** `GET /repo/:repoId/edges`：`limit` 显式解析，`NaN / <=0` ⇒ 400（与 `entities` 同一纪律，不静默折默认）；无身份 401；失败 500 独立文案。
3. **虚拟文件系统** `knowledge_fs.list_imports(repo_id, target, ..., direction, limit)` + `GET /ai/knowledge-fs/imports`：把边投影成 `repo/file#name` 虚拟路径，与 `list_symbols` 的路径形态一致（agent 拿到即可直接 read）。
4. **MCP** `find_import_edges`：`target` + `direction` + `repo_id?` / `path?` / `limit?`；身份只认服务端注入的 `__user_id`；`repo_id` 缺省按 `path` 用 `_default_repo_id` 推导（与 `index_codebase` 同源，否则 agent 拿不到那枚 hash 就用不了这个工具）。

### 30.2 两个方向，不猜

- `direction='from'`：这个**文件**导入了谁 —— `target` 是仓库相对路径，按 `filePath` 查；
- `direction='to'`：谁导入了这个**名字** —— `target` 是 import 名字原文，按 `toName` 查。

为什么不接受"自动判断这是路径还是名字"：同一个词可能既是文件名前缀又是符号名（`os` 既是模块名也可能是某个目录），猜错方向会返回**一个看起来合理的空集**，而空集是"没有导入关系"和"问错了"的同形。把方向做成显式入参，是把这层二义留给调用方（它知道自己在问什么）。

### 30.3 空集三档，且比实体面多一层二义

| 档 | 判据 | 收信人的动作 |
| --- | --- | --- |
| `path_missing` | 路径清单也为空 | 先建索引 |
| `catalog_missing` | 有切片但边表无记录 | 重建索引可补；**也可能是该仓库的导入行不匹配既有正则** |
| `upstream_unavailable` | 取数腿失败 | 未判定，重试 |

第三档的 detail 必须点明"当前只覆盖 python 风格 import，TS/JS 的 `import {x} from 'm'` 不产边"——这是第七批就钉进测试的局限，读面若不写出来，调用方会把"TS 仓库天然无边"读成"这个仓库没有导入关系"。测试 `test_imports_catalog_missing_names_ts_gap` 用 `assert "TS/JS" in out["detail"]` 把这句话钉住，防止将来有人"顺手把 detail 写短"。

### 30.4 边界

- **无归属零 DB 调用**：`findEdges` 在 `!ownerUuid` 时直接返回 `[]`，不发起任何查询（测试断言 `selectCalls === 0`）。这不是"查一次得到空集"，是"压根不查"——别人的代码一行都不给。
- **不做前缀/模糊匹配**：边表存的是名字原文，`use` 模糊匹配会把 `userState` 一起带出来，比查不到更糟。
- **MCP 工具拒绝路径零副作用**：缺 `target` / 缺身份 / `direction` 非法 / `limit` 非法四条拒绝路径都断言 `must_not_call.assert_not_awaited()`。
- **仍未做**：`find_import_edges` 在客户端可见性依赖 aggregator/deferral 的清单（与第五批 `list_symbol_definitions` 同一条待办）；边表的"被引用计数"聚合（谁被最多文件导入）尚无论据支撑，不先造指标。
- **过期语义不对齐（必须先解决再透传 retentionDays）**：切片表有 `expires_at`，边表**没有**。第七批刻意让 `indexChunks` 的 `retentionDays` 位在路由层保持缺省，所以当前不存在残留；一旦将来开口透传保留期，切片会按窗口过期消失、边却永存 ⇒ 边表会出现指向已不存在切片的"幽灵边"。开口透传与给边表加 `expires_at`（配合同一批迁移与删除谓词）必须**同批**，不能先开窗。

### 30.5 与 24.6 第 3 条的现状对照（不改历史叙述，只补现状）

24.6 第 3 条记的是**第二批当时**的事实：「`codebase_entities` / `codebase_edges` 已建表但没有任何写入点、没有消费方；`needsRebuild` / `getIndexState` 目前只有测试消费方」。第三至第八批之后，这条已不成立，逐项对齐如下（每项都有测试证号，不是"已完成"三个字）：

| 对象 | 写入方 | 读方 | 证号（测试文件） |
| --- | --- | --- | --- |
| `codebase_chunks` | `indexChunks`（既有的生产链） | `search` / `readFileChunks` / `listPathIndex` | 既有 |
| `codebase_entities` | `indexChunks` 同事务派生（第三批） | `findEntities` / `GET .../entities` / `knowledge_fs.list_symbols` / MCP `list_symbol_definitions` | `codebase-index-entity-write.test.ts`(14) / `-entity-read.test.ts`(9) / `test_knowledge_fs_symbols.py`(14) / `test_mcp_list_symbol_definitions.py`(9) |
| `codebase_edges` | `indexChunks` 第五参 `imports` 同事务（第七批）+ Python `collect_import_edges` 生产上传 | `findEdges` / `GET .../edges` / `knowledge_fs.list_imports` / MCP `find_import_edges`（第八批） | `codebase-index-edge-write.test.ts`(14) / `-edge-read.test.ts`(8) / `test_knowledge_fs_imports.py`(9) / `test_mcp_find_import_edges.py`(13) |
| `codebase_index_states` | `markIndexed`（既有）+ 第六批判据消费 | `getIndexState` / `evaluateRebuild` / `GET .../index-state` / `knowledge_fs.index_state` | `codebase-index-entity-state.test.ts`(13) / `codebase-index-state-read.test.ts`(9) / `test_knowledge_fs_index_state.py`(11) |

当时那句"上层调度承载未定"仍然成立：`evaluateRebuild` 现在有 HTTP 读面与 VFS 读面，但**还没有调度器按判据自动触发重建**——谁在什么时候调用重建端点，仍由调用方决定。这是下一批的候选，不是已完成。
## 31. P0-8 八批总账（2026-11-23 完结）

### 31.1 一条线八批做了什么

| 批 | 主题 | 提交 | 关键判据 |
| --- | --- | --- | --- |
| 一 | pgvector 完整性审计 | `fde9dc53` | 缺向量切片与向量化切片分开报数；四态互斥、空库不记 ok |
| 二 | 三表 + 迁移 + 幂等 | `acdb8d73` | `codebase_entities` / `codebase_edges` / `codebase_index_states`；迁移自带三行水印头 |
| 三 | 实体写入通道 | `dc0526c8` | 身份键 `filePath\0kind\0name`；`_entityOwnerScope` 独立谓词；与切片同事务 |
| 四 | 实体读面 + 符号视图 | `48757f23` | 无归属零 DB；limit 夹取；空集三因三分 |
| 五 | MCP 工具面 | `b94ff88a` | 身份只认 `__user_id`；`repo_id` 缺省按 path 推导 |
| 六 | 索引状态判据 | `bab77067` | `evaluateRebuild` 纯函数、缺省 `maxAgeMs=0`；`catalog_missing` 只在这一支富化 |
| 七 | 导入边写入通道 | `c7f5dda8` | `fromName` 取模块路径；清除面并集；`_edgeOwnerScope` 独立 |
| 八 | 边读面 + MCP 工具 | `c7f5dda8` | 两档方向不猜；`_clampLimit` 单源；空集 detail 点明 TS 不产边 |

第七、八批合在一枚提交（`c7f5dda8`，13 文件 +1187/−15）：两批共用同一份清除面与同一张边表判据，
拆开落地会出现"写入面已通电、读面还没有"的中间态，而中间态正是最容易漏测的形态。

### 31.2 现读数字（2026-11-23 20:1x）

- `apps/api` codebase 全家族 **9 文件 105 例绿**（混合检索 / 归属隔离 / 完整性审计 / 实体读 / 状态读 / 实体-状态 / 边写 14 / 边读 8 / 实体写 14）；
- `apps/api` 全库 `tsc --noEmit` **0 错误**；
- `apps/ai-service` 相关组 **52 例绿**（符号 14 + 状态 11 + 导入 9 + 抽取 6 + 导入读面 9 … 交错计）；
- MCP 注册/护栏/能力门/协议 **293 例绿**（含 `test_tools_count_matches_registry` 双射）；
- 水印：11 个代码文件 verify 覆盖 11/11，残迹 0、载荷损坏 0。

### 31.3 遗留（三条，均为"有据可查的未做"）

1. **没有调度器按判据自动触发重建**：`evaluateRebuild` 已有 HTTP 与 VFS 两面读口，但"谁在什么时候重建"仍由调用方决定。加自动调度属产品决策（重建会消耗嵌入成本），不作单方面默认。
2. **边表无 `expires_at`**：切片表有保留期、边表没有。`retentionDays` 在路由层刻意保持缺省，所以当前无残留；开口透传必须与"加列 + 迁移 + 删除谓词"同批。
3. **两个 MCP 工具的首屏可见性**：`list_symbol_definitions` / `find_import_edges` 的可发现性依赖 aggregator/deferral 的清单登记，属客户端清单层，未在本线改动。

### 31.4 这一线没做的事（也是刻意的）

- **没抄对照方的 sqlite_vec**：本仓是 PostgreSQL + pgvector，"完整性统计"的语义按本仓数据模型重建（缺向量 / 覆盖率为 0 / 空库三档各有独立判据），不是把 SQLite 的 SQL 翻成 PG 方言。
- **没做目标文件解析**：边只记名字原文。跨文件符号表不存在时假装解析，会产出**看起来正确**的错边 —— 比没有边更糟。
- **没造"被引用计数"指标**：没有真实数据支撑前先造聚合，等于给自己发一张无法验证的成绩单。

## 32. B3-03 协作身份三档与退出码/幂等契约（2026-11-23）

### 32.1 三档身份与命令权重（唯一映射表）

| 档位 | 权重 | 含义 | 能做什么 |
| --- | --- | --- | --- |
| `user` | 2 | 人在终端直接操作（默认） | 派发 / 派生 / 仲裁 / 读拓扑 |
| `runtime-owner` | 2 | 被授权代表用户的运行体（host 注入 `owner`） | 同 `user`，同级 |
| `runtime-agent` | 1 | 被分派的执行体（host 注入 `agent`） | 只能读拓扑；不得派发/派生/仲裁 |

`COLLAB_COMMAND_MIN_RANK` 是命令 → 最低权重的**唯一**一处：新增命令漏映射会在类型层与用例层双红。
`user` 与 `runtime-owner` 同级是刻意的 —— 本地 CLI 与人机同权，真正的分界画在"执行体不得再派生"上，
与 `subagents/worker-pool.ts` 的并发档互补：防的是递归派生风暴，不是防人。

### 32.2 身份来源的三条硬规矩

1. **只读宿主注入**：`IHUI_COLLAB_RUNTIME_CONTEXT`（值只认 `owner` / `agent`）；解析函数签名里没有 argv，实现体不出现 `process.argv`（用例从源码切片钉住这一点）。
2. **未知即拒**：上下文有值但不可识别 ⇒ 返回 `null`，任何命令都被拒（`identity_unknown`），**不回落 `user`**。
3. **自选即拒**：argv 一旦出现 `--identity` / `--profile` / `--runtime-context-fd` / `--role`，一律 `identity_self_selected` 拒绝 —— 不是"我们没提供"，而是"提供了就拒"。

### 32.3 四档命令面全部接线（没有纸面项）

| 命令 | 生产入口 | 闸位置 |
| --- | --- | --- |
| `subagent.dispatch` | `CollaborationManager.dispatchTask` | 体首行，早于 `getExecutor()` |
| `subagent.spawn` | `spawnParallel`（顶层导出） | 体首行，早于 `new SubagentWorkerPool` |
| `subagent.arbitrate` | `CollaborationManager.arbitrateConflict` | 体首行 |
| `subagent.topology-read` | `CollaborationManager.visualizeTopology` | 体首行 |

### 32.4 退出码 / 响应形 / 分页 / 幂等（单源 `commands/collab/exit-codes.ts`）

- 退出码 **0 / 3 / 4 / 130**；`outcome_unknown` / `disconnected` / `oversize` 三档**不塌成成功**：退出码按拒绝（3）算，且 `mustQueryBeforeRetry` 为真 ⇒ 调用方无法把未知读成答案。
- 响应形 `{success:true,data}` / `{success:false,error}` 互斥（失败侧没有 `data` 字段）。
- 分页 `complete` **由 `nextOffset` 推导**，不允许调用方自报 complete。
- `requestIdFor(operation, payload)` 是**稳定哈希**（键排序 + 64 位 hex）：同操作同 payload 恒同 ⇒ 重放可被识别。

### 32.5 与对照方的差距与超越轴

| 维度 | Qoder 协作 CLI（取证） | 本仓 |
| --- | --- | --- |
| 身份选定 | host 从可信会话上下文选定，CLI 不加身份参数 | 同，且**自选参数显式拒绝**（不是静默忽略） |
| 身份不足 | 401/403/404 不授权切身份 | `exit 3` + 结构化 `code`（三种拒绝码可区分） |
| 退出码 | 4 部分结果 / 3 拒绝 / 130 取消 | 同 |
| 结果未知 | 先查询再重试，禁止重放 create | 同，且**退出码不是 0**（未知 ≠ 成功） |
| 幂等 | `requestId` | 同，且**稳定哈希**（键序无关，重放必然同 id） |
| 拒绝落账 | 未见明文 | **未做**（PG 台账属另一票，见 32.6） |

### 32.6 刻意没做（三条）

1. **不实现凭据管道**：不读 fd、不接临时管道、不构造 token —— 本层只判身份，凭据留在既有会话体系。
2. **不做身份切换/升档**：拒绝即拒绝，没有"补一次授权再进"的路径（fail-closed 的失效方向只能是多拒）。
3. **不做 PostgreSQL 落账**：拒绝/部分结果/委派动作入 PG 台账需要 CLI 侧连接与表设计，属独立票，不在本线偷渡。

### 32.7 验证实绩（现读）

- `apps/cli/tests/collab-identity-contract.test.ts` **33 例绿**（身份 15 + 退出码 8 + 幂等 6 + 装车 4）；
- `apps/cli` `tsc --noEmit` **0 错误**；`prettier --write` 已跑；四个文件水印 verify 4/4。
## 33. P0-8 第九批：边表过期语义对齐（2026-11-23）

### 33.1 为什么必须补这一列

边与切片**同事务写入、同一清除面、同一保留期语义**，但只有 `codebase_chunks` 有 `expires_at` ——
所以第七、八批在路由层刻意写了"`retentionDays` 位保持缺省（路由层暂不透传）"。
一旦透传而边表没有该列，读面过滤只覆盖切片 ⇒ 调用图会持续命中已过期行（"设了保留期却不遵守"，
比没有保留期更糟）。第九批把这一列补齐，**开口与加列同批落地**。

### 33.2 六处改动（缺一处即回到幽灵边）

| 位置 | 改动 | 缺失后果 |
| --- | --- | --- |
| schema | `codebaseEdges.expiresAt` + `ix_codebase_edges_expires_at` | 列不存在 ⇒ 查询报错或谓词失效 |
| 迁移 | `20261123203000_codebase_edges_expires.sql`（ADD COLUMN / CREATE INDEX，**不回填**） | 生产库无列 ⇒ 落地即炸 |
| 写入 | `edgeRows` 带**同一次算定**的 `expiresAt` | 边永不过期 ⇒ 幽灵边 |
| 读面 | `_edgeOwnerScope` 加 `expires_at > NOW()` 过滤 | 过期边仍可见 |
| 清理 | `purgeExpired` 增补边表分批删除 | 过期边在库里无限期留存 |
| 路由 | `retentionDays` 透传（`null` = 永不过期，不传 = 默认上限） | 保留期只在切片生效 |

### 33.3 为什么存量不回填

迁移前的边没有保留期事实，回填等于给它**编造**一个到期时刻。`NULL` 按永不过期处理，
与 `codebase_chunks` 的列语义一致（"NULL 仅限明确选择长期保留"）。这条与 §31.4 的
"不造无据指标"是同一条纪律：宁可不判，也不编。

### 33.4 测试与实绩

- `codebase-index-edge-write.test.ts` 新增 **5 例**：schema 列与索引 / 写入带 `expiresAt` /
  读面谓词带过期过滤 / `purgeExpired` 真扫边表 / 迁移只加列不回填。
- `codebase-index-tenant-isolation.test.ts` 的 `purgeExpired` 用例改为**按渲染 SQL 文本分流**的
  mock（原先"按调用次数计数"，多扫一张表会被误报成"切片腿多跑一轮"，红得看不出原因）。
- 现读实绩：六个 codebase 测试文件 **73 例绿**；`apps/api` 全库 `tsc --noEmit` 仅剩他席在飞的
  wechat-hub 两条（`wechat-hub-p0.test.ts` TS2352 / `manager.ts` TS6133），我方改动 0 错误。

## 34. 真实边界闭环：从“接口写出来”到“进程真跑起来”（2026-11-23）

本批六条边界逐条做实，完整命令与读数见
`docs/benchmark-evidence/2026-11/five-apps-2026-11-23/real-boundaries-2026-11-23.md`。

### 34.1 Rust / PE DLL / 受限管道

- Rust 工具链此前只有目录没有组件；用 `rustup-init.exe -y --profile minimal --default-toolchain stable-x86_64-pc-windows-msvc` 安装，得到 cargo/rustc 1.100.0。`cargo check` 首轮真实报 `NativeModuleError::MissingExport(&'static str)` 生命周期不满足，改为 `String` 后通过；`cargo build --bin ihui_native_host` **4m21s** 产出 549376 字节 exe。
- `bp_fixture.c` 用 MSVC `cl /LD` 编译成真实 PE DLL；`tests/native_module_real.rs` 真实 `LoadLibrary` → 校验 magic/abi/header_size → `BP_Initialize` → `BP_Shutdown`，6 例全绿，`report.reason="loaded-initialized-shutdown"`。厂商真实 `BP_*` DLL 不存在，测试证明的是仓内契约与真实 PE 加载路径。
- `tests/ipc_channel_real.rs` 用当前用户 SID 创建真实受限命名管道并关闭，SDDL 含当前用户与 `SYSTEM`，6 例全绿；与 DLL harness 合跑 **12 例全绿**。

### 34.2 真实 PostgreSQL

- 本机 PostgreSQL 18.6 服务 `postgresql-x64-18` + 专用测试库 `ihui_test_metadata`；`test_request_metadata_pg.py` 真实建表、写一行、同 `request_id` 重复写，`count=1`，1 passed。测试不连生产库，不提供 sqlite 回退。

### 34.3 Native Messaging（两个真实缺陷 + 浏览器替代）

- **缺陷 1**：扩展构建 manifest 缺 `nativeMessaging` 权限，`chrome.runtime.connectNative` 在扩展侧直接不可用；补权限后重建。
- **缺陷 2**：安装器 `spawnSync('reg.exe')` 依赖调用方 PATH，PATH 缺 `System32` 时失败；改 `resolveRegExe()` 绝对路径，并支持 `--browser chrome|edge`。
- **Chrome 153 事实**：命令行 `--load-extension` 被上游移除，新 profile 的 Secure Preferences 只有内置扩展；`--disable-features=DisableLoadExtensionCommandLineSwitch` 无效。改用 Edge 145（Chromium，同 `nativeMessaging` 协议）加载未打包扩展，实际扩展 ID `jmcmcameocdcmnciinieiadionkhakfe`；真实回包 `{ok:true,pid:26988,requestId:"nh-1-4oj3p9",version:"0.1.0"}`。Chrome 本体只能走 UI/商店/策略安装，未冒充完成。

### 34.4 完整 WebRTC

- `apps/cli/src/rtc/signaling.ts` 提供浏览器 `RTCPeerConnection` 的 SDP/ICE 协商；CLI `rtc signal` 真监听 8890；Edge 双页面 fake device 真实完成 SDP/ICE/DTLS/SRTP。
- 最新一轮：两端 `connected`、`dataChannelEcho=true`、answerer 收到 audio/video、`audioInboundBytes=7897`、`videoInboundBytes=72564`、`offers=1/answers=1/ice=6/rejected=0`。
- 同时抓到夹具真实竞态：先建 WebSocket 再等 `getUserMedia` 会错过服务端一次性 `ready`，表现为 `connectionState=new`；把 WS 建连移到媒体/轨道准备之后就稳定通过。边界：无 TURN/STUN 穿透，媒体方向 offerer→answerer，`bridge.ts` 二进制中继保留为降级通道。

### 34.5 更新 apply 到优雅重启

- `update apply` 已接真实 `npm install -g`（参数数组，Windows `shell:true`，120s 超时，exit 0 才算 installed）；安装成功才映射 `apply/install-verified` 并交 `RestartCoordinator`。
- 真实 `update check` 返回 `current=1.0.0 latest=1.0.0`；`--dry-run` 输出正确安装参数；用临时 fake npm 真实 spawn，收到 `install -g ihui-cli@1.0.1`，输出 `install=install/installed handoff=apply/install-verified restart=none`。
- 边界：registry 当前无更高版本，未对真实全局包执行升级；安装成功→新进程 exit 0 由 `update-apply.test.ts` 5 例覆盖。

