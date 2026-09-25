<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D81 尾票 —— 四个孤儿符号的判决与落地(2026-09-25)

任务书:`.ihui-agent/tmp/o60r/BRIEF.md`(硬口径 1–5 / 已知的坑)。本轮全程 `git show HEAD:` /
`git grep ... HEAD` 判据;开工前先量了三个目标文件的「工作树 vs HEAD」关系(见 §改了什么 末段)。

结论一句话:**② ③ 判删除(渲染取证已证明现役在显示同样信息),`toolActivitySearchQuery` 随 ③ 一起删
(实测是共享层另一份取值表的严格子集),`groupToolActivitiesByConnector` 判接线并保留 —— 但真正的分组宿主在
`MessageItem.tsx`,不在本票允许写入清单内,故只落"可落的一半"并把另一半连取证交回主代理。**

---

## 逐符号判决与依据

### 符号 1:`ActivityDuration` — `apps/web/src/components/ai/tool-activity-line.tsx:55`

**判决:删除。** 依据 = 渲染取证(探针用例 ①②,改码前跑) + 第二份时长格式化器。

取证命令与输出:

```
$ cd /g/IHUI-AI && git grep -n "ActivityDuration" HEAD -- apps packages
HEAD:apps/web/src/components/ai/tool-activity-line.tsx:55:export function ActivityDuration({
(仅此 1 行,即定义处本身)

$ cd /g/IHUI-AI/apps/web && node ./node_modules/vitest/vitest.mjs run \
    src/components/ai/__tests__/d81-redundancy-probe.test.tsx
 ✓ D81 ② 现役活动条自行显示耗时(无需 ActivityDuration) > duration=2400 → 活动行文本含 "2.4s"(共享层 formatDuration 的产物)
 ✓ D81 ② 现役活动条自行显示耗时(无需 ActivityDuration) > 反向对照:不传 duration 时同一正则必须查不到(否则上一条断言无牙)
      Tests  6 passed (6)      ← 这一轮是在**未改一行宿主代码**时跑的
```

现役显示链(逐跳实测,非读注释):
`tool-call-card.tsx:923` `useLiveElapsed(status==='running', duration ?? null)`
→ `stream-ui.tsx:301` 非 running 时 `return doneMs`
→ `tool-call-card.tsx:1065` `elapsedMs={liveElapsed}` 喂 `StreamRow`
→ `stream-ui.tsx:169-172` `{formatDuration(elapsedMs)}`。
生产入参也实证在位(否则"能显示"只是理论):

```
$ git show HEAD:apps/web/src/components/chat/message-list/MessageItem.tsx | sed -n '982,995p'
  duration={tc.duration ?? tc.durationMs}
$ git show HEAD:apps/web/app/\(main\)/chat/share/\[id\]/PageClient.tsx | sed -n '174,186p'
  duration={tc.duration ?? tc.durationMs}
```

**加重判决的一条(两处算同一值必须共用一份实现)**:`ActivityDuration` 内部自带
`durationMs >= 1000 ? (durationMs/1000).toFixed(1)+'s' : durationMs+'ms'`,而活动条上那一档用的是
`progress-sections/foldable-section.tsx:56` 的 `formatDuration`(**多一档 `1m15s`**)。
即 ② 一旦接上,同一行会出现两个时长口径,且 >60s 时与现役分叉。探针第二条用例
(`duration=75000` → `1m15s`)就是把这一点钉在共享层口径上。

与现役的**唯一**差集是措辞:`workedForDuration` = 「用时 {duration}」vs 行上裸 `2.4s`。
措辞若真要加,正确做法是在 `StreamRow` 上立一档(现 `workedFor` 键 + `formatDuration` 已是活的组合,
见 `stream-ui.tsx:385`),不得把自带格式化器的原语加回来。这条差集由探针第 6 条用例显式量出并记录
(`expect(text).not.toContain('查询：…')` 同型断言)。

### 符号 2:`ActivitySearchQuery` — 同文件 `:75`

