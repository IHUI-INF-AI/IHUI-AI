# Web 端界面 Bug 深度分析报告

> 日期:2026-10-30 · 分析人:WorkBuddy AI
> 范围:`apps/web`(Next.js 前端)+ `packages/ui-react`(共享组件)
> 方法:全量 `tsc --noEmit` 基线 + 系统性 bug 类模式审计 + 代码级根因复核 + 可视化回归用例起草

---

## 0. 结论速览

| 项 | 状态 |
|---|---|
| web 全量 typecheck | ✅ 0 错误(无编译期 UI 缺陷) |
| **Tooltip 箭头被裁(孪生 bug)** | ✅ 已修复 `apps/web/src/components/feedback/Tooltip.tsx` |
| **只读概览卡静默失败** | ✅ 已修复 4 张卡片 + 新增 `OverviewError` 组件 |
| **Tooltip 箭头视觉回归用例** | ✅ 已实现并跑通(`tests/visual/tooltip-arrow.spec.ts`,light+dark 2/2 通过,含变异验证) |
| 空值写 0 / WS 重连 / 契约错配 / 上传假取消 | 已在前序批次收敛,本次审计无残留未修实例 |
| 浏览器环境 | ⚠️ 本机 chromium 在 `D:\DevEnv\cache\playwright`(自定义 `PLAYWRIGHT_BROWSERS_PATH`),已就位 |

---

## 1. 分析方法

1. **编译期基线**:`apps/web` 全量 `tsc --noEmit`(经 `pnpm exec`,`npx` 在本仓会失效)→ `EXIT=0`,0 个 `error TS`。
   含义:当前 web 端没有编译期 UI 缺陷,残留问题集中在**行为 / 视觉 / 契约**层。
2. **系统性 bug 类审计**:针对近期"前端深度排查"第 1–7 批已修的 bug 类(空值写 0、静默失败、WS 无限重连、后端契约错配、上传假取消、箭头被裁),逐类做 grep + 代码复核,确认是否还有漏网实例。
3. **活站点对照**:生产 web 跑在 `http://localhost:8801`(HTTP 200),但本分析以工作树源码为准(8801 反映的是生产构建,不含量未部署的修复)。
4. **可视化回归**:本机 chromium 可用,起草针对本次 Tooltip 修复的回归用例(见第 4 节)。

---

## 2. 核心发现与修复

### 2.1 [高] Tooltip 箭头被裁 —— batch-7 修复的孪生体,app 级这份漏改

- **现象**:悬停带 tooltip 的元素时,气泡与目标之间留一段空白,相邻图标看不出提示指的是哪一个。
- **根因**:`apps/web/src/components/feedback/Tooltip.tsx:55` 的 Radix `TooltipPrimitive.Content` 带 `overflow-hidden`,而 Radix 把 `TooltipPrimitive.Arrow`(第 61 行)包在 `translateY(100%)` 的外溢 wrapper 里,箭头顶在气泡盒之外 → 被 `overflow-hidden` 整枚裁掉。
- **对照证据**:`packages/ui-react/src/components/tooltip.tsx:50-53` 已在 batch-7 实证并移除 `overflow-hidden`(注释明确写"7/7 悬停样本箭头落在气泡盒外被判裁")。app 级这份是**同源实现但当时只改了 shared,漏了 app 这份**。
- **影响面**:`apps/web/src/components/feedback` 被 **114 个**组件间接依赖,是 app 端唯一带 Arrow 的 tooltip(全仓仅此一处 app 级 `TooltipPrimitive.Arrow`)。
- **修复**:移除 `overflow-hidden` 并补注释,与 shared 修复同源。tsc 复跑 0 错误。

### 2.2 [中] 只读概览卡 fetch 失败被静默吞掉

- **现象**:设备管理 / 会话管理 / 登录历史 / 安全评分四张卡片拉取失败时,`.catch(() => {})` 直接吞掉错误,用户看到的是"空数据"而非"加载失败",无法区分"确实没数据"与"网络/鉴权出错"。
- **根因**:四张卡片(均位于 `apps/web/src/components/settings/`)在只读拉取后用空 catch,无错误态、无重试入口。
- **修复**:
  - 新增共享组件 `apps/web/src/components/settings/OverviewError.tsx`(图标 + 文案 + 重试按钮)。
  - 四张卡片(DeviceManager / SessionManager / LoginHistory / SecurityScore)各引入 `error` 状态 + `load()` 回调,`.catch` 改为 `setError(true)`,渲染分支在 `loading` 与数据之间插入 `<OverviewError onRetry={load} />`。
  - tsc 复跑 0 错误。

### 2.3 已审计并排除(近期批次已收敛,本次无残留未修实例)

