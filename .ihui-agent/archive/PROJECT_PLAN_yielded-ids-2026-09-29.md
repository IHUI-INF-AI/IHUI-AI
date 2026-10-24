<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 让号处置摘掉的登记行逐字留档(2026-09-29)

> 这不是新记录,而是**处置凭据**:台账面 `PROJECT_PLAN.md` 里这些行曾因为两台机同时取号
> 而撞号(同一编号两个标题)。让号 = 台账里那一行的行首编号必须消失,而守门 71 的自愈层
> 把"编号标记整行消失"判成被旧基线抹掉并自动回捞 —— 于是没有本文件的留档时,让号会被反复撤销
> (实测 2026-09-29 一夜三次)。本文件的存在就是 71 的那条放行出口:
> 「原文能在 `.ihui-agent/archive/PROJECT_PLAN_*.md` 找到 ⇒ 不算丢」。
> 内容一律 `git show <被审面>:PROJECT_PLAN.md` 逐字取,不做任何改写。

---

- [x] ✅(2026-09-29) G-815404 **生产 API 崩溃循环 2 小时 39 分的根因不是"服务侧没实现",而是"实现被写进了错名文件"** —— 现象:IHUI-API 反复启动即死而 nssm 一直显示 Running(那只是拉活循环),公网 `/api/health` 500、`api.aizhs.top` 502、本地 8802 无监听。现读(Loki `{job="api"}`):同一条模块解析错 777 次,首 22:17:49 / 末 00:57:11(本机 UTC 偏移 0h),无 >5 分钟中断 ⇒ 约每 12 秒被 nssm 拉活一次;监控侧最后一条同身份抑制行落在 01:01:58,当前 API 进程启动于 01:18:03;stderr 原文只说 `v1-public.ts import { acquireUserConcurrencyForResponse } from '../services/user-concurrency-service.js'` "does not provide an export named …"。真因:G-727 那 13KB 服务侧实现躺在 `apps/api/src/services/user-concurrency-service.js` 且**已被 git 跟踪**,而正文是 TypeScript(泛型 `new Map<string, number>`)。本仓 ESM 一律用 `...js` 说明符 import `.ts`,平时由加载器把 `.js` 映射到 `.ts`;一旦真存在同名 `.js`,它优先命中 ⇒ `.ts` 被整个架空,而这份 `.js` 按 JS 解析必然语法错 —— 同一个文件名下同时发生"影子"与"语法错"两件事,而报错信息只说"没有那个导出",把人往"作者忘了写服务侧"的方向带(我第一遍就被带偏,重写了一份 `.ts`,已作废未入库)。落地枚 `6bf657df86`:内容平移 + 删错名文件,业务逻辑一行未改,新 `.ts` 与 `git show HEAD:<那个 .js>` 逐字节同形(删除不丢任何内容;旧 `.ts` 的导出集是新面的真子集,亦无丢失)。覆盖面现读:`.ihui-agent/tmp/g727/scan-shadow.cjs` 扫 `apps/ + packages/ + sdks/` 共 8371 个源文件 ⇒ 按 `.js` 说明符解析到**被跟踪 .js** 的站点 0 处、被跟踪 `.js` 与同名 `.ts` 并存在库 0 对,即这一型不是系统性问题、且已全清。**这一型为什么能活着进 HEAD**:契约测试 `apps/api/tests/user-concurrency-leak.test.ts`(270 行,写的全是 `.ts` 侧语义)一直是红的,而提交链 150+ 道门**没有一道跑测试**(守门 114 只判"能不能收集",不判"过不过"),所以崩到线上无人知。取证:该测试 13/13、连同 `v1-latency-persistence` 与 ai-feed 去重共 3 文件 41 例全过;`pnpm --filter @ihui/api typecheck` RC=0;服务恢复后 8802→200、`https://api.aizhs.top/api/health`→200、`https://aizhs.top/api/health`→200、`https://aizhs.top/`→200。落地过程本身留下一格值得记:共享索引被别的会话的 safe-commit Step1 清空 + 工作区自愈层每 2 分钟把 HEAD 里还跟踪着的 `.js` 还原回磁盘,两者合起来让"只删不提交"必然失败(实测 15 次没抢到窗口,如实报未判定),正解是把"删 .js"与"落 .ts"放进**同一枚提交**(`.ihui-agent/tmp/land-g727.sh`;HEAD 里没有它以后,自愈层结构上不再还原)。
- [x] ✅(2026-09-29) G-815405 **上一条能持续 2 小时 39 分无人知道,是我自己上一轮引入的缺陷:按"预期现象"抑制告警却没有终态** —— 09-28 我在 `deploy/win/ihui-monitor.ps1` 的 `Send-Alert` 加"部署重启中-预期现象 ⇒ 只记日志不寄信"以治那 30+ 封换流窗口噪声邮件,当时只写了"这一轮不寄",没写"最多不寄多久"。而诊断的两个触发条件(`.deploy.lock` 在 / 最近 15 分钟内有构建)在"部署环被挡住、每 ~90 秒重跑一轮"这种状态下会**一直成立**("最近构建"每轮都被刷新),于是抑制变成永久豁免 —— 永久豁免的症状就是安静,与去重那侧"读不懂就静默当已寄过"是同一条禁令。修法落在共享模块 `deploy/win/alert-dedup.ps1` 的 `Test-AlertSuppressionGrace`(按身份计时,与按身份去重共用一份状态档案但键带 `grace:` 前缀,两把账互不顶),四态各自成立:`grace-window`(窗内抑制,理由必须带已累计分钟)/ `grace-reopened`(同身份已断满一个窗口 ⇒ 视为新一轮重新起锚 —— 不这样修就造出新假阳:上周一次部署留下的旧锚会让今天正常的 3 分钟换流在第一轮就直接寄信)/ `escalated`(连续超 `IHUI_MONITOR_EXPECTED_WINDOW_GRACE_MIN`,默认 20 分钟 = 4 轮巡检 ⇒ 落回正常发信路径并在正文点名"为什么这轮不再抑制")/ `undetermined`(档案读不懂或时刻解析不出 ⇒ **不抑制**,宁可多喊一次)。顺带修一处一直存在的写法错误:日志行的 `-replace '`n'` 用**单引号**,PowerShell 下那是字面的反引号+n 而不是换行符,所以"一条告警一行日志"只在诊断单行时成立 —— 我新增的超期说明带换行,第一次让这一格现形。取证:镜像 `scripts/tests/deploy-alert-dedup.test.mjs` 13/13(T9-T13 逐分支 + T14 反向源码锁:监控侧不得再回到无条件 return、必须真调用到期出口、宽限分钟必须可由 env 覆写);两条变异各自实测翻红(把到期判据短路 ⇒ T10 红"到期仍在抑制";把监控分支改回无条件 return ⇒ T14 红),还原后两个 `.ps1` 的 sha1 与变异前逐字相同;端到端跑**入库真身**(dot-source,状态与日志指到项目内 scratch、`-DryRun` 不真发信)—— 第 1/2 轮抑制并打出累计分钟,把锚点改到 25 分钟后第 3 轮落回发信路径,一条 `[ALERT]` 行内同时含"预期现象"与"[预期窗口已超期]";三个 `.ps1` 过 `[Parser]::ParseFile` 零语法错;IHUI-MONITOR 已重启并在 01:34:49 跑完一轮(改文件不重启 = 线上仍跑旧逻辑)。落地枚 `844bbf99d1`(走完整 pre-commit 链,未用 `--no-verify`)。
- [ ] G-815406 **把"错名 `.js` 影子架空 `.ts` 说明符映射"这一型从散文规矩收成尺子**(归属:守门 98 `scripts/check-dangling-local-imports.mjs` 持有人;本会话按用户决定不顺手改别人的门)—— 上面第二笔那起生产事故的直接载体就是这个影子文件,它进了 HEAD、过了 150+ 道门、崩到线上才被看见。现读覆盖面为 **0**(8371 源文件里 0 处说明符解析到被跟踪 `.js`、0 对 `.js`/`.ts` 同名并存),所以**扩这一维不新增任何恒红面**,前置已经满足;倾向的做法是并进守门 98 的相对说明符解析维(它已经在解析 `./x.js`→`x.ts`),而不是新立一门(新门要动 `guardian-runner`/README/AGENTS 三张共享注册表,而这三张正是并发覆盖事故点)。判据要同时认两型才算有牙:① 同名 `.js` 与 `.ts` 并存 ⇒ 说明符按加载器优先级命中 `.js`;② 该 `.js` 正文含 TS 语法(泛型/类型标注/`interface`)⇒ 命中即必炸。反假绿两条:扫到 0 个候选判死不记绿;阳性对照拿枚带影子的历史 blob 喂同一判据(参照上一条里 `6bf657df86^` 的那份现成材料)。取证出口:`--self-test` 成对正反例 + §22c 镜像;紧急跳过变量随条目声明。
- [ ] G-815407 **生产服务的实际入口(3 个 `deploy/prod-bundle/svc/run-*.ps1`)不在版本库里,而唯一看得见它的判据只报数不判红** —— 现读(2026-09-29,`nssm get IHUI-API AppParameters`):`IHUI-API` 跑的是 `D:\IHUI-AI\deploy\prod-bundle\svc\run-api.ps1`,该目录整目录被 `.gitignore` 忽略,`git ls-files deploy/prod-bundle` 零命中 ⇒ 这 207 行(含 PostgreSQL readiness 前置轮询、`SWAGGER_API_KEY` 读取、PATH 注入、上界推导)**没有任何提交链判据、没有 review、没有历史**。这正是 AGENTS §5e 写过的那一型("落进 `deploy/prod-bundle/` 的运维脚本必须同时落一份入库源,否则等于写进盲区"),而 `scripts/check-prod-bundle-shadow.mjs` 的 E1 对未登记项**刻意只报数不判红**(该目录只存在于部署机,当场判红就是恒红门,§12e),所以这一格的存在形态是"账面全绿"。存量清单(现读):`run-api.ps1` 207 行 / `run-web.ps1` 45 行 / `run-ai.ps1` 15 行,合计 267 行运行态真身。收口办法与 `monitor.ps1` 同法(入库源 + 三行转发壳,路径不变 ⇒ **不需要动 nssm、不需要重启服务**):`deploy/win/` 落真身、`prod-bundle/svc/run-*.ps1` 换成转发壳,然后把三对加进 `check-prod-bundle-shadow.mjs` 的 `PAIRS`,由 S0–S3 逐字节等值接管。三条前置,缺一条就别动:① `run-api.ps1` 内有 **1 处 `$PSScriptRoot`**,搬家会改它的解析基准(必须先定位那一处并改成显式仓库根);② 转发壳必须 `& $source @args` 且透传 `$LASTEXITCODE`(monitor.ps1 那处的既有教训);③ 收编后必须实测**下一次服务重启**能正常起来 —— 而此刻部署环因远端分叉已冻结 120+ 轮(`BLOCKED-DIVERGED`),服务不会被自动重启,所以这一票真正安全的落地时机是"分叉裁决完、部署环恢复切流之后",不是现在。**归属:分叉裁决完成后接下一班运维**;本票只登记,不在冻结窗口里动生产入口。

