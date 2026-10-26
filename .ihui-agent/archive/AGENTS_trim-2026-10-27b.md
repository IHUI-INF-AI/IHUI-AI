<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 重复登记副本与历史指针归档(候选批 2026-10-27,由 mp-agents2 出样)

> 基线面 = `git show d01913072d:AGENTS.md`(101,848 B,411 行)。下列 14 行自该面**逐字节原样**移入本件;行号为基线行号。规则条款一条未减:每块标注的“现行唯一面”仍留在 AGENTS.md。

## B01 · 基线 L374(2305 bytes)

R4 漏点名补记②·漂移副本(中版);现行唯一面 = L406

```text
- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0") `check-analytics-page-coverage.mjs`(`check:analytics-coverage`;埋点覆盖面只读尺:分母=仓内声明页面清单 —— web 路由文件 / 小程序 app.config 主包+分包 / RN 屏名 / 插件侧栏路由,分子=visit_logs 去重 url,按端报 zeroVisit 与清单外;判据层 `scripts/lib/analytics-coverage.mjs`,镜像 `scripts/tests/analytics-coverage.test.mjs`;连不到库 ⇒ exit 2 未判定,绝不把"没判"读成"零缺口";**零访问 ≠ 未埋点**(四端都是单点挂载),它回答的是"声明面与观测面谁更宽")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。
```

## B02 · 基线 L405(1759 bytes)

R4 漏点名补记②·漂移副本(最短版);现行唯一面 = L406

```text
- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。
```

## B03 · 基线 L391(159 bytes)

git 网络与推送·裸指针行;现行唯一面 = L390 + L407

```text
- **git 网络与推送**:规则唯一面 = 速查区「git 网络与推送」那条(2026-10-24 收敛:本文原有三份副本,只留最新最全的一份)。
```

## B04 · 基线 L410(961 bytes)

git 网络与推送·2026-10-26 两条实测补(短版);现行唯一面 = L407 + L390

```text
- **git 网络与推送**:规则唯一面 = 速查区「git 网络与推送」那条(2026-10-24 收敛:本文原有三份副本,只留最新最全的一份)。**2026-10-26 两条实测补**:① 出网代理腿死(本机 `http.proxy` 端口在听但 20/20 `Recv failure`,摘掉直连可通)⇒ `scripts/lib/face-reader.mjs` 的 `egressFallbackPlan` 只给**网络动词**在传输形态失败时摘代理**多跑一次**,两腿都不通就回吐第一手错误并留痕 `.ihui-agent/state/git-egress-degradation.log`;服务器裁决/竞态/钩子失败各有专档,绝不换腿重试(接线锁 `scripts/tests/git-egress-fallback.test.mjs`)。② `safe-commit` 在本进程取不到 `user.email` 时按唯一出口 `scripts/lib/bypass-git.mjs` 的 `REPO_GIT_IDENTITY_ARGS` 补署名(问不到当作"有身份",绝不伪造作者),且裸 exit 128 不再被当成索引锁争用重跑整条守门链(接线锁 `scripts/tests/safe-commit-failure-triage.test.mjs`)。
```

## B05 · 基线 L380(1896 bytes)

完成即删要有器物·速查区合并重述版;现行唯一面 = §1 L40 + L42(+L41/L43)

```text
- **完成即删要有器物(2026-10-20 立,10-21 补 H4,10-23 补齐留痕与节拍)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 派发层 `sweepStaleClosedRows`(`intervalMs` 现读 5 分钟)派发,单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。③ **摘了必须留痕**,否则两条回潮防线同时瞎、存量永远归不了零:落地后逐条往 `.ihui-agent/state/plan-row-drop.jsonl` 写 `rowBefore`(at/seat/file/kind/commit/baseline);**凭据是"HEAD 有没有被推进",不是落地器退出码**;留痕必须排在落地成功之后(先写后落会把"面上还在"说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行)。④ **union 认台账**:`union-converge` 的 `liveDocExpectedCounts` 增 `declaredDropCaps(oursText)` 维(判据 import `scrub-declared-removals` 的 `declaredRows`)——台账命中 ∧ 本侧 0 份 ∧ 是登记行 ⇒ `want.delete`;本侧还留着就绝不扣;台账取不到 ⇒ 一条不扣;产出面 `unionLines` 与自证面 `verifyUnion` 共用这一张表,与 `yieldedIdCaps`(让号形态)合起来才堵满「本侧处置权已行使」。接线锁 `scripts/tests/closed-row-drop-ledger.test.mjs`。
```

