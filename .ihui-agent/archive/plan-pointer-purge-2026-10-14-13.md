<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# plan-pointer-purge 存量清偿台账(2026-10-14)

> 清偿 PROJECT_PLAN.md 重复登记存量,用户指令「彻底根治 / 一条也不许再产生」。
> 本轮新增 L5(同题折并 F10)/L6(同主键归并 F4)两层真删行归并:自动档已停产指针注记与
> F10 折叠(plan-tasks-merge noPointer,2026-10-14)⇒ 无注记重复行唯有此处收口。
> 准入闸:① 候选正文被幸存行逐字承载;② 行尾独有注记段移植到幸存行且不命中 13d 判据字面;
> ③ 认领牌走既有转移机制。不满足者逐行跳过点名(见下),绝不硬删。
> 分类:L1 0 / L2 0 / L3 0 / L4 0 / L5 12 / L6 23 / 已勾剥注记 0 / 认领转移 0 / 注记移植 19 / 跳过 7。
> 落地方式:对象空间(HEAD blob → 改写 → commit-tree → CAS),从不写工作树;旁路已 attestBypassCommit 留痕。
> 下列每行为被删行原文(带原行号与分类原因)。

- 原 L4309(L7 逐字孪生折并,保留 L14870):

```
- [ ] **他人现场(非本批账,但会拦所有人的提交链)**:apps/ai-service/app/services/sandbox/(该目录已于 2026-10-12 随 G-188 下线删除) 未跟踪目录
```

- 原 L7547(L6 真归并,保留 L15060):

```
- [ ] G-32 **活文档行 union 会把"本侧已让号删掉的旧形态"从 base/对侧补回来 ⇒ union-converge 落地闸对本侧死锁(归属:union-converge 落地闸持有人;本会话量到并受阻)** —— 现读取证:本侧把 7 枚登记行整体让号(`c8cecd2572`,815951..815957 → 815980..815986,四条断言:键位命中唯一 / 标题稳定片段 / 正文逐字守恒 / 旧号引用只允许是【归并】留痕行)之后,`node scripts/union-converge.mjs` 的 F9 从 7 组降到 2 组,余下两组是 `G-815926` / `G-815930` 与「图标生成器注入 radius-exempt 的恒红与…」——**而本面已经没有这两个键位行**。机理:落地闸只判"合并结果是否放大分叉",不管这行是谁删的;活文档的「每行重数取 max」在"本侧删除、对侧未改"这一格会把 base/对侧那一份重新计成 1 份,于是让号一侧的删除**结构上无法传播**,而 F9 恰恰按合并结果计组 ⇒ 谁也无法让闸变绿,除非有人能在合并面上做真正的删除(§12d/守门 100 的口径:"确要删必须在合并之后显式 git rm" —— 可这一步需要先落一次合并,而合并正被它拦住 = 死锁)。**这不是"再改一次号"能解的**(我已实证:上一轮连让两次,每次都被并发 union 把旧形态捞回,一面上攒出三个编号形态)。**候选出路三条,请择一并给出可判前置**:① 落地闸为"本侧自有旧形态副本"开一条**声明式窄口**(逐条附 file+旧号+让号到的新号+取证命令,照 `--take-ours` 的做法:声明必须可复核、少一项即拒),合并落地后立刻在合并面 `git rm` 幽灵行;② 让行 union 认得"删除"这一维 —— 某行在 base 与对侧都在、而本侧把它改写成让号形态(同标题、异键位)时**不再按 max 累加**,配套必须有一条"本侧正当新增不得被少带"的成对反例,否则就把守门 71/100 防吞行那一族能力废回去;③ 由落地闸持有人在合并面做一次一次性清账(把 815926/815930 的幽灵键位行显式删除并留让号注记)。**在①②③任一项落地前,本机凡是"本侧让过号"的会话都会被这道闸卡住,交付同步不到 origin** —— 本会话的 9 枚代码/判据提交即卡在此(圆角四道门与 face-reader 镜像在被审面全绿,已实测)。**禁止的处理**:为让闸变绿去放宽 F9/F1/F4 判据、把幽灵行算成存量债预登记进基线、或继续第三次改号。 〔2026-09-29 让号:G-815987 → G-32 —— 与 origin 面上一枚同号异题登记撞上(union-converge 落地闸 F9 现读),按 §1「后来者改号、由未推的一侧让号」本侧让;旧形态整行原文已逐字入 .ihui-agent/archive/PROJECT_PLAN_superseded-numbering-2026-09-29.md(门 71 的归档豁免),本行上一条"已还原为本号"的留痕已被本条取代〕 〔改号(2026-10-14):原G-856410〕
```

- 原 L7595(L7 逐字孪生折并,保留 L14871):

```
- [ ] **`git fsck` 恒报 166216 条 broken link/missing，而同一 sha 直查存在 —— 本机对象图状态存疑**。实测三组互斥证据(2026-09-24 04:2x-04:3x，均在 `G:\IHUI-AI` 本机):
```

- 原 L7599(L7 逐字孪生折并,保留 L14872):

```
- [ ] **`stream-tool-ledger` 接线(唯一真正剩下的技术活)——归属是他人、非本批可 finish**:
```

- 原 L7608(L6 真归并,保留 L15013):

```
- [ ] 68. 流式中切换模型 → 终止后自动带入新模型
```

- 原 L7612(L7 逐字孪生折并,保留 L14873):

```
- [ ] **守门 94(errorCode 覆盖率)现在是真红,但红不在内容里,补目录行会制造孤儿条目(2026-09-26 20:5x 实测,归 `llm.py` 持有者)**:HEAD 面 `node scripts/check-error-code-coverage.mjs` exit 1,点名 `apps/ai-service/app/routers/llm.py:3086` 的 `CHAT_MODE_TOOL_BLOCKED` 与 `:3284` 的 `TOOL_MODE_UNAVAILABLE` 未进 `packages/shared/src/chat/error-catalog.ts`。两码同由 `12c685d10e` 引入。**关键读数**:工作树里 `llm.py` 正被并发会话改着,而那两处生产者在它的 diff 中是 **`-` 行(正在被删)** ⇒ 等那枚提交落地,本门自己归零。**处置 = 不动**:此刻按门的提示去补两行目录 + 五语言词包,产出的将是"目录里有、无人产出"的死条目,而 `R2` 只要求台账八类齐备、不反向拦孤儿,门不会替你发现。另需澄清:`check-error-code-coverage` 的红在 safe-commit 的逐道复跑里判 `not-ours`(未点名本次文件),所以它是"合法被跳过"的红 —— 这条登记就是它的出口。
```

- 原 L7613(L7 逐字孪生折并,保留 L14874):

```
- [ ] **本会话开门留下的格(①已闭合且不是我收的,②仍开)**:① 工作树 `PROJECT_PLAN.md` 曾有 3 行(G-206/207/209)停在**归并前的旧 `[ ]` 形态**而 HEAD 已翻勾 —— 正确出口是 `node scripts/heal-worktree-tracked.mjs --align-drift`(判据:索引==HEAD ∧ 工作树==该路径某祖先 ⇒ 才动,可证零独有数据),**不是**手工把整文件按工作树提交(那等于替别人回退归并)。本票落地前复量:`--align-drift` 报「无需对齐(可判定 0 个)」而 `git show HEAD:PROJECT_PLAN.md` 与工作树副本 **md5 同值**(`fe60b0e32b6b3e64e54fa811f87cfba8`)⇒ 对齐已由并发会话/守护一侧完成,不记在自己账上;**这一格的读数必须在提交前一刻重取**,因为它是移动靶。② 门 101 的 **section 级对账**仍未做(上面已开票)。 〔注记〕现读@2026-10-08 heal-worktree-tracked --dry-run 零动作、工作树台账为新鲜现场无幻影漂移,格②实为门101 section 级对账(另有开票),本行残余归属门101持有人
```

- 原 L7621(L7 逐字孪生折并,保留 L14875):

```
- [ ] P1 新登记(接上条,解阻前置已明确):僵尸实例修复。可选方向三条,按仓库既有取向排序 ——(a) WebView2 创建失败即记录 ERROR + 提示并 `process::exit`,**不得**继续启动 `auto_refresh` 常驻循环;(b) 失败时回退到离线兜底页(`lib.rs` 已注册 `offline` 协议,`auto_refresh` 有断网切页机制)而非静默半启动;(c) 查清 single-instance 为何未拦住第二实例。选哪条前必须先复现:同日两次启动的时间差是 14 分钟,尚未取证"主实例处于隐藏态时 siw 窗口是否仍在"。
```

- 原 L7629(L7 逐字孪生折并,保留 L14876):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 app/services/sandbox/(该目录已于 2026-10-12 随 G-188 下线删除) 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【进度@2026-10-08/GOAL-1】进度(2026-10-08,GOAL-1 值守,未翻勾):上一笔注记那句"HEAD 面 54 errors in 8 files"已被本轮改动取代 —— 按票面口径把**未被他人持有**的那一半(6 个文件、15 条)逐条真修入库(枚 526d600106ad14d2f69c6deb000e6da0a602064d):exec_env 的一支绑 tuple、一支当 list 累加的同名 tried 拆成两个名字;ttl_json_store 的 Mapping|list 联合按 isinstance 各分支收窄(不用 cast/Any);mcp_client 成功分支取局部量、对 None 走原有那条带候选清单的大声失败路径;approval_persistence 裸 dict 补成 list[dict[str, Any]];checkin_store 4 处缺参数标注 + 3 处 no-any-return 按真契约钉 str/int;openai_provider 两条语义不同的 done 帧不再共用一个名字。回归载体 apps/ai-service/tests/test_mypy_strict_head_fixes_20261008.py 16 例,含"把修复前 HEAD blob 喂同一把尺子必命中"的出处阳性对照。现读(权威入口经 run-evidence 封缄,complete/RC 均已回读):**42 errors in 5 files** = 15 条已消、零新增错误零新增文件;余 42 条全部不属本行可修范围 —— 39 条在**此刻仍被他人持有**的 app/services/checkin_engine.py(37)与 app/routers/checkin.py(2),另 3 条是 sandbox 拆包在飞(未跟踪 app/services/sandbox/)造成的幻影(tool_input_scanner / mcp_server / agent_loop_v2),HEAD 面上并不存在。两条纪律照旧成立且已被实现验证:未用 type: ignore、未动 pyproject 的 mypy 配置、未加 disable-error-code、未放宽 strict。**本行为什么仍不翻勾**:本行判的是"HEAD 面对该命令必须零错误",42 条里 39 条是仓库真缺陷(只是文件在他人手里),按 §12 不代收;那两位收尾后须由本行复量归零才落账。〔上一笔注记(同日 54/8 files 那次读数)已被本笔按"一个编号只有一行当前状态"就地取代,原文正文逐字保留在本行前半。〕〕
```

- 原 L7645(L7 逐字孪生折并,保留 L14877):

```
- [ ] `reclaim` 改写信封内容的边界:本批只在 CLI 侧由"重建提醒"兜回产物指针,
```

- 原 L7654(L7 逐字孪生折并,保留 L14878):

```
- [ ] **上游第二轮规格派出的票（规格在 `.ihui-agent/tmp/zcode-absorb/MECHANISM-SPEC-2.md`，gitignored）**：
```

- 原 L7655(L7 逐字孪生折并,保留 L14879):

```
- [ ] **接线由主会话单做**（本波四张票都按任务书没碰 `guardian-runner.mjs` / `package.json` / 活文档）：
```

- 原 L7670(L7 逐字孪生折并,保留 L14880):

```
- [ ] 钩子 trust 的**残余面**:webhook 形态钩子仍不过门(本批按 command 收口);
```

- 原 L7674(L7 逐字孪生折并,保留 L14881):

```
- [ ] **本批否证与不作为登记**：`monitoring/alertbridge/alert-webhook-bridge.cjs` 在 HEAD 面上有 **7 处 `no-unused-vars`（`catch (e)` 未用）**，实测与本批改动无关（HEAD 副本同一把 lint 同为 7）⇒ 按"只做被点名工作流"未顺手改；跨行的凭据（关键词与值分居两行）bridge 结构上不命中，已写进文件注释而非只写进报告。
```

- 原 L7707(L7 逐字孪生折并,保留 L14882):

```
- [ ] **`plan-tasks-merge.mjs --dedupe-blocks` 的阈值覆盖不到"两行逐字相同的单行副本"这一型（现读实证：86H 那一条已完成行在 HEAD 面有 2 份逐字相同副本 —— 计数用 `git show HEAD:PROJECT_PLAN.md | grep -c "86H. agent 审批的权限决策落审计链"` = 2；按 §1 判据 3 不写行号，行号在 append 后必挪位）**：该出口只认 **≥3 行且每行 ≥40 字符的连续 bullet 块逐字相同**（阈值本身是对的 —— 低于它会把台账里天然成对的短行成百地报出来，噪声淹信号），于是"同一件事被写成两份、每份都是单行"恰好落在缝隙里；而 F1/F2/F4 也都不计它（四条判据里"待办副本"要求未勾形态，两份都已 `[x]` ⇒ 账面 0，`plan-tasks.mjs --staged` 现读 F 维全 0）。**这一型有两条候选制造路径(本票未定性,不得读成已归因)**:活文档 union 把改写前那份带回来;门 71 的 post-commit 自愈按标记回捞"丢失"的行 —— 若那一行其实是被**就地改写**(旧行已按 §1 留在原位、新行另处再写一份),回捞就会补出第二份。定性要跑一次可控复现(独立临时仓里"改写一行 → 触发自愈"看它补不补),不在本票顺手做。**在等谁**：归并器持有人裁 —— 出路只有两条且都要人拍：a) 给 `--dedupe-blocks` 加"同主键 + 逐字等值 + 已完成形态"的单行档（判据必须是**逐字等值**，半行不同就交人工，理由同它现有那条"机器折半即有损"）；b) 或在门 71 自愈侧改为"编号在面上已存在即不追加"（那是生产者侧收口，比事后清账更对，但要证明不会把真丢行也一并按住）。**不得**由本票手工删行：删已完成行受 §1"禁止无声删除"约束，而两份哪份作数要按主键而不是按行号（§1 判据 3 已把行号指针判为不可用作证据）。
```

- 原 L7711(L7 逐字孪生折并,保留 L14883):

```
- [ ] **守门 150(角色档合规)在 HEAD 面判红 471 族,而它是 blocking:定级与存量锚点未对齐** —— 现读 `node scripts/check-radius-role-conformance.mjs` 末行「判红 471 族 / 已判合规 2215 / 弱证据待裁 93 / 未判定 1」。它挂 `apps/ + packages/`,意味着任何一次提交都要先清偿这 471 族,否则唯一出路是各会话跳钩子、连带其余全部守门作废(§12e 那一型)。归属该门持有者,两条正当出口:① 把这 471 族按"首锚 + 只拦新增"落进它自己的 `anchorRegression` 台账;② 或降 warn + `--strict` 问责。**禁止**为让报告变绿去放宽类别判据或把 card 一律改成 lg —— 弱证据实测判错率 20–70%,批量改档等于重新设计。 〔拍板@2026-10-07 机主:选①——首锚+只拦新增落anchorRegression台账;不降warn不放宽判据〕 〔拍板@2026-10-07 机主:选①——首锚+只拦新增落anchorRegression台账;不降warn不放宽判据〕
```

- 原 L7727(L6 真归并,保留 L14884):

```
- [ ] **G-352. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-351 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 (原编号 G-351) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-351 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 (原编号 G-351)
```

- 原 L9696(L7 逐字孪生折并,保留 L14885):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔2026-09-28 现读更正:前半已收口 —— `apps/api/tests/relay-admin-delete-honesty.test.ts`(枚 `ba0575f9b` 在账)恰好覆盖 4 端点×正常/越权/404 共 16 例,本会话现跑连跑两遍 16/16 全绿,且核实 4 链 ack 全部由 .returning() 集合派生无假 ack;后半(o13-bg-rls-live 串行通道)本会话另派在执行。票暂不翻,待后半落地一并归位。〕
```

- 原 L10071(L6 真归并,保留 L15054):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped @13.6m——2026-08-20 以来 400+ 连红后首次 success)**。连续 3 次 main push 稳定绿后收官(并行会话持续推 main,后续 push 由后续会话按此基准观察;注意并行会话自有改动若再引入失败,以本节根因方法论排查)。CI 迭代实证(每轮根因→修复):44 败(run 34828980145)→ 15 败(34835579747,登录竞争+token 过期清零)→ 12 败(34839041078)→ 1 败(4d4932f run,579/1/1/66 @13.6m)→ 1 败(11f2cf5 run,578/1/2/66 @15.3m)→ **0 败(ac4acf3f run)**。④ 观察 3b 追加:**CSP 根因(产品级)**——`detectStreamBaseUrl` dev 分支仅凭 hostname=localhost:8801 判定,CI e2e 的生产构建 web 同跑 localhost:8801 → streamBaseUrl 跨源直连 8802 → 被 CSP `connect-src 'self' https: wss: ws:` 拦截(trace console 铁证)→ streamChat 无限重试,SSE 用例全灭;修复 = dev 分支叠加 `NODE_ENV==='development'` 门控(commit `4d4932ff`,生产/dev/Tauri 行为不变)。web 构建/运行补 JWT_SECRET(edge 中间件验签,SRO 接管根因,run 34835579747 im-channels error-context 铁证);share-function-test 自建数据 + 消息卡片改轮询(`11f2cf59`)。**教训链:本地 127.0.0.1:8821 同源 + 13.6m 快机,把 CI 的 localhost:8801 跨源 CSP、45.6m 慢机 token 过期、全新库环境依赖全部掩盖**。 〔拍板@2026-10-09 机主授权代行:维持观察口径,首个 GREEN run 后按票面节奏复核,不提前收口。〕〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕
```

- 原 L10160(L6 真归并,保留 L15057):

```
- [ ] **D181 电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态需拍板)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占等拍板桶;依赖立项之日随新号翻勾或注销。〕
```

- 原 L10200(L7 逐字孪生折并,保留 L14887):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。
```

