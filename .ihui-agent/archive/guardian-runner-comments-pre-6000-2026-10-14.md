<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# guardian-runner.mjs 注释腾行归档(2026-10-14)

> 成因:守门 103 架构契约 C1「单文件行上限 6000」在 HEAD 面已红 —— 6019 行,由 `002b818ec2`(旁路落地工具
> 只写注册条目、不跑钩子)顶过线。机主拍板出路 = **归档注释腾行**,不调阈值(`config/architecture-policy.yaml`
> 头注明写"翻 managed 时按实际命中的那条收口,而不是把阈值调到最大文件下面"),也不拆注册表。
>
> 本文件逐字收纳被移走的三段注释。原位置各留一行指针,判据字段(id / label / script / args / mode /
> skipEnv / stagedTriggers / onFailHint)**一字未动**。出处 HEAD `952b68e87064fe69bcdc364046a25da527ff6f14`,
> 原文件 `scripts/guardian-runner.mjs`。
>
> 复核入口:`node scripts/check-architecture-policy.mjs`(C1 现值)、`node scripts/check-gate-wiring.mjs`(接线对账)、
> 各门自己的镜像测试(见每节标题点名的门)。

## #b2 —— 门 104 check-prod-bundle-shadow.mjs(原 L2810-2823,14 行)

```text
  // prod-bundle 影子副本对账 —— 门 2026-09-24 就立了,但唯一挂点是根 package.json 的 check:all,
  // 从未进提交链(实测 `grep -c check-prod-bundle-shadow guardian-runner.mjs` = 0)。这正是本仓
  // 最高频的那一型:"造好没装车" —— 判据正确、跑得通,而没有任何调度器跑它,于是漂移永远静默。
  // 接进来时必须按「机器态 vs 内容态」分流,而不是简单二选 blocking/warn:
  //   deploy/prod-bundle/ 整目录被 .gitignore 忽略 ⇒ 运行副本**只存在于部署机上**。若按现状把
  //   "对账对象不在"判红,别的机器 / 干净 clone / CI 上每一次提交都会被拦,而恒红门的唯一结局是
  //   逼人 --no-verify,连带把全部 130+ 道守门一起作废(AGENTS §4 / §12e / 守门 77·78 同型)。
  //   所以:运行副本缺失 ⇒ 未判定 + exit 0(输出里必须喊出来,不许静默绿);
  //         入库源缺失 / 摘线 / 登记过期 / 逐字节漂移 ⇒ blocking 判红并点名(内容态,在哪台机都该红)。
  // 刻意**不挂 stagedTriggers**:会漂移的那一侧是被忽略的运行副本,它在结构上永远不会出现在暂存区,
  //   按 staged 收窄等于把本门立门的那一型(生产侧被单独改过)整个放过。runner 统一追加的
  //   --staged 本门不解释 ⇒ 恒全量判定(实测单次 ~0.4s,每轮跑得起)。
  // id 取号:注册前 `grep -oE "^    id: '[^']*'" | sort | uniq -d` 零输出(无重复号),
  //   纯数字最大 103 ⇒ 本门顺延取 104,并由镜像测试钉"104 在 runner 中恰好出现一次"。
```

## #b3 —— 门 105 check-miniapp-generated.mjs(原 L2855-2866,12 行)

```text
    // 定级史(升档已完成 —— 别把它再读成"永久 warn"):
    //  · 立项时 warn 是**有意**的:全量面当时就红 —— 8 处 G1/R1「源里有而产物面上查无」(qzdy/szdy/sqb/
    //    qqb/default-avatar/erweima/… 这批图在「图片全外置 CDN」那轮被清走而引用还留着)+ 9 处孤儿默认只
    //    报数。挂 blocking 等于每一次提交都红 ⇒ 逼人 --no-verify ⇒ 全部守门作废(本仓记过最多次的反面
    //    教训)。当时写下的前置条件:**G1/R1 存量清零**(或改成以"该文件 HEAD 自身违规数"为锚点的棘轮)。
    //  · 2026-09-25 前置实测达成 ⇒ 升 blocking:全量面 `未发现漏生成`、exit 0;R2 孤儿与 G3 图标按设计
    //    **不是** blocking 判据(默认只报数,--strict 才判红),所以升档不新增任何恒红面。
    //  · 升档的直接起因是本会话自己踩的坑:改了 i18n 键名却没重生成离线包,门判出 4 处 B2 —— 但因为它只是
    //    warn,提交链没有拦住,于是静默上线了一版"小程序取不到这个词"的产物。**warn 的代价不是"少一道闸",
    //    而是"门判对了也没人被打断"**。
    //  · 修法单命令、不需要人工裁:pnpm --filter @ihui/miniapp-taro gen:i18n(应急跳过
    //    HUSKY_SKIP_MINIAPP_GENERATED=1)。取不到判据输入仍是 exit 2「无法判定」,不冒红也不记绿。
```

## #b1 —— 门 193 check-git-stdio-discipline.mjs(原 L5243-5264,22 行)

