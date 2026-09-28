<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。
-->

# 发布平台凭据配置与运维指南(PUBLISH_SETUP)

> 本文是 `apps/api/src/routes/publish-routes.ts` 中 14 条 `setupHint` 指向的落地文档。
> 字段名一律从唯一真相源读取:各平台适配器类属性(`apps/ai-service/app/services/publish/adapters/*.py` 的
> `requires_credentials` / `supported_formats` / `needs_browser`,基类 `base_adapter.py`)。
> 与前端展示注册表(`publish-routes.ts` 的 `PLATFORM_REGISTRY.requiresCredentials`)不一致之处在正文逐条点名,以适配器为准
> (适配器才真正执行 `verify_credentials` 与 `publish`)。
> 所有 curl 示例用 `$TOKEN` 占位(与 web/api 同 `JWT_SECRET`,ai-service 可直接验签);**绝不**在文档/命令里写真实凭据。

---

## 0. 平台总表(平台 × 需要的东西 × 现在能不能发)

三态口径:

- **可直接发** — 实测 `POST /api/publish/accounts/{id}/verify` 返回 connected 且发布链路已通;
- **只差凭据** — 代码链路就绪,补齐表中字段即可,不需要任何平台侧动作;
- **还差平台侧动作** — 就算凭据补齐还需在平台后台/登录态上做一件事(IP 白名单、人工重新扫码登录等)。
- 未实测的行在状态后追加 **(待核)**:结论仅由代码推导,今天没有真实 verify 记录。

| 平台 id | 名称 | 必填字段(适配器 `requires_credentials`) | 形态 | 现在能不能发 |
| --- | --- | --- | --- | --- |
| `juejin` | 掘金 | `sessionid`、`signatureId` | Playwright | **可直接发**(实测 verify `connected`;成功判据见 §4.12) |
| `csdn` | CSDN | `UserName`、`UserToken`、`UserSecret` | Playwright | **还差平台侧动作**(verify 过但发布撞登录墙,需人工重新扫码登录,见 §4.11) |
| `wechat` | 微信公众号 | `app_id`、`app_secret` | HTTP API | **还差平台侧动作**(须把服务器出口 IP 加进公众平台白名单,实测 `errcode=40164`,见 §4.5) |
| `weibo` | 微博 | `access_token`、`uid` | HTTP API | **只差凭据**(当前实测缺 `access_token`,属开放平台凭据未申请,非代码问题) |
| `toutiao` | 头条号 | `app_id`、`app_secret` | HTTP API | **只差凭据**(当前实测缺 `app_id`/`app_secret`,属开放平台凭据未申请,非代码问题) |
| `wordpress` | WordPress | `site_url`、`username`、`application_password` | HTTP API | 只差凭据(待核) |
| `medium` | Medium | `integration_token` | HTTP API | 只差凭据(待核) |
| `youtube` | YouTube | `access_token`、`refresh_token`、`client_id`、`client_secret` | HTTP API(OAuth) | 只差凭据(待核,须走 Google OAuth 授权) |
| `bilibili` | B站 | `sessdata`、`bili_jct`、`dedeuserid` | HTTP API | 只差凭据(待核) |
| `douyin` | 抖音 | `access_token`、`open_id`、`client_key`、`client_secret` | HTTP API(OAuth) | 只差凭据(待核) |
| `kuaishou` | 快手 | `access_token`、`app_id`、`app_secret` | HTTP API(OAuth) | 只差凭据(待核) |
| `zhihu` | 知乎 | `z_c0`、`_xsrf` | Playwright | 只差凭据(待核;另需 Playwright 浏览器内核) |
| `xiaohongshu` | 小红书 | `web_session` | Playwright | 只差凭据(待核;另需 Playwright 浏览器内核) |
| `shipinhao` | 视频号 | `wechat_channels` | Playwright | 只差凭据(待核;另需 Playwright 浏览器内核) |

**前端注册表与适配器的字段差异(以适配器为准,这里点名以免照前端填错):**

| 平台 | 前端注册表 `requiresCredentials` | 适配器实际要求 | 差异说明 |
| --- | --- | --- | --- |
| `wordpress` | `app_password` | `application_password` | 键名不同;表单按哪个键存需与适配器一致(待核) |
| `bilibili` | `sessdata`、`bili_jct`、`buvid3` | `sessdata`、`bili_jct`、`dedeuserid` | 第三项不同(hint 文案写的 `buvid3` 实际不被适配器要求) |
| `medium` | `integration_token`、`author_id` | `integration_token` | `author_id` 非必填 |
| `toutiao` | `cookie` | `app_id`、`app_secret` | 适配器走开放平台,不是 cookie 方案 |
| `douyin` | `cookie` | `access_token`、`open_id`、`client_key`、`client_secret` | 同上 |
| `kuaishou` | `cookie` | `access_token`、`app_id`、`app_secret` | 同上 |
| `weibo` | `cookie` | `access_token`、`uid` | 同上 |
| `zhihu` | `z_c0`、`d_c0` | `z_c0`、`_xsrf` | 第二项不同 |
| `juejin` | `sessionid`、`sessionid_ss` | `sessionid`、`signatureId` | 第二项不同 |
| `shipinhao` | `cookie` | `wechat_channels` | 键名不同 |

`wechat`/`youtube`/`csdn`/`xiaohongshu` 两侧一致。

### 0.1 其余已注册适配器(不在 14 条 setupHint 射程内)

