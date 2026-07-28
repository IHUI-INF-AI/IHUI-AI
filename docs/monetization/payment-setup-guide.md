# 支付渠道对比与配置指南

> 本文档对比 IHUI-AI 项目用到的 9 种支付渠道，帮助家人/朋友选择最容易开通的组合方案。
>
> 配套文档:[家人朋友代操作总指南](../deployment/family-operation-guide.md)

---

## 一、9 种支付渠道对比总表

| 渠道 | 注册难度 | 所需材料 | 收款速度 | 手续费 | 适用场景 | 是否需企业资质 |
|------|----------|----------|----------|--------|----------|----------------|
| **PayPal 个人** | ⭐ 极易 | 邮箱+身份证+银行卡 | 即时到账 | 个人转账免费 / 商业 4.4%+$0.30 | 全球小额捐款 | 否 |
| **Ko-fi** | ⭐ 极易 | 邮箱+PayPal/Stripe | 即时（通过 PayPal） | 0% 平台费（仅 PayPal/Stripe 费） | 创作者社区捐款 | 否 |
| **GitHub Sponsors** | ⭐⭐⭐ 中等 | GitHub 账号+Stripe | 月度结算 | 0% 平台费（仅 Stripe 费） | 开发者月度赞助 | 否 |
| **Gumroad** | ⭐⭐ 易 | 邮箱+PayPal/银行账户 | 每周五结算 | 10%+$0.30/笔 | 数字产品销售 | 否 |
| **Binance** | ⭐⭐⭐ 中等 | 邮箱+手机+身份证 | 即时到账 | 充值免费 / 提现 ~1% | 加密货币提现 | 否 |
| **Stripe 个人** | ⭐⭐⭐ 中等 | 邮箱+身份证+海外银行账户 | 7 天滚动 | 2.9%+$0.30/笔 | 国际信用卡收款 | 否（需海外银行账户） |
| **支付宝个人** | ⭐ 极易 | 手机+身份证+银行卡 | 即时到账 | 个人转账免费 | 国内小额收款 | 否 |
| **微信支付商户** | ⭐⭐⭐⭐ 难 | 营业执照+法人身份证+对公账户 | T+1 | 0.6% / 笔 | 国内扫码支付 | **是** |
| **支付宝商户** | ⭐⭐⭐⭐ 难 | 营业执照+法人身份证+对公账户 | T+1 | 0.6% / 笔 | 国内扫码支付 | **是** |

---

## 二、按维度排序的推荐

### 2.1 按"个人能不能注册"排序（优先个人可注册）

1. **PayPal 个人** — 任何人都能注册
2. **支付宝个人** — 任何人都能注册
3. **Ko-fi** — 只需邮箱和 PayPal/Stripe
4. **Gumroad** — 只需邮箱和 PayPal/银行账户
5. **GitHub Sponsors** — 需 GitHub 账号活跃 6 个月 + 30 followers
6. **Binance** — 只需邮箱+身份证
7. **Stripe 个人** — 需海外银行账户（可用 Payoneer 解决）
8. **微信支付商户** — 需企业资质
9. **支付宝商户** — 需企业资质

### 2.2 按"多快能开始收款"排序

1. **PayPal 个人** — 注册完即可收款（10 分钟）
2. **支付宝个人** — 注册完即可收款（10 分钟）
3. **Ko-fi** — 注册完绑定 PayPal 即可（15 分钟）
4. **Gumroad** — 产品上架后即可（30 分钟）
5. **Binance** — KYC 通过即可（1-24 小时）
6. **Stripe 个人** — 审核通过即可（1-2 天）
7. **GitHub Sponsors** — 审核通过即可（1-7 天）
8. **支付宝商户** — 审核通过即可（1-3 工作日）
9. **微信支付商户** — 审核通过即可（3-5 工作日）

### 2.3 按"手续费最低"排序

1. **Ko-fi** — 0% 平台费（仅 PayPal/Stripe 费）
2. **GitHub Sponsors** — 0% 平台费（仅 Stripe 费）
3. **PayPal 个人转账** — 免费
4. **支付宝个人转账** — 免费
5. **微信支付商户** — 0.6% / 笔
6. **支付宝商户** — 0.6% / 笔
7. **Stripe** — 2.9% + $0.30 / 笔
8. **PayPal 商业收款** — 4.4% + $0.30 / 笔
9. **Gumroad** — 10% + $0.30 / 笔

