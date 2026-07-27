# GitHub Sponsors 申请指南

> **目标**:申请 GitHub Sponsors，让开发者社区能月度赞助 IHUI-AI 项目。
>
> **难度**:⭐⭐⭐ 中等（需 GitHub 账号活跃 6 个月 + 30 followers + 1-7 天审核）
>
> **前置依赖**:已注册 Stripe 账号（GitHub Sponsors 通过 Stripe 收款）

---

## 一、前置条件

- [ ] 用户的 GitHub 账号（已注册且活跃 ≥ 6 个月）
- [ ] GitHub 账号有 **30+ followers**
- [ ] GitHub 账号在 **过去 12 个月内有提交**（contributions）
- [ ] 已注册 Stripe 账号（详见 [stripe-setup.md](./stripe-setup.md)）
- [ ] 用户的身份证
- [ ] 用户的银行账户（与 Stripe 绑定的同一账户）
- [ ] 用户的税务信息（中国大陆:身份证号即可）

---

## 二、GitHub Sponsors 是什么？

**GitHub Sponsors** 是 GitHub 官方的开发者赞助平台，让开发者社区用月度订阅的方式赞助开源项目。

**优势**:
- ✅ **0% 平台费**（GitHub 不收平台费）
- ✅ **不收 0% 处理费**（GitHub 承担 Stripe 处理费）
- ✅ 月度稳定收入（订阅制）
- ✅ GitHub 主页直接显示 Sponsor 按钮
- ✅ 个人可申请（无需企业资质）

**劣势**:
- ❌ 需满足门槛（30+ followers / 6 个月活跃）
- ❌ 审核周期 1-7 天
- ❌ 中国大陆需通过 Stripe 收款

---

## 三、检查前置条件

### 3.1 检查 GitHub 账号活跃度

