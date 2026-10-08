#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-batch-write-count-honesty.mjs — 批量写端点的 affected/deleted 不得由请求侧自算
 *
 * 在修什么(本批实测成因,不是抽象理由):同一批里人肉逐文件找到 8 处"批量写端点把
 * affected/deleted 由请求侧 `.length` 自算"的静默失真(chat.ts 批量、admin-sys/role-routes.ts
 * cancelAll+selectAll、admin-demand-square.ts、admin/_shared.ts registerCrud 批量删、
 * message.ts 批量删、workspace.ts batch-delete/batch-restore)。症状是**改了 0 行与改成功返回完全
 * 同形** —— 不报错、typecheck 全绿、单测不红,只有用户看到"已删除 3 条"而库里一条没动。修法是唯一
 * 出口 `apps/api/src/utils/batch-outcome.ts`(dedupeIds / batchWriteOutcome)+ db 层用
 * `.returning({id})` 回报真实命中集合。**没有尺子,下一批同类端点照样进 HEAD** —— 这正是本仓全部
 * 守门的立项理由。
 *
 * 判据(一条,窄口径,宁漏不误报):在 `apps/api/src/routes/**` 与 `apps/api/src/db/**` 的
 * 跟踪文件里,同一**函数体**内
 *   ① 有一条 `db|tx|trx` 发起的 `.delete(`/`.update(` 链,链上带 `.where(` 且其中出现 `inArray(`;
 *   ② 且该链**之后**有 `.send(success({ … (deleted|affected|restored|removed|count): <点号链>.length … }))`。
 *
 * 四条放过通道(任一成立即不算违规,各有一支正反对照钉住):
 *   E1 链上带 `.returning(` —— 计数来自库确认的返回集;
 *   E1b 计数根标识符可追到库确认的集合(归属预查询 `select … where inArray(…)` / returning 结果,
 *       ≤2 跳)。必须有这一条:唯一出口自己的定义就是"affected 由库确认的集合(… / **归属预查询
 *       命中集**)推出",只看 `.returning(` 会把 `business-card-routes.ts` 那种正确写法判成红。
 *   E2 该文件 import 了 `utils/batch-outcome`(已在唯一出口上);
 *   E3 命中行或其紧邻上一行有行内豁免 `batch-count-exempt: <原因>` —— **必须带非空原因**,裸标记
 *       不算(与门 102/108 同规矩),且必须在注释里(否则把标记写进字符串就能冒充豁免)。
 *
 * 刻意不判的邻近形状(反向锁,不得为消红放宽判据):N1 布尔确认里**与写链无关的那一型**(同函数体内
 * 没有 db|tx|trx 的 delete/update ⇒ 它只是"惯例 ack",改它属全 API 语义决策,不归这道门顺手做;带写链
 * 的那一半自 2026-09-27 起升级成判据 **B1**,见下一段)与"布尔档的值是一枚比较式"那一型;
 * N2 `count: rows.length` 读查询计数(函数体内无写链);
 * N3 注释与字符串里的字样 —— 判据跑在"剥注释 + 抹字符串"的代码面上,模块说明符是唯一例外(E2 只能
 * 从字符串里读),所以 import 判据跑在另一档上;两型遮噪方向不同,门 118 头注记过同一条教训,各有用例。
 *
 * **布尔档的键族(2026-09-27 第二十九批扩面)**:判据此前只认 `deleted` 一个键,于是"同一形状换个
 * 键名"整型隐身 —— 第二十八批(`9155c57ed06`)逐体清掉的 15 处里,10 处改真的键是 removed/restored/
 * revoked/cleared,判据一处也看不见,下一次同样写法照样进 HEAD 而门一路报绿。现键族 =
 * `deleted | removed | restored | revoked | cleared`(BOOL_ACK_KEYS 一份真相:判据正则、按键分组的
 * 报表、结论行逐键点名三处都从它派生;自检 K0 另备一份**独立写死**的期望表对账它有没有被削短)。
 * **不与 COUNT_KEYS 复用同一个常量**:那张表问的是"自算的计数值",这张表问的是"布尔档承诺了什么",
 * 且键集并不相同(前者有 affected/count 无 revoked/cleared,后者反之)—— 合并就是混计。
 * 报表**按键分组**(`booleanAckByKey`,五键恒在位含 0),因为扩面后"合计 17 处"这句话分不清
 * "新那一族一处没有"与"新那一族全是" —— 而这两种情况的下一步动作完全不同。
 *
 * 四类"证据在别处"的放过通道(2026-09-27,第二十九批:扩键族必须同时扩**认证据**的能力,否则
 * 第二十八批逐体判为诚实的五处会被新键当场判红 = 与任何提交都无关的恒红门,§12e):
 *   ① 一跳委托的 RETURNING —— B2 的被调体可以做**两件**写事(实测 `detachTag`:先
 *     `delete … .returning()` 拿命中集,再把计数列 -1 的 update 不带 returning)。旧口径"任一链缺
 *     returning 即违规"把这种**已诚实**的形状判红。现按 ack 键筛写动词(BOOL_ACK_KEY_VERBS):
 *     只有该动词的链参与定罪,筛完没有匹配链则**退回旧口径**(只少误伤、不给"根本没做过那次写"发
 *     合格证);摘掉那条 returning 后同一夹具必读红(K12)。**B1 不做这一层筛选** —— 调用方体内任何
 *     db 写都算"这一屏真发了写",筛动词等于削弱 `deleted` 那一族既有判据(自检 B1b 钉着)。
 *   ② 原生 SQL 里的 RETURNING —— `db.execute(sql\`DELETE … RETURNING id\`)` 的库答复住在模板串里,
 *     而模板内容在遮蔽后的代码面上被抹成空格,既有 F1 的 `.returning(` 结构上读不到它。现另开一条:
 *     在"剥注释、**保留字符串**"那一档(与 E2 的 import 说明符同一档、同一份取材)按同一行号窗口读
 *     execute 调用的原文,RETURNING 关键字必须落在**该次调用的括号内**才算(注释里提一句不配放过 ——
 *     与"注释里的 .returning( 不算"同一条规矩)。
 *   ③ 内存 store/Map 的删除返回真布尔 —— 由**接收者白名单**放过(db|tx|trx 之外不算库写),
 *     这一型没有"库侧行"的概念,不属本型(自检 K5/K6 各钉一处真实形状)。
 *   ④ 同响应里另有诚实字段承载行数 —— `{ cleared: true, deleted, prefix }`:受影响键数由同一份响应里
 *     那枚行数键(简写形态)诚实承载,布尔档不承诺行数。**只认简写**:带冒号的那一支随便写个不相干的
 *     标识符就能洗白,所以结构上不匹配(自检 K9 去掉载体必红 / K10 带冒号那支仍红)。
 *   ②③④ 的放过都**折进既有的 confirmed 桶**(它们说的是"库答复已在别处存在",不是"有人给了豁免"),
 *   所以 b1* 与 b2* 的既有键、取值形态一字不变;具体靠哪一条证据放过由 confirmWhy 带出(`--explain` 里
 *   点名)—— "放过"与"没看见"必须能各自被问到。
 *   **原"已知空档"已于同日关闭(第三十批)**:门此前**不把** `db.execute(sql\`DELETE …\`)` 当成一条
 *   写链(只把它当放过的证据),所以"原生 SQL 发了写 + 回布尔 true + SQL 里没有 RETURNING"这一格
 *   B1/V 都看不见。现已补上 **裸 SQL 写链**这一维(`findRawSqlWriteChains`,写判据用
 *   `DELETE FROM` / `UPDATE <ident>` / `INSERT INTO` / `TRUNCATE TABLE` 的**搭配式**而非裸关键字,
 *   以免把 `WHERE action = 'UPDATE'` 这类读查询判成写)。**仍开着两格,如实登记**:
 *     ① B2 那一跳(ack 在调用方、写住在**另一个文件**的委托函数里)仍只认 drizzle 链 —— 触发条件
 *       ("任一 ack 落点的最小函数体 await 了体内含无 RETURNING 裸 SQL 写的具名函数 ⇒ 必补",票 守门134)
 *       现由 `measureB2RawSqlTrigger` 在 HEAD 面**可复跑**地普查(镜像 M24 带阳性/阴性对照钉它不是
 *       瞎眼量出来的 0)。2026-09-28 复跑:一跳 15 条、命中 0 ⇒ 判据不动。出现该形状的那天 M24 当场红,
 *       接维时读 `indexExportedFns` 的 rawBodyText("保留字符串"那一档已随测量收进,索引不用再改)。
 *     ② ack 键在 `BOOL_ACK_KEYS` 五键**之外**的同一形状(实测两处病灶的回的是 `updated:true`)——
 *       加键属全 API 语义决策(见上"布尔档的键族"一段),不是这道门能顺手扩的;两处病灶已改真。
 *
 * B1(2026-09-27 立):布尔 ack 里**可判的那一部分**从"只报数"升级成棘轮判据。用户已拍板把
 * `deleted: true` 改成真实语义(= 库里真删了一行,6 路并行改造在跑),所以"函数里真发了 delete/update,
 * 却无条件回 `deleted: true`"从惯例变成了**已知在偿的债** —— 新写一处这种假 ack、或把已改真的点改回
 * 字面量,都必须当场红;而 HEAD 存量不判红(与改动无关的恒红门唯一结局是逼人 `--no-verify`,§12e)。
 *   判据一条:同一**函数体**内 ① 有一条 `db|tx|trx` 发起的 `.delete(`/`.update(` 链(不要求 inArray ——
 *     B1 只问"这一屏真的发了写",不问命中集算法),② 有 `.send(<X>success({ … deleted: true … }))`
 *     字面量(与 V1 **共用同一份取材**:`sendSuccessObjects` + `findBooleanAckSends`,两处各扫一遍必漂移,
 *     M13 的 send-success 扫描式单点锁同时管住这一族),③ 体内没有 `.returning(`、也没有 `batchWriteOutcome(`
 *     ⇒ 违规。判据只在**响应对象面**里找 `deleted: true` —— select 结果映射、类型注解、注释、字符串里的
 *     同字样一律不算(所以它不是整行 grep,`B1r` 用例钉死这一点)。
 *   两条放过通道(与违规判据同一次扫描内判定,各配正反用例):
 *     F1 同函数体有 `.returning(` 或 `batchWriteOutcome(` 调用 —— 已是库确认口径(注释/字符串里的这两个
 *        字样不算:判据跑在遮蔽后的代码面上);
 *     F2 行内豁免 `delete-ack-exempt: <原因>` —— **必须带非空原因**(裸标记不计,同门 102/108 的
 *        "注释闭合符冒充原因"教训)、**必须落在注释里**(字符串里的标记不算)、**只命中本行生效**(比
 *        `batch-count-exempt` 的"本行或紧邻上一行"更严:假 ack 的标记写在上一行是直觉动作,那条通道
 *        宽一寸,一个标记就能救整块,反向锁由 `B1p②c` 钉住)。它已登记进守门 108 的
 *        `FAMILY_LIFETIME_DAYS` 取 **30 天** —— 这是待偿的迁移债,不是结构性定性。
 *   **E2(文件级 import 唯一出口)刻意不救 B1**:import 了 `utils/batch-outcome` 不等于这一处 ack
 *     走了库确认(实测 fixture `b1OutletFileStillJudged`),文件级放过是计数判据的口径,搬过来就
 *     把最典型的"迁了一半的端点"洗成通过。
 *   棘轮锚点 = **该文件 HEAD 自身的 B1 计数**(与门 70/77/83/98 同形,禁止手工白名单文件清单 ——
 *     清单必然腐烂):存量只报数、新增即红、把已改真的点改回字面量即红、清掉后锚点自动下降。
 *   结构性看不见的一格如实报数:布尔 ack 落在**解析不出函数体**的位置(模块顶层、class 方法简写等)
 *     ⇒ `b1NoBody` 只报数不判红也不记绿;`--strict` 下与既有未判定同档 ⇒ 拒绝出合格证(exit 2)。
 *
 * B2(2026-09-27 立,与 B1 并列、各计各的):**把"一跳委托"接进判据 —— 防的是摘掉 .returning( 的回退**。
 *   B1 只看**同一函数体**内有没有写链,而 HEAD 面 38 处布尔 ack 里有一批的写法是
 *   `await deleteXxx(id)` + `deleted: true` —— 真 `db.delete()` 住在**另一个文件**的被委托函数里,
 *   函数体看不见写链 ⇒ **B1 结构上失明**。第二十六批刚把这一族改成"委托函数回报 RETURNING 命中集";
 *   以后谁把某个委托函数里的 `.returning(` 摘掉(或把路由改回 `deleted: true`),B1 一声不响,
 *   而账面仍是"这一族已清零"。B2 就是把这一跳接上。
 *   判据:ack 所在函数体 ①**没有**直接写链(有链那一子集归 B1,同一格不得两道判据各计一次),
 *   ②体内 `await` 了**经 import 说明符解析到本仓 `apps/api/src` 文件**的具名导出函数(一跳,不追传递闭包),
 *   ③被调函数体含 `db|tx|trx` 上带 `.where(` 的 `.delete(`/`.update(` 链、**该链没有 `.returning(`**,
 *   ④被调函数体内也没有 `batchWriteOutcome(` ⇒ 违规。
 *   三条刻意收窄,每条都落到"未判定"并报数、在结论行点名(绝不静默算通过,也绝不因判不出而判红):
 *     N1 命名空间转发(`import * as ns` + `await ns.del()`)、`export * from` / `export {} from` 再导出、
 *        第三方与 workspace 包(`fastify` / `@ihui/database`)、被调文件不在所判面、相对/别名路径解析不到、
 *        被调符号不是可解析的函数导出、被调链 opaque(where 里混函数字面量)⇒ **未判定**;
 *     N2 被调函数体解析到了但**根本没有带 where 的写链**(纯归属预查、软删标记走别的路径)⇒
 *        判"无写链",这是真绿,不塞进未判定充数;
 *     N3 ack 体内既没有被 await 的 import 具名函数、也没有 N1 那些形态 ⇒ **不入 B2 的账**
 *        (它已由 V1 的布尔 ack 惯例数逐条点名,再计一次就是把同一格算两遍)。
 *   豁免:与 B1 **同一条通道、同一份实现** —— `delete-ack-exempt: <原因>`,只本行生效,原因不得由
 *     注释闭合符冒充(M16 那把"不得另写第二份豁免判法"的锁同时管住这一族)。
 *   取材:被调函数体与调用方**同面同轮**(head 判 HEAD、staged 判索引、worktree 判磁盘),needs 清单由
 *     调用方那一遍得出、在同一次 analyze 里一次读满;枚举表(`ls-tree`/`ls-files`)也按同一面取,
 *     不得"清单来自磁盘 + 内容来自 HEAD"。
 *
 * B3(2026-09-30 立,G-815953):批量回填的 UPDATE 必须带「上一次迁移应用时刻」的时间上界谓词。
 *   背景:回填按"当前最新数据"重算历史,会把两次迁移之间用户写入的值当旧格式覆盖。唯一出口
 *   `apps/api/src/utils/backfill-baseline.ts`(assertBaselineTime fail-closed + backfillWhere 强制
 *   lte(col, baseline))已先行落库;本判据守的是"下一个回填落点只能走这里"。
 *   判据一条:`db|tx|trx` 的 `.update(` 链,`set(` 实参命中**迁移记账列**(migrationBatch /
 *   migration_batch / legacyId / legacy_id / legacyTable / legacy_table)—— 收窄到"写迁移记账列"才算
 *   回填:软删形状 `set({deletedAt/revokedAt: new Date()}).where(and(eq(...), isNull(...)))` 与回填词法
 *   同形且 HEAD 实测十几处,任何按 isNull 划线的判据都是恒红门(§12e),自检 B3d 钉死这一条;
 *   且 `where(` 实参里**没有**时间上界谓词(lte( / lt( / backfillWhere( / `<=` 任一)⇒ 违规;
 *   无 where 的全表无界 update 同判。裸 SQL 维:`db.execute` 的 `UPDATE` 语句同判(取材"保留字符串"
 *   那一档,`<=` 在 SQL 串里可读)。
 *   放过:where 实参出现上界谓词即绿 —— 走 backfillWhere 出口的,其实参自带 `backfillWhere(` 字样。
 *   **无行内豁免通道**:回填没有"确属有意无界"的合法场景(fail-closed 出口已把语义钉死),红点的
 *   唯一正解是补上界/走出口;应急走 SELF_SKIP。
 *   存量口径:head 实测 0(drizzle 与裸 SQL 两维),走与 B1/B2 同款「head 默认只报数、--strict 判红、
 *   staged 差值棘轮」三档,decide 签名收 b3Violations(签名即判据)。
 *   判不了格(如实登记):①落点在 SCAN_DIRS 之外的独立回填脚本;②接收者非 db|tx|trx 裸标识符
 *   (含 `db.with(...).update` —— 既有链扫描对这一形态整体失明,V/B1/B2 同一取材,非本判据新欠的债);
 *   ③上界谓词经中间变量间接拼装(如 `const w = cond ? lte(...) : undefined` —— whereText 只看一跳字面);
 *   ④drizzle 链 where 里用 sql`…<=…` 模板写上界 ⇒ 遮蔽面(blankStrings 档)读不到模板内容,按无上界计
 *   (fail-closed:新写该形态请用 lte() 表达式,别用模板串)。
 *
 * B4(2026-09-30 立,G-815956):迟到终态事件不得把已终态记录改回活动态 —— `update` 写 status/state
 *   列而 where 无对**同一状态列**的 eq/in/ne 前置,等于把"改哪几行"交给调用方纪律。
 *   判据一条:`.update(` 链 `set(` 实参里出现**字面量** status/state 键(遮蔽面把字符串值抹空 ⇒
 *   `status:` 后紧跟 `,`/`}` 才算字面量;变量值/简写/spread 在遮蔽面上有可见 token,一律不进面)
 *   且 whereText 无同列 eq/ne/inArray/in 前置 ⇒ 违规。
 *   **棘轮专用维(与 B1/B2/B3 不同档,理由如实登记)**:head 实测存量 53 处(agents/order/team/
 *   workflow 等 db 层与 edu-ai-management 等路由层),镜像红形状与存量词法**完全同形**、收窄到 0 不得
 *   —— 按票面拍板"现存违规报数不判红,只拦新增":head 面(含 --strict)**只报数、永不判红**
 *   (decide 签名**刻意不收** b4Violations —— "签名即判据"是结构锁不是注释约定,自检 B4D 钉住);
 *   staged 面走「该文件 HEAD 自身 B4 计数」差值棘轮,净新增即红。棘轮粒度 = 文件 × 判据(**无键**:
 *   状态列没有 ack 键族,"换值逃逸"在这一维不成立)。
 *   判不了格(如实登记;票面明说上游 settleSessionInput / markSessionInput 等判不了):
 *   ① set 值来自变量/简写/spread ⇒ 词法非字面量,不进面(状态机收口的语义判定不做);
 *   ② 值是数字枚举码(set({status: 2}))⇒ 数字字面量在遮蔽面可见、与变量同格,字面量判据
 *     (值被抹空形态)结构上不认 —— 判不了,不假装已解决;
 *   ③ `as` 断言字面量(set({status: 'x' as T}))⇒ 遮蔽面 `status:` 后跟标识符,不进面;
 *   ④ 前置写在 sql`…` 模板里 ⇒ 遮蔽面读不到,按无前置计(fail-closed:新写请用 eq() 表达前置);
 *   ⑤ 裸 SQL 的 `UPDATE … SET status = 'x'`:存量实测 0,但字面量与前置在 SQL 串里另成词法体,
 *     本版**刻意只认 drizzle 链**(收窄,登记;该形状出现的那天由镜像正例扩面接维);
 *   ⑥ "该列是否真是终态列"是语义问题,词法只认列名 status/state。
 *
 * B5(2026-09-30 立,G-815955):按可空/非唯一排序列 ORDER BY 必须带确定性尾键 —— 单键
 *   `orderBy(asc(t.sortOrder))` 下同值行在两次查询间没有确定座位,分页漂移(上游经验:
 *   `order by sequence is null, sequence, time_created, rowid` 每级都有确定性尾键)。
 *   判据一条:遮蔽面上的 `.orderBy(` 实参,顶层**单键**且恰是 `asc(<t>.<col>)` / `desc(<t>.<col>)`
 *   形态、<col> ∈ {sortOrder, sortOrderInGroup, position, sequence}(票面点名的可空/非唯一排序键族)
 *   且无后续尾键 ⇒ 违规;首键同族但后面还有键(如 `…, desc(t.createdAt), asc(t.id))`)⇒ 处置
 *   tail-key 放过。主排序语义不归本门管(第一序是什么是业务问题,本门只问"有没有确定性尾键")。
 *   **棘轮专用维(与 B4 同档同构)**:head 实测存量 8 处(routes/db 面单键形态;content-queries/
 *   learn-queries/exam-queries 等已带尾键的那一批只进候选),镜像红形状与存量词法完全同形 ——
 *   按票面拍板"存量报数不判红,只拦新增":head 面(含 --strict)**只报数、永不判红**
 *   (decide 签名**刻意不收** b5Violations —— 与 B4 同一条结构锁);staged 面走「该文件 HEAD 自身
 *   B5 计数」差值棘轮,净新增即红。棘轮粒度 = 文件 × 判据(无键,与 B3/B4 同理)。
 *   取材:与 findWriteChains 同一遮蔽面、同一套括号配平(closeParen),但 orderBy 是读链,
 *   findWriteChains(.delete/.update)结构上够不着 ⇒ B5 自带一遍 `.orderBy(` 扫描(判据只此一份,
 *   走 __test__ 出口);裸 SQL 维:findRawSqlWriteChains 只认写动词锚(DELETE/UPDATE/INSERT/TRUNCATE),
 *   SELECT…ORDER BY 不进池 ⇒ 判不了,登记不进面。
 *   判不了格(如实登记):
 *   ① 键经变量/展开传入(orderBy(sortCol) / orderBy(...keys))⇒ 非 asc/desc 字面形态,不进面;
 *   ② `sql`…order by…`` 模板 ⇒ 遮蔽面(blankStrings 档)读不到模板内容,不进面(与 B3④/B4④
 *     同一遮蔽面代价;判不了 ≠ 按无尾键计);
 *   ③ 裸 SQL 的 SELECT…ORDER BY(上段,不进池);
 *   ④ "该列是否真的可空/非唯一"与"尾键组合是否真的唯一"是语义问题,词法只认列名族与"有没有
 *     后续键" —— 尾键本身也落在同族列上时词法不认输(语义复核不归本门);
 *   ⑤ SCAN_DIRS 之外的落点(services/ai-feed-service.ts 等)不进面 —— 覆盖面与 B1-B4 同一张表。
 *
 * B6(2026-10-07 立,G-815954):jsonb 整列覆盖式 upsert 会吃掉"显式清空"的墓碑 —— onConflictDoUpdate
 *   的 set 块凡写 jsonb 列,整列覆盖必须**逐列声明写策略**;具名成员合并 / jsonb_set 结构上即绿。
 *   病灶:agent-runtime/session-store.ts 曾对 metadata/messages 整列覆盖 —— metadata 整列落盘会把
 *   行内"显式清空(null 墓碑)"与旧版回滚快照字段一并吃掉;已修(提交 adcdceb7f6):metadata 走
 *   具名成员合并(`t.metadata || <具名成员>::jsonb`)、messages 带逐列声明(全量真相)—— 本判据
 *   对 HEAD 面该文件必须判绿(镜像测试直接读 HEAD blob 复核,见 scripts/tests/g-815954-*.test.mjs)。
 *   判据一条:`.onConflictDoUpdate(` 的 set 实参里出现 jsonb 键族的列(词法近似,见
 *   JSONB_UPSERT_COL_RE 注)——
 *     - 值为具名成员合并(`||` 且带 `::jsonb` 或 excluded 引用)或 `jsonb_set(` 指定路径 ⇒ 绿
 *       (缺席不触碰语义,票面正反对的"绿腿");
 *     - 其余形态(`excluded.<col>` 整块搬入 / 裸赋值 / 纯字符串)⇒ 整列覆盖,键行及其上 3 行内必须有
 *       逐列策略声明注释 `// <列>:全量真相`(或 `<列>:full-truth` 别名),无声明 ⇒ 违规
 *       (票面正反对的"红腿":整块 excluded 无声明必红)。
 *   **棘轮专用维(与 B4/B5 同档,取舍如实登记)**:HEAD 面实存 7 处整列覆盖无声明(registry 同步
 *   快照 upsert ×6:registry-queries.ts 的 categories/tags/payload,raw.* 与 EXCLUDED.* 各 3;
 *   im-gateway.ts 凭据回写 ×1),镜像形状与存量词法同形;收窄列族到 0 列会让判据失明,逐处补声明
 *   又属业务代码改动(不归本门)—— 按票面同款口径"现存违规报数不判红,只拦新增":head 面
 *   (含 --strict)只报数、永不判红(decide 签名**刻意不收** b6Violations —— 结构锁同 B4/B5,自检
 *   B6D 钉住);staged 面走「该文件 HEAD 自身 B6 计数」差值棘轮,净新增即红(新文件锚点 0:第一个
 *   jsonb upsert 第一次就写错必须判红)。棘轮粒度 = 文件 × 判据(无 ack 键;被覆盖的列名已在红点
 *   字段里点名 —— 同文件换一列再覆盖 = 新增一处,照红,不存在"换列逃逸")。
 *   **取材三档(各档有名有姓,不与既有判据的取材档混用)**:①结构(set 块定位/键/值 span)在
 *   **全遮蔽档**(blankStrings=true)—— 注释与字符串里冒充的 onConflictDoUpdate 不进面(N 系同款);
 *   ②形态(合并/jsonb_set)在**剥注释留字符串**档读 —— `sql`… || …::jsonb`` 的 `||`/`::jsonb` 与
 *   `jsonb_set(` 活在模板字面量里,全遮蔽档看不见;值若为纯字符串字面量(全遮蔽档剩空白)⇒ 按整列
 *   覆盖计,字符串冒充绿腿被这一格挡住(自检 B6g 钉住);③声明注释在**原始正文**读(键行及其上
 *   3 行),且该 token 位置在留字符串档必须**不在**(注释在那一档被剥 ⇒ 同位置还读得到 = 它活在
 *   字符串里,不配作声明;比 readExemptMarker 的"头查注释符"更准一道,两道都设,自检 B6s 钉住)。
 *   三份取材 scanFileText 各算一次传下去,判据不二次 maskText(门 118/93 同一条教训)。
 *   **面**:本维专属枚举 = SCAN_DIRS ∪ services ∪ plugins(JSONB_UPSERT_SCAN_DIRS)—— 票面阳性
 *   站点 session-store.ts 住在 services,判据必须看得见它才能判绿;B1-B5/V1/V2 的面**一字不动**
 *   (枚举多一个目录就是给它们添新候选,那是另一个决策)。--files 名单只作用于基础面:services/
 *   plugins 路径经 --files 递入会按"面外"点名,但 B6 在全量面仍判它(登记,不装看不见)。
 *   判不了格(如实登记):①"列是否真是 jsonb"靠键族词法近似(刻意**不含 value**:systemConfigs/
 *   userPreferences 的 value 是 text 列,p3-deep-layer 的 jsonb value 无 upsert 落点,按名收族会把
 *   6 处 KV 覆盖误判进面);族外 jsonb 列(config/context/prefs 等 HEAD 面无 upsert 覆盖落点)不进
 *   面,扩族必须同批核对 HEAD 存量,否则恒红门(§12e);②config 非对象字面量(回调式)或无 set 键
 *   ⇒ 不进面;③合并右值经中间变量在别处拼装 ⇒ 看不见(fail-closed:按整列覆盖计,声明通道可放行);
 *   ④声明写在键行上方 >3 行 ⇒ 读不到;⑤jsonb_insert( 等其他路径语义函数未列绿腿 ⇒ 按整列覆盖计
 *   (fail-closed,同 ③ 有声明通道)。
 *
 * B7(2026-10-07 立,G-815984):写时刻必须原样回给调用方 —— 写链(.delete/.update)带了 .returning(
 *   且实参是**显式列投影对象字面量**时,取了业务列就必须同时取回时间列(票面点名形态 `.returning({id})`
 *   的"只回主键"是既有计数绿形态,归豁免半句,见下)。判据一条,四腿:
 *     - 裸 `.returning()` 无参 = 回全行 ⇒ 绿(处置 bare-full-row;时间列结构性在内);
 *     - 纯 id 计数投影(顶层键全部 id 形)⇒ 绿(处置 id-count;票面"写链 `.returning({id})` **之外**"
 *       的豁免半句 —— 它是 V1/B1 的既有绿形态、也是本门修法指引自己推荐的形状,判它违规会让棘轮把
 *       "按修法指引补 .returning({id})"判成净新增(自检 BR/B2R"补回即归零"契约当场红),门与自己打架;
 *     - 投影里带时间列(键/值任一侧出现 At|Time 结尾标识符,仓内驼峰时间戳惯例
 *       createdAt/updatedAt/deletedAt/settledAt…)⇒ 绿(处置 time-col);
 *     - 其余(取了业务列却无任何时间列)⇒ 违规 —— 写入时刻没回给调用方,时序/去重/审计只能靠猜。
 *   **棘轮专用维(与 B4/B5/B6 同档同构)**:head 面(含 --strict)只报数、永不判红(decide 签名**刻意
 *   不收** b7Violations —— 结构锁同 B4/B5/B6,自检 B7D 钉住);staged 面走「该文件 HEAD 自身 B7 计数」
 *   差值棘轮,净新增即红(新文件锚点 0:第一个写点第一次就漏回传必须判红)。棘轮粒度 = 文件 × 判据
 *   (无 ack 键;缺的列名已在红点 excerpt 里点名 —— 同文件换一列再写 = 新增一处,照红,无"换列逃逸")。
 *   取材:findWriteChains 链对象新增 returningText 字段(与 whereText/setText 同源同批 —— links 只此
 *   一份,B7 不二次扫描,§22c);判据读**全遮蔽档** —— 注释里提时间列冒充不了投影(自检 B7f 钉住)。
 *   判不了格(如实登记,不进面、不冒充已判):①实参经变量传入(returning(cols))⇒ 里面有没有时间列
 *   词法不可知;②投影对象带展开({...pick})⇒ 同格;③`sql` 模板实参 ⇒ 遮蔽面读不到内容,同格;
 *   ④"调用方是否真需要时序"是语义问题,词法按"取业务列的写点默认随行回传写时刻"收紧(存量只报数,
 *   新增走棘轮);⑤insert 链不进本维 —— findWriteChains 动词锚只有 .delete/.update,扩动词会同时改
 *   B1/B3/B4 的面,那是另一个决策(登记,不装看不见)。
 *
 * 两份"惯例存量"计数(可见性,不是判据 —— **永不影响退出码**):上面那两个"刻意放过"的形状此前只有
 * 注释里的一句"全仓 257 处"撑着,而那句是人肉量的,下次谁扩面/收面账面没人知道它变了多少。现由本门
 * 每次现读数并报数:
 *   V1 `booleanAckSites` / `booleanAckFiles` —— 窄到形态:`.send(<X>success({ … <键族成员>: true … }))`
 *      对象字面量里 **键逐字等于 BOOL_ACK_KEYS 的某一员、值为布尔字面量、其后紧跟 `,` 或 `}`**。
 *      因此"值是标识量 / 是 `.length` 链 / 字面量后还接着算式"、以及"键名带前缀(`isDeleted` 这类)"
 *      **一律不混进这一计数**。
 *      **2026-09-27 语义变化(必须如实说)**:这两个数的口径从"`deleted` 一族"扩大为"五键全集",
 *      所以同一份 HEAD 在扩面前后读数不同(现读 12 → 17)—— 不是判据变松,是**看得见多了四族**。
 *      要问"哪一族多少处"读 `booleanAckByKey`(五键恒在位,含 0),不要读那两个合计。
 *      **V1 仍是全形态的"现读可见性"数,自身依旧不参与任何退出码**;但自 2026-09-27 起它是 B1 的
 *      超集 —— 其中"同函数体有写链且无库确认"的那一子集被 B1 判据问责(走 `b1*` 自己的键,
 *      V1 的读数一字不动)。"布尔 ack 惯例不计红"这句现在只对**无写链**的那一半成立。
 *   V2 `readQueryCountSites` / `readQueryCountFiles` —— N2 那一族,复用同一份 sends 判据而不是另写
 *      正则(两处算同一件事必漂移):键为 `count` 且**函数体内没有任何批量写链**(有链而顺序不成立
 *      的那些已经落在 U1 未判定里,不重复计)。
 *   两型各计各的,**混计就等于没有信息**。口径与违规判据同面同轮,所以 U2(词法未闭合)那一份文件
 *   两份都不计 —— 该文件已在"未判定"清单里逐条点名,不会静默少掉。
 *   **锚点边界(不是漏判,是口径,扩面前先读这句)**:V1 只认 `.send(<X>success({ … }))` 这一个形态
 *   (键族扩面扩的是**信封里那一个对象**的键集,不是信封本身)。同族但形态不同的一律不进这一数 ——
 *   ① 裸 `return { … }`(legacy-ask / legacy-exam / zhs-legacy / tenant);② 不走 success 信封的
 *   OpenAI 兼容契约(v1-assistants);③ 代码生成器**模板字符串**里的该字样(gen-table,由遮蔽面排除,
 *   与 V1c 同一把锁);④ SCAN_DIRS 之外的落点(如 `apps/api/src/plugins/ws-chat.ts`)。
 *   上一轮人肉量的"257 处"就是这么来的:它按整串 grep 数整个 `apps/api/src`,把这四类全算进去了。
 *   要并掉①②④必须**同批改枚举表与判据两半**(§4 圆角那条记过只改一半 ⇒ 整块动静默失效而门照报绿),
 *   并另立键族;不得只放宽正则把一个数做大。
 *
 * 判不了 / 未判定(如实登记,绝不静默成"看起来全绿"):U1 链在 send 之后 ⇒ 顺序不成立,计入未判定
 * 并点名;U2 词法状态到文件末尾没闭合(疑正则字面量吞掉引号)⇒ 整份文件结论不可信 ⇒ 未判定,不冒红;
 * U3 写链在 db 层函数里、计数在路由 handler 里(如 workspace.ts 的 batchSoftDelete)⇒ 本门结构上
 * 看不见 —— 这是窄口径的代价,登记为已知空档,不得为覆盖它去猜跨函数归属。
 *
 * 口径纪律(与 36/70/77/83/93/98/101/103/118 同形):全量档判 **HEAD blob**、`--staged` 判**索引
 * blob**、`--worktree` 只作人工逃生舱、两面旗同给 ⇒ exit 2;清单与内容**同面同轮**;任一面取不到
 * ⇒ exit 2 显式"无法判定"且**不回落**另一个面;枚举到 0 个候选文件 ⇒ 判死,不记为通过。
 * **棘轮锚点 = 该文件 HEAD 自身的违规数** —— 只拦"这次改动把计数自算加回来了",存量不当场判红
 * (与改动无关的恒红门唯一结局是逼人 `--no-verify`,一次绕过等于全部守门作废,§12e)。
 * 取材走 `scripts/lib/face-reader.mjs` 的读取入口(catBatch / readWorktreeFile),枚举走 gitRaw
 * (ls-tree / ls-files 不产正文,不算散写读内容)。ROOT 由脚本自身位置推导(§15),`--root <dir>`
 * 是显式测试通道(换根后清单与内容仍同面,故无双根分裂)。
 *
 * 用法:node scripts/check-batch-write-count-honesty.mjs
 *   [--staged|--worktree] [--strict] [--explain] [--json] [--files a,b 或 --files a b] [--root <dir>] [--self-test]
 * 退出码:0 = 通过(或全量档只报数);1 = 判红;2 = 无法判定(不冒红也不记绿)。
 * **V1/V2 两份惯例存量计数不参与任何一档退出码**(含 --strict);--explain 会逐条点名它们的 file:line,
 * --json 在 counts 里追加 booleanAckSites/booleanAckFiles/readQueryCountSites/readQueryCountFiles
 * 四个新字段,既有字段名与取值形态逐字不变。
 * **B1 是判据不是可见性数**,自带一组 `b1*` 键进 counts 与退出码:staged 档走「该文件 HEAD 自身
 * B1 计数」的差值棘轮判红;全量档默认只报数、--strict 判红;--json 既有四个判据数
 * (candidates/violations/undetermined/exempt)的取值**逐字不变**(B1 不并入,只追加)。
 *
 * 本门**已接入提交链**(guardian-runner id 134,blocking,`stagedTriggers=apps/api/src/routes/` +
 * `apps/api/src/db/`):暂存档走「该文件 HEAD 自身 B1/违规计数」的差值棘轮判红。
 * 编号一律以 runner 现值为准,照本行派单前先 `grep -n "check-batch-write-count-honesty" scripts/guardian-runner.mjs`。
 * 应急跳过 HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY=1。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitBinary,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..') // ROOT 由脚本自身位置推导(§15,不写死盘符)

export const GATE = 'check-batch-write-count-honesty'
export const SELF_SKIP = 'HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY'
/** 覆盖面只有这两面(批量写的落点就在这里)。扩面必须同批改"枚举表 + 判据"两半 —— §4 记过同型。 */
export const SCAN_DIRS = ['apps/api/src/routes', 'apps/api/src/db']
export const EXEMPT_TOKEN = 'batch-count-exempt'
/** B1 的行内豁免族(守门 108 FAMILY_LIFETIME_DAYS 取 30 天:待偿的迁移债,不是结构性定性)。 */
export const DELETE_ACK_EXEMPT_TOKEN = 'delete-ack-exempt'
export const UNIQUE_OUTLET = 'utils/batch-outcome'
const WRITE_RECEIVERS = new Set(['db', 'tx', 'trx'])
const COUNT_KEYS = 'deleted|affected|restored|removed|count'
const FILE_RE = /\.(ts|mts|cts)$/
const SKIP_RE = /(^|\/)(?:tests?|__tests__|e2e)\//
const SPEC_RE = /(?:from|require\()\s*['"][^'"]*utils\/batch-outcome(?:\.js)?['"]/
// B1 放过通道 F1:同函数体内出现库确认调用。跑在**遮蔽后的代码面**上,所以注释/字符串里的
// `.returning(` 或 `batchWriteOutcome(` 不配放过(否则一句解释性注释就能给假 ack 发合格证)。
const RETURNING_IN_BODY_RE = /\.\s*returning\s*\(/
const BATCH_OUTCOME_IN_BODY_RE = /\bbatchWriteOutcome\s*\(/

/* ------------------------------- 词法遮噪 ------------------------------- */

/**
 * 剥注释(两档都剥);`blankStrings` 档另把字符串/模板字面量的内容与引号抹成空格。
 * 逐字符保位(换行原样),所以"遮蔽后的下标"仍能映射回原始行号 —— 行内豁免要吃原始行,靠这一点。
 * 为什么这一档要抹字符串:被抹掉的 token(inArray(、deleted: x.length)没有一个会合法地出现在
 * 字符串里;反过来保留字符串,一句 OpenAPI 描述就会替门产出一个"从字符串里 harvest 出来的假用量"
 * (守门 93 R6 正是栽在这一格)。唯一反例是 E2 的模块说明符 —— 它必须在字符串里才读得到。
 * 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
 * (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
 * @returns {{text:string, leaks:string[]}} leaks 非空 ⇒ 状态机没走干净(见 U2)
 */
export function maskText(src, { blankStrings = true } = {}) {
  const n = src.length
  const kill = new Uint8Array(n)
  const K = (i) => {
    if (blankStrings) kill[i] = 1
  }
  const stack = [{ kind: 'root', depth: 0 }]
  const leaks = []
  let lastSig = '' // 上一个有意义的代码字符:判 `/` 是除法还是正则开头
  let word = ''
  let i = 0
  while (i < n) {
    const top = stack[stack.length - 1]
    const c = src[i]
    const d = src[i + 1]
    if (top.kind === 'tpl') {
      if (c === '\\') {
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      if (c === '`') {
        stack.pop()
        K(i)
        lastSig = '`'
        i++
        continue
      }
      if (c === '$' && d === '{') {
        stack.push({ kind: 'interp', depth: 1 })
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      K(i)
      i++
      continue
    }
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && src[j] !== '\n') kill[j++] = 1
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) kill[j++] = 1
      if (j < n) {
        kill[j] = 1
        kill[j + 1] = 1
        i = j + 2
      } else {
        leaks.push('块注释未闭合')
        i = n
      }
      continue
    }
    // 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
    // (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
    if (c === '/' && regexMayStartHere(lastSig, word)) {
      const end = scanRegexLiteral(src, i)
      if (end > 0) {
        for (let j = i; j < end; j++) K(j)
        lastSig = '/'
        i = end
        continue
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1
      let closed = false
      while (j < n) {
        if (src[j] === '\\') {
          K(j)
          K(j + 1)
          j += 2
          continue
        }
        if (src[j] === '\n') break
        if (src[j] === c) {
          closed = true
          break
        }
        K(j)
        j++
      }
      if (closed) {
        K(i)
        K(j)
        lastSig = c
        i = j + 1
      } else {
        leaks.push(`第 ${lineAt(src, i)} 行的 ${c} 未闭合(疑正则字面量)`)
        i = j
      }
      continue
    }
    if (c === '`') {
      stack.push({ kind: 'tpl', depth: 0 })
      K(i)
      i++
      continue
    }
    if (top.kind === 'interp') {
      if (c === '{') top.depth++
      else if (c === '}') {
        top.depth--
        if (top.depth === 0) {
          stack.pop()
          K(i)
          i++
          continue
        }
      }
    }
    if (!/\s/.test(c)) {
      lastSig = c
      word = /[\w$]/.test(c) ? (word + c).slice(-12) : ''
    }
    i++
  }
  if (stack.length > 1) leaks.push(`模板/插值嵌套未收平(残留 ${stack.length - 1} 层)`)
  let out = ''
  for (let k = 0; k < n; k++) {
    const ch = src[k]
    out += kill[k] && ch !== '\n' && ch !== '\r' ? ' ' : ch
  }
  return { text: out, leaks }
}

function lineAt(src, idx) {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

const REGEX_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '>',
  '<',
  '+',
  '*',
  '%',
  '^',
  '~',
  '',
])
const REGEX_WORDS = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'do',
  'else',
  'yield',
  'await',
  'delete',
  'void',
])
function regexMayStartHere(lastSig, word) {
  return REGEX_WORDS.has(word) || lastSig === '' || REGEX_AFTER.has(lastSig)
}

/** 扫一个正则字面量(含字符类里的 `/` 与尾随 flag)。本行没有收尾的 `/` ⇒ 返回 -1,按普通字符走。 */
function scanRegexLiteral(src, i) {
  let j = i + 1
  let inClass = false
  let body = ''
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') {
      body += 'x'
      j += 2
      continue
    }
    if (c === '\n') return -1
    if (inClass) {
      if (c === ']') inClass = false
      body += c
      j++
      continue
    }
    if (c === '[') {
      inClass = true
      body += c
      j++
      continue
    }
    if (c === '/') {
      if (!body) return -1 // 空的 `//` 已在注释分支处理;`a / /` 之类不是正则
      let k = j + 1
      while (k < src.length && /[a-z]/i.test(src[k])) k++
      return k
    }
    body += c
    j++
  }
  return -1
}

/* ------------------------------- 结构扫描 ------------------------------- */

function closePair(src, openIdx, o, c) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === o) depth++
    else if (src[i] === c && --depth === 0) return i + 1
  }
  return -1
}
const closeParen = (s, i) => closePair(s, i, '(', ')')
const closeBrace = (s, i) => closePair(s, i, '{', '}')

/**
 * `db|tx|trx` 发起的 `.delete(` / `.update(` 调用链(逐链走括号,不按行切 —— 跨行写法实测存在)。
 * 接收者白名单是防误伤的第一道:实测 HEAD 面 `*.delete(` 里路由注册(server.delete)387 处、
 * Map/Set 的 .delete 上百处,远多于 `db.delete(` 242 处 —— 不认接收者就等于把路由注册当违规数。
 * 链上必须有 `.where(`(裸 `db.delete(table)` 全表删除不属本型);`opaque` 那支承认自己分不清。
 */
export function findWriteChains(code) {
  const out = []
  const re = /\.(delete|update)\s*\(/g
  let m
  while ((m = re.exec(code)) !== null) {
    const rec = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, m.index))
    if (!rec || !WRITE_RECEIVERS.has(rec[1])) continue
    const end0 = closeParen(code, code.indexOf('(', m.index))
    if (end0 < 0) continue
    const links = [{ name: m[1], text: code.slice(m.index + m[0].length, end0 - 1) }]
    let cur = end0
    for (;;) {
      const cm = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(code.slice(cur, cur + 80))
      if (!cm) break
      const open = cur + cm[0].length - 1
      const cend = closeParen(code, open)
      if (cend < 0) break
      links.push({ name: cm[1], text: code.slice(open + 1, cend - 1) })
      cur = cend
    }
    const whereLink = links.find((l) => l.name === 'where')
    const setLink = links.find((l) => l.name === 'set')
    // B7(G-815984)的取材:returning 实参原文 —— 与 whereText/setText 同源同批(links 只此一份,
    // B7 不二次扫描,§22c)。
    const returningLink = links.find((l) => l.name === 'returning')
    out.push({
      start: m.index,
      end: cur,
      receiver: rec[1],
      names: links.map((l) => l.name),
      hasWhere: links.some((l) => l.name === 'where'),
      hasInArray: links.some((l) => /\binArray\s*\(/.test(l.text)),
      hasReturning: links.some((l) => l.name === 'returning'),
      opaque: links.some((l) => /=>|\bfunction\b/.test(l.text)),
      // B3/B4(G-815953/G-815956)的取材:where/set 各自的实参原文(遮蔽面上的)。
      // 与 hasWhere/hasReturning 同源 —— links 只此一份,不存在第二份链扫描(§22c)。
      whereText: whereLink ? whereLink.text : '',
      setText: setLink ? setLink.text : '',
      returningText: returningLink ? returningLink.text : '',
    })
  }
  return out
}

/**
 * 函数体 = `=>` 后紧跟 `{`,或 `function` 头部之后的第一个顶层 `{`。
 * 为什么必须是函数体而不是"任意最小花括号块":取"同时包住链与 send 的最小块"会让兄弟 handler
 * 互相借链(A 里的链替 B 里的 send 定罪)—— 那等于把判据建立在花括号几何上。
 */
export function findFunctionBodies(code) {
  const bodies = []
  const push = (b) => {
    if (b >= 0 && code[b] === '{') {
      const end = closeBrace(code, b)
      if (end > 0) bodies.push({ start: b, end })
    }
  }
  let m
  const arrow = /=>/g
  while ((m = arrow.exec(code)) !== null) {
    const rest = /^\s*\{/.exec(code.slice(m.index + 2, m.index + 12))
    if (rest) push(m.index + 2 + rest[0].length - 1)
  }
  const fn = /\bfunction\b/g
  while ((m = fn.exec(code)) !== null) {
    let i = m.index + 8
    while (i < code.length && code[i] !== '{' && code[i] !== ';' && code[i] !== '}') i++
    push(i)
  }
  return bodies
}

function enclosingBody(bodies, idx) {
  let best = null
  for (const b of bodies)
    if (idx >= b.start && idx < b.end && (!best || b.start > best.start)) best = b
  return best
}

const DB_CONFIRMED_RE =
  /\.(?:returning|select|execute|insert|update|delete)\s*\(|\bawait\s+[\w$.]*\bdb\b|dbRead|dbWrite/
const CONTINUE_CHARS = new Set([
  '.',
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '?',
  ':',
  ')',
  '}',
  ']',
  '=',
  '<',
  '>',
  '`',
])
const NOT_IDENT = new Set([
  'const',
  'let',
  'var',
  'await',
  'async',
  'return',
  'if',
  'else',
  'for',
  'of',
  'in',
  'new',
  'map',
  'filter',
  'from',
  'where',
  'and',
  'or',
  'eq',
  'inArray',
  'set',
  'then',
  'length',
  'ids',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'JSON',
  'Math',
  'Date',
  'size',
  'join',
  'split',
  'includes',
  'some',
  'every',
  'push',
])

/** 语句结尾:深度 0 处的 `;`,或深度 0 处换行且下一行不是续行。 */
function statementEnd(code, from, limit) {
  let depth = 0
  for (let i = from; i < limit; i++) {
    const c = code[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth > 0) depth--
    } else if (c === ';' && depth === 0) return i
    else if (c === '\n' && depth === 0) {
      let k = i + 1
      while (k < limit && /\s/.test(code[k])) k++
      if (k >= limit || !CONTINUE_CHARS.has(code[k])) return i
    }
  }
  return limit
}

function initializersOf(code, span, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g')
  const out = []
  let m
  while ((m = re.exec(code)) !== null) {
    if (m.index < span.start || m.index >= span.end) continue
    const eq = m.index + m[0].length - 1
    out.push(code.slice(eq + 1, statementEnd(code, eq + 1, span.end)))
  }
  return out
}

/** E1b:计数根标识符是否可追到库确认的集合(≤2 跳)。查不到声明 ⇒ 不放过(参数/请求侧解构都是这种)。 */
function resolveConfirmed(code, span, name, depth) {
  if (depth > 2) return false
  for (const rhs of initializersOf(code, span, name)) {
    if (rhs.length > 4000) continue
    if (DB_CONFIRMED_RE.test(rhs)) return true
    if (depth >= 2) continue
    for (const mm of rhs.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (!NOT_IDENT.has(mm[0]) && resolveConfirmed(code, span, mm[0], depth + 1)) return true
    }
  }
  return false
}

/** `.send(<X>success({ … }))` 的对象字面量 —— 违规判据与两份惯例计数**共用这一遍取材**。
 *  为什么必须共用:两处各扫一遍 send 形态,一处改了另一处不会跟着改,惯例数就会和违规数说不同的话
 *  (本仓"两处算同一件事必须共用一份实现"记过多次)。 */
function* sendSuccessObjects(code) {
  const sendRe = /\.\s*send\s*\(\s*\w*[Ss]uccess\s*\(\s*\{/g
  let m
  while ((m = sendRe.exec(code)) !== null) {
    const objOpen = code.indexOf('{', m.index + m[0].length - 1)
    const objEnd = closeBrace(code, objOpen)
    if (objEnd < 0) continue
    yield { objOpen, objText: code.slice(objOpen, objEnd) }
  }
}

/** `.send(<X>success({ … <键族成员>: true … }))` 的**布尔 ack** 落点(V1 可见性计数 + B1/B2 判据的
 *  共用取材)。窄到形态才算:键名必须**逐字等于键族成员**(故 `isDeleted:` / `deleted_count:` 不纳)、
 *  值逐字是布尔字面量(故 `deleted: affected` / `rows.length` 不纳 —— 那一型归计数判据)、
 *  值后必须紧跟 `,` 或 `}`(故"字面量后面还接着算式或更长的标识符"不纳)。
 *  2026-09-27 扩面:键族从单一眼 `deleted` 扩到 BOOL_ACK_KEYS 五键 —— 病灶是"同一形状换个键名即隐身",
 *  **每个键各计各的**(报表按键分组),因为 `restored` 是软删撤销、`cleared` 是整片重置,与 `deleted`
 *  的语义并不相同,混成一个数就等于没有信息。 */
/** 布尔写 ack 的**键族**(2026-09-27 第二十九批扩面:判据的布尔档此前只认第一个键,于是
 *  "同一形状换个键名"就整型隐身 —— 本仓最高频的失效型之一。键族取自 COUNT_KEYS 的写法但**不复用
 *  那个常量**:两处语义不同(那一张是"自算计数的值",这一张是"布尔 ack 的承诺"),而且键集并不相同
 *  (计数面有 affected/count 而无 revoked/cleared;布尔面无这两键而有三个新键),合并就等于混计。
 *  **单一真相**:判据正则、按键分组的报表、结论行的逐键点名三处都由这一个数组派生 —— 下游再抄一份
 *  硬编码名单就是第二真相,自检 K0 用一份**独立写死的**期望表对账它(名单被削短 ⇒ 当场红)。 */
export const BOOL_ACK_KEYS = Object.freeze(['deleted', 'removed', 'restored', 'revoked', 'cleared'])
/** 每个键**可能**由哪一种写动词应答(只给 B2 的被调体用:B2 的 ack 由**另一个函数**答复,而被调体
 *  可以同时做两件写事 —— 实测 `detachTag` 先 `delete … .returning()` 再 `update`(计数递减),按旧口径
 *  "任一链缺 returning 即违规"会把这一处**已诚实**的委托判红(恒红门的唯一结局是逼人 --no-verify,§12e)。
 *  B1 **刻意不做这一层筛选**:调用方体内任何 db 写都算"这一屏真发了写",筛动词等于把 `deleted` 那一族
 *  现有的判据削弱(镜像/自检里"update 链同判"那条用例钉着它)。表里没有的键 ⇒ 不筛选(退回旧口径)。 */
export const BOOL_ACK_KEY_VERBS = Object.freeze({
  deleted: Object.freeze(['delete']),
  removed: Object.freeze(['delete']),
  cleared: Object.freeze(['delete']),
  restored: Object.freeze(['update']),
  revoked: Object.freeze(['update', 'delete']),
})
const BOOL_ACK_RE = new RegExp(`[{,]\\s*(${BOOL_ACK_KEYS.join('|')})\\s*:\\s*true\\s*(?=[,}])`, 'g')
export function findBooleanAckSends(code) {
  const out = []
  for (const { objOpen, objText } of sendSuccessObjects(code)) {
    BOOL_ACK_RE.lastIndex = 0
    let k
    while ((k = BOOL_ACK_RE.exec(objText)) !== null)
      out.push({
        index: objOpen + k.index + k[0].indexOf(k[1]),
        key: k[1],
        value: 'true',
        objText,
      })
  }
  return out
}

/**
 * 同响应对象里是否**另有一枚诚实的行数载体**(2026-09-27,第二十九批:认"证据在别处"的第四型)。
 * 病灶形状是 `{ cleared: true, deleted, prefix }` —— 布尔档不承诺行数,受影响键数由同一份响应里那枚
 * 行数键诚实承载(实测它的值就是库里 `del` 命令的答复),所以把布尔档当"谎报删了几行"判红就是误伤。
 * **刻意只认 ES6 简写**(键名后不接冒号 ⇒ 值就是与键同名的那个变量):
 *  - 带冒号那一支(`x: 某个标识量`)**可以被凭空捏造** —— 随便写一个不相干的同名标识符就洗白了,
 *    而简写要求调用方真有一个同名变量在别处被赋过值,那道赋值就在同一份文件里,要滥用得连变量一起编,
 *    成本与直接写诚实实现相当(判据的失效方向必须是"更难作弊",不是"更容易作弊");
 *  - 实测唯一的诚实形状(agents.ts 那一处)恰好是简写,所以收窄**不损失任何真站点**(现读见自检 K7/K8)。
 * @returns {null | {key:string}}
 */
export function findHonestCarrierSibling(objText) {
  // 键名后直接跟 `,` 或 `}` ⇒ 简写形态;带冒号的那一支结构上匹配不到。
  const m = /[,{]\s*(deleted|affected|restored|removed|revoked|cleared|count)\s*(?=[,}])/.exec(
    objText,
  )
  return m ? { key: m[1] } : null
}

/**
 * 原始 SQL 文本里的 `RETURNING`(2026-09-27,第二十九批:认"证据在别处"的第二型)。
 * `db.execute(sql\`DELETE … RETURNING id\`)` 走的是 drizzle 的原生 SQL 通道 —— 模板串在**遮蔽后的代码面**
 * 上被抹成空格,所以既有 F1 的 `.returning(` 永远看不见这条库答复。这里改在"剥注释、**保留字符串**"
 * 那一档上按同一下标窗口读 execute 调用的原文,只认落在该次调用括号内的 RETURNING 关键字
 * (注释里提一句 RETURNING 不配放过 —— 与"注释里的 .returning( 不算"同一条规矩,由 K-raw② 钉住)。
 */
/**
 * **裸 SQL 写链**(2026-09-27 第三十批):`db.execute(sql\`DELETE FROM …\`)` 这一族**就是一条写**。
 *
 * 立因(普查实测,不是假想):HEAD 面 `apps/api/src` 的 raw-SQL 写共 90 处(括号可解析的那一档),
 * 其中两处被逐体读成病灶 ——
 *   ① `routes/user-llm-configs-v2.ts` PUT `/llm-providers/:pid/models/:mid`:UPDATE **不带 RETURNING**
 *      而响应无条件回 `updated: true`,且 `sets.length===1` 那一支**整趟事务没发任何写**也回 true;
 *   ② `routes/ai-extended.ts` PUT `/model-info/:id`:`UPDATE … RETURNING *` 的命中集为空(id 不存在)时
 *      走 `?? { id, updated: true }` 兜底 —— 库答复就在手上却没据它判定。
 * 旧口径**只把 `db|tx|trx` 上的 drizzle 方法链当写链**,raw SQL 只被当"放过的证据"(RETURNING 字样),
 * 所以 B1/B2/V 三条判据对这一格全体失明。本函数把"写"这一维补齐,`hasRawSqlReturning` 改为它的投影
 * (两处各写一份 SQL 解析必然漂移 —— 本仓为这条记过多次)。
 *
 * 判"是不是写"用**搭配式**而非裸关键字:`DELETE\s+FROM` / `UPDATE\s+"?[A-Za-z_]` / `INSERT\s+INTO` /
 * `TRUNCATE\s+TABLE`。理由:SELECT 语句里完全可能出现大写 `'UPDATE'` 这样的**值**(审计表的 action 列),
 * 只认 `\bUPDATE\b` 会把读查询判成写链 = 假阳,而假阳比漏报贵(它指使人去"修"没坏的东西)。
 * `${…}` 插值先剥成 `?`,不拿 JS 表达式里的标识符当 SQL 关键字。
 *
 * @returns {{chains:Array<{start:number,end:number,receiver:string,hasReturning:boolean,
 *            hasWhere:boolean,hasInArray:boolean,rawSql:true,opaque:false,sqlText:string}>,
 *            unparsed:Array<{index:number}>}}
 *   `unparsed` = 括号配平不到的 execute 调用(判不了它的动词与 RETURNING)⇒ 由调用方按"未判定"点名,
 *   **既不冒红也不静默算通过**。`sqlText` = 剥掉 `${…}` 插值后的语句原文(B3 裸 SQL 维的取材)。
 */
export function findRawSqlWriteChains(nonBlankCode) {
  const chains = []
  const unparsed = []
  const re = /\b([A-Za-z_$][\w$]*)\s*\.\s*execute\s*\(/g
  let m
  while ((m = re.exec(nonBlankCode)) !== null) {
    const receiver = m[1]
    if (!WRITE_RECEIVERS.has(receiver)) continue
    const open = nonBlankCode.indexOf('(', m.index + m[0].length - 1)
    const end = open >= 0 ? closeParen(nonBlankCode, open) : -1
    if (end < 0) {
      unparsed.push({ index: m.index })
      continue
    }
    const call = nonBlankCode.slice(open, end)
    // SQL 正文:execute 的实参通常包一层 sql`…` 模板 —— 把模板体剥出来当正文,锚定判词(如 B3 的
    // /^\s*UPDATE/)才有干净的开头;没有模板包装的实参按原文走。对既有的非锚定判词(写动词/WHERE/
    // RETURNING)无影响 —— 它们本就不锚定开头。
    const bt0 = call.indexOf('`')
    const sqlBody = bt0 >= 0 && call.lastIndexOf('`') > bt0 ? call.slice(bt0 + 1, call.lastIndexOf('`')) : call
    const sqlish = sqlBody.replace(/\$\{[^{}]*\}/g, ' ? ')
    // 尾部的 `\b` 曾把这一判据**整体打死**:`UPDATE\s+"?[A-Za-z_]` 后面紧跟标识符的第二个字母 ⇒ 不是词边界 ⇒
    // 真仓 HEAD 上 4 条 `UPDATE ai_model_config_*` 全部不被认出(阳性对照量出来的,见镜像 M23 与自检 K4b)。
    if (!/\b(?:DELETE\s+FROM|UPDATE\s+"?[A-Za-z_]|INSERT\s+INTO|TRUNCATE\s+TABLE)/.test(sqlish))
      continue
    chains.push({
      start: m.index,
      end,
      receiver,
      hasReturning: /\bRETURNING\b/i.test(sqlish),
      hasWhere: /\bWHERE\b/i.test(sqlish),
      hasInArray: /\bIN\s*\(/i.test(sqlish) || /\binArray\s*\(/.test(call),
      rawSql: true,
      opaque: false,
      // B3 裸 SQL 维的取材:同一份 sqlish(插值已剥成 ?),不二次扫描(§22c)。
      sqlText: sqlish,
    })
  }
  return { chains, unparsed }
}

/** 原始 SQL 的 RETURNING 证据:`findRawSqlWriteChains` 的投影(单一实现,见上)。 */
export function hasRawSqlReturning(nonBlankCode, bodyStart, bodyEnd) {
  return findRawSqlWriteChains(nonBlankCode).chains.some(
    (c) =>
      c.hasReturning && c.start >= bodyStart && c.start < bodyEnd && (c.opaque ? false : true),
  )
}

/**
 * B1(2026-09-27):布尔 ack 中**可判的那一子集** —— 同一函数体内有 `db|tx|trx` 的 `.delete(`/`.update(`
 * 写链、且体内无库确认(`.returning(` / `batchWriteOutcome(`)、且命中行无带原因豁免 ⇒ 假 ack 违规。
 *
 * 三条设计决定,每条都有用例钉住(改任何一条前先读它的反例):
 *  ① **落点取材与 V1 共用 `findBooleanAckSends`**(同一处 `sendSuccessObjects` 扫描,扫描式在源码里
 *    只许出现一次 —— M13 的单点锁同时管住这一族)—— 两处各扫
 *    一遍 send 形态,一处改了另一处不跟着改,惯例数和判据数就会说不同的话(§"两处算同一件事"教训);
 *    也因此 B1 结构上只会看见**响应对象面**里的 `deleted: true`,select 映射 / 类型注解 / 注释 /
 *    字符串里的同字样不进面(判据不退化成整行 grep)。
 *  ② **函数体而不是"最小花括号块"**(沿用 findFunctionBodies 的理由):取最小块会让兄弟 handler
 *    互相借链 —— A 里的 delete 替 B 里的 ack 定罪/发合格证,判据就建立在花括号几何上了。
 *  ③ **写链不要求 inArray/.where**:计数判据问"affected 怎么算的",B1 只问"这一屏是否真发了写并
 *    无条件回已删";opaque 链(混进函数字面量、U0 那一型)在这里**照算写链** —— 接收者是 db|tx|trx、
 *    动词是 delete/update 这一点不受参数里有什么影响,分不清的是命中数而不是"有没有写"。
 * 找不到所属函数体的布尔 ack 记 `noBodySites`(不判红也不记绿 —— 静默跳过就是这一族门最常犯的假绿)。
 */
export function findBoolAckB1Sites(
  relPath,
  code,
  rawLines,
  allChains = null,
  ackSites = null,
  nonBlankCode = null,
  rawPool = null,
) {
  const bodies = findFunctionBodies(code)
  const chains = allChains || findWriteChains(code)
  // 裸 SQL 写链(第三十批):与 drizzle 链**同一条判据、同一份取材**,只是写住在模板串里。
  const rawChains = (rawPool || findRawSqlWriteChains(nonBlankCode || '')).chains
  const out = {
    file: relPath,
    candidates: [],
    violations: [],
    exempt: { confirmed: 0, marker: 0 },
    bareExempt: 0,
    noBodySites: [],
  }
  for (const b of ackSites || findBooleanAckSends(code)) {
    const line = lineAt(code, b.index)
    const body = enclosingBody(bodies, b.index)
    if (!body) {
      out.noBodySites.push({ file: relPath, line })
      continue
    }
    const chain =
      chains.find((c) => c.start >= body.start && c.end <= body.end) ||
      // 体里没有 drizzle 链时,才看裸 SQL:**不带 RETURNING** 的那一条才算写
      // (带 RETURNING 的已由 hasRawSqlReturning 当库答复证据放过,两种形状不重复计账)。
      rawChains.find(
        (c) => !c.hasReturning && c.start >= body.start && c.end <= (body.end ?? 1 << 30),
      )
    if (!chain) continue // 同函数体无写链(含裸 SQL 那一维):纯惯例面(V1 已计),B1 不判
    const site = { file: relPath, line, key: b.key, receiver: chain.receiver }
    if (chain.rawSql) site.via = 'raw-sql'
    out.candidates.push(site)
    const bodyText = code.slice(body.start, body.end)
    if (RETURNING_IN_BODY_RE.test(bodyText) || BATCH_OUTCOME_IN_BODY_RE.test(bodyText)) {
      site.disposition = 'db-confirmed'
      out.exempt.confirmed++
      continue
    }
    // 放过通道之二/之三(2026-09-27 第二十九批,认"证据在别处"):原始 SQL 的 RETURNING 与同响应里的
    // 诚实行数载体。两者都**折进 confirmed 这一桶**(与 F1 同族:它们说的是"库答复在别处已存在",
    // 不是"有人给了豁免"),所以 b1*/b2* 的既有键与取值形态一字不变;具体是哪一种由 confirmWhy 带出,
    // 复核 --explain 时才分得开 —— "放过"与"没看见"必须能各自被问到。
    if (nonBlankCode && hasRawSqlReturning(nonBlankCode, body.start, body.end)) {
      site.disposition = 'db-confirmed'
      site.confirmWhy = 'raw-sql-returning'
      out.exempt.confirmed++
      continue
    }
    const carrier = findHonestCarrierSibling(b.objText || '')
    if (carrier) {
      site.disposition = 'db-confirmed'
      site.confirmWhy = `sibling-carrier:${carrier.key}`
      out.exempt.confirmed++
      continue
    }
    // F2 只命中本行生效(刻意比 batch-count-exempt 的"本行或紧邻上一行"严一档,见头注 F2)。
    const mk = readExemptMarker(rawLines[line - 1] || '', DELETE_ACK_EXEMPT_TOKEN)
    if (mk.state === 'ok') {
      site.disposition = 'marker'
      out.exempt.marker++
      continue
    }
    if (mk.state === 'bare') out.bareExempt++
    site.disposition = 'violation'
    out.violations.push(site)
  }
  return out
}

/** `.send(<X>success({ … <key>: <点号链>.length … }))` 的每一处落点。 */
export function findCountSends(code) {
  const value = String.raw`[A-Za-z_$][\w$]*(?:\s*(?:\?\.|\.\s*[A-Za-z_$][\w$]*|\[[^\]]*\]|\([^)]*\)))*\s*(?:\?\.|\.)\s*length\b`
  const keyRe = new RegExp(`\\b(${COUNT_KEYS})\\s*:\\s*(${value})`, 'g')
  const out = []
  for (const { objOpen, objText } of sendSuccessObjects(code)) {
    keyRe.lastIndex = 0
    let k
    while ((k = keyRe.exec(objText)) !== null) {
      const nxt = /^\s*(.)/.exec(objText.slice(k.index + k[0].length))
      // `deleted: ids.length > 0` / `… .length + 1` 是布尔或算式,不是自算计数(N1 那一族)。
      if (nxt && nxt[1] && /[<>!=+*/%&|?-]/.test(nxt[1])) continue
      out.push({ index: objOpen + k.index, key: k[1], expr: k[2].replace(/\s+/g, '') })
    }
  }
  return out
}

/**
 * 行内豁免 `<token>: <原因>`(两条通道共用这一份实现 —— 各写一份"须带原因"的判法必然漂移):
 * `batch-count-exempt`(计数判据,本行或紧邻上一行)与 `delete-ack-exempt`(B1,只本行,调用方决定)。
 * 两件事各堵一个洞 —— 原因由注释闭合符冒充(先剥尾随闭合符与前导星号再判空,门 102 的 GA1
 * 就漏在这一格);把标记写进字符串冒充(判"标记之前是否有注释起始符")。
 * @returns {{state:'none'|'ok'|'bare', reason:string}}
 */
export function readExemptMarker(rawLine, token = EXEMPT_TOKEN) {
  const at = rawLine.indexOf(`${token}:`)
  const idx = at >= 0 ? at : rawLine.indexOf(`${token} :`)
  if (idx < 0) return { state: 'none', reason: '' }
  const head = rawLine.slice(0, idx)
  if (!/(?:^|[^\S\n])(?:\/\/|\/\*|\*)/.test(head)) return { state: 'none', reason: '' }
  const rest = rawLine
    .slice(idx + token.length + 1)
    .replace(/\*\/\s*$/, '')
    .replace(/^[:*\s]+/, '')
    .trim()
  return rest ? { state: 'ok', reason: rest } : { state: 'bare', reason: '' }
}

/* ------------------------- B2:一跳委托的删除 ack ------------------------- */

/** 被调文件的解析域:只有 apps/api/src 之内的模块算"本仓一跳"(实测量够、也能按同一面取到)。 */
export const API_SRC_DIR = 'apps/api/src'
/** apps/api/tsconfig.json 的 compilerOptions.paths 实测声明 `"@/*": ["./src/*"]`。
 *  HEAD 面 `apps/api/src` 内 `from '@/'` 用量 0 处 —— 认它不是为了数现在的东西,而是为了让
 *  "下一次有人改用别名"不被读成"解析不到";解析表只这一条别名,不臆造第二条。 */
const ALIAS_AT = '@/'
const TS_EXT_LIST = ['.ts', '.mts', '.cts']
const JS_TO_TS = { '.js': '.ts', '.mjs': '.mts', '.cjs': '.cts' }

function posixDirname(p) {
  const i = p.lastIndexOf('/')
  if (i < 0) return ''
  const d = p.slice(0, i)
  return d === '' ? '.' : d
}

/** 只按 `/` 走(git 给的路径恒是正斜杠);不引 node:path,免得 Windows 反斜杠把清单里的路径改弯。 */
function posixJoin(base, rel) {
  const segs = (base === '' || base === '.' ? [] : base.split('/')).concat(rel.split('/'))
  const out = []
  for (const s of segs) {
    if (s === '' || s === '.') continue
    if (s === '..') out.pop()
    else out.push(s)
  }
  return out.join('/')
}

/**
 * import 说明符 → 候选模块路径(相对 / `@/` 别名 / `.js`→`.ts` / 目录 index)。
 * 返回 `{outside:true}` = 裸包名(fastify、zod、@ihui/database、node:*)⇒ 被调函数在 apps/api/src
 * 之外,按 N1 落未判定;返回 `{candidates:[…]}` = 交给所判面的文件清单去验(解析不到同样落 N1)。
 */
export function moduleSpecCandidates(spec, fromFile) {
  const clean = String(spec).trim().replace(/\\/g, '/')
  if (!clean) return { outside: true }
  let base = null
  if (clean.startsWith(ALIAS_AT)) base = `${API_SRC_DIR}/${clean.slice(ALIAS_AT.length)}`
  else if (clean === '.' || clean === '..' || clean.startsWith('./') || clean.startsWith('../'))
    base = posixJoin(posixDirname(fromFile), clean)
  else return { outside: true }
  if (base !== API_SRC_DIR && !base.startsWith(`${API_SRC_DIR}/`)) return { outside: true }
  const m = /\.([A-Za-z0-9]+)$/.exec(base)
  const mapped = m ? JS_TO_TS[`.${m[1]}`] : undefined
  const alreadyTs = m ? TS_EXT_LIST.includes(`.${m[1]}`) : false
  // 把"扩展名替换"落成"去掉旧扩展名再逐个试 TS 三扩展":mapped 是**扩展名本身**,不是整路径
  // (第一版直接把它当 stem 用,候选就成了 `.ts.ts` 这种谁也找不到的东西 ⇒ 整族未判定)。
  const stem = m && (mapped || alreadyTs) ? base.slice(0, m.index) : base
  const out = []
  for (const e of TS_EXT_LIST) {
    out.push(stem + e)
    out.push(`${stem}/index${e}`)
  }
  // 末尾那段既不是 js 族也不是 ts 族(.json / .node / 无扩展名歧义)⇒ 原样也试一次,
  // 落在"面里有但不是可解析 TS 模块"那一档,而不是悄悄猜成 .ts。
  if (m && !mapped && !alreadyTs) out.push(base)
  return { candidates: out }
}

/** 在**同一面**的文件清单里挑第一个命中的候选;都不在 ⇒ 未判定(unresolved-spec)。 */
function resolveModuleSpec(spec, fromFile, knownPaths) {
  const r = moduleSpecCandidates(spec, fromFile)
  if (r.outside) return { kind: 'outside-src' }
  for (const c of r.candidates) {
    if (!knownPaths || !knownPaths.has(c)) continue
    return TS_EXT_LIST.some((e) => c.endsWith(e)) ? { path: c } : { kind: 'non-ts-module' }
  }
  return { kind: 'unresolved-spec' }
}

/**
 * import/export ... from '…' 的具名绑定表。跑在**保留字符串**那一档(模块说明符只活在那里,
 * 与 E2 同一条教训:连字符串一起抹会直接失明),但**起始位必须同时在遮蔽后的代码面上** ——
 * 否则一段模板字符串里的 "import x from 'y'" 就能凭空造出一条委托边。
 * 只收具名绑定:`import * as ns` 记进 namespaces(N1 未判定),default / type-only 一律不认作可调用边。
 */
const IMPORT_FROM_RE = /\b(?:import|export)\s+([\s\S]*?)\bfrom\s*['"]([^'"]*)['"]/g
export function parseImportBindings(nonBlankText, blankText) {
  const named = new Map()
  const namespaces = new Set()
  let m
  IMPORT_FROM_RE.lastIndex = 0
  while ((m = IMPORT_FROM_RE.exec(nonBlankText)) !== null) {
    if (blankText[m.index] !== nonBlankText[m.index]) continue // 起始位落在字符串/注释里 ⇒ 不是语句
    const clause = m[1]
    const spec = m[2]
    if (/^\s*type\b/.test(clause)) continue
    const rest = clause
      .replace(/\{[\s\S]*\}/, '')
      .replace(/\s+/g, ' ')
      .trim()
    const ns = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(rest)
    if (ns) namespaces.add(ns[1])
    const brace = /\{([\s\S]*)\}/.exec(clause)
    if (!brace) continue
    for (const part of brace[1].split(',')) {
      const t = part.trim()
      if (!t || /^type\b/.test(t)) continue
      const mm = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t)
      if (!mm) continue
      if (!named.has(mm[2] || mm[1]))
        named.set(mm[2] || mm[1], { exported: mm[1], specifier: spec })
    }
  }
  return { named, namespaces }
}

/** 体内 `await foo(...)` / `await ns.foo(...)` 的被调表达式(不含 `await db.delete()` 那种链)。 */
const AWAIT_CALL_RE = /\bawait\s+([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*(?:[<(]|as\s)/g

/**
 * 被调文件的导出索引(跑在遮蔽后的代码面上:注释里的 `// export async function del()` 不得算导出)。
 *  byName        函数形态的具名导出 → { bodyText }
 *  starReexport  文件里有 `export * from …`  ⇒ 名单不可枚举 ⇒ N1 未判定
 *  reexportNames `export { A } from …` 的再导出名(同样不当作"本体的函数体")
 */
export function indexExportedFns(code, nonBlankCode = null) {
  const byName = new Map()
  // 两档面**逐字符同位**(maskText 只抹字符不改长度)⇒ 遮蔽面上算出的范围切"保留字符串"那一档
  // 就是同一个函数体的原文。判据(B2 第二遍)仍只读 bodyText;rawBodyText 是给
  // measureB2RawSqlTrigger(票 守门134 触发条件测量)预留的取材口 —— 头注"已知空档①"里
  // "indexExportedFns 需同时收'保留字符串'那一档正文"说的就是这一行,接维时不必再改索引。
  const put = (name, start, end) => {
    const e = { bodyText: code.slice(start, end) }
    if (nonBlankCode) e.rawBodyText = nonBlankCode.slice(start, end)
    byName.set(name, e)
  }
  const reexportNames = new Set()
  let starReexport = false
  let m
  const fnRe = /\bexport\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g
  while ((m = fnRe.exec(code)) !== null) {
    const open = code.indexOf('(', m.index + m[0].length - 1)
    const close = open >= 0 ? closeParen(code, open) : -1
    if (close < 0) continue
    let i = close
    while (i < code.length && code[i] !== '{' && code[i] !== ';' && code[i] !== ')') i++
    const end = closeBrace(code, i)
    if (end > 0 && !byName.has(m[1])) put(m[1], i, end)
  }
  const varRe = /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g
  while ((m = varRe.exec(code)) !== null) {
    if (byName.has(m[1])) continue
    const from = m.index + m[0].length
    const slice = code.slice(from, from + 400)
    const block = /^(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/.exec(slice)
    if (block) {
      const bi = from + block[0].length - 1
      const end = closeBrace(code, bi)
      if (end > 0) {
        put(m[1], bi, end)
        continue
      }
    }
    const expr = /^(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.exec(slice)
    if (expr) {
      const s0 = from + expr[0].length
      put(m[1], s0, statementEnd(code, s0, code.length))
      continue
    }
    const kf = /^function\b/.exec(slice)
    if (kf) {
      let i = from + kf[0].length
      while (i < code.length && code[i] !== '{') i++
      const end = closeBrace(code, i)
      if (end > 0) put(m[1], i, end)
    }
  }
  const namedRe = /\bexport\s*\{([\s\S]*?)\}\s*from/g
  while ((m = namedRe.exec(code)) !== null)
    for (const p of m[1].split(',')) {
      const t = p.trim().replace(/^type\s+/, '')
      const mm = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t)
      if (mm) reexportNames.add(mm[2] || mm[1])
    }
  if (/\bexport\s*\*\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?from/g.test(code)) starReexport = true
  return { byName, reexportNames, starReexport }
}

/**
 * 被调函数体的定性:有没有"带 where 而无 returning、也无唯一出口"的那一条写链。
 * 2026-09-27 第二十九批:带上 **ack 键** 再筛一道写动词(理由见 BOOL_ACK_KEY_VERBS 旁注释)——
 * 委托体常做两件写事(实测 `detachTag`:先 `delete … .returning()` 拿命中集、再把计数列 -1),
 * 布尔档回答的是前一件。筛完**没有该动词的链** ⇒ 不筛(退回旧口径),所以这一层只会少误伤、
 * 不会给"根本没做过那次写"的形状发合格证;摘掉 `.returning(` 之后该动词只剩无答复的那一条 ⇒ 照样红。
 */
function classifyCalleeBody(bodyText, ackKey = '') {
  if (BATCH_OUTCOME_IN_BODY_RE.test(bodyText))
    return { state: 'confirmed', why: 'batchWriteOutcome' }
  const chains = findWriteChains(bodyText).filter((c) => c.hasWhere)
  if (!chains.length) return { state: 'no-write' }
  const verbs = BOOL_ACK_KEY_VERBS[ackKey]
  const scoped = verbs ? chains.filter((c) => verbs.includes(c.names[0])) : []
  const scope = scoped.length ? scoped : chains
  if (scope.some((c) => !c.hasReturning && !c.opaque)) return { state: 'violation' }
  if (scope.every((c) => c.opaque)) return { state: 'undetermined', kind: 'opaque-callee-chain' }
  return { state: 'confirmed', why: 'returning' }
}

/**
 * B2 的第一遍:纯本地信息(调用方正文 + 同面文件清单)⇒ 每个待判 ack 记下"要读哪个被调文件"。
 * 刻意不调 git —— 自检可以只给一张 knownPaths 与一份被调正文就跑完整条判据(判据只此一份实现)。
 */
export function planDelegatedAckSites(
  relPath,
  code,
  rawLines,
  ackSites,
  allChains,
  imports,
  knownPaths,
  nonBlankCode = null,
) {
  const bodies = findFunctionBodies(code)
  const sites = []
  const needs = []
  for (const b of ackSites) {
    const body = enclosingBody(bodies, b.index)
    if (!body) continue // 解析不出函数体那一格归 B1 的 noBodySites,两道判据不重复计同一处
    if (allChains.some((c) => c.start >= body.start && c.end <= body.end)) continue // 归 B1
    const bodyText = code.slice(body.start, body.end)
    const line = lineAt(code, b.index)
    const site = {
      file: relPath,
      line,
      // ack 键必须带上:被调体的写动词筛选(BOOL_ACK_KEY_VERBS)按它判,缺了就等于把
      // "委托体做了两件写事"的诚实形状按最严的那一条定罪。
      key: b.key,
      needs: [],
      undetermined: [],
      marker: readExemptMarker(rawLines[line - 1] || '', DELETE_ACK_EXEMPT_TOKEN),
    }
    // 与 B1 同两条"证据在别处"的放过通道:调用方体内自己就带着库答复(raw SQL 的 RETURNING),
    // 或同一份响应里另有诚实的行数载体 —— 这一跳就没必要再去被调体里找罪证。
    if (nonBlankCode && hasRawSqlReturning(nonBlankCode, body.start, body.end)) {
      site.confirmedBy = 'raw-sql-returning'
      sites.push(site)
      continue
    }
    const carrier = findHonestCarrierSibling(b.objText || '')
    if (carrier) {
      site.confirmedBy = `sibling-carrier:${carrier.key}`
      sites.push(site)
      continue
    }
    AWAIT_CALL_RE.lastIndex = 0
    let m
    while ((m = AWAIT_CALL_RE.exec(bodyText)) !== null) {
      const parts = m[1].split(/\s*\.\s*/)
      const base = parts[0]
      if (parts.length > 1) {
        // `await ns.del()`:命名空间转发 ⇒ 具名导出边判不出(N1),但**不**因此放过整处
        if (imports.namespaces.has(base))
          site.undetermined.push({ kind: 'namespace-forward', name: m[1] })
        continue
      }
      const binding = imports.named.get(base)
      if (!binding) continue // 本地 helper / 全局函数:不是"经 import 解析到仓内文件"那一跳
      const r = resolveModuleSpec(binding.specifier, relPath, knownPaths)
      if (!r.path) {
        site.undetermined.push({ kind: r.kind, name: base, specifier: binding.specifier })
        continue
      }
      site.needs.push({ path: r.path, name: binding.exported, local: base })
      needs.push({ path: r.path })
    }
    // N3:既没有可判的一跳、也没有解析不到的形态 ⇒ 不入 B2 的账(V1 已逐条点名这一处)
    if (!site.needs.length && !site.undetermined.length) continue
    sites.push(site)
  }
  return { sites, needs }
}

/**
 * B2 的第二遍:用**同面**取到的被调正文落结论。
 *  任一被调体真发了无 returning 的写链 ⇒ 违规(标记只救"已判违规"那一处,与 B1 同序);
 *  全部被调体都是 no-write/confirmed ⇒ 放过;
 *  没有违规而有任一解析不出 ⇒ 未判定(不记为通过,也不冒红)。
 */
export function finishDelegatedAckSite(site, calleeIndex) {
  // 调用方体内自带库答复(raw SQL 的 RETURNING / 同响应的诚实行数载体)⇒ 这一处按放过记账,
  // 并留下 confirmWhy 让 --explain 说得出**为什么**放过("放过"与"没看见"必须能各自被问到)。
  if (site.confirmedBy) {
    return {
      file: site.file,
      line: site.line,
      key: site.key,
      states: [],
      undetermined: [],
      disposition: 'db-confirmed',
      callee: { file: site.file, name: site.confirmedBy, why: 'caller-side-evidence' },
      bareExempt: 0,
    }
  }
  const states = []
  for (const n of site.needs) {
    const idx = calleeIndex && calleeIndex.get ? calleeIndex.get(n.path) : null
    if (!idx) {
      states.push({
        state: 'undetermined',
        kind: 'callee-face-missing',
        name: n.local,
        file: n.path,
      })
      continue
    }
    const fn = idx.byName.get(n.name)
    if (!fn) {
      states.push({
        state: 'undetermined',
        kind:
          idx.starReexport || idx.reexportNames.has(n.name) ? 'reexport' : 'callee-not-exported',
        name: n.local,
        file: n.path,
      })
      continue
    }
    const c = classifyCalleeBody(fn.bodyText, site.key)
    states.push({ ...c, name: n.local, file: n.path })
  }
  const undet = site.undetermined.concat(states.filter((s) => s.state === 'undetermined'))
  const violation = states.find((s) => s.state === 'violation')
  const confirmed = states.find((s) => s.state === 'confirmed')
  const out = {
    file: site.file,
    line: site.line,
    key: site.key,
    states,
    undetermined: undet,
    disposition: 'none',
  }
  if (violation) {
    if (site.marker.state === 'ok') out.disposition = 'marker'
    else out.disposition = 'violation'
    out.callee = { file: violation.file, name: violation.name }
  } else if (confirmed) {
    out.disposition = 'db-confirmed'
    out.callee = { file: confirmed.file, name: confirmed.name, why: confirmed.why }
  } else if (undet.length) out.disposition = 'undetermined'
  else out.disposition = 'no-write'
  out.bareExempt = violation && site.marker.state === 'bare' ? 1 : 0
  return out
}

/** 空壳:B2 自己的五个键(与 B1 同形,既有的 candidates/violations/undetermined/exempt 一字不并入)。 */
function emptyB2() {
  return {
    sites: [],
    candidates: [],
    violations: [],
    undetermined: [],
    exempt: { confirmed: 0, marker: 0 },
    bareExempt: 0,
    needs: [],
  }
}

/** 把 planDelegatedAckSites 的落点跑成结论并写进 res.b2(自检与 analyze 共用这一份归集实现)。 */
export function aggregateB2(res, judged) {
  for (const j of judged) {
    if (j.disposition === 'none') continue
    res.b2.candidates.push(j)
    if (j.disposition === 'violation') res.b2.violations.push(j)
    else if (j.disposition === 'db-confirmed') res.b2.exempt.confirmed++
    else if (j.disposition === 'marker') res.b2.exempt.marker++
    else if (j.disposition === 'undetermined') res.b2.undetermined.push(j)
    res.b2.bareExempt += j.bareExempt || 0
  }
  return res
}

/**
 * 票 守门134(条件性扩面①)的**触发条件测量** —— 它不是判据:不接 B2、不进 decide、
 * 不影响任何退出码。B2 那一跳目前只认 drizzle 链,而裸 SQL 写住在被调体的模板串里
 * (遮蔽面上被抹成空格)⇒ 判据看不见;本函数按票面判据逐字测量:
 *   **任一 ack 落点的最小函数体 await 了一个"体内含无 RETURNING 裸 SQL 写"的具名函数 ⇒ 必补。**
 * 命中 > 0 的那天,接 B2 裸 SQL 维时读 indexExportedFns 的 rawBodyText + 复用同一份
 * findRawSqlWriteChains —— 不得再写第二套 SQL 解析或第二份导出索引(§22c)。
 * 口径与 B2 第一遍同形、取材同面同轮:ack 落点 = findBooleanAckSends(与 V1/B1 同一份),
 * 一跳解析 = parseImportBindings + resolveModuleSpec(与 planDelegatedAckSites 同一份),
 * 裸 SQL 写判据 = findRawSqlWriteChains(与 B1/V 同一份)。刻意**不**照抄 planDelegatedAckSites
 * 的两处收窄(有直接 drizzle 链归 B1 那一格、调用方自带库答复那一格)—— 票面问的是"任一 ack
 * 落点",测宽不测漏;命中若落在 B1 射程,接维时再按判据口径归位。
 * 2026-09-28 立票实测:真仓 HEAD 面一跳 15 条、命中 0、判不出 0(含无 RETURNING 裸 SQL 写的
 * 具名导出函数全 src 共 7 个,零个被 ack 落点经 import 调用)⇒ 判据不动,测量由镜像 M24 复跑。
 * @returns {{hits:Array, hops:number, undetermined:Array}}
 */
export function measureB2RawSqlTrigger(root, face) {
  assertRepoRoot(root, GATE)
  const paths = listCandidates(root, face)
  if (!paths.length)
    throw new Undetermined(
      `${face} 面在 ${SCAN_DIRS.join(' / ')} 下枚举到 0 个候选源文件 ⇒ 测量失效,这个 0 不是"没有触发"`,
    )
  const texts = readCandidates(root, face, paths)
  const known = listFacePaths(root, face)
  const hops = []
  const undetermined = []
  for (const p of paths) {
    const t = texts.get(p)
    const mk = maskText(t)
    const masked = mk.text
    if (mk.leaks.length) {
      undetermined.push({ caller: p, line: 0, kind: 'lexical-unclosed' })
      continue // U2 同口径:词法未闭合的文件结论不可信,不拿它冒充 0
    }
    const nonBlank = maskText(t, { blankStrings: false }).text
    const bodies = findFunctionBodies(masked)
    const imports = parseImportBindings(nonBlank, masked)
    for (const b of findBooleanAckSends(masked)) {
      const body = enclosingBody(bodies, b.index)
      if (!body) continue // 解析不出函数体那一格连 B1 都不判,更不构成 B2 的触发
      const bodyText = masked.slice(body.start, body.end)
      AWAIT_CALL_RE.lastIndex = 0
      let m
      while ((m = AWAIT_CALL_RE.exec(bodyText)) !== null) {
        const parts = m[1].split(/\s*\.\s*/)
        const base = parts[0]
        const line = lineAt(masked, body.start + m.index)
        if (parts.length > 1) {
          if (imports.namespaces.has(base))
            undetermined.push({ caller: p, line, kind: 'namespace-forward', name: m[1] })
          continue
        }
        const binding = imports.named.get(base)
        if (!binding) continue // 本地 helper:不属 B2 那一跳(N3 同口径)
        const r = resolveModuleSpec(binding.specifier, p, known)
        if (!r.path) {
          undetermined.push({ caller: p, line, kind: r.kind, name: base, specifier: binding.specifier })
          continue
        }
        hops.push({ caller: p, line, key: b.key, path: r.path, name: binding.exported })
      }
    }
  }
  const calleeTexts = readCalleeTexts(root, face, [...new Set(hops.map((h) => h.path))])
  const idx = new Map()
  for (const [cp, ct] of calleeTexts)
    idx.set(cp, indexExportedFns(maskText(ct).text, maskText(ct, { blankStrings: false }).text))
  const hits = []
  for (const h of hops) {
    if (!calleeTexts.has(h.path)) {
      undetermined.push({ caller: h.caller, line: h.line, kind: 'callee-face-missing', name: h.name, path: h.path })
      continue
    }
    const fn = idx.get(h.path).byName.get(h.name)
    if (!fn) {
      undetermined.push({ caller: h.caller, line: h.line, kind: 'callee-not-indexed', name: h.name, path: h.path })
      continue
    }
    const cw = findRawSqlWriteChains(fn.rawBodyText || '')
    const bare = cw.chains.filter((c) => !c.hasReturning)
    if (bare.length)
      hits.push({
        caller: h.caller,
        line: h.line,
        key: h.key,
        callee: h.path,
        fn: h.name,
        bareWrites: bare.length,
        receivers: [...new Set(bare.map((c) => c.receiver))],
      })
    for (const u of cw.unparsed)
      undetermined.push({
        caller: h.caller,
        line: h.line,
        kind: 'callee-execute-unparsed',
        name: h.name,
        path: h.path,
        at: u.index,
      })
  }
  return { hits, hops: hops.length, undetermined }
}

/* --------- B3/B4:回填时间上界与终态回退(G-815953 / G-815956,2026-09-30) --------- */

/** 迁移记账列:写这些列的 update 才算"回填"。收窄是判据的命门 —— 软删形状
 *  `set({deletedAt: new Date()}).where(and(eq(...), isNull(...)))` 与回填词法同形且 HEAD 存量十几处,
 *  任何按 isNull 划线的判据都是恒红门(§12e);按"写迁移记账列"划线后 head 实测 0。 */
export const MIGRATION_COL_RE =
  /\b(?:migrationBatch|migration_batch|legacyId|legacy_id|legacyTable|legacy_table)\b/
/** 时间上界谓词:回填 where 的合法上界。走唯一出口的,其实参自带 `backfillWhere(`;手写的认 lte(/lt(/<=。 */
export const BACKFILL_BOUND_RE = /\blte\s*\(|\blt\s*\(|\bbackfillWhere\s*\(|<=/
/** 字面量状态键:遮蔽面(blankStrings 档)把字符串值抹空 ⇒ `status:` 后紧跟 `,`/`}` 才是字面量。
 *  变量值/简写/spread/`as` 断言在遮蔽面上有可见 token,一律不进面(判不了格,头注 B4 段如实登记)。 */
export const STATE_LITERAL_KEY_RE = /(?:^|[,{]\s*)(status|state)\s*:\s*(?=[,}])/

/** 同列前置:where 实参里出现 `eq(<t>.<col>` / `ne(` / `inArray(` / `in(` 指着**同一个**状态列。 */
export function statePreconditionRE(col) {
  return new RegExp(`\\b(?:eq|ne|inArray|in)\\s*\\(\\s*(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)?${col}\\b`)
}

/**
 * B3(G-815953):写迁移记账列的 update,where 必须带时间上界谓词(判据与判不了格见头注 B3 段)。
 * drizzle 链与裸 SQL UPDATE 两维共用 MIGRATION_COL_RE / BACKFILL_BOUND_RE(单一实现,§22c);
 * 链取材只吃注入的 chains/rawChains —— 链扫描全仓只有 findWriteChains / findRawSqlWriteChains 各一份。
 */
export function findBackfillBoundSites(relPath, code, chains = null, rawChains = null) {
  const out = { file: relPath, candidates: [], violations: [] }
  const push = (site, bounded, why) => {
    if (bounded) site.disposition = 'bounded'
    else {
      site.disposition = 'violation'
      site.whereWhy = why
      out.violations.push(site)
    }
    out.candidates.push(site)
  }
  for (const c of chains || findWriteChains(code)) {
    if (c.opaque || c.rawSql || !c.names || c.names[0] !== 'update') continue
    const setText = c.setText || ''
    const mc = MIGRATION_COL_RE.exec(setText)
    if (!mc) continue
    push(
      {
        file: relPath,
        line: lineAt(code, c.start),
        receiver: c.receiver,
        col: mc[0],
        via: 'drizzle',
        setExcerpt: setText.replace(/\s+/g, ' ').trim().slice(0, 60),
      },
      BACKFILL_BOUND_RE.test(c.whereText || ''),
      c.hasWhere ? 'where 无时间上界(lte/lt/backfillWhere/<= 均未见)' : '无 where(全表无界)',
    )
  }
  for (const c of rawChains || []) {
    const sql = c.sqlText || ''
    if (!/^\s*UPDATE\b/i.test(sql)) continue
    const mc = MIGRATION_COL_RE.exec(sql)
    if (!mc) continue
    push(
      {
        file: relPath,
        line: lineAt(code, c.start),
        receiver: c.receiver,
        col: mc[0],
        via: 'raw-sql',
        setExcerpt: sql.replace(/\s+/g, ' ').trim().slice(0, 60),
      },
      BACKFILL_BOUND_RE.test(sql),
      c.hasWhere ? 'WHERE 无时间上界(<= / backfillWhere 均未见)' : '无 WHERE(全表无界)',
    )
  }
  return out
}

/**
 * B4(G-815956):set 写**字面量** status/state 而 where 无同列 eq/in/ne 前置。
 * **棘轮专用维**:调用方(head 面,含 --strict)对 violations 只报数、永不判红 —— 票面拍板
 * "现存违规报数不判红,只拦新增",拦截发生在 analyze 的 staged 差值棘轮(kind='b4');
 * decide 签名刻意不收 b4Violations,那是结构锁(头注 B4 段)。判不了格见头注,绝不静默算通过。
 */
export function findTerminalStateSites(relPath, code, chains = null) {
  const out = { file: relPath, candidates: [], violations: [] }
  for (const c of chains || findWriteChains(code)) {
    if (c.opaque || c.rawSql || !c.names || c.names[0] !== 'update') continue
    const setText = c.setText || ''
    const mk = STATE_LITERAL_KEY_RE.exec(setText)
    if (!mk) continue
    const col = mk[1]
    const site = {
      file: relPath,
      line: lineAt(code, c.start),
      receiver: c.receiver,
      col,
      via: 'drizzle',
      setExcerpt: setText.replace(/\s+/g, ' ').trim().slice(0, 60),
    }
    if (statePreconditionRE(col).test(c.whereText || '')) {
      site.disposition = 'precondition'
    } else {
      site.disposition = 'violation'
      site.whereWhy = c.hasWhere ? 'where 无同列 eq/in/ne 前置' : '无 where'
      out.violations.push(site)
    }
    out.candidates.push(site)
  }
  return out
}

/* --------- B5:可空/非唯一排序列的 ORDER BY 尾键(G-815955,2026-09-30) --------- */

/** 可空/非唯一排序键族(票面点名):单键 ORDER BY 落在这些列上 ⇒ 同值行两次查询间座位不定(分页漂移)。 */
export const RISKY_ORDER_COL_RE = /\b(?:sortOrder|sortOrderInGroup|position|sequence)\b/
/** 单键形态:orderBy 实参(顶层)恰是一个 asc()/desc() 包着一个(可带表限定符的)列名。捕获组 = 列名。 */
export const ORDER_SINGLE_KEY_RE =
  /^(?:asc|desc)\s*\(\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\)$/

/** 顶层逗号切键:括号/中括号/花括号嵌套里的逗号不算分隔(遮蔽面上没有字符串/注释干扰)。 */
function splitTopLevelArgs(text) {
  const out = []
  let depth = 0
  let cur = ''
  for (const c of text) {
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    if (c === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  if (cur.trim()) out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

/**
 * B5(G-815955):单键 orderBy 落在可空/非唯一排序键族且无后续尾键。
 * **棘轮专用维(与 B4 同档同构)**:调用方(head 面,含 --strict)对 violations 只报数、永不判红
 * —— 票面拍板"存量报数不判红,只拦新增",拦截发生在 analyze 的 staged 差值棘轮(kind='b5');
 * decide 签名刻意不收 b5Violations,与 B4 同一条结构锁(头注 B5 段)。判不了格见头注,绝不静默算通过。
 * 取材:与 findWriteChains 同一遮蔽面、同一套 closeParen 配平;orderBy 是读链,写链扫描够不着,
 * 判据只此一份实现(§22c),裸 SQL 的 SELECT…ORDER BY 不进池(判不了,登记)。
 */
export function findOrderByTailKeySites(relPath, code) {
  const out = { file: relPath, candidates: [], violations: [] }
  const re = /\.\s*orderBy\s*\(/g
  let m
  while ((m = re.exec(code)) !== null) {
    const open = code.indexOf('(', m.index + m[0].length - 1)
    const end = open >= 0 ? closeParen(code, open) : -1
    if (end < 0) continue
    const keys = splitTopLevelArgs(code.slice(open + 1, end - 1))
    if (!keys.length) continue
    const km = ORDER_SINGLE_KEY_RE.exec(keys[0])
    if (!km || !RISKY_ORDER_COL_RE.test(km[1])) continue
    const site = {
      file: relPath,
      line: lineAt(code, m.index),
      col: km[1],
      via: 'drizzle',
      orderByExcerpt: keys.join(', ').replace(/\s+/g, ' ').trim().slice(0, 60),
    }
    if (keys.length === 1) {
      site.disposition = 'violation'
      site.orderByWhy = '单键排序无确定性尾键(同值行分页漂移)'
      out.violations.push(site)
    } else {
      site.disposition = 'tail-key'
    }
    out.candidates.push(site)
  }
  return out
}

/* --------- B6:jsonb upsert 整列覆盖的逐列策略声明(G-815954,2026-10-07) --------- */

/**
 * B6 的面 = SCAN_DIRS ∪ services ∪ plugins(维度专属枚举;理由见头注 B6 段"面"条)。
 * 其余判据的面一字不动 —— 扩面是它们的另一个决策。
 */
export const JSONB_UPSERT_SCAN_DIRS = [...SCAN_DIRS, 'apps/api/src/services', 'apps/api/src/plugins']

/**
 * jsonb 列键族(词法近似,判不了格见头注 B6 段①):票面点名的 metadata/messages + HEAD 面
 * onConflictDoUpdate 实存写过的 jsonb 列(registry 同步快照 payload/categories/tags、im 凭据
 * credentialsJson)。**刻意不含 value**:systemConfigs/userPreferences 的 value 是 text 列
 * (packages/database/src/schema/system.ts / user-preferences.ts),按名收族会把 6 处 KV 覆盖
 * 误判进面;p3-deep-layer 的 jsonb value 无 upsert 落点。族外 jsonb 列(config/context/prefs 等)
 * 不进面 —— 扩族必须同批核对 HEAD 存量,否则恒红门(§12e)。
 */
export const JSONB_UPSERT_COL_RE =
  /\b(?:metadata|messages|payload|categories|tags|credentialsJson)\b/

/** 绿腿①:jsonb_set 指定路径(未点名的路径不触碰)。模板串内容只在"保留字符串"档可见。 */
export const JSONB_SET_RE = /\bjsonb_set\s*\(/i
/**
 * 绿腿②:具名成员合并。`||` 只在 **sql`` 模板里**才是 SQL 侧的 jsonb 合并 —— JS 层的
 * `x.enabled || false` 是值运算,产出整颗新值 = 整列覆盖,必须判裸覆盖。所以合并的判定
 * = 模板标签(sql`)+ `||` 两条同时成立;`::jsonb` 尾缀可有可无(sql 侧 `||` 的两个操作数
 * 已是 jsonb)。标签恒在值 span 开头,`||`/`::jsonb` 是模板静态文本、只在"保留字符串"档可见。
 */
export const JSONB_MERGE_RE = /\|\|/
/** 具名合并的 sql 模板标签:值以 sql` 片段开头(或经成员取到),\b 防 psql 之类误咬。 */
export const JSONB_SQL_TAG_RE = /\bsql\s*`/
/** 红腿标记:excluded.* 整块引用(冲突行的新值整列搬入 = 覆盖,与具名合并的判定词相区分)。 */
export const EXCLUDED_REF_RE = /\bexcluded\s*\.\s*[A-Za-z_$][\w$]*/i

/**
 * 逐列策略声明注释(整列覆盖的唯一放行通道):`<列>:全量真相`(session-store 现行写法)、
 * `<列>:全量覆盖` 或英文别名 `<列>:full-truth`。列名由判据逐列拼入 —— 一条声明只救一列,
 * 这就是"逐列"的结构含义。
 */
export const jsonbPolicyDeclRe = (col) =>
  new RegExp(`${col}\\s*[:：]\\s*(?:全量真相|全量覆盖|full[-\\s]?truth)`)

/** 声明注释的垂直窗口:键行及其上 3 行(直觉落点;更远读不到,判不了格④)。 */
const JSONB_DECL_LOOKBACK_LINES = 3

/**
 * B6(G-815954):判据与判不了格见头注 B6 段。**棘轮专用维**:head 面(含 --strict)对 violations
 * 只报数、永不判红 —— 拦截发生在 analyze 的 staged 差值棘轮(kind='b6');decide 签名刻意不收
 * b6Violations(结构锁同 B4/B5)。取材三档:结构=全遮蔽档(maskedCode)、形态=留字符串档
 * (nonBlankCode)、声明=原始正文(rawText;同位对照 nonBlankCode 挡"字符串冒充注释")。
 * 三份正文由 scanFileText 各算一次传入,本函数不二次 maskText(§22c:取材只此一份)。
 */
export function findJsonbUpsertSites(relPath, rawText, maskedCode, nonBlankCode) {
  const out = { file: relPath, candidates: [], violations: [] }
  const re = /\.onConflictDoUpdate\s*\(/g
  let m
  while ((m = re.exec(maskedCode)) !== null) {
    const open = maskedCode.indexOf('(', m.index)
    const cfgEnd = closeParen(maskedCode, open)
    if (cfgEnd < 0) continue
    const cfgStart = open + 1
    const cfg = maskedCode.slice(cfgStart, cfgEnd - 1)
    const setM = /(?:^|[,{]\s*)set\s*:\s*\{/.exec(cfg)
    if (!setM) continue // 判不了格②:config 无对象字面量 set 键 ⇒ 不进面
    const setIdx = cfgStart + cfg.indexOf('{', setM.index + setM[0].length - 1)
    const setEnd = closeBrace(maskedCode, setIdx)
    if (setEnd < 0) continue
    // 顶层切键(与 splitTopLevelArgs 同一套配平),但**带绝对偏移** —— 值 span 要拿去两张
    // 遮蔽档上读同位原文,行号也要落在键上(声明注释的垂直窗口靠它)。
    const setText = maskedCode.slice(setIdx + 1, setEnd - 1)
    let depth = 0
    let curStart = -1
    const entries = []
    for (let i = 0; i <= setText.length; i++) {
      const c = setText[i]
      if (i === setText.length || (c === ',' && depth === 0)) {
        // 只在 curStart≥0(本段确有非空白内容)时出条目:末尾逗号后全空白/连续逗号时
        // curStart 已复位 -1,若回落到 0 会把整段 setText 再推一条重复 entry(实测:
        // `messages: …,` 带尾逗号的 set 块每键出两条,一条还是从 set 行起算的错位点)。
        if (curStart >= 0) {
          const seg = setText.slice(curStart, i).trim()
          if (seg)
            entries.push({
              text: seg,
              start: setIdx + 1 + curStart,
              // **不 trim 的原始终点**:值 span 必须盖到逗号前全部字节 —— 模板串尾部的
              // `::jsonb`/`||` 在遮蔽档是空格,按 trim 后长度切会把它们切出 span(假红)。
              end: setIdx + 1 + i,
            })
        }
        curStart = -1
        continue
      }
      if (curStart < 0 && !/\s/.test(c)) curStart = i
      if (c === '(' || c === '[' || c === '{') depth++
      else if (c === ')' || c === ']' || c === '}') depth--
    }
    for (const entry of entries) {
      const km = /^([A-Za-z_$][\w$]*)\s*:\s*/.exec(entry.text)
      if (!km || !JSONB_UPSERT_COL_RE.test(km[1])) continue
      const col = km[1]
      const valStart = entry.start + km[0].length
      const valLen = entry.end - valStart
      const valMasked = maskedCode.slice(valStart, valStart + valLen)
      const valNB = nonBlankCode.slice(valStart, valStart + valLen)
      // 值为纯字符串/无插值模板字面量 ⇒ 全遮蔽档剩空白:按整列覆盖计,不给绿腿
      // (字符串里的 `|| …::jsonb`/`jsonb_set(` 冒充不了合并 —— 自检 B6g)。
      const isPureString = valMasked.trim() === ''
      let form
      if (!isPureString && JSONB_SET_RE.test(valNB)) form = 'jsonb-set'
      else if (!isPureString && JSONB_SQL_TAG_RE.test(valNB) && JSONB_MERGE_RE.test(valNB))
        form = 'named-merge'
      else form = EXCLUDED_REF_RE.test(valNB) || /excluded/i.test(valMasked) ? 'excluded' : 'bare'
      const site = {
        file: relPath,
        line: lineAt(maskedCode, entry.start),
        col,
        via: 'drizzle',
        form,
        setExcerpt: valNB.replace(/\s+/g, ' ').trim().slice(0, 60),
      }
      if (form !== 'excluded' && form !== 'bare') {
        site.disposition = form
        out.candidates.push(site)
        continue
      }
      // 声明注释:键行及其上 3 行(原始正文)。两道锁:①token 前有注释起始符(readExemptMarker
      // 同款头查);②该 token 的同位字符在"留字符串"档**不在** —— 注释在那一档被剥成空白,
      // 还读得到原文 = 它活在字符串/模板里,不配作声明(自检 B6s)。
      let declared = false
      let lineStart = maskedCode.lastIndexOf('\n', entry.start - 1) + 1
      for (let up = 0; up <= JSONB_DECL_LOOKBACK_LINES; up++) {
        if (up > 0) {
          if (lineStart <= 0) break
          lineStart = maskedCode.lastIndexOf('\n', lineStart - 2) + 1
        }
        const nl = maskedCode.indexOf('\n', lineStart)
        const lineEnd = nl < 0 ? maskedCode.length : nl
        const rawLine = rawText.slice(lineStart, lineEnd)
        // 逐个匹配试完一整行:键行自己的 `messages:` 会先吃掉一次匹配,
        // 同行尾注释、上 N 行的声明都不能因此漏看。
        const lineRe = new RegExp(jsonbPolicyDeclRe(col).source, 'g')
        let dm
        while ((dm = lineRe.exec(rawLine)) !== null) {
          const abs = lineStart + dm.index
          const tokenLen = dm[0].length
          // 同位判档:声明 token 只活在注释里 —— 留字符串档把注释剥成空白,同位置还读得到原文
          // = 它活在字符串/模板里,不配作声明(比头查注释符准一道;两道都设)。
          const inString = nonBlankCode.slice(abs, abs + tokenLen) === dm[0]
          if (/(?:^|[^\S\n])(?:\/\/|\/\*|\*)/.test(rawLine.slice(0, dm.index)) && !inString) {
            declared = true
            break
          }
        }
        if (declared) break
      }
      site.declared = declared
      if (!declared) {
        site.disposition = 'violation'
        site.setWhy =
          form === 'excluded'
            ? 'excluded 整块搬入且无逐列策略声明(须 // <列>:全量真相,或改具名成员合并/jsonb_set)'
            : '整列覆盖且无逐列策略声明(须 // <列>:全量真相,或改具名成员合并/jsonb_set)'
        out.violations.push(site)
      } else {
        site.disposition = 'declared-full-truth'
      }
      // 候选 ⊇ 违规(B3/B4 同款口径):绿腿与已声明的处置也在 candidates 里,--explain 可复核。
      out.candidates.push(site)
    }
  }
  return out
}

/**
 * B7 的时间列识别(词法近似,票面"时间列"的仓内落地):驼峰时间戳惯例 —— 标识符以 At|Time 结尾
 * (createdAt/updatedAt/deletedAt/settledAt/lastMessageAt…全仓实测取材)。键与值两侧都算:投影值侧
 * 引用 schema 时间列(`updatedAt: t.updatedAt`)与键侧改名(`writtenAt: t.updatedAt`)都是"取回了时间"。
 */
const TIME_COL_RE = /\b[A-Za-z_$][\w$]*(?:At|Time)\b/

/**
 * B7(G-815984,2026-10-07):判据与判不了格见头注 B7 段。**棘轮专用维**:head 面(含 --strict)对
 * violations 只报数、永不判红 —— 拦截发生在 analyze 的 staged 差值棘轮(kind='b7');decide 签名刻意
 * 不收 b7Violations(结构锁同 B4/B5/B6)。取材 = findWriteChains 同一份链(hasReturning/returningText,
 * 不二次扫描,§22c),正文用链所在的全遮蔽档 —— 注释里提时间列冒充不了投影。候选 ⊇ 违规(B3/B4
 * 同款口径):bare-full-row / time-col 两条绿腿也在 candidates 里,--explain 可复核。
 */
export function findReturningTimeColSites(relPath, maskedCode, chains) {
  const out = { file: relPath, candidates: [], violations: [] }
  for (const c of chains) {
    if (!c.hasReturning || c.opaque) continue
    const rt = (c.returningText || '').trim()
    const site = {
      file: relPath,
      line: lineAt(maskedCode, c.start),
      receiver: c.receiver,
      via: 'drizzle',
      excerpt: rt.replace(/\s+/g, ' ').trim().slice(0, 60) || '(无参,回全行)',
    }
    if (!rt) {
      // 裸 `.returning()` = 回全行,时间列结构性在内 ⇒ 绿(票面"写入时刻回传"的满配形态)。
      site.disposition = 'bare-full-row'
      out.candidates.push(site)
      continue
    }
    // 判不了格(如实登记,不进面):实参非对象字面量(变量 / `sql` 模板 / 解构表达式)或对象里带
    // 展开 —— 里面有没有时间列词法不可知,不假装已判(头注 B7①②③)。
    if (!/^\{[\s\S]*\}$/.test(rt) || /\.\.\./.test(rt)) continue
    // 票面"写链 `.returning({id})` **之外**"这一半:纯 id 计数投影(顶层键全部 id 形)是 V1/B1 的
    // 既有绿形态、也是本门修法指引自己推荐的形状 ⇒ 处置 id-count 放过。若把它判违规,棘轮会把
    // "按修法指引补 .returning({id})"判成净新增(自检 BR/B2R 的'补回即归零'契约当场红)——
    // 门与自己打架,登记为刻意豁免而不是疏漏。
    const keys = topProjectionKeys(rt)
    if (keys.length > 0 && keys.every((k) => /^[A-Za-z_$]*[Ii]d$/.test(k))) {
      site.disposition = 'id-count'
      out.candidates.push(site)
      continue
    }
    if (TIME_COL_RE.test(rt)) {
      site.disposition = 'time-col'
      out.candidates.push(site)
      continue
    }
    site.disposition = 'violation'
    site.why =
      '非计数投影(含业务列)却不取回任何时间列(须同时取回 createdAt/updatedAt 等 At|Time 结尾列,或改裸 .returning() 回全行)'
    out.violations.push(site)
    out.candidates.push(site)
  }
  return out
}

/** B7 取材:对象字面量**顶层**键清单(带深度配平的顶层切分,展开已在调用前挡掉;shorthand `{ id }` 也算键)。 */
function topProjectionKeys(objText) {
  const body = objText.slice(1, -1)
  const keys = []
  let depth = 0
  let curStart = -1
  for (let i = 0; i <= body.length; i++) {
    const ch = body[i]
    if (i === body.length || (ch === ',' && depth === 0)) {
      if (curStart >= 0) {
        const seg = body.slice(curStart, i)
        // 键形二选一:`键: 值` 或 shorthand `键`(值侧在遮蔽档可能是空串,单看冒号有无不可靠)。
        const km = /^\s*(?:['"]?)([A-Za-z_$][\w$]*)(?:['"])?\s*(?::|$)/.exec(seg)
        if (km) keys.push(km[1])
      }
      curStart = -1
      continue
    }
    if (curStart < 0 && !/\s/.test(ch)) curStart = i
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
  }
  return keys
}

/* ------------------------------- 单文件判据 ------------------------------- */

/** 纯函数:一份文件正文 → 候选与处置。自检与端到面都跑它(判据只此一份实现)。 */
export function scanFileText(relPath, text, opts = {}) {
  const masked = maskText(text, { blankStrings: true })
  const code = masked.text
  // "剥注释、保留字符串"那一档:import 说明符(E2)与原始 SQL 的 RETURNING 关键字都只活在这里,
  // 而注释在两档中都被剥 ⇒ 注释里提一句 RETURNING 不配给假 ack 发合格证。同一份只算一次
  // (两处各 maskText 一遍就是第二套取材,门 118/93 记过同型)。
  const nonBlank = maskText(text, { blankStrings: false }).text
  const rawLines = text.split(/\r?\n/)
  const bodies = findFunctionBodies(code)
  // 裸 SQL 写链与 drizzle 写链**并进同一个池**(第三十批):两条判据(V/B1)问的是"这一屏真发了写
  // 而没有库答复",写住在方法链上还是模板串里不改变这个问题的答案。分池实现必然只有一边在动。
  const rawPool = findRawSqlWriteChains(nonBlank)
  const batchChains = [...findWriteChains(code), ...rawPool.chains].filter(
    (c) => c.hasWhere && c.hasInArray && !c.opaque,
  )
  const sends = findCountSends(code)
  const usesOutlet = SPEC_RE.test(nonBlank)
  const res = {
    file: relPath,
    candidates: [],
    violations: [],
    exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
    undetermined: [],
    bareExempt: 0,
    leaks: masked.leaks,
    usesOutlet,
    batchChains: batchChains.length,
    // 两份"惯例存量"落点(可见性,不进 decide、不进四个判据数)。U2 那份文件在此提前 return  ⇒ 两份都不计,
    // 而该文件已在 undetermined 清单里点名 —— 少掉的数有对应的名字,不是静默少掉。
    booleanAck: [],
    // 按键分组的可见性数(与 booleanAck* 同为**只报数**,**不进 decide**):U2 提前 return 那一路
    // 也要有这张表,否则报表读 undefined ⇒ 结论行少一族,而"少一族"看起来就像"那一族是 0"。
    booleanAckByKey: Object.fromEntries(BOOL_ACK_KEYS.map((k) => [k, 0])),
    readQuery: [],
    // 本文件被认出的裸 SQL 写链(可见性桶;带 ack 的落点由 B1/V 判,不参与 decide 之外的四个判据数)。
    rawSqlWrites: rawPool.chains.map((c) => ({ start: c.start, returning: c.hasReturning })),
    // 裸 SQL execute 解析不到的落点(可见性桶;带 ack 的那些同时进 undetermined,见 U3)。
    rawSqlUnparsed: [],
    // B1(判据,自带 b1* 键;既有四数 candidates/violations/undetermined/exempt 一字不并入)。
    b1: {
      candidates: [],
      violations: [],
      exempt: { confirmed: 0, marker: 0 },
      bareExempt: 0,
      noBodySites: [],
    },
    // B2 必须在**建壳那一刻**就在位:U2 那一支在下面提前 return,漏了这行就会让 analyze 读到
    // undefined.needs —— 一份"别人写坏的词法"把整道门换成 exit 2,而 exit 2 看起来像"无法判定",
    // 实际是本门自己崩了。
    b2: emptyB2(),
    // B3/B4/B5(G-815953/G-815956/G-815955)与 B2 同一条教训:壳必须建在 U2 提前 return 之前。
    b3: { candidates: [], violations: [] },
    b4: { candidates: [], violations: [] },
    b5: { candidates: [], violations: [] },
    // B6(G-815954)与 B3/B4/B5 同一条教训:壳必须建在 U2 提前 return 之前。
    b6: { candidates: [], violations: [] },
    // B7(G-815984)与 B3/B4/B5/B6 同一条教训:壳必须建在 U2 提前 return 之前。
    b7: { candidates: [], violations: [] },
  }
  if (res.leaks.length) {
    res.undetermined.push({
      file: relPath,
      line: 0,
      why: `词法状态未闭合(${res.leaks[0]}${res.leaks.length > 1 ? ` 等 ${res.leaks.length} 处` : ''})⇒ 整文件不判(U2)`,
    })
    return res
  }
  for (const s of sends) {
    const line = lineAt(code, s.index)
    const body = enclosingBody(bodies, s.index)
    const scope = body ? batchChains.filter((c) => c.start >= body.start && c.end <= body.end) : []
    const before = scope.filter((c) => c.end <= s.index)
    if (!before.length) {
      if (scope.length)
        res.undetermined.push({
          file: relPath,
          line,
          why: `${s.key}: ${s.expr} 在同函数体内只有其后的 inArray 批量写链 ⇒ 顺序不成立,不判红也不记绿(U1)`,
        })
      // V2:函数体内**完全没有**批量写链且键为 count ⇒ N2 读查询计数那一族(只报数)。
      // 刻意不在 U1 那一支计:那处已经作为"未判定"点名过,再计一次就是把同一格算进两个惯例族。
      else if (s.key === 'count')
        res.readQuery.push({ file: relPath, line, key: s.key, expr: s.expr })
      continue // 函数体内没有批量写链:读查询/布尔确认(N1/N2),不入面
    }
    const chain = before[before.length - 1]
    const site = { file: relPath, line, key: s.key, expr: s.expr, receiver: chain.receiver }
    res.candidates.push(site)
    const mk = readExemptMarker(rawLines[line - 1] || '')
    const prev = line >= 2 ? readExemptMarker(rawLines[line - 2] || '') : { state: 'none' }
    const marked = mk.state === 'ok' || prev.state === 'ok'
    if (mk.state === 'bare' || prev.state === 'bare') res.bareExempt++
    const root = /^([A-Za-z_$][\w$]*)/.exec(s.expr)?.[1] || ''
    const dbDerived = !!root && resolveConfirmed(code, body, root, 0)
    // 四条放过通道按" cheapest 且最能说明意图"排序;每支各有反面对照(见 selfTest 的 P1b/P2)。
    const kind = usesOutlet
      ? 'outlet'
      : marked
        ? 'marker'
        : chain.hasReturning
          ? 'returning'
          : dbDerived
            ? 'db'
            : 'violation'
    if (kind === 'violation') {
      site.disposition = 'violation'
      res.violations.push(site)
    } else {
      site.disposition = {
        outlet: 'outlet',
        marker: 'marker',
        returning: 'returning',
        db: 'db-confirmed',
      }[kind]
      res.exempt[kind]++
    }
  }
  // V1:布尔 ack 惯例落点(DELETE 幂等确认)。与违规判据同面同轮、同一份遮蔽后的代码面,
  // 所以注释/字符串里的 `deleted: true` 不计数(N3 那一型),而跨行对象字面量数得到。
  // B1 从**这一份落点清单**里派生(findBoolAckSends 只调一次)—— 惯例面与判据面若各扫一遍,
  // 一处改了另一处不会跟着改,V1 的数就会与 B1 的子集对不上账(M13 同源的一条锁)。
  const boolSites = findBooleanAckSends(code)
  res.booleanAck = boolSites.map((b) => ({
    file: relPath,
    line: lineAt(code, b.index),
    key: b.key,
    value: b.value,
  }))
  // 按键分组(2026-09-27 第二十九批):扩键族后只报一个合计,读报告的人就分不清"这一族没扫过"
  // 与"扫了是 0"—— 与结论行逐键点名同一条理由。表由 BOOL_ACK_KEYS 派生,五键恒在位(含 0)。
  res.booleanAckByKey = Object.fromEntries(BOOL_ACK_KEYS.map((k) => [k, 0]))
  for (const b of res.booleanAck) res.booleanAckByKey[b.key] = (res.booleanAckByKey[b.key] || 0) + 1
  const allChains = findWriteChains(code)
  res.b1 = findBoolAckB1Sites(relPath, code, rawLines, allChains, boolSites, nonBlank, rawPool)
  // B3/B4:与 B1/B2 共用同一份 allChains(§22c —— 链扫描只有 findWriteChains 一份);
  // 裸 SQL 维复用 rawPool(同一遍 findRawSqlWriteChains,不二次扫描)。
  res.b3 = findBackfillBoundSites(relPath, code, allChains, rawPool.chains)
  res.b4 = findTerminalStateSites(relPath, code, allChains)
  // B5:orderBy 是读链,allChains(.delete/.update)结构上够不着 ⇒ 用同一遮蔽面自扫一遍(判据只此一份)。
  res.b5 = findOrderByTailKeySites(relPath, code)
  // B6(G-815954):取材三档全部由本函数已算好的三份正文传入(结构=code 全遮蔽档、形态=nonBlank
  // 留字符串档、声明=text 原始正文),判据不二次 maskText —— 每多一遍 mask 就是第二套取材。
  res.b6 = findJsonbUpsertSites(relPath, text, code, nonBlank)
  // B7(G-815984):消费 allChains(上面 L2006 那一份,§22c 链扫描只此一个来源),
  // 正文就是链所在的遮蔽档 code —— 判据不二次扫描、不二次 maskText。
  res.b7 = findReturningTimeColSites(relPath, code, allChains)
  // 裸 SQL 写链**解析不到**(括号配平失败)那一格:只有当同一函数体里确实有 ack 时,判据的结论
  // 才依赖它 ⇒ 记"未判定"(与 U1/U2 同档,--strict 下拒绝出合格证);体里没有 ack 的解析失败不影响
  // 任何结论,只进 rawSqlUnparsed 可见性桶(报数点名,不冒红也不静默算通过)。
  res.rawSqlUnparsed = []
  for (const u of rawPool.unparsed) {
    const line = lineAt(nonBlank, u.index)
    const body = enclosingBody(bodies, u.index)
    const ackHere =
      !!body &&
      (sends.some((s) => s.index >= body.start && s.index < body.end) ||
        boolSites.some((s) => s.index >= body.start && s.index < body.end))
    res.rawSqlUnparsed.push({ file: relPath, line, ackHere })
    if (ackHere)
      res.undetermined.push({
        file: relPath,
        line,
        why: `db*.execute(...) 括号配平不到 ⇒ 判不了这条裸 SQL 是不是写、有没有 RETURNING,而同一函数体里有 ack(U3)`,
      })
  }
  // B2(一跳委托):第一遍只用**本地**信息(调用方正文 + 同面文件清单)得出"要读哪些被调文件";
  // 被调正文由 analyze 在同一面一次读满后再跑第二遍。acks 与 B1 共用**同一份** boolSites —— 两处
  // 各扫一遍 send 形态必然漂移(M16 那把锁的同族)。
  res.b2 = emptyB2()
  if (!res.leaks.length) {
    const imports = parseImportBindings(
      nonBlank, // 模块说明符只活在"保留字符串"那一档
      code, // 遮蔽后的代码面:起始位不在这一面上就说明那条 import 活在字符串/注释里
    )
    const plan = planDelegatedAckSites(
      relPath,
      code,
      rawLines,
      boolSites,
      allChains,
      imports,
      opts.knownPaths,
      nonBlank,
    )
    res.b2.sites = plan.sites
    res.b2.needs = plan.needs
    // 自检/夹具走这一档:被调正文由调用方直接给,不必派生 git(判据仍是同一份实现)。
    if (opts.calleeIndex)
      aggregateB2(
        res,
        plan.sites.map((s) => finishDelegatedAckSite(s, opts.calleeIndex)),
      )
  }
  for (const c of allChains.filter((x) => x.opaque))
    res.undetermined.push({
      file: relPath,
      line: lineAt(code, c.start),
      why: `${c.receiver}.${c.names.join('.')} 链里混进函数字面量 ⇒ 分不清批量写还是路由注册,不计入本门(U0)`,
    })
  return res
}

/* ------------------------------ 取材(同面同轮) ------------------------------ */

export function listCandidates(root, face) {
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], root)
      : gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root)
  return String(out)
    .split('\0')
    .filter(Boolean)
    .filter((p) => FILE_RE.test(p) && !SKIP_RE.test(p))
}

/**
 * B6(G-815954)维度专属面的**增量**枚举:JSONB_UPSERT_SCAN_DIRS 里落在基础面(paths)之外的
 * 文件(services/plugins)。清单与内容同面同轮,与 listCandidates 同一条口径(枚举走 gitRaw,
 * 不产正文);调用方只许把这些文件的 **b6 结果**并进账,其余判据不得顺带扩面。
 */
export function listJsonbUpsertExtraPaths(root, face, basePathnames) {
  const base = new Set(basePathnames)
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...JSONB_UPSERT_SCAN_DIRS], root)
      : gitRaw(['ls-files', '-z', '--', ...JSONB_UPSERT_SCAN_DIRS], root)
  return String(out)
    .split('\0')
    .filter(Boolean)
    .filter((p) => FILE_RE.test(p) && !SKIP_RE.test(p) && !base.has(p))
}

/** 一次 `cat-file --batch` 把同一面全部候选读满(清单与内容同面同轮;取不到即抛,不回落)。 */
export function readCandidates(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${p}`)
      map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? ':' : 'HEAD:') + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (t === null || t === undefined)
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${p} ⇒ 不回落另一个面(回落就是把"没判"写成"判过了")`,
      )
    map.set(p, t)
  })
  return map
}

/**
 * 同一面的 `apps/api/src` 文件全集(B2 解析 import 说明符用)。
 * 枚举走 gitRaw(ls-tree / ls-files **不产正文**,不算散写读内容 —— 与 listCandidates 同一条口径),
 * 且刻意按**所判的那一面**取:清单来自磁盘 + 内容来自 HEAD 就是自洽却错位的尺子(门 118 那一型)。
 * --worktree 是人工逃生舱档:路径清单仍取跟踪面,面里没有的被调文件按"未判定"点名而不是猜。
 */
export function listFacePaths(root, face) {
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', API_SRC_DIR], root)
      : gitRaw(['ls-files', '-z', '--', API_SRC_DIR], root)
  return new Set(String(out).split('\0').filter(Boolean))
}

/**
 * 被调文件的正文:与调用方**同面**,但取不到**不判死**。
 * 这个不对称是刻意的:调用方文件取不到 = 本门没法审它 ⇒ exit 2;被调文件取不到 = 本门承认看不见
 * 这一跳(N1 未判定),不能让"别人那半个还没 add 的文件"把整道门判死(恒红门同罪)。
 */
export function readCalleeTexts(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (typeof t === 'string') map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? ':' : 'HEAD:') + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (typeof t === 'string') map.set(p, t)
  })
  return map
}

/**
 * 一整个面的跑法:候选正文 → 逐文件判据 → B2 第二遍用**同一面**的被调正文落结论。
 * 自检与 analyze 都走它 ⇒ "同面同轮"这件事只有一处实现,不会一处做到了另一处漏掉。
 */
export function scanFaceBundle(root, face, paths, texts, knownPaths) {
  const per = paths.map((p) => scanFileText(p, texts.get(p), { knownPaths }))
  const needs = new Set()
  for (const r of per) for (const n of r.b2.needs) needs.add(n.path)
  const idx = new Map()
  // needs 为空**不等于**没有 B2 要判:一整批"那一跳解析不到"的落点就是 needs 为空、sites 非空,
  // 早退会把它们静默吞成 0 条(第一版就是这么把 25 处未判定读成 0 的 —— 判据失效的表现永远是安静)。
  if (needs.size) {
    const calleeTexts = readCalleeTexts(root, face, [...needs])
    for (const [p, t] of calleeTexts) idx.set(p, indexExportedFns(maskText(t).text))
  }
  for (const r of per) {
    if (!r.b2.sites.length) continue
    aggregateB2(
      r,
      r.b2.sites.map((s) => finishDelegatedAckSite(s, idx)),
    )
  }
  return per
}

export function analyze(root, face, opts = {}) {
  assertRepoRoot(root, GATE)
  const paths = listCandidates(root, face)
  if (paths.length === 0)
    throw new Undetermined(
      `${face} 面在 ${SCAN_DIRS.join(' / ')} 下枚举到 0 个候选源文件 —— 判据失效,不计通过`,
    )
  const texts = readCandidates(root, face, paths)
  const only = opts.onlyFiles && opts.onlyFiles.length ? new Set(opts.onlyFiles) : null
  const scanned = only ? paths.filter((p) => only.has(p)) : paths
  // 名单里落不到覆盖面的那些必须**点名**报出来:只把 scanned 缩短,调用方分不清"这一项被审过且干净"
  // 与"这一项根本没进审"(§"把没判写成判过了"同一条禁令)。全落空才判死,部分落空报数并点名。
  const outsideScopePaths = only ? [...only].filter((p) => !paths.includes(p)) : []
  if (only && scanned.length === 0)
    throw new Undetermined(
      `--files 指定的路径没有一个落在本门覆盖面(${SCAN_DIRS.join(' / ')} · ${face} 面)⇒ 判据失效,不计通过(名单:${[...only].join(', ')})`,
    )
  const facePaths = listFacePaths(root, face)
  const per = scanFaceBundle(root, face, scanned, texts, facePaths)
  // B6(G-815954)专属面增量:JSONB_UPSERT_SCAN_DIRS 比基础面(SCAN_DIRS)多出的 services/plugins
  // 文件只产 **b6** 结果(头注 B6 段)—— 其余判据不得顺带扩面,所以单独成一份 per、只取它的 b6 键。
  // --files 定点跑不扩面:名单外的文件一个都不碰(与 outsideScopePaths 同一条纪律)。
  // base 必须是**基础面枚举(paths)**,不是 facePaths —— listFacePaths 是 B2 取被调用的宽面
  // (整个 API_SRC_DIR,含 services),拿它当 base 会把 services/plugins 全部过滤掉,专属维
  // 在 analyze 里整面失明(镜像测试 G-815954 CLI 专属面抓到,棘轮侧 L235x 传 headSet 是对的)。
  const b6ExtraPaths = only ? [] : listJsonbUpsertExtraPaths(root, face, paths)
  const b6ExtraTexts = readCandidates(root, face, b6ExtraPaths)
  const b6OnlyPer = b6ExtraPaths.map((p) =>
    scanFileText(p, b6ExtraTexts.get(p), { knownPaths: facePaths }),
  )
  const violations = per.flatMap((r) => r.violations)
  const undetermined = per.flatMap((r) => r.undetermined)
  const b1Violations = per.flatMap((r) => r.b1.violations)
  const b1NoBody = per.reduce((a, r) => a + r.b1.noBodySites.length, 0)
  const b2Violations = per.flatMap((r) => r.b2.violations)
  const b2Undetermined = per.flatMap((r) => r.b2.undetermined)
  // B3/B4/B5(G-815953/G-815956/G-815955)自己的聚合 —— 与 b1*/b2* 同形,不并入任何既有数。
  const b3Violations = per.flatMap((r) => r.b3.violations)
  const b4Violations = per.flatMap((r) => r.b4.violations)
  const b5Violations = per.flatMap((r) => r.b5.violations)
  // B6(G-815954)的聚合:基础面(per)∪ 专属面增量(b6OnlyPer),两处各算各的、此处只做拼接。
  const b6Violations = [...per, ...b6OnlyPer].flatMap((r) => r.b6.violations)
  // B7(G-815984)的聚合:面与基础面同一张表(无专属面增量,与 B3/B4/B5 同理)。
  const b7Violations = per.flatMap((r) => r.b7.violations)
  const exempt = ['returning', 'db', 'outlet', 'marker'].reduce(
    (a, k) => ({ ...a, [k]: per.reduce((x, r) => x + r.exempt[k], 0) }),
    {},
  )
  const counts = {
    files: scanned.length,
    enumerated: paths.length,
    candidates: per.reduce((a, r) => a + r.candidates.length, 0),
    violations: violations.length,
    undetermined: undetermined.length,
    exempt: exempt.returning + exempt.db + exempt.outlet + exempt.marker,
    bareExempt: per.reduce((a, r) => a + r.bareExempt, 0),
    // 两份惯例存量:可见性字段,**不参与 decide**。刻意各计各的 —— 混计成一个数就等于没有信息。
    booleanAckSites: per.reduce((a, r) => a + r.booleanAck.length, 0),
    booleanAckFiles: per.filter((r) => r.booleanAck.length > 0).length,
    readQueryCountSites: per.reduce((a, r) => a + r.readQuery.length, 0),
    readQueryCountFiles: per.filter((r) => r.readQuery.length > 0).length,
    // 裸 SQL 写链的可见性数(第三十批):`rawSqlWriteSites` = 面上被认出的裸 SQL 写;
    // `rawSqlUnparsed*` = 括号配平不到的 execute(带 ack 的那些已进 undetermined,其余只报数)。
    rawSqlWriteSites: per.reduce((a, r) => a + r.rawSqlWrites.length, 0),
    rawSqlUnparsedSites: per.reduce((a, r) => a + r.rawSqlUnparsed.length, 0),
    rawSqlUnparsedFiles: per.filter((r) => r.rawSqlUnparsed.length > 0).length,
    // B1(判据)自己的键 —— 既有四数(candidates/violations/undetermined/exempt)刻意不并入 B1。
    b1Candidates: per.reduce((a, r) => a + r.b1.candidates.length, 0),
    b1Violations: b1Violations.length,
    b1Files: per.filter((r) => r.b1.violations.length > 0).length,
    b1ExemptConfirmed: per.reduce((a, r) => a + r.b1.exempt.confirmed, 0),
    b1ExemptMarker: per.reduce((a, r) => a + r.b1.exempt.marker, 0),
    b1BareExempt: per.reduce((a, r) => a + r.b1.bareExempt, 0),
    b1NoBody,
    // B2(一跳委托)自己的五个键 —— 既有四数与 booleanAck* / b1* / readQuery* 的取值一字不并入。
    b2Candidates: per.reduce((a, r) => a + r.b2.candidates.length, 0),
    b2Violations: b2Violations.length,
    b2Files: per.filter((r) => r.b2.violations.length > 0).length,
    b2Undetermined: b2Undetermined.length,
    b2Exempt: per.reduce((a, r) => a + r.b2.exempt.confirmed + r.b2.exempt.marker, 0),
    // B3/B4 自己的键(G-815953/G-815956):追加在 b2* 之后、惯例计数之前,一字不并入既有数。
    b3Candidates: per.reduce((a, r) => a + r.b3.candidates.length, 0),
    b3Violations: b3Violations.length,
    b3Files: per.filter((r) => r.b3.violations.length > 0).length,
    b4Candidates: per.reduce((a, r) => a + r.b4.candidates.length, 0),
    b4Violations: b4Violations.length,
    b4Files: per.filter((r) => r.b4.violations.length > 0).length,
    // B5(G-815955)自己的键:追加在 b4* 之后,一字不并入既有数。
    b5Candidates: per.reduce((a, r) => a + r.b5.candidates.length, 0),
    b5Violations: b5Violations.length,
    b5Files: per.filter((r) => r.b5.violations.length > 0).length,
    // B6(G-815954)自己的键:追加在 b5* 之后,一字不并入既有数(面 = 基础面 ∪ B6 专属面增量)。
    b6Candidates: [...per, ...b6OnlyPer].reduce((a, r) => a + r.b6.candidates.length, 0),
    b6Violations: b6Violations.length,
    b6Files: new Set(b6Violations.map((v) => v.file)).size,
    // B7(G-815984)自己的键:追加在 b6* 之后,一字不并入既有数。
    b7Candidates: per.reduce((a, r) => a + r.b7.candidates.length, 0),
    b7Violations: b7Violations.length,
    b7Files: new Set(b7Violations.map((v) => v.file)).size,
    // 2026-09-27 追加在**最末尾**:布尔 ack 按键分组的现读数(五键恒在位,含 0)。
    // 语义变化必须如实说:`booleanAckSites` / `booleanAckFiles` 自本批改用**键族五键**计数,
    // 所以这两个数的口径比扩面前宽(扩面前只有 `deleted`)—— 它们仍**不参与任何退出码**(X1/R7/R8/M13
    // 那几把锁一字未动);要知道每一族各多少处,读这一张表,不要读那两个合计。
    booleanAckByKey: per.reduce(
      (acc, r) => {
        for (const k of BOOL_ACK_KEYS) acc[k] += r.booleanAckByKey[k] || 0
        return acc
      },
      Object.fromEntries(BOOL_ACK_KEYS.map((k) => [k, 0])),
    ),
    // 2026-10-01 追加在**最末尾**:`--files` 名单的可见性三键(既有各数一字不并入)。
    // 立因:旧 CLI 只取 `--files` 后面**一个** token,空格分隔的第二/第三个路径被静默丢掉,
    // 而名单里落覆盖面外的项也静默不计 ⇒ "报了 1/581" 与"审了调用方心里那两个文件"在账面同形。
    requestedFiles: only ? only.size : 0,
    outsideScopeFiles: outsideScopePaths.length,
    outsideScopePaths,
  }
  // 棘轮锚点:只在这一档才回读 HEAD 面(全量档本来就是 HEAD)。新文件不在 HEAD ⇒ 锚点 0,
  // 这是"第一个端点第一次就写错"必须判红的那一格;锚点文件取不到则判死,不拿 0 顶替。
  // 五条判据(计数自算 / B1 假 ack / B2 一跳委托 / B3 回填无界 / B4 终态回退)各按**各自**的 HEAD
  // 计数当锚点 —— 共用一个数就是互相顶账(门 67/83 记过"同一笔债两道门各计一次会让两份基线互相
  // 顶掉"的反面:键必须分开)。
  // **锚点的粒度 = 文件 × 判据 × ack 键**(2026-09-27 第二十九批随键族扩面同批改):
  //  只到"文件 × 判据"那一层,把一处 `deleted` 假 ack 换成 `removed` 假 ack 就是 1 → 1 净零,
  //  而这恰恰是扩键族**新造出来**的一条逃逸路径(扩面前只有一族,换无可换)。自检 BK1 用一次性临时
  //  仓把这条换键路径钉成必红;代价是红点会更细,而细红点正是本门存在的理由。
  //  B3/B4 两维**无 ack 键**(key 恒空串):状态列/迁移列没有 ack 键族,"换值逃逸"在这一维不成立,
  //  粒度自然落在 文件 × 判据。
  let ratcheted = null
  if (
    face === 'staged' &&
    (violations.length ||
      b1Violations.length ||
      b2Violations.length ||
      b3Violations.length ||
      b4Violations.length ||
      b5Violations.length ||
      b6Violations.length ||
      b7Violations.length)
  ) {
    const bucketBy = (list) => {
      const m = new Map()
      for (const v of list) {
        const k = `${v.file}\u0000${v.key || ''}`
        m.set(k, (m.get(k) || 0) + 1)
      }
      return m
    }
    const legacyByFile = bucketBy(violations)
    const b1ByFile = bucketBy(b1Violations)
    const b2ByFile = bucketBy(b2Violations)
    const b3ByFile = bucketBy(b3Violations)
    const b4ByFile = bucketBy(b4Violations)
    const b5ByFile = bucketBy(b5Violations)
    const b6ByFile = bucketBy(b6Violations)
    const b7ByFile = bucketBy(b7Violations)
    const files = [
      ...new Set(
        [
          ...legacyByFile.keys(),
          ...b1ByFile.keys(),
          ...b2ByFile.keys(),
          ...b3ByFile.keys(),
          ...b4ByFile.keys(),
          ...b5ByFile.keys(),
          ...b6ByFile.keys(),
          ...b7ByFile.keys(),
        ].map((k) => k.split('\u0000')[0]),
      ),
    ]
    const headSet = new Set(listCandidates(root, 'head'))
    // B6 专属面文件的 HEAD 锚点面:这些文件(services/plugins)不在 headSet,若直接拿 headSet 判存在,
    // 锚点会错落成 0 ⇒ services 里一笔 HEAD 既有违规在 staged 持平也判红(恒红门同罪)。所以 B6 的
    // 存在性判定用并集,且这些文件必须真的进 headPer 扫描(取不到即判死,不拿 0 顶替);只有 b6 桶
    // 非空才多跑这一次 HEAD 枚举。
    const b6HeadFaceSet = new Set([
      ...headSet,
      ...(b6ByFile.size ? listJsonbUpsertExtraPaths(root, 'head', [...headSet]) : []),
    ])
    const need = files.filter((p) => b6HeadFaceSet.has(p))
    // B2 的锚点必须也在 HEAD 面把那一跳读完:索引面的 ack 数与 HEAD 面的 ack 数若各自用**自己那一面**
    // 的被调正文,才是"同一把尺子在两个面上量出两个基准"的正解(反之混用就是自洽却错位的尺子)。
    const headPer = need.length
      ? scanFaceBundle(
          root,
          'head',
          need,
          readCandidates(root, 'head', need),
          listFacePaths(root, 'head'),
        )
      : []
    const headByFile = new Map(headPer.map((r) => [r.file, r]))
    // HEAD 侧必须按**同一把尺子**(文件 × 判据 × ack 键)分桶 —— 只到文件那一层,就是上面说的那条换键逃逸。
    const headLegacyBy = bucketBy(headPer.flatMap((r) => r.violations))
    const headB1By = bucketBy(headPer.flatMap((r) => r.b1.violations))
    const headB2By = bucketBy(headPer.flatMap((r) => r.b2.violations))
    const headB3By = bucketBy(headPer.flatMap((r) => r.b3.violations))
    const headB4By = bucketBy(headPer.flatMap((r) => r.b4.violations))
    const headB5By = bucketBy(headPer.flatMap((r) => r.b5.violations))
    const headB6By = bucketBy(headPer.flatMap((r) => r.b6.violations))
    const headB7By = bucketBy(headPer.flatMap((r) => r.b7.violations))
    ratcheted = []
    // faceSet:该判据的 HEAD **存在性面**(锚点=0 只该发生在"HEAD 里根本没有这个文件"时)。
    // 其余判据传空走 headSet;B6 传 b6HeadFaceSet(专属面文件在 headSet 之外)。
    const pushRatchet = (bucket, headBucket, compositeKey, kind, faceSet) => {
      const [file, key] = compositeKey.split('\u0000')
      let anchor = 0
      if ((faceSet || headSet).has(file)) {
        if (!headByFile.get(file))
          throw new Undetermined(`HEAD 取不到棘轮锚点文件 ${file} ⇒ 无法判定(不回落、不拿 0 顶替)`)
        anchor = headBucket.get(compositeKey) || 0
      }
      const now = bucket.get(compositeKey) || 0
      if (now > anchor)
        ratcheted.push({ file, kind, key: key || undefined, now, anchor, added: now - anchor })
    }
    for (const k of legacyByFile.keys()) pushRatchet(legacyByFile, headLegacyBy, k, 'count')
    for (const k of b1ByFile.keys()) pushRatchet(b1ByFile, headB1By, k, 'b1')
    for (const k of b2ByFile.keys()) pushRatchet(b2ByFile, headB2By, k, 'b2')
    for (const k of b3ByFile.keys()) pushRatchet(b3ByFile, headB3By, k, 'b3')
    for (const k of b4ByFile.keys()) pushRatchet(b4ByFile, headB4By, k, 'b4')
    for (const k of b5ByFile.keys()) pushRatchet(b5ByFile, headB5By, k, 'b5')
    for (const k of b6ByFile.keys()) pushRatchet(b6ByFile, headB6By, k, 'b6', b6HeadFaceSet)
    // B7 面与基础面同一张表 ⇒ faceSet 走默认 headSet(与 B3/B4/B5 同理,无专属面)。
    for (const k of b7ByFile.keys()) pushRatchet(b7ByFile, headB7By, k, 'b7')
  }
  const exit = decide({
    face,
    violations,
    undetermined,
    ratcheted,
    strict: !!opts.strict,
    b1Violations,
    b1NoBody,
    b2Violations,
    b2Undetermined,
    // b3Violations 进 decide(--strict 全量判红,B1/B2 同档);
    // b4Violations / b5Violations / b6Violations / b7Violations **刻意不传** —— 棘轮专用维,head 面
    // (含 --strict)只报数不判红(头注 B4/B5/B6/B7 段),"签名即判据"的结构锁:谁想把 B4/B5/B6/B7
    // 接进 --strict,必须先改 decide 签名并推翻票面拍板。
    b3Violations,
  })
  return {
    face,
    strict: !!opts.strict,
    counts,
    violations,
    undetermined,
    exempt,
    ratcheted,
    per,
    exit,
    b1Violations,
    b1NoBody,
    b2Violations,
    b2Undetermined,
    b3Violations,
    b4Violations,
    b5Violations,
    b6Violations,
    b7Violations,
    // B6 专属面增量单独成一份(per 不并入 —— 其余判据不得顺带扩面);--explain 消费它。
    b6OnlyPer,
  }
}

/**
 * 纯映射:面 + 结论 → 退出码。判红只算两型:staged 的差值棘轮、全量档的 --strict。
 * 全量档默认不判红是设计前提而不是偷懒:HEAD 有存量时当场判红 = 恒红门(§12e)。
 * 未判定永不冒红,但 --strict 下拒绝出合格证 ⇒ exit 2(不冒红也不记绿)。
 * **签名即判据(2026-09-27 更新;2026-09-30 随 B3/B4 再更新)**:本函数收 violations / undetermined /
 * ratcheted / strict,外加 **B1 的 b1Violations / b1NoBody**、**B2 的 b2Violations / b2Undetermined**、
 * **B3 的 b3Violations** —— 三条都是判据,进退出码是它们的本职(默认档仍只由 staged 棘轮与 --strict
 * 触发,存量不冒红)。**B4 刻意不在参数里**:它是棘轮专用维(G-815956 票面拍板"现存违规报数不判红,
 * 只拦新增"),拦截发生在 staged 的 ratcheted(kind='b4'),head 面(含 --strict)只报数 —— 把 B4 接进
 * --strict 必须先改本签名,那是一步显式动作而不是顺手一个 `||`。**B5 同构(G-815955)**:排序无尾键
 * 同为棘轮专用维,decide 签名同样刻意不收 b5Violations(头注 B5 段),拦截只走 staged 的
 * ratcheted(kind='b5')。**B6 再同构(G-815954)**:jsonb 整列覆盖无声明同为棘轮专用维,签名刻意不收
 * b6Violations(头注 B6 段),拦截只走 staged 的 ratcheted(kind='b6')。**B7 再同构(G-815984)**:
 * 写时刻不回传同为棘轮专用维,签名刻意不收 b7Violations(头注 B7 段),拦截只走 staged 的
 * ratcheted(kind='b7')。而两份**惯例存量**计数
 * (booleanAck* / readQueryCount*)**依旧刻意不在参数里**,所以"把可见性计数接进退出码"这一改法
 * 在结构上就要求改签名,而那一步由 self-test 的 X1/X1b + 镜像 M13 判红(惯例存量是**决策依据**不是**债**)。
 */
export function decide({
  face,
  violations,
  undetermined,
  ratcheted,
  strict,
  b1Violations = [],
  b1NoBody = 0,
  b2Violations = [],
  b2Undetermined = [],
  b3Violations = [],
}) {
  if (strict) {
    // 未判定(B1 找不到函数体 / B2 那一跳解析不到)在 --strict 下与既有 undetermined 同档:拒绝出合格证。
    if (undetermined.length || b1NoBody || b2Undetermined.length) return 2
    if (
      face === 'staged'
        ? ratcheted && ratcheted.length
        : violations.length ||
          b1Violations.length ||
          b2Violations.length ||
          b3Violations.length // B4/B5/B6/B7 刻意缺席(见上):棘轮专用维,head+strict 不判红
    )
      return 1
    return 0
  }
  if (face === 'staged') return ratcheted && ratcheted.length ? 1 : 0
  return 0
}

/* ------------------------------- 报告 ------------------------------- */

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

export function formatReport(out) {
  const L = []
  const c = out.counts
  const b1v = out.b1Violations || []
  const b2v = out.b2Violations || []
  const b2u = out.b2Undetermined || []
  const b3v = out.b3Violations || []
  const b4v = out.b4Violations || []
  const b5v = out.b5Violations || []
  const b6v = out.b6Violations || []
  const b7v = out.b7Violations || []
  if (out.ratcheted && out.ratcheted.length) {
    const nLegacy = out.ratcheted.filter((r) => (r.kind || 'count') === 'count').length
    const nB1 = out.ratcheted.filter((r) => r.kind === 'b1').length
    const nB2 = out.ratcheted.filter((r) => r.kind === 'b2').length
    const nB3 = out.ratcheted.filter((r) => r.kind === 'b3').length
    const nB4 = out.ratcheted.filter((r) => r.kind === 'b4').length
    const nB5 = out.ratcheted.filter((r) => r.kind === 'b5').length
    const nB6 = out.ratcheted.filter((r) => r.kind === 'b6').length
    const nB7 = out.ratcheted.filter((r) => r.kind === 'b7').length
    L.push(
      `❌ 判红:${out.ratcheted.length} 条净新增越线(按 文件×判据;计数自算 ${nLegacy} · B1 假 ack ${nB1} · B2 委托假 ack ${nB2} · B3 回填无界 ${nB3} · B4 终态回退 ${nB4} · B5 排序无尾键 ${nB5} · B6 jsonb 无声明 ${nB6} · B7 写时刻不回传 ${nB7};锚点 = 该文件 HEAD 自身同判据计数)`,
    )
    for (const r of out.ratcheted)
      L.push(
        `   [${{ b1: 'B1假ack', b2: 'B2委托假ack', b3: 'B3回填无界', b4: 'B4终态回退', b5: 'B5排序无尾键', b6: 'B6jsonb无声明', b7: 'B7写时刻不回传' }[r.kind] || '计数自算'}] ${r.file}${r.key ? `〈ack 键 ${r.key}〉` : ''}:索引 ${r.now} 处 > HEAD ${r.anchor} 处 ⇒ 净新增 ${r.added} 处`,
      )
    if (nLegacy) {
      L.push(
        `   修法二选一:① db 层补 .returning({id}) 并以真实命中集算 affected;② 走唯一出口 ${UNIQUE_OUTLET} 的 batchWriteOutcome(requested, confirmed)。`,
      )
      L.push(`   确属有意(如全量改写后必得请求数):写行内豁免 ${EXEMPT_TOKEN}: <一句话原因>。`)
    }
    if (nB1) {
      L.push(
        '   B1 修法:deleted 取库里真删的行(rows.length > 0 / batchWriteOutcome 的 affected > 0)—— 用户已拍板改真实语义,不得再无条件回 true。',
      )
      L.push(
        `   确属有意(如该表有触发器保证必删):写**同行**行内豁免 ${DELETE_ACK_EXEMPT_TOKEN}: <一句话原因>(须带原因,只本行生效,守门 108 按 30 天到期账管它)。`,
      )
    }
    if (nB2) {
      L.push(
        '   B2 修法:回**被委托函数**里补 .returning({id}) 并让调用方按命中行回报(或直接走 batchWriteOutcome)——',
      )
      L.push(
        '   摘掉被调函数里的 .returning( 就是这一型回退:缺陷隔了一个文件,B1 看不见,只有 B2 会红。',
      )
      L.push(
        `   同一处确属有意(如级联清理必删主记录):写**同行**行内豁免 ${DELETE_ACK_EXEMPT_TOKEN}: <原因>(与 B1 同一条通道)。`,
      )
    }
    if (nB3) {
      L.push(
        '   B3 修法:走唯一出口 apps/api/src/utils/backfill-baseline.ts 的 backfillWhere({ column, baselineTime }),',
      )
      L.push(
        '   或给 where 补 lte(<时间列>, baseline) 上界 —— baseline 取「上一次迁移的应用时刻」;无行内豁免通道(回填没有"确属有意无界"的合法场景)。',
      )
    }
    if (nB4) {
      L.push(
        '   B4 修法:给 where 补**同一状态列**的前置(如 and(eq(t.id, id), eq(t.status, <活动态>))),',
      )
      L.push(
        '   让迟到终态事件只落在还处于活动态的行上 —— 已终态记录不得被改回活动态;这一维按票面拍板只拦新增。',
      )
    }
    if (nB5) {
      L.push(
        '   B5 修法:给 orderBy 补确定性尾键(如 asc(t.sortOrder), desc(t.createdAt), asc(t.id)) ——',
      )
      L.push(
        '   尾键最后一键必须是能唯一定位行的列(主键/唯一列),同值行才不会在两次查询间换座位;这一维按票面拍板只拦新增。',
      )
    }
    if (nB6) {
      L.push(
        '   B6 修法:改具名成员合并(sql`<列> || ${具名成员}::jsonb`)或 jsonb_set 指定路径;',
      )
      L.push(
        '   确为全量真相(内存态即完整转写)的整列覆盖,在 set 键同行或上 3 行内写逐列声明注释 `// <列>:全量真相 —— <理由>`;这一维按票面拍板只拦新增。',
      )
    }
    if (nB7) {
      L.push(
        '   B7 修法:投影里补时间列(returning({ id: t.id, updatedAt: t.updatedAt })),或改裸 .returning() 回全行 ——',
      )
      L.push(
        '   写入时刻必须原样回给调用方,时序/去重/审计不得靠猜;这一维按票面拍板只拦新增。',
      )
    }
  } else if (out.face === 'staged')
    L.push(
      '✅ 索引面未见新增"批量写自算计数 / B1 假 ack / B2 委托假 ack / B3 回填无界 / B4 终态回退 / B5 排序无尾键 / B6 jsonb 整列覆盖无声明 / B7 写时刻不回传"(存量按各文件 HEAD 自身计数豁免,不代裁)。',
    )
  if (out.face !== 'staged' && c.violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 ${c.violations} 处自算计数${out.strict ? '(--strict 判红)' : '(只报数,不拦提交:与改动无关的恒红门只会逼人 --no-verify,§12e)'}`,
    )
    for (const v of out.violations)
      L.push(`   ${v.file}:${v.line}  ${v.key}: ${v.expr}  (写链=${v.receiver}.… 无 .returning())`)
  }
  if (out.face !== 'staged' && c.b1Violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 B1 假 ack ${c.b1Violations} 处 / ${c.b1Files} 文件(同函数体有 db/tx 写链、回 deleted: true 字面量、体内无 .returning()/batchWriteOutcome())${out.strict ? ' —— --strict 判红' : ' —— 存量只报数不拦提交;提交链走差值棘轮,新增即红(§12e)'}`,
    )
    for (const v of b1v.slice(0, 40))
      L.push(`   ${v.file}:${v.line}  (写链=${v.receiver}.delete/update,响应布尔档键=${v.key})`)
    if (c.b1Violations > 40) L.push(`   …另 ${c.b1Violations - 40} 处(--explain 看全量)`)
  }
  // B2 与 B1 同档:它是判据不是可见性数 —— 全量默认档只报数(HEAD 有存量),--strict 才问责,
  // 提交链走"该文件 HEAD 自身 B2 计数"的差值棘轮。措辞与上一段同形,免得两型读起来不一样。
  if (out.face !== 'staged' && c.b2Violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 B2 委托假 ack ${c.b2Violations} 处 / ${c.b2Files} 文件(ack 体内无直接写链、await 了本仓具名导出函数、被调体有带 where 的写链而无 .returning()/batchWriteOutcome())${out.strict ? ' —— --strict 判红' : ' —— 存量只报数不拦提交;提交链走差值棘轮,新增即红(§12e)'}`,
    )
    for (const v of b2v.slice(0, 40))
      L.push(
        `   ${v.file}:${v.line}  → ${v.callee?.file ?? '?'}#${v.callee?.name ?? '?'}(被调体写链无 .returning(),响应布尔档键=${v.key})`,
      )
    if (c.b2Violations > 40) L.push(`   …另 ${c.b2Violations - 40} 处(--explain 看全量)`)
  }
  // B3 与 B1/B2 同档:判据,--strict 全量判红,提交链走差值棘轮。措辞同形。
  if (out.face !== 'staged' && c.b3Violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 B3 回填无界 ${c.b3Violations} 处 / ${c.b3Files} 文件(写迁移记账列的 update/UPDATE,where 无 lte/lt/backfillWhere/<= 时间上界)${out.strict ? ' —— --strict 判红' : ' —— 存量只报数不拦提交;提交链走差值棘轮,新增即红(§12e)'}`,
    )
    for (const v of b3v.slice(0, 40))
      L.push(
        `   ${v.file}:${v.line}  (写链=${v.receiver}.update set→${v.setExcerpt} ⇒ ${v.whereWhy};via=${v.via})`,
      )
    if (c.b3Violations > 40) L.push(`   …另 ${c.b3Violations - 40} 处(--explain 看全量)`)
  }
  // B4 是**棘轮专用维**(G-815956 票面拍板"现存违规报数不判红,只拦新增"):head 面含 --strict 一律
  // ⚠️ 只报数 —— 这一行永远不出 ❌,拦截只发生在 staged 差值棘轮(kind='b4')。措辞里必须把这句话喊出来。
  if (out.face !== 'staged' && c.b4Violations) {
    L.push(
      `⚠️ 全量档现读 B4 终态回退 ${c.b4Violations} 处 / ${c.b4Files} 文件(set 写字面量 status/state 而 where 无同列 eq/in/ne 前置)—— **只报数不判红(--strict 也不判)**:票面拍板"现存违规报数不判红,只拦新增",提交链走差值棘轮,净新增即红;面内共 ${c.b4Candidates ?? 0} 处、其中已带前置而放过 ${c.b4Candidates != null ? c.b4Candidates - c.b4Violations : 0} 处`,
    )
    for (const v of b4v.slice(0, 40))
      L.push(
        `   ${v.file}:${v.line}  (写链=${v.receiver}.update set→${v.setExcerpt} ⇒ ${v.whereWhy})`,
      )
    if (c.b4Violations > 40) L.push(`   …另 ${c.b4Violations - 40} 处(--explain 看全量)`)
  }
  // B5 是**棘轮专用维**(G-815955,与 B4 同档):head 面含 --strict 一律 ⚠️ 只报数 —— 这一行永远
  // 不出 ❌,拦截只发生在 staged 差值棘轮(kind='b5')。措辞里必须把这句话喊出来。
  if (out.face !== 'staged' && c.b5Violations) {
    L.push(
      `⚠️ 全量档现读 B5 排序无尾键 ${c.b5Violations} 处 / ${c.b5Files} 文件(单键 orderBy 落在 sortOrder/sortOrderInGroup/position/sequence 这类可空/非唯一排序列而无确定性尾键)—— **只报数不判红(--strict 也不判)**:票面拍板"现存违规报数不判红,只拦新增",提交链走差值棘轮,净新增即红;面内共 ${c.b5Candidates ?? 0} 处、其中已带尾键而放过 ${c.b5Candidates != null ? c.b5Candidates - c.b5Violations : 0} 处`,
    )
    for (const v of b5v.slice(0, 40))
      L.push(
        `   ${v.file}:${v.line}  (orderBy→${v.orderByExcerpt} ⇒ ${v.orderByWhy})`,
      )
    if (c.b5Violations > 40) L.push(`   …另 ${c.b5Violations - 40} 处(--explain 看全量)`)
  }
  // B6 是**棘轮专用维**(G-815954,与 B4/B5 同档):head 面含 --strict 一律 ⚠️ 只报数 —— 这一行永远
  // 不出 ❌,拦截只发生在 staged 差值棘轮(kind='b6')。措辞里必须把这句话喊出来。
  if (out.face !== 'staged' && c.b6Violations) {
    L.push(
      `⚠️ 全量档现读 B6 jsonb 整列覆盖无声明 ${c.b6Violations} 处 / ${c.b6Files} 文件(onConflictDoUpdate set 写 jsonb 列而既非具名成员合并、非 jsonb_set 指定路径,又无逐列"全量真相"声明)—— **只报数不判红(--strict 也不判)**:票面拍板"现存违规报数不判红,只拦新增",提交链走差值棘轮,净新增即红;面内共 ${c.b6Candidates ?? 0} 处、其中具名合并/jsonb_set/带声明而放过 ${c.b6Candidates != null ? c.b6Candidates - c.b6Violations : 0} 处`,
    )
    for (const v of b6v.slice(0, 40))
      L.push(
        `   ${v.file}:${v.line}  (set→${v.setExcerpt} ⇒ ${v.setWhy || v.disposition})(只拦新增,不进 --strict)`,
      )
    if (c.b6Violations > 40) L.push(`   …另 ${c.b6Violations - 40} 处(--explain 看全量)`)
  }
  // B7 是**棘轮专用维**(G-815984,与 B4/B5/B6 同档):head 面含 --strict 一律 ⚠️ 只报数 —— 这一行
  // 永远不出 ❌,拦截只发生在 staged 差值棘轮(kind='b7')。措辞里必须把这句话喊出来。
  if (out.face !== 'staged' && c.b7Violations) {
    L.push(
      `⚠️ 全量档现读 B7 写时刻不回传 ${c.b7Violations} 处 / ${c.b7Files} 文件(写链 .returning( 取了业务列却不取回任何时间列 —— 写入时刻没回给调用方)—— **只报数不判红(--strict 也不判)**:票面拍板"现存违规报数不判红,只拦新增",提交链走差值棘轮,净新增即红;面内共 ${c.b7Candidates ?? 0} 处、其中带时间列/裸回全行/纯 id 计数而放过 ${c.b7Candidates != null ? c.b7Candidates - c.b7Violations : 0} 处`,
    )
    for (const v of b7v.slice(0, 40))
      L.push(
        `   ${v.file}:${v.line}  (写链=${v.receiver}.… returning→${v.excerpt} ⇒ ${v.why})(只拦新增,不进 --strict)`,
      )
    if (c.b7Violations > 40) L.push(`   …另 ${c.b7Violations - 40} 处(--explain 看全量)`)
  }
  if (c.undetermined) {
    L.push(`⚠️ 未判定 ${c.undetermined} 处 —— **未判定不等于通过**,下列每一处本门都承认自己看不见:`)
    for (const u of out.undetermined.slice(0, 40)) L.push(`   ${u.file}:${u.line}  ${u.why}`)
    if (c.undetermined > 40) L.push(`   …另 ${c.undetermined - 40} 处(--explain 看全量)`)
  }
  if (c.b1NoBody)
    L.push(
      `⚠️ B1 未判定 ${c.b1NoBody} 处(布尔 ack 落在解析不出函数体的位置,如模块顶层/class 方法简写)—— 这**同样是未判定而不是通过**:判不了,不冒红也不记绿。`,
    )
  if (c.b2Undetermined) {
    L.push(
      `⚠️ B2 未判定 ${c.b2Undetermined} 处(那一跳解析不到:命名空间转发 / export * 再导出 / 第三方或 workspace 包 / 被调文件不在所判面 / 别名相对路径解不开 / 被调链 opaque)—— **未判定不是通过,也不是违规**:不冒红、不记绿,逐条点名如下:`,
    )
    let shown = 0
    for (const u of b2u)
      for (const k of u.undetermined) {
        if (shown++ >= 40) break
        L.push(
          `   ${u.file}:${u.line}  ${k.kind}${k.name ? ` (${k.name})` : ''}${k.specifier ? ` ← '${k.specifier}'` : ''}`,
        )
      }
    if (shown > 40) L.push(`   …另 ${shown - 40} 条(--explain 看全量)`)
  }
  if (out.strict && (c.undetermined || c.b1NoBody || c.b2Undetermined))
    L.push('❌ --strict 下未判定即拒绝出合格证 ⇒ exit 2(不冒红也不记绿)。')
  if (
    out.face !== 'staged' &&
    !c.violations &&
    !c.undetermined &&
    !c.b1Violations &&
    !c.b1NoBody &&
    !c.b2Violations &&
    !c.b2Undetermined &&
    !c.b3Violations &&
    !c.b4Violations &&
    !c.b5Violations &&
    !c.b6Violations &&
    !c.b7Violations
  )
    L.push(
      '✅ 通过:覆盖面内无自算计数、无 B1/B2 假 ack、无 B3 回填无界、无 B4 终态回退、无 B5 排序无尾键、无 B6 jsonb 整列覆盖无声明、无 B7 写时刻不回传,且无未判定项。',
    )
  if (
    out.face === 'staged' &&
    !out.ratcheted?.length &&
    (c.undetermined || c.b1NoBody || c.b2Undetermined)
  )
    L.push('ℹ️ 本门未拦本次提交,但上面列出的未判定项**没有被判过** —— 别让绿灯替它们说话。')
  L.push(
    `候选 ${c.candidates} / 违规 ${c.violations} / 未判定 ${c.undetermined} / 豁免 ${c.exempt}` +
      `(库确认·链 ${out.exempt.returning} / 库确认·预查询 ${out.exempt.db} / 唯一出口 ${out.exempt.outlet} / 行内标记 ${out.exempt.marker})` +
      `  [裸标记不计 ${c.bareExempt};文件 ${c.files}/${c.enumerated};取材面:${FACE_TXT[out.face] || out.face}]` +
      // `--files` 名单里落覆盖面外的项必须**报名**,不能只把"文件 N/M"缩短当无事发生:
      // 调用方递进来的路径没被审,与"审了且干净",在只报 N/M 的措辞下完全同形。
      (c.outsideScopeFiles
        ? `;⚠️ --files 名单 ${c.requestedFiles} 项里有 ${c.outsideScopeFiles} 项落在覆盖面外(本门**未判**):${(c.outsideScopePaths || []).join(', ')}`
        : '') +
      // 结论行必须**点名**两份惯例存量:放着一个不喊出的数,读报告的人就会以为覆盖面内没有这两种形状
      // ("判据失效的表现永远是安静"同型)。它们不参与退出码 —— 措辞里"不计红"是这一句的约束力所在。
      ` 布尔 ack 惯例(不计红,仅现读计数): ${c.booleanAckSites} 处 / ${c.booleanAckFiles} 文件` +
      `;读查询 count 惯例(不计红,仅现读计数): ${c.readQueryCountSites} 处 / ${c.readQueryCountFiles} 文件` +
      // 裸 SQL 写链这一维(第三十批)同样"现读点名":没有这一句,读报告的人分不清"面上没有裸 SQL 写"
      // 与"有,但都被判过/放过";配平不到的那些若带 ack 已进未判定,其余在此报数。
      `;裸 SQL 写链(第三十批补的写维):认出 ${c.rawSqlWriteSites ?? 0} 处,括号配平不到 ${c.rawSqlUnparsedSites ?? 0} 处 / ${c.rawSqlUnparsedFiles ?? 0} 文件(带 ack 的已计未判定)` +
      // B1 是判据,结论行同样必须现读点名(含 0):它的"存量只报数"与"新增即红"共用这份数字,
      // 少喊一句,读报告的人就分不清"这一族没扫过"和"扫了是 0"。
      `;B1 假 ack(判据:违规 ${c.b1Violations ?? 0} 处 / ${c.b1Files ?? 0} 文件,` +
      `库确认放过 ${c.b1ExemptConfirmed ?? 0} · 行内标记 ${c.b1ExemptMarker ?? 0} 只报数,` +
      `裸标记不计 ${c.b1BareExempt ?? 0},找不到函数体不判 ${c.b1NoBody ?? 0})` +
      // B2 与 B1 同形:措辞里"0 处 ≠ 没扫过"由这一句自己承担;五个键一律现读,不并入任何既有数。
      `;B2 委托假 ack(判据:违规 ${c.b2Violations ?? 0} 处 / ${c.b2Files ?? 0} 文件,` +
      `候选 ${c.b2Candidates ?? 0},放过 ${c.b2Exempt ?? 0} 只报数,` +
      `那一跳解析不到不判 ${c.b2Undetermined ?? 0})` +
      // B3(G-815953)与 B1/B2 同形:0 也照喊。
      `;B3 回填无界(判据:违规 ${c.b3Violations ?? 0} 处 / ${c.b3Files ?? 0} 文件,` +
      `候选 ${c.b3Candidates ?? 0};--strict 全量判红,提交链差值棘轮)` +
      // B4(G-815956)是棘轮专用维:现读点名 + 把"只拦新增"喊出来 —— 这一句是 B4 行的约束力所在。
      `;B4 终态回退(判据:违规 ${c.b4Violations ?? 0} 处 / ${c.b4Files ?? 0} 文件,` +
      `候选 ${c.b4Candidates ?? 0};只报数不进 --strict,票面拍板只拦新增,提交链差值棘轮)` +
      // B5(G-815955)与 B4 同构:现读点名 + 把"只拦新增"喊出来。
      `;B5 排序无尾键(判据:违规 ${c.b5Violations ?? 0} 处 / ${c.b5Files ?? 0} 文件,` +
      `候选 ${c.b5Candidates ?? 0};只报数不进 --strict,票面拍板只拦新增,提交链差值棘轮)` +
      // B6(G-815954)与 B4/B5 同构:现读点名 + 把"只拦新增"喊出来(0 也照喊,"0 处 ≠ 没扫过")。
      `;B6 jsonb 无声明(判据:违规 ${c.b6Violations ?? 0} 处 / ${c.b6Files ?? 0} 文件,` +
      `候选 ${c.b6Candidates ?? 0};只报数不进 --strict,票面拍板只拦新增,提交链差值棘轮)` +
      // B7(G-815984)与 B4/B5/B6 同构:现读点名 + 把"只拦新增"喊出来(0 也照喊,"0 处 ≠ 没扫过")。
      `;B7 写时刻不回传(判据:违规 ${c.b7Violations ?? 0} 处 / ${c.b7Files ?? 0} 文件,` +
      `候选 ${c.b7Candidates ?? 0};只报数不进 --strict,票面拍板只拦新增,提交链差值棘轮)` +
      // 逐键点名(2026-09-27):扩键族后"合计 12 处"这句话什么都没说 —— 新那一族可能一处都没有,
      // 也可能全是新那一族。含 0 也照喊,理由与 B1/B2 段同一句("0 处 ≠ 没扫过")。
      // 表由 BOOL_ACK_KEYS 派生:**报表漏键在这里结构上不可能发生**,自检 K0 再用一份独立写死的
      // 期望表对账"键族本身有没有被人削短"(那才是会静默失明的那一格)。
      `;布尔 ack 按键族现读(不计红):${BOOL_ACK_KEYS.map((k) => `${k} ${(c.booleanAckByKey && c.booleanAckByKey[k]) ?? 0}`).join(' · ')}`,
  )
  return L
}

const USAGE = `用法: node scripts/${GATE}.mjs [--staged|--worktree] [--strict] [--explain] [--json] [--files a,b] [--root <dir>] [--self-test]
  判据一(计数诚实性):同函数体内 inArray 批量写链 + .send(success({ deleted|affected|… : <请求侧>.length }))
    放过:链带 .returning( / 计数根可追到库确认集 / import ${UNIQUE_OUTLET} / 行内 ${EXEMPT_TOKEN}: <原因>(须带原因)
  判据二(B1 假 ack,2026-09-27):同函数体内 db|tx|trx .delete(/.update( 写链 + 响应对象里布尔档键取字面值
    (键族:${BOOL_ACK_KEYS.join(' | ')})
    放过:体内 .returning( / 体内 batchWriteOutcome( / 同次 db.execute 的原生 SQL 里有 RETURNING /
          同响应另有诚实行数载体 / **同行**行内 ${DELETE_ACK_EXEMPT_TOKEN}: <原因>(须带原因)
  判据三(B2 委托假 ack,2026-09-27):ack 体内**无**直接写链(那一子集归 B1),但 await 了经 import 解析到
    ${API_SRC_DIR} 内某文件的具名导出函数,而被调函数体有带 .where( 的写链却无 .returning( / batchWriteOutcome(
    被调体做两件写事时按 ack 键的写动词筛(见 BOOL_ACK_KEY_VERBS);那一跳判不出 ⇒ 未判定并点名
    放过:被调体走库确认 / 与 B1 同一条行内豁免通道
  判据四(B3 回填无界,2026-09-30 G-815953):.update( 写**迁移记账列**(migrationBatch/migration_batch/legacy*)
    而 where 无时间上界谓词(lte(/lt(/backfillWhere(/<=)⇒ 违规;无 where 全表无界同判;裸 SQL UPDATE 同判
    放过:走唯一出口 apps/api/src/utils/backfill-baseline.ts 的 backfillWhere({ column, baselineTime })
    **无行内豁免通道**(回填没有"确属有意无界"的合法场景;软删形状 set({deletedAt}).where(isNull) 不算回填)
  判据五(B4 终态回退,2026-09-30 G-815956,**棘轮专用维**):.update( 的 set( 写**字面量** status/state
    而 where 无对**同一状态列**的 eq/ne/inArray/in 前置 ⇒ 违规
    判不了格如实登记:值来自变量/简写/spread/as 断言/数字枚举码 ⇒ 不进面;前置写在 sql\`…\` 模板 ⇒ 按无前置计;
    裸 SQL 的 SET status = 'x' 本版刻意不认(存量 0)
    **head 面(含 --strict)只报数不判红**(decide 签名刻意不收 b4Violations);staged 差值棘轮净新增即红
  判据六(B5 排序无尾键,2026-09-30 G-815955,**棘轮专用维,与 B4 同构**):单键 orderBy(asc|desc(<col>))
    落在可空/非唯一排序键族(sortOrder/sortOrderInGroup/position/sequence)而无后续确定性尾键 ⇒ 违规
    放过:首键同族但后面还有键(如 …, desc(t.createdAt), asc(t.id));尾键最后一键须能唯一定位行
    判不了格如实登记:键经变量/展开传入 ⇒ 不进面;sql\`…\` 模板 ⇒ 遮蔽面读不到,不进面;
    裸 SQL 的 SELECT…ORDER BY 不进池(findRawSqlWriteChains 只认写动词锚);列唯一性是语义问题,词法只认列名族
    **head 面(含 --strict)只报数不判红**(decide 签名刻意不收 b5Violations);staged 差值棘轮净新增即红
  判据七(B6 jsonb 整列覆盖无声明,2026-10-07 G-815954,**棘轮专用维,与 B4/B5 同构**):onConflictDoUpdate
    的 set 写 jsonb 列键族(metadata/messages/payload/categories/tags/credentialsJson)而值既非具名成员合并
    (sql\`… || \${具名}::jsonb\`)、非 jsonb_set 指定路径,又无 \`// <列>:全量真相\` 逐列声明注释 ⇒ 违规
    放过:具名成员合并 / jsonb_set( / 键行或上 3 行内的全量真相声明(声明必须活在注释里,字符串同形不算;注释写法 \`// <列>:全量真相 —— <理由>\`)
    判不了格如实登记:config 非对象字面量/值经变量拼装/声明超 3 行窗/jsonb_insert 未列绿腿 ⇒ 不进面
    扫描面 = 基础面 ∪ services/plugins(其余判据不随此扩面);**head 面(含 --strict)只报数不判红**
    (decide 签名刻意不收 b6Violations);staged 差值棘轮净新增即红
  判据八(B7 写时刻不回传,2026-10-07 G-815984,**棘轮专用维,与 B4/B5/B6 同构**):写链(.delete/.update)
    的 .returning( 实参是显式列投影对象字面量、取了业务列,而投影全文(键/值两侧)无任何时间列
    (At|Time 结尾的标识符,仓内驼峰时间戳惯例 createdAt/updatedAt/deletedAt…)⇒ 违规 ——
    写入时刻必须原样回给调用方,时序/去重/审计不得靠猜
    放过:裸 .returning() 无参(回全行)/ 投影带时间列(键或值任一侧)/ 纯 id 计数投影(票面
    "写链 \`.returning({id})\` 之外"的豁免半句 —— V1/B1 既有绿形态与修法指引推荐形状,处置 id-count)
    判不了格如实登记:实参经变量传入 / 投影对象带展开({...pick})/ \`sql\` 模板实参 ⇒ 里面有没有
    时间列词法不可知,不进面;insert 链不进本维(findWriteChains 动词锚只有 .delete/.update,扩动词
    会同时改 B1/B3/B4 的面,登记不装看不见)
    **head 面(含 --strict)只报数不判红**(decide 签名刻意不收 b7Violations);staged 差值棘轮净新增即红
  只报数不判红(现读惯例存量,写在结论行):布尔 ack(五键按键分组现读,无写链的那一半)与读查询 \`count: X.length\`;--explain 逐条点名
  八条判据的存量都按「该文件 HEAD 自身同判据计数」差值棘轮:全量档只报数(恒红门=逼人 --no-verify,§12e),
  提交链档与 --strict 才问责(B4/B5/B6/B7 例外:全量档含 --strict 都只报数,只拦新增)。
  紧急跳过:${SELF_SKIP}=1`

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return void console.log(USAGE)
  if (argv.includes('--self-test')) return selfTest(argv)
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`[${GATE}] ❌ 无法判定:${error}`)
    return 2
  }
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  const fi = argv.includes('--files') ? argv.indexOf('--files') : -1
  // `--files a,b` 与 `--files a b` **都得算**。旧写法只取 argv[fi+1] 那一个 token:空格分隔的
  // 第二个及之后的路径被静默丢掉(2026-10-01 实测:传 batch-outcome.ts + notice-routes.ts 时,
  // 留在名单里的是第一个,而它不在覆盖面 ⇒ 整跑 exit 2,而调用方以为两文件都在审)。
  // 读到下一个 `--` 旗标为止;`--files` 不带值仍按"未收窄"处理(既有语义一字不动)。
  const onlyFiles = (() => {
    if (fi < 0) return null
    const list = []
    for (let i = fi + 1; i < argv.length; i++) {
      if (argv[i].startsWith('--')) break
      list.push(...argv[i].split(','))
    }
    const cleaned = list.map((s) => s.trim()).filter(Boolean)
    return cleaned.length ? cleaned : null
  })()
  let out
  try {
    out = analyze(root, face, { strict: argv.includes('--strict'), onlyFiles })
  } catch (e) {
    console.error(
      `[${GATE}] 无法判定(exit 2):${e instanceof Undetermined ? e.message : `${e?.message ?? e}\n${e?.stack ?? ''}`}`,
    )
    return 2
  }
  if (argv.includes('--explain')) {
    for (const r of out.per)
      for (const c of r.candidates)
        console.log(`  · ${c.file}:${c.line} ${c.key}: ${c.expr} ⇒ ${c.disposition}`)
    // 两份惯例存量的抽样出口:阳性对照要能"数到"并"点名",只有聚合数字就等于没法复核判据。
    for (const r of out.per)
      for (const b of r.booleanAck)
        console.log(`  · 布尔ack ${b.file}:${b.line} ${b.key}: ${b.value}(不计红)`)
    for (const r of out.per)
      for (const q of r.readQuery)
        console.log(`  · 读查询count ${q.file}:${q.line} ${q.key}: ${q.expr}(不计红)`)
    // B1 的逐条处置(V1 的子集,处置各说各话时这里就是复核入口)。
    for (const r of out.per)
      for (const s of r.b1.candidates)
        console.log(
          `  · B1假ack ${s.file}:${s.line} (键=${s.key},写链=${s.receiver}.…) ⇒ ${s.disposition}${s.confirmWhy ? ` 证据=${s.confirmWhy}` : ''}`,
        )
    for (const r of out.per)
      for (const n of r.b1.noBodySites)
        console.log(`  · B1未判定 ${n.file}:${n.line} 布尔 ack 解析不出所属函数体,不判红也不记绿`)
    // B2 的逐条处置:每条都带"哪一跳、被调文件里的哪一个函数",这样判红时才复核得了结论。
    for (const r of out.per)
      for (const s of r.b2.candidates)
        console.log(
          `  · B2委托ack ${s.file}:${s.line} (键=${s.key}) → ${s.callee ? `${s.callee.file}#${s.callee.name}` : '(未解析)'} ⇒ ${s.disposition}${s.callee?.why ? ` (${s.callee.why})` : ''}`,
        )
    for (const r of out.per)
      for (const u of r.b2.undetermined)
        for (const k of u.undetermined)
          console.log(
            `  · B2未判定 ${u.file}:${u.line} ${k.kind}${k.name ? ` (${k.name})` : ''}${k.specifier ? ` ← '${k.specifier}'` : ''} 那一跳判不出,不记通过也不判红`,
          )
    // B3/B4 的逐条处置(候选含"绿"的处置,bounded/precondition 各说各话 —— 复核入口同 B1/B2)。
    for (const r of out.per)
      for (const s of r.b3.candidates)
        console.log(
          `  · B3回填 ${s.file}:${s.line} set→${s.col}(via=${s.via}) ⇒ ${s.disposition}${s.whereWhy ? ` (${s.whereWhy})` : ''}`,
        )
    for (const r of out.per)
      for (const s of r.b4.candidates)
        console.log(
          `  · B4终态 ${s.file}:${s.line} set→${s.col} ⇒ ${s.disposition}${s.whereWhy ? ` (${s.whereWhy})` : ''}(只拦新增,不进 --strict)`,
        )
    for (const r of out.per)
      for (const s of r.b5.candidates)
        console.log(
          `  · B5排序 ${s.file}:${s.line} orderBy→${s.orderByExcerpt} ⇒ ${s.disposition}${s.orderByWhy ? ` (${s.orderByWhy})` : ''}(只拦新增,不进 --strict)`,
        )
    // B6 的逐条处置:候选含"绿"的处置(具名合并/jsonb_set/声明),且**必须带上专属面增量**
    // (b6OnlyPer 的 services/plugins 文件不在 out.per,漏掉它们 = --explain 复核入口对 B6 失明)。
    for (const r of [...out.per, ...(out.b6OnlyPer || [])])
      for (const s of r.b6.candidates)
        console.log(
          `  · B6jsonb ${s.file}:${s.line} set→${s.setExcerpt} ⇒ ${s.disposition}${s.setWhy ? ` (${s.setWhy})` : ''}(只拦新增,不进 --strict)`,
        )
    // B7 的逐条处置:候选含"绿"的处置(裸回全行/带时间列),面与基础面同一张表(out.per 已覆盖)。
    for (const r of out.per)
      for (const s of r.b7.candidates)
        console.log(
          `  · B7写时刻 ${s.file}:${s.line} returning→${s.excerpt} ⇒ ${s.disposition}${s.why ? ` (${s.why})` : ''}(只拦新增,不进 --strict)`,
        )
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          gate: GATE,
          root,
          face: out.face,
          strict: out.strict,
          counts: out.counts,
          exempt: out.exempt,
          violations: out.violations,
          undetermined: out.undetermined,
          ratcheted: out.ratcheted,
          exit: out.exit,
          // B1 / B2 自己的键一律**追加在末尾**:既有顶层字段名与 counts 既有字段名的取值形态逐字不变
          // (镜像 M10 钉这一点)。
          b1Violations: out.b1Violations,
          b1NoBody: out.b1NoBody,
          b2Violations: out.b2Violations,
          b2Undetermined: out.b2Undetermined,
          // G-815953/G-815956/G-815955/G-815954/G-815984:继续**追加在末尾**(镜像 M10/M18 同一条契约 —— 只追加不改写)。
          b3Violations: out.b3Violations,
          b4Violations: out.b4Violations,
          b5Violations: out.b5Violations,
          b6Violations: out.b6Violations,
          b7Violations: out.b7Violations,
        },
        null,
        2,
      ),
    )
    return out.exit
  }
  for (const line of formatReport(out)) console.log(`[${GATE}] ${line}`)
  return out.exit
}

/* ------------------------------- 自检 ------------------------------- */

/** 夹具骨架:一份最小路由文件,每个 handler 一组行。共用骨架才不会让"文件形状"本身成为变量。 */
const h = (...handlers) =>
  [
    "import { inArray } from 'drizzle-orm'",
    "import { success } from '../utils/envelope.js'",
    ...handlers.flatMap((b) => ['server.delete(basePath, async (request, reply) => {', ...b, '})']),
    '',
  ].join('\n')

const FIX = {
  selfCount: h([
    '  const idList = request.body.ids',
    '  await db.delete(table).where(inArray(table.id, idList))',
    '  return reply.send(success({ deleted: idList.length }))',
  ]),
  returning: h([
    '  const deleted = await db',
    '    .delete(table)',
    '    .where(inArray(table.id, ids))',
    '    .returning()',
    '  return reply.send(success({ deleted: deleted.length }))',
  ]),
  outlet:
    "import { batchWriteOutcome } from '../utils/batch-outcome.js'\n" +
    // 第二条 handler 是"同一文件里还没迁完的老端点":有唯一出口 import ⇒ 整文件放过(E2);
    // 去掉 import 就必须变红 —— 那条对照是 outletNoImport(证明 E2 不是恒真)。
    h(
      [
        '  const rows = await db.delete(table).where(inArray(table.id, idList)).returning({ id: table.id })',
        '  const o = batchWriteOutcome(idList, rows.map((r) => r.id))',
        '  return reply.send(success({ affected: o.affected, missedIds: o.missedIds }))',
      ],
      [
        '  await db.delete(table).where(inArray(table.id, idList))',
        '  return reply.send(success({ affected: idList.length }))',
      ],
    ),
  outletNoImport: h([
    '  await db.delete(table).where(inArray(table.id, idList))',
    '  return reply.send(success({ affected: idList.length }))',
  ]),
  preQuery: h([
    '  const owned = await dbRead',
    '    .select({ id: cards.id })',
    '    .from(cards)',
    '    .where(and(eq(cards.userId, userId), inArray(cards.id, body.data.ids)))',
    '  const ownedIds = owned.map((r) => r.id)',
    '  if (ownedIds.length > 0) await db.delete(cards).where(inArray(cards.id, ownedIds))',
    '  return reply.send(success({ deleted: ownedIds.length }))',
  ]),
  preQueryRequestSide: h([
    '  const owned = await dbRead',
    '    .select({ id: cards.id })',
    '    .from(cards)',
    '    .where(and(eq(cards.userId, userId), inArray(cards.id, body.data.ids)))',
    '  const ownedIds = owned.map((r) => r.id)',
    '  if (ownedIds.length > 0) await db.delete(cards).where(inArray(cards.id, ownedIds))',
    '  return reply.send(success({ deleted: body.data.ids.length }))',
  ]),
  markerOk: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({',
    '    // batch-count-exempt: 该表有触发器逐行归档,删除数恒等于请求数,见 docs/x.md',
    '    deleted: ids.length,',
    '  }))',
  ]),
  markerBare: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({ deleted: ids.length })) // batch-count-exempt:',
  ]),
  regexQuote: h([
    "  const cleaned = ids.map((x) => x.replace(/'/g, ''))",
    '  await db.delete(table).where(inArray(table.id, cleaned))',
    '  return reply.send(success({ deleted: cleaned.length }))',
  ]),
  // 字符类里的反引号/引号(真仓 feature-center.ts 的 /[*`_~]/g 就是这一型):不吞掉整段正则,
  // 整份文件就会被后面的"模板未闭合"读盲 —— 判据看不见存量却一路报绿。
  regexClass: h([
    "  const cleaned = ids.map((x) => x.replace(/[*`_'~]/g, ''))",
    '  await db.delete(table).where(inArray(table.id, cleaned))',
    '  return reply.send(success({ deleted: cleaned.length }))',
  ]),
  boolAck: h([
    '  await db.delete(table).where(eq(table.id, p.data.id))',
    '  return reply.send(success({ id: p.data.id, deleted: true }))',
  ]),
  // V1 阳性对照的三个真形态:单行无尾逗号 / 带尾逗号 / 跨行对象字面量 —— 三个都该被现读到。
  // 2026-09-27 起这里刻意**不放写链**:同函数体有 db.delete/update 的那一子集已是 B1 的射程
  // (见 FIX.b1FalseAck),R8「惯例形态不改退出码(含 --strict)」这条不变量要的是纯惯例面 ——
  // 带链的两型各有夹具,混在一起就分不清"V1 只报数"和"B1 判红"是谁的账。
  boolAckCount: h(
    ['  return reply.send(success({ deleted: true }))'],
    ['  return reply.send(success({ id: 2, deleted: true, }))'],
    ['  return reply.send(success({', '    deleted: true,', '  }))'],
  ),
  // V1 必须**不**数的近邻形状:键族不在这一档(restored 自 2026-09-27 起**已是**键族成员,所以它
  // 从这里移走、换成 `archived`)、值不是布尔字面量(affected/rows.length)、字面量后面还接着算式或
  // 更长的标识符。放宽到"任何含 deleted 的行"就会把这些一并混进同一个数。
  boolAckNearMiss: h(
    ['  const affected = 1', '  return reply.send(success({ deleted: affected }))'],
    ['  return reply.send(success({ deleted: rows.length }))'],
    ['  return reply.send(success({ archived: true }))'],
    ['  return reply.send(success({ isDeleted: true }))'],
    ['  return reply.send(success({ deleted: true === flag }))'],
    ['  return reply.send(success({ deleted: trueOrFalse }))'],
  ),
  // N3 同一条遮噪方向也管惯例计数:注释与字符串里的 `deleted: true` 不得进账。
  boolAckInComment: h(
    [
      '  // 旧实现曾返回 reply.send(success({ deleted: true })) —— 现按库确认计数',
      '  return reply.send(success({ ok: true }))',
    ],
    [
      "  const doc = '形如 reply.send(success({ deleted: true })) 的响应'",
      '  return reply.send(success({ ok: true, doc }))',
    ],
  ),
  // 三族同时出现在一份文件里:违规 1 / 布尔 ack 1 / 读查询 1 —— 各计各的,谁也不得串到谁的账上。
  mixedAll: h(
    [
      '  await db.delete(table).where(inArray(table.id, idList))',
      '  return reply.send(success({ deleted: idList.length }))',
    ],
    ['  await db.delete(t).where(eq(t.id, 1))', '  return reply.send(success({ deleted: true }))'],
    [
      '  const rows = await db.select().from(t).where(inArray(t.id, ids))',
      '  return reply.send(success({ rows, count: rows.length }))',
    ],
  ),
  readQuery: h([
    '  const rows = await db.select().from(t).where(inArray(t.id, ids))',
    '  return reply.send(success({ rows, count: rows.length }))',
  ]),
  commentOnly: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  // 旧实现:reply.send(success({ deleted: ids.length })) —— 已改为按库确认计数',
    '  return reply.send(success({ ok: true }))',
  ]),
  stringOnly: h([
    "  const doc = '示例: db.delete(t).where(inArray(t.id, ids)) 然后 reply.send(success({ deleted: ids.length }))'",
    '  return reply.send(success({ ok: true, doc }))',
  ]),
  chainAfter: h([
    '  const r = reply.send(success({ deleted: ids.length }))',
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return r',
  ]),
  registrar: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({ deleted: ids.length }))',
  ]).replace('server.delete(basePath', 'server.delete("/x"'),
  // ---- B1(2026-09-27)夹具:布尔 ack × 写链 × 库确认/豁免 的成对正反例 ----
  /** 假 ack 本尊:同函数体真发了 delete,却无条件回 deleted: true(HEAD 存量主型)。 */
  b1FalseAck: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** 同文件第二处同型(供"新增即红"与"违规×2"读数)。 */
  b1FalseAckTwice: h(
    ['  await db.delete(a).where(eq(a.id, id))', '  return reply.send(success({ deleted: true }))'],
    [
      '  await db.update(b).set({ gone: true }).where(eq(b.id, id2))',
      '  return reply.send(success({ deleted: true }))',
    ],
  ),
  /** 放过 F1a:链上 .returning( —— 体内有库确认调用即放过,不追问这条 ack 用的是不是它。 */
  b1ConfirmedReturning: h([
    '  await db.delete(table).where(eq(table.id, id)).returning({ id: table.id })',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** 放过 F1b:体内 batchWriteOutcome( 调用(即便这处仍回字面量,已在迁移途中,不算"新写假 ack")。 */
  b1ConfirmedOutletCall: h([
    '  const rows = await db.delete(table).where(eq(table.id, id))',
    '  const o = batchWriteOutcome(idList, rows)',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** F1 的反面:.returning( 只活在注释里 ⇒ 不配放过(判据跑在遮蔽后的代码面上)。 */
  b1ReturningOnlyInComment: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  // 这里本该写 .returning( 但没写,门不得被一句解释性注释骗过',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** 放过 F2:带原因、同行尾注释的行内豁免。 */
  b1MarkerOk: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt: 该表触发器保证必删一行,见 docs/z.md',
  ]),
  /** F2 反面①:裸标记无原因 ⇒ 仍红并计裸标记数(与门 102/108 同规矩)。 */
  b1MarkerBare: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt:',
  ]),
  /** F2 反面②:标记写在紧邻上一行 ⇒ 不放行(B1 刻意只本行生效,比 batch-count-exempt 严一档)。 */
  b1MarkerPrevLine: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  // delete-ack-exempt: 标记在上一行,这一族不走"紧邻上一行"通道',
    '  return reply.send(success({ id, deleted: true }))',
  ]),
  /** F2 反面③:标记落在字符串里 ⇒ 不是注释,不放行。 */
  b1MarkerInString: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  return reply.send(success({ id, deleted: true, doc: "delete-ack-exempt: 这不是注释" }))',
  ]),
  /** 读查询面(N3③):deleted: true 出现在 select 映射 / 字符串 / 注释 ⇒ V1 与 B1 都不进。 */
  b1ReadFace: h([
    '  await db.delete(table).where(eq(table.id, id))',
    '  const rows = await db.select({ id: t.id, deleted: true }).from(t)',
    "  const doc = '老响应形如 reply.send(success({ deleted: true }))'",
    '  // reply.send(success({ deleted: true })) 是旧写法,已废',
    '  return reply.send(success({ rows, doc, ok: true }))',
  ]),
  /** E2(文件级 import 唯一出口)不救 B1:import 了 ≠ 这一处走了库确认。 */
  b1OutletFileStillJudged:
    "import { batchWriteOutcome } from '../utils/batch-outcome.js'\n" +
    h([
      '  await db.delete(table).where(eq(table.id, id))',
      '  return reply.send(success({ id, deleted: true }))',
    ]),
  /** 找不到函数体:模块顶层的布尔 ack ⇒ B1 未判定(不判红也不记绿),也不进候选。 */
  b1NoBody: 'const legacy = api.send(success({ deleted: true }))\n',
  /** 已改真的形状(BR 棘轮序列用):库确认集合推出真值,响应里不再有字面量 true。 */
  b1Migrated: h([
    '  const rows = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id })',
    '  return reply.send(success({ id, deleted: rows.length > 0 }))',
  ]),
  // ---- B3(G-815953)夹具:回填 UPDATE 的正反例(判据四)----
  /** 红腿(票面镜像形状):按 isNull 划线的无界回填 —— 迁移记账列 + 无时间上界。 */
  b3Unbounded: [
    'export async function backfillBatch() {',
    '  await db.update(idMapping).set({ migrationBatch: "batch-2" }).where(isNull(idMapping.migratedAt))',
    '}',
    '',
  ].join('\n'),
  /** 绿腿①:lte 时间上界(票面镜像的绿腿)。 */
  b3BoundedLte: [
    'export async function backfillBatch(baseline: Date) {',
    '  await db.update(idMapping).set({ migrationBatch: "batch-2" }).where(and(eq(idMapping.migrationBatch, "batch-1"), lte(idMapping.updatedAt, baseline)))',
    '}',
    '',
  ].join('\n'),
  /** 绿腿②:走唯一出口 backfillWhere(其实参自带 backfillWhere( 字样)。 */
  b3BoundedOutlet: [
    "import { backfillWhere } from '../utils/backfill-baseline.js'",
    'export async function backfillBatch(baseline: Date) {',
    '  await db.update(idMapping).set({ migrationBatch: "batch-2" }).where(backfillWhere({ column: idMapping.updatedAt, baselineTime: baseline, conditions: [eq(idMapping.migrationBatch, "batch-1")] }))',
    '}',
    '',
  ].join('\n'),
  /** 反假阳锁:软删形状与回填词法同形,但 set 不含迁移记账列 ⇒ 不得进 B3 的面(收窄判据的命门)。 */
  b3SoftDelete: [
    'export async function softDeleteSession(id: string) {',
    '  await db.update(sessions).set({ deletedAt: new Date() }).where(and(eq(sessions.id, id), isNull(sessions.deletedAt)))',
    '}',
    '',
  ].join('\n'),
  /** 裸 SQL 维红腿:UPDATE 迁移列、WHERE 无上界。 */
  b3RawUnbounded: [
    'export async function backfillRaw(from: string, to: string) {',
    '  await db.execute(sql`UPDATE id_mapping SET migration_batch = ${to} WHERE migration_batch = ${from}`)',
    '}',
    '',
  ].join('\n'),
  /** 裸 SQL 维绿腿:SQL 串里带 <= 上界。 */
  b3RawBounded: [
    'export async function backfillRaw(from: string, to: string, baseline: Date) {',
    '  await db.execute(sql`UPDATE id_mapping SET migration_batch = ${to} WHERE migration_batch = ${from} AND time_updated <= ${baseline}`)',
    '}',
    '',
  ].join('\n'),
  // ---- B4(G-815956)夹具:终态回退的正反例(判据五,棘轮专用维)----
  /** 红腿(票面镜像形状):字面量 status、where 只有主键 eq —— 迟到终态事件会覆盖已终态记录。 */
  b4LiteralNoPre: [
    'export async function cancelOrder(id: string) {',
    '  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, id))',
    '}',
    '',
  ].join('\n'),
  /** 绿腿:补**同一状态列**的前置(票面镜像的绿腿)。 */
  b4LiteralWithPre: [
    'export async function cancelOrder(id: string) {',
    '  await db.update(orders).set({ status: "cancelled" }).where(and(eq(orders.id, id), eq(orders.status, "pending")))',
    '}',
    '',
  ].join('\n'),
  /** 无 where 变体:全表改状态 ⇒ 同判红(比带 where 的更裸)。 */
  b4NoWhere: [
    'export async function cancelAllOrders() {',
    '  await db.update(orders).set({ status: "cancelled" })',
    '}',
    '',
  ].join('\n'),
  /** 判不了格钉子(票面明说上游 settleSessionInput/markSessionInput 等判不了):
   *  变量值 / 简写 / spread ⇒ 遮蔽面上有可见 token,不进面 —— 不判红也不计候选,绝不假装已解决。 */
  b4Unjudgeable: [
    'export async function settle(input: { id: string; next: string }) {',
    '  await db.update(orders).set({ status: input.next }).where(eq(orders.id, input.id))',
    '  await db.update(orders).set({ status }).where(eq(orders.id, id))',
    '  await db.update(orders).set({ ...patch }).where(eq(orders.id, id))',
    '}',
    '',
  ].join('\n'),
  // ---- B5(G-815955)夹具:排序无尾键的正反例(判据六,棘轮专用维与 B4 同构)----
  /** 红腿(票面镜像形状):单键 asc(sortOrder) 无尾键 —— 同值行两次查询间座位不定(分页漂移)。 */
  b5SingleNoTail: [
    'import { asc } from "drizzle-orm"',
    'export async function listPlans() {',
    '  await db.select().from(plans).orderBy(asc(plans.sortOrder))',
    '}',
    '',
  ].join('\n'),
  /** 绿腿:补确定性尾键(票面正例形态);尾键最后一键 id 能唯一定位行。 */
  b5WithTailKey: [
    'import { asc, desc } from "drizzle-orm"',
    'export async function listPlans() {',
    '  await db.select().from(plans).orderBy(asc(plans.sortOrder), desc(plans.createdAt), asc(plans.id))',
    '}',
    '',
  ].join('\n'),
  /** 变体:desc + sequence 列同判(键族不限 sortOrder、方向不限 asc)。 */
  b5DescSequence: [
    'import { desc } from "drizzle-orm"',
    'export async function listQueue() {',
    '  await db.select().from(tasks).orderBy(desc(tasks.sequence))',
    '}',
    '',
  ].join('\n'),
  /** 判不了格钉子(头注 B5 段):变量键 / sql` 模板 / 首键非本键族 ⇒ 不进面 —— 不判红也不计候选。 */
  b5Unjudgeable: [
    'import { asc, sql } from "drizzle-orm"',
    'export async function listThings(sortCol: any) {',
    '  await db.select().from(t).orderBy(sortCol)',
    '  await db.select().from(t).orderBy(sql`sort_order asc`)',
    '  await db.select().from(t).orderBy(asc(t.name))',
    '}',
    '',
  ].join('\n'),
  // ---- B6(G-815954)夹具:jsonb 整列覆盖无声明的正反例(判据七,棘轮专用维与 B4/B5 同构)----
  /** 红腿(票面"整块 excluded ⇒ 红"的镜像形状):EXCLUDED.* 整列搬入 —— 别的写入方的具名成员被整笔吃掉。 */
  b6ExcludedBare: [
    'import { sql } from "drizzle-orm"',
    'export async function upsertThing(row: NewThing) {',
    '  await db.insert(things).values(row).onConflictDoUpdate({',
    '    target: things.id,',
    '    set: { payload: sql`EXCLUDED.payload` },',
    '  })',
    '}',
    '',
  ].join('\n'),
  /** 绿腿:jsonb_set 指定路径(票面正例;`jsonb_set(` 在模板串静态段,只在"留字符串"档可见)。 */
  b6JsonbSet: [
    'import { sql } from "drizzle-orm"',
    'export async function touchThing(id: string, flag: boolean) {',
    '  await db.insert(things).values({ id }).onConflictDoUpdate({',
    '    target: things.id,',
    "    set: { payload: sql`jsonb_set(${things.payload}, '{a}', ${flag}::jsonb)` },",
    '  })',
    '}',
    '',
  ].join('\n'),
  /** 绿腿:具名成员合并(票面正例;`||`/`::jsonb` 都是模板串静态文本,只在"留字符串"档可见)。 */
  b6NamedMerge: [
    'import { sql } from "drizzle-orm"',
    'export async function mergeThing(id: string, patch: Record<string, unknown>) {',
    '  await db.insert(things).values({ id }).onConflictDoUpdate({',
    '    target: things.id,',
    '    set: { metadata: sql`${things.metadata} || ${JSON.stringify(patch)}::jsonb` },',
    '  })',
    '}',
    '',
  ].join('\n'),
  /** 绿腿:整列覆盖 + **逐列**声明注释(键行上一行;session-store 现行写法)。 */
  b6FullDeclared: [
    'export async function persistSession(session: AgentSession) {',
    '  await db.insert(agentRuntimeSessions).values(session).onConflictDoUpdate({',
    '    target: agentRuntimeSessions.id,',
    '    set: {',
    '      // messages:全量真相 —— 内存态即完整转写,整列落盘。',
    '      messages: session.context.messages,',
    '    },',
    '  })',
    '}',
    '',
  ].join('\n'),
  /** 变异对照:上一条**删掉声明注释** ⇒ 必须转红 —— 逐列声明是整列覆盖的唯一放行通道。 */
  b6FullNoDecl: [
    'export async function persistSession(session: AgentSession) {',
    '  await db.insert(agentRuntimeSessions).values(session).onConflictDoUpdate({',
    '    target: agentRuntimeSessions.id,',
    '    set: {',
    '      messages: session.context.messages,',
    '    },',
    '  })',
    '}',
    '',
  ].join('\n'),
  /** 冒充钉子 B6g:纯字符串值里带 `|| …::jsonb` —— 遮蔽档剩空白,冒充不了合并,照红。 */
  b6StringMerge: [
    'import { db } from "./db.js"',
    'export async function upsertKv(key: string) {',
    '  await db.insert(kv).values({ key }).onConflictDoUpdate({',
    '    target: kv.key,',
    '    set: { metadata: "x || y::jsonb" },',
    '  })',
    '}',
    '',
  ].join('\n'),
  /** JS 层 `||` 钉子:值运算是 JS 逻辑或、产出整颗新值 = 整列覆盖(无 sql` 标签 ⇒ 非合并),照红。 */
  b6JsOr: [
    'import { db } from "./db.js"',
    'export async function upsertFlag(id: string, enabled: boolean) {',
    '  await db.insert(things).values({ id }).onConflictDoUpdate({',
    '    target: things.id,',
    '    set: { metadata: enabled || false },',
    '  })',
    '}',
    '',
  ].join('\n'),
  /** 冒充钉子 B6s:声明字样活在**字符串值**里 ⇒ 同位判档(留字符串档同位读得到)+ 无注释符,拒绝,照红。 */
  b6StringDecl: [
    'import { db } from "./db.js"',
    'export async function upsertKv(key: string) {',
    '  await db.insert(kv).values({ key }).onConflictDoUpdate({',
    '    target: kv.key,',
    '    set: { messages: "messages:全量真相 —— 完整转写" },',
    '  })',
    '}',
    '',
  ].join('\n'),
  // ---- B7(G-815984)夹具:写时刻不回传的正反例(判据八,棘轮专用维与 B4/B5/B6 同构)----
  /** 红腿:取了业务列(name)却不取回任何时间列 —— 写入时刻没回给调用方。 */
  b7ProjNoTime: [
    'export async function renameThing(id: string, name: string) {',
    '  const rows = await db.update(things).set({ name }).where(eq(things.id, id)).returning({ id: things.id, name: things.name })',
    '  return rows',
    '}',
    '',
  ].join('\n'),
  /** 绿腿(id-count 豁免半句):纯 id 计数投影 —— 票面"写链 `.returning({id})` 之外"的既有绿形态。 */
  b7IdCountOnly: [
    'export async function renameThing(id: string, name: string) {',
    '  const rows = await db.update(things).set({ name }).where(eq(things.id, id)).returning({ id: things.id })',
    '  return rows',
    '}',
    '',
  ].join('\n'),
  /** 绿腿(票面正例):同一写链的显式投影带上 updatedAt —— 写时刻原样回给调用方。 */
  b7ProjWithTime: [
    'export async function renameThing(id: string, name: string) {',
    '  const rows = await db.update(things).set({ name }).where(eq(things.id, id)).returning({ id: things.id, updatedAt: things.updatedAt })',
    '  return rows',
    '}',
    '',
  ].join('\n'),
  /** 绿腿:裸 `.returning()` 无参 = 回全行(时间列结构性在内),处置 bare-full-row。 */
  b7BareFullRow: [
    'export async function renameThing(id: string, name: string) {',
    '  const rows = await db.update(things).set({ name }).where(eq(things.id, id)).returning()',
    '  return rows',
    '}',
    '',
  ].join('\n'),
  /** 判不了格(不进面):投影实参经变量传入 —— 里面有没有时间列词法不可知,不假装已判。 */
  b7ProjVarArg: [
    'export async function renameThing(id: string, name: string, cols) {',
    '  const rows = await db.update(things).set({ name }).where(eq(things.id, id)).returning(cols)',
    '  return rows',
    '}',
    '',
  ].join('\n'),
  /** 判不了格(不进面):投影对象带展开 —— `...pick` 是否含时间列词法不可知。 */
  b7ProjSpread: [
    'export async function renameThing(id: string, name: string, pick) {',
    '  const rows = await db.update(things).set({ name }).where(eq(things.id, id)).returning({ id: things.id, ...pick })',
    '  return rows',
    '}',
    '',
  ].join('\n'),
  /** 冒充钉子 B7f:注释里提时间列 ⇒ 全遮蔽档剥注释,业务列投影里没有就是没有,照红。 */
  b7CommentTime: [
    'export async function renameThing(id: string, name: string) {',
    '  // 以后需要时序的话记得把 createdAt 也取回去',
    '  const rows = await db.update(things).set({ name }).where(eq(things.id, id)).returning({ id: things.id, name: things.name })',
    '  return rows',
    '}',
    '',
  ].join('\n'),
}

/* ---- 2026-09-27 第二十九批:键族扩面 + "证据在别处"四型的夹具 ----
 * FAMILY_KEYS_EXPECTED 是**自检侧独立写死**的期望表(不从 BOOL_ACK_KEYS 派生):把判据的键表削短,
 * K0 这一支必读红 —— 那正是"预筛/键表漏一个键 ⇒ 门对整型静默失明而账面照报绿"的形态(门 102 的
 * 预筛超集对账同一条理由、同一写法)。
 */
const FAMILY_KEYS_EXPECTED = ['deleted', 'removed', 'restored', 'revoked', 'cleared']
/** 逐键"命中"正例:每键一枚 handler,体内真发 delete、无库确认、无载体 ⇒ 键键都该被 B1 判违规。 */
const FAMILY_HIT = h(
  ...FAMILY_KEYS_EXPECTED.map((k) => [
    '  await db.delete(table).where(eq(table.id, id))',
    `  return reply.send(success({ ${k}: true }))`,
  ]),
)
/** 逐键"该放过"反例:形状逐字相同,只是体内**没有**任何 db/tx 写链 ⇒ 纯惯例面,B1 一律不判。 */
const FAMILY_LETGO = h(
  ...FAMILY_KEYS_EXPECTED.map((k) => ['  return reply.send(success({ ' + k + ': true }))']),
)
/** 型②:organization.ts 的真实形状 —— 删除走 db.execute 的原生 SQL,库答复住在模板串里
 *  (遮蔽后的代码面看不见模板内容,所以既有 F1 的 .returning( 永远读不到它)。 */
const RAW_SQL_DELETE =
  '    sql`DELETE FROM organization_members WHERE org_id::text = ${id} RETURNING id`,'
const HONEST_RAW_SQL = h([
  '  const rows = await db.execute(',
  RAW_SQL_DELETE,
  '  )',
  '  if (rows.length === 0) return reply.status(404).send(error(404, "成员不存在"))',
  '  return reply.send(success({ userId: id, removed: true }))',
])
/** 型②的"有牙"版本:同一体内**另外**还有一条看得见的 drizzle 写链(即"摘掉 .returning( 的那一型")
 *  —— 只有承认"体内有写"这一格仍然放过,才说明放过来自那条 RETURNING 证据,而不是来自判据看不见。 */
const HONEST_RAW_SQL_WITH_CHAIN = h([
  '  await db.delete(table).where(eq(table.id, id))',
  '  const rows = await db.execute(',
  RAW_SQL_DELETE,
  '  )',
  '  return reply.send(success({ userId: id, removed: true }))',
])
const HONEST_RAW_SQL_NO_RETURNING = HONEST_RAW_SQL_WITH_CHAIN.replace(' RETURNING id', '')
/* ---- 2026-09-27 第三十批:**裸 SQL 写链**这一维的夹具(普查实测的两处病灶形状)----
 * 立门前的事实:HEAD 面 `apps/api/src` 的 raw-SQL 写 90 处,其中两处被逐体读成病灶
 * (user-llm-configs-v2.ts 的 UPDATE 不带 RETURNING 而回 `updated:true`、
 *  ai-extended.ts 的 RETURNING 命中集为空时走 `?? { updated: true }` 兜底)。
 * 这两处的 ack 键是 `updated` —— **不在** BOOL_ACK_KEYS 五键族内(加键属全 API 语义决策,须逐键
 * 拍板并先清偿存量,不是这道门能顺手扩的),所以本维对它们的覆盖方式是:**换同族键即红**由 RAW_WRITE_*
 * 钉死(把 `updated` 换成 `deleted` 就是 HEAD 面已判红的那一型),而不是把这两个键塞进键表凑数。 */
/** 正例(必红):写住在 `db.execute(sql`DELETE FROM …`)` 里、**没有 RETURNING**,响应回布尔字面量。 */
const RAW_WRITE_LIE = h([
  '  await db.execute(',
  '    sql`DELETE FROM organization_members WHERE org_id::text = ${id} AND user_id::text = ${uid}`,',
  '  )',
  '  return reply.send(success({ id, deleted: true }))',
])
/** 反例(必 0 违规、按库确认放过):逐字同上,只补 `RETURNING id`。 */
const RAW_WRITE_HONEST = RAW_WRITE_LIE.replace(
  'AND user_id::text = ${uid}`',
  'AND user_id::text = ${uid} RETURNING id`',
)
/** 反假阳:读查询里出现大写 `'UPDATE'` **值**、以及把写动词藏进注释 ⇒ 不得算写链。 */
const RAW_READ_ONLY = h([
  '  // 这里注释提到 DELETE FROM 与 UPDATE x,但正文只读',
  "  const rows = await db.execute(sql`SELECT id, action FROM audit WHERE action = 'UPDATE'`)",
  '  return reply.send(success({ id, deleted: true }))',
])
/** 未判定:execute 调用的括号配不到(模板里混进未闭合括号)⇒ 判不了动词,不冒红也不记绿。 */
const RAW_WRITE_UNPARSED = h([
  '  await db.execute(sql`DELETE FROM t WHERE id IN (${id}`,',
  '  return reply.send(success({ id, deleted: true }))',
])
/** 型③:内存 Map 的 delete 返回真布尔,404 由它派生 —— 没有"库侧行"这个概念,不属本型。 */
const HONEST_MEMORY_MAP_DELETE = h([
  '  if (!ipBlacklist.delete(ip)) {',
  '    return reply.status(404).send(error(404, "IP 不在黑名单中"))',
  '  }',
  '  return reply.send(success({ removed: true }))',
])
/** 型③之二:整片重置一个内存 store(visit/openclaw 两处的共同形状)。 */
const HONEST_MEMORY_STORE_RESET = h([
  '  memoryStore.set(userId, [])',
  '  return reply.send(success({ cleared: true }))',
])
/** 型④:agents.ts 的真实形状 —— 布尔档不承诺行数,行数由同响应里那枚诚实字段承载。 */
const HONEST_SIBLING_CARRIER = h([
  '  const keys = await redis.keys(pattern)',
  '  const deleted = await redis.del(...keys)',
  '  return reply.send(success({ cleared: true, deleted, prefix: CACHE_PREFIX }))',
])
/** 型④的"有牙"版本:同体内再挂一条无答复的 drizzle 写链 ⇒ 载体仍然成立(放过);去掉载体则必红。 */
const HONEST_SIBLING_WITH_CHAIN = h([
  '  await db.delete(table).where(eq(table.id, id))',
  '  const deleted = await redis.del(...keys)',
  '  return reply.send(success({ cleared: true, deleted, prefix: CACHE_PREFIX }))',
])
const NO_SIBLING_WITH_CHAIN = h([
  '  await db.delete(table).where(eq(table.id, id))',
  '  const deleted = await redis.del(...keys)',
  '  return reply.send(success({ cleared: true, prefix: CACHE_PREFIX }))',
])
/** 载体写成"键 : 某个标识量"(带冒号)⇒ 结构上不算载体:那支可以被凭空捏造,简写才要求真有同名变量。 */
const FAKE_SIBLING_REQUEST_SIDE = h([
  '  await db.delete(table).where(eq(table.id, id))',
  '  return reply.send(success({ cleared: true, deleted: idList.length }))',
])

/* ---- B2(2026-09-27)夹具:一跳委托的删除 ack ----
 * 调用方与**两条腿**的正文都是夹具,判据跑在注入的 calleeIndex 上 ⇒ 自检零 git 派生也能走完整条
 * 判据(与 analyze 用的是同一份 planDelegatedAckSites / finishDelegatedAckSite 实现,不另写一份)。
 */
export const B2_CALLER = 'apps/api/src/routes/b2.ts'
export const B2_CALLEE = 'apps/api/src/db/b2-queries.ts'
const callerWith = (importLine, body) =>
  [
    "import { eq } from 'drizzle-orm'",
    "import { success } from '../utils/envelope.js'",
    importLine,
    'server.delete(basePath, async (request, reply) => {',
    '  const { id } = idParam.parse(request.params)',
    ...body,
    '  return reply.send(success({ id, deleted: true }))',
    '})',
    '',
  ].join('\n')
const namedImport = `import { deleteThing } from '${B2_CALLEE.replace('apps/api/src/', '../').replace('.ts', '.js')}'`
/** 各夹具共用的体内语句(提成常量既避长行,也让"同一形态"在夹具里只有一份写法)。 */
const AW = ['  await deleteThing(id)']
const AW_NS = ['  await q.deleteThing(id)']

const B2FIX = {
  /** 委托本体:ack 体内没有直接写链,真 delete 住在另一文件的具名导出函数里。 */
  delegated: callerWith(namedImport, AW),
  /** 被调腿:写链上没有 .returning( ⇒ 这一跳就是"库没答复"。 */
  calleeNoReturning:
    'export async function deleteThing(id: string): Promise<void> {\n  await db.delete(things).where(eq(things.id, id))\n}\n',
  /** 被调腿:第二十六批产出的形态(回报 RETURNING 命中集)⇒ 必须判放过,不得把修好的代码判红。 */
  calleeReturning:
    'export async function deleteThing(id: string): Promise<number> {\n  const rows = await db.delete(things).where(eq(things.id, id)).returning({ id: things.id })\n  return rows.length\n}\n',
  /** 被调腿走唯一出口 ⇒ 同样放过(与 B1 的 F1b 同一条理由)。 */
  calleeOutlet:
    'export async function deleteThing(id: string) {\n  return batchWriteOutcome([id], await db.delete(things).where(eq(things.id, id)).returning({ id: things.id }))\n}\n',
  /** 被调腿确实没有带 where 的写链(纯缓存清理)⇒ 真绿,不塞进未判定充数。 */
  calleeNoWrite:
    'export async function deleteThing(id: string): Promise<void> {\n  await cache.remove(id)\n}\n',
  /** 被调腿是 const + 箭头(仓内实测两种导出形态都有)⇒ 判据必须认这一种。 */
  calleeConstArrow:
    'export const deleteThing = async (id: string) => db.delete(things).where(eq(things.id, id))\n',
  /** 被调腿的 where 里混进函数字面量 ⇒ 分不清,落未判定。 */
  calleeOpaque:
    'export async function deleteThing(q: any): Promise<void> {\n  await db.delete(things).where((t) => eq(t.id, q.id))\n}\n',
  /** 被调文件用 export * 转发:名单不可枚举 ⇒ N1 未判定。 */
  calleeStar: "export * from './b2-impl.js'\n",
  /** 被调文件具名再导出 ⇒ 一跳之外还有第二跳,刻意不追 ⇒ 未判定。 */
  calleeReexport: "export { deleteThing } from './b2-impl.js'\n",
  /** 命名空间转发(await ns.del()):具名导出边判不出 ⇒ 未判定,且**不**因此放过整处。 */
  callerNamespace: callerWith(`import * as q from '../db/b2-queries.js'`, AW_NS),
  /** 裸包名 / workspace 包:被调函数在 apps/api/src 之外 ⇒ 未判定。 */
  callerBarePackage: callerWith("import { deleteThing } from '@ihui/database'", AW),
  /** 路径解析不到(改名/忘 add 的在途文件)⇒ 未判定。 */
  callerMissingModule: callerWith("import { deleteThing } from '../db/gone-mid-refactor.js'", [
    '  await deleteThing(id)',
  ]),
  /** 别名形态:apps/api/tsconfig 的 paths 声明 @/* → src/*,必须与相对路径同判(门让你怎么写,门就看得见)。 */
  callerAlias: callerWith("import { deleteThing } from '@/db/b2-queries.js'", AW),
  /** B1 射程(同函数体有直接写链):B2 不得重复计同一格。 */
  callerDirectChain: callerWith(namedImport, [
    '  await deleteThing(id)',
    '  await db.delete(other).where(eq(other.id, id))',
  ]),
  /** N3:委托给本文件里的 helper(不经 import)⇒ 不入 B2 的账,只在 V1 的惯例数里点名。 */
  callerLocalHelper: callerWith('', [
    '  await dropThing(id)',
    '  async function dropThing(x: string) {',
    '    await db.delete(things).where(eq(things.id, x))',
    '  }',
  ]),
  /** 标记三形态:同行带原因 / 裸标记 / 写在紧邻上一行(与 B1 同一条通道的三种判法)。
   *  标记必须落在 **ack 那一行** —— 命中行号取的是响应对象里 `deleted` 所在的位置。 */
  callerMarkerOk: callerWith(namedImport, AW).replace(
    '  return reply.send(success({ id, deleted: true }))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt: 级联清理后主记录必删,见 docs/b2.md',
  ),
  callerMarkerBare: callerWith(namedImport, AW).replace(
    '  return reply.send(success({ id, deleted: true }))',
    '  return reply.send(success({ id, deleted: true })) // delete-ack-exempt:',
  ),
  callerMarkerPrevLine: callerWith(namedImport, AW).replace(
    '  await deleteThing(id)',
    '  // delete-ack-exempt: 标记写在上一行,这一族不走"紧邻上一行"通道\n  await deleteThing(id)',
  ),
  /* ---- 2026-09-27 第二十九批:型①"一跳委托的 RETURNING"的真实形状(files.ts 那一处)----
   * 委托体做**两件**写事:先 `delete … .returning()` 拿命中集、再把计数列 -1(update 无 returning)。
   * 布尔档回答的是前一件 ⇒ 按 ack 键的写动词筛选后必须判"库确认放过";旧口径"任一链缺 returning 即
   * 违规"会把这一处**已入库的诚实形状**判红,那就是与任何提交都无关的恒红门(§12e)。 */
  calleeMixedVerb:
    'export async function deleteThing(input: any): Promise<boolean> {\n' +
    '  return db.transaction(async (tx) => {\n' +
    '    const rows = await tx.delete(rel).where(eq(rel.tagId, input.tagId)).returning()\n' +
    '    if (rows.length > 0) {\n' +
    '      await tx.update(tags).set({ usageCount: sql`GREATEST(usageCount - 1, 0)` }).where(eq(tags.id, input.tagId))\n' +
    '      return true\n' +
    '    }\n' +
    '    return false\n' +
    '  })\n' +
    '}\n',
  /** 委托腿的"回退"版:摘掉 delete 链上的 .returning( ⇒ 动词筛选后剩下的正是无答复那一条 ⇒ 必红。 */
  calleeMixedVerbStripped:
    'export async function deleteThing(input: any): Promise<boolean> {\n' +
    '  return db.transaction(async (tx) => {\n' +
    '    const rows = await tx.delete(rel).where(eq(rel.tagId, input.tagId))\n' +
    '    if (rows.length > 0) {\n' +
    '      await tx.update(tags).set({ usageCount: sql`GREATEST(usageCount - 1, 0)` }).where(eq(tags.id, input.tagId))\n' +
    '      return true\n' +
    '    }\n' +
    '    return false\n' +
    '  })\n' +
    '}\n',
  /** 调用方那一侧的键换成 `removed`(真实形状),其余与 B2FIX.delegated 逐字同构。 */
  callerRemoved: callerWith(namedImport, AW).replace(
    '  return reply.send(success({ id, deleted: true }))',
    '  return reply.send(success({ removed: true }))',
  ),
  /** 型④的委托版:响应里另有诚实行数载体 ⇒ 那一跳不必再去被调体找罪证,直接按放过记账。 */
  callerSiblingCarrier: callerWith(namedImport, AW).replace(
    '  return reply.send(success({ id, deleted: true }))',
    '  return reply.send(success({ removed: true, deleted }))',
  ),
  /* ---- 票 守门134(条件性扩面①)触发条件测量的对照腿 ----
   * 判据(B2)对这两条**都不判** —— 那一跳目前只认 drizzle 链;它们是 measureB2RawSqlTrigger
   * 的阳性/阴性对照(镜像 M24),证明"HEAD 面命中 0"是测量有眼量出来的,不是测量失明读出来的。 */
  /** 被调腿发裸 SQL 写而无 RETURNING ⇒ 触发条件形状,测量必须命中。 */
  calleeRawNoReturning:
    'export async function deleteThing(id: string): Promise<void> {\n  await db.execute(sql`DELETE FROM things WHERE id = ${id}`)\n}\n',
  /** 同一条腿补 RETURNING ⇒ 库答复住在模板串里,不是触发(阴性对照)。 */
  calleeRawReturning:
    'export async function deleteThing(id: string): Promise<any[]> {\n  return db.execute(sql`DELETE FROM things WHERE id = ${id} RETURNING id`)\n}\n',
}

function selfTest(argv) {
  const R = []
  const eq = (name, got, want) => {
    const g = JSON.stringify(got),
      w = JSON.stringify(want)
    R.push(`${g === w ? '✅' : '❌'} ${name}${g === w ? '' : ` → 实得 ${g} 期望 ${w}`}`)
  }
  const v = (t) => scanFileText('apps/api/src/routes/x.ts', t)
  const st = (t) => {
    const r = v(t)
    return [r.candidates.length, r.violations.length, r.undetermined.length]
  }
  const trip = (t) => {
    const r = v(t)
    return [r.candidates.length, r.violations.length, r.exempt]
  }
  eq('P1 自算 count ⇒ 候选 1 违规 1', st(FIX.selfCount), [1, 1, 0])
  eq('N1 链带 .returning( ⇒ 违规 0(库确认放过)', trip(FIX.returning), [
    1,
    0,
    { returning: 1, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N1b 计数根来自归属预查询 ⇒ 违规 0(库确认·预查询)', trip(FIX.preQuery), [
    1,
    0,
    { returning: 0, db: 1, outlet: 0, marker: 0 },
  ])
  eq('P1b 同一处改成请求侧集合 ⇒ 违规 1(证明 N1b 不是恒真)', trip(FIX.preQueryRequestSide), [
    1,
    1,
    { returning: 0, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N2 import 唯一出口 ⇒ 违规 0(出口放过)', trip(FIX.outlet), [
    1,
    0,
    { returning: 0, db: 0, outlet: 1, marker: 0 },
  ])
  eq('P2 同一处去掉 import ⇒ 违规 1(证明 E2 不是恒真)', trip(FIX.outletNoImport), [
    1,
    1,
    { returning: 0, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N3 带原因的行内豁免 ⇒ 违规 0', trip(FIX.markerOk), [
    1,
    0,
    { returning: 0, db: 0, outlet: 0, marker: 1 },
  ])
  eq(
    'P3 裸标记无原因 ⇒ 违规 1 且裸标记计数 1',
    (() => {
      const r = v(FIX.markerBare)
      return [r.violations.length, r.bareExempt, r.exempt.marker]
    })(),
    [1, 1, 0],
  )
  eq('P4 正则字面量里有引号 ⇒ 仍看得见违规(词法器不被带盲)', st(FIX.regexQuote), [1, 1, 0])
  eq(
    'P4b 字符类里有反引号/引号 ⇒ 仍看得见违规(真仓 feature-center 那一型)',
    st(FIX.regexClass),
    [1, 1, 0],
  )
  eq('N4 布尔 deleted:true ⇒ 不入面', st(FIX.boolAck), [0, 0, 0])
  eq('N5 读查询 count: rows.length ⇒ 不入面', st(FIX.readQuery), [0, 0, 0])
  // ---- V1/V2:两份"惯例存量"计数(只报数、永不判红)。六元组一次读出「两型计数 + 四个判据数」,
  //      所以同一支用例既证计数数到了,也证它没有把判据的四个数顶动一格。----
  const cc = (t) => {
    const r = v(t)
    return [
      r.booleanAck.length,
      r.readQuery.length,
      r.candidates.length,
      r.violations.length,
      r.undetermined.length,
      r.exempt.returning + r.exempt.db + r.exempt.outlet + r.exempt.marker,
    ]
  }
  eq(
    'V1 布尔 ack 三种真形态(单行 / 带尾逗号 / 跨行对象)⇒ 数到 3 处,判据四数仍 0',
    cc(FIX.boolAckCount),
    [3, 0, 0, 0, 0, 0],
  )
  eq(
    'V1b 近邻形状一律不数(affected / rows.length / restored:true / isDeleted / true===flag / trueOrFalse)',
    cc(FIX.boolAckNearMiss),
    [0, 0, 0, 0, 0, 0],
  )
  eq(
    'V1c 注释与字符串里的 deleted: true 不计数(判据与计数共用同一份遮蔽面)',
    cc(FIX.boolAckInComment),
    [0, 0, 0, 0, 0, 0],
  )
  eq(
    'V2 读查询 count: rows.length ⇒ 只进 readQuery,不混进布尔 ack',
    cc(FIX.readQuery),
    [0, 1, 0, 0, 0, 0],
  )
  eq(
    'V3 三族同文件各计各的:违规 1 / 布尔 ack 1 / 读查询 1(混计就等于没有信息)',
    cc(FIX.mixedAll),
    [1, 1, 1, 1, 0, 0],
  )
  eq(
    'V4 反向对照:加了两型计数后,自算计数那一处仍是候选 1 / 违规 1、两型计数 0',
    cc(FIX.selfCount),
    [0, 0, 1, 1, 0, 0],
  )
  eq(
    'V5 N1/N2 的"不入面"结论一字未动',
    [st(FIX.boolAck), st(FIX.readQuery)],
    [
      [0, 0, 0],
      [0, 0, 0],
    ],
  )
  eq('N6 注释里的字样 ⇒ 不计候选(剥注释锁)', st(FIX.commentOnly), [0, 0, 0])
  eq('N7 字符串里的字样 ⇒ 不入面(遮噪方向锁)', st(FIX.stringOnly), [0, 0, 0])
  eq('U1 链在 send 之后 ⇒ 未判定 1、不判红', st(FIX.chainAfter), [0, 0, 1])
  eq('N8 路由注册者不被当批量写(接收者白名单),而体内 db 链照判', st(FIX.registrar), [1, 1, 0])
  eq(
    'N8b 去掉 db 链后同一路由注册 ⇒ 不入面',
    st(FIX.registrar.replace('  await db.delete(table).where(inArray(table.id, ids))\n', '')),
    [0, 0, 0],
  )
  eq(
    'E1 两面旗同给 ⇒ 判死',
    selectFace({ staged: true, worktree: true, def: 'head' }).error,
    '--staged 与 --worktree 不得同用(两个判定面互斥)',
  )
  eq(
    'E2 默认面是 HEAD(不是磁盘)',
    selectFace({ staged: false, worktree: false, def: 'head' }).face,
    'head',
  )
  const D = (o) => decide(o)
  eq(
    'E3 全量档默认不判红(存量只报数)',
    D({ face: 'head', violations: [1, 2, 3], undetermined: [], ratcheted: null, strict: false }),
    0,
  )
  eq(
    'E4 --strict 下存量判红',
    D({ face: 'head', violations: [1, 2, 3], undetermined: [], ratcheted: null, strict: true }),
    1,
  )
  eq(
    'E5 --strict 下有未判定 ⇒ 拒绝出合格证(2 优先于 1)',
    D({ face: 'head', violations: [], undetermined: [{}], ratcheted: null, strict: true }),
    2,
  )
  eq(
    'E6 staged 差值棘轮判红',
    D({
      face: 'staged',
      violations: [1, 2],
      undetermined: [],
      ratcheted: [{ file: 'a', now: 2, anchor: 1, added: 1 }],
      strict: false,
    }),
    1,
  )
  eq(
    'E7 staged 存量持平 ⇒ 不拦',
    D({ face: 'staged', violations: [1], undetermined: [], ratcheted: [], strict: false }),
    0,
  )
  // ---- B1(2026-09-27):布尔 ack × 写链的棘轮判据。六元组 = [候选, 违规, 库确认放过, 标记放过, 裸标记, 无函数体]。----
  const b1 = (t) => {
    const r = v(t)
    return [
      r.b1.candidates.length,
      r.b1.violations.length,
      r.b1.exempt.confirmed,
      r.b1.exempt.marker,
      r.b1.bareExempt,
      r.b1.noBodySites.length,
    ]
  }
  eq(
    'B1 命中:同函数体 db.delete + deleted:true 字面量、无库确认 ⇒ 候选 1 违规 1',
    b1(FIX.b1FalseAck),
    [1, 1, 0, 0, 0, 0],
  )
  eq('B1b update 链同判(set().where() 也是写)', b1(FIX.b1FalseAckTwice), [2, 2, 0, 0, 0, 0])
  eq('B1p①a 体内 .returning( ⇒ 放过(库确认口径)', b1(FIX.b1ConfirmedReturning), [1, 0, 1, 0, 0, 0])
  eq('B1p①b 体内 batchWriteOutcome( ⇒ 放过', b1(FIX.b1ConfirmedOutletCall), [1, 0, 1, 0, 0, 0])
  eq(
    'B1f① .returning( 只活在注释里 ⇒ 不放行(判据跑在遮蔽后的代码面上,反向锁)',
    b1(FIX.b1ReturningOnlyInComment),
    [1, 1, 0, 0, 0, 0],
  )
  eq('B1p② 同行带原因 delete-ack-exempt ⇒ 放过', b1(FIX.b1MarkerOk), [1, 0, 0, 1, 0, 0])
  eq(
    'B1f② 裸标记无原因 ⇒ 仍红且裸标记计数 1("须带原因"不得被放宽成裸标记即放过)',
    b1(FIX.b1MarkerBare),
    [1, 1, 0, 0, 1, 0],
  )
  eq(
    'B1f②b 标记写在紧邻上一行 ⇒ 不放行(B1 只本行生效,刻意比 batch-count-exempt 严)',
    b1(FIX.b1MarkerPrevLine),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B1f②c 标记落在字符串里 ⇒ 不是注释,不放行(与门 102 的"注释闭合符冒充"同族反向锁)',
    b1(FIX.b1MarkerInString),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B1r 读查询面:select 映射/类型位/注释/字符串里的 deleted: true 既不进 V1 也不进 B1(不是响应对象面)',
    (() => {
      const r = v(FIX.b1ReadFace)
      return [r.booleanAck.length, r.b1.candidates.length, r.b1.violations.length]
    })(),
    [0, 0, 0],
  )
  eq(
    'B1e E2 的文件级出口 import 不救 B1(同函数体没走库确认就照判,迁一半的端点不得自我洗白)',
    b1(FIX.b1OutletFileStillJudged),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B1n 顶层布尔 ack 解析不出函数体 ⇒ 未判定 1、不判红也不记绿',
    b1(FIX.b1NoBody),
    [0, 0, 0, 0, 0, 1],
  )
  eq(
    'B1x 无写链的纯惯例 ack 只进 V1、B1 六数全 0(两型分家)',
    (() => {
      const r = v(FIX.boolAckCount)
      return [r.booleanAck.length, ...b1(FIX.boolAckCount)]
    })(),
    [3, 0, 0, 0, 0, 0, 0],
  )
  eq(
    'B1y B1 不改判据一的四数:selfCount 面 B1 全 0,readQuery 面 B1 全 0',
    [b1(FIX.selfCount), b1(FIX.readQuery), st(FIX.selfCount), st(FIX.readQuery)],
    [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [1, 1, 0],
      [0, 0, 0],
    ],
  )
  eq(
    'B1d decide:B1 是判据 —— 全量档默认不红、--strict 红、staged 靠 ratcheted 里 kind=b1 那条红',
    [
      D({
        face: 'head',
        violations: [],
        undetermined: [],
        ratcheted: null,
        strict: false,
        b1Violations: [{}],
      }),
      D({
        face: 'head',
        violations: [],
        undetermined: [],
        ratcheted: null,
        strict: true,
        b1Violations: [{}],
      }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'x', kind: 'b1', now: 1, anchor: 0, added: 1 }],
        strict: false,
        b1Violations: [{}],
      }),
      D({
        face: 'head',
        violations: [],
        undetermined: [],
        ratcheted: null,
        strict: true,
        b1NoBody: 1,
      }),
    ],
    [0, 1, 1, 2],
  )
  // ---- B2(2026-09-27):一跳委托的删除 ack。六元组 = [候选, 违规, 放过·库确认, 放过·标记, 裸标记, 未判定]。
  //      调用方与被调腿都是夹具,calleeIndex 直接注入 ⇒ 判据实现与 analyze 走的是同一份函数。----
  const b2 = (callerText, calleeText, opt = {}) => {
    const known = opt.known === false ? new Set() : new Set([B2_CALLEE])
    const idx = new Map()
    if (calleeText !== null) idx.set(B2_CALLEE, indexExportedFns(maskText(calleeText).text))
    const r = scanFileText(B2_CALLER, callerText, { knownPaths: known, calleeIndex: idx })
    return [
      r.b2.candidates.length,
      r.b2.violations.length,
      r.b2.exempt.confirmed,
      r.b2.exempt.marker,
      r.b2.bareExempt,
      r.b2.undetermined.length,
    ]
  }
  const NO_RET = B2FIX.calleeNoReturning
  eq(
    'B2 命中:ack 体内无直接写链、await 本仓具名导出、被调体写链无 .returning( ⇒ 候选 1 违规 1',
    b2(B2FIX.delegated, NO_RET),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2 违规必须点名被调文件与函数(只报"这行有问题"复核不了那一跳)',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.delegated, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map([[B2_CALLEE, indexExportedFns(maskText(NO_RET).text)]]),
      })
      const v = r.b2.violations[0]
      return [v.file, v.callee.file, v.callee.name]
    })(),
    [B2_CALLER, B2_CALLEE, 'deleteThing'],
  )
  eq(
    'B2p① 同一夹具只在被调体补 .returning({id}) ⇒ 违规 0、放过 1(判据必须认第二十六批产出的形态)',
    b2(B2FIX.delegated, B2FIX.calleeReturning),
    [1, 0, 1, 0, 0, 0],
  )
  eq(
    'B2p② 被调体走唯一出口 batchWriteOutcome( ⇒ 放过',
    b2(B2FIX.delegated, B2FIX.calleeOutlet),
    [1, 0, 1, 0, 0, 0],
  )
  eq(
    'B2p③ 被调腿是 const + 箭头写法 ⇒ 同一判据照样命中(仓内两种导出形态实测都有)',
    b2(B2FIX.delegated, B2FIX.calleeConstArrow),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2n 被调腿没有带 where 的写链 ⇒ 判"无写链"= 真绿,既不判红也不冒充未判定',
    b2(B2FIX.delegated, B2FIX.calleeNoWrite),
    [1, 0, 0, 0, 0, 0],
  )
  eq(
    'B2u① 命名空间转发(await ns.del())⇒ 未判定 1、不判红(具名导出边判不出,但也不放过)',
    b2(B2FIX.callerNamespace, NO_RET),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u② 裸包名 / workspace 包 ⇒ 被调函数在 apps/api/src 之外 ⇒ 未判定',
    b2(B2FIX.callerBarePackage, NO_RET),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u③ 路径在面上找不到(改名 / 别人还没 add 的在途文件)⇒ 未判定,而不是判红',
    b2(B2FIX.delegated, NO_RET, { known: false }),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u③b 清单有、正文取不到(同面第二次读落空)⇒ 未判定 callee-face-missing',
    b2(B2FIX.delegated, null),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u④ export * 再导出 ⇒ 名单不可枚举 ⇒ 未判定(不猜第二跳,也不因此放过)',
    b2(B2FIX.delegated, B2FIX.calleeStar),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u④b 具名再导出 export {} from ⇒ 同样未判定',
    b2(B2FIX.delegated, B2FIX.calleeReexport),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u⑤ 被调链 opaque(where 里混函数字面量)⇒ 未判定:分不清的是命中集,不是有没有写',
    b2(B2FIX.delegated, B2FIX.calleeOpaque),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2u⑥ 被调符号不是可解析的函数导出 ⇒ callee-not-exported 未判定',
    b2(B2FIX.delegated, 'export const deleteThing = 1\n'),
    [1, 0, 0, 0, 0, 1],
  )
  eq(
    'B2a 别名 @/db/…(apps/api tsconfig 的 paths 声明)与相对路径同判 —— 门让你怎么写,门就得看得见',
    b2(B2FIX.callerAlias, NO_RET),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2x B1 射程不重复计:同函数体有直接写链 ⇒ B2 候选 0,而 B1 违规仍是 1',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.callerDirectChain, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map([[B2_CALLEE, indexExportedFns(maskText(NO_RET).text)]]),
      })
      return [r.b2.candidates.length, r.b1.candidates.length, r.b1.violations.length]
    })(),
    [0, 1, 1],
  )
  eq(
    'B2y N3:委托给本文件的本地 helper(不经 import)⇒ B2 不入账,但 V1 的惯例数照点名这一处',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.callerLocalHelper, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map(),
      })
      return [r.b2.candidates.length, r.b2.undetermined.length, r.booleanAck.length]
    })(),
    [0, 0, 1],
  )
  eq(
    'B2m 同行带原因 delete-ack-exempt ⇒ 放过(与 B1 同一条通道、同一份实现)',
    b2(B2FIX.callerMarkerOk, NO_RET),
    [1, 0, 0, 1, 0, 0],
  )
  eq(
    'B2f① 裸标记无原因 ⇒ 仍红且裸标记计数 1("须带原因"不得被放宽)',
    b2(B2FIX.callerMarkerBare, NO_RET),
    [1, 1, 0, 0, 1, 0],
  )
  eq(
    'B2f② 标记写在紧邻上一行 ⇒ 不放行(与 B1 同规格:只本行生效)',
    b2(B2FIX.callerMarkerPrevLine, NO_RET),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'B2e 既有四数与 B1 六数一字不被 B2 顶动(两判据各计各的账)',
    (() => {
      const r = scanFileText(B2_CALLER, B2FIX.delegated, {
        knownPaths: new Set([B2_CALLEE]),
        calleeIndex: new Map([[B2_CALLEE, indexExportedFns(maskText(NO_RET).text)]]),
      })
      return [
        r.candidates.length,
        r.violations.length,
        r.undetermined.length,
        r.exempt.returning + r.exempt.db + r.exempt.outlet + r.exempt.marker,
        r.b1.candidates.length,
        r.b1.violations.length,
        r.booleanAck.length,
        r.readQuery.length,
      ]
    })(),
    [0, 0, 0, 0, 0, 0, 1, 0],
  )
  const D2 = (over) =>
    D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: false, ...over })
  eq(
    'B2d decide:B2 是判据 —— 全量默认不红、--strict 红、staged 靠 kind=b2 那条红、未判定在 --strict 下 exit 2',
    [
      D2({ b2Violations: [{}] }),
      D2({ strict: true, b2Violations: [{}] }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'x', kind: 'b2', now: 1, anchor: 0, added: 1 }],
        strict: false,
        b2Violations: [{}],
      }),
      D2({ strict: true, b2Undetermined: [{}] }),
      D2({ b2Undetermined: [{}] }),
    ],
    [0, 1, 1, 2, 0],
  )
  // ---- 2026-09-27 第二十九批:键族扩面 + "证据在别处"四型。K0 先跑,因为它同时是这一整段的
  //      "键表没被人削短"的前提:判据的键表与期望表逐字同集才谈得上"每一族都被扫过"。----
  const b1Of = (t) => {
    const r = v(t)
    return [
      r.b1.candidates.length,
      r.b1.violations.length,
      r.b1.exempt.confirmed,
      r.b1.exempt.marker,
    ]
  }
  const ackOf = (t) => {
    const r = v(t)
    return [r.booleanAck.length, ...BOOL_ACK_KEYS.map((k) => r.booleanAckByKey[k])]
  }
  eq(
    'K0 键族对账:判据的键表与自检侧独立写死的期望表**逐字同集**(少一族=门对该型全盲,多一族=报表与判据分叉)',
    [[...BOOL_ACK_KEYS].sort().join(','), [...FAMILY_KEYS_EXPECTED].sort().join(',')],
    [FAMILY_KEYS_EXPECTED.slice().sort().join(','), FAMILY_KEYS_EXPECTED.slice().sort().join(',')],
  )
  eq(
    'K0b 逐键都能被扫到:五键各一枚站点 ⇒ 合计 5 且按键分组每族恰 1(混计/漏族当场红)',
    ackOf(FAMILY_HIT),
    [5, 1, 1, 1, 1, 1],
  )
  eq('K0c 同五枚站点在 B1 里也是五枚候选五枚违规(扩键不是只扩报表)', b1Of(FAMILY_HIT), [5, 5, 0, 0])
  eq(
    'K0d 逐键"该放过"反体:体内无写链 ⇒ 五键全部只进惯例面、B1 六数不涨',
    b1Of(FAMILY_LETGO),
    [0, 0, 0, 0],
  )
  eq(
    'K0e 放过反体的按键读数仍是 5(报表不得跟着判据一起漏)',
    ackOf(FAMILY_LETGO),
    [5, 1, 1, 1, 1, 1],
  )
  eq(
    'K1 每一族单独构造都能命中(不从 BOOL_ACK_KEYS 派生的构造文本 ⇒ 判据漏一族当场红)',
    FAMILY_KEYS_EXPECTED.map((k) => {
      const r = findBooleanAckSends(
        maskText(
          [
            'server.delete(basePath, async (request, reply) => {',
            '  await db.delete(table).where(eq(table.id, id))',
            `  return reply.send(success({ ${k}: true }))`,
            '})',
            '',
          ].join('\n'),
        ).text,
      )
      return [r.length, r[0]?.key]
    }),
    [
      [1, 'deleted'],
      [1, 'removed'],
      [1, 'restored'],
      [1, 'revoked'],
      [1, 'cleared'],
    ],
  )
  // ---- "证据在别处"四型:每一型一条正例 + 一条"把证据拿掉就必须红"的反例(有牙证明)。----
  eq(
    'K2 型②真实形状(organization):删除住在原生 SQL 模板里、**该条 SQL 自带 RETURNING** ⇒ 库答复在手,B1 不入候选、惯例面照点名' +
      '(第三十批扩维后这一条不再等于"体内没有可见写链"——写链看得见,只是它带着 RETURNING)',
    [b1Of(HONEST_RAW_SQL), ackOf(HONEST_RAW_SQL)],
    [
      [0, 0, 0, 0],
      [1, 0, 1, 0, 0, 0],
    ],
  )
  eq(
    'K3 型②有牙版:同体另挂一条无答复的写链 ⇒ 仍放过,且 confirmWhy 必须是 raw-sql-returning(不是"没看见")',
    (() => {
      const r = v(HONEST_RAW_SQL_WITH_CHAIN)
      return [
        r.b1.candidates.length,
        r.b1.violations.length,
        r.b1.exempt.confirmed,
        r.b1.violations[0]?.disposition ?? r.b1.candidates[0]?.confirmWhy,
      ]
    })(),
    [1, 0, 1, 'raw-sql-returning'],
  )
  eq(
    'K4 型②反例:把模板里的 RETURNING 拿掉 ⇒ 同一夹具必红(证明 K3 的放过来自那一条证据)',
    b1Of(HONEST_RAW_SQL_NO_RETURNING),
    [1, 1, 0, 0],
  )
  // ---- 第三十批:**裸 SQL 写链**这一维(成对三条 + 一条未判定)。K2 那句"B1 不入候选"在扩维后
  //      只因为那条 SQL 带 RETURNING 才成立,所以必须有一组"不带 RETURNING 就红"的正反对照,
  //      否则这一维可以整块被摘掉而自检照绿(守门 70/76/81 同型:判据失效的表现永远是安静)。----
  eq(
    'K4b 裸 SQL 写(DELETE FROM,无 RETURNING)+ deleted:true ⇒ B1 必红并点名经由 raw-sql',
    (() => {
      const r = v(RAW_WRITE_LIE)
      return [
        r.b1.candidates.length,
        r.b1.violations.length,
        r.b1.violations[0]?.via ?? '',
        r.b1.exempt.confirmed,
      ]
    })(),
    [1, 1, 'raw-sql', 0],
  )
  eq(
    'K4c 逐字同一夹具只补 RETURNING ⇒ 不入候选、违规归零(K4b↔K4c 这一对就是"红来自缺库答复、不是来自判据看不见"的变异对照)',
    b1Of(RAW_WRITE_HONEST),
    [0, 0, 0, 0],
  )
  eq(
    'K4d 反假阳:读查询里的 UPDATE **值** + 注释里的 DELETE FROM ⇒ 不得算写链(否则 SELECT 也能给假 ack 定罪)',
    b1Of(RAW_READ_ONLY),
    [0, 0, 0, 0],
  )
  eq(
    'K4e 括号配平不到的 execute ⇒ 未判定(U3)且不判红也不记绿;同一格没有 ack 时只报数',
    (() => {
      const r = v(RAW_WRITE_UNPARSED)
      return [
        r.rawSqlUnparsed.length,
        r.undetermined.length,
        r.b1.violations.length,
        r.violations.length,
      ]
    })(),
    [1, 1, 0, 0],
  )
  eq(
    'K5 型③(visit-tracking):内存 Map 的 delete 返回真布尔、404 由它派生 ⇒ 无"库侧行"概念,不属本型',
    [b1Of(HONEST_MEMORY_MAP_DELETE), ackOf(HONEST_MEMORY_MAP_DELETE)],
    [
      [0, 0, 0, 0],
      [1, 0, 1, 0, 0, 0],
    ],
  )
  eq(
    'K6 型③之二(openclaw):无条件重置内存 store ⇒ 同样不入 B1 的账,惯例面照点名 cleared',
    [b1Of(HONEST_MEMORY_STORE_RESET), ackOf(HONEST_MEMORY_STORE_RESET)],
    [
      [0, 0, 0, 0],
      [1, 0, 0, 0, 0, 1],
    ],
  )
  eq(
    'K7 型④真实形状(agents):行数由同响应里的诚实字段承载 ⇒ 体内无 drizzle 写链,不入候选',
    [b1Of(HONEST_SIBLING_CARRIER), ackOf(HONEST_SIBLING_CARRIER)],
    [
      [0, 0, 0, 0],
      [1, 0, 0, 0, 0, 1],
    ],
  )
  eq(
    'K8 型④有牙版:同体挂一条无答复写链 ⇒ 载体仍然成立(放过,confirmWhy 点名 sibling-carrier)',
    (() => {
      const r = v(HONEST_SIBLING_WITH_CHAIN)
      return [
        r.b1.candidates.length,
        r.b1.violations.length,
        r.b1.exempt.confirmed,
        r.b1.candidates[0]?.confirmWhy,
      ]
    })(),
    [1, 0, 1, 'sibling-carrier:deleted'],
  )
  eq(
    'K9 型④反例①:去掉那枚诚实字段 ⇒ 同一夹具必红(载体通道不是恒真放过)',
    b1Of(NO_SIBLING_WITH_CHAIN),
    [1, 1, 0, 0],
  )
  eq(
    'K10 型④反例②:载体写成"键 : 标识量"(带冒号,这里还是请求侧 .length)⇒ 不算诚实载体,同一夹具必红',
    b1Of(FAKE_SIBLING_REQUEST_SIDE),
    [1, 1, 0, 0],
  )
  eq(
    'K11 型①(一跳委托的 RETURNING,files.ts 真实形状):委托体做两件写事 ⇒ 按 ack 键的动词筛后判库确认放过',
    b2(B2FIX.callerRemoved, B2FIX.calleeMixedVerb),
    [1, 0, 1, 0, 0, 0],
  )
  eq(
    'K12 型①反例:摘掉**该动词**那条链的 .returning( ⇒ 同一夹具必红(动词筛选不是给回退开的口子)',
    b2(B2FIX.callerRemoved, B2FIX.calleeMixedVerbStripped),
    [1, 1, 0, 0, 0, 0],
  )
  eq(
    'K13 型④的委托版:调用方自带诚实载体 ⇒ 那一跳不必去被调体找罪证,按放过记账',
    b2(B2FIX.callerSiblingCarrier, NO_RET),
    [1, 0, 1, 0, 0, 0],
  )
  eq(
    'K14 违规落点必须带**键名**(否则扩了键族也说不清红在哪一族)',
    v(
      FIX.boolAckNearMiss +
        h([
          '  await db.delete(t).where(eq(t.id, 1))',
          '  return reply.send(success({ revoked: true }))',
        ]),
    ).b1.violations.map((x) => x.key),
    ['revoked'],
  )
  // ---- 只报数不改判据的两把锁:把惯例计数接进退出码 / 让它从结论行消失,各自必读红。----
  eq(
    'X1 惯例计数再大也不得进退出码(--strict 也一样:存量是决策依据,不是债)',
    D({
      face: 'head',
      violations: [],
      undetermined: [],
      ratcheted: null,
      strict: true,
      booleanAckSites: 9999,
      booleanAckFiles: 500,
      readQueryCountSites: 9999,
      readQueryCountFiles: 500,
    }),
    0,
  )
  eq(
    'X1b 同一条对 staged 档成立(不得用惯例数替差值棘轮加料)',
    D({
      face: 'staged',
      violations: [],
      undetermined: [],
      ratcheted: [],
      strict: false,
      booleanAckSites: 9999,
      readQueryCountSites: 9999,
    }),
    0,
  )
  const BASE_COUNTS = {
    files: 1,
    enumerated: 1,
    candidates: 0,
    violations: 0,
    undetermined: 0,
    exempt: 0,
    bareExempt: 0,
    booleanAckSites: 233,
    booleanAckFiles: 148,
    readQueryCountSites: 12,
    readQueryCountFiles: 9,
    b1Candidates: 0,
    b1Violations: 0,
    b1Files: 0,
    b1ExemptConfirmed: 0,
    b1ExemptMarker: 0,
    b1BareExempt: 0,
    b1NoBody: 0,
  }
  const fmt = (countsOver = {}) =>
    formatReport({
      face: 'head',
      strict: false,
      ratcheted: null,
      violations: [],
      undetermined: [],
      exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
      counts: { ...BASE_COUNTS, ...countsOver },
    }).join('\n')
  eq(
    'X2 结论行必须点名两份惯例存量与数字(不得被"✅ 通过"一句替它们说话)',
    /布尔 ack 惯例\(不计红,仅现读计数\): 233 处 \/ 148 文件/.test(fmt()) &&
      /读查询 count 惯例\(不计红,仅现读计数\): 12 处 \/ 9 文件/.test(fmt()),
    true,
  )
  eq(
    'X2b 四个判据数的原形态逐字不变(新增只许追加,不许改写既有结论行)',
    /^候选 0 \/ 违规 0 \/ 未判定 0 \/ 豁免 0.*取材面:HEAD blob.*布尔 ack 惯例/m.test(fmt()),
    true,
  )
  eq(
    'X2c 存量真是 0 时也必须喊出 0(0 处不等于"没扫过")',
    /布尔 ack 惯例\(不计红,仅现读计数\): 0 处 \/ 0 文件/.test(
      fmt({ booleanAckSites: 0, booleanAckFiles: 0 }),
    ),
    true,
  )
  // ---- B1 的报告面:结论行必须点名判据计数;✅/未判定 是两句话;有 B1 违规时不得出"✅ 通过"。----
  const fmtB1 = (over = {}, outOver = {}) =>
    formatReport({
      face: 'head',
      strict: false,
      ratcheted: null,
      violations: [],
      undetermined: [],
      exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
      b1Violations: [],
      ...outOver,
      counts: { ...BASE_COUNTS, ...over },
    }).join('\n')
  eq(
    'X3 结论行必须点名 B1 的现读数(违规/放过/裸标记/不判),0 也照喊(不得静默)',
    /B1 假 ack\(判据:违规 0 处 \/ 0 文件,库确认放过 0 · 行内标记 0 只报数,裸标记不计 0,找不到函数体不判 0\)/.test(
      fmtB1(),
    ),
    true,
  )
  eq(
    'X3b 全量档有 B1 违规 ⇒ 逐条点名且不再打"✅ 通过"(B1 是判据,惯例数不动)',
    (() => {
      const t = fmtB1(
        { b1Violations: 2, b1Files: 1, b1Candidates: 2 },
        { b1Violations: [{ file: 'apps/api/src/routes/x.ts', line: 7, receiver: 'db' }] },
      )
      return (
        !/✅ 通过/.test(t) &&
        /B1 假 ack 2 处 \/ 1 文件/.test(t) &&
        /apps\/api\/src\/routes\/x\.ts:7/.test(t) &&
        /^候选 0 \/ 违规 0 \/ 未判定 0 \/ 豁免 0/m.test(t)
      )
    })(),
    true,
  )
  eq(
    'X3c B1 未判定与"通过"各说各话:b1NoBody>0 既不打 ✅ 也必须单列一句未判定',
    (() => {
      const t = fmtB1({ b1NoBody: 3 })
      return !/✅ 通过/.test(t) && /B1 未判定 3 处/.test(t) && /不冒红也不记绿/.test(t)
    })(),
    true,
  )
  eq(
    'X3d staged 判红块按 kind 分列三条判据,措辞不得互相顶账',
    (() => {
      const t = formatReport({
        face: 'staged',
        strict: false,
        ratcheted: [
          { file: 'a.ts', kind: 'count', now: 2, anchor: 1, added: 1 },
          { file: 'b.ts', kind: 'b1', now: 1, anchor: 0, added: 1 },
          { file: 'c.ts', kind: 'b2', now: 1, anchor: 0, added: 1 },
        ],
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        b2Violations: [],
        counts: BASE_COUNTS,
      }).join('\n')
      return (
        t.includes('[计数自算] a.ts') &&
        t.includes('[B1假ack] b.ts') &&
        t.includes('[B2委托假ack] c.ts') &&
        /计数自算 1 · B1 假 ack 1 · B2 委托假 ack 1/.test(t)
      )
    })(),
    true,
  )
  eq(
    'B2fmt 结论行必须现读点名 B2 的五个数(0 也照喊);有 B2 违规或未判定时不得出"✅ 通过"',
    (() => {
      const t0 = fmtB1()
      const t1 = fmtB1(
        { b2Violations: 3, b2Files: 2, b2Candidates: 5 },
        {
          b2Violations: [
            {
              file: 'apps/api/src/routes/y.ts',
              line: 9,
              callee: { file: 'apps/api/src/db/y.ts', name: 'deleteY' },
            },
          ],
        },
      )
      const t2 = fmtB1(
        { b2Undetermined: 4 },
        {
          b2Undetermined: [
            { file: 'a.ts', line: 3, undetermined: [{ kind: 'reexport', name: 'del' }] },
          ],
        },
      )
      return [
        /B2 委托假 ack\(判据:违规 0 处 \/ 0 文件,候选 0,放过 0 只报数,那一跳解析不到不判 0\)/.test(
          t0,
        ),
        !/✅ 通过/.test(t1) &&
          /B2 委托假 ack 3 处 \/ 2 文件/.test(t1) &&
          /apps\/api\/src\/routes\/y\.ts:9/.test(t1) &&
          /apps\/api\/src\/db\/y\.ts#deleteY/.test(t1),
        !/✅ 通过/.test(t2) && /B2 未判定 4 处/.test(t2) && /reexport/.test(t2),
        // B2 的数不得顶动既有四数与 B1 的那一句(X2b/X3 同一条要求的延续)
        /^候选 0 \/ 违规 0 \/ 未判定 0 \/ 豁免 0/m.test(t1) &&
          /B1 假 ack\(判据:违规 0 处 \/ 0 文件/.test(t1),
      ]
    })(),
    [true, true, true, true],
  )
  // ---- B3/B4(G-815953/G-815956,2026-09-30):回填上界与终态回退。
  //      四元组 = [b3候选, b3违规, b4候选, b4违规]。判据/常量一律取模块导出(§22c)。----
  const b34 = (t) => {
    const r = v(t)
    return [r.b3.candidates.length, r.b3.violations.length, r.b4.candidates.length, r.b4.violations.length]
  }
  eq('B3 无界回填(where isNull 划线)⇒ 违规 1(票面镜像形状)', b34(FIX.b3Unbounded), [1, 1, 0, 0])
  eq('B3b lte 时间上界 ⇒ 绿(候选 1 违规 0)', b34(FIX.b3BoundedLte), [1, 0, 0, 0])
  eq('B3c backfillWhere 唯一出口 ⇒ 绿(出口产物自带 backfillWhere( 字样)', b34(FIX.b3BoundedOutlet), [1, 0, 0, 0])
  eq(
    'B3d 反假阳锁:软删形状(set({deletedAt}).where(isNull))与回填词法同形 ⇒ 不进 B3 的面(按迁移记账列收窄)',
    b34(FIX.b3SoftDelete),
    [0, 0, 0, 0],
  )
  eq('B3e 裸 SQL 维:UPDATE 迁移列无上界 ⇒ 违规 1', b34(FIX.b3RawUnbounded), [1, 1, 0, 0])
  eq('B3f 裸 SQL 维绿腿:SQL 串带 <= 上界 ⇒ 绿', b34(FIX.b3RawBounded), [1, 0, 0, 0])
  eq('B4 字面量 status 无同列前置 ⇒ 违规 1(票面镜像形状)', b34(FIX.b4LiteralNoPre), [0, 0, 1, 1])
  eq('B4b 补 and(eq(t.status,…)) 同列前置 ⇒ 绿(候选 1 违规 0)', b34(FIX.b4LiteralWithPre), [0, 0, 1, 0])
  eq('B4c 无 where 全表改状态 ⇒ 违规 1', b34(FIX.b4NoWhere), [0, 0, 1, 1])
  eq(
    'B4d 判不了格钉子:变量值/简写/spread ⇒ 不进面(0 候选 —— 判不了就登记,绝不假装已解决)',
    b34(FIX.b4Unjudgeable),
    [0, 0, 0, 0],
  )
  eq(
    'B3D decide:B3 进签名即进退出码 —— --strict 全量判红 / 默认档只报数(与 B1/B2 同档)',
    [
      D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: true, b3Violations: [{}] }),
      D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: false, b3Violations: [{}] }),
    ],
    [1, 0],
  )
  eq(
    'B4D decide:B4 刻意**不在签名里** —— head+strict 即便有 B4 存量也不判红(棘轮专用维,票面拍板只拦新增);staged 净新增经 ratcheted(kind=b4)照红',
    [
      D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: true }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'a.ts', kind: 'b4', now: 1, anchor: 0, added: 1 }],
        strict: false,
      }),
    ],
    [0, 1],
  )
  eq(
    'B34fmt 报告面:B3 违规行(--strict 换 ❌、不出 ✅);B4 行**永远 ⚠️ 只报数**(strict 也不许出 ❌);棘红块 kind 分列点名 B3/B4',
    (() => {
      const base = {
        face: 'head',
        strict: false,
        ratcheted: null,
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        b2Violations: [],
        b2Undetermined: [],
      }
      const t1 = formatReport({
        ...base,
        b3Violations: [
          {
            file: 'apps/api/src/db/x.ts',
            line: 3,
            receiver: 'db',
            col: 'migrationBatch',
            via: 'drizzle',
            whereWhy: '无 where(全表无界)',
          },
        ],
        counts: { ...BASE_COUNTS, b3Violations: 1, b3Files: 1, b3Candidates: 1 },
      }).join('\n')
      const t2 = formatReport({
        ...base,
        strict: true,
        b4Violations: [
          {
            file: 'apps/api/src/db/y.ts',
            line: 5,
            receiver: 'db',
            col: 'status',
            via: 'drizzle',
            whereWhy: 'where 无同列 eq/in/ne 前置',
          },
        ],
        counts: { ...BASE_COUNTS, b4Violations: 1, b4Files: 1, b4Candidates: 1 },
      }).join('\n')
      const t3 = formatReport({
        ...base,
        face: 'staged',
        ratcheted: [
          { file: 'a.ts', kind: 'b3', now: 1, anchor: 0, added: 1 },
          { file: 'b.ts', kind: 'b4', now: 2, anchor: 1, added: 1 },
        ],
        counts: BASE_COUNTS,
      }).join('\n')
      return [
        /B3 回填无界 1 处 \/ 1 文件/.test(t1) && !/✅ 通过/.test(t1),
        /B4 终态回退 1 处/.test(t2) && /只报数不判红/.test(t2) && !/❌/.test(t2),
        t3.includes('[B3回填无界] a.ts') &&
          t3.includes('[B4终态回退] b.ts') &&
          /B3 回填无界 1 · B4 终态回退 1/.test(t3),
      ]
    })(),
    [true, true, true],
  )
  // ---- B5(G-815955,2026-09-30):排序无尾键。二元组 = [b5候选, b5违规]。
  //      判据/常量一律取模块导出(§22c),棘轮专用维与 B4 同构。----
  const b5v = (t) => {
    const r = v(t)
    return [r.b5.candidates.length, r.b5.violations.length]
  }
  eq('B5 单键可空排序列无尾键 ⇒ 违规 1(票面镜像形状)', b5v(FIX.b5SingleNoTail), [1, 1])
  eq('B5b 补确定性尾键 ⇒ 放过(候选 1 违规 0,处置 tail-key)', b5v(FIX.b5WithTailKey), [1, 0])
  eq('B5c desc + sequence 同判(键族/方向都不限 sortOrder·asc)', b5v(FIX.b5DescSequence), [1, 1])
  eq(
    'B5d 判不了格钉子:变量键 / sql` 模板 / 首键非本键族 ⇒ 不进面(0 候选 —— 判不了就登记,绝不假装已解决)',
    b5v(FIX.b5Unjudgeable),
    [0, 0],
  )
  eq(
    'B5e 红点形态:col/via/orderByWhy 齐备,镜像测试按这几个字段复核',
    (() => {
      const r = v(FIX.b5SingleNoTail).b5.violations[0]
      return [r.col, r.via, /单键排序无确定性尾键/.test(r.orderByWhy || '')]
    })(),
    ['sortOrder', 'drizzle', true],
  )
  eq(
    'B5F decide:B5 刻意**不在签名里** —— head+strict 即便有 B5 存量也不判红(与 B4 同构,棘轮专用维);staged 净新增经 ratcheted(kind=b5)照红',
    [
      D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: true }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'a.ts', kind: 'b5', now: 1, anchor: 0, added: 1 }],
        strict: false,
      }),
    ],
    [0, 1],
  )
  eq(
    'B5fmt 报告面:B5 行**永远 ⚠️ 只报数**(strict 也不许出 ❌);棘红块 kind 分列点名 B5;结论行 0 也照喊',
    (() => {
      const t1 = formatReport({
        face: 'head',
        strict: true,
        ratcheted: null,
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        b2Violations: [],
        b2Undetermined: [],
        b3Violations: [],
        b4Violations: [],
        b5Violations: [
          {
            file: 'apps/api/src/db/x.ts',
            line: 7,
            col: 'sortOrder',
            via: 'drizzle',
            orderByExcerpt: 'asc(plans.sortOrder)',
            orderByWhy: '单键排序无确定性尾键(同值行分页漂移)',
          },
        ],
        counts: { ...BASE_COUNTS, b5Violations: 1, b5Files: 1, b5Candidates: 1 },
      }).join('\n')
      const t2 = formatReport({
        face: 'staged',
        strict: false,
        ratcheted: [{ file: 'c.ts', kind: 'b5', now: 1, anchor: 0, added: 1 }],
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        b2Violations: [],
        counts: BASE_COUNTS,
      }).join('\n')
      return [
        /B5 排序无尾键 1 处/.test(t1) && /只报数不判红/.test(t1) && !/❌/.test(t1),
        t2.includes('[B5排序无尾键] c.ts') && /B5 排序无尾键 1/.test(t2),
        /B5 排序无尾键\(判据:违规 0 处 \/ 0 文件,候选 0;只报数不进 --strict/.test(fmtB1()),
      ]
    })(),
    [true, true, true],
  )
  // ---- B6(G-815954,2026-10-07):jsonb 整列覆盖无声明。二元组 = [b6候选, b6违规]。
  //      判据/常量一律取模块导出(§22c),棘轮专用维与 B4/B5 同构。----
  const b6v = (t) => {
    const r = v(t)
    return [r.b6.candidates.length, r.b6.violations.length]
  }
  eq('B6 整块 excluded ⇒ 违规 1(票面正反成对的红腿)', b6v(FIX.b6ExcludedBare), [1, 1])
  eq('B6b jsonb_set 指定路径 ⇒ 放过(候选 1 违规 0,处置 jsonb-set)', b6v(FIX.b6JsonbSet), [1, 0])
  eq('B6c 具名成员合并(sql`… || …::jsonb`)⇒ 放过(票面正例形态)', b6v(FIX.b6NamedMerge), [1, 0])
  eq(
    'B6d 整列覆盖 + 逐列"全量真相"声明 ⇒ 放过(session-store 现行写法,声明在键行上一行)',
    b6v(FIX.b6FullDeclared),
    [1, 0],
  )
  eq(
    'B6e 变异对照:B6d 删掉声明注释 ⇒ 必须转红(逐列声明是整列覆盖的唯一放行通道)',
    b6v(FIX.b6FullNoDecl),
    [1, 1],
  )
  eq(
    'B6g 字符串冒充绿腿:纯串值里带 `|| …::jsonb` ⇒ 遮蔽档剩空白,冒充不了合并,照红',
    b6v(FIX.b6StringMerge),
    [1, 1],
  )
  eq(
    'B6h JS 层 `||` 是值运算不是 SQL 合并(无 sql` 标签)⇒ 裸覆盖,无声明照红',
    b6v(FIX.b6JsOr),
    [1, 1],
  )
  eq(
    'B6s 字符串冒充声明:声明字样活在串值里 ⇒ 同位判档拒绝,照红',
    b6v(FIX.b6StringDecl),
    [1, 1],
  )
  eq(
    'B6i 红点形态:col/via/form/setExcerpt/setWhy 齐备(镜像测试按字段复核);excluded 与 bare 的 why 各说各话',
    (() => {
      const ex = v(FIX.b6ExcludedBare).b6.violations[0]
      const bare = v(FIX.b6FullNoDecl).b6.violations[0]
      return [
        [
          ex.col,
          ex.via,
          ex.form,
          ex.setExcerpt.includes('EXCLUDED.payload'),
          /excluded 整块搬入/.test(ex.setWhy || ''),
        ],
        [bare.col, bare.form, /整列覆盖/.test(bare.setWhy || '')],
      ]
    })(),
    [
      ['payload', 'drizzle', 'excluded', true, true],
      ['messages', 'bare', true],
    ],
  )
  eq(
    'B6D decide:B6 刻意**不在签名里** —— head+strict 即便有 B6 存量也不判红(与 B4/B5 同构,棘轮专用维);staged 净新增经 ratcheted(kind=b6)照红',
    [
      D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: true }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'a.ts', kind: 'b6', now: 1, anchor: 0, added: 1 }],
        strict: false,
      }),
    ],
    [0, 1],
  )
  eq(
    'B6fmt 报告面:B6 行**永远 ⚠️ 只报数**(strict 也不许出 ❌);棘红块 kind 分列点名 B6;结论行 0 也照喊',
    (() => {
      const t1 = formatReport({
        face: 'head',
        strict: true,
        ratcheted: null,
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        b2Violations: [],
        b2Undetermined: [],
        b3Violations: [],
        b4Violations: [],
        b5Violations: [],
        b6Violations: [
          {
            file: 'apps/api/src/db/x.ts',
            line: 9,
            col: 'payload',
            via: 'drizzle',
            form: 'excluded',
            setExcerpt: 'sql`EXCLUDED.payload`',
            setWhy: 'excluded 整块搬入且无逐列策略声明',
          },
        ],
        counts: { ...BASE_COUNTS, b6Violations: 1, b6Files: 1, b6Candidates: 1 },
      }).join('\n')
      const t2 = formatReport({
        face: 'staged',
        strict: false,
        ratcheted: [{ file: 'c.ts', kind: 'b6', now: 1, anchor: 0, added: 1 }],
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        counts: BASE_COUNTS,
      }).join('\n')
      const t3 = formatReport({
        face: 'head',
        strict: false,
        ratcheted: null,
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        counts: BASE_COUNTS,
      }).join('\n')
      return [
        /B6 jsonb 整列覆盖无声明 1 处 \/ 1 文件/.test(t1) &&
          /只报数不判红/.test(t1) &&
          !/❌/.test(t1) &&
          !/✅ 通过/.test(t1),
        t2.includes('[B6jsonb无声明] c.ts') && /B6 jsonb 无声明 1/.test(t2),
        /B6 jsonb 无声明\(判据:违规 0 处 \/ 0 文件,候选 0;只报数不进 --strict/.test(t3),
      ]
    })(),
    [true, true, true],
  )
  // ---- B7(G-815984,2026-10-07):写时刻不回传。二元组 = [b7候选, b7违规]。
  //      判据取模块导出的 findReturningTimeColSites(§22c),棘轮专用维与 B4/B5/B6 同构。----
  const b7v = (t) => {
    const r = v(t)
    return [r.b7.candidates.length, r.b7.violations.length]
  }
  eq(
    'B7 取了业务列(name)却无时间列 ⇒ 违规 1(写入时刻没回给调用方)',
    b7v(FIX.b7ProjNoTime),
    [1, 1],
  )
  eq(
    'B7b 纯 id 计数投影 ⇒ 放过(票面"写链 .returning({id}) 之外"的豁免半句,处置 id-count —— 门自己的修法指引推荐形状不得被棘轮判净新增)',
    [b7v(FIX.b7IdCountOnly), v(FIX.b7IdCountOnly).b7.candidates[0].disposition],
    [[1, 0], 'id-count'],
  )
  eq(
    'B7c 同链投影带 updatedAt ⇒ 放过(票面正例:写时刻原样回给调用方,处置 time-col)',
    [
      b7v(FIX.b7ProjWithTime),
      v(FIX.b7ProjWithTime).b7.candidates[0].disposition,
    ],
    [[1, 0], 'time-col'],
  )
  eq(
    'B7d 裸 .returning() 无参 ⇒ 放过(回全行,时间列结构性在内,处置 bare-full-row)',
    [b7v(FIX.b7BareFullRow), v(FIX.b7BareFullRow).b7.candidates[0].disposition],
    [[1, 0], 'bare-full-row'],
  )
  eq(
    'B7e 投影实参经变量 ⇒ 判不了格不进面(候选 0 违规 0,不假装已判)',
    b7v(FIX.b7ProjVarArg),
    [0, 0],
  )
  eq(
    'B7e2 投影对象带展开 ⇒ 判不了格不进面(...pick 是否含时间列词法不可知)',
    b7v(FIX.b7ProjSpread),
    [0, 0],
  )
  eq(
    'B7f 注释里提时间列冒充不了投影 ⇒ 全遮蔽档剥注释,照红(冒充钉子)',
    b7v(FIX.b7CommentTime),
    [1, 1],
  )
  eq(
    'B7g 红点形态:receiver/via/excerpt/why 齐备(镜像测试按字段复核);why 点名"业务列无时间列"',
    (() => {
      const r = v(FIX.b7ProjNoTime).b7.violations[0]
      return [r.receiver, r.via, r.excerpt.includes('name: things.name'), /业务列.*无.*时间列|非计数投影/.test(r.why || '')]
    })(),
    ['db', 'drizzle', true, true],
  )
  eq(
    'B7D decide:B7 刻意**不在签名里** —— head+strict 即便有 B7 存量也不判红(与 B4/B5/B6 同构,棘轮专用维);staged 净新增经 ratcheted(kind=b7)照红',
    [
      D({ face: 'head', violations: [], undetermined: [], ratcheted: null, strict: true }),
      D({
        face: 'staged',
        violations: [],
        undetermined: [],
        ratcheted: [{ file: 'a.ts', kind: 'b7', now: 1, anchor: 0, added: 1 }],
        strict: false,
      }),
    ],
    [0, 1],
  )
  eq(
    'B7fmt 报告面:B7 行**永远 ⚠️ 只报数**(strict 也不许出 ❌);棘红块 kind 分列点名 B7;结论行 0 也照喊',
    (() => {
      const t1 = formatReport({
        face: 'head',
        strict: true,
        ratcheted: null,
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        b2Violations: [],
        b2Undetermined: [],
        b3Violations: [],
        b4Violations: [],
        b5Violations: [],
        b6Violations: [],
        b7Violations: [
          {
            file: 'apps/api/src/db/x.ts',
            line: 11,
            receiver: 'db',
            via: 'drizzle',
            excerpt: '{ id: things.id, name: things.name }',
            why: '非计数投影(含业务列)却不取回任何时间列(须同时取回 createdAt/updatedAt 等 At|Time 结尾列,或改裸 .returning() 回全行)',
          },
        ],
        counts: { ...BASE_COUNTS, b7Violations: 1, b7Files: 1, b7Candidates: 1 },
      }).join('\n')
      const t2 = formatReport({
        face: 'staged',
        strict: false,
        ratcheted: [{ file: 'c.ts', kind: 'b7', now: 1, anchor: 0, added: 1 }],
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        b1Violations: [],
        counts: BASE_COUNTS,
      }).join('\n')
      const t3 = formatReport({
        face: 'head',
        strict: false,
        ratcheted: null,
        violations: [],
        undetermined: [],
        exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
        counts: BASE_COUNTS,
      }).join('\n')
      return [
        /B7 写时刻不回传 1 处 \/ 1 文件/.test(t1) &&
          /只报数不判红/.test(t1) &&
          !/❌/.test(t1) &&
          !/✅ 通过/.test(t1),
        t2.includes('[B7写时刻不回传] c.ts') && /B7 写时刻不回传 1/.test(t2),
        /B7 写时刻不回传\(判据:违规 0 处 \/ 0 文件,候选 0;只报数不进 --strict/.test(t3),
      ]
    })(),
    [true, true, true],
  )
  eq(
    'S1 词法未闭合 ⇒ 整文件未判定(U2)',
    (() => {
      const r = v("db.delete(t).where(inArray(t.id, ids))\nconst s = '未闭合的串\n")
      return [r.violations.length, r.undetermined.length > 0]
    })(),
    [0, true],
  )
  eq(
    'S2 maskText 保行号(遮蔽不改行数)',
    maskText(FIX.selfCount).text.split('\n').length,
    FIX.selfCount.split('\n').length,
  )
  eq(
    'S3 模块说明符只在保留字符串那一档读得到',
    [
      SPEC_RE.test(maskText(FIX.outlet, { blankStrings: false }).text),
      SPEC_RE.test(maskText(FIX.outlet, { blankStrings: true }).text),
    ],
    [true, false],
  )
  let repoCases = 0
  if (!argv.includes('--no-repo')) {
    const before = R.length
    let dir = null
    try {
      git(['init', '-q'], (dir = mkScratch('bch-self-')))
      git(['config', 'user.email', 'gate@fixture.local'], dir)
      git(['config', 'user.name', 'gate-fixture'], dir)
      const stage = (rel, text) => {
        mkdirSync(join(dir, dirname(rel)), { recursive: true })
        writeFileSync(join(dir, rel), text, 'utf8')
        git(['add', '--', rel], dir)
      }
      const commit = (m) => git(['commit', '-q', '-m', m], dir)
      const X = 'apps/api/src/routes/x.ts'
      stage(X, FIX.selfCount)
      commit('fixture')
      const head = analyze(dir, 'head')
      eq(
        'R1 --root 注入临时仓:HEAD 面点名同一处存量(全量档不拦提交)',
        [head.counts.files, head.counts.violations, head.exit],
        [1, 1, 0],
      )
      stage(X, FIX.returning) // 索引:干净版本
      writeFileSync(join(dir, X), FIX.chainAfter, 'utf8') // 磁盘:第三份(链在 send 之后 ⇒ 未判定)
      const staged = analyze(dir, 'staged')
      const wt = analyze(dir, 'worktree')
      eq('R2 --staged 判索引(干净那份)⇒ 不判红', [staged.counts.violations, staged.exit], [0, 0])
      eq('R3 HEAD 仍是旧的那一处(不被索引/磁盘带跑)', analyze(dir, 'head').counts.violations, 1)
      eq(
        'R4 磁盘面是第三份 ⇒ 未判定 1、违规 0(不记绿)',
        [wt.counts.violations, wt.counts.undetermined],
        [0, 1],
      )
      commit('clean')
      stage(X, FIX.selfCount)
      const back = analyze(dir, 'staged')
      eq(
        'R5 索引把自算计数加回来(HEAD 已 0)⇒ 差值棘轮判红',
        [back.counts.violations, back.exit, back.ratcheted.length],
        [1, 1, 1],
      )
      commit('dirty')
      const flat = analyze(dir, 'staged')
      eq(
        'R5b HEAD 已带该存量、索引持平 ⇒ 不拦(防恒红门)',
        [flat.counts.violations, flat.exit],
        [1, 0],
      )
      stage('apps/api/src/routes/new-one.ts', FIX.selfCount)
      const fresh = analyze(dir, 'staged')
      eq(
        'R5c 新增文件带自算计数(HEAD 无该路径)⇒ 判红',
        [fresh.exit, fresh.ratcheted.length],
        [1, 1],
      )
      // R7 只报数最硬的形式:同面同轮取材 + 聚合,往索引里加一份**只有惯例形态**的文件 ⇒
      // 惯例数被数到,而四个判据数与退出码一字不变(X1 只能证 decide 没接,R7 证整条链都没接)。
      const beforeAck = analyze(dir, 'staged')
      stage('apps/api/src/routes/ack-only.ts', FIX.boolAckCount)
      const afterAck = analyze(dir, 'staged')
      const four = (a) => [
        a.counts.candidates,
        a.counts.violations,
        a.counts.undetermined,
        a.counts.exempt,
      ]
      eq(
        'R7 布尔 ack 现读到 3 处 / 1 文件,四个判据数与退出码一字不变(只报数)',
        [
          afterAck.counts.booleanAckSites,
          afterAck.counts.booleanAckFiles,
          JSON.stringify(four(beforeAck)) === JSON.stringify(four(afterAck)),
          beforeAck.exit === afterAck.exit,
        ],
        [3, 1, true, true],
      )
      eq(
        'R7b 读查询族同理:只顶起 readQueryCountSites,不串到布尔 ack 的账上、也不动判据四数',
        (() => {
          const b = analyze(dir, 'staged')
          stage('apps/api/src/routes/count-only.ts', FIX.readQuery)
          const a = analyze(dir, 'staged')
          return [
            a.counts.readQueryCountSites - b.counts.readQueryCountSites,
            a.counts.booleanAckSites,
            JSON.stringify(four(b)) === JSON.stringify(four(a)),
          ]
        })(),
        [1, 3, true],
      )
      // R8:上面两支都落在"索引里本来就有一处真违规"的那张面上,exit 前后都是 1 ⇒ 看不出惯例计数被接进了
      // 退出码。这一支另起一棵**干净仓**(只有放过的那一处 + 两份纯惯例文件),把 exit 与 --strict exit
      // 钉在 0:变异②(把 booleanAckSites 接进 decide)在这里必读红,而 R7 那一支顶得住。
      eq(
        'R8 干净仓只含惯例形态 ⇒ 计数有值而 exit 与 --strict exit 仍为 0(只报数不是判据)',
        (() => {
          const d2 = mkScratch('bch-conv-')
          try {
            git(['init', '-q'], d2)
            git(['config', 'user.email', 'g@f.local'], d2)
            git(['config', 'user.name', 'g'], d2)
            const st2 = (rel, text) => {
              mkdirSync(join(d2, dirname(rel)), { recursive: true })
              writeFileSync(join(d2, rel), text, 'utf8')
              git(['add', '--', rel], d2)
            }
            st2('apps/api/src/routes/ok.ts', FIX.returning) // 放过的那一处:候选 1 / 违规 0
            st2('apps/api/src/routes/ack.ts', FIX.boolAckCount) // 只含布尔 ack
            st2('apps/api/src/routes/cnt.ts', FIX.readQuery) // 只含读查询 count
            git(['commit', '-q', '-m', 'conventions'], d2)
            const a = analyze(d2, 'head')
            const s = analyze(d2, 'head', { strict: true })
            return [
              a.counts.booleanAckSites,
              a.counts.readQueryCountSites,
              a.counts.candidates,
              a.counts.violations,
              a.counts.undetermined,
              a.exit,
              s.exit,
            ]
          } finally {
            rmScratch(d2)
          }
        })(),
        [3, 1, 1, 0, 0, 0, 0],
      )
      // BR:B1 棘轮四向 —— 存量只报数 / 新增即红 / 改回字面量即红 / 清掉后锚点下降。
      // 另起一棵干净仓:上面那张面上已经叠了惯例文件与真违规文件,锚点序列必须在**只有 B1 形态**
      // 的面上走,否则"exit 前后都非零"会把判红分支的走向糊成不可分辨(与 R8 同一条理由)。
      eq(
        'BR1–BR4 B1 棘轮四向(临时仓端到面):存量报数不红、--strict 问责、新增/改回红、清掉后锚点降',
        (() => {
          const d3 = mkScratch('bch-b1-')
          try {
            git(['init', '-q'], d3)
            git(['config', 'user.email', 'g@f.local'], d3)
            git(['config', 'user.name', 'g'], d3)
            const st3 = (rel, text) => {
              mkdirSync(join(d3, dirname(rel)), { recursive: true })
              writeFileSync(join(d3, rel), text, 'utf8')
              git(['add', '--', rel], d3)
            }
            const X3 = 'apps/api/src/routes/b1.ts'
            st3(X3, FIX.b1FalseAck)
            git(['commit', '-q', '-m', 'b1-debt'], d3)
            const hd = analyze(d3, 'head')
            const hdStrict = analyze(d3, 'head', { strict: true })
            // BR1 存量只报数:HEAD 有 1 处、索引与 HEAD 持平 ⇒ staged exit 0(全量默认档也只报数),
            // 但 --strict 必须 1(它是判据不是惯例;这一条与 X1 对惯例数的要求正好相反,两型不得互抄)。
            const flat = analyze(d3, 'staged')
            // BR2 新增即红:同文件再写一处同型 ⇒ 2 > 锚点 1。
            st3(X3, FIX.b1FalseAckTwice)
            const added = analyze(d3, 'staged')
            // BR3 改回字面量即红的另一半先要在"已改真"上成立:提交修复版 ⇒ 锚点下降到 0。
            st3(X3, FIX.b1Migrated)
            const fixed = analyze(d3, 'staged')
            git(['commit', '-q', '-m', 'b1-fixed'], d3)
            const afterHead = analyze(d3, 'head')
            // BR3/BR4 把已改真的点改回字面量 true ⇒ 1 > 新锚点 0 判红(锚点随清偿自动下降,由这一次
            // 的"红"反证:若锚点还停在旧存量 1,这次改回就不会红)。
            st3(X3, FIX.b1FalseAck)
            const regressed = analyze(d3, 'staged')
            const b1Red = (a) => a.ratcheted.filter((r) => r.kind === 'b1')
            return [
              hd.counts.b1Violations,
              hd.exit,
              hdStrict.exit,
              flat.exit,
              flat.ratcheted.length,
              added.exit,
              JSON.stringify(b1Red(added)[0]).includes('"anchor":1'),
              fixed.exit,
              afterHead.counts.b1Violations,
              regressed.exit,
              regressed.ratcheted.length,
            ]
          } finally {
            rmScratch(d3)
          }
        })(),
        //             HEAD 存量1  默认0  strict1  持平0  持平无红  新增1  锚点=1    修复0   锚点降0   改回1   仅1条红
        [1, 0, 1, 0, 0, 1, true, 0, 0, 1, 1],
      )
      // BK1:锚点的粒度必须是「文件 × 判据 × ack 键」。这一支专门钉"换键逃逸":
      // HEAD 一枚 `deleted` 假 ack、索引换成同体量的 `removed` 假 ack —— 文件级计数 1 → 1 净零,
      // 只到"文件 × 判据"那一层的锚点会**放过它**,而扩键族之后这条通道是新造的(扩面前只有一族)。
      eq(
        'BK1 换键逃逸:同文件把 deleted 假 ack 换成 removed 假 ack(文件级 1→1)⇒ 仍必读红且点名该键',
        (() => {
          const d5 = mkScratch('bch-keyswap-')
          try {
            git(['init', '-q'], d5)
            git(['config', 'user.email', 'g@f.local'], d5)
            git(['config', 'user.name', 'g'], d5)
            const st5 = (rel, text) => {
              mkdirSync(join(d5, dirname(rel)), { recursive: true })
              writeFileSync(join(d5, rel), text, 'utf8')
              git(['add', '--', rel], d5)
            }
            const X5 = 'apps/api/src/routes/ks.ts'
            st5(X5, FIX.b1FalseAck)
            git(['commit', '-q', '-m', 'deleted-family-debt'], d5)
            st5(
              X5,
              h([
                '  await db.delete(table).where(eq(table.id, id))',
                '  return reply.send(success({ id, removed: true }))',
              ]),
            )
            const a = analyze(d5, 'staged')
            const hits = (a.ratcheted || []).filter((x) => x.kind === 'b1')
            return [
              a.counts.b1Violations,
              a.exit,
              hits.length,
              hits[0]?.key,
              hits[0]?.anchor,
              hits[0]?.now,
              formatReport(a).some((l) => /〈ack 键 removed〉/.test(l)),
            ]
          } finally {
            rmScratch(d5)
          }
        })(),
        //   违规 1  红  一条红点  键=removed  该键锚点 0  现值 1  报告点名该键
        [1, 1, 1, 'removed', 0, 1, true],
      )
      // B2R:B2 端到面 —— 同一棵临时仓里放"调用方 + 被调腿"两个路径,把"摘掉被调腿的 .returning("
      // 这一型在**索引面**上跑成红、在 HEAD 面上只报数。这是 B2 的装车证明:构造面只证明函数会给
      // 答案,"有人问了它"要靠真走一遍 analyze 的同面两遍取材(守门 118 的半接线同型)。
      eq(
        'B2R1–R6 端到面:HEAD 存量不红 / --strict 红 / 持平 0 / 补回 .returning( 即归零 / 摘掉必红且落在调用方 / 被调腿整文件不在面上⇒未判定不判红',
        (() => {
          const d4 = mkScratch('bch-b2-')
          const C4 = 'apps/api/src/routes/b2-caller.ts'
          const K4 = 'apps/api/src/db/b2-queries.ts'
          try {
            git(['init', '-q'], d4)
            git(['config', 'user.email', 'g@f.local'], d4)
            git(['config', 'user.name', 'g'], d4)
            const st4 = (rel, text) => {
              mkdirSync(join(d4, dirname(rel)), { recursive: true })
              writeFileSync(join(d4, rel), text, 'utf8')
              git(['add', '--', rel], d4)
            }
            // 夹具里的路径常量按真实仓形状拼,这里把两个夹具文件改成临时仓里的落点。
            const caller = (calleeRel) =>
              B2FIX.delegated.replace("from '../db/b2-queries.js'", `from '${calleeRel}'`)
            st4(C4, caller('../db/b2-queries.js'))
            st4(K4, B2FIX.calleeNoReturning)
            git(['commit', '-q', '-m', 'b2-debt'], d4)
            const hd = analyze(d4, 'head')
            const hdStrict = analyze(d4, 'head', { strict: true })
            const flat = analyze(d4, 'staged')
            st4(K4, B2FIX.calleeReturning) // 第二十六批产出的形态
            const fixed = analyze(d4, 'staged')
            git(['commit', '-q', '-m', 'b2-fixed'], d4)
            st4(K4, B2FIX.calleeNoReturning) // 回退:调用方一个字没动
            const regressed = analyze(d4, 'staged')
            const b2Red = (a) => (a.ratcheted || []).filter((x) => x.kind === 'b2')
            git(['commit', '-q', '-m', 'b2-restored', '--', K4], d4)
            // 被调腿整个不在 HEAD 面上(别人还没 add 的在途文件)⇒ 那一跳判不出 ⇒ 未判定,不判红
            git(['rm', '-q', '--cached', '-r', '--', 'apps/api/src/db'], d4)
            git(['commit', '-q', '-m', 'drop-callee'], d4)
            const gone = analyze(d4, 'head')
            return [
              hd.counts.b2Violations,
              hd.exit,
              hdStrict.exit,
              flat.exit,
              fixed.counts.b2Violations,
              fixed.exit,
              regressed.exit,
              b2Red(regressed).length,
              b2Red(regressed)[0]?.anchor,
              b2Red(regressed)[0]?.now,
              // 只有被调腿变了 ⇒ 红点必须落在**调用方**文件上(它才是那条假 ack 的主人)
              b2Red(regressed)[0]?.file,
              `${gone.counts.b2Violations}/${gone.counts.b2Undetermined}/${gone.exit}`,
            ]
          } finally {
            rmScratch(d4)
          }
        })(),
        [1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 'apps/api/src/routes/b2-caller.ts', '0/1/0'],
      )
      const empty = mkScratch('bch-empty-')
      try {
        git(['init', '-q'], empty)
        git(['config', 'user.email', 'g@f.local'], empty)
        git(['config', 'user.name', 'g'], empty)
        mkdirSync(join(empty, 'docs'), { recursive: true })
        writeFileSync(join(empty, 'docs/a.md'), 'x\n', 'utf8')
        git(['add', '-A'], empty)
        git(['commit', '-q', '-m', 'empty'], empty)
        let threw = ''
        try {
          analyze(empty, 'head')
        } catch (e) {
          threw = e instanceof Undetermined ? 'undetermined' : `other:${e?.message}`
        }
        eq('R6 枚举到 0 个候选文件 ⇒ 判死而非记绿', threw, 'undetermined')
      } finally {
        rmScratch(empty)
      }
    } catch (e) {
      R.push(`❌ 端到端夹具跑挂了:${e?.message ?? e}`)
    } finally {
      if (dir) rmScratch(dir)
    }
    repoCases = R.length - before
  }
  for (const r of R) console.log(r)
  const failed = R.filter((r) => r.startsWith('❌')).length
  console.log(
    failed
      ? `❌ self-test 失败 ${failed}/${R.length} 条`
      : `✅ self-test 全通过(${R.length} 条 = 构造面 ${R.length - repoCases} + 临时 git 仓端到面 ${repoCases})`,
  )
  return failed ? 1 : 0
}

/** 自检夹具仓专用的 git(绝对路径 + windowsHide + timeout;真仓判定面一律走 face-reader)。 */
function git(args, cwd) {
  return execFileSync(gitBinary() || 'git', ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`[${GATE}] 脚本自身异常:${e?.message}\n${e?.stack}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  // 判据只此一份实现:镜像测试与自检都从这里取,不得在测试里再抄一份(§22c)。
  // findBooleanAckSends / sendSuccessObjects 也在这里 —— 惯例计数的取材与违规判据共用同一遍 send 扫描,
  // 镜像测试要复核"数到了什么"只能调这两个出口,不得自己再写一份正则。
  // B1 同族:findBoolAckB1Sites 吃 findBooleanAckSends 的落点清单,豁免判法与判据一共用
  // readExemptMarker(换 token 不换实现)—— 测试不得另写"裸标记放不放行"的第二把尺子。
  maskText,
  findWriteChains,
  findFunctionBodies,
  findCountSends,
  findBooleanAckSends,
  findBoolAckB1Sites,
  // 2026-09-27 键族扩面:键表、动词表与两条"证据在别处"的出口都必须从这里取 ——
  // 测试里再抄一份键名单或再解一次 RETURNING,就成了第二真相(§22c)。
  BOOL_ACK_KEYS,
  BOOL_ACK_KEY_VERBS,
  findHonestCarrierSibling,
  hasRawSqlReturning,
  findRawSqlWriteChains,
  sendSuccessObjects,
  readExemptMarker,
  scanFileText,
  listCandidates,
  readCandidates,
  analyze,
  decide,
  formatReport,
  FIXTURES: FIX,
  SELF_SKIP,
  UNIQUE_OUTLET,
  EXEMPT_TOKEN,
  DELETE_ACK_EXEMPT_TOKEN,
  SCAN_DIRS,
  // B2 同族:一跳委托的两侧取材与判定都必须从这里取(镜像测试不得另写一份 import 解析或导出索引)。
  parseImportBindings,
  moduleSpecCandidates,
  indexExportedFns,
  planDelegatedAckSites,
  finishDelegatedAckSite,
  aggregateB2,
  listFacePaths,
  readCalleeTexts,
  scanFaceBundle,
  // 票 守门134 触发条件测量(不是判据):镜像 M24 从这里取,不得在测试里再写一份一跳解析。
  measureB2RawSqlTrigger,
  B2_FIXTURES: B2FIX,
  B2_CALLER,
  B2_CALLEE,
  API_SRC_DIR,
  // B3/B4/B5(G-815953/G-815956/G-815955)同族:判据函数与判词常量都从这里取 —— 测试里再抄一份
  // 迁移列名单/上界判词/排序键族,就成了第二真相(§22c)。
  findBackfillBoundSites,
  findTerminalStateSites,
  findOrderByTailKeySites,
  MIGRATION_COL_RE,
  BACKFILL_BOUND_RE,
  STATE_LITERAL_KEY_RE,
  RISKY_ORDER_COL_RE,
  ORDER_SINGLE_KEY_RE,
  // B6(G-815954)同族:判据函数、键族、绿腿/红腿判词、专属面枚举与声明判词工厂都从这里取 ——
  // 测试里再抄一份 jsonb 键族或声明正则,就成了第二真相(§22c)。
  findJsonbUpsertSites,
  JSONB_UPSERT_SCAN_DIRS,
  JSONB_UPSERT_COL_RE,
  JSONB_SET_RE,
  JSONB_MERGE_RE,
  JSONB_SQL_TAG_RE,
  EXCLUDED_REF_RE,
  jsonbPolicyDeclRe,
  listJsonbUpsertExtraPaths,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
