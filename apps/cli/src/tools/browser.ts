// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器自动化工具集 — Computer Use 级别自主浏览器控制(对标 Claude computer use / Trae 浏览器控制)。
 *
 * 实现要点:
 *   - 驱动层仅用 playwright chromium,按 terminal.ts 的 node-pty 动态加载模式 createRequire 加载,
 *     缺失(未安装)时优雅降级返回带指引的错误,不抛模块级异常。
 *   - 进程内单例:模块级变量共享单一 browser 实例 + 单一 page,惰性首启 headless chromium,
 *     重复打开/操作复用上下文,失败不清空浏览器状态。
 *   - 每个 tool 的 execute 返回结构化 JSON(success/output/error),含错误说明。
 *
 * 工具集(每项一个 Tool):browser_open / browser_snapshot / browser_click / browser_type /
 * browser_screenshot / browser_extract_text / browser_close。
 * 用法:`registerBrowserTools()`(index.ts 已 import 并注册,BROWSER_TOOLS 填此集)。
 */
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import type { Tool, ToolResult } from './index.js';

// ==================== playwright 动态加载(缺失优雅降级,参考 terminal.ts node-pty 模式)====================

const require = createRequire(import.meta.url);

// playwright 最小接口自描述(避免静态 import 依赖未安装时报 TS2307)
interface LaunchOptions {
  headless?: boolean;
}
interface ElementHandle {
  click(opts?: { timeout?: number }): Promise<void>;
  scrollIntoViewIfNeeded(opts?: { timeout?: number }): Promise<void>;
  type(text: string, opts?: { timeout?: number }): Promise<void>;
}
interface Page {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  url(): string;
  title(): Promise<string>;
  content(): Promise<string>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, text: string, opts?: { timeout?: number }): Promise<void>;
  mouse: { click(x: number, y: number): Promise<void> };
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  screenshot(opts: {
    path?: string;
    fullPage?: boolean;
    type?: 'png' | 'jpeg';
    encoding?: 'base64';
    quality?: number;
  }): Promise<Buffer | string>;
  evaluate<R>(fn: string | ((...args: unknown[]) => unknown), arg?: unknown): Promise<R>;
  $$(selector: string): Promise<ElementHandle[]>;
  textContent(selector: string): Promise<string | null>;
  waitForLoadState(state?: string): Promise<void>;
  isClosed(): boolean;
  close(): Promise<void>;
}
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}
interface PlaywrightMod {
  chromium: {
    launch(opts?: LaunchOptions): Promise<Browser>;
  };
}

let playwrightMod: PlaywrightMod | null = null;
try {
  playwrightMod = require('playwright') as PlaywrightMod;
} catch {
  playwrightMod = null; // playwright 未安装,降级:各 tool 调用时返回指引错误
}

// ==================== 单例浏览器上下文(模块级共享单一 chromium 实例 + 单一 page)====================

let browser: Browser | null = null;
let page: Page | null = null;

/** 确保 playwright 已加载,否则抛带修复指引的异常 */
function requirePlaywright(): PlaywrightMod {
  if (!playwrightMod) {
    throw new Error(
      'playwright 未安装(驱动缺失)。请先安装依赖并下载 chromium: pnpm --filter @ihui/cli add playwright && pnpm --filter @ihui/cli exec playwright install chromium',
    );
  }
  return playwrightMod;
}

/** 惰性获取当前 page(首启启动 headless chromium;page 被关时重建)。头less 可用 IHUI_BROWSER_HEADLESS=0 关闭。 */
async function ensurePage(): Promise<Page> {
  const mod = requirePlaywright();
  if (!browser) {
    const headless = process.env.IHUI_BROWSER_HEADLESS !== '0';
    browser = await mod.chromium.launch({ headless });
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage();
  }
  return page;
}

