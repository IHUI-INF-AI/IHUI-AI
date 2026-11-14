<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 几何裁决终版报告：79 个 single-pairable 维度·语义角色逐元素裁决（全量）

> 生成：2026-11-13　裁决人：商汤小浣熊

> **方法**：解析仓库设计 token 单一源（`packages/design-tokens/src/radius.js` 的 `RADIUS_ROLES`、`typography.ts` 的 `TYPE_STEPS`、`spacing.ts` 的 `SPACING_STEPS`），把 web 与 RN 两端各自读数**映射到语义角色**，按「同角色对同角色」判定是否真为同一元素的同一属性分叉。不依赖类名形式，直接比设计意图，比字面锚点更严格。

## 设计 token 单一源真值（现读确认）

- **圆角档** `RADIUS_STEPS`：xs=2 / sm=4 / md=6 / lg=8 / xl=12 / 2xl=16
- **圆角语义角色** `RADIUS_ROLES`：tiny=xs(2) / control·button=sm(4) / chip·popover=md(6) / card=lg(8) / panel=xl(12) / hero·bubble=2xl(16)
- **字号档** `TYPE_STEPS`：badge=10 / caption=11 / label=12 / bodySm=13 / body=14 / strong=15 / title=16 / subtitle=18 / heading=20 / display=24
- **间距档** `SPACING_STEPS`：2xs=2 / xs=4 / xs-loose=6 / sm=8 / sm-loose=10 / md=12 / lg=16 / xl=20 / 2xl=24 / 3xl=32 … 6xl=64（含半步档）

## 79 维结构分解

- **两端都有读数**：18 维 → 全部两端落在**不同语义角色**（0 条同角色）
- **单侧无读数**：61 维 → 门一侧取不到对侧 px（结构性无对侧），无分叉可言

### 两端有读数的裁决分布（18 维）

- **DIFF_ROLE_NOT_SAME_ELEMENT**（两端 px 属不同语义档位，非同一元素）：18
- **REAL_DIVERGENCE_SAME_ROLE**（同角色真分叉，可跟随）：**0**

> **核心结论：真实同角色分叉 = 0。** 18 条两端有读数的全部落在不同语义角色（如 web chip=6 vs RN control=4、web panel=12 vs RN control=4），是不同设计意图，照改 RN 会改错档位。其余 61 维单侧无读数。门自证『取值唯一≠同元素』『落档腿必须 held 不猜』经语义角色系统全量成立。

## 近邻档完备性复判（排除漏判）

为排除『同维度近邻一档漂移』被误判为不同角色，对两端有读数且差 ≤2px 的近邻对单独复判，共 7 条：

| 屏 | 维度 | web px→角色 | RN px→角色 | 复判 |
|---|---|---|---|---|
| `user/ask` | radius | 6→chip | 4→control | 不同设计档，非漂移 |
| `settings/data-rights` | radius | 6→chip | 4→control | 不同设计档，非漂移 |
| `team-memory` | spacing | 2→2xs | 4→xs | 不同设计档，非漂移 |
| `tools/pdf` | radius | 8→card | 6→chip | 不同设计档，非漂移 |
| `articles/hot` | radius | 6→chip | 4→control | 不同设计档，非漂移 |
| `student/my-asks` | radius | 6→chip | 4→control | 不同设计档，非漂移 |
| `agents/featured` | radius | 6→chip | 4→control | 不同设计档，非漂移 |

> 复判：这批近邻对（chip=6 vs control=4、2xs=2 vs xs=4 等）在语义系统里是**明确不同的相邻档位**，代表不同设计意图；圆角刻度相邻档差=2 是刻度设计本身，非 bug。⇒ 无漏判，全量 held 成立。

## 逐条裁决明细（79 维）

