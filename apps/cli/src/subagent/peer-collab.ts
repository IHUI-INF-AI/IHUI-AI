/**
 * PeerCollab — 对等协作 + lane 隔离。
 * - spawn(task, lane): 派生对等 peer 执行 task,返回 peer 句柄(含 inbox)
 * - broadcast(msg): 向所有 peer 广播消息(写入 inbox)
 * - isolate(laneId): 返回仅含指定 lane 的隔离视图(深拷贝,互不影响)
 * 平台独占:仅 cli(W2-4 Subagent 协作,对标 OpenClaw subagent mesh)。
 */
import * as crypto from 'node:crypto';

export type PeerStatus = 'running' | 'done' | 'failed';

export interface Peer {
  id: string;
  task: string;
  lane: string;
  status: PeerStatus;
  inbox: string[];
}

export class PeerCollab {
  private readonly peers = new Map<string, Peer>();
  private readonly lanes = new Set<string>();

  /** 派生对等 peer,返回句柄。 */
  spawn(task: string, lane = 'default'): Peer {
    const peer: Peer = {
      id: crypto.randomUUID(),
      task,
      lane,
      status: 'running',
      inbox: [],
    };
    this.peers.set(peer.id, peer);
    this.lanes.add(lane);
    return peer;
  }

  /** 向所有 peer 广播消息(写入各自 inbox)。 */
  broadcast(msg: string): void {
    for (const peer of this.peers.values()) {
      peer.inbox.push(msg);
    }
  }

  /** 返回指定 lane 的隔离视图(深拷贝,与原集合互不影响)。 */
  isolate(laneId: string): PeerCollab {
    const view = new PeerCollab();
    for (const peer of this.peers.values()) {
      if (peer.lane === laneId) {
        view.peers.set(peer.id, { ...peer, inbox: [...peer.inbox] });
      }
    }
    if (this.lanes.has(laneId)) {
      view.lanes.add(laneId);
    }
    return view;
  }

  /** 全部 peer(只读副本)。 */
  list(): Peer[] {
    return [...this.peers.values()];
  }

  /** 标记 peer 完成,返回是否找到。 */
  markDone(id: string): boolean {
    const peer = this.peers.get(id);
    if (!peer) return false;
    peer.status = 'done';
    return true;
  }

  /** 当前 peer 数。 */
  get size(): number {
    return this.peers.size;
  }
}