以下平台同样注册在 `list_all_adapter_classes()`(合计从代码枚举到 38 个适配器类),均为 Playwright 反风控形态,
字段以适配器为唯一真相源直接列出;配置与自检动作与 §4 同构(换平台 id 与字段即可):

| 平台 id | 名称 | 必填字段 | supported_formats |
| --- | --- | --- | --- |
| `36kr` | 36氪 | `_36kr_session`、`acw_tc` | md/html/image |
| `acfun` | AcFun | `acPasstoken`、`ac_session` | md/html/image |
| `baijiahao` | 百家号 | `BDUSS`、`STOKEN` | md/html/image |
| `baidu_tieba` | 百度贴吧 | `BDUSS`、`STOKEN` | md/html/image |
| `baidu_zhidao` | 百度知道 | `BDUSS`、`STOKEN` | md/html/image |
| `china_news` | 中国新闻网 | `cn_session`、`cn_token` | md/html/image |
| `cnblogs` | 博客园 | `access_token` | md/html |
| `dayihao` | 大鱼号 | `cna`、`_csrf_token`、`unb` | md/html/image |
| `douban` | 豆瓣 | `db_clnd`、`ck` | md/html/image |
| `haokan` | 好看视频 | `BDUSS`、`STOKEN` | video |
| `hupu` | 虎扑社区 | `hupu_token`、`hupu_session` | md/html/image |
| `huxiu` | 虎嗅网 | `huxiu_session`、`huxiu_token` | md/html/image |
| `jianshu` | 简书 | `cookie` | md/html |
| `lofter` | LOFTER | `NTES_SESS`、`S_INFO` | md/html/image |
| `netease` | 网易号 | `P_INFO`、`S_INFO`、`NTES_SESS` | md/html/image |
| `oschina` | 开源中国 | `access_token` | md/html |
| `people` | 人民网 | `people_session`、`people_token` | md/html/image |
| `qq` | 企鹅号 | `RK`、`ptcz`、`pgv_pvid` | md/html/image |
| `segmentfault` | 思否 | `access_token` | md/html |
| `sina` | 新浪看点 | `SCF`、`ALF`、`SUB` | md/html/image |
| `sohu` | 搜狐号 | `SUV`、`IPLOC`、`sct` | md/html/image |
| `tmtmedia` | 钛媒体 | `tmt_session`、`tmt_token` | md/html/image |
| `xigua` | 西瓜视频 | `sessionid`、`ttwid` | video |
| `zhihu_daily` | 知乎日报 | `z_c0`、`d_c0` | md/html/image |

> 注:`cnblogs`、`segmentfault`、`oschina`、`jianshu` 的 `requires_credentials` 里的 `access_token` / `cookie`
> 具体语义(平台 token 还是登录 cookie)各适配器注释不一,**待核**;入库前先 verify 再发布。

---

## 1. 凭据入库的三条通道(通用)

所有路径均为 ai-service(FastAPI,本机默认端口 `8803`)侧真实路由;apps/api(端口 `8802`)的
`/api/publish/*` 是同源代理(转发 JWT / query / body),两边等价。`GET /api/publish/adapters/status`
例外 —— 它是 apps/api 的**本地端点**(不转发 ai-service,只回前端注册表矩阵)。

1. **Web 界面**:登录后进「发布」模块 → `/publish/accounts`(发布账号页)填字段、测连接。
2. **直连 ai-service REST**(下面的 curl 示例均属此通道):
   - 建账号:`POST /api/publish/accounts`,body `{ "platform", "display_name", "credentials": {字段…}, "extra": {} }`
     (凭证 AES-256-GCM 加密后存 `publish_accounts` 表;`user_id` 从 JWT 取,客户端传了也会被忽略)。
   - 更新凭证:`PUT /api/publish/accounts/{account_id}`;禁用(软删):`DELETE /api/publish/accounts/{account_id}`;
     列表:`GET /api/publish/accounts/{user_id}`(路径参数仅保留契约,实际按 JWT 身份过滤)。
   - 平台元数据:`GET /api/publish/platforms`。
   - 加密密钥生成:`GET /api/publish/credentials-key/generate`。
3. **扫码 / 粘贴 Cookie 导入**(适合 cookie 类平台,自动建账号,见 §2)。

curl 通用前置:

```bash
TOKEN='<你的 JWT>'          # 与登录 web 同一枚 token(JWT_SECRET 三端一致)
BASE=http://localhost:8803  # ai-service 直连;走 apps/api 代理则 http://localhost:8802
```

---

## 2. 扫码导入入口契约(`apps/ai-service/app/routers/scan_login.py`)

前缀 `/publish/scan-login`(挂载后即 `/api/publish/scan-login/` 下的子路径)。
**可扫码的平台集合以 `GET /api/publish/scan-login/platforms` 现读为准**,文档不手抄(配置住在 `PLATFORM_SCAN_CONFIG`,
含 `login_url` 与判定登录成功的 `success_cookies`)。

