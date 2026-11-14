<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI 部署 / CI / 守护 / 钩子 / 门 —— 深度缺陷普查报告

- 仓库：`D:\IHUI-AI`
- 基线：`origin/main = 895027a9d644ce0688bb0d533281cf097db69578`（已 `git fetch origin --prune`）
- 工作树实测：`HEAD = d2bf9bd26bf53b8487dd3c7ab7f263873e8ed77a`，另有其他会话 216 条未提交改动（`apps/packages` 117、`scripts` 35、根配置 1）。`scripts/guardian-runner.mjs`、`scripts/check-immutable-guard.mjs` 虽显示 `M`，但 `git diff origin/main -- <这两个文件>` 为空 ⇒ 工作树内容与基线一致，本报告引用的行号对基线成立。
- 只读声明：本轮未改仓库、未提交、未 push、未运行任何 `--fix/--apply/--seal`，未启停服务。全部实验只在 `%TEMP%` 下的临时目录/纯函数上执行。
- 去重：对 `PROJECT_PLAN.md` 与 `scripts/data/plan-fields.jsonl` 检索 `gates-full / gate-timeout-budget / land-gate-budgets / preflight-watermark / scopeDegradeEvidence / fetch-depth / pushgate-cache / HEAD^ / pid 复用 / root-guard`。除既有「30a 恒红」症状登记（PLAN 第 641/1353 行）与无关的上游调研命中外，14 条均为新增，编号见下。

**新增条数：14（P1 ×5，P2 ×6，P3 ×3）。本轮全扫后仍存在可深挖面（见末节），未达「零新增」，故不宣布收敛。**

---

## DG-01 [P1] `gates-full` 自动触发腿与 `guardian-full` 取材面不一致 ⇒ 结构上不可能绿的全量门

- **文件与行号**
  - `.github/workflows/gates-full.yml:21-25`（`push` 到 main / 所有 `pull_request` / 手动）
  - `.github/workflows/gates-full.yml:44-77`（只有 `pnpm install --frozen-lockfile`，直接 `node scripts/guardian-runner.mjs --timing`）
  - `.github/workflows/guardian-full.yml:105-109`（`pnpm -r --filter "./packages/*" build`，注释明写「门 4/98 的 dist 取材面」）
  - `.github/workflows/guardian-full.yml:116-126`（`pip install uv==0.12.1`，注释明写「不装 ⇒ 门 254 落 exit 2 ⇒ 整批守门顶红」）
  - `scripts/lib/guardian-executor.mjs:462`（全局 `GUARDIAN_GATE_TIMEOUT_MS` 默认 `300_000`）
  - `scripts/data/land-gate-budgets.json:15-21`（门 30a 实测 506s，登记 900s）
  - `.github/workflows/guardian-full.yml:128-137`（唯一被设计成「报告档」的全量执行）
- **触发路径**：任何一次 push 到 main 或 PR → `gates-full` 在干净 runner 上跑 331 门 → 门 4/98 读到「没有 dist」→ 判「陈旧/悬空」红；门 254 没有 uvx → exit 2「未判定」；门 30a 在 300s 被看门狗杀 → 非零。任一项都让该 job 红，且注释声明「无 continue-on-error / 不做降级」（`gates-full.yml:78-81`）。
- **根因**：同一套门集有两条「全量执行腿」，准备步骤各写各的。`guardian-full` 是逐步加固过的（build + uv），`gates-full` 是后加的自动触发腿，只复制了 `install` 和 `runner` 两格。CI 上「缺输入」不落「未判定」而是直接判红，于是恒红。
- **证据（交叉对照 + 读数）**
  - `guardian-full.yml:105-107` 原文：`check-stale-dist / check-dangling-local-imports 读 packages/*/dist；干净 checkout 没有构建产物，不补就会把"未构建"判成"陈旧/悬空"`。
  - `guardian-full.yml:116-118` 原文：不装 uv ⇒ `门 254 判 Python lint … 落 exit 2 未判定并把整批守门顶红 —— 那正是 §12e 禁的恒红门`。
  - `gates-full.yml:44-77` 实测无 `pnpm -r build`、无 `setup-python/uv` 两格。
  - `land-gate-budgets.json` 30a：`measuredMs: 506000` / `timeoutMs: 900000`；而批处理腿仍是 300s ⇒ 每轮必被掐死。
  - `gates-full.yml:10-12` 自述首次全量「300 通过 / 6 警告 / 23 失败 / 2 跳过」——恒红不是假设，是既有读数。
