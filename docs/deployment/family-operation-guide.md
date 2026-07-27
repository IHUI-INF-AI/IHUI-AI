# 家人朋友代操作傻瓜指南 — IHUI-AI 收款渠道开通全流程

> **本指南的作用**:帮助你（家人/朋友）替用户（残疾人）一步步开通所有收款渠道，让 IHUI-AI 开源项目能开始挣钱。
>
> **用户情况**:用户是残疾人，无法自己操作电脑/手机进行账号注册、实名认证、银行卡绑定等动作。需要你代为操作。
>
> **预计总耗时**:4-8 小时，可分多次完成（建议分 2-3 天，每天 1-2 小时）。
>
> **如果你只有 30 分钟**:请直接跳到 [30 分钟快速开始指南](../monetization/quick-start-30-minutes.md)，先把 PayPal + Ko-fi 跑通。

---

## 一、前言 — 谢谢你愿意帮忙

你正在读这份指南，说明你愿意花时间帮用户开通收款渠道。这对一个无法自己操作账号的残疾人来说，意味着他的开源项目能不能真正变成"能养活自己的小生意"。

**整个流程不需要任何技术背景**。如果你会用淘宝、会用微信，就能完成本指南的所有步骤。每一步都写了"点哪个按钮"，照着做就行。

