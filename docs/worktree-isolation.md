<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Worktree 隔离:一条命令开 / 收 / 列

> 立单 2026-11-04。工具 `scripts/worktree-isolate.mjs`,文档 `docs/worktree-isolation.md`。
> 本轮**不改 AGENTS.md**(另一会话正在收口文档),关系说明先落在这里。

## 0. 现在就能用的三条命令

```powershell
# 开:从当前 HEAD 建一棵仓外独立检出(默认 <盘根>/<仓名>-wt-<slug>),分支名带唯一后缀
node scripts/worktree-isolate.mjs new <slug>

# 回:把该树已提交的成果搬回主线(主线侧 merge --ff-only;非快进先在该树普通 merge 主线)
node scripts/worktree-isolate.mjs land <slug|绝对路径>

# 收:先查脏,干净才删;有未提交/未跟踪就 exit 1 并列出清单;绝不 force
node scripts/worktree-isolate.mjs drop <slug|绝对路径>

# 列:所有 worktree + staged/unstaged/untracked 计数(与门 281 同一解析实现)
node scripts/worktree-isolate.mjs list
node scripts/worktree-isolate.mjs list --json

# 自检(夹具仓内跑,不碰真实仓)
node scripts/worktree-isolate.mjs --self-test

# 并发对照压测(夹具内跑:共用工作树 vs 两棵 worktree,各 2 席 × 20 轮)
node scripts/worktree-isolation-stress.mjs --rounds 20
node scripts/worktree-isolation-stress.mjs --rounds 20 --json
```

`new` 的可选旗标:`--dest <目录>`(覆盖落点)、`--branch <名>`(覆盖自动分支名)、`--base <ref>`(默认 `HEAD`)。

`land` 是**唯一**回主线的合法动作:它只在主线侧推进 ref(`merge --ff-only`),不产生新提交、
不重跑钩子;主线已前进时在该隔离树内做一次普通 `git merge <主线 HEAD>`,再回主线侧 ff。
非快进合并冲突会 `merge --abort` 回滚后拒绝。**没有 cherry-pick,没有 `update-ref` CAS**:
后者只动 ref 会让主树 HEAD/index/worktree 脱节,制造 `AD` 反向暂存(§2.4 的同一型事故)。

真实创建输出(2026-11-04 实测,`new proof-selftest`):

```
✅ 已创建隔离工作树
   路径: D:/IHUI-AI-wt-proof-selftest
   分支: wt/proof-selftest-20261104-1757-de0b63
   基线: HEAD (b6215339)
   进入: cd "D:/IHUI-AI-wt-proof-selftest"
         PowerShell: Set-Location -LiteralPath "D:/IHUI-AI-wt-proof-selftest"
   在树内提交: git add -- <本席路径...>; git commit -m "<标题>" -- <本席路径...>
             (该树 index 与 COMMIT_EDITMSG 都在它自己的 admin 目录,别席物理上碰不到)
   回主线: node scripts/worktree-isolate.mjs land "D:/IHUI-AI-wt-proof-selftest"
   收尾: node scripts/worktree-isolate.mjs drop "D:/IHUI-AI-wt-proof-selftest"
```

### 0.1 现状基线(2026-11-04 22:38 实测,`git worktree list --porcelain`)

| 检出 | HEAD | 分支 |
|---|---|---|
| `D:/IHUI-AI-git-repo`(主树) | `1c3d44d4bc` | `main` |
| `D:/IHUI-AI-homefont-wt` | `b2de284036` | `push-daemon-fanout` |
| `D:/IHUI-AI-mergefix-wt` | `a1029c579c` | detached |

- 主树脏面 **154 条**(全部是别席在飞改动,本单不动);
- 仓内 `wt/*` 分支数 **0**(本轮工具只建仓外临时树,用完即收);
- 本轮**没有**删除任何既有 worktree,也没有 `worktree remove --force`。

**22:49 提交前复核**(别席仍在推进,与 22:38 快照不同,以现读为准):

- 主树 HEAD 已由 `1c3d44d4bc` 前移到 `09f2d95b10`(别席 4 枚),本单提交后为 `6994aadf9f`;
- 主树脏面 **152 条**,共享索引里 **2 条** staged(`PROJECT_PLAN.md`、`scripts/lib/autonomy-nonprogress.mjs`)属别席,本单一个字节未动;
- worktree 仍 **3 棵**(主树 / `homefont-wt` / `mergefix-wt`),数量与各自 HEAD 未变,未删任何一棵;
- 本单三个路径提交后 `git status --porcelain` 为空(无 `AD`/`MM` 反向暂存残留)。

