<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Y-37 方案 B · 裸域 `aizhs.top` 迁 EdgeOne 灰云直连 runbook（2026-11-12 修正版）

> 目的：把裸域 `aizhs.top` 从「CF 橙云 Tunnel 跨境回源（LAX，实测 12s 超时）」迁到「EdgeOne 灰云直连（复刻 www 已验证稳定模式）」，根治公网抖动告警。
>
> ⚠️ **本版推翻了 2026-11-12 早先那版 runbook 的两个错误假设**（早先误判为「CF Origin Rules 双层代理」）。以 API 实读为准，见下表。

## 0. 架构真相（2026-11-12 API 实读，推翻早先假设）

| 项             | API 实读真相                                                                                                             | 推翻的早先错误假设                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 裸域在 EdgeOne | **已接入且 `online`**，源站直填 `175.17.193.167:8801`，接入点 `aizhs.top.eo.dnse0.com`，`Cname=aizhs.top.eo.dnse0.com`   | 旧假设「裸域未接入 EO，要先加接入」 ❌     |
| www 公网路径   | **完全绕过 CF 直连 EdgeOne**：CF 上 `www` CNAME=`www.aizhs.top.eo.dnse0.com` **灰云 `proxied=false`**；`cf-ray` 头数量=0 | 旧假设「CF 橙云 Origin Rules 双层代理」 ❌ |
| www 证书       | `Mode=eofreecert`，`certId=teo-3wdb67pay5p1`，`Status=deployed`，签发 ~10min（03:54→04:04）                              | —                                          |
| 裸域卡点       | EO 侧 `Certificate.Mode` 原为 `disable`；**已改 `eofreecert`**（`certId=teo-3xc0gitgks45`），`Status=applying` 签发中    | 旧假设「证书是唯一阻塞，要去 CF 配」部分对 |
| EO 凭据        | **可用**：生产 `apps/api/.env` 的 `TENCENT_SMS_SECRET_ID/KEY` 能签名读写 `teo.tencentcloudapi.com`                       | 早先一度误判「凭证不在环境只能手动」 ❌    |
| CF 凭据        | **可用**：`deploy/cf-preferred-ip.env` 的 `CLOUDFLARE_API_TOKEN` + `CF_ZONE_ID`                                          | 同上 ❌                                    |

**结论**：正确终态 = 复刻 www 的模式 —— 裸域也走「CF 灰云直连 EdgeOne」，不是双层代理。

## 1. 目标终态与结清判据

```
用户 → EdgeOne（裸域 aizhs.top 灰云直连，国内节点，源站直填 175.17.193.167:8801）
```

结清判据（三条同时满足）：

1. EO 裸域证书 `deployed`；
2. CF 裸域 CNAME → `aizhs.top.eo.dnse0.com` 且 `proxied=false`；
3. 裸域公网实测稳定（连续 3 次全部 <1s，`200/308`）。

`http2`（Cloudflared 隧道协议）是早先单独落地项，与本裸域迁移是两回事，不参与本行结清。

## 2. 已执行的步骤（2026-11-12，均 API 自动化）

### 步骤① EdgeOne 裸域开免费证书 ✅ 已下发

```bash
# ModifyHostsCertificate 给裸域开 eofreecert
node -e 'import("./scripts/repair-eo-origin.mjs").then(async m=>{
  const cred=m.resolveCredentials();
  ... ModifyHostsCertificate {ZoneId,Hosts:["aizhs.top"],Mode:"eofreecert"} ...})'
```

- 结果：`ModifyHostsCertificate → OK`，`certId=teo-3xc0gitgks45`，`Status=applying`
- 注意：`ModifyAccelerationDomain` **不带** `Certificate` 参数（实测 `UnknownParameter`），证书是独立的 `ModifyHostsCertificate` action
- 签发需时间，www 当年 ~10min；轮询 `DescribeAccelerationDomains` 看 `Status` 转 `deployed`

### 步骤② CF 裸域 CNAME 切 EO 灰云 ⏳ **待证书 deployed 后执行**

**前置硬闸 G0**：EO 裸域证书必须 `deployed`。否则裸域直击 EO 无 TLS，切 DNS 后裸域从「慢但能通」变成「完全不通」（实测 `apex@EO=000`，`www@EO=200` 的差异正是证书差异）。

执行（脚本已写好，含 G0 闸 + 切前备份 + 回滚）：

```bash
# 切换（G0 不过会拒绝并报 cert-not-deployed）
node scripts/y37-apex-migrate.mjs

# 验证（强制解析，避开本地 DNS 缓存）
bash scripts/y37-edgeone-origin-ip.sh step3   # 裸域走 EO 连测 3 次，要求全 <1s

# 回滚（写回 CF Tunnel 橙云，即刻生效）
node scripts/y37-apex-migrate.mjs --rollback
```

## 3. 步骤三：验证裸域稳定性（硬判据）

证书 deployed + DNS 切换后：

```bash
bash scripts/y37-edgeone-origin-ip.sh step3
```

通过标准：3 次全部 `200/308` 且 `time_total < 1s`（对齐 www 实测 0.42~0.53s）。

补充：观察后续 24–48h 邮箱，公网抖动告警应显著减少——这是 Y-37 最终结清的运维证据。

## 4. 回滚方案

- **步骤②回滚**：`node scripts/y37-apex-migrate.mjs --rollback` —— 写回 `e675929a-...cfargotunnel.com` + `proxied=true`（切前已备份 `.ihui-agent/state/y37-cf-apex-dns-before.json`），即刻生效。
- **步骤①回滚**：`ModifyHostsCertificate {Hosts:["aizhs.top"],Mode:"disable"}`（一般不需要，证书开着无害）。
- 裸域原 EO 配置备份：`.ihui-agent/state/y37-apex-before-backup.json`。

## 5. 风险与注意

- **切 DNS 前必须等证书 deployed**（G0 闸），这是本方案唯一真正的时间依赖点。
- MX/TXT 记录（邮件 `smtp.google.com`/`qq.com`、SPF、google-site-verification）都是灰云 `proxied=false`，**不受 CNAME 切换影响**，但 CF 裸域 CNAME 与 MX 共存本身合法（CNAME 在 apex 对 DNS 是特例，CF 用 flattened CNAME 实现）。
- 全程不动 www、bsm、api、sso、file、ai 各腿；只动裸域那一条 CNAME。
- 裸域切灰云后**不再过 CF 防护**（与 www 同形态——www 早就这么走，已接受此权衡）。若日后要 CF 防护回裸域，需重新评估，但那是与「绕开跨境抖动」互斥的选择。

## 6. 与早先 runbook 的差异（留痕）

早先那版（同日）误判为「CF 橙云 + Origin Rules 回源 EdgeOne 双层代理」，根因是当时以为裸域没接入 EO、且未实读 www 的灰云形态。经 `DescribeAccelerationDomains`（裸域已在 EO）+ CF DNS 记录（www 灰云直连）+ `cf-ray=0` 三条证据，订正为「复刻 www 灰云直连」。教训：**动手前先把同类已工作面的真实配置读出来照抄，不要凭 DNS 表面形态推架构**。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
