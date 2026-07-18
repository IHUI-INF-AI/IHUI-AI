/**
 * 跨平台文件监听 — 基于 Node fs.watch + 自实现 50ms debounce。
 *
 * 灵感来源:参考行业 Agent 框架的 fsnotify 集成,让 LLM 感知工作区文件变更。
 * 简化策略(做减法):
 *   - 不引入 chokidar,纯 Node 内置 fs.watch(recursive: true 仅 Windows/macOS 原生支持,
 *     Linux 下 fallback 为非递归监听根目录,事件不完整但不抛错)
 *   - 50ms debounce:同一路径多次变更合并为一次事件,避免编辑器保存触发风暴
 *   - shouldIgnore 基础 glob 匹配(node_modules / .git / dist 等),不引入 ignore 包
 *   - 保留最近 N 条事件供 getRecentEvents(sinceMs) 查询
 *
 * Feature flag:settings.fsWatcher.enabled 默认 false,启用后才注入 agent 上下文。
 */

import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export type FsEventKind = 'create' | 'modify' | 'delete' | 'rename';

export interface FsEvent {
  kind: FsEventKind;
  /** 相对 root 的路径(POSIX 风格,跨平台一致) */
  path: string;
  /** 触发时间戳(ms) */
  timestamp: number;
}

const DEFAULT_IGNORE_PATTERNS = ['node_modules', '.git', 'dist', '.next', '.turbo', '.cache'];

/** 最大保留事件数(环形缓冲,避免内存膨胀) */
const MAX_RECENT_EVENTS = 200;

/**
 * 简单 ignore 匹配:支持字面量与基础 glob(star 和 double-star),不引入 ignore 包。
 * 仅匹配相对路径的任一段:如 'node_modules' 匹配路径任一段为 node_modules;
 * 'dot log' 模式匹配文件名; 'double-star dot slash dot tmp' 匹配任意层级 tmp 文件。
 */
export function shouldIgnore(filePath: string, patterns: string[]): boolean {
  if (!filePath) return false;
  // 统一为 POSIX 风格相对路径
  const rel = filePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
  const segments = rel.split('/');
  for (const pat of patterns) {
    if (!pat) continue;
    // 字面量段(无 glob 字符):匹配路径任一段
    if (!/[*?]/.test(pat)) {
      if (segments.includes(pat)) return true;
      // 也匹配前缀目录(如 '.git/refs' 触发 '.git')
      if (segments.some((s) => s === pat)) return true;
      continue;
    }
    // glob 模式:转 RegExp
    const regex = globToRegExp(pat);
    // 整路径匹配或任一段匹配
    if (regex.test(rel)) return true;
    if (segments.some((s) => regex.test(s))) return true;
  }
  return false;
}

function globToRegExp(pat: string): RegExp {
  let re = '';
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === '*') {
      // ** 后紧跟 / :匹配任意层级(含 0 层,即根路径),/ 可选
      if (pat[i + 1] === '*' && pat[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2; // 跳过 ** 和 /
      } else if (pat[i + 1] === '*') {
        // 单独 ** 匹配任意字符(含 /)
        re += '.*';
        i++; // 跳过第二个 *
      } else {
        // * 匹配非 /
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c ?? '')) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * 跨平台文件监听源。
 *
 * - Windows/macOS:fs.watch(root, { recursive: true }) 原生支持递归监听
 * - Linux:recursive 参数被忽略,fallback 监听根目录(子目录变更可能丢失,但不抛错)
 * - 50ms debounce:同一路径多次事件合并为一次 modify/create/delete
 * - EventEmitter 派发 'event' (FsEvent) 事件
 */
export class FsEventSource extends EventEmitter {
  private watchers: fs.FSWatcher[] = [];
  private debounceMap = new Map<string, NodeJS.Timeout>();
  private readonly SETTLE_MS = 50;
  private stats = { totalEvents: 0, droppedByDebounce: 0 };
  private recentEvents: FsEvent[] = [];
  private started = false;

  constructor(
    private readonly root: string,
    private readonly ignore: string[] = DEFAULT_IGNORE_PATTERNS,
  ) {
    super();
  }

  /** 启动监听。重复调用安全(已启动时直接 return)。 */
  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      const watcher = fs.watch(
        this.root,
        { recursive: true, persistent: false },
        (eventType, filename) => {
          if (!filename) return;
          const absPath = path.isAbsolute(filename)
            ? filename
            : path.join(this.root, filename);
          const rel = path.relative(this.root, absPath).replace(/\\/g, '/');
          if (shouldIgnore(rel, this.ignore)) return;
          this.scheduleDebounce(rel, eventType);
        },
      );
      watcher.on('error', () => {
        // 监听错误不抛出,保持链路稳定
      });
      this.watchers.push(watcher);
    } catch {
      // recursive 不支持时 fallback 为非递归监听根目录
      try {
        const watcher = fs.watch(
          this.root,
          { persistent: false },
          (eventType, filename) => {
            if (!filename) return;
            const rel = String(filename).replace(/\\/g, '/');
            if (shouldIgnore(rel, this.ignore)) return;
            this.scheduleDebounce(rel, eventType);
          },
        );
        watcher.on('error', () => {});
        this.watchers.push(watcher);
      } catch {
        // 完全不支持时静默失败(零回归)
        this.started = false;
      }
    }
  }

  /** 停止所有监听并清理 debounce 计时器。 */
  stop(): void {
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        // 忽略关闭错误
      }
    }
    this.watchers = [];
    for (const t of this.debounceMap.values()) {
      clearTimeout(t);
    }
    this.debounceMap.clear();
    this.started = false;
  }

  /** 获取统计信息(用于调试 + 测试) */
  getStats(): { totalEvents: number; droppedByDebounce: number } {
    return { ...this.stats };
  }

  /** 查询 sinceMs 之后的所有事件(按时间升序) */
  getRecentEvents(sinceMs: number): FsEvent[] {
    const cutoff = Date.now() - sinceMs;
    return this.recentEvents.filter((e) => e.timestamp >= cutoff);
  }

  /** 内部:debounce + 事件派发 */
  private scheduleDebounce(relPath: string, rawEventType: string): void {
    const existing = this.debounceMap.get(relPath);
    if (existing) {
      clearTimeout(existing);
      this.stats.droppedByDebounce++;
    }
    const timer = setTimeout(() => {
      this.debounceMap.delete(relPath);
      const kind = this.classifyKind(relPath, rawEventType);
      const event: FsEvent = {
        kind,
        path: relPath,
        timestamp: Date.now(),
      };
      this.stats.totalEvents++;
      this.recordEvent(event);
      this.emit('event', event);
    }, this.SETTLE_MS);
    this.debounceMap.set(relPath, timer);
  }

  /** 根据 rawEventType + 文件存在性推断事件类型 */
  private classifyKind(relPath: string, rawEventType: string): FsEventKind {
    const abs = path.join(this.root, relPath);
    let exists = false;
    try {
      exists = fs.existsSync(abs);
    } catch {
      exists = false;
    }
    if (rawEventType === 'rename') {
      return exists ? 'create' : 'delete';
    }
    if (!exists) return 'delete';
    if (rawEventType === 'change') return 'modify';
    return 'modify';
  }

  /** 环形缓冲:保留最近 MAX_RECENT_EVENTS 条事件 */
  private recordEvent(event: FsEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.shift();
    }
  }
}

/** 默认 ignore 列表(导出供测试 + settings 注入) */
export const DEFAULT_FS_WATCHER_IGNORE = DEFAULT_IGNORE_PATTERNS;
