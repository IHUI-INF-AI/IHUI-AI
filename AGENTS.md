<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md — IHUI-AI 项目 Agent 指南

> 作用域:`G:/IHUI-AI` 仓库根目录及所有子目录。凡「盘符 / gitdir 形态 / 远端 URL / 代理 / 服务承载体(nssm·计划任务·daemon) / PowerShell 解释器身份 / TEMP」七类机器事实,**每次使用前按当次实测取值**,不得把本文或另一台机的现状当本机事实写进判据。
> **本文件为 2026-10-14 压缩版**:规则条款全部保留;历史叙述、失效原文残留、重复登记副本与超长守门登记整区逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(出处 HEAD `c7834a8f0388aa006ca746cb1cc4a3006336c23d`,1,261,607 字节)。本文与归档原文冲突时以本文为准;本文未写的历史案例按归档件查。另见 `.ihui-agent/archive/AGENTS_history.md`。2026-10-21 二次压缩:压缩前原文逐字归档于 `.ihui-agent/archive/AGENTS-pre-compress-2026-10-21.md`。

## 0. 全局铁律(先读,跨节通用)

1. **凡数字一律现读**:本文所有计数、门编号、例数都是登记时刻读数,派单/问责前必须重跑对应脚本取现值。
2. **恒红门禁令(§12e/§12f)**:与本次提交内容无关的红门,唯一结局是逼人 `--no-verify`、连带废掉全部守门。判机器状态/判历史存量的 → warn 或差值棘轮(只拦新增);**升 blocking 的前置 = 存量归零**。
3. **"没判"绝不写成"判过"**:取不到输入 ⇒ exit 2 显式「未判定」并点名原因,不记绿也不冒红;枚举到 0 个候选判死不记绿。
4. **守门取材面纪律(守门 118)**:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;清单与内容同面同轮;取不到不回落另一个面。
5. **棘轮锚点 = 该文件 HEAD 自身的违规数**:只拦"本次改动把违规加回来",存量只报数。
6. **单一真相源**:同类判据/清单/取值实现全仓只许一份,第二份必然漂移(§22c);测试 import 源脚本 `__test__`,禁止复制判据。
7. **豁免必须"验过才免"且会到期**(守门 108):行内豁免标记必须带原因、逐行生效;豁免族必须登记存活期;已登记的豁免若被审面不再命中 ⇒ 清单腐烂判红。
8. **文档不得写跑不通的出路**:给用户的每条命令必须真跑得通;应急跳过变量以 `scripts/guardian-runner.mjs` 注册条目现值为准,本文不逐枚罗列。
9. **判据必须在真跑它的那一刻才成立**:"造好没装车"= 没有;守门 89 R4:已接线而 AGENTS.md/README.md 通篇不点名 ⇒ 红。
10. **失效方向必须是"多要一次定向说明",绝不能是"多放一次跳门"**(归因、豁免、跳门留痕同此禁令)。
11. **必须永久中文回复,包括思考过程**(用户 2026-10-21 定案)。

## 1. 任务计划文档规则(强制)

