// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 Z7(收 B1 未竟 5):worktree 回收站搬运的**跨盘物理腿**行为钉。
 *
 * 不真的跨卷(本机做不到,也不该做):EXDEV 那一档由"搬运点先问同卷事实、再走镜像腿"覆盖,
 * 镜像腿本身用夹具目录直接跑真复制。射程四格:
 *  ① 镜像成功 ⇒ 条目进回收站**且逐文件字节等值** + 清单是本仓那一份形态(`isTrashManifestShape` 真判);
 *  ② "可恢复"不是口头承诺 ⇒ 镜像后删源,`restoreTrashEntry` 能把整目录搬回原位且内容等值;
 *  ③ 复制成功而**记账失败** ⇒ 原文件必须还在(副作用未发生断言)+ 自家半件被既有删除通道清掉,
 *     并配**正向对照**(同夹具不注失败 seam ⇒ 必须成功,否则 ③ 的零副作用只是夹具坏了);
 *  ④ 装车证明:两个搬运点(`WorktreeManager.remove` / `cleanupWorktree`)都真的接上镜像腿,
 *     且顺序恒为"镜像 → 既有那一条 rmSync";worktree.ts 里 `fs.rmSync` 的枚数**不得变多**(不新增裸删点)。
 * 夹具落点:`scripts/lib/scratch-dir.mjs` 的 `mkScratch`(§15b/§26);本仓 `.ihui/delete-trash` 现读 0 枚 ⇒
 * 用例绝不碰真实工作树。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTrashManifestShape, type TrashManifest } from '@ihui/shared/delete-guard';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp、不得在仓库树内造 git 夹具=门 208);正解=给"测试支持层"在策略表建档 until 2026-12-28
import { getDeleteTrashDir, restoreTrashEntry } from '../src/tools/file-batch-edit.js';
import { mirrorDirIntoTrash, sameVolume } from '../src/tools/worktree.js';

let ws: string;
beforeEach(() => (ws = mkScratch('ihui-worktree-crossdrive-')));
afterEach(() => rmScratch(ws));

const FILES: Record<string, string> = {
  'a.txt': 'alpha-contents',
  'b.bin': 'x'.repeat(4096),
  'sub/c.txt': 'gamma-in-a-subdir',
};

/** 造一枚"像 worktree 的目录":多层 + 两种体积,返回绝对路径 */
function seedWorktreeDir(name = 'wt-1'): string {
  const root = path.join(ws, '.worktrees', name);
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  for (const [rel, text] of Object.entries(FILES)) fs.writeFileSync(path.join(root, rel), text, 'utf-8');
  return root;
}

function manifestOf(trashId: string): TrashManifest {
  const file = path.join(getDeleteTrashDir(ws), trashId, 'manifest.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
  expect(isTrashManifestShape(parsed)).toBe(true);
  return parsed as TrashManifest;
}

function flatten(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string, prefix = ''): void => {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      if (item.isDirectory()) walk(path.join(current, item.name), `${prefix}${item.name}/`);
      else out[`${prefix}${item.name}`] = fs.readFileSync(path.join(current, item.name), 'utf-8');
    }
  };
  walk(dir);
  return out;
}

describe('① 跨盘镜像腿:条目真进回收站,字节逐文件等值', () => {
  it('复制 + 自证 + 记账三步都成;镜像全程不碰源', () => {
    const src = seedWorktreeDir();
    const r = mirrorDirIntoTrash(ws, src, 'wt-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const trashId = path.basename(path.dirname(r.trashPath));
    expect(r.trashPath).toBe(path.join(getDeleteTrashDir(ws), trashId, 'wt-1'));
    expect(flatten(r.trashPath)).toEqual(FILES); // 副本逐文件等值
    const manifest = manifestOf(trashId);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]).toMatchObject({ kind: 'directory', originalPath: src, relativeTrashPath: 'wt-1' });
    // 校验过的字节和落进清单 ⇒ 大目录(超清理器枚举预算)也不会被当成"量不到"
    const expectedBytes = Object.values(FILES).reduce((n, t) => n + Buffer.byteLength(t), 0);
    expect(manifest.entries[0]?.sizeBytes).toBe(expectedBytes);
    // 镜像腿一个字节都不删:源此刻必须还在(删源是调用方那一条既有腿)
    expect(flatten(src)).toEqual(FILES);
  });

  it('同卷事实现读:同目录 ⇒ true,取不到 ⇒ false(取不到就保守走镜像腿,不假装试 rename)', () => {
    const src = seedWorktreeDir();
    expect(sameVolume(ws, src)).toBe(true);
    expect(sameVolume(ws, path.join(ws, '不存在-please-ignore'))).toBe(false);
  });
});

describe('② 「可恢复」承诺:镜像 → 删源 → 恢复,整目录回到原位且内容等值', () => {
  it('跨盘搬运后的现场真能取回来', () => {
    const src = seedWorktreeDir('wt-restore');
    const r = mirrorDirIntoTrash(ws, src, 'wt-restore');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const trashId = path.basename(path.dirname(r.trashPath));
    fs.rmSync(src, { recursive: true, force: true }); // 调用方那一条既有兜底腿
    expect(fs.existsSync(src)).toBe(false);
    const back = restoreTrashEntry(ws, trashId, src);
    expect(back).toBe(src);
    expect(flatten(src)).toEqual(FILES);
  });
});

