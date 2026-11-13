# aizhs.top 基础设施：根域 403 根因诊断与修复报告

日期：2026-11-12
问题：`www.aizhs.top` 经腾讯云 EO 返回 200 正常，根域 `aizhs.top` 经 EO 返回 403 `{"code":403,"message":"forbidden"}`

---

## 一、结论（一句话）

**根域 `aizhs.top` 在 EO 上没有完成接入，EO 边缘节点收到 `Host: aizhs.top` 的请求时找不到该加速域名的配置，直接返回 403。** 根域的 DNS 只是手动加了 A 记录指向 EO 边缘 IP，但没有按 EO 要求指向 EO 为根域分配的 CNAME 地址，因此 EO 不认这个域名。

**修复动作 100% 在 EO 控制台 + Cloudflare DNS，不需要改服务器、不需要改代码。**

---

## 二、决定性证据链（全部本机实测）

### 证据 1：权威 DNS 仍托管在 Cloudflare

```
aizhs.top NS = eve.ns.cloudflare.com, micah.ns.cloudflare.com
```

说明：DNS 没迁到 EO NS 接入模式，而是在 Cloudflare 里**手动加解析记录**指向 EO。

### 证据 2：www 与根域的 DNS 记录形态完全不同（核心差异）

| 域名                | DNS 记录类型 | 指向                              | 性质                                             |
| ------------------- | ------------ | --------------------------------- | ------------------------------------------------ |
| `www.aizhs.top`     | **CNAME**    | `www.aizhs.top.eo.dnse0.com`      | ✅ EO 为 www 分配的**专属地址**，正确            |
| `aizhs.top`（根域） | **A 记录**   | `43.174.246.66` / `43.174.247.66` | ❌ 手填 EO 边缘 IP，**不是 EO 为根域分配的地址** |

### 证据 3：不是"节点选错"，是"EO 不认这个域名"

把根域请求强制打到 **www 正在正常使用的同一批节点**：

```
https://aizhs.top 经 112.84.131.71 (www的节点) -> 403
https://aizhs.top 经 36.249.95.107 (www的节点) -> 403
https://www.aizhs.top 经 112.84.131.71        -> 200
```

**同一节点、同一时刻：www 200、根域 403** → 排除节点/缓存/源站问题，唯一变量是"域名是否在 EO 注册为加速域名"。

### 证据 4：403 由 EO 边缘生成，不是源站

```
HTTP/1.1 403 Forbidden
Server: TencentEdgeOne            ← EO 边缘自生成
EO-LOG-UUID: 14047172529845745905
EO-Cache-Status: MISS
content-type: application/json
{"code":403,"message":"forbidden"}
```

源站 8801 端口对任意 Host 头都返回 200（已实测）→ 403 不来自源站。

### 证据 5：排除了"回源失败"和"域名未生效(418)"

- 官方口径：EO **回源失败**返回 520/521/522/523/524/525，不是 403。
- 官方口径：EO **域名配置文件不存在/未生效**返回 **418**，不是 403。
- 本例是 403 + `Server: TencentEdgeOne` → 是 EO 边缘对该域名的访问控制/未识别拦截。

### 证据 6：不是证书问题

根域 HTTPS 经 EO 能正常完成 TLS 握手（证书已覆盖根域）→ 证实"先切 DNS、不等证书"决策正确。

### 证据 7：源站本身配置正常，无需改动

```
curl -H "Host: aizhs.top"    http://127.0.0.1:8801/  -> 301 (跳 https://aizhs.top/)  ← 正常 HTTPS 跳转
curl -H "Host: www.aizhs.top" http://127.0.0.1:8801/ -> 301 (跳 https://www.aizhs.top/) ← 正常
curl http://127.0.0.1:8801/ (带转发头)                -> 200                          ← 应用正常
```

源站对所有域名 Host 都能正确响应，**服务器侧零问题**，印证 403 纯在 EO 边缘。

