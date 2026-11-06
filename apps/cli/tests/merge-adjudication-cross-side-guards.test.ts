// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 合并裁决锁(2026-11-06,ba2af379 ↔ 52505f20 那两格人工判的回灌凭据)。
 *
 * 钉的是"两侧语义都不丢"这一条,不是某一侧的偏好:
 *  ① 越界路径被拒 —— 对侧 bring 的 resolveWorkspaceRelPath / isSafeWorkspaceRelPath 必须在位,
 *     且被拒时工作树外一个字节都不许写、不许 stat(副作用没发生才算拦住);
 *  ② 读不到不得读成"文件不存在" —— 本侧 bring 的 workspacePresence / undoTargetKind 三态必须
 *     把 unreadable 与 absent 分开,且 unreadable 时不得静默 unlink / 覆盖;
 *  ③ manifest 的 skipped 形状坏 ⇒ 校验判 false(走 corrupt 隔离,不静默放行);
 *  ④ 写入只走唯一原子写出口 —— 裸 writeFileSync 与 commitAtomicWrite 是同一句的两种拼法,
 *     并存即"先裸写再原子写",对侧的三重保护会被前一次裸写抹掉,故形状锁判它不得回来。
 * 每条都配正向对照(absent 与 unreadable 必须给出不同结论,否则三态等于两态)。
 *
 * 隔离:全部落在 §15b 唯一夹具落点(mkScratch),结束即清,不碰工作树与家目录。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  diffSnapshotFiles,
  restoreSnapshotFiles,
  writeSnapshotManifest,
  type CheckpointMeta,
} from '../src/checkpoints/snapshot-store-host.js';
import { readSnapshotMeta } from '../src/checkpoints/snapshot-store-host.js';
import { UndoRedoManager } from '../src/commands/undo-redo.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = (f: string) => fs.readFileSync(path.join(HERE, '..', 'src', f), 'utf-8');
/** 只在函数体内判,不判整份文件:import 行与历史注记里出现同名 API 是常态 */
const bodyOf = (src: string, head: string): string => {
  const from = src.indexOf(head);
  expect(from, `被审函数头未找到:${head}`).toBeGreaterThan(-1);
  return src.slice(from, src.indexOf('\n  }\n', from));
};

/** 注入一把"对指定路径读不到(EACCES)、其余照实"的尺:三态的 unreadable 档只能这样造 */
function statThrowingFor(target: string): typeof fs.statSync {
  return ((p: fs.PathLike) => {
    if (path.resolve(String(p)) === path.resolve(target)) {
      throw Object.assign(new Error(`EACCES: permission denied ${String(p)}`), { code: 'EACCES' });
    }
    return fs.statSync(p);
  }) as typeof fs.statSync;
}

let root: string;
let ws: string;
let cpDir: string;
/** 工作树外的邻居目录:越界裁决的正反对照都写在这里 */
let outside: string;

