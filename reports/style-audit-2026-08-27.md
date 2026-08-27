# IHUI-AI 界面样式深度体检报告

- **日期**：2026-08-27
- **范围**：`apps/web`（src + app）、`packages/ui-react`、`packages/shared`、`packages/design-tokens`
- **方法**：① 全量运行 16 个样式守门脚本（非仅 staged）；② 对门禁未覆盖的"不合理"类别做静态扫描（原生弹窗 / 渐变遮罩 / 反微调 hack / 硬编码色值 / 非标圆角 / 超大文件 / 任意 z-index / 单边边框分割线）；③ 统计量化。
- **结论一句话**：自动化守门体系非常健全且全绿，但存在三类门禁盲区问题——**超大文件违反"每页<250行"规则（最严重）**、_*z-index 硬编码绕过 --z-* token_*、**单边 border 当分割线（§4 明文禁但门禁未覆盖）**，以及若干轻微 token 绕过。

---

## 一、自动化守门结果（全量模式，均 0 违规）

| 守门脚本                                                       | 结果 | 说明                                     |
| -------------------------------------------------------------- | ---- | ---------------------------------------- |
| check-rounded-full                                             | ✅ 0 | 容器圆角（rounded-full/pill/9999px/50%） |
| check-rounded-overflow                                         | ✅ 0 | 父圆角+子贴边溢出                        |
| check-no-divider                                               | ✅ 0 | divide-y / divide-x                      |
| check-native-title-tooltip                                     | ✅ 0 | 原生 title + Tooltip 包 disabled Button  |
| check-tailwind-class-conflict                                  | ✅ 0 | className 尺寸类冲突                     |
| check-overlay-zindex                                           | ✅ 0 | 全屏遮罩 z-index                         |
| check-z-index-guard                                            | ✅ 0 | --z-* token 一致、无 !important          |
| check-input-border-var                                         | ✅ 0 | input 边框变量                           |
| check-button-text-wrap                                         | ✅ 0 | 按钮中文换行                             |
| check-shrinkable-text-button                                   | ✅ 0 | 小高度按钮                               |
| check-tagsview-visual                                          | ✅ 0 | TagsView 视觉                            |
| check-sidebar-width-consistency                                | ✅ 0 | 侧栏宽度 160px 一致                      |
| check-ui-react-usage                                           | ✅ 0 | 无独立 Dialog/Card/Form                  |
| check-design-tokens-sync / web-tokens-sync / web-tokens-import | ✅ 0 | token 同步                               |

> 注：门禁只在 `git staged` 新增行生效，全量扫描仍 0 违规，说明历史存量也基本干净。

---

## 二、🔴 严重问题（High）

### H1. 超大文件严重违反「每个页面 < 250 行」规则（AGENTS.md §4）

全仓库 `apps/web/src` + `apps/web/app` 共 **2933** 个 ts/tsx 文件：

| 指标      | 数量    |
| --------- | ------- |
| > 250 行  | **360** |
| > 500 行  | **86**  |
| > 1000 行 | **30**  |

**行数最夸张的 12 个文件**（标注 [P]=页面级、[C]=组件、[H]=hook、[L]=lib）：

| 行数 | 文件                                                 | 类型     |
| ---- | ---------------------------------------------------- | -------- |
| 3140 | `app/(main)/compare/ihui-vs-dify/CompareContent.tsx` | [P] 页面 |
| 2661 | `app/(main)/plugins/plugins-data.ts`                 | [L] 数据 |
| 2299 | `src/components/sidebar.tsx`                         | [C]      |
| 2292 | `src/components/rules/rules-manager.tsx`             | [C]      |
| 2290 | `src/hooks/use-chat.ts`                              | [H]      |
| 2247 | `src/components/ai/spec-panel.tsx`                   | [C]      |
| 2202 | `app/(main)/edu/edu-management/study-plan/page.tsx`  | [P] 页面 |
| 2058 | `app/(main)/models/helpers.ts`                       | [L]      |
| 1967 | `src/components/chat/message-list.tsx`               | [C]      |
| 1914 | `app/(main)/design/PageClient.tsx`                   | [P] 页面 |
| 1783 | `src/components/ide/terminal-panel.tsx`              | [C]      |
| 1668 | `src/lib/ai-news-api.ts`                             | [L]      |

**影响**：可维护性差、PR review 困难、合并冲突概率高、单文件职责过多。AGENTS.md 明确要求"每个页面 < 250 行"，当前 30 个文件超 1000 行、360 个超 250 行，属系统性偏离。

**建议**：

