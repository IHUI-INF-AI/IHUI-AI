<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# LICHUNCHUAN 双向 SSH 通道实测与提速结论（2026-11-22）

> 范围：生产机（Windows，主机名 `服务器`，`服务器\administrator`，192.168.1.37）↔ 目标机（Windows 11，`LICHUNCHUAN`，`lichunchuan\administrator`）。
> 全部为只读实测，未改动 sshd、Windows 防火墙、CPE、计划任务，未新增隧道或端口映射。

## 1. 现状通道

| 项 | 值 |
| --- | --- |
| 方向 | 目标机 → 生产机（反向隧道，经 Cloudflare） |
| 载体 | `ssh -N -R 127.0.0.1:2222:127.0.0.1:22 Administrator@ssh.aizhs.top`（cloudflared access） |
| 常驻 | 目标机计划任务 `IHUI-ReverseTunnel`（SYSTEM，开机+登录+每 2 分钟自检） |
| 生产机入口 | `127.0.0.1:2222` LISTENING（本次实测 PID 9688） |
| 生产机别名 | `Host lcc` → 127.0.0.1:2222（部署私钥 `id_ed25519`，只认公钥） |
| 主机指纹 | 目标机 ED25519 `SHA256:ur1rSm+rZW4SL+3SIhJD1tQQs7BHxghNI5hTaMiMoSw` |
| 备用别名 | `Host lcc6` → 目标机 IPv6:22（当前不可达，见 §5） |

