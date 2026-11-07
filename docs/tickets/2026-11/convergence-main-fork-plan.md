<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: C:\Users\Administrator\Documents\Trae-CN\temp_20261106_13\main-fork-convergence-plan.md
> 生成时间: 2026-11-06 11:40:21
> 所属工作线: 收敛线（本地 main 分叉方案）

# 本地 main 与 origin/main 严重分叉 · 收敛方案（可执行、本阶段不执行）

> 状态：**只做方案**。本阶段未做任何合并、未 push、未改本地 main、未删除任何分支/worktree。
> 所有测量均在本机实跑，命令与读数见下；读数带时间戳，因为**仓库在测量期间仍在被其他会话推进**（见 §1.3）。

---

## 0. 结论先行

| 项 | 结论 |
|---|---|
| 真实分叉（对 origin/main@`1388255cb8`） | 我方独有 **375** 提交，对方独有 **940** 提交，共同祖先 `29cb27dc5f`（2026-11-04 17:26） |
| 双方同改文件 | **125** 个；其中 **60** 个合并即冲突（含 2 个 modify/delete、1 个 add/add） |
| 推荐路线 | **B（以 origin/main 为基、逐组重新落点）**，不是 A |
| 唯一硬停 | grafana 门族「删除 vs 续修」语义互斥（§5 · X1） |
| 次级裁决点 | 心跳键双修、attention 镜像双修（同题双实现，须验覆盖关系，§5 · X3/X4） |
| 执行前必须 | 静默窗口 + bundle 备份验证通过 + 上述裁决 + 记录双侧门禁基线 |

推荐 B 的核心理由（一句话）：这套仓库的部署唯一入口只认 `origin/main`，而本地 main 的 375 个提交里有 **108 个是 docs/chore 台账类**、且与 origin 的 940 个提交存在大量「同题双实现」；把整条本地 main 合进/推到 origin 等于把两套并行修法一起出版，回滚单位是「整条链」，而 B 的回滚单位是「单个 group」。

---

## 1. 测量快照（口径先钉死）

### 1.1 端点

```
origin/main  1388255cb8  (git ls-remote refs/heads/main 实测一致，非本地缓存漂移)
main         0a317f4559  → 9a8361e992 → 9f42c71f18  （测量期间被其他会话推进，见 1.3）
merge-base   29cb27dc5f  2026-11-04 17:26:34 +0800
```

### 1.2 计数

| 命令 | 读数 |
|---|---|
| `git rev-list --count origin/main..main` | 369 → 374 → **375**（随 HEAD 漂移） |
| `git rev-list --count main..origin/main` | **940** |
| `git cherry -v origin/main main` | 2 条等价（patch-id 已在对面）、360 条真独有、7 个 merge 被跳过 |
| `git cherry -v main origin/main` | 2 条等价、752 条真独有（其余为 merge） |

> **为什么 `git cherry` 的 360 与 `rev-list` 的 369 不相等**：`cherry` 跳过 merge 提交，且 2 条被判等价。两者不是矛盾，是口径差。

### 1.3 漂移证据（必须写进方案前置条件）

分析窗口内本地 main 被其他会话连推 6 个提交：

```
0a317f4559 11:02:19  security(internal): ai-service 入站验票器接入 /internal/checkin 与免扫描标记
5c2b547007 / da4daf00a4 / b0fcdb8adb / 1e61274522 / 481f156b66 / 2aa4690f99 / 9a8361e992 ...
9f42c71f18 11:3x       (最新，ahead 已达 375)
```

**结论：任何基于「当前 main」的读数 10 分钟内就会过期。执行阶段第一步必须是静默窗口 + `M0=$(git rev-parse main)` 钉死，并用 `M0` 重跑全部测量。** 我在 `0a317f4559` 与 `9a8361e992` 两个 HEAD 上各跑了一次 merge-tree，冲突文件集合**完全相同（60 个）**，说明新增的 5 个提交未改变冲突面；但这只对这两个快照成立。

### 1.4 「ahead/behind 读数互相打架」的根因（实测表）

