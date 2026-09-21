<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI AI Desktop（智汇AI 桌面端）

> Tauri 2 + WebView2 桌面客户端。**有意复用 web 产物**的「搭便车」分发策略——桌面端不自建前端。

## 分发策略：单产物复用

桌面端不维护独立的前端工程，而是直接复用 `apps/web` 的静态导出产物。这样做的目的是让桌面端**自动继承 web 端全部对话能力**（Markdown 流式渲染、推理折叠、工具卡、审批、diff、Plan/Terminal 等），避免两套前端长期分叉与能力漂移。

依赖关系链：

```
apps/web 的源码 (app / src / public)
        │  pnpm --filter @ihui/web build:static
        ▼
apps/web/out               ← 唯一产物真源
        │  tauri.conf.json → build.frontendDist = "../../web/out"
        ▼
apps/desktop 的 Tauri 打包产物
```

- `build.frontendDist`：`"../../web/out"`（见 `src-tauri/tauri.conf.json`）——告诉 Tauri 打包哪个前端目录。
- `build.beforeBuildCommand`：`node scripts/ensure-web-out.mjs`——产物校验与按需重建。
- 校验脚本 `scripts/ensure-web-out.mjs` 负责保证产物存在：当 `web/out` 缺失，或 web 源码比产物更新时，才执行 `pnpm --filter @ihui/web build:static`；否则直接跳过（强制重建可设 `FORCE_FRONTEND_BUILD=1`）。

## 本地开发

```bash
# 在仓库根目录或 apps/desktop 下执行（tauri dev 会按 tauri.conf.json 自动拉起 web dev server）
pnpm --filter @ihui/desktop dev
```

`tauri.conf.json` 的 `beforeDevCommand` 为 `pnpm --filter @ihui/web dev`，`devUrl` 为 `http://localhost:8801`。即开发态同样复用 web 的 dev server，改 web 代码即时生效。

## 构建

```bash
pnpm --filter @ihui/desktop build          # = tauri build，走 ensure-web-out.mjs 校验/构建 web/out
pnpm --filter @ihui/desktop build:debug    # 调试版
```

## 重要提示

- **要修改对话 UI（消息渲染、工具卡、审批、Plan/Terminal 等），请在 `apps/web` 进行**，不要在 `apps/desktop` 内另起炉灶。桌面端只是 web 产物的外壳，改 `apps/web` 即同时生效于 web 端与桌面端。
- `apps/desktop/src` 仅承载桌面平台特有能力（如未来的设备指纹注入、Tauri 平台适配）；纯前端 UI 一律归 `apps/web`。