## B06 · 基线 L381(818 bytes)

水印三档现行口径·速查区压缩重述版;现行唯一面 = §5c L126 + L127

```text
- 上一条的现行口径(三档,原文留档于归档):①**面**——这两处按 §0.4 同面同轮:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;清单与内容不同形 ⇒ "HEAD 缺载荷、盘上副本已补好但没提交"这一型两面各自都"没问题",悬留替红顶绿。②**退出码**——三档:判出缺口 ⇒ 1,**取不到被审面 ⇒ 2 并显式写「未判定」(不记绿也不冒红)**,判通过 ⇒ 0。③**自愈档**——`git add` 只准发生在 `--staged`(紧接着就 commit);全量档/`--push-gate` 档 inject 后**只写工作区、不动索引**(工作区可回滚而索引不可)。取证:`scripts/tests/check-watermark-coverage.test.mjs` W9(三面分叉正控)/W10(三面一致⇒三档全 0,防恒红)/W11(取不到⇒rc 2)。
```

## B07 · 基线 L375(141 bytes)

PLACEHOLDER_SKIP;现行唯一面 = 

```text
> 重复登记副本已归档：见 `.ihui-agent/archive/AGENTS_trim-2026-10-21b.md`「常驻工具清单（重复登记副本之一）」。
```

## B08 · 基线 L394(309 bytes)

2026-10-24 批第 3 刀指针注记;现行唯一面 = L367–L372(速查区本体)

```text
<!-- 「速查区重复登记副本」第 3 批(23 行:L405–L425 整段同题副本 + L429 横向口径 + L433 UI 索引)已逐字移入 `.ihui-agent/archive/AGENTS_trim-2026-10-24.md`;规则本体见 §1/§4/§5c/§5e/§5f/§12/§15/§22 各条与本节 L375–L390,本批未删任何唯一来源行。 -->
```

## B09 · 基线 L399(184 bytes)

2026-10-25 批“计划/台账”副本指针注记;现行唯一面 = L396

```text
<!-- 「计划/台账」旧副本(缺门 239 行)已逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md;现行唯一面 = 文末含 check-plan-archive-monotonic 的同名行。 -->
```

## B10 · 基线 L400(174 bytes)

2026-10-25 批“API/后端/DB”副本指针注记;现行唯一面 = L396

```text
<!-- 「API/后端/DB」旧副本(缺 check-public-admin-default G-875 行)已逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md;现行唯一面 = 文末同名行。 -->
```

## B11 · 基线 L404(201 bytes)

旧 §24“须用户确认”作废指针注记;现行唯一面 = L384 + L385

```text
<!-- 旧 §24「须用户确认」流程已由 2026-10-23 机主令作废,旧文逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-25.md;现行口径 = 下方「24. 新增功能决策口径」。 -->
```

## B12 · 基线 L408(152 bytes)

2026-10-26 批副本 A 指针注记;现行唯一面 = L406

```text
<!-- R4 漏点名补记②漂移副本A(无 CI 问责腿)已并入上方保留版,逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-26.md 副本A -->
```

## B13 · 基线 L409(172 bytes)

2026-10-26 批副本 B 指针注记;现行唯一面 = L406

```text
<!-- R4 漏点名补记②漂移副本B(再少 check-analytics-page-coverage)已并入上方保留版,逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-26.md 副本B -->
```

## B14 · 基线 L393(357 bytes)

“两次压缩版”历史叙述行;现行唯一面 = L3(文首同题行)

```text
> 本文件为 2026-10-14 / 2026-10-21 两次压缩版(历史原文取法:二次压缩前 `git show 6efeeadc20c^:AGENTS.md`;首次全量归档 `git show 3017301fd0b:.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`,1,262,819 B)。本文与历史原文冲突时以本文为准;历次移出说明见 `.ihui-agent/archive/AGENTS_trim-2026-10-24.md`。
```

## 字节配平(现读)

- 迁出 14 行合计(含行尾换行)= 9460 bytes
- 基线 101848 − 9460 = 92388 bytes(门 207 预算 96,000;本批目标 ≤94,000)
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
