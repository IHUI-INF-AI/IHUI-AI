# AGENTS.md — IHUI-AI 项目 Agent 指南

> 作用域:`G:\IHUI-AI` 仓库根目录及所有子目录。
> 完整历史规则归档见 `.trae-cn/archive/AGENTS_full_20260719.md`(86KB 原版备份)。
> 本文件为精简版(2026-07-19 压缩),保留所有强制规则核心条款,删除冗余示例与重复说明。

---

## 1. 任务计划文档规则(强制)

- 项目**唯一**任务计划文档是 `PROJECT_PLAN.md`(根目录)。
- 所有任务计划、进度更新、待办清单、状态变更**只写** `PROJECT_PLAN.md`。
- **不得**在 `.trae/`、`docs/`、根目录或其他位置新建计划/TODO/ROADMAP 文件。
- 完成任务后,`[ ]` → `[x] ✅(日期)`。新增任务追加到对应优先级(P0/P1/P2)末尾。
- commit message:`feat`/`fix`/`docs`/`chore`/`test`/`refactor` 前缀。

### 唯一例外

- `/goal` 模式运行时:`.trae-cn/goal-runtime/STATE.md` + `loop-run-log.md`(临时,目标结束后删除)。
- skills:`.trae-cn/skills/SKILL.md`(AI 工具配置,非计划文档)。

---

## 2. 项目概览

IHUI-AI 是全栈 AI 平台(TS Monorepo + pnpm workspace + Turborepo):

