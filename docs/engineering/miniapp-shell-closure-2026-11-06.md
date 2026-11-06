<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 小程序共享屏薄壳化 · 收尾（2026-11-06）

基线：`origin/main = a1b1bf04ff`（`git rev-parse origin/main`）；落地尖 `chore/ledger-s2-retire = 6ac3ef1b5c`（尚未 ff 进 main）。本文件读数在 `chore/closure-final-20261106`（= `6ac3ef1b5c` + 本批收尾提交）树上实测。

口径：开标签 = `JsxElement + JsxSelfClosingElement`；节点 = 开标签 + 非空 `JsxText` + `JsxFragment`；LOC 按内容行计（尾换行不计）。299 的分类计数以其脚本自身输出为准，本文件只转述并标注判据面。

## 1. 终版状态表

| 指标 | main `a1b1bf04ff` 上 299 现读 | 落地尖实测（`6ac3ef1b5c` + 本批） | 证据 |
| --- | --- | --- | --- |
| 共享屏（真相源） | 275 | 275 | `check-miniapp-shell-form.mjs --worktree` 输出 `共享屏(真相源) : 275` |
| 小程序在册页 | 329（映射登记 251 条） | 329（251） | 同上：`小程序在册页 : 329(映射登记 251 条)` |
| 判为薄壳 | 246（已 import 入口） | 241（结构+入口双证） | 同上：`判为薄壳(已 import 入口) : 246` / `判为薄壳(结构+入口双证) : 241` |
| 判为复制页 | 47（纯复制 38 / 本地改动 9；LOC 18323/42175 = 43.5%） | 52（纯复制 43 / 本地改动 9；LOC 19870/42175 = 47.1%） | 同上：`判为复制页 : 47(...)` / `判为复制页 : 52(...)`；LOC 比即复制页行数 ÷ 在册页总行数 |
| 判为 not-applicable | 未单列 | 0 | 同上：`判为 not-applicable : 0` |
| 无法判定 | 0 | 0 | 同上：`无法判定 : 0` |
| 存量台账 | 56 行 | 56 行 | 同上：`存量台账 : 56 行`；物理行 93、已退休 37（`scripts/data/miniapp-shell-copy-ledger.jsonl` 逐行统计） |
| 301 承载 | 已还账 270；mp 缺承载 0；未判定 5；合法差异 23 | 共享屏 275 / 承载 247；已还账 270；mp 缺承载 0；未判定 5；合法差异 23；`判重-一槽多账冲突 0`、`判重-多路入口别名 3`、`mismatchIgnored=0`、`mismatchUnmatched=0`（`declared-object-mismatch` 数据行 0） | `check-web-mp-route-carriers.mjs` 摘要段 + `--json` 的 `readouts` |
| 291 对齐 | 台账 0；B1 认领差额 0；B3 认领差额 0；B2 advisory 1 处 | 同左 | `check-web-rn-copy-parity.mjs` 摘要段：`台账:0 条(退休 0 条…) / 到期 0 / B1 认领差额 0 / B3 认领差额 0` |
| 跨端覆盖（237） | — | 镜像 256/275；桶 V 19；登记 251 | `check-cross-end-screen-coverage.mjs` 摘要段 |

**“复制页 47→52”的性质：假薄壳退场，不是新增复制。** 新判据（结构+入口双证）把 5 张“已 import 共享屏入口、但页内业务 JSX 仍超薄壳线”的页从薄壳翻成复制页：

| 页 | 旧读数（薄壳） | 新读数（复制页，`622101d441` S2 输出） | 收尾批新提示 |
| --- | --- | --- | --- |
| `pkg-ai/developer/income` | 已收敛可摘 | 行数变化：台账 698 → 现读 488 | `…(台账 698 → 现读 488;仍为复制页,不得摘除)` |
| `pkg-user/message/index` | 已收敛可摘 | 行数变化：台账 569 → 现读 568 | `…(台账 569 → 现读 568;仍为复制页,不得摘除)` |
| `pages/distribution/team` | 已收敛可摘 | 行数变化：台账 339 → 现读 220 | `…(台账 339 → 现读 220;仍为复制页,不得摘除)` |
| `pages/setting/language` | 已收敛可摘 | 行数变化：台账 137 → 现读 122 | `…(台账 137 → 现读 122;仍为复制页,不得摘除)` |
| `pages/setting/theme` | 已收敛可摘 | 行数变化：台账 184 → 现读 149 | `…(台账 184 → 现读 149;仍为复制页,不得摘除)` |