| 端点 | 方法 | 用途 |
| --- | --- | --- |
| `/api/publish/scan-login/platforms` | GET | 列出支持扫码登录的平台(平台 id / 名称 / 登录页 / 成功判据 cookie) |
| `/api/publish/scan-login/start` | POST | 启动扫码任务,body `{"platform":"<id>"}`,返回 `task_id` |
| `/api/publish/scan-login/{task_id}/qr` | GET | 取二维码截图(PNG;响应头 `X-Task-Status` 带当前状态) |
| `/api/publish/scan-login/{task_id}/status` | GET | 轮询任务状态(`pending / waiting_scan / scanned / success / failed / timeout / cancelled / expired`) |
| `/api/publish/scan-login/{task_id}/cancel` | POST | 取消任务 |
| `/api/publish/scan-login/import-cookies` | POST | 手动粘贴 Cookie 文本入库(见下) |
| `/api/publish/scan-login/external-start` / `detect-from-cdp` / `detect-from-profile` | POST | 外部浏览器 / CDP 会话 / 本机 profile 检测登录态 |

`import-cookies` 的 body:`{"platform":"<id>","cookies_raw":"<粘贴的 Cookie 文本>"}`;
格式接受 JSON `{"k":"v"}`、`k=v; k2=v2`、cookies.txt。解析后校验平台关键字段(一个都没命中会 400 并告诉你
应包含哪些 cookie 名),剔除统计类 cookie,加密入库到与扫码登录同一张 `publish_accounts` 表,
返回 `{account_id, cookies_count, matched}`。

```bash
curl -sS -X POST "$BASE/api/publish/scan-login/import-cookies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"platform":"<你的平台id>","cookies_raw":"<从浏览器 DevTools 复制的 Cookie 文本>"}'
```

---

## 3. 验证结论怎么读(通用)

`POST /api/publish/accounts/{account_id}/verify` 统一返回信封 `{code:0, message, data}`;
`data.ok=true` 即适配器 `verify_credentials` 通过,`data.message` 为平台原话。响应样例:

```json
{ "code": 0, "message": "success",
  "data": { "ok": true, "message": "connected", "platform": "juejin", "accountId": 12 } }
```

verify 结果同时写回 `publish_accounts.last_verified_at / last_verify_msg`,列表接口能看到。
`GET /api/publish/accounts/{account_id}/risk` 返回风险评分与冷却信息(`score/level/factors/cooldownUntil/cooldownRemaining`)。

---

## 4. 逐平台配置

### 4.1 `wordpress` — WordPress

<a id="wordpress"></a>

- **需要哪些字段**:`site_url`、`username`、`application_password`(适配器真相源;前端注册表把第三项写成
  `app_password`,以适配器为准,键名不一致处已在 §0 点名)。支持格式 md/html/docx/pdf。
- **去哪儿拿**:站点需启用 REST API;后台「用户 → 应用密码(Application Passwords)」生成
  (WordPress 5.6+ 内建,或装官方 Application Passwords 插件)。
- **怎么入库**:

  ```bash
  curl -sS -X POST "$BASE/api/publish/accounts" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"platform":"wordpress","display_name":"<你的站点名>","credentials":{"site_url":"https://<你的站点>","username":"<你的用户名>","application_password":"<应用密码>"}}'
  ```

- **怎么自检**:`curl -sS -X POST "$BASE/api/publish/accounts/<accountId>/verify" -H "Authorization: Bearer $TOKEN"`
  ⇒ 期望 `data.ok=true`;失败常见原因是站点禁用了 REST 或应用密码失效(HTTP 401/403 由平台回)。

### 4.2 `medium` — Medium

<a id="medium"></a>

- **需要哪些字段**:`integration_token`(前端注册表另有 `author_id`,适配器不要求)。支持 md/html。
- **去哪儿拿**:Medium → Settings → Security → 开发密钥/Integration Token(需 Medium 会员的开放接口资格,详见 Medium 官方文档)。
- **怎么入库**:`POST /api/publish/accounts`,credentials `{"integration_token":"<令牌>"}`。
- **怎么自检**:verify 期望 `ok=true`;401 ⇒ token 被吊销或复制截断。

### 4.3 `youtube` — YouTube

<a id="youtube"></a>

- **需要哪些字段**:`access_token`、`refresh_token`、`client_id`、`client_secret`。仅 video。
- **去哪儿拿**:Google Cloud Console 建 OAuth 2.0 客户端(已授权重定向 URI 与本项目回调对齐),经 OAuth 授权流
  拿 refresh/access token 对,并启用 YouTube Data API v3。**授权流怎么在本项目内走完 —— 待核**(前端注册表把它标为
  `needs_oauth`,非 cookie/playwright 可解)。
- **怎么入库**:`POST /api/publish/accounts` 一次灌入四字段;token 轮换后用 `PUT /api/publish/accounts/<id>` 更新。
- **怎么自检**:verify 期望 `ok=true`;`invalid_grant` ⇒ refresh_token 失效或被撤销,须重新授权。

### 4.4 `bilibili` — B站

<a id="bilibili"></a>

- **需要哪些字段**:`sessdata`、`bili_jct`、`dedeuserid`(注意:setupHint 文案写的 `buvid3` 不是适配器必填项)。仅 video。
- **去哪儿拿**:浏览器登录 bilibili.com 后从 DevTools → Application → Cookies 复制这三枚;
  或用 §2 扫码导入(扫码平台清单里叫 `bilibili`,成功判据 cookie 为 `SESSDATA`、`DedeUserID`)。
- **怎么入库**:import-cookies 直接粘贴;或 `POST /api/publish/accounts` credentials
  `{"sessdata":"…","bili_jct":"…","dedeuserid":"…"}`。
- **怎么自检**:verify 期望 `ok=true`;`-101`/需扫码 ⇒ cookie 过期,重新导入。

### 4.5 `wechat` — 微信公众号(实测重点)

