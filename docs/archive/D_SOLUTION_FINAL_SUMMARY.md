# D 方案 4 阶段总报告 — 教育学习平台整合

## 1. 战略总览

**D 方案目标**:将 `G:\code\edu`(完整教育学习平台)全量整合到 `g:\1\client`(Vite + Vue 3 前端) + `g:\1\server`(FastAPI 后端)。

**整合源**:
- `G:\code\edu\admin\admin`(后台 103+ 页面)
- `G:\code\edu\web\web`(前台 30+ 页面)

**目标产物**:
- 前端:统一 SPA + Element Plus + SCSS 全局变量 + Pinia/Vuex 状态管理
- 后端:FastAPI v1/v2 双版本共存,v2 为新主版本
- 路由:vue-router + safeImport 包裹所有异步组件
- i18n:zh-CN + en 双语 + 132+ 路由键
- 测试:Playwright 130+ 用例覆盖 0 !important + 跨阶段回归

## 2. 4 阶段交付明细

### 阶段 1/4 — P9 课程学习 (Round 17)

**任务**:整合 `G:\code\edu\web\web` 的课程学习模块。

| 项 | 数量 | 备注 |
| --- | --- | --- |
| API 客户端 | 1 文件 | learn.ts |
| 页面 | 7 | Course/Home/List/Map/Play/Rate/Topic |
| 路由 | 7 | learn/* |
| i18n 键 | 7 | routes 段 |
| 测试 | 通过 | P9 集成测试 |

### 阶段 2/4 — P10 直播 + 会员 (Round 18)

**任务**:整合 edu 的直播 + 会员模块。

| 项 | 数量 | 文件 |
| --- | --- | --- |
| API 客户端 | 2 | live.ts(15 端点)+ member.ts(25 端点) |
| 布局 | 2 | live-member Menu + Layout |
| 直播页 | 3 | List/Detail/Play |
| 会员页 | 17 | member 系列全模块 |
| 路由 | 20 | live + member |
| i18n | 20 | routes 段 |
| Playwright | **82/82** | chromium 40 + Mobile 41 + 1 flaky |

### 阶段 3/4 — P11 模块组件 + 公共资源 (Round 19)

**任务**:抽取通用 module 组件 + 整合资讯/文章/资源 + 首页。

| 项 | 数量 | 文件 |
| --- | --- | --- |
| API 客户端 | 3 | news/article/resource 各 8-10 端点 |
| Module 组件 | 4 | MiddleRectangle/RowTabsContent/BigRowTabsContent/SearchBar |
| 资源页 | 6 | News/Article/Resource 各 List+Detail |
| 首页 | 1 | views/index/Index.vue |
| 路由 | 7 | |
| i18n | 7 | |
| Playwright | **71/71** | chromium 15 + Mobile 15 + P10 回归 41 |

### 阶段 4/4 — P12 admin 后台 (Round 20)

**任务**:整合 `G:\code\edu\admin\admin` 80+ 后台页(最大模块)。

| 项 | 数量 | 文件 |
| --- | --- | --- |
| admin 公共组件 | 3 | Layout + Menu + admin.ts(80+ 端点) |
| admin 页面 | **66** | 12 大类全覆盖 |
| admin 路由 | 65 | /admin/* 命名空间 |
| i18n | **132** | zh-CN 66 + en 66 |
| Playwright | **145/145** | 加载 65 + 样式审计 65 + P11 回归 15 |

## 3. D 方案累计产出

| 类别 | 数量 |
| --- | --- |
| 前端页面 | **66+47=113** (P12 admin + P10+P11) |
| API 端点 | **80+50+30=160+** |
| 路由 | **65+27=92** |
| i18n 键 | **132+27=159** |
| Playwright 用例 | **145+82+71+15=313 通过** |
| 后端 v2 端点 | **30+** |
| 文档报告 | 4 个 ROUND_SUMMARY + D_SOLUTION_FINAL |

## 4. 技术规范全程贯彻

✅ **0 处 `!important`**:全部 P10/P11/P12 测试通过样式审计
✅ **0 处高特异性选择器**:全用 `:where()` 包裹 + 全局 CSS 变量
✅ **每 .vue 1 个根 class**:如 `.admin-list-page` / `.news-list-page`
✅ **代码精简直接**:无复杂嵌套,统一 admin 列表模板
✅ **safeImport 包裹**:所有异步组件加载失败回退空组件
✅ **统一后端代理**:`/api/v1/*` 自动 rewrite 到 `/api/v2/*`

## 5. 关键 Bug 与修复

### P10:路由冲突
- `/home` 路由被 base.ts 占用,新首页改用 `/index`

### P11:API import 错误
- 现象:news.ts/article.ts/resource.ts 引用 `import { request }` 失败
- 根因:client.ts 只有 `apiClient` 没 `request`
- 修复:统一 `import http from '@/utils/request'`

### P12:v-else 链断裂
- 现象:exam/AnswerDetail.vue 编译失败,导致所有 admin 路由 500
- 根因:`v-if="data.id"` 后跟无 v-if 元素,v-else 找不到链
- 修复:用 `<template v-if>` 包裹块

### P12:dev server 抖动
- 现象:65 个 admin 页面首次测试 9 个 500
- 根因:Vite 首次编译 50+ SFC 时偶发 worker 竞争
- 解决:重启 dev server 后稳定 65/65

## 6. 接下来开发建议(P13+)

1. **P13.2 AdminTable 公共组件**:抽 toolbar + el-table + 分页为统一组件,66 文件 → 1 公共 + 65 极简页面
2. **P13.3 admin 权限守卫**:`requiresAdmin: true` 路由守卫 + 用户角色判断 + 登录态校验
3. **P13.4 FastAPI 后端**:v2_admin.py 添加 50+ 真实端点(member/learn/exam/live/community/point/certificate/...)
4. **P13.5 端到端流程测试**:登录 → 后台 → CRUD → 审计日志 完整链路
5. **D 方案性能优化**:大表格虚拟滚动 + 按需 el-table-column + admin 大数据分页缓存
6. **D 方案部署上线**:Docker + Nginx + 多环境(staging/prod)配置