- `apps/api`(Fastify 5 + Drizzle ORM 0.38 + PostgreSQL)
- `apps/web`(Next.js 15 + React 19 + Tailwind 4 + shadcn/ui)
- `apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)
- `apps/miniapp-taro`(Taro 4 + React)
- `packages/`(database / auth / types / ui / config / eslint-config / tsconfig)

---

## 3. 代码风格

- 做减法,最小化代码,零冗余。
- 复用现有代码和模式,不创建文档文件(除非明确要求),不加 copyright/license header。

---

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅。hover 用 subtle 颜色变化,**不要蓝色发光边框**。
- 复用 `packages/ui` 的 Card/Button/Input/Dialog。每个页面 < 250 行。
- 时间用 `Intl.DateTimeFormat`,头像用 initials。
- 状态徽章: draft 灰 / published 绿。积分正数绿色,负数红色。

### 圆角守门(强制)

- **禁止**纯圆形 / 胶囊形状容器:`rounded-full`、`rounded-pill`、`border-radius: 9999px`、`50%`。
- 按尺寸梯度:`rounded-sm`(2px)/ `rounded`(4px)/ `rounded-md`(6px)/ `rounded-lg`(8px)/ `rounded-xl`(12px)/ `rounded-2xl`(16px)。
- **唯一豁免**:用户头像 `<img>` 本身、纯装饰点(`w-2 h-2` 连接灯/在线点)、未读角标红点底、`Switch` 拇指。
- 守门脚本:`scripts/check-rounded-full.mjs` + pre-commit 第 11 项。

### 中文字体 + 图标垂直对齐硬约束(强制,2026-07-19 立)

- **问题**:中文字体(以 HarmonyOS Sans SC 为基准) ascent(≈11px) ≠ descent(≈3px) 不对称,14px 字号下 ink 几何中心比 line-box 中心低 0.4-0.5px。flex `items-center` 时图标与文字视觉不齐,肉眼可见"文字偏下"。
- **根治方案**:`apps/web/app/globals.css` 建立 `--text-vcenter-offset: 0.3px` CSS 变量 + 第 170 行全局规则 `:where(button, a, [role='button'], [role='menuitem']):has(>svg):has(>span) > span { transform: translateY(var(--text-vcenter-offset)); }`。所有 button/a 内 "icon + 中文 span" 同行布局**自动**应用 0.3px GPU 视觉位移,无需手动加类。
- **text-xs (12px)** 专用 0.7px 规则(globals.css 第 178-183 行)。
- **配套常量**:`apps/web/src/lib/nav-styles.ts` 5 个共享类(`NAV_ITEM_BASE_CLASS` / `NAV_CHILD_CLASS` / `BTN_NEW_CONVERSATION_CLASS` / `HEADER_BAR_CLASS` / `MODEL_SELECTOR_TRIGGER_CLASS`)+ 显式 `<CenteredText>` 组件(`apps/web/src/components/common/CenteredText.tsx`)。
- **守门**:`apps/web/e2e/icon-text-alignment.spec.ts` 5 个 case,阈值 |delta| ≤ 0.15px,跨 6 个关键 nav + 新建任务按钮 + AI panel header + CSS 变量验证。任何漏改 → CI fail。
- **严禁**:`-mt-px` / `margin-top: -1px` 等"反向微调"hack(实测让 delta 从 0 变 -0.5,反向恶化)。

### 禁止分割线(强制)

- 禁止 `<hr>` / `divide-y` / `divide-x` / 单边 `border-t/b/l/r` 当分割线。
- 允许:容器完整描边(`border border-border`)、容器背景色对比(`bg-card` vs `bg-background`)、间距分隔(`gap-*`)。

### 禁止渐变遮罩(强制)

- 任何容器禁止 `mask-image` / `-webkit-mask-image` / `linear-gradient` 用作边缘淡出。
- 用显式 UI 元素("查看更多"按钮 / 计数徽章 / 分页)替代。

### 圆角容器内 absolute 子元素避让

- 父容器 `rounded-xl` + `overflow-hidden` 时,贴边子元素**禁止** `h-full`/`w-full`。
- 用 `top-<radius> bottom-<radius>`(纵向)或 `left-<radius> right-<radius>`(横向)替代。
- `rounded-lg`(8px)→ `top-2 bottom-2` / `rounded-xl`(12px)→ `top-3 bottom-3` / `rounded-2xl`(16px)→ `top-4 bottom-4`。
- 拖拽手柄用双层 div 结构(外层命中区 + 内层可见细线),**禁止** `before:` 伪元素方案。

---

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js。用 Zod 校验请求参数。
- 复用 `packages/auth` 的 authenticate 函数。admin 路由用 preHandler 统一校验(roleId >= 1)。
- 幂等操作用 `onConflictDoNothing`。slug 从 name 自动生成。
- API 响应统一 `{ code, message, data }` 格式。

---

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
pnpm dev                                       # 启动所有服务(web 3000 + api 3001 + ai-service 8000)
```

---

## 7. 删除/重构安全规则(强制)

删除任何 git 对象(分支/stash/commit/文件)前必须回答:

1. 该内容承载的**功能**是什么?
2. 当前 monorepo 中是否有**等价的功能实现**?
3. 没有 → **不可以删除**,必须先迁移/开发替代。

禁止基于"路径不兼容"或"看起来是垃圾"擅自 drop。stash drop / branch -D 同样适用。

---

## 8. goal 模式工作流(强制)

触发 `/goal <目标条件>` 时按本节流程执行。

### 目标条件硬门槛(单条最大 4000 字符)

必须同时包含:核心任务 + 验证标准(命令退出码/测试输出/文件状态/HTTP 响应)+ 约束边界 + 质量要求 + 异常处理。缺一即拒绝启动。

劣质拒绝示例:`/goal 修复登录bug` / `/goal 优化一下架构`
优质示例:`/goal 修复登录接口中文账号登录失败,验证标准:pnpm --filter @ihui/api test auth 退出码 0;仅修改 apps/api/src/auth,不得改用户表结构;保持接口兼容性;无法复现的用例记录后跳过`

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

### 子命令