- **影响面**：整条自动触发的全量 CI 腿永久红 ⇒ 必然被人忽略或放宽；而本地 pre-commit 自 2026-10-22 起一律 meta 档（`scripts/lib/gate-scope.mjs:168-180` 自述「本地不再拦业务代码错误」）⇒ **业务门在本地和 CI 两个面都没有有效阻断**，只剩 `ci.yml` 的 typecheck 三 job。
- **建议修法**：把 `guardian-full` 的 preparation（packages build、uv、可选 ai-service 依赖）抽成 composite action，两条腿共用；或直接废掉 `gates-full`，让加固后的 `guardian-full` 在 `push/pull_request` 触发。同时把 30a 走「按门预算」而不是全局 300s。
- **是否当场可修**：只读模式下否；改动集中在两个 workflow + 一处 executor，适合「两刀制」第一刀。

---

## DG-02 [P1] push 门缓存指纹漏掉「未提交的 scripts/ 与根配置」，60 分钟内可复用旧通过

- **文件与行号**：`scripts/lib/guardian-pushgate-cache.mjs:42-69`（指纹 = `HEAD:apps`、`HEAD:packages`、`HEAD^{tree}` + `git status --porcelain -z -- apps packages` + 门注册表规格；仅前 400 条脏路径读内容）、`:79-98`（命中即 `process.exit(0)`）、`:17`（`PUSHGATE_CACHE_TTL_MS = 60 分钟`）。
- **触发路径**：上一轮 push 门通过并写缓存；随后在工作树里**未提交地**修改 `scripts/check-typecheck.mjs`、`scripts/lib/*.mjs` 或根 `tsconfig.json / pnpm-workspace.yaml`；60 分钟内再 push 同一个 HEAD ⇒ 指纹不变 ⇒ 直接 exit 0，13 道 push 门一道都不跑。
- **根因**：`git status` 的 pathspec 只覆盖 `apps packages`，`HEAD^{tree}` 只覆盖**已提交**内容。T1（`check-typecheck`）判的是工作树，门脚本也是从工作树执行，但这两类「未提交的输入」不进指纹。注释（`:36-40`）解释了「只改 scripts/ 的提交要并入全树」，但那是**已提交**场景，未覆盖工作树脏态。
- **证据（实测读数）**
  - 同一时刻 `git status --porcelain` 统计：`all=216`、`-- apps packages=117`、`-- scripts=35`、`-- tsconfig.json tsconfig.base.json pnpm-workspace.yaml .npmrc package.json=1`。
  - 即：216 条脏改动里有 **36 条（35 scripts + 1 根配置）不在缓存指纹内**；其中任何一条都会改变门的执行逻辑或 typecheck 输入。
  - 400 条截断（`:58`）：`apps/packages` 脏文件超过 400 时，第 401 条起只进「路径名」不进「内容」，内容变化不再改变指纹。
- **影响面**：在「门脚本/配置正在被改」的开发窗口，push 可带着旧的绿色读数通过；因是后台自动 push（见 DG-03），告警只落日志。
- **建议修法**：指纹改为全仓 `git status --porcelain -z`（或在最低限度加入 `scripts/`、根 tsconfig、pnpm 配置）；去掉 400 截断或改为「超过阈值即判未判定、不写缓存」；把门执行器的 `gateSpecs` 之外再并入「门脚本 + 其 lib 闭包」的哈希。
- **是否当场可修**：否；单文件改动，可当场出补丁。

---

## DG-03 [P1] 跳门证据错配：typecheck 的「范围外降级」证据被当成「任何钩子失败都可 `--no-verify`」的通行证

- **文件与行号**
  - `scripts/lib/push-attempt-triage.mjs:173`（`SCOPE_DEGRADE_EVIDENCE_RE` 定义）
  - `scripts/lib/push-attempt-triage.mjs:234`（对整个 push 输出做一次正则）
  - `scripts/lib/push-attempt-triage.mjs:357-367`（`hook-failed` 分支把 `allowNoVerifyRetry = scopeDegradeEvidence`）
  - `scripts/lib/push-attempt-triage.mjs:369-376`（无法识别的失败也走同一判据）
  - `scripts/git-push-guard.mjs:1214-1230`（允许时 `pushOnce(true)` = `git push --no-verify`，随后仅打 warn）
  - `scripts/lib/post-commit-hook.js:170-181`（该 push guard 由 post-commit **后台**拉起）
- **触发路径**：一次 push 中 T1 因「报错文件全在范围外」而退出 0 并打印降级签名；同一批里 47p（水印）、IG（不可变护栏）或 299–308 任一门**真红** ⇒ 整条 push 失败。triage 看到「输出里有降级签名」⇒ `allowNoVerifyRetry=true` ⇒ 后台自动改推 `--no-verify`，跳过包括 47p/IG 在内的全部 13 道 push 门。
- **根因**：`scopeDegradeEvidence` 的语义是「**类型检查**的失败与本轮无关」，却被提升成「**钩子**失败与本轮无关」的全局证据；而钩子失败可能来自任意门。
- **证据（代码可达性）**：
  - `HOOK_TRACE_RE.test(text) === true`（打印「道 blocking 门失败」等）后，唯一决定是否跳门的量就是 `scopeDegradeEvidence`（`:363`）。
  - 该正则只看整段输出，不区分「哪道门打印的」。
  - `--no-verify` 的 warn 只写 stdout（`git-push-guard.mjs:1225-1229`），而 post-commit 是后台进程 ⇒ 人看不到。
