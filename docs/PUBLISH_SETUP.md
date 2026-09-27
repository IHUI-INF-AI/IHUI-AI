<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
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

- **需要哪些字段**:`integration_token`(前端注册表另有 `author_id`,适配器不要求)。支持 md/html。
- **去哪儿拿**:Medium → Settings → Security → 开发密钥/Integration Token(需 Medium 会员的开放接口资格,详见 Medium 官方文档)。
- **怎么入库**:`POST /api/publish/accounts`,credentials `{"integration_token":"<令牌>"}`。
- **怎么自检**:verify 期望 `ok=true`;401 ⇒ token 被吊销或复制截断。

### 4.3 `youtube` — YouTube

- **需要哪些字段**:`access_token`、`refresh_token`、`client_id`、`client_secret`。仅 video。
- **去哪儿拿**:Google Cloud Console 建 OAuth 2.0 客户端(已授权重定向 URI 与本项目回调对齐),经 OAuth 授权流
  拿 refresh/access token 对,并启用 YouTube Data API v3。**授权流怎么在本项目内走完 —— 待核**(前端注册表把它标为
  `needs_oauth`,非 cookie/playwright 可解)。
- **怎么入库**:`POST /api/publish/accounts` 一次灌入四字段;token 轮换后用 `PUT /api/publish/accounts/<id>` 更新。
- **怎么自检**:verify 期望 `ok=true`;`invalid_grant` ⇒ refresh_token 失效或被撤销,须重新授权。

### 4.4 `bilibili` — B站

- **需要哪些字段**:`sessdata`、`bili_jct`、`dedeuserid`(注意:setupHint 文案写的 `buvid3` 不是适配器必填项)。仅 video。
- **去哪儿拿**:浏览器登录 bilibili.com 后从 DevTools → Application → Cookies 复制这三枚;
  或用 §2 扫码导入(扫码平台清单里叫 `bilibili`,成功判据 cookie 为 `SESSDATA`、`DedeUserID`)。
- **怎么入库**:import-cookies 直接粘贴;或 `POST /api/publish/accounts` credentials
  `{"sessdata":"…","bili_jct":"…","dedeuserid":"…"}`。
- **怎么自检**:verify 期望 `ok=true`;`-101`/需扫码 ⇒ cookie 过期,重新导入。

### 4.5 `wechat` — 微信公众号(实测重点)

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

- **需要哪些字段**:`app_id`、`app_secret`(前端注册表写 `cookie` 是旧口径,适配器走开放平台)。支持 md/html。
- **去哪儿拿**:字节/头条开放平台注册应用取 AppID/AppSecret。**今天实测结论:本环境缺 `app_id`/`app_secret`,
  属开放平台凭据未申请,不是代码问题** —— 补上凭据即可从"只差凭据"转为可发(待核)。
- **怎么入库 / 自检**:同 §4.5 的骨架,换 `platform:"toutiao"` 与两字段;verify 缺字段时消息会点名缺哪个。

### 4.7 `douyin` — 抖音

- **需要哪些字段**:`access_token`、`open_id`、`client_key`、`client_secret`(OAuth 形态,非裸 cookie)。仅 video。
- **去哪儿拿**:抖音开放平台建应用走授权。扫码通道在 §2 清单内(成功判据 cookie `sessionid`/`uid_tt`/`sid_tt`),
  但**扫码得到的 cookie 与该适配器要的 OAuth 四字段不是一回事** —— 入库走哪条(待核)。
- **怎么自检**:verify;`access_token` 过期需刷新后 `PUT` 更新。

### 4.8 `kuaishou` — 快手

- **需要哪些字段**:`access_token`、`app_id`、`app_secret`(前端注册表写 `cookie`,以适配器为准)。仅 video。
- **去哪儿拿**:快手开放平台建应用。扫码导入同样在 §2 清单内(判据 cookie `userId`/`kuaishou.server.web_st`),
  与 OAuth 字段的对应关系 **待核**。
- **怎么自检**:verify。

### 4.9 `weibo` — 微博(实测重点)

- **需要哪些字段**:`access_token`、`uid`(前端注册表写 `cookie`,以适配器为准)。支持 md/html/image/video。
- **去哪儿拿**:微博开放平台申请应用并走 OAuth 拿 `access_token`,`uid` 为授权账号的数字 ID。
  **今天实测结论:本环境缺 `access_token`,属开放平台凭据缺失,不是代码问题。**
- **怎么入库**:`POST /api/publish/accounts` credentials `{"access_token":"…","uid":"…"}`;
  扫码通道(§2,判据 cookie `SUB`/`MLOGIN`)导入的是 cookie,**不满足该适配器的字段要求**,别混用。
- **怎么自检**:verify;401/`expired_token` ⇒ 重新授权。

### 4.10 `zhihu` — 知乎

