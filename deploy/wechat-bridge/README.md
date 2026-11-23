<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 微信智联外部桥（参考实现）

把任意微信后端接成 IHUI 微信智联认识的 HTTP 契约。它解决的是「iLink 官方通道不支持联系人同步、群管理、朋友圈」这一类缺口：这些动作由本桥在后面接 `wcfhttp` 或其他本地后端完成，IHUI 侧不需要改代码。

## 契约

| 方法 | 路径                      | 说明                                                        |
| ---- | ------------------------- | ----------------------------------------------------------- |
| GET  | `/status`                 | 探活，返回 `{ ok, online, selfWxid, driver }`               |
| GET  | `/messages?since=&limit=` | 增量入站，返回 `{ messages, nextCursor }`                   |
| POST | `/send`                   | `{ target, type, text?, url?, fileName?, mentions? }`       |
| POST | `/action`                 | `{ action, ...payload }`，动作名见下                        |
| POST | `/typing`                 | 可选，装饰性                                                |
| POST | `/ingest`                 | 上游把入站消息推进队列；可单条、`{messages:[...]}` 或裸数组 |

动作名：`contact.sync`、`contact.delete`、`group.create`、`group.invite`、`group.kick`、`group.rename`、`group.announce`、`moment.publish`。不支持的动作必须返回 `{ ok:false, status:"unsupported" }`，不要伪造成功。`group.create` 必须在 `data.chatId` 返回新群 id（形如 `xxxx@chatroom`），IHUI 侧据此建立本地群会话镜像。

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
```

## 接 wcfhttp（WeChatFerry）

先在本机启动 wcfhttp（默认 `9999`），再：

```bash
cd deploy/wechat-bridge
$env:BRIDGE_DRIVER = "wcfhttp"
node server.mjs
```

环境变量：

| 变量                | 默认                    | 说明                                                         |
| ------------------- | ----------------------- | ------------------------------------------------------------ |
| `BRIDGE_PORT`       | `8848`                  | 桥监听端口                                                   |
| `BRIDGE_HOST`       | `127.0.0.1`             | 桥监听地址                                                   |
| `BRIDGE_SECRET`     | 空                      | 非空时 `/status` `/messages` `/send` `/action` 都要带 Bearer |
| `BRIDGE_DRIVER`     | `mock`                  | `mock` 或 `wcfhttp`                                          |
| `WCFHTTP_BASE_URL`  | `http://127.0.0.1:9999` | wcfhttp 地址                                                 |
| `WCFHTTP_PATHS`     | 内置                    | JSON 覆盖各接口路径，适配不同 wcfhttp 版本                   |
| `BRIDGE_QUEUE_FILE` | `.bridge-queue.jsonl`   | 入站队列落盘位置                                             |
| `BRIDGE_MAX_QUEUE`  | `5000`                  | 队列最多保留条数                                             |

入站回调：启动 wcfhttp 时把 `--cb` 指向本桥：

```bash
wcfhttp --cb "http://127.0.0.1:8848/ingest?secret=<BRIDGE_SECRET>"
```

如果回调地址不支持 query secret，就用反向代理补 `X-Bridge-Secret` 头，或在同一台机器上不设 `BRIDGE_SECRET`（仅限本机回环）。

## 在 IHUI 里挂账号

1. 管理台新建账号，后端选 `bridge`。
2. 账号凭据填 `{ "baseUrl": "http://127.0.0.1:8848", "token": "<BRIDGE_SECRET>" }`。
3. 连接后 IHUI 会轮询 `/messages`，发送走 `/send`，群动作/联系人同步走 `/action`。

## 已知边界

- `wcfhttp` 的群接口路径在不同版本间会变；默认值按常见版本写，报 404 时用 `WCFHTTP_PATHS` 改。
- 朋友圈在 wcfhttp 上通常没有稳定接口，驱动会返回 `unsupported`，不会假装成功。
- 队列是单进程内存 + JSONL 落盘；多实例请换共享队列（Redis/PG），本参考实现不替用户做这件事。
- 媒体先下载到 `.bridge-media/` 再交给 wcfhttp；`file://` 本地路径不会走下载。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
