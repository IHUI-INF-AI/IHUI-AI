// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回收站恢复消费方测试(goal-b49 Z2):删除→列举→恢复 逐字节回来 / 目标已存在具名拒绝且零副作用 /
// ACL 拒绝走同一把尺 / 未判定档(取不到清单、id 不合法、无条目、量不到字节不冒充 0)。
// 夹具一律走 §15b/§26 唯一落点 mkScratch(不得 os.tmpdir/裸 mkdtemp,不在真实工作树造删除)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TRASH_MANIFEST_KIND,
  type TrashManifest,
} from '@ihui/shared/delete-guard';
import { clearGuardRulesCache } from '../src/sandbox/file-access-policy.js';
import { getDeleteTrashDir, recycleDeleteSingleFile } from '../src/tools/file-batch-edit.js';
import { listTrash, restoreFromTrash } from '../src/commands/trash.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

let ws = '';

beforeEach(() => {
  ws = mkScratch('z2-trash-');
  clearGuardRulesCache();
  // announceGuardUnjudged 会往 stderr 出声(夹具工作区无守护面清单 ⇒ unjudged 一次);吞掉以保持输出干净
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  clearGuardRulesCache();
  const dir = ws;
  ws = '';
  if (dir !== '') rmScratch(dir);
});

function trashDirOf(trashId: string): string {
  return path.join(getDeleteTrashDir(ws), trashId);
}

/** 手工铺一枚在册回收件(测试输入;真实删除腿对这些路径本就会被 ACL 拒,铺不出,故直造清单+件)。 */
function plantTrash(trashId: string, entry: TrashManifest['entries'][number], content: Buffer): void {
  const dir = trashDirOf(trashId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, entry.relativeTrashPath), content);
  const manifest: TrashManifest = {
    kind: TRASH_MANIFEST_KIND,
    trashId,
    createdAtIso: '2026-11-05T00:00:00.000Z',
    workspacePath: ws,
    entries: [entry],
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

describe('① 正例:删→列→恢复,内容逐字节回来', () => {
  it('delete_file 单文件进回收站,list 可见,restore 后字节完全一致', () => {
    const payload = Buffer.from('前脚内容😀\n第二行 123\n', 'utf-8');
    const target = path.join(ws, 'note.txt');
    fs.writeFileSync(target, payload);
    recycleDeleteSingleFile(ws, target);
    expect(fs.existsSync(target)).toBe(false);

    const listed = listTrash(ws);
    expect(listed.state).toBe('ok');
    expect(listed.rows).toHaveLength(1);
    const row = listed.rows[0];
    expect(row?.originalPath).toBe(target);
    expect(row?.sizeBytes).toBe(payload.length);

    const r = restoreFromTrash(ws, row!.trashId);
    expect(r.ok).toBe(true);
    expect(r.restoredTo).toBe(target);
    expect(Buffer.compare(fs.readFileSync(target), payload)).toBe(0);
  });

  it('多字节 base64 内容也逐字节回来(证明走的是真实 copy 而非占位)', () => {
    const payload = Buffer.from([0x00, 0xff, 0x7b, 0x22, 0x61, 0x22, 0x3a, 0x31, 0x7d]);
    const target = path.join(ws, 'data.json');
    fs.writeFileSync(target, payload);
    recycleDeleteSingleFile(ws, target);
    const row = listTrash(ws).rows[0]!;
    expect(restoreFromTrash(ws, row.trashId).ok).toBe(true);
    expect(fs.readFileSync(target).equals(payload)).toBe(true);
  });
});

describe('② 反例:具名拒绝且断言副作用没发生', () => {
  it('原路径读不到时不说成不存在,也不把回收件盖回去', () => {
    const target = path.join(ws, 'keep.txt');
    fs.writeFileSync(target, 'original', 'utf-8');
    recycleDeleteSingleFile(ws, target);
    fs.writeFileSync(target, 'LIVE-DIFFERENT', 'utf-8');
    const row = listTrash(ws).rows[0]!;
    const denied = () => {
      const err = new Error('denied') as NodeJS.ErrnoException;
      err.code = 'EACCES';
      throw err;
    };
    const r = restoreFromTrash(ws, row.trashId, 'keep.txt', denied);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/读不到/);
    expect(fs.readFileSync(target, 'utf-8')).toBe('LIVE-DIFFERENT');
    expect(fs.existsSync(path.join(trashDirOf(row.trashId), row.relativeTrashPath))).toBe(true);
  });

  it('目标已存在 ⇒ target-exists,现网内容一字未动,回收件仍在', () => {
    const target = path.join(ws, 'keep.txt');
    fs.writeFileSync(target, 'original', 'utf-8');
    recycleDeleteSingleFile(ws, target);
    // 现场在删除后又被人写回不同内容(模拟并发/手改)
    fs.writeFileSync(target, 'LIVE-DIFFERENT', 'utf-8');

    const row = listTrash(ws).rows[0]!;
    const r = restoreFromTrash(ws, row.trashId, 'keep.txt');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('target-exists');
    // 副作用未发生:现网内容仍是并发写入的那份,不是回收站那份
    expect(fs.readFileSync(target, 'utf-8')).toBe('LIVE-DIFFERENT');
    expect(fs.existsSync(path.join(trashDirOf(row.trashId), row.relativeTrashPath))).toBe(true);
  });

  it('原路径命中凭据族 ⇒ acl-blocked(恢复写入被同一把尺拒),且未落盘', () => {
    const envAbs = path.resolve(ws, '.env');
    plantTrash(
      'z2-acl-1',
      { originalPath: envAbs, relativeTrashPath: '0-.env', sizeBytes: 3, kind: 'file' },
      Buffer.from('A=1', 'utf-8'),
    );
    const r = restoreFromTrash(ws, 'z2-acl-1', '.env');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('acl-blocked');
    expect(fs.existsSync(envAbs)).toBe(false); // 恢复未启动 ⇒ 没写 .env
    expect(fs.existsSync(path.join(trashDirOf('z2-acl-1'), '0-.env'))).toBe(true);
  });

  it('清单里 relativeTrashPath 折出 trashId 目录 ⇒ restore-failed,目录外文件一字未动(F-095 反证)', () => {
    const outside = path.join(trashDirOf('z2-escape-rel'), '..', 'outside.txt');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, 'SECRET-OUTSIDE', 'utf-8');
    plantTrash(
      'z2-escape-rel',
      { originalPath: path.resolve(ws, 'a.txt'), relativeTrashPath: '../../../../outside.txt', sizeBytes: 1, kind: 'file' },
      Buffer.from('a', 'utf-8'),
    );
    const r = restoreFromTrash(ws, 'z2-escape-rel', 'a.txt');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('restore-failed');
    expect(fs.existsSync(path.resolve(ws, 'a.txt'))).toBe(false); // 恢复未启动
    expect(fs.readFileSync(outside, 'utf-8')).toBe('SECRET-OUTSIDE');
  });

  it('清单里 originalPath 落在工作区外 ⇒ restore-failed,工作区外不产生写入(F-095 反证)', () => {
    const outsideTarget = path.join(path.dirname(ws), 'outside-ws-evil.txt');
    fs.rmSync(outsideTarget, { force: true, recursive: true }); // 上一轮红读数若被旧实现落盘,先清现场
    plantTrash(
      'z2-escape-orig',
      { originalPath: outsideTarget, relativeTrashPath: '0-x.txt', sizeBytes: 1, kind: 'file' },
      Buffer.from('x', 'utf-8'),
    );
    const r = restoreFromTrash(ws, 'z2-escape-orig');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('restore-failed');
    expect(fs.existsSync(outsideTarget)).toBe(false);
  });
});