```text
  // 2026-10-06 合流让号:本块原登记为 189,而 189 在基底与主干上都属 check-python-import-landed.mjs
  // (取号发生在一份**滞后工作树副本**上,那次快照把 189 顶成同号两门,并顺带摘掉 9 道门:
  //  i18n 流水线条件档 2p-api / 2q-cli / 2r-miniapp-taro / 2s-mobile-rn / 2t-api / 2u-cli /
  //  2v-miniapp-taro / 2w-mobile-rn 与 190;另连带摘掉两扇门体 check-python-import-landed.mjs、
  //  check-enum-default-widening.mjs。名单是 2026-10-07 拿注册面对账 7aa67dbe891 vs 基底 763e7da2e22
  //  量出来的,不是记忆 —— 原写在此处的 2p-2w 并非真实 id(真实名是 2w-mobile-rn),按 §1 消掉)。
  // 合流以主干整面为底(它是基底超集,9 道门原样恢复),本块按空闲号 193 插回;两侧注册块一个不删。
  // git 派生调用的 stdio 纪律(2026-10-03 立)。病根本机实测(30 组对照,本票复测 2 组 × 10 次同形):
  // `execFileSync('git', […], { cwd, encoding, windowsHide, timeout })` —— **不写 stdio** ⇒ 0/30 成功、
  // 抛 EBUSY;同一段补 `stdio: ['ignore','pipe','pipe']` ⇒ 30/30 成功。同刻交互 bash 里直接跑 git 正常
  // ⇒ 与 git 被锁/并发无关;**绝对路径 GIT_BIN / gitBinary() / resolveGitBin() 不是豁免**(EBUSY 是
  // 派生面的病,与怎么找到那个 exe 无关)。另一副面孔:`execSync(<字符串>)` / `shell: true` 经 cmd.exe,
  // 同源同修法。⚠️ 间歇性是这坑的要害(实测有一次测到"不写 stdio 6/6 通过")⇒ 任何判断必须成组对照。
  // 口径:① 射程 = scripts/ 与 scripts/lib/ **全域**(git ls-files 枚举,不用静态清单 —— 清单会漏,
  //    漏的那部分永远绿着;与门 80 的 HOT 清单刻意不同源,并进去会造成"只扫热文件其余静默漏过");
  //    ② 判据匹配**调用括号内的整个文本**(括号配平取整体)⇒ prettier 折行不改判据(本仓吃过逐行
  //    匹配的亏);③ 只判 `stdio` **作为属性名**出现、不判取值(pipe 三元与 ignore 三元都合规);
  //    ④ 判据落在**该次调用的 options 内**(同文件另一处合规调用不得洗白本处);
  //    ⑤ 取不到内容 ⇒ exit 2「未判定」,少扫不等于没有违规;⑥ 自豁免只对门自身与本门镜像测试两个
  //    精确路径,**不前缀通配整个 scripts/tests**(测试面那 200+ 处同样在派生 git);⑦ 豁免只认具名
  //    数据文件 scripts/check-git-stdio-exemptions.json,**行内豁免注释不是通道**(裁决账也不是)。
  // 本票只立门 + 登记待办:存量判红是预期结果(那正是"问题变可见"),不在本票改生产代码。
```

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

## 2026-10-15 二次腾行(守门 103 C1:注册块增多把 runner 顶到 6028 行)

### id '34'(@ts-ignore/@ts-nocheck 增长)(原 L1028–1039,12 行)—— 升档史与 id 占号说明

  // G-815990(2026-10-07)warn → **blocking**。升档前置已现读兑现:本门只判 staged **新增**的
  //   裸 @ts-ignore / @ts-nocheck 共 215 处,历史遗留已于 2026-07-26 批次清零 ⇒ 升档不造恒红门。
  //   ⚠️ 这一段散文里出现过字面量 `@ts-ignore`,若把它排到行首(注释正文以该指令开头),
  //   eslint 的 ban-ts-comment 会把**这句说明**当成真指令判红 —— 2026-10-10 实测:
  //   同段里以「---」或「原」开头的两行都不报,只有以该 token 开头的这一行报,闸因此长期误红。
  //   原 warn 期理由("@ts-ignore 有时是合理压制")的正规出口:确需压制时,该文件对应规则的
  //   覆盖已永久归零,由守门 103 的 DC 判据(裸 lint 抑制增长,锚点 = 该文件 HEAD 自身存量)
  //   与策略表 exceptions(带 until)问责 —— 行内压制不再有免检通道。
  // 跳过白名单:e2e/ 目录(@playwright/test 类型解析场景)、node_modules/ / dist/ / .next/ / build/。
  // 失败含义:staged 文件中新增 @ts-ignore / @ts-nocheck 注释,需审视是否真的需要。
  // id 说明:任务原话"第 31 项"但 id '31' 已被 AuthShell 占用(同日 2026-07-26 新增),
  //   故用 id '34'(33 LLM provider 之后的下一个可用编号)。

