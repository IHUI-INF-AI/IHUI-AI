# 交接上下文 (Handoff Context) — IHUI-AI P1 封版

> 用途: 本文档供其他 agent 接手封版后 backlog 任务时阅读。
> 状态: **P1 封版基线已确认可上线**，下文 4 个 P2/P3 新功能是封版后 backlog。
> 维护约定: **封版期间只做优化/修复，不做新增功能**，除非用户明确同意。

---

## 1. 项目一句话

**IHUI-AI** = 把 5 个历史项目（H:\edu client、edu server、ihui-ai-admin-frontend、ljd-交接文件、zhs_app-ZZ）整合迁移为一个 Python FastAPI + Vue3 TypeScript 全栈项目。  
**H 盘是只读**（只比对，不修改）。**G 盘是工作区**（`g:\IHUI-AI`）。

---

## 2. 技术栈

- **后端**: Python 3.x + FastAPI + SQLAlchemy 2.x + Alembic + Celery + Redis
- **前端**: Vue3 + TypeScript + Vite + Element Plus + Pinia + Vue Router + Vue I18n
- **DB**: PostgreSQL（生产，ai / center / course 三 schema），SQLite（dev/test）
- **消息**: Redis（broker + WebSocket）+ Socket.IO
- **任务调度**: Celery beat（每 6h 对账）

---

## 3. 目录结构速览

```
g:\IHUI-AI
├── server/
│   ├── app/
│   │   ├── api/             # FastAPI 路由
│   │   │   ├── admin_migration.py    # 站内信 (notify) 路由, P1 持久化重点
│   │   │   └── v1/edu/...            # edu 业务路由
│   │   ├── core/            # 中间件/rate_limit/security
│   │   ├── models/          # SQLAlchemy 模型
│   │   ├── services/        # 业务服务
│   │   ├── tasks/           # Celery 任务
│   │   │   └── reconcile_tasks.py    # run_reconcile_task (P1)
│   │   ├── celery_app.py    # beat_schedule (P1 重点)
│   │   ├── config.py        # Pydantic Settings (含 NOTIFY_* 配置)
│   │   └── main.py          # FastAPI 入口
│   ├── alembic/versions/    # 迁移 (最新: 047_notify_persist)
│   ├── scripts/
│   │   ├── verify_production_smoke.py      # P1 冒烟 (9 项)
│   │   ├── verify_notify_persist.py        # 站内信 8 用例
│   │   ├── verify_notify_rate_limit.py     # 限流测试
│   │   ├── verify_reconcile_to_notify.py   # 对账→站内信
│   │   ├── deploy_notify_env_check.py      # .env 必需项检查
│   │   ├── alembic_production_upgrade.sh   # 生产迁移
│   │   └── celery_beat_singleton_check.sh # beat 单例校验
│   └── .env.example         # 配置模板 (含 NOTIFY_*/CELERY_*)
├── client/
│   ├── src/
│   │   ├── api/             # API 客户端封装
│   │   ├── components/admin/Menu.vue       # 站内信红点徽章 (P1)
│   │   ├── composables/useNotifyBadge.ts   # 30s 轮询 composable (P1)
│   │   └── views/admin/NotificationCenter.vue  # 通知中心页面 (P1)
│   └── package.json
└── docs/
    ├── 封版清单.md           # P1 封版运维清单 (7 步流程)
    ├── 封版前自检报告.md     # 站内信持久化自检
    ├── 迁移完整性审计报告.md # 旧项目→新项目对比
    ├── 迁移字段对比报告.md   # 22 个 Java 微服务字段级对比
    ├── 数据迁移方案.md       # ETL 方案
    ├── 双写期方案.md         # H/G 双写过渡
    └── HANDOFF_CONTEXT.md    # 本文档
```

---

## 4. P1 封版已完成（不要再动）

| 任务 | 关键文件 |
|------|----------|
| 站内信持久化（内存 deque → PostgreSQL message 表） | `server/app/api/admin_migration.py` |
| 站内信 3 个索引（未读/时间/分类） | `server/alembic/versions/047_notify_persist.py` |
| 限流（POST 30/60s, GET 120/60s） | `server/app/core/rate_limit.py` |
| Celery beat run-reconcile-every-6h | `server/app/celery_app.py` + `server/app/tasks/reconcile_tasks.py` |
| 前端 30s 红点轮询 | `client/src/composables/useNotifyBadge.ts` |
| 前端菜单红点 | `client/src/components/admin/Menu.vue` |
| 通知中心 unreadCount 用后端端点 | `client/src/views/admin/NotificationCenter.vue` |
| .env 配置 | `server/.env.example`（NOTIFY_RECIPIENT_UUID / NOTIFY_MAX / CELERY_BROKER_URL） |

