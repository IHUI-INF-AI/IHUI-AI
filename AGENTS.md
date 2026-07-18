# AGENTS.md — IHUI-AI 项目 Agent 指南

> 本文件的作用域为整个 `G:\IHUI-AI` 仓库根目录及所有子目录。

---

## 1. 任务计划文档规则(强制)

### 唯一计划文档

项目**唯一**的任务计划文档是 `PROJECT_PLAN.md`(仓库根目录)。

### 必须遵守

- 所有任务计划、进度更新、待办清单、状态变更**只写** `PROJECT_PLAN.md`。
- **不得**在 `.trae/`、`.trae-cn/`、`docs/`、根目录或其他任何位置新建计划/TODO/ROADMAP 文件(`/goal` 模式运行时临时文件例外见下方"goal 模式运行时文件例外"小节)。
- `.trae/documents/` 和 `.trae-cn/` 下的文件为**历史草稿,只读**,不再更新(`.trae-cn/goal-runtime/` 下的 goal 运行时文件、`.trae-cn/skills/` 下的 AI 技能文件除外)。
- 完成任务后,在 `PROJECT_PLAN.md` 对应条目把 `[ ]` 改为 `[x]` 并追加 `✅(日期)`。
- 新增任务追加到 `PROJECT_PLAN.md` 对应优先级(P0/P1/P2)末尾。
- commit message 用 `docs(plan): 更新 PROJECT_PLAN — <简述>`。

### goal 模式运行时文件例外(唯一例外)

> 本例外**仅适用于** `/goal` 目标驱动模式执行期间,且为**全局唯一例外**,其他任何场景仍禁止创建计划/状态类 md 文件。

- `/goal` 执行期间允许在 `.trae-cn/goal-runtime/` 目录下创建两个**运行时临时文件**:
  - `.trae-cn/goal-runtime/STATE.md`:目标状态快照(目标条件、状态机、轮次计数、最近评估结论)
  - `.trae-cn/goal-runtime/loop-run-log.md`:每轮执行 + 评估日志
- 这两个文件是**机制性运行产物**,不是任务计划文档,不与 `PROJECT_PLAN.md` 冲突。
- 路径选在 `.trae-cn/goal-runtime/` 是因为 `.trae-cn/` 整体已被 `.gitignore` 忽略,无需额外配置即可避免误提交,且不污染仓库根目录。
- 严格约束(违反即视为破坏规则):
  1. **不得**承载需求拆解、设计决策、长期 TODO;仅记录当前目标轮次状态与评估日志。
  2. **不得**提交到版本库(已由 `.gitignore` 兜底,但仍禁止 `git add -f` 强加)。
  3. 目标达成 / 清除 / 阻塞后,**必须立即**:
     - 将目标摘要、最终交付结论、关键日志条目**整合写入** `PROJECT_PLAN.md` 对应条目;
     - **删除** `STATE.md`、`loop-run-log.md`、`EXPERIMENT_NOTES.md`(若存在)(目录保留,供下次 goal 复用);
     - 若目标因阻塞或预算耗尽终止,在 `PROJECT_PLAN.md` 记录未完成原因与剩余任务清单后再删除。
  4. 同一会话同一时刻**仅允许一个活跃目标**,新目标覆盖旧目标时,旧目标临时文件先按上一条规则清理。

### skills 技能文件例外(唯一例外)

> 本例外允许在 `.trae-cn/skills/` 目录下安装 AI 编程技能框架(如 Superpowers)的 `SKILL.md` 技能文件,为 AI 助手注入工程方法论。

- 允许在 `.trae-cn/skills/` 目录下存放 AI 技能文件(`SKILL.md` 及技能目录内的辅助文件)。
- 技能文件是**工具配置**,不是项目计划文档,不与 `PROJECT_PLAN.md` 冲突。
- 路径选在 `.trae-cn/skills/` 是因为 `.trae-cn/` 整体已被 `.gitignore` 忽略,且 Trae CN 原生扫描该目录加载技能。
- 严格约束(违反即视为破坏规则):
  1. **仅限** `SKILL.md` 技能文件及其辅助文件(如 `references/`、`scripts/`),**不得**存放计划/TODO/ROADMAP/设计文档。
  2. **不得**提交到版本库(已由 `.gitignore` 兜底,仍禁止 `git add -f` 强加)。
  3. 技能来源必须是**可信仓库**(如 `obra/superpowers` 官方仓库),安装前必须确认仓库可信度。
  4. 安装/更新/卸载操作记录到 `PROJECT_PLAN.md`(简述技能名 + 版本/commit + 安装时间)。
  5. 技能文件**不得**修改项目代码或配置,仅作为 AI 助手的上下文指令。

### IHUI-AI 项目对 Superpowers 技能的偏好覆盖(强制)

> Superpowers 技能的默认路径与行为与本项目 AGENTS.md 规则存在冲突,利用技能自带的"User preferences override"机制(writing-plans L19 / brainstorming L107)进行覆盖。本覆盖规则**优先于**技能默认行为。

**冲突 1:计划文件路径(writing-plans 默认 `docs/superpowers/plans/`)**

- **覆盖为**:不创建独立计划文件,所有计划内容**直接整合到 `PROJECT_PLAN.md`** 对应条目(新增到 P0/P1/P2 末尾,标注 `📋(日期) plan`)。
- 若计划篇幅过大必须临时文件,路径为 `.trae-cn/goal-runtime/<feature-name>-plan.md`,目标完成后**必须删除**(同 goal 运行时文件清理规则)。
- 涉及技能:`writing-plans`、`requesting-code-review`(引用计划路径)、`subagent-driven-development`(引用计划路径)、`executing-plans`。

**冲突 2:设计文档路径(brainstorming 默认 `docs/superpowers/specs/` + commit)**

- **覆盖为**:不创建独立设计文档,设计要点**直接整合到 `PROJECT_PLAN.md`** 对应条目(标注 `🎨(日期) design`)。
- 若需临时文件,路径为 `.trae-cn/goal-runtime/<topic>-design.md`,目标完成后**必须删除**。
- 涉及技能:`brainstorming`。

**冲突 3:git commit 自动执行(writing-plans Task 模板含 `git commit`、brainstorming 含"Commit the design document")**

- **覆盖为**:技能中的 `git commit` 步骤**允许自动执行**;当改动通过全量验证(typecheck + lint + test 全绿)后,agent 可自动 `git commit` + `git push` 到远程,无需等待用户显式指令。但仍遵守以下红线:
  - 不得在 commit message 里写长篇计划(遵守第 1 节"禁止事项")。
  - 不得 commit 含敏感信息(`.env` / 真实 API key)的文件(受 project_memory 安全硬约束)。
  - 高危操作(删除分支 / 强推 / 删库表 / 影响生产)仍需人工确认(遵守第 8 节 + 第 9 节红线规则)。
  - `git push --force` / `git push --force-with-lease` 仍禁止(除非用户显式要求)。
  - commit message 遵守约定式提交(`feat` / `fix` / `docs` / `chore` / `test` / `refactor` 等前缀)。
- 涉及技能:`writing-plans`、`brainstorming`、`executing-plans`(执行含 commit 步骤的计划时)。

**冲突 4:git worktree 路径(using-git-worktrees 默认 `.worktrees/`)**

- **覆盖为**:本项目优先使用第 9 节 `goal/<任务简述>` 分支策略,不强制 worktree。
- 若需 worktree 隔离,遵守 `using-git-worktrees` 技能的 Step 0 检测 + 用户征询机制,路径默认 `.worktrees/`(需先加入 `.gitignore`)。
- worktree 清理遵守第 8 节删除安全规则,禁止 agent 自主 `git worktree remove`。
- 涉及技能:`using-git-worktrees`、`finishing-a-development-branch`。

**优先级**:本偏好覆盖 > Superpowers 技能默认行为 > 通用 AGENTS.md 规则(仅在无覆盖时)。

### 禁止事项

- 不创建新的 TODO/PLAN/ROADMAP 文件(goal 模式 `STATE.md` / `loop-run-log.md` 例外除外)。
- 不在 commit message 里写长篇计划。
- 不把计划散落到代码注释。
- **不保留**已结束目标的 `STATE.md` / `loop-run-log.md` 残留文件。

---

## 2. 项目概览

IHUI-AI 是全栈 AI 平台,采用 TS Monorepo(pnpm workspace + Turborepo):

