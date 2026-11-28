<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# MCP 2026 扩展：Server Cards 与 Skills over MCP

## Server Cards（SEP-2127，v1）

卡片是**连接前提示**，不是安全判定源；运行时仍以 `server/discover` 为准。配置里显式给 URL 才拉取，客户端不猜 `<url>/server-card`（规范只把该路径列为推荐位置，真实 URL 应由 AI Catalog / 用户配置提供）。

```json
{
  "servers": [
    {
      "name": "weather",
      "transport": "http",
      "url": "https://mcp.example.com/mcp",
      "protocolVersion": "2026-07-28",
      "serverCardUrl": "https://mcp.example.com/server-card",
      "requireServerCard": true
    }
  ]
}
```

校验内容：`$schema` 精确等于 v1 URL、`name` 为 reverse-DNS（恰好一个斜杠、3–200 字符）、`version` 是单个具体版本（拒绝 `^`/`~`/`>=`/`1.x`/`1.*`）、`description` 1–100 字符、`remotes[]` 的 `type/url/supportedProtocolVersions` 形状。

失败策略：`requireServerCard: true` 时卡片缺失/不合规/无兼容 remote 直接拒绝连接；缺省只告警并按原配置继续。HTTP remote 的 `supportedProtocolVersions` 只用于**预检**，最终版本以运行时协商为准。

## Skills over MCP（SEP-2640，beta）

只在 server 同时声明 `resources` 与 `extensions["io.modelcontextprotocol/skills"]` 时启用。连接阶段只读 `server/discover` 的 capabilities，不预取 `skills/list`，更不读取任何文件。

每个 Skills server 会多出两枚工具：

- `mcp__<server>__skill_list`：只返回技能名称/描述/URI/manifest 数量；`directory` 参数仅在 server 声明 `directoryRead: true` 时可用，否则客户端直接拒绝，不把“不支持”折成空目录。
- `mcp__<server>__skill_load`：读取 `SKILL.md`，可选读取 `files[]` 里显式列出的支持文件。注册为 `approval: 'ask'` —— 读 SKILL.md 不等于激活技能，必须经过宿主批准闸。

文件内容按 manifest 的 `sha256:<64 位小写 hex>` 与字节数验真；不在 manifest 内的文件、digest 不符、大小不符一律拒绝。`resources` 为 `"dynamic"` 的技能没有内容绑定，工具会返回 `verified: false` 并明确标注。相对引用按 SKILL.md 所在目录解析，`..` 越出技能根目录或绝对 URI 指向根外都拒绝。

## 当前边界

- 不实现 AI Catalog 域名发现；Server Card 只接受显式 URL。
- Server Card 预检只消费 HTTP/SSE 的 `remotes`；stdio 连接仍可读卡片做身份展示，但不做 HTTP 端点兼容判定。
- Skills 工具接在 CLI 工具装载路径（`loadMcpTools`）；开启 `toolHub.mcpAdapter` 时 hub 适配器目前只注册原生 MCP 工具，不注册技能工具。
- Skills 文件仍受工具结果预算截断；大文件不会整块塞进上下文。

