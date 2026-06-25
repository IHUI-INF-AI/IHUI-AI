# 更新日志

## [1.0.2] - 2026-06-26

> 封版基线 (v1.0.2-sealed) — 182 个 commit 全部经用户确认后合入 origin/main。
> 修复/优化为主，新增功能均经用户在封版阶段逐项确认。

### 关键修复

#### 后端安全与稳定性
- **同步 I/O 全面异步化** — 所有 `def` 端点（涉及 DB/Redis/外部 HTTP）改为 `async def`，DB 查询包装 `asyncio.to_thread`，消除事件循环阻塞
- **认证强化** — `security.py` 重构：同步 DB 查询用 `asyncio.to_thread` 包装；`require_role`/`require_permission` 依赖全异步化
- **JWT 访问/刷新分离** — 区分 access/refresh token 独立 TTL 管理，过期/吊销链完整
- **Pydantic v2 兼容性** — `model_config = ConfigDict(...)` 替换 `Config` 类；Empty 字符串环境变量 fallback 到 `tempfile.gettempdir()`
- **SQLAlchemy 2.0 迁移** — `sqlalchemy.ext.declarative.declarative_base` → `sqlalchemy.orm.declarative_base`，全项目 47 个 model 兼容 2.0
- **软删除过滤** — 所有查询 `where deleted_at IS NULL` 补全（admin_panel / edu / finance / agents 等模块）
- **敏感信息脱敏** — `_mask_phone` 等方法在 logger 中使用（手机号/验证码日志）
- **外部 HTTP 超时** — `httpx.AsyncClient` 全部加 `timeout=30.0`
- **错误码 6 位化** — 全项目错误码从短码（如 401）扩展为 6 位（如 401000）
- **异常日志补全** — `except Exception: pass` 全部添加 `logger.debug(...)` 记录
- **API Body 化** — 密码/token 等敏感参数从 Query 改为 Body

