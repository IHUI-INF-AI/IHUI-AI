<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11 逆向取证：Codex 桌面端 26.1111 前端/插件/技能/TeX 能力面

> 取证日期：2026-11-15　|　目标：OpenAI Codex 桌面端（MSIX 包 **26.1111.2228.0**）
> 根：`C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources`
> 方法：目录结构勘察 + `strings` 字符串取证 + asar 头 JSON 解析 + 清单文件读取。全部计数基于真实命中。
> 红线：仅只读取证，未执行二进制、未读 `@oai/*/docs/*.md` 专有文档正文、未粘专有源码、未提取凭据。

---

## ① 新版 vs 旧版（26.1106 → 26.1111）二进制量化

| 二进制 | 新版 | 旧版 | 变化 |
|---|---|---|---|
| codex.exe | 364.8MB | 356.0 | ↑8.8 |
| codex-code-mode-host.exe | 76.7 | 76.0 | ≈ |
| codex-command-runner.exe | 8.5 | 8.4 | ≈ |
| codex-windows-sandbox-service.exe | 55.8 | 55.0 | ≈ |
| codex-windows-sandbox-setup.exe | 18.7 | 18.5 | ≈ |
| app.asar | 747.4 | 772.8 | ↓25.4 |

> **修正一个预设**：本轮 plan 原假设「app.asar 已消失、架构从 Electron 迁走」——实测**推翻**。app.asar 未消失（747.4MB / 783750654 字节），是瘦身 25MB 而非消失，主引擎全在。教训：plan 预设也要现读验证。

> **取证陷阱**：Windows Python 不认 `/c/` POSIX 路径，前两次体积扫描误报全部「缺失」；须用 `C:/` 风格。两次读数（`ls` 783.7 vs Python 747.4）源于字节/MB 混读，已核实真实值 747.4MB。

---

## ② 全新能力面 `cua_node`（286MB，旧版未记录）

`resources/cua_node/manifest.json`：定制 Node 运行时 `node 24.22.1-cua.1`，是 computer-use 的执行底座。

依赖栈（`cua_node/bin/node_modules`）：
- `playwright` / `playwright-core` —— 浏览器自动化
- `sharp` —— 图像处理
- `pixelmatch` —— **视觉像素 diff**
- `@img` / `@statsig` —— 图像 + 特性开关

私有包 `@oai/`（架构证据，仅 package.json）：

| 包 | 版本 | description |
|---|---|---|
| `@oai/cua` | 0.2.7 | (CUA 执行核心；docs 目录名含 `tinysky` 代号) |
| `@oai/sky` | 0.7.21 | (CUA 编排层；docs 含 `sky-full-desktop-api` / `sky-window-api`) |
| `@oai/cua-repl` | 0.1.5 | "CUA MCP interface for NodeREPL" |
| `@oai/browser-desktop` | 0.1.1 | "Production browser runtime for Codex Desktop" |

自研 native 模块（`resources/native/*.node`，桌面级控制，**超出浏览器范围**）：
`remote-control-device-key` / `hid-topology-watcher` / `shared-texture` / `computer-use-app-icons` / `windows-account` / `dictation-ducking` / `windows-updater`。

> 红线处置：`@oai/*/docs/*.md` 是 OpenAI 专有文档，**未读正文、未粘源码**，只取 package.json 的 name/version/description 与目录结构作架构证据。

---

## ③ app.asar webview 改版

顶层 5 节点与旧版同构（`.vite` / `native-menu-locales` / `node_modules` / `package.json` / `webview`），但 webview **4683 → 19192 项**（膨胀 4 倍）：

| 一级目录 | 文件数 |
|---|---|
| assets/ | 19021（hash 名 SVG 前端资源重构） |
| apps/ | 29（**computer-use 识别的桌面应用图标集**） |
| images/ | 135 |
| .well-known/ | 3 |

**apps/ 29 张图标清单**（CUA 桌面应用识别集）：
`android-studio, antigravity, bbedit, cmder, cursor, devin, emacs, file-explorer, finder, ghostty, goland, intellij, iterm2, kitty, microsoft-terminal, phpstorm, pycharm, rider, rustrover, sublime-text, terminal, textmate, vscode-insiders, vscode, warp, webstorm, windsurf, xcode, zed` —— 全是 IDE/编辑器/终端，指向 CUA 的"识别并操作开发工具"场景。

---

## ④ tectonic：TeX/LaTeX 本地编译（53MB）

`tectonic.exe` 是 **XeTeX 引擎**（`xetex_layout` crate、DVI/PDF 输出、SyncTeX、bibtex 兼容）。`tectonic/compiler/` 含 4 个 OpenAI 自有编排脚本：

- `compile_desktop.py` —— "Desktop preview behavior layered on the packaged, unchanged LaTeX helpers"
- `compile_latex.py` —— 共享编译助手
- `detect_tectonic.py` / `detect_texlive.py` —— **引擎探测降级链**（bundled tectonic → 系统 texlive）

设计借鉴点（合法面，自有编排脚本）：**探测降级链 + 输出封顶**（`MAX_LOG_BYTES=8000` / `MAX_RESULT_BYTES=65536`）+ **隔离模式加载 app-owned helper**（`sys.path.insert` 只加载自带模块，永不加载文档/用户搜索路径的 Python 模块——防代码注入）。

