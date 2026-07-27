# PayPal 个人账号注册指南

> **目标**:10 分钟内注册一个 PayPal 个人账号，开始接受全球捐款。
>
> **难度**:⭐ 极易（个人可注册）
>
> **适合人群**:家人/朋友代为操作

---

## 一、前置条件

- [ ] 用户的邮箱（建议 Gmail / Outlook，不要用 QQ 邮箱）
- [ ] 用户的身份证（正反面照片）
- [ ] 用户的银行卡（中国银行 / 工商银行 / 招商银行 / 建设银行等主流银行）
- [ ] 用户的手机（能收验证码）
- [ ] 一台能上网的电脑

---

## 二、注册步骤

### 步骤 1:访问 PayPal 官网

1. 打开浏览器（Chrome / Edge / Safari 都可以）
2. 在地址栏输入:[https://www.paypal.com](https://www.paypal.com)
3. 按 Enter 键

![访问 PayPal 官网](screenshot-placeholder)

### 步骤 2:点击注册

1. 在 PayPal 首页右上角，找到蓝色按钮 **"Sign Up"**（注册）
2. 点击它

![点击 Sign Up 按钮](screenshot-placeholder)

### 步骤 3:选择账号类型

1. 页面会显示两个选项:**Personal Account**（个人账号）和 **Business Account**（商家账号）
2. 选择 **Personal Account**（个人账号）— 左边那个
3. 点击 **"Continue"**（继续）

> ⚠️ **不要选 Business Account**，那个需要企业资质。

![选择 Personal Account](screenshot-placeholder)

### 步骤 4:填写邮箱和密码

1. 在 **"Email address"** 输入框，填入用户的邮箱（例如 `ihui.ai@gmail.com`）
2. 在 **"Password"** 输入框，填入一个强密码（至少 12 位，包含大小写字母+数字+符号）
3. 点击 **"Continue"**（继续）

> 💡 **建议**:密码用密码管理器生成并保存（Bitwarden / 1Password）

![填写邮箱和密码](screenshot-placeholder)

### 步骤 5:填写个人信息

1. **Nationality**（国籍）:选择 **China**（中国）
2. **Legal first name**（名）:填用户身份证上的名（拼音，如 `San`）
3. **Legal last name**（姓）:填用户身份证上的姓（拼音，如 `Zhang`）
4. **Date of birth**（出生日期）:按 `YYYY-MM-DD` 格式填写（如 `1990-01-15`）
5. **Address line 1**（地址）:填用户的家庭住址（用拼音）
6. **City**（城市）:填用户所在城市（拼音，如 `Shanghai`）
7. **Province**（省份）:填用户所在省份（拼音，如 `Shanghai`）
8. **Postal code**（邮编）:填用户住址的邮编
9. **Phone number**（手机号）:填用户手机号（+86 开头）
10. 点击 **"Agree and Continue"**（同意并继续）

![填写个人信息](screenshot-placeholder)

### 步骤 6:验证邮箱

1. PayPal 会向用户邮箱发一封验证邮件
2. 打开用户邮箱，找到 PayPal 的邮件
3. 点击邮件里的 **"Confirm Email Address"** 按钮
4. 浏览器会跳回 PayPal 网站，显示"邮箱已验证"

> 💡 **如果没收到邮件**:检查垃圾邮件文件夹，或等 5 分钟后点击 PayPal 网站"重新发送验证邮件"

![验证邮箱](screenshot-placeholder)

### 步骤 7:绑定银行卡

1. 登录 PayPal（用刚注册的邮箱和密码）
2. 在首页点击 **"Wallet"**（钱包）— 顶部菜单栏
3. 点击 **"Link a card"**（绑定银行卡）
4. 选择卡类型:**Credit card**（信用卡）或 **Debit card**（借记卡）
5. 填写银行卡信息:
   - **Card number**（卡号）:16 位数字
   - **Expiration date**（有效期）:月/年
   - **CVV**（安全码）:卡背面的 3 位数字
   - **Name on card**（持卡人姓名）:用户姓名拼音
6. 点击 **"Link Card"**（绑定）
7. PayPal 会从银行卡扣 ¥1（验证用，会退回）
8. 查看用户银行账单，找到 4 位数验证码
9. 回到 PayPal，输入验证码完成绑定

![绑定银行卡](screenshot-placeholder)

### 步骤 8:实名认证

1. PayPal 可能要求上传身份证进行实名认证
2. 如果首页出现 **"Verify your identity"**（验证身份）提示，点击它
3. 选择证件类型:**ID Card**（身份证）
4. 上传身份证正面照片
5. 上传身份证反面照片
6. 点击 **"Submit"**（提交）
7. 等待审核（通常 1-2 天，部分即时通过）

![实名认证](screenshot-placeholder)

---

## 三、获取 PayPal.me 链接

### 步骤 1:访问 PayPal.me

1. 浏览器地址栏输入:[https://www.paypal.com/paypalme/](https://www.paypal.com/paypalme/)
2. 按 Enter

### 步骤 2:设置用户名

1. 点击 **"Get Started"**（开始）
2. 在 **"Create your link"** 输入框，输入用户名:`ihuiai`
3. 点击 **"Next"**（下一步）
4. 选择头像（可选）
5. 填写一句话简介:`Support IHUI-AI open source project`
6. 点击 **"Create"**（创建）

### 步骤 3:获取链接

1. 系统会生成链接:`https://paypal.me/ihuiai`
2. 复制这个链接保存

![PayPal.me 链接](screenshot-placeholder)

---

## 四、在项目集成

### 4.1 在 .github/FUNDING.yml 配置

1. 打开项目仓库 [https://github.com/IHUI-INF-AI/IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI)
2. 找到 `.github/FUNDING.yml` 文件（如果没有就新建）
3. 添加以下内容:

```yaml
# 已有内容...
paypal: ihuiai
```

4. 提交（Commit changes）

### 4.2 在 README 添加 PayPal 按钮

1. 打开项目根目录的 `README.md`
2. 在 "Sponsor" 章节添加:

```markdown
[![PayPal](https://img.shields.io/badge/PayPal-ihuiai-00457C?style=flat&logo=paypal)](https://paypal.me/ihuiai)
```

3. 提交（Commit changes）

### 4.3 在 /sponsor 页面添加 PayPal.me 按钮

1. 打开 `apps/web/src/app/(main)/sponsor/page.tsx`
2. 在 PayPal 按钮组件的 `href` 属性改为:
   ```tsx
   href="https://paypal.me/ihuiai"
   ```
3. 保存文件

---

## 五、手续费说明

| 收款方式 | 手续费 | 说明 |
|----------|--------|------|
| 个人转账（Friends & Family） | **免费** | 朋友间转账，选 "Sending to a friend" |
| 商业收款（Goods & Services） | 4.4% + $0.30 / 笔 | 买家付商品款，选 "Paying for goods or services" |
| 国际转账 | 4.4% + 固定费用 | 跨币种收款 |
| 提现到银行卡 | 免费（¥1000 以上） | 低于 ¥1000 收 ¥3 / 笔 |

> 💡 **建议**:让捐款人选 "Sending to a friend" 模式，可以免手续费

---

## 六、常见问题

### Q1:中国大陆 PayPal 提现支持哪些银行？

A:支持 13 家主流银行:工商银行、农业银行、中国银行、建设银行、交通银行、招商银行、中信银行、民生银行、兴业银行、浦发银行、光大银行、华夏银行、平安银行。

### Q2:提现周期多久？

A:1-3 工作日到账。紧急情况可加急（额外收费）。

### Q3:PayPal 余额上限是多少？

A:未认证账号 ¥1,000 / 月；认证后提升至 ¥25,000 / 月。

### Q4:如何提现到银行卡？

A:
1. 登录 PayPal
2. 点击 **"Wallet"**（钱包）
3. 在 PayPal 余额下点击 **"Transfer Funds"**（转账）
4. 选择 **"Transfer to your bank"**（转到银行卡）
5. 输入金额
6. 选择 **"Transfer in 1-3 days"**（免费）或 **"Transfer in 30 mins"**（付费加急）
7. 点击 **"Transfer Now"**

### Q5:捐款人怎么给我捐款？

A:捐款人只需访问 [https://paypal.me/ihuiai](https://paypal.me/ihuiai)，输入金额即可（无需 PayPal 账号，可以用信用卡支付）。

### Q6:捐款需要缴税吗？

A:PayPal 不会自动扣税。但在中国境内，个人收入超过个税起征点需自行申报。建议咨询会计师。

---

## 七、安全建议

1. ✅ 开启两步验证（2FA）
   - 进入 **Settings** → **Security**
   - 点击 **"2-Step Verification"** → **"Set Up"**
   - 选择短信验证 / Google Authenticator
2. ✅ 设置反钓鱼码（Anti-Phishing Code）
   - Settings → Security → **Anti-Phishing Code**
   - 设置一个 6-8 位字母数字组合
   - PayPal 发的邮件会包含这个码，没有就是钓鱼邮件
3. ❌ 不要把密码告诉任何人
4. ❌ 不要点击陌生邮件里的 PayPal 链接（认准 paypal.com 域名）

---

## 八、验证清单

完成后请确认:

- [ ] 能用 PayPal 账号登录 [https://www.paypal.com](https://www.paypal.com)
- [ ] PayPal.me 链接已设置，访问 [https://paypal.me/ihuiai](https://paypal.me/ihuiai) 能打开
- [ ] 银行卡已绑定，能在 Wallet 看到卡
- [ ] 实名认证已完成（或状态显示"已通过"）
- [ ] `.github/FUNDING.yml` 已添加 `paypal: ihuiai`
- [ ] README 已添加 PayPal 按钮
- [ ] **测试**:用另一个邮箱给自己发起 $1 测试捐款，确认收到

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md)
- [30 分钟快速开始指南](./quick-start-30-minutes.md)
- [支付渠道对比表](./payment-setup-guide.md)
- [Ko-fi 注册](./ko-fi-setup.md)（绑定 PayPal 后效果更好）
- [完整检查清单](./checklist.md)
