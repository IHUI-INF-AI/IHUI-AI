/**
 * Subagent 对等协作系统 — 深度对标并反超 OpenClaw 的 multi-agent 协作。
 *
 * 核心差异(对 OpenClaw 主从模式):
 *   - 对等模式:subagent 之间可直接通信,无需主 agent 中转(mesh 拓扑)
 *   - 协作拓扑:star / mesh / chain / hierarchical 四种,按拓扑决定消息路由
 *   - 共享黑板(blackboard 模式):所有 subagent 读写同一份共享状态(Map + watch)
 *   - 冲突仲裁:多个 subagent 改同一文件时,按策略(last-write-wins/merge/voting/escalate)仲裁
 *
 * 做减法:
 *   - 消息总线用内存 EventTarget(Node.js 内置),不走网络
 *   - 黑板用内存 Map,不持久化
 *   - SubagentPeer.executeTask 不直接调用 LLM(会与 agent.ts 冲突),改为接受外部注入的 executor
 *   - 所有"需要 LLM"的地方都用 stub + 注入点,主 agent 后续集成真实 executor
 *
 * 仅依赖 Node.js 内置,不引入新依赖。
 */

// ───────────────────────────── 类型定义 ─────────────────────────────

/** 协作拓扑。star=主从 / mesh=对等全连接 / chain=链式 / hierarchical=树状 */
type Topology = 'star' | 'mesh' | 'chain' | 'hierarchical';

/** Peer 间消息。toPeerId='*' 表示广播 */
interface PeerMessage {
  fromPeerId: string;
  toPeerId: string;
  type: 'task' | 'result' | 'query' | 'notify' | 'handoff';
  content: string;
  timestamp: number;
  /** 关联的任务 ID(可选) */
  taskId?: string;
}

/** 任务执行结果 */
interface TaskResult {
  taskId: string;
  assignedPeerId: string;
  status: 'completed' | 'failed' | 'delegated';
  output: string;
  /** 执行耗时(ms) */
  duration: number;
}

/** 冲突仲裁结果 */
interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'voting' | 'escalate';
  /** 胜出 peerId(last-write-wins / voting 有值) */
  winner?: string;
  /** 合并后内容(merge / last-write-wins 有值) */
  mergedContent?: string;
  reason: string;
}

/** 黑板条目 */
interface BlackboardEntry {
  value: unknown;
  writerId: string;
  updatedAt: number;
}

/** 共享黑板接口(blackboard 模式,所有 peer 可读写) */
interface Blackboard {
  set(key: string, value: unknown, writerId: string): void;
  get(key: string): unknown;
  watch(key: string, handler: (value: unknown, writerId: string) => void): void;
  list(): Map<string, BlackboardEntry>;
}

// ───────────────────────────── SubagentPeer ─────────────────────────────

/**
 * 对等节点(SubagentPeer)— 一个 subagent 实例。
 *
 * 与 OpenClaw 主从模式不同,peer 之间可直接 sendMessage/broadcast,
 * 无需主 agent 中转。消息通过 CollaborationManager 的内部 EventTarget 总线路由。
 *
 * executeTask 不直接调 LLM,改为接受外部注入的 executor 函数,
 * 默认 stub 返回 `[<role>] stub execution for: <task>`,主 agent 后续注入真实 executor。
 */
class SubagentPeer {
  readonly id: string;
  readonly role: string;
  readonly model: string;
  readonly workspacePath: string;

  /** 外部注入的任务执行器(默认 stub) */
  private readonly executor: (task: string) => Promise<string>;
  /** 收到消息的 handler 列表 */
  private readonly messageHandlers: Array<(msg: PeerMessage) => Promise<void>> = [];
  /** 由 CollaborationManager 注入的消息发射器(发到内部 EventTarget 总线) */
  private _emit: ((msg: PeerMessage) => void) | null = null;
  /** 累计执行任务次数(mesh 拓扑据此挑最闲 peer) */
  private _executeCount = 0;