- **需要哪些字段**:`z_c0`、`_xsrf`(setupHint 的 `d_c0` 是前端注册表口径,适配器实际要 `_xsrf`)。支持 md/html。
  `needs_browser = true` ⇒ 宿主须装好 Playwright 及 Chromium 内核(见 §5 前置)。
- **去哪儿拿**:登录 zhihu.com 后 DevTools 复制 `z_c0`,并在任一写请求的表单/头里取 `_xsrf`;
  或用 §2 扫码导入(知乎判据 cookie 为 `z_c0`)。
- **怎么自检**:verify 期望 `ok=true`;知乎返回 403/需验证 ⇒ 触发平台风控,先查 §6 冷却台账。

### 4.11 `csdn` — CSDN(实测重点)

- **需要哪些字段**:`UserName`、`UserToken`、`UserSecret`(两侧注册一致)。支持 md/html。`needs_browser = true`。
- **去哪儿拿**:浏览器登录 CSDN 后 DevTools → Application → Local Storage/Cookies 取这三枚;
  或用 §2 扫码导入(判据与流程见 scan-login platforms)。
- **怎么自检 + 一条必须说清实测结论**:verify 期望 `ok=true`。**但"验证通过 ≠ 能发布"在今天实测成立**:
  扫码导入那包 cookie 够读不够写 —— 能过 `getBaseInfo`(所以 verify connected),
  而真正点发布时平台端弹登录墙(实测网络面板只见 `createQrCode`/`checkScan`,**零条**发文章请求到达)。
  处置:在浏览器里对该账号**人工重新扫码登录一次**,把写权限的登录态补全后再发;
  若仍墙,检查 §6 冷却与设备图谱。

### 4.12 `juejin` — 掘金(实测重点,今天唯一全流程可发的一家)

- **需要哪些字段**:`sessionid`、`signatureId`(setupHint 的 `sessionid_ss` 为前端注册表旧口径;`signatureId`
  的取值位置 **待核** —— 今天入库那包按扫码导入自动获得)。支持 md/html。`needs_browser = true`。
- **去哪儿拿/怎么入库**:登录 juejin.cn 后复制 cookie,或 §2 扫码导入(平台 id `juejin`,在 scan-login 清单内)。
- **怎么自检 —— 正确的成功判据(实测)**:verify 应 `connected`;提交发布后**文章进入"审核中"状态,
  审核期间站内搜索搜不到它**。所以别拿"首页搜到了"当成功判据 —— 正确的判据是任务接口返回
  `success=true` 且拿到 `published_url`/`platform_content_id`(`GET /api/publish/tasks/{task_id}` 的
  `data.results[]`),再回掘金「我的文章」列表看草稿/审核状态。审核完成后才公开可见。

### 4.13 `xiaohongshu` — 小红书

- **需要哪些字段**:`web_session`(两侧一致)。支持 md/html/image/video。`needs_browser = true`。
- **去哪儿拿/怎么入库**:§2 扫码导入(判据 cookie 为 `web_session`,2026-09-15 起已剔除游客态 `webId`/`a1` 防误报)。
- **怎么自检**:verify;导入的 cookie 够不够写(同 CSDN 那一型)**待核** —— 首次配置后先小流量试发一篇。

### 4.14 `shipinhao` — 微信视频号

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

---

## 8. 已知未收口项(如实登记,不是"已全部可用")

1. **真正连通发布的只有 2 家**:掘金、CSDN(verify 实测 `connected`)。其中 CSDN 只到"验证通过",
   发布链路仍撞登录墙(§4.11)——严格说全流程可发的目前只有掘金。
2. **微博**缺 `access_token`、**头条**缺 `app_id`/`app_secret` ⇒ 开放平台凭据缺失,需人去申请,不是代码问题(§4.6、§4.9)。
3. **微信公众号**verify 报 `errcode=40164 invalid ip <本机公网IP>` ⇒ 等平台侧 IP 白名单动作(§4.5)。
4. **掘金发布后处于"审核中"**,站内搜索审核期间搜不到 —— 成功判据按 §4.12,别误判成发布失败。
5. CSDN 扫码导入的 cookie **够读不够写**,首次配置必须人工在浏览器重新扫码登录一次(§4.11)。
6. §0.1 的 24 个适配器均未实测;`setupHint` 未覆盖它们的字段语义(尤其 `access_token` 是平台 token 还是 cookie)多处标了**待核**。
7. 前端注册表与适配器的键名差异(§0 对照表)未收敛为单一源 —— 表单按前端注册表键名存、适配器按自己清单读时,
   差异键会表现为"填了等于没填";统一属另票。
8. YouTube/抖音/快手的 **OAuth 授权流如何在站内走完**(回调、token 落库)未在本次核查证据内 —— 待核。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
