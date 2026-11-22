<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S5 执行席 — delete 轴消费点接线(REA goal-b49)

- 票面:S5 = 把文件 ACL 的 delete 轴判据接到还漏的消费点(`git.ts` / `worktree.ts`)
- 现场 HEAD 现读:`git rev-parse HEAD` = `e557c22648652636498e67f726fe74de1f46291f`(与主席现场一致,收尾再读仍是这一枚)
- 计划动的文件:①`G:/IHUI-AI/apps/cli/src/tools/git.ts` ②`G:/IHUI-AI/apps/cli/src/tools/worktree.ts` ③`G:/IHUI-AI/apps/cli/tests/delete-axis-consumers.test.ts`(新)
- 实际动的文件:②改 31 行(纯增行)③新建 249 行。**①未改** —— 逐点定性的结论是"不该接",理由见第二节,并已用测试把这条定性钉住
- 开工前 `git status --porcelain` 逐文件复核:①②③均为净(无他席在飞);收尾现读 = ` M apps/cli/src/tools/worktree.ts` + `?? apps/cli/tests/delete-axis-consumers.test.ts`

## 一、现场读数(取证口径核正)

票面的计数口径是 `grep -cE "rmSync|unlinkSync"`,该口径把 import 行与注释行一起数了。逐条落到"真删除动作点"后:

| 文件 | 票面计数 | 真 fs 删除点 | 差在哪 |
| --- | --- | --- | --- |
| `apps/cli/src/tools/git.ts` | 2 | **1**(L204 `rmSync(tmpIndex)`) | 另 1 枚是 L16 的 `import { rmSync }` |
| `apps/cli/src/tools/worktree.ts` | 5 | **2**(L239 `remove()` 内 / L342 `cleanupWorktree()` 内) | 另 3 枚是注释(L214/L230/L333) |
| `apps/cli/src/tools/file-batch-edit.ts` | 5(对照样板) | 3 删除腿 + 1 已接裁决 | 未动,只作样板读 |

`git.ts` 的 `update-index --force-remove`(L223)与 `worktree.ts` 的 `worktree prune` / `branch -D` 是 git 索引/注册表动作,不产生 fs 删除,不在本轴射程(登记在此以免下一席重算)。

## 二、落了什么(逐点定性结论表)

| 点 | 位置 | 定性(三问) | 结论 | 依据 |
| --- | --- | --- | --- | --- |
| G-1 | `git.ts:204` `rmSync(tmpIndex,{force:true})` | ② 我方自己造的 scratch | **不接** | 目标 = `join(cwd,'.git','index-scope-<epoch>-<rand>')`,由本行上方 20 行自己铸出;模型入参(`message`/`paths`)一律进不了这个路径。清理在 `finally` 无条件执行 ⇒ 一旦条件化,失败路径把临时索引留在 `.git/` 里(比"删一个受保护文件"更坏)。用测试 ⑥ 钉住"不得被条件化" |
| W-1 | `worktree.ts:239` `fs.rmSync(wtPath,…)`(在 `WorktreeManager.remove` 内) | ① 目标由模型可控入参决定 | **已接** | `wtPath = path.join(this.rootDir, agentId)`,而 `agentId` 有两条外部入参路:`exit_worktree` 的 `name`、`dispatch_subagent` 的 `resumeFrom`(= `subagentId`)。`..` 段可把删除目标折出 `.worktrees/` ⇒ 性质从"回收自己造的隔离区"变成"删任意目录";且既有安全判据(未合并/未提交)量的是注册表解析出的路径,与 `remove()` 自己 join 出的路径在穿越形态下**不是同一个**,护栏拦不住这一腿 |
| W-2 | `worktree.ts:342` `fs.rmSync(wtPath,…)`(在导出的 `cleanupWorktree` 内) | ③ 守护自身收尾腿(兼 ②) | **不接**(已写死定性 + 解锁条件) | 唯一调用方 `background-registry.ts:247` 传的是本进程创建/自身台账恢复的 `task.worktreePath`,外部入参折不出;返回契约 `void` + 整体 try/catch 全吞 ⇒ 在此抛"判拒"会被当"清理失败不阻塞"吃掉,而调用方随后仍把 `task.worktreePath` 置 undefined = 把拒绝写成静默(§0.9/§0.10 反面)。接法要求见代码内注释 |
| 对照 | `file-batch-edit.ts:143` `stashFileToTrash` 一带 | — | 未动,按此样板写 | 拒绝即抛 + advisory 走 stderr + 裁决排在所有 fs 动作之前 |