---

## 让号留痕(补记 @2026-09-29,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-937950 → G-957953(键位前沿 937953 + 跳距 20000,试 1 枚)
  - [x] ✅(2026-09-29) **G-937950 解掉"防丢 commit 门"红在干净 HEAD 这一格(它红着的每一分钟=这台机每次提交都被逼跳门),并交接三条量到的事实** —— ① **现象与处置**:全量守门审计现读 `check-commit-loss-guard`(提交链第 30a 项,blocking)在**干净 HEAD**上判红,理由是一条**不可达提交** `e67949dcfd`(09-29 07:31Z 那枚"登记 CI Ruff 只量不清决定")没有 tag 备份。按 §12f 那条优先级(与本次改动无关的恒红门 ⇒ 每次提交都被逼 `--no-verify` ⇒ 链上全部检查对每次提交作废),先处理它:给它打 `lost-commit/wip-e67949dcf` 并 `git pack-refs --all --prune` 固化(松散嵌套 tag 会被宿主清理层删掉,不 pack 等于下次再红,AGENTS §5b 同一条),复跑该门 **RC=0**。**内容有没有丢**:逐行验过 —— 该提交只动 `PROJECT_PLAN.md` 4 行,其中被当成"可能消失"的那一条(`为什么这次不落 52 条自动修复`)在**当次 HEAD 里逐字仍在**(是被一次改写搬了位置,不是丢失),所以本次只打 tag 保物证、**没有**做任何回补。② **量到一个设计缺口(交该门持有人,不由本票代裁)**:AGENTS §29 写着"绝大多数 lost-commit tag 来自 `check-commit-loss-guard.mjs` 自动 fsck 检测后批量打 tag",而**现读实现里没有任何创建 tag 的代码路径**(全文只有 `tag -l` 读取与一句"若需保留:git tag …"的建议文字)—— 即"自动备份"这半句在当前代码上不成立,后果是**每出现一枚悬空提交,提交链就红一次**,出路只剩"人补 tag"或"跳门"两种,而后者代价是全部检查作废。**判它是不是要修,依据是"这台机每天产生多少枚不可达提交"**,不是"看起来应该自动一点"。③ **main 的 CI 连红约 30.4 小时(427 轮连续失败,上一枚绿是 09-28 04:21Z),但当前失败项已经不由我修**:失败步骤是 `CI / lint-typecheck-test (push)` 作业里的"Provenance watermark check",点名两个新文件没注水印;而我在**当次 HEAD** 复跑 `node scripts/watermark.mjs verify` 读到 **11991/11991、残迹 0、载荷损坏 0、仅隐写 0、RC=0**,同两个文件的 HEAD blob 里横幅三行齐备 ⇒ **对侧已修**,**没有按旧账面去"修一个已经好了的东西"(这条纪律本身就是本仓记过多次的自伤型)**。另一条红的 `ai-service-schema-check` 不是必需检查,不挡 PR 通道。④ **日志回收:量到 168 份轮转副本 / 984.9 MB 可回收,判定不删,理由写在这里而不是"保守"**:该目录所在 D 盘当次实读**可用 437.76 GB(总 731.2 GB,已用 40%)⇒ 没有容量压力**;而这些轮转副本对多数服务是**唯一 surviving 的错误历史**(promtail 不采这些文件,删了就没有任何地方能再查那次报错),而且 `--apply` 需要越过大批量阀(40 份 / 512 MB),AGENTS 与本仓记忆都明令"不得为了把目录清小去调那两个参数"。**为腾出并不需要的空间销毁唯一证据,是净损失而不是清理** —— 这条判断留给下一个人,免得他看到"984.9 MB 可回收"就以为欠着活。取证:`node scripts/prune-rotated-nssm-logs.mjs`(缺省只读)与 `node scripts/c-disk-breakdown.mjs --root D:/`(卷口径,不用 df)当次现读,数字一律按当次重取。

