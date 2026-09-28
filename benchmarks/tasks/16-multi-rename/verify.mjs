// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const mu = await import(pathToFileURL(resolve('mathUtils.mjs')).href);
const app = await import(pathToFileURL(resolve('app.mjs')).href);
assert.equal(typeof mu.sum, 'function');
assert.equal(mu.sum(2, 3), 5);
assert.equal('addNumbers' in mu, false);
assert.equal(app.total(1, 2, 3), 6);
const appSrc = readFileSync(resolve('app.mjs'), 'utf8');
assert.equal(appSrc.includes('addNumbers'), false);
console.log('PASS');
