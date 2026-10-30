<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# goal-b33/b34 席位交接件（2026-10-30 固化，基线 HEAD db608ef73d）

来源：24 份席位报告（原位于 gitignored 的 .ihui-agent/tmp/{g33,g34}/，本文件为防清理丢失而固化）。
凭据扫描：零命中


## .ihui-agent/tmp/g33/s1

# g33-s1 交付报告

## 结论
PREMISE-ROTTED（落点 `scripts/union-converge.mjs` 那一刀已在 HEAD 完成，零改动）

## 票面原文
```
- [ ] {{NEXT_ID:docs-207}} **守门 207 存量清偿第二刀（现读 AGENTS.md 105,156B>预算 96,000B，缺 9,156B）**：先补 `scripts/union-converge.mjs` 的 `declaredDropCaps` 让"AGENTS 归档移出"也算合法处置（现读它只认台账摘除票——本批实测 `merge-live-doc --apply` 把有意移出的副本判真丢失并插回；带反证测试落地），再把 §0–§29 正文取证括注逐条核验外置，**①补完前禁止再搬 AGENTS 任何行**，达标后摘 207 应急变量并三面复跑留证〔登记@2026-10-25/行为级深挖席；第一刀与守恒证明见枚 c9c85d63〕
```

## 一手证据

### 1. AGENTS.md 体积现读（门 207）
```
$ node scripts/check-agents-doc-size.mjs
❌ AGENTS.md 体积 110231 字节 > 预算 96000(面=head,超出 14231)
```
→ 票面前提（AGENTS.md > 96,000B）仍成立，但 AGENTS.md 本批禁止写入，剩余工作在禁区文件。

### 2. 落点那一刀（union-converge.mjs）已在 HEAD 完成
HEAD 基线：`58f51477c1`

提交 `b6023aa977` 标题明确写明"守门 207 第二刀①"：
```
b6023aa977 fix(live-doc): AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①)
```
后续三笔同族改进：
```
0a3defae5a fix(scripts): 通配归档占位不构成移出凭据——修 union-converge 唯一那条镜像红
4c7d8c30e3 fix(landedoc): 活文档体积清偿不再被归并回潮——归档清单补处置侧面 + 复洁器认"逐字在迁出批次 ∧ 处置侧 0 份 ∧ 非登记行"
730f25dc65 fix(landedoc): 补齐回潮根治的判据侧——归档清单认处置侧面 + 复洁器维五(调用侧已被 13:09 收编轮先行吃进 HEAD)
```

union-converge.mjs 在 HE

—— 未收格（逐字摘录）——
未收格
- AGENTS.md 体积 110,231B 仍超预算 96,000B（超出 14,231B），整体票面尚未结清。
- 后续出路是 §0–§29 正文取证括注逐条外置至 `.ihui-agent/archive/`，此操作要求写入 AGENTS.md——本批明令禁止，归属主席统一下一批或机主亲自操作。
- 达标后还须摘 `HUSKY_SKIP_AGENTS_DOC_SIZE=1` 应急变量并三面（全量/索引/工作树）复跑留证。


## .ihui-agent/tmp/g33/s10

# g33-s10 交付报告（侧车 rot / conflict 按三条出路清）

## 结论

**DONE（部分格结清，余格点名）** — 落点 `scripts/data/plan-fields.jsonl` 已按三条器物出口改判/退场，现读：

| 维 | 动手前（HEAD 面） | 落盘后（同判据、侧车换成写面） |
| --- | --- | --- |
| rot（已禁形态残留） | **58** | **40** |
| conflict（矛盾组） | **40** | **0** |
| dup（同键同读数） | 6 | 0 |
| blind（A2 盲区） | 5 | 0 |
| orphan（侧车孤儿记录） | 202 | 111 |
| midform（只报数） | 1 | 2 |

侧车物理行 258 → 155（`git diff --stat`：**34 insertions / 137 deletions**）。
台账面（`git show HEAD:PROJECT_PLAN.md`）机主禁令射程现读 **waiting-human=0 / waiting-env=0**（open 行 121 枚：actionable 53 / owned-elsewhere 70）⇒ **本仓两桶的活票本来就是零**，rot=58 的读数 98%（57/58）是**台账行已按「完成即删」摘掉、侧车记录还挂着**的残迹，不是"有人在等拍板"。这个分解是本席最重要的判据面结论。

## 票面原文

本席是主席派单（非台账单票）。派单原文要点：`【落点】scripts/data/plan-fields.jsonl（只能经器物写，禁手改）`＋`现状 …conflict=40 rot=58 stock=90 face=head`＋`三条出路`＋`红线 不改 PROJECT_PLAN.md / 不 commit / 不改判据 / 不为读数好看标成可做`。

唯一"活票"格（台账有行且命中 rot）的整行原文（内容锚点 = `G-115`，取 `git show HEAD:PROJECT_PLAN.md`）：

```
- [ ] G-115 **本地与 origin/main 又是一轮真分叉,部署环因此不切流(2026-09-29 现读;归属:机主;在等:拍板"由谁、在哪个窗口收敛" —— 不拍板则线上产物停在旧提交)** —— **后果写在前面**:部署环最近一轮收尾 `exit=1`,FAIL 原文「git merge --ff-only 本轮远端 t

—— 未收格（逐字摘录）——
未收格 1」；所以"落盘后"这行是用**门自己的 `judge`＋HEAD 台账行＋写面侧车**算的，判据零复算）：
   ```
   node scripts/check-plan-fields.mjs            → …rot=58 conflict=40 … face=head（HEAD 侧车未提交,读数不动,符合预期）
   judge(HEAD rows ⊕ 写面侧车)                    → rot=40 conflict=0 dup=0 blind=0 midform=2 orphan=111 stock=82
   ```
7. 落点足迹（只动侧车）：
   ```
   git status --porcelain -- scripts/data/plan-fields.jsonl   →  M scripts/data/plan-fields.jsonl
   git diff --stat HEAD -- scripts/data/plan-fields.jsonl     →  34 insertions(+), 137 deletions(-)
   ```
   未 commit / 未 add / 未 push / 未改 `PROJECT_PLAN.md`（它现在是 `MM`，是别席+落地欠回写在飞的，与本席无关）。

## 改动文件

- `G:/IHUI-AI/scripts/data/plan-fields.jsonl` — 258 → 155 行（1 枚改判 + 60 枚同键去重 + 43 枚孤儿退场），全部经器物写，零手改。
- `.ihui-agent/state/plan-row-drop.jsonl`（gitignored 留痕，由退场档自写）— 28 条。
- `.ihui-agent/tmp/g33/s10/{dump-lists.mjs,table.mjs,table.txt,rot-conf-head.txt,retire-dry.txt,decl-live-rot.json,baseline-head.txt,report.md}` — 本席取证件（tmp，gitignored，未 commit）。

## 余下 40 枚 rot：逐族为什么判不了（器物点名原文，非本席裁断）

| 枚数 | held 原因 | 为什么不落 |
| --- | --- | --- |
| 25 | `最近一次 updatedBy=plan-fields-extract(本器自写面)⇒ 本轮不退;出路 = --retire-intent 声明档` | 有合法出口但**要逐枚 ≥10 字定向说明**；本席时间盒（40 分钟）用完，未替这 25 枚编造交代 ⇒ 留给下批逐枚写 `--retire-intent`（形态 `[{key,why,declaredAt}]`） |
| 7 | `键形态不合法(号段缺位或题面短于 4 字)⇒ 不退` | 全是 `T:<sha16>` 兜底键（`keyKind='rowhash'` 本就不得充当归属权威）。**三条器物出口都打不到它**：reclassify 要台账行、retire 前置② 判它非法、intent 只放自写面/题面两族 ⇒ 结构性无出口

## .ihui-agent/tmp/g33/s11

# g33-s11 交付报告

## 结论

**DONE(两件事,分开计账)**

1. **票面主命题(63 处 B5)= 判据侧范围声明漏登记,不是生成器的形态错。** 生成器侧没有任何合法出路;正解是给门 77 的 `OUT_OF_SCOPE` 补一条路径精确的声明。判据文件在本席红线里是**只读**,故一字节未动,最小修法(可整块贴)交主席裁。
2. **本席落点内另抓到一枚真缺陷并已修 + 锁住**:`node scripts/gen-rn-compat.mjs --write` 只要走到"重写 `route-map.generated.ts`"那一支就 **100% exit 2**(门 251 的修复出口本身是跑不通的出路,§0.8)。根因是共享工作区的瞬时句柄争用(`UNKNOWN` / errno -4094),已按仓内既有出口修:落盘改走 `lib/atomic-write.mjs` 的 `atomicWriteFileSync`,注入腿加退避重试 + 回读自证 + 把子进程 stderr 与 errno 报出来;镜像测试补 N1–N5(15/15 绿)。

## 票面原文

本席票面即派单书正文(非 `PROJECT_PLAN.md` 登记行,故无台账整行可取)。相关在册口径两处,现读自 HEAD:

- `README.md` 门 251 节 / AGENTS 补记:`check-rn-compat-coverage.mjs`(251,blocking)…**C2 lucide 名 ⊆ `icons-generated.tsx`…生成腿单源 `node scripts/gen-rn-compat.mjs --write`(名字全集按 HEAD 面现算,写后紧随注入水印)**
- 派单书落点:`scripts/gen-rn-compat.mjs`(生成器);判据侧 `scripts/check-radius-single-source.mjs` **只读、不许放宽**

## 一手证据

### 一、63 处 B5 的归属(改前改后同一把尺)

| 命令 | 末行现读 |
| --- | --- |
| `node scripts/check-radius-single-source.mjs`(改前) | `[radius-guard] 判定面 HEAD blob(磁盘≠HEAD 者按 HEAD 取) \| 扫描 7165 文件(B 射程外按声明摘除 239 个)\| 违规 63 处(HEAD 自身/基线容忍 0 / 新增 63)\| 基

—— 未收格（逐字摘录）——
未收格

1. **交主席裁(本票主命题,唯一能让 63→0 的通道)**:门 77 `OUT_OF_SCOPE` 补一条 `icons-generated.tsx` 声明(上面的块可整块贴)。B5 判据本体一字未改,这不是放宽,是这张表的设计用途(门头注判据 C 原文:"②落在下面的 OUT_OF_SCOPE,并写明为什么不适用";B5 的 hint 原文也写着"确属图形轮廓则把该资产目录声明进 OUT_OF_SCOPE")。
2. **交主席:落地要快。** 本席期间 `scripts/gen-rn-compat.mjs` 与 `scripts/tests/gen-rn-compat-route-map.test.mjs` 的工作树副本**被并发 actor 整文件还原过**(我 23:4x 落好并通过 13/13,23:5x 复读到的是 HEAD 原文,重落一次又被还原,现第三次落地并复验 15/15)。这不是判据问题而是共享工作树的已知形态,但**再被洗一次本票就白做**;建议主席立即按 pathspec 收这两枚文件。
3. **只报数(既有设计,非缺陷)**:`--write` 现读 `路由名映射:257 条在册 / 映射不到 81 条(运行时点名)/ 导航器壳文件 333 个 / 组件名解析不到 1 条(Main(component=MainNavigator))`,并 `⚠️ 登记表同 rn 撞键共 15 组`(基线 `ffdf6e88` 时读,现读以主席落地时为准)。生成器头注已明写"不改 map 胜出结果、不判红",归属在 `scripts/data/cross-end-screen-registry.json` 那一面。
4. **只报数(同族第三条腿)**:`scripts/gen-taro-lucide-icons.mjs` 的 `writeTsTable()` 把同一份含 `rx/ry` 的字形数据写进 `LineIcon/icons.ts`(该文件已被声明故不红)。今后每新增一枚 lucide 字形载体都会再撞一次门 77;可选加固 = 把"字形数据载体"收成一份声明式清单与门 77 同源,或在两个生成器头注同批点名"新载体须登记 OUT_OF_SCOPE"。超出本席落点,未动。
5. **时间盒**:40 分钟超约 90 分钟,全部耗在 63 枚归属核验与 `--write` 失败腿的复现上;先落 report 再收口。临时件均在 `.ihui-agent/tmp/g33/s11/`(gitignored),`--check`/`--write` 复跑无残留探针件。


## .ihui-agent/tmp/g33/s12

# g33-s12 交付报告

## 结论
PREMISE-ROTTED(本席基线 HEAD `eb87981ee5e39aa59b994d65057021d52f5fd76d`)+ 5 条红全部点名归属为别席在飞改动所致。零改动。

## 票面原文
主席派单(非台账票):「HEAD 面 `tsc --noEmit` 全端 RC=2,5 条错:EduAiHub ×2、PlanList ×2、`packages/shared/src/sse/families.ts:85` ×1。逐条判成因并最小修……若某条红其实是别席在飞造成的(该文件工作树≠HEAD),点名归属、不要替别人改。」

## 一手证据