  constructor(opts: {
    id: string;
    role: string;
    model: string;
    workspacePath: string;
    /** 外部注入的执行器;不传则用 stub,主 agent 后续注入真实 LLM executor */
    executor?: (task: string) => Promise<string>;
  }) {
    this.id = opts.id;
    this.role = opts.role;
    this.model = opts.model;
    this.workspacePath = opts.workspacePath;
    this.executor = opts.executor ?? (async (task: string) =>
      `[${this.role}] stub execution for: ${task.slice(0, 50)}`);
  }

  /**
   * 由 CollaborationManager.registerPeer 注入消息发射器。
   * peer 调 sendMessage 时通过它把消息投递到内部 EventTarget 总线。
   * @internal
   */
  _attachEmit(emit: (msg: PeerMessage) => void): void {
    this._emit = emit;
  }

  /**
   * 由 CollaborationManager 调用:把总线送达的消息投递给本 peer 的所有 handler。
   * @internal
   */
  async _deliver(msg: PeerMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      await handler(msg);
    }
  }

  /**
   * 当前累计执行任务次数(mesh 路由挑最闲 peer 时用)。
   * @internal
   */
  _getExecuteCount(): number {
    return this._executeCount;
  }

  /**
   * 发送消息给指定 peer(对等通信)。
   * toPeerId='*' 表示广播。消息经 CollaborationManager 内部 EventTarget 总线路由。
   */
  async sendMessage(
    toPeerId: string,
    message: string,
    opts?: { type?: PeerMessage['type']; taskId?: string },
  ): Promise<PeerMessage> {
    const msg: PeerMessage = {
      fromPeerId: this.id,
      toPeerId,
      type: opts?.type ?? 'notify',
      content: message,
      timestamp: Date.now(),
      taskId: opts?.taskId,
    };
    // 经注入的发射器投到总线;未注册到 manager 时静默丢弃(stub 行为)
    this._emit?.(msg);
    return msg;
  }

  /** 广播消息给所有 peer(toPeerId='*') */
  async broadcast(
    message: string,
    opts?: { type?: PeerMessage['type']; taskId?: string },
  ): Promise<void> {
    await this.sendMessage('*', message, opts);
  }

  /** 注册消息 handler,收到消息时回调 */
  onMessage(handler: (msg: PeerMessage) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  /** 执行任务(本地 executor),返回 TaskResult */
  async executeTask(task: string): Promise<TaskResult> {
    const start = Date.now();
    this._executeCount += 1;
    let status: TaskResult['status'] = 'completed';
    let output: string;
    try {
      output = await this.executor(task);
    } catch (e) {
      status = 'failed';
      output = e instanceof Error ? e.message : String(e);
    }
    return {
      taskId: `task-${this.id}-${this._executeCount}`,
      assignedPeerId: this.id,
      status,
      output,
      duration: Date.now() - start,
    };
  }
}

// ───────────────────────────── CollaborationManager ─────────────────────────────

/**
 * 协作管理器 — 管理一组 SubagentPeer,按拓扑决定任务路由,提供共享黑板与冲突仲裁。
 *
 * 路由策略(按拓扑):
 *   - star:dispatchTask 发给主 agent(隐式 peer id 'main'),主 agent 再分发
 *   - mesh:dispatchTask 直接发给最闲 peer(executeCount 最小,可选 preferredRole 过滤)
 *   - chain:dispatchTask 发给链头 peer,完成后自动 handoff 给下一个,返回末 peer 结果
 *   - hierarchical:dispatchTask 发给对应角色组长(首个匹配角色 peer),组长执行
 */
class CollaborationManager {
  /** 隐式主 agent peer id(star 拓扑的中转枢纽) */
  static readonly MAIN_PEER_ID = 'main';

  readonly topology: Topology;
  readonly workspacePath: string;

  private readonly peers: Map<string, SubagentPeer> = new Map();
  /** peer 注册顺序(chain 拓扑按此顺序串联) */
  private readonly peerOrder: string[] = [];
  /** 内部消息总线(内存 EventTarget,不走网络) */
  private readonly bus: EventTarget = new EventTarget();
  /** 黑板存储 */
  private readonly bbStore: Map<string, BlackboardEntry> = new Map();
  /** 黑板 key → watcher 集合 */
  private readonly bbWatchers: Map<string, Set<(value: unknown, writerId: string) => void>> = new Map();
  /** 黑板门面(惰性创建一次) */
  private readonly _blackboard: Blackboard;

