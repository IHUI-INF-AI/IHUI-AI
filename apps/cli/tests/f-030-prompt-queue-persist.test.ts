// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-030 回归:prompt-queue 落盘与损坏处理。
 *
 * 三条判据(各钉一处旧缺陷):
 *   1. tmp 名恒为 `${persistPath}.tmp` ⇒ 两实例同写互相截断 ⇒ 这里并发 persist 多次,
 *      要求每次 tmp 名互不相同、终态是某一实例的**完整**快照、无 tmp 残留;
 *   2. 写/rename 失败静默 ⇒ 要求 warn 到 stderr(且不带 prompt 正文);
 *   3. JSON 损坏直接 unlink ⇒ 要求改名 `.corrupt-<ts>` 隔离,原内容可回读。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PromptQueue } from '../src/prompt-queue.js';

describe('F-030 prompt-queue 落盘与损坏处理', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f030-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  });

  it('两实例并发 persist 不互相截断:tmp 名唯一,终态是某一侧的完整快照', async () => {
    const persistPath = path.join(tmpDir, 'prompt-queue.json');
    const q1 = new PromptQueue();
    const q2 = new PromptQueue();
    q1.enqueue('inst-1-a');
    q1.enqueue('inst-1-b');
    q2.enqueue('inst-2-a');

    const writeFileSpy = vi.spyOn(fs.promises, 'writeFile');
    for (let round = 0; round < 10; round += 1) {
      await Promise.all([q1.saveToDisk(persistPath), q2.saveToDisk(persistPath)]);
    }
    const tmpNames = writeFileSpy.mock.calls.map((call) => String(call[0]));
    writeFileSpy.mockRestore();

    // 20 次写各自一个 tmp 名(旧实现全部是同一个 `prompt-queue.json.tmp`)
    expect(tmpNames).toHaveLength(20);
    expect(new Set(tmpNames).size).toBe(20);
    const expectedShape = new RegExp(`\\.${process.pid}\\.[0-9a-f]{12}\\.tmp$`);
    for (const name of tmpNames) {
      expect(name).toMatch(expectedShape);
    }

    // 终态要么是 q1 的两条,要么是 q2 的一条 —— 不能是拼接/截断后的半截
    const parsed = JSON.parse(fs.readFileSync(persistPath, 'utf-8')) as {
      version: number;
      pending: Array<{ prompt: string }>;
    };
    expect(parsed.version).toBe(1);
    const prompts = parsed.pending.map((it) => it.prompt).sort();
    expect([['inst-1-a', 'inst-1-b'], ['inst-2-a']]).toContainEqual(prompts);

    // 每次 rename 都收走了自己的 tmp,不留残件
    expect(fs.readdirSync(tmpDir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('rename 失败不静默:stderr 有告警,提示不含 prompt 正文,tmp 被清掉', async () => {
    // 目标已是目录 ⇒ rename(file → dir) 必失败(Windows EPERM / POSIX EISDIR)
    const persistPath = path.join(tmpDir, 'as-dir.json');
    fs.mkdirSync(persistPath);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const q = new PromptQueue();
    q.enqueue('隐私正文-should-not-leak');
    await expect(q.saveToDisk(persistPath)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(message).toMatch(/排队记录保存失败/);
    expect(message).toMatch(/EPERM|EACCES|EISDIR/);
    expect(message).not.toContain('隐私正文');

    // 失败分支真的被走到:tmp 已清理,目标目录原样保留
    expect(fs.readdirSync(tmpDir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    expect(fs.statSync(persistPath).isDirectory()).toBe(true);
  });

  it('JSON 损坏:改名 .corrupt-<ts> 隔离而非删除,残留内容可回读', async () => {
    const persistPath = path.join(tmpDir, 'prompt-queue.json');
    const corrupt = '{"version":1,"pending":[{"id":"q-1","prompt":"残档里的排队项"';
    fs.writeFileSync(persistPath, corrupt, 'utf-8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const q = new PromptQueue();
    await expect(q.loadFromDisk(persistPath)).resolves.toBe(0);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]!.join(' ')).toMatch(/隔离|损坏/);
    // 原路径腾空是因为被改名,不是被删
    expect(fs.existsSync(persistPath)).toBe(false);
    const backups = fs.readdirSync(tmpDir).filter((n) => /^prompt-queue\.json\.corrupt-\d+$/.test(n));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(tmpDir, backups[0]!), 'utf-8')).toBe(corrupt);
  });

  it('结构不符合(version 非 1):同样隔离不删除', async () => {
    const persistPath = path.join(tmpDir, 'bad-struct.json');
    const bad = '{"version":2,"pending":{}}';
    fs.writeFileSync(persistPath, bad, 'utf-8');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const q = new PromptQueue();
    await expect(q.loadFromDisk(persistPath)).resolves.toBe(0);

    expect(fs.existsSync(persistPath)).toBe(false);
    const backups = fs.readdirSync(tmpDir).filter((n) => /^bad-struct\.json\.corrupt-\d+$/.test(n));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(tmpDir, backups[0]!), 'utf-8')).toBe(bad);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