### 2.4 按"适合收什么钱"排序

| 用途 | 推荐渠道 |
|------|----------|
| 海外开发者月度赞助 | GitHub Sponsors |
| 海外用户小额捐款 | PayPal / Ko-fi |
| 海外用户信用卡支付 | Stripe |
| 销售数字产品（PDF/课程） | Gumroad |
| 国内用户扫码支付 | 微信支付 / 支付宝商户 |
| 国内用户小额转账 | 支付宝个人 / 微信个人 |
| 加密货币捐赠 | Binance（接受）+ 提现到银行卡 |

---

## 三、推荐组合方案

### 3.1 最小可行组合（30 分钟，3 个渠道）⭐⭐⭐⭐⭐

**适合**:时间紧张，想最快开始收钱

1. **PayPal 个人账号** — 全球通用
2. **Ko-fi** — 接受 PayPal 捐款，0% 平台费
3. **支付宝个人** — 国内收款

**覆盖场景**:海外捐款 + 国内转账 = 90% 的小额捐赠场景

### 3.2 开发者最优组合（1 小时，3 个渠道）⭐⭐⭐⭐⭐

**适合**:面向开发者社区

1. **GitHub Sponsors** — 月度赞助，开发者首选
2. **PayPal 个人** — 一次性捐款
3. **Ko-fi** — 接受 PayPal，0% 平台费

**覆盖场景**:开发者社区月度赞助 + 一次性捐款 = 95% 的开发者场景

### 3.3 完整变现组合（4-8 小时，全部 9 个渠道）

**适合**:最大化收入，覆盖所有支付方式

1. **PayPal 个人** — 全球捐款
2. **Ko-fi** — 创作者社区
3. **GitHub Sponsors** — 月度赞助
4. **Gumroad** — 数字产品销售
5. **Binance** — 加密货币提现
6. **Stripe 个人** — 国际信用卡
7. **支付宝个人** — 国内转账
8. **微信支付商户** — 国内扫码（需企业资质）
9. **支付宝商户** — 国内扫码（需企业资质）

**覆盖场景**:全球所有支付方式 = 100% 覆盖

---

## 四、环境变量映射表

每个渠道注册完成后，会拿到一些 Key/密钥/账号 ID。下表说明每个 Key 应该配到 `.env` 文件的哪个变量。

> ⚠️ **重要**:`.env` 文件**绝不**提交到 git。所有 Key 都是机密信息。

### 4.1 Stripe 环境变量

| 注册后拿到 | .env 变量名 | 用途 |
|------------|-------------|------|
| Publishable key (`pk_xxx`) | `STRIPE_PUBLISHABLE_KEY` | 前端发起支付 |
| Secret key (`sk_xxx`) | `STRIPE_SECRET_KEY` | 后端创建 PaymentIntent |
| Webhook Signing secret (`whsec_xxx`) | `STRIPE_WEBHOOK_SECRET` | 验证 Webhook 签名 |

### 4.2 微信支付商户环境变量

| 注册后拿到 | .env 变量名 | 用途 |
|------------|-------------|------|
| 商户号 | `WECHAT_PAY_MCH_ID` | 商户标识 |
| API v3 密钥 | `WECHAT_PAY_API_V3_KEY` | 解密回调 |
| 商户证书序列号 | `WECHAT_PAY_CERT_SERIAL_NO` | API 请求签名 |
| 商户私钥文件路径 | `WECHAT_PAY_PRIVATE_KEY_PATH` | API 请求签名 |
| 商户公钥文件路径 | `WECHAT_PAY_PUBLIC_KEY_PATH` | 验证回调签名 |
| AppID（公众号/小程序） | `WECHAT_PAY_APP_ID` | 关联微信应用 |

### 4.3 支付宝商户环境变量

| 注册后拿到 | .env 变量名 | 用途 |
|------------|-------------|------|
| APPID | `ALIPAY_APP_ID` | 应用标识 |
| 应用私钥 | `ALIPAY_PRIVATE_KEY` | API 请求签名 |
| 支付宝公钥 | `ALIPAY_PUBLIC_KEY` | 验证回调签名 |
| 支付宝网关 | `ALIPAY_GATEWAY_URL` | API 入口（默认 `https://openapi.alipay.com/gateway.do`） |
| 回调地址 | `ALIPAY_NOTIFY_URL` | 支付结果回调（`https://aizhs.top/api/alipay/notify`） |

