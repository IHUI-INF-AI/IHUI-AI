/**
 * 浏览器自动化工具 — 通过 @playwright/mcp server 提供浏览器操作能力。
 *
 * 灵感来源:参考行业 Agent 框架的 browser 工具面(Claude Code / OpenClaw 的 browser_use)。
 * 实现策略(轻量接入,不新增硬依赖):
 *   - 复用现有 mcp-runtime 的 stdio transport,以子进程方式按需拉起
 *     `npx -y @playwright/mcp@latest --stdio`(首次调用时懒连接,进程内单例复用)
 *   - CLI 侧暴露稳定的 browser_* 工具面(名称/参数/危险级别自定),
 *     内部映射到 Playwright MCP 的同名或等价工具
 *   - 优雅降级:npx 不可用 / 包未安装 / server 启动失败时不抛异常,
 *     返回 success=false + errorType=not_found + 安装提示命令
 *   - Windows 兼容:npx 是 .cmd 脚本,Node 出于安全禁止直接 spawn .cmd/.bat,
 *     需通过 `cmd /c npx ...` 间接拉起;Unix 直接 spawn npx
 *
 * 工具映射(本文件工具名 → @playwright/mcp 工具名):
 *   browser_navigate   → browser_navigate
 *   browser_click      → browser_click(需要 browser_get_text 快照中的 ref)
 *   browser_type       → browser_type(需要 ref)
 *   browser_screenshot → browser_take_screenshot
 *   browser_get_text   → browser_snapshot(无 selector)/ browser_evaluate(有 selector)
 *   browser_press_key  → browser_press_key
 *   browser_scroll     → browser_evaluate(window.scrollBy)
 *   browser_wait       → 本地 sleep(无需 MCP 参与)
 */

import {
  connectMcpServer,
  callMcpServer,
  disconnectMcpConnection,
  type McpConnection,
} from './mcp-runtime.js';
import type { McpServer } from '../commands/mcp-config.js';
// 注意:仅从 index.js 做类型导入(编译后擦除),避免 browser.ts ↔ index.ts 运行时循环依赖;
// 注册入口 registerBrowserTools 定义在 index.ts(跟随 lsp/memory 的模块加载注册模式)
import type { Tool, ToolResult } from './index.js';

/** @playwright/mcp 包名(带 latest tag,npx 按需拉取,无需预装) */
const PLAYWRIGHT_MCP_PACKAGE = '@playwright/mcp@latest';

/** 安装提示(优雅降级时返回给 LLM/用户,指导自助修复) */
const INSTALL_HINT =
  '请先安装依赖:npm install -g @playwright/mcp && npx playwright install chromium;' +
  '或确保 Node.js >= 20 且 npx 在 PATH 中(可手动运行 `npx -y @playwright/mcp@latest --stdio` 验证)。';

/** 文本输出截断上限(快照/正文可能很大,避免上下文膨胀) */
const MAX_OUTPUT_CHARS = 20_000;

/** browser_wait 最大等待时长(毫秒),防止 LLM 传入超大值阻塞会话 */
const MAX_WAIT_MS = 30_000;

// ==================== @playwright/mcp 连接定义与懒连接管理 ====================

// Windows:借 cmd /c 间接执行 npx(直接 spawn 'npx.cmd' 会因 Node 安全限制抛 EINVAL)
const IS_WINDOWS = process.platform === 'win32';

/** Playwright MCP server 定义(喂给 connectMcpServer,由 mcp-runtime 负责子进程与 JSON-RPC) */
const PLAYWRIGHT_MCP_SERVER: McpServer = IS_WINDOWS
  ? {
      name: 'playwright-mcp',
      command: 'cmd',
      args: ['/c', 'npx', '-y', PLAYWRIGHT_MCP_PACKAGE, '--stdio'],
      transport: 'stdio',
    }
  : {
      name: 'playwright-mcp',
      command: 'npx',
      args: ['-y', PLAYWRIGHT_MCP_PACKAGE, '--stdio'],
      transport: 'stdio',
    };

/** 进程内单例连接(懒连接:首次工具调用时才 spawn npx) */
let browserConn: McpConnection | null = null;
/** 并发去重:多个工具同时首次调用时,只发起一次连接 */
let connecting: Promise<McpConnection> | null = null;