其余 4 张仍是薄壳的台账条目（`pages/distribution/commission`、`pages/distribution/order-list/index`、`pkg-ai/ai/conversation-import`、`pkg-ai/dev-enter/model-edit/index`）保留“可从台账摘除”，但本批给提示补上了证据（业务 JSX 2/2/1/1 ≤ 2、零重复 UI 段、无单端 prop）。分类器层面的“可摘”不等于可退休，退休仍需人工三证（见 §5）。

守恒校验：旧 `246 + 47 = 293`，新 `241 + 52 = 293`，差额 5 全部来自上述五页；在册页总数不变。证据：两次 299 汇总行 + 新判据 S2 的 `[S2] 复制页行数变化` 五条。

## 2. 本轮真正做了什么

### 2.1 5 页薄壳化（改前→改后）

| 页 | 提交 | 改前 LOC / 节点 | 改后 LOC / 节点 | 薄壳结构 |
| --- | --- | --- | --- | --- |
| `apps/miniapp-taro/src/pkg-ai/aigc/list.tsx` | `9d45919c8d` | 464 / 51（E42+S7+F0+T2） | 325 / 2（E1+S1） | `ThemeRoot@320` + `SharedAigcListScreen@321` |
| `apps/miniapp-taro/src/pkg-ai/aigc/publish.tsx` | `9d45919c8d` | 245 / 3（E2+S1） | 259 / 2（E1+S1） | `ThemeRoot@226` + `SharedAigcPublishScreen@227` |
| `apps/miniapp-taro/src/pkg-ai/dev-enter/model-edit/index.tsx` | `87b6f557ea` | 434 / 44（E37+S4+F2+T1） | 246 / 2（E1+S1） | `ThemeRoot@221` + `SharedModelEditScreen@222` |
| `apps/miniapp-taro/src/pkg-user/account-cancel/index.tsx` | `608c1db171` | 361 / 23（E18+S4+T1） | 213 / 2（E1+S1） | `ThemeRoot@187` + `AccountCancelScreen@188` |
| `apps/miniapp-taro/src/pkg-user/user/phone.tsx` | `d938f18659` | 340 / 27（E23+S3+T1） | 236 / 2（E1+S1） | `ThemeRoot@206` + `ChangePhoneScreen@207` |

改前读数取自各页薄壳提交的父提交（`git show <sha>^:<path>` 后按同一 AST 口径计数）；改后读数取 `a1b1bf04ff` 工作区。命令：`node <temp>/nodes2.mjs <path…>`（临时量尺在仓外，不入库）。五页改后均满足 `ThemeRoot + 一枚共享屏` 的结构下限（≤2 开标签）。

### 2.2 4 条口径修正（提交 `622101d441`，在 `chore/ledger-s2-retire` 分支，尚未进 main）

1. **299 业务 JSX 分类**：`scripts/lib/miniapp-shell-form.mjs` 新增“结构+入口双证”；同一树上薄壳 246→241、复制页 47→52，见 §1。
2. **299 `not-applicable`**：汇总行 `判为 not-applicable : 0`（机制在，数据行为空）。
3. **301 `declared-object-mismatch`**：`scripts/check-web-mp-route-carriers.mjs` 与 `scripts/lib/cross-end-verdicts.mjs` 落地判决机制；数据行 0（`scripts/data/miniapp-mirror-verdicts.jsonl` 中 4 处文本命中全部是 `not-applicable` 行的证据正文，不是 `verdict` 值）。
4. **173 行内标签归一**：`scripts/check-doc-numbers.mjs` 的散文面先做行内 HTML 标签归一，再跑封闭措辞集。实测旧判据对 `<code>4393</code> API 路由 · <code>542</code> 张表` 返回 0 条命中（标签阻断数字与单位的相邻关系），归一后同文返回 2 条。