1. 优先拆分页面级巨型文件（CompareContent / study-plan/page / design/PageClient 等），按区块抽成 `<XxxSection/>` 子组件。
2. 大型 hook（use-chat 2290 行）按职责拆为多个子 hook 或 move 到独立模块。
3. 在 `lint-staged` 或 CI 增加"单文件行数上限"守门（如 >800 行阻断），防止继续劣化。

---

## 三、🟠 中等问题（Medium）

### M1. z-index 硬编码原始值，未走 `--z-*` token 体系

`check-z-index-guard` 只校验 `--z-*` CSS 变量自身一致，**不校验业务代码是否使用它们**。实际大量组件用原始数值，与 token 体系脱节：

| 文件:行                                                            | 用法                                   | 对应 token（若有）                                                                    |
| ------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/components/layout/GlobalTopBar.tsx:429-471`                   | `z-[9999]` / `z-[10000]` / `z-[10001]` | 超出常规层级，与 `--z-notification:9999`/`--z-loading:10000`/`--z-max:10003` 语义混淆 |
| `src/components/common/NavigationProgress.tsx:61`                  | `z-[9999]`                             | 应直接用 `z-notification`                                                             |
| `src/providers/global-hooks-provider.tsx:116`                      | `zIndex: 9999`（inline）               | 应改用 token                                                                          |
| `src/components/ai/progress-sections/hover-preview-card.tsx:94`    | `z-[1000]`                             | 悬浮预览卡，应为 `z-popover`(2001)                                                    |
| `src/components/ai/progress-sections/message-context-menu.tsx:206` | `z-[1100]`                             | 介于 dropdown(1000) 与 popover(2001) 之间的任意值                                     |
| `src/components/ai/progress-sections/sub-agent-task-tree.tsx:327`  | `z-[1100]`                             | 同上                                                                                  |
| `src/components/media/PDFTextLayer.tsx:106`                        | `z-[5]`                                | 任意低值                                                                              |

**风险**：层级顺序靠"拍脑袋数字"维持，新增浮层易与既有层级碰撞（如 10001 顶栏压过 9999 通知）。

**建议**：统一改用语义类 `z-base/z-sticky/z-header/z-dropdown/z-popover/z-modal/z-notification/z-loading/z-max`；确需超越 `--z-max` 的罕见场景，在 `tokens.css` 显式新增变量，禁止裸写 `z-[NNNN]`。

### M2. 单边 `border-t/b/l/r` 当分割线（§4 明文禁止，但门禁未覆盖）

AGENTS.md §4 明确："禁止 `<hr>` / divide-y / divide-x / **单边 border-t/b/l/r 当分割线**"。但 `check-no-divider.mjs` 仅拦截 `divide-y/x`，**完全不查 `<hr>` 与单边 border**。扫描发现 **38 个文件**使用单边边框，其中相当部分为"区块之间的分隔线"，与规则文字冲突：

代表性位置：

- `src/components/ai/task-list-panel.tsx:43` `border-b px-4 py-2.5`（列表头分隔）
- `src/components/ai/routines-panel.tsx:24` `border-b px-4 py-2.5`
- `src/components/ai/AgentTraceViewer.tsx:157` `border-t px-4 py-3`（区块分隔）
- `src/components/ai/background-agents-panel.tsx:191` `border-t px-3 py-1.5`
- `src/components/business/CommentItem.tsx:87` `border-l-2 pl-3`（引用/评论左侧线）
- `src/components/home/ModuleSection.tsx`、`src/components/home/CategoryNav.tsx`、`src/components/home/MemberCard.tsx`、`src/components/feature-center/FeatureCenterNav.tsx` 等

**矛盾点**：代码注释中已出现分歧理解——

- `message-list.tsx:1899` 注释："用 bg 色对比替代 border-t 分割线（AGENTS.md §4 禁止分割线）" → 开发者 A 认为 border-t 禁止；
- `search-suggestions.tsx:8` 注释："每段之间用 `<div className='border-t border-border/50' />` 显式分割是允许的" → 开发者 B 认为允许。

**建议**（二选一，须统一）：

1. **扩展门禁**：`check-no-divider.mjs` 增加单边 border 当分割线的检测（排除结构性边框如 card 完整边框、blockquote 左侧 accent、IDE diff 面板）；
2. **或修订文档**：在 AGENTS.md §4 中明确"单边 border 仅允许用于结构性边框（card 头/尾、引用左侧 accent），禁止用于列表项之间的纯分隔线"，消除团队理解分歧。

### M3. 硬编码原始色值绕过 design tokens

`src/components/publish/PlatformPreview.tsx:152-168` 用大量品牌 hex 模拟各平台渲染（微信 `#07c160`、小红书 `#ff2442`、微博 `#ff8200`/`#1f73b1` 等）：