- **影响面**：任何一次「T1 范围外降级 + 其他门红」的 push 都会在后台被跳门推上远端；被跳过的正是水印、不可变护栏这类结构性门。这是全链最危险的假绿，且发生时不打扰人。
- **建议修法**：证据必须绑定到「失败的那道门」——例如只允许对 `check-typecheck` 自身失败使用该证据；或要求人工 ack 文件才允许跳非 typecheck 门；`--no-verify` 路径强制前台可见（阻塞式提示而非后台 warn）。
- **是否当场可修**：否；判据层改动 + 夹具（需覆盖「T1 降级 + 47p 真红」组合）。

---

## DG-04 [P1] required 聚合器不依赖两个 preflight ⇒ 水印 / 冲突标记红不阻塞合并

- **文件与行号**
  - `.github/workflows/ci.yml:29-34`（自述：两个 preflight 不设 `needs`，主 job 也不 `needs` 它们，「前置检查先跑但不阻塞」）
  - `.github/workflows/ci.yml:37-59`（`preflight-watermark`、`preflight-conflict-markers` 两个独立 job）
  - `.github/workflows/ci.yml:404-405`（required 聚合器 `lint-typecheck-test: needs: [gate-build, gate-analyse, gate-test]`）
- **触发路径**：PR 里新增文件缺 Provenance 水印，或提交树里留 `<<<<<<<` ⇒ `preflight-watermark` / `preflight-conflict-markers` 红；但 `lint-typecheck-test` 只断言三 job 的 `result == 'success'` ⇒ required 检查绿 ⇒ 分支保护放行。
- **根因**：2026-11-02 把两条检查从主 job 链拆成独立 job，解决了「互相掩盖」，但同时把「阻塞」也拆掉了；聚合器未把它们纳入 `needs` 与断言。
- **证据（读数）**：`ci.yml:34` 原文「前置检查"先跑"但不阻塞」；`:404-405` 的 `needs` 列表只有三项；两个 preflight 检查脚本仅出现在 `:44-45`、`:58-59`，不在 `gate-build/analyse/test` 任何一步。
- **影响面**：删除/新增无水印文件、合并冲突残留可以合入默认分支，只要 typecheck 三 job 绿。分支保护只认聚合器时（`guardian-full.yml:38` 自述 required 现读只有 `CI / lint-typecheck-test`），这等于水印门在合并面失效。
- **建议修法**：把两个 preflight 加进聚合器的 `needs` 并逐项断言；或在分支保护上把两个 job 也设为 required（需仓库设置权限）。
- **是否当场可修**：否（只读）；workflow 改动可当场落地。

---

## DG-05 [P1] 不可变护栏「跳过 merge」+ `root-guard` 只封 4 个目标 + IG 不在全量注册表 ⇒ evil merge 可改门判据/执行器而不被任何门覆盖

- **文件与行号**
  - `scripts/check-immutable-guard.mjs:68-71`（自述残余：跳过 merge，靠 `root-guard --check 哈希封条` 承接）
  - `scripts/check-immutable-guard.mjs:1224-1225`（push 档同样跳过 merge）
  - `scripts/data/root-guard-manifest.json`（`targets` 只有 4 项：guardian-runner.mjs、judgement-libs.json、AGENTS.md 铁律段、git-guardian.mjs）
  - `scripts/guardian-runner.mjs:7462,7533`（`pushGateChecks` 自 7462 起；`check-immutable-guard.mjs` 只出现在 push 段，不在 `checks` 注册表）
- **触发路径**：一个 merge commit 引入两父都没有的树差异（evil merge），修改 `scripts/lib/gate-scope.mjs`、`scripts/lib/guardian-executor.mjs`、`scripts/lib/gate-failure-kind.mjs`、`scripts/check-*.mjs` 等；本地 push 的 IG 跳过 merge；CI 全量根本不注册 IG；`root-guard` 又不封这些文件 ⇒ 判据面被静默改写，后续所有门按改写后的逻辑判绿。
- **根因**：三处覆盖拼起来仍有缝：IG 明确跳过 merge；IG 不进全量注册表；`root-guard` 的封条清单只覆盖 4 个入口，不覆盖判据库与执行器。
- **证据（构造）**：
  - `check-immutable-guard.mjs:68-71` 原文承认「恶意 merge 自己改判据面（两父都没有的形态）归 root-guard --check 哈希封条」；
  - 实测 `root-guard-manifest.json` 的 `targets` 共 4 条，`gate-scope.mjs / guardian-executor.mjs / gate-failure-kind.mjs / gate-timeout-*` 均不在清单；
  - 注册表解析（341 条 `id+script`，其中 push 段 13 条）中 `check-immutable-guard.mjs` 仅 1 处注册且位于 push 段（`guardian-runner.mjs:7533`）。