同批自检修复：`6ac3ef1b5c`（`chore/ledger-s2-retire`）对齐 T17a/T17d 两例历史红。**收尾批复测发现 D5 仍是红**（“只摘 import”在新入口双证下仍判 `shell`，变异对照失效；该红在 `6ac3ef1b5c` 上即存在，§4 原记的“25 例 0 失败”与现场不符）；本批改为“摘 import + 摘声明屏渲染”才算退出入口，并补 S2 真值锁，`check-miniapp-shell-form.mjs --self-test` 现为 `自检 35 例,失败 0`（exit 0）。

### 2.3 README 快照标注（提交 `1388255cb8`，已在 main）

`README.md:320-323`：把 2026-09-21 旧版 hero 副本（`dbTables 542`、`llmModels 176`、`apiRoutes 4393` 等）标为“截至 2026-09-21 的历史快照”，并加行级出口 `doc-num-exempt`；数字一个未手改。来源证据：`git show 26975a4bfd:README.md` 旧 README 第 31 行与今日 `README.md:320` 逐字相同；`sync-readme-numbers.mjs:43-44`、`:91-99` 只在 `BEGIN/END` 标记之间重写，该块在标记外，正规链路不可达。

### 2.4 守护让路闸（提交 `8e752790db`，已在 main）

`scripts/git-guardian.mjs` 收编腿新增基线让路闸：HEAD 非 `origin/main` 后代时整轮让路，测试补在 `scripts/tests/cross-end-landing-dispatch.test.mjs`。

### 2.5 S2 提示真值（收尾批，本地 `chore/closure-final-20261106`，未推 main）

`scripts/lib/miniapp-shell-form.mjs` 新增 `retirementShortfall(row)`：只有「页面在册且现读薄壳 + 业务 JSX ≤2 + 零重复 UI 段 + 无单端消费 prop + 有共享屏入口证据」才返回 `null`（可摘）；复制页/重复段/单端 prop/超阈值/不在射程/无入口证据/当前面无对应页一律返回具体原因。`evaluateRatchet` 据此改写 S2：

- 薄壳且三判据全过 ⇒ `存量复制页已收敛(可从台账摘除:业务 JSX N ≤ 2、零重复 UI 段、无单端 prop): <route>`；
- 复制页 ⇒ 只在行数漂移时报 `复制页行数变化(台账 N → 现读 M;仍为复制页,不得摘除): <route>`，行数相等则不报；
- 当前面无对应页 ⇒ `存量台账条目当前面无对应页(无法核对,不得摘除): <route>`（旧实现会把这种情况当“已收敛可摘”）；
- 其他判定（如 `plain`）⇒ `存量条目当前判为 <impl>,摘除证据不成立(<原因>),不得摘除: <route>`。

证据字段新增 `singleEndProps`（薄壳为 `[]`），`--explain` 可见。自检新增 C5–C12（1 正例 + 6 反例 + 1 缺失面）、D8（真实仓每条“可摘”逐条有据）、D9（真实复制页阴性对照）；`scripts/tests/miniapp-shell-form.test.mjs` 新增 T22/T22b（T22 覆盖复制页、重复段、单端 prop、超阈值、不在射程、无入口、当前面无对应页七类负例；T22b 对真实仓逐条反查，复制页混入可摘名单即红）。改前改后逐页对照见 §5.1。

## 3. 未做、但要开票的三件

### 3a. 补 RN 腿：`ExamIntroScreen` / `ShareLandingScreen`

- 现状：两屏都只有 **web + 小程序** 两端真渲染，RN 零腿。
  - `ExamIntroScreen`：web `apps/web/app/(main)/exam/[id]/ExamIntro.tsx:10,23,31`；小程序 `apps/miniapp-taro/src/pages/exam/detail.tsx:6,24,152`；RN `git grep ExamIntroScreen -- apps/mobile-rn` → **exit 1（0 命中）**。
  - `ShareLandingScreen`：web `apps/web/app/h5/share/[code]/PageClient.tsx:19,28`；小程序 `apps/miniapp-taro/src/pkg-content/share/creation.tsx:21,117`；RN `git grep ShareLandingScreen -- apps/mobile-rn` → **exit 1（0 命中）**。