| 分支/worktree | 基点（merge-base） | ahead | behind |
|---|---|---|---|
| `main` | `29cb27dc5f` | 375 | 940 |
| `fix/auth-json-rmw-race` | `29cb27dc5f` | 326 | 940 |
| `fix/root-obs-compose-port` | `51824df8b4` | 2 | 198 |
| `fix/saas-prometheus-exposure` | `51824df8b4` | 2 | 198 |
| `fix/ci-060-061-062` | `1388255cb8`（= origin/main） | 4 | 0 |
| `land/cli-atomic-write` | `1388255cb8` | 1 | 0 |
| `land/saas-prometheus-exposure` | `1388255cb8` | 1 | 0 |
| `land/desktop-auto-refresh` | `1388255cb8` | 1 | 0 |
| `land/g40` | `29cb27dc5f` | 266 | 940 |
| `push-daemon-fanout` | 自身 | 0 | 1352（已被 origin 完全包含，无独有提交） |

**根因两条**：
1. 每个 worktree 的分支基点不同 → 各自量的是「相对自己的基点」，全都「正确」，但都不是「仓库级事实」。
2. `git rev-list --left-right --count A...B` 的输出顺序是 **左=只在 A(=origin/main) 里的提交 = behind**，先打印的是 behind 而不是 ahead。你看到的「359/940、368/198、ahead 2/behind 198」里，后两者其实是同一条分支在不同时间点、被不同脚本按不同标签顺序解读的结果。

---

## 2. 真实分叉测量：文件面

### 2.1 文件数

| 口径 | 数量 |
|---|---|
| main 侧相对 merge-base 改动文件 | 560 |
| origin 侧相对 merge-base 改动文件 | 1748 |
| **双方同改（交集）** | **125** |
| 合并即冲突 | **60** |
| 自动合并成功但同改（仍需复核） | 65 |

### 2.2 交集按目录聚合（前 20）

| 目录 | 交集文件数 | 风险 |
|---|---|---|
| `scripts/` | 18 | **高**（提交链/闸门/落地器） |
| `scripts/tests/` | 14 | **高**（判据本身） |
| `apps/web/` | 14 | 中（含 2 个 `*.generated.ts`） |
| `packages/i18n/` | 11 | **高**（生成物，禁手工合并） |
| `packages/app/` | 11 | 中（主题/共享屏，含测试） |
| `apps/miniapp-taro/` | 10 | **高**（6 个派生件） |
| 根目录 | 8 | 中（README×4、PROJECT_PLAN、AGENTS、.gitignore、pnpm-lock） |
| `apps/cli/` | 8 | 中高（worktree/checkpoint/share） |
| `apps/ai-service/` | 6 | 中高（内部票据/SSE 契约） |
| `scripts/data/` | 5 | **高**（闸门台账/封印清单） |
| `apps/api/` | 5 | **高**（内部鉴权、号池、subagent） |
| `packages/shared/` | 2 | 中（SSE 解析/工具集） |
| `deploy/win/` | 2 | **最高**（部署唯一入口） |
| `scripts/lib/` | 2 | **高**（pre-commit 钩子） |
| `apps/desktop/` | 2 | 中 |
| `packages/api-client/` | 2 | 中 |
| `packages/database/` | 1 | **高**（迁移账本 idx 双占，见 X6） |
| `.husky/`, `.doc-autoupdate/`, `docs/`, `apps/mobile-rn/` | 各 1 | 中 |

### 2.3 高风险目录的判定依据（不是拍脑袋）

- `deploy/win/ihui-deploy.ps1`：**两侧都改，且自动合并「成功」**。main 加签到批次节流（约 4169 行起），origin 加 `Publish-DownloadsSurface`（约 2016 行起）。文本上不同区段所以干净，但这是生产部署唯一入口，自动合并成功 ≠ 语义安全，必须整文件复核 + `verify-deploy-facts.ps1` 双侧断言仍成立。
- `packages/database/drizzle/meta/_journal.json`：两侧**都占 idx 366**（main `20261105120000_tenant_rls_policies_batch1_install`，origin `20261104120000_agent_team_collab`）。这是真正语义冲突（账本唯一性），不是文本噪音。
- `scripts/data/root-guard-manifest.json`：**单写者封印文件**，两侧各自重写 `sealedAt/reason/sha256`。任何手工 union 都会让部署环 `fail-closed` 或形成「假封印」。
- `.husky/` + `scripts/lib/pre-commit-hook.js` + `scripts/safe-commit.mjs`：提交链本身。这里改错，后续所有「逐笔提交」动作都不再可信。
- `packages/i18n/*` + `*.generated.ts` + `*.b64.txt` + `pnpm-lock.yaml`：派生件/锁文件，**原则：一律重生成，不手工合并**。

---

## 3. 完整备份方案（执行阶段第 0 步）

### 3.1 目标盘与容量

