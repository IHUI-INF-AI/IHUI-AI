<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 钉钉 `Contact.User.Read` 权限申请与端到端验证指南

> 适用：用户在智汇AI 连接器页用钉钉扫码授权自己账号后，AI 需以该用户身份真实调用通讯录接口（如查询用户详情）。
> 本指南区分两件**互相独立**的事，缺任一都会导致调用失败：
>
> 1. **用户 OAuth 授权**（`scope=openid`）——扫码拿用户身份，代码链路已就绪。
> 2. **应用级接口权限**（`Contact.User.Read` / 「成员信息读权限」）——在钉钉开发者后台为应用申请，**需企业管理员在钉钉侧操作，无人能代劳**。

## 一、先分清两层权限（最常见的误判）

| 层次 | 是什么 | 谁来做 | 本平台职责 |
| --- | --- | --- | --- |
| 用户授权 | OAuth2 `scope=openid` + `prompt=consent`，换取 userAccessToken | 用户本人扫码 | 已实现：authorize/callback/token 刷新全链路 |
| 应用权限 | `Contact.User.Read`（通讯录「成员信息读权限」） | 企业管理员在开发者后台申请 | 只做引导 + 申请后验证 |

平台代码侧 OAuth 配置见 `apps/ai-service/app/services/connectors/connector_oauth.py` 的 `dingtalk` 项：
`scope=openid`、`prompt=consent`、`token_url=https://api.dingtalk.com/v1.0/oauth2/userAccessToken`。
这枚 userAccessToken 只解决「我是谁」，**不含通讯读权限**；通讯读权限必须单独在钉钉后台给应用开。

## 二、精确到菜单路径的申请步骤（钉钉官方，2026-09 版）

官方依据：<https://open.dingtalk.com/document/orgapp/apply-for-permissions-6> 与
<https://open.dingtalk.com/document/app/add-interface-call-permissions>。

1. 用**企业管理员账号**登录钉钉开发者后台：<https://open.dingtalk.com/> → 右上角「开发者后台」。
2. 左侧「应用开发」→「钉钉应用」→ 找到本平台配置的那个企业内部应用（即 `tenant_platform_apps` 里钉钉平台绑定的 `clientId` 对应应用），点击进入应用详情。
   - **本平台钉钉应用 Client ID（AppKey）已查明 = `dingojemqcxfzr2f5xzd`**（2026-11-25 现读生产/本地 `tenant_platform_apps.app_id`，平台 `dingtalk` 行；配套 `agent_id=4012380713`、`robot_code=dingojemqcxfzr2f5xzd`）。在开发者后台「基础信息 → 凭证与基础信息」里按此 Client ID 定位应用，**不要申请到别的应用上**。
   - 该应用的回调地址已配置为 `https://aizhs.top/callback?platform=dingtalk`，无需再改。
3. 应用详情左侧 →「权限管理」→ 切到「通讯录管理」页签。
4. 在权限列表里勾选 **「成员信息读权限」**（新版服务端 API 权限点 Code 为 `Contact.User.Read`；旧版界面可能显示为「企业员工手机号信息和邮箱等个人信息」）。
   - 找不到时，用权限管理页的搜索框直接搜 `Contact.User.Read` 或「成员信息读」。
5. 点「申请权限」；若要求填写申请说明，写明用途，例如：「智汇AI 连接器以用户身份读取企内通讯录用户详情，用于授权后 AI 调用通讯录接口」。
6. 提交后等钉钉小二审批，**通常 1 个工作日内**，状态变为「已开通」即生效。
   - 被拒时：在权限管理页把鼠标移到「审核未通过」上看拒绝原因，补材料后重提。

> 权限按**应用**维度授予：换应用或重建应用都要重新申请，已有应用的权限不会自动继承。
> 若只需接口返回里的手机号/邮箱字段，还需在同一「通讯录管理」页额外勾选对应的手机号/邮箱权限，否则字段会被脱敏或缺失。

## 三、申请通过后的端到端验证

### 3.1 前置条件

- 钉钉应用权限状态 = 已开通。
- 平台侧钉钉租户应用凭据已配好（Client ID / Secret、回调地址 `https://aizhs.top/callback?platform=dingtalk`）。
- 用户已在本机/生产连接器页走完钉钉扫码授权，平台库里存有该用户的有效钉钉 userAccessToken（过期会自动刷新）。
- 相关服务在线：api 8802、ai-service 8803（生产为 `aizhs.top` 对应后端）。

### 3.2 平台内验证（推荐，走前端真实链路）