- 唯一任务计划文档 = `PROJECT_PLAN.md`(根目录)。所有计划/进度/待办**只写**此文件,禁止在别处新建计划/TODO/ROADMAP 文件(唯一例外:`/goal` 模式的 `.ihui-agent/goal-runtime/STATE.md` + `loop-run-log.md`,以及 `.ihui-agent/skills/SKILL.md`)。
- 完成翻勾 `[ ]` → `[x] ✅(日期)`;新增任务追加到对应优先级(P0/P1/P2)末尾;commit message 用 `feat/fix/docs/chore/test/refactor` 前缀。
- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起**新增即拦** = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌;**提交链上的门绝不代摘任何人的认领**,而超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(guardian 每 30 分钟派发;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——正在干活的席位会续租,天然落在射程外;落地走 `object-space-land` 并把旧形态逐行写进 `removed` ⇒ 活文档行 union 不得再从对侧取回这一型;裸标记由器物**默认代摘**(依据不是口头状态,而是同批的 CL4:新增已在提交链被拦住,而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程),机主原话写进留痕条目的 `ruling` 字段(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针(实测注记最长 52 字),原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)—— 注记本身会被活文档归并洗掉(实测一轮 64 枚只剩 6 枚),所以可追责的真相源是留痕 + 提交信息,不是台账行)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(2026-10-22 收三口径漂移:① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算;两把尺子曾各自读出 31 与 59,差值同时是"真牌隐身⇒两席领同一张票"和"叙述锁死真票⇒派单面虚低"两个方向的失真)。
- **一个编号只能有一行"当前状态"**:新登记同一件事必须把旧行翻勾或就地改写,不得再抄一份(复合主键 = 编号 + 标题前缀逐字等值,不是相似度;机器闸在 `scripts/live-doc-edit.mjs` 写盘闸 + 守门 130 差值棘轮)。归并出口:`node scripts/plan-tasks-merge.mjs --heal --commit`(F4 只加指针、绝不动勾选)。
- **派单口径只认一个入口**:`node scripts/plan-tasks.mjs --open --dispatchable --exclude-inflight`(数字现读;被摘除的"在飞"行是临时让位不是完成)。
- **证据指针禁止行号、禁止 7-12 位短 sha**:行号一次 append 就挪位;短 sha 腐烂率 30.2%——**要么全量 40 位,要么内容锚点**(编号 + 标题原文)。两条登记入口(`live-doc-edit.mjs` / `safe-commit.mjs`)已接机器闸。
- **未带指针而整行逐字节相同的未勾登记行,唯一合法摘除通道 = `node scripts/plan-tasks-merge.mjs --fold-identical-open-rows [--commit]`**(2026-10-16 立,承台账票「台账"同一件事的多份逐字相同待办"没有任何一条合法摘除通道」方向①):同文两份在派单清单里是两行 ⇒ 两个会话各领同一张票,这就是"打架重复做"的机器成因;该档把多重集折到 1,**不加任何注记**(机主 2026-10-13 明令),断言为「claimable 一枚不动 ∧ F4+F4b 副本计数恰好减去删除份数 ∧ 注记枚数不增」,任一不过即整批不落。同题不同号而正文已漂开的副本**不归它**(机器折半即有损,交人工),带指针的那一族仍走 `--dedupe-open-rows`;两面旗同给当场 exit 2。
- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。 **结构化侧车记录是第四种交代(2026-10-22 立,P1)**:侧车 = `scripts/data/plan-fields.jsonl`(键 = 编号 + 标题前缀逐字),写它只有 `node scripts/plan-fields-extract.mjs --apply` 一条出口(只搬说辞、一个台账行都不改;抽取前后每行归属桶零变化才放行,任一漂移整批不落);行内 `〔归:…｜等:…〕` 标头是**投影**、人不手写,渲染与对账的唯一实现 = `scripts/lib/plan-field-line.mjs`,机读判据 = `scripts/check-plan-fields.mjs`(blocking,档位只挂差值维:仅本次新增未勾行缺侧车 / 标头≠投影才红,存量缺侧车只报数不拦提交,§12e)。整行改写必须过的三维守恒(勾选态 ∧ 认领租约 ∧ 归属桶)实现位置 = `scripts/lib/plan-row-conservation.mjs`,调用方 import 它,不接受口头保证。
- **同题跨号禁止**:`{{NEXT_ID}}` 取号令牌 + 标题指纹查重(守门 203 `check-plan-task-duplicates.mjs` + `live-doc-edit` 写盘闸双接线);同号同题副本走 F4 归并。
- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口,10-14 二次实测补因):自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。**回潮实测到三条通道,逐条都得有器物**:①*推送*——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故清偿器落地后必须自带 `git-push-guard.mjs`(2026-10-14 实测 11:48 清偿 350 → 13:45 带回 1699);②*判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁(`foldTwins` 排除带注记行,而清偿正在剥注记 ⇒ "重复第一次被看见"读成"本轮造出重复"、整批拒落),两侧必须同基准归一化;③*活文档行级 union*——按整行字符串比份数,认不出"对侧改写过而本侧已按台账清掉"的行(实测 21:42 本侧 0 → 21:44 合并带回 9),正解是补回前按**复合主键**再问一次清偿台账,归在册票 G-32;兜底已装车在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`,0 条一次都不派生),归并侧那半格仍未收口。分族键指纹优先(与门 203 同源),不要按复合主键分族。 〔2026-10-15 摘除 2 份并发带回的旧副本,被摘行逐字进 `.ihui-agent/archive/AGENTS_dedup-removed-2026-10-15.md`(照本仓 AGENTS_dedup-removed-* 惯例:删副本不删证据)〕
- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「完成即删」——翻勾后整行删除,不留档、不归档、不写占位注释。旧那套两步走连同它的三件器物(自动归档器、13c 那道门、根 package.json 里的 archive 脚本位)已全部从仓里移除,现读 `git ls-files | grep -c archive-completed-tasks` = 0、`node scripts/check-gate-wiring.mjs --strict` 的 R10 亦零缺口 ⇒ **不得再照旧文去跑那些命令**(§0.8:文档不许写跑不通的出路);历史残余见 `backup/archive-removal-2026-10-16` tag。防误删防线:未勾登记行照旧受守门 71 保护(已勾行不进保护集,删之合法);删行自由不豁免其他守门(130/203/71 未勾半照常判)。
- **台账只记真工作(2026-10-16 机主明令,同日收紧)**:登记门槛 = **可派单的真工作**(有人能动手做的);观察类、取证类、"等拍板/等环境/等他人"类发现一律**不进台账**——能当场修的当场修,修不掉的写进 commit message 交后手,不占台账行。登记行只留标题 + 一句现状/出路;验证过程、末行原文、取证流水一律只进 commit message(存档机制已退役,无归档件可写;既有机器判据不受影响)。
<!-- 本条旧版副本("完成即删要有器物 2026-10-20/21 两版")已逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-26.md;现行唯一面 = 文末同名条(10-23 补齐留痕与节拍),节拍原由见「摘了又回来」条。 -->
- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks`(超龄认领牌代摘器)原护栏判「`git status --porcelain` 对台账非净 ⇒ 整批让路」。本仓多会话共写活文档、工作树副本**常年不净**,于是护栏天天触发、器物天天让路:留痕最后一条停在 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘。之所以"脏"本来就不构成让路条件:取材面是 `git show HEAD:PROJECT_PLAN.md`、落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫,旧形态行逐字进 `LAND_CLASH_SCOPE.removed`)、工作树滞后带来的回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜 —— **脏的是别人的副本,不是判据面**。收窄后:只在本批旧形态行**被别席就地改写**时让路,且**只让路那几枚、其余照摘**(实测 45 枚里 4 枚在飞 ⇒ 摘 41、让路 4;原护栏会把 41 枚一起按住);让路行走 `planSweep` 的 `skipLines` 移入 held(不新写第二份判据),结论行补 `deferred=` 报数。工作树副本读不到 ⇒ 仍让路(未判定不猜)。派发节流同步 30min → **5min**(无滞留即零落地)。接线锁见 `scripts/tests/strip-stale-claim-marks.test.mjs`(护栏③ 三条 + 原 `planFaceClean` 已退役的形状锁)。**2026-10-23 实测**:待摘 45 → 4(剩的正是被别席改写那几枚),摘后借门 71 同一把尺子问"会不会被按未勾还原"点名 **0 ⇒ 0**,该族不会被回捞。
- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 对等;**凭据是"HEAD 有没有被推进",不是落地器退出码**(实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除");留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`):30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`(9 例:留痕逐字/空集不落盘/留痕必须在落地之后/union 三条判据/两处 import 不许被删)。
- **结清行的复洁器物(2026-10-22 立)**:`auto-commit-quiet.mjs` 收编滞后的工作树副本时,会把"已按台账正当摘除的登记行"当成新增带回(实测四枚已结清票整批复活),因为归并档只判不丢行/不重复,判不出"这行已被摘过"。出口 `scripts/scrub-declared-removals.mjs`(由收编器在归并达标后调用,不进提交链)按摘除台账 `.ihui-agent/state/plan-row-drop.jsonl` + `.ihui-agent/state/stale-claim-strip.jsonl` 逐行剔除,三条件同时成立才动:整行逐字在台账 ∧ 当下 HEAD 面已无此行 ∧ 登记行形;任一不成立或取不到输入一律不剔(exit 2 未判定)。镜像 `scripts/tests/scrub-declared-removals.test.mjs`。
- **只读对账尺子不进提交链**(判机器状态/票面文本,提交者结构上满足不了,挂成提交门即 §12e 恒红门):`check-temp-landing.mjs`(TEMP 落点回潮)、`check-dispatch-premise.mjs`(派单票 premises 是否仍在 HEAD 成立,需 `--ticket`)、`check-alertmanager-live-config.mjs`(生效配置↔仓内模板)、`check-monitor-runtime-parity.mjs`(运行副本↔仓内 `monitoring/` 四对 + ai-service `.env` 结构键,三态分桶,配对 <4 即 exit 2;差异 ≠ 错,判红权归人;镜像 `check-monitor-runtime-parity.test.mjs`)、`check-cross-end-parity-drift.mjs`(跨端对齐漂移;唯一调度器 = git-guardian 的 `auditCrossEndParityDrift()` 60 分钟轮,倒退按维到人;镜像 `cross-end-parity-drift-dispatch.test.mjs`)。**另一格会写盘**:`repair-cross-end-mirror.mjs` 的调度器 = 同文件的 `healCrossEndMirror()` 30 分钟轮(只补登记表已有的声明缺口、他席在飞一律拒落、只留日志不喊人;镜像 `cross-end-mirror-heal-dispatch.test.mjs`)。
- **自动档写活文档的硬规矩**:底稿一律取被审面(`git show HEAD:<文档>` / `scripts/lib/face-reader.mjs`),落盘走对象空间(临时索引 + `commit-tree` + CAS,不写工作树);落地前自证"父提交里每条 `[x]` 复合主键本次仍为 `[x]`",不成立拒绝落地(实测 18 行翻勾被退回的事故即此型)。**改写整行时还必须断言 `dispositionOf`(归他人/等条件/等拍板/可做)、`claimMarkOf`(租约)、`keyOfRow`(主键) 三维逐行不变,任一变了就整行还原**(2026-10-22 实测:把 161 枚 >400 字长行按本节压到 ≤400,切掉了中段的"归属:…"句子 ⇒ 派单口径 48→100,52 枚别人持有的票变成可领的票;门 71/109/130/203/229/234 当时全绿也照样错——账面要现读,不能只看守门 RC)。

## 2. 项目概览

IHUI-AI 全栈 AI 平台(TS Monorepo + pnpm workspace + Turborepo),8 端(2026-10-03 起 apps/assistant 已服务端化并入 ai-service):`apps/api`(Fastify 5 + Drizzle 0.38 + PostgreSQL)、`apps/web`(Next.js 16 + React 19 + Tailwind 4)、`apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)、`apps/miniapp-taro`(Taro 4)、`apps/desktop`、`apps/extension`、`apps/mobile-rn`、`apps/cli`;共享层 `packages/`(database / auth / types / ui / config / eslint-config / tsconfig / shared / api-client / design-tokens / app / ui-react / ui-native / i18n 等)。

## 3. 代码风格

- 做减法、最小化、零冗余;复用现有代码与模式;不创建文档文件(除非明确要求);不加 license header;每页面 < 250 行;时间用 `Intl.DateTimeFormat`。
- **TypeScript 类型零技术债**:禁 `any`(例外三选一须行内 `// FIXME(any): 原因+移除计划`);公共 API 显式精确类型;新代码 `tsc --noEmit` 0 错误;`@typescript-eslint/no-explicit-any: error` 已生效(lint-staged 阻塞);typed-lint 目标态启用前置 = lint 性能优化 + 历史错误清零 + allowDefaultProject 就绪(评估见归档件);测试文件豁免;CI typecheck 全绿方可合并。
- `pnpm format:check` 只判本次改动文件(差值棘轮 `scripts/check-format-changed.mjs`;CI 用 `FORMAT_BASE_REF`,全量存量审计用 `pnpm format:check:all`)。
- **共享层优先(强制)**:写新代码前先查 `packages/shared/src/{hooks,utils,stores,constants}`、`packages/types`、`packages/api-client`,端内禁止重新实现共享层已有功能;跨端可用的先提取到 shared(工厂模式 + 平台 adapter 注入,禁止 `Platform.OS==='web'` 分支进共享层);平台特有的在文件头注释 `// 平台特有:依赖 [DOM/RN/Taro] API`。守门:`check-shared-layer-duplication.mjs`。

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅;hover 用 subtle 颜色变化,不要蓝色发光边框;复用 `packages/ui-react` 的 Card/Button/Input/Dialog;状态徽章 draft 灰/published 绿;积分正绿负红。

### 品牌 CTA / 主按钮色同源(强制)

- **唯一写法**:品牌实底 + 其上文字,RN/共享包写 `brand.cta`(底)+ `brand.ctaForeground`(字)成对;CSS 侧 `--color-cta` + `--color-cta-foreground`。黑/白反转:亮=纯黑底白字,暗=纯白底黑字,`.dark` 显式覆盖。调观感只改 `tokens.css` 一处,三端同动,禁止端内单独覆盖或自立 CTA 档(`brand.ctaFill/ctaText` 类混血键已删,不得加回)。跨端 Button 基座唯一源 = `packages/design-tokens/src/button-variants.ts`(`SHARED_BUTTON_BASE/VARIANT/SIZE` 三表,两端 cva 先 spread 再追加,禁止端内抄同档 class string;锁定 `scripts/tests/shared-button-tier-base.test.mjs`)。新增品牌档:先落 `tokens.css` → 同源对账门映射表登记;RN 专属键进 `RN_ONLY_BRAND_KEYS` 须写明理由,豁免项消失同样算红。

### 描边不得取墨档(强制)

- 任何描边(RN `borderColor`、web/小程序 `border-primary`/`ring-primary` 类名、CSS `border*: var(--color-primary)`)一律不得取墨档(`brand.DEFAULT`/`brand.foreground`/`brand.ctaForeground`/`text.primary`)。合法出路:中性描边 `border.light/medium`,强调描边 `brandAccent.light/deep`。唯一例外位:输入框/选择控件聚焦态描边(2026-09-30 用户定档)。守门 83 R8,基线零容忍,行内豁免 `border-ink-exempt: <原因>`。

### 圆角单一源头(强制)

- 唯一真相源 `packages/design-tokens/src/radius.js`:`RADIUS_STEPS` = xs 2 / sm 4 / md 6 / lg 8 / xl 12 / 2xl 16(px);角色档 `RADIUS_ROLES` = tiny→xs / control→sm / chip→md / card→lg / panel→xl / hero→2xl,新增角色必须同笔有消费方。取用形态:web/Tailwind 用 `rounded-xs..2xl` 与 `var(--radius-*)`;RN 用 `rnRadius.<step>` / `rnRadiusFor.<角色>`;CSS 用 `var(--radius-*)`;**禁止** px/rpx 字面量、`rounded-[任意值]`、字符串形态 `borderRadius:'8px'`、本地 `*_RADIUS` 常量。SVG 内联写 `rx={rnRadius.xs}`;生成式 HTML/CSS 字符串用 `RADIUS_CSS_PX` 插值。**B6 引用 `rnRadius`、`rnRadiusFor`、`RADIUS_CSS_PX` 却未在本文件 import ⇒ 判红**(悬空标识符 typecheck 与 HEAD 门双盲)。真圆/胶囊靠量出来的形状不靠标记:半径一刀切 ≤2xl;胶囊判红三条件 = 盒形只取自身属性区 + 非正方盒 + 短边 ≥16px;细于 16px 的进度条/骨架/指示点只开队列不判。守门:`check-radius-single-source.mjs`(77)三判据 A 档位表对账 / B 端内取用 / C 覆盖面;`check-radius-role-conformance.mjs` 角色档;`check-rounded-full.mjs`(11)容器纯圆。

### Button 高度档位守门(强制)

- `@ihui/ui-react` 的 `<Button>` 禁止 className `h-*`/`w-*` 覆盖,必须用 `size` 档(xs 28 / sm 32 / default 36 / lg 40 / icon-2xs 28 / icon-xs·icon-sm·icon 32);新高度先在 `button.tsx` size 表立档。守门 `check-button-height.mjs`(档位清单动态解析)。

### 中文字体 + 图标垂直对齐(强制)

- web `globals.css` 已有 vcenter 补偿(0.3px,text-xs 0.7px);button/a 内 icon + 文字必须包 `<span>`(`<Button>` 已内置 `wrapRawTextChildren`;手写原生元素须自包);**严禁** `-mt-px` 反向 hack;flex/inline-flex span 豁免补偿。守门 `apps/web/e2e/icon-text-alignment.spec.ts`(|delta| ≤ 0.15px)。
- **数字计数徽章模板(强制)**:`inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-*/… px-1 text-[10px] font-semibold leading-none tabular-nums`,禁止裸 span 手搓。

### 页头返回键 / 「更多」入口单一源头(强制)

- 三端唯一实现(S0 机制清单,摘线或无人 import 即红,守门 102 S0):小程序返回键 `apps/miniapp-taro/src/components/BackChevron.tsx`、RN/共享屏返回键 `packages/app/src/components/BackChevron.tsx`(`colorScheme` 必填 prop)、RN 更多 `packages/app/src/components/MoreLink.tsx`、web 更多 `apps/web/src/components/common/view-more-link.tsx`、小程序更多/返回箭头复用 `apps/miniapp-taro/src/components/LineIcon/icons.ts` 素材、共享输入框 `packages/app/src/components/TextField.tsx`。web 返回键唯一实现 = `GlobalTopBar.tsx` 的 `TopBarBackButton`(守门 46 拦私接 `router.back()`)。
- 箭头必须矢量图标,禁止字符 `› » → ‹ ←` 当图标(GA1)、「返回」两字当返回箭头(GA4)、混写(GA5)、双返回(GA6 原生导航栏)、导航锚点内字形+带宾语文案(GA8)。豁免通道:`glyph-arrow-exempt` / `back-label-exempt` / `nav-chrome-exempt`(各带原因、互不串门、进守门 108 存活期表)。守门:`check-glyph-arrow-icon.mjs`(102)。

### 其他 UI 硬规则(强制)

- **禁止分割线**:`<hr>`/`divide-*`/单边 `border-t/b/l/r` 当纯分隔线一律禁止,用 `space-y-*`/背景对比替代;结构性边框(容器边框收口、引用块左边框、IDE diff)允许;低透明度单边边框由 `check-no-divider.mjs` WARN。
- **禁止渐变遮罩**:mask-image/linear-gradient 边缘淡出禁止(`check-no-mask-image.mjs`),用显式 UI 元素替代。
- **禁用原生提示窗**:`title`/`alert()`/`confirm()`/`prompt()` 禁止,用项目 `Tooltip`(`check-no-native-dialog.mjs`)。
- **图标一律图标库**:web `lucide-react`、RN `lucide-react-native`、小程序 `static/images/icons/` lucide 风格 SVG(`node scripts/gen-taro-lucide-icons.mjs <name>` 生成);禁止 emoji 充当 UI 图标(`check-no-emoji-icons.mjs`);**品牌/平台图标必须官方真实图标**(favicon 直取 → Google s2 → favicon.im → 官方 CDN,人工目检;`publish-icons/` 与 footer mono 剪影两套素材禁止混用;`.ico` 仅为兜底)。
- **圆角容器内 absolute 子元素避让**:父 `rounded-xl`+`overflow-hidden` 时贴边子元素禁 `h-full/w-full`,用 `top-<radius> bottom-<radius>` 映射(lg→2/xl→3/2xl→4)。
- **浮动弹层内边距四档**:内容面板 `p-3`、菜单列表 `p-1`、轻提示 `px-2 py-1`、复合面板外层零 padding 行级自带;禁止自创中间值,同族组件必须同档。
- **状态栏避让单一源头(97)**:唯一注入点 `apps/mobile-rn/App.tsx` 的 `<SafeAreaView edges={['top']}>`;`packages/app` 不碰顶距;禁 `StatusBar.currentHeight`/`statusBarHeight` 取值与 24..60 魔法顶距;豁免 `statusbar-exempt: <原因>`。守门 `check-statusbar-single-source.mjs`。

- **聚焦反馈(门 212)**:描边的输入/选择控件必须有聚焦反馈,三端各自书写语言全覆盖,证据窗 = 元素自己的属性区;存量按该文件 HEAD 自身棘轮只报数;RN `focusedStyle` 禁几何键。
- **侧边栏可见性三层分治(2026-10-20)**:`adminOnly`/`permission` 判**能不能看**(越权 = 权限漏洞,须与后端对齐);`advancedOnly` 判**要不要给普通人看**(纯降噪,不是鉴权);三者禁止合并成一个字段。`filterNavItemsByRole` + `filterNavItemsByTier` 两层由 `apps/web/src/components/sidebar/use-nav-visibility.ts` 的 `useNavVisibilityFilter` 单点组合,Sidebar 与 `components/layout/DomainHub.tsx` 共用该出口,禁止自行抄过滤;分档状态唯一真相源 `apps/web/src/stores/nav-visibility.ts`(`ALL_NAV_TIERS` + `hiddenTiers`),落 `user_preferences.group='preferences'` 的 `navTiers`,复用通用端点、不新开路由/不加迁移;改名 tier 须同改类型 `NavAdvancedTier` + `ALL_NAV_TIERS` + 设置页卡片;子项继承父项档位,父项要保留时只能逐子项标注;计数由 `__tests__/nav-tier-visibility.test.ts` 实跑钉住(数字现读)。

### 跨端样式同步铁律(强制)

- web 与 miniapp-taro 视觉必须完全一致(除平台独占差异);**任何一端改样式必须同步另一端,这是交付门槛**。小程序与 RN 必须长成同一张脸:一份平台无关组件源 + 平台 adapter,禁止两端各写一份靠对账追平;对账门 `check-cross-end-ui-parity.mjs`(128,blocking,棘轮基线 `cross-end-ui-parity-baseline.json`,含圆角 RD 维与 web 腿 WD 维,差异必须显式登记 waivers,静默不同形与为消红补数字都违规)。
- **单一色值源** `packages/design-tokens/src/styles/tokens.css`;各端副本(`app.css` 受管块、`mobile-rn/global.css`、`rn-tokens.ts`、`@theme` 注册区、theme.json/THEME_CHROME)一律**派生态**:原位写回、幂等、禁止手改,由 `scripts/lib/design-token-blocks.mjs` 唯一取源 + `sync-miniapp-tokens.mjs`/`sync-miniapp-chrome.mjs` 等派生,挂 `TOKEN_SYNC_TARGETS` 自动写回;守门 36(`check-miniapp-tokens-sync.mjs`)核 `:root/.dark/@theme` 三面。改 token 只改源头 + 跑 sync。新增跨端档位顺序:tokens.css → sync → 门复核。
- 主题系统:miniapp 路由页顶层 `<ThemeRoot>`;切主题必须 `setThemePreference`(同步原生导航栏/tabBar);RN `dark:` 类依赖 `color-scheme-sync.ts` 落 store,不得混用两套色源;禁止深色科技风回潮与同名工具类冲突。守门 `check-miniapp-taro-style-parity.mjs`、`check-cross-end-tokens.mjs`(93)。
- Tailwind 版本事实(现读为准):miniapp 实跑 v4(vendored by weapp-tailwindcss),`/alpha` 在 v4 原生、v3 端(mobile-rn/NativeWind)靠 `tailwind-alpha-plugin.js`(新颜色档必须同笔进插件);v3 端裸 rpx 任意值必须 `text-[length:28rpx]`(守门 93 R7)。判"到端生效"看 `check-miniapp-css-landing.mjs`(先认 C5/C6 构建档位再说百分比)。

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js;Zod 校验请求参数;复用 `packages/auth` 的 authenticate;admin 路由 preHandler 统一校验(roleId ≥ 1);幂等用 `onConflictDoNothing`;slug 自动生成;API 响应统一 `{ code, message, data }`。
- **鉴权面公开化必须显式列举(强制)**:禁止兜底正则放行参数路由(会连静态子路由一起放行,fail-open 崩 500);显式白名单列路径;新增 `/agents/<静态段>` GET 必须同步登记 `AGENTS_PROTECTED_STATIC_SEGMENTS`;游客数据 handler 自证 `status=published` + 脱敏;改鉴权面前全仓 grep 调用方。对外能力白名单对账:`check-public-exposure-list.mjs`(X1 精确 location/X2 站点壳与 docker 壳同批/X3 资格/X4 剥身份头/X7 handler 真解析身份;刻意不接提交链,接了镜像 T6 就红)。
- **认证不等于授权(强制)**:归属型记录的入口,令牌主体必须由承载层显式入参传入,不得丢弃、不得从被操作记录反推、不得信客户端自报;身份不得住客户端可整写字段;越权用例必须断言"副作用没发生"并成对留正向对照。出口 `require_request_user_id` / `IDENTITY_METADATA_KEYS` 单源。
- **测试隔离铁律(强制)**:测试一律禁止连生产库(PG 8810/Redis 8811);共享连接池必须 monkeypatch;跑两次 + 行数不变才算通过。

## 5b. `.git` 存续治理(强制)

- **结构与守护**:活 gitdir 形态按当次实测(本机 = 工作区内 `.git` 实体目录;`D:/IHUI-AI-git-repo` 与 `D:/IHUI-AI.git-backup-20260912` 是另一形态的遗留,禁止删除/清理)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),**手工抢修也不得把 `.git*` 归档 mv 到工作区根**。诊断:`node scripts/git-guardian.mjs --status|--check`;日志 `.ihui-agent/state/git-guardian.log`(健康不写行)。
- **嵌套 ref 存续**:`git update-ref` 对 depth ≥2 嵌套命名空间静默假成功;对齐 `origin/main` 唯一正解 = `git fetch origin main` → `node scripts/git-refs-heal.mjs`(FETCH_HEAD 权威值固化 packed-refs);禁止手工 update-ref/松散直写 origin/main;禁止 `HUSKY_SKIP_COMMIT_LOSS_CHECK=1` 绕 30a。远端 stale 分支出路 = `git-refs-heal.mjs --refresh-remote`(fetch --prune 连期望清单一起摘)。
- **worktree/索引自愈**(`heal-worktree-tracked.mjs`,挂 guardian tick):①恢复被外部删除的跟踪文件(索引==HEAD ∧ HEAD 存在)——**先问删除意图账**:该路径最新一条留痕若仍是 `report-only`(摘标未超 TTL,默认 2h,`IHUI_STAGED_INTENT_TTL_HOURS`)则只报数不代裁;超 TTL 而归属会话已不在 ⇒ 回盘并把逐字路径清单写回同一本账(2026-10-23 立,治"护栏天天让路⇒整仓长期验不动",实测曾十小时内 9→46 枚);②对齐幻影漂移(索引==HEAD ∧ 工作区==某祖先版本);③刷新落后索引(逐路径 update-index,绝不全局 reset);**MERGE_HEAD 在 ⇒ 各写索引层整轮让路**。
- **④落地欠回写层(2026-10-14 立,`alignLandingDebtIndex`,同挂 `--align-drift`)**:`ALIGN_EXEMPT_PATHS` 把活文档从 ①②③ 整体绕行是**对的**(2026-10-12 那次"刷新索引 + 回写工作树"两层接力吃掉 19339 行台账),但旁路落地(`union-converge --apply` 用 commit-tree+CAS 只推进 HEAD)留下的那条**脏索引**从此无人负责——一次不带 pathspec 的提交会把合并成果写回旧态,而 `git merge --ff-only` 被它挡下 ⇒ 停部署。本层**只写索引、绝不写工作树**,判据 = 索引 blob 逐字节等于某枚 `bypass-landing` 留痕自述的前像(∧ 该枚 `landedSha` 是 HEAD 祖先 ∧ 工作区==索引);证明不了的一律 `held`/`undetermined` 逐条点名(§0.3),守护日志必打印。取证:`scripts/tests/heal-worktree-tracked.test.mjs` T9–T17(含形状锁"函数体内不得出现任何写工作树的动作")。
- **恢复源增量刷新**:`git-backup-refresh.mjs` 由 guardian 每轮先 `--check` 再增量刷——**关键自愈层不得挂在会自己消失的计划任务上**(兜底可以,唯一挂点不行)。
- **派生进程纪律**:`spawn/exec` 一律 `windowsHide: true`(机器级默认钩子 `install-console-window-hook.mjs --apply`,换机必跑;不得因钩子省略逐点参数);**派生 git 必须显式 stdio**(§12g);`NODE_OPTIONS` 钩子文件必须 `.mjs` 且放仓库外。禁弹窗排查先查 `HKCU\Console\%%Startup` 委托键(已固定 conhost,禁改回 WT)。