## 1. 安全边界(代码级硬约束)

| 约束 | 实现 |
|---|---|
| 脏拒删 | drop 先跑 `status --porcelain`,staged/unstaged/untracked/conflict 任一非零 ⇒ exit 1,逐条列前 50 条现场 |
| 量不到就拒 | `status` 读不到 ⇒ 拒删(fail-closed),不按"0 条脏"放行 |
| 不删未登记目录 | 目标必须在 `git worktree list` 里;同名普通目录只报不删 |
| 绝不 force | `git worktree remove` **不加** `--force`;`git branch -d` **不用** `-D`;全程无 `reset --hard` / `clean -f` / stash |
| detached 拒删 | 删除会丢 HEAD 唯一引用,先转分支或打 `lost-commit/*` 保活 |
| 不抢仓内落点 | 目标在仓库树内 ⇒ 拒建,指回 `agent-worktree.mjs` 的 `.worktrees/` 生命周期 |
| 分支/路径冲突前置判定 | 目标已存在、已注册、分支已占用、基线取不到,全部在**写入前**拒绝 |
| land 不覆盖别人的脏 | 先比对"本次要更新的路径"与主线 staged/unstaged/untracked 路径,有交集就在写入前拒并逐条列 |
| land 不带走未提交件 | 隔离树有 staged/unstaged/conflict 就拒;未跟踪只告警(不会被 land,drop 会因此拒删) |
| land 串行化 | 锁 `<gitcommondir>/ihui-worktree-land.lock`,跨 worktree 互斥;宿主已死/超 60s 的残留锁才清 |
| 非快进 | 隔离树内 **普通 merge 主线**(禁 rebase/cherry-pick),冲突则 `merge --abort` 回滚后拒 |
| 零钩子拒建 | `core.hooksPath` 已配时,基线检出里没有 `<hooksPath>/pre-commit` ⇒ `new` 在**写入前**拒绝(不建零钩子树) |
| 建后复核 | `worktree add` 后用**该树自己的** `--git-path hooks` 复核;缺失则非 force 回收刚建的树 + `branch -d`,不碰既有检出 |
| 零钩子树可观测 | `list` 逐棵打印 `HOOKS=ok` / `⚠ZERO-HOOKS`,汇总行给出"零钩子 N 棵"与路径 |

与 `agent-worktree.mjs` 的分工:`agent-worktree.mjs` 管**仓内** `.worktrees/`(AGENTS §12h、默认 dry-run、带 reap);本工具管**仓外**独立目录,面向"开一棵、干完就收"。不是第二套规范,是两种落点。

### 1.1 一个实测教训:`worktree add` 需要重超时

本仓约 1.9 万个文件。2026-11-04 首次实测用取材层默认 60s 超时,`git worktree add` 在
`Preparing worktree (new branch 'wt/…')` 处被打断,留下:

- 目标目录存在、已注册、`locked` 原因 `initializing`;
- 半成品:索引为空 ⇒ `status --porcelain` 里 `D ` 18,957 条 + `??` 34 条。

处置:工具已把 `worktree add` / `worktree remove` 单独派生 **15 分钟**超时;失败时若检测到
`locked(initializing)` 的登记,会打印"这是半成品"与人工收尾顺序(**不自动删**)。

## 2. 与 `isolated-git` 的关系(不改它本体)

### 2.1 工作树里本来就有独立 index

worktree 的 `.git` 是一个指针文件,指向 `<主 gitdir>/worktrees/<name>/`。该目录自带
`index`。所以要害不是"有没有 index",而是**共享索引问题只在主树成立**:

- 主树:多会话共用 `<主 gitdir>/index` ⇒ 谁 `git add`,别人 `git commit` 就会带上;
  删除件被半暂存时会出现 `AD` 反向暂存残留 ⇒ 裸 `git commit` 复活已删件。
- 隔离树:index 在自己树下 ⇒ 别人的 `git add` 物理上到不了你的提交。

### 2.2 仍然共享的东西(必须知道)

| 共享项 | 后果 |
|---|---|
| `refs/`、`objects/` | 分支/提交是全局的;`branch -d` 影响全局 |
| `config`、`hooks` | 仓库级配置对每棵树都生效;但 `core.hooksPath` 若用**相对路径**,按树解析(实测 §2.3.1):树里没有该目录 ⇒ 钩子静默不跑 |
| **stash** | stash 是全局栈,不是每树一份 ⇒ worktree 内同样**不要 stash** |

### 2.3 推荐用法

