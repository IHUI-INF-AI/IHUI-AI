# 本项目 MCP 配置说明

## 浏览器 MCP（browser）

已在 `.cursor/mcp.json` 中启用 **Browser MCP**（`@browsermcp/mcp`），用于 Cursor 内置浏览器自动化（如 `browser_navigate`、`browser_snapshot`、`browser_click` 等），方便 Agent 在验证前端效果时使用内置浏览器而非系统浏览器。

### 使用前请完成：

1. **完整重启 Cursor**  
   修改 `mcp.json` 后需完全退出并重新打开 Cursor，MCP 才会加载。

2. **（可选）Chrome 扩展**  
   若 Browser MCP 需要与真实浏览器联动，请按 [Browser MCP 文档](https://browsermcp.io) 安装对应 Chrome 扩展；若仅用 Cursor 内置预览，可先不安装。

3. **确认 MCP 已加载**  
   在 Cursor 中：**Settings → Tools & MCP**，确认列表中出现 `browser` 且状态正常。

### 本地开发地址

- 前端开发服务器：`http://localhost:8888`  
  Agent 验证页面时会使用该地址。