| 子指令                             | 语义                                    |
| ---------------------------------- | --------------------------------------- |
| `<目标条件>`                       | 设置目标并立即启动第一轮                |
| (无参数) / `status`                | 查询当前状态                            |
| `pause` / `hold`                   | 暂停,置 `paused`                        |
| `resume` / `continue`              | 断点续跑                                |
| `clear` / `stop` / `off` / `reset` | 终止并清理                              |
| `budget <数值>`                    | 设置 Token 上限,达阈值 `budget_limited` |
| `log` / `history`                  | 输出完整执行日志                        |

### 红线规则

- 单目标最大自动迭代 **20 轮**,超出 blocked。
- 高危操作(删分支/强推/删库表/影响生产)**必须暂停**请求人工确认。
- 严格围绕目标,禁止扩展需求、做无关重构。
- 每轮**完整承接上下文**(压缩后必须重读 STATE.md)。
- 连续 5 轮工具失败 → blocked。

### 失败回滚

- `blocked` / `budget_limited` 状态下**禁止** agent 自主执行 `git reset --hard` / `git checkout .` / `git clean -f`。
- 必须在 PROJECT_PLAN.md 记录:已修改文件清单 + 当前分支 + 起始 commit sha + 未完成原因 + 剩余任务 + 建议后续操作。
- 回滚决策权归属用户。

---

## 9. 多端同步开发强制规则(强制)

- 任何影响 API 接口契约 / 共享类型 / 数据库 schema / 共享 UI 组件 / 业务功能的改动,**必须**跨端同步:web + api + ai-service + desktop + extension + mobile-rn + miniapp-taro + cli(8 端)。
- **禁止**只改一端就交付,其他端留作"后续任务"(除非明确只属于单端)。
- **平台独占豁免**:desktop 系统托盘、extension 浏览器上下文菜单、miniapp-taro 微信支付、cli 终端集成等天然只属特定端,需在 PROJECT_PLAN.md 任务条目标注"平台独占"。

---

## 10. 交付报告一致性硬约束(强制)

同一份 .md 报告中**不得**同时出现:

- "无后续建议" / "完整收尾" / "对话可关闭"
- 与 "P1-P5" / "优化项" / "TODO" / "后续任务"

守门脚本:`scripts/check-delivery-report-consistency.mjs` + pre-commit 第 12 项。

---

## 11. 多 Subagent 并行开发强制规则(强制)

### 任务分配格式(强制)

派发子任务时必须用以下格式,缺一拒绝执行:

```
## 任务目标
<一句话>

## 受影响文件(绝对路径,只允许以下文件)
- g:\IHUI-AI\path\to\file1
- g:\IHUI-AI\path\to\file2

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

- 与第 8 节(删除安全)协同:subagent 不得删除非任务清单内文件。
- 与第 13 节(push 保护)协同:subagent 完成后由主 agent 统一 push。

---

## 12. 多会话并行操作同一仓库强制规则(强制)

- 多会话/多 agent 在同一仓库并行工作时,**禁止**任何破坏性 git 操作:`git restore` / `git stash push` / `git clean -f` / `git reset --hard` / `Remove-Item` 删除其他 agent 创建的文件(包括"看着像垃圾"的 `commit_msg.txt` / 临时测试文件 / 调试日志)。
- commit 阶段**只 add 本任务相关文件**:`git add <file1> <file2>`,**禁止** `git add .` / `git add -A` / `git add -u`。
- 正确流程:预检(`git status --porcelain`)→ 隔离(仅 add 本任务文件)→ 验证(`git status --short` 确认 staged 仅含本任务文件)。
- pre-push / pre-commit hook 失败因**其他 agent 引入的代码问题**(schema drift / 其他模块 TS/lint 错误 / 其他 agent 未完成 migration 等,不在本任务范围):
  - **直接用 `--no-verify` 跳过 hook 完成自己的 commit + push**,各 agent 各管各的,其他 agent 自己会处理自己的代码。
  - **禁止**修改其他 agent 代码"帮他们修" / `git reset --hard` / 把"等其他 agent 修复再 push"作为交付结论 / 用 AskUserQuestion 询问用户"如何处理其他 agent 的 XXX"。
  - 自己 commit + push 前只需保证**本任务改动文件** typecheck + lint + build 全绿即可。
  - `--no-verify` 合法场景**仅限**"hook 失败原因是其他 agent 代码"这一种;若 hook 失败原因是**本任务自己代码**,必须修复后正常 commit,**禁止** `--no-verify` 跳过。

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

- **禁止**在 `G:\` 根目录创建任何文件(包括 `commit_msg.txt` / 临时脚本 / 调试日志)。
- 临时文件统一放 `g:\IHUI-AI\.trae-cn\tmp\`(已 gitignore)。
- 任务完成后清理本任务产生的临时文件。

---

## 16. Push 阶段跨 Agent 改动保护规则(强制)

- 本 agent 完成 commit + push 后,不再触碰 working tree,不执行 `git pull` / `git fetch` / `git rebase` / `git push --force`。
- 抹除其他 agent 改动 → **协作事故**;混入其他 agent 改动到自己 commit → **污染事故**;修改其他 agent 文件"帮他们修" → **越权事故**。
- `--no-verify` 跳过 hook 的合法性:见 §12 最后一条(hook 失败因其他 agent 代码 → 合法跳过;hook 失败因本任务自己代码 → 禁止跳过)。`--no-verify` **不是**流程事故,前提是本任务改动文件已通过 typecheck + lint + build 验证。

---

## 17. 样式改动强制验证规则(强制,2026-07-19 立)

### 触发条件

任何涉及 UI 样式 / 布局 / 交互的代码改动(CSS / className / style / 组件结构 / 页面布局)。

### 必须遵守(强制红线)

1. **必须启动全链路 dev server**:web(3000) + api(3001) + ai-service(8000,失败不阻塞 UI 验证)。用 `long_running_process` + `blocking: false` 并行启动。
2. **必须用 browser_use 实际渲染验证**:
   - `browser_navigate` 访问目标页面
   - `browser_wait_for` 等待渲染稳定
   - `browser_take_screenshot` 截图初始状态
   - `browser_evaluate` 读 DOM 属性(offsetHeight / scrollHeight / getComputedStyle)— **禁止**只靠截图主观判断
   - 模拟交互(输入文字 / 点击)后再次截图 + 读 DOM
3. **验证证据必须写入交付报告**:每个状态截图描述 + DOM 数值 + 与预期对照表。
4. **未启动服务 + 未 browser_use 验证就交付 → 视为交付事故**。
5. **commit message 必须附 `Verified-DOM:` trailer**(若含 `apps/web/**/*.css` 改动):由 commit-msg hook 自动守门。格式:`Verified-DOM: http://localhost:3000/<path> (<DOM 属性=数值> ...)`。

### 允许跳过 browser_use 的场景(豁免)

1. 纯后端 API 改动(curl 验证)
2. 纯类型 / 工具函数改动(typecheck + test 验证)
3. dev server 30 分钟内无法修复(降级为单元测试,标注"dev server 启动失败")
4. CI 环境(用 Playwright / Cypress e2e)

---

## 18. 启动项目语义(强制)

用户说"启动项目" = 前后端全链路同步启动:web(3000) + api(3001) + ai-service(8000),必要时检查并启动数据库/Redis。**禁止**只启动前端就交付。

---

## 19. UI 改动交付前自验强制规则(2026-07-19 升级)

### 触发条件

任务类型 ∈ {UI 样式修改, 前端组件改动, 页面布局调整, Tailwind/CSS 类调整, shadcn 组件 props 调整}

### 强制动作(缺一不可,违反视为交付事故)

