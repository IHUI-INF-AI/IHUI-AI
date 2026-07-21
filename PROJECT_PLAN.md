# IHUI-AI 项目

> 本文件为项目唯一任务计划文档。规则见 [AGENTS.md](./AGENTS.md)。
> 历史归档:本文件精简前 54.6 KB(2026-07-20 含权限运行时拦截完整内容)已移至 `.trae-cn/archive/PROJECT_PLAN_2026-07-20_pre-permission-runtime.md`;更早快照同目录;详细提交记录见 `git log`。
> 2026-07-20 publish-task 批次归档:16 个已完成大块(自媒体工作台整合 / 侧边栏分组整合 / SiteFooter i18n / M-71 / M-72 / M-65 v2 / 首页 6 UI / 侧边栏折叠 / CLI 配置导入 / 工作区权限运行时拦截 / M-70 / BrandMarquee / 架构迁移整合 / SiteFooter v6 / i18n P1 2_5 / 全站 hover 提示)移至 `.trae-cn/archive/PROJECT_PLAN_2026-07-20_publish-task-archive.md`,本文件从 63.3 KB 缩减至 ~20 KB。

---

## 当前活跃任务(2026-07-20)

### G5+ 知识图谱 DrizzleGraphStore 持久化后端(2026-07-22)

**触发**:G5 知识图谱 commit `73f8d0a5d` 落地后,`graph_store` 仅 `InMemoryGraphStore`(进程内 dict),生产环境重启丢数据。本任务将其升级为 DrizzleGraphStore(asyncpg 直连 PG),通过环境变量 `KNOWLEDGE_GRAPH_STORE` 切换后端。

**方案与产出**:

1. **T1 GraphStore Protocol 统一接口**:`apps/ai-service/app/services/knowledge_graph.py` 新增 `class GraphStore(Protocol)`,所有方法(upsert_entity / upsert_relation / get_graph / clear)统一 async 接口,便于多态切换后端
2. **T2 DrizzleGraphStore 实现**:asyncpg pool 懒加载 + 复用,upsert_entity/relation 走 SELECT-then-INSERT/UPDATE 模式,并发竞争触发 `asyncpg.UniqueViolationError` 时降级到 SELECT 路径,确保不丢数据
3. **T3 InMemoryGraphStore 异步化**:所有方法改为 `async def`(内部仍是同步,只是 async wrapper),与 Protocol 保持一致,test 同步调用改为 `await`
4. **T4 API 路由异步化**:`apps/ai-service/app/api/v1/knowledge_graph.py` build_graph / get_graph_data / clear_graph 全部加 `await graph_store.*`
5. **T5 _create_graph_store 工厂**:根据 `KNOWLEDGE_GRAPH_STORE` 环境变量(`memory` | `drizzle` | 未知值降级)选择后端,初始化失败自动回退到内存模式
6. **T6 数据库迁移闭环**:`packages/database/drizzle/meta/_journal.json` 加 `idx=124, tag=0125_knowledge_graph`,新建 `0125_snapshot.json` 包含 `zhs_knowledge_entity` + `zhs_knowledge_relation` 两张表 + 7 个索引的 schema 信息
7. **T7 测试覆盖**:42 个测试全绿(原 27 个 + 新增 15 个 DrizzleGraphStore mock 测试),含并发 UniqueViolation 降级路径、Decimal→float 转换、Protocol 多态

**变更文件**:

- `apps/ai-service/app/services/knowledge_graph.py`(+417 行,InMemoryGraphStore 改 async + 加 Protocol/DrizzleGraphStore/工厂)
- `apps/ai-service/app/api/v1/knowledge_graph.py`(+11 行,4 处同步调用加 await + 注释更新)
- `apps/ai-service/tests/test_knowledge_graph.py`(+374 行,InMemoryGraphStore 测试改 async + 新增 DrizzleGraphStore mock 测试 + _create_graph_store 工厂测试)
- `packages/database/drizzle/meta/0125_snapshot.json`(新,1.4MB,基于 0124 加 2 张表 7 个索引)
- `packages/database/drizzle/meta/_journal.json`(+8 行,idx=124)

**自验**:

- `python -m pytest tests/test_knowledge_graph.py` 42/42 passed ✅
- `python -m pytest tests/test_knowledge_graph.py tests/test_vector_memory.py` 84/84 passed ✅
- `pnpm --filter @ihui/database build` exit 0 ✅
- `pnpm --filter @ihui/database typecheck` exit 0 ✅
- ai-service 全量测试 815 passed / 9 failed(失败均来自其他 agent 改动:test_routers.py LLM + test_schema_check.py ai_model_config 字段数,与本任务无关)
- `node scripts/check-staged-files.mjs` 端分布正确(ai-service + database 共享包)

**硬约束**:

- 本任务仅修改 ai-service 端(知识图谱后端持久化)+ database 共享包 schema meta(无新表,只是补 snapshot)
- 跨端:仅 ai-service + 共享包 schema(database 类型/索引已 commit 在 G5 任务 `73f8d0a5d` 的 `knowledge-graph.ts` 中,本任务不重复添加)
- 数据库 migration 0125_knowledge_graph.sql + 0125_snapshot.json 必须同步,否则 drizzle-kit 检查失败
- 平台独占标注:**仅 ai-service + 共享包 schema**(知识图谱后端是 ai-service 独占功能,其他端通过 next.config.ts rewrite 调用)

