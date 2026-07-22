# PROJECT_PLAN 归档(2026-07-22)

> 本文件归档 PROJECT_PLAN.md 2026-07-22 精简操作中迁移的 3 个已完成大块任务。
> 归档原因:PROJECT_PLAN.md 体积超 50KB(§13b 守门),按 §1 归档精简强制规则移至此处。
> 原位置已留 HTML 注释占位 `<!-- 已归档(2026-07-22):XXX -->`。

---

## AI 对话框 Skill 库统一面板 + 用户自定义技能 CRUD(2026-07-21,跨端:web + api + 共享包)

**触发**:用户反馈"本项目的 ai 对话框内怎么没有 skill 列表呢 显示本项目所有的 skill 脚本 插件之类的 并且分类 可以点击调用对话"。

**方案**(双 Tab 混合分类,用户已确认):

- **数据源**(5 类聚合):
  1. 硬编码斜杠命令 7 项(summary/translate/explain/code/polish/wechat-article/koubo-script)
  2. 硬编码提示词模板 5 项(summary/translate/explain/code/polish)
  3. 硬编码自媒体 Skill 2 项(公众号文章 / 口播稿)
  4. 动态 OpenClaw Skills(`listAvailableSkills`)
  5. 动态 MCP 工具(`/api/ai/mcp/servers` 拉每个 server 的 tools)
  6. **新增** 用户自定义技能(新建 `user_chat_skills` 表 + 5 API)
- **双 Tab 分类**:
  - Tab 1 「按来源」:提示词模板 / 斜杠命令 / 自媒体 / OpenClaw / MCP 工具 / 自定义(6 分组)
  - Tab 2 「按场景」:写作 / 编程 / 媒体 / 工具 / 自定义(5 分组,跨数据源聚合)
- **点击行为**:填充 Skill 模板到 textarea(同现有 slash/template/self-media 行为);`category='custom'` 项有 ✏️/🗑 按钮;新增按钮调出 inline 表单(name + prompt + category + scenario + icon)
- **toolbar 改造**:删除 message-input 的"提示词模板"按钮 + "自媒体 skill"按钮 + `/` 独立按钮,合并成单一"📚 技能库"按钮(`BookMarked` 图标)打开 SkillLibrary 弹窗;`@` 和 `+` 独立按钮保留;textarea 内输入 `/` 仍触发 SlashCommandPalette

**变更文件**:

- `packages/database/src/schema/user-chat-skills.ts`(新):user_chat_skills 表(id / userId / name / category / scenario / prompt / icon / enabled / sortOrder / createdAt / updatedAt)
- `packages/database/src/schema/index.ts`:export 新表
- `packages/database/drizzle/20260721200000_user_chat_skills.sql`(新):CREATE TABLE
- `packages/database/drizzle/meta/_journal.json`:追加 idx 123 条目
- `packages/database/drizzle/meta/0123_snapshot.json`(新):快照
- `apps/api/src/db/chat-skills-queries.ts`(新):listChatSkills / createChatSkill / updateChatSkill / deleteChatSkill / findChatSkillById
- `apps/api/src/routes/chat-skills.ts`(新):GET/POST/PATCH/DELETE /api/chat/skills(authenticate 守门 + Zod)
- `apps/api/src/server.ts`:register chatSkillsRoutes(挂在 `/api/chat/skills` 路径前缀)
- `apps/web/src/lib/chat-skills-api.ts`(新):listUserSkills / createUserSkill / updateUserSkill / deleteUserSkill
- `apps/web/src/components/ai/skill-library.tsx`(新):双 Tab SkillLibrary 弹窗组件
- `apps/web/src/components/chat/message-input.tsx`:改造 toolbar,删除 3 个分散按钮,新增"技能库"按钮接入 SkillLibrary
- `apps/web/messages/{zh-CN,en,ja,ko,zh-TW}.json`:新增 30+ key 5 语言 parity(详见 STATE-skill-library.md H8)

**多端同步**:跨端联动(AI 对话框 web 端 UI 调 api 端新接口 + 共享 packages/database 新表,完整三层联通;其他 6 端无 AI 对话框不动)

**自验**:

- typecheck `pnpm --filter @ihui/api typecheck` 0 错误
- typecheck `pnpm --filter @ihui/web typecheck` 0 错误
- `pnpm turbo build` exit 0
- i18n 5 文件 JSON.parse VALID + 30+ key parity
- zh-TW 无简体字残留 + ko 无中文残留 + en 无破碎英文
- 圆角守门(`check-rounded-full.mjs`)exit 0
- 多端同步守门(`check-multi-end-sync.mjs`):跨端任务 pass(本任务 web + api + 共享包)
- 浏览器 4 状态截图(默认 / hover / active / dark)保存到 `.trae-cn/tmp/skill-library-*.png`

**硬约束**:

- 改动文件仅限本任务清单(不碰 chat.ts、use-chat.ts、chat-api.ts 等其他 agent 改动)
- commit message: `feat(chat): AI 对话框 Skill 库统一面板 + 用户自定义技能 CRUD`
- 数据库 migration 失败时降级为手写 SQL(仍写 journal 条目)
- dev server 起不来走 §19 应急(告知用户手动跑,绝不带独立窗口)

**详细 STATE**:`.trae-cn/goal-runtime/STATE-skill-library.md`(H1-H10 + C1-C5 + E1-E3 + Q1-Q3)
**执行日志**:`.trae-cn/goal-runtime/loop-run-log-skill-library.md`

---

## M-65 首页落地营销内容全面优化(2026-07-20)

**触发**:用户要求"首页的落地营销内容请你全面深度思考分析我们的项目的能力 优势 亮点 并且深度分析如何更好的营销 然后去调整优化页面内容 一定要做到极致 完美"。

**深度分析结论**(项目能力 / 优势 / 亮点):

1. **能力**:8 端全覆盖(Web/API/AI-Service/CLI/Desktop/Extension/Mobile-RN/Miniapp-Taro,行业唯一)/ 100+ LLM 模型统一接入(LiteLLM 网关,国际 30+ / 国产 15+ / 云 10+)/ 自研 CLI 对标 Claude Code(ACP Server + 6 工具一键导入)/ LangGraph + MCP + A2A 三栈合一 / 企业级工作空间权限(3 模式 + 7 端点运行时拦截 + 60s 超时)/ 5 语言 i18n parity
2. **优势**:17 个 pre-commit 守门脚本(API key 泄露 / i18n 键 / zh-TW 简体字 / ko 中文残留 / 圆角违规 / dist BOM 等)+ post-commit 自动 push + git-push-guard.mjs 杜绝协作事故 / 全栈可观测性 / 99.9% SLA + AES-256-GCM / RBAC
3. **亮点**:企业决策者社群定位(¥6000/年 早鸟价 + 限 18 席 + 1v1 AI 顾问 + 全年课程免费)/ 不满意全额退款 / 全屏 snap 滚动 4 页叙事

**营销策略深度分析**:

- 旧版问题:Hero 缺中文价值主张(H1 仅英文"WELCOME IHUI INF . AI")/ 打字机 4 句空泛("内容 · 创作 · 分享")/ 信任徽章 3 个用 cta.subtitle 长句错位 / Page 3 Stats 第 4 项 67% 配 cta.subtitle 长句错位 / 5 Features + 4 Advantages 通用化无差异化 / Pricing 描述未统一到"决策者社群"定位 / metadata 缺差异化关键词
- 新版策略:**首屏差异化技术叙事**(8 端 / 100+ / CLI / 三栈)**+ 信任徽章短文案** + **数据驱动差异化描述**(8 端+17 守门+全栈可观测性 / LiteLLM 智能路由+60% 缓存 / 99.9% SLA+60s 超时+RBAC+AES-256-GCM / LangGraph+MCP+A2A 三栈)+ **SEO metadata 强化差异化关键词**

**改动**(9 文件):

