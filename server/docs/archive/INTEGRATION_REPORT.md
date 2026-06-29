# 前后端联调验证报告

**日期**: 2026-06-16  
**执行者**: ZCode Agent  
**目标**: 打通前端 (officialsite:8888) ↔ 后端 (zhs-platform:8000) 本地联调链路

---

## 一、执行摘要

| 阶段 | 状态 | 测试结果 |
|------|------|----------|
| A: 基础链路打通 | ✅ 完成 | 后端 8000 + 前端 8888 均启动 |
| B: 契约修复 | ✅ 完成 | compat 中间件 + llm 端点 + CORS + system 端点 |
| C: E2E 验证 | ✅ 完成 | **全量 17/17 + E2E 10/10 + System 20/20** |

---

## 二、测试结果

### 全量验证: 17/17 PASS ✅

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | 后端 8000 端口 | ✅ |
| 2 | 前端 8888 端口 | ✅ |
| 3 | 后端 /healthz | ✅ 200 |
| 4 | 后端 /docs Swagger UI | ✅ |
| 5 | 用户名登录 | ✅ |
| 6 | JWT 鉴权 | ✅ |
| 7 | Vite 代理登录 | ✅ |
| 8 | Vite→JWT | ✅ 200 |
| 9 | Vite→models-unify | ✅ 200 |
| 10 | Vite→agents | ✅ 200 |
| 11 | Vite→categories | ✅ 200 |
| 12 | CORS 预检 | ✅ |
| 13 | compat create | ✅ |
| 14 | compat delete | ✅ |
| 15 | OpenAPI 路由数 | ✅ 642 |
| 16 | 新路由已注册 | ✅ 4 条 |
| 17 | 前端 SPA 加载 | ✅ |

### E2E 冒烟测试: 10/10 PASS ✅

| # | 测试项 | 结果 |
|---|--------|------|
| T1 | healthz 可达 | ✅ |
| T2 | 用户名登录 | ✅ |
| T3 | JWT 鉴权 | ✅ |
| T4 | models-unify 列表 | ✅ |
| T5 | agents/list | ✅ |
| T6 | compat create | ✅ |
| T7 | compat delete | ✅ |
| T8 | CORS 预检 | ✅ |
| T9 | chat/history/query | ✅ |
| T10 | agents/categories | ✅ |

### System 端点测试: 20/20 PASS ✅

| # | 端点 | 直连 | Vite |
|---|------|------|------|
| 1 | /system/menu/getRouters | ✅ | ✅ |
| 2 | /system/menu/treeselect | ✅ | — |
| 3 | /system/menu/list | ✅ | ✅ |
| 4 | /system/role/list | ✅ | ✅ |
| 5 | /system/dept/list | ✅ | ✅ |
| 6 | /system/post/list | ✅ | — |
| 7 | /system/config/list | ✅ | — |
| 8 | /system/dict/type/list | ✅ | — |
| 9 | /system/dict/data/list | ✅ | ✅ |
| 10 | /system/dict/data/type | ✅ | ✅ |
| 11 | /system/getInfo | ✅ | — |
| 12 | /system/user/getInfo | ✅ | ✅ |
| 13 | /system/user/list | ✅ | ✅ |

---

## 三、改动清单

### 后端 (11 个文件)

| 文件 | 改动 |
|------|------|
| app/main.py | compat 中间件: +system 路径映射 |
| app/api/v1/system/user.py | +getRouters, +treeselect, +dept/list, +post/list, +dict/*, +user/getInfo 别名 |
| app/api/v1/system/admin.py | +getRouters, +treeselect, +roleMenuTreeselect, +dict/data/type |
| app/api/v1/ai/model_info.py | +compat CRUD (create/update/delete) + 重试机制 |
| app/api/v1/llm/__init__.py | 新模块 |
| app/api/v1/llm/models_unify.py | 新端点 /api/v1/llm/models-unify |
| app/api/v1/router.py | +llm 路由注册 |
| local_data/start-detached.vbs | 启动脚本 |
| local_data/e2e_smoke_test.py | E2E 测试 |
| local_data/test_system.py | System 端点测试 |
| scripts/dev/final_verify.py | 全量验证 |

### 前端 (9 个文件)

| 文件 | 改动 |
|------|------|
| vite.config.ts | /api→本地8000, +ihui-ai-api代理, /api/v1→本地, WebSocket→本地 |
| .env.development | +VITE_COZE_API_TARGET |
| src/config/backend-paths.ts | models-unify URL: 硬编码→相对路径 |
| src/api/ai.ts | baseUrl 回退: 硬编码→环境变量 |
| src/api/core/client.ts | getBaseUrl(): dev模式走相对路径 |
| src/components/ai/AIChat.vue | WebSocket URL: 3处硬编码→Vite代理 |
| src/views/admin-ruoyi/ai/examine/index.vue | WebSocket URL→Vite代理 |
| src/views/admin-ruoyi/demandSquare/review.vue | WebSocket URL→Vite代理 |
| start-vite-detached.vbs | 启动脚本 |

---

## 四、代理架构

```
浏览器 → http://127.0.0.1:8888 (Vite Dev Server)
  │
  ├─ /api/v1/*        → 本地 8000 (Python zhs-platform)     ✅
  ├─ /api/*           → 本地 8000 (Python, /api/v1/* 重写)   ✅
  ├─ /cozeZhsApi/*    → 本地 8000 (VITE_COZE_API_TARGET)    ✅
  ├─ /ihui-ai-api/*   → 生产 zca.aizhs.top (大模型网关)      ✅
  └─ 其他             → 各自的生产服务
```

---

## 五、启动指南

```cmd
:: 后端
cd g:\IHUI-AI\zhs-platform
start /B python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file local_data/dev-config.ini

:: 前端
cd G:\officialsite
start /B node node_modules\vite\bin\vite.js --port 8888

:: 验证
python g:\IHUI-AI\zhs-platform\local_data\final_verify.py
python g:\IHUI-AI\zhs-platform\local_data\test_system.py
python g:\IHUI-AI\zhs-platform\local_data\e2e_smoke_test.py

:: 默认账号: admin / admin123
```

---

## 六、已知限制

1. **SQLite 并发**: 本地用 SQLite，高并发写入会锁表。生产需 PostgreSQL。
2. **Redis 不可用**: WebSocket pub/sub 降级为内存模式。生产需 Redis。
3. **ihui-ai-api 走生产**: 大模型统一接口独立于 zhs-platform，需单独部署。
4. **后端进程持久性**: Windows 环境下 uvicorn 进程无法跨 shell session 存活。生产应使用 Docker/Windows Service。