- 301 现状：两屏落在 `未判定(映射缺失): 5` 名单内（`check-web-mp-route-carriers.mjs` 摘要），保持 `known-undetermined`。
- **不迁就规则**：不得为转绿而给 301 加豁免、改判据或折 0；要么补 RN 腿，要么由产品侧书面裁定 RN 不承载。
- 开票触发：产品确认 RN 需要“试卷介绍 / 分享落地页”，或 301 未判定数继续增加。
- 验收：RN 新增壳并进 registry，301 对应条目从未判定转为已裁决；`git grep` 在 `apps/mobile-rn` 由 0 命中变为 ≥1 真渲染点。

### 3b. 新判决类型的数据行落地

- 机制已落（`622101d441`）：299 `not-applicable` 汇总为 0；301 `declared-object-mismatch` 的 verdict 数据行为 0。
- 开票理由：只有机制、零数据行 ⇒ 判据面未被真实业务验证，容易下一轮“机制在、结果空”被误读为全绿。
- 开票触发：下一张新增共享屏 / 新增承载路由落地时，先落对应 verdict 行；或单独立项做首轮数据行普查。
- 验收：至少各出现 1 条带 `shared` / `route` / `evidence` 的真实行，且 299/301 汇总读数非 0；新增行必须能在两端找到消费点。

### 3c. 主树基线追平（原子三件套）

- 现状：`d:/IHUI-AI` HEAD `30d77e001a`，落后 `a1b1bf04ff` **87 枚**（`git -C d:/IHUI-AI rev-list --count HEAD..a1b1bf04ff`；任务书写时为 84，实测已前进到 87）；且工作区不干净（`.doc-autoupdate/last-sha` 已暂存、`PROJECT_PLAN.md` 已修改）。
- 三件必须一次原子完成：
  1. 追平：`fetch` + fast-forward 到 `origin/main`（禁 rebase 改写他人历史）；
  2. 重钉 `scripts/data/root-guard-manifest.json`（清单按 sha256 绑定规则文件）；
  3. 重启守护进程。
- 理由/证据：`scripts/check-root-guard-manifest-sync.mjs:231` 明示“远端 tip 面上根护栏清单与规则文件脱钩 ⇒ 部署环一 ff 到这枚就 fail-closed”；`8e752790db` 的让路闸只覆盖守护收编腿，不解决主树基线本身。
- 开票触发：任意一轮守护巡检在 `d:/IHUI-AI` 上报“根护栏脱钩”，或主树继续累积落后提交。

## 4. 已知既有红（照原样，不粉饰）

| 门 | 命令 | 退出码 | 现场 |
| --- | --- | --- | --- |
| 173 A | `check-doc-numbers.mjs --strict` | 2 | `⚠️ 未判定 description：未提供 --description ⇒ 简介面本轮不判`；`结论:--strict:1 项未判定 ⇒ 拒绝出具合格证` |
| 173 A+ | `--strict --push` | 0 | 现算 22 个数字；`散文/简介命中 76573 处数字`、`守门 336 道`、历史快照区存量 61073 处、`trackedFiles 19454` |
| 173 B | `--strict --description -` | 1 | `❌ 简介 dbTables = 340,现算 621`、`❌ 简介 llmModels = 176,现算 100`。两条均为**仓库外元数据陈旧**（GitHub 仓库简介，原文见 `docs/exposure/repo-metadata-optimization.md:204`），本批未修，需 GitHub 写权限另开票 |
| 299 自检 | `check-miniapp-shell-form.mjs --self-test` | 0 | `自检 35 例,失败 0`；两例历史红（T17a/T17d）由 `6ac3ef1b5c` 修复；D5 变异对照由本批对齐（见 §2.2 末段） |
| 105 A | `check-miniapp-generated.mjs --strict` | 1 | `[R2] apps/miniapp-taro/src/static/images/icons/minus.svg`、`triangle-alert.svg` 两处孤儿图标（产物目录文件无静态引用） |
| 105 B | `--group ui-routes` / `--group i18n` | 0 / 0 | `未发现漏生成`；四端与离线包自述钉 matched |

