// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器自动化工具集 — 原生 Chrome DevTools Protocol (CDP) 真实实现。
 *
 * 对标 Codex/Claude Code 的 browser 工具,零新增依赖(仅用现有 ws@8.21.1 + Node 内置 http/fs):
 *   - 连接:优先 IHUI_BROWSER_CDP_URL(http://127.0.0.1:9222);否则探测已运行实例;
 *     都没有则自动发现 Chrome/Edge 可执行文件,以 --headless=new --remote-debugging-port 拉起
 *   - 工具:navigate / snapshot / screenshot / click / type / press_key / evaluate / close
 *   - 真实输入:click 用 Input.dispatchMouseEvent(坐标级),type 用 Input.insertText,
 *     press_key 用 Input.dispatchKeyEvent — 非 evaluate 伪造
 *   - 单例会话:进程内复用一条 ws 连接;browser_close 时关闭会话并终止自拉起的浏览器
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import type { Tool } from './index.js';

// ==================== CDP HTTP 发现层 ====================

const DEFAULT_CDP_PORT = 9222;

interface CdpTarget {
  id: string;
  type: string;
  url: string;
  title: string;
  webSocketDebuggerUrl?: string;
}

/** 对 CDP HTTP 端点发请求(用于 /json/version、/json/list、/json/new)。 */
function cdpHttpGet(
  port: number,
  pathname: string,
  method: 'GET' | 'PUT' = 'GET',
  host = '127.0.0.1',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path: pathname, method }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          reject(new Error(`CDP HTTP ${status} ${pathname}`));
        } else {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('CDP HTTP 请求超时')));
    req.end();
  });
}

/** 发现系统上的 Chrome/Edge/Chromium 可执行文件(Windows/macOS/Linux 常见路径)。 */
export function findChromeExecutable(): string | undefined {
  if (process.env.IHUI_BROWSER_EXECUTABLE) return process.env.IHUI_BROWSER_EXECUTABLE;
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    const lp = process.env['LOCALAPPDATA'] ?? '';
    candidates.push(
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${lp}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${lp}\\Microsoft\\Edge\\Application\\msedge.exe`,
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
    );
  }
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // 忽略探测异常,继续尝试下一个
    }
  }
  return undefined;
}

// ==================== CDP WebSocket 会话层 ====================

/** 单条 CDP ws 连接:send(id 匹配) + waitEvent(事件等待)。 */
class CdpSession {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  private eventWaiters = new Map<
    string,
    Array<{ predicate?: (p: Record<string, unknown>) => boolean; resolve: (v: unknown) => void; timer: NodeJS.Timeout }>
  >();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (data: WebSocket.RawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      if (typeof msg.id === 'number') {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.error) {
            const em = (msg.error as { message?: string }).message ?? JSON.stringify(msg.error);
            p.reject(new Error(`CDP ${em}`));
          } else {
            p.resolve(msg.result);
          }
        }
        return;
      }
      if (typeof msg.method === 'string') {
        const waiters = this.eventWaiters.get(msg.method);
        if (waiters && waiters.length > 0) {
          const params = (msg.params ?? {}) as Record<string, unknown>;
          const idx = waiters.findIndex((w) => !w.predicate || w.predicate(params));
          if (idx >= 0) {
            const w = waiters.splice(idx, 1)[0]!;
            clearTimeout(w.timer);
            w.resolve(params);
          }
        }
      }
    });
  }

  /** 建立连接并启用 Page/Runtime 域。 */
  static async connect(wsUrl: string): Promise<CdpSession> {
    const ws = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket 连接超时')), 10_000);
      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    const session = new CdpSession(ws);
    await session.send('Page.enable').catch(() => {});
    await session.send('Runtime.enable').catch(() => {});
    return session;
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  /** 发送 CDP 命令并等待结果(带超时)。 */
  send<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = 30_000,
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} 超时(${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer,
      });
      this.ws.send(JSON.stringify({ id, method, params: params ?? {} }), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  /** 等待指定 CDP 事件(可带谓词过滤),超时抛错。 */
  waitEvent(
    method: string,
    predicate?: (p: Record<string, unknown>) => boolean,
    timeoutMs = 60_000,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const list = this.eventWaiters.get(method);
        const idx = list?.findIndex((w) => w.resolve === wrapped);
        if (list && idx !== undefined && idx >= 0) list.splice(idx, 1);
        reject(new Error(`等待 CDP 事件 ${method} 超时`));
      }, timeoutMs);
      const wrapped = (v: unknown) => resolve(v as Record<string, unknown>);
      const list = this.eventWaiters.get(method) ?? [];
      list.push({ predicate, resolve: wrapped, timer });
      this.eventWaiters.set(method, list);
    });
  }

  /** 关闭连接(不关浏览器进程)。 */
  close(): void {
    try {
      this.ws.close();
    } catch {
      // 忽略
    }
  }
}

// ==================== 浏览器生命周期管理(进程内单例) ====================

let activeSession: CdpSession | undefined;
let spawnedChild: ChildProcess | undefined;
let spawnedPort: number | undefined;

interface ResolvedEndpoint {
  port: number;
  host: string;
}

/** 解析 CDP 端点:优先 IHUI_BROWSER_CDP_URL,否则默认 127.0.0.1:9222。 */
function resolveEndpoint(): ResolvedEndpoint {
  const raw = process.env.IHUI_BROWSER_CDP_URL;
  if (raw) {
    try {
      const u = new URL(raw);
      const port = Number.parseInt(u.port, 10);
      if (Number.isFinite(port) && port > 0) {
        return { port, host: u.hostname || '127.0.0.1' };
      }
    } catch {
      // 非法 URL 落回默认端口
    }
  }
  return { port: DEFAULT_CDP_PORT, host: '127.0.0.1' };
}

/** CDP 端口是否已有可用实例。 */
async function isCdpAlive(port: number, host: string): Promise<boolean> {
  try {
    await cdpHttpGet(port, '/json/version', 'GET', host);
    return true;
  } catch {
    return false;
  }
}

/** 自动拉起 Chrome/Edge headless 并等待 CDP 就绪。 */
async function spawnBrowser(port: number): Promise<void> {
  const executable = findChromeExecutable();
  if (!executable) {
    throw new Error(
      '未找到 Chrome/Edge 可执行文件。请安装 Chrome,或设置 IHUI_BROWSER_EXECUTABLE 指向浏览器路径,' +
        `或手动以 --remote-debugging-port=${port} 启动浏览器后设置 IHUI_BROWSER_CDP_URL=http://127.0.0.1:${port}`,
    );
  }
  const userDataDir = path.join(os.tmpdir(), `ihui-cli-browser-${port}`);
  const headless = process.env.IHUI_BROWSER_HEADLESS !== 'false';
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
  ];
  if (headless) args.push('--headless=new', '--hide-scrollbars', '--window-size=1440,900');
  spawnedChild = spawn(executable, args, { stdio: 'ignore', detached: false });
  spawnedChild.on('error', () => {
    spawnedChild = undefined;
  });
  spawnedPort = port;
  // 轮询等待 CDP 就绪(最多 15s)
  for (let i = 0; i < 30; i++) {
    if (await isCdpAlive(port, '127.0.0.1')) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`浏览器已拉起但 CDP 端口 ${port} 未就绪(15s 超时)`);
}

