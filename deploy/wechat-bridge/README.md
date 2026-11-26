<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 微信智联外部桥（参考实现）

把任意微信后端接成 IHUI 微信智联认识的 HTTP 契约。它解决的是「iLink 官方通道不支持联系人同步、群管理、朋友圈」这一类缺口：这些动作由本桥在后面接 `wcfhttp` 或其他本地后端完成，IHUI 侧不需要改代码。

## 本机常驻（DB sidecar 路线）

`data/wechat-bridge/start-bridge.ps1` 是耐久启动器：默认 `8849`、`BRIDGE_MOMENT_DRIVER=db`、
`BRIDGE_DB_MEDIA_DOWNLOAD=0`；已就绪时重复调用只返回 `BRIDGE_ALREADY_RUNNING`，不会起第二个桥。
计划任务 `IHUI-WeChat-Bridge-Logon` 和 `IHUI-WeChat-Bridge-Watchdog` 负责登录时拉起和
每 5 分钟补拉，脚本用 `C:\Program Files\PowerShell\7\pwsh.exe`，不依赖临时目录。

```powershell
pwsh -NoProfile -File C:\IHUI-AI\data\wechat-bridge\start-bridge.ps1 -Port 8849
schtasks /Run /TN "IHUI-WeChat-Bridge-Watchdog"
```

### 换一台机器怎么落地

`data/wechat-bridge/` 下的启动器与看门狗是本机产物、不进 git，所以换机器用参数化脚本生成，
不用手抄环境变量：

```powershell
# 先看计划（默认就是 dry-run，不落盘）
pwsh -NoProfile -File deploy/wechat-bridge/provision.ps1 -PythonExe "C:\IHUI-AI\data\wechat-bridge\venv\Scripts\python.exe"

# 确认无误后落盘，并注册登录自启与每 5 分钟巡检
pwsh -NoProfile -File deploy/wechat-bridge/provision.ps1 -Apply -RegisterTasks `
  -PythonExe "C:\IHUI-AI\data\wechat-bridge\venv\Scripts\python.exe"