- **在隔离树内**:`git add -- <本席路径>` + `git commit -m "<标题>" -- <本席路径>`
  就是安全的 —— index 在 `<repo>/.git/worktrees/<名>/index`、`COMMIT_EDITMSG` 在
  `<repo>/.git/worktrees/<名>/COMMIT_EDITMSG`(均实测),别席物理上写不到。
- **在主树内**:继续按 §12i 走 `isolated-git`(自建私有索引 + `immutable-exempt`)。
- **实测缺口(2026-11-04)**:`scripts/isolated-git.mjs` **不能**在 linked worktree 里直接用。
  它建私有 GIT_DIR 叠层时把 `commondir` 写到该树 admin gitdir(`<repo>/.git/worktrees/<名>`,
  该目录自己还有一层 `commondir=../..`),git 不跟随第二层 ⇒
  `fatal: not a git repository: …<idx>.gitdir`;只补 `GIT_COMMON_DIR` 时能建出提交对象,
  但**分支 ref 不前进**(commit 悬空、索引留 `A`)。本单不改它本体;在 worktree 里用该树
  自己的 index 即可(它已经是私有的)。修它需要把叠层的 `commondir` 改指 `git rev-parse
  --git-common-dir`,并复核 ref 推进 —— 列为未定项(§10)。
- 不要把主树的"私有索引"思路当成 worktree 的必要条件:worktree 解决的是**跨会话共享索引**,
  `isolated-git` 解决的是**同一棵树内的钩子回写与残留索引**。两者正交。

### 2.3.1 「该树自己的 index + 裸 `git commit`」的可靠性判定(夹具实测)

**问题**:同一棵树会不会被两席共用?工具保证"一树一席"吗?

- **工具不保证**。`newWorktree` 只做写入前判定:目标已存在(`:297`)、分支已占用
  (`branchExists :140` / `:308`)、目标在仓库树内;**没有任何 owner / 占用锁**。
  `land` 有跨树锁(`acquireLandLock :208`、`landWorktree :477`),但它只串行化 **land**,
  不覆盖树内 commit。
- 所以"同树两进程同时提交"**可能**。夹具实测(6 轮,同树两进程、`pre-commit` sleep 1.2s,
  各自 `git add -- <路径>` + `git commit -m … -- <路径>`):

| 读数 | 结果 |
|---|---|
| 每轮成功/失败 | **1 成 1 败**(6/6 轮) |
| 败方退出码与原因 | **6/6** `rc=128 fatal: Unable to create '.git/index.lock': File exists` |
| "静默回退"(两笔都成、后落地那枚回退前一席文件) | **0/6** |

- **判定**:"无 CAS"成立,但失败形态是 **fail-closed(rc=128)**,不是静默吞掉。
  该通道在**单席占用**下可用;在**同树两席**下**不可用作默认**——一半提交被锁挡、无排队无重试。
  默认化只能二选一,且都需另做:
  (a) 每树 commit 互斥锁(**未实现**,列 §10);
  (b) 用既有全仓写锁 `node scripts/git-lock.mjs acquire|release --unit <id>`
  (锁文件 `<gitdir>/ihui-git-write.lock`,与 safe-commit/isolated-git 同一把)包住树内提交;
  **实测未做**,且代价是把跨树提交也串行化,与并发隔离的收益相反。

**同夹具的另两项读数**(三棵树 = 主树 + `wt-probe` + `wt-probe2`):

- 元数据落点(实测路径,不是结论):
  - index:`<repo>/.git/index` / `<repo>/.git/worktrees/wt-probe/index` / `<repo>/.git/worktrees/wt-probe2/index`;
  - `COMMIT_EDITMSG`:同样一树一份(`…/worktrees/<名>/COMMIT_EDITMSG`)。
- `core.hooksPath=hooks`(相对):只在 `wt-probe` 建 `hooks/pre-commit`,
  wt 提交 `rc=0` 且日志为 `hook-run …/wt-probe`;主树提交 `rc=0` 且**日志未增加**
  (主树没有 `hooks/` ⇒ 钩子**静默不跑**)。这是"按树解析"的实测输出,也说明相对
  `core.hooksPath` 必须保证每个检出里真有那个目录。
- 该树 index **自动归位**,不需要 isolated-git 那种后置推进:commit 后
  `git status --porcelain -- a.txt` 为空、`git diff --cached` 为空。

### 2.3.2 现有 3 棵树的钩子核查(2026-11-04 23:28 实测,逐棵执行级)

