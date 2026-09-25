<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D81 活动条目双时态语法 —— ②~⑥ 半票处置报告(2026-09-25)

## 0. 结论:走 **路线 A**(接进真实渲染宿主),已装车

`apps/web/src/components/ai/tool-activity-line.tsx` 是"为票面 ②~⑥ 预建但没接"的形态，
**不是**被别的实现取代：它需要的 8 个词表键**五语言已全部入库**（见 §4），
共享层判定函数 `toolActivitySearchQuery` / `groupToolActivitiesByConnector` / `FILE_WRITE_TOOLS`
也都在位且**同样零消费者**。缺的只有"渲染宿主 import 并渲染"这一步 —— 正是本票要补的那一步。

---

## 1. 第一步：两种口径各量一遍（上一轮把这两者混过）

| 口径 | 命令 | 实测输出 |
| --- | --- | --- |
| **按内容搜**（谁在文本里提到这个名字） | `git grep -l -I "tool-activity-line" HEAD` | 5 命中：`PROJECT_PLAN.md`、`docs/plan-audit-2026-09-25/report-1.md`、`tools/{recheck,round2,wiring}.mjs` —— **全是文档与审计脚本，无一个源码 importer** |
| **按路径列**（仓库里有哪些同名文件） | `git ls-tree -r --name-only HEAD \| grep tool-activity-line` | 2 命中：`apps/cli/tests/tool-activity-line.test.ts`、`apps/web/src/components/ai/tool-activity-line.tsx` |

⇒ 两个口径合起来才说明问题：**文件在库 ∧ 零 importer**，而不是"文件不存在"。

补充三问（证明不是"被别人取代"）：

- **无动态引用**：`git grep -nI -E "(import\(|require\()[^)]*tool-activity-line|from ['\"][^'\"]*tool-activity-line" HEAD` → **0 命中**。
- **无契约消费者**：`packages/shared/src/sse/contract.ts` 内不出现这 6 个导出名（`git grep` 全量命中仅文件自身 6 行 export + 文档）。
- **无词表消费者**：6 个导出名在全仓只命中自身定义行；同族符号 `toolActivitySearchQuery` 也只命中 `packages/shared/src/chat/tool-category.ts:181` 定义处。

## 2. `apps/cli/tests/tool-activity-line.test.ts` 到底测什么

**测的是另一枚同名不同实现的东西**：它 `import { describeToolActivityLine, toolActivityLabel } from '../src/commands/task-status-line.js'`
（`apps/cli/tests/tool-activity-line.test.ts:10`），即 CLI 侧的纯函数
`apps/cli/src/commands/task-status-line.ts:232-243`（`ToolActivityLineParts` / `describeToolActivityLine`），
被 `apps/cli/src/commands/repl.ts:2491,2517` 消费 —— **它是有主的现役代码**，与 web 那个 `.tsx` 组件
只是文件名撞名。本票**未改**该测试（无需改），末行验证见 §5。

## 3. 装车点（唯一渲染宿主：`apps/web/src/components/ai/tool-call-card.tsx`，开工前 `git status` 判净）

| 票面项 | 原语 | 宿主消费点 |
| --- | --- | --- |
| ④ 长输出展开/收起 | `ActivityCodeBlock` | `tool-call-card.tsx:1198`（result 块，取代原 `StreamCode`，沿用 `testId="tool-call-result"`） |
| ⑤ sourcesButton | `ActivitySourcesButton` | `tool-call-card.tsx:310`（`CitationsBlock` 内，配 `:249` 去掉原先"抽取即截断"的 `slice(0, 8)`） |
| ⑤ 连接器读写分组标签 | `ActivityConnectorGroupLabel` | `tool-call-card.tsx:1081`（方向判定取共享层 `FILE_WRITE_TOOLS`，`tool-display.ts:5` 同源，**未在端内另立判据**） |
| ⑥ 取消态可辨识条目 | `ActivityCanceledLabel` | `tool-call-card.tsx:1079`（活动条**下方常驻一行**，不依赖展开；行内既有「已撤回」徽章只交代状态，这里补"被取消的是哪一个动作"） |
| import 声明 | — | `tool-call-card.tsx:34-38` |

顺带真修掉一处数据丢失：`extractCitations` 此前 `return Array.from(new Set(out)).slice(0, MAX_CITATIONS)`
（HEAD 原第 231 行）—— 第 9 条起的引用**在源头就被丢掉**，界面无任何途径抵达，正是票面 ④ 点名的
"截断即丢"。现返回全量、由 `CitationsBlock` 折叠到 8 条 + 「来源 (N)」按钮展开，用例断"全部可达"。

## 4. 待补键：**无**

②~⑥ 需要的 8 个键（`workedForDuration` / `searchWithQuery` / `showAllLines` / `hideLines` /
`sourcesButton` / `canceledItemLabel` / `readingConnector` / `writingConnector`）**已存在于
`packages/i18n/messages/shared/{zh-CN,zh-TW,en,ja,ko}.json` 的 `taskStatus` 命名空间**，
web 端经 `apps/web/src/i18n/request.ts:27` `mergeMessages(shared*, web*)` 深度合并可见。
⇒ 本票零 i18n 改动，WAVE2 §1 约束天然满足。
（英文对照：`Show all` / `Collapse` / `Sources` / `Canceled: {name}` / `Read from {connector}` /
`Written to {connector}` / `Took {duration}` / `Query: {query}`。）

