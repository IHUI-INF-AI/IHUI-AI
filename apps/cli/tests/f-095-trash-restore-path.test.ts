// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * F-095 回归:回收站恢复不得信任 manifest 里的 `relativeTrashPath` / `originalPath`。
 *
 * 攻击面:克隆一个自带 `.ihui/delete-trash/<id>/manifest.json` 的仓库,再 `trash restore`,
 * 清单文本可把回收件指向 `~/.ssh/id_rsa` 之类的工作区外文件,或把恢复落点指到工作区外。
 * 这里钉住恢复出口的两道闸(都在任何 fs 调用之前):
 *   1. `relativeTrashPath` 必须是单段文件名(`..`/分隔符/绝对路径一律拒),且 realpath 后仍在 trash 根内;
 *   2. `originalPath` 必须是工作区内的绝对路径(realpath 判,防符号链接拐出根外)。
 * 任一断言失败 ⇒ 整条 entry 具名拒绝,不得静默跳过或降级搬运。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TRASH_MANIFEST_KIND, type TrashManifest } from '@ihui/shared/delete-guard';
import { clearGuardRulesCache } from '../src/sandbox/file-access-policy.js';
import { getDeleteTrashDir, recycleDeleteSingleFile, restoreTrashEntry } from '../src/tools/file-batch-edit.js';
import { listTrash, restoreFromTrash } from '../src/commands/trash.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

let ws = '';

beforeEach(() => {
  ws = mkScratch('f095-trash-');
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

/** 只铺清单(清单文本即不可信输入):恶意 relativeTrashPath 不得被夹具先"按清单落盘"一次。 */
function plantManifest(trashId: string, entry: TrashManifest['entries'][number]): string {
  const dir = trashDirOf(trashId);
  fs.mkdirSync(dir, { recursive: true });
  const manifest: TrashManifest = {
    kind: TRASH_MANIFEST_KIND,
    trashId,
    createdAtIso: '2026-11-12T00:00:00.000Z',
    workspacePath: ws,
    entries: [entry],
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  return dir;
}

/** 铺一条合法在册回收件(单段名 + 件真实在 trashId 目录内)。 */
function plantTrash(trashId: string, entry: TrashManifest['entries'][number], content: Buffer): void {
  const dir = plantManifest(trashId, entry);
  fs.writeFileSync(path.join(dir, entry.relativeTrashPath), content);
}

describe('F-095 ① relativeTrashPath 越界一律拒', () => {
  it('含 ../ 折出 trashId 目录 ⇒ 具名拒绝,目录外文件与恢复目标都没被搬动', () => {
    const outside = path.join(path.dirname(ws), 'f095-outside-secret.txt');
    fs.writeFileSync(outside, 'SECRET-OUTSIDE', 'utf-8');
    const target = path.join(ws, 'a.txt');
    plantManifest('f095-rel-escape', {
      originalPath: target,
      relativeTrashPath: ['..', '..', path.basename(outside)].join(path.sep),
      sizeBytes: 1,
      kind: 'file',
    });

    const r = restoreFromTrash(ws, 'f095-rel-escape');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/单段文件名/);
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.readFileSync(outside, 'utf-8')).toBe('SECRET-OUTSIDE');
    expect(fs.existsSync(path.join(trashDirOf('f095-rel-escape'), 'manifest.json'))).toBe(true);
  });

  it('多段路径(即使仍在本 trashId 目录内)也拒:清单只能写单段名', () => {
    const dir = plantManifest('f095-rel-nested', {
      originalPath: path.join(ws, 'nested.txt'),
      relativeTrashPath: ['sub', 'payload.txt'].join(path.sep),
      sizeBytes: 1,
      kind: 'file',
    });
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'payload.txt'), 'n', 'utf-8');

    const r = restoreFromTrash(ws, 'f095-rel-nested');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/单段文件名/);
    expect(fs.existsSync(path.join(ws, 'nested.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'sub', 'payload.txt'), 'utf-8')).toBe('n');
  });

  it('绝对路径形态的 relativeTrashPath 直接拒', () => {
    const outside = path.join(path.dirname(ws), 'f095-abs-trash.txt');
    fs.writeFileSync(outside, 'SECRET-ABS', 'utf-8');
    plantManifest('f095-rel-abs', {
      originalPath: path.join(ws, 'abs.txt'),
      relativeTrashPath: outside,
      sizeBytes: 1,
      kind: 'file',
    });

    const r = restoreFromTrash(ws, 'f095-rel-abs');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/单段文件名/);
    expect(fs.existsSync(path.join(ws, 'abs.txt'))).toBe(false);
    expect(fs.readFileSync(outside, 'utf-8')).toBe('SECRET-ABS');
  });

  it('回收件是符号链接指向工作区外 ⇒ realpath 断言拒绝(平台不支持 symlink 时跳过)', () => {
    const outside = path.join(path.dirname(ws), 'f095-symlink-secret.txt');
    fs.writeFileSync(outside, 'SECRET-LINK', 'utf-8');
    const dir = plantManifest('f095-link', {
      originalPath: path.join(ws, 'leak.txt'),
      relativeTrashPath: 'payload.txt',
      sizeBytes: 1,
      kind: 'file',
    });
    try {
      fs.symlinkSync(outside, path.join(dir, 'payload.txt'));
    } catch {
      return; // Windows 未开符号链接权限 ⇒ 该向量在本机不可测,不伪造通过
    }

    const r = restoreFromTrash(ws, 'f095-link');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/符号链接|根目录/);
    expect(fs.existsSync(path.join(ws, 'leak.txt'))).toBe(false);
    expect(fs.readFileSync(outside, 'utf-8')).toBe('SECRET-LINK');
  });
});

