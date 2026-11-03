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
 *   - 语义句柄:snapshot 给每个出表交互元素发会话级 ref(e1/e2…),click/type 可直接按 ref 定位;
 *     同一文档内同一元素同 ref,页面导航后旧 ref 显式失效(报错要求重新快照,绝不静默点错)
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
import { checkNavigableUrl } from '@ihui/shared/utils/navigable-url';
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
export class CdpSession {
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
  const baseArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
  ];
  if (headless) baseArgs.push('--headless=new', '--hide-scrollbars', '--window-size=1440,900');

  // 就绪等待默认 30s/腿(2026-10-28 由 15s 调大)。依据是 CI 一手读数:ubuntu runner 上
  // `浏览器已拉起但 CDP 端口 9222 未就绪(15s 超时)` —— 两腿各 15s,首启建 profile 本身就吃掉
  // 十几秒,于是结论永远落在"没等完就先放弃"的窗口里。这里只让基础设施的时间,判据一位未动:
  // 到点仍按未就绪报错,并把子进程退出与 stderr 尾行一起带出(见 launch/throw)。
  const waitMs = Number(process.env.IHUI_BROWSER_CDP_WAIT_MS ?? 30_000);
  let launchFailure: string | null = null;
  let lastExit: string | null = null;
  let stderrTail = '';

  const waitCdpReady = async (): Promise<boolean> => {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      if (await isCdpAlive(port, '127.0.0.1')) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  };

  const launch = (extraArgs: string[]): void => {
    launchFailure = null;
    lastExit = null;
    stderrTail = '';
    const child = spawn(executable, [...baseArgs, ...extraArgs], {
      // stdio 原为 'ignore':Chrome 的启动失败原因只写 stderr,吞掉以后"端口没起来"就成了
      // 一句没有任何一手线索可查的裸断言(§12f:判据失效的表现永远是安静)。stderr 改 pipe,
      // stdout 仍丢——本工具从不读它,留着只会撞 §12g 那条"丢了又去读"的反面判据。
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
      detached: false,
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-1200);
    });
    child.on('error', (e) => {
      launchFailure = e.message;
      spawnedChild = undefined;
    });
    child.on('exit', (code, signal) => {
      lastExit = `code=${code ?? 'null'} signal=${signal ?? 'null'}`;
    });
    spawnedChild = child;
    spawnedPort = port;
  };

  const stopSpawned = (): void => {
    if (spawnedChild) {
      try {
        spawnedChild.kill();
      } catch {
        // 忽略
      }
      spawnedChild = undefined;
    }
  };

  // 第一腿:默认参数。Ubuntu 24.04+/26 的 AppArmor 限制无特权 userns,Chrome 沙箱起不来
  // (进程活着但渲染器起不来,CDP 永不就绪)—— GitHub ubuntu-latest 2026-10-19 迁 26 后实证。
  launch([]);
  if (await waitCdpReady()) return;

  // 第二腿:仅 Linux,补 --no-sandbox 再试一次(容器/CI 的常态形态)。仍失败才真报错。
  if (process.platform === 'linux') {
    stopSpawned();
    // 给旧进程一点退出时间,避免 user-data-dir 的 SingletonLock 被残留进程占着
    await new Promise((r) => setTimeout(r, 500));
    launch(['--no-sandbox', '--disable-setuid-sandbox']);
    if (await waitCdpReady()) return;
  }

  throw new Error(
    `浏览器已拉起但 CDP 端口 ${port} 未就绪(${Math.round(waitMs / 1000)}s 超时)` +
      ` · platform=${process.platform}` +
      ` · exe=${executable}` +
      (launchFailure ? ` · spawn 错误=${launchFailure}` : ' · spawn 未报错') +
      ` · ${lastExit ? `子进程已退出 ${lastExit}` : '子进程仍在场'}` +
      (stderrTail ? ` · stderr 尾:${stderrTail.slice(-600)}` : ' · stderr 空'),
  );
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
export async function getBrowserSession(): Promise<{ session: CdpSession; port: number }> {
  if (activeSession?.isOpen) {
    return { session: activeSession, port: spawnedPort ?? resolveEndpoint().port };
  }
  activeSession?.close();
  activeSession = undefined;
  // 会话换了,上一轮发出的 ref 一律作废(不许跨会话复用编号)。
  resetBrowserRefBook();
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

// ==================== 语义快照句柄(会话级 ref) ====================

/**
 * 页内句柄注册表键。
 *
 * 为什么账挂在页面里而不是宿主:同一元素在两次快照之间必须拿到同一个 ref,而 DOM 重排、
 * 组件重建之后靠 CSS 路径或坐标反查都认不出"还是那个元素";`WeakMap<Element, ref>` 才是
 * "同一个元素"的唯一判据。文档级(挂 window)而不是会话级:页面导航后 window 换新,旧账
 * 随文档一起消失,天然兑现"跨文档旧 ref 失效";SPA 的 pushState 不换 window,同文档内
 * ref 继续有效。
 */
const REF_REGISTRY_KEY = '__ihuiBrowserRefRegistry';
const REF_REGISTRY_VERSION = 1;
/** 作废 ref 的记忆上限:只用于把"导航前的旧 ref"与"从未发出过的 ref"分别给出说明。 */
const REF_EXPIRED_KEEP = 400;

interface BrowserRefBook {
  session: CdpSession;
  docToken: string;
  alive: Set<string>;
  expired: Set<string>;
}

/** 会话级句柄账。只有这里认得的 ref 才会被派发;作废/未知一律显式失败。 */
let activeRefBook: BrowserRefBook | undefined;

/** 句柄账整体清空(browser_close / 会话重建时调用 —— 旧 ref 不得跨会话复用)。 */
function resetBrowserRefBook(): void {
  activeRefBook = undefined;
}

/**
 * 把"当前文档令牌"同步进会话账。
 *
 * 文档换了 ⇒ 旧账里活着的 ref 整批转入 `expired`(而不是直接丢弃),这样"导航后拿旧 ref"
 * 能报"失效"而不是"未知" —— 两种说明对应两种处置,不能并成一句。
 *
 * 注意:换文档时 `alive` 一律清空,**由快照重新发号**。原因是编号按文档重置:navigate 内部
 * 那次采集虽然也跑在页面上,但模型从没见到那批号,若让它直接算数,"导航前 e1 是提交按钮、
 * 导航后 e1 变成删除按钮"就会被静默点中 —— 这正是句柄体系要防的那一种错。
 */
function syncRefDocument(session: CdpSession, docToken: string): void {
  if (!docToken) return;
  const sameSession = activeRefBook?.session === session;
  if (activeRefBook && sameSession && activeRefBook.docToken === docToken) return;
  const expired = sameSession ? new Set(activeRefBook!.expired) : new Set<string>();
  if (sameSession) {
    for (const ref of activeRefBook!.alive) expired.add(ref);
    while (expired.size > REF_EXPIRED_KEEP) {
      const oldest = expired.values().next();
      if (oldest.done) break;
      expired.delete(oldest.value);
    }
  }
  activeRefBook = { session, docToken, alive: new Set(), expired };
}

/** 只有 `browser_snapshot` 调用它:把模型真正看到的那批 ref 记为可用。 */
function publishRefs(session: CdpSession, docToken: string, refs: string[]): void {
  // 取不到文档令牌 = 这一轮的"属于哪个文档"没判定,不发号(§0.3 未判定不冒充)。
  if (!docToken) return;
  syncRefDocument(session, docToken);
  if (!activeRefBook) return;
  for (const ref of refs) {
    activeRefBook.expired.delete(ref);
    activeRefBook.alive.add(ref);
  }
}

/** 宿主侧先把关:未登记过的 ref 连浏览器都不必碰。 */
function gateRef(ref: string): { ok: true } | { ok: false; message: string } {
  if (activeRefBook?.alive.has(ref)) return { ok: true };
  if (activeRefBook?.expired.has(ref)) {
    return {
      ok: false,
      message: `元素句柄 ${ref} 已失效:页面已导航或重新加载(跨文档),旧句柄整批作废。请重新调用 browser_snapshot 获取新的 [eN]。`,
    };
  }
  return {
    ok: false,
    message: `未知元素句柄 ${ref}:本会话没有发出过该 ref(或浏览器会话已重建)。请先调用 browser_snapshot 获取 [eN]。`,
  };
}

function markRefExpired(ref: string): void {
  if (!activeRefBook) return;
  activeRefBook.alive.delete(ref);
  activeRefBook.expired.add(ref);
}

/** 页内查不到句柄时的说明:三类成因各自点名,出路都是"重新快照"。 */
function refFailureMessage(ref: string, code: 'NO_REGISTRY' | 'UNKNOWN_REF' | 'DISCONNECTED'): string {
  if (code === 'DISCONNECTED') {
    return `元素句柄 ${ref} 已失效:元素已从页面上移除。请重新调用 browser_snapshot 获取新的 [eN]。`;
  }
  return `元素句柄 ${ref} 已失效:当前页面已不是发出该 ref 的文档(导航/重载或页面自行重建)。请重新调用 browser_snapshot 获取新的 [eN]。`;
}

/** 页内句柄查找的统一表达式:查不到/已移除一律返回结构化 code,不抛异常。 */
function refExpression(ref: string, body: string): string {
  return `(() => {
    const reg = window[${JSON.stringify(REF_REGISTRY_KEY)}];
    if (!reg || reg.version !== ${REF_REGISTRY_VERSION}) return JSON.stringify({ code: 'NO_REGISTRY' });
    const el = reg.byRef.get(${JSON.stringify(ref)});
    if (!el) return JSON.stringify({ code: 'UNKNOWN_REF' });
    if (!el.isConnected) return JSON.stringify({ code: 'DISCONNECTED' });
    ${body}
  })()`;
}

type RefLookupFailure = { ok: false; code: 'NO_REGISTRY' | 'UNKNOWN_REF' | 'DISCONNECTED' };

async function evalOnRef(
  session: CdpSession,
  ref: string,
  body: string,
): Promise<{ ok: true; value: Record<string, unknown> } | RefLookupFailure> {
  const res = await session.send<{ result: { value?: string | null }; exceptionDetails?: unknown }>(
    'Runtime.evaluate',
    { expression: refExpression(ref, body), returnByValue: true },
  );
  if (res.exceptionDetails) {
    throw new Error(`ref ${ref} 解析失败: ${JSON.stringify(res.exceptionDetails).slice(0, 300)}`);
  }
  const raw = res.result.value;
  if (typeof raw !== 'string') return { ok: false, code: 'UNKNOWN_REF' };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, code: 'UNKNOWN_REF' };
  }
  const code = parsed.code;
  if (code === 'NO_REGISTRY' || code === 'UNKNOWN_REF' || code === 'DISCONNECTED') {
    return { ok: false, code };
  }
  return { ok: true, value: parsed };
}

