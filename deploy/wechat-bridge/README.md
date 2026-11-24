<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 微信智联外部桥（参考实现）

把任意微信后端接成 IHUI 微信智联认识的 HTTP 契约。它解决的是「iLink 官方通道不支持联系人同步、群管理、朋友圈」这一类缺口：这些动作由本桥在后面接 `wcfhttp` 或其他本地后端完成，IHUI 侧不需要改代码。

## 契约

| 方法 | 路径                      | 说明                                                                                                                                         |
| ---- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET  | `/status`                 | 探活，返回 `{ ok, online, selfWxid, driver }`                                                                                                |
| GET  | `/messages?since=&limit=` | 增量入站，返回 `{ messages, nextCursor }`                                                                                                    |
| GET  | `/moments?since=&limit=`  | 朋友圈 `type=0` 回调，返回 `{ moments, nextCursor }`                                                                                         |
| POST | `/send`                   | `{ target, type, text?, url?, fileName?, mentions? }`                                                                                        |
| POST | `/action`                 | `{ action, ...payload }`，动作名见下                                                                                                         |
| POST | `/typing`                 | 可选，装饰性                                                                                                                                 |
| POST | `/ingest`                 | 上游把入站消息推进队列；可单条、`{messages:[...]}` 或裸数组；JSON 或 `application/x-www-form-urlencoded`；`type=0` 朋友圈会单独进 `/moments` |

动作名：`contact.sync`、`contact.delete`、`group.create`、`group.invite`、`group.kick`、`group.rename`、`group.announce`、`group.members`、`history.fetch`、`moment.fetch`、`moment.publish`、`chat.switch`（OCR 只读驱动支持）。不支持的动作必须返回 `{ ok:false, status:"unsupported" }`，不要伪造成功。`group.create` 必须在 `data.chatId` 返回新群 id（形如 `xxxx@chatroom`），IHUI 侧据此建立本地群会话镜像。`group.members` 返回 `{ members:[{wxid,nickname,role}] }`，IHUI 侧会用它替换该群成员快照；wcfhttp 版本路径不一致时用 `WCFHTTP_PATHS` 覆盖 `"getRoomMembers"`。`history.fetch` 由 wcfhttp 驱动通过 `/sql` 读取 `MSG` 表，返回 `{ messages, db, table, count }`；IHUI 侧复用历史导入服务去重入库，不触发自动回复/出站 webhook。`moment.fetch` 返回 `{ moments, fetched, pages, source, partial, reason }`：OCR 驱动滚动朋友圈窗口做多页 OCR，wcfhttp 驱动调 `/pyq` 触发刷新并等待 `type=0` 回调；没有回调时返回 0 和真实原因，不伪造动态。

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
node test/moments.mjs      # 朋友圈 type=0 XML 解析/去重/下一页游标
```

## 接 wcfhttp（WeChatFerry）

先在本机启动 wcfhttp（默认 `9999`），再：

```bash
cd deploy/wechat-bridge
$env:BRIDGE_DRIVER = "wcfhttp"
node server.mjs
```

环境变量：

| 变量                    | 默认                    | 说明                                                                         |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `BRIDGE_PORT`           | `8848`                  | 桥监听端口                                                                   |
| `BRIDGE_HOST`           | `127.0.0.1`             | 桥监听地址                                                                   |
| `BRIDGE_SECRET`         | 空                      | 非空时 `/status` `/messages` `/moments` `/send` `/action` 都要带 Bearer      |
| `BRIDGE_DRIVER`         | `mock`                  | `mock` 或 `wcfhttp`                                                          |
| `WCFHTTP_BASE_URL`      | `http://127.0.0.1:9999` | wcfhttp 地址                                                                 |
| `WCFHTTP_PATHS`         | 内置                    | JSON 覆盖各接口路径，适配不同 wcfhttp 版本                                   |
| `WCFHTTP_HISTORY_DB`    | 自动探测                | 历史消息所在库名，如 `MSG0.db`；不填时 `/dbs` 里找含 `MSG` 的库              |
| `WCFHTTP_HISTORY_SQL`   | 内置                    | 覆盖历史消息 SQL；支持 `{{limit}}` 占位，默认读 `MSG` 表按 `CreateTime` 倒序 |
| `BRIDGE_QUEUE_FILE`     | `.bridge-queue.jsonl`   | 入站队列落盘位置                                                             |
| `BRIDGE_MOMENTS_FILE`   | `.bridge-moments.jsonl` | 朋友圈队列落盘位置                                                           |
| `BRIDGE_MAX_MOMENTS`    | `500`                   | 朋友圈内存/落盘上限                                                          |
| `BRIDGE_MOMENT_WAIT_MS` | `3500`                  | wcfhttp `/pyq` 后等待 `type=0` 回调的时间，500-15000ms                       |
| `BRIDGE_MAX_QUEUE`      | `5000`                  | 队列最多保留条数                                                             |