- **后端 API**: `apps/api`(Fastify 5 + Drizzle ORM 0.38 + PostgreSQL)
- **前端 Web**: `apps/web`(Next.js 15 + React 19 + Tailwind 4 + shadcn/ui)
- **AI 服务**: `apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)
- **共享包**: `packages/`(database / auth / types / ui / config / eslint-config / tsconfig)
- **小程序**: `apps/miniapp-taro`(Taro 4 + React)

---

## 3. 代码风格

- 做减法,最小化代码,零冗余
- 复用现有代码和模式,不做超出需求的"改进"
- 不创建文档文件(除非明确要求)
- 不添加 inline 注释(除非明确要求)
- 不加 copyright/license header

---

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅
- hover 用 subtle 颜色变化,**不要蓝色发光边框**
- 复用 `packages/ui` 的 Card/Button/Input/Dialog
- 时间用 `Intl.DateTimeFormat`,头像用 initials(首字母)
- 状态徽章: draft 灰 / published 绿
- 积分正数绿色,负数红色
- 每个页面 < 250 行
- **禁止纯圆形 / 胶囊形状的容器样式**(强制):任何承载内容或交互的容器(卡片 / 面板 / 按钮 / 输入框 / 弹窗 / 标签条 / 侧栏项 / 操作行 / 列表项 / 气泡 / 工具栏 / 浮层 / 徽章容器 等)**一律不得**使用 `rounded-full`、`rounded-pill`、`border-radius: 9999px`、`border-radius: 50%` 或任何等价的纯圆 / 胶囊圆角;只允许使用本项目规范圆角体系对应 px 值:
  - web 端(Tailwind v4):基础 `--radius: 0.5rem`(8px),按尺寸梯度使用 `rounded-sm`(2px)/ `rounded`(4px)/ `rounded-md`(6px)/ `rounded-lg`(8px)/ `rounded-xl`(12px)/ `rounded-2xl`(16px),元素越大圆角越大,但不得跨越到胶囊。
  - miniapp-taro / mobile-rn(Tailwind v3 / NativeWind):同上尺寸梯度,使用 `rounded-sm/md/lg/xl/2xl` 等具名档位,禁止 `rounded-full` / `rounded-pill`。
  - 直写 CSS:使用 `border-radius: 2px/4px/6px/8px/12px/16px`,禁止 `9999px` / `50%` 用于容器。
  - **唯一豁免**(仅限非容器装饰元素,不承载主要内容/交互):用户头像图片本身(`Avatar` 的 `<img>`)、纯装饰性状态指示点(`w-2 h-2` 级别连接灯/在线点)、未读消息数字角标的红点底、`Switch` 拇指(`SwitchPrimitives.Thumb`)。其余任何场景一律不得使用纯圆形 / 胶囊。
  - 头像容器(包裹 Avatar 的外层 div)、徽章背景容器、按钮、输入框、卡片等**不得**借"豁免"名义使用 `rounded-full`。
  - 既有代码出现违规时,在涉及该文件的修改任务中一并纠正为本项目规范圆角(不单独发起大改)。
- **禁止渐变遮罩**(强制,2026-07-18 立):任何容器(侧边栏 / 列表 / 滚动区 / 卡片 / 面板 / 弹窗 / 工具栏 等)**禁止**使用渐变遮罩作为"还有更多内容可滚动"的视觉提示,包括但不限于:`mask-image` / `-webkit-mask-image` / `linear-gradient` 用作边缘淡出 / `fade-out` / `mask: linear-gradient(...)` 等。侧边栏滚动条已完全隐藏(`.hover-scroll` 用 `scrollbar-width: none`),不得用渐变遮罩补偿可发现性,应保持内容自然结束。若需提示下方有更多内容,用显式 UI 元素(如"查看更多"按钮 / 计数徽章 / 分页)而非渐变遮罩。
- **禁止使用分割线**(强制,2026-07-18 立):本项目**禁止**使用任何形式的分割线作为模块间视觉分隔,只允许使用**描边**(`border` 四边完整描边 + `border-border` 颜色)或**容器背景色**(`bg-*` 语义色)来区分不同模块。具体禁止项:
  - HTML `<hr>` 标签(纯样式分割线,无语义)。
  - Tailwind `divide-y` / `divide-x` / `divide-*` 类(子元素间分隔线)。
  - 单边 border 当作视觉分割线使用:`border-t` / `border-b` / `border-l` / `border-r`(仅作为容器描边时允许四边 `border` 或对边成对 `border-x` / `border-y`,禁止用作单边分隔线)。
  - 任何 `border-*` + 颜色组合形成的"线状分隔"视觉效果。
  - 允许的形式:容器完整描边(`border border-border`)、容器背景色对比(`bg-card` vs `bg-background` / `bg-muted` 等)、间距分隔(`gap-*` / `space-*`)、阴影分层(`shadow-*`)。
  - 既有代码出现违规时,在涉及该文件的修改任务中一并纠正(不单独发起大改),纠正确认后用描边或容器背景色替代原分割线视觉效果。
- **圆角容器内绝对定位子元素的避让规则**(强制,2026-07-18 立):当父容器使用 `rounded-xl`(12px)/ `rounded-2xl`(16px) 等圆角 + `overflow-hidden` 时,内部绝对定位(`absolute`)且需贴边的子元素(如拖拽手柄 `right-0` / `left-0` / `top-0` / `bottom-0`)**禁止**使用 `h-full` / `w-full`,因为圆角区域会与容器边缘产生 1-2px 缝隙(显示为漏底色"小白边")。**必须**用 `top-<radius> bottom-<radius>`(纵向贴边)或 `left-<radius> right-<radius>`(横向贴边)替代,其中 `<radius>` 匹配圆角半径:
  - `rounded-lg`(8px)→ `top-2 bottom-2` / `left-2 right-2`
  - `rounded-xl`(12px)→ `top-3 bottom-3` / `left-3 right-3`
  - `rounded-2xl`(16px)→ `top-4 bottom-4` / `left-4 right-4`
  - 父容器**无圆角**(`overflow-visible` 或直角)时,子元素仍可用 `h-full` / `w-full`,不受此规则约束。
  - 拖拽手柄实现统一规范(双层结构,2026-07-18 立):**禁止**用 `before:` 伪元素方案(`before:opacity-0` 在某些场景会常驻显示颜色)。必须用**外层命中区 + 内层可见细线**的双层 `div` 结构:
    - 外层:`group absolute right-[-3px] top-<radius> bottom-<radius> z-20 w-2 cursor-col-resize`(8px 宽透明命中区,`right-[-3px]` 跨过父容器右边缘占据与相邻元素的间隙中线,易抓取)。
    - 内层:`absolute right-0 top-0 bottom-0 w-px bg-transparent transition-colors group-hover:bg-primary`(1px 可见细线,默认透明,悬停时显示 primary 色)。
    - `isResizing && 'bg-primary'` 拖拽中常驻高亮。
    - 父容器 `overflow-hidden` + `rounded-xl` 时,手柄**必须置于 aside 外层**(包一个 `relative` 的 `<div>`,aside 和手柄作为兄弟节点),否则 `overflow-hidden` 会裁剪命中区。
    - 父容器无圆角(`overflow-visible`)时,手柄可直接作为 aside 子节点。

---

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js
- 用 Zod 校验请求参数
- 复用现有 authenticate 函数(`packages/auth`)
- admin 路由用 preHandler 钩子统一校验(roleId >= 1)
- 幂等操作用 `onConflictDoNothing`
- slug 从 name 自动生成(slugify)
- API 响应统一 `{ code, message, data }` 格式

---

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
pnpm --filter @ihui/api test                  # 后端测试
pnpm --filter @ihui/database db:generate      # 生成 migration
pnpm dev                                       # 启动所有服务
```

---

## 7. 关键参考文档

| 文档                        | 说明                          |
| --------------------------- | ----------------------------- |
| `PROJECT_PLAN.md`           | **唯一任务计划文档**(必读)    |
| `docs/architecture.md`      | 系统架构文档                  |
| `IHUI-AI-交接文档.md`       | Phase 1-18 完整交接(只读参考) |
| `MIGRATION_GAP_ANALYSIS.md` | 迁移缺口深度报告(只读参考)    |
| `DEPLOYMENT-R65.md`         | 生产部署清单                  |

---

## 8. 删除/重构安全规则(强制)

> 适用范围:删除任何 git 对象(分支、stash、commit、文件)前必须执行的安全审查。

### 必须遵守

- **删除前审查**: 删除任何内容(分支/stash/commit/文件)前必须先回答:
  1. 该内容承载的**功能**是什么?
  2. 当前 monorepo 中是否有**等价的功能实现**?
  3. 如果**没有**等价实现 → **不可以删除**,必须先迁移/开发好替代实现。
- **路径兼容 ≠ 功能等价**: 旧项目残留(如 `client/` Vue、`server/` Python)即使路径与当前 monorepo 不兼容,仍可能承载**当前缺失的功能**。判定标准是"功能是否已被实现",不是"路径是否兼容"。
- **stash drop 同样适用**: drop stash 前必须确认 stash 中改动对应的功能在当前 monorepo 已存在,否则需先实现再 drop。
- **branch -D 同样适用**: 删除本地分支前必须确认该分支承载的功能已合并/已实现。

### 禁止事项

- 不基于"路径不兼容"或"文件类型不匹配"擅自 drop/删除旧项目残留。
- 不在"看起来是垃圾"时跳过功能审查直接 drop。
- 不在功能未迁移完成时删除任何承载该功能的 git 对象。

### 审查流程

1. `git stash show` / `git log --stat` / `git show <sha>` 提取待删除内容的功能点。
2. 在当前 monorepo(`apps/api`、`apps/web`、`apps/ai-service`、`apps/miniapp-taro`、`packages/`)中**逐项**搜索等价实现。
3. 搜索结果为"未实现"时 → 停止删除,在 `PROJECT_PLAN.md` 新增迁移任务并执行。
4. 搜索结果为"已实现"时 → 可删除,但 commit message 需注明审查结论(如 `chore: drop legacy X — confirmed feature Y migrated to apps/web/...`)。

---

## 9. goal 模式工作流(强制)

> 当用户触发 `/goal <可量化完成条件>` 时,必须按本节流程启用 loop 机制自主推进任务,不得跳过。

### 启动条件

- 用户输入 `/goal <目标条件>` 且目标条件满足下方"目标条件硬门槛",否则拒绝启动并提示用户补全。

### 目标条件硬门槛(强制)

目标条件单条最大 **4000 字符**,且必须同时包含以下要素,缺一即拒绝启动:

1. **核心任务**:要完成什么事(动词 + 对象 + 范围)。
2. **验证标准**:可观测结果(命令退出码 / 测试输出 / 文件状态 / HTTP 响应),禁止用"完成"/"修好"/"可用"等主观词。
3. **约束边界**:允许修改的范围 + 禁止触碰的范围(如"仅修改 src/auth,不得改用户表结构")。
4. **质量要求**:类型检查 / 测试通过数 / 性能底线等可量化底线。
5. **优先级**:多目标冲突时的取舍规则(可选,单目标可省)。
6. **异常处理**:遇到不可解决问题时的操作(记录并跳过 / 立即停止)。

劣质目标拒绝示例(不得启动):

- `/goal 修复登录bug` → 缺验证标准、缺约束边界
- `/goal 优化一下架构` → 模糊探索,无可验证依据
- `/goal 把代码写好` → 主观,无量化标准

优质目标示例(可启动):

- `/goal 修复登录接口中文账号登录失败的问题,验证标准:执行 pnpm --filter @ihui/api test auth 全部用例通过且退出码为 0;仅修改 apps/api/src/auth 目录,不得改动用户表结构;保持原有接口兼容性;遇到无法复现的用例记录原因后跳过,全部处理完后汇总问题清单`

### 运行时文件创建(强制)

- 进入 goal 模式后**第一轮执行开始前**必须在 `.trae-cn/goal-runtime/` 目录下创建:
  - `STATE.md`:写入目标条件、状态机(`active` / `paused` / `achieved` / `blocked` / `budget_limited`)、当前轮次、Token 累计、最近评估结论、硬性指标清单。
  - `loop-run-log.md`:逐轮追加(轮次号 / 执行摘要 / 工具调用统计 / 评估结论 `yes|no` + 一行理由)。
- 这两个文件受第 1 节"goal 模式运行时文件例外"保护,**必须创建**,不得因担心违反"唯一计划文档"规则而跳过。
- 目录 `.trae-cn/goal-runtime/` 首次使用前需创建(若不存在)。

### 运行时文件标准模板(强制)

为确保每次 goal 执行格式一致,`STATE.md` 与 `loop-run-log.md` 必须按以下最小结构创建:

**STATE.md 模板:**

