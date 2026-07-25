# AGENTS.md — IHUI-AI 项目 Agent 指南

> 作用域:`d:\桌面\项目\IHUI-AI` 仓库根目录及所有子目录。
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
- `apps/web`(Next.js 15 + React 19 + Tailwind 4 + shadcn/ui)
- `apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)
- `apps/miniapp-taro`(Taro 4 + React)
- `apps/desktop` / `apps/extension` / `apps/mobile-rn` / `apps/cli`(各端独立)
- `packages/`(database / auth / types / ui / config / eslint-config / tsconfig)

---

## 3. 代码风格

- 做减法,最小化代码,零冗余。复用现有代码和模式,不创建文档文件(除非明确要求),不加 copyright/license header。

---

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅。hover 用 subtle 颜色变化,**不要蓝色发光边框**。复用 `packages/ui` 的 Card/Button/Input/Dialog。每个页面 < 250 行。时间用 `Intl.DateTimeFormat`,头像用 initials。状态徽章:draft 灰 / published 绿。积分正数绿色,负数红色。

### 圆角守门(强制)

- **禁止**纯圆形 / 胶囊容器:`rounded-full` / `rounded-pill` / `border-radius: 9999px` / `50%`。尺寸梯度:`rounded-sm`(2px)/ `rounded`(4px)/ `rounded-md`(6px)/ `rounded-lg`(8px)/ `rounded-xl`(12px)/ `rounded-2xl`(16px)。豁免:头像 / 装饰点 / 红点 / Switch 拇指。守门:`scripts/check-rounded-full.mjs` + pre-commit 第 11 项。

### 中文字体 + 图标垂直对齐硬约束(强制)

- **根治方案**:`apps/web/app/globals.css` 设 `--text-vcenter-offset: 0.3px` + 全局规则 `:where(button, a, [role='button'], [role='menuitem']):has(>svg):has(>span) > span { transform: translateY(var(--text-vcenter-offset)); }`,button/a 内 "icon + 中文 span" 同行布局自动应用,text-xs (12px) 用专用 0.7px 规则。配套:`apps/web/src/lib/nav-styles.ts` 5 个共享类 + `<CenteredText>` 组件(`apps/web/src/components/common/CenteredText.tsx`)。
- **守门**:`apps/web/e2e/icon-text-alignment.spec.ts` 阈值 |delta| ≤ 0.15px,漏改 → CI fail。**严禁** `-mt-px` / `margin-top: -1px` 反向微调 hack。

### 禁止分割线(强制)

- 禁止 `<hr>` / `divide-y` / `divide-x` / 单边 `border-t/b/l/r` 当分割线。允许:容器完整描边(`border border-border`)、背景色对比(`bg-card` vs `bg-background`)、间距分隔(`gap-*`)。

### 禁止渐变遮罩(强制)

- 任何容器禁止 `mask-image` / `-webkit-mask-image` / `linear-gradient` 用作边缘淡出。用显式 UI 元素("查看更多"按钮 / 计数徽章 / 分页)替代。

### 圆角容器内 absolute 子元素避让

- 父容器 `rounded-xl` + `overflow-hidden` 时,贴边子元素**禁止** `h-full`/`w-full`,用 `top-<radius> bottom-<radius>`(纵向)或 `left-<radius> right-<radius>`(横向)替代。映射:`rounded-lg`→`top-2 bottom-2` / `rounded-xl`→`top-3 bottom-3` / `rounded-2xl`→`top-4 bottom-4`。
- 拖拽手柄用双层 div 结构(外层命中区 + 内层可见细线),**禁止** `before:` 伪元素方案。

---

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js。用 Zod 校验请求参数。复用 `packages/auth` 的 authenticate 函数;admin 路由用 preHandler 统一校验(roleId >= 1)。幂等操作用 `onConflictDoNothing`。slug 从 name 自动生成。API 响应统一 `{ code, message, data }` 格式。

---

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
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
- **守门**(warn-only):`scripts/check-multi-end-sync.mjs` 检测 staged 跨端分布 4 场景(纯豁免目录→pass;触及 packages/* 未标注→warn;触及≥2 端→pass;触及 1 端未标注→warn),集成于 pre-commit 第 21 项。

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
- d:\桌面\项目\IHUI-AI\path\to\file1
- d:\桌面\项目\IHUI-AI\path\to\file2

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
- 与第 16 节(push 保护)和 §20 协同:subagent 完成后由主 agent 统一 push。

---

## 12. 多会话并行操作同一仓库强制规则(强制)

- 多会话/多 agent 在同一仓库并行工作时,**禁止**任何破坏性 git 操作:`git restore` / `git stash push` / `git clean -f` / `git reset --hard` / `Remove-Item` 删除其他 agent 创建的文件(包括"看着像垃圾"的 `commit_msg.txt` / 临时测试文件 / 调试日志)。
- commit 阶段**只 add 本任务相关文件**:`git add <file1> <file2>`,**禁止** `git add .` / `git add -A` / `git add -u`。
- 正确流程:预检(`git status --porcelain`)→ 隔离 add 本任务文件 → 验证 staged 仅含本任务文件。
- pre-push / pre-commit hook 失败因**其他 agent 引入的代码问题**(schema drift / 其他模块 TS/lint 错误 / 其他 agent 未完成 migration 等,不在本任务范围):**直接用 `--no-verify` 跳过 hook** 完成自己的 commit + push;**禁止**修改其他 agent 代码"帮他们修" / `git reset --hard` / 把"等其他 agent 修复再 push"作为交付结论 / 用 AskUserQuestion 询问用户;自己 commit + push 前只需保证**本任务改动文件** typecheck + lint + build 全绿即可;`--no-verify` 合法场景**仅限**"hook 失败原因是其他 agent 代码",若失败原因是**本任务自己代码**必须修复后正常 commit。

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

**必须用项目内路径**(根 `d:\桌面\项目\IHUI-AI`):扩展打包→`apps/extension/.output/chrome-mv3/`;Chrome profile→`.trae-cn/tmp/chrome-profile/`;临时副本→`.trae-cn/tmp/<任务名>/`;临时脚本→`.trae-cn/tmp/<脚本名>.ps1`;临时文件统一放 `.trae-cn/tmp/`(已 gitignore),任务完成后清理。

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

**守门工具**:`scan-i18n-zh-residue.mjs <locale>`(zh-TW/ko 阻塞,ja warn)/ `check-i18n-broken-en.mjs`(en 破碎机翻,阻塞)/ `check-i18n-keys.mjs --staged`(key 完整性+parity+白名单)/ `brand-glossary.json`(canonical 映射表)+ `apply-brand-glossary.mjs [--dry-run]` / `i18n-diff.mjs`(差异检测,输出 pending.json)/ `i18n-apply.mjs [--check]`(应用器,按 zh-CN 重排 key+parity 校验)。

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
3. **pre-push**:`.husky/pre-push` 跑 `pnpm typecheck:full`,失败阻止 push(commit 仍本地保留);跳过 `HUSKY_SKIP_TYPECHECK=1`(不推荐)。
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

## 守门脚本速查(pre-commit 项,按类别)

- **i18n**(2/2b/2c/2d/2e/2f):check-i18n-keys(parity+白名单)/ scan-i18n-zh-residue(zh-TW/ko 阻塞,ja warn)/ check-i18n-broken-en(阻塞)/ i18n-diff(翻译流水线,2f-web + 2f-miniapp-taro 阻塞)
- **代码质量**(1/3/4/4b/4c/5/6/7/8/9/10):API key 泄露 / schema drift / 陈旧 dist / UTF-8 完整性 / lint-staged / sanitizer / dedupe / 路由一致性 / safeParse(warn)/ OpenAPI(info)
- **UI/样式**(11/17/18/20/24a/24b/27/28):圆角 / CSS token / title tooltip / Tailwind 冲突 / 侧边栏宽度+端口注册表(warn)/ z-index+遮罩 z-index(阻塞)
- **工程约束**(12/13b/13c/15/19/21/22/23):交付报告 / PLAN 体积(warn)+防误删 / 迁移完整性 / staged 污染(warn)/ 多端同步(warn)/ README 同步(warn)/ staged 清单(info)
- **Push/工作区**(25/26/29):项目外路径(阻塞)/ 父目录污染(阻塞)/ Push 同步(阻塞)
- **条件**(16/16b):apps/web staged → typecheck;packages/database/src staged → build

> post-commit 钩子:`git-push-guard.mjs` 自动 push + 验证 local == remote(见 §20)。

---

## 关键参考文档

| 文档 | 说明 |
| --- | --- |
| `PROJECT_PLAN.md` | 唯一任务计划文档(必读) |
| `.trae-cn/archive/` | 历史归档(audit/交接/迁移报告,只读) |
| `docs/architecture.md` | 系统架构文档 |
| `docs/port-management.md` | 端口注册表(88xx 段) |