- **影响面**：多会话/多机合并是常态，任何一次 GitHub 侧 merge（无本地钩子）或本地 evil merge 都能改门本身；这是「门自己的缺陷」中优先级最高的一类。
- **建议修法**：IG 对 merge commit 用「与每一父的差异」求并集（`git diff-tree -r -c` 或逐父 diff），差异文件必须声明；把判据库/执行器全部纳入 `root-guard-manifest.json`；把 IG 注册进全量 `checks`（需要给 merge 面专门的输入参数）。
- **是否当场可修**：否；设计与夹具都较重。

---

## DG-06 [P2] 同一道门 30a 存在两套超时口径，登记表只被落地通道消费

- **文件与行号**
  - `scripts/data/land-gate-budgets.json:14-28`（30a：900s/实测 506s；门 98：600s/实测 201s）
  - `scripts/lib/land-gate-rerun.mjs`（按 `script` 键读取该表，**只服务落地后置复跑**）
  - `scripts/lib/guardian-executor.mjs:462`（guardian 批处理腿统一 `300_000`）
  - `.github/workflows/gates-full.yml:79`（批处理里被 300s 杀直接算红）
- **触发路径**：`gates-full`/本地全量/任何 `guardian-runner` 批次跑到 30a ⇒ 300s 被杀 ⇒ 非零 ⇒ 全批红；同一门在「落地复跑」通道却拿 900s。
- **根因**：预算表为「落地通道」而建，执行器那边仍是全局单旋钮；两个通道没有共用同一份取数实现。
- **证据（读数）**：全仓检索 `land-gate-budgets` 的消费方仅 `land-gate-rerun.mjs` 一处；`guardian-executor.mjs:462` 未读该表；表内 `measuredMs: 506000` 明确大于默认 300s。另有本轮观察到的一份**工作树未提交件** `scripts/lib/gate-timeout-budget.mjs`（+ 同名 test，均不在 `origin/main`）本意是统一取数，但全仓生产引用为 0（仅自引用 2 处：文件自身与测试）⇒ 修法尚未落地，且它要求 `gateId + script` 双键，与已入库表的 `script` 单键结构互斥（一旦接线，表内所有行都匹配不上，静默退回 300s）。
- **影响面**：全量门集永远有一道必死门；「登记了 900s」与「实际仍是 300s」并存，台账读者会被误导。
- **建议修法**：executor 改为消费同一张 `land-gate-budgets.json`（键沿用已入库的 `script`，或同时补 `gateId` 并做迁移）；把「未提交的 budget 模块」要么接线要么删掉，不能保持「造好没装车」。
- **是否当场可修**：否；executor 取数面改动 + 夹具。

---

## DG-07 [P2] 守护单实例锁：只凭 `process.kill(pid,0)` 判活，pid 复用后死锁永不被回收

- **文件与行号**
  - `scripts/lib/guardian-lock.mjs:94-103`（`isPidAlive`）
  - `scripts/lib/guardian-lock.mjs:399-406`（`stale-alive` 只喊人，不回收）
  - `deploy/win/deploy-lock-common.ps1:8-34`（同根因的**已发生事故**与解药：锁里记 `StartTime`，`StartTime <= writtenAt(+容差)` 才认活）
- **触发路径**：guardian 进程被强杀/断电，遗留锁文件含 pid P；机器重启后 P 被 `postgres.exe` 等无关进程复用 ⇒ 下一次守护启动 `kill(P,0)` 成功 ⇒ 判 `alive-now / stale-alive` ⇒ 永不接管，守护静默停摆。
- **根因**：活性判据只用了「可被复用的身份」（pid），没有像部署锁那样记录并比对进程启动时刻。
- **证据**：`deploy-lock-common.ps1:8-15` 原文记录了同一机器上「锁 mtime 停在 04:53、内容是裸 pid 8052，重启后被 postgres 07:58:15 复用」的真实事件，并点名「`scripts/git-lock.mjs`（AGENTS §12）—— 都是拿可被复用的身份（pid）当活性判据」。guardian-lock 正是这类实现且未引入 StartTime。
- **影响面**：守护单实例锁失效方向是「永久不接管」，且不会报错；只能人工删锁。与「守护必须能自愈」相冲突。
- **建议修法**：锁内容增记 `pidStartTime`（与部署锁同法），回收前比对；读不到 StartTime 时落 `held-unknown` 并保留人工入口，不静默偷锁。
- **是否当场可修**：否；锁语义变更 + 夹具（需要「死锁 + pid 复用」两态）。