  constructor(opts: { workspacePath: string; topology: Topology }) {
    this.workspacePath = opts.workspacePath;
    this.topology = opts.topology;
    this._blackboard = this.createBlackboard();
    // 总线监听:收到 peer-msg 事件后路由到目标 peer
    this.bus.addEventListener('peer-msg', (e) => {
      const msg = (e as CustomEvent<PeerMessage>).detail;
      void this.routeMessage(msg);
    });
  }

  /** 共享黑板(blackboard 模式,所有 peer 可读写) */
  get blackboard(): Blackboard {
    return this._blackboard;
  }

  /** 注册 peer:注入消息发射器,纳入拓扑 */
  registerPeer(peer: SubagentPeer): void {
    if (!this.peers.has(peer.id)) {
      this.peerOrder.push(peer.id);
    }
    this.peers.set(peer.id, peer);
    // 注入发射器:peer.sendMessage → 总线 dispatchEvent
    peer._attachEmit((msg) => {
      this.bus.dispatchEvent(new CustomEvent<PeerMessage>('peer-msg', { detail: msg }));
    });
  }

  /**
   * 派发任务:按拓扑决定路由。
   * @param task 任务描述
   * @param opts.preferredRole 偏好角色(mesh/hierarchical 过滤候选)
   */
  async dispatchTask(
    task: string,
    opts?: { preferredRole?: string },
  ): Promise<TaskResult> {
    switch (this.topology) {
      case 'star':
        return this.dispatchStar(task);
      case 'mesh':
        return this.dispatchMesh(task, opts);
      case 'chain':
        return this.dispatchChain(task);
      case 'hierarchical':
        return this.dispatchHierarchical(task, opts);
    }
  }

  /**
   * 冲突仲裁:多个 peer 同时改同一文件时按策略仲裁。
   * @param filePath 冲突文件路径
   * @param proposals 各 peer 的提案
   * @param opts.strategy 仲裁策略(默认 last-write-wins)
   *
   * 策略说明:
   *   - last-write-wins:最后写入的 proposal 胜出(默认,快速)
   *   - merge:用 LLM 合并多个 proposal(需 LLM 调用,当前降级为 last-write-wins)
   *   - voting:peer 投票多数胜出(需投票逻辑,当前降级为 last-write-wins)
   *   - escalate:上报主 agent 决策
   */
  arbitrateConflict(
    filePath: string,
    proposals: Array<{ peerId: string; content: string; reason: string }>,
    opts?: { strategy?: ConflictResolution['strategy'] },
  ): ConflictResolution {
    const strategy = opts?.strategy ?? 'last-write-wins';
    if (proposals.length === 0) {
      return { strategy: 'last-write-wins', reason: `no proposals for ${filePath}` };
    }
    const last = proposals[proposals.length - 1]!;
    switch (strategy) {
      case 'last-write-wins':
        return {
          strategy: 'last-write-wins',
          winner: last.peerId,
          mergedContent: last.content,
          reason: `last write by ${last.peerId} wins for ${filePath}`,
        };
      case 'merge':
        // 需要 LLM 合并多个 proposal,当前降级为 last-write-wins
        return {
          strategy: 'last-write-wins',
          winner: last.peerId,
          mergedContent: last.content,
          reason: `merge requires LLM call, degraded to last-write-wins for ${filePath}`,
        };
      case 'voting':
        // 需要 peer 投票逻辑,当前降级为 last-write-wins
        return {
          strategy: 'last-write-wins',
          winner: last.peerId,
          mergedContent: last.content,
          reason: `voting requires peer quorum, degraded to last-write-wins for ${filePath}`,
        };
      case 'escalate':
        return {
          strategy: 'escalate',
          reason: `escalated to main agent for ${filePath}`,
        };
    }
  }

