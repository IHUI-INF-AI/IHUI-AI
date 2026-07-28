# Ko-fi 注册指南

> **目标**:15 分钟内注册 Ko-fi 账号，绑定 PayPal，开始接受 0% 平台手续费的捐款。
>
> **难度**:⭐ 极易
>
> **前置依赖**:已注册 PayPal 个人账号（详见 [paypal-setup.md](./paypal-setup.md)）

---

## 一、前置条件

- [ ] 用户的邮箱
- [ ] 用户的 PayPal 账号（已注册并验证）
- [ ] 一张头像图片（用户的照片或项目 logo，方形 400×400 像素以上）
- [ ] 一段简介文字（如:`IHUI-AI 是全栈 AI 平台，赞助支持开源开发`）

---

## 二、Ko-fi 是什么？

**Ko-fi** 是一个创作者赞助平台，让粉丝用"请喝杯咖啡"的方式给创作者小额捐款。

**优势**:
- ✅ **0% 平台手续费**（仅 PayPal/Stripe 收款费）
- ✅ 接受 PayPal / Stripe 两种收款
- ✅ 个人可注册，无需企业资质
- ✅ 15 分钟即可上线
- ✅ 支持月度会员（Ko-fi Gold，月费 $6）

**对比 Patreon**:Patreon 收 5-12% 平台费，Ko-fi 免费。

---

## 三、注册步骤

### 步骤 1:访问 Ko-fi 官网