- 原 L10363(L7 逐字孪生折并,保留 L14889):

```
- [ ] **本会话开门留下的格(①已闭合且不是我收的,②仍开)**:① 工作树 `PROJECT_PLAN.md` 曾有 3 行(G-206/207/209)停在**归并前的旧 `[ ]` 形态**而 HEAD 已翻勾 —— 正确出口是 `node scripts/heal-worktree-tracked.mjs --align-drift`(判据:索引==HEAD ∧ 工作树==该路径某祖先 ⇒ 才动,可证零独有数据),**不是**手工把整文件按工作树提交(那等于替别人回退归并)。本票落地前复量:`--align-drift` 报「无需对齐(可判定 0 个)」而 `git show HEAD:PROJECT_PLAN.md` 与工作树副本 **md5 同值**(`fe60b0e32b6b3e64e54fa811f87cfba8`)⇒ 对齐已由并发会话/守护一侧完成,不记在自己账上;**这一格的读数必须在提交前一刻重取**,因为它是移动靶。② 门 101 的 **section 级对账**仍未做(上面已开票)。
```

- 原 L10368(L7 逐字孪生折并,保留 L14890):

```
- [ ] **架构契约表最后一块 `packages/types` 翻不正面 —— 台账旧句"0 个模块 managed:true"已失效(2026-09-28 现读)**: HEAD `config/architecture-policy.yaml` 现读 24 块里 **23 块已 `managed:true`**(表头留痕:api-client 第一块、dom-actions 第二块、i18n 第三块、repo-tooling 第四块、其后 19 块一次批量翻正),**只剩 `packages/types`**,而它被表内制度 + 镜像守卫双重按住:`EX-C2-1`(yaml 内)原文写明"按业务域拆成多入口前,不得把该模块翻 managed:true",现读 `packages/types/src/app.ts` = 5298 行(那条例外里写的 5258 已向上漂移 40 行,又一个抄旧取证的实证)而上限 2000; 镜像 `scripts/tests/check-architecture-policy.test.mjs` 的 `MANAGED_FALSE_LEDGER` 做双向集合对账 —— 径行翻正会让 T13 报"清单腐烂"红,而它不在改判据的允许面内。 所以本票**不是清账动作**:`--managed-trial packages/types` 的 0 红是那条例外遮住的,翻正而留例外=把没收口的块记成收口,翻正而删例外=当场 1 红,两种读法都不满足"翻完不产生新红"。 解阻前置(按序,四步同笔):① 拆 `packages/types/src/app.ts` 至各文件 ≤2000;② 同笔删 `EX-C2-1`;③ 同笔删 `MANAGED_FALSE_LEDGER` 的 types 条目;④ 再 trial→翻正→复跑全量/`--staged`/镜像 16 例。
```

- 原 L10370(L7 逐字孪生折并,保留 L14891):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)**:① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。
```

- 原 L10371(L7 逐字孪生折并,保留 L14892):

```
- [ ] **本票未做的两件(归属明确,不是遗漏)** —— **2026-09-25 更正:① 已由 O76 收口(四处共用一份),② 仍未做**。① **同族修法早已存在,收敛器只是最后一个** —— `git-push-guard.mjs:194-211` 与 `check-push-sync.mjs:118-127` 在 2026-09-12 就改成"`ls-remote` 优先、失败才回退本地 ref",并写明两类真实事故("push 明明成功却报验证失败"、"本地已与远端同步却报落后 N ⇒ 诱导 `pull --rebase`,而本机禁用该命令曾两次删库")。**还剩两处把本地指针当第一真值**:`scripts/union-converge.mjs:479`(`resolveTargets` 用它当合并输入 —— 残值会让"已同步/目标已被本地包含"两档跳过判错)与 `scripts/check-merge-addition-loss.mjs:112`(`pendingMerges` 用它算 `remote..HEAD` 区间 —— 残值要么漏判要么重判)。正解不是再抄一份,而是把 `resolveRemoteHead` **上移到 `scripts/lib/face-reader.mjs`**(它已是注入式纯函数,构造面测试现成),让四处共用;② `alignWorktreeAfterHeadMove` 现在仍"失败只记日志",若长期失败(锁一直被占)应喊到人 —— 那属 §5e 通道口径,不由本票顺手接。
```

- 原 L10373(L7 逐字孪生折并,保留 L14893):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道
```

- 原 L10396(L7 逐字孪生折并,保留 L14894):

```
- [ ] **本线仍未闭环的一件(归属明确,不是遗漏)**:守门 93 的 **R1/R2/R4/R5 那半边仍按磁盘读** 两份 token 源文件,而同文件 R3 段头(`scripts/check-cross-end-tokens.mjs:1367`)自己写着"扫**仓库内容**,不扫共享工作树的未提交缓冲区"⇒ 同一道门两种取材面,AGENTS「口径同 77/83/98:全量判 HEAD blob」对它**只对了一半**。静态证据(本机不得为取证去改共享 token 文件,故不给动态复现):`grep -n "readFileSync(RN_TOKENS_PATH\|readFileSync(TOKENS_CSS_PATH" scripts/check-cross-end-tokens.mjs` 命中 1297/1298/1563 三处主流程读取。**当前不构成红点**(实测两文件工作树==HEAD),按"未引爆不动他人面"登记;解阻判据:任一 `pnpm check:all` 轮里这道门因这两份文件报出与本次提交内容无关的差异,即当场按 R3/R6 同形收口(HEAD / 索引 + `--worktree` 逃生舱)。
```

- 原 L10523(L7 逐字孪生折并,保留 L14895):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。
```

- 原 L10629(L7 逐字孪生折并,保留 L14896):

```
- [ ] P2 **设置页双层页头**:顶上「设置 + 菜单」一条栏,下面又一条「`<` 设置」(`phone-set2.png`)——同屏两个标题、两个返回 affordance。守门 102 **GA6 立的正是这一型,但它现只判小程序端**,RN 端这一型零判据 ⇒ 优先**扩门**而不是手改单点(改单点等于给下一处留口子)。
```

- 原 L14417(L7 逐字孪生折并,保留 L14897):

```
- [ ] **他人现场(非本批账,但会拦所有人的提交链)**:`apps/ai-service/app/services/sandbox/` 未跟踪目录
```

- 原 L14433(L7 逐字孪生折并,保留 L14898):

```
- [ ] **门 35(mypy,blocking)此刻对 HEAD 内容就是红的**:一轮 `mypy app --strict` 有 4 条错误落在 `git status` **干净**的文件上(`app/routers/llm.py:1374`、`app/main.py:257`、`app/services/tool_input_scanner.py:34`、`app/services/mcp_server.py:2333`),另 3 条落在他人持有、此刻在飞的 `app/services/agent_engine.py`。后果是 §12e 那一型:**每个碰 ai-service 的提交都被逼 `--no-verify`,连带约 180 道门对该提交作废**(本票第一枚提交就被它连带跳门,归因记录见 `.workbuddy/safe-commit-attestation.jsonl`)。两条诚实限定:① `main.py:257` 的期望类型定义在别的文件里,严格判"HEAD 面红"要一次 `git archive` 隔离检出后复量;② `tool_input_scanner.py:34` / `mcp_server.py:2333` 是"模块没有该属性",与 `app/services/sandbox/` 的导出面有关,修它可能改动别人的运行时行为而非只加注解。归属:Python 侧门持有者;解阻判据 = 隔离检出复量后逐条定性(真缺陷修代码、过期注解修类型),**不得为变绿去削 `--strict` 或加 `# type: ignore`**。 〔【进度@2026-10-08/GOAL-1】进度(2026-10-08,GOAL-1 值守,未翻勾):上一笔注记那句"HEAD 面 54 errors in 8 files"已被本轮改动取代 —— 按票面口径把**未被他人持有**的那一半(6 个文件、15 条)逐条真修入库(枚 526d600106ad14d2f69c6deb000e6da0a602064d):exec_env 的一支绑 tuple、一支当 list 累加的同名 tried 拆成两个名字;ttl_json_store 的 Mapping|list 联合按 isinstance 各分支收窄(不用 cast/Any);mcp_client 成功分支取局部量、对 None 走原有那条带候选清单的大声失败路径;approval_persistence 裸 dict 补成 list[dict[str, Any]];checkin_store 4 处缺参数标注 + 3 处 no-any-return 按真契约钉 str/int;openai_provider 两条语义不同的 done 帧不再共用一个名字。回归载体 apps/ai-service/tests/test_mypy_strict_head_fixes_20261008.py 16 例,含"把修复前 HEAD blob 喂同一把尺子必命中"的出处阳性对照。现读(权威入口经 run-evidence 封缄,complete/RC 均已回读):**42 errors in 5 files** = 15 条已消、零新增错误零新增文件;余 42 条全部不属本行可修范围 —— 39 条在**此刻仍被他人持有**的 app/services/checkin_engine.py(37)与 app/routers/checkin.py(2),另 3 条是 sandbox 拆包在飞(未跟踪 app/services/sandbox/)造成的幻影(tool_input_scanner / mcp_server / agent_loop_v2),HEAD 面上并不存在。两条纪律照旧成立且已被实现验证:未用 type: ignore、未动 pyproject 的 mypy 配置、未加 disable-error-code、未放宽 strict。**本行为什么仍不翻勾**:本行判的是"HEAD 面对该命令必须零错误",42 条里 39 条是仓库真缺陷(只是文件在他人手里),按 §12 不代收;那两位收尾后须由本行复量归零才落账。〔上一笔注记(同日 54/8 files 那次读数)已被本笔按"一个编号只有一行当前状态"就地取代,原文正文逐字保留在本行前半。〕〕
```

- 原 L14440(L6 真归并,保留 L15021):

```
- [ ] G-186 干净 HEAD 面上此刻红着三道 blocking,而它们与任何单枚提交都无关 ⇒ 每台每次提交都会被逼 `--no-verify`(一次绕过 = 该枚提交上全部约 197 道对账作废,§12e/§12f 同型)—— 2026-09-30 03:2x 由主机时区那轮交付的**事后补跑**量到(那枚代码提交 `70d3fe45ac` 因 `core.bare` 被翻成 true 而整批守门没跑,见 §5b 相关内存),现读逐条:**① 守门 90 SSE 帧端内 dispatch 注册层对账** `node scripts/check-sse-dispatch-parity.mjs` ⇒ extension/miniapp-taro/mobile-rn/cli 各 4 帧(onConfigWarning/onDeprecationNotice/onGuardianWarning/onTraceId)未注册也未在 `scripts/data/sse-dispatch-coverage.json` 写明"为什么只有该端消费",另 web 命中 36 已超 baseline 32;**② 守门 150 角色档合规对账** `node scripts/check-radius-role-conformance.mjs` ⇒ `apps/web/app/(main)/publish/accounts/ScanLoginDialog.tsx:405` 角色 control 取 `rounded-lg`(8px)而角色表要求 sm(4px),该行由 `5bcf782139a` 引入(git blame 现读;`2d70239ba7` 只改了紧邻的第 407 行描边,别去那枚里找),该文件工作树干净 ⇒ 是已入库形态。**同门更尖的一格(2026-09-30 由本次交付复现)**:本门 `--staged` 档在"本次提交没有射程内文件"时判`索引 blob 上枚举到 0 个在射程文件 ⇒ 空扫不记绿`(现读 exit 2),于是**每一枚非 UI 提交都会被它挡** —— 与守门 135 记过的同款自锁同型(文档/语言包类提交结构上不带 .ts,把它判成空扫就是替每一次无关提交挡路,而恒挡的唯一出路是各会话跳门、连带全部对账作废,§12e)。修法照 135 的现成口径:抽一个 `shouldRetreatToHead`式判定 —— 无射程内文件 ⇒ 回退 HEAD 全量**并喊出来**,只有"确实取不到内容"才 exit 2;**不得**改成静默跳过,也不得顺手删掉"空扫判死"那一维(它防的正是"判据失明伪装成通过")。**③ 守门 12 交付报告一致性** `node scripts/check-delivery-report-consistency.mjs` ⇒ 9 处"无后续建议/完整收尾"与 P1-P5/后续建议同现(章节含 O52 等)。**为什么不就地替别人改**:①③ 属他人正在写的报告语言包与 SSE 承接面语义,②属另一路会话在飞的 publish accounts 设计面(同目录 `CookieAutoRefreshChip.tsx` 此刻是 ` M`),按 §16"修改其他 agent 代码帮他们修 = 越权事故"只登记不代裁。**各行自己的出路**:① 补接或按该门要求在 coverage.json 的 `missing.<端>` 写理由(空理由即拦);② 把那一处换成 `rounded-sm`/`rnRadius.sm` 或按门 150 的 C5 身份通道给出真实类别,**不得为变绿改角色表或调锚点**;③ 删掉互斥措辞之一(保留哪句由作者判,机器不替人判)。**这一条在等什么**:等三门各自的持有人清账;清完后本行翻勾,复现命令跑出 rc=0 即证据。同轮已实测转绿的(不必再查):守门 71 计划登记行防丢、守门 89 接线对账、守门 130 状态分叉差值棘轮、守门 26 父目录污染(它点名的 `D:/DevEnv/Temp/headtest.txt` 已由生成方自行清除,复跑 rc=0)、守门 164 源码替换符。 〔进展注记@2026-09-30(本会话现读复量,只更新账、不代裁):① 守门 90 SSE 现跑 rc=0(5 端 · 帧 37)、② 守门 150 --strict 现跑 rc=0,且它自锁那一半已由 retreatFacePlan 真接进 runAudit(回退喊话 + 保留"空扫判死"维)⇒ ①② 两道的持有人已清账;③ 守门 12 仍挡提交链:--staged 现跑 rc=1,5 处命中**全部**在 PROJECT_PLAN.md 的五个章节(G-270 / D48′ / O52 / 待办剥离区 / 第六十七批),形态同为"已闭环"与"未实现|TODO|后续建议"同章共存。本行不翻勾:出路只有该章作者改措辞、或门 12 持有人裁"台账算不算交付报告"这一射程 —— 代改他人措辞属越权(§16),为变绿放宽判据属削尺(§12f),两条都不做。〕 〔改号(2026-10-14):原G-978044〕
```

- 原 L14456(L7 逐字孪生折并,保留 L14899):

```
- [ ] **RN「记住密码」把账号+密码明文写进 AsyncStorage,而它正是票#20 那条自动登录判据的凭据源(需产品口径)** —— 实测 `apps/mobile-rn/src/lib/credential-storage.ts:72-87` 将 `{account,password}` 原样存入 `ihui-remember-credentials`(Android 上 AsyncStorage 是应用私有目录下的明文文件,root 或备份可读),而 `shouldAttemptAutoLogin` 读的 `hasRememberedCredentials()` 就是这一位。SecureStore 那层已在 `src/lib/auth/secure-store.ts` 用于凭据,记住密码这条链没跟上。两条出口:① 改存 SecureStore —— 但**登出标记必须留在不同层**:票#20 的 `ihui-session-logged-out` 刻意与凭据不同寿命(同层会被 `clearAll` 一起删,等于自己否决自己,理由写在该文件注释里);② 取消「记住密码」只留「自动登录」。禁止的省事做法:直接删 key —— 已勾选用户的勾选会静默失效且无任何提示。 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L14458(L7 逐字孪生折并,保留 L14900):

```
- [ ] **并档那一格(在等:全端观感裁决,不是本票漏改)**:`outline` / `ghost` / `size lg` 三档两端取值仍不同(RN 无 hover 且底取 `bg-transparent`,web 底取 `bg-background` 并带 `hover:bg-accent`;`lg` web 为 `h-10 rounded-sm px-8` 而 RN 为 `h-12 px-6`)。要不要收成同值属观感决策,动它同时改两端观感、需跨端回归,不由本票顺手做。 〔拍板@2026-10-12 机主授权代行:RN/跨端族用户指示本批暂缓,维持登记待 RN 窗口;本行交代成立。〕
```

- 原 L14538(L7 逐字孪生折并,保留 L14901):

