/**
 * HierarchyManager — 层级协作 parent→child。
 * - spawnChild(task): 派生子 agent,返回 child 句柄
 * - reportToParent(result): 向 parent 上报结果(标记最近 running 的 child 为 done)
 * 平台独占:仅 cli(W2-4 Subagent 协作,对标 OpenClaw subagent hierarchy)。
 */
import * as crypto from 'node:crypto';

export type ChildStatus = 'running' | 'done' | 'failed';

export interface ChildAgent {
  id: string;
  task: string;
  status: ChildStatus;
  result?: unknown;
}

export interface ChildReport {
  childId: string;
  result: unknown;
  ts: number;
}

export class HierarchyManager {
  private readonly children = new Map<string, ChildAgent>();
  private readonly reports: ChildReport[] = [];

  /** 派生子 agent,返回句柄。 */
  spawnChild(task: string): ChildAgent {
    const child: ChildAgent = {
      id: crypto.randomUUID(),
      task,
      status: 'running',
    };
    this.children.set(child.id, child);
    return child;
  }

  /** 向 parent 上报结果:标记最近一个 running 的 child 为 done,记录上报。 */
  reportToParent(result: unknown): void {
    let target: ChildAgent | undefined;
    for (const child of this.children.values()) {
      if (child.status === 'running') {
        target = child;
        break;
      }
    }
    if (target) {
      target.result = result;
      target.status = 'done';
    }
    this.reports.push({
      childId: target?.id ?? 'unknown',
      result,
      ts: Date.now(),
    });
  }

  /** 全部 child(只读副本)。 */
  listChildren(): ChildAgent[] {
    return [...this.children.values()];
  }

  /** 全部上报记录(只读副本)。 */
  getReports(): ChildReport[] {
    return [...this.reports];
  }

  /** 当前 child 数。 */
  get size(): number {
    return this.children.size;
  }
}