173 散文面读数：`散文/简介命中 76574 处数字`、`守门 336`、历史快照区存量 61073 处（只报数不阻断，`node scripts/scrub-doc-numbers.mjs --apply` 为清账出口，默认 dry-run）。

## 5. S2 提示的处置声明

口径修正 + 本批真值锁后，`可从台账摘除` 只在当前判定确实成立时出现；**本批一条都不退休**（台账 93 物理行 = 56 活跃 + 37 退休，`loc` 与字节均未动）。

### 5.1 改前改后逐页对照（2026-11-06 收尾批）

| 页 | 现读业务 JSX | 重复 UI 段（file:line） | 单端 prop | 原提示 | 新提示 |
| --- | --- | --- | --- | --- | --- |
| `pkg-ai/developer/income` | 35 | 有：自绘提现弹层 `income.tsx:374-483` ↔ 共享屏 `showWithdrawModal` | 无（两端 20 props 同名同集） | 复制页行数变化(台账 698 → 现读 488) | 复制页行数变化(台账 698 → 现读 488;仍为复制页,不得摘除) |
| `pkg-user/message/index` | 11 | 有：通知设置弹层 `index.tsx:539-563`；注入式 tab 面板 `index.tsx:410-484` | 有：`tabs`/`notification`/`renderTabBody` 仅小程序；`colorScheme` 仅 RN | 复制页行数变化(台账 569 → 现读 568) | 复制页行数变化(台账 569 → 现读 568;仍为复制页,不得摘除) |
| `pages/distribution/team` | 5 | 有：团队总人数行 `team.tsx:164-170` ↔ 共享屏 stats 卡 | 有：页独有 `onRetry`/`onEndReached`/`loadingMore`/`hasMore`/`footer*`/`emptyText`/`showHeader`/`showTabs`；RN 独有 `statsLayout`/`tree*`/`onRetryTree`/`onPressTreeMember` | 复制页行数变化(台账 339 → 现读 220) | 复制页行数变化(台账 339 → 现读 220;仍为复制页,不得摘除) |
| `pages/setting/language` | 6 | 无（0 段） | 无（RN `SettingsScreen` 同传 5 props） | 复制页行数变化(台账 137 → 现读 122) | 复制页行数变化(台账 137 → 现读 122;仍为复制页,不得摘除) |
| `pages/setting/theme` | 7 | 无（0 段） | 无（RN `SettingsScreen` 同传 5 props） | 复制页行数变化(台账 184 → 现读 149) | 复制页行数变化(台账 184 → 现读 149;仍为复制页,不得摘除) |
| `pages/distribution/commission` | 2 | 无 | 无 | 存量复制页已收敛(可从台账摘除) | 存量复制页已收敛(可从台账摘除:业务 JSX 2 ≤ 2、零重复 UI 段、无单端 prop) |
| `pages/distribution/order-list/index` | 2 | 无 | 无 | 存量复制页已收敛(可从台账摘除) | 存量复制页已收敛(可从台账摘除:业务 JSX 2 ≤ 2、零重复 UI 段、无单端 prop) |
| `pkg-ai/ai/conversation-import` | 1 | 无 | 无 | 存量复制页已收敛(可从台账摘除) | 存量复制页已收敛(可从台账摘除:业务 JSX 1 ≤ 2、零重复 UI 段、无单端 prop) |
| `pkg-ai/dev-enter/model-edit/index` | 1 | 无 | 无 | 存量复制页已收敛(可从台账摘除) | 存量复制页已收敛(可从台账摘除:业务 JSX 1 ≤ 2、零重复 UI 段、无单端 prop) |

注：业务 JSX 取门 299 自身计数；重复段/单端 prop 为人工核验。门在业务 JSX>2 时短路，不再计算后两项，因此 5 张复制页的分类证据是“业务 JSX 超阈值”，表中后两列是补充证据。