  /** 拓扑可视化(ASCII 图):peer 用 [id:role] 框,连线按拓扑区分 */
  visualizeTopology(): string {
    const peers = [...this.peers.values()];
    const header = `Topology: ${this.topology}`;
    let body: string;
    switch (this.topology) {
      case 'star':
        body = this.visualizeStar(peers);
        break;
      case 'mesh':
        body = this.visualizeMesh(peers);
        break;
      case 'chain':
        body = this.visualizeChain(peers);
        break;
      case 'hierarchical':
        body = this.visualizeHierarchical(peers);
        break;
    }
    return `${header}\n${body}`;
  }

  // ───────────────────────── 路由实现 ─────────────────────────

  /** star:发给主 agent(id 'main'),若无 main peer 取首个 peer 充当枢纽 */
  private async dispatchStar(task: string): Promise<TaskResult> {
    const hubId = this.peers.has(CollaborationManager.MAIN_PEER_ID)
      ? CollaborationManager.MAIN_PEER_ID
      : this.peerOrder[0];
    if (!hubId) {
      throw new Error(`star dispatch: no peers registered (workspace: ${this.workspacePath})`);
    }
    const hub = this.peers.get(hubId);
    if (!hub) {
      throw new Error(`star dispatch: hub peer missing (workspace: ${this.workspacePath})`);
    }
    return hub.executeTask(task);
  }

  /** mesh:发给最闲 peer(executeCount 最小),可选 preferredRole 过滤 */
  private async dispatchMesh(
    task: string,
    opts?: { preferredRole?: string },
  ): Promise<TaskResult> {
    const all = [...this.peers.values()];
    const candidates = opts?.preferredRole
      ? all.filter((p) => p.role === opts.preferredRole)
      : all;
    if (candidates.length === 0) {
      throw new Error(`mesh dispatch: no peers registered (workspace: ${this.workspacePath})`);
    }
    candidates.sort((a, b) => a._getExecuteCount() - b._getExecuteCount());
    const target = candidates[0]!;
    return target.executeTask(task);
  }

  /** chain:发给链头,完成后 handoff 给下一个,返回末 peer 结果 */
  private async dispatchChain(task: string): Promise<TaskResult> {
    if (this.peerOrder.length === 0) {
      throw new Error(`chain dispatch: no peers registered (workspace: ${this.workspacePath})`);
    }
    const start = Date.now();
    let currentTask = task;
    let lastResult: TaskResult | null = null;
    for (let i = 0; i < this.peerOrder.length; i++) {
      const peerId = this.peerOrder[i]!;
      const peer = this.peers.get(peerId);
      if (!peer) {
        throw new Error(`chain dispatch: peer ${peerId} missing`);
      }
      const result = await peer.executeTask(currentTask);
      lastResult = result;
      const isLast = i === this.peerOrder.length - 1;
      if (!isLast) {
        const nextPeerId = this.peerOrder[i + 1]!;
        // handoff:通知下一个 peer 接力(异步投递,不阻塞链执行)
        await peer.sendMessage(nextPeerId, `handoff: ${result.output}`, {
          type: 'handoff',
          taskId: result.taskId,
        });
        currentTask = `continue from: ${result.output}`;
      }
    }
    // 末 peer 的结果为代表,耗时覆盖整条链
    return {
      taskId: lastResult!.taskId,
      assignedPeerId: lastResult!.assignedPeerId,
      status: lastResult!.status,
      output: lastResult!.output,
      duration: Date.now() - start,
    };
  }

  /** hierarchical:派给对应角色组长(首个匹配角色 peer),无偏好则取根节点(首个 peer) */
  private async dispatchHierarchical(
    task: string,
    opts?: { preferredRole?: string },
  ): Promise<TaskResult> {
    if (opts?.preferredRole) {
      const lead = [...this.peers.values()].find((p) => p.role === opts.preferredRole);
      if (lead) return lead.executeTask(task);
    }
    const rootId = this.peerOrder[0];
    if (!rootId) {
      throw new Error(`hierarchical dispatch: no peers registered (workspace: ${this.workspacePath})`);
    }
    const root = this.peers.get(rootId);
    if (!root) {
      throw new Error(`hierarchical dispatch: root peer missing (workspace: ${this.workspacePath})`);
    }
    // 完整树状分发需要组定义,当前 stub:组长执行,组员通过 handoff 通知可后续扩展
    return root.executeTask(task);
  }

