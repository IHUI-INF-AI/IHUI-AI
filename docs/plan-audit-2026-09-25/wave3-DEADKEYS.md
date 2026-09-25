<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 附票 — 顶栏死键回收(`ide.topBar.{skill,mcpStore,capabilityMarket,skillsMarket,connectors}`)

结论:**5 枚键逐条证死,已五语对称删除**。四道门 + 三条补充门全部 exit 0;权威死键扫描器在干净检出上 A/B 同数(未新增任何死键),并用阳性/反向对照证明"扫描器绿灯"对本票不构成证据。

- 本机:`G:\IHUI-AI`,分支 main。**HEAD 在本票期间被并行会话推进过**:`80163e4249a`(开工)→ `4d71354e112`(收工)。
  收工时已对新 HEAD 复跑全部判据(见 §1.7),5 枚键仍然零引用、五语对账仍然通过。
- 改动面:**只有** `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json` 五份(键实际在 web 侧,shared 侧无 `ide` 块 ⇒ 未写 shared,未写 `apps/miniapp-taro/src/i18n/generated/**`)
- 未做任何 git 写操作(禁项遵守);提交归主代理

---

## 0. 尺子先自检(照 BRIEF"零命中先怀疑尺子")

```
git -c safe.directory=* grep -c "PROJECT_PLAN" HEAD -- AGENTS.md  →  HEAD:AGENTS.md:24
```
搜索通道有效,后面的"零命中"才有意义。

另记一条本机取材陷阱:`core.autocrlf=true` ⇒ `git show HEAD:<pack>` 会对 blob 做 LF→CRLF 换线,
直接比 sha 会得出"工作树与 HEAD 不一致"的假结论(实测 zh-CN/zh-TW/ja/ko 四份 raw sha 不同)。
归一化 `\r\n`→`\n` 后五份全部 SAME,且 HEAD blob 与工作树 **CR 计数都是 0** ⇒ blob/工作树真等值。
**任何"HEAD vs 工作树"的取词包比对都必须先归一化行尾。**

---

## 1. 引用面证据(四类假阴性逐条排除)

### 1.1 全路径字面量

```
git grep -n "ide\.topBar\.<k>" HEAD   (k = skill/mcpStore/capabilityMarket/skillsMarket/connectors)
→ skill: 仅 docs/plan-audit-2026-09-25/code-d17topbar.md:146(叙述文本,非取词)
→ mcpStore / capabilityMarket / skillsMarket / connectors: 零命中
```

### 1.2 动态拼接(本票唯一真实存在的那一处)

HEAD 全仓 `topBar` 子串在非词包/非 `.md` 文件里**只有 33 处**,逐条读完:

| 命中标的 | 是否可能产出 `ide.topBar.<5 键>` |
| --- | --- |
| `GlobalTopBar.tsx:322` `t(\`topBar.${i.key}\`)` | 否 — `i` 来自 `PLUS_MENU_GROUPS`,且类型 `PlusMenuAction.key` 在 HEAD 已收窄为 `'document'\|'browser'\|'terminal'\|'editor'\|'codeChanges'\|'agent'\|'mcp'`(7 键);数组字面量实测恰 7 项。`skill/mcpStore/…` 在类型层与数据层同时不可达 |
| `GlobalTopBar.tsx:671` 同上模板 | 否 — 同一 `flatItems`(源自 `PLUS_MENU_GROUPS`) |
| `GlobalTopBar.tsx:70` 注释 | 否(注释) |
| `GlobalTopBar.tsx:441` `t('topBar.plus')` | 否(`plus` 未删) |
| `ide-top-bar.tsx:26-34/75/84`、`view-switcher.tsx:44-60` 的 `labelKey: 'topBar.X'` 词表 | 否 — 该表字面量集合为 editor/codeChanges/document/terminal/browser/agent/settings/close,**不含** 5 键;两文件均 `useTranslations('ide')`,故它们证明的是命名空间绑定形态,不是引用 |
| `apps/web/e2e/topbar-workarea-align.spec.ts`(9 处 `topBarInner`)、`scripts/check-statusbar-single-source.mjs`(2 处,判据字符串) | 否 — JS 变量名 / 守门模式串,与 i18n 无关 |
| `apps/web/src/components/layout/__tests__/global-topbar-ecosystem.test.tsx:85` | 否 — 测试桩 `ide.topBar` 只列 8 键,同样不含 5 键 |