/** 取一个 page 目标的 ws 调试地址(无 page 则新建)。 */
async function acquirePageWsUrl(port: number, host: string): Promise<string> {
  const listRaw = await cdpHttpGet(port, '/json/list', 'GET', host);
  const targets = JSON.parse(listRaw) as CdpTarget[];
  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
  // Chrome 111+ 要求 PUT
  const createdRaw = await cdpHttpGet(port, '/json/new?url=about:blank', 'PUT', host);
  const created = JSON.parse(createdRaw) as CdpTarget;
  if (!created.webSocketDebuggerUrl) {
    throw new Error('CDP /json/new 未返回 webSocketDebuggerUrl');
  }
  return created.webSocketDebuggerUrl;
}

/** 获取(必要时创建)可用的 CDP 会话。 */
async function getBrowserSession(): Promise<{ session: CdpSession; port: number }> {
  if (activeSession?.isOpen) {
    return { session: activeSession, port: spawnedPort ?? resolveEndpoint().port };
  }
  activeSession?.close();
  activeSession = undefined;
  const ep = resolveEndpoint();
  if (!(await isCdpAlive(ep.port, ep.host))) {
    if (ep.host !== '127.0.0.1') {
      throw new Error(`IHUI_BROWSER_CDP_URL 指定的 ${ep.host}:${ep.port} 不可达`);
    }
    await spawnBrowser(ep.port);
  }
  const wsUrl = await acquirePageWsUrl(ep.port, ep.host);
  const session = await CdpSession.connect(wsUrl);
  activeSession = session;
  return { session, port: ep.port };
}

