# @ihui/assistant · 智汇助手

Windows 桌面端多账号签到与管理工具（Trae / WorkBuddy 双平台）。

## 来源与许可

- 本应用基于开源项目 [Trae-workbuddyAssistant](https://github.com/cxqc168-wq/Trae-workbuddyAssistant)（作者：极泊Poles，MIT License）整合适配进 IHUI-AI monorepo。
- 上游 MIT 许可文本见本目录 `LICENSE`，按要求完整保留。
- 整合适配内容：剔除上游 license-guard 授权门与作者卡片，品牌改为「智汇助手」（`com.ihui.assistant`），接入 pnpm workspace / turbo，前端升级 React 19。
- 数据目录沿用上游 `%APPDATA%\TraeWorkAssistant\`，Windows 计划任务名 `TraeWorkAssistant_DailyCheckin` 沿用不变（保证与上游版本数据/任务兼容）。

## 开发

```powershell
pnpm install          # 仓库根执行
pnpm --filter @ihui/assistant tauri dev    # 开发模式
pnpm --filter @ihui/assistant tauri build  # 打包（msi + nsis）
```

前置：Rust 1.77+、WebView2 Runtime、VS Build Tools (C++)、Python 3.9+（签到/代理 sidecar）。

### 本机构建环境注意（2026-10-02）

本机 shell（Git Bash / 受限环境）下直接 `cargo check/build` 会因 MSVC `link.exe` 被 GNU coreutils `link` 遮蔽、或 autocfg 的 `has_std` 探测被沙箱静默干扰而失败。统一用封装脚本（自动设 MSVC/SDK 的 PATH/LIB/INCLUDE 并先跑 prepare-dev）：

```bat
scripts\cargo-check-env.bat
```

另：`tauri-build → schemars 0.8 → indexmap 1.9.3` 链路在本环境需显式开 indexmap 的 `std` feature（已在 `src-tauri/Cargo.toml [build-dependencies]` 声明，勿删），否则 schemars 编译报 E0107。

> ⚠️ 使用本工具可能违反 Trae Work 服务条款，请仅管理本人合法持有的账号，风险自担。

