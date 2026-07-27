# 挣钱最快路径操作指南（傻瓜版）

> 写给完全不懂技术的你。代码已 100% 就绪，照着这份指南一步步做就能收到钱。
> AI 已把所有能写的代码写完，剩下的是你本人凭身份证/银行卡/营业执照才能做的真实世界操作。

---

## 三条路径对比（选一条开始）

| 路径 | 见钱速度 | 第一笔金额 | 你要做的事 | 适合你吗 |
|------|---------|-----------|-----------|---------|
| **① 企业版私有化** | 3-14 天 | 5 万-50 万/单 | 找客户 + 签合同 + 对公转账 | ✅ 最推荐，最简单 |
| ② 海外 SaaS 订阅 | 1-2 周 | ¥29-499/月/人 | 注册 Stripe + 买海外服务器 | 需懂英语，单笔小 |
| ③ 国内 SaaS 订阅 | 1-2 个月 | ¥29-499/月/人 | ICP 备案 + 微信支付商户号 | 备案太慢，不推荐先做 |

**建议：先做路径①企业版，几天内就能收到第一笔钱。** 下面详细说怎么做。

---

## 路径①：企业版私有化部署（最快挣钱）

### 为什么这条最快

- ❌ 不需要 ICP 备案（部署到客户自己服务器）
- ❌ 不需要注册支付商户（对公转账，钱直接到你公司账户）
- ❌ 不需要注册 AI 厂商 Key（客户用自己的 Key）
- ✅ 只需要：找到企业客户 → 签合同 → 收款 → 部署

### 第 1 步：你需要先有的东西（一次性准备）

#### 1.1 营业执照（公司主体）

如果要开发票、签合同、对公收款，必须有公司。

- **没有公司**：去当地工商局或线上（如阿里云企业服务、腾讯云企业注册）注册一个个体工商户或有限公司，成本 0-500 元，3-7 天下证。经营范围写"软件开发、技术服务、技术咨询"。
- **已有公司**：跳过。

#### 1.2 对公银行账户

拿到营业执照后，去任何一家银行（建议招商银行/工商银行，开户快）开对公账户。需要：营业执照 + 法人身份证 + 公章财务章法人章。1-3 天下户。

#### 1.3 公司公章 + 合同章

刻章店刻一套（公章/财务章/法人章/合同章），约 200-500 元，1 天。

### 第 2 步：准备销售物料（AI 已为你做好）

所有物料都在本目录 `docs/enterprise-service/`，**直接拿来用**：

| 物料 | 文件 | 怎么用 |
|------|------|-------|
| 产品白皮书 | [whitepaper.md](./whitepaper.md) | 发给客户看，介绍产品 |
| 功能对比表 | [feature-comparison.md](./feature-comparison.md) | 客户问"你们有啥功能"时发 |
| SLA 服务条款 | [sla-terms.md](./sla-terms.md) | 签合同时附上 |
| 部署指南 | [deployment-guide.md](./deployment-guide.md) | 技术人员看，证明能部署 |
| 报价单生成器 | [quote-generator.mjs](./quote-generator.mjs) | 客户询价时生成报价单 |
| 演示部署脚本 | [demo-setup.sh](./demo-setup.sh) | 给客户做演示 |
| 4 档样例报价 | [samples/](./samples/) | 直接发客户看参考价 |

### 第 3 步：生成报价单（客户询价时做）

客户问"多少钱"时，打开 PowerShell（Windows 终端），cd 到项目目录，运行：

```powershell
cd d:\桌面\项目\IHUI-AI
node docs/enterprise-service/quote-generator.mjs --tier=business --customers=150 --duration=12 --customer="客户公司名" --out=我的报价单.md
```

参数说明：
- `--tier=` 4 档可选：`starter`(5万/年) / `business`(10万/年) / `enterprise`(30万/年) / `custom`(50万+/年)
- `--customers=` 客户有多少员工就用多少
- `--duration=` 订阅几个月（12=1年，24=2年，36=3年，多年有折扣）
- `--customer=` 客户公司名
- `--out=` 生成的报价单保存到哪个文件