```markdown
# STATE — goal 运行时状态(临时,目标结束后删除)

## 目标条件

<完整目标条件原文>

## 状态机

- 当前状态: active | paused | achieved | blocked | budget_limited
- 当前轮次: <N>
- 累计 Token: <数值>
- 最近评估结论: yes | no | pending — <一句话理由>

## 硬性指标

1. <指标1> ⏳ | ✅
2. <指标2> ⏳ | ✅

## 软性指标

- <指标>
```

**loop-run-log.md 模板:**

```markdown
# loop-run-log — goal 执行日志(临时,目标结束后删除)

## 轮次 0 — 初始化

- 时间: <YYYY-MM-DD>
- 操作: <初始化摘要>
- 评估: pending

## 轮次 N — 执行

- 操作:
  1. <步骤1>
  2. <步骤2>
- 验证命令: <命令>
- 命令退出码: <码>
- 关键输出: <片段>
- 评估: yes | no — <一句话理由>
```

字段说明:

- `状态机.当前状态` 必须是 5 个枚举值之一,不得自创。
- `硬性指标` 用 ⏳(未完成)/ ✅(已完成)标记,与 PROJECT_PLAN.md 复选框语义一致。
- `loop-run-log.md` 每轮追加一个 `## 轮次 N` 块,不得覆盖历史轮次。
- `验证命令 / 命令退出码 / 关键输出` 三件套是评估独立性的依据,缺一不得判定 yes。

### 7 步执行循环

1. **目标解析与初始化**:拆分硬性 / 软性指标,初始化 `STATE.md`,首轮执行计划写入 `loop-run-log.md` 第 0 轮。
2. **单轮任务执行**:聚焦核心问题,完成一轮读写 / 命令 / 代码修改,输出执行摘要追加到 `loop-run-log.md`。
3. **独立评估校验**:基于真实结果(命令输出 / 文件内容 / 测试结果)输出 `yes|no + 一行理由`,写入 `loop-run-log.md`;**禁止**仅凭"看起来完成了"判定 yes。
4. **循环判定**:`yes` → 进入第 5 步;`no` → 自动续跑下一轮;连续 3 轮 `no` 且无实质进展 → 进入 `blocked` 状态,暂停并请求人工指导。
5. **最终交付校验**:逐条核对硬性指标,全部满足才标记 `achieved`。
6. **状态清除与交还控制权**:输出交付报告(目标 / 验证依据 / 完成状态 / 残留风险)。
7. **整合与清理(强制)**:把目标摘要 + 最终交付结论追加到 `PROJECT_PLAN.md` 对应条目(无对应条目时新增到 P1 末尾并标注 `✅(日期) / goal`),然后**删除** `STATE.md` 与 `loop-run-log.md`(目录保留)。

### 评估独立性(强制)

- 评估校验(第 3 步)必须基于**真实可验证依据**(命令输出 / 文件内容 / 测试结果),**禁止**执行模型自评 yes。
- 评估依据必须写入 `loop-run-log.md`,包括:执行的验证命令、命令退出码、关键输出片段。
- 连续两次评估结论矛盾(一轮 yes 一轮 no)时,自动增加一轮复核,避免误判停止或误判继续。

### 子命令语义

| 子指令          | 别名                                         | 语义                                                                         |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `<目标条件>`    | —                                            | 设置目标并立即启动第一轮执行                                                 |
| (无参数)        | `status`                                     | 查询当前目标运行状态(目标条件 / 运行时长 / 轮次 / Token 累计 / 最近评估结论) |
| `pause`         | `hold`                                       | 暂停目标,状态机置 `paused`,保留运行时文件,等待 `resume`                      |
| `resume`        | `continue`                                   | 从 `STATE.md` 断点续跑                                                       |
| `clear`         | `stop` / `off` / `reset` / `cancel` / `none` | 终止目标,按第 7 步"整合与清理"流程处理,不得残留                              |
| `budget <数值>` | `limit`                                      | 设置当前目标 Token 消耗上限,达阈值平滑停止并生成剩余任务清单                 |
| `log`           | `history`                                    | 输出 `loop-run-log.md` 完整执行日志与每轮评估记录                            |

**budget 子命令细节:**

- 默认值:**无上限**(不设预算时,仅受"20 轮上限"与"连续 3 轮无进展 blocked"约束)。
- 单位:**tokens**(执行模型 + 评估模型累计消耗)。
- 达阈值状态:`budget_limited`(独立于 `blocked`,语义为"资源耗尽"而非"无法推进")。
- 达阈值行为:平滑结束当前轮次 → 在 `STATE.md` 标记 `budget_limited` → 把已完成进度 + 剩余任务清单写入 `PROJECT_PLAN.md` → 删除运行时临时文件 → 输出进度报告并交还控制权。

### 跨会话恢复

- 目标状态持久化于 `.trae-cn/goal-runtime/STATE.md`,不依赖对话上下文。
- 会话中断后重启,若检测到 `STATE.md` 存在且状态非 `achieved` / `blocked` / `budget_limited`,询问用户是否 `resume`。
- 上下文压缩(`/compact`)不影响目标状态,但执行模型必须在压缩后重新读取 `STATE.md` 与 `loop-run-log.md` 恢复上下文。

### EXPERIMENT_NOTES 机制(可选,调试类任务推荐)

- 排查 / 调试类目标可在目标条件中要求实时写入 `.trae-cn/goal-runtime/EXPERIMENT_NOTES.md`。
- 每尝试一种方案,记录:方案内容 / 执行结果 / 是否有效 / 失败原因。
- 避免长任务中重复尝试已失败路径,提升排查效率。
- 目标结束后与 `STATE.md` / `loop-run-log.md` 一并删除(或整合关键结论到 `PROJECT_PLAN.md` 后删除)。

### 红线规则

- 单目标最大自动迭代 **20 轮**,超出进入 `blocked`。
- 高危操作(删除分支 / 强推 / 删库表 / 影响生产)**必须暂停**请求人工确认,不得借"自主执行"名义绕过第 8 节删除安全规则。
- 严格围绕目标,**禁止**扩展需求、做无关重构、加未要求的功能。
- 每轮**完整承接上下文**,不得因压缩丢失目标条件与已执行轮次(压缩后必须重读 `STATE.md`)。
- 单轮内工具调用连续失败 3 次,记录错误后进入下一轮;连续 5 轮失败则 `blocked`。
- 隐性默认达标项:无语法错误 / 可启动 / 无回归 / 符合第 3 节代码风格与第 4-5 节约束。

### 失败回滚与 git 工作流(强制)

> 当目标进入 `blocked` / `budget_limited` 状态时,代码改动的处理必须按本节执行,防止留下半成品或污染主分支。

**git 工作流建议(推荐但非强制):**

- goal 执行前创建独立分支,命名 `goal/<任务简述>`(如 `goal/fix-auth-login`)。
- `achieved`:合并回工作分支后删除 goal 分支。
- `blocked` / `budget_limited`:保留 goal 分支供后续 `resume`,在 `PROJECT_PLAN.md` 记录分支名与未完成原因。
- 简单目标可在当前分支执行,但必须在 `STATE.md` 记录起始 commit sha,便于回滚定位。

**失败回滚规则:**

- `blocked` / `budget_limited` 状态下,**禁止** agent 自主执行 `git reset --hard` / `git checkout .` / `git clean -f` 等破坏性回滚(受第 8 节删除安全规则约束)。
- agent 必须在 `PROJECT_PLAN.md` 记录:
  1. 已修改的文件清单(逐文件列明)。
  2. 当前 git 分支与起始 commit sha(便于用户定位)。
  3. 未完成原因与剩余任务清单。
  4. 建议的后续操作(保留改动 / `git reset --soft` 回滚到起始 sha / 删除 goal 分支),由用户决定。
- 交还控制权后,回滚决策权归属用户,agent 不得自行执行。

### goal 模式与 Superpowers 技能协同(强制)

> 当 `/goal` 模式与 Superpowers 技能同时启用时,两者分工如下,不得混淆。

- **goal 模式**:管**目标级 loop** — 7 步循环、状态机、轮次评估、预算控制、跨会话恢复(本节前述内容)。
- **Superpowers 技能**:管**任务级工程方法论** — brainstorming(需求澄清)→ writing-plans(计划拆解)→ test-driven-development(实现)→ requesting-code-review(审查)→ verification-before-completion(验证)。
- **协同方式**:goal 目标条件可引用 Superpowers 技能流程(如"按 brainstorming → writing-plans → TDD 流程实现 X,验证标准:...")。goal 模式的 7 步循环作为外层框架,Superpowers 技能作为内层任务执行方法论。
- **路径/commit/worktree 行为**:goal 模式执行期间,Superpowers 技能的默认路径与 commit 行为**必须遵守第 1 节"IHUI-AI 项目对 Superpowers 技能的偏好覆盖(强制)"**,不得因"自主执行"名义绕过。
- **冲突优先级**:第 1 节偏好覆盖 > goal 模式规则 > Superpowers 技能默认行为。

### 不适用场景(应拒绝 / 改用普通对话)

- 模糊探索性任务(如"优化一下架构")。
- 需要频繁人工决策的创意型开发。
- 高风险生产环境操作(直接改线上库 / 改 CI 凭据等)。
- 单轮可完成的简单任务(改名 / 单文件补注释)。

---

## 10. 多端同步开发强制规则(强制)

> 适用范围:任何涉及功能开发、接口调整、数据结构变更、UI 交互改动的任务,必须**同步推进本项目所有相关端**,禁止出现"一端开发好另外一端滞后"的情况。本规则与第 3 节"做减法"不冲突 — "做减法"指最小化代码冗余,本规则指功能跨端必须同步落地。

### 端清单(必须同步)

| 端         | 路径                | 技术栈                                                         |
| ---------- | ------------------- | -------------------------------------------------------------- |
| 后端 API   | `apps/api`          | Fastify 5 + Drizzle ORM                                        |
| 前端 Web   | `apps/web`          | Next.js 15 + React 19                                          |
| AI 服务    | `apps/ai-service`   | FastAPI + LangGraph + LiteLLM                                  |
| CLI        | `apps/cli`          | Node.js + Commander                                            |
| 小程序     | `apps/miniapp-taro` | Taro 4 + React                                                 |
| 移动端     | `apps/mobile-rn`    | Expo + React Native + NativeWind                               |
| 桌面端     | `apps/desktop`      | Tauri 2 + React                                                |
| 浏览器扩展 | `apps/extension`    | WXT + React                                                    |
| 共享层     | `packages/*`        | api-client / ui / ui-native / types / auth / database / config |

### 必须遵守

