// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-117:`tasks` 的读后写(RMW)基线必须与本次解析的内容同源。
 *
 * 缺陷原状:基线在「读盘 + 改内存」之后、落盘之前才 capture ⇒ 比对窗口只剩
 * 捕获→rename 的毫秒;两终端同时 `/tasks add` 时,T0 读与 T1 捕获之间的他人写入
 * 被当成基线而静默覆盖(任务丢失),`nextId` 同源错位(两条任务撞同一个 id)。
 *
 * 夹具造法:在 `loadStore` 解析任务库的那一刻(本进程已拿到 T0 盘面、尚未写盘)
 * 落一次"另一终端"的写入,随后断言:
 *   ① 本次写入被拒绝(write_conflict),对方任务逐字节保留 —— 不丢更新;
 *   ② 命令行层仍是原有报错文案(未改动任何数据);
 *   ③ 冲突后重试重新读盘分配 ID —— 不产生重复 ID。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { addTask, getTasksPath, handleTasksCommand, listTasks } from '../src/commands/tasks.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

const WS = '/ws/f117-concurrent';

let scratch = '';
const prevHome = process.env.HOME;
const prevUserProfile = process.env.USERPROFILE;

/** 待执行的"另一终端写入"载荷:非 null 时,下一次解析出任务库后立刻落盘。 */
let competitorWrite: string | null = null;
let parseSpy: { mockRestore: () => void } | null = null;

function task(id: string, content: string): Record<string, unknown> {
  return {
    id,
    content,
    status: 'pending',
    priority: 'medium',
    createdAt: '2026-11-12T00:00:00.000Z',
  };
}

function storeText(nextId: number, tasks: Array<Record<string, unknown>>): string {
  return (
    JSON.stringify(
      {
        version: 1,
        workspaces: { [WS]: { workspacePath: WS, workspaceName: 'f117-concurrent', tasks } },
        nextId,
      },
      null,
      2,
    ) + '\n'
  );
}

function writeStore(text: string): void {
  const p = getTasksPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

function readStore(): {
  workspaces: Record<string, { tasks: Array<{ id: string; content: string }> }>;
  nextId: number;
} {
  return JSON.parse(fs.readFileSync(getTasksPath(), 'utf-8'));
}

/** 只认任务库形态:JSON.parse 在本进程里还被别处使用,不能一见到就触发并发写入。 */
function isTasksStore(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as { nextId?: unknown }).nextId === 'number' &&
    typeof (v as { workspaces?: unknown }).workspaces === 'object' &&
    (v as { workspaces?: unknown }).workspaces !== null
  );
}

beforeAll(() => {
  scratch = mkScratch('cli-f117-');
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;

  const actualParse = JSON.parse.bind(JSON);
  parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(((
    text: string,
    reviver?: (this: unknown, key: string, value: unknown) => unknown,
  ) => {
    const parsed: unknown = actualParse(text, reviver as never);
    if (competitorWrite !== null && isTasksStore(parsed)) {
      const payload = competitorWrite;
      competitorWrite = null;
      writeStore(payload);
    }
    return parsed;
  }) as typeof JSON.parse);
});

afterEach(() => {
  competitorWrite = null;
  try {
    fs.rmSync(getTasksPath(), { force: true });
  } catch (err) {
    console.warn(`[cli-f117] 用例间清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterAll(() => {
  parseSpy?.mockRestore();
  parseSpy = null;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[cli-f117] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

describe('F-117 tasks 并发更新:基线必须与解析内容同源', () => {
  it('读盘后被他人写入 ⇒ 本次 addTask 报 write_conflict,对方任务逐字节保留(不丢更新)', () => {
    writeStore(storeText(2, [task('1', '初始任务')]));
    const competitorPayload = storeText(3, [task('1', '初始任务'), task('2', '他人任务')]);
    competitorWrite = competitorPayload;

    let thrown: unknown = null;
    try {
      addTask(WS, '我的任务');
    } catch (err) {
      thrown = err;
    }

    // 钩子确实触发过:并发写入落在「解析完成 → 落盘」之间,正是原缺陷的丢失窗口
    expect(competitorWrite).toBeNull();
    expect((thrown as { code?: string })?.code).toBe('write_conflict');
    expect(fs.readFileSync(getTasksPath(), 'utf-8')).toBe(competitorPayload);
  });

  it('命令层报错文案不变:提示未改动任何数据,且对方任务仍在清单里', () => {
    writeStore(storeText(2, [task('1', '初始任务')]));
    competitorWrite = storeText(3, [task('1', '初始任务'), task('2', '他人任务')]);

    const out = handleTasksCommand('add 我的任务', WS);

    expect(out).toContain('未改动任何数据');
    expect(out).toContain('写入冲突');
    expect(listTasks(WS).map((t) => t.content)).toEqual(['初始任务', '他人任务']);
    expect(readStore().nextId).toBe(3);
  });

  it('冲突后重试:重新读最新盘面分配 ID,不产生重复 ID、不丢任务', () => {
    writeStore(storeText(2, [task('1', '初始任务')]));
    competitorWrite = storeText(3, [task('1', '初始任务'), task('2', '他人任务')]);

    expect(() => addTask(WS, '我的任务')).toThrow(/写入冲突/);

    const mine = addTask(WS, '我的任务');
    expect(mine.id).toBe('3');

    const ids = readStore().workspaces[WS]!.tasks.map((t) => t.id);
    expect(ids).toEqual(['1', '2', '3']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(readStore().nextId).toBe(4);
  });
});