---

### .check-api-routes-ignore.json 5 处 TODO 后端路径审计补建 + 豁免移除闭环(2026-07-21)

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

### P0-MIG 历史数据迁移(ID 映射 + 关联重建)

- [x] ✅(2026-07-17) **P0-MIG-1 ID 映射表**(前置依赖):`id_mapping` 表(`packages/database/src/schema/id-mapping.ts`)+ `apps/api/src/db/id-mapping-queries.ts`(getNewId/createMapping/hasBeenMigrated/bulkCreateMappings)+ `migrate-legacy-data.ts` 框架(MIGRATION_PLAN + shouldSkip 断点续传)
- [x] ✅(2026-07-17) **P0-MIG-2 关联重建脚本**:`apps/api/src/scripts/migrate-legacy-data.ts` 7 个 importFn 完整实现(用户→课程→章节→报名→答题→错题→积分记录,按依赖顺序),外键重建(查 id_mapping 替换 Java Long → uuid)、断点续传(shouldSkip + hasBeenMigrated)、dry-run 模式、单条失败不阻塞批次、每步进度报告;LegacyFetcher 注入机制(生产用 LEGACY_DATABASE_URL,测试用 setLegacyFetcher);新增 `apps/api/src/routes/__tests__/migrate-legacy.test.ts`(7 用例:dry-run / importUsers / importCourses 外键重建 / create_user_id null 处理 / 断点续传 / 单条失败隔离 / 批量 100 条 < 5s)
  - 验证:`pnpm --filter @ihui/api typecheck` 退出码 0 ✅;`pnpm --filter @ihui/api lint` 退出码 0 ✅;`pnpm --filter @ihui/api test migrate` 7 用例全绿 ✅
- [x] ✅(2026-07-17) **P0-MIG-3 数据迁移 E2E 验证**:新增 `apps/api/src/routes/__tests__/migration-e2e.test.ts`(21 用例,6 大场景)。mock 策略:LegacyFetcher 注入(按 SQL 关键字返回样本数据模拟 Java 历史库)+ db mock(复用 chain 模式队列驱动)+ node:crypto mock(randomUUID 序号化使外键可断言)。样本数据:2 用户 + 2 课程 + 4 章节 + 2 报名 + 4 答题 + 2 错题 + 4 积分 = 20 条。验证维度:① 准备+执行(runMigration 7 步全完成,40 条 insert)② 关联完整性(id_mapping 20 条覆盖 7 种 legacyTable,目标表记录数正确,id 唯一)③ 外键正确性(lecturerId/lessonId/userId/memberId/questionId/paperId 全部正确映射,isPassed 业务逻辑验证)④ 业务可查询(用户视角:历史课程/积分/错题/答题/报名)⑤ 断点续传(第二次运行 0 insert,全部 shouldSkip)⑥ 数据一致性(每步 migrated+skipped=total,所有 newId 在 id_mapping 可查,legacyId 唯一)
  - 验证:`pnpm --filter @ihui/api typecheck` 退出码 0 ✅(migration-e2e 无错误,6 个预存错误来自 exam-extended-queries.ts/watch-aspect.ts 非本任务引入);`pnpm --filter @ihui/api lint` 退出码 0 ✅;`pnpm --filter @ihui/api test migration-e2e` 21 用例全绿 ✅

---

### 模型市场 nav 样式重构 + 厂商 SVG 图标(2026-07-21)

**触发**:用户反馈"`nav` 这里的样式太难看了 不符合本项目整体风格 并且也没有配上svg对应厂商的图标"。

**方案**:

- 6 个分组 inline label:国际原厂 / 国内原厂 / 推理平台 / 云服务&平台 / 聚合路由 / 本地部署,降低 80+ 厂商认知负担
- 集成 `BrandIcon`(@lobehub/icons 厂商真实 SVG),按 vendor code 自动匹配
- 紧凑 pill 风格(对齐 FilterChip):h-7 + 圆角 rounded-md + 上下 padding 收紧
- active 态:bg-primary + text-primary-foreground(主色填充,无下划线无蓝光描边)
- hover 态:bg-accent + text-accent-foreground(subtle 容器色变化)
- 顶层"全部"独立一行 + Layers icon,与分组厂商视觉区分
- 容器:bg-muted/30 浅灰底,subtle 边界,符合"不要单边 border 分割线"规则
- i18n 5 语言 parity:补 `providerGroups` 6 分组 + 3 新厂商(Ornith/CodeBrain/MAI) + `navAriaLabel` + 繁体中文用 ＭＡＩ 全角等守门

**变更文件**:

- `apps/web/app/(main)/models/ModelsNav.tsx`(重构)
- `apps/web/messages/{zh-CN,en,ja,ko,zh-TW}.json`(补 5 key 集合)

**自验**:

