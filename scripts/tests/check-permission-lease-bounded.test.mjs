// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-permission-lease-bounded.mjs`
 *
 * 钉四件事,都是"判据失效表现为安静"那一型(守门 70/76/81/89 同族):
 *  T1 取材面纪律 —— 本门必须走 `face-reader` 的 `catBatch`,不得回到磁盘 `readFileSync`
 *     或散写 `git show`(否则共享工作树滞后 HEAD 时结论会自洽地错位)。
 *  T2 接线声称与实际注册表一致 —— **未注册时不得声称已装车**;若已注册,则必须
 *     blocking + skipEnv 齐备(只接线不给应急出口 = 恒红门)。
 *  T3 真仓 HEAD 面必须 exit 0(门不能对自己产出的形态失明)。
 *  T4 声明行不是调用点(反向锁,防 L1 对定义处产假阳)。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { scanSource } from '../check-permission-lease-bounded.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE = path.join(ROOT, 'scripts', 'check-permission-lease-bounded.mjs');
const RUNNER = path.join(ROOT, 'scripts', 'guardian-runner.mjs');
const src = readFileSync(GATE, 'utf8');

test('T1 取材面纪律:必须走 face-reader 的 catBatch,不得散写 git show / 磁盘读内容', () => {
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/);
  assert.match(src, /catBatch\(/);
  assert.doesNotMatch(src, /gitRaw\(\s*\[[^\]]*'show'/, '内容不得由散写 `git show` 取');
  assert.doesNotMatch(src, /readFileSync\([^)]*join\(ROOT/, '被审内容不得按磁盘读(工作树会滞后 HEAD)');
});

test('T2 未注册时不得声称已装车;已注册则 blocking + skipEnv 必须齐备', () => {
  const runner = readFileSync(RUNNER, 'utf8');
  const registered = runner.includes('check-permission-lease-bounded.mjs');
  const claimsWired = /(已接|已接入)\s*pre-commit|guardian-runner\s*第\s*\d+/.test(src);
  if (!registered) {
    assert.equal(claimsWired, false, '未进注册表却声称已接 pre-commit ⇒ 门 89 R1/R2 该红');
    return;
  }
  const block = runner.slice(runner.indexOf('check-permission-lease-bounded.mjs') - 600, runner.indexOf('check-permission-lease-bounded.mjs') + 600);
  assert.match(block, /blocking/, '已接线但非 blocking:放宽未租约化拦不住提交');
  assert.match(block, /skipEnv/, '已接线但无 skipEnv:恒红时没有应急出口');
});

test('T3 真仓 HEAD 面 exit 0(门对自己产出的形态不失明)', () => {
  const out = execFileSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
  assert.match(out, /✅ 权限放宽均已租约化/);
});

test('T4 声明行不是调用点;调用点缺到期必红', () => {
  assert.equal(
    scanSource('export function grantPermissionLease(input: GrantLeaseInput): PermissionLease {', 'apps/cli/src/tools/permission-lease.ts').length,
    0,
    '定义处被当成调用点判红 ⇒ 门对自身产出失明',
  );
  assert.equal(scanSource("grantPermissionLease({ scope: 's', capabilities: ['a'] })", 'apps/cli/src/x.ts').length, 1);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