### 证据 8：系统 DNS 与公共 DNS 差异（澄清，不影响结论）

- 本机系统 DNS 仍把根域解析到 Cloudflare 旧 IP → 访问 `https://aizhs.top` 返 `308` 跳到 `https://www.aizhs.top/`（`Server: cloudflare`，Cloudflare 的 www 跳转规则）。
- 真实公共 DNS（223.5.5.5 / 119.29.29.29）已把根域解析到 EO 边缘（43.174.246.66）。
- 本机系统 DNS 是缓存滞后，**真实访客走的是 EO 记录**，所以访客访问根域会命中 EO 边缘的 403（而非 Cloudflare 的 308 跳转）→ 403 对真实用户成立，必须修。

---

## 二·五、根因唯一性确认（排除法）

| 假设                            | 验证结果                                                   | 结论        |
| ------------------------------- | ---------------------------------------------------------- | ----------- |
| 源站返回 403                    | 源站 8801 对任意 Host 均 200/正常 301                      | ❌ 排除     |
| 回源失败                        | EO 回源失败是 5xx，不是 403                                | ❌ 排除     |
| 域名配置文件不存在              | EO 该情况返 418，不是 403                                  | ❌ 排除     |
| 证书问题                        | 根域 HTTPS 经 EO 握手正常                                  | ❌ 排除     |
| 节点选错 / CDN 缓存             | 根域打到 www 同节点仍 403、www 同节点 200                  | ❌ 排除     |
| **EO 未把 apex 注册为加速域名** | 根域无专属 CNAME、仅手填 A 记录；同节点 www 200 / apex 403 | ✅ **确认** |

---

## 三、根因机制

EO 采用 CNAME 接入模式时，每个加速域名会分配一个**专属 CNAME 地址**（形如 `<域名>.eo.dnse0.com`）。EO 边缘节点靠"请求的 Host 是否对应一条已生效的加速域名配置"来决定服务还是拒绝。

- `www` 加了 CNAME 指向它自己的 `.eo.dnse0.com` → EO 认识 → 200
- 根域只加了 A 记录指向某个边缘 IP → EO 边缘收到 `Host: aizhs.top` 找不到对应加速域名配置 → 403

**根域为什么不能直接用 A 记录？** 因为 EO 分配的是 CNAME 地址，根域在很多 DNS 服务商无法挂 CNAME。但 Cloudflare **支持根域 CNAME 展平（CNAME Flattening）**，可以把根域 CNAME 指向 EO 地址、Cloudflare 在权威侧展平成 A 记录返回——这才是根域接入 EO 的正确姿势。

---

## 四、修复步骤（精确到控制台，按顺序执行）

### 第 1 步：在 EO 控制台为根域添加加速域名（若尚未添加）

1. 登录腾讯云 EO 控制台 → 选择站点 `aizhs.top`
2. 进入 **域名管理**（或"加速域名"）→ **添加域名 / 新增**
3. 域名填根域：`aizhs.top`
4. 回源配置，与 www 保持一致：
   - 源站类型：**IP**（或自定义源站）
   - 源站地址：`175.178.13.114`
   - 回源协议：**HTTP**
   - 回源端口：**8801**
   - 回源 Host：`aizhs.top`
5. 提交后，EO 会为根域分配一个**专属 CNAME 地址**（形如 `aizhs.top.eo.dnse0.com`，**注意不是 www 的那个**）→ **复制这个地址**

> 如果 EO 控制台里根域 `aizhs.top` 已经存在，则跳到第 2 步，重点核对它的状态和回源配置是否与 www 一致、是否显示"已生效/运行中"。

### 第 2 步：在 Cloudflare 把根域解析改成指向 EO 为根域分配的 CNAME