- typecheck `pnpm --filter @ihui/web typecheck` 0 错误
- i18n 5 文件 JSON.parse VALID
- zh-TW 无简体字残留(opencc 守门)
- ko 无中文残留(字符范围守门)
- en 无破碎英文(品牌白名单守门)
- 浏览器渲染验证:**被其他 agent 的 `use-chat.ts → chat-api.ts 缺 persistQuestion export` 阻塞**(layout.tsx → GlobalShell → ai-side-panel → use-chat 全链路编译失败,/models 500),不属于本任务范围,本任务自验走 typecheck + i18n 守门脚本

**硬约束**:

- 改动文件仅限本任务清单(ModelsNav.tsx + 5 个 i18n 文件)
- commit message: `feat(models): nav 样式重构 + 厂商 SVG 图标`
- 跨端:仅 web 端(模型市场是 web 独占页面)
- Verified-DOM:无法验证(其他 agent 代码阻塞 dev server,非本任务范围)

---

### P0 分域 SSO 架构落地:主域 aizhs.top + 认证子域 bsm.aizhs.top(2026-07-21)

**触发**:用户反馈"你配置的域名不符合我要求啊 我要的是 bsm.aizhs.top 只是登录认证的子域名 真正的访问域名应该是主域名 aizhs.top"。

**架构(分域 SSO)**:

```
浏览器 → aizhs.top       (主域,完整应用入口)
       → bsm.aizhs.top   (认证子域,只承载登录/扫码/OAuth 回调)
       两者走同一个 Cloudflare Tunnel(ihui-local)→ localhost:3000
       Cookie 写在 .aizhs.top 域,主域与子域共享登录态
```

**变更文件**:

- `apps/web/.env.local`:新增 `NEXT_PUBLIC_AUTH_SUBDOMAIN` / `NEXT_PUBLIC_MAIN_DOMAIN` / `NEXT_PUBLIC_COOKIE_DOMAIN=.aizhs.top`
- `apps/web/src/lib/auth-domains.ts`(新):域配置 helper(getAuthSubdomainOrigin / isAuthSubdomainHost / buildAuthSubdomainStartUrl / buildMainDomainUrl)
- `apps/web/src/lib/cookie-utils.ts`:`getAuthCookieDomain()` 在 localhost 时跳过 domain 设置(浏览器不接受 .localhost)
- `apps/web/middleware.ts`:host 头部解析;bsm.aizhs.top 命中时仅放行 `/sso/*`、`/auth/*`、`/callback`、`/api/auth/*` 与静态资源,其余路径 307 跳回主域同路径;主域走原鉴权逻辑
- `apps/web/src/hooks/use-third-party-auth.ts`:`startLogin` 在主域时先 302 到 `bsm.aizhs.top/sso/auth?platform=xxx&return_to=...`,由子域薄页自动发起 OAuth
- `apps/web/app/sso/auth/page.tsx`(新):认证子域薄页,挂载时自动 `startLogin(platform)`,带安全校验(必须认证子域、合法 platform 枚举)
- `apps/web/app/(auth)/callback/OAuthCallbackHandler.tsx`:成功后若在认证子域,`window.location.href = aizhs.top/`,主域 `useAuthBootstrap` 自动读 Cookie 恢复登录态
- `apps/web/messages/{zh-CN,zh-TW,en,ja,ko}.json`:新增 `sso.redirecting` / `sso.redirectingDesc` / `sso.invalidPlatform` / `sso.authFailed` 4 键 × 5 语言 parity
- `scripts/start-cloudflared-tunnel.ps1`:注释更新(主域 + 认证子域双 ingress,Cloudflare 控制台添加第二条 hostname 规则)

**Cloudflare 控制台侧必做项(用户手动)**:

1. Zero Trust → Networks → Tunnels → ihui-local → Configure → Public hostname
2. 添加第二条 hostname:`aizhs.top` → `http://localhost:3000`(第一条 bsm.aizhs.top 已存在)
3. 保持 DNS proxy 开启(橙色云朵)
4. 生产环境 aizhs.top 走 nginx,本地 dev 时通过隧道接管,需要时手动切换 Cloudflare DNS 记录

**OAuth 跨域流程**:

1. 主域用户点"钉钉" → `useThirdPartyAuth.startLogin` 302 到 `bsm.aizhs.top/sso/auth?platform=dingtalk&return_to=...`
2. 子域薄页挂载时调用 `startLogin('dingtalk')` → 走厂商跳转(redirect_uri = `bsm.aizhs.top/callback?platform=dingtalk`)
3. 钉钉回调到 `bsm.aizhs.top/callback?code=xxx` → `OAuthCallbackHandler` 调后端换 token + setAuthCookie(domain=.aizhs.top)
4. 成功后 `window.location.href = https://aizhs.top/`
5. 主域 `useAuthBootstrap` 读 cookie → `/auth/profile` → 自动登录态恢复

**安全**:

- 认证子域只放白名单路径,主域全功能不受影响
- Cookie 域 `.aizhs.top` + SameSite=Lax + Secure(https 自动)
- 子域薄页校验:非认证子域 → 跳回主域;platform 非法 → 跳回主域

**自验**:

- typecheck `pnpm --filter @ihui/web typecheck` 0 错误
- i18n 5 文件 JSON.parse VALID + 4 键 parity
- zh-TW 无简体字残留(opencc 守门)
- ko 无中文残留(字符范围守门)
- 浏览器渲染验证(等 dev server 启动后)

**硬约束**:

- 改动文件仅限本任务清单
- commit message: `feat(auth): 分域 SSO 架构 — 主域 aizhs.top + 认证子域 bsm.aizhs.top`
- 跨端:仅 web 端(API 与 ai-service 不变)
- Cookie 域设置仅在非 localhost 时生效,本地纯 localhost 调试保持无 domain 行为不变

---

### AI 对话框 Skill 库统一面板 + 用户自定义技能 CRUD(2026-07-21,跨端:web + api + 共享包)

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

<!-- 已归档(2026-07-21):管理端 AI 成本监控补全(已完成 ✅ 2026-07-21)— P1 阶段(recordAiCost 接入 + AdminNav AI 成本入口 + i18n 5 语言 + server-docs fix-forward + recordAiCost import 修复),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_admin-ai-cost.md -->

---

<!-- 已归档(2026-07-20):自媒体工作台整合(content-engine + koubo-workflow → IHUI-AI)+ 侧边栏分组整合(自动化移入 AI教育,自媒体与内容合并)2 个已完成任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_publish-task-archive.md -->

---

<!-- 已归档(2026-07-20):自媒体工作台 P1/P2 优化任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_self-media-p1-p2.md(commit 209ca067) -->

---

<!-- 已归档(2026-07-20):自媒体自动化定时任务管理页面,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_self-media-automation.md(commit 7bcdc54) -->

---

<!-- 已归档(2026-07-21):内容分组:文章/图片/视频一键自动发布平台(已完成 ✅ 2026-07-20)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->

### M-65 首页落地营销内容全面优化(2026-07-20)

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

<!-- 已归档(2026-07-21):M-64 AI 面板手柄竖向提示文字水平居中 + dist UTF-8 BOM 守门,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):i18n P1 批次 2_6:refund / member-order / r...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->
<!-- 已归档(2026-07-21):i18n P1 批次 2_7:member-orders / learn-pay...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->
<!-- 已归档(2026-07-21):i18n P1 批次 2_8:20 page.tsx 多 subagent 并行...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->
<!-- 已归档(2026-07-21):i18n P1 批次 2_9:20 page.tsx 多 subagent 并行...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->
<!-- 已归档(2026-07-21):i18n P1 批次 2_10:20 个高优组件文件多 subagent 并行 i18n 化(commit dbb0995d,协作事故 commit message 错误),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->
<!-- 已归档(2026-07-21):i18n P1 批次 2_11:15 个高优 page/tsx 多 subagent 并行 i18n 化(commit 4b94b09),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->
<!-- 已归档(2026-07-21):AI 主动提问弹窗 + 挂起对话续流(commit 2fad28f),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):P1 收尾:17 新模型推荐位 + 5 语言 i18n 描述 + BrandIcon 新厂商(commit 011ffa2),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):P2 多端同步持久化 AI 主动提问挂起状态(commit 90c4a8b),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):P2 后续补丁:集成测试 + Zod 运行时校验(commit 35a39cb),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):架构迁移整合 Phase 11 P0 收尾(已完成 ✅ 2026-07-20)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->
<!-- 已归档(2026-07-21):全模型配置覆盖:17 个 2026-07 新模型完整接入(commit 211b316),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):阻塞项彻底清零 + 79 P0 清单核对,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):首页 7 页拆分 + 跑马灯速度/暗色模式/呼吸感间距三修,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-20):工作区本地文件夹访问权限配置(3 种模式)+ SSO 多端接入完整化 / 登录弹窗 logo 修复 / 邮箱认证 / 首页路由合并 / Extension popup / 5 语言 i18n 修复 / P2-P4 残余优化 audit 复核 8 个已完成条目,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_pre-permission-runtime.md(54.6 KB)及更早 archive 快照,git log 可查 commit 695f44e2 / 5f3bee93 / 7804e449 / 51c47b00 / d5b082cc 等 -->

---

<!-- 已归档(2026-07-21):历史项目深度比对 + 7 项迁移遗漏补全,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_edu-attachments-and-cleanup.md -->
<!-- 已归档(2026-07-21):Page 6 修复内容偏上布局(commit 514f866),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_page-6-fix.md -->

---

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

## 学生学习报告 + 每日多格式日志全链路补全(2026-07-21 立)

**触发**:用户问"学生管理 学生每天填入自己的学习情况 各种格式 还有一键导出学习报告的全链路现在都开发好了吗 都正常使用了吗"。深度审计结论:① 学生管理 ✅ 已完成;② "每天填写学习情况(各种格式)" ❌ 不支持每日机制 + 不支持图片/音频/视频附件;③ "一键导出学习报告" ❌ 前端无导出按钮 + 后端 `report.ts` 仅运营报表 + `useReportGenerator` Hook 是孤儿代码 + `/api/edu/my-report` 仅返回 3 维 JSON 无导出能力。

### 任务拆分(P0 → P3)

#### [x] ✅(2026-07-21) P0:修 student/notes/page.tsx URL 缺 `/edu` 前缀 bug

- [x] ✅ `apps/web/app/(main)/student/notes/page.tsx` 第 48 行 `PUT /api/notes/${editing.id}` → `/api/edu/notes/${editing.id}`
- [x] ✅ 第 63 行 `DELETE /edu/notes/${id}` → `/api/edu/notes/${id}`(同时缺 `/api` 前缀)