**判决:删除。** 依据 = 渲染取证(两枚检索工具都量到)+ §4 禁用原生 `title`。

```
$ git grep -n "ActivitySearchQuery" HEAD -- apps packages
HEAD:apps/web/src/components/ai/tool-activity-line.tsx:75:export function ActivitySearchQuery({

$ node ./node_modules/vitest/vitest.mjs run src/components/ai/__tests__/d81-redundancy-probe.test.tsx
 ✓ D81 ③ 现役活动条自行显示查询词(无需 ActivitySearchQuery) > file_search:args.query 逐字落在活动行上
 ✓ D81 ③ 现役活动条自行显示查询词(无需 ActivitySearchQuery) > search_codebase:args.query 逐字落在活动行上
 ✓ D81 ③ 现役活动条自行显示查询词(无需 ActivitySearchQuery) > 反向对照:无 query 入参时 subject 位为空(证明上一条测的就是查询词)
```

现役链:`tool-display.ts:210-211` `file_search / search_codebase → 'query'` →
`describeToolCall().subject` → `StreamRow subject`(`stream-ui.tsx:145-155`,带
`data-stream-subject="true"` 与等宽类目)。探针断的是 subject 位的 `textContent` **逐字含查询串**,
不是"页面上找得到这串字"。

附带:该原语 `title={query}` 直接违反 AGENTS §4「禁用原生提示窗」。**因删除而无需改 Tooltip**
(任务书第 4 条只在保留时才适用)。

已知差异如实登记:subject 走 `normalizeSubject` 的 `SUBJECT_MAX = 160` 字符截断(tool-display.ts:240-246),
而 ③ 靠 CSS truncate + `title` 兜长文本。>160 字符的查询词在现役会被截断 —— 但 ③ 的兜法是违规 `title`,
不构成保留依据;真要处理应在 subject 层加 Tooltip,单列在下节。

### 符号 3:`toolActivitySearchQuery` — `packages/shared/src/chat/tool-category.ts:181`

**判决:删除**(随 ③ 同批;它唯一服务对象已不存在)。核心依据是**可 machine-check 的"删的是子集,不是能力"**:

```
$ node -e "...解析两张键表并比集合..."
SEARCH_QUERY_KEYS 7 query|keyword|keywords|q|search_term|pattern|prompt
SUBJECT_KEYS.query 10 query|keyword|keywords|pattern|q|search_term|prompt|description|selector,target
subset? true extra in subject keys: description,selector,target
```

即它与 `tool-display.ts` 的 `SUBJECT_KEYS.query` 是**同一件事的第二份取值表**,且覆盖更窄
(取不到 `description` / `selector` / `target`)。删除的等价性由新增的共享层用例逐键钉死:

```
$ cd packages/shared && node ./node_modules/vitest/vitest.mjs run src/chat/__tests__/connector-grouping.test.ts
 ✓ 查询词取值唯一入口(D81 ③ 删除 toolActivitySearchQuery 的等价证明) > args.query / args.keyword / args.keywords / args.q /
   args.search_term / args.pattern / args.prompt 经 describeToolCall 仍可取到(不丢键)   ← 7 条逐键
 ✓ 反向对照:一枚键都取不到时 subject 为空串(证明上一条不是恒真)
 ✓ 第二份查询词键表不得回升:toolActivitySearchQuery 必须仍不在导出面
      Tests  15 passed (15)
```

### 符号 4:`groupToolActivitiesByConnector` — 同文件 `:220`

**判决:接线(保留,不删)。** 依据 = 任务书第 2 条的前件成立:

```
$ git show HEAD:apps/web/src/components/ai/tool-call-card.tsx | sed -n '1079,1085p'
          {connectorName !== '' ? (
            <ActivityConnectorGroupLabel
              connector={connectorName}
              direction={FILE_WRITE_TOOLS.has(toolName) ? 'write' : 'read'}
            />
```