/** 确保已连接 @playwright/mcp:已连接直接复用;未连接则建立单例连接(并发共享同一 Promise) */
async function ensureBrowserConnection(): Promise<McpConnection> {
  if (browserConn?.connected) return browserConn;
  if (!connecting) {
    connecting = connectMcpServer(PLAYWRIGHT_MCP_SERVER)
      .then((conn) => {
        browserConn = conn;
        return conn;
      })
      .finally(() => {
        connecting = null;
      });
  }
  return connecting;
}

/**
 * 断开并清理连接(不抛错)。
 * 两个用途:
 *   1. 工具调用失败时重置连接,下次调用自动重连
 *   2. 进程退出时清理子进程,避免遗留 npx/chromium 孤儿进程
 */
export function closeBrowserConnection(): void {
  if (browserConn) {
    try {
      disconnectMcpConnection(browserConn);
    } catch {
      // 忽略清理错误
    }
    browserConn = null;
  }
  connecting = null;
}

// 进程退出时清理 MCP 子进程(同步 kill,不阻塞退出)
process.once('exit', () => closeBrowserConnection());

// ==================== MCP 调用与结果格式化 ====================

/** 连接失败 → 统一的优雅降级错误结果(errorType=not_found,不可重试,直接引导安装) */
function mcpUnavailableResult(err: unknown): ToolResult {
  const detail = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    output: '',
    error: `无法启动浏览器自动化后端(@playwright/mcp):${detail}\n${INSTALL_HINT}`,
    errorType: 'not_found',
  };
}

/** 把 MCP tools/call 的返回内容({content:[...]})格式化为 ToolResult */
function formatMcpContent(raw: unknown): ToolResult {
  const r = raw as
    | { content?: Array<{ type: string; text?: string }>; isError?: boolean }
    | null;
  const texts: string[] = [];
  let imageCount = 0;
  for (const c of r?.content ?? []) {
    if (c.type === 'text' && c.text) texts.push(c.text);
    else if (c.type === 'image') imageCount++;
  }
  let output = texts.join('\n');
  if (imageCount > 0) {
    // 截图为二进制 image content,CLI 文本管线无法展示,提示 LLM 可用 filename 参数落盘
    output += `${output ? '\n' : ''}[截图已生成:返回 ${imageCount} 张图片(二进制内容已省略,可传 filename 参数保存到磁盘)]`;
  }
  if (!output) output = '(无文本输出)';
  if (output.length > MAX_OUTPUT_CHARS) {
    output = `${output.slice(0, MAX_OUTPUT_CHARS)}\n...(已截断,原文 ${output.length} 字符)`;
  }
  // Playwright MCP 用 isError 标记工具级失败(元素未找到等)
  if (r?.isError) {
    return { success: false, output, error: output, errorType: 'unknown' };
  }
  return { success: true, output };
}

/**
 * 通用调用入口:确保连接 → 校验 server 暴露目标工具 → tools/call → 格式化结果。
 * 调用失败时清理连接(下次调用自动重连),并把错误转为可读 ToolResult。
 */
async function callPlaywrightTool(
  mcpToolName: string,
  mcpArgs: Record<string, unknown>,
): Promise<ToolResult> {
  let conn: McpConnection;
  try {
    conn = await ensureBrowserConnection();
  } catch (err) {
    // npx 不可用 / 包未安装 / 启动超时等 → 优雅降级
    return mcpUnavailableResult(err);
  }
  // 工具集校验:不同版本 @playwright/mcp 暴露的工具可能不同(如旧版无 browser_wait_for)
  if (!conn.tools.some((t) => t.name === mcpToolName)) {
    return {
      success: false,
      output: '',
      error: `当前 @playwright/mcp 版本未提供 "${mcpToolName}" 工具,请升级:npm install -g ${PLAYWRIGHT_MCP_PACKAGE}`,
      errorType: 'not_found',
    };
  }
  try {
    const raw = await callMcpServer(conn, 'tools/call', {
      name: mcpToolName,
      arguments: mcpArgs,
    });
    return formatMcpContent(raw);
  } catch (err) {
    // 连接可能已死(子进程崩溃 / 请求超时),清理后下次调用重连
    closeBrowserConnection();
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      output: '',
      error: `浏览器工具调用失败(${mcpToolName}):${msg}`,
      errorType: msg.includes('超时') ? 'timeout' : 'network',
    };
  }
}

