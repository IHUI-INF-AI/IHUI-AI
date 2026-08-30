/**
 * 浏览器自动化工具测试 — mock MCP 连接(不真正 spawn npx 子进程)。
 *
 * 覆盖点:
 *   1. BROWSER_TOOLS 注册:8 个工具、名称、危险级别(read/write 分级)
 *   2. 参数校验:缺少必填参数 / 非法 URL / 非法方向等本地拦截
 *   3. 成功调用:转发到对应 @playwright/mcp 工具 + 参数映射
 *   4. 连接管理:懒连接、单例复用、失败重置后自动重连
 *   5. 优雅降级:MCP 启动失败 → errorType=not_found + 安装提示;
 *      server 未暴露目标工具 → not_found + 升级提示
 *   6. 结果格式化:isError 转失败、图片内容省略提示、文本截断
 *   7. browser_wait:本地 sleep,不触发 MCP 连接
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';

// mock mcp-runtime:拦截 connectMcpServer/callMcpServer/disconnectMcpConnection,
// 避免测试真正 spawn npx @playwright/mcp 子进程
vi.mock('../src/tools/mcp-runtime.js', () => ({
  connectMcpServer: vi.fn(),
  callMcpServer: vi.fn(),
  disconnectMcpConnection: vi.fn(),
}));

import {
  connectMcpServer,
  callMcpServer,
  disconnectMcpConnection,
  type McpConnection,
} from '../src/tools/mcp-runtime.js';
import {
  BROWSER_TOOLS,
  browser_navigate,
  browser_click,
  browser_type,
  browser_screenshot,
  browser_get_text,
  browser_press_key,
  browser_scroll,
  browser_wait,
  closeBrowserConnection,
} from '../src/tools/browser.js';
import { getTool, clearTools, registerBrowserTools } from '../src/tools/index.js';

/** @playwright/mcp 常见工具全集(用于构造"完整版" mock 连接) */
const ALL_MCP_TOOLS = [
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_take_screenshot',
  'browser_snapshot',
  'browser_press_key',
  'browser_evaluate',
  'browser_wait_for',
];

/** 构造 mock McpConnection(不真正连接,tools 列表可控) */
function makeMockConn(toolNames: string[]): McpConnection {
  return {
    server: { name: 'playwright-mcp', transport: 'stdio' },
    tools: toolNames.map((name) => ({ name, inputSchema: { type: 'object' as const } })),
    connected: true,
    transport: 'stdio',
    ssePending: new Map(),
    sseNextId: 1,
  };
}