/** 页面内一次性取 title/url/可见文本/交互元素大纲(供 LLM 选择器决策)。 */
async function collectPageSnapshot(
  session: CdpSession,
  textLimit: number,
): Promise<{ title: string; url: string; text: string; outline: string[] }> {
  const expression = `(() => {
    const interactive = [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')]
      .slice(0, 60)
      .map((el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? '#' + el.id : '';
        const name = el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '';
        const label = ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) ? el.value : el.textContent) ?? '';
        return tag + id + name + ': ' + label.trim().replace(/\\s+/g, ' ').slice(0, 60);
      })
      .filter((s) => s.length > 3);
    return JSON.stringify({
      title: document.title,
      url: location.href,
      text: (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, ${textLimit}),
      outline: interactive,
    });
  })()`;
  const res = await session.send<{ result: { value?: string }; exceptionDetails?: unknown }>(
    'Runtime.evaluate',
    { expression, returnByValue: true },
  );
  if (res.exceptionDetails) {
    throw new Error(`页面快照执行失败: ${JSON.stringify(res.exceptionDetails).slice(0, 300)}`);
  }
  const parsed = JSON.parse(res.result.value ?? '{}') as {
    title?: string;
    url?: string;
    text?: string;
    outline?: string[];
  };
  return {
    title: parsed.title ?? '',
    url: parsed.url ?? '',
    text: parsed.text ?? '',
    outline: parsed.outline ?? [],
  };
}

// ==================== 工具参数解析小工具 ====================

function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`缺少必填参数 ${key}(string)`);
  }
  return v;
}

function ok(output: string): { success: true; output: string } {
  return { success: true, output };
}

function fail(error: unknown, errorType = 'unknown'): { success: false; output: string; error: string; errorType: string } {
  return {
    success: false,
    output: '',
    error: error instanceof Error ? error.message : String(error),
    errorType,
  };
}

// ==================== 浏览器工具集 ====================

const browserNavigate: Tool = {
  name: 'browser_navigate',
  description:
    '在浏览器中打开指定 URL,等待页面加载完成,返回页面标题与最终 URL。浏览器未运行时自动以 headless 模式拉起 Chrome/Edge。',
  parameters: {
    url: { type: 'string', description: '要打开的完整 URL(含 https:// 前缀)' },
  },
  required: ['url'],
  dangerLevel: 'write',
  async execute(args) {
    try {
      const url = requireString(args, 'url');
      const { session } = await getBrowserSession();
      await session.send('Page.navigate', { url }, 60_000);
      try {
        await session.waitEvent('Page.loadEventFired', undefined, 60_000);
      } catch {
        // 单页应用/重定向可能不触发 load,不视为失败,继续取快照
      }
      const snap = await collectPageSnapshot(session, 1500);
      return ok(`已打开 ${snap.url}\n标题: ${snap.title}\n\n${snap.text}`);
    } catch (err) {
      return fail(err, 'network');
    }
  },
};

const browserSnapshot: Tool = {
  name: 'browser_snapshot',
  description:
    '获取当前浏览器页面的可读快照:标题、URL、可见文本(截断)与交互元素大纲(a/button/input 等,含 id/name 定位线索),用于后续 click/type 选择器决策。',
  parameters: {
    text_limit: { type: 'number', description: '可见文本最大字符数,默认 4000' },
  },
  required: [],
  dangerLevel: 'read',
  async execute(args) {
    try {
      const { session } = await getBrowserSession();
      const textLimit = Math.min(Math.max(Number(args.text_limit) || 4000, 200), 20_000);
      const snap = await collectPageSnapshot(session, textLimit);
      const outline = snap.outline.length > 0 ? `\n交互元素:\n${snap.outline.map((s) => `- ${s}`).join('\n')}` : '';
      return ok(`标题: ${snap.title}\nURL: ${snap.url}\n\n${snap.text}${outline}`);
    } catch (err) {
      return fail(err);
    }
  },
};

