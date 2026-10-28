<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md trim 2026-10-28 — 守门 207 体积清偿批(逐字留痕,删副本不删证据)

> 摘除前 105,115 字节(HEAD 面实测)→ 本批摘除 17 个整块 + 1 段行内重复 + 1 处正文合并。
> 族内一律保留信息更全的现行版:`AGENTS.md` 里 §0–§29 规则条款一条未减,被移走的只有
> 历史叙述、失效原文残留(旧 §24、裸 filter 片段)、重复登记副本(R4②③④⑤⑥⑦ 短版族、
> §1 五条长文的短版副本、批注指针注释的同文副本)与超长守门登记(R4② 五枚只读尺子详版)。
> 本件由脚本从 AGENTS.md 当轮工作树**逐字切片**得到,非人工转写;每块在位判据 = 对 AGENTS.md
> 原行的 grep -F 整行命中(见批末自证记录)。禁止对本件与 AGENTS.md 跑 `watermark.mjs inject/clean`。

## 旧 §24「新增功能须用户确认强制规则」整节(原 AGENTS.md 行 301-303;已作废,现行版 = 本文 §24「新增功能决策口径(2026-10-23 机主强制令修订)」)

## 24. 新增功能须用户确认强制规则(强制)

触发 = 引入 PROJECT_PLAN 清单之外的新能力。强制动作:暂停 → `AskUserQuestion` 确认(目标/范围/是否入 PLAN 及优先级)→ 显式同意后才开发 → 补登记 PLAN → `feat:` 前缀。红线:禁止未确认直接开发、禁止伪装成修复绕过、禁止"写完了你看下要不要"代替事前确认。豁免:用户本轮明确要求、goal 目标内含、纯修复/重构/测试/文档、PLAN 已有条目细化。

## 文末裸 filter 废弃说明片段(原行 384-387;其结论已折入 §6 验证命令代码块,该片段游离在代码块外、以 # 开头被 Markdown 误渲染成一级标题)

# ↑ 上两行裸 filter 形态已废弃(2026-10-24 定档):绕过 turbo 依赖图,types dist 陈旧时报假红(实测 17 错全为旧 dist 连锁,重建后归零);
#   单端验证必须用下两行 turbo 形态(任务依赖 "^build" 会先重建 @ihui/types 等上游 dist):
pnpm turbo typecheck --filter=@ihui/api       # 单独验证后端(正解)
pnpm turbo typecheck --filter=@ihui/web       # 单独验证前端(正解)

## R4 漏点名补记② 详版整行(原行 396,2612 字节;原位置只留点名指针行,五枚只读尺子的接线与判据全文以此行为唯一逐字底稿)

- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0";**CI 问责腿(2026-10-26 补)**= ci-monorepo build 矩阵 miniapp-taro 档 `mirror-fidelity` 步直跑 `--base=<基线>`(PR 判 base.sha、push 判 HEAD^1;只拦倒退、存量只报数,同 artifact-budget 的"只在 CI 问责"先例——三档面在干净检出上全部退化,不走 --base 即假接线) `check-analytics-page-coverage.mjs`(`check:analytics-coverage`;埋点覆盖面只读尺:分母=仓内声明页面清单 —— web 路由文件 / 小程序 app.config 主包+分包 / RN 屏名 / 插件侧栏路由,分子=visit_logs 去重 url,按端报 zeroVisit 与清单外;判据层 `scripts/lib/analytics-coverage.mjs`,镜像 `scripts/tests/analytics-coverage.test.mjs`;连不到库 ⇒ exit 2 未判定,绝不把"没判"读成"零缺口";**零访问 ≠ 未埋点**(四端都是单点挂载),它回答的是"声明面与观测面谁更宽")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。

## git 网络与推送·2026-10-26 两条实测补(原行 397 改写前整形;改写版留在本文,只剥掉「规则唯一面=速查区那条」这句与 §16 重复的自述)