1. 登录 Cloudflare → 选择域 `aizhs.top` → **DNS** → **Records**
2. 找到根域 `aizhs.top` 那条 **A 记录**（当前指向 43.174.246.66）
3. 把它改为：
   - 类型：**CNAME**
   - 名称：`@`（代表根域）
   - 目标：**EO 为根域分配的 CNAME 地址**（第 1 步复制的那个，形如 `aizhs.top.eo.dnse0.com`）
   - 代理状态：**DNS only（灰云）** ← 关键，必须关掉 Cloudflare 橙云代理，否则流量回不到 EO
   - Cloudflare 会自动对根域做 CNAME 展平
4. 保存。确认 `www.aizhs.top` 那条 CNAME 保持不变（已正确）

### 第 3 步：验证（DNS 生效约 1–5 分钟，最长 30 分钟）

在任意终端执行：

```bash
# 1. 确认根域解析已变成 EO 地址
nslookup -type=A aizhs.top 223.5.5.5

# 2. 端到端验证根域（预期 403 变 200）
curl -s -o /dev/null -w "%{http_code}\n" https://aizhs.top/

# 3. 同时确认 www 仍正常
curl -s -o /dev/null -w "%{http_code}\n" https://www.aizhs.top/
```

预期：根域从 `403` 变 `200`，www 保持 `200`。

---

## 五、若按上述步骤仍 403 的备选排查（概率从高到低）

1. **根域归属权未验证**：CNAME 接入模式要求域名归属权验证。核对 EO 控制台根域状态是否"待授权"，若是，在 DNS 加一条 `edgeonereclaim` 的 TXT 记录完成验证（EO 控制台会给出具体值）。
2. **根域 CNAME 状态异常**：EO 控制台根域是否显示"请添加 CNAME"或"CNAME 配置异常"。若显示，说明 Cloudflare 那条记录还没生效或指错，等待或改正。
3. **仅命中根域的安全策略**：检查 EO 的规则引擎/防盗链/访问控制里，是否存在只对根域或裸域生效、而 www 未命中的规则（Referer/IP/UA 黑白名单）。403 官方成因包含这些访问控制。
4. **以上都正常仍 403**：提工单给腾讯云 EO，附上 `EO-LOG-UUID`（当前为 `14047172529845745905`）+ 出错 URL `https://aizhs.top/` + 时间。官方明确排障需提供 EO-LOG-UUID。

---

## 六、本轮已落地的相关加固（DNS 切换前的本机侧改动，均已完成）

- 防火墙：8801 端口已收紧为仅放行腾讯云网段（含 EO 网段 43.174.0.0/16），不再对全网开放。
- certbot：`www.aizhs.top` 证书自动续期已验证（renewal dry-run 成功）。
- 这些与当前 403 无关，403 纯在 EO 控制台 + Cloudflare DNS 配置层。

---

## 七、待用户操作项（我无法代做，涉及账号登录）

| #   | 动作                                           | 位置           |
| --- | ---------------------------------------------- | -------------- |
| 1   | 为根域添加/核对加速域名，取回源域 CNAME        | EO 控制台      |
| 2   | 根域 A 记录改为 CNAME 指向 EO 根域地址（灰云） | Cloudflare DNS |
| 3   | 跑验证命令确认 403→200                         | 任意终端       |

完成后告诉我，我立刻跑一遍端到端复验确认闭环。

---

## 八、信息来源

- 腾讯云 EdgeOne 4XX/5XX 状态码排障指南：https://cloud.tencent.com/document/product/1552/112498 （403 成因=访问控制；418=域名配置文件不存在；回源失败=5xx）
- 站点域名归属权验证：https://cloud.tencent.com/document/product/1552/70789
- 域名配置相关问题（CNAME 配置异常/生效时间）：https://cloud.tencent.com/document/product/1552/122623
- 校验域名 CNAME 配置状态 API：https://cloud.tencent.com/document/product/1552/94491
- 快速接入 EdgeOne（CNAME/NS 接入模式）：https://edgeone.ai/document/zh/54208