1. 打开 [https://github.com/IHUI-INF-AI](https://github.com/IHUI-INF-AI)
2. 查看用户主页:
   - **Joined on** 注册日期 — 必须 ≥ 6 个月前
   - **Contributions** 提交日历 — 过去 12 个月内有绿色方块
3. 如果不满足，需先用账号做开发（提交 PR、Issue 等）

### 3.2 检查 Followers 数量

1. 在 GitHub 主页右侧，查看 **Followers** 数字
2. 必须 ≥ 30
3. 如果不够:
   - 在 Twitter / Reddit / Hacker News 等社区推广项目
   - 在 awesome-list PR 中提到项目
   - 写技术博客引流到 GitHub

---

## 四、申请步骤

### 步骤 1:访问 GitHub Sponsors

1. 打开浏览器
2. 地址栏输入:[https://github.com/sponsors](https://github.com/sponsors)
3. 按 Enter

![访问 GitHub Sponsors](screenshot-placeholder)

### 步骤 2:点击 Get started

1. 在 GitHub Sponsors 首页，找到绿色按钮 **"Get started"**
2. 点击它

![点击 Get started](screenshot-placeholder)

### 步骤 3:选择账号

1. 页面会显示你的 GitHub 账号
2. 点击 **"Get started"** 继续

### 步骤 4:填写个人基本信息

1. **Full name**（姓名）:用户身份证上的姓名（拼音）
2. **Country of residence**（居住国家）:**China**
3. **Address line 1**（地址）:用户家庭住址（拼音）
4. **City**（城市）:拼音
5. **Region/State**（省份）:拼音
6. **Postal code**（邮编）
7. **Country of citizenship**（国籍）:**China**
8. **Date of birth**（出生日期）:YYYY-MM-DD
9. 点击 **"Continue"**

![填写个人信息](screenshot-placeholder)

### 步骤 5:选择收款方式

GitHub Sponsors 通过 **Stripe** 收款，所以会要求连接 Stripe 账号。

1. 选择 **"Connect with Stripe"**（连接 Stripe）
2. 点击 **"Continue"**
3. 跳转到 Stripe 授权页面
4. 输入用户 Stripe 账号信息
5. 点击 **"Authorize access to your account"**（授权）
6. 跳回 GitHub Sponsors

> 💡 如果还没注册 Stripe，请先看 [stripe-setup.md](./stripe-setup.md)

![连接 Stripe](screenshot-placeholder)

### 步骤 6:填写税务信息

1. **Tax residence**（税务居住地）:**China**
2. **TIN (Tax Identification Number)**（税务编号）:用户身份证号（18 位）
3. **Tax form**（税务表格）:
   - 选择 **W-8BEN**（非美国居民）
   - 在表格填写用户信息
   - 原因填:"I am a non-resident alien of the US"
4. 点击 **"Continue"**

![填写税务信息](screenshot-placeholder)

### 步骤 7:等待 Stripe 信息同步

1. 页面会显示 Stripe 信息正在同步
2. 等待 1-2 分钟
3. 同步完成后，进入下一步

### 步骤 8:设置赞助等级

页面会要求设置赞助等级（Tier）。建议设置 5 档:

#### Tier 1:Bronze 🥉 — $5 / 月

- **名称**:`Bronze Sponsor`
- **价格**:`$5`（USD）
- **描述**:
  ```
  🎉 Thank you for supporting IHUI-AI!
  
  Benefits:
  - 📛 Name listed in README Sponsors section
  - 💬 Access to sponsor-only discussions
  ```
- **Welcome message**:
  ```
  Welcome aboard! Thank you for supporting IHUI-AI. Your name will be added to the README sponsors section within 7 days.
  ```

#### Tier 2:Silver 🥈 — $10 / 月

- **名称**:`Silver Sponsor`
- **价格**:`$10`
- **描述**:
  ```
  🎉 All Bronze benefits, plus:
  
  - 📊 Monthly progress report (email)
  - 🎨 Early access to new features
  ```

#### Tier 3:Gold 🥇 — $25 / 月

- **名称**:`Gold Sponsor`
- **价格**:`$25`
- **描述**:
  ```
  🎉 All Silver benefits, plus:
  
  - ⭐ Priority Issue response (within 48h)
  - 🏷️ Custom badge in Discussions
  ```

#### Tier 4:Platinum 💎 — $50 / 月

- **名称**:`Platinum Sponsor`
- **价格**:`$50`
- **描述**:
  ```
  🎉 All Gold benefits, plus:
  
  - 📞 Monthly 30-min consultation call
  - 🎯 Feature request prioritization
  - 📛 Logo in README (small)
  ```

#### Tier 5:Diamond 💠 — $100 / 月

- **名称**:`Diamond Sponsor`
- **价格**:`$100`
- **描述**:
  ```
  🎉 All Platinum benefits, plus:
  
  - 🤝 Custom AI Agent development (1 per quarter)
  - 🏷️ Logo in README (large) + homepage
  - 📅 Quarterly roadmap review
  - 🎁 IHUI-AI merch (t-shirt + stickers)
  ```

每设置完一个 Tier 点击 **"Save tier"**。

![设置赞助等级](screenshot-placeholder)

### 步骤 9:填写 Sponsors 页面介绍

1. **Profile image**:上传项目 logo（建议 400×400 px）
2. **Sponsorship headline**:
   ```
   Support the development of IHUI-AI, the open-source full-stack AI platform
   ```
3. **Bio / Description**:
   ```
   IHUI-AI is an open-source full-stack AI platform built with TypeScript Monorepo + 8-platform support (web/api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli).
   
   By sponsoring, you help me:
   - 🚀 Continue developing new features
   - 🛠️ Maintain 8 platforms and 176+ LLM integrations
   - 📚 Write documentation and tutorials
   - 🌍 Keep the project free and open-source
   
   Thank you for your support! 💖
   ```
4. **Links**:
   - Website: `https://ihui.ai`
   - GitHub: `IHUI-INF-AI`
   - Twitter:（如有）
5. 点击 **"Save"**

### 步骤 10:提交审核

1. 检查所有信息无误
2. 点击页面底部 **"Submit for review"**（提交审核）
3. 弹窗确认，点击 **"Submit"**
4. 页面显示"Your application is under review"
5. GitHub 会通过邮件通知审核结果（1-7 天）

![提交审核](screenshot-placeholder)

### 步骤 11:等待审核

审核期间可以做:
- 优化 GitHub README（增加 README 完整度有助于通过）
- 增加 Followers 数量
- 在 GitHub Discussions 增加活跃度

---

## 五、审核通过后的设置

### 5.1 在 GitHub 主页显示 Sponsor 按钮

审核通过后，GitHub 会自动在仓库显示 Sponsor 按钮，无需额外配置。

### 5.2 在 .github/FUNDING.yml 配置（双保险）

1. 打开项目仓库 `.github/FUNDING.yml`
2. 添加:
   ```yaml
   github: [IHUI-INF-AI]
   ```
3. 提交

### 5.3 在 README 添加 Sponsor 按钮

1. 打开 `README.md`
2. 在顶部添加:
   ```markdown
   [![Sponsor](https://img.shields.io/badge/Sponsor-IHUI--AI-E12AC4?style=flat&logo=github-sponsors)](https://github.com/sponsors/IHUI-INF-AI)
   ```

### 5.4 在 /sponsor 页面添加 GitHub Sponsors 按钮

1. 打开 `apps/web/src/app/(main)/sponsor/page.tsx`
2. 在 GitHub Sponsors 按钮组件的 `href` 属性改为:
   ```tsx
   href="https://github.com/sponsors/IHUI-INF-AI"
   ```
3. 保存

---

## 六、收款与税务

### 6.1 收款周期

- GitHub Sponsors **每月 1 日**结算上月赞助
- 通过 Stripe **每月 22 日**打款
- 到达用户银行账户通常需要 2-5 工作日

### 6.2 税务处理

**中国大陆税务**:
- GitHub Sponsors **不代扣税**（W-8BEN 已声明非美国居民）
- 用户需在中国境内**自行申报个人所得税**
- 税率:劳务报酬所得 20%（每年 9.6 万以下有优惠）
- 建议咨询会计师

**美国税务**:
- 已填写 W-8BEN，无需美国预扣税
- GitHub 会发送 1042-S 表格（每年 3 月前）

### 6.3 发票

GitHub Sponsors **不开发票**。如果赞助人需要发票，需用户自行开具（建议注册个体工商户）。

---

## 七、常见问题

### Q1:中国大陆能申请 GitHub Sponsors 吗？

A:**可以**。GitHub Sponsors 支持 36 个国家，包括中国大陆。但需通过 Stripe 收款，所以需先注册 Stripe（中国大陆 Stripe 需用海外银行账户或 Stripe Atlas）。

### Q2:GitHub Sponsors 审核不通过怎么办？

A:
1. 检查 GitHub 账号活跃度（contributions 是否足够）
2. 检查 Followers 数量（< 30 不通过率高）
3. 优化 README（增加项目介绍、截图、文档）
4. 在 GitHub Discussions 增加活跃度
5. 1 个月后重新申请

### Q3:可以接受一次性捐款吗？

A:GitHub Sponsors **只支持月度赞助**。一次性捐款请用 PayPal / Ko-fi。

### Q4:赞助人会自动续费吗？

A:**会**。月度赞助默认自动续费。赞助人可随时在 GitHub Settings → Billing → Sponsors 取消。

### Q5:GitHub Sponsors 与 Open Collective 有什么区别？

A:
| 对比项 | GitHub Sponsors | Open Collective |
|--------|-----------------|------------------|
| 平台费 | 0% | 5-10% |
| 个人赞助 | 支持 | 不支持（需 Fiscal Host） |
| 月度赞助 | 支持 | 支持 |
| 一次性捐款 | 不支持 | 支持 |
| 透明度 | 仅赞助人可见 | 财务全透明 |

### Q6:可以同时接受 PayPal + GitHub Sponsors 吗？

A:**可以**。在 GitHub 仓库 `.github/FUNDING.yml` 配置多个渠道:

```yaml
github: [IHUI-INF-AI]
ko_fi: ihuiai
paypal: ihuiai
```

GitHub 会在 Sponsor 按钮显示所有渠道。

### Q7:Stripe 收款到中国大陆银行账户要多久？

A:Stripe 提现到中国大陆银行账户通常需 5-7 工作日。建议注册 Payoneer（美国银行账户）加速到账。

---

## 八、验证清单

完成后请确认:

- [ ] GitHub Sponsors 申请已提交
- [ ] 已连接 Stripe 账号
- [ ] 已设置 5 档赞助等级（$5/$10/$25/$50/$100）
- [ ] Sponsors 页面已填写完整介绍
- [ ] 审核已通过（访问 [https://github.com/sponsors/IHUI-INF-AI](https://github.com/sponsors/IHUI-INF-AI) 能看到页面）
- [ ] `.github/FUNDING.yml` 已添加 `github: [IHUI-INF-AI]`
- [ ] README 已添加 Sponsor 按钮
- [ ] **测试**:用另一个 GitHub 账号发起 $5 测试赞助，确认 Stripe 收到

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md)
- [支付渠道对比表](./payment-setup-guide.md)
- [Stripe 注册](./stripe-setup.md)（GitHub Sponsors 收款依赖 Stripe）
- [Ko-fi 注册](./ko-fi-setup.md)（互补:一次性捐款）
- [完整检查清单](./checklist.md)
