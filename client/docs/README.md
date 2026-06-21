# 前端文档索引

> 这里放的是前端（Vue 3 + Vite + TypeScript）相关的文档。
> 后端文档在 `../../server/docs/`，项目级总文档在 `../../docs/`。

---

## 核心文档（先看这些）

| 文档 | 说明 |
|------|------|
| [PROJECT-ARCHITECTURE.md](./PROJECT-ARCHITECTURE.md) | 前端项目架构总览：技术栈、目录结构、多端构建方案 |
| [DEV_PORTS.md](./DEV_PORTS.md) | 开发端口约定：前端 8888、后端 8000，别用错了 |
| [OPEN_PLATFORM_README.md](./OPEN_PLATFORM_README.md) | 开放平台说明：对外售卖的 API、SDK、模型怎么组织 |
| [OPEN_PLATFORM_API_AND_INTEGRATION.md](./OPEN_PLATFORM_API_AND_INTEGRATION.md) | 开放平台 API 对接细节：环境变量、路径、前后端职责划分 |

## 样式规范（`style/` 目录）

> 所有跟界面样式、颜色、字体、设计令牌相关的文档都在这里。

| 文档 | 说明 |
|------|------|
| [STYLE_QUICK_REFERENCE.md](./style/STYLE_QUICK_REFERENCE.md) | 样式速查表：常用样式怎么写一眼就懂 |
| [STYLE_DESIGN_TOKENS.md](./style/STYLE_DESIGN_TOKENS.md) | 设计令牌：颜色、间距、字号的全局变量定义 |
| [STYLE_MAINTENANCE_GUIDE.md](./style/STYLE_MAINTENANCE_GUIDE.md) | 样式维护指南：改样式时要注意什么 |
| [STYLE_MIGRATION_GUIDE.md](./style/STYLE_MIGRATION_GUIDE.md) | 样式迁移指南：老代码怎么改成新规范 |
| [STYLE_OPTIMIZATION_REPORT.md](./style/STYLE_OPTIMIZATION_REPORT.md) | 样式优化报告：之前做过哪些优化 |
| [STYLE_OPTIMIZATION_PLAN.md](./style/STYLE_OPTIMIZATION_PLAN.md) | 样式优化计划：接下来还要优化什么 |
| [STYLE_PERFORMANCE_GUIDE.md](./style/STYLE_PERFORMANCE_GUIDE.md) | 样式性能指南：怎么写样式不卡 |
| [TEXT_STYLES_OVERVIEW.md](./style/TEXT_STYLES_OVERVIEW.md) | 文字样式总览：标题、正文、按钮文字的规范 |
| [design.md](./style/design.md) | 设计稿说明 |
| [design-audit-report.md](./style/design-audit-report.md) | 设计审计报告 |
| [token-docs.md](./style/token-docs.md) | 令牌文档补充说明 |
| [css-variables-guide.md](./style/css-variables-guide.md) | CSS 变量使用指南 |
| [brand-naming-guide.md](./style/brand-naming-guide.md) | 品牌命名规范 |
| [hardcoded-colors-audit.md](./style/hardcoded-colors-audit.md) | 硬编码颜色审计：哪些地方写了死颜色要改 |
| [IMPORTANT_AND_SPECIFICITY_AUDIT.md](./style/IMPORTANT_AND_SPECIFICITY_AUDIT.md) | !important 和高特异性审计：哪些地方违规了 |

## 安全文档（`security/` 目录）

| 文档 | 说明 |
|------|------|
| [SECURITY_CHECKLIST.md](./security/SECURITY_CHECKLIST.md) | 安全检查清单：v-html、CSP、登录会话要查什么 |
| [SECURITY_API_GUIDE.md](./security/SECURITY_API_GUIDE.md) | API 安全指南：接口怎么调才安全 |
| [SECURITY_SERVICES.md](./security/SECURITY_SERVICES.md) | 安全服务说明：用了哪些安全手段 |

## 计划文档（`plans/` 目录）

| 文档 | 说明 |
|------|------|
| [2026-06-10-miniapp-monorepo-migration.md](./plans/2026-06-10-miniapp-monorepo-migration.md) | 小程序 monorepo 迁移计划 |

## 历史归档（`archive/` 目录）

> 这些是之前做升级、审计时留下的记录，留作参考，日常开发不用看。

- `AUDIT_STORYBOOK_10_UPGRADE.md` — Storybook 10 升级审计
- `AUDIT_VITE_8_UPGRADE.md` — Vite 8 升级审计
- `AUDIT_VITE_VUE_UPGRADE.md` — Vite + Vue 升级审计
- `BACKLOG_ONE_MONTH.md` — 一个月待办汇总
- `REACT_GRAB_README.md` — React 抓取工具说明
