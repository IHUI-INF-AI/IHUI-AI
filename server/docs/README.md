# 后端文档索引

> 这里放的是后端（Python + FastAPI + SQLAlchemy）相关的文档。
> 前端文档在 `../../client/docs/`，项目级总文档在 `../../docs/`。

---

## 核心文档（先看这些）

| 文档 | 说明 |
|------|------|
| [MULTI_TENANT.md](./MULTI_TENANT.md) | 多租户说明：怎么支持多个客户共用一套系统 |
| [MULTI_TENANT_DESIGN.md](./MULTI_TENANT_DESIGN.md) | 多租户设计：技术方案怎么实现的 |
| [PERFORMANCE_BASELINE.md](./PERFORMANCE_BASELINE.md) | 性能基线：系统跑多快算正常 |
| [PRE_COMMIT_GUIDE.md](./PRE_COMMIT_GUIDE.md) | 提交前检查指南：代码提交前要过哪些关 |

## 部署运维（`deploy/` 目录）

> 所有跟上线、数据库部署、高可用相关的文档都在这里。

| 文档 | 说明 |
|------|------|
| [PRODUCTION.md](./deploy/PRODUCTION.md) | 生产环境说明：线上环境怎么配 |
| [PRODUCTION_MIGRATION_SOP.md](./deploy/PRODUCTION_MIGRATION_SOP.md) | 生产迁移操作手册：线上数据迁移怎么做 |
| [PG16_PRODUCTION_DEPLOYMENT.md](./deploy/PG16_PRODUCTION_DEPLOYMENT.md) | PostgreSQL 16 生产部署 |
| [PG17_UPGRADE_ASSESSMENT.md](./deploy/PG17_UPGRADE_ASSESSMENT.md) | PostgreSQL 17 升级评估 |
| [PG_VERSION_UPGRADE_ASSESSMENT.md](./deploy/PG_VERSION_UPGRADE_ASSESSMENT.md) | PG 版本升级总体评估 |
| [PG_MIGRATION_RUNBOOK.md](./deploy/PG_MIGRATION_RUNBOOK.md) | PG 迁移操作手册 |
| [PG_PRODUCTION_VERIFICATION.md](./deploy/PG_PRODUCTION_VERIFICATION.md) | PG 生产环境验证 |
| [PG_COLD_START_RUNBOOK.md](./deploy/PG_COLD_START_RUNBOOK.md) | PG 冷启动操作手册 |
| [PG_CROSS_AZ_DEPLOYMENT.md](./deploy/PG_CROSS_AZ_DEPLOYMENT.md) | PG 跨可用区部署 |
| [PG_HIGH_AVAILABILITY_ASSESSMENT.md](./deploy/PG_HIGH_AVAILABILITY_ASSESSMENT.md) | PG 高可用评估 |
| [PATRONI_PRODUCTION_DEPLOYMENT.md](./deploy/PATRONI_PRODUCTION_DEPLOYMENT.md) | Patroni 生产部署（PG 高可用方案） |
| [VAULT_PRODUCTION_DEPLOYMENT.md](./deploy/VAULT_PRODUCTION_DEPLOYMENT.md) | Vault 生产部署（密钥管理） |
| [cross_cloud_architecture.md](./deploy/cross_cloud_architecture.md) | 跨云架构说明 |

## 集成对接（`integration/` 目录）

> 跟第三方系统对接、告警通道配置相关的文档。

| 文档 | 说明 |
|------|------|
| [ALERT_WEBHOOK_PRODUCTION.md](./integration/ALERT_WEBHOOK_PRODUCTION.md) | 告警 Webhook 端点配置：8 个通道怎么填地址 |
| [ALERT_WEBHOOK_ACCESS_GUIDE.md](./integration/ALERT_WEBHOOK_ACCESS_GUIDE.md) | 告警 Webhook 接入手册：从 mock 切到真实生产 |
| [DINGTALK_INTEGRATION_GUIDE.md](./integration/DINGTALK_INTEGRATION_GUIDE.md) | 钉钉集成指南 |
| [OIDC_INTEGRATION_GUIDE.md](./integration/OIDC_INTEGRATION_GUIDE.md) | OIDC 登录集成指南 |
| [BIZ_TIMER_ENDPOINTS.md](./integration/BIZ_TIMER_ENDPOINTS.md) | 业务定时器接口说明 |

## 发版说明（`releases/` 目录）

| 文档 | 说明 |
|------|------|
| [RELEASE_NOTES_v0.16.0.md](./releases/RELEASE_NOTES_v0.16.0.md) ~ [v0.20.0.md](./releases/RELEASE_NOTES_v0.20.0.md) | 各版本更新记录 |

## 历史归档（`archive/` 目录）

> 阶段性总结、审计报告，留作参考，日常开发不用看。

- `HONEST_AUDIT.md` — 诚实审计报告
- `INDEX_AUDIT.md` — 索引审计
- `INTEGRATION_REPORT.md` — 集成报告
- `MIGRATION_FROM_CLIENT_BACKEND.md` — 从前端后端迁移记录
- `ROUND8_SUMMARY.md` / `ROUND8_P2_SUMMARY.md` — 第8轮总结
- `p13_summary.md` / `p14_summary.md` / `p15_summary.md` — P13/P14/P15 阶段总结
- `test_roi_audit.md` — 测试投入产出审计
