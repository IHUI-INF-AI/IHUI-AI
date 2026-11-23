<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 本机客户端票 → 生产号池的入账流程与三条死路（2026-11-23 取证定稿）

适用范围：把本机已登录的 Trae / Qoder / WorkBuddy 会话票送进 `aizhs.top` 的第三方 AI IDE 账号池
（`ai_relay_account_pool`），并让「永久保活 + 自动签到」在生产侧接管。本文只记**实测走通的那一条**
和**实测证伪的三条**，不写没跑通的出路（AGENTS §0.8）。

## 一、唯一走通的通道：生产后台号池页的文件上传口

入口 `https://aizhs.top/admin/relay/account-pool` → 「导入账号」→ 选平台 → 「选文件」→ 提交导入。

为什么是它而不是任何 CLI：

- 生产 admin 的授权只存在于浏览器会话里。`auth_token` 是 httpOnly cookie，`localStorage.ihui-auth`
  里只有 `{state:{isAuthenticated,user}}` 的用户档案，**没有任何 JWT 字段**，页内脚本取不到凭据。
- 该页前端自带可用的写请求姿势（CSRF/Bearer 由 api-client 处理），CLI 侧复刻不出来。
- 导入端点 `POST /admin/relay/accounts/import` 的 `accounts` 是自由键（`z.record(z.string(), z.unknown())`），
  平台必填校验交给服务端 `recognizeImportShape` 单源，所以载荷按各平台原生形状交即可。

载荷形状：`{"providerCode":"<平台>","accounts":[{ ...必填键, "keepAliveForever": true }]}`

各平台必填键（按本机提取器**实际产出**的键名，不是猜的）：

| 平台 | 必填键 | 备注 |
| --- | --- | --- |
| trae | `uid` `token` `refreshToken` `deviceId` `deviceKeyPem` `devicePubPem` | 桌面渠道签发的票换票时带 DeviceProof，少两把 PEM 生产侧刷不动 |
| qoder | `uid` `accessToken` `refreshToken` `deviceId` `machineId` | access 票的键名是 `accessToken`，不是 `token` |
| workbuddy | `uid` `token` `refreshToken` | 提取器**不给** `uid`，必须从 `meta.templateUid` 补；缺了它生产里是个认不出身份的号 |

提取入口（本机，只读）：`scripts/lib/{trae,qoder,workbuddy}-auth-extract.mjs`。
WorkBuddy 的票只存在于主进程内存 ⇒ 提取前桌面版必须在跑且已登录（本机落点
`%LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop.info`）。

## 二、「永久保活」为什么只能随载荷一起进池

判据住在 `apps/api/src/services/relay-account-pool-scheduler.ts` 的 `KEEPALIVE_FOREVER_KEY` 一族：登记了
`extraMetadata.keepAliveForever` 的号，保活窗口默认 24h、只看客户端心跳不看 client-first，被失败计数
摘除后退避 6h 自动解摘。

登记面只有两条真实出口：

1. **随导入载荷透传**（本文用的这条）：`importAccounts` 对 canonical/别名集之外的键一律走
   `foreignPassthroughMetadata` 落进 `extraMetadata`，布尔值原样保留，因此 `keepAliveForever: true`
   一次入账即登记完成。
2. 直连库的 CLI `apps/api/scripts/relay-account-keepalive.ts --mark <uid>`。

`admin/relay/accounts` 路由**没有**单独登记永久保活的端点——所以"先导入、再调个接口打开保活"这条路不存在。
生产机也没有本机那样的直库 CLI 前置（见第四节）。结论：走生产页面入账时，保活标记必须写进载荷。

验证判据（现读，别信"应该生效了"）：账号行 `extraMetadata.keepAliveForever === true` ∧ `isEnabled` ∧
号池任务中心 `relay-pool-sweep` 每 5 分钟 `lastRunOk=true` ∧ 新导入行的 `healthStatus` 在下一轮被定级
（导入会把健康重置为 `unknown`，等一轮 sweep 变 `healthy` 才算调度器真扫到了它）。

## 三、三条已证伪的死路（后人勿重踩）

1. **本机起 127.0.0.1 一次性回环服务、由浏览器页内 fetch 取票再投生产** —— 站点 CSP 拦住 https 页面访问
   `http://127.0.0.1`，实测 `TypeError: Failed to fetch`（页面 RUM 包装层报出）。结构上走不通，不是参数问题。