## 5c. 溯源水印与生成产物(强制)

- 三层水印(`scripts/watermark.mjs`):L1 可见横幅、L2 横幅内零宽载荷、L3 文件末独立不可见行。载荷必须**可解码且等于 `WATERMARK_TEXT`**;五态:完好/残迹/载荷损坏/仅隐写/未覆盖,后四者 `watermark.mjs verify` 与 `check-watermark-coverage.mjs` 均 exit 1。
- 〔更正@2026-10-15,补上一条的退出码与取材面;上一条原文逐字留档,只作改判留痕读〕:①**面**——这两处自本日起按 §0.4 同面同轮:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱。此前是"清单取索引面(`ls-files`)、内容取磁盘(`readFileSync`)",两面不同形 ⇒ **"HEAD 缺载荷、盘上副本已被补好但没提交"这一型在两面各自都"没问题",悬留替红顶绿**(2026-10-14 实测三枚生成物即此型,门报绿而 CI 必红)。②**退出码**——上一条"均 exit 1"只覆盖"判出缺口"那一支;按 §0.3 现在是三档:判出缺口 ⇒ 1,**取不到被审面 ⇒ 2 并显式写「未判定」(不记绿也不冒红)**,判通过 ⇒ 0。③**自愈档**——`git add` 只准发生在 `--staged`(紧接着就 commit);全量档/`--push-gate` 档 inject 后**只写工作区、不动索引**,因为工作区可回滚而索引不可——pre-push 派的全量档 add 完永不 commit,就是"暂存区里挂着没人提交的东西"的成因。取证:`scripts/tests/check-watermark-coverage.test.mjs` W9(三面分叉正控,摘掉换面即翻绿)/W10(三面一致⇒三档全 0,防恒红)/W11(取不到⇒rc 2)。
- 新建源文件必跑 `node scripts/watermark.mjs inject <file>`;门禁自愈式(检出缺口自动 clean+inject 回写并 git add;单次缺口 >200 拒绝自动回写;CI 用 `verify` 严格判定);生成器 writeFileSync 后必须紧随注入(用 `process.execPath` + 绝对路径)。
- **禁止对含载荷文件做文本级批量改写**(reflow/正则替换/sed -i/编码往返会毁零宽链);需批量改先 clean → 改 → inject;注入幂等。
- **上游工具生成物不进水印覆盖面**(唯一出口 `scripts/data/watermark-tool-generated.json` + 判据 `scripts/lib/tool-generated-roots.mjs`,2026-10-16 立):免的是"必须带载荷"这一项,**不免前提** —— 三条缺一不生效:① 路径落在登记 root 前缀内(逐字节比);② 该文件在**被审面**上自述为工具产物(命中 markerRegex);③ `expires` 未到期。不自述 ⇒ 回到覆盖面按缺载荷判红;台账形状坏 ⇒ 水印层拒绝判定(既不冒绿也不冒红,与第三方台账同一条判序)。接线点在 `watermark.mjs` 的 `scanCoverage` 且**必须在 total++ 之前**(与第三方 excluded 同层,否则覆盖率会被读成暴跌),`list-uncovered` / `check-watermark-coverage` / CI 那一步自动继承。这一档不是行内豁免族,**不进守门 108 的族表**,存活期逐条写在台账里。典型现场:`apps/desktop/src-tauri/permissions/autogenerated/*.toml` 共 89 枚由 tauri 的 Rust build script 每枚重建,inject 进去的载荷会被下一次构建洗掉 —— 按现状判红就是恒红门(§12e)。

## 5d. 模型密钥引导与 `.env` 回填(强制)

