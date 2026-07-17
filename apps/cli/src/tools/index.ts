/**
 * Agent 工具系统 — Tool 接口定义与工具注册器。
 *
 * 灵感来源:cli 的 `cli-tools` crate(Rust),port 了 codex/opencode 的工具实现。
 * 简化策略(做减法):
 *   - 用 prompt engineering 让 LLM 输出结构化 tool_call 块(不依赖后端 function calling 支持)
 *   - Tool 接口最小化:name/description/parameters schema/execute
 *   - 工具注册器统一管理,支持动态注册(MCP 工具后并入)
 *   - 执行结果统一格式化(tool_result)回传给 LLM
 *   - 危险操作(dangerLevel='dangerous')执行前需用户确认
 *
 * 工具调用格式(LLM 输出):
 * ```tool_call
 * {"name":"read_file","arguments":{"path":"src/index.ts"}}
 * ```
 */

import { redactSecrets } from '../redact.js';
import { checkFolderTrust, type FolderTrustMap } from '../sandbox/index.js';
import { checkPermission, type PermissionRules } from './permissions.js';

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  /** P1-4 错误类型分级,供调用方/LLM 判断是否需要重试 */
  errorType?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  required: string[];
  /** 危险级别:read(只读,默认)/ write(写入)/ dangerous(危险,需用户确认) */
  dangerLevel?: 'read' | 'write' | 'dangerous';
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  workspacePath: string;
  /** 危险操作确认回调,返回 true 表示允许执行。未提供时 dangerous 操作直接拒绝。 */
  confirmDangerous?: (tool: Tool, args: Record<string, unknown>) => Promise<boolean>;
  /** 沙盒配置(命令白名单 + env 过滤),由 setupAgentTools 从 settings.json 注入 */
  sandbox?: {
    commandAllowlist?: string[];
    blockedEnvVars?: string[];
    allowedPaths?: string[];
  };
  /** 路径信任映射(可选,用于 write/edit/delete 工具的额外路径检查) */
  folderTrust?: FolderTrustMap;
  /** P0-7 Permission rules:白名单/黑名单控制(--tools/--disallowed-tools CLI flag 注入) */
  permissions?: PermissionRules;
}

const registry = new Map<string, Tool>();

function registerTool(tool: Tool): void {
  registry.set(tool.name, tool);
}

export function registerTools(tools: Tool[]): void {
  for (const t of tools) registerTool(t);
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function listTools(): Tool[] {
  return Array.from(registry.values());
}

export function clearTools(): void {
  registry.clear();
}

export function buildSystemPrompt(tools: Tool[], extraContext?: string, planFirst?: boolean): string {
  const toolDescriptions = tools
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([name, p]) => {
          const req = t.required.includes(name) ? ' (必填)' : '';
          const enumStr = p.enum ? ` 可选值: ${p.enum.join('|')}` : '';
          return `    - ${name}: ${p.type}${req} — ${p.description}${enumStr}`;
        })
        .join('\n');
      return `### ${t.name}\n${t.description}\n参数:\n${params}`;
    })
    .join('\n\n');

  const contextSection = extraContext
    ? `\n\n## 项目上下文\n\n${extraContext}\n`
    : '';

  const planSection = planFirst
    ? `\n\n## 任务规划(必须先规划后执行)

在执行任何工具调用前,你必须先输出一个任务规划块:

\`\`\`plan
1. <步骤1描述>
2. <步骤2描述>
3. <步骤N描述>
\`\`\`

规划完成后再逐步执行工具调用。每完成一步,简要说明进度并继续下一步。若规划需调整,先输出新的 plan 块再继续。`
    : '';

  return `你是一个强大的编码助手。你可以使用以下工具来完成任务。
${contextSection}${planSection}

## 可用工具

${toolDescriptions}

## 工具调用格式

当需要使用工具时,在回复中输出以下格式的代码块:

\`\`\`tool_call
{"name":"工具名","arguments":{"参数名":"参数值"}}
\`\`\`

可以连续调用多个工具(每个占一个代码块)。工具执行后,结果会以 user 消息形式返回,你可以继续处理。

当任务完成或无需工具时,正常回复即可(不包含 tool_call 块)。

## 注意事项

- 优先使用工具获取信息,不要猜测文件内容
- 文件路径相对于工作区根目录
- 一次只调用必要的工具,避免冗余操作`;
}

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