1. **落点在飞状态**(`git status --porcelain -- packages/app packages/shared/src/sse`,HEAD 基线 eb87981 时刻现读):
   ```
    M packages/app/src/components/SectionHeader.tsx
    M packages/app/src/features/edu-ai/edu-ai-styles.ts
    M packages/app/src/features/plan/plan-styles.ts
    M packages/app/src/features/student/student-styles.ts
    M packages/shared/src/sse/__tests__/contract.test.ts
    M packages/shared/src/sse/contract.ts
   ```
   注意:**6 枚脏文件全是别席在飞改动**(触发文件),而**报错所在的 3 枚文件**(`EduAiHubScreen.tsx`、`PlanListScreen.tsx`、`families.ts`)工作树 == HEAD(`git status --porcelain` 对这三枚返回空,RC=0)。

2. **EduAiHub ×2 / PlanList ×2 的成因 = 别席在 style 工厂里做了未提交的键重命名**:
   - `git diff packages/app/src/features/edu-ai/edu-ai-styles.ts`:别席把 `tabTextActive`→`tabActiveText`、`chipTextActive`→`chipActiveText`(注记写明"门

—— 未收格（逐字摘录）——
未收格
1. **归属:style 键归一化改名席(g33 内在飞改 `edu-ai-styles.ts`/`plan-styles.ts`/`student-styles.ts`/`SectionHeader.tsx` 的席位)**——须同批更新消费面 `packages/app/src/features/edu-ai/EduAiHubScreen.tsx` L442(`chipTextActive`→`chipActiveText`)、L1347(`tabTextActive`→`tabActiveText`)及 `packages/app/src/features/plan/PlanListScreen.tsx` L201/L207(`filterChipTextActive`→`filterChipActiveText`),否则该改名一提交即把 4 条红从工作树假阳变成真红。
2. **归属:G-87 hook-failed 补链席(在飞改 `packages/shared/src/sse/contract.ts`/`__tests__/contract.test.ts`)**——须在 `packages/shared/src/sse/families.ts` 的 `SSE_FAMILY_CROSS_REFERENCES` 登记 `'hook-failed'` 条目(按其头注登记判据应为 null:对话流独有帧),并在 `contract.test.ts` 键表补 `HOOK_FAILED`;改动还点名要与 `apps/ai-service/app/core/sse_contract.py` 同步(本席落点禁入 `apps/**`)。
3. **主席侧事实修正**:`@ihui/app` 不是 workspace 包名,实际为 `@ihui/rn-app`,后续派单书验证命令建议改用真名(否则 `pnpm turbo --filter` 直接报 "No package found")。
4. 底稿 `s6/typecheck-errors.txt` 首两条 `NewsCategoryScreen.tsx`(`categoriesLoading` 不在 props 类型)属 `apps/**` 面,非本席落点,未处置。


## .ihui-agent/tmp/g33/s13

# g33-s13 交付报告

基线 HEAD(开工):`7d8ec7325f4c6bd0496d9dbc02a2364a99a5d1f0`
收账 HEAD(别席已推进,复核过实现仍同口径):`e7f79cf7aef1caf7e7d19b1b4af4e7449079033c`

## 结论

DONE —— 两枚失败都是**测试锁过期**(不是实现回归),且过期成因同型:同一笔
`9fdbc207ba "chore: 清理功能回退残留 + 跨端同步 + 文档自动更新"` 把测试文件按滞后副本**整树收编**回退到了
改判前的形态,而实现侧文件后来被 merge `2cf144308a`(头注逐字点名"取对侧:`scripts/lib/plan-field-line.mjs`
`scripts/lib/plan-task-index.mjs`")恢复成了改判后的版本 ⇒ 判据源是新的、镜像测试是旧的。
两枚均按各自改判提交(`f9c1514b30` / `6596afa1ba`)的口径前向修复,未削任何断言强度,反而各补了一枚反向牙。

## 票面原文

本席不是台账票,是主席按别席一手读数派下的执行单(现读 `git show HEAD:PROJECT_PLAN.md` 全篇
`grep "plan-field-line.test\|plan-fields-project.test"` 命中 0 条相关登记 ⇒ 无内容锚点可取)。派单原文:

> 【一手读数·别席刚量到,HEAD 面真红(落点与邻件 blob 全 == HEAD,非脏树假阳)】
> 1. `scripts/tests/plan-field-line.test.mjs` ⇒ `tests 15 / pass 14 / fail 1`,失败在 `:40` —— 它仍断言
>    **旧的"截断"行为**,而判据源 2026-10-25 已改成"**不得截断**"。
> 2. `scripts/tests/plan-fields-project.test.mjs` ⇒ `tests 25 / pass 24 / fail 1`,失败在 `:83` ——
>    夹具前提「删了会挪复合主键」已不成立(一手复现:composite 前后同为 `G-10#事件归属`)。
> 【落点】只许改这两枚测试文件。判据源 `scripts/lib/plan-field-line.mjs`、`scripts/plan-fields-project.mjs`、
>    `scripts/lib/plan-row-c

—— 未收格（逐字摘录）——
未收格

1. **`9fdbc207ba` 型"清理回退残留 = 滞后副本整树收编"仍是活的系统性风险**(归主席/机主面,本席零权):
   它回退的是**测试文件**,而 merge 只按声明清单取回了实现文件 ⇒ 产生"实现新、测试旧"的错位。本批已确认同型受害者
   两枚;建议主席对本枚做一次面差普查(`git show 9fdbc207ba --stat` 的测试文件集 × 后续 merge 的取对侧清单),
   而不是逐枚等它跑出红来。**只读尺子的落点不在本席清单内,未动手。**
2. `scripts/check-test-judge-not-replicated.mjs --worktree` 本席跑成了 `无法判定(不记为通过):worktree 面内容取不到
   3 个文件,首个:scripts/tests/dockerignore-secrets.test.mjs` —— 与工作树脏副本他人文件有关,与本席改动无关;
   该门是 warn 档,本席**不把它报成绿**。若要判本席改动是否复制判据,证据 = 两枚测试仍只 import
   `../lib/plan-field-line.mjs` 与 `../plan-fields-project.mjs` 的 `__test__`/具名出口,新用例的预算值来自生产产出。
3. 台账里没有承载本席两枚修复的票行(见"票面原文"),按 §1「台账只记真工作」与"修不掉的写进 commit message"口径,
   建议主席落地时把这枚根因(`9fdbc207ba` 单面回退测试)写进 commit message,不另开台账行。


## .ihui-agent/tmp/g33/s14

# g33-s14 交付报告

基线（本席开工时）：`7d8ec7325f4c6bd0496d9dbc02a2364a99a5d1f0` 分支 main
末行读数时 HEAD：`d17a1f6c74f0426426b7ac730a690e79cbd37c04` → 收尾时 `3b76e9adf5bccd8f5c5e2a2dd7d13e37cf0c5a45`

## 结论

**DONE — 两枚分档裁定：`check-immutable-guard.mjs` 接线（挂 guardian 巡检轮 + 增量游标，不挂提交链）；`check-guardrail-hashes.mjs` 退役（与 `root-guard.mjs` 同一件事的第二份实现，§0.6）。**

票面给的两档没有"都留着"这一选；也没有"两枚都接线"这一选，因为第二枚接线就是把 §0.6 的重复实现装上车，而且它的输入集（`scripts/data/guardrail-hashes.json`）结构上不存在。

## 票面原文（内容锚点取行，不用行号）

```
- [ ]〔归:自进化〕(2026-10-25) 不可变护栏:对 `scripts/guardian-runner.mjs` / `AGENTS.md` 铁律段 / `scripts/lib/judgement-libs.json` 建只读 hash 校验清单,任何改动须人工显式解锁,否则 `IHUI-DEPLOYLOOP` fail-closed 拒绝推进(参考现有 object-space-land 的 CAS 思路扩展到规则自身)
```

取法：`git show 7d8ec7325f4c6bd0496d9dbc02a2364a99a5d1f0:PROJECT_PLAN.md | grep "不可变护栏"`（现读 1 条命中）。
该枚票面**票面目标已被 `root-guard.mjs` 达成**（票面点名的三个目标 = `root-guard.mjs:39 REQUIRED_TARGET_IDS` 逐字同名；票面点名的"IHUI-DEPLOYLOOP fail-closed"= `deploy/win/ihui-deploy-loop.ps1:574` 真跑 `root-guard --check`），本席据此裁第二枚退役。

## 一手证据

1. 两枚零派发点（现读，排除归档件）：

```
$ git grep -n "check-immutable-guard" HEAD -- . ':!.ihui-agent/arc

—— 未收格（逐字摘录）——
残余缺口如实写进头注 = 恶意 merge 自身改判据面，归 `root-guard --check` 的哈希封条
  - 头注把"为什么不进提交链"与执行器那两行现读原文写死（不再是"建议见 PROJECT_PLAN"）
  - 自检 21 → 26 例（ST22 建点不判历史 / ST23 判恰好一次 + 下轮不重判 / ST24 额度与 pending / ST25 detached / ST26 合并跳过）
- `G:/IHUI-AI/scripts/git-guardian.mjs` — 新增唯一调度器 `auditImmutableGuardNewCommits()`（+ 常量 + tick 挂点 + 台账登记）
  - 5 分钟节流；尺子不在位 ⇒ "本轮跳过，不记为已探测"；结论取不到 ⇒ 未判定不记绿；`breach` 才到人（`dedupKey='undeclared'` 稳定身份，sha/明细不进指纹，§5e-3；正文自带可执行下一步，§5e-1）；`undetermined`/`bootstrapped`/`no-new-head` 只写日志不喊人
  - 派生按 §12g 显式 stdio + `windowsHide` + 3 分钟超时（照 `auditCrossEndParityDrift` 同型）
- `G:/IHUI-AI/scripts/check-guardrail-hashes.mjs` — 摘除（工作树删除，未 `git rm`，见未收格 ①）
- `G:/IHUI-AI/scripts/data/guardrail-hashes.json` — **未新建**（退役裁定下建基线件 = 给重复实现喂输入，§0.6）

`scripts/guardian-runner.mjs` 与 `deploy/**` 一字未动（热档只读）。

## 验证末行现读

```
$ node scripts/check-immutable-guard.mjs --self-test | tail -1
[immutable-guard:self-test] 26/26 通过
$ node --test scripts/tests/check-immutable-guard.test.mjs | tail -3
ℹ tests 16   ℹ pass 16   ℹ fail 0        ← 含 T15（runner 现读仍无本门）与 T16（自检全绿）
$ node scripts/check-immutable-guard.mjs --audit-new --limit 40   （游标手工退 30 枚后真跑）
❌ [immutable-guard:audit] state=breach 判据面被静默改动（未声明 / 声明过短 / 清单到期）
   - 6e3584b69f93f14bd6726fc124b91238d01fc733「feat(miniapp): PDF 工具台全链落地…重放版」code=undeclared
   - 3f598e351d222c87e74be9422202abcd2901b625「fix(relay): Trae 切号不再按映像名全杀进程」code=undeclared
   注：区间长

## .ihui-agent/tmp/g33/s15

# g33-s15 交付报告

## 结论
DONE（`--staged` 档崩溃已修，判据强度不降反正；回归锁已带变异反证）

基线 HEAD：`5aebbb02a83a2d46c9b4590ac4d06e62e8fde140`（开工时现读）

## 票面原文
本票为 goal-b33 派单子席（主席 dispatch，未占 PROJECT_PLAN 行——现读
`git show HEAD:PROJECT_PLAN.md | grep -c 'check-plan-fields'` = 0）。票面即派单书原文：
「`scripts/check-plan-fields.mjs` 是 blocking 门、stagedTriggers=PROJECT_PLAN.md，但该器在
--staged/--worktree 档必崩：HEAD 第 339 行 `ReferenceError: translate is not defined`……
①复现 ②判成因（git log 找引入提交）③最小修且不降判据 ④镜像测试补真跑 --staged 的回归锁
⑤复跑四档取末行。红线：不 commit/add、不放宽 a1/a2/a3、不动 runner 注册、禁 try/catch 吞成 exit 0。」

## 成因链（一手取证）
1. **复现**：`node scripts/check-plan-fields.mjs --staged` ⇒
   `ReferenceError: translate is not defined at check-plan-fields.mjs:339:17 (readFaces←run←main)`，
   真退出码 = 2（顶层 catch 打印后 exit 2；stdout 无机读行——这就是"门不存在"的指纹）。
   触发条件：仅 `face!=='head'` 分支（第 339/345 行读裸标识符 `translate`），全量档不经过该块。
2. **考古**（`git log -S` + 逐 commit diff）：
   - `ea32579b60`（10-24 编号纪元特性）在 readFaces 内**就地声明** `epochMark`/`translate` 并配
     `idNorm`/`translateSideKey` 定义，三处消费同批落地，当时自洽；
   - `9fdbc207ba`（10-25「清理功能回退残留」，即 AGENTS 门 253 头注点名的同一批误删）把**定义面与
   

—— 未收格（逐字摘录）——
未收格
1. **修好崩溃后暴露的 a2=3 存量红（归主席/台账席）**：HEAD 面 L30780/L30781/L30784 三行行内标头与
   侧车读数不同（侧车 owner 串尾多/full-width 括号 `）`/`)` 一枚）。门 234 是 blocking，任何碰台账的
   提交都会被这三行拦红（head 面崩溃前也在红，只是崩得更早没人读）。修法出口：
   `node scripts/plan-fields-reclassify.mjs --decl <json> --apply` 或 live-doc-edit 改行——落点在本席清单外，未动。
2. **纪元标记行在台账重复 8 份**（L30452 起逐字多副本）：属活文档卫生器射程，本席只报名不代清。
3. `--worktree` 档 a1=184：工作树副本与 HEAD 漂开所致（多席并发常态），非判据缺陷。


## .ihui-agent/tmp/g33/s16

# g33-s16 交付报告

## 结论

DONE（本票目标在工作树面达成；判定面 HEAD 须由主席提交 `scripts/data/plan-fields.jsonl` 后方归零 —— 本席按红线不 commit / 不 git add）

**成因假设被证伪**：a2 那 3 枚**不是**「侧车改了归属而行内标头没跟着重写」，而是**侧车 owner 值本身被旧抽取器污染** —— 值尾吞进了包裹句的游离闭合括号（`）` / `)`）。三枚的**行内标头是干净且正确的**，侧车是错的 ⇒ 按任务判据走「侧车错」那一支：经 `plan-fields-reclassify.mjs` 回改侧车，**台账一行未动**（投影器逐字渲染侧车值，若反向改行内去迁就侧车，就是把器物污染洗进台账）。

## 票面原文

本票非台账登记行，是主席派单（g33-s16）：取 `check-plan-fields.mjs` 现读 a2=3 的逐条点名 → 逐枚判「侧车对 / 行内标头对」→ 按结论走唯一出口落地 → 复跑证明 a2→0 且 dup/conflict/blind/rot 不回升；另只读点名 midform=2。基线 HEAD 开工时 `02bdf74496f5cfb4f6d4c12092a97501579ee78a`（收单时 HEAD 已被别席推进到 `e118488e7a`，与本票改动无关）。

## 一手证据

### 1) a2 逐条点名（判据全文，非 --json：该门无 `--json` 档，全文自带点名段）

```
  · A2   L30771  标头 ⇄ 侧车不一致 行内=〔归:ai-service↔api 两侧持有者〕 侧车=〔归:ai-service↔api 两侧持有者）〕
  · A2   L30772  标头 ⇄ 侧车不一致 行内=〔归:ai-service 端〕           侧车=〔归:ai-service 端）〕
  · A2   L30775  标头 ⇄ 侧车不一致 行内=〔归:web 聊天附件链〕           侧车=〔归:web 聊天附件链)〕