- 密钥不入仓、不入聊天记录。权威来源 = 网盘同步目录 `密钥/模型/`(每厂商一个 txt);盘符不写死,统一走 `scripts/lib/key-dir.mjs`(F→D→E→G→C 取存在者;非 node 调用方走 `node scripts/secret-path.mjs <子目录> <文件名>`,stdout 恒为路径绝不含凭据;候选序解析器必须同时提供「出处」出口 `resolveKeyDirDetailed()`),env `IHUI_MODEL_KEY_DIR` 可覆盖。
- 回填:`node scripts/env-backfill-model-keys.mjs --verify` 巡检 → `--verify --apply` 写盘;只写空值键、绝不覆盖;apply 前自动备份;输出恒脱敏 `前6***后2 (len=N)`;判读只有「鉴权通过」算有效,网络不可达 ≠ key 无效;换机后 ai-service 静默降级首选跑本脚本。node stdout 的中文路径会被 GBK 码页吃掉——凡"读回来继续用"的值,调 node 前 `[Console]::OutputEncoding = UTF8` 并 finally 还原。

## 5e. 运维到人通知 = 邮件单通道(强制)

- 告警/运维到人只有邮件一条通道,第三方推送腿已整体摘除;配额只按身份去重(默认 4h),**禁止自设每日总量上限**(撞顶 = 静默丢投递)。发信一律经 `apps/api/scripts/notify-deploy-failure.ts`(版式唯一源 `email-templates.ts`,守门 81 硬拦自拼 SMTP);多行中文正文走 `--message-file`(无 BOM UTF-8);调用方不得传 `--env-file`。
- **告警"可整改性"准入(5e-1)**:判据挂到人通道前必须回答"红了收信人能做什么"——能整改给可执行下一步;不能整改但合法进白名单写明理由;判据本身有问题就拆/撤。同一故障按稳定语义身份去重(dedupKey = 类别+计数,不按会抖动的明细清单)。
- **删除类运维动作不得推回用户(5e-2)**:"需要你手动跑 X"禁止对用户说;agent 自己查端口/进程、自己清、自己验证、只汇报结果。唯一例外 = 需用户职权的动作。大批量删除正解 = `robocopy /MIR` 镜像空目录(独立进程,不经 node fs 守卫;exit 2=成功);深路径先 rename 到短路径再删;Git Bash 传参会吞 `/MIR` 必须走 PowerShell。递归删除前核验三件事:已摘登记面/无进程持有/无未入库工作。失败必须响(UNDELIVERED 标记 + 下次成功自动清)。
- 通道"可用"必须被量到,不能靠"没人记下失败";改通道改完必须重启对应服务;判断"执行的是哪份文件"按 `nssm get <svc> AppParameters` 实际路径,不按 `git ls-files`(`deploy/prod-bundle/` 运行副本可与入库源不同,影子对账由 `check-prod-bundle-shadow.mjs` 判逐字节等值)。
- **发信量必须量得到,而且量的必须是"身份"(5e-3,2026-10-18 立)**:每一次投递尝试(成功**与**失败)都由发信层追写 `.ihui-agent/state/mail-send-ledger.jsonl`(ASCII 键 + ISO 时刻,身份只存 fp 前缀,收件人只存脱敏形态),量算仪 `alert-volume-report.mjs` 的"①b 发信面之二"按 `(producer, fp)` 数 24h 封数、同身份 60 分钟内 ≥2 封即点名风暴。立因是当天现读的一个**盲区**而不是噪声:该工具判据写死"ASCII 关键字 + 时间戳,中文一律不解码",而 git-guardian 的人到留痕是中文散文行 ⇒ 那天寄出 28 封(其中 18 封是同一场停摆),它账面上 `MAIL=0 封 / 0 个签名` —— **风暴判据结构上打不到最大的发信面,"一直在报警"这件事本身没人看得见**。同一天立守门 224(`check-alert-identity-volatility.mjs`)从源头拦"把 sha/时刻/原始计数/异常原文写进去重身份";量与拦必须同批,只装一边都算没修(只拦 ⇒ 下一种抖动没人识;只量 ⇒ 看见了还是照寄)。取不到台账一律落 `null`/未判定,**不得用 0 冒充"没寄过"**。

- **出口台账三条实测边界(2026-10-19)**:① 行身份 = `schema 2` 的 `source + alertId + subject`;未给 `--alert-id` 的调用退到"折过数字的标题"分桶,git-guardian 已传真身份(`buildGuardMailArgv` 的 `--alert-id`)。② CI 寄的信在本机无账(它在自己 checkout 的 `.ihui-agent/state/` 下写行,临时 runner 随 run 销毁)。③ 人读档"去重压住 N 轮"只算**出口** `--alert-id` 窗口压住的轮数,各生产者自压的轮次走不到出口。三处边界登记在 `scripts/data/alert-mail-faces.json` 的 `note`/`gapReason`。

## 5f. 本机构建环境与运维硬事实(强制)

- **Rust/MSVC 构建环境注入(2026-10-19 立)**:本机 `C:\Program Files\Git\usr\bin` 在系统 PATH 内且带 GNU `link.exe`,而 `apps/desktop/src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 按 PATH 解析 ⇒ 未加载 MSVC 的 shell 报 `link: missing operand after '\377\376'`,报错不提工具链。唯一真相源 `scripts/lib/msvc-env.mjs`(纯判据零 IO;`vswhere` 返回 `[]` 时用已知安装位兜底;PATH 键大小写不敏感;剔 `<Git>\usr\bin` 并前插 MSVC bin),入口薄壳 `scripts/desktop-build.mjs`(`--debug`/`--dev`/`--no-artifact-check`/`-- <透传>`);取不到工具链 ⇒ 显式「未判定」exit 2,绝不回落裸 env。已接线:`apps/desktop/package.json` 的 `build`/`build:debug`/`dev`/`dev:cdp`、`desktop-build-saas.mjs`、`desktop-dev-saas.mjs`、`release-desktop-local.mjs`;裸 `tauri build`/`tauri dev`/`cargo build` 不注入。**平台闸**:注入只对 win32 成立,macOS/Linux 用 clang/cc;判据单源 `needsMsvcInjection`,三个调用点都要问它(闸必须排在 planBuildEnv 之前);禁反向断言"文件里不许出现 `platform==='win32'`"。取证 `scripts/tests/desktop-build.test.mjs`(38 例)。
- **读 cmd 输出必须先 `chcp 65001`**:cmd 写管道用当前 OEM 码页(本机 936 GBK),Node 按 utf8 解会静默改写中文路径;`captureVsEnv` 命令串必须以 `chcp 65001 >nul &&` 开头。
- **`--dev` 档 Ctrl+C = 正常结束**:`judgeInterrupt` 收 130 / `0xC000013A` / `SIGINT`,命中即打印实际观测到的那一个并按 0 计;build 档不享受(被打断仍是"这次没建成")。
- **Android 原生构建 MAX_PATH(2026-10-21 立)**:`react-native-worklets` 的 CMake 报 `build.ninja still dirty after 100 tries` 或 `mkdir(... .pnpm/react-native-worklets@0.11._…): No such file or directory`,是 Windows 260 字符路径上限,不是缓存脏:`LongPathsEnabled=1` 已开而 SDK 自带的 ninja 1.10.2 不认长路径。修法 = 换 ninja 1.12.1 覆盖 `Sdk/cmake/3.22.1/bin/ninja.exe`(原版备份 `ninja-1.10.2.exe.bak`);`CMAKE_SUPPRESS_REGENERATION=ON` 只消 dirty 循环,`CMAKE_OBJECT_PATH_MAX` 无效。模拟器 debug 包连 Metro 走 `10.0.2.2:8081`(本机 AVD 的 `adb reverse` 不通),且须先清模拟器全局 `http_proxy`。
- **未签名本地打包豁免必须两段同时生效(2026-10-19)**:本机无 minisign 私钥,签名步 exit 1 会让其后钩子根本跑不到。正解单源 `scripts/lib/desktop-unsigned-config.mjs`:① 给 tauri 传只关 `bundle.createUpdaterArtifacts` 的临时 config(`.ihui-agent/tmp/<slot>/`,用完即删且内容对不上绝不删);② 同 env 透给尾部收敛钩子(`desktop-artifact-single.mjs`)放行"缺 `.sig`"。未设 `DESKTOP_ALLOW_UNSIGNED=1` 仍判红;产物不得进更新源/发版/CDN。
- **npm 发布不启用 2FA(用户 2026-10-19 定案,永久有效)**:不得再提议/询问扫码绑定安全密钥、Windows Hello、USB key、TOTP,也不得登记 Trusted Publisher;发布一律走 granular token(`bypass_2fa`):本地 `~/.npmrc` 的 `ihui-cli-publish`、CI 的 `secrets.NPM_PUBLISH_TOKEN`;OIDC 步骤失败属预期,由 workflow 自动回退。
- **隧道腿健康只读哨兵**:`check-tunnel-leg-health.mjs` 量 Cloudflared 腿存续与源地址退化(netsh 首选寿命 0s 或 deprecated ⇒ breach),三态 ok/breach/unjudged 逐维独立,单点共用只 warn 报放大因子;不进提交链,公网入口断流时由 git-guardian 报警。
- **`deprecated-source` 是节律现象,不是工单**:本机 v6 源地址约每 12 小时退化一次,重启 Cloudflared 实测约 3 分钟入口 530。收到信先看 `held=` 与 `restart-churn`:同日已重启或崩溃循环正在抖 ⇒ 不要再重启;真要动挑无人窗口并预先告知影响时长。

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
cd apps/ai-service && mypy app --ignore-missing-imports --strict   # Python 类型
pnpm check:pytest                             # Python 用例唯一入口(透传: pnpm check:pytest -- tests/test_x.py)
pnpm dev                                      # 启动所有服务(端口见 docs/port-management.md)
```


## 7. 删除/重构安全规则(强制)

删除任何 git 对象(分支/stash/commit/文件)前必答三问:①承载什么功能?②有无等价实现?③无 ⇒ 不可删,先迁移/开发替代。禁止基于"路径不兼容""看起来是垃圾"擅自 drop;stash drop / branch -D 同样适用。

## 8. goal 模式工作流(强制)

- 目标条件硬门槛(单条 ≤4000 字符):核心任务 + 验证标准 + 约束边界 + 质量要求 + 异常处理,缺一拒绝启动。
- 运行时文件:`.ihui-agent/goal-runtime/STATE.md`(状态机 active/paused/achieved/blocked/budget_limited)+ `loop-run-log.md`(逐轮追加)。
- 7 步循环:目标解析 → 单轮执行 → 独立评估(禁模型自评 yes)→ 循环判定(连续 3 轮 no 无进展 ⇒ blocked)→ 最终交付校验 → 状态清除交还 → 摘要入 PROJECT_PLAN + 清理运行时文件。
- 红线:单目标 ≤20 轮;高危操作必须暂停等人工;严禁扩展需求;每轮完整承接上下文;连续 5 轮工具失败 ⇒ blocked。blocked/budget_limited 下**禁止** `git reset --hard`/`checkout .`/`clean -f`;必须在 PROJECT_PLAN 记录现场,回滚决策权归用户。

## 9. 多端同步开发强制规则(强制)

- 每个任务默认 8 端同步开发:"匹配连通好" = 代码同步 + 链路打通 + 验证齐绿;禁止只改一端交付、单端验证、分期交付。平台独占豁免须在 PROJECT_PLAN 显式标注。主 agent 用 §11 按端拆 subagent,跨端契约对齐不下放。
- **登录/SSO 链路跨端自动同步**:共享登录 UI 只覆盖 mobile-rn,miniapp 登录页独立实现,两端都要动;deep-link scheme:mobile-rn/desktop `ihui://sso/callback`、miniapp `ihui-miniapp://sso/callback`,新增 scheme 同步登记 `SSO_ALLOWED_DEEP_LINK_SCHEMES`;web OAuth 中转页 + `apps/web/app/sso/*` 出口页。
- 守门(warn):`check-multi-end-sync.mjs`(pre-commit 第 21 项)。

## 9b. 单分支开发强制规则(强制)

