// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const mod = await import(pathToFileURL(resolve('lib.mjs')).href);
const src = { a: 1, b: 2, c: 3 };
const out = mod.omit(src, ['b', 'zz']);
assert.deepEqual(out, { a: 1, c: 3 });
assert.deepEqual(src, { a: 1, b: 2, c: 3 }, '原对象不得被修改');
assert.deepEqual(mod.omit({ a: 1 }, ['zz']), { a: 1 });
console.log('PASS');
