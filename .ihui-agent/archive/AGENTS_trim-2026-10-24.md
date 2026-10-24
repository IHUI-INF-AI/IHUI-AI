# AGENTS.md 移出原文 —— 2026-10-24(守门 207 体积清偿第 3 批)

- 出处:AGENTS.md @ HEAD `8d6b4369f19ca28c215227a2c7956c978523c152`(2026-10-24)
- 移出枚数:23 行(逐字,未做任何改写)
- 移出范围:原「守门脚本速查」区尾部 L405–L425 整段重复登记副本,加 L429、L433 两条同名集索引副本。
- 移出判据:每条规则本体在前文均有唯一面(逐条核对结果见下),本批只删与本体逐条同题的副本,不删任何仍在本文承担唯一来源职责的行;
  `check-tracked-ignored.mjs`(236)、`check-mirror-purge-intact.mjs`(238)、`check-plan-archive-monotonic.mjs`(239)、`check-public-admin-default.mjs` 的 R4 点名行仍留在 AGENTS.md,未进本批。
- 对应本体位置(移出时现读,行号为移出前 AGENTS.md 1-based):
  - L405 认领即租约 → §1 L30;L406 fold-identical-open-rows → §1 L34;L407 新登记必须有交代 → §1 L36
  - L408 重复登记副本指针注记 → §1 L38;L409 归档机制退役 → §1 L39;L410 完成即删要有器物 → §1 L42
  - L411 结清行复洁器物 → §1 L45;L412 自动档写活文档硬规矩 → §1 L47;L413 侧边栏可见性三层分治 → §4 L101
  - L414 落地欠回写层 → §12 L123;L415 水印三档 → §5c L130;L416 上游工具生成物 → §5c L133
  - L417 发信量 5e-3 → §5e L146;L418 Rust/MSVC → §5f L152;L419 12g 派生 git stdio → §12 L213
  - L420 15c 嵌套 git 仓 → §15 L232;L421 15d 盘根写入回归锁 → §15 L233;L422 守门 30a → §22 L268
  - L423 计划/台账索引 → 速查区 L381;L424 常驻工具清单 → 速查区 L390
  - L429 横向口径 → 速查区 L378;L433 UI/样式索引 → 速查区 L384(L433 独有的一枚 `check-cross-end-screen-coverage.mjs` 已并入 L384,不丢点名)
- 规则条款以 AGENTS.md 现行面为唯一面;本文件只作逐字留档,不得据以执行旧命令。

---

<!-- 原 AGENTS.md L405 -->
- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起新增即拦 = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌。**提交链上的门绝不代摘任何人的认领**,超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(派发层 `sweepStaleClaimMarks` 每 5 分钟;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——在飞席位会续租,天然落在射程外;裸标记由器物默认代摘,依据是同批 CL4 已在提交链拦住新增、而器物只读 HEAD 面)。落地走 `object-space-land` 并把旧形态逐行写进 `LAND_CLASH_SCOPE.removed` ⇒ 活文档行 union 不得再从对侧取回这一型;机主原话写进留痕条目 `ruling`(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针;原牌/持有者/超龄量/摘除前后整行/基线与落地 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)——可追责的真相源是留痕 + 提交信息,不是台账行。**护栏只认"本批旧形态行被别席就地改写"**:工作树副本常年不净不构成整批让路(取材面是 HEAD、落地有行级复活守卫、滞后回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 兜);让路只让被改写那几枚,行走 `planSweep` 的 `skipLines` 移入 held 并在结论行补 `deferred=`;副本读不到 ⇒ 仍让路。接线锁 `scripts/tests/strip-stale-claim-marks.test.mjs`(含原 `planFaceClean` 已退役的形状锁)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算)。

<!-- 原 AGENTS.md L406 -->
- **未带指针而整行逐字节相同的未勾登记行,唯一合法摘除通道 = `node scripts/plan-tasks-merge.mjs --fold-identical-open-rows [--commit]`**:同文两份在派单清单里是两行 ⇒ 两个会话各领同一张票;该档把多重集折到 1,**不加任何注记**(机主 2026-10-13 明令),断言为「claimable 一枚不动 ∧ F4+F4b 副本计数恰好减去删除份数 ∧ 注记枚数不增」,任一不过即整批不落。同题不同号而正文已漂开的副本**不归它**(机器折半即有损,交人工),带指针的那一族仍走 `--dedupe-open-rows`;两面旗同给当场 exit 2。

