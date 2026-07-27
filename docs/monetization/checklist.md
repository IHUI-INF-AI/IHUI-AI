# IHUI-AI 收款渠道开通 — 完整检查清单

> **用途**:打印这份清单，每完成一项打勾。所有项目打勾 = 所有收款渠道已开通。
>
> **总耗时**:4-8 小时（可分多次完成）
>
> **配套文档**:[家人朋友代操作总指南](../deployment/family-operation-guide.md)

---

## 一、准备工作（30 分钟）

### 必备材料

- [ ] 用户身份证 — 正反面照片（清晰、无遮挡、四角完整）
- [ ] 用户银行卡 — 至少一张，用于绑定收款
- [ ] 用户手机号 — 接收验证码用（手机能开机）
- [ ] 用户邮箱 — 注册所有账号用（建议 Gmail / Outlook）
- [ ] 用户的电脑 — 操作环境
- [ ] 打印机（可选）

### 建议准备

- [ ] 用户手持身份证照片
- [ ] 用户家庭住址证明（水电费账单 / 银行对账单，3 个月内）
- [ ] 用户的 GitHub 账号（活跃 6 个月 + 30 followers）
- [ ] VPN（注册 Stripe / GitHub Sponsors 用）
- [ ] 密码管理器（Bitwarden / 1Password）

### 账号信息汇总表（完成后填写，存到加密文件）

| 渠道 | 注册邮箱 | 用户名 | 账号 ID | 绑定银行卡末四位 | 注册日期 | 状态 |
|------|----------|--------|---------|-------------------|----------|------|
| PayPal | | | ihuiai | | | ☐ |
| Ko-fi | | | ihuiai | | | ☐ |
| GitHub Sponsors | | | IHUI-INF-AI | | | ☐ |
| Gumroad | | | ihuiai | | | ☐ |
| Binance | | | | | | ☐ |
| Stripe | | | | | | ☐ |
| 支付宝（个人） | | | | | | ☐ |
| 支付宝（商户） | | | APPID: | | | ☐ |
| 微信支付（商户） | | | mch_id: | | | ☐ |

---

## 二、第 1 阶段:PayPal + Ko-fi（30 分钟）

详见:[家人朋友代操作总指南](../deployment/family-operation-guide.md) 第 1 阶段

### PayPal 个人账号

