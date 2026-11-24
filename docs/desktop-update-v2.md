<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 桌面端 v2 更新链（稳定 Launcher）

> 适用：Windows 桌面端 `apps/desktop`。目标只有一句：**更新全程不碰运行中的进程，装完只出常驻胶囊，点一下或下次启动才切新版。**

## 目录与指针

```
<安装根>/
  智汇AI.exe              # 稳定 Launcher（约 490KB，几乎不更新）
  state.json              # 原子指针：current / previous / pending / fail_count / bad
  versions/
    0.1.94/
      ihui-app.exe        # 真正的 Tauri 载荷
  update-ready.json       # 已 stage 的胶囊凭据
  rollback-notice.json    # 自动回滚一次性通知
```

- `state.json` 由 Launcher 独占写，先写 `.tmp` 再原子替换；`.bak` 只用于读恢复。
- 快捷方式、`ihui://` 深链、开机自启、文件关联都只指向 Launcher。
- 开机自启：Tauri 插件默认按 `current_exe` 写 `HKCU\...\Run`，会落到 payload；
  `update_v2::sync_autostart` 在每次 setup（以及启用自启的同一时刻）把属于本安装目录的
  Run 值改写为 `"<根>\智汇AI.exe" --minimized`，不存在则绝不新建。
- 载荷永远从 `versions/<ver>/ihui-app.exe` 启动；运行中的版本一个字节不被覆盖。
- 安装器覆盖安装时保留一次回退代际：旧 `state.current` 写进新 `state.previous`；
  **同版本原地重装时保留旧 `previous`**，不会把可回退代际写成当前版本自己。
  `pending`/`updates` 属于上一轮更新事务，随显式安装重置。检测到 v2 `state.json` 时，
  安装器 `/UPDATE` 直接以退出码 2 中止（任何模式都不弹窗），防止旧更新链抹掉已暂存版本。
  硬闸同时检查 `/D` 目标目录与注册表里的原安装目录，过期注册表不能绕过。
- 安装器写 `state.json` 同样走 `.tmp` + `MoveFileEx(REPLACE_EXISTING|WRITE_THROUGH)` 原子替换，
  并在替换前把旧 state 复制为 `.bak`，不会在写失败时留下半截 JSON 或让 Launcher 回退到更早的任意备份。
- 安装/卸载发现 Launcher、payload 或旧主程序仍在运行时，**绝不杀进程**：静默安装以退出码 5
  结束且不弹窗；卸载器壳进程的退出码由 NSIS 固定为 0，但同样不弹窗、不杀进程、不继续删除；
  交互模式只提示“请关闭后重试”后退出。用户未保存的草稿不能被安装器替他们关掉。
- WebView2 下载失败、嵌入式安装失败、已有运行时升级失败三条路径，静默安装统一以退出码 6
  结束且不弹窗；交互模式只提示一次，不再使用上游 `Abort "..."` 或重试模态框。
- 全新安装的默认目录会做一次真实写探针；`D:\software` 等归集目录对当前用户不可写时，
  自动回退 `%LOCALAPPDATA%\Programs\<产品名>`，不会等到复制载荷才失败。

回归门禁：

- `node scripts/desktop-nsis-template.mjs --check` 会拒绝 `/UPDATE` 硬闸里的 `MessageBox`
  与带字符串的 `Abort`，并强制保留“`/D` 目标 + 注册表目录”双路径识别和退出码 2。
- `node scripts/check-desktop-installer-e2e.mjs --installer <setup.exe>` 做真机
  同名进程探针（必须 exit 5 且进程仍活着）→ 安装 → 静默/非静默两次 `/UPDATE` → 卸载；
  任何弹窗都会让子进程超时并判红，任何 KillProcess 都会让探针进程消失并判红。

## 一次更新的完整时序

