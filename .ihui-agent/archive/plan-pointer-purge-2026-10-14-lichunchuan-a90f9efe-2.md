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
> 分类:L1 40 / L2 2 / L3 0 / L4 66 / L5 0 / L6 0 / 已勾剥注记 0 / 认领转移 0 / 注记移植 0 / 跳过 1。
> 落地方式:对象空间(HEAD blob → 改写 → commit-tree → CAS),从不写工作树;旁路已 attestBypassCommit 留痕。
> 取名基准(2026-10-15 跨机同名止血):机器标识 = lichunchuan-a90f9efe;远端面 = origin/heads/main@a5b35a000a53。
> 下列每行为被删行原文(带原行号与分类原因)。

- 原 L3821(L1 外部持有行 L7702):

```
- [ ] 重启宿主/开机后 `%TEMP%` 才会真指 `D:\DevEnv\Temp`;在此之前任何未接 `scratch-dir` 的 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「重启宿主/开机后 `%TEMP%` 才会真指 `D:\Dev…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L4700(L1 外部持有行 L7720):

```
- [ ]（进行中）**守门 91 冻结的 9 处待清 + 一项方法论债(2026-09-24)**:① study-publish 整文件主题化(14 处 `getTokens('light')`,8 处在模块级 StyleSheet.create 里,须改成按 scheme 生成的函数或下沉到组件内), 改完后 `node scripts/check-theme-prop-wiring.mjs --update-baseline` 应收窄; ② 7 个他人 M 在制的屏(CourseDetail / Distribution / LiveDetail / ModelPlaza / N8nModel / PostCreate / SharedDemo)待其会话自行接线; ③ `{...props}` 展开类站点被判 spread-unknown(判不出即如实报,不静默放行)—— 要真正覆盖须先给端内 wrapper 的 props 建立类型事实,属独立改造; ④ 方法论债:**本轮两次误判同源** —— 一次是把像素被 `rgba(0,0,0,0.6)` 遮罩压暗 40% 当成"颜色没落上", 一次是用"文本里有没有某个键"统计出"0 处漏传"。两者的共同错误是**用一个不测量目标东西的探针给出肯定结论**。 纪律:凡给出"0 处 / 没有 / 已全清"这类否定性结论,必须先构造一个**已知应被命中的正例**喂给同一判据(阳性对照), 否则该结论不得写进文档或据此决定"不做"。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「守门 91 冻结的 9 处待清 + 一项方法论债(2026-…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7218(L1 外部持有行 L15172):

```
- [ ] G-1038486 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** (原编号 G-603;持有行题面「第十一批」) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-603 同号多题,按交接票 G-1018210 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7535(L1 外部持有行 L14778):