const TOOL_CALL_REGEX = /```tool_call\s*\n([\s\S]*?)```/g;

export function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim());
      if (parsed && typeof parsed.name === 'string' && typeof parsed.arguments === 'object') {
        calls.push({ name: parsed.name, arguments: parsed.arguments ?? {} });
      }
    } catch {
      // 忽略解析失败的块
    }
  }
  TOOL_CALL_REGEX.lastIndex = 0;
  return calls;
}

const PLAN_BLOCK_REGEX = /```plan\s*\n([\s\S]*?)```/;

/** 从 LLM 输出中解析 plan 块,返回 plan 内容(无 ```plan 包裹),不存在返回 null。 */
export function parsePlanBlock(text: string): string | null {
  const m = PLAN_BLOCK_REGEX.exec(text);
  return m ? m[1]!.trim() : null;
}

export function formatToolResult(call: ParsedToolCall, result: ToolResult): string {
  const status = result.success ? '✓' : '✗';
  const errorPart = result.error ? `\n错误: ${result.error}` : '';
  const safeOutput = redactSecrets(result.output);
  return `[工具结果 ${status}] ${call.name}\n${safeOutput}${errorPart}`;
}

export async function executeToolCall(
  call: ParsedToolCall,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = getTool(call.name);
  if (!tool) {
    return { success: false, output: '', error: `未知工具: ${call.name}`, errorType: 'not_found' };
  }
  // P0-7 Permission rules:白名单/黑名单拦截(在 rate limit 之前,避免被限流工具仍消耗配额)
  if (ctx.permissions) {
    const perm = checkPermission(call.name, ctx.permissions);
    if (!perm.allowed) {
      return {
        success: false,
        output: '',
        error: perm.reason ?? `工具 ${call.name} 被权限规则拒绝`,
        errorType: 'permission_denied',
      };
    }
  }
  // P1-4 Rate limiting:同一工具 10 秒内最多 5 次,超限返回 error
  const rateLimit = checkRateLimit(call.name);
  if (!rateLimit.allowed) {
    return { success: false, output: '', error: rateLimit.reason, errorType: 'rate_limited' };
  }
  if (tool.dangerLevel === 'dangerous') {
    const allowed = ctx.confirmDangerous ? await ctx.confirmDangerous(tool, call.arguments) : false;
    if (!allowed) {
      return {
        success: false,
        output: '',
        error: `危险操作被拒绝(需用户确认): ${call.name}`,
      };
    }
  }
  // P1-5 Error recovery:read 工具失败自动重试 1 次 + 100ms 退避;write/dangerous 不重试(避免副作用)
  return executeWithRetry(tool, call.arguments, ctx);
}

// ==================== P1-4 Rate limiting(滑动窗口计数)====================

export interface RateLimitOptions {
  windowMs?: number;
  maxCalls?: number;
}

const DEFAULT_RATE_LIMIT_WINDOW_MS = 10_000;
const DEFAULT_RATE_LIMIT_MAX_CALLS = 5;
const toolCallTimestamps = new Map<string, number[]>();
let globalRateLimitOpts: RateLimitOptions = {};

/**
 * 检查工具调用频率是否超限(滑动窗口算法)。
 *
 * 默认:同一工具 10 秒内最多 5 次。超限返回 { allowed: false, reason },executeToolCall 会以此拒绝执行。
 * 滑动窗口比固定窗口更公平 — 不会因为跨越窗口边界而突然允许突发流量。
 */
export function checkRateLimit(toolName: string, opts: RateLimitOptions = {}): { allowed: boolean; reason?: string } {
  const windowMs = opts.windowMs ?? globalRateLimitOpts.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const maxCalls = opts.maxCalls ?? globalRateLimitOpts.maxCalls ?? DEFAULT_RATE_LIMIT_MAX_CALLS;
  const now = Date.now();
  const timestamps = toolCallTimestamps.get(toolName) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= maxCalls) {
    const oldest = recent[0]!;
    const waitMs = windowMs - (now - oldest);
    return {
      allowed: false,
      reason: `工具 ${toolName} 触发限流:${windowMs / 1000} 秒内已调用 ${recent.length} 次(上限 ${maxCalls}),请 ${Math.max(waitMs, 1)}ms 后再试`,
    };
  }
  recent.push(now);
  toolCallTimestamps.set(toolName, recent);
  return { allowed: true };
}

