<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# RP-7 收尾:api 腿承载结论与 GitHub webhook 面迁移

> 2026-11-20 · 生产机 `ssh.aizhs.top` · 站点 `aizhs.top`(EdgeOne `zone-3wda9amx52v0`,免费版,`PlanType=plan-free`,`Type=partial`)

## 一、已落地(线上生效)

**GitHub App webhook 端点从 api 腿迁到 EdgeOne 承载的 www 域名。**

- `PATCH /app/hook/config` → `{"url":"https://www.aizhs.top/api/github-app/webhook","content_type":"json"}`(HTTP 200)。
- 迁移前同一时刻实测(本机/CN):

| 端点 | HTTP | 耗时 |
| --- | --- | --- |
| `https://api.aizhs.top/api/health` | 200 | 3.68 s |
| `https://www.aizhs.top/api/health` | 200 | 0.43 s |

- `www.aizhs.top` 由 EdgeOne 国内节点承载,`/api/*` 与 `/api/github-app/webhook` 都能直接打到同一 API(实测 `401` 签名拒绝与 `200` 健康检查均正常)。
- 迁移后重投验证:新投递 `status=200`,`duration` 0.76–4.39。
- 切换窗口失败投递已补齐:`13:25–13:34Z` 共 192 条(`403×175`、`550×2`、`500×73` 等同期),按 App JWT `POST /app/hook/deliveries/<id>/attempts` 全部 `202`。**注意**:`id` 超过 2^53,必须从原始文本取数字串,`JSON.parse` 会截断精度并返回 404。

## 二、未达成:api 子域由 EdgeOne 承载(平台侧)

技术闭环全部做到,但边缘不下发:

1. 建域 `CreateAccelerationDomain`(源站 `IP_DOMAIN 175.17.193.167:8801`,`OriginProtocol=HTTP`)→ `DomainStatus=online`、`IdentificationStatus=finished`。
2. 证书:EO 免费证书长期 `failed`(官方要求 CNAME 先指向 EO 才自动签发);改用 DNS 委派验证(`ApplyFreeCertificate{VerificationMethod:'dns_challenge'}` + CF `_dnsauth.api` CNAME)仍 `failed`;最终在生产机用 `acme-client@5.4.0` 走 Let's Encrypt DNS-01 自签,`UploadCertificate` → `CertId=cWPoTfQx`,用 `ModifyHostsCertificate{Mode:'sslcert',ServerCertInfo:[{CertId,Type:'upload'}], Hosts:['api.aizhs.top']}` 挂载为 `deployed`(到期 2027-02-18)。单传 `Domain` 会报 `MissingParameter.Hosts`。
3. 真实切 DNS(CF `proxy=false` → `api.aizhs.top.eo.dnse0.com`)后,四个节点 IP(`113.240.66.67`/`113.142.27.122`/`117.69.71.130`/`49.119.128.44`)对 `Host: api.aizhs.top` **恒 403 `{"code":403,"message":"forbidden"}`**,同节点 `www.aizhs.top`/`aizhs.top` 均 200。
4. 关掉证书/证书形态变量后结论不变:零风险 canary 子域(同源站、同 CNAME 形态,含 EO 分配的 `ad9021…acc.tyxcdn.com`)同样 403;期间偶发 **418**(官方定义=节点无该域配置文件),证明是「配置未下发到节点」而非鉴权/缓存。
5. 配额排除:免费版 200 子域名/站点,`Resources` 未见上限告警,第 5 个域仍可创建成功。
6. 现网已复位:api 记录回滚 `CNAME b3888e68-…cfargotunnel.com proxied=true`;canary 的 CF 记录与两条 EO 加速域名全清;EO 侧仅剩 `aizhs.top`/`www.aizhs.top`/`api.aizhs.top`(后者保留,供平台修复后直接切)。

**判定**:`api.aizhs.top` 这类"新建子域"在该免费版站点上不会被边缘下发,属于平台侧准入问题,仓库内任何配置都改不动它;需要腾讯云工单(报 `EO-LOG-UUID`)或升级套餐后重试。

## 三、客户端基址现状与本次改动

**REST/SSE 全端已以 www 为准**,本次只补两处仍指向 api 的默认值:

- `apps/miniapp-taro/src/utils/api-config.ts`:`PROD_API_BASE_URL` `https://api.aizhs.top/api` → `https://www.aizhs.top/api`(/api 后缀不变)。
- `apps/desktop/scripts/ensure-web-out.mjs`:`NEXT_PUBLIC_API_BASE_URL` 与 `NEXT_PUBLIC_STREAM_API_BASE_URL` 默认 `api.aizhs.top` → `www.aizhs.top`(该脚本仅手动运行;生产 `desktop-build-saas.mjs` 原本就用 apex)。

已经是 www 的:移动端 `eas.json`(`EXPO_PUBLIC_API_BASE_URL=https://www.aizhs.top`)、管理接口工具 `ihui-admin-session.cjs`(`IHUI_API_BASE` 默认 www)、web 生产同源 `/api`(由 www 承载)。扩展白名单本就允许 `*.aizhs.top`,无需改。

**WS 必须留在 api,不能迁 www(带真实令牌实测)**:

| 请求 | 结果 |
| --- | --- |
| `wss://www.aizhs.top/ws/notifications?token=<有效令牌>` | **404**(边缘剥掉 Upgrade,源站按普通 GET 处理) |
| `wss://api.aizhs.top/ws/notifications?token=<有效令牌>` | **101** |

EdgeOne 免费版默认不放开 WebSocket(`WebSocket 最大超时时间` 在免费版为 ✕),故 `NEXT_PUBLIC_WS_BASE_URL` / `EXPO_PUBLIC_WS_BASE_URL` 一处未动。

**未迁 www 的另一处**是 api 上的非 `/api` 路径:`https://api.aizhs.top/landing` = 200,而 `https://www.aizhs.top/landing` = 308→`/`(web 应用没有该路由)。VIP 页外链因此保持 api。

## 四、复现与再切

- 证书 `D:\DevEnv\secrets\ssl\api.aizhs.top.{crt,key}.pem`、`acme-account.key`(生产机,未入仓),有效期至 2027-02-18。
- CF DNS 备份 `D:/DevEnv/ihui-prod/.ihui-agent/state/rp7-api-dns-before.json`。
- 一键切换/回滚:`cf-switch.mjs switch|rollback`(读 `deploy/cf-preferred-ip.env`)。
- 边缘是否已下发,只用一条判据:`curl --resolve api.aizhs.top:443:<节点IP> https://api.aizhs.top/api/health` 是否 200;403 即未下发。

## 四、边界与风险

- 若需再切 DNS,先在 GitHub App 侧确认 webhook 已不再依赖 api(本日已迁 www),避免 403 窗口打空投递。
- 隧道自愈 `deploy/win/heal-tunnel-service.ps1` 常驻:有意停 `CloudflaredApi` 约 60 s 内会被拉回;长时间停须先停 `IHUI-DEPLOOP`。
- 隧道协议对照实验绝不在单隧道上做(本日三度因此断掉唯一入口)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
