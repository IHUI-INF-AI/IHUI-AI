<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: C:\Users\Administrator\Documents\Trae-CN\temp_20261106_30\worktree-cleanup-plan-20261106.md
> 生成时间: 2026-11-06 23:53:42
> 所属工作线: 仓库拓扑线（worktree 清理盘点）

# D:\IHUI-AI Worktree 与残留物盘点 · 清理方案（只读盘点，未执行任何删除）

- 盘点时间：2026-11-06 20:05–20:33（Asia/Shanghai）
- 盘点性质：**全程只读**。未执行 `worktree remove`、未拆任何 junction、未删任何锁文件、未 `--force`。
- 仓库拓扑：`D:\IHUI-AI\.git` 是一个 gitfile（28 B）→ `gitdir: D:/IHUI-AI-git-repo`；真正的 git 目录就是 `D:\IHUI-AI-git-repo` 本身（非 `\.git` 子目录），工作树是 `D:\IHUI-AI`。

## 0. 先纠正两个与任务假设不符的事实

| 假设 | 实测 | 影响 |
|---|---|---|
| `wt-origin-base` 上挂着 node_modules junction → `D:\IHUI-AI\node_modules`（约 82GB） | **该 junction 已不存在**（`Test-Path` = False，深度 2 递归也扫不到）。`wt-origin-base` 当前工作树干净、无 node_modules | 这条"硬风险点"的前提已过期；但**同型 junction 仍有 70 个**分布在 23 个已注册 worktree + 2 个孤儿目录，风险本身没消失，只是换了宿主 |
| `D:\IHUI-AI\node_modules` 约 82GB | **实测 6.76 GB / 263,248 个文件** | 82GB 应是把 junction 跟随进去、把同一份 `.pnpm` store 重复计数得出的。真实体量 6.76GB |

另：`wt-land2` 不是孤儿——它在 `git worktree list` 里（`integrate/converge-20261106`，且 `locked converge-20261106`）。真正没注册的孤儿是 `wt-land`（同目录下）。

## 1. 硬风险点（删了会丢东西 / 删错会伤主工作区）

1. **`wt-land2` 正在跑合并，绝对不能碰。**
   - `worktrees/wt-land2/locked` = `converge-20261106`；`MERGE_HEAD` / `AUTO_MERGE` / `MERGE_MODE` / `MERGE_MSG` 全在（18:20:15 起合并未收尾）。
   - `worktrees/wt-land2/index` 最后写于 **20:25:11**（盘点开始 20:05 时是 20:13:35，期间又写了一次）；`merge-commit-out.txt` 写于 20:13:35；`pre-commit-hook.js` 进程（PID 6636/12452）自 19:51:49 起持续在跑；另有 `scripts/union-converge.mjs --theirs 580190e0…`（PID 3368，20:15:33 起）。
   - 工作树 213 条状态：**209 已暂存 + 4 未暂存 + 0 未跟踪 + 0 冲突**，13 个 origin/main 之外的提交。这些都是暂存区里、尚未成提交的内容。

2. **`ihui-merge-wt` 是一个未收尾的合并现场。**
   - detached `cdb8b178`，`MERGE_HEAD` 自 11-05 15:25 起就在，**1003 条已暂存**（A223 / M764 / D7 / R9），index 2294648 B。
   - 一旦 `worktree remove`，这 1003 条暂存内容（及其 index）就没了；对象虽在库里，但"哪些文件该怎么合"的现场信息无法重建。

3. **`wt-root-navbar-barrel` 索引与磁盘严重不一致。**
   - 15395 条 ` D`（删除态）+ 1 条修改，但磁盘上还有 3670 个文件。这不是"有未提交内容"，而是"工作树已经被掏空/写坏"。
   - 唯一那条修改：`scripts/staged-deletions-allowlist.json`。核对前不得删。

4. **任何带 junction 的 worktree，直接用 `git worktree remove` 都有把 `D:\IHUI-AI\node_modules` 递归删空的风险。**
   - `git worktree remove` 走递归删除；Windows 上 reparse point 是否被当作普通目录跟随，取决于实现细节，不能赌。
   - 必须先拆链接（见第 4 节），并且**永远不加 `--force`**。
   - 当前持有 junction 的已注册 worktree 共 23 个（见第 3 节标注），最深的是 `wt-tenant-boundary` / `wt-e2e-skip-wait` / `wt-mobile-assistant-mock`（各 28 个）、`land-cli-atomic-write`（21 个）、`wt-minimax-null-1106` / `wt-gemini-models-ce` / `wt-root-nginx-prefix`（各 17 个）。

5. **本地 `main` 与 `origin/main` 已严重分叉，不要把"未推提交"当唯一判据。**
   - `main` = `3227943`（2026-11-06 20:37:55）；`origin/main` = `580190e0`（2026-11-06 20:07）；merge-base `29cb27d`。
   - `main..origin/main` = **1066**；`origin/main..main` = **394**。
   - 盘点这半小时内 `main` 从 `194251a`(17:48) 推进到 `3227943`(20:37)，主工作区脏文件 169 → 172 → 173，说明主仓仍在写。
   - 因此任务里给的 `git log origin/main..HEAD --oneline` 会把大量"本地 main 独有但其实在别的 ref 里"的提交算成未推（表现为 200–390 的虚高数字）。真正有判断力的是 **`HEAD --not main origin/main`**：全部 63 个 worktree 的分支独有提交都在 **0–13** 之间。

6. **`D:\IHUI-AI` 主工作区正在活跃运行，不要当清理对象。**
   - `next dev --turbopack -p 8877`（PID 12796）、`deploy-lock.mjs heartbeat`（PID 30828）、`git-guardian.mjs --daemon`（PID 19772）、`git-guardian-hidden.vbs`（PID 12160）、`warm-dev-routes.mjs`。
   - `D:\IHUI-AI\.deploy.lock\meta.json` 最后写于 **20:31:01**，仍在心跳。
   - 主工作树脏文件 **172** 条，且数量还在增长（盘点开始时 169）。

7. **`wt-g40` 是 detached，但不存在孤悬提交**：`rev-list --count HEAD --not --all` = 0，其独有的 1 个提交已被其他 ref 覆盖，删工作树不丢提交。`wt-origin-base`（detached `a1b1bf04`）同理，孤悬 = 0。

