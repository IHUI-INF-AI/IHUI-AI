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

# 收:先查脏,干净才删;有未提交/未跟踪就 exit 1 并列出清单;绝不 force
node scripts/worktree-isolate.mjs drop <slug|绝对路径>

# 列:所有 worktree + staged/unstaged/untracked 计数(与门 281 同一解析实现)
node scripts/worktree-isolate.mjs list
node scripts/worktree-isolate.mjs list --json

# 自检(夹具仓内跑,不碰真实仓)
node scripts/worktree-isolate.mjs --self-test
```

`new` 的可选旗标:`--dest <目录>`(覆盖落点)、`--branch <名>`(覆盖自动分支名)、`--base <ref>`(默认 `HEAD`)。

真实创建输出(2026-11-04 实测,`new proof-selftest`):

```
✅ 已创建隔离工作树
   路径: D:/IHUI-AI-wt-proof-selftest
   分支: wt/proof-selftest-20261104-1757-de0b63
   基线: HEAD (b6215339)
   进入: cd "D:/IHUI-AI-wt-proof-selftest"
         PowerShell: Set-Location -LiteralPath "D:/IHUI-AI-wt-proof-selftest"
   在树内提交: node scripts/isolated-git.mjs commit -m "<标题>" -- <相对路径...>
   收尾: node scripts/worktree-isolate.mjs drop "D:/IHUI-AI-wt-proof-selftest"
```

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
| `config`、`hooks` | `core.hooksPath` 等仓库级配置对每棵树都生效,提交仍跑同一套钩子 |
| **stash** | stash 是全局栈,不是每树一份 ⇒ worktree 内同样**不要 stash** |

### 2.3 推荐用法

- **在隔离树内**:`git add -- <路径>` + `git commit` 已经是安全的(独立 index);
  想沿用同一套肌肉记忆也可以 `node scripts/isolated-git.mjs commit …` ——
  它把 `GIT_INDEX_FILE` 落在该树的 admin 目录,与主树互不影响。
- **在主树内**:继续按 §12i 走 `isolated-git`(自建私有索引 + `immutable-exempt`)。
- 不要把主树的"私有索引"思路当成 worktree 的必要条件:worktree 解决的是**跨会话共享索引**,
  `isolated-git` 解决的是**同一棵树内的钩子回写与残留索引**。两者正交。

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
✅ A 开(干净) | exit=0 path=…/wt-clean branch=wt/clean-20261104-1757-21856a
✅ A 列(2 棵) | trees=2 exit=0
✅ B 脏拒删 | exit=1 ❌ 拒绝删除:工作区还有未提交内容(staged=0 unstaged=1 untracked=1 conflict=0)
✅ B2 干净可删 | exit=0 removed=true branchGone=true
✅ C 路径不存在 | exit=1 ❌ 拒绝删除:…wt-ghost 不存在,也未注册为 worktree
✅ D 同名冲突 | exit=1 ❌ 拒绝创建:目标路径已存在 …wt-dup
✅ E 已占用分支 | exit=1 ❌ 拒绝创建:分支已存在 wt/taken
✅ F 零真实仓足迹 | 真实仓 worktree 数 4→4(本自检未新增真实检出)
self-test: 全绿(8 组断言,全部落在 mkScratch 夹具内)
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
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