```
- [ ]（进行中@2026-10-09/g3-alltasks·w1-rn） P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。〔进展 2026-10-01:代码侧归因与修复完成 —— 原根因 d12125f071 已修,归并 84ebcd2a55 把 bannerFace 包回时漏 flexDirection 致机器人列竖排复发,已补 row+flex-end 精确复原原几何(Toolbar.tsx bannerFace);剩真机复验。〕 〔现读@2026-10-13:代码侧修复完成态维持(`d12125f071c` 已修 + `84ebcd2a55` 回归后 bannerFace 补 row+flex-end 精确复原,均 HEAD 祖先);票面纪律(先 uiautomator 量 bounds、禁盲改共享组件)不变。手机已回线但 App 登录态不在场(重装后已清),学习页/首页区段复验需登录 ⇒ 与 G-191 走查包同因,等机主职权一次性放行复验,不单独翻勾。〕 〔真机复验@2026-10-13(机主授权登录态到手):**只走完一半** —— 首页「AI 应用商店」区段头实拍「更多 ›」**同行未折行**(同一行内 x≈646-710,y≈217),首页那一半不复现;但票面另一半**学习页 3 个区段本轮未走到**,且 `uiautomator dump` 陈旧缓存 ⇒ bounds 证据(分清"被挤到下一行"与"父容器宽度不足")仍未取到。同屏新线索:区段头标题与顶栏标题都贴/裁在屏幕左缘,**疑父容器横向溢出**(与折行可能同源,未经 bounds 证实)。**保持未勾**,不据半程证据翻勾;票面纪律(先取 bounds、禁盲改三端共享的 `MoreLink`)不变。〕
```

- 原 L14539(L7 逐字孪生折并,保留 L14902):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。 〔真机复验@2026-10-13(机主授权登录态到手):**只走完一半** —— 首页「AI 应用商店」区段头实拍「更多 ›」**同行未折行**(同一行内 x≈646-710,y≈217),首页那一半不复现;但票面另一半**学习页 3 个区段本轮未走到**,且 `uiautomator dump` 陈旧缓存 ⇒ bounds 证据(分清"被挤到下一行"与"父容器宽度不足")仍未取到。同屏新线索:区段头标题与顶栏标题都贴/裁在屏幕左缘,**疑父容器横向溢出**(与折行可能同源,未经 bounds 证实)。**保持未勾**,不据半程证据翻勾;票面纪律(先取 bounds、禁盲改三端共享的 `MoreLink`)不变。〕
```

- 原 L14554(L7 逐字孪生折并,保留 L14903):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。〔进展 2026-10-01:代码侧归因与修复完成 —— 原根因 d12125f071 已修,归并 84ebcd2a55 把 bannerFace 包回时漏 flexDirection 致机器人列竖排复发,已补 row+flex-end 精确复原原几何(Toolbar.tsx bannerFace);剩真机复验。〕 〔真机复验@2026-10-13(机主授权登录态到手):**只走完一半** —— 首页「AI 应用商店」区段头实拍「更多 ›」**同行未折行**(同一行内 x≈646-710,y≈217),首页那一半不复现;但票面另一半**学习页 3 个区段本轮未走到**,且 `uiautomator dump` 陈旧缓存 ⇒ bounds 证据(分清"被挤到下一行"与"父容器宽度不足")仍未取到。同屏新线索:区段头标题与顶栏标题都贴/裁在屏幕左缘,**疑父容器横向溢出**(与折行可能同源,未经 bounds 证实)。**保持未勾**,不据半程证据翻勾;票面纪律(先取 bounds、禁盲改三端共享的 `MoreLink`)不变。〕
```

- 原 L14582(L7 逐字孪生折并,保留 L14904):

```
- [ ]（进行中@2026-10-09/g3-alltasks·w1-rn） P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。〔进展 2026-10-01:代码侧归因与修复完成 —— 原根因 d12125f071 已修,归并 84ebcd2a55 把 bannerFace 包回时漏 flexDirection 致机器人列竖排复发,已补 row+flex-end 精确复原原几何(Toolbar.tsx bannerFace);剩真机复验。〕 〔现读@2026-10-13:代码侧修复完成态维持(`d12125f071c` 已修 + `84ebcd2a55` 回归后 bannerFace 补 row+flex-end 精确复原,均 HEAD 祖先);票面纪律(先 uiautomator 量 bounds、禁盲改共享组件)不变。手机已回线但 App 登录态不在场(重装后已清),学习页/首页区段复验需登录 ⇒ 与 G-191 走查包同因,等机主职权一次性放行复验,不单独翻勾。〕 〔真机取证@2026-10-13(机主授权代行,已登录态):票面明令的「先 uiautomator 量 bounds」**已取到** —— 学习页 3 个区段头逐个量得:「更多」TextView `(612,532,660,564)` 与相邻箭头 SvgView `(664,536,688,560)`(另两处 y=809..857、y=1136..1184 同形),父 Button `(608,524,692,572)`,行内「学习路径」`(28,523,172,572)` 与 Button 同处一行 ⇒ 三者 **y 区间重叠、x 紧邻**,判为**同行未折行**,与"父容器给的宽度小于内容宽度"不是同一型。取样纪律已修正:`uiautomator dump` 报 `could not get idle state` 时**目标文件不被覆盖**,照读会拿到上一轮的旧树(上一轮"陈旧缓存"误判即由此而来);本轮改为先删旧文件 + 校验 stdout 含 "dumped to" + 重试 8 次,仍失败即判"未取证"。**仍未证的一格**:票面写的是「学习页 3 个区段 + 首页区段」,首页那一个因首页 ScrollView 滚动失效(见同题宫格行)取不到 ⇒ 3/4 已证,**保持未勾**,不据半程证据翻勾。〕
```

- 原 L14583(L7 逐字孪生折并,保留 L14905):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。 〔真机取证@2026-10-13(机主授权代行,已登录态):票面明令的「先 uiautomator 量 bounds」**已取到** —— 学习页 3 个区段头逐个量得:「更多」TextView `(612,532,660,564)` 与相邻箭头 SvgView `(664,536,688,560)`(另两处 y=809..857、y=1136..1184 同形),父 Button `(608,524,692,572)`,行内「学习路径」`(28,523,172,572)` 与 Button 同处一行 ⇒ 三者 **y 区间重叠、x 紧邻**,判为**同行未折行**,与"父容器给的宽度小于内容宽度"不是同一型。取样纪律已修正:`uiautomator dump` 报 `could not get idle state` 时**目标文件不被覆盖**,照读会拿到上一轮的旧树(上一轮"陈旧缓存"误判即由此而来);本轮改为先删旧文件 + 校验 stdout 含 "dumped to" + 重试 8 次,仍失败即判"未取证"。**仍未证的一格**:票面写的是「学习页 3 个区段 + 首页区段」,首页那一个因首页 ScrollView 滚动失效(见同题宫格行)取不到 ⇒ 3/4 已证,**保持未勾**,不据半程证据翻勾。〕
```

- 原 L14587(L7 逐字孪生折并,保留 L14906):

```
- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。〔进展 2026-10-01:代码侧归因与修复完成 —— 原根因 d12125f071 已修,归并 84ebcd2a55 把 bannerFace 包回时漏 flexDirection 致机器人列竖排复发,已补 row+flex-end 精确复原原几何(Toolbar.tsx bannerFace);剩真机复验。〕 〔真机取证@2026-10-13(机主授权代行,已登录态):票面明令的「先 uiautomator 量 bounds」**已取到** —— 学习页 3 个区段头逐个量得:「更多」TextView `(612,532,660,564)` 与相邻箭头 SvgView `(664,536,688,560)`(另两处 y=809..857、y=1136..1184 同形),父 Button `(608,524,692,572)`,行内「学习路径」`(28,523,172,572)` 与 Button 同处一行 ⇒ 三者 **y 区间重叠、x 紧邻**,判为**同行未折行**,与"父容器给的宽度小于内容宽度"不是同一型。取样纪律已修正:`uiautomator dump` 报 `could not get idle state` 时**目标文件不被覆盖**,照读会拿到上一轮的旧树(上一轮"陈旧缓存"误判即由此而来);本轮改为先删旧文件 + 校验 stdout 含 "dumped to" + 重试 8 次,仍失败即判"未取证"。**仍未证的一格**:票面写的是「学习页 3 个区段 + 首页区段」,首页那一个因首页 ScrollView 滚动失效(见同题宫格行)取不到 ⇒ 3/4 已证,**保持未勾**,不据半程证据翻勾。〕
```

- 原 L14624(L7 逐字孪生折并,保留 L14907):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕
```

- 原 L14628(L7 逐字孪生折并,保留 L14908):

```
- [ ] **ai-service 退化指纹的等值处置未拍板**:三选项 A 保留现状 + 消费侧基数保护(本票已把口径写进注释)、B 每账号加盐使其互异(等于放弃"跨账号同设备"检测能力)、C 停用 `fingerprint_hash` 参与联动判定。这是**产品决策**不是重构,按 §24 需机主点头;在拍板前不得为了"账面干净"顺手删列或改摘要算法。 〔拍板@2026-10-07 机主:选A——保留现状+消费侧基数保护(跨账号同设备检测能力保留);不删列不改摘要算法〕 〔拍板@2026-10-07 机主:选A——保留现状+消费侧基数保护(跨账号同设备检测能力保留);不删列不改摘要算法〕
```

- 原 L14655(L7 逐字孪生折并,保留 L14909):

```
- [ ]**Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。 〔PROGRESS 2026-09-25: overlay-stack 已 30 处在栈,本批补命令面板桥接 commit 69523d6e5;ui-react 家族内建与"三层叠开"真机断言仍未做〕
```

- 原 L14659(L7 逐字孪生折并,保留 L14910):

```
- [ ]**Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。
```

- 原 L14661(L6 真归并,保留 L15025):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账;④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。
```

- 原 L14666(L7 逐字孪生折并,保留 L14911):

```
- [ ] **传输层单点化**:`notify-deploy-failure.ts` 扩为通用品牌告警派发器(`--to`/`--title`/`--message-file`/`--severity`/`--source`/`--plain`/`--env-file`/`--strict`/`--dry-run`,SMTP→Resend 双通道且 Resend 必带 `html`);PS 侧删除全部自拼传输代码,改为按绝对路径解析 node+tsx 调用该脚本,降级路径也只能走 `--plain`(仍不留第二份 SMTP 代码)。
```

- 原 L14668(L7 逐字孪生折并,保留 L14912):

```
- [ ] P1 **CI 装不上而门 101 报绿：锁只记「条目在不在」，不看它落在哪个依赖段**（2026-09-26 实测，9d1aa0baa3 现读）—— pnpm install --frozen-lockfile 在 packages/api-client 直接拒装：HEAD 的清单里该包 **dependencies 为空**、@ihui/types 在 devDependencies（现读 dependencies = (无) / devDependencies = @ihui/eslint-config, @ihui/types, @tarojs/taro, typescript, rimraf, vitest），而 pnpm-lock.yaml 仍把它记在 importers["packages/api-client"].dependencies 段 ⇒ pnpm 比对「同一字段」不通过。**CI 每个 job 的第一步都是这条 install**，所以红的是 Install dependencies（实测 Knip job 的失败步名就是它，不是棘轮本身），连带 CI / CI (Monorepo) / Smoke New Modules / e2e / Build Docker / Real DB 一整套红成一片；而本地 node scripts/check-lock-manifest-consistency.mjs **exit 0**（26 包 / 514 条声明 / 违规 0）。
```

- 原 L14671(L7 逐字孪生折并,保留 L14913):

```
- [ ] 重复登记副本:本行与同标题登记 L6918(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-337. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行)
```

- 原 L14672(L7 逐字孪生折并,保留 L14914):

```
- [ ] 重复登记副本:本行与同标题登记 L6918(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-351. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行)
```

- 原 L14673(L7 逐字孪生折并,保留 L14915):

```
- [ ] 重复登记副本:本行与同标题登记 L6879(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-350. 分叉合并带进来的三组跨分支撞号(G-300 / G-301 / G-310),锚点已按现读收下,清偿不在这张票里**:机制不是"没查号" —— 两条分支各自在**自己那侧的当下 HEAD** 取过号、都没撞,合到同一份账面才第一次相遇(取号发生在分叉的两条腿上,号段并不共享)。判红条件"锚点里没有的键"必须现读放行,否则这枚合并自己就是一台恒红门;但**放行不等于已修**。归谁:各该票的持有人(由 origin 侧登记的哪一路会话持有)。等什么:该票持有人把自己那一侧改派成新号并在行尾留沿革,改派后跑 `node scripts/plan-tasks.mjs --update-baseline` 收窄锚点 —— 只许收窄,所以这一步天然把"顺手把锚调宽"堵在外面。(2026-09-28 合并时登记,现读见当次 --gate --json 的 collisions 数组) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。)
```

- 原 L14674(L7 逐字孪生折并,保留 L14916):

```
- [ ] 重复登记副本:本行与同标题登记 L6880(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-351. 分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。)
```

- 原 L14679(L7 逐字孪生折并,保留 L14918):

```
- [ ] **分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:① **丢的实现** —— `scripts/check-service-binary-paths.mjs` 与它的测试是同一票在两条分支各写一份(add/add),合并取的是 origin 那份(唯一理由:合并后的 guardian-runner 注册的是它,而只有它读 `HUSKY_SKIP_SERVICE_BINARY_PATHS`;留本侧就等于给提交链挂一条"文档写了但跑不通的出路"),本侧多出的三样探测随本次合并**没了**:服务 STATE 的 `sc query` 取法、按声明端口真应答的活性探测、nssm 输出的 UTF-16LE 解码。归该门持有人,出口是把这三样并回 origin 那份实现,不是把文件换回来。② **矛盾的两行文档** —— AGENTS.md 里现在同时留着"定级 warn / 手动问责 / 刻意不进提交链,因此无紧急跳过变量"(本侧)与"定级 warn,紧急跳过 `HUSKY_SKIP_SERVICE_BINARY_PATHS`"(origin 侧),两句对同一条门互斥;合并**没有**替谁改写谁的那一行(两条都逐字存活),拍板归两侧登记人共同做。③ 为什么这两件事不在合并里顺手修:①要动别人正在持有的门体,②要判定级属产品/治理决策 —— 合并的职责是"谁独有的谁拿走",不包括替人裁决。**等什么**:①② 各自持有人;在此之前锚点里 `G-300/G-301/G-310` 三组跨分支撞号按现读放行(见上一条),不得靠调宽锚点消红。(2026-09-28 合并时登记) (原编号 G-336) (原编号 G-336)
```

- 原 L14680(L7 逐字孪生折并,保留 L14919):

```
- [ ] **分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-337) (原编号 G-337)
```

- 原 L14693(L7 逐字孪生折并,保留 L14920):

```
- [ ] **A4+A10 两处"注释承诺而未兑现"（待我复验后落地）** —— 名称档码元截断产孤立代理对；权限确认弹窗被 `localStorage==='1'` 永久压制 + 偏好档位只写不读。
```

- 原 L14700(L7 逐字孪生折并,保留 L14921):

```
- [ ] **CSRF「按凭据存在性豁免」这一型无判据:票#23 修了一处,型还在** —— `plugins/csrf.ts` 原先 `if (request.headers['x-internal-service-token']) return` 只看头在不在就整条豁免,已改为 `isVerifiedInternalMachineCall(request)`(唯一出口 `apps/api/src/utils/internal-principal.ts`,复用 `secretsEqual`)。但下一个内部凭据族照样能写成 `if (request.headers['x-anything']) return`,typecheck/lint/其余门全不响。建议小门三条:① csrf/preHandler 里"以某 header/env 键的存在性为唯一条件即放行"⇒ 红,正当形态只有调用 isVerified* 出口或行内 `csrf-exempt: <原因>`(挂守门 108 的 30 天档);② 出口被摘线(无人调用或 export 不见)⇒ 判"没有出路"并参与退出码;③ 比较逻辑只许 `secretsEqual` 一份,再出现第二处 `timingSafeEqual` 即红。前置:先量 HEAD 面存量,非零就走首锚,不得当场造恒红门。
```

- 原 L14707(L6 真归并,保留 L15056):

```
- [ ] G-212 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** (原编号 G-603;持有行题面「第十一批」) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-603 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038486〕
```

- 原 L14717(L7 逐字孪生折并,保留 L14922):

```
- [ ] **测试**:`apps/api/tests/notify-deploy-failure.test.ts`(参数解析/env 优先级/收件人消解/From 构造/Resend payload 含 html/--strict 退出码)+ PS 侧镜像测试(证明 PS 已无自拼传输)。
```

- 原 L14724(L7 逐字孪生折并,保留 L14924):

```
- [ ] **`stream-tool-ledger` 未入库**:模块与单测已绿(`apps/cli/src/stream-tool-ledger.ts`),
```

- 原 L14725(L7 逐字孪生折并,保留 L14925):

```
- [ ] P1 **`check-auth-refresh-singleton`(hook 批外步骤)按磁盘遍历客户端源码,一个未跟踪的构建副本就让全队每次提交被迫跳门(2026-09-26 实测)**:它 `readdirSync` 走文件系统(第 47 行),于是并发会话留在 `apps/miniapp-taro/.tmp-twq-fix/` 的**未跟踪**旧构建产物(5.4 MB,`common.js` 里含裸 `refreshAccessToken`)被判成违规;而它跑在守门批**之外**,161 道门全绿也照样 exit 1 —— 实测连续两枚提交因此走 `--no-verify`(归因层量到"红在批外"),一次跳门等于该枚提交上全部守门作废(§12e 同型)。当场处置是把副本**移出**到 `.ihui-agent/tmp/quarantine-2026-09-26/`(未删除,可回读),该步现 exit 0。**根因未修**:判据应判仓库内容而非共享工作树快照(门 57 已确立该口径),且改它必须同笔迁到 `scripts/lib/face-reader.mjs` 的 `catBatch`(门 118 对"本次改动动过的门"按取材面判,仍按磁盘读会被判半接线红)。
```

- 原 L14729(L7 逐字孪生折并,保留 L14926):

```
- [ ] 锁的初始化必须**写全再原子可见**:上游 `packages/services/src/bots/channelRuntime.ts:153-238`(`:172-176` 注释:"锁目录和 owner 必须作为完整状态对外可见",先写 pending 目录再 `rename`,免得竞争者把**未初始化**的锁判成 stale 抢占;`:180-188` Windows rename→EPERM 只在正式路径确实存在时才进接管分支)。我方 `scripts/git-lock.mjs` / `scripts/deploy-lock.mjs` 已有心跳 + proc-identity 三元(AGENTS §5b/§12),但**没有 pending+rename 这一层** —— 锁目录本身就是半成品可见态,与本机 09-24 那次"pid 被复用导致部署环冻结 11h50m"(G-193)是相邻风险。**落点** `G:\IHUI-AI\scripts\lib\`(与两把锁共用的那一份,禁止各写一遍)。**验收**:临时目录并发 A/B —— 旧实现能在 owner 写入前被 B 判 stale 抢占,新实现不可;两把锁的既有镜像测试全绿(不得为过门改它们的断言)。 (原编号 G-814425;持有行题面「锁的初始化必须"写全再原子可见"」)
```