```

脚本会先卡三道：桥服务在不在、sidecar Python 在不在、`xwechat_files` 下能不能找到唯一一个
含 `db_storage\sns\sns.db` 的账号目录（多个会列出来让你用 `-Account` 指定，不猜）。
生成的两个脚本会先过 PowerShell 语法解析再落盘，旧的先备份成 `.bak`。
`-DbDir`、`-Account`、`-Port`、`-TaskPrefix`、`-OutDir` 都可改；落盘后管理台「桥体检」
应显示 `driver=db`、`status=db-sidecar-ready`。

当前真实归档 715 条；媒体原件 207 个已落盘，1032 个因 qpic 票据过期不可得。桥不会把
「暂时无法查看」占位图或伪造图片写进归档；管理台按真实文件显示缺失数。

| 方法 | 路径                             | 说明                                                                                                                                                                                                                                                |
| ---- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET  | `/status`                        | 探活，返回 `{ ok, online, selfWxid, driver }`                                                                                                                                                                                                       |
| GET  | `/messages?since=&limit=`        | 增量入站，返回 `{ messages, nextCursor }`                                                                                                                                                                                                           |
| GET  | `/moments?since=&limit=`         | 朋友圈 `type=0` 回调，返回 `{ moments, nextCursor }`                                                                                                                                                                                                |
| GET  | `/moments/archive?limit=`        | 本次及历史真实抓取的朋友圈归档，按最后出现时间倒序，返回 `{ moments, total }`；每条含 `authorResolved, firstSeenAt, lastSeenAt, seenCount, createdAt, mediaUrls, mediaLocalDir?, mediaDownloaded?, source, page, authorId, authorName, content, id` |
| GET  | `/moments/media/list?momentId=`  | 列出该动态本地已落盘的真实媒体文件；未设置 `BRIDGE_DB_MEDIA_DIR` 时返回 404，不扫描微信目录                                                                                                                                                         |
| GET  | `/moments/media?momentId=&name=` | 读取一个本地媒体文件；只接受安全文件名，带路径穿越的请求返回 400                                                                                                                                                                                    |
| GET  | `/members/map`                   | 读取当前「群昵称 → memberId」映射，返回 `{ ok, members }`                                                                                                                                                                                           |
| POST | `/members/map`                   | `{ members: [{ chatTitle?, nickname, memberId, source: 'contact'                                                                                                                                                                                    | 'group-member' }] }`，按 source+会话+昵称合并写入映射文件 |
| POST | `/send`                          | `{ target, type, text?, url?, fileName?, mentions? }`                                                                                                                                                                                               |
| POST | `/action`                        | `{ action, ...payload }`，动作名见下                                                                                                                                                                                                                |
| POST | `/typing`                        | 可选，装饰性                                                                                                                                                                                                                                        |
| POST | `/ingest`                        | 上游把入站消息推进队列；可单条、`{messages:[...]}` 或裸数组；JSON 或 `application/x-www-form-urlencoded`；`type=0` 朋友圈会单独进 `/moments`                                                                                                        |

动作名：`contact.sync`、`contact.delete`、`group.create`、`group.invite`、`group.kick`、`group.rename`、`group.announce`、`group.members`、`history.fetch`、`moment.fetch`、`moment.publish`、`chat.switch`（OCR 只读驱动支持）。不支持的动作必须返回 `{ ok:false, status:"unsupported" }`，不要伪造成功。`group.create` 必须在 `data.chatId` 返回新群 id（形如 `xxxx@chatroom`），IHUI 侧据此建立本地群会话镜像。`group.members` 返回 `{ members:[{wxid,nickname,role}] }`，IHUI 侧会用它替换该群成员快照；wcfhttp 版本路径不一致时用 `WCFHTTP_PATHS` 覆盖 `"getRoomMembers"`。`history.fetch` 由 wcfhttp 驱动通过 `/sql` 读取 `MSG` 表，返回 `{ messages, db, table, count }`；IHUI 侧复用历史导入服务去重入库，不触发自动回复/出站 webhook。`moment.fetch` 返回 `{ moments, fetched, pages, source, partial, stopReason, limitReached, occludedBy, reason, archive }`：OCR 驱动滚动朋友圈窗口做多页 OCR，wcfhttp 驱动调 `/pyq` 触发刷新并等待 `type=0` 回调；没有回调时返回 0 和真实原因，不伪造动态。`stopReason` 区分停止原因：`page-limit`（抓满 `maxPages` 上限，`limitReached=true`，不是失败）、`occluded`（被其他窗口遮挡，附 `occludedBy`）、`scroll-stalled`（滚轮停滞且无遮挡）、`no-more-data`（提前结束/已到底）、`error`（截图或遍历出错）；驱动未给值时由桥按页数与回调结果回退推导。每次成功抓取会按 `作者+正文` 归一化去重写入本地 JSONL 归档，`archive` 给出 `{ added, updated, total }`；重复抓同一动态只增加 `seenCount`，不重复插条目。

## 运行

要求 Node 20+，无第三方依赖。

```bash
cd deploy/wechat-bridge
node server.mjs
# 默认 mock 驱动，监听 127.0.0.1:8848
```

自测：

```bash
node test/smoke.mjs
node test/ocr-dedupe.mjs   # OCR 变体去重/追加消息/重复短句/窗口缩放/单栏解析/2 倍补标题/群昵称拆分/2 倍补群昵称/朋友圈切块/内嵌朋友圈过滤/深层噪声/标题全文合并
node test/uia-driver.mjs   # UIA 控件树解析/图片计数/时间原文/作者与评论边界/id 稳定/字段派生/回退失败判定/强制失败
node test/moments.mjs      # 朋友圈 type=0 XML 解析/去重/下一页游标
node test/moments-archive.mjs # 朋友圈归档去重/重复计数/作者回退合并/读取上限
```

## 接 wcfhttp（WeChatFerry）

先在本机启动 wcfhttp（默认 `9999`），再：

```bash
cd deploy/wechat-bridge
$env:BRIDGE_DRIVER = "wcfhttp"
node server.mjs
```

环境变量：

| 变量                         | 默认                                | 说明                                                                                                         |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `BRIDGE_PORT`                | `8848`                              | 桥监听端口                                                                                                   |
| `BRIDGE_HOST`                | `127.0.0.1`                         | 桥监听地址                                                                                                   |
| `BRIDGE_SECRET`              | 空                                  | 非空时 `/status` `/messages` `/moments` `/moments/archive` `/moments/media*` `/send` `/action` 都要带 Bearer |
| `BRIDGE_DRIVER`              | `mock`                              | `mock`、`wcfhttp`、`ocr` 或 `uia`                                                                            |
| `BRIDGE_MOMENT_DRIVER`       | 跟随 `BRIDGE_DRIVER`                | 单独指定朋友圈驱动；可设 `db`，聊天仍由 `BRIDGE_DRIVER` 负责                                                 |
| `BRIDGE_DB_SIDECAR`          | `off`                               | 只有设为 `on` 才允许调用 DB sidecar；默认关闭，显式授权后才读本地 `sns.db`                                   |
| `BRIDGE_DB_PYTHON`           | `python`                            | DB sidecar 的独立 venv Python；不要把第三方包装进本仓                                                        |
| `BRIDGE_DB_DIR`              | 空                                  | 微信 `xwechat_files` 根目录                                                                                  |
| `BRIDGE_DB_ACCOUNT`          | 空                                  | 账号目录名，如 `ok502319984_e7c6`                                                                            |
| `BRIDGE_DB_WORKDIR`          | 空                                  | DB sidecar 解密工作缓存目录                                                                                  |
| `BRIDGE_DB_MEDIA_DIR`        | 空                                  | 可选图片落盘目录；设置后才开放 `/moments/media*` 读取，未设置时返回 404；只写真实图片/视频字节，不写占位图   |
| `BRIDGE_DB_MEDIA_DOWNLOAD`   | `0`                                 | 设为 `1` 先读本地 Sns 缓存，未命中再按原始 URL 取回；URL 回退不带 Referer，HTTP 400/非媒体字节拒绝落盘       |
| `BRIDGE_DB_MEDIA_LOCAL_ONLY` | `0`                                 | 设为 `1` 只导出微信本地 Sns 缓存，不访问原始 URL；未命中只计 `mediaCacheMisses`                              |
| `BRIDGE_DB_TIMEOUT_MS`       | `300000`                            | DB sidecar 子进程上限；全量 715 条媒体回退需要更长时间，低于 120000 容易误杀                                 |
| `BRIDGE_DB_LIMIT`            | `0`                                 | DB sidecar 最多导出多少条；`0` 为全量                                                                        |
| `WCFHTTP_BASE_URL`           | `http://127.0.0.1:9999`             | wcfhttp 地址                                                                                                 |
| `WCFHTTP_PATHS`              | 内置                                | JSON 覆盖各接口路径，适配不同 wcfhttp 版本                                                                   |
| `WCFHTTP_HISTORY_DB`         | 自动探测                            | 历史消息所在库名，如 `MSG0.db`；不填时 `/dbs` 里找含 `MSG` 的库                                              |
| `WCFHTTP_HISTORY_SQL`        | 内置                                | 覆盖历史消息 SQL；支持 `{{limit}}` 占位，默认读 `MSG` 表按 `CreateTime` 倒序                                 |
| `BRIDGE_QUEUE_FILE`          | `.bridge-queue.jsonl`               | 入站队列落盘位置                                                                                             |
| `BRIDGE_MOMENTS_FILE`        | `.bridge-moments.jsonl`             | 朋友圈队列落盘位置                                                                                           |
| `BRIDGE_MAX_MOMENTS`         | `500`                               | 朋友圈内存/落盘上限                                                                                          |
| `BRIDGE_MOMENT_ARCHIVE`      | `.bridge-ocr/moments-archive.jsonl` | 朋友圈历史归档 JSONL；设为 `0` 或 `off` 可关闭                                                               |
| `BRIDGE_MAX_ARCHIVE`         | `5000`                              | 归档最多保留条数，超出按最后出现时间淘汰旧条目                                                               |

