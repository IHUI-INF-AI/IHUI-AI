<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 微信 4.x 本地 DB sidecar（默认关闭）

这是朋友圈结构化字段的**可选增强路线**，只补 UIA/OCR 拿不到的图片 URL、点赞、评论、
作者 wxid 与更稳定的动态 id；它不是默认路线，也不会自动开启。

## 边界（必须同时满足）

- 独立进程：由桥按需 `execFile` 调用，不把第三方包 vendor 进本仓。
- 默认关闭：只有 `BRIDGE_DB_SIDECAR=on` 且 `BRIDGE_MOMENT_DRIVER=db` 时才启用。
- 显式授权：会读取 `Weixin.exe` 进程内存里的 SQLCipher 密钥；只允许在本人账号、本机离线环境使用。
- 只读：不写微信数据库、不点 UI、不发消息、不截图、不把数据上传到外部服务。
- 不伪造：字段缺失时按真实记录返回空数组/`false`，不补造图片、点赞、评论或作者名。

## 安装

独立 venv（Python 3.12）：

```powershell
python -m venv C:\caches\temp\wxauto-venv
C:\caches\temp\wxauto-venv\Scripts\python.exe -m pip install -r deploy\wechat-db-sidecar\requirements.txt
```

`wechatauto-replica` 为 Apache-2.0 第三方依赖，仅安装在外部 venv，不入仓、不随项目分发。
其实现会读取微信进程内存，属于本 sidecar 的显式授权边界。

## 单独验证

```powershell
C:\caches\temp\wxauto-venv\Scripts\python.exe deploy\wechat-db-sidecar\fetch_moments.py `
  --db-dir C:\Users\<user>\Documents\xwechat_files `
  --account <account_dir> `
  --workdir C:\caches\temp\wechatauto-db `
  --limit 3
```

stdout 是 JSON；`ok=false` 时 `reason` 保留真实错误，不会返回假数据。

## 桥接（只替换朋友圈，聊天仍走原驱动）

```powershell
$env:BRIDGE_DRIVER='ocr'
$env:BRIDGE_MOMENT_DRIVER='db'
$env:BRIDGE_DB_SIDECAR='on'
$env:BRIDGE_DB_PYTHON='C:\caches\temp\wxauto-venv\Scripts\python.exe'
$env:BRIDGE_DB_DIR='C:\Users\<user>\Documents\xwechat_files'
$env:BRIDGE_DB_ACCOUNT='<account_dir>'
$env:BRIDGE_DB_WORKDIR='C:\caches\temp\wechatauto-db'
node deploy\wechat-bridge\server.mjs
```

可选图片落盘：

```powershell
$env:BRIDGE_DB_MEDIA_DIR='C:\caches\temp\wechat-db-media'
$env:BRIDGE_DB_MEDIA_DOWNLOAD='1'
```

只导出本机已缓存的媒体，不访问原始媒体 URL：

```powershell
$env:BRIDGE_DB_MEDIA_DIR='C:\caches\temp\wechat-db-media'
$env:BRIDGE_DB_MEDIA_DOWNLOAD='1'
$env:BRIDGE_DB_MEDIA_LOCAL_ONLY='1'
```

`local-cache-only` 只按微信 Sns 缓存的宽高/字节数匹配，命中才解密落盘；
未命中只计 `mediaCacheMisses`，不会发 URL 请求。缓存可能是微信重编码版，
字节数与 feed 声明值不一致；它不是 CDN 原图，不能宣称成“原图”。

图片仍可能因票据过期或权限失败：sidecar 先查微信本地 `Sns/Img` 缓存，再尝试原始 URL；
两者都拿不到时只计数失败，不把「暂时无法查看」占位图写入磁盘，也不伪造本地图片。

URL 回退的硬边界（本机实测）：

- qpic 原图对 `Referer` 敏感：带 `https://szmmsns.qpic.cn/` 这类 qpic 域 Referer，
  仍有效的 `/0` 原图会被降级成 120×120、5093 字节占位图；**URL 回退不发送 Referer**。
- 不带 Referer 后，全量 `1064` 个 qpic URL 中只有 `24` 个仍返回真实 JPEG；
  其余 `1040` 个是 HTTP 400，主机互换、HTTPS、query 参数都无法恢复。
- 只接受真实字节：JPEG/PNG/GIF/WEBP 图片 magic，或含 `ftyp` 的 MP4/MOV；
  HTTP 400、HTML、未知二进制、占位图一律不落盘。

媒体来源会写入 `media_dir/.media-manifest.json`（相对路径 → `cache` / `url`）。
重跑时按清单恢复来源统计，避免把上次 URL 下载的文件误算成本地缓存命中；
清单缺失的历史文件只计 `mediaExisting`，不猜测来源。

统计字段（全部来自本次真实执行）：

| 字段 | 含义 |
| --- | --- |
| `mediaTotal` | 图片 + 视频总数 |
| `downloadedMedia` | 实际写入磁盘的真实媒体数 |
| `mediaCacheHits` | 命中微信本地 Sns 缓存的媒体数 |
| `mediaCacheMisses` | 本地缓存未命中的媒体数 |
| `mediaExisting` | 上次运行已落盘、本次按 `.media-manifest.json` 复用且来源未知的数量 |
| `mediaUrlHits` | 原始 URL 成功取回真实媒体字节的数量 |
| `mediaUrlMisses` | 原始 URL 已失效（HTTP 400/非媒体/占位图）的数量 |
| `mediaUrlErrors` | URL 网络异常的数量，与“票据失效”分开 |
| `mediaUnavailable` | 本地缓存和原始 URL 都拿不到的真实媒体数量 |
| `mediaDownloadErrors` | 真正的下载异常数；HTTP 400 不计入这里 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