### 4.4 GitHub Sponsors 环境变量

GitHub Sponsors 通过 Stripe 收款，不需要项目环境变量。只需在 GitHub 仓库的 `.github/FUNDING.yml` 配置:

```yaml
github: [IHUI-INF-AI]
```

### 4.5 Ko-fi 环境变量

Ko-fi 通过 PayPal 收款，不需要项目环境变量。只需在 `.github/FUNDING.yml` 配置:

```yaml
ko_fi: ihuiai
```

### 4.6 Gumroad 环境变量

Gumroad 主要用于销售数字产品，不需要项目环境变量。在项目 `/products` 页面把购买按钮链接替换为 Gumroad 产品链接即可:

```
https://ihuiai.gumroad.com/l/ai-prompt-library
```

### 4.7 PayPal 环境变量

PayPal 个人账号主要用于捐款，不需要项目环境变量。在项目 `/sponsor` 页面添加 PayPal.me 按钮:

```
https://paypal.me/ihuiai
```

如果用 PayPal 商业收款 API，则需要:

| 注册后拿到 | .env 变量名 | 用途 |
|------------|-------------|------|
| Client ID | `PAYPAL_CLIENT_ID` | API 客户端标识 |
| Client Secret | `PAYPAL_CLIENT_SECRET` | API 客户端密钥 |
| Webhook ID | `PAYPAL_WEBHOOK_ID` | Webhook 标识 |

### 4.8 Binance 环境变量

Binance 主要用于加密货币提现，不需要项目环境变量。在项目 `/sponsor` 页面显示充值地址:

| 币种 | 字段 | 用途 |
|------|------|------|
| BTC | `BTC_ADDRESS` | 比特币充值地址 |
| ETH | `ETH_ADDRESS` | 以太坊充值地址 |
| USDT-TRC20 | `USDT_TRC20_ADDRESS` | USDT（波场链）充值地址 |

> 这些地址从用户的 `wallet-secrets.json` 中读取。

### 4.9 支付宝个人环境变量

支付宝个人账号主要用于转账，不需要项目环境变量。在项目 `/sponsor` 页面显示收款二维码即可。

---

## 五、注册顺序建议

按"先易后难 + 先快后慢"原则:

```
1. PayPal 个人（10 分钟，立即可用）
   ↓
2. 支付宝个人（10 分钟，立即可用）
   ↓
3. Ko-fi（15 分钟，绑定 PayPal 即可）
   ↓
4. Gumroad（30 分钟，产品上架即可）
   ↓
5. GitHub Sponsors（1 小时填写 + 1-7 天审核，等待期间做后续）
   ↓
6. Binance（1 小时注册 + 1-24 小时 KYC）
   ↓
7. Stripe 个人（1 小时填写 + 1-2 天审核）
   ↓
8. 支付宝商户（需企业资质，1-3 工作日审核）
   ↓
9. 微信支付商户（需企业资质，3-5 工作日审核）
```

---

## 六、如何选择适合的组合

| 用户身份 | 推荐组合 | 理由 |
|----------|----------|------|
| 个人开发者，无企业资质 | PayPal + Ko-fi + GitHub Sponsors | 全部个人可注册，0% 平台费 |
| 个人开发者，有海外银行账户 | + Stripe | 接受国际信用卡 |
| 个人开发者，无海外银行账户 | + 用 Payoneer 注册美国账户 | 解决 Stripe 限制 |
| 个体工商户 | + 支付宝商户 + 微信支付商户 | 国内扫码支付 |
| 企业 | 全部 9 个渠道 | 最大化覆盖 |

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md)
- [30 分钟快速开始指南](./quick-start-30-minutes.md)
- [完整检查清单](./checklist.md)
- 单个渠道详细指南:
  - [PayPal 注册](./paypal-setup.md)
  - [Ko-fi 注册](./ko-fi-setup.md)
  - [GitHub Sponsors 申请](./github-sponsors-setup.md)
  - [Gumroad 上架](./gumroad-setup.md)
  - [Binance 注册](./binance-setup.md)
  - [Stripe 注册](./stripe-setup.md)
  - [支付宝商户注册](./alipay-setup.md)
  - [微信支付商户注册](./wechat-pay-setup.md)