API 进程侧另有 `WECHAT_HUB_MOMENT_TIMEOUT_MS`（默认 `360000`），只放宽 `moment.fetch`
动作超时；普通桥动作仍保持 60s。全量媒体回退会超过旧 60s，不能靠桥内超时单独解决。
| `BRIDGE_MEMBER_MAP` | `.bridge-members.json` | 群昵称 → memberId 映射文件路径；`POST /members/map` 合并写入，启动时加载 |
| `BRIDGE_MOMENT_WAIT_MS` | `3500` | wcfhttp `/pyq` 后等待 `type=0` 回调的时间，500-15000ms |
| `BRIDGE_MAX_QUEUE` | `5000` | 队列最多保留条数 |

驱动同时兼容两种常见 wcfhttp：PascalCase 的 `/api/GetContacts`、`/api/SendText`，以及 yuxiaoli/wcf-http 的 `/contacts`、`/text`、`/chatroom-member`。前者 404/405 时自动降级到后者；群创建、群改名、删好友仍需要 PascalCase 版本。

入站回调：启动 wcfhttp 时把 `--cb` 指向本桥：

```bash
wcfhttp --cb "http://127.0.0.1:8848/ingest?secret=<BRIDGE_SECRET>"
```

如果回调地址不支持 query secret，就用反向代理补 `X-Bridge-Secret` 头，或在同一台机器上不设 `BRIDGE_SECRET`（仅限本机回环）。