---

## DG-08 [P2] 部署轮次被杀后留下「标记=HEAD 但健康未证明」，下一轮不再走门禁

- **文件与行号**：`deploy/win/ihui-deploy.ps1:3970-3976`（自述新残余）；关联 `:3963-3969`、`:4383-4391`
- **触发路径**：构建完成后、健康门禁通过前，部署守护被强杀/机器重启 ⇒ `.next` 有新构建但标记已前进到 HEAD ⇒ 下一轮 `Get-BuildStale` 判「不陈旧」直接跳过重建，也**不再跑健康门禁** ⇒ 未经健康证明的版本继续在线。
- **根因**：部署标记的写入时机与「健康证明」解耦；把「构建完成」当成「可上线」。
- **证据（原文）**：`:3970`「被杀的轮次现在会留下"标记=HEAD 但健康未经证明"。且**下一轮不会重新走门禁**」。
- **影响面**：半完成状态无人检测；只有人工发现时才回滚/重启，线上可能长期跑未验证构建。
- **建议修法**：标记拆成 `built` / `healthy` 两态（或写 `healthUnproven=true`），下一轮见到 `built 未 healthy` 必须补跑门禁；健康通过后才允许推进「已部署」标记。
- **是否当场可修**：否；ps1 主流程改动 + 故障注入演练。

---

## DG-09 [P2] `HUSKY_SKIP_TYPECHECK=1` 名不副实：跳过的是整条 push 门链（13 道 blocking），不是 typecheck

- **文件与行号**：`.husky/pre-push:123`（说明文案）、`:137-138`（触发与提示「已跳过全量 typecheck 验证」）、`:139-288`（被整段跳过的 push 门调用）
- **触发路径**：开发者遇到与本次改动无关的脏文件导致 T1 红 ⇒ 按提示（`:149`）设置 `HUSKY_SKIP_TYPECHECK=1` ⇒ 47p 水印、IG 不可变护栏、299–308 等 13 道门全部不跑，但提示词只说「跳过 typecheck」。
- **根因**：shell 层的开关包住了 `guardian-runner --push-gate` 整块，而提示文案按「T1」命名。
- **证据**：`:137-138` 的 `if` 覆盖到 `:288` 的 runner 调用；`:149` 明确建议用户用该变量。push 门集见 `scripts/guardian-runner.mjs:7462-7560`（13 道）。
- **影响面**：用户以为只豁免了一门，实际关闭了水印与不可变护栏；且不生成「哪几门被跳过」的清单。
- **建议修法**：拆成 `HUSKY_SKIP_TYPECHECK_ONLY=1`（仅对 T1 传 skipEnv）与「全跳」两个显式开关；提示词逐门列出被跳过项；退出时打印 `skippedGates=[...]`。
- **是否当场可修**：否；钩子脚本改动。

---

## DG-10 [P2] format 门：显式给定的基线不可解析时静默回落 `HEAD^`，在更窄的面上判绿

- **文件与行号**
  - `scripts/check-format-changed.mjs:95-103`（`decideBaseRef`：`envRef` 不可解析且 `HEAD^` 可解析 ⇒ `kind:'diff', ref:'HEAD^'`）
  - `.github/workflows/ci-monorepo.yml:72-93`（`fetch-depth: 2`；`FORMAT_BASE_REF: ${{ github.event.before || 'HEAD^' }}`）
- **触发路径**：一次 push 含 N>2 枚提交，或 PR 事件（无 `github.event.before`）⇒ 事件给的基线在浅克隆里不可达 ⇒ 门回落到 `HEAD^`，只检查最后一枚提交新增的 `.mjs`；同一 push 里前面提交新增的文件完全不判。
- **根因**：把「显式指定但取不到」与「没有指定」共用同一条回落路径；回落方向是「少判」而不是「未判定」。
- **证据（纯函数变异，只读）**
  - 直接调用仓库实现：`decideBaseRef({envRef:'deadbeef', canResolve:(r)=>r==='HEAD^'})` ⇒ `{"kind":"diff","ref":"HEAD^"}`。
  - `ci-monorepo.yml:77` `fetch-depth: 2` + `:93` 的 `before || 'HEAD^'` 决定该路径在 CI 上稳定可达。
- **影响面**：PR/多提交 push 的格式棘轮静默漏判；因是 advisory 面，危害限于「新增文件的格式债延后暴露」，但属结构性的「窄面判绿」。
- **建议修法**：`envRef` 非空但不可解析 ⇒ `unjudged`（exit 2）；CI 侧改 `fetch-depth: 0` 或用 PR base 的 `merge-base` 作为显式基线。
- **是否当场可修**：否；一行判据 + workflow 一行。