<a id="wechat"></a>

- **需要哪些字段**:`app_id`、`app_secret`。支持 md/html。
- **去哪儿拿**:微信公众平台(订阅号/服务号的「帐号设置 → 接口权限/开发者配置」)取 AppID 与 AppSecret。
- **还差的平台侧动作(今天实测卡在这)**:公众平台强制 **IP 白名单** —— 服务器出口 IP 不白,
  取 access_token 直接报 `errcode=40164 invalid ip <本机公网IP>`。查法:**以 verify 返回里报出的那个 IP 为准**
  (它就是这次请求的实际出口,不要凭记忆填);改法:公众平台后台 → 设置与权限 → 基本配置(开发者配置)→
  「IP 白名单」加入该 IP。IP 变了(换出口/重启网络设备)就要再改一次 —— 文档刻意不写死任何 IP 值。
- **怎么入库**:`POST /api/publish/accounts` credentials `{"app_id":"…","app_secret":"…"}`(走 Web 表单同理)。
- **怎么自检**:verify。**预期返回样例**:白名单没配好时
  `data.ok=false`、`data.message` 内含 `errcode=40164 invalid ip …`;配好后应 `data.ok=true`。
  白名单只对"出口 IP"负责:如果你的部署出口 IP 不稳定,考虑固定出口代理后再验。

### 4.6 `toutiao` — 头条号(实测重点)

<a id="toutiao"></a>

- **需要哪些字段**:`app_id`、`app_secret`(前端注册表写 `cookie` 是旧口径,适配器走开放平台)。支持 md/html。
- **去哪儿拿**:字节/头条开放平台注册应用取 AppID/AppSecret。**今天实测结论:本环境缺 `app_id`/`app_secret`,
  属开放平台凭据未申请,不是代码问题** —— 补上凭据即可从"只差凭据"转为可发(待核)。
- **怎么入库 / 自检**:同 §4.5 的骨架,换 `platform:"toutiao"` 与两字段;verify 缺字段时消息会点名缺哪个。

### 4.7 `douyin` — 抖音

<a id="douyin"></a>

- **需要哪些字段**:`access_token`、`open_id`、`client_key`、`client_secret`(OAuth 形态,非裸 cookie)。仅 video。
- **去哪儿拿**:抖音开放平台建应用走授权。扫码通道在 §2 清单内(成功判据 cookie `sessionid`/`uid_tt`/`sid_tt`),
  但**扫码得到的 cookie 与该适配器要的 OAuth 四字段不是一回事** —— 入库走哪条(待核)。
- **怎么自检**:verify;`access_token` 过期需刷新后 `PUT` 更新。

### 4.8 `kuaishou` — 快手

<a id="kuaishou"></a>

- **需要哪些字段**:`access_token`、`app_id`、`app_secret`(前端注册表写 `cookie`,以适配器为准)。仅 video。
- **去哪儿拿**:快手开放平台建应用。扫码导入同样在 §2 清单内(判据 cookie `userId`/`kuaishou.server.web_st`),
  与 OAuth 字段的对应关系 **待核**。
- **怎么自检**:verify。

### 4.9 `weibo` — 微博(实测重点)

<a id="weibo"></a>

- **需要哪些字段**:`access_token`、`uid`(前端注册表写 `cookie`,以适配器为准)。支持 md/html/image/video。
- **去哪儿拿**:微博开放平台申请应用并走 OAuth 拿 `access_token`,`uid` 为授权账号的数字 ID。
  **今天实测结论:本环境缺 `access_token`,属开放平台凭据缺失,不是代码问题。**
- **怎么入库**:`POST /api/publish/accounts` credentials `{"access_token":"…","uid":"…"}`;
  扫码通道(§2,判据 cookie `SUB`/`MLOGIN`)导入的是 cookie,**不满足该适配器的字段要求**,别混用。
- **怎么自检**:verify;401/`expired_token` ⇒ 重新授权。

### 4.10 `zhihu` — 知乎

<a id="zhihu"></a>

- **需要哪些字段**:`z_c0`、`_xsrf`(setupHint 的 `d_c0` 是前端注册表口径,适配器实际要 `_xsrf`)。支持 md/html。
  `needs_browser = true` ⇒ 宿主须装好 Playwright 及 Chromium 内核(见 §5 前置)。
- **去哪儿拿**:登录 zhihu.com 后 DevTools 复制 `z_c0`,并在任一写请求的表单/头里取 `_xsrf`;
  或用 §2 扫码导入(知乎判据 cookie 为 `z_c0`)。
- **怎么自检**:verify 期望 `ok=true`;知乎返回 403/需验证 ⇒ 触发平台风控,先查 §6 冷却台账。

### 4.11 `csdn` — CSDN(实测重点)

<a id="csdn"></a>

- **需要哪些字段**:`UserName`、`UserToken`、`UserSecret`(两侧注册一致)。支持 md/html。`needs_browser = true`。
- **去哪儿拿**:浏览器登录 CSDN 后 DevTools → Application → Local Storage/Cookies 取这三枚;
  或用 §2 扫码导入(判据与流程见 scan-login platforms)。
- **怎么自检 + 一条必须说清实测结论**:verify 期望 `ok=true`。**但"验证通过 ≠ 能发布"在今天实测成立**:
  扫码导入那包 cookie 够读不够写 —— 能过 `getBaseInfo`(所以 verify connected),
  而真正点发布时平台端弹登录墙(实测网络面板只见 `createQrCode`/`checkScan`,**零条**发文章请求到达)。
  处置:在浏览器里对该账号**人工重新扫码登录一次**,把写权限的登录态补全后再发;
  若仍墙,检查 §6 冷却与设备图谱。