| 类别 | 审计结论 |
|---|---|
| 空值被写成 0 | `crud-resource.tsx:195` 已改 `raw === '' ? null`;`sampling-params-panel/card` 空值走 `onChange(undefined)`。无残留。 |
| 静默失败(变更类操作) | 设 `TwoFactorAuth.tsx` 等的静默 catch 属更高危的"变更操作无回执"类,单列见第 5 节 P2-bonus,本次未自动改(避免越界)。 |
| WS 无限重连 | batch(f071844acd5)已将 7 处 WS 客户端统一走 `resolveWsApiBaseUrl`。现场无同类未修实例。 |
| 后端契约错配 | batch(1ae7d3bd0c6)已修买课/交卷/提问/报名四处。现场无同类未修实例。 |
| 上传假取消 | batch(1c771ee4fdd)已修 shared `Upload.tsx`。`AttachmentsUpload.tsx` 为质量良好的重写版(job-scope 防复活、错误全上报)。 |
| Hydration 漂移 | `feedback/Tooltip.tsx` 已用 `suppressHydrationWarning` 处理 Radix `useId` 漂移;全仓 `Date.now/Math.random` 命中多在 store action / 事件处理(非 render),hydration 风险低。 |
| Dropdown 的 `overflow-hidden` | `Dropdown.tsx` 无 Arrow,该裁剪仅用于圆角/滚动,安全,不受影响。 |

---

## 3. 本次改动文件清单

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/feedback/Tooltip.tsx` | 移除 Content 的 `overflow-hidden`(修箭头被裁),补注释 |
| `apps/web/src/components/settings/OverviewError.tsx` | **新增** 统一概览卡错误态 + 重试组件 |
| `apps/web/src/components/settings/DeviceManager.tsx` | 引入错误态 + 重试 |
| `apps/web/src/components/settings/SessionManager.tsx` | 引入错误态 + 重试 |
| `apps/web/src/components/settings/LoginHistory.tsx` | 引入错误态 + 重试 |
| `apps/web/src/components/settings/SecurityScore.tsx` | 引入错误态 + 重试 |
| `apps/web/tests/visual/tooltip-arrow.spec.ts` | **新增** Tooltip 箭头裁剪回归守卫(见第 4 节) |

所有改动 `apps/web` 全量 `tsc --noEmit` 通过(0 错误)。

---

## 4. P3 — Tooltip 箭头视觉回归用例(已实现 + 已跑通 + 已做变异验证)

文件:`apps/web/tests/visual/tooltip-arrow.spec.ts`

### 4.1 靶子为什么必须选「折叠态侧栏导航项」

排查过程中踩到的两个真实陷阱(已写进用例注释,避免后人重踩):

1. **`[role="tooltip"]` 不唯一**:页面里还常驻 3 个侧栏/页脚的**纯 CSS 二维码提示框**
   (`group-hover/qr:` + 内含 `<img>`),它们同样带 `role="tooltip"`、同样被 Playwright 判为
   "可见"(opacity 不计入可见性),但**根本没有箭头**。用 `locator('[role="tooltip"]').first()`
   会稳定地抓到它们 ⇒ 用例必须按 `feedback/Tooltip` 的特征类(`.text-xs.px-2`)精确命中。
2. **展开态侧栏根本没有 Tooltip**:`NavLink.tsx:78-95` 只在 `collapsed === true` 时才把导航项
   包进 `feedback/Tooltip`;展开态(第 103-130 行)直接渲染裸 `<Link>`。公开首页默认展开 ⇒
   悬停侧栏永远不会出现 Radix 提示框。用例先写 `localStorage['sidebar-collapsed']='true'`
   (Sidebar.tsx:74/84 的持久化键)再 reload,进折叠态后才悬停。
   折叠态下 Radix Trigger 会给导航项打 `data-state` ⇒ 用例用
   `a[data-testid^="nav-"][data-state]` 定位,**同时**证明「折叠态已生效」与「它确实是 Tooltip 触发器」。

### 4.2 守卫点

1. tooltip Content 的 computed `overflow` / `overflowY` 不得含 `hidden`。
2. Arrow 必须存在且宽高 > 0(本仓 Radix 版本把 Arrow 渲染成 `svg`,故按
   `[data-radix-tooltip-arrow]` → `[data-radix-popper-arrow]` → `svg` 依次兜底取)。
3. Arrow 应探出内容盒(`outsideLeft/Right/Top/Bottom` 至少一项为真且 `fullyInside` 为假)。
4. 无 hydration / 运行时 console 报错(401/400 属未登录态取数的预期噪音,不计入)。

### 4.3 实测结果(修复后源码,本地 dev server :8911)

| 项 | light | dark |
|---|---|---|
| tooltip `overflow` / `overflowY` | `visible` / `visible` | `visible` / `visible` |
| Arrow 尺寸 | 5 × 10 px | 5 × 10 px |
| Arrow 外溢 | `outsideLeft: true`(side=right,箭头指向左侧图标) | 同左 |
| `fullyInside` | `false`(未被裁) | `false` |
| DOM class | `z-popover rounded-md border bg-popover px-2 py-1 text-xs …`(已无 `overflow-hidden`) | 同左 |

结果:`2 passed`。

### 4.4 变异验证(证明这条守卫不是摆设)

把 `overflow-hidden` 临时加回 `feedback/Tooltip.tsx` 再跑同一用例:

- `overflow` / `overflowY` 变为 `hidden`;
- 用例在守卫 1 上如期失败,报错
  `light: tooltip 内容盒不得裁剪箭头(回归守卫:feedback/Tooltip overflow-hidden 裁 Arrow)`;
- 退出码 `1` ⇒ 该守卫对这个回归**确实会响**。随后已还原修复,复跑 `2 passed`。

### 4.5 运行方式

```bash
cd apps/web
# 针对现网(8801,须已部署修复)或本地带修复的 dev server:
IHUI_E2E_BASE_URL=http://localhost:8911 IHUI_E2E_EXTERNAL_SERVER=1 \
PLAYWRIGHT_BROWSERS_PATH=D:/DevEnv/cache/playwright \
pnpm exec playwright test --config=playwright.visual.config.ts tooltip-arrow --reporter=line
```

配套改动:`playwright.visual.config.ts` 的 `baseURL` 改为读 `IHUI_E2E_BASE_URL`;
`webServer` 在 `IHUI_E2E_EXTERNAL_SERVER=1` 时不自启(避免抢 8801 生产端口)。

---

## 5. 残留风险与后续建议

- **P1(部署后视觉核验)**:Tooltip 修复**已在源码层验证通过**(含变异验证,见 4.3/4.4);剩下的只有
  「部署到 8801 生产构建后」的最终核验 —— 8801 目前跑的是未含本次修复的生产构建,建议走正常
  ff/deploy 收敛后,用同一条用例(`IHUI_E2E_BASE_URL=http://localhost:8801`)复跑一次,或人工肉眼确认箭头恢复。