桥的入站归一化现在兼容几类常见回调形状：WeChatFerry `WxMsg` 的 `roomid` / `isGroup` / `ts` / 数字 `type`，酷喵的 `fromwx` / `gidfromwx` / `msg`，以及通用的 `messages` / `data` / 裸数组。`type` 会按微信协议数字映射成 text / image / voice / video / card / link / system。这样群消息不会再把群 id 误记成发送人。

## 接微信 4.x（只读 OCR）

微信 4.2 是自绘窗口，主窗默认在聊天页，UIA 只暴露当前页控件；进入朋友圈后 UIA 能读到 `mmui::TimeLineListView` 和动态 `ListItem`（实机单页约 219 项）。WeChatFerry 只适配 3.9.x，不能硬接。若不想降级客户端，可用截图 + Windows 自带中文 OCR 的只读驱动，或 UIA 只读驱动：

```powershell
cd deploy/wechat-bridge
$env:BRIDGE_DRIVER = "ocr"
$env:OCR_AUTO_SHOW = "1"   # 窗口隐藏时从托盘找回并还原；0 则只报未显示
node server.mjs
```

前置条件：

- Windows 10/11 已安装 `zh-cn` OCR 语言包；
- 本机 `Weixin.exe` 已登录，进程名是 `Weixin`；
- 微信主窗口默认由 `-AutoShow` 从托盘找回并还原；关闭该开关时，隐藏/最小化窗口截图为黑图；
- 当前打开哪个会话，就只读哪个会话。

驱动只产出左侧气泡的文本消息，不入库自己发出的右侧消息；群聊会识别气泡上方的小字号昵称，产出 `isGroup=true`、`senderName` 和稳定的 `ocr:member:<hash>` 发送人 id，私聊仍用会话标题作为发送人。普通 `/messages` 轮询默认用 `-Background` 走 PrintWindow，不置顶、不抢焦点；隐藏/最小化时只把微信放到底部显示一下再恢复原状态，前台工作窗口不动。`/send`、群动作、`moment.publish` 仍明确返回不支持。`/action` 的 `chat.switch` 可用：传 `{ "title": "会话标题" }`，驱动会优先点左侧会话列表，找不到再走微信搜索；切换后从新会话重建基线，不会把历史消息当新入站重复入库。`moment.fetch` 默认后台复用已经打开的朋友圈窗口，微信 4.2 的 Qt 内容实际画在 `MMUIRenderSubWindowHW` 子窗里，驱动对这个子窗发送 `WM_MOUSEWHEEL` 就能不抢焦点地翻页；每页 OCR 后比对文本签名，滚不动就停止，不把同一页重复算成多页。默认抓 3 页，`maxPages` 上限 30；达到上限时 `pages=maxPages`，不承诺已到底，滚轮不动才按 `partial` 标记提前结束。微信 4.2 的朋友圈是主窗内嵌页而非独立顶层窗口，驱动会识别“左栏朋友圈 + 右侧动态正文”的内嵌布局，不会因为找不到 `朋友圈` 独立窗就误报未打开。朋友圈真的没打开时返回原因而不是把微信弹到前台。把 `OCR_MOMENTS_AUTO_SHOW=1` 才允许脚本自动点「发现」页签、再点「朋友圈」并走前台点击（会移动鼠标/抢焦点，只在显式动作时用）。后台滚轮如果因为微信被其他窗口完全遮挡而没有改变页面，会返回 `occludedBy` 和“请把微信露出”的原因，不把一页伪装成多页。图片、点赞、评论和折叠内容不会伪造。识别有错字属于 OCR 固有误差，不要把 OCR 文本当平台原始内容。适合先打通「真机入站」链路，不适合替代 hook 做全量后台收信。