| 项 | 实测 |
|---|---|
| 对象库 `D:\IHUI-AI-git-repo` | **14.1 GB** |
| 主 worktree `D:\IHUI-AI` | 82.1 GB（含 node_modules 等，不入包） |
| `C:` 可用 | **67.5 GB** |
| `$env:TEMP` | 解析到 `D:\DevEnv\Temp`（生产盘）→ **所有临时/备份路径必须显式写 C 盘或仓库 `.runtime\`** |

备份根目录固定为 `C:\Users\Administrator\AppData\Local\Temp\ihui-converge-<yyyyMMdd-HHmmss>\`（非生产盘），全部产物落此，**不写 `D:\`**。

### 3.2 bundle 备份（分层，避免一次 `--all` 的体量与 23408 tag 噪音）

```powershell
$BK = "C:\Users\Administrator\AppData\Local\Temp\ihui-converge-$(Get-Date -f yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Force $BK | Out-Null
$M0 = git rev-parse main
$O0 = git rev-parse origin/main
# L1 全量（含全部 tag）；体量预估 5–12 GB，耗时较长
git bundle create "$BK\L1-all-refs.bundle" --all
# L2 主线（不含 tag，快速可验）
git bundle create "$BK\L2-mainline.bundle" $M0 $O0 --not $O0
git bundle verify "$BK\L1-all-refs.bundle"
git bundle verify "$BK\L2-mainline.bundle"
```

> 若 `C:` 余量不足 3× bundle 预估，则先只做 L2 + 分支 bundle，L1 改为按 tag 区间分批（方案同一，只是分批执行）；**不得把备份写回 `D:\DevEnv\Temp`**。

### 3.3 分支/tag 清单（清单本身也是证据）

```powershell
git for-each-ref --format='%(objectname) %(refname)' refs/heads refs/tags > "$BK\refs-manifest.txt"
git branch -vv --no-color > "$BK\branches.txt"
git worktree list --porcelain > "$BK\worktrees.txt"
git tag --list > "$BK\tags-all.txt"
```

实测清单要点：
- 本地分支 **40** 个；其中 **35 个无 upstream**（含 `fix/*` 27 个、`land/*` 3 个、`wt-*` 5 个）。
- 本地 tag **23408** 个，远端唯一 tag **18880** 个，**5162 个 tag 仅存在于本机**（多为 `backup/pre-objectspace-merge-*`、`backup/cleanup-*` 自动产物）。这 5162 个必须进 L1 bundle 或至少进清单，否则「删 tag」类动作不可逆。
- `stash`：**0 条**（所以不存在「忘了 stash」的隐藏工作量）。

### 3.4 未提交 worktree 的 patch 清单（必须逐 worktree 生成）

实测脏面（`git -C <wt> status --porcelain`）：

| worktree | tracked 改动 | untracked | 处置 |
|---|---|---|---|
| `D:\IHUI-AI`（main 本体） | **137**（12 staged + 124 unstaged + 8 untracked） | 8 | 必做 patch（含 staged 与 unstaged 两份） |
| `D:\DevEnv\Temp\wt-root-navbar-barrel` | **15396** | 0 | **单独隔离**：此量级多为整树回写/CRLF，先判性质再备（禁与其他合并处理） |
| `D:\DevEnv\Temp\ihui-merge-wt` | 1003 | 0 | 必做 patch（detached，合并事故现场） |
| `D:\DevEnv\Temp\wt-root-cli-typecheck` | 99 | 0 | 必做 |
| `D:\DevEnv\Temp\wt-root-e2e-skips` | 47 | 0 | 必做 |
| `D:\DevEnv\Temp\wt-root-shared-dedupe` | 24 | 4 | 必做 |
| `D:\DevEnv\Temp\wt-root-sqlite` | 11 | 0 | 必做 |
| `D:\DevEnv\Temp\wt-root-clockdep` | 6 | 0 | 必做 |
| `D:\DevEnv\Temp\wt-root-api-security` | 0 | 3 | 只备 untracked |
| `D:\DevEnv\Temp\wt-root-api-tenant` | 0 | 2 | 同上 |
| `D:\DevEnv\Temp\wt-root-cli-atomic-state` | 1 | 0 | 必做 |
| `D:\DevEnv\Temp\wt-root-miniapp-voice-audio` | 1 | 2 | 必做 |
| `D:\DevEnv\Temp\wt-root-mobile-assistant` | 1 | 2 | 必做 |
| `D:\IHUI-AI-mergefix-wt` | 2 | 0 | 必做 |
| `D:\IHUI-AI/.worktrees/land-saas-prometheus-exposure` | 2 | 0 | 必做 |

```powershell
$wts = (git worktree list --porcelain | Select-String '^worktree ') -replace '^worktree ',''
foreach($wt in $wts){
  $slug = ($wt -replace '[:\\/]','_')
  git -C $wt diff --cached --binary > "$BK\wt\$slug.staged.patch"
  git -C $wt diff --binary > "$BK\wt\$slug.unstaged.patch"
  git -C $wt ls-files --others --exclude-standard > "$BK\wt\$slug.untracked.txt"
  git -C $wt rev-parse HEAD > "$BK\wt\$slug.head"
  git -C $wt status --porcelain=v1 > "$BK\wt\$slug.status.txt"
}
```

**patch 有效性验收（不可省）**：在一个 `C:` 上的临时 clone 里，checkout 到 patch 记录的 `.head`，再 `git apply --check` 两份 patch；任一非 0 即备份不成立，**停**。

**锁状态**：全库扫描无 `index.lock` 残留；但 `D:\IHUI-AI\.worktrees\wt-root-obs-compose-port` 处于 **`locked initializing`**（初始化中断遗留）。方案要求：备份时只记录、不 `worktree unlock`/不 `prune`，留给执行阶段单独处置。

---

## 4. 收敛策略对比

### 路线 A：把 origin/main 合进本地 main

```
git switch main
git merge --no-ff --no-commit 1388255cb8      # 先干跑，不提交
```

| 维度 | 评估 |
|---|---|
| 冲突面 | 60 个冲突全部要解；其中 15 生成物 + 1 锁文件 + 1 封印文件 + 2 modify/delete |
| 工作量 | 一次性大合并；冲突解完后还要过一次全量门 + 全量测试；预计最大 |
| 关键风险 | ①**同题双实现**被判「两边都保留」后变成重复逻辑（心跳键、attention 镜像、dedupe 门、主题修）；②本地 375 提交（108 条 docs/chore 台账）随合并进入待推送历史，origin 的 pre-push 闸门（plan-line-loss / gate-wiring / 载荷归属）会对这批台账行逐条判红；③反向风险：**main 的旧语义覆盖 origin 的新语义**（如 grafana 退役 vs 续修） |
| 回滚 | 只能整条链回滚：`git reset --hard $M0`（破坏性，需单独授权）或 `git revert -m 1 <merge>`（会再引入一次全量冲突） |
| 与硬约束 | 不合 rebase/force 的字面规定，但实质上是「把两条历史缝在一起再一起出版」，风险集中且不可分段 |

### 路线 B：以 origin/main 为基，逐组重新落点（**推荐**）

```
git switch -c land/<group> origin/main
git cherry-pick -n <该组提交…>        # 或 git diff <base>..<sha> -- <paths> | git apply -3
# 跑该组自带夹具/门 → 提交 → （批准后）逐组推分支
```

| 维度 | 评估 |
|---|---|
| 冲突面 | 不用解 60 个文本冲突；冲突以「某组落点时对不上」的形式局部出现，**一次只处理一组** |
| 工作量 | 分组 + 每组验证；但每组都自带判据（本地 172 个 `fix`、27 个 `test` 提交绝大多数带夹具），验证成本可分摊 |
| 关键风险 | ①origin 可能已用**另一种写法**修了同一个 bug → 落点前必须先做「同题检测」（同文件 + 同断言 + 同测试名）；②940 个对方提交里已有新契约，老提交可能已过期 |
| 回滚 | **单组回滚**：删分支或 `git revert <该组提交>`；本地 main 全程不动 → 失败成本≈0 |
| 与硬约束 | 天然满足「禁止 rebase / 禁止 force」：不改写任何既有历史，只在新基上产生新提交 |

### 路线 A′（伪选项，已排除）：合进本地 main 但不推

部署唯一入口只跟 `origin/main`，不推到 origin 就等于没收敛，只是把分叉藏在本地。排除。

### 推荐：B，且按「三档」分组

| 档 | 内容 | 依据 |
|---|---|---|
| B1 可直接落 | 基点已是 `origin/main` 的分支：`fix/ci-060-061-062`(ahead 4)、`land/cli-atomic-write`(1)、`land/desktop-auto-refresh`(1)、`land/saas-prometheus-exposure`(1) | merge-base = `1388255cb8`，零冲突面 |
| B2 补基后落 | 基点 `51824df8` 的分支：`fix/root-obs-compose-port`、`fix/saas-prometheus-exposure`（各 ahead 2 / behind 198） | 需 rebase 语义的**替代动作**（cherry-pick 到新基，不是 rebase） |
| B3 分题重落 | 本地 main 独有的 172 `fix` + 37 `feat` + 27 `test` + 3 `security`，按文件簇分组（`apps/api|ai-service` 内部鉴权簇、`apps/cli` 原子写簇、theme 簇、gate/guardian 簇、i18n 簇…） | 108 条 docs/chore 台账**不重落**（随 origin 台账体系走，避免 plan-line-loss 冲突） |

---

## 5. 冲突干跑结果（零提交、零工作区改动）

**方法**：`git merge-tree --write-tree --name-only origin/main main`（exit 1 = 有冲突；不写 index、不写工作区、不建提交，只在对象库留下不可达临时树 `3dbd9da2…`）。
在 `0a317f4559` 与 `9a8361e992` 两个 HEAD 上分别跑，**均为 60 个冲突文件**。

冲突的「两方意图」用 `git log <base>..<side> -- <file>` 逐文件取证，完整机器可读表见
`C:\Users\Administrator\AppData\Local\Temp\ihui-converge-20261106\conflict-summary.tsv`。

### 5.1 分类与处置原则

| 类 | 数量 | 处置 |
|---|---|---|
| 派生件/生成物（b64×4、`ui-routes.generated.ts`×2、`i18n/generated`×3、miniapp 词包 JSON×5、drizzle `_journal.json`） | 15 | **禁止手工合并**：合并后按单一源头重生成，再 `git status` 断言只剩派生态差异 |
| 锁文件 `pnpm-lock.yaml` | 1 | 只允许 `pnpm install` 重生成 |
| 封印/台账 JSON（`root-guard-manifest`、`staged-deletions-allowlist`、`component-props-equivalence`、`autonomy-leg-liveness`、`grafana-external-metrics`） | 5 | 台账行 union + **封印字段必须重新 `--seal`** |
| 文档（README×4、AGENTS、PROJECT_PLAN、`.doc-autoupdate/last-sha`） | 7 | 活文档行 union；数字/README 展示块按 HEAD 面重算 |
| 闸门/提交链工具（`scripts/*` 10 + `scripts/tests/*` 8） | 18 | 逐文件比对判据方向，**只准收紧，不准放宽** |
| 应用源码（ai-service 1、api 2、cli 4、mobile-rn 1、web 2、packages/app 4） | 14 | 逐文件读语义，见 §5.2 |

### 5.2 需要裁决的语义冲突（**只记录双方意图，不裁决**）

#### X1 · grafana 门族：**删除 vs 续修** —— 语义互斥（硬停）
- main 侧 `ed0bf2fedc`（2026-11-04 16:14）《grafana-* 旧族退役 6 枚并登记退役锁，门 220/222 改指 panel 真值面》：**删掉** `check-grafana-metric-exists.mjs`（-459 行）、`verify-grafana-logql-panels.mjs`（-237）、`verify-grafana-panel-data.mjs`（-588）、`grafana-external-metrics.json`（-41），登记 `retired-paths.json` + 退役锁，1622 行删除。
- origin 侧 `7ac117afea`（2026-11-05 17:50）《大屏指标门的扫描根接到 11-04 退役后的真源》：**保留该门**，把 `DASHBOARD_DIRS` 从 `*/grafana/dashboards` 改指 `*/panel-defs/panels`，并删掉 `grafana_` 外部指标前缀（+14/-11）。
- 双方对同一事实（legacy grafana 树已于 11-04 退役、面板搬进 `panel-defs/panels`）**结论相同**，但终态互斥：一方认为该门已被 panel 真值面取代 → 删；另一方认为该门仍有效 → 改指后继续跑。
- **不可同时保留**：文件要么存在要么不存在。请裁决「门 220/222 的归属」，我不代为决定。
- 注意时序：main 的删除（11-04）**早于** origin 的续修（11-05），说明不是「main 落后」而是两条线各自治理。

#### X2 · `root-guard-manifest.json` 封印：两侧各写 `sealedAt`
- main：`sealedAt=2026-11-05T01:23:31.990Z`，reason「停用 lost-commit 增长产线」，`guardian-runner` sha `1492d5…`、`git-guardian` sha `9eda73…`。
- origin：`sealedAt=2026-11-05T03:56:50.966Z`，reason「门296触发面补 retry-reload-resolutions.jsonl」，`guardian-runner` sha `e7000d…`、`AGENTS.md §0` sha `933d5d…`。
- 这不是「谁的时间戳更新就取谁」：封印必须与**合并后实际字节**一致，否则部署环 `fail-closed`。处置：合并后统一执行 `node scripts/git-guardian.mjs --seal` 重封，**不许手工拼**。

#### X3 · `apps/api/scripts/relay-account-keepalive.ts`：同一 bug 的双修
- main `52673665b7`：《保活腿心跳写入口改传主键 id —— 曾把 uid 当 id 用导致 heartbeated 恒 0》
- origin `88288827eb`：《强保腿三格同批修(心跳取错键/整族拨心跳/登记面锁死运营池)，并把 10 枚 Qoder 号真正接管续期》
- 同题、同一根因、两套实现。**必须先验证 origin 的三格修是否覆盖 main 的修点**；若覆盖 → 取 origin；若两侧各有独立修点 → 需合并两处逻辑（属语义判断，**停手**）。

#### X4 · `apps/api/src/services/subagent-dispatch-service.ts`：attention 镜像双修（细节互斥）
- 两侧都改成「先取现值再按键比较、不变不写、不推假 `updatedAt`」——**主意图同题**。
- 唯一实质差异在「读不到现值」这一分支：
  - main：`if (!current) return`（行不存在 → 直接不写，显式注释「不新建」）
  - origin：`current?.attention === next` → `undefined !== null` 成立 → 仍发 UPDATE（0 行受影响；若并发插入则写）
- 这条分支的行为差异极小但方向不同（「判不出就不动」vs「判不出就照写」）。按「不得自行裁决」原则，记录双方意图，请裁决或由 X3 的同题结论一并裁定。

#### X5 · `apps/web/src/components/download/DownloadAssetCard.tsx`：**add/add**
- main `16ad92b709`《恢复下载详情页组件引用，解除 TS2307 构建阻断》新建 5722 B。
- origin `0943ea14ae` 合并链新建 6435 B，与 main 版差 **+10/-1**。
- 两侧独立新增同名组件。处置：取字节较全的一版并把另一版的 1 处差异并回（先 `git show <side>:<path> | diff`），属机械可解，但**必须确认哪个版本含 origin 的下载面契约**（origin 同期有 `fix/downloads-freshness`）。

#### X6 · `packages/database/drizzle/meta/_journal.json`：idx 366 **双占**
- main：`idx 366 / when 1793888061055 / 20261105120000_tenant_rls_policies_batch1_install`
- origin：`idx 366 / when 1793764800000 / 20261104120000_agent_team_collab`
- 规则可解、不需裁决：**按 `when` 升序重排** → origin 的 `20261104120000` 保 366，main 的 → 367；`when` 升序断言必须机器校验。
- 附带核查（已做）：main 的重发迁移正文与 `20260927100000_tenant_rls_policies_batch1.sql` **逐字节相同**，只换 `when`（文件头自述，用于绕开 drizzle「只跑 when > 已应用最大 when」的 lateGap），origin 侧**未修改**该 0927 文件 → **不存在旧策略覆盖新策略**。

#### X7 · 其余 53 个冲突（机械/同题，列出处置口径）
- `scripts/check-dedupe.mjs`：两侧**独立做了同一个修**（取材失败 → exit 2 未判定）。取更严的一版，并保留对侧测试断言。
- `scripts/safe-commit.mjs` + `scripts/tests/safe-commit*.mjs` + `scripts/tests/staged-delete-intent.test.mjs` + `scripts/heal-worktree-tracked.mjs`：两侧都在修「静默覆盖他人工作面 / 全局 reset」，方向一致，按 union + 单测逐条跑。
- `scripts/lib/pre-commit-hook.js`：main 加 64MB `maxBuffer`，origin 改 `execPath`+仓内绝对 bin。**互补，可 union**。
- `packages/app/*`（`BannerCarousel`/`AigcPublishScreen`/`KnowledgeBaseScreen`/`CoursePlanetScreen.test`）：两侧都在清主题硬编码/圆角档位，同题；按断言方向取更严。
- `apps/cli/src/{checkpoints,commands/share,subagents/worktree,tools/worktree}`：main 原子写/realpath 断言，origin 快照分层/删除容错/容器断言。判据方向同向（都更严），按文件逐处 union。
- `apps/miniapp-taro/src/pages/user/index.tsx`、`apps/web/.../PageClient.tsx`、`apps/mobile-rn/.../EduAttendanceQrScreen.tsx`：自助考勤/整月视图与新端点，双侧互补。
- `apps/ai-service/app/core/sse_contract.py`：main 增「工具入参逐分片直推」读点，origin 增「前端读点识别面」判据。**须双向核对读点集合**，避免判据把新读点判红。

---

## 6. 执行步骤（逐步骤：命令 / 验证读数 / 硬停条件）

> 全程 PowerShell；所有临时/备份路径显式写 `C:\…\Temp\`；`$env:TEMP` 不改（禁止依赖）；遇 `index.lock` 等 5–10 秒重试，**不删锁**。

### S0 · 静默窗口（前置）
```powershell
git worktree list --porcelain
Get-Process git,git-lfs,node -ErrorAction SilentlyContinue | Select Id,ProcessName,StartTime
```
**验证**：连续 5 分钟 `git rev-parse main` 不变；`git status` 脏面不再增长。
**硬停**：仍有会话在写（HEAD 变动 / 脏面增长）→ 停，报「静默窗口未达成」。理由：本次测量中 main 在 30 分钟内前进了 6 个提交。

### S1 · 钉子与基线（只读）
```powershell
$M0 = git rev-parse main; $O0 = git rev-parse origin/main; $B0 = git merge-base $M0 $O0
"$M0 $O0 $B0" | Tee-Object "$BK\pins.txt"
git rev-list --count "$B0..$M0"; git rev-list --count "$B0..$O0"
git merge-tree --write-tree --name-only $O0 $M0 > "$BK\merge-tree-final.txt" 2>&1
(Select-String -Path "$BK\merge-tree-final.txt" -Pattern '^CONFLICT').Count
```
**验证**：`$O0 = 1388255cb826b3bdfaa1664bf3a39083ef372550`；两侧计数与 §1.2 同量级；冲突数应 = 60（若 >60，说明有新冲突面，需重做 §5 取证）。
**硬停**：`$O0` 与 `ls-remote` 不一致（origin 又前进）→ 停，重测（origin 前进意味着冲突面可能扩大）。

### S2 · 备份与验收
按 §3 执行 L1/L2 bundle + refs 清单 + 逐 worktree patch。
```powershell
git bundle verify "$BK\L1-all-refs.bundle"
git bundle list-heads "$BK\L1-all-refs.bundle" | Measure-Object -Line
```
**验证**：两个 bundle `verify` 均返回 0 退出；`refs-manifest.txt` 分支数 = 40、tag 数 = 23408；patch 在临时 clone 里 `git apply --check` 全通过。
**硬停**：任一 bundle 校验失败、或 patch 无法 apply → 停（无备份不进入任何写操作）。

### S3 · 分组与同题检测（只读）
```powershell
git log --format='%H%x09%s' "$B0..$M0" > "$BK\main-commits.txt"
git diff --name-only "$B0..$M0" > "$BK\main-files.txt"
git diff --name-only "$B0..$O0" > "$BK\origin-files.txt"
```
**验证**：产出三张表 + 同题清单（同文件 ∧ 同测试名 ∧ 同断言方向）。
**硬停**：发现任一组内出现「同一测试断言被两侧改成相反期望」→ 停，逐条摊开意图（本次已识别 X3/X4 两处）。

### S4 · B1 档（零冲突，先落）
```powershell
git switch -c land/ci-060-061-062 $O0
git cherry-pick -n 1388255cb8..fix/ci-060-061-062
git diff --cached --stat
```
**验证**：`git status` 无 `UU`；该组对应门（BUG-60 陈旧 dist 门）与自测通过；`git diff --cached` 只含预期文件。
**硬停**：出现任何 `UU/AA/DU`；或门禁变红且原因是判据被放宽（**禁止放宽判据换绿**）。

### S5 · B2 档（补基）
```powershell
git switch -c land/root-obs-compose-port $O0
git cherry-pick -n 51824df8b4..fix/root-obs-compose-port
```
**验证**：`8801/8815/9091` 端口断言仍成立（该组改 Prometheus 宿主口）；`docker compose config` 可解析；`check-grafana-metric-exists`/`check-panel-datasource-wiring` 结论**由 X1 裁决决定**。
**硬停**：X1 未裁决前，此组不得提交（该组与 grafana 门族同域）。

### S6 · B3 档（分题重落，逐 group 一提交）
每组固定动作：`git switch -c land/<group> $O0` → `cherry-pick -n` → 跑该组夹具 → `git commit`（走正常 pre-commit，**不得 `--no-verify`/`HUSKY=0`**）。
**验证**：每组 `git log --oneline $O0..HEAD` 只 1 笔；`git status` 干净；该组测试红→绿有读数对比。
**硬停**：任一组需要「改判据阈值才能绿」→ 停；任一组与 origin 已有实现同题且无法判定覆盖 → 停（X3/X4）。

### S7 · 逐组推送（**需单独批准**，本方案不含）
```powershell
git push origin land/<group>     # 绝不 push main、绝不用 --force
```
**硬停**：pre-push 闸门红 → 停并附失败读数；远端拒绝 → 停，不改写历史绕过。

### S8 · 收敛收尾（需单独批准）
全部 group 合入 origin/main 后：`land/*` 逐步删除；本地 main 以 `archive/main-<M0>` 留档，或经批准 `git reset --hard $O0`（破坏性动作，需明示授权）。
**验证**：`git rev-list --count origin/main..main` = 0 或仅剩归档；部署入口 `D:\DevEnv\ihui-prod\deploy\win\ihui-deploy.ps1` 仍只跟 `origin/main`。

---

## 7. 执行前必须满足的前置条件（逐条可判真假）

1. **静默窗口**：连续 5 分钟 `git rev-parse main` 恒定，无活动 git 进程、脏面不增长。
2. **备份验收**：L1/L2 bundle `git bundle verify` 通过；40 个分支 + 23408 个 tag 清单落盘；15 个脏 worktree 的 patch 在临时 clone 中 `git apply --check` 全通过；`W:\` 不参与（备份只在 `C:\…\Temp\ihui-converge-*`）。
3. **裁决到位**：X1（grafana 门族去留）、X3（心跳键双修取哪套）、X4（attention「读不到现值」分支方向）三处均有明确结论；未结论前 S4/S5/S6 全部不启动。
4. **基线留存**：`$M0`/`$O0` 下各自的门禁绿/红清单与关键测试读数已落盘（否则无法证明「没有把红变绿、也没有把绿变红」）。
5. **容量**：`C:` 可用 ≥ 3× L1 bundle 预估；对象库 14.1 GB 不再增长。
6. **纪律**：不 rebase、不 force、不 `--no-verify`/`HUSKY=0`、不 `git add -A`、不删锁、不删分支/worktree（除 S8 批准后）；`wt-root-navbar-barrel`（15396 文件改动）与 `wt-root-obs-compose-port`（`locked initializing`）在收敛窗口内**只读**。
7. **部署墙**：收敛窗口内不触发任何部署；`ihui-deploy.ps1` 的签到批次节流与 `Publish-DownloadsSurface` 两段在合并后必须整文件复核（它们在本仓库两侧都是「自动合并成功」的高危改动）。

---

## 8. 待裁决清单（需要你回一句即可推进）

| 编号 | 问题 | 我需要的结论 |
|---|---|---|
| X1 | grafana 门族（`check-grafana-metric-exists` / `verify-grafana-*` / `grafana-external-metrics.json`）**退役删除** 还是 **改指 `panel-defs` 续修**？ | 「删」或「留」 |
| X3 | 保活腿心跳键：主键 id（本地）还是 origin 的「三格同批」口径？ | 若你授权，我可先做只读比对给出「是否覆盖」的结论，再由你确认 |
| X4 | attention 镜像「读不到现值」分支：`return`（本地）还是照写（origin）？ | 同上 |

其余 57 个冲突与 65 个「自动合并成功但同改」的文件，均可按 §5.1 的机械口径处置。

---

## 附：本次测量产物路径（可复核，非交付物）

```
C:\Users\Administrator\AppData\Local\Temp\ihui-converge-20261106\
  mergetree.out / mergetree2.out      # 两次 merge-tree 干跑全文（含 60 条 CONFLICT）
  conflict-summary.tsv                # 60 个冲突文件 × 两侧提交数与最新意图
  conflict-intents.txt                # 逐文件两侧提交全量清单
  files-main.txt / files-origin.txt / files-both.txt   # 560 / 1748 / 125
  log-main.txt / log-origin.txt       # 两侧独有提交
  cherry-main.txt / cherry-origin.txt # patch-id 等价判定
  local-tags.txt / remote-tags.txt    # 23408 / 18880（差集 5162）
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