const browserScreenshot: Tool = {
  name: 'browser_screenshot',
  description:
    '对当前浏览器页面截图并保存为 PNG 文件,返回文件路径。默认保存到工作区 .ihui/screenshots/ 下。',
  parameters: {
    save_path: { type: 'string', description: 'PNG 保存路径(可选,默认 .ihui/screenshots/browser-<时间戳>.png)' },
    full_page: { type: 'boolean', description: '是否截取整页滚动内容,默认 false(仅视口)' },
  },
  required: [],
  dangerLevel: 'read',
  async execute(args, ctx) {
    try {
      const { session } = await getBrowserSession();
      const fullPage = args.full_page === true;
      const metrics = await session.send<{ contentSize: { width: number; height: number } }>(
        'Page.getLayoutMetrics',
        {},
        15_000,
      );
      if (fullPage) {
        await session.send('Emulation.setDeviceMetricsOverride', {
          width: Math.ceil(metrics.contentSize.width),
          height: Math.ceil(metrics.contentSize.height),
          deviceScaleFactor: 1,
          mobile: false,
        });
      }
      const shot = await session.send<{ data: string }>('Page.captureScreenshot', { format: 'png' }, 30_000);
      if (fullPage) {
        await session.send('Emulation.clearDeviceMetricsOverride');
      }
      const savePath =
        typeof args.save_path === 'string' && args.save_path.length > 0
          ? path.resolve(ctx.workspacePath, args.save_path)
          : path.join(ctx.workspacePath, '.ihui', 'screenshots', `browser-${Date.now()}.png`);
      fs.mkdirSync(path.dirname(savePath), { recursive: true });
      fs.writeFileSync(savePath, Buffer.from(shot.data, 'base64'));
      const size = fs.statSync(savePath).size;
      return ok(`截图已保存: ${savePath}(${(size / 1024).toFixed(1)} KB${fullPage ? ', 整页' : ''})`);
    } catch (err) {
      return fail(err);
    }
  },
};

const browserClick: Tool = {
  name: 'browser_click',
  description:
    '在当前页面点击元素。用 CSS 选择器定位,自动滚动到可见区域,并以真实鼠标事件(Input.dispatchMouseEvent)在元素中心按下并释放。',
  parameters: {
    selector: { type: 'string', description: '目标元素的 CSS 选择器,如 #submit-btn 或 a.login' },
  },
  required: ['selector'],
  dangerLevel: 'write',
  async execute(args) {
    try {
      const selector = requireString(args, 'selector');
      const { session } = await getBrowserSession();
      const expression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height });
      })()`;
      const res = await session.send<{ result: { value?: string | null }; exceptionDetails?: unknown }>(
        'Runtime.evaluate',
        { expression, returnByValue: true },
      );
      if (!res.result.value) {
        return fail(new Error(`元素不存在: ${selector}`), 'not_found');
      }
      const box = JSON.parse(res.result.value) as { x: number; y: number; w: number; h: number };
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      await session.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: cx,
        y: cy,
        button: 'left',
        buttons: 1,
        clickCount: 1,
      });
      await session.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: cx,
        y: cy,
        button: 'left',
        buttons: 0,
        clickCount: 1,
      });
      await new Promise((r) => setTimeout(r, 300));
      const snap = await collectPageSnapshot(session, 800);
      return ok(`已点击 ${selector}(中心坐标 ${Math.round(cx)},${Math.round(cy)})\n当前页面: ${snap.url} — ${snap.title}`);
    } catch (err) {
      return fail(err);
    }
  },
};

const browserType: Tool = {
  name: 'browser_type',
  description:
    '向输入框输入文本。用 CSS 选择器定位,聚焦后以真实键盘事件(Input.insertText)输入;可选先清空已有内容。',
  parameters: {
    selector: { type: 'string', description: '目标输入元素的 CSS 选择器' },
    text: { type: 'string', description: '要输入的文本' },
    clear: { type: 'boolean', description: '输入前是否清空已有内容,默认 false' },
  },
  required: ['selector', 'text'],
  dangerLevel: 'write',
  async execute(args) {
    try {
      const selector = requireString(args, 'selector');
      const text = requireString(args, 'text');
      const { session } = await getBrowserSession();
      const focusExpr = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.focus();
        return true;
      })()`;
      const res = await session.send<{ result: { value?: unknown } }>('Runtime.evaluate', {
        expression: focusExpr,
        returnByValue: true,
      });
      if (res.result.value !== true) {
        return fail(new Error(`元素不存在或不可聚焦: ${selector}`), 'not_found');
      }
      if (args.clear === true) {
        await session.send('Runtime.evaluate', {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (el && ('value' in el)) {
              el.value = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          })()`,
        });
      }
      await session.send('Input.insertText', { text });
      await new Promise((r) => setTimeout(r, 150));
      const valueRes = await session.send<{ result: { value?: string } }>('Runtime.evaluate', {
        expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el && ('value' in el) ? el.value : document.body.innerText.slice(0, 200); })()`,
        returnByValue: true,
      });
      return ok(`已向 ${selector} 输入 ${text.length} 字符\n当前值: ${String(valueRes.result.value ?? '').slice(0, 120)}`);
    } catch (err) {
      return fail(err);
    }
  },
};