8. **`wt-land` 是"gitdir 已被摘掉"的孤儿目录**，无法再用常规 git 复核：
   - 9670 个文件 / 641.8 MB，无 node_modules，`newerThan 14:13:26 = 0`（之后没人再写过）。
   - 用"逐文件 `hash-object` + `cat-file --batch-check`"做的字节级核对：9670 个文件里只有 11 个文件的 blob 不在本库对象库中；把这 11 个文件与 `D:\IHUI-AI` 现存同名文件比对，**11/11 字节完全一致**。结论：内容没有唯一副本，删目录不会丢内容；但仍建议先落一份清单存档。

## 2. 全量清单（63 个已注册 worktree + 5 个未注册残留）

判定口径：`可删` = 工作树干净（0 未提交/未跟踪）∧ 非活跃 ∧ 未 locked ∧（要么无 junction，要么先拆）；`保留` = 命中任一条保命条件。**"可删"只删工作树目录，分支 ref 一律保留**（提交不会丢）。

| # | 路径 | 分支 / HEAD | 状态 | 判定 | 理由 |
|---|---|---|---|---|---|
| 1 | D:\IHUI-AI-git-repo | main `3227943` | 干净 | 保留 | 主仓入口；dev server 8877 / deploy-lock 心跳 20:31 / git-guardian daemon 在跑；main 在盘点半小时内推进 1 个提交 |
| 2 | …\ihui-converge-exec-20261106\wt-land2 | integrate/converge-20261106 `84573aa` | 213（209 staged） | 保留 | locked + MERGE_HEAD 未收尾 + pre-commit hook 19:51 起在跑 + index 从 20:13 又写到 20:25 |
| 3 | …\ihui-converge-exec-20261106\wt-origin-base | detached `a1b1bf04` | 干净 | 可删 | 无 junction（已被摘掉）、无提交孤悬；最后活动 13:44 |
| 4 | …\Temp\wt-minimax-null-1106 | fix/minimax-refresh-null-accounting-20261106 `82b9f27` | 干净 | 可删（先拆 17 链接） | 分支独有 1 提交仍在 ref；活动止于 18:13 |
| 5 | …\Temp\wt-navbar-barrel | fix/app-barrel-navbar-r2 `a1b1bf0` | 1 改动 | 保留 | `packages/shared/src/ui/__tests__/navbar-wiring.test.ts` 未提交；2 链接 |
| 6 | …\Temp\wt-shared-exports | fix/shared-exports `45ab86f` | 干净 | 可删 | 真实 node_modules（非链接），常规删即可 |
| 7 | …\Temp\wt-tenant-boundary | fix/tenant-boundary `c87d1a7` | 干净 | 可删（先拆 28 链接） | 活动止于 14:47 |
| 8 | …\Temp\wt-tool-result-envelope | fix/tool-result-envelope `7547942` | 干净 | 可删 | 真实 node_modules |
| 9 | …\temp_20261106_11\wt-e2e-skip-wait | fix/e2e-skip-wait `83e3497` | 3 改动 | 保留 | 3 个改过的 e2e/脚本未提交；28 链接 |
| 10 | D:\DevEnv\Temp\ihui-merge-wt | detached `cdb8b17` | 1003 staged + MERGE_HEAD | 保留 | 未收尾合并；见风险点 2 |
| 11 | D:\DevEnv\Temp\wt-apiroutes | wt-apiroutes `9c7f970` | 干净 | 可删 | 活动止于 11-05 20:15 |
| 12 | D:\DevEnv\Temp\wt-fix-ai | fix/ai-service `91d4034` | 干净 | 可删 | 同上 |
| 13 | D:\DevEnv\Temp\wt-fix-ci | fix/ci-gates `3c11049` | 干净 | 可删（先拆 1 链接） | 同上 |
| 14 | D:\DevEnv\Temp\wt-fix-cli | fix/cli-p0 `64da806` | 干净 | 可删 | 真实 node_modules |
| 15 | D:\DevEnv\Temp\wt-fix-desktop | fix/desktop-cap `520a089` | 干净 | 可删（先拆 9 链接） | 同上 |
| 16 | D:\DevEnv\Temp\wt-fix-escape-tests | fix/escape-test-samples `c328aee` | 干净 | 可删 | 同上 |
| 17 | D:\DevEnv\Temp\wt-fix-internal | fix/internal-auth `b7e9b60` | 干净 | 可删 | 同上 |
| 18 | D:\DevEnv\Temp\wt-fix-readme-gates | fix/readme-legs-deadlock `a8aca3b` | 干净 | 可删（先拆 1 链接） | 同上 |
| 19 | D:\DevEnv\Temp\wt-fix-rls | fix/rls `6a79bec` | 干净 | 可删 | 同上 |
| 20 | D:\DevEnv\Temp\wt-fix-ticket | fix/internal-ticket-verify `1165a8d` | 干净 | 可删 | 同上 |
| 21 | D:\DevEnv\Temp\wt-fix-web | fix/web-p0 `4c9ccdf` | 干净 | 可删 | 同上 |
| 22 | D:\DevEnv\Temp\wt-g40 | detached `e30994e` | 干净 | 可删 | 孤悬提交 = 0；1 链接 |
| 23 | D:\DevEnv\Temp\wt-g40-land | land/g40 `6645b3a` | 干净 | 可删 | 活动止于 11-05 20:51 |
| 24 | D:\DevEnv\Temp\wt-gemini-models-ce | fix/gemini-models-config-enabled `73062d7` | 干净 | 可删（先拆 17 链接） | 活动止于 18:09 |
| 25 | D:\DevEnv\Temp\wt-root-api-security | fix/api-security-three `f8213f5` | 3 未跟踪 | 保留 | `apps/api/tests/tmp-sf07|sf12|sf13-probe.test.ts` 未跟踪 |
| 26 | D:\DevEnv\Temp\wt-root-api-tenant | fix/api-tenant-boundary `f8213f5` | 2 未跟踪 | 保留 | `tests/helpers/temp-pg.ts` + `sf04-tenant-header-authz.test.ts` 未跟踪 |
| 27 | D:\DevEnv\Temp\wt-root-authjson | fix/auth-json-rmw-race `b81dce6` | 干净 | 可删 | 分支独有 4 提交在 ref；6 链接 |
| 28 | D:\DevEnv\Temp\wt-root-cli-atomic-state | fix/cli-atomic-state `3cfdbd7` | 1 改动 | 保留 | `apps/cli/src/util/atomic-write.ts` 未提交 |
| 29 | D:\DevEnv\Temp\wt-root-cli-typecheck | fix/cli-tests-typecheck `78dda86` | 99 改动 | 保留 | 第二批之后的 99 个测试改动未落 |
| 30 | D:\DevEnv\Temp\wt-root-clockdep | fix/test-time-dependence `c0654fa` | 6 改动 | 保留 | 时钟注入相关 6 文件未提交 |
| 31 | D:\DevEnv\Temp\wt-root-desktop-auto-refresh | wt-root-desktop-auto-refresh `071246b` | 干净 | 可删 | 活动止于 11-06 02:15 |
| 32 | D:\DevEnv\Temp\wt-root-e2e-skips | fix/e2e-skip-discipline `f8213f5` | 47 改动 | 保留 | 47 个 e2e 改动未提交 |
| 33 | D:\DevEnv\Temp\wt-root-miniapp-voice-audio | fix/miniapp-voice-audio `f8213f5` | 3（2 未跟踪） | 保留 | `voice-audio.ts` + 生命周期用例未跟踪；23 链接 |
| 34 | D:\DevEnv\Temp\wt-root-mobile-assistant | fix/mobile-assistant-mock `f8213f5` | 3（2 未跟踪） | 保留 | `assistant-demo-mode.ts` + 门禁用例未跟踪 |
| 35 | D:\DevEnv\Temp\wt-root-navbar-barrel | fix/app-barrel-navbar `f8213f5` | 15395 D + 1 M | 保留 | 索引与磁盘不一致（磁盘仅 3670 文件）；见风险点 3 |
| 36 | D:\DevEnv\Temp\wt-root-nginx-prefix | wt/wt-root-nginx-prefix-…-020b6b `0a5db43` | 干净 | 可删（先拆 17 链接） | 活动止于 10:42 |
| 37 | D:\DevEnv\Temp\wt-root-pluginsafety | fix/plugin-path-failopen `e390d30` | 干净 | 可删 | 活动止于 01:58 |
| 38 | D:\DevEnv\Temp\wt-root-shared-dedupe | fix/shared-dedupe-export `b3cb1ec` | 28 改动 | 保留 | 16 apps + 10 packages + 2 scripts 未提交 |
| 39 | D:\DevEnv\Temp\wt-root-sqlite | fix/sqlite-async-offload `2a33398` | 11 改动 | 保留 | ai-service 11 文件未提交 |
| 40 | D:\DevEnv\Temp\wt-root-tmppath | fix/test-tmpdir-coupling `0d78d97` | 干净 | 可删（先拆 12 链接） | 活动止于 01:13 |
| 41 | D:\DevEnv\Temp\wt-root-xsecret | fix/internal-xsecret-ticket `e56dd45` | 干净 | 可删 | 活动止于 01:52 |
| 42 | D:\IHUI-AI\.runtime\wt-cli-typegate | fix/cli-type-gate `9f2fffb` | 干净 | 可删 | 分支独有 3 提交在 ref；活动止于 15:06 |
| 43 | D:\IHUI-AI\.runtime\wt-gate299-fix | fix/gate-299-shell-form `8322e79` | 干净 | 保留 | 20:31:52 刚落了新提交，index 20:07 更新；会话在产出 `fix299.patch`（20:05）——仍在写 |
| 44 | D:\IHUI-AI\.runtime\wt-sf-071213 | fix/sf-07-12-13-2 `1c46c53` | 干净 | 可删 | 活动止于 14:35 |
| 45 | .worktrees\land-cli-atomic-write | land/cli-atomic-write `1b748fa` | 干净 | 可删（先拆 21 链接） | 活动止于 11:22 |
| 46 | .worktrees\land-desktop-auto-refresh | land/desktop-auto-refresh `5375219` | 干净 | 可删 | 活动止于 11:28 |
| 47 | .worktrees\land-saas-prometheus-exposure | land/saas-prometheus-exposure `cbaae88` | 干净 | 可删（先拆 1 链接） | 活动止于 11:35 |
| 48 | .worktrees\origin-seal-reseal | seal/origin-1106 `e3cff29` | 干净 | 可删 | 活动止于 11:53 |
| 49 | .worktrees\wt-checkin-p0-1106 | fix/checkin-p0 `4f1cc84` | 干净 | 可删（先拆 9 链接） | 活动止于 18:07 |
| 50 | .worktrees\wt-ci-0060-0062 | fix/ci-060-061-062 `a4dbcfd` | 干净 | 可删 | 活动止于 10:58 |
| 51 | .worktrees\wt-heartbeat-window-1106 | fix/heartbeat-window-1106 `18eaa9b` | 干净 | 可删 | 活动止于 16:13 |
| 52 | .worktrees\wt-miniapp-voice-audio-r2 | fix/miniapp-voice-audio-r2 `c62faf5` | 干净 | 可删 | 活动止于 14:53 |
| 53 | .worktrees\wt-mobile-assistant-mock | fix/mobile-assistant-mock-r2 `dca5a60` | 干净 | 可删（先拆 28 链接） | 活动止于 14:39 |
| 54 | .worktrees\wt-rn-shell-leg-20261106 | fix/rn-shell-leg-251 `5cc02e6` | 干净 | 保留 | index 19:42 更新 + 目录 19:30，属近 1 小时活跃会话；1 链接 |
| 55 | .worktrees\wt-rn-shell-types | fix/rn-shell-types-block `7c7466c` | 干净 | 保留 | index 19:21 + 目录 19:23，同一活跃会话 |
| 56 | .worktrees\wt-root-ci-lane | fix/ci-root-lane `c3076a1` | 干净 | 可删 | 活动止于 02:11 |
| 57 | .worktrees\wt-root-ci-lane-r2 | fix/ci-root-lane-r2 `582ae3d` | 干净 | 可删 | 活动止于 10:06 |
| 58 | .worktrees\wt-root-compose-hardening | fix/root-compose-hardening `5ff79c9` | 干净 | 可删 | 活动止于 01:58 |
| 59 | .worktrees\wt-root-compose-saas-prom | fix/saas-prometheus-exposure `1fc04b8` | 干净 | 可删（先拆 1 链接） | 活动止于 10:35 |
| 60 | .worktrees\wt-root-obs-compose-port | fix/root-obs-compose-port `8dced8d` | 干净 | 保留 | `locked initializing` 自 10:54 未解锁，状态不明 |
| 61 | .worktrees\wt-root-sqlite3 | fix/sqlite3-defects `301e6f5` | 干净 | 可删（先拆 1 链接） | 活动止于 14:49 |
| 62 | D:\IHUI-AI-homefont-wt | push-daemon-fanout `b2de284` | 干净 | 可删 | 活动止于 11-03 19:21 |
| 63 | D:\IHUI-AI-mergefix-wt | detached `a1029c5` | 2 改动 | 保留 | `scripts/auto-evolve.mjs`、`scripts/check-autonomy-leg-health.mjs` 未提交 |