切换的工程细节：列表会上下滚动逐屏查找（先上后下），窗口会先 `Fit` 到 1240×1120 并保持置顶；宽窗列表+聊天布局下正常 OCR 常漏掉深色标题，脚本只在这一情形补一次 2 倍放大 OCR 拿标题；群标题人数后带 `@v` 这类 OCR 噪点仍按群处理，正常 OCR 漏掉浅色群昵称时也会补一次 2 倍放大 OCR 专门找昵称，但不会把放大后的列表行当正文；搜索若打开内置浏览器而不是目标会话，会返回 `ok:false`，不伪造成功。`-Mode ocr` / `-Mode windows` 是诊断入口，分别只跑 OCR / 只列微信窗口。

## 接微信 4.x（只读 UIA）

`BRIDGE_DRIVER=uia` 时，驱动先调用 `tools/wechat-uia.ps1 -Mode open`：只在朋友圈未打开时，向微信主窗 `PostMessage` 鼠标消息点击「发现」→「朋友圈」，不 `ShowWindow`、不 `SetForegroundWindow`、不 `SetFocus`、不移动系统鼠标，窗口保持原可见性；随后调用 `-Mode moments -MaxPages N -OutFile <json>` 遍历朋友圈 UIA 控件树。与 OCR 驱动一样不注入、不读内存、不改微信文件。帧顶层含 `ok、mode、pages、maxPages、stopReason、limitReached、occludedBy、reason、items[]、pageSignatures[]、total、elapsedMs`，每条 `item` 含 `page、index、name、lines[]、controlType、className、bounds、children[]`，子控件可带 `role`（cover/marker/moment/body/author/media/time/comment/noise 之类）。

解析保持保守：图片数量只认明确的「N 张图片」计数行，只保留数量、不下载二进制或链接；时间只保留界面原文（几分钟前/小时前/昨天/星期/月日/时分），不折算时间戳；作者取首行，必须非时间行、非图片行、长度合理，否则留空并标 `authorResolved=false`；评论只取「评论区」节点子树内的条目原文，正文、「余下0条」「下一条动态」、封面空节点和点赞按钮绝不当评论。有 `role` 时优先按 role 判槽位，没有 role 再按 className/文案规则兜底；空白封面 ListItem、「余下0条」「下一条动态」这类非动态节点直接标为噪声，不会变成一条朋友圈。动态 id 由 `author|content|timeText|imageCount` 的 sha256 前 12 位生成，跨页去重稳定；每条动态带 `timeText`、`imageCount`、`commentTexts`。字段可得性恒为 `media=false`（只有图片数量，没有二进制或链接）、`likes=false`（界面没有点赞控件可读）、`authorIdentity=false`（昵称无法映射 wxid），`comments` 仅在真实读到评论条目时为 true。

UIA 驱动失败（抛错、`ok=false`、或 0 条且 `stopReason=error`）且 `BRIDGE_UIA_FALLBACK` 不为 `off` 时，桥自动回退 OCR 驱动的 `moment.fetch`；返回 `data.fallback={from:'uia',to:'ocr',reason}`，`source='ocr'`，不会把回退结果伪装成 UIA 成功。`BRIDGE_UIA_FORCE_FAIL=1` 可在不碰微信的情况下强制走回退路径，专供测试。归档写入、30 页上限与 `stopReason` 语义沿用既有实现，UIA 路径不改这些语义。

新增环境变量：

