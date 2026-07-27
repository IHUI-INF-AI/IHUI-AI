# Binance 交易所注册与加密货币提现指南

> **目标**:注册 Binance 账号，导入用户的钱包私钥，让 IHUI-AI 项目能接受加密货币捐赠并提现到银行卡。
>
> **难度**:⭐⭐⭐ 中等（需 KYC 认证）
>
> **用途**:接受 BTC / ETH / USDT 捐赠，提现到人民币银行卡

---

## 一、前置条件

- [ ] 用户的邮箱
- [ ] 用户的手机号（接收验证码）
- [ ] 用户的身份证（正反面照片）
- [ ] 用户的银行卡（用于提现 CNY）
- [ ] 用户的 `wallet-secrets.json` 文件（含钱包私钥）
- [ ] Google Authenticator 应用（手机 App）
- [ ] 一台能上网的电脑 / 手机

---

## 二、Binance 是什么？

**Binance**（币安）是全球最大的加密货币交易所，支持 600+ 种加密货币交易。

**用途**:
- 接受 BTC / ETH / USDT 等加密货币捐赠
- 把加密货币兑换成 CNY（人民币）
- 提现到用户的银行卡

**优势**:
- ✅ 全球最大交易所，流动性最好
- ✅ 支持人民币提现（P2P 交易）
- ✅ 个人可注册
- ✅ 手续费低（~1%）

**劣势**:
- ❌ 中国大陆访问需 VPN（或用 Binance Singapore）
- ❌ KYC 审核可能严格

---

## 三、注册步骤

### 步骤 1:访问 Binance 官网

