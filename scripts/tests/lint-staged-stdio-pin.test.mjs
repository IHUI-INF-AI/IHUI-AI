#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:check-lint-staged-stdio-pin.mjs(只读盯针门,2026-10-27 立)。
 *
 * §22c:判据全部 import 生产实现(__test__ 出口),本文件不复制任何判据常量/针形态判断。
 * 钉七环:
 *  ① --check 读数行解析只认 ALREADY-PATCHED / NEEDS-PATCH 两种收尾(apply 档的 PATCHED 不计数);
 *  ② 三档裁决构造面:green / gap / 三类 undetermined(MISSING、零读数跑死、rc 与读数矛盾);
 *  ③ 夹具起步零针 ⇒ gap 三针全点名;生产脚本 apply 后 ⇒ green;
 *  ④ **摘掉一针必红**:恰好点名那一针,其余不误伤;
 *  ⑤ **缺 node_modules 必 exit 2 档**:安装副本摘掉 ⇒ undetermined(重装依赖形态,不记绿不冒红);
 *  ⑥ 判据脚本缺失 ⇒ undetermined;夹具脚本与生产脚本逐字节同形(证明测的是同一份判据);
 *  ⑦ **apply 幂等**:三针打满后再 apply 一次 ⇒ rc=0 且两文件逐字节不变(幂等 = 不写盘,不是"重写一遍同样内容")。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { __test__ as PINS } from '../check-lint-staged-stdio-pin.mjs';
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('① 读数行解析:只认两种收尾;apply 档 PATCHED 行与散文都不计数', () => {
  const out = [
    'execGit.js replace-nodeOptions: ALREADY-PATCHED',
    'execGit.js inject-giterr-visible: NEEDS-PATCH',
    'getSpawnedTask.js inject-tinyExecOptions: PATCHED',
    'check done',
    '  缩进过的同形行不算: execGit.js x: ALREADY-PATCHED',
  ].join('\n');
  const pins = PINS.parsePinLines(out);
  assert.equal(pins.length, 2);
  assert.deepEqual(pins[0], { file: 'execGit.js', mode: 'replace-nodeOptions', state: 'ALREADY-PATCHED' });
  assert.equal(pins[1].state, 'NEEDS-PATCH');
  assert.equal(PINS.parsePinLines('').length, 0);
  assert.equal(PINS.parsePinLines(undefined).length, 0);
});

test('② 三档裁决构造面:MISSING⇒未判定 / 零读数⇒未判定 / 矛盾rc⇒未判定 / 齐针⇒green', () => {
  assert.equal(PINS.interpretCheckRun({ code: 2, stdout: '', stderr: 'MISSING G:/x/execGit.js' }).verdict, 'undetermined');
  const dead = PINS.interpretCheckRun({ code: 1, stdout: '', stderr: 'Error: execGit failure block not found (upstream changed?)' });
  assert.equal(dead.verdict, 'undetermined');
  assert.match(dead.reason, /未判定/);
  const contra = PINS.interpretCheckRun({ code: 7, stdout: 'execGit.js replace-nodeOptions: ALREADY-PATCHED\ncheck done', stderr: '' });
  assert.equal(contra.verdict, 'undetermined');
  const noDone = PINS.interpretCheckRun({ code: 0, stdout: 'execGit.js replace-nodeOptions: ALREADY-PATCHED', stderr: '' });
  assert.equal(noDone.verdict, 'undetermined', '缺收尾行 check done ⇒ 判据没跑完整轮,不得记绿');
  const green = PINS.interpretCheckRun({
    code: 0,
    stdout: 'execGit.js replace-nodeOptions: ALREADY-PATCHED\nexecGit.js inject-giterr-visible: ALREADY-PATCHED\ngetSpawnedTask.js inject-tinyExecOptions: ALREADY-PATCHED\ncheck done',
    stderr: '',
  });
  assert.equal(green.verdict, 'green');
  assert.equal(green.pins.length, 3);
  const gap = PINS.interpretCheckRun({ code: 1, stdout: 'getSpawnedTask.js inject-tinyExecOptions: NEEDS-PATCH\ncheck done', stderr: '' });
  assert.equal(gap.verdict, 'gap');
  assert.deepEqual(gap.needs.map((n) => n.mode), ['inject-tinyExecOptions']);
});

test('②b 退出码映射三档齐绿(0/1/2),未知取值不得静默 0', () => {
  assert.equal(PINS.exitCodeOf('green'), 0);
  assert.equal(PINS.exitCodeOf('gap'), 1);
  assert.equal(PINS.exitCodeOf('undetermined'), 2);
  assert.equal(PINS.exitCodeOf('啥也不是'), 2, '失效方向 = 多要一次说明(未判定),不是放行');
});

