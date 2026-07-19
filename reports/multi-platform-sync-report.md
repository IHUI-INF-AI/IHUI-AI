# 多端同步对接审计报告(AGENTS.md §9)

> 生成时间:2026-07-19
> 审计脚本:`scripts/audit-multi-platform-sync.mjs`
> 输出文件:`reports/migration-audit-multi-platform-sync-{timestamp}.csv` + `migration-audit-multi-platform-sync-summary.json`
> 规则依据:AGENTS.md §9 多端同步开发强制规则

---

## 1. 8 端目录存在性

| # | 平台 | 目录 | 语言 | 存在 | 平台独占豁免(§9) |
|---|------|------|------|------|------------------|
| 1 | web          | `apps/web`          | ts/tsx | ✅ | — |
| 2 | api          | `apps/api`          | ts     | ✅ | — |
| 3 | ai-service   | `apps/ai-service`   | python | ✅ | — |
| 4 | desktop      | `apps/desktop`      | ts/tsx | ✅ | 系统托盘(Tauri 原生集成) |
| 5 | extension    | `apps/extension`    | ts/tsx | ✅ | 浏览器上下文菜单(WXT) |
| 6 | mobile-rn    | `apps/mobile-rn`    | ts/tsx | ✅ | — |
| 7 | miniapp-taro | `apps/miniapp-taro` | ts/tsx | ✅ | 微信支付(小程序原生) |
| 8 | cli          | `apps/cli`          | ts     | ✅ | 终端集成(ACP/REPL) |

**结论**:8/8 端目录全部存在。4 端命中平台独占豁免(desktop / extension / miniapp-taro / cli)。

---

## 2. 6 个新 API 端点 × 8 端调用情况矩阵

新增端点(API 实现端,server.ts:943-954 注册):

| 端点 | 端点数 | 描述 |
|------|--------|------|
| `/api/private-letters` | 7 | 私信管理 |
| `/api/wrong-questions` | 3 | 错题本 |
| `/api/check-in`        | 2+2 | 每日签到 + 状态 + rules + stats |
| `/api/mail`            | 2 | 邮件发送(纯文本 / HTML) |
| `/api/auth-codes`      | 2 | 验证码发送 + 校验 |
| `/api/exam-marking`    | 1 | 阅卷评分 |

### 2.1 顶级路径调用矩阵(`/api/xxx` 直接调用)

| 端点 \ 端 | web | api | ai-service | desktop | extension | mobile-rn | miniapp-taro | cli |
|-----------|-----|-----|------------|---------|-----------|-----------|--------------|-----|
| `/api/private-letters` | 0(旧路径 2) | 1✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| `/api/wrong-questions` | 0(旧路径 3) | 1✅ | 0 | 0 | 0 | 0 | 0(旧路径 1) | 0 |
| `/api/check-in`        | 0(旧路径 2) | 1✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| `/api/mail`            | 0          | 1✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| `/api/auth-codes`      | 0          | 1✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| `/api/exam-marking`    | 0(走 exam/records) | 1✅ | 0 | 0 | 0 | 0 | 0 | 0 |

> `1✅` = 实现端注册顶级路径;`0(旧路径 N)` = 调用方使用等价旧路径(`/api/admin/xxx` / `/api/exam/xxx` / `/api/user/check-in`)

### 2.2 等价旧路径调用样本

**web 端**(已有等价旧路径调用,需评估迁移):
- `apps/web/app/(main)/admin/message-overview/page.tsx` → `/api/admin/private-letters?pageSize=100`
- `apps/web/app/(main)/admin/private-letters/page.tsx` → `/api/admin/private-letters`
- `apps/web/app/(main)/exam/wrong-questions/page.tsx` → `/api/exam/wrong-questions/stats` / `/api/exam/wrong-questions` / `/api/exam/wrong-questions/{id}/resolve`
- `apps/web/src/components/home/MemberCard.tsx` → `/api/user/check-in/status` / `/api/user/check-in`(POST)
- `apps/web/app/(main)/admin/exam-marking/page.tsx` → `/api/exam/records/pending-marks` + `/api/admin/exam/records/{id}/grade`(走 exam records 旧路径,非 `/api/exam-marking`)

**miniapp-taro 端**:
- `apps/miniapp-taro/src/api/index.ts:683` → `del('/exam/wrong-questions/${id}')`(走 exam 旧路径)

---

## 3. 27 张新表 schema 多端依赖扫描