---

## 让号留痕(补记 @2026-09-29,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-937951 → G-977953(键位前沿 957953 + 跳距 20000,试 1 枚)
  - [ ] **G-937951 台账脏号的真实边界:232 行畸形号一行都不能机械修、112 组撞号两侧都已发布 —— 需要的是逐组裁决,交台账判据持有人(这一票等的就是这个裁决,不是环境条件,也不是别的会话)** —— 本轮把这件事量到底,结论是"不能批量做",数字与判据都现读可得,不必重新推导:① **畸形号 232 行**(族 G 223 / D 8 / O 1),但它们只收敛到 **32 个"修好后应该变成"的目标号**;把台账那一份规划器 `planMalformedStrip`(`scripts/lib/plan-task-index.mjs`,注意**它已经存在且就是判据自己的规划器,不要再写第二把尺子**)喂满 232 行,输出 **approved 0 / refused 232**,拒因全部是同一条:**目标号已被另一行占用**。换个更宽的问法也一样:按"编号+标题"整对查,可自由落位的 **0 个**,会撞上同名副本(产 F4 孪生、不新增 F9)**161 行**,会撞上不同标题(直接加入/新增 F9 组)**71 行**。② **F9 撞号 112 组**(`node scripts/plan-tasks.mjs --gate`,注意**不带 `--json` 那一档才有退出码**,`--gate --json` 恒 0 —— 已被这一格骗过一次并登记在案),逐组判"哪一侧未发布"的结果是 **112/112 两侧都已发布**(本机 HEAD ⊆ 已推远端 tip,用 `merge-base --is-ancestor` 验,不是猜),即**没有任何一侧可以按"只改未发布那一侧"的纪律让号而不动到已发布的历史**;让号器 `scripts/plan-collide-renumber.mjs` 也要求合并时刻的 `--theirs` 才能安全作业,现在没有待合的撞号场景。③ **所以正确的下一步不是"清一次"**:那 71 行是**让号的输入清单**(等下一个真分叉时刻由让号器消费),那 161 行是 F4/F6 的**折叠副本**问题而不是编号问题;唯一的增量刹车是 `live-doc-edit.mjs` 的**生产者侧守卫**(拒绝落地新增畸形号,本轮它确实拒了我一次并点名成因)。**等谁:台账判据持有人**拍板"112 组已发布撞号要不要长期作为存量只报数(现状就是这样,落地闸按差值棘轮不拦它),还是要一组一组人工裁决标题归属";在此之前**批量改号 = 篡改已发布历史,禁止**。数字一律现读,不得引用本行派单。

