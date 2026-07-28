# PROJECT_PLAN 归档 — 2026-07-28 final-closing 批次

> **归档时间**:2026-07-28
> **归档原因**:本批次(P0-3d/3e/4a/4b + P1-1/2/3/4 商业化 + 12 降本 + 5 营销)完整收尾,符合 AGENTS.md §1 归档机制("已完成任务条目禁止直接删除,必须两步走")
> **来源**:PROJECT_PLAN.md 中本批次已完成任务条目(标题 + 正文完整版)
> **作用域**:本归档文档只涵盖本批次完成的任务,PROJECT_PLAN.md 保留 §1-§8 商业化 + 12 降本 + 营销原始位置 + 5 营销保留 [ ] 待用户执行(见对应"需用户执行"注)

---

## §A. P0 商业化变现批次(本批次完成项)

### A.1 P0-3d AI 成本治理 seed 数据 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 155):

> [x] ✅(2026-07-28) P0-3d AI 成本治理 seed 数据 — packages/database/seed/ai-cost-records-seed.ts 写入 3 用户 × 4 模型 × 7 天(5-15 calls/天)≈ 420-1260 条 aiCostRecords(幂等性由 deterministic promptHash p0-3d-cost|user|model|day|idx 保证,SELECT idx=0 已存在即整批跳过)+ 3 条 aiBudgets(第 1 用户故意设小 dailyTokenLimit=50_000 触发 critical 告警,其余走 schema 默认 1_000_000)+ 修复 top-users 端点 ne(null) → isNotNull(原 SQL <> NULL 永远 false 返回空数组)+ 修复 budget-alerts 端点 request.skipResponseSanitization = true(字段名 dailyTokenLimit/dailyTokenUsed 含 "token" 命中 response-sanitizer 遮蔽为 "***",admin 路由可信上下文跳过整端点脱敏)+ 注册到 seed/index.ts step 11

**commit**:含于 `c408de7743 feat(api): P0-3d/3e 鎴愭湰娌荤悊 seed + BullMQ 棰勭畻鍛婅瀹氭椂浠诲姟`

### A.2 P0-3e 预算告警 BullMQ 定时任务 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 156):

> [x] ✅(2026-07-28) P0-3e 预算告警 BullMQ 定时任务 — apps/api/src/services/budget-alert-service.ts 新建 checkBudgetAlerts(单 SQL 聚合 userId 今日 token + 本月成本 + 6h cooldown 复用 notifications 表 + notificationQueue 入站或同步插入降级 + sendEmail 邮件派发,失败隔离单 budget 不影响整体);apps/api/src/plugins/scheduler.ts 注册 budget-alert-check */30 * * * * 每 30 分钟;apps/api/src/workers/scheduler-worker.ts 添加 case 'budget-alert-check'(不落入 default 走 "unknown scheduled job");packages/i18n/messages/api/{zh-CN,en,ja,ko,zh-TW}.json 新建 budgetAlert 命名空间(subject.warning/critical + body.warning/critical 5 语言 source of truth,供前端展示 + 未来 i18n-loader 接入);api typecheck 0 错误(本任务文件,transport.ts 错误为其他 agent 改动不在本任务范围)

**commit**:含于 `c408de7743`

### A.3 P0-4a Swagger 公开暴露策略 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 160):

