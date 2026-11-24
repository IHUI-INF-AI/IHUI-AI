#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/lib/patch-lint-staged-stdio.mjs 的 CLI 契约(2026-10-27 立)。
 *
 * 为什么单独立这一枚:补丁本体的三针判据已经有 `check-lint-staged-stdio-pin.mjs` 的镜像测试盯着
 * (那条测的是"针在不在"),但**退出码契约**没人钉 —— 而 postinstall 接线(票面出路①)要用的正是它:
 * 安装期读不到安装副本时,strict 档 exit 2 会把 `pnpm install` 顶红,人们下一步只会 `--ignore-scripts`,
 * 连带把 lint-staged 与全部钩子一起关掉。故立 `--soft` 档(恒 0)并把三条优先级钉死:
 *   · 安装副本不在  strict ⇒ exit 2(未判定,不记绿不冒红) / --soft ⇒ exit 0(不中断 install);
 *   · --soft 与 --check 同给 ⇒ exit 2 且**零针读数**(soft 恒 0 会让盯针读数变假绿,必须拒绝);
 *   · --soft 在副本齐全时照常打针(不是"什么都不做"),且二次跑逐字节不变(幂等 = 不写盘)。
 *
 * §0.6 单一真相源:夹具素材(`FIXTURE_LINT_LIB_REL` / `pristineExecGit` / `pristineGetSpawnedTask`)
 * 全部 import 盯针门的 `__test__`,本文件不抄第二份;判据本体在补丁脚本里,本文件只判退出码与落盘字节。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { __test__ as PIN } from '../check-lint-staged-stdio-pin.mjs';
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROD_SCRIPT = join(REPO_ROOT, PIN.PATCH_SCRIPT_REL);

/** 把生产补丁脚本逐字节拷进伪仓(<dir>/scripts/lib/),它读的安装面就落到 <dir>/node_modules。 */
function scaffold(dir) {
  const scriptPath = join(dir, PIN.PATCH_SCRIPT_REL);
  assert.ok(existsSync(PROD_SCRIPT), `生产补丁脚本不存在: ${PROD_SCRIPT}`);
  mkdirSync(dirname(scriptPath), { recursive: true });
  copyFileSync(PROD_SCRIPT, scriptPath);
  return scriptPath;
}

/** 铺上未打针的上游原始形态(素材 import 自盯针门,零复制)。 */
function seedInstall(dir) {
  const libDir = join(dir, PIN.FIXTURE_LINT_LIB_REL);
  mkdirSync(libDir, { recursive: true });
  writeFileSync(join(libDir, 'execGit.js'), PIN.pristineExecGit(), 'utf8');
  writeFileSync(join(libDir, 'getSpawnedTask.js'), PIN.pristineGetSpawnedTask(), 'utf8');
  return libDir;
}

function run(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

test('① 安装副本不在 + strict 档 ⇒ exit 2(未判定:不记绿,也不冒充缺口)', () => {
  const dir = mkScratch('ls-patch-strict-');
  try {
    const r = run(scaffold(dir), ['--check']);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /MISSING /);
  } finally {
    rmScratch(dir, { bestEffort: true });
  }
});

test('② 安装副本不在 + --soft 档 ⇒ exit 0(postinstall 绝不许中断 install)', () => {
  const dir = mkScratch('ls-patch-soft-');
  try {
    const r = run(scaffold(dir), ['--soft']);
    assert.equal(r.status, 0, `--soft 必须恒 0,实际 ${r.status}: ${r.stderr}`);
    assert.match(r.stderr, /MISSING /, '不中断不等于不吭声:必须点名缺的是哪个安装副本');
  } finally {
    rmScratch(dir, { bestEffort: true });
  }
});

test('③ --soft 与 --check 同给 ⇒ exit 2 且零针读数(不许产出假绿)', () => {
  const dir = mkScratch('ls-patch-conflict-');
  try {
    const r = run(scaffold(dir), ['--soft', '--check']); // 故意连安装副本也不铺:两档互斥必须先拦
    assert.equal(r.status, 2);
    assert.match(r.stderr, /不能同给/);
    assert.doesNotMatch(r.stdout, /ALREADY-PATCHED|NEEDS-PATCH/, '冲突档不得吐出任何针读数');
  } finally {
    rmScratch(dir, { bestEffort: true });
  }
});

test('④ --soft 在副本齐全时照常打三针 ⇒ 针齐且二次跑逐字节不变(幂等 = 不写盘)', () => {
  const dir = mkScratch('ls-patch-soft-apply-');
  try {
    const scriptPath = scaffold(dir);
    const libDir = seedInstall(dir);

    assert.equal(run(scriptPath, ['--soft']).status, 0);
    const execGit = readFileSync(join(libDir, 'execGit.js'));
    const spawned = readFileSync(join(libDir, 'getSpawnedTask.js'));
    assert.ok(execGit.includes('stdio:'), '--soft 打完后 execGit.js 仍无 stdio 注针');

    // 针齐:--check 必须 0(soft 打出来的针与 strict 打出来的没有两种形态)
    const check = run(scriptPath, ['--check']);
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.equal((check.stdout.match(/ALREADY-PATCHED/g) || []).length, 3);

    // 二次跑:rc 0 且一个字节都不动
    assert.equal(run(scriptPath, ['--soft']).status, 0);
    assert.ok(readFileSync(join(libDir, 'execGit.js')).equals(execGit), '二次 --soft 改写了 execGit.js');
    assert.ok(readFileSync(join(libDir, 'getSpawnedTask.js')).equals(spawned), '二次 --soft 改写了 getSpawnedTask.js');
  } finally {
    rmScratch(dir, { bestEffort: true });
  }
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