- 除 main 外禁止新建分支;普通功能/修复/重构/文档一律 main 直接 commit。豁免(逐条点名不静默):`/goal` 的 `goal/*` 临时分支(完成立即删)、48h 在飞窗口内的 PR 分支、linked worktree checkout 分支及其 origin 镜像、镜像远端与幻影引用、stale 远程跟踪引用(出路 `--refresh-remote`)、**`backup/` 与 `ihui-backup/` 引用永不判红**。已合并分支本会话内删净;删未合并分支前必须 tag 备份(§22)。日常 `git fetch origin --prune`。守门:`check-single-branch.mjs`(41,blocking;在飞窗口 `IHUI_SINGLE_BRANCH_GRACE_HOURS`,阳性对照 = 窗口设 0 全翻红)。

## 10. 交付报告一致性硬约束(强制)

交付报告必须与实际产出一致:声称完成的每条给出验证证据(typecheck/test/守门末行现读),禁止"已完成"却没有对应 diff/测试;报告含后续建议与 P1-P5 优化项时不得与"无后续工作"互斥(判据见 `check-delivery-report-consistency.mjs`)。

## 11. 多 Subagent 并行开发强制规则(强制)

任务分配格式(强制字段):任务目标 / 受影响文件(绝对路径,只允许清单内)/ 禁止修改 / 验证命令(子任务完成后必须自行运行)/ 约束边界 / 交付物。**我方现状格(强制,G-830)**:派单前写明当前分支/HEAD、相关文件在飞状态、已有等价实现;前提自检声明"本格内容按当次实测填写"。门不得读自己(判"前提是否腐烂"的门扫被审面,不扫自己)。

## 12. 多会话并行操作同一仓库强制规则(强制)

- **强制 `scripts/safe-commit.mjs` 五步法**(真实事故根治):①暂存文件清单回显 → ②只 add 本任务文件(禁 `git add .`/`-A`)→ ③commit 带 pathspec(只提交声明集)→ ④推送 → ⑤回读验证 local == remote。禁止裸 `git commit`。
- **git 写锁**:`scripts/git-lock.mjs`;部署/构建全局锁 `deploy-lock.mjs`(meta 记 host+pidStart,`pidStart` 量的必须是"判活所问的那个 pid";判活再加一环 = 身份凭据;只有 `mismatch` 给抢占授权,先归档现场再抢;`check`/`release` 不现测)。dev 入口统一 `scripts/dev-with-warmup.mjs` 启动器(拿锁在 spawn 之前;破坏性步骤必须在 acquire 后、next dev 前)。
- **stash 全面禁止**(多会话共享工作区 stash 会吞他人现场);跨会话现场隔离用 git worktree(§12d)。
- **12b 协作收尾 SOP / 12c 并发 commit 防混淆 / 12d worktree 隔离规范**:commit 前 `merge-live-doc.mjs --file <活文档>` 对账(lost/superseded/stale 三态;提交后立刻 `git show <新提交>^..<新提交>` 行级对账,有丢失就地回补);converge 用 merge-tree/commit-tree 只推进 HEAD+index 不 checkout,工作区落后 HEAD 时 `git add <file>` 交的是旧基线(守门 84 R1 拦,判据 = 暂存 blob≠HEAD 且等于某祖先版本)。
- **12e 恒红门优先级(强制)**:与提交内容无关的红门唯一结局是人人 `--no-verify` 连带废掉全部守门——**修红不得顺手削判据**;存量未清时上 blocking = 恒红门;升档前置 = 存量归零。
- **12f 恒红门优先级(同日三道实测)**:同型。判据失效的表现永远是安静;凡"文档写了出路"必须实测真跑得通。
- **12g 派生 git 必须显式接管 stdio(2026-10-03 立,EBUSY 实测)**:本机任何派生 git 必须显式写 `stdio`(不写稳定 EBUSY;`shell:true` 经 cmd.exe 100% 复现;绝对路径不是豁免)。样板:`const stdio = opts.input === undefined ? ['ignore','pipe','pipe'] : ['pipe','pipe','pipe']`(带 input 必须 `['pipe','pipe','pipe']`)。判据门:`check-git-stdio-discipline.mjs`(193,括号配平取整个调用、只判属性名不判取值、禁行内豁免,豁免走具名台账)。反向门 `check-spawn-output-channel.mjs`(199):stdio 丢 stdout 又去读 ⇒ 结论恒 null,拦。任何"这行是否必要"的判断必须 ≥20 次成组对照,单次成功不构成"不需要"的证据。

### 12h. worktree 生命周期(强制,2026-10-21 立)

- 落点 = 根直属 `.worktrees/`;收尾五步:①合并/裁决 → ②提交并推送 → ③回收检出 → ④删已并入分支 → ⑤`git worktree prune`。未合并的检出**不得静默删**:先打 `lost-commit/worktree-<名>-<sha7>` 标签保活,合并决策权归人。
- 2026-10-21 撤装:自动回收器 reap-worktrees.mjs 与计划任务 IHUI-Worktree-Reap 已卸载(回收改由收尾五步人工执行);ensure-silent-tasks.mjs 的 ④ 回收链路监视段随之摘除,不得复活。

## 13. 文件修改持久化强制规则(强制)

写盘后必须 Read 验证修改生效,禁止只凭工具返回"成功"就声明完成(缓存/缓冲会让磁盘与预期不一致)。

## 14. Agent 自主验证强制规则(强制)

交付前必须自主运行验证命令(§6)并贴末行现读;禁止把"我写的应该没问题"当验证。

## 15. 工作区卫生强制规则(强制)