- 原 L14730(L7 逐字孪生折并,保留 L14927):

```
- [ ] 锁的初始化必须**写全再原子可见**:上游 `packages/services/src/bots/channelRuntime.ts:153-238`(`:172-176` 注释:"锁目录和 owner 必须作为完整状态对外可见",先写 pending 目录再 `rename`,免得竞争者把**未初始化**的锁判成 stale 抢占;`:180-188` Windows rename→EPERM 只在正式路径确实存在时才进接管分支)。我方 `scripts/git-lock.mjs` / `scripts/deploy-lock.mjs` 已有心跳 + proc-identity 三元(AGENTS §5b/§12),但**没有 pending+rename 这一层** —— 锁目录本身就是半成品可见态,与本机 09-24 那次"pid 被复用导致部署环冻结 11h50m"(G-193)是相邻风险。**落点** `G:\IHUI-AI\scripts\lib\`(与两把锁共用的那一份,禁止各写一遍)。**验收**:临时目录并发 A/B —— 旧实现能在 owner 写入前被 B 判 stale 抢占,新实现不可;两把锁的既有镜像测试全绿(不得为过门改它们的断言)。 **当前状态=实现已写完但刻意未落地(2026-09-29,等他人未提交改动让开落点)**:本票的实现(`scripts/lib/lock-atomic-init.mjs` + 两份镜像 + 两把锁的接线)已在工作树里跑绿 —— `node --test scripts/tests/{lock-atomic-init,git-lock-stale-steal,deploy-lock,deploy-lock-stale-steal}.test.mjs` 当轮 RC=0。但 `scripts/git-lock.mjs` / `scripts/deploy-lock.mjs` 此刻**同时含并发会话 G-653 的在飞改动**,且那份改动 import 的 `scripts/lib/atomic-write.mjs` **仍是未跟踪文件**(`??`)⇒ 我现在按 pathspec 或对象空间交这两个文件,等于把"引用一个不在版本树里的模块"写进 HEAD,别人一次干净检出就会让每一次提交的 git 写锁崩掉(这比原病更响)。解阻判据(接手人直接照做):① `git ls-files scripts/lib/atomic-write.mjs` 有输出 **且** 两把锁的工作树副本对 `git diff HEAD` 只剩本票的 hunk;② 两条都成立后 `node --test` 那四份套件仍 RC=0 才落;③ 落之前复跑 `node scripts/git-lock.mjs check` 与 `node scripts/deploy-lock.mjs check` 留 RC。禁止为"早点交"去替 G-653 落他们的半成品,也禁止把本票改成"只落 lib 不接线"——那正是守门 121 判的"声明无消费者"。 (原编号 G-814425;持有行题面「锁的初始化必须"写全再原子可见"」)
```

- 原 L14735(L7 逐字孪生折并,保留 L14928):

```
- [ ] **`ihui-auth-user` 里存了 `isAuthenticated`:登录态的第二份真相** —— 权威推导应是「有没有 token」(共享工厂 `createAuthStore` 就是这么算的),两份真值的失效形态是「token 已清而 isAuthenticated 仍 true」⇒ UI 认为已登录、请求全 401。出口:该 key 只存 user 资料,`isAuthenticated` 一律派生;读到旧形状要兼容一个版本再删,不得当场判用户"没登录"。
```

- 原 L14738(L7 逐字孪生折并,保留 L14929):

```
- [ ] **A7+A8+A9 三格"尺子盲区"（可立即修，逐条一票）** —— 消费投影开放映射、LineIcon 调用点值→键零看守、行统计 6 处各算且已量到两处真漂移。
```

- 原 L14739(L7 逐字孪生折并,保留 L14930):

```
- [ ] **活动时钟必须单调且"维护性写入只拥有自己的列"**(可立即修;归属:ai-service 会话存储 + cli 会话状态层持有人=本线) —— 上游 `.../storage/session-store/repositories/sessions.ts:131` `time_updated = max(time_updated, ?)`、`:290`、`:339-343` `touchSession`,设计理由在 `:130`、`:285-286`:路径自愈曾复用全字段 update,把读快照的旧值压到并发新值上。我方现状(主会话已独立复跑):`git show HEAD:apps/ai-service/app/services/session_store.py | grep -cE "updated_at = \?"` = **8**(:803/820/862/975/1011/1064/1144/1317 全是裸赋值),`grep -cE "max\(updated_at"` = **0**;CLI 侧 `git show HEAD:apps/cli/src/sessions/state-store.ts | grep -cE "lock|cas|expected|version"` = **0**,而 `saveSession` 是整文件覆盖写、仓内 58 个调用点(repl.ts:967/995/1025/1326/1408/1460/1500/1536、acp/server.ts:712/729/787、agent.ts:2720)。落点:`state-store.ts` 把 `saveSession` 拆成 `patchSession(id, ownedFields, expected?)`(列所有权 + 单调 `updatedAt`),`session_store.py` 8 处改 `updated_at = max(updated_at, ?)`。验收:`git show HEAD:apps/ai-service/app/services/session_store.py | grep -c "updated_at = max(updated_at"` = 8 且裸赋值 = 0;`git show HEAD:apps/cli/src/sessions/state-store.ts | grep -c "writeFileSync(p, JSON.stringify(state"` = 0。爆炸半径:中—大(`idx_threads_updated` :460 与 `ORDER BY updated_at DESC` :933/:1615 的分页都吃这个键),SQL 表达式级不动 schema,可逐点灰度。 (原编号 G-820;持有行题面「活动时钟必须单调且"维护性写入只拥有自己的列"—」)
```

- 原 L14756(L7 逐字孪生折并,保留 L14931):

```
- [ ] 计划任务 `IHUI-C-Drive-AutoMaintain` 仍未注册(注册 = 影响全机的删除动作,须用户授权);
```

- 原 L14759(L6 真归并,保留 L15034):

```
- [ ] **O88. 台账孪生副本:两型已收口、一型待裁(2026-09-28 两次现读归正,归台账持有人)**:**已收口的两型** —— ① 行号指针维:F3 原先只认「存活于 L<行号>」一种措辞而该族 HEAD 面现读 0 条,归并器自己产的「同主键/逐字相同的另一条登记在 L<行号>」222 处全隐身(47 处指到别的话题 / 160 处目标行根本不是条目行 / 15 处落空),账面 F3=0 而 §1 明令禁止的证据形态满账;现改为**族表**判据 + 与之同集的修复出口(镜像 T11 钉"判得到必须修得了"),并收紧到"禁写行号"本身(指得准的行号指针也判红),现读面上行号指针 **0 处**。② 到期租约维:门 109 的 2 条 CL1 已按 §1 出路清账(有同题已完成登记的那条翻勾并摘牌;正文自述"刻意不当场执行"的那条不翻勾,改写成待认领并写明认领姿势)—— 该门是 `stagedTriggers=PROJECT_PLAN.md` 的 blocking 门,红着等于每次提交计划文档都被逼跳门(§12e)。**仍待裁的一型** —— ③ `--twins` 现读 **102 条**"已闭环登记的未勾孪生",其中靠**相似度**(0.63–0.95)或**包含**配上的约 93 条,按 §1「相似度只配报数,不配判红」一条都不能自动动;逐条分类已出(77 判同一句被复制、3 判不出、0 判成不同事),可自动子集仅 10 行,而那份分类的关键词筛在 35/80 行**漏判**未完成语义(反向 0 漏判)⇒ 这 10 行也不自动落,报告落在 `.ihui-agent/tmp/twin-adjudication/report.md`(临时区,不入库,需要就重跑)。**它在等什么**:等持有人按报告逐条裁"该记完成还是仍开" —— 自动挂"重复登记副本"指针会把真任务从派单口径里静默摘掉,那比账面重复更贵。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks.mjs --gate`(F3/F4/F4b/F6 四行)、`node scripts/plan-tasks-merge.mjs`。 **2026-09-28 再归正**:上面③那句"三面全不判"已被并发的另一路会话补上 —— 现读 `node scripts/plan-tasks.mjs --gate` 有 **F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行**,默认档只报数、差值棘轮只拦新增,逐组出口 `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`,**升 blocking 的前置是存量清零**(§12e)。所以本行剩下的真待裁只余"相似度孪生"那一族。 —— **2026-09-28 本副本同步撤回**:上面"再归正"那句里的 F10 维与 `--dedupe-done-twins` 出口都不在 HEAD(现读 done 侧 85 组,出口从未实现,未知旗标 exit 2),现行判定见同编号「其余三型无人覆盖」那条的第五条更正,勿照本行的 F10 措辞派单。
```

- 原 L14760(L6 真归并,保留 L15054):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕
```

- 原 L14791(L6 真归并,保留 L15057):

```
- [ ] **D181 电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态已拍板@2026-09-30暂缓+登记依赖)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占用该桶;依赖立项之日随新号翻勾或注销。〕
```

- 原 L14792(L6 真归并,保留 L15034):

```
- [ ] **O88. 台账孪生副本:两型已收口、一型待裁(2026-09-28 两次现读归正,归台账持有人)**:**已收口的两型** —— ① 行号指针维:F3 原先只认「存活于 L<行号>」一种措辞而该族 HEAD 面现读 0 条,归并器自己产的「同主键/逐字相同的另一条登记在 L<行号>」222 处全隐身(47 处指到别的话题 / 160 处目标行根本不是条目行 / 15 处落空),账面 F3=0 而 §1 明令禁止的证据形态满账;现改为**族表**判据 + 与之同集的修复出口(镜像 T11 钉"判得到必须修得了"),并收紧到"禁写行号"本身(指得准的行号指针也判红),现读面上行号指针 **0 处**。② 到期租约维:门 109 的 2 条 CL1 已按 §1 出路清账(有同题已完成登记的那条翻勾并摘牌;正文自述"刻意不当场执行"的那条不翻勾,改写成待认领并写明认领姿势)—— 该门是 `stagedTriggers=PROJECT_PLAN.md` 的 blocking 门,红着等于每次提交计划文档都被逼跳门(§12e)。**仍待裁的一型** —— ③ `--twins` 现读 **102 条**"已闭环登记的未勾孪生",其中靠**相似度**(0.63–0.95)或**包含**配上的约 93 条,按 §1「相似度只配报数,不配判红」一条都不能自动动;逐条分类已出(77 判同一句被复制、3 判不出、0 判成不同事),可自动子集仅 10 行,而那份分类的关键词筛在 35/80 行**漏判**未完成语义(反向 0 漏判)⇒ 这 10 行也不自动落,报告落在 `.ihui-agent/tmp/twin-adjudication/report.md`(临时区,不入库,需要就重跑)。**处置@2026-10-14(goal第49轮代拍板):原 report(临时区)已蒸发且从未入库,旧 77/3/10 读数作废,凭空构造逐条清单=造假证据;复活路径=node scripts/check-task-claims.mjs --twins 重跑生成当期清单再逐条裁,重跑属机器可做,本行转实施排队** —— 自动挂"重复登记副本"指针会把真任务从派单口径里静默摘掉,那比账面重复更贵。取证一律现读:`node scripts/check-task-claims.mjs --twins`、`node scripts/plan-tasks.mjs --gate`(F3/F4/F4b/F6 四行)、`node scripts/plan-tasks-merge.mjs`。 **2026-09-28 再归正**:上面③那句"三面全不判"已被并发的另一路会话补上 —— 现读 `node scripts/plan-tasks.mjs --gate` 有 **F10 已完成行的逐字孪生(done 侧)224 组 / 多余副本 339 行**,默认档只报数、差值棘轮只拦新增,逐组出口 `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`,**升 blocking 的前置是存量清零**(§12e)。所以本行剩下的真待裁只余"相似度孪生"那一族。 —— **2026-09-28 本副本同步撤回**:上面"再归正"那句里的 F10 维与 `--dedupe-done-twins` 出口都不在 HEAD(现读 done 侧 85 组,出口从未实现,未知旗标 exit 2),现行判定见同编号「其余三型无人覆盖」那条的第五条更正,勿照本行的 F10 措辞派单。
```