```
- [ ] G-815943 **归属:union-converge 落地闸持有人 —— 两版 F5 修法被"整文件取向"的并发合并各自抹掉过,现在活的只有一版;另一版的欠账名单与 --json 问责要恢复,只能三方合、不能整文件搬** —— 现读 HEAD 面的 `scripts/union-converge.mjs`:`本侧相对共同基底自己缩了量` 那一版在位(它实测能让真面合并过闸,今晚 04:1x 的 dry-run RC=0 就是它),而枚 `c18ac45d98` 引入的 `f5Deficit`/`suppCredit`(逐行点名欠账注记 + `--json` 可问责)**在 HEAD 里 0 命中**;反过来本侧第二版"额度基准改用生成器自己的期望值"也没了。两版各自消失过一次,是同一条路径造成的:代码文件在跨机合并里按"对侧相对基底动过 ⇒ 整文件取那一版",于是**文件还在、里面的实现被换成旧版**,而守门 100 是路径级零丢失判据,对这一型结构上看不见。**为什么本票不直接把它合回来**:实测把两版合成一份去提交,守门 84 的 R1r 行级复活判据点名"复活 4 行 ← 见于祖先 `45167ff85`"并定责为本任务红(那 4 行是 `}`/`.join('')`/`(() => {` 这类被两版各自挪过位置的形状行)—— **84 没有错,错在上游用整文件取向压扁了两个真实分叉**;正解是给代码文件也走内容级三方(与活文档同一纪律),再谈恢复名单那一版。修法与判据持有人裁,本票只交证据;复现:`git show HEAD:scripts/union-converge.mjs | grep -c f5Deficit`(现读 0)、`node scripts/union-converge.mjs --self-test`。 〔让位注记(2026-09-29):本行原为 G-815930,与另一会话同日取的「归属:…」那一行同号 —— 落地闸在归并时才判出"同两个号挂两种标题"(F9 新增撞号,不允许声明放行)。按本仓既有口径"已推送侧不动、未推送侧让号",由**本行**改到现算的空闲号;正文与判据一字未改。空闲号由 `lib/plan-task-index.usedIdsOfPrefix` 在"台账 ⊕ 归档件"那张占用面上现算,不写第二份判据。〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「归属:union-converge 落地闸持有人 —— 两版…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7536(L1 外部持有行 L14779):

```
- [ ] G-815944 **归属:守门 98 D4(影子 .js)持有人 + api 路由持有人 —— `user-concurrency-service.js` 删过 1 次、在 86 枚提交里被翻回来 23 次,"只删文件"这件事本身不成立** —— `apps/api/src/services/user-concurrency-service.js` 与同名 `.ts` 是**同一个 blob**(`8e0e5199574a…` 逐字节相同),纯影子 .js;`6bf657df86`(09-29 01:12)删过它,但此后状态翻转 23 次,复活来源两类:① union-converge 的"对侧删除不随合并传播"(刻意设计,防合并吞并),② 单父提交把整棵旧基线写回。**必要条件(缺一必复发)**:三处按 `.js` 后缀写的说明符必须先改掉 ——`apps/api/src/routes/v1-public.ts:65`、`apps/api/src/routes/developer-relay-keys-admin.ts:24`、`apps/api/tests/user-concurrency-leak.test.ts:50`;Node 按扩展名解析,说明符不动则删掉的 .js 会被下一次合并以"对侧仍引用"的形态带回来。门 98 的镜像取证取自 `6bf657df86^` 历史 blob 而非 HEAD,所以"删了不红"不代表"删得住"。另:CI 的 `source-check` 步骤(`.github/workflows/ci-monorepo.yml:91` 内联 find)判的是**提交树**,本机工作树跑同样的命令会因为文件在而红/不在而不红,读数一律带 sha。 〔让位注记(2026-09-29):本行原为 G-815931,与另一会话同日取的「归属:…」那一行同号 —— 落地闸在归并时才判出"同两个号挂两种标题"(F9 新增撞号,不允许声明放行)。按本仓既有口径"已推送侧不动、未推送侧让号",由**本行**改到现算的空闲号;正文与判据一字未改。空闲号由 `lib/plan-task-index.usedIdsOfPrefix` 在"台账 ⊕ 归档件"那张占用面上现算,不写第二份判据。〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「归属:守门 98 D4(影子 .js)持有人 + api 路…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7537(L1 外部持有行 L14961):

```
- [ ] G-815945 **归属:端口注册表门 + ai-service ruff + 受保护检查 lint-typecheck-test —— 三条红都在干净已入库代码上,按 §12f 优先级高于任何新增工作** —— ① `node scripts/check-port-registry.mjs --all` 现读 23 处命中(默认档只扫 2 个文件所以本机看着绿,CI 带 `--all`),全部 in-commit,集中在今天新入库的门与其夹具:`scripts/tests/check-service-binary-pots…`(实读 `check-service-binary-paths.test.mjs` 13 处)、`scripts/check-service-binary-paths.mjs:1525-1529`、`apps/desktop/README.md:46-51`、`apps/cli/tests/` 2 处、`apps/api/src/utils/egress-retry-safety.ts:26`(JSDoc 里的示例地址,该 corpus 不剥注释)。该门的 `EXEMPT_PATH_PATTERNS`(`scripts/check-port-registry.mjs:220-245`)只豁免了 `apps/api/tests`、`apps/ai-service/tests`,**不含 `scripts/tests` 与 `apps/cli/tests`** ⇒ 修哪一侧属该门持有人裁,**不得为变绿删夹具**(夹具是把端口写进断言的正当形态)。② `apps/ai-service` 的 `ruff check .` 现读 54 errors / 32 文件(版本与 `pyproject.toml:88` 的 `ruff==0.16.6` 同 pin 可精确复现),其中 `app/routers/llm.py:3269` 的 `F821 Undefined name tool_exec_tracker` 是唯一疑似**真功能缺陷**的一格,其余是 I001/UP0xx/SIM 类风格。③ 受保护检查 `CI / lint-typecheck-test (push)` 本身在 `496e4ced44`/`bedf82ed9c`/`dd6fb971f5` 上均 failure ⇒ 直推还能走、PR 通道被堵,这是全队交付阻塞而不是一条难看;具体失败步骤未判定(GitHub 未认证配额耗尽 + 日志端点 403),取证另有一路在跑,结论落地后并入本行。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「归属:端口注册表门 + ai-service ruff + …」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7542(L1 外部持有行 L14780):

```
- [ ] G-815948 **归属:部署环告警去重持有人(deploy/win/alert-dedup.ps1 + ihui-deploy.ps1:257 Invoke-FailNotify)—— 去重身份 = 整条消息文本,而消息不含"这一轮的原因",于是原因换了也会被旧槽位静默压住** —— 实测:03:51 那轮消息带包名(`构建失败(workspace 包 @ihui/types dist 重建失败(exit 2))`)⇒ 独立槽位,正常喊;04:37 那轮消息是通用档(`构建失败(next build 连续 4 次失败,保持当前在线版本)`),**文本里没有任何病因**(真实病因是工作树缺两个模块:一个 HEAD 有而索引/磁盘无,一个引用先落被引用文件未写),于是它落进一个 1.9h 前就寄过的同名槽位,`ALERT 同身份失败告警本轮跳过` @04:22 与 @04:38 各一次 ⇒ 人到下一封同类信最早要等满 4h 窗口,而那封信**仍然不带病因**。**为什么本票不直接改**:`$sig = 消息全文` 这条正是 09-28 刚为此付过学费的设计(更早是"两版措辞交替 ⇒ 每交替一次就另发一封并覆盖对方时间戳",实测 48h 寄 47 封同一件事)—— 把易变的病因文本塞进身份键,等于把那个风暴装回去。**该做的形态是把"身份"与"正文"拆开**:身份保持粗类稳定(继续按身份去重、**不设总量封顶**,§5e 铁律),正文允许带本轮病因摘要(如首个错误行的 `file:line` + 错误码),这样"原因变了"在日志与信里都可见,而重发节奏不变。落地前置:同一粗类下"病因摘要变化"不得另开槽位(否则回到 47 封),须由该门持有人用一条成对用例钉住(病因变⇒正文变、身份不变⇒仍按 4h 压;粗类变⇒新槽立即喊)。核对入口(只读):`grep -a "ALERT 同身份" deploy/win/deploy-loop.log | tail`、`cat .workbuddy/alert-notify-state*.json 或 $AlertNotifyStateFile 指向的文件`(键集合即当下所有身份槽)。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「归属:部署环告警去重持有人(deploy/win/alert…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7561(L1 外部持有行 L14781):

```
- [ ] G-815980 **归属:守门 130(计划任务状态一致性)持有人 —— 基线档与差值档现在互相矛盾,而矛盾的结果是"每一次台账提交都被逼跳门";本票只交读数与两条出口,不改判据** —— 同一份内容(我刚把索引对齐回 HEAD,工作树那份别人的在飞副本一个字没动)现读:`check-stale-revert --staged` **RC=0**(防回退已不冤枉人),`plan-tasks --gate --staged` 里**差值档说**「✅ 相对 HEAD,本次提交未新增状态分叉(F1=105 F2=0 F3=0 F4=423 F4b=110 F6=0 F8=0 F9=113)」,而**基线档说**「❌ F1 由基线 0 涨到 105;F4 由基线 0 涨到 423」⇒ 提交链整体红。按 §1 写下的语义("提交链上跑的是差值棘轮…存量永不拦 —— 与改动无关的恒红门只会逼人 --no-verify,连带废掉全部守门")这两档现在只能有一档是对的。**为什么这不是"把门调松"**:基线档存在的理由正是"差值档看不见别人跳门把增长塞进 HEAD"那一型,它没错;错的是**没有任何一档能区分"这次提交造成的增长"与"别人跳门留下的存量"**——于是每个想正经提交的人都被判成别人欠的债,唯一出路就是跳门,而跳门又正好制造它要防的那种存量。实测代价就在今天:`.workbuddy/safe-commit-attestation.jsonl` 现读当日 `ranFullBatch=false` 与 `kind=bypass-landing` 合计已经不少(我本轮量到 25 条"整批守门没跑"),这些提交正是"红在无关处 ⇒ 合法跳过"的产物。**两条出口,任选一条都需要你拍**:(甲)把这 105 组 / 423 行逐组清偿后 `--update-baseline`(它只允许收窄,符合 G-312「不得批量改号」);我已验证**自动出口到不了这一层** —— `plan-tasks-merge --heal` 只读报告现读「拟改写 0 行 / F1 0 组 / F4 0 副本 / 未勾选 419」,即归并器按"未勾选 + 编号位"的口径看不见这些组,所以清偿不是跑一条命令的事。(乙)给基线档补一条**"本次提交造成的增量"与"HEAD 相对基线的漂移"分列**的判据:漂移只报名、不拦提交,拦的仍是"这一枚提交让分叉变多"(与它自己的存在理由同形),并配成对用例钉住"别人跳门塞进来的增长必须仍被另一层看到"(候选:守护轮/CI 档跑基线档并喊人,而不是压在提交者头上)。我倾向 (乙),因为 (甲) 需要人逐组判 528 项而 (乙) 不需要任何豁免就能同时保住两档的语义。**等谁**:该门持有人拍语义;本机值守会话不再自行实现,避免与 G-606/G-313 那条链上的人撞车(那票已有 3 行带租约的认领)。核对入口(全只读):`node scripts/plan-tasks.mjs --gate --staged`、`node scripts/check-stale-revert.mjs --staged`、`node scripts/plan-tasks-merge.mjs --heal`、`node -e` 读当日 attestation 计数。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「归属:守门 130(计划任务状态一致性)持有人 —— 基线档…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7610(L1 外部持有行 L14787):

```
- [ ] G-816502 测试收集门只 warn:14 个文件的用例一条都没执行,而提交链全程不响(等条件:收集失败数归零;归属:该门持有人) —— 现读口径跑 `node scripts/check-test-collection.mjs --json`(名字以此为准,不存在就是未判定)。已入库事实:某端曾有 14 个套件在收集阶段整体失败(内含约 131 条 it 声明),端内约三分之一覆盖被静默削掉,而提交链 190 道门里没有一道跑测试(staged typecheck 走 tsc,结构上看不见解析期失败)。定级 warn 是设计前提不是偷懒:该数随他人工作树在 2→0→43 间跳,挂 blocking 就是每台每次被逼 `--no-verify`,一次绕过 ≈ 那枚提交上全部守门作废(§12e)。升 blocking 的前置写死在这里:① 全端收集失败数现读归零;② 同笔配一条"摘线不得被读成已装车"的反向锁与"定级被改成 blocking 必读得出"的镜像断言。禁止为变绿去删测试文件或放宽收集判据 —— 那等于把覆盖归零洗成"没有测试可跑"。（原编号 G-815997;2026-09-29 跨机撞号止血由枚 6007bfecf6 让入预留段,本行只补留痕、语义未动） (原编号 G-816502;持有行题面「测试收集门只warn」) 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「测试收集门只 warn:14 个文件的用例一条都没执行,而提…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L7719(L1 外部持有行 L14508):

```
- [ ] **⑤-附:运行副本要不要也开邮件,前提已变,请重新决定**。我**没有**覆盖 `D:\DevEnv\monitor\alertmanager\alertmanager.yml`:那是当前唯一真正在到人的 webhook 路由,拿模板产物整文件替换会有回归面;正确做法是在那份文件里**追加** `global` 邮件段 + 一个 email receiver(保留原 route 不动)。因为你当初批准这条的依据是"告警从未送达",而该前提已被我证伪,所以这一步改回由你定,我不代做。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「⑤-附:运行副本要不要也开邮件,前提已变,请重新决定。我没有…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L8584(L1 外部持有行 L14512):

```
- [ ] **P1-② AI 辅助批量对齐(在等:P0-① 补齐的 features 触发面先攒出一轮真实分叉样本)**:复用既有 `i18n-diff → AI agent → i18n-apply` 流水线范式做跨端 UI 批量对齐。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「② AI 辅助批量对齐(在等:P0-① 补齐的 featur…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L8884(L1 外部持有行 L14809):

```
- [ ] G-998169 票 6【观察】按消费者可见性分级的后台事件投递档位（出处 b76-12g）：- **上游机制（path:line）**：`:4760-4766`（`eventCoalescing?.mode === "background-summary"` 才建合并器，`flushDelayMs` 由订阅方给）；`:4782-4787`（注释「性能优化：后台 task 只需要低频摘要，**不能让不可见任务的 token/progress 同频唤醒 renderer**；active 订阅没有 eventCoalescing，仍保持实时 continuous」；合并在 `deliverToListener` 里、即**订阅者层**做）；`:4752-4753`（「cancelled/retryTimer 的作用域是单个订阅者：调用方 dispose 时取消自己的重试，不影响共享 emitter 上的其他订阅者」）；`:1089-1100`（慢握手隔离到独立进程泳道，注释记录「合并时误删了独立进程：mcp/list 的慢握手会堵住串行 stdio 队列，连带卡住插件卸载」）；`:5495-5496`（「被动订阅若使用启动型 client，workspace 数量会直接放大成 CLI 数量」）。 - **我方建议落点域**：`packages/api-client`（`client.ts:2417-2469` 的 SSE 消费面）+ `apps/api`（`ai-chat-stream.ts` 的会话转发面）。 - **我方现状（命令 + 命中数）**：`-e "coalesc"` → **205**（抽查后多为 SQL `coalesce()`，见 `apps/api/src/db/agents-queries.ts:319`）、`-e "debounce"` → **377**、`-e "throttle"` → **56**、`-e "节流"` → **101**、`-e "deliveredEventIds"` → **0**。 - **哪一半我方已经是对的（file:line）**：生产者侧按内容类别的节流状态机已成熟——`apps/ai-service/app/core/current_time_reminder.py:8`、`:16`（「节流四要素：①新窗口（window_id 变化）必投；②`interval_seconds==0` 每推理必投；…」）、`:159`、`:195`；合并件已存在（`apps/ai-service/tests/test_engine_harness_twentytwo_to_twentyfour.py:110-116` 的 `DebouncedWatchReceiver` 合并路径）；按字节预算裁缓冲已存在（`apps/ai-service/app/core/sse_buffer.py:229` 的 `excess -= entries[drop].size`）。 - **为什么这不算已有等价**：这些节流全在 **ai-service 生产端、按内容类别** 做；上游那条「按**消费者此刻是否可见**决定投递频率档位，并且档位做在订阅者层（同一共享通道上别的订阅者不受影响）」在我方没有对应物——SSE 消费端与网关转发面都没有「该会话此刻不可见 ⇒ 降为摘要档」这一层，而侧栏多会话/后台任务同时挂着时正是这一型的成本所在。 - **为什么只给观察**：要先定「可见性」的判据来源（页面可见？侧栏展开？哪一档会话）与摘要档的语义，属产品决策，且落点跨 web/api-client/ai-service 三层。 - **验收草案**：两条配对断言（照 `:4752-4753` 的作用域规矩做）：① 同一会话以"不可见"档订阅 ⇒ 1 秒窗口内到达的 token/progress 帧只投出摘要，断言条数上界 `ceil(窗口/flushDelayMs)`；② 同一会话上第二个"可见"订阅者仍收全量（证明档位做在订阅者层而不是事件源层）；③ 切回可见 ⇒ 首帧新事件延迟不超过声明的预算。任一条只做在事件源层，② 必须红。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「票 6【观察】按消费者可见性分级的后台事件投递档位（出处 b…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L9274(L1 外部持有行 L9273):

```
- [ ] **未闭环(阻塞主体在生产侧,非本任务代码)**:`deploy/win/ihui-deploy.ps1` 健康门禁连续两轮(11:02、11:16 均成功切到新构建 `2eeda2qr7rdjz.css`)在 8×12s 窗口内未全过 → **自动回滚**,web 现滞留旧构建,桌面端因此看不到新 UI。三项判据中 `web 200` 与 `/api/health` 实测均通过,唯一可疑项是 `Test-LlmGateway`(需 `IHUI_ADMIN_PASSWORD` 登录再探 `/api/llm/providers/health` 取 2xx)。解阻判据:生产机 `Get-Content deploy\win\deploy-loop.log -Tail 40` 的「健康门禁 第 N/8 轮: web= api= llm=」行,确认红项后再决定是修判据还是修通道凭据;失败后另有 30 分钟冷却。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「未闭环(阻塞主体在生产侧,非本任务代码):`deploy/w…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L9294(L1 外部持有行 L5698):

```
- [ ] P1 新线索(实测,未追):**Ctrl+Q 在真机上按下去毫无反应**。已排除按键未送达(`press_key` 报 `foregroundStatus: matched`、`inputEventCount: 4`、VK=81),已排除 quit 链在跑但卡住(按后 45 秒内日志**零新增行**、且本次新增的那条兜底 ERROR 也没打 ⇒ `quit_app` 从未被调到),截图证实界面既无遮罩也无变化、应用照常运行。而 `apps/web/src/hooks/use-native-shortcuts.ts` 源码里确有 `ctrl && !shift && !alt && key === 'q'` 分支。**最可能的分歧点**:桌面端加载的是 `https://aizhs.top/agents` **线上生产构建**,本机工作树里的快捷键/守卫改动对它零覆盖 —— 即"源码有绑定"不等于"线上那一版有绑定"。这一格与本会话开头用户说的"所有入口都试过退不掉"直接相关,须由持托盘/快捷键那条线的人定案:先量线上那一版实际打包出的 JS 里有没有该绑定,再决定是补部署还是修绑定。**不得**把"我改了源码里的 guard"读成"用户现在能退出了"。〔进展 2026-10-02 枚 4bf20c724:**本行不翻勾** —— 票面要的真机取证仍未做(本机无可装机设备)。今天修掉的是它旁边那一格:守门 69 对"键匹配收进共享出口 `keyboard-shortcut-match` 那一份实现"这一形失明,于是 `<kbd>Ctrl+Q</kbd>` 被门判成"源码里不存在该处理器",而处理器确在 `apps/web/src/hooks/use-native-shortcuts.ts:70` —— 红留着的结局是逼人删掉一句真实的键位声明,不是逼人修好绑定。现正则认 `matchesShortcutKeyCode(e, 'q')` 一形(首参须是裸标识符;夹具里以字面量事件对象当首参的调用一律不认,认了就是给无关键位发合格证),`--self-test` 22/22、全量面 声明未绑 0;变异对照:把③档两个出口名换成不存在的名字 ⇒ 19/22 且红的恰是三条③档正例,逐字还原后回 22/22。**这一格清偿的是"门的假阳",不是"Ctrl+Q 在真机上有没有反应"本身。**〕 〔进展@2026-10-15/全清-main:源码侧已现验闭环 —— apps/web/src/hooks/use-native-shortcuts.ts 的 quit 分支(ctrl+!shift+!alt+q)已排在 isEditableTarget 守卫之前,测试 12/12 绿(含"输入框聚焦时 Ctrl+Q 仍派发"正例与"单按 Q 不误触"反例)+ web tsc 0 错;剩真机按键与"线上构建那一版是否含该绑定"两格归持线人。票面自写保持未勾,故不改勾选〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「新线索(实测,未追):Ctrl+Q 在真机上按下去毫无反应。…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L9339(L1 外部持有行 L5698):

```
- [ ] P1 新线索(实测,未追):**Ctrl+Q 在真机上按下去毫无反应**。已排除按键未送达(`press_key` 报 `foregroundStatus: matched`、`inputEventCount: 4`、VK=81),已排除 quit 链在跑但卡住(按后 45 秒内日志**零新增行**、且本次新增的那条兜底 ERROR 也没打 ⇒ `quit_app` 从未被调到),截图证实界面既无遮罩也无变化、应用照常运行。而 `apps/web/src/hooks/use-native-shortcuts.ts` 源码里确有 `ctrl && !shift && !alt && key === 'q'` 分支。**最可能的分歧点**:桌面端加载的是 `https://aizhs.top/agents` **线上生产构建**,本机工作树里的快捷键/守卫改动对它零覆盖 —— 即"源码有绑定"不等于"线上那一版有绑定"。这一格与本会话开头用户说的"所有入口都试过退不掉"直接相关,须由持托盘/快捷键那条线的人定案:先量线上那一版实际打包出的 JS 里有没有该绑定,再决定是补部署还是修绑定。**不得**把"我改了源码里的 guard"读成"用户现在能退出了"。〔进度注记(未结清,按票面自写验收口径**保持未勾**)2026-10-01(goal主线,枚 `5ac50478d0`):断点在**派发面第一步**,不在按键 —— 旧 `use-native-shortcuts.ts` 的 `onKey` 首句 `if (isEditableTarget(e.target)) return` 排在所有键分支之前,而桌面端主界面常年是聊天输入框持焦(`message-input.tsx` 多处主动 focus)⇒ Ctrl+Q 永不可达,"按键确实送达"与"什么都不发生"因此同时成立;这条无视焦点的语义是 2026-07-25 用 web keydown 顶替 Tauri 原生 accelerator 时丢的(该文件头注自述"等价快捷键")。现把 quit 分支提到早退**之前**,key 匹配复用唯一实现 `lib/keyboard-shortcut-match.ts`(IME/布局改写 `e.key` 时按物理 `code` 兜底),其余键的焦点守卫一字未动;`GlobalShell` 的 `void dispatchMenuAction(id)` 改为 `.catch()` 后点名 action id —— 原先宿主拒绝与键没送达账面同形(该型在 `apps/desktop/README.md:51` 有记录)。生效链未动:`file.quit → quitApp() → invoke(quit_app) → exit_application()`(先 arm 3s 兜底、存窗口状态、再 exit),与托盘「退出」同一份实现 —— 这正解释了"托盘能退、Ctrl+Q 不能退"。**主会话自己复跑**:新测 12 passed RC=0、`tsc -p apps/web` **0 错误**、`check-declared-shortcuts` RC=0、水印 verify 通过;代理另交变异自证(守卫改回旧前置 ⇒ 4 条红,红的正是 textarea/contenteditable quit、preventDefault 与顺序形状锁;按 sha256 逐字节还原后 12/12)。**未闭环如实**:① 真机按键未取证(桌面端此刻未运行;不为取证起 cargo 构建、不杀别人进程、不改显示设置);② 桌面端是薄壳直连 `https://aizhs.top/agents`,**本改动须随 web 发布才到桌面**,线上是否已带 quit 派发 = 未判定(首页 HTML 的 61 个 chunk 里 app/layout 结构上不在其中,不得据此断反);③ 刻意**未**注册系统级 Ctrl+Q —— 那是全局钩子,会把所有应用的 Ctrl+Q 劫持成本应用退出,属新造故障;"失焦/收托盘也能退"归方案决策与票持有人;④ `desktop-quit-request` 在被审面无生产者,且 `use-quit-update-guard.ts`/`tauri-bridge.ts` 此刻是他人 ` M`,按 §12 只报不动。顺带点名一条**判据盲区**:`check-declared-shortcuts` 的判红循环只看 `kind==='field'` 声明(它 :362),而这条键在设置卡里以 `kbd` 采集 ⇒ 那道门的绿结构上证明不了这条键被绑过。〕 〔进展@2026-10-15/全清-main:源码侧已现验闭环 —— apps/web/src/hooks/use-native-shortcuts.ts 的 quit 分支(ctrl+!shift+!alt+q)已排在 isEditableTarget 守卫之前,测试 12/12 绿(含"输入框聚焦时 Ctrl+Q 仍派发"正例与"单按 Q 不误触"反例)+ web tsc 0 错;剩真机按键与"线上构建那一版是否含该绑定"两格归持线人。票面自写保持未勾,故不改勾选〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「新线索(实测,未追):Ctrl+Q 在真机上按下去毫无反应。…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L9340(L1 外部持有行 L5698):

```
- [ ] P1 新线索(实测,未追):**Ctrl+Q 在真机上按下去毫无反应**。已排除按键未送达(`press_key` 报 `foregroundStatus: matched`、`inputEventCount: 4`、VK=81),已排除 quit 链在跑但卡住(按后 45 秒内日志**零新增行**、且本次新增的那条兜底 ERROR 也没打 ⇒ `quit_app` 从未被调到),截图证实界面既无遮罩也无变化、应用照常运行。而 `apps/web/src/hooks/use-native-shortcuts.ts` 源码里确有 `ctrl && !shift && !alt && key === 'q'` 分支。**最可能的分歧点**:桌面端加载的是 `https://aizhs.top/agents` **线上生产构建**,本机工作树里的快捷键/守卫改动对它零覆盖 —— 即"源码有绑定"不等于"线上那一版有绑定"。这一格与本会话开头用户说的"所有入口都试过退不掉"直接相关,须由持托盘/快捷键那条线的人定案:先量线上那一版实际打包出的 JS 里有没有该绑定,再决定是补部署还是修绑定。**不得**把"我改了源码里的 guard"读成"用户现在能退出了"。 〔进展@2026-10-15/全清-main:源码侧已现验闭环 —— apps/web/src/hooks/use-native-shortcuts.ts 的 quit 分支(ctrl+!shift+!alt+q)已排在 isEditableTarget 守卫之前,测试 12/12 绿(含"输入框聚焦时 Ctrl+Q 仍派发"正例与"单按 Q 不误触"反例)+ web tsc 0 错;剩真机按键与"线上构建那一版是否含该绑定"两格归持线人。票面自写保持未勾,故不改勾选〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「新线索(实测,未追):Ctrl+Q 在真机上按下去毫无反应。…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L9837(L1 外部持有行 L7754):

```
- [ ] **守门 134 的第二格仍开着（① 已按票面处置完毕,结论是"不补判据、固化测量",枚 `fd46aa9da`）**：① B2 那一跳接裸 SQL 维 —— 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「守门 134 的第二格仍开着（① 已按票面处置完毕,结论是"…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10166(L1 外部持有行 L5401):

```
- [ ] **守门 128 换腿后新暴露的跨端几何差(三对)**(2026-09-26 立,来源即同日那次"首选层死副本 ⇒ 退回下一层"的判据修复):当次现读 `--pair-all` —— `UserInfoCard` 仅小程序 24/40 ｜ 仅 RN 2/4/6/10/11/14/32/56、`NavBar` 仅小程序 13/16/20 ｜ 仅 RN 4/12、`Carousel` 仅小程序 14/20(RN 侧本方向无差档)。**这些数字是当次现读,派单前必须重跑** `node scripts/check-cross-end-ui-parity.mjs --pair-all`(台账与组件文件都在并发推进,照抄会去修一批已不存在的东西)。**唯一正确修法** = 抽 `packages/shared/src/ui/<x>-spec` 常量,两端各注入 primitive adapter 取同一份源(AGENTS §"跨端 UI 单一源" 明写禁止两端各写一份再靠对账追平);**禁止**给单端补数字凑平 —— 那只是把第二份真相挪了个位置。**解阻条件(写主语)**:① 能上真机/持有设计稿的一方先定"哪一端是设计意图" —— 本机无 iOS/Android 模拟器与微信开发者工具,agent 不得用一次不可复核的猜测换账面绿;② 台账里 `Carousel:2 / NavBar:5 / UserInfoCard:8` 是**首次纳入比对**的存量锚点(见 baseline 的 `coverageWidened` 键),清偿后必须逐条下调,不得留着正值当"已收口"。 〔拍板@2026-10-09 机主授权代行:设计意图基准=抽 packages/shared spec,初版以两端现值交集为准、差档逐条带「待真机裁决」标,禁止单端补数;立项派单,真机到位后终裁〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「守门 128 换腿后新暴露的跨端几何差(三对)(2026-0…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10272(L1 外部持有行 L4464):

```
- [ ] **A36 剩下的两步（有前置，不得跳）**：② 拿影子数据把描述修对 —— 依赖至少一次真实运行统计 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「A36 剩下的两步（有前置，不得跳）：② 拿影子数据把描述修…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10277(L1 外部持有行 L4954):

```
- [ ] **机器可见的欠账清单(三路并行审计的产出;每条都带 file:line 与"为什么现在没人看守")**: 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「机器可见的欠账清单(三路并行审计的产出;每条都带 file:…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10279(L1 外部持有行 L4988):

```
- [ ] ⚠️ **一条还挂在别人工作树里的修复(如实登记,不是已完成)**:C1 从 93.90% 涨到 **96.36%**、 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「⚠️ 一条还挂在别人工作树里的修复(如实登记,不是已完成):…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10284(L1 外部持有行 L5667):

```
- [ ] **下一轮的候选（本轮已取证、未落地，按价值排）**：① 上游 skills 的**两级渐进披露**（提示只放目录、正文由 Skill 工具按名拉，超预算降级为"仅名字+路径"）与**技能作为工具前置门**（工具入参阶段查"本会话是否已成功加载该技能"，否则回稳定码 428；compaction 抹掉正文后重新要求）—— 我方 `apps/cli/src/skills/index.ts:358` 只收 `isFile() && .md`、目录整体跳过，且 `prerequisites` 解析后**零消费者**；② `model-option-map` 的**族规则 + 例外层叠继承**（上游 `.*glm-5` 族默认被 `.*glm-5\.1` 按字段覆盖）—— 我方 `model_catalog.py` 三组正则只产出 4 个布尔、`provider_caps.py` 一 provider 一条无模型级继承，`default_models.json` 118 个模型各抄一份 caps；③ 桌面 **ANR/挂死看门狗 + 崩溃分类学**（5s ANR/30s 挂死、crashKind 封闭集、按 webContents 去重）—— 我方 `watchdog/unresponsive/longtask` 全仓零命中，管理端崩溃率恒为 0 的那一格就是它；④ 长会话**行高缓存跨卸载存活 + 滚动权裁决**（我方 `use-message-list-scroll.ts` 已有滞后带，差"卸载即删测高 / 贴底读只由 scroll 事件更新的 ref / prepend 用 rAF 轮询 5s 超时"四维）；⑤ 内部服务令牌改**一次性短期票**（现 `internal-service-token.ts:49` 明文 `!==` 比常驻 `AI_CALLBACK_SECRET`，无 TTL 无轮转可无限重放）—— 属凭据面，与 O13/O17 有共同归属，动它要先与持有人对齐双侧改造顺序。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「下一轮的候选（本轮已取证、未落地，按价值排）：① 上游 sk…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10438(L2 族内归并,保留 L7667):

```
- [ ] 待用户补:apps/*/.env ~35 键(WECHAT_APP_ID/SECRET、SMTP/RESEND/腾讯 SES、DINGTALK、GitHub Token 等),骨架已就位;丢失键全清单已梳理到 `tmp/env keys todo.md`(79 空键 / api 36 + web 15 + ai-service 28,按 ★优先级 + 配置渠道 + 目标文件组织) 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「待用户补:apps/*/.env ~35 键(WECHAT_…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10489(L1 外部持有行 L14868):

```
- [ ] G-998080 票5：模型面 schema 与运行时 schema 分两份投影（观察）（出处 b76-01）：- 机制：内部回填事实、跨字段组合约束不进 provider 可见 JSON Schema；组合不变量由运行时 `refine` 强制，模型侧靠 describe 引导；投影侧还允许手工把有默认值的字段补回 `required` 以逼模型显式传值（apps/zcode-cli/packages/contracts/src/tools/automation.ts:226-232；create-workflow.ts:153-171；amend-workflow.ts:138-155；apps/zcode-cli/packages/contracts/src/tools/task-output.ts:35-40；ask-user-question.ts:188-209）。 我方建议落点域：候选是 `apps/ai-service` 的工具/技能声明面与 `packages/types/src/capability-catalog.ts`、`packages/types/src/agent-runtime.ts`（`git cat-file -e` 已证 `packages/types/src/agent-runtime.ts`、`packages/types/src/capability-catalog.ts` 在 `git ls-tree -r --name-only HEAD packages/types` 输出中）。我方现状：`git -C G:/IHUI-AI grep -n -e 'superRefine' HEAD -- apps packages` 命中 1 行——跨字段约束基本不在契约层写；`git -C G:/IHUI-AI grep -n -e 'toToolJsonSchema' HEAD -- apps packages` 命中 0 行——不存在"由一份 zod 投影出模型面 JSON Schema"的实现点。落点未定（要先确认我方 AI 工具声明由哪一层产出、以及是否有跨 provider 的 key 守卫），故列观察。 验收草案：一旦落点定了，判据可直接跑：对同一个工具取 `modelFacingSchema` 与 `runtimeSchema`，断言前者的 `properties` 键集是后者的子集、且不含任何"由服务端回填"的字段名（回填字段清单以常量数组导出，测试逐项 `not in`）。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「票5：模型面 schema 与运行时 schema 分两份投…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10490(L1 外部持有行 L14869):

```
- [ ] G-998081 票7：配置键封闭枚举 + 作用域优先级数字表 + 来源审计（观察）（出处 b76-01）：- 机制：点号字符串键的 const 枚举 + `ConfigValue<K>` 条件类型把键值形状绑在契约层；作用域优先级是显式数字表；port 提供 `getSources(key)` 供"这个值来自哪一层"的审计，默认值整表与契约同处一文件；安全相关配置能追来源（apps/zcode-cli/packages/contracts/src/config/index.ts:12-82、88-151、157-175、290-359、391-410）。 我方建议落点域：`config/**` 与 `packages/types/src/cli-config.ts`、`packages/types/src/desktop-prefs.ts`（两份文件名均出现在 `git -C G:/IHUI-AI ls-tree -r --name-only HEAD packages/types` 输出中）。我方现状：`git -C G:/IHUI-AI grep -n -F 'getSources' HEAD -- apps packages` 命中 5 行，但逐条看是另一件事——`apps/api/src/services/context-engine-service.ts:529`、`apps/api/src/routes/context-mentions.ts:231`（委托 ai-service `/api/context/sources`）与它们的注释（`context-engine-service.ts:22、78`、`context-mentions.ts:224`），即"上下文来源清单"的取数接口，**不是**"这个配置值来自哪一层（file/env/cli）"的来源审计位；`git -C G:/IHUI-AI grep -n -F 'ConfigScopePriority' HEAD -- apps packages` 命中 0 行，没有显式的层间优先级表。是否要做成端口取决于我方配置是否真需要分层覆盖，属产品决定，列观察。 验收草案：对任一配置读取加一条断言：`getEffective(key)` 返回 `{value, scope, path?}` 三元组，且同 key 在 project 与 env 同时存在时 `scope === 'env'`（优先级表驱动，禁止数组顺序隐式判定）。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「票7：配置键封闭枚举 + 作用域优先级数字表 + 来源审计（…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10491(L1 外部持有行 L14870):

```
- [ ] G-998082 票8：发现类接口的"部分失败"信封（观察）（出处 b76-01）：- 机制：发现/加载接口同时返回成功条目、`diagnostics`（封闭 code + severity）与 `totalDiscovered`；坏条目降级为被点名的 invalid 行而不是让整批失败；"空数组会让每次调用都挂一个噪音字段"，因此无异常时该字段缺席（apps/zcode-cli/packages/contracts/src/commands/index.ts:14-23、49-62；apps/zcode-cli/packages/contracts/src/tools/saved-workflow.ts:127-138；apps/zcode-cli/packages/contracts/src/tools/list-saved-workflows.ts:25-31；apps/zcode-cli/packages/contracts/src/interfaces/context-source.port.ts:72-85）。 我方建议落点域：批量导入/批量校验类接口（学费账目批量导入、成员批量导入等），候选文件 `packages/types/src/education.ts`、`packages/types/src/api-contracts.ts`（两份均在 `git -C G:/IHUI-AI ls-tree -r --name-only HEAD packages/types` 输出中）。我方现状：`git -C G:/IHUI-AI grep -n -F 'diagnostics' HEAD -- apps packages` 命中 186 行——**我方已经对的那一半在 CLI 插件装载面**：`apps/cli/src/plugins/types.ts:188` 有 `diagnostics: PluginDiagnostic[]`，`apps/cli/src/plugins/loader.ts:47-73` 用 `Record<PluginDiagnosticCode, PluginDiagnosticSeverity>` 要求键穷尽联合（注释原文"新增码忘了定档，编译期就红"、"severity 由码唯一决定，产出点不得自行挑档"），`apps/cli/src/plugins/index.ts:18` 定下"每份被跳过的清单恰好一条 diagnostic"。缺的那一格在业务批量接口上：`git -C G:/IHUI-AI grep -n -F 'totalDiscovered' HEAD -- apps packages` 命中 0 行，发现总数没有位（我方另有 `skippedCount`，见 `apps/api/src/routes/cli-import.ts:448`、`apps/api/src/jobs/ai-world-sync.ts:1156-1178`，但它是"去重跳过计数"不是"发现总数"）；也没有"无异常时该字段缺席而不是发空数组"的约束。落点需挑一条具体批量接口先做，故列观察。 验收草案：给一条批量接口跑混合样本（10 条里 3 条格式错），断言返回 `accepted.length === 7`、`invalid.length === 3` 且每条带行号或唯一键、`totalDiscovered === 10`；全对时断言 `!('invalid' in response)`。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「票8：发现类接口的"部分失败"信封（观察）（出处 b76-0…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10496(L1 外部持有行 L14873):

```
- [ ] G-998090 票4：离线取证派生器的"结构不完整即失败"判据（观察）（出处 b76-03）：- 机制：派生器对输入结构零容忍且必须可定位：JSONL 坏行报 `Invalid JSONL at <basename>:<行号>`、message 引用缺失的 requestIndex 抛错、messageIndex 出现空洞抛错（apps/zcode-cli/tools/prompt-trajectory/src/derive.ts:141-153,173-195）；没有任何记录匹配时抛错并回显筛选键，绝不产出空工件还退 0（model-io.ts:53-60）；分段只承认 append-only，且唯一例外要求其余字段全等、旧 block 原样保留（derive.ts:101-116；message-continuity.ts:4-27）。 我方建议落点域：`scripts/`（HEAD 实测 953 个文件，我方守门/证据脚本目录）与 `apps/ai-service/app/core/message_history.py` 的原始记录读取。我方现状：`corrupt`=>120，抽查前 4 处含 `apps/ai-service/app/core/message_history.py:163,176`（`iter_history(path, *, skip_corrupt: bool = True)`）与 `apps/ai-service/app/services/importers/claude_code.py:41,43`（`records, corrupt = iter_json_records(...)` 后有 `if corrupt:` 分支）。为什么这不算已有等价：已有对的那半是**坏记录被计数、不静默丢**（claude_code.py 那处返回 corrupt 计数）；缺的那半是**"坏在哪一行/哪一条"的可定位输出 + 零命中即失败**：`skip_corrupt=True` 的默认值是"跳过"，而上游的默认是"抛错并点名 `文件:行号`"；对派生类脚本也没有"匹配为空 ⇒ 非零退出"的出口（本路未在我方仓库跑"零命中"关键词的实测命令，故此处只按抽查到的两处判断，判据缺口以行数/退出码形式补齐）。落点未定（守门层还是 ai-service 层），列观察。 验收草案：对目标派生脚本喂 ①含一行坏 JSON 的文件、②全部记录都不匹配筛选键的文件，断言两次都是非零退出，且 stderr 分别含 `<文件名>:<行号>` 与筛选键字面量；反例断言：喂空匹配不得产出输出目录。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「票4：离线取证派生器的"结构不完整即失败"判据（观察）（出处…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10497(L1 外部持有行 L14874):

```
- [ ] G-998093 票 4（观察）run 终态三分 + "逻辑词汇 ↔ 物理列只活在仓储编解码"的零迁移手法（出处 b76-04）：机制：`…/src/engine/types.ts:449-466`（三终态 + 各自可否 resume + 5 值 `RunStopReason`）；`:455-457`（**物理列不迁移、映射只活在 codecs**）；`…/src/engine/engine-state.ts:31-34`（判别联合：状态与携带物按臂绑定）；`…/src/engine/engine-settlement.ts:14-33`（`completed` 也中止在飞 ask，三重后果成文）；`:74-91`（三条路径共用 `finishRun`、`run-settled` 载荷刻意窄、dispose 恰一次）；`…/src/engine/types.ts:859-872`（`RunSettlementRecord` 存在的理由就是一笔写，缺省键="不触碰该列"）；`:778-786`（准入即 `running` 的两次写 + `report` 的例外 + 崩溃于执行中的节点 resume 按 actorSeq 重新 live 派发）。 我方现状对照（本轮取证，只作差距形状用，不写"我们已有"）：`dag_scheduler.py:61` 的 run 级状态是 `success | partial | failed`——**没有"被停下"这一族**：用户取消、看门狗、超时在落库上与"真失败"共用 `failed`。`for w in errored stopped superseded; do git grep -c -w "$w" HEAD -- apps/ai-service/app/services/dag_scheduler.py apps/ai-service/app/services/workflow_engine.py apps/cli/src/subagents; done` → 三者各 **0**；`cancelled` **10** 处、`timeout` 见 `:47` 注释。也就是说我方已把"取消"分出来了，但停在**节点**层，没有抬到 run 层，更没有 `reason` 轴去区分"重跑很可能就好"（上游 `interrupted`）与"不可 resume 只能改定义"（上游 `errored`）。 半边已正确的落点：`apps/ai-service/app/services/dag_scheduler.py:499` 有 `status: str # idle | busy | dead`（worker 活性）与 `:523-524` 的事件类型族（`task_created|task_status_changed|task_completed|task_failed` + 注释列出的 D44 五类），说明"run 有生命周期事件流"这半边在结构上是存在的，缺的是终态分层与 resume 归属。 **成本必须写在票头上**：run 终态词若是对外契约，动它=三面（DB 列 `packages/database/src/schema/agent-tasks.ts:31 varchar("status", length=20)` + REST enum `agents-kanban.ts:128,151` + SSE `:386,453,473,524`，行号抄自 `dag_scheduler.py:362-366`）+ 五语词表 + 门 151 全套对账。上游之所以能不动库，是因为它把映射关进 codecs（`types.ts:455-457`）。**这条手法本身才是这张票真正的可吸收物**，改词表不是；若不做 codecs 而直接改列值，票应当被否掉。 验证草拟：先只加**非契约**位（run 终态细分落在 trace/log 面，不落 `status` 列），并加判据"逻辑终态 ≡ (物理列值, reason) 的函数"的 round-trip 单测（写 5 种历史行值 + 3 种新终态 ⇒ 解码后断言映射表逐条成立、未知值不塌成 `failed`）。抬进契约面前不得合入。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「票 4（观察）run 终态三分 + "逻辑词汇 ↔ 物理列只…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10561(L1 外部持有行 L14896):

```
- [ ] G-998156 票4：新收紧的判据只挂在"坏过的样本"上，界下一条路径都不动（观察）（出处 b76-12d）：机制：`packages/shared/src/zcode-protocol-v4/workflow-runs-eviction.ts:109-111` `admitsNewEntry = run.truncated !== true || live`，`:96-107` 用整个注释块论证**为什么不推广到所有 run**："归约照常施加水位之下的事件……真要是在线事件先给一条 run 开了头，它整段 journal 前缀就全在水位之下——**无差别收紧会让那条 run 的卡片空着**。这两处窟窿都以『此前发生过拒绝或淘汰』为前提，也就是 `truncated`，所以按它收口**不动界下的任何一条路径**"；配套 `workflow-runs-reducer.ts:146-149` `advancesWaterMark = sequence > base.lastEventSequence`（"被拒实例的计数器是**加出来**的，没有可去重的身份，所以只认抬过水位的事件"）。这条形状的价值：一条新规则不会把健康路径拖进回归。 我方建议落点域：带重放/重试的累计型读数（候选 `apps/api/src/services/subagent-dispatch-service.ts:2152,2214,2446` 这类 `steps.reduce(...)` token/步数汇总）。 我方现状：`git -C G:/IHUI-AI grep -niE "idempoten" HEAD -- apps packages` => **607** 命中——我方已有幂等基建（递交去重那一半），缺的是"**加出来的**计数在重放时被重复抬升"这一型有没有对应判据；抽查未定位到与 `truncated` 同形的"只在坏过的样本上收紧"写法，**落点还需产品/实现侧拍板**。 验收草案：对 `subagent-dispatch-service.ts` 的 step 汇总写一条重放断言：同一 `step` 事件（同 sequence）连续喂归约器两次，`totalTokens` 与步数类**累加型**读数第二次必须不变（若红，就把收紧条件挂在"该 run 曾发生溢出/重放"那一位上，照 `admitsNewEntry` 的形状写，而不是无条件收紧）。 〔拍板@2026-10-07 机主:要判据——照admitsNewEntry形状,仅"该run曾溢出/重放"时收紧累加型读数〕 〔拍板@2026-10-07 机主:要判据——照admitsNewEntry形状,仅"该run曾溢出/重放"时收紧累加型读数〕 〔普查@2026-10-07:三站点中仅 _updateStats(:2159) 是累加账本(this._stats.totalTokens += steps.reduce(...),8调用点1773/1812/1833/1860/2021/2101/2117/2136),同run二次进账即重复计 token ⇒ 有病;:2214 仅读账本、:2230/:2446 纯读聚合(每次从 runtime.steps 重算,重放幂等)⇒ 无病。该文件工作树已被他席在飞修复(+22/-2,照 admitsNewEntry 形状落地 statsConsumedSteps 水位字段:界下首次进账与旧逻辑逐位等值,曾进账后只累计越过水位的 slice,注释引用 G-998156 与上游出处)⇒ 本普查会话按纪律零改动不翻勾,实现与翻勾归该持有人。残留缺口转该持有人:①票面要求 apps/api/tests/g-998156-*.test.ts 正反成对用例尚不存在;②totalDurationMs += durationMs 仍无条件累加,同run二次进账 duration 维度仍重复计。验证(只读):pnpm --filter @ihui/api typecheck rc=0;既有 tests/subagent-dispatch-service.test.ts 19/19 绿。〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「票4：新收紧的判据只挂在"坏过的样本"上，界下一条路径都不动…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10589(L1 外部持有行 L14900):

```
- [ ]G-1104172（等条件·两格缺模型输入/发送回传接线,一格缺浏览器会话)队列拒因残余三件(承 G-937950,2026-10-10 收口其①②③后如实移交,非遗漏):a) 拒因现只有 3 个能判(streaming/emptyQueue/runtimeNoInterject),`queueChanged`/`controlCommand`/`awaitingApproval` 需先给 `QueueInteractionPerms` 喂进这些条件(现模型无此输入,硬加=编造);b) `deferred`(未发送)与 `failed`(失败)两个终态全仓零命中,要接的是发送结果回传路径;c) 键盘路径实测(上下方向键重排)需浏览器会话,本机无 ⇒ 只能静态加 aria/按键处理,不得写成已实测。判定面与既有出口沿用 input-notices.deniedCauseNotice 唯一本体,新增因时 switch 穷尽即编译期红。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「（等条件·两格缺模型输入/发送回传接线,一格缺浏览器会话)队…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10611(L1 外部持有行 L5401):

```
- [ ] **守门 128 换腿后新暴露的跨端几何差(三对)**(2026-09-26 立,来源即同日那次"首选层死副本 ⇒ 退回下一层"的判据修复):当次现读 `--pair-all` —— `UserInfoCard` 仅小程序 24/40 ｜ 仅 RN 2/4/6/10/11/14/32/56、`NavBar` 仅小程序 13/16/20 ｜ 仅 RN 4/12、`Carousel` 仅小程序 14/20(RN 侧本方向无差档)。**这些数字是当次现读,派单前必须重跑** `node scripts/check-cross-end-ui-parity.mjs --pair-all`(台账与组件文件都在并发推进,照抄会去修一批已不存在的东西)。**唯一正确修法** = 抽 `packages/shared/src/ui/<x>-spec` 常量,两端各注入 primitive adapter 取同一份源(AGENTS §"跨端 UI 单一源" 明写禁止两端各写一份再靠对账追平);**禁止**给单端补数字凑平 —— 那只是把第二份真相挪了个位置。**解阻条件(写主语)**:① 能上真机/持有设计稿的一方先定"哪一端是设计意图" —— 本机无 iOS/Android 模拟器与微信开发者工具,agent 不得用一次不可复核的猜测换账面绿;② 台账里 `Carousel:2 / NavBar:5 / UserInfoCard:8` 是**首次纳入比对**的存量锚点(见 baseline 的 `coverageWidened` 键),清偿后必须逐条下调,不得留着正值当"已收口"。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「守门 128 换腿后新暴露的跨端几何差(三对)(2026-0…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10931(L1 外部持有行 L14915):

```
- [ ] G-1080902 **5.2 MB 活文档的在飞副本会让部署环 ff 反复停摆,而两层复原判据对这一尺寸同时"刻意不判"** —— 2026-10-11 实测:一份滞后的 `PROJECT_PLAN.md` 工作树副本把 `git merge --ff-only` 连挡 146 分钟、28 枚提交没上线(期间正式告警按 4h 身份去重只寄了 2 封)。两层自愈各自报的是:**幻影漂移对齐层** `⚠️ ②′ 行子集判据未判定(超尺寸护栏 2097152 B ⇒ 本层刻意不判,档位 oversized)`;**LIVE-DOC 复原层** `判不可复原:副本含 HEAD∪归档∪远端都无出处、且长度闸内也认不出「被取代」的行`。两个安全阀各自都对,叠在同一个文件上的后果是**这一族的副本永远无法被证明可复原**,线上更新只能等持有会话收尾。当日三面归一化对账(可重跑:`.ihui-agent/tmp/g1080898/pp-provenance.mjs`,封缄件 `ev-pp-prov3.md`)量到:工作树独有 288 行,其中 **287 行能在近 80 枚历史 blob 里逐行找回**(纯 prettier 重排造成的异形),真只在盘上 1 行 —— 而那 1 行的归属是另一会话的认领租约,本票已把它逐字落进入库面(commit `ce27c0e45f`,不改一个字)。**要做的**:给这两层一份**按行流式 + 逐行锚点**的判据(不整文件比子集、不因文件超 2 MB 就整块不判),并把"重排导致的异形"登记成一类显式出处(`reformat-superseded`)。**判据变化的反向臂是硬要求**:必须同时证明"真独有行仍然拒绝覆盖"(否则这次改动等于给销毁在飞现场开一个洞,而它看起来像修好了停摆)。**等什么**:等一个没有会话在写该副本的窗口做端到端取证(实测副本 16:43:56 仍在被他席写 ⇒ 按 §12 只报不动)。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「2 MB 活文档的在飞副本会让部署环 ff 反复停摆,而两层…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L10932(L1 外部持有行 L14916):

```
- [ ] G-1080899 **14.35 GiB 松散对象(66398 个,其中 13426 个已重复入包)待收进 cruft pack —— 归属四态:等环境条件(需低活动窗口),不是本席漏做**:本轮把 `node scripts/safe-gc.mjs` 的缺省档改成不销毁之后,整理空间这件事**已经可以安全地做**,但没有在此窗做,理由是量出来的而非感觉:① D 盘现余 374.2 GiB ⇒ 松散对象是浪费不是告急;② 19GB 仓的 repack 需数分钟持有 git 写锁,而并发会话的 safe-commit 等锁上限是 15min,在 222 枚/日的提交节奏下这是此刻唯一真正会打到人的代价。复裁判据(满足即可动):`git count-objects -v -H` 的 `size`(松散)仍 >4 GiB,且当刻 `.git/ihui-git-write.lock` 无人持有、`git status` 无他人 staged 热文件 ⇒ 跑缺省档 `node scripts/safe-gc.mjs` 并于前后各量一次 count-objects。**禁止**为"顺手清掉那 9785 枚"而使用 `--prune-now`:本行上方那 9677 枚内容别无分店,销毁没有回收站。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「35 GiB 松散对象(66398 个,其中 13426 个…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L14763(L1 外部持有行 L5401):

```
- [ ] **守门 128 换腿后新暴露的跨端几何差(三对)**(2026-09-26 立,来源即同日那次"首选层死副本 ⇒ 退回下一层"的判据修复):当次现读 `--pair-all` —— `UserInfoCard` 仅小程序 24/40 ｜ 仅 RN 2/4/6/10/11/14/32/56、`NavBar` 仅小程序 13/16/20 ｜ 仅 RN 4/12、`Carousel` 仅小程序 14/20(RN 侧本方向无差档)。**这些数字是当次现读,派单前必须重跑** `node scripts/check-cross-end-ui-parity.mjs --pair-all`(台账与组件文件都在并发推进,照抄会去修一批已不存在的东西)。**唯一正确修法** = 抽 `packages/shared/src/ui/<x>-spec` 常量,两端各注入 primitive adapter 取同一份源(AGENTS §"跨端 UI 单一源" 明写禁止两端各写一份再靠对账追平);**禁止**给单端补数字凑平 —— 那只是把第二份真相挪了个位置。**解阻条件(写主语)**:① 能上真机/持有设计稿的一方先定"哪一端是设计意图" —— 本机无 iOS/Android 模拟器与微信开发者工具,agent 不得用一次不可复核的猜测换账面绿;② 台账里 `Carousel:2 / NavBar:5 / UserInfoCard:8` 是**首次纳入比对**的存量锚点(见 baseline 的 `coverageWidened` 键),清偿后必须逐条下调,不得留着正值当"已收口"。 〔现读@2026-10-09(不翻勾,只把解阻条件更新到今天的面上):`node scripts/check-cross-end-ui-parity.mjs --pair-all` 现读三对仍在 —— `Carousel` 仅小程序档 2/4/8/14/16/20、`NavBar` 仅小程序 13 ｜ 仅 RN 2/4/12/32/44/56、`UserInfoCard` 仅 RN 6/18/24/32(圆角维仅 RN 12,端上实取 2/4/6/8/12/16)。解阻条件①("能上真机/持有设计稿的一方先定哪端是设计意图")今天仍未满足,且设备侧那一半现在有了归属:已收进 G-191「移动端真机走查包」(等机主职权,不是等新环境);设计意图那一半属产品/设计裁决,任何 agent 不得代答。解阻条件②(存量锚点必须逐条下调)也仍未成立:三对都在账上,没有一条可以被下调。本行保持开放。〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「守门 128 换腿后新暴露的跨端几何差(三对)(2026-0…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L14907(L1 外部持有行 L10921):

```
- [ ] **App 一级屏顶部灰色带:六屏已收口,十七屏待拍板,首页像素等登录窗(2026-10-10 用户实拍「顶部这个区域为什么是灰色的,怎么还有个灰色带呢?应该不设置背景色 直接透出底色白色啊」)**. 根因是两截色叠出来的:① `apps/mobile-rn/App.tsx` 那枚根 View 绘制状态栏 inset 带 + 全局断网横幅行,默认档 `tokens.surface.bg`(亮 #F5F5F5);② `src/components/NavBar.tsx` 依 2026-09-26 用户裁决**不自绘底色、不画底边线**(`tests/navbar-no-chrome.test.tsx` 钉着),所以顶栏行透出所在屏 shell —— 首页 shell 也正是 `surface.bg` ⇒ 从屏幕顶边到导航行整片灰,而小程序端 `apps/miniapp-taro/src/theme.json` 的原生导航栏 light `navBgColor=#ffffff` 是白的 ⇒ **RN 这一层从未与小程序 chrome 对齐**,不是"多设了一个背景色"。修法(不动 09-26 那条裁决、不新增色档、不在端内自拼色值):六个一级屏(首页 / 广场 / 动态 / 我的 / 智能体 / 设置)在屏内把顶栏区包一层取 `tokens.surface.card`,同批在 `ROUTE_ROOT_BG` 为这些**注册路由名**逐条给同一档(`Home` / `HomeMain` / `Plaza` / `News` / `ProfileMain` / `AiMain` / `Agent` / `Settings`),让"带色"跟着"行色"而不是跟着 shell —— 漏一条就会在同一屏里造出新的两截色,所以路由名清单是现读 `RootNavigator` 的 `name=` 注册项得来的,不是手拼。取证:枚 `043a81f1960ab3e543a6e5adc6f5388871f60c74`(9 文件,含 `tests/app-root-background-focused-route.test.tsx` 逐路由实算根底色、`tests/video-immersive-band.test.tsx` 把 Settings 基线随实测改钉 `surface.card`);端内 `vitest run` 91 个测试文件全绿、`tsc -p apps/mobile-rn` 0 错误;本枚提交时 lint-staged 撞 git EBUSY(归因量得 not-ours)⇒ 按 §12 在 **HEAD 面**自己复跑守门 83 / 77 / 97 / 102 / 145,五道全 rc=0。**真机只做到一半**:新包 vc3 已装(`adb install -r`,firstInstallTime 仍是 10-07 ⇒ 数据没被清),但设备此刻停在登录页且**密码页账号/密码皆空、自动登录未勾** ⇒ 机上没有可复用凭据,登录要机主本人的手机验证码(与 G-191 同一条职权边界,代理不代签),所以首页那一屏的像素未量到;已量到的是**同一条代码路径**在登录页的读数:顶区 y=18/40/70/110/150 与主体 y=700 逐点同为 (26,26,26),整片连续、没有第二条带。**它在等什么(三格,缺一不得翻勾)**:① 机主登录一次后补首页/广场/动态/我的/智能体五屏的顶栏像素(判据:顶区应为 (255,255,255) 而主体仍 (245,245,245),两者不同档才算"白头部 + 灰主体"落地);② 全端 25 个屏渲染 `<NavBar>`,本次只收 6 个一级屏,`CoursePlanet` / `MoreCourse` 两屏**刻意不收**(它们顶色各自是渐变定档,已在表内),其余 17 个二级屏(AiAssistantN8n / Cart / Chat / CircleIndex / ConversationImport / CourseDetail / DevEnter / Developer / LiveDetail / RankingDetail / Share / StudyIndex / StudyPublish / Subagents / TopicDetail / TopicList / WebPortal)同一型未收 —— 收法与本行完全相同,但"把全端顶栏一次翻白"属定档改动,按既往先例(CTA 黑白反转 / 圆角上限一刀切 / 聚焦描边墨档)须机主拍板后一批做,不得由本行自行扩面;③ 深色档本次取 `surface.card`(暗 #1A1A1A),而小程序深色 `navBgColor=#262626` —— 后者是 `sync-miniapp-chrome` 里 `CHROME_DECLARED_DIVERGENCE` 登记过的决策(对齐 rn `gray.800`),所以 RN 侧要深色也逐位同值,正解是给 chrome 单立一枚档进 `packages/design-tokens/src/styles/tokens.css` 再进同源对账门映射表,**不得**在端内改成 `surface.light` 凑数(守门 83 的 R2 把 `surface.light` 作容器底计入棘轮,为消红换档等于绕门)。同屏另记一格事实:横幅常驻「网络已断开,部分功能不可用」而 `adb shell ping -c 2 aizhs.top` 实测有回包(RTT 613ms)⇒ 离线判据有没有把慢网误判成断网,是另一票,不在本行射程。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「App 一级屏顶部灰色带:六屏已收口,十七屏待拍板,首页像素…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L14965(L2 族内归并,保留 L9413):

```
- [ ] **G-221 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,按 G-312「改动面小的一侧让号」本族让出原号改用本号;原号留归同号留驻族,本行正文除编号位与本记录外逐字未动。〕 (原编号 G-221;持有行题面「本批全量终审186项=173通过/5警告/8失败」) 〔改号(2026-10-14):原G-1018298〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「本批全量终审 186 项 = 173 通过 / 5 警告 /…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L15046(L1 外部持有行 L15041):

```
- [ ]（登记，非本线）relay admin 4 个删除端点零测试覆盖、`o13-bg-rls-live.test.ts` 需要自己的串行通道 〔现读更正@2026-10-15/普查-b3:同题行 L14691/L14692 已勾 ✅(2026-10-09) 且带 16/16 绿现读注记〕〔终态注记@2026-10-15/主会话:stale 清偿翻勾——票面缺陷已在 HEAD 实证收口(证据见行内 现读更正@2026-10-15/普查-bN 注记),本行为漂移副本或已收口未翻勾,主会话按普查结论统一收口〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「（登记，非本线）relay admin 4 个删除端点零测试…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L15253(L1 外部持有行 L15388):

```
- [ ] **G-933 冷启动抢跑全仓盘点余量:A 类 23 页与 B 类 2 处已全清(2026-10-15),C 类(打需鉴权端点但不吞内容,42 代表/总 143)按需推进** —— A 类 23/23:首批 5 处(settings 三页 + knowledge-base/PageClient + sidebar-chat-history)在枚 b100d9457a01021869e829975017862c3bba9228;余 18 页 + 非页组件 2 处(use-earnings 四查询 enabled:allow、ai-side-panel 会话历史 effect 门 + 主体三元登录引导)在枚 70ee02810c3beeb4ba74fbbc3ea4657ad64bf0b1(groups/spec/schedule/voices、image-gen/{gallery,templates}、knowledge-base/search/PageClient、support/TicketList、context/{page,compression,visualization}、ai-skills/PageClient、settings/{authorizations,security-log,activity,data-export})。B 类 2/3:edu/parent 七个子视图逐查询 enabled:allow + models/eval RunDetailDialog 补 !run||!allow 门(同枚 70ee02810c);vip/page.tsx 有意不挡 —— 查询打公开端点,登录门会把「未登录可浏览 VIP 权益」改成强制登录,产品语义变更(审计原文即注「端点公开危害低」),不工具代裁。验证(两批同口径,现读):tsc --noEmit 零错误;vitest 触达面 6 文件 98 用例过;watermark verify 20/20。余量登记(行号会漂移,按内容锚定):**C 类 143 个**(抢跑但打公开端点或失败落空态),其中打需鉴权端点且不吞内容的约 42 个代表:`settings/login-security` L238、`member/benefits` L33、`points/page` L35-51、`workflows/PageClient` L23、`subagents/page` L59-63、`letters/ChatWindow` L42、`mcp-manager` L151、`settings/{DeviceManager,SessionManager,LoginHistory,SecurityScore,TwoFactorAuth}.tsx`、`agent-runtime` 5 个子面板。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「冷启动抢跑全仓盘点余量:A 类 23 页与 B 类 2 处已…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L15272(L1 外部持有行 L15171):

```
- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped @13.6m——2026-08-20 以来 400+ 连红后首次 success)**。连续 3 次 main push 稳定绿后收官(并行会话持续推 main,后续 push 由后续会话按此基准观察;注意并行会话自有改动若再引入失败,以本节根因方法论排查)。CI 迭代实证(每轮根因→修复):44 败(run 34828980145)→ 15 败(34835579747,登录竞争+token 过期清零)→ 12 败(34839041078)→ 1 败(4d4932f run,579/1/1/66 @13.6m)→ 1 败(11f2cf5 run,578/1/2/66 @15.3m)→ **0 败(ac4acf3f run)**。④ 观察 3b 追加:**CSP 根因(产品级)**——`detectStreamBaseUrl` dev 分支仅凭 hostname=localhost:8801 判定,CI e2e 的生产构建 web 同跑 localhost:8801 → streamBaseUrl 跨源直连 8802 → 被 CSP `connect-src 'self' https: wss: ws:` 拦截(trace console 铁证)→ streamChat 无限重试,SSE 用例全灭;修复 = dev 分支叠加 `NODE_ENV==='development'` 门控(commit `4d4932ff`,生产/dev/Tauri 行为不变)。web 构建/运行补 JWT_SECRET(edge 中间件验签,SRO 接管根因,run 34835579747 im-channels error-context 铁证);share-function-test 自建数据 + 消息卡片改轮询(`11f2cf59`)。**教训链:本地 127.0.0.1:8821 同源 + 13.6m 快机,把 CI 的 localhost:8801 跨源 CSP、45.6m 慢机 token 过期、全新库环境依赖全部掩盖**。 〔拍板@2026-10-09 机主授权代行:维持观察口径,首个 GREEN run 后按票面节奏复核,不提前收口。〕〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕〔独有增量并入@2026-10-15/goal-r50:观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped〕 〔副本正文并入·承载整段:观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕〕 〔副本正文并入·承载整段:观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped 〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕〕 〔副本正文并入·承载整段:观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped @13.6m——2026-08-20 以来 400+ 连红后首次 success)**。连续 3 次 main push 稳定绿后收官(并行会话持续推 main,后续 push 由后续会话按此基准观察;注意并行会话自有改动若再引入失败,以本节根因方法论排查)。CI 迭代实证(每轮根因→修复):44 败(run 34828980145)→ 15 败(34835579747,登录竞争+token 过期清零)→ 12 败(34839041078)→ 1 败(4d4932f run,579/1/1/66 @13.6m)→ 1 败(11f2cf5 run,578/1/2/66 @15.3m)→ **0 败(ac4acf3f run)**。④ 观察 3b 追加:**CSP 根因(产品级)**——`detectStreamBaseUrl` dev 分支仅凭 hostname=localhost:8801 判定,CI e2e 的生产构建 web 同跑 localhost:8801 → streamBaseUrl 跨源直连 8802 → 被 CSP `connect-src 'self' https: wss: ws:` 拦截(trace console 铁证)→ streamChat 无限重试,SSE 用例全灭;修复 = dev 分支叠加 `NODE_ENV==='development'` 门控(commit `4d4932ff`,生产/dev/Tauri 行为不变)。web 构建/运行补 JWT_SECRET(edge 中间件验签,SRO 接管根因,run 34835579747 im-channels error-context 铁证);share-function-test 自建数据 + 消息卡片改轮询(`11f2cf59`)。**教训链:本地 127.0.0.1:8821 同源 + 13.6m 快机,把 CI 的 localhost:8801 跨源 CSP、45.6m 慢机 token 过期、全新库环境依赖全部掩盖**。  〔sha无从找回:ac4acf3f=首个GREEN run(2026-09-14,577 passed)旧史提交,单根02b2d353ad之前,结构上无从找回〕〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「4. 观察期:首个 GREEN run 达成(2026-09…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L15273(L1 外部持有行 L15172):

```
- [ ] G-212 **第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)** (原编号 G-603;持有行题面「第十一批」) 〔让号记录(2026-10-03 F9 清偿批④·回捞复位再折并):原号 G-603 同号多题,按交接票 G-160 口径逐组裁决、改动面小的一侧让号,本族让出原号改用本号;原号留归纯登记位持有族,本行正文除编号位与本记录外逐字未动。〕 〔改号(2026-10-14):原G-1038486〕〔结清@2026-10-15/goal-r53:24 条发现逐条落成可执行票已验于归档 ✅ 同题副本(按编号逐条点名),抽查 G-814425 在 HEAD 台账带落点与验收〕〔更正·退回未勾@2026-10-15/goal-r61:上一轮(r54)我翻这行时抽查点名的 G-814425 经复审**属于另一票**(题面「锁的初始化写全再原子可见」= 同族 L14774/L14776 那两行),不是本票"沙箱默认严档"的落点 ⇒ 我的销账证据点错了行。第二格(24 条发现落成可执行票)有归档持有行为凭,但第一格本轮独立复核拿不到凭据:`git cat-file blob HEAD:apps/ai-service/app/services/sandbox.py` 里 strict/default-deny 类字样现读 0 命中,也没有别的在册出口能证明"默认严档"已落地。按 §10/§0.3(没判绝不写成判过)把它退回未勾,请持有会话以命令末行现读重新验收后再翻。〕 〔副本正文并入·承载整段:**第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现落成可执行票(每条带落点与验收判据)**     〔改号(2026-10-14):原G-1038486〕〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「第十一批:沙箱默认严档落地 + 两路只读取证的 24 条发现…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L15274(L1 外部持有行 L15173):

```
- [ ] **D181 电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态已拍板@2026-09-30暂缓+登记依赖)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占用该桶;依赖立项之日随新号翻勾或注销。〕〔独有增量并入@2026-10-15/goal-r50:竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。本行自本注记起转「等条件(依赖立项)」,不再占等拍板桶;〕 〔副本正文并入·承载整段:电脑使用画中画(5 行,对标 `chatSession.pictureInPicture.*`;实现形态需拍板)** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占等拍板桶;依赖立项之日随新号翻勾或注销。〕〕 〔副本正文并入·承载整段:电脑使用画中画 ** —— 竞品串:`sectionLabel`"电脑使用画中画"/`title`"画中画"/`hideInSession`"在此会话中隐藏画中画"/`hideInAllSessions`/`updateFailed`。零命中探针:「画中画」0;`aiChat.floatMode`(PictureInPicture2 图标,ai-side-panel.tsx:1424)=AI 面板页内浮窗,非 computer-use 会话小窗,邻位不背书。拍板结论(2026-09-30 用户拍板):暂缓+登记依赖 —— computer_use.py 是 agent 浏览器自动化工具后端(开页/快照/步进),尚无"可观看会话";先做 PiP 外壳等于空壳。依赖:computer-use 会话可视化(快照流/回放已有 browser_replay/browser_trace 雏形),随其产品化一起立项;浏览器内形态可用 Document Picture-in-Picture API。〔拍板落账@2026-10-10(机主授权代行):2026-09-30 拍板(暂缓+登记依赖)为**终态**——computer_use.py 尚无「可观看会话」,先做 PiP 外壳=空壳,随 computer-use 会话可视化产品化一起立项。本行自本注记起转「等条件(依赖立项)」,不再占用该桶;依赖立项之日随新号翻勾或注销。〕〕 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「D181 电脑使用画中画(5 行,对标 `chatSessi…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

- 原 L15384(L1 外部持有行 L15162):

```
- [ ] 〔2026-10-14/w1-csrf 取证〕**timingSafeEqual 收敛到 secretsEqual 一份**:门 `check-csrf-exemption-shape.mjs` 判据③现读 HEAD 存量 48 处/20 文件(棘轮锚点=HEAD,只减不增);终点状态是"全仓只剩 packages/shared 的 secretsEqual 一份",收敛只能逐笔做(每笔把一处比较改走 secretsEqual 并跑该门全量档证明只减不增);`--strict` 问责档已随门装车(209 号)。 〔【归并】重复登记副本(2026-10-15):同题的另一条登记(题面前缀「timingSafeEqual 收敛到 secretsEqu…」逐字相同),派单以持有行为准(本组信息最全那行),本行不再单独派单;勾选一字未动。@全清-main〕
```

## 跳过交人工(逐行点名,不静默)

- L15424:L6 正文有幸存行 L15388 未承载的独有增量(body=1313 字) ⇒ 交人工,不硬删(实测:G-317 约 2000 字关键发现、G-341 整张独立票、L10371 截断回放都是这一型)

  ```
  - [ ] **G-933 冷启动抢跑全仓盘点余量:A 类 23 页与 B 类 2 处已全清(2026-10-15),C 类(打需鉴权端点但不吞内容,42 代表/总 143)按需推进** —— A 类 23/23:首批 5 处(settings 三页 + knowledge-base/PageClient + sidebar-chat-history)在枚 b100d9457a01021869e829975017862c3bba9228;余 18 页 + 非页组件 2 处(use-earnings 四查询 enabled:allow、ai-side-panel 会话历史 effect 门 + 主体三元登录引导)在枚 70ee02810c3beeb4ba74fbbc3ea4657ad64bf0b1(groups/spec/schedule/voices、image-gen/{gallery,templates}、knowledge-base/search/PageClient、support/TicketList、context/{page,compression,visualization}、ai-skills/PageClient、settings/{authorizations,security-log,activity,data-export})。B 类 2/3:edu/parent 七个子视图逐查询 enabled:allow + models/eval RunDetailDialog 补 !run||!allow 门(同枚 70ee02810c);vip/page.tsx 有意不挡 —— 查询打公开端点,登录门会把「未登录可浏览 VIP 权益」改成强制登录,产品语义变更(审计原文即注「端点公开危害低」),不工具代裁。验证(两批同口径,现读):tsc --noEmit 零错误;vitest 触达面 6 文件 98 用例过;watermark verify 20/20。余量登记(行号会漂移,按内容锚定):**C 类 143 个**(抢跑但打公开端点或失败落空态),其中打需鉴权端点且不吞内容的约 42 个代表:`settings/login-security` L238、`member/benefits` L33、`points/page` L35-51、`workflows/PageClient` L23、`subagents/page` L59-63、`letters/ChatWindow` L42、`mcp-manager` L151、`settings/{DeviceManager,SessionManager,LoginHistory,SecurityScore,TwoFactorAuth}.tsx`、`agent-runtime` 5 个子面板。 〔G-933 代裁留痕@2026-10-15:机主拍板撤销旧态行(进行中@Qoder席)认领并摘除,原文逐字留档 .ihui-agent/archive/PROJECT_PLAN_adjudicated-2026-10-15.md;本行为唯一登记〕
  ```

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