- 临时文件一律 `.ihui-agent/tmp/<任务名>/`(gitignored),任务完成清理;路径推导用 `$PSScriptRoot`/`import.meta.url`,禁硬编码绝对路径;ROOT 由脚本自身位置推导,禁 `process.cwd()` 定根(共享工作区 cwd 不可靠,守门 70 镜像 13/14 恒红同型)。
- **15b 项目外落点唯一制**:项目外落点只允许批准目录(`D:\DevEnv\{Temp,logs,backups,cache}` 等);临时夹具唯一落点 `scripts/lib/scratch-dir.mjs`(`mkScratch`/`rmScratch`,工作树同盘 `DevEnv/Temp/ihui-scratch`,**不得** `os.tmpdir()`(TEMP 可能钉 C 盘)、不得落仓库树内(git 夹具会向上逃逸到真仓));两把只读尺子 `check-scratch-root-no-nesting.mjs` / `check-fixture-tmpdir.mjs`。守门 `check-workspace-hygiene.mjs`;`check-temp-landing.mjs` 为配套只读对账工具(未接提交链)。
- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-no-nested-git.mjs`,blocking,`stagedTriggers: ['scripts/']` 把射程收到"能造出该状态的那一面";全量档一律跑):2026-10-14 实测——测试夹具在仓库内 `git init` 且**无任何清理钩子**,中断即永久残留 52 个演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净(机主一度无法判断自己有没有活没交)。需要临时 git 仓的夹具一律走 `mkScratch()`(§15b,工作区外 + 进程退出自动回收)。射程外只有一格:扫根直属一层的 `.worktrees/`(§12d 规定的 worktree 检出落点,linked worktree 天然带 `.git` gitfile,判红就是逼所有人不开 worktree 的恒红门);同名目录出现在更深位置照旧命中。〔补登@2026-10-20〕同一仓**已注册的** linked worktree 不再靠落点位置豁免,改由门按 `gitfile⇄admin 面双向核验`分流并逐条打印(悬空 gitfile / 回指伪造 / 指向他仓 admin / worktree 内再长出 `git init` 夹具 —— 四种照旧红,镜像 ⑦ 钉死);立项凭据是 §15「临时件落 `.ihui-agent/tmp/`」与门 208 头注「worktree 落 `.worktrees/`」互相打脸,同一组路径 10-15→10-20 六轮登记→腐烂回潮;而照其第一条出路重登记必被门 84 判「行级复活」(208⇄84 互斥,票 O508)。故另设第二把载体 `scripts/data/no-nested-git-sites.jsonl`:每处一行、只记意图与归属/到期,**存续由门在判的那一刻现算**,失去命中只 ⚠ 不清红;旧 JSON 台账的语义与腐烂红一字未动(镜像 ⑨⑩ 钉住"未命中免不了任何东西、到期不免、坏行零免")。另 `entryBudget` 定档出处:2026-10-20 现读全树 207,268 条目 / walk 1,274ms ⇒ 原 200,000 必被顶穿 = 恒 `truncated` = 恒红(§12e),已抬到 1,000,000,属只增不减覆盖面的加强档。
- **15d 盘根写入回归锁**(守门 213 `check-disk-root-write.mjs`,blocking,无 stagedTriggers=任何提交都跑):扫描仓库代码里“往磁盘根(D:/G:/C: 一级,即项目树与 DevEnv 之外)写文件/建目录”的模式,对**本次提交新增**的判红(差值棘轮,锚点 = 该文件 HEAD 自身 W1 数;存量只报数不判红,§12e 恒红门禁令)。与 15b 的**盘上**卫生 `check-disk-root-hygiene.mjs` 互补——那道守“盘上别留垃圾”,本门守“代码别再产新的”(把生产者堵在提交口)。收窄集 = literal 首段 ∈ `{IHUI-AI, DevEnv}`(§15b 批准落点,精确匹配非前缀)不立 W1;已知合法生产者走豁免台账 `scripts/data/disk-root-write-exemptions.json`(`{file, reason, ticket, until}`,到期回队列重裁)。配套影子工具 `scripts/quarantine-disk-root-strays.mjs`(只读预演“将会隔离什么”,未接自愈链)。应急放行 `HUSKY_SKIP_DISK_ROOT_WRITE=1 git commit ...`(不推荐)。

## 16. Push 阶段跨 Agent 改动保护规则(强制)

push 前必须确认远端无并发会话新提交(`git-push-converge.mjs` 六态);非快进一律走 converge,禁止强推;commit 污染防护 = `.husky/commit-msg` 的 `check-commit-scope-consistency.mjs`(跳过 `HUSKY_SKIP_SCOPE_CHECK=1`)。

- **16b 推送协议(2026-10-22 机主令,提速到极致)**:只说「推送」时**第一动作固定为 `git push origin main`**,禁止先预判冲突去跑 merge/converge/读工具源码;仅当 push 以 non-fast-forward 失败才进入收敛,且收敛最多一轮 fetch→converge→重生成派生件(README 数字 `gen-doc-numbers --markdown`、`ui-routes` 钉)→再 push。收敛产物(合并树上的生成文件)用普通 `git add` + `git commit`,不再叠 safe-commit/AGENT_SCOPE。
- **16c 钩子装载位对账**:`core.hooksPath` 必须指向真实存在的钩子目录且 `pre-commit`/`post-commit` 齐备(守门 226 H3)。2026-10-21 实测 `core.hooksPath=.git/no-hooks`(目录不存在)⇒ git 静默跑 **0 个钩子**,post-commit 自动推送/双备份停摆两天、本地积压 7 枚提交才在手工收敛时暴露(失效方向是安静,§12f)。

## 17. UI 改动验证强制规则(强制)

UI 改动必须真机/真浏览器验证(截图或 e2e),禁止只凭代码审查声明"改好了";web 样式改动 commit message 带 `Verified-DOM:` trailer(`check-style-verification.mjs`,warn)。

## 18. 启动项目语义(强制)

"启动项目"= `pnpm dev` 全栈(web+api+ai-service);单端启动须显式说端名。`dev`/`dev:clean`/`dev:stable` 三条入口统一走启动器(拿锁在 spawn 前)。

## 19. i18n 约束规则(强制)

- 翻译文件语言纯度:zh-TW/ko 阻塞中文残留、ja warn(`scan-i18n-zh-residue.mjs`);en 破损检测 `check-i18n-broken-en.mjs`;parity `check-i18n-keys.mjs`(五语言键集对齐);**新增状态词必须同批补齐五语言**,禁止端内硬编码中文(`scan-hardcoded-zh.mjs` 70,基线棘轮)。
- **JSON 重复键禁止**:JSON.parse last-wins 静默遮蔽;同层重复键守门 `check-i18n-duplicate-namespaces.mjs`(2e-dupns,blocking)。
- 翻译策略 source of truth:`scripts/brand-glossary.json`;ICU 插值走 `t(key,{vars})`,禁 `.replace('{{n}}',…)` 反模式(`check-miniapp-replace-antipattern.mjs`)。
- parity 绿 ≠ 语种对:批量落 i18n 后必须逐语种量 CJK 三族互判 + 扫同名自套一层(`{"x":{"x":…}}`),这两型现无门,人工必查。

## 20. 任务完成硬定义(强制)

5 条全满足才可声明"完成":①代码合入 main 并推送;②验证齐绿(typecheck/build/test);③守门全过;④PROJECT_PLAN 翻勾;⑤交付报告带证据。commit 后忘记 push = 协作事故;4 道自动防线:post-commit 自动 push / push-state 跟踪 / converge 核验 / 任务完成定义。工具失联按流程升级,不得静默放弃。

## 21. 功能开发同步更新 README 规则(强制)

触发:新增功能模块/API 路由/页面/端能力。强制动作:同 commit 更新 README(功能说明 + 使用方式 + 所属端),缺一视为交付事故;豁免:纯内部重构/修复。守门(warn):`check-readme-sync.mjs`、`check-readme-table-integrity.mjs`。

## 22. 防止 commit/push/merge 提交丢失硬性规则(强制)

- 任何丢 commit 风险操作(reset --hard/checkout ./clean/filter-branch/rebase)前:先备份(tag `backup/cleanup-<date>-<branch>` 本地+远端双留),再操作;**已合并分支删除同样先确认远端在**。
- 守门 30a `check-commit-loss-guard.mjs`(blocking):reflog 50 步 + 远端 tag 校验 + tag 可达性 + **悬空 commit 30 天窗维**(2026-10-11 立:近 30 天内新产生且无 `lost-commit/*` 备份的悬空 commit 阻塞,须先 `git tag lost-commit/<name> <hash>` 再 commit;超窗只报数 = §29 人工 GC 存量;时刻读不到 ⇒ 保守算窗内照拦;`--window-days 0` 回全量语义,`--strict` 问责存量)。tag 自动同步 + 全命名空间一致性校验:`sync-lost-commit-tags.mjs`(`--check` 比名字 + SHA,覆盖全部命名空间;仅本地/同名 SHA 分歧/备份族仅远端 ⇒ exit 1,非备份族仅远端只告警;本脚本不在提交链注册表,post-commit 只跑 `--auto-push`);永久档案 `docs/lost-commit-archive.md`。
- reset 丢失的 commit 永久记录于 tag;守门 100 `check-merge-addition-loss.mjs` 拦合并吞掉对侧独有新增(A1:P ∈ 某父 ∧ P ∉ 基底 ⇒ P 必须 ∈ 结果;默认只判未入 origin/main 的合并,增量台账判到一次);守门 168 `check-merge-deletion-resurrection.mjs` 拦本侧删除被合并写回(DR1/DR2;豁免 = 提交信息 `intentional-delete:` 或具名 allowlist)。归并修复出口 `scripts/union-converge.mjs`(集合运算:本侧整树 ∪ 对侧自改路径 ∪ 活文档行级 union;落地前零丢失自证;`--take-ours` 是声明式例外,必须逐条附两版取证)。

## 22b. staged-typecheck 闸门(2026-08-18 立)

全量 include + 错误过滤:暂存面 typecheck 必须全量 include(临时 tsconfig 摘 include = 假绿),错误按白名单过滤;退出码约定:0 成功 / 1 业务失败 / 2 脚本自身异常。守门集成 + 镜像 `check-staged-typecheck.test.mjs`;红线:禁止临时缩小 include 面消红。

## 22c. 镜像常量守门模式规范(2026-08-18 立)

- **三步根治**:①源脚本 export `__test__ = { 核心函数 }`;②镜像测试 `import { __test__ as X } from '../source.mjs'` 直接用生产判据;③守门 `check-staged-typecheck-mirror-sync.mjs` 三阶段检测 export/key/import 锚点。**禁止在测试里复制一份判据常量**(必然漂移;跨门判据 `check-test-judge-not-replicated.mjs` 191,warn,行内出口 `judge-replica-exempt`)。
- 通用形态锁:镜像测试还须断言"注册条目 blocking+skipEnv 成套(装车证明读 HEAD 面 runner)""未注册时头注不得自称已接线""全 runner id 不得重复(反查法)"。

## 22d. `isDirectRun` 模式规范:ESM 脚本"双形态"入口守护(2026-08-18 立)

`.mjs` 工具脚本需同时支持 CLI 直执行与被 import,顶层直接 `main().catch(...)` 会让测试 import 时触发主流程副作用。模板(底部顶层,export 之后):

```javascript
import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {/* 暴露给测试的核心函数 */}
```

红线:`main()` 必须是 async/Promise;禁手拼 `'file:///' + process.argv[1]`(Windows 反斜杠永不匹配,必须 `pathToFileURL`);守卫放顶层不放 main 内部;`.cjs` 不适用(用 `require.main === module`)。跨门判据 `check-direct-run-guard.mjs`(194,blocking,差值棘轮,豁免只走具名台账 `scripts/data/direct-run-guard-exemptions.json`,无行内豁免)。

## 23. `.gitignore __*` 规则静默忽略 `__tests__/` 教训(强制)

`.gitignore` 的 `__*` 规则会静默吞 `__tests__/` 目录且 `git status` 完全不显示。硬规矩:项目内测试目录用 `tests/`;新建目录前 `git check-ignore -v <path>` 确认不被忽略;守门 `check-test-paths.mjs` 拦被吞的 `__tests__/`。同理警惕 `.cjs` 静默忽略(NODE_OPTIONS 钩子必须 `.mjs`)。

## 24. 新增功能须用户确认强制规则(强制)

触发 = 引入 PROJECT_PLAN 清单之外的新能力。强制动作:暂停 → `AskUserQuestion` 确认(目标/范围/是否入 PLAN 及优先级)→ 显式同意后才开发 → 补登记 PLAN → `feat:` 前缀。红线:禁止未确认直接开发、禁止伪装成修复绕过、禁止"写完了你看下要不要"代替事前确认。豁免:用户本轮明确要求、goal 目标内含、纯修复/重构/测试/文档、PLAN 已有条目细化。

## 25. `verify-*.mjs` / `verify-*.ts` 临时验证文件归档规则(强制)

临时验证脚本放 `.ihui-agent/tmp/<任务名>/`,禁止放 apps/* 根目录或 `.ihui-agent/` 根目录,禁止 commit,禁止留 v1/v2/v3 版本号后缀;`git add` 只加本任务文件。豁免:正式守门脚本(`scripts/check-*.mjs`)、测试文件、已纳 CI 的 `scripts/e2e-*.mjs`。守门:`check-verify-tmp-files.mjs`(warn)。

## 26. C 盘防护强制规则(强制)

- **所有开发工具全局缓存/临时目录必须指向 D 盘**(`D:\DevEnv\`,实测现值为准):`TEMP/TMP→D:\DevEnv\Temp`、`PNPM_HOME=D:\DevEnv\tools\pnpm`、npm/pip/uv cache、`GOPATH/GOMODCACHE/GOCACHE`、`PLAYWRIGHT_BROWSERS_PATH=D:\DevEnv\cache\playwright`;家目录工具态(`.cargo/.rustup/.m2/.cache/.codex/.trae*/.deepseek/.ollama/.ihui/com.ihui.desktop`(及 G-921 起独立标识的 `com.ihui.desktop.dev`)等)一律 junction 改道到 `D:\DevEnv\cache\userhome\`,**改道机制定为 junction 不 env 优先**(硬编码读取方靠旧路径可解析;换机/重装后重跑)。
- **盘根"写歪项"封口改道不删**:闭源程序按相对路径写盘根,删必复发;唯一正解 = 名字换 junction 指向批准落点。唯一入口 `scripts/seal-c-root-stray.mjs`(`--check`/`--apply`,清单 `SEALED_DIRS` 带 owner+evidence),并挂进 `git-guardian` 自愈轮(`--apply` 的 junction 会被重启清掉,只靠每日体检不够)。
- **junction 头号危险 = 递归穿透**:PowerShell `Get-ChildItem -Recurse` 会穿过 junction 清空 D 盘真实目标。递归删除/枚举前必须判 `ReparsePoint`;断链用 `[System.IO.Directory]::Delete($path,$false)`;量体积不跟随;`attrib +h` 是陷阱(设到目标侧),隐藏用提供器属性 + 父目录枚举回读。
- **junction 管路径管不了身份**:LocalSystem 服务 TEMP = `C:\Windows\Temp`,HKCU 迁移对它无效。服务/守护脚本落临时物必须显式指定目录 + 用完必删(实测部署日志 526 项泄漏即此型);守门扫描面必须并入 `SystemRoot\Temp`。
- **禁止硬编码 C 盘路径作写入目标**(`C:\temp\*`、`C:\Users\*\AppData\Local\Temp\*` 等;用 `os.tmpdir()`/`$env:TEMP`)。守门:`check-c-drive-paths.mjs`(45,源码字面量)、`check-c-drive-pollution.mjs`(93,warn,实地扫 C 盘 + TEMP 漂移判据,只读永不删;`--strict` 问责)。
- **自动维护**:`IHUI C-Drive AutoMaintain` 计划任务(每天 3am,`c-drive-maintain-hidden.vbs` → pwsh;**注册名含空格,查存在只认 `schtasks /query /fo CSV` 全量列名法**);删除出口唯一 `ForceDelete`,`-DryRun` 拦在该出口;删除面按名字白名单不整片删。页面文件改动留"待重启生效"哨兵。
- 改共享注册类文件(runner/package.json/CI)必须逐块核对 diff,防覆盖他人注册块;判据要能让机器自己发现撞号(runner id 反查唯一性)。

## 27. PowerShell 7 强制规则(强制)

- agent 跑 PowerShell 必须用 `pwsh.exe`(7+),禁 `powershell -File`/`powershell -Command`(5.1 的 UTF8→UTF16LE BOM bug、代码页截断);项目内 `.ps1` 第一行 `#requires -Version 7`;**例外**:`deploy/**` 的 `.ps1` 不吃该 pragma(守门 `check-pwsh-version.mjs` 对该面只报名,真判据在调用侧:调 `deploy/**.ps1` 必须显式 `pwsh` 或经 `.vbs` 包装);路径统一正斜杠;`.ps1` 用 UTF-8 with BOM 写。解释器身份是七类现读机器事实之一——两引擎版本差异每次实测,别按 5.1 或 7 的假设写防御代码。

## 28. 根目录整洁铁律(强制)

一级目录只允许 `check-root-dir-clean.mjs` 白名单内条目(配置/标准文档/`AGENTS.md`/`PROJECT_PLAN.md`/标准目录);禁止在一级目录生成 .log/.html/cookies/截图/ad-hoc 脚本,临时产物进 `tmp/`/`logs/`;新增合法条目必须显式改白名单随 commit 提交;任务收尾跑 `node scripts/check-root-dir-clean.mjs --staged`;被忽略的一级条目纳入只告警层。守门 44(blocking,跳过 `HUSKY_SKIP_ROOT_DIR_GUARD=1`)。

## 29. dangling commit 备份策略(2026-08-19 立)

- `commit-loss-check` 检出的悬空 commit 一律备份为 `lost-commit/*` tag 再继续;保留期 **30 天**,GC 由维护者人工触发(守门不擅自删 tag):确认工作区 clean → 列 tag 预演 → 删 → 验证 `git fsck --unreachable`。红线:不推 origin 之外的 mirror;GC 前未确认 clean = 丢工作;一次删 >1000 tag 后必须 fsck 验证再 push;本节定稿后修订走新小节,不回头改。

## 42. React SyntheticEvent 闭包陷阱(强制)

React 事件对象的 `e.currentTarget` 在 handler 返回后置 null:异步回调(setTimeout/promise/memoized 闭包)内**禁止访问 `e.` 任何属性**;同步作用域先缓存字段(`const id = e.currentTarget.dataset.id`)或用 ref 管理 DOM。守门:`check-event-closure-leak.mjs`(42,blocking,括号配对提取异步回调首参搜 `e.X`)。

## 30. 代理与会话面的状态词汇与撤销语义(强制,2026-09-27 立)

- 状态词汇是一等契约:子智能体六态、后台进程六态、阶段性回复三键、截断提示文案,必须走 i18n 五语言同批补齐,禁端内硬编码。**两套撤销语义分离**:代码 `rollback`(回检查点)与会话 `revert`(撤销一次回答及副作用)不得共用标签;机器代批拒绝后必须留人工放行入口。**钩子无终态不得渲染成"完成"**(没有终态就写"已完成" = 本仓最高频失效型)。