接线形态(只此一处新增行为):`WorktreeManager.remove` 函数体第一句即 `evaluateFileAccess('delete', toAclPath(this.sourcePath, wtPath), this.sourcePath)`,命拒 ⇒ 抛 `[file-acl …]`;advisory 命中 ⇒ 落 stderr 后放行。**判据一律 import `sandbox/file-access-policy.ts`,本层零复算规则表**(§0.6);档位沿用既有语义(守护面族默认 advisory,`IHUI_FILE_ACL_STRICT=1` 升拦),**未新增环境变量、未新增提交链门**(§12e)。

测试 `apps/cli/tests/delete-axis-consumers.test.ts` 9 例:①正例(合法隔离区真被回收 + 不冒出 file-acl 声)②反例(目录名命中凭据族 ⇒ 拒;`node:fs` 桩计数证"没调 rm 原语"、`git worktree list` 仍在册证"没走注销腿"、回收站根没被建过)②b 工具面(拒绝以 `{success:false,error}` 返回,不是抛穿)③a advisory 默认档出声放行 + 删除照做(**探针非空洞性的正向对照**)③b 严档同族升拦且零动作③c enforce 族不吃档位④未判定态(坏 JSON ⇒ `state='unjudged'`;凭据族照拒 = 不冒绿,合法回收照做 = 不冒红)⑤源码次序锁(裁决排在 `existsSync`/`'worktree','remove'`/`stashDirToTrash`/`fs.rmSync` 之前)⑥定性锁(G-1 的清理留在 `finally`、体内无 `if (` 条件化、不含裁决调用)。

夹具:全程 `mkScratch`/`rmScratch`(`scripts/lib/scratch-dir.mjs`),git 夹具落在 `DevEnv/Temp/ihui-scratch`,不在仓库树内(门 208 射程外);`vi.spyOn(fs,'rmSync')` 本机实测不可用(`Module namespace is not configurable in ESM`),改按本仓既有写法桩 `node:fs`(与 `worktree-session-tools.test.ts` 桩 `node:child_process` 同法),**记账后透传真实现**。

超越轴(本票做到的那条):对方(Qoder/Trae/WorkBuddy 取证面)只在 read/write 有闸、delete 维漏;我方 `14e02e57` 已把"每条 read deny 必须同管 delete"钉成穷尽性判据,本票再把**消费点**逐点接满且每点可测(拒 ⇒ 零副作用可证)——同一能力从"表里有这一维"覆盖到"真执行面走这一维"。

## 三、验证末行现读

