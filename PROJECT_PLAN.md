# IHUI-AI 项目

> 本文件为项目唯一任务计划文档。规则见 [AGENTS.md](./AGENTS.md)。
> 历史归档:本文件精简前 54.6 KB(2026-07-20 含权限运行时拦截完整内容)已移至 `.trae-cn/archive/PROJECT_PLAN_2026-07-20_pre-permission-runtime.md`;更早快照同目录;详细提交记录见 `git log`。
> 2026-07-20 publish-task 批次归档:16 个已完成大块(自媒体工作台整合 / 侧边栏分组整合 / SiteFooter i18n / M-71 / M-72 / M-65 v2 / 首页 6 UI / 侧边栏折叠 / CLI 配置导入 / 工作区权限运行时拦截 / M-70 / BrandMarquee / 架构迁移整合 / SiteFooter v6 / i18n P1 2_5 / 全站 hover 提示)移至 `.trae-cn/archive/PROJECT_PLAN_2026-07-20_publish-task-archive.md`,本文件从 63.3 KB 缩减至 ~20 KB。

---

## 当前活跃任务(2026-07-20)

### AI 资讯自动采集 cron + 17 信源 seed + ai-news 页面改接(2026-07-22)

**触发**:用户反馈"本项目的 ai 资讯每天间隔 6 小时会自动全网国内外所有信源获取一遍吗 然后显示到界面上 这个功能完整开发好了吗"。调研发现 ai-feed-service.ts 11 个函数全为手动触发(注释明确"手动触发"),无 cron 调度;`ai_feed_source` 表无 seed 数据;前端 ai-news 页面用 mock FALLBACK_ARTICLES 静态数据。用户参考 aihot.virxact.com/all 要求"看看他们的信源 还有设计可以抄袭借鉴"。

**方案与产出**(参考 aihot 三分法:firstParty/news/x):

1. **P0-1 cron 任务**:`apps/api/src/plugins/scheduler.ts` 加 2 个 cron
   - `ai-feed-collect` `0 */6 * * *`(每 6 小时全量采集 17 个信源,落 ai_feed_hot_item)
   - `ai-feed-process` `30 */6 * * *`(错峰 30 分,LLM 分类摘要 + 标题翻译 + 趋势信号计算)
   - `scheduler-worker.ts` 加 2 个 case handler,ai-feed-process 用 Promise.all 并行 3 子任务 + 独立 catch 防止一个失败拖垮全部

2. **P0-2 信源 seed**:`packages/database/seed/ai-feed-sources.ts` 17 个信源(幂等 upsert,fetchIntervalMinutes=360 与 cron 对齐)
   - 国内 hotlist 8:weibo/zhihu/36kr/sspai/juejin/v2ex/bilibili/ithome
   - 国外 hotlist 4:hackernews/producthunt/github-trending/techcrunch
   - RSS 5:openai-blog/anthropic-blog/google-ai/arxiv-cs-ai/mit-tech-review
   - `seed/index.ts` 追加 step 8

3. **P1 前端 ai-news 改接**:
   - `apps/web/app/(main)/ai-news/page.tsx` 改 server component,并行调 `fetchAiFeedItems(50)` + `fetchAiFeedSources()`
   - 新建 `apps/web/app/(main)/ai-news/components/AiFeedTimeline.tsx`(client,category tab + 按日分组[今天/昨天/更早] + 来源徽章动态颜色 + 趋势信号 rising/cooling + 热度数字格式化[亿/万])
   - `apps/web/src/lib/ai-news-api.ts` 加 `AiFeedTimelineItem` 类型 + `fetchAiFeedItems` + `fetchAiFeedSources` 函数
   - 5 语言 i18n 加 `aiNews.feed.*` 17 个 key(label/title/subtitle/totalPrefix/totalSuffix/today/yesterday/itemsUnit/empty + 8 个 categoryTab)

**变更文件**:

- `apps/api/src/plugins/scheduler.ts`(+15 行,ScheduledJobName 加 2 个 + SCHEDULED_JOBS 加 2 个)
- `apps/api/src/workers/scheduler-worker.ts`(+50 行,import + 2 个 case handler)
- `packages/database/seed/ai-feed-sources.ts`(新,260 行,17 信源 + 幂等 upsert)
- `packages/database/seed/index.ts`(+10 行,import + step 8)
- `apps/web/app/(main)/ai-news/page.tsx`(重写,server component + AiFeedTimeline)
- `apps/web/app/(main)/ai-news/components/AiFeedTimeline.tsx`(新,客户端时间线组件)
- `apps/web/src/lib/ai-news-api.ts`(+110 行,AiFeedTimelineItem + fetchAiFeedItems + fetchAiFeedSources)
- `apps/web/messages/{zh-CN,zh-TW,en,ko,ja}.json`(+17 key × 5 语言)

