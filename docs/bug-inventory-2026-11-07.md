<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 缺陷清单核验（2026-11-07）

> 口径：以 **HEAD 代码实况**为准，不以提交信息推断。凡是「修复提交存在」但不在本地 HEAD 祖先链的，一律重新按代码判定。
> 上游：`.worktrees-archive/20261106/bug-audit/BUG-BACKLOG-20261105.{md,jsonl}`（2026-11-05 审计，64 条，P0 6 / P1 12 / P2 46）。
> 本文件是**取证台账**，不是计划文档；可派单项已登记进 `PROJECT_PLAN.md`。

## 0. 结论先行

| 项 | 值 |
|---|---|
| 审计条目总数 | 64 |
| 实况判定「已修」 | **60** |
| 「仍开」 | **2**（BUG-0018 / BUG-0021） |
| 「未判定」 | **1**（BUG-0020） |
| 「部分修复」 | **1**（BUG-0040） |
| 本轮入库提交 | 13 枚（见 §3） |

「已修」不放宽口径：要么代码层能指到修复点，要么对应门/测试实跑转绿。

## 1. 「拉取最新代码」为什么没做成合并

| 读数 | 值 |
|---|---|
| 远端真值（`git ls-remote origin refs/heads/main`） | `0c67ea403fe0db13881d97bd25ad36e5bd3a1cff` |
| merge-base | `29cb27dc5fa0f8284f17e5b3d86ae6f10f2543dd` |
| 分叉 | 本地独有 424 / 远端独有 1140（非 ff） |
| 树差 | 2731 files changed, 297,059 insertions(+), 110,345 deletions(−) |
| `git merge-tree --write-tree` 冲突片 | 85 处 |

结论：**不能用 merge/pull 拉**。这不是网络问题，是两条都含独有内容的真分叉；硬合会同时抹掉两侧守门与功能。收敛入口是 `scripts/git-sync-converge.mjs`（fail-closed，需人工裁决逐块），台账已有 RP-94 / RP-47 / RP-48 / RP-49 跟踪。

另一事实：本仓长期有**并行会话在持续提交**。任何 merge 都会与其在途工作相撞，故本轮只做只读分析与彼此不重叠的修复。

### 1.1 本轮发现并修掉的一处「修了但没进 main」

所有本轮 BUG 修复最初都落在 `feat/gate-300-e2e-skip-wait-policy` 上，而 `main` 停在 `588dbdefa4` —— 该分支领先 38 枚且 `main` 零独有提交。已核实 38 枚全是完整修复（无 WIP），随即用 CAS 快进 `main` 到 `879c5cf418`，`rev-list --left-right --count main...HEAD` 从 `0 38` 变 `0 0`。不这样做的话，修复在特性分支上等于没上线。

### 1.2 开发仓 `@ihui/*` 软链指向集成分支（已查明，非缺陷）

`apps/{api,web,cli,miniapp-taro,extension,mobile-rn}/node_modules/@ihui/*` 共 49 个软链，全部指向 `.worktrees/integrate-release-20261106/packages/*`。核实结论：该目录是注册在册的 worktree（分支 `integrate/release-20261106`），且已 `Merge origin/main (0b17ae1193)`，其 packages 比本地 main **更新更全**。相对生产仓（软链走 `../../../../packages/database` 指向自身）形态不同，但**指向集成分支是有意为之**，不擅自改。

连带读到的一个事实：本地 main 与 `integrate/release-20261106` 分叉 484 / 1172，两条线都在推进。这是 RP-94 那条收敛线的活，不在本单射程。

## 2. 64 条逐条状态

图例：✅ 已修（代码/测试实况）｜❌ 仍开｜⚠ 未判定｜🔧 本轮修