---

## DG-11 [P2] `gate-scope` 文件头注与实现互斥：头注说「含 apps/packages ⇒ full」，实现恒 `meta`

- **文件与行号**
  - `scripts/lib/gate-scope.mjs:17-20`（头注：`full` 的两种情形之一是「暂存集含 apps/ 或 packages/」）
  - `scripts/lib/gate-scope.mjs:168-204`（实现：业务路径只记 `bizNote`，一律返回 `meta`）
  - `scripts/lib/pre-commit-hook.js:1410`（仍打印「🐢 全量档：本次会跑全部守门（预计 9~15 分钟）」）
- **触发路径**：维护者按头注预期「改业务代码会自动全量」⇒ 实际本地永远 meta；同时 `:1410` 的全量档提示在本地永远不会出现（除非显式 `IHUI_GATE_SCOPE=full`）。
- **根因**：2026-10-22 的「本地一律 meta」决定只写进了实现区注释（`:168-180`），没有回头改模块头注和钩子文案。
- **证据（纯函数读数，只读）**
  - `resolveGateScope(['apps/web/app/page.tsx'])` ⇒ `{"scope":"meta","reason":"本地元门档:全量守门归 CI(含业务路径 1 个,业务判据归 CI)"}`；
  - `resolveGateScope([])` ⇒ `{"scope":"full","reason":"暂存集为空或读不到"}`（失效方向正确，仅头注错）。
- **影响面**：自我陈述与真实行为互斥（与「守护 STALE 自陈述」同型）；新维护者据此判断覆盖面会误以为业务提交有本地门。
- **建议修法**：改头注与 `:1410` 文案；或把 `full` 的定义改成头注描述的三档并保留 `IHUI_GATE_SCOPE=full`。
- **是否当场可修**：是（纯文档/常量文案，不改判据；但本次只读）。

---

## DG-12 [P3] 发布 tag 闸要求整树 `porcelain` 干净：多会话共享工作树下被他人 WIP 永久阻断

- **文件与行号**：`.husky/pre-push:50-52`（规则说明）、`:102-104`（`git status --porcelain` 非空即拒绝发布 tag）
- **触发路径**：本机工作树同时有其他会话/用户的未提交改动（本轮实测 216 条）⇒ `git push origin desktop-v*` 被拒绝，即便被 tag 的提交本身干净。
- **根因**：把「发布提交是否干净」实现成「当前工作树是否干净」；共享工作树里两者不等价。
- **证据**：当前 `git status --porcelain` = 216 条；钩子判据是整树非空即拒绝（`:102`）。发布 tag 是日常动作（`desktop-v*` / `cli-v*`）。
- **影响面**：发布流程被无关脏文件卡死；逃生方向是 `HUSKY_SKIP_TYPECHECK` 或清理他人改动，两者都比「拒绝」更危险。
- **建议修法**：改为对「被 tag 的提交树」判净（如 `git diff --quiet <tag>^{tree} -- <发布相关路径>`），或提供带审计记录的显式 `NEW_RELEASE_TAG_ALLOW_DIRTY=1`（仅允许已知路径）。
- **是否当场可修**：否；钩子判据变更。

---

## DG-13 [P3] 部署门禁失败 → 回滚 → `exit 0`，按退出码记账的调用方会把失败轮记成成功

- **文件与行号**：`deploy/win/ihui-deploy.ps1:900`（自述契约）、`:4043`（「外壳按退出码记账，换码会改形态」）、`:4390`（「构建失败 exit 1、门禁失败走 Do-Rollback 后 exit 0」）
- **触发路径**：健康门禁判不过 ⇒ `Do-Rollback` 回到旧版本 ⇒ 进程以 0 退出。计划任务/外部监控/巡检若只看退出码，会把这一轮记为「部署成功」；「已回滚」只能从日志或状态文件里二次确认。
- **根因**：把「本轮流程走完」与「新版本已上线」共用同一退出码；失败语义只留在自由文本日志。
- **证据（原文）**：`:4390` 明确写出两条失败路径的退出码差异（构建失败 1、门禁失败 0），`:900` 也写明 `Set-BuildCooldown → Do-Rollback → exit 0`。
- **影响面**：失败轮静默；与 DG-08（半完成态）叠加时，可观测性进一步下降。
- **建议修法**：保持 0 退出但必须写结构化结果（`state/deploy-outcome.json`: `{outcome:'rolled-back', reason, targetSha, previousSha}`）并让外部巡检读该文件；或使用约定好的非零码（如 3 = 健康门禁失败已回滚）并同步更新所有调用方。
- **是否当场可修**：否；需与部署外壳/计划任务一起改。

---

