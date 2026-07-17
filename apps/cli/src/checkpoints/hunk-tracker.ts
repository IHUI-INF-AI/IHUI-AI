/**
 * HunkTracker — 按 hunk(行范围)粒度追踪文件改动来源(Agent vs External),
 * 用于多 subagent 并行冲突检测(AGENTS.md §12)。
 *
 * 灵感来源:cli 的 xai-hunk-tracker crate(Actor-based hunk tracking
 * with Agent/External attribution),TS 简化实现(做减法):
 *   - 不依赖 git,不做 diff 算法,只按行号范围记录
 *   - 调用方在工具修改文件前后主动调用 recordAgentChange / recordExternalChange
 *   - detectConflict 用于 subagent 在写入前自查是否会与历史 hunk 冲突
 *   - 冷却合并:同一 agent 在 cooldownMs 内连续改同一文件,合并为一条 hunk
 */

import * as crypto from 'node:crypto';

export type ChangeSource = 'agent' | 'external' | 'unknown';

export interface HunkRecord {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  source: ChangeSource;
  timestamp: number;
  agentId?: string;
  content?: string;
}

export interface HunkTrackerOptions {
  maxHistoryPerFile: number;
  cooldownMs: number;
}

export interface HunkTrackerStats {
  totalHunks: number;
  agentHunks: number;
  externalHunks: number;
  conflictFiles: number;
}

const DEFAULT_OPTIONS: HunkTrackerOptions = {
  maxHistoryPerFile: 100,
  cooldownMs: 5000,
};

const CONTENT_PREVIEW_LEN = 200;

export class HunkTracker {
  private readonly options: HunkTrackerOptions;
  private readonly history: Map<string, HunkRecord[]> = new Map();

  constructor(options?: Partial<HunkTrackerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  recordAgentChange(
    filePath: string,
    startLine: number,
    endLine: number,
    agentId: string,
    content?: string,
  ): void {
    this.validateRange(startLine, endLine);
    const now = Date.now();
    const list = this.getOrCreateList(filePath);

    const merged = this.tryMergeCooldown(list, filePath, startLine, endLine, now, agentId);
    if (merged) return;

    const record: HunkRecord = {
      id: this.genId(),
      filePath,
      startLine,
      endLine,
      source: 'agent',
      timestamp: now,
      agentId,
      content: this.preview(content),
    };
    list.push(record);
    this.pruneList(list);
  }

  recordExternalChange(
    filePath: string,
    startLine: number,
    endLine: number,
    content?: string,
  ): void {
    this.validateRange(startLine, endLine);
    const now = Date.now();
    const list = this.getOrCreateList(filePath);

    const record: HunkRecord = {
      id: this.genId(),
      filePath,
      startLine,
      endLine,
      source: 'external',
      timestamp: now,
      content: this.preview(content),
    };
    list.push(record);
    this.pruneList(list);
  }

  detectConflict(
    filePath: string,
    startLine: number,
    endLine: number,
    agentId: string,
  ): HunkRecord[] {
    this.validateRange(startLine, endLine);
    const list = this.history.get(filePath);
    if (!list || list.length === 0) return [];
    const conflicts: HunkRecord[] = [];
    for (const h of list) {
      if (!this.rangesOverlap(startLine, endLine, h.startLine, h.endLine)) continue;
      if (h.source === 'agent' && h.agentId === agentId) continue;
      conflicts.push(h);
    }
    return conflicts;
  }

  getHistory(filePath: string): HunkRecord[] {
    const list = this.history.get(filePath);
    return list ? [...list] : [];
  }

  getStats(): HunkTrackerStats {
    let totalHunks = 0;
    let agentHunks = 0;
    let externalHunks = 0;
    let conflictFiles = 0;

    for (const [, list] of this.history) {
      totalHunks += list.length;
      for (const h of list) {
        if (h.source === 'agent') agentHunks++;
        else if (h.source === 'external') externalHunks++;
      }
      if (this.fileHasConflict(list)) conflictFiles++;
    }

    return { totalHunks, agentHunks, externalHunks, conflictFiles };
  }

  clear(filePath?: string): void {
    if (filePath === undefined) {
      this.history.clear();
      return;
    }
    this.history.delete(filePath);
  }

  private getOrCreateList(filePath: string): HunkRecord[] {
    let list = this.history.get(filePath);
    if (!list) {
      list = [];
      this.history.set(filePath, list);
    }
    return list;
  }

  private tryMergeCooldown(
    list: HunkRecord[],
    filePath: string,
    startLine: number,
    endLine: number,
    now: number,
    agentId: string,
  ): boolean {
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i]!;
      if (h.source !== 'agent' || h.agentId !== agentId) continue;
      if (now - h.timestamp > this.options.cooldownMs) continue;
      if (!this.rangesOverlap(startLine, endLine, h.startLine, h.endLine) &&
          !this.adjacent(startLine, endLine, h.startLine, h.endLine)) continue;
      h.startLine = Math.min(h.startLine, startLine);
      h.endLine = Math.max(h.endLine, endLine);
      h.timestamp = now;
      h.filePath = filePath;
      return true;
    }
    return false;
  }

  private fileHasConflict(list: HunkRecord[]): boolean {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (!this.rangesOverlap(a.startLine, a.endLine, b.startLine, b.endLine)) continue;
        if (a.source === 'agent' && b.source === 'agent' && a.agentId === b.agentId) continue;
        return true;
      }
    }
    return false;
  }

  private rangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
    return s1 <= e2 && s2 <= e1;
  }

  private adjacent(s1: number, e1: number, s2: number, e2: number): boolean {
    return e1 + 1 === s2 || e2 + 1 === s1;
  }

  private pruneList(list: HunkRecord[]): void {
    const max = this.options.maxHistoryPerFile;
    if (list.length <= max) return;
    const drop = list.length - max;
    list.splice(0, drop);
  }

  private validateRange(start: number, end: number): void {
    if (start < 1 || end < start) {
      throw new Error(`非法行范围: start=${start}, end=${end}`);
    }
  }

  private preview(content?: string): string | undefined {
    if (content === undefined) return undefined;
    if (content.length <= CONTENT_PREVIEW_LEN) return content;
    return content.slice(0, CONTENT_PREVIEW_LEN);
  }

  private genId(): string {
    return `hunk_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  }
}
