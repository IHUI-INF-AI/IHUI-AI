// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Mermaid 图表 → PNG/SVG 渲染(swappable engine)。
 *
 * 灵感来源:参考行业 Agent 框架的可视化输出能力(mermaid 代码块自动渲染为图片)。
 * 简化策略(做减法):
 *   - 双引擎 fallback:MmdcCliEngine(本地 mmdc CLI,优先) → MermaidApiEngine(mermaid.ink 在线 API)
 *   - 本地引擎依赖 @mermaid-js/mermaid-cli(开发机常备,零 npm 依赖,通过 spawn 调用)
 *   - 在线引擎仅需 fetch + base64,无需任何依赖
 *   - feature flag 默认关闭(settings.mermaid.enabled),关闭时完全不接入 agent(零回归)
 *   - Windows 兼容:临时文件用 os.tmpdir(),路径含空格正确转义
 *
 * 使用方式:
 *   1. settings.mermaid.enabled = true 启用
 *   2. agent 输出包含 ```mermaid 代码块时,自动渲染为 PNG 写入 workspace/.ihui/mermaid/
 *   3. 文件路径回写到对话(用户可点击查看)
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

/**
 * b76-12a 票1:图语法发射/解析侧的「任意文本不可破坏语法」契约。
 *
 * 这些文本来自 agent 名、glob 模式等**任意用户派生内容** —— so arbitrary script
 * text cannot break the diagram syntax(机制对标上游 dynamic-workflow/analysis/mermaid.ts):
 *   - 节点 id 一律净化(只留词字符,`ask#1` → `ask_1`;`gate-89#R9` → `gate_89_R9`);
 *   - **原始 id 保留在人读标签里**(净化只影响语法位,不销毁信息);
 *   - 标签文本统一双引号包裹,`"` 改写成 `#quot;` 实体,并剥掉反引号与换行;
 *   - 含引号/反引号/换行/`#`/`-` 的内容不得让图语法本身被破坏,也不得让
 *     extractMermaidBlocks 静默吞掉整块 fence 或后续围栏。
 */

/** 节点 id 净化:只留词字符(上游 :19-43 同判据)。 */
const NODE_ID_UNSAFE_RE = /[^A-Za-z0-9_]/g

export function safeNodeId(id: string): string {
  const s = String(id ?? '').replace(NODE_ID_UNSAFE_RE, '_');
  return s === '' ? 'n' : s;
}

/**
 * 标签文本转义:`"` → `#quot;` 实体、剥反引号、换行折成空格。
 * 输出必须能被安全地放进双引号标签内而不破坏语法。
 */