**校验命令**:
```bash
cd g:\IHUI-AI\server
python scripts/verify_production_smoke.py   # 期望 9/9 PASS
cd g:\IHUI-AI\client && npx vue-tsc --noEmit   # 期望 0 错
```

---

## 5. 封版后 Backlog（agent 接手时从这里挑）

### 5.1 P2 — WebSocket 实时推送站内信
- **目标**: admin 通知中心实时刷新, 替代 30s 轮询
- **涉及**:
  - 后端: `app/api/admin_migration.py` push_notification 时 emit Socket.IO 事件
  - 前端: `useNotifyBadge.ts` 改为 ws 订阅 + 离线降级到 30s 轮询
  - Socket.IO 服务已在 `app/main.py` mount (`/socket.io`)
- **工作量**: 1-2 天

### 5.2 P2 — 按等级/来源分组展示
- **目标**: 通知中心顶部加 tabs (全部/info/warn/error/reconcile/migration)
- **涉及**:
  - 前端: `NotificationCenter.vue` 加 `el-tabs`, filter 改为 tab key
  - 后端: list_notifications 加 `level`/`source` 参数
- **工作量**: 0.5 天

### 5.3 P3 — 邮件/短信通道
- **目标**: error 级别告警同步推送到手机短信/邮件
- **涉及**:
  - 集成阿里云/腾讯云 SDK
  - 模板配置 + 密钥管理（Vault？）
  - `push_notification` 后置钩子
- **工作量**: 1-2 天

### 5.4 P3 — 站内信搜索/导出
- **目标**: 搜索框 + 一键导出 CSV
- **涉及**:
  - 后端: 新增 search 端点（title/body 模糊查询）+ 权限校验
  - 前端: 搜索框 + el-table 导出按钮
- **工作量**: 1 天

---

## 6. 启动方式

### 6.1 后端开发服务器
```bash
cd g:\IHUI-AI\server
python -m uvicorn app.main:app --reload --port 18889
```

### 6.2 前端开发服务器
```bash
cd g:\IHUI-AI\client
npm run dev   # 默认 8888
# 或 npm run dev:web / dev:h5 / dev:mp-weixin (跨端)
```

### 6.3 Celery（封版后任务调试用）
```bash
cd g:\IHUI-AI\server
celery -A app.celery_app worker -l info
celery -A app.celery_app beat -l info
```

---

## 7. 关键约束（务必遵守）

1. **H 盘只读**: `H:\edu client` / `H:\edu server` / `H:\ihui-ai-admin-frontend` / `H:\ljd-交接文件` / `H:\zhs_app-ZZ` 一律**只读**, 只比对不修改。
2. **封版规则**: 只做**优化/修复**, **不做新增功能**, 除非用户明确同意。
3. **CSS 禁用项**: `text-shadow` 绝对禁止; `box-shadow` 仅必要场景; `!important` 禁止; 不写超过 2 层深度的选择器。
4. **emoji 限制**: PowerShell 终端 GBK 编码, Python 脚本 print 用 `[OK]/[FAIL]` 而非 `✅/❌`（避免 UnicodeEncodeError）。
5. **TypeScript 严格模式**: `vue-tsc --noEmit` 必须 0 错。`watch(ref, (v) => ...)` 时 v 可能是 `Ref<T>`, 用 `typeof v === 'string' ? v : String(v.value)` 兼容。
6. **响应语言**: 简体中文。

---

## 8. 常用命令速查

```bash
# 后端冒烟
cd g:\IHUI-AI\server && python scripts/verify_production_smoke.py

# 前端 TS 检查
cd g:\IHUI-AI\client && npx vue-tsc --noEmit

# 触发对账（手动）
cd g:\IHUI-AI\server && python -c "from app.tasks.reconcile_tasks import run_reconcile_task; print(run_reconcile_task())"

# alembic
cd g:\IHUI-AI\server && alembic current
cd g:\IHUI-AI\server && alembic upgrade head
cd g:\IHUI-AI\server && alembic downgrade -1

# 检查 .env 必需项
cd g:\IHUI-AI\server && python scripts/deploy_notify_env_check.py --strict
```

---

## 9. 接手指南

1. **读这个文档**（本文）和 `docs/封版清单.md`。
2. **跑冒烟**: 确认 P1 封版基线是绿的。
3. **挑 backlog**: 从 §5 选 1 项，确认依赖。
4. **不要碰 P1 已完成部分**, 仅修改/扩展; 若发现 P1 bug, 走"修复"流程, 不做新功能。
5. **完成任务后**: 跑 `vue-tsc --noEmit` + `verify_production_smoke.py` 双验证。

---

**接手时间**: 2026-06-24  
**P1 封版基线**: 9/9 冒烟 PASS + vue-tsc 0 错  
**Handoff 给**: 下一个 agent（无指定）