- **git 网络与推送**:规则唯一面 = 速查区「git 网络与推送」那条(2026-10-24 收敛:本文原有三份副本,只留最新最全的一份)。**2026-10-26 两条实测补**:① 出网代理腿死(本机 `http.proxy` 端口在听但 20/20 `Recv failure`,摘掉直连可通)⇒ `scripts/lib/face-reader.mjs` 的 `egressFallbackPlan` 只给**网络动词**在网络形态(128+传输回显∨挂死零回显)失败时**换腿重跑一次**(代理↔直连双向,方向由 `plan.useDirectArgs` 单点给),两腿都不通就回吐第一手错误并留痕 `.ihui-agent/state/git-egress-degradation.log`;服务器裁决/竞态/钩子失败各有专档,绝不换腿重试(接线锁 `scripts/tests/git-egress-fallback.test.mjs`)。② `safe-commit` 在本进程取不到 `user.email` 时按唯一出口 `scripts/lib/bypass-git.mjs` 的 `REPO_GIT_IDENTITY_ARGS` 补署名(问不到当作"有身份",绝不伪造作者),且裸 exit 128 不再被当成索引锁争用重跑整条守门链(接线锁 `scripts/tests/safe-commit-failure-triage.test.mjs`)。

## R4⑦ 行内内嵌的 check-ruff-python 整段(原行 401 尾段;与「R4 漏点名补记 ⑥」整行逐字重复,只删内嵌这一份)