describe('F-095 ② originalPath 必须落在工作区内', () => {
  it('绝对路径落在工作区外 ⇒ 具名拒绝,工作区外不产生文件', () => {
    const outsideTarget = path.join(path.dirname(ws), 'f095-outside-target.txt');
    fs.rmSync(outsideTarget, { force: true });
    const dir = plantManifest('f095-orig-abs', {
      originalPath: outsideTarget,
      relativeTrashPath: '0-x.txt',
      sizeBytes: 1,
      kind: 'file',
    });
    fs.writeFileSync(path.join(dir, '0-x.txt'), 'x', 'utf-8');

    const r = restoreFromTrash(ws, 'f095-orig-abs');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/恢复原路径/);
    expect(fs.existsSync(outsideTarget)).toBe(false);
  });

  it('相对路径 originalPath 也拒(不得按进程 cwd 解析)', () => {
    plantTrash(
      'f095-orig-rel',
      { originalPath: 'rel-target.txt', relativeTrashPath: '0-rel.txt', sizeBytes: 1, kind: 'file' },
      Buffer.from('r', 'utf-8'),
    );
    expect(() => restoreTrashEntry(ws, 'f095-orig-rel', 'rel-target.txt')).toThrow(/必须是绝对路径/);
    expect(fs.existsSync(path.resolve('rel-target.txt'))).toBe(false);
  });

  it('originalPath 经工作区内符号链接目录折到区外 ⇒ realpath 断言拒绝(平台不支持 symlink 时跳过)', () => {
    const outsideDir = path.join(path.dirname(ws), 'f095-linkdir-outside');
    fs.mkdirSync(outsideDir, { recursive: true });
    const linkDir = path.join(ws, 'linkdir');
    try {
      fs.symlinkSync(outsideDir, linkDir, 'dir');
    } catch {
      return;
    }
    plantTrash(
      'f095-orig-link',
      {
        originalPath: path.join(linkDir, 'escaped.txt'),
        relativeTrashPath: '0-l.txt',
        sizeBytes: 1,
        kind: 'file',
      },
      Buffer.from('L', 'utf-8'),
    );

    const r = restoreFromTrash(ws, 'f095-orig-link');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/恢复原路径/);
    expect(fs.existsSync(path.join(outsideDir, 'escaped.txt'))).toBe(false);
  });
});

describe('F-095 ③ 正向对照:合法条目仍能恢复成功', () => {
  it('delete_file 进回收站后按既有清单恢复,内容逐字节回来', () => {
    const payload = Buffer.from('F-095 正常恢复 😀\n', 'utf-8');
    const target = path.join(ws, 'note.txt');
    fs.writeFileSync(target, payload);
    recycleDeleteSingleFile(ws, target);
    expect(fs.existsSync(target)).toBe(false);

    const row = listTrash(ws).rows[0]!;
    const r = restoreFromTrash(ws, row.trashId);
    expect(r.ok).toBe(true);
    expect(r.restoredTo).toBe(target);
    expect(Buffer.compare(fs.readFileSync(target), payload)).toBe(0);

    // 直接出口也必须成功(单段清单名 + 工作区内绝对原路径)
    fs.rmSync(target);
    expect(restoreTrashEntry(ws, row.trashId, target)).toBe(target);
    expect(Buffer.compare(fs.readFileSync(target), payload)).toBe(0);
  });
});