const KEY_MAP: Record<string, { code: string; vk: number; text?: string }> = {
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Tab: { code: 'Tab', vk: 9 },
  Escape: { code: 'Escape', vk: 27 },
  Backspace: { code: 'Backspace', vk: 8 },
  Delete: { code: 'Delete', vk: 46 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
  ArrowLeft: { code: 'ArrowLeft', vk: 37 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
  Home: { code: 'Home', vk: 36 },
  End: { code: 'End', vk: 35 },
  PageUp: { code: 'PageUp', vk: 33 },
  PageDown: { code: 'PageDown', vk: 34 },
};

const browserPressKey: Tool = {
  name: 'browser_press_key',
  description:
    '向当前聚焦元素发送真实按键事件。支持 Enter/Tab/Escape/Backspace/Delete/ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Home/End/PageUp/PageDown。',
  parameters: {
    key: { type: 'string', description: '按键名(见工具描述中的支持列表)' },
    selector: { type: 'string', description: '可选:先聚焦该 CSS 选择器元素再按键' },
  },
  required: ['key'],
  dangerLevel: 'write',
  async execute(args) {
    try {
      const key = requireString(args, 'key');
      const mapped = KEY_MAP[key];
      if (!mapped) {
        return fail(
          new Error(`不支持的按键: ${key}。支持: ${Object.keys(KEY_MAP).join(', ')}`),
          'not_found',
        );
      }
      const { session } = await getBrowserSession();
      if (typeof args.selector === 'string' && args.selector.length > 0) {
        await session.send('Runtime.evaluate', {
          expression: `document.querySelector(${JSON.stringify(args.selector)})?.focus()`,
        });
      }
      await session.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key,
        code: mapped.code,
        windowsVirtualKeyCode: mapped.vk,
      });
      if (mapped.text) {
        await session.send('Input.dispatchKeyEvent', {
          type: 'char',
          key,
          code: mapped.code,
          windowsVirtualKeyCode: mapped.vk,
          text: mapped.text,
          unmodifiedText: mapped.text,
        });
      }
      await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code: mapped.code,
        windowsVirtualKeyCode: mapped.vk,
      });
      return ok(`已发送按键 ${key}`);
    } catch (err) {
      return fail(err);
    }
  },
};

const browserEvaluate: Tool = {
  name: 'browser_evaluate',
  description:
    '在当前页面执行任意 JavaScript 表达式并返回结果(自动 await Promise)。可用于读取 DOM 状态、调用页面 API、验证页面数据。',
  parameters: {
    expression: { type: 'string', description: '要执行的 JavaScript 表达式(在页面主世界执行,可返回值)' },
  },
  required: ['expression'],
  dangerLevel: 'write',
  async execute(args) {
    try {
      const expression = requireString(args, 'expression');
      const { session } = await getBrowserSession();
      const res = await session.send<{ result: { type: string; value?: unknown }; exceptionDetails?: { text: string; exception?: { description?: string } } }>(
        'Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true },
        60_000,
      );
      if (res.exceptionDetails) {
        const desc = res.exceptionDetails.exception?.description ?? res.exceptionDetails.text;
        return fail(new Error(`页面脚本异常: ${desc.slice(0, 500)}`));
      }
      const { type, value } = res.result;
      const output =
        value === undefined ? `(返回 ${type})` : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      return ok(String(output).slice(0, 10_000));
    } catch (err) {
      return fail(err);
    }
  },
};

const browserClose: Tool = {
  name: 'browser_close',
  description: '关闭当前浏览器会话。若浏览器是由本工具自动拉起的,会一并终止该浏览器进程。',
  parameters: {},
  required: [],
  dangerLevel: 'write',
  async execute() {
    try {
      if (activeSession) {
        // Browser.close 直接优雅退出浏览器进程
        await activeSession.send('Browser.close', {}, 5000).catch(() => {});
        activeSession.close();
        activeSession = undefined;
      }
      if (spawnedChild) {
        try {
          spawnedChild.kill();
        } catch {
          // 忽略
        }
        spawnedChild = undefined;
        spawnedPort = undefined;
        return ok('浏览器会话已关闭,自拉起的浏览器进程已终止');
      }
      return ok('浏览器会话已关闭(外部浏览器实例保持运行)');
    } catch (err) {
      return fail(err);
    }
  },
};

/** 浏览器自动化工具集(真实 CDP 实现)。 */
export const BROWSER_TOOLS: Tool[] = [
  browserNavigate,
  browserSnapshot,
  browserScreenshot,
  browserClick,
  browserType,
  browserPressKey,
  browserEvaluate,
  browserClose,
];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
