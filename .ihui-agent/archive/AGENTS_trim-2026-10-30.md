# AGENTS.md 体积归档 · 2026-10-30

来源:仓库根 `D:\IHUI-AI\AGENTS.md`(裁前 110,871 字节 → 裁后 94,887 字节,本次搬出 15,984 字节;门 207 预算 96,000 字节)。
口径:只搬**历史叙述 / 取证细节 / 重复登记副本 / 超长守门登记细节**,规则条款一条未删;正文原位留指针。
每条标注原行号与字节数;被「压缩」的条目在本件内保留**逐字全文**(压缩后的索引行在 AGENTS.md 原位)。

## 1. §1 只读对账尺子(与文末同名条重复,文末版为超集)(AGENTS.md 原 L46)

- **只读对账尺子不进提交链**(判机器状态/票面文本,提交者结构上满足不了,挂成提交门即 §12e 恒红门):`check-temp-landing.mjs`(TEMP 落点回潮)、`check-dispatch-premise.mjs`(派单票 premises 是否仍在 HEAD 成立,需 `--ticket`)、`check-alertmanager-live-config.mjs`(生效配置↔仓内模板)、`check-monitor-runtime-parity.mjs`(运行副本↔仓内 `monitoring/` 四对 + ai-service `.env` 结构键,三态分桶,配对 <4 即 exit 2;差异 ≠ 错,判红权归人;镜像 `check-monitor-runtime-parity.test.mjs`)。

## 2. 文末 护栏③ 压缩副本(§1 为正本)(AGENTS.md 原 L405)

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks` 原护栏判「工作树副本对台账非净 ⇒ 整批让路」;本仓多会话共写、副本**常年不净**,天天让路(实测 45 枚超龄牌 0 摘——脏的是别人的副本,而取材面=`git show HEAD`、落地=`object-space-land`、回潮由 `scrub-declared-removals`+`union-converge` 两通道兜,工作树净不净不在判据面)。收窄后**只在本批旧形态行被别席就地改写时让路、且只让那几枚,其余照摘**(实测 4 枚在飞⇒摘41让4);让路走 `planSweep.skipLines` 入 held(不写第二份判据),结论行补 `deferred=`;工作树读不到⇒仍让路(未判定不猜);节流同步 30min→**5min**。接线锁 `strip-stale-claim-marks.test.mjs`(护栏③三条+`planFaceClean` 退役形状锁)。〔原行逐字+实测数见 `.ihui-agent/archive/AGENTS_powershell-shellfix-2026-10-29.md`〕

## 3. 文末 「摘了又回来」压缩副本(§1 为正本)(AGENTS.md 原 L406)

- **「摘了又回来」已根治(2026-10-23 立)**:根因=器物只造了一半——清扫器落行不写留痕 ⇒ 两条回潮防线(`scrub-declared-removals`/`union-converge`)同时瞎 ⇒ 摘一次回一次。三条补齐:① 落地后逐条写 `plan-row-drop.jsonl`(`rowBefore`,kind=stale-closed-sweep);**凭据=HEAD 有没有被推进,不是落地器退出码**;留痕必须排在落地成功之后(先写后落=把"面上还在"说成"已删"⇒复洁器误剔⇒丢别人的行)。② `unionLines`/`verifyUnion` 共用 `declaredDropCaps`(判据 import `declaredRows`,§0.6):台账命中∧本侧0份∧登记行形才扣;本侧还留着绝不扣;台账取不到一条不扣(失效方向恒为多留)。③ guardian 清扫节拍 30min→**5min**(无滞留即零落地零推送,不刷爆共享仓)。接线锁 `closed-row-drop-ledger.test.mjs`(9例)〔原行逐字+实测数见 `.ihui-agent/archive/AGENTS_powershell-shellfix-2026-10-29.md`〕

## 4. 文末 一个编号只能有一行(§1 为正本,旧措辞「翻勾」)(AGENTS.md 原 L408)

- **一个编号只能有一行"当前状态"**:新登记同一件事必须把旧行翻勾或就地改写,不得再抄一份(复合主键 = 编号 + 标题前缀逐字等值,不是相似度;机器闸在 `scripts/live-doc-edit.mjs` 写盘闸 + 守门 130 差值棘轮)。归并出口:`node scripts/plan-tasks-merge.mjs --heal --commit`(F4 只加指针、绝不动勾选)。

## 5. 文末 5 条全满足(§20 为正本,旧措辞 PROJECT_PLAN 翻勾)(AGENTS.md 原 L412)

5 条全满足才可声明"完成":①代码合入 main 并推送;②验证齐绿(typecheck/build/test);③守门全过;④PROJECT_PLAN 翻勾;⑤交付报告带证据。commit 后忘记 push = 协作事故;4 道自动防线:post-commit 自动 push / push-state 跟踪 / converge 核验 / 任务完成定义。工具失联按流程升级,不得静默放弃。

## 6. 文末 一级目录只允许(§28 为正本,含 isSealedLink 项)(AGENTS.md 原 L413)

一级目录只允许 `check-root-dir-clean.mjs` 白名单内条目(配置/标准文档/`AGENTS.md`/`PROJECT_PLAN.md`/标准目录);禁止在一级目录生成 .log/.html/cookies/截图/ad-hoc 脚本,临时产物进 `tmp/`/`logs/`;新增合法条目必须显式改白名单随 commit 提交;任务收尾跑 `node scripts/check-root-dir-clean.mjs --staged`;被忽略的一级条目纳入只告警层。守门 44(blocking,跳过 `HUSKY_SKIP_ROOT_DIR_GUARD=1`)。

## 7. 文末 端侧读数第二份(同段孪生,保留含「23→69」那份)(AGENTS.md 原 L414)

- 端侧(RN / 共享源)同一约束,按宿主分五档:**等分格**行加 `flexWrap: 'wrap'` + 格加 `minWidth`(两条缺一不可,只给 minWidth 是溢出压邻格、只给 flexWrap 时 `flexBasis` 是 0 永不触发);**`space-between` 行 / `absolute` 容器**内的读数加 `flexShrink: 0`(否则行宽不够时先压读数、标签反而完整);**定宽格(`width:NN%` / `flexBasis`)**只能靠 `minWidth`(`flexShrink` 是纵向主轴属性,对横向定宽无效)。守门 `check-rn-readout-cell.mjs`(241,blocking,AST 判 JSX 父子关系,存量 69 处已归零),写法见 `docs/UI_GUIDELINES.md` §13.4。

## 8. R4 补记 ② 长版(与同区短版重复)(AGENTS.md 原 L420)

- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:**按承载形制分桶**(hosted 承载链三腿齐 ⇒ 该页无键可缺、按构造 100%;hand 端内手写 ⇒ 逐键数;broken 引壳而链断 ⇒ 那一屏渲染不出,比缺文案严重、逐条点名;other 声明镜像 A 而承载的是 B),差集只对 hand 页算"声明了却没还原的文案键",`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0";**CI 问责腿(2026-10-26 补)**= ci-monorepo build 矩阵 miniapp-taro 档 `mirror-fidelity` 步直跑 `--base=<基线>`(PR 判 base.sha、push 判 HEAD^1;只拦倒退、存量只报数,同 artifact-budget 的"只在 CI 问责"先例——三档面在干净检出上全部退化,不走 --base 即假接线) `check-analytics-page-coverage.mjs`(`check:analytics-coverage`;埋点覆盖面只读尺:分母=仓内声明页面清单 —— web 路由文件 / 小程序 app.config 主包+分包 / RN 屏名 / 插件侧栏路由,分子=visit_logs 去重 url,按端报 zeroVisit 与清单外;判据层 `scripts/lib/analytics-coverage.mjs`,镜像 `scripts/tests/analytics-coverage.test.mjs`;连不到库 ⇒ exit 2 未判定,绝不把"没判"读成"零缺口";**零访问 ≠ 未埋点**(四端都是单点挂载),它回答的是"声明面与观测面谁更宽")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。

## 9. 文末 PowerShell 条:与 §27 逐字重复的前缀(AGENTS.md 原 L407)

- agent 跑 PowerShell 必须用 `pwsh.exe`(7+),禁 `powershell -File`/`powershell -Command`(5.1 的 UTF8→UTF16LE BOM bug、代码页截断);项目内 `.ps1` 第一行 `#requires -Version 7`;**例外**:`deploy/**` 的 `.ps1` 不吃该 pragma(守门 `check-pwsh-version.mjs` 对该面只报名,真判据在调用侧:调 `deploy/**.ps1` 必须显式 `pwsh` 或经 `.vbs` 包装);路径统一正斜杠;`.ps1` 用 UTF-8 with BOM 写。解释器身份是七类现读机器事实之一——两引擎版本差异每次实测,别按 5.1 或 7 的假设写防御代码。 **根治@2026-10-29 实测**:嵌套 `pwsh -Command "…"` 双引号被外层(pwsh7)展开吃 $变量⇒ParserError;`-EncodedCommand` 编码必须是 UTF-16LE base64(UTF-8 字节错位=“CJK 乱码”假命令名);Bash 工具的 pwsh 恒带 -NoProfile 可绕用户 profile。正解=点源 `C:/Users/Public/Documents/PowerShell/ihui-shell-fix.ps1`(纯ASCII+BOM;pwshx 走 -EncodedCommand 零引号暴露、ihui-ps1 跑前自动补 BOM),真相源与三装载点登记见注记。〔取证细节逐字归档 `.ihui-agent/archive/AGENTS_powershell-shellfix-2026-10-29.md`〕

## 10. R4 补记 ② 短版 → 合族索引行(脚本名全保留)(AGENTS.md 原 L393)

- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:五枚**只读尺子/自检器**,均不进提交链(§12e,判机器状态或产出台账),接线面 = `scripts/git-guardian.mjs` 巡检轮派发 + 根 `package.json` 的 `check:*` 脚本 —— `check-gate-rot.mjs`(判据腐烂自检,只吃注册表与 `scripts/lib/judgement-libs.json` 两清单)· `check-plan-truncated-rows.mjs` · `check-web-rn-screen-parity.mjs` · `check-miniapp-mirror-fidelity.mjs`(CI 问责腿 = ci-monorepo build 矩阵 miniapp-taro 档 `--base`,不走 `--base` 即假接线)· `check-analytics-page-coverage.mjs`(连不到库 ⇒ exit 2 未判定;零访问 ≠ 未埋点);逐枚判据/基线件/`--self-test` 档逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。**退役口径**:任一枚退役须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 变成跑不通的出路(§8)。