### 4.12 `juejin` — 掘金(实测重点,今天唯一全流程可发的一家)

<a id="juejin"></a>

- **需要哪些字段**:`sessionid`、`signatureId`(setupHint 的 `sessionid_ss` 为前端注册表旧口径,已由
  `apps/api/tests/publish-credential-field-parity.test.ts` 订正)。**但 `signatureId` 现读是"声明必填、
  实际可空"的一格**:扫码导入自动入库的那包 cookie 里**没有它**(id=13 键清单实测含 `sessionid`
  /`sessionid_ss`/`sid_guard`/`sid_tt`/`uid_tt`/`csrf_session_id`/`passport_csrf_token` 等 21 键,无
  `signatureId`),而 `verify` 只判 `sessionid`(`juejin.py:341-343`)、今天全流程发布也通 —— 适配器在
  `juejin.py:266` 以空串注入该 cookie。**这一型不属 P4 那条轴**:`signatureId` 有读取点,所以 P4
  不报它 —— 它缺的是**值**(导入包里没这个键)。两型症状与处置都不同:P4 的"声明却零读取点"要**摘掉
  声明**,这一型要**在导入侧补取或把键从声明里去掉**,归适配器持有人另票。
  支持 md/html。`needs_browser = true`。
- **去哪儿拿/怎么入库**:登录 juejin.cn 后复制 cookie,或 §2 扫码导入(平台 id `juejin`,在 scan-login 清单内)。
- **怎么自检 —— 正确的成功判据(实测)**:verify 应 `connected`;提交发布后**文章进入"审核中"状态,
  审核期间站内搜索搜不到它**。所以别拿"首页搜到了"当成功判据 —— 正确的判据是任务接口返回
  `success=true` 且拿到 `published_url`/`platform_content_id`(`GET /api/publish/tasks/{task_id}` 的
  `data.results[]`),再回掘金「我的文章」列表看草稿/审核状态。审核完成后才公开可见。
- **草稿箱清理(校准探针会留草稿,2026-09-27 实测)**:进编辑器即触发自动保存 ⇒ **探针每跑一次就
  多一篇草稿**(本轮 5 篇,标题带「勿发布」)。入口是
  `https://juejin.cn/creator/content/article/drafts` —— 旧的 `/writing/dashboard` 已改版、登录态下
  **跳回首页**,别照它找。行内操作位是 hover 才出现的无文案无 aria 的 `i.more-icon`,点开才出
  「编辑 / 删除」两项(`.byte-dropdown-menu`);**点标题本身会进编辑器并再存一篇**。删除有二次确认
  弹窗(文案「删除内容后不可…」),实际接口 = `POST api.juejin.cn/content_api/v1/article_draft/delete`
  (本轮由页面自身请求观测所得,非推测)。用自动化清时按**整行文案**(标题 + 时刻)定位,不按行号 ——
  删一行会让下一页的行回流,序号是会话内假象。

### 4.13 `xiaohongshu` — 小红书

<a id="xiaohongshu"></a>

- **需要哪些字段**:`web_session`(两侧一致)。支持 md/html/image/video。`needs_browser = true`。
- **去哪儿拿/怎么入库**:§2 扫码导入(判据 cookie 为 `web_session`,2026-09-15 起已剔除游客态 `webId`/`a1` 防误报)。
- **怎么自检**:verify;导入的 cookie 够不够写(同 CSDN 那一型)**待核** —— 首次配置后先小流量试发一篇。

### 4.14 `shipinhao` — 微信视频号

<a id="shipinhao"></a>

- **需要哪些字段**:`wechat_channels`(前端注册表写 `cookie`,以适配器为准)。仅 video。`needs_browser = true`。
- **去哪儿拿/怎么入库**:登录 channels.weixin.qq.com 创作者后台后复制该 cookie,或走 §2 扫码通道
  (平台 id `shipinhao` 在清单内)。字段语义(整包 cookie 还是单键)**待核**。
- **怎么自检**:verify。

---

## 5. 运行前置

- Playwright 类适配器(`needs_browser = true`:zhihu/csdn/juejin/xiaohongshu/shipinhao 及 §0.1 全部)要求
  ai-service 宿主装 Playwright 及浏览器内核;缺依赖时该适配器 import 失败会被注册循环静默跳过
  (`base_adapter.list_all_adapter_classes` 的 try/except),表现为"平台列表里没有它"。
- 端口:web `8801`、apps/api `8802`、ai-service `8803`(`docs/port-management.md`)。
- 凭证加密:`apps/ai-service/app/services/publish/credentials_crypto.py`(AES-256-GCM);
  换密钥/新机首配可 `GET /api/publish/credentials-key/generate`。
