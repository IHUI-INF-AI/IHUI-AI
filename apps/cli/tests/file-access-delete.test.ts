// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件访问裁决的 **delete 轴**接线验证(goal-b49 主席续集)。
 * 判据单源在 `src/sandbox/file-access-policy.ts`(纯函数已有 16 例);
 * 本件只量两件事:①删除请求真问到这一层(且由 delete 轴定论,不被写轴遮蔽);
 * ②拒绝时副作用一个都没起(不复制、不 unlink、不建回收站)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createDeleteFileTool } from '../src/tools/file-edit.js';
import { CREDENTIAL_FILE_ACCESS_RULES } from '../src/sandbox/file-access-policy.js';
import { getDeleteTrashDir } from '../src/tools/file-batch-edit.js';

let workDir = '';
let origHooks: string | undefined;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-file-acl-delete-'));
  // 与 delete-guard 用例同法:把钩子配置指到不存在的文件,排除钩子面这一变量
  origHooks = process.env.IHUI_HOOKS_CONFIG;
  process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
});

afterEach(() => {
  if (origHooks === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origHooks;
  fs.rmSync(workDir, { recursive: true, force: true });
});

function ctx() {
  return { workspacePath: workDir };
}

describe('delete 轴:由本轴定论,且拒绝早于任何删除副作用', () => {
  it('① .env 删除被拒:理由点名 delete 轴与原文件,文件原样在位、回收站根没被建过', async () => {
    fs.writeFileSync(path.join(workDir, '.env'), 'SUPER_SECRET=do-not-leak\n', 'utf-8');
    const tool = createDeleteFileTool(ctx());
    const r = await tool.execute({ path: '.env', confirm: true }, ctx());

    expect(r.success).toBe(false);
    const err = r.error ?? '';
    expect(err).toContain('file-acl');
    // 定论必须来自 delete 轴(写成 write 就是遮蔽,不是分维)
    expect(err).toContain('delete .env');
    expect(err).toContain('[file-acl ask]');
    expect(fs.existsSync(path.join(workDir, '.env'))).toBe(true);
    expect(fs.existsSync(getDeleteTrashDir(workDir))).toBe(false);
    // 拒绝理由不得回显被保护文件的正文(本仓最高频事故型)
    expect(err).not.toContain('do-not-leak');
  });

  it('② 私钥族同样被拒,并点名命中的规则', async () => {
    fs.mkdirSync(path.join(workDir, 'deploy'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'deploy', 'signer.pem'), '-----BEGIN-----\n', 'utf-8');
    const tool = createDeleteFileTool(ctx());
    const r = await tool.execute({ path: 'deploy/signer.pem', confirm: true }, ctx());

    expect(r.success).toBe(false);
    expect(r.error ?? '').toContain('*.pem');
    expect(fs.existsSync(path.join(workDir, 'deploy', 'signer.pem'))).toBe(true);
  });

  it('③ 正向对照:普通文件照常删除并进回收站(不把自己变成恒拦门)', async () => {
    fs.writeFileSync(path.join(workDir, 'notes.txt'), 'hello', 'utf-8');
    const tool = createDeleteFileTool(ctx());
    const r = await tool.execute({ path: 'notes.txt', confirm: true }, ctx());

    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(workDir, 'notes.txt'))).toBe(false);
    expect(fs.existsSync(getDeleteTrashDir(workDir))).toBe(true);
  });

  it('④ 例外族不被牵连:.env.example 可删(声明序在通配族之前)', async () => {
    fs.writeFileSync(path.join(workDir, '.env.example'), 'FOO=\n', 'utf-8');
    const tool = createDeleteFileTool(ctx());
    const r = await tool.execute({ path: '.env.example', confirm: true }, ctx());
    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(workDir, '.env.example'))).toBe(false);
  });

  it('⑤ 形状锁:裁决层挂在 folder_trust 缺省路径之后仍会被问到(上一枚提交在这里提前 return 过)', () => {
    const src = fs.readFileSync(new URL('../src/tools/index.ts', import.meta.url), 'utf8');
    const fn = src.slice(
      src.indexOf('export function checkPathWritePermission'),
      src.indexOf('// ==================== LSP Tools'),
    );
    expect(fn).toBeTruthy();
    // 不得再有"没有 trustMap 就整体放行"的短路
    expect(fn).not.toMatch(/if \(!ctx\.folderTrust\) return \{ allowed: true \}/);
    expect(fn).toContain("evaluateFileAccess(op,");
  });

  it('⑦ 穷尽性:凭据族每条 read deny 都必须同时管 delete(本用例抓到过一次真漏洞)', () => {
    // 立因:表初版只写 `ops: { read: 'deny' }` ⇒ 私钥"读不到但可以直接删",
    // 分维设计最怕的就是**漏一维**;这条断言把"不许漏维"钉成机器判据。
    const missing = CREDENTIAL_FILE_ACCESS_RULES.filter(
      (r) => r.ops.read === 'deny' && r.ops.delete === undefined,
    ).map((r) => r.pattern);
    expect(missing).toEqual([]);
  });

  it('⑥ 形状锁:删除漏斗的拒绝排在 copy 与 unlink 之前', () => {
    const src = fs.readFileSync(
      new URL('../src/tools/file-batch-edit.ts', import.meta.url),
      'utf8',
    );
    const fn = src.slice(src.indexOf('function stashFileToTrash'), src.indexOf('function replayFileNameOf'));
    const guardAt = fn.indexOf('evaluateFileAccess');
    const copyAt = fn.indexOf('fs.copyFileSync');
    const unlinkAt = fn.indexOf('fs.unlinkSync');
    expect(guardAt).toBeGreaterThan(-1);
    expect(copyAt).toBeGreaterThan(-1);
    expect(unlinkAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(copyAt);
    expect(guardAt).toBeLessThan(unlinkAt);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
