# Stripe 个人账号注册指南

> **目标**:注册 Stripe 个人账号，让 IHUI-AI 项目能接受国际信用卡（Visa/Master/Amex）支付。
>
> **难度**:⭐⭐⭐ 中等（中国大陆用户需海外银行账户或 Stripe Atlas）
>
> **用途**:项目付费功能 + GitHub Sponsors 收款 + 国际信用卡捐赠

---

## 一、前置条件

- [ ] 用户的邮箱
- [ ] 用户的身份证（正反面照片）
- [ ] 用户的护照（如有，部分场景更易通过）
- [ ] **海外银行账户**（中国大陆用户必须）— 详见 [第 6 节](#六中国大陆用户的特殊处理)
- [ ] 用户的手机（接收验证码）
- [ ] 一台能上网的电脑（建议挂 VPN）

---

## 二、Stripe 是什么？

**Stripe** 是全球最大的在线支付平台，支持 135+ 种货币、46 个国家。让网站能接受 Visa / Master / Amex / Apple Pay / Google Pay 信用卡支付。

**优势**:
- ✅ 国际标准，覆盖全球用户
- ✅ API 完善，集成简单
- ✅ 7 天滚动结算（提现周期稳定）
- ✅ 个人可注册（部分国家）

**劣势**:
- ❌ 中国大陆不直接支持（需海外银行账户）
- ❌ 手续费 2.9% + $0.30 / 笔（中等）
- ❌ 审核周期 1-2 天

---

## 三、注册步骤

### 步骤 1:访问 Stripe 注册页面

1. 打开浏览器
2. 地址栏输入:[https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
3. 按 Enter

![访问 Stripe 注册页](screenshot-placeholder)

### 步骤 2:填写注册信息

1. **Email address**（邮箱）:用户邮箱（如 `ihui.ai@gmail.com`）
2. **Full name**（姓名）:用户身份证上的姓名（拼音）
3. **Password**（密码）:强密码（至少 12 位，含大小写字母+数字+符号）
4. **Country**（国家）:
   - 如果有海外银行账户:选对应国家（如 `United States` / `Hong Kong` / `Singapore`）
   - 如果没有:看 [第 6 节](#六中国大陆用户的特殊处理)
5. 勾选 **"I agree to the Stripe Terms of Service"**（同意条款）
6. 点击 **"Create account"**（创建账号）

![填写注册信息](screenshot-placeholder)

### 步骤 3:验证邮箱

1. Stripe 会向用户邮箱发验证邮件
2. 打开邮箱，找 Stripe 邮件
3. 点击邮件里的 **"Verify email address"** 链接
4. 浏览器跳回 Stripe，显示"邮箱已验证"

![验证邮箱](screenshot-placeholder)

### 步骤 4:登录 Stripe Dashboard

1. 用注册的邮箱和密码登录 [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. 首次登录会显示"激活账号"提示

### 步骤 5:填写账户详细信息

Stripe 会要求填写账户详情（Account Details），分几部分:

#### 5.1 Business details（业务信息）

1. **Business type**（业务类型）:**Individual / Sole proprietor**（个人/个体户）
2. **Company structure**:**Individual**
3. **Business description**（业务描述）:
   ```
   IHUI-AI is an open-source AI platform. We accept payments for digital products (AI prompt library, courses) and donations.
   ```
4. **URL**（业务网址）:`https://ihui.ai`
5. **Country**:**United States**（或其他海外国家）
6. 点击 **"Continue"**

#### 5.2 Industry（行业）

1. 选择 **Software / SaaS**
2. 子分类:**Open Source Software / Developer Tools**
3. 点击 **"Continue"**

#### 5.3 Personal details（个人信息）

1. **Legal first name**（名）:用户身份证名（拼音）
2. **Legal last name**（姓）:用户身份证姓（拼音）
3. **Date of birth**（出生日期）:YYYY-MM-DD
4. **Home address**（家庭住址）:
   - 如果国家选 US:填美国地址（如使用 Stripe Atlas / Payoneer，用注册地址）
   - 如果国家选 HK / SG:填当地地址
5. **Phone number**（手机号）:用户手机号
6. **Social Security Number / ID**:
   - 美国:SSN 或 ITIN
   - 香港:HKID
   - 新加坡:NRIC
7. 点击 **"Continue"**

![填写个人信息](screenshot-placeholder)

#### 5.4 Bank account（银行账户）

1. **Bank account type**:**Checking**（活期）
2. **Routing number**（9 位数字）:海外银行账户的 Routing Number
3. **Account number**（账号）:海外银行账户的账号
4. **Confirm account number**（确认账号）:再次输入
5. 点击 **"Continue"**

> 💡 如果用 Payoneer，在 Payoneer 后台找到这两个号码

#### 5.5 Verification document（验证文件）

1. 上传身份证 / 护照照片（正面）
2. 上传身份证 / 护照照片（反面）
3. 可能要求上传**地址证明**（utility bill / 银行对账单，3 个月内）
4. 点击 **"Submit"**

### 步骤 6:提交审核

1. 检查所有信息无误
2. 点击 **"Submit for review"**
3. 页面显示"Account is under review"
4. Stripe 会通过邮件通知审核结果（1-2 天）
5. 审核期间账号处于 **"Restricted"** 状态，不能收款

![提交审核](screenshot-placeholder)

### 步骤 7:审核通过

1. 收到 Stripe 邮件"Your account is active"
2. 登录 Dashboard，状态显示 **"Complete"**
3. 此时可以开始收款

---

## 四、获取 API Keys

### 步骤 1:进入 API Keys 页面

1. 登录 [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. 顶部菜单点击 **"Developers"**（开发者）
3. 左侧菜单点击 **"API keys"**

### 步骤 2:复制 Publishable key

1. 找到 **"Publishable key"** 区域
2. 这个 key 以 `pk_` 开头（如 `pk_live_xxxxxxxxxxxx`）
3. 点击 **"Reveal live key token"**（首次会要求验证身份）
4. 复制这个 key，保存到安全的地方

![复制 Publishable key](screenshot-placeholder)

### 步骤 3:复制 Secret key

1. 找到 **"Secret key"** 区域
2. 这个 key 以 `sk_` 开头（如 `sk_live_...`）
3. 点击 **"Reveal live key token"**
4. 系统会显示完整的 key（只显示一次）
5. **立即复制保存**（关掉就再也看不到了）
6. 点击 **"Done"**

> ⚠️ **Secret key 是机密，绝不**提交到 git / 截图发群 / 发邮件正文。丢失需点击 "Roll key" 重新生成。

![复制 Secret key](screenshot-placeholder)

### 步骤 4:测试模式 vs 生产模式

Stripe 有两个模式:
- **Test mode**（测试模式）:用 `pk_test_` / `sk_test_` 开头的 key，用测试卡支付
- **Live mode**（生产模式）:用 `pk_live_` / `sk_live_` 开头的 key，真实扣款

**生产环境用 Live mode 的 key，开发测试用 Test mode 的 key**。

---

## 五、配置 Webhook

Webhook 让 Stripe 在支付成功时通知你的服务器。

### 步骤 1:进入 Webhooks 页面

1. Stripe Dashboard 顶部菜单 → **"Developers"** → **"Webhooks"**
2. 点击 **"Add endpoint"**（添加端点）

### 步骤 2:填写 Webhook URL

1. **Endpoint URL**:
   ```
   https://ihui.ai/api/stripe/webhook
   ```
2. **Description**:`IHUI-AI payment webhook`

![填写 Webhook URL](screenshot-placeholder)

### 步骤 3:选择监听事件

在 **"Events to send"** 下拉菜单，选择以下事件:

- ✅ `checkout.session.completed` — 用户完成支付
- ✅ `checkout.session.async_payment_succeeded` — 异步支付成功
- ✅ `checkout.session.async_payment_failed` — 异步支付失败
- ✅ `customer.subscription.created` — 订阅创建
- ✅ `customer.subscription.updated` — 订阅更新
- ✅ `customer.subscription.deleted` — 订阅取消
- ✅ `invoice.payment_succeeded` — 发票支付成功
- ✅ `invoice.payment_failed` — 发票支付失败
- ✅ `payment_intent.payment_failed` — 支付失败

### 步骤 4:创建 endpoint

1. 点击 **"Add endpoint"**
2. 创建成功后，进入 endpoint 详情页

### 步骤 5:复制 Signing secret

1. 在 endpoint 详情页，找到 **"Signing secret"**
2. 点击 **"Reveal"**
3. 复制 secret（以 `whsec_` 开头，如 `whsec_xxxxxxxxxxxx`）
4. 保存到安全的地方

![复制 Signing secret](screenshot-placeholder)

---

## 六、配置到 .env

打开项目的 `.env` 文件，添加（或修改）以下环境变量:

```bash
# Stripe Configuration (替换尖括号内容为你 Dashboard 中的真实 Key)
STRIPE_SECRET_KEY=<sk_live_你的密钥>
STRIPE_PUBLISHABLE_KEY=<pk_live_你的公钥>
STRIPE_WEBHOOK_SECRET=<whsec_你的签名密钥>

# Optional: Test mode keys (开发环境用)
# STRIPE_SECRET_KEY=<sk_test_你的测试密钥>
# STRIPE_PUBLISHABLE_KEY=<pk_test_你的测试公钥>
# STRIPE_WEBHOOK_SECRET=<whsec_你的测试签名密钥>

# Stripe 价格 ID（在 Dashboard 创建产品后获取）
STRIPE_PRICE_PROMPT_LIBRARY=price_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_COURSE=price_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_SPONSOR_MONTHLY=price_xxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **绝不**把 `.env` 文件提交到 git。项目 `.gitignore` 已经包含 `.env`，但请确认。

---

## 七、测试支付

### 步骤 1:切换到测试模式

1. Stripe Dashboard 左上角，找到 **"Viewing test data"** 开关
2. 打开它（开关变蓝）

### 步骤 2:用测试卡支付

在项目 `/sponsor` 或 `/products` 页面发起支付，填测试卡号:

| 卡号 | 行为 |
|------|------|
| `4242 4242 4242 4242` | 支付成功 |
| `4000 0000 0000 0002` | 支付失败（通用） |
| `4000 0027 6000 3184` | 支付失败（卡被拒） |
| `4000 0037 6000 0000` | 3D Secure 验证 |

**测试卡的其他字段**:
- **过期日期**:任何未来日期（如 `12 / 30`）
- **CVC**:任意 3 位数字（如 `123`）
- **邮编**:任意 5 位数字（如 `12345`）

### 步骤 3:验证 Stripe Dashboard

1. 切换回测试模式
2. 进入 **"Payments"**
3. 应该能看到测试支付记录
4. 状态显示 **"Succeeded"**

![验证测试支付](screenshot-placeholder)

---

## 八、中国大陆用户的特殊处理

### 8.1 问题

Stripe **不支持**中国大陆银行账户。中国大陆用户需用以下方案之一:

### 方案 A:Stripe Atlas（注册美国公司）

1. 访问 [https://stripe.com/atlas](https://stripe.com/atlas)
2. 支付 $500 一次性费用
3. Stripe 帮你注册一家美国 Delaware LLC
4. 拿到美国 EIN（雇主识别号）
5. 用 LLC 开设美国银行账户（Mercury / SVB）
6. 用 Stripe Atlas 注册的 Stripe 账号

**优势**:最正规，长期可用
**劣势**:费用 $500，每年维护 $300

### 方案 B:Payoneer（虚拟美国银行账户）

1. 访问 [https://www.payoneer.com](https://www.payoneer.com)
2. 用中国大陆身份证注册
3. 完成实名认证
4. 获得 **First Century Bank** 或 **Bank of America** 的虚拟账户
5. 在 Stripe 注册时国家选 **United States**，银行账户用 Payoneer 的

**优势**:免费，1 周可开通
**劣势**:部分场景会被 Stripe 风控

### 方案 C:香港 / 新加坡银行账户

1. 亲自到香港 / 新加坡开户（需本人到场，或用虚拟银行如 ZA Bank）
2. 用当地银行账户注册 Stripe

**优势**:长期稳定
**劣势**:需本人到场

### 方案 D:用 Stripe Connect（他人代收）

如果上述方案都不可行，可找已开通 Stripe 的合作伙伴，用 **Stripe Connect** 代收:

1. 合作伙伴在 Stripe Dashboard 创建 Connect Account
2. 用户的支付款项进合作伙伴账户
3. 合作伙伴定期转账给用户

**劣势**:需信任合作伙伴，且要交税

---

## 九、手续费与提现

### 9.1 手续费

| 收款类型 | 手续费 |
|----------|--------|
| 国内卡（同国家） | 2.9% + $0.30 |
| 国际卡 | 3.9% + $0.30 |
| Apple Pay / Google Pay | 2.9% + $0.30 |
| ACH 转账 | 0.8%（上限 $5） |
| 货币转换 | +1% |

### 9.2 提现周期

- **7 天滚动结算**:每笔收款后 7 天才能提现
- **自动提现**:每天 / 每周 / 每月（可在 Dashboard 设置）
- **手动提现**:点 "Pay out funds" 立即提现
- **到账时间**:1-2 工作日（美国银行账户）

---

## 十、常见问题

### Q1:Stripe 在中国大陆能用吗？

A:Stripe 不直接支持中国大陆银行账户。需用 Stripe Atlas / Payoneer / 海外银行账户。详见 [第 6 节](#六中国大陆用户的特殊处理)。

### Q2:Stripe 审核 1-2 天，期间能做什么？

A:期间可:
- 阅读 Stripe 文档:[https://stripe.com/docs](https://stripe.com/docs)
- 配置 Stripe Webhook
- 在项目代码集成 Stripe SDK
- 用测试模式测试支付流程

### Q3:Stripe 与 PayPal 有什么区别？

A:
| 对比项 | Stripe | PayPal |
|--------|--------|--------|
| 支持方式 | 信用卡 / Apple Pay | PayPal 余额 / 信用卡 |
| 手续费 | 2.9% + $0.30 | 4.4% + $0.30 |
| 中国大陆 | 不支持 | 支持 |
| API 完善 | ✅ | ⚠️ |
| 适合 | 网站 API 集成 | 个人收款 |

### Q4:Stripe 退款怎么处理？

A:
1. Stripe Dashboard → **"Payments"**
2. 找到对应支付
3. 点击 **"Refund"**
4. 选择全额 / 部分退款
5. 退款会原路返回，手续费不退

### Q5:Stripe 收到的钱要缴税吗？

A:
- 美国:W-8BEN 已声明非美国居民，**不预扣**美国税
- 中国大陆:需在中国境内自行申报个人所得税

### Q6:Stripe 风控了怎么办？

A:
- 邮箱:support@stripe.com
- 说明业务模式
- 提供营业执照（如有）
- Stripe 客服会回复风控原因和处理方式

---

## 十一、安全建议

1. ✅ **开启两步验证（2FA）**
   - Settings → **"Security"** → **"Two-step authentication"**
   - 用 Google Authenticator / Authy
2. ✅ **Secret key 加密存储**
   - 不要明文存在 .env
   - 用 AWS Secrets Manager / Vault 加密
3. ✅ **Webhook 验证签名**
   - 用 `STRIPE_WEBHOOK_SECRET` 验证每个 Webhook 请求
   - 防止伪造请求
4. ❌ **不要把 Secret key 写在前端代码**
   - 只在后端 API 用
   - 前端只用 Publishable key

---

## 十二、验证清单

完成后请确认:

- [ ] Stripe 账号已注册并通过审核（状态显示 "Complete"）
- [ ] Publishable key 已复制保存
- [ ] Secret key 已复制保存（**只显示一次**）
- [ ] Webhook 已配置（监听 9 个事件）
- [ ] Webhook Signing secret 已复制保存
- [ ] `.env` 文件已配置 3 个变量
- [ ] 用测试卡 `4242 4242 4242 4242` 测试支付成功
- [ ] Stripe Dashboard 在测试模式下能看到支付记录
- [ ] 项目 `/sponsor` 页面能发起 Stripe Checkout

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md)
- [支付渠道对比表](./payment-setup-guide.md)
- [GitHub Sponsors 申请](./github-sponsors-setup.md)（GitHub Sponsors 通过 Stripe 收款）
- [完整检查清单](./checklist.md)