```

投影器把两侧**逐字**渲染成标头，差异字符只有尾部那枚游离括号。

### 2) 三枚的三份输入对表（行内原文散文 / 侧车记录 / 投影值）

`git show HEAD:PROJECT_PLAN.md` 行原文（截前 220 字）：

```
L30771  - [ ] 〔归:ai-service↔api 两侧持有者〕 **G-242 一次性 capa

—— 未收格（逐字摘录）——
未收格

1. **主席落地腿（必须）**：本票修正只在工作树侧车；门 234 全量档判 HEAD 面侧车 ⇒ HEAD 末行仍 `a2=3`，blocking 会继续挡所有碰台账的提交。请把 `scripts/data/plan-fields.jsonl` 提交入库（无需动台账）。
2. **落地顺序警示**：本票修好之前，`node scripts/plan-fields-project.mjs --dry-run` 现读 `rewrite=3`（face=head）—— 即投影器正打算把带括号的畸形标头写进那 3 行。**在侧车修正入库前跑 `--emit` + `live-doc-edit`，就是把器物污染洗进台账**，请勿在本票落地前发射投影。
3. **同型污染余量 4 条（只读点名，本票未动）**：`plan-fields.jsonl` 里 owner 尾括号的共 7 条，除本票 3 条外还有 `G-44#token增量基线…`=`ai-service 成本账本)`、`G-941#token增量基线…`=`ai-service 成本账本)`、`G-828#长会话渲染成本`=`web 消息列表持有人 + 用户)`、`G-52#safe-commit的差分归因…`=`` `scripts/lib/commit-gate-attribution.mjs` 持有人)``。前三者在 HEAD 台账面**找不到对应登记行**（短锚 `token增量基线`/`长会话渲染成本` 命中 0）⇒ 落在 orphan=111 桶只报数，不产生 A2；第四者（G-52）带反引号，`cleanOwner` 注释明写那是**本仓真实标头写法、设计豁免**，不该剥。正解出口 = `--retire-orphans` 退孤儿键，不是改 owner。
4. **根因余量（建议另立一票，本票按红线未改抽取器）**：`cleanOwner` 的剥尾括号修复（2026-10-26）只作用于**新抽取**，历史侧车记录无人回填；本次「侧车重建」枚 `1c7fd47a45` 清了 rot/conflict/dup 却未重抽 owner ⇒ 只要旧记录还在，同型 A2 随时可能因别席重写某行标头而再次显形。出路是「按现行 cleanOwner 对已有记录做一次幂等重洗（走 reclassify 出口，逐条带 why）」，不是改判据。
5. **别席在飞（本席不代裁）**：`--worktree` 面 a2 余 2 枚 = L5849 `O02#跨端UI单一源` 行内被写成 `〔归:—〕`（占位）而侧车=机主真机验证面；L6583 `G-50#DevEnv搬入G` 行内 `〔归:—｜等:等环境〕`。两枚都含 `—` 占位、与本票三条键无交集，属别席正在改写的行。
6. **midform=2 只读点名（按票面要求，未修）**：HEAD 档那两枚是 `G-86#线上WebSocket全通道不可用` 行内 `〔归:机主EdgeOne与Cloudflare控制台｜等:—〕` 与 `O02#跨端UI单一源` 行内 `〔归:机主真机验证面｜等:—〕` —— 形态即「行内多写了一段空等位 `｜等:—`，而侧车 `waiting:none` 使投影器不渲染等段」，**归属桶语义相同、只有形态未收敛

## .ihui-agent/tmp/g33/s2

# g33-s2 交付报告

## 结论

**DONE（本席落点两格）**——但不是「整体已达成」：

- 落点格 A `packages/desktop/src/main/index.ts`：票面前提**仍成立**（现读 0 在册 = 真未读），本席已整读到体 2384 行并产出可落地登记件 `.ihui-agent/tmp/g33/s2/slice-add.json`（用矩阵器自己的 `decide()` 验过：相对基线**新增红 0 条**、新切片 `verifiedRead=1` 清单可兑现）。
- 落点格 B `packages/ui/src/lib/`：票面「剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9」**已腐烂** ⇒ 该格 PREMISE-ROTTED（现读 238/238 全部具名在册，未读 0）。
- 票面整体**不能由本席结清**：`processResource*` 与「遥测/ARMS 族」两格不在本席落点清单（逐条点名见未收格），且登记表 `config/zcode-absorption.json` 也在落点外（共通纪律 2）⇒ 未写一行。

未 commit / 未 add / 未改 `PROJECT_PLAN.md`；工作树零改动（改动全在 `.ihui-agent/tmp/g33/s2/`）。

## 票面原文

`git show HEAD:PROJECT_PLAN.md` 按内容锚点「第 3 波待办」取出的整行（基线 HEAD `58f51477c1f815a9bd63ce76998475203f2e338f`，该行现读仍在 `L28333`，锚点定位不靠行号）：

