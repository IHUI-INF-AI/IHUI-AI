# IHUI-AI 企业版销售物料

> 本目录提供 IHUI-AI 企业版(私有化 / SaaS)销售全过程所需物料:报价、部署、功能对比、SLA、Demo 搭建。
> 销售联系:**sales@ihui.ai**

## 物料清单

| 文档 | 用途 | 适用阶段 |
|------|------|----------|
| [报价单生成器](./quote-generator.mjs) | CLI 生成 4 档报价单(markdown,可选 PDF) | 商务报价 |
| [部署指南](./deployment-guide.md) | 私有云 / 公有云 / 混合云三种部署模式 | 技术对接 |
| [功能对比表](./feature-comparison.md) | 社区版 vs Starter/Business/Enterprise/Custom | 选型决策 |
| [SLA 条款](./sla-terms.md) | 服务可用性 / 故障响应 / 赔偿条款 | 合同签订 |
| [Demo 搭建脚本](./demo-setup.sh) | 一键拉起本地 Demo 环境(WSL/Linux/Mac) | 售前演示 |

## 报价档位速览

| 档位 | 年费 | 用户上限 | SLA | 响应 | 部署 |
|------|------|----------|-----|------|------|
| Starter | 5 万 | ≤50 | 99.5% | 8h 邮件 | SaaS |
| Business | 10 万 | ≤200 | 99.9% | 4h 工单+群 | SaaS |
| Enterprise | 30 万 | 无限 | 99.9% | 2h 专属客户经理 | 私有/混合 |
| Custom | 50 万+ | 无限 | 99.99% | 1h 专属团队 | 完全私有化(含源码) |

## 快速生成报价单

```bash
# Business 档,150 用户,2 年订阅
node docs/enterprise-service/quote-generator.mjs \
  --tier=business --customers=150 --duration=24 --customer=ACME

# Enterprise 档,生成 PDF(需项目已安装 puppeteer)
node docs/enterprise-service/quote-generator.mjs \
  --tier=enterprise --customers=1000 --duration=36 --pdf=quote.pdf
```

运行 `node docs/enterprise-service/quote-generator.mjs -h` 查看完整参数。

## 售前 Demo 搭建

```bash
bash docs/enterprise-service/demo-setup.sh ./ihui-ai-demo
# 启动后访问 http://localhost:8801
```

## 配套文档

- 白皮书: [whitepaper.md](./whitepaper.md)
- AI 社区介绍: [ai-community-intro.md](./ai-community-intro.md)
- 决策者社群: [decision-maker-community.md](./decision-maker-community.md)
- 人机协作: [human-ai-collaboration.md](./human-ai-collaboration.md)

## 端口规划

Demo 环境使用 88xx 段(详见 [docs/port-management.md](../port-management.md)):
Web `8801` / API `8802` / AI Service `8803` / PostgreSQL `8810` / Redis `8811`。

## 销售联系

- 邮箱:**sales@ihui.ai**
- 报价单生成后请于 30 天内回传确认,过期需重新生成。