## 11. R4 补记 ④ → 并入合族行(AGENTS.md 原 L396)

- **R4 漏点名补记 ④(2026-10-27)**:两枚只读尺子、均不进提交链(§12e)——`scripts/dispatch-board.mjs`(`check:dispatch-board`:派单口径单入口 + 切席 + 空转归因,磁盘容量是第 0 步前置判据)· `scripts/check-lint-staged-stdio-pin.mjs`(`check:lint-staged-pin`:只读盯 `patch-lint-staged-stdio.mjs` 三针是否还在 `node_modules`,判据住被 spawn 的脚本、本器零复制);判据/自检/镜像例数与退役口径逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

## 12. 短信通道哨兵 → 并入合族行(AGENTS.md 原 L401)

- **短信通道只读哨兵** `check-sms-channel-health.mjs`(2026-10-27 立,判机器状态不进提交链):吃本地投递审计表判短信通道健康(欠费停机型,如 OUT_OF_SERVICE 悬而无人喊),不碰云端接口、不引新凭据;判据/自检/派发面见门体头注。

## 13. R4 补记 ⑧ → 并入合族行(AGENTS.md 原 L402)

- **R4 漏点名补记 ⑧(2026-10-28)**:`check-asset-path-health.mjs`(只读巡检,判机器状态故不进提交链 §12e;派发面 = `scripts/git-guardian.mjs` 的 `auditAssetPathHealth` 每 6h;`--json`/`--self-test`;断链或证书错 exit 1,取不到输入 exit 2 未判定):受管 `.env` 引用的绝对路径可达性 + 证书到期,判据委托 `cert-expiry-check.mjs` 单源。

## 14. R4 补记 ⑨ → 并入合族行(AGENTS.md 原 L403)

- **R4 漏点名补记 ⑨**:`check-live-doc-merge-recall.mjs`(只读、不进提交链 §12e;接 `.husky/post-merge`):普通 merge 带回已结清行的探测,判据 import `liveDocExpectedCounts` 零复算;自检 4/4、镜像 6/6;无跳过变量。 + `check-ddos-guard-wiring.mjs`(257)

## 15. R4 补记 ⑩ → 并入合族行(AGENTS.md 原 L404)

- **R4 漏点名补记 ⑩(2026-10-29)**:`check-aasa-public-health.mjs`(只读哨兵:判 AASA 两腿公网可达且与单源同构;判机器状态 ⇒ 不进提交链 §12e;调度 = `git-guardian` 的 `auditAasaPublicHealth` 每 6h;入口 `pnpm check:aasa-health`;`--self-test` 28 例 / 镜像 31 例;未认识的旗标一律用法错 exit 2)。

## 16. R4 补记 ⑤ check-gate-triggers(AGENTS.md 原 L397)

- **R4 漏点名补记 ⑤(2026-10-27)**:`check-gate-triggers.mjs`(253,blocking,射程 `scripts/`,跳过 `HUSKY_SKIP_GATE_TRIGGERS=1`)判「注册表登记门没声明 `stagedTriggers` 射程」——同一份缺省在提交通道读成「任何提交都跑」(§15d)、在落地通道被 `selectAffectedGates` 读成「永不复跑」,两通道反义 ⇒「落地后 N 臂全绿」可以是盲绿;差值棘轮锚点 = HEAD^(缺省判 HEAD 面不是索引),摘射程亦红,存量只报数;`land-gate-rerun.mjs` 同批补 `countUntriggered`。判据全文与 2026-10-27 实证(门 193 缺射程,一笔落地往 `check-ps1-bom.mjs` 写进两处裸派生 git、落地器仍报 19 臂全绿)逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

## 17. R4 补记 ⑦ check-cross-end-spec-coverage(AGENTS.md 原 L398)

- **R4 漏点名补记 ⑦(2026-10-27,守门 89 R4 清偿)**:`check-cross-end-spec-coverage.mjs`(256,blocking,args=`--ratchet`,射程 `packages/shared/src/ui/`、`packages/ui-react/src/components/`、`packages/ui-native/src/`、`apps/web/src/components/data/`、`scripts/check-cross-end-spec-coverage.mjs`、`scripts/data/cross-end-spec-baseline.json`,跳过 `HUSKY_SKIP_CROSS_END_SPEC_COVERAGE=1`):跨端视觉原子 spec 覆盖率棘轮 —— 阶段1/2 把 card/input/badge/tabs/dialog/tooltip/vip-badge/switch/sheet/avatar 双端消费 spec,阶段3 把「覆盖率不退化」接进提交链与 CI(同 `sheet-flex-contract` 独立 job);口径见脚本头注与 `cross-end-spec-baseline.json`(11 项含 button,collapsible 为 EXEMPT 不计分母)。退化(某原子 spec 在却某端不再消费)才红,涨不拦。

## 18. R4 补记 ⑥ check-ruff-python(AGENTS.md 原 L400)