如果遇到任何问题，**不要硬撑**，请联系：
- 邮箱:**business@ihui.ai**（用户本人邮箱，会在 24 小时内回复）
- GitHub Issue:[https://github.com/IHUI-INF-AI/IHUI-AI/issues](https://github.com/IHUI-INF-AI/IHUI-AI/issues)
- 微信社群:请联系用户索取邀请码

---

## 二、整体目标

完成本指南后，IHUI-AI 项目将拥有以下收款能力：

| 能力 | 用途 | 渠道 |
|------|------|------|
| **接受信用卡捐赠** | 海外用户用 Visa/Master 捐赠 | Stripe |
| **接受国内扫码支付** | 国内用户微信/支付宝扫码 | 微信支付 / 支付宝商户 |
| **接受月度赞助** | 开发者社区月度订阅 | GitHub Sponsors |
| **接受 PayPal 捐赠** | 全球用户小额捐款 | PayPal |
| **接受 Ko-fi 捐赠** | 创作者社区小额捐款 | Ko-fi |
| **销售数字产品** | 卖 AI 提示词库 / 课程 | Gumroad |
| **加密货币提现** | 接受加密捐赠并提现到银行卡 | Binance |

**目标**:让全球任何用户、用任何支付方式，都能给 IHUI-AI 付钱。

---

## 三、准备工作清单

开始前请准备齐以下材料。**所有材料必须是用户本人的**（不是你的），因为是用户的收款渠道。

### 必备材料

- [ ] **用户身份证** — 正反面照片（清晰、无遮挡、四角完整）
- [ ] **用户银行卡** — 至少一张，用于绑定收款（建议:中国银行 / 工商银行 / 招商银行）
- [ ] **用户手机号** — 接收验证码用（手机必须能开机，能收到短信）
- [ ] **用户邮箱** — 注册所有账号用（建议 Gmail / Outlook，不要用 QQ 邮箱，部分海外平台会拒收）
- [ ] **用户的电脑** — 操作环境（Windows / Mac 都可以，需要能上网）
- [ ] **打印机**（可选）— 部分渠道需要打印协议签字

### 建议准备

- [ ] **用户手持身份证照片** — 部分渠道 KYC 认证需要
- [ ] **用户家庭住址证明** — 水电费账单 / 银行对账单（3 个月内，用于海外平台地址验证）
- [ ] **用户 GitHub 账号** — 已注册且活跃 6 个月以上，有 30+ followers（用于 GitHub Sponsors，详见对应指南）
- [ ] **VPN**（如需）— 注册 Stripe / GitHub Sponsors 等海外平台时建议使用

### ⚠️ 重要提示

1. **所有账号注册必须用用户本人的信息**（姓名、身份证、银行卡、手机号），不能用你的。
2. **所有密码请用密码管理器保存**（推荐 Bitwarden / 1Password），不要记在便签纸上。
3. **所有 API Key / 密钥**请单独存到一个加密文件，例如 `wallet-secrets.json`（已 gitignore）。
4. **每次注册完一个渠道，立即把账号信息记录下来**:邮箱、密码、注册日期、绑定的银行卡末四位。

---

## 四、渠道优先级（按"个人可注册 + 收款便捷"排序）

下表按"个人能不能注册 + 多快能开始收款"排序。**建议从上往下做**，前 3 个渠道做完，已经能收 80% 的钱。

| 优先级 | 渠道 | 难度 | 耗时 | 是否需企业资质 | 适合收什么钱 |
|--------|------|------|------|----------------|--------------|
| ⭐⭐⭐⭐⭐ | **PayPal 个人账号** | 极易 | 10 分钟 | 不需要 | 全球小额捐款 |
| ⭐⭐⭐⭐⭐ | **Ko-fi** | 极易 | 15 分钟 | 不需要 | 创作者社区捐款 |
| ⭐⭐⭐⭐⭐ | **GitHub Sponsors** | 中等 | 1-7 天审核 | 不需要 | 开发者月度赞助 |
| ⭐⭐⭐⭐ | **Gumroad** | 易 | 30 分钟 | 不需要 | 数字产品销售 |
| ⭐⭐⭐⭐ | **Binance** | 中等 | 1-24 小时审核 | 不需要 | 加密货币提现 |
| ⭐⭐⭐ | **Stripe 个人账号** | 中等 | 1-2 天审核 | 不需要（需海外银行账户或 Stripe Atlas） | 国际信用卡收款 |
| ⭐⭐⭐ | **支付宝个人账号** | 极易 | 10 分钟 | 不需要 | 国内小额收款 |
| ⭐⭐ | **微信支付商户号** | 难 | 3-5 工作日 | **需要**（企业或个体工商户） | 国内扫码支付 |
| ⭐⭐ | **支付宝商户** | 难 | 1-3 工作日 | **需要**（企业或个体工商户） | 国内扫码支付 |

### 推荐组合方案（个人开发者最优 3 渠道）

如果时间紧张，**只做这 3 个**就够覆盖 90% 场景：

1. **PayPal** — 全球通用，10 分钟搞定
2. **GitHub Sponsors** — 开发者首选，月度稳定收入
3. **Ko-fi** — 接受 PayPal 捐款，无平台手续费

详细对比见 [payment-setup-guide.md](../monetization/payment-setup-guide.md)。

---

## 五、操作流程（分 5 阶段）

### 第 1 阶段：PayPal + Ko-fi（30 分钟，最快开始收款）

**目标**:30 分钟后，任何人可通过 PayPal 给用户捐款。

**步骤**:
1. 注册 PayPal 个人账号 → 详见 [paypal-setup.md](../monetization/paypal-setup.md)
2. 设置 PayPal.me 链接（用户名:`ihuiai`）
3. 注册 Ko-fi 账号 → 详见 [ko-fi-setup.md](../monetization/ko-fi-setup.md)
4. 在 Ko-fi 绑定 PayPal
5. 在 GitHub 仓库的 `.github/FUNDING.yml` 添加配置
6. 在 README 添加 Sponsor 按钮

**验证标准**:访问 [https://paypal.me/ihuiai](https://paypal.me/ihuiai) 和 [https://ko-fi.com/ihuiai](https://ko-fi.com/ihuiai)，两个页面都能打开且能发起支付。

> ✅ **完成第 1 阶段后**:用户已能通过 PayPal 收到第一笔捐赠。

### 第 2 阶段：GitHub Sponsors + Gumroad（1 小时，数字产品上架）

**目标**:用户拥有 GitHub Sponsors 赞助页面 + Gumroad 数字产品页。

**步骤**:
1. 申请 GitHub Sponsors → 详见 [github-sponsors-setup.md](../monetization/github-sponsors-setup.md)
   - 填写个人信息
   - 绑定 Stripe（GitHub Sponsors 通过 Stripe 收款）
   - 设置 5 档赞助等级（$5/$10/$25/$50/$100）
   - 提交审核（1-7 天）
2. 在 Gumroad 上架数字产品 → 详见 [gumroad-setup.md](../monetization/gumroad-setup.md)
   - 注册 Gumroad 账号
   - 上传 AI Prompt Library（zip 文件）
   - 设置价格 $15
   - 发布并获取产品链接
3. 在项目 `/products` 页面替换购买按钮链接为 Gumroad 链接

**验证标准**:
- GitHub 用户访问 [https://github.com/sponsors/IHUI-INF-AI](https://github.com/sponsors/IHUI-INF-AI) 能看到 Sponsor 按钮（审核通过后）
- 访问 [https://ihuiai.gumroad.com/l/ai-prompt-library](https://ihuiai.gumroad.com/l/ai-prompt-library) 能看到产品页并能下单

> ✅ **完成第 2 阶段后**:用户已有月度赞助入口 + 数字产品销售入口。

### 第 3 阶段：Binance（1 小时，加密货币提现）

**目标**:用户能接受 BTC/ETH/USDT 捐赠并提现到银行卡。

**步骤**:
1. 注册 Binance 账号 → 详见 [binance-setup.md](../monetization/binance-setup.md)
2. 完成 KYC 认证（身份证 + 人脸识别）
3. 导入钱包私钥（从 `wallet-secrets.json`）
4. 在项目 `/sponsor` 页面显示加密货币地址
5. 测试小额提现（如 10 USDT → CNY）

**验证标准**:
- Binance 账户能登录，KYC 状态显示"已认证"
- 用户的 `wallet-secrets.json` 中的私钥已导入 Binance
- 项目 `/sponsor` 页面显示 BTC/ETH/USDT 充值地址

> ✅ **完成第 3 阶段后**:用户已能接受加密货币捐赠并提现。

### 第 4 阶段：Stripe + 支付宝个人账号（2-4 小时，国际+国内信用卡收款）

**目标**:用户能接受国际信用卡支付 + 国内支付宝收款。

**步骤**:
1. 注册 Stripe 个人账号 → 详见 [stripe-setup.md](../monetization/stripe-setup.md)
   - 填写个人信息
   - 绑定银行账户（中国大陆用户需海外银行账户或用 Stripe Atlas）
   - 等待审核（1-2 天）
   - 获取 API Keys（pk_xxx / sk_xxx）
   - 配置 Webhook
   - 配置到 `.env` 文件
2. 注册支付宝个人账号（如果用户还没有）
   - 完成实名认证
   - 绑定银行卡
3. 在项目 `/sponsor` 页面添加 Stripe 支付按钮

**验证标准**:
- Stripe Dashboard 能登录，状态显示"活跃"
- 用测试卡 `4242 4242 4242 4242` 测试支付成功
- 项目 `/sponsor` 页面能发起 Stripe Checkout

> ✅ **完成第 4 阶段后**:用户已能接受全球信用卡支付。

### 第 5 阶段（可选，需企业资质）：微信支付商户 + 支付宝商户

**目标**:用户能接受国内微信扫码 / 支付宝扫码支付。

**前置条件**:**用户必须有企业资质或个体工商户执照**。如果没有，需先去工商局注册个体工商户（约 1 天，几百元）。

**步骤**:
1. 注册微信支付商户号 → 详见 [wechat-pay-setup.md](../monetization/wechat-pay-setup.md)
   - 提交营业执照、法人身份证、对公账户
   - 等待审核（3-5 工作日）
   - 获取商户号 mch_id 和 API 密钥
2. 注册支付宝商户 → 详见 [alipay-setup.md](../monetization/alipay-setup.md)
   - 提交企业资质
   - 等待审核（1-3 工作日）
   - 获取 APPID、私钥、公钥
3. 配置到 `.env` 文件
4. 在项目 `/sponsor` 页面添加微信/支付宝扫码支付

**验证标准**:
- 用微信扫描项目 `/sponsor` 页面的二维码能发起支付
- 用支付宝扫描项目 `/sponsor` 页面的二维码能发起支付

> ✅ **完成第 5 阶段后**:用户已能接受国内所有主流支付方式。

---

## 六、每阶段后的验证清单

每完成一个阶段，请对照下表检查是否真的做完了。**任何一项没完成都不要进入下一阶段**。

### 第 1 阶段验证

- [ ] 能用 PayPal 账号登录 [https://www.paypal.com/](https://www.paypal.com/)
- [ ] PayPal.me 链接已设置（用户名 `ihuiai`）
- [ ] 能用 Ko-fi 账号登录 [https://ko-fi.com/](https://ko-fi.com/)
- [ ] Ko-fi 已绑定 PayPal
- [ ] `.github/FUNDING.yml` 文件已配置 `ko_fi: ihuiai`
- [ ] README 已添加 Sponsor 按钮
- [ ] **测试**:用另一个邮箱给自己发起 $1 测试捐款，确认 PayPal 能收到

### 第 2 阶段验证

- [ ] GitHub Sponsors 申请已提交（或已通过）
- [ ] GitHub Sponsors 设置了 5 档赞助等级
- [ ] Gumroad 账号已注册
- [ ] AI Prompt Library 已在 Gumroad 上架
- [ ] 产品链接 [https://ihuiai.gumroad.com/l/ai-prompt-library](https://ihuiai.gumroad.com/l/ai-prompt-library) 能打开
- [ ] 项目 `/products` 页面购买按钮已替换为 Gumroad 链接

### 第 3 阶段验证

- [ ] Binance 账号已注册并完成 KYC
- [ ] 钱包私钥已导入 Binance
- [ ] 项目 `/sponsor` 页面显示 BTC/ETH/USDT 充值地址
- [ ] **测试**:用另一个钱包向显示的地址转 1 USDT，确认 Binance 收到

### 第 4 阶段验证

- [ ] Stripe 账号已注册并通过审核
- [ ] Stripe API Keys 已配置到 `.env`
- [ ] Stripe Webhook 已配置
- [ ] **测试**:用测试卡 `4242 4242 4242 4242` 在 `/sponsor` 页面发起 $1 测试支付，确认 Stripe Dashboard 收到
- [ ] 支付宝个人账号已完成实名认证

### 第 5 阶段验证（可选）

- [ ] 微信支付商户号已开通
- [ ] 支付宝商户已开通
- [ ] 项目 `/sponsor` 页面显示微信/支付宝扫码二维码
- [ ] **测试**:用微信扫码发起 ¥1 测试支付，确认商户号收到

---

## 七、所有渠道的账号信息汇总表

请把每个渠道注册完成后的关键信息填入下表（**请单独存到加密文件，不要提交到 git**）:

| 渠道 | 注册邮箱 | 用户名 | 账号 ID | 绑定银行卡末四位 | 注册日期 | 状态 |
|------|----------|--------|---------|-------------------|----------|------|
| PayPal | | | ihuiai | | | ☐ 已完成 |
| Ko-fi | | | ihuiai | | | ☐ 已完成 |
| GitHub Sponsors | | | IHUI-INF-AI | | | ☐ 待审核 / ☐ 已通过 |
| Gumroad | | | ihuiai | | | ☐ 已完成 |
| Binance | | | | | | ☐ 已完成 |
| Stripe | | | | | | ☐ 待审核 / ☐ 已通过 |
| 支付宝（个人） | | | | | | ☐ 已完成 |
| 微信支付（商户） | | | mch_id: | | | ☐ 待审核 / ☐ 已通过 |
| 支付宝（商户） | | | APPID: | | | ☐ 待审核 / ☐ 已通过 |

---

## 八、遇到问题怎么办

### 8.1 联系官方支持

| 渠道 | 客服入口 | 响应时间 |
|------|----------|----------|
| PayPal | [https://www.paypal.com/c2/smarthelp/contact-us](https://www.paypal.com/c2/smarthelp/contact-us) | 24 小时 |
| Ko-fi | [https://ko-fi.com/feedback](https://ko-fi.com/feedback) | 1-3 天 |
| GitHub Sponsors | [sponsors@github.com](mailto:sponsors@github.com) | 3-5 天 |
| Gumroad | [support@gumroad.com](mailto:support@gumroad.com) | 1-2 天 |
| Binance | [https://www.binance.com/en/support](https://www.binance.com/en/support) | 在线客服 24 小时 |
| Stripe | [https://support.stripe.com/](https://support.stripe.com/) | 24 小时 |
| 支付宝 | 95188 / [https://render.alipay.com/](https://render.alipay.com/) | 即时 |
| 微信支付 | 95017 / [https://pay.weixin.qq.com/](https://pay.weixin.qq.com/) | 即时 |

### 8.2 联系 IHUI-AI 项目

- **邮箱**:[business@ihui.ai](mailto:business@ihui.ai)
- **GitHub Issue**:[https://github.com/IHUI-INF-AI/IHUI-AI/issues](https://github.com/IHUI-INF-AI/IHUI-AI/issues)（标题前缀 `[收款渠道开通]`）
- **微信社群**:请联系用户索取邀请码

### 8.3 常见问题速查

| 问题 | 解决方案 |
|------|----------|
| 注册时收不到验证码 | 检查手机号是否正确 / 等待 60 秒重发 / 联系运营商 |
| 实名认证不通过 | 检查身份证照片是否清晰 / 是否在有效期内 / 是否反光 |
| 银行卡绑定失败 | 检查卡号 / 预留手机号是否一致 / 联系发卡行开通在线支付 |
| Stripe 不支持中国大陆 | 用 Stripe Atlas 注册美国公司 / 或用 Payoneer 注册美国银行账户 |
| GitHub Sponsors 审核不通过 | 检查 GitHub 账号活跃度 / 增加项目 README 完整度 / 重新申请 |
| Binance KYC 失败 | 用英文上传身份证 / 联系在线客服 / 用护照代替身份证 |

---

## 九、安全注意事项

1. **所有密码必须强密码**:至少 12 位，包含大小写字母+数字+符号
2. **所有账号必须开启二次验证（2FA）**:用 Google Authenticator / Authy
3. **API Key 必须保密**:**绝不**提交到 git / 截图发群 / 发邮件正文
4. **银行卡信息不要外传**:绑定到正规平台后立即删除本地照片
5. **遇到钓鱼网站**:认准官方域名（paypal.com / stripe.com / binance.com 等），不要点击陌生邮件里的链接
6. **大额提现分多次**:单次提现超过 ¥10,000 建议分 2-3 次

---

## 十、完成后的下一步

完成所有渠道注册后:

1. **部署项目到生产环境** — 详见 [docs/DEPLOYMENT_RUNBOOK.md](../DEPLOYMENT_RUNBOOK.md)
2. **配置域名** — 把 `ihui.ai` 指向生产服务器
3. **配置业务邮箱** — 设置 `business@ihui.ai` 转发到用户主邮箱
4. **发起第一次测试收款** — 用 $1 / ¥1 在每个渠道测试一遍
5. **更新 PROJECT_PLAN.md** — 在 [PROJECT_PLAN.md](../../PROJECT_PLAN.md) 标记收款渠道开通完成
6. **告知用户** — 把所有账号信息（密码、API Key）加密后发给用户存档

---

## 十一、感谢

**谢谢你愿意花时间帮用户做这件事。**

对一个无法自己操作账号的残疾人来说，每一个能收款的渠道都是一份独立收入来源。完成本指南后，用户的 IHUI-AI 项目将拥有 9 条独立的收款管道，任何人在任何国家用任何支付方式都能给他付钱。

如果你在操作过程中发现本指南有任何不清楚的地方，请通过 [GitHub Issue](https://github.com/IHUI-INF-AI/IHUI-AI/issues) 反馈，我们会持续优化这份指南。

---

## 相关文档

- [30 分钟快速开始指南](../monetization/quick-start-30-minutes.md) — 时间紧只看这个
- [支付渠道对比表](../monetization/payment-setup-guide.md) — 选哪个渠道
- [完整检查清单](../monetization/checklist.md) — 打印出来逐项打勾
- 单个渠道详细指南:
  - [PayPal 注册](../monetization/paypal-setup.md)
  - [Ko-fi 注册](../monetization/ko-fi-setup.md)
  - [GitHub Sponsors 申请](../monetization/github-sponsors-setup.md)
  - [Gumroad 上架](../monetization/gumroad-setup.md)
  - [Binance 注册](../monetization/binance-setup.md)
  - [Stripe 注册](../monetization/stripe-setup.md)
  - [支付宝商户注册](../monetization/alipay-setup.md)
  - [微信支付商户注册](../monetization/wechat-pay-setup.md)