```
- [ ]（认领已释放@2026-10-27/stale-claim-strip#mvq16cy0-23） **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packag

—— 未收格（逐字摘录）——
未收格），且登记表 `config/zcode-absorption.json` 也在落点外（共通纪律 2）⇒ 未写一行。

未 commit / 未 add / 未改 `PROJECT_PLAN.md`；工作树零改动（改动全在 `.ihui-agent/tmp/g33/s2/`）。

## 票面原文

`git show HEAD:PROJECT_PLAN.md` 按内容锚点「第 3 波待办」取出的整行（基线 HEAD `58f51477c1f815a9bd63ce76998475203f2e338f`，该行现读仍在 `L28333`，锚点定位不靠行号）：

```
- [ ]（认领已释放@2026-10-27/stale-claim-strip#mvq16cy0-23） **第 3 波待办（覆盖面本身，不是功能票）** —— 未读名单已报名，按此接手：`apps/zcode-cli/packages/core/src/{tool/handlers 120, runtime/methods 98, runtime/helpers 53, subagent 22, workflow 31, context 12, memory 10, browser-client 7}`；`packages/desktop/src/main/index.ts`(2384，装配主入口) + 遥测/ARMS 族 + `processResource*` 13；`packages/ui/src/lib` 剩余 workspace 22/task 21/provider 15/telemetry 9/tool 9 〔压缩@2026-10-22〕〔进展@2026-10-22/goal-r52:…〕〔进展@2026-10-24/goal-20261024-Q:只读核查完毕(未改任何文件)。三态口径 800 份:真未读 280(handlers 86 / desktop-main 130 / ui-lib 64)、已读无结论 233、已读有结论 287;520 条 verified≠self。失真校正三处:ui/lib 实为 174/238、handlers 未读 86(表内 120 含已读 34)、runtime 98/98 全在表。P0 四条待派:①tool/handlers/webfetch-egress-guard.ts:26 与 webfetch-network.ts:54 只做 URL 字面量私网阻断,无 DNS/socket 复核(SSRF 面);②packages/desktop/src/main/index.ts:276 仅挂 unhandledRejection,无 uncaughtException 落点;③400 行上限被突破 34 份;④desktopHostProcess.ts:287 打印 OAuth APP_SECRET 来源标签。指针:config/zcode-absorption.json + 只读克隆面。〕…〔同题原号 G-277〕
```

（原文另有 4 段与 G-277/门 208/门 128 相关的历史注记，为省篇幅以 `…` 折叠；逐字面 = `git show HEAD:PROJECT_PLAN.md` 该行，未截断。）

## 

## .ihui-agent/tmp/g33/s3

# g33-s3 交付报告（票 L30776 · 锚点「不可变护栏」）

基线：本席取证起点 HEAD `58f51477c1f815a9bd63ce76998475203f2e338f`，收口时 HEAD 已推进到
`eb87981ee5e39aa59b994d65057021d52f5fd76d`；关键事实在两枚 HEAD 上各测一遍，结论一致（见下）。

## 结论

**PREMISE-ROTTED**（票面目标已在 HEAD 达成且已接线，零改动）。

票面要的三件事 —— ①对 `scripts/guardian-runner.mjs` / `AGENTS.md` 铁律段 / `scripts/lib/judgement-libs.json`
建只读 hash 校验清单、②改动须人工显式解锁、③否则 `IHUI-DEPLOYLOOP` fail-closed 拒绝推进 ——
**逐条已由 `scripts/root-guard.mjs` + `scripts/data/root-guard-manifest.json` 承载，派发点在
`deploy/win/ihui-deploy-loop.ps1:574`（`root-guard --check` 非 0 即 `return` 不部署）**。
现跑 `--check` verdict=pass / rc=0，`--self-test` 9 组断言全绿。

本席**没有**按派单书的第三条分支（「存在但零派发 ⇒ 在落点内接线」）去把 `check-immutable-guard.mjs`
注册进 `scripts/guardian-runner.mjs`：那条接线在本仓现有执行器语义下**结构上是一堵恒红/恒堵门**，
且票面目标的执法面（部署环）与它无关。证据与推理见「一手证据」E6–E8，处置权交主席（见「未收格」）。

## 票面原文

`git show HEAD:PROJECT_PLAN.md` 按内容锚点 `不可变护栏` 取出（HEAD 面 `grep -c 不可变护栏` = 1，无副本）：

```
- [ ]〔归:自进化〕(2026-10-25) 不可变护栏:对 `scripts/guardian-runner.mjs` / `AGENTS.md` 铁律段 / `scripts/lib/judgement-libs.json` 建只读 hash 校验清单,任何改动须人工显式解锁,否则 `IHUI-DEPLOYLOOP` fail-closed 拒绝推进(参考现有 object-sp

—— 未收格（逐字摘录）——
未收格」）。

## 票面原文

`git show HEAD:PROJECT_PLAN.md` 按内容锚点 `不可变护栏` 取出（HEAD 面 `grep -c 不可变护栏` = 1，无副本）：

```
- [ ]〔归:自进化〕(2026-10-25) 不可变护栏:对 `scripts/guardian-runner.mjs` / `AGENTS.md` 铁律段 / `scripts/lib/judgement-libs.json` 建只读 hash 校验清单,任何改动须人工显式解锁,否则 `IHUI-DEPLOYLOOP` fail-closed 拒绝推进(参考现有 object-space-land 的 CAS 思路扩展到规则自身)
```

## 一手证据

E1 — 票面行在 HEAD（两枚 HEAD 都读到，计数 1）

```
git show HEAD:PROJECT_PLAN.md | grep -n "不可变护栏"
30776:- [ ]〔归:自进化〕(2026-10-25) 不可变护栏:对 `scripts/guardian-runner.mjs` / ...
git show HEAD:PROJECT_PLAN.md | grep -c "不可变护栏:对"   →  1   （eb87981 上复测仍为 1）
```

E2 — 票面三枚面 = 已入库根护栏清单的三枚 target（逐条对应，非我方补的）

```
git show HEAD:scripts/data/root-guard-manifest.json
  "targets": [ guardian-runner  → scripts/guardian-runner.mjs            mode=file     ]
               judgement-libs   → scripts/lib/judgement-libs.json        mode=file     ]
               agents-ironlaw   → AGENTS.md                              mode=section  start="## 0. 全局铁律" ]
"$comment": "O6501 根护栏清单:改动本清单内目标须先 --unlock 再 --seal;部署环对非 0 退出 fail-closed。"
```

E3 — 执法面真在部署环里（票面点名的 `IHUI-DEPLOYLOOP`）

```
git show HEAD:deploy/win/ihui-deploy-loop.ps1 | grep -n "root-guard"
561:        #   ① 根护栏(root-guard --check):守门执行器/判据单一真源/AGENTS 铁律段被改动且无人工解锁 ⇒ 拒推进;
574:        $rgOut = (& $guardNode (Join-Path $Root 'scripts\root-guard.mjs') --check 2>&1 | Out-String)
577:            Log "FAIL  根护栏未通过(rc=$rgRc)⇒ 本

## .ihui-agent/tmp/g33/s4

# g33-s4 交付报告（票 G-1222558「收敛链这一轮量到的四格，逐格都给可判前置」）

基线：分支 main，HEAD `58f51477c1f815a9bd63ce76998475203f2e338f`（现读于开工时）。

## 结论

**PREMISE-ROTTED** —— 票面四格 ①②③④ 在 HEAD 已全部达成（含行内注记登记的三条"已修"与本器后续根治），零改动落点。验证：两落点 `node --check` OK；`git-sync-converge-union-relay.test.mjs` 13/13 绿；`plan-collide-renumber.test.mjs` 9/9 绿。

## 票面原文

（整行原文逐字如下，取自 `git show HEAD:PROJECT_PLAN.md` 按锚点 `G-1222558` 命中，共 8,933 字符；行内含多份"副本正文并入·同题原号"嵌套注记，属台账卫生问题，见「未收格」。）

- [ ] **G-1222558 收敛链这一轮量到的四格,逐格都给可判前置(归属:union-converge 落地闸 / git-sync-converge 转述层 / 台账取号器)** —— ① **取号跳距不是常数**:本会话把 9 枚同号异题行让号,前两次分别跳 40 与 300 位,**每收敛一轮就被并发取号器吃掉一枚**(实测逐轮更换撞号对象 816101→816102→816103),改一次性挪到 `max+20000` 之后才止住 —— 正解写法:一次把整批让完、让完立刻收敛,而不是"一枚一枚让 + 一轮一轮试";② **让号有效性的判据我一开始写错了**:拒的条件不是"旧号在不在 merge-base",而是"**对侧是否还逐字带着这一行**"——本侧改成 0 份且对侧也 0 份时,union 的 〔压缩@2026-10-22〕〔2026-09-29 证据指针收口:本票与相邻几枚旁路提交正文所引用的取证脚本,原在 `.ihui-agent/tmp/o81-resume/`(被 `.gitignore` 忽略 ⇒ 换机/他人接手一律读不到),现逐件搬进**受版本控制**的 `backup/archive-removal-2026-10-16:.ihui-agent/archive/convergence-2026-09-29/`(11 件,含 README 逐名清单);当次读数与日志刻意不入库,判"某次读数"一律现跑现读。枚 `d13f78fc82` 的主题与实做不符那条继续如实留

—— 未收格（逐字摘录）——
未收格」。）

- [ ] **G-1222558 收敛链这一轮量到的四格,逐格都给可判前置(归属:union-converge 落地闸 / git-sync-converge 转述层 / 台账取号器)** —— ① **取号跳距不是常数**:本会话把 9 枚同号异题行让号,前两次分别跳 40 与 300 位,**每收敛一轮就被并发取号器吃掉一枚**(实测逐轮更换撞号对象 816101→816102→816103),改一次性挪到 `max+20000` 之后才止住 —— 正解写法:一次把整批让完、让完立刻收敛,而不是"一枚一枚让 + 一轮一轮试";② **让号有效性的判据我一开始写错了**:拒的条件不是"旧号在不在 merge-base",而是"**对侧是否还逐字带着这一行**"——本侧改成 0 份且对侧也 0 份时,union 的 〔压缩@2026-10-22〕〔2026-09-29 证据指针收口:本票与相邻几枚旁路提交正文所引用的取证脚本,原在 `.ihui-agent/tmp/o81-resume/`(被 `.gitignore` 忽略 ⇒ 换机/他人接手一律读不到),现逐件搬进**受版本控制**的 `backup/archive-removal-2026-10-16:.ihui-agent/archive/convergence-2026-09-29/`(11 件,含 README 逐名清单);当次读数与日志刻意不入库,判"某次读数"一律现跑现读。枚 `d13f78fc82` 的主题与实做不符那条继续如实留在正文,不重写历史。〕〔2026-09-29 本轮收口(落地面现读,不引用本行旧措辞):**③ 已修** —— git-sync-converge 现经 `describeUnionRelay`/`extractUnionVerdict` 五态转述(landed/undetermined/exited-clean/crashed/need-human),逐字带出 union 的结论行与落地闸条目,取不到一律写"未判定"而不再打印"亦判需人工(见上)";**④ 的弱证据那一格已修**(LoginPopUp 根容器补身份类名 `ui-panel`,门 150 由 合规3250/弱1/未1 → 合规3251/弱0/未1),未判定那一格是 `ModelList.tsx:271` 的盒档写在 `toUnit()` 里、盒形尺量不到 ⇒ 属尺子缺口不是仓库缺陷,另计;**①② 的可执行出口** = 新增 `scripts/plan-collide-renumber.mjs`(一次性让完 + 有效性按 `own + max(0, 对侧 − max(基底, own))` 现读),入库前本票不得按①②再逐轮人肉让号;本轮另恢复一处被并发回写的入库件:`a3ad07092f` 按滞后工作树把 `scripts/git-sync-converge.mjs` 整文件写回祖先 `1b418f46`,而它的新测试仍在面上 ⇒ 干净 HEAD 面上那份镜像是坏的。〕〔让号出口诊断续记 2026-10-07(一手取证,非推测):「今天走不通」的真因已定位 = yielded-ids 归档件在 HEAD 带 10 行 CRLF × 仓根 .gitattributes 全局 

## .ihui-agent/tmp/g33/s5

# g33-s5 交付报告

基线：分支 `main`，HEAD `58f51477c1f815a9bd63ce76998475203f2e338f`（开工实测）。票：G-965（内容锚点取行，未用行号）。落点：`G:\IHUI-AI\scripts\lib\plan-row-conservation.mjs`、`G:\IHUI-AI\scripts\plan-fields-project.mjs`。

## 结论

**PREMISE-ROTTED**（票面两格已在 HEAD 达成，本席零改动）：

- 格①「行内标头投影未写」——投影层与投影器物都在 HEAD：单源 `scripts/lib/plan-field-line.mjs`（13,344 B）+ 器物 `scripts/plan-fields-project.mjs`（37,611 B，头注自称"行内投影器物(规格 §4 第 2 步,2026-10-22 立,P2b)"），逐行改写先过 `scripts/lib/plan-row-conservation.mjs`（16,534 B，`assertRowRewriteConservation`）；台账面门现读 `a2=0`（行内标头≠投影读数 的枚数为 0）。
- 格②「强制档未落」——门 234 `check-plan-fields.mjs` 在 `scripts/guardian-runner.mjs:5486-5500` 登记为 `mode: 'blocking'`，且判定面正是票面要求的"只挂差值维"（门体头注第 45 行原文即"**为什么可以 blocking(§12e/票 G-965)**：本门的 verdict 只由差值维构成"）。票面括号里那句"现门 warn"已不成立。

另有一项**附带发现**（不属于本票两格，但住在本席落点同一层）：投影层镜像测试在 HEAD 面有 2 枚真红，都是**测试侧陈旧 pin**，不是实现缺失；两枚都归持有席，本席不动（见「未收格」）。

## 票面原文

```
- [ ]（认领已释放@2026-10-29/stale-claim-strip#mvst7k10-1） **G-965 台账字段结构化 P2**:行内标头投影未写、强制档未落。现读 75 个侧车键里 44 枚加标头会超 400 字档(台账 >400 字长行存量 86 枚)⇒ 投影必须与"删中段归属句"同批,逐行先过 `scripts/lib/plan-row-conservation.mjs`;侧车另有 1 键已无对应行、39 条被新版

—— 未收格（逐字摘录）——
未收格」）。

## 票面原文

```
- [ ]（认领已释放@2026-10-29/stale-claim-strip#mvst7k10-1） **G-965 台账字段结构化 P2**:行内标头投影未写、强制档未落。现读 75 个侧车键里 44 枚加标头会超 400 字档(台账 >400 字长行存量 86 枚)⇒ 投影必须与"删中段归属句"同批,逐行先过 `scripts/lib/plan-row-conservation.mjs`;侧车另有 1 键已无对应行、39 条被新版本顶掉,压缩与孤儿治理未定;强制只挂"只判本次新增"的差值维(现门 warn) 〔进展@2026-10-26/并发席:投影器 `scripts/plan-fields-project.mjs` 已增强并入库 fa9d1ad423(+172/−24,基 HEAD 2bcbe59144)—— 默认档零写盘(dry-run)、`--emit` 不给路径即落 `.ihui-agent/state/plan-fields-project-replace.json`、undetermined 三态(标头读不回 / validateRewrite 不过一律落未判定,不再猜);现读:未勾 152 / 可投影 24 / 候选超 400 字档 15 / 守恒未判定 10;实跑 --emit 出 10 条且 PROJECT_PLAN sha 前后同;镜像 17/17。余面=逐行走 live-doc-edit 落账并与「删中段那句处置说明」同批 + 39 条被新版本顶掉的侧车记录补 drop 声明;本行保留未勾。〕 〔落地@2026-10-26/并发席:首批 10 条整行投影与本次落账同批 —— 产物由 `scripts/plan-fields-project.mjs --emit` 生成(默认档读数 rows=151 rewrite=20 already=32 skip=14 over400=12 undetermined=10 orphan=60 superseded=20),逐条前置校验在此器内;超 400 字档的 12 条按票面口径不投影,守恒未判定的 10 条留给逐条取证;旧形态声明已由投影器写入 plan-row-drop。余面=剩余可投影条目 + 39 条侧车 drop 声明。〕 〔进展@2026-10-26/goal-p2:余面复核 —— 现读 rows=144 rewrite=0 already=40 skip=24 over400=0 undetermined=22 orphan=62 superseded=20;剩余可投影 0 条(前席首批 10 条与第 3 批 1 条已消费尽),本次 --emit 报「本轮没有可投影的行 ⇒ 不出件」,零落地、无 CAS HEAD 枚;复跑读数同前;被顶掉的 20 条侧车记录与 62 枚孤儿键补 drop 声明一事缺出口 —— 投影器物 plan-fields-project.mjs 的 emit() 只为 take 行写 plan-row-drop.jsonl(需 rowBefore/rowAfter),superseded 记录无对应行可声明;抽取器仅有 --dedupe 做同键去重,侧车按 lib/plan-fields.mjs 只增不

## .ihui-agent/tmp/g33/s6

# g33-s6 交付报告

## 结论

PREMISE-ROTTED —— 票 68 的 RN 腿已在 HEAD 达成（判据三函数 + ChatScreen 三处消费 + 五语言文案键 + 用例全绿），本席零改动。

票面剩余唯一欠格是 §17「真会话运行时合格证」，它不是代码改动，且在我这两个落点文件之外 ⇒ 列入未收格交主席。

## 票面原文

按内容锚点 `68. 流式中切换模型` 从 `git show HEAD:PROJECT_PLAN.md` 取出的整行原文见本文件末尾「附录 A · 票面整行逐字」（该行为单行 1 万余字符的长注记行，正文与全部进展注记逐字保留，未截断）。

题面（去掉注记后的骨架）：`- [ ] 〔归:—｜等:条件(§17 真会话留痕)〕 68. 流式中切换模型 → 终止后自动带入新模型`

## 一手证据

基线（当次实测）：

```
$ git rev-parse --abbrev-ref HEAD   → main
$ git rev-parse HEAD                → 58f51477c1f815a9bd63ce76998475203f2e338f
```

1) 落点文件均未被别席持有（工作树 ↔ HEAD 干净，无需 checkout 回正）

```
$ git status --porcelain -- apps/mobile-rn/src/screens/ChatScreen.tsx apps/mobile-rn/src/lib/model-switch.ts apps/web/src/hooks/use-chat/model-switch.ts
（无输出 ⇒ 三枚均与 HEAD 逐字节一致）
```

2) RN 腿判据件在 HEAD 存在且三函数齐备（85 行）

```
$ git show HEAD:apps/mobile-rn/src/lib/model-switch.ts | wc -l   → 85
$ git grep -n "export function" HEAD -- apps/mobile-rn/src/lib/model-switch.ts
  :47 terminateActiveStream(deps: RnTerminateStreamDeps): boolean
  :64 shouldTerminateForModelSwitch(args: {...}): boolean
  :82 resolveRoundModel(capturedModel

—— 未收格（逐字摘录）——
未收格交主席。

## 票面原文

按内容锚点 `68. 流式中切换模型` 从 `git show HEAD:PROJECT_PLAN.md` 取出的整行原文见本文件末尾「附录 A · 票面整行逐字」（该行为单行 1 万余字符的长注记行，正文与全部进展注记逐字保留，未截断）。

题面（去掉注记后的骨架）：`- [ ] 〔归:—｜等:条件(§17 真会话留痕)〕 68. 流式中切换模型 → 终止后自动带入新模型`

## 一手证据

基线（当次实测）：

```
$ git rev-parse --abbrev-ref HEAD   → main
$ git rev-parse HEAD                → 58f51477c1f815a9bd63ce76998475203f2e338f
```

1) 落点文件均未被别席持有（工作树 ↔ HEAD 干净，无需 checkout 回正）

```
$ git status --porcelain -- apps/mobile-rn/src/screens/ChatScreen.tsx apps/mobile-rn/src/lib/model-switch.ts apps/web/src/hooks/use-chat/model-switch.ts
（无输出 ⇒ 三枚均与 HEAD 逐字节一致）
```

2) RN 腿判据件在 HEAD 存在且三函数齐备（85 行）