仓库配置 `core.hooksPath=.husky`(相对路径,`.husky/` 在版本控制内)。逐棵读数
(`git -C <树> config --get core.hooksPath` × `git -C <树> rev-parse --path-format=absolute
--git-path hooks` × `Test-Path <hooks>/pre-commit` × 执行级探针):

| 检出 | 解析出的钩子目录 | pre-commit 存在 | 执行级探针 | 结论 |
|---|---|---|---|---|
| `D:/IHUI-AI`(主树) | `D:/IHUI-AI/.husky` | true | rc=1(桩命中) | **有钩子** |
| `D:/IHUI-AI-homefont-wt` | `D:/IHUI-AI-homefont-wt/.husky` | true | rc=1(桩命中) | **有钩子** |
| `D:/IHUI-AI-mergefix-wt` | `D:/IHUI-AI-mergefix-wt/.husky` | true | rc=1(桩命中) | **有钩子** |

- **执行级探针怎么做的(不改树内容)**:临时目录放一个会失败的 `wscript` 桩(sh 脚本,
  打印 `IHUI_PROBE_STUB` 后 `exit 1`),把它 **prepend 到 PATH**,再逐棵跑
  `git -C <树> hook run pre-commit`。该树解析出的**真** `.husky/pre-commit` 会被 git 执行,
  只到它调用 `wscript` 这一步就撞桩失败 ⇒ rc=1;不下钻 node 守门链(不跑自愈门、不写文件)。
  - 正控制(同形态夹具仓,钩子存在):`rc=1 out=IHUI_PROBE_STUB: hook dispatched, failing on purpose`;
  - 负控制(同名钩子文件改名后):`rc=1 out=error: cannot find a hook named pre-commit` —— 探针能区分零钩子;
  - 副作用核对(探针前后 `git -C <树> status --porcelain` 行数):主树 **151→151**、
    `homefont-wt` **0→0**、`mergefix-wt` **2→2**;三棵脏面数量一字未变;
- `node scripts/worktree-isolate.mjs list`:三行均 `HOOKS=ok`,汇总 **零钩子 0 棵**;
- 另建 `wt/hookprobe` 树做过的整链探针(2026-11-04 23:23):`git hook run pre-commit`
  **>30s 未返回**(30s 超时终止),树 `dirtyLines=0`;与上表同批证据,这里保留为"整链会跑"的旁证;
- 结论:**今天 3 棵都不是零钩子树**;风险只在"以后建一棵 hooksPath 指向未纳入版本控制的目录",
  已由 §1 的三条硬约束(写入前拒建 / 建后复核 / list 标红)堵住。

### 2.4 实测:在主树里用 isolated-git 会留下 AD 反向暂存残留

本单第一次提交(`b621533`,走 `isolated-git` 私有索引)之后复查,共享索引把两件新文件记成
`D `(已暂存删除),而工作区里文件还在、状态是 `??`:

```text
D  docs/worktree-isolation.md
D  scripts/worktree-isolate.mjs
?? docs/worktree-isolation.md
?? scripts/worktree-isolate.mjs
```

这就是"私有索引提交完不推进共享索引"的可见形态。**危险点**:任何会话此时裸 `git commit`,
都会把这两件当成"已确认删除"提交掉(即"复活已删件"的反向:把新增件删掉)。

修复只碰本单路径,不动别人的暂存:

```powershell
git add -- <本单路径...>      # 让共享索引回到 HEAD/工作区
# 或(只回索引、不动工作区)
git reset -- <本单路径...>
```

**在 worktree 里不会出现这个形态**:索引物理上就在那棵树自己的 admin 目录,不存在跨会话共享。
这也正是把提交搬进隔离树最直接的收益。

## 3. 自检读数(2026-11-04 实测)

`node scripts/worktree-isolate.mjs --self-test`(全部落在 `mkScratch` 夹具仓):

