<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# aizhs.top 根域 403 修复交接清单

> 日期：2026-11-12（诊断） / **2026-11-13 已修复并复验**
> 状态：**CLOSED — 已修复，全站回归通过**
> 交接目的：~~在另一台电脑完成剩余修复动作~~ → 本机已完成，本文降级为事故存档 + 回归手册

---

## ✅ 结论先行（2026-11-13 复核，推翻下方 11-12 的旧诊断）

**真根因**：EdgeOne 七层加速规则 `origin-guard-edge-secret` 的 `Condition` 只写了
`${http.request.host} in ['www.aizhs.top']`，**漏了根域**。于是根域请求回源时
不带 `X-IHUI-Edge-Secret`，被源站 web router 的 `edgeGuardDenied` 分支按设计拒绝，
返回 `{"code":403,"message":"forbidden"}` —— 与观测到的响应体逐字一致。

**旧诊断错在哪**：11-12 那份认为"根域没注册为加速域名 / DNS 是手填 A 记录"。
实测（2026-11-13）`DescribeAccelerationDomains` 返回**两个域名都在线**：
`aizhs.top` 与 `www.aizhs.top` 均 `DomainStatus=online`、证书 `deployed`，
且 CF 记录本就是 `CNAME → aizhs.top.eo.dnse0.com`、`proxied=false`。
`nslookup` 看到的 A 记录只是 EO 边缘节点解析结果，不是配置错误。

**决定性证据（单点定因）**：同一 IP 换 Host 头 ⇒
`--resolve www.aizhs.top:443:43.174.246.66` → **200**；
`--resolve aizhs.top:443:43.174.246.66` → **403**。
节点相同、证书相同、源站相同，唯一变量是 Host ⇒ 差异只可能来自按 Host 匹配的边缘规则。

**修复动作**（2026-11-13 已执行）：用仓库器物 `scripts/eo-origin-guard-rule.mjs --apply`
重建规则，条件自动覆盖全部在线加速域名（`['aizhs.top', 'www.aizhs.top']`）。

**复验结果**：`aizhs.top/` `/login` `/sso/login` `/api/health` 全部 200；
`/admin` 307（登录保护，正常）；www 未回归；裸域与 www **双域 admin 登录全链路 200**。

**防复发**：该器物下次运行会重新比对 `buildCondition(在线域名全集)`，
少一个域名即判 `drift`（`node scripts/eo-origin-guard-rule.mjs` 只读档，11 项测试锁定）。

---

## 📋 历史诊断存档（2026-11-12，结论已被上方推翻，仅留痕）

**当时判断（❌ 错）**：EO 没把根域 `aizhs.top` 注册为加速域名，EO 边缘节点收到
`Host: aizhs.top` 请求时找不到对应配置，直接返回 403。

**当时列出的"关键差异"（❌ 已证伪）**：

- `www.aizhs.top` = **CNAME** → `www.aizhs.top.eo.dnse0.com`（正确）✅
- `aizhs.top`（根域）= **A 记录** → `43.174.246.66`（判定为手填错误）❌
  —— 实测该记录已是 EO 灰云 CNAME，A 记录只是边缘解析产物

**当时已排除项（这几条方向是对的）**：

- ❌ 不是源站问题（源站 8801 对任意 Host 都正常响应）—— 部分对：源站对任意 Host 都应答，
  但**根域 Host 应答的是 403**，正是未被那个 `if` 排除掉的真凶
- ❌ 不是回源失败（那会返 5xx，不是 403）—— 对
- ❌ 不是证书问题（根域 HTTPS 经 EO 握手正常）—— 对
- ❌ 不是节点/缓存问题 —— 对（本次已用同 IP 换 Host 实验确证）

**完整证据**：见 `INFRA-DNS-SWITCH-REPORT.md`（该件同样基于旧判断，读时以上方结论为准）

---

## 🔧 修复步骤（2026-11-13 已执行完毕，此处留作重放/换机手册）

### 唯一的正确出口：用仓库器物，别去控制台手点

```bash
# 只读体检：报规则在不在、条件是否覆盖全部在线加速域名、密钥是否一致
node scripts/eo-origin-guard-rule.mjs

# 落地：不一致则重建规则（自动按在线域名全集生成条件）
node scripts/eo-origin-guard-rule.mjs --apply
```