- **R4 漏点名补记 ⑥(2026-10-27)**:`check-ruff-python.mjs`(254,blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`):Python lint 由「只挂 CI」接进提交链(旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累);判定面照门 35 同口径(HEAD/索引/磁盘 ⇒ 先经 `face-reader` 取材 + `scratch-dir` 物化),pin 唯一源 `apps/ai-service/pyproject.toml`;uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红;自检与镜像例数、接线锁逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

## 19. R4 补记 ⑪ check-prod-dep-advisories(AGENTS.md 原 L421)

- **R4 漏点名补记 ⑪(2026-10-29)**:`check-prod-dep-advisories.mjs`(260,blocking,射程 `scripts/data/dep-audit-policy.json` + 本脚本 + `dep-advisory-radar.mjs`,跳过 `HUSKY_SKIP_PROD_DEP_ADVISORIES=1`):**生产可达的 critical/high 必须为 0**。两档刻意分开 —— `--staged` 只判政策文件形态(waiver 三要素 module/reason/expiresAt 齐全、reason ≥20 字、未过期),毫秒级不跑网络,拦的是「有人写一枚永不到期的豁免」;全量档读审计快照 `.ihui-agent/state/dep-audit-cache.json` 判生产高危是否全被覆盖,快照缺失或超 `maxCacheAgeDays`(默认 30)先自动刷新一次(实测 `pnpm audit --registry https://registry.npmjs.org` 6.8s),刷新失败 ⇒ **exit 2 未判定**(绝不写成「零漏洞」)。**「生产可达」口径 = pnpm audit findings 里存在 `dev !== true` 的路径**,必须与构建链分开:Taro/Expo 生态把 Metro、`@expo/cli` 这类构建器放在 `dependencies` 里 ⇒ 依赖树上「生产可达」而服务器进程根本 require 不到(硬证据 = `test -e apps/api/node_modules/<pkg>` 三端皆不存在);混为一谈的门会恒红,恒红门的唯一结局是被 `--no-verify` 连带废掉(§0.2)。构建链(devOnly)存量 23 条**只报数一条不拦**(§12e:加依赖时没人能选 Taro 的传递依赖)。豁免是带到期日的债不是消红通道(§0.7):过期即红,形态坏即红。自检 12 例方向锁 / 镜像 22 例;判据纯函数全 export,测试 import 源脚本不复制。

## 20. 补记 check-rn-compat-coverage(AGENTS.md 原 L415)

- **补记 2026-10-26(守门 89 R4)**:`check-rn-compat-coverage.mjs`(251,blocking,stagedTriggers=rn-compat/config/packages.app/apps.mobile-rn) —— 小程序复用「共享屏源 + 平台 adapter」的覆盖面对账:C1 消费面从 `react-native` 具名取用 ⊆ `apps/miniapp-taro/src/rn-compat` 出口(类型位也算,缺了 tsc 红而 babel 绿)、C2 lucide 名 ⊆ `icons-generated.tsx`、C3 `route-map.generated.ts` 目标页必须真在 app.config 在册;生成腿单源 `node scripts/gen-rn-compat.mjs --write`(名字全集按 HEAD 面现算,写后紧随注入水印),绝对零容忍(补上即绿,无存量可宽),自检 6 例含「摘掉即翻红」。

## 21. 补记 fix-package-exports-conditions(AGENTS.md 原 L416)

- **补记 2026-10-26(守门 89 R4,第二枚)**:`fix-package-exports-conditions.mjs`(252,blocking,args=`--check`,stagedTriggers=packages/apps) —— workspace 包子路径 exports 必须对 **CJS 解析条件**可达:只写 `types`+`import` 不带 `default`/`require` 的条目,对小程序 webpack(require/module/webpack/production/browser)与 `pnpm install --frozen-lockfile` 都不可达 ⇒ 跨端取数屏直接编不过。判据保守(单向:只给"缺 default 且缺 require 且有 import 值"补同值,不改既有条件不删条目),幂等自证,自检 5 例含"已有 require 不动""没有 import 值宁可漏补也不编路径";存量已在 `e91d8c38ed96` 一次清零 ⇒ 从第一天起绝对零容忍。

## 22. 补记 check-mjs-export-resolution(AGENTS.md 原 L417)

- **补记 2026-10-26(守门 89 R4,第三枚)**:`check-mjs-export-resolution.mjs`(253,blocking,stagedTriggers=scripts/) —— `scripts/` 的相对具名导入必须真存在于目标模块的出口面。立因是实测的一起**安静停机**:`9fdbc207ba2e` 把 `lib/gitdir.mjs` 的 `brokenRefsFromSnapshot` 当残留删掉而消费方 `git-guardian.mjs` 一字未动 ⇒ ESM 实例化期抛,守护任何档都起不来,而所有巡检腿的唯一调度器就是它。三维缺一不可(D3@2026-10-26:调 lib 导出却无 import ⇒ 门一跑 ReferenceError):D1 判本枚改动的消费方,D2 判本枚改动/删除的生产方(削出口而射程内仍有人按名取用)——病灶在生产方,只有 D1 的门结构上打不到。三维都窄在本枚改动集 ⇒ 不因存量恒红(§12e);整面命中只报数(现读存量 8 条全是那笔批量回退的残迹,归属待人工裁,本门不代裁也不白名单化)。自检 15 例含 D2 正控/反向对照/新建面不判;解析不了落 exit 2 不折成绿。

## 23. 跨端造页闭环腿(AGENTS.md 原 L418)

- **跨端造页闭环腿(2026-10-26 立,巡检轮)**:`scripts/git-guardian.mjs` 的 `sweepCrossEndShellPages()` 把 `scripts/land-cross-end-shell-pages.mjs` 从"只能人工敲"变成 30 分钟自跑一轮:blob = `git show HEAD:<file> ⊕ 本批行`(盘上未提交字节一字节不读),结论走 `--json` 的 summary(形状由 `scripts/tests/cross-end-shell-sweep-dispatch.test.mjs` C1 钉住,不手抄);clean 即零写零推,blocked/pending 只写日志不喊人(§5e-1),结论取不到记未判定不记绿。判机器状态 ⇒ 不进提交链(§12e)。**容量上限**:单分包 2 MiB(旧"增大主包"归因已证伪);判据 `scripts/lib/cross-end-subpackage-capacity.mjs`,门 110 **AB3** 兜底。

## 24. 补记 sync-rn-tokens(AGENTS.md 原 L419)

- **补记 2026-10-26(守门 89 R4,第四枚)**:`sync-rn-tokens.mjs`(254,blocking,args=`--check`,stagedTriggers=packages/design-tokens) —— RN 令牌表落后唯一源 tokens.css 就红:值同步维之外新增**覆盖面维**(生成 `rnCssLight`/`rnCssDark`/`rnCssColor(theme,key)`,把源里有而 RN 无同名档的 174 档整张搬进表;此前 RN 只 49 档 ⇒ 想用源档只能写死字面量,即"web 改一处 RN 不动"的真成因),门 93 R8 禁用值集随之 46→64。自检 41 例。

## 25. §1 「摘了又回来」条:用例枚举与台账对等句(AGENTS.md 原 L44)

- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 对等;**凭据是"HEAD 有没有被推进",不是落地器退出码**(实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除");留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`):30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`(9 例:留痕逐字/空集不落盘/留痕必须在落地之后/union 三条判据/两处 import 不许被删)。

## 26. §1 护栏③ 条:接线锁括注(AGENTS.md 原 L43)

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks`(超龄认领牌代摘器)原护栏判「`git status --porcelain` 对台账非净 ⇒ 整批让路」。本仓多会话共写活文档、工作树副本**常年不净**,于是护栏天天触发、器物天天让路:留痕最后一条停在 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘。之所以"脏"本来就不构成让路条件:取材面是 `git show HEAD:PROJECT_PLAN.md`、落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫,旧形态行逐字进 `LAND_CLASH_SCOPE.removed`)、工作树滞后带来的回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜 —— **脏的是别人的副本,不是判据面**。收窄后:只在本批旧形态行**被别席就地改写**时让路,且**只让路那几枚、其余照摘**(实测 45 枚里 4 枚在飞 ⇒ 摘 41、让路 4;原护栏会把 41 枚一起按住);让路行走 `planSweep` 的 `skipLines` 移入 held(不新写第二份判据),结论行补 `deferred=` 报数。工作树副本读不到 ⇒ 仍让路(未判定不猜)。派发节流同步 30min → **5min**(无滞留即零落地)。接线锁见 `scripts/tests/strip-stale-claim-marks.test.mjs`(护栏③ 三条 + 原 `planFaceClean` 已退役的形状锁)。**2026-10-23 实测**:待摘 45 → 4(剩的正是被别席改写那几枚),摘后借门 71 同一把尺子问"会不会被按未勾还原"点名 **0 ⇒ 0**,该族不会被回捞。

## 27. §15 15c 条:两处镜像钉住/落点括注(AGENTS.md 原 L230)

- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-no-nested-git.mjs`,blocking,`stagedTriggers: ['scripts/']` 把射程收到"能造出该状态的那一面";全量档一律跑):2026-10-14 实测——测试夹具在仓库内 `git init` 且**无任何清理钩子**,中断即永久残留 52 个演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净(机主一度无法判断自己有没有活没交)。需要临时 git 仓的夹具一律走 `mkScratch()`(§15b,工作区外 + 进程退出自动回收)。射程外只有一格:扫根直属一层的 `.worktrees/`(§12d 规定的 worktree 检出落点,linked worktree 天然带 `.git` gitfile,判红就是逼所有人不开 worktree 的恒红门);同名目录出现在更深位置照旧命中。〔补登@2026-10-20〕同一仓**已注册的** linked worktree 不再靠落点位置豁免,改由门按 `gitfile⇄admin 面双向核验`分流并逐条打印(悬空 gitfile / 回指伪造 / 指向他仓 admin / worktree 内再长出 `git init` 夹具 —— 四种照旧红,镜像 ⑦ 钉死);立项凭据是 §15「临时件落 `.ihui-agent/tmp/`」与门 208 头注「worktree 落 `.worktrees/`」互相打脸,同一组路径 10-15→10-20 六轮登记→腐烂回潮;而照其第一条出路重登记必被门 84 判「行级复活」(208⇄84 互斥,票 O508)。故另设第二把载体 `scripts/data/no-nested-git-sites.jsonl`:每处一行、只记意图与归属/到期,**存续由门在判的那一刻现算**,失去命中只 ⚠ 不清红;旧 JSON 台账的语义与腐烂红一字未动(镜像 ⑨⑩ 钉住"未命中免不了任何东西、到期不免、坏行零免")。另 `entryBudget` 定档出处:2026-10-20 现读全树 207,268 条目 / walk 1,274ms ⇒ 原 200,000 必被顶穿 = 恒 `truncated` = 恒红(§12e),已抬到 1,000,000,属只增不减覆盖面的加强档。

## 28. §守门速查 check:all 条:票号括注(AGENTS.md 原 L384)

- `pnpm check:all` = `scripts/all-checks-runner.mjs`(27 条子步骤,跑完再汇总、不短路)+ `pnpm check:dep-links:strict`;末条(第 27 条)是 `check:benchmark-delivery`(票 G-217 补接,此前造好未装车 = 没有)。**它的牙有三态**(G-217 补牙@2026-10-23):`--strict` 下"判不出"、"台账腐烂(docAnchor 找不到/重复登记)"或"仍存在(文档与代码脱节)且无有效豁免"⇒ exit 2 并把 `check:all` 顶红。合法暂态(等拍板/分阶段落地)唯一出口 = 登记表该条挂 `exemptUntil`(YYYY-MM-DD,会到期)+ `exemptReason`(≥10 字定向说明):缺一半/理由过短/日期形态坏/已到期 ⇒ 视同无豁免顶红;豁免挂在非"仍存在"条上 ⇒ 豁免粘连判腐烂顶红(§0.7 豁免验过才免且会到期,§0.10 不许走成白名单;有效豁免仍每轮打印点名)。

## 29. §守门速查 git 两条实测补:代理腿立因括注(AGENTS.md 原 L394)

- **git 网络与推送 · 2026-10-26 两条实测补(接 §16 与本区上一条规则面)**:① 出网代理腿死(本机 `http.proxy` 端口在听但 20/20 `Recv failure`,摘掉直连可通)⇒ `scripts/lib/face-reader.mjs` 的 `egressFallbackPlan` 只给**网络动词**在网络形态(128+传输回显∨挂死零回显)失败时**换腿重跑一次**(代理↔直连双向,方向由 `plan.useDirectArgs` 单点给),两腿都不通就回吐第一手错误并留痕 `.ihui-agent/state/git-egress-degradation.log`;服务器裁决/竞态/钩子失败各有专档,绝不换腿重试(接线锁 `scripts/tests/git-egress-fallback.test.mjs`)。② `safe-commit` 在本进程取不到 `user.email` 时按唯一出口 `scripts/lib/bypass-git.mjs` 的 `REPO_GIT_IDENTITY_ARGS` 补署名(问不到当作"有身份",绝不伪造作者),且裸 exit 128 不再被当成索引锁争用重跑整条守门链(接线锁 `scripts/tests/safe-commit-failure-triage.test.mjs`)。

## 30. §1 重复登记副本条:三处实测括注(AGENTS.md 原 L39)

- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口,10-14 二次实测补因):自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。**回潮实测到三条通道,逐条都得有器物**:①*推送*——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故清偿器落地后必须自带 `git-push-guard.mjs`(2026-10-14 实测 11:48 清偿 350 → 13:45 带回 1699);②*判据输入集*——守恒断言的输入若依赖它要消的形态就会自锁(`foldTwins` 排除带注记行,而清偿正在剥注记 ⇒ "重复第一次被看见"读成"本轮造出重复"、整批拒落),两侧必须同基准归一化;③*活文档行级 union*——按整行字符串比份数,认不出"对侧改写过而本侧已按台账清掉"的行(实测 21:42 本侧 0 → 21:44 合并带回 9),正解是补回前按**复合主键**再问一次清偿台账,归在册票 G-32;兜底已装车在旁路落地自愈源头 `lib/post-merge-ledger-sync.mjs` 第二步(存量>0 才派生 `plan-pointer-purge --apply`,0 条一次都不派生),归并侧那半格仍未收口。分族键指纹优先(与门 203 同源),不要按复合主键分族。 〔2026-10-15 摘除 2 份并发带回的旧副本,被摘行逐字进 `.ihui-agent/archive/AGENTS_dedup-removed-2026-10-15.md`(照本仓 AGENTS_dedup-removed-* 惯例:删副本不删证据)〕

## 31. §1 护栏③ 收窄条:两处实测括注 + 末段复述(AGENTS.md 原 L43)

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:`strip-stale-claim-marks`(超龄认领牌代摘器)原护栏判「`git status --porcelain` 对台账非净 ⇒ 整批让路」。本仓多会话共写活文档、工作树副本**常年不净**,于是护栏天天触发、器物天天让路:留痕最后一条停在 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘。之所以"脏"本来就不构成让路条件:取材面是 `git show HEAD:PROJECT_PLAN.md`、落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫,旧形态行逐字进 `LAND_CLASH_SCOPE.removed`)、工作树滞后带来的回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜 —— **脏的是别人的副本,不是判据面**。收窄后:只在本批旧形态行**被别席就地改写**时让路,且**只让路那几枚、其余照摘**(实测 45 枚里 4 枚在飞 ⇒ 摘 41、让路 4;原护栏会把 41 枚一起按住);让路行走 `planSweep` 的 `skipLines` 移入 held(不新写第二份判据),结论行补 `deferred=` 报数。工作树副本读不到 ⇒ 仍让路(未判定不猜)。派发节流同步 30min → **5min**(无滞留即零落地)。接线锁见 `scripts/tests/strip-stale-claim-marks.test.mjs`。**2026-10-23 实测**:待摘 45 → 4(剩的正是被别席改写那几枚),摘后借门 71 同一把尺子问"会不会被按未勾还原"点名 **0 ⇒ 0**,该族不会被回捞。

## 32. §1 「摘了又回来」条:三处实测括注(AGENTS.md 原 L44)

