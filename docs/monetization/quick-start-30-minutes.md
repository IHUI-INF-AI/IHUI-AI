# 30 分钟快速开始指南

> **目标**:30 分钟内让 IHUI-AI 项目能收到第一笔捐款。
>
> **适合人群**:时间紧张，想最快开始收钱
>
> **完成本指南后**:任何人可通过 PayPal / Ko-fi 给用户捐款

---

## 0:00-0:05 — 步骤 1:注册 PayPal 个人账号（5 分钟）

### 1.1 访问 PayPal

打开浏览器，访问:[https://www.paypal.com](https://www.paypal.com)

### 1.2 点击 Sign Up

点击右上角 **"Sign Up"** 按钮

### 1.3 选择 Personal Account

选择 **Personal Account**（个人账号）— 左边那个

### 1.4 填写注册信息

- **邮箱**:用户的邮箱
- **密码**:强密码（12 位以上）
- 点击 **"Continue"**

### 1.5 填写个人信息

- **国籍**:China
- **姓名**:用户身份证拼音
- **出生日期**:YYYY-MM-DD
- **地址**:用户家庭住址（拼音）
- **手机号**:+86 用户手机号
- 点击 **"Agree and Continue"**

### 1.6 验证邮箱

- 打开用户邮箱
- 找到 PayPal 邮件
- 点击 **"Confirm Email Address"** 链接

✅ **5 分钟完成**:PayPal 个人账号已注册

---

## 0:05-0:10 — 步骤 2:设置 PayPal.me 链接（5 分钟）

### 2.1 访问 PayPal.me

浏览器访问:[https://www.paypal.com/paypalme/](https://www.paypal.com/paypalme/)

### 2.2 设置用户名

- 点击 **"Get Started"**
- 输入用户名:`ihuiai`
- 点击 **"Next"**

### 2.3 完善资料

- 头像（可选）
- 简介:`Support IHUI-AI open source project`
- 点击 **"Create"**

### 2.4 获取链接

复制链接:`https://paypal.me/ihuiai`

✅ **10 分钟完成**:用户有了个人捐款链接

> 💡 详细步骤见 [paypal-setup.md](./paypal-setup.md)

---

## 0:10-0:15 — 步骤 3:注册 Ko-fi（5 分钟）

### 3.1 访问 Ko-fi

浏览器访问:[https://ko-fi.com](https://ko-fi.com)

### 3.2 点击 Sign Up

点击右上角 **"Sign Up"**

### 3.3 用 Google 注册（最快）

- 点击 **"Continue with Google"**
- 选择用户的 Gmail 账号
- 授权 Ko-fi 访问基本信息

### 3.4 设置账号名

- 输入用户名:`ihuiai`
- 这个名字会出现在链接里:`https://ko-fi.com/ihuiai`
- 点击 **"Continue"**

### 3.5 上传头像和简介

- 头像:上传项目 logo
- 显示名:`IHUI-AI`
- 简介:
  ```
  IHUI-AI 是开源全栈 AI 平台（TS Monorepo + 8 端覆盖）。您的赞助支持我继续维护开源项目。
  ```

✅ **15 分钟完成**:Ko-fi 账号已注册

---

## 0:15-0:20 — 步骤 4:在 Ko-fi 绑定 PayPal（5 分钟）

### 4.1 进入 Ko-fi 设置

- 登录 Ko-fi
- 左侧菜单点击 **"Settings"** → **"Payment"**

### 4.2 连接 PayPal

- 点击 **"Connect PayPal"**
- 跳转到 PayPal 授权页面
- 输入用户的 PayPal 账号（邮箱和密码）
- 点击 **"Agree and Connect"**
- 返回 Ko-fi，显示"PayPal 已绑定"

### 4.3 设置赞助等级（可选，跳过也行）

如果时间紧张，跳过此步。否则可设置 3 档:
- $3 — Bronze ☕
- $10 — Silver 🥈
- $25 — Gold 🥇

✅ **20 分钟完成**:Ko-fi 已绑定 PayPal，捐款直接进 PayPal 账户

---

## 0:20-0:25 — 步骤 5:配置 .github/FUNDING.yml（5 分钟）

### 5.1 打开 GitHub 仓库

访问:[https://github.com/IHUI-INF-AI/IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI)

### 5.2 找到 FUNDING.yml

1. 进入仓库
2. 点击 `.github` 文件夹
3. 找到 `FUNDING.yml` 文件
   - 如果没有，点击 **"Create new file"**
   - 路径:`.github/FUNDING.yml`

### 5.3 编辑文件

点击文件右上角的 **铅笔图标**（编辑），添加以下内容（保留已有内容）:

```yaml
# These are supported funding model platforms

github: # Replace with up to 4 GitHub Sponsors-enabled usernames e.g., [user1, user2]
patreon: # Replace with your Patreon username
open_collective: # Replace with your Open Collective username
ko_fi: ihuiai
tidelift: # Replace with your Tidelift package name
community_bridge: # Replace with your Community Bridge username
liberapay: # Replace with your Liberapay username
issuehunt: # Replace with your IssueHunt username
otechie: # Replace with your OTECHIE username
lfx_crowdfunding: # Replace with your LFX Crowdfunding username
custom: # Replace with up to 4 custom sponsorship URLs e.g., ['link1', 'link2']
paypal: ihuiai
```

> 💡 关键两行:
> - `ko_fi: ihuiai`
> - `paypal: ihuiai`

### 5.4 提交

- 滚动到底部
- 填写 commit message:`docs: add funding platforms (Ko-fi + PayPal)`
- 点击 **"Commit changes"** 按钮

✅ **25 分钟完成**:GitHub 仓库已配置 Sponsor 按钮

---

## 0:25-0:30 — 步骤 6:在 README 添加 Sponsor 按钮（5 分钟）

### 6.1 打开 README

1. 在 GitHub 仓库主页，点击 `README.md`
2. 点击右上角铅笔图标编辑

### 6.2 添加 Sponsor 按钮到顶部

在 README 顶部（项目标题下方）添加:

```markdown
[![Sponsor](https://img.shields.io/badge/Sponsor-IHUI--AI-E12AC4?style=flat&logo=github-sponsors)](https://github.com/sponsors/IHUI-INF-AI)
[![PayPal](https://img.shields.io/badge/PayPal-ihuiai-00457C?style=flat&logo=paypal)](https://paypal.me/ihuiai)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-FF5E5B?style=flat&logo=ko-fi)](https://ko-fi.com/ihuiai)
```

### 6.3 添加 Sponsor 章节到底部

在 README 底部添加:

```markdown
## 💖 Sponsor

如果 IHUI-AI 帮助了你，欢迎赞助支持持续开发:

- 🎁 [GitHub Sponsors](https://github.com/sponsors/IHUI-INF-AI) — 月度赞助
- 💳 [PayPal](https://paypal.me/ihuiai) — 一次性捐款
- ☕ [Ko-fi](https://ko-fi.com/ihuiai) — 请我喝杯咖啡
```

### 6.4 提交

- 滚动到底部
- commit message:`docs: add sponsor buttons to README`
- 点击 **"Commit changes"**

✅ **30 分钟完成**:README 已添加 Sponsor 按钮

---

## 🎉 验证

打开以下链接，确认两个页面都能正常访问:

1. **PayPal**:访问 [https://paypal.me/ihuiai](https://paypal.me/ihuiai)
   - 应能看到 IHUI-AI 的捐款页面
   - 输入金额能发起支付

2. **Ko-fi**:访问 [https://ko-fi.com/ihuiai](https://ko-fi.com/ihuiai)
   - 应能看到 Ko-fi 主页
   - 点击 "Support" 能发起捐款

3. **GitHub Sponsor 按钮**:
   - 访问 [https://github.com/IHUI-INF-AI/IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI)
   - 应在 README 顶部看到 3 个 Sponsor 按钮
   - 点击 Sponsor 按钮应能跳转到对应页面

---

## 🎁 预期结果

完成本 30 分钟快速开始指南后:

- ✅ 任何人可通过 [https://paypal.me/ihuiai](https://paypal.me/ihuiai) 用 PayPal 捐款
- ✅ 任何人可通过 [https://ko-fi.com/ihuiai](https://ko-fi.com/ihuiai) 用 PayPal / 信用卡捐款
- ✅ GitHub 仓库 README 显示 Sponsor 按钮
- ✅ 用户已能收到全球用户的捐款

**下一步**:有空时完成 [家人朋友代操作总指南](../deployment/family-operation-guide.md) 的剩余阶段，开通更多渠道（GitHub Sponsors / Gumroad / Stripe / 支付宝 / 微信支付等）。

---

## 📋 后续建议（30 分钟后做）

如果还有时间，按以下优先级继续:

1. **完成 PayPal 实名认证**（绑定银行卡） — 详见 [paypal-setup.md](./paypal-setup.md)
2. **完善 Ko-fi 赞助等级** — 详见 [ko-fi-setup.md](./ko-fi-setup.md)
3. **申请 GitHub Sponsors**（1-7 天审核） — 详见 [github-sponsors-setup.md](./github-sponsors-setup.md)
4. **Gumroad 上架数字产品** — 详见 [gumroad-setup.md](./gumroad-setup.md)

完整 12 项检查清单见 [checklist.md](./checklist.md)。

---

## ⚠️ 注意事项

1. **PayPal 提现**:30 分钟快速开始时，PayPal 账号可能还未绑定银行卡，无法提现。请尽快完成银行卡绑定（详见 [paypal-setup.md](./paypal-setup.md) 步骤 7）。
2. **Ko-fi 提现**:Ko-fi 不存钱，所有捐款直接进 PayPal 账户。提现 = PayPal 提现。
3. **小额测试**:完成本指南后，建议用另一个邮箱给自己发起 $1 测试捐款，确认能收到。
4. **GitHub Sponsors**:本指南只配置了 FUNDING.yml，没有真正申请 GitHub Sponsors（需 1-7 天审核）。要接受月度赞助，需按 [github-sponsors-setup.md](./github-sponsors-setup.md) 申请。

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md) — 完整 5 阶段流程
- [支付渠道对比表](./payment-setup-guide.md) — 9 种渠道详细对比
- [完整检查清单](./checklist.md) — 所有任务清单
- [PayPal 详细注册指南](./paypal-setup.md)
- [Ko-fi 详细注册指南](./ko-fi-setup.md)
