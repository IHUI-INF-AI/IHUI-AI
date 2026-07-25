/**
 * 用户端路由补建 barrel(原 missing-user-routes.ts 拆分到 user/ 子目录)。
 *
 * 拆分原则:
 * - 按业务域拆分到 user/ 子目录,每文件单一业务域。
 * - 所有路由保留原始 method + path(API URL 0 改动)。
 * - authenticate preHandler 由 user/index.ts 统一挂载,所有子路由继承。
 * - 响应格式 { code, message, data } 不变。
 *
 * server.ts 仍通过本文件 import,注册时带 prefix: '/api'。
 *
 * ---------------------------------------------------------------------------
 * 2026-07-26 任务清单过时说明(P0-3 stub 真实化评估):
 * ---------------------------------------------------------------------------
 * 原任务清单列的 7 个 stub 文件中,本文件 + admin-missing-routes.ts 是仅存
 * 的 2 个,其余 5 个(frontend-stub-admin/ai/edu/other-routes.ts、legacy-
 * completion.ts)已被拆分/改名/全部实现真实 CRUD:
 *   - frontend-stub-admin-routes.ts  → admin-extended/ 目录(15 子路由,真实 CRUD)
 *   - frontend-stub-ai-routes.ts     → ai-frontend-routes.ts(真实 CRUD + LLM/MCP 代理)
 *   - frontend-stub-edu-routes.ts    → edu-frontend-routes.ts(真实 CRUD + PDF 生成)
 *   - frontend-stub-other-routes.ts  → other/ 目录(25 子路由,真实 CRUD)
 *   - legacy-completion.ts           → 9 个 legacy-*.ts 文件(真实查询)
 *
 * 本文件原 54 个空数据桩已全部迁移到 user/ 子目录(22 个业务域子路由),
 * 且绝大部分已实现真实 CRUD(接入 packages/database 现有 pgTable)。
 * 残余"空数据桩"集中在 miniapp-compat-routes.ts(49 个,小程序兼容桩)+
 * miniapp-public-fallback-routes.ts(4 个,公开 fallback)+ admin-support-
 * tickets.ts(3 个,待 support_tickets 表),均不在本任务受影响文件清单,
 * 故本 barrel 不再追加路由定义(保留 barrel 设计原则,避免破坏 user/ 子目录拆分)。
 *
 * 已识别技术债(后续迭代补全):
 *   - D 盘原端点 /public-api/news/recommend、/public-api/news/top/list 在 G 盘
 *     不存在;G 盘 news.ts 已实现 findNewsRecommendList / findNewsTopList 真实
 *     查询,路径为 /api/news/recommend、/api/news/top(非 /public-api/* 前缀)。
 *   - 如需对齐 D 盘 /public-api/* 路径,应在 routes/news.ts 内追加别名路由,
 *     不在本 barrel 范围(受影响清单禁止修改 news.ts)。
 */
export { missingUserRoutes } from './user/index.js'