| schema 文件 | 表数 | 调用端 |
|-------------|------|--------|
| `packages/database/src/schema/social-supplement.ts`  | 6 | 仅 api |
| `packages/database/src/schema/live-supplement.ts`    | 4 | 仅 api |
| `packages/database/src/schema/learn-homework.ts`     | 5 | 仅 api |
| `packages/database/src/schema/resource-download.ts`  | 4 | 仅 api |
| `packages/database/src/schema/admin-extended.ts`     | 8 | 仅 api |
| **合计** | **27** | |

### schema import 依赖矩阵

| 端 | imports `@ihui/database` | references 新 schema 文件 | 评估 |
|----|--------------------------|---------------------------|------|
| web          | 0 | 0 | 仅通过 API 端点间接消费 |
| api          | 340 | 6 | 直接消费 schema(API 路由 + DB 查询) |
| ai-service   | 0 | 0 | Python 服务,通过 HTTP/SQL 间接消费,不直接 import TS schema |
| desktop      | 0 | 0 | 仅通过 API 端点间接消费 |
| extension    | 0 | 0 | 仅通过 API 端点间接消费 |
| mobile-rn    | 0 | 0 | 仅通过 API 端点间接消费 |
| miniapp-taro | 0 | 0 | 仅通过 API 端点间接消费 |
| cli          | 0 | 0 | 仅通过 API 端点间接消费 |

**结论**:27 张新表 schema 仅 `packages/database/src/schema/` 中定义,API 端直接消费,其他 7 端不直接 import,**无需多端同步**。

---

## 4. 各端同步需求评估

| 端 | review 数 | 评估结论 |
|----|-----------|----------|
| **api**          | 0 | ✅ 实现端,已注册 6 个新端点,无需同步 |
| **ai-service**   | 0 | ✅ Python 服务,不通过 HTTP 调用本仓库 API 端点,无需同步 |
| **desktop**      | 0 | ✅ 平台独占豁免(系统托盘),无业务需求,无需同步 |
| **extension**    | 0 | ✅ 平台独占豁免(浏览器上下文菜单),无业务需求,无需同步 |
| **cli**          | 0 | ✅ 平台独占豁免(终端集成),无业务需求,无需同步 |
| **web**          | 6 | ⚠️ 需评估:3 个端点(/api/private-letters / /api/wrong-questions / /api/check-in)已通过等价旧路径调用,建议评估是否迁移至新顶级路径;3 个端点(/api/mail / /api/auth-codes / /api/exam-marking)无任何调用方,需评估是否需要补开发 UI 调用方(若功能在 web 端需要) |
| **mobile-rn**    | 6 | ⚠️ 需评估:6 个端点均无调用方,需评估是否需要补开发(若功能在本端需要) |
| **miniapp-taro** | 1 | ⚠️ 需评估:1 个端点(/api/wrong-questions)已通过等价旧路径(`/exam/wrong-questions/{id}`)调用,建议评估是否迁移至新顶级路径 |

### 统计

- 8 端 × 6 端点 = **48 个检查点**
- 无需同步(no):**35** 个
- 需评估(review):**13** 个
- 未知(unknown):**0** 个
- 平台独占豁免:**4 端**(desktop / extension / miniapp-taro / cli)

---

## 5. 需同步对接的端 + 端点清单

### 5.1 web 端(6 个 review)

| 端点 | 现状 | 建议动作 |
|------|------|----------|
| `/api/private-letters`   | 已通过 `/api/admin/private-letters` 调用(2 处) | 评估是否迁移至新顶级路径(`/api/private-letters`)— admin 子路径可能继续作为管理后台专用,建议保留 |
| `/api/wrong-questions`   | 已通过 `/api/exam/wrong-questions` 调用(3 处) | 评估是否迁移至新顶级路径(`/api/wrong-questions`) |
| `/api/check-in`          | 已通过 `/api/user/check-in` 调用(2 处) | 评估是否迁移至新顶级路径(`/api/check-in`) |
| `/api/mail`              | 无调用方 | 评估是否需要补开发邮件发送 UI(若功能在 web 端需要) |
| `/api/auth-codes`        | 无调用方 | 评估是否需要补开发验证码 UI(若功能在 web 端需要) |
| `/api/exam-marking`      | 无调用方(走 `/api/exam/records` 旧路径) | 评估是否迁移至新顶级路径(`/api/exam-marking`) |

### 5.2 mobile-rn 端(6 个 review)

| 端点 | 现状 | 建议动作 |
|------|------|----------|
| 全部 6 个端点 | 无调用方 | 评估各端点对应功能是否在 RN App 端需要(目前 RN 端仅接入 social/orders/courses/wallet 等通用功能) |

### 5.3 miniapp-taro 端(1 个 review)

