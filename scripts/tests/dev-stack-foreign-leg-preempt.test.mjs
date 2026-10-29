// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/dev-stack-foreign-leg-preempt.test.mjs — 外来 dev 腿夺回判据的接线锁
//
// 立因(2026-10-29 现读):8801/8802/8803 被第三方 IDE 沙箱以 NT AUTHORITY\SYSTEM 身份抢跑,
// 本守护的腿只能 EADDRINUSE 崩溃循环,而 SYSTEM 解不开当前用户的 DPAPI ⇒ 号池回灌腿整轮
// 未判定。夺回必须窄:同用户的手工实例(别席在飞交付)一颗也不能杀。
// §22c:判据直接 import 生产函数,本文件零复制。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { __test__ } from '../dev-stack.mjs';

const { shouldPreemptForeignLeg, FOREIGN_LEG_DISABLED_FLAG } = __test__;

const SRC = readFileSync(
  fileURLToPath(new URL('../dev-stack.mjs', import.meta.url)),
  'utf8',
);

const ROOT_PATH = 'G:\\IHUI-AI';
const OUR_LEG = `node.exe --require ${ROOT_PATH}\\node_modules\\.pnpm\\tsx@4.23.12\\preflight.cjs`;

test('判据齐备:函数与关档旗标都从生产侧导出(未在测试里复制)', () => {
  assert.equal(typeof shouldPreemptForeignLeg, 'function');
  assert.equal(FOREIGN_LEG_DISABLED_FLAG, 'DEV_STACK_NO_FOREIGN_LEG_PREEMPT');
});

test('别的身份 + 命令行含本仓根 ⇒ 夺回(开机抢跑那一型)', () => {
  assert.equal(
    shouldPreemptForeignLeg({
      repoRoot: ROOT_PATH,
      holder: { ownerUser: 'SYSTEM', cmdline: OUR_LEG },
      selfUser: 'administrator',
    }),
    true,
  );
});

test('同用户的手工实例绝不动(反向牙:把它改成恒夺,本例必须翻红)', () => {
  assert.equal(
    shouldPreemptForeignLeg({
      repoRoot: ROOT_PATH,
      holder: { ownerUser: 'Administrator', cmdline: OUR_LEG },
      selfUser: 'administrator',
    }),
    false,
  );
});

test('占位者命令行不含本仓根 ⇒ 不动(那是别的服务,不是我们的腿)', () => {
  assert.equal(
    shouldPreemptForeignLeg({
      repoRoot: ROOT_PATH,
      holder: { ownerUser: 'SYSTEM', cmdline: 'node.exe cdn-server.js --root server-root' },
      selfUser: 'administrator',
    }),
    false,
  );
});

test('取不到身份或命令行 ⇒ 未判定,一律不动(§0.3 不猜)', () => {
  for (const holder of [
    { ownerUser: '', cmdline: OUR_LEG },
    { ownerUser: 'SYSTEM', cmdline: '' },
    { ownerUser: undefined, cmdline: undefined },
  ]) {
    assert.equal(shouldPreemptForeignLeg({ repoRoot: ROOT_PATH, holder, selfUser: 'administrator' }), false);
  }
  assert.equal(
    shouldPreemptForeignLeg({ repoRoot: '', holder: { ownerUser: 'SYSTEM', cmdline: OUR_LEG }, selfUser: 'administrator' }),
    false,
  );
});

test('形状锁:取不到属主时不得出现 taskkill;dry-run 只检不杀', () => {
  const nullBranch = SRC.slice(SRC.indexOf('if (holders === null)'), SRC.indexOf('const me = currentUser'));
  assert.ok(nullBranch.length > 0 && nullBranch.includes('return'));
  assert.equal(nullBranch.includes('taskkill'), false, '未判定分支里出现 taskkill = 拿猜的杀进程');
  assert.equal(
    (SRC.match(/reclaimForeignLegs\(\{ dryRun: true \}\)/g) ?? []).length,
    1,
    '只检档必须唯一(多一处就可能把"看"当成"杀")',
  );
  assert.equal(SRC.includes('reclaimForeignLegs();'), true, '守护启动必须真接上对账(接了才算存在)');
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