1. 打开浏览器
2. 地址栏输入:[https://www.binance.com](https://www.binance.com)
3. 按 Enter

> ⚠️ **重要**:认准官方域名 `binance.com`。**不要**点击陌生邮件里的链接。

![访问 Binance 官网](screenshot-placeholder)

### 步骤 2:点击注册

1. 在 Binance 首页右上角，找到 **"Register"**（注册）按钮
2. 点击它

### 步骤 3:填写注册信息

1. **Email / Phone**（邮箱 / 手机）:输入用户邮箱
2. **Password**（密码）:强密码（至少 8 位，含大小写字母+数字）
3. **Referral ID**（推荐 ID）:可选填，或留空
4. 勾选 **"I agree to the Terms of Service"**
5. 点击 **"Create Account"**

![填写注册信息](screenshot-placeholder)

### 步骤 4:完成滑动验证

1. 页面显示滑动验证（拼图）
2. 拖动滑块到正确位置
3. 验证成功后进入下一步

### 步骤 5:邮箱 / 短信验证

1. Binance 会向邮箱发 6 位数验证码
2. 打开邮箱，复制验证码
3. 粘贴到 Binance 输入框
4. 点击 **"Confirm"**

### 步骤 6:登录账号

1. 输入邮箱和密码登录
2. 进入 Binance 主页

---

## 四、完成 KYC 认证

KYC（Know Your Customer）是 Binance 的实名认证，必须完成才能交易和提现。

### 步骤 1:进入 KYC 认证

1. 登录 Binance
2. 点击右上角头像 → **"Identification"**（身份认证）
3. 显示三种认证等级:
   - **Basic**（基础）:邮箱 + 手机
   - **Intermediate**（中级）:+ 身份证
   - **Advanced**（高级）:+ 地址证明
4. 点击 **"Verify Now"**（开始中级认证）

### 步骤 2:选择国家

1. **Country of Residence**（居住国家）:**China**
2. 点击 **"Continue"**

### 步骤 3:填写个人信息

1. **First Name**（名）:用户身份证名（拼音）
2. **Last Name**（姓）:用户身份证姓（拼音）
3. **Date of Birth**（出生日期）:YYYY-MM-DD
4. **Gender**（性别）:选择
5. **Address**（地址）:用户家庭住址（拼音）
6. **City**（城市）:拼音
7. **Postal Code**（邮编）
8. 点击 **"Continue"**

### 步骤 4:上传身份证

1. **ID Type**（证件类型）:**National ID Card**（身份证）
   - 或 **Passport**（护照，更易通过）
2. 上传身份证**正面**照片（人像面）
3. 上传身份证**反面**照片（国徽面）
4. **要求**:
   - 清晰、四角完整
   - 无反光、无遮挡
   - JPG / PNG 格式
   - 文件大小 < 5MB
5. 点击 **"Continue"**

![上传身份证](screenshot-placeholder)

### 步骤 5:人脸识别

1. 用电脑摄像头或手机扫描二维码
2. 把脸放在画框内
3. 按提示完成动作:
   - 张嘴
   - 闭眼
   - 摇头
4. 识别成功后进入下一步

### 步骤 6:提交审核

1. 检查所有信息无误
2. 点击 **"Submit"**
3. 页面显示"Under Review"
4. 等待审核（1-24 小时，通常 1 小时内）

### 步骤 7:审核通过

1. 收到 Binance 邮件"KYC Verified"
2. 登录查看，状态显示 **"Verified"**
3. 此时可开始充值 / 交易 / 提现

---

## 五、设置二次验证（2FA）

### 步骤 1:进入安全设置

1. 登录 Binance
2. 点击头像 → **"Security"**（安全）
3. 找到 **"Google Authentication"**（Google 身份验证器）

### 步骤 2:绑定 Google Authenticator

1. 在手机上下载 **Google Authenticator** App
   - iOS:App Store 搜索
   - Android:Google Play 或应用商店
2. 打开 Google Authenticator
3. 点击 **"+"** → **"Scan barcode"**
4. 扫描 Binance 页面显示的二维码
5. Google Authenticator 会显示 6 位验证码（每 30 秒变化）
6. 在 Binance 输入当前验证码
7. **保存备用密钥**（Backup Key）:扫码后 Binance 会显示，**截图保存到安全位置**（手机丢失时恢复用）

### 步骤 3:设置反钓鱼码

1. 在 Security 页面找到 **"Anti-Phishing Code"**
2. 点击 **"Set"**
3. 输入 6-8 位字母数字组合（如 `IHUI2025`）
4. 点击 **"Confirm"**
5. 此后 Binance 发的所有邮件**都会包含这个码**，没有就是钓鱼邮件

---

## 六、导入钱包私钥

> ⚠️ **警告**:导入私钥是一个高风险操作。请确保:
> - 私钥文件 `wallet-secrets.json` 不外泄
> - 操作完成后立即清除剪贴板历史
> - 操作电脑无木马病毒

### 步骤 1:打开钱包充值地址

1. 登录 Binance
2. 顶部菜单 → **"Wallet"**（钱包）→ **"Spot Wallet"**（现货账户）
3. 点击 **"Deposit"**（充值）

### 步骤 2:选择币种

1. 在搜索框输入:`USDT`
2. 选择 **USDT**
3. 选择网络:**TRC20**（手续费最低，约 $1）
4. 复制显示的充值地址（一长串字符）
5. **保存这个地址**

> 💡 用这个地址作为项目 `/sponsor` 页面显示的 USDT 充值地址

### 步骤 3:（可选）从外部钱包转账

如果用户的 `wallet-secrets.json` 中有现有的加密货币，需要从外部钱包转入:

#### 方案 A:用 MetaMask 转账

1. 在浏览器安装 MetaMask 扩展
2. 用 `wallet-secrets.json` 中的私钥导入钱包
3. 把 ETH / USDT 转账到 Binance 充值地址
4. 注意:需要 ETH 作为 Gas 费

#### 方案 B:用 Trust Wallet 转账

1. 在手机安装 Trust Wallet
2. 导入私钥
3. 转账到 Binance 充值地址

### 步骤 4:获取多币种地址

为 IHUI-AI 项目配置多个充值地址:

| 币种 | 网络 | 用途 |
|------|------|------|
| **BTC** | Bitcoin | 比特币捐赠 |
| **ETH** | ERC20 | 以太坊捐赠 |
| **USDT** | TRC20 | USDT 捐赠（推荐，手续费最低） |
| **USDC** | ERC20 | USDC 捐赠 |
| **BNB** | BSC | 币安币捐赠 |

每个币种都需要单独获取充值地址，**注意核对网络**，转账到错误网络会**永久丢失**。

---

## 七、在项目集成

### 7.1 在 /sponsor 页面显示加密货币地址

1. 打开 `apps/web/src/app/(main)/sponsor/page.tsx`
2. 找到加密货币区域
3. 替换为用户的实际地址:

```tsx
const CRYPTO_ADDRESSES = {
  BTC: '用户的 BTC 充值地址',
  ETH: '用户的 ETH 充值地址',
  USDT_TRC20: '用户的 USDT TRC20 充值地址',
  USDC: '用户的 USDC 充值地址',
};
```

4. 保存

### 7.2 配置 .env

在 `.env` 文件中添加:

```bash
# Cryptocurrency addresses (public, safe to commit)
NEXT_PUBLIC_BTC_ADDRESS=用户的 BTC 地址
NEXT_PUBLIC_ETH_ADDRESS=用户的 ETH 地址
NEXT_PUBLIC_USDT_TRC20_ADDRESS=用户的 USDT TRC20 地址
NEXT_PUBLIC_USDC_ADDRESS=用户的 USDC 地址
```

> ✅ 充值地址是**公开信息**，可以用 `NEXT_PUBLIC_` 前缀让前端访问
> ❌ 私钥是**机密信息**，绝不提交到 git

---

## 八、提现到银行卡（CNY）

### 步骤 1:把加密货币兑换成 USDT

1. 登录 Binance
2. 顶部菜单 → **"Convert"**（兑换）
3. 把 BTC / ETH 等兑换成 USDT
4. 输入数量，点击 **"Preview Conversion"**
5. 确认汇率，点击 **"Convert"**

### 步骤 2:P2P 交易卖 USDT 换 CNY

1. 顶部菜单 → **"P2P"**（点对点交易）
2. 选择 **"Sell"**（卖出）
3. 币种选择 **USDT**
4. 法币选择 **CNY**
5. 选择支付方式:
   - **Alipay**（支付宝）
   - **WeChat Pay**（微信支付）
   - **Bank Transfer**（银行转账）
6. 浏览商家列表:
   - 选 **30+ 成交**的商家
   - 看 **完成率**（>98%）
   - 看 **价格**（选最高，但小心诈骗）
7. 输入卖出数量（USDT 数）
8. 点击 **"Sell USDT"**
9. 进入交易页面，商家会显示收款方式
10. 在指定时间内（通常 15 分钟）用支付宝 / 微信 / 银行转账收款
11. 收到款后，点击 **"Payment Received"**（已收到付款）
12. 商家确认后，USDT 会从你的 Binance 账户扣除
13. CNY 到账（即时）

> ⚠️ **P2P 交易风险**:
> - 只用 Binance 平台内交易
> - 不要私下加微信交易
> - 看到款后再点 "Payment Received"
> - 大额交易分多次

### 步骤 3:小额提现测试

第一次提现建议用小额（如 10 USDT）:
1. 卖 10 USDT（约 ¥70）
2. 看是否到账
3. 没问题再继续大额

---

## 九、安全建议

### 9.1 账号安全

- ✅ **开启 2FA**（Google Authenticator）
- ✅ **设置反钓鱼码**
- ✅ **设置提现白名单**（只允许提到指定地址）
- ✅ **绑定邮箱 + 手机**双重验证
- ❌ 不要在公共电脑登录
- ❌ 不要点击陌生邮件链接

### 9.2 私钥安全

- ✅ `wallet-secrets.json` 文件已 gitignore
- ✅ 私钥用完立即清除剪贴板
- ✅ 私钥不截图 / 不发邮件 / 不告诉任何人
- ✅ 用加密 USB 备份私钥（离线存储）

### 9.3 大额提现

- 单次提现 < ¥10,000，分多次提
- 大额提现先转小额测试
- 监控账户异常登录

---

## 十、常见问题

### Q1:中国大陆用户能直接用 Binance 吗？

A:**不能直接访问**。需:
- 用 VPN 访问 Binance.com（推荐香港 / 新加坡节点）
- 或用 **Binance Singapore**（[https://www.binance.sg](https://www.binance.sg)）
- 或用 **OKX / Huobi / Coinbase** 等替代交易所

### Q2:替代交易所有哪些？

| 交易所 | 网址 | 特点 |
|--------|------|------|
| **Binance** | [binance.com](https://www.binance.com) | 全球最大，币种最多 |
| **OKX** | [okx.com](https://www.okx.com) | 中国大陆用户友好 |
| **Huobi** | [huobi.com](https://www.huobi.com) | 老牌交易所 |
| **Coinbase** | [coinbase.com](https://www.coinbase.com) | 美国合规 |
| **Kraken** | [kraken.com](https://www.kraken.com) | 欧洲合规 |

### Q3:P2P 交易安全吗？

A:**只要在 Binance 平台内交易就安全**。Binance 作为担保方:
- 买家付款前，USDT 被冻结
- 卖家收到款后释放 USDT
- 出现纠纷可申诉

**风险点**:
- ❌ 私下交易（脱离平台）
- ❌ 收到款前点 "Payment Received"
- ❌ 加商家微信沟通

### Q4:KYC 审核失败怎么办？

A:
1. 检查身份证照片是否清晰
2. 用护照代替身份证（更易通过）
3. 用英文上传（部分中文会被误判）
4. 联系 Binance 在线客服:[https://www.binance.com/en/support](https://www.binance.com/en/support)

### Q5:转账到错误网络怎么办？

A:**无法找回**。务必核对网络:
- BTC 只能转 Bitcoin 网络
- ETH 只能转 ERC20 网络
- USDT 可选 TRC20 / ERC20 / BEP20（推荐 TRC20，手续费最低）

### Q6:USDT 换 CNY 汇率多少？

A:实时汇率参考 [CoinMarketCap](https://coinmarketcap.com/currencies/tether/)。P2P 交易通常 1 USDT = ¥6.8-7.2（根据市场波动）。

### Q7:加密货币捐赠要缴税吗？

A:
- **中国**:个人接受捐赠**不缴税**，但提现到银行卡可能触发银行风控（大额需说明来源）
- **美国**:接受捐赠不缴税，但出售加密货币需缴资本利得税

---

## 十一、验证清单

完成后请确认:

- [ ] Binance 账号已注册并验证邮箱
- [ ] KYC 认证已通过（状态显示 "Verified"）
- [ ] Google Authenticator 已绑定
- [ ] 反钓鱼码已设置
- [ ] 多币种充值地址已获取（BTC / ETH / USDT / USDC）
- [ ] 项目 `/sponsor` 页面显示加密货币地址
- [ ] `.env` 文件已配置 `NEXT_PUBLIC_*_ADDRESS` 变量
- [ ] **测试**:用另一个钱包向 USDT 地址转 1 USDT，确认 Binance 收到
- [ ] **测试**:卖 1 USDT 提现 ¥7，确认到账银行卡

---

## 相关文档

- [家人朋友代操作总指南](../deployment/family-operation-guide.md)
- [支付渠道对比表](./payment-setup-guide.md)
- [完整检查清单](./checklist.md)
