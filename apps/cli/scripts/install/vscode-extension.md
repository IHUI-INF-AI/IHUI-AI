# IHUI VSCode 集成

IHUI CLI 可通过三种方式集成到 VSCode / Cursor / Windsurf 等基于 VSCode 的编辑器。

## 方式一:终端内调用(零配置,最快)

在 VSCode 集成终端直接运行 `ihui`,享受完整 REPL + Agent 模式。

```jsonc
// .vscode/settings.json — 默认终端用 pwsh/bash,ihui 自动继承 PATH
{
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.defaultProfile.windows": "PowerShell"
}
```

推荐快捷键绑定(`keybindings.json`,Cmd/Ctrl+Shift+P → "Open Keyboard Shortcuts (JSON)"):

```jsonc
[
  {
    "key": "ctrl+alt+i",
    "command": "workbench.action.terminal.new",
    "args": { "command": "ihui" }
  }
]
```

## 方式二:ACP 协议嵌入(原生编辑器集成)

IHUI 内置 ACP (Agent Client Protocol) server,可直接被 Zed / VSCode(Cursor/Windsurf)等编辑器作为
原生 Agent 嵌入,工具调用、diff、文件改动直接显示在编辑器 UI。

启动:

```bash
ihui acp   # 启动 ACP server(stdio),供编辑器 LSP 风格接入
```

VSCode `settings.json` 示例(以 Cursor 为例):

```jsonc
{
  "cursor.agent.protocol": "acp",
  "cursor.agent.command": ["ihui", "acp"]
}
```

## 方式三:Client/Server 远程驱动

在远程主机或容器启动 IHUI server,本地 VSCode Remote-SSH 连接后用 `ihui connect` 远程驱动:

```bash
# 远程主机
ihui serve --port 8841 --token "$IHUI_AGENT_TOKEN"

# 本地(VSCode Remote 终端)
ihui connect ws://remote-host:8841 --token "$IHUI_AGENT_TOKEN"
```

## 配套能力

- **Skills**:在 `<workspace>/.ihui/skills/*.md` 放置 skill 文件,自动注入 system prompt。
- **Hooks**:在 `<workspace>/.trae-cn/hooks/` 放置 `pre_tool-*.sh` / `post_tool-*.js`,自动发现 + 沙箱执行。
- **MCP**:`ihui mcp add <name> <command>` 配置 MCP 服务器,`--mcp` 启动加载。

## 故障排查

| 现象 | 原因 / 解决 |
| --- | --- |
| `ihui: command not found` | npm 全局 bin 未加入 PATH,运行 `npm prefix -g` 查询并加入 PATH |
| ACP 接入后无响应 | 检查 `ihui acp` 是否在 stdio 模式启动;编辑器 command 路径是否绝对 |
| `--api-key` 暴露在进程列表 | 改用 `IHUI_API_KEY` 环境变量或 `~/.ihui/settings.json` |