- **接口契约同步**:API 路由 / 请求参数 / 响应结构变更时,必须同步更新 `packages/api-client` 共享层 + 所有调用该接口的端(web / miniapp-taro / mobile-rn / desktop / extension)。禁止"API 改了但前端还在调旧契约"。
- **类型同步**:共享类型(`packages/types` / `packages/api-client`)变更时,必须同步所有引用端。
- **数据结构同步**:数据库 schema(`packages/database`)变更时,必须同步生成 migration + 更新 API 查询 + 更新所有端的展示逻辑。
- **功能同步**:新功能开发必须同步在所有目标端实现(如"登录"功能必须在 web + desktop + mobile-rn + extension + miniapp-taro 同步可用)。功能定义在 `PROJECT_PLAN.md` 中必须列出目标端清单。
- **UI 对齐**:同一业务页面在多端展示时,核心交互与信息层级必须一致(允许平台特化,但功能不可缺失)。
- **共享组件同步**:`packages/ui` 或 `packages/ui-native` 组件变更时,必须同步所有使用该组件的端。

### 同步验证清单(任务完成前必检)

每次开发 / 修改 / 调整完成前,必须逐项核对并写入交付报告:

1. **接口**:改动是否涉及 API 接口?→ 是则同步 `packages/api-client` + 所有调用端,逐一列出已同步的端。
2. **类型**:改动是否涉及共享类型?→ 是则同步所有引用端。
3. **数据**:改动是否涉及数据库 schema?→ 是则同步 migration + API 查询 + 前端展示。
4. **UI 组件**:改动是否涉及共享 UI 组件?→ 是则同步 `packages/ui` / `packages/ui-native` + 所有使用端。
5. **业务功能**:改动是否涉及业务功能?→ 是则列出该功能在哪些端应存在,逐一确认已同步实现。
6. **全量验证**:`pnpm turbo typecheck lint test` 必须全绿(所有端,清 `*.tsbuildinfo` + `.turbo` 缓存后跑)。

### 禁止事项

- **禁止**只改一端就交付,其他端留作"后续任务"(除非该功能明确只属于单端,见"平台独占"豁免)。
- **禁止**API 契约变更后只更新后端,前端调用留给下一轮。
- **禁止**数据库 schema 变更后只生成 migration,不更新 API 查询和前端展示。
- **禁止**以"端差异"为由跳过同步验证(端差异只允许在 UI 呈现层,不允许在功能层)。
- **禁止**在 `PROJECT_PLAN.md` 任务条目中只写单端而隐含其他端(必须显式列出目标端清单)。

### 同步范围判定

- **功能层同步(必须)**:接口 / 类型 / 数据 / 业务逻辑必须全端同步。
- **呈现层特化(允许)**:各端可根据平台特性调整 UI 布局 / 交互方式(如 mobile-rn 用 FlatList,web 用表格;desktop 用 Tauri 原生通知,mobile-rn 用 Expo Push)。
- **平台独占(豁免)**:某些功能天然只属于特定端(如 desktop 的系统托盘、extension 的浏览器上下文菜单、miniapp-taro 的微信支付、CLI 的终端集成),此类不要求跨端同步,但必须在 `PROJECT_PLAN.md` 任务条目标注"平台独占"。

### AI 对话链路同步(强制)

AI 对话链路是横跨 API ↔ AI-Service ↔ Web ↔ CLI 的核心链路,任何一端变更必须同步:

- AI-Service 模型配置 / SSE 协议 / callback 协议变更 → 必须同步 API 的 `/api/llm/*` + `/api/ai/callback` 路由 + Web 的 `use-chat.ts` + CLI 的 LLM 调用层。
- API callback schema 变更 → 必须同步 AI-Service 的 `_fire_callback` + Web 的 WS 通知处理 + CLI 的 ai-callback 处理。
- WebSocket 通知协议变更 → 必须同步 API 的 `ws-notifications.ts` + Web 的 `use-websocket.ts` + CLI 的 WS 客户端。
- LiteLLM provider 配置变更 → 必须同步 AI-Service 的 `llm_gateway.py` + API 的 `/api/llm/models` + Web 的模型选择器 + CLI 的模型列表。

### 文档同步(强制)

跨端变更必须同步更新以下文档:

- `docs/architecture.md`(若架构层级变化)
- `IHUI-AI-交接文档.md`(若涉及 Phase 推进)
- `PROJECT_PLAN.md`(任务状态)
- `DEPLOYMENT-R65.md`(若涉及生产部署清单变化)
- `MIGRATION_GAP_ANALYSIS.md`(若涉及迁移缺口变化)

### 审查清单(每次跨端变更前必填)

变更执行者在动手前必须自检:

- [ ] 我已确认本次变更的跨端影响范围(列出受影响端清单)。
- [ ] 我已规划所有受影响端的同步修改方案。
- [ ] 我已确认 `packages/types` / `packages/database` / `packages/ui` / `packages/auth` / `packages/api-client` 是否需要同步。
- [ ] 我已规划同步验证步骤(`pnpm turbo build typecheck lint test` 必须全绿,清 `*.tsbuildinfo` + `.turbo` 缓存后跑)。
- [ ] 我已规划文档同步(`PROJECT_PLAN.md` / `docs/architecture.md` 等)。
- [ ] 我已在 `PROJECT_PLAN.md` 任务条目显式列出目标端清单(单端任务标注"平台独占")。

---

## 11. 交付报告一致性硬约束(强制,2026-07-17 立)

> 本节针对"声明无后续建议但同时列出后续建议条目"的矛盾情况设立,**优先级高于** agent 表达习惯,**违反视为交付事故**。

### 核心禁令(互斥关系)

以下三类表述**互斥**,**禁止在同一交付报告/任务总结/对话收尾中同时出现**:

1. **"完整收尾"类**:`无后续建议` / `无任何剩余建议` / `完整收尾` / `全部完成` / `已闭环` / `无遗留` / `无任何待办` / `可以关闭对话` 等。
2. **"后续工作"类**(以下任一即触发):`后续建议` / `P1-P5 优先级任务` / `优化项` / `待跟进` / `待执行` / `TODO` / `遗留风险` / `后续可改进` / `未来可考虑` / `可进一步优化` / `未实现` 等。
3. **"已完整收尾"前提**:必须真正**没有**任何 P1-P5 条目 / 优化项 / 待跟进 / 待执行 / TODO / 风险点,才允许声明"无后续建议"。

### 互斥校验(强制自检)

每次生成交付报告时,必须执行以下自检:

- [ ] **报告若使用"无后续建议/已完整收尾/无任何剩余建议"任一措辞** → 整份报告**不得**出现任何 P1-P5 / 优化项 / 待跟进 / 待执行 / TODO / 遗留风险 / 后续可改进 条目。
- [ ] **报告若列出任何后续建议 / 优化项 / 待跟进 / 风险条目** → 收尾措辞**必须**改为"`还有 N 项后续工作,见下方列表`"或"`任务 X 已完成,剩余工作见 P1 列表`",**禁止**使用"无后续建议"等绝对化措辞。
- [ ] **若任务确实全部完成,无任何剩余** → 报告结尾**直接写完成时间与验证依据**,**不得**画蛇添足列出"可考虑优化"之类伪建议(用户多次反馈:这种伪建议与"无后续建议"自相矛盾,属于应付式收尾)。

### 措辞模板(强制参照)

| 真实情况                  | 必须使用的措辞                                                                   | 错误措辞(禁止)                                               |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 真正全部完成,无任何剩余   | "任务 X 已完成,验证依据 Y"                                                       | "无后续建议"(已被用户多次驳回)                               |
| 有 N 项明确后续工作       | "任务 X 已完成。还有 N 项后续工作,见下方列表 / PROJECT_PLAN.md P1-P5"            | "完整收尾 + 列出 5 项后续建议"(矛盾,2026-07-17 用户明确禁止) |
| 因阻塞/预算终止           | "任务 X 部分完成,因 <原因> 终止。剩余 N 项,见 PROJECT_PLAN.md <条目> / STATE.md" | "完整收尾"                                                   |
| 多端同步开发,部分端已完成 | "已同步端:web/api/cli。剩余:desktop/extension/mobile-rn,见下方端清单"            | "全部完成"(违反第 10 节多端同步)                             |

### 触发场景(2026-07-17 真实案例)

- **案例 1**:侧边栏 130px 微调任务,交付报告中 agent 写"侧边栏主题无后续建议"但又列出 5 项后续工作,被用户当场识破并要求写入本规则。
- **教训**:agent 倾向用"无后续建议"作为礼貌性收尾,但**只要存在任何剩余条目,该措辞即为自相矛盾**,必须改为"还有 N 项后续工作"。

### 禁止事项

- **禁止**在列出 P1-P5 / 优化项 / 待跟进条目时,使用"无后续建议/完整收尾/已闭环"等绝对化措辞。
- **禁止**用"无后续建议"作为礼貌性收尾(用户已明确禁止,2026-07-17)。
- **禁止**为了显得"完美收尾"而**删除或隐藏**真实剩余的工作条目(违反做减法原则,也违反"完美细致完整"原则)。
- **禁止**在多端同步任务中,只完成单端就声明"完整收尾"(违反第 10 节)。

### 与第 3 节"做减法"的关系

- "做减法"指**代码层最小化冗余**,本规则指**报告层不得虚假收尾**。两者不冲突 — 报告须忠实反映剩余工作,**不为了显得简洁而隐藏剩余条目**。
- 当任务**真正全部完成**时,报告应**简短而完整**,只需写:完成时间 + 验证依据 + commit 链接,**无需**画蛇添足列出"可考虑优化"。

### 红线

- 违反本规则的交付报告视为**交付事故**,agent 必须立即修正(删除矛盾措辞或补全剩余工作)。
- 用户多次反馈"无后续建议"自相矛盾属**高频错误模式**,agent 必须在生成交付报告前**逐条自检上表**。

---

## 12. 多 Subagent 并行开发强制规则(强制,2026-07-18 立)

> 适用范围:同一会话内同时启动多个 Task / Subagent 并行处理独立子任务时,各 Subagent 必须遵守本节,防止互相干扰本地 git 状态。本规则与第 8 节"删除/重构安全规则"协同 — 第 8 节管"删除审查",本节管"并行隔离"。

### 触发场景(2026-07-18 真实案例)