⇒ 方向确实是宿主在 `tool-call-card.tsx` 里自己拆的(虽然方向**判定**已复用共享 `FILE_WRITE_TOOLS`,
HEAD 实测 9 处/4 文件活着,不是端内另立)。任务书据此要求"用起来而不是删掉",我照此**不删**。

本轮在允许清单内落下的"真的一半":
**方向档位类型收口到共享层** —— `ActivityConnectorGroupLabel` 的形参原写端内字面量联合
`'read' | 'write'`,现改为 `import type { ConnectorDirection } from '@ihui/shared/chat'`。
它就是 `ConnectorActivityGroup.direction` 与分组键 `${connector}::${direction}` 的另一半,
端内自立即两份真相。由回归锁钉住:

```
expect(primitives).toMatch(/direction:\s*ConnectorDirection/u)
expect(primitivesCode).not.toMatch(/direction:\s*'read'\s|\s*'write'/u)
```

**我没有给它造一个"单元素数组"的假消费者**,理由写进了源码注释与本报告:
本函数的语义是**跨条目聚合**(`EMPTY_CONNECTOR` 桶、方向缺省折叠、组排序),
真宿主必须看到同一消息里的多枚工具卡;而那个列表在
`apps/web/src/components/chat/message-list/MessageItem.tsx:914` 的 `m.toolCalls?.map()` ——
**不在本票允许写入清单**。用单元素调用把 `git grep -c` 从 1 变成 2,产出的正是 BRIEF 硬口径第 4 条
点名的那种"命中数>0 就当已实现"的假装车证明。当前消费面如实登记:

```
$ grep -rl "groupToolActivitiesByConnector" apps packages --include=*.ts --include=*.tsx
apps/web/src/components/ai/tool-activity-line.tsx            ← 仅注释(状态说明)
packages/shared/src/chat/__tests__/connector-grouping.test.ts ← 契约测试(6 条)
packages/shared/src/chat/tool-category.ts                     ← 定义处
⇒ 生产消费者 = 0(未闭环);测试消费者 = 1(不构成闭环证据)
```

已为该函数补齐 6 条契约用例(分组/分向/`__none__` 桶/方向折叠/输出顺序确定/空数组),
让下一位接线者不必边接边猜语义 —— 尤其 **`__none__` 桶绝不能被当连接器名打给用户**。

---

## 探针用例钉住了什么

文件:`apps/web/src/components/ai/__tests__/d81-redundancy-probe.test.tsx`(新建,6 条,全绿)。
取词 mock 读**真实** `packages/i18n/messages/shared/zh-CN.json`,断的是线上文案而非 mock 编的串。

| # | 钉住的行为 | 有牙的反向对照 |
| --- | --- | --- |
| 1 | `duration=2400` → 行文本含 `2.4s`;`duration=75000` → 含 `1m15s` | 第 2 条:不传 duration 时两个正则**都查不到** |
| 2 | (同上的反向) | — |
| 3,4 | `file_search` / `search_codebase` 的 `args.query` 逐字落进行文本 **且**落在 `[data-stream-subject]` 位 | 第 5 条:无 query 入参时 subject 位为**空串** |
| 5 | (同上的反向) | — |
| 6 | ③ 的措辞键 `searchWithQuery`(「查询：{query}」)**没有**被现役路径使用 ⇒ ②③ 与现役只差措辞、不差信息 | 同条内含 `toContain(query)` 正向半边 |

它把判决从"读注释觉得重复"换成"在同一条渲染链上量到现役已出该信息";
第 2、5 条是防止探针退化成"页面上本来就有这串字"的假绿。
另有两条**改码后再跑**的锁:`tool-activity-line-wiring.test.tsx` 新增的
「②③ 原语面与宿主面都不得回升」(剥注释后判代码面)与
`connector-grouping.test.ts` 的「`toolActivitySearchQuery` 必须仍不在导出面」。

---

## 改了什么