2. **页内 fetch 自取 CSRF token 再 POST 生产** —— 生产 CSRF 是双提交 cookie 模式
   （`XSRF-TOKEN` httpOnly cookie ↔ `x-csrf-token` header，比对签名+nonce+exp）。在 Next `/api` 代理链下
   该 cookie 拿不到，实测 `403 CSRF 校验失败`，同域与跨 `api.aizhs.top` 两次都是这个结果。
3. **CLI 直发（`scripts/relay-prod-ingest.mjs`）** —— 它只从环境变量 `IHUI_ADMIN_JWT` 读会话，而本机两处
   admin 口令来源（`IHUI_ADMIN_PASSWORD`、`D:\DevEnv\secrets\admin-password.txt`）都不存在，浏览器里也没有
   可外带的 JWT。该器物保留给"确有 admin 口令"的场景，本机日常入账不走它。

## 四、本机环境事实（决定本机只能当提取源）

现读：`DATABASE_URL` 指向 `localhost:8810` 但**无人监听**；无 PostgreSQL 服务、无 `postgres.exe`、无数据目录；
`C:\Program Files\Docker` 是空目录；WSL 无发行版。⇒ 号池表在本机读写不了，`relay-account-keepalive.mjs --status`
直接查询失败，本机侧保活/签到结构上跑不起来。叠加笔记本 S0 待机即断网，「永久保活」只能落在 7×24 的生产侧。

## 五、签到这一格：一次被实测推翻的判定，与一个仍未修的判据缺陷

### 5.1 先记下被推翻的结论（防后人照它动手）
本节初稿曾写「点查面与写入面不同源：个人池号落 `owner=<用户id>`，点查不发 `ownerUserId` ⇒ 落
`POOL_SYNC_OWNER` 哨兵桶 ⇒ 恒 `found:false`」。**这条不成立**，两条证据：

- 线上面 `apps/ai-service/app/services/checkin_store.py` 的 `_find_pool_account` **优先**按
  `device_map->>'pool_account_id' = $1` 寻址（跨 owner 稳定），只有 poolAccountId 为空才回落
  `(owner, platform, identity_key)`；api 侧 `fetchPoolStatus` 确实携带 `poolAccountId` ⇒ 哨兵桶那条路没被走到。
- 实测复核：入账后一度显示「未同步」的三行，后续复测**全部不再显示**——Trae `15012585…` 已签 积分 100、
  WorkBuddy `46ee0288…` 已签、Qoder `019f47e7…` 未签。即 `found` 最终为 true，「未同步」只是
  入账到首次同步之间的一次性窗口，不是持续缺陷。

### 5.2 仍未修的真缺陷：失败被报成「签到完成」
- `apps/api/src/services/relay-account-pool-checkin-sync.ts` 的 `postPoolRun` 返回
  `{ ok: true, httpStatus: 200, record: body ?? {} }` —— **`ok` 等价于 HTTP 200**，响应体里的
  `record.ok` 原样带出却不参与判定。
- `apps/web/app/(main)/admin/relay/account-pool/page.tsx` 的 `checkinRunMut.onSuccess` 只看 credits：
  `credits !== null && credits !== undefined ? '签到成功，积分 +N' : '签到完成'`，于是
  `record.ok === false`（以及 `skip_already`）一律弹「签到完成」。类型里声明了 `ok?: boolean` 却未使用。
- 页面「签到」列本身是诚实的：`ci.lastRecord?.ok ? '已签' : '未签'`。所以 Qoder 那行「未签」= 签到侧
  确实落了一行 `ok=false` 的记录（`checkin_scheduler.py` 的 `record_result` 无条件 INSERT），而 toast 说
  「完成」——**同一页面同时呈现「完成」与「未签」，两处判据互相打脸**。

最小修法（只改前端一处）：`onSuccess` 以 `d.record?.ok === true` 为成功判据，`ok=false`/缺失走
error/warning 并带 `record.message`，credits 只作附加文案；api 与 ai-service 侧无需动（判据数据已在响应体里）。
必动测试：前端补 `ok=true/false/缺失` 三态用例（现全仓无该 toast 的任何测试）；
`apps/api/src/routes/__tests__/relay-account-pool-checkin-admin.test.ts` 补一条
「`record.ok=false` 仍回 success 包体」的形状锁，钉住后端语义不被顺手改掉。