- **案例 1 — amend 被 reset 丢失**: Subagent A 创建 commit `ec615d48`(amend 修正 message),Subagent B 执行 `git reset --hard origin/main` 把 amend 丢弃,导致 A 的工作成果只在 reflog 中残留(HEAD@{2} `ec615d48` → HEAD@{1} `34d5d6e3` reset)。
- **案例 2 — 空 commit 干扰**: Subagent B 创建空 commit `367ef3d1`(message 写"feat(cli): redact 脱敏增强"但实际无文件改动),导致本地 ahead 1 commit 未 push,后续 push 被阻塞。
- **案例 3 — commit message 偏离实际改动**: Subagent B 创建的 commit `34d5d6e3` message 仅描述"style(extension): popup + sidepanel 入口样式调整",但实际包含 Subagent A 的 3 个守门闭环文件改动,导致 git log 失真。
- **案例 4 — lint-staged stash 污染 + HEAD 被 reset 撤销(2026-07-18 第二次)**: Subagent A 用 `git add` 4 个文件 + `git diff --cached --stat` 确认 staged 仅 4 files,但 `git commit` 触发 lint-staged pre-commit hook 后,stash+apply 流程把 5 个 untracked 文件污染进 commit,导致 commit 包含 9 files(其中 5 个不归本任务);随后 Subagent B 执行 `git reset HEAD~1` 撤销 A 的 commit,导致 A 的 4 个文件改动全部丢失(reflog `528c2b5c` HEAD@{3} → HEAD@{2} reset → 931ff9e0 HEAD@{1} 由 B 重新 commit 自己的 9 files,A 的工作变孤儿 commit)。
- **教训**: 多 Subagent 并行时,各 Subagent 独立操作同一份 working tree,极易出现 amend 丢失 / 空 commit / message 偏离 / reset 误伤 / stash 污染等问题。必须建立隔离机制,且发现干扰立即切换独立分支。

### 必须遵守

- **发现并行干扰立即切换独立分支(应急规则,2026-07-18 立)**: 任何 agent 在共用 working tree(main 分支)时若发现以下干扰迹象之一,**必须立即停止当前 git 操作并切换到独立分支** `agent/isolated/<任务简述>`:
  1. `git status` 显示 staged 区有非自己 `git add` 的文件。
  2. `git log` 显示 HEAD 被其他 agent reset / amend / 新建 commit 移动过(对比 `git reflog -n 5` 验证)。
  3. `git diff --cached --stat` 输出与预期不符(文件数 / 行数异常增加,出现非自己 add 的文件)。
  4. `git push` / `git commit` 被其他 agent 的改动阻塞(如 lint-staged stash 污染 commit / pre-push hook 因其他包失败)。
  5. 出现 `index.lock` 冲突(其他 git 进程正在运行,`Test-Path .git/index.lock` 返回 True)。
  6. `git stash pop` 后 working tree 出现非自己的改动文件。
     **应急操作流程**:
  7. 立即 `git stash push --include-untracked --keep-index`(保留自己的 staged + untracked 改动到 stash,不动 working tree 中其他 agent 的改动)。
  8. `git checkout -b agent/isolated/<任务简述>`(从当前 HEAD 切出新分支)。
  9. `git stash pop`(恢复自己的改动到新分支 working tree)。
  10. 在新分支上完成 `git add` + `git commit` + `git push origin agent/isolated/<任务简述>`(独立工作,不干扰 main 分支)。
  11. 完成后报告主 agent 或用户,由其评估合并回 main 的策略(`rebase` / `cherry-pick` / `merge`)。
      **优势**: 不动 main 分支的 working tree,不干扰其他 agent,自己的改动在新分支上独立完成 + push,避免 commit 丢失 / stash 污染 / reset 误伤等事故。
- **并行启动前先检查 working tree 状态**: 任何 Subagent 在创建独立 Task 前,必须先执行 `git status` + `git log --oneline -n 5` 确认 working tree 干净且本地与 origin/main 同步。若发现本地 ahead/behind 或有 uncommitted 改动,**禁止**直接启动并行 Subagent,必须先询问用户如何处理。
- **每个 Subagent 必须在独立分支工作**: 启动并行 Subagent 时,主 agent 必须为每个 Subagent 创建独立分支(命名 `subagent/<任务简述>`),Subagent 在自己分支上 commit,**禁止**直接在 main 分支 commit。完成后由主 agent 评估合并策略(rebase / merge / cherry-pick)。
- **禁止 Subagent 自主执行 `git reset --hard` / `git checkout .` / `git clean -f`**: 这些破坏性操作受第 8 节删除安全规则约束,即使在 Subagent 自己的分支上也必须先确认功能等价性。Subagent 遇到 working tree 冲突时,必须暂停并报告主 agent,由主 agent 决定回滚策略。
- **禁止创建空 commit**: Subagent 创建 commit 前必须确认有文件改动(`git diff --cached --stat` 非空),空 commit 会干扰后续 push 并污染 git log。若 Subagent 只改了 message 而无文件改动,应使用 `git commit --amend -m` 修改上一个 commit 的 message,而不是创建新 commit。
- **commit message 必须准确反映实际改动**: Subagent 创建 commit 时,message 必须列出所有 staged 文件的改动概要,**禁止**只描述部分文件而忽略其他文件的改动。若 staged 区含多个不相关任务的文件,必须先 `git reset HEAD <file>` 拆分,分别 commit。
- **Subagent 完成后必须报告 git 状态**: Subagent 返回结果时必须包含 `git status` + `git log --oneline -n 3` + `git diff --stat HEAD~1` 的输出,让主 agent 能验证 Subagent 没有引入意外改动。
- **主 agent 合并前必须做差异审查**: 主 agent 在合并 Subagent 分支前,必须执行 `git diff main...subagent/<任务>` 审查实际改动,确认没有越界修改其他 Subagent 的文件。

### 禁止事项

- **禁止**多个 Subagent 同时在 main 分支上 commit(必然互相覆盖)。
- **禁止**Subagent 自主 `git push`(push 权限归主 agent,避免半成品污染远程)。
- **禁止**Subagent 自主 `git reset --hard` / `git checkout .` / `git clean -f`(破坏性操作受第 8 节约束)。
- **禁止**Subagent 创建空 commit(干扰 push + 污染 git log)。
- **禁止**Subagent commit message 只描述部分文件改动(必须列出所有 staged 文件概要)。
- **禁止**主 agent 在未审查 Subagent 实际改动的情况下直接合并(必须 `git diff main...subagent/<任务>` 审查)。

### 与第 8 节"删除/重构安全规则"的关系

- 第 8 节管"删除内容前的功能等价性审查"。
- 本节管"并行 Subagent 之间的 git 状态隔离"。
- 两者协同: Subagent 在自己分支上删除内容时仍需遵守第 8 节审查流程,主 agent 合并时需再次审查。

### 与第 9 节"goal 模式工作流"的关系

- goal 模式推荐在 `goal/<任务简述>` 分支执行(见第 9 节"失败回滚与 git 工作流")。
- 本节是多 Subagent 并行的补充规则: goal 模式 + 多 Subagent 并行时,主 agent 在 goal 分支上为每个 Subagent 创建子分支,Subagent 完成后主 agent 合并到 goal 分支,goal 达成后再合并回工作分支。

### 单 Subagent 串行场景豁免

- 单一 Subagent 串行工作时(无并行),本节规则不强制执行 — 串行模式下 working tree 状态由单一 Subagent 维护,不存在互相干扰风险。
- 但单 Subagent 仍需遵守第 8 节删除安全规则 + 第 9 节 goal 模式规则 + 第 11 节交付报告一致性规则。

### 红线

- 多 Subagent 并行时**禁止**在 main 分支直接 commit(必须用 `subagent/<任务>` 分支)。
- 多 Subagent 并行时**禁止**任何 Subagent 自主执行破坏性 git 操作(reset --hard / checkout . / clean -f / push --force)。
- 主 agent 在合并 Subagent 分支前**必须**做差异审查(`git diff main...subagent/<任务>`),未审查直接合并视为违规。
- 违反本节导致 Subagent 工作丢失或 git log 污染的,视为**交付事故**,主 agent 必须立即修正(回滚 + 重新执行 + 补全 commit message)。

---

## 13. 多 Subagent 并行强制效率规则(强制,2026-07-17 立)

> 适用范围:任何非简单对话的执行类任务。agent 必须最大化使用 Task 工具 + subagent 并行推进,效率最大化,不得"串行单线程"完成可并行的多步任务。本规则与第 3 节"做减法"不冲突 — "做减法"指代码层最小冗余,本规则指执行层最大化并行。与第 12 节协同:第 12 节管"subagent 之间的 git 隔离",本节管"何时必须用 subagent + 用多少个"。

### 必须遵守

- **Subagent 优先**:任何任务包含 ≥ 2 个**文件独立**的子任务时,**必须**用 Task 工具并行启动多个 subagent,而非串行执行。
- **最大化并行度**:模型支持的最大并行 subagent 数为 **5 个**(系统约束),在文件路径不冲突的前提下应尽量用满。
- **任务可并行判定**:子任务之间**无写依赖**(不修改同一文件 / 不依赖前序输出)即可并行;只读探索(搜索 / 读文件)始终可并行。
- **依赖链串行**:若子任务 B 依赖 A 的输出(如 A 生成接口,B 调用接口),必须串行;但可先并行启动 A 与其他独立任务,B 等 A 完成后再启动。
- **文件路径隔离**:并行 subagent 必须**显式声明**各自修改的文件路径,agent 主线程负责在派发前确认路径无冲突;冲突时改串行或拆分子任务。
- **子任务描述完整性**:Task 工具的 query 字段必须包含 (a) 任务目标 (b) 受影响文件绝对路径 (c) 验证命令 (d) 约束边界(不得改 X) (e) 项目硬约束引用(如 AGENTS.md 第 X 节)。subagent 无对话上下文,描述不全会导致偏离。
- **结果汇总与验证**:所有 subagent 返回后,主线程必须 (a) 汇总每个 subagent 的改动文件清单 (b) 跑全量验证(`pnpm turbo typecheck lint test` 或单包等价命令) (c) 按 AGENTS.md 第 10 节多端同步审查清单核对 (d) 按 AGENTS.md 第 11 节交付报告一致性硬约束生成报告。
- **失败 subagent 处理**:某 subagent 失败时,不阻塞其他并行 subagent;主线程记录失败原因,对该子任务单独重试或改串行,不得因一个失败取消全部。
- **Context 保护**:对大输出探索类任务(读多个大文件 / 跑命令产大量日志),**强制**用 subagent 隔离 context,避免主线程上下文溢出。

### Subagent 派发模板(强制参照)

派发 Task 工具时,query 字段必须包含以下结构:

