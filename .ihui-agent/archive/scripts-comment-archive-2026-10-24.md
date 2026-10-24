<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

## scripts/check-batch-write-count-honesty.mjs 原 L7-L338(@1b1648fe62d 逐字归档,C1 行数天花板收口 2026-10-24)

```
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
 *       **2026-10-24 收窄(F1)**:证据以被审的那条写调用为单位 —— 计数根若来自**另一条**写链的
 *       `.returning(` 结果,那是那条调用的答复,不替这条的 `.length` 发合格证;库读(归属预查询)照旧。
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
 * revoked/cleared,判据一处也看不见,下一次同样写法照样进 HEAD 而门一路报绿。当时键族 =
 * `deleted | removed | restored | revoked | cleared`(BOOL_ACK_KEYS 一份真相:判据正则、按键分组的
 * 报表、结论行逐键点名三处都从它派生;自检 K0 另备一份**独立写死**的期望表对账它有没有被削短)。
 * **2026-10-22 扩面(本批)**:全仓普查成功信封里的布尔 ack,五键之外还有 `updated` 13 处、
 * `created` 10 处,都是"写结果 ack"(UPDATE/INSERT 之后承诺"改/建成了一行"),与五键**同一形状、
 * 同一语义类别**;不纳入就继续整型隐身。故键族现为 **七键**,`updated` / `created` 一并纳入
 * `BOOL_ACK_KEYS`。其余信封键(`success` / `ok` / `received` / `accepted` / `notAvailable` 等)是
 * 业务状态或通用包裹标志,不是写结果 ack,**不进键族**;`success: true` 尤其只是一层通用包裹
 * (信封内 37 处,与"到底写了哪一行"无关),纳进来只会把整型的读数稀释。扩面后 HEAD 存量按既有
 * 棘轮只报数,**不写基线、不写白名单**。
 * **不与 COUNT_KEYS 复用同一个常量**:那张表问的是"自算的计数值",这张表问的是"布尔档承诺了什么",
 * 且键集并不相同(前者有 affected/count 无 revoked/cleared,后者反之)—— 合并就是混计。
 * 报表**按键分组**(`booleanAckByKey`,键族恒在位含 0),因为扩面后"合计 17 处"这句话分不清
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
 *     ② ack 键在 `BOOL_ACK_KEYS` 五键**之外**的同一形状 —— **2026-10-22 已扩面关闭**:
 *       `updated` / `created` 经全仓普查后已纳入键族(普查数据与语义理由见上"布尔档的键族"一段)。
 *
 * B1(2026-09-27 立):布尔 ack 里**可判的那一部分**从"只报数"升级成棘轮判据。用户已拍板把
 * `deleted: true` 改成真实语义(= 库里真删了一行,6 路并行改造在跑),所以"函数里真发了 delete/update,
 * 却无条件回 `deleted: true`"从惯例变成了**已知在偿的债** —— 新写一处这种假 ack、或把已改真的点改回
 * 字面量,都必须当场红;而 HEAD 存量不判红(与改动无关的恒红门唯一结局是逼人 `--no-verify`,§12e)。
 *   判据一条:同一**函数体**内 ① 有一条 `db|tx|trx` 发起的 `.delete(`/`.update(` 链(不要求 inArray ——
 *     B1 只问"这一屏真的发了写",不问命中集算法),② 有 `.send(<X>success({ … deleted: true … }))`
 *     字面量(与 V1 **共用同一份取材**:`sendSuccessObjects` + `findBooleanAckSends`,两处各扫一遍必漂移,
 *     M13 的 send-success 扫描式单点锁同时管住这一族),③ **被审的那条写链**(ack 之前最近的一条)
 *     自己既没有 `.returning(`、返回值也没喂给 `batchWriteOutcome(` ⇒ 违规。判据只在**响应对象面**里找
 *     `deleted: true` —— select 结果映射、类型注解、注释、字符串里的
 *     同字样一律不算(所以它不是整行 grep,`B1r` 用例钉死这一点)。
 *   两条放过通道(与违规判据同一次扫描内判定,各配正反用例):
 *     F1 **该条写调用自带的库答复** —— 以被审的那条写链为单位(函数体内 ack 之前最近的一条写链,
 *        含裸 SQL 写链):它自己带 `.returning(`(裸 SQL 则 SQL 文本带 `RETURNING`),或它的返回值
 *        喂给了 `batchWriteOutcome(`,才算放过。同函数体里**另一条**写链带 `.returning(` 不再替这一条
 *        发合格证(注释/字符串里的字样同样不算:判据跑在遮蔽后的代码面上);
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
 *      2026-10-22 再扩到七键(updated/created),同一份 HEAD 的 V1 读数再次变大,理由同上一句。
 *      要问"哪一族多少处"读 `booleanAckByKey`(键族恒在位,含 0),不要读那两个合计。
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
 *   **信封锚枚举(2026-10-23 第三十一批 ③)**:上面 V1/B1/B2 的锚点是 `success(` **后紧跟 `{`**
 *   (`ENVELOPE_ANCHOR_KEYS.direct`);`success(row ?? { updated: true })` 这一族在 `\s*\{` 那一步就被挡在
 *   面外,5 处整型隐身。故另立 `ENVELOPE_ANCHOR_KEYS.fallback`(`updated|created`)并配 B8 判据
 *   (`findFallbackAckSites`,只报数、不接提交链):兜底对象写死字面量 true ⇒ 点名;布尔来自
 *   rowCount/.length/.returning( 追溯或 `success(batchWriteOutcome(...))` 唯一出口 ⇒ 放过。
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
```

## scripts/git-guardian.mjs 原 L2743-L2764(@1b1648fe62d 逐字归档,C1 行数天花板收口 2026-10-24)

```
/**
 * 受管 `.env` 的「键值被悄悄清空」巡检 + 到人(2026-09-26 立,PLAN G-223 第三格)。
 *
 * 为什么挂在这里(而不是提交链):这一格判的是**机器状态** —— 这台机上的 .env 此刻有没有被
 * 悄悄清空。挂进 pre-commit blocking 就是一台与任何提交都无关的恒红门,唯一结局是逼人
 * `--no-verify`、连带废掉全部守门(AGENTS §12e / §4 记过多次同型);挂 warn 又等于没人看。
 * 本守护每 2 分钟一趟、已是全部自愈告警的唯一派发点(§5e),所以判据住在
 * `check-env-drift.mjs`,**到人**住在这里。
 *
 * 立因不是假想:2026-09-26 03:08 `apps/api/.env` 被一次整体替换清空 55 个键值(根 `./.env`
 * 那份 09-19 的过期镜像被按时间戳复制过来)。应用没崩(DATABASE_URL/JWT_SECRET 恰好非空),
 * 而唯一到人通道静默寄不出去 —— 症状只有去翻 deploy-loop.log 的人才看得见。
 *
 * 三态分流(与那把尺子的退出码同形,不许互相顶掉):
 *   exit 1 键值漂移   ⇒ log ❌ + notifyGuardRed(严重:凭据面)
 *   exit 2 未判定     ⇒ log ❓ + notifyGuardRed(另立 alert 身份,窗口各自去重;
 *                       "现文件没了 / 从没落过备份"都是这一档 —— 绝不静默,也绝不冒充"漂移")
 *   exit 0 全部可判且零漂移 ⇒ 不写日志(健康轮次保持安静,与其余 heal* 层同一条约定)
 * 尺子本身坏了(输出不是 JSON / 派生失败)同样喊出来,并按 §12e 的方向给出手动出口。
 * run/notify/logger 全部可注入 —— 与 checkConvergeAlignStall 同一套取证形状(§22c:镜像测试
 * 直接 import 本函数,用假派发器断言"哪种结论发哪种 alert",绝不在测试里真发信)。
 */
```

## scripts/git-guardian.mjs 原 L1569-L1578(@1b1648fe62d 逐字归档,C1 行数天花板收口 2026-10-24)

```
/**
 * 盘根封口自愈(2026-09-24 立)。`seal-c-root-stray.mjs` 把"第三方以 CWD=C:\ 写歪"的
 * 那几个名字换成指向外置根的 junction;但**重启会把它们清掉** —— 当天实测:开机后
 * `C:\common_attachment`、`C:\persistent_data`、`C:\tmp` 三个链接消失(只有 `tools` 活下来),
 * 而 D 侧目标内容完好。只靠每日 03:00 的 [4/4] 体检,意味着最长 23 小时空窗 ——
 * 这段时间够剪映/微信输入法自建真目录,回到"删了又长"的原点。本守护每 2 分钟一趟,
 * 挂在这里等于把空窗压到一个巡检周期。
 * 与其它自愈层同规矩:不改 status()/退出码语义,失败只记日志;--check 零副作用,
 * 仅真异常或真重封才写行(健康轮次不写日志是本守护的既有口径)。
 */
```

## scripts/git-guardian.mjs 原 L7-L42(@1b1648fe62d 逐字归档,C1 行数天花板收口 2026-10-24)

```
/**
 * git-guardian.mjs — `.git` 存活守护 + 秒级自愈(2026-09-12 立)。
 *
 * 事故背景(2026-08 至 2026-09-12,累计 15 次):本机宿主 safe-delete 层会**整体删除**
 * 工作区里的 `.git`。实测触发点:git commit(husky pre-commit 链)、rebase、
 * filter-repo(内部 gc/repack)、reset --hard、**git stash create**、
 * 以及本机直推 Gitee/GitCode 完成后的 5 秒窗口。
 * `CODEBUDDY_SAFE_DELETE_ENABLED=0` 前缀**已证明防不住**(第 14、15 次实测)。
 *
 * 两道根治(2026-09-12 落地):
 *   ① 结构根治 —— 仓库改为 `--separate-git-dir`:
 *        D:/IHUI-AI/.git      <- 28 字节**指针文件**(不再是 544MB 目录)
 *        D:/IHUI-AI-git-repo  <- 真实 gitdir(在工作区之外,躲开批量删除判定)
 *      即便指针文件被删,实体完好 —— 重建只需写 1 行。
 *   ② 本脚本兜底 —— 定时巡检,任一环缺失即自动重建,并写审计日志。
 *
 * 三道根治(2026-09-12 落地):
 *   ① 结构根治 —— 仓库改为 `--separate-git-dir`(见上)
 *   ② 本脚本兜底 —— 定时巡检,任一环缺失即自动重建,并写审计日志
 *   ③ 环境解耦 —— git 调用**不依赖 PATH / safe.directory 等环境**:
 *        可执行文件按候选列表绝对路径解析;每次调用显式带 `-c safe.directory=*`。
 *      (2026-09-12 06:47 实测缺口:服务账户 LocalSystem 下 git 不可用 →
 *       旧版只有"需人工介入",无自愈路径。本版补齐 healEnv()。)
 *
 * 用法:
 *   node scripts/git-guardian.mjs            # 检查 + 自动修复(默认)
 *   node scripts/git-guardian.mjs --check    # 只检查不修复(退出码 1 = 异常;供 CI/巡检用)
 *   node scripts/git-guardian.mjs --status   # 只打印健康详情
 *   node scripts/git-guardian.mjs --daemon   # 常驻巡检(需自备托管;本机未装 nssm,实际未用)
 *   node scripts/git-guardian.mjs --install  # 注册 Windows 任务计划(每 2 分钟自检;2026-09-12 实测可用并已启用,任务名 IHUI-AI git-guardian)
 *   node scripts/git-guardian.mjs --notify-test [名字]  # 真发一封"通知链路自测"邮件(绕过当轮去重,须节制)
 *   node scripts/git-guardian.mjs --notify-dry-run      # 只问品牌邮件派发器「通道是否齐备」(零网络请求)
 *   node scripts/git-guardian.mjs --bare-audit-report [--json]
 *      # 只读:列出守护每次检出 core.bare=true 时留下的现场审计(进程清单 + 嫌疑人),
 *      #   件在 .ihui-agent/state/git-bare-flip-audit/flip-*.json,保留最新 20 份。零副作用。
 */
```

## scripts/check-batch-write-count-honesty.mjs 原 L7-L57(@1b1648fe62d 逐字归档,C1 行数天花板收口 2026-10-24)

```
/** 〈原 332 行头注已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-24.md#batch-write-L7〉 check-batch-write-count-honesty.mjs — 批量写端点的 affected/deleted 不得由请求侧自算 */
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
import { requireFlagValue } from './lib/flag-value.mjs'

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
// B1 放过通道 F1(2026-10-24 收窄):证据必须落在**被审的那条写链**上,不再按整段函数体放行。
// 跑在**遮蔽后的代码面**上,所以注释/字符串里的 `.returning(` 或 `batchWriteOutcome(` 不配放过
// (否则一句解释性注释就能给假 ack 发合格证)。
const BATCH_OUTCOME_IN_BODY_RE = /\bbatchWriteOutcome\s*\(/
const OUTLET_CALL_RE = /\bbatchWriteOutcome\s*\(/g

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
```

## scripts/git-guardian.mjs 原 L4586-L4610(@1b1648fe62d 逐字归档,C1 行数天花板收口 2026-10-24)

```
/**
 * 部署停摆的**高频**派发点(尺子本体 = `scripts/check-credential-health.mjs --stall-only --json`)。
 *
 * 为什么必须挂在这里(2026-10-17 现读两件事):
 *  ① 节律:判据写的是 45 分钟阈值,而整支凭据巡检只由计划任务 `IHUI credential-health` 每 6 小时
 *     自跑(现读 Last Run 09:37 / Next 15:37 +08:00)⇒ "45 分钟"这个数从来没有按 45 分钟量过,
 *     节律与阈值差两个数量级等于没有判据。
 *  ② 同一天还量出更糟的一半:那封信里的**小时数本身是假的** —— 取材读的是仓内这份 checkout 的
 *     `.next/IHUI_BUILD_SHA` 与 `deploy/win/deploy-loop.log`,而活环根本不写这两处(线上标记
 *     11:36 已是 `cf3d5fc6e0`,仓内那份还停在 10-13 的 `2822437d8`)。根已改到 `prodCheckoutRoot`,
 *     节律由本格补上;两半缺一半都算没修。
 *
 * 三态纪律照 `auditTunnelLegHealth`:节流而非封量、发信一律经 `notifyGuardRed()`、未判定只写日志
 * 并点名原因(发一封"我什么都没量到"的信是把噪音冒充成告警)。尺子那一档**零写盘零发信**,
 * 本格是它唯一的人到出口。
 *
 * 身份 = **故障类别**(线上无构建标记 / 线上落后)× **拖了多久折档**(见 `alertHeldTier`)。
 * 2026-10-18 改:原写法把 `tip 前缀 + 最近一次成功部署时刻` 拼进身份,两个分量在这台机上每轮都变
 * —— 当日 361 枚提交推进 origin/main,而成功时刻又被尺子读成环自己的"距上次部署完成 N 分钟,本轮
 * 跳过"节流行(见 `collectStallInputs` 里那条注释)⇒ 每量一轮都是新故障,4 小时窗从没生效过,
 * 实测 18 封/天。这正是本文件 `alertCountTier` 头注与 §5e-1 明令禁止的形态("实时读数进正文,
 * 不进身份")。判据一个字没动:线上确实落后 origin/main,该红照红;改的只是**同一段红寄几封**。
 * 清偿 = `level` 回到 `ok`(线上追平)并清掉起点;起点件由 `noteUndeterminedStreak`/
 * `clearUndeterminedStreak` 这一份通用件维护,未判定不续命也不清零。
 */
```

## scripts/check-batch-write-count-honesty.mjs 原 L7-L338(@1b1648fe62d 逐字归档,严格版重做 —— 前一轮宽松版误吞 import 区,本次以"块内每行必须是注释行"为界)

```
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
 *       **2026-10-24 收窄(F1)**:证据以被审的那条写调用为单位 —— 计数根若来自**另一条**写链的
 *       `.returning(` 结果,那是那条调用的答复,不替这条的 `.length` 发合格证;库读(归属预查询)照旧。
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
 * revoked/cleared,判据一处也看不见,下一次同样写法照样进 HEAD 而门一路报绿。当时键族 =
 * `deleted | removed | restored | revoked | cleared`(BOOL_ACK_KEYS 一份真相:判据正则、按键分组的
 * 报表、结论行逐键点名三处都从它派生;自检 K0 另备一份**独立写死**的期望表对账它有没有被削短)。
 * **2026-10-22 扩面(本批)**:全仓普查成功信封里的布尔 ack,五键之外还有 `updated` 13 处、
 * `created` 10 处,都是"写结果 ack"(UPDATE/INSERT 之后承诺"改/建成了一行"),与五键**同一形状、
 * 同一语义类别**;不纳入就继续整型隐身。故键族现为 **七键**,`updated` / `created` 一并纳入
 * `BOOL_ACK_KEYS`。其余信封键(`success` / `ok` / `received` / `accepted` / `notAvailable` 等)是
 * 业务状态或通用包裹标志,不是写结果 ack,**不进键族**;`success: true` 尤其只是一层通用包裹
 * (信封内 37 处,与"到底写了哪一行"无关),纳进来只会把整型的读数稀释。扩面后 HEAD 存量按既有
 * 棘轮只报数,**不写基线、不写白名单**。
 * **不与 COUNT_KEYS 复用同一个常量**:那张表问的是"自算的计数值",这张表问的是"布尔档承诺了什么",
 * 且键集并不相同(前者有 affected/count 无 revoked/cleared,后者反之)—— 合并就是混计。
 * 报表**按键分组**(`booleanAckByKey`,键族恒在位含 0),因为扩面后"合计 17 处"这句话分不清
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
 *     ② ack 键在 `BOOL_ACK_KEYS` 五键**之外**的同一形状 —— **2026-10-22 已扩面关闭**:
 *       `updated` / `created` 经全仓普查后已纳入键族(普查数据与语义理由见上"布尔档的键族"一段)。
 *
 * B1(2026-09-27 立):布尔 ack 里**可判的那一部分**从"只报数"升级成棘轮判据。用户已拍板把
 * `deleted: true` 改成真实语义(= 库里真删了一行,6 路并行改造在跑),所以"函数里真发了 delete/update,
 * 却无条件回 `deleted: true`"从惯例变成了**已知在偿的债** —— 新写一处这种假 ack、或把已改真的点改回
 * 字面量,都必须当场红;而 HEAD 存量不判红(与改动无关的恒红门唯一结局是逼人 `--no-verify`,§12e)。
 *   判据一条:同一**函数体**内 ① 有一条 `db|tx|trx` 发起的 `.delete(`/`.update(` 链(不要求 inArray ——
 *     B1 只问"这一屏真的发了写",不问命中集算法),② 有 `.send(<X>success({ … deleted: true … }))`
 *     字面量(与 V1 **共用同一份取材**:`sendSuccessObjects` + `findBooleanAckSends`,两处各扫一遍必漂移,
 *     M13 的 send-success 扫描式单点锁同时管住这一族),③ **被审的那条写链**(ack 之前最近的一条)
 *     自己既没有 `.returning(`、返回值也没喂给 `batchWriteOutcome(` ⇒ 违规。判据只在**响应对象面**里找
 *     `deleted: true` —— select 结果映射、类型注解、注释、字符串里的
 *     同字样一律不算(所以它不是整行 grep,`B1r` 用例钉死这一点)。
 *   两条放过通道(与违规判据同一次扫描内判定,各配正反用例):
 *     F1 **该条写调用自带的库答复** —— 以被审的那条写链为单位(函数体内 ack 之前最近的一条写链,
 *        含裸 SQL 写链):它自己带 `.returning(`(裸 SQL 则 SQL 文本带 `RETURNING`),或它的返回值
 *        喂给了 `batchWriteOutcome(`,才算放过。同函数体里**另一条**写链带 `.returning(` 不再替这一条
 *        发合格证(注释/字符串里的字样同样不算:判据跑在遮蔽后的代码面上);
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
 *      2026-10-22 再扩到七键(updated/created),同一份 HEAD 的 V1 读数再次变大,理由同上一句。
 *      要问"哪一族多少处"读 `booleanAckByKey`(键族恒在位,含 0),不要读那两个合计。
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
 *   **信封锚枚举(2026-10-23 第三十一批 ③)**:上面 V1/B1/B2 的锚点是 `success(` **后紧跟 `{`**
 *   (`ENVELOPE_ANCHOR_KEYS.direct`);`success(row ?? { updated: true })` 这一族在 `\s*\{` 那一步就被挡在
 *   面外,5 处整型隐身。故另立 `ENVELOPE_ANCHOR_KEYS.fallback`(`updated|created`)并配 B8 判据
 *   (`findFallbackAckSites`,只报数、不接提交链):兜底对象写死字面量 true ⇒ 点名;布尔来自
 *   rowCount/.length/.returning( 追溯或 `success(batchWriteOutcome(...))` 唯一出口 ⇒ 放过。
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
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
