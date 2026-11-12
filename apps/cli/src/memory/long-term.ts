// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LongTermMemory — 跨 session 持久化,读写 <workspace>/.ihui-agent/memory/MEMORY.md。
 * 平台独占:仅 cli(W2-1 四层记忆第 2 层,对标 OpenClaw Mem episodic memory)。
 * 格式与 memory/index.ts MEMORY.md 一致:# Memory + ## <分类> + - <条目>。
 * append 追加到分类段(段不存在则新建),search 关键词子串匹配(大小写不敏感)。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sleepSync, writeFileAtomicSync } from '../util/atomic-write.js';

/**
 * 跨进程写锁(最小实现,不引依赖):MEMORY.md 同目录的 `.MEMORY.md.lock` 以 wx 独占创建即持锁,
 * 内容记 pid/token/时间;释放前校验 token,崩溃残留按「租约过期或持锁进程已死」抢占。
 * 同进程内天然互斥:append 全程同步,一次读-改-写不会与另一次交错。
 */
const LOCK_WAIT_MS = 2_000;
const LOCK_STALE_MS = 30_000;
const LOCK_POLL_MS = 25;

interface LockRecord {
  pid: number;
  token: string;
  at: number;
}

function errCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

function lockPathFor(filePath: string): string {
  return path.join(path.dirname(filePath), `.${path.basename(filePath)}.lock`);
}

function readLockRecord(lockPath: string): LockRecord | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    if (parsed === null || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.pid !== 'number' || typeof record.token !== 'string' || typeof record.at !== 'number') {
      return null;
    }
    return { pid: record.pid, token: record.token, at: record.at };
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM = 进程存在但无权限;其余(ESRCH/EINVAL)按已死处理
    return errCode(error) === 'EPERM';
  }
}

function lockAgeMs(lockPath: string): number | null {
  try {
    return Date.now() - fs.statSync(lockPath).mtimeMs;
  } catch {
    return null;
  }
}

/** 陈旧判据:解析不出但文件还年轻 = 别人正在建锁,按活锁等;超租约或持锁进程已死才算崩溃残留。 */
function isLockStale(record: LockRecord | null, ageMs: number | null): boolean {
  if (ageMs !== null && ageMs > LOCK_STALE_MS) return true;
  if (record === null) return false;
  if (Date.now() - record.at > LOCK_STALE_MS) return true;
  return !isProcessAlive(record.pid);
}

/** 在独占锁内执行一次「读最新 → 改 → 原子替换」;拿不到锁就显式失败,绝不无锁覆盖。 */
function withMemoryLock<T>(filePath: string, fn: () => T): T {
  const lockPath = lockPathFor(filePath);
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    try {
      // 单次 writeFile('wx'):open 即判定独占,建锁与写内容尽量贴近,缩短空锁文件窗口
      fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token, at: Date.now() }), {
        flag: 'wx',
        mode: 0o600,
      });
      break;
    } catch (error) {
      if (errCode(error) !== 'EEXIST') throw error;
      if (isLockStale(readLockRecord(lockPath), lockAgeMs(lockPath))) {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // 别人刚释放或暂时删不掉:下一轮重读再判,不在这里猜
        }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `长期记忆正被另一个会话写入(锁 ${lockPath}),等待 ${LOCK_WAIT_MS}ms 仍未释放;本次不写盘,避免覆盖别人的条目。`,
        );
      }
      sleepSync(LOCK_POLL_MS);
    }
  }
  try {
    return fn();
  } finally {
    if (readLockRecord(lockPath)?.token === token) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // 释放失败不改写盘结论;陈旧锁会被下一轮判掉
      }
    }
  }
}

