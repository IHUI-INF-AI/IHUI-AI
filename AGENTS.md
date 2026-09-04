<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md — IHUI-AI 项目 Agent 指南

> 作用域:`g:\IHUI-AI` 仓库根目录及所有子目录。
> 历史案例归档见 `.trae-cn/archive/AGENTS_history.md`。
> 本文件为精简版(2026-07-25 重构,原 783 行 → ≤400 行),保留所有强制规则核心条款。

---

## 1. 任务计划文档规则(强制)

- 项目**唯一**任务计划文档是 `PROJECT_PLAN.md`(根目录),所有任务计划、进度更新、待办清单、状态变更**只写**此文件,**不得**在 `.trae/`、`docs/`、根目录或其他位置新建计划/TODO/ROADMAP 文件。
- 完成任务后 `[ ]` → `[x] ✅(日期)`;新增任务追加到对应优先级(P0/P1/P2)末尾。commit message:`feat`/`fix`/`docs`/`chore`/`test`/`refactor` 前缀。

### 归档机制

- 已完成任务条目(`### XXX(已完成 ✅ ...)` 标题)**禁止直接删除**,必须两步走:① 把完整任务条目(标题 + 正文)移动到 `.trae-cn/archive/PROJECT_PLAN_YYYY-MM-DD.md`;② 在 `PROJECT_PLAN.md` 原位置留 HTML 注释占位:`<!-- 已归档(YYYY-MM-DD):XXX 任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_*.md -->`。
- **自动归档**:`scripts/archive-completed-tasks.mjs` 扫描完成 ≥7 天的条目,post-commit 钩子自动 `--auto-commit`,归档 commit 设 `IHUI_ARCHIVE_COMMIT=1` 防递归。
- **手动触发**:`pnpm archive` / `--all`(全部)/ `--days 3`(自定义)/ `--dry-run`(预览);跳过用 `HUSKY_SKIP_ARCHIVE=1 git commit`。
- **守门**:`scripts/check-project-plan-archive.mjs` + pre-commit 第 13c 项。历史案例见 `.trae-cn/archive/AGENTS_history.md`。

### 唯一例外

- `/goal` 模式:`.trae-cn/goal-runtime/STATE.md` + `loop-run-log.md`(临时,目标结束后删除);skills:`.trae-cn/skills/SKILL.md`(AI 工具配置,非计划文档)。

---

## 2. 项目概览

IHUI-AI 是全栈 AI 平台(TS Monorepo + pnpm workspace + Turborepo),8 端清单:

- `apps/api`(Fastify 5 + Drizzle ORM 0.38 + PostgreSQL)
- `apps/web`(Next.js 16.2.12 + React 19 + Tailwind 4 + shadcn/ui)
- `apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)
- `apps/miniapp-taro`(Taro 4 + React)
- `apps/desktop` / `apps/extension` / `apps/mobile-rn` / `apps/cli`(各端独立)
- `packages/`(database / auth / types / ui / config / eslint-config / tsconfig)

---

## 3. 代码风格

- 做减法,最小化代码,零冗余。复用现有代码和模式,不创建文档文件(除非明确要求),不加 copyright/license header。

### TypeScript 类型零技术债(强制)

- **尽最大程度禁用 `any`**,优先用 `unknown` + 类型守卫 / `as const` / 泛型 / 条件类型 / 工具类型(`Pick`/`Omit`/`Record`/`Partial`/`Required`/`ReturnType`/`Parameters`)/ 精确接口替代,禁止把 `any` 当"类型兜底"逃避设计。
- **深度分析 TS 用法**:函数签名(入参/出参/泛型约束)、对象字段、API 响应、props、state 必须显式标注精确类型;能由 `tsc` 推断且可读性良好的局部变量可省略,但禁止"省略 = 不写类型"扩散到公共 API。
- **必须用 `any` 的例外(三选一)**:① 第三方库无 `@types` 或类型声明缺失;② 泛型推断失败且无法用 `unknown` + 守卫替代;③ 跨包循环依赖无法用类型导入断言解决。**必须**附行内注释 `// FIXME(any): 原因 + 移除计划 + 截止版本`,后续 PR 必须清理。
- **不留技术债**:新代码 `tsc --noEmit` 必须 0 错误,禁止"先 any 后修"占位;重构遗留 `any` 必须替换为精确类型,**禁止**复制粘贴扩散 `any`;PR 引入新的 `any` 必须在 PR 描述说明例外依据。
- **守门**(分层渐进):
  - **过渡期(当前生效)**:`@typescript-eslint/no-explicit-any: error`(packages/eslint-config/index.js,syntax-level 不需 type info,已生效)。lint-staged 对 staged 源码文件触发阻塞,新代码引入 `any` 会在 `pnpm lint` 报错。
  - **目标态(已评估,推迟启用)**:`@typescript-eslint/no-unsafe-assignment` / `no-unsafe-member-access` / `no-unsafe-call` / `no-unsafe-return` / `no-unsafe-argument` 五条规则设为 `error`。**2026-07-28 评估结论**:实测启用 `recommendedTypeChecked` + `projectService` 后,(a) 性能不可接受 — cli 包(最小)lint 时间 2.7s -> 51.9s(慢 19 倍),web/api 包预计 30s -> 600s+;(b) 历史错误多 — cli 包已报 30+ 处(`require-await` / `no-unsafe-assignment` / `no-base-to-string` / `restrict-template-expressions` / `no-unnecessary-type-assertion`),全量预计 300+ 处;(c) 配置陷阱 — `eslint.config.js` 不被 tsconfig include 需 `allowDefaultProject`,JS 文件需单独豁免 `no-unsafe-*`。**启用前置条件(全部满足才可启用)**:1. lint 性能优化方案落地(eslint cache 持久化 / 仅 staged 文件 typed-lint / CI 才跑全量 typed-lint);2. 历史类型错误清零(`require-await` 等非 unsafe 错误先修);3. `allowDefaultProject` 配置就绪。
  - **测试文件豁免**:`**/*.test.ts` / `**/*.spec.ts` / `**/tests/**` / `**/test/**` / `**/e2e/**` 路径下的 mock/stub 代码允许 `any`(mock 类型断言必需),启用 typed-linting 后通过 `files` overrides 关闭上述规则。
  - CI `pnpm typecheck` 全绿方可合并。

### 共享层优先(强制)

