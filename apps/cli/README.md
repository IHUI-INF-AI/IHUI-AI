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
npm install -g @ihui/cli
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

## License

MIT
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