## 5. 验证（命令 + 末行输出原文）

```
$ pnpm --filter @ihui/web exec vitest run src/components/ai/__tests__/tool-activity-line-wiring.test.tsx
 ✓ src/components/ai/__tests__/tool-activity-line-wiring.test.tsx (5 tests) 81ms
 Test Files  1 passed (1)
      Tests  5 passed (5)

$ pnpm --filter @ihui/web typecheck      # 按文件 uniq 区分他人既有红
$ ... | grep -E "tool-call-card|tool-activity-line"
(no lines above = my files 0 errors)
# 他人既有红(与本票无关，且两次跑清单本身在漂——他人正在改)：
#   15 src/components/ai/progress-sections/__tests__/tool-category.test.ts
#    6 src/components/chat/message-input.tsx
#    3 .../tool-call-summary-category.test.tsx   2 src/config/desktop-feed-payload.ts
#    2 src/components/chat/voice-note.tsx        2 .../ai/business-form-section.tsx
#    2 app/(main)/ai-news/components/PriceChart.tsx
#    1 src/hooks/use-prompt-drafts.ts  1 src/hooks/__tests__/...  1 progress-sections/tool-category.ts

$ pnpm --filter @ihui/cli exec vitest run tests/tool-activity-line.test.ts
 ✓ tests/tool-activity-line.test.ts (5 tests) 13ms
 Test Files  1 passed (5)  →  Tests 5 passed (5)

$ 宿主回归(既有 5 个用例文件)
 ✓ tests/message-list.test.tsx (41 tests)  ✓ tool-call-rollback-badge.test.tsx (11)
 ✓ tool-call-card.test.tsx (20)  ✓ tool-call-card-activity.test.tsx (3)  ✓ tool-call-card-mcp-activity.test.tsx (3)
 Test Files  5 passed (5)      Tests  78 passed (78)

$ pnpm exec prettier --write <两文件> && pnpm exec eslint --fix <两文件>
eslint rc=0
$ node scripts/watermark.mjs inject apps/web/src/components/ai/__tests__/tool-activity-line-wiring.test.tsx
[watermark:inject] ... → injected

$ git -c safe.directory=* status --porcelain -- <四个允许清单文件>
M apps/web/src/components/ai/tool-call-card.tsx
?? apps/web/src/components/ai/__tests__/tool-activity-line-wiring.test.tsx
# ⇒ 未越界：tool-activity-line.tsx 与 cli 测试均未被改动
```

新用例（`apps/web/src/components/ai/__tests__/tool-activity-line-wiring.test.tsx`，5 例）断的都是
"宿主真的渲染了它"，不是组件自测：④ 折叠→点「展开全部」后 `textContent === 全文`（不是只测按钮在）
+ `aria-expanded` 翻转；⑤ 12 条引用先只见 8 条、点「来源 (12)」后 12 条齐；⑥ 取消态标签**不展开也可见**
且文案里是本地化动作名、无 `{name}` / 键名残迹（守门 74 口径）；⑤ mcp `read_file`→`data-direction=read`、
`write_file`→`write`；末例用 `readFileSync` 反向钉死宿主必须 `from './tool-activity-line'`（防"造好没装车"回潮）。

## 6. 剩余缺口（**未做完的，如实登记**）

1. **② `ActivityDuration` / ③ `ActivitySearchQuery` 两个原语本票仍未接**，因为它们与现役实现**功能等价**，
   接上去就是同一行显示两遍耗时 / 两遍查询词：
   - ② 活动级耗时：`StreamRow` 已在 `stream-ui.tsx:169-173` 渲染 `elapsedMs`（宿主 `tool-call-card.tsx:1038`
     传 `liveElapsed`，running 期间 250ms tick、结束后由后端 `durationMs` 接管），`ActivityDuration` 是第二份。
   - ③ 查询词上条：`describeToolCall` 对 `web_search`/`search_codebase`/`knowledge_lookup`/`context_recall`…
     已把 `subjectKind` 定为 `'query'`（`packages/shared/src/chat/tool-display.ts:202-209`），
     `StreamRow` 对 `query` 档加 `font-mono` 渲染 subject（`stream-ui.tsx:150-158`）—— 查询词**已经在活动条上**。
     差异仅是没有 `查询：` 前缀措辞。
   **建议主代理二选一**：(a) 判 ②③ 为"已由现役实现覆盖"并删这两个 export；
   (b) 要"查询：{query}"这种带措辞的形态，则改 `StreamRow` 让 subject 走 ICU 措辞（属 stream-ui 的改动，
   不在本票允许清单内，我没动）。
2. `tool-activity-line.tsx` 里 `ActivitySearchQuery` 用了 `title={query}`（HEAD 原样，本票未碰）——
   与 §4"禁用 `title` 属性提示"冲突；若按第 1 条 (a) 删掉该原语即自动消失，否则需改为项目 `Tooltip`。
3. **D81 第①项（词表 + 守门）确认为已接线，本票未重做**；票面 ⑦（活动条目内渲染 workflow）
   与 D34/D81⑦ 同批，未动。
4. `CitationsBlock` 有一条**既有** React 警告（`<Tooltip>` 列表子元素缺 `key`，HEAD 即如此，非本票引入），
   一行可修，但不在本票范围，留给邻居票次轮处理。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