beforeEach(() => {
  root = mkScratch('ihui-merge-adjudication-');
  ws = path.join(root, 'workspace');
  cpDir = path.join(root, 'snapshots', 'cp-1');
  outside = path.join(root, 'outside');
  fs.mkdirSync(ws, { recursive: true });
  fs.mkdirSync(cpDir, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
});

afterEach(() => {
  rmScratch(root);
});

const meta = (files: CheckpointMeta['files'], extra: Partial<CheckpointMeta> = {}): CheckpointMeta => ({
  id: 'cp-1',
  sessionId: 'merge-adjudication',
  createdAt: new Date('2026-11-06T00:00:00Z').toISOString(),
  reason: 'manual-merge',
  files,
  ...extra,
});

describe('① 越界路径被拒:工作区外不写、不 stat、不删', () => {
  it('restoreSnapshotFiles:manifest 键带 .. ⇒ 抛错,且工作树外的目标文件既没被建也没被删', () => {
    const victim = path.join(outside, 'authorized_keys');
    fs.writeFileSync(victim, 'keep-me', 'utf-8');
    fs.writeFileSync(path.join(cpDir, 'x'), 'snap-body', 'utf-8');

    expect(() =>
      restoreSnapshotFiles(ws, cpDir, { '../outside/authorized_keys': 'snap' }),
    ).toThrow(/不在工作区/);
    expect(fs.readFileSync(victim, 'utf-8')).toBe('keep-me');
    expect(fs.existsSync(path.join(ws, 'authorized_keys'))).toBe(false);
  });

  it('diffSnapshotFiles:越界键 ⇒ 抛错,且注入的尺没被拿去过工作树外的路径', () => {
    const seen: string[] = [];
    const spy = ((p: fs.PathLike) => {
      seen.push(path.resolve(String(p)));
      return fs.statSync(p);
    }) as typeof fs.statSync;

    expect(() =>
      diffSnapshotFiles(ws, cpDir, { '../outside/secret': 'added' }, { statSync: spy }),
    ).toThrow(/不在工作区/);
    expect(seen).toEqual([]);
  });

  it('形状腿(录制侧同一条判据):files 键越界的 manifest ⇒ 判 corrupt(shape-invalid) 而非放行', () => {
    writeSnapshotManifest(cpDir, meta({ '../outside/x.txt': 'snap' }));
    const corrupt: unknown[] = [];
    const res = readSnapshotMeta(path.dirname(cpDir), 'cp-1', {
      onCorrupt: (e) => corrupt.push(e),
    });
    expect(res.status).toBe('corrupt');
    if (res.status === 'corrupt') expect(res.entry.reason).toBe('shape-invalid');
    expect(corrupt.length).toBe(1);
  });

  it('正向对照:合法相对键的 manifest 仍判 ok(越界校验没被写成"一律拒")', () => {
    writeSnapshotManifest(cpDir, meta({ 'src/a.ts': 'snap' }));
    const res = readSnapshotMeta(path.dirname(cpDir), 'cp-1', { onCorrupt: () => {} });
    expect(res.status).toBe('ok');
  });
});

describe('② 读不到 ≠ 不存在:三态必须分开,且 unreadable 不静默 unlink/覆盖', () => {
  it('diffSnapshotFiles:EACCES ⇒ unmeasured;ENOENT ⇒ removed;读得通且内容不同 ⇒ modified', () => {
    const gone = path.join(ws, 'gone.ts');
    const frozen = path.join(ws, 'frozen.ts');
    void gone; // 故意不建:走「确认不存在」那一档
    fs.writeFileSync(frozen, 'on-disk', 'utf-8');
    // 快照副本内容与工作区不同 ⇒ 读得通那一档落在 modified(注:返回面把 unchanged 整条滤掉)
    fs.writeFileSync(path.join(cpDir, 'frozen.ts'), 'snapshot-body', 'utf-8');
    const files = { 'gone.ts': 'snap' as const, 'frozen.ts': 'snap' as const };

    const unreadable = diffSnapshotFiles(ws, cpDir, files, {
      statSync: statThrowingFor(frozen),
    });
    expect(unreadable.find((e) => e.path === 'frozen.ts')?.status).toBe('unmeasured');
    expect(unreadable.find((e) => e.path === 'gone.ts')?.status).toBe('removed');

    // 正向对照:尺子换成真的以后,同一条必须落到 modified(三态没被压成两态)
    const all = diffSnapshotFiles(ws, cpDir, files);
    expect(all.find((e) => e.path === 'frozen.ts')?.status).toBe('modified');
    expect(all.find((e) => e.path === 'gone.ts')?.status).toBe('removed');
  });

  it("restoreSnapshotFiles:待删目标读不到 ⇒ 进 notRestored,文件仍在(没被 rmSync 假装删掉)", () => {
    const target = path.join(ws, 'a.ts');
    fs.writeFileSync(target, 'still-here', 'utf-8');

    const res = restoreSnapshotFiles(ws, cpDir, { 'a.ts': 'added' }, {
      statSync: statThrowingFor(target),
    });
    expect(res.notRestored).toEqual(['a.ts']);
    expect(res.removed).toEqual([]);
    expect(fs.readFileSync(target, 'utf-8')).toBe('still-here');
  });

  it('正向对照:确认存在的待删目标被删、确认不存在的不报错也不进 removed', () => {
    const target = path.join(ws, 'b.ts');
    fs.writeFileSync(target, 'bye', 'utf-8');
    const present = restoreSnapshotFiles(ws, cpDir, { 'b.ts': 'added' });
    expect(present.removed).toEqual(['b.ts']);
    expect(fs.existsSync(target)).toBe(false);

    const absent = restoreSnapshotFiles(ws, cpDir, { 'never-existed.ts': 'added' });
    expect(absent.removed).toEqual([]);
    expect(absent.notRestored).toEqual([]);
  });

  it('/undo:目标读不到 ⇒ 该步失败并点名 code,磁盘内容原样(没被覆盖也没被删)', async () => {
    const rel = 'frozen-by-others.ts';
    const abs = path.join(ws, rel);
    fs.writeFileSync(abs, 'after', 'utf-8');
    const mgr = new UndoRedoManager(ws, {
      stat: (p: string) => {
        if (path.resolve(p) === path.resolve(abs)) {
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        }
        return fs.statSync(p);
      },
    });
    mgr.recordChange('merge-adjudication-undo', {
      toolName: 'edit_file',
      filePath: rel,
      beforeContent: 'before',
      afterContent: 'after',
      timestamp: 1,
    });

    const res = await mgr.undo('merge-adjudication-undo', 1);
    expect(res.undoneSteps).toBe(0);
    expect(res.failedFiles).toEqual([rel]);
    expect(res.failedReasons.join('|')).toContain('EACCES');
    expect(res.workspaceUnchanged).toBe(true);
    expect(fs.readFileSync(abs, 'utf-8')).toBe('after');
  });

  it('/undo:删除腿目标读不到 ⇒ 不 unlink、文件仍在、点名 code(unreadable 没被当成 absent)', async () => {
    const rel = 'locked-delete-target.ts';
    const abs = path.join(ws, rel);
    fs.writeFileSync(abs, 'must-survive', 'utf-8');
    const mgr = new UndoRedoManager(ws, {
      stat: (p: string) => {
        if (path.resolve(p) === path.resolve(abs)) {
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        }
        return fs.statSync(p);
      },
    });
    mgr.recordChange('merge-adjudication-unread-unlink', {
      toolName: 'write_file',
      filePath: rel,
      beforeContent: null, // 反向撤销 = 该删掉这个文件
      afterContent: 'must-survive',
      timestamp: 1,
    });

    const res = await mgr.undo('merge-adjudication-unread-unlink', 1);
    expect(res.undoneSteps).toBe(0);
    expect(res.failedFiles).toEqual([rel]);
    expect(res.failedReasons.join('|')).toContain('EACCES');
    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.readFileSync(abs, 'utf-8')).toBe('must-survive');
  });

  it('正向对照:确认不存在的删除步 ⇒ 不 unlink 也不抛(absent 与 unreadable 不是同一档)', async () => {
    const mgr = new UndoRedoManager(ws);
    mgr.recordChange('merge-adjudication-absent', {
      toolName: 'write_file',
      filePath: 'created-then-manually-deleted.ts',
      beforeContent: null,
      afterContent: 'x',
      timestamp: 1,
    });
    const res = await mgr.undo('merge-adjudication-absent', 1);
    expect(res.undoneSteps).toBe(1);
    expect(res.failedFiles).toEqual([]);
    expect(fs.existsSync(path.join(ws, 'created-then-manually-deleted.ts'))).toBe(false);
  });

  it('/undo:写入腿只走唯一原子写出口 ⇒ 回退成功且不留 .tmp- 半截文件', async () => {
    const rel = 'writable.ts';
    fs.writeFileSync(path.join(ws, rel), 'after', 'utf-8');
    const mgr = new UndoRedoManager(ws);
    mgr.recordChange('merge-adjudication-atomic', {
      toolName: 'edit_file',
      filePath: rel,
      beforeContent: 'before',
      afterContent: 'after',
      timestamp: 1,
    });

    const res = await mgr.undo('merge-adjudication-atomic', 1);
    expect(res.undoneSteps).toBe(1);
    expect(fs.readFileSync(path.join(ws, rel), 'utf-8')).toBe('before');
    const leftovers = fs.readdirSync(ws).filter((n) => n.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  it('形状锁:applyChange 体内裸 writeFileSync 不得回来(与原子写并存即抹掉对侧三重保护)', () => {
    const body = bodyOf(SRC('commands/undo-redo.ts'), 'private applyChange(');
    expect(body).toContain('commitAtomicWrite(captureWriteBaseline(fullPath), content);');
    expect(body).not.toMatch(/fs\.writeFileSync\(fullPath/);
    expect(body).not.toMatch(/if \(fs\.existsSync\(fullPath\)\) \{/);
  });
});

describe('③ skipped 形状校验:坏形状判 false(走 corrupt 隔离)', () => {
  const readMeta = (m: CheckpointMeta) => {
    writeSnapshotManifest(cpDir, m);
    return readSnapshotMeta(path.dirname(cpDir), 'cp-1', { onCorrupt: () => {} });
  };

  it('skipped 不是数组 ⇒ corrupt(shape-invalid)', () => {
    expect(readMeta(meta({ 'a.ts': 'snap' }, { skipped: '不是数组' as unknown as string[] })).status).toBe(
      'corrupt',
    );
  });

  it('skipped 元素不是字符串 ⇒ corrupt(shape-invalid)', () => {
    expect(
      readMeta(meta({ 'a.ts': 'snap' }, { skipped: [1] as unknown as string[] })).status,
    ).toBe('corrupt');
  });

  it('正向对照:skipped 合法或缺省 ⇒ ok', () => {
    expect(readMeta(meta({ 'a.ts': 'snap' }, { skipped: ['link'] })).status).toBe('ok');
    expect(readMeta(meta({ 'a.ts': 'snap' })).status).toBe('ok');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