## DG-14 [P3] 元门档是「脚本名正则白名单」：新增门命名不命中即本地零通道，且没有门保证「每门至少一个阻断通道」

- **文件与行号**：`scripts/lib/gate-scope.mjs:89-150`（`META_SCRIPT_RE` 前缀白名单 + `isMetaGate`）、`scripts/guardian-runner.mjs:7885-7887`（meta 档过滤）、`scripts/guardian-runner.mjs:7462-7560`（push 门 13 道）
- **触发路径**：新门注册进 `checks`，脚本名不以 `check-gate-/check-husky-/check-doc-/check-watermark/...` 开头 ⇒ 本地 pre-commit 被裁掉；若又没进 push 门集 ⇒ 本地与 push 面均无它，只剩非 required 的全量 CI（见 DG-01）。
- **根因**：覆盖面靠命名启发式而非显式清单/接线门；`check-gate-wiring` 校验的是文档接线形态，不保证「每门至少一个阻断通道」。
- **证据**：注册表解析出 341 条 `id+script`（无重复 id、无缺脚本，属正向结论）；覆盖率却由「13 道 push + 正则命中的 meta」决定，二者都是白名单。新增门默认落在两者之外。
- **影响面**：门数增长时静默产生「只存在于报告档」的门；与 DG-01 组合成系统性零覆盖。
- **建议修法**：把 meta 清单改为数据文件（显式 id）并加一道「通道覆盖门」：任一注册门必须 ∈ {meta, pushGate, 某个 required CI job}，否则门本身判红。
- **是否当场可修**：否；新增门 + 数据迁移。

---

## 已否证 / 试错记录（本轮实测，避免下一轮重复投入）

1. **「push 缓存指纹为 null 时二次命中假绿」——否证。**
   - 构造：在 `%TEMP%` 新建空 git 仓（无提交 ⇒ `HEAD^{tree}` 取不到 ⇒ `computeGateFingerprint` 返回 null），调用仓库真实模块 `writePushGateCache`，落盘得到 `{"fp":null,"passed":true,...}`；再调用 `pushGateCacheEarlyExit`。
   - 读数：第二次**未**早退（打印 `NOT-EARLY-EXIT`）。原因：`:86` 的 `cache.fp &&` 真值守卫拦住了 null。方向正确（fail-closed）。
2. **「看门狗把真红变未判定后仍放行」——未成立。** 超时在 executor 侧分流为未判定且不写 push 缓存（`guardian-executor.mjs:1011,1051-1053`），pre-push 对非零统一阻塞。
3. **「新增门默认结构性必红」——未发现。** 341 条注册全部有脚本文件、无重复 id；恒红问题只出现在 CI 取材面（DG-01），不是门注册表本身。

---

## 未判定（本轮取不到判据，不记为缺陷）

- **分支保护 required 列表**：本机无 `gh` 鉴权，无法读 `branches/main/protection`。DG-01/DG-04 的「阻断力」结论依赖「required 只有 `CI / lint-typecheck-test`」这一自述（`guardian-full.yml:38`）；若实际还 required 了其它 job，结论需重算。
- **CI 历史运行状态**：无法取到 GitHub Actions 运行记录，`gates-full` 是否已经长期全红只能由 workflow 自述的「23 失败」与取材面缺口推断。
- **`git-guardian.mjs`（796KB）只读了锁/自愈相关段落**，未逐函数审计；守护的日志截断、轮次状态机、自愈动作是否覆盖他人成果，本轮未形成结论。
- **`deploy/win` 50 个文件只深读了 `ihui-deploy.ps1` 的部署/回滚/健康段与 `deploy-lock-common.ps1`**；蓝绿切换、迁移脚本、服务安装脚本未逐个核。
- **55 个 workflow 只精读 5 个**（`ci.yml`、`ci-monorepo.yml`、`gates-full.yml`、`guardian-full.yml`、`blue-green-deploy.yml`）。
- **供应链**：`package.json` 无 `latest/*/git+` 等不受控 specifier；actions 全部 pin SHA；Dockerfile 基础镜像 pin digest、`uv export --frozen` + `--require-hashes`；`pnpm-workspace.yaml` 有 `minimumReleaseAge: 1440` 与 build-script 白名单，本轮**未发现可证实缺陷**。两点建议（非缺陷）：`minimumReleaseAge` 仅 24h，低于社区常用的 7 天；`.npmrc` registry 指向 `registry.npmmirror.com`，属镜像集中风险。

---

## 覆盖清单（本轮实际扫过的面）