```
## 任务目标
<动词 + 对象 + 范围,1 句话>

## 受影响文件(绝对路径,只允许以下文件)
- g:\IHUI-AI\<path1>
- g:\IHUI-AI\<path2>

## 禁止修改
- <列出不得触碰的路径/模块>

## 验证命令(子任务完成后必须自行运行)
- pnpm --filter @ihui/<pkg> typecheck
- pnpm --filter @ihui/<pkg> test

## 约束边界
- 遵守 AGENTS.md 第 3 节做减法(最小代码,零冗余)
- 遵守 AGENTS.md 第 4 节前端 UI 约束(若涉及前端)
- 遵守 AGENTS.md 第 8 节删除安全规则(若涉及删除)
- 遵守 AGENTS.md 第 12 节 subagent git 隔离规则(若并行多 subagent)
- 不得创建新文档文件(除非明确要求)
- 不得添加 inline 注释(除非明确要求)

## 交付物
- <文件清单 + 简述改动>
- 验证命令输出片段(证明 typecheck/test 通过)
```

### 何时必须用 Subagent(强制触发条件)

满足以下任一条件**必须**用 Task 工具派发 subagent:

1. **多文件并行探索**:需要读取 / 搜索 ≥ 3 个不相关文件或目录(用 search subagent_type)。
2. **多模块并行开发**:任务涉及 ≥ 2 个包(`apps/api` / `apps/web` / `apps/cli` 等)的同步修改,且模块间无依赖。
3. **大输出隔离**:预期单步会产生 > 200 行日志 / > 5 个文件读取的任务(用 subagent 隔离 context)。
4. **独立测试补齐**:为多个不相关模块补单元 / e2e 测试,每个模块可独立测试。
5. **跨端同步审查**:AGENTS.md 第 10 节多端同步任务,每个端可派一个 subagent 同步开发。

### 何时**不**用 Subagent(豁免)

以下场景**禁止**用 subagent,必须主线程直接执行:

1. **单文件单步修改**:只改 1 个文件的少量行(如改 1 个 flag 名)。
2. **强依赖链**:每步输出是下一步输入(如 A 改 schema → B 生成 migration → C 改 API → D 改前端),无法并行。
3. **高危操作**:涉及生产 / 删除 / 强推等 AGENTS.md 第 8 节删除安全规则与第 9 节红线规则约束的操作,需主线程人工审查。
4. **纯对话 / 答疑**:用户只问问题,不要求执行。

### 并行度量化(自检)

派发前自检:

- [ ] 我已识别所有可并行的子任务(列出清单)。
- [ ] 我已确认每个子任务的文件路径无冲突。
- [ ] 我已为每个 subagent 写完整 query(目标 / 路径 / 验证 / 约束)。
- [ ] 我已规划串行依赖链(若有)。
- [ ] 我已规划结果汇总 + 全量验证步骤。

### 禁止事项

- **禁止**"我能串行做完"为由跳过 subagent 并行(效率优先,串行只在真有依赖时使用)。
- **禁止**派发描述不全的 subagent(query 缺路径 / 验证 / 约束)。
- **禁止**并行 subagent 修改同一文件(必冲突)。
- **禁止**主线程把所有探索 + 开发都自己扛(主线程 context 是稀缺资源,必须用 subagent 隔离)。
- **禁止**因 1 个 subagent 失败就放弃全部并行任务(失败单独重试)。
- **禁止**subagent 返回后跳过全量验证(必须主线程跑一次 `pnpm turbo typecheck lint test`)。

### 与其他规则的优先级

- 第 1 节(唯一计划文档) > 第 8 节(删除安全) > 第 9 节(goal 红线) > 第 10 节(多端同步) > 第 11 节(报告一致性) > 第 12 节(subagent git 隔离) > **第 13 节(本规则)** > 第 3 节(做减法)。
- 本规则不替代任何前述规则,只约束"执行方式"(并行 vs 串行)。
- 若并行与第 8 节删除安全冲突(如需删除某文件且涉及多文件审查),以第 8 节为准,串行执行删除审查。

### 触发场景(2026-07-17 真实案例)

- **案例 1**:grok-build CLI 融合迁移第十一轮,主线程串行完成 17 项 todo,耗时较长。用户反馈"多 agent 做 效率最大化",要求写入本规则强制后续并行。
- **案例 2**:补齐 WebSearch / updater / crash-handler 三个模块的 e2e 测试,三模块文件独立,派发 3 个并行 subagent 各写各的测试(13+15+12=40 个新测试全绿),耗时显著低于串行。
- **教训**:主线程串行 = context 浪费 + 耗时长;subagent 并行 = context 隔离 + 耗时缩短(理想情况下 N 倍提速)。

---

## 14. 多会话并行操作同一仓库强制规则(强制,2026-07-18 立)

> 适用范围:多个 Trae 会话/agent 同时操作同一仓库时,各会话必须遵守本节,防止互相回滚文件修改。本规则与第 12 节"多 Subagent 并行开发"协同 — 第 12 节管"同一会话内的 Subagent 隔离",本节管"不同会话之间的隔离"。

### 触发场景(2026-07-18 真实案例)

- **案例 1 — Edit 成功但修改立即消失**: 会话 A 用 Edit 工具修改 4 个文件(header.tsx / globals.css / MainShell.tsx / ai-side-panel.tsx),Edit 返回成功,但立即用 Grep/Read 检查发现修改不存在,git status 也没有任何修改记录。根因:会话 B 执行了 `git checkout .` / `git restore .` / `git stash` 等破坏性 git 操作,把会话 A 的所有未提交修改回滚了。
- **案例 2 — 3 次重试均被回滚**: 会话 A 连续 3 次重新执行 Edit,每次 Edit 返回成功,但 Grep/Read 立即确认修改消失。证明有持续运行的会话在主动回滚文件。
- **教训**: 多会话并行操作同一工作目录时,任何会话执行破坏性 git 操作都会影响所有其他会话的未提交修改。必须建立隔离机制。

### 必须遵守

- **禁止破坏性 git 操作(红线)**: 任何会话/agent **禁止**自主执行以下命令,除非用户显式要求:
  - `git checkout .` / `git checkout -- <file>` / `git restore .` / `git restore <file>`
  - `git stash` / `git stash drop` / `git stash clear`
  - `git reset --hard` / `git reset --hard HEAD~N`
  - `git clean -f` / `git clean -fd`
  - `git checkout <branch>`(切换分支会带走其他会话的未提交修改)
- **修改前检查 working tree**: 会话开始修改文件前,必须先 `git status` 检查 working tree 状态。若发现非自己引入的未提交修改,暂停并询问用户,不得擅自 commit/discard。
- **修改后立即验证(强制)**: 每次 Edit/Write 修改文件后,必须立即用 Read 工具读取修改位置,确认修改已持久化。若发现修改消失,立即停止,不得重试。
- **发现回滚立即暂停(强制)**: 若连续 2 次修改同一文件都被回滚(修改消失),立即进入 `blocked` 状态,报告用户"检测到其他会话在回滚文件,请关闭干扰会话后再继续",不得继续盲目重试。
- **会话隔离推荐**: 多会话并行时,推荐使用 git worktree 物理隔离(见下方"worktree 工具"章节),或至少每个会话使用独立 git 分支。

### worktree 工具(方案 A)

项目提供 `.trae-cn/scripts/worktree.ps1` 脚本,用于创建/管理独立 worktree:

```powershell
# 创建独立 worktree(会话开始时执行)
.\.trae-cn\scripts\worktree.ps1 create <session-name>
# 示例: .\.trae-cn\scripts\worktree.ps1 create fix-ui-shell-panel
# 输出: Created worktree at G:\IHUI-AI\.worktrees\fix-ui-shell-panel (branch: worktree/fix-ui-shell-panel)

# 列出所有 worktree
.\.trae-cn\scripts\worktree.ps1 list

# 清理 worktree(会话结束后执行)
.\.trae-cn\scripts\worktree.ps1 remove <session-name>
```

worktree 目录在 `.worktrees/`,已被 `.gitignore` 忽略。每个 worktree 是独立的工作目录,文件修改互不干扰。

### 单会话场景豁免

- 仅当确认只有一个 Trae 会话在运行时,本节规则不强制执行 worktree 隔离。
- 但"禁止破坏性 git 操作"和"修改后立即验证"两条规则仍适用(防止 agent 误操作)。

### 红线

- 多会话并行时**禁止**任何会话自主执行破坏性 git 操作(checkout . / restore . / stash / reset --hard / clean -f)。
- 发现修改被回滚后**禁止**继续盲目重试(连续 2 次回滚即暂停报告)。
- 违反本节导致其他会话工作丢失的,视为**交付事故**。

### 与其他规则的优先级

- 第 1 节(唯一计划文档) > 第 8 节(删除安全) > 第 9 节(goal 红线) > 第 10 节(多端同步) > 第 11 节(报告一致性) > 第 12 节(subagent git 隔离) > 第 14 节(多会话隔离) > **第 15 节(文件修改持久化)** > 第 13 节(并行效率) > 第 3 节(做减法)。
- 本规则不替代第 12 节,两者协同:第 12 节管"同一会话内 Subagent",第 14 节管"不同会话之间"。

---

## 15. 文件修改持久化强制规则(强制,2026-07-18 立)

> 适用范围:任何 Edit/Write 修改文件后,必须立即固化到 git index,防止 IDE 撤销/自动保存冲突/文件系统异常导致修改丢失。本规则与第 14 节协同 — 第 14 节管"多会话隔离",本节管"单会话下的修改持久化"。

### 触发场景(2026-07-18 真实案例)

- **案例 1 — 单会话下 MainShell.tsx L55 被回滚**: 单会话场景(无其他会话干扰),Edit 修改 `MainShell.tsx` L55 添加 `bg-shell-panel rounded-xl my-2 mr-2 ml-2`,Edit 返回成功并 Grep 验证通过,但数十分钟后用户反馈"右侧工作区背景色变回去了,圆角缩进都没了"。检查发现 L55 被回滚为 `flex min-w-0 flex-1 flex-col`,丢失所有样式。
- **根因分析**: 排除其他会话干扰后,最可能根因是 IDE 文件覆盖 — 用户在 IDE 中打开了该文件,IDE 的 undo stack 或自动保存冲突用内存中的旧版本覆盖了磁盘文件。
- **教训**: Edit 工具写入磁盘后,文件仍然可能被 IDE/文件系统异常回滚。必须把修改立即固化到 git index(受 git 对象数据库保护),才能彻底杜绝丢失。

### 必须遵守

- **修改后立即 git add 暂存(强制红线)**: 每次 Edit/Write 修改文件并通过 Read/Grep 验证后,**必须立即** `git add <file>` 暂存到 git index。
  - git index 受 git 对象数据库保护,即使 IDE 撤销/自动保存冲突覆盖磁盘文件,index 中的版本仍然存在。
  - 暂存后若发现磁盘文件被回滚,可立即 `git checkout -- <file>` 从 index 恢复。
  - 禁止跳过此步骤直接进入下一步修改。
