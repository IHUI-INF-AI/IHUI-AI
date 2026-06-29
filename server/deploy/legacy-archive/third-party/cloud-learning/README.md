# cloud-learning 服务级配置归档

**归档时间**: 2026-06-28（Round 38 独立深度核查补齐）
**来源路径**: `H:\历史项目存档\code\ljd-交接文件\{service,service_2}\`

## 文件清单

### 顶层文件（12 个）
- `service-LICENSE` / `service_2-LICENSE` — cloud-learning 猿究生商业授权协议
- `service-README.md` / `service_2-README.md` — cloud-learning 项目说明
- `service_2-README-scripts.md` — 微服务启动脚本说明 + 端口映射表（gateway 6600 ~ order 6621）
- `service-pom.xml` / `service_2-pom.xml` — 父级 POM（声明子模块聚合关系）
- `service-common-pom.xml` / `service_2-common-pom.xml` — common 模块 POM

### edu-service-envs 子目录（56 个）
位于 `../configs/edu-service-envs/`，含 service_2 的 22 个微服务的非 prod 配置：
- `ihui-ai-edu-*-service-application-dev.yml.legacy` — 开发环境配置（22 个）
- `ihui-ai-edu-*-service-application-test.yml.legacy` — 测试环境配置（22 个）
- `ihui-ai-edu-*-service-application-rocketmq.yml.legacy` — RocketMQ 配置（7 个，仅 ask/behavior/circle/exam/learn/live/member/message/order/resource/search 模块）
- `ihui-ai-edu-pay-service-application-alipay.yml.legacy` — 支付宝配置（1 个）

## 与新项目关系

新项目 `g:\IHUI-AI\server\` 用 Python FastAPI 重写，配置改为 `.env`/`.env.production`，这些 yml 仅作历史配置追溯。

## 敏感警告

配置文件含历史内网地址、密码、密钥，**严禁用于生产环境**。