- **画像根只有一个，且与启动目录无关**：反风控画像目录由
  `anti_risk/account_profile.resolve_profile_root()` 决定 —— 默认与相对值一律锚定**仓库根**
  下的 `.ihui-agent/tmp/anti-profiles`，环境变量 `ANTI_RISK_PROFILE_DIR` 给绝对路径时原样采用。
  历史上它是"相对值按进程 cwd 解析"，而 `pnpm --filter @ihui/ai-service dev` 的 cwd 是
  `apps/ai-service` ⇒ 同一账号在两个物理根各有一份画像，换一次启动姿势等于**换一张脸**
  （与 §7 的身份键是同一族的第二维）。换机/改根后先跑搬迁器（默认只报告，不动盘）：
  `python apps/ai-service/scripts/relocate_profile_root.py`，确认清单后再 `--apply`。
  它逐键判定：两边都有真实登录态 ⇒ **拒绝并交人工**（不猜哪份作数）；单边有 ⇒ 另一边按
  `*.shell-<stamp>` / `*.probe-copy-<stamp>` **改名归档**（不删除，可回退）。
- **另外 5 个反风控状态文件同属这一维**：设备图谱 `device_graph.json`、审计
  `anti-audit-log.jsonl`、冷却 `anti-cooldowns.json`、风险事件 `anti-risk-events.jsonl`、Cookie
  健康度 `anti-cookie-health.json` 的路径也一律锚定仓库根，唯一出口 =
  `anti_risk/state_paths.resolve_state_path()`（画像根委托它）。**行为变更**：环境变量
  `ANTI_RISK_DEVICE_GRAPH_FILE` / `ANTI_RISK_AUDIT_FILE` / `ANTI_RISK_COOLDOWNS_FILE` /
  `ANTI_RISK_EVENTS_FILE` / `ANTI_RISK_COOKIE_HEALTH_FILE` 给**相对值**时不再按服务启动目录解析 ——
  要把状态文件放到仓库外必须写**绝对路径**。同一搬迁器另有并列的单文件趟（待搬清单从
  `anti_risk/*.py` 现读，不硬写名字表）；两侧都非空时它**拒绝**而不是选一份 —— 例如
  `device_graph.json` 曾出现"历史 9 条 vs 收口后新长 1 条"，正确处置是按 `account_id` **求并集**
  （同 id 取 `updated_at` 较新那条），两份原件都改名归档、被弃条目单独留档，**不得**用任一方的
  整份覆盖另一方：这张表是跨账号关联检测的输入，少一条不报错，只会让下一次的"撞脸"看不见。

---

## 6. 验证与故障定位:verify 报什么该怀疑哪一层

| 症状(verify/发布消息里的字样) | 该怀疑的层 | 处置 |
| --- | --- | --- |
| 消息点名缺某字段 / 字段为空 | **凭据层** | 按 §4 补齐,`PUT /api/publish/accounts/{id}` 更新后重验 |
| `401` / `invalid token` / `expired` | 凭据层(token 已轮换) | 重新授权导入;**注意 §7 —— 换值不换脸** |
| `errcode=40164 invalid ip …`(微信系) | **平台侧白名单** | 以返回里报出的 IP 为准去后台加白(§4.5) |
| verify `ok=true` 但发布时弹登录墙 / 只见 `createQrCode`/`checkScan` 无写请求 | **登录墙(读态 cookie 不够写)** | 人工重新扫码登录补写权限(§4.11 CSDN 实测型) |
| 发布"成功"但站内搜不到 | 平台审核流(不一定是故障) | 掘金按 §4.12 判据看任务结果与"审核中"状态 |
| 操作频繁 / 自动冷却、risk 端点 `cooldownUntil` 非空 | **冷却层(反风控)** | 查冷却台账(见下);等冷却到期或按风控原因处置,勿反复重试加剧 |

两个台账文件(默认写**相对路径** `.ihui-agent/tmp/…`,解析在**服务进程的 cwd** 下 —— 本机 ai-service 从
`apps/ai-service/` 拉起,所以实际落在):

- 冷却台账:`apps/ai-service/.ihui-agent/tmp/anti-cooldowns.json`(`anti_risk/cooldown_manager.py`)
- 设备图谱:`apps/ai-service/.ihui-agent/tmp/device_graph.json`(`anti_risk/device_graph_guard.py`)

若服务换了启动目录,这两个文件会跟着 cwd 走 —— 找不到时先问"服务进程当时站在哪个目录",别在仓库根瞎搜。
(两者也各支持环境变量指到别处,键名以模块源码现读为准,**待核**。)

---

## 7. 反风控身份键规则(必读)

- **规矩:身份键必须由与凭证内容无关的稳定锚点派生。** 唯一出口
  `apps/ai-service/app/services/publish/anti_risk/account_identity.py` 的 `resolve_account_id(platform, credentials, db_account_id)`,
  优先级:① `publish_accounts` 行 id(调度器/verify 入口显式传入,适配器属性 `db_account_id`)⇒ 画像目录/图谱键
  `<platform>_db<行id>`;② 凭证里**不轮换**的身份字段(`STABLE_IDENTITY_FIELDS`:account_id/UserName/uid_tt/wxuin/webId/app_id/open_id/user_id);
  ③ 兜底"首个凭证值哈希"并**大声告警** —— 走到兜底即接线缺失。
- **绝不能**用会轮换的 cookie/token 值算键:历史实现是 `md5(第一个非空凭证值)`,凭证一刷新就换一张脸、
  新开一个浏览器画像目录,旧脸仍留在 device_graph 与新生共用同一出口 IP ⇒ 联动判定 100/100 ⇒ **自动冷却 1 小时**
  —— 这就是当年"刷新没几次就风控我"的机制。
