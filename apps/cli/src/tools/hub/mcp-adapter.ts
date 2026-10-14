// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P1-5 Computer Hub — MCP Adapter:把 MCP server 发现的 tool 注册为 Hub ToolHandle。
 *
 * 让 MCP 工具与内置工具一起在 Hub 中调度(通过 CompoundResolver 的 local-shadows-remote)。
 *
 * 简化策略(做减法):
 *   - 复用 mcp-runtime.ts 已有的 McpConnection / McpToolDef 类型(零新依赖)
 *   - 复用 hub/registry.ts 已有的 ToolHandle 接口(零新概念,不引入 HubTool/HubToolContext)
 *   - 工具 id 格式:mcp__<serverName>__<toolName>(对齐 Claude Code 命名约定,可读且无冲突)
 *   - dangerLevel 默认 'read'(MCP 工具实际危险级别未知,保守取 read)
 *   - 注册失败的 tool 不阻塞其他 tool(单 tool try/catch + warn)
 *   - 调用失败转 ToolResult.errorType='unknown',不抛异常(对齐 mcpToolToTool 行为)
 */

import { callMcpServer, mcpToolName, type McpConnection, type McpToolDef } from '../mcp-runtime.js';
import type { ToolContext, ToolResult } from '../index.js';
import type { ToolHandle, ToolRegistry } from './registry.js';

export interface RegisterMcpToolsOptions {
  /** Hub 注册表(通常是 InMemoryRegistry 实例,作为 CompoundResolver 的 remote) */
  hub: ToolRegistry;
  /** MCP server 连接(已完成 initialize + tools/list) */
  mcpConnection: McpConnection;
  /** MCP server 名称(用于工具 id 命名 mcp__<serverName>__<toolName>) */
  serverName: string;
  /** 启用 dangerous 级别(默认 false,保守取 read) */
  enableDangerous?: boolean;
}

/**
 * G-422:从两轴工具 id 解析 MCP 归属 server 名。
 * id 形状 `mcp__<serverName>__<toolName>`;非该形状(内置工具等)返回 undefined。
 */
export function mcpServerOfId(id: string): string | undefined {
  if (!id.startsWith('mcp__')) return undefined;
  const sep = id.indexOf('__', 5);
  if (sep < 0) return undefined;
  const server = id.slice(5, sep);
  const tool = id.slice(sep + 2);
  if (!server || !tool) return undefined;
  return server;
}

/** G-422:碰撞消息里对一方的归属点名(MCP 服务器名 / 非 MCP 来源)。 */
export function describeOwner(id: string): string {
  const server = mcpServerOfId(id);
  return server ? `服务器 '${server}'` : `非 MCP 来源(id '${id}')`;
}

/**
 * G-422:同名键碰撞检测——hub 同 id 已存在时抛错,点名冲突双方归属,
 * 替代 InMemoryRegistry 的 newest-wins 静默跨服覆盖(对齐上游 mcp/index.ts:74-78 的事故面)。
 * 处置指引:检查 mcpServers 是否配置了两台同名 serverName。
 */
export function assertNoCollision(existingId: string, incomingId: string): void {
  const msg =
    `MCP 工具注册冲突:两轴键 '${existingId}' 已由 ${describeOwner(existingId)} 注册,` +
    `拒收 ${describeOwner(incomingId)} 的同名注册。` +
    `请检查 mcpServers 是否配置了两台同名 serverName(后到者被拒,先到者保留)。`;
  throw new Error(msg);
}

/**
 * 把 MCP server 的所有 tools 注册到 hub。
 * 单个 tool 注册失败不阻塞其他 tool(只 log warn)。
 * G-422:注册前探测同名键,已存在 ⇒ 拒收后到者(经下方 catch 落 warn),不再静默覆盖。
 * 返回注册成功的 tool 数量。
 */
export function registerMcpToolsToHub(opts: RegisterMcpToolsOptions): number {
  const { hub, mcpConnection, serverName, enableDangerous = false } = opts;
  let count = 0;
  for (const mcpTool of mcpConnection.tools ?? []) {
    try {
      const handle = adaptMcpToolToHubTool(serverName, mcpTool, mcpConnection, enableDangerous);
      const existing = hub.find(handle.id);
      if (existing) {
        assertNoCollision(existing.id, handle.id);
      }
      hub.register(handle);
      count++;
    } catch (err) {
      // 单个 tool 注册失败不阻塞其他
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[hub-mcp-adapter] 注册 MCP tool 失败: ${serverName}/${mcpTool.name}: ${msg}`);
    }
  }
  return count;
}

/**
 * 把单个 MCP tool 转为 Hub ToolHandle。
 * - id: mcp__<serverName>__<toolName>
 * - describe() 返回 ToolDescription(parameters 直接透传 inputSchema,required 取 inputSchema.required)
 * - execute(ctx, args) 转发到 mcpConnection 的 tools/call(经 callMcpServer)
 *
 * 注意:parameters 字段保留 inputSchema 原貌(Record<string, unknown>),
 * 而不是转换为 Record<string, ToolParameter>。Hub 的 ToolDescription.parameters 即为 Record<string, unknown>,
 * 这层抽象允许 MCP 工具的 JSON Schema 直接透传给上层(LLM prompt 构造可识别)。
 */
export function adaptMcpToolToHubTool(
  serverName: string,
  schema: McpToolDef,
  mcpConnection: McpConnection,
  enableDangerous = false,
): ToolHandle {
  const id = mcpToolName(serverName, schema.name);
  return {
    id,
    describe() {
      return {
        id,
        description: schema.description ?? `MCP tool: ${schema.name}`,
        parameters: (schema.inputSchema as Record<string, unknown>) ?? {},
        required: schema.inputSchema.required ?? [],
        dangerLevel: enableDangerous ? 'dangerous' : 'read',
      };
    },
    async execute(_ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
      return callMcpToolForResult(mcpConnection, schema.name, args);
    },
  };
}

/**
 * 调用 MCP server 的 tools/call 并构造 ToolResult。
 * 行为对齐 mcp-runtime.ts 中 mcpToolToTool 的 execute 实现(零行为差异):
 *   - 成功:解析 content 数组中的 text 项拼接为 output
 *   - 失败:转 ToolResult(success=false, error=消息),不抛异常
 */
async function callMcpToolForResult(
  conn: McpConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const raw = await callMcpServer(conn, 'tools/call', {
      name: toolName,
      arguments: args,
    });
    const result = raw as { content?: Array<{ type: string; text?: string }> } | null;

    if (!result?.content) {
      return { success: true, output: '(无输出)' };
    }

    const texts = result.content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!)
      .join('\n');

    return { success: true, output: texts || '(无文本输出)' };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