```
✅ A 开(干净) | exit=0 path=…/wt-clean branch=wt/clean-20261104-2238-d577d6
✅ A 列(2 棵) | trees=2 exit=0
✅ B 脏拒删 | exit=1 ❌ 拒绝删除:工作区还有未提交内容(staged=0 unstaged=1 untracked=1 conflict=0)
✅ B2 干净可删 | exit=0 removed=true branchGone=true
✅ C 路径不存在 | exit=1 ❌ 拒绝删除:…wt-ghost 不存在,也未注册为 worktree
✅ D 同名冲突 | exit=1 ❌ 拒绝创建:目标路径已存在 …wt-dup
✅ E 已占用分支 | exit=1 ❌ 拒绝创建:分支已存在 wt/taken
✅ G0 开(land 用) | exit=0 branch=wt/land-20261104-2238-4aa669
✅ G land 快进成功 | exit=0 mode=ff main=7564326f tip=7564326f
✅ G2 land 后可干净回收 | exit=0 branchDeleted=true
✅ H 主线脏重叠拒 | exit=1 ❌ 拒绝 land:主线有 1 条路径未提交,而本次要更新它们… a.txt
✅ H2 清脏后 land 恢复 | exit=0 mode=ff
✅ I 零钩子基线拒建 | exit=1 created=false ❌ 拒绝创建:基线 57d438ae 的检出里没有 hooks/pre-commit。
✅ J 有钩子基线可建 | exit=0 hooksOk=true    钩子: …/wt-hooks/hooks/pre-commit(已核查存在)
✅ J2 零钩子树被 list 标红 | hooksOk=false 零钩子汇总=… | 零钩子 1 棵:…/wt-hooks
✅ J3 复原后可干净回收 | exit=0 branchDeleted=true
✅ F 零真实仓足迹 | 真实仓 worktree 数 3→3(本自检未新增真实检出)
self-test: 全绿(17 组断言,全部落在 mkScratch 夹具内)
```

真实仓的"脏拒删 → 清干净再删"证据(同一棵 `D:/IHUI-AI-wt-proof-selftest`):

```
# 放一个未跟踪探针后 drop
❌ 拒绝删除:工作区还有未提交内容(staged=0 unstaged=0 untracked=1 conflict=0)
   现场清单(前 1 条,共 1 条):
   ?? probe-untracked.txt
   先提交/迁移或明确放弃这些改动再 drop(本工具绝不 force / clean -f)。
dirty-drop-exit=1

# 删掉探针(自己的实验产物)后再 drop
✅ 已移除 D:/IHUI-AI-wt-proof-selftest
   分支 wt/proof-selftest-20261104-1757-de0b63 已并入 HEAD,已用 git branch -d 删除
clean-drop-exit=0

# 复查:目标目录、登记、分支三样全部不残留
D:/IHUI-AI-git-repo                            b621533999 [main]
D:/DevEnv/Temp/ihui-ratchet-tooth-ef5c6b86     18e045430c (detached HEAD)  # 另一会话在用,与本单无关
D:/IHUI-AI-homefont-wt                         b2de284036 [push-daemon-fanout]
D:/IHUI-AI-mergefix-wt                         a1029c579c (detached HEAD)
# git branch --list 'wt/proof-selftest*' ⇒ 空
```

## 4. 切换建议:什么任务走 worktree

**建议走 worktree**

- B 组脏面敏感的任务(怕自己暂存/别人提交互相污染);
- 要跑全量 331 门 / 全量 turbo / 需要干净 HEAD 做基线验证(**先在该树 `pnpm install`**,新树没有 `node_modules`);
- 多文件重构、跨模块改造、预计要留 WIP 半天以上;
- 需要"一棵树只服务一件事"的验收(从头到尾 HEAD 不被别人推进);
- 改 `scripts/**`、`AGENTS.md` 这类高冲突面。
- 备注:主树本身已被别人改脏(281 主树残量 > 0)时,哪怕单文件小改也建议开树——隔离的是"同一棵树的索引",不是改动大小。

**不必走 worktree**

- 单文件小改(typo、单行修复、只读排查)且主树当下没有正在飞的改动;
- 需要实时看别人未提交半成品才能推进的联调;
- 依赖主树未提交产物(构建缓存、临时数据)的任务——新树不复制这些。

## 5. 迁移到 worktree 后 281 / 44 / 30c 的读数变化

实测基线(2026-11-04,与本单同轮):

| 门 | 读数 | 说明 |
|---|---|---|
| 281 全工作树未提交状态 | **exit 1** | 5 棵树:主树 staged=3 unstaged=72 untracked=75;`ihui-ratchet-tooth` staged=0 unstaged=1 untracked=1;`homefont-wt` 干净;`mergefix-wt` unstaged=2;刚开的证明树 untracked=1 |
| 44 根目录整洁 | **exit 0** | 仓外 worktree 不进一级目录扫描面;仓内 `.worktrees/` 也已在白名单 |
| 30c 陈旧副本 | **exit 0** | 当轮暂存面没有陈旧副本 |

迁移后的预期(能定的写在表里,不能定的标"未判定"):