- **「摘了又回来」已根治(2026-10-23 立,机主令"彻底根治 杜绝 以绝后患")**:此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。三条补齐:① **留痕**——清扫器落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(字段 at/seat/file/kind=stale-closed-sweep/commit/baseline),;**凭据是"HEAD 有没有被推进",不是落地器退出码**(实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除");留痕必须排在落地成功之后,先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行。② **union 认台账**——`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 那一维(判据 import `scrub-declared-removals` 的 `declaredRows`,§0.6 单一真相源):台账命中 ∧ **本侧 0 份** ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣(扣了是丢本侧自己的行);台账取不到 ⇒ 一条不扣(失效方向恒为多留一份)。产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。③ **节拍**——guardian 派发节流由 30 分钟下调到 **5 分钟**(`sweepStaleClosedRows` 的 `intervalMs`):30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`。

## 33. §1 认领即租约条:两处实测括注 + 三口径漂移叙述(AGENTS.md 原 L32)

- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 自 2026-10-22 定档起**新增即拦** = CL4,HEAD 已欠着的只报数;年龄 >72h 判红 = CL1;守门 109 四档同用 HEAD 存量棘轮,只拦本次带进来的);完成翻勾并摘牌;**提交链上的门绝不代摘任何人的认领**,而超龄牌由兜底器物 `scripts/strip-stale-claim-marks.mjs` 代摘(guardian 每 30 分钟派发;判据 import 守门 109 的 `claimMarkOf`+`resolveTtlHours`,本层零复算;只摘「完整租约 ∧ 超龄」——正在干活的席位会续租,天然落在射程外;落地走 `object-space-land` 并把旧形态逐行写进 `removed` ⇒ 活文档行 union 不得再从对侧取回这一型;裸标记由器物**默认代摘**(依据不是口头状态,而是同批的 CL4:新增已在提交链被拦住,而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程),机主原话写进留痕条目的 `ruling` 字段(`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`),行内只留 `#seq` 指针(实测注记最长 52 字),原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落仓外留痕 `.ihui-agent/state/stale-claim-strip.jsonl`(90 天窗口老化,被裁条数必报,取不到判未判定)—— 注记本身会被活文档归并洗掉(实测一轮 64 枚只剩 6 枚),所以可追责的真相源是留痕 + 提交信息,不是台账行)。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。**挂牌判据单源 = `scripts/lib/plan-task-index.mjs` 的 `claimMarkOf`**(2026-10-22 收三口径漂移:① 复选框后可带空白、② 带 `@日期/持有者` 的完整租约形写在行尾也算、③ 反引号码段内的裸标记属叙述不算;两把尺子曾各自读出 31 与 59,差值同时是"真牌隐身⇒两席领同一张票"和"叙述锁死真票⇒派单面虚低"两个方向的失真)。

## 34. §5e 5e-3 条:立因叙述(AGENTS.md 原 L146)

- **发信量必须量得到,而且量的必须是"身份"(5e-3,2026-10-18 立)**:每一次投递尝试(成功**与**失败)都由发信层追写 `.ihui-agent/state/mail-send-ledger.jsonl`(ASCII 键 + ISO 时刻,身份只存 fp 前缀,收件人只存脱敏形态),量算仪 `alert-volume-report.mjs` 的"①b 发信面之二"按 `(producer, fp)` 数 24h 封数、同身份 60 分钟内 ≥2 封即点名风暴。立因是当天现读的一个**盲区**而不是噪声:该工具判据写死"ASCII 关键字 + 时间戳,中文一律不解码",而 git-guardian 的人到留痕是中文散文行 ⇒ 那天寄出 28 封(其中 18 封是同一场停摆),它账面上 `MAIL=0 封 / 0 个签名` —— **风暴判据结构上打不到最大的发信面,"一直在报警"这件事本身没人看得见**。同一天立守门 224(`check-alert-identity-volatility.mjs`)从源头拦"把 sha/时刻/原始计数/异常原文写进去重身份";量与拦必须同批,只装一边都算没修(只拦 ⇒ 下一种抖动没人识;只量 ⇒ 看见了还是照寄)。取不到台账一律落 `null`/未判定,**不得用 0 冒充"没寄过"**。

## 35. §15 15c 条:2026-10-14 事故复盘(AGENTS.md 原 L230)

- **15c 工作树内禁止嵌套 git 仓**(守门 208 `check-no-nested-git.mjs`,blocking,`stagedTriggers: ['scripts/']` 把射程收到"能造出该状态的那一面";全量档一律跑):2026-10-14 实测——测试夹具在仓库内 `git init` 且**无任何清理钩子**,中断即永久残留 52 个演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净(机主一度无法判断自己有没有活没交)。需要临时 git 仓的夹具一律走 `mkScratch()`(§15b,工作区外 + 进程退出自动回收)。射程外只有一格:扫根直属一层的 `.worktrees/`;同名目录出现在更深位置照旧命中。〔补登@2026-10-20〕同一仓**已注册的** linked worktree 不再靠落点位置豁免,改由门按 `gitfile⇄admin 面双向核验`分流并逐条打印(悬空 gitfile / 回指伪造 / 指向他仓 admin / worktree 内再长出 `git init` 夹具 —— 四种照旧红,镜像 ⑦ 钉死);立项凭据是 §15「临时件落 `.ihui-agent/tmp/`」与门 208 头注「worktree 落 `.worktrees/`」互相打脸,同一组路径 10-15→10-20 六轮登记→腐烂回潮;而照其第一条出路重登记必被门 84 判「行级复活」(208⇄84 互斥,票 O508)。故另设第二把载体 `scripts/data/no-nested-git-sites.jsonl`:每处一行、只记意图与归属/到期,**存续由门在判的那一刻现算**,失去命中只 ⚠ 不清红;旧 JSON 台账的语义与腐烂红一字未动。另 `entryBudget` 定档出处:2026-10-20 现读全树 207,268 条目 / walk 1,274ms ⇒ 原 200,000 必被顶穿 = 恒 `truncated` = 恒红(§12e),已抬到 1,000,000,属只增不减覆盖面的加强档。

## 36. §5f ProxyCommand 条:ssh 报错原文(AGENTS.md 原 L160)

- **`ProxyCommand` 的 Windows 路径只能用正斜杠(2026-10-27 立,当日踩过一整轮)**:`~/.ssh/config` 里 `ProxyCommand C:\Windows\System32\…\powershell.exe -File D:\DevEnv\secrets\cf-ssh-proxy.ps1 %h` 这种**未加引号的单反斜杠**写法,取值过 shell 式 argv 拆词时反斜杠是转义符 ⇒ 路径被吃成 `C:WindowsSystem32…powershell.exe`,ssh 只报 `exec: C:WindowsSystem32WindowsPowerShellv1.0powershell.exe: not found`。**这不是"生产机连不上"**——本机 `D:/DevEnv/ihui-prod` 本来就不存在(那是远程机的目录),两件事叠在一起极易误判成网络故障/长期未连。三种安全写法实测(2026-10-27 真跑命令验证正反例):正斜杠 / 双引号包裹 / 双反斜杠;**唯一被许可的手改出口是 `node scripts/doctor-ssh-tunnel.mjs --fix`**(静态检查默认只读,`--verify` 真连、`--self-test` 判据自检、`--json` 机读;发现"反斜杠被吃 / 引用件缺失 / IdentityFile 缺失 / 脚本前置件缺失"逐条点名给动作)。规范形态单源 = `deploy/win/ssh-config.aizhs-top.template` + `deploy/win/cf-ssh-proxy.ps1`,由 `scripts/tests/doctor-ssh-tunnel.test.mjs`(10 例)钉住四形态矩阵与模板不腐烂。**被 `powershell.exe`(5.1) 调起的 `.ps1` 含非 ASCII 必须带 UTF-8 BOM**:PS 5.1 对无 BOM 的 .ps1 按 ANSI 读,中文会被读成乱码并报「缺少 )」,整条隧道当场断(当日同样踩过)—— 判据锁在 `scripts/tests/doctor-ssh-tunnel.test.mjs` ⑨(从模板里 `powershell.exe` 这个事实推 BOM 必要性,不是无差别要求,`#requires -Version 7` 的脚本不在此列)。按 §0.2/§12e,**该体检仪刻意不进提交链**(判的是本机运行时配置,提交者结构上满足不了),没有"紧急跳过"环境变量。

## 37. §1 归档机制条:两处退役留痕括注(AGENTS.md 原 L40)

- **归档机制(2026-10-16 退役,此行为留痕)**:现行口径见上面「完成即删」——翻勾后整行删除,不留档、不归档、不写占位注释。旧那套两步走连同它的三件器物(自动归档器、13c 那道门、根 package.json 里的 archive 脚本位)已全部从仓里移除,现读 `git ls-files | grep -c archive-completed-tasks` **必须为 0**;若 ≠0,说明退役件(archive-completed-tasks.mjs / check-project-plan-archive.mjs 及各自镜像测试)被当作"本机纯新增在飞件"收编回流(2026-10-21 实测发生过一次,2026-10-29 已按本条清偿),处置 = 删除回流件即可,**不得恢复旧命令**——其活判据出口已迁户到 `scripts/lib/plan-block-partition.mjs`(被 ledger-strip-open-rows 活 import 的 partitionPlanBlocks/resolvePlanBase/resolveRequestedFace 三符号) ⇒ **不得再照旧文去跑那些命令**(§0.8:文档不许写跑不通的出路);历史残余见 `backup/archive-removal-2026-10-16` tag。防误删防线:未勾登记行照旧受守门 71 保护(已勾行不进保护集,删之合法);删行自由不豁免其他守门(130/203/71 未勾半照常判)。

## 38. 文末 旧版副本指针注释(所指副本已在 trim-2026-10-26)(AGENTS.md 原 L409)

<!-- 本条旧版副本("完成即删要有器物 2026-10-20/21 两版")已逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-26.md;现行唯一面 = 文末同名条(10-23 补齐留痕与节拍),节拍原由见「摘了又回来」条。 -->

## 39. 只读对账尺子条:两枚镜像测试名(AGENTS.md 原 L410)