1. 改码前必须用 browser ping `http://localhost:3000` 确认服务在线;不通则先启动服务。
2. 改码后必须确认 web + api 服务在跑(browser 实际访问确认,不是假设)。
3. 必须用 browser_use subagent 实际渲染目标页面,截图自验 **4 个关键状态**:默认态 / hover 态 / active 选中态 / dark mode 态。
4. 必须读 DOM 数值验证样式生效(getAttribute / getComputedStyle 读 class/style 确认 Tailwind 类已应用)。
5. 交付回复必须附 4 状态截图证据 + "已自验通过"声明。
6. 服务起不来或工具故障时**禁止交付**,先解决环境或告知用户,绝不假装启动成功。

### 工具故障应急(2 次失败立即切换)

RunCommand 连续 2 次返回 `{Exited, exit_code 0, 空输出}` → 立即判定工具失联 → 切换 `Start-Process` 派生独立 powershell 窗口 → 仍失败 → 立即告知用户工具故障 + 提供手动命令清单。

任何"工具反复失败"场景必须先 Grep `c:\Users\Administrator\.trae-cn\memory\projects\-g-IHUI-AI\project_memory.md` 查是否已知约束,命中则按已知方案执行,不得重复踩坑。

### Next.js dev server CSS 缓存陷阱(强制,2026-07-19 立)

修改 `apps/web/app/globals.css` / `apps/web/src/styles/*.css` 后,Next.js dev 服务的 HMR **不一定重新编译 CSS chunk**。文件已更新,但浏览器拿到的是旧值(常见现象:`--text-vcenter-offset` 改了但浏览器仍渲染老值)。

**强制守门(2 步必走)**:

1. 改 CSS 后**必须**验证浏览器拿到新值(不是只看磁盘文件):
   ```bash
   # 找到 web 当前服务的 CSS chunk
   ls apps/web/.next/static/chunks/apps_web_app_globals_*.css | tail -1
   # curl 该 chunk,确认新值已编译进去
   curl -s "http://localhost:3000/_next/static/chunks/<chunk名>" | grep -c "新值特征"
   ```
2. 若 `grep` 返回 0 → 旧 chunk,必须 kill 旧 next-server 后重启 `pnpm --filter @ihui/web dev`(HMR 触发不了完整 CSS 重编译,只能重启):
   ```bash
   # 找到 next-server PID
   Get-Process -Name node | Where-Object {$_.StartTime -gt (Get-Date).AddHours(-1)}
   # kill
   Stop-Process -Id <PID> -Force
   # 重启
   pnpm --filter @ihui/web dev
   # 等 15s 编译完成,重新 curl 确认
   ```

**判断标准**:`grep -c "新值" chunk.css` 返回 ≥1 即新值生效,否则必须重启。

**反面案例**:不验证直接硬刷新 → 浏览器继续渲染老值 → 用户再反馈"改了没生效" → agent 再花几轮重新查根因。

---

## 20. i18n 约束规则(强制,2026-07-19 立)

### 翻译文件语言纯度

- **zh-CN.json**: 基准语言文件,其他 4 语言必须与之 parity(key 集合完全一致)。
- **zh-TW.json**: 繁体中文,禁止简体字(pre-commit 第 2b 项守门,opencc 字形转换检测)。
- **ko.json**: 韩语,禁止中文残留(pre-commit 第 2c 项守门,字符范围检测)。
- **ja.json**: 日语,禁止中文残留(warn-only 提醒,因日文汉字词易误报)。
- **en.json**: 英文,禁止中文残留。

### JSON 重复键禁止

- 同一对象内禁止出现重复 key(`JSON.parse` 时最后一个生效,前面被 shadowed)。
- 添加新键前先用 Grep 确认同级命名空间无同名块。
- 特别是 models/nav/sort/market 等高频命名空间,容易多 agent 并发添加导致重复。

### 翻译策略

