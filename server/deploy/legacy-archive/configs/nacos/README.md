# Nacos 配置中心归档（敏感）

## 来源
- 源路径：`H:\历史项目存档\edu server\edu service\edu service\dist\nacos-configs\*.yml`
- 归档时间：2026-06-28（Round 34）
- 归档原因：历史项目 Nacos 配置中心 21 个微服务生产配置，封存追溯用

## 文件清单（21 个 .yml）
Nacos 配置中心的微服务配置，与 application-prod.yml 互补。

## ⚠️ 敏感信息警告
Nacos 配置含生产环境敏感配置：
- 数据库连接
- Redis 连接
- 服务发现地址
- 可能含第三方 API 密钥

属于敏感凭证，仅供历史配置追溯。

## 与新项目的关系
新项目 `g:\IHUI-AI\server\` 不使用 Nacos 配置中心。
新项目配置通过 `.env` + `app/config.py` 管理。
本归档仅作历史配置追溯用。