### LLM_PROVIDERS schema 对账门(原 L1056–1067,12 行)—— 阶段 3 定级史与校验规则复述

  // blocking:阶段 3 主体已落地(2026-07-26),扁平字段已从 config.py 删除,
  //   LLM_PROVIDERS JSON 是唯一配置源,守门必须 blocking 防止 .env 配置错误导致运行时崩。
  //   详见 docs/llm-provider-stage3-changelog.md §3.2 步骤 3.4。
  // 校验 apps/ai-service/.env 的 LLM_PROVIDERS 字段是否符合
  //   ProviderConfig schema(apps/ai-service/app/core/provider_config.py),
  //   提前发现 JSON 格式错 / 字段类型错 / 未知 provider,避免运行时 Pydantic ValidationError。
  // 校验规则(7 条):JSON 解析 / 顶层对象 / 31 个 provider 白名单 / 字段类型 / 未知字段 / 空值 / 重复。
  //   白名单条数不在此写死(曾写"31 个"已漂成实际 39):名单与条数唯一真源是
  //   scripts/check-llm-provider-schema.mjs 的 PROVIDER_WHITELIST,改名单只改那一个文件。
  // 失败含义:用户 .env 中 LLM_PROVIDERS JSON 字段不符合 schema,ai-service 启动后会运行时崩。
  // 已有依赖:scripts/check-llm-provider-schema.mjs(2026-07-26),3 退出码(0/1/2)。
  // 注意:LLM_PROVIDERS 为空是合法的(降级 stub 模式),info 不阻塞。

### id '53'(admin gate 一致性)(原 L1324–1337,14 行)—— warn→blocking 的两个前置取证叙述

  // 当初 warn-only 的理由:存量 34 文件/74 处裸 roleId 比较刚完成一次性白名单登记,白名单
  //   口径与 --staged 判据需先观察一轮误报率;存量清零或稳定后再升。
  // 现在可升,两个前置都已完成:
  //   ① O13b 第二段 ①②③⑤ 已落地(34 文件白名单收敛到 8 文件/12 处,集中封装
  //      plugins/require-permission.ts 的 requireAdminRouteGuard 亦收编了 admin.ts 的 preHandler);
  //   ② 判据缺口已补 —— `if (roleId < 1)` 这一种文本形态同时是"特权判定"(读 jwtPayload → 403)
  //      和"入参校验"(读 request.query/body → 400 'roleId 无效',如 role-routes.ts 五处),
  //      两者逐字符几乎相同。warn 期无所谓,升 blocking 后任何新写的 roleId 入参校验都会
  //      被永久锁成红点。已按**来源回溯**排除后者(AUTH 证据优先、回溯不出即判红、属性访问
  //      不进排除通道 ⇒ 宁不误放),全量实测 17 → 12 处,排除 5 处入参校验、零真鉴权被误放。
  // 判据:裸 roleId 数值比较(集中封装之外)条数只减不增;本地重定义 requireAdmin 禁止回升;
  //   capability-catalog dataClass=platform 条目 thirdPartyEligible 必须为 false(机器凭据 403 不变量)。
  //   详见脚本头注释与 docs/developer/admin-permission-mapping.md。
  // 跳过方法:HUSKY_SKIP_ADMIN_GATE_GUARD=1 git commit ...(应急,不建议)

### id '81'(品牌邮件通道对账)(原 L2285–2300,16 行)—— 立因叙述与"范围与 stagedTriggers 必须同步扩"

  // 品牌邮件通道对账(2026-09-23 立,守门 81)。成因:邮件"版式模板"只存在于
  // apps/api/src/services/email-templates.ts,但 ops 侧曾有第二条绕过模板的自发通道 ——
  // deploy/win/ihui-deploy.ps1 的 Send-EmailNotify 自拼传输层(Send-MailMessage 无 -BodyAsHtml、
  // Resend payload 只有 text)。这类代码"能发出去、typecheck/lint 全绿",用户收到的邮件却没样式,
  // 与守门 72/78 同族("本地全绿也发现不了")。判据:R1 PS Send-MailMessage 缺 -BodyAsHtml /
  // R2 api.resend.com/emails 同一发送上下文无 html 字段(覆盖 host+path 分行形态)/ R3 ops 脚本
  // 有发信动作(createTransport/sendMail/api.resend.com)却不引用 email-templates /
  // notify-deploy-failure。范围 deploy/** + scripts/**(不含 tests)+ workflows *.yml;
  // 行内豁免 brand-mail-exempt:,存量走 scripts/brand-email-channel-baseline.json 只减不增
  // (建门实测:ihui-deploy.ps1 已被并行会话清干净,仅 check-credential-health.mjs 这条
  // "第三条纯文本通道"入基线待迁移 —— **2026-09-24 已迁至品牌出口,基线 counts 现为空**)。
  // --staged 暂存集为空/取不到 → 退化全量(守门 70 教训)。
  // **范围与 stagedTriggers 必须同步扩**(2026-09-24 补,本条目曾被并发整文件提交回退过一次,
  // 由 scripts/tests/check-brand-email-channel.test.mjs 的"装车证明"抓回):判据已扫到
  // monitoring/** 与 apps/api/scripts/**,若触发清单不跟上,则**只改 bridge 的提交在 pre-commit
  // 根本不会唤起本门** —— 判据存在而永不调用,等于没有(守门 70/76 同型)。
