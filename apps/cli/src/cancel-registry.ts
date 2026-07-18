/**
 * CancelRegistry — 墓碑模式 Cancel/Abort 协调。
 *
 * 灵感来源:参考行业 Agent 框架 computer-hub-sdk 的 CancelRegistry 设计
 *  (DashMap<id, token> + DashSet<id> pending 墓碑 + cancel-before-register 处理)。
 *
 * 解决了什么问题:
 *   1. **Cancel 比 dispatch 早到的竞态**:UI 用户立刻 abort 上一轮请求,
 *      但 cancel 请求比后端 dispatch 提前到达 → 若没有墓碑,后端 spawn
 *      出孤立任务继续跑(资源泄漏 + 重复处理)。
 *   2. **关停时已派发但未 register 的孤儿**:在 cancelAll() 之后才 register 的
 *      token,需要立即 cancel(防止关停窗口内 spawn 泄漏)。
 *   3. **墓碑膨胀**:长时间会话中,pending 集合无限增长,需要 FIFO 驱逐上限。
 *
 * 设计原则:
 *   - 零依赖,纯 TS,使用 Map/Set + AbortController
 *   - closed 双检:register insert 之后再 re-check closed(避免关停窗口竞态)
 *   - pending 容量上限 8192(对齐行业默认),超限 FIFO 驱逐最早墓碑
 *   - cancel(id) 返回 boolean:true=命中 live / false=未命中(可能已取消或不存在)
 *   - cancelAll() 返回 cancel 的总数
 *   - size() 同时返回 live + pending
 *
 * 用法:
 *   const reg = new CancelRegistry();
 *   const ctrl = new AbortController();
 *   reg.register('call-1', ctrl);             // 注册任务
 *   reg.cancel('call-1');                      // 取消 → ctrl.abort()
 *
 *   // 竞态场景:cancel 先到
 *   reg.cancel('call-2');                      // 写墓碑
 *   const ctrl2 = new AbortController();
 *   reg.register('call-2', ctrl2);             // 命中墓碑,自动 abort
 *
 *   // 关停
 *   const n = reg.cancelAll();                 // 全 cancel + 进入 closed
 *   reg.register('call-3', new AbortController()); // closed=true → 立即 abort
 */

/** pending 集合容量上限(超过则 FIFO 驱逐最早墓碑)。 */
export const CANCEL_REGISTRY_MAX_PENDING = 8192;

export interface CancelRegistryOptions {
  /** pending 容量上限(默认 8192)。 */
  readonly maxPending?: number;
}

export class CancelRegistry {
  private readonly live = new Map<string, AbortController>();
  private readonly pending = new Set<string>();
  private closed = false;
  private readonly maxPending: number;

  constructor(opts: CancelRegistryOptions = {}) {
    this.maxPending = opts.maxPending ?? CANCEL_REGISTRY_MAX_PENDING;
  }

  /**
   * 注册一个 AbortController。
   * - 若 id 已在 pending 墓碑中 → 立即调用 ctrl.abort(),不加入 live
   * - 若 closed=true → 立即 abort,不加入 live
   * - 否则加入 live,返回 true
   *
   * 返回 true 表示"已加入 live";false 表示"立即 abort(墓碑命中或 closed)"。
   */
  register(id: string, ctrl: AbortController): boolean {
    // 双检:insert 之前先看,insert 之后 re-check(关停窗口)
    if (this.closed) {
      this.safeAbort(ctrl);
      return false;
    }
    if (this.pending.has(id)) {
      this.pending.delete(id);
      this.safeAbort(ctrl);
      return false;
    }
    this.live.set(id, ctrl);
    if (this.closed) {
      // 关停竞态:已 insert 但 closed 翻转 → 立即 abort + 清理
      this.live.delete(id);
      this.safeAbort(ctrl);
      return false;
    }
    return true;
  }

  /**
   * 取消一个 id。
   * - 若 id 在 live → abort 并从 live 删除,返回 true
   * - 若 id 不在 live 但加入 pending(墓碑)→ 写入墓碑,返回 true
   * - 若 id 已在 pending(重复 cancel)→ 不重复写,返回 false
   *
   * 返回 true 表示 cancel 请求被"记住"了(live abort 或 pending 写);false 表示
   * 已 cancel 过或不存在。
   */
  cancel(id: string): boolean {
    const live = this.live.get(id);
    if (live) {
      this.live.delete(id);
      this.safeAbort(live);
      return true;
    }
    if (this.pending.has(id)) {
      return false; // 已 cancel,重复
    }
    // 写墓碑 — 先检查容量上限
    if (this.pending.size >= this.maxPending) {
      // FIFO 驱逐最早插入(Set 保留插入顺序)
      const first = this.pending.values().next().value;
      if (first !== undefined) this.pending.delete(first);
    }
    this.pending.add(id);
    return true;
  }

  /**
   * 取消所有 live + 关闭 registry。后续 register 全部立即 abort。
   * pending 墓碑保留(已经 cancel 但还没 register 的 id 仍可被命中)。
   *
   * 返回实际 abort 掉的 live 数量(不包括墓碑)。
   */
  cancelAll(): number {
    let n = 0;
    for (const ctrl of this.live.values()) {
      this.safeAbort(ctrl);
      n++;
    }
    this.live.clear();
    this.closed = true;
    return n;
  }

  /** 重新打开 registry(用于复用)。 */
  reopen(): void {
    this.closed = false;
  }

  /** 清空所有状态(live + pending + closed)。 */
  clear(): void {
    for (const ctrl of this.live.values()) this.safeAbort(ctrl);
    this.live.clear();
    this.pending.clear();
    this.closed = false;
  }

  /** 查询 id 是否在 live。 */
  isLive(id: string): boolean {
    return this.live.has(id);
  }

  /** 查询 id 是否在 pending 墓碑。 */
  isPending(id: string): boolean {
    return this.pending.has(id);
  }

  /** 是否已关停。 */
  isClosed(): boolean {
    return this.closed;
  }

  /** 当前 live 数量。 */
  liveCount(): number {
    return this.live.size;
  }

  /** 当前 pending 墓碑数量。 */
  pendingCount(): number {
    return this.pending.size;
  }

  /** 容量上限。 */
  capacity(): number {
    return this.maxPending;
  }

  /** 安全 abort(已 abort 过的不抛错)。 */
  private safeAbort(ctrl: AbortController): void {
    if (!ctrl.signal.aborted) {
      try {
        ctrl.abort();
      } catch {
        // 某些实现 abort() 会抛(自定义 reason),静默吞
      }
    }
  }
}