- 原 L14793(L6 真归并,保留 L15054):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕
```

- 原 L14798(L7 逐字孪生折并,保留 L14901):

```
- [ ]（进行中@2026-10-09/g3-alltasks·w1-rn） P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。〔进展 2026-10-01:代码侧归因与修复完成 —— 原根因 d12125f071 已修,归并 84ebcd2a55 把 bannerFace 包回时漏 flexDirection 致机器人列竖排复发,已补 row+flex-end 精确复原原几何(Toolbar.tsx bannerFace);剩真机复验。〕 〔现读@2026-10-13:代码侧修复完成态维持(`d12125f071c` 已修 + `84ebcd2a55` 回归后 bannerFace 补 row+flex-end 精确复原,均 HEAD 祖先);票面纪律(先 uiautomator 量 bounds、禁盲改共享组件)不变。手机已回线但 App 登录态不在场(重装后已清),学习页/首页区段复验需登录 ⇒ 与 G-191 走查包同因,等机主职权一次性放行复验,不单独翻勾。〕 〔真机复验@2026-10-13(机主授权登录态到手):**只走完一半** —— 首页「AI 应用商店」区段头实拍「更多 ›」**同行未折行**(同一行内 x≈646-710,y≈217),首页那一半不复现;但票面另一半**学习页 3 个区段本轮未走到**,且 `uiautomator dump` 陈旧缓存 ⇒ bounds 证据(分清"被挤到下一行"与"父容器宽度不足")仍未取到。同屏新线索:区段头标题与顶栏标题都贴/裁在屏幕左缘,**疑父容器横向溢出**(与折行可能同源,未经 bounds 证实)。**保持未勾**,不据半程证据翻勾;票面纪律(先取 bounds、禁盲改三端共享的 `MoreLink`)不变。〕
```

- 原 L14800(L7 逐字孪生折并,保留 L14904):

```
- [ ]（进行中@2026-10-09/g3-alltasks·w1-rn） P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段,明暗两态均复现)。1:1 裁图确认**不是降采样伪影**(`crop-study1.png`)。**根因未定**:`MoreLink` 自身是 `flexDirection:'row'` 且 Yoga 默认 `nowrap`,按推理不可能换行;调用面(`LearnScreen.renderSectionHeader` / `MoreTitles` / `CardWithList` / 两端 HomeScreen)**全部委托唯一实现**,没有第四份自拼。⇒ 本票要求先**量出真实 bounds 再动手**:用 `uiautomator dump`(前提是把 `window_animation_scale`/`transition_animation_scale`/`animator_duration_scale` 三项设 0,否则恒报 `ERROR: could not get idle state` —— 本票踩过,且我一开始把键名写成 `window_transition_animation_scale` 是错的,设了等于没设),取「更多」文本节点与相邻箭头节点的 `[x1,y1][x2,y2]`,分清"同行被挤到下一行"与"父容器给的宽度小于内容宽度"。**无 bounds 证据前不得给 MoreLink 打 `flexShrink`/`flexWrap` 补丁** —— 那是三端共享组件,盲改只会新增第二类债。〔进展 2026-10-01:代码侧归因与修复完成 —— 原根因 d12125f071 已修,归并 84ebcd2a55 把 bannerFace 包回时漏 flexDirection 致机器人列竖排复发,已补 row+flex-end 精确复原原几何(Toolbar.tsx bannerFace);剩真机复验。〕 〔现读@2026-10-13:代码侧修复完成态维持(`d12125f071c` 已修 + `84ebcd2a55` 回归后 bannerFace 补 row+flex-end 精确复原,均 HEAD 祖先);票面纪律(先 uiautomator 量 bounds、禁盲改共享组件)不变。手机已回线但 App 登录态不在场(重装后已清),学习页/首页区段复验需登录 ⇒ 与 G-191 走查包同因,等机主职权一次性放行复验,不单独翻勾。〕 〔真机取证@2026-10-13(机主授权代行,已登录态):票面明令的「先 uiautomator 量 bounds」**已取到** —— 学习页 3 个区段头逐个量得:「更多」TextView `(612,532,660,564)` 与相邻箭头 SvgView `(664,536,688,560)`(另两处 y=809..857、y=1136..1184 同形),父 Button `(608,524,692,572)`,行内「学习路径」`(28,523,172,572)` 与 Button 同处一行 ⇒ 三者 **y 区间重叠、x 紧邻**,判为**同行未折行**,与"父容器给的宽度小于内容宽度"不是同一型。取样纪律已修正:`uiautomator dump` 报 `could not get idle state` 时**目标文件不被覆盖**,照读会拿到上一轮的旧树(上一轮"陈旧缓存"误判即由此而来);本轮改为先删旧文件 + 校验 stdout 含 "dumped to" + 重试 8 次,仍失败即判"未取证"。**仍未证的一格**:票面写的是「学习页 3 个区段 + 首页区段」,首页那一个因首页 ScrollView 滚动失效(见同题宫格行)取不到 ⇒ 3/4 已证,**保持未勾**,不据半程证据翻勾。〕
```

- 原 L14802(L7 逐字孪生折并,保留 L14907):

```
- [ ]（进行中@2026-09-29/LEDGER-FIX）承「图源池的层序违规已清零(落地枚 f1638d8),但留了三格未闭合」那条的第 ③ 格:畸形编号实测有**第二类**,且机械批处理会被自己造出的第三份副本顶回 —— 现读 HEAD 面另有 4 个六位号条目行 `G-811336 / G-812373 / G-813374 / G-87`,其一是"上一轮改号"留下的:**剥前缀时把新号与旧号数字直接相接**(`G-811` + `336` ⇒ `G-811336`),即"修双前缀"这一步本身产出了新畸形。后果实测:我按上一条写的脚本把 `G-G-373` 归成 `G-373` 时,同一件事在面上已有 `G-812373` 那份副本 ⇒ 归并不是消除副本而是**长出第三份**(64 组同主键多行由此而来);而取号器把这类六位号当"已用号"算 max,`{{NEXT_ID}}` 会给出 `G-814386` 这种天文号。**因此本票不换算法,改成逐条归并**:① 先按标题前缀把同一件事的所有形态(干净号 / `G-G-N` / 六位接号)聚成一组,持有行只允许一个;② 其余副本走 `node scripts/plan-tasks-merge.mjs --heal`(F4 只加"重复登记副本"指针、绝不动勾选);③ 只有聚不到组的畸形号才去前缀或另发新号,另发必须走取号令牌(G 族的 NEXT_ID 形态,该令牌展开值已含族名,正文再手写 `G-` 就产出 `G-G-N`,本仓实测三次)。**判据(三条同时成立才算做完)**:面上 `G-G-\d+` 与 `G-\d{6,}` 均为 0;`node scripts/plan-tasks.mjs --staged --gate` 的 F9 撞号组数不得比动手前高;`git show HEAD:PROJECT_PLAN.md` 里每一条被改动的行,除号形态外与父提交逐字等值。**已实测拒写两次**:第一版脚本 `changed(369) != expected(378)`(有 5 个畸形号只出现在折叠注释里没有条目行)、`norm` 等值把六位接号算进"已用号"导致 alloc 出 `G-814386`;另一次是取号器自己拒的 —— 远端 tip 在推进而对象不在本地 ⇒ 它拒绝发号并要求先 `git fetch`,这条锁是对的(上一版只警告不拒,当天就撞出 2 组 F9)。**结论:本条登记行刻意不带编号**,以免我又用六位天文号给台账添第三类畸形。〔归属:本会话;等什么:无,可立即做,但必须按 ①②③ 的顺序,不得直接全局替换〕
```

- 原 L14818(L7 逐字孪生折并,保留 L14933):

```
- [ ] **ai-service `.venv` 处于半损坏态**:`.venv/pyvenv.cfg` 丢失(venv 退化成全局解释器视角,`python -m pytest` 报 no module;已按 uv 0.12.4 形态重建 cfg 恢复 venv 识别),且 `uv sync` 全量对齐被 **pywin32 的 pywintypes312.dll 文件锁**打断(本地有一个 61MB 的 python 进程疑似占着 DLL,不杀并行会话可能在用的进程)。当前状态:大部分包在,`requests`/`idna` 等在 sync 中断中丢失,O17/A2A 卡片测试文件因 import 链过长暂无法在本机 pytest。**修复路径**:确认占 DLL 的进程身份并终止(或停本地 ai-service dev 实例)→ 重跑 `uv sync --no-install-package pywin32` → 跑 `tests/test_a2a_agent_card.py`(含 2026-09-24 新增 3 用例)。O20 的行为正确性已由临时验证脚本 7/7 实证(`.ihui-agent/tmp/mail-0924/verify_host_fix.py`,用后即删)。
```

- 原 L14820(L7 逐字孪生折并,保留 L14934):

```
- [ ] `config/architecture-policy.yaml` 目前 0 个模块 `managed:true` —— 渐进收口的第一块翻正面尚未选定。
```

- 原 L14821(L5 真归并,保留 L14702(+正文承载段)):

```
- [ ] **G-2 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018296〕
```

- 原 L14822(L7 逐字孪生折并,保留 L14935):

```
- [ ] **★ 抓到本仓一处"造好没装车"：`apps/cli/src/tools/argument-validator.ts` 在生产面零调用方 ⇒ CLI 工具入参根本不校验**
```

- 原 L14823(L5 真归并,保留 L14702(+正文承载段)):

```
- [ ] **G-8 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018297〕
```

- 原 L14826(L5 真归并,保留 L14702(+正文承载段)):

```
- [ ] **G-63 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-580 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038482〕
```

- 原 L14828(L5 真归并,保留 L14827(+正文承载段)):

```
- [ ]G-66 看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（等人拍板）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-462 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038475〕
```

- 原 L14829(L5 真归并,保留 L14702(+正文承载段)):

```
- [ ] **G-68 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-03 F9 清偿批③复投二):原号 G-580 同号多题,按 G-312 + 最早登记行持号,本任务让出原号改用本号;正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1058518〕
```

- 原 L14831(L5 真归并,保留 L14827(+2 段注记移植)(+正文承载段)):

```
- [ ]G-71 看板把 `cancelled/failed/quota_exceeded/preempted` 全塌成 `blocked`（等人拍板）—— 上游 `dw/src/engine/errors.ts:14-35` 的分级判据是"**能不能被 catch**"而非严重程度：脚本 catch 得到的降为 node 级、`report` 返回 void 无处 catch 的升 run 级，`Interrupted` 必须独立码（否则"进程被杀"与"脚本真失败"只能靠 message 文本分）。我方 `packages/types/src/agent-runtime.ts:1258-1266` `LEGACY_STATUS_MAP` 四档同落 `blocked` ⇒ 被取消的任务与待解阻塞在看板上同形，"重跑很可能就好"与"要先解阻塞"是一条视觉信号。拆 = 六档变七档，牵动 `z.enum`（`agents-kanban.ts:128,151`）+ SSE 载荷 + `dag_scheduler.py:351` + 五语言 + 守门 151 的 SV2。 〔让号记录(2026-10-02 F9 清偿批②):原号 G-462 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔拍板@2026-10-09 机主授权代行:看板状态按可恢复性+严重度两级归桶,cancelled 与 failed 分列;立项派单(六档变七档牵动面以票面为准)。〕 〔改号(2026-10-14):原G-1018245〕
```

- 原 L14833(L7 逐字孪生折并,保留 L14936):

```
- [ ] RN 与 api-client 三处接口路径多写一段 `agents`,运行时必 404(守门 8 报的真缺口,2026-10-05 现读三段取证)**:① 端内 `apps/mobile-rn/src/screens/HomeScreen.tsx:569` 写 `/cozeZhsApi/agents/collect`,门 8 归一为 `/api/agents/collect`;而后端 `apps/api/src/routes/agents.ts:1567` 注册的是 `server.post('/collect')`,经 `apps/api/src/routes/index.ts:646` 的 `server.register(agentsRoutes, { prefix: '/api' })` 挂载 ⇒ 实际路径是 **`/api/collect`**,**差一段 `agents`**。② `:577` 的 `/cozeZhsApi/agents/thumbs` 同型(后端 `agents.ts:1552` 注册 `/thumbs` ⇒ 实际 `/api/thumbs`)。③ `packages/api-client/src/endpoints/agent.ts:97` 的 `/cozeZhsApi/cache/agent-category-dict/categories` ⇒ 归一 `/api/cache/agent-category-dict/categories`,`apps/api/src/routes/` 下 **0 命中**该路径。**修法**:三处端内路径去掉多写的那一段;或后端补挂 `agents` 段(**属对外契约变更,需机主定**)。**验收**:改后 `node scripts/check-api-routes.mjs` 末行不再出现这三处「后端**不在册**」,且 RN 收藏/点赞真机点得动。注意守门 8 按设计**只报数不判红**(§12e)⇒ 这条不会自己变红,必须靠人收口。⚠️ 三处**不可**批量正则替换(端内还可能有真的 `/agents/...` 路由),必须逐条比对后端注册面。 〔拍板③@2026-10-06:新建公开双键字典端点,注册在客户端既有调用路径(4 调用方+api-client 零改动);实施 agent 在飞〕
```

- 原 L14839(L5 真归并,保留 L14703(+1 段注记移植)(+正文承载段)):

```
- [ ] G-87 **A1 改道校验只比大小不比内容（可立即修；归属：§26 C 盘改道线，本票持有人即我）** —— 见上文 A1 与现读落点。〔2026-09-29 改号(承 D168 第四遍收尾):剥掉双前缀后本行会与既有 **G-385**(标题「生产备份链日志的写入侧编码要改成UTF-8」)**同主键 —— 那不是畸形号而是**真撞号**,所以这里不剥前缀而是取当次空闲新号;原编号位写的是「G-G-」。〕 〔改号(2026-10-14):原G-814385〕
```

- 原 L14847(L6 真归并,保留 L15025):

```
- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 + 改一端另一端自动生效(除登录方式与平台机制)。**第 1 票已落(本枚提交)**:对账尺 `scripts/check-cross-end-ui-parity.mjs`(guardian **128**,blocking,棘轮锚点 `scripts/cross-end-ui-parity-baseline.json`,自检 19 例 + 门禁 11 例),AGENTS §4 新节 + README 点名。**立项实测读数**:同名配对组件 19 对 / 174 处差异档 / RN 侧 210 个组件用 `StyleSheet.create` 而小程序侧 91 个用 `className=`(两种样式语言 = 结构上无法自动同步的根因)。**已量到的最小心智事实**:两份自称"唯一实现"的 `BackChevron` 图标墨迹 20px vs 22px、色一档取 `--color-foreground` 一档取 `tk.text.medium`、RN 带系统字号缩放倍率而小程序不带。**剩余票(顺序固定,不得跳)**:② **〔x〕 2026-09-26 已落**:几何档 `packages/design-tokens/src/geometry.js`(`GEOMETRY_PX` 一张表 + `rnGeometry`/`taroGeometry` 两个投影 + `TARO_RPX_PER_PX`,照 `radius.js` 形状,配 `geometry.d.ts`,由 `src/index.ts` 出口),**同枚提交即有两端消费方**(`apps/miniapp-taro/src/components/BackChevron.tsx` 与 `packages/app/src/components/BackChevron.tsx` 各自删掉本地 `= 40`/`= 22`/`= 36` 改取投影);取值依据含"移动端墨迹为何不取 web 顶栏的 14px(`TOPBAR_BTN_BASE` 的 `[&>svg]:!h-3.5` 是桌面密集工具条档)"写在该文件头注。**效果实测**:门 128 索引面 BackChevron 从"仅小程序 20 | 仅 RN 22"变成不再出现在差异清单(18 → 17 条),台账删该键(留着即清单腐烂),门禁测试 11/11 仍绿;`@ihui/design-tokens`、`@ihui/rn-app` typecheck 均 0 错误。**另登记一条与本票无关的既有债**:`pnpm --filter @ihui/miniapp-taro typecheck` 在**干净的 HEAD 上**即报 2 错(`src/pkg-ai/ai/chat.tsx:636` 传 `onTerminalDelta` 而 `StreamEventCallbacks` 无此键 + 参数隐式 any)—— 该文件工作树与 HEAD 逐字节相同,故非在飞改动;未擅自"顺手修"(§12 越权红线),留待该键的归属会话收口。③ 在 `packages/shared` 落"与平台无关的组件源 + 每端注入 primitive adapter"的第一例(试点 `BackChevron`:7 个小程序调用点 / 134 个 RN 调用点,API 取两端并集,动作语义留调用方),两端各自构建 + 真机/模拟器像素复核后才允许下调台账(〔真机复核通过@2026-10-14 本席:BackChevron 于 c12617dd 真机渲染正常(意见反馈页左上 `<` 形态/位置符合)且点击正常返回,落地提交 `a90cc00bb3`,门 128 棘轮与 wiring 测试 12/12 前验绿;④ 的下调台账前置已满足〕);④ 按台账读数从大到小逐族收敛(`InputArea` 23 / `BottomActionBar` 19 / `LoginPopUp` 17 / `NavBar` 15 / `IntelligentAssistant` 14 为前 5),每族一票,收完即下调 `counts` 并**在同枚提交里**留下"该组件只剩一份源"的证据;⑤ 确属平台差异的逐条写 `waivers.reason`,由守门 108 管到期。**架构前提(不要再试第二条路)**:单向适配器已失败过一次(2026-09-22 删 4,662 行,"同名 ≠ 同契约"),所以只能"一份源 + 两端注入",不能"一端包另一端";`packages/app` 是 RN 专属(Taro 跑不了),`packages/ui-native` 13 个组件里 11 个零生产消费方,不得当成已交付能力引用。
```

- 原 L14856(L7 逐字孪生折并,保留 L15009):

```
- [ ] 〔2026-10-14/w1-argval 现读取证登记,未修任何一处〕**argument-validation 装车后的覆盖面三格缺口**:① `apps/cli/src/tools/argument-repair-loop.ts`(`createArgumentRepairSession`)生产面无 import 方(仅 `tests/argument-repair.test.ts` 引用);其头注自述装车点在 index.ts 的 enforce 调用处(该处已存在,但 repair 记账走的是 telemetry 的 `noteEnforceRepairRejection`)——是否并入口径归主会话裁决;② hub 分支 `apps/cli/src/tools/index.ts:1002-1025` 早退路径拿不到 Tool 对象 ⇒ 该分支校验覆盖面缺口(源码注释自标"本票不扩面",非判红);③ `apps/api/src/services/workspace-ai-service.ts:505` 为硬编码 `{}` 入参的模拟工具调用(守门覆盖面读数点名,非判红)。三格均为接线核实后的残余取证,修复需各自立项。
```

- 原 L14859(L6 真归并,保留 L15040):

```
- [ ] **G-923 「登录态出内容」端到端复量 —— 在等什么:等 dev 栈机器级依赖被拉回(不是等代码)** —— 上面那枚改判把 dev 壳的凭据腿从"跨 host + 共享 vault"换成"同源第一方 cookie",但最后一格(登录后签到页真出账号列表/空态)本轮量不到,原因两条都实测在案:① `127.0.0.1:18810`(apps/api `.env` 的 `DATABASE_URL` 所指、由某个 `ssh.exe` 本地转发承载的 dev PG)现读零监听 → `POST /api/auth/login` 直连 8802 与经 8801 反代**同样** 500「服务器错误」;② ai-service 8803 现读拒连(curl 返 000),而经 8801 的 `/api/auth/me`(→8802)实测 401 正常,即 next dev 反代腿本身是通的。repo 内查无该隧道的定义(全仓无 18810 引用、无计划任务、`~/.ssh/config` 无 LocalForward)⇒ 正解不是由我猜一条隧道命令,而是持栈会话把隧道与 ai-service 拉起后复量。复量入口与判据留在 `.ihui-agent/tmp/debug-checkin/verify-obs.mjs` / `verify-obs2.mjs`(起壳→读 `performance.getEntriesByType('resource')` 的 `/api/*` 实际落点→读 `auth.json` 体积是否仍为 2B→截图),两项都过才翻勾。 〔复量尝试注记@2026-10-15/本席:①隧道姿势在 .workbuddy/memory/2026-09-22.md:340 有据(`ssh -L 18810:127.0.0.1:8810 -N ssh.aizhs.top`),非交互认证实测通过(BatchMode 下 echo AUTH_OK,身份键 .ssh/ihui_ssh);②本席按该姿势起隧道后 18810 曾短暂进入 LISTENING(pid 35408),但一分钟内进程自退、端口消失,同 DSN 直连 SELECT 1 仍 ECONNREFUSED ⇒ 500 未解;③对 ssh.aizhs.top 远端执行 ss 探 8810 回的是 Windows 风格「系统找不到指定的路径」⇒ 该落点的 shell/拓扑与本席假设不符,不再靠猜戳生产入口。结论:本行等的仍是持栈会话把 18810 与 ai-service 8803 拉起(本席不代起、不代试第二条隧道姿势)。〕 〔本行不认领牌:它等的是机器状态,不是某个人的编码工作;`check-task-claims.mjs` 现读该族零在飞。〕
```

- 原 L14864(L7 逐字孪生折并,保留 L15042):

```
- [ ] 〔2026-10-14/w1-mcp 取证,未修〕**mcp-runtime SSE 后台循环 `.catch(() => {})` 吞错仍在**(apps/cli/src/tools/mcp-runtime.ts:997-999 一带):`readSseStream` 自身 reject(如流中网络错误)被静默吞掉。取消路径的流释放已成立(abort 打断循环 + `finally releaseLock`),pending 请求有 10s 超时与断连清理兜底,故现状"有界但不主动观测";归档 G-694 ✅ 的落点只钉了 `sendStdioRpc`,SSE 这半从未单独验收。修法含设计取向(流死后是告警、标死还是触发重连),宜单独立票,禁为吞错加Retry藏红。
```

- 原 L14865(L7 逐字孪生折并,保留 L15043):

```
- [ ] 〔2026-10-14/w1-csrf 取证〕**timingSafeEqual 收敛到 secretsEqual 一份**:门 `check-csrf-exemption-shape.mjs` 判据③现读 HEAD 存量 48 处/20 文件(棘轮锚点=HEAD,只减不增);终点状态是"全仓只剩 packages/shared 的 secretsEqual 一份",收敛只能逐笔做(每笔把一处比较改走 secretsEqual 并跑该门全量档证明只减不增);`--strict` 问责档已随门装车(209 号)。
```

- 原 L14867(L6 真归并,保留 L15044):

```
- [ ] **G-930. §5b 的两个本地恢复源目录此刻都不存在,而唯一刷新器没有 init 档 ⇒ guardian 每轮 `--check` 只能永久报 `backupOk:false`,本机现在没有任何可用的 `.git` 恢复源(交代:等一次**落点裁决**,不是等新环境;归属:gitdir 存续线)** —— 现读三件:① `node scripts/git-guardian.mjs --status` 给 `gitdirOk:true / backupOk:false`;② `node scripts/git-backup-refresh.mjs --check` 与不带旗直接跑都在同一处硬失败「❌ 备份 gitdir 不存在或缺 HEAD: `G:/IHUI-AI/.DevEnv/backups/git/IHUI-AI.git-backup-20260912`」——**它只会刷新已存在的镜像,没有任何出口把缺失的镜像重建出来**,§5b「由 guardian 每轮先 --check 再增量刷」这一层因此在现场是断的;③ §5b 点名的两处遗留形态 `D:/IHUI-AI-git-repo` 与 `D:/IHUI-AI.git-backup-20260912` 现读**均不存在**(本席未删也不碰;连带后果:票 G-10 那份 10,713,093 B 的 `lint-staged_unstaged.patch` 唯一快照随目录一起消失,该行已按自写判据结清并把这一事实如实登记)。**为什么本轮不直接 `git clone --mirror` 补一份**:刷新器解析出的落点在**工作区内**(`G:/IHUI-AI/.DevEnv/backups/git`),而守门 208(blocking,`stagedTriggers=scripts/`)判"工作树内嵌套 git 仓"零容忍、现读仍在报 `outputs/ihui-bench-release/.git` 一处 ⇒ 在那里长出一棵 bare 仓就是再造一道与提交内容无关的恒红门,唯一出路是逼人 `--no-verify`(§12e 明令禁止用这个方式换绿);而 §5b 原文要求恢复源在**工作区外**(`D:\DevEnv\backups\git`,现读只剩 `incident-20260927-135000` 一项),台账另有一票 G-158「DevEnv 搬入 `G:\IHUI-AI\.DevEnv`」标着"用户已拍板但当前不可执行"——两边不能都要。**所以本行等的是这一件裁决:恢复源的批准落点到底是哪个目录。** 解阻判据(三条齐了才翻勾,缺一不可):① 落点定死后给 `git-backup-refresh.mjs` 加显式 **init 档**(目标不存在时按批准落点建镜像,建完立即用 `--check` 复量,而不是继续硬失败);② `git-guardian.mjs --status` 现读 `backupOk:true`;③ 门 208 复跑不因新增镜像而变红(或镜像确在工作区外,该项自然成立)。〔本轮量到但**未做**:不 clone、不改刷新器与守护、不代裁落点;顺带记一条不冲突的现读 —— `git count-objects -vH` 报 9 枚 `.git/objects/pack/tmp_pack_*` garbage(size-pack 2.26 GiB / 松散 3628),归 §29 人工 GC 那一族,机器不自动动。〕
```

- 原 L14869(L6 真归并,保留 L15045):

```
- [ ] 〔2026-10-15 主会话普查,继 G-364 之后〕**mobile-rn vitest 仍有 5 条别名为手写替身(非纯转发)**:`@ihui/shared/utils`、`@ihui/shared/hooks`、`@ihui/shared`、`@ihui/types`、`@ihui/rn-app`。现读各替身头注均已写明替换理由(`@ihui/types` 含 esbuild 解不了的 typeof 类型语法;`@ihui/rn-app` 透传引 design-tokens;`@ihui/shared` 需按子路径动态转发),符合"刻意 mock 必须写明替换了哪几处、为什么不能指真"那一档,故不判红;但 `@ihui/shared/hooks` 自述为"realistic hook implementations"(真手写实现而非转发),是这一族里最弱的一格 —— 凡经该别名的用例测的是替身行为。**下一步(建议,未做)**:按票面⑤把"alias → tests/**mocks**/** 且该包名在 exports 表真实存在"做成**只报名不判红**的常驻清单(与 shared-auth-alias-fidelity 同型),先把这一族从"没人看守"变成"看得见";逐格是否转指真实现另计。
```

- 原 L14937(L6 真归并,保留 L15084(+正文承载段)):

```
- [ ] **G-931 那一格今日拿到硬证据(等归属:活文档归并线持有人;修法已定,属高危改动需机主点头)**:`union-converge.mjs` 的 `liveDocExpectedCounts` 按**整行字符串**算重数,对侧把某行改写过、而本侧已按清偿台账把该行删掉时,新字符串在基底面上不存在 ⇒ 被读成"对侧相对基底新增"并补回 1 份(实测 21:42 本侧 0 行 → 21:44 合并后 9 行;同族在册票还有 G-461「并集重放把已折叠过的旧形态整批带回」)。唯一正解 = 补回前按**复合主键**再问一次台账:`主键 ∈ 已入库 `plan-pointer-purge-*.md` 清偿台账 ⇒ 不补回`(与门 71/回捞器 `archivedCopy` 同一条判据,§22c 不得另抄一份)。本行不认领、不动 `union-converge.mjs`。〔让号@2026-10-15(goal 第 70 轮):本行与 L14893「G-32 活文档行 union 会把"本侧已让号删掉的旧形态"从 base/对侧补回来 ⇒ union-converge 落地闸对本侧死锁」是**同号两事**(门 130 的 F9 声明位撞号,现读 1 组),按 G-312「后来者改号」由本行(位置更后、题面自述"今日拿到硬证据"的新登记)让出 G-32,新号由写盘闸取号令牌现算;原号 G-32 留在本注可溯,两行各自归属与修法一字未动。〕
```

- 原 L14959(L6 真归并,保留 L15060):

```
- [ ] G-32 **活文档行 union 会把"本侧已让号删掉的旧形态"从 base/对侧补回来 ⇒ union-converge 落地闸对本侧死锁(归属:union-converge 落地闸持有人;本会话量到并受阻)** —— 现读取证:本侧把 7 枚登记行整体让号(`c8cecd2572`,815951..815957 → 815980..815986,四条断言:键位命中唯一 / 标题稳定片段 / 正文逐字守恒 / 旧号引用只允许是【归并】留痕行)之后,`node scripts/union-converge.mjs` 的 F9 从 7 组降到 2 组,余下两组是 `G-815926` / `G-815930` 与「图标生成器注入 radius-exempt 的恒红与…」——**而本面已经没有这两个键位行**。机理:落地闸只判"合并结果是否放大分叉",不管这行是谁删的;活文档的「每行重数取 max」在"本侧删除、对侧未改"这一格会把 base/对侧那一份重新计成 1 份,于是让号一侧的删除**结构上无法传播**,而 F9 恰恰按合并结果计组 ⇒ 谁也无法让闸变绿,除非有人能在合并面上做真正的删除(§12d/守门 100 的口径:"确要删必须在合并之后显式 git rm" —— 可这一步需要先落一次合并,而合并正被它拦住 = 死锁)。**这不是"再改一次号"能解的**(我已实证:上一轮连让两次,每次都被并发 union 把旧形态捞回,一面上攒出三个编号形态)。**候选出路三条,请择一并给出可判前置**:① 落地闸为"本侧自有旧形态副本"开一条**声明式窄口**(逐条附 file+旧号+让号到的新号+取证命令,照 `--take-ours` 的做法:声明必须可复核、少一项即拒),合并落地后立刻在合并面 `git rm` 幽灵行;② 让行 union 认得"删除"这一维 —— 某行在 base 与对侧都在、而本侧把它改写成让号形态(同标题、异键位)时**不再按 max 累加**,配套必须有一条"本侧正当新增不得被少带"的成对反例,否则就把守门 71/100 防吞行那一族能力废回去;③ 由落地闸持有人在合并面做一次一次性清账(把 815926/815930 的幽灵键位行显式删除并留让号注记)。**在①②③任一项落地前,本机凡是"本侧让过号"的会话都会被这道闸卡住,交付同步不到 origin** —— 本会话的 9 枚代码/判据提交即卡在此(圆角四道门与 face-reader 镜像在被审面全绿,已实测)。**禁止的处理**:为让闸变绿去放宽 F9/F1/F4 判据、把幽灵行算成存量债预登记进基线、或继续第三次改号。 〔2026-09-29 让号:G-815987 → G-32 —— 与 origin 面上一枚同号异题登记撞上(union-converge 落地闸 F9 现读),按 §1「后来者改号、由未推的一侧让号」本侧让;旧形态整行原文已逐字入 .ihui-agent/archive/PROJECT_PLAN_superseded-numbering-2026-09-29.md(门 71 的归档豁免),本行上一条"已还原为本号"的留痕已被本条取代〕 〔改号(2026-10-14):原G-856410〕 〔**2026-10-14 二次实测 + 兜底装车**〕同型今日再现并拿到三方面硬证据:基底 `bd459507fdd` 注记 981 / 本侧 `f5fd882ffb6` 0 / 对侧 `e3c8c3e2f9b` 981 ⇒ 合并枚 `d6e063bc8e` 带回 9 行。**归并侧"按整行字符串折"这条路已实测否掉**(曾做一版 `theirsRewriteCaps` 整族删+台账凭据,三方面回放抑制 0 行:带回的变体主键在本侧仍有持有行,且它们**中段插了本侧没有的新取证** `〔真机复核通过@2026-10-14 本席:…〕` ⇒ 折它 = 少带别人刚写的行,不可恢复;该方案整体退回,未留在收敛核里)。唯一安全的兜底已接在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(枚 `25652f864f`,镜像 13/13):回捞之后若面上真有注记就派生 `plan-pointer-purge.mjs --apply`,由它那两条准入闸(正文被幸存行逐字承载才删 / 独有注记段先移植 / 判不准逐行点名交人工)处置。**残余**:归并侧仍会带回(本票原诉求未变),代价从"人工重跑"降为"每轮自动复清";`union-converge.mjs` 落地闸对本侧死锁那一格仍未收口。
```

- 原 L14997(L6 真归并,保留 L15060):

```
- [ ] G-32 **活文档行 union 会把"本侧已让号删掉的旧形态"从 base/对侧补回来 ⇒ union-converge 落地闸对本侧死锁(归属:union-converge 落地闸持有人;本会话量到并受阻)** —— 现读取证:本侧把 7 枚登记行整体让号(`c8cecd2572`,815951..815957 → 815980..815986,四条断言:键位命中唯一 / 标题稳定片段 / 正文逐字守恒 / 旧号引用只允许是【归并】留痕行)之后,`node scripts/union-converge.mjs` 的 F9 从 7 组降到 2 组,余下两组是 `G-815926` / `G-815930` 与「图标生成器注入 radius-exempt 的恒红与…」——**而本面已经没有这两个键位行**。机理:落地闸只判"合并结果是否放大分叉",不管这行是谁删的;活文档的「每行重数取 max」在"本侧删除、对侧未改"这一格会把 base/对侧那一份重新计成 1 份,于是让号一侧的删除**结构上无法传播**,而 F9 恰恰按合并结果计组 ⇒ 谁也无法让闸变绿,除非有人能在合并面上做真正的删除(§12d/守门 100 的口径:"确要删必须在合并之后显式 git rm" —— 可这一步需要先落一次合并,而合并正被它拦住 = 死锁)。**这不是"再改一次号"能解的**(我已实证:上一轮连让两次,每次都被并发 union 把旧形态捞回,一面上攒出三个编号形态)。**候选出路三条,请择一并给出可判前置**:① 落地闸为"本侧自有旧形态副本"开一条**声明式窄口**(逐条附 file+旧号+让号到的新号+取证命令,照 `--take-ours` 的做法:声明必须可复核、少一项即拒),合并落地后立刻在合并面 `git rm` 幽灵行;② 让行 union 认得"删除"这一维 —— 某行在 base 与对侧都在、而本侧把它改写成让号形态(同标题、异键位)时**不再按 max 累加**,配套必须有一条"本侧正当新增不得被少带"的成对反例,否则就把守门 71/100 防吞行那一族能力废回去;③ 由落地闸持有人在合并面做一次一次性清账(把 815926/815930 的幽灵键位行显式删除并留让号注记)。**在①②③任一项落地前,本机凡是"本侧让过号"的会话都会被这道闸卡住,交付同步不到 origin** —— 本会话的 9 枚代码/判据提交即卡在此(圆角四道门与 face-reader 镜像在被审面全绿,已实测)。**禁止的处理**:为让闸变绿去放宽 F9/F1/F4 判据、把幽灵行算成存量债预登记进基线、或继续第三次改号。 〔2026-09-29 让号:G-815987 → G-32 —— 与 origin 面上一枚同号异题登记撞上(union-converge 落地闸 F9 现读),按 §1「后来者改号、由未推的一侧让号」本侧让;旧形态整行原文已逐字入 .ihui-agent/archive/PROJECT_PLAN_superseded-numbering-2026-09-29.md(门 71 的归档豁免),本行上一条"已还原为本号"的留痕已被本条取代〕 〔改号(2026-10-14):原G-856410〕 〔**2026-10-14 二次实测 + 兜底装车**〕同型今日再现并拿到三方面硬证据:基底 `bd459507fdd` 注记 981 / 本侧 `f5fd882ffb6` 0 / 对侧 `e3c8c3e2f9b` 981 ⇒ 合并枚 `d6e063bc8e` 带回 9 行。**归并侧"按整行字符串折"这条路已实测否掉**(曾做一版 `theirsRewriteCaps` 整族删+台账凭据,三方面回放抑制 0 行:带回的变体主键在本侧仍有持有行,且它们**中段插了本侧没有的新取证** `〔真机复核通过@2026-10-14 本席:…〕` ⇒ 折它 = 少带别人刚写的行,不可恢复;该方案整体退回,未留在收敛核里)。唯一安全的兜底已接在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(枚 `25652f864f`,镜像 13/13):回捞之后若面上真有注记就派生 `plan-pointer-purge.mjs --apply`,由它那两条准入闸(正文被幸存行逐字承载才删 / 独有注记段先移植 / 判不准逐行点名交人工)处置。**残余**:归并侧仍会带回(本票原诉求未变),代价从"人工重跑"降为"每轮自动复清";`union-converge.mjs` 落地闸对本侧死锁那一格仍未收口。 〔**2026-10-15 并发合并又带回 2 行**:一份是本行更早形态(逐字为本行的前缀子串 ⇒ 零损失摘除)、一份是 10-14 已归档的撞号副本复活;两条原文逐字进 `.ihui-agent/archive/PROJECT_PLAN_dup-declaration-2026-10-15.md`,摘除后 `f9Faces().collisions` 由 1 归 0。**这一族的根因仍在册未修**:归并侧按整行字符串比份数,把本侧已正当摘除的行当"对侧新增"补回 ⇒ 见本行上方 10-14 那段与任务清单"归并侧真修"〕
```

- 原 L15011(L5 真归并,保留 L7460(+1 段注记移植)):

```
- [ ]**D690 断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"(`apps/ai-service/tests/test_d131_pending_approval_resume.py` 6 例 RC=0)。三条修法与爆炸半径:A=服务端在重连时重放仍待决的条目(改 `llm.py::_approval_sessions` 与 agents 侧待决表的取用点,**须与 `sse_contract` 同批**);B=让主对话流帧出口写 `id:`(动 `_sse()` 是全仓共用出口 ⇒ 影响所有流式消费端与两侧契约,须单独票 + 跨端同批);C=端侧在重连后显式再拉一次待决清单(新增一次读端点,不改服务端语义)。**等谁**:用户拍板选哪条(推荐 A,理由是"不新造对外能力、只补重放"),B 的跨端代价最大。**为什么不在本轮做**:票面写"证实会丢则修在服务端",但服务端改动与并行会话持有面(`llm.py`、`sse_contract.py` 此刻均 ` M`)撞车,按 §12 不代收。 —— 租约(2026-10-02):票面那句『此刻均 ` M`』的阻塞前提已解除(`app/routers/llm.py` 与 `app/core/sse_contract.py` 现读工作树 == HEAD),按票面推荐口径 **A** 开工:服务端在重连时重放仍待决的条目,与 `sse_contract` 同批;爆炸半径与验收以票面 A 档为准。〔让号记录(2026-10-09 批⑥执行):本行原持 D173,而 D173 同号多题 —— 持有行留驻「AI 对话链路四竞品对标 V4 收口线」,本行让出原号改用 D1047(取号器现读该族最大号已越过 D1047 ⇒ 不会再被发出)。正文与验收口径逐字未改。〕 〔半程@2026-10-13 机主授权代行:agent 任务流侧已交付——agent_loop_v2.pending_approval_replays() 取数侧(仍待决=decision未写∧事件未置,thread_id==session_id 精确相等,属主精确相等 fail-closed;D1047 七例新测试)+agents.py 事件流在 start 帧后对带 Last-Event-ID 的重连重发同形 tool-approval 帧(replay:true,前端按 approvalId 幂等);回归:D131 取证六例+agent流34例全绿。**主对话流(llm.py::_approval_sessions)那半留票面未动**,理由:重连=重起一次 run,直接重放待决条目会让用户答复唤醒孤儿生成器继续执行(僵尸 run 执行结果无处落),须与 sse_contract 同批先立续传锚点 —— 与票面 A 档「须与 sse_contract 同批」一致,本行保持未勾。〕〔让号@2026-10-15:原声明号 D1047 超池(机主 2026-10-14 裁定任务号全部 ≤3 位、池式 1..999),经写盘闸正牌取号令牌让号;旧号即本注所列,检索/对账以此为准〕
```

- 原 L15015(L5 真归并,保留 L14702(+正文承载段)):

```
- [ ] **G-64 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-580 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038483〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔让号记录(2026-10-03 F9 清偿批③复投二):原号 G-580 同号多题,按 G-312 + 最早登记行持号,本任务让出原号改用本号;正文除编号位与本记录外逐字未动。〕 〔副本正文并入·承载整段:本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)**         〔改号(2026-10-14):原G-1038481〕〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔副本正文并入·承载整段:本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)**   〔改号(2026-10-14):原G-1018296〕〕 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔副本正文并入·承载整段:本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)**   〔改号(2026-10-14):原G-1018297〕〕 〔副本正文并入·承载整段:本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)**   〔改号(2026-10-14):原G-1038482〕〕 〔让号记录(2026-10-03 F9 清偿批③复投二):原号 G-580 同号多题,按 G-312 + 最早登记行持号,本任务让出原号改用本号;正文除编号位与本记录外逐字未动。〕 〔副本正文并入·承载整段:本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)**   〔改号(2026-10-14):原G-1058518〕〕
```

- 原 L15017(L6 真归并,保留 L15054(+正文承载段)):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped @13.6m——2026-08-20 以来 400+ 连红后首次 success)**。连续 3 次 main push 稳定绿后收官(并行会话持续推 main,后续 push 由后续会话按此基准观察;注意并行会话自有改动若再引入失败,以本节根因方法论排查)。CI 迭代实证(每轮根因→修复):44 败(run 34828980145)→ 15 败(34835579747,登录竞争+token 过期清零)→ 12 败(34839041078)→ 1 败(4d4932f run,579/1/1/66 @13.6m)→ 1 败(11f2cf5 run,578/1/2/66 @15.3m)→ **0 败(ac4acf3f run)**。④ 观察 3b 追加:**CSP 根因(产品级)**——`detectStreamBaseUrl` dev 分支仅凭 hostname=localhost:8801 判定,CI e2e 的生产构建 web 同跑 localhost:8801 → streamBaseUrl 跨源直连 8802 → 被 CSP `connect-src 'self' https: wss: ws:` 拦截(trace console 铁证)→ streamChat 无限重试,SSE 用例全灭;修复 = dev 分支叠加 `NODE_ENV==='development'` 门控(commit `4d4932ff`,生产/dev/Tauri 行为不变)。web 构建/运行补 JWT_SECRET(edge 中间件验签,SRO 接管根因,run 34835579747 im-channels error-context 铁证);share-function-test 自建数据 + 消息卡片改轮询(`11f2cf59`)。**教训链:本地 127.0.0.1:8821 同源 + 13.6m 快机,把 CI 的 localhost:8801 跨源 CSP、45.6m 慢机 token 过期、全新库环境依赖全部掩盖**。 〔拍板@2026-10-09 机主授权代行:维持观察口径,首个 GREEN run 后按票面节奏复核,不提前收口。〕〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕〔独有增量并入@2026-10-15/goal-r50:观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped〕 〔副本正文并入·承载整段:观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕〕 〔副本正文并入·承载整段:观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕〕
```

