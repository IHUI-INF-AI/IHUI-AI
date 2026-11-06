<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 主树常驻自动化权属取证（2026-11-06 · 只读）

状态：只读取证，未改主树工作区、未删未跟踪文件、未动 `refs/hold`、未 pause 任何进程、未推 `main`。

## 0. 时间基线与主树读数

| 项 | 值 |
|---|---|
| 取证时刻 | 2026-11-06 10:16–10:35 (+08:00) |
| 主树 HEAD | `30d77e001a`（`main`） |
| `origin/main` | `1388255cb8`（2026-11-06 10:02:52 推送） |
| `git rev-list --count origin/main..main` | **0** |
| `git rev-list --count main..origin/main` | **83** |
| `git diff --stat main origin/main` | 173 files changed, 13443 insertions(+), 8159 deletions(−) |
| `git status --porcelain` | ` M` 73 / `M ` 11 / `??` 115 = 199 |

结论先行：**本地 `main` 严格落后 `origin/main` 83 枚，且没有任何独有提交**（0 ahead / 83 behind）。

## 1. 器物与调用链

### 1.1 谁在调 `auto-commit-quiet.mjs`

- `scripts/git-guardian.mjs:12268` —— `sweepCrossEndLandingLeg` 通过 `const script = join(..., 'auto-commit-quiet.mjs')` 派生本器（`runLegChild(script, [], timeoutMs)`，超时默认 20 分钟，`scripts/git-guardian.mjs:12274`）。
- 节流：`CROSS_END_LANDING_INTERVAL_MS` 默认 **15 分钟**（`scripts/git-guardian.mjs:12253-12255`）。
- 同文件另有 worktree-heal 5 分钟、ops-patrol 15 分钟、service-heal 30 分钟等腿（`WORKTREE_HEAL_INTERVAL_MS` ≈ 5 分钟，`scripts/git-guardian.mjs:3986-3987`），这就是主树文件 mtime 每隔几分钟就变的来源之一。

### 1.2 声明集：它到底会 `git add -A -- <…>` 哪些路径

白名单是**逐条列出的具体形态**，不在名单里的（含无法判定的）一律不收（fail-safe）：

`scripts/auto-commit-quiet.mjs:120-144`

```
^README(?:[.-][A-Za-z]{2,})?\.md$
^\.doc-autoupdate\/
\.generated\.ts$
\.b64\.txt$
^scripts\/data\/root-guard-manifest\.json$
^apps\/[^/]+\/src\/i18n\/generated\/
^packages\/design-tokens\/src\/styles\/tokens\.css$
^apps\/miniapp-taro\/types\/rn-shells\.generated\.d\.ts$
```

排除表另有一层（`.env`、`node_modules/`、`.next/`、`.ihui-agent/tmp/`、`.ihui-agent/state/hook-logs/`、`*.log`、二进制）见 `scripts/auto-commit-quiet.mjs:91-103`。

第二条通道是「账本族」：只收 `.ihui-agent/state/cross-end-landing.jsonl` 里登记过、且工作树 blob 逐字节等于登记 `blobOid` 的落点（判据在 `scripts/lib/cross-end-landing-ledger.mjs` 的 `collectiblePaths`），见 `scripts/auto-commit-quiet.mjs:21-33`。

**明确不被收编**：`apps/**`、`packages/**` 下的业务代码与测试、`AGENTS.md` / `PROJECT_PLAN.md` 等规则文件（头注 `scripts/auto-commit-quiet.mjs:17-19`）。

### 1.3 触发条件与静默期

- `QUIET_MIN = 3`（分钟，`scripts/auto-commit-quiet.mjs:74`）—— 所有改动文件的 mtime 都早于 3 分钟才动手；还在写的一律放过。
- 必须同时满足：`git status` 有改动 ∧ 全部超静默期 ∧ 无未解决冲突 ∧ 无 `.git/index.lock` ∧ 无进行中的守门批 ∧ 命中白名单或账本族（`scripts/auto-commit-quiet.mjs:13-19`、`guardBusy()` 在 `:528-540`）。
- 单轮 pathspec 上限 `MAX_PATHS = 100`（`:89`），余量下一轮接着收。
- 落地前还有「内容级残渣闸」`dropStaleCopies`：工作树副本逐字节等于某个祖先 blob / 部分回退 / 删除档死件回潮 ⇒ 不收编、逐条点名（`:28-31`、`:480-496`）。

### 1.4 commit message 格式

`scripts/auto-commit-quiet.mjs:507-512`

```
chore(i18n): 收编停留≥${quietMin}分钟的 i18n 未提交改动
chore: 收编停留≥${quietMin}分钟的未提交改动
```

账本族另起 `chore(cross-end): …` 批次（`:27`）。当前实现下 `quietMin` 取 3。

### 1.5 是否 push、目标分支

- 收编器**不自带 push**：`scripts/auto-commit-quiet.mjs:36`、`:1163`（“推送仍交 post-commit 的 git-push-guard”）。
- `.husky/post-commit` 是 sh 薄壳，默认**后台**派发 `scripts/lib/post-commit-hook.js`（`HUSKY_POST_COMMIT_SYNC=1` 才同步）。
- `scripts/lib/post-commit-hook.js:174` —— `runLogged('post-commit-push-guard', 'node scripts/git-push-guard.mjs')`；失败只打印“commit 仅落地本地（未推送到 origin）”，不阻断。
- `scripts/git-push-guard.mjs:220` —— `const targetBranch = getArg('branch') || 'main'`；`:1025` —— `['push', 'origin', branch]`。

