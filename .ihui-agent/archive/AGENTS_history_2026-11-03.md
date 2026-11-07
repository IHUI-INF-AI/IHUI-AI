<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 历史片段(2026-11-03 体积清偿移出)

> 来源:`AGENTS.md` 逐字移出(含行首列表符),只为把该文件压到守门 207 的 96,000 字节预算内;现行规则以 `AGENTS.md` 里的指针行为准,本文件不再演进。

## §1 归档机制退役(2026-10-16,留痕原文)

- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「完成即删」——翻勾后整行删除,不留档、不归档、不写占位注释。旧那套两步走连同它的三件器物(自动归档器、13c 那道门、根 package.json 里的 archive 脚本位)已全部从仓里移除,现读 `git ls-files | grep -c archive-completed-tasks` **必须为 0**;若 ≠0,说明退役件(archive-completed-tasks.mjs / check-project-plan-archive.mjs 及各自镜像测试)被当作"本机纯新增在飞件"收编回流(2026-10-21 实测发生过一次,2026-10-29 已按本条清偿),处置 = 删除回流件即可,**不得恢复旧命令**——其活判据出口已迁户到 `scripts/lib/plan-block-partition.mjs`(被 ledger-strip-open-rows 活 import 的 partitionPlanBlocks/resolvePlanBase/resolveRequestedFace 三符号) ⇒ **不得再照旧文去跑那些命令**(§0.8:文档不许写跑不通的出路);历史残余见 `backup/archive-removal-2026-10-16` tag。防误删防线:未勾登记行照旧受守门 71 保护(已勾行不进保护集,删之合法);删行自由不豁免其他守门(130/203/71 未勾半照常判)。

## §12h 2026-10-21 撤装与 2026-10-30 补刀①③④(现场原文)

- 2026-10-21 撤装:自动回收器 reap-worktrees.mjs 与计划任务 IHUI-Worktree-Reap 已卸载;ensure-silent-tasks.mjs 的 ④ 回收链路监视段随之摘除,不得复活。

- 2026-10-30 补刀:该次撤装只删了 VBS、**没注销计划任务** ⇒ IHUI-Worktree-Reap 每 10 分钟拉起 wscript 找不到脚本(不可见模态框)并永久阻塞,状态恒为 Running;已注销任务、结束卡死进程。`ensure-silent-tasks.mjs` 新增**幽灵任务**判据(IHUI 任务 action 的本地目标不存在 ⇒ 违规),杜绝"注册了任务但目标已删"复发。批量回收出口 = `node scripts/agent-worktree.mjs --reap`(默认 dry-run;只收 `.worktrees/` 下干净、已并入 main、非 locked 且超龄的 `wt/*`,独有 HEAD 一律保留)。

- 同日 TEMP 清扫根治(同一次排查发现它**从未成功过**):`scrub-temp-fixtures.mjs` 的 scratch 腿改用独立账龄 `--scratch-older-than-hours`(默认 6h,不再被守护传的 `--older-than 7` 乘 24 抬成 168h),子树判龄与体积并成一次遍历 + 活夹具早退(7 根并集实测 783s → 6.2s);`git-guardian` 侧改为**有结论才写节流戳**、失败 1 小时后重试、超时 300s → 20min(旧配置每轮必 `ETIMEDOUT`,失败又白占 24h ⇒ 事实上从未删过一条)。

- 2026-10-30 补刀③(scratch 腿的第二层"永不删",现读现场为据):单棵子树遍历预算 `NEWEST_WALK_BUDGET` 20000 → **200000** —— `D:\DevEnv\Temp\ihui-scratch` 里 `g1222561-head`(25163 项整仓副本)与 `g1222561-pytest`(38320 项 pytest worker)都超过旧预算,每轮判成"读不到"、结构上永不进候选(与"陈旧副本只增不减"是同一病灶换桶名);**超预算从 `unreadable` 分出独立一档 `overBudget`**(树太大是"没判完",不是"读不动",两态并桶等于静默放弃)。第二条:保护区命中必须**点名**(条目名 + 命中路径 + 体积),且体积必须量到 —— 此前 scratch 腿只报一句"保护区 2"、字节记 0,`交人核` 这条唯一出路是哑的(同 `scan()` 侧 T3 已修过的教训在第三腿漂移);命中即 `continue` 改成"记下命中但继续量体积",它仍整条不进候选。现场处置:上述两条经人工核定为本仓测试产物(命中项只是源码路径 `apps/web/app/(main)/admin/saas/[slug]/backups` 与 pytest 自造的假 `.env`/`.ihui-agent/specs/backups`,无真凭据),已走同一删除出口 `del()` 清除(22726+3381 文件 / 1.13 GB)。接线锁 `scripts/tests/scrub-temp-fixtures.test.mjs` T30(超预算单列 + 预算下限 ≥100000)与 T31(保护区点名与体积)。

- 2026-10-30 补刀④(「worktree 注册表只增不减」的**全部产出点**,逐个封口):病灶是收尾顺序颠倒 —— `git worktree remove --force` 失败(目录被占用 / 含未跟踪件)时注册表条目仍指向活目录 ⇒ 先 `prune` 结构上摘不掉,必须**先让目录真消失、再 prune**。而编辑器 SCM 把 `git worktree list` 每一条都当独立仓 ⇒ 变更数合计成 10K/20K 徽标。已封口 5 处:① `safe-commit.mjs` 三处(基线面 / 他人面 / 他人面建失败回收);② `check-redline-path-naming.mjs` 探针 `cleanup()`(prune 顺带改为以**仓根**为 cwd —— wt 已删时 `-C wt` 连目录都进不去);③ `apps/cli/src/worktree.ts:removeWorktree` linked 分支;④ `apps/cli/src/subagents/worktree.ts:removeWorktree`(含"目录已不在"的早退分支 —— 那条路同样会留下条目;该模块导出的 `pruneWorktrees` 此前**全仓零调用**);⑤ `apps/ai-service/app/services/worktree.py:remove_worktree` fallback 层(其 `prune_worktrees` 的 docstring 声称 WorkerPool 启动时调一次,实际也是零调用)。判据同一条: **任何删掉 worktree 目录的出口,都必须在该出口内补 `git worktree prune`**,不依赖调用方记得。接线锁:`scripts/tests/safe-commit.test.mjs`(prune 必须在 rmScratch 之后)、`scripts/tests/check-redline-path-naming.test.mjs` T9(同序 + cwd 必须是仓根)。

## HEAD 尾部残留冲突标记(原文留痕,2026-11-03 已从活文档清除)

>>>>>>> c970ac616ca6e92d55930349645153bccb53a25d
=======
<<<<<<< cf1fdef9cefd7f616354364c0ea2ccfb869a8dce