test('③④⑤⑥ 真夹具端到端:零针红→apply 绿→摘一针红→缺 node_modules 未判定→缺脚本未判定', () => {
  const dir = mkScratch('lint-staged-pin-mirror-');
  try {
    const { scriptPath, libDir } = PINS.buildPinFixture(dir);

    // 夹具起步:三针全无 ⇒ gap,三针全点名
    const before = PINS.runPinCheck({ scriptPath });
    assert.equal(before.verdict, 'gap');
    assert.equal(before.needs.length, 3);

    // 生产脚本 apply 档打满三针 ⇒ green
    assert.equal(PINS.applyFixturePins(scriptPath), 0);
    const green = PINS.runPinCheck({ scriptPath });
    assert.equal(green.verdict, 'green');
    assert.ok(green.pins.every((p) => p.state === 'ALREADY-PATCHED'));

    // 摘掉一针(还原 getSpawnedTask.js,execGit 两针不动)⇒ 恰好点名该针
    writeFileSync(join(libDir, 'getSpawnedTask.js'), PINS.pristineGetSpawnedTask(), 'utf8');
    const gap = PINS.runPinCheck({ scriptPath });
    assert.equal(gap.verdict, 'gap');
    assert.equal(gap.needs.length, 1);
    assert.equal(gap.needs[0].mode, 'inject-tinyExecOptions');
    assert.equal(gap.needs[0].file, 'getSpawnedTask.js');

    // 复原 ⇒ green,再摘掉安装目录(=重装依赖把 node_modules 洗掉的形态)⇒ 未判定(本器 exit 2)
    assert.equal(PINS.applyFixturePins(scriptPath), 0);
    rmSync(libDir, { recursive: true, force: true });
    const missing = PINS.runPinCheck({ scriptPath });
    assert.equal(missing.verdict, 'undetermined');
    assert.equal(PINS.exitCodeOf(missing.verdict), 2);
    assert.match(missing.reason, /node_modules/);

    // 判据脚本本身读不到 ⇒ 未判定并点名
    rmSync(scriptPath, { force: true });
    const noScript = PINS.runPinCheck({ scriptPath });
    assert.equal(noScript.verdict, 'undetermined');
    assert.match(noScript.reason, /判据脚本/);
  } finally {
    rmScratch(dir, { bestEffort: true });
  }
});

test('⑥b 夹具脚本与生产判据逐字节同形(镜像测的就是装车的那份判据,零复制)', () => {
  const dir = mkScratch('lint-staged-pin-bytes-');
  try {
    const realPath = join(REPO_ROOT, PINS.PATCH_SCRIPT_REL);
    const { scriptPath } = PINS.buildPinFixture(dir);
    assert.ok(readFileSync(scriptPath).equals(readFileSync(realPath)));
  } finally {
    rmScratch(dir, { bestEffort: true });
  }
});

test('⑦ apply 幂等:三针打满后再 apply 一次 ⇒ rc=0、两文件逐字节不变、--check 仍 green', () => {
  const dir = mkScratch('lint-staged-pin-idem-');
  try {
    const { scriptPath, libDir } = PINS.buildPinFixture(dir);
    assert.equal(PINS.applyFixturePins(scriptPath), 0);
    const execGit = readFileSync(join(libDir, 'execGit.js'));
    const getSpawnedTask = readFileSync(join(libDir, 'getSpawnedTask.js'));
    // 二次跑:票面要求的"ALREADY-PATCHED 并 exit 0",且**一个字节都不许改**(幂等 = 不写盘)
    assert.equal(PINS.applyFixturePins(scriptPath), 0);
    assert.ok(readFileSync(join(libDir, 'execGit.js')).equals(execGit), '二次 apply 改写了 execGit.js');
    assert.ok(readFileSync(join(libDir, 'getSpawnedTask.js')).equals(getSpawnedTask), '二次 apply 改写了 getSpawnedTask.js');
    const after = PINS.runPinCheck({ scriptPath });
    assert.equal(after.verdict, 'green');
    assert.equal(PINS.exitCodeOf(after.verdict), 0);
  } finally {
    rmScratch(dir, { bestEffort: true });
  }
});

test('默认落点 = 仓内生产脚本(路径事实;判据住在被 spawn 的脚本里,本门零判据)', () => {
  const defaultCheck = PINS.runPinCheck({});
  assert.equal(defaultCheck.scriptPath.replace(/\\/g, '/'), `${REPO_ROOT.replace(/\\/g, '/')}/scripts/lib/patch-lint-staged-stdio.mjs`);
  assert.ok(['green', 'gap', 'undetermined'].includes(defaultCheck.verdict));
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