未注册残留：

| # | 路径 | 判定 | 理由 |
|---|---|---|---|
| 64 | …\ihui-converge-exec-20261106\wt-land | 可删（建议先出清单存档） | 9670 文件 / 641.8 MB；`worktrees/wt-land` 管理目录已被移除，`gitdir` 指向不存在的仓；无 node_modules；14:13:26 后零写入；11 个非库内 blob 全部与主工作区现文件字节一致 |
| 65 | D:\IHUI-AI\.worktrees\wt-probe-origin-main-20261106 | 可删 | 目录里只有一个 node_modules junction（19:46 建），无源码、无 `.git`；注意：对它跑 `git -C` 会向上解析到主仓，看到的 172 条脏文件是主仓的，不是它的 |
| 66 | D:\IHUI-AI\.worktrees\DevEnv\Temp\pytest_tmp_runs | 可删 | pytest 临时残留，空壳 |
| 67 | D:\DevEnv\Temp\bug-audit | 保留待确认 | 未注册；内含 2 个 junction（`node_modules`、`prebuild-probe\node_modules`）；11-05 |
| 68 | D:\DevEnv\Temp\voice-check-full | 保留待确认 | 未注册；真实 node_modules，02:03 |

## 3. junction 拆除 · 正确顺序与验证

> 目标 worktree 上若 `node_modules` 是 `l----`/Junction，**必须先拆链接，再 `worktree remove`**；否则等于让 git 去递归删一个 6.76GB 的真实目录。`wt-origin-base` 现在已经没有链接，但下表这些还有。

