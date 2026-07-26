# Security Policy / 安全政策

## Supported Versions / 支持的版本

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability / 报告漏洞

如果你发现了安全漏洞,请**不要**在公开 Issue 中披露。

请通过以下方式私密报告:
- 邮箱:security@ihui.ai
- GitHub Security Advisory:https://github.com/IHUI-INF-AI/IHUI-AI/security/advisories/new

我们承诺:
- 24 小时内确认收到报告
- 72 小时内提供初步评估
- 7 天内发布修复或缓解方案
- 漏洞修复后公开致谢(经你同意)

## Security Measures / 安全措施

IHUI AI 实施了以下安全措施:
- JWT 身份认证 + RBAC 权限控制
- API Key 加密存储(AES-256)
- SQL 注入防护(Drizzle ORM 参数化查询)
- XSS / CSRF 防护
- 速率限制(Redis + Fastify)
- 审计日志(全量操作记录)
- 依赖漏洞扫描(Dependabot)

## Bug Bounty / 漏洞奖励

对于高危漏洞,我们提供:
- 公开致谢
- IHUI AI 积分奖励
- 优先技术支持
- 企业版免费使用权(3-12 个月)