- **品牌名**: 优先官方英文名(智谱清言→Zhipu AI, 百度文心→Baidu ERNIE, 宇树科技→Unitree, 火山引擎→Volcengine, 阿里云→Alibaba Cloud, 腾讯云→Tencent Cloud, 九章智算云→JiuZhang, 百度智能云→Baidu Cloud, 华为云→Huawei Cloud, 致远互联→Seeyon)。
- **公司名**: 优先官方英文名(同上)。
- **字体名**: 优先英文系统名(宋体→SimSun, 黑体→SimHei, 楷体→KaiTi, 微软雅黑→Microsoft YaHei)。
- **人名**: fictional/示例数据用拼音(李思涵→Li Sihan / 리쓰한 / リ・スハン);称呼符合目标语言习惯(李总→이 대표)。
- **技术术语**: 优先英文国际通用词(物联网→IoT, 人工智能→AI)。

### 守门工具

- `scripts/scan-i18n-zh-residue.mjs <locale> [--staged]`: 通用 i18n 中文残留守门。
  - zh-TW: opencc 字形转换检测(阻塞)。
  - ko: 字符范围检测(阻塞)。
  - ja: warn-only(不阻塞,因日文汉字词易误报)。
  - 未来新增 locale 在 `LOCALE_CONFIG` 加一行即可。
- `scripts/check-i18n-broken-en.mjs [--staged]`: en.json 破碎机翻英文守门(阻塞)。
  - 检测:no-space-concat(AgentDevPlatform)/ case-chaos(M3SubAI)/ possible-pinyin(siningpeople)/ zh-residue(兜底)。
  - 豁免:白名单 token(AI/GPT/LLM 等 50+ 品牌/技术缩写)、纯大写单词(PLATFORM 等)、单词单大写开头。
- `scripts/check-i18n-keys.mjs --staged`: i18n key 完整性 + parity 检查。
- `scripts/brand-glossary.json`: 品牌/字体/术语 canonical 映射表(机器可读,供翻译脚本引用)。
- `scripts/apply-brand-glossary.mjs [--dry-run]`: 应用品牌映射到 5 语言 i18n 文件。

---

## 守门脚本速查(pre-commit 第 1-16 项)