`check-ruff-python.mjs`(254,blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`):把 Python lint 从「只挂 CI」接进提交链 —— 旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累(2026-10-27 净面实测 4 条真红,引入者均为收编提交)。判定面照门 35 同口径(HEAD/索引/磁盘),外部工具只看得见磁盘 ⇒ 先经 `face-reader` 取材 + `scratch-dir` 物化;pin 唯一源 `apps/ai-service/pyproject.toml`(解析不硬编码);uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红。自检 11 例、镜像 `scripts/tests/check-ruff-python.test.mjs` 11 例、接线锁 `check-ruff-gate-wiring.test.mjs`(装车证明读 HEAD + 反向对照逐维翻假)。

## 原行 404(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口):自动档已停产指针注记;守门 13d 差值棘轮拦注记变多、全量档绝对零容忍;门 71 归档豁免射程已纳入清偿台账——旁路落地不跑钩子,防它必须在判据源头接。**回潮实测到三条通道(推送/判据输入集/活文档行级 union),逐条都有器物钉死**(git-push-guard.mjs/两侧同基准归一化/lib/post-merge-ledger-sync.mjs 第二步);实证与逐字原文在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 405(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **完成即删要有器物(2026-10-20 立,10-21 补 H4,10-23 补齐留痕与节拍)**:现行版整条(门 229 check-plan-closed-stock + 清扫器 strip-stale-closed-rows + 摘除留痕 plan-row-drop.jsonl + union 认台账 declaredDropCaps)住在下方「守门脚本速查」区同名单行,此处不重复;原文逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 406(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **护栏③ 收窄(2026-10-23 立,治"让路变永久停摆")**:strip-stale-claim-marks 原护栏「工作树对台账非净⇒整批让路」在本仓=天天让路;收窄后只在本批旧形态行被别席就地改写时让路、且只让路那几枚(让路行走 planSweep 的 skipLines,不新写第二份判据),工作树读不到⇒仍让路(未判定不猜);判据面是 HEAD 面,脏的是别人的副本。接线锁 scripts/tests/strip-stale-claim-marks.test.mjs;实证逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 407(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **「摘了又回来」已根治(2026-10-23 立)**:清扫器摘除必须留痕(.ihui-agent/state/plan-row-drop.jsonl),**凭据是"HEAD 有没有被推进",不是落地器退出码**,留痕必须排在落地成功之后;union-converge 的 liveDocExpectedCounts 增 declaredDropCaps 维(判据 import scrub-declared-removals 的 declaredRows,§0.6 单源):台账命中∧本侧0份∧登记行⇒want.delete,本侧还留着绝不扣,台账取不到一条不扣;guardian 派发节流 5 分钟。接线锁 scripts/tests/closed-row-drop-ledger.test.mjs;实证逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 408(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **结清行的复洁器物(2026-10-22 立)**:收编器 auto-commit-quiet.mjs 归并达标后调 scripts/scrub-declared-removals.mjs(不进提交链)按摘除台账逐行剔除;三条件缺一不动:整行逐字在台账 ∧ 当下 HEAD 面已无此行 ∧ 登记行形;任一不成立或取不到输入⇒exit 2 未判定不剔。镜像 scripts/tests/scrub-declared-removals.test.mjs;实证逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 409(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;与同族另一行逐字相同)

<!-- R4 漏点名补记② 又一轮回潮的重复副本已并入上方保留版(含 CI 问责腿的最全份),逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md -->

## 原行 410(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **R4 漏点名补记 ③**:check-e2e-coverage-gap.mjs(250,warn,差值棘轮只拦新增;射程清单 scripts/data/e2e-coverage-gap-scope.json,判据层 scripts/lib/e2e-coverage-gap.mjs,补测骨架 scripts/e2e-autofill.mjs,跳过 HUSKY_SKIP_E2E_COVERAGE_GAP;升 blocking 前置=存量缺口归零);细节逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 411(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

<!-- 水印三面/退出码/自愈档三档重复副本已并入 §5c 更正块,逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md -->

## 原行 412(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;与同族另一行逐字相同)

<!-- git 网络与推送 重复 stub/旧措辞副本已并入上方保留版(唯一面=规则条+128+传输回显实测补),逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md -->

## 原行 413(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;与同族另一行逐字相同)

<!-- R4 漏点名补记② 又一轮回潮的重复副本已并入上方保留版(含 CI 问责腿的最全份),逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md -->

## 原行 414(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **R4 漏点名补记 ②**(只读尺子五枚,均不进提交链,派发面=git-guardian 巡检轮/根 package.json):check-gate-rot.mjs(判据腐烂自检,只吃注册表与 scripts/lib/judgement-libs.json 两权威清单) check-plan-truncated-rows.mjs(台账残行尺,基线棘轮,识别单源 import check-plan-fragment-rows.mjs,基线 scripts/check-plan-truncated-rows-baseline.json) check-web-rn-screen-parity.mjs(web→RN 覆盖账本,登记表 scripts/data/web-rn-screen-map.jsonl) check-miniapp-mirror-fidelity.mjs(镜像页还原度;CI 问责腿=build 矩阵 miniapp-taro 档 --base) check-analytics-page-coverage.mjs(埋点覆盖尺,判据层 scripts/lib/analytics-coverage.mjs,镜像 scripts/tests/analytics-coverage.test.mjs;连不到库⇒exit 2 未判定;零访问≠未埋点);退役口径=连同本点名与 package.json/git-guardian 调用点一并摘;判据细节与实证逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 415(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;与同族另一行逐字相同)

<!-- git 网络与推送 重复 stub/旧措辞副本已并入上方保留版(唯一面=规则条+128+传输回显实测补),逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md -->

## 原行 416(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **R4 漏点名补记 ④**(两枚只读、不进提交链):scripts/dispatch-board.mjs(check:dispatch-board;派单单入口+切席+空转归因;磁盘容量是第 0 步前置判据) scripts/check-lint-staged-stdio-pin.mjs(check:lint-staged-pin;盯 patch-lint-staged-stdio.mjs 三针);细节逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 417(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **R4 漏点名补记 ⑤**:check-gate-triggers.mjs(253,blocking,射程 scripts/,跳过 HUSKY_SKIP_GATE_TRIGGERS):判「注册门没声明 stagedTriggers 射程」——缺省在提交/落地两通道反义,「落地后 N 臂全绿」可以是盲绿(实证=门193 缺射程让 check-ps1-bom.mjs 盲绿那型;同批 land-gate-rerun.mjs 补 countUntriggered);差值棘轮锚点=HEAD^,缺省判 HEAD 面不是索引;细节与 2026-10-27 实证逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 418(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **R4 漏点名补记 ⑥**:check-ruff-python.mjs(254,blocking,射程 apps/ai-service/,跳过 HUSKY_SKIP_RUFF):Python lint 接进提交链(旁路落地/收编不跑钩子);判定面照门 35 同口径,pin 唯一源=apps/ai-service/pyproject.toml,uvx 缺失/pin 坏⇒exit 2 未判定且优先于红;细节逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## 原行 419(重复登记副本短版/批注指针注释,族内更全的现行版仍在本文;自述指向 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md)

- **R4 漏点名补记 ⑦**:check-cross-end-spec-coverage.mjs(256,blocking,args=--ratchet,射程=packages/shared/src/ui/ + packages/ui-react/src/components/ + packages/ui-native/src/ + apps/web/src/components/data/ + 本门与 scripts/data/cross-end-spec-baseline.json,跳过 HUSKY_SKIP_CROSS_END_SPEC_COVERAGE):跨端视觉原子 spec 覆盖率棘轮,退化才红涨不拦(11 项含 button,collapsible EXEMPT);细节逐字在 .ihui-agent/archive/AGENTS_trim-2026-10-27c.md。

## R4 漏点名补记④ 详版整行(原行 399,711 字节;超长守门登记,原位置压成指针行,两枚工具名与接线/npm 键名仍在指针行点名,全文以此行为唯一逐字底稿)

- **R4 漏点名补记 ④(2026-10-27,守门 89 R4 清偿)**:两枚**只读、不进提交链**(§12e)——`scripts/dispatch-board.mjs`(接线 = 根 `package.json` 的 `check:dispatch-board`;派单口径单入口 + `extractRefs` + `claimMarkOf`,做最大不相交子集切席与空转归因;exit 0/1/2;自检 24/24、镜像 17 例;磁盘容量是第 0 步前置判据)`scripts/check-lint-staged-stdio-pin.mjs`(只读盯针门,判 `patch-lint-staged-stdio.mjs` 三针是否还在 `node_modules`;判据住被 spawn 的脚本、本器零复制;exit 0/1/2;接线 = 根 `package.json` 的 `check:lint-staged-pin`,runner 注册现读 0 命中;自检 pass 11/fail 0、镜像 7 例;退役口径同 README 索引节)。

## R4 漏点名补记⑤ 详版整行(原行 400,1217 字节;超长守门登记,原位置压成指针行,门 253 名/档位/射程/跳过变量仍在指针行点名,判据全文与 2026-10-27 门 193 实证以此行为底稿)

- **R4 漏点名补记 ⑤(2026-10-27,守门 89 R4 清偿)**:`check-gate-triggers.mjs`(253,blocking,射程 `scripts/`,跳过 `HUSKY_SKIP_GATE_TRIGGERS=1`):判「注册表登记门没声明 `stagedTriggers` 射程」—— 同一份缺省在提交通道被读成「任何提交都跑」(§15d)、在落地通道被 `selectAffectedGates` 读成「永不复跑」,两通道反义 ⇒ 「落地后 N 臂全绿」可以是盲绿(2026-10-27 实证:门 193 缺射程,一笔落地往 `check-ps1-bom.mjs` 写进两处裸派生 git 后落地器报 19 臂全绿,唯一能咬住它的臂没跑)。差值棘轮锚点 = HEAD^:新增门缺射程 ⇒ 红;摘射程 ⇒ 红;存量只报数(--strict 全量;现读 152 道);info 档免判。**缺省判 HEAD 面不是索引**(索引常挂他人暂存面,判索引 ⇒ 全仓恒红;`--staged` 才判索引);JSON 档计数/清单分键(`counts.*` / `existingList`)。自检判据九例 + 端到端七例、镜像 `scripts/tests/check-gate-triggers.test.mjs` 4 例;同批 `land-gate-rerun.mjs` 补 `countUntriggered` 并把从未被打印的 notes 真打出来(旧绿行写「点名 N 条(见上)」全仓无一 print,§0.3 同族),绿行末尾自报「未声明射程未复跑 K 道」。

## R4 漏点名补记⑥ 详版整行(原行 403,781 字节;超长守门登记,原位置压成指针行,门 254 名/档位/射程/跳过变量仍在指针行点名,判定面与 pin 单源细节以此行为底稿)

- **R4 漏点名补记 ⑥(2026-10-27)**:`check-ruff-python.mjs`(254,blocking,射程 `apps/ai-service/`,跳过 `HUSKY_SKIP_RUFF=1`):把 Python lint 从「只挂 CI」接进提交链 —— 旁路落地与 `chore(auto)` 收编不跑钩子,欠账能在 HEAD 面静默积累(2026-10-27 净面实测 4 条真红,引入者均为收编提交)。判定面照门 35 同口径(HEAD/索引/磁盘),外部工具只看得见磁盘 ⇒ 先经 `face-reader` 取材 + `scratch-dir` 物化;pin 唯一源 `apps/ai-service/pyproject.toml`(解析不硬编码);uvx 缺失/pin 坏/面取不到 ⇒ exit 2 未判定且优先于红。自检 11 例、镜像 `scripts/tests/check-ruff-python.test.mjs` 11 例、接线锁 `check-ruff-gate-wiring.test.mjs`(装车证明读 HEAD + 反向对照逐维翻假)。

## §6 验证命令旧两行(HEAD 面行 164-165;裸 --filter 形态 2026-10-24 已定档废弃,原位置改为 turbo 形态两行)

pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