1. 前端 `useUpdateReady` 启动/每 4 小时/窗口重新可见时拉 feed。
2. feed v2 判定：灰度桶、撤版、回退、`minSupported`、`minLauncher`。
3. 后台下载签名 zip 到 `updates/`，流式 sha256；minisign 验签覆盖整包。
4. 解压到 `versions/<ver>.tmp-*`，逐文件核对 `manifest.json` 的 sha256/大小，再原子改名。
5. 只写 `state.pending` + `update-ready.json`，发 `update-v2` 事件；界面出右下角胶囊。
6. 用户点“立即重启”：前端先广播 `desktop-before-close` flush 草稿，250ms 后
   `update_v2_restart` → `app.exit(42)`。
7. Launcher 收到 42，重新读盘，把 `current` 切到 `pending`，启动新 exe；不重启也行，
   下次正常打开走同一条路径。
8. Launcher 等 10 秒健康窗：进程提前退出记一次失败；连续两次启动即崩 → 自动切回
   `previous`，写 `rollback-notice.json`，再启动旧版。

## 回滚与“不再推坏版本”

- 自动回滚后 `state.bad = 坏版本`，`state.previous = null`，旧版成为 `current`。
- 客户端 `update_v2_check` 看到 feed 仍在推 `bad` 版本会直接抑制（`known-bad`），
  避免“下载→崩溃→回滚→再下载”的死亡循环；发布方修复后必须发**新版本号**。
- 已 stage 的版本被服务端撤版、灰度收缩、或被更强回退目标取代时，客户端会自动
  清 `pending` 和 `update-ready.json`，胶囊消失。
- Launcher 起来的当前版本目录被误删/杀软隔离时，会从 `versions/` 里挑最高且真有
  `ihui-app.exe` 的版本自愈，不会停在“打不开”。

## 发布

```powershell
# 1) 构建 exe（本机 CARGO_TARGET_DIR 可能是 C:\IHUI-Build\target）
pnpm --dir apps/desktop tauri build --no-bundle

# 2) zip + minisign + feed（需 TAURI_SIGNING_PRIVATE_KEY / PASSWORD）
node scripts/desktop-release-v2.mjs `
  --exe C:\IHUI-Build\target\release\ihui-desktop.exe `
  --version 0.1.94 `
  --base-url https://github.com/OWNER/REPO/releases/download/desktop-v0.1.94 `
  --rollout 5 `
  --ts-out apps/web/src/config/desktop-feed-v2.generated.ts
```

- `desktop-payload-v2.mjs` 生成固定布局：根目录 `ihui-app.exe` + `manifest.json`。
- `desktop-feed-v2.mjs` 生成 `schema=2` feed，写入 `payload{url,size,sha256,signature}`；
  `--ts-out` 烘焙进 Web 仓库后，`/desktop-feed.json` 优先返回 v2。
- 灰度从 1%→5%→25%→100%，`--revoked` 撤版，`--rollback-to` 指定本地可退回目标。
- 低于 `minSupported` 的客户端显示强制更新胶囊，但仍**不自动退出/重启**。

## 已知边界（必须诚实说明）

- 正式对外发布仍需 **Authenticode 代码签名**（Launcher 与 payload exe）；minisign 只保证
  更新包字节完整，不等于 Windows 代码签名信誉。CI 现有的 SignPath 只签安装器，
  zip 载荷需要单独的代码签名步骤。
- 生产 minisign 私钥不在本机；没有生产 key 时 `tauri build` 会在 updater 签名阶段报错。
  本次已用一次性测试 key 跑通完整 build（产物验完即删 key），但测试签名不能对外发布；
  生产环境必须由 CI secret `DESKTOP_TAURI_PRIVATE_KEY` 提供。
- feed v2 前端快照默认 `null`，迁移期继续吐 legacy 安装器 feed；未烘焙 v2 前客户端
  不会走 zip 链，也不会误装安装器。
- 热更新要求安装根对当前用户可写（Tauri NSIS 默认按用户安装；现有 `D:\software\智汇AI`
  可写）。若装进 `Program Files` 且 ACL 只读，下载/解压会失败，但 Launcher 仍会尽力
  启动现有版本；这类机器需要管理员安装包，不能依赖静默热更新。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