驱动同时兼容两种常见 wcfhttp：PascalCase 的 `/api/GetContacts`、`/api/SendText`，以及 yuxiaoli/wcf-http 的 `/contacts`、`/text`、`/chatroom-member`。前者 404/405 时自动降级到后者；群创建、群改名、删好友仍需要 PascalCase 版本。

入站回调：启动 wcfhttp 时把 `--cb` 指向本桥：

```bash
wcfhttp --cb "http://127.0.0.1:8848/ingest?secret=<BRIDGE_SECRET>"
```

如果回调地址不支持 query secret，就用反向代理补 `X-Bridge-Secret` 头，或在同一台机器上不设 `BRIDGE_SECRET`（仅限本机回环）。

桥的入站归一化现在兼容几类常见回调形状：WeChatFerry `WxMsg` 的 `roomid` / `isGroup` / `ts` / 数字 `type`，酷喵的 `fromwx` / `gidfromwx` / `msg`，以及通用的 `messages` / `data` / 裸数组。`type` 会按微信协议数字映射成 text / image / voice / video / card / link / system。这样群消息不会再把群 id 误记成发送人。

## 接微信 4.x（只读 OCR）

微信 4.2 是自绘窗口，UIA 控件树为空，WeChatFerry 只适配 3.9.x，不能硬接。若不想降级客户端，可用截图 + Windows 自带中文 OCR 的只读驱动：

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

驱动只产出左侧气泡的文本消息，不入库自己发出的右侧消息；群聊会识别气泡上方的小字号昵称，产出 `isGroup=true`、`senderName` 和稳定的 `ocr:member:<hash>` 发送人 id，私聊仍用会话标题作为发送人。普通 `/messages` 轮询默认用 `-Background` 走 PrintWindow，不置顶、不抢焦点；隐藏/最小化时只把微信放到底部显示一下再恢复原状态，前台工作窗口不动。`/send`、群动作、`moment.publish` 仍明确返回不支持。`/action` 的 `chat.switch` 可用：传 `{ "title": "会话标题" }`，驱动会优先点左侧会话列表，找不到再走微信搜索；切换后从新会话重建基线，不会把历史消息当新入站重复入库。`moment.fetch` 默认后台复用已经打开的朋友圈窗口，微信 4.2 的 Qt 内容实际画在 `MMUIRenderSubWindowHW` 子窗里，驱动对这个子窗发送 `WM_MOUSEWHEEL` 就能不抢焦点地翻页；每页 OCR 后比对文本签名，滚不动就停止，不把同一页重复算成多页。默认抓 3 页，`maxPages` 上限 30；达到上限时 `pages=maxPages`，不承诺已到底，滚轮不动才按 `partial` 标记提前结束。微信 4.2 的朋友圈是主窗内嵌页而非独立顶层窗口，驱动会识别“左栏朋友圈 + 右侧动态正文”的内嵌布局，不会因为找不到 `朋友圈` 独立窗就误报未打开。朋友圈真的没打开时返回原因而不是把微信弹到前台。把 `OCR_MOMENTS_AUTO_SHOW=1` 才允许脚本自动点「发现」页签、再点「朋友圈」并走前台点击（会移动鼠标/抢焦点，只在显式动作时用）。图片、点赞、评论和折叠内容不会伪造。识别有错字属于 OCR 固有误差，不要把 OCR 文本当平台原始内容。适合先打通「真机入站」链路，不适合替代 hook 做全量后台收信。

