<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D85 自动审查统计条 — 补验收用例(交付报告)

日期:2026-09-25 · 批次:WAVE2 · 负责人:编码代理(本文件由主代理代收)

## 1. 改了什么

**唯一新增文件**:`apps/web/src/components/ai/__tests__/review-stats-bar.test.tsx`(4 用例)
**实现零改动**:`apps/web/src/components/ai/agent-task-progress-pane.tsx` 与
`packages/shared/src/chat/step-decision.ts` 开工前 `git status --porcelain` 均为空,交付时仍为空
(变异自证期间的单行改动已逐字还原,见 §4)。未改任何 i18n 词包。

## 2. 现状复核(动代码前自测,与派单说明一致)

- 实现件在库且已渲染:`deriveReviewStats`(:637)/ `ReviewStatsBar`(:660)/
  挂载点 `apps/web/src/components/ai/agent-task-progress-pane.tsx:1781`
  `<ReviewStatsBar steps={runtimePlanSteps} />`,同块 :1783-1784 用**同一份** `runtimePlanSteps`
  渲染逐条徽章 `RuntimeStepRow`(:575)。
- `git grep -E "review-stats|deriveReviewStats|ReviewStatsBar" HEAD -- apps/web/tests` → 空
  ⇒ 票面两条验收此前确实零用例。
- `git grep -ln ReviewStatsBar -- apps/web` → 唯一命中 **`apps/web/src/components/ai/agent-task-progress-pane.tsx`**
  (命中含渲染宿主,非"造好没装车")。
- 词包键在位(只读复用,无新增键):`web/zh-CN.json` `ai.pane.reviewStats.{title,accepted,rejected,noReason,noReasonText,noDecision,commandHistory,expandAria}`;
  `shared/zh-CN.json` `stepDecision.decision.*`。

## 3. 用例清单

| # | 用例 | 钉住的判据 |
| - | ---- | ---------- |
| 1 | 统计计数与逐条徽章同源 | 夹具 8 步(3 approved / 2 rejected / 1 unknown / 2 未过闸门)。DOM 读出的 `已接受 N`、`已拒绝 N`、`未提供理由 N` 必须等于用 `@ihui/shared/chat` 的 `stepDecisionState` **在测试里独立分类**同一组 steps 的计数;展开区 `[data-decision-state="approved"]`/`"rejected"` 的**徽章枚数**也必须等于同一数;`deriveReviewStats(steps)` 的纯函数结果必须与 DOM 读数逐字段等值(排除渲染层另算一份)。另断言夹具本身 accepted≠rejected,防退化成空转。 |
| 2 | 改了 steps 统计跟着变 | `rerender` 换成 5 步(1 accepted / 3 rejected / 1 未过闸门),三档数值必须全部翻过去且与独立分类一致(排除 `useMemo` 依赖漏了 steps 的缓存钉死)。 |
| 3 | `自动审查未提供理由` 显式缺省 | 3 步(两条 reason 分别为 `null` / `""`,一条有真 reason)。展开后:缺省条数=2;两条形如 `决策徽章 + 工具名 + 文案` 的行文本必须**等于词包 `ai.pane.reviewStats.noReasonText` 的取值**(非空白);**不得含 `noReasonText` / `reviewStats.` 键名**;**不得回退成英文码名**(整块历史区不匹配 `\b(auto_skip_approval|execute_tool)\b`,也不出现 `decision.` 键形态);有 reason 的那条必须显示 reason,不被缺省顶掉。 |
| 4 | 负向对照:未过闸门不计数 | 5 步含 2 步 `decision: null/""` 与 1 步词表外怪值 ⇒ `hasDecision=3`、`accepted=1`、`rejected=1`、`unknown=1`,统计条读数与展开区徽章枚数都只认 3 步;再渲染空 steps ⇒ 只出"暂无自动审查记录"文案,**不出任何计数标签**(计数标签为 null)。 |