export function escapeLabel(text: string): string {
  return String(text ?? '')
    .replace(/"/g, '#quot;')
    .replace(/`/g, '')
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ');
}

export interface MermaidNodeInput {
  /** 原始 id(任意用户派生文本;发射时净化,原文保留在标签) */
  id: string;
  /** 人读标签(缺省用原始 id) */
  label?: string;
}

export interface MermaidEdgeInput {
  from: string;
  to: string;
  label?: string;
}

/**
 * 从结构化节点/边发射 mermaid 源码(发射侧契约的唯一出口):
 * id 净化、标签双引号包裹 + 转义。任意文本进 ⇒ 可渲染的 flowchart 文本出。
 */
export function emitMermaidGraph(
  nodes: MermaidNodeInput[],
  edges: MermaidEdgeInput[] = [],
): string {
  const lines: string[] = ['flowchart TD'];
  for (const n of nodes) {
    const label = n.label ?? n.id;
    lines.push(`  ${safeNodeId(n.id)}["${escapeLabel(label)}"]`);
  }
  for (const e of edges) {
    const from = safeNodeId(e.from);
    const to = safeNodeId(e.to);
    const label = escapeLabel(e.label ?? '');
    lines.push(`  ${from} -->|"${label}"| ${to}`);
  }
  return lines.join('\n');
}

/** 渲染引擎接口 */
export interface MermaidEngine {
  /** 引擎名称(用于日志) */
  name: string;
  /** 渲染 mermaid 源码为 Buffer(PNG/SVG) */
  render(source: string): Promise<Buffer>;
}

/** 渲染结果 */
export interface MermaidRenderResult {
  /** 渲染后的二进制数据 */
  buffer: Buffer;
  /** MIME 类型(png/svg) */
  mimeType: string;
  /** 使用的引擎名称 */
  engine: string;
  /** 是否命中缓存(用于性能统计) */
  cached: boolean;
}

/**
 * LRU 渲染缓存 — 基于 mermaid 源码哈希的内存缓存。
 *
 * 设计:
 *   - key: sha256(source) 的 hex 前 16 字符(足够防碰撞)
 *   - value: { buffer, mimeType, engine, ts }
 *   - 默认 32 条上限(mermaid 渲染重复率高,32 条够用)
 *   - LRU 淘汰:Map 按插入顺序,超限时删除最早的
 *   - TTL:默认 30 分钟(1800s),超过则视为过期(防源码语义变化但哈希相同)
 *
 * 性能收益:
 *   - mmdc spawn 有 ~1s 启动开销,缓存命中时 < 1ms
 *   - 同一 mermaid 代码块重复渲染(对话流式输出时)直接命中缓存
 *
 * 线程安全:
 *   - Node 单线程,Map 操作原子,无需锁
 *   - 异步并发渲染同一 source ⇒ 由模块级在飞收敛表(b76-12f 票3)按 source 指纹
 *     收敛成**一次** spawn:并发调用共享同一个渲染 Promise,不再重复 spawn
 */
export class MermaidRenderCache {
  private cache = new Map<string, {
    buffer: Buffer;
    mimeType: string;
    engine: string;
    ts: number;
  }>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 32, ttlMs = 30 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /** 生成 source 的 cache key(sha256 hex 前 16 字符) */
  private makeKey(source: string): string {
    return createHash('sha256').update(source, 'utf-8').digest('hex').slice(0, 16);
  }

  /** 查询缓存(命中返回结果 + 删除重插实现 LRU;未命中或过期返回 null) */
  get(source: string): { buffer: Buffer; mimeType: string; engine: string } | null {
    const key = this.makeKey(source);
    const entry = this.cache.get(key);
    if (!entry) return null;
    // TTL 检查
    if (Date.now() - entry.ts > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    // LRU:删除后重新插入,让它成为最新使用
    this.cache.delete(key);
    this.cache.set(key, entry);
    return { buffer: entry.buffer, mimeType: entry.mimeType, engine: entry.engine };
  }

  /** 写入缓存(LRU 淘汰最早条目) */
  set(source: string, buffer: Buffer, mimeType: string, engine: string): void {
    const key = this.makeKey(source);
    // 已存在则先删除(LRU 更新)
    if (this.cache.has(key)) this.cache.delete(key);
    // 超限淘汰:删除最早条目(Map 按插入顺序,第一个 key 是最老的)
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { buffer, mimeType, engine, ts: Date.now() });
  }

  /** 清空缓存 */
  clear(): void {
    this.cache.clear();
  }

  /** 当前缓存条数(测试用) */
  size(): number {
    return this.cache.size;
  }
}

/** 全局默认缓存实例(模块级单例) */
const defaultCache = new MermaidRenderCache();

/**
 * 在飞渲染收敛表(b76-12f 票3,上游 zcodeAgentProcessManager:859-887 同机制):
 * key = sha256(source) 指纹,value = 在飞渲染 Promise。
 * 并发同 source 渲染只允许一次底层 spawn/fetch;finally 按 promise identity 清表项
 * (表里仍指向本 promise 才删 —— 防止后到的同 key promise 被先到的 finally 误删)。
 */
const inFlightRenders = new Map<string, Promise<MermaidRenderResult>>();

/** source 的在飞表 key(与 MermaidRenderCache.makeKey 同形:sha256 hex 前 16 字符)。 */
function inFlightKey(source: string): string {
  return createHash('sha256').update(source, 'utf-8').digest('hex').slice(0, 16);
}

/** 获取默认缓存实例(测试 + 重置用) */
export function getDefaultCache(): MermaidRenderCache {
  return defaultCache;
}

/**
 * MmdcCliEngine — 调用 @mermaid-js/mermaid-cli 的 mmdc 命令渲染。
 *
 * 依赖:全局或本地安装 @mermaid-js/mermaid-cli(npx mmdc 也可)。
 * 优点:完全本地化,无网络依赖,渲染质量稳定。
 * 缺点:需要 Node + puppeteer(首次安装较慢)。
 *
 * Windows 兼容:
 *   - spawn 自动查找 PATH 中的 mmdc.cmd
 *   - 临时文件用 os.tmpdir() 避免权限问题
 *   - windowsHide 隐藏 CLI 窗口
 */
export class MmdcCliEngine implements MermaidEngine {
  name = 'mmdc-cli';
  private readonly timeoutMs: number;
  // 可注入的 spawn 函数(测试用)
  private readonly spawnFn: typeof spawn;

  constructor(timeoutMs = 30_000, spawnFn?: typeof spawn) {
    this.timeoutMs = timeoutMs;
    this.spawnFn = spawnFn ?? spawn;
  }

  async render(source: string): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inputPath = path.join(tmpDir, `ihui-mermaid-${stamp}.mmd`);
    const outputPath = path.join(tmpDir, `ihui-mermaid-${stamp}.png`);

    try {
      // 1. 写入临时 .mmd 文件
      await fs.writeFile(inputPath, source, 'utf-8');

      // 2. spawn mmdc -i input.mmd -o output.png -t dark -b transparent
      const args = [
        '-i', inputPath,
        '-o', outputPath,
        '-t', 'dark',
        '-b', 'transparent',
      ];
      await this.runMmdc(args);
      // 3. 读取 output.png 返回 Buffer
      return await fs.readFile(outputPath);
    } finally {
      // 4. 清理临时文件(失败忽略)
      await Promise.allSettled([
        fs.unlink(inputPath).catch(() => {}),
        fs.unlink(outputPath).catch(() => {}),
      ]);
    }
  }

  private runMmdc(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = this.spawnFn('mmdc', args, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`mmdc 渲染超时(${this.timeoutMs}ms)`));
      }, this.timeoutMs);

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`mmdc 启动失败: ${err.message}(请确认 @mermaid-js/mermaid-cli 已安装)`));
      });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`mmdc 渲染失败(exit ${code})\n${stderr.slice(-500)}`));
          return;
        }
        resolve();
      });
    });
  }
}

/**
 * MermaidApiEngine — 调用 mermaid.ink 在线 API 渲染。
 *
 * 依赖:Node 18+ 内置 fetch。
 * 优点:零本地依赖,无需安装任何额外工具。
 * 缺点:需要网络,源码会通过 URL 发送到第三方(敏感场景慎用)。
 *
 * API 协议:GET https://mermaid.ink/svg/<base64-source>
 *   - base64 编码:标准 Base64 (+/ 与 = 不转义)
 *   - 返回 SVG 文本(直接作为 Buffer 返回)
 */
export class MermaidApiEngine implements MermaidEngine {
  name = 'mermaid-ink';
  private readonly fetchImpl: typeof fetch;
  private readonly apiUrl: string;

  constructor(fetchImpl?: typeof fetch, apiUrl = 'https://mermaid.ink') {
    this.fetchImpl = fetchImpl ?? fetch;
    this.apiUrl = apiUrl;
  }

  async render(source: string): Promise<Buffer> {
    // base64 编码源码(UTF-8 安全:先转 Buffer 再 base64)
    const sourceBuffer = Buffer.from(source, 'utf-8');
    const base64 = sourceBuffer.toString('base64');
    const url = `${this.apiUrl}/svg/${base64}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await this.fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`mermaid.ink 返回 ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('aborted')) {
        throw new Error('mermaid.ink 请求超时(30s)');
      }
      throw new Error(`mermaid.ink 请求失败: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * 渲染 mermaid 源码为图片,优先查缓存,未命中用引擎渲染后写缓存。
 *
 * 引擎优先级:
 *   0. 全局 LRU 缓存(命中直接返回,跳过所有 spawn/fetch)
 *   1. MmdcCliEngine(本地 mmdc CLI,无网络依赖)
 *   2. MermaidApiEngine(在线 mermaid.ink API)
 *   3. 全部失败 → 抛错(包含两个引擎的错误信息)
 *
 * @param source mermaid 源码
 * @param engines 引擎数组(默认 [new MmdcCliEngine(), new MermaidApiEngine()])
 * @param cache 可选缓存实例(默认用全局 defaultCache,传 null 禁用缓存)
 * @returns 渲染结果(Buffer + mimeType + engine 名称 + cached 标记)
 */
export async function renderMermaid(
  source: string,
  engines?: MermaidEngine[],
  cache?: MermaidRenderCache | null,
): Promise<MermaidRenderResult> {
  // 0. 查缓存(默认用全局 cache,显式传 null 禁用)
  const cacheInstance = cache === null ? null : (cache ?? defaultCache);
  if (cacheInstance) {
    const hit = cacheInstance.get(source);
    if (hit) {
      return {
        buffer: hit.buffer,
        mimeType: hit.mimeType,
        engine: hit.engine,
        cached: true,
      };
    }
  }

  // 0.5 在飞收敛(b76-12f 票3):同 source 的并发渲染共享同一次底层 spawn
  const key = inFlightKey(source);
  const existing = inFlightRenders.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<MermaidRenderResult> => {
    const engineList = engines ?? [new MmdcCliEngine(), new MermaidApiEngine()];
    const errors: string[] = [];
    for (const engine of engineList) {
      try {
        const buffer = await engine.render(source);
        // 推断 MIME 类型:mermaid.ink 返回 SVG,mmdc 默认返回 PNG
        const mimeType = engine.name === 'mermaid-ink' ? 'image/svg+xml' : 'image/png';
        // 写入缓存
        cacheInstance?.set(source, buffer, mimeType, engine.name);
        return { buffer, mimeType, engine: engine.name, cached: false };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${engine.name}] ${msg}`);
      }
    }
    throw new Error(`所有 mermaid 引擎渲染失败:\n${errors.join('\n')}`);
  })().finally(() => {
    // finally 按 promise identity 清表项(防换代误删)
    if (inFlightRenders.get(key) === promise) inFlightRenders.delete(key);
  });
  inFlightRenders.set(key, promise);
  return promise;
}

/**
 * 从 LLM 输出文本中提取 mermaid 代码块。
 *
 * 匹配规则:```mermaid ... ```(支持多个代码块)
 *
 * @param text LLM 输出文本
 * @returns mermaid 源码数组(可能为空)
 */
export function extractMermaidBlocks(text: string): string[] {
  const blocks: string[] = [];
  // 全局匹配 ```mermaid\n...\n``` 代码块(非贪婪)
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const source = match[1]?.trim();
    if (source && source.length > 0) {
      blocks.push(source);
    }
  }
  return blocks;
}

/**
 * 将渲染结果写入 workspace/.ihui/mermaid/<stamp>.<ext>。
 *
 * @param workspacePath workspace 根目录
 * @param buffer 渲染后的二进制数据
 * @param mimeType MIME 类型(决定文件扩展名)
 * @returns 写入的文件绝对路径
 */
export async function writeMermaidToWorkspace(
  workspacePath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const mermaidDir = path.join(workspacePath, '.ihui', 'mermaid');
  await fs.mkdir(mermaidDir, { recursive: true });
  const ext = mimeType === 'image/svg+xml' ? 'svg' : 'png';
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fileName = `mermaid-${stamp}.${ext}`;
  const filePath = path.join(mermaidDir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