describe('③ 未判定档:不删不写不冒充成功(§0.3)', () => {
  it('清单取不到 ⇒ manifest-unreadable(不硬试)', () => {
    const r = restoreFromTrash(ws, 'no-such-trash-id');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('manifest-unreadable');
  });

  it('trashId 形态不合法 ⇒ invalid-id(不落到拼路径)', () => {
    const r = restoreFromTrash(ws, '../evil');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('invalid-id');
  });

  it('该 id 下无此原路径 ⇒ no-such-entry', () => {
    const target = path.join(ws, 'x.txt');
    fs.writeFileSync(target, 'x', 'utf-8');
    recycleDeleteSingleFile(ws, target);
    const row = listTrash(ws).rows[0]!;
    const r = restoreFromTrash(ws, row.trashId, 'other.txt');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('no-such-entry');
    expect(fs.existsSync(target)).toBe(false); // 拒绝 ⇒ 目标没被造出来
  });

  it('多条清单省略 path ⇒ no-such-entry(要求显式指定,不猜哪一条)', () => {
    plantTrash('z2-multi', { originalPath: path.resolve(ws, 'a.txt'), relativeTrashPath: '0-a.txt', sizeBytes: 1, kind: 'file' }, Buffer.from('a'));
    const second = path.join(trashDirOf('z2-multi'), 'manifest.json');
    const m = JSON.parse(fs.readFileSync(second, 'utf-8')) as TrashManifest;
    // entries 是 readonly 面 ⇒ 造一份新的清单对象,不原地改写
    const m2: TrashManifest = {
      ...m,
      entries: [...m.entries, { originalPath: path.resolve(ws, 'b.txt'), relativeTrashPath: '1-b.txt', sizeBytes: 1, kind: 'file' }],
    };
    fs.writeFileSync(second, JSON.stringify(m2), 'utf-8');
    const r = restoreFromTrash(ws, 'z2-multi');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('no-such-entry');
    expect(fs.existsSync(path.resolve(ws, 'a.txt'))).toBe(false);
    expect(fs.existsSync(path.resolve(ws, 'b.txt'))).toBe(false);
  });

  it('坏清单 ⇒ list state=undetermined 且逐条点名;量不到的字节是 null 不冒充 0', () => {
    // 一枚合法但 sizeBytes 量不到(null)的在册条目
    plantTrash('z2-null-size', { originalPath: path.resolve(ws, 'big.bin'), relativeTrashPath: '0-big.bin', sizeBytes: null, kind: 'file' }, Buffer.alloc(0));
    // 一枚形态坏的清单(不是合法 TrashManifest)
    const badDir = trashDirOf('z2-bad');
    fs.mkdirSync(badDir, { recursive: true });
    fs.writeFileSync(path.join(badDir, 'manifest.json'), '{坏 JSON', 'utf-8');

    const listed = listTrash(ws);
    expect(listed.state).toBe('undetermined');
    expect(listed.unreadable.length).toBeGreaterThanOrEqual(1);
    const nullRow = listed.rows.find((x) => x.trashId === 'z2-null-size');
    expect(nullRow?.sizeBytes).toBeNull();
    expect(nullRow?.sizeBytes).not.toBe(0);
  });
});

describe('④ 消费方接线形状锁', () => {
  it('trash.ts 源码确实调用 restoreTrashEntry + 同一把 ACL + 具名 target-exists', () => {
    const src = fs.readFileSync(new URL('../src/commands/trash.ts', import.meta.url), 'utf8');
    expect(src).toContain('restoreTrashEntry(');
    expect(src).toContain("evaluateFileAccess('write'");
    expect(src).toContain('target-exists');
    // 不得出现裸的第二把尺或复算的删除原语
    expect(src).not.toMatch(/fs\.rmSync\(|fs\.unlinkSync\(/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