// ==================== 工具定义(8 个 browser_* 工具)====================

/** 导航到指定 URL(只读:不修改用户文件系统,仅浏览器状态) */
export const browser_navigate: Tool = {
  name: 'browser_navigate',
  description:
    '浏览器导航:在当前标签页打开指定 URL。通常是浏览器操作的第一步;导航后可用 browser_get_text 获取页面快照。',
  dangerLevel: 'read',
  parameters: {
    url: { type: 'string', description: '目标 URL(http/https,或 about:blank 打开空白页)' },
  },
  required: ['url'],
  async execute(args): Promise<ToolResult> {
    const url = String(args.url ?? '').trim();
    if (!url) {
      return { success: false, output: '', error: '缺少 url 参数' };
    }
    if (!/^(https?:\/\/|about:blank$)/i.test(url)) {
      return { success: false, output: '', error: '仅支持 http/https URL(或 about:blank)' };
    }
    return callPlaywrightTool('browser_navigate', { url });
  },
};

/** 点击页面元素(write:会改变页面状态,如提交表单/触发导航) */
export const browser_click: Tool = {
  name: 'browser_click',
  description:
    '点击页面元素。element 为元素的自然语言描述,ref 为元素引用 —— 两者均来自 browser_get_text 返回的可访问性快照(格式如 "e12")。',
  dangerLevel: 'write',
  parameters: {
    element: { type: 'string', description: '元素描述(来自快照,与 ref 配对使用)' },
    ref: { type: 'string', description: '元素 ref(来自快照,如 e12)' },
  },
  required: ['element', 'ref'],
  async execute(args): Promise<ToolResult> {
    const element = String(args.element ?? '').trim();
    const ref = String(args.ref ?? '').trim();
    if (!element || !ref) {
      return {
        success: false,
        output: '',
        error: '缺少 element/ref 参数(请先调用 browser_get_text 获取页面快照)',
      };
    }
    return callPlaywrightTool('browser_click', { element, ref });
  },
};

/** 在输入框中输入文本(write:会改变页面状态) */
export const browser_type: Tool = {
  name: 'browser_type',
  description:
    '在输入框中填入文本(先清空原值)。element/ref 来自 browser_get_text 快照;submit=true 时输入完按 Enter 提交。',
  dangerLevel: 'write',
  parameters: {
    element: { type: 'string', description: '元素描述(来自快照)' },
    ref: { type: 'string', description: '元素 ref(来自快照,如 e12)' },
    text: { type: 'string', description: '要输入的文本' },
    submit: { type: 'boolean', description: '输入完成后是否按 Enter 提交(默认 false)' },
  },
  required: ['element', 'ref', 'text'],
  async execute(args): Promise<ToolResult> {
    const element = String(args.element ?? '').trim();
    const ref = String(args.ref ?? '').trim();
    const text = String(args.text ?? '');
    if (!element || !ref) {
      return {
        success: false,
        output: '',
        error: '缺少 element/ref 参数(请先调用 browser_get_text 获取页面快照)',
      };
    }
    if (!text) {
      return { success: false, output: '', error: '缺少 text 参数' };
    }
    const mcpArgs: Record<string, unknown> = { element, ref, text };
    if (typeof args.submit === 'boolean') mcpArgs.submit = args.submit;
    return callPlaywrightTool('browser_type', mcpArgs);
  },
};

/** 截图(只读:仅捕获页面画面) */
export const browser_screenshot: Tool = {
  name: 'browser_screenshot',
  description:
    '截取当前页面截图。传 filename 时保存为图片文件(如 shot.png);不传仅返回图片数据(CLI 文本管线会省略二进制,建议传 filename)。',
  dangerLevel: 'read',
  parameters: {
    filename: {
      type: 'string',
      description: '截图保存文件名(可选,如 shot.png,保存到 MCP server 输出目录)',
    },
  },
  required: [],
  async execute(args): Promise<ToolResult> {
    const filename = args.filename !== undefined ? String(args.filename).trim() : '';
    return callPlaywrightTool(
      'browser_take_screenshot',
      filename ? { filename } : {},
    );
  },
};