- **P2-bonus(变更类操作静默 catch)**:`TwoFactorAuth.tsx`、`LoginHistory` 之外若仍有"吊销设备 / 登出会话 / 关 2FA"等**变更操作**的 catch 仅静默、不向用户回执,属更高危类,建议下一批补 toast/错误条回执(与 batch-7 的"删除失败一句都不显示"同源)。
- **P3(常态化视觉回归)**:本机 chromium 已就位(`D:\DevEnv\cache\playwright`),建议把 `tests/visual/*` 纳入 CI / 定时回归,对"界面 bug"做自动化兜底。本次仅新增 tooltip 箭头一项,另有 4 个既有视觉 spec 覆盖登录凹槽 / 模型选择器 / 提示词模板 / 侧边栏。
- **P3-bonus(守卫有效性)**:新用例已做**变异验证**(把 bug 加回去,守卫如期失败)。建议今后新增视觉
  守卫时同样做一次「加回 bug → 确认失败 → 还原 → 确认通过」,否则守卫可能只是恒真、并不真正兜底。

---

## 6. 附:关键证据索引

- 孪生 bug 对照:`packages/ui-react/src/components/tooltip.tsx:50-53`(已修,注释实证)vs `apps/web/src/components/feedback/Tooltip.tsx:55`(本次修)。
- 影响面:114 个组件依赖 `@/components/feedback`(`grep -rEl "from '@/components/feedback'" apps/web/src`)。
- typecheck:`pnpm exec tsc --noEmit` → `EXIT=0`,0 `error TS`(修复前后各跑一次均 0 错误)。
- **实跑证据**:修复后 dev server(:8911,`IHUI_DEV_PORT=8911` + `--no-backend`)上 `tooltip-arrow` 用例
  `2 passed`(light+dark),实测 `overflow=visible`、Arrow 5×10px 且 `outsideLeft=true` / `fullyInside=false`。
- **变异证据**:把 `overflow-hidden` 加回后同用例退出码 `1`,失败点正是守卫 1
  (`tooltip 内容盒不得裁剪箭头(回归守卫:feedback/Tooltip overflow-hidden 裁 Arrow)`)⇒ 守卫非恒真。
- **两个靶子陷阱**(写进了用例注释):① 页面常驻 3 个 CSS 二维码提示框也带 `role="tooltip"` 且无箭头,
  用 `.first()` 会抓错对象;② `NavLink` 仅在**折叠态**才包 `feedback/Tooltip`,展开态是裸 `<Link>`。