| 面 | 数量 | 实际核到什么 |
| --- | --- | --- |
| 门注册表 | 341 条 `id+script` | 全量解析：无重复 id、无缺失脚本；push 档 13 条；meta 档由 `META_SCRIPT_RE` 白名单决定 |
| 本地门档 | pre-commit | `gate-scope` 档位、`pre-commit-hook.js` 的调用/超时/失败码、`--staged` 面选择、`HUSKY_SKIP_*` 逃逸 |
| push 门 | 13 道 | `guardian-runner` push 段、`guardian-executor` 缓存与看门狗、`guardian-pushgate-cache`、`guardian-gate-cache`、`push-attempt-triage`、`git-push-guard` |
| 钩子 | 9 个文件 | `pre-commit`（委托 JS）、`commit-msg`、`post-commit`、`pre-push`、`pre-rebase`、`reference-transaction`、`post-checkout/post-merge`（浅读）、`hook-run-hidden.vbs`、`hook-marker.sh` |
| CI | 5 个 workflow 精读 | `ci.yml` / `ci-monorepo.yml` / `gates-full.yml` / `guardian-full.yml` / `blue-green-deploy.yml` |
| 守护 | 锁与自愈段 | `guardian-lock.mjs` 全读；`git-guardian.mjs` 锁/心跳/重启/自愈相关段 |
| 部署 | 2 个核心文件 | `deploy/win/ihui-deploy.ps1`（部署/健康/回滚/标记段）、`deploy/win/deploy-lock-common.ps1` 全读 |
| 供应链 | 5 个配置面 | `package.json`、`.npmrc`、`pnpm-workspace.yaml`、`apps/ai-service/Dockerfile`、workflow 的 install/action pin |
| 基线一致性 | 全部引用文件 | `git diff origin/main -- <引用文件>` 为空（`gate-timeout-budget.mjs` 为例外，属工作树未提交件，已在 DG-06 标注） |

**变异/构造实验**：`decideBaseRef` 坏基线纯函数实验（DG-10）、`resolveGateScope` 业务路径实验（DG-11）、push 缓存 null 指纹临时仓实验（已否证 1）、脏文件 pathspec 计数（DG-02）。

---

## 仍可深挖方向（非零，按优先级）

1. **逐门判据面审计**：453 个 `check-*.mjs` 里，本轮只按注册表与重点门核了「面选择」。仍有大批门可能对工作树求值/只取第一父/依赖未跟踪文件；建议按「读取路径 → 面选择函数 → 失败码」三列做机器化清单，再抽 20 门做临时仓变异。
2. **`git-guardian.mjs` 状态机**：轮次游标、`git-guardian-round-cursor`、STALE 自陈述、自愈动作（`nssm restart`、`pull`/`merge`）是否覆盖他人成果；796KB 未逐函数读。
3. **部署面剩余 48 个脚本**：蓝绿切换（`api-bluegreen`）、迁移幂等、服务安装/卸载、健康检查的「端口 vs 业务就绪」。
4. **其余 50 个 workflow**：缓存键、`pull_request_target`、`paths` 过滤漏触发、并发 group、超时/重试；本轮只覆盖门/CI 主链。
5. **供应链策略面**：`minimumReleaseAge=1440` 是否被 mirror 绕过、`allowBuilds` 白名单与 pnpm 11 的 `strictDepBuilds` 实际行为（需要实跑安装才能证实，本轮只读不装）。
6. **钩子覆盖缺口**：`git merge` 产生的 merge commit 不跑 pre-commit（Git 语义）与 DG-05 的组合影响；`git commit --only` 私有索引下的探针是否真的隔离（需构造临时仓）。
7. **CI 运行史**：拿到 `gh` 鉴权后核对 `gates-full` 最近 30 次结论分布，验证 DG-01 的恒红推断与 required 列表。

## 附：T1 全量 typecheck 并发实现实测对比（2026-11-08 合并裁决）

`integrate/release-20261106` 与 main 各自重写了 T1 提速；合并取 main（`resolveConcurrency()` 按机器推导并发上限），分支实现退场（LPT 派发 4 并发 + `lib/typecheck-lock.mjs` 已删）。实测数据保留备查（同机、本 worktree real `node_modules`、21 包）：

| 实现 | 冷/热 | 包内耗时 | 总耗时 |
| --- | --- | --- | --- |
| 分支 LPT 4 并发 | 热 | 150s | 163s |
| 分支 LPT 4 并发 | 冷 | 174.5s | 183s |
| 分支串行（对照） | 热 | — | 309s |

结论：LPT 4 并发把总耗时压到串行对照的约 53%（309s → 163s）；main 的 `resolveConcurrency()` 同样按机器推导上限，量纲与效果同族，故不保留第二套派发逻辑。T1 的预算证据随行并入 `scripts/data/land-gate-budgets.json` 的 `check-typecheck.mjs` 条目（第二本账已删）。

> 本报告未覆盖面均在上表与本节显式列出；在完成第 1、2 项（逐门判据面 + 守护状态机）之前，不建议宣布「一轮零新增」。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