/** ref ⇒ 滚动后的矩形(click / type 定位共用)。 */
async function resolveRefBox(
  session: CdpSession,
  ref: string,
): Promise<{ ok: true; box: { x: number; y: number; w: number; h: number } } | RefLookupFailure> {
  const resolved = await evalOnRef(
    session,
    ref,
    `el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height });`,
  );
  if (!resolved.ok) return resolved;
  const box = {
    x: Number(resolved.value.x),
    y: Number(resolved.value.y),
    w: Number(resolved.value.w),
    h: Number(resolved.value.h),
  };
  if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) {
    return { ok: false, code: 'DISCONNECTED' };
  }
  return { ok: true, box };
}

interface PageSnapshot {
  title: string;
  url: string;
  text: string;
  outline: string[];
  refs: string[];
  docToken: string;
}

/**
 * 采集表达式:一次往返取标题/URL/正文/可交互元素大纲,并给每个出表元素分配文档内稳定的 ref。
 *
 * ref 只发给**出表的那几行**(先按原有 `length > 3` 过滤再编号):被过滤掉的空标签元素
 * 不占号,号段与模型看到的行一一对应。
 */
function buildSnapshotExpression(textLimit: number): string {
  return `(() => {
    const KEY = ${JSON.stringify(REF_REGISTRY_KEY)};
    const VERSION = ${REF_REGISTRY_VERSION};
    let reg = window[KEY];
    if (!reg || reg.version !== VERSION) {
      reg = window[KEY] = {
        version: VERSION,
        token: Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
        next: 1,
        byRef: new Map(),
        byEl: new WeakMap(),
      };
    }
    const refOf = (el) => {
      let ref = reg.byEl.get(el);
      if (!ref) {
        ref = 'e' + reg.next++;
        reg.byEl.set(el, ref);
        reg.byRef.set(ref, el);
      }
      return ref;
    };
    const rows = [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')]
      .slice(0, 60)
      .map((el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? '#' + el.id : '';
        const name = el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '';
        const label = ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) ? el.value : el.textContent) ?? '';
        return { el, body: tag + id + name + ': ' + label.trim().replace(/\\s+/g, ' ').slice(0, 60) };
      })
      .filter((row) => row.body.length > 3);
    const refs = rows.map((row) => refOf(row.el));
    return JSON.stringify({
      title: document.title,
      url: location.href,
      text: (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, ${textLimit}),
      outline: rows.map((row, i) => '[' + refs[i] + '] ' + row.body),
      refs: refs,
      docToken: reg.token,
    });
  })()`;
}

