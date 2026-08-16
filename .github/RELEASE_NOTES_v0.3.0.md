# v0.3.0 — 商业化变现资产包

## 💰 本次发布:从开源项目到可盈利产品

本版本为零商业化基础的项目补齐全套变现资产,让任何开发者(包括无法自行操作账号注册的用户)都能开始收款。

---

## 🆕 新增资产

### 1. 数字产品 · AI Prompt Library(¥99)

**210 个精选 AI 提示词,覆盖 20 个职业场景,即插即用。**

- 格式:JSON(结构化,含变量/示例/难度标签)
- 总 token 估算:~199,500
- 分类:编程开发 / 内容创作 / 市场营销 / 商业战略 / 教育培训 / 个人效率 / 创意写作 / 数据分析 / 客户服务 / 研究分析 / HR 招聘 / 法律合规 / 财务会计 / 产品管理 / 设计创意 / 项目管理 / 运营增长 / 健康医疗 / 电商零售 / 旅游生活方式
- 适用:ChatGPT / Claude / Gemini / 文心一言 / 通义千问 / 智谱清言 / Kimi / DeepSeek / 豆包
- 授权:个人版(单用户) / 团队版(10 人,¥299) / 企业版(无限,¥999)

**📥 下载**:本 Release 页面的 `ai-prompt-library-v1.0.0.zip` 附件即为完整产品包。

### 2. 加密货币捐赠(0 门槛,无需 KYC)

已生成并嵌入 4 个币种的钱包地址到 [/sponsor](https://aizhs.top/sponsor) 页面:

| 币种                | 网络                | 地址                                         |
| ------------------- | ------------------- | -------------------------------------------- |
| Bitcoin             | BTC (Native SegWit) | `bc1q3q4ffds36kmmz7x8q0ynuvh70hmfaf08sh3e0y` |
| Ethereum            | ETH                 | `0x66e0101c41aed519b309faead5d3778091a8ab09` |
| USDT (TRC20) ⭐推荐 | Tron(手续费 ~$1)    | `TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG`         |
| USDT (ERC20)        | ETH                 | `0x66e0101c41aed519b309faead5d3778091a8ab09` |

私钥已离线保管,公开地址可立即接收全球转账。

### 3. 一键部署按钮(4 平台)

README 新增 4 个一键部署按钮 + Docker Compose:

- [![Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/IHUI-INF-AI/IHUI-AI) — 前端(免费额度)
- [![Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/IHUI-INF-AI/IHUI-AI) — 后端 + 数据库
- [![Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/IHUI-INF-AI/IHUI-AI) — AI 服务
- [![Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/IHUI-INF-AI/IHUI-AI)

配置文件:`vercel.json` / `railway.json` / `render.yaml` / `app.json`

### 4. 家人朋友代操作指南(12 份文档)

为零技术背景的家人朋友编写的傻瓜指南,详细到"点击哪个按钮"级别:

**部署类**(`docs/deployment/`):

- `family-operation-guide.md` — 总指南(9 渠道优先级 + 5 阶段流程)
- `family-friends-guide.md` — 代部署详细步骤
- `one-click-deploy.md` — 4 平台对比
- `vercel-deploy.md` / `railway-deploy.md` — 单平台详细步骤

**支付渠道注册类**(`docs/monetization/`):

- `payment-setup-guide.md` — 9 种渠道对比表
- `paypal-setup.md` — ⭐ 10 分钟,最快开始收款
- `ko-fi-setup.md` — ⭐ 0% 平台手续费
- `github-sponsors-setup.md` — ⭐ 开发者首选
- `gumroad-setup.md` — 数字产品上架
- `binance-setup.md` — 加密货币提现
- `stripe-setup.md` — 国际信用卡
- `wechat-pay-setup.md` / `alipay-setup.md` — 国内(需企业资质)
- `quick-start-30-minutes.md` — 30 分钟快速开始
- `checklist.md` — 完整可打印检查清单

---

## 📊 预期收入模型

| 收入流            | 单价      | 月转化(保守) | 月收入          |
| ----------------- | --------- | ------------ | --------------- |
| AI Prompt Library | ¥99       | 20 单        | ¥1,980          |
| 加密货币捐赠      | 不定      | —            | ~¥500           |
| GitHub Sponsors   | $5-100/月 | 5 人         | ~$50            |
| Ko-fi 捐赠        | $3-25     | 10 笔        | ~$50            |
| Gumroad 数字产品  | $15       | 15 单        | ~$225           |
| **合计**          | —         | —            | **~¥5,000+/月** |

---

## 🚀 立即开始收款的最短路径

1. 家人朋友阅读 `docs/monetization/quick-start-30-minutes.md`
2. 30 分钟完成 PayPal + Ko-fi 注册
3. 在 GitHub 仓库 FUNDING.yml 已配置 `ko_fi: ihuiai`(注册后即生效)
4. 任何人访问 GitHub 仓库即可看到 Sponsor 按钮并捐赠

---

## 🔐 安全说明

- 加密货币私钥已离线保管,**未**进入 git 仓库(`.trae-cn/tmp/` 已 gitignore)
- 公开钱包地址可安全公开,仅用于收款
- 所有支付渠道注册指南均标注"个人可注册"优先,企业资质渠道单独标记

---

**完整文档**: `docs/monetization/` 和 `docs/deployment/`
**问题反馈**: GitHub Issues 或 business@aizhs.top