```
$ cd apps/cli && npx vitest run tests/delete-axis-consumers.test.ts
 ✓ tests/delete-axis-consumers.test.ts (9 tests) 2668ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  11.36s (transform 7.55s, setup 0ms, import 8.54s, tests 2.67s, environment 0ms)

$ npx vitest run tests/delete-axis-consumers.test.ts tests/file-access-delete.test.ts tests/file-access-policy.test.ts \
    tests/worktree.test.ts tests/worktree-session-tools.test.ts tests/git.test.ts tests/git-scope-commit.test.ts \
    tests/g-706-failure-radius-worktree.test.ts tests/delete-guard.test.ts
 ✓ tests/worktree.test.ts (54 tests) 38927ms
 Test Files  9 passed (9)
      Tests  139 passed (139)
   Duration  79.24s (transform 64.91s, setup 0ms, import 63.09s, tests 172.60s, environment 1ms)
   —— 本轮是**删行收紧到 249 行之后**重跑的(07:55:46 起),故与上面单册读数的 Duration 不同;9 册全绿两次。

$ npx tsc --noEmit -p apps/cli/tsconfig.json
apps/cli/src/commands/skill-package.ts(33,8): error TS2307: Cannot find module '../skills/packaging/index.js' …
(共 7 条,全部在 skill-package.ts 一个文件:1×TS2307 + 1×TS7006 + 5×TS18046)
—— 他席在飞(票面已证环境事实:该文件 import 被别席暂存删除的模块),不代修;我触及面(src/tools/worktree.ts)零错误。
   注:apps/cli/tsconfig.json 的 include 只有 src,tests 被 exclude ⇒ 新测试文件不在本把尺射程内。

$ node scripts/watermark.mjs verify apps/cli/tests/delete-axis-consumers.test.ts
[watermark:verify] 判定面=worktree(显式点名=工作树) 覆盖 1/1 个指定文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 仅隐写(有载荷但可见横幅缺失或已损坏) 0 个, 跳过 0 个, 台账登记的第三方内容不计入 0 个, 上游工具生成物不计入 0 个
$ node scripts/watermark.mjs verify apps/cli/src/tools/worktree.ts
[watermark:verify] 判定面=worktree(显式点名=工作树) 覆盖 1/1 个指定文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 仅隐写(有载荷但可见横幅缺失或已损坏) 0 个, 跳过 0 个, 台账登记的第三方内容不计入 0 个, 上游工具生成物不计入 0 个

$ npx prettier --check apps/cli/tests/delete-axis-consumers.test.ts
All matched files use Prettier code style!
```

## 四、未竟(逐条带解锁条件)

1. **`apps/cli/src/subagents/worktree.ts` 的 3 枚 `fs.rmSync`(L256 marker / L353 dir / L468 destination)未定性也未接** —— 其中 `removeWorktree`(L199)是子代理路径的删除出口,与 W-1 同族。解锁:它不在本票可改清单(票面只列 `git.ts`/`worktree.ts`),需主席扩票面或另派一席;`removeIsolatedWorktree` 的非 manager 臂正是走到这里。
2. **`evaluateFileAccess` 不把守护面清单的 `unjudged` 透出给消费点** ⇒ 清单坏掉时"守护面族为空"这一事实对消费点不可见(测试 ④ 只钉住了"凭据族照旧拦"那一半)。正解要么让 `evaluateFileAccess` 返回 guard 三态、要么让消费点对 unjudged 主动要一次定向说明(§0.3),两者都要动 `apps/cli/src/sandbox/**` = 判据面(本席禁改,且按 §"改判据面一律带豁免 trailer"只能由持钥方结清)。解锁:主席改判据层后本席(或下一席)补消费点那一臂 + 测试 ④ 的第二向。
3. **W-2(`cleanupWorktree`)的接闸前置**未做:需先把它改出"可传拒"的返回形态,并同步 `background-registry.ts:247`(现在无论成败都把 `task.worktreePath` 置 undefined)。解锁:同文件跨两席,须主席定谁动;`worktree.ts` 注释里已写明"两条齐备再接"。
4. **`.worktrees/**` 族目前在规则表里无任何条目** ⇒ 整棵隔离区的删除只在命中凭据/守护族时才被问;若要"删整个隔离区也要一次定向说明",得在判据层新增一族(advisory 起,§12e 不进提交链)。解锁:同 2,属判据面改动。
5. **落地**:按票面禁令本席未 commit / 未 push、未动 `PROJECT_PLAN.md` / `AGENTS.md` / `scripts/**`。两枚改动(`worktree.ts` +31 行、新测试 249 行)现停在**工作树未暂存**态 ⇒ 非可交付终态,待主席按 `safe-commit`/`object-space-land` 落地并跑提交链。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