1. 打开浏览器
2. 地址栏输入:[https://ko-fi.com](https://ko-fi.com)
3. 按 Enter

![访问 Ko-fi 官网](screenshot-placeholder)

### 步骤 2:点击 Sign Up

1. 在 Ko-fi 首页右上角，找到 **"Sign Up"**（注册）按钮
2. 点击它

![点击 Sign Up](screenshot-placeholder)

### 步骤 3:选择注册方式

页面会显示几种注册方式:

- **Continue with Google** — 用 Google 账号注册（推荐，最快）
- **Continue with Facebook** — 用 Facebook 账号注册
- **Continue with Steam** — 用 Steam 账号注册
- **Continue with Twitter** — 用 Twitter 账号注册
- **Continue with Discord** — 用 Discord 账号注册
- **Continue with email** — 用邮箱注册

**推荐**:点击 **"Continue with Google"**，用用户的 Gmail 注册（最快）。

![选择注册方式](screenshot-placeholder)

### 步骤 4:用 Google 登录（推荐）

1. 选择用户的 Gmail 账号
2. 授权 Ko-fi 访问基本信息
3. Ko-fi 会自动创建账号

### 步骤 5:设置账号名

1. 首次登录会要求设置用户名
2. 在输入框填入:`ihuiai`（必须小写，仅字母数字）
3. 这个名字会出现在 Ko-fi 链接里:`https://ko-fi.com/ihuiai`
4. 点击 **"Continue"**

![设置账号名](screenshot-placeholder)

### 步骤 6:上传头像和简介

1. **头像**:点击头像区域 → 上传图片（建议方形 logo）
2. **显示名**:填 `IHUI-AI`
3. **简介**:
   ```
   IHUI-AI 是开源全栈 AI 平台（TS Monorepo + 8 端覆盖）。您的赞助支持我继续维护开源项目。
   
   - GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
   - 官网: https://aizhs.top
   ```
4. 点击 **"Save"**（保存）

![上传头像和简介](screenshot-placeholder)

### 步骤 7:绑定 PayPal

1. 在左侧菜单点击 **"Settings"**（设置）→ **"Payment"**（支付）
2. 找到 **"Connect PayPal"**（绑定 PayPal）按钮
3. 点击它，会跳转到 PayPal 授权页面
4. 输入用户的 PayPal 账号（邮箱和密码）
5. 点击 **"Agree and Connect"**（同意并连接）
6. 授权后返回 Ko-fi，显示"PayPal 已绑定"

> 💡 **现在 Ko-fi 收到的捐款会直接进 PayPal 账户**

![绑定 PayPal](screenshot-placeholder)

### 步骤 8:设置赞助等级

1. 在左侧菜单点击 **"Tiers"**（赞助等级）
2. 点击 **"Add Tier"**（添加等级）
3. 建议设置 3 档:

#### Tier 1:Bronze ☕

- **价格**:$3 / 月
- **名称**:`Bronze`
- **描述**:`一杯咖啡，感谢支持开源！README 致谢`
- **特权**:`在 README 列出你的名字`

#### Tier 2:Silver 🥈

- **价格**:$10 / 月
- **名称**:`Silver`
- **描述**:`支持项目持续开发，享受月度报告`
- **特权**:`README 致谢 + 月度进展报告（邮件）`

#### Tier 3:Gold 🥇

- **价格**:$25 / 月
- **名称**:`Gold`
- **描述**:`Gold 赞助商，优先 Issue 响应`
- **特权**:`README 致谢 + 月度报告 + 优先处理你的 Issue`

4. 每设置完一个等级点击 **"Save"**

![设置赞助等级](screenshot-placeholder)

### 步骤 9:设置一次性捐款

1. 在左侧菜单点击 **"Donations"**（捐款）
2. 启用 **"One-off Donations"**（一次性捐款）
3. 设置建议金额:$3 / $5 / $10 / $25
4. 启用 **"Custom Amount"**（自定义金额）— 让捐款人自己输入金额
5. 在 **"Donation Message"** 写:
   ```
   感谢您支持 IHUI-AI 开源项目！您的捐款将用于服务器、API 调用和持续开发。
   ```
6. 点击 **"Save"**

![设置一次性捐款](screenshot-placeholder)

### 步骤 10:获取 Ko-fi 链接

1. 点击右上角用户头像 → **"View Page"**（查看页面）
2. 浏览器会跳转到:`https://ko-fi.com/ihuiai`
3. 复制这个链接保存

---

## 四、在项目集成

### 4.1 在 .github/FUNDING.yml 配置

1. 打开项目仓库 [https://github.com/IHUI-INF-AI/IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI)
2. 找到 `.github/FUNDING.yml` 文件
3. 添加以下内容:

```yaml
# 已有内容...
ko_fi: ihuiai
```

4. 提交（Commit changes）

> 💡 配置后，GitHub 仓库的 Sponsor 按钮会显示 Ko-fi 选项

### 4.2 在 README 添加 Ko-fi 按钮

1. 打开项目根目录的 `README.md`
2. 在 "Sponsor" 章节添加:

```markdown
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-FF5E5B?style=flat&logo=ko-fi)](https://ko-fi.com/ihuiai)
```

3. 提交

### 4.3 在 /sponsor 页面添加 Ko-fi 按钮

1. 打开 `apps/web/src/app/(main)/sponsor/page.tsx`
2. 在 Ko-fi 按钮组件的 `href` 属性改为:
   ```tsx
   href="https://ko-fi.com/ihuiai"
   ```
3. 保存文件

---

## 五、Ko-fi Gold（可选升级）

Ko-fi Gold 是付费会员，月费 $6 / 月，提供:

- ✅ 移除 Ko-fi 品牌
- ✅ 自定义页面颜色
- ✅ 提供会员专属内容
- ✅ Discord 集成
- ✅ 直接提现到银行（绕过 PayPal）

**是否值得升级**:
- 月收入 < $50 → 不建议升级（$6 / 月占比过高）
- 月收入 $50-200 → 可考虑升级
- 月收入 > $200 → 建议升级

---

## 六、手续费说明

| 收款方式 | Ko-fi 平台费 | PayPal 费用 | 实际到手 |
|----------|--------------|-------------|----------|
| 一次性捐款 $3 | $0 | $0.43（4.4% + $0.30） | $2.57 |
| 月度赞助 $10 | $0 | $0.74 | $9.26 |
| Ko-fi Gold 直接提现 | $0 | $0.30 | $9.70 |

> 💡 **结论**:Ko-fi 0% 平台费，但 PayPal 会收 4.4% + $0.30。如果升级 Ko-fi Gold 用银行直接提现，可省 PayPal 费。

---

## 七、常见问题

### Q1:Ko-fi 在中国大陆能用吗？

A:可以。Ko-fi 不限制地区，绑定 PayPal 即可。

### Q2:捐款人需要注册 Ko-fi 吗？

A:不需要。捐款人可以直接访问 [https://ko-fi.com/ihuiai](https://ko-fi.com/ihuiai)，用 PayPal 或信用卡付款。

### Q3:月度赞助会自动扣款吗？

A:会。月度赞助会通过 PayPal 自动续费，赞助人可随时取消。

### Q4:Ko-fi 支持支付宝/微信收款吗？

A:不支持。Ko-fi 只支持 PayPal / Stripe。如果要收国内支付，请用支付宝个人转账或开通支付宝商户。

### Q5:Ko-fi 与 Patreon 有什么区别？

A:
| 对比项 | Ko-fi | Patreon |
|--------|-------|---------|
| 平台费 | 0% | 5-12% |
| 一次性捐款 | 支持 | 不支持 |
| 月度会员 | 支持 | 支持 |
| 提现周期 | 即时（通过 PayPal） | 每月 5 日 |
| 最低门槛 | 免费 | 5% 起 |

### Q6:如何提现？

A:Ko-fi 本身不存钱，所有捐款直接进 PayPal 账户。提现就是 PayPal 提现到银行卡，详见 [paypal-setup.md](./paypal-setup.md)。

---

## 八、验证清单

完成后请确认:

- [ ] 能用 Ko-fi 账号登录 [https://ko-fi.com](https://ko-fi.com)
- [ ] Ko-fi 页面已设置头像和简介
- [ ] PayPal 已绑定（Settings → Payment 显示 "Connected"）
- [ ] 已设置至少 3 个赞助等级（$3 / $10 / $25）
- [ ] 一次性捐款已启用
- [ ] 访问 [https://ko-fi.com/ihuiai](https://ko-fi.com/ihuiai) 能看到完整页面
- [ ] `.github/FUNDING.yml` 已添加 `ko_fi: ihuiai`
- [ ] README 已添加 Ko-fi 按钮
- [ ] **测试**:用另一个邮箱给自己发起 $3 测试捐款，确认 PayPal 收到

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md)
- [30 分钟快速开始指南](./quick-start-30-minutes.md)
- [支付渠道对比表](./payment-setup-guide.md)
- [PayPal 注册](./paypal-setup.md)（Ko-fi 收款依赖 PayPal）
- [GitHub Sponsors 申请](./github-sponsors-setup.md)（开发者月度赞助）
- [完整检查清单](./checklist.md)