- **只读对账尺子不进提交链**(判机器状态/票面文本,提交者结构上满足不了,挂成提交门即 §12e 恒红门):`check-temp-landing.mjs`(TEMP 落点回潮)、`check-dispatch-premise.mjs`(派单票 premises 是否仍在 HEAD 成立,需 `--ticket`)、`check-alertmanager-live-config.mjs`(生效配置↔仓内模板)、`check-monitor-runtime-parity.mjs`(运行副本↔仓内 `monitoring/` 四对 + ai-service `.env` 结构键,三态分桶,配对 <4 即 exit 2;差异 ≠ 错,判红权归人;镜像 `check-monitor-runtime-parity.test.mjs`)、`check-cross-end-parity-drift.mjs`(跨端对齐漂移;唯一调度器 = git-guardian 的 `auditCrossEndParityDrift()` 60 分钟轮,倒退按维到人;镜像 `cross-end-parity-drift-dispatch.test.mjs`)。**另一格会写盘**:`repair-cross-end-mirror.mjs` 的调度器 = 同文件的 `healCrossEndMirror()` 30 分钟轮(只补登记表已有的声明缺口、他席在飞一律拒落、只留日志不喊人;镜像 `cross-end-mirror-heal-dispatch.test.mjs`)。

## 40. §守门速查 等条件条:镜像例数括注(AGENTS.md 原 L390)

- **等条件条目同型禁止(2026-10-25 机主令,与待拍板禁令同族)**:台账里**不允许存在或新增**任何挂"等条件/等环境"桶的条目——出路只有三条:**agent 侧能当场做的当场做完**;真卡在机主动作面(供值/凭据/资质/控制台/真机扫码)的**改归属为「归:机主X面」出桶**(归他人桶,不是等条件桶);两者都不是的按观察类结清摘行(事实进 commit message)。机器级时序依赖(如搬迁要静默窗口)的出路 = 把执行**器物化**(探测器自动找窗口),不是挂账等条件。增量由守门 130 F12 差值棘轮拦(基线 F12 键集,存量清偿后收窄为 `[]` 永久地板);派单统计里等条件桶应读 0;不得改措辞绕 v2 尺(§12f)。**兜底清扫器 `strip-banned-buckets.mjs`**(2026-10-25 立,与待拍板 F11 同射程):union 收敛器/复翻席不走提交链 ⇒ 棘轮拦不到"主动写回",由 guardian 巡检轮 `sweepBannedBuckets` 派发(5min 节流)自动摘 HEAD 面两桶未勾行并留痕 f12-purge;判据 import 单源(plan-task-index v2 尺 + readFieldsFace),结论行 SWEEP-RESULT 三态;镜像 `scripts/tests/strip-banned-buckets.test.mjs` 7 例(留痕排在落地之后/落地走 object-space-land 不自带 CAS/已勾行不进射程)。复翻席纪律:复翻 union 带回的行时**必须同步摘禁令形态**(翻勾或改归属),带着等条件/待拍板字样原样回插的行会被本器 5 分钟内再摘。

## 41. 落地后追加:§1 「摘了又回来」条单点接线论证句(裁后第二轮)

产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。

## 42. 落地后回正记录(不是新增条款)

压缩 R4 漏点名补记 ②(短版/长版)时曾连带丢掉两条**现行规则**,已按原文逐字**原位恢复**到 AGENTS.md,此处留痕:
1. **退役口径**:任一枚退役须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 变成跑不通的出路(§8)。
2. 构建链(devOnly)存量只报数一条不拦(§12e)——恢复在 ⑪ check-prod-dep-advisories 条内。
<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md trim 2026-10-30 — 守门 207 体积清偿批(逐字留痕,删副本不删证据)

> 本批由席位 g35-s10 执行。摘除前 AGENTS.md 体积 = 95875 字节(工作树面实测,预算 96000);摘除后 = 89030 字节。
> 族内一律保留信息更全的现行版:§0–§29 规则条款一条未减;被移走的只有文末重复登记副本、
> 失效原文残留(旧翻勾形态、"这两型现无门"、hooksPath 停摆现场)与超长守门登记里的取证叙述。
> 本件全部内容由脚本从当轮 AGENTS.md **逐字切片**得到,非人工转写;每块在位判据 = 对原行
> grep -F 整行命中。门名集合前后差集为空(守门 89 R4 义务面不缩小)。
> 归档件不得再被文本级批量改写(§5c),也不得跑 `watermark.mjs clean`。
## §A 文末重复登记副本 / 失效原文(整行删除,原行逐字)

### 原行 30(160 字节;失效原文残留(翻勾形态已被「完成即整行删除」取代;其余分句与下一行逐字重复))

- 完成翻勾 `[ ]` → `[x] ✅(日期)`;新增任务追加到对应优先级(P0/P1/P2)末尾;commit message 用 `feat/fix/docs/chore/test/refactor` 前缀。

### 原行 254(158 字节;失效原文残留(自称"这两型现无门",现行面 = 同节「已由守门 133 判(blocking,已装车)」那条))

- parity 绿 ≠ 语种对:批量落 i18n 后必须逐语种量 CJK 三族互判 + 扫同名自套一层(`{"x":{"x":…}}`),这两型现无门,人工必查。

## §B 超长守门登记的取证叙述(行内整段摘除,摘出段逐字)

### 原行 10(550 字节 → 477 字节;归档件出处登记(HEAD sha + 字节数)属取证流水)

原行整行逐字:

> **本文件为 2026-10-14 压缩版**:规则条款全部保留;历史叙述、失效原文残留、重复登记副本与超长守门登记整区逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(出处 HEAD `c7834a8f0388aa006ca746cb1cc4a3006336c23d`,1,261,607 字节)。本文与归档原文冲突时以本文为准;本文未写的历史案例按归档件查。另见 `.ihui-agent/archive/AGENTS_history.md`。2026-10-21 二次压缩:压缩前原文逐字归档于 `.ihui-agent/archive/AGENTS-pre-compress-2026-10-21.md`。

摘出段:

- (出处 HEAD `c7834a8f0388aa006ca746cb1cc4a3006336c23d`,1,261,607 字节)

### 原行 32(1961 字节 → 1563 字节;认领即租约条内的实测数字与代摘依据叙述)

原行整行逐字:


摘出段:

- guardian 每 30 分钟派发;
- (依据不是口头状态,而是同批的 CL4:新增已在提交链被拦住,而器物只读 HEAD 面 ⇒ 别人刚写下还没提交的牌进不了射程)
- (实测注记最长 52 字)
- (实测一轮 64 枚只剩 6 枚)
- ;两把尺子曾各自读出 31 与 59,差值同时是"真牌隐身⇒两席领同一张票"和"叙述锁死真票⇒派单面虚低"两个方向的失真

### 原行 36(790 字节 → 621 字节;fold-identical 条的立项票号与机器成因叙述)

原行整行逐字:

- **未带指针而整行逐字节相同的未勾登记行,唯一合法摘除通道 = `node scripts/plan-tasks-merge.mjs --fold-identical-open-rows [--commit]`**(2026-10-16 立,承台账票「台账"同一件事的多份逐字相同待办"没有任何一条合法摘除通道」方向①):同文两份在派单清单里是两行 ⇒ 两个会话各领同一张票,这就是"打架重复做"的机器成因;该档把多重集折到 1,**不加任何注记**(机主 2026-10-13 明令),断言为「claimable 一枚不动 ∧ F4+F4b 副本计数恰好减去删除份数 ∧ 注记枚数不增」,任一不过即整批不落。同题不同号而正文已漂开的副本**不归它**(机器折半即有损,交人工),带指针的那一族仍走 `--dedupe-open-rows`;两面旗同给当场 exit 2。

摘出段:

- (2026-10-16 立,承台账票「台账"同一件事的多份逐字相同待办"没有任何一条合法摘除通道」方向①)
- 这就是"打架重复做"的机器成因;

### 原行 37(1289 字节 → 1197 字节;侧车条的结清票号与守卫实现名)

原行整行逐字:

- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。 **结构化侧车记录是第四种交代(2026-10-22 立,P1)**:侧车 = `scripts/data/plan-fields.jsonl`(键 = 编号 + 标题前缀逐字),写它只有 `node scripts/plan-fields-extract.mjs --apply` 一条出口(只搬说辞、一个台账行都不改;抽取前后每行归属桶零变化才放行,任一漂移整批不落);**归属改判**另有同源的声明式出口 `node scripts/plan-fields-reclassify.mjs --decl <json> [--apply]`(票 O68 结清批;禁桶守卫与 `--apply` 落在同一条 `applyReclassify` 判据里 ⇒ 改判同样不许手改 jsonl,也不许借它绕 F11/F12);行内 `〔归:…｜等:…〕` 标头是**投影**、人不手写,渲染与对账的唯一实现 = `scripts/lib/plan-field-line.mjs`,机读判据 = `scripts/check-plan-fields.mjs`(blocking,档位只挂差值维:仅本次新增未勾行缺侧车 / 标头≠投影才红,存量缺侧车只报数不拦提交,§12e)。整行改写必须过的三维守恒(勾选态 ∧ 认领租约 ∧ 归属桶)实现位置 = `scripts/lib/plan-row-conservation.mjs`,调用方 import 它,不接受口头保证。

摘出段:

- 票 O68 结清批;禁桶守卫与 `--apply` 落在同一条 `applyReclassify` 判据里 ⇒ 

### 原行 39(1615 字节 → 1083 字节;「重复登记副本」条的三条通道回潮实测流水)

原行整行逐字:


摘出段:

- ——对象空间 CAS 不跑 post-commit ⇒ 自动推送腿不触发 ⇒ origin 仍持有被删行,故
- (2026-10-14 实测 11:48 清偿 350 → 13:45 带回 1699)
- (`foldTwins` 排除带注记行,而清偿正在剥注记 ⇒ "重复第一次被看见"读成"本轮造出重复"、整批拒落)
- (实测 21:42 本侧 0 → 21:44 合并带回 9)
-  〔2026-10-15 摘除 2 份并发带回的旧副本,被摘行逐字进 `.ihui-agent/archive/AGENTS_dedup-removed-2026-10-15.md`(照本仓 AGENTS_dedup-removed-* 惯例:删副本不删证据)〕

### 原行 42(976 字节 → 928 字节;节拍下调注记(理由见同区 L43/L44,已并入归档))

原行整行逐字:

- **完成即删要有器物(2026-10-20 立,2026-10-21 补 H4)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 每 **5 分钟**派发(2026-10-23 由 30 分钟下调,理由见下条),单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。

摘出段:

- (2026-10-23 由 30 分钟下调,理由见下条)

### 原行 43(1557 字节 → 776 字节;护栏③ 收窄条的立因实测段)

原行整行逐字:


摘出段:

- 之所以"脏"本来就不构成让路条件:取材面是 `git show HEAD:PROJECT_PLAN.md`、落地走 `object-space-land`(blob 档 + CAS + 行级复活守卫,旧形态行逐字进 `LAND_CLASH_SCOPE.removed`)、工作树滞后带来的回潮由 `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 两条通道兜 —— **脏的是别人的副本,不是判据面**。
- 留痕最后一条停在 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘。
- (实测 45 枚里 4 枚在飞 ⇒ 摘 41、让路 4;原护栏会把 41 枚一起按住)
- **2026-10-23 实测**:待摘 45 → 4(剩的正是被别席改写那几枚),摘后借门 71 同一把尺子问"会不会被按未勾还原"点名 **0 ⇒ 0**,该族不会被回捞。

### 原行 44(2220 字节 → 979 字节;「摘了又回来」条的根因流水与实测时刻 / 留痕字段清单复述)

原行整行逐字:


摘出段:

- 此前清扫器摘得掉、存量却永远归不了零(实测 03:04 清扫一轮、03:27 已勾行仍 40 条),根因是这套器物**只造了一半**——清扫器 `strip-stale-closed-rows.mjs` 摘完落地却**一行留痕都不写**,于是两条回潮防线同时瞎:`scrub-declared-removals` 的 `declaredRows` 认不出这批行(它只认台账里的整行原文)、`union-converge` 的活文档行 union 只认"对侧相对基底新增" ⇒ 对侧旧基线里那份被当成别人的独有行原样补回 ⇒ 摘一次、回一次。
- (实测 CAS 成功推进 HEAD 而落地器因回读未判定返 exit 2,按退出码跳过留痕就成"无凭据摘除")
- :30 分钟那档跟不上结清提交的速度(03:12/03:14/03:20/03:25 各一枚),而无滞留时清扫器零落地零推送,压到 5 分钟不会刷爆共享仓
- (9 例:留痕逐字/空集不落盘/留痕必须在落地之后/union 三条判据/两处 import 不许被删)
- 产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,故只在这一处接,与 `yieldedIdCaps`(让号形态)合起来才堵满"本侧处置权已行使"这一整格。
- 与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 对等;
- (字段 at/seat/file/kind=stale-closed-sweep/commit/baseline)

### 原行 45(715 字节 → 677 字节;复洁器物条的实测事故括注)

原行整行逐字:

- **结清行的复洁器物(2026-10-22 立)**:`auto-commit-quiet.mjs` 收编滞后的工作树副本时,会把"已按台账正当摘除的登记行"当成新增带回(实测四枚已结清票整批复活),因为归并档只判不丢行/不重复,判不出"这行已被摘过"。出口 `scripts/scrub-declared-removals.mjs`(由收编器在归并达标后调用,不进提交链)按摘除台账 `.ihui-agent/state/plan-row-drop.jsonl` + `.ihui-agent/state/stale-claim-strip.jsonl` 逐行剔除,三条件同时成立才动:整行逐字在台账 ∧ 当下 HEAD 面已无此行 ∧ 登记行形;任一不成立或取不到输入一律不剔(exit 2 未判定)。镜像 `scripts/tests/scrub-declared-removals.test.mjs`。

摘出段:

- (实测四枚已结清票整批复活)

### 原行 47(794 字节 → 515 字节;自动档写活文档条的 161 枚长行事故实测段)

原行整行逐字:

- **自动档写活文档的硬规矩**:底稿一律取被审面(`git show HEAD:<文档>` / `scripts/lib/face-reader.mjs`),落盘走对象空间(临时索引 + `commit-tree` + CAS,不写工作树);落地前自证"父提交里每条 `[x]` 复合主键本次仍为 `[x]`",不成立拒绝落地(实测 18 行翻勾被退回的事故即此型)。**改写整行时还必须断言 `dispositionOf`(归他人/等条件/等拍板/可做)、`claimMarkOf`(租约)、`keyOfRow`(主键) 三维逐行不变,任一变了就整行还原**(2026-10-22 实测:把 161 枚 >400 字长行按本节压到 ≤400,切掉了中段的"归属:…"句子 ⇒ 派单口径 48→100,52 枚别人持有的票变成可领的票;门 71/109/130/203/229/234 当时全绿也照样错——账面要现读,不能只看守门 RC)。

摘出段:

- (实测 18 行翻勾被退回的事故即此型)
- (2026-10-22 实测:把 161 枚 >400 字长行按本节压到 ≤400,切掉了中段的"归属:…"句子 ⇒ 派单口径 48→100,52 枚别人持有的票变成可领的票;门 71/109/130/203/229/234 当时全绿也照样错——

### 原行 119(629 字节 → 612 字节;守护日志的健康态括注)

原行整行逐字:

- **结构与守护**:活 gitdir 形态按当次实测(本机 = 工作区内 `.git` 实体目录;`D:/IHUI-AI-git-repo` 与 `D:/IHUI-AI.git-backup-20260912` 是另一形态的遗留,禁止删除/清理)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),**手工抢修也不得把 `.git*` 归档 mv 到工作区根**。诊断:`node scripts/git-guardian.mjs --status|--check`;日志 `.ihui-agent/state/git-guardian.log`(健康不写行)。

摘出段:

- (健康不写行)

### 原行 121(675 字节 → 578 字节;删除意图账的立项与实测枚数)

原行整行逐字:

- **worktree/索引自愈**(`heal-worktree-tracked.mjs`,挂 guardian tick):①恢复被外部删除的跟踪文件(索引==HEAD ∧ HEAD 存在)——**先问删除意图账**:该路径最新一条留痕若仍是 `report-only`(摘标未超 TTL,默认 2h,`IHUI_STAGED_INTENT_TTL_HOURS`)则只报数不代裁;超 TTL 而归属会话已不在 ⇒ 回盘并把逐字路径清单写回同一本账(2026-10-23 立,治"护栏天天让路⇒整仓长期验不动",实测曾十小时内 9→46 枚);②对齐幻影漂移(索引==HEAD ∧ 工作区==某祖先版本);③刷新落后索引(逐路径 update-index,绝不全局 reset);**MERGE_HEAD 在 ⇒ 各写索引层整轮让路**。

摘出段:

- (2026-10-23 立,治"护栏天天让路⇒整仓长期验不动",实测曾十小时内 9→46 枚)

### 原行 122(902 字节 → 700 字节;④落地欠回写层的 19339 行事故与停部署叙述)

原行整行逐字:

- **④落地欠回写层(2026-10-14 立,`alignLandingDebtIndex`,同挂 `--align-drift`)**:`ALIGN_EXEMPT_PATHS` 把活文档从 ①②③ 整体绕行是**对的**(2026-10-12 那次"刷新索引 + 回写工作树"两层接力吃掉 19339 行台账),但旁路落地(`union-converge --apply` 用 commit-tree+CAS 只推进 HEAD)留下的那条**脏索引**从此无人负责——一次不带 pathspec 的提交会把合并成果写回旧态,而 `git merge --ff-only` 被它挡下 ⇒ 停部署。本层**只写索引、绝不写工作树**,判据 = 索引 blob 逐字节等于某枚 `bypass-landing` 留痕自述的前像(∧ 该枚 `landedSha` 是 HEAD 祖先 ∧ 工作区==索引);证明不了的一律 `held`/`undetermined` 逐条点名(§0.3),守护日志必打印。取证:`scripts/tests/heal-worktree-tracked.test.mjs` T9–T17(含形状锁"函数体内不得出现任何写工作树的动作")。

摘出段:

- (2026-10-12 那次"刷新索引 + 回写工作树"两层接力吃掉 19339 行台账)
- 一次不带 pathspec 的提交会把合并成果写回旧态,而 `git merge --ff-only` 被它挡下 ⇒ 停部署。

### 原行 124(368 字节 → 336 字节;conhost 委托键的现状括注)

原行整行逐字:

- **派生进程纪律**:`spawn/exec` 一律 `windowsHide: true`(机器级默认钩子 `install-console-window-hook.mjs --apply`,换机必跑;不得因钩子省略逐点参数);**派生 git 必须显式 stdio**(§12g);`NODE_OPTIONS` 钩子文件必须 `.mjs` 且放仓库外。禁弹窗排查先查 `HKCU\Console\%%Startup` 委托键(已固定 conhost,禁改回 WT)。

摘出段:

- (已固定 conhost,禁改回 WT)

### 原行 132(1094 字节 → 807 字节;上游工具生成物条的 tauri 典型现场段 / 覆盖面接线点的同层解释括注)

原行整行逐字:

- **上游工具生成物不进水印覆盖面**(唯一出口 `scripts/data/watermark-tool-generated.json` + 判据 `scripts/lib/tool-generated-roots.mjs`,2026-10-16 立):免的是"必须带载荷"这一项,**不免前提** —— 三条缺一不生效:① 路径落在登记 root 前缀内(逐字节比);② 该文件在**被审面**上自述为工具产物(命中 markerRegex);③ `expires` 未到期。不自述 ⇒ 回到覆盖面按缺载荷判红;台账形状坏 ⇒ 水印层拒绝判定(既不冒绿也不冒红,与第三方台账同一条判序)。接线点在 `watermark.mjs` 的 `scanCoverage` 且**必须在 total++ 之前**(与第三方 excluded 同层,否则覆盖率会被读成暴跌),`list-uncovered` / `check-watermark-coverage` / CI 那一步自动继承。这一档不是行内豁免族,**不进守门 108 的族表**,存活期逐条写在台账里。典型现场:`apps/desktop/src-tauri/permissions/autogenerated/*.toml` 共 89 枚由 tauri 的 Rust build script 每枚重建,inject 进去的载荷会被下一次构建洗掉 —— 按现状判红就是恒红门(§12e)。

摘出段:

- 典型现场:`apps/desktop/src-tauri/permissions/autogenerated/*.toml` 共 89 枚由 tauri 的 Rust build script 每枚重建,inject 进去的载荷会被下一次构建洗掉 —— 按现状判红就是恒红门(§12e)。
- (与第三方 excluded 同层,否则覆盖率会被读成暴跌)

### 原行 145(1130 字节 → 743 字节;发信量条的 28 封盲区立因流水)

原行整行逐字:


摘出段:

- 立因是当天现读的一个**盲区**而不是噪声:该工具判据写死"ASCII 关键字 + 时间戳,中文一律不解码",而 git-guardian 的人到留痕是中文散文行 ⇒ 那天寄出 28 封(其中 18 封是同一场停摆),它账面上 `MAIL=0 封 / 0 个签名` —— **风暴判据结构上打不到最大的发信面,"一直在报警"这件事本身没人看得见**。

### 原行 147(579 字节 → 492 字节;出口台账边界②的 CI checkout 细节)

原行整行逐字:

- **出口台账三条实测边界(2026-10-19)**:① 行身份 = `schema 2` 的 `source + alertId + subject`;未给 `--alert-id` 的调用退到"折过数字的标题"分桶,git-guardian 已传真身份(`buildGuardMailArgv` 的 `--alert-id`)。② CI 寄的信在本机无账(它在自己 checkout 的 `.ihui-agent/state/` 下写行,临时 runner 随 run 销毁)。③ 人读档"去重压住 N 轮"只算**出口** `--alert-id` 窗口压住的轮数,各生产者自压的轮次走不到出口。三处边界登记在 `scripts/data/alert-mail-faces.json` 的 `note`/`gapReason`。

摘出段:

- (它在自己 checkout 的 `.ihui-agent/state/` 下写行,临时 runner 随 run 销毁)

### 原行 151(1162 字节 → 888 字节;MSVC 注入条的 link.exe 报错现场与例数)

原行整行逐字:

- **Rust/MSVC 构建环境注入(2026-10-19 立)**:本机 `C:\Program Files\Git\usr\bin` 在系统 PATH 内且带 GNU `link.exe`,而 `apps/desktop/src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 按 PATH 解析 ⇒ 未加载 MSVC 的 shell 报 `link: missing operand after '\377\376'`,报错不提工具链。唯一真相源 `scripts/lib/msvc-env.mjs`(纯判据零 IO;`vswhere` 返回 `[]` 时用已知安装位兜底;PATH 键大小写不敏感;剔 `<Git>\usr\bin` 并前插 MSVC bin),入口薄壳 `scripts/desktop-build.mjs`(`--debug`/`--dev`/`--no-artifact-check`/`-- <透传>`);取不到工具链 ⇒ 显式「未判定」exit 2,绝不回落裸 env。已接线:`apps/desktop/package.json` 的 `build`/`build:debug`/`dev`/`dev:cdp`、`desktop-build-saas.mjs`、`desktop-dev-saas.mjs`、`release-desktop-local.mjs`;裸 `tauri build`/`tauri dev`/`cargo build` 不注入。**平台闸**:注入只对 win32 成立,macOS/Linux 用 clang/cc;判据单源 `needsMsvcInjection`,三个调用点都要问它(闸必须排在 planBuildEnv 之前);禁反向断言"文件里不许出现 `platform==='win32'`"。取证 `scripts/tests/desktop-build.test.mjs`(38 例)。

摘出段:

- 本机 `C:\Program Files\Git\usr\bin` 在系统 PATH 内且带 GNU `link.exe`,而 `apps/desktop/src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 按 PATH 解析 ⇒ 未加载 MSVC 的 shell 报 `link: missing operand after '\377\376'`,报错不提工具链。
- (38 例)

### 原行 154(659 字节 → 622 字节;ninja 备份件登记)

原行整行逐字:

- **Android 原生构建 MAX_PATH(2026-10-21 立)**:`react-native-worklets` 的 CMake 报 `build.ninja still dirty after 100 tries` 或 `mkdir(... .pnpm/react-native-worklets@0.11._…): No such file or directory`,是 Windows 260 字符路径上限,不是缓存脏:`LongPathsEnabled=1` 已开而 SDK 自带的 ninja 1.10.2 不认长路径。修法 = 换 ninja 1.12.1 覆盖 `Sdk/cmake/3.22.1/bin/ninja.exe`(原版备份 `ninja-1.10.2.exe.bak`);`CMAKE_SUPPRESS_REGENERATION=ON` 只消 dirty 循环,`CMAKE_OBJECT_PATH_MAX` 无效。模拟器 debug 包连 Metro 走 `10.0.2.2:8081`(本机 AVD 的 `adb reverse` 不通),且须先清模拟器全局 `http_proxy`。

摘出段:

- (原版备份 `ninja-1.10.2.exe.bak`)

### 原行 159(1771 字节 → 1315 字节;ProxyCommand 条的误判提醒与旗标用法流水 / ssh 报错原文取证串)

原行整行逐字:


摘出段:

- 本机 `D:/DevEnv/ihui-prod` 本来就不存在(那是远程机的目录),两件事叠在一起极易误判成网络故障/长期未连。
- (2026-10-27 真跑命令验证正反例)
- 静态检查默认只读,`--verify` 真连、`--self-test` 判据自检、`--json` 机读;
- (判的是本机运行时配置,提交者结构上满足不了)
- (当日同样踩过)
- ,当日踩过一整轮
- ,ssh 只报 `exec: C:WindowsSystem32WindowsPowerShellv1.0powershell.exe: not found`

### 原行 192(652 字节 → 615 字节;单分支门的阳性对照括注)

原行整行逐字:

- 除 main 外禁止新建分支;普通功能/修复/重构/文档一律 main 直接 commit。豁免(逐条点名不静默):`/goal` 的 `goal/*` 临时分支(完成立即删)、48h 在飞窗口内的 PR 分支、linked worktree checkout 分支及其 origin 镜像、镜像远端与幻影引用、stale 远程跟踪引用(出路 `--refresh-remote`)、**`backup/` 与 `ihui-backup/` 引用永不判红**。已合并分支本会话内删净;删未合并分支前必须 tag 备份(§22)。日常 `git fetch origin --prune`。守门:`check-single-branch.mjs`(41,blocking;在飞窗口 `IHUI_SINGLE_BRANCH_GRACE_HOURS`,阳性对照 = 窗口设 0 全翻红)。

摘出段:

- ,阳性对照 = 窗口设 0 全翻红

### 原行 215(219 字节 → 181 字节;撤装条的回收去向括注(现行面 = 上一条收尾五步))

原行整行逐字:

- 2026-10-21 撤装:自动回收器 reap-worktrees.mjs 与计划任务 IHUI-Worktree-Reap 已卸载(回收改由收尾五步人工执行);ensure-silent-tasks.mjs 的 ④ 回收链路监视段随之摘除,不得复活。

摘出段:

- (回收改由收尾五步人工执行)

### 原行 229(1949 字节 → 883 字节;15c 嵌套 git 仓条的 52 个演练仓现场与 208⇄84 立项流水 / mkScratch 的工作区外复述)

原行整行逐字:


摘出段:

- 2026-10-14 实测——测试夹具在仓库内 `git init` 且**无任何清理钩子**,中断即永久残留 52 个演练仓,IDE 源代码管理把嵌套仓当独立仓库扫描,聚合出「暂存的更改 10000+(全 D)」幻影计数,而主仓命令行面自始至终干净(机主一度无法判断自己有没有活没交)。
- (§12d 规定的 worktree 检出落点,linked worktree 天然带 `.git` gitfile,判红就是逼所有人不开 worktree 的恒红门)
- 立项凭据是 §15「临时件落 `.ihui-agent/tmp/`」与门 208 头注「worktree 落 `.worktrees/`」互相打脸,同一组路径 10-15→10-20 六轮登记→腐烂回潮;而照其第一条出路重登记必被门 84 判「行级复活」(208⇄84 互斥,票 O508)。
- 定档出处:2026-10-20 现读全树 207,268 条目 / walk 1,274ms ⇒ 原 200,000 必被顶穿 = 恒 `truncated` = 恒红(§12e),已抬到 1,000,000,
- (悬空 gitfile / 回指伪造 / 指向他仓 admin / worktree 内再长出 `git init` 夹具 —— 四种照旧红,镜像 ⑦ 钉死)
- (§15b,工作区外 + 进程退出自动回收)

### 原行 230(974 字节 → 806 字节;15d 与 15b 分工的散文解释 / 影子工具的预演语义括注)

原行整行逐字:

- **15d 盘根写入回归锁**(守门 213 `check-disk-root-write.mjs`,blocking,无 stagedTriggers=任何提交都跑):扫描仓库代码里“往磁盘根(D:/G:/C: 一级,即项目树与 DevEnv 之外)写文件/建目录”的模式,对**本次提交新增**的判红(差值棘轮,锚点 = 该文件 HEAD 自身 W1 数;存量只报数不判红,§12e 恒红门禁令)。与 15b 的**盘上**卫生 `check-disk-root-hygiene.mjs` 互补——那道守“盘上别留垃圾”,本门守“代码别再产新的”(把生产者堵在提交口)。收窄集 = literal 首段 ∈ `{IHUI-AI, DevEnv}`(§15b 批准落点,精确匹配非前缀)不立 W1;已知合法生产者走豁免台账 `scripts/data/disk-root-write-exemptions.json`(`{file, reason, ticket, until}`,到期回队列重裁)。配套影子工具 `scripts/quarantine-disk-root-strays.mjs`(只读预演“将会隔离什么”,未接自愈链)。应急放行 `HUSKY_SKIP_DISK_ROOT_WRITE=1 git commit ...`(不推荐)。

摘出段:

- 互补——那道守“盘上别留垃圾”,本门守“代码别再产新的”(把生产者堵在提交口)。
- (只读预演“将会隔离什么”,未接自愈链)

### 原行 236(492 字节 → 454 字节;16b 的机主令日期括注)

原行整行逐字:

- **16b 推送协议(2026-10-22 机主令,提速到极致)**:只说「推送」时**第一动作固定为 `git push origin main`**,禁止先预判冲突去跑 merge/converge/读工具源码;仅当 push 以 non-fast-forward 失败才进入收敛,且收敛最多一轮 fetch→converge→重生成派生件(README 数字 `gen-doc-numbers --markdown`、`ui-routes` 钉)→再 push。收敛产物(合并树上的生成文件)用普通 `git add` + `git commit`,不再叠 safe-commit/AGENT_SCOPE。

摘出段:

- (2026-10-22 机主令,提速到极致)

### 原行 237(374 字节 → 143 字节;16c 的 hooksPath 停摆实测段)

原行整行逐字:

- **16c 钩子装载位对账**:`core.hooksPath` 必须指向真实存在的钩子目录且 `pre-commit`/`post-commit` 齐备(守门 226 H3)。2026-10-21 实测 `core.hooksPath=.git/no-hooks`(目录不存在)⇒ git 静默跑 **0 个钩子**,post-commit 自动推送/双备份停摆两天、本地积压 7 枚提交才在手工收敛时暴露(失效方向是安静,§12f)。

摘出段:

- 2026-10-21 实测 `core.hooksPath=.git/no-hooks`(目录不存在)⇒ git 静默跑 **0 个钩子**,post-commit 自动推送/双备份停摆两天、本地积压 7 枚提交才在手工收敛时暴露(失效方向是安静,§12f)。

### 原行 316(594 字节 → 508 字节;D 盘根目录与桌面标识括注)

原行整行逐字:

- **所有开发工具全局缓存/临时目录必须指向 D 盘**(`D:\DevEnv\`,实测现值为准):`TEMP/TMP→D:\DevEnv\Temp`、`PNPM_HOME=D:\DevEnv\tools\pnpm`、npm/pip/uv cache、`GOPATH/GOMODCACHE/GOCACHE`、`PLAYWRIGHT_BROWSERS_PATH=D:\DevEnv\cache\playwright`;家目录工具态(`.cargo/.rustup/.m2/.cache/.codex/.trae*/.deepseek/.ollama/.ihui/com.ihui.desktop`(及 G-921 起独立标识的 `com.ihui.desktop.dev`)等)一律 junction 改道到 `D:\DevEnv\cache\userhome\`,**改道机制定为 junction 不 env 优先**(硬编码读取方靠旧路径可解析;换机/重装后重跑)。

摘出段:

- (`D:\DevEnv\`,实测现值为准)
- (及 G-921 起独立标识的 `com.ihui.desktop.dev`)

### 原行 387(537 字节 → 476 字节;F11 基线键集地板括注)

原行整行逐字:

- **待拍板条目一律禁止(2026-10-23 机主强制令,凌驾本仓一切"呈批等人"惯例)**:台账与计划文档里**不允许存在或新增**任何"待拍板/等人拍板/需拍板/待用户确认"的任务条目——存量逐条由 agent 深度分析后按最优推荐方案直接执行结清(决策与依据写进结清注记或 commit message);增量由守门 130 F11 差值棘轮当场判红拦截(基线 F11 键集地板 `[]` 兼看跳门塞 HEAD 那一型)。§24 的"暂停→确认"流程对本仓**不再适用**。

摘出段:

- (基线 F11 键集地板 `[]` 兼看跳门塞 HEAD 那一型)

### 原行 392(477 字节 → 464 字节;61px 溢出实测数字)

原行整行逐字:

- 「一格一读数」格子的**读数必须整条单行**;放不下只能减列/减栏,禁折行、禁截断、禁缩字号。只补 `nowrap` 会把折行变成溢出压邻格(实测 61px),列宽下限与栏阈值须与它同批改(算式与量法见 `docs/UI_GUIDELINES.md` §13)。守门 `check-readout-no-break.mjs`(240,blocking,含"摘掉即翻红"成对夹具);像素够不够本门不判,另用只读尺 `verify-wallboard-readout.mjs --locale <五语言>` 逐格量。

摘出段:

- (实测 61px)

### 原行 399(517 字节 → 527 字节;两通道反义的推导叙述 / 并入被删副本独有的规则 / 指针注记更新)

原行整行逐字:

- **R4 漏点名补记 ⑤(2026-10-27)**:`check-gate-triggers.mjs`(blocking,射程 `scripts/`,跳过 `HUSKY_SKIP_GATE_TRIGGERS=1`,id 现读):判「注册门没声明 `stagedTriggers` 射程」——同一份缺省在提交通道读成「任何提交都跑」、在落地通道被 `selectAffectedGates` 读成「永不复跑」,两通道反义 ⇒「落地后 N 臂全绿」可以是盲绿;差值棘轮锚点 = HEAD^(缺省判 HEAD 面不是索引),摘射程亦红;`land-gate-rerun.mjs` 同批补 `countUntriggered`。

摘出段:

- ——同一份缺省在提交通道读成「任何提交都跑」、在落地通道被 `selectAffectedGates` 读成「永不复跑」,两通道反义 ⇒「落地后 N 臂全绿」可以是盲绿;

### 原行 401(459 字节 → 375 字节;旁路落地不跑钩子的立因括注)

原行整行逐字:

- **R4 漏点名补记 ⑥(2026-10-27)**:`check-ruff-python.mjs`(blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`,id 现读):Python lint 由「只挂 CI」接进提交链(旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累);判定面照门 35 同口径(`face-reader` 取材 + `scratch-dir` 物化),pin 唯一源 `apps/ai-service/pyproject.toml`;uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红。