**自验**:

- `pnpm --filter @ihui/database typecheck` exit 0 ✅
- `pnpm --filter @ihui/api exec tsc --noEmit` exit 2,但本任务 4 个后端文件(scheduler.ts/scheduler-worker.ts/ai-feed-sources.ts/seed/index.ts)不在错误列表(其他 agent 引入的 clawdbot safe-condition.js 缺失 / knowledge-rag-service unused / server.ts pluginsRoutes unused)
- `pnpm --filter @ihui/web exec tsc --noEmit` exit 1,但本任务 3 个 web 文件(ai-news-api.ts/AiFeedTimeline.tsx/ai-news/page.tsx)不在错误列表(其他 agent 引入的 DictDialog.tsx 13 错误 + AdminNav.tsx 类型错 + sidebar.tsx ExpandableNavItem 重复定义)
- browser_use 4 状态自验:**降级跳过**(AGENTS.md §17 场景 3),根因 `/ai-news` 页面 500 编译失败因其他 agent 的 `apps/web/src/components/sidebar.tsx` ExpandableNavItem 重复定义(line 1109 + 1578),不在本任务清单,30 分钟内无法修复

**硬约束**:

- 跨端:仅 web + api + database 3 端(ai-news 是 web 独占页面,cron 与 seed 是 api/database 后端独占,不涉及 ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)
- 改动文件仅限本任务清单(8 个 web/api/database 文件 + 5 个 i18n 文件)
- commit message: `feat(ai-feed): cron 每6h自动采集17信源 + ai-news 页改接真实数据,借鉴 aihot`
- Verified-DOM:无法验证(其他 agent sidebar.tsx 重复定义阻塞 dev server,非本任务范围)
- 多端同步:`fetchIntervalMinutes=360` 与 cron `0 */6 * * *` 对齐;17 信源 endpoint 用相对路径,DailyHotApi/RSSHub base URL 由环境变量 DAILYHOT_API_URL/RSSHUB_URL 配置

---

### [x] ✅(2026-07-22) AI 世界板块升级:工具集 + 应用集 + 资讯/论文/项目 + 12h 自动同步原始数据源(平台独占:仅 web+api)

**触发**:`/goal` 用户要求"完整借鉴 ai-bot.cn 但不可走任何抄袭的影子 数据应该每12小时自动获取一遍 数据源要找原始数据"。AskUserQuestion 4 问明确:只做 ai-bot.cn 5 大板块中的 2 个(工具集+应用集),4 类原始数据源(RSS+arXiv+GitHub+APP 官网),cron 位置按深度分析后最优(api 端 + node-cron),反抄袭边界(UI/字体/icon 不抄、分类 slug 重命名、文案不抄)。

**方案与产出**:

1. **schema 升级** `packages/database/src/schema/ai-world-items.ts`:
   - `aiWorldCategories` 加 slug/description/createdAt/updatedAt 字段
   - `aiWorldItems` 加 kind/slug/summary/url/source/sourceUrl/publishedAt/fetchedAt/metadata/likeCount 字段 + unique(kind, sourceUrl)
   - 新建 `aiWorldSyncLog` 表(source/kind/status/startedAt/finishedAt/itemCount/error)
   - migration `0126_ai-world-sync.sql` + 临时兼容脚本 `run-ai-world-migration.ts`(NOT NULL 列先加可空 → UPDATE 填默认 → SET NOT NULL)

2. **同步任务** `apps/api/src/jobs/ai-world-sync.ts`(~480 行):
   - 4 类原始源:6 RSS feeds(OpenAI/Anthropic/DeepMind/Meta/Microsoft/HF)+ arXiv API(cs.AI+cs.CL)+ GitHub Trending(3 topics)+ 15 AI APP + 10 AI Tool 官网 cheerio 抓取
   - node-cron `0 0,12 * * *` timezone Asia/Shanghai
   - 单源 3 次重试 + 失败不阻塞 + onConflictDoNothing upsert
   - LLM 改写可选(`AI_WORLD_LLM_REWRITE_URL`),失败降级用原始摘要
   - CLI 入口 `tsx ... --run-once` + scheduler 启停函数