---

## 让号留痕(补记 @2026-09-30,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-978068 → G-998069(键位前沿 978069 + 跳距 20000,试 1 枚)
  - [x] ✅(2026-09-30) G-978068 **门 118「清单与内容同面」的自犯缺陷已修 —— HEAD 面 `无法判定` 归零** —— 全量档的门清单此前取 `git ls-files`(**索引**)而内容取 `HEAD:<path>`,于是任何人一次 `git add` 一份新门脚本(尚未提交)就让本门在 HEAD 档必然得到 `取不到 ⇒ exit 2 无法判定`,即一台与提交者无关的恒未判定门(§12e;`exit 2` 在提交链里与判红同罪)。现清单与内容同面:全量档 `ls-tree -r --name-only -z HEAD`、`--staged` 仍 `diff --cached` ⊕ 索引 blob。"已 staged 未入库"的门脚本单列 `在飞未入库 N` 逐条报名(不判红、不参与退出码,也不读成"这一格不存在" —— 本次现场就是 `scripts/check-merge-deletion-resurrection.mjs`,归他人)。**取证**:自检 71→**75 例**通过(新增 F11–F15:清单命令形状两档各一条 + pending 三态三条),**变异对照** = 把 `listArgsFor('head')` 退回 `ls-files` ⇒ 自检 rc 0→1(现跑实测,证明新例有牙不是记账);真仓 HEAD 面 `exit 2 / 取不到 1` → **exit 0 / 取不到 0 / 在飞未入库 1**,`--staged` 面 rc 0(经取材层 7 / 其余四态 0),镜像 `node --test scripts/tests/check-gate-face-discipline.test.mjs` rc 0。**未做**:本门仍在 HEAD 档对"在飞"只报名而不判红 —— 那是刻意(判红等于替别人挡路);他人那份新门入库后是否自带同面取材,归其持有人复验,本票不代裁。

---

## 让号留痕(补记 @2026-10-01,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-978121 → G-1018190(键位前沿 998190 + 跳距 20000,试 1 枚)
  - [ ] G-978121 21 个 IHUI 服务**全部没有 SCM 恢复动作**(现读 `FailureActions` 键不存在;`IHUI-PG-BACKUP` 已逐条验):进程异常退出后端不会自愈,而"备份/监控服务静默停摆"正是本仓记过两次的失效形态(RSSHub 停 3 天无人知、部署环冻结 11h50m)。加 `sc failure ... actions= restart/60000/…` 属**服务恢复策略**,且改的是 21 个在跑服务的机器状态 ⇒ 等机主拍板(哪些服务该自动重启、哪些宁可停着等人工),不得由会话逐个代决。

---

## 让号留痕(补记 @2026-10-02,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-1018220 → G-1038307(键位前沿 1018307 + 跳距 20000,试 1 枚)
  - [ ] G-1018220. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「68 · 流式中切换模型→终止后自动带入新模型」,派单以那条为准,本行不再单独派单。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕

---

## 让号留痕(补记 @2026-10-02,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-1038313 → G-1058502(键位前沿 1038502 + 跳距 20000,试 1 枚)
  - [x] ✅(2026-09-29) （【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）**G-1038313. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） (原编号 G-312;持有行题面「门8清账后遗留的三枚"有消费方的待实装路由"」) ✅(2026-09-29) **[归并·F1]** 本行与一条已闭环登记同复合主键 `G-312`(§1 规矩 2:一个编号只能有一行当前状态)⇒ 只落状态、写明归并到谁,**不删行、正文一字未改**;本票进度以主件那行为准。 〔让号记录(2026-10-03 F9 清偿批③·逐组裁决):原号 G-312 同号多题,按交接票 G-1018210 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
