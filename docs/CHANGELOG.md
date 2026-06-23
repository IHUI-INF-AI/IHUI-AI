# 项目变更日志

> 本文档记录项目级重要变更。设计令牌变更见 `TOKEN-CHANGELOG.md`。
> 各版本详细发版说明见 `server/docs/releases/`。

---

## v1.0.0 (2026-06-23) - 正式发版

### 概述

智汇AI全栈生态平台正式发布。前端基于 Vue3 + TypeScript + Vite，后端基于 Python FastAPI，提供完整的 AI 对话、社区、模型广场、课程中心、支付系统等核心功能。

### 核心模块

- **AI 对话**：支持多模型对话（Coze/Qwen/通义千问），流式响应，WebSocket 实时通信
- **AI 社区**：圈子、帖子、评论、点赞、收藏等完整社交功能
- **模型广场**：AI 模型展示、分类、搜索、详情页
- **课程中心**：在线课程、视频播放、学习进度跟踪
- **支付系统**：微信支付、支付宝支付（RSA2 签名），订单管理、支付状态 WebSocket 推送
- **VIP 订阅**：多级会员体系、权益管理、自动续费
- **多租户**：租户隔离、资源配额、租户级配置
- **管理后台**：用户管理、角色权限（RBAC）、系统配置、操作日志、审计日志

### 安全修复

- 修复 17 个 P0 安全漏洞（SQL 注入、XSS、CSRF、SSRF 等）
- 支付验签：微信支付签名验证、支付宝 RSA2 签名验证
- RBAC 鉴权：基于角色的访问控制，细粒度权限管理
- WebSocket 鉴权：`@ws_require_auth` 装饰器，JWT 令牌验证
- JWT 令牌轮转 + 黑名单机制
- 密码 bcrypt 加密（cost=12）
- CORS 白名单配置
- CSP 内容安全策略
- 安全响应头（X-Frame-Options、X-Content-Type-Options、HSTS 等）

### 部署优化

- Docker 化部署：多阶段构建、docker-compose 编排
- HTTPS/SSL：Nginx 反向代理 + TLS 1.2/1.3
- Prometheus 监控：指标采集、告警规则
- ELK 日志：Logstash 日志收集、Elasticsearch 存储、Kibana 可视化
- 蓝绿部署 + 金丝雀发布支持
- 数据库备份与恢复（PostgreSQL WAL 归档 + PITR）

### 封版前修复

- legacy_local 端点实现：兼容旧版 API 路由
- 支付宝 RSA2 签名：修复签名算法，通过支付宝沙箱验证
- `.env.production` 生产配置：完善生产环境变量模板
- CI/CD 流程修复：GitHub Actions 工作流、Playwright E2E 测试
- API v2 迁移完成：v2 端点总数 1035，覆盖率 96%
- 端口统一：废弃 18000，统一 8000（后端）+ 8888（前端）
- Java 后端完整迁移：所有 RuoYi 核心 API 迁移到 Python FastAPI

---

## 2026-06-22

### 文档体系重构
- **精简** 根 `README.md`（从 1185 行缩减到 150 行）
- **消除** 5 处内容重复（AGENTS.md/agents.md、MEMORY.md/architecture.md、integration-comparison-analysis）
- **整合** 样式文档：15 个 → 9 个（合并优化计划+报告、合并令牌文档）
- **归档** 3 个审计报告到 `docs/frontend/archive/`
- **统一** 文件命名为 kebab-case
- **清理** HTML 报告和字体文件到 `docs/archive/reports/`
- **移除** MEMORY.md 中的个人联系信息
- **修复** CONTRIBUTING.md、SECURITY.md、PROJECT-ARCHITECTURE.md 中的旧路径引用
- **新增** `docs/GETTING-STARTED.md`、`docs/CHANGELOG.md`、`docs/TROUBLESHOOTING.md`、`server/docs/DATABASE.md`
- **创建** 遗留文档标记 `server/docs/legacy/README.md`

### 设计系统
- 新增 `DESIGN.md`（Google Stitch 规范），作为项目视觉设计语言唯一汇总入口
- 新增 `docs/agents.md` 第 4 章「设计规范文件引用规则」

---

## 2026-06-18

### API v2 迁移
- API v2 迁移率达到 96%，v2 端点总数 1035
- Vite Proxy v1→v2 自动重写
- 统一 `success()` 返回格式

### 端口统一
- 废弃 18000 端口，统一使用 8000（后端）+ 8888（前端）
- 创建 `docs/frontend/DEV_PORTS.md` 端口管理文档

---

## 历史版本

详细的版本发版说明见 `server/docs/releases/RELEASE_NOTES_v*.md`。