| 变量                    | 默认                   | 说明                                                                             |
| ----------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `BRIDGE_DRIVER`         | `mock`                 | 增加 `ocr`（只读截图 + OCR）、`uia`（只读 UIA 控件树）                           |
| `BRIDGE_DRIVER_POLL_MS` | `5000`                 | 拉取型驱动的轮询间隔                                                             |
| `OCR_BACKGROUND`        | `1`                    | 普通轮询用 PrintWindow 后台截图，不置顶/不抢焦点；隐藏或最小化时只放到底部再恢复 |
| `OCR_AUTO_SHOW`         | `0`                    | 仅显式交互（搜索/切换）需要时再还原窗口；普通轮询保持 `0`，不弹窗                |
| `OCR_MOMENTS_AUTO_SHOW` | `0`                    | 朋友圈遍历默认后台复用已打开窗口；`1` 才允许自动点导航并还原微信（会抢焦点）     |
| `OCR_EMIT_EXISTING`     | `0`                    | 调试用：首次轮询也把当前会话已有消息推入队                                       |
| `BRIDGE_OCR_SCRIPT`     | `tools/wechat-ocr.ps1` | OCR 脚本路径                                                                     |
| `BRIDGE_OCR_POWERSHELL` | 系统 PowerShell 5.1    | 必须用 5.1，WinRT OCR 在 PowerShell 7 不可用；UIA 驱动复用同一变量               |
| `BRIDGE_UIA_SCRIPT`     | `tools/wechat-uia.ps1` | UIA 脚本路径                                                                     |
| `BRIDGE_UIA_DIR`        | `.bridge-uia`          | UIA 帧 JSON 落盘目录                                                             |
| `BRIDGE_UIA_FALLBACK`   | `on`                   | `uia` 失败后自动回退 OCR；`off` 关闭回退                                         |
| `BRIDGE_UIA_FORCE_FAIL` | `0`                    | `1` 时 UIA 驱动直接失败、不触碰微信，专供回退测试                                |

## 好友 / 群邀请自动化（默认关闭，显式授权）

`tools/wechat-friends.ps1` 用 .NET 自带的 System.Windows.Automation 枚举微信桌面端控件树，不引入任何第三方包，不做 DLL 注入、不读微信进程内存、不改微信文件。提供三条能力：

- `POST /friends/scan`（只读）：枚举「通讯录 → 新的朋友」里待处理的好友申请与群聊邀请，返回 `requests[]`（`requestId、nickname、source、kind（friend | group-invite）、clickable、seenAt`）、`rawCount`（过滤前原始条目数）、`historyCount`（已添加/已拒绝等历史行）、`entered`（是否真的进了「新的朋友」页）与 `scannedAt`。为了进页会做一次**后台点击导航**：向窗口投递真实鼠标消息（`WM_MOUSEMOVE/WM_LBUTTONDOWN/WM_LBUTTONUP`），不抢焦点、不动真实光标、不闪屏；除此之外不点任何按钮。
- `POST /friends/accept`（写动作）：body `{ "requestId": "..." }`。脚本是无状态的，`requestId` 为 base64url 编码的 `kind|controlType|className|name`；执行前先用同一套枚举重新取控件，控件名/类型/类名与扫描时完全一致才 `InvokePattern.Invoke()`，找不到或对不上一律返回 `stale-request`，宁可不点也不瞎点。
- `POST /action` 通道：`{ "action": "friend.scan" }`、`{ "action": "friend.accept", "requestId": "..." }` 走与独立路由同一套 handler，供上游 `bridge-adapter.performAction` 消费。

扫描结果缓存与巡检（2026-11-26 起）：

- 默认读缓存：内存 + 磁盘快照 `.bridge-friends-scan.json`（`BRIDGE_FRIENDS_SNAPSHOT` 可改路径），桥重启后仍能给出上次成功结果。
- 后台 60s 巡检：缓存超过 180s 才真采一次；`{"force": true}` 强制实时采；并发请求共用同一个 in-flight。
- 窗口被收进托盘时 Qt 不重建界面树，读不到元素。这时不谎报失败：回上次成功快照并标 `stale: true`、`staleReason: "window-hidden"`、`cacheAgeMs`；没有任何历史快照才返回 `failed`。收起期间巡检降到 10 分钟一次，不空耗。
- `{"wake": true}`：用一次微信全局热键（Ctrl+Alt+W）把窗口从托盘唤回来再采实时数据（实测 1.6s、27 个条目）。这条会把微信短暂顶到前台，所以只在调用方显式要求时执行，且脚本做完立刻把焦点还给原前台窗口。

窗口状态与可读性（实测口径）：

| 微信窗口状态 | UIA 可读元素 | 扫描结果 |
| --- | --- | --- |
| 正常打开，在前台 | 75–112 | 实时 |
| 正常打开，被其他窗口完全盖住 | 75 | 实时（289ms） |
| 程序化 `ShowWindow` 唤出 | 1 | 读不到，属预期 |
| 收进托盘 / 隐藏 | 0–1 | 回退过期快照（或 `-Wake` 唤回） |

