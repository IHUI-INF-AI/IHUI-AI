// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/dev-stack-timeout.test.mjs — dev-stack.mjs 参数解析接线锁(§22c 镜像模式)
//
// 立因(2026-10-27):旧 getVal 只认 `--timeout=6` 等号形,`--timeout 600`(空格形)
// 被静默回落默认 120s;叠加 api 冷启动 >120s ⇒ 启动判「start-timeout」假失败。
// 本镜像直接 import 生产判据 getVal/parsePositiveInt(§22c:禁止复制判据),
// 并锁 §22d isDirectRun 双形态(import 无副作用)与两形态实现形状锁。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { __test__ } from '../dev-stack.mjs';

const { getVal, parsePositiveInt } = __test__;

const SRC = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dev-stack.mjs'),
  'utf8',
);

test('getVal: --timeout=600 等号形 ⇒ 600', () => {
  assert.equal(getVal(['--timeout=600'], 'timeout', '120'), '600');
});

test('getVal: --timeout 600 空格形 ⇒ 600(旧实现静默回落 120 的缺陷已封)', () => {
  assert.equal(getVal(['--timeout', '600'], 'timeout', '120'), '600');
});

test('getVal: 等号形与空格形混用 ⇒ 等号形优先(与出现顺序无关)', () => {
  assert.equal(getVal(['--timeout', '600', '--timeout=300'], 'timeout', '120'), '300');
  assert.equal(getVal(['--timeout=300', '--timeout', '600'], 'timeout', '120'), '300');
});

test('getVal: --timeout 无值 ⇒ 回落默认(裸旗标不算带值)', () => {
  assert.equal(getVal(['--timeout'], 'timeout', '120'), '120');
  assert.equal(getVal(['--timeout', '--watch'], 'timeout', '120'), '120');
  assert.equal(getVal([], 'timeout', '120'), '120');
});

test('getVal: --timeout abc 收到原值,由 parsePositiveInt 判死(不静默回落)', () => {
  assert.equal(getVal(['--timeout', 'abc'], 'timeout', '120'), 'abc');
  assert.throws(() => parsePositiveInt('timeout', 'abc', 120), /--timeout/);
});

test('parsePositiveInt: NaN / ≤0 / 空串形态边界', () => {
  assert.throws(() => parsePositiveInt('timeout', '0', 120), /--timeout/);
  assert.throws(() => parsePositiveInt('timeout', '-5', 120), /--timeout/);
  assert.throws(() => parsePositiveInt('timeout', '1e400', 120), /--timeout/); // Infinity
  assert.throws(() => parsePositiveInt('timeout', '', 120), /--timeout/);
  // 缺参(null)与报错信息各归各位:缺参回落默认,坏值点名参数与原值
  assert.equal(parsePositiveInt('timeout', null, 120), 120);
  assert.throws(() => parsePositiveInt('interval', 'oops', 30), (e) => e.message.includes('"oops"') && e.message.includes('--interval'));
});

test('getVal: --only api,web 空格形同样解析成功', () => {
  assert.equal(getVal(['--only', 'api,web'], 'only', null), 'api,web');
  assert.equal(getVal(['--only=api,web'], 'only', null), 'api,web');
});

test('getVal: 下一项以 -- 开头不算值(不会把别的旗标吞成参数值)', () => {
  assert.equal(getVal(['--only', '--json'], 'only', null), null);
  assert.equal(getVal(['--interval', '--watch'], 'interval', '30'), '30');
});

test('形状锁:getVal 源码两形态并存,不再只有等号形单一实现', () => {
  const fnBody = SRC.match(/function getVal\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(fnBody, '源码中必须存在 function getVal');
  assert.ok(fnBody.includes("startsWith(`--${n}=`)"), '等号形取值必须存在');
  assert.ok(fnBody.includes("indexOf(`--${n}`)"), '空格形取值必须存在');
  assert.ok(fnBody.includes("startsWith('--')"), '下一项 -- 前缀防御必须存在');
});

test('形状锁:§22d isDirectRun 双形态守卫存在(main 不在 import 时执行)', () => {
  assert.match(SRC, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/);
  assert.match(SRC, /if \(isDirectRun\) \{\s*\n\s*main\(\)\.catch/);
});

test('形状锁:start-timeout 报错必须带当前上限数值与 --timeout=600 提示', () => {
  assert.match(SRC, /readyTimeoutMs=\$\{readyTimeoutMs\}/);
  assert.match(SRC, /--timeout=600/);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