| #   | 脚本                                         | 用途                                    |
| --- | -------------------------------------------- | --------------------------------------- |
| 1   | check-api-key-leak.mjs                       | API key 泄露                            |
| 2   | check-i18n-keys.mjs                          | i18n 键完整性                           |
| 2b  | scan-i18n-zh-residue.mjs zh-TW               | zh-TW 简体字残留 (opencc 字形转换)      |
| 2c  | scan-i18n-zh-residue.mjs ko                  | ko.json 中文残留 (字符范围检测)         |
| 2d  | scan-i18n-zh-residue.mjs ja                  | ja.json 中文残留 (warn-only,不阻塞)     |
| 2e  | check-i18n-broken-en.mjs                     | en.json 破碎机翻英文                    |
| 3   | check-db-schema-drift.mjs                    | schema drift                            |
| 4   | check-stale-dist.mjs                         | packages 陈旧 dist                      |
| 4b  | check-dist-encoding.mjs                      | packages/*/dist UTF-8 BOM 守门          |
| 4c  | check-api-client-utf8.mjs                    | api-client 源码字节级 UTF-8 完整性      |
| 5   | lint-staged                                  | eslint + prettier                       |
| 6   | check-sanitizer-bypass.mjs                   | skipResponseSanitization                |
| 7   | check-dedupe.mjs                             | 依赖碎片化                              |
| 8   | check-api-routes.mjs                         | 前后端路由一致性                        |
| 9   | check-safe-parse.mjs                         | safeParse 静默忽略(warn-only)           |
| 11  | check-rounded-full.mjs                       | 容器圆角违规                            |
| 12  | check-delivery-report-consistency.mjs        | 交付报告一致性                          |
| 13  | check-grokbuild-integration-completeness.mjs | grok-build 整合完整性                   |
| 13b | check-project-plan-size.mjs                  | **PROJECT_PLAN.md 体积(<50KB)**         |
| 15  | check-api-migration-completeness.mjs         | 迁移完整性                              |
| 16  | 条件 typecheck                               | apps/web staged 时跑 typecheck          |
| 16b | 条件 database build                          | packages/database/src staged 时跑 build |
| 17  | git-push-guard.mjs                           | **post-commit 自动 push + 验证(防遗漏)** |

---

## 21. 任务完成硬定义 — 杜绝"commit 后忘记 push"协作事故(强制,2026-07-20 立)

### 触发原因

历史上多次出现 agent 自报"任务完成"但实际**仅本地 commit、未 push 到 origin** 的事故,用户被迫追问"你自己的修改你push合并了吗"。本质问题:`git commit` 与 `git push` 在工作流中是分离两步,中间存在遗漏窗口(context 丢失 / 用户打断 / 任务切换)。

### 任务完成的硬定义(5 条全满足才可声明"完成")

1. ✅ **本地有 commit**:`git log --oneline -1` 显示本次任务的 commit SHA
2. ✅ **工作区干净**:`git status --short` 无本任务残留 untracked / modified
3. ✅ **origin 同步**:`git push origin <branch>` 成功,stdout 含 `X..Y <branch> -> <branch>`
4. ✅ **HEAD 对齐**:`git rev-parse HEAD` === `git rev-parse origin/<branch>`
5. ✅ **守门脚本通过**:`node scripts/git-push-guard.mjs` exit 0

### 3 道自动防线

1. **post-commit 钩子自动 push**(主防线):`.husky/post-commit` 在 LFS 钩子之后立即调用 `node scripts/git-push-guard.mjs`。
   - 任何 `git commit` 完成后**自动检测**本地 ahead,有则自动 push 并验证 local == remote
   - 失败时**阻断**并提示手动 `git push origin main`,不静默
   - 跳过:`HUSKY_SKIP_PUSH=1 git commit ...`(紧急本地暂存场景,不推荐)

2. **pre-push 钩子 typecheck 闸门**(第二道,沿用):`.husky/pre-push` 跑 `pnpm typecheck:full`
   - 失败 → 阻止 push(commit 仍本地保留,可修复后重新 push)
   - 跳过:`HUSKY_SKIP_TYPECHECK=1 git push`(不推荐)

3. **手动 `git-push-guard` 验证**(兜底,任何时候可手跑):`node scripts/git-push-guard.mjs`
   - 打印 local HEAD vs remote HEAD
   - 本地 ahead → 自动 push
   - 完全对齐 → exit 0
   - 用于:交付前自验 / pre-delivery checklist / 怀疑遗漏时一键核查

### 红线(违反视为协作事故)

- ❌ 禁止在 commit 后**只输出文字**"已 commit"就声明任务完成,必须执行 push + 验证
- ❌ 禁止在交付报告中遗漏"local HEAD == remote HEAD" commit SHA 对照
- ❌ 禁止用 `--no-verify` 绕过 `git-push-guard`(除非证明 typecheck 已自验通过且显式说明)
- ❌ 禁止把"git push 失败"作为交付结论(必须修复后重推或显式说明阻塞原因)

### 交付报告必含证据(从 2026-07-20 起强制)

任何"任务完成"交付报告**必须**包含:

```
## Git 同步证据
- 本地 commit: <sha>
- origin commit: <sha>
- 同步状态: local == remote ✅ / 落后 N 个 commit ⚠️
- 守门脚本: node scripts/git-push-guard.mjs exit 0
```

---

## 关键参考文档

| 文档                   | 说明                               |
| ---------------------- | ---------------------------------- |
| `PROJECT_PLAN.md`      | **唯一任务计划文档**(必读)         |
| `.trae-cn/archive/`    | 历史归档(audit/交接/迁移报告,只读) |
| `docs/architecture.md` | 系统架构文档                       |
