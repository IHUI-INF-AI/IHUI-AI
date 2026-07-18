/**
 * chokidar 动态加载类型声明 — 仅用于 fs-watcher 的 Linux fallback。
 *
 * chokidar 不在 package.json 的硬依赖中(零依赖原则),只在 Linux 下通过
 * 动态 import('chokidar') 加载(用户主动安装后启用)。
 * 此 ambient declaration 让 TypeScript 静态检查通过,运行时若 chokidar 未安装,
 * import() 会 reject,fs-watcher 降级到非递归 fs.watch。
 *
 * 类型为最小子集(只声明 fs-watcher 用到的方法),完整类型见 chokidar 包。
 */
declare module 'chokidar' {
  export interface ChokidarOptions {
    ignored?: string | string[] | ((path: string) => boolean);
    persistent?: boolean;
    ignoreInitial?: boolean;
    depth?: number;
    cwd?: string;
    disableGlobbing?: boolean;
    usePolling?: boolean;
    interval?: number;
    awaitWriteFinish?: boolean | object;
  }

  export interface FSWatcher {
    on(event: 'add' | 'change' | 'unlink', listener: (path: string) => void): this;
    on(event: 'addDir' | 'unlinkDir', listener: (path: string) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'ready' | 'raw', listener: () => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
    close(): Promise<void> | void;
    add(paths: string | string[]): this;
    unwatch(paths: string | string[]): this;
  }

  export function watch(
    paths: string | string[],
    options?: ChokidarOptions,
  ): FSWatcher;

  const _default: {
    watch: typeof watch;
  };
  export default _default;
}
