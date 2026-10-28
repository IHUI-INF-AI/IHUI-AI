<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI AI CLI

> 全栈 AI 编码代理命令行工具 — 对标 Claude Code / OpenAI Codex,9 种安装方式,跨平台运行。

## 安装

### 1. npm(全平台)

```bash
npm install -g ihui-cli
```

### 2. curl 一键安装(macOS / Linux)

```bash
curl -fsSL https://aizhs.top/install.sh | bash
```

指定版本:

```bash
curl -fsSL https://aizhs.top/install.sh | bash -s -- --version 1.0.0
```

### 3. PowerShell 一键安装(Windows)

```powershell
irm https://aizhs.top/install.ps1 | iex
```

指定版本:

```powershell
irm https://aizhs.top/install.ps1 | iex -Version 1.0.0
```

### 4. Homebrew(macOS / Linux)

```bash
brew install ihui
```

> 需先添加 tap:`brew tap ihui/ihui`

### 5. Scoop(Windows)

```bash
scoop install ihui
```

> 需先添加 bucket:`scoop bucket add ihui https://github.com/IHUI-INF-AI/IHUI-AI`

### 6. Winget(Windows)

```bash
winget install IHUI.IHUI
```

### 7. Docker(全平台)

```bash
docker run --rm -v "$(pwd):/workspace" ghcr.io/ihui/ai-cli
```

交互模式:

```bash
docker run --rm -it -v "$(pwd):/workspace" ghcr.io/ihui/ai-cli chat
```

### 8. Snap(Linux)

```bash
sudo snap install ihui --classic
```

### 9. AppImage(Linux)