/** 把 `- <条目>` 行批量插进指定分类段(段不存在则文末新建),返回新内容。 */
function insertEntryLines(content: string, lines: readonly string[], category: string): string {
  const sectionHeader = `## ${category}`;
  if (content.includes(sectionHeader)) {
    const arr = content.split('\n');
    let insertIdx = arr.length;
    let found = false;
    for (let i = 0; i < arr.length; i++) {
      const line = arr[i]!;
      if (!found) {
        if (line.trim() === sectionHeader) found = true;
        continue;
      }
      if (line.trim().startsWith('## ')) {
        insertIdx = i;
        break;
      }
      insertIdx = i + 1;
    }
    while (insertIdx > 0 && arr[insertIdx - 1]!.trim() === '') {
      insertIdx--;
    }
    arr.splice(insertIdx, 0, ...lines);
    return arr.join('\n');
  }
  let next = content;
  if (!next.endsWith('\n\n')) next += next.endsWith('\n') ? '\n' : '\n\n';
  next += `${sectionHeader}\n\n${lines.join('\n')}\n`;
  return next;
}

export interface LongTermEntry {
  text: string;
  category: string;
  ts: number;
}

export class LongTermMemory {
  private readonly filePath: string;

  /** MEMORY.md 的绝对路径(只读,供 CLI 预览/诊断展示用)。 */
  get path(): string {
    return this.filePath;
  }

  constructor(workspacePath: string) {
    this.filePath = path.join(workspacePath, '.ihui-agent', 'memory', 'MEMORY.md');
  }

  /** 追加单条(委托批量入口:同一把锁 + 同一套去重/原子写)。 */
  append(text: string, category = '通用'): LongTermEntry {
    this.appendMany([text], category);
    return { text, category, ts: Date.now() };
  }

  /**
   * 批量追加到同一分类,返回实际新增条数(已存在的行跳过)。
   *
   * 整批在「锁内一次读-改-写 + 一次原子替换」内完成:
   *   - dream 不再逐条 append(每条例都重读重写整份文件 ⇒ O(n²),且中途失败会留下"部分成功");
   *   - 失败时整批都不落盘,内存里的短期记忆保持原样,重试也不会因半批已写而重复。
   */
  appendMany(texts: readonly string[], category = '通用'): number {
    const pending = texts.map((text) => text.trim()).filter((text) => text !== '');
    if (pending.length === 0) return 0;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    return withMemoryLock(this.filePath, () => {
      const content = this.readContentOrNew();
      const existing = new Set(content.split('\n').map((line) => line.trim()));
      const fresh: string[] = [];
      for (const text of pending) {
        // 去重:dream 中途失败后重试会重放同一批条目,不判重会让同一行无限累积。
        const line = `- ${text}`;
        if (existing.has(line)) continue;
        existing.add(line);
        fresh.push(line);
      }
      if (fresh.length === 0) return 0;
      writeFileAtomicSync(this.filePath, insertEntryLines(content, fresh, category));
      return fresh.length;
    });
  }

  /** 关键词搜索(子串匹配,大小写不敏感),返回命中条目。 */
  search(query: string): LongTermEntry[] {
    const q = query.toLowerCase();
    return this.load().filter((e) => e.text.toLowerCase().includes(q));
  }

  /** 文件不存在是空清单。读失败不能当成没有条目。 */
  private readContentOrNew(): string {
    try {
      return fs.readFileSync(this.filePath, 'utf-8');
    } catch (error) {
      const code =
        error !== null && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : 'unknown';
      if (code === 'ENOENT' || code === 'ENOTDIR') return '# Memory\n\n';
      throw new Error(`长期记忆读不到,不能把它覆盖成新条目 (${code})`);
    }
  }

  /** 读取全部条目(解析 ## 分类 + - 条目)。 */
  load(): LongTermEntry[] {
    let content: string;
    try {
      content = fs.readFileSync(this.filePath, 'utf-8');
    } catch (error) {
      const code =
        error !== null && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : 'unknown';
      if (code === 'ENOENT' || code === 'ENOTDIR') return [];
      throw new Error(`长期记忆读不到,不能把它说成没有条目 (${code})`);
    }
    const entries: LongTermEntry[] = [];
    let category = '未分类';
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        category = trimmed.slice(3).trim() || '未分类';
        continue;
      }
      if (trimmed.startsWith('- ')) {
        const text = trimmed.slice(2).trim();
        if (text) entries.push({ text, category, ts: 0 });
      }
    }
    return entries;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