- 改键必须与**旧键迁移**同票:出口 `apps/ai-service/scripts/migrate_publish_identity.py`(默认 dry-run 出报告,
  `--apply` 才动盘)。它是**改名迁移**(画像目录 `os.replace`、device_graph 绑定与冷却台账跟着换主),
  不是重建 —— 保留已扫码登录的画像;只处理能唯一归属的旧键,归属不明一律点名交人工;动盘前先把两个 JSON
  各复制一份 `.pre-identity-migration-<ts>` 备份。
- **"有唯一出口"不等于"每个落点都接上了"**：任何 `get_adapter(...)` 之后要调
  `publish()` / `verify_credentials()` 的落点，**必须**先 `adapter.db_account_id = <行 id>`。
  今天实测到 6 个生产落点里只有 2 处注入，其余在**批量发布 / 批量验证**（一次把全部 active
  账号各换一张脸，比单账号更危险）与两条登录态导入路径的校验里。判据是源码面的：
  `apps/ai-service/tests/test_adapter_identity_db_id_injected.py`（取适配器后、消费身份键前
  必须出现 `db_account_id =`；覆盖面按**出现次数**自证，不是按文件数）。
- **导入路径先验后写**：库里已有凭据时，只有当轮 `verify` 真通过才允许覆盖；
  `False`(已证伪)与 `None`(判不出：无适配器 / Playwright 未装 / 校验自身抛异常)都**不授权**
  —— 工具坏了不构成"可以毁掉用户已有登录态"的许可。出口
  `should_overwrite_existing_credentials` + `verify_login_candidate(platform, creds, 行 id)`。
- **覆盖必须留余料**：写新密文前把旧密文压进 `publish_accounts.extra.credentialsHistory`
  （有界 3 条、新的在前；`extra` 里别人的键逐字保住；历史准备失败只喊 error 并退回原写入）。
  恢复侧读 `extra` 里那枚 `enc` 用同一把 `credentials_crypto.decrypt` 解即可。
- 画像根只有一个且与启动目录无关：见 §5 最后一条（含搬迁器）。

---

## 8. 已知未收口项(如实登记,不是"已全部可用")

1. **全账号只读复验现读（2026-09-27，16 个 active 账号，逐家 `verify_credentials`，不写库不改状态）：
   绿的只有掘金 1 家**。其余 15 家的红分四类，处置动作各不相同，**别把四类混成"发布功能坏了"**：
   - **平台侧登录墙（要人工手机扫码）**：CSDN、小红书 —— 都是 `cookie expired (redirected to login)`，
     即 cookie 够读不够写那一型（§4.11）。
   - **结构性缺凭据（要去平台申请，不是代码问题）**：抖音/快手/微博/YouTube/cnblogs 缺
     `access_token` 等开放平台键，medium 缺 `integration_token`，wordpress 缺
     `site_url/username/application_password`，视频号缺 `wechat_channels`，简书缺 cookie。
   - **站点白名单（要改平台后台）**：微信公众号 `errcode=40164 invalid ip <出口 IP>`。
   - **判据本身不可信（不得当"账号掉了"登记）**：百家号与 QQ 开放平台两次跑出**不同结论**
     （一次 `Page.goto` 30s 超时、一次"没看见退出按钮"），而两个域名单纯 HTTP 探测 0.5–1.7s 就 200 ——
     说明红来自**页面加载形态**（默认 `wait_until=load` 会等全站第三方子资源），不是凭据。
     这类"同一账号两次验出不同答案"的，一律按未判定处理，不得写进账面当结论。
   **另**：`publish_tasks` 里 2026-09-14/15 那 4 条知乎记录是"verify 通过"的旧口径，
   它们把内容 id 存成了 `"edit"`（见本条第 10 项），所以那 4 条**不能**当"知乎可发"的证据。
2. **微博**缺 `access_token`、**头条**缺 `app_id`/`app_secret` ⇒ 开放平台凭据缺失,需人去申请,不是代码问题(§4.6、§4.9)。
3. **微信公众号**verify 报 `errcode=40164 invalid ip <本机公网IP>` ⇒ 等平台侧 IP 白名单动作(§4.5)。
4. **掘金发布后处于"审核中"**,站内搜索审核期间搜不到 —— 成功判据按 §4.12,别误判成发布失败。
   同一节的选择器/形态已按当次一手 DOM 重校(平铺分类列表、`.publish-popup`、标签走 body 级 portal),
   「提交响应 JSON 形状」与「`/published` 之后是否真跳」三项**未实测**(实测需真点一次提交,
   本仓不在用户账号上做未取证的动作),夹具里按未实测如实标注。