/** mock 一次成功的 tools/call 文本响应 */
function mockTextResponse(text: string, isError = false): void {
  vi.mocked(callMcpServer).mockResolvedValue({
    content: [{ type: 'text', text }],
    ...(isError ? { isError: true } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // 重置模块级连接单例,避免用例间串扰
  closeBrowserConnection();
});

describe('BROWSER_TOOLS 注册', () => {
  it('包含 8 个 browser_* 工具', () => {
    expect(BROWSER_TOOLS.map((t) => t.name)).toEqual([
      'browser_navigate',
      'browser_click',
      'browser_type',
      'browser_screenshot',
      'browser_get_text',
      'browser_press_key',
      'browser_scroll',
      'browser_wait',
    ]);
  });

  it('危险级别:只读工具 read,操作工具 write', () => {
    const levels = Object.fromEntries(BROWSER_TOOLS.map((t) => [t.name, t.dangerLevel]));
    expect(levels.browser_navigate).toBe('read');
    expect(levels.browser_screenshot).toBe('read');
    expect(levels.browser_get_text).toBe('read');
    expect(levels.browser_wait).toBe('read');
    expect(levels.browser_click).toBe('write');
    expect(levels.browser_type).toBe('write');
    expect(levels.browser_press_key).toBe('write');
    expect(levels.browser_scroll).toBe('write');
  });

  it('registerBrowserTools 注册到全局工具注册器', () => {
    clearTools();
    registerBrowserTools();
    expect(getTool('browser_navigate')).toBeDefined();
    expect(getTool('browser_click')).toBeDefined();
    expect(getTool('browser_wait')).toBeDefined();
  });
});

describe('参数校验(本地拦截,不触发 MCP)', () => {
  it('browser_navigate 缺少 url / 非法协议被拒绝', async () => {
    const r1 = await browser_navigate.execute({}, { workspacePath: '.' });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain('url');
    const r2 = await browser_navigate.execute({ url: 'ftp://example.com' }, { workspacePath: '.' });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('http/https');
    expect(connectMcpServer).not.toHaveBeenCalled();
  });

  it('browser_click 缺少 ref 时提示先获取快照', async () => {
    const r = await browser_click.execute({ element: '登录按钮' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('browser_get_text');
  });

  it('browser_type 缺少 text 被拒绝', async () => {
    const r = await browser_type.execute({ element: '搜索框', ref: 'e3' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('text');
  });

  it('browser_press_key 缺少 key 被拒绝', async () => {
    const r = await browser_press_key.execute({}, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('key');
  });

  it('browser_scroll 非法方向被拒绝', async () => {
    const r = await browser_scroll.execute({ direction: 'left' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('up/down');
  });
});

describe('MCP 调用转发(mock 连接)', () => {
  beforeEach(() => {
    vi.mocked(connectMcpServer).mockResolvedValue(makeMockConn(ALL_MCP_TOOLS));
  });

  it('browser_navigate 成功:转发到 MCP browser_navigate 且参数映射正确', async () => {
    mockTextResponse('已导航到 https://example.com');
    const r = await browser_navigate.execute({ url: 'https://example.com' }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toContain('example.com');
    expect(callMcpServer).toHaveBeenCalledWith(
      expect.anything(),
      'tools/call',
      { name: 'browser_navigate', arguments: { url: 'https://example.com' } },
    );
  });

  it('browser_type 透传 submit 参数', async () => {
    mockTextResponse('已输入');
    await browser_type.execute(
      { element: '搜索框', ref: 'e3', text: 'hello', submit: true },
      { workspacePath: '.' },
    );
    expect(callMcpServer).toHaveBeenCalledWith(
      expect.anything(),
      'tools/call',
      { name: 'browser_type', arguments: { element: '搜索框', ref: 'e3', text: 'hello', submit: true } },
    );
  });

  it('browser_get_text 无 selector 走 browser_snapshot', async () => {
    mockTextResponse('- button "登录" [ref=e12]');
    const r = await browser_get_text.execute({}, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(callMcpServer).toHaveBeenCalledWith(
      expect.anything(),
      'tools/call',
      { name: 'browser_snapshot', arguments: {} },
    );
  });

  it('browser_get_text 有 selector 走 browser_evaluate 且选择器已转义', async () => {
    mockTextResponse('正文内容');
    await browser_get_text.execute({ selector: '#main' }, { workspacePath: '.' });
    expect(callMcpServer).toHaveBeenCalledTimes(1);
    const params = vi.mocked(callMcpServer).mock.calls[0]![2] as { name: string; arguments: { function: string } };
    expect(params.name).toBe('browser_evaluate');
    expect(params.arguments.function).toContain('document.querySelector("#main")');
  });

  it('browser_scroll 构造 scrollBy:down 为正(默认 500),up 为负', async () => {
    mockTextResponse('scrollY=500');
    await browser_scroll.execute({ direction: 'down' }, { workspacePath: '.' });
    await browser_scroll.execute({ direction: 'up', amount: 300 }, { workspacePath: '.' });
    const fn1 = (vi.mocked(callMcpServer).mock.calls[0]![2] as { arguments: { function: string } }).arguments.function;
    const fn2 = (vi.mocked(callMcpServer).mock.calls[1]![2] as { arguments: { function: string } }).arguments.function;
    expect(fn1).toContain('window.scrollBy(0, 500)');
    expect(fn2).toContain('window.scrollBy(0, -300)');
  });

  it('browser_screenshot 返回图片内容时输出省略提示', async () => {
    vi.mocked(callMcpServer).mockResolvedValue({
      content: [{ type: 'image', data: 'aGk=', mimeType: 'image/png' }],
    });
    const r = await browser_screenshot.execute({}, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toContain('图片');
    expect(r.output).toContain('filename');
  });

  it('MCP 返回 isError=true 时转失败', async () => {
    mockTextResponse('元素未找到', true);
    const r = await browser_click.execute({ element: '登录按钮', ref: 'e99' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('元素未找到');
  });

  it('超长输出被截断', async () => {
    mockTextResponse('x'.repeat(25_000));
    const r = await browser_get_text.execute({}, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output.length).toBeLessThan(21_100);
    expect(r.output).toContain('已截断');
  });
});

describe('连接管理', () => {
  it('懒连接:多次调用复用同一连接(只 connect 一次)', async () => {
    vi.mocked(connectMcpServer).mockResolvedValue(makeMockConn(ALL_MCP_TOOLS));
    mockTextResponse('ok');
    await browser_navigate.execute({ url: 'https://a.com' }, { workspacePath: '.' });
    await browser_press_key.execute({ key: 'Enter' }, { workspacePath: '.' });
    await browser_get_text.execute({}, { workspacePath: '.' });
    expect(connectMcpServer).toHaveBeenCalledTimes(1);
    expect(callMcpServer).toHaveBeenCalledTimes(3);
  });

  it('调用失败时断开连接,下次调用自动重连', async () => {
    vi.mocked(connectMcpServer).mockResolvedValue(makeMockConn(ALL_MCP_TOOLS));
    vi.mocked(callMcpServer).mockRejectedValueOnce(new Error('连接中断'));
    const r1 = await browser_navigate.execute({ url: 'https://a.com' }, { workspacePath: '.' });
    expect(r1.success).toBe(false);
    expect(r1.errorType).toBe('network');
    expect(disconnectMcpConnection).toHaveBeenCalled();

    mockTextResponse('ok');
    const r2 = await browser_navigate.execute({ url: 'https://a.com' }, { workspacePath: '.' });
    expect(r2.success).toBe(true);
    expect(connectMcpServer).toHaveBeenCalledTimes(2);
  });

  it('超时类错误映射为 errorType=timeout', async () => {
    vi.mocked(connectMcpServer).mockResolvedValue(makeMockConn(ALL_MCP_TOOLS));
    vi.mocked(callMcpServer).mockRejectedValueOnce(new Error('MCP 请求超时: tools/call (10000ms)'));
    const r = await browser_navigate.execute({ url: 'https://a.com' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('timeout');
  });
});

describe('优雅降级', () => {
  it('MCP server 启动失败 → errorType=not_found + 安装提示命令', async () => {
    vi.mocked(connectMcpServer).mockRejectedValue(new Error('spawn npx ENOENT'));
    const r = await browser_navigate.execute({ url: 'https://example.com' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('not_found');
    expect(r.error).toContain('npm install -g @playwright/mcp');
    expect(r.error).toContain('npx playwright install chromium');
    // 连接失败不应触发 tools/call
    expect(callMcpServer).not.toHaveBeenCalled();
  });

  it('server 未暴露目标工具 → not_found + 升级提示', async () => {
    // 旧版本 server 只提供 browser_navigate,无截图工具
    vi.mocked(connectMcpServer).mockResolvedValue(makeMockConn(['browser_navigate']));
    const r = await browser_screenshot.execute({ filename: 'a.png' }, { workspacePath: '.' });
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('not_found');
    expect(r.error).toContain('browser_take_screenshot');
    expect(r.error).toContain('@playwright/mcp@latest');
  });

  it('降级后不残留连接状态:修复后可恢复(重连成功)', async () => {
    vi.mocked(connectMcpServer)
      .mockRejectedValueOnce(new Error('spawn npx ENOENT'))
      .mockResolvedValueOnce(makeMockConn(ALL_MCP_TOOLS));
    const r1 = await browser_navigate.execute({ url: 'https://a.com' }, { workspacePath: '.' });
    expect(r1.success).toBe(false);
    mockTextResponse('ok');
    const r2 = await browser_navigate.execute({ url: 'https://a.com' }, { workspacePath: '.' });
    expect(r2.success).toBe(true);
  });
});

describe('browser_wait(本地等待)', () => {
  it('等待指定毫秒且不触发 MCP 连接', async () => {
    const start = Date.now();
    const r = await browser_wait.execute({ ms: 60 }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toContain('60');
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
    expect(connectMcpServer).not.toHaveBeenCalled();
    expect(callMcpServer).not.toHaveBeenCalled();
  });

  it('非法 ms(负数)被 clamp 到下限 1ms', async () => {
    const r = await browser_wait.execute({ ms: -5 }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(r.output).toContain('1ms');
  });
});
