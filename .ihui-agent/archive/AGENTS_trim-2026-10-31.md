# AGENTS.md 体积清偿归档(2026-10-31)

来源:`AGENTS.md` HEAD 面**逐行整行**搬出,原文一字未改。
搬出理由:门 207 预算 96,000 字节,清偿前 121,974(超 25,974)。按 AGENTS 自己声明的形状——
「守门脚本速查」区只留门 89 本体 + 横向口径 + 点名行——把**登记补记**与**同族重复副本**整行移入本件。
R4(「已接线而 AGENTS/README 通篇未点名」)的点名义务由 `README.md` 的「守门脚本点名索引」承担,
故搬走这些登记记录不削弱任何判据;搬出后门 89 R4 与门 238 须复跑现读为零红。

## 逐行原文
<!-- 原 L11 · 同族副本(留 L26) -->
12. **逆向-复现-超越铁律(2026-10-30 立,机主定案)**:凡要实现的能力在某个外部程序里已存在,必须走四步:① 定位对照程序(机主给的路径优先;无可对照程序时在结论里标明「无外部对照」,不空跑逆向);② 用本仓 MCP 服务器 `rea`(REA 6.4.0,配置 `.ihui/mcp.json`,入口 `scripts/rea-mcp-entry.mjs`)对对照程序取证——Electron/前端包走应用分析,安装包走归档分析,原生二进制仅在装机具备 Ghidra/IDA/Hopper 时才反编译;结论必须带 Evidence,分清观察/推断/未知。③ 在本仓用现有栈复现该能力(复现行为与设计,写自己的代码),并用测试钉住行为。④ 至少在一个轴上超越对照(更贴本仓架构/更好测/补齐对照缺失的边界)。**红线**:不把对方专有源码原样粘进仓库,不破解许可证,不绕过付费,不提取凭据。

<!-- 原 L28 · R4 登记补记 -->
- **R4 漏点名补记 ⑩(2026-10-29)**:`check-aasa-public-health.mjs`(只读哨兵:判 AASA 两腿公网可达且与单源同构;判机器状态 ⇒ 不进提交链 §12e;调度 = `git-guardian` 的 `auditAasaPublicHealth`;入口 `pnpm check:aasa-health`;未认识的旗标一律用法错 exit 2)。`check-origin-guard-liveness.mjs`(源站守卫存续哨兵,只读)。

<!-- 原 L51 · 门登记补记 -->
- **补记 2026-10-26(守门 89 R4,第四枚)**:`sync-rn-tokens.mjs`(254,blocking,args=`--check`,stagedTriggers=packages/design-tokens) —— RN 令牌表落后唯一源 tokens.css 就红:值同步维之外新增**覆盖面维**(生成 `rnCssLight`/`rnCssDark`/`rnCssColor(theme,key)`,把源里有而 RN 无同名档的 174 档整张搬进表;此前 RN 只 49 档 ⇒ 想用源档只能写死字面量,即"web 改一处 RN 不动"的真成因),门 93 R8 禁用值集随之 46→64。自检 41 例。