---

## ⑤ 插件机制（`.codex-plugin` + 签名收据）

`plugins/openai-bundled/plugins/` 8 个内置插件：`browser, chrome, codex-app-tools, computer-use, deep-research, latex, unified-computer-use, visualize`。

**插件契约**（`browser/.codex-plugin/plugin.json`）：
- `version` / `name` / `hooks` —— 生命周期钩子（`Interrupt` / `SubagentStop` / `Stop` → `mcp_tool` 回调 `node_repl` server 的 `turn_ended`）

**签名收据**（`plugin-signatures/openai-bundled/receipt.json`）：
- `algorithm: RSA_PKCS1_SHA256` / `environment: production` / `key_id`
- `plugins[{plugin, sha256, archive_bytes}]` —— 每插件 sha256 + 字节数

---

## ⑥ 技能系统（SKILL.md 范式）

`skills/skills/.curated/{hatch-pet, onboard-new-user}/`，每个含 `SKILL.md`（frontmatter `name`/`description`）+ `scripts/` + `references/` + `tests/` + `agents/openai.yaml`。与 Box-Agent Skill 范式同构。

---

## ⑦ 与 IHUI-AI 逐项对齐（三态）

| Codex 能力面 | 本仓现状 | 判定 |
|---|---|---|
| computer-use 浏览器驾驶舱 | `computer_use.py`（Playwright，用户隔离会话）+ 本轮 `visual_diff` | **已有等价** |
| computer-use 视觉像素比对 | `visual_diff.py`（本轮复现） | **已补齐** |
| CUA 桌面控制（remote-control/hid/shared-texture） | 无（本仓走浏览器方案） | **不适用本仓栈** |
| 29 应用桌面识别 | 无（服务 CUA 桌面控制，本仓非此路） | **不适用本仓栈** |
| TeX/LaTeX 本地 PDF 编译 | 无 tectonic（本仓有 reportlab/pdfplumber） | **真差距（低优先，非 AI 核心）** |
| 插件完整性收据（多插件 sha256 清单） | `bundle_integrity.py` 管单 bundle HMAC；缺多插件清单层 | **真差距 → 本轮补齐 `plugin_receipt.py`** |
| 技能系统（SKILL.md 装载） | `skill_registry`（list/list_by_category/reload） | **已有等价** |
| 插件 hooks 生命周期 | `hook_engine` + `agent_events.py` HOOK_EVENTS | **已有等价** |

---

## ⑧ 本轮复现交付

### `app/core/plugin_receipt.py` + `tests/test_plugin_receipt.py`（对标 plugin-signatures）

- **差距**：Codex 用 receipt.json 列每插件的 sha256 + archive_bytes + key_id，加载前逐项校验；本仓 `bundle_integrity` 只管单 bundle HMAC，缺"多插件清单完整性 + 逐项 verdict + 集合一致"层。
- **超越轴**：① 可判定且可定位（逐插件 verdict：OK/TAMPERED/MISSING/EXTRA/SIZE_MISMATCH/INVALID_ENTRY，非一句"坏了"）；② 集合一致（清单登记 vs 磁盘实际的孤儿/缺失两侧）；③ fail-closed（清单 sha256 非 64hex 判 invalid 不跳过）。
- **纯逻辑无 IO**：磁盘探测由调用方注入（`scan_disk_plugins` 唯一 IO 入口可绕过），可 mock 测试。
- **显式不做**：RSA 验签（需私钥体系，属部署职责，与 HMAC 层互补）；插件加载执行；hooks 调度（hook_engine 已有）。
- **验证**：13 pytest 全过（含反向变异：hash 篡改/缺失/孤儿/尺寸/非法 sha256/解析层 fail-closed）；ruff 全绿；水印齐备。

### `app/core/visual_diff.py` + `tests/test_visual_diff.py`（对标 pixelmatch，本轮前段）

见 loop-run-log Round 11。9 pytest 全过 + 反向变异；ruff 全绿；水印齐备。

---

## ⑨ 诚实边界（做了但不能宣称的部分）

- **未接生产路径**：`visual_diff.py` / `plugin_receipt.py` 均未接入 `computer_use.py` / 插件加载器。按 round9 范式先落纯函数模块 + 测试，接入点留属主单独决策（避免撞在飞文件）。
- **性能未量化**：收益依赖真实截图/多插件上游频率，本机无真实流量，验证停在逻辑层正确性。
- **CUA 桌面控制未复现**：remote-control-device-key / hid-topology / shared-texture 是桌面级控制（需 Windows API 深度逆向 + Ghidra），超出本轮预算，且属"不适用本仓浏览器方案"——如实标不适用，不硬套。
- **@oai 内部算法未知**：cua/sky 的编排逻辑在专有 docs 内，未取证；只知其分层定位。

## ⑩ 覆盖度自评

本机 Codex 26.1111 `resources/` 下全部一级面已覆盖：`native/` `cua_node/` `tectonic/` `plugins/` `plugin-signatures/` `skills/` `artifact-template-picker/` `default_app/` `owl-*` `masque-*` `app.asar` `*.exe`。**无剩余未覆盖一级面**。深度未穷尽（@oai 专有 docs 红线内、CUA 桌面控制超预算），已如实标注。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