从 [GitHub Releases](https://github.com/IHUI-INF-AI/IHUI-AI/releases) 下载 `IHUI-x86_64.AppImage`:

```bash
chmod +x IHUI-x86_64.AppImage
./IHUI-x86_64.AppImage --help
```

### 10. 单文件二进制(SEA,无 Node 依赖)

由 Node 22 SEA(Single Executable Applications)打包:esbuild 单文件 bundle → SEA blob → postject 注入 node.exe。exe 内嵌构建期版本与 10 份 i18n 语言包 assets,部署到任意目录无需 Node 运行时、无需仓库文件。

```bash
# 从源码构建(本机需 node 22+ 与 esbuild/postject)
pnpm --filter ihui-cli build:sea
# 产物:apps/cli/dist-sea/ihui.exe(旁随带 package.json,可随 exe 一同分发以保留 engines 元信息,缺省亦可用)

# 发布前强制烟雾测试:拷到仓库外空目录验收(版本/i18n/版本闸门都依赖内嵌数据)
cp apps/cli/dist-sea/ihui.exe /tmp/sea-accept/ && cd /tmp/sea-accept
./ihui.exe --version   # 必须输出真实版本(非 0.0.0)
./ihui.exe --help      # 必须输出中文描述(非裸键名如 cliEntry.tagline)
```

分发与安装脚本(`scripts/install.sh` / `install.ps1`)的二进制下载通道按
`releases/latest/download/ihui-<os>-<arch>.<ext>` 契约消费 GitHub Release 资产
(由 `release-cli.yml` 的 build-binary 矩阵产出)。

## 快速开始

### 示例 1:启动交互式 REPL

```bash
ihui
```

不带参数即进入交互式 REPL;多轮对话也可显式写 `ihui chat`。

### 示例 2:单次执行 agent 任务

```bash
ihui agent "为 src/utils.ts 添加单元测试"
```

### 示例 3:配置 API key 和模型

```bash
# 非交互:环境变量 + 启动参数
export IHUI_API_KEY="ihui_your_api_key"
ihui -m gpt-4o "为 src/utils.ts 添加单元测试"

# 或落盘到统一配置文件(生成模板、查看路径)
ihui settings init
ihui settings path
```

改单个配置项在 REPL 内进行:`/config list` · `/config get <key>` · `/config set <key> <value>`。

## 命令列表

| 命令 | 说明 |
| --- | --- |
| `ihui agent [prompt]` | 启动 AI 编码代理,执行编码任务 |
| `ihui` / `ihui chat` | 进入交互式 REPL(多轮对话) |
| `ihui settings <init\|path>` | 创建 / 定位统一配置文件(改配置项用 REPL 内的 `/config`) |
| `ihui undo [steps]` | 回滚最近 N 步文件改动(默认 1 步) |
| `ihui redo [steps]` | 重做最近 N 步被 undo 的改动 |
| `ihui share [session-id]` | 生成可分享的会话快照 |
| `ihui mode [mode]` | 查看或切换交互模式:plan(只读调研)/ build(执行修改)/ review(审查 diff) |
| `ihui hooks-auto <discover\|conflicts\|test>` | 自动发现多目录 hook 脚本 / 检测冲突 / 沙箱试跑 |
| `ihui serve` | 启动 Agent 内核 HTTP/WS server(端口 8841),供远程驱动 |
| `ihui connect <url>` | 作为客户端连接远程 Agent server |
| `ihui capabilities remote list --server <url>` | 查询远程端的能力清单 |

运行 `ihui --help` 查看完整命令列表和选项。

## 配置说明

### API Key

支持多种 LLM 提供商,通过环境变量或配置文件设置:

```bash
# 环境变量(推荐)
export IHUI_API_KEY="ihui_your_api_key"

# 或写入统一配置文件(生成模板后编辑 apiKey 字段;也可 `ihui login` 换取 JWT)
ihui settings init
```

配置文件路径:`~/.ihui/settings.json`

### 模型选择

```bash
# 单次指定
ihui -m gpt-4o "任务描述"

# 持久化:REPL 内 /config set defaultModel gpt-4o,或直接改 settings.json 的 defaultModel 字段
```

支持的模型包括 OpenAI GPT 系列、Anthropic Claude 系列、国产大模型(智谱 GLM、百度文心、阿里通义等)。

## 环境要求

- **Node.js** >= 20.10.0(使用 npm / Homebrew / Snap / curl 安装方式时)
- **Docker**(使用 Docker 安装方式时)
- **操作系统**: macOS 12+ / Windows 10+ / Linux(Ubuntu 20.04+ / Debian 11+ / CentOS 8+)

## 文档

- [完整文档](https://github.com/IHUI-INF-AI/IHUI-AI#readme)
- [架构设计](https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/docs/architecture.md)
- [变更日志](https://github.com/IHUI-INF-AI/IHUI-AI/releases)
- [问题反馈](https://github.com/IHUI-INF-AI/IHUI-AI/issues)

## Code signing policy

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

- **Scope**: starting with the first SignPath-approved release, every distributed Windows binary (`ihui.exe` from GitHub Releases) is Authenticode-signed during the GitHub Actions release pipeline. Builds from before that release are unsigned.
- **Team roles** (single-maintainer project): Authors / Committers: [@IHUI-INF-AI](https://github.com/IHUI-INF-AI); Reviewers: same; Approvers (signing approval for each release): same. All accounts interacting with the signing pipeline use multi-factor authentication.
- **Builds**: every release artifact is produced by the GitHub Actions workflow in this repository from the release tag's source tree. The signing request for each release is approved manually by the Approver in the SignPath portal before artifacts are published.

## Privacy statement

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. The only outbound connections, each triggered by user-configured features, are:

- **AI API calls**: sent to the user-configured IHUI API endpoint (default `http://localhost:8802`, per `src/config/defaults.ts`; there is no built-in public host) when the user runs a chat/agent task;
- **Version check**: contacts the user-configured API endpoint and `registry.npmjs.org` to check for CLI updates — disable entirely with the environment variable `IHUI_NO_UPDATE_CHECK=1`;
- **Telemetry**: disabled by default (`settings.telemetry.enabled = false`, fully no-op). If explicitly enabled by the user, events go only to the user-configured endpoint.

Crash logs are written locally to `~/.ihui/crash-logs` and never leave the machine automatically.

## License

Apache-2.0 — see [LICENSE](../../LICENSE).
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