补充穷尽性论证:要拼出 `ide.topBar.X`,前缀 `topBar` **必须作为子串出现在某个源文件里**(模板串、常量表、字符串拼接皆然)。上面那次 `grep "topBar"` 是对 HEAD 全部跟踪文件(仅排除词包与 `.md`)的穷尽枚举 ⇒ 33 处即全集,已逐条判完。反向再兜一层:

```
git grep -nE "(use|get)Translations\((['\"])ide\.topBar" HEAD  →  零命中
```
⇒ "命名空间 = `ide.topBar` + `t('skill')`" 这一形态在 HEAD 不存在。

`useTranslations` 的 6 处非字面量实参也逐个追到取值:
`VIEW_FAILURE_NAMESPACE='viewFailure'`、`QUEUE_OPS_NAMESPACE='ai.pane.queueOps'`、
`INPUT_NOTICES_NAMESPACE='ai.pane.inputNotices'`、`TagsView` 的 `spec?.ns ?? 'common'`
(源自 `apps/web/src/lib/path-labels.ts`,值域 nav/admin/articles/compare/useCases/selfMedia…)、
`BrandMarquee namespace?: 'footer' | 'home.marquee'`、`HeroCarousel namespace='marketing.hero'`、
`use-crud-list.ts` 的 `i18nNamespace`(全仓**零调用方传值**,只有接口声明)。
⇒ 无一为 `ide` / `ide.topBar`。

### 1.3 词表驱动(常量表存字面量)

上表已覆盖:`ide-top-bar.tsx` / `view-switcher.tsx` 两张 `labelKey` 表是 HEAD 唯一的"表存 `topBar.X`"形态,
5 键均不在表内。`ECOSYSTEM_MARKETS`(GlobalTopBar.tsx:135-145)确实存 `mcpStore/capabilityMarket/skillsMarket/connectors`
**同名 leaf**,但取词走 `tEco(\`cards.${market.key}.title\`)`(命名空间 `ecosystem`,:912/:978)
⇒ 解析到 `ecosystem.cards.*`,**不是** `ide.topBar.*`。这是本票最容易看错的一处,已读源码逐行确认。

### 1.4 兜底回显不得当证据

`t(key)` 缺键会回显键名,所以"页面没报错 / 测试没红"不证明键在用。本票判定一律用**解析后的键集合 + 源码取词点**,
不用运行时观感。测试桩(`global-topbar-ecosystem.test.tsx`)自带 8 键的 `ide.topBar` mock,
删词包不影响它(它不读真包的第 8 例之外部分),真包读法在 cleanco 里另测(见 §3)。

### 1.5 跨端合并 / 离线包

```
shared 五语:  无 "ide" 顶层块;topBar 顶层块 = {capabilityMarket}(1 键)
web    五语:  顶层 topBar 块 = {editor, close, plus, skillsMarket}(4 键)
miniapp-taro / mobile-rn / cli / extension / api 各包:  ide.topBar 均不存在
```
⇒ 5 枚键**只**存在于 `packages/i18n/messages/web/*.json` 的 `ide.topBar` 下。
web 取词按 `apps/web/src/i18n/request.ts` 做 `mergeMessages(shared, web)`(端覆盖 shared),
两侧都有 `topBar` **顶层**块与 `ide.topBar` 是不同路径,删除 `ide.topBar.<leaf>` 不触碰它们。

离线包:`apps/miniapp-taro/scripts/gen-i18n-compressed.mjs` :54-56 的取材是
`mergeMessages(loadJson('shared', …), loadJson('miniapp-taro', …))` — **不含 web 包**;
且五个包都没有 `ide` 块 ⇒ 本票删除结构上不可能改写 `src/i18n/generated/remote-locales.gen.ts`,
**无需 `pnpm --filter @ihui/miniapp-taro gen:i18n`**(根 `package.json` 里没有 `gen:i18n`,端内脚本名才是它)。
实测收工后 `git status -- apps/miniapp-taro/src/i18n/generated/` 为空。

### 1.6 未跟踪 / 在飞代码(他人未提交内容)

本会话在共享工作区开工,他人 60 个 ` M` + 32 个 `??` 全程在动,故两道都查:

```
git grep -l "topBar\.<k>"(工作树,跟踪文件)→ 五枚全部零命中
未跟踪代码文件 32 个逐个 grep "topBar"      → 零 HIT(连 topBar 字样都没有)
```
⇒ 没有任何他人代码(已入库或未入库)消费这 5 枚键。

### 1.7 对"推进后的 HEAD"复跑(并行会话在本票期间提交了新内容)

收工时 HEAD 已由 `80163e4249a` 前进到 `4d71354e112`,故对新 HEAD 重跑一遍同一判据,不沿用开工读数:

```
git grep -l "topBar\.<k>" HEAD -- . ':(exclude)packages/i18n' ':(exclude)*.md'
  → skill / mcpStore / capabilityMarket / skillsMarket / connectors **全部零命中**
git grep -nE "(use|get)Translations\((['\"])ide\.topBar" HEAD  → 零命中
node .ihui-agent/tmp/o60r/verify.mjs(相对新 HEAD)
  → 五语 lost=5 gained=0 valDrift=0 行数 −5 ✅;`git diff --numstat` 仍为 0/5 × 5 份
```
⇒ 新提交既没有引入这 5 枚键的消费点,也没有改动这五份词包(否则 numstat 会出现新增行)。

---

## 2. 删除动作与五语对称性校验

改法:每份文件用一次整块替换(`ide.topBar` 块 15 键 → 10 键),**不用正则批量替换、不重排键序**。
`"skillsMarket": "Skill 市场"` 这类 leaf 在同文件**顶层 `topBar` 块里逐字同名**(zh-CN 顶层也有 `skillsMarket`),
故 old_string 带 4 空格缩进的块首尾 ⇒ Edit 报 "1 replacements"(非唯一即报错),没有误伤顶层块。

权威对账(解析后的键集合,不用文本 diff):

```
$ node .ihui-agent/tmp/o60r/verify.mjs
┌ lang    ┐ headLeaves wtLeaves lost gained valDrift targetStillPresent ideTopBarKeys headLines wtLines lineDelta
│ zh-CN   │ 22547      22542    5    0      0        0                  10            26965     26960   -5
│ zh-TW   │ 22547      22542    5    0      0        0                  10            26965     26960   -5
│ en      │ 22547      22542    5    0      0        0                  10            26998     26993   -5
│ ja      │ 22547      22542    5    0      0        0                  10            26988     26983   -5
│ ko      │ 22547      22542    5    0      0        0                  10            26977     26972   -5
✅ 五语对账全部通过(每语 -5 键 / +0 键 / 值零漂移 / 行数 -5)
```

- `lost` 集合逐语恰为 `{ide.topBar.skill, ide.topBar.mcpStore, ide.topBar.capabilityMarket, ide.topBar.skillsMarket, ide.topBar.connectors}`
- `gained = 0`、其余 **22542 枚键的值零漂移**(逐键 JSON.stringify 比对,防"顺手格式化"洗出隐藏改动)
- 每枚目标键出现次数:删除前 1 → 删除后 0(五语皆如此;`Object.keys` 计数,同层重复键会显 2,实测均为 1)
- 关于任务书"各语言行数相等":五份文件**在 HEAD 本来就互不相等**(26965/26965/26998/26988/26977,
  差在若干数组型 leaf 的行数),因此该不变量的正确形式是"**每语行数增量同为 −5**"且
  "**解析后叶子键总数五语相等 = 22542**"。两条都成立。按字面要求"五份行数彼此相等"则 HEAD 一开始就不满足,
  已如实登记而非凑数。
- `git diff --numstat`:五份全部 `0 5`(纯删五行,零新增)
- 塌块检查:块内仍剩 10 键 ⇒ 父块未塌成 `{}`(MEMORY 记录的"摘叶后父块塌成 {} 会被判一枚新死键"这一型在本票不存在)

---

## 3. 门与退出码