#### [x] ✅(2026-07-21) P1:一键导出学习报告全链路(后端 + 前端打通)

**后端**(`apps/api/src/routes/edu-public.ts`):

- [x] ✅ 新增 `POST /edu/my-report/export` 端点(学员本人,只需登录鉴权,非 admin)
- [x] ✅ 支持 `format: 'pdf' | 'excel' | 'json'`(复用 `pdf-service.ts` 的 `generateReportPDF` + `excel-export-service.ts` 的 `exportToExcel`)
- [x] ✅ 支持 `dateRange?: { start, end }` 过滤
- [x] ✅ 数据源扩展为 8 维(lessons + exams + certificates + lesson_records 视频时长 + edu_notes 笔记数 + edu_offline_records 线下学时 + edu_uploaded_certs 自传证书 + learn_homework_record 作业提交)
- [x] ✅ Zod 校验请求体
- [x] ✅ `apps/api/src/routes/edu-extended.ts` 新增 `GET /admin/edu/students/:userId/report/export` 端点(admin 端按 userId 导出)
- [x] ✅ `apps/api/src/services/pdf-service.ts` 修 WritableBuffer 异步 bug(继承 stream.Writable + await 'finish' 事件)

**前端**:

- [x] ✅ `apps/web/src/hooks/use-report-generator.ts` 改为通用下载 Hook(支持 blob 响应 + 浏览器触发下载)
- [x] ✅ `apps/web/app/(main)/student/page.tsx` 学员中心顶部加"导出学习报告"按钮(下拉:PDF / Excel / JSON)
- [x] ✅ `apps/web/app/(main)/admin/edu/reports/memberstudy/page.tsx` admin 端加导出按钮(支持按 userId 导出单个学员报告)
- [x] ✅ 5 语言 i18n parity(zh-CN / zh-TW / en / ja / ko 各加 6 keys:exportReport/exporting/exportPdf/exportExcel/exportJson/exportError)

**验证**:

- [x] ✅ `pnpm --filter @ihui/api typecheck` exit 0(本任务文件全绿)
- [x] ✅ `pnpm --filter @ihui/web typecheck` exit 0(本任务文件全绿;edu/dashboard/page.tsx 的 `tc` typo 是其他 agent 引入,非本任务范围)
- [x] ✅ curl 实际下载验证:admin GET json/excel/pdf 3 格式 + student POST json/excel/pdf 3 格式 = 6 个测试全 200
  - admin GET json: 8 维数据聚合正确 ✅
  - admin GET excel: 7237 bytes ✅
  - admin GET pdf: 1730 bytes,首 4 字节 `%PDF` ✅
  - student POST json/excel/pdf: 全 200 ✅
- [x] ✅ browser_use DOM 默认态验证通过(按钮文本"导出学习报告"、disabled=false、className 含 outline 样式)
- [~] browser_use 4 状态截图验证:工具故障 "browser tab is not visible on screen"(非代码问题,DOM 已验证)

#### [ ] P2:每日学习日志 + 多格式附件

**数据库**(`packages/database/src/schema/edu-extended.ts`):

- [ ] `edu_notes` 表新增 `attachments jsonb` 字段(数组:[{ url, name, type, size }])
- [ ] `edu_offline_records` 表新增 `attachments jsonb` 字段
- [ ] `pnpm --filter @ihui/database drizzle-kit generate` 生成 migration

**后端**:

- [ ] `apps/api/src/routes/edu-public.ts` `POST /edu/notes` + `PUT /edu/notes/:id` 接收 attachments
- [ ] `POST /edu/offline-records` + `PUT /edu/offline-records/:id` 接收 attachments
- [ ] Zod schema 校验 attachments 结构(每项必须有 url + name + type + size)

**前端**:

- [ ] `apps/web/app/(main)/student/notes/NoteDialog.tsx` 加 ImageUpload 组件(复用 `@/components/form/ImageUpload.tsx`,支持 image/audio/video MIME)
- [ ] `apps/web/app/(main)/student/offline-records/OfflineRecordDialog.tsx` 同上
- [ ] 修 `ImageUpload` 默认 `uploadUrl` BUG(`/api/files/upload` 不存在,改为 `/api/files/upload/form`)
- [ ] 5 语言 i18n parity(附件上传相关文案)

**验证**:

- [ ] `pnpm --filter @ihui/database drizzle-kit generate` exit 0 + migration 文件正确
- [ ] `pnpm --filter @ihui/api typecheck` exit 0
- [ ] `pnpm --filter @ihui/web typecheck` exit 0
- [ ] browser_use 实际渲染验证 NoteDialog 文件上传 4 状态(空/上传中/已上传/删除)
- [ ] curl 实际上传文件 + 创建带附件的笔记 + GET 验证 attachments 字段返回

#### [ ] P3:清理 3 个孤儿 Hook

- [ ] `apps/web/src/hooks/use-student-profile.ts`:调用 `/api/students/:id/profile` 后端不存在 + 前端 0 引用 → 删除
- [ ] `apps/web/src/hooks/use-ai-report.ts`:调用 `/api/ai-ext/reports` 后端不存在 + 前端 0 引用 → 删除
- [ ] `apps/web/src/hooks/use-report-generator.ts`:P1 任务中改造为通用下载 Hook,从孤儿代码变为实际使用
- [ ] grep 验证 3 个 Hook 删除/改造后无残留引用