- 原 L15019(L5 真归并,保留 L14805(+正文承载段)):

```
- [ ] **D173 AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 —— **编号形态修正(2026-09-29,主会话单写)**:原登记为畸形号 `DD128`(族名在编号段出现两次;而第一次修正产出的 `D-172` **带连接符、不属于台账编号族** —— 唯一真相源 `check-plan-line-loss.mjs` 的 `TASK_ID_PATTERN` 里 D 族写作 `Dd+`(只有 G 族带 `-`),带横杠的号对防丢面与复合主键**双双隐身**,比畸形号更糟:它看起来像有号。成因 = 旁路落地(commit-tree)不吃 pre-commit,已清偿的一批被并发旧底稿带回。处置 = 让号:目标 D-128 已被 8 行认领(L7174,7551,7721,7927…),改回就等于替这本账再加一枚撞号;现号 `D173`,按旧号引用的人以本行为准(全仓交叉引用不逐处改写)。 〔副本正文并入·承载整段:AI 对话链路四竞品对标 V4 收口线(19 条差距 / 5 个 Sprint)** —— 唯一入口 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`(87–105),本轮不在此复述差距正文,只登记排期与等待项。**S9 尺子先行(105→97)**:先落 `scripts/audit-benchmark-delivery.mjs`(V3 §八 自留建议至今未落地,`ls` 实测不存在)与 parity 门六端扩面,**顺序不可颠倒** —— #93/#94/#96 之所以能长期存在,正是因为 §9「多端连通」的机器判据只覆盖 web 一端(`check-agent-event-parity.mjs:537` 只扫 `apps/web/src`)。**S10 移动端可达性(93→94→95)**:RN 主屏 `apps/mobile-rn/src/screens/ChatScreen.tsx:652` 起只接 7/30 回调(逐名 `comm -23` 算出缺 23 个,含 `onToolCall`/`onToolApproval`/`onPlanUpdate`/`onTerminal*`/`onSubagent*`/`onUsage`/`onBudget`/`onQuestion`/`onFormRequest`/`onReconnect`),而同端 `AiAssistantN8nScreen.tsx:1412` 是完整实现、`src/utils/chat-render-model.ts` 的 4 个 `apply*` 在主屏零调用方 ⇒ 本票主体是**接线不是开发**;#94 是信任型缺陷(RN 与小程序 `tool-approval` 双零命中,手机上遇高危操作无弹窗)。**S11 保真(87→88→89→92)**、**S12 契约地基(99→100→101→102)**、**S13 传输计量收口(96→90→91→103→98)**。**等待项(归属:等用户拍板)**:#100 内置默认高危集**改变默认行为**(现 `_high_risk_tools_from_env` 未配 env 即 `frozenset()`,`agent_loop_v2.py:288-296`),按 §24 不得由实现票自行开工;#98 桌面端薄壳是 V3 #72 已拍板架构,本票**只对齐三处口径**(tauri.conf / `ensure-web-out.mjs` 自称唯一校验点 / `docs/MULTI_END.md §2.5`),不改选型。**解阻前置(可判)**:S10 之前必须先有 S9 的端能力档案表,否则清完的端下轮又漏。**本轮同时否证 7 条断言,均写进 V4 正文,不得照旧文派单**:①②③ 上述三条 V3 过期结论;④ `packages/app` 的 `ChatScreen` 并非「未导出」—— `src/index.ts:684` 导出在位,真问题是**全仓零消费方**(同包其它 4 个聊天屏都被 mobile-rn 复用)⇒ 归 #95;⑤ web **有**消息队列与 Steer(`queue-interaction-bar.tsx` 在库,D38 已✅)⇒ 队列**不是**差距,初稿列错了;⑥ #89 初稿「主聊天流无自动重连」**否证** —— api-client `client.ts:2078/2129/3443` 有重连与 `Last-Event-ID` 续传,web `send-message.ts:767-775` 已消费 `onReconnect`,缺陷窄化为「`connection-status.tsx` 四态件生产面零挂载(命中全在 `apps/web/tests/agent-task-progress-pane.test.tsx`) + 重连后待决审批恢复未取证」;#96 那句「web 反而没有续传」同批否证;⑦ 孤儿清单里的 `voice-note.tsx` 在 HEAD 与索引双双落空,只在工作树未跟踪面 ⇒ 摘出清单、按 §12 归属未定不动。**本轮交付**:V4 文档成文并注水印(`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md`,`watermark.mjs verify` 覆盖 1/1、残迹 0、损坏 0);六端回调覆盖数改用统一交集判据重算(web 全域 30/30、extension 19、cli 12、RN 主屏 7、RN 另一屏 17、miniapp 17),并登记「事件名口径 23 与回调名口径 17 不可混用」。**待办本体是 S9–S13 的实施,本行不因文档成文而翻勾。****本轮同时更正 3 条 V3 过期结论,不得照它们派单**:#73「小程序无 AI 对话页」已被代码推翻(`apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` 1623 行,最新提交 `3f3e71a99` 09-27,按事件名覆盖 23/30);#51「`run_in_background` 只有 sleep/echo」已不成立(`task_executors.py` 现读 16 个 `async def` + import 期三面断言);#47「三套执行内核」应为「一套半」(`class AgentLoopV2` 唯一内核,但 `agent_loop.py` 仍以 `agent_executor` 被 `routers/agents.py:48`、`services/a2a_service.py:33`、`services/slash_commands.py:162` 三处生产引用)。 〔进展@2026-10-14:票面「只接 7/30、缺 23 个回调」已被现读推翻——ChatScreen 的 23 个回调已随 7104eb9e8d(D135 线在飞 WIP 落库)接齐,两屏余差仅 onTerminalInteraction,已按屏内「无渲染位帧」最小约定补接(计数+日志行,同 onTerminalDelta 模式,入库 903ea8c7f3,tsc --noEmit 过);G-84(行 10714)②「主屏回调名现读为零」系 2026-10-09 旧态快照,其两屏收敛选型拍板仍有效且未执行,本注记只记接线事实、不代行选型;#94 tool-approval 双零命中与 S9–S13 其余项不受本注记影响。〕
```

- 原 L15029(L6 真归并,保留 L15056(+正文承载段)):

```
- [ ] G-212 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** (原编号 G-603;持有行题面「第十一批」) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-603 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038486〕〔结清@2026-10-15/goal-r53:24 条发现逐条落成可执行票已验于归档 ✅ 同题副本(按编号逐条点名),抽查 G-814425 在 HEAD 台账带落点与验收〕〔更正·退回未勾@2026-10-15/goal-r61:上一轮(r54)我翻这行时抽查点名的 G-814425 经复审**属于另一票**(题面「锁的初始化写全再原子可见」= 同族 L14774/L14776 那两行),不是本票"沙箱默认严档"的落点 ⇒ 我的销账证据点错了行。第二格(24 条发现落成可执行票)有归档持有行为凭,但第一格本轮独立复核拿不到凭据:`git cat-file blob HEAD:apps/ai-service/app/services/sandbox.py` 里 strict/default-deny 类字样现读 0 命中,也没有别的在册出口能证明"默认严档"已落地。按 §10/§0.3(没判绝不写成判过)把它退回未勾,请持有会话以命令末行现读重新验收后再翻。〕
```

- 原 L15033(L6 真归并,保留 L15057(+正文承载段)):

```
- [ ] **D181 电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态已拍板@2026-09-30暂缓+登记依赖)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占用该桶;依赖立项之日随新号翻勾或注销。〕〔独有增量并入@2026-10-15/goal-r50:竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。本行自本注记起转「等条件(依赖立项)」,不再占等拍板桶;〕 〔副本正文并入·承载整段:电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态需拍板)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占等拍板桶;依赖立项之日随新号翻勾或注销。〕〕
```

- 原 L15038(L5 真归并,保留 L14819(+1 段注记移植)):

```
- [ ] **G-927. 生产备份链日志的写入侧编码要改成 UTF-8(2026-09-28 逐行 strict-UTF-8 现读登记)**:`D:\DevEnv\logs\pg-backup-scheduler.log` 自 **L571(2026-09-09 00:58:12,字节偏移 25,709)起由 UTF-8 切成 GBK 并持续至今**(前 570 行 520 行中文正常 / 之后 360 行非 UTF-8,0 个 `U+FFFD` ⇒ GBK 侧可无损还原)。**同批纠一处台账失实**:`scripts/alert-volume-report.mjs` 头注把"GBK/UTF-8 混合"记在 `deploy-loop.log` 头上,而该文件实测**整档是合法 UTF-8** —— 坏的是 09-24→09-28 那段已烘死的 475,314 个 `U+FFFD`(行 120,624–257,864,子进程管道阶段就把非 ASCII 字节换成替换字符,**原字节不可回收**);该处文案已按现读改写(规矩"只用 ASCII 判据"一字未动,改的是它给的错误机理 —— 按旧文案下一个人会去修解码器,而解码器没有坏)。**为什么现在不当场做(等环境条件,不是等人拍板)**:改法是 `deploy/win/ihui-pg-backup.ps1` 顶部加一条进程级`[Console]::OutputEncoding = UTF8` 并同笔把 `deploy/prod-bundle/` 那两份运行副本改成逐字节等值(由 prod-bundle 影子对账门判等),调度器每轮用 `&` 从磁盘重读子脚本 ⇒ 不必重启服务、下一轮 03:00 起生效;但它落在**生产备份链实际执行的那份文件**上,而"改转发壳后重启曾让 `pg_dump` 挂 3.5 分钟"那次至今没解释清(本轮另测近 5 轮各 8–15 秒,挂起不可复现)——在解释清之前不动生产备份,这条规矩自 2026-09-24 起就写在案。**归属**:生产备份链持有人。**验收判据(必须"改完且跑过")**:新增行的 strict-UTF-8 解码 non-UTF-8 计数 = 0;历史 GBK 段不做改写(对已入库运行态日志做转换属另一类动作)。**顺带一格(不单独开票)**:`IHUI-DEPLOYLOOP` 的守护半在 09-26 11:09 起就驻留旧脚本,其 catch 支管道仍按旧编码写,全档该支触发 0 次 ⇒ 零观测损伤,并入既有低峰重启窗口即可。 〔让号记录(2026-10-02 F9 清偿批②):原号 G-385 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕〔让号@2026-10-15:原声明号 G-1018282 超池(机主 2026-10-14 裁定任务号全部 ≤3 位、池式 1..999),经写盘闸正牌取号令牌让号;旧号即本注所列,检索/对账以此为准〕
```

- 原 L15055(L5 真归并,保留 L10105(+1 段注记移植)(+正文承载段)):

```
- [ ] **等持有人拍板（不挂进行中：登记人此刻不动它，挂了租约就是给后来人留假锁）** G-926 小程序主包已用到 **93.94%**（`pnpm check:all` 现读：主包 1,969,970 B / 硬上限 2,097,152 B / 余量仅 **127,182 B**，告警水位 90% 已破）—— 这是 `check:all` 当前**唯一**的非零退出项。登记前复核过：`grep '^- \[ \]'` 全集中提到「主包 / 2 MiB / 2,097 / AB1 / 产物预算 / 包体积」的未勾选条目**零条**（只有几条已完成行沾到这些词，且属别的话题）。红在干净 HEAD 上，按 §12f 优先级高于一切新增，但**处置动作属结构决策**不是清行数：`pages/member` 442,546 B / 31 文件与 `pkg-ai` 532,110 B / 121 文件是两块最大占用，把它们再拆独立分包 / 把静态资源外置 CDN 才会移动这个数字，而"哪些页面允许延后加载"改变的是用户首屏行为，须产品拍板。**不许为了让 `check:all` 变绿去调水位或改判据**（§12e：那是给已发生的债发通行证）。落地判据：改完后 `pnpm check:all` 末行 RC=0 且主包余量回到 >10%，且小程序真机首屏与 tabBar 页可达性实测过（不是只看构建产物）。前置排队原因如实：此刻生产被真分叉挡停（见 G-731 同族），在飞文件 11 个，不宜同时动分包结构。 〔复测@2026-09-29 09:5xZ/子代理实测(证据 `.ihui-agent/tmp/artifact-budget/ev-gate-2.txt`,末行 `#EVIDENCE-RC=1`):主包 **1,991,882 B / 余 105,270 B = 94.98%**,AB2 悬空 map 0 处;**"09-29 才红"这个前提不成立** —— 钩子日志三点序列(09:37Z 现读):dist=09-14 → 1,777,590 B = 84.76% 绿 161 次;dist=09-28 16:36 → 1,969,970 B = 93.94% **首红 49 次**;dist=09-29 → 94.98% 7 次。此前是一台 14 天前的旧 dist 把它掩成绿。产物不陈:最新 mtime 07:06Z(2.4 小时),另起独立目录复核 = 63 文件 / 1,991,882 B 与门逐字同值。〕 〔增长归属(09:34–09:37Z 现读主包贡献):`common.js 1,149,619 B(57.7%,内含离线语言包 base64 440,564 B = **主包 22.1%**)` > vendors 165,771 > app.js 139,026 > taro.js 133,149 > base.wxml 78,799 > app-origin.wxss 68,839 > pages/user 49,569 > pages/index 49,129;09-14→HEAD 增量可归因部分 = 离线包 +55,032 + 两份 zh-CN 内联 +33,604 ⇒ **i18n 约占总增量 +192 KB 的 46%**,余 ~104 KB 未判定。〕 〔**关键新结论:机械杠杆不够数**(合计实测仅 28,015 B,而回到 90% 水位需卸 ≥104,446 B = 需求的 27%):① 主包 9 个**零引用** tabbar PNG = 14,973 B(含 `community-active.png` 11,823)—— 加进 `apps/miniapp-taro/config/index.ts` 现有 `copy…ignore` 即可,零 UI、与枚 `2162e460ee` 同一条通道,**但风险要写清**:dist 里现无 `custom-tab-bar`,若日后编译进来即静默 404 ⇒ 须同批跑 `check-miniapp-generated --worktree` 复验;② zh-CN 两层同名同值 134 键 = 6,263 B(21 个同名**异值**键不可动,需裁);③ 四语合一 gzip 包 = 4,988 B(动冷启动解码路径);④ terser `extractComments:false` = 1,400 B;⑤ tabbar PNG 重 deflate = 391 B。另两条否证:`optimizeMainPackage` 与 `terser ascii_only:false` **都已开**;主包 5 页全是 tabBar 页 ⇒ 2162e460ee 那一招已无货。⇒ **唯一 ≥100 KB 的路是 i18n 离线载荷策略**(440 KB 整份躺在主包),而"哪些页面允许延后加载 / 离线包是否改为按需拉取"改变的是用户首屏行为,仍须产品拍板 —— 本票的前提不变,只是现在有了数字。〕 〔拍板@2026-10-07 机主:批准按票面分包方案执行小程序主包瘦身〕 〔拍板@2026-10-07 机主:批准按票面分包方案执行小程序主包瘦身〕 〔拍板@2026-10-09 机主授权代行:批——机械杠杆①(9 个零引用 tabbar PNG 进 copy ignore,同批跑 check-miniapp-generated --worktree 复验)立即执行;pages/member 拆独立分包立项(真机首屏验收兜底);水位与判据一字不动〕〔执行落账@2026-10-10(机主授权代行拍板轮):杠杆①现读复核——9 个零引用 tabbar PNG 中守门 R2 现读零引用集合=8 张(agent/ai/share/square×2),该批 **copy.ignore 配置面已在位**(config/index.ts:88-97,2026-09-26 批落);构建复验两连败于 ui-routes 生成链水印注入 UNKNOWN/-4094(即 G-1058635 票面「4 个别人在飞的输入」,ui-routes 产物链他席在飞)⇒ 本项转**等条件**:ui-routes 在飞解阻后跑 pnpm check:all 验主包余量>10% 即收口;pages/member 拆独立分包按 10-09 裁决立项,真机首屏验收兜底。拍板不等于验收,不翻勾。〕 〔杠杆①复验收口@2026-10-10:copy.ignore 8 张(agent/ai/share/square×2,config/index.ts:88-97)配置面在位,check-miniapp-generated --worktree R2 确认 8 张 tabbar PNG 产物零静态引用;web ui-routes 产物因本会话 feedback 消费点致陈旧已复生成(890 条路由);预算门 check-artifact-budget --target miniapp RC=0:主包 1,592,739 B / 已用 75.95% / 余量 504,413 B(>10% 达标;dist=10-09 04:10 构建已含 ignore 面,较 93.94% 基线降 18 个百分点,含并行会话分包改造贡献);全量 check:all 仍红于 extension ui-routes 产物陈旧(SidepanelApp.tsx 他人 in-flight,复生成归其持有人,§12 不代动);真机首屏与 tabBar 页可达性实测待用户——拍板不等于验收,不翻勾。〕 〔拍板@2026-10-13 机主授权代行:哪些页面延后加载——pages/member(442,546B/31 文件)整目录迁独立分包;pkg-ai 不再拆、静态资源不外置 CDN(不动首屏依赖链)。前置排队(生产真分叉挡停)已解除;实施须满足本行落地判据(check:all RC=0+主包余量>10%+真机 tabBar 页可达实测),按分包瘦身批排期执行,不许调水位改判据。〕〔让号@2026-10-15:原声明号 G-814393 超池(机主 2026-10-14 裁定任务号全部 ≤3 位、池式 1..999),经写盘闸正牌取号令牌让号;旧号即本注所列,检索/对账以此为准〕 〔副本正文并入·承载整段:等持有人拍板（不挂进行中：登记人此刻不动它，挂了租约就是给后来人留假锁）** G-814393 小程序主包已用到 **93.94%**（`pnpm check:all` 现读：主包 1,969,970 B / 硬上限 2,097,152 B / 余量仅 **127,182 B**，告警水位 90% 已破）—— 这是 `check:all` 当前**唯一**的非零退出项。登记前复核过：`grep '^- \[ \]'` 全集中提到「主包 / 2 MiB / 2,097 / AB1 / 产物预算 / 包体积」的未勾选条目**零条**（只有几条已完成行沾到这些词，且属别的话题）。红在干净 HEAD 上，按 §12f 优先级高于一切新增，但**处置动作属结构决策**不是清行数：`pages/member` 442,546 B / 31 文件与 `pkg-ai` 532,110 B / 121 文件是两块最大占用，把它们再拆独立分包 / 把静态资源外置 CDN 才会移动这个数字，而"哪些页面允许延后加载"改变的是用户首屏行为，须产品拍板。**不许为了让 `check:all` 变绿去调水位或改判据**（§12e：那是给已发生的债发通行证）。落地判据：改完后 `pnpm check:all` 末行 RC=0 且主包余量回到 >10%，且小程序真机首屏与 tabBar 页可达性实测过（不是只看构建产物）。前置排队原因如实：此刻生产被真分叉挡停（见 G-731 同族），在飞文件 11 个，不宜同时动分包结构。 〔复测@2026-09-29 09:5xZ/子代理实测(证据 `.ihui-agent/tmp/artifact-budget/ev-gate-2.txt`,末行 `#EVIDENCE-RC=1`):主包 **1,991,882 B / 余 105,270 B = 94.98%**,AB2 悬空 map 0 处;**"09-29 才红"这个前提不成立** —— 钩子日志三点序列(09:37Z 现读):dist=09-14 → 1,777,590 B = 84.76% 绿 161 次;dist=09-28 16:36 → 1,969,970 B = 93.94% **首红 49 次**;dist=09-29 → 94.98% 7 次。此前是一台 14 天前的旧 dist 把它掩成绿。产物不陈:最新 mtime 07:06Z(2.4 小时),另起独立目录复核 = 63 文件 / 1,991,882 B 与门逐字同值。〕 〔增长归属(09:34–09:37Z 现读主包贡献):`common.js 1,149,619 B(57.7%,内含离线语言包 base64 440,564 B = **主包 22.1%**)` > vendors 165,771 > app.js 139,026 > taro.js 133,149 > base.wxml 78,799 > app-origin.wxss 68,839 > pages/user 49,569 > pages/index 49,129;09-14→HEAD 增量可归因部分 = 离线包 +55,032 + 两份 zh-CN 内联 +33,604 ⇒ **i18n 约占总增量 +192 KB 的 46%**,余 ~104 KB 未判定。〕 〔**关键新结论:机械杠杆不够数**(合计实测仅 28,015 B,而回到 90% 水位需卸 ≥104,446 B = 需求的 27%):① 主包 9 个**零引用** tabbar PNG = 14,973 B(含 `community-active.png` 11,823)—— 加进 `apps/miniapp-taro/config/index.ts` 现有 `copy…ignore` 即可,零 UI、与枚 `2162e460ee` 同一条通道,**但风险要写清**:dist 里现无 `custom-tab-bar`,若日后编译进来即静默 404 ⇒ 须同批跑 `check-miniapp-generated --worktree` 复验;② zh-CN 两层同名同值 134 键 = 6,263 B(21 个同名**异值**键不可动,需裁);③ 四语合一 gzip 包 = 4,988 B(动冷启动解码路径);④ terser `extractComments:false` = 1,400 B;⑤ tabbar PNG 重 deflate = 391 B。另两条否证:`optimizeMainPackage` 与 `terser ascii_only:false` **都已开**;主包 5 页全是 tabBar 页 ⇒ 2162e460ee 那一招已无货。⇒ **唯一 ≥100 KB 的路是 i18n 离线载荷策略**(440 KB 整份躺在主包),而"哪些页面允许延后加载 / 离线包是否改为按需拉取"改变的是用户首屏行为,仍须产品拍板 —— 本票的前提不变,只是现在有了数字。〕      〔执行落账@2026-10-10(机主授权代行拍板轮):杠杆①现读复核——9 个零引用 tabbar PNG 中守门 R2 现读零引用集合=8 张(agent/ai/share/square×2),该批 **copy.ignore 配置面已在位**(config/index.ts:88-97,2026-09-26 批落);构建复验两连败于 ui-routes 生成链水印注入 UNKNOWN/-4094(即 G-1058635 票面「4 个别人在飞的输入」,ui-routes 产物链他席在飞)⇒ 本项转**等条件**:ui-routes 在飞解阻后跑 pnpm check:all 验主包余量>10% 即收口;pages/member 拆独立分包按 10-09 裁决立项,真机首屏验收兜底。拍板不等于验收,不翻勾。〕 〔杠杆①复验收口@2026-10-10:copy.ignore 8 张(agent/ai/share/square×2,config/index.ts:88-97)配置面在位,check-miniapp-generated --worktree R2 确认 8 张 tabbar PNG 产物零静态引用;web ui-routes 产物因本会话 feedback 消费点致陈旧已复生成(890 条路由);预算门 check-artifact-budget --target miniapp RC=0:主包 1,592,739 B / 已用 75.95% / 余量 504,413 B(>10% 达标;dist=10-09 04:10 构建已含 ignore 面,较 93.94% 基线降 18 个百分点,含并行会话分包改造贡献);全量 check:all 仍红于 extension ui-routes 产物陈旧(SidepanelApp.tsx 他人 in-flight,复生成归其持有人,§12 不代动);真机首屏与 tabBar 页可达性实测待用户——拍板不等于验收,不翻勾。〕〕
```

## 跳过交人工(逐行点名,不静默)

- L14663:L5 幸存行 L7608 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] G-1. 流式中切换模型 → 终止后自动带入新模型 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038307〕
  ```