- 编号 G-1038314 → G-1058503(键位前沿 1038502 + 跳距 20000,试 2 枚)
  - [x] ✅(2026-09-29) 〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行;指针里既不写编号也不写行号 —— 写了编号就会被台账取成这条副本自己的主键,折叠反而新增撞号,这是今天实测到的成因)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-1038314. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） (原编号 G-312) （[归并] 本行与已完成登记同题(主键 「G-312 · 门8清账后遗留的三枚"有消费方的待实装路由"」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账） 〔让号记录(2026-10-03 F9 清偿批③·逐组裁决):原号 G-312 同号多题,按交接票 G-1018210 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
- 编号 G-1038315 → G-1058504(键位前沿 1038502 + 跳距 20000,试 3 枚)
  - [x] ✅(2026-09-29) 〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的持有行是同一件事,持有行是「门 8 清账后遗留的三枚"有消费方的待实装路由"…」那一条待办(按标题前缀寻行 —— 指针里既不写编号也不写行号:编号落在正文前 48 字符内会被台账取成本行的主键,折叠反而新增撞号)。本行摘掉编号、只留指针,不翻勾、不并抄、正文逐字保留。〕 **G-1038315. 门 8 清账后遗留的三枚"有消费方的待实装路由"(2026-09-28 登记,现读=基线仅剩 3 处)**:① `GET /api/subagents/all` —— 消费者 `apps/web/app/(main)/agent-teams/page.tsx:58`(期望 `{dispatches}` 含 completed/failed/cancelled 全量);后端只有 `/subagents/active`(仅 pending/running,形状恰好相同但语义是子集,**不得**为省事把客户端改道 active —— 那会把"页面少了历史"写成"已修")。正解 = 在 `subagent-dispatch.ts` 补 all 列表路由(带 status/limit 透传)。②③ `PUT /api/ai/n8n/workflows/:id` 与 `POST .../toggle` —— 消费者 `apps/mobile-rn/src/screens/N8nModelScreen.tsx:146/192`(保存改名/启停今天必 404);后端 n8n 面只有列表透传与创建转发(miniapp-compat-routes.ts:1123/1190),n8n REST API 本身支持 workflows/:id 更新与 activate/deactivate,正解 = 在 n8n 代理补两枚透传(SSRF 校验与 env 缺省回 stub 的既有纪律照抄)。验收判据:两枚消费者页面真机/真会话各跑一次成功路径 + 基线 `scripts/api-routes-baseline.json` 清零 + 门 8 末行现读 0。**归属**:subagent 面 = agent-teams 线;n8n 两面 = n8n 代理持有人(本票只登记形状与消费者证据,不代裁实现位置)。 〔落地@2026-09-28/枚 2704c4d27〕三枚路由已入库:subagents/all(新→旧+status/limit)、/ai/n8n/workflows 面四枚(list stub/写 503/fetch-merge-put/toggle 回读真值);apps/api/tests/g299-new-routes.test.ts 4 例绿、门 8 死调用清零、基线 perFileCount 清表。**本票未翻勾的唯一理由=验收判据第一条未跑**:RN N8nModelScreen 真机走查(本机无设备)与 agent-teams 页真会话 200 取证(需起栈)——路由与契约已证,运行时成功路径待验,不得以单测冒充真机。（编号改派留痕:本行原登记为「G-299. 门 8 清账后遗留的三枚…」,与「本机交付被远端分支保护拒收」撞成一号两事;2026-09-28 由 live-doc-edit 的取号令牌在每次 CAS 里按当下 HEAD 现算改派为 G-312,旧编号在此留原文,便于任何按旧号引用的人查得到去向,而不是让它静默消失） (原编号 G-312) （[归并] 本行与已完成登记同题(主键 「G-312 · 门8清账后遗留的三枚"有消费方的待实装路由"」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账） 〔让号记录(2026-10-03 F9 清偿批③·逐组裁决):原号 G-312 同号多题,按交接票 G-1018210 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕
- 编号 G-1038310 → G-1058505(键位前沿 1038502 + 跳距 20000,试 4 枚)
  - [x] ✅(2026-09-28) G-1038310 **本机交付被远端分支保护拒收——所有已提交内容现在只在这台机上,远端收不下**（**等机主拍板**,agent 不代做也不该代做:改的是 GitHub 仓库安全设置）。实测:枚 `5af500724b` 之后 push 仍被拒,`https://api.github.com/repos/IHUI-INF-AI/IHUI-AI/branches/main/protection` 现读 `required_status_checks.contexts=["CI / lint-typecheck-test (pull_request)"]` ∧ `enforce_admins:true` ⇒ **直推 main 永远产不出 pull_request 上下文的检查**,任何凭据都推不上去(与凭据无关;凭据那条另已由 5af500724b 收口,`credentials-unavailable` 分诊在 HEAD 里)。现读积压以 `git rev-list --count origin/main..HEAD` 末行为准(本批结束时仍在涨),`.workbuddy/git-push-guard-async.log` 今日 `protected branch hook declined` 70 次;Gitee/GitCode 镜像因此连带停更(凭据巡检现读 `mirror-to-cn` 已判 fail、落后超阈值)。**两条出路**:① 仓库 Settings→Branches→main 放开直接推送(本仓 §9b 是单分支直推模型,与"必须 PR + 必需状态检查"天然冲突);② 或正式改走 PR 通道(那要把 §16/§20"commit 即推送"的交付语义整条重写,属流程决策)。**在此之前任何"已推送/已交付"的结论都不成立**,`git log origin/main..HEAD` 的枚数就是真实积压。 （[归并] 本行与已完成登记同题(主键 「G-299 · 本机交付被远端分支保护拒收——所有已提交内容现在」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账） 〔让号记录(2026-10-03 F9 清偿批③·逐组裁决):原号 G-299 同号多题,按交接票 G-1018210 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。本键持有族(门8清账三路由)系后绑定者,按最大纯登记族规则持有;时间线倒挂属分叉取号竞态,非抢号。〕
- 编号 G-1038311 → G-1058506(键位前沿 1038502 + 跳距 20000,试 5 枚)
  - [x] ✅(2026-09-28) G-1038311 **本机交付被远端分支保护拒收——所有已提交内容现在只在这台机上,远端收不下**（**等机主拍板**,agent 不代做也不该代做:改的是 GitHub 仓库安全设置）。实测:枚 `5af500724b` 之后 push 仍被拒,`https://api.github.com/repos/IHUI-INF-AI/IHUI-AI/branches/main/protection` 现读 `required_status_checks.contexts=["CI / lint-typecheck-test (pull_request)"]` ∧ `enforce_admins:true` ⇒ **直推 main 永远产不出 pull_request 上下文的检查**,任何凭据都推不上去(与凭据无关;凭据那条另已由 5af500724b 收口,`credentials-unavailable` 分诊在 HEAD 里)。现读积压以 `git rev-list --count origin/main..HEAD` 末行为准(本批结束时仍在涨),`.workbuddy/git-push-guard-async.log` 今日 `protected branch hook declined` 70 次;Gitee/GitCode 镜像因此连带停更(凭据巡检现读 `mirror-to-cn` 已判 fail、落后超阈值)。**两条出路**:① 仓库 Settings→Branches→main 放开直接推送(本仓 §9b 是单分支直推模型,与"必须 PR + 必需状态检查"天然冲突);② 或正式改走 PR 通道(那要把 §16/§20"commit 即推送"的交付语义整条重写,属流程决策)。**在此之前任何"已推送/已交付"的结论都不成立**,`git log origin/main..HEAD` 的枚数就是真实积压。 （[归并] 本行与已完成登记同题(主键 「G-299」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账） 〔让号记录(2026-10-03 F9 清偿批③·逐组裁决):原号 G-299 同号多题,按交接票 G-1018210 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。本键持有族(门8清账三路由)系后绑定者,按最大纯登记族规则持有;时间线倒挂属分叉取号竞态,非抢号。〕
- 编号 G-1038312 → G-1058507(键位前沿 1038502 + 跳距 20000,试 6 枚)
  - [x] ✅(2026-09-28) G-1038312  **本机交付被远端分支保护拒收——所有已提交内容现在只在这台机上,远端收不下**（**等机主拍板**,agent 不代做也不该代做:改的是 GitHub 仓库安全设置）。实测:枚 `5af500724b` 之后 push 仍被拒,`https://api.github.com/repos/IHUI-INF-AI/IHUI-AI/branches/main/protection` 现读 `required_status_checks.contexts=["CI / lint-typecheck-test (pull_request)"]` ∧ `enforce_admins:true` ⇒ **直推 main 永远产不出 pull_request 上下文的检查**,任何凭据都推不上去(与凭据无关;凭据那条另已由 5af500724b 收口,`credentials-unavailable` 分诊在 HEAD 里)。现读积压以 `git rev-list --count origin/main..HEAD` 末行为准(本批结束时仍在涨),`.workbuddy/git-push-guard-async.log` 今日 `protected branch hook declined` 70 次;Gitee/GitCode 镜像因此连带停更(凭据巡检现读 `mirror-to-cn` 已判 fail、落后超阈值)。**两条出路**:① 仓库 Settings→Branches→main 放开直接推送(本仓 §9b 是单分支直推模型,与"必须 PR + 必需状态检查"天然冲突);② 或正式改走 PR 通道(那要把 §16/§20"commit 即推送"的交付语义整条重写,属流程决策)。**在此之前任何"已推送/已交付"的结论都不成立**,`git log origin/main..HEAD` 的枚数就是真实积压。 —— 取证：保护规则侧已由机主/并行会话解除：`git ls-remote origin refs/heads/main` 与本地一度逐字相等(积压 0)，门 29 恢复可跑。本票**不再等拍板**，但留下两件实测：① 本仓与远端又形成**新真分叉**(远端另一会话对 `scripts/check-sse-parser-parity.mjs` / `plan-tasks-merge.mjs` 及其三个测试文件有并行实现)，收敛落地闸按设计拒绝丢任一侧字面行 ⇒ 未落地，见新增的"归并出口"票；② `check-push-sync` 的 safe-commit 差分把"基线面(HEAD)不红"算成 exit 0，而同一条门 standalone 跑 HEAD 面实测 exit 1 ⇒ 判机器状态的门被差分定责到提交头上，另计一票 〔让号记录(2026-10-03 F9 清偿批③·逐组裁决):原号 G-299 同号多题,按交接票 G-1018210 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。本键持有族(门8清账三路由)系后绑定者,按最大纯登记族规则持有;时间线倒挂属分叉取号竞态,非抢号。〕

## 让号留痕(补记 @2026-10-05,手工处置 G-1058618 撞号)

> 背景:两会话撞号 G-1058618(备份链重建 / 门 133 假阳性)。备份链行按"后来者改号"先例让号至
> G-1058619(枚 8f51a2c2ba),但守门 71 自愈层(4ce7332bf6)把让号前的原文按"被抹掉的登记行"回捞,
> 台账又出现 G-1058618 备份链僵尸行 —— 本节即按门 71 放行出口留档:原文在此 ⇒ 不算丢 ⇒ 可删。

- 编号 G-1058618 → G-1058619(撞号处置,非跳距让号)
  - [ ] **G-1058618 备份链重建:换机后 PG 18.6 新实例无 beifen 只读角色、密钥库无 db-backup/ 子目录(09-25 写入的 ihui-backup.txt 留在旧机)、调度器 IHUI-PG-BACKUP 与 D:\DevEnv\runtimes\pgsql 路径全部失效** —— 取证(2026-10-05 实测):本机角色仅 postgres/ihui/ihui_app(无 beifen);凭据权威目录 F:/BaiduSyncdisk/密钥 全量清点无 db-backup;超管口令 482 候选穷举全灭(G-269 行 2026-10-05 注记);当前唯一可用 dump 是人工触发直出的 ihui_dev_20261005_191010.dump(109.7MB),调度链无人在跑。重建路径三段:① 角色面(deploy/win/ihui-pg-backup-role.sql 的 beifen 段)——CREATE ROLE 仍需一次超管会话(trusted 标记只覆盖扩展判权,不覆盖角色);② 凭据面(密钥库建 db-backup/ihui-backup.txt,口令由机主定);③ 调度面(ihui-pg-backup.ps1 的 psql 二进制路径指到 C:\Program Files\PostgreSQL\18\bin;凭据读取已支持 IHUI_DB_BACKUP_* env 覆盖)。归属:待认领;依赖机主一次超管会话(或参照 G-269 2026-10-05 D 案先例另行评估)。

---

## 让号留痕(补记 @2026-10-21,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-922 → G-1162551(键位前沿 1142551 + 跳距 20000,试 1 枚)
  - [ ] G-922 **台账历史叙述区有 7 组逐字重复的小节标题待归并（O1×2 / O37×2 / O45×3 / O50×2 / O82续三×3 / O86附⑧×2 / O86附⑨×2）**〔登记@2026-10-21/工程执行席〕:现状 = 取号器已不再被它们顶死（判据改认登记行的编号声明位，枚 32ce073019de6d750a65133aec3146752ff3e655，`node scripts/next-plan-id.mjs --check` 现读 rc=0），但块级重复本身还在 —— 同一标题的小节在文档里出现两份意味着读者无法判断哪一份是当前状态（§1 复合主键那一型在标题面上）。出路 = 走 `node scripts/plan-tasks-merge.mjs --heal`（只读预演取分档，动手要 --commit）逐组辨"整块重复"与"同题续写"，整块重复的按 §1 就地改写成带序号的系列小节标题或并入主块；⚠️ 该归并器是第四台旁路落地器、结构上不跑钩子（G-816708 那一格它仍未自带台账自愈补跑），落地后必须按票号逐枚复量三态并跑 `node scripts/git-push-guard.mjs`。

---

## 让号留痕(补记 @2026-10-22,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-928 → G-1142551(键位前沿 1122551 + 跳距 20000,试 1 枚)
  - [ ]（进行中@2026-10-22/goal-20261022） G-928 **门 105 的 [G5] 档在 HEAD 面就是红的(存量,与任何单枚提交无关)**〔登记@2026-10-21/工程执行席〕:`apps/miniapp-taro/src/constants/ui-routes.generated.ts` 产物自述钉的 inputsSha256=652a825f681d… 与 HEAD 面现算=ba526191ddf3… 不等 ⇒ 产物陈旧;同轮现读其余三端钉(web / mobile-rn / extension)与离线包钉均 matched。出路 = 在低并发窗口重跑该产物的生成器并重钉自述,**重跑前先 `git status` 它的输入目录**(路由源与 `packages/i18n` 正被他席改动,现在重生成会把他人 in-flight 烘进产物 —— 这一型本仓记过:跑"读盘重生 〔压缩@2026-10-22〕
---

## 让号留痕(补记 @2026-10-23,人工执行 scripts/plan-collide-renumber.mjs 的同一口径)

> 下列**改前整行原文**逐字取自被审面(HEAD 现读)的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 G-935 → G-1162551(键位前沿 1142551 + 跳距 20000;本侧键位行 2 行,退化标题行 1 枚仅补澄清注不改号)
  - [ ] （未取号:承 G-935 揭缺口 B）**窗格续传不可达**:pane-split 布局树不持久化⇒reload 后窗格不重挂;ChatPaneBody 无 recentMessages 预填链(仅根主体 ai-side-panel.tsx:803-814 有 prefill→capture→loadHistory→runAfterHistory);关叶即 dispose store;useConversationPaneCache 内存 Map 不落盘 ⇒ 窗格半截流 reload 零 resume 请求、孤儿快照 streamCompleted:false 永挂。修法=布局持久化+预填链+快照落盘;验收=resume 探针用例⑧b 由 annotation 转绿色断言 〔登记@2026-10-22/goal-r55/G-935 席〕
  - [ ] G-935 **多窗格聊天缺 e2e 真机核验(AGENTS §17 交付门槛)**〔登记@2026-10-21/工程执行席〕:本席落的四片(事件面 paneId / stream-handlers 注 store / 续传与工具面板窗格化 + 缓存按窗格隔离 + 跳转总线门控)全部只有组件级用例证据,**没有真浏览器核验** —— 共享机上另有多席在跑,起 pnpm dev 会抢 8802 watch 与 dev-lock,blast radius 不在本席可承担范围,故没起。出路 = 由专席在安静窗口按记忆已写明的登录契约(登录必须显式 `type`,邮箱通道不带 type 恒 401;admin 是 DB 触发器不可变行补不了 phone)补一枚 e2e:两窗格承载同一会话 ⇒ 各自流式/工具面板/滚动位互不顶(现读 〔压缩@2026-10-22〕

- 编号 G-940 → G-1182551、G-947 → G-1182552、G-82 → G-1182553(键位前沿 1162551 + 跳距 20000;手工档,撞号器对 G-940 拒构造——键位在标题中段、KEY_MAX_OFFSET=48 装不下 7 位超池号,故键位前置改号;依据 union-converge F9 收敛批 2026-10-24)
  - [ ] 〔归:机主运维面｜等:—〕 **生产备份链日志写入侧 UTF-8(仓内面已闭环;G-940 仓内腿)**:改法 `[Console]::OutputEncoding = UTF8` 与 `$prevOutEnc` 保存/恢复已入库(枚 e995feb13e3ed7a1aeab131e8fe1494aea928733),`deploy/win/ihui-pg-backup.ps1` 与 `deploy/prod-bundle/pg-backup.ps1` 逐字节等值(守门 14 影子对账全等绿)。余一步=下一轮 03:00 调度后"新增行 strict-UTF-8 解码 non-UTF-8 计数=0"终验,而读取生产机日志受制于 ssh.aizhs.top 8/8 bad handshake(根因=本机 cloudflared 副本与生产机同隧道分流,`ihui-deploy.ps1:2567-2570` 既有处置)。处置动作归机主运维面:授权处置隧道或核实生产 sshd 后补终验读数。〔结清@2026-10-24/主会话-强制令:仓内面已闭环,余为运维取证格〕
  - [ ] 〔归:机主素材交付面｜等:—〕 **小程序/Web 缺图来源三路取证终判(G-947 取证腿)**:① git 历史抽 6 个代表路径逐枚枚举,最大字节 174(真身从未进过本仓);② 本机文件系统原项目目录不存在;③ 原远程源对缺失路径 404,像素取证坐实 009/010 为假图、012 真图。agent 侧动作已尽:`check-image-placeholders.mjs` 补空白画布审计维(HEAD 面分组判据,`--strict` 判 ≥20 份洪水)+ 防复发规矩在位。补图交付主体=素材方(登录页/仪表盘等用户可见面先行,2026-10-07 机主拍板序);交付后用 `--list` 逐条对账即结。〔结清@2026-10-24/主会话-强制令:阻塞格=素材交付非决策格〕
  - [ ] 〔归:移动端真机走查包｜等:—〕 G-82 **`VideoPlayerScreen` 全屏纯黑 + 顶部 34dp 浅灰带**:代码面三处修复在 HEAD(RN `App.tsx` 焦点路由 `transparentStatusBar`、`VideoPlayer.tsx` 舞台 `tokens.gray[900]`、`video.tsx` 全屏 immersive)+ 回归锁 18/18 绿,`check-statusbar-single-source` RC=0 且 S1/S2/S3 全 0。带位像素判据(y=8..60dp 应翻黑)在 AVD `ihui-rn` 不可达——`react-native-video` 6.19.2 与镜像 media3 1.9.1 ABI 不匹配(`DefaultLoadControl` NoSuchMethodError)播放即崩,属 AVD 镜像级缺陷;设备位探针并入 G-191 走查包建档。〔结清@2026-10-24/主会话-强制令:代码面闭环,余为设备位取证格〕

---

## 让号留痕(补记 @2026-10-24,由 scripts/plan-collide-renumber.mjs 追加)

> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。
> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。
> 落点归档件:.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md

- 编号 D14 → D42046(键位前沿 22046 + 跳距 20000,试 1 枚)
  - [ ] **D14 断线窗口待决审批的重放(承 D131〔旧号〕〔旧号〕 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 〔压缩@2026-10-22〕〔让号记录(2026-10-09 批⑥执行):本行原持 D173〔旧号〕〔旧号〕,而 D173〔旧号〕〔旧号〕 同号多题 —— 持有行留驻「AI 对话链路四竞品对标 V4 收口线」,本行让出原号改用 D1047〔旧号〕〔旧号〕(取号器现读该族最大号已越过 D1047〔旧号〕〔旧号〕 ⇒ 不会再被发出)。正文与验收口径逐字未改。〕〔半程@2026-10-13 机主授权代行:agent 任务流侧已交付——agent_loop_v2.pending_approval_replays() 取数侧(仍待决=decision未写∧事件未置,thread_id==session_id 精确相等,属主精确相等 fail-closed;D1047〔旧号〕〔旧号〕 七例新测试)+agents.py 事件流在 start 帧后对带 Last-Event-ID 的重连重发同形 tool-approval 帧(replay:true,前端按 approvalId 幂等);回归:D131〔旧号〕〔旧号〕 取证六例+agent流34例全绿。**主对话流(llm.py::_approval_sessions)那半留票面未动**,理由:重连=重起一次 run,直接重放待决条目会让用户答复唤醒孤儿生成器继续执行(僵尸 run 执行结果无处落),须与 sse_contract 同批先立续传锚点 —— 与票面 A 档「须与 sse_contract 同批」一致,本行保持未勾。〕〔让号@2026-10-15:原声明号 D1047〔旧号〕〔旧号〕 超池(机主 2026-10-14 裁定任务号全部 ≤3 位、池式 1..999),经写盘闸正牌取号令牌让号;旧号即本注所列,检索/对账以此为准〕〔拍板@2026-10-18/机主授权代行:定 A 档——B 动 _sse 全仓共用出口跨端代价最大(票面自注须单独票),C 新造对外能力且僵尸 run 原样存在;A 只在重连路径追加显式重放,可回滚。取数侧已落码:approval_replay.py 纯函数+惰性闸(生产现读面恒返回空零行为),判据与 agent_loop_v2 逐字同族,新测 8 例+既有 13 例共 21 passed。剩余:diff① 条目扩展(零行为,llm.py 可达窗口捎带)+diff② 重放接线(须与 sse_contract 续传锚点同批,锚点批次须先裁决产出归属),补丁文字已交派单面。〕〔副本正文并入·承载整段:断线窗口待决审批的重放(承 D131〔旧号〕〔旧号〕 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。        〔进展@2026-10-19/工程执行席:diff①(条目扩展·零行为)已入库 8af5ea85455d388de94ac8d61ee00437de57c068 —— llm.py 生产条目补齐 tool_call_id/args_preview/danger_level/owner_user_id/created_at,取值与同处发出的 tool-approval 帧逐字段同源;app 面对取数侧的 import 点现读为零(新测 T6 已锁),故本笔只把"闸能不能开"变成可判事实,不改任何行为。新测 tests/test_d1047_chat_entry_shape_replay_gate.py 6 例把键集**从 llm.py 源码现读**再喂给生产函数(夹具改不动结论),同族 27 passed、mypy 工作树面 612 文件 0 错、ruff 全过。**先更正本票一处理证指针**:取数侧真实落点是 app/core/approval_replay.py,下面那条 2026-10-18 注记写的 app/services/approval_replay.py 实测该路径 git log 为空、从未存在过;那份手工抄的「现读生产形状」夹具对新形状已不成立,以本行为准。diff② 的拦路已量清,不是体力活:(a) 条目由等待方 finally pop,能否存续取决于生成器关停是否确定 = 台账 G-69〔旧号〕「持有资源的生成器必须显式关停」同一根因,两票同源;(b) tests/test_d131_pending_approval_resume.py 第 176 行是反证锁,明文禁止 llm.py 迭代 _approval_sessions,接线必然打红,须同批重裁其口径;(c) sse_contract 现读没有任何 id: 锚点或重连续传概念(Last-Event-ID 那套只活在 core/sse_buffer.py 的 agents 流)⇒ 票面那句"须与 sse_contract 同批"的实质内容就是这一格。本行保持未勾。〕〔现读更正@2026-10-20/qoder-d1047:**diff② 在 chat 腿结构性不可接** —— 待决条目由等待方挂在「既吐帧又等应答」的同一段 try 的 finally 里 pop ⇒ 客户端一断、GeneratorExit 从那个 yield 抛入即摘条目,重连时取数侧输入集恒空 ⇒ 接线只会得到一条永不触发的分支;可达性锁三例入库 `1f9ee2e491230e8e3e9a47df42da20b8873f80ba`(取证末行读数见该枚 commit message)。**剩余一格归拍板**:是否为 chat 腿把审批等待搬出连接(条目改会话级存续+TTL),代价 = 票面自己点名的僵尸 run;不救则维持 fail-closed(弹窗丢、超时默认拒、工具不执行)。本行保持未勾。〕〔同题原号 G-69〔旧号〕〕
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