| 门 | 预期 | 依据 |
|---|---|---|
| 281(`--gate` 档) | 本席把活搬到隔离树且主树收干净 ⇒ **0** | `--gate` 只判**主树残量**,其他树脏只告警 |
| 281(严格档,默认) | **不会自动归零**;等于"在飞且脏的树数" | 严格档统计**全部** worktree;要归零只能收树或提交 |
| 44 | **0 → 0**(不变) | 落点在仓外;若手工落进 `.worktrees/`,该目录已白名单 |
| 30c | **未判定** | 30c 的基线是该树 `merge-base HEAD origin/main`,读数取决于该树自己的暂存面;隔离后不再受主树 18,957 条 staged 的干扰,但具体条数要等该树自己产生暂存后实测 |

一句话:worktree 隔离能保证"**你的脏不是别人的脏**",把 281 的 `--gate` 档从 1 拉回 0;
它不会让严格档的"有人在飞"消失,严格档本来就该红——那是现场事实,不是噪声。

## 6. 四次事故 ↔ 隔离机制对照

| 事故 | 触发条件 | worktree 隔离后的物理差别 |
|---|---|---|
| `99c09c4938` 接手他人未提交工作 | 同一 working tree + 同一 index;提交扫全索引 | 两棵树各自 checkout + 各自 index;别席的未提交文件不在你的树里,你的提交也读不到 |
| `eb9446a768` / `ffda30adcf` 挟带本席在编文件 | 同上:别席 `git add` 写进了唯一索引 | 别席 `git add` 只能写 `<repo>/.git/worktrees/<别席>/index`;本席路径物理上不在那张索引里 |
| `26bc403762` / `67ed343` 消息串号 | `.git/COMMIT_EDITMSG` 是单文件,并发覆盖 | linked worktree 的 `COMMIT_EDITMSG` 在 `<repo>/.git/worktrees/<名>/COMMIT_EDITMSG`(实测),一树一份 |
| 半功能进 main 的 6 分钟 fail-closed 窗口 | 钩子接线被别席提交扫进 HEAD,执行体没进 | 接线/执行体在同一棵树的私有索引里一次提交;别席看不到你未 add 的那一半;`land` 只 ff 主线,不拆分、不重跑钩子 |

前三条不是"判断得更仔细"能防的,它们在"别席提交把本席路径扫进去"的瞬间发生;
worktree 把那个共享入口(repo 工作区 + repo index + repo COMMIT_EDITMSG)拆成了每席一份。
第四条只在**别席的载体提交**成立;如果同一席自己把半成品提交进主线,隔离不负责(见 §8)。

## 7. 并发压测读数(同一夹具,两组各 2 席 × 20 轮)

命令:

```powershell
node scripts/worktree-isolation-stress.mjs --rounds 20
```

夹具几何(两组由同一函数生成、各用一份独立实例,避免第一组污染第二组):
`feature/fix.js`(A 所有)、`i18n/input.js`(B 所有)、`hooks/pre-commit`(接线)、
`hooks/check-half-feature.mjs`(执行体,缺失即 fail-closed);`core.hooksPath=hooks`(相对路径)。

对照组复刻事故做法:`hooks/pre-commit` 先 `git add`(接线先可见),执行体稍后才写;
两席写同一个 `.git/COMMIT_EDITMSG` 后 `git commit -F`,暂存窗口内另一席的 `add` 会被扫走。
隔离组:两棵 worktree,各自 `git add` → `git commit -m … -- 本席路径`,
再 `land` 主线 ff-only;两席 land 用 §1 的跨树互斥锁串行。

逐笔核验(每笔提交都跑 `git diff-tree --name-only -r <sha>`)。两次独立运行、同一夹具:

| 运行 | 席 | 成功/20 | 挟带/成功 | 串号/成功 | 失败分型 | 窗口 |
|---|---|---|---|---|---|---|
| 22:43 | A | 13 | 13/13 | 6/13 | — | — |
| 22:43 | B | 7 | 7/7 | 3/7 | fail-closed 1(B r1) | 1136ms |
| 22:43 | **合计** | **20/40** | **20/20(100%)** | **9/20(45%)** | `lock=19, fail-closed=1` | 1136ms |
| 22:47 | A | 10 | 9/10 | 5/10 | — | — |
| 22:47 | B | 10 | 8/10 | 7/10 | fail-closed 1(B r1) | 793ms |
| 22:47 | **合计** | **20/40** | **17/20(85%)** | **12/20(60%)** | `lock=18, other=1, fail-closed=1` | 793ms |

**口径**(先定分母,再读数,避免"100%"与"17/20"并存):

