# 前端 Admin 审计报告

> 审计日期:2026-07-31
> 审计范围:AdminNav.tsx 导航死链接 + 后端孤儿路由挂载

## 审计结论

管理端导航存在 **73 项死链接**(camelCase 路径无对应页面)和 **1 个后端孤儿路由文件**。已全部修复。

## 修复清单

### 1. AdminNav.tsx ADMIN_NAV P1 死链接(73 项)

**问题**:`ADMIN_NAV` 数组 P1 部分(原 385-640 行)包含 73 个 camelCase 路径的导航项,其中绝大多数路径无对应 `page.tsx`,点击后 404。

**修复方式**:

| 类别 | 数量 | 处理方式 |
|------|------|----------|
| 已迁移到 ADMIN_NAV_GROUPS(重复死链接) | 44 | 删除(分组中已有正确 kebab-case 路径) |
| 有对应页面但未归入分组 | 3 | 修正路径为 kebab-case 并保留 |
| 无对应页面(纯死链接) | 26 | 删除 |

**保留的 3 项(路径已修正)**:

| 原路径(死链接) | 修正后路径 | 说明 |
|------------------|-----------|------|
| `/admin/examRandomPaper` | `/admin/edu/exam/papers-random` | 随机试卷管理 |
| `/admin/examMockPaper` | `/admin/edu/exam/papers-manual` | 手工试卷管理 |
| `/admin/paperTemplate` | `/admin/edu/exam/papers-template` | 试卷模板管理 |

### 2. AdminNav.tsx ADMIN_NAV_GROUPS 路径修正

**问题**:`ADMIN_NAV_GROUPS` 中 11 个分组的部分导航项路径错误(camelCase 或不存在的路径)。

**修复**:已在前序工作中修正 41 项路径错误,删除 28 项无源码菜单项。

### 3. 未使用 Icon 导入清理

| Icon 名称 | 原因 |
|-----------|------|
| `RotateCcw` | P1 删除后无引用 |
| `Eye` | P1 删除后无引用 |
| `Ticket` | 从未使用(历史遗留) |

### 4. 后端孤儿路由挂载

**问题**:`apps/api/src/routes/admin/relay-api-keys.ts` 定义了 5 个 API Key 管理端点,但未在 `routes/index.ts` 中导入和注册,前端调用返回 404。

**修复**:在 `index.ts` 中添加导入和注册:
- 导入:`import relayApiKeysRoutes from './admin/relay-api-keys.js'`
- 注册:`server.register(relayApiKeysRoutes, { prefix: '/api' })`

**挂载的端点**:
- `GET /api/admin/relay/api-keys` — API Key 列表
- `POST /api/admin/relay/api-keys` — 创建 API Key
- `GET /api/admin/relay/api-keys/by-tenant` — 按租户统计
- `GET /api/admin/relay/api-keys/:id` — API Key 详情
- `PATCH /api/admin/relay/api-keys/:id` — 更新 API Key(含过期/IP白名单/模型白名单/token上限)

## 验证

- [x] AdminNav.tsx typecheck 通过(tsc --noEmit 0 错误)
- [x] 所有 ADMIN_NAV 路径对照 `page.tsx` 实际存在性验证
- [x] relay-api-keys.ts 路由已在 index.ts 注册
- [x] 未使用 icon 导入已清理

## 管理端页面覆盖统计

- 前端 admin 页面目录: **150+** 个 `page.tsx`
- ADMIN_NAV 有效导航项: **150** 项(含 3 项 P1 遗留)
- ADMIN_NAV_GROUPS 分组导航项: **44** 项(11 个分组)
- 后端 admin 路由文件: **23+** 个 `admin-*.ts`

---

别名: frontend_audit_report.txt