- L14825:L5 幸存行 L7608 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] G-53. 流式中切换模型 → 终止后自动带入新模型 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1018221〕
  ```

- L14884:L5 幸存行 L7727 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] **G-352. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。) (原编号 G-351) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-351 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 (原编号 G-351) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-351 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 (原编号 G-351)
  ```

- L14940:L5 幸存行 L14937 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] **G-32 那一格今日拿到硬证据(等归属:活文档归并线持有人;修法已定,属高危改动需机主点头)**:`union-converge.mjs` 的 `liveDocExpectedCounts` 按**整行字符串**算重数,对侧把某行改写过、而本侧已按清偿台账把该行删掉时,新字符串在基底面上不存在 ⇒ 被读成"对侧相对基底新增"并补回 1 份(实测 21:42 本侧 0 行 → 21:44 合并后 9 行;同族在册票还有 G-461「并集重放把已折叠过的旧形态整批带回」)。唯一正解 = 补回前按**复合主键**再问一次台账:`主键 ∈ 已入库 `plan-pointer-purge-*.md` 清偿台账 ⇒ 不补回`(与门 71/回捞器 `archivedCopy` 同一条判据,§22c 不得另抄一份)。本行不认领、不动 `union-converge.mjs`。
  ```

- L14974:L5 幸存行 L7727 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] **G-1038427. 分叉合并把 12 个"首行相同、正文已漂移"的重复登记块并到了一起(台账锚点 F4b 由两侧各自的 0 抬到 12),这不是存量欠账,是合并自己造出来的形态**:机制 —— 同一段多行登记被两条分支各自抄走后又各改了正文,行级判据(F1/F2/F4)按"编号 + 标题前缀逐字等值"配对,配不上这种"块级同、行内漂";而 union 的行重数策略对每一行都只"补对侧净增",于是两份漂移副本都活了下来。出口只有 `node scripts/plan-tasks-merge.mjs --dedupe-blocks` 的**报告档**(先不带 --commit 出清单),它**只删逐字相同的第 2..N 份**,**漂移副本一份都不动** —— 机器折半即有损,所以那 12 块必须逐块人工判"哪一份是当前状态",判完就地改写或翻勾并写明归并到谁(§1 第 2 条)。**等什么**:逐块裁决要读两条分支各自的上下文,不由合并代裁;在此之前 F4b=12 只是现读锚点,不得被读成"已修"。(2026-09-28 合并时登记,现值一律跑 `node scripts/plan-tasks.mjs --gate --json` 看末行) (原编号 G-351) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-351 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 (2026-09-28 二次改派:上一轮的号是按当时快照取的,合并落地后又被并发批次用掉同号 ⇒ 本次改由 live-doc-edit 在每次 CAS 里按当下 HEAD 现算,不再照快照取号。)
  ```

