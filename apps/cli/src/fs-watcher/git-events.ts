/**
 * Git metadata event detector — 区分 .git/ 下的 4 种 metadata 变化 + lock 状态机。
 *
 * 灵感来源:参考行业 fsnotify 框架对 git 内部目录的精细分类:
 *   - HEAD(branch switch / commit / rebase step)
 *   - index(git add / reset / commit)
 *   - refs/(含 packed-refs,ref updates)
 *   - FETCH_HEAD(fetch / pull)
 *
 * 同时实现 lock 状态机:
 *   - 出现 index.lock / gc.pid / refs/<x>.lock  →  GitOperationStarted
 *   - 所有 lock 消失后等待 SETTLE_MS(默认 50ms) →  GitOperationCompleted
 *   - GitOperationCompleted 携带 head_changed:.git/HEAD 内容是否与 started 时不同
 *
 * 设计原则:
 *   - 与 FsEventSource 解耦:独立 watch .git/ 目录,不依赖主 watcher
 *   - 跨平台:Windows/macOS recursive 原生支持,Linux 下用 fs.watch 监听 .git 目录
 *     (注:.git 本身是单层目录,不需要 recursive)
 *   - 零回归:不被调用时(未集成到 FsEventSource)完全无副作用
 *   - 事件派发用 EventEmitter,与主 FsEventSource 的 'event' 通道分开
 *     (避免污染现有的 single-path FsEvent 流)
 *
 * 公开事件:
 *   - 'git-meta' (GitMetaEvent) — 任一 metadata 变化(HEAD/index/refs/fetch_head)
 *   - 'git-op'   (GitOperationEvent) — 操作开始/完成,用于跟踪 git 写操作 burst
 */

import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

/** Git metadata 4 种子类型(与参考 fsnotify 框架对齐)。 */
export type GitMetaKind = 'head' | 'index' | 'refs' | 'fetch_head';

/** 一次 metadata 变化事件。 */
export interface GitMetaEvent {
  kind: GitMetaKind;
  /** 相对 root 的 POSIX 风格路径(例如 .git/HEAD、.git/refs/heads/main) */
  path: string;
  /** 触发时间戳(ms) */
  timestamp: number;
}

/** Lock 状态机事件。 */
export interface GitOperationEvent {
  kind: 'started' | 'completed';
  /** 触发时间戳(ms) */
  timestamp: number;
  /** 仅 completed:HEAD 内容是否与 started 时不同 */
  head_changed?: boolean;
}

/** 内部统计(对外可读)。 */
export interface GitEventDetectorStats {
  totalMetaEvents: number;
  totalOperationStarted: number;
  totalOperationCompleted: number;
  /** 触发 lock 检测但 lock 文件已不存在的"快速 op"计数(参考 fsnotify 框架的 fast-op 概念) */
  fastOps: number;
  /** 当前是否处于 operation in-progress */
  inOperation: boolean;
}

const DEFAULT_SETTLE_MS = 50;
/** git 事件冷却:同一 operation 在冷却窗口内只触发一次,避免 reflog 抖动产生重复事件 */
const DEFAULT_COOLDOWN_MS = 1000;

/** 默认识别的 lock 文件名(参考 fsnotify 框架的 index.lock / gc.pid / .sl 集合)。 */
const LOCK_FILENAMES = new Set(['index.lock', 'gc.pid']);

/**
 * 判断路径是否在 .git/(或指定的 git 目录)内。
 *
 * 接受 POSIX 或 Windows 风格路径;统一为 POSIX 段匹配。
 *
 * @param relPath 相对 root 的路径(可包含前导 ./)
 * @param gitDir  可选,自定义 git 目录名(默认 '.git')
 */
export function isGitPath(relPath: string, gitDir: string = '.git'): boolean {
  if (!relPath) return false;
  const rel = relPath.replace(/\\/g, '/').replace(/^\.\/+/, '');
  // 顶层段必须是 gitDir(不区分大小写,因为 Windows 下 .Git 也常见)
  const firstSlash = rel.indexOf('/');
  const first = firstSlash === -1 ? rel : rel.slice(0, firstSlash);
  return first.toLowerCase() === gitDir.toLowerCase();
}