describe('③ 记账失败 ⇒ 源必须还在(副作用未发生),半件不得留在回收站', () => {
  it('复制成功而清单写不进:返 ok=false、源逐文件在位、无清单、无半件', () => {
    const src = seedWorktreeDir('wt-bail');
    const r = mirrorDirIntoTrash(ws, src, 'wt-bail', {
      writeIndex: () => {
        throw new Error('夹具:索引写入通道不可用');
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('记账失败');
    expect(flatten(src)).toEqual(FILES); // 正向对照在下一条用例里(不注 seam 必须成功)
    const root = fs.readdirSync(getDeleteTrashDir(ws));
    expect(root).toHaveLength(0); // 半件连同其目录一起被既有删除通道清掉
  });

  it('正向对照:同一夹具不注失败 seam ⇒ 镜像必须成功(否则上一条的"零副作用"只是夹具坏了)', () => {
    const src = seedWorktreeDir('wt-control');
    expect(mirrorDirIntoTrash(ws, src, 'wt-control').ok).toBe(true);
  });

  it('复制本身抛错 ⇒ 同样返 ok=false,且回收站里一个字节都没落下', () => {
    seedWorktreeDir('wt-copyfail');
    // 源不可解析(cpSync 抛 ENOENT/ENOTDIR)⇒ 不建壳、不写清单、不删任何东西
    const r = mirrorDirIntoTrash(ws, path.join(ws, 'no-such-dir-here'), 'wt-copyfail');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('复制失败');
    expect(fs.existsSync(getDeleteTrashDir(ws))).toBe(false);
  });
});

describe('④ 装车证明:两个搬运点都真的接上镜像腿,且没多出第三条裸删腿', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const toolsDir = path.join(here, '..', 'src', 'tools');
  // Z30 拆档:入口档只留 WorktreeManager.remove() 这一条腿,独立收尾腿搬到 worktree-cleanup.ts。
  // 锁随搬运改指新档 —— 判据一条未放宽:两体各钉一次同序,全 worktree 族的 rmSync 仍是两枚、出声仍是两枚。
  const entrySrc = fs.readFileSync(path.join(toolsDir, 'worktree.ts'), 'utf-8');
  const cleanupSrc = fs.readFileSync(path.join(toolsDir, 'worktree-cleanup.ts'), 'utf-8');
  const removeBody = entrySrc.slice(entrySrc.indexOf('remove(agentId'), entrySrc.indexOf('/** 执行 git worktree prune'));
  const cleanupBody = cleanupSrc.slice(cleanupSrc.indexOf('export function cleanupWorktree'));

  /** 顺序钉:同卷核验 → (同卷才)试 rename → 镜像腿 → 既有那一条 rmSync;兜底腿仍在且只有一条 */
  function orderPin(body: string): void {
    const iVolume = body.indexOf('sameVolume(');
    const iRename = body.indexOf('stashDirToTrash(');
    const iMirror = body.indexOf('mirrorDirIntoTrash(');
    const iRm = body.indexOf('fs.rmSync(wtPath');
    expect(iVolume).toBeGreaterThanOrEqual(0);
    expect(iMirror).toBeGreaterThanOrEqual(0);
    expect(iVolume).toBeLessThan(iMirror);
    expect(iRename).toBeGreaterThan(iVolume);
    expect(iRename).toBeLessThan(iMirror);
    expect(iMirror).toBeLessThan(iRm);
    expect(body.match(/^\s+fs\.rmSync\(/gm)).toHaveLength(1);
  }

  it('WorktreeManager.remove() 与 cleanupWorktree() 都按同一顺序接线', () => {
    // 切片取空 = 腿被搬去别处而锁没跟着搬(§0.9 假绿)⇒ 先自证两体都取到整条腿再钉次序
    expect(removeBody.length, '入口档取不到 WorktreeManager.remove() 体').toBeGreaterThan(600);
    expect(cleanupBody.length, 'worktree-cleanup.ts 取不到 cleanupWorktree() 体').toBeGreaterThan(600);
    orderPin(removeBody);
    orderPin(cleanupBody);
  });

  it('全 worktree 族 `fs.rmSync(` 调用点 = 既有两处兜底腿(入口一条 + 收尾档一条,不新增裸删点)', () => {
    const count = (s: string) => (s.match(/^\s+fs\.rmSync\(/gm) ?? []).length;
    expect(count(entrySrc)).toBe(1);
    expect(count(cleanupSrc)).toBe(1);
    const familyTotal = fs
      .readdirSync(toolsDir)
      .filter((f) => /^worktree.*\.ts$/.test(f))
      .map((f) => count(fs.readFileSync(path.join(toolsDir, f), 'utf-8')))
      .reduce((a, b) => a + b, 0);
    expect(familyTotal).toBe(2);
  });

  it('镜像不成必须出声(两处 callsite 各一条"退回直接删除"的警告)', () => {
    const warns = (s: string) => (s.match(/\[worktree-trash\] ⚠️ 可逆档没走成/g) ?? []).length;
    expect(warns(entrySrc)).toBe(1);
    expect(warns(cleanupSrc)).toBe(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