- L15013:L5 幸存行 L7608 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型   〔改号(2026-10-14):原G-1038307〕〕 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 〔副本正文并入·承载整段:流式中切换模型 → 终止后自动带入新模型   〔改号(2026-10-14):原G-1018221〕〕〔进度@2026-10-15/goal-r51:web 腿已装车可测 —— use-chat/model-switch.ts 被 use-chat.ts(shouldTerminateForModelSwitch/terminateActiveStream)与 send-message.ts(resolveRoundModel)消费,vitest model-switch.test.ts 末行「Tests 18 passed」。miniapp/RN 两腿按 §9 仍是活账,不得据此翻勾。〕
  ```

- L15084:L5 幸存行 L14937 已被既有层处置 ⇒ 本行跳过(幸存行消失的删行 = 净丢活)

  ```
  - [ ] **G-931 那一格今日拿到硬证据(等归属:活文档归并线持有人;修法已定,属高危改动需机主点头)**:`union-converge.mjs` 的 `liveDocExpectedCounts` 按**整行字符串**算重数,对侧把某行改写过、而本侧已按清偿台账把该行删掉时,新字符串在基底面上不存在 ⇒ 被读成"对侧相对基底新增"并补回 1 份(实测 21:42 本侧 0 行 → 21:44 合并后 9 行;同族在册票还有 G-461「并集重放把已折叠过的旧形态整批带回」)。唯一正解 = 补回前按**复合主键**再问一次台账:`主键 ∈ 已入库 `plan-pointer-purge-*.md` 清偿台账 ⇒ 不补回`(与门 71/回捞器 `archivedCopy` 同一条判据,§22c 不得另抄一份)。本行不认领、不动 `union-converge.mjs`。〔让号@2026-10-15(goal 第 70 轮):本行与 L14893「G-32 活文档行 union 会把"本侧已让号删掉的旧形态"从 base/对侧补回来 ⇒ union-converge 落地闸对本侧死锁」是**同号两事**(门 130 的 F9 声明位撞号,现读 1 组),按 G-312「后来者改号」由本行(位置更后、题面自述"今日拿到硬证据"的新登记)让出 G-32,新号由写盘闸取号令牌现算;原号 G-32 留在本注可溯,两行各自归属与修法一字未动。〕
  ```

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