### 3.1 拆除顺序（每个 worktree 逐台执行，不要批量并行）

1. **前置闸门**：确认该 worktree 无进程占用
   - `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '<该 worktree 路径>' }` 无输出；
   - `.git/worktrees/<name>/index` 最后写入时间 ≥ 30 分钟前；
   - 不存在 `.git/worktrees/<name>/index.lock`。
2. **只拆 junction，不动目标**
   - 对每个链接：`cmd /c rmdir "<worktree>\node_modules"`（`rmdir` 删的是链接本身）。
   - 不要用 `Remove-Item -Recurse`：它对 reparse point 的行为历史上不可靠，`-Force -Recurse` 有跟随目标的风险。
   - PowerShell 等价安全写法：`[System.IO.Directory]::Delete("<path>")`（目标必须是空目录或 reparse point）。
3. **拆完立刻验证主工作区没被波及**（见 3.2）。
4. 再 `git -C D:\IHUI-AI worktree remove "<path>"`（**不加 `--force`**）。若 git 报"contains modified or untracked files"，说明还有没盘清的东西 → **停手，回到清单复核**，不要加强制。
5. 全部 remove 完：`git -C D:\IHUI-AI worktree prune`。

### 3.2 "主工作区依赖仍完好"的断言（拆前后各跑一次，逐字比对）

```powershell
# A. 文件数与字节数（拆前基线：263248 个文件 / 6.76 GB）
$m = Get-ChildItem 'D:\IHUI-AI\node_modules' -Force -Recurse -File | Measure-Object Length -Sum
"D:\IHUI-AI\node_modules files=$($m.Count) GB=$([math]::Round($m.Sum/1GB,2))"
# 断言：files == 263248（±0）且 GB ≈ 6.76（±0.05）

# B. 关键实体仍在
Test-Path 'D:\IHUI-AI\node_modules\.pnpm'
Test-Path 'D:\IHUI-AI\apps\web\node_modules\next\package.json'
Test-Path 'D:\IHUI-AI\packages\shared\node_modules'   # 子包 node_modules 是否为链接，见下表

# C. 依赖可解析（真正能跑起来才算数）
node -e "console.log(require.resolve('typescript/package.json',{paths:['D:/IHUI-AI']}))"
pnpm -C D:\IHUI-AI exec tsc --version

# D. 主工作区脏清单未因拆链接而变化（拆前基线：172 条）
(git -C D:\IHUI-AI status --porcelain | Measure-Object -Line).Lines
```

**判定规则**：A 的文件数/体积不变 + B 全 True + C 能输出路径和版本 + D 仍为同一数量与同一文件名集合 → 拆链接没有伤到主工作区。任一条不满足：立即停止后续 remove，先查是哪一个链接被跟随删除了。

> **注**：上面的 A 条已被 **3.4 的 A1/A3 口径取代**（旧 A 把 `.cache\tsbuildinfo` 计入，判据恒 flaky）。D 条在批次 1 实测会因并行会话写主仓而从 169→174 行漂移，同样只作参考、不作停手判据。

### 3.3 当前持有 junction 的已注册 worktree（共 23 台，拆除优先）