/**
 * 把 .git/ 内的路径分类为 4 种 metadata 类型之一。
 *
 * 匹配规则(按优先级):
 *   - .git/HEAD             → 'head'
 *   - .git/index            → 'index'
 *   - .git/FETCH_HEAD       → 'fetch_head'
 *   - .git/refs/<...>       → 'refs'
 *   - .git/packed-refs      → 'refs'
 *   - 其他(.lock / gc.pid / hooks / objects 等) → null
 *
 * 注意:.git/index.lock / .git/refs/heads/main.lock 也会被归类为对应 metadata,
 * 因为 lock 期间的"metadata 即将变更"是有效的 metadata 事件信号。
 */
export function classifyGitPath(relPath: string, gitDir: string = '.git'): GitMetaKind | null {
  if (!isGitPath(relPath, gitDir)) return null;
  const rel = relPath.replace(/\\/g, '/').replace(/^\.\/+/, '');
  // 去掉 .git/ 前缀
  const prefix = gitDir.replace(/^\.\/+/, '').replace(/\/+$/, '');
  let inner = rel;
  if (rel.toLowerCase().startsWith(prefix.toLowerCase() + '/')) {
    inner = rel.slice(prefix.length + 1);
  } else if (rel.toLowerCase() === prefix.toLowerCase()) {
    return null; // .git 目录本身没有 metadata 含义
  }
  // 标准化小写比较
  const lower = inner.toLowerCase();

  // HEAD(精确匹配,排除任何 *.lock 等)
  if (lower === 'head') return 'head';
  // index(精确匹配)
  if (lower === 'index') return 'index';
  // FETCH_HEAD(精确匹配)
  if (lower === 'fetch_head') return 'fetch_head';
  // packed-refs 视作 refs
  if (lower === 'packed-refs') return 'refs';
  // refs/<...> 任意子路径
  if (lower === 'refs' || lower.startsWith('refs/')) return 'refs';

  // 其他文件(objects/hooks/logs/...)不属于这 4 种 metadata
  return null;
}

/**
 * 判断文件名是否为已知的 lock 文件(index.lock / gc.pid / *.lock 等)。
 */
function isLockFile(basename: string): boolean {
  if (LOCK_FILENAMES.has(basename)) return true;
  return basename.endsWith('.lock');
}

/**
 * GitEventDetector — 监听 .git/ 目录,派发 metadata + lock 状态机事件。
 *
 * 跨平台说明:
 *   - Windows/macOS:fs.watch('.git', { recursive: true }) 原生支持
 *   - Linux:recursive 通常不支持,.git 本身是单层目录(顶层文件 + refs/ 子目录),
 *     但 refs/ 嵌套层级不确定。默认监听 .git 顶层 + 常用子目录(refs/heads、refs/tags)
 *
 * 用法:
 *   const detector = new GitEventDetector('/path/to/workspace');
 *   detector.on('git-meta', (e) => { ... });
 *   detector.on('git-op',   (e) => { ... });
 *   detector.start();
 *   // ...
 *   detector.stop();
 */
export class GitEventDetector extends EventEmitter {
  private readonly root: string;
  private readonly gitDir: string;
  private readonly settleMs: number;
  private watchers: fs.FSWatcher[] = [];
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private started = false;
  private stats: GitEventDetectorStats = {
    totalMetaEvents: 0,
    totalOperationStarted: 0,
    totalOperationCompleted: 0,
    fastOps: 0,
    inOperation: false,
  };
  /** 处于 operation in-progress 时,记录 started 时的 HEAD 内容(用于 completed 时对比)。 */
  private headSnapshot: string | null = null;
  /** 当前活跃的 lock 路径集合(用于 completed 判定:全部消失 + SETTLE_MS 静默)。 */
  private activeLocks = new Set<string>();
  /** completed 判定用的 debounce timer。 */
  private completionTimer: NodeJS.Timeout | null = null;
  /** P47-D:Cooldown timer(settle 结束后,如 head_changed=true,继续抑制 FilesChanged 500ms)。 */
  private cooldownTimer: NodeJS.Timeout | null = null;
  /** P47-D:Cooldown 截止时间戳(ms)。 */
  private cooldownUntil = 0;
  /** P47-D:状态机当前状态(显式建模 Cooldown 阶段,避免隐式 timing 误判)。 */
  private state: 'idle' | 'in_op' | 'cooldown' = 'idle';
  /** P47-D:Cooldown 期时长(可被 constructor 覆盖)。 */
  private readonly cooldownMs: number;

  constructor(root: string, options: { settleMs?: number; gitDir?: string; cooldownMs?: number } = {}) {
    super();
    this.root = root;
    this.gitDir = options.gitDir ?? '.git';
    this.settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.state = 'idle';
  }