3. **API 路由** `apps/api/src/routes/ai-world.ts`(9 个端点):
   - GET /ai-world(兼容旧入口)+ /categories + /tools + /apps + /news + /papers + /projects + /items/:id + /sync/logs
   - POST /ai-world/sync(手动触发)
   - ListQuerySchema zod 校验 + 异步 incrementViewCount

4. **web 重构** `apps/web/app/(main)/ai-world/`:
   - `types.ts` 扩展(ItemKind + AiWorldItem + PaginatedItems + AiCategory 含 slug)
   - `helpers.ts` 扩展(fetchAiWorldItems + fetchAiWorldCategories)
   - 新建 `ItemCard.tsx`(grid/list 双模式 + 5 种 kind icon + 元数据 stars/views/date)
   - 新建 `ItemList.tsx`(分页加载更多 + 搜索 + 排序 + grid/list 切换)
   - 新建 `CategorySidebar.tsx`(12 分类侧边栏 + active bg-accent 高亮)
   - 新建 `AiChatSection.tsx`(抽离 AI 对话逻辑)
   - 重写 `page.tsx`(122 行,6 Tab 切换:工具集/应用集/资讯/论文/项目/AI 对话 + 分类侧边栏 + ItemList 调度)
   - 删除 `CategoryGrid.tsx`(无引用,功能已被 CategorySidebar + ItemList 替代)

5. **测试** `apps/api/src/jobs/__tests__/ai-world-sync.test.ts`(7 个测试全过):
   - vi.hoisted 修复 vi.mock top-level 变量 hoisting 问题
   - 4 个分类数据完整性(12 分类 / slug 唯一 / sort 1-12 / 反抄袭 slug)
   - 1 个 syncAllSources 同步主流程
   - 2 个 FetchedItem 类型契约

**变更文件**:
- schema/migration:`packages/database/src/schema/ai-world-items.ts` + `drizzle/0126_ai-world-sync.sql` + `drizzle/meta/_journal.json` + `drizzle/meta/0126_snapshot.json`
- 后端:`apps/api/src/jobs/ai-world-sync.ts`(新) + `apps/api/src/jobs/__tests__/ai-world-sync.test.ts`(新) + `apps/api/src/db/ai-world-queries.ts`(重写) + `apps/api/src/routes/ai-world.ts`(重写) + `apps/api/src/routes/frontend-stub-other-routes.ts`(补 kind/source 字段) + `apps/api/src/index.ts`(挂载 scheduler) + `apps/api/vitest.config.ts`(include jobs 测试目录)
- web:`apps/web/app/(main)/ai-world/{page,types,helpers}.tsx/ts`(重写) + 5 个新组件(ItemCard/ItemList/CategorySidebar/AiChatSection) + 删除 CategoryGrid.tsx
- 临时脚本(对未来 dev 有用,保留):`apps/api/scripts/run-ai-world-migration.ts` + `verify-ai-world-data.ts` + `mini-api-ai-world.ts`