/** 重置限流器状态(主要用于测试) */
export function resetRateLimiter(): void {
  toolCallTimestamps.clear();
}

/** 配置全局限流参数(可选,用于灵活调整窗口大小和最大次数) */
export function setGlobalRateLimitOpts(opts: RateLimitOptions): void {
  globalRateLimitOpts = opts;
}

// ==================== P1-5 Error recovery(读工具自动重试)====================

const READ_TOOL_RETRY_DELAY_MS = 100;
const READ_TOOL_MAX_RETRIES = 1;

/**
 * 执行工具,对 dangerLevel='read' 的幂等读工具失败时自动重试。
 *
 * 策略:
 *   - read 工具:失败后等待 100ms 重试 1 次(应对瞬时网络/文件系统抖动)
 *   - write/dangerous 工具:不重试(避免重复写入/删除等副作用)
 *   - 抛异常和返回 success=false 都视为失败
 */
export async function executeWithRetry(
  tool: Tool,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0;
  let lastResult: ToolResult = { success: false, output: '', error: '未执行' };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await tool.execute(args, ctx);
      if (result.success) return result;
      lastResult = result;
    } catch (err) {
      lastResult = {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
    // P1-4 仅对可重试错误类型进行重试,避免对 permission/unknown 等无效重试
    if (attempt < maxRetries) {
      const errorType = lastResult.errorType ?? classifyError(lastResult.error);
      if (!isRetryableErrorType(errorType)) break;
      await new Promise((resolve) => setTimeout(resolve, READ_TOOL_RETRY_DELAY_MS));
    }
  }
  // P1-4 错误分级:优先保留工具显式标记,其次启发式分类
  if (lastResult.errorType === undefined) {
    lastResult = { ...lastResult, errorType: classifyError(lastResult.error) };
  }
  return lastResult;
}

// ==================== P1-4 Error classification ====================

export type ErrorType =
  | 'rate_limited'
  | 'timeout'
  | 'permission'
  | 'not_found'
  | 'network'
  | 'unknown';

/** 根据错误文本启发式分类错误类型(大小写不敏感)。 */
export function classifyError(error?: string | null): ErrorType {
  const e = (error ?? '').toLowerCase();
  if (
    e.includes('rate limit') ||
    e.includes('限流') ||
    e.includes('too many requests') ||
    e.includes('429')
  )
    return 'rate_limited';
  if (
    e.includes('timeout') ||
    e.includes('timed out') ||
    e.includes('超时') ||
    e.includes('etimedout')
  )
    return 'timeout';
  if (
    e.includes('permission denied') ||
    e.includes('access forbidden') ||
    e.includes('权限不足') ||
    e.includes('操作被拒绝') ||
    e.includes('eacces') ||
    e.includes('eperm')
  )
    return 'permission';
  if (
    e.includes('not found') ||
    e.includes('enoent') ||
    e.includes('不存在') ||
    e.includes('no such file')
  )
    return 'not_found';
  if (
    e.includes('network error') ||
    e.includes('econnreset') ||
    e.includes('econnrefused') ||
    e.includes('fetch failed') ||
    e.includes('连接被拒绝') ||
    e.includes('enotfound') ||
    e.includes('epipe')
  )
    return 'network';
  return 'unknown';
}

/** 判断错误类型是否可重试(network/timeout/rate_limited)。 */
export function isRetryableErrorType(errorType: string | undefined): boolean {
  return errorType === 'network' || errorType === 'timeout' || errorType === 'rate_limited';
}

/** 判断错误类型是否为致命错误(仅 permission)。 */
export function isFatalErrorType(errorType: string | undefined): boolean {
  return errorType === 'permission';
}

/**
 * 检查路径是否允许写操作。
 * 返回 { allowed: boolean, reason?: string }
 */
export function checkPathWritePermission(
  filePath: string,
  ctx: ToolContext,
): { allowed: boolean; reason?: string } {
  if (!ctx.folderTrust) return { allowed: true };
  const level = checkFolderTrust(filePath, ctx.folderTrust);
  if (level === 'forbidden') {
    return { allowed: false, reason: `路径 ${filePath} 被 folder_trust 标记为 forbidden,禁止修改` };
  }
  if (level === 'read-only') {
    return { allowed: false, reason: `路径 ${filePath} 被 folder_trust 标记为 read-only,禁止修改` };
  }
  return { allowed: true };
}