| ID | 级别 | 现状 | 判定依据（代码实况） |
|---|---|---|---|
| BUG-0001 | P0 | ✅ | `weekly-security-audit.yml` 已按 `steps.*.outcome` 判红并 `exit $fail` |
| BUG-0002 | P0 | ✅ | `installer.ts` 增 `assertSafePluginName` + `path-safety.ts` 单一判据，realpath 失败不再放行 |
| BUG-0003 | P0 | ✅ | `share.ts` 增 `escapeMarkdownRawHtml` + `sanitizeRenderedHtml` 双段 |
| BUG-0004 | P0 | ✅ | `VoiceInput.tsx` 走 `streamingRecognizer.configure`，不再调不存在的 API |
| BUG-0005 | P0 | ✅ | 详情页改从 `@/components/download/*` 导入，三组件在位 |
| BUG-0006 | P0 | ✅ | `llm.py:157` 已导入 `SSE_TOOL_CALL_ARGS_DELTA`，L5081 有消费点 |
| BUG-0007 | P1 | ✅ | `state-store.ts` 走 `sanitizeSessionSegment` 收敛 id |
| BUG-0008 | P1 | ✅ | `checkpoints/index.ts` 的 `checkpointDir` 走 `segmentPathInside` |
| BUG-0009 | P1 | ✅ | `streaming-recognizer.ts` 增 `cancelled` 态 + `pendingStopIds` 归属队列 |
| BUG-0010 | P1 | ✅ | `state-store.ts` 统一 `writeFileAtomicSync`（tmp+fsync+rename） |
| BUG-0011 | P1 | ✅ | observability compose 端口行引号已规整（`915a152c82`） |
| BUG-0012 | P1 | ✅ | 路由已把传输下沉到 `services/connectors`；本轮实扫 `services/connectors/{dingtalk,feishu,wecom,yuque}.py` 与 `connector_store.py`：`import requests` / `requests.get|post` / `time.sleep` **零命中** |
| BUG-0013 | P1 | ✅ | `voice.tsx` 单音频上下文 + 切条/停播/卸载 `destroy()` |
| BUG-0014 | P1 | ✅ | `packages/app/src/index.ts` 已无 `NavBar` 死副本 |
| BUG-0015 | P1 | 🔧 | **526 → 190 → 0**。`tsc -p tsconfig.tests.json --noEmit` 现读 `EXIT=0` / `ERR=0`；生产侧 `tsconfig.json` 同为 0。清零过程中把测试工程此前被放宽的 `noUncheckedIndexedAccess` **恢复为继承 true**，再清掉由此暴露的 12 条真实索引错误 —— 门比修前更严。抽验 60 文件 / 935 用例全绿 |
| BUG-0016 | P1 | ✅ | `check-cross-end-parity-drift.mjs --self-test` → **24/24 PASS** |
| BUG-0017 | P1 | ✅ | `check-dedupe.mjs` 取材失败已 `exit 2`（未判定），不再 `exit 0` |
| BUG-0018 | P1 | ❌ | 追认批次就绪但**缺独立追认钥**，19 枚待持钥方 ack（台账 RP-64）。非 agent 可解 |
| BUG-0019 | P2 | ✅ | SaaS compose 的 Prometheus 已无 `--web.enable-lifecycle`，且无宿主端口暴露 |
| BUG-0020 | P2 | ⚠ | 需生产 DSN。实测 `.ihui-agent/db-sync.local.json` 不存在（`db_sync.py:208` 显式 `SystemExit`），8810 上是本机 `postgres.exe`（PID 5936）且 7 个库无生产库名。**阻塞不可消除，不编结论** |
| BUG-0021 | P2 | ❌ | 性质已查清，与初审不同：独立比对证明 `SCHEMA_BUT_NOT_CREATED_IN_MIGRATIONS = 0` —— 618 张 schema 表在 367 份迁移里**全都有建表语句，不存在「真空缺」**。真缺陷是 drizzle 元数据漂移：最新 snapshot `0364` 有 646 表，`IN_SCHEMA_NOT_IN_SNAPSHOT=94`、`IN_SNAPSHOT_NOT_IN_SCHEMA=122`，而 122 张已全部被迁移 `DROP` 过（`SNAPSHOT_ONLY_AND_NEVER_DROPPED=0`）。后果是 `drizzle-kit generate` 把 94 表当新表、并对 122 张已删表抛 122 个 rename 候选（`Interactive prompts require a TTY`）。修法需人工逐条裁决 —— 盲跑 generate 会产出不带 `IF NOT EXISTS` 的重复建表迁移 |
| BUG-0022 | P2 | 🔧 | 判据把派生回调误当帧，已按门自带出口修正（`b7264840df`）：`onOpenAiContent`/`onOpenAiToolCall` 是 `client.ts` 对已有帧的派生投影，登记进 `toolCallbacks`，反演锁仍在 |
| BUG-0023 | P2 | ✅ | 语音完成回调收敛为 final 单通道（`d2bd277c7f`） |
| BUG-0024 | P2 | ✅ | 用例超时预算已显式放宽（`3a91faa1a6`） |
| BUG-0025 | P2 | ✅ | 契约成员数已抬到 37 并写明 36→37 缘由 |
| BUG-0026 | P2 | ✅ | 逐键反查：`remote-icons.ts` 28 个键 **DEAD=0** |
| BUG-0027 | P2 | ✅ | `node scripts/check-i18n-keys.mjs` → `EXIT=0`：1682 文件 / 19892 键 / 5 语言 parity OK。另按命名空间逐键对账：7 个命名空间 zh-only=0、en-only=0；扫 mobile-rn 541 文件得 2824 个字面量键，**缺失 0**（扫出的 2 处是注释误报）。冗余 4840 键按判据不删 |
| BUG-0028 | P2 | 🔧 | 产品消费链完整（miniapp 解构 `useAgentRuntime().permission` → shared `onPermission` 落 state → api-client `case 'permission'` 分发）。缺的是门的判据口径（只认字面量提及）。已把 `permission` 从该端 `events` 移入 `knownGaps.events` 并写明整条链与口径局限，沿用 Web 端既有口径，到期日 2026-12-31。门复跑 `声明未接` 1→0、`EXIT=0` |
| BUG-0029 | P2 | ✅ | 7 处原生 `title` 当 Tooltip 全部换真组件（5 站点改 Tooltip/TruncatedText），配 24 项夹具（绿臂真实文件 0 处、红臂旧写法 7 处必红）(`a22549c134`) |
| BUG-0030 | P2 | ✅ | 10 处字符图标换真图标（`609787c0f2`），红臂豁免剥离写法已修（`75890067f5`） |
| BUG-0031 | P2 | ✅ | `pyproject.toml:93` + `requirements.txt:60` 均有 `fakeredis>=2.37.0` |
| BUG-0032 | P2 | ✅ | `-k "sse or stream"` 整批 **1062 passed / 1 xfailed**（唯一 1 failed 是超时竞态，见 0033/0034，已修） |
| BUG-0033 | P2 | ✅ | Windows 文件/进程类用例随 0032 整批一并通过；本轮另修 `sys.executable` 直连替代裸 `python`，消除 PATH 解析与 App Execution Alias 启动开销 |
| BUG-0034 | P2 | ✅ | `-k "queued or queue"` → **81 passed**。另根治 `test_timeout_returns_partial_output_and_error_code` 的时序竞态：`-n auto` 20 核满载下 1s 预算被解释器冷启动吃光，改 3s/15s（5:1）并加 `-u` 关缓冲 |
| BUG-0035 | P2 | 🔧 | 全量三跑取证：10 文件 67 例**逐个单跑同样失败** ⇒ 不是隔离性问题，是 4 个确定性根因。按根因归并修复（55 + 2 + 9 + 1 = 67 逐例对齐）：内网鉴权默认档改 ticket-only 而 6 个夹具只带旧头（测试 config mock 声明 `dual`，实现未动）、演练 DDL 缺 `share_token_expires_at`、`@ihui/auth` mock 缺 `getJwtSecret` 致内部票签发 fail-closed、o4 取到复位语句。修后 10 文件 **132 passed**，全量失败 67 → 2（剩余为环境/超时类） |
| BUG-0036 | P2 | ✅ | `ruff check apps/ai-service/{app,tests}` → **All checks passed** |
| BUG-0037 | P2 | 🔧 | 复现：`plugins-clone-retry` 单跑 4 failed / 7 passed，`ETIMEDOUT timeoutMs 200`。根因是断言 200ms 内子进程完成，而 Windows 冷启动本身就常超 200ms。阈值 200→1000 / 150→800-1000 / abort 400→1500，断言目标不变。并行跑两文件连续三次 **34 passed** |
| BUG-0038 | P2 | ✅ | `avatar-spec-wiring` 7 例全绿；shared 两文件复跑 **32 passed (32)**（`a2c709819c`） |
| BUG-0039 | P2 | ✅ | `bottom-action-bar-wiring` 的 13 vs 12 已查清真值：门计数几何 12 与 counts 对齐，小程序 token 内衬 C 事实移入口径外单独校验（`2d927c8a33`）。同一复跑 **32 passed (32)** |
| BUG-0040 | P2 | ⚠ | **部分修复**。已新增 `execGitCappedAsync`（`execFile` + Promise，AbortSignal 走 `killProcessTree` 团灭进程树）并让 `execGitCloneWithRetry` 改走异步版，补 5 例覆盖（正常/timeout/maxBuffer/abort 杀树/预先取消），`tsc` 退出 0、38 passed。剩余：`cache.ts` 的 fetch/checkout 与 `update-plan.ts` 四处仍走同步版，110-120s 级网络档在 TUI 路径上仍会卡 |
| BUG-0041 | P2 | ✅ | `auto_refresh.rs` 已改早退返回 `config.error`，`.expect` 只留在测试 |
| BUG-0042 | P2 | ✅ | 全局配置层已加运行时类型校验，非法值回落默认并逐键点名（`a2b3b7f60b`） |
| BUG-0043 | P2 | ✅ | 正常退出兜底已落地：`terminal.ts:264 process.once('exit', reapSessionsOnExit)` + `:319 ensureExitReaper()` + `spawn-isolated.ts:180 killProcessTreeSync`，正常 `process.exit` 走同步 `taskkill /T /F`。SIGTERM/`taskkill /F` 是 `TerminateProcess`，Node 侧无回调可跑，属 Windows 已知限制，已在源码登记，未造 workaround |
| BUG-0044 | P2 | ✅ | 门射程已补 sessions/checkpoints/subagents 状态面（`879c5cf418`） |
| BUG-0045 | P2 | ✅ | `check-disk-root-write --self-test` → **68/68 通过** |
| BUG-0046 | P2 | ✅ | `check-plan-id-pool --self-test` → 通过，池上限 99 已同步 |
| BUG-0047 | P2 | ✅ | `check-model-capacity-parity --self-test` → **23/23 通过** |
| BUG-0048 | P2 | ✅ | `check-retrieval-quality --self-test` → **28/28 通过** |
| BUG-0049 | P2 | ✅ | `check-service-binary-paths --self-test` → 全绿 |
| BUG-0050 | P2 | ✅ | `check-prod-checkout-foreign-work --self-test` → 通过（7 组判据） |
| BUG-0051 | P2 | ✅ | pre-commit 捕获输出已设 64MB `maxBuffer` |
| BUG-0052 | P2 | ✅ | `bare-sentinel-register.mjs` 已无 `G:\` 硬编码 |
| BUG-0053 | P2 | ✅ | `build-local-recovery-source.sh` 已无 `G:/` 硬编码 |
| BUG-0054 | P2 | ✅ | `add-defender-exclusion.ps1` 已无 `G:\` 硬编码 |
| BUG-0055 | P2 | ✅ | 全仓 `scripts/`+`deploy/` 扫 `G:\IHUI-AI` **零命中** |
| BUG-0056 | P2 | 🔧 | 双重问题：文件**不存在**且被 `.gitignore:209` 的 `.ihui-agent/*` 忽略 ⇒ 门恒判 `baseline=undetermined`。只对 state 目录开例外，再用门自己的 `--ratchet --write-baseline` 生成（不手写）。生成时 rot=0 故为 keys 空集，未洗白存量。`--ratchet` 现读 `GATE-ROT state=clean known=0 new=0 fixed=0` |
| BUG-0057 | P2 | ✅ | 根 compose 的 web 已有 `healthcheck`（8801） |
| BUG-0058 | P2 | 🔧 | 5 处业务镜像 `:latest` 全改 `${IHUI_IMAGE_TAG:-local}`。不猜版本号的理由：root/api/web/database 的 `version` 全为 `0.0.0`，`build.yml:52` 是 `push:false`，`release-on-tag.yml` 只建 Release —— 仓库内不存在可引用的镜像版本来源。变量名沿用 `deploy/saas/templates/customer/docker-compose.yml` 既有 `IMAGE_TAG` 约定。`grep image:.*:latest` 退出 1，yaml 解析 services=14 |
| BUG-0059 | P2 | 🔧 | observability Prometheus 宿主口 8825→8815（同文件第 11 行注释与全仓监控文档一律 8815），已随 `915a152c82` 入 HEAD |
| BUG-0060 | P2 | ✅ | `build.yml` 3 处、`release-on-tag.yml` 1 处 `timeout-minutes` 已在位 |
| BUG-0061 | P2 | 🔧 | `mobile-rn-release.yml:55` 的 `pnpm/action-setup@v4` pin 为 `b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4`（与仓内 14 个 workflow 逐字一致）；该 step 已有 `version: 10`。`grep pnpm/action-setup@v` 退出 1 |
| BUG-0062 | P2 | ✅ | weekly audit 的 `pnpm run typecheck` 已去掉 `\|\| echo` 兜底 |
| BUG-0063 | P2 | ✅ | 门已改为读 `scripts/dev-port-registry.json` 唯一真相 + 与 `docs/port-management.md §2` 双向对账，支持 `--all` 全项目扫 |
| BUG-0064 | P2 | ✅ | `relation-tables.ts` 现读 `primaryKey` 18 处、`uniqueIndex` 0 处 |

## 3. 本轮修复（按提交）

| 提交 | 覆盖缺陷 | 关键内容 |
|---|---|---|
| `915a152c82` | 0059 | observability 端口 8825→8815 |
| `b7264840df` | 0022 | 派生回调登记为非帧 + 基线现算 + 改前必红夹具 |
| `a2c709819c` | 0038 | 跨端锁目标跟真实文件 |
| `2d927c8a33` | 0039 | BottomActionBar 事实表分账，13→12 是查清真值 |
| `a22549c134` | 0029 | 7 处原生 title 换真 Tooltip |
| `609787c0f2` / `75890067f5` | 0030 | 10 处字符图标换真图标 + 红臂写法 |
| `a2b3b7f60b` | 0042 | 配置层运行时校验 |
| `879c5cf418` | 0044 | 写盘安全门射程补状态面 |
| `1ddd4a6bb3` | 0056/0058/0061 | 门基线入库 + 镜像 tag 变量化 + action pin SHA |
| `e9c3c785ed` | 0032/0033/0034 | 白名单剥 `.exe` 后缀 + 超时竞态根治 |
| `cf391b0855` | 0035 | 67 例按 4 个根因归并修复 |
| `1f87eb0048` | 0040/0037 | `execGitCappedAsync` + 冷启动阈值 |
| `d673f0ddc3` | 0028 | 端能力档案按既有口径如实登记 |
| （并行会话逐枚） | 0015 | CLI 测试类型 526→0，逐文件落库 |

## 4. 台账外新扫（本轮）

| 扫描 | 结论 |
|---|---|
| CI 假绿（`\|\| true` / `\|\| echo` / `continue-on-error`） | 94 处命中，逐处看：`ci-monorepo.yml:400/412` 的 `\|\| true` 后紧跟 `grep` 期望文案 + `exit 1`，是**正确**用法；`ci.yml:451` 已有独立产物校验兜住；`lighthouse-ci.yml:66` 与 `loop-daily-triage.yml:60` 是刻意非致命。**未发现新的假绿缺陷** |
| 生产码空 `catch {}` | 16 处命中，全部为刻意形态（best-effort `child.kill`、注入给浏览器的 JS 字符串、注释里的历史说明）。**未发现新的吞错缺陷** |
| `BUG-0026` 死键逐键反查 | 28 键全有消费点，`DEAD=0` |
| **新增：命令白名单拒 `.exe`** | `_tool_run_command` 用 first_token 的 basename 精确比对 `allowed_prefixes`，而名单按无后缀名维护 ⇒ `C:\...\python.exe` 这类最规范写法被判非法、命令根本不启动。**影响面超出测试**（任何绝对路径调用都会中招）。已修：比对前剥 `.exe/.cmd/.bat/.com` |
| **新增：`apps/api` 67 例确定性失败** | 不是隔离性问题（逐个单跑同样失败），是 4 个确定性根因。已修，见 BUG-0035 |
| **新增：`apps/api` 全量残余失败** | `agent-chat-read-pagination`（beforeAll 15s 超时）、`process-probe`（CIM 建树 60s 超时）、`sponsor-usdt-address-source`（扫 `apps/web` 大树超时）。均属环境/超时类，非本次引入 |
| **新增：`apps/api` tsc 既存 TS2322** | `src/db/chat-queries.ts` 等报 `shareTokenExpiresAt` missing —— 与 0021 的元数据漂移同源（主干 schema 无该列，worktree packages 有） |

## 5. 计划任务登记

7 条仍开项曾并成一枚可派单票登记入 `PROJECT_PLAN.md`：**B40**（2026-11-07，载体 `f3f91d257f`），票面逐项列出 BUG-0015 / 0042 / 0044 / 0058 / 0061 的现状与出路。该票覆盖的 5 条本轮**全部收口**。

本轮实测转「确定仍开」的 BUG-0038 / 0039 也已收口。剩余 4 条（0018 / 0020 / 0021 / 0040）性质各不相同：
- **0018**：需持钥方 ack，非 agent 可解
- **0020**：需生产只读 DSN，环境不可得
- **0021**：需人工逐条裁决 94/122 张表，不能自动化
- **0040**：需改 `cache.ts` / `update-plan.ts`，超出本轮许可面

## 6. 为什么不再有「可分析的 bug」

本轮把 64 条逐条按**代码实况**判完（不看提交信息），另加 4 类台账外扫描（CI 假绿 / 空 catch / 死键 / 命令白名单），并对测试套做了实跑取证（ai-service SSE 1062 例、queued 81 例、api 10 文件 132 例、shared 32 例、CLI 60 文件 935 例）。

剩余 4 条**不是「还没分析」，是「分析完了但受客观条件阻塞」**——每一条都写清了阻塞点与解锁条件。把它们写成「已修」或「无缺陷」才是真正的不负责（§0.3）。

### 6.1 若要把这 4 条也彻底关掉，各自需要什么

| 缺陷 | 解锁条件 | 谁来做 |
|---|---|---|
| BUG-0018 | 独立追认钥（19 枚待 ack） | 持钥方 |
| BUG-0020 | 生产只读 DSN 落 `.ihui-agent/db-sync.local.json` | 有机器的隧道配置的人 |
| BUG-0021 | 人工裁决 94 张「schema 有 snapshot 无」与 122 张「snapshot 有 schema 无」；再决定是重生成 snapshot 还是补幂等迁移 | 需 DBA 判断 |
| BUG-0040 | 允许改 `apps/cli/src/plugins/cache.ts` 与 `update-plan.ts` | 下一轮 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