```
$ git show HEAD:apps/mobile-rn/src/lib/model-switch.ts | wc -l   → 85
$ git grep -n "export function" HEAD -- apps/mobile-rn/src/lib/model-switch.ts
  :47 terminateActiveStream(deps: RnTerminateStreamDeps): boolean
  :64 shouldTerminateForModelSwitch(args: {...}): boolean
  :82 resolveRoundModel(capturedModel: string, latestModel: string): string
```

3) 三端判据表逐条同值（票面/文件头注的「三端只许同一套语义」成立，现读三面比对）

```
web      HEAD:apps/web/src/hooks/use-chat/model-switch.ts      :145 if (args.previousModel === args.currentModel) return false / :146 return args.hasLiveStream / :160 return latestModel || capturedModel
miniapp  HEAD:apps/miniapp-taro/src/pkg-ai/ai/model-switch.ts  :69 同 / :70 同 / :84 同
RN       HEAD:apps/mobile-rn/src/lib/model-switch.ts           :66 同 / :67 同 / :8

## .ihui-agent/tmp/g33/s7

# g33-s7 交付报告

基线 HEAD（开工当次实测）：`58f51477c1`
收口时 HEAD 已被别席推进到 `eb87981ee5`，复核 `git ls-tree -r HEAD --name-only | grep -cE "overlay-stack|esc-overlay"` = **10**（三落点与两枚真机 spec 全在，判据结论在新 HEAD 仍成立；证据 1–12 均在基线 `58f51477c1` 面取）。

## 结论

**PREMISE-ROTTED**（票面目标已在 HEAD 达成，零改动）

「Esc 无层栈协议」票面四要件在 HEAD 全部成立，三个落点文件均在库、被大面积消费、真机 e2e 两档在库且被 CI 收在跑位里。唯一的**本机未判定**是「自己现跑一次 e2e」——8801 dev server 探活 120s 超时（别席承载体正忙），不是判据缺失。另量到一条**文档面回退**（未收格第 1 条），本席未据未复核的证据动手。

## 票面原文

取自 `git show HEAD:PROJECT_PLAN.md` 第 28205 行（内容锚点 `Esc 无层栈协议`；同一题在第 28258 行还有一份未带结清注记的副本行）：

```
- [ ]（认领已释放@2026-10-23/stale-claim-strip#mvkkixmx-0） **Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-ca

—— 未收格（逐字摘录）——
未收格第 1 条），本席未据未复核的证据动手。

## 票面原文

取自 `git show HEAD:PROJECT_PLAN.md` 第 28205 行（内容锚点 `Esc 无层栈协议`；同一题在第 28258 行还有一份未带结清注记的副本行）：

```
- [ ]（认领已释放@2026-10-23/stale-claim-strip#mvkkixmx-0） **Esc 无层栈协议**(方案已定稿,待实施):20+ 处 document/window 的 Esc 监听各自为政且普遍不 `stopPropagation` → 一次 Esc 同时关掉遮罩、弹层、pane、搜索条。**正解不是逐处补 `stopPropagation`**(跨层顺序不可控),而是:①新增 `apps/web/src/lib/overlay-stack.ts` —— `pushOverlay(id)/popOverlay(id)/isTopOverlay(id)`(模块级数组,注册幂等,卸载必 pop);②每个浮层在 open 时 push、close 时 pop,其 Esc 处理器首行 `if (!isTopOverlay(myId)) return`;③`packages/ui-react` 的 Dialog/Popover 家族优先内建该注册(一处接全部端),web 端自绘 portal 层逐个接入;④已有正例可参照其消费写法:`GlobalTopBar.tsx:366`、`TagsView.tsx:135`、`hover-preview-card.tsx:44`(已用 stopPropagation 的三层)。解阻判据:构造"遮罩 + 弹层 + pane 三层叠开"场景按一次 Esc,只有最上层关闭(真机 `aria-expanded`/`data-state` 逐层断言)。注意 `work-panel.tsx` 属共享包,须与结构改造项同票评估。 〔PROGRESS 2026-09-25: overlay-stack 已 30 处在栈,本批补命令面板桥接 commit 69523d6e5;ui-react 家族内建与"三层叠开"真机断言仍未做〕 〔PROGRESS 2026-10-23/qoder-时间序席:真机档已交付 `apps/web/e2e/esc-overlay-stack.spec.ts`(3 例),结掉 modal-in-modal 逐层退出与点外关闭不留幽灵两格。变异对照现跑(临时改 `packages/ui-react/src/lib/overlay-stack.ts` 的 `isTopOverlay` 后跑本档):恒假⇒3 例全红(判得到"Esc 被误吞");恒真⇒3 例全绿(**判不到**"过度放行"——嵌套 Radix Dialog 的 Esc 由其自身 dismissable-layer 栈承担,外层压根收不到 keydown,免登录面上恒真与正常态结构上不可区分)。变异档跑完一律 `git checkout -- packages/ui-react/src/lib/overlay-stack.ts` 还原,并以 `git status --porcelain` 对该路径为空作为还原凭据;余最后一格(是可做的工作,本机未做):要咬住"

## .ihui-agent/tmp/g33/s8

# g33-s8 交付报告

基线 HEAD：`58f51477c1f815a9bd63ce76998475203f2e338f`（分支 main；开工与收口同值，未追 HEAD）

## 结论

**PREMISE-ROTTED**（票面目标已在 HEAD 达成，本席零改动）

判据：本票在 HEAD 的**落点格 = 契约层（双轴类型 + config profiles 纯函数）**已整格入库并有活消费方；剩余未结的格全在本席落点之外（运行时接线 / resume 出口 / 引擎面），按派单书「达成 ⇒ PREMISE-ROTTED」处置，不再于 `packages/types` 里补第二份。

## 票面原文

锚点 `B03. 权限双轴化`（取法：`git show HEAD:PROJECT_PLAN.md` 内按锚点字符串整行命中，非行号定位；该锚点在 HEAD 全文件命中 1 行，由脚本断言）。整行原文如下，逐字节自 HEAD blob 复制（含零宽载荷未做改写），现读 **3,204 字符 / 5,140 字节**，行首为未勾形态 `- [ ] `：

- [ ] （认领已释放@2026-10-27/stale-claim-strip#mvq16cy0-27）B03. 权限双轴化(`sandbox_mode` × `approval_policy`)+ config profiles(对齐 Codex 2026;起点是已有的 `packages/types/src/permission-mode.ts` 跨语言真源) 〔PROGRESS 2026-10-01(契约层入库,票保持未勾——运行时接线未做):一手取证(Codex 源码+官方 docs 多源交叉,2026-10-01)sandbox_mode 三值 read-only(默认)/workspace-write/danger-full-access、approval_policy 四值 untrusted/on-failure(旧拼写按成员收)/on-request(默认)/never、granular 变体 5 布尔(sandbox_approval/rules/skill_approval/request_permissions/mcp_elicitations,false=自动拒绝)、官方 approval_presets 三档 Read Only/Auto/Full Access、config.toml [profiles.NAME] 顶层键子集;双轴注册表跨语言真源 packages

—— 未收格（逐字摘录）——
未收格

以下均在**本席落点之外**，只登证据与归属，不动手：

1. **票面残余的真实格子 = ai-service 冷恢复（③）与引擎面**：`apps/ai-service/app/routers/agents.py` 现读共享解析器 `_resolved_axis_resolution`（def 在 `:1069`，内部 `:1091–:1096` 走 `core/config_profiles.configured_axis_resolution` 与 `core/permission_axis_gate.resolve_axis_resolution`）；两枚 resume 请求模型 `AgentResumeRequest:1113`（轴字段 `:1133/:1137`）、`AgentSessionResumeRequest:2001`（`:2020/:2024`）；调用点 `:1910` 与 `:2165`；续跑内层 `_resume_run_from_checkpoint:1792` 形参 `axis_resolution:1801` 且 `:1824–:1830` 有「未携带 ⇒ 取 config profiles」旁路，`_new_v2_loop:540` 形参 `:553`/透传 `:602` ⇒ **票面 2026-10-24 复核点名的"①②同缺"已在 HEAD 结清**（候选 A 已落地，代码注记自称"79 号票遗留格(2026-10-25)"）。
   另开一刀取证：`git grep -E "AxisResolution|axis_resolution|resolve_axis" HEAD -- apps/ai-service/app/services/agent_engine.py apps/ai-service/app/routers/engine.py apps/ai-service/app/services/engine_tool_bridge.py` ⇒ **0 命中**，而 `class EngineThread` 就在 `agent_engine.py`（`git grep -ln "class EngineThread" HEAD` 唯一命中）⇒ **候选 C 那一格（引擎面/冷恢复承载双轴）仍未接**，本席落点之外、且票面明文"半新半旧比不改更糟"，不由契约层席代裁。
2. **`apps/ai-service/app/services/engine.py` 与 `app/core/agent_thread.py` 不在 HEAD 文件面**（`git ls-tree -r HEAD apps/ai-service/app` 无此二路径）：票面 2026-10-24 注记里的 `engine.py:99-120` / `thread.resume:3620-3680` 指向的是当时的行号快照，现读已挪位/换文件 —— 属票面证据指针腐烂，接 ③ 时按现行文件面重新定位（`agent_engine.py` 是唯一承载体），不要照旧行号动手。
3. **票面行本身卫生问题（归主席）**：该行现读 **3,204 字符 / 5,140 字节**（`node` 取 HEAD 行后 `.length` 与 

## .ihui-agent/tmp/g33/s9

# g33-s9 交付报告

基线 HEAD：`58f51477c1`（落点两文件 `git status --porcelain` 对 HEAD 净，未动 `git checkout HEAD --` 即已一致）

## 结论

PREMISE-ROTTED（票面涉及本席落点的两格前提均已在 HEAD 达成/不成立，零改动）

## 票面原文

取自 `git show HEAD:PROJECT_PLAN.md` 第 28322 行（内容锚点：「RN 分类栏统一收口」整行），逐字如下：

- [ ]（认领已释放@2026-10-27/stale-claim-strip#mvq16cy0-16）（认领已释放@2026-10-22/qoder-claimfix:旧裸标记无日期无持有者,年龄不可判;机主 2026-10-22 判定无席位在飞,按 §1 交回派单面;登记内容一字未动）RN 分类栏统一收口(承 2026-09-23 04:19 会话被取消的迁移,用户原话"所有的菜单栏分类栏没有设计好 统一 好看的符合项目统一的样式 点击后下拉窗的形式呈现 左右滑动"):地基 `packages/app/src/components/category/{CategoryInlineBar,CategoryDropdown}` 补包根导出(`@ihui/rn-app` 可直接 import,此前只到 `components/index.ts` 端内取不到)+ Dropdown 面板改 `ScrollView`(修"选项多于 8 条被 maxHeight+overflow:hidden 静默裁切")+ 圆角一律 `rnRadius` 档(对齐同日新立 §4 圆角单一源头)。**迁移面 16 处**:共享层 9 屏(square/plaza/order/team/ranking/recruitment/token-value/study-index/study-publish,其中 study-publish 的 API 动态赛道 = CategoryDropdown 装车点)+ 端内 7 屏(ProfileScreen / TokenValueScreen / TopicListScreen / StudyIndexScreen / MaterialList / AgentScreen 赛道弹层双行并删违规 `trackDivider` hairline 分割线 / FenLeiOverlay 赛道行+分类网格双条)。孤儿裁定:`StudyBar`、`SingleTypeBa