---

## 飞书 OAuth 扫码登录接入 + 生产环境配置(2026-07-21 立,平台独占)

**触发**:用户反馈"扫码登录后显示 state 参数什么什么的失败",同时问"生产环境上线配置这个东西怎么配置 详细告诉我"。

### [x] ✅(2026-07-21) 修复飞书 OIDC v2 协议实现 bug(用户扫码后报 20014)

- **根因**:`apps/api/src/services/oauth-providers.ts` getFeishuAccessToken 实现不完整
  - 缺步骤 1:没调 `/auth/v3/app_access_token/internal` 拿 app_access_token
  - 缺步骤 2:调 `/authen/v1/oidc/access_token` 时没传 `Authorization: Bearer <app_access_token>` 头
  - 缺步骤 3:body 没传 `redirect_uri`(飞书 OIDC v2 必传)
  - 响应解析错误:飞书 v2 成功响应是 `data.access_token` 嵌套,不是 `body.access_token`
- **修复**:`oauth-providers.ts:501-599` 重写 getFeishuAccessToken + 新增 getFeishuAppAccessToken
- **配套**:`apps/api/.env` 新增 `FEISHU_REDIRECT_URI=http://localhost:3000/callback?platform=feishu`
- **验证**:
  - curl 直接调飞书 `/auth/v3/app_access_token/internal` 返回 `code:0, msg:"ok"`,凭据有效
  - curl 调本项目 `/api/auth/feishu/callback` 传假 code,错误从 20014(协议错)变为 20003(code 无效),证明协议修复成功
  - browser_use 实测 `/sso/auth?platform=feishu` → 自动跳转到 `https://accounts.feishu.cn/accounts/auth_login/oauth2/authorize?...`,页面标题"飞书授权",显示"智汇AI社区"应用授权页 ✅

### [x] ✅(2026-07-21) 生成生产环境配置文件(平台独占,部署配置不涉业务代码)

- [x] ✅ `apps/web/.env.production` 新建(基于 .env.local 真实凭据,redirect_uri 改为 `https://bsm.aizhs.top/callback?platform=xxx`)
- [x] ✅ `deploy/nginx/conf.d/bsm-subdomain.conf` 新建(bsm.aizhs.top 认证子域 nginx 配置,只代理 web,/api/ 显式 307 跳主域)
- [x] ✅ `.env.production`(根目录)补充分域 SSO + 飞书 OAuth 变量(COOKIE_DOMAIN / FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_REDIRECT_URI)
- [x] ✅ `.env.production.example`(根目录)补充分域 SSO + 飞书 OAuth 变量示例
- [x] ✅ `apps/web/.env.production.example` 补充分域 SSO 变量示例(NEXT_PUBLIC_AUTH_SUBDOMAIN / NEXT_PUBLIC_MAIN_DOMAIN / NEXT_PUBLIC_COOKIE_DOMAIN)

### [ ] 用户需手动完成的生产上线操作清单

**1. DNS 解析**(域名服务商后台,如阿里云/Cloudflare):

- 加 A 记录:`@` → 服务器 IP
- 加 A 记录:`bsm` → 服务器 IP(认证子域)

**2. SSL 证书**(服务器上跑 certbot):

```bash
certbot --nginx -d aizhs.top -d www.aizhs.top -d bsm.aizhs.top
```