- 主口径 = **成功提交笔数**:22:43 为 `20/20 = 100%`,22:47 为 `17/20 = 85%`;
- 全样本口径(40 笔,含失败)= 22:43 `20/40 = 50%`、22:47 `17/40 = 42.5%`;
- 任何"100%"只对 22:43 那一笔样本成立,不能推广到本轮所有运行;
- 隔离组两次运行均 **40/40、0 挟带、0 串号、0 fail-closed、40/40 落主线、探针未进主线**。

窗口读数按运行记:22:43 span=**1136ms**,22:47 span=**793ms**(接线可见→执行体落地,
每次恰挡 1 笔,均为 B 第 1 轮)。绝对值随竞态漂移,所以样本量写明(每轮 40 笔),
不把单次读数当固定属性。

| 指标(合计口径) | 共用工作树(对照) | 两棵 worktree(方案) |
|---|---|---|
| 落主线的提交 | 20/20(本就写在 main) | **40/40** |
| 别席未提交探针进主线 | 不适用 | **否(PASS)** |

样本(对照组的真实输出):

```
Ar1 多带 [i18n/input.js] | Br2 多带 [feature/fix.js]
Ar2 想写「stress shared A r02 8e5731」实得「stress shared B r02 8e5731」
Ar11 / Ar13 / Ar14 同型串号(两席同时写同一个 COMMIT_EDITMSG)
```

方法说明(避免误读):

- 对照组**不是**本单推荐用法,只在一次性夹具里复刻事故;消息写入用文件栅栏对齐,
  因为事故当时就是两个会话同时开编辑器写同一个 `COMMIT_EDITMSG`(不是概率碰运气);
- 失败分型里的 `lock`(本次 18 笔)是同一棵树上两条 `git commit` 争 `.git/index.lock` 的真实形态,
  `other`(1 笔)是 `-F` 与并发写窗口撞出的非 lock 失败,都不是夹具 bug;
- 隔离组的 `40/40` 含每轮 `land`;若两席同时 ff 主线,前一版实测会把主树留成
  `M i18n/input.js`(失败那支的半更新),所以 `land` 必须有跨树互斥锁(§1);
- 压测**只在夹具仓**跑 40 笔;真实仓本轮只做了 `list` 与既有 create/drop 的复查,
  没有在真实仓制造 40 笔提交。

### 7.1 混态实测:主树持续脏面 + worktree 改动(交集 / 无交集)

夹具(独立一次性实例):主树 **1 条未提交修改** `a.txt` + **150 个未跟踪文件**
(`git status --porcelain` 把 `sim/` 折叠成一条,展开计数 150);另建 `wt-probe`(提交 `a.txt`)
与 `wt-probe2`(提交 `b.txt`),两棵树的 `land` 都指向同一主树。

| 场景 | land 读数 | 主树侧读数 |
|---|---|---|
| 交集(`a.txt`) | **exit=1 拒绝**,逐条列出:`❌ 拒绝 land:主线有 1 条路径未提交,而本次要更新它们(ff 会覆盖别人的改动):` + `   a.txt` + `共 1 条` | `git status --porcelain -- a.txt` 仍是 ` M a.txt`,内容未被覆盖 |
| 无交集(`b.txt`) | **exit=0,`mode=merge-then-ff`**(先在该树并入主线 `198c7e06`,再主线侧 ff) | `a.txt` 仍是主树脏内容 `main-dirty-a`;`b.txt` 更新为 `v2-from-wt2`;HEAD == 该树 tip |

- 交集 **1/1 拒**、无交集 **1/1 过**;拒的是"路径交集",不是"脏面总量"——152 条脏面里只点名 `a.txt`。
- 量级(估算,非实测):主树脏面 152 条 / 检出 18,998 文件 ⇒ 任意随机单路径命中约
  `152/18,998 ≈ 0.8%`(即约 99% 通过);落在"别人正在改的同族文件"(`hooks/`、`i18n/`、
  `scripts/`)时命中率显著更高,该分布**未做实测**。
- 所以"部分会话仍在主树裸提交"时,worktree 侧 land 的通过率不是固定值:本模拟给出两个端点
  (0% / 100%),随机单路径约 99%,热路径需另测。

## 8. 不能治什么(逐条)

1. **远端推送竞态**:两个会话都 push main,远端 non-fast-forward 仍会互拒;`land` 只解决本地
   ref 前进,不管 fetch/push/远端保护。本单也明确只提交不推送。
2. **共享 refs/objects/config/hooks**:分支命名空间、对象库、`core.hooksPath` 仍是全局的;
   两席都改同名分支会被 git 拒(这是保护),但对象 GC、ref 锁竞争仍会发生。