/** 页面内一次性取 title/url/可见文本/交互元素大纲(每行带会话级 ref,供 click/type 直接引用)。 */
async function collectPageSnapshot(session: CdpSession, textLimit: number, publish = false): Promise<PageSnapshot> {
  const res = await session.send<{ result: { value?: string }; exceptionDetails?: unknown }>(
    'Runtime.evaluate',
    { expression: buildSnapshotExpression(textLimit), returnByValue: true },
  );
  if (res.exceptionDetails) {
    throw new Error(`页面快照执行失败: ${JSON.stringify(res.exceptionDetails).slice(0, 300)}`);
  }
  const parsed = JSON.parse(res.result.value ?? '{}') as {
    title?: string;
    url?: string;
    text?: string;
    outline?: string[];
    refs?: string[];
    docToken?: string;
  };
  const refs = Array.isArray(parsed.refs) ? parsed.refs.filter((r): r is string => typeof r === 'string') : [];
  const docToken = typeof parsed.docToken === 'string' ? parsed.docToken : '';
  // 换文档时旧账在模型下一次动作之前就已经标成作废(navigate/click 收尾的采集也走这里);
  // 但"发号"只认 browser_snapshot —— 内部采集拿到的号模型没见过,不得先算数。
  if (publish) {
    publishRefs(session, docToken, refs);
  } else {
    syncRefDocument(session, docToken);
  }
  return {
    title: parsed.title ?? '',
    url: parsed.url ?? '',
    text: parsed.text ?? '',
    outline: parsed.outline ?? [],
    refs,
    docToken,
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

interface TargetChoice {
  kind: 'selector' | 'ref';
  value: string;
}

/**
 * 定位参数二选一(click / type 共用)。
 *
 * 同时给两个 / 一个都不给都必须当场拒绝:静默取其中一个,就等于把"模型以为点了 A、
 * 实际点了 B"写成一条成功日志。失败文案原样进 ToolResult.error,不抛异常。
 */
function parseTargetChoice(
  args: Record<string, unknown>,
): { ok: true; target: TargetChoice } | { ok: false; message: string } {
  // selector 仍按旧口径取:非空字符串才算给了;空串/非字符串视为未提供。
  const selector = typeof args.selector === 'string' ? args.selector : '';
  const ref = typeof args.ref === 'string' ? args.ref.trim() : '';
  if (selector.length > 0 && ref.length > 0) {
    return {
      ok: false,
      message:
        '参数错误:ref 与 selector 只能二选一,本次同时提供了两个。请只保留一个(优先用 browser_snapshot 给出的 ref)。',
    };
  }
  if (selector.length === 0 && ref.length === 0) {
    return {
      ok: false,
      message:
        '参数错误:必须提供 ref 或 selector 之一(ref 来自 browser_snapshot 的 [eN];selector 为 CSS 选择器)。',
    };
  }
  if (ref.length > 0) return { ok: true, target: { kind: 'ref', value: ref } };
  return { ok: true, target: { kind: 'selector', value: selector } };
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
      // 2026-10-31 安全强化第 21 批:协议白名单(单一真相源 @ihui/shared)。
      // url 来自模型工具参数,可被页面内容间接注入操纵;`file://` 会被 CDP 正常
      // 渲染,随后 browser_snapshot 把本地文件正文回传 —— 本地任意文件读链。
      const navigable = checkNavigableUrl(url);
      if (!navigable.ok) {
        return fail(new Error(navigable.reason), 'permission');
      }
      const { session } = await getBrowserSession();
      await session.send('Page.navigate', { url: navigable.url }, 60_000);
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
    '获取当前浏览器页面的可读快照:标题、URL、可见文本(截断)与交互元素大纲(a/button/input 等,含 id/name 定位线索),用于后续 click/type 选择器决策。每个出表交互元素带会话级句柄 [eN]:同一文档内重复快照同一元素仍是同一 ref,可直接作为 browser_click / browser_type 的 ref 参数;页面导航后旧 ref 整批失效,需重新快照。',
  parameters: {
    text_limit: { type: 'number', description: '可见文本最大字符数,默认 4000' },
  },
  required: [],
  dangerLevel: 'read',
  async execute(args) {
    try {
      const { session } = await getBrowserSession();
      const textLimit = Math.min(Math.max(Number(args.text_limit) || 4000, 200), 20_000);
      const snap = await collectPageSnapshot(session, textLimit, true);
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
  dangerLevel: 'write',
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
    '在当前页面点击元素。用 browser_snapshot 给出的 ref(如 e3)或 CSS 选择器定位(两者二选一),自动滚动到可见区域,并以真实鼠标事件(Input.dispatchMouseEvent)在元素中心按下并释放。ref 是会话级句柄:同一文档内稳定,页面导航后失效,需重新快照。',
  parameters: {
    selector: { type: 'string', description: '目标元素的 CSS 选择器,如 #submit-btn 或 a.login(与 ref 二选一)' },
    ref: { type: 'string', description: 'browser_snapshot 交互元素行里的句柄,如 e3(与 selector 二选一)' },
  },
  required: [],
  dangerLevel: 'write',
  async execute(args) {
    try {
      const choice = parseTargetChoice(args);
      if (!choice.ok) return fail(new Error(choice.message), 'param_invalid');
      if (choice.target.kind === 'ref') {
        const ref = choice.target.value;
        // 先问宿主账本:未登记/已作废的 ref 连浏览器都不必碰(更不许落到空选择器上)。
        const gate = gateRef(ref);
        if (!gate.ok) return fail(new Error(gate.message), 'stale_ref');
        const { session } = await getBrowserSession();
        const resolved = await resolveRefBox(session, ref);
        if (!resolved.ok) {
          markRefExpired(ref);
          return fail(new Error(refFailureMessage(ref, resolved.code)), 'stale_ref');
        }
        const { x, y, w, h } = resolved.box;
        const cx = x + w / 2;
        const cy = y + h / 2;
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
        return ok(
          `已点击 ref ${ref}(中心坐标 ${Math.round(cx)},${Math.round(cy)})\n当前页面: ${snap.url} — ${snap.title}`,
        );
      }
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
    '向输入框输入文本。用 browser_snapshot 给出的 ref(如 e3)或 CSS 选择器定位(两者二选一),聚焦后以真实键盘事件(Input.insertText)输入;可选先清空已有内容。ref 是会话级句柄:同一文档内稳定,页面导航后失效,需重新快照。',
  parameters: {
    selector: { type: 'string', description: '目标输入元素的 CSS 选择器(与 ref 二选一)' },
    ref: { type: 'string', description: 'browser_snapshot 交互元素行里的句柄,如 e3(与 selector 二选一)' },
    text: { type: 'string', description: '要输入的文本' },
    clear: { type: 'boolean', description: '输入前是否清空已有内容,默认 false' },
  },
  required: ['text'],
  dangerLevel: 'write',
  async execute(args) {
    try {
      const choice = parseTargetChoice(args);
      if (!choice.ok) return fail(new Error(choice.message), 'param_invalid');
      const text = requireString(args, 'text');
      if (choice.target.kind === 'ref') {
        const ref = choice.target.value;
        const gate = gateRef(ref);
        if (!gate.ok) return fail(new Error(gate.message), 'stale_ref');
        const { session } = await getBrowserSession();
        const focused = await evalOnRef(session, ref, `el.focus();
    return JSON.stringify({ ok: true });`);
        if (!focused.ok) {
          markRefExpired(ref);
          return fail(new Error(refFailureMessage(ref, focused.code)), 'stale_ref');
        }
        if (args.clear === true) {
          const cleared = await evalOnRef(
            session,
            ref,
            `if ('value' in el) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return JSON.stringify({ ok: true });`,
          );
          if (!cleared.ok) {
            markRefExpired(ref);
            return fail(new Error(refFailureMessage(ref, cleared.code)), 'stale_ref');
          }
        }
        await session.send('Input.insertText', { text });
        await new Promise((r) => setTimeout(r, 150));
        const valueRes = await evalOnRef(
          session,
          ref,
          `return JSON.stringify({ ok: true, value: ('value' in el) ? String(el.value) : document.body.innerText.slice(0, 200) });`,
        );
        const current = valueRes.ok ? String(valueRes.value.value ?? '') : '';
        return ok(`已向 ref ${ref} 输入 ${text.length} 字符\n当前值: ${current.slice(0, 120)}`);
      }
      const selector = requireString(args, 'selector');
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

export const KEY_MAP: Record<string, { code: string; vk: number; text?: string }> = {
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
      // 句柄账随会话一起清空:关掉浏览器之后旧 ref 不得在新会话里撞上同号元素。
      resetBrowserRefBook();
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