<!-- 原 L52 · R4 登记补记 -->
- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:**按承载形制分桶**(hosted 承载链三腿齐 ⇒ 该页无键可缺、按构造 100%;hand 端内手写 ⇒ 逐键数;broken 引壳而链断 ⇒ 那一屏渲染不出,比缺文案严重、逐条点名;other 声明镜像 A 而承载的是 B),差集只对 hand 页算"声明了却没还原的文案键",`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0";**CI 问责腿(2026-10-26 补)**= ci-monorepo build 矩阵 miniapp-taro 档 `mirror-fidelity` 步直跑 `--base=<基线>`(PR 判 base.sha、push 判 HEAD^1;只拦倒退、存量只报数,同 artifact-budget 的"只在 CI 问责"先例——三档面在干净检出上全部退化,不走 --base 即假接线) `check-analytics-page-coverage.mjs`(`check:analytics-coverage`;埋点覆盖面只读尺:分母=仓内声明页面清单 —— web 路由文件 / 小程序 app.config 主包+分包 / RN 屏名 / 插件侧栏路由,分子=visit_logs 去重 url,按端报 zeroVisit 与清单外;判据层 `scripts/lib/analytics-coverage.mjs`,镜像 `scripts/tests/analytics-coverage.test.mjs`;连不到库 ⇒ exit 2 未判定,绝不把"没判"读成"零缺口";**零访问 ≠ 未埋点**(四端都是单点挂载),它回答的是"声明面与观测面谁更宽")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。

<!-- 原 L53 · 门登记补记 -->
- **补记 2026-10-26(守门 89 R4,第二枚)**:`fix-package-exports-conditions.mjs`(252,blocking,args=`--check`,stagedTriggers=packages/apps) —— workspace 包子路径 exports 必须对 **CJS 解析条件**可达:只写 `types`+`import` 不带 `default`/`require` 的条目,对小程序 webpack(require/module/webpack/production/browser)与 `pnpm install --frozen-lockfile` 都不可达 ⇒ 跨端取数屏直接编不过。判据保守(单向:只给"缺 default 且缺 require 且有 import 值"补同值,不改既有条件不删条目),幂等自证,自检 5 例含"已有 require 不动""没有 import 值宁可漏补也不编路径";存量已在 `e91d8c38ed96` 一次清零 ⇒ 从第一天起绝对零容忍。

<!-- 原 L54 · 同族副本(留 L272) -->
5 条全满足才可声明"完成":①代码合入 main 并推送;②验证齐绿(typecheck/build/test);③守门全过;④PROJECT_PLAN 翻勾;⑤交付报告带证据。commit 后忘记 push = 协作事故;4 道自动防线:post-commit 自动 push / push-state 跟踪 / converge 核验 / 任务完成定义。工具失联按流程升级,不得静默放弃。

<!-- 原 L55 · 同族副本(留 L345) -->
一级目录只允许 `check-root-dir-clean.mjs` 白名单内条目(配置/标准文档/`AGENTS.md`/`PROJECT_PLAN.md`/标准目录);禁止在一级目录生成 .log/.html/cookies/截图/ad-hoc 脚本,临时产物进 `tmp/`/`logs/`;新增合法条目必须显式改白名单随 commit 提交;任务收尾跑 `node scripts/check-root-dir-clean.mjs --staged`;被忽略的一级条目纳入只告警层。守门 44(blocking,跳过 `HUSKY_SKIP_ROOT_DIR_GUARD=1`)。

<!-- 原 L342 · 同族副本(留 L453) -->
- agent 跑 PowerShell 必须用 `pwsh.exe`(7+),禁 `powershell -File`/`powershell -Command`(5.1 的 UTF8→UTF16LE BOM bug、代码页截断);项目内 `.ps1` 第一行 `#requires -Version 7`;**例外**:`deploy/**` 的 `.ps1` 不吃该 pragma(守门 `check-pwsh-version.mjs` 对该面只报名,真判据在调用侧:调 `deploy/**.ps1` 必须显式 `pwsh` 或经 `.vbs` 包装);路径统一正斜杠;`.ps1` 用 UTF-8 with BOM 写。解释器身份是七类现读机器事实之一——两引擎版本差异每次实测,别按 5.1 或 7 的假设写防御代码。 **根治@2026-10-29 实测**:嵌套 `pwsh -Command "…"` 的双引号会被外层(pwsh7)展开吃掉 `$变量`⇒ParserError;`-EncodedCommand` 的编码必须是 UTF-16LE base64。正解 = 点源 `C:/Users/Public/Documents/PowerShell/ihui-shell-fix.ps1`(纯 ASCII+BOM;pwshx 走 -EncodedCommand 零引号暴露、ihui-ps1 跑前自动补 BOM),真相源与三装载点登记见 `.ihui-agent/archive/AGENTS_powershell-shellfix-2026-10-29.md`。