为什么不在本机直接改：该修复要生效必须经「推送 → 构建 → 生产部署」，而本机对 GitHub 间歇不可达
（实测 `Recv failure: Connection was reset`）、也没有生产部署链路。写成一枚既推不上也验证不了的改动，
正是 §0.9 说的「造好没装车 = 没有」，所以这里只留精确交接物。

### 5.3 已判定：Qoder 签到拿不到积分是活动空窗，不是链路故障
初稿把这一格记为"未判定（需生产库 message）"。本轮已从生产页面取到该记录原文，判定如下：

```
found: true, ok: true
lastRecord: { ok: false, action: "claim", credits: null,
              message: "活动未下发或已结束(等下一轮)", code: null, httpStatus: null }
```

三条结论：
- **点查没有缺陷**：`found=true`，所以这一格与 5.1 被推翻的 owner/哨兵桶假设无关。
- **签到引擎在正常跑并如实记账**：它落了 `ok=false` 的行，`action=claim`、`message` 写明原因，
  `code/httpStatus` 皆 null ⇒ 不是网络、不是 HTTP 拒绝、不是凭据解不开。
- **原因是 Qoder 侧签到活动当前未下发/已结束**，引擎按 `等下一轮` 语义退出。这属于**正常的活动空窗**，
  不是故障，也不需要"修"。一旦活动下发，`claim_ok` 支会带回整数 credits 并显示「已签 积分 N」。

所以定性纪律是：**看到 Qoder「未签」先去读 `lastRecord.message`，不要按失败去排查链路**——
`skip_already`（今日已领取）同样回 `credits=null`，两者都不等于故障。

这也正是 5.2 那个缺陷必须修的原因：`credits=null` 时 toast 恒弹「签到完成」，把 `ok=false` 的活动空窗
说成成功，而同一页面状态列诚实显示「未签」——运维会被 toast 误导，以为已经在领了。

### 5.4 既有对账腿为什么没兜住
周期对账 `planCheckinEnabledReconcile` 只核 enabled 与 cred_version 同步态，不核执行成败；端点 31
reauth-status 按 `code/httpStatus` 归档，而 Qoder 各失败支 `code=None` 落不进该档；
`deriveCheckinStatus` 会把该行记成 `failed`，是唯一的诚实台账，但无人对其存量报警。
**没有任何守门或指标比对「pool-run 回 200 但 record.ok=false」**——这就是上面那个缺陷能长期静默的原因。

### 5.5 相邻事实（非缺陷）
doubao 行显示「冷却至 2036-11-15」不是默认值泄漏：`checkin_scheduler.py` 的
`_PERMANENT_COOLDOWN_DAYS = 3650` 在 `cooldown_seconds < 0`（SessionDead）时按 `now + 3650 天` 记账，
解冷腿只有换票且凭证版本前进。

## 六、本次入账结果（2026-11-23 现读，含两轮复测）

| 平台 | uid（前缀） | 归属 | 永久保活 | 点签到返回 | 复测签到档 |
| --- | --- | --- | --- | --- | --- |
| Trae | `15012585…` | admin 个人池 | 已登记 | 签到成功，积分 +100 | 已签 积分 100 |
| Qoder | `019f47e7…` | admin 个人池 | 已登记 | 签到完成 | **未签**（见 5.2/5.3） |
| WorkBuddy | `46ee0288…` | admin 个人池 | 已登记 | 签到完成 | 已签 |

三行 `isEnabled=true`、`checkinSync.pending=false`、`healthStatus` 可用；`relay-pool-sweep` 每 5 分钟一轮且
当轮已把新导入行从 `unknown` 定级；`checkin-scheduler` 下一轮在册。入账后初期三行都显示「未同步」，
复测时已全部转为「已签/未签」——即 5.1 那条一次性窗口。

**结论口径**：Trae 与 WorkBuddy 的自动签到已确证可用（Trae 已签 积分 100）。Qoder 这一格**链路已确证正常、
当前处于活动空窗**：签到引擎落了 `ok=false / message=活动未下发或已结束(等下一轮)` 的记录，
所以「未签」是诚实状态而非故障，不需要修链路，需要修的只是 5.2 那条把空窗弹成「签到完成」的 toast 判据。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