文案一律从真实词包取(`vi.hoisted` 里读 `packages/i18n/messages/{web,shared}/zh-CN.json` 并实现
`{n}` 插值,`vi.mock('next-intl')` 用同一份取词器),**测试文件里没有任何中文字面量** —— 界面直出
键名或硬编码中文都会当场判红。

## 4. 验证(命令 + 末行原文)

```
$ cd apps/web && node ./node_modules/vitest/vitest.mjs run src/components/ai/__tests__/review-stats-bar.test.tsx
 ✓ src/components/ai/__tests__/review-stats-bar.test.tsx (4 tests) 134ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  5.18s
```

变异自证(三次;`agent-task-progress-pane.tsx:650` 的 `acc.accepted += 1` 临时改成 `+= 0` 使计数恒为 0,跑完逐字还原):

```
① 基线绿   :  Test Files  1 passed (1)  |  Tests  4 passed (4)
② 变异红   :  Test Files  1 failed (1)  |  Tests  3 failed | 1 passed (4)   ← 同源/rerender/负向对照三条全红
③ 还原绿   :  Test Files  1 passed (1)  |  Tests  4 passed (4)
还原核验   :  git status --porcelain -- apps/web/src/components/ai/agent-task-progress-pane.tsx  → 空输出
```

```
$ pnpm --filter @ihui/web typecheck
G:\IHUI-AI\apps\web:
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @ihui/web@0.0.0 typecheck: `tsc --noEmit`
Exit status 2
→ 本票文件命中 0(grep -c "review-stats-bar" 于 tsc 输出 = 0;修前为 3 处 noUncheckedIndexedAccess 类错误,已修)
→ 他人既有红 37 处,分布:src/components/ai/__tests__/tool-activity-line-wiring.test.tsx、
  progress-sections/{tool-category.ts,__tests__/tool-category.test.ts,__tests__/tool-call-summary-category.test.tsx}、
  src/components/chat/{message-input.tsx,voice-note.tsx}、src/config/desktop-feed-payload.ts、
  src/hooks/{use-prompt-drafts.ts,__tests__/use-prompt-drafts.test.tsx}
```

```
$ node scripts/check-i18n-keys.mjs --staged
[i18n 键检查] 无源文件变更,跳过          (本票未 staged 任何东西,主代理提交时会真跑)
$ node scripts/watermark.mjs verify apps/web/src/components/ai/__tests__/review-stats-bar.test.tsx
[watermark:verify] 覆盖 1/1 个指定文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 跳过 0 个
$ node_modules/.bin/eslint src/components/ai/__tests__/review-stats-bar.test.tsx   (apps/web 下)
(无输出 = 零告警,含 no-explicit-any)
```

## 5. 未做完 / 需主代理决策

1. **`RuntimeStepRow` 未导出**,所以"统计 vs 逐条徽章"的同源只能经两条等价路径钉:
   ①测试内直接调 `stepDecisionState`(即徽章与统计共同调用的共享判据);②统计条自身展开区的
   `data-decision-state` 徽章枚数。真正的跨组件对账(渲染 `AgentTaskProgressPane` 主体,
   同时抓 `runtime-step-*` 与 `review-stats-bar`)需要导出 `RuntimeStepRow` 或做 pane 级渲染 ——
   pane 主体渲染依赖大量 store/hook mock(见 `apps/web/tests/agent-task-progress-pane.test.tsx`
   的 6 处 `vi.mock`),不在本票"只补用例、不改实现"范围内。**建议下一轮**把 `RuntimeStepRow`
   导出后补一条跨组件对账(改的是派单清单里的只读文件,故本票没动)。
2. 票面第 3 条"未过闸门"态在实现里的定义 = `decision` 为 `null`/空串(`deriveReviewStats:647`),
   词表外非空字符串归 `unknown` 且**同样不进已接受/已拒绝**,两种形态都已被用例钉住。
3. 无待补键(全部复用现有键);未新建除测试文件与本报告外的任何文件。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