结论：**只要微信窗口没被收进托盘，自动化就能在后台静默跑，不占用户屏幕**；收进托盘后只能读旧快照，需要实时数据时用 `wake: true`。

四道闸缺一不可：

1. **默认关闭**：`BRIDGE_FRIENDS_AUTOMATION` 不为 `on` 时，scan 与 accept 一律返回 `{ok:false,status:"disabled",reason:"friends-automation-off"}`，不启动子进程、不做任何 UIA 动作；开关在每次请求处理时读取，不在启动时缓存。
2. **requestId 二次校验**：accept 前重新枚举并比对控件签名，对不上即 `stale-request`；同一次进程内同一 requestId 最多 Invoke 一次，重复调用返回 `already-handled`。
3. **每小时频次上限**：在 API 侧策略层执行（桥侧不做频次统计）。
4. **审计留痕**：在 API 侧账号 metadata 记录时间、requestId、昵称、结果、错误码（桥侧只透传结果）。

风险提示：通过申请、同意进群是真实点击客户端的写动作，频率过高或行为异常可能触发平台风控甚至封号；该能力仅允许本人账号、本机离线环境使用，账号与后果由使用者自行承担。

排障：

```powershell
# 只读自检：枚举 UIA 树摘要（顶层窗口、控件类型、可见名称、类名、是否带 InvokePattern），不点、不切页
powershell -NoProfile -ExecutionPolicy Bypass -File tools/wechat-friends.ps1 -SelfTest

# 窗口在托盘里、要实时数据：用微信热键唤回再扫（会短暂把微信顶到前台）
powershell -NoProfile -ExecutionPolicy Bypass -File tools/wechat-friends.ps1 -Scan -Wake

# 5.1 语法回归（桥用 powershell.exe 5.1 拉脚本，7 的 ?? 之类语法会让整条链路静默失败）
powershell -NoProfile -ExecutionPolicy Bypass -File test/friends-script-51-parse.ps1
```

读不到微信主窗口时返回 `{"ok":false,"status":"failed","reason":"本机不可达","detail":"<UIA 报错原文>"}`：先确认微信已登录且主窗口已从托盘展开（最小化/托盘隐藏时 UIA 拿不到 600x500 以上的主窗），再看 `detail` 里的报错原文；脚本不会伪造控件树。窗口存在但枚举到的元素少于 5 个时返回 `ok:false, reason:"window-hidden-or-empty"`（多半是收在托盘或刚被程序化隐藏，Qt 没重建界面树），这时用 `-Wake` 或 `{"wake":true}` 唤回；上游已把这种情况翻成「回上次快照 + 标 stale」，不会让前端满屏报错。扫描返回 0 条时 `rawCount` 仍会给出过滤前的原始条目数，可据此判断是界面未停留在「新的朋友」页，还是当前版本 UIA 未暴露可识别条目。

新增环境变量：

| 变量                          | 默认                                   | 说明                                                                                  |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `BRIDGE_FRIENDS_AUTOMATION`   | `off`                                  | `on` 才开放好友/群邀请自动化；写动作需显式授权                                        |
| `BRIDGE_FRIENDS_SCRIPT`       | `tools/wechat-friends.ps1`             | 好友自动化 ps1 路径                                                                   |
| `BRIDGE_FRIENDS_POWERSHELL`   | 系统 PowerShell 5.1                    | PowerShell 可执行文件路径，未设置时复用 `BRIDGE_OCR_POWERSHELL`                       |
| `BRIDGE_FRIENDS_TIMEOUT_MS`   | `20000`                                | 子进程硬超时（1s–60s）；超时 kill 子进程并返回 `failed/timeout`，不让请求挂死         |
| `BRIDGE_FRIENDS_SNAPSHOT`     | `.bridge-friends-scan.json`            | 上次成功扫描的落盘快照；窗口收起时用它回退，桥重启后仍可用                            |

## 可选：本地 DB sidecar（默认关闭，显式授权）

UIA/OCR 拿不到图片 URL、点赞、评论、折叠全文和作者 wxid 时，可另起独立 DB sidecar。它不 vendor 第三方包，只在外部 venv 安装 `wechatauto-replica`，通过 `BRIDGE_MOMENT_DRIVER=db` 接管朋友圈；聊天仍走原 `BRIDGE_DRIVER`。默认 `BRIDGE_DB_SIDECAR=off`，不设 `on` 时驱动直接返回 `unsupported`，绝不自动读库。