生成的 `我的报价单.md` 用 Word 打开排版一下就能发给客户。也可以加 `--pdf=报价单.pdf` 生成 PDF（需先装 puppeteer，可选）。

### 第 4 步：找企业客户（最关键，需要你主动）

客户不会自己找上门，你要主动找。免费渠道：

#### 4.1 技术社区发帖（免费，有效）

在这些地方发帖介绍产品（用 [whitepaper.md](./whitepaper.md) 改写）：

- **V2EX**：https://v2ex.com 写一篇"做了个 AI 平台，找企业客户"，发到 /go/create 节点
- **掘金**：https://juejin.cn 写技术文章 + 软广
- **知乎**：回答"企业如何搭建 AI 平台"类问题，提你的产品
- **CSDN**：发技术博客
- **GitHub Discussions**：在你自己仓库开个 Discussion 标题"企业版咨询"

#### 4.2 朋友圈/微信群

发朋友圈："做了个企业级 AI 平台，支持私有化部署，Agent 市场+知识库+多模型调度+8 端覆盖，有需要的企业朋友私聊"。附上产品截图。

#### 4.3 直接找企业老板

- 你认识的企业老板/IT 负责人，直接微信发产品白皮书
- 行业展会（AI 大会、企业服务展），扫码加微信
- 企查查/天眼查搜"数字化转型"相关企业，打电话

#### 4.4 免费演示

客户有兴趣时，用 [demo-setup.sh](./demo-setup.sh) 给客户做 30 分钟演示。演示流程：
1. 让客户访问你的演示地址（先部署一个 demo 实例）
2. 演示 AI 对话、知识库、Agent 市场
3. 演示管理后台
4. 当场用 quote-generator.mjs 生成报价单

### 第 5 步：签合同 + 收款

客户确认购买后：

1. **签合同**：用 [sla-terms.md](./sla-terms.md) 作为附件，主体合同网上找模板（搜"软件销售合同模板"），填好双方信息，盖章。
2. **收款**：合同约定"首期款 50%（合同签订 7 个工作日内）+ 尾款 50%（上线验收后 15 个工作日内）"。客户对公转账到你公司对公账户。
3. **开发票**：增值税专用发票（6% 软件服务税率），找代账公司或自己用税控盘开。

### 第 6 步：部署交付

收到首期款后，按 [deployment-guide.md](./deployment-guide.md) 部署：

- **公有云 SaaS 模式**：你买云服务器，部署 Docker Compose，给客户开账号
- **私有云模式**：客户自己买服务器，你去客户现场或远程部署
- **混合云模式**：核心数据在客户内网，AI 调用走公网

部署完成后，培训客户使用，等客户验收通过，收尾款。

---

## 路径②：海外 SaaS 订阅（次推荐）

### 适合谁

- 懂一点英语
- 想做海外市场
- 接受单笔小但量大

### 第 1 步：注册 Stripe（海外收款）

1. 打开 https://dashboard.stripe.com/register
2. 用邮箱注册
3. 填写公司信息（中国公司可以注册，但需要海外银行账户收款）
4. **关键**：需要一个海外银行账户。解决方案：
   - **Stripe Atlas**：https://stripe.com/atlas 花 $500 注册美国公司 + 拿美国银行账户（Mercury），3-4 周
   - **PingPong/Lianlian**：国内跨境收款服务，绑定 Stripe，成本低