摘出段:

- (旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累)

### 原行 409(539 字节 → 501 字节;已被证伪的旧归因与未提交字节括注)

原行整行逐字:

- **跨端造页闭环腿(2026-10-26 立,巡检轮)**:`git-guardian.mjs` 的 `sweepCrossEndShellPages()` 把 `land-cross-end-shell-pages.mjs` 从「只能人工敲」变成定时自跑:blob = `git show HEAD:<file> ⊕ 本批行`(盘上未提交字节一字节不读),结论走 `--json` 的 summary;clean 即零写零推,blocked/pending 只写日志不喊人(§5e-1),取不到记未判定不记绿 ⇒ 不进提交链(§12e)。**容量上限**:单分包 2 MiB;判据 `scripts/lib/cross-end-subpackage-capacity.mjs`,门 110 **AB3** 兜底。

摘出段:

- (盘上未提交字节一字节不读)

## §C 并入现行面的文字(被删副本独有的规则)

### 并入原行 326(来源 = 被删原行 408)

**根治@2026-10-29 实测**:嵌套 `pwsh -Command "…"` 的双引号会被外层(pwsh7)展开吃掉 `$变量`⇒ParserError;`-EncodedCommand` 的编码必须是 UTF-16LE base64。正解 = 点源 `C:/Users/Public/Documents/PowerShell/ihui-shell-fix.ps1`(纯 ASCII+BOM;pwshx 走 -EncodedCommand 零引号暴露、ihui-ps1 跑前自动补 BOM),真相源与三装载点登记见 `.ihui-agent/archive/AGENTS_powershell-shellfix-2026-10-29.md`。