## 附加强制条款(2026-09/10 收口)

- **内部机器调用的豁免必须"验过才免"**:豁免与它跳过的校验共用同一判定实现;越权用例断言"未发出查询/未产生副作用"。
- **会话状态**:登出标记必须比凭据活得久、且不同层;判据唯一出口单源。
- **工作队列必须有死亡机制**;收敛链"崩溃 ≠ 裁决"(git-sync-converge/union-converge 三道口径:崩溃退出不得被读成合并失败或成功)。
- **宿主级提示块唯一出口** `apps/cli/src/utils/prompt-boundary.ts`(`frameSystemReminder`/`neutralizeBoundaries`);`[系统提醒]` 裸前缀禁止复用;第三方内容被省略必须留计数行。守门 `check-prompt-injection-registry.mjs`(129)。
- **shared 包非 Node 宿主纯度**:`packages/shared` 可达闭包禁 `node:` 内建导入(126,blocking;修法 = adapter 注入或移出共享面)。
- **声明必须有消费者**:`check-declared-policy-has-consumer.mjs`(121,五类声明 + `create*Handler/Transport` 工厂);**工具契约三面投影单源** `packages/types/src/{tool-contract,schema-projection}.ts`(111/113/115:契约声明、路由身份键 `ROUTING_IDENTITY_KEYS` 禁入模型参数、入参校验 shadow 档默认 off)。
- **批量写计数诚实性**:`check-batch-write-count-honesty.mjs`(134,blocking):`.where(inArray)` 批量写必须 `.returning({id})` 回库确认集合,响应带 `missedIds`,禁把请求侧 `.length` 当 affected;B3–B7 五维只拦新增。
- **provider 健康四档单一真相源**(200):canonical = `apps/web/app/(main)/settings/llm/types-v2.ts` 的 `PROVIDER_HEALTH_STATUSES`(as const),全仓禁第二份同值声明(PV2)。
- **桌面事件接线三层对账**:`check-desktop-event-wiring.mjs`(Tauri emit → listen → 前端注册;"就绪点亮"按可达性判,被抽进被调函数也算,允许一跳)。
- **迁移正文不可变**(185):已进 journal 的 .sql 禁就地改正文(IM1 首次入库 blob 对照/IM2 索引 vs HEAD);守门 49 记账结构(B1-B5 离线,B6-B9 连库)。**受管 `.env` 键值被清空对账** `check-env-drift.mjs`(守护巡检档,判机器状态不进提交链)。
- **元运维巡检轮** `check-ops-patrol.mjs`:看守者本身还活着吗(P1-P6:副本漂移/规则不热加载/时钟失步/无上限/心跳无人判/引用不存在指标)。**服务存续双探测**:`check-service-binary-paths.mjs`(warn,STATE/nssm Application 存在/端口应答,nssm stdout 是 UTF-16)、`check-public-path-probe.mjs`(outage 与常态分序列,取证经 `run-evidence.mjs` 封缄,truncated 不成合格证)。
- **跳门留痕**:钩子失败归因是量出来的(`scripts/lib/commit-gate-attribution.mjs`:逐道复跑、点名本次文件 ⇒ 必修;批没跑完 ⇒ safe-commit 自跑一遍再归因;汇总块必须先过"轮次绑定"锁——之前那次 staged 清单回显必须完整包含本次声明集)。跳门次数唯一真值 = `.ihui-agent/state/safe-commit-attestation.jsonl`。**agent 不得假设"钩子红了就能跳"**。

> 2026-10-25 重复登记副本清偿批(守门 207 体积):速查区回潮摘要副本/索引族重复/同目历史指针,族内一律保留正文现行版(速查版更新者按独有门名与 pre-rebase/三态/侧车 P1 标记择保),被删行逐字在 `.ihui-agent/archive/AGENTS_trim-2026-10-25.md`;§0–§29 规则条款一条未减。

## 关键参考文档

| 文档                      | 说明                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `PROJECT_PLAN.md`         | 唯一任务计划文档(必读)                                                                       |
| `.ihui-agent/archive/`    | 历史归档(只读;含本次压缩前完整原文 `AGENTS_full-pre-compact-2026-10-14.md`)                  |
| `docs/architecture.md`    | 系统架构文档                                                                                 |
| `docs/port-management.md` | 端口注册表(88xx 段;端口表描述部署形态,不判引擎存在性——判引擎先读应用自己的 DSN 再看监听归谁) |
| `docs/UI_GUIDELINES.md`   | UI 规范(§3.1 圆角角色、§4.6 图标对齐算式)                                                    |
| `docs/learning-assets.md` | 学习资产登记(新增/删除工作流必须同步)                                                        |

## 守门脚本速查(压缩索引)