切换的工程细节：列表会上下滚动逐屏查找（先上后下），窗口会先 `Fit` 到 1240×1120 并保持置顶；宽窗列表+聊天布局下正常 OCR 常漏掉深色标题，脚本只在这一情形补一次 2 倍放大 OCR 拿标题；群标题人数后带 `@v` 这类 OCR 噪点仍按群处理，正常 OCR 漏掉浅色群昵称时也会补一次 2 倍放大 OCR 专门找昵称，但不会把放大后的列表行当正文；搜索若打开内置浏览器而不是目标会话，会返回 `ok:false`，不伪造成功。`-Mode ocr` / `-Mode windows` 是诊断入口，分别只跑 OCR / 只列微信窗口。

新增环境变量：

| 变量                    | 默认                   | 说明                                                                             |
| ----------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `BRIDGE_DRIVER`         | `mock`                 | 增加 `ocr`（微信 4.x 只读截图 + OCR）                                            |
| `BRIDGE_DRIVER_POLL_MS` | `5000`                 | 拉取型驱动的轮询间隔                                                             |
| `OCR_BACKGROUND`        | `1`                    | 普通轮询用 PrintWindow 后台截图，不置顶/不抢焦点；隐藏或最小化时只放到底部再恢复 |
| `OCR_AUTO_SHOW`         | `0`                    | 仅显式交互（搜索/切换）需要时再还原窗口；普通轮询保持 `0`，不弹窗                |
| `OCR_MOMENTS_AUTO_SHOW` | `0`                    | 朋友圈遍历默认后台复用已打开窗口；`1` 才允许自动点导航并还原微信（会抢焦点）     |
| `OCR_EMIT_EXISTING`     | `0`                    | 调试用：首次轮询也把当前会话已有消息推入队                                       |
| `BRIDGE_OCR_SCRIPT`     | `tools/wechat-ocr.ps1` | OCR 脚本路径                                                                     |
| `BRIDGE_OCR_POWERSHELL` | 系统 PowerShell 5.1    | 必须用 5.1，WinRT OCR 在 PowerShell 7 不可用                                     |

## 在 IHUI 里挂账号

1. 管理台新建账号，后端选 `bridge`。
2. 账号凭据填 `{ "baseUrl": "http://127.0.0.1:8848", "token": "<BRIDGE_SECRET>" }`。
3. 连接后 IHUI 会轮询 `/messages`，发送走 `/send`，群动作/联系人同步走 `/action`。

## 已知边界

- `wcfhttp` 的群接口路径在不同版本间会变；默认值按常见版本写，报 404 时用 `WCFHTTP_PATHS` 改，例如 `{"getRoomMembers":"/api/GetRoomMembers"}`。
- `history.fetch` 依赖 wcfhttp 的 `/sql` 与 `MSG` 表；不同微信版本表名/字段可能不同，失败时用 `WCFHTTP_HISTORY_DB`、`WCFHTTP_HISTORY_SQL` 指到真实库表，驱动不会伪造拉取成功。
- 群发送人靠 `BytesExtra` 里的 wxid 尽力提取；提取不到时只保留群 id 和消息内容，不阻塞导入。
- 朋友圈：wcfhttp 没有稳定的分页读取接口，`/pyq` 只负责触发刷新，真实数据靠 `type=0` 回调；桥按游标继续翻页并等待回调，没开朋友圈接收或没把回调指到本桥时只能返回 0 条，不会假装成功。OCR 朋友圈能后台对 `MMUIRenderSubWindowHW` 发滚轮抓多页，但只能读文字；图片、点赞、评论、折叠内容可能缺失；4.2 的内嵌朋友圈页沿用主窗尺寸，左栏导航/顶部封面/大图伪文字已在解析层过滤，只保留右侧真实动态正文块。滚轮不动时按 `partial` 返回，不伪造页数。
- OCR 群发送人依赖群聊里显示昵称；如果某个群/版本不显示昵称，正文仍会入库，发送人记为 `ocr:member:unknown`，不会猜成别人。昵称到 wxid 的映射需要额外通讯录/群成员数据，当前不伪造。
- 队列是单进程内存 + JSONL 落盘；多实例请换共享队列（Redis/PG），本参考实现不替用户做这件事。
- 媒体先下载到 `.bridge-media/` 再交给 wcfhttp；`file://` 本地路径不会走下载。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