```
[&_h1]:text-[#222] [&_blockquote]:border-[#07c160] [&_a]:text-[#576b95] [&_code]:text-[#c7254e] [&_code]:bg-[#f9f2f4] ...
```

**判断**：用于"预览外部平台真实样式"，属合理用途，但预览块本身不受暗黑模式 token 控制，切换主题时可能突兀。低优先级，可加 `dark:` 适配或包裹在固定浅色容器中。

---

## 四、🟡 轻微问题（Low）

### L1. 实心 `bg-white` / `text-zinc-900` 在营销组件绕过 token

| 文件:行                                             | 用法                                        | 建议                                                           |
| --------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `src/components/marketing/HomeBanner.tsx:79`        | `bg-white/90 text-zinc-900 hover:bg-white`  | `bg-card text-card-foreground`（或保留营销专属浅色但统一变量） |
| `src/components/marketing/HeroCarousel.tsx:107,137` | `bg-white/95 text-zinc-900` / `bg-white/40` | 同上                                                           |
| `src/components/login/qr/AppQrPanel.tsx:202`        | `bg-white p-3`                              | `bg-popover`                                                   |
| `src/components/user/UserPrivacy.tsx:70`            | `bg-white`（Switch 滑块）                   | 复用共享 `Switch` primitive                                    |

营销组件用 `text-zinc-900` 直接写死灰阶，未走 `text-foreground`，暗黑模式下需逐处验证。

### L2. 内联 `style={{` 用量（约 90 个文件）

统计约 90 个文件含 `style={{`。绝大多数合理（ECharts/Monaco/动态定位/进度条宽度）。仅少量静态样式可改为 className（如 `context-usage-ring.tsx`、`progress-ring.tsx` 的纯静态定位）。属可优化项，非阻断。

### L3. `diff-preview.tsx` 用 `border-zinc-800`（硬编码灰阶）

`src/components/ai/diff-preview.tsx:88,99,122` 用 `border-zinc-800 bg-zinc-900`，在 IDE 暗色场景硬编码 zinc。建议统一为 `border-border` / `bg-muted` 等 token（若 IDE 面板强制暗色，可保留但需在注释说明）。

---

## 五、✅ 已确认合规（正面结论，门禁 + 静态双重验证）

- **无原生 `alert()` / `confirm()` / `prompt()`** 弹窗（源码 0 命中）。
- **无 `mask-image` / `-webkit-mask` 渐变遮罩**（源码 0 命中；`out/` 与 Monaco 第三方产物除外，已隔离）。
- **无 `-mt-px` / `margin-top:-1px` 反微调 hack**（`sidebar.tsx:188-189` 仅为说明"为何移除"的注释）。
- **圆角档位严格**：无任何非标的 `rounded-[Npx]` 任意值，全部落在 2/4/6/8/12/16px 梯度或豁免项。
- **CSS 无 `!important`**。
- **共享层复用良好**：未独立实现 Dialog/Card/Form（check-ui-react-usage 通过）。
- **股票页未硬编码红/绿**：`stock/page.tsx` 不含 Tailwind `text-red/green-*` 工具类，走语义 token（建议再确认 up/down token 映射符合 A 股"红涨绿跌"）。

---

## 六、修复优先级建议

| 优先级 | 问题                             | 动作                                   | 预计工作量     |
| ------ | -------------------------------- | -------------------------------------- | -------------- |
| P0     | H1 超大文件（30 个>1000行）      | 先拆页面级巨型文件 + 加单文件行数守门  | 高（但可分批） |
| P1     | M1 z-index 硬编码                | 全量替换 `z-[NNNN]` → 语义 token       | 中             |
| P1     | M2 单边 border 分割线规则缺口    | 扩展门禁 或 修订 AGENTS.md 消除分歧    | 低             |
| P2     | M3 / L1 硬编码色值               | 平台预览块暗黑适配；营销组件改用 token | 低             |
| P3     | L2 / L3 内联 style / zinc 硬编码 | 顺手清理，非阻断                       | 低             |

---

## 七、可立即执行的下一步

1. 新增守门 `scripts/check-file-size.mjs`（阈值如 800 行阻断），接入 pre-commit，遏制 H1 继续恶化。
2. 补 `check-no-divider.mjs` 对单边 border 分割线的检测（M2），或先在 AGENTS.md 加"结构性边框 vs 分割线"示例。
3. 发起一轮 z-index token 化重构（M1），可配合脚本批量替换。

> 报告由静态分析生成，未运行 dev server / e2e；`icon-text-alignment.spec.ts`（图标-文字垂直对齐）需运行时验证，建议在有 dev server 时单独跑一次确认。