  // ───────────────────────── 消息总线 ─────────────────────────

  /** 总线消息路由:广播 → 全员(除发送者);单播 → 目标 peer */
  private async routeMessage(msg: PeerMessage): Promise<void> {
    if (msg.toPeerId === '*') {
      for (const peer of this.peers.values()) {
        if (peer.id !== msg.fromPeerId) {
          await peer._deliver(msg);
        }
      }
    } else {
      const target = this.peers.get(msg.toPeerId);
      if (target) {
        await target._deliver(msg);
      }
      // 目标不存在:静默丢弃(stub 行为,真实实现可上报主 agent)
    }
  }

  // ───────────────────────── 黑板 ─────────────────────────

  /** 创建黑板门面(绑定到本 manager 的内部 Map) */
  private createBlackboard(): Blackboard {
    return {
      set: (key, value, writerId) => {
        const entry: BlackboardEntry = { value, writerId, updatedAt: Date.now() };
        this.bbStore.set(key, entry);
        const watchers = this.bbWatchers.get(key);
        if (watchers) {
          for (const w of watchers) w(value, writerId);
        }
      },
      get: (key) => this.bbStore.get(key)?.value,
      watch: (key, handler) => {
        let set = this.bbWatchers.get(key);
        if (!set) {
          set = new Set();
          this.bbWatchers.set(key, set);
        }
        set.add(handler);
      },
      list: () => new Map(this.bbStore),
    };
  }

  // ───────────────────────── 拓扑可视化 ─────────────────────────

  /** star:枢纽 [main:hub] 在顶,各 peer 用 | 连线下挂 */
  private visualizeStar(peers: SubagentPeer[]): string {
    if (peers.length === 0) return '(no peers)';
    const lines: string[] = [`[${CollaborationManager.MAIN_PEER_ID}:hub]`];
    for (const p of peers) {
      if (p.id === CollaborationManager.MAIN_PEER_ID) continue;
      lines.push('  |');
      lines.push(`  [${p.id}:${p.role}]`);
    }
    return lines.join('\n');
  }

  /** mesh:2 列网格,同行用 -- 连接,跨行用 | 对齐到框中心 */
  private visualizeMesh(peers: SubagentPeer[]): string {
    if (peers.length === 0) return '(no peers)';
    const boxes = peers.map((p) => `[${p.id}:${p.role}]`);
    const maxW = Math.max(...boxes.map((b) => b.length));
    const padded = boxes.map((b) => b.padEnd(maxW));
    const SEP = ' -- ';
    const rows: string[] = [];
    for (let i = 0; i < padded.length; i += 2) {
      const a = padded[i]!;
      const b = i + 1 < padded.length ? padded[i + 1]! : null;
      rows.push(b ? `${a}${SEP}${b}` : a);
      // 还有下一行 → 生成垂直连接行
      if (i + 2 < padded.length) {
        const ca = Math.floor(maxW / 2);
        const cb = b ? maxW + SEP.length + Math.floor(maxW / 2) : ca;
        const width = Math.max(ca, cb) + 1;
        const arr = new Array<string>(width).fill(' ');
        arr[ca] = '|';
        if (b) arr[cb] = '|';
        rows.push(arr.join(''));
      }
    }
    return rows.join('\n');
  }

  /** chain:线性 A -> B -> C */
  private visualizeChain(peers: SubagentPeer[]): string {
    if (peers.length === 0) return '(no peers)';
    return peers.map((p) => `[${p.id}:${p.role}]`).join(' -> ');
  }

  /** hierarchical:根节点在顶,子节点用 +-- 下挂 */
  private visualizeHierarchical(peers: SubagentPeer[]): string {
    if (peers.length === 0) return '(no peers)';
    const root = peers[0]!;
    const lines: string[] = [`[${root.id}:${root.role}]`];
    for (let i = 1; i < peers.length; i++) {
      lines.push(`  +-- [${peers[i]!.id}:${peers[i]!.role}]`);
    }
    return lines.join('\n');
  }
}

