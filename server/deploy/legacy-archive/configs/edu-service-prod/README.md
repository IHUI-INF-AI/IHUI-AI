# edu service 生产环境配置归档（敏感）

## 来源
- 源路径：`H:\历史项目存档\edu server\edu service\edu service\*\src\main\resources\application-prod.yml`
- 归档时间：2026-06-28（Round 34）
- 归档原因：历史项目 21 个 ihui-ai-edu 微服务的生产环境配置，封存追溯用

## 文件清单（23 个 application-prod.yml.legacy）
每个微服务的生产配置，文件名格式：`{service-name}-application-prod.yml.legacy`

含以下微服务（部分）：
- ihui-ai-edu-app-service
- ihui-ai-edu-article-service
- ihui-ai-edu-ask-service
- ihui-ai-edu-auth-service
- ihui-ai-edu-circle-service
- ihui-ai-edu-course-service
- ihui-ai-edu-exam-service
- ihui-ai-edu-live-service
- ihui-ai-edu-member-service
- ihui-ai-edu-message-service
- ihui-ai-edu-news-service
- ihui-ai-edu-notification-service
- ihui-ai-edu-order-service
- ihui-ai-edu-org-service
- ihui-ai-edu-payment-service
- ihui-ai-edu-point-service
- ihui-ai-edu-resource-service
- ihui-ai-edu-search-service
- ihui-ai-edu-setting-service
- ihui-ai-edu-user-service
- ... 等 23 个

## ⚠️ 敏感信息警告
application-prod.yml 含生产环境敏感配置：
- 数据库连接（MySQL/PostgreSQL URL + 账号密码）
- Redis 连接（URL + 密码）
- Nacos 配置中心地址
- 第三方 API 密钥（支付宝/微信/阿里云 OSS 等）

属于敏感凭证：
- 严禁提交到公开 git 仓库
- 严禁被任何运行时代码引用
- 仅供历史微服务配置追溯

## 与新项目的关系
新项目 `g:\IHUI-AI\server\` 已用 Python FastAPI 单体架构替代 Java 微服务。
新项目配置通过 `.env` + `app/config.py` 管理，不引用 Java application-prod.yml。
本归档仅作历史微服务配置追溯用。