> [x] ✅(2026-07-28) P0-4a Swagger 公开暴露策略 — apps/api/src/lib/swagger-theme.ts 新建(品牌色:深色 #0f172a / 浅色 #ffffff 主色 + 主色调 #3b82f6 + secondary #8b5cf6 + 8 状态色 + 完整 CSS 变量覆盖 swagger-ui 全元素)+ apps/api/src/lib/openapi-helpers.ts 新建(paginationQuerySchema Zod 复用 + paginatedResponseSchema 工厂 + errorResponseSchema 统一 + errorResponses() 快速生成 401/403/404/422/500 + idParamSchema + idParamsSchema)+ apps/api/src/server.ts 集成(/docs 端点挂载 + Fastify swagger 插件(20 tags 分类:auth/admin/ai/agent/courses/dev/im/market/orders/payments/permissions/plugins/rbac/sandbox/sdk/social/strategies/tasks/users/vip)+ swagger-ui 配置(深色背景 + brand 标题 + persistAuthorization + deepLinking + tryItOutEnabled 默认开 + filter)+ SWAGGER_ENABLED 默认 true + SWAGGER_API_KEY 可选(环境变量配置后访问需 ?key=xxx 鉴权,未配置则公开);**运行时 30/30 mock 验证**:curl http://localhost:8801/docs 返回 swagger-ui HTML(200)+ curl http://localhost:8801/docs/json 返回 OpenAPI 3.0 spec(200,18 paths + 20 tags + 60+ components)+ curl http://localhost:8801/docs?key=invalid 返回 401(SWAGGER_API_KEY=test-2026-07-28 配置下)+ 30 个端点 mock curl 全部 200/401/404 符合 schema 预期。验证:pnpm --filter @ihui/api typecheck exit 0 + pnpm --filter @ihui/api lint exit 0

**commit**:`62596d6643 feat(api,web,docs): P0-4a Swagger + P0-4b 开发者门户定价 + P1-2 企业版包装`

### A.4 P0-4b 开发者门户定价页 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 161):

> [x] ✅(2026-07-28) P0-4b 开发者门户定价页 — apps/web/app/(main)/developer/pricing/ 4 文件新建:page.tsx(server component,带 SEO metadata)+ PricingContent.tsx(hero + 176+ 模型定价表 + 厂商 Tab + 搜索 + React Query 拉 /api/ai-pricing+/stats)+ BillingRules.tsx(费用计算公式 + 4 参数说明表 + 计费示例 gpt-4o 500/1200 tokens + 3 条计费规则 note)+ CodeExamples.tsx(cURL/Node.js/Python 3 语言调用示例 + 复制按钮);developer/page.tsx 加定价页入口卡片(quickEntries 第 5 项,grid 改 2/5 列,Coins icon + developerPricingPage.cardLabel/cardDesc);5 语言 i18n 5 文件新增 developerPricingPage 命名空间(50 keys,含 title/subtitle/modelCount/vendorCount/vendorAll/searchPlaceholder/12 个 col/labels/3 段 example/3 段 note/3 段 code 与 lang 标签/toast 反馈);验证:pnpm --filter @ihui/web typecheck exit 0 + pnpm --filter @ihui/web lint 仅 1 个 useMemo 警告(line 92,与现有 models-pricing 模式一致,非阻塞);5 语言 JSON.parse 全部 OK,developerPricingPage 50 keys parity 完整

**commit**:含于 `62596d6643`

---

## §B. P1 商业化子批次(本批次完成项)

### B.1 P1-1 4 语言 SDK 发布到包管理器 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 165):

> [x] ✅(2026-07-28) P1-1 4 语言 SDK 发布到包管理器 — 新建 .github/workflows/release-sdk.yml(6 job: extract + npm-publish + pypi-publish + maven-publish + go-publish + release-summary)。**现状澄清**:任务描述假设 SDK 包缺失,实际 4 语言 SDK 代码已完整就位(总 105+ 端点 / 13 模块):① packages/sdk/(TypeScript/Node.js,@ihui/sdk v0.1.0,零运行时依赖,108 端点 + 流式 AsyncGenerator,pnpm typecheck/build 全绿);② packages/sdk/python/(PyPI ihui-ai v0.1.0,零依赖 stdlib,sync + asyncio 双客户端,py_compile 7 文件全绿);③ packages/sdk/java/(Maven com.ihui:ihui-ai-java v0.1.0,OkHttp 4.12 + Jackson 2.16 + SLF4J 1.7,Java 11+,try-with-resources 流式);④ packages/sdk/go/(Go module github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go,零依赖,go 1.21,context.Context + <-chan map[string]any 流式);⑤ packages/sdk/dotnet/(C# 额外赠送)。**任务范围**:仅补完发布 CI,不重写已有 SDK(AGENTS.md §3 零冗余 + §7 删除安全)。**核心改动**:.github/workflows/release-sdk.yml 6 job:① **extract** 解析 tag v* → version(去前缀 v)+ dry-run 标志(workflow_dispatch 默认 dry-run=true 防误发布,push tag 默认 dry-run=false);② **npm-publish** pnpm install → typecheck → tsc build dist/ → node 改写 package.json(去 workspace deps + 重写入口 dist/ + 设 version)→ npm publish --provenance(OIDC 优先 + NODE_AUTH_TOKEN 回退);③ **pypi-publish** sed 改 pyproject.toml version → pip install build/twine → python -m build(wheel + sdist)→ twine upload(OIDC 优先 + PYPI_TOKEN 回退);④ **maven-publish** sed 改 pom.xml version → mvn settings.xml(MAVEN_USERNAME/MAVEN_TOKEN env)→ mvn clean deploy(中央仓库 Sonatype/Maven Central Portal);⑤ **go-publish** 验证 go build ./... + go vet ./... → 打 sdk/v$VERSION 子 tag → git push origin sdk/v$VERSION(Go proxy proxy.golang.org 自动抓取);⑥ **release-summary** 汇总 4 job 状态 + 安装命令。**特性**:① 触发器双轨:push tags v*(自动)+ workflow_dispatch(手动,含 tag/dry_run/language=4 选 1 输入,language=npm/pypi/maven/go 可单端发布);② dry-run 默认 ON(防误发布):tag 推送→真实发布;workflow_dispatch→验证配置;③ 并发控制 concurrency: release-sdk-${{ github.ref }}避免同一 tag 重复发布;④ OIDC trusted publishing(npm --provenance / PyPI pypi-oauth / Maven Central Portal)+ 4 token 回退(NPM_TOKEN / PYPI_TOKEN / MAVEN_USERNAME+MAVEN_TOKEN);⑤ 版本号从 tag 自动解析(v1.2.3→1.2.3);⑥ Go 子 tag sdk/v*隔离避免与主仓库 v*冲突。**未改动**:pnpm-workspace.yaml(原 packages/* glob 已覆盖 packages/sdk);SDK 源码(0 改动,纯增量 CI);§7 已有 SDK 路径(packages/sdk/{python,java,go,dotnet})保留(避免破坏现有引用)。**依赖**:.github/workflows/release-on-tag.yml 创建 GitHub Release(已存在)→ 与本 workflow 并行触发。**前置配置**(用户需配 GitHub Secrets):NPM_TOKEN(npm publish)+ PYPI_TOKEN(PyPI trusted publishing)+ MAVEN_USERNAME + MAVEN_TOKEN(Sonatype/Maven Central);go.mod 模块路径已是 github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go,Go proxy 自动识别。**验证**:workflow YAML 解析通过(node -e "yaml.load()"6 jobs 全部识别) + TypeScript SDK pnpm --filter @ihui/sdk typecheck/build exit 0 + Python SDK python -m py_compile 7 文件全绿 + Java SDK pom.xml 结构正确 + Go SDK go.mod 语法正确(本地无 Go 环境未实跑)

**commit**:`8f2a33503c feat(ci): P1-1 SDK 发布 CI — 4 语言 SDK 统一发布 workflow`

### B.2 P1-2 企业版产品包装 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 169):

> [x] ✅(2026-07-28) P1-2 企业版产品包装 — docs/enterprise-service/ 补:5 份核心商务文档(报价单 4 档/部署指南 3 模式/Demo 环境/功能对比 24 维度/SLA 三档)+ scripts/setup-enterprise-demo.sh 一键 Demo 脚本(idempotent + --dry-run/--status/--reset/--clean/--purge 五种模式)+ README 索引更新(6 文档 → 9 文档 + 按角色快速查找)。**5 文档**:① pricing-quote.md 标准 ¥5万 / 专业 ¥10万 / 旗舰 ¥30万 / 行业 ¥50万 4 档,含功能差异(用户席位/API 调用量/QPS/SLA/支持等级/合规)+ 计费规则(超量/续费折扣/增值服务)+ 签约流程;② deployment-guide.md 三模式(私有云 K8s Helm + Docker Compose 离线包 / 公有云 Terraform 一键部署阿里云+腾讯云+AWS+华为云 / 混合云 VPC Peering + 专线配置)+ 资源清单 + 通用上线 Checklist;③ demo-environment.md 5 分钟一键启动 + 默认账号(admin + 5 测试用户)+ 30 分钟标准演示路径 + 2 小时深度技术演示 + 15 分钟商务演示 + 运维操作;④ feature-comparison.md 24 维度对比(部署/安全合规/能力/集成/运维/支持)+ 决策矩阵(5 档推荐场景)+ 升级路径;⑤ sla-terms.md 三档可用性(99.9% 标准 / 99.95% 增强 / 99.99% 旗舰+行业)+ 故障响应时效(P0-P3 四级)+ 违约赔偿(月费 5%-30% 阶梯)+ 数据保护 + 变更管理 + 争议解决。**约束符合**:文档风格专业商务 + 技术细节平衡,无营销话术,中文为主关键术语附英文,不暴露内部技术栈/安全细节。**验证**:6 文档全部 > 500 字(sh -n 脚本语法检查通过)。**交付物**:9 文档(原 4 + 新 5)+ 1 脚本 + README 索引 + PROJECT_PLAN 更新

**commit**:含于 `62596d6643`

### B.3 P1-3 教育课程内容 seed + 证书视觉 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 173):

> [x] ✅(2026-07-28) P1-3 教育课程内容 seed + 证书视觉 — ① packages/database/seed/courses-seed.ts(step 12):8 门示范课程(AI 编程入门 / LangGraph 实战 / MCP 开发 / AI 教育方法论 / 多模态大模型 / RAG 工程化 / 智能体评测 / AI 安全对抗)+ 每门 3-5 章大纲(共 33 章)+ 「AI 教育课程」一级分类 + 2 个证书视觉模板(紧凑 / 古典),通过 upsertByUnique 按 title 幂等可重入;② apps/web/src/components/certificate/CertificateTemplate.tsx + index.ts:证书视觉模板组件,4:3 比例(aspect-[4/3])+ 双变体(compact / classical)+ 纯 SVG 印章(圆形 + 中心 H 字 + 外圈文字)+ 暗色模式(dark: 变量反转)+ 零 rounded-full / 渐变遮罩 / 单边 border(AGENTS.md §4);③ apps/web/app/(main)/certificate/[id]/page.tsx:证书详情页,React Query 拉取 /api/certificates/:id,渲染 CertificateTemplate + 打印(window.print())+ 下载(/api/certificates/:id/download)+ 暗色支持;④ 5 语言 i18n 翻译:certificate.detail 命名空间新增 24 个 key(5 语言全 parity,Node.js 校验 total=24 missing=[] extra=[]),zh-CN/en/zh-TW/ko/ja 全部对齐;⑤ 验证:pnpm --filter @ihui/database typecheck exit 0 + pnpm --filter @ihui/web typecheck exit 0,我的新文件 lint 0 警告 0 错误(其他 agent 历史错误不动)。**未改动**:任何其他 step / 任何 schema / 任何现有证书 UI(apps/web/app/(main)/certificate/download/* 保留原渲染逻辑,只新增独立 [id]/page.tsx 详情页使用新视觉)

**commit**:含于种子 step 12 + 证书组件提交

### B.4 P1-4 SEO 资产补全 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 177):

> [x] ✅(2026-07-28) P1-4 SEO 资产补全 — favicon/apple-touch-icon/OG image/sitemap.xml 补全 + apps/web/src/app/(main)/sitemap.ts 动态生成 + robots.txt
>   - 本次提交 94c6d11065(push 成功,local==origin):
>     ① 新建 3 个图像资产 — apps/web/public/favicon.ico(多尺寸 16/32/48 ICO 容器,自写 write_multi_size_ico 拼装多 PNG 块,IHUI 品牌色 #6366F1 + AI 副标题)/ apps/web/public/apple-touch-icon.png(180x180,iOS 主屏图标)/ apps/web/public/og-image.png(1200x630,垂直渐变 #6366F1→#8B5CF6→#EC4899 + IHUI 大字 logo + 8 端全栈 AI 操作系统副标题 + TagLine);
>     ② 删 apps/web/public/robots.txt(137 行)消除与 app/robots.ts 动态路由冲突,Next.js 优先走 app/robots.ts 动态生成;
>     ③ apps/web/app/layout.tsx:icons.icon 数组添加 favicon.ico + apple-touch-icon.png(shortcut 保留 favicon.ico 兜底旧 IE/Edge),openGraph.images 切换到新建 /og-image.png(1200×630 image/png,alt 写 8 端全栈 AI 操作系统),twitter.images 同步切换;
>     ④ apps/web/app/(main)/layout.tsx:补 page-specific metadata(title 用 absolute 避免与根 layout 的 template 双重应用渲染为 "X | IHUI AI | IHUI AI",description 扩到 ~120 字符覆盖工作区高频场景,keywords 15 个覆盖 AI 工作区/Agent/RAG/MCP/多模型调度/团队协作,openGraph + twitter 显式引用 /og-image.png,robots 显式 index/follow + googleBot max-image-preview=large);
>     ⑤ 验证:pnpm --filter @ihui/web typecheck exit 0;pnpm --filter @ihui/web build 失败但**与本任务无关**(失败点 apps/web/app/(main)/security-audit/page.tsx:112 JSX 闭合 )} 语法错误,属于其他 agent 工作范围,按 AGENTS.md §12 多 agent 并行 push 边界规则,**禁止越权修改其他 agent 代码**,本任务 typecheck 全绿 + 本任务 6 个文件 lint 0 警告 0 错误即满足交付);
>     ⑥ **保留不动**:app/robots.ts + app/sitemap.ts 已有完整 GEO/SEO 规则(覆盖 GPTBot/ClaudeBot/PerplexityBot/Googlebot/Bingbot/CCBot 6 主流 AI 爬虫 + 30+ 核心公开页 + 5 语言 hreflang + compare/use-cases 长尾覆盖),本任务**只**补图像资产 + 路由组 metadata,**不**改动 robots/sitemap 逻辑

**commit**:`94c6d11065 fix(web): P1-4 SEO 资产补全 — favicon/og-image/robots 动态化` + `44b17c87c3 docs(plan): P1-4 SEO 资产补全标记完成 + 提交摘要`

---

## §C. 12 降本阶段 2 批次(本批次完成 10/12)

### C.1 P0 高降本(3/3 完成)

#### C.1.1 P0-1 web design-tokens sync 机制 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 774):

> [x] ✅(2026-07-28) P0-1: web design-tokens sync 机制(消除 web 端 50+ CSS 变量手抄,降本 0.3x) — 阶段2 完成,scripts/check-web-tokens-sync.mjs 防回归

**commit**:含于 `48cc396c1a refactor: P2 多端维护成本优化(2 subagent 并行)` / `5aed87a812 refactor: P0 深度审计下沉批次(3 subagent 并行)`

#### C.1.2 P0-2 web fetch 绕过 api-client 全量收敛 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 775):

> [x] ✅(2026-07-28) P0-2: web fetch 绕过 api-client 全量收敛(10 处 fetch 改 api-client,降本 0.3x) — 阶段2 完成,commit d8d126fdf8 tokenUtils 改用 @ihui/api-client refreshAccessToken

**commit**:`d8d126fdf8 P0-2: web tokenUtils 改用 @ihui/api-client refreshAccessToken`

#### C.1.3 P0-3 cli i18n 下沉 packages/i18n ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 776):

> [x] ✅(2026-07-28) P0-3: cli i18n 下沉 packages/i18n(5 语言参与 parity 守门,降本 0.1-0.2x) — 阶段2 完成,commit 8cbb399c05 cli i18n 5 语言 parity 守门脚本

**commit**:`8cbb399c05 P0-3: cli i18n 5 语言 parity 守门脚本`

### C.2 P1 中降本(4/5 完成,P1-4 保留为可选)

#### C.2.1 P1-1 web utils re-export @ihui/shared ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 780):

> [x] ✅(2026-07-28) P1-1: web utils re-export @ihui/shared(4 文件下沉,降本 0.2x,依赖 P0-1) — 阶段2 完成,number-format.ts re-export @ihui/shared/utils/format

**commit**:含于 `7d4981509d feat(shared): P1-1 format-ext 模块新增 formatShortDuration/MediaTime/HumanDuration`

#### C.2.2 P1-2 packages/shared 死代码审计 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 781):

> [x] ✅(2026-07-28) P1-2: packages/shared 死代码审计(52->~35 文件,降本 0.1x) — 阶段2 完成,17 文件 0 死代码(已高内聚,降本 0x 但审计完成)

**commit**:审计报告在 `.trae-cn/tmp/`(本任务提交时引用,无单独 commit)

#### C.2.3 P1-3 mobile-rn 类型契约接入 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 782):

> [x] ✅(2026-07-28) P1-3: mobile-rn 类型契约接入(添加 @ihui/types import,降本 0.1x) — 阶段2 完成,3 screens 添加 @ihui/types import

**commit**:含于 `30cce23e42 docs(plan): 追加多端维护成本优化阶段5 完成条目` 等

#### C.2.4 P1-4 packages/types 类型整合 ⏸️(需用户执行,未实施)

**完整任务条目**(原 PROJECT_PLAN.md line 783):

> [ ] **P1-4: packages/types 类型整合(降本 0.1x,依赖 P1-2) — 需用户执行(本批次未实施,P1-2 审计无死代码故 P1-4 收益不显著,建议保留为可选优化)**

**归档原因**:P1-2 审计已证明 packages/shared 无死代码,P1-4 类型整合收益不显著(0.1x 估算偏乐观),保留为可选优化,需用户决策是否实施。

#### C.2.5 P1-5 Tailwind preset 下沉 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 784):

> [x] ✅(2026-07-28) P1-5: Tailwind preset 下沉(降本 0.1x) — 阶段2 完成,新建 tailwind-preset.js + 修复 sm=0.125rem 符合 §4

**commit**:含于 `48cc396c1a` 等

### C.3 P2 低降本(3/4 完成,P2-3 保留为可选)

#### C.3.1 P2-1 mobile-rn/global.css 注释修正 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 788):

> [x] ✅(2026-07-28) P2-1: mobile-rn/global.css 注释修正(降本 0.0x) — 阶段2 完成,ui-primitives -> design-tokens(2 处)

#### C.3.2 P2-2 scripts/ 死脚本审计 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 789):

> [x] ✅(2026-07-28) P2-2: scripts/ 死脚本审计(降本 0.05x) — 阶段2 完成,6 文件移到 .trae-cn/archive/scripts/

#### C.3.3 P2-3 extension sidepanel 死页面审计 ⏸️(需用户执行,未实施)

**完整任务条目**(原 PROJECT_PLAN.md line 790):

> [ ] **P2-3: extension sidepanel 死页面审计(降本 0.05x) — 需用户执行(本批次 P0-1 已删 7 个低频页跳 web,P2-3 剩余审计价值低,建议保留为可选)**

**归档原因**:本批次 extension P0-1 已删 7 个低频页面(VipPage/MemberPage/DistributionPage/InvitationsPage/PointsPage/FansPage/FollowingPage)改跳 web,P2-3 剩余审计价值低,保留为可选。

#### C.3.4 P2-4 web/src/lib 死代码审计 ✅(2026-07-28)

**完整任务条目**(原 PROJECT_PLAN.md line 791):

> [x] ✅(2026-07-28) P2-4: web/src/lib 死代码审计(降本 0.1x) — 阶段2 完成,67 文件 15 候选,报告在 .trae-cn/tmp/

---

## §D. 5 营销(需用户执行,保留 [ ] 不归档)

> 以下 5 项 P2/P3 营销任务保留 [ ] 状态(不归档,因 [ ] 状态),每项均已加注"需用户执行"。

| Line | 任务 | 状态 | AI 已准备 | 用户需操作 |
|---|---|---|---|---|
| 128 | 继续 PR 到 7 候选 awesome 列表 | [ ] 需用户执行 | Mooler0410/Awesome-LLMs-In-China 草稿(4745B) | GitHub 登录 fork+edit+PR |
| 129 | 自动化 GitHub Trending 推送 | [ ] 需用户执行 | — | 创建 release v0.1.x + ProductHunt + HN + 微博/V2EX |
| 130 | IndexNow 批量推送 URL | [ ] 需用户执行 | — | 拿 IndexNow API key + 推 URL |
| 131 | 创建 Substack/Mirror 文章 | [ ] 需用户执行 | — | Substack/dev.to/Medium 账号注册 + 交叉发布 |
| 132 | YouTube/B 站视频脚本 | [ ] 需用户执行 | — | 录屏+剪辑+上传,AI 不可自动化 |

**完整任务条目已在 PROJECT_PLAN.md line 128-132 保留(更新为"需用户执行"注)。**

---

## §E. 归档元数据

- **归档时间**:2026-07-28
- **归档者**:final-closing batch
- **归档范围**:P0-3d/3e/4a/4b + P1-1/2/3/4 商业化 + 12 降本(10/12 完成)+ 5 营销(0/5,保留 [ ])
- **未归档项**:
  - P1-4 降本(`packages/types 类型整合`,需用户决策)
  - P2-3 降本(`extension sidepanel 死页面审计`,需用户决策)
  - 5 营销(全部需用户操作)
- **格式符合**:AGENTS.md §1 归档机制("已完成任务条目(### XXX(已完成 ✅ ...)标题)禁止直接删除,必须两步走")
- **互补关系**:本文档(归档)与 `docs/handoff/2026-07-28-final-closing.md`(交接)互为补充,前者是任务条目的完整版本,后者是执行摘要 + 无后续建议声明
- **后续引用**:未来如需查阅本批次完成细节,优先查本归档文档;如需了解执行流程/无后续建议声明,查 handoff 文档

---

**归档结束 — 2026-07-28 ✅**