即：**自动收编 → safe-commit 提交 → post-commit → `git push origin main`**。

### 1.6 失败时行为

“落地一律走 safe-commit（全门冻结索引），失败只记日志不重试轰炸；调度器下一轮自然重来”（`scripts/auto-commit-quiet.mjs:35`）。守护侧对子进程结论取不到时记 `undetermined`，不折成“无待收编”（`scripts/git-guardian.mjs:12283-12291`）。push 失败也不改写提交，只留本地（`scripts/lib/post-commit-hook.js:176-177`）。

## 2. 它已经产生的提交

`git log --grep="收编停留"` 计数：

| 面 | 枚数 |
|---|---|
| 全 refs（`--all`） | 359 |
| 本地 `main` | 331 |
| `origin/main` | 331 |

最近几枚（本地 `main`）：

```
c76c57d280 chore: 收编停留≥3分钟的未提交改动
517053b744 chore: 收编停留≥3分钟的未提交改动
9e42b71828 chore: 收编停留≥3分钟的未提交改动
5461541087 chore: 收编停留≥3分钟的未提交改动
4f1a504e7a chore: 收编停留≥3分钟的未提交改动
```

331 枚同时存在于 `origin/main` ⇒ **这套机制历史上确实把提交推进过主干并被推送成功**（当时本地 `main` 与远端同步）。当前 `main` 落后 83 枚，通路已经断掉。

## 3. 三问结论

### a. 会不会把主树旧内容提交进本地 main？会不会 push？

- **会提交**，但只限第 1.2 节白名单 + 账本族路径；业务代码、测试、规则文件不会（fail-safe 判据 + 内容级残渣闸 + 活文档归并）。
- **会 push**：`post-commit → git-push-guard → git push origin main`。
- 但**当前一定推不上去**：本地 `main` 是 `origin/main` 的祖先（0 ahead / 83 behind），`git push origin main` 会被非快进拒绝。后果是提交只堆在本地、远端不动，且这些提交基于 83 枚前的旧基线。

### b. 主树本地 main 落后多少？有人 `git push main` 会怎样？

- 落后 **83 枚**，`git diff --stat` 173 files / +13443 / −8159。
- `git push origin main`：远端含本地没有的 83 枚 ⇒ **非快进，直接拒绝**（不会覆盖远端，但也不会成功）。
- 真实风险不是“推上去覆盖”，而是**本地继续堆积旧基线提交**：`main` 与 `origin/main` 持续分叉，将来要么 `union-converge` 合面，要么人工重放；若有人误判“已推送”，会把 83 枚的差距读成 0。

### c. 该保留、调参、还是停用？

**建议：保留，但加一道前置让路（调参），不建议停用。**

证据支撑：

1. 白名单 + 账本族 + 残渣闸 + 活文档归并四层护栏，已把“无差别收编半成品”那一型堵住（`scripts/auto-commit-quiet.mjs:110-119` 立因段写明 2026-11-02 的 7 件实质回退事故）。
2. 331 枚历史提交在 `origin/main` 上，说明机制本身在生产上跑通过。
3. 当前危害来自**基线陈旧**，不是收编判据：工作树 README 副本仍写着旧数（门 173 staged 面现读 `dbTables 622→621`、`testFiles 4098→4189`），一旦收编就会把旧数字写回主干，再次触发门 173 红。
4. 因此最小改法是给 `sweepCrossEndLandingLeg` 加前置条件：**当 `HEAD` 不是 `origin/main` 的后代（即落后）时整轮让路**，或强制收编只在已收敛到 `origin/main` 的专用 worktree 上跑；而不是关闭收编器（关闭会让所有派生产物永久悬挂，这正是 `scripts/auto-commit-quiet.mjs:6-11` 要解决的问题）。

本记录只给建议，未改任何脚本。

## 4. 本次只读审计的边界

- 未改主树任何工作区文件；未删未跟踪文件；未动 `refs/hold/mainB-2026-11-06` 与 `refs/heads/wip/main-tree-unique-2026-11-06`；未 pause/pkill 常驻进程；未推 `main`。
- 13 条 C1 归位按裁决保持现状，一条未执行。

## 5. 同批门读数（未归位状态下）

| 门 | 结果 |
|---|---|
| 299（`check-miniapp-shell-form.mjs`） | exit 0；pages 329 / declared 296 / shell 229 / copy 67 / pureCopy 56 / localDelta 11 / ledgerRows 90 / ratio 0.6098 / reds 0 / adv 30 / undet 0（仍是脏面，未回到 HEAD 面 47/38+9/246/56） |
| 173 head 面 | exit 0，一致（22 个数字 / 76625 处 / 守门 336） |
| 173 staged 面 | exit 1，28 条红（24 条 README/README.en 散文 + 4 条生成块：dbTables 622→621、dbSchemaFiles 241→240、testFiles 4198→4189、trackedFiles 19601→19420） |
| 30c（`check-stale-revert.mjs`） | exit 0；判定 84 个文件；5 处工作树副本等于历史版本只报数：`capability_matrix.py == f6ee6dc6c`、`activation-events.ts == 97d676acd`、`contribution-audit.ts == 97d676acd`、`manifest-scan.ts == cb9cb5572`、`trash-prune.ts == b709aa4ad`；elapsed 231786 ms / git_log 111 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