- [ ] 已访问 [https://www.paypal.com](https://www.paypal.com) 注册
- [ ] 选择 Personal Account
- [ ] 填写用户邮箱、密码、个人信息
- [ ] 完成邮箱验证
- [ ] 绑定用户银行卡（4 位数验证码）
- [ ] 实名认证（上传身份证）
- [ ] PayPal 审核通过（1-2 天）

### PayPal.me 链接

- [ ] 已访问 [https://www.paypal.com/paypalme/](https://www.paypal.com/paypalme/)
- [ ] 设置用户名 `ihuiai`
- [ ] 完善头像和简介
- [ ] 链接 `https://paypal.me/ihuiai` 可访问

### Ko-fi 账号

- [ ] 已访问 [https://ko-fi.com](https://ko-fi.com) 注册
- [ ] 用 Google 账号注册（最快）
- [ ] 设置账号名 `ihuiai`
- [ ] 上传头像和简介
- [ ] 绑定 PayPal
- [ ] 设置赞助等级（$3 / $10 / $25）
- [ ] 启用一次性捐款
- [ ] 链接 `https://ko-fi.com/ihuiai` 可访问

### 项目集成

- [ ] `.github/FUNDING.yml` 已添加 `ko_fi: ihuiai`
- [ ] `.github/FUNDING.yml` 已添加 `paypal: ihuiai`
- [ ] `README.md` 已添加 Ko-fi / PayPal 按钮
- [ ] `/sponsor` 页面已添加 Ko-fi / PayPal 按钮

### 测试

- [ ] 用另一个邮箱向 [https://paypal.me/ihuiai](https://paypal.me/ihuiai) 发起 $1 测试
- [ ] PayPal 账户收到测试款
- [ ] 用另一个邮箱向 [https://ko-fi.com/ihuiai](https://ko-fi.com/ihuiai) 发起 $3 测试
- [ ] PayPal 账户收到 Ko-fi 测试款

> ✅ **第 1 阶段完成**:用户已能通过 PayPal 收到全球捐款

---

## 三、第 2 阶段:GitHub Sponsors + Gumroad（1 小时）

详见:[家人朋友代操作总指南](../deployment/family-operation-guide.md) 第 2 阶段

### GitHub Sponsors 申请

- [ ] GitHub 账号活跃 ≥ 6 个月
- [ ] GitHub 账号有 30+ followers
- [ ] 已访问 [https://github.com/sponsors](https://github.com/sponsors) 申请
- [ ] 填写个人信息（姓名、地址、出生日期）
- [ ] 连接 Stripe 账号（详见 [stripe-setup.md](./stripe-setup.md)）
- [ ] 填写税务信息（W-8BEN）
- [ ] 设置 5 档赞助等级（$5/$10/$25/$50/$100）
  - [ ] Bronze: $5
  - [ ] Silver: $10
  - [ ] Gold: $25
  - [ ] Platinum: $50
  - [ ] Diamond: $100
- [ ] 填写 Sponsors 页面介绍
- [ ] 提交审核
- [ ] GitHub 审核通过（1-7 天）
- [ ] [https://github.com/sponsors/IHUI-INF-AI](https://github.com/sponsors/IHUI-INF-AI) 可访问

### GitHub Sponsors 项目集成

- [ ] `.github/FUNDING.yml` 已添加 `github: [IHUI-INF-AI]`
- [ ] `README.md` 已添加 GitHub Sponsors 按钮
- [ ] `/sponsor` 页面已添加 GitHub Sponsors 按钮

### Gumroad 数字产品上架

- [ ] 已访问 [https://gumroad.com](https://gumroad.com) 注册
- [ ] 设置 Display name `IHUI-AI`
- [ ] 设置 Profile URL `ihuiai`
- [ ] 验证邮箱
- [ ] 绑定 PayPal 或银行账户
- [ ] 创建产品:IHUI-AI Prompt Library
- [ ] 填写产品描述
- [ ] 上传产品文件（ai-prompt-library.zip）
- [ ] 设置价格 $15
- [ ] 启用"客户加价"（最低 $5）
- [ ] 上传封面图
- [ ] 设置分类和标签
- [ ] 发布产品
- [ ] 链接 [https://ihuiai.gumroad.com/l/ai-prompt-library](https://ihuiai.gumroad.com/l/ai-prompt-library) 可访问

### Gumroad 项目集成

- [ ] `/products` 页面购买按钮链接替换为 Gumroad 链接
- [ ] `README.md` 已添加 Premium Products 章节链接
- [ ] `.github/FUNDING.yml` 已添加 `custom: ["https://ihuiai.gumroad.com/l/ai-prompt-library"]`

### 测试

- [ ] 用另一个 GitHub 账号发起 $5 测试赞助（GitHub Sponsors 审核通过后）
- [ ] 用另一个邮箱在 Gumroad 发起 $5 测试购买
- [ ] 确认能下载 Gumroad 产品文件

> ✅ **第 2 阶段完成**:用户有月度赞助入口 + 数字产品销售入口

---

## 四、第 3 阶段:Binance（1 小时）

详见:[家人朋友代操作总指南](../deployment/family-operation-guide.md) 第 3 阶段

### Binance 账号注册

- [ ] 已访问 [https://www.binance.com](https://www.binance.com) 注册
- [ ] 填写邮箱和密码
- [ ] 完成滑动验证
- [ ] 邮箱验证
- [ ] KYC 认证
  - [ ] 选择国家 China
  - [ ] 填写个人信息
  - [ ] 上传身份证正面
  - [ ] 上传身份证反面
  - [ ] 人脸识别
  - [ ] 提交审核
- [ ] KYC 审核通过（1-24 小时）

### Binance 安全设置

- [ ] 绑定 Google Authenticator（2FA）
- [ ] 保存 Backup Key 到安全位置
- [ ] 设置反钓鱼码

### Binance 充值地址

- [ ] 获取 BTC 充值地址
- [ ] 获取 ETH 充值地址（ERC20）
- [ ] 获取 USDT 充值地址（TRC20）
- [ ] 获取 USDC 充值地址（ERC20）
- [ ] 获取 BNB 充值地址（BSC）

### 钱包私钥导入

- [ ] 读取用户的 `wallet-secrets.json` 中的私钥
- [ ] 用 MetaMask / Trust Wallet 导入私钥
- [ ] 把现有加密货币转入 Binance 充值地址

### 项目集成

- [ ] `/sponsor` 页面显示 BTC / ETH / USDT / USDC 充值地址
- [ ] `.env` 文件已配置:
  - [ ] `NEXT_PUBLIC_BTC_ADDRESS=`
  - [ ] `NEXT_PUBLIC_ETH_ADDRESS=`
  - [ ] `NEXT_PUBLIC_USDT_TRC20_ADDRESS=`
  - [ ] `NEXT_PUBLIC_USDC_ADDRESS=`

### 测试

- [ ] 用另一个钱包向 USDT 地址转 1 USDT
- [ ] 确认 Binance 现货账户收到 1 USDT
- [ ] 卖 1 USDT 通过 P2P 交易换 CNY
- [ ] 确认 CNY 到账银行卡

> ✅ **第 3 阶段完成**:用户能接受加密货币捐赠并提现到银行卡

---

## 五、第 4 阶段:Stripe + 支付宝个人（2-4 小时）

详见:[家人朋友代操作总指南](../deployment/family-operation-guide.md) 第 4 阶段

### Stripe 个人账号

#### 中国大陆用户的特殊处理（如有海外银行账户可跳过）

- [ ] 已注册 Payoneer 账号（虚拟美国银行账户） — 或 -
- [ ] 已用 Stripe Atlas 注册美国 LLC — 或 -
- [ ] 已有海外银行账户

#### Stripe 注册

- [ ] 已访问 [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
- [ ] 填写邮箱、姓名、密码
- [ ] 选择国家（US / HK / SG）
- [ ] 验证邮箱
- [ ] 填写 Business details（Individual）
- [ ] 填写 Industry（Software / SaaS）
- [ ] 填写 Personal details
- [ ] 填写 Bank account（海外银行账户）
- [ ] 上传验证文件（身份证 / 护照）
- [ ] 提交审核
- [ ] Stripe 审核通过（1-2 天）

#### Stripe API Keys

- [ ] 进入 Developers → API keys
- [ ] 复制 Publishable key（`pk_live_xxx`）
- [ ] 复制 Secret key（`sk_live_xxx`）— 只显示一次
- [ ] 保存到加密文件

#### Stripe Webhook

- [ ] 进入 Developers → Webhooks → Add endpoint
- [ ] URL: `https://ihui.ai/api/stripe/webhook`
- [ ] 监听事件:
  - [ ] `checkout.session.completed`
  - [ ] `checkout.session.async_payment_succeeded`
  - [ ] `checkout.session.async_payment_failed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
  - [ ] `payment_intent.payment_failed`
- [ ] 复制 Signing secret（`whsec_xxx`）

#### 项目集成

- [ ] `.env` 已配置:
  - [ ] `STRIPE_SECRET_KEY=`
  - [ ] `STRIPE_PUBLISHABLE_KEY=`
  - [ ] `STRIPE_WEBHOOK_SECRET=`
- [ ] `/sponsor` 页面已添加 Stripe Checkout 按钮
- [ ] 后端已实现 `/api/stripe/checkout` 端点
- [ ] 后端已实现 `/api/stripe/webhook` 端点

#### Stripe 测试

- [ ] 切换到测试模式
- [ ] 用测试卡 `4242 4242 4242 4242` 发起 $1 测试支付
- [ ] Stripe Dashboard 在测试模式能看到支付记录
- [ ] 状态显示 "Succeeded"
- [ ] Webhook 收到 `checkout.session.completed` 事件

### 支付宝个人账号

- [ ] 已下载支付宝 App
- [ ] 用用户手机号注册
- [ ] 完成实名认证（上传身份证）
- [ ] 绑定用户银行卡
- [ ] 在 `/sponsor` 页面显示支付宝收款二维码

> ✅ **第 4 阶段完成**:用户能接受国际信用卡支付 + 国内支付宝转账

---

## 六、第 5 阶段（可选，需企业资质）:微信支付 + 支付宝商户

详见:[家人朋友代操作总指南](../deployment/family-operation-guide.md) 第 5 阶段

### 前置条件

- [ ] 用户有企业资质 — 或 -
- [ ] 已注册个体工商户（详见 [wechat-pay-setup.md](./wechat-pay-setup.md) 第 9 节）
- [ ] 对公账户或法人个人银行卡

### 微信支付商户号

- [ ] 已访问 [https://pay.weixin.qq.com](https://pay.weixin.qq.com)
- [ ] 点击"商户接入"
- [ ] 选择 Native 支付（网站扫码）
- [ ] 填写商户基本信息
- [ ] 填写主体信息（上传营业执照）
- [ ] 填写法人身份证
- [ ] 填写结算信息（对公账户）
- [ ] 填写 superadmin 信息
- [ ] 上传补充材料
- [ ] 提交审核
- [ ] 审核通过（3-5 工作日）
- [ ] 登录商户平台
- [ ] 设置 API v3 密钥（32 位字符串）
- [ ] 申请 API 证书
  - [ ] 下载证书工具
  - [ ] 生成证书请求
  - [ ] 下载证书文件
- [ ] 关联 AppID（公众号 / 小程序）

### 微信支付项目集成

- [ ] 证书文件存到 `certs/wechat/`
- [ ] `.gitignore` 已添加 `certs/`
- [ ] `.env` 已配置:
  - [ ] `WECHAT_PAY_APP_ID=`
  - [ ] `WECHAT_PAY_MCH_ID=`
  - [ ] `WECHAT_PAY_API_V3_KEY=`
  - [ ] `WECHAT_PAY_CERT_SERIAL_NO=`
  - [ ] `WECHAT_PAY_PRIVATE_KEY_PATH=`
  - [ ] `WECHAT_PAY_PUBLIC_KEY_PATH=`
- [ ] `/sponsor` 页面已添加微信支付按钮
- [ ] 后端已实现 `/api/wechat/native` 端点
- [ ] 后端已实现 `/api/wechat/notify` 端点

### 微信支付测试

- [ ] 用沙箱参数测试（沙箱 mch_id / 沙箱密钥）
- [ ] 切换到生产模式
- [ ] 用 ¥1 真实支付测试
- [ ] 商户平台收到款
- [ ] 对公账户次日到账

### 支付宝商户

- [ ] 已访问 [https://open.alipay.com](https://open.alipay.com)
- [ ] 登录企业支付宝账号
- [ ] 创建网页应用
- [ ] 填写应用信息
- [ ] 添加能力:
  - [ ] 电脑网站支付
  - [ ] 手机网站支付
  - [ ] 当面付
- [ ] 签约能力
- [ ] 设置接口加签方式（公钥模式）
- [ ] 生成应用私钥 / 应用公钥
- [ ] 上传应用公钥
- [ ] 复制支付宝公钥
- [ ] 设置异步通知 URL `https://ihui.ai/api/alipay/notify`
- [ ] 设置同步跳转 URL `https://ihui.ai/sponsor/success`
- [ ] 提交审核
- [ ] 审核通过（1-3 工作日）
- [ ] 获取 APPID

### 支付宝商户项目集成

- [ ] `.env` 已配置:
  - [ ] `ALIPAY_APP_ID=`
  - [ ] `ALIPAY_PRIVATE_KEY=`
  - [ ] `ALIPAY_PUBLIC_KEY=`
  - [ ] `ALIPAY_GATEWAY_URL=https://openapi.alipay.com/gateway.do`
  - [ ] `ALIPAY_NOTIFY_URL=https://ihui.ai/api/alipay/notify`
  - [ ] `ALIPAY_RETURN_URL=https://ihui.ai/sponsor/success`
- [ ] `/sponsor` 页面已添加支付宝按钮
- [ ] 后端已实现 `/api/alipay/create` 端点
- [ ] 后端已实现 `/api/alipay/notify` 端点

### 支付宝商户测试

- [ ] 用沙箱环境测试
- [ ] 切换到生产模式
- [ ] 用 ¥0.01 真实支付测试
- [ ] 收到异步通知
- [ ] 商户账户到账（T+1）

> ✅ **第 5 阶段完成**:用户能接受国内所有主流支付方式

---

## 七、部署与上线（30 分钟）

### 服务器部署

- [ ] 项目代码已部署到 Vercel / Railway / 自建服务器
- [ ] 数据库已迁移（PostgreSQL）
- [ ] Redis 已配置
- [ ] 环境变量已配置到生产环境:
  - [ ] 所有 `.env` 变量已复制到 Vercel / Railway
  - [ ] 证书文件已上传到服务器
  - [ ] 充值地址变量已配置

### 域名配置

- [ ] 域名 `ihui.ai` 已指向生产服务器
- [ ] SSL 证书已配置（Let's Encrypt / Cloudflare）
- [ ] HTTPS 强制跳转

### 业务邮箱

- [ ] `business@ihui.ai` 邮箱已配置
- [ ] 邮件转发到用户主邮箱
- [ ] 邮件 DKIM / SPF / DMARC 已配置

### 最终测试

- [ ] 访问 [https://ihui.ai](https://ihui.ai) 网站正常打开
- [ ] 访问 [https://ihui.ai/sponsor](https://ihui.ai/sponsor) 赞助页面正常
- [ ] 访问 [https://ihui.ai/products](https://ihui.ai/products) 产品页面正常
- [ ] 测试每个支付渠道:
  - [ ] PayPal 捐款按钮可点击
  - [ ] Ko-fi 按钮可点击
  - [ ] GitHub Sponsors 按钮可点击
  - [ ] Gumroad 购买按钮可点击
  - [ ] Stripe Checkout 可发起
  - [ ] 微信支付二维码可扫描
  - [ ] 支付宝按钮可点击
  - [ ] 加密货币地址可复制
- [ ] 第一次测试收款成功（每个渠道 $1 / ¥1）

---

## 八、安全审计（30 分钟）

### 密码安全

- [ ] 所有账号密码已用密码管理器保存
- [ ] 所有密码 ≥ 12 位，含大小写+数字+符号
- [ ] 没有重复使用密码

### 2FA 已启用

- [ ] PayPal 2FA 已启用
- [ ] Ko-fi（通过 Google）2FA 已启用
- [ ] GitHub 2FA 已启用
- [ ] Gumroad 2FA 已启用
- [ ] Binance Google Authenticator 已绑定
- [ ] Stripe 2FA 已启用

### API Key 安全

- [ ] 所有 API Key 已加密存储
- [ ] `.env` 文件未提交到 git
- [ ] 证书文件未提交到 git
- [ ] `wallet-secrets.json` 未提交到 git
- [ ] `.gitignore` 已包含所有敏感文件

### 反钓鱼码

- [ ] PayPal 反钓鱼码已设置
- [ ] Binance 反钓鱼码已设置
- [ ] GitHub 已启用 2FA 后备码

---

## 九、文档与维护（15 分钟）

- [ ] 所有账号信息已汇总到加密文件（`docs/account-info-encrypted.md`，已 gitignore）
- [ ] 所有密码 / API Key 已加密发给用户存档
- [ ] 在 `PROJECT_PLAN.md` 标记收款渠道开通完成
- [ ] 给用户发一份完成报告，包含:
  - [ ] 已开通的渠道列表
  - [ ] 各渠道账号信息（加密）
  - [ ] 项目集成位置
  - [ ] 后续维护建议

---

## 🎉 全部完成

恭喜！当所有项目都打勾后，IHUI-AI 项目已拥有:

- ✅ **9 条独立收款管道**:PayPal / Ko-fi / GitHub Sponsors / Gumroad / Binance / Stripe / 支付宝个人 / 支付宝商户 / 微信支付商户
- ✅ **全球覆盖**:任何国家、任何支付方式的用户都能给用户付钱
- ✅ **个人可注册渠道**:前 7 个渠道无需企业资质
- ✅ **企业资质渠道**:支付宝商户 + 微信支付商户（如已开通）

**预期效果**:
- 海外开发者可通过 GitHub Sponsors 月度赞助
- 海外用户可通过 PayPal / Stripe 一次性捐款
- 海外用户可用信用卡在 Gumroad 购买数字产品
- 国内用户可用支付宝 / 微信扫码支付
- 加密货币爱好者可捐赠 BTC / ETH / USDT

**后续维护**:
- 每月检查各渠道账号是否正常
- 每周查看是否收到款项
- 每季度更新项目介绍 / 赞助等级
- 每年完成一次税务申报

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md) — 完整 5 阶段流程
- [30 分钟快速开始指南](./quick-start-30-minutes.md) — 时间紧只看这个
- [支付渠道对比表](./payment-setup-guide.md) — 9 种渠道详细对比
- 单个渠道详细指南:
  - [PayPal 注册](./paypal-setup.md)
  - [Ko-fi 注册](./ko-fi-setup.md)
  - [GitHub Sponsors 申请](./github-sponsors-setup.md)
  - [Gumroad 上架](./gumroad-setup.md)
  - [Binance 注册](./binance-setup.md)
  - [Stripe 注册](./stripe-setup.md)
  - [支付宝商户注册](./alipay-setup.md)
  - [微信支付商户注册](./wechat-pay-setup.md)