5. 拿到 3 个 key 后，配置到 `apps/api/.env`：
   ```
   STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_SECRET_KEY=sk_live_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

### 第 2 步：买海外服务器 + 域名

1. **服务器**：https://www.digitalocean.com 或 https://www.vultr.com 买一台（$20/月起，4 核 8G）
2. **域名**：https://www.namecheap.com 买（如 ihui-ai.com，$10/年）
3. **DNS 解析**：把域名指向服务器 IP
4. **HTTPS**：用 Let's Encrypt 免费证书（部署脚本会自动配）

### 第 3 步：部署上线

```powershell
cd d:\桌面\项目\IHUI-AI
# 用 docker-compose 一键部署（参考 deployment-guide.md）
docker compose up -d
```

### 第 4 步：海外推广

- **Product Hunt**：https://www.producthunt.com 发布产品，海外开发者聚集地
- **HackerNews**：https://news.ycombinator.com 发 "Show HN" 帖子
- **Reddit**：r/SideProject, r/SaaS 发帖
- **Twitter/X**：发产品演示视频
- **dev.to / Hashnode**：写技术博客

---

## 路径③：国内 SaaS 订阅（最慢，但市场大）

### 第 1 步：ICP 备案（必须，20 天起）

1. 买阿里云/腾讯云服务器（国内节点，4 核 8G，¥300/月起）
2. 买域名（ihui.ai 已被占，考虑 ihui-ai.com / zhihuiai.com）
3. 通过云服务商提交 ICP 备案：
   - 阿里云：https://beian.aliyun.com
   - 腾讯云：https://cloud.tencent.com/product/ba
4. 准备材料：营业执照 + 法人身份证 + 域名证书 + 服务器信息
5. 等 20 个工作日，拿到 ICP 备案号

### 第 2 步：公安联网备案

ICP 备案通过后 30 天内，到当地公安局网安部门备案（或网上提交）。

### 第 3 步：注册微信支付 + 支付宝商户

#### 微信支付
1. https://pay.weixin.qq.com 申请商户号
2. 准备：营业执照 + 法人身份证 + 对公账户 + ICP 备案
3. 1-5 天审核
4. 拿到：mch_id + api_key + 证书文件
5. 配置到 `apps/api/.env`：
   ```
   WECHAT_PAY_MCH_ID=xxx
   WECHAT_PAY_API_KEY=xxx
   WECHAT_PAY_CERT_PATH=/path/to/apiclient_cert.pem
   WECHAT_PAY_KEY_PATH=/path/to/apiclient_key.pem
   ```

#### 支付宝
1. https://open.alipay.com 申请应用
2. 准备：营业执照 + 法人身份证 + 对公账户
3. 1-3 天审核
4. 拿到：app_id + private_key + alipay_public_key
5. 配置到 `apps/api/.env`：
   ```
   ALIPAY_APP_ID=xxx
   ALIPAY_PRIVATE_KEY=xxx
   ALIPAY_PUBLIC_KEY=xxx
   ```

### 第 4 步：部署上线

同路径②，但服务器在国内，域名已备案。

### 第 5 步：国内推广

- **V2EX / 掘金 / 知乎 / CSDN**：发技术文章
- **微信群**：AI 相关群发软广
- **B 站**：录产品演示视频
- **小红书**：AI 工具推荐类内容

---

## 路径④：API 开放平台（开发者付费）

### 适合谁

- 有开发者资源
- 想被动收入

### 第 1 步：注册 AI 厂商 API Key

在 9 家厂商注册账号充值拿 Key（这是成本，先充 ¥100-500 测试）：

| 厂商 | 注册地址 | 充值门槛 |
|------|---------|---------|
| OpenAI | https://platform.openai.com | $5 起 |
| Anthropic | https://console.anthropic.com | $5 起 |
| Google Gemini | https://ai.google.dev | 免费额度 |
| DeepSeek | https://platform.deepseek.com | ¥10 起 |
| 阿里通义 | https://dashscope.aliyun.com | 免费额度 |
| 字节豆包 | https://volcengine.com | 免费额度 |
| 月之暗面 Kimi | https://platform.moonshot.cn | ¥10 起 |
| 智谱清言 | https://open.bigmodel.cn | 免费额度 |
| MiniMax | https://platform.minimaxi.com | 免费额度 |

### 第 2 步：配置 API Key

把 9 家厂商的 Key 配置到 `apps/ai-service/.env` 的 `LLM_PROVIDERS` JSON（参考 `.env.example`）。

### 第 3 步：发布 SDK

4 语言 SDK 代码已就绪（`sdks/` 目录），需要你配置 GitHub Secrets 后发布：

1. 注册包管理器账号：
   - npm：https://www.npmjs.com/signup
   - PyPI：https://pypi.org/account/register/
   - Maven Central：https://central.sonatype.org/register/
   - Go 不需要发布，直接 `go get` 拉取
2. 在 GitHub 仓库 Settings → Secrets and variables → Actions 添加：
   - `NPM_TOKEN`（npm access token）
   - `PYPI_TOKEN`（PyPI API token）
   - `MAVEN_USERNAME` + `MAVEN_PASSWORD`（Sonatype OSSRH）
   - `GPG_PRIVATE_KEY` + `GPG_PASSPHRASE`（Maven 签名）
3. 打 tag 触发发布：
   ```powershell
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. GitHub Actions 自动发布 4 个 SDK