—— 未收格（逐字摘录）——
未收格

1. **门 77 HEAD 面红（63 处 B5，全部在 `apps/miniapp-taro/src/rn-compat/icons-generated.tsx`）**：与 L28322 无关的存量红，病灶在生成腿 `scripts/gen-rn-compat.mjs --write`（AGENTS 规定 SVG 内联应写 `rx={rnRadius.xs}`，生成器写出了 `rx=2`/`rx=1` 等字面量；且档位表无 1px/3px/9px，几何真圆应写 `<边长>/2`）。归属：主席或 rn-compat 生成席；本席落点清单外、未动。**注意**：该红挂在 HEAD 上，任何触碰该生成件射程的提交都可能被门 77 差值棘轮连带问责，建议优先处理生成器而非手改生成件。
2. **票面最后一格（FenLeiOverlay 弹层真机复验）**：唯一出口 = `scripts/build-mobile-rn-release.ps1 -ApiBaseUrl https://api.aizhs.top` 重打 release 包再装机复验——需真机 + 装机动作，归机主/发版席，不在本席两落点内，本席未动。
3. `git grep` 顺带命中 `apps/miniapp-taro/src/pkg-shop/token/balance.css:9` 注释提及 StudyBar 迁移口径，仅叙述，无需处置。


## .ihui-agent/tmp/g34/s1

# g34-s1 交付报告

## 结论

**PREMISE-ROTTED** —— 票面派单书写的"唯一未做的就是跑 `--apply` 真删那 7 行",在判据面(HEAD blob)已经不存在了:那 7 行 `副本指针(编号 62/63/75/62/63/75/51)` 早被 `--apply` 删过 **4 轮**(2026-10-24 / 10-25 ×2 / 10-26),现读 HEAD `13c78b14fc`、origin/main `b608ba35c3`、索引面、工作树面**四面命中均为 0**,器物 `--dry-run` 读"候选删除 0 行(无)⇒ 无可删行(幂等出口)"。所以本席按红线(不 `--apply`、不改判据、不动台账)交付的是**取证 + 可直接使用的删除档 + 六条判据逐行读数**,而不是再删一次。

另两格实测结论(派单书"另需判"):
- **批2 有出口、无输入**:`--include-settled` 档与前置(absFloor + 基线 F5=0)都在 HEAD 上,但现读 2938 条落账注记 **100% 住在 HTML 墓碑注释行内**,注释行外 0 条、带注记的未勾登记行 0 行 ⇒ 结构性打不到,不是缺器物。
- **批3 有出口、无输入**:`--expired-lease` 档 + 租约门 `analyzeLeases` 同源接线在 HEAD 实测跑通(TTL=72h/来源:默认),但面上**过期租约 0 处 ∧ 同主键多行组 0 组** ⇒ 候选 0。
- **批1 真尾巴只有 1 行**:HEAD L30762 `- [ ] 副本指针（编号 L6880）…`(443 字),④ 判 `archive-absent` 拒删。**拒删方向正确**(它是"分叉合并丢掉的东西"那件事在面上的唯一 open 承载行),但**它已无可用的判据出口** —— 为行号型指针开的 ④d「枚回执」档(`receiptTokenOf`/`commitReceiptVerdict`)在 `7160346576` 落过、`91ead7dd14` 又叠了「陈旧快照」降级档,`1fe3a2b42d` 的 -790 行回退把两段一起抹掉,`65f63112c2` 只还原了 ④c ⇒ 现读 HEAD blob(951 行)`commitReceiptVerdict` 命中 0 次。

## 票面原文