<!-- 原 L390 · 同族副本(留 L454) -->
- 原速查整区(约 800 行超长登记)已逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`;本区只留门 89 本体 + 横向口径 + 点名行(R4 义务:每道已接线门必须在本文或 README 可见)。

<!-- 原 L391 · 同族副本(留 L455) -->
- **手动全量**:`node scripts/guardian-runner.mjs --staged`(pre-commit 模式)/不带为全量;失败不中断,跑完汇总再 exit 1(`GUARDIAN_STOP_ON_FIRST=1` 恢复 fail-fast)。

<!-- 原 L393 · 同族副本(留 L456) -->
- **207 体积对账**:`check-agents-doc-size.mjs`(blocking,预算 96,000 字节,跳过 `HUSKY_SKIP_AGENTS_DOC_SIZE=1`);阈值出处 = 会话日志 1,261,607 B ⇒ ratio 1.000、96KB ≈ 7.6% 的实测锚点;定级以门体头注与 runner 现值为准。

<!-- 原 L396 · R4 登记补记 -->
- **R4 漏点名补记 ③(2026-10-26)**:`check-e2e-coverage-gap.mjs`(warn 档,id 现读):射程内源码模块没有按命名约定对应的测试 ⇒ 差值棘轮只拦本次新增;射程 `scripts/data/e2e-coverage-gap-scope.json`、判据层 `scripts/lib/e2e-coverage-gap.mjs`、补测骨架 `scripts/e2e-autofill.mjs --propose`、跳过 `HUSKY_SKIP_E2E_COVERAGE_GAP=1`;升 blocking 前置 = 存量归零。

<!-- 原 L406 · 同族副本(留 L451) -->
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**(`.husky/pre-rebase` 硬拦;逃生口 `IHUI_ALLOW_REBASE=1` + `IHUI_ALLOW_REBASE_REASON="<≥10字定向说明>"`)。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动推送并回读;**仓库只有 `origin` 一个远端**(国内镜像与 `mirror-to-cn.yml` 已于 2026-10-23 弃用删除,残留远端/跟踪引用应删不是修)。收尾核验 `git-push-converge.mjs`;non-FF 跑 `git-sync-converge.mjs`。

<!-- 原 L407 · 同族副本(留 L452) -->
- **238 镜像 purge 内容完好**:`check-mirror-purge-intact.mjs`(blocking,射程 10 文档 = 4 版 README + AGENTS.md + 5 个 purge 覆盖文档;判据 M1–M4 全文见门体头注与 runner onFailHint,**此处不重抄**——判据字面量恰是本门禁语;一行多条只计最先;绝对零容忍;跳过 `HUSKY_SKIP_MIRROR_PURGE_INTACT=1`)。

<!-- 原 L410 · R4 登记补记 -->
- **R4 漏点名补记 ⑦(2026-10-27,守门 89 R4 清偿)**:`check-cross-end-spec-coverage.mjs`(256,blocking,args=`--ratchet`,射程 `packages/shared/src/ui/`、`packages/ui-react/src/components/`、`packages/ui-native/src/`、`apps/web/src/components/data/`、`scripts/check-cross-end-spec-coverage.mjs`、`scripts/data/cross-end-spec-baseline.json`,跳过 `HUSKY_SKIP_CROSS_END_SPEC_COVERAGE=1`):跨端视觉原子 spec 覆盖率棘轮 —— 阶段1/2 把 card/input/badge/tabs/dialog/tooltip/vip-badge/switch/sheet/avatar 双端消费 spec,阶段3 把「覆盖率不退化」接进提交链与 CI(同 `sheet-flex-contract` 独立 job);口径见脚本头注与 `cross-end-spec-baseline.json`(11 项含 button,collapsible 为 EXEMPT 不计分母)。退化(某原子 spec 在却某端不再消费)才红,涨不拦。

<!-- 原 L414 · 同族副本(留 L449) -->
- **等条件条目同型禁止(2026-10-25 机主令,与待拍板禁令同族)**:台账里**不允许存在或新增**任何挂「等条件/等环境」桶的条目——出路只有三条:**agent 侧能当场做的当场做完**;真卡在机主动作面(供值/凭据/资质/控制台/真机扫码)的**改归属为「归:机主X面」出桶**(归他人桶,不是等条件桶);两者都不是的按观察类结清摘行(事实进 commit message)。机器级时序依赖的出路 = 把执行**器物化**(探测器自动找窗口),不是挂账等条件。增量由守门 130 F12 差值棘轮拦;派单统计里等条件桶应读 0;不得改措辞绕 v2 尺(§12f)。**兜底清扫器 `strip-banned-buckets.mjs`**(与 F11 同射程):不走提交链的收敛/复翻席由 guardian 巡检轮自动摘两桶未勾行并留痕;判据 import 单源(plan-task-index v2 尺 + readFieldsFace);复翻席带回的行必须同步摘禁令形态。

<!-- 原 L415 · 同族副本(留 L435) -->
- **守门接线层对账**(89):`scripts/check-gate-wiring.mjs`(blocking,跳过 `HUSKY_SKIP_GATE_WIRING=1`)…**R1/R2** 头注或文档声称已接而五处权威点(`guardian-runner` ∪ `scripts/lib/pre-commit-hook.js` ∪ `.husky/*` ∪ 根 `package.json` ∪ `.github/workflows`+cert)零命中 ⇒ 拦;**R4** 已接线而 AGENTS.md/README.md 通篇未点名 ⇒ 拦(去后缀同名即算,文档面按 HEAD∪索引判,绝不读工作区);**R5** 同 id 两门、**R7** dispatcher 依据文件不存在、**R8** `stagedTriggers` 形态会让 `guardian-triggers.mjs` 当场抛错、**R13** 一个注册对象里两个 `id:`/`script:`(被吞的那道静默消失)均拦。R3/R6/弱接线只报数;台账 `scripts/gate-wiring-allowlist.json` 只救 R3;**R9** 详解见归档 `.ihui-agent/archive/AGENTS_trim-2026-10-23c.md`。

<!-- 原 L417 · R4 登记补记 -->
- **R4 漏点名补记 ②(2026-10-26)**:五枚**只读尺子/自检器**,均不进提交链(§12e),接线面 = `git-guardian.mjs` 巡检轮 + 根 `package.json` 的 `check:*` —— `check-gate-rot.mjs`(判据腐烂自检,只吃注册表与 `scripts/lib/judgement-libs.json`)· `check-plan-truncated-rows.mjs` · `check-web-rn-screen-parity.mjs` · `check-miniapp-mirror-fidelity.mjs`(CI 问责腿 = ci-monorepo miniapp-taro 档 `--base`,不走 `--base` 即假接线)· `check-analytics-page-coverage.mjs`(连不到库 ⇒ exit 2;零访问 ≠ 未埋点)。**退役口径**:任一枚退役须连同本行点名与同名调用点一并摘除,否则 `pnpm check:*` 成跑不通的出路(§0.8);详版判据要点见归档 `.ihui-agent/archive/AGENTS_trim-2026-10-30b-longR4.md`。

<!-- 原 L419 · R4 登记补记 -->
- **R4 漏点名补记 ④(2026-10-27)**:两枚只读尺子、不进提交链(§12e)——`dispatch-board.mjs`(`check:dispatch-board`:派单口径单入口 + 切席 + 空转归因;磁盘容量是第 0 步前置判据)· `check-lint-staged-stdio-pin.mjs`(`check:lint-staged-pin`:只读盯 `patch-lint-staged-stdio.mjs` 三针是否还在 `node_modules`,本器零复制)。

<!-- 原 L420 · R4 登记补记 -->
- **R4 漏点名补记 ⑤(2026-10-27)**:`check-gate-triggers.mjs`(blocking,射程 `scripts/`,跳过 `HUSKY_SKIP_GATE_TRIGGERS=1`,id 现读):判「注册门没声明 `stagedTriggers` 射程」;差值棘轮锚点 = HEAD^(缺省判 HEAD 面不是索引),摘射程亦红;`land-gate-rerun.mjs` 同批补 `countUntriggered`。判据全文与 2026-10-27 实证(门 193 缺射程那一笔往 `check-ps1-bom.mjs` 写进两处裸派生 git、落地器仍报 19 臂全绿)逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

<!-- 原 L421 · R4 登记补记 -->
- **R4 漏点名补记 ⑦(2026-10-27)**:`check-cross-end-spec-coverage.mjs`(blocking,args=`--ratchet`,射程 = 跨端 UI 四根 + 门体自身 + `scripts/data/cross-end-spec-baseline.json`,跳过 `HUSKY_SKIP_CROSS_END_SPEC_COVERAGE=1`):跨端视觉原子 spec 覆盖率棘轮(原子清单/EXEMPT/分母以脚本头注与基线件现读);退化(某原子 spec 在却某端不再消费)才红,涨不拦。

<!-- 原 L422 · R4 登记补记 -->
- **R4 漏点名补记 ⑥(2026-10-27)**:`check-ruff-python.mjs`(blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`,id 现读):Python lint 由「只挂 CI」接进提交链;判定面照门 35 同口径(`face-reader` 取材 + `scratch-dir` 物化),pin 唯一源 `apps/ai-service/pyproject.toml`;uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红。

<!-- 原 L423 · R4 登记补记 -->
- **R4 漏点名补记 ⑧(2026-10-30,守门 89 R4 清偿)**:五枚已接线门通篇未点名,补点名以消 R4 红 —— `check-root-guard-consistency.mjs`(根护栏清单↔内容一致性对账,blocking) · `check-ui-spec-mirror.mjs`(RN壳↔小程序壳 spec 接线对账) · `check-verbatim-resurrection.mjs`(逐字回潮对账,只读) · `check-web-portal-label-keys.mjs`(门户表 titleKey↔端内词包不变量) · `check-web-rn-parity.mjs`(web↔RN 功能/样式对账,只读报告器)。

<!-- 原 L425 · R4 登记补记 -->
- **R4 漏点名补记 ⑧(2026-10-28)**:`check-asset-path-health.mjs`(只读巡检,判机器状态 ⇒ 不进提交链 §12e;派发面 = `git-guardian.mjs` 的 `auditAssetPathHealth`;`--json`/`--self-test`;断链或证书错 exit 1,取不到输入 exit 2):受管 `.env` 引用的绝对路径可达性 + 证书到期,判据委托 `cert-expiry-check.mjs` 单源。

<!-- 原 L426 · R4 登记补记 -->
- **R4 漏点名补记 ⑨**:`check-live-doc-merge-recall.mjs`(只读、不进提交链 §12e;接 `.husky/post-merge`):普通 merge 带回已结清行的探测,判据 import `liveDocExpectedCounts` 零复算;无跳过变量 + `check-ddos-guard-wiring.mjs`(id 现读)

<!-- 原 L427 · R4 登记补记 -->
- **R4 漏点名补记 ⑩(2026-10-29)**:`check-aasa-public-health.mjs`(只读哨兵:判 AASA 两腿公网可达且与单源同构;判机器状态 ⇒ 不进提交链 §12e;调度 = `git-guardian` 的 `auditAasaPublicHealth`;入口 `pnpm check:aasa-health`;未认识的旗标一律用法错 exit 2)。

<!-- 原 L428 · 同族副本(留 L458) -->
- **非色档三族同源(2026-10-28 立)**:间距 `SPACING_STEPS` / 字号 `TYPE_STEPS`+`FONT_WEIGHTS` / 阴影 `ELEVATION_CSS` 是唯一真源,由 `scripts/sync-css-tokens.mjs` 生成到 tokens.css 的 `css-tokens:managed` 受管块(`@theme` 内末尾);受管块**派生态禁止手改**——改值改 TS 源后跑 `--write`,守门 93 的 R9/R10/R11 判受管块与 TS 源逐值同源(缺档/漂移/多档三方向都红),`pnpm check:tokens-css` 可单跑。圆角仍走 `radius.js` 单源,不重复生成。

<!-- 原 L429 · 门登记补记 -->
- **补记 2026-10-26(守门 89 R4)**:`check-rn-compat-coverage.mjs`(blocking,stagedTriggers=rn-compat/config/packages.app/apps.mobile-rn,id 现读):小程序复用「共享屏源 + 平台 adapter」的覆盖面对账 —— C1 消费面从 `react-native` 具名取用 ⊆ `apps/miniapp-taro/src/rn-compat` 出口(类型位也算)、C2 lucide 名 ⊆ `icons-generated.tsx`、C3 `route-map.generated.ts` 目标页必须真在 app.config 在册;生成腿单源 `scripts/gen-rn-compat.mjs --write`(名字全集按 HEAD 面现算),绝对零容忍。

<!-- 原 L430 · 门登记补记 -->
- **补记 2026-10-26(守门 89 R4,第三枚)**:`check-mjs-export-resolution.mjs`(blocking,stagedTriggers=scripts/,id 现读):`scripts/` 的相对具名导入必须真存在于目标模块的出口面。立因是一起**安静停机**——删掉 `lib/gitdir.mjs` 的导出而消费方 `git-guardian.mjs` 未动 ⇒ ESM 实例化期抛,而巡检腿的唯一调度器就是它。三维:D1 本枚改动的消费方、D2 本枚改动/删除的生产方(病灶在生产方)、D3 调 lib 导出却无 import;都窄在本枚改动集 ⇒ 不因存量恒红(§12e);解析不了落 exit 2 不折成绿。

<!-- 原 L432 · R4 登记补记 -->
- **R4 漏点名补记 ⑪(2026-10-29)**:`check-prod-dep-advisories.mjs`(blocking,射程 = `scripts/data/dep-audit-policy.json` + 门体 + `dep-advisory-radar.mjs`,跳过 `HUSKY_SKIP_PROD_DEP_ADVISORIES=1`,id 现读):**生产可达的 critical/high 必须为 0**。`--staged` 只判政策形态(waiver 三要素齐、reason ≥20 字、未过期,不跑网络);全量档读快照 `.ihui-agent/state/dep-audit-cache.json`,缺失或超 `maxCacheAgeDays` 先刷新,刷新失败 ⇒ **exit 2 未判定**(绝不写成「零漏洞」)。**「生产可达」= findings 里存在 `dev !== true` 的路径**,必须与构建链分开(Taro/Expo 把 Metro 这类构建器放在 `dependencies`,服务进程 require 不到;混为一谈即恒红门,§0.2);构建链存量只报数。豁免是带到期日的债不是消红通道(§0.7)。

<!-- 原 L433 · R4 登记补记 -->
- **R4 漏点名补记 ⑪(2026-10-29)**:`check-prod-dep-advisories.mjs`(260,blocking,射程 `scripts/data/dep-audit-policy.json` + 本脚本 + `dep-advisory-radar.mjs`,跳过 `HUSKY_SKIP_PROD_DEP_ADVISORIES=1`):**生产可达的 critical/high 必须为 0**。两档刻意分开 —— `--staged` 只判政策文件形态(waiver 三要素 module/reason/expiresAt 齐全、reason ≥20 字、未过期),毫秒级不跑网络,拦的是「有人写一枚永不到期的豁免」;全量档读审计快照 `.ihui-agent/state/dep-audit-cache.json` 判生产高危是否全被覆盖,快照缺失或超 `maxCacheAgeDays`(默认 30)先自动刷新一次(实测 `pnpm audit --registry https://registry.npmjs.org` 6.8s),刷新失败 ⇒ **exit 2 未判定**(绝不写成「零漏洞」)。**「生产可达」口径 = pnpm audit findings 里存在 `dev !== true` 的路径**,必须与构建链分开:Taro/Expo 生态把 Metro、`@expo/cli` 这类构建器放在 `dependencies` 里 ⇒ 依赖树上「生产可达」而服务器进程根本 require 不到(硬证据 = `test -e apps/api/node_modules/<pkg>` 三端皆不存在);混为一谈的门会恒红,恒红门的唯一结局是被 `--no-verify` 连带废掉(§0.2)。构建链(devOnly)存量 23 条**只报数一条不拦**(§12e:加依赖时没人能选 Taro 的传递依赖)。豁免是带到期日的债不是消红通道(§0.7):过期即红,形态坏即红。自检 12 例方向锁 / 镜像 22 例;判据纯函数全 export,测试 import 源脚本不复制。

<!-- 原 L437 · 同族副本(留 L453) -->
- agent 跑 PowerShell 必须用 `pwsh.exe`(7+),禁 `powershell -File`/`powershell -Command`(5.1 的 UTF8→UTF16LE BOM bug、代码页截断);项目内 `.ps1` 第一行 `#requires -Version 7`;**例外**:`deploy/**` 的 `.ps1` 不吃该 pragma(守门 `check-pwsh-version.mjs` 对该面只报名,真判据在调用侧:调 `deploy/**.ps1` 必须显式 `pwsh` 或经 `.vbs` 包装);路径统一正斜杠;`.ps1` 用 UTF-8 with BOM 写。解释器身份是七类现读机器事实之一——两引擎版本差异每次实测,别按 5.1 或 7 的假设写防御代码。

<!-- 原 L438 · R4 登记补记 -->
- **R4 漏点名补记 ④(2026-10-27)**:两枚只读尺子、均不进提交链(§12e)——`scripts/dispatch-board.mjs`(`check:dispatch-board`:派单口径单入口 + 切席 + 空转归因,磁盘容量是第 0 步前置判据)· `scripts/check-lint-staged-stdio-pin.mjs`(`check:lint-staged-pin`:只读盯 `patch-lint-staged-stdio.mjs` 三针是否还在 `node_modules`,判据住被 spawn 的脚本、本器零复制);判据/自检/镜像例数与退役口径逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

<!-- 原 L439 · R4 登记补记 -->
- **R4 漏点名补记 ⑤(2026-10-27)**:`check-gate-triggers.mjs`(253,blocking,射程 `scripts/`,跳过 `HUSKY_SKIP_GATE_TRIGGERS=1`)判「注册表登记门没声明 `stagedTriggers` 射程」——同一份缺省在提交通道读成「任何提交都跑」(§15d)、在落地通道被 `selectAffectedGates` 读成「永不复跑」,两通道反义 ⇒「落地后 N 臂全绿」可以是盲绿;差值棘轮锚点 = HEAD^(缺省判 HEAD 面不是索引),摘射程亦红,存量只报数;`land-gate-rerun.mjs` 同批补 `countUntriggered`。判据全文与 2026-10-27 实证(门 193 缺射程,一笔落地往 `check-ps1-bom.mjs` 写进两处裸派生 git、落地器仍报 19 臂全绿)逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

<!-- 原 L440 · R4 登记补记 -->
- **R4 漏点名补记 ⑥(2026-10-27)**:`check-ruff-python.mjs`(254,blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`):Python lint 由「只挂 CI」接进提交链(旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累);判定面照门 35 同口径(HEAD/索引/磁盘 ⇒ 先经 `face-reader` 取材 + `scratch-dir` 物化),pin 唯一源 `apps/ai-service/pyproject.toml`;uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红;自检与镜像例数、接线锁逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。

<!-- 原 L442 · R4 登记补记 -->
- **R4 漏点名补记 ⑧(2026-10-28)**:`check-asset-path-health.mjs`(只读巡检,判机器状态故不进提交链 §12e;派发面 = `scripts/git-guardian.mjs` 的 `auditAssetPathHealth` 每 6h;`--json`/`--self-test`;断链或证书错 exit 1,取不到输入 exit 2 未判定):受管 `.env` 引用的绝对路径可达性 + 证书到期,判据委托 `cert-expiry-check.mjs` 单源。

<!-- 原 L443 · R4 登记补记 -->
- **R4 漏点名补记 ⑨**:`check-live-doc-merge-recall.mjs`(只读、不进提交链 §12e;接 `.husky/post-merge`):普通 merge 带回已结清行的探测,判据 import `liveDocExpectedCounts` 零复算;自检 4/4、镜像 6/6;无跳过变量。 + `check-ddos-guard-wiring.mjs`(257)

<!-- 原 L444 · R4 登记补记 -->
- **R4 漏点名补记 ⑩(2026-10-29)**:`check-aasa-public-health.mjs`(只读哨兵:判 AASA 两腿公网可达且与单源同构;判机器状态 ⇒ 不进提交链 §12e;调度 = `git-guardian` 的 `auditAasaPublicHealth` 每 6h;入口 `pnpm check:aasa-health`;`--self-test` 28 例 / 镜像 31 例;未认识的旗标一律用法错 exit 2)。

<!-- 原 L445 · R4 登记补记 -->
- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:五枚**只读尺子/自检器**,均不进提交链(§12e,判机器状态或产出台账),接线面 = `scripts/git-guardian.mjs` 巡检轮派发 + 根 `package.json` 的 `check:*` 脚本 —— `check-gate-rot.mjs`(判据腐烂自检,只吃注册表与 `scripts/lib/judgement-libs.json` 两清单)· `check-plan-truncated-rows.mjs` · `check-web-rn-screen-parity.mjs` · `check-miniapp-mirror-fidelity.mjs`(CI 问责腿 = ci-monorepo build 矩阵 miniapp-taro 档 `--base`,不走 `--base` 即假接线)· `check-analytics-page-coverage.mjs`(连不到库 ⇒ exit 2 未判定;零访问 ≠ 未埋点);逐枚判据/基线件/`--self-test` 档逐字底稿 = `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`。**退役口径**:任一枚退役须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 变成跑不通的出路(§8)。

<!-- 原 L446 · 门登记补记 -->
- **补记 2026-10-26(守门 89 R4)**:`check-rn-compat-coverage.mjs`(251,blocking,stagedTriggers=rn-compat/config/packages.app/apps.mobile-rn) —— 小程序复用「共享屏源 + 平台 adapter」的覆盖面对账:C1 消费面从 `react-native` 具名取用 ⊆ `apps/miniapp-taro/src/rn-compat` 出口(类型位也算,缺了 tsc 红而 babel 绿)、C2 lucide 名 ⊆ `icons-generated.tsx`、C3 `route-map.generated.ts` 目标页必须真在 app.config 在册;生成腿单源 `node scripts/gen-rn-compat.mjs --write`(名字全集按 HEAD 面现算,写后紧随注入水印),绝对零容忍(补上即绿,无存量可宽),自检 6 例含「摘掉即翻红」。

<!-- 原 L447 · 门登记补记 -->
- **补记 2026-10-26(守门 89 R4,第三枚)**:`check-mjs-export-resolution.mjs`(253,blocking,stagedTriggers=scripts/) —— `scripts/` 的相对具名导入必须真存在于目标模块的出口面。立因是实测的一起**安静停机**:`9fdbc207ba2e` 把 `lib/gitdir.mjs` 的 `brokenRefsFromSnapshot` 当残留删掉而消费方 `git-guardian.mjs` 一字未动 ⇒ ESM 实例化期抛,守护任何档都起不来,而所有巡检腿的唯一调度器就是它。三维缺一不可(D3@2026-10-26:调 lib 导出却无 import ⇒ 门一跑 ReferenceError):D1 判本枚改动的消费方,D2 判本枚改动/删除的生产方(削出口而射程内仍有人按名取用)——病灶在生产方,只有 D1 的门结构上打不到。三维都窄在本枚改动集 ⇒ 不因存量恒红(§12e);整面命中只报数(现读存量 8 条全是那笔批量回退的残迹,归属待人工裁,本门不代裁也不白名单化)。自检 15 例含 D2 正控/反向对照/新建面不判;解析不了落 exit 2 不折成绿。

<!-- 原 L450 · 同族副本(留 L436) -->
- 端侧(RN / 共享源)同一约束,按宿主分五档:**等分格**行加 `flexWrap: 'wrap'` + 格加 `minWidth`(两条缺一不可,只给 minWidth 是溢出压邻格、只给 flexWrap 时 `flexBasis` 是 0 永不触发);**`space-between` 行 / `absolute` 容器**内的读数加 `flexShrink: 0`(否则行宽不够时先压读数、标签反而完整);**定宽格(`width:NN%` / `flexBasis`)**只能靠 `minWidth`(`flexShrink` 是纵向主轴属性,对横向定宽无效)。守门 `check-rn-readout-cell.mjs`(241,blocking,AST 判 JSX 父子关系,存量 69 处已归零),写法见 `docs/UI_GUIDELINES.md` §13.4。

<!-- 原 L459 · 同族副本(留 L191) -->
- 红线:单目标 ≤20 轮;高危操作必须暂停等人工;严禁扩展需求;每轮完整承接上下文;连续 5 轮工具失败 ⇒ blocked。blocked/budget_limited 下**禁止** `git reset --hard`/`checkout .`/`clean -f`;必须在 PROJECT_PLAN 记录现场,回滚决策权归用户。

<!-- 原 L460 · 同族副本(留 L223) -->
- 落点 = 根直属 `.worktrees/`;收尾五步:①合并/裁决 → ②提交并推送 → ③回收检出 → ④删已并入分支 → ⑤`git worktree prune`。未合并的检出**不得静默删**:先打 `lost-commit/worktree-<名>-<sha7>` 标签保活,合并决策权归人。