/** 获取页面文本(只读):无 selector 返回整页可访问性快照(含 ref,供点击/输入使用) */
export const browser_get_text: Tool = {
  name: 'browser_get_text',
  description:
    '获取页面文本内容。不传 selector 时返回整页可访问性快照(包含各元素的 ref 引用,是 browser_click/browser_type 定位元素的依据);传 selector(CSS 选择器)时仅返回该元素的文本。',
  dangerLevel: 'read',
  parameters: {
    selector: {
      type: 'string',
      description: 'CSS 选择器(可选,如 "#main"、".content h1");不传则返回整页快照',
    },
  },
  required: [],
  async execute(args): Promise<ToolResult> {
    const selector = args.selector !== undefined ? String(args.selector).trim() : '';
    if (selector) {
      // 指定选择器 → 在页面上下文 evaluate,取该元素 innerText
      // 选择器经 JSON.stringify 转义,避免注入;元素不存在时返回提示而非报错
      const fn = `() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return '(选择器未匹配到元素)'; return el.innerText || el.textContent || ''; }`;
      return callPlaywrightTool('browser_evaluate', { function: fn });
    }
    // 未指定选择器 → 整页可访问性快照(Playwright MCP 标准定位流程)
    return callPlaywrightTool('browser_snapshot', {});
  },
};

/** 按键(write:会触发页面交互,如表单提交) */
export const browser_press_key: Tool = {
  name: 'browser_press_key',
  description: '在当前聚焦元素上按键(如 Enter、Tab、Escape、ArrowDown、a 等)。',
  dangerLevel: 'write',
  parameters: {
    key: { type: 'string', description: '键名(如 Enter / Tab / Escape / a)' },
  },
  required: ['key'],
  async execute(args): Promise<ToolResult> {
    const key = String(args.key ?? '').trim();
    if (!key) {
      return { success: false, output: '', error: '缺少 key 参数(如 Enter)' };
    }
    return callPlaywrightTool('browser_press_key', { key });
  },
};

/** 页面滚动(write:改变页面视口状态) */
export const browser_scroll: Tool = {
  name: 'browser_scroll',
  description: '滚动当前页面。direction 为 up/down,amount 为滚动像素(默认 500);返回滚动后的 scrollY。',
  dangerLevel: 'write',
  parameters: {
    direction: { type: 'string', description: '滚动方向', enum: ['up', 'down'] },
    amount: { type: 'number', description: '滚动像素数(默认 500)' },
  },
  required: ['direction'],
  async execute(args): Promise<ToolResult> {
    const direction = String(args.direction ?? '').trim();
    if (direction !== 'up' && direction !== 'down') {
      return { success: false, output: '', error: 'direction 仅支持 up/down' };
    }
    // clamp 到 [1, 100000],防止异常值
    const rawAmount = Number(args.amount ?? 500);
    const amount = Math.min(Math.max(Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount) : 500, 1), 100_000);
    const delta = direction === 'up' ? -amount : amount;
    // 通过页面内 evaluate 执行 window.scrollBy,并返回新的 scrollY
    const fn = `() => { window.scrollBy(0, ${delta}); return 'scrollY=' + Math.round(window.scrollY); }`;
    return callPlaywrightTool('browser_evaluate', { function: fn });
  },
};

/** 等待(只读:本地 sleep,不依赖 MCP,用于页面加载/动画过渡) */
export const browser_wait: Tool = {
  name: 'browser_wait',
  description: '等待指定毫秒数(1-30000,默认 1000),常用于等待页面加载或动画过渡。',
  dangerLevel: 'read',
  parameters: {
    ms: { type: 'number', description: '等待毫秒数(1-30000,默认 1000)' },
  },
  required: [],
  async execute(args): Promise<ToolResult> {
    const rawMs = Number(args.ms ?? 1000);
    const ms = Math.min(Math.max(Number.isFinite(rawMs) && rawMs > 0 ? Math.round(rawMs) : 1000, 1), MAX_WAIT_MS);
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { success: true, output: `已等待 ${ms}ms` };
  },
};

/** 浏览器工具集(由 index.ts 模块加载时注册,也供按需导入) */
export const BROWSER_TOOLS: Tool[] = [
  browser_navigate,
  browser_click,
  browser_type,
  browser_screenshot,
  browser_get_text,
  browser_press_key,
  browser_scroll,
  browser_wait,
];