取自 `git show HEAD:PROJECT_PLAN.md`(内容锚点 = `- [ ] **G-946 同主键副本

—— 未收格（逐字摘录）——
未收格

1. **【批1 尾巴,1 行】** HEAD L30762 `- [ ] 副本指针（编号 L6880）…(枚 290a26bc1) … **G-351〔旧号〕. 分叉合并这次"丢掉的东西"…**`:④ 判 `archive-absent` 拒删,而它是该正文在面上的**唯一 open 承载行**(同标题 open 行现读 1 行 = 它自己;其余都是 `<!-- 重复副本(…正主 L14553):` 墓碑注释)⇒ 裸删 = 丢活账,按 §7 三问不可删。归属:主席/人工裁,不是本席。
2. **【缺判据出口,是真"缺"】** 为第 1 条那种**行号型指针**开的 **④d「枚回执」档**(`receiptTokenOf`/`commitReceiptVerdict`/`buildLedgerFaceIndex`/`indexOpenRowsById`)与 ④c 的**「陈旧快照」降级档**在 HEAD 面上都不存在:实测 `git show HEAD:scripts/plan-copy-row-purge.mjs | grep -c commitReceiptVerdict` = **0**,而 `7160346576`(1184 行,④d)与 `91ead7dd14`(1329 行,陈旧快照)里都有;`1fe3a2b42d`(10-29 14:13,-790 行回退)抹掉,`65f63112c2` 只还原 ④c(951 行)。回执 sha 本身可解析(`git cat-file -t 290a26bc1` = commit,2026-09-28;那一面 L6880 是已勾行)⇒ ④d 接回 HEAD 后这一行有确定出路。缺的动作 = 把这两段实现重新接回 HEAD(独立一票),本席按红线不改判据。
3. **【其它三把尺对这一行也都打不到,写清楚免得重复派单】** F3 行号指针现读 0 处(它不吃这种形态);F4 同主键多行 0 组(指针行 `key=null`,不组分族);`plan-pointer-purge` 的 L3 档只删"剥注记后正文只剩复选框"的**纯指针行**(本行带整段 G-351 正文,不落 L3);`--fold-drifted-families` 需"同题漂开的另一份 open 行"(现读 0 族)。
4. **【批2 无活可派,别再派"清落账注记行"】** 票面那句"批2清落账注记行(须配套F5差值棘轮豁免判据)"的**配套已落地**(`plan-tasks.mjs:1651` `grewViolations(now,before,absFloor)`、`:1763` 传 `base?.F5`、`scripts/plan-task-state-baseline.json` 现读 `F5=0`),而删除对象在 HEAD 结构性为 0(2938 条注记全在墓碑行内,0 条在登记行上)。墓碑是 `ledger-move-aware` 防误回捞与归档豁免的锚点,机主 2026-10-08 已拍板"注记留原地" ⇒ **批2 的正确结论是"已收口 + 零输入",不是待办**。
5. **【批3 无活可派】** 面上过期租约 0 处 ∧ 同主键多行组 0 组 ⇒ 输入恒空;两器重叠一处:`strip-stale-cla

## .ihui-agent/tmp/g34/s2

# g34-s2 交付报告

## 结论

DONE（时间盒内完成：筛出 blocking∩无守卫 4 站/3 文件并全部改掉，另在同文件同族多收 1 支 `--root`；改前后各跑一次只读尺，读数 90 站/73 文件 → 86 站/70 文件，判据本体一字未动）

## 票面原文

内容锚点 = `G-322 **带值旗标吞掉紧邻旗标这一族的普查结果`，取自 `git show HEAD:PROJECT_PLAN.md`（整行逐字，未截断）：

- [ ]（认领已释放@2026-10-22/qoder-claimfix:原牌 2026-10-18/goal-g322 超龄 96h 未清账,机主 2026-10-22 判定无席位在飞,按 §1 交回派单面;登记内容一字未动） G-322 **带值旗标吞掉紧邻旗标这一族的普查结果(只读普查,主会话派代理跑,未修任何一处)** —— 现状(2026-10-18 现读，取代历批流水，判据本体单源 `scripts/lib/flag-value.mjs`，只读尺 `node scripts/check-flag-value-discipline.mjs --json --top 400`)：**63 文件在册 / 其中 52 文件 63 站尚未接单源**；blocking 口径(与 `guardian-runner` 注册条目 join 后"blocking∧无守卫")前十六批已收满，剩余都在 warn/未注册档。本批(goal-g322)按既有配方收口若干站：CLI 入口层用 `requireFlagValue` 判死(值必须存在且不以 `-` 开头，非法/漏值 ⇒ exit 2 并点名实得 token)，纯函数层的"非法值回落默认"契约不动(其语义由各库自检锁住)。验收=该站 `node --check` + 探针 `node --test scripts/tests/g322-flag-value-cli.test.mjs` 每站三支坏值各断 rc≠0 且点名 token + 各站既有套件与全量/`--staged` 两面 RC 不变 + eslint/watermark 零问题。逐批取证与末行原文只进 commit message(§1 台账只记真工作)。 〔待落@2026-10-18/goal-g322:本批 4 站已自证完毕但**尚未入库**,待落内容在工作树 —— check-agent-status-vocabulary-parity / check-load-state-projection-par

—— 未收格（逐字摘录）——
未收格（归属：主席 / 后席）

1. **本席踩过一次并已当场回退的坑（对主席落地有直接关系）**：对 `.mjs` 跑 `prettier --write` 会把整份存量重排。现读 `scripts/check-format-changed.mjs` 的 `FORMAT_EXTENSIONS = ['.ts','.tsx','.js','.jsx','.json','.md','.yml','.yaml']` —— **`.mjs` 不在格式门射程内**，而 scripts 层惯例是长行不折；本席一次 `--write` 造出 544/573/180 行的假 diff，已 `git checkout HEAD --` 回退到自己 4 枚落点并重做改动（末态 diff 见上）。⇒ 落地时勿让 lint-staged/手工对 `.mjs` 跑 prettier。
2. **A 族 7 文件 / 8 站的 §0.6 同源收口**（把第二份判据换成单源；其中 `check-load-state-loaded-marks`、`check-migration-bookkeeping` 两枚的旧副本只挡双划线，接单源同时是**收紧**，提交信息须如实写）。这族在尺子上仍算未接，但不是吞值风险，本席按派单口径未动。
3. **warn 档 1 文件**（门 261 `check-lint-staged-stdio-pin.mjs:280`）+ **未注册 51 文件 / 64 站**：绝大多数是工具/校验/发布脚本，blocking 危害面为 0；按危害排序继续用同一把尺（`--json --top 400`）逐批改，别一次吞 62 枚。
4. **`check-replacement-chars.mjs --recover` 的第二格位置参数**（L335 `recover(argv[i+1], argv[i+2])`）：漏值/被吞时写盘落点是固定的 `.ihui-agent/tmp/replacement-chars/<name>`（gitignored 子目录），吞值后果限于留一个 `--strict` 这类垃圾文件名，未接单源；`--recover` 本身已实测 rc=2 点名。
5. **`plan-fields-project.mjs --batch` 数值域**：现读只 exit 2 而不点名实得 token（形态不佳），前席已写在探针注释里并指到交付报告，未在本批扩大。
6. **门 91（`check-theme-prop-wiring`）默认档 HEAD 面 RC=1**：存量棘轮红，改前后同解（本席用等价路径实测），不属本票、也未被本席放宽。
7. **门 255（`fix-rn-color-literals`）无镜像测试件**（`scripts/tests/` 现读 0 命中 `rn-color`），其判据自检 11 例 + 本批探针第二十一批是当前唯一牙；如需更强锁，去处是给该门补一份 import `__test__` 的镜像件。


## .ihui-agent/tmp/g34/s3

# g34-s3 交付报告

基线 HEAD：`d6a4f00558`(main)。时间盒 40 分钟,实际约 25 分钟。

## 结论

DONE(本席落点内结清；票面的另一半"第三方 key 以 401 出栈"在 HEAD 仍成立，但落点不在本席清单 ⇒ 逐条写进「未收格」交主席)。

## 票面原文

`git show HEAD:PROJECT_PLAN.md` 内容锚点「非会话 401 被当成会话死亡」，整行原文：

```
- [ ] **非会话 401 被当成会话死亡(需拍板,会改用户可见语义)** —— `apps/api/src/routes/agent-extended.ts:202` 现读 `statusCode ?? 401`,第三方 key 填错也以 401 出栈;而 `packages/api-client/src/client.ts:654/701` 只按 `isAuthEndpoint` 排除 ⇒ 用户看到的是"你要重新登录",而真实原因是"别人家的凭据错了"。归属:api 鉴权面 + api-client 两侧持有者。**为什么还开着**:收紧改变前端可见行为(弹登录框),按纪律属对外语义决策,不得由取证票自行落地。
```

行号 202 是登记时读数；现读该 catch 在 HEAD 的第 204 行(`git show HEAD:apps/api/src/routes/agent-extended.ts | sed -n '204p'`)，形态 `statusCode ?? 401` 仍在 ⇒ 票面前提在 HEAD 成立(不是僵尸票)。

## 一手证据

1. **三面一致(先验落点不是陈旧副本)**

   ```
   apps/api/src/routes/agent-extended.ts   HEAD=IDX=WT = e1d1568c95f43492fc917a7a5422675e3f372476
   apps/api/src/plugins/auth.ts            HEAD=IDX=WT = 2078a9e325da7f498376323472f565e2204f9c46
   packages/api-client/src/client.ts       HEAD=IDX=WT = 552965b9ec7c76470804c22630d901e35ee86d90
   ```

2. **上下游现读(改动前)**
   - `agent-extended.ts:198-208`：`pre

—— 未收格（逐字摘录）——
未收格」交主席)。

## 票面原文

`git show HEAD:PROJECT_PLAN.md` 内容锚点「非会话 401 被当成会话死亡」，整行原文：

```
- [ ] **非会话 401 被当成会话死亡(需拍板,会改用户可见语义)** —— `apps/api/src/routes/agent-extended.ts:202` 现读 `statusCode ?? 401`,第三方 key 填错也以 401 出栈;而 `packages/api-client/src/client.ts:654/701` 只按 `isAuthEndpoint` 排除 ⇒ 用户看到的是"你要重新登录",而真实原因是"别人家的凭据错了"。归属:api 鉴权面 + api-client 两侧持有者。**为什么还开着**:收紧改变前端可见行为(弹登录框),按纪律属对外语义决策,不得由取证票自行落地。
```

行号 202 是登记时读数；现读该 catch 在 HEAD 的第 204 行(`git show HEAD:apps/api/src/routes/agent-extended.ts | sed -n '204p'`)，形态 `statusCode ?? 401` 仍在 ⇒ 票面前提在 HEAD 成立(不是僵尸票)。

## 一手证据

1. **三面一致(先验落点不是陈旧副本)**

   ```
   apps/api/src/routes/agent-extended.ts   HEAD=IDX=WT = e1d1568c95f43492fc917a7a5422675e3f372476
   apps/api/src/plugins/auth.ts            HEAD=IDX=WT = 2078a9e325da7f498376323472f565e2204f9c46
   packages/api-client/src/client.ts       HEAD=IDX=WT = 552965b9ec7c76470804c22630d901e35ee86d90
   ```

2. **上下游现读(改动前)**
   - `agent-extended.ts:198-208`：`preHandler` 的 try 只包 `await requireActiveUser(request)`；catch 里 `statusCode ?? 401` ⇒ **凡不带 statusCode 的抛出(内部异常/依赖故障/未来新增未标注分支)一律盖成 401**，且 `error(statusCode, message)` 只传两参 ⇒ 带 statusCode 的 AppError 的 `errorCode` 在这一步被剥掉(端上只能按 HTTP 状态猜)。
   - `plugins/auth.ts:340-367`：`requireActiveUser` 自己的四条抛出中，DB 查状态失败已在 2026-10-07 被拍板改成 `AppError('操作失败,请稍后重试', 502, 'ACCOUNT_STATE_CHECK_FAILED')`；其余三型(`Authentication required`/`User not found`/`账号已

## .ihui-agent/tmp/g34/s4

# g34-s4 交付报告

基线 HEAD（开工时）：`d6a4f00558`；本席运行期间 HEAD 被并发推进两次 → `892b1ff31f` → `b608ba35c3`（不追 HEAD，按纪律）。

## 结论

**DONE**

票面 P0 静默绿复现成立、已修，并新增 §0.3 的「枚举到 0 个候选 ⇒ exit 2 未判定」硬闸。修后本机只读快照量到 **3 枚服务**（修前量到 **0 枚且 exit 0**）。缺口已逐条点名（见下）。

## 票面原文

内容锚点 = `- [ ] G-584 **服务运行配置有 16/21 个"只在注册表里、仓里无处可查"`（`git show HEAD:PROJECT_PLAN.md` 现读，行号 6635 仅作定位提示、不作证据指针）：

> - [ ] G-584 **服务运行配置有 16/21 个"只在注册表里、仓里无处可查",其中 6 个把 `D:\IHUI-AI\...` 绝对路径钉死(归 `check-service-binary-paths` 值守者)**:现读枚举 `HKLM:\SYSTEM\CurrentControlSet\Services` 下 IHUI*/Keycloak 共 21 个服务,全部 nssm 托管;`git grep -lE "nssm (install|set)"` 在仓里只点名 **5** 个(IHUI-MONITOR / ihui-alert-bridge / ihui-alertmanager / ihui-pg-exporter / IHUI-DEPLOYLOOP)⇒ 其余 **16** 个的 `AppParameters` / `AppDirectory` / `AppStdout` 没有任何入库真相源。……〔现读更正@2026-10-17/本席:①『6 服务写死 D:IHUI-AI』已随仓库 D:→G: 迁移失效……;② 仍成立的一维:16/21 个 nssm 服务的 AppParameters/AppDirectory 无入库真相源(仓内 nssm install/set 只点名 5 个),归口=把服务定义清单入仓(部署治理,非一次性小修)。〕

（票面整行约 2,000 字符，此处按节选呈现主体与末段「现读更正」；逐字全文用上面内容锚点 `git show HEAD:PROJECT_PLAN.md` 现取。）

**前提判定**：票面目标**不在 HEAD** —— 承载器物 `scripts/check-service-inventory.m

—— 未收格（逐字摘录）——
未收格 R2）
scripts/data/service-inventory.json 水印覆盖面  → 覆盖 0/0（data JSON 不在覆盖面，与 alert-mail-faces.json 同形，无需注入）
```

重排采用 §5c 规定的顺序 `clean → prettier --write → inject → verify`，避免文本级重写毁零宽载荷链；格式化后 ②③④ 全部复跑通过（自检仍 20/20、快照仍 3 枚）。

## 缺口点名（票面任务②：注册表服务 → 仓内是否有对应脚本）

正方向（本机在册 3 枚）：

| 注册表服务 | nssm 托管 | 仓内 `nssm install/set` 点名 | 真正的 provisioning 真相源 |
| --- | --- | --- | --- |
| IHUI-AI-SERVICE | 否 | **无** | **缺** |
| IHUI-API | 否 | 仅 `deploy/win/ihui-enable-unattended-intake.ps1` | **缺** |
| IHUI-WEB | 否 | **无** | **缺** |

- 全仓（排除 node_modules/.ihui-agent/dist 等）正则 `(nssm|sc(\.exe)?|New-Service)\s+(install|set|create|config|delete)\s+[" ']?(IHUI-AI-SERVICE|IHUI-API|IHUI-WEB)\b` → **No matches found** ⇒ 三枚在册服务的**建立与配置**在仓里零真相源（票面②那一维在本机读成 3/3 全缺，不是 16/21）。
- `IHUI-API` 那唯一一格是**参数化改写**而非建服务：`$ServiceName = 'IHUI-API'`（:72）配 `nssm set`（:721），且第 29 行自述「`nssm set AppEnvironmentExtra` 是整块覆盖语义」。而本机 `IHUI-API` **没有 Parameters 子键** ⇒ 该脚本对这台机的 IHUI-API 结构上跑不通（它假定 nssm 托管）。
- `deploy/win/ihui-deploy.ps1:1980-1990` 只有 `sc.exe start/stop IHUI-WEB` ⇒ 启停有、配置无。

反方向（仓内点名而本机注册表没有，现读 hive 793 枚里无此名）：

- `IHUI-DEPLOYLOOP` ← `deploy/win/install-deploy-loop-service.ps1:53 nssm install`
- `IHUI-IMAGE-CDN` ← `deploy/win/install-image-cdn-service.ps1:157 nssm install`
- `IHUI-API-ROUTER / IHUI-API-BLUE / IHUI-API-GREEN / IHUI-WEB-ROUTER / IHUI-WEB-BLUE / IHUI-WEB-GREEN` ← `deploy/win/ihui-monitor.ps1:97-102`（

## .ihui-agent/tmp/g34/s5

# g34-s5 交付报告

## 结论

DONE（本席交付 = 可执行迁号方案 + 判据前置缺陷取证；未改台账、未改代码、未 commit/add）

关键现读：未勾登记行含「未取号」= **8 枚**（其中 1 枚是 RP-1 票面自身 ⇒ 候选 7 枚），**可迁 5 枚 / 不可迁 1 枚 / 需两步迁 1 枚**。
票面写死的出路「迁移走 live-doc-edit 整行改写档过三维守恒」**在现读判据下走不通**（一手证据见下 §B），前置 = 补号档或指纹族表同源改造。

## 票面原文

`git show HEAD:PROJECT_PLAN.md` 按内容锚点 `RP-1 (2026-10-29)` 取出的整行（当前 HEAD `41a0dcebb42bf09813fb1d6f5362f9e3dfd0b14f`；本席开工基线 `d6a4f00558`，读数时刻 2026-10-30T06:40+08:00，中途 HEAD 被别席推进 3 次，候选枚数在三个面上均为 8）：

```
- [ ] RP-1 (2026-10-29) **26 枚「未取号」登记行迁 RP 族号域并摘旧「号池已满」错记文案** —— RP 两字母族已开张(scripts/check-plan-line-loss.mjs 族表含 `RP-?\d+[a-z]?`;池 1..99 现读 0 占用/99 空闲、连续 10 号干净窗 90 个)。逐行把手填占位「（未取号:G 族号池已满/1..999 已满）」改写为 RP 族号并改正旧口径文案(池上界现读 = plan-id-lease.mjs LEASE_POOL_MAX 99,「1..999」是 2026-10-15 前旧口径残留);迁移走 live-doc-edit 整行改写档过三维守恒,迁完 26 枚占位全数消失、各票进入正常派单口径〔归:台账清偿线〕 落点：`scripts/check-plan-line-loss.mjs`
```

票面「族表含 `RP-?\d+[a-z]?`」= HEAD 面现读属实（`scripts/check-plan-line-loss.mjs` 的 `ID` 字面量末档）。**族表本身不需要为本票再改**。

## A. 逐枚判定（8 枚候选，按内容锚点，不写行号）

行号只是本次取数时的坐标，登记一律用「标题原文」锚点。

| # | 内容锚点（行首题面） | 行长 | 现读声明位 | 占位形态 | 判定 |
|---|---|---|---|---|---|
| R1 | `共享信封

—— 未收格（逐字摘录）——
未收格

1. **【主席】补号档承重改动（B 档）**：`G:/IHUI-AI/scripts/live-doc-edit.mjs` 的 `judgeRowRewriteConservation` 加「无号 → 族表可辨号」主键维放行臂（打印原因、不静默），同批镜像夹具（`scripts/tests/live-doc-edit.test.mjs` 或他席在飞的 `scripts/tests/plan-id-family-rp-open.test.mjs` 之一，**不开第三份**）。票面「迁移走 live-doc-edit 整行改写档过三维守恒」在改之前**是跑不通的出路**（§0.8/§12f）。
2. **【主席】A 档备选登记进 commit message**：`scripts/check-plan-task-duplicates.mjs` 的 `extractTaskFingerprint` 两处族盲字面量（`/[A-Z]-?\d+/g`、`/[a-z]{1,3}-?\d{2,}/g`）与族表不同源，是**先天的族盲缺陷**（两字母族 + 个位号一律漏进指纹）；本票不修它，但必须落账，否则下一张两字母族的票还会撞同一格。
3. **【台账清偿线】迁号本体**：R1/R3/R4/R5/R6/R7 六枚按 §C 顺序落（先归属句 → `plan-fields-extract --apply` → `{{NEXT_ID:RP}}` 补号 → R4/R5 第二步改错记文案）；R2 不迁。票面「26 枚」与现读「6 枚」的差额需主席按现读改写票面口径（含"叙述假阳"这一型），不得照抄 26。
4. **【未判定】`probeIdFamily('RP')` 首号读数 `RP-76` 的来源**：台账面 `RP` 仅 `RP-1`、`.ihui-agent/archive/` 面 0 命中、`scripts/data/` 无 RP 租约条目、origin 面仅 `RP-1` ⇒ 76 无法在本席可复算的面上复现。落地席**必须用令牌**、并在落地后跑 `plan-tasks.mjs --gate` 复验零撞号；若器物仍跳号，另开一枚只读尺子查占用面来源。
5. **【另一格】9 枚归档占位注释行（10 处旧口径文案）**：归档机制 2026-10-16 已退役，这些 `<!-- 已归档… -->` 行不在本票射程（动它们先问门 71 归档豁免射程与门 239 单调性）。


## .ihui-agent/tmp/g34/s6

# g34-s6 交付报告

基线：开工时 HEAD `d6a4f00558`，收口时 HEAD `55877ff48d983a4aa2bf15ca310f29cceb39196a`（期间别席推进 1 枚，**未动 `packages/i18n`**，本席落点五份语言包 blob sha 逐字节未变 ⇒ 全部读数对最终 HEAD 同样成立）。

## 结论

**PREMISE-ROTTED**（零改动）。

票面 G-37 的三格**本轮现读全部已在 HEAD / 本机达成**，本席落点（`packages/i18n/messages/web/{en,ja,ko,zh-CN,zh-TW}.json`）没有任何可修的东西：

- ① 「web 语言包 en/ja/ko 是非法 JSON」——**票面自己登记的解阻判据现读成立**：五份 `JSON.parse` 全通过、`check-i18n-keys` 与 `2e-dupns` 在 HEAD 面 RC=0；而且 `packages/i18n/messages` 下 **35 枚 JSON 全 parse OK、0 枚被打回单行形态**。
- ② 「部署环构建冷却不比对它自己记录的 `head`」——内容指纹判据已在 HEAD 在役（`Get-BuildSrcFingerprint` 被 `Test-BuildCooldown` 双向消费），镜像测试 4/4 绿。
- ③ 「:80 图片 CDN 只有开机计划任务、无常驻载体」——**这一格在本席开工前已被别枚票结清**：看门狗任务 `IHUI-ImageCDN-Watch`（开机 + 每 1 分钟）已装机且 Enabled，:80 正在被它 10-29 拉起的那个 pid 15096 守着。

另有一项**文档腐烂**发现（不是本席落点，须主席改）：AGENTS §19 末句「批量落 i18n 后必须逐语种量 CJK 三族互判 + 扫同名自套一层，**这两型现无门**，人工必查」——**这句话现在是错的**。判这两型的门存在且已装车（`check-i18n-locale-content-language.mjs`，runner id 133，blocking，stagedTriggers=`packages/i18n/messages/`）。本席按票面要求仍做了人工必查，并把它做成**与门 133 互相独立的两把尺**（见下文），两侧读数一致。

## 票面原文

按内容锚点 `G-37 三件事本轮量到` 从 `git show HEAD:PROJECT_PLA

—— 未收格（逐字摘录）——
须主席改）：AGENTS §19 末句「批量落 i18n 后必须逐语种量 CJK 三族互判 + 扫同名自套一层，**这两型现无门**，人工必查」——**这句话现在是错的**。判这两型的门存在且已装车（`check-i18n-locale-content-language.mjs`，runner id 133，blocking，stagedTriggers=`packages/i18n/messages/`）。本席按票面要求仍做了人工必查，并把它做成**与门 133 互相独立的两把尺**（见下文），两侧读数一致。

## 票面原文

按内容锚点 `G-37 三件事本轮量到` 从 `git show HEAD:PROJECT_PLAN.md` 取出的整行原文（逐字节，非手抄）：

```text
- [ ]**G-37 三件事本轮量到、刻意没动,逐条给可判前置** —— ① **web 语言包 en/ja/ko 在 HEAD 上是非法 JSON,生产构建因此连败**(线上停在 08:02 那版):枚 `5af22be4de`(09-29 16:21 +0800,本意是补 zh-CN/zh-TW 的一个 key)把 `en/ja/ko` 各**一整行正常文案替换成了整份压缩副本**,webpack 因此对 `packages/i18n/messages/web/en.json` 报 JSON 解析错(错误位置就是被压进去的那一整行 —— 刻意不写行号:§1 明令行号每次 append 都挪位,它不配当证据);zh-CN/zh-TW 同枚被压成单行(仍可 parse,但 27503 行的可读性没了)。**我没落地修复**:实测这三个文件的索引面与工作树面都已由他人在飞修好(且比我准备的"逐字节回退到损害前"更好 —— 它除了剥掉副本还补了一整个 `health` 词块),按 §12 不代裁别人的暂存;全仓 i18n JSON 在 HEAD 面 parse 失败者**只有这三个**,已逐名量过。**解阻判据**:`git show HEAD:packages/i18n/messages/web/en.json | node -e JSON.parse` 成立且 `check-i18n-keys` / `2e-dupns` 在 HEAD 面 rc=0。② **部署环的构建冷却不比对它自己记录的 `head`**:`Test-BuildCooldown` 只看时间戳,于是 08:06 一次**真**构建失败写下的 30 分钟冷却,在 08:24 分叉已由 `git-sync-converge` 解开、HEAD 早已推进之后仍白拦 9 轮(实测 08:24–08:35,用户多看 12 分钟旧版;08:36 那轮 `@ihui/shared` 已通过 ⇒ 失败根因当时早已消除)。**没有按"HEAD 变了就不拦"去修**——这台机的 HEAD 每 1–2 分钟就被并发会话推进一次,那样改等于**把真构建失败的节流整条关掉**(每 60 秒重试一次全量 next build),换来的不是及时性而是 CPU 风暴与反复切流风险。正解是**按内容指纹判"这轮源码是否真的变了"**(与 push-gate 那把 `HEAD:apps/HEAD:packages` 子树指纹同源

## .ihui-agent/tmp/g34/s7

# g34-s7 交付报告（goal-b34 · 补号档前置件）

基线 HEAD：`b608ba35c3c138d5a70526c7d314df5a35a697b7`（开工现读）

## 结论

**DONE** —— 前席实测的「RP-1 出路在器物层结构性不可达」已一手复现，并按落点推荐方案 A 在判据核 `scripts/lib/plan-row-conservation.mjs` 加了窄「补号档」：只放「从(无)到一个合法号 ∧ 除此之外逐字节不动」这一格主键维；租约维/归属桶维一条也不替它们放行。未改 `extractTaskFingerprint` 指纹定义（方案 B 面宽，波及 9 枚镜像，未选，理由见「未收格」3）。

## 票面原文

本席任务 = 主席派单（RP-1 的器物层前置）。RP-1 台账行整行（`git show HEAD:PROJECT_PLAN.md` 按内容锚点 `RP-1` 现读，行号 33603 仅作定位记录、不作证据指针）：

```
- [ ] RP-1 (2026-10-29) **26 枚「未取号」登记行迁 RP 族号域并摘旧「号池已满」错记文案** —— RP 两字母族已开张(scripts/check-plan-line-loss.mjs 族表含 `RP-?\d+[a-z]?`;池 1..99 现读 0 占用/99 空闲、连续 10 号干净窗 90 个)。逐行把手填占位「（未取号:G 族号池已满/1..999 已满）」改写为 RP 族号并改正旧口径文案(池上界现读 = plan-id-lease.mjs LEASE_POOL_MAX 99,「1..999」是 2026-10-15 前旧口径残留);迁移走 live-doc-edit 整行改写档过三维守恒,迁完 26 枚占位全数消失、各票进入正常派单口径〔归:台账清偿线〕 落点：`scripts/check-plan-line-loss.mjs`
```

## 一手证据

### ① 复现（改动前，夹具 `.ihui-agent/tmp/g34/s7/repro-handfill.mjs` 现跑）

```
keyOfRow(old) = null
keyOfRow(new) = "RP-7"
declaredKeyOf(new) = "RP-7"
violations = ["主键漂了:(无) → RP-7"]
fp(old) = "冷启动腿整族迁入新字母族"
fp(new) = "rp7冷启动腿整族迁入新字母族"
同题让号臂可用(fp0 非空 ∧ fp0=

—— 未收格（逐字摘录）——
未收格」3）。

## 票面原文

本席任务 = 主席派单（RP-1 的器物层前置）。RP-1 台账行整行（`git show HEAD:PROJECT_PLAN.md` 按内容锚点 `RP-1` 现读，行号 33603 仅作定位记录、不作证据指针）：

```
- [ ] RP-1 (2026-10-29) **26 枚「未取号」登记行迁 RP 族号域并摘旧「号池已满」错记文案** —— RP 两字母族已开张(scripts/check-plan-line-loss.mjs 族表含 `RP-?\d+[a-z]?`;池 1..99 现读 0 占用/99 空闲、连续 10 号干净窗 90 个)。逐行把手填占位「（未取号:G 族号池已满/1..999 已满）」改写为 RP 族号并改正旧口径文案(池上界现读 = plan-id-lease.mjs LEASE_POOL_MAX 99,「1..999」是 2026-10-15 前旧口径残留);迁移走 live-doc-edit 整行改写档过三维守恒,迁完 26 枚占位全数消失、各票进入正常派单口径〔归:台账清偿线〕 落点：`scripts/check-plan-line-loss.mjs`
```

## 一手证据

### ① 复现（改动前，夹具 `.ihui-agent/tmp/g34/s7/repro-handfill.mjs` 现跑）

```
keyOfRow(old) = null
keyOfRow(new) = "RP-7"
declaredKeyOf(new) = "RP-7"
violations = ["主键漂了:(无) → RP-7"]
fp(old) = "冷启动腿整族迁入新字母族"
fp(new) = "rp7冷启动腿整族迁入新字母族"
同题让号臂可用(fp0 非空 ∧ fp0===fp1) = false
```

拒写原文 = `主键漂了:(无) → RP-7`，与前席一手实测逐字一致。成因坐实：`extractTaskFingerprint` 剥编号字面量 `/[a-z]{1,3}-?\d{2,}/g` 要求 ≥2 位数字、`/[A-Z]-?\d+/g` 只接单字母，`RP-7`（两字母+个位）两把都不剥 ⇒ 补号后指纹凭空多出 `rp7` 前缀 ⇒ 让号臂恒不触发。

### ② 改动后正反向各档现读（`.ihui-agent/tmp/g34/s7/probe-reverse.mjs`）

- P1 `- [ ] RP-7 标题 —— 现状`（号+空格）⇒ PASS(violations=[])
- P2 号后不带空格 / P3 补在粗体外 ⇒ PASS（档不认族，认逐字节；G-42 亦同形过）
- ①a 号写进行首装饰括注 ⇒ REJECT，点名「不在本行声明位…条件②」
- ①b 旧行已有号（换号）⇒ REJECT `主键漂了:G-7 → RP-7(补号档不成立:…条件①…)`
- ①c 双写同号 ⇒ REJECT 条件③
- ①d 族外假号（QQ-7 被窗口尺读成 Q-7）⇒ REJECT 条件③（孤儿字符 `Q`，剥号后不逐字节）
- ② 补号同时改归属 ⇒ REJECT 双条：主键条件③ + `归属判定会漂:owned-elsewhere → actionable`

## .ihui-agent/tmp/g34/s8b

# g34-s8b 交付报告

## 结论
DONE — ④d「枚回执」档已按 HEAD 现有结构重新施加于 `scripts/plan-copy-row-purge.mjs`（局部 Edit，非整文件覆盖），HEAD 台账那一行 `副本指针（编号 L6880）…(枚 290a26bc1)` 的三档只读判定已从 `archive-absent 拒删` 变为 `④d 候选`（未跑 --apply，真删归主席）。

## 票面原文
本席为派单指令票（无台账行号锚）；其点名的缺陷承载行，按内容锚点在 `git show HEAD:PROJECT_PLAN.md` 现读为（L30762，len=443，节选逐字）：

> `- [ ] 副本指针（编号 L6880）重复登记副本:本行与同标题登记 L6880(枚 290a26bc1)重复,并发归档/回捞把它复制到了不同编号下(编号一律不改、不删行、正文逐字留在下方)。本行不进派单口径,活账以主行为准。 **G-351〔旧号〕. 分叉合并这次"丢掉的东西"与"互相矛盾的两行文档",按归属交接,不由合并代裁**:…`

（注：会话基线 HEAD `13c78b14fc`，交账时 HEAD `746d64acf8` 已被别席推进；该行行号从基线 dry-run 的 L30763 漂到 L30762 —— 恰为本仓"行号会挪、锚点要用内容"的又一实证。）

## 一手证据

### 1. 取证（动手前）
- `git show HEAD:scripts/plan-copy-row-purge.mjs | grep -c commitReceiptVerdict` ⇒ **0**（票面缺陷成立，HEAD 确无 ④d）。
- `git show 91ead7dd14:scripts/plan-copy-row-purge.mjs` ⇒ `commitReceiptVerdict` 在 L255，头注 L31-44 为 ④d 原设计（前提 (a)行号形态 ∧(b)枚 token 可解析快照 ∧(c)快照行 done ∧(d)账上编号无 open 正主 ∧(e)可点名结清凭据；失效方向恒为拒删）；L483-491 deletedRowLines 同形集；L1221-1243 落地复算臂。移植逐条对齐原设计，未凭想象重写。
- 枚可解析性实测：`git rev-parse 290a26bc1` ⇒ `290a26bc1f899c438fe29807a36a99d09db826ae`（真提交）；`git show 290a26bc1f:PRO

—— 未收格（逐字摘录）——
未收格
1. **主席落地**：批1 `--apply`（或等 guardian 派发）真删 L30762 那一行 —— 器物已备好且 dry-run 三阀全过；本席按令未跑。
2. **④b-rc 同链臂未接线（刻意）**：`91ead7dd14` 原设计里 `commitReceiptVerdict` 的 `noPointerCheck=true` 档（【归并】族无幸存者时凭回执删自述副本行）未接入选④b 分支 —— 票面限定 ④d 只放指针格，且现读 HEAD 面无该族靶行（`重复登记副本:本行与同标题登记…(枚 290a26bc1)` 的复本形态全部已是 `<!--` 注释墓碑，非未勾复选行）；函数签名保留该参数，未来若出现靶行再接线（判据已带测试覆盖纯函数面）。
3. **README/AGENTS 点名**：本器改动未涉新门，无需接线登记；若主席要按 R4 口径在文档面补一句 ④d 复位注记，归主席落（本席禁改文档面）。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