**为什么必须用器物**：控制台手点必然漏域名，而漏的后果就是本次这个 403。
器物每次运行都会用 `buildCondition(在线加速域名全集)` 重新比对，
少一个域名即判 `drift`（退出码 1），11 项单测锁住判据。

**不要**再用 `ModifyL7AccRule` 直接改条件：实测该接口只传部分字段会回
`InternalError`；器物的做法是 Delete + Create（稳定成功），这也是它为何存在。

### 若器物不可用时的应急手工路径（腾讯云 EO 控制台）

1. 站点 `aizhs.top` → **规则引擎 / 七层加速规则**
2. 找到 `origin-guard-edge-secret`（`ModifyRequestHeader` 型）
3. 条件 `Host` 的取值里**必须同时包含** `aizhs.top` 与 `www.aizhs.top`
4. 动作为 `set` 头 `X-IHUI-Edge-Secret` = 与源站 `IHUI-EDGE_SECRET` 同值
   （值从 `IHUI-WEB-ROUTER` 服务环境块取，**不要写进任何文档/聊天**）
5. `guest-cache-homepage-60s`（首页缓存）同样要覆盖两个 Host

> ⚠️ 只改 `origin-guard-edge-secret` 也能让根域可用；首页缓存规则不改只是
> 根域首页不吃 1800s 边缘缓存，功能不受影响。

### 验证（应全部通过）

```bash
# 根域 / 登录页 / SSO（预期 200）
curl -s -o /dev/null -w "%{http_code}\n" https://aizhs.top/
curl -s -o /dev/null -w "%{http_code}\n" https://aizhs.top/login
curl -s -o /dev/null -w "%{http_code}\n" https://aizhs.top/sso/login

# www 回归（预期 200，未被破坏）
curl -s -o /dev/null -w "%{http_code}\n" https://www.aizhs.top/

# 规则自检（预期 EO-GUARD-RULE state=ok reason=in-sync）
node scripts/eo-origin-guard-rule.mjs
```

**单点定因实验**（怀疑 403 复发时跑这个，一次分清"节点/证书"与"规则"）：

```bash
curl -s -o /dev/null -w "%{http_code}\n" --resolve "www.aizhs.top:443:43.174.246.66" https://www.aizhs.top/
curl -s -o /dev/null -w "%{http_code}\n" --resolve "aizhs.top:443:43.174.246.66" https://aizhs.top/
# 同 IP、同证书、同源站，只有 Host 不同 ⇒ 200 vs 403 即证明是"按 Host 匹配的规则"缺了根域
```

---

## ⚠️ 注意事项（2026-11-13 按实测重写）

1. **DNS 已正确，别再改**：根域 `aizhs.top` 本来就是 `CNAME → aizhs.top.eo.dnse0.com`
   且 `proxied=false`（灰云）。原始"手填 A 记录"的判断经 `DescribeAccelerationDomains`
   证伪 —— 别再去 Cloudflare 改它，改了才会真出问题。
2. **别动 www**：www 那条 CNAME 已正确，改了会全站崩。
3. **不要等"DNS 传播"**：本次 403 与 DNS 无关，规则改完立即生效（实测 sleep 15s 即 200）。
   若复查仍是 403，直接跑上面的"单点定因实验"，别再等 30 分钟。
4. **回源端口 8801 (HTTP) 已正确**：EO 两个域都是 `OriginProtocol=HTTP, HttpOriginPort=8801`，
   且源站在 8801 上正常服务。这不是故障点。
5. **改动顺序敏感**：`origin-guard-edge-secret` 缺域名 ⇒ 全站 403（不只是根域）；
   所以改这条规则后**必须同时验 www 与根域**，不能只看根域变绿就收工。
6. **密钥绝不落纸**：`X-IHUI-Edge-Secret` 的值只存在于 `IHUI-WEB-ROUTER` 服务环境块与
   生产 api `.env`；器物会自行取值并保证不打印。任何文档/聊天里都不写明文。

---

## 📋 官方参考

- EO 4XX/5XX 状态码排障：https://cloud.tencent.com/document/product/1552/112498
- 站点域名归属权验证：https://cloud.tencent.com/document/product/1552/70789
- 域名配置相关问题：https://cloud.tencent.com/document/product/1552/122623
- 快速接入 EdgeOne：https://edgeone.ai/document/zh/54208

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
