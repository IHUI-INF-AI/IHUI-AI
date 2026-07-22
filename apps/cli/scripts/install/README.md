# IHUI CLI 安装方式

IHUI AI Coding Agent CLI 提供 9 种安装方式,覆盖主流包管理器与运行时。

所有方式均依赖 **Node.js 20+**。安装后运行 `ihui` 进入交互式 REPL,或 `ihui --help` 查看命令。

## 1. npm / pnpm 全局安装(跨平台,首选)

```bash
npm install -g @ihui/cli        # 或
pnpm add -g @ihui/cli
```

## 2. 一键脚本安装

### 2a. macOS / Linux(bash curl)

```bash
curl -fsSL https://ihui.ai/install.sh | bash
```

脚本见 [`install.sh`](./install.sh)。

### 2b. Windows(PowerShell)

```powershell
iwr -useb https://ihui.ai/install.ps1 | iex
```

脚本见 [`install.ps1`](./install.ps1)。

## 3. Homebrew(macOS / Linux)

```bash
brew tap ihui/ai
brew install ihui-ai
```

Formula 见 [`brew.rb`](./brew.rb)。

## 4. Scoop(Windows)

```powershell
scoop bucket add ihui https://github.com/ihui/scoop-bucket
scoop install ihui-ai
```

Manifest 见 [`scoop.json`](./scoop.json)。

## 5. Chocolatey(Windows)

```powershell
choco install ihui-ai
```

nuspec 见 [`choco.nuspec`](./choco.nuspec)。

## 6. Nix(NixOS / 任意 Linux + macOS)

```bash
# 临时运行
nix run github:ihui/ai#ihui

# 全局安装
nix profile install github:ihui/ai#ihui
```

flake 见 [`nix.nix`](./nix.nix)。

## 7. Docker(容器化,无需本地 Node)

```bash
# 构建
docker build -t ihui-ai -f scripts/install/Dockerfile .

# 在当前目录运行(挂载工作区)
docker run --rm -it -v "$(pwd):/workspace" -w /workspace ihui-ai
```

Dockerfile 见 [`Dockerfile`](./Dockerfile)。

## 8. VSCode / Cursor / Windsurf 集成

通过 ACP 协议原生嵌入编辑器,或终端调用。详见 [`vscode-extension.md`](./vscode-extension.md)。

```bash
ihui acp   # 启动 ACP server(stdio),供编辑器 LSP 风格接入
```

## 9. 源码构建(开发者)

```bash
git clone https://github.com/ihui/ai.git
cd ai
pnpm install
pnpm --filter @ihui/cli build
# 本地 dev 运行
pnpm --filter @ihui/cli dev
```

## 安装方式选择指南

| 场景 | 推荐方式 |
| --- | --- |
| 日常开发(任意 OS) | 1. npm 全局安装 |
| 不熟悉 Node 生态 | 2. 一键脚本(curl / iex) |
| macOS 开发者 | 3. Homebrew |
| Windows 开发者 | 4. Scoop 或 5. Chocolatey |
| NixOS / 可复现环境 | 6. Nix |
| CI/CD / 隔离运行 | 7. Docker |
| 编辑器内 Agent | 8. VSCode 集成(ACP) |
| 贡献代码 | 9. 源码构建 |

## 验证安装

```bash
ihui --version       # 查看版本
ihui --help          # 查看命令
ihui init            # 在当前目录创建 AGENTS.md
ihui                 # 进入交互式 REPL
```

## 卸载

```bash
npm uninstall -g @ihui/cli        # npm
pnpm remove -g @ihui/cli          # pnpm
brew uninstall ihui-ai            # Homebrew
scoop uninstall ihui-ai           # Scoop
choco uninstall ihui-ai           # Chocolatey
nix profile remove ihui-ai       # Nix
docker rmi ihui-ai                # Docker(镜像)
```