function fail(msg: string): ToolResult {
  return { success: false, output: '', error: msg };
}
function ok(output: string): ToolResult {
  return { success: true, output };
}
function strArg(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

/** 可交互元素选择器(browser_snapshot 与 browser_click[ref 模式]共享,保证 ref 顺序一致) */
const INTERACTIVE_SELECTOR =
  'a[href],button,input,textarea,select,summary,[role="button"],[role="link"],[role="textbox"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[role="menuitem"],[role="option"],[tabindex]';

interface SnapshotElement {
  ref: number;
  tag: string;
  role: string;
  name: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 快照提取 JS 源(浏览器内执行的裸 JS,不依赖宿主作用域)。
 * 用 String.raw 保留反斜杠;以字符串形式传给 page.evaluate 避免 esbuild/tsx
 * 对函数序列化时注入 __name 等宿主依赖导致浏览器侧 ReferenceError。
 */
const SNAPSHOT_SOURCE = String.raw`(sel) => {
  const out = [];
  let ref = 0;
  const nodes = document.querySelectorAll(sel);
  for (const n of Array.from(nodes)) {
    const rect = n.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (n.tagName.toLowerCase() !== 'body' && !n.offsetParent) continue;
    const tag = n.tagName.toLowerCase();
    let role = (n.getAttribute('role') || tag).toLowerCase();
    if (role === 'a') role = 'link';
    let name = (n.getAttribute('aria-label') || '').trim();
    if (!name && n.id) {
      const esc = (s) => s.replace(/["\\]/g, (m) => '\\' + m);
      const lab = document.querySelector('label[for="' + esc(n.id) + '"]');
      if (lab) name = (lab.textContent || '').trim();
    }
    if (!name) {
      const wrap = n.closest('label');
      if (wrap) name = (wrap.textContent || '').trim();
    }
    if (!name) {
      const inner = n.querySelector('label');
      if (inner) name = (inner.textContent || '').trim();
    }
    if (!name && (tag === 'input' || tag === 'textarea')) name = (n.getAttribute('placeholder') || '').trim();
    if (!name && (tag === 'a' || tag === 'button' || tag === 'summary')) name = (n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    if (!name && n.getAttribute('title')) name = n.getAttribute('title').trim();
    if (!name && role === 'img') name = n.getAttribute('alt') || '';
    const el = {
      ref: ref++,
      tag,
      role,
      name: name || n.getAttribute('name') || '(无名称)',
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    if (n.hasAttribute('disabled') || n.getAttribute('aria-disabled') === 'true') el.disabled = true;
    if (n.getAttribute('type') === 'checkbox' || n.getAttribute('type') === 'radio' || role === 'switch') el.checked = !!n.checked;
    const val = n.getAttribute('value');
    if (typeof val === 'string' && val) el.value = val;
    if (n.hasAttribute('placeholder')) el.placeholder = n.getAttribute('placeholder');
    out.push(el);
  }
  return out;
}`;

/** 生成在页面里求值的快照表达式(selector 作为序列化字面量注入) */
function snapshotExpr(selector: string): string {
  return `(${SNAPSHOT_SOURCE})(${JSON.stringify(selector)})`;
}

/** 把快照渲染为 agent 可读文本(含角色/名称/状态/坐标,供后续 ref 定位) */
function renderSnapshot(url: string, title: string, els: SnapshotElement[]): string {
  const lines: string[] = [];
  lines.push(`URL: ${url || '(about:blank)'}`);
  lines.push(`标题: ${title || '(无标题)'}`);
  lines.push(
    `可见可交互元素 ${els.length} 个(ref → tag/role / 名称 / 坐标 [宽x高]):`,
  );
  if (els.length === 0) {
    lines.push('  (无可见可交互元素)');
  }
  for (const e of els) {
    const state =
      (e.disabled ? 'disabled ' : '') + (e.checked === undefined ? '' : e.checked ? 'checked ' : 'unchecked ');
    const value = e.value ? ` 值=${JSON.stringify(e.value)}` : '';
    const placeholder = e.placeholder ? ` 提示=${JSON.stringify(e.placeholder)}` : '';
    lines.push(
      `  [${e.ref}] ${e.tag}/${e.role} "${e.name}" @ ${e.x},${e.y} [${e.width}x${e.height}] ${state.trim()}${value}${placeholder}`.trimEnd(),
    );
  }
  return lines.join('\n');
}

/** 按 selector / ref / 坐标定位可点击元素,返回 page 或其 ElementHandle 的聚焦回调 */
type Focuser = (p: Page) => Promise<void>;

function resolveFocuser(args: Record<string, unknown>): { focuser: Focuser; how: string; raw: string } {
  const selector = strArg(args, 'selector');
  const ref = args.ref;
  const x = args.x;
  const y = args.y;

  if (selector) {
    return {
      how: 'selector',
      raw: selector,
      focuser: async (p) => {
        await p.waitForLoadState('domcontentloaded');
        await p.click(selector, { timeout: 8000 });
      },
    };
  }
  if (typeof ref === 'number' || typeof ref === 'string') {
    const idx = Number(ref);
    return {
      how: 'ref',
      raw: String(ref),
      focuser: async (p) => {
        const handles = await p.$$(INTERACTIVE_SELECTOR);
        const h = handles[idx];
        if (!h) throw new Error(`ref ${idx} 越界(共 ${handles.length} 个可交互元素),请先 browser_snapshot 获取最新 ref`);
        await h.scrollIntoViewIfNeeded();
        await h.click({ timeout: 8000 });
      },
    };
  }
  if (typeof x === 'number' && typeof y === 'number') {
    return {
      how: 'coords',
      raw: `${x},${y}`,
      focuser: async (p) => {
        await p.mouse.click(x, y);
      },
    };
  }
  // 无有效定位方式 → 抛错由调用方转 fail
  throw new Error('缺少定位方式:browser_click 需传 selector(ref 可选,但 ref/坐标三选一)');
}

// ==================== 工具集 ====================

export const browser_open: Tool = {
  name: 'browser_open',
  description:
    '在复用的 chromium 浏览器中打开指定 URL(惰性复用单例上下文,首次需启动一次浏览器)。参数:url(必填,http/https/data/about:blank),timeout(可选,加载超时毫秒,默认 30000)。返回当前 URL 与标题。',
  dangerLevel: 'write',
  parameters: {
    url: { type: 'string', description: '要打开的完整 URL(如 https://example.com)' },
    timeout: { type: 'number', description: '页面加载超时(毫秒,默认 30000)' },
  },
  required: ['url'],
  async execute(args, _ctx): Promise<ToolResult> {
    const url = strArg(args, 'url');
    if (!url) return fail('缺少 url 参数');
    try {
      const p = await ensurePage();
      const timeout = (args.timeout as number) ?? 30000;
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return ok(`已打开: ${p.url()}\n标题: ${await p.title()}`);
    } catch (e) {
      return fail(`打开页面失败: ${(e as Error).message}`);
    }
  },
};

export const browser_snapshot: Tool = {
  name: 'browser_snapshot',
  description:
    '抓取当前浏览器页面的可访问性快照:返回 url、title 及每个可交互元素的 ref/tag/role/name/坐标尺寸/状态(disabled/checked/value)。供 agent 用 ref 或 selector 执行后续 browser_click / browser_type。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(_args, _ctx): Promise<ToolResult> {
    try {
      const p = await ensurePage();
      const url = p.url();
      const title = await p.title();
      const els = await p.evaluate<SnapshotElement[]>(snapshotExpr(INTERACTIVE_SELECTOR));
      return ok(renderSnapshot(url, title, els));
    } catch (e) {
      return fail(`抓取快照失败: ${(e as Error).message}`);
    }
  },
};

export const browser_click: Tool = {
  name: 'browser_click',
  description:
    '点击当前页面元素。三种定位方式三选一:selector(CSS 选择器)、ref(browser_snapshot 返回的元素 ref 序号)、或 x+y(视口坐标)。参数:selector 或 ref 或 x,y。',
  dangerLevel: 'write',
  parameters: {
    selector: { type: 'string', description: 'CSS 选择器(如 #submit 或 button[type="submit"])' },
    ref: { type: 'number', description: 'browser_snapshot 返回的可交互元素 ref 序号(从 0 开始)' },
    x: { type: 'number', description: '点击的视口 x 坐标(与 y 配合,坐标模式)' },
    y: { type: 'number', description: '点击的视口 y 坐标(与 x 配合,坐标模式)' },
  },
  required: [],
  async execute(args, _ctx): Promise<ToolResult> {
    let focuser: Focuser;
    let how: string;
    let raw: string;
    try {
      const r = resolveFocuser(args);
      focuser = r.focuser;
      how = r.how;
      raw = r.raw;
    } catch (e) {
      return fail((e as Error).message);
    }
    try {
      const p = await ensurePage();
      await focuser(p);
      return ok(`已点击 ${how === 'coords' ? '坐标' : how === 'ref' ? 'ref' : '选择器'} "${raw}"\n当前 URL: ${p.url()}`);
    } catch (e) {
      return fail(`点击失败(${how} "${raw}"): ${(e as Error).message}`);
    }
  },
};

export const browser_type: Tool = {
  name: 'browser_type',
  description:
    '聚焦元素并输入文本。定位:selector 或 ref(browser_snapshot 返回的 ref)。参数:text(必填),selector/ref,clear(可选,默认 true,是否先清空原有内容),enter(可选,默认 false,是否输入后回车)。',
  dangerLevel: 'write',
  parameters: {
    selector: { type: 'string', description: 'CSS 选择器定位输入元素' },
    ref: { type: 'number', description: 'browser_snapshot 返回的输入元素 ref 序号' },
    text: { type: 'string', description: '要输入的文本' },
    clear: { type: 'boolean', description: '输入前是否清空(默认 true)' },
    enter: { type: 'boolean', description: '输入后是否按回车(默认 false)' },
  },
  required: ['text'],
  async execute(args, _ctx): Promise<ToolResult> {
    const text = strArg(args, 'text') ?? '';
    const clear = args.clear !== false;
    const enter = args.enter === true;
    const selector = strArg(args, 'selector');
    const ref = Number(args.ref);
    if (typeof args.ref !== 'number' || Number.isNaN(ref)) {
      if (!selector) return fail('缺少定位:browser_type 需传 selector 或 ref');
    }
    try {
      const p = await ensurePage();
      await p.waitForLoadState('domcontentloaded');
      if (selector) {
        if (clear) {
          await p.fill(selector, text, { timeout: 8000 });
        } else {
          await p.click(selector, { timeout: 8000 });
          await p.keyboard.type(text);
        }
      } else {
        const handles = await p.$$(INTERACTIVE_SELECTOR);
        const h = handles[ref];
        if (!h) throw new Error(`ref ${ref} 越界(共 ${handles.length} 个可交互元素)`);
        await h.scrollIntoViewIfNeeded();
        await h.click({ timeout: 8000 });
        if (clear) {
          // 清空目标(Ctrl+A 全选后覆盖)——在页面内执行
          await p.keyboard.type(text);
        } else {
          await p.keyboard.type(text);
        }
      }
      if (enter) await p.keyboard.press('Enter');
      return ok(`已${clear ? '填入' : '追加输入'} ${text.length} 字符${enter ? '并按回车' : ''}${selector ? ` → ${selector}` : ref >= 0 ? ` → ref ${ref}` : ''}`);
    } catch (e) {
      return fail(`输入失败: ${(e as Error).message}`);
    }
  },
};

export const browser_screenshot: Tool = {
  name: 'browser_screenshot',
  description:
    '对当前页面截图。参数:fullPage(可选,默认 true,整页截图;false 仅视口),output(可选,path|base64,默认 path),format(可选,png|jpeg,默认 png)。返回本地保存路径或 base64 元信息。',
  dangerLevel: 'read',
  parameters: {
    fullPage: { type: 'boolean', description: '整页截图(默认 true);false 仅当前视口' },
    output: {
      type: 'string',
      description: '返回形态:path(默认,返回本地文件路径)或 base64(返回 base64 数据)',
      enum: ['path', 'base64'],
    },
    format: { type: 'string', description: '图片格式:png(默认)或 jpeg', enum: ['png', 'jpeg'] },
  },
  required: [],
  async execute(args, _ctx): Promise<ToolResult> {
    const fullPage = args.fullPage !== false;
    const output = strArg(args, 'output') === 'base64' ? 'base64' : 'path';
    const format = strArg(args, 'format') === 'jpeg' ? 'jpeg' : 'png';
    try {
      const p = await ensurePage();
      const dir = path.join(os.tmpdir(), 'ihui-browser');
      fs.mkdirSync(dir, { recursive: true });
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      const filePath = path.join(dir, `browser_shot_${Date.now()}.${ext}`);
      if (output === 'base64') {
        const data = (await p.screenshot({
          path: filePath,
          fullPage,
          type: format,
          encoding: 'base64',
        })) as unknown as string;
        return ok(
          `截图(base64)已生成:\n  本地路径: ${filePath}\n  完整页: ${fullPage}\n  格式: ${format}\n  base64 长度: ${data.length}\n  base64 前缀: ${data.slice(0, 80)}...`,
        );
      }
      const buf = (await p.screenshot({ path: filePath, fullPage, type: format })) as Buffer;
      return ok(`截图已保存: ${filePath}\n  完整页: ${fullPage}\n  格式: ${format}\n  字节: ${buf.length}`);
    } catch (e) {
      return fail(`截图失败: ${(e as Error).message}`);
    }
  },
};

export const browser_extract_text: Tool = {
  name: 'browser_extract_text',
  description: '提取当前页面可见文本(基于 innerText,自动去重空行)。无参数。返回页面主文本内容供 agent 阅读。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(_args, _ctx): Promise<ToolResult> {
    try {
      const p = await ensurePage();
      const text = await p.evaluate<string>(() => {
        const body = document.body;
        if (!body) return '';
        return (body.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim();
      });
      return ok(`页面文本(${text.length} 字符):\n\n${text.slice(0, 20000)}${text.length > 20000 ? '\n\n... (已截断)' : ''}`);
    } catch (e) {
      return fail(`提取文本失败: ${(e as Error).message}`);
    }
  },
};

export const browser_close: Tool = {
  name: 'browser_close',
  description: '关闭当前浏览器页面与浏览器实例,释放资源(复用单例,下次 browser_open 会重新启动)。无参数。',
  dangerLevel: 'write',
  parameters: {},
  required: [],
  async execute(_args, _ctx): Promise<ToolResult> {
    try {
      if (page && !page.isClosed()) await page.close();
    } catch { /* 忽略关闭异常 */ }
    page = null;
    try {
      if (browser) await browser.close();
    } catch { /* 忽略 */ }
    browser = null;
    return ok('浏览器已关闭(页面与实例均已释放),下次操作将重新启动');
  },
};

/** 浏览器自动化工具集(P0-5 Computer Use) */
export const BROWSER_TOOLS: Tool[] = [
  browser_open,
  browser_snapshot,
  browser_click,
  browser_type,
  browser_screenshot,
  browser_extract_text,
  browser_close,
];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