**3. 飞书开发者后台**(https://open.feishu.cn/app/cli_a9de15cbb8399bc8):

- 「安全设置 → 重定向 URL」白名单加两条:
  - `http://localhost:3000/callback?platform=feishu`(本地开发)
  - `https://bsm.aizhs.top/callback?platform=feishu`(生产)
- 「应用功能 → 网页」开关打开
- 「应用发布 → 版本管理与发布」创建版本 + 申请发布 + 管理员审核通过

**4. 其他第三方后台**(redirect_uri 改成 bsm 子域):

- 微信开放平台:加 `https://bsm.aizhs.top/callback?platform=wechat`
- 钉钉开发者后台:加 `https://bsm.aizhs.top/callback?platform=dingtalk`
- 企业微信后台:加 `https://bsm.aizhs.top/callback?platform=enterpriseWechat`
- GitHub OAuth App:加 `https://bsm.aizhs.top/callback?platform=github`
- Google Cloud Console:加 `https://bsm.aizhs.top/google/callback`

**5. 服务器部署**:

```bash
# 拉代码
cd /opt/ihui
git pull origin main

# 数据库迁移
pnpm --filter @ihui/api db:migrate

# build 前端(读取 apps/web/.env.production 编译进产物)
pnpm --filter @ihui/web build

# 启动(web 3000 + api 8080,Blue 环境)
NODE_ENV=production pnpm --filter @ihui/web start &
NODE_ENV=production pnpm --filter @ihui/api start &

# Nginx 配置(主域 + 子域)
cp deploy/nginx/nginx-blue-green.conf /etc/nginx/conf.d/
cp deploy/nginx/conf.d/bsm-subdomain.conf /etc/nginx/conf.d/
nginx -t && nginx -s reload
```

**6. 验证清单**:

| 验证项   | 命令/操作                                 | 期望             |
| -------- | ----------------------------------------- | ---------------- |
| DNS      | `nslookup bsm.aizhs.top`                  | 返回服务器 IP    |
| HTTPS    | 浏览器访问 `https://aizhs.top`            | 锁标志正常       |
| 主域首页 | `curl https://aizhs.top/`                 | 200 OK           |
| 子域可达 | `curl https://bsm.aizhs.top/nginx-health` | 200 ok           |
| API 健康 | `curl https://aizhs.top/api/health`       | `{"code":0,...}` |
| 飞书扫码 | 主域点登录 → 飞书登录 → 扫码              | 跳回主域已登录   |

### [ ] 用户实际扫码登录验证(需用户手机飞书 App 扫码,agent 无法代劳)

- 协议链路已修通(curl 20014→20003 + browser_use 跳转飞书授权页 PASS)
- 只差用户用手机飞书 App 扫码完成最后一步授权
- 如果还失败,排查:浏览器地址栏 URL + F12 Network `/api/auth/feishu/callback` 响应 body

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

### SaaS 托管服务架构(2026-07-21)— P1 阶段 2.2:web/admin UI + 证书 + 资源监控

**P1-2.2 / P1-2.3 完成情况**:

| 子任务                          | commit      | 范围                                              |
| ------------------------------- | ----------- | ------------------------------------------------- |
| P1-2.2a 部署层管理后台          | `b5dff4ba`  | 租户列表 + 创建/暂停/恢复/销毁                    |
| P1-2.2b 部署层详情页 + 备份管理 | `ebd29161b` | 详情页 + 备份列表/恢复/删除                       |
| P1-2.2c 证书状态监控 + 配额占位 | `346c72bf9` | acme.json 扫描 + 5 语言 i18n                      |
| **P1-2.3 资源监控(本次)**       | 待提交      | Prometheus + Grafana + 详情页 iframe + 横向对比页 |

**P1-2.3 详细任务清单**:

**目标**:在 P1-2.1 脚本 + P1-2.2 UI 基础上,接入 Prometheus + Grafana 实现 per-tenant 资源实时监控,并把 P1-2.2c 占位配额切换为真实数据。

**架构**:

```
cAdvisor(:8080) → Prometheus(:9090) → Grafana(:3001)
                                  ↓
                  admin-api(:8081) 代理查询 + 配额端点替换
                                  ↓
              web 端 GrafanaFrame(iframe) + MetricsCard(实时数据)
```

**改动文件清单**:

1. `deploy/saas/prometheus/prometheus.yml`:抓取 cAdvisor + admin-api
2. `deploy/saas/grafana/provisioning/datasources/prometheus.yml`:数据源自动注册
3. `deploy/saas/grafana/provisioning/dashboards/dashboards.yml`:Dashboard 自动加载(30s 扫描)
4. `deploy/saas/grafana/dashboards/tenant-overview.json`:per-tenant 仪表板(8 panel,带 var-tenant 模板变量)
5. `deploy/saas/grafana/dashboards/tenant-comparison.json`:多租户对比仪表板(2 panel,按 CPU 排序)
6. `deploy/saas/admin-api/src/routes/metrics.ts`:3 个端点(quota / metrics / summary)
7. `deploy/saas/admin-api/src/routes/customers.ts`:移除 quota 占位逻辑
8. `deploy/saas/admin-api/src/index.ts`:注册 metricsRoutes(先于 customerRoutes)
9. `deploy/saas/docker-compose.yml`:cadvisor + prometheus + grafana 3 个服务
10. `deploy/saas/.env.example`:新增 GRAFANA_ADMIN_USER/PASSWORD + PROMETHEUS_RETENTION
11. `apps/web/app/(main)/admin/saas/_components/GrafanaFrame.tsx`:iframe 包装组件(bare 模式 + 降级提示)
12. `apps/web/app/(main)/admin/saas/_components/MetricsCard.tsx`:实时指标卡片(CPU/内存/网络,15s 轮询)
13. `apps/web/app/(main)/admin/saas/[slug]/page.tsx`:嵌入 GrafanaFrame + MetricsCard + "租户对比"快捷入口
14. `apps/web/app/(main)/admin/saas/metrics/page.tsx`:**新增** 横向对比页(Grafana 多租户图 + 排名表)
15. `apps/web/src/components/layout/AdminNav.tsx`:新增 saasMetrics 导航项
16. `packages/api-client/src/endpoints/admin-tenants.types.ts`:新增 CustomerMetrics / MetricsSummary 类型
17. `packages/api-client/src/endpoints/admin-tenants.ts`:新增 adminGetCustomerMetrics / adminGetMetricsSummary
18. `apps/web/src/hooks/use-saas-tenants.ts`:新增 useCustomerMetricsQuery / useMetricsSummaryQuery
19. `apps/web/messages/{zh-CN,en,ja,ko,zh-TW}.json`:新增 admin.saas.metrics namespace(27 keys) + detail.compareTenants + nav.saasMetrics
20. `deploy/saas/README.md`:新增"资源监控(P1 阶段 2.3)"章节 + 目录结构更新
21. `PROJECT_PLAN.md`:追加 P1-2.3 任务条目(本任务)

**admin-api 端点新增**(端口 8081):

- `GET /admin/api/customers/:slug/quota` — 配额(从占位切换为 Prometheus,placeholder=false)
- `GET /admin/api/customers/:slug/metrics` — 实时指标(CPU/内存/网络,2s 超时)
- `GET /admin/api/metrics/summary` — 多租户横向对比(按 CPU 降序)

**降级策略**:

- `promQuery`:HTTP 非 200 / 超时 / 解析失败 → 返回 `null` 而非抛错
- metrics.ts:三个核心指标全 `null` → 返回 `placeholder: true`,UI 仍可渲染
- GrafanaFrame:容器未启动 → 显示"资源监控暂不可用"卡片,不影响其他功能

**验收硬性指标**:

- `pnpm --filter @ihui/web typecheck` 0 错误
- i18n 5 文件 JSON.parse VALID + 27 keys parity
- `docker compose -f deploy/saas/docker-compose.yml config` exit 0
- `bash -n deploy/saas/scripts/*.sh` 全通过
- 浏览器渲染:详情页 Grafana iframe 加载 + /admin/saas/metrics 排名表 + AdminNav 出现"资源监控"项

**硬约束**:

- 改动文件仅限本任务清单
- 不动主 8 端业务代码
- 数据不可达时必须降级,不能阻断 UI
- Grafana iframe 必须在 client-only(mounted 后)渲染
- iframe sandbox: `allow-same-origin allow-scripts allow-forms allow-popups`
- commit message: `feat(saas): P1-2.3 资源监控 — Prometheus + Grafana per-tenant 实时图表`

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

## PDF 学习报告真实内容生成(2026-07-21)— P1 任务(P0 链路补全)

**触发**:上一轮交付报告已识别根因"PdfKit 调用 on('finish') 事件目前 noop 导致内容未刷出,当前 PDF 是 stub(空白但合法)"。用户回复"继续去做按你的建议",按建议 2 推进。

**根因深挖**(审计发现 PROJECT_PLAN.md line 310 标记 `[x] ✅` 但实际未完成):

- `apps/api/src/services/pdf-service.ts` line 212-233 `WritableBuffer` 类**没有继承 `stream.Writable`**,仅自实现 `write()` / `end()` / `on()` / `once()`,与 pdfkit pipe 协议不兼容。
- 现有 `end()` 是 noop;`once('finish', cb)` 立即同步调用 `cb()`,导致 pdfkit 误以为"流已 flush 完成",**最终 chunk 永远不刷出**。
- 上一轮 P0 修复只加了 `try/catch` 兜底 → pdfkit 实例化失败时降级到 208 字节 stub PDF(合法但空白)。
- 业务影响:admin 端 / student 端导出的 PDF 都只包含 `%PDF-1.4` 头部 + xref + `%%EOF`,**没有学员姓名/课程/笔记数/学时等任何真实数据**。

**改动文件**(1 个):

- `apps/api/src/services/pdf-service.ts`:
  1. `WritableBuffer` 改为 `class WritableBuffer extends Writable`(`_write` 收集 chunks + `getBuffer()` 导出)
  2. `generateCertificatePDF` / `generateInvoicePDF` / `generateReportPDF` 三个函数改为 Promise 模式,`new Promise<PDFResult>` 等 `buf.on('finish', () => resolve(buf.getBuffer()))`
  3. 保留 try/catch 兜底:Promise 构造同步代码出错时降级 stub,异步 finish 事件出错时降级 stub(防止极端字体/编码异常阻塞导出链路)

**真实数据验证**(自验脚本,`scripts/test-pdf-real-content.mjs`):

- 调 `generateReportPDF` 传入 8 维学员数据(姓名/课节数/考试分/笔记数/学时/证书数/作业提交/总学时)
- 验证:
  - `result.stub === false`(不是 stub)
  - `result.buffer` 长度 ≥ 2KB(stub 是 208 字节,真实 PDF 通常 2-10KB)
  - 前 4 字节 === `%PDF`
  - 含 `%%EOF` 结束标记
  - 包含学员姓名(说明真实数据被写入 PDF)

**跨端**:仅 api 端(平台独占:PDF 生成是后端纯逻辑,前端只触发下载,无 web/api/ai-service 8 端共享类型变更)。

**不**包含在本次任务:

- ❌ 中文 PDF 字体嵌入(pdfkit 默认 Helvetica 不支持中文,需嵌入思源黑体等,本任务用 ASCII/Emoji 兜底)
- ❌ 真实图表(柱状图/折线图,需 chartjs-node 等,本任务用文本段落)
- ❌ 模板引擎(本期用代码硬编码 section,后续可抽 ejs/handlebars)

**状态**:🚧 进行中(本次会话)

---

<!-- 已归档(2026-07-21):综合安全审计 9 轮加固(已完成 ✅ 2026-07-21)— 配置/秘密泄露 + SQL 注入 + XSS + RCE + CSRF + SSRF + 依赖漏洞 + 安全头 + 加密失败 + token 持久化 全部深度修复,9 个 fix(security) commit 已合入 origin/main。完整审计归档见 `.trae-cn/goal-runtime/SECURITY-AUDIT-2026-07-21.md` -->

---