- **写新代码前必须先查共享层**,确认是否已有现成实现。禁止在端内(apps/*)重新实现 `packages/` 已提供的功能。
- **检查清单(按顺序)**:
  1. **hooks**: `packages/shared/src/hooks/` — 基础 hook(clipboard/debounce/countdown/form/mounted/pagination 等)和业务 hook(auth/chat/agents/articles/agent-runtime/confirm-dialog 等)共 16 个。各端 `hooks/` 目录应只做 re-export wrapper + 平台 adapter,不得独立实现。
  2. **utils**: `packages/shared/src/utils/` — 工具函数(date-utils/dangerous-command-detector/format/file-helpers/error-messages/jwt-utils/ai-skill-variables 等)。各端 `lib/` 目录应只做 re-export wrapper。
  3. **types**: `packages/types/src/` — 所有跨端类型(ChatMessage/MessageInputFile/WorkspacePermissionMode/User/ApiRequest 等)。禁止在端内重新声明同名类型。
  4. **api-client**: `packages/api-client/src/` — 所有 API 调用。禁止在端内直接用 `fetch`/`axios`/`Taro.request` 调后端,必须走 `@ihui/api-client`。端内可保留 re-export + 平台 adapter(如 AsyncStorage 持久化)。
  5. **stores**: `packages/shared/src/stores/` — 共享 store 工厂(createAuthStore/createThemeStore)。各端 store 应调工厂 + 注入平台 transport,不得重新定义 state shape。
  6. **constants**: `packages/shared/src/constants/` — 跨端常量(storage key/URL/locale key 等)。禁止在端内硬编码同名常量。
- **如果共享层没有**:
  - 评估是否跨端可用 → 如果是,先提取到 `packages/shared/` 再在端内 import,不得直接在端内写。
  - 如果确认平台特有(依赖 DOM/RN API/Taro API)→ 可在端内实现,但必须在文件头注释说明 `// 平台特有:依赖 [DOM/RN/Taro] API,不适合共享`。
- **工厂模式优先**:跨端 hook/util 用工厂函数 + 依赖注入(参考 `createUseClipboard` / `createAuthStore`),各端传入平台 adapter。不得用 `if (Platform.OS === 'web')` 条件分支在共享层处理平台差异。
- **守门**:PR review 时检查是否有端内文件重新实现了共享层已有功能。发现重复 → 要求改为 import 共享层。

---

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅。hover 用 subtle 颜色变化,**不要蓝色发光边框**。复用 `packages/ui-react` 的 Card/Button/Input/Dialog。每个页面 < 250 行。时间用 `Intl.DateTimeFormat`,头像用 initials。状态徽章:draft 灰 / published 绿。积分正数绿色,负数红色。

### 圆角守门(强制)

- **禁止**纯圆形 / 胶囊容器:`rounded-full` / `rounded-pill` / `border-radius: 9999px` / `50%`。尺寸梯度:`rounded-sm`(2px)/ `rounded`(4px)/ `rounded-md`(6px)/ `rounded-lg`(8px)/ `rounded-xl`(12px)/ `rounded-2xl`(16px)。豁免:头像 / 装饰点 / 红点 / Switch 拇指。守门:`scripts/check-rounded-full.mjs` + pre-commit 第 11 项。

### 中文字体 + 图标垂直对齐硬约束(强制)

- **根治方案**:`apps/web/app/globals.css` 设 `--text-vcenter-offset: 0.3px` + 全局规则 `:where(button, a, [role='button'], [role='menuitem']):has(>svg):has(>span) > span { transform: translateY(var(--text-vcenter-offset)); }`,button/a 内 "icon + 中文 span" 同行布局自动应用,text-xs (12px) 用专用 0.7px 规则。配套:`apps/web/src/lib/nav-styles.ts` 5 个共享类 + `<CenteredText>` 组件(`apps/web/src/components/common/CenteredText.tsx`)。
- **守门**:`apps/web/e2e/icon-text-alignment.spec.ts` 阈值 |delta| ≤ 0.15px,漏改 → CI fail。**严禁** `-mt-px` / `margin-top: -1px` 反向微调 hack。

### 禁止分割线(强制)

- 禁止 `<hr>` / `divide-y` / `divide-x` / 单边 `border-t/b/l/r` 当分割线。允许:容器完整描边(`border border-border`)、背景色对比(`bg-card` vs `bg-background`)、间距分隔(`gap-*`)。

#### 单边 border 的明确区分(解决两位开发者的分歧)

历史上出现两种冲突理解:一位开发者认为**所有** `border-t` 一律禁止;另一位认为显式 `border-t border-border/50` 一律允许。现统一为以下规则,**所有** `border-t/b/l/r` 用法必须归入下列两类之一,不得作为纯分割线使用:

- **允许(结构性边框,非分割线)**:
  1. 卡片/面板边缘:作为完整边框系统的一部分,例如带 `border` 的容器其 header 条用 `border-b` 作为容器底边(边框系统的收口,而非在两项之间画线);
  2. 引用块 / 语义强调左边框:`border-l-4` 等作为语义强调(如 blockquote、强调条),而非分隔两项内容的线;
  3. IDE diff 面板等编辑器内 chrome:有意为之的编辑器界面元素。
- **禁止(纯分割线)**:仅在**列表项之间**或**区块之间**用 `border-t/b/l/r` 画一条分隔线,此类场景必须用 `space-y-*` 间距,或 `bg-muted` / `bg-card` 背景对比替代。

> 注:低透明度单边边框(如 `border-t border-border/50`)是典型的"伪分割线",单独守门脚本 `scripts/check-no-divider.mjs` 对其作 **WARN** 告警(非阻塞),提示开发者确认是否为纯分隔用途;纯分隔线务必改用间距或背景对比。此后若确需单边边框,仅限上述"允许"三类情形。

### 禁止渐变遮罩(强制)

- 任何容器禁止 `mask-image` / `-webkit-mask-image` / `linear-gradient` 用作边缘淡出。用显式 UI 元素("查看更多"按钮 / 计数徽章 / 分页)替代。

### 禁用原生提示窗(强制)

- **禁止**使用原生浏览器提示:`title` 属性 / `alert()` / `confirm()` / `prompt()`。必须使用项目自有的 `Tooltip` 组件(`@/components/feedback`)统一提示样式。

### 图标统一用图标库(强制)

- **UI 图标一律用矢量图标库,禁止 emoji 充当图标。** 图标指导航项 / Tab / 按钮 / 状态指示 / 徽章 / 占位默认图标 / 关闭·发送·播放等操作图标 / 章节标题前缀 icon / 等级奖牌等界面元素。
- **web 端**:统一 `lucide-react`(`import { X } from 'lucide-react'`),渲染 `<X className="h-4 w-4" />`;配置数组里的 `icon: 'emoji'` 须改为 `icon: LucideIcon` 组件引用后在渲染处用 `<item.icon className="..." />`。
- **移动端(React Native)**:统一 `lucide-react-native`(`import { X } from 'lucide-react-native'`),渲染 `<X size={16} color={'#6b7280'} />`;颜色按原 `Text` 的 `text-*` 类或 style 颜色意图转十六进制,尺寸按原 fontSize(-xs→12 / -sm→14 / -lg→18 / -2xl→24)。
- **Taro 小程序端(miniapp-taro)**:统一 `apps/miniapp-taro/src/static/images/icons/` 下的 lucide 风格 SVG(24x24,stroke `#6366F1`),渲染 `<Image className="..." src="/static/images/icons/xxx.svg" mode="aspectFit" />`;动态切换用条件 src(如 `{liked ? heart-fill.svg : heart.svg}`);缺失图标用 `node scripts/gen-taro-lucide-icons.mjs <name>` 从 lucide 提取生成(别名如 bar-chart-3 自动解析)。
- **禁止**在 UI 图标位置使用 emoji(如 🏆 🤖 🔥 ✅ ❌ 🎤 🔔 等)。新增图标须先查 `lucide-react` / `lucide-react-native` / Taro `static/images/icons/` 是否有对应名称,无则用近义图标,不得回退 emoji。
- **例外(不强制)**:文档 / 营销页正文里的装饰性 emoji(提示 💡、技术栈列表、章节叙述中的 emoji)属于内容文案,不在此限;但同一页面应风格统一,优先用图标库。
- 守门:`scripts/check-no-emoji-icons.mjs` 扫描 UI 图标位 emoji(icon 字段 / JSX 渲染位 / 三元条件图标),豁免注释、i18n 参数、表情面板、`'★'.repeat` 评分字符串、表格布尔标记、docs/marketing 正文;guardian-runner 第 11h 项(pre-commit staged 模式阻塞 commit)。

### 圆角容器内 absolute 子元素避让

- 父容器 `rounded-xl` + `overflow-hidden` 时,贴边子元素**禁止** `h-full`/`w-full`,用 `top-<radius> bottom-<radius>`(纵向)或 `left-<radius> right-<radius>`(横向)替代。映射:`rounded-lg`→`top-2 bottom-2` / `rounded-xl`→`top-3 bottom-3` / `rounded-2xl`→`top-4 bottom-4`。
- 拖拽手柄用双层 div 结构(外层命中区 + 内层可见细线),**禁止** `before:` 伪元素方案。

### 跨端样式同步铁律(强制)

- web 与 miniapp-taro 视觉必须完全一致(除平台独占差异:登录页小程序端无、rem2rpx 自适应缩放、原生导航栏/tabBar 用 `Taro.setNavigationBarColor`/`setTabBarStyle` 而非 CSS var 等)。**任何一端改了样式/组件/主题,必须同步另一端**——这是交付门槛,不是可选项。
- **单一真相源**:design-tokens 在 `packages/design-tokens/src/styles/tokens.css`(`@theme` + `:root` + `.dark`)。miniapp-taro 的 `app.css :root/.dark` 由 `scripts/sync-design-tokens.mjs` 自动同步,**禁止手改 app.css 的 token 块**;改 token 改源头 + 跑同步。另有 `scripts/check-miniapp-taro-design-tokens.mjs` 校验同步一致性。
- **主题系统**:miniapp-taro 主题根为 `ThemeRoot`(`@/components/ThemeRoot`,内部调用 `useThemeRoot()`),每个路由页 .tsx 顶层须 `<ThemeRoot>...</ThemeRoot>`。设置页切换主题必须调用 `@/lib/theme` 的 `setThemePreference`(同步原生导航栏/tabBar 配色 + 广播事件),**禁止**只用 `Taro.setStorageSync('theme', ...)` 而不同步原生 chrome(否则导航栏/tabBar 不变色)。
- **禁止深色科技风回潮**:app.css 不得再出现 `page{background:#121217}` / `*{font-family!important}` 等全局深色强制覆盖;页面/组件 CSS 不得硬编码禁用色板(`#00f2ff`/`#121217`/`#1f1f28`/`#1a1a2e` 等),一律改用 `var(--color-*`)。
- **禁止同名工具类冲突**:miniapp-taro 的 `app.css` 不得重定义 `.text-primary`/`.mt-*`/`.flex*`/`.align-*`/`.justify-*` 等与 web 端 Tailwind 同名同义类(语义冲突),局部样式用语义化类名 + `var(--color-*`)。
- **守门**:`scripts/check-miniapp-taro-style-parity.mjs`(RULE-1~5:禁用色板 BLOCK / 其他 hex WARN / app.css 回归 BLOCK / 路由页 ThemeRoot BLOCK / tsx 内联 hex WARN / 已删除装饰类复用 BLOCK),接入 pre-commit(`HUSKY_SKIP_MINIAPP_PARITY=1` 跳过)+ `pnpm check:all`。新增路由页忘挂 `ThemeRoot`、改回深色科技风、复用已删装饰类,均会阻塞提交。

---

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js。用 Zod 校验请求参数。复用 `packages/auth` 的 authenticate 函数;admin 路由用 preHandler 统一校验(roleId >= 1)。幂等操作用 `onConflictDoNothing`。slug 从 name 自动生成。API 响应统一 `{ code, message, data }` 格式。

---

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
cd apps/ai-service && mypy app --ignore-missing-imports --strict   # Python 类型(app 源码路径 apps/ai-service/app,继承 pyproject.toml [tool.mypy])
pnpm dev                                       # 启动所有服务(web + api + ai-service,端口见 docs/port-management.md)
```

---

## 7. 删除/重构安全规则(强制)

删除任何 git 对象(分支/stash/commit/文件)前必须回答:① 该内容承载的**功能**是什么?② 当前 monorepo 中是否有**等价的功能实现**?③ 没有 → **不可以删除**,必须先迁移/开发替代。禁止基于"路径不兼容"或"看起来是垃圾"擅自 drop。stash drop / branch -D 同样适用。

---

## 8. goal 模式工作流(强制)

触发 `/goal <目标条件>` 时按本节流程执行。

### 目标条件硬门槛(单条最大 4000 字符)

必须同时包含:核心任务 + 验证标准(命令退出码/测试输出/文件状态/HTTP 响应)+ 约束边界 + 质量要求 + 异常处理。缺一即拒绝启动。示例见对话上下文。

### 运行时文件(强制)

进入 goal 模式第一轮执行前必须在 `.trae-cn/goal-runtime/` 创建:

- `STATE.md`:目标条件 + 状态机(`active`/`paused`/`achieved`/`blocked`/`budget_limited`)+ 当前轮次 + Token 累计 + 最近评估结论 + 硬性指标清单。
- `loop-run-log.md`:逐轮追加(轮次号 + 执行摘要 + 工具调用统计 + 评估结论 `yes|no` + 一行理由)。

### 7 步执行循环

1. 目标解析与初始化(拆分硬性/软性指标,初始化 STATE.md)
2. 单轮任务执行(聚焦核心问题,输出执行摘要)
3. 独立评估校验(基于真实结果,禁止模型自评 yes)
4. 循环判定(yes → 第 5 步;no → 续跑;连续 3 轮 no 无进展 → blocked)
5. 最终交付校验(逐条核对硬性指标)
6. 状态清除与交还控制权(输出交付报告)
7. 整合与清理(目标摘要追加到 PROJECT_PLAN.md,删除 STATE.md + loop-run-log.md)

**子命令**:`<目标条件>` 启动第一轮;`(无参数)`/`status` 查询;`pause`/`hold` 暂停;`resume`/`continue` 续跑;`clear`/`stop`/`off`/`reset` 终止清理;`budget <数值>` 设 Token 上限;`log`/`history` 输出日志。

### 红线规则

- 单目标最大自动迭代 **20 轮**,超出 blocked。
- 高危操作(删分支/强推/删库表/影响生产)**必须暂停**请求人工确认。
- 严格围绕目标,禁止扩展需求、做无关重构。
- 每轮**完整承接上下文**(压缩后必须重读 STATE.md)。
- 连续 5 轮工具失败 → blocked。

### 失败回滚

- `blocked` / `budget_limited` 状态下**禁止** agent 自主执行 `git reset --hard` / `git checkout .` / `git clean -f`。
- 必须在 PROJECT_PLAN.md 记录:已修改文件 + 当前分支 + 起始 commit sha + 未完成原因。
- 回滚决策权归属用户。

---

## 9. 多端同步开发强制规则(强制)

- **默认全端连通**:每一个任务默认 8 端(web/api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)同步开发,"匹配连通好"= 代码同步(共享 types/UI/schema 跨端一致)+ 链路打通(跨端调用无契约/类型/路由/404 错)+ 验证齐绿(各端 typecheck+build+test 全绿)。禁止只改一端交付、单端验证声明完成、分期交付(平台独占豁免除外)。
- **平台独占豁免需显式标注**:仅天然只属特定端(desktop 系统托盘/extension 上下文菜单/miniapp-taro 微信支付/cli 终端集成/纯文档守门脚本)可豁免,必须在 PROJECT_PLAN.md 标注"平台独占"或"单端文档/脚本",未标注按全端同步执行。
- **多端并行派单**:主 agent 优先用 §11 多 Subagent 并行模式按端拆分,每个 subagent 管自己端的代码+typecheck+build;主 agent 负责跨端契约对齐(共享类型/API 路由/schema)和全链路连通验证,不得下放给单个 subagent。
- **登录/SSO 链路跨端自动同步(强制,2026-09-04 立)**:凡改动登录相关 UI/文案/逻辑,必须**主动**同步所有相关端,不得等用户提醒。关键结构事实:① 共享登录 UI 仅覆盖 mobile-rn(`packages/app/src/features/login/LoginScreen.tsx`),**miniapp-taro 登录页是独立实现**(`apps/miniapp-taro/src/pages/login/login.tsx`),两端都要动;② SSO deep-link scheme:mobile-rn/desktop 用 `ihui://sso/callback`,miniapp-taro 用 `ihui-miniapp://sso/callback`,后端白名单由 `apps/api/.env` 的 `SSO_ALLOWED_DEEP_LINK_SCHEMES` 控制,新增 scheme 必须同步登记;③ web OAuth 中转页 `apps/web/app/(auth)/callback/OAuthCallbackHandler.tsx` 的 `redirect=mobile-rn` 分支负责跳 `ihui://oauth/callback` 回 App(支付宝回调参数为 `auth_code`);④ web 端 SSO 出口页为 `apps/web/app/sso/*`(支持 custom scheme 回跳)。
- **守门**(warn-only):`scripts/check-multi-end-sync.mjs` 检测 staged 跨端分布 4 场景(纯豁免目录→pass;触及 packages/* 未标注→warn;触及≥2 端→pass;触及 1 端未标注→warn),集成于 pre-commit 第 21 项。

---

## 9b. 单分支开发强制规则(强制)

- **禁止创建乱七八糟分支,所有改动统一往 main 合并**。除 main 之外**不允许**新建任何本地/远程分支(`feat/*` / `fix/*` / `hotfix/*` / `add-*` / `rescue/*` / 自定义前缀全部禁止)。
- **唯一例外**:`/goal` 模式目标条件强制要求独立分支时,允许创建 `goal/<目标名>` 临时分支(AGENTS.md §8);`goal/*` 完成后**必须立即删除**,不留历史快照。
- **必要分支判断标准**:**单次任务无法在 main 上原子完成**才允许创建(如 8 端并行多 subagent、紧急 hotfix 需独立回滚通道);**普通功能开发、Bug 修复、refactor、文档/守门脚本改动一律禁止创建分支**,全部在 main 上直接 commit。
- **已合并分支立即删除**:任务合并后**本会话内**完成 `git branch -d <已合并>`(本地) + `git push origin --delete <已合并>`(远程),不留"历史快照"分支污染 main 分支列表。
- **删除未合并分支前必须 tag 备份**(AGENTS.md §22 配套):`git tag backup/cleanup-<date>-<branch> <branch>` → `git push origin --atomic refs/tags/backup/cleanup-*` → 再 `git branch -D`。tag 必须本地+远端双备份,防 git gc 清理。
- **fetch + prune 是日常**:`git fetch origin --prune` 在每个 push 周期跑一次,清理已删远程分支的本地 stale 引用。
- **守门**(2026-07-30 立,2026-08-02 落地):
  - `scripts/check-single-branch.mjs`:检测 `git branch -a` 列表中除 main / upstream 外的分支,发现任意 1 个 → exit 1 阻塞 commit。
  - 集成位置:`scripts/guardian-runner.mjs` id 41(blocking),守门不通过则禁止 commit + push。
  - 豁免:§8 goal 模式临时分支(必须带 `goal/` 前缀,且在 `.trae-cn/goal-runtime/STATE.md` 标注 `active` 状态才算合法)。
- **历史教训**(2026-07-30 立):仓库曾积累 12 个分支(本地 6 + 远程 7 + 1 upstream),其中 `add-ihui-ai` / `goal/*` / `rescue/*` 等 13 个无价值分支全部已合并或已被 main 覆盖;3 个未合并分支的内容(LLM 三提供商/i18n 五端/console.log→logger/awesome-prs)均已在 main 后续 commit 中包含或演进,merge 会回退 main 功能。教训:**分支不是"工作单元",是"协作单元"**——单 agent 单任务无需分支,直接 main 提交即可。

---

## 10. 交付报告一致性硬约束(强制)

同一份 .md 报告中**不得**同时出现:"无后续建议" / "完整收尾" / "对话可关闭" 与 "P1-P5" / "优化项" / "TODO" / "后续任务"。守门:`scripts/check-delivery-report-consistency.mjs` + pre-commit 第 12 项。

---

## 11. 多 Subagent 并行开发强制规则(强制)

### 任务分配格式(强制)

派发子任务时必须用以下格式,缺一拒绝执行:

```
## 任务目标
<一句话>

## 受影响文件(绝对路径,只允许以下文件)
- <repo-root>\path\to\file1
- <repo-root>\path\to\file2

## 禁止修改
- 任何不在上述清单的文件

## 验证命令(子任务完成后必须自行运行)
- pnpm --filter @ihui/web typecheck
- pnpm --filter @ihui/api test

## 约束边界
- <API 契约/类型/样式/行为约束>

## 交付物
- 完整代码 + 自验通过 + 一句话总结
```

### 联动规则

- 与第 7 节(删除安全)协同:subagent 不得删除非任务清单内文件。
- 与第 16 节(push保护)和 §20 协同:subagent 完成后由主 agent 统一 push。
- **subagent working tree 自检(2026-07-30 立,真实事故)**:subagent 完成任务后**必须**执行 `git status --short` 自检,确认 working tree 状态符合预期——只有任务清单内文件被修改/新增。如果发现意外文件(其他 agent 改动被 `git stash pop` 带回 / lint-staged 副作用 / IDE 自动 stage / 文件被清成 1 行等异常),**立即停止**并报告主 agent,**禁止**继续 commit/push/补救。主 agent 收到异常报告后按 §12 + §22 处理(revert / 隔离 add / `--no-verify` 跳过其他 agent 代码问题)。
- **stash 操作后强制 Read 验证(2026-07-30 立)**:subagent 在执行 `git stash push` / `git stash pop` / `git stash apply` 后,**必须**用 Read 工具验证任务清单内文件内容完整(防止 stash 误操作把文件清成 1 行或吞掉内容)。Read 返回内容与预期不符 → 立即停止,报告主 agent,**禁止**基于未验证的"假设文件完整"继续操作。

---

## 12. 多会话并行操作同一仓库强制规则(强制)

- 多会话/多 agent 在同一仓库并行工作时,**禁止**任何破坏性 git 操作:`git restore` / `git stash push` / `git clean -f` / `git reset --hard` / `Remove-Item` 删除其他 agent 创建的文件(包括"看着像垃圾"的 `commit_msg.txt` / 临时测试文件 / 调试日志)。
- commit 阶段**只 add 本任务相关文件**:`git add <file1> <file2>`,**禁止** `git add .` / `git add -A` / `git add -u`。
- 正确流程:预检(`git status --porcelain`)→ 隔离 add 本任务文件 → 验证 staged 仅含本任务文件。
- pre-push / pre-commit hook 失败因**其他 agent 引入的代码问题**(schema drift / 其他模块 TS/lint 错误 / 其他 agent 未完成 migration 等,不在本任务范围):**直接用 `--no-verify` 跳过 hook** 完成自己的 commit + push;**禁止**修改其他 agent 代码"帮他们修" / `git reset --hard` / 把"等其他 agent 修复再 push"作为交付结论 / 用 AskUserQuestion 询问用户;自己 commit + push 前只需保证**本任务改动文件** typecheck + lint + build 全绿即可;`--no-verify` 合法场景**仅限**"hook 失败原因是其他 agent 代码",若失败原因是**本任务自己代码**必须修复后正常 commit。

### 强制使用 safe-commit.mjs(2026-08-06 立,真实事故根治)

- **触发背景**:commit `aa15bec23` "fix(web): message-list 消息操作按钮..." 意外包含 `message-input.tsx`(其他 agent 改的 `rounded-t-xl`)。根因:`message-input.tsx` 在 pre-commit hook 执行**前**已被 IDE/其他 agent staged,`takeStagingSnapshot` 把它当成本任务文件,`restoreStaging` 不会 unstage。所有领域级守门(`check-commit-scope` / `check-staged-pollution`)都放过(同目录 `apps/web/src/components/chat/`,scope=web 匹配)。领域级守门**无法防御同目录文件级污染**。
- **强制规则**:多 agent 并行环境(≥2 个 agent 同时工作)下,agent commit **必须**用 `node scripts/safe-commit.mjs -m "<message>" -- <file1> [file2 ...]`,**禁止**直接 `git add <file> && git commit -m "..."`。
- **safe-commit.mjs 5 步法(零信任)**:① `git reset HEAD` 清空整个暂存区(无论谁 staged 的)→ ② `git add -A -- <声明的文件>` 只暂存自己声明的文件 → ③ 校验 `git diff --cached --name-only` === 声明文件(有意外文件立即 exit 1)→ ④ `git commit -- <pathspec>` 原生 pathspec 终极兜底 → ⑤ `git show --name-only HEAD` 验证 commit 内容只包含预期文件。
- **单 agent 环境豁免**:确认无其他 agent 并行时,可直接 `git add <file> && git commit`,但必须先 `git status --porcelain` 确认 staging area 干净(无其他已 staged 文件)。
- **pre-commit hook 配套提示层**(2026-08-06 立):hook 入口调用 `auditStagingFiles()` 打印 staged 文件清单(按目录分组)+ 同目录多文件警告 + 文件数 > 5 严重警告(warn-only,不阻塞)。提示层无法真正阻止污染,真正阻止污染的是 safe-commit.mjs 的 `git reset HEAD` 清空暂存区。
- **红线**:
  - ❌ 禁止多 agent 并行时直接 `git add <file> && git commit`(staging area 可能有其他 agent 残留)
  - ❌ 禁止用 `git add .` / `git add -A` / `git add -u`(会把其他 agent 改动一起 stage)
  - ❌ 禁止忽略 pre-commit hook 的 `📋 staged 文件清单审计` 警告(同目录多文件时必须核对)
  - ✅ 多 agent 并行时用 `node scripts/safe-commit.mjs -m "..." -- <files>`(自动清空暂存区 + 只 add 声明文件 + 校验)
- **git 写操作全局锁**(2026-08-06 立,`.git` 损坏事故根治):所有 git **写**操作(commit/push/pull/rebase/merge/stash/checkout/gc/repack/fetch)在同一仓库必须**串行化**,同一时刻只允许一个写操作单元执行。
  - **已自动生效**:safe-commit.mjs 整个 commit 流程自带锁(`Step 0/5 获取 git 写锁`);post-commit 钩子自动处理直接 `git commit` 场景。**agent 无需额外操作**。
  - **手动 git 命令**必须遵守:执行 `git pull` / `git rebase` / `git fetch` / `git checkout` / `git stash` 等写操作前,先 `node scripts/git-lock.mjs check`(exit 0 = 无锁可执行;exit 1 = 有其他写操作进行中,等待后重试)。
  - **禁止手动 `git gc` / `git repack` / `git prune`**:需要时用 `node scripts/safe-gc.mjs`(自动检查无锁后执行)。autoGc 已禁用(`gc.auto=0` + `maintenance.auto=false`),无需也不应手动触发 gc。
  - **锁异常处理**:锁等待超时会报错并提示;超过 300s 的悬挂锁会自动抢占;紧急可删 `.git/ihui-git-write.lock`(先确认无 git 写进程)。绕过:`IHUI_GIT_NO_LOCK=1`(仅应急,禁用后自行承担并发风险)。
  - **新环境初始化**:重新 clone 后必须执行一次 `node scripts/git-hygiene-init.mjs`(恢复 gc.auto=0 / maintenance.auto=false 防护配置,这些是 local config,clone 不保留)。

### 部署/构建全局锁(2026-08-09 立,并发部署事故根治)

- **事故背景**(8-09 实锤):多 Agent/自动化任务并行触发 `build-next-prod.ps1` 时,两个构建同时备份/清理/写入 `apps/web/.next` → 8801 短暂 502 + 监控报警,产物存在损坏风险。原 `apps/web/scripts/check-lock.js` 只有 dev-vs-build 互斥,**没有 build-vs-build 互斥**;且 `build-next-prod.ps1` 曾引用不存在的 `scripts/check-lock.js`,锁从未生效。
- **锁机制**:`node scripts/deploy-lock.mjs acquire|release|check`(锁 = 项目根 `.deploy.lock` 目录,mkdir 原子性)。build 与 build/dev 全部互斥;dev+dev 共存;stale(10min)+ 超时(10min)自动兜底。
- **已自动生效**:`build-next-prod.ps1` [0/6] 阶段自动 acquire、[7/6] release;web 包 `prebuild`/`predev` 已接入。**agent 无需额外操作,直接跑构建脚本即可**。
- **手动构建必须遵守**:触发 web 构建前先 `node scripts/deploy-lock.mjs check`(exit 0=可构建;exit 1=有其他构建/部署进行中,等待后重试)。**禁止**绕过锁直接 `next build` 或并发触发 `build-next-prod.ps1`。
- **锁异常处理**:超时自动报错;超过 10min 的悬挂锁(持锁进程已死)自动抢占;紧急可删项目根 `.deploy.lock`(先确认无构建进程)。`.deploy.lock/` 已 gitignore。
- **禁止**用 `-CleanCache` 或其它参数绕过锁;多 Agent 协作时若需排队构建,等待而不是强删锁。

### 12b. 协作收尾 SOP (2026-08-18 立, §22c 配套)

当发现其他 agent 正在并行做同一任务时(working tree 与 origin/main 不一致, 或远端新 commit 提到类似功能), 不要立即重写对方主体逻辑, 改走协作收尾路径:

1. **核查现状**: 用 `git diff HEAD --stat` + `git log origin/main..HEAD` 确认
   - 远端是否已 commit (a01fcf4 这种情况)
   - 本地 working tree 是否含对方未提交的改动
   - 对方改动的完整性与正确性
2. **不重写主体**: 仅修复对方代码中的明确缺陷(如测试用例失败、QUIET bug)
3. **最小化改动**: 用 `git add <仅自己改的文件>` 只 stage 自己的改动
4. **--no-verify 跳过**: 因为 hook 会被对方未 commit 的 working tree 改动误判为污染
5. **commit message 标注**: 标题含「(协作收尾)」后缀, 描述中明确
   「不动其他 agent 的主体逻辑」+ 列出具体修复点
6. **push-guard 自动捎带**: push 后 push-guard 会自动捎带其他 agent 的 commit,
   因为 git-pull-rebase --autostash 已同步

### 12c. 并发 commit 防混淆 SOP (2026-08-19 立)

当多个 agent 同时 commit 同一文件时, 可能出现:

- 你的 commit message 描述的是 A, 但 diff 里包含 B 的修改 (race condition)
- 因为另一个 agent 在你 commit 期间 `git add` 了相同/不同文件

防混淆措施:

1. **精确 add**: 用 `git add <具体路径>`, **禁止** `git add .` / `git add -A` / `git add -u`
2. **commit 前验证**: `git diff --cached --stat` 必须与预期文件清单完全一致
3. **commit 后审查**: `git show HEAD --stat` 立即检查 commit 内容, 若含无关文件 → `git reset HEAD~1` 重提
4. **避免同时改同一文件**: 如果发现其他 agent 在改相同文件, 等他完成后再动
5. **接受混合 commit**: 当混合 commit 已 push 到 main 且功能正确, 不要 force-amend, 加一个空 commit 标注"混合 commit 说明"即可

历史案例: d6e8906 + f028e5517b 期间出现"scripts 改动 + api 改动 + mobile-rn 改动"被同一 commit 收录, 后续审计应见此节说明。

### 12d. git worktree 多会话隔离规范(2026-08-31 立,stash 丢失 + 守门误伤事故根治)

- **触发背景**(真实事故链,同日三连):① 多会话共享 working tree,某会话 `git stash push/pop` 冲突导致另一会话已完成的 llm_gateway.py 拦截代码在提交中丢失(提交 diff 只剩 63+/58- 格式化差异);② 守门第 8 项 check-api-routes 全量扫描工作区,104 处"前端调用无后端路由"全部来自其他会话未完成文件,正常提交被阻塞;③ push 门全量 typecheck 报上千 TS 错误全部来自其他会话工作区噪音,推送反复被阻;④ 2026-08-31 补充事故:d22d233091 的 commit message 声称含 §12d 规范但 AGENTS.md 实际 diff 仅 1 行——§12d 本体在提交前被并行会话覆盖工作区而丢失,**commit message 声称的规范条目必须与实际 diff 一致**。根因:**多会话共享同一 working tree + 同一 git index**。
- **第一优先:单写者原则**——同一时刻只允许一个会话写 working tree;并行会话开工前先确认其他会话已收尾(无未提交改动、无进行中 stash)。
- **确需并行写时必须用 worktree 隔离**(与 §9b 单分支规则协同):
  - `git worktree add --detach ../IHUI-AI-wt-<任务名>`(detached HEAD,不占分支名,不违反 §9b)
  - worktree 内正常开发 + commit(本地 sha 可引用;worktree 无 node_modules,hook 必败,可 `--no-verify`)
  - 完成后回主 worktree `git cherry-pick <sha>` 收编,随主 worktree push
  - 收编后立即 `git worktree remove ../IHUI-AI-wt-<任务名>` + `git worktree prune`
- **worktree 内约束**:venv/node_modules 各自安装;端口不得冲突(docs/port-management.md 注册表);共享 DB/Redis 时 schema 迁移互斥。
- **守门兜底(2026-08-31 已落地)**:即使未用 worktree,守门已支持 staged-scope 降级防误伤——① `check-api-routes.mjs`(pre-commit 第 8 项)仅收集暂存区前端文件调用点,暂存区无前端文件→跳过,暂存区为空(手动跑)→保持全量;② 新增 `scripts/check-typecheck.mjs` 包装 push 门全量 typecheck(**判据 = 本次改动范围**:优先 `PUSH_SCOPE_FILES`(pre-push 依 git 传入的 remote_sha..local_sha 计算),暂存区仅兜底;报错文件均不在改动范围内→降级警告放行;解析不到报错文件=tsc 未真正运行→按失败,宁误拦不放过);③ `.husky/pre-push` 第 2 段接入 `node scripts/guardian-runner.mjs --push-gate` 编排。自检:`node scripts/check-typecheck.mjs --self-test`(新增样例 8-12 覆盖 refspec push 与 Next.js 路由组括号路径)。
  - **2026-09-03 push-scope 修复(必读,曾致 push 反复被硬拦)**:原判据只用暂存区,而 `git push <sha>:<ref>` 这类 refspec 推送**不产生暂存区**,若此刻他人也没 staged 文件,降级直接失效 → 他人并行会话的半编辑态报错(实测 miniapp-taro TS1005、web TS2345,单独复验均 0 错误)会硬拦本次 push。故 pre-push 先缓冲 stdin(`PUSH_REFS="$(cat)"`)再回喂 git-lfs,并据 `remote_sha..local_sha` 计算改动文件导出 `PUSH_SCOPE_FILES`;改动文件 >300 时清空该变量退回暂存区兜底(env 有长度上限,截断会漏判→宁可不降级)。同修一处不安全缺陷:tsc 报错正则原排除括号,把 `app/(main)/xxx.tsx` 截断成 `/xxx.tsx`,导致范围内文件匹配不上而**误放行**,现改为「扩展名 + `(\d+,\d+):`」双锚定。
- **全流程已实战演练验证(2026-08-31,主仓零残留)**:worktree add --detach(9785 文件)→worktree 内 commit(--no-verify)→主仓 `cherry-pick --no-commit` 收编验证无冲突→`git restore --staged -- <file>` + 删除文件精准撤销→`git worktree remove` + `git worktree prune`。细则:① cherry-pick --no-commit 验证后**必须立即撤销**,验证/撤销对在同一 git-lock 单元内紧凑完成,防暂存文件被并行会话的 commit 卷入;② 演练/临时文件删除用 `Remove-Item -LiteralPath`(回收站式删除会失败)。
- **应急:主 index 写锁/损坏时用 GIT_INDEX_FILE 旁路提交**(2026-08-31 实战验证,d22d233091 即此法提交):症状为 `fatal: Could not write new index file.`(objects 可写、磁盘充足、无 index.lock)→ 主 index 被外部句柄锁定。手法:`$env:GIT_INDEX_FILE = "$env:TEMP\ihui-index-recover"` 后照常跑 safe-commit 全流程(写入临时 index,主 index 不被触碰);旁路期间 staged-scope 守门读到的暂存区恰为本次声明文件,反而更精准。收尾:`Remove-Item Env:\GIT_INDEX_FILE` 必须清除防污染后续命令;事后 `git reset` 修复主 index(`git write-tree` 应返回非空树)。
- **stash 清理零损失流程(2026-08-31 实例:backup/stash-temp-other-sessions-8e1863c)**:`git tag backup/stash-<名>-<sha7> '<stash-ref>'` → `git rev-parse` 验证 tag 与 stash SHA 一致 → `git stash drop '<stash-ref>'`。tag 指向原 stash commit,内容永不丢失,随时 `git stash apply <tag>` 可恢复。
- **红线**:
  - ❌ 禁止多会话并行时执行无路径限定的 `git stash push` 全仓快照(2026-08-31 事故:stash@{0} 沦为 1781 文件巨型快照,恢复冲突即丢代码);必须 stash 时用 `git stash push -- <具体文件>`
  - ❌ 禁止在非 worktree 场景用 detached HEAD 承载长期开发(commit 游离无引用)
  - ❌ 禁止 commit message 声称未落盘的规范/代码条目——commit 前 `git show --stat`(或 `git diff HEAD --stat`)核对声称内容与实际 diff 一致(2026-08-31 d22d233091 事故教训)
  - ✅ worktree 收编前 `git log <sha> --stat` 核对内容,收编后 `git worktree list` 确认清理
  - ✅ 怀疑脚本被外部进程(水印/注入)污染时:`node --check` 取证 → `git show HEAD:<path>` 验证基线 → `git restore --source=HEAD --worktree -- <path>` 恢复 → 冒烟(2026-08-31 git-lock.mjs 修复实例:水印进程追加零宽 Unicode 行致 SyntaxError)

---

## 13. 文件修改持久化强制规则(强制)

- 任何文件修改后**必须立即用 Read 验证**修改已落地(防止文件系统缓存不一致)。
- 大文件(>500 行)修改后,Read 验证时**必须读取修改区域 ±50 行**,确认上下文完整。
- 若 Read 返回内容与预期不符(陈旧缓存),**必须**重读最多 3 次,仍不符则停止并报告用户。
- **禁止**基于未验证的"假设修改已成功"继续后续操作。

---

## 14. Agent 自主验证强制规则(强制)

- Agent **必须独立完成**它能完成的验证(browser_use / API 测试 / 文件检查 / 命令执行),**禁止**要求用户代为验证。
- **禁止**在交付报告中写"请你刷新浏览器查看效果" / "请你启动 dev server 验证" / "请你手动测试"等甩锅措辞。
- 验证失败时,记录失败原因 + 已尝试方法 + 建议下一步,**不**得假装验证通过。

---

## 15. 工作区卫生强制规则(强制)

**禁止项**:① 在 `G:\` 根目录创建任何文件;② 项目数据(扩展打包/Chrome profile/构建副本/临时 DB/临时配置)写到项目外路径;③ 硬编码 `C:\temp\ihui-*`/`$env:TEMP\ihui-*` 等项目外路径;④ agent 用 RunCommand/PowerShell/Out-File/Set-Content/New-Item 在项目外直接创建文件;⑤ 在 `G:\` 根目录运行 Qt 类外部工具或执行 pnpm 命令(会创建 `.pnpm-store` v11 冲突);⑥ 硬编码中文绝对路径(GBK 乱码)。路径推导用 `$PSScriptRoot`/`__dirname`/`import.meta.url`。唯一例外:纯系统日志(`debug.log`/`next-server.log`)可写 `$env:TEMP`。

**必须用项目内路径**(根 `g:\IHUI-AI`):扩展打包→`apps/extension/.output/chrome-mv3/`;Chrome profile→`.trae-cn/tmp/chrome-profile/`;临时副本→`.trae-cn/tmp/<任务名>/`;临时脚本→`.trae-cn/tmp/<脚本名>.ps1`;临时文件统一放 `.trae-cn/tmp/`(已 gitignore),任务完成后清理。

**守门脚本**:

- `check-workspace-hygiene.mjs`(第 25 项 BLOCKING:项目外路径写入;WARNING:硬编码中文路径)
- `check-parent-pollution.mjs`(第 26 项 BLOCKING:项目父目录递归 2 层+桌面根级+用户主目录巡查,命中=文件名强信号 `search_*.ps1`/`*_result.txt` 或内容双信号)
- `cleanup-external-junk.ps1`(G:\ 垃圾清理,16 目录+31 文件,`-Force` 跳过确认)
- `g-root-guardian.ps1` v2.0(G:\ 实时守门,FileSystemWatcher+白名单优先 5 层判定,~110-222ms 删除,Windows 计划任务自启)+ 配套 `g-root-blacklist.json`/install/uninstall/status 脚本
- post-commit 自动 `--auto-clean --quiet`(仅清文件名强信号);TRAE 定时 08:00 巡查;跳过 `HUSKY_SKIP_HYGIENE=1`。历史案例见 `.trae-cn/archive/AGENTS_history.md`。

---

## 16. Push 阶段跨 Agent 改动保护规则(强制)

- 本 agent 完成 commit + push 后,不再触碰 working tree,不执行 `git pull` / `git fetch` / `git rebase` / `git push --force`。
- 抹除其他 agent 改动 → **协作事故**;混入其他 agent 改动到自己 commit → **污染事故**;修改其他 agent 文件"帮他们修" → **越权事故**。
- `--no-verify` 跳过 hook 的合法性:见 §12 最后一条(hook 失败因其他 agent 代码 → 合法跳过;本任务代码 → 禁止跳过);`--no-verify` 不是流程事故,前提是本任务改动文件已通过 typecheck + lint + build。

---

## 17. UI 改动验证强制规则(强制)

**触发条件**:UI 样式/布局/交互改动(CSS/className/style/组件结构/Tailwind 类/shadcn props)。

**强制动作**(缺一不可,违反视为交付事故):

1. 改码前 browser ping `http://localhost:8801` 确认服务在线,不通则先启动 web+api+ai-service(端口见 `docs/port-management.md`)。
2. 改码后确认 web+api 服务在跑(browser 实际访问)。
3. 用 browser_use subagent 渲染目标页面,截图自验 4 状态:默认/hover/active/dark mode。
4. 读 DOM 数值验证样式生效(`getAttribute`/`getComputedStyle`,禁止只靠截图)。
5. 交付附 4 状态截图 + "已自验通过"声明;服务起不来禁止交付。

**commit message trailer**:含 `apps/web/**/*.css` 改动必须附 `Verified-DOM: http://localhost:8801/<path> (<DOM 属性=数值> ...)`,commit-msg hook 自动守门。

**Next.js CSS 缓存陷阱**:改 globals.css/styles 后 HMR 不一定重编译 CSS chunk,必须 curl 当前 CSS chunk 验证新值;`grep -c` 返回 0 → kill 旧 next-server 重启 `pnpm --filter @ihui/web dev`,等 15s 重新 curl 确认。

**工具故障应急**:dev server 永远只在 TRAE 内部运行(`RunCommand long_running_process`+`blocking=false`),禁止 `Start-Process` 派生独立窗口。RunCommand 连续 2 次返回空输出 → 判定失联 → 告知用户在 TRAE 终端面板手动执行。工具反复失败时先 Grep project_memory.md 查已知约束。

**豁免**(允许跳过 browser_use):① 纯后端 API(curl 验证);② 纯类型/工具函数(typecheck+test);③ dev server 30 分钟无法修复(降级单元测试);④ CI 环境(e2e)。历史案例见 `.trae-cn/archive/AGENTS_history.md`。

---

## 18. 启动项目语义(强制)

用户说"启动项目" = 前后端全链路同步启动:web + api + ai-service(端口见 `docs/port-management.md`),必要时检查并启动数据库 / Redis。禁止只启动前端就交付。

---

## 19. i18n 约束规则(强制)

### 翻译文件语言纯度

- **zh-CN.json**:基准语言文件,其他 4 语言必须 parity(key 集合完全一致)。
- **zh-TW.json**:繁体中文,禁止简体字(pre-commit 第 2b 项,opencc 字形转换检测,阻塞)。
- **ko.json**:韩语,禁止中文残留(第 2c 项,字符范围检测,阻塞)。
- **ja.json**:日语,禁止中文残留(第 2d 项,warn-only,日文汉字词易误报)。
- **en.json**:英文,禁止中文残留 + 禁止破碎机翻(第 2e 项,阻塞)。

### JSON 重复键禁止

- 同一对象内禁止重复 key(`JSON.parse` 时最后一个生效,前面被 shadowed)。
- 添加新键前 Grep 确认同级命名空间无同名块(models/nav/sort/market 等高频命名空间尤需注意)。

### 翻译策略(source of truth:`scripts/brand-glossary.json`)

- 品牌名/公司名/字体名/技术术语:优先 canonical 英文名(智谱清言→Zhipu AI, 宋体→SimSun, 物联网→IoT)。
- 人名:fictional/示例数据用拼音(李思涵→Li Sihan / 리쓰한 / リ・スハン);称呼符合目标语言习惯(李总→이 대표)。
- 占位符 `{var}` / `{{var}}` 必须原样保留。
- zh-TW 用繁体字形(简体→繁体);ko 用 Hangul;ja 汉字词允许(登録/確認/削除)但简体字残留改日文习惯;en 禁破碎机翻(如 AgentDevPlatform)。

**守门工具**:`scan-i18n-zh-residue.mjs <locale>`(zh-TW/ko 阻塞,ja warn)/ `check-i18n-broken-en.mjs`(en 破碎机翻,阻塞)/ `check-i18n-keys.mjs --staged`(key 完整性+parity+白名单)/ `brand-glossary.json`(canonical 映射表)+ `apply-brand-glossary.mjs [--dry-run]` / `i18n-diff.mjs`(差异检测,输出 pending.json)/ `i18n-apply.mjs [--check]`(应用器,按 zh-CN 重排 key+parity 校验)/ `check-i18n-namespace-passing.mjs`(检测 useTranslations('xxx') 限定命名空间 + 把 t 传给 @ihui/ui-react 共享登录组件的 bug 模式,warn-only)。

**AI 翻译流水线**(强制,零用户算力):zh-CN.json 新增/修改 key 后必须执行:① `i18n-diff.mjs` 检测差异生成 pending.json;② AI agent 读 pending.json+brand-glossary.json 自行翻译;③ 写 i18n-translations.json(`{ translations: { [lang]: { [key]: value } } }`);④ `i18n-apply.mjs` 应用到 4 语言;⑤ `check-i18n-keys.mjs` 验 parity;⑥ `scan-i18n-zh-residue.mjs ko/zh-TW` 验无残留。

**守门集成**:web(第 2f-web 项 blocking,仅 staged 涉及 zh-CN.json 时);miniapp-taro(第 2f-miniapp-taro 项 blocking,`--target=miniapp-taro`);多 agent 并行时其他 agent 改 target locale 不触发阻塞。

---

## 20. 任务完成硬定义 — 杜绝"commit 后忘记 push"协作事故(强制)

### 任务完成的硬定义(5 条全满足才可声明"完成")

1. ✅ **本地有 commit**:`git log --oneline -1` 显示本次任务的 commit SHA
2. ✅ **工作区干净**:`git status --short` 无本任务残留 untracked / modified
3. ✅ **origin 同步**:`git push origin <branch>` 成功,stdout 含 `X..Y <branch> -> <branch>`
4. ✅ **HEAD 对齐**:`git rev-parse HEAD` === `git rev-parse origin/<branch>`
5. ✅ **守门脚本通过**:`node scripts/git-push-guard.mjs` exit 0

### 4 道自动防线

1. **pre-commit**:`check-push-sync.mjs`(guardian 第 29 项 blocking),commit 前检测本地 ahead(`git rev-list --count origin/<branch>..HEAD`),>0 阻塞;跳过 `HUSKY_SKIP_PUSH_SYNC=1`(不推荐);归档 commit `IHUI_ARCHIVE_COMMIT=1` 豁免。
2. **post-commit(主防线)**:`git-push-guard.mjs` 自动检测 ahead → push + 验证 local == remote,失败阻断提示手动 push;跳过 `HUSKY_SKIP_PUSH=1`(不推荐)。
3. **pre-push**:`.husky/pre-push` 第 2 段跑 `guardian-runner --push-gate`(2026-08-31 改版 / 2026-09-03 push-scope 增强:check-typecheck.mjs 包装,**判据优先 PUSH_SCOPE_FILES 本次推送改动范围,暂存区兜底**——报错文件均不在改动范围内时降级警告放行,防并行会话工作区噪音误伤,见 §12d),失败阻止 push(commit 仍本地保留);跳过 `HUSKY_SKIP_TYPECHECK=1`(不推荐)。
4. **手动兜底**:`node scripts/git-push-guard.mjs` 任何时候可手跑,打印 local vs remote HEAD,完全对齐 exit 0。

### 红线(违反视为协作事故)

- ❌ 禁止 commit 后只输出"已 commit"就声明任务完成,必须 push + 验证
- ❌ 禁止交付报告遗漏 "local HEAD == remote HEAD" commit SHA 对照
- ❌ 禁止用 `--no-verify` 绕过 `git-push-guard`(除非 typecheck 自验通过且显式说明)
- ❌ 禁止把 "git push 失败" 作为交付结论(必须修复后重推或显式说明阻塞原因)

### 交付报告必含证据

```
## Git 同步证据
- 本地 commit: <sha>
- origin commit: <sha>
- 同步状态: local == remote ✅ / 落后 N 个 commit ⚠️
- 守门脚本: node scripts/git-push-guard.mjs exit 0
```

### 工具失联处理流程

- **触发条件**:RunCommand 连续 ≥2 次返回 `{Exited, exit_code 0, 空输出}`(连 `Write-Output "test"` / `git --version` 都无输出),判定平台级故障。
- **红线**:禁止把 git 命令清单甩给用户作为交付物;禁止把"用户手动执行"作为完成结论;禁止用"工具失联"停止 retry;必须自己完成 commit+push+验证;工具失联时报告"blocked"状态不声明完成;工具恢复后立即执行 git 流程;唯一例外是用户主动说"我来手动执行"。
- **retry 策略**:首次失联用 `Write-Output "alive-test"` 探测 → 每隔 1-2 轮 retry RunCommand(可派 subagent 尝试) → 持续 retry 不放弃 → 恢复后立即执行完整 git 流程(add → commit → push → git-push-guard 验证)。
- 历史案例见 `.trae-cn/archive/AGENTS_history.md`。

---

## 21. 功能开发同步更新 README 规则(强制)

### 触发条件

任务**新增 / 修改 / 删除**以下任一类别能力:

- 新功能模块(新增 P3 深度层 / IM 渠道 / 沙箱后端等)
- 现有功能重大调整(API 路由变更 / 架构重构 / schema 迁移)
- 守门规则 / 工程约束新增(本节本身即触发例)
- 项目对外能力清单变化(支持的平台 / 厂商 / 模型 / 端)

### 强制动作(缺一不可,违反视为交付事故)

1. **同步修改根目录 `README.md`**:在对应章节(功能特性 / 架构 / 平台支持 / 守门规则)更新文字 + 表格。
2. **README 改动必须与本任务代码同 commit 提交**:禁止"代码先 push、README 下一轮补"的分期模式。
3. **README 必须可被 git 远端可见**:commit + push 后 `git rev-parse origin/main` 必须包含 README 改动(由 §20 git-push-guard 自动验证)。
4. **交付报告必须含 "README 更新证据"**:列出修改的章节 + 行数变化。
5. **禁止以"下一步建议"形式把 README 同步留给下一轮**:本任务触发条件则 README 同步属本任务一部分,不得列为 P1/P2 遗留项或"最优下一步建议",违反视为交付事故。

### 豁免场景(允许不更新 README)

- 纯 bug 修复(不改变对外能力)
- 纯重构(不改变功能契约)
- 纯测试 / 文档 / 守门脚本改动(不改变运行时能力)
- 纯配置 / 依赖升级(不改变功能清单)
- 单端内部优化(不改变跨端契约)

### 守门(warn-only)

- `scripts/check-readme-sync.mjs`:staged 中有 `apps/` / `packages/` 下功能代码改动但 `README.md` 不在 staged → warn 提醒。
- 集成位置:`.husky/pre-commit` 第 22 项(warn-only,不阻塞 commit,只提醒)。
- 历史案例见 `.trae-cn/archive/AGENTS_history.md`。

---

## 22. 防止 commit / push / merge 提交丢失硬性规则(强制)

### 触发背景(2026-07-25 立,真实事故)

reflog 记录 18:12-18:20 期间发生 **6 次 `reset: moving to HEAD~` 操作**,导致 3 个本地 commit 在 main 历史中消失:

- `15b984f90` "fix(api): P0 安全债并行修复"(ws-chat/ws-tasks IDOR + payment-gateway 金额反查)
- `5ef36e59d` "fix(web): sidebar 折叠按钮图标 16→20px" 第一次
- `b120c6e20` "fix(web): sidebar 折叠按钮图标 16→20px" 第二次

幸运的是这 3 个 commit 的工作内容已通过后续 commit(`ce3116ebd` merge + `ff7f744e0` 重做)重新整合到 origin/main,但 commit 本身已不可追溯,git log 不再显示原始 commit hash。

**根因**:多 agent 并行 + 某 agent 自动化流程使用 `git reset` 时,未考虑对其他 agent 本地 commit 的影响,导致 reset 把整个 commit 链(包括其他 agent 的工作)一并丢弃。

### 硬性规则(违反视为协作事故)

1. **禁止**在共享分支(任何已 push 过的分支,包括 main)使用 `git reset --hard`。
2. **禁止**使用 `git reset HEAD~N` / `git reset --soft HEAD~N` 撤销本地 commit(在多 agent 并行环境下,该 commit 可能被其他 agent 依赖)。
3. **禁止**使用 `git push --force` / `git push --force-with-lease`(已 push commit 的"撤销"必须用 `git revert`)。
4. **撤销已 push 提交必须用 `git revert`**:产生新 commit 撤销改动,保留原始 commit hash,所有 agent 都能看到完整历史。
5. **撤销本地未 push commit 推荐 `git revert`**(同样产生新 commit 保留历史);仅在确认 commit 内容无价值、且无其他 agent 引用时,才考虑 `git reset`(不推荐,需记录在 commit message)。
6. **禁止** `git stash drop` / `git stash clear`,除非先 `git stash show <id> --stat` 确认 stash 内容已合并到 working tree 或其他 commit;lint-staged 自动创建的 stash 必须保留至少到 commit 成功后下一次 git gc 周期(默认 14 天)。
7. **多 agent 并行 reset 前必须**:`git log --all --oneline | grep <other-agent-commit-sha>` 确认无其他 agent 引用;并在 `PROJECT_PLAN.md` 记录"reset 影响范围 + 已 tag 备份的 commit hash"。

### 已被 reset 丢失的 commit 永久记录(tag 备份)

3 个被 reset 的 commit 已用以下 tag 永久保留(防止 git gc 清理):

- `lost-commit/P0-security-debt` → `15b984f90`(P0 安全债)
- `lost-commit/sidebar-fold-btn-1` → `5ef36e59d`(sidebar 按钮第一次)
- `lost-commit/sidebar-fold-btn-2` → `b120c6e20`(sidebar 按钮第二次)
- `backup/pre-drop-recovery` → `251956eb6`(恢复前主分支快照)

可通过 `git show <tag-name>` 查看完整 commit 内容;`git tag -l "lost-commit/*"` 列出所有丢失 commit tag。

### 守门(blocking 升级已完成,2026-07-25)

`scripts/check-commit-loss-guard.mjs`(guardian-runner 第 30a 项,2026-07-25 升级为 blocking):

- ✅ **已升级 blocking**:`guardian-runner.mjs` 第 30a 项以 `node scripts/check-commit-loss-guard.mjs --blocking --filter-stash` 调用
- pre-commit 前扫描 `git reflog --all --date=iso` 最近 50 步(2026-07-26 扩),检测是否含 `reset: moving to HEAD~` 模式
- 扫描 `git fsck --unreachable --no-reflogs` 检测是否有悬空 commit
- 5 段检查流程(2026-07-26 强化):reflog reset / fsck 悬空 / lost-commit tag / backup tag / 远程 tag 完整性
- 发现 reset 操作或未备份悬空 commit → exit 1,阻塞 commit
- **悬空 commit 备份**:被 reset / drop 的 commit 一旦出现在 `git fsck --unreachable` 输出中且无 `lost-commit/*` tag 备份,即为"未备份悬空 commit",会阻塞 commit——需先执行 `git tag lost-commit/<name> <hash> -m "lost via reset"` 永久保留(防止 git gc 清理),再重新 commit
- 紧急跳过:`HUSKY_SKIP_COMMIT_LOSS_CHECK=1 git commit ...`
- 详细档案:见 [docs/lost-commit-archive.md](./docs/lost-commit-archive.md)

### 自动化 tag 同步(2026-07-26 立)

`scripts/sync-lost-commit-tags.mjs`(本任务新增)+ `.husky/post-commit` 第 5 段集成:

- **自动 push**:每次 commit 后自动 `git push origin --atomic refs/tags/lost-commit/* refs/tags/backup/*`,防止本地 git gc 清理 tag 后无远端备份
- **手动 fetch**:`node scripts/sync-lost-commit-tags.mjs --fetch` 一键从 origin 拉回所有 lost-commit/backup tag
- **手动 check**:`node scripts/sync-lost-commit-tags.mjs --check` 校验本地+远端 tag 一致性 + tag 对象可达性
- **package.json scripts**:`tag:sync` / `tag:sync:check` / `tag:sync:fetch` / `tag:sync:push`
- **紧急跳过**:`HUSKY_SKIP_TAG_SYNC=1`
- **触发背景**:2026-07-26 04:23 真实事故 — 本地 tag 被 git gc 清理,远端虽有但 fetch 失败(因为 fetch 默认不包含 tag,需要明确 refspec)
- **详细档案**:见 [docs/lost-commit-archive.md](./docs/lost-commit-archive.md) "🛡️ 防护机制" 段

### 历史案例

`.trae-cn/archive/AGENTS_history.md` 记录每次 reset 事故 + 已采取的 tag 备份措施。

---

## 22b. staged-typecheck 闸门:全量 include + 错误过滤(2026-08-18 立,根治改版)

### 触发背景

pre-commit 第 16 项「条件 typecheck 闸门」原策略:临时 tsconfig 只 include staged 文件 → 模块扩展(declare module 'fastify' 等)未被加载 → 报 TS2339 假阳性(如 `pushNotification` / `isMultipart` / `file`)。多 agent 并行时,任何 agent 改一下 ws-notifications.ts 都会让其他 agent 的 web 包 typecheck 失败 100% 误阻塞。

### 核心策略(根治)

`scripts/check-staged-typecheck.mjs`:

- **临时 tsconfig 沿用 package 原始 tsconfig 的【全量 include】**,完整加载所有模块扩展与全局类型,消除 TS2339 假阳性。
- **tsc 输出按行解析**,只把【错误文件属于 staged 文件】的错误视为失败;其他 agent 引入的非 staged 文件错误自动过滤、不阻塞。
- tsc 未能真正运行(如 pnpm/tsc 未找到、进程崩溃、空输出)按失败处理,**禁止静默通过**。
- 临时 tsconfig 清理加重试(Windows transient file lock 兼容);`.gitignore` 已加 `**/tsconfig.staged-typecheck.json` 防残留误入库。

### 守门集成

- `scripts/guardian-runner.mjs` 第 16 项 blocking(已有调用 `node scripts/check-staged-typecheck.mjs --staged`)
- 跳过方法:`HUSKY_SKIP_STAGED_TYPECHECK=1 git commit ...`(应急)
- 适用范围:任意 staged .ts/.tsx 文件(不限 apps/web)
- 自动跳过:apps/ai-service(Python,走 mypy)、apps/desktop(无 typecheck script)、packages/eslint-config / packages/tsconfig(纯配置包)等无 typecheck script / tsconfig 的 package

### 红线规则

- ❌ 禁止把临时 tsconfig 的 include 缩窄到 staged 文件(会回退到旧 partial-include 假阳性 bug)
- ❌ 禁止把 `**/tsconfig.staged-typecheck.json` 从 .gitignore 移除(Windows 偶发 unlink 失败可能残留)
- ❌ 禁止把 `sawAnyTscError` 移除(若 tsc 未能真正运行,必须按失败处理,不能静默通过)
- ✅ 修改 `filterTscOutputForStagedFiles` / `getOriginalInclude` 时必须同步更新 `scripts/tests/check-staged-typecheck.test.mjs`(镜像常量同步锚点:源脚本第 298-327 行 / 244-256 行)
- ✅ 修改源脚本 `check-staged-typecheck.mjs` 的核心函数时,必须同步:
  1. 测试文件 `scripts/tests/check-staged-typecheck.test.mjs` 中的镜像常量
  2. 跑 `scripts/check-staged-typecheck-mirror-sync.mjs` 验证指纹一致

---

## 22c. 镜像常量守门模式规范(2026-08-18 立)

### 背景

部分核心工具脚本(如 `scripts/check-staged-typecheck.mjs`)导出大量内部辅助函数,而测试文件 `scripts/tests/*.test.mjs` 由于路径隔离 / 模块副作用 / 静态导出冲突等原因,**无法直接 `import` 源函数**。沿用"测试文件里复制一份相同实现的镜像常量"做法虽然能跑通断言,但形成两套并行真相:任何对源函数签名的修改(参数顺序、返回值结构、过滤规则常量)必须**手动同步**到测试文件;一旦遗漏,测试将持续"假绿"(通过旧逻辑断言已不存在的字段),守门形同虚设。

### 根治路径(三步)

1. **源函数 export**:把核心函数从源脚本顶部 export 出去,确保测试环境可解析(注意 `.mjs` 必须用 `export` 关键字,且不引入副作用代码)。
2. **测试直接 import**:测试文件 `import { __test__ as <别名> } from '../source.mjs'`,消除"两份真相"。
3. **守门脚本检测 export 锚点**:`scripts/check-staged-typecheck-mirror-sync.mjs` 持续校验:
   - 源文件必须存在并 export `__test__` 对象
   - `__test__` 必须包含指定的函数键(本场景:`getOriginalInclude` / `normalizePath` / `filterTscOutputForStagedFiles`)
   - 测试文件必须存在对应 `import { __test__ as ... } from '../source.mjs'` 语句
   - 任意锚点缺失即 exit 1 报错(提示"镜像常量漂移,需走 §22c 协作收尾")

### 守门脚本工作机制(`check-staged-typecheck-mirror-sync.mjs`)

- **阶段 A · 检测源文件存在**:确认 `scripts/check-staged-typecheck.mjs` 存在于工作区(防止路径漂移)。
- **阶段 B · 检测 export const **test** 锚点**:用正则匹配 `export const __test__ = { ... }`,并校验三个键 (`getOriginalInclude` / `normalizePath` / `filterTscOutputForStagedFiles`) 均出现在对象字面量中(防止 export 但漏字段)。
- **阶段 C · 检测测试文件 import**:确认 `scripts/tests/check-staged-typecheck.test.mjs` 存在 `import { __test__ as ... } from '../check-staged-typecheck.mjs'` 语句(防止 import 路径写错 / 别名错配)。
- **触发场景**:任何对 `check-staged-typecheck.mjs` 的核心函数修改后,pre-commit hook 自动跑该守门脚本;若 export 锚点漂移,立即阻断 commit 并提示同步测试 import。

### 可复用模板

检测模式(正则 + 字符串匹配 + import 锚点)可复用到其他类似场景:

```javascript
// 伪代码:三阶段检测模板
const source = readFileSync('scripts/<source>.mjs', 'utf8')
assert(source.includes('export const __test__ = {'), 'phase B: missing __test__ export')
const requiredKeys = ['funcA', 'funcB', 'funcC']
for (const k of requiredKeys) assert(source.includes(`${k}:`), `phase B: missing key ${k}`)
const test = readFileSync('scripts/tests/<source>.test.mjs', 'utf8')
assert(
  /import\s*\{\s*__test__\s+as\s+\w+\s*\}\s*from\s*['"]\.\.\/<source>\.mjs['"]/.test(test),
  'phase C: missing __test__ import in test file',
)
```

可复用到:任何"测试文件无法直接 import 源函数"的工具脚本场景(如 `scripts/check-commit-scope.mjs` / `scripts/check-staged-pollution.mjs` 等)。

> 📌 配套使用: 本模板的入口守护需搭配 §22d `isDirectRun` 模式使用, 避免 import 时 main() 误触发。

### 红线规则

- ❌ 禁止在测试文件中**复制**源函数实现(产生镜像常量漂移风险)
- ❌ 禁止修改源函数签名后**不更新** `__test__` 对象的导出键(守门立即失败是预期行为,不是 bug)
- ❌ 禁止删除 `check-staged-typecheck-mirror-sync.mjs` 中的任何一项锚点检测(削弱守门强度)
- ✅ 修改源函数后必须 `pnpm test scripts/tests/check-staged-typecheck.test.mjs` + 跑 mirror-sync 守门脚本双验证
- ✅ 新增工具脚本若需要被测试直接 import,必须遵循"源文件 export `__test__` + 测试 import + 守门脚本三阶段检测"模板

---

## 22d. `isDirectRun` 模式规范:ESM 脚本"双形态"入口守护(2026-08-18 立)

### 背景

部分 `.mjs` 工具脚本(如 `scripts/check-staged-typecheck.mjs`)需要同时支持两种使用形态:

1. **CLI 直接执行**:`node scripts/foo.mjs`(命令行手动跑 / pre-commit hook 调用 → 必须自动执行 `main()`)。
2. **模块被 import**:`import { __test__ } from './foo.mjs'`(测试文件复用导出符号 → **绝不**触发 `main()` 副作用)。

ESM(`.mjs`)模块与 CJS(`.cjs` / `.js` + `"type": "module"`)的求值模型:**顶层代码仅在被 import 时执行一次**,但**直接 `node foo.mjs` 时同样会执行顶层代码**。这意味着 — 如果脚本顶层直接写 `main().catch(...)`,测试一旦 `import` 该模块,就会**连带触发 CLI 主流程**(批量跑 typecheck、写临时 tsconfig、调 git diff),把测试环境搞炸,或更糟 — 在测试用例之间留下真实副作用(临时文件未清理、staged 状态污染)。

### 根因:`import.meta.url` vs `process.argv[1]`

- **`import.meta.url`**:ESM 模块加载器注入,恒为**当前模块文件**的 `file://` URL(无论是被 import 还是直接 node 执行,值都相同:指向 `foo.mjs` 自身)。
- **`process.argv[1]`**:Node 启动时传入的第一个脚本参数,只在**直接 node 执行**时等于本模块路径;被 import 时为 undefined 或与本模块无关。

因此判定**"本模块是不是被直接 node 执行"** 可用:`import.meta.url === pathToFileURL(process.argv[1]).href`。两者相等 ⇒ 直接执行,触发 `main()`;否则 ⇒ 被 import,跳过副作用。

> ⚠️ **跨平台陷阱**:Windows 路径是反斜杠 `C:\foo\bar.mjs`,不能直接拼成 `file://` URL,否则 `import.meta.url`(始终是标准 `file:///`)与字符串永远不匹配。**必须**经 `node:url` 的 `pathToFileURL()` 归一化。

### 可复用模板

在 `.mjs` 脚本**底部顶层**(所有 export 之后)粘贴以下 4 行(已适配 Windows / Linux / macOS,推荐用项目现存形式而非手写字符串拼接):

```javascript
import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {/* 暴露给测试的核心函数 */}
```

位置约束:

- `__test__` 的 `export` 必须放在 **`if (isDirectRun)` 之后**(否则 ESM 提升可能在测试 import 时机前完成,语义仍正确但不直观;且与 §22c "镜像常量守门" 的 `import { __test__ as ... }` 锚点要求一致,便于 grep)。
- `main()` 自身声明应保持文件靠前位置(便于阅读),`if (isDirectRun)` 仅触发调用,**不**延迟或重写 `main`。
- `process.exit(2)` 复用 §22b 中"异常 vs 失败"的退出码约定(2 = 脚本自身异常,1 = 业务失败)。

### 与 §22c 的关系

`isDirectRun` 是 **§22c 镜像常量守门模式的使能条件**。没有它,§22c 的"源文件 export `__test__` + 测试 import"做法会因为 `main()` 顶层自动执行而不可行 — 测试一旦 import 就会触发 CLI 主流程,副作用污染测试环境(写临时文件、调 git 改 staged 状态、写控制台横幅噪音),`vitest` / `node --test` 都会在 setup 阶段立即崩。`isDirectRun` 把"CLI 入口"和"模块导出"两种用法的副作用隔离开,使 §22c 的 export / import 双真相消除得以落地。

两者协作的最小工作流:

1. 源 `.mjs` 脚本加 `isDirectRun` 守护(本节模板)。
2. 源脚本 export `__test__ = { fn1, fn2, ... }`(§22c 第 1 步)。
3. 测试文件 `import { __test__ as X } from '../source.mjs'`(§22c 第 2 步)— 因 `isDirectRun=false`,`main()` 不执行,仅拿到导出对象。
4. 守门脚本 `scripts/check-staged-typecheck-mirror-sync.mjs` 三阶段检测 export / key / import 锚点(§22c 第 3 步)。

### 红线规则

- ❌ 禁止在 **CommonJS / `.cjs`** 脚本中使用 `isDirectRun`(`.cjs` 没有 `import.meta`,需走 `require.main === module` 判定,本规范不适用;混用会导致 `SyntaxError: Cannot use 'import.meta' outside a module`)。
- ❌ 禁止把 `main()` 写成**同步函数**后用 `if (isDirectRun) { main() }`(同步抛错会抛出 toplevel,无法被 `.catch` 包裹,且 ESLint `no-top-level-await` 外的同步 throw 在 Node 18+ 表现不一致;必须保持 `main()` 是 `async` 或返回 `Promise`)。
- ❌ 禁止手写字符串拼接 `import.meta.url === 'file:///' + process.argv[1]` 替代 `pathToFileURL`(Windows 反斜杠永远不匹配,直接判定失败 → CLI 永不触发 main → 静默失控)。
- ❌ 禁止把 `isDirectRun` 守卫放到 `main` 函数**内部**(局部守卫无法阻止其他顶层 import 时副作用已执行的部分,如顶层模块加载就跑了 git diff / 写了临时文件)。
- ❌ 禁止把 `export const __test__` 移到 `if (isDirectRun)` **之前**且不放 `export`(否则测试 import 时拿到 undefined,§22c 守门 phase B 立即失败 — 这是预期行为,不是 bug)。
- ✅ 修改源脚本的 `main()` 调用约定时必须同步 §22c 守门(双验证 `pnpm test` + `node scripts/check-staged-typecheck-mirror-sync.mjs`),否则 `__test__` 导出语义与 import 时机解耦,可能让测试在 CI 通过而在本地 import 时副作用泄漏。
- ✅ 新增任何"需要双形态(CLI + import)"的 `.mjs` 工具脚本,必须沿用本节 4 行模板 + §22c export 规范,**不**为单次用例复制粘贴变体。

---

## 23. `.gitignore __*` 规则静默忽略 `__tests__/` 目录教训(强制)

### 触发背景(2026-07-25 立,真实事故)

`.gitignore` 第 154 行 `__*` 规则(本意是忽略"Agent 临时脚本",如 `__round1.log` / `__audit_dump`)会**静默忽略**所有以 `__` 开头的路径,包括合法的 `__tests__/` 测试目录。**关键陷阱**:`git status` 对 ignore 的文件**完全不显示**(既不 untracked 也不 modified),开发者肉眼完全看不到。

### 真实事故(2026-07-25 阶段 13 集成测试)

集成测试 subagent 在 `apps/web/__tests__/storage-adapter.test.ts` 写完测试文件,本任务合 stage 13 计划清单:

- 创建文件 → `git status` 不显示
- 编辑文件 → `git status` 不显示
- 准备 commit 时,`git add __tests__/` → 无任何文件可加(`__*` 规则吞掉)
- 险些导致整个 stage 13 测试集成**永久丢失**;直到最后 `git check-ignore -v apps/web/__tests__/` 才追查到 `__*` 规则源头

修复方法:把目录重命名为 `tests/`(避开 `__*` 规则)→ 后续 16 个 `__tests__/` 目录已审计,**全部未被 `__*` 规则命中**(未含 `.gitkeep` 且 `git check-ignore` 返回空),本任务仅作为守门+教训记录,不要求批量迁移。

### 硬性规则(违反视为事故)

1. **项目内测试目录必须用 `tests/`**(推荐)或 `spec/` / `__tests__/` + `.gitkeep`(不推荐);**禁止**新建无 `.gitkeep` 的 `__tests__/` 目录。`__tests__/` 命名只在"目录内全部文件被故意 ignore + 留 `.gitkeep` 占位"时使用。
2. **创建测试目录前必须** `git check-ignore -v <path>` 确认不被 ignore(空输出=安全,非空=被命中);`__` 前缀目录需逐个验证。
3. **CI / pre-commit 必跑** `node scripts/check-test-paths.mjs`(本任务新增,§守门脚本速查),命中 `__tests__/` 无 `.gitkeep` 且被 gitignore 吞掉 → 阻塞(退出码 1)。

### 守门脚本:`scripts/check-test-paths.mjs`

- 扫描 `apps/` + `packages/` + `scripts/` 下所有 `__tests__/` 目录
- 每个 `__tests__/` 调 `git check-ignore -v` 复核 + 检查 `.gitkeep`
- 同时检测 `*.tmp` / `*.bak` 目录 + 非白名单隐藏目录
- exit 0 (无阻断) / exit 1 (有 `__tests__/` 被吞掉阻断项)
- 详细用法:脚本头部 docstring

### 关联案例

- 阶段 13 集成测试 subagent:险些丢失 `apps/web/__tests__/storage-adapter.test.ts`
- 历史事故:曾出现"测试写了不显示 → commit 漏文件 → CI 假绿"模式,本节规则根治

---- **2026-07-26**:Commit 丢失防护机制强化。本地 lost-commit/* tag 被 git gc 清理事故暴露后,新增 sync-lost-commit-tags.mjs 自动 push + fetch 机制,创建 docs/lost-commit-archive.md 永久档案,check-commit-loss-guard.mjs 升级为 5 段检查(reflog 50 步 + 远程 tag 校验 + tag 对象可达性)。

---

## 24. 新增功能须用户确认强制规则(强制)

### 触发条件

任务类型 ∈ {新增功能模块 / 新增 API 路由 / 新增页面 / 新增端能力 / 新增对外能力清单 / 在 PROJECT_PLAN.md 中无对应条目的自发性功能开发}。

> 判定"新增功能"而非"修改/修复"的核心标准:**是否引入了 PROJECT_PLAN.md 当前任务清单之外的新能力**。是 → 触发本规则;否(属于现有功能的修复/重构/优化/适配)→ 不触发。

### 强制动作(缺一不可,违反视为越权事故)

1. **暂停开发**:识别到"新增功能"意图后,**禁止**直接动手写代码,必须先用 `AskUserQuestion` 工具向用户确认是否开发该功能。
2. **明确边界**:确认问题必须包含 ① 功能目标一句话描述 ② 受影响范围(端/文件/契约) ③ 是否纳入 PROJECT_PLAN.md(及其优先级 P0/P1/P2)。
3. **等待显式同意**:用户回复"同意/可以/做吧/开发"等肯定语义后才能开始;用户回复"不用/暂缓/先不做"则**禁止开发**;模糊回复需再次确认。
4. **补登记 PROJECT_PLAN.md**:用户同意后,将该功能追加到 PROJECT_PLAN.md 对应优先级末尾(遵循 §1),再开始编码。
5. **commit message 前缀**:新增功能 commit 用 `feat:` 前缀(§1 已规定)。

### 红线(违反视为协作事故)

- ❌ **禁止**未确认直接开发新功能(包括"顺手加一个"、"我看这里缺个"、"我加个小特性")。
- ❌ **禁止**把新功能伪装成"修复/重构"绕过确认(如新增路由写成"重构路由文件")。
- ❌ **禁止**在 `/goal` 模式下借目标执行之机擅自扩展目标范围外的新功能(违反 §8 红线"严格围绕目标,禁止扩展需求")。
- ❌ **禁止**用"已写完了,你看下要不要保留"代替事前确认。

### 豁免场景(允许不确认直接开发)

- **用户在本轮对话已明确要求开发该功能**(如"帮我加个 XXX 功能"、"做个 XXX")——用户意图已显式,无需再次确认。
- **/goal 模式目标条件内包含的功能**(目标已包含 = 已确认)。
- **纯 bug 修复 / 重构 / 类型修复 / 测试 / 文档 / 配置**(不引入新能力)。
- **守门脚本 / 工程约束自身的增量**(本节即触发例,属工程治理而非业务功能)。
- **PROJECT_PLAN.md 已有条目的细化执行**(任务已登记 = 已确认范围)。

### 与其他规则协同

- 与 §8(goal 模式)协同:goal 模式下不得借目标扩需求,新增功能必须先暂停 goal 询问用户。
- 与 §9(多端同步)协同:用户确认新功能后,默认按 8 端同步开发,除非显式标注"平台独占"。
- 与 §21(README 同步)协同:新功能开发必须同 commit 更新 README(§21 触发条件命中)。
- 与 §7(删除安全)协同:新功能开发中如需删除/重构现有代码,仍遵循 §7 三问。

---

## 25. `verify-*.mjs` / `verify-*.ts` 临时验证文件归档规则(强制)

### 触发条件

Agent 在调试 / 验证 / 探查某项功能时,常在 `apps/web/` / `apps/api/` 等源码根目录随手写一个 `verify-xxx.mjs` 脚本(如 `verify-permission-popover-v2.mjs` / `verify-permission-popover-v3.mjs` / `verify-login-tabs.mjs`)快速跑一次。这类临时文件**禁止**提交到 git,必须归档到 `.trae-cn/tmp/<任务名>/`。

### 强制动作(缺一不可,违反视为协作事故)

1. **临时文件必须放 `.trae-cn/tmp/<任务名>/`**:例如 `.trae-cn/tmp/perm-popover-debug/verify-v2.mjs`。
2. _*禁止放 apps/* 根目录_*:`apps/web/verify-*.mjs` / `apps/api/verify-*.ts` 等位置**严禁** commit。
3. **禁止放 .trae-cn/ 根目录**:`.trae-cn/verify-*.mjs` 与守门脚本混在一起,难追溯。
4. **路径推导用项目内路径**:`$PSScriptRoot` / `__dirname` / `import.meta.url`,不写硬编码绝对路径(§15 卫生规则)。
5. **任务完成后清理**:`rm -rf .trae-cn/tmp/<任务名>/`(已 gitignore,自动忽略)。
6. **commit 阶段禁 add**:`git add <本任务文件>`(§12 多会话保护),**禁止** `git add .` / `git add -A` 一次性把所有 verify-*.mjs 加进去。

### 红线(违反视为协作事故)

- ❌ **禁止** `apps/web/verify-*.mjs` 等源码根目录临时文件 commit(会被守门脚本警告 + 污染 main 分支)。
- ❌ **禁止** 用 "这是为了验证 XXX 功能" 借口把临时文件 commit 进来。
- ❌ **禁止** 留 `verify-v1.mjs` / `verify-v2.mjs` / `verify-v3.mjs` 等版本号后缀文件(版本号在 git history 里有)。

### 豁免场景(允许放源码目录)

- 守门脚本:`scripts/check-*.mjs` / `scripts/verify-*.mjs`(正式工具,有 README/CLI/help)。
- 测试文件:`*.test.ts` / `*.spec.ts` / `tests/` / `__tests__/`(符合 §23 测试目录规则)。
- 长期保留的 E2E 脚本:`scripts/e2e-*.mjs`(已纳入 CI,有意保留)。

### 守门脚本:`scripts/check-verify-tmp-files.mjs`

- 扫描 `apps/*/verify-*.mjs` / `apps/*/verify-*.ts` / `scripts/verify-*.mjs`(白名单外)
- 发现任意 1 个 → 警告(不阻断,只提示)
- 集成位置:CI / guardian-runner 后续项(暂 warn-only,后续按需升级 blocking)
- 退出码:0(有警告但通过)+ 输出警告列表

### 与其他规则协同

- 与 §12(多会话并行)协同:`git add` 阶段只加本任务文件,不批量加 verify-*.mjs。
- 与 §13(文件修改持久化)协同:Read 验证 verify-*.mjs 的修改生效。
- 与 §15(工作区卫生)协同:临时文件必须项目内路径(`.trae-cn/tmp/`),不写 `G:\` 根目录或 `C:\temp\`。
- 与 §23(测试目录)协同:`verify-*.mjs` 命名 ≠ 测试文件,不能伪装成 `*.test.mjs` 绕过守门。

---

## 守门脚本速查(pre-commit 项,按类别)

- **i18n**(2/2b/2c/2d/2e/2f/2g-web/2f-mobile-rn/2f-cli):check-i18n-keys(parity+白名单)/ scan-i18n-zh-residue(zh-TW/ko 阻塞,ja warn)/ check-i18n-broken-en(阻塞)/ i18n-diff(翻译流水线,2f-web + 2f-miniapp-taro 阻塞)/ check-i18n-namespace-passing(命名空间传递,warn)/ check-cli-i18n-parity(cli 端 parity,warn,2f-cli)
- **代码质量**(1/3/4/4b/4c/5/6/7/8/9/10):API key 泄露 / schema drift / 陈旧 dist / UTF-8 完整性 / lint-staged / sanitizer / dedupe / 路由一致性 / safeParse(warn)/ OpenAPI(info)
- **UI/样式**(11/11b/17/18/20/24a/24b/27/28/36):圆角 / 圆角溢出(父 rounded + 子 bg 贴边,warn,2026-08-06 立)/ CSS token / title tooltip / Tailwind 冲突 / 侧边栏宽度+端口注册表(warn)/ z-index+遮罩 z-index(阻塞)/ miniapp-taro design-tokens 同步(阻塞,防 app.css 漂移)
- **工程约束**(12/13b/13c/15/19/21/22/23):交付报告 / PLAN 体积(warn)+防误删 / 迁移完整性 / staged 污染(warn)/ 多端同步(warn)/ README 同步(warn)/ staged 清单(info)
- **Push/工作区**(25/26/29):项目外路径(阻塞)/ 父目录污染(阻塞)/ Push 同步(阻塞)
- **防提交丢失**(30a):reflog reset 检测 + fsck 悬空 commit 检测 + lost-commit/* tag 备份清单(AGENTS.md §22 配套,blocking)
- **Python 类型**(35):mypy 检查(阻塞,防 ai-service Python 类型回退)
- **依赖治理**(38):solito 幽灵依赖回归守门(阻塞,防 P0 优化被回退)
- **迁移完整性**(39):mobile-rn screen 迁移守门(阻塞,防独立实现回升,白名单:Debug/DevEnter/SharedDemo/profileMenuData)
- **共享层重复**(40):端内重新实现 shared hook/util 检测(阻塞,防端内独立实现回升,白名单:web/useChat + web/useAuth + web/useAgentRuntime + web/useClipboard + web/useNotificationStore + mobile-rn/useAuth)
- **条件**(16/16b):staged-typecheck(任意 staged .ts/.tsx → 全量 include + 错误过滤,2026-08-18 根治);packages/database/src staged → build(脚本:check-staged-typecheck.mjs,详见 §22b)
- (16c):check-staged-typecheck-mirror-sync(源/测镜像漂移防御,blocking,AGENTS.md §22b 配套,2026-08-18 立)
- **React 事件闭包**(42):check-event-closure-leak(异步回调闭包访问 SyntheticEvent 属性检测,blocking,AGENTS.md §42 配套,2026-08-12 立)

### 守门手动触发 / 紧急跳过抽查

- **手动触发全量守门**:`node scripts/guardian-runner.mjs --staged`(pre-commit 模式,传给所有脚本);不带 `--staged` 为全量扫描。
- **commit 污染防护(scope 一致性)**:`.husky/commit-msg` 的 `check-commit-scope-consistency.mjs`(AGENTS.md §16 配套);紧急跳过 `HUSKY_SKIP_SCOPE_CHECK=1 git commit ...`。
- **commit 丢失防护**:guardian 第 30a 项 `check-commit-loss-guard.mjs`(AGENTS.md §22 配套);紧急跳过 `HUSKY_SKIP_COMMIT_LOSS_CHECK=1 git commit ...`。

> post-commit 钩子:`git-push-guard.mjs` 自动 push + 验证 local == remote(见 §20)。

---

## 26. C 盘防护强制规则(强制)

### 触发背景(2026-07-27 立,真实事故)

C 盘 120 GB 频繁告急,根因排查发现:

- **TRAE 自身缓存 12.88 GB**(TRAE SOLO CN 7.68 + TRAE SOLO 旧版 3.46 + Trae CN 旧版 1.74)
- **Chrome OptGuideOnDeviceModel 4 GB**(Chrome 内置 AI 模型,用户不用)
- **Local\Temp 累积 1.6 GB**(TRAE 旧版安装包 + pip 安装临时)
- **项目历史违规写入 `C:\temp\ihui-*` 0.33 GB**

已通过环境变量迁移 + 符号链接 + 自动维护计划任务根治。

### 开发工具缓存路径强制规则(强制)

**所有开发工具的全局缓存/存储/临时目录必须指向 D 盘**(已通过用户环境变量永久配置):

| 工具       | 环境变量 / 配置                     | 路径                                        |
| ---------- | ----------------------------------- | ------------------------------------------- |
| Temp/TMP   | `TEMP` / `TMP` / `TMPDIR`           | `D:\caches\Temp`                            |
| pnpm       | `PNPM_HOME` + `pnpm config`         | `D:\caches\pnpm\{store,global,cache,state}` |
| npm        | `npm config`                        | `D:\caches\npm\{cache,prefix}`              |
| pip        | `pip config`                        | `D:\caches\pip`                             |
| uv         | `UV_CACHE_DIR`                      | `D:\caches\uv`                              |
| Cargo      | `CARGO_HOME`                        | `D:\caches\cargo`                           |
| Rustup     | `RUSTUP_HOME`                       | `D:\caches\rustup`                          |
| Go         | `GOPATH` / `GOMODCACHE` / `GOCACHE` | `D:\caches\go{,\pkg\mod,-build}`            |
| Playwright | `PLAYWRIGHT_BROWSERS_PATH`          | `D:\caches\playwright`                      |

**禁止 agent 在代码或脚本中硬编码 C 盘路径**作为写入目标:

- ❌ `C:\temp\*` / `C:\Users\荣耀\AppData\Local\Temp\*`(用 `os.tmpdir()` / `$env:TEMP` 替代,会自动走 D 盘)
- ❌ `C:\Users\荣耀\AppData\Local\*\cache`(用工具自带配置或环境变量)
- ❌ `C:\Users\荣耀\AppData\Roaming\TRAE*\*`(TRAE 自身管理,agent 不触碰)

**唯一例外**:系统日志(`debug.log` / `next-server.log`)可走 `$env:TEMP`(已指向 D 盘)。

### TRAE ModularData 迁移(已配置自动迁移)

- `C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\ModularData`(4.5 GB 会话历史 + 代码索引)→ `D:\caches\trae-modular-data\ModularData`(符号链接)
- `C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\logs` → `D:\caches\trae-modular-data\logs`(符号链接)
- **自动迁移机制**:`scripts/auto-migrate-trae-modular.ps1` 由计划任务 `IHUI-C-Drive-AutoMaintain`(每天 3am)调用,检测 TRAE 未运行时自动迁移(robocopy 复制 → 删原目录 → mklink 符号链接)
- **手动迁移**:`pwsh -File scripts/auto-migrate-trae-modular.ps1`(需关闭 TRAE)

### 自动维护计划任务(已注册)

| 任务名                      | 触发     | 脚本                                | 功能                                               |
| --------------------------- | -------- | ----------------------------------- | -------------------------------------------------- |
| `IHUI-C-Drive-AutoMaintain` | 每天 3am | `scripts/c-drive-auto-maintain.ps1` | 清理 TRAE/Chrome/Temp 缓存 + 触发 ModularData 迁移 |

**手动触发**:`pwsh -File scripts/c-drive-auto-maintain.ps1`
**查看日志**:`D:\caches\c-drive-maintain.log`
**查看任务状态**:`Get-ScheduledTask -TaskName "IHUI-*"` / `schtasks /Query /TN "IHUI-C-Drive-AutoMaintain"`

### 守门(已实现,guardian-runner 第 45 项)

- `scripts/check-c-drive-paths.mjs`(guardian-runner 第 45 项,warn-only,2026-08-13 立):扫描 staged 文件中硬编码的 C 盘写入路径(`C:\temp\` / `C:\Users\*\AppData\Local\Temp\` 等,排除 `os.tmpdir()` / `$env:TEMP` / 注释 / 文档)。
- **行为(与 guardian-runner.mjs 实际一致)**:本脚本违规时 exit 1(供统计),guardian-runner 以 warn 模式捕获后计为"警告"、**不阻塞 commit**;仅 blocking 项失败才 exit 1 阻塞 commit。
- 紧急跳过(应急,默认不推荐):`HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...`

### 历史案例

- 2026-07-27:C 盘 28 GB → 42 GB,释放 13.85 GB(TRAE 旧版残留 + Chrome OptGuideOnDeviceModel + Temp 旧文件)
- 后续配置 11 个环境变量永久指向 D 盘,杜绝开发工具缓存再写 C 盘
- TRAE ModularData 4.5 GB 待自动迁移(计划任务在 TRAE 未运行时执行)

---

## 27. PowerShell 7 强制规则(强制,2026-08-13 立)

### 触发背景

Windows PowerShell 5.1(`powershell.exe`)已 EOL(微软停止维护),且存在已知 bug:

- `Out-File -Encoding UTF8` 实际写 UTF-16 LE(BOM 处理 bug)
- ANSI 代码页读 UTF-8 写入的 `.ps1` 文件时,`if/else` 块解析截断(`Missing closing '}'` 误报)
- 中文路径/文件名处理在 5.1 上不稳定
- 跨平台兼容性差(Linux/macOS 跑不通)
- 真实事故:2026-08-13 C 盘 130MB 修复任务,D 盘诊断脚本二次报 `Missing closing '}'`,根因是 5.1 读 pwsh 7 写入的 UTF-8 文件的 BOM bug

### 强制规则(违反视为交付事故)

1. **agent 跑 PowerShell 必须用 `pwsh.exe`**(PowerShell 7+):
   - ✅ `pwsh -File scripts/foo.ps1`
   - ✅ `& "C:/Program Files/PowerShell/7/pwsh.exe" -File ...`
   - ❌ `powershell -File scripts/foo.ps1`
   - ❌ `powershell.exe -Command ...`
   - 唯一例外:Windows 系统 5.1 专属 cmdlet 需在脚本里 `Set-Alias` 显式标注
2. **所有项目内 `.ps1` 文件第一行必须 `#requires -Version 7`**:在 5.1 上跑会**直接报错退出**,这正是强制效果
3. **CI / 守门脚本必须用 `pwsh`** 跑
4. **路径统一用正斜杠 `/`**:`C:/Program Files/PowerShell/7/`,避免 5.1 反斜杠转义 bug
5. **`.ps1` 文件用 UTF-8 with BOM 写**:PowerShell 5.1 默认以 ANSI 代码页读 `.ps1`,`Out-File -Encoding UTF8` 在 5.1 上写的是 UTF-16 LE,必须用 `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($true))`

### 守门(blocking)

- `scripts/check-pwsh-version.mjs`:扫 `g:\IHUI-AI` 下所有 `.ps1`(排除 venv / node_modules / .git / site-packages / .trae-cn/tmp),检查前 5 行是否含 `#requires -Version 7`,缺失则 exit 1
- 集成位置:`scripts/guardian-runner.mjs` pre-commit 第 41 项(新增,2026-08-13 立项);跳过 `HUSKY_SKIP_PWSH_VERSION_CHECK=1`(应急,默认不推荐)
- 检查范围:全项目 `.ps1`,包括 `scripts/`、`deploy/`、`apps/*/scripts/`、`.trae-cn/scripts/`(项目级,非 `.trae-cn/tmp/`)
- 白名单:`*.venv/*`、`venv/*`、`node_modules/*`、`.git/*`、`.trae-cn/tmp/*`、`site-packages/*`(playwright 驱动)

### 安装指引(机器上没装 PowerShell 7)

```powershell
winget install --id Microsoft.PowerShell -e --source winget
# 或一键脚本
iex "& { $(irm https://aka.ms/install-powershell.ps1) } -UseMSI"
```

### 历史教训

- 2026-08-13:CredentialHelperSelector 弹窗修复任务全程用 `powershell`(5.1),导致 D 盘诊断脚本二次报 `Missing closing '}'`(5.1 对 BOM 处理 bug)。改用 `pwsh` + `#requires -Version 7` 后立即通过。教训:RunCommand 默认 PowerShell 解释器**不是 7 也不是 5 的中性选择**——必须显式指定 `pwsh`。

---

## 28. 根目录整洁铁律(强制,2026-08-15 立)

### 触发背景

根目录曾散落 10+ 临时产物:`debug.log` / `aha_electron_2026.0810.log` / `cookies.txt` /
`page_eval/prompts/response/usage.html` / 过时 `start-dev.ps1`(D 盘旧路径 + 8810 旧端口) /
`browser_test_output/` 等。2026-08-15 一次性清理后,立此铁律防回潮。

### 强制规则(违反视为交付事故)

1. **一级目录只允许白名单内条目**,白名单封闭维护于 `scripts/check-root-dir-clean.mjs`(4 组 Set):
   - `ALLOWED_FILES`:配置(`package.json`/`pnpm-*.yaml`/`turbo.json`/`eslint.config.mjs`/`tsconfig.base.json`/`knip.jsonc`/`docker-compose.yml`/`railway.json`/`render.yaml`/`app.json`)+ 标准文档(`README*.md`/`LICENSE`/`SECURITY.md`/`CONTRIBUTING.md`/`CODE_OF_CONDUCT.md`)+ 项目强制(`AGENTS.md`/`PROJECT_PLAN.md`)
   - `ALLOWED_DIRS`:`apps`/`packages`/`scripts`/`docs`/`deploy`/`monitoring`/`reports`/`sdks`/`cert`/`products`/`logs`/`node_modules`/`tmp`/`test-results`
   - `ALLOWED_HIDDEN_FILES` / `ALLOWED_HIDDEN_DIRS`:`.env*`/`.gitignore`/`.git`/`.github`/`.husky`/IDE/工具目录等
2. **禁止在一级目录生成 `.log` / `.html` / `cookies*` / 截图 / ad-hoc 脚本**:临时产物一律进 `tmp/` 或 `logs/`,测试产物进 `test-results/` 或对应子目录。
3. **新增合法根目录文件/目录必须显式审批**:把条目加进 `scripts/check-root-dir-clean.mjs` 白名单并随 commit 提交,禁止绕过白名单。
4. **任务收尾必查**:交付前跑 `node scripts/check-root-dir-clean.mjs --staged`,0 违规才算完成。

### 守门(blocking)

- `scripts/check-root-dir-clean.mjs`:扫描一级目录,白名单外条目 `--staged` 模式 exit 1
- 集成位置:`scripts/guardian-runner.mjs` pre-commit 第 44 项(2026-08-15 立)
- 逃生舱(应急,默认不推荐):`HUSKY_SKIP_ROOT_DIR_GUARD=1 git commit ...`

### 配套

- `.gitignore` 已补 `browser_test_output/`、`cookies.txt` 防回潮(未跟踪垃圾不污染 `git status`)

---

## 29. dangling commit 备份策略(2026-08-19 立)

### 由来

`commit-loss-check` 守门会拦截 dangling commits,要求先备份为 tag 再继续操作。
本仓库实践:所有 dangling commits 备份为 `lost-commit/wip-*` tag(以 commit 短 hash 命名,
例如 `lost-commit/0141d221`、`lost-commit/wip-batch-00f2429`)。

截至 2026-08-19,本地 `lost-commit/*` tag 数量 = **4188** 个,远超 §22「已被 reset 丢失的 commit
永久记录」清单的 3 个手工备份 tag — 绝大多数来自 `check-commit-loss-guard.mjs` 自动 fsck
悬空检测后批量打 tag 的产物(典型为 merge commit / stash pop 失败的中间 commit)。

抽样 `git show --stat lost-commit/{0141d221,02000bfd,043af88d}` 均显示为 Merge commit,
作者 `AI智汇社 <lizong@aizhs.top>`,日期集中在 2026-08-17 — 与 §22 守门日志一致。

### 保留周期

建议 **30 天**。超出后一次性 GC(由仓库维护者人工触发,不在守门脚本里自动跑):

```bash
# 1. 先确认无重要未提交工作(红线!)
git status               # 应 clean
git stash list           # 应为空
git diff --stat          # 应无改动

# 2. 列出所有 lost-commit tag(预演,确认数量级合理)
git tag -l 'lost-commit/*' | wc -l   # 当前 4188

# 3. 本地一次性删除
git tag -l 'lost-commit/*' | xargs git tag -d

# 4. 同步删除远程 tag(仅当你确认远端也允许清理时;默认保留远端)
#    警告:此操作会真正影响 origin ref 列表,需在 PR 中明确说明
git tag -l 'lost-commit/*' | xargs -I{} git push origin :refs/tags/{}

# 5. 验证 (强校验,任何 missing/unreachable 都应人工复核)
git fsck --unreachable --no-reflogs
git tag -l 'lost-commit/*' | wc -l   # 应为 0
```

### 为什么必须人工触发而不是脚本自动化

- **守门不擅自删 tag**: `check-commit-loss-guard.mjs` 的职责是"检出 + 备份",
  不应承担"GC 清理"职责 — 后者一旦误删,会真正丢失 dangling commit 的可达路径,
  即使远端有备份也增加了恢复成本。
- **数量级跃升需要人审**: 从 0 → 4188 是日积月累的结果,任何"一键 GC"脚本都应要求
  人类在 PR 里显式 ack,而不是 nightly cron 自动跑。
- **§22 守门只挡新增**: pre-commit 第 30a 项(`--blocking --filter-stash`)只关心
  "这一次操作是否会产生 dangling",不关心历史积累。

### 红线

- ❌ **不要把 lost-commit tag push 到 origin 之外的 fork / mirror**(会污染外部 ref 列表)。
  §22「自动化 tag 同步」明确禁止了向非 origin 的推送。
- ❌ **GC 前未确认 `git status clean` + `git stash list` 为空**(会丢失未提交改动)。
- ❌ **一次性删除超过 1000 个 tag 后不验证 `git fsck` 就 push**(可能误删有意义的 commit,
  因为 fsck 检出的是"创建时刻"的悬挂,不代表当下已被 merge 进 main)。
- ❌ **amend 含 dangling 备份说明的 commit**(本节一旦 commit,内容视为定稿;
  后续 GC 时间窗的调整应新加 §29a / §29b,不要回头改这一节)。

### 配套

- §22「防止 commit / push / merge 提交丢失硬性规则」— 提供守门 + 备份机制
- §22「自动化 tag 同步」(`scripts/sync-lost-commit-tags.mjs`)— 保证远端有副本
- `docs/lost-commit-archive.md` — 丢失 commit 的永久档案(人工可读清单)
- `.trae-cn/archive/AGENTS_history.md` — 历史 GC 案例(本节首次落地后应补一条案例)

---

## 42. React SyntheticEvent 闭包陷阱(强制)

### 触发背景(2026-08-12 立,真实 bug)

`apps/web/src/components/chat/model-selector.tsx` 原 `onMouseLeave` 在 `setTimeout` 回调闭包内访问 `e.currentTarget`:

```tsx
setTimeout(() => {
  setPopoverAnchor((prev) => (prev?.el === e.currentTarget ? null : prev))
}, 100)
```

React 17+ 的 SyntheticEvent 在事件处理函数返回后 `currentTarget` 会被置 `null`,异步回调触发时 `prev?.el === null` 永远为 `false`,关闭分支永远不进 → model picker 常驻显示。

### 陷阱机制

- React 事件处理函数(`onClick={e => ...}` 等)**同步作用域内** `e.target` / `e.currentTarget` 有效。
- 一旦进入异步回调(`setTimeout` / `setInterval` / `requestAnimationFrame` / `requestIdleCallback` / `queueMicrotask` / 未捕获 `e` 的 promise)或 memoized / 延迟执行的闭包场景,SyntheticEvent 会被事件池复用/清空,`e.target` / `e.currentTarget` 失效或为 `null`(React 17+ 不再 pooled,但 `currentTarget` 一定在 handler 返回后置 null)。

### 强制做法(违反视为 defect 事故,强制)

1. **同步缓存**:在事件处理函数**同步作用域**先缓存所需字段,再在异步中使用。例:`const id = e.currentTarget.dataset.id` → 异步闭包内读 `id`,严禁直接读 `e.currentTarget.dataset.id`。
2. **用 ref 管理 DOM**:`anchorRef.current` 替代 `e.currentTarget`,适合需在多个回调 / 清理函数中引用同一 DOM。
3. **异步闭包内禁止访问 `e.` 任何属性/方法**(`currentTarget` / `target` / `preventDefault` / `stopPropagation`)。

### 守门

`scripts/check-event-closure-leak.mjs`(guardian-runner 第 42 项,blocking):用括号配对算法提取异步回调第一个参数(箭头函数体),在其内搜 `e.X` 模式,命中 → exit 1 阻塞 commit。
参考修复:`apps/web/src/components/chat/model-selector.tsx` MemberDiscountSection。

---

## 关键参考文档

| 文档                      | 说明                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `PROJECT_PLAN.md`         | 唯一任务计划文档(必读)                                        |
| `.trae-cn/archive/`       | 历史归档(audit/交接/迁移报告,只读)                            |
| `docs/architecture.md`    | 系统架构文档                                                  |
| `docs/port-management.md` | 端口注册表(88xx 段)                                           |
| `docs/learning-assets.md` | 学习资产登记(34 个工作流反馈来源,新增/删除工作流必须同步更新) |

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
