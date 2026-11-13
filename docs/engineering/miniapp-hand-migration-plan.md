<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 小程序 hand 屏迁移计划（port_all_23 分轮真相源）

> 用途：用户已选定「全部 23 屏按优先级逐屏迁到共享屏薄壳」。本文档是分轮推进的唯一权威清单。
> 判定来源：`node scripts/check-miniapp-mirror-fidelity.mjs --worktree`（`--json` 取 rows）。
> 每轮迁完一屏：改页 → `check-miniapp-mirror-fidelity.mjs --worktree` 缺口收敛 → `check-cross-end-screen-coverage.mjs` 无倒退 → miniapp typecheck。

## 现状基线（2026-11-13，本轮更新）

- fidelity `--worktree`：pairs=262 / hosted=241 / hand=21 / avg=97.5% / broken=0 / regressions=0 / state=ok
- hand 屏 21 个中 **16 个已零缺口对齐**（复用共享屏 section 或逐键对齐）。
- 真缺 5 屏，分两类（B=尺子口径 / C=真迁移）。

## 已迁：developer/cover（C 类第 1 屏，本轮完成）

- `pkg-ai/dev-enter/cover/index` 335→46 行手写页 → `DeveloperScreen` 薄壳（与 `dev-space/index` 同形）。
- fidelity：hand→hosted，缺口 12/18 → **18/18（100%）**；avg 96.9%→97.5%。
- 拓扑澄清：本页与 `dev-space/index` 是**同一共享屏 DeveloperScreen 的两个入口落点**（本页←ai/agent「创建智能体」，dev-space←plaza「开发者」），历史上是逐行手抄孪生（账号/密码/FAQ 端内硬编码），已收口单一源。
- 验证：coverage 门无倒退（登记 258 / 真缺口候选 0）、miniapp typecheck exit 0。
- 遗留：`cover/index.css`(10781B) 薄壳后成孤儿（仅自身注释引用、无外部 import），按安全红线未删，待机主确认。

## B 类：已单一源，尺子按整屏分母误判（4 屏）

这些页**已经复用共享屏 section**，是"拆子页"产品路由（语言/主题各自独立路由），t() 在父页。
尺子 `directSharedUsage` 只认整屏组件名（`<SettingsScreen>`），不认同模块导出的 section
（`<SettingsLanguageSection>`），于是把整屏键集摊给只渲染 1 个 section 的子页 → 假缺口。

| 页 | 复用的共享符号 | 判读 | 缺口 |
|---|---|---|---|
| pages/setting/language | `SettingsLanguageSection` | 已单一源 | 21/21（假） |
| pages/setting/theme | `SettingsThemeSection` | 已单一源 | 20/21（假） |
| pkg-user/user/avatar | `AvatarEditor` | 已单一源 | 15/15（假） |
| pages/member/index | `VipLevelsSection` | 已单一源 | 1/9（假，缺 `vip.details.benefitsTitle` 旧键，页注释声明改用 `vip.privileges`） |

**处置选项**（待与机主对齐后执行，需防"假绿"）：
1. 改 `directSharedUsage`：识别"复用了共享屏模块导出的任一组件（含 section）"即判 hosted —— 风险：section 收 props、t() 在父页，整屏其它 section 键会被误算满还原。
2. 登记缺口账本（`retracted` / aliasSame 扩展）：承认拆子页只承载对应 section 键，按 section 边界缩分母。
> 未拍板前不动手，避免改坏尺子制造假绿。

## C 类：真迁移（剩 1 屏）

| 页 | 缺口 | 性质 | 迁移路径 |
|---|---|---|---|
| pages/study/index | 8/8 | 学习中心枢纽页（统计卡+5 入口+继续学习+FAB）；共享 `StudyProgressScreen` 仅统计+课程进度，功能是子集 | **不能整屏替换**（会丢入口区+FAB）。取词对齐：小程序用 `study.*`，共享屏用 `studyProgress.*`/`eduProgressPage.*`。缺键中 7 个 miniapp 词包已有同义值、`eduProgressPage.noData` 两端 MISSING |

> 已迁走：`pkg-ai/dev-enter/cover/index`（见上「已迁：developer/cover」）。

## 已完成

- [x] **developer/cover**（本轮）：`pkg-ai/dev-enter/cover/index` 335 行手写 → `DeveloperScreen` 薄壳（与 dev-space 同形），缺口 12/18→18/18，fidelity hand 22→21。
- [x] **ai-career**（上轮）：`apps/miniapp-taro/src/pkg-ai/ai-career/index.tsx` 撤除失效镜像标记，与既有 `not-applicable` 裁决对齐。效果：fidelity pairs 263→262、hand 23→22、missing 80→77。

## 分轮顺序（建议）

1. ~~**developer/cover**~~（✅ 本轮完成）。
2. **study/index**（C 类，需先定取词对齐策略）—— 单独一轮。
3. **B 类 4 屏**（改尺子或登记账本）—— 拍板后一轮。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