| 文件 | 动作 | numstat(vs HEAD) |
| --- | --- | --- |
| `apps/web/src/components/ai/tool-activity-line.tsx` | 删 `ActivityDuration` / `ActivitySearchQuery`;头注写明"为何是删冗余"+ 改法指引;`ActivityConnectorGroupLabel.direction` → 共享 `ConnectorDirection` | 18 / 43 |
| `packages/shared/src/chat/tool-category.ts` | 删 `toolActivitySearchQuery` 与其专属 `SEARCH_QUERY_KEYS`,原位留"唯一入口是 `describeToolCall().subject`"的防回升注释;`groupToolActivitiesByConnector` 段头登记真实接线状态 | 14 / 30 |
| `apps/web/src/components/ai/__tests__/d81-redundancy-probe.test.tsx` | **新建**(渲染取证) | untracked |
| `packages/shared/src/chat/__tests__/connector-grouping.test.ts` | **新建**(分组契约 + 删键等价证明) | untracked |
| `apps/web/src/components/ai/__tests__/tool-activity-line-wiring.test.tsx` | 纯新增 1 条回归锁 | 22 / 0 |

`apps/web/src/components/ai/tool-call-card.tsx` **未改**(它 import 的 4 个原语无一被删,改它只会加噪声)。

两个新文件均已 `node scripts/watermark.mjs inject` 并 `verify` 通过(§5c)。

**开工前的工作树对账**(BRIEF 硬口径第 1 条 + §12d):
`tool-activity-line.tsx`、`tool-call-card.tsx` 开工时 `worktree == HEAD`(已量,安全);
`tool-category.ts` 开工时**已存在 1 行非我作者的格式化漂移**
(`const connector = …` 被并成一行,`git diff --numstat HEAD` = `1 2`)。
我**没有**回退它(那是替别人改文件),只登记:我的提交里这一行不是我的改动。

---

## 词包后续动作(交主代理串行执行)

本轮**零** `packages/i18n/**` 改动、**零** `apps/miniapp-taro/src/i18n/generated/**` 改动。
以下两枚键随 ②③ 删除变死键(全仓复测,五语包体本身除外):

```
$ git grep -c "workedForDuration" HEAD -- apps packages | grep -v packages/i18n   ← 删前:tool-activity-line.tsx 2 命中
$ git grep -c "searchWithQuery"   HEAD -- apps packages | grep -v packages/i18n   ← 删前:tool-activity-line.tsx 1 + tool-category.ts 1
(删除后)workedForDuration -> packages/i18n/messages/shared/{en,ja,ko,zh-CN,zh-TW}.json 各 1,代码侧 0
          searchWithQuery  -> 同上,代码侧 0
```

| 键 | 为什么死 | 位置 |
| --- | --- | --- |
| `taskStatus.workedForDuration` | 唯一取用者是已删的 `ActivityDuration`;行级耗时由 `StreamRow` 的 `formatDuration` 呈现,组级另有活键 `workedFor`(`stream-ui.tsx:385`、`plan-steps-card.tsx:138`) | `packages/i18n/messages/shared/{zh-CN,zh-TW,en,ja,ko}.json` |
| `taskStatus.searchWithQuery` | 唯一取用者是已删的 `ActivitySearchQuery`;其配套取值函数 `toolActivitySearchQuery` 同批删除 | 同上五语 |

**五语对称删除 + 离线包重生成 + 该跑的门**(建议顺序,勿跳步):

1. 确认另一路回收孤儿键的代理**已收尾**(任务书明写并发写同一批语言包必出事故);先跑
   `git status --porcelain -- packages/i18n` 应为空。
2. 用**干净检出**先量一次死键(共享工作树滞后 HEAD 会产出假阴性/假阳性,§"共享语言包提交前用干净检出测死键"):
   `git archive HEAD | tar -x -C <scratch>` 后在检出里跑权威死键扫描器
   (`node scripts/scan-dead-i18n-keys.mjs --target all --exit 1`,
   别名入口 `scripts/scan-web-dead-i18n-keys.mjs` 只是转发器)。
   预期:两枚键出现在死键清单,且**只有**这两枚是本轮新增的。