<!-- 原 AGENTS.md L407 -->
- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。**结构化侧车记录是第四种交代**:侧车 = `scripts/data/plan-fields.jsonl`(键 = 编号 + 标题前缀逐字),写它只有 `node scripts/plan-fields-extract.mjs --apply` 一条出口(只搬说辞、一个台账行都不改;抽取前后每行归属桶零变化才放行);行内 `〔归:…｜等:…〕` 标头是**投影**、人不手写,渲染与对账唯一实现 = `scripts/lib/plan-field-line.mjs`,机读判据 = `scripts/check-plan-fields.mjs`(blocking,只挂差值维:新增未勾行缺侧车 / 标头≠投影才红,存量只报数,§12e)。整行改写必须过的三维守恒(勾选态 ∧ 认领租约 ∧ 归属桶)实现位置 = `scripts/lib/plan-row-conservation.mjs`,调用方 import 它,不接受口头保证。

<!-- 原 AGENTS.md L408 -->
- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**:自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。**回潮实测到三条通道,逐条都得有器物**:①*推送*——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故清偿器落地后必须自带 `git-push-guard.mjs`;②*判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁(`foldTwins` 排除带注记行,而清偿正在剥注记),两侧必须同基准归一化;③*活文档行级 union*——按整行字符串比份数,认不出"对侧改写过而本侧已按台账清掉"的行,正解是补回前按**复合主键**再问一次清偿台账(在册票 G-32);兜底已装车在 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`,0 条一次都不派生),归并侧那半格仍未收口。分族键指纹优先(与门 203 同源),不要按复合主键分族。

<!-- 原 AGENTS.md L409 -->
- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「完成即删」——翻勾后整行删除,不留档、不归档、不写占位注释。旧那套两步走连同它的三件器物(自动归档器、13c 那道门、根 package.json 的 archive 脚本位)已全部从仓里移除,现读 `git ls-files | grep -c archive-completed-tasks` = 0、`node scripts/check-gate-wiring.mjs --strict` 的 R10 零缺口 ⇒ **不得再照旧文去跑那些命令**(§0.8);历史残余见 `backup/archive-removal-2026-10-16` tag。防误删防线:未勾登记行照旧受守门 71 保护(已勾行不进保护集,删之合法);删行自由不豁免其他守门(130/203/71 未勾半照常判)。

<!-- 原 AGENTS.md L410 -->
- **完成即删要有器物(2026-10-20 立,10-21 补 H4,10-23 补齐留痕与节拍)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 派发层 `sweepStaleClosedRows`(`intervalMs` 现读 5 分钟)派发,单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。③ **摘了必须留痕**,否则两条回潮防线同时瞎、存量永远归不了零:落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(at/seat/file/kind/commit/baseline);**凭据是"HEAD 有没有被推进",不是落地器退出码**;留痕必须排在落地成功之后(先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行)。④ **union 认台账**:`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 维(判据 import `scrub-declared-removals` 的 `declaredRows`)——台账命中 ∧ 本侧 0 份 ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣;台账取不到 ⇒ 一条不扣;产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,与 `yieldedIdCaps`(让号形态)合起来才堵满「本侧处置权已行使」。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`。

<!-- 原 AGENTS.md L411 -->
- **结清行的复洁器物**:`auto-commit-quiet.mjs` 收编滞后工作树副本时,会把"已按台账正当摘除的登记行"当成新增带回,因为归并档只判不丢行/不重复,判不出"这行已被摘过"。出口 `scripts/scrub-declared-removals.mjs`(由收编器在归并达标后调用,不进提交链)按摘除台账 `.ihui-agent/state/plan-row-drop.jsonl` + `.ihui-agent/state/stale-claim-strip.jsonl` 逐行剔除,三条件同时成立才动:整行逐字在台账 ∧ 当下 HEAD 面已无此行 ∧ 登记行形;任一不成立或取不到输入一律不剔(exit 2 未判定)。镜像 `scripts/tests/scrub-declared-removals.test.mjs`。

<!-- 原 AGENTS.md L412 -->
- **自动档写活文档的硬规矩**:底稿一律取被审面(`git show HEAD:<文档>` / `scripts/lib/face-reader.mjs`),落盘走对象空间(临时索引 + `commit-tree` + CAS,不写工作树);落地前自证"父提交里每条 `[x]` 复合主键本次仍为 `[x]`",不成立拒绝落地。**改写整行时还必须断言 `dispositionOf`(归他人/等条件/等拍板/可做)、`claimMarkOf`(租约)、`keyOfRow`(主键) 三维逐行不变,任一变了就整行还原**——压行会切掉中段的归属句子 ⇒ 别人持有的票变成可领的票,而当时门全绿也照样错:账面要现读,不能只看守门 RC。

<!-- 原 AGENTS.md L413 -->
- **侧边栏可见性三层分治**:`adminOnly`/`permission` 判**能不能看**(越权 = 权限漏洞,须与后端对齐);`advancedOnly` 判**要不要给普通人看**(纯降噪,不是鉴权);三者禁止合并成一个字段。`filterNavItemsByRole` + `filterNavItemsByTier` 两层由 `apps/web/src/components/sidebar/use-nav-visibility.ts` 的 `useNavVisibilityFilter` 单点组合,Sidebar 与 `components/layout/DomainHub.tsx` 共用该出口,禁止自行抄过滤;分档状态唯一真相源 `apps/web/src/stores/nav-visibility.ts`(`ALL_NAV_TIERS` + `hiddenTiers`),落 `user_preferences.group='preferences'` 的 `navTiers`,复用通用端点、不新开路由/不加迁移;改名 tier 须同改类型 `NavAdvancedTier` + `ALL_NAV_TIERS` + 设置页卡片;子项继承父项档位,父项要保留时只能逐子项标注;计数由 `__tests__/nav-tier-visibility.test.ts` 实跑钉住(数字现读)。

<!-- 原 AGENTS.md L414 -->
- **④落地欠回写层(`alignLandingDebtIndex`,同挂 `--align-drift`)**:`ALIGN_EXEMPT_PATHS` 把活文档从 ①②③ 整体绕行是**对的**,但旁路落地(`union-converge --apply` 用 commit-tree+CAS 只推进 HEAD)留下的那条**脏索引**从此无人负责——一次不带 pathspec 的提交会把合并成果写回旧态,而 `git merge --ff-only` 被它挡下 ⇒ 停部署。本层**只写索引、绝不写工作树**,判据 = 索引 blob 逐字节等于某枚 `bypass-landing` 留痕自述的前像(∧ 该枚 `landedSha` 是 HEAD 祖先 ∧ 工作区==索引);证明不了的一律 `held`/`undetermined` 逐条点名(§0.3),守护日志必打印。取证:`scripts/tests/heal-worktree-tracked.test.mjs` T9–T17(含形状锁"函数体内不得出现任何写工作树的动作")。

<!-- 原 AGENTS.md L415 -->
- 上一条的现行口径(三档,原文留档于归档):①**面**——这两处按 §0.4 同面同轮:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;清单与内容不同形 ⇒ "HEAD 缺载荷、盘上副本已补好但没提交"这一型两面各自都"没问题",悬留替红顶绿。②**退出码**——三档:判出缺口 ⇒ 1,**取不到被审面 ⇒ 2 并显式写「未判定」(不记绿也不冒红)**,判通过 ⇒ 0。③**自愈档**——`git add` 只准发生在 `--staged`(紧接着就 commit);全量档/`--push-gate` 档 inject 后**只写工作区、不动索引**(工作区可回滚而索引不可)。取证:`scripts/tests/check-watermark-coverage.test.mjs` W9(三面分叉正控)/W10(三面一致⇒三档全 0,防恒红)/W11(取不到⇒rc 2)。

<!-- 原 AGENTS.md L416 -->
- **上游工具生成物不进水印覆盖面**(唯一出口 `scripts/data/watermark-tool-generated.json` + 判据 `scripts/lib/tool-generated-roots.mjs`):免的是"必须带载荷"这一项,**不免前提** —— 三条缺一不生效:① 路径落在登记 root 前缀内(逐字节比);② 该文件在**被审面**上自述为工具产物(命中 markerRegex);③ `expires` 未到期。不自述 ⇒ 回到覆盖面按缺载荷判红;台账形状坏 ⇒ 水印层拒绝判定(既不冒绿也不冒红)。接线点在 `watermark.mjs` 的 `scanCoverage` 且**必须在 total++ 之前**(与第三方 excluded 同层,否则覆盖率会被读成暴跌),`list-uncovered` / `check-watermark-coverage` / CI 那一步自动继承。这一档不是行内豁免族,**不进守门 108 的族表**,存活期逐条写在台账里。典型现场:`apps/desktop/src-tauri/permissions/autogenerated/*.toml` 由 tauri 的 Rust build script 每枚重建,inject 进去的载荷会被下一次构建洗掉 ⇒ 按现状判红就是恒红门(§12e)。

<!-- 原 AGENTS.md L417 -->
- **发信量必须量得到,而且量的必须是"身份"(5e-3)**:每一次投递尝试(成功**与**失败)都由发信层追写 `.ihui-agent/state/mail-send-ledger.jsonl`(ASCII 键 + ISO 时刻,身份只存 fp 前缀,收件人只存脱敏形态),量算仪 `alert-volume-report.mjs` 的"①b 发信面之二"按 `(producer, fp)` 数 24h 封数、同身份 60 分钟内 ≥2 封即点名风暴。立因是量算仪原判据写死"中文一律不解码",而 git-guardian 的人到留痕是中文散文行 ⇒ 风暴判据结构上打不到最大的发信面。同一天立守门 224(`check-alert-identity-volatility.mjs`)从源头拦"把 sha/时刻/原始计数/异常原文写进去重身份";量与拦必须同批,只装一边都算没修。取不到台账一律落 `null`/未判定,**不得用 0 冒充"没寄过"**。

<!-- 原 AGENTS.md L418 -->
- **Rust/MSVC 构建环境注入**:`C:\Program Files\Git\usr\bin` 在系统 PATH 内且带 GNU `link.exe`,而 `apps/desktop/src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 按 PATH 解析 ⇒ 未加载 MSVC 的 shell 报 `link: missing operand after '\377\376'`,报错不提工具链。唯一真相源 `scripts/lib/msvc-env.mjs`(纯判据零 IO;`vswhere` 返回 `[]` 时用已知安装位兜底;PATH 键大小写不敏感;剔 `<Git>\usr\bin` 并前插 MSVC bin),入口薄壳 `scripts/desktop-build.mjs`(`--debug`/`--dev`/`--no-artifact-check`/`-- <透传>`);取不到工具链 ⇒ 显式「未判定」exit 2,绝不回落裸 env。已接线:`apps/desktop/package.json` 的 `build`/`build:debug`/`dev`/`dev:cdp`、`desktop-build-saas.mjs`、`desktop-dev-saas.mjs`、`release-desktop-local.mjs`;裸 `tauri build`/`tauri dev`/`cargo build` 不注入。**平台闸**:注入只对 win32 成立,macOS/Linux 用 clang/cc;判据单源 `needsMsvcInjection`,三个调用点都要问它(闸必须排在 planBuildEnv 之前);禁反向断言"文件里不许出现 `platform==='win32'`"。取证 `scripts/tests/desktop-build.test.mjs`。

<!-- 原 AGENTS.md L419 -->
- **12g 派生 git 必须显式接管 stdio**:本机任何派生 git 必须显式写 `stdio`(不写稳定 EBUSY;`shell:true` 经 cmd.exe 100% 复现;绝对路径不是豁免)。样板:`const stdio = opts.input === undefined ? ['ignore','pipe','pipe'] : ['pipe','pipe','pipe']`(带 input 必须 `['pipe','pipe','pipe']`)。判据门:`check-git-stdio-discipline.mjs`(193,括号配平取整个调用、只判属性名不判取值、禁行内豁免,豁免走具名台账)。反向门 `check-spawn-output-channel.mjs`(199):stdio 丢 stdout 又去读 ⇒ 结论恒 null,拦。任何"这行是否必要"的判断必须 ≥20 次成组对照,单次成功不构成"不需要"的证据。

<!-- 原 AGENTS.md L420 -->
- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-no-nested-git.mjs`,blocking,`stagedTriggers: ['scripts/']` 把射程收到"能造出该状态的那一面";全量档一律跑):测试夹具在仓库内 `git init` 且无清理钩子,中断即永久残留演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净。需要临时 git 仓的夹具一律走 `mkScratch()`(§15b,工作区外 + 进程退出自动回收)。射程外只有一格:扫根直属一层的 `.worktrees/`(§12d 规定的 worktree 检出落点,linked worktree 天然带 `.git` gitfile,判红就是逼所有人不开 worktree 的恒红门);同名目录出现在更深位置照旧命中。同一仓**已注册的** linked worktree 不再靠落点位置豁免,改由门按 `gitfile⇄admin 面双向核验`分流并逐条打印(悬空 gitfile / 回指伪造 / 指向他仓 admin / worktree 内再长出 `git init` 夹具 —— 四种照旧红,镜像 ⑦ 钉死)。另设第二把载体 `scripts/data/no-nested-git-sites.jsonl`:每处一行、只记意图与归属/到期,**存续由门在判的那一刻现算**,失去命中只 ⚠ 不清红(镜像 ⑨⑩ 钉住"未命中免不了任何东西、到期不免、坏行零免")。`entryBudget` 属只增不减覆盖面:被顶穿即恒 `truncated` = 恒红(§12e)。

<!-- 原 AGENTS.md L421 -->
- **15d 盘根写入回归锁**(守门 213 `check-disk-root-write.mjs`,blocking,无 stagedTriggers=任何提交都跑):扫描仓库代码里“往磁盘根(D:/G:/C: 一级,即项目树与 DevEnv 之外)写文件/建目录”的模式,对**本次提交新增**的判红(差值棘轮,锚点 = 该文件 HEAD 自身 W1 数;存量只报数,§12e)。与 15b 的**盘上**卫生 `check-disk-root-hygiene.mjs` 互补——那道守“盘上别留垃圾”,本门守“代码别再产新的”。收窄集 = literal 首段 ∈ `{IHUI-AI, DevEnv}`(§15b 批准落点,精确匹配非前缀)不立 W1;已知合法生产者走豁免台账 `scripts/data/disk-root-write-exemptions.json`(`{file, reason, ticket, until}`,到期回队列重裁)。影子工具 `scripts/quarantine-disk-root-strays.mjs`(只读预演,未接自愈链)。应急 `HUSKY_SKIP_DISK_ROOT_WRITE=1`(不推荐)。

<!-- 原 AGENTS.md L422 -->
- 守门 30a `check-commit-loss-guard.mjs`(blocking):reflog 50 步 + 远端 tag 校验 + tag 可达性 + **悬空 commit 30 天窗维**(近 30 天内新产生且无 `lost-commit/*` 备份的悬空 commit 阻塞,须先 `git tag lost-commit/<name> <hash>` 再 commit;超窗只报数 = §29 人工 GC 存量;时刻读不到 ⇒ 保守算窗内照拦;`--window-days 0` 回全量语义,`--strict` 问责存量)。tag 自动同步 + 全命名空间一致性校验:`sync-lost-commit-tags.mjs`(`--check` 比名字 + SHA,覆盖全部命名空间;仅本地/同名 SHA 分歧/备份族仅远端 ⇒ exit 1,非备份族仅远端只告警;本脚本不在提交链注册表,post-commit 只跑 `--auto-push`);永久档案 `docs/lost-commit-archive.md`。

<!-- 原 AGENTS.md L423 -->
- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`) `check-plan-fields.mjs`

<!-- 原 AGENTS.md L424 -->
- 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `audit-pane-store-addressing.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts` `desktop-build.mjs` `msvc-env.mjs` `desktop-unsigned-config.mjs` `plan-fields.mjs` `plan-field-line.mjs` `plan-row-conservation.mjs` `plan-fields-extract.mjs` `desktop-build-saas.mjs` `desktop-dev-saas.mjs` `gen-line-icons.mjs` `post-commit-hook.js` `release-desktop-local.mjs` `start-dev.ps1` `hook-run-hidden.vbs` `ensure-silent-tasks.mjs`

<!-- 原 AGENTS.md L425 -->
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.ihui-agent/state/push-state.json`)。**仓库只有 `origin` 一个远端**:国内代码镜像(Gitee/GitCode)与 `mirror-to-cn.yml` 作业已于 2026-10-23 整体弃用并删除,`git-guardian` / `git-rebuild-local` 也不再写回这两个远端;若见到 `gitee/*`、`gitcode/*` 远端或跟踪引用,那是弃用残留,**删掉而不是修**。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。

<!-- 原 AGENTS.md L429 -->
- **横向口径**(适用于绝大多数内容门):全量判 HEAD blob / `--staged` 判索引 blob / `--worktree` 仅人工;两面旗同给 exit 2;取不到判「无法判定」不回落;枚举到 0 判死;棘轮锚点 = 该文件 HEAD 自身违规数;行内豁免带原因;取证 = `--self-test` + §22c 镜像测试。完整口径原文已归档同上文件。

<!-- 原 AGENTS.md L433 -->
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs`

---

## 附录:2026-10-24 第 2 步移出(同题取证叙述 + 历次移出说明合并)

- 「摘了又回来」整条(与 §1「完成即删要有器物」同题,本体已在 L42 含 ①②③④ 与 5 分钟节拍)逐字如下:

- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 对等;**凭据是"HEAD 有没有被推进",不是落地器退出码**(实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除");留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`):30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`(9 例:留痕逐字/空集不落盘/留痕必须在落地之后/union 三条判据/两处 import 不许被删)。

- 历次 trim 批移出说明(11 条,合并为本文一行指针),逐字如下:

<!-- 「重复登记副本」指针注记的两版历史原文与三批搬出史(2026-10-13/14/21)已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;规则条款以本节压缩版为准。 -->

<!-- 「认领即租约」速查区旧口径副本(含 2026-10-22 三口径漂移取证叙述)已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md(同文亦见同目录 -23.md);规则本体见 §1。 -->

> 旧口径副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「完成即删要有器物（副本；其中 --apply 为旧值「每 30 分钟」，现行值见 AGENTS.md §1 同题条目）」。

<!-- 2026-10-14/10-21 两次压缩的历史叙述与 git 历史取回指引已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;本文与归档原文冲突时以本文为准(见文件头注)。 -->

<!-- 「完成即删要有器物」旧副本(--apply 每 30 分钟派发,已失效)、「worktree/索引自愈」旧副本(无删除意图账)、「认领即租约」两版副本(旧口径与 10-23 合并版)、「完成即删要有器物(10-23 补齐留痕与节拍)」合并副本已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;规则本体见 §1 与 §5b。 -->

<!-- 「计划/台账」索引与「常驻工具」清单的重复登记副本(与上方现行两行同名集一致,仅次序不同)已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md。 -->

> 本次(2026-10-23)逐字移出的 11 行重复登记副本、6 行改写原行,以及收敛期由对侧滞后副本带回的旧口径指针行,见 `.ihui-agent/archive/AGENTS_trim-2026-10-23.md`;更早批次见同目录 `AGENTS_trim-2026-10-21b.md` / `-10-21.md` / `-10-20.md`。规则条款以本文为唯一面。

<!-- 2026-10-23 收敛期由对侧滞后副本带回的 18 行重复登记副本(§1/§4/§5/§12/§15/§22 各规则本体的漂移旧版)已整区逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23b.md;规则条款以各编号节本体为准。 -->

<!-- 历次压缩批逐字移出的副本与旧版原文见 `.ihui-agent/archive/AGENTS_trim-2026-10-20.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-21.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-23.md`(含门 89/常驻工具/索引/API 行的重复副本、门 193/出口台账/deprecated-source/Rust-MSVC/chcp/--dev 的已取代旧版);规则条款以本文为唯一面。 -->

> 2026-10-23 各压缩批的全部被删副本与被改原行,逐字在 `.ihui-agent/archive/AGENTS_trim-2026-10-23.md`(枚数现读该文件,不在本文写死);更早批次见同目录 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-21.md` / `.ihui-agent/archive/AGENTS_trim-2026-10-20.md`。规则条款以本文为唯一面。

<!-- 速查区 12 条与 §0-§15 规则本体重复的登记副本 + 9 条历次 trim 历史注释/引用,已整行逐字移入 .ihui-agent/archive/AGENTS_trim-2026-10-23c.md(2026-10-23 守门 207 体积清偿;规则本体在上方各编号节,一字未动)。 -->

- 压缩版说明原文(已精简为取法一句):

> **本文件为 2026-10-14 / 2026-10-21 两次压缩版**:规则条款全部保留;被压掉的历史原文**不在工作树** —— 2026-10-16 `7a77c44d86c` 已清除 `.ihui-agent/archive/` 全部存料(本节原引的三份归档,只有第一份曾存在过,且不在原登记的那个 sha 里)。要查时从 git 历史取:`git show 3017301fd0b:.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(实测 1,262,819 字节;原登记 `c7834a8f0388` / 1,261,607 字节均不成立)、二次压缩前原文 `git show 6efeeadc20c^:AGENTS.md`。本文与历史原文冲突时以本文为准;本文未写的历史案例按上述历史面查 —— 不再有独立的 archive 副本可翻。