```powershell
$env:BRIDGE_DRIVER='ocr'
$env:BRIDGE_MOMENT_DRIVER='db'
$env:BRIDGE_DB_SIDECAR='on'
$env:BRIDGE_DB_PYTHON='C:\IHUI-AI\data\wechat-bridge\venv\Scripts\python.exe'
$env:BRIDGE_DB_DIR='C:\Users\<user>\Documents\xwechat_files'
$env:BRIDGE_DB_ACCOUNT='<account_dir>'
node server.mjs
```

已实测组合：`BRIDGE_DRIVER=ocr` + `BRIDGE_MOMENT_DRIVER=db` + `BRIDGE_DB_SIDECAR=on` 在微信 4.2 上同时工作；`/messages` 仍由 OCR 返回入站消息，`/action {action:"moment.fetch"}` 返回 `source=db`，两边互不抢占。

完整安全边界、venv 安装和图片落盘说明见 `deploy/wechat-db-sidecar/README.md`。DB sidecar 会读取微信进程内存中的 SQLCipher 密钥并解密本地库，属于强授权操作；只允许本人账号、本机离线环境使用。图片 URL 的 qpic 票据可能过期并返回「暂时无法查看」占位图，sidecar 会拒绝写入占位图并把失败计入 `mediaDownloadErrors`，不会拿占位图冒充真实照片。

## 在 IHUI 里挂账号

1. 管理台新建账号，后端选 `bridge`。
2. 账号凭据填 `{ "baseUrl": "http://127.0.0.1:8848", "token": "<BRIDGE_SECRET>" }`。
3. 连接后 IHUI 会轮询 `/messages`，发送走 `/send`，群动作/联系人同步走 `/action`。

## 已知边界

- `wcfhttp` 的群接口路径在不同版本间会变；默认值按常见版本写，报 404 时用 `WCFHTTP_PATHS` 改，例如 `{"getRoomMembers":"/api/GetRoomMembers"}`。
- `history.fetch` 依赖 wcfhttp 的 `/sql` 与 `MSG` 表；不同微信版本表名/字段可能不同，失败时用 `WCFHTTP_HISTORY_DB`、`WCFHTTP_HISTORY_SQL` 指到真实库表，驱动不会伪造拉取成功。
- 群发送人靠 `BytesExtra` 里的 wxid 尽力提取；提取不到时只保留群 id 和消息内容，不阻塞导入。
- 朋友圈：wcfhttp 没有稳定的分页读取接口，`/pyq` 只负责触发刷新，真实数据靠 `type=0` 回调；桥按游标继续翻页并等待回调，没开朋友圈接收或没把回调指到本桥时只能返回 0 条，不会假装成功。OCR 朋友圈能后台对 `MMUIRenderSubWindowHW` 发滚轮抓多页，但只能读文字；图片、点赞、评论、折叠内容可能缺失；4.2 的内嵌朋友圈页沿用主窗尺寸，左栏导航/顶部封面/大图伪文字已在解析层过滤，只保留右侧真实动态正文块。滚轮不动时按 `partial` 返回，不伪造页数。
- OCR 群发送人依赖群聊里显示昵称；如果某个群/版本不显示昵称，正文仍会入库，发送人记为 `ocr:member:unknown`，不会猜成别人。昵称到 wxid 的映射只来自已有联系人/群成员快照（`.bridge-members.json`，可经 `/members/map` 写入）：同一会话下昵称唯一命中才回填真实 memberId 并标 `senderResolved:true`；昵称歧义、未命中或昵称为空时回退稳定本地哈希 `ocr:member:<hash>`，标 `senderResolved:false`、`senderSource:'local'`，不伪造 wxid。
- 队列是单进程内存 + JSONL 落盘；多实例请换共享队列（Redis/PG），本参考实现不替用户做这件事。
- 媒体先下载到 `.bridge-media/` 再交给 wcfhttp；`file://` 本地路径不会走下载。
- `/moments/media*` 只读 `BRIDGE_DB_MEDIA_DIR` 下 sidecar 真实落盘的文件，不扫描微信缓存、不补占位图；本地缓存命中图不保证等于 qpic 原图。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