### 并入原行 46(来源 = 被删原行 411)

、`check-cross-end-parity-drift.mjs`(跨端对齐漂移;唯一调度器 = git-guardian 的 `auditCrossEndParityDrift()` 60 分钟轮,倒退按维到人;镜像 `cross-end-parity-drift-dispatch.test.mjs`)。**另一格会写盘**:`repair-cross-end-mirror.mjs` 的调度器 = 同文件的 `healCrossEndMirror()` 30 分钟轮(只补登记表已有的声明缺口、他席在飞一律拒落、只留日志不喊人;镜像 `cross-end-mirror-heal-dispatch.test.mjs`)。

### 并入原行 394(来源 = 被删原行 421)

。被删详版(2026-10-30 批)独有的判据要点:`check-plan-truncated-rows.mjs` 识别逻辑单源 `check-plan-fragment-rows.mjs` + 基线 `scripts/check-plan-truncated-rows-baseline.json`(只判身份不在基线的命中);`check-analytics-page-coverage.mjs` 分母 = 仓内声明页面清单、分子 = visit_logs 去重 url,判据层 `scripts/lib/analytics-coverage.mjs`;

### 并入原行 417(来源 = 被删原行 417)

自证幂等;存量已清零 ⇒ 绝对零容忍。

### 并入原行 398(来源 = 被删原行 0)

判据全文与 2026-10-27 实证(门 193 缺射程那一笔往 `check-ps1-bom.mjs` 写进两处裸派生 git、落地器仍报 19 臂全绿)逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

## §D 本批留存的指针注记改写

- L400:`(2026-10-25/27/28 三批)` → `(2026-10-25/27/28/30 四批)`
- L400:``AGENTS_trim-2026-10-28.md`;` → ``AGENTS_trim-2026-10-28.md`、`AGENTS_trim-2026-10-30.md`;`
- L398:`射程」差值棘轮锚点` → `射程」;差值棘轮锚点`

## §E 空行与逐字切片自证

- 删除空行:
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

---

# 第四轮(同日同席,收 union 回潮)

> 主席/别席的落地与活文档行 union 在 07:5x–08:0x 之间两次推进 HEAD 并把我席剪除的行按行补回(实测 HEAD 从 5dcfa93b2 → 155462628f → 52a6f5ee6b,工作树面 110430 → 103294 → 96969 → 95875 → 89030 → 101460)。本轮只摘「同一面里同一件事的第二份」:每族的存活份已逐条点名,删除份原文逐字如下。

### L401(§1 L32 同名条的尾部副本(union 带回),372 字节)

```
```

### L403(§1 L43 同名条的尾部副本(union 带回),933 字节)

```
```

### L404(§1 L44 同名条的尾部副本(union 带回),952 字节)

```
```

### L395(同区 L397 压缩版的 verbose 副本,838 字节)

```
```

### L376(README 已点名索引的重复登记(与门名索引条同族),195 字节)

```
- **常驻工具清单**(不在 runner、勿当没装车):同迁 `README.md` 同名节末段(两份历史清单已并集去重;原行逐字在 `.ihui-agent/archive/AGENTS_trim-2026-10-25b.md`)。
```

### L377(所点名门在 README 已点名 ⇒ AGENTS 重复登记,493 字节)

```
- **索引迁移漏点名补记**(守门 89 R4):`check-ai-task-background-reference.mjs`(247,ai-service 后台任务须走 spawn 唯一出口) `check-money-display-single-source.mjs`(248,分→元展示只许 `formatPrice` 一个出口) `check-registry-sync-health.mjs`(registry 目录同步「静默停更」哨兵,尺子判三态、派发挂 git-guardian 巡检轮;运维旋钮 `IHUI_REGISTRY_EGRESS_PROXY`,明细 `registry_sync_logs`)。三枚只在此点名,README 索引节尚未收录。
```

### L378(同上,509 字节)

```
- **生产签出外来工作只读尺子** `check-prod-checkout-foreign-work.mjs`(2026-10-21 立;镜像测试 `scripts/tests/check-prod-checkout-foreign-work.test.mjs`):生产签出工作区/索引 blob ↔ 该签出 HEAD 与 origin/main 两侧逐路径三态对账(duplicate/foreign/unjudged,`staged-untracked` 独立计数列,单列不并桶);判机器状态 ⇒ **不进提交链、不进 CI**(§12e),唯一调度器 = git-guardian 巡检双挂点;只读零写入;立因与两个实现坑见门体头注。
```

### L394(同上,346 字节)

```
- **239 计划归档单调性**:`check-plan-archive-monotonic.mjs`(blocking,跳过 `HUSKY_SKIP_PLAN_ARCHIVE_MONOTONIC=1`;HEAD 已归档 ✅ 的票不得复活成未勾活行/逐字孪生回插,自检 `--self-test` 8 例)。**公开 admin 默认口令对账**:`check-public-admin-default.mjs`(package.json 接线;判据与自检见门体头注)。
```

### L407(取证叙述,无 AGENTS 独家门名,962 字节)

```
```

### L41(与 L46 同族,保留含两枚跨端尺子的那条单源面,564 字节)

```
```