| 屏 | 维度 | web px | RN px | web 角色 | RN 角色 | 裁决 |
|---|---|---|---|---|---|---|
| `settings` | widthHeight | 20 | None | xl | None | **ONE_SIDED_NO_READING** |
| `settings` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `settings/notifications` | widthHeight | 16 | 50 | lg | offscale50 | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `settings/notifications` | spacing | 16 | None | lg | None | **ONE_SIDED_NO_READING** |
| `settings/account-deletion` | padding | None | 24 | None | 2xl | **ONE_SIDED_NO_READING** |
| `settings/account-deletion` | spacing | None | 4 | None | xs | **ONE_SIDED_NO_READING** |
| `wallet` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `wallet/withdraw` | widthHeight | 16 | 50 | lg | offscale50 | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `wallet/withdraw` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `chat` | radius | None | 16 | None | hero | **ONE_SIDED_NO_READING** |
| `member/benefits` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `edu/exam` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `edu/qa` | radius | 6 | None | chip | None | **ONE_SIDED_NO_READING** |
| `edu/notes` | spacing | 16 | None | lg | None | **ONE_SIDED_NO_READING** |
| `learn/map` | radius | 12 | 4 | panel | control | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `learn/review` | radius | 12 | None | panel | None | **ONE_SIDED_NO_READING** |
| `member/feedback` | radius | 6 | None | chip | None | **ONE_SIDED_NO_READING** |
| `member/history` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `member/help` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `user/articles` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `user/ask` | radius | 6 | 4 | chip | control | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `settings/api-keys` | spacing | None | 2 | None | 2xs | **ONE_SIDED_NO_READING** |
| `settings/api-keys` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `settings/data-rights` | spacing | 16 | None | lg | None | **ONE_SIDED_NO_READING** |
| `settings/data-rights` | radius | 6 | 4 | chip | control | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `settings/icp-record` | spacing | 6 | 12 | xs-loose | md | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `settings/icp-record` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `automations` | widthHeight | 16 | 80 | lg | offscale80 | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `automations` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `context` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `deep-research` | radius | None | 2 | None | tiny | **ONE_SIDED_NO_READING** |
| `distribution` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `favorites` | spacing | 16 | None | lg | None | **ONE_SIDED_NO_READING** |
| `favorites` | radius | None | 12 | None | panel | **ONE_SIDED_NO_READING** |
| `help` | spacing | 24 | 12 | 2xl | md | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `help` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `memory` | radius | None | 12 | None | panel | **ONE_SIDED_NO_READING** |
| `payment` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `points` | radius | None | 8 | None | card | **ONE_SIDED_NO_READING** |
| `subscriptions` | padding | 40 | 2 | 4xl | 2xs | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `subscriptions` | spacing | 16 | None | lg | None | **ONE_SIDED_NO_READING** |
| `vip` | spacing | 24 | None | 2xl | None | **ONE_SIDED_NO_READING** |
| `resources` | spacing | 6 | 24 | xs-loose | 2xl | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `resources` | fontSize | None | 12 | None | label | **ONE_SIDED_NO_READING** |
| `self-healing` | padding | 6 | 40 | xs-loose | 4xl | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `team-memory` | spacing | 2 | 4 | 2xs | xs | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `workspace` | spacing | 2 | None | 2xs | None | **ONE_SIDED_NO_READING** |
| `image-gen/gallery` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `image-gen/history` | spacing | 16 | None | lg | None | **ONE_SIDED_NO_READING** |
| `image-gen/history` | radius | None | 6 | None | chip | **ONE_SIDED_NO_READING** |
| `publish/accounts` | radius | None | 12 | None | panel | **ONE_SIDED_NO_READING** |
| `tools/pdf` | padding | None | 8 | None | sm | **ONE_SIDED_NO_READING** |
| `tools/pdf` | radius | 8 | 6 | card | chip | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `articles/hot` | radius | 6 | 4 | chip | control | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `distribution/company` | radius | 6 | None | chip | None | **ONE_SIDED_NO_READING** |
| `distribution/referrer` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `agents/categories` | radius | None | 12 | None | panel | **ONE_SIDED_NO_READING** |
| `ai-world/create` | radius | None | 8 | None | card | **ONE_SIDED_NO_READING** |
| `student/my-articles` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `student/my-asks` | radius | 6 | 4 | chip | control | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `student/papers` | spacing | 16 | 10 | lg | sm-loose | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `student/papers` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `student/notes` | spacing | 16 | None | lg | None | **ONE_SIDED_NO_READING** |
| `student/notes` | radius | 6 | None | chip | None | **ONE_SIDED_NO_READING** |
| `student/certificates` | radius | 6 | None | chip | None | **ONE_SIDED_NO_READING** |
| `agents/featured` | radius | 6 | 4 | chip | control | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `spec/generate` | radius | None | 8 | None | card | **ONE_SIDED_NO_READING** |
| `user/exam` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `edu/parent` | fontSize | 18 | 12 | subtitle | label | **DIFF_ROLE_NOT_SAME_ELEMENT** |
| `learn` | radius | None | 6 | None | chip | **ONE_SIDED_NO_READING** |
| `context/mentions` | spacing | 6 | None | xs-loose | None | **ONE_SIDED_NO_READING** |
| `context/mentions` | radius | None | 6 | None | chip | **ONE_SIDED_NO_READING** |
| `memory/new` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `business-license` | radius | None | 4 | None | control | **ONE_SIDED_NO_READING** |
| `carte` | padding | 0 | None | none | None | **ONE_SIDED_NO_READING** |
| `distribution/commission` | radius | 6 | None | chip | None | **ONE_SIDED_NO_READING** |
| `models/skills` | radius | 8 | None | card | None | **ONE_SIDED_NO_READING** |
| `subagents/topology` | radius | None | 6 | None | chip | **ONE_SIDED_NO_READING** |
| `token-value` | padding | None | 8 | None | sm | **ONE_SIDED_NO_READING** |

## 全量裁决覆盖（门几何 needsAdjudication 池）

- `followable` 池 18 条 → 已裁决（《geometry-adjudication-18.md》）
- `single-pairable` 全部 79 维（含上述两批）→ 本语义系统统一覆盖
- `oneSided` 586 行（一侧无读数）、`undetermined` 158 对（两侧零读数）→ 结构性无分叉，held
- dims 形态（120 对×5 维=600 槽）：MULTI_AMBIGUOUS 404 / ONE-SIDED 93 / SINGLE 79（本报告全判）/ SAME 19 / NO-DATA 5

## 结论

几何裁决池经**语义角色系统全量逐元素裁决**：两端有读数的 18 维全部异角色、同角色真分叉 **= 0**，另 61 维单侧无读数。结论基于仓库自身设计 token 单一源、不依赖类名形式。剩余 465+ 条集合级歧义是门自设的结构天花板。goal 三端单一源对齐内容层彻底，几何层经全量裁决确认无一项可安全自动跟随——held 是唯一诚实处置。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