5. CSDN 扫码导入的 cookie **够读不够写**,首次配置必须人工在浏览器重新扫码登录一次(§4.11)。
6. §0.1 的 24 个适配器均未实测;`setupHint` 未覆盖它们的字段语义(尤其 `access_token` 是平台 token 还是 cookie)多处标了**待核**。
7. **注册表与适配器的凭据字段名对账:2026-09-27 已按"权威侧 = 适配器"改齐 api 侧** ——
   10 处漂移(wordpress `app_password`→`application_password`、medium 多写 `author_id` 已删、bilibili
   `buvid3`→`dedeuserid`、zhihu `d_c0`→`_xsrf`、juejin `sessionid_ss`→`signatureId`,以及
   toutiao/douyin/kuaishou/weibo/shipinhao 五家泛键 `cookie` 换成各适配器实读键)全部订正,
   两侧重叠的 14 平台现**逐键一致**(§0 差异表是修复前快照)。常驻尺子 =
   `apps/api/tests/publish-credential-field-parity.test.ts`:适配器侧按 git HEAD 面的
   `requires_credentials` 为权威清单、api 侧按工作树面,P1 集合差 / P2 覆盖差(§0.1 的 24 个未登记
   平台属产品现状,**如实报数**不判红;豁免必须带 ≥20 字理由并受自洽三防线约束)/ P3 空扫判死。
   **单一源仍没建**:注册表依旧是手写数组,这把尺子是"漂移即红"不是"自动派生",彻底收敛属另票。
   **本尺子的第二条判据 P4 = 另一条轴(默认只报数,`IHUI_CRED_READ_STRICT=1` 才判红)**:适配器
   "**声明清单 vs 实际读取键**"。现读实证两型共 **6 处**:① **读了却未声明** 4 处
   (`medium.publication_id`、`kuaishou.open_id`、`segmentfault.cookie`、`xigua.sid_guard`)——
   表单不会问,用户永远填不出;② **声明却零读取点** 2 处(`douyin.client_secret`、
   `kuaishou.app_secret`)—— 这两家的 OAuth token 刷新代码里还没实现,声明是在替一个不存在的能力
   要凭据。**判据必须认全三条读取通道**,否则量出来的全是噪声:字面量 `credentials.get("k")` ∪
   `playwright_base.py:150` 的 `credentials.get(self.primary_cookie)`(键名写在子类
   `primary_cookie = "X"` 类属性里)∪ 同文件 `_cookies()` 走的
   `cookie_specs = [CookieSpec("X", …)]`(键名在首个位置参数里)。本判据落地时这两条各漏过一次,
   报数因此走的是 **43 → 25 → 2**:前两版分别把 18 个、23 个正常工作的适配器冤枉成"声明了却不使用"。
   **假阳比漏报贵** —— 它指使人去"修"没坏的东西,并把整条轴的可信度一起赔进去。
   处置仍归适配器侧、另计一票,不得反过来改适配器迁就注册表。
8. YouTube/抖音/快手的 **OAuth 授权流如何在站内走完**(回调、token 落库)未在本次核查证据内 —— 待核。
9. **发布后的数据回收只支持知乎一家**：`app/services/publish/metrics_collector.py:115` 的分支只有
   `platform == "zhihu"`，其它平台走 :122 记一句 `unsupported platform` 后返回空指标 ——
   所以 `publish_metrics` 表实测**零行**，「刷新指标 / 数据看板」对掘金等平台是**空转，不是坏了**。
   注册表里也没有任何字段声明这一点（现读 `grep -c supportsMetrics` = 0），因此前端无从区分
   "没数据" 与 "采不了"。补采集器（逐平台按创作者后台接口）属另票，不在本票范围。
10. **知乎的 `platform_content_id` 曾一律被存成字面量 `"edit"`（2026-09-27 已修，历史 4 行未回填）**：
    DOM 流发布后浏览器停在 `zhuanlan.zhihu.com/p/<id>/edit`，旧实现按"路径最后一段"取 id ⇒ 取到 `edit`，
    并把**要登录才打得开的编辑页**当公开链接回传（`publish_tasks` id 20–23 四条全是这个形态，
    而 `success=true` 一切照常）。这正好是第 9 条那句"只支持知乎"的**第二半**：就算采集器实现了，
    拿 `"edit"` 去查也永远查不到。现由唯一出口 `app/services/publish/published_url.py` 按
    "段名后面那一段是不是数字"取 id 并归一化公开 URL，CSDN 同形风险（`?spm=` 尾巴）一并收口。
    **历史那 4 行刻意没回填**：改生产库里的历史发布记录属数据迁移，需要单独授权与单独判据
    （回填必须能证明"改的是取错的 id 而不是别人真填的值"），不在本票范围。
11. **反风控层此前没有"归属"这一维，会把自己的正常多平台使用判成账号关联（2026-09-27 已修）**：
    `detect_linkage` 原来只拿 `account_id` 两两比 UA/指纹，而"一个人运营十几个平台账号、同一台机器、
    同一个 UA"是**本产品的前提**。实测后果不是"报个警"，而是**每次发布都被自己自动冷却 1 小时**
    （第二篇推广文就是这样被拦成 `failed` 的，日志写"跨会话设备关联 风险=60"）。用户那句
    "刷新 token 没几次就风控我"里，有相当一部分是我们自己这一层造的。
    现在判据接受一个**归属解析器**：同一 `user_id` 名下的账号不再计入关联，但**跳过数必须写进报告**
    （`same_owner_skipped`，静默跳过与"没检查"在账面上同形）；`不同主人` 与 `查不到主人` 两类
    **一律照旧计入**（保守方向不可反：把"不知道是谁"当"是同一个人"等于给关联检测开后门）；
    不传解析器时行为与改动前逐字一致。配套：图里 3 条**旧键形态**绑定（`*_legacy-*` 兜底档、
    游客 cookie `webId` 档）由 `scripts/archive_legacy_device_bindings.py` 归档出图（默认 dry-run、
    零损失断言、原件不删）—— 它们反解不出行 id，留着就会永久替真实账号制造命中。
    修完现读：5 个代表账号 `linked=False 风险=0 同主人跳过=6 外主人=0`（此前掘金是 风险=60）。
    那次假阳性留下的 1h 冷却已用产品自己的 `exit_cooldown('13','juejin')` 撤销（撤销前后 JSON 内容
    与理由都记在交付里），因为它的**前提**已被证伪。