1. 浏览器登录平台 →「连接器」页 → 钉钉卡片点「扫码授权自己账号」，用钉钉 App 扫码并同意。
2. 授权成功后，在连接器页对钉钉执行「探测」或调用一个通讯录类 operation（如查询用户详情）。
3. 判定：
   - 成功返回用户详情（姓名/userid 等）⇒ 权限 + 授权链路全通。
   - 返回 `AccessDenied` / `requiredScopes: Contact.User.Read` ⇒ 应用权限仍未生效或申请到了错误的应用，回第二步核对 Client ID 与权限状态。
   - 返回 userAccessToken 失效/过期 ⇒ 走连接器页「续期」重新扫码。

### 3.3 服务端验证（排障用，绕过前端确认根因）

拿到授权用户的钉钉 userAccessToken 后，直接调新版通讯录接口确认权限：

```bash
# 用 userAccessToken 调「获取用户通讯录个人信息」（平台 catalog 同款端点），
# <unionId> 换成目标用户的 unionId；该 operation 的 scope 正是 Contact.User.Read
curl -s 'https://api.dingtalk.com/v1.0/contact/users/<unionId>' \
  -H "x-acs-dingtalk-access-token: <用户 userAccessToken>"
```

- 对应平台 catalog operation：`dingtalk_contact_api_dingtalk_retrieve_user_information`
  （`apps/ai-service/app/services/connectors/catalog_data/dingtalk_api_ledger.json`，`base_url=https://api.dingtalk.com`）。
- HTTP 200 + 用户详情 JSON ⇒ `Contact.User.Read` 已生效。
- 403 / `AccessDeniedDetail.requiredScopes` 含 `Contact.User.Read` ⇒ 应用权限未开通；错误信息里的 `requiredScopes` 就是要申请的权限点 Code，在权限管理页搜它申请即可。
- 401 / token 无效 ⇒ userAccessToken 过期或授权链路有问题，先重新扫码。

> 平台代码侧已按钉钉规范用 `x-acs-dingtalk-access-token` 请求头注入令牌（见
> `apps/ai-service/app/services/connectors/custom_http.py`），无需也无效应改成 `Authorization: Bearer`。

## 四、常见失败与对应动作

| 现象 | 根因 | 动作 |
| --- | --- | --- |
| 扫码成功但调通讯录 403 `Contact.User.Read` | 只做了用户 OAuth，没申请应用级权限 | 走第二节申请，等审批通过 |
| 申请后仍 403 | 申请到了别的应用 / 缓存未刷新 | 核对 Client ID；审批通过后重新扫码授权一次 |
| 手机号/邮箱字段缺失 | 只开了基础读权限，没开敏感字段权限 | 通讯录管理页额外勾选手机号/邮箱权限 |
| 回调报 redirect_uri 不匹配 | 钉钉后台回调地址与平台不一致 | 后台改为 `https://aizhs.top/callback?platform=dingtalk` |

---

## 五、现读状态快照（2026-11-25 实测）

| 检查面 | 实测结果 | 结论 |
| --- | --- | --- |
| 平台代码链路 | `catalog_data/dingtalk_api_ledger.json` 有 `dingtalk_contact_api_dingtalk_retrieve_user_information`（scope=`Contact.User.Read`）；`custom_http.py` 用 `x-acs-dingtalk-access-token` 注入；OAuth/刷新/回调全实现 | 代码侧完备，无需改 |
| 生产钉钉应用配置 | `tenant_platform_apps` 的 `dingtalk` 行 enabled=true、secret 已设、回调 `https://aizhs.top/callback?platform=dingtalk` | 配置就绪 |
| 本机钉钉 CLI 授权 | `dws contact +me` 成功返回当前用户（李春川）姓名/userId/手机/部门；`dws contact dept search` 可正常读组织 | **本机 dws 链路的通讯录读权限是通的**（这条链路是钉钉 CLI 自身授权，与下方平台连接器链路互相独立） |
| 平台连接器用户授权 | 生产与本地 `oauth_users` 的 `provider='dingtalk'` 行数 = **0** | **从无用户走完平台侧钉钉扫码授权**，平台链路里不存在 userAccessToken，第三节验证的前提尚未建立 |
| 钉钉开放平台后台登录态 | 内置浏览器打开 `open.dingtalk.com/console` 被重定向回首页，无已登录管理员标签页，无外部浏览器扩展 | 当前环境无企业管理员登录态 |

**因此这一步存在两个互不相同的真人动作，AI 均无法代劳（缺管理员登录态 / 缺真人扫码）：**

1. **管理员在钉钉开放平台后台给应用 `dingojemqcxfzr2f5xzd` 申请 `Contact.User.Read`**（第二节）——须企业管理员账号登录后台勾选并提交，等钉钉审批。
2. **用户本人在平台连接器页用钉钉扫码授权**（第三节 3.2）——目前生产库 0 条授权记录，授权后才会产生 userAccessToken。

AI 侧已完成：链路核验、应用 Client ID 查明并写入本文档、临时探针清理。两项真人动作完成后，按第三节验证即可。
