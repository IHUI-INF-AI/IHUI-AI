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

图片仍可能因票据过期或权限失败：sidecar 先查微信本地 `Sns/Img` 缓存，再尝试 qpic URL；两者都拿不到时只计数失败，不把「暂时无法查看」占位图写入磁盘，也不伪造本地图片。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
