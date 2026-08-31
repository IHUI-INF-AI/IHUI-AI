<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI 图片 CDN 部署指南

> 替换已失效的原项目图库 `file.aizhs.top` / `mp-aab956eb-*.cdn.bspapp.com`，
> 在自己电脑（端口映射方案）重建图片服务，域名 `img.aizhs.top`。

## 架构

```
微信小程序 ──HTTPS──▶ img.aizhs.top (DNS A 记录)
                          │
                   家庭宽带公网 IP
                          │ 路由器端口映射 443→本机443, 80→本机80
                          ▼
              另一台电脑: cdn-server.js (Node)
              静态根目录 server-root/
              ├── remote-images/...   (191 张已有真图)
              ├── sys-mini/...        (188 个占位空文件,缺真图)
              ├── tabbar/...
              └── MANIFEST.txt        (占位清单)
```

**行为：**

- 文件存在 → 返回真图（7 天浏览器缓存）
- 文件不存在或为空 → 返回灰色占位 PNG + `X-Placeholder: missing-image` 响应头（开发期肉眼可见哪张缺）
- 未注册路径 → 404 JSON

## 前置条件（一次性）

### 1. DNS 解析

到域名服务商（aizhs.top 所在平台）添加：

| 类型 | 主机记录 | 记录值              |
| ---- | -------- | ------------------- |
| A    | img      | 你的家庭宽带公网 IP |

- 不知道公网 IP：在承载电脑上访问 `https://ip.me` 查看
- **家用宽带多为动态 IP**：建议同时配 DDNS（路由器自带或 `ddns-go`），避免每次重启都要改解析

### 2. 路由器端口映射

| 外部端口 | 内部 IP        | 内部端口 | 协议 |
| -------- | -------------- | -------- | ---- |
| 443      | 承载电脑内网IP | 443      | TCP  |
| 80       | 承载电脑内网IP | 80       | TCP  |

### 3. HTTPS 证书 —— ⚠️ 关键，不能用自签

**微信小程序强制要求**：网络请求与图片域名的 HTTPS 证书必须由受信任 CA 签发，
自签证书会直接加载失败（控制台报 SSL 错误）。

推荐 **Let's Encrypt 免费证书**（90 天有效，自动续期）。两种签发方式任选：

#### 方式一：HTTP-01（最简单，适合能开放 80 端口的场景）

在承载电脑安装 [win-acme](https://www.win-acme.com/)：

```powershell
# 下载解压后运行
wacs.exe --target manual --host img.aizhs.top --webroot ./acme-challenge --emailcert
```

前置：DNS 已生效、路由器 80 端口已映射，然后按向导走完即可。
证书输出默认在 `C:\ProgramData\win-acme\acme-v02\...\img.aizhs.top\` 下，
复制 `cert.pem`（fullchain）和 `key.pem` 到本目录：

```powershell
Copy-Item "C:\ProgramData\win-acme\acme-v02\cabundle\..." .\cert.pem
```

> win-acme 自带续期任务，无需手动管。

#### 方式二：Cloudflare DNS-01（80 端口不通时用）

若 DNS 托管在 Cloudflare：

```powershell
wacs.exe --plugin DNS.CF --host img.aizhs.top --cfapitoken <你的API令牌>
```

### 4. 部署文件传输

把以下内容复制到承载电脑同一目录（如 `D:\ihui-cdn\`）：

```
cdn-server.js
deploy-cdn.ps1
server-root/          ← 本仓库整个目录复制过去（含 191 张真图 + 占位结构）
```

## 推荐路径：复用 aizhs.top 所在穿透机 + Cloudflare 回源（零证书）

侦察结论（2026-08）：`aizhs.top` 已由另一台电脑经内网穿透对外提供服务，
且 DNS 托管在 Cloudflare（`eve/micah.ns.cloudflare.com`，主域开启橙云代理）。
此架构下 **Cloudflare 负责 HTTPS，源站只需 HTTP**，无需任何证书签发：

```
微信小程序 ──HTTPS──▶ Cloudflare(橙云) ──HTTP──▶ 穿透机:80 (cdn-server.js)
```

在承载电脑上解压 `cdn-package.zip` 后一条命令完成（防火墙规则 + 启动 + 自检）：

```powershell
.\cdn-bootstrap.ps1              # 默认 HTTP :80，自动探测 server-root
.\cdn-bootstrap.ps1 -Install     # 另外注册开机自启计划任务 IHUI-ImageCDN
```

随后只需两处控制台操作：

| 位置                             | 操作                                                                      |
| -------------------------------- | ------------------------------------------------------------------------- |
| Cloudflare DNS（aizhs.top zone） | 添加 `img` A/CNAME 记录 → 同穿透机，**橙云开**；SSL/TLS 模式保持 Flexible |
| 微信公众平台                     | downloadFile 合法域名加 `https://img.aizhs.top`                           |

验证：浏览器打开 `https://img.aizhs.top/tabbar/tabbar/home.png`
（缺真图的路径返回灰底占位 PNG，响应头带 `X-Placeholder: missing-image`）。

> 若不使用 Cloudflare 回源而要求源站自证 HTTPS，则回到下方 win-acme 方案。

## 本地打包（在开发机生成 cdn-package.zip）

```powershell
Compress-Archive -Path deploy\cdn-server.js,deploy\deploy-cdn.ps1,`
  deploy\cdn-bootstrap.ps1,deploy\generate-placeholders.js,deploy\server-root `
  -DestinationPath deploy\cdn-package.zip -Force
```

## 启动

```powershell
cd D:\ihui-cdn

# 首次（含证书检查 + 打印配置摘要）
.\deploy-cdn.ps1 -FirstTime -HttpsPort 443 -HttpPort 80 -HostName img.aizhs.top

# 日常启动
.\deploy-cdn.ps1

# 验证
curl.exe -I https://img.aizhs.top/remote-images/back.svg
curl.exe -I https://img.aizhs.top/tabbar/home/xia/commission.png   # 占位图响应头 X-Placeholder
```

## 微信后台白名单（必做！）

登录 [微信公众平台](https://mp.weixin.qq.com) → 开发 → 开发管理 → 开发设置 → **服务器域名**：

- `downloadFile 合法域名` 增加：`https://img.aizhs.top`
- （如该域名还承载 API 请求则同时加到 `request 合法域名`）

每月有修改次数限制，谨慎操作。

## 替换真图流程

以后拿到任何一张真图：

```powershell
# 1. 覆盖到对应路径（对照 MANIFEST.txt）
Copy-Item .\king.png .\server-root\tabbar\home\zhongxia\king.png -Force

# 2. 无需重启服务器（实时读盘），最多等 CDN 缓存过期
#    或者给文件改名加版本号刷新缓存，例如 king.v2.png（需同步改代码引用）
```

批量替换后清理清单：删掉 `MANIFEST.txt` 中对应行，全部替换完成时删除本文件所在 placeholder 目录结构。

## 代码侧环境变量

`apps/miniapp-taro/src/constants/icon-urls.ts` 支持运行时覆盖 CDN 前缀：

```bash
# 编译期注入（Taro CI）
IMAGE_CDN_BASE=https://img.aizhs.top npm run build:weapp

# 未来迁移到云存储只改这一处，不动业务代码
IMAGE_CDN_BASE=https://xxx.cos.ap-shanghai.myqcloud.com npm run build:weapp
```

## 安全说明

- 服务器内置防路径穿越（`..` 拦截 + root 白名单校验）
- 全网开放下载无鉴权（图片类公开资源，符合原项目行为）
- 建议 Windows 防火墙仅放行 80/443 入站规则
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