一键体检：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\IHUI-AI\deploy\win\check-lcc-tunnel.ps1
```

输出单行 JSON（`listen_2222` / `banner_rtt_ms` / `login_seconds` / `whoami` / `hostname` / `ok`），退出码 0 表示全通过。

## 2. 实测数据

### 2.1 隧道时延

| 指标 | 样本 | 结论 |
| --- | --- | --- |
| SSH banner RTT | 594 / 702 / 1225ms，均值 840ms（早前一轮 665–902ms，均值 762ms） | 抖动大，中位 700–760ms |
| 单次公钥登录 | 8.54 / 8.99 / 9.28 / 10.01 / 10.6 / 11.1s（多组参数） | 由 RTT × 往返数决定，不可优化 |

### 2.2 吞吐（20MB 级随机数据）

| 方向 | 速率 | 对照上限 |
| --- | --- | --- |
| 目标机 → 生产机 | 1.45 MB/s（11.6 Mbps） | 目标机公网上行 13.7 Mbps → **已达 85%** |
| 生产机 → 目标机 | 0.09 MB/s（0.7–0.9 Mbps） | 生产机公网上行 9.2 Mbps、目标机下行 122.6 Mbps → **仅约 10%** |
| 4 流并行（生产机→目标机） | 合计 0.5 Mbps | 低于单流，并行只会争用 |

### 2.3 两端公网带宽基准（各自本地出口，不经隧道）

| 端 | 下行 | 上行 | 测法 |
| --- | --- | --- | --- |
| 生产机（本机） | 24.7 Mbps | 9.2 Mbps | speed.cloudflare.com |
| 目标机 | **122.6 Mbps**（15.35 MB/s，20s 采样 307MB） | **13.7 Mbps**（1.72 MB/s，10MB 上传） | 清华镜像 iso / speed.cloudflare.com `__up` |

> 目标机用 Cloudflare `__down` 端点只跑出 2.6 Mbps，但同一台机器从国内镜像跑出 15.35 MB/s —— 说明该端点跨境路径差，**不代表目标机带宽**。这是前一轮把瓶颈误判为「目标带宽小」的原因。

### 2.4 参数优化实测（无效）

| 组合 | 建链均值 |
| --- | --- |
| baseline（别名默认） | 8.54s |
| 关 GSSAPI + 仅 publickey + IdentitiesOnly | 11.13s |
| + `KexAlgorithms=curve25519-sha256` + `HostKeyAlgorithms=ssh-ed25519` | 10.01s |
| + `aes128-gcm@openssh.com` + `Compression=no` | 8.99s |

差异全部落在样本抖动区间内（7.3–11.9s），**无收益**。压缩对随机数据无收益，并行更慢。

### 2.5 本机 TCP 栈（已是最优）

`Receive Window Auto-Tuning = normal`、`RSS = enabled`、`Congestion = cubic`、`Fast Open = enabled`、`Initial RTO = 1000ms`、internet 模板。无调整空间。

## 3. 瓶颈归因

- 目标机→生产机方向已达其上行带宽的 85%，**没有余量**。
- 生产机→目标机方向只有 0.9 Mbps，而两端带宽（9.2 / 122.6 Mbps）都远高于此，本机 TCP 参数也已最优 → 瓶颈在 **cloudflared 隧道单向（入站到目标机）流控/跨境路径**，不是带宽、不是 TCP 调参、不是 SSH 加密算法。
- 因此**在现有 Cloudflare 链路上无法再提速**：单流、并行、压缩、算法四类手段全部实测无收益。

## 4. 直连可行性（已实测，结论明确）

### 4.1 双向 traceroute 定位断点

- 目标机 → 生产机 IPv6：第 1 跳 `240e:310:c0b:1fb2:acd5:a511:6e13:429e`（目标机侧接入）→ 第 2–3 电信骨干 → 第 8–9 跳 `2408:8000:7100:2::2:1` / `2408:8000:7100:11f::2:1`（**联通骨干，9–20ms**）→ 第 10 跳起全部无响应。
- 生产机 → 目标机 IPv6：第 10 跳 `240e:310:c0b:1fb2:…`（电信接入侧，10ms）后全部无响应。
- 双向 `ping6` 均 100% 丢包；生产机 IPv6 出口正常（`2400:3200::1` 47–55ms）。

结论：跨运营商 IPv6 路由完全通畅（电信↔联通 20ms 内可达），**两端都被各自 CPE 的 IPv6 入站防火墙拦下**。任一端放行即可直连。

### 4.2 生产机侧已就绪（只差 CPE）

- Windows 防火墙已有入站规则 `OpenSSH SSH Server Preview (sshd)`：TCP 22 / Allow / Enabled。
- sshd 监听 `0.0.0.0:22` 与 `[::]:22`，Running / Auto。
- 目标机持有 `ihui_ssh` 私钥，对应生产机 `authorized_keys` 中 `ihui-client-LICHUNCHUAN`（`SHA256:1ks23HhFBmdoWZYTm0UV21ywTgwUrEK3n2tNJxgCpVA`）→ 放行后可直接公钥登录，无需新增凭据。

### 4.3 直连后的预期（基于实测节点延迟）

| 指标 | 现状（Cloudflare） | 直连预期 |
| --- | --- | --- |
| RTT | 700–840ms | 10–30ms（骨干实测 9–20ms） |
| 单次建链 | 8.5–11s | < 1s |
| 生产机 → 目标机 | 0.9 Mbps | ≈ 9 Mbps（受生产机上行限制），**约 10 倍** |
| 目标机 → 生产机 | 11.6 Mbps | ≈ 11–13 Mbps（受目标机上行限制），基本不变 |

## 5. 可选路径（按性价比排序）

### A. 生产机侧放行光猫 IPv6 入站（推荐，只需一端，操作方在生产机）

1. 浏览器打开网关（本机网关 192.168.1.1），管理员账号通常在设备背面标签。
2. 找「IPv6 防火墙 / IPv6 安全 / 端口映射(IPv6)」。
3. 首选：入站放行规则 —— 协议 TCP、端口 22、目的地址 `2408:8234:c16:1235:a43f:ec62:a4c5:15b9`。
4. 次选（仅当设备不支持按地址放行）：整体关闭 IPv6 防火墙。Windows 防火墙仍在护着 22 端口，但整网入站会放宽，能选首选就别选次选。
5. 保存，必要时重启 CPE。

放行后由目标机验证（其 `Host prod` 已可用）：

```powershell
ssh -6 -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -i C:/Users/Administrator/.ssh/ihui_ssh Administrator@2408:8234:c16:1235:a43f:ec62:a4c5:15b9 "hostname; whoami"
```

预期：`LICHUNCHUAN` + `lichunchuan\administrator`。若要长期往返，双方各加一个短别名即可。

注意：本机 IPv6 为 SLAAC 地址，CPE 重启后可能变化；放行时优先绑定网卡 MAC 固定后缀。

### B. 目标机侧放行光猫 IPv6 入站（等价，操作方在目标机）

放行 TCP 22 到 `240e:312:e56:e300:3a14:b9e2:75f6:b2ac`，生产机侧用已备好的别名验证：

```powershell
ssh lcc6 "hostname; whoami"
ssh-keyscan -p 22 -t ed25519 240e:312:e56:e300:3a14:b9e2:75f6:b2ac | ssh-keygen -lf -
```

指纹必须是 `SHA256:ur1rSm+rZW4SL+3SIhJD1tQQs7BHxghNI5hTaMiMoSw`。

### C. P2P 打洞（不依赖任何入站，兜底）

Tailscale / WireGuard：双方装客户端、同一账号登录，NAT 后直接打洞，成功时 RTT 30–80ms；打洞失败会自动走中继（此时不优于现状）。适用于两端都无法改 CPE 的场景。

## 6. 硬约束（全部保持不变）

- 只走公钥；两端均已关闭密码 / keyboard-interactive，试密码必然失败。
- 只认 `127.0.0.1:2222`（反向）与 `lcc6`（直连预留）；不新增隧道、地址、端口。
- 不改 sshd 配置、不改 Windows 防火墙、不做 IPv4 公网端口映射。
- 私钥不外传；生产机私钥属主已改为 SYSTEM（常驻任务必需），不回退。
- 目标机 `~/.ssh/config` 中 `prod` 指向 ssh.aizhs.top（正向），与本机 `lcc`（反向）方向相反，不要混用。

## 7. 复验清单

```powershell
# 1) 隧道在听
netstat -ano | findstr :2222

# 2) 一键体检（推荐）
powershell -NoProfile -ExecutionPolicy Bypass -File D:\IHUI-AI\deploy\win\check-lcc-tunnel.ps1

# 3) 主机指纹（走隧道时看到的是目标机的，不是 ssh.aizhs.top 的）
ssh-keyscan -p 2222 -t ed25519 127.0.0.1 | ssh-keygen -lf -

# 4) 直连预留（CPE 放行后才通）
ssh lcc6 "hostname; whoami"
```

失败码对照：`Connection refused` → 隧道断（等 ≤2 分钟自愈或重启计划任务）；`Permission denied (publickey)` → 私钥不匹配；`Host key verification failed` → 指纹不符。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