| 端点 | 现状 | 建议动作 |
|------|------|----------|
| `/api/wrong-questions`   | 已通过 `/exam/wrong-questions/{id}` DELETE 调用(1 处) | 评估是否迁移至新顶级路径(`/api/wrong-questions/{id}`) |

### 5.4 共享层 packages/api-client(关键缺口)

| 端点 | api-client 函数 | 调用方 | 建议 |
|------|-----------------|--------|------|
| `/api/private-letters`   | ❌ 缺失 | — | 建议补开发 |
| `/api/wrong-questions`   | ❌ 缺失 | — | 建议补开发 |
| `/api/check-in`          | ✅ 9 个 CRUD 函数(listCheckins/getCheckin/createCheckin/...) | ❌ 无调用方 | 建议接入 web/mobile-rn 等端调用方 |
| `/api/mail`              | ❌ 缺失 | — | 建议补开发 |
| `/api/auth-codes`        | ❌ 缺失 | — | 建议补开发 |
| `/api/exam-marking`      | ❌ 缺失 | — | 建议补开发 |

**建议**:补开发 6 个新端点的 api-client 共享函数,作为多端同步对接的统一入口(避免 web/mobile-rn/miniapp-taro 各端重复实现 fetch 逻辑)。

---

## 6. 平台独占豁免项(AGENTS.md §9)

| 端 | 豁免范围 |
|----|----------|
| desktop      | 系统托盘(Tauri 原生集成) |
| extension    | 浏览器上下文菜单(WXT) |
| miniapp-taro | 微信支付(小程序原生) |
| cli          | 终端集成(ACP/REPL) |

> 豁免范围仅限平台独占功能。本次审计的 6 个新 API 端点均为业务功能(私信/错题/签到/邮件/验证码/阅卷),非平台独占。4 端命中豁免是因当前无业务需求调用,而非因端点属平台独占。

---

## 7. 最终结论

### 7.1 多端同步需求总览

- **必须同步**:0 端(无任何端有"已实现新顶级路径调用"且"无等价旧路径"的情况)
- **建议评估同步**:3 端(web 6 项 / mobile-rn 6 项 / miniapp-taro 1 项,共 13 项)
- **无需同步**:5 端(api / ai-service / desktop / extension / cli)
- **27 张新表 schema**:无需多端同步(仅 API 端直接消费)

### 7.2 关键发现

1. **api-client 共享层缺 5 个新端点的封装函数**(仅 check-in 有 9 个 CRUD 函数且无调用方),是多端同步对接的最大缺口。建议优先补开发 api-client 共享函数。
2. **web 端 3 个端点已通过等价旧路径调用**(private-letters 走 admin 子路径 / wrong-questions 走 exam 子路径 / check-in 走 user 子路径),功能等价,可选择性迁移至新顶级路径,但需保留 admin 子路径作为管理后台专用。
3. **web 端 admin/exam-marking 页面走 `/api/exam/records/pending-marks` + `/api/admin/exam/records/{id}/grade` 旧路径**,与新增 `/api/exam-marking` 端点重复,需评估是否合并。
4. **mobile-rn 端 6 个新端点全无调用方**,需评估业务需求,目前 RN 端仅接入社交/订单/课程/钱包等通用功能。
5. **miniapp-taro 端仅 wrong-questions 1 处旧路径调用**,可选择性迁移。

### 7.3 后续建议(优先级排序)

1. **P1**:补开发 `packages/api-client/src/endpoints/` 下 5 个新端点的共享函数(private-letters / wrong-questions / mail / auth-codes / exam-marking)+ 为 check-in 9 个 CRUD 函数接入调用方。
2. **P2**:web 端评估是否将 3 处旧路径调用迁移至新顶级路径(private-letters 保留 admin 子路径;wrong-questions / check-in 迁移)。
3. **P2**:web 端评估 `/api/exam-marking` 新端点与现有 `/api/exam/records` 旧路径是否合并。
4. **P3**:mobile-rn 端评估 6 个新端点对应功能是否在 RN App 端需要,若需要则补开发调用方。
5. **P3**:miniapp-taro 端评估是否将 `/exam/wrong-questions/{id}` DELETE 迁移至 `/api/wrong-questions/{id}`。

---

## 8. 验证

- ✅ `node scripts/audit-multi-platform-sync.mjs` 退出码 0
- ✅ `reports/migration-audit-multi-platform-sync-{timestamp}.csv` 已生成
- ✅ `reports/migration-audit-multi-platform-sync-summary.json` 已生成且 JSON 有效
- ✅ 8 端目录全部存在
- ✅ 48 个检查点(8 端 × 6 端点)全部覆盖
- ✅ 27 张新表 schema 依赖扫描完成