3. **共享构建缓存**:pnpm store、turbo 缓存、`.next`、`.turbo`、语言服务索引都可能落在共享路径;
   两棵树并发跑全量门会争同一缓存。新树也没有 `node_modules`,要各自 `pnpm install`。
4. **磁盘占用**(实测 2026-11-04 23:08,真实仓):新树 `worktree add` **39,557 ms**(≈39.6s),
   落盘 **18,998 文件 / 925,080,978 B**(≈882.2 MB);既有 `mergefix-wt` 19,025 文件 / 880.5 MB;
   `drop` **33,891 ms**;`.git` 两次测量 `14,425,652,474 → 14,425,712,143 B`(+59,669 B,0.004%,
   含本单提交对象与 worktree admin 元数据),**对象库共享、不随树数复制**;
   每树 admin 目录仅 ~2.27 MB;每树 `pnpm install` 的耗时与 `node_modules` 体积 **无实测**。
5. **IDE 索引**:IDE 可能把每棵树都当项目索引;内存/CPU 占用不会被隔离,反而增多。
6. **同一席自己的半成品**:如果本席把"接线"和"执行体"拆成两笔提交、第二笔还没写就先
   land 第一笔,隔离不会拦;这要靠"一次提交里给全"或门自己的原子性检查。
7. **不接入工具的非协作进程**:别席仍在主树裸 `git commit`/`git add -A`,照样会出事;
   worktree 只保护**进入隔离树并走 land** 的会话。
8. **`AD` 反向暂存(主树内)**:`isolated-git` 在主树不推进共享索引的问题仍在(§2.4);
   worktree 内没有这个跨会话共享面,但主树侧的纪律不能省。
9. **跨树同分支**:git 不允许同一分支在两棵 worktree 同时检出;强行绕过会得到
   `fatal: '<branch>' is already checked out`。这不是缺陷,是边界。
10. **钩子本身失效**:接线在、执行体坏、执行体版本不匹配,隔离不会让门变绿;
    它只保证"你不会把别席的半成品带进主线提交",不保证门自身正确。

## 9. 设为所有会话默认:需要哪些配套(待用户点头,本单未改默认)

本单只交付工具与实测,**没有**修改任何全局默认、AGENTS.md 或 CI。若要默认化,至少需要:

1. **磁盘预算与落点策略**:按仓大小 × 预期并发树数预留;默认落点 `D:\IHUI-AI-wt-<slug>`;
   需要"树池 + 上限 + 超限拒开"的配额,而不是无限开。
2. **`.git` 锁与并发**:`worktree add/remove`、ref 锁、`land` 锁都要有超时/退避;
   残留锁(宿主已死/超龄)清理规则;禁止 `--force` 的兜底要写进默认流程。
3. **清理策略**:脏树拒删(已有);长期未动的树如何判定"可回收"、谁有权回收、
   detached 树如何打 `lost-commit/*` 保活;`worktree prune` 的触发条件。
4. **失败回滚**:`add` 中途失败留下 `locked(initializing)` 半成品时的人工收尾顺序;
   `land` 冲突自动 `merge --abort` 的边界;land 半更新(前一版实测)如何检测与修复。
5. **钩子路径策略**:`core.hooksPath` 用相对路径(每树一份,实测)还是绝对路径(全局共享);
   若钩子会写共享缓存,需要额外的锁或每树缓存。
6. **依赖安装成本**:新树 `pnpm install` 的时间/磁盘;是否接受"每树一份 node_modules",
   还是做共享 store + 硬链接。
7. **可观测性**:`list` 的脏度、land 锁、树龄、owner 标记;门 281 严格档会把"在飞树数"
   算进红面,默认化前要先接受这个读数语义。
8. **用户确认**:以上是成本与策略选择,不是纯技术自动项;确认前不把 worktree 设为默认。

## 10. 未定项

- `scripts/isolated-git.mjs` 在 linked worktree 的叠层缺陷(`commondir` 指到 worktree gitdir
  ⇒ `fatal: not a git repository`;补 `GIT_COMMON_DIR` 后 ref 仍不前进)。本单不改它本体,
  需要另单修并复核 ref 推进;当前 worktree 内用该树自己的 index(§2.3)。
- `30c 陈旧副本` 迁移后的读数:未判定(该门基线依赖各树自己的 `merge-base HEAD origin/main`)。
- 远端 push 竞态与 CI 侧策略:未在本单范围。
- N 棵 worktree 在 Windows 上的实际磁盘/检出耗时上界:未做规模化实测。
- 钩子写共享缓存的冲突:未审计本仓全部钩子是否存在共享写面。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