- **任务完成后立即 commit 固化(强制红线)**: 一个完整任务(或一组相关修改)全部完成并通过 typecheck + lint + test 验证后,**必须立即** `git commit` 固化到版本库。
  - commit 后的文件受 git 对象数据库保护,不会被任何文件系统操作回滚(除非显式 `git reset --hard`,受第 8 节约束)。
  - 遵守第 1 节"冲突 3":允许 typecheck + lint + test 全绿后自动 commit + push,无需等待用户显式指令。
  - commit message 遵守约定式提交,不在 message 里写长篇计划。
- **回滚恢复流程(强制)**: 若 Read/Grep 验证发现文件被回滚(修改消失),且该文件已 `git add` 暂存:
  1. 立即执行 `git checkout -- <file>` 从 index 恢复到工作区。
  2. 重新 Read 验证修改已恢复。
  3. 若 3 次恢复仍失败,进入 `blocked` 状态报告用户。
- **只暂存本任务相关文件**: `git add` 时只添加本次任务修改的文件,不得 `git add .` 或 `git add -A`(避免误暂存其他会话/任务的改动)。遵守第 12 节"commit message 必须准确反映实际改动"。

### 禁止事项

- **禁止** Edit/Write 修改后不 `git add` 就继续下一步操作(修改丢失风险)。
- **禁止** 任务完成后不 `git commit` 就交付(文件随时可能被回滚)。
- **禁止** 用 `git add .` / `git add -A` 暂存所有文件(会污染暂存区,违反第 12 节)。
- **禁止** 发现文件被回滚后盲目重新 Edit(应优先从 git index 恢复,更可靠)。

### 工作流模板(强制参照)

每次文件修改的标准流程:

```
1. Edit/Write 修改文件
2. Read/Grep 验证修改已持久化(第 14 节规则)
3. git add <file>  ← 新增:立即暂存到 git index
4. (若任务未完成)继续下一步修改,重复 1-3
5. (任务完成)运行 typecheck + lint + test 全量验证
6. git commit -m "<约定式提交 message>"  ← 新增:立即固化到版本库
7. (可选)git push origin <branch>
```

### 与其他规则的协同

- **第 14 节(多会话隔离)**: 第 14 节的"修改后立即验证"是本节流程的第 2 步;本节的"修改后立即 git add"是第 3 步,两者串联构成完整的修改持久化保障。
- **第 1 节(冲突 3:git commit 自动执行)**: 本节的"任务完成后立即 commit"遵守第 1 节"冲突 3"的允许条件(typecheck + lint + test 全绿后可自动 commit + push)。
- **第 12 节(subagent git 隔离)**: 本节的"只暂存本任务相关文件"遵守第 12 节"commit message 必须准确反映实际改动",避免污染暂存区。

### 红线

- Edit/Write 修改后**禁止**跳过 `git add` 直接进入下一步(修改丢失风险)。
- 任务完成后**禁止**跳过 `git commit` 直接交付(文件随时可能被回滚)。
- 发现文件被回滚后**禁止**盲目重新 Edit(应优先从 git index 恢复)。
- 违反本节导致修改丢失的,视为**交付事故**。

---

## 16. Agent 自主验证强制规则(强制,2026-07-18 立)

> 适用范围:任何需要验证的交付场景。Agent 有能力自己完成的事情**禁止**要求用户去做,必须自己执行完整验证闭环。本规则与第 13 节"多 Subagent 并行强制效率规则"协同 — 第 13 节管"执行效率",本节管"验证自主性"。

### 触发场景(2026-07-18 真实案例)

- **案例 1 — 让用户去浏览器验证删除流程**: 修复"删除对话不生效"bug 后,agent 在交付报告里写"启动 dev server 在浏览器验证" + "把 toast 显示的内容告诉我",让用户做验证工作。用户严厉反馈:"你去做啊 你完全可以操控浏览器 这种情况永远不要让我去做 写入规则里 自己完全可以做的别麻烦我"。
- **根因分析**: agent 有 `browser_use` subagent 能力(可登录 / 点击 / 创建对话 / 删除 / 截图 / 观察 Network)、有 `RunCommand` 能力(可 curl / Invoke-WebRequest 直接调 API)、有 `Read`/`Grep` 能力(可读文件 / 搜代码验证),完全有能力自己完成验证闭环,却偷懒让用户去做。
- **教训**: 验证是交付的一部分,不是用户的工作。agent 必须用自己拥有的工具完成验证,只有当工具确实无法覆盖的场景(如需要用户主观感受 / 真实业务账号 / 物理设备)才允许请用户协助。

### 必须遵守

- **自主验证闭环(强制红线)**: 交付前必须自己完成完整验证,验证方式按优先级排序:
  1. **第一优先:browser_use subagent** — 涉及 UI 交互 / 视觉效果 / 端到端流程的验证,必须用 `Task` 工具启动 `browser_use` subagent,自己登录 / 操作 / 截图 / 观察 Network 请求与响应。
  2. **第二优先:RunCommand 直接调 API** — 涉及后端接口的验证,用 `Invoke-WebRequest`(PowerShell)或 `curl` 直接调用 API,检查 HTTP 状态码 + 响应体。
  3. **第三优先:Read / Grep 验证文件** — 涉及代码改动是否落地的验证,用 `Read` 读修改位置 + `Grep` 搜索关键字符串。
  4. **第四优先:RunCommand 跑测试** — 涉及类型 / 测试的验证,跑 `pnpm --filter @ihui/<pkg> typecheck` + `test`。
- **多手段组合验证**: 复杂场景必须组合多种验证手段。例如"修复删除 bug"需同时验证:(a) curl 调 DELETE API 返回 200 + `{"deleted":true}` (b) browser_use 在 UI 上点击删除按钮观察 toast + 列表刷新 + 数字小标变化 (c) Read 确认前端代码已含 `if (!res.success) throw` 检查。
- **验证证据写入交付报告**: 交付报告必须包含验证证据片段(命令输出 / 截图描述 / 文件行号 + 内容),禁止只写"已验证"无依据。
- **失败重试与切换手段**: 某种验证手段失败时(browser_use hover 不稳定 / dev server 启动失败),不得放弃验证,必须切换其他手段(curl 替代 browser_use / 单包启动替代 pnpm dev),直到完成验证闭环。

### 禁止事项

- **禁止**在交付报告中写"请你启动 dev server 在浏览器验证" / "请把 toast 内容告诉我" / "请你手动测试一下"等把验证工作甩给用户的措辞。
- **禁止**以"browser_use 不稳定"为由跳过 UI 验证(必须切换 curl / 直接调 API 等替代手段)。
- **禁止**只做单点验证就交付(如只 curl 通了 API 就算验证完成,不验证前端 UI 实际效果)。
- **禁止**验证证据缺失的"已验证"声明(违反第 11 节交付报告一致性硬约束)。
- **禁止**以"用户更适合做主观验证"为由推卸客观验证工作(客观可验证的部分必须自己做完,主观部分才请用户)。

### 允许请用户协助的场景(豁免清单)

仅以下场景允许请用户协助,且必须先说明"agent 已完成 X/Y/Z 客观验证,仅剩此项需用户确认":

1. **主观视觉感受**: 颜色搭配 / 间距比例 / 动效手感等无法量化的主观体验。
2. **真实业务账号**: 涉及真实第三方账号(OAuth / 微信支付 / 短信验证码)的操作。
3. **物理设备**: 摄像头 / 麦克风 / 蓝牙 / NFC 等硬件相关功能。
4. **生产环境**: 涉及生产数据 / 真实用户的影响,需人工确认才能执行的操作(受第 9 节红线约束)。
5. **agent 工具确实无法覆盖**: 如需在特定移动设备真机上测试(非模拟器)。

### 工作流模板(强制参照)

每次交付前的标准验证流程:

```
1. (代码改动) Edit/Write 修改文件
2. (静态验证) Read/Grep 确认修改已落地
3. (单元验证) pnpm --filter @ihui/<pkg> typecheck + test
4. (接口验证) RunCommand: curl/Invoke-WebRequest 调 API,检查状态码 + 响应体
5. (UI 验证) Task: browser_use subagent 登录 + 操作 + 截图 + 观察 Network
6. (汇总证据) 把 2-5 步的输出片段写入交付报告
7. (commit + push) 第 15 节规则:验证全绿后立即 commit 固化
```

### 与其他规则的协同

- **第 11 节(交付报告一致性)**: 本节要求"验证证据写入交付报告"是第 11 节"必须忠实反映剩余工作"的具体落实。
- **第 13 节(并行效率)**: 多端验证可并行启动多个 subagent(web 端 browser_use + api 端 curl + cli 端 RunCommand),受第 13 节并行规则约束。
- **第 15 节(文件修改持久化)**: 验证全绿后立即 commit,受第 15 节规则约束。
- **第 14 节(多会话隔离)**: 验证过程中若发现文件被回滚,按第 14 节流程处理。

### 红线

- 交付报告中**禁止**出现"请你验证" / "请你测试" / "请告诉我结果"等甩锅措辞(违反本节核心禁令)。
- 验证未完成就交付的,视为**交付事故**(违反第 11 节交付报告一致性)。
- 验证证据缺失的"已验证"声明,视为**虚假交付**(违反第 11 节)。
- 以"工具不稳定"为由跳过验证,视为**逃避验证**(违反本节核心禁令)。
- 违反本节导致用户做本应由 agent 完成的验证工作的,视为**工作方式事故**。

---

## 17. 工作区卫生强制规则(强制,2026-07-18 立)

> 适用范围:项目文件夹(`g:\IHUI-AI`)之外的文件/文件夹创建与管理。防止项目运行时在仓库根目录之外产生垃圾文件,保持工作区整洁。

### 触发场景(2026-07-18 真实案例)

