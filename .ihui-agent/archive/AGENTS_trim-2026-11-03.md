# AGENTS.md 体积清偿 2026-11-03 · 被移除原文逐字留档

<<<<<<< cf1fdef9cefd7f616354364c0ea2ccfb869a8dce
=======
>>>>>>> c970ac616ca6e92d55930349645153bccb53a25d
- **本票新增安全门点名(R4 义务,2026-11-01)**:`check-redirect-target-origin-pinned.mjs`(278:第一方回跳落点必须显式交 `allowedOrigins`;豁免=具名台账带到期)、`check-like-wildcard-escape.mjs`(279:LIKE 通配符转义单源 D1 绝对零 + 未转义内插 D2 差值棘轮 + 整值即模式 D3 台账)、`check-pool-isolation.mjs`(号池隔离列;此前已接线未点名,一并补上,免得他人撞同一格 R4)。编号与档位以 runner 现值为准。
- **安全强化新增门点名(R4 义务,2026-11-01 同日三枚)**:`check-redirect-target-origin-pinned.mjs`(278 回跳落点必须交第一方落点集;豁免=具名台账且带到期)、`check-like-wildcard-escape.mjs`(279 LIKE 通配符转义单源 D1 绝对零 + 未转义内插 D2 差值棘轮 + 整值即模式面走 D3 台账)、`check-pool-isolation.mjs`(号池隔离列;此前已接线未点名,一并补上以免他人撞同一格 R4)。档位/编号以本文件与 runner 现值为准。
- **自主能力与开发库哨兵点名(R4 义务,2026-11-01 补)**:`check-autonomy-leg-health.mjs`(自主能力各腿在位/连败封票;判机器状态⇒**刻意不进提交链**§12e,调度=git-guardian 巡检轮,判据 import `auto-evolve.mjs` 的 `quarantineUntilOf`/`failureStreakOf` 零复算,自检 `--self-test`)、`check-dev-db-rotation-window.mjs`(开发库口令轮换窗口对账;同档不进提交链)。两门此前已接线而文档通篇不点名 ⇒ 门 89 R4 判红,这一行就是把那格补上。
- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「完成即删」——翻勾后整行删除,不留档、不归档、不写占位注释。旧那套两步走连同它的三件器物(自动归档器、13c 那道门、根 package.json 里的 archive 脚本位)已全部从仓里移除,现读 `git ls-files | grep -c archive-completed-tasks` **必须为 0**;若 ≠0,说明退役件(archive-completed-tasks.mjs / check-project-plan-archive.mjs 及各自镜像测试)被当作"本机纯新增在飞件"收编回流(2026-10-21 实测发生过一次,2026-10-29 已按本条清偿),处置 = 删除回流件即可,**不得恢复旧命令**——其活判据出口已迁户到 `scripts/lib/plan-block-partition.mjs`(被 ledger-strip-open-rows 活 import 的 partitionPlanBlocks/resolvePlanBase/resolveRequestedFace 三符号) ⇒ **不得再照旧文去跑那些命令**(§0.8:文档不许写跑不通的出路);历史残余见 `backup/archive-removal-2026-10-16` tag。防误删防线:未勾登记行照旧受守门 71 保护(已勾行不进保护集,删之合法);删行自由不豁免其他守门(130/203/71 未勾半照常判)。