### 5.2 不把“可摘”当退休依据的三条理由

1. **旧实现有漏口，已堵**：旧判据 `!r || r.impl !== 'copy'` 会把“当前面无对应页”和 `plain` 一并当“已收敛可摘”。本批改为 `retirementShortfall` 逐条验 strict 证据，并加 C5–C12/D8/D9 与 T22/T22b 正反例；把任一复制页标成可摘，测试必红。
2. **分类器收敛 ≠ 可退休**：4 条“可摘”只是说明页面现读薄壳（业务 JSX ≤2、零重复段、无单端 prop），不等于业务对象已核对。逐页退休仍必须人工证伪三件事：同一业务对象、对端真消费（给 `file:line`）、零本地改动；台账只增不删、退休留痕，没有批量通道。
3. **本批无授权**：本轮是收尾留档，不持有退休授权；S2 只作巡检提示，所有条目维持现状。

## 6. 收尾批复核（只读数据行 + 根护栏）

- **根护栏清单**：`scripts/data/root-guard-manifest.json` 在册目标只有 `scripts/guardian-runner.mjs`、`scripts/data/judgement-libs.json`、`AGENTS.md`、`scripts/git-guardian.mjs`。本批改过的 `check-doc-numbers.mjs`、`lib/miniapp-shell-form.mjs`、`lib/cross-end-verdicts.mjs`、`check-miniapp-shell-form.mjs`、`check-web-mp-route-carriers.mjs` 与相关测试**均不在册 ⇒ 无需改**。`node scripts/check-root-guard-manifest-sync.mjs --worktree` exit 0，仅打印 `guardian-runner`、`git-guardian` 两条 01:56Z 起既有的 advisory 漂移（比的是 sha256 截断面），本批未动。
- **新枚举数据行**：`miniapp-shell-copy-ledger.jsonl` 的 `not-applicable` = 0 行（93 物理行、56 活跃）；`miniapp-mirror-verdicts.jsonl` 的 `verdict: declared-object-mismatch` = 0 行（120 行判决）。52 张在册复制页里**没有**应落 `not-applicable` 的页：52 页业务 JSX 全部 >2（最小 5），不满足“业务 JSX ≤2 + 零重复段 + 零单端 prop”的候选条件，故只报 0 条名单、不落行。
- **台账字节**：工作区 `git status` 干净，`git hash-object` 与 `HEAD` blob 一致（93 物理行、56 活跃 + 37 退休）；本批未改任何 `loc`。

## 附：复跑命令

```
git fetch origin main && git rev-parse origin/main
node scripts/check-miniapp-shell-form.mjs --worktree          # 299 现读
node scripts/check-miniapp-shell-form.mjs --self-test         # 自检（35 例）
node --test scripts/tests/miniapp-shell-form.test.mjs         # 299 枚测试（T22/T22b）
node scripts/check-web-mp-route-carriers.mjs                  # 301
node scripts/check-web-mp-route-carriers.mjs --json --worktree # 301 readouts（mismatchIgnored/Unmatched）
node scripts/check-web-rn-copy-parity.mjs                     # 291（RN 镜像对齐）
node scripts/check-cross-end-screen-coverage.mjs              # 跨端覆盖（237：镜像 256/275 / 桶 V 19 / 登记 251）
node scripts/check-miniapp-generated.mjs --group ui-routes    # 105 A
node scripts/check-miniapp-generated.mjs --group i18n         # 105 B
node scripts/check-miniapp-generated.mjs --strict             # 105 全量（2 孤儿图标）
node scripts/check-doc-numbers.mjs --strict                   # 173 A
node scripts/check-doc-numbers.mjs --strict --push            # 173 A+（exit 0）
sed -n '204p' docs/exposure/repo-metadata-optimization.md | node scripts/check-doc-numbers.mjs --strict --description -   # 173 B
node scripts/check-root-guard-manifest-sync.mjs --worktree    # 根护栏对账（仅既有 advisory）
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