3. 五语**同一对象层**逐语删同名键(禁只删 zh-CN;守门 2/2b–2e 会打 parity/字形/残留)。
   注意同层重复键(守门 `2e-dupns`)。
4. 重生成小程序离线包:**权威入口实测为 `pnpm --filter @ihui/miniapp-taro gen:i18n`**
   (= `apps/miniapp-taro/scripts/gen-i18n-compressed.mjs`,自带水印注入;根 `package.json`
   **没有** `gen:i18n` 这个脚本 —— 实测取键得 `(absent)`,别按文档里的裸 `pnpm gen:i18n` 跑,
   那条在本机跑不通)。缺这一步守门 56 `check-tool-display-resolvable` 的 W4 会红。
5. 该跑的门(逐条取退出码,勿用管道 `$?`):
   `node scripts/check-i18n-keys.mjs` ·
   `node scripts/scan-i18n-zh-residue.mjs` · `node scripts/check-i18n-broken-en.mjs` ·
   `node scripts/check-word-table-resolvable.mjs`(74) ·
   `node scripts/check-miniapp-tokens-sync.mjs`(36,若离线包体动了) ·
   `node scripts/scan-dead-i18n-keys.mjs --target all --exit 1`。
6. 顺带一句判断留给主代理(不属本票):`workedFor` 与 `workedForDuration` 语义重叠,
   若将来要在活动条上加"用时"措辞,**复用 `workedFor`** 而不是复活 `workedForDuration`。

---

## 验证末行

```
$ cd /g/IHUI-AI/apps/web && node ./node_modules/vitest/vitest.mjs run \
    src/components/ai/__tests__/d81-redundancy-probe.test.tsx \
    src/components/ai/__tests__/tool-activity-line-wiring.test.tsx
WEB_EXIT=0
 ✓ src/components/ai/__tests__/tool-activity-line-wiring.test.tsx (6 tests) 50ms
 ✓ src/components/ai/__tests__/d81-redundancy-probe.test.tsx (6 tests) 37ms
 Test Files  2 passed (2)
      Tests  12 passed (12)
   Duration  6.64s

(宿主回归另跑整目录)Test Files  41 passed (41) / Tests  419 passed (419)

$ cd /g/IHUI-AI && pnpm --filter @ihui/shared test      # 该包入口 = vitest run
SHARED_EXIT=0
 Test Files  57 passed (57)
      Tests  1286 passed (1286)

$ cd /g/IHUI-AI && pnpm --filter @ihui/web typecheck
EXIT=2
=== per-file attribution ===
     15 src/components/ai/progress-sections/__tests__/tool-category.test.ts
      6 src/components/chat/message-input.tsx
      3 src/components/ai/progress-sections/__tests__/tool-call-summary-category.test.tsx
      2 src/config/desktop-feed-payload.ts
      2 src/components/chat/voice-note.tsx
      2 app/
      1 src/hooks/use-prompt-drafts.ts
      1 src/hooks/__tests__/use-prompt-drafts.test.tsx
      1 src/components/ai/progress-sections/tool-category.ts
=== errors in MY files ===
(none above = 0 errors in my files)
--- 交叉核对:报错文件集 ∩ 我改的文件集 = 空;报错文件对被删符号 0 引用 ---

$ cd /g/IHUI-AI && pnpm --filter @ihui/shared typecheck
SHARED_TYPECHECK_EXIT=0   /  error TS 计数:0

$ node scripts/check-shared-layer-duplication.mjs        # 门 40
GATE40_EXIT=0  ✅ 共享层重复检测通过:未发现端内独立实现 shared 已提供的 hook
$ node scripts/check-word-table-resolvable.mjs           # 门 74
GATE74_EXIT=0  ✅ 每键在 5 语言 × 消费端合并视图 + 小程序离线包全部取到值

$ node scripts/watermark.mjs verify <两个新文件>
VERIFY_EXIT=0  纳入口径的文件均已携带完整溯源水印。

$ eslint <我改的 5 个文件>(web 面 + shared 面,shim 实测 v10.8.1)
LINT_WEB_EXIT=0  /  LINT_SHARED_EXIT=0

$ git status --porcelain -- <本票 6 个相关路径>
 M apps/web/src/components/ai/__tests__/tool-activity-line-wiring.test.tsx
 M apps/web/src/components/ai/tool-activity-line.tsx
 M packages/shared/src/chat/tool-category.ts
?? apps/web/src/components/ai/__tests__/d81-redundancy-probe.test.tsx
?? packages/shared/src/chat/__tests__/connector-grouping.test.ts
(本票 6 个相关路径之外,整棵树另有大量他人在飞改动,且**在本轮期间仍在增长**:
`git status --porcelain | wc -l` 开工后量到 99,收尾复量 236 ⇒ 高并发窗口,提交务必走
逐路径声明的 safe-commit;本票未做任何 git 写操作)
```