#### 支付/订单/财务
- 微信支付回调验签 + 金额校验 + 幂等性修复
- 退款证据目录跨平台化（`tempfile.gettempdir()` 替代硬编码 `G:\`）
- 订单状态机边缘 case 修复
- 历史订单迁移脚本幂等化

#### 数据库/迁移
- alembic 链静态校验工具（`test_alembic_008_static.py` + `_verify_alembic_chain.py`）
- 47 个迁移文件版本一致性守护
- alembic 008 路径重整
- 数据库软删除索引补全

#### 前端
- 11 个 TypeScript 错误修复（strict mode 全开）
- `vue-tsc` 类型检查全项目通过
- Vite 预加载补充首屏动态组件
- 通知/AI 对话组件拆分（`AIChatLegacy.vue` 独立）
- 12 个深色模式快照基线更新

### 优化

#### 扁平化设计规范全面落地
- `_design-tokens.scss` / `_unified-search.scss` / `AIChat` 组件：移除 `box-shadow` + `filter` 残留
- `box-shadow` 强制 0 处新增（CI 检查：`.github/workflows/ci.yml` 静态扫描）
- `text-shadow` 全局禁用
- `!important` 禁用规范文档化
- 高特异性选择器（`.class.class` / 4 层以上）禁用规范文档化

#### 文档与规范
- 端口运行时规范（强制 8000 后端 + 8888 前端，禁临时改端口）
- 贡献指南 (CONTRIBUTING.md) 端口章节补充
- 端口自动检测工具（`client/scripts/check-runtime-port.mjs`，跨平台 170 行）
- ESLint 自动 import 维护文件（`client/.eslintrc-auto-import.json`）
- 审计报告 (`docs/AUDIT_REPORT.md`) 同步更新到 P0-SyncIO/MissingAuth/MixedPK 全部归零

#### CI/CD
- `smoke-fast-gate` 集成 **HTTP e2e smoke**（7 个核心端点契约验证）
- 工作区卫生检查（运行时产物/临时文件禁止追踪）
- 路径卫生检查（防止 G 盘根目录硬编码回归）
- OpenAPI 漂移检测
- v1 弃用检查
- 跨平台 smoke 矩阵（windows + macOS + ubuntu）

### 新增功能（封版阶段经用户逐项确认纳入）

- **system/dictionary** 路由注册 (12 端点) — `dict_type` / `dict_data` 查询
- **agents/category_link** 路由 — 智能体分类关联
- **finance/fund_info** 路由 — 用户资金信息查询
- **legacy_supplement** 路由（54 端点）— 遗留补充接口
- **edu-migration** 6 phase（A→F）— 22 routers + 28 routes + 5 stores + i18n + e2e 验证
- **Java → Python 历史项目完整迁移** — resource_legacy + 6 个 Java Controller 1:1 兼容（100% 端点覆盖）
- **H5 移动端** — 轻量版项目脚手架
- **知识库 RAG API 路由层** — 补齐路由注册

### 封版基线

- 封版 commit `d105eb8`：后端 Bug 修复 + 前端认证适配 + 预存变更合并基线
- 标签 `v1.0.2-sealed` 标记封版版本

### 验证

- **pytest e2e smoke** (`test_e2e_smoke.py`)：13/13 通过（8.26s）
- **HTTP e2e smoke** (`e2e_smoke_test.py`)：7/7 通过
  - T1 healthz / T2 登录 / T3 getInfo / T4 models-unify / T5 agents/list / T9 chat/query / T10 categories/list

## [1.0.1] - 2026-06-24

> 封版上线前的修复与优化，均为修复/优化，不涉及新增功能。

### 模板与语法修复
- 修复 admin/Index.vue 模板语法错误（第 21 行 i18n 调用多一个 `}`，导致管理后台首页渲染崩溃）
- 修复 admin/sms/Template.vue 的 h() 第三个参数类型错误（slots 对象改为 children 字符串）

### ESLint 修复（108 个 errors）
- 21 个测试文件中的空 catch 块（no-empty），统一改为 `catch { /* noop */ }`
- 9 处未使用变量（no-unused-vars）：ExamDo.vue、OrderList.vue、Withdrawal.vue、admin/exam 下 Answer/AnswerDetailDialog/List/Question.vue

### 单元测试修复（11 个失败）
- AdminIndex.test.ts：ElButtonStub 未声明 emits 导致 Vue 3 fallthrough 重复触发 refresh
- Wallet.a11y.test.ts：缺少 useDarkModeStore 的 mock 导致 Pinia 未初始化
- auth-service.test.ts：refresh token URL 期望值过时（/login/pwd/refreshToken → /api/v1/auth/refresh）

### E2E 视觉回归
- 更新 7 个暗色模式快照基线（home/login/agents/plaza/vip/tools/ranking）

## [1.0.0] - 2026-06-23

### 核心模块
- Vue 3 + TypeScript + Vite 前端框架
- FastAPI + SQLAlchemy + PostgreSQL 后端框架
- 多租户架构与智能路由中间件
- WebSocket 实时通信（聊天室）
- AI 对话代理（智谱/Coze/豆包/DeepSeek 多模型）
- 支付系统（微信支付/支付宝）
- MinIO 对象存储
- 课程管理与社区功能

### 安全修复
- 实现 legacy_local.py 3个端点（register/me/change-password）
- 实现 ali_login.py RSA2 签名（cryptography 库）
- 添加 invoke_target 模块白名单
- 密码参数 Query → Body 迁移（7个端点）
- .env.production 全面脱敏与强化
- JWT/Session 密钥更换为64位强随机值

### 部署优化
- nginx HTTPS + SSL + 6项安全头
- Dockerfile.server 多阶段构建 + alembic 自动迁移
- docker-compose 添加 MinIO + 前端 healthcheck
- CI/CD 修复（Dockerfile 路径 + helm → docker-compose）
- Prometheus/ELK 配置从 PDF 项目重写为主项目
- 预部署检查脚本 (pre_deploy_check.py)
- 部署运维手册 (DEPLOYMENT_RUNBOOK.md)
