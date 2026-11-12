// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-101 / F-102 缺陷钉子(2026-11-12)。两票都已修复但缺测试,本件只钉行为不判源码。
//
//  F-101 读侧 ACL 子目录 .env:`file-access-policy.ts` 的凭据规则表已有递归 deny 形态
//  「glob-recursive-env」与「glob-recursive-env-dot-star」两条,例外族「glob-env-example」/
//  「glob-env-template」必须排在它们之前(裁决按声明序取首个命中,见 decideFileAccess)——
//  否则子目录下的模板件会被误伤。钉子只经 evaluateFileAccess 的公开出口判 deny/allow,
//  规则表零复算(§0.6/§22c)。
//
//  F-102 grep 绕过 ACL:`builtins.ts` 的 grep execute 已做两道闸 ——
//   ① 搜索根容器性断言(isWithinRootPath + realpathOrSelf),越界绝对路径 / `../../` 在任何
//     fs 调用之前拒绝(fail closed;实路径解析封掉符号链接绕行);
//   ② 逐文件读侧 ACL(isReadAclBlocked),凭据件命中不得把正文漏进结果。
//  判据单源 import `src/tools/builtins.js` 与 `src/sandbox/file-access-policy.js`,
//  次序锁用 fnBodyOf 切片(与 acl-followup-b49.test.ts 同法)。
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evaluateFileAccess } from '../src/sandbox/file-access-policy.js';
import { grep } from '../src/tools/builtins.js';
import type { ToolContext } from '../src/tools/index.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp、不得在仓库树内造 git 夹具=门 208);正解=给"测试支持层"在策略表建档 until 2026-12-28

// ── F-101:读侧 ACL 子目录 .env(纯裁决,不碰 fs) ──────────────────────────────

describe('F-101 读侧 ACL 子目录 .env', () => {
  const ws = path.resolve('.');

  it('正例:工作区子目录 apps/web/.env.local 经 evaluateFileAccess(read) 应 deny', () => {
    const r = evaluateFileAccess('read', 'apps/web/.env.local', ws);
    expect(r.blocked).toBe(true);
    expect(r.verdict.decision).toBe('deny');
    // 命中即点名是哪条规则(§0.10:失效方向 = 多要一次定向说明,绝不静默降级)
    expect(r.verdict.rule?.pattern).toBe('**/.env.*');
  });

  it('正例:越界绝对路径 C:\\proj\\.env 也应 deny(靠递归尾段命中,不因越界漏过)', () => {
    // 跨平台判据:本仓 glob 语义按 POSIX 折算,Windows 绝对形态由 toAclPath 折回相对;
    // 此处只钉"凭据件尾段形态打不漏"这一事实,盘符解析由 toAclPath 自测覆盖。
    const r = evaluateFileAccess('read', 'C:\\proj\\.env', ws);
    expect(r.blocked).toBe(true);
    expect(r.verdict.decision).toBe('deny');
    expect(r.verdict.rule?.pattern).toBe('**/.env');
  });

  it('反例防误伤:.env.example / .env.template 应放行(不 deny)', () => {
    for (const p of ['.env.example', '.env.template', 'apps/web/.env.example', 'apps/web/.env.template']) {
      const r = evaluateFileAccess('read', p, ws);
      expect(r.blocked, p).toBe(false);
      expect(r.verdict.decision, p).toBe('allow');
    }
  });
});

// ── F-102:grep 搜索根容器性断言 + 读侧 ACL 复用 ─────────────────────────────────

/** 取某导出函数的源码切片(次序锁只读源码,不复算判据;与 acl-followup-b49 同法)。 */
function fnBodyOf(name: string): string {
  const src = fs.readFileSync(path.resolve('src/tools/builtins.ts'), 'utf-8');
  const marker = `export const ${name}`;
  const at = src.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const next = src.indexOf('\nexport const ', at + 1);
  return src.slice(at, next === -1 ? src.length : next);
}

describe('F-102 grep 搜索根容器性断言 + 逐文件读侧 ACL', () => {
  let repo = '';

  beforeEach(() => {
    repo = mkScratch('f-101-102-grep-');
  });

  afterEach(() => {
    const dir = repo;
    repo = '';
    if (dir !== '') rmScratch(dir);
  });

  it('正例:搜索根在工作区内 ⇒ 正常执行,不报"搜索根必须位于工作区内"', async () => {
    fs.writeFileSync(path.join(repo, 'a.ts'), 'const token = "seed";\n', 'utf-8');
    const ctx: ToolContext = { workspacePath: repo };
    const result = await grep.execute({ pattern: 'token', path: '.' }, ctx);
    // 越界拒绝文案不该出现 —— 这是容器性断言的反向牙(没拒合法操作)
    expect(result.error ?? '').not.toContain('搜索根必须位于工作区内');
    expect(result.success).toBe(true);
  });

  it('反例:搜索根越界(真实盘上工作区外的目录) ⇒ 失败且 error 含"搜索根必须位于工作区内"', async () => {
    const outside = mkScratch('f-101-102-outside-'); // 真实存在的越界目录,不是编出来的路径
    try {
      fs.writeFileSync(path.join(outside, 'leak.txt'), 'secret\n', 'utf-8');
      const ctx: ToolContext = { workspacePath: repo };
      const result = await grep.execute({ pattern: 'secret', path: outside }, ctx);
      expect(result.success).toBe(false);
      expect(result.error ?? '').toContain('搜索根必须位于工作区内');
    } finally {
      rmScratch(outside);
    }
  });

  it('次序锁:grep execute 内容器性断言排在任何 fs 调用之前(越界即拒,fail closed)', () => {
    const body = fnBodyOf('grep');
    const contain = body.indexOf('isWithinRootPath(');
    const aclRoot = body.indexOf('isReadAclBlocked(');
    expect(contain).toBeGreaterThan(-1);
    expect(aclRoot).toBeGreaterThan(-1);
    // 判定放在 statSync 之前:越界路径连 statSync 都不该走到
    expect(body.indexOf('fs.statSync(')).toBeGreaterThan(contain);
    // 逐文件过滤与根文件裁决都复用同一把读侧 ACL 尺(判据单源)
    expect(body.indexOf('isReadAclBlocked(ctx, m.file)')).toBeGreaterThan(aclRoot);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