  /** 获取绝对 git 目录路径(.git 存在时返回;不存在返回 null)。 */
  getGitDirPath(): string | null {
    const abs = path.join(this.root, this.gitDir);
    try {
      const st = fs.statSync(abs);
      if (st.isDirectory()) return abs;
    } catch {
      // 不存在或不可访问
    }
    return null;
  }

  /** 启动监听。重复调用安全。.git 不存在时直接 return(不抛错,零回归)。 */
  start(): void {
    if (this.started) return;
    const gitAbs = this.getGitDirPath();
    if (!gitAbs) {
      // .git 不存在 → 静默 no-op
      this.started = true;
      return;
    }
    this.started = true;
    this.tryWatch(gitAbs);
  }

  /**
   * 尝试监听 .git 目录。
   * Windows/macOS 优先用 recursive:true;
   * 失败或 Linux 上,降级为非递归监听(覆盖常见 lock 位置)。
   */
  private tryWatch(gitAbs: string): void {
    try {
      const w = fs.watch(
        gitAbs,
        { recursive: true, persistent: false },
        (eventType, filename) => {
          if (!filename) return;
          const rel = String(filename).replace(/\\/g, '/');
          this.handleGitFsEvent(rel, eventType);
        },
      );
      w.on('error', () => {
        // 监听错误静默
      });
      this.watchers.push(w);
    } catch {
      // recursive 不支持,降级为监听顶层 + 常见子目录
      this.watchNonRecursive(gitAbs);
    }
  }

