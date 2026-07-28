# 企业文档总目录(IHUI-AI Enterprise Documentation)

> **面向**:企业客户 / 销售 / 售前 / 技术决策者 / 商务
> **最后更新**:2026-07-28
> **维护方**:吉林省智汇人工智能科技有限公司 · 企业服务部
> **销售联系**:**sales@aizhs.top**

本目录包含 IHUI-AI 企业版(Enterprise Edition)对外提供的**全部商务与技术文档**。客户签约后可作为合同附件引用,内部销售 / 售前 / 交付 / 运维团队按需取用。

---

## 一、文档索引(9 份)

### 1.1 商务与决策类(4 份)

| 文档 | 用途 | 受众 |
|------|------|------|
| [whitepaper.md](./whitepaper.md) | 全景白皮书(产品定位 + 价值 + 发展规划) | 决策者 / 高管 |
| [ai-community-intro.md](./ai-community-intro.md) | AI 智能体社区介绍(普通用户/创作者/企业三视角) | 潜在客户 / 合作伙伴 |
| [decision-maker-community.md](./decision-maker-community.md) | 决策者社群介绍(行业洞察 + 高管对话圈) | C-level / VP |
| [human-ai-collaboration.md](./human-ai-collaboration.md) | 人机协作理念(产品哲学 + 未来工作模式) | 战略 / 趋势关注者 |

### 1.2 商务与合同类(2 份)

| 文档 | 用途 | 受众 |
|------|------|------|
| [pricing-quote.md](./pricing-quote.md) | 4 档报价单(标准 ¥5万 / 专业 ¥10万 / 旗舰 ¥30万 / 行业 ¥50万) | 采购 / 财务 |
| [sla-terms.md](./sla-terms.md) | 服务等级协议(99.9% / 99.95% / 99.99% 三档) | 法务 / 运维 |

### 1.3 技术与交付类(3 份)

| 文档 | 用途 | 受众 |
|------|------|------|
| [deployment-guide.md](./deployment-guide.md) | 三模式部署指南(私有云 / 公有云 / 混合云) | IT 运维 / SRE / 集成商 |
| [demo-environment.md](./demo-environment.md) | Demo 环境搭建(5 分钟一键启动) | 销售 / 售前 / POC |
| [feature-comparison.md](./feature-comparison.md) | 社区版 vs 企业版对比(24 个维度) | 技术决策者 / 架构师 |

### 1.4 配套脚本

- `scripts/setup-enterprise-demo.sh` — 一键 Demo 环境搭建脚本(idempotent,支持 `--dry-run` / `--status` / `--reset` / `--clean` / `--purge`)

---

## 二、按角色快速查找

### 2.1 商务 / 销售

- 与客户**初次接触** → [whitepaper.md](./whitepaper.md) + [ai-community-intro.md](./ai-community-intro.md)
- **报价阶段** → [pricing-quote.md](./pricing-quote.md)
- **演示 / POC** → [demo-environment.md](./demo-environment.md) + `./scripts/setup-enterprise-demo.sh`
- **签约阶段** → [sla-terms.md](./sla-terms.md) + [pricing-quote.md](./pricing-quote.md)
- **决策层对话** → [decision-maker-community.md](./decision-maker-community.md)

### 2.2 售前 / 解决方案

- **功能答疑** → [feature-comparison.md](./feature-comparison.md)
- **架构答疑** → [deployment-guide.md](./deployment-guide.md)
- **演示环境** → [demo-environment.md](./demo-environment.md)
- **POC 验收** → [feature-comparison.md](./feature-comparison.md) + [sla-terms.md](./sla-terms.md)

### 2.3 技术 / 运维

- **部署上线** → [deployment-guide.md](./deployment-guide.md)
- **Demo 自助** → [demo-environment.md](./demo-environment.md) + `./scripts/setup-enterprise-demo.sh`
- **合规对照** → [sla-terms.md](./sla-terms.md) §6 数据保护
- **故障处理** → [sla-terms.md](./sla-terms.md) §3 故障响应

### 2.4 客户内部

- **评估选型** → [feature-comparison.md](./feature-comparison.md) + [pricing-quote.md](./pricing-quote.md)
- **签约准备** → [sla-terms.md](./sla-terms.md) + [pricing-quote.md](./pricing-quote.md)
- **上线准备** → [deployment-guide.md](./deployment-guide.md) + [demo-environment.md](./demo-environment.md)
- **运维手册** → [sla-terms.md](./sla-terms.md) + [deployment-guide.md](./deployment-guide.md)

---

## 三、文档版本与更新

- **当前版本**:v1.0
- **更新频率**:每月 1 次小版本(每月 1 日),每季度 1 次大版本
- **变更通知**:签约客户通过工单系统 / 邮件提前 30 天通知
- **修订记录**:见每份文档末尾的"最后更新"字段

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

- 邮箱:**sales@aizhs.top**
- 报价单生成后请于 30 天内回传确认,过期需重新生成。
