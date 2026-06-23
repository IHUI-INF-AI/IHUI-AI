# 更新日志

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