### 第 4 步：定价

已在 `/pricing` 页面配置：免费版(¥0) / 个人版(¥29/月) / 团队版(¥99/月) / 企业版(¥499/月)。开发者调用 API 按 token 计费，你赚差价。

---

## 路径⑤：AI 教育课程（被动收入）

### 第 1 步：录制课程

5 门课程 35 章节骨架已 seed 到数据库，证书模板已就绪。你需要：

1. 打开 `/study` 页面看课程大纲
2. 每章节录 15-30 分钟视频（用 OBS Studio 录屏，免费）
3. 上传到平台（自建 + B 站/YouTube 引流）

### 第 2 步：配置付费墙

课程已关联 VIP 等级，用户付费升级 VIP 后解锁。你只需确保支付通道就绪（路径②或③）。

---

## 我（AI）能继续帮你做的

以下不需要你操作，我可以直接做，告诉我做哪个：

1. **创建 GitHub Release v0.1.0 release notes**：tag 已存在，但 GitHub 网页没创建 release 页面。需装 gh CLI（winget install GitHub.cli），我可以装并创建。
2. **写产品营销文案**：8 平台发布文案（V2EX/掘金/知乎/CSDN/Twitter/Reddit/dev.to/Hashnode）
3. **生成产品演示视频脚本**：30 分钟演示流程脚本
4. **写企业冷邮件模板**：找企业客户时发的邮件模板
5. **部署一个在线 demo 实例**：如果你有云服务器，我可以帮你部署

## 你必须本人做的（AI 无法代办）

| 事项 | 为什么无法代办 |
|------|--------------|
| 注册营业执照 | 需你本人身份证 + 签字 |
| 开对公银行账户 | 需法人本人到场 + 身份证 |
| ICP 备案 | 需营业执照 + 法人身份证 + 真实信息核验 |
| 注册 Stripe/微信支付/支付宝 | 需营业执照 + 法人身份证 + 银行账户 |
| 签企业合同 | 需法人签字 + 公章 |
| 收款 | 钱必须到你公司账户 |
| 录课程视频 | 需你本人出镜或录音 |

---

## 检查清单（照着打勾）

### 最快路径（企业版）检查清单

- [ ] 注册了公司（营业执照）
- [ ] 开了对公银行账户
- [ ] 刻了公章/合同章
- [ ] 读了 [whitepaper.md](./whitepaper.md) 知道产品卖点是啥
- [ ] 在 V2EX/掘金/知乎发了介绍帖
- [ ] 朋友圈发了产品广告
- [ ] 联系了 3 个认识的企业老板
- [ ] 用 quote-generator.mjs 生成过 1 份报价单
- [ ] 给客户做过 1 次演示
- [ ] 签了 1 份合同
- [ ] 收到首期款
- [ ] 部署交付完成
- [ ] 收到尾款 ✅ 第一笔钱到手

### SaaS 路径检查清单

- [ ] 注册了 Stripe / 微信支付 / 支付宝商户
- [ ] 配置了 API key 到 .env
- [ ] 买了服务器 + 域名
- [ ] ICP 备案通过（国内 SaaS）
- [ ] 部署上线
- [ ] 在社区发了推广帖
- [ ] 第一个付费用户 ✅

---

## 遇到问题怎么办

- **技术问题**（部署/代码/配置）：直接问我，我能解决
- **商务问题**（怎么谈客户/怎么定价）：我可以给建议
- **合规问题**（备案/税务/合同）：建议找当地代账公司或律所咨询，¥500-2000/月

---

**最后一句**：代码全部就绪，物料全部就绪。你不行动，一分钱挣不到。从今天开始，先做路径①企业版，发 3 个朋友圈 + 联系 3 个企业老板，1 周内必有回音。
