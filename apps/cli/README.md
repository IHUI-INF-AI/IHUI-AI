# IHUI AI CLI

> 全栈 AI 编码代理命令行工具 — 对标 Claude Code / OpenAI Codex,9 种安装方式,跨平台运行。

## 安装

### 1. npm(全平台)

```bash
npm install -g @ihui/cli
```

### 2. curl 一键安装(macOS / Linux)

```bash
curl -fsSL https://ihui.ai/install.sh | bash
```

指定版本:

```bash
curl -fsSL https://ihui.ai/install.sh | bash -s -- --version 1.0.0
```

### 3. PowerShell 一键安装(Windows)

```powershell
irm https://ihui.ai/install.ps1 | iex
```

指定版本:

```powershell
irm https://ihui.ai/install.ps1 | iex -Version 1.0.0
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
docker run --rm -it -v "$(pwd):/workspace" ghcr.io/ihui/ai-cli repl
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
ihui repl
```

进入交互式对话,直接与 AI 编码代理对话。

### 示例 2:单次执行 agent 任务

```bash
ihui agent "为 src/utils.ts 添加单元测试"
```

### 示例 3:配置 API key 和模型

```bash
ihui config set apiKey sk-your-api-key
ihui config set model gpt-4o
```

## 命令列表

| 命令 | 说明 |
| --- | --- |
| `ihui agent [prompt]` | 启动 AI 编码代理,执行编码任务 |
| `ihui repl` | 启动交互式 REPL 会话 |
| `ihui config <get\|set> [key] [value]` | 查看或修改配置(API key / 模型 / 等) |
| `ihui undo` | 撤销上一次文件操作 |
| `ihui redo` | 重做上一次撤销的操作 |
| `ihui share [session-id]` | 分享会话记录 |
| `ihui mode <mode>` | 切换工作模式(plan / act / auto) |
| `ihui hooks-auto [enable\|disable]` | 启用或禁用自动 hooks |
| `ihui remote [start\|stop\|status]` | 管理远程会话服务 |

运行 `ihui --help` 查看完整命令列表和选项。

## 配置说明

### API Key

支持多种 LLM 提供商,通过环境变量或配置文件设置:

```bash
# 环境变量(推荐)
export IHUI_API_KEY="sk-your-api-key"

# 或通过 config 命令
ihui config set apiKey sk-your-api-key
```

配置文件路径:`~/.ihui/config.json`

### 模型选择

```bash
# 查看当前模型
ihui config get model

# 设置模型
ihui config set model gpt-4o
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