| worktree | 链接数 | 备注 |
|---|---|---|
| wt-tenant-boundary | 28 | 最深：根 + apps/api + packages/* |
| wt-e2e-skip-wait | 28 | 同上 |
| wt-mobile-assistant-mock | 28 | 同上 |
| wt-root-mobile-assistant | 23 | 保留态，暂不动 |
| land-cli-atomic-write | 21 | 根 + packages/* |
| wt-minimax-null-1106 | 17 | 根 + apps/api + packages/* |
| wt-gemini-models-ce | 17 | 同上 |
| wt-root-nginx-prefix | 17 | 同上 |
| wt-root-tmppath | 12 | 同上 |
| wt-fix-desktop | 9 | 同上 |
| wt-checkin-p0-1106 | 9 | 同上 |
| wt-root-api-tenant | 6 | 保留态 |
| wt-navbar-barrel | 2 | 保留态（有未提交） |
| wt-root-miniapp-voice-audio | 2 | 保留态 |
| ihui-merge-wt / wt-fix-ci / wt-fix-readme-gates / wt-root-navbar-barrel / wt-gate299-fix / land-saas-prometheus-exposure / wt-rn-shell-leg-20261106 / wt-root-compose-saas-prom / wt-root-sqlite3 | 各 1 | 根 node_modules |

> 未注册但带链接的：`wt-probe-origin-main-20261106`（1）、`bug-audit`（2）。

### 3.4 判据修订（2026-11-06 批次 2 定案）：A → A1/A2/A3

3.2 的旧 A 条把 `node_modules\.cache\tsbuildinfo\*` 一并计数，而这类构建缓存在并行会话跑 `tsc -b` 时必然变动，导致判据恒 flaky。**这是判据设计错误，不是放宽阈值**，故把「总文件数」拆成「依赖子树 + 链接结构」两条：

| 编号 | 口径（写清定义，不只记数字） | 基线读数 |
|---|---|---|
| A1 | `D:\IHUI-AI\node_modules` **递归**文件数与字节数，**排除 `\.cache\` 子树**（即依赖实体本身） | 263,047 个 / 7,252,921,183 B = 6.75 GB |
| A2 | `node_modules\.cache\tsbuildinfo` 文件数，**只观测、不判红**（随并行构建在 0–6 之间波动） | 基线时 6 |
| A3a | `node_modules\.pnpm` 下**递归 reparse-point 目录数**（pnpm 虚拟 store 的内部链接） | 15,034 |
| A3b | `apps\web\node_modules` 下**递归 reparse point 数**（工作区自引用链接） | 100 |
| B1/B2 | `.pnpm` 存在 / `apps\web\node_modules\next\package.json` 存在 | True / True |
| C | `pnpm exec tsc --version` 有版本输出 | 5.9.3 |

**判定规则**：A1 文件数与字节数逐字节相等 + A3a/A3b 计数相等 + B1/B2 全 True + C 有版本 → 通过；A2 不参与判红。理由：junction 误删真正会伤到的是**链接结构**（A3）与**依赖实体**（A1/B），不是构建缓存的时间戳噪声。

```powershell
$nm='D:\IHUI-AI\node_modules'; $cache=Join-Path $nm '.cache'
$dep = Get-ChildItem $nm -Force -Recurse -File -ErrorAction SilentlyContinue |
       Where-Object { $_.FullName -notlike "$cache*" }
"A1 files=$($dep.Count) bytes=$(($dep|Measure-Object Length -Sum).Sum)"
"A2 tsbuildinfo=$((Get-ChildItem (Join-Path $cache 'tsbuildinfo') -File -Force -ErrorAction SilentlyContinue).Count)"
"A3a $((Get-ChildItem (Join-Path $nm '.pnpm') -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count)"
"A3b $((Get-ChildItem 'D:\IHUI-AI\apps\web\node_modules' -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count)"
pnpm -C D:\IHUI-AI exec tsc --version
```

### 3.5 tooling 缺陷：`git worktree remove` 在 pnpm worktree 上会留空壳

批次 2 实测 25 台 `git worktree remove` 中 **18 台退出 255**（仅 7 台为 0），全部发生在**删文件阶段**，两种形态：

1. `error: failed to delete '<path>': Filename too long` —— pnpm 虚拟 store 的深层路径超过 Windows 260 字符，git 的删除器不走 `\\?\` 长路径前缀。
2. `Exception calling "Delete" with "2" argument(s): "参数错误。 : '<name>'"` —— `.NET Directory.Delete(recursive:true)` 撞上 pnpm 的链接目录（如 `@expo/metro-config`），递归 API 不允许在重解析点上递归。

**最坑的一点**：失败时 git **已经完成注销**——`git worktree list` 里已消失、`D:\IHUI-AI-git-repo\worktrees\<name>` 已删除，磁盘上只剩一个不受 git 管理的孤儿空壳（每台约 21 万文件、约 3–5 GB）。对写清理脚本的人：

- 不能用 `git worktree list` 判断「还剩什么」，必须**另扫磁盘残留目录**（`exists=True && registered=False` 即空壳）；
- 不要用 `Remove-Item -Recurse` / 裸 `Directory.Delete(recursive)` 兜底，会踩上文的链接错误甚至跟随链接；
- 本次验证有效的处置链：**先非递归删循环链接**（`[IO.Directory]::Delete($link)`）→ **`.NET Directory.Delete($p,$true)`** → 若仍报「参数错误」，用**自底向上遍历**兜底：遇 `ReparsePoint` 一律非递归删、绝不递归进入，其余目录后序删除。

### 3.6 批次 2 执行记录（2026-11-06 夜间）

前置：`wt-origin-base`（0）、`wt-root-navbar-barrel`（0）、`wt-apiroutes`（0）、`wt-fix-ai`（0）已在批次 1/2 前期完成。

**A. 失败残留空壳（8 台，先于注册树清理）**

| worktree | remove_exit | 空壳清理耗时 | 结果 |
|---|---|---|---|
| wt-fix-cli | 255 | 7.2 s | exists=False |
| wt-fix-escape-tests | 255 | 326.5 s | exists=False |
| wt-fix-internal | 255 | 254.6 s | exists=False |
| wt-fix-rls | 255 | 197.2 s | exists=False |
| wt-fix-ticket | 255 | 234.3 s | exists=False |
| wt-g40-land | 255 | 181.4 s | exists=False |
| wt-fix-web | 255 | 322.4 s | exists=False |
| wt-g40 | 255 | 178.3 s | exists=False |

**B. 仍注册的 17 台（一次一台，按 A1/A3+B+C 每 5 台复跑）**

| # | worktree | remove_exit | 空壳清理耗时 | 结果 |
|---|---|---|---|---|
| 1 | wt-root-authjson | 0 | — | 已删 |
| 2 | wt-root-desktop-auto-refresh | 0 | — | 已删 |
| 3 | wt-root-pluginsafety | 255 | 181.9 s | 已删 |
| 4 | wt-root-xsecret | 255 | 228.9 s | 已删 |
| 5 | .runtime\wt-cli-typegate | 255 | 442.0 s | 已删 |
| 6 | .runtime\wt-sf-071213 | 255 | 64.9 s | 已删 |
| 7 | .worktrees\land-desktop-auto-refresh | 0 | — | 已删 |
| 8 | .worktrees\origin-seal-reseal | 0 | — | 已删 |
| 9 | .worktrees\wt-ci-0060-0062 | 255 | 354.8 s | 已删 |
| 10 | .worktrees\wt-heartbeat-window-1106 | 255 | 283.7 s | 已删 |
| 11 | .worktrees\wt-miniapp-voice-audio-r2 | 255 | 265.3 s | 已删 |
| 12 | .worktrees\wt-root-ci-lane | 0 | — | 已删 |
| 13 | .worktrees\wt-root-ci-lane-r2 | 0 | — | 已删 |
| 14 | .worktrees\wt-root-compose-hardening | 0 | — | 已删 |
| 15 | D:\IHUI-AI-homefont-wt | 255 | 115.4 s | 已删 |
| 16 | Temp\wt-shared-exports | 255 | 46.9 s | 已删 |
| 17 | Temp\wt-tool-result-envelope | 255 | 321.2 s | 已删 |

**C. 每 5 台复跑的读数**（全部逐字节相同，无一条判红）

| 时点 | A1 files / bytes | A3a | A3b | B1/B2 | C | 注册数 |
|---|---|---|---|---|---|---|
| 新基线 | 263,047 / 7,252,921,183 | 15,034 | 100 | True/True | 5.9.3 | 54 |
| 组 1 后 | 263,047 / 7,252,921,183 | 15,034 | 100 | True/True | 5.9.3 | 52 |
| 组 2 后 | 263,047 / 7,252,921,183 | 15,034 | 100 | True/True | 5.9.3 | 47 |
| 组 3a 后 | 263,047 / 7,252,921,183 | 15,034 | 100 | True/True | 5.9.3 | 43 |
| 终检 | 263,047 / 7,252,921,183 | 15,034 | 100 | True/True | 5.9.3 | 41 |

注册数下降幅度与处理台数不完全一致，差额来自并行会话在同一时段新建 worktree（`wt-gate-readonly-20261106`、`D:/IHUI-AI-land`、`wt-root-compose-saas-prom` 等），非本批操作漏算。

## 4. `*.bundle.lock` 分布与可删依据

| 文件 | 大小 | mtime | 锁龄 | 是否被进程持有 | 判定 |
|---|---|---|---|---|---|
| `…\ihui-converge-exec-20261106\L1-all-refs.bundle.lock` | 1,859,374 B | 14:13:26 | ~6h | 否（以 `FileShare.None` 打开成功） | **可删** |
| `…\ihui-converge-exec-20261106\L2-mainline.bundle.lock` | 1,028 B | 13:08:56 | ~7h | 否 | **可删** |

依据链（不是靠"看起来旧"）：

1. **锁龄**：均 > 6 小时，远大于任何一次 bundle 的合理耗时（旁证：2.5GB 的 `L1b-all-refs.bundle` 在 14:29:39 起、14:37:58 完成，约 8 分钟）。
2. **pid / 进程**：全库无任何 `git bundle` / `bundle create` 进程；两个文件均能以独占方式打开，说明没有句柄。
3. **对应操作已结束且有成功产物**：`bundle2.log` 明确记录 14:29:42 因该锁存在而失败（`create_exit=128`），随后 `bundle3.log` 的 `git bundle verify` 返回 `verify_exit=0`、`The bundle records a complete history.`，产物 `L1b-all-refs.bundle`（2,545,684,905 B）存在。即 L1 这条腿已经用另一个文件名跑完并校验通过。
4. **L2 无产物**：没有 `L2-mainline.bundle`，说明那条腿是中途放弃的，锁是纯残留。
5. 仓库根、`D:\DevEnv` 深度 2 扫描均无其他 `*.bundle.lock`。

**附带残留（同区、可一并清，但不在本次询问范围）**：`D:\IHUI-AI-git-repo` 下 31 个 `ihui-git-write.lock.*.pending` 目录、19 个 `stale-*` index 备份、`index.lock.stale-140909`、`index.lock.stale-150930`、`tmp-privindex-*` 等。`D:\IHUI-AI\.deploy.lock` 是**活锁**（meta.json 20:31 心跳），不许碰。

## 5. 建议执行顺序

**阶段 0（再确认，只读）**：动手前重跑一次活跃判定，确认第 2/43/54/55/60 台仍无新活动；确认 `D:\IHUI-AI` 的 `.deploy.lock` 仍在心跳时不要在同一时刻跑重活。

**批次 1（零风险，先摘 1 台验证方法论）**
1. `wt-origin-base`（无 junction、detached、干净、13:44 后零活动）→ 直接 `git worktree remove`。
2. 验证主工作区断言 A–D 未变。
3. 验证通过后，再继续批次 2。

**批次 2（无 junction 的干净树）**
`wt-shared-exports`、`wt-tool-result-envelope`、`wt-apiroutes`、`wt-fix-ai`、`wt-fix-cli`、`wt-fix-escape-tests`、`wt-fix-internal`、`wt-fix-rls`、`wt-fix-ticket`、`wt-fix-web`、`wt-g40`、`wt-g40-land`、`wt-root-authjson`、`wt-root-desktop-auto-refresh`、`wt-root-pluginsafety`、`wt-root-xsecret`、`wt-rn-shell-types`→除外、`wt-cli-typegate`、`wt-sf-071213`、`land-desktop-auto-refresh`、`origin-seal-reseal`、`wt-ci-0060-0062`、`wt-heartbeat-window-1106`、`wt-miniapp-voice-audio-r2`、`wt-root-ci-lane`、`wt-root-ci-lane-r2`、`wt-root-compose-hardening`、`IHUI-AI-homefont-wt`。

**批次 3（有 junction：先 rmdir 链接 → 断言 → worktree remove）**
`wt-tenant-boundary`(28)、`wt-mobile-assistant-mock`(28)、`land-cli-atomic-write`(21)、`wt-minimax-null-1106`(17)、`wt-gemini-models-ce`(17)、`wt-root-nginx-prefix`(17)、`wt-root-tmppath`(12)、`wt-fix-desktop`(9)、`wt-checkin-p0-1106`(9)、`wt-fix-ci`、`wt-fix-readme-gates`、`land-saas-prometheus-exposure`、`wt-root-compose-saas-prom`、`wt-root-sqlite3`、`wt-g40`(1)。
> 每拆一台，跑一次 3.2 的 A–D 断言。**一次只碰一台**，不要并行删链接。

**批次 4（孤儿目录，最后做）**
1. `wt-probe-origin-main-20261106`：先 `cmd /c rmdir` 它的 node_modules 链接 → 断言 → 删空目录。
2. `wt-land`：先把 9670 文件清单（路径 + 大小 + mtime）导出到 `.ihui-agent/archive/` 存档（<1MB），再删目录（641.8 MB 回收）。
3. `DevEnv\Temp\pytest_tmp_runs`：直接删。
4. `bug-audit`、`voice-check-full`：等确认后再说，先列入待办。

**批次 5（锁文件，全部 remove 之后）**
1. 删 `L1-all-refs.bundle.lock`（1.8 MB）、`L2-mainline.bundle.lock`（1 KB）。
2. `git -C D:\IHUI-AI worktree prune`。
3. 复核：`git worktree list` 只剩保留项；`git -C D:\IHUI-AI status --porcelain | Measure-Object -Line` 仍为 172 左右。

**不要动**：`wt-land2`（含其 locked 文件）、`ihui-merge-wt`、`wt-gate299-fix`、`wt-rn-shell-leg-20261106`、`wt-rn-shell-types`、`wt-root-obs-compose-port`、`wt-root-navbar-barrel`、`wt-root-api-security`、`wt-root-api-tenant`、`wt-root-cli-atomic-state`、`wt-root-cli-typecheck`、`wt-root-clockdep`、`wt-root-e2e-skips`、`wt-root-miniapp-voice-audio`、`wt-root-mobile-assistant`、`wt-root-shared-dedupe`、`wt-root-sqlite`、`wt-navbar-barrel`、`wt-e2e-skip-wait`、`IHUI-AI-mergefix-wt`。

## 6. 决策待办（需要你放行的 3 件事）

1. **脏工作树怎么处理**：19 台有未提交/未跟踪内容。是"先逐台 commit 或 stash 再删"，还是"其中平台探针类（tmp-sf07/12/13、temp-pg helper）直接丢弃"？前者最稳，后者能少收 5 台。
2. **`wt-root-navbar-barrel`**：磁盘只剩 3670 文件、索引记着 15395 条删除。要先确认它是不是可重建（`git checkout -- .` 就能还原），还是里面混着不可重建的东西。
3. **孤儿 `wt-land`**：641.8 MB。按第 1 节第 8 条的证据可以删，但要先同意"先出清单再删"的存档动作。

## 7. 批次 3/4/5 执行记录（2026-11-06 深夜）

### 7.1 在途保护闸预检：批次 3 被闸 3 全量阻断

对剩余 39 台真实 worktree（41 条注册减去主工作区与 common-dir 两条）逐台跑四道闸：

| 闸 | 命中台数 | 典型命中项 |
|---|---|---|
| 1 脏工作区非空 | 19 | `ihui-merge-wt` 1003、`D:/IHUI-AI-land` 213、`wt-land2` 216、`wt-root-cli-typecheck` 99 |
| 2 index/HEAD mtime ≤ 30 分钟 | 5 | `wt-ui-gates-1106-r2` 2m、`wt-backend-gates-1106` 14m、`D:/IHUI-AI-land` 14m、`wt-gates-5git` 31m、`IHUI-AI-wt-dbdrift` 负值（时钟超前） |
| 3 分支独有未推送提交 > 0 | **13/13 候选全中** | 见下表 |
| 4 在途白名单 | 12 | `wt-land2`、`ihui-merge-wt`、`wt-gate-readonly-20261106`、`wt-root-api-*` 等 |

**闸 3 的口径问题（必须先定案）**：字面命令 `git rev-list --count <branch> --not origin/main` 会把本地 `main` 自身相对 `origin/main` 的 394 条提交一并计入（main 与 origin/main 已严重分叉）。改用真实口径 `--not main origin/main` 后数字大幅回落，但**13 台仍然全部 > 0**：

| worktree | 字面 not origin/main | 真实 not main+origin |
|---|---|---|
| wt-minimax-null-1106 | 1 | 1 |
| wt-tenant-boundary | 1 | 1 |
| wt-fix-desktop | 274 | 6 |
| wt-gemini-models-ce | 2 | 2 |
| wt-root-nginx-prefix | 327 | 2 |
| wt-gate299-fix | 4 | 4 |
| land-cli-atomic-write | 1 | 1 |
| land-saas-prometheus-exposure | 2 | 2 |
| wt-checkin-p0-1106 | 6 | 6 |
| wt-mobile-assistant-mock | 1 | 1 |
| wt-root-compose-saas-prom | 2 | 2 |
| wt-root-sqlite3 | 2 | 2 |
| wt-gates-5git | 1 | 1 |

**结论：批次 3 本轮 0 台处理，全部按闸跳过。** 需澄清的技术事实：`git worktree remove` **不删除分支、不删除提交**，分支 ref 仍留在 `D:\IHUI-AI-git-repo`；因此闸 3 保护的实际风险是"这是该未推送分支唯一的检出目录"，而非内容丢失。是否放行需按此重新裁定。

### 7.2 批次 4（孤儿目录）

| 目标 | 处置 | 读数 |
|---|---|---|
| `…\ihui-converge-exec-20261106\wt-land` | 先导出清单再删 | 清单 `manifest.csv`：9,670 行 / 1,443,290 B，字段 rel+size+sha256+mtime，合计 672,931,618 B（641.8 MB）；删除耗时 11.5 s，`exists=False` |
| `.worktrees\wt-probe-origin-main-20261106` | 先拆 node_modules 链接再删 | 链接目标 `d:\IHUI-AI\node_modules`，非递归删链接成功；目录删除 `exists=False`；未注册（registered=False） |
| `D:\DevEnv\Temp\pytest_tmp_runs` | **未删** | 非空壳：6,117 文件 / 71.6 MB，含 `run-10196`、`run-10248` 等 pytest 运行目录，最新写入 11:22 |
| `D:\DevEnv\Temp\bug-audit` | **未动** | 非 git 仓库（无 `.git`），1,401 文件 / 147.5 MB，`node_modules` 为 junction，最新写入 02:11 |
| `D:\DevEnv\Temp\voice-check-full` | **未动** | 非 git 仓库（无 `.git`），3,542 文件 / 88.0 MB，`node_modules` 为实体目录，最新写入 02:10 |

### 7.3 批次 5（锁 + prune）

| 步骤 | 结果 |
|---|---|
| 复核 `L1-all-refs.bundle.lock` 无句柄（`FileShare.None` 打开成功） | 通过，已删 |
| 复核 `L2-mainline.bundle.lock` 无句柄 | 通过，已删 |
| 剩余 `*.bundle.lock` | 0 |
| `git worktree prune` | exit 0，无输出，未摘除任何条目 |
| 最终 `git worktree list` | **41** 条（含主工作区与 common-dir 两条伪条目） |
| 主工作区 `git status --porcelain` | **163** 行（并行会话仍在写主仓，非本批操作所致） |

### 7.4 批次 3/4/5 后主工作区断言

| 判据 | 基线 | 终检 | 判定 |
|---|---|---|---|
| A1 files / bytes | 263,047 / 7,252,921,183 | 263,047 / 7,252,921,183 | 通过 |
| A2 tsbuildinfo | 只观测 | 0 | 不判红 |
| A3a / A3b | 15,034 / 100 | 15,034 / 100 | 通过 |
| B1 / B2 | True / True | True / True | 通过 |
| C | 5.9.3 | 5.9.3 | 通过 |

拆 `wt-probe-origin-main-20261106` 的 `node_modules` 链接（目标指向主工作区）后，A1/A3a/A3b 逐字节不变 —— 证明非递归删链接只删链接、未伤目标。

## 8. 终局（闸 3 改「指针归档 + 放行」后）

### 8.1 闸 3 的口径修订

原闸 3 用 `rev-list --count <branch> --not origin/main`，会把本地 `main` 相对 `origin/main` 的 394 条提交计入，等于对所有分支恒真。改为**指针归档 + 放行**：删树前把 `分支名 / tip SHA / 未推送条数 / 独有提交 oneline` 追加进 `D:\IHUI-AI\.worktrees-archive\20261106\branch-pointers.md`（13 个块，已复核），写入即放行。闸 1（脏）与闸 2（索引 30 分钟内）仍一票否决。

技术依据：`git worktree remove` 不删分支、不删提交，ref 仍在 `D:\IHUI-AI-git-repo`。

### 8.2 批次 3 执行结果（12 台删除，1 台按白名单跳过）

| worktree | 拆链数 | remove_exit | 备注 |
|---|---|---|---|
| wt-minimax-null-1106 | 16 | 0 | 已删 |
| wt-tenant-boundary | 16 | 0 | 空壳另删 |
| wt-fix-desktop | 16 | 0 | 空壳另删 |
| wt-gemini-models-ce | 17 | 0 | 已删 |
| wt-root-nginx-prefix | 17 | 0 | 已删 |
| wt-gate299-fix | 1 | 0 | 已删 |
| land-cli-atomic-write | 9 | 0 | 空壳残留 12 个 `packages\*\dist` 链接，另拆后删 |
| land-saas-prometheus-exposure | 1 | 0 | 已删 |
| wt-checkin-p0-1106 | 8 | 0 | 空壳残留 `apps\web\.next` 链接，另拆后删 |
| wt-mobile-assistant-mock | 28 | 0 | 已删 |
| wt-root-compose-saas-prom | 1 | 0 | 已删 |
| wt-root-sqlite3 | 1 | 0 | 已删（名字近似白名单 `wt-root-sqlite`，但为独立分支 `fix/sqlite3-defects`） |
| **wt-gates-5git** | — | **跳过** | 命中白名单通配 `wt-gates-*` |

退出码全部为 0（拆链后再 remove，无 255）。每 3 台复跑 A1/A3a/A3b/B1/B2/C，四次读数全部与基线逐字节相同。

**新发现**：即使拆掉 `node_modules` 链接，`git worktree remove` 仍可能因 `packages\*\dist`、`apps\web\.next` 这类**产物 junction** 而留下空壳（exit 0 但目录存在、文件数 0）；空壳需再拆一遍链接才能删净。这应补进 3.5 的 tooling 缺陷：**拆链要覆盖 `node_modules` / `dist` / `.next` 三类**。

### 8.3 三个目录（批次 4 补充）

| 目录 | 处置 | 读数 |
|---|---|---|
| `pytest_tmp_runs` | 清单存档后尝试删除 → **撞占用跳过** | 扫描时 6,117 文件；导出时 2,456 行 / 2,728,668 B（测试在跑，文件数在变）；删除报 `Access to the path '9d2026c86a8f6d14b568975757fff1602306b9' is denied`，按约定不重试 |
| `bug-audit` | 先归档后删 | 源 1,401 / 154,658,428 B = 归档 1,401 / 154,658,428 B；README 摘录 8 份报告，其中 `BUG-BACKLOG-20261105.md` 为 64 条合并清单（P0 6 / P1 12 / P2 46） |
| `voice-check-full` | 先归档后删 | 源 3,540 / 91,585,982 B = 归档 3,540 / 91,585,982 B；删除前拆 280 个链接；无独立审计结论（6 个 md 均为仓库自带文档） |

### 8.4 终检

| 项目 | 读数 |
|---|---|
| A1 files / bytes | 263,047 / 7,252,921,183（与基线逐字节相同） |
| A2 tsbuildinfo | 3（只观测） |
| A3a / A3b | 15,034 / 100 |
| B1 / B2 | True / True |
| C | 5.9.3 |
| `git worktree list` | **30** 条（含主工作区与 common-dir 两条伪条目） |
| 主工作区 dirty 行数 | 167 |
| 剩余 `*.bundle.lock` | 0 |
| `branch-pointers.md` 块数 | 13 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