// ───────────────────────────── 公共导出 ─────────────────────────────

export {
  SubagentPeer,
  CollaborationManager,
  type Topology,
  type PeerMessage,
  type TaskResult,
  type ConflictResolution,
};

// ───────────────────────────── 子进程并行 spawnParallel ─────────────────────────────
// 扩展:基于 SubagentWorkerPool 的真子进程并行 spawn,按拓扑决定任务分派。
// 与 CollaborationManager(单进程 async executor)互补:需要 OS 级真并行时用 spawnParallel。

import { SubagentWorkerPool, defaultWorkerPoolConfig } from '../subagents/worker-pool.js';
import type { SubagentSpawnRequest, SubagentSpawnResponse } from '@ihui/types';

/**
 * 按拓扑并行 spawn N 个子 agent(真子进程 fork 并行,非单进程 async)。
 *
 * 拓扑分派:
 *   - star: 主 agent 中转(所有结果回流给调用方,调用方决定后续路由)
 *   - mesh: 直接并行(所有子 agent 同时跑,结果直接返回)
 *   - chain: 串行 handoff(前一个子 agent 的输出作为后一个的输入)
 *   - hierarchical: 按角色组长(每个角色的首个子 agent 先跑,其余后跑)
 *
 * 内部复用 SubagentWorkerPool(fork 子进程),与 CollaborationManager(单进程)互补。
 *
 * @param reqs spawn 请求数组
 * @param opts.topology 协作拓扑(默认 star)
 * @param opts.maxWorkers 最大并发(默认 4)
 */
export async function spawnParallel(
  reqs: SubagentSpawnRequest[],
  opts?: { topology?: Topology; maxWorkers?: number },
): Promise<SubagentSpawnResponse[]> {
  if (reqs.length === 0) return [];
  const topology = opts?.topology ?? 'star';
  const maxWorkers = opts?.maxWorkers ?? 4;
  const pool = new SubagentWorkerPool(defaultWorkerPoolConfig({ maxWorkers }));

  try {
    switch (topology) {
      case 'chain':
        return await spawnChainHandoff(pool, reqs);
      case 'hierarchical':
        return await spawnHierarchicalGrouped(pool, reqs);
      case 'star':
      case 'mesh':
      default:
        return await pool.spawnParallel(reqs);
    }
  } finally {
    await pool.shutdown();
  }
}

/** chain 拓扑:串行 handoff,前一个子 agent 的输出附加到后一个的 task */
async function spawnChainHandoff(
  pool: SubagentWorkerPool,
  reqs: SubagentSpawnRequest[],
): Promise<SubagentSpawnResponse[]> {
  const results: SubagentSpawnResponse[] = [];
  let prevOutput: string | undefined;
  for (const req of reqs) {
    const task = prevOutput
      ? `${req.task}\n\n[前序子 agent 结果]\n${prevOutput.slice(0, 2000)}`
      : req.task;
    const resp = await pool.spawn({ ...req, task });
    results.push(resp);
    prevOutput = resp.output;
  }
  return results;
}

/** hierarchical 拓扑:按角色分组,每个角色的首个(组长)先跑,其余后跑 */
async function spawnHierarchicalGrouped(
  pool: SubagentWorkerPool,
  reqs: SubagentSpawnRequest[],
): Promise<SubagentSpawnResponse[]> {
  const seenPersonas = new Set<string>();
  const leads: SubagentSpawnRequest[] = [];
  const followers: SubagentSpawnRequest[] = [];
  for (const req of reqs) {
    if (seenPersonas.has(req.persona)) {
      followers.push(req);
    } else {
      seenPersonas.add(req.persona);
      leads.push(req);
    }
  }
  const leadResults = await pool.spawnParallel(leads);
  const followerResults = followers.length > 0 ? await pool.spawnParallel(followers) : [];
  return [...leadResults, ...followerResults];
}