  /** 非递归 fallback:监听 .git 顶层 + refs/(若存在) + hooks/(若存在)。 */
  private watchNonRecursive(gitAbs: string): void {
    const targets: string[] = [gitAbs];
    for (const sub of ['refs', 'hooks', 'objects']) {
      const abs = path.join(gitAbs, sub);
      try {
        if (fs.statSync(abs).isDirectory()) targets.push(abs);
      } catch {
        // 子目录不存在,跳过
      }
    }
    for (const dir of targets) {
      try {
        const w = fs.watch(
          dir,
          { persistent: false },
          (eventType, filename) => {
            if (!filename) return;
            const rel = path
              .relative(this.root, path.join(dir, String(filename)))
              .replace(/\\/g, '/');
            this.handleGitFsEvent(rel, eventType);
          },
        );
        w.on('error', () => {});
        this.watchers.push(w);
      } catch {
        // 监听单个目录失败,继续尝试下一个
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
    for (const t of this.debounceTimers.values()) {
      clearTimeout(t);
    }
    this.debounceTimers.clear();
    if (this.completionTimer) {
      clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.cooldownUntil = 0;
    this.state = 'idle';
    this.started = false;
  }

  /** 获取统计(用于测试 + 调试)。 */
  getStats(): GitEventDetectorStats {
    return { ...this.stats, inOperation: this.activeLocks.size > 0 };
  }

  /**
   * 内部:处理 .git 内的一条 fs.watch 事件。
   * - 若是 lock 文件 → 触发状态机
   * - 若是 metadata 文件(.git/HEAD 等) → 触发 git-meta 事件
   */
  private handleGitFsEvent(rel: string, _rawEvent: string): void {
    if (!rel) return;
    const basename = path.posix.basename(rel);
    // lock 文件优先处理(状态机)
    if (isLockFile(basename)) {
      this.handleLockEvent(rel, basename);
      return;
    }
    // metadata 分类
    const kind = classifyGitPath(rel, this.gitDir);
    if (!kind) return;
    this.scheduleMetaEvent(rel, kind);
  }

  /** debounce metadata 事件(同路径 50ms 合并)。 */
  private scheduleMetaEvent(rel: string, kind: GitMetaKind): void {
    const key = `${kind}:${rel}`;
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.emitMeta(kind, rel);
    }, this.settleMs);
    this.debounceTimers.set(key, timer);
  }

  private emitMeta(kind: GitMetaKind, rel: string): void {
    const event: GitMetaEvent = {
      kind,
      path: rel,
      timestamp: Date.now(),
    };
    this.stats.totalMetaEvents++;
    this.emit('git-meta', event);
  }

  /**
   * 处理 lock 事件:出现 → started,消失 → 等 SETTLE_MS 静默后 completed。
   * "快速 op" 模式:fs.watch 可能先报 lock 出现、再报 lock 消失(中间没机会读到 lock)。
   * 简化处理:只要收到任一 lock 事件,就视为潜在的 operation 触发。
   */
  private handleLockEvent(rel: string, basename: string): void {
    // 取消进行中的 completed timer(lock 重新出现)
    if (this.completionTimer) {
      clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
    const abs = path.join(this.root, rel);
    let exists = false;
    try {
      exists = fs.existsSync(abs);
    } catch {
      exists = false;
    }
    if (exists) {
      // lock 出现
      if (!this.activeLocks.has(rel)) {
        this.activeLocks.add(rel);
        if (this.activeLocks.size === 1) {
          // 第一次 lock → started
          this.headSnapshot = this.readHeadSnapshot();
          this.stats.totalOperationStarted++;
          this.stats.inOperation = true;
          // P47-D:从 cooldown 进入新 op 时取消 cooldown 计时器(state 切到 in_op)
          if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
            this.cooldownTimer = null;
          }
          this.cooldownUntil = 0;
          this.state = 'in_op';
          const event: GitOperationEvent = {
            kind: 'started',
            timestamp: Date.now(),
          };
          this.emit('git-op', event);
        }
      }
    } else {
      // lock 已消失(可能是 fast-op:出现+消失在同一 fs.watch 批次)
      if (this.activeLocks.has(rel)) {
        this.activeLocks.delete(rel);
      } else {
        // 文件不在 active 集合但已消失 → fast-op 计数
        this.stats.fastOps++;
      }
      this.scheduleCompletion(basename);
    }
  }

  /** 调度 completed 事件(等 SETTLE_MS 静默,看是否还有新 lock)。 */
  private scheduleCompletion(_basename: string): void {
    if (this.completionTimer) {
      clearTimeout(this.completionTimer);
    }
    this.completionTimer = setTimeout(() => {
      this.completionTimer = null;
      // 仍有可能有 lock 残留(没收到消失事件)→ 等到无残留才 completed
      if (this.activeLocks.size > 0) {
        // 还有 lock,继续等待
        this.scheduleCompletion(_basename);
        return;
      }
      const nowHead = this.readHeadSnapshot();
      const head_changed =
        this.headSnapshot !== null && nowHead !== null && this.headSnapshot !== nowHead;
      this.headSnapshot = null;
      this.stats.totalOperationCompleted++;
      const event: GitOperationEvent = {
        kind: 'completed',
        timestamp: Date.now(),
        head_changed,
      };
      this.emit('git-op', event);
      // P47-D:head_changed 时进入 cooldown 阶段,FilesChanged 抑制 500ms。
      if (head_changed) {
        this.enterCooldown();
      } else {
        this.stats.inOperation = false;
        this.state = 'idle';
      }
    }, this.settleMs);
  }

  /**
   * P47-D:进入 cooldown 阶段。
   *
   * 启动 cooldownTimer,到点后 state 回 idle。期间所有 FilesChanged 事件被抑制,
   * 避免 rebase/revert 残余 writes 进入下游。
   *
   * 重新进入 cooldown(已经有 active timer):重置计时器(延长),但保留 cooldownUntil 作为下界。
   */
  private enterCooldown(): void {
    const now = Date.now();
    const newUntil = now + this.cooldownMs;
    this.cooldownUntil = Math.max(this.cooldownUntil, newUntil);
    this.stats.inOperation = true;
    this.state = 'cooldown';
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null;
      this.cooldownUntil = 0;
      // 若期间没有新 lock 进入(应已 settled),state 回 idle
      if (this.state === 'cooldown' && this.activeLocks.size === 0) {
        this.stats.inOperation = false;
        this.state = 'idle';
      }
    }, this.cooldownUntil - now);
  }

  /**
   * P47-D:判断当前是否处于 FilesChanged 抑制期(cooldown 阶段)。
   *
   * 在 git-events 内部用,in-op 阶段不抑制 FilesChanged(Settling 期间继续流),
   * 但 Cooldown 期抑制(避免 rebase 残余 writes 触发下游 hunk refresh)。
   */
  isInCooldown(): boolean {
    return this.state === 'cooldown' && Date.now() < this.cooldownUntil;
  }

  /** 读取 .git/HEAD 当前内容(失败返回 null)。 */
  private readHeadSnapshot(): string | null {
    const headPath = path.join(this.root, this.gitDir, 'HEAD');
    try {
      return fs.readFileSync(headPath, 'utf-8');
    } catch {
      return null;
    }
  }
}