| # | 命令 | 退出码 | 关键读数 |
| --- | --- | --- | --- |
| 1 | `node scripts/check-i18n-keys.mjs`(全量) | **0** | `通过,已检查 1570 文件, 17796 键, 5 语言 parity OK` |
| 2 | `node scripts/check-i18n-keys.mjs --staged`(**临时索引**,主索引零触碰) | **0** | staged 恰为本票 5 份 |
| 2b | 同门阳性对照:临时索引只放 zh-CN 一份 | **1** ✅该红 | 点名 `ide.topBar.mcpStore / skill / skillsMarket …` ⇒ 证明门 2 的绿不是"空暂存恒绿" |
| 3 | `node scripts/check-i18n-duplicate-namespaces.mjs` | **0** | `无重复命名空间/重复键`(35 文件) |
| 4 | `node scripts/check-miniapp-tokens-sync.mjs` | **0** | `All 268 variables are in sync`(本票不动 token,按任务书复跑) |
| 5 | `node scripts/scan-i18n-zh-residue.mjs zh-TW` / `ko` | **0** / **0** | 无中文残留 |
| 6 | `node scripts/check-i18n-broken-en.mjs` | **0** | 0 处破碎英文 |
| 7 | `node scripts/check-word-table-resolvable.mjs`(门 74,blocking) | **0** | `每键在 5 语言 × 消费端合并视图 + 小程序离线包全部取到值` |

临时索引做法(§22d 无关,是"空暂存恒绿"的解法):
`GIT_INDEX_FILE=<o60r>/o60r.idx` → `git read-tree HEAD` → `git update-index --add -- <5 份>` → 跑 `--staged` → 清 env、删临时索引。
全程只写临时文件,未触碰主索引 / HEAD / 工作树。

### 干净检出复测(`git archive HEAD`,本机绿不算)