- 原速查整区(约 800 行超长登记)已逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`;本区只留门 89 本体 + 横向口径 + 点名索引(R4 义务:每道已接线门必须在本文或 README 可见)。**mode/blocking、skipEnv、编号一律以 `scripts/guardian-runner.mjs` 注册条目现值为准**(§0.1)。
- **手动全量**:`node scripts/guardian-runner.mjs --staged`(pre-commit 模式)/不带为全量;失败不中断,跑完汇总再 exit 1(子门 exit 75 中断仍立即传播;`GUARDIAN_STOP_ON_FIRST=1` 恢复 fail-fast)。
- **守门接线层对账**(89):`scripts/check-gate-wiring.mjs`(blocking)...**R1/R2** 头注或文档声称已接而五处权威点(`guardian-runner` ∪ `scripts/lib/pre-commit-hook.js` ∪ `.husky/*` ∪ 根 `package.json` ∪ `.github/workflows`+cert)零命中 ⇒ 拦;**R4** 已接线而 AGENTS.md/README.md 通篇未点名 ⇒ 拦(去后缀同名即算,文档面按 HEAD∪索引判,绝不读工作区);**R5** 同 id 登记两门 ⇒ 拦;**R7** dispatcher 依据文件不存在 ⇒ 拦;**R8** `stagedTriggers` 会让 `guardian-triggers.mjs` 当场抛错 ⇒ 拦;**R13** 一个注册对象里出现两个 `id:`/`script:` ⇒ 拦(插号器少写一个 `},` 或字段平铺,后写字段覆盖前写,被吞的那道门从注册表静默消失,R5 看不见它——两个 id 各出现一次,只是同处一个 `{}`)。R3/R6/弱接线只报数。台账 `scripts/gate-wiring-allowlist.json` 只救 R3。
- **横向口径**(适用于绝大多数内容门,勿逐门重抄):全量判 HEAD blob / `--staged` 判索引 blob / `--worktree` 仅人工;两面旗同给 exit 2;取不到判「无法判定」不回落;枚举到 0 判死;棘轮锚点 = 该文件 HEAD 自身违规数;行内豁免须带原因且多数登记守门 108 存活期表;取证 = `--self-test` + §22c 镜像测试,例数以命令末行现读为准;遮罩统一引 `scripts/lib/code-mask.mjs`,方向分两档(判字面量的门只遮注释保留字符串,判代码结构的门注释与字符串都遮)。
- **207 体积对账**:`check-agents-doc-size.mjs`(blocking,预算 96,000 字节,跳过 `HUSKY_SKIP_AGENTS_DOC_SIZE=1`);阈值出处 = 同一份会话日志 1,261,607 B ⇒ ratio 1.000、96KB ≈ 7.6% 的实测锚点,不是拍的整数;阈值/定级以门体头注与 runner 现值为准。
- **门名点名索引**(按主题归堆;编号与档位以 runner 现值为准):**已整体迁 `README.md` 的「守门脚本点名索引」节**(R4 的文档面本就含 README,本文不再重复抄一份;2026-10-25 守门 207 清偿第二刀,原 9 行逐字在 `.ihui-agent/archive/AGENTS_trim-2026-10-25b.md`)。
- **常驻工具清单**(不在 runner、勿当没装车):同迁 `README.md` 同名节末段(两份历史清单已并集去重;原行逐字在 `.ihui-agent/archive/AGENTS_trim-2026-10-25b.md`)。
> 重复登记副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「常驻工具清单（重复登记副本之一）」。
- **生产签出外来工作只读尺子** `check-prod-checkout-foreign-work.mjs`(2026-10-21 立;镜像测试 `scripts/tests/check-prod-checkout-foreign-work.test.mjs`):生产签出工作区/索引 blob ↔ 该签出 HEAD 与 origin/main 两侧逐路径三态对账(duplicate/foreign/unjudged,`staged-untracked` 独立计数列,单列不并桶);判机器状态 ⇒ **不进提交链、不进 CI**(§12e),唯一调度器 = git-guardian 巡检双挂点;只读零写入;立因与两个实现坑见门体头注。
- tracked-but-ignored: `check-tracked-ignored.mjs`(236,blocking,只拦本次**新增**的 gitignored 路径;存量只报数;跳过 `HUSKY_SKIP_TRACKED_IGNORED`)
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
- **完成即删要有器物(2026-10-20 立,10-21 补 H4,10-23 补齐留痕与节拍)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 派发层 `sweepStaleClosedRows`(`intervalMs` 现读 5 分钟)派发,单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。③ **摘了必须留痕**,否则两条回潮防线同时瞎、存量永远归不了零:落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(at/seat/file/kind/commit/baseline);**凭据是"HEAD 有没有被推进",不是落地器退出码**;留痕必须排在落地成功之后(先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行)。④ **union 认台账**:`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 维(判据 import `scrub-declared-removals` 的 `declaredRows`)——台账命中 ∧ 本侧 0 份 ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣;台账取不到 ⇒ 一条不扣;产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,与 `yieldedIdCaps`(让号形态)合起来才堵满「本侧处置权已行使」。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`。
- 上一条的现行口径(三档,原文留档于归档):①**面**——这两处按 §0.4 同面同轮:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;清单与内容不同形 ⇒ "HEAD 缺载荷、盘上副本已补好但没提交"这一型两面各自都"没问题",悬留替红顶绿。②**退出码**——三档:判出缺口 ⇒ 1,**取不到被审面 ⇒ 2 并显式写「未判定」(不记绿也不冒红)**,判通过 ⇒ 0。③**自愈档**——`git add` 只准发生在 `--staged`(紧接着就 commit);全量档/`--push-gate` 档 inject 后**只写工作区、不动索引**(工作区可回滚而索引不可)。取证:`scripts/tests/check-watermark-coverage.test.mjs` W9(三面分叉正控)/W10(三面一致⇒三档全 0,防恒红)/W11(取不到⇒rc 2)。
- **待拍板条目一律禁止(2026-10-23 机主强制令,凌驾本仓一切"呈批等人"惯例)**:台账与计划文档里**不允许存在或新增**任何"待拍板/等人拍板/需拍板/待用户确认"的任务条目——存量逐条由 agent 深度分析后按最优推荐方案直接执行结清(决策与依据写进结清注记或 commit message);增量由守门 130 F11 差值棘轮当场判红拦截(基线 F11 键集地板 `[]` 兼看跳门塞 HEAD 那一型)。§24 的"暂停→确认"流程对本仓**不再适用**。
- `pnpm check:all` = `scripts/all-checks-runner.mjs`(27 条子步骤,跑完再汇总、不短路)+ `pnpm check:dep-links:strict`;末条(第 27 条)是 `check:benchmark-delivery`(票 G-217 补接,此前造好未装车 = 没有)。**它的牙有三态**(G-217 补牙@2026-10-23):`--strict` 下"判不出"、"台账腐烂(docAnchor 找不到/重复登记)"或"仍存在(文档与代码脱节)且无有效豁免"⇒ exit 2 并把 `check:all` 顶红。合法暂态(等拍板/分阶段落地)唯一出口 = 登记表该条挂 `exemptUntil`(YYYY-MM-DD,会到期)+ `exemptReason`(≥10 字定向说明):缺一半/理由过短/日期形态坏/已到期 ⇒ 视同无豁免顶红;豁免挂在非"仍存在"条上 ⇒ 豁免粘连判腐烂顶红(§0.7 豁免验过才免且会到期,§0.10 不许走成白名单;有效豁免仍每轮打印点名)。
## 24. 新增功能决策口径(2026-10-23 机主强制令修订,原"须用户确认"流程作废)
触发 = 引入 PROJECT_PLAN 清单之外的新能力。强制动作改为:**agent 深度分析 → 直接选定最优建议/最优推荐方案 → 执行落地 → 补登记 PLAN(结清注记写明决策与依据)→ `feat:` 前缀**。原"暂停 → `AskUserQuestion` 确认 → 显式同意后才开发"流程**不再适用**——机主已强制要求所有原属"等拍板"的决策由 agent 代裁代执行。红线不变项:禁止伪装成修复绕过既有判据、禁止留"写完了你看下要不要"式半成品等人验收;拿不准的多方案一律按证据选**最优且可回退**的一档执行,落选方案与理由写进 commit message。PLAN 已有条目细化、纯修复/重构/测试/文档仍按原口径直接执行。
# ↑ 上两行裸 filter 形态已废弃(2026-10-24 定档):绕过 turbo 依赖图,types dist 陈旧时报假红(实测 17 错全为旧 dist 连锁,重建后归零);
#   单端验证必须用下两行 turbo 形态(任务依赖 "^build" 会先重建 @ihui/types 等上游 dist):
pnpm turbo typecheck --filter=@ihui/api       # 单独验证后端(正解)
pnpm turbo typecheck --filter=@ihui/web       # 单独验证前端(正解)
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**;rebase 由 `.husky/pre-rebase` 钩子机器硬拦(2026-10-24 立,凌晨 stash+rebase 烂尾事故根治;逃生口 = `IHUI_ALLOW_REBASE=1` + `IHUI_ALLOW_REBASE_REASON="<≥10字定向说明>"`,stderr 留痕)。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.ihui-agent/state/push-state.json`);**仓库只有 `origin` 一个远端**:国内代码镜像(Gitee/GitCode)与 `mirror-to-cn.yml` 作业已于 2026-10-23 整体弃用并删除,见到残留远端或跟踪引用应删掉而不是修。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。
- **git 网络与推送**:规则唯一面 = 速查区「git 网络与推送」那条(2026-10-24 收敛:本文原有三份副本,只留最新最全的一份)。
<!-- 历次 trim 批(2026-10-13/14/20/21/23)的移出说明与旧口径副本指针共 11 条,已于 2026-10-24 合并逐字留档 `.ihui-agent/archive/AGENTS_trim-2026-10-24.md` 附录;规则条款以本文各编号节为唯一面。 -->
> 本文件为 2026-10-14 / 2026-10-21 两次压缩版(历史原文取法:二次压缩前 `git show 6efeeadc20c^:AGENTS.md`;首次全量归档 `git show 3017301fd0b:.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`,1,262,819 B)。本文与历史原文冲突时以本文为准;历次移出说明见 `.ihui-agent/archive/AGENTS_trim-2026-10-24.md`。
<!-- 「速查区重复登记副本」第 3 批(23 行:L405–L425 整段同题副本 + L429 横向口径 + L433 UI 索引)已逐字移入 `.ihui-agent/archive/AGENTS_trim-2026-10-24.md`;规则本体见 §1/§4/§5c/§5e/§5f/§12/§15/§22 各条与本节 L375–L390,本批未删任何唯一来源行。 -->
- **238 镜像 purge 内容完好**:`check-mirror-purge-intact.mjs`(blocking,2026-10-23 立,射程 10 文档 = 4 版 README + AGENTS.md + 5 个 purge 覆盖文档;判据 M1–M4 全文见门体头注与 runner onFailHint,**此处不重抄** —— 判据字面量恰是本门的禁语,点名行写全会被本门当场判红;一行多条只计最先;绝对零容忍非差值棘轮;自检 19 例、镜像测试 10 例;跳过 `HUSKY_SKIP_MIRROR_PURGE_INTACT=1`)
- **239 计划归档单调性**:`check-plan-archive-monotonic.mjs`(blocking,跳过 `HUSKY_SKIP_PLAN_ARCHIVE_MONOTONIC=1`;HEAD 已归档 ✅ 的票不得复活成未勾活行/逐字孪生回插,自检 `--self-test` 8 例)。**公开 admin 默认口令对账**:`check-public-admin-default.mjs`(package.json 接线;判据与自检见门体头注)。
### 读数不得断行(强制)
- 「一格一读数」格子的**读数必须整条单行**;放不下只能减列/减栏,禁折行、禁截断、禁缩字号。只补 `nowrap` 会把折行变成溢出压邻格(实测 61px),列宽下限与栏阈值须与它同批改(算式与量法见 `docs/UI_GUIDELINES.md` §13)。守门 `check-readout-no-break.mjs`(240,blocking,含"摘掉即翻红"成对夹具);像素够不够本门不判,另用只读尺 `verify-wallboard-readout.mjs --locale <五语言>` 逐格量。
<!-- 「计划/台账」旧副本(缺门 239 行)已逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md;现行唯一面 = 文末含 check-plan-archive-monotonic 的同名行。 -->
<!-- 「API/后端/DB」旧副本(缺 check-public-admin-default G-875 行)已逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md;现行唯一面 = 文末同名行。 -->
- 端侧(RN / 共享源)同一约束,按宿主分五档:**等分格**行加 `flexWrap: 'wrap'` + 格加 `minWidth`(两条缺一不可,只给 minWidth 是溢出压邻格、只给 flexWrap 时 `flexBasis` 是 0 永不触发);**`space-between` 行 / `absolute` 容器**内的读数加 `flexShrink: 0`(否则行宽不够时先压读数、标签反而完整);**定宽格(`width:NN%` / `flexBasis`)**只能靠 `minWidth`(`flexShrink` 是纵向主轴属性,对横向定宽无效)。守门 `check-rn-readout-cell.mjs`(241,blocking,AST 判 JSX 父子关系,存量 69 处已归零),写法见 `docs/UI_GUIDELINES.md` §13.4。
- **索引迁移漏点名补记**(守门 89 R4):`check-ai-task-background-reference.mjs`(247,ai-service 后台任务须走 spawn 唯一出口) `check-money-display-single-source.mjs`(248,分→元展示只许 `formatPrice` 一个出口) `check-registry-sync-health.mjs`(registry 目录同步「静默停更」哨兵,尺子判三态、派发挂 git-guardian 巡检轮;运维旋钮 `IHUI_REGISTRY_EGRESS_PROXY`,明细 `registry_sync_logs`)。三枚只在此点名,README 索引节尚未收录。
- **补记 2026-10-26(守门 89 R4)**:`check-rn-compat-coverage.mjs`(251,blocking,stagedTriggers=rn-compat/config/packages.app/apps.mobile-rn) —— 小程序复用「共享屏源 + 平台 adapter」的覆盖面对账:C1 消费面从 `react-native` 具名取用 ⊆ `apps/miniapp-taro/src/rn-compat` 出口(类型位也算,缺了 tsc 红而 babel 绿)、C2 lucide 名 ⊆ `icons-generated.tsx`、C3 `route-map.generated.ts` 目标页必须真在 app.config 在册;生成腿单源 `node scripts/gen-rn-compat.mjs --write`(名字全集按 HEAD 面现算,写后紧随注入水印),绝对零容忍(补上即绿,无存量可宽),自检 6 例含「摘掉即翻红」。
- **补记 2026-10-26(守门 89 R4,第二枚)**:`fix-package-exports-conditions.mjs`(252,blocking,args=`--check`,stagedTriggers=packages/apps) —— workspace 包子路径 exports 必须对 **CJS 解析条件**可达:只写 `types`+`import` 不带 `default`/`require` 的条目,对小程序 webpack(require/module/webpack/production/browser)与 `pnpm install --frozen-lockfile` 都不可达 ⇒ 跨端取数屏直接编不过。判据保守(单向:只给"缺 default 且缺 require 且有 import 值"补同值,不改既有条件不删条目),幂等自证,自检 5 例含"已有 require 不动""没有 import 值宁可漏补也不编路径";存量已在 `e91d8c38ed96` 一次清零 ⇒ 从第一天起绝对零容忍。
- **补记 2026-10-26(守门 89 R4,第三枚)**:`check-mjs-export-resolution.mjs`(253,blocking,stagedTriggers=scripts/) —— `scripts/` 的相对具名导入必须真存在于目标模块的出口面。立因是实测的一起**安静停机**:`9fdbc207ba2e` 把 `lib/gitdir.mjs` 的 `brokenRefsFromSnapshot` 当残留删掉而消费方 `git-guardian.mjs` 一字未动 ⇒ ESM 实例化期抛,守护任何档都起不来,而所有巡检腿的唯一调度器就是它。三维缺一不可(D3@2026-10-26:调 lib 导出却无 import ⇒ 门一跑 ReferenceError):D1 判本枚改动的消费方,D2 判本枚改动/删除的生产方(削出口而射程内仍有人按名取用)——病灶在生产方,只有 D1 的门结构上打不到。三维都窄在本枚改动集 ⇒ 不因存量恒红(§12e);整面命中只报数(现读存量 8 条全是那笔批量回退的残迹,归属待人工裁,本门不代裁也不白名单化)。自检 15 例含 D2 正控/反向对照/新建面不判;解析不了落 exit 2 不折成绿。
- **跨端造页闭环腿(2026-10-26 立,巡检轮)**:`scripts/git-guardian.mjs` 的 `sweepCrossEndShellPages()` 把 `scripts/land-cross-end-shell-pages.mjs` 从"只能人工敲"变成 30 分钟自跑一轮:blob = `git show HEAD:<file> ⊕ 本批行`(盘上未提交字节一字节不读),结论走 `--json` 的 summary(形状由 `scripts/tests/cross-end-shell-sweep-dispatch.test.mjs` C1 钉住,不手抄);clean 即零写零推,blocked/pending 只写日志不喊人(§5e-1),结论取不到记未判定不记绿。判机器状态 ⇒ 不进提交链(§12e)。**容量上限**:单分包 2 MiB(旧"增大主包"归因已证伪);判据 `scripts/lib/cross-end-subpackage-capacity.mjs`,门 110 **AB3** 兜底。
- **补记 2026-10-26(守门 89 R4,第四枚)**:`sync-rn-tokens.mjs`(254,blocking,args=`--check`,stagedTriggers=packages/design-tokens) —— RN 令牌表落后唯一源 tokens.css 就红:值同步维之外新增**覆盖面维**(生成 `rnCssLight`/`rnCssDark`/`rnCssColor(theme,key)`,把源里有而 RN 无同名档的 174 档整张搬进表;此前 RN 只 49 档 ⇒ 想用源档只能写死字面量,即"web 改一处 RN 不动"的真成因),门 93 R8 禁用值集随之 46→64。自检 41 例。
- **等条件条目同型禁止(2026-10-25 机主令,与待拍板禁令同族)**:台账里**不允许存在或新增**任何挂"等条件/等环境"桶的条目——出路只有三条:**agent 侧能当场做的当场做完**;真卡在机主动作面(供值/凭据/资质/控制台/真机扫码)的**改归属为「归:机主X面」出桶**(归他人桶,不是等条件桶);两者都不是的按观察类结清摘行(事实进 commit message)。机器级时序依赖(如搬迁要静默窗口)的出路 = 把执行**器物化**(探测器自动找窗口),不是挂账等条件。增量由守门 130 F12 差值棘轮拦(基线 F12 键集,存量清偿后收窄为 `[]` 永久地板);派单统计里等条件桶应读 0;不得改措辞绕 v2 尺(§12f)。**兜底清扫器 `strip-banned-buckets.mjs`**(2026-10-25 立,与待拍板 F11 同射程):union 收敛器/复翻席不走提交链 ⇒ 棘轮拦不到"主动写回",由 guardian 巡检轮 `sweepBannedBuckets` 派发(5min 节流)自动摘 HEAD 面两桶未勾行并留痕 f12-purge;判据 import 单源(plan-task-index v2 尺 + readFieldsFace),结论行 SWEEP-RESULT 三态;镜像 `scripts/tests/strip-banned-buckets.test.mjs` 7 例(留痕排在落地之后/落地走 object-space-land 不自带 CAS/已勾行不进射程)。复翻席纪律:复翻 union 带回的行时**必须同步摘禁令形态**(翻勾或改归属),带着等条件/待拍板字样原样回插的行会被本器 5 分钟内再摘。
