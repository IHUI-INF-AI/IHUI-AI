<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md 重复登记副本清偿批(2026-10-26)

> **性质:逐字迁出件,不是重写稿。** 每条正文与搬移前的 `AGENTS.md` 逐字节相同,未做任何"顺手修正"。
> 迁出理由:守门 207 体积门现读 HEAD 面 100,886 B > 预算 96,000 B —— 本侧合并前 `100038acb42` 面 99,501 B 已超 3,501,合并行级 union 又放大 1,385。
> 族内一律保留正文现行版,被删副本逐字留本件;出处 = 合并提交 a1ca72e6c3b 后的收尾批。
> 守门 89 R4 守恒已核:被删副本点名的门名全部在保留版或全文别处仍在(逐条比对脚本证据)。
> 本批未走 `watermark.mjs clean/inject`:被删行不含载荷,精确删行不触碰零宽链(实测 clean→inject 往返会吞掉 L3 独立不可见行,已回滚并改用本道)。

## 原 L40(976 B)—— §1 族副本:10-23 补齐留痕与节拍那版是现行版

```text
- **完成即删要有器物(2026-10-20 立,2026-10-21 补 H4)**:① 门 229(`check-plan-closed-stock.mjs`,blocking,stagedTriggers=PROJECT_PLAN.md):S1 拦「跨枚滞留」= 被审面某已勾登记行的**复合主键在父提交面也是已勾** ⇒ 红;刚翻勾那一枚不拦(守门 71 头注 (c) 要的 closed 配平凭据);S2 全量档只报数。② 兜底清扫器 `strip-stale-closed-rows.mjs`(判据 import 门 229)走 `object-space-land` 摘滞留行并自带推送腿;H1 未勾行逐字节同序 / H2 行数差==清扫数 / H3 摘后滞留集==本轮跳过集(基线 HEAD^)/ H4 摘前先借门 71 的 historyMarkers+missingFrom 问"摘了会不会被按未勾还原",仍保护的一律跳过并点名;结论 `SWEEP-RESULT state=clean|stripped|all-held|refused|undetermined`,all-held 落 exit 3;`--apply` 由 guardian 每 **5 分钟**派发(2026-10-23 由 30 分钟下调,理由见下条),单批 ≤400 条;应急 `HUSKY_SKIP_PLAN_CLOSED_STOCK=1` + `..._REASON`。
```

## 原 L299(54 B)—— §24 旧口径整节(标题+正文):2026-10-23 机主令已作废,现行版在「新增功能决策口径」

```text
## 24. 新增功能须用户确认强制规则(强制)
```

## 原 L300(0 B)—— §24 旧节内空行

```text

```

## 原 L301(452 B)—— 同上节正文

```text
触发 = 引入 PROJECT_PLAN 清单之外的新能力。强制动作:暂停 → `AskUserQuestion` 确认(目标/范围/是否入 PLAN 及优先级)→ 显式同意后才开发 → 补登记 PLAN → `feat:` 前缀。红线:禁止未确认直接开发、禁止伪装成修复绕过、禁止"写完了你看下要不要"代替事前确认。豁免:用户本轮明确要求、goal 目标内含、纯修复/重构/测试/文档、PLAN 已有条目细化。
```

## 原 L302(0 B)—— §24 旧节内空行

```text

```

## 原 L374(2305 B)—— R4 补记 ② 三份漂开副本中较早的两份(保留含 CI 问责腿+analytics 的最全版)

```text
- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0") `check-analytics-page-coverage.mjs`(`check:analytics-coverage`;埋点覆盖面只读尺:分母=仓内声明页面清单 —— web 路由文件 / 小程序 app.config 主包+分包 / RN 屏名 / 插件侧栏路由,分子=visit_logs 去重 url,按端报 zeroVisit 与清单外;判据层 `scripts/lib/analytics-coverage.mjs`,镜像 `scripts/tests/analytics-coverage.test.mjs`;连不到库 ⇒ exit 2 未判定,绝不把"没判"读成"零缺口";**零访问 ≠ 未埋点**(四端都是单点挂载),它回答的是"声明面与观测面谁更宽")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。
```

## 原 L393(357 B)—— 压缩版说明第二份:顶部那条是现行版

```text
> 本文件为 2026-10-14 / 2026-10-21 两次压缩版(历史原文取法:二次压缩前 `git show 6efeeadc20c^:AGENTS.md`;首次全量归档 `git show 3017301fd0b:.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`,1,262,819 B)。本文与历史原文冲突时以本文为准;历次移出说明见 `.ihui-agent/archive/AGENTS_trim-2026-10-24.md`。
```

## 原 L405(1759 B)—— R4 补记 ② 三份漂开副本中较早的两份(保留含 CI 问责腿+analytics 的最全版)

```text
- **R4 漏点名补记 ②(2026-10-26,守门 89 R4 清偿)**:下面四枚是**只读尺子/自检器**,接线面分别是 `scripts/git-guardian.mjs` 巡检轮派发与根 `package.json` 的 npm script,**均不进提交链**(§12e,判机器状态或产出台账)——`check-gate-rot.mjs`(守门判据腐烂自检:只吃注册表 `script:` 与 `scripts/lib/judgement-libs.json` 两处权威清单,判"清单点名而盘上不存在",三态 clean/rot/undetermined,未判定不冒绿;`--ratchet` 只喊相对基线**新增**,`--suggest` 给修法,`--self-test` 取证;派发点 = git-guardian 巡检轮) `check-plan-truncated-rows.mjs`(`check:plan-truncated-rows`;台账残行只读尺 + 基线棘轮:R1 空正文 / R2 截断收尾两型互斥,识别逻辑单源 import `check-plan-fragment-rows.mjs` 不写第二份正则,基线 `scripts/check-plan-truncated-rows-baseline.json`,只有身份不在基线的命中判红;`--self-test`) `check-web-rn-screen-parity.mjs`(`check:web-rn-parity`;web→RN 功能覆盖账本,判定权在登记表 `scripts/data/web-rn-screen-map.jsonl`,未登记的 web 路由 = unmapped 缺口候选,登记腐烂(指向不存在的文件/键不在路由集/豁免缺 reason)逐条点名;只读报表 exit 0、取不到面 exit 2) `check-miniapp-mirror-fidelity.mjs`(`check:mirror-fidelity`;小程序镜像页还原度对账:共享屏业务 i18n 键集为分母、镜像页实消费键集为分子,差集 = 声明了却没还原的文案键,`t()` 直调与 `PAIR_KEYS`/`SINGLE_KEYS` 两通道并集防"刚生成即恒 0")。**退役口径**:任一枚退役时须连同本行点名与 `package.json`/`git-guardian` 的同名调用点一并摘除,否则 `pnpm check:*` 会变成跑不通的出路(§8 文档不得写跑不通的出路)。
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