脚本 `.ihui-agent/tmp/o60r/cleanco.mjs`;MSYS 三坑按 MEMORY 处置:
`tar` 不吃 `-f -`(改 `git archive -o` 直写盘)、`G:\` 会被当远程主机(相对路径 + `cwd`)、
目标目录不自动建(先 `mkdirSync`)。**另撞到第四条并记入报告**:归档 >256MB 时
`execFileSync` 会 `ENOBUFS`(实测 77MB tar 全量面 268MB 上限被打穿)⇒ 必须 `-o` 落盘,不要走 stdout。
另加第五条:干净检出留在仓库树内时 `git rev-parse` 会向上逃逸到真仓 ⇒ 用
`GIT_CEILING_DIRECTORIES` 隔断(否则"HEAD 读的是真仓",对照失真)。

| 档 | 词包状态 | web | miniapp-taro | mobile-rn | cli | extension |
| --- | --- | --- | --- | --- | --- | --- |
| **A** 纯 HEAD(删之前) | 原样 | 死 key **0** | **1** | 0 | 0 | 0 |
| **B** 拟提交面 | 本票五语已删 | 死 key **0** | **1** | 0 | 0 | 0 |
| **C** 阳性对照 | B + 塞一枚必然无引用的键 | 死 key **1** | 1 | 0 | 0 | 0 |
| **D** 反向对照 | B + 把 `ide.topBar.skill` 加回 | 死 key **0** | 1 | 0 | 0 | 0 |

- **A ≡ B** ⇒ 本票删除**没有新增任何死键**(这是任务书要的"提交前干净检出"结论)。
- **C** ⇒ 尺子接上了、有牙(能报出 1 枚),B 的 0 不是"扫描动作失效"。
- **D ⇒ 权威扫描器对 `ide.*` 结构性盲视**:它的死键判据是
  `!staticRefs.has(k) && !isInUsedNamespace(k, usedNamespaces)`(`scripts/_i18n-scan-helpers.mjs:416-422,713`),
  而 `isInUsedNamespace` 只要**任一命名空间前缀**被 `useTranslations`/`getTranslations` 用过就把该前缀下的**全部 leaf 记活**。
  HEAD 有 48 个文件用 `useTranslations('ide')` ⇒ `ide.*` 整片永远算活 ⇒ **"死 key: 0" 对这 5 枚不构成任何证据**。
  本票的"证死"因此只能靠 §1 的取词点枚举,**不能**靠这道门;这条必须写进交付面,否则下一个人会把绿灯当豁免。
- 顺带量到:同一份检出里"动态 `t(prefix.${var})` 命中"= **96** 处(工作树报 99,差 3 处来自他人未提交文件)
  ⇒ 印证"本机绿≠HEAD 绿"。

---

## 4. 未做完 / 需主代理复核

1. **提交归主代理**(本票禁 git 写操作)。建议形态:`node scripts/safe-commit.mjs -m "chore(i18n): 回收 O60d/D17 遗留的 5 枚顶栏死键(五语对称删除)" -- packages/i18n/messages/web/zh-CN.json …(共 5 份)`。
   提交前请务必先跑 `node scripts/merge-live-doc.mjs --file …`?—— **本票不涉及三份活文档**,不需;
   本票已在收工时对新 HEAD 复跑过一遍(§1.7);若主代理落地时 HEAD 又前进,请照 §1.7 那三条命令再跑一次再 commit。
2. **A/B 档都红着的那 1 枚与本票无关,但会让 `pnpm check:all` 红**:`packages/i18n/messages/miniapp-taro` 的
   **`ai.chatMessageItem.downloadSuccess`** 在 HEAD 与工作树两侧都被判死(实测两处均为 1 枚)。
   ⇒ 根 `package.json` 的 `check:all` 链里那一段 `node scripts/scan-dead-i18n-keys.mjs --target all --exit 1`
   在本票之前就已经 exit 1(与本票无关)。别把它算成本票的账;要不要回收请另开票
   (它在 miniapp 包,不在本票允许清单内,**本票未动**)。
3. **顶层 `topBar` 命名空间疑似另一批孤儿(本票刻意没碰)**:`web/*.json` 顶层 `topBar{editor,close,plus,skillsMarket}`
   与 `shared/*.json` 顶层 `topBar{capabilityMarket}` 在全 HEAD 找不到任何 `useTranslations('topBar')`/根 `useTranslations()` +
   `t('topBar.…')` 的消费点(`ide-top-bar.tsx` 那些 `t('topBar.editor')` 绑的是 `ide` 命名空间,解析到 `ide.topBar.editor`)。
   **本票没有把它判死**,原因有两条:① 它不在任务书允许写入面内;② 顶层块的证据链比 `ide.topBar` 弱一档 ——
   根命名空间形态(`useTranslations()` 无实参 + 全路径字面量)的调用点散在多文件,要证死得再做一轮同样规模的枚举,
   而我这轮的穷尽性只覆盖到"`topBar` 子串的全部 33 处命中"这一层(那 33 处里确实没有顶层形态的消费点,
   但"顶层 `topBar` 块"与"`ide.topBar` 块"leaf 同名,单靠 grep 极易把两边的判定混着抄)。
   **另附一条给下一轮的前提**:shared 顶层 `topBar.capabilityMarket` **会进小程序离线包**
   (gen-i18n 的取材含 shared),所以那一票**必须**重跑 `pnpm --filter @ihui/miniapp-taro gen:i18n` —— 与本票不同。
4. **`ide.viewSwitcher.groupSettings` 仍然在用,别顺手删**:`view-switcher.tsx:59` 有
   `titleKey: 'viewSwitcher.groupSettings'`。它和那 5 枚键同批出现在 README/D17 交付说明里(README:959),
   很容易被下一个接手者按"同一批"一起清掉 —— 清了就是线上直出键名。已实测确认引用在位。
5. **守门 74/门 1 的读数在删除前后都通过**,但门 1 全量报的"键数"从 `17785`(D17 票记录)→ `17796` →
   本票 `17796`(计数口径与扫描器的 22547 不同,且期间他人也在改词包)⇒ 该数字**不可当基线用**,
   一切以解析后的键集合对账为准。
6. 轮次:本票约 20 轮工具调用内完成,未触及 40 上限。

## 5. 本票临时件清单(收尾可删)

全部在 `G:\IHUI-AI\.ihui-agent\tmp\o60r\` 下,均为本票所建(`head.tar` 与 `cleanco/` 已在取证后当场删除,
`parity-idx` / `o60r.idx` 两个临时索引亦已删除):

| 文件 | 用途 |
| --- | --- |
| `probe.mjs` | 删除前五语 `ide.topBar` 键集/行数读数(HEAD 与工作树双档) |
| `verify.mjs` | 删除后五语对账(lost/gained/值零漂移/行数 −5) |
| `cleanco.mjs` | `git archive HEAD` 造干净检出 + A/B/C/D 四向对照 |
| `untracked.txt` | `git status --porcelain` 未跟踪清单(用于 1.6 的在飞代码核查) |
| `wt-miniapp-dead.md` | 工作树 miniapp-taro 端死键报告(定位第 4.2 条那枚既有死键) |

`BRIEF.md` / `G1–G6.md` / `BACKLOG.md` 是同目录下其他会话(主台账票)的产物,**不属本票,未动、也不得由本票清理**。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