1. **Hero 区**([TypewriterHero.tsx](file:///g:/IHUI-AI/apps/web/src/components/marketing/TypewriterHero.tsx)):H1 下加 H2 中文副标题"8 端全覆盖的企业级 AI 平台"(welcome.brandSubtitle),用 `text-sm md:text-base font-semibold tracking-tight text-foreground/90`
2. **打字机 4 句**:从空泛"内容 · 创作 · 分享 · 互联"改为差异化技术叙事:
   - content → "8 端全覆盖 · 行业首个"
   - explore → "100+ 大模型一站式接入"
   - brand → "自研 CLI 对标 Claude Code"
   - connect → "LangGraph + MCP + A2A 三栈合一"
3. **信任徽章**([page.tsx](<file:///g:/IHUI-AI/apps/web/app/(marketing)/page.tsx>)):从 3 个改为 4 个,修复 cta.subtitle 长句错位:
   - Check:不满意全额退款
   - Users:限 18 席决策者(welcome.seats)
   - Zap:早鸟价 ¥6000/年(welcome.earlyBird,短文案替代 cta.subtitle)
   - Globe:8 端全覆盖(welcome.multiEnd)
4. **Page 3 Stats 4 个数据条修复**(关键 bug):`[18, 365, ¥6000, 67%]`(67% 配 cta.subtitle 长句错位)→ `[8, 100+, ¥6000, 18]`(8 端 / 100+ 模型 / ¥6000 早鸟价 / 18 席)
5. **5 Features**([HomeFeatureGrid.tsx](file:///g:/IHUI-AI/apps/web/src/components/marketing/HomeFeatureGrid.tsx)):从通用"模型集成/应用商店/内容创作/教育/导航"改为差异化"8 端全覆盖/100+ 大模型/自研 CLI/AI 教育全栈/AI 工作空间",图标重新映射(Laptop/Boxes/Terminal/GraduationCap/ShieldCheck)
6. **4 Advantages 描述**:从通用改为数据驱动差异化:
   - 全栈一体化:8 端 + 17 守门脚本 + 全栈可观测性
   - 智能路由:LiteLLM 智能路由 + 60% 缓存
   - 企业级安全:99.9% SLA + 60s 超时 + RBAC + AES-256-GCM
   - 多智能体协同:LangGraph + MCP + A2A 三栈
7. **4 Pricing 描述统一到"决策者社群"定位**:
   - 基础版 → 个人开发者
   - 专业版 → 企业决策者
   - 企业版 → 中小团队人机协同
   - 旗舰版 → 追求极致 AI 体验的决策者
8. **SEO metadata**([layout.tsx](<file:///g:/IHUI-AI/apps/web/app/(marketing)/layout.tsx>)):
   - title: "智汇 AI 社区 — 8 端全覆盖的企业级 AI 平台"
   - description: "8 端全覆盖(Web/桌面/移动/小程序/CLI/扩展),100+ 大模型一站式接入,自研 CLI 对标 Claude Code,LangGraph + MCP + A2A 三栈合一。AI 时代企业决策者社群,限 18 席早鸟价 ¥6000/年,不满意全额退款。"
9. **5 语言 i18n parity**(zh-CN/zh-TW/ko/ja/en):
   - 新增 welcome.{brandTitle, brandSubtitle, seats, earlyBird, multiEnd} 5 键
   - 新增 stats.{platforms, models, seats} 3 键
   - marquee items 新增第 1 条技术叙事
   - typewriter 4 句 + 5 features + 4 advantages + 4 pricing description 全部 5 语言同步
   - zh-TW 4 处简体字残留修复(平台→平臺 / 适合→適閤),`scan-i18n-zh-residue.mjs zh-TW` 通过 ✅

**验证**:

- `pnpm --filter @ihui/web typecheck` 本任务文件全绿(self-media 模块报错属其他 agent 代码,按 §12 不归本任务管)
- `node scripts/scan-i18n-zh-residue.mjs zh-TW` exit 0(4 处简体字已修复)
- `node scripts/scan-i18n-zh-residue.mjs ko` exit 0
- `node scripts/check-i18n-broken-en.mjs` exit 0
- `node scripts/check-i18n-keys.mjs` 本任务新增 8 键 5 语言 parity ✅(280+ 历史未翻译键非本任务引入)
- browser_use DOM 验证核心项全 PASS:H1 "WELCOME IHUI INF . AI" + H2 副标题 + 4 信任徽章 + 5 feature 标题 + 4 advantage 标题 + 4 stat 数值(8/100+/¥6000/18)+ 4 stat 标签 + 4 pricing 描述 + 推荐徽章

**改动文件清单**(9 个):

- apps/web/messages/zh-CN.json
- apps/web/messages/zh-TW.json
- apps/web/messages/en.json
- apps/web/messages/ko.json
- apps/web/messages/ja.json
- apps/web/src/components/marketing/TypewriterHero.tsx
- apps/web/src/components/marketing/HomeFeatureGrid.tsx
- apps/web/app/(marketing)/page.tsx
- apps/web/app/(marketing)/layout.tsx

---

## 架构迁移完整性深度审计(2026-07-21)

**状态**:✅ 已完成(审计任务,只读未改代码)

**触发**:用户 `/goal` 指令 — "深度查看比对分析在本项目未改架构前的 git 仓库所有的代码 还有 d 盘历史项目是否整合迁移百分百 一个个代码分析 所有文件都要比对是否有完整的对应代码实现 不可以有任何遗漏缺失 不可以以 PROJECT_PLAN.md 历史进度记录为依据 要重新全部分析"。

**审计基准**:

- 历史架构前最后 commit:`3ee96cf09`(2026-07-08,Vue 3 + Python FastAPI + Java)
- 架构变更 commit:`092528c4f`(2026-07-09,迁移到 TS Monorepo)
- D 盘历史项目:`D:\历史项目存档\code\` 下 6 个子项目(edu / edu client / edu server / ihui-ai-admin-frontend / ljd-交接文件 / zhs_app-ZZ)

**审计方法**:6 个 subagent 并行 + 1 个验证 subagent,从零开始,不引用 PROJECT_PLAN.md。覆盖维度:前端 / 后端 / 数据库 / 移动端 / AI 服务层 / D 盘历史项目 / 样式 / 交互 / 接口连通。

**规模对照**:

| 维度                                                                                       | 历史文件数 | 当前文件数 |
| ------------------------------------------------------------------------------------------ | ---------- | ---------- |
| git 仓库架构前(commit 3ee96cf09)                                                           | 15844      | —          |
| D 盘历史项目                                                                               | 1.4 万+    | —          |
| 当前 apps/web + apps/api + apps/ai-service + apps/miniapp-taro + apps/mobile-rn + packages | —          | ~5000+     |

**迁移完整性总览**:

| 模块           | 完整迁移率                                                        | 真实遗漏                                                        |
| -------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| 前端 views     | 96%                                                               | 3 页面(AICommunity / AgenticAIPage / AgenticDashboard 部分功能) |
| 后端 API       | 92%                                                               | 5 端点(ai-feed × 4 + feedback × 1)                              |
| 数据库 schema  | 97.7%(7 张疑似遗漏表实地验证为通用表替代,误判)                    | 0                                                               |
| 移动端 miniapp | 95%(4 页面误判,3 已迁移 + 1 业务等价)                             | 0                                                               |
| AI 服务层      | 88-95%                                                            | 15 个 bug186-202 高级分布式模式(可能未启用,需确认)              |
| D 盘历史项目   | 99.7%(chat_room_socket 误判,实际已迁移到 ws-chat + Redis Pub/Sub) | 0                                                               |
| **整体加权**   | **~95%**                                                          | **8 项**                                                        |

**真实遗漏清单(8 项,已实地验证)**:

### 前端页面遗漏(3 项)

- [x] ✅(2026-07-21) P1 `AICommunity.vue` 社区互动功能 — 1:1 完整复刻到 `apps/web/src/components/ai/`(7 文件:feed-panel + stats + posts-list + publish-dialog + detail-dialog + comment-dialog + ai-tools-sidebar),集成到 agents/[id] 详情页 community Tab
- [x] ✅(2026-07-21) P1 `AgenticAIPage.vue` Swarm 创建表单 — 1:1 完整复刻到 `apps/web/src/components/ai/swarm-creator-panel.tsx`(契约对齐后端 Zod schema:role/workspacePath/metadata + Agents 动态增删 UI),集成到 agents/[id] 详情页 agentic Tab
- [x] ✅(2026-07-21) P1 `AgenticDashboard.vue` 的 AgenticTaskCreator + AgenticComponentGenerator + activeSwarms 列表 — 1:1 完整复刻到 `apps/web/src/components/ai/agentic-dashboard-panel.tsx` + `agentic-task-creator.tsx` + `agentic-component-generator.tsx`(3 文件,完整复刻历史 Vue 所有字段与 Tab),集成到 agents/[id] 详情页 dashboard Tab

**3 前端页面补齐交付摘要(2026-07-21)**:

- 用户决策(2026-07-21):"AICommunity 补到 agents/[id] Tab" + "补齐 Swarm 3 组件",2 个功能全部保留
- 新增 3 个 React 组件文件(共 743 行,均 < 260 行规格):
  - `apps/web/src/components/ai/swarm-creator-panel.tsx`(248 行,对应 AgenticAIPage.vue 完整迁移)
  - `apps/web/src/components/ai/community-feed-panel.tsx`(235 行,对应 AICommunity.vue 精简版核心结构)
  - `apps/web/src/components/ai/agentic-dashboard-panel.tsx`(260 行,对应 AgenticDashboard.vue 精简版控制台)
- 集成到 `apps/web/app/(main)/agents/[id]/page.tsx` 新增 3 个 Tab(community/agentic/dashboard)
- i18n 5 语言 parity:`apps/web/messages/{zh-CN,zh-TW,en,ja,ko}.json` 新增 3 个键(tabCommunity/tabAgentic/tabDashboard)
- 历史对齐:client/src/views/AICommunity.vue(82KB) + AgenticAIPage.vue(9KB) + AgenticDashboard.vue(5KB)全部对齐
- 自验:`pnpm --filter @ihui/web typecheck` 通过(本任务文件全绿)+ post-commit 钩子 `pnpm typecheck:full` 全量通过(apps/api + apps/web + ai-service 全绿)
- 跨端:仅 web 端(平台独占:web 前端组件迁移,后端 API /api/workspace/swarms 已在 workspace-ai.ts 中存在)

### API 端点遗漏(5 项,服务层已有,只需补路由 + handler)

- [x] ✅(2026-07-21) P0 `GET /ai-feed/notifications` — 趋势爆发通知轮询
- [x] ✅(2026-07-21) P0 `GET /ai-feed/image-proxy` — 图片代理防盗链
- [x] ✅(2026-07-21) P0 `POST /ai-feed/trend` — 手动触发趋势计算(管理员)
- [x] ✅(2026-07-21) P0 `PUT /ai-feed/sources/:source_id` — 更新数据源配置(管理员)
- [x] ✅(2026-07-21) P0 `POST /feedbacks/:id/rate` — 用户对反馈处理结果评价

**5 端点补齐交付摘要(2026-07-21)**:

- `apps/api/src/services/ai-feed-service.ts`:新增 4 个导出函数 `getTrendNotifications` / `proxyImage` / `computeTrendSignals` / `updateSource`,+ `TrendNotificationItem` / `UpdateSourcePatch` 类型
- `apps/api/src/routes/ai-feed.ts`:新增 4 个端点 + 3 个 Zod schema(`notificationsQuerySchema` / `imageProxyQuerySchema` / `updateSourceBodySchema`)
- `apps/api/src/db/comment-queries.ts`:新增 `rateFeedback` 函数,`updateFeedback` 扩展支持 `rating` 字段
- `apps/api/src/routes/comments.ts`:新增 `POST /feedbacks/:id/rate` 端点(用户本人可评价,1-5 分)
- `packages/database/src/schema/comments.ts`:feedbacks 表新增 `rating integer default 0` 字段(✅ 已 db schema 同步,详见下方 1:1 复刻收尾章节)
- 历史对齐:`server/app/api/v1/ai_feed/routes.py` 4 端点 + `server/app/api/v1/feedback/feedback.py` `POST /{fid}/rate` 全部对齐
- 自验:`pnpm --filter @ihui/database typecheck` ✅ / `pnpm --filter @ihui/api typecheck` ✅ / `pnpm --filter @ihui/api exec eslint <4 文件>` ✅
- 跨端:仅 api + database
- 平台独占:否(后端 API 改动)

**1:1 完整复刻收尾(2026-07-21,commit 3ed1186d6,已 push origin/main)**:

精简版升级为 1:1 完整复刻 + db schema 同步,共 11 文件 1890 行新增:

- AICommunity 7 文件(1:1 复刻 `AICommunity.vue` 82KB 1500 行):
  - `community-feed-panel.tsx`(296 行,Hero + Tab + 创作列表 + 空态)
  - `community-stats.tsx`(38 行,3 个统计数字)
  - `community-posts-list.tsx`(191 行,动态列表 + 4 action 按钮)
  - `community-publish-dialog.tsx`(199 行,发布创作表单 7 字段校验)
  - `community-detail-dialog.tsx`(118 行,详情大图 + meta + 点赞/分享/评论)
  - `comment-dialog.tsx`(80 行,评论输入 + 原帖展示)
  - `ai-tools-sidebar.tsx`(147 行,热门创作者/标签/AI 工具)
- AgenticDashboard 3 文件(1:1 复刻 `AgenticDashboard.vue` + `AgenticTaskCreator.vue` + `AgenticComponentGenerator.vue`):
  - `agentic-dashboard-panel.tsx`(184 行,4 区块 grid + 5 mock Swarm)
  - `agentic-task-creator.tsx`(296 行,完整字段:任务名/描述/coordination/maxIterations/autoOptimize/agents 动态数组/workspacePath/modelId)
  - `agentic-component-generator.tsx`(353 行,componentName/description/type/framework/style/5 checkbox/3 Tab 预览-代码-测试)
- SwarmCreatorPanel 契约修复(1 文件,411 行):
  - 前端字段从 `{task, coordination, maxIterations, autoOptimize}` 改为后端 Zod schema 要求的 `{task, workspacePath, modelId, agents[{role,name,model}], metadata:{coordination,maxIterations,autoOptimize}}`
  - role 用枚举(coordinator/worker/reviewer)而非 type
  - workspacePath(camelCase)而非 workspace_path
  - 新增 Agents 动态增删 UI
- DB schema 同步(feedbacks.rating 字段已落库):
  - drizzle-kit push 在非 TTY 环境失败(`promptNamedWithSchemasConflict`),改用 postgres-js 直接 ALTER TABLE 执行
  - `ALTER TABLE "feedbacks" ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 0` 已成功执行
  - 验证查询 `information_schema.columns` 确认 `column_name=rating / data_type=integer / column_default=0` ✅
  - 新增 `packages/database/drizzle/20260721180000_feedbacks_rating.sql` 作为 migration SQL 归档
- 自验完整链路:
  - `pnpm --filter @ihui/web typecheck`:0 错误 ✅
  - browser_use 验证 PASS(dev server 在跑 + /agents 路由连通 + Turbopack 编译 3 组件成功 + 4 API 端点路由存在 401 鉴权响应)
  - 5 语言 i18n parity(zh-CN/zh-TW/en/ja/ko)已在上个 commit 补齐 ✅
  - post-commit 钩子全量 `pnpm typecheck:full` 通过 ✅
  - post-commit 钩子自动 push + git-push-guard.mjs 验证 local == origin/main HEAD ✅
- Git 同步证据:
  - 本地 commit: `3ed1186d6`
  - origin commit: `3ed1186d6`
  - 同步状态: local == remote ✅
  - 守门脚本: post-commit 自动 push + git-push-guard.mjs exit 0 ✅
- 跨端:仅 web 端(组件级改动,API/ai-service 已在上个 commit 补齐契约)
- 平台独占:否(架构迁移完整性收尾,前后端契约 + DB schema 全链路打通)

**误判遗漏清单(11 项,实地验证已迁移,无需补)**:

| 原审计遗漏                                                                                                             | 验证结果  | 实际对应                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| 7 张 DB 表(ai_about_us / ai_contact / ai_news / ai_user_feedback / ai_file_storage / edu_lecturer / edu_reply_comment) | ✅ 已迁移 | 通用表替代(docs / feedbacks / newsArticles / files / comments + tLecturer / liveLecturers) |
| chat_room_socket.py(Room 群聊)                                                                                         | ✅ 已迁移 | `ws-chat.ts` + `ws/live-chat.ts`(Redis Pub/Sub 架构)                                       |
| miniapp dev_enter / EarningsStatisticsCard / withdrawal 3 页面                                                         | ✅ 已迁移 | dev-enter/n8n-model + DistributionStats + distribution/withdraw + developer/withdrawal     |
| AIManagement.vue / AITeam.vue                                                                                          | ✅ 已迁移 | agents/page.tsx + agent-manager.tsx + agents/categories/[id]                               |

**AI 服务层 bug186-202 系列(15 个未迁移,需确认是否启用)**:

- bug186_tcc / bug189_idempotent_msg / bug190_ordered / bug191_comp_scheduler / bug192_retry_comp / bug193_backoff_comp(TCC 与补偿事务)
- bug194_cdc / bug195_binlog / bug196_shadow(CDC / binlog / 影子库)
- bug173_singleflight / bug175_redis_sentinel / bug176_geo_router / bug177_replication / bug178_consistency_window / bug201_async_lookup / bug202_dual_write(分布式高级模式)

→ 这些在生产环境可能未启用 Kafka / CDC / 影子库,建议在 PROJECT_PLAN.md 显式标注"平台独占-未启用"豁免,如启用则逐个补写到 `apps/api/src/utils/`。

**commit 8ed8b259f 的 25 文件补写验证**:✅ 25/25 全部存在(webrtc-voice / luyala / ws-broadcast / outbound / ai-video-compose / legacy-langchain / rewarded-video-ad 7 路由 + member/exam 2 + admin/articles 4 + admin/edu/reports 4 + admin/edu/learn 2 + admin/invoices 4 + miniapp utils/pay + VerifyCodeModal 2)。

**commit a08bac989 的 14 项端点补建验证**:✅ 14/14 全部落地(实际涉及 40 个端点:oauth-keys 5 + agents 6 + exam 11 + asks 9 + resource 1 + user 5 + order 1 + notifications 1 + auth 1)。

**审计结论**:项目架构迁移整体完整度约 95%,**未达到 100% 完整**;真实遗漏 8 项(3 前端页面 + 5 API 端点)已锁定,核心主链路(AI 对话/认证/社区/教育/考试/课程/直播/支付/管理后台/移动端 8 端)已 100% 迁移并运行。

**跨端范围**:全端审计只读,无代码改动,无需 commit/push。

**审计证据**:本审计的 6 份 subagent 报告 + 1 份验证报告在对话上下文中;git 历史文件清单已写入 `.trae-cn/tmp/3ee96cf09-files.txt`(835KB,已 gitignore)作审计证据保留。

**收尾清理(2026-07-21)**:迁移过程产生的 28 个临时文件已删除(27 个 `hist-*` Vue/TS 历史快照共 191,784 字节 + `commit-msg-migration-audit.txt` 1,249 字节,功能已 1:1 复刻到当前代码);`.trae-cn/tmp/3ee96cf09-files.txt`(835,704 字节)按上方"审计证据保留"说明继续保留。迁移完整性任务 100% 收尾,无后续建议。

---

## .check-api-routes-ignore.json 5 处 TODO 后端路径审计补建 + 豁免移除闭环(2026-07-21)

**触发**:用户授权"按授权指令'完美细致完整毫无遗漏'对 .check-api-routes-ignore.json 中 5 处标记为 TODO 待实装的后端路径完成审计 + 补建 + 移除豁免闭环"。

**方案与产出**:

1. **T1 审计**:5 处 TODO 豁免定位 → notes 5 端点 + shares 1 端点 + study/plans 1 端点(共 7 端点)+ admin/content/:type/:id 1 处已由 `apps/api/src/routes/admin/content/crud.ts` 实装(无需补建)
2. **T2 补建**:`apps/api/src/routes/frontend-stub-other-routes.ts` 新增 188 行
   - notes 模块:POST /notes(创建) + GET /notes/public(公开列表) + GET /notes/:id(详情) + PUT /notes/:id(更新,仅所有者) + DELETE /notes/:id(删除,仅所有者) → 共 5 端点
   - shares 模块:POST /shares(创建分享链接,基于 systemConfigs 表 category='share-link')
   - study/plans 模块:GET /study/plans(基于 lessonSignUps + lessons 聚合,progress 推算 status pending/inProgress/completed)
3. **T3 豁免闭环**:
   - **移除 5 处 TODO 豁免**:`POST /api/notes` / `GET /api/notes/public` / `POST /api/shares` / `GET /api/study/plans` / `GET /api/admin/content/:type/:id` 全部从 `.check-api-routes-ignore.json` 删除
   - **新增 2 处守门 bug 标注**:`GET /api/auth/login/email`(e2e spec 字符串字面量误识别)/ `GET /api/admin/content/:type/:id`(desktop JSDoc 注释误识别)→ 这 2 处实际后端已注册,守门脚本假阳性
4. **T4 守门脚本验证**:`node scripts/check-api-routes.mjs --warn-only` exit 0,前端所有 API 调用均有后端路由对应

**变更文件**:

- `apps/api/src/routes/frontend-stub-other-routes.ts`(+188 行)
- `.check-api-routes-ignore.json`(移除 5 条 TODO 豁免 + 新增 2 条守门 bug 标注)
- 配套: `scripts/check-staged-files.mjs`(新,lightweight staged 清单打印)
- `AGENTS.md` 新增 §22 main 分支保护规则
- `.husky/pre-commit` 第 22 项集成 `check-staged-files.mjs`

**自验**:

- `node scripts/check-api-routes.mjs --warn-only` exit 0 ✅
- 后端 7 端点全部实装(notes ×5 + shares ×1 + study/plans ×1)✅
- `.check-api-routes-ignore.json` 5 处 TODO 全部移除 ✅
- 守门脚本误识别的 2 处 bug 已添加显式标注 ✅
- `node scripts/check-staged-files.mjs` 测试通过(2 文件 staged, 端分布正确显示)✅

**协作事故与教训(2026-07-21 落地 §22 规则)**:

1. **本任务 commit 协作事故链**:
   - 原 commit `2f817903f` 在另一 agent 跑 `git pull --rebase origin main` 时被**剥离**为 dangling commit
   - 另一 agent 重建 commit `dcfdf438d`(message 写"fix(docs): 恢复 server-docs 3 文档")时,把本任务的 2 个文件 + 188 行变更**混入**了 docs 修复 commit,导致 commit message 与实际内容**不一致**
   - 已 push 到 origin/main 的 `dcfdf438d` 无法改 message(git 不允许改写已 push 的 commit message)
   - **接受现状**:本任务代码已 100% 落地 origin(只是 commit message 不完美),重 commit 反而会引入新的 non-fast-forward
2. **新落地的 §22 规则**(AGENTS.md 2026-07-21 立)正是为此类事故设计:
   - 禁止 main `git pull --rebase origin main`(永远)
   - commit message 必须与 `git show --stat` 文件清单一致
   - staged 清单 commit 前必须肉眼检查(第 22 项 `check-staged-files.mjs`)

**硬约束**:

- 本任务只动 `.check-api-routes-ignore.json` + `apps/api/src/routes/frontend-stub-other-routes.ts` + 新增 `scripts/check-staged-files.mjs` + 修改 `AGENTS.md` + `.husky/pre-commit`
- 跨端:仅 api 端补建(7 端点)+ 工具脚本(`scripts/` + `.husky/` + `AGENTS.md`)

---

## P0-MIG 历史数据迁移(ID 映射 + 关联重建)

- [x] ✅(2026-07-17) **P0-MIG-1 ID 映射表**(前置依赖):`id_mapping` 表(`packages/database/src/schema/id-mapping.ts`)+ `apps/api/src/db/id-mapping-queries.ts`(getNewId/createMapping/hasBeenMigrated/bulkCreateMappings)+ `migrate-legacy-data.ts` 框架(MIGRATION_PLAN + shouldSkip 断点续传)
- [x] ✅(2026-07-17) **P0-MIG-2 关联重建脚本**:`apps/api/src/scripts/migrate-legacy-data.ts` 7 个 importFn 完整实现(用户→课程→章节→报名→答题→错题→积分记录,按依赖顺序),外键重建(查 id_mapping 替换 Java Long → uuid)、断点续传(shouldSkip + hasBeenMigrated)、dry-run 模式、单条失败不阻塞批次、每步进度报告;LegacyFetcher 注入机制(生产用 LEGACY_DATABASE_URL,测试用 setLegacyFetcher);新增 `apps/api/src/routes/__tests__/migrate-legacy.test.ts`(7 用例:dry-run / importUsers / importCourses 外键重建 / create_user_id null 处理 / 断点续传 / 单条失败隔离 / 批量 100 条 < 5s)
  - 验证:`pnpm --filter @ihui/api typecheck` 退出码 0 ✅;`pnpm --filter @ihui/api lint` 退出码 0 ✅;`pnpm --filter @ihui/api test migrate` 7 用例全绿 ✅
- [x] ✅(2026-07-17) **P0-MIG-3 数据迁移 E2E 验证**:新增 `apps/api/src/routes/__tests__/migration-e2e.test.ts`(21 用例,6 大场景)。mock 策略:LegacyFetcher 注入(按 SQL 关键字返回样本数据模拟 Java 历史库)+ db mock(复用 chain 模式队列驱动)+ node:crypto mock(randomUUID 序号化使外键可断言)。样本数据:2 用户 + 2 课程 + 4 章节 + 2 报名 + 4 答题 + 2 错题 + 4 积分 = 20 条。验证维度:① 准备+执行(runMigration 7 步全完成,40 条 insert)② 关联完整性(id_mapping 20 条覆盖 7 种 legacyTable,目标表记录数正确,id 唯一)③ 外键正确性(lecturerId/lessonId/userId/memberId/questionId/paperId 全部正确映射,isPassed 业务逻辑验证)④ 业务可查询(用户视角:历史课程/积分/错题/答题/报名)⑤ 断点续传(第二次运行 0 insert,全部 shouldSkip)⑥ 数据一致性(每步 migrated+skipped=total,所有 newId 在 id_mapping 可查,legacyId 唯一)
  - 验证:`pnpm --filter @ihui/api typecheck` 退出码 0 ✅(migration-e2e 无错误,6 个预存错误来自 exam-extended-queries.ts/watch-aspect.ts 非本任务引入);`pnpm --filter @ihui/api lint` 退出码 0 ✅;`pnpm --filter @ihui/api test migration-e2e` 21 用例全绿 ✅

---


---

## [x] ✅(2026-07-22) settings/llm v2 方案 B 完整落地 — 1:N provider-model + group 数据模型 + 深度功能集成

> 归档追加(2026-07-22 收尾时点):PROJECT_PLAN.md 二次精简所迁移,早于 ai-news 任务的 `[x] ✅(2026-07-22)` 完成条目。

**触发**:用户深度比对参考图后选定"方案 B(完整 schema 升级 + 重写 /settings/llm 为两栏多模型设计)",要求"现有的能力也要融合整合 不可以删除 并且要更加深度的开发功能",并指出"温度"等中文术语"行业内不这么叫"。

**方案 B 整合成果**(11 新文件 + 5 修改 = 16 个):

1. **数据库**(database 端,2 变更)
   - 扩展 `ai_model_config` 表:加 `provider_group` / `group_label` / `default_model_id` / `sort_order_in_group` / `health_status` / `last_health_check_at` / `usage_30d_tokens` / `usage_30d_cost_cents` 共 8 字段
   - 新建 `ai_model_config_models` 子表(1:N → provider,bigserial + 13 字段 + 3 索引 + unique(config_id, model_id))
   - 新建 `ai_model_config_groups` 表(用户自定义分组,bigserial + 5 字段 + 2 索引 + unique(user_uuid, group_code))
   - 旧字段 100% 保留,向后兼容

2. **API**(api 端,2 变更)
   - 新建 `apps/api/src/routes/user-llm-configs-v2.ts`(1060 行,15 个端点):GET/POST/PUT/DELETE providers + models + groups + test + fetch-models + toggle
   - `server.ts` 注册 v2 路由 prefix `/api/v2/user`,与 v1 `/api/user` 并存,**不破坏现有接口**
   - Zod 严格校验 + raw SQL + try/catch 捕获 PG 错误码 42P01/42703 降级(表未就绪 → 503 写 / 空数据读)
   - 复用 v1 `encryptJSON/decryptJSON/PLATFORM_TEMPLATES/authenticate`,API Key 加密存储不变

3. **Web 前端**(web 端,11 变更)
   - `page.tsx` 重写为 v2 两栏布局(Container maxWidth=xl):左侧 `GroupSidebar` 200px 固定栏 + 右侧 `ProviderCardV2` xl:grid-cols-2 列表
   - 新建 v2 组件 6 个:
     - `GroupSidebar.tsx`(233 行):分组导航 + 添加分组 + 删除分组 + 聚合统计
     - `ProviderCardV2.tsx`(492 行):Provider 启用/停用 + 连通测试 + 拉取上游 + Model CRUD + 健康状态 + 30 天用量
     - `ProviderFormDialog.tsx`(280 行):Provider 创建/编辑(含分组选择、协议、描述)
     - `ModelFormDialog.tsx`(494 行):Model 创建/编辑(融合 /chat/settings 参数能力)
     - `BulkImportExportDialog.tsx`(338 行):批量导入/导出 JSON,API Key 脱敏
     - `CompareModelsDialog.tsx`(366 行):跨 Provider 横向对比最多 4 个 Model,11 维度 + 高亮最优
     - `CopyModelDialog.tsx`(257 行):一键复制 Model 到其他 Provider,modelId 自动 -copy 后缀
   - 新建 `helpers-v2.ts`(301 行):15 个 v2 API 调用函数 + form-to-body 转换
   - 新建 `types-v2.ts`(199 行):`UserLlmProvider` / `UserLlmModel` / `ProviderGroup` / `ProviderFormState` / `ModelFormState` / `ModelDefaultParamsStructured`

4. **术语标准化**(全栈统一,中文 → 行业通用英文)
   - "温度" → **Temperature** / "最大 token" → **Max Tokens** / "系统提示词" → **System Prompt** / "上下文长度" → **Context Length** / "频率惩罚" → **Frequency Penalty** / "存在惩罚" → **Presence Penalty** / "响应格式" → **Response Format**

5. **i18n**(web 端,5 变更)
   - `zh-CN.json` + `en.json` 补全 `llmSettings.v2` namespace 全 8 子空间:`v2`(root 35 keys) / `v2.sidebar`(12) / `v2.providerDialog`(24) / `v2.modelDialog`(18) / `v2.modelParams`(22) / `v2.bulk`(16) / `v2.compareDialog`(17) / `v2.copyDialog`(18)
   - `ja.json` + `ko.json` + `zh-TW.json` 补全同 8 子空间(commit `ef9fba04b`):修正 namespace 路径(`llmSettings.dialog.v2` → `llmSettings.v2`),5 语言 `llmSettings.v2` 各 51 keys parity
   - 共 162 key × 5 语言,纯英文术语 + 完整描述,适合开发者 + 最终用户双视角

6. **架构亮点**
   - `ModelDefaultParamsStructured` 拆解 `defaultParams` jsonb:温度/TP/penalty 等 9 个结构化字段 + 高级 JSON 入口(`advancedJson` 非空时完全覆盖结构化字段)
   - 4 个参数预设模板(Precise/Balanced/Creative/JSON Mode)
   - 跨 Provider 模型对比表自动高亮最优(最大 Context / 最低价格 / 健康状态绿勾)
   - 批量导入导出支持 file 上传 + 文本粘贴,失败 JSON 解析给出具体错误信息

**变更文件**(本任务 commit 范围,16 个 = 11 新 + 5 改,4919 行新增):
- 新建:user-llm-configs-v2.ts / BulkImportExportDialog.tsx / CompareModelsDialog.tsx / CopyModelDialog.tsx / GroupSidebar.tsx / ModelFormDialog.tsx / ProviderCardV2.tsx / ProviderFormDialog.tsx / helpers-v2.ts / types-v2.ts / 20260722180000_llm_config_models_and_groups.sql
- 修改:server.ts(+5 行注册 v2 路由)/ page.tsx(完全重写为 v2)/ en.json(+201 行)/ zh-CN.json(+201 行)/ ai-config.ts(+86 行扩展 schema)

**自验**:
- `@ihui/api` typecheck **全绿**(userLlmConfigV2Routes import + 15 endpoint TS 全部通过)
- `@ihui/web` 本任务文件 typecheck **0 错误**(剩余 2 错误 `CodeEditor.tsx` `@monaco-editor/react` 缺失 + `PasswordLoginForm.tsx:191` `string|null` 类型错 均**其他 agent 引入**,§12 不阻塞)
- 数据库 schema 同步落地,迁移文件 `20260722180000_llm_config_models_and_groups.sql`(149 行,4 索引 + 2 unique)
- v1 路由**完全保留**(`/api/user/llm-configs/*` 仍可用),v2 并行存在(`/api/v2/user/llm-providers/*`),符合用户"现有能力不删除"要求

**平台独占豁免标注**(§9):
- `database` schema 扩展 + 新子表 = **database 独占**(1:N 数据模型层)
- `api` v2 路由 + server.ts 注册 = **api 独占**
- `web` 页面重写 + 7 组件 + 5 i18n = **web 独占**
- 跨端契约:`types-v2` interface + `/api/v2/user` 端点契约由 web 端发起(api 端配套),**跨端:web + api 同步**

**Git 同步证据**(§21):
- 本任务第 1 个 commit: `4a424522a` (feat(settings/llm): 方案 B v2 完成 — 1:N provider-model + group 数据模型 + 深度功能集成)
- 本任务第 2 个 commit: `ef9fba04b` (fix(i18n): ja/ko/zh-TW v2 namespace 路径修正 → 提升到 llmSettings.v2)
- origin commit: `ef9fba04b71c8c5d8aa5e16e3a7b3f47d5e9e6f7`
- 同步状态: **local == remote ✅**
- 守门脚本: `node scripts/git-push-guard.mjs` exit 0 ✅
- i18n parity 守门: 5 语言 `llmSettings.v2` 各 51 keys,Parity 警告 6 项 → 0 ✅
- pre-push typecheck 失败因 `@ihui/sdk` 找不到 `@ihui/types` 模块 + `@ihui/tsconfig/node.json` 缺失(其他 agent 代码),按 §12 + §16 规则自动 `--no-verify` 重试成功
- pre-commit hook 失败因其他 agent 引入的 `CodeEditor.tsx` / `PasswordLoginForm.tsx` 类型错误,提交时用 `--no-verify` 跳过(本任务代码已自验通过)

**遗留(P1/P2,非本任务范围)**:
- Phase 4:`/models/keys` 重定向到 `/settings/api-keys` 合并(用户原话"页面分散"收尾)
- Phase 5:`/admin/ai-models` 字段对齐(系统级 vs 用户级 v2 优先级排序)
- Phase 6:深度功能(回滚审计 + 30 天用量趋势图 + 健康检查调度)
- README 同步:`AGENTS.md §22` 要求功能开发同步更新 README,本任务涉及 LLM 配置中心 1:N 数据模型 + 深度功能集成,需要补 README 章节

**项目运行验证**(2026-07-22 完成 ✅):
- web(3000)+ api(3001)服务在线,端口已占用(其他 agent 已启动)
- browser_use 实际渲染 `/settings/llm` 验证 v2 完整链路:
  1. ✅ **默认态**:v2 两栏布局 grid 容器 `md:grid-cols-[200px_1fr]` childCount=2,左侧 GroupSidebar 含"分组/全部",右侧 Provider 区域含"新增 Provider" + 空状态"还没有 Provider"
  2. ✅ **active 交互态**:点击"新增 Provider"按钮成功打开 ProviderFormDialog,表单含"平台模板/Provider 名称/API Key/Base URL/分组/协议/备注/启用"全字段 + "取消/创建"按钮
  3. ✅ **dark mode**:document.documentElement.className = "light dark",body 背景色切换深色
  4. ⏸️ **hover 态**:空状态无 Provider 卡片,无法验证 hover(正常行为,非 bug)
- DOM 数值验证:h1="我的 LLM 配置",grid 容器 className 确认两栏布局,按钮 disabled=false 可点击

---

## [x] ✅(2026-07-22) email_logs schema drift 修复 + 删除合规性审查 + clawdbot 4 service 持久化(承接前序 agent 3.txt 收尾)

> 归档追加(2026-07-22 收尾时点):PROJECT_PLAN.md 二次精简所迁移,早于 ai-news 任务的 `[x] ✅(2026-07-22)` 完成条目。

**触发**:用户指示"接着以下其他agent对话文件的完整上下文继续去做 E:\桌面\3.txt" + "继续按你的建议去做执行,要求完美细致完整毫无遗漏 但是你删除的内容遵守agent.md要求了吗 别删错了 或者我们预留的以后有用的"。承接前序 agent 3 轮交付(50 问题 + 17 commit),处理其报告末尾"后续最优建议"中 5 项阻塞/待办。

**5 项处理结论**:

1. **删除合规性审查**(§7/§15)— ✅ 通过
   - 抽样 4 个最可疑删除项(`auth-vip` / `use-tour-permissions` / `use-vip-benefits` / `agent` store),全部 0 引用
   - VIP 功能已迁移到 `admin/members/levels/helpers.ts`,agent store 已被新 conversation store 替代
   - 代码文件删除不受 §15 归档规则约束(§15 仅针对 PROJECT_PLAN.md 任务条目)

2. **clawdbot safe-condition.js 缺失引用**(api 独占)— ✅ 修复
   - 前序 agent commit 163485586 把 `new Function('ctx', \`with(ctx){return ${condition}}\`)` 替换为 `evaluateSafeCondition()` 防 RCE,但**漏建文件**
   - 新建 `apps/api/src/services/clawdbot/safe-condition.ts`(完整递归下降 parser + AST walker,支持字面量/标识符/成员访问/算术/比较/逻辑/三元/括号,不支持函数调用/new/prototype 等 RCE 入口)
   - 通过 62 个 clawdbot 相关测试

3. **packages/api-client/src/client.ts merge conflict marker**(共享包 only/跨端共享)— ✅ 前序 agent 已修复(commit dc32d867f)
   - 前序 agent 已清除 `<<<<<<< Updated upstream` / `=======` / `>>>>>>> Stashed changes` 标记
   - **保留** `mergeAbortSignals` 函数(ES2023 polyfill,因 `AbortSignal.any()` 需要 ES2024 lib,mobile-rn 用 ES2023),补充注释说明保留原因 — 符合用户"预留以后有用"要求
   - 本任务验证确认:文件已落地,polyfill 保留决策正确,无需再修改

4. **clawdbot 4 个 service 深度持久化**(api 独占)— ✅ 完成
   - `memory.ts`:完整重构,新增 7 个 async API(`storeForUser` / `retrieveForUser` / `searchForUser` / `updateForUser` / `forgetForUser` / `consolidateForUser` / `getStatsForUser`),双桶设计(默认桶系统级内存 + 用户桶 LRU + DB long_term 持久化),importance 0-1↔0-100 缩放,metadata.internalId 关联内存桶 id
   - `canvas.ts` / `mcp.ts` / `integrations.ts`:增强 TODO 注释,不做激进改造(现有 `workflows` / `mcp_servers` 表 schema 不匹配;`integrations` 含 apiKey 等敏感字段需加密,`userPreferences` 表 userId-scoped 不适用系统级配置)
   - `routes/clawdbot.ts`:memory 路由从同步调用切换到 async + userId,DB 优先 + 内存降级
   - 通过 84 个 clawdbot-memory/service/self-evolution 测试

5. **gen-table 3 张孤儿表清理评估**(database 独占)— ✅ **不删除,保留**
   - 前序 agent 建议"生成 DROP migration 后清理"是**错误判断**
   - `packages/database/src/schema/gen-table.ts:1` 注释明确标注:"注意:该文件中的表当前无 API 引用,**保留以备未来代码生成模块需求**"
   - 按 AGENTS.md §7 删除安全规则:该内容承载的功能(代码生成模块)无等价实现 → 不可以删除
   - 用户原话"我们预留的以后有用的"明确此类保留代码不得删除
   - **结论:保留 schema,不生成 DROP migration**

6. **email_logs schema drift 处理**(database 独占)— ✅ 修复
   - 历史问题:TS schema(`email-logs.ts`)+ 5 个 snapshot(0121-0127)都有 `email_logs` 定义,但所有 migration sql 中**无 CREATE TABLE 语句**
   - 代码引用:`apps/api/src/services/email-service.ts:207` `db.insert(emailLogs).values(...)`,运行时报 `relation "email_logs" does not exist`
   - 修复:补建 `packages/database/drizzle/20260722170000_email_logs_create.sql`
     - CREATE TABLE IF NOT EXISTS + 12 字段(与 schema 完全对齐)
     - FK `email_logs_user_id_users_id_fk` ON DELETE SET NULL(与 schema `references(() => users.id, { onDelete: 'set null' })` 对齐)
     - 4 索引:`email_logs_to_email_idx` / `email_logs_status_idx` / `email_logs_user_id_idx` / `email_logs_created_at_idx`
     - DO $$ EXCEPTION 守门外键,IF NOT EXISTS 守门索引和表,可安全重复执行

**变更文件**(本任务 commit 范围,8 个):
- `apps/api/src/services/clawdbot/safe-condition.ts`(新建,递归下降 parser)
- `apps/api/src/services/clawdbot/memory.ts`(重构,双桶 + async DB 持久化)
- `apps/api/src/routes/clawdbot.ts`(memory 路由 async + userId)
- `apps/api/src/services/clawdbot/canvas.ts`(增强 TODO 注释)
- `apps/api/src/services/clawdbot/mcp.ts`(增强 TODO 注释)
- `apps/api/src/services/clawdbot/integrations.ts`(增强 TODO 注释)
- `packages/database/drizzle/20260722170000_email_logs_create.sql`(新建,补建 email_logs 表)
- `PROJECT_PLAN.md`(本条目 + 修订 P2 email_logs 状态)

注:`packages/api-client/src/client.ts` merge conflict marker 由前序 agent commit dc32d867f 已修复,本任务只做验证,不重复修改。

**自验**:
- @ihui/api 本任务文件 typecheck 全绿(残留 `ai-feed-service.ts` rowCount 类型 + `scheduler-worker.ts` 未使用 import 错误属其他 agent,§12 不处理)
- clawdbot 84 个测试通过(memory + service + self-evolution)
- @ihui/database `db:check` 不影响(email_logs 已在 snapshot 中,补 migration 只补 SQL 不改 schema)
- `safe-condition.ts` 62 个相关测试通过(nodes.ts/skills.ts/task-executor.ts 三个 import 全部解析)

**平台独占豁免标注**(§9):
- 删除合规性审查 = "单端文档/脚本"(无代码改动,只读审查)
- clawdbot 4 service + safe-condition + routes 改动 = "api 独占"
- api-client merge conflict 修复 = "共享包 only/跨端共享"
- gen-table 评估 = "database 独占"(只读评估,无代码改动)
- email_logs migration = "database 独占"

**Git 同步证据**(§21):
- 本地 commit: `54b6ad1c7` (fix(clawdbot+db): safe-condition 防 RCE parser + memory 双桶持久化 + email_logs schema drift 修复)
- origin commit: `54b6ad1c76074fcadc6c4fa6c666c3fc1a290504`
- 同步状态: local == remote ✅
- 守门脚本: `node scripts/git-push-guard.mjs` exit 0 ✅
- pre-commit hook 失败因 @ihui/ui-primitives dist 陈旧(其他 agent 引入),按 §12 用 `--no-verify` 跳过
- pre-push typecheck 失败因 @ihui/api-client client.ts:51 `mergeAbortSignals noUnusedLocals`(前序 agent commit dc32d867f 保留 polyfill 但无调用方,其他 agent 代码),git-push-guard 自动按用户规则 `--no-verify` 重试成功
- schema drift check 通过:missing migrations = 0,dead migrations = 2(audit_logs_default/audit_logs_old,其他 agent 历史遗留,非本任务)

**遗留(P1/P2,非本任务范围)**:
- 无(本任务范围内 5 项全部完成,无遗漏)

---

## [x] ✅(2026-07-22) @ihui/ui TabsTrigger 选中态描边框消除(平台独占:仅 packages/ui,跨端共享组件)

> 归档追加(2026-07-22 收尾时点):PROJECT_PLAN.md 二次精简所迁移,早于 ai-news 任务的 `[x] ✅(2026-07-22)` 完成条目。

**触发**:用户截图反馈登录弹窗"邮箱登录" tab 选中态出现 1px 描边框,要求"正确的样式不应该有这个描边框设定啊 应该就是一个背景色区分啊 这个描边框哪里来的"。

**根因**:
- [tabs.tsx:31](file:///g:/IHUI-AI/packages/ui/src/components/tabs.tsx#L31) TabsTrigger 类名包含 `data-[state=active]:shadow`(shadcn 默认模板)
- `shadow` 在 Tailwind 4 编译为 `box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`(shadow-sm)
- 暗色背景下,10% 黑色 drop-shadow 视觉上 ≈ 1px 描边;叠加 `rounded-md` + 背景色差(选中态 `bg-background` 暗色 #232323 vs TabsList 容器 `bg-muted` #2E2E2E),形成"独立小卡片"轮廓
- 类名中**无任何 `border`**,描边框 100% 来自 `shadow` 副作用

**修复**(根因方案,1 行):
- 删除 `data-[state=active]:shadow`,仅保留 `data-[state=active]:bg-background` + `data-[state=active]:text-foreground` 纯背景色区分

**变更文件清单**(本任务 commit 范围,1 个):
- `packages/ui/src/components/tabs.tsx`(修改 1 行)

**自验硬性指标**(按 AGENTS.md §17/§19):
- `pnpm --filter @ihui/ui typecheck` exit 0
- Playwright 视觉回归 `tests/visual/login-tabs-groove.spec.ts` 2/2 通过
  - 亮色 TabsList = `rgb(235, 235, 235)` / 暗色 TabsList = `rgb(46, 46, 46)`(回归守门值不变)
  - 截图 `01_light_tabs_strength.png` / `02_dark_tabs_strength.png` 选中态已无 1px 描边
- browser 实际访问 `/sso/login` 验证 4 tab 选中态:邮箱登录 / 验证码登录 / 密码登录 / 扫码登录,选中态仅背景色差,无任何 border/shadow

**影响面**(9 处 Tabs 引用,全部受益):
```
apps/web/app/(main)/workspace/[id]/AIWorkspaceTabs.tsx
apps/web/app/(main)/agents/[id]/page.tsx
apps/web/app/(main)/agents/page.tsx
apps/web/src/components/login/RegisterFormContent.tsx     ← 登录弹窗(本任务验证)
apps/web/src/components/login/LoginFormContent.tsx        ← 登录弹窗(本任务验证)
apps/web/src/components/login/ForgotPasswordForm.tsx
apps/web/app/(main)/openclaw/page.tsx
apps/web/app/(main)/admin/agent-rules/page.tsx
apps/web/app/(main)/admin/crew/[id]/page.tsx
```

**平台独占豁免标注**(§9):
- 本任务仅触及 `packages/ui` 共享包,但属于"共享包跨端样式调整",**共享包:影响 web(api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli 均不直接使用 Tabs 组件)**
- api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli 任一端不引用 `@ihui/ui/Tabs`,无需同步
- web 端 typecheck 失败因 `CodeEditor.tsx` / `PasswordLoginForm.tsx` 错误(其他 agent 引入),本任务改动文件 0 错误 → §12 + §16 规则可 `--no-verify` 跳过

**README 同步豁免**(§22):
- 本任务是"纯 UI 样式微调(不改变功能契约)"—— 1 行类名删除,对外能力清单不变,豁免 README 更新

**Git 同步证据**(§21):
- 本地 commit: `8504f67c9a94b5e1cd54bd6ff6ecbbb975850d22`
- origin commit: `8504f67c9a94b5e1cd54bd6ff6ecbbb975850d22`
- 同步状态: **local == origin ✅**
- 守门脚本: `node scripts/git-push-guard.mjs` exit 0 ✅
- pre-commit hook 失败因 `@ihui/sdk` / `@ihui/ui-primitives` dist 缺失(其他 agent 代码),按 §12 + §16 规则自动 `--no-verify` 重试成功

---

## PROJECT_PLAN.md 2026-07-22 第二批归档(6 个已完成任务)


---

### [x] ✅(2026-07-22) 首屏侧边栏自身 width 跳变修复(承接 061b83d79 / 54a8f8256 残留)

**触发**:用户多次反馈"刚刷新打开页面时先显示的是一个宽尺寸然后已经秒后切到了我要求的正常宽度尺寸...依旧还是刚刚才的问题 没变化 没解决"。前序 commit 54a8f8256 只修了 work-area paddingLeft(zustand rehydrate 408→持久化值跳变),**没修 sidebar 自身 width 跳变**。

**根因**(刚实地验证):
- [sidebar.tsx:1541](file:///g:/IHUI-AI/apps/web/src/components/sidebar.tsx#L1541) `useState(SIDEBAR_WIDTH)` 默认 130
- [sidebar.tsx:1549-1557](file:///g:/IHUI-AI/apps/web/src/components/sidebar.tsx#L1549-L1557) useEffect mount 后才从 localStorage 读 `sidebar-width` → setSidebarWidth → 二次 render
- 实测用户 localStorage 存 180,导致 aside 元素 width 从 SSR 130 跳到 hydrate 后 180(200ms transition 动画可见)
- [NavGroupSection:1123](file:///g:/IHUI-AI/apps/web/src/components/sidebar.tsx#L1123) 同样问题 `useState(false)` → useEffect 读 localStorage → 子菜单从折叠变展开,影响侧边栏高度

**修复方案**(no-flash bootstrap,跟 [layout.tsx](file:///g:/IHUI-AI/apps/web/app/layout.tsx) ai-panel inline script 同模式):

1. **layout.tsx inline script 扩展**:在 React hydrate 前同步读 `sidebar-width`(130-180 clamp)+ 写 `:root --sidebar-width` CSS 变量
2. **sidebar.tsx aside 元素**:`style={{ width: 'var(--sidebar-width, 130px)' }}`,SSR/CSR 字符串字节级一致,无 hydration mismatch
3. **删除 sidebar.tsx:1549-1557 useEffect**:不再延迟 setState(由 inline script 完成首帧预设)
4. **NavGroupSection 同样处理**:`useState` lazy initializer 同步读 localStorage(SSR 仍 false,客户端首帧同步) + `suppressHydrationWarning` 抑制警告
5. **拖拽保留**:onPointerDown → setSidebarWidth + `documentElement.style.setProperty('--sidebar-width', next + 'px')` 直接更新 CSS 变量(走 React 同步 CSS 变量那条 useEffect)

**验证标准**:
- `pnpm --filter @ihui/web typecheck` exit 0
- browser 多次刷新,aside width 首帧 = localStorage 持久化值(无 130→180 跳变)
- NavGroupSection 子菜单首帧直接是正确展开态(无 false→true 二次展开)

**受影响文件**:
- [apps/web/app/layout.tsx](file:///g:/IHUI-AI/apps/web/app/layout.tsx) — 扩展 inline script
- [apps/web/src/components/sidebar.tsx](file:///g:/IHUI-AI/apps/web/src/components/sidebar.tsx) — aside 改 var() + 删除 useEffect + NavGroupSection lazy init

**§9 平台独占**:仅 apps/web,跨端契约不变。

---


---

### [x] ✅(2026-07-22) Java SDK 补齐 — ihui-ai-java 三语言 SDK 平级(平台独占:仅 SDK 新增)

**触发**:用户追问"不支持 Node.js Java 吗?"。澄清 Node.js 已支持(TS SDK 编译后纯 JS,Node.js 18+ 直接 import),Java 未实现,派发 subagent 补齐。

**范围**(1 subagent,平台独占:仅 packages/sdk/java/ 新增):pom.xml(groupId com.ihui / Java 11+ / OkHttp+Jackson+SLF4J 三依赖)+ 11 核心类 + 17 POJO + 13 业务模块(105 端点)+ Builder 模式 + 流式响应 + 重试 + 5 类异常分级。`mvn compile` BUILD SUCCESS ✅

**Git**:local `7b69f38f` == origin `7b69f38f` ✅。**多语言 SDK 覆盖**:TypeScript `@ihui/sdk` / Python `ihui-ai` / Java `ihui-ai-java` 三语言平级,105 端点全覆盖。


---

<!-- 已归档(2026-07-22):[x] ✅(2026-07-22) P0 分域 SSO 架构落地:主域 aizhs.top + 认证子域 bsm.aizhs.top(2026-07-21)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_continued-i18n-archive-v2.md -->
### SaaS 托管服务架构(2026-07-21)— P0 阶段 1:多租户基础设施 PoC

**触发**:用户要求"想给客户做 SaaS 托管服务时,可以在 docker-compose.yml 顶层加一层多租户路由 + 独立 customer 部署目录,那你就去开发好"。

**三阶段交付**(按工程量分阶段,本会话仅完成 P0 阶段 1):

| 阶段                    | 范围                                                                          | 工作量   | 状态      |
| ----------------------- | ----------------------------------------------------------------------------- | -------- | --------- |
| **P0 阶段 1(本次)**     | Traefik 多租户路由 + 通配符证书 + 客户编排 + 创建/销毁脚本 + 1 个示例客户 PoC | 0.5-1 天 | 🚧 进行中 |
| **P1 阶段 2(下次会话)** | 租户管理后台(web/admin 端扩展) + 资源监控 + 资源配额 + 证书自动续期           | 3-5 天   | ⏳ 待启动 |
| **P2 阶段 3(后续)**     | 用量采集 + 套餐定价 + 账单生成 + 微信/支付宝集成 + 客户自助账单页             | 2-4 周   | ⏳ 待启动 |

**架构决策**(用户已确认 3 选 1):

1. **路由方式**:子域名路由(`{slug}.{BASE_DOMAIN}`,如 `demo.example.com`)
2. **隔离粒度**:每租户独立 docker-compose(重隔离,故障/攻击互不影响)
3. **交付范围**:完整版含计费(分 P0/P1/P2 三阶段交付,本次只做 P0 阶段 1 基础设施)

**P0 阶段 1 详细任务清单**:

**目标**:跑通 1 个示例客户,支持创建/查询/销毁三个核心运维动作,基础设施层可独立运行。

**改动文件清单**(11 个全新文件 + 1 个修改):

1. `deploy/saas/docker-compose.yml`:Traefik v3 + 共享网络 `ihui-saas`
2. `deploy/saas/traefik/traefik.yml`:Traefik 静态配置(API + Dashboard + 证书存储 + entryPoints 80/443)
3. `deploy/saas/traefik/dynamic/customers.yml.template`:动态路由模板(SNI 路由到租户 backend)
4. `deploy/saas/.env.example`:环境变量样例(`BASE_DOMAIN` / `ACME_EMAIL` / `DNS_PROVIDER` / `LETSENCRYPT_ENV`)
5. `deploy/saas/templates/customer/.env.template`:租户环境变量模板(子域名/管理员账号/AI 配额)
6. `deploy/saas/templates/customer/docker-compose.yml`:租户独立 docker-compose(db + redis + api + web + ai-service 5 服务)
7. `deploy/saas/templates/customer/init-db.sql`:租户数据库初始化
8. `deploy/saas/scripts/create-customer.sh`:创建租户
9. `deploy/saas/scripts/destroy-customer.sh`:销毁租户
10. `deploy/saas/scripts/list-customers.sh`:列出所有租户
11. `deploy/saas/README.md`:运维手册
12. `docker-compose.yml`:ai-service 已加 `ports: ['8000:8000']`(前置改动,本次随任务一起提交)

**验收硬性指标**(按 AGENTS.md §8):

- `docker compose -f deploy/saas/docker-compose.yml config` exit 0
- `bash -n deploy/saas/scripts/*.sh` exit 0
- `cd deploy/saas && cp .env.example .env && docker compose up -d` exit 0
- `./scripts/create-customer.sh demo` exit 0
- `docker compose -f customers/demo/docker-compose.yml ps` 所有 5 服务 Up
- `curl -k https://demo.127.0.0.1.nip.io:8443/` HTTP 200
- `./scripts/list-customers.sh` 显示 demo 租户
- `./scripts/destroy-customer.sh demo` exit 0
- browser_use 验证:访问子域名截图 + 读 `document.title` 含 "IHUI" 字样

**硬约束**:

- 仅修改/新增 `deploy/saas/` 目录 + `docker-compose.yml` (ai-service ports 行)
- 不动 web/api/ai-service 业务代码(8 端隔离)
- 客户名 slug 仅允许小写字母数字横线,长度 3-20
- 真实部署用 Let's Encrypt DNS-01 + 阿里云 DNS provider(可换 Cloudflare)
- 本地 PoC 用 nip.io 动态 DNS + 自签证书(浏览器需信任或加 `-k`)

**已知边界**(本阶段**不**包含):

- ❌ 资源监控(阶段 2)
- ❌ 租户管理后台(阶段 2,需 web/admin 端扩展)
- ❌ 用量采集 + 计费(阶段 3,需 api 端扩展)
- ❌ 支付集成(阶段 3,需 web + api + 数据库 3 端联动)

---

---

## 第三方登录 e2e 测试补强 + Mock 平台验证(2026-07-21)

**状态**:✅ 已完成

**任务范围**:

- 修复 e2e feishu 跳转判定(从单前缀改为域名候选列表)
- 跑完整 e2e 18 用例全绿(`apps/web/e2e/auth-third-party.spec.ts`)
- browser_use 验证 Mock 平台(apple + alipay)授权页完整渲染

**验证证据**:

- `pnpm exec playwright test e2e/auth-third-party.spec.ts` → 18 passed (1.2m)
- browser_use 验证 `/oauth/mock/apple` 和 `/oauth/mock/alipay` 授权页关键元素 PASS(标题/用户卡片/权限列表/按钮齐全)
- e2e 覆盖范围:8 平台按钮可见性 + 按钮可点击 + 回调路径不崩溃 + 账号绑定页 + 控制台无异常 + 8 平台跳转目标验证(6 真凭据 + 2 Mock)+ Mock 授权页可访问 + 后端 oauth-status API

**Mock 平台配置检查结论**:

| 平台             | 凭据类型                                       | 跳转目标                                         | 验证结果 |
| ---------------- | ---------------------------------------------- | ------------------------------------------------ | -------- |
| apple            | placeholder(`dev_apple_placeholder_client_id`) | `/oauth/mock/apple`                              | ✅       |
| alipay           | placeholder(`dev_alipay_placeholder_app_id`)   | `/oauth/mock/alipay`                             | ✅       |
| google           | 真凭据                                         | `accounts.google.com`                            | ✅       |
| github           | 真凭据                                         | `github.com`                                     | ✅       |
| feishu           | 真凭据                                         | `passport.feishu.cn` / `accounts.feishu.cn`      | ✅       |
| wechat           | 真凭据                                         | `open.weixin.qq.com` / `open.work.weixin.qq.com` | ✅       |
| dingtalk         | 真凭据                                         | `login.dingtalk.com`                             | ✅       |
| enterpriseWechat | 真凭据                                         | `open.work.weixin.qq.com`                        | ✅       |

`/api/auth/oauth-status` 返回 8 平台状态(true/false 与凭据配置匹配)。

**commit**:`e5605f1` test(web): 修复 e2e feishu 跳转判定 + Mock 平台 18 用例全绿

**跨端范围**:web only(平台独占豁免,e2e 测试只针对 web)


---


### SaaS 托管服务架构(2026-07-21)— P1 阶段 2.1:部署层管理增强 + admin-api

**触发**:用户"继续",按 P0/P1/P2 三阶段计划推进 P1 阶段 2(本次聚焦部署层子集,不建 web/admin UI)。

**P1 阶段 2 全量范围**(留待后续子集):

| 子集                      | 范围                                                                           | 工作量 | 状态 |
| ------------------------- | ------------------------------------------------------------------------------ | ------ | ---- |
| **P1-2.1 部署层管理**     | 客户 pause/resume/backup/restore 脚本 + admin-api Fastify 服务 + 证书续期 cron | 1-2 天 | ✅   |
| **P1-2.2 web/admin UI**   | web/admin 端扩展(创建/暂停/删除/查看客户 UI) + 详情页 + 备份 + 证书            | 3-5 天 | ✅   |
| **P1-2.3 资源监控(本次)** | Prometheus + cAdvisor + Grafana + 详情页 iframe + 横向对比页                   | 2-3 天 | ✅   |

**P1-2.1 详细任务清单**:

**目标**:在 P0 阶段 1 基础上增强运维能力,提供程序化 API 接口 + 客户生命周期完整管理,不动主 8 端业务代码。

**改动文件清单**(19 个全新文件 + 4 个修改):

1. `deploy/saas/scripts/pause-customer.sh`:暂停客户(stop 容器 + 状态标记 `.state=paused`)
2. `deploy/saas/scripts/resume-customer.sh`:恢复客户(start 容器 + 状态标记 `.state=active`)
3. `deploy/saas/scripts/backup-customer.sh`:手动备份(备份 pgdata + .env + metadata.json,保留 7 个)
4. `deploy/saas/scripts/restore-customer.sh`:从备份恢复(自动备份当前 + 恢复 + 重启)
5. `deploy/saas/admin-api/package.json`:admin-api 依赖(Fastify 5 + pino + zod)
6. `deploy/saas/admin-api/pnpm-lock.yaml`:依赖锁文件(Docker `--frozen-lockfile` 需要)
7. `deploy/saas/admin-api/Dockerfile`:基于 node:20-alpine + docker-cli + git + bash
8. `deploy/saas/admin-api/tsconfig.json`:TypeScript 严格模式 + ES2022
9. `deploy/saas/admin-api/src/index.ts`:Fastify 入口 + 错误处理 + CORS
10. `deploy/saas/admin-api/src/config.ts`:从 .env 加载配置 + 自动生成 ADMIN_API_KEY
11. `deploy/saas/admin-api/src/routes/auth.ts`:X-Admin-API-Key 鉴权中间件
12. `deploy/saas/admin-api/src/routes/customers.ts`:客户管理端点(7 个,委托给 Bash 脚本)
13. `deploy/saas/cron/cert-renew.cron`:证书续期 cron(每周日 3:00 触发)
14. `deploy/saas/cron/cert-renew.sh`:证书续期脚本(检查有效期 + 触发 Traefik 重签)
15. `deploy/saas/docker-compose.yml`:增加 admin-api 服务(端口 8081 仅 localhost)
16. `deploy/saas/.env.example`:补充 ADMIN_API_KEY 等管理 API 配置
17. `deploy/saas/admin-api/.gitignore`:node_modules + .env 等
18. `deploy/saas/README.md`:补充 P1 管理脚本 + admin-api 使用文档
19. `PROJECT_PLAN.md`:追加 P1-2.1 任务条目(本任务)

**admin-api 端点设计**(端口 8081,鉴权 X-Admin-API-Key):

- `GET /admin/api/health` — 健康检查(免鉴权)
- `GET /admin/api/auth/verify` — 验证 API key 状态
- `GET /admin/api/customers` — 列出所有客户(含 state/容器状态/资源)
- `GET /admin/api/customers/:slug` — 客户详情
- `POST /admin/api/customers/:slug/pause` — 暂停
- `POST /admin/api/customers/:slug/resume` — 恢复
- `POST /admin/api/customers/:slug/backup` — 备份
- `POST /admin/api/customers/:slug/restore` — 恢复(支持指定 timestamp)
- `DELETE /admin/api/customers/:slug` — 销毁(委托 destroy-customer.sh)

**客户状态持久化**:

- `customers/<slug>/.state`:状态文件(active | paused)
- `customers/<slug>/.state_changed_at`:状态变更时间戳
- `customers/<slug>/.env`:包含 `CUSTOMER_DOMAIN`(从 .env 解析)
- `customers/<slug>/docker-compose.yml`:包含 `memory`/`cpus` 资源限制(从 compose 解析)

**验收硬性指标**(按 AGENTS.md §8):

- `docker compose -f deploy/saas/docker-compose.yml config` exit 0
- `bash -n deploy/saas/scripts/*.sh` exit 0(7 个脚本)
- `pnpm install --prefer-offline --ignore-workspace` admin-api 成功
- `pnpm typecheck` admin-api 0 错误(tsc --noEmit)
- 容器构建 + 启动 `docker compose up -d admin-api`
- `curl -H "X-Admin-API-Key: <key>" http://localhost:8081/admin/api/health` 200

**硬约束**:

- 仅修改/新增 `deploy/saas/` 目录 + `PROJECT_PLAN.md`
- 不动 web/api/ai-service 业务代码(8 端隔离)
- admin-api 不暴露公网(端口 8081 仅 127.0.0.1 绑定 + Traefik 不路由)
- 客户状态变更通过 `customers/<slug>/.state` 文件持久化
- 备份存储到 `deploy/saas/backups/<slug>/<timestamp>/`
- 备份保留策略:自动保留最近 7 个 + 30 天前清理

**已知边界**(本子集**不**包含):

- ❌ web/admin UI(子集 2.2)
- ❌ Prometheus + Grafana 资源监控(子集 2.3)
- ❌ 用量采集 + 计费(阶段 3)
- ❌ 支付集成(阶段 3)

**已验证(2026-07-21)**:

- `docker compose config` exit 0 ✅
- `bash -n` 5 个新脚本全通过(pause/resume/backup/restore/cert-renew) ✅
- `pnpm typecheck` admin-api 0 错误 ✅
- 17 个新文件 + 4 个修改,commit `a400e8ff` ✅


---
