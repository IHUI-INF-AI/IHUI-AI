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
- **教训**: 多 Subagent 并行时,各 Subagent 独立操作同一份 working tree,极易出现 amend 丢失 / 空 commit / message 偏离 / reset 误伤等问题。必须建立隔离机制。

### 必须遵守

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