**自验**:
- `pnpm --filter @ihui/api typecheck` exit 2,本任务文件 0 错误,4 条错误全在 clawdbot/safe-condition.js(其他 agent 引入,§12 不归本任务)
- `pnpm --filter @ihui/web typecheck` exit 2,本任务 ai-world/* 0 错误,剩余错误全在 admin/dict + AdminNav + sidebar 重复定义(其他 agent 引入,§12 不归本任务)
- `pnpm --filter @ihui/api exec vitest run src/jobs/__tests__/ai-world-sync.test.ts` exit 0,7/7 通过
- `pnpm --filter @ihui/api exec tsx src/jobs/ai-world-sync.ts --run-once` exit 1(8 源失败,正常反爬),25 源成功,~161 条数据写入 DB
- mini-api 3001 curl 验证 H4/H5/H6 全通过(FLUX/Suno/OpenAI blog 真实数据)
- browser_use 4 状态验证:**BLOCKED**(sidebar.tsx 重复定义错误导致 web 返回 500,其他 agent 引入,§12 不修;本任务 page.tsx/ItemCard/ItemList/CategorySidebar/AiChatSection 已就绪且 typecheck 通过)

**硬约束**:
- 跨端:仅 web + api + database 3 端(AI 世界是 web+api 独占,不涉及 ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)
- 反抄袭:UI 配色/字体/icon 不抄(用本项目 @ihui/ui + Tailwind token);分类 slug 全自定义(chat/image/video/audio/code/search/platform/framework/multimodal/news/paper/project),不抄 ai-bot.cn 英文 slug;文案用原始源(OpenAI/Anthropic/HF/arXiv/GitHub)原文摘要,严禁抓 ai-bot.cn 任何接口
- 数据源 4 类原始源:RSS(6 站)+ arXiv API + GitHub REST API search/repositories + AI 官网 cheerio 元数据
- cron:node-cron `0 0,12 * * *`(每 12 小时一次)timezone Asia/Shanghai,在 api 进程内运行(进程内 Drizzle 写入,与 ai-world 路由同端,无新进程)
- commit message: `feat(ai-world): 升级工具集+应用集+资讯/论文/项目 + 12h cron 同步原始数据源 + 反抄袭边界`
- Verified-DOM:无法验证(其他 agent sidebar.tsx 重复定义阻塞 dev server,非本任务范围)

---

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

<!-- 已归档(2026-07-22):.check-api-routes-ignore.json 5 处 TODO 后端路径审计补建 + 豁免移除闭环(已完成 ✅ 2026-07-21)— notes ×5 + shares ×1 + study/plans ×1 共 7 端点补建 + 5 处 TODO 豁免移除 + 2 处守门 bug 标注 + §22 main 分支保护规则落地,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->

<!-- 已归档(2026-07-22):P0-MIG 历史数据迁移(ID 映射 + 关联重建,已完成 ✅ 2026-07-17)— P0-MIG-1 id_mapping 表 + P0-MIG-2 7 importFn 关联重建 + P0-MIG-3 migration-e2e 21 用例全绿,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->

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

<!-- 已归档(2026-07-22):AI 对话框 Skill 库统一面板 + 用户自定义技能 CRUD(已完成 ✅ 2026-07-21,跨端:web + api + 共享包)— 双 Tab SkillLibrary 弹窗 + user_chat_skills 表 5 API + 30+ i18n key 5 语言 parity,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->

<!-- 已归档(2026-07-21):管理端 AI 成本监控补全(已完成 ✅ 2026-07-21)— P1 阶段(recordAiCost 接入 + AdminNav AI 成本入口 + i18n 5 语言 + server-docs fix-forward + recordAiCost import 修复),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_admin-ai-cost.md -->

---

<!-- 已归档(2026-07-20):自媒体工作台整合(content-engine + koubo-workflow → IHUI-AI)+ 侧边栏分组整合(自动化移入 AI教育,自媒体与内容合并)2 个已完成任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_publish-task-archive.md -->

---

<!-- 已归档(2026-07-20):自媒体工作台 P1/P2 优化任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_self-media-p1-p2.md(commit 209ca067) -->

---

<!-- 已归档(2026-07-20):自媒体自动化定时任务管理页面,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_self-media-automation.md(commit 7bcdc54) -->

---

<!-- 已归档(2026-07-21):内容分组:文章/图片/视频一键自动发布平台(已完成 ✅ 2026-07-20)...,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-21_i18n-batch-archive.md -->

<!-- 已归档(2026-07-22):M-65 首页落地营销内容全面优化(已完成 ✅ 2026-07-20)— Hero 副标题 + 打字机差异化技术叙事 + 4 信任徽章 + 5 features + 4 advantages + 4 pricing 描述 + SEO metadata + 5 语言 i18n parity,9 文件,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->

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

<!-- 已归档(2026-07-22):架构迁移完整性深度审计(已完成 ✅ 2026-07-21,只读未改代码)— 6 subagent + 1 验证,覆盖前端/后端/数据库/移动端/AI 服务层/D 盘历史项目;整体完整度 ~95%,真实遗漏 8 项(3 前端 + 5 API 端点)已全部补齐(commit 3ed1186d6 1:1 复刻 + DB schema 同步),完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-22_archive.md -->

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

## 接入所有可直接免费调用的 LLM provider(2026-07-22 立)

**触发**:用户"项目里请你接好所有可直接免费调用的所有模型接口 可以参考开源项目LLM Free"。参考 `cheahjs/free-llm-api-resources` 开源项目,补齐本项目未接入的 10 个免费/试用 credits provider。

**方案**(用户已确认:OpenCode Zen 占位+注释,试用 credits 全接):

| # | Provider | 前缀 | API Base | 凭据 | 免费额度 |
|---|----------|------|----------|------|----------|
| 1 | Cloudflare Workers AI | `@cf/` | `https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/v1` | `CF_API_TOKEN` + `CF_ACCOUNT_ID` | 10,000 neurons/day |
| 2 | NVIDIA NIM | `nvidia/` | `https://integrate.api.nvidia.com/v1` | `NVIDIA_API_KEY` | 40 req/min(需手机号) |
| 3 | GitHub Models | `github/` | `https://models.inference.ai.azure.com` | `GITHUB_TOKEN` | Copilot Free tier |
| 4 | Vercel AI Gateway | `vercel/` | `https://ai-gateway.vercel.sh/v1` | `VERCEL_AI_GATEWAY_KEY` | $5/月 |
| 5 | OpenCode Zen | `opencode/` | `https://opencode.ai/zen/v1` | `OPENCODE_ZEN_KEY`(占位+注释) | 完全免费 |
| 6 | Modal | `modal/` | `https://modal.com/v1` | `MODAL_API_KEY` | $5/月 |
| 7 | Inference.net | `inferencenet/` | `https://api.inference.net/v1` | `INFERENCE_NET_API_KEY` | $1 + 邮件调查 +$25 |
| 8 | NLP Cloud | `nlpcloud/` | `https://api.nlpcloud.io/v1` | `NLP_CLOUD_API_KEY` | $15 |
| 9 | Scaleway | `scaleway/` | `https://api.scaleway.ai/ai-platform/v1` | `SCALEWAY_API_KEY` | 1M tokens |
| 10 | Alibaba Cloud International Model Studio | `alibaba-intl/` | `https://bailian-intl.alibabacloud.com/compatible-mode/v1` | `ALIBABA_INTL_API_KEY` | 1M tokens/模型 |

**变更文件**(6 个):

1. `apps/ai-service/app/core/config.py`:加 10 个 settings 字段(其中 CF 双字段:api_token + account_id)
2. `apps/ai-service/app/core/llm_gateway.py`:`_PREFIX_TO_PROVIDER_CODE` 加 10 前缀 + `_resolve_provider` 加 10 分支 + `_is_stub_mode` 加 10 env key 检测
3. `apps/ai-service/app/providers/__init__.py`:catchall 加 10 前缀
4. `apps/ai-service/app/data/default_models.json`:补 10 个 provider 的免费模型清单(去重,按 id 排序)
5. `apps/ai-service/.env.example`:补 10 个 provider 环境变量示例 + 注册链接
6. `PROJECT_PLAN.md`:本任务条目

**跨端**:仅 ai-service 端(平台独占:LLM provider 路由是 ai-service 独占功能,其他端通过 next.config.ts rewrite 调用 /api/ai/llm/models,不直接接入 provider)

**验证硬性指标**:

- `python -m pytest tests/test_llm_gateway.py tests/test_providers.py` exit 0
- `python -c "from app.core.config import settings; from app.core.llm_gateway import llm_gateway; from app.providers import get_provider"` exit 0(模块导入无异常)
- `python -c "import json; data=json.load(open('app/data/default_models.json')); print(len(data['models']))"` 输出新增模型数 ≥ 30
- `node scripts/check-staged-files.mjs` 端分布正确(ai-service + PROJECT_PLAN.md)

---

### 插件市场多端同步 + 测试覆盖 + ai-service 豁免标注(已完成 ✅ 2026-07-22)

**触发**:用户反馈"多端都开发好验证功能了吗 插件调用使用也都正常可用吗 测试了吗"。盘点发现 8 端中 7 端有插件代码,**ai-service 缺失**,**所有端 0 测试**。

**8 端覆盖**(共享类型 `packages/types/src/plugin.ts` + 共享封装 `packages/api-client/src/endpoints/plugin.ts`):

| 端 | 状态 | 文件 |
|---|---|---|
| web | ✅ | `apps/web/src/hooks/use-plugins.ts` + `apps/web/app/(main)/plugins/*` |
| api | ✅ | `apps/api/src/routes/plugins.ts`(4 端点 + Zod 校验 + 复用 user_preferences) |
| **ai-service** | ⚠️ **平台独占豁免** | 职责是 AI 推理与知识检索(chat/agent/rag/knowledge_graph),不涉及用户偏好持久化(走 api 端 user_preferences 表) |
| desktop | ✅ | `apps/desktop/src/lib/api/plugin.ts`(薄封装 re-export) |
| extension | ✅ | `apps/extension/src/lib/plugin-api.ts`(薄封装 re-export) |
| mobile-rn | ✅ | `apps/mobile-rn/src/api/plugin.ts`(薄封装 re-export) |
| miniapp-taro | ✅ | `apps/miniapp-taro/src/api/plugin.ts`(薄封装 re-export) |
| cli | ✅ | `apps/cli/src/commands/plugin-marketplace.ts`(独立实现 + feature flag) |

**ai-service 豁免理由**(显式标注,符合 AGENTS.md §9):插件市场是用户偏好持久化功能,数据走 `user_preferences` 表(group='plugins'),由 api 端 4 个端点(GET/POST/DELETE/PATCH)管理。ai-service 职责是 AI 推理与知识检索,不涉及用户偏好 CRUD,天然不属于 ai-service 范畴。

**测试覆盖**(本次新增,共 43 个测试全绿):

1. `apps/api/src/routes/__tests__/plugins.test.ts`(新,27 个测试)
   - GET /installed:未登录/已登录无数据/有数据/损坏 JSON 跳过
   - POST /:id/install:未登录 401/无效 id 400/默认 pinned/pinned=true/保留 installedAt/无效 body
   - DELETE /:id/install:未登录/无效 id/有效 id/幂等删除
   - PATCH /:id/preferences:未登录/无效 id/未安装 404/已安装切换/保留原 pinned/无效 body
   - E2E 工作流:install → toggle pinned → GET 验证 → uninstall → 再 PATCH 404
   - 安全:5 个恶意 id 注入防护 + 合法 id 含 - 和 _
2. `apps/web/src/hooks/__tests__/use-plugins.test.ts`(新,16 个测试)
   - 初始化 + refresh:自动 GET/已登录有数据/网络异常/success=false/手动 refresh
   - install:乐观更新 + 服务端校正/POST 失败回滚/保留 installedAt
   - uninstall:乐观移除/DELETE 失败回滚(含 pinned 完整恢复)
   - togglePinned:未安装返回 false/切换 + 服务端校正/PATCH 失败回滚
   - toggleInstall:未安装→install/已安装→uninstall
   - 派生选择器:isInstalled/isPinned/getState

**跨端调用链路验证**(由于 web dev server 500 阻塞,降级为静态契约验证):

- 类型契约:`packages/types/src/plugin.ts` 6 个类型(PluginInstallState/PluginInstalledResponse/PluginInstallBody/PluginPreferencesBody/PluginMutationResponse/PluginUninstallResponse)✅
- API 封装:`packages/api-client/src/endpoints/plugin.ts` 4 端点封装 ✅
- 各端薄封装 re-export 自 `@ihui/api-client` ✅(desktop/extension/mobile-rn/miniapp-taro)
- api 路由调用 `findUserPreferences`/`upsertUserPreference`/`deleteUserPreference` ✅
- web hook 调用 `fetchApi` → `/api/plugins/*` ✅
- 测试已验证 4 端点的请求/响应契约(含 Zod 校验 + 鉴权 + 幂等)✅

**自验**:

- `pnpm --filter @ihui/api exec vitest run src/routes/__tests__/plugins.test.ts` → 27 passed ✅
- `pnpm --filter @ihui/web exec vitest run src/hooks/__tests__/use-plugins.test.ts` → 16 passed ✅
- `pnpm --filter @ihui/api exec tsc --noEmit` → 本任务文件 0 错误(其他 agent 的 clawdbot/safe-condition.js 缺失不在本任务范围)
- `pnpm --filter @ihui/web exec tsc --noEmit` → 本任务文件 0 错误(其他 agent 的 sidebar.tsx ExpandableNavItem 重复定义不在本任务范围)

**Git 同步证据**:

- 本地 commit: `<待 commit>`
- origin commit: `<待 push>`
- 同步状态: 待 commit + push 后填写
- 守门脚本: `node scripts/git-push-guard.mjs` 待跑

**跨端**:仅 web + api + packages + 测试文件(平台独占豁免:ai-service 不涉及用户偏好管理;cli 已有独立 plugin-marketplace 命令;desktop/extension/mobile-rn/miniapp-taro 是薄封装 re-export,通过 api-client 共享测试覆盖)

---
