<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# worktree 共享 `node_modules` 急救与迁移（2026-11-07 机主令）

> 来源：`integrate/release-20261106` 分支的 AGENTS.md「12h-补A」整段，2026-11-08 合并时按机主裁决外置——AGENTS.md 有硬体积上限，正文只留一行指路，本文逐字保留原文。

- **12h-补A:worktree 共享 `node_modules` = 一次性急救,重装即回退(2026-11-07 实测,机主令:此类事须事先报)**:本地 linked worktree 的 `node_modules`/`apps/*/node_modules`/`packages/*/node_modules` 多是指向主仓的 **junction**;pnpm 以 realpath 为基准写**相对**符号链接,而 Windows 对相对链接按**访问路径**解析 ⇒ 经 junction 进 worktree 时 `..\..\..` 多退一层,落到 `.worktrees/<wt>/.worktrees/...` 双重目录 ⇒ 断链(`Cannot find module ...\typescript\bin\tsc`)。实测:任一 worktree 跑 `pnpm install --frozen-lockfile` 都会打印 `Recreating D:\IHUI-AI\node_modules` 并把全部链接重写成「相对安装者」的形式;本 worktree 视角的破损数依次为 0 → 100(他席在主仓侧安装)→ 341(空闲 worktree `wt-rn-shell-leg` 安装)。把 761 条链接 + 154 个 `.CMD` 垫片改绝对路径只能保到**下一次任一 install** ⇒ 结论 = **一次性急救,重装即回退**,不得当长期方案;CI 结构上不需要它(全新 checkout 自装,无 junction),CI 继续走原生 `pnpm install`;要长期干净只有两条路:①每个 worktree 先 `rmdir` 各层 `node_modules` junction 再各自 install(各自 real 目录,互不写对方),②全局串行「同一时间只允许一处 install」。
长期方案(2026-11-07 机主拍板,二选一已定)= **每个 worktree 一份自己的 `node_modules`**;**不选**「全局串行 install」——串行只降低频率、没有消除共享可变状态,而且它是一把没有 deadline 的锁。迁移步骤(逐 worktree;本机实测 `4122` 个包、`243s`、`RC=0`,postinstall 全链通过):
① 摘链接:PowerShell 用 `[System.IO.Directory]::Delete("<wt>\node_modules", $false)`(或 `cmd /c rmdir`),对 `packages/*/node_modules`、`apps/*/node_modules` 各层 junction 同样处理——只摘链接、不碰目标内容;摘前先 `Get-Item` 确认 `LinkType` 是 Junction,不是就跳过别删;
② 在该 worktree 目录跑 `pnpm install --frozen-lockfile`;
③ 复跑 `node scripts/check-workspace-dep-links.mjs`,要求 `0 破损 / 0 悬空`(此前 junction 形态下本 worktree 曾读到 341 破损);
④ 抽查 `node apps/web/node_modules/typescript/bin/tsc --version` 与一次 T1 计时。本 worktree 迁移后实测验收:`tsc 5.9.3` 可解析、门 78 = `761 条链接 / 0 破损 / 0 断链`、门 251 三面 `17s / 45s / 30s`(迁移前因被共享层改坏,C10 直接 `Cannot find module 'typescript'` 取面失败)。
⑤ 自包含的可复核判据(别人照抄即可自查,两条同时成立才算):**全仓递归枚举所有实际存在的 `node_modules`,不设深度**(含 `node_modules/.pnpm/**/node_modules` 这类嵌套目录,不许只测三条已知路径)——`$all=@(Get-ChildItem -LiteralPath . -Directory -Recurse -Force -Filter node_modules -ErrorAction SilentlyContinue); $links=@($all | ForEach-Object { $i=Get-Item -LiteralPath $_.FullName -Force; if ($i.LinkType) { $_ } }); "total=$($all.Count) real=$($all.Count-$links.Count) links=$($links.Count)"`,要求 `links=0`(本 worktree 实测 `total=4625 / real=4625 / links=0`;判据必须写 `if ($i.LinkType)`,**不能写 `-ne ''`** —— PowerShell 里 `$null -ne ''` 为真,会把全部 real 目录误计成 link);再 `node scripts/check-workspace-dep-links.mjs` 要求 `0 破损 / 0 悬空`。任一不成立即回落为「仍挂在共享层」,按冻结口径处置,不要在此状态跑全量。
磁盘代价:pnpm store 在 `D:\DevEnv\tools\pnpm\store\v11`(与各 worktree 同卷)⇒ 每份 real `node_modules` 的包体是**硬链接**,新增主要是目录项;实测主仓 `node_modules` 75,512 文件 / 逻辑 0.59 GB,故每个 worktree 增量 ≈ 0.6 GB 逻辑、实际占用以目录元数据为主(数十 MB 级)。
过渡期仍允许「同一时间只允许一处 install」,但它是**过渡手段,不是目标状态**;过渡期内的绝对化急救任何一次 install 都会推回。共享层任何写入(含绝对化 / 重装 / `--force` / 摘 junction)一律**事先报**,不许事后披露。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