未跑且刻意不跑:`scripts/check-rn-global-css-sync` 那套镜像测试(任务书说明其 14 条红来自另一会话的
取材层迁移,与本票无关,不去修)。

---

## 未做完 / 需主代理复核

1. **`groupToolActivitiesByConnector` 的生产接线未完成 —— 这是本票唯一实打实的敞口。**
   落地位置 `apps/web/src/components/chat/message-list/MessageItem.tsx:914`(`m.toolCalls?.map()`),
   在本票禁写清单内。要做的是:把同一消息里的工具卡按 `ConnectorActivityItem[]`
   (`id`/`connector`/`direction`/`label`)喂 `groupToolActivitiesByConnector`,方向取
   `FILE_WRITE_TOOLS.has(toolName)`,连接器名沿用现规则
   (`serverSource === 'mcp' || 'plugin' ? serverName ?? serverId : ''`),
   在每组首行前渲染 `ActivityConnectorGroupLabel`,并
   **(a)** 把 `connector === '__none__'` 的组**不渲染分组头**;
   **(b)** 迁移后删掉 `tool-call-card.tsx:1079-1085` 的逐行标签(否则同一信息出现两遍);
   **(c)** 补一条 `MessageItem` 层的渲染用例。契约已由 `connector-grouping.test.ts` 6 条钉死。
   做完这一步之前,`D81 ⑤` 在台账上应记"逐行注解已接、分组头未接",不得记整项收口。
2. **两枚死键未删**(`workedForDuration` / `searchWithQuery`),按任务书约束交主代理串行,
   步骤见上节;现状:代码侧 0 引用、五语包体各 1 处。
3. **>160 字符查询词的截断**:`StreamRow` subject 有 `SUBJECT_MAX=160` 截断,被删的 ③ 靠违规 `title`
   兜长文本。删除没有让这件事变坏(截断行为不变),但"长查询词看不全"这个缺口现在**无人负责**。
   若要补,应在 subject 层挂项目 `Tooltip`(§4 唯一合法形态),而不是复活 ③。属新增能力,按 §24
   须用户确认后再动,故本票未动。
4. **归属待主代理确认**:`packages/shared/src/chat/tool-category.ts` 开工前即带 1 行非我作者的
   格式化漂移(见「改了什么」表下),我的 diff 里含它。主代理提交时若想把它摘掉,请用
   `git diff HEAD -- <该文件>` 逐块核对,不要整文件回写(§12d)。
5. **本票文件集实测恰为 5 个**(3 改 + 2 新建,两个新文件仍未跟踪 `??`),本票禁 git 写操作;
   提交时请按 §12 用 `node scripts/safe-commit.mjs -m "..." -- <上述 5 个路径>` 逐个声明,
   勿 `git add -A` / `-A` / `-u`(收尾复量整棵树有 231 项他人在飞改动,批量加必然连带污染)。
   末次核对:`git status --porcelain -- <本票路径>` 恰 3 ` M` + 2 `??`,无第 6 项。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
