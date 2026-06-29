# edu-service 非 prod 配置归档

**归档时间**: 2026-06-28（Round 38 独立深度核查补齐）
**来源**: `H:\历史项目存档\code\ljd-交接文件\{service,service_2}\ihui-ai-edu-*-service\src\main\resources\`

## 文件清单（共 114 个）

### svc1- 前缀（58 个，来自 service 目录）
- `svc1-ihui-ai-edu-*-service-application-dev.yml.legacy` — 开发环境配置（22 个）
- `svc1-ihui-ai-edu-*-service-application-test.yml.legacy` — 测试环境配置（22 个）
- `svc1-ihui-ai-edu-*-service-application-rocketmq.yml.legacy` — RocketMQ 配置（8 个，ask/behavior/circle/exam/learn/live/member/message/order/resource/search 等）
- `svc1-ihui-ai-edu-pay-service-application-alipay.yml.legacy` — 支付宝配置（1 个）
- 其余 5 个为 dev/test/rocketmq 组合缺失项

### svc2- 前缀（56 个，来自 service_2 目录）
- `svc2-ihui-ai-edu-*-service-application-dev.yml.legacy` — 开发环境配置（22 个）
- `svc2-ihui-ai-edu-*-service-application-test.yml.legacy` — 测试环境配置（22 个）
- `svc2-ihui-ai-edu-*-service-application-rocketmq.yml.legacy` — RocketMQ 配置（7 个）
- `svc2-ihui-ai-edu-pay-service-application-alipay.yml.legacy` — 支付宝配置（1 个）
- 其余 4 个为组合缺失项

## 命名规则

`{svc1|svc2}-{服务名}-{环境配置文件名}.legacy`
- svc1 = service 目录来源
- svc2 = service_2 目录来源
- .legacy 后缀 = 历史配置归档标记，避免与当前项目配置混淆

## 与新项目关系

新项目 `g:\IHUI-AI\server\` 用 Python FastAPI 重写，配置改为 `.env`/`.env.production`。这些 yml 仅作历史微服务架构配置追溯。

## 敏感警告

配置文件含历史内网地址、密码、密钥，**严禁用于生产环境**。