- **案例 1 — Qt 证书工具释放插件到 G:\ 根目录**: 用户将 `微信支付商户API证书工具 V1.4.exe`(Qt 应用)放在 `G:\` 根目录运行,Qt 启动时在 .exe 同级目录释放 `platforms/`、`iconengines/`、`imageformats/`、`styles/`、`bearer/`、`translations/` 等插件子目录 + `Qt5*.dll` / `libEGL.dll` / `msvcp120.dll` 等十余个 DLL,污染根目录。
- **案例 2 — pnpm 在 G:\ 根目录创建 store**: 某次在 `G:\` 根目录(非项目内)执行 `pnpm install`,pnpm 在 cwd 上一级创建 `.pnpm-store/`(v11),与项目内 `.pnpm-store/`(v3)版本不同,成为孤儿目录。
- **案例 3 — 微信支付证书放在 G:\ai_zhs\**: 证书路径硬编码在 `.env` 为 `G:\ai_zhs\cert\apiclient_key.pem`,在项目外创建 `ai_zhs/` 文件夹。虽出于安全考虑(证书不入库),但 `.gitignore` 已覆盖 `cert/` + `*.pem` 等规则,证书完全可以放项目内 `cert/` 目录,无需在项目外创建文件夹。
- **教训**: 项目外的垃圾文件夹全部源于"在错误的位置运行可执行文件 / 包管理器"或"硬编码项目外路径"。必须建立规则,从源头杜绝。

### 必须遵守

- **证书/密钥文件放项目内 `cert/` 目录(强制红线)**: 所有证书(`*.pem` / `*.p12` / `*.key`)和密钥文件**必须**放在项目内 `g:\IHUI-AI\cert\` 目录(已被 `.gitignore` 的 `cert/` + `**/cert/` + `*.pem` + `*.p12` + `*.key` + `apiclient_*` 多重规则忽略,不会入库)。**禁止**在项目外创建证书目录(如 `G:\ai_zhs\cert\`)。路径通过 `.env` 的 `WX_PAY_PRIVATE_KEY_PATH` 环境变量指定,换机器只需改 `.env`,无需改代码。
- **可执行文件放专用子目录(强制)**: 所有可执行文件(`.exe` / `.bat` / `.cmd` / `.sh`)**禁止**在 `G:\` 根目录直接运行。必须放到 `G:\tools\<工具名>\` 子目录后运行(Qt 应用尤其如此,会在 .exe 同级目录释放插件子目录和 DLL)。若工具只是临时使用,运行完成后立即删除工具目录及其释放的所有文件。
- **包管理器只在项目内运行(强制)**: `pnpm install` / `npm install` / `yarn install` 等**必须**在项目根目录(`g:\IHUI-AI`)或子包目录内执行。**禁止**在 `G:\` 根目录或其他非项目目录运行,避免 pnpm 在项目外创建 `.pnpm-store/` 孤儿目录。
- **临时文件放项目内 `tmp/` 或系统临时目录(强制)**: agent 产生的临时文件(diff / 日志 / 截图 / 脚本输出)**必须**放在项目内 `g:\IHUI-AI\tmp\`(已被 `.gitignore` 忽略)或系统临时目录(`%TEMP%`)。**禁止**在 `G:\` 根目录创建 `tmp/` 或散落临时文件。
- **路径引用用环境变量(强制)**: 代码和配置中引用的外部资源路径(证书 / 密钥 / 工具)**必须**通过环境变量(`.env`)指定,**禁止**硬编码绝对路径(如 `G:\ai_zhs\cert\`)。`.env` 是 gitignored 的本地文件,每台机器自行配置,确保可移植性。

### 禁止事项

- **禁止**在项目文件夹外创建任何与项目相关的文件夹(证书 / 临时文件 / store 等)。
- **禁止**在 `G:\` 根目录直接运行 `.exe` / `.bat` / `pnpm` / `npm` 等可执行文件或包管理器。
- **禁止**在代码或配置中硬编码项目外的绝对路径(用环境变量替代)。
- **禁止**在 `G:\` 根目录散落临时文件(`.tmp-*` / `tmp_*` / `_tmp_*` 等)。

### 清理工具

项目提供 `scripts/cleanup-external-junk.ps1` 脚本,用于清理 `G:\` 根目录下因违反本规则产生的垃圾文件(Qt 插件目录 / DLL / 证书工具 exe / 孤儿 pnpm-store / 临时文件)。执行:

```powershell
powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\cleanup-external-junk.ps1
```

> 注意:TRAE 沙箱限制 agent 无法直接删除工作目录外的文件,需用户手动执行此脚本。

### 红线

- 在项目外创建证书目录 / 临时文件 / store 的,视为**工作区污染事故**。
- 在 `G:\` 根目录运行可执行文件导致插件/DLL 释放到根目录的,视为**工作区污染事故**。
- 硬编码项目外绝对路径的代码,视为**可移植性缺陷**(code review 必须拦截)。

---

## 18. Push 阶段跨 Agent 改动保护规则(强制,2026-07-18 立)

> 适用范围:agent 准备 `git commit` / `git push` 时,发现 working tree 有非本任务相关的其他 agent 改动,如何正确处理。
> 本规则是对第 14 节(多会话隔离)的补充 — 第 14 节管"文件修改时不被回滚",本节管"push 时不抹除/不混入其他 agent 改动"。

### 触发场景(2026-07-18 真实案例)

- **案例 1 — P1-27 commit 时发现 Coze OAuth in-progress 改动**:P1-27 任务执行 commit + push 时,`git status` 显示 working tree 存在其他 agent 新增的 3 个文件(`coze-oauth.ts` / `coze-auth-utils.ts` / `coze-oauth-apps.ts`)+ 4 个文件 modified(`auth-extended.ts` / `server.ts` / `oauth-providers.ts` / `sidebar.tsx`)。这些改动属于其他 agent 正在推进的 Coze OAuth + 飞书 OAuth 集成任务,与 P1-27 完全无关。
- **案例 2 — commit_msg.txt 临时文件**:其他 agent 在仓库根目录创建了 `commit_msg.txt`(3412 字节,2026-07-18 13:08 修改),按第 17 节工作区卫生规则本应删除,但**按本节规则必须保留** — 因为该文件可能是其他 agent 未完成 commit 的工作证据,擅自删除会污染他们的状态。
- **案例 3 — fetch-wechat-platform-cert.mjs 7 字节空文件**:其他 agent 创建了几乎为空的文件(7 字节),看似"垃圾",但可能是其脚手架的第一笔,**禁止抹除**。
- **教训**:多 agent 并行工作同一 main 分支时,任何 agent 在 push 阶段都不得:
  1. `git restore <file>` / `git checkout -- <file>` 抹除其他 agent 的修改
  2. `git add <file>` 把其他 agent 的文件加进自己的 commit
  3. `git stash` / `git stash drop` 把其他 agent 的工作 stash
  4. 推送时强制 push 覆盖其他 agent 的 commit
  5. 手动 `Remove-Item` / `rm` 删除其他 agent 创建的"看着像垃圾"文件

### 必须遵守(强制)

- **禁止抹除其他 agent 的 working tree 改动(红线)**:任何 agent 在 commit + push 阶段,**禁止**对 working tree 中的非本任务相关文件执行破坏性操作:
  - ❌ `git restore <file>` / `git checkout -- <file>` (抹除 modified)
  - ❌ `git stash push` / `git stash` (把其他 agent 改动暂存)
  - ❌ `git clean -f` / `git clean -fd` (删除 untracked)
  - ❌ `git reset --hard` (回滚整个工作树)
  - ❌ `Remove-Item` / `rm` (手动删除其他 agent 创建的文件,包括"看着像垃圾"的文件如 `commit_msg.txt` / 临时测试文件 / 调试日志 / 7 字节空脚手架文件等)
- **禁止混入其他 agent 的改动(红线)**:commit 阶段**只 add 本任务相关的文件**:
  - ✅ `git add <本任务文件1> <本任务文件2> ...`(精确指定)
  - ❌ `git add .` / `git add -A` / `git add -u`(会把所有 untracked + modified 全加进去,混入其他 agent 工作)
  - ❌ `git add <其他 agent 的文件>`(明确禁止)
- **正确流程(3 步)**:
  1. **预检**:`git status --porcelain` 列出所有改动,识别 "本任务改动" vs "其他 agent 改动"(以文件路径 + 内容主题为判断依据,不要看到 "M" 或 "??" 就 add)
  2. **隔离**:仅 `git add <本任务文件清单>`,不触碰其他 agent 改动(用空格分隔多个文件,不要用通配符)
  3. **验证**:`git status --short` 确认 staged 列表**仅含本任务文件**,working tree 仍有其他 agent 改动保持原样(它们的 ` M` / `??` 状态必须保留)
- **pre-push hook 失败时的处理**:若 pre-push hook 跑全量 typecheck/lint 失败,错误来自其他 agent 的代码:
  - ❌ 不得 `--no-verify` 强行 push(绕过硬约束)
  - ❌ 不得修改其他 agent 的代码"帮他们修"(越权)
  - ❌ 不得 `git reset --hard HEAD` 或 `git reset --hard origin/main` 回滚 working tree(会抹除其他 agent 改动,违反本节红线)
  - ✅ 报告用户"pre-push 失败,根因是其他 agent 的 X 文件 Y 错误,请协调其他 agent 修复后再 push"
  - ✅ 仅回退自己的 staged 改动(`git reset HEAD <本任务文件>` 或 `git restore --staged <本任务文件>`),保留 working tree 中其他 agent 的改动
  - ✅ 报告时附完整错误片段(文件路径 + 行号 + 错误码),便于协调
- **不干扰其他 agent 的 commit/push 流程**:本 agent 完成自己的 commit + push 后:
  - ✅ 不再触碰 working tree(让其他 agent 继续工作)
  - ❌ 不执行 `git pull` / `git fetch` / `git rebase` 等会改变 working tree 的操作
  - ❌ 不在原会话内继续修改其他 agent 负责的文件
  - ❌ 不发起 `git push origin main --force` / `git push --force-with-lease`(即使 push 失败,只能等冲突解决)

### 联动规则

- 与第 14 节(多会话隔离)协同:第 14 节禁止所有破坏性 git 操作,本节细化 push 阶段的具体行为
- 与第 12 节(多 Subagent 并行)协同:第 12 节要求 subagent 在独立分支工作;若多会话在 main 分支直接 commit,本节提供保护
- 与第 15 节(文件修改持久化)协同:本节也遵守"修改后立即用 Read 验证"原则
- 与第 17 节(工作区卫生)协调:第 17 节说"禁止在 G:\ 根目录创建 commit_msg.txt",本节说"但**已经存在**的 commit_msg.txt 不得擅自删除"(等该文件 owner 自行清理)

### 红线

- 抹除其他 agent 改动的(无论是否"看着像垃圾"),视为**协作事故**
- 把其他 agent 改动混入自己 commit 的,视为**污染事故**(commit 历史被污染,需 revert + cherry-pick 修复)
- `--no-verify` 强行 push 绕过 pre-push hook 的,视为**流程事故**
- 修改其他 agent 文件"帮他们修"的,视为**越权事故**
- `git reset --hard` 回滚整个工作树的,视为**数据丢失事故**
- 删除 commit_msg.txt / 临时脚手架文件 / 调试日志等"看着像垃圾"文件的,视为**破坏协作事故**
