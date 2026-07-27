# 加密货币捐赠钱包地址档案

> 公开档案:本文档只含公开收款地址,**不含任何私钥**。私钥保管在本地 `.trae-cn/tmp/crypto-wallets/`(已 gitignore)。
>
> 生成时间:2026-07-27
> 关联组件:`apps/web/app/(main)/sponsor/CryptoDonation.tsx`
> 关联页面:`/sponsor`(赞助页底部「加密货币捐赠」区块)

---

## 一、钱包地址清单

| 币种 | 网络 | 公开收款地址 | 浏览器查询 | 备注 |
| --- | --- | --- | --- | --- |
| Bitcoin (BTC) | BTC 主网 · Native SegWit (bech32) | `bc1q3q4ffds36kmmz7x8q0ynuvh70hmfaf08sh3e0y` | [blockchain.com](https://blockchain.com/btc/address/bc1q3q4ffds36kmmz7x8q0ynuvh70hmfaf08sh3e0y) | `bc1` 开头,手续费较 legacy 低 |
| Ethereum (ETH) | ETH 主网 | `0x66e0101c41aed519b309faead5d3778091a8ab09` | [etherscan.io](https://etherscan.io/address/0x66e0101c41aed519b309faead5d3778091a8ab09) | 标准外部账户(EOA) |
| USDT (ERC20) | ETH 主网 | `0x66e0101c41aed519b309faead5d3778091a8ab09` | [etherscan.io](https://etherscan.io/address/0x66e0101c41aed519b309faead5d3778091a8ab09) | 与 ETH 同地址 |
| USDT (TRC20) | Tron 主网 | `TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG` | [tronscan.org](https://tronscan.org/#/address/TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG) | **推荐**:手续费最低(~$1),到账最快 |

---

## 二、用途说明

IHUI-AI 是开源全栈 AI 操作系统,接受全球用户的加密货币打赏。加密货币捐赠的核心优势:

- ✅ **无需注册账号** —— 捐赠者不需要在 IHUI-AI 创建账号
- ✅ **无需 KYC** —— 收款方无需身份认证(对账号注册操作不便的用户友好)
- ✅ **无中间平台** —— 资金直接进入项目钱包,不经过第三方支付商
- ✅ **全球可达** —— 任何国家/地区的用户都可转账
- ✅ **0 平台手续费** —— 仅需支付区块链网络矿工费

**推荐捐赠者使用 USDT-TRC20**:网络费约 $1,到账 1-5 分钟,是性价比最高的方式。

---

## 三、收款流程

1. 捐赠者访问 `/sponsor` 页面,看到「加密货币捐赠」区块。
2. 选择一种币种,点击「复制地址」按钮,或扫描/点击二维码占位跳转到区块链浏览器。
3. 在自己的钱包(Bitcoin Core / MetaMask / Trust Wallet / Binance / OKX 等)向该地址转账。
4. 区块链确认后到账,可在上表「浏览器查询」链接查看交易记录。
5. 项目维护者定期从钱包提现到交易所变现(见下节)。

> 技术实现:地址硬编码在 `CryptoDonation.tsx` 组件中(前端静态,不依赖环境变量),i18n 文案在 `packages/i18n/messages/web/{locale}.json` 的 `crypto` 命名空间。

---

## 四、提现指南(项目维护者)

### 推荐:USDT-TRC20 → 交易所 → 法币

1. 在 Binance / OKX / Bybit 注册账号(提现到银行卡需 KYC,这是银行侧要求,与捐赠者无关)。
2. 交易所「充值」→ 选 USDT-TRC20 → 复制充值地址。
3. 用 TronLink 等钱包导入 `wallet-secrets.json` 中的 Tron 私钥。
4. 在钱包发起转账,粘贴交易所充值地址,确认(网络费 ~$1,从 TRX 余额扣除,需确保钱包有少量 TRX 作为 gas)。
5. 1-5 分钟到账后,在交易所「法币交易 / C2C」卖出 USDT 换人民币,提现到银行卡/支付宝。

### BTC / ETH / USDT-ERC20 提现

- 流程类似,导入对应私钥到 Electrum(BTC)/ MetaMask(ETH)。
- ETH 网络 gas 费较高(USDT-ERC20 转账约 $5-15),建议累积一定金额后再提现以摊薄手续费。
- 大额 BTC 提现建议直接转到交易所,不要经手热钱包。

> 详细私钥保管与提现步骤见本地 `.trae-cn/tmp/crypto-wallets/WALLET_BACKUP_GUIDE.md`(机密,不入库)。

---

## 五、安全说明

- **公开地址** = 只能收款,不能转出。本档案和组件中只有公开地址,**任何能看到的人都无法盗取资金**。
- **私钥** = 资金控制权。私钥仅存于本地 `.trae-cn/tmp/crypto-wallets/wallet-secrets.json`,该目录被 `.gitignore` 第 77 行 `.trae-cn/` 整体忽略,不会进入版本库。
- **备份**:私钥已按 5 步法备份到 U 盘 + 纸质(异地),详见本地 `WALLET_BACKUP_GUIDE.md`。
- **地址校验**:钱包地址由 `generate-wallets.mjs` 使用 secp256k1 + keccak256(纯 JS 实现,已通过 keccak256 空向量自测)+ base58check + bech32(BIP173)生成,均为真实可用地址。
- **生成方式**:无外部依赖,仅用 Node.js 内置 `crypto` 模块(`crypto.randomBytes(32)` 生成私钥,`crypto.createECDH('secp256k1')` 派生公钥),确保私钥从未离开本机。

---

## 六、地址变更流程

如需更换捐赠地址(例如钱包迁移、密钥泄露应急):

1. 重新运行 `node .trae-cn/tmp/crypto-wallets/generate-wallets.mjs` 生成新钱包(会覆盖 `wallet-secrets.json`,**先备份旧文件**)。
2. 把新地址同步更新到:
   - `apps/web/app/(main)/sponsor/CryptoDonation.tsx`(`WALLETS` 数组)
   - 本档案(`docs/monetization/crypto-wallets.md` 第一节表格)
3. 旧地址在区块链上仍可查询历史交易,但建议在赞助页注明「新地址生效日期」。
4. 私钥备份流程重新执行一遍(U 盘 + 纸质)。

---

## 七、相关文件

| 文件 | 位置 | 入库? | 含私钥? |
| --- | --- | --- | --- |
| `crypto-wallets.md`(本档案) | `docs/monetization/` | ✅ | ❌ |
| `CryptoDonation.tsx` | `apps/web/app/(main)/sponsor/` | ✅ | ❌ |
| `zh-CN.json` / `en.json` 等(`crypto` 命名空间) | `packages/i18n/messages/web/` | ✅ | ❌ |
| `wallet-secrets.json` | `.trae-cn/tmp/crypto-wallets/` | ❌ | ✅ |
| `WALLET_BACKUP_GUIDE.md` | `.trae-cn/tmp/crypto-wallets/` | ❌ | ❌ |
| `generate-wallets.mjs` | `.trae-cn/tmp/crypto-wallets/` | ❌ | ❌ |

---

_IHUI-AI 加密货币捐赠功能,建立于 2026-07-27。_
