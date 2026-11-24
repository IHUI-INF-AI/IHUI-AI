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

## B 类：已单一源，尺子按整屏分母误判（4 屏，✅ 本轮收口）

这些页**已经复用共享屏 section**，是"拆子页"产品路由（语言/主题各自独立路由），t() 在父页。
尺子 `directSharedUsage` 只认整屏组件名（`<SettingsScreen>`），不认同模块导出的 section
（`<SettingsLanguageSection>`），于是把整屏键集摊给只渲染 1 个 section 的子页 → 假缺口。

**处置（机主 2026-11-13 拍板：改尺子，section 也算委托，但必须缩分母防假绿）**：
- `scripts/lib/rn-shell-refs.mjs` 加 `renderedSharedSymbol()`：识别页面从声明共享屏模块渲染的符号
  （整屏本体=via direct 保持旧语义；section/子组件=via section）。
- `scripts/check-miniapp-mirror-fidelity.mjs` 加 **`form='section'`**（真单一源委托形态）
  + `sectionScopeKeys()`：**分母缩到该 section 函数体内真消费的键 ∩ 整屏业务键**。
  - 自消费型（AvatarEditor/VipLevelsSection）：section 体里有 `t()` ⇒ 直接收。
  - props 传入型（SettingsLanguage/ThemeSection，section 体零 t()、文案全由父页传入）⇒ 回退到
    「页面自己消费且属整屏」的键。
  - 提不到 section 体 ⇒ 退回逐键尺，**绝不冒满还原**（防假绿）。
- T18 四形制守恒纳入 section 防漏分。

| 页 | 复用的共享符号 | 迁后 | 结果 |
|---|---|---|---|
| pages/setting/language | `SettingsLanguageSection` | section | 21/21（假）→ **0/0**（分母诚实缩到 0） |
| pages/setting/theme | `SettingsThemeSection` | section | 20/21（假）→ **1/1（100%）** |
| pkg-user/user/avatar | `AvatarEditor` | section | 15/15（假）→ **0/0**（分母诚实缩到 0） |
| pages/member/index | `VipLevelsSection` | hand | 1/9 → **0/8（缺键已撤除免）**，其余部分手工对齐 VipScreen 故诚实保留 hand |

**效果**：fidelity `--worktree` avg 97.5%→**99.7%**、missing 65→**8**、hand 21→**18**、broken=0、retractRot=0、state=ok。
**量化确认假绿风险被规避**：language 原 21 缺键里仅 1 键（`settings.language`）属 language section，其余 20 键
属密码/通知/资料 section —— 若简单判 hosted 会假记 21/21 满还原；sectionScopeKeys 缩分母正是为此。

## C 类：真迁移（剩 1 屏）

| 页 | 缺口 | 性质 | 迁移路径 |
|---|---|---|---|
| ~~pages/study/index~~ | ~~8/8~~ | **✅ 已撤配对**：本页是「学习中心枢纽页」（统计卡今日/累计/连续/已学 + 5 入口 + 继续学习 + FAB，学习域，取词 `study.*`）；共享 `StudyProgressScreen` 是「教育域学习进度」（统计卡课程/累计/本周/连续 + 课程进度条，取词 `studyProgress.*`/`eduProgressPage.*`）⇒ 两端统计口径与 UI 段落不同，不是同一产品对象。registry 原强配 = 假声明 | 撤除 registry 三元组（第1285行）+ 删页面第5行假镜像标记（对齐 ai-career 摘除先例：登记假声明比缺一条覆盖更坏）。`StudyProgressScreen` 的合法薄壳载体是 `pkg-mirror3/study-progress/index`。**结果**：fidelity pairs 262→261、hand 18→17、**missing 8→0、avg→100%** |

> 已迁走：`pkg-ai/dev-enter/cover/index`（见上「已迁：developer/cover」）。

## 已完成

- [x] **developer/cover**（本轮）：`pkg-ai/dev-enter/cover/index` 335 行手写 → `DeveloperScreen` 薄壳（与 dev-space 同形），缺口 12/18→18/18，fidelity hand 22→21。
- [x] **ai-career**（上轮）：`apps/miniapp-taro/src/pkg-ai/ai-career/index.tsx` 撤除失效镜像标记，与既有 `not-applicable` 裁决对齐。效果：fidelity pairs 263→262、hand 23→22、missing 80→77。

## 分轮顺序（建议）

1. ~~**developer/cover**~~（✅ C 类，已迁薄壳 18/18）。
2. ~~**study/index**~~（✅ C 类，已撤假配对，missing 8→0）。
3. ~~**B 类 4 屏**~~（✅ 机主拍板改尺子：加 form='section' + sectionScopeKeys 缩分母，假缺口全部归零）。

## 本轮终态（2026-11-13）

fidelity `--worktree`：pairs=261 / hosted=241 / section=3 / hand=17（**全部零缺口**）/ broken=0 /
**missing=0** / **avg=100%** / retractRot=0 / state=ok。coverage 门 257 条无倒退、parity-drift STATE=ok、
fidelity 自测 41/41、miniapp typecheck exit 0。port_all_23 真缺屏全部处置完毕。
未提交（工作树有他席在飞）。遗留待机主确认：`pkg-ai/dev-enter/cover/index.css`(10.7KB 孤儿)是否删除。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